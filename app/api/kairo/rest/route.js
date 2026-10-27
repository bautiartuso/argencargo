// POST /api/kairo/rest   (usuario de Kairo)
//   { seconds, title, body } → programa el aviso de fin de descanso y devuelve { id }.
//                              La función queda viva (waitUntil) hasta la hora y manda el push
//                              al celular, salvo que se haya cancelado.
//   { cancel: id }           → cancela un aviso (saltaste el descanso, le sumaste tiempo o la app
//                              estaba abierta y ya sonó adentro).
// Los descansos de más de ~4 min no se avisan por push (límite de la función).

import { waitUntil } from "@vercel/functions";
import { sb, kairoUser } from "../../../../lib/kairo-server";

const MAX_WAIT = 280;
export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function fireWhenDue(id, fireAt) {
  await new Promise(r => setTimeout(r, Math.max(0, fireAt - Date.now())));
  const [t] = (await sb(`/rest/v1/kairo_rest_timers?id=eq.${id}&select=*`)) || [];
  if (!t || t.cancelled || t.sent) return;
  await sb(`/rest/v1/kairo_rest_timers?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ sent: true }) });
  const base = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
  await fetch(`${base}/api/push/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET}` },
    body: JSON.stringify({ user_id: t.user_id, portal: "kairo", strict: true, urgency: "high", title: t.title || "Descanso terminado", body: t.body || "A la próxima serie", url: "/kairo", tag: "kairo-rest" }),
  }).catch(e => console.error("[kairo rest] push", e));
}

export async function POST(req) {
  const me = await kairoUser(req);
  if (!me) return Response.json({ error: "No autorizado" }, { status: 401 });
  const uid = me.id;
  const body = await req.json().catch(() => ({}));

  if (body.cancel) {
    await sb(`/rest/v1/kairo_rest_timers?id=eq.${body.cancel}&user_id=eq.${uid}`, { method: "PATCH", body: JSON.stringify({ cancelled: true }) });
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
