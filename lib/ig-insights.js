// lib/ig-insights.js — Análisis de la cuenta de Instagram (Insights API vía token de página de Facebook,
// el mismo del radar de competencia: cs_settings 'instagram_discovery' con instagram_manage_insights).
//   · cs_ig_daily: una fila por día (seguidores, nuevos seguidores, alcance, visitas al perfil, interacciones…)
//   · cs_ig_media: cada publicación e historia con sus métricas (alcance, visualizaciones, guardados, compartidos…)
// Lo llena el cron ig-insights (dos veces por día) y el botón "Actualizar ahora" de la solapa Análisis.
import { sb, igDiscoverySettings } from "./studio";

const G = "https://graph.facebook.com/v21.0";
async function get(path, params, token) {
  const q = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(`${G}/${path}?${q}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Graph HTTP ${r.status}`);
  return j;
}
const diaAR = (d = new Date()) => new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10);

async function cfgOk() {
  const cfg = await igDiscoverySettings();
  if (!cfg.ig_user_id || !cfg.access_token) throw new Error("Instagram Insights sin conectar (token de Facebook en Conexión)");
  return cfg;
}

// Cuenta: totales de hoy + series diarias de alcance y seguidores nuevos (últimos 30 días, para rellenar).
export async function snapshotCuenta() {
  const cfg = await cfgOk();
  const id = cfg.ig_user_id, t = cfg.access_token;
  const since = Math.floor((Date.now() - 29 * 86400000) / 1000);
  const [acc, series] = await Promise.all([
    get(id, { fields: "followers_count,follows_count,media_count" }, t),
    get(`${id}/insights`, { metric: "reach,follower_count", period: "day", since }, t),
  ]);
  const rows = {};
  for (const m of series.data || []) for (const v of m.values || []) {
    // end_time es el cierre del día (07:00 UTC); el dato corresponde al día anterior.
    const day = new Date(new Date(v.end_time).getTime() - 12 * 3600000).toISOString().slice(0, 10);
    rows[day] = rows[day] || { day };
    if (m.name === "reach") rows[day].reach = v.value; else if (m.name === "follower_count") rows[day].new_followers = v.value;
  }
  // Totales de ayer (visitas al perfil, cuentas que interactuaron, interacciones, clics, visualizaciones).
  const ayer = new Date(Date.now() - 86400000);
  const s0 = Math.floor(new Date(ayer.toISOString().slice(0, 10) + "T00:00:00Z").getTime() / 1000) + 3 * 3600;
  try {
    const tot = await get(`${id}/insights`, { metric: "profile_views,accounts_engaged,total_interactions,website_clicks,views", period: "day", metric_type: "total_value", since: s0, until: s0 + 86400 }, t);
    const day = diaAR(ayer);
    rows[day] = rows[day] || { day };
    for (const m of tot.data || []) rows[day][m.name] = m.total_value?.value ?? null;
  } catch (e) { console.error("[ig] totales", e.message); }
  const hoy = diaAR();
  rows[hoy] = { ...(rows[hoy] || { day: hoy }), followers: acc.followers_count, follows: acc.follows_count, media_count: acc.media_count };
  const list = Object.values(rows).map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  if (list.length) await sb(`/cs_ig_daily?on_conflict=day`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(list) });
  return { dias: list.length, followers: acc.followers_count };
}

const METRICAS = "reach,views,saved,shares,likes,comments,total_interactions";
async function insightsDe(mediaId, t, metrics = METRICAS) {
  try { const r = await get(`${mediaId}/insights`, { metric: metrics }, t); return Object.fromEntries((r.data || []).map((m) => [m.name, m.values?.[0]?.value ?? m.total_value?.value ?? null])); }
  catch (e) {
    if (metrics !== "reach,saved,likes,comments") return insightsDe(mediaId, t, "reach,saved,likes,comments");
    return {};
  }
}

