// /api/studio/runner — puerta para el RUNNER LOCAL (la Mac con Claude Code y la suscripción Max).
//
// GET             → toma la pieza más vieja de la cola (lock 15 min) y devuelve pieza + memoria +
//                   assets (logos, posteos de referencia) + últimas piezas aprobadas (estilo vivo).
//                   204 si no hay nada.
// POST ?op=done   (multipart: id, headline, subheadline, caption, hashtags, y por imagen png_1..png_N + html_1..html_N;
//                  compat: png + html para una sola imagen) → review. images = [{url, html}], image_url = portada.
// POST ?op=error  (json: id, error) → suma intento; al 2º queda en 'error'.
// POST ?op=photo  (json: id, nota?) → genera la foto real con fal.ai (si la pieza la pide) → {photo_url}.
// Auth: header x-runner-secret = RUNNER_SECRET.

import { sb, loadMemory, loadAssets, ejemplosAprobados, uploadStorage, borrarImagenesPieza, generarFoto } from "../../../../lib/studio";

export const maxDuration = 120;
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
  if (op === "photo") {
    const b = await req.json().catch(() => ({}));
    const cur = await sb(`/cs_pieces?id=eq.${encodeURIComponent(b.id || "")}&select=id,kind,photo_prompt,photo_brand,photo_url,photo_note&limit=1`);
    const piece = Array.isArray(cur.body) && cur.body[0];
    if (!piece) return Response.json({ error: "pieza inexistente" }, { status: 404 });
    if (!piece.photo_prompt) return Response.json({ error: "la pieza no pide foto" }, { status: 400 });
    try { const photo_url = await generarFoto(piece, { nota: String(b.nota || piece.photo_note || "") }); return Response.json({ ok: true, photo_url }); }
    catch (e) { return Response.json({ error: String(e.message).slice(0, 300) }, { status: 500 }); }
  }
  if (op === "error") {
    const b = await req.json().catch(() => ({}));
    const cur = await sb(`/cs_pieces?id=eq.${encodeURIComponent(b.id || "")}&select=attempts`);
    const attempts = (Array.isArray(cur.body) && cur.body[0] ? Number(cur.body[0].attempts || 0) : 0) + 1;
    await sb(`/cs_pieces?id=eq.${encodeURIComponent(b.id || "")}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: attempts >= 2 ? "error" : "generating", error: String(b.error || "error").slice(0, 500), attempts, locked_at: null, updated_at: now }) });
    return Response.json({ ok: true });
  }
  const fd = await req.formData();
  const id = String(fd.get("id") || "");
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });
  // Imágenes en orden: png_1..png_N (o png para una sola).
  const files = [];
  for (let i = 1; i <= 10; i++) { const f = fd.get(`png_${i}`); if (f && typeof f !== "string") files.push({ f, html: String(fd.get(`html_${i}`) || "") }); else break; }
  if (!files.length) { const f = fd.get("png"); if (f && typeof f !== "string") files.push({ f, html: String(fd.get("html") || "") }); }
  if (!files.length) return Response.json({ error: "Faltan imágenes" }, { status: 400 });
  // Si la pieza se está rehaciendo (pedido de cambio), las imágenes viejas se borran para no acumular.
  const prev = await sb(`/cs_pieces?id=eq.${encodeURIComponent(id)}&select=id,image_url,images`);
  if (Array.isArray(prev.body) && prev.body[0]) await borrarImagenesPieza(prev.body[0], { limpiarFila: false, incluirFoto: false });
  const stamp = Date.now();
  const images = [];
  for (let i = 0; i < files.length; i++) {
    const url = await uploadStorage(`piezas/${id}-${stamp}${files.length > 1 ? `-${i + 1}` : ""}.png`, Buffer.from(await files[i].f.arrayBuffer()), "image/png");
    images.push({ url, html: files[i].html });
  }
  await sb(`/cs_pieces?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
    status: "review", image_url: images[0].url, images, slides: images.length, error: null, locked_at: null, feedback: null, updated_at: now,
    html: images[0].html, headline: String(fd.get("headline") || ""), subheadline: String(fd.get("subheadline") || ""),
    caption: String(fd.get("caption") || ""), hashtags: String(fd.get("hashtags") || ""),
  }) });
  return Response.json({ ok: true, image_url: images[0].url, images: images.length });
}
