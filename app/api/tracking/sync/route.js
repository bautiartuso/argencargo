// Orquestador: llamado por cron cada 6h.
// Itera ops activas con tracking internacional + carrier y sincroniza eventos.
// Protegido con CRON_SECRET para evitar abuso.

import { SB_URL, SB_SERVICE, upsertEvent, updateSyncStatus, normalizeEvent } from "../_helpers";

const ACTIVE_STATUSES = ["en_transito", "arribo_argentina", "en_aduana", "lista_retiro"];

async function fetchActiveOps(operationId) {
  let url;
  if (operationId) {
    url = `${SB_URL}/rest/v1/operations?select=id,operation_code,international_tracking,international_carrier,status&id=eq.${operationId}`;
  } else {
    const statuses = ACTIVE_STATUSES.map(s => `"${s}"`).join(",");
    url = `${SB_URL}/rest/v1/operations?select=id,operation_code,international_tracking,international_carrier,status&status=in.(${statuses})&international_tracking=not.is.null&international_carrier=not.is.null`;
  }
  const r = await fetch(url, { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } });
  return await r.json();
}

function carrierRoute(carrier) {
  const c = (carrier || "").toLowerCase();
  if (c.includes("dhl")) return "dhl";
  if (c.includes("fedex")) return "fedex";
  if (c.includes("ups")) return "ups";
  return null;
}

async function syncOne(origin, op) {
  const route = carrierRoute(op.international_carrier);
  if (!route) return { op: op.operation_code, skipped: "carrier desconocido" };

  const r = await fetch(`${origin}/api/tracking/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingNumber: op.international_tracking })
  });
  const d = await r.json();
  if (d.error) {
    await updateSyncStatus(op.id, route, 0, d.error);
    return { op: op.operation_code, error: d.error };
  }

  let inserted = 0;
  const errors = [];
  for (const ev of d.events || []) {
    const { ok, error } = await upsertEvent(normalizeEvent({
      operation_id: op.id,
      source: route,
      carrier: op.international_carrier,
      ...ev
    }));
    if (ok) inserted++;
    else if (error && errors.length < 3) errors.push(error);
  }

  // ETA / fecha entrega real → operations.eta (y status si ya llegó al courier)
  const patch = {};
  if (d.eta) patch.eta = d.eta;
  if (Object.keys(patch).length) {
    await fetch(`${SB_URL}/rest/v1/operations?id=eq.${op.id}`, {
      method: "PATCH",
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(patch)
    });
  }

  await updateSyncStatus(op.id, route, inserted, errors[0] || null);
  return { op: op.operation_code, inserted, carrier: route, eta: d.eta || null, errors: errors.length ? errors : undefined };
}

async function runSync(req) {
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;

  const auth = req.headers.get("authorization") || url.searchParams.get("secret") || "";
  const expected = process.env.CRON_SECRET || "";
  let authorized = !expected || auth === `Bearer ${expected}` || auth === expected;
  if (!authorized && auth.startsWith("Bearer ")) {
    // Verificar que es un JWT de admin válido
    const jwt = auth.slice(7);
    try {
      const v = await fetch(`${SB_URL}/rest/v1/profiles?select=role&id=eq.${JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString()).sub}`, {
        headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }
      });
      const p = await v.json();
      if (Array.isArray(p) && p[0]?.role === "admin") authorized = true;
    } catch {}
  }
  if (!authorized) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "SUPABASE_SERVICE_ROLE no configurado" }, { status: 500 });

  const operationId = url.searchParams.get("operation_id");
  const ops = await fetchActiveOps(operationId);
  if (!Array.isArray(ops)) return Response.json({ error: "failed to fetch ops", detail: ops }, { status: 500 });

  const results = [];
  for (const op of ops) {
    try { results.push(await syncOne(origin, op)); }
    catch (e) { results.push({ op: op.operation_code, error: String(e.message || e) }); }
  }
  return Response.json({ synced: results.length, results });
}

// GET y POST → mismo comportamiento. Vercel Cron usa GET por defecto.
export async function GET(req) { return runSync(req); }
export async function POST(req) { return runSync(req); }
