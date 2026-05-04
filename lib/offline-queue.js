// Cola offline para el agente: guarda paquetes pendientes en IndexedDB
// y los sube cuando vuelve la conexión.
// Uso:
//   enqueuePackage(payload, photoBlob, token) → guarda en IndexedDB
//   processQueue(token) → intenta subir todo lo pendiente
//   getPendingCount() → cuántos hay sin sincronizar
//   onQueueChange(cb) → suscribirse a cambios

const DB_NAME = "ac-agente-offline";
const DB_VERSION = 1;
const STORE = "package_queue";

let _listeners = [];

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB no disponible"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("created_at", "created_at");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode = "readonly") {
  const db = await openDB();
  const t = db.transaction(STORE, mode);
  return t.objectStore(STORE);
}

function notifyChange() {
  _listeners.forEach((cb) => { try { cb(); } catch {} });
}

export function onQueueChange(cb) {
  _listeners.push(cb);
  return () => { _listeners = _listeners.filter((x) => x !== cb); };
}

export async function enqueuePackage({ table, body, photoBlob, photoFileName }) {
  try {
    const store = await tx("readwrite");
    const item = {
      table,
      body,
      photoBlob: photoBlob || null,
      photoFileName: photoFileName || null,
      created_at: Date.now(),
      attempts: 0,
      lastError: null,
    };
    await new Promise((res, rej) => {
      const r = store.add(item);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    notifyChange();
    return true;
  } catch (e) {
    console.error("enqueue error", e);
    return false;
  }
}

export async function getPending() {
  try {
    const store = await tx("readonly");
    return await new Promise((res, rej) => {
      const r = store.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  } catch { return []; }
}

export async function getPendingCount() {
  const all = await getPending();
  return all.length;
}

async function deleteItem(id) {
  const store = await tx("readwrite");
  await new Promise((res, rej) => {
    const r = store.delete(id);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
  notifyChange();
}

async function updateItem(id, patch) {
  const store = await tx("readwrite");
  const existing = await new Promise((res, rej) => {
    const r = store.get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  if (!existing) return;
  const updated = { ...existing, ...patch };
  await new Promise((res, rej) => {
    const r = store.put(updated);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
  notifyChange();
}

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

// Sube una foto a Supabase storage
async function uploadPhoto(blob, token, fileName) {
  const fname = `${Date.now()}_${(fileName || "photo.jpg").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const path = `agent-uploads/${fname}`;
  const r = await fetch(`${SB_URL}/storage/v1/object/package-photos/${path}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${token}`, "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });
  if (!r.ok) throw new Error(`upload failed: ${r.status}`);
  return `${SB_URL}/storage/v1/object/public/package-photos/${path}`;
}

// Procesa un item de la cola (sube foto si tiene, después POST al table)
async function processItem(item, token) {
  let body = { ...item.body };
  if (item.photoBlob) {
    try {
      const url = await uploadPhoto(item.photoBlob, token, item.photoFileName);
      body.photo_url = url;
      body.photo_uploaded_at = new Date().toISOString();
    } catch (e) {
      throw new Error(`photo upload: ${e.message}`);
    }
  }
  const r = await fetch(`${SB_URL}/rest/v1/${item.table}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`POST ${item.table}: ${r.status} ${txt.slice(0, 100)}`);
  }
}

let _processing = false;
export async function processQueue(token) {
  if (_processing) return { processed: 0, failed: 0, skipped: 0 };
  if (!token) return { processed: 0, failed: 0, skipped: 0, error: "no token" };
  _processing = true;
  try {
    const items = await getPending();
    let processed = 0, failed = 0;
    for (const item of items) {
      try {
        await processItem(item, token);
        await deleteItem(item.id);
        processed++;
      } catch (e) {
        await updateItem(item.id, { attempts: (item.attempts || 0) + 1, lastError: e.message });
        failed++;
      }
    }
    return { processed, failed };
  } finally {
    _processing = false;
  }
}

export async function clearQueue() {
  const store = await tx("readwrite");
  await new Promise((res, rej) => {
    const r = store.clear();
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
  notifyChange();
}
