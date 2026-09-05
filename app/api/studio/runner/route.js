// /api/studio/runner — puerta para el RUNNER LOCAL del Content Studio (la Mac de Bautista con
// Claude Code y su suscripción Max: el diseño no cuesta API).
//
// GET  /next          → toma la pieza más vieja de la cola (lock 15 min), genera la foto de fondo
//                       en el servidor si hay proveedor de imágenes, y devuelve pieza + memoria.
//                       204 si no hay nada.
// POST /done  (multipart: id, html, headline, subheadline, caption, hashtags, png) → storage + review.
// POST /error (json: id, error) → suma intento; al 2º queda en 'error'.
// Auth: header x-runner-secret = RUNNER_SECRET.

import { sb, loadMemory } from "../../../../lib/studio";
import { generatePhoto, geminiConfigured } from "../../../../lib/gemini-image";

export const maxDuration = 120;
export const runtime = "nodejs";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

const okAuth = (req) => !!process.env.RUNNER_SECRET && req.headers.get("x-runner-secret") === process.env.RUNNER_SECRET;

async function upload(pathname, buffer, mime) {
  const up = await fetch(`${SB_URL}/storage/v1/object/content-studio/${pathname}`, { method: "POST", headers: { Authorization: `Bearer ${SB_SERVICE}`, apikey: SB_SERVICE, "Content-Type": mime, "x-upsert": "true" }, body: buffer });
  if (!up.ok) throw new Error(`storage ${up.status}`);
  return `${SB_URL}/storage/v1/object/public/content-studio/${pathname}`;
}

export async function GET(req) {
  if (!okAuth(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const stale = new Date(Date.now() - 15 * 60000).toISOString();
  const r = await sb(`/cs_pieces?status=eq.generating&or=(locked_at.is.null,locked_at.lt.${stale})&select=*&order=created_at.asc&limit=1`);
  const piece = Array.isArray(r.body) && r.body[0];
  if (!piece) return new Response(null, { status: 204 });
  const lock = await sb(`/cs_pieces?id=eq.${piece.id}&status=eq.generating&or=(locked_at.is.null,locked_at.lt.${stale})`, { method: "PATCH", body: JSON.stringify({ locked_at: new Date().toISOString() }) });
  if (!(Array.isArray(lock.body) && lock.body.length)) return new Response(null, { status: 204 });

  // Foto de fondo (paga, la hace el servidor para que el runner no necesite claves de imágenes).
  let photo_url = piece.photo_url || null;
  if (!photo_url && piece.photo_prompt && geminiConfigured()) {
    try {
      const img = await generatePhoto(`${piece.photo_prompt}. Contexto: empresa argentina de logística internacional e importación desde China.`, { aspect: piece.kind === "story" ? "9:16" : "4:5" });
      if (img) {
        photo_url = await upload(`fotos/${piece.id}-${Date.now()}.${img.mime.includes("jpeg") ? "jpg" : "png"}`, img.buffer, img.mime);
        await sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ photo_url }) });
      }
    } catch (e) { console.error("[studio/runner] foto", e.message); }
  }
  const memory = await loadMemory();
  return Response.json({ piece: { ...piece, photo_url }, memory: Object.fromEntries(memory.map((m) => [m.key, m.content])) });
}

export async function POST(req) {
  if (!okAuth(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const op = url.searchParams.get("op") || "done";
  const now = new Date().toISOString();

  if (op === "error") {
    const b = await req.json().catch(() => ({}));
    const cur = await sb(`/cs_pieces?id=eq.${encodeURIComponent(b.id || "")}&select=attempts`);
    const attempts = (Array.isArray(cur.body) && cur.body[0] ? Number(cur.body[0].attempts || 0) : 0) + 1;
    await sb(`/cs_pieces?id=eq.${encodeURIComponent(b.id || "")}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: attempts >= 2 ? "error" : "generating", error: String(b.error || "error").slice(0, 500), attempts, locked_at: null, updated_at: now }) });
    return Response.json({ ok: true });
  }

  const fd = await req.formData();
  const id = String(fd.get("id") || "");
  const png = fd.get("png");
  if (!id || !png || typeof png === "string") return Response.json({ error: "Faltan id o png" }, { status: 400 });
  const image_url = await upload(`piezas/${id}-${Date.now()}.png`, Buffer.from(await png.arrayBuffer()), "image/png");
  const body = {
    status: "review", image_url, error: null, locked_at: null, feedback: null, updated_at: now,
    html: String(fd.get("html") || ""), headline: String(fd.get("headline") || ""), subheadline: String(fd.get("subheadline") || ""),
    caption: String(fd.get("caption") || ""), hashtags: String(fd.get("hashtags") || ""),
  };
  await sb(`/cs_pieces?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(body) });
  return Response.json({ ok: true, image_url });
}
