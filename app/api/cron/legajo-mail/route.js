// GET /api/cron/legajo-mail — cada 15 min (29/10/2026). Ops del aéreo courier que se cerraron y todavía
// no tienen el mail de los papeles: si el cliente ve el legajo completo, se lo manda (lib/legajo-mail);
// si no corresponde, la marca "omitido" para no volver a mirarla. Solo ops cerradas desde el 29/10/2026.
import { esCronValido } from "../../../../lib/auth-server";
import { enviarMailLegajo, marcarMailLegajo } from "../../../../lib/legajo-mail";
import { tgNotify } from "../../../../lib/telegram";

export const maxDuration = 120;
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const DESDE = "2026-10-29T03:00:00Z";

export async function GET(req) {
  if (!esCronValido(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.SUPABASE_SERVICE_ROLE;
  const r = await fetch(`${SB_URL}/rest/v1/operations?status=eq.operacion_cerrada&channel=eq.aereo_blanco&closed_at=gte.${DESDE}&sent_notifications->>email_legajo=is.null&select=id,operation_code&order=closed_at.asc&limit=4`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  const ops = await r.json().catch(() => []);
  const out = [];
  for (const op of Array.isArray(ops) ? ops : []) {
    const res = await enviarMailLegajo(op.id);
    if (res.ok) {
      await marcarMailLegajo(op.id, new Date().toISOString());
      await tgNotify(`📧 <b>${op.operation_code}</b>: le mandamos los papeles por mail a ${res.para} (${res.papeles.length} adjunto${res.papeles.length !== 1 ? "s" : ""}).`).catch(() => {});
    } else if (res.omitir) await marcarMailLegajo(op.id, "omitido");
    else { await tgNotify(`⚠️ <b>${op.operation_code}</b>: no salió el mail con los papeles (${res.error}).`).catch(() => {}); out.push({ op: op.operation_code, ...res }); break; }
    out.push({ op: op.operation_code, ...(res.ok ? { ok: true } : res) });
  }
  return Response.json({ ok: true, ops: out });
}
