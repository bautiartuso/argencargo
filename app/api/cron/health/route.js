// GET /api/cron/health — cada 30 min: revisa que nada esté fallando en silencio y avisa por Telegram.
//   · piezas del estudio con error o con error de publicación (últimos 30 min)
//   · sincronización de tracking sin corrida exitosa hace más de 3 h
//   · mensajes de WhatsApp del bot que Meta rechazó (últimos 30 min)
//   · presupuesto mensual de Claude API y fal.ai (avisa al 80 % y al 100 %)
//   · token de LinkedIn por vencer (7 días antes) o vencido
// Auth: Bearer CRON_SECRET.
import { sb } from "../../../../lib/studio";
import { tgConfigured, tgSettings, tgAlert } from "../../../../lib/telegram";
import { liStatus } from "../../../../lib/linkedin";
export const maxDuration = 60;

const usd = (v) => `USD ${Number(v || 0).toFixed(2)}`;

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const ok = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!tgConfigured()) return Response.json({ skipped: "telegram sin configurar" });
  const out = [];
  const hace30 = new Date(Date.now() - 30 * 60000).toISOString();
  try {
    // 1) Piezas con error en la Mac
    const err = await sb(`/cs_pieces?status=eq.error&updated_at=gte.${hace30}&select=title,error`);
    const errs = Array.isArray(err.body) ? err.body : [];
    if (errs.length) out.push(await tgAlert("piezas_error", `⚠️ <b>${errs.length} pieza${errs.length > 1 ? "s" : ""} fallaron en tu Mac</b>\n${errs.map((p) => `· ${p.title}: ${String(p.error || "").slice(0, 80)}`).join("\n")}\n\nEn Contenido tienen el botón Reintentar.`, { cooldownHours: 3 }));
    // 2) Errores de publicación en Instagram
    const pe = await sb(`/cs_pieces?publish_error=not.is.null&updated_at=gte.${hace30}&select=title,publish_error`);
    const pes = Array.isArray(pe.body) ? pe.body : [];
    if (pes.length) out.push(await tgAlert("publish_error", `⚠️ <b>Instagram/LinkedIn rechazó ${pes.length} publicación${pes.length > 1 ? "es" : ""}</b>\n${pes.map((p) => `· ${p.title}: ${String(p.publish_error || "").slice(0, 100)}`).join("\n")}`, { cooldownHours: 3 }));
    // 3) Tracking sin corrida exitosa
    const ts = await sb(`/cs_settings?key=eq.tracking_sync_last_ok&select=value`);
    const lastOk = Array.isArray(ts.body) && ts.body[0] ? new Date(ts.body[0].value?.at || 0).getTime() : 0;
    if (lastOk && Date.now() - lastOk > 3 * 3600000) out.push(await tgAlert("tracking_sync", `⚠️ <b>La sincronización de tracking (DHL/FedEx) no termina bien desde hace ${Math.round((Date.now() - lastOk) / 3600000)} h.</b> Los vuelos pueden estar desactualizados.`, { cooldownHours: 6 }));
    // 4) WhatsApp rechazado
    const wf = await sb(`/bot_messages?failed_at=gte.${hace30}&select=id,error`);
    const wfs = Array.isArray(wf.body) ? wf.body : [];
    if (wfs.length) out.push(await tgAlert("wa_failed", `⚠️ <b>Meta rechazó ${wfs.length} mensaje${wfs.length > 1 ? "s" : ""} de WhatsApp del bot</b> en la última media hora: ${String(wfs[0].error || "").slice(0, 120)}`, { cooldownHours: 3 }));
    // 5) Presupuestos del mes
    const cfg = await tgSettings();
    const b = { claude: Number(cfg?.budgets?.claude || 40), fal: Number(cfg?.budgets?.fal || 40) };
    const inicio = new Date(); inicio.setUTCDate(1); inicio.setUTCHours(3, 0, 0, 0);
    const [cu, fu] = await Promise.all([
      sb(`/api_usage?provider=eq.claude&ts=gte.${inicio.toISOString()}&select=cost_usd`),
      sb(`/cs_pieces?created_at=gte.${inicio.toISOString()}&select=photo_cost_usd`),
    ]);
    const gasto = { claude: (Array.isArray(cu.body) ? cu.body : []).reduce((a, r) => a + Number(r.cost_usd || 0), 0), fal: (Array.isArray(fu.body) ? fu.body : []).reduce((a, r) => a + Number(r.photo_cost_usd || 0), 0) };
    for (const k of ["claude", "fal"]) {
      const nombre = k === "claude" ? "Claude API" : "fal.ai (fotos)";
      if (gasto[k] >= b[k]) out.push(await tgAlert(`budget_${k}_100`, `🚨 <b>${nombre}: el gasto del mes (${usd(gasto[k])}) superó tu tope de ${usd(b[k])}.</b> ${k === "fal" ? "Cargá crédito en fal.ai o subí el tope en Conexión." : "Revisá el crédito en console.anthropic.com o subí el tope en Conexión."}`, { cooldownHours: 24 * 7 }));
      else if (gasto[k] >= b[k] * 0.8) out.push(await tgAlert(`budget_${k}_80`, `🔔 <b>${nombre}: vas por ${usd(gasto[k])} de los ${usd(b[k])} del mes (80 %).</b> Es momento de revisar el crédito.`, { cooldownHours: 24 * 7 }));
    }
    // 6) LinkedIn: el token dura 60 días y no se renueva solo.
    const li = await liStatus().catch(() => null);
    if (li?.connected) {
      if (li.vencido) out.push(await tgAlert("linkedin_vencido", `🔗 <b>El token de LinkedIn venció.</b> Los posts programados no salen hasta que toques Reconectar en Content Studio → Conexión.`, { cooldownHours: 72 }));
      else if (li.dias_restantes != null && li.dias_restantes <= 7) out.push(await tgAlert("linkedin_vence", `🔗 <b>El token de LinkedIn vence en ${li.dias_restantes} día${li.dias_restantes === 1 ? "" : "s"}.</b> Entrá a Content Studio → Conexión y tocá Reconectar (30 segundos).`, { cooldownHours: 48 }));
    }
    return Response.json({ ok: true, alertas: out.filter(Boolean).length, gasto });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
