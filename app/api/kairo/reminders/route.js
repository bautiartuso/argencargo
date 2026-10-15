// GET /api/kairo/reminders   (cron de Vercel cada minuto, Bearer CRON_SECRET)
// Avisa por push los suplementos que tocan en este minuto (hora Argentina), salvo que ya estén tildados.

import { sb, arr } from "../../../../lib/kairo-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "No autorizado" }, { status: 401 });

  const ar = new Date(Date.now() - 3 * 3600e3); // Argentina, UTC-3 sin horario de verano
  const hhmm = ar.toISOString().slice(11, 16), date = ar.toISOString().slice(0, 10), dow = (ar.getUTCDay() + 6) % 7;
  const due = arr(await sb(`/rest/v1/kairo_supplements?active=eq.true&times=cs.${encodeURIComponent(`{"${hhmm}"}`)}&days=cs.${encodeURIComponent(`{${dow}}`)}&select=id,user_id,name,dose`));
  if (!due.length) return Response.json({ ok: true, sent: 0 });

  const taken = arr(await sb(`/rest/v1/kairo_supp_log?log_date=eq.${date}&slot=eq.${hhmm}&supplement_id=in.(${due.map(d => d.id).join(",")})&select=supplement_id`));
  const done = new Set(taken.map(t => t.supplement_id));
  const base = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
  let sent = 0;
  for (const s of due.filter(d => !done.has(d.id))) {
    await fetch(`${base}/api/push/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: s.user_id, portal: "kairo", strict: true, urgency: "high", title: `Hora de tu ${s.name}`, body: s.dose ? `${s.name} · ${s.dose}` : "Tocá para tildarlo", url: "/kairo", tag: `kairo-supp-${s.id}` }),
    }).catch(() => {});
    sent++;
  }
  return Response.json({ ok: true, sent });
}
