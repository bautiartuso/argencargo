// GET /api/cron/studio-publisher — el VIGILANTE de Instagram: corre cada minuto y publica por
// Instagram Graph API lo que está programado y cuya hora ya pasó. Auth: Bearer CRON_SECRET.
import { publicarPendientes, analizarPendientesCompetencia, radarCompetencia, loadCompetitors, igDiscoverySettings, sb } from "../../../../lib/studio";
import { tgConfigured, tgSettings, tgDiscoverChat, tgNotify } from "../../../../lib/telegram";
import { actualizarInsights } from "../../../../lib/ig-insights";
export const maxDuration = 60;
export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const ok = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  const pub = await publicarPendientes();
  // De paso, analiza de a 3 los posts de la competencia que faltan (cola en segundo plano).
  let competencia = 0; try { competencia = await analizarPendientesCompetencia(3); } catch (e) { console.error("[studio] competencia", e.message); }
  // Arranque de Análisis: si hay token y la tabla diaria está vacía, se llena ahora (después, dos veces por día).
  try {
    const disc0 = await igDiscoverySettings();
    if (disc0.ig_user_id && disc0.access_token) { const d = await sb(`/cs_ig_daily?select=day&limit=1`); if (Array.isArray(d.body) && !d.body.length) await actualizarInsights(); }
  } catch (e) { console.error("[studio] insights inicial", e.message); }
  // Arranque: si el radar está conectado y nunca corrió, baja la primera tanda sin esperar al domingo.
  try {
    const disc = await igDiscoverySettings();
    if (disc.ig_user_id && disc.access_token) {
      const comps = await loadCompetitors();
      if (comps.length && comps.every((c) => !c.last_checked_at)) await radarCompetencia({ analizar: 0 });
    }
  } catch (e) { console.error("[studio] radar inicial", e.message); }
  // Telegram: conectar solo (cuando llegue el /start) y avisar si la Mac no responde con piezas en cola.
  try {
    if (tgConfigured()) {
      const cfg = await tgSettings();
      if (!cfg.chat_id) { const c = await tgDiscoverChat(); if (c) await tgNotify("✅ <b>Argencargo Studio conectado.</b> Por acá te van a llegar las historias publicadas (para compartirlas como estado de WhatsApp), las piezas listas para aprobar y los avisos del sistema."); }
      else {
        const [hb, cola] = await Promise.all([sb(`/cs_settings?key=eq.runner_heartbeat&select=value`), sb(`/cs_pieces?status=eq.generating&select=id&limit=1`)]);
        const last = Array.isArray(hb.body) && hb.body[0] ? new Date(hb.body[0].value?.last_seen_at || 0).getTime() : 0;
        const enCola = Array.isArray(cola.body) && cola.body.length > 0;
        const horaAR = (new Date().getUTCHours() + 21) % 24;
        const ultimoAviso = new Date(cfg.mac_alert_at || 0).getTime();
        if (enCola && last && Date.now() - last > 20 * 60000 && horaAR >= 9 && horaAR <= 23 && Date.now() - ultimoAviso > 6 * 3600000) {
          await tgNotify(`⚠️ <b>Tu Mac no responde</b> desde hace ${Math.round((Date.now() - last) / 60000)} min y hay piezas en la cola. Fijate que esté prendida y con sesión iniciada.`);
          await sb(`/cs_settings?on_conflict=key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "telegram", value: { ...cfg, mac_alert_at: new Date().toISOString() }, updated_at: new Date().toISOString() }) });
        }
      }
    }
  } catch (e) { console.error("[studio] telegram", e.message); }
  return Response.json({ ok: true, ...pub, competencia_analizados: competencia });
}
