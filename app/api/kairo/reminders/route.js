// GET /api/kairo/reminders   (cron de Vercel cada minuto, Bearer CRON_SECRET)
// Avisa por push los suplementos que tocan en este minuto (hora Argentina) y, si no se tildaron,
// insiste a los 30 min, a la hora y a las 2 horas (los suplementos se toman aunque la comida se corra).

import { sb, arr } from "../../../../lib/kairo-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const INSIST = [0, 30, 60, 120]; // minutos después del horario
const n1 = (v) => Number(v).toLocaleString("es-AR", { maximumFractionDigits: 2 });

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "No autorizado" }, { status: 401 });

  const ar = new Date(Date.now() - 3 * 3600e3); // Argentina, UTC-3 sin horario de verano
  const date = ar.toISOString().slice(0, 10), dow = (ar.getUTCDay() + 6) % 7;
  // Horarios que tocan ahora (o hace 30/60/120 min), solo los de hoy.
  const slots = INSIST.map(m => ({ m, d: new Date(ar.getTime() - m * 60e3) })).filter(x => x.d.toISOString().slice(0, 10) === date).map(x => ({ m: x.m, hhmm: x.d.toISOString().slice(11, 16) }));
  const due = arr(await sb(`/rest/v1/kairo_supplements?active=eq.true&times=ov.${encodeURIComponent(`{${slots.map(s => `"${s.hhmm}"`).join(",")}}`)}&days=cs.${encodeURIComponent(`{${dow}}`)}&select=id,user_id,name,dose,amount,unit,times`));
  if (!due.length) return Response.json({ ok: true, sent: 0 });

  const taken = arr(await sb(`/rest/v1/kairo_supp_log?log_date=eq.${date}&supplement_id=in.(${due.map(d => d.id).join(",")})&select=supplement_id,slot`));
  const done = new Set(taken.map(t => t.supplement_id + "|" + t.slot));
  const base = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
  let sent = 0;
  for (const s of due) {
    for (const { m, hhmm } of slots) {
      if (!s.times?.includes(hhmm) || done.has(s.id + "|" + hhmm)) continue;
      const dose = s.dose || (s.amount ? `${n1(s.amount)} ${s.unit || ""}`.trim() : "");
      const title = m === 0 ? `Hora de tu ${s.name}` : `Todavía no tomaste tu ${s.name}`;
      const body = m === 0 ? (dose ? `${dose} · tocá para tildarlo` : "Tocá para tildarlo") : `Era a las ${hhmm}${dose ? ` · ${dose}` : ""}. Tomalo y tildalo en Kairo.`;
      await fetch(`${base}/api/push/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: s.user_id, portal: "kairo", strict: true, urgency: "high", title, body, url: "/kairo", tag: `kairo-supp-${s.id}-${hhmm}` }),
      }).catch(() => {});
      sent++;
    }
  }
  return Response.json({ ok: true, sent });
}
