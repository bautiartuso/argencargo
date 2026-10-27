// Endpoints para la página pública /feedback (calificación post-entrega).
// La tabla operations tiene RLS sin política para anon, así que el lookup y el
// insert se hacen acá con service-role para bypassear RLS.
//
// GET  /api/feedback?op=AC-0123          → { ok:true, op_id } | { ok:false }
// POST /api/feedback                     → body { op, rating, comment? } → upsert feedback

import { firmaLink } from "../../../lib/auth-server";
import { limitar } from "../../../lib/ratelimit";
// 28/10/2026: los links nuevos traen &s=<firma>. Sin firma (links viejos) solo se puede calificar
// una vez y no se muestra el nombre del cliente (los códigos AC-xxxx se pueden adivinar).
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

const sbFetch = (path, init = {}) =>
  fetch(`${SB_URL}${path}`, {
    ...init,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });

export async function GET(req) {
  if (!SB_SERVICE) return Response.json({ ok: false, error: "Server no configurado" }, { status: 500 });
  const frenado = limitar(req, { clave: "feedback-get", limite: 30 }); if (frenado) return frenado;
  const sp = new URL(req.url).searchParams;
  const opCode = sp.get("op");
  if (!opCode) return Response.json({ ok: false, error: "Falta op" }, { status: 400 });
  const firmado = sp.get("s") === firmaLink(String(opCode).trim());
  // Normalizamos: la URL puede traer espacios o lowercase
  const code = String(opCode).trim().toUpperCase();
  try {
    const r = await sbFetch(`/rest/v1/operations?operation_code=eq.${encodeURIComponent(code)}&select=id,clients(first_name)&limit=1`);
    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) return Response.json({ ok: false, error: "No encontramos esa operación" }, { status: 404 });
    const op = arr[0];
    const firstName = firmado && op.clients?.first_name ? String(op.clients.first_name).trim().split(/\s+/)[0] : null;
    return Response.json({ ok: true, op_id: op.id, first_name: firstName });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!SB_SERVICE) return Response.json({ ok: false, error: "Server no configurado" }, { status: 500 });
  const frenado = limitar(req, { clave: "feedback-post", limite: 10 }); if (frenado) return frenado;
  let body; try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const opCode = String(body.op || "").trim().toUpperCase();
  const firmado = String(body.s || "") === firmaLink(opCode);
  const rating = Number(body.rating);
  const comment = body.comment ? String(body.comment).slice(0, 2000) : null;
  const clickedGoogle = body.clicked_google_review === true;
  if (!opCode) return Response.json({ ok: false, error: "Falta op" }, { status: 400 });
  if (!clickedGoogle && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
    return Response.json({ ok: false, error: "Rating inválido" }, { status: 400 });
  }
  try {
    // Resolver op_id (+ nombre cliente para devolverlo al frontend)
    const lookup = await sbFetch(`/rest/v1/operations?operation_code=eq.${encodeURIComponent(opCode)}&select=id,clients(first_name)&limit=1`);
    const arr = await lookup.json();
    if (!Array.isArray(arr) || arr.length === 0) return Response.json({ ok: false, error: "No encontramos esa operación" }, { status: 404 });
    const opId = arr[0].id;
    const firstName = firmado && arr[0].clients?.first_name ? String(arr[0].clients.first_name).trim().split(/\s+/)[0] : null;
    // ¿Ya existe feedback para esta op?
    const existR = await sbFetch(`/rest/v1/op_feedback?operation_id=eq.${opId}&select=id,submitted_at&limit=1`);
    const existArr = await existR.json();
    const exists = Array.isArray(existArr) && existArr[0]?.id;
    // Sin firma, solo se completa en la misma visita (hasta 2 h después de la primera calificación).
    const reciente = exists && existArr[0].submitted_at && Date.now() - new Date(existArr[0].submitted_at).getTime() < 2 * 3600e3;
    if (exists && !firmado && !clickedGoogle && !reciente) return Response.json({ ok: false, error: "Esta operación ya fue calificada" }, { status: 409 });
    if (exists) {
      // PATCH: actualizar campos provistos
      const patch = {};
      if (Number.isFinite(rating) && rating >= 1 && rating <= 5) patch.rating = rating;
      if (comment !== null) patch.comment = comment;
      if (clickedGoogle) patch.clicked_google_review = true;
      if (Object.keys(patch).length > 0) {
        await sbFetch(`/rest/v1/op_feedback?id=eq.${exists}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
      }
    } else {
      const ins = { operation_id: opId };
      if (Number.isFinite(rating) && rating >= 1 && rating <= 5) ins.rating = rating;
      if (comment !== null) ins.comment = comment;
      if (clickedGoogle) ins.clicked_google_review = true;
      await sbFetch(`/rest/v1/op_feedback`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(ins) });
    }
    return Response.json({ ok: true, op_id: opId, first_name: firstName });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