// Publicaciones del feed (las últimas N) con sus métricas.
export async function refrescarMedia(n = 60) {
  const cfg = await cfgOk();
  const id = cfg.ig_user_id, t = cfg.access_token;
  const lst = await get(`${id}/media`, { fields: "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count", limit: n }, t);
  const piezas = await sb(`/cs_pieces?ig_media_id=not.is.null&select=id,ig_media_id`);
  const mapa = {}; for (const p of Array.isArray(piezas.body) ? piezas.body : []) for (const mid of String(p.ig_media_id).split(",")) mapa[mid.trim()] = p.id;
  const rows = [];
  for (const m of lst.data || []) {
    const ins = await insightsDe(m.id, t);
    rows.push({ ig_media_id: m.id, product_type: m.media_product_type || "FEED", media_type: m.media_type, caption: String(m.caption || "").slice(0, 400), permalink: m.permalink || null, thumbnail_url: m.thumbnail_url || null, media_url: m.media_url || null, posted_at: m.timestamp,
      like_count: m.like_count ?? ins.likes ?? null, comments_count: m.comments_count ?? ins.comments ?? null, reach: ins.reach ?? null, views: ins.views ?? null, saved: ins.saved ?? null, shares: ins.shares ?? null, total_interactions: ins.total_interactions ?? null, piece_id: mapa[m.id] || null, updated_at: new Date().toISOString() });
  }
  if (rows.length) await sb(`/cs_ig_media?on_conflict=ig_media_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
  return rows.length;
}

// Historias activas (Meta solo da métricas mientras están publicadas, 24 h): se capturan y quedan guardadas.
export async function refrescarHistorias() {
  const cfg = await cfgOk();
  const id = cfg.ig_user_id, t = cfg.access_token;
  const lst = await get(`${id}/stories`, { fields: "id,caption,media_type,timestamp,permalink,thumbnail_url,media_url" }, t);
  const piezas = await sb(`/cs_pieces?ig_media_id=not.is.null&kind=eq.story&select=id,ig_media_id`);
  const mapa = {}; for (const p of Array.isArray(piezas.body) ? piezas.body : []) for (const mid of String(p.ig_media_id).split(",")) mapa[mid.trim()] = p.id;
  const rows = [];
  for (const m of lst.data || []) {
    const ins = await insightsDe(m.id, t, "reach,views,replies,shares,total_interactions");
    rows.push({ ig_media_id: m.id, product_type: "STORY", media_type: m.media_type, caption: String(m.caption || "").slice(0, 400), permalink: m.permalink || null, thumbnail_url: m.thumbnail_url || null, media_url: m.media_url || null, posted_at: m.timestamp,
      reach: ins.reach ?? null, views: ins.views ?? null, replies: ins.replies ?? null, shares: ins.shares ?? null, total_interactions: ins.total_interactions ?? null, piece_id: mapa[m.id] || null, updated_at: new Date().toISOString() });
  }
  if (rows.length) await sb(`/cs_ig_media?on_conflict=ig_media_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
  return rows.length;
}

export async function actualizarInsights() {
  const out = {};
  try { out.cuenta = await snapshotCuenta(); } catch (e) { out.cuenta_error = e.message; }
  try { out.media = await refrescarMedia(60); } catch (e) { out.media_error = e.message; }
  try { out.historias = await refrescarHistorias(); } catch (e) { out.historias_error = e.message; }
  return out;
}

// Resumen para la solapa Análisis y para el analista.
export async function analisis() {
  const desde90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const desde60 = new Date(Date.now() - 60 * 86400000).toISOString();
  const [d, m] = await Promise.all([
    sb(`/cs_ig_daily?day=gte.${desde90}&select=*&order=day.asc`),
    sb(`/cs_ig_media?posted_at=gte.${desde60}&select=*&order=posted_at.desc`),
  ]);
  const daily = Array.isArray(d.body) ? d.body : [];
  const media = Array.isArray(m.body) ? m.body : [];
  const conF = daily.filter((r) => r.followers != null);
  const ultimo = conF[conF.length - 1] || null;
  const sum = (arr, k) => arr.reduce((a, r) => a + Number(r[k] || 0), 0);
  const dias = (n) => daily.filter((r) => new Date(r.day).getTime() >= Date.now() - n * 86400000);
  const feed = media.filter((x) => x.product_type !== "STORY");
  const stories = media.filter((x) => x.product_type === "STORY");
  const score = (x) => Number(x.views ?? x.reach ?? 0);
  const orden = [...feed].filter((x) => score(x) > 0).sort((a, b) => score(b) - score(a));
  const prom = (arr, k) => (arr.length ? Math.round(arr.reduce((a, r) => a + Number(r[k] || 0), 0) / arr.length) : 0);
  const porTipo = {};
  for (const x of feed) { const k = x.product_type === "REELS" ? "reel" : x.media_type === "CAROUSEL_ALBUM" ? "carrusel" : "posteo"; (porTipo[k] = porTipo[k] || []).push(x); }
  return {
    seguidores: ultimo?.followers ?? null, seguidores_dia: ultimo?.day || null,
    nuevos_7d: sum(dias(7), "new_followers"), nuevos_30d: sum(dias(30), "new_followers"),
    alcance_7d: sum(dias(7), "reach"), alcance_30d: sum(dias(30), "reach"),
    visitas_perfil_30d: sum(dias(30), "profile_views"), interacciones_30d: sum(dias(30), "total_interactions"), clics_web_30d: sum(dias(30), "website_clicks"),
    diario: daily,
    mejores: orden.slice(0, 6), peores: orden.slice(-6).reverse(),
    feed, historias: stories.slice(0, 40),
    por_formato: Object.fromEntries(Object.entries(porTipo).map(([k, arr]) => [k, { n: arr.length, views: prom(arr, "views"), reach: prom(arr, "reach"), likes: prom(arr, "like_count"), saved: prom(arr, "saved"), shares: prom(arr, "shares") }])),
    historias_prom: { n: stories.length, reach: prom(stories, "reach"), views: prom(stories, "views"), replies: prom(stories, "replies") },
    actualizado: media[0]?.updated_at || ultimo?.updated_at || null,
  };
}

// Texto corto para el analista: qué rinde y qué no.
export async function rendimientoPropioTexto() {
  try {
    const a = await analisis();
    if (!a.feed.length) return "";
    const f = (x) => `"${String(x.caption || "").split("\\n")[0].slice(0, 60)}" (${x.media_type === "CAROUSEL_ALBUM" ? "carrusel" : x.product_type === "REELS" ? "reel" : "posteo"}: ${x.views ?? "?"} visualizaciones, ${x.reach ?? "?"} alcance, ${x.saved ?? 0} guardados, ${x.shares ?? 0} compartidos)`;
    return `RENDIMIENTO PROPIO (últimos 60 días, ${a.feed.length} publicaciones; seguidores: ${a.seguidores ?? "?"}, +${a.nuevos_30d} en 30 días):\nMejores: ${a.mejores.slice(0, 4).map(f).join("; ")}\nPeores: ${a.peores.slice(0, 3).map(f).join("; ")}\nPromedio por formato: ${Object.entries(a.por_formato).map(([k, v]) => `${k} ${v.views} visualizaciones / ${v.reach} alcance (${v.n})`).join(" · ")}. Historias: ${a.historias_prom.reach} alcance promedio.`;
  } catch { return ""; }
}
