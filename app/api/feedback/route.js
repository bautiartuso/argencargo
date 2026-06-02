// Endpoints para la página pública /feedback (calificación post-entrega).
// La tabla operations tiene RLS sin política para anon, así que el lookup y el
// insert se hacen acá con service-role para bypassear RLS.
//
// GET  /api/feedback?op=AC-0123          → { ok:true, op_id } | { ok:false }
// POST /api/feedback                     → body { op, rating, comment? } → upsert feedback

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

const sbFetch = (path, init = {}) =>
  fetch(`${SB_URL}${path}`, {
    ...init,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });

export async function GET(req) {
  if (!SB_SERVICE) return Response.json({ ok: false, error: "Server no configurado" }, { status: 500 });
  const opCode = new URL(req.url).searchParams.get("op");
  if (!opCode) return Response.json({ ok: false, error: "Falta op" }, { status: 400 });
  // Normalizamos: la URL puede traer espacios o lowercase
  const code = String(opCode).trim().toUpperCase();
  try {
    const r = await sbFetch(`/rest/v1/operations?operation_code=eq.${encodeURIComponent(code)}&select=id&limit=1`);
    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) return Response.json({ ok: false, error: "No encontramos esa operación" }, { status: 404 });
    return Response.json({ ok: true, op_id: arr[0].id });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!SB_SERVICE) return Response.json({ ok: false, error: "Server no configurado" }, { status: 500 });
  let body; try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const opCode = String(body.op || "").trim().toUpperCase();
  const rating = Number(body.rating);
  const comment = body.comment ? String(body.comment).slice(0, 2000) : null;
  const clickedGoogle = body.clicked_google_review === true;
  if (!opCode) return Response.json({ ok: false, error: "Falta op" }, { status: 400 });
  if (!clickedGoogle && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
    return Response.json({ ok: false, error: "Rating inválido" }, { status: 400 });
  }
  try {
    // Resolver op_id
    const lookup = await sbFetch(`/rest/v1/operations?operation_code=eq.${encodeURIComponent(opCode)}&select=id&limit=1`);
    const arr = await lookup.json();
    if (!Array.isArray(arr) || arr.length === 0) return Response.json({ ok: false, error: "No encontramos esa operación" }, { status: 404 });
    const opId = arr[0].id;
    // ¿Ya existe feedback para esta op?
    const existR = await sbFetch(`/rest/v1/op_feedback?operation_id=eq.${opId}&select=id&limit=1`);
    const existArr = await existR.json();
    const exists = Array.isArray(existArr) && existArr[0]?.id;
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
    return Response.json({ ok: true, op_id: opId });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
