// /api/studio/runner — puerta para el RUNNER LOCAL (la Mac con Claude Code y la suscripción Max).
//
// GET             → toma la pieza más vieja de la cola (lock 15 min) y devuelve pieza + memoria +
//                   assets (logos, posteos de referencia) + últimas piezas aprobadas (estilo vivo).
//                   204 si no hay nada.
// POST ?op=done   (multipart: id, html, headline, subheadline, caption, hashtags, png) → review.
// POST ?op=error  (json: id, error) → suma intento; al 2º queda en 'error'.
// Auth: header x-runner-secret = RUNNER_SECRET.

import { sb, loadMemory, loadAssets, ejemplosAprobados, uploadStorage } from "../../../../lib/studio";

export const maxDuration = 60;
export const runtime = "nodejs";

const okAuth = (req) => !!process.env.RUNNER_SECRET && req.headers.get("x-runner-secret") === process.env.RUNNER_SECRET;

export async function GET(req) {
  if (!okAuth(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const stale = new Date(Date.now() - 15 * 60000).toISOString();
  const r = await sb(`/cs_pieces?status=eq.generating&or=(locked_at.is.null,locked_at.lt.${stale})&select=*&order=created_at.asc&limit=1`);
  const piece = Array.isArray(r.body) && r.body[0];
  if (!piece) return new Response(null, { status: 204 });
  const lock = await sb(`/cs_pieces?id=eq.${piece.id}&status=eq.generating&or=(locked_at.is.null,locked_at.lt.${stale})`, { method: "PATCH", body: JSON.stringify({ locked_at: new Date().toISOString() }) });
  if (!(Array.isArray(lock.body) && lock.body.length)) return new Response(null, { status: 204 });
  const [memory, assets, aprobados] = await Promise.all([loadMemory(), loadAssets(), ejemplosAprobados(6)]);
  return Response.json({
    piece,
    memory: Object.fromEntries(memory.map((m) => [m.key, m.content])),
    assets,
    aprobados: aprobados.filter((p) => p.id !== piece.id).map((p) => ({ id: p.id, kind: p.kind, title: p.title, headline: p.headline, html: p.html, image_url: p.image_url })),
  });
}

export async function POST(req) {
  if (!okAuth(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const op = new URL(req.url).searchParams.get("op") || "done";
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
  const image_url = await uploadStorage(`piezas/${id}-${Date.now()}.png`, Buffer.from(await png.arrayBuffer()), "image/png");
  await sb(`/cs_pieces?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
    status: "review", image_url, error: null, locked_at: null, feedback: null, updated_at: now,
    html: String(fd.get("html") || ""), headline: String(fd.get("headline") || ""), subheadline: String(fd.get("subheadline") || ""),
    caption: String(fd.get("caption") || ""), hashtags: String(fd.get("hashtags") || ""),
  }) });
  return Response.json({ ok: true, image_url });
}
