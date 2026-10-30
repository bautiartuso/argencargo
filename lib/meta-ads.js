// lib/meta-ads.js — lectura de la cuenta publicitaria de Meta para el tablero de Campañas del CRM
// (30/10/2026). Solo lee: gasto, impresiones, clics y conversaciones iniciadas por anuncio y por día,
// y el nombre de campaña/conjunto/anuncio de un anuncio (para ponerle nombre a los leads que llegan
// con el referral del webhook, que trae solo el id del anuncio).
//
// Env (las carga Bautista en Vercel, al final): META_ADS_TOKEN (token con ads_read de un usuario del
// sistema del negocio) · META_AD_ACCOUNT_ID (id de la cuenta publicitaria, con o sin el "act_").
const GRAPH = "https://graph.facebook.com/v26.0";
export const adsConfigured = () => !!(process.env.META_ADS_TOKEN && process.env.META_AD_ACCOUNT_ID);
const cuenta = () => { const id = String(process.env.META_AD_ACCOUNT_ID || "").trim(); return id.startsWith("act_") ? id : `act_${id}`; };

async function graph(url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.META_ADS_TOKEN}` }, cache: "no-store" });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error?.message ? `${d.error.message} (código ${d.error.code})` : `HTTP ${r.status}`);
  return d;
}

// Conversaciones de WhatsApp iniciadas desde el anuncio, según Meta (acción "messaging_conversation_started_7d").
const conversacionesDe = (row) => {
  const acc = (row.actions || []).find((a) => /messaging_conversation_started/.test(a.action_type));
  return acc ? Number(acc.value || 0) : 0;
};

// Filas por anuncio y día entre dos fechas (YYYY-MM-DD). Sigue la paginación de Meta.
export async function insightsPorAnuncio(since, until) {
  if (!adsConfigured()) return [];
  const fields = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,actions,account_currency";
  let url = `${GRAPH}/${cuenta()}/insights?level=ad&time_increment=1&fields=${fields}&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&limit=500`;
  const out = [];
  while (url) {
    const d = await graph(url);
    for (const r of d.data || []) out.push({ date: r.date_start, ad_id: r.ad_id, ad_name: r.ad_name || null, adset_id: r.adset_id || null, adset_name: r.adset_name || null, campaign_id: r.campaign_id || null, campaign_name: r.campaign_name || null, spend: Number(r.spend || 0), impressions: Number(r.impressions || 0), clicks: Number(r.clicks || 0), conversaciones: conversacionesDe(r), currency: r.account_currency || null });
    url = d.paging?.next || null;
  }
  return out;
}

// Nombres de un anuncio (para los leads que llegan por el webhook con solo el id).
export async function datosAnuncio(adId) {
  if (!adsConfigured() || !adId) return null;
  const d = await graph(`${GRAPH}/${adId}?fields=name,adset{id,name},campaign{id,name}`);
  return { ad_name: d.name || null, adset_id: d.adset?.id || null, adset_name: d.adset?.name || null, campaign_id: d.campaign?.id || null, campaign_name: d.campaign?.name || null };
}

// Prueba de conexión para la pantalla Conexiones: nombre y moneda de la cuenta.
export async function probarCuenta() {
  if (!adsConfigured()) return { ok: false, error: "Faltan META_ADS_TOKEN o META_AD_ACCOUNT_ID" };
  try { const d = await graph(`${GRAPH}/${cuenta()}?fields=name,currency,account_status`); return { ok: true, nombre: d.name, moneda: d.currency, estado: d.account_status }; }
  catch (e) { return { ok: false, error: e.message }; }
}
