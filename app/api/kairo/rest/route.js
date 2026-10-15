// POST /api/kairo/rest   (sesión de admin)
//   { seconds, title, body } → programa el aviso de fin de descanso y devuelve { id }.
//                              La función queda viva (waitUntil) hasta la hora y manda el push
//                              al celular, salvo que se haya cancelado.
//   { cancel: id }           → cancela un aviso (saltaste el descanso, le sumaste tiempo o la app
//                              estaba abierta y ya sonó adentro).
// Los descansos de más de ~4 min no se avisan por push (límite de la función).

import { waitUntil } from "@vercel/functions";
import { SB_URL, SB_KEY } from "../../../../lib/sb-client";

const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const MAX_WAIT = 280;
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const sb = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}${path}`, {
    ...init,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return null; }
};

async function adminId(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!token) return null;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null);
  if (!u?.id) return null;
  const p = await sb(`/rest/v1/profiles?id=eq.${u.id}&select=role`);
  return Array.isArray(p) && p[0]?.role === "admin" ? u.id : null;
}

async function fireWhenDue(id, fireAt) {
  await new Promise(r => setTimeout(r, Math.max(0, fireAt - Date.now())));
  const [t] = (await sb(`/rest/v1/kairo_rest_timers?id=eq.${id}&select=*`)) || [];
  if (!t || t.cancelled || t.sent) return;
  await sb(`/rest/v1/kairo_rest_timers?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ sent: true }) });
  const base = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
  await fetch(`${base}/api/push/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: t.user_id, portal: "kairo", strict: true, urgency: "high", title: t.title || "Descanso terminado", body: t.body || "A la próxima serie", url: "/kairo", tag: "kairo-rest" }),
  }).catch(e => console.error("[kairo rest] push", e));
}

export async function POST(req) {
  const uid = await adminId(req);
  if (!uid) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.cancel) {
    await sb(`/rest/v1/kairo_rest_timers?id=eq.${body.cancel}`, { method: "PATCH", body: JSON.stringify({ cancelled: true }) });
    return Response.json({ ok: true });
  }

  const seconds = Number(body.seconds) || 0;
  if (seconds <= 0 || seconds > MAX_WAIT) return Response.json({ ok: true, skipped: "fuera de rango" });
  const fireAt = Date.now() + seconds * 1000;
  const r = await sb(`/rest/v1/kairo_rest_timers`, {
    method: "POST",
    body: JSON.stringify({ user_id: uid, fire_at: new Date(fireAt).toISOString(), title: body.title || null, body: body.body || null }),
    headers: { Prefer: "return=representation" },
  });
  const id = Array.isArray(r) ? r[0]?.id : null;
  if (!id) return Response.json({ error: "No se pudo programar" }, { status: 500 });
  waitUntil(fireWhenDue(id, fireAt));
  return Response.json({ id });
}
