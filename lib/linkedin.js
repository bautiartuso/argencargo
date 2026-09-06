// lib/linkedin.js — LinkedIn de Bautista (perfil personal, integrado con la página Argencargo).
//   Temas (resumen real de la semana, notas del blog, noticias del radar, educativo, reflexión) → pieza kind "linkedin"
//   en la cola → la Mac (claude -p, sin costo) escribe post.md + meta.json (+ imagen opcional 1200×1200)
//   → Contenido (✓) → Calendario → el vigilante publica por la Posts API (texto, imagen o tarjeta con la nota del blog).
//
// Conexión: OAuth 2.0 (app de LinkedIn Developers; LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET en Vercel).
//   Permisos "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect" (autoservicio, al instante) →
//   publica como Bautista. Con la "Community Management API" aprobada por LinkedIn, además publica como la página.
//   El token dura 60 días y LinkedIn no lo renueva solo para apps comunes: el sistema avisa por Telegram
//   una semana antes y en Conexión hay un botón Reconectar.
import { sb, BASE_URL, crearPiezas, radarReciente, detalleNoticias, datosSistema, slideUrls } from "./studio";

const API = "https://api.linkedin.com";
export const LI_REDIRECT = `${BASE_URL}/api/linkedin/callback`;
export const liConfigured = () => !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);

// Versión mensual de la API (YYYYMM). LinkedIn sostiene cada versión ~12 meses: por defecto la de hace 3 meses.
function apiVersion() {
  if (process.env.LINKEDIN_API_VERSION) return process.env.LINKEDIN_API_VERSION;
  const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 3);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function liSettings() {
  const r = await sb(`/cs_settings?key=eq.linkedin&select=value`);
  return Array.isArray(r.body) && r.body[0] ? r.body[0].value || {} : {};
}
export async function liSave(cfg) {
  await sb(`/cs_settings?on_conflict=key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "linkedin", value: cfg, updated_at: new Date().toISOString() }) });
}
export async function liDisconnect() {
  const cur = await liSettings();
  // Se conservan los ajustes (cadencia, modo, página); se borra solo la sesión.
  const { access_token, refresh_token, expires_at, person_urn, name, picture, scopes, connected_at, oauth_state, ...rest } = cur;
  await liSave(rest);
}

const H = (token, extra = {}) => ({ Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0", "LinkedIn-Version": apiVersion(), "Content-Type": "application/json", ...extra });
async function liFetch(cfg, path, opts = {}) {
  const r = await fetch(`${API}${path}`, { ...opts, headers: H(cfg.access_token, opts.headers) });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch {}
  if (!r.ok) throw new Error(b?.message || b?.error_description || b?.error || `LinkedIn HTTP ${r.status}${t ? `: ${t.slice(0, 160)}` : ""}`);
  return { body: b, headers: r.headers };
}

// ── OAuth ────────────────────────────────────────────────────────────────────
export async function liAuthUrl({ pagina = false } = {}) {
  if (!liConfigured()) throw new Error("Faltan LINKEDIN_CLIENT_ID y LINKEDIN_CLIENT_SECRET en Vercel");
  const state = globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const cur = await liSettings();
  await liSave({ ...cur, oauth_state: state, oauth_pagina: !!pagina, oauth_at: new Date().toISOString() });
  const scope = ["openid", "profile", "w_member_social", ...(pagina ? ["r_organization_social", "w_organization_social", "rw_organization_admin"] : [])].join(" ");
  const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID);
  u.searchParams.set("redirect_uri", LI_REDIRECT);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", scope);
  return u.toString();
}

export async function liUserinfo(token) {
  const r = await fetch(`${API}/v2/userinfo`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.sub) throw new Error(j.message || j.error_description || `userinfo HTTP ${r.status}`);
  return j;
}

// Páginas que administra la persona (solo con rw_organization_admin, es decir con la Community Management API).
export async function liOrganizations(cfg) {
  const r = await liFetch(cfg, `/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organization~(id,localizedName)))`);
  return (r.body?.elements || []).map((e) => ({ urn: e.organization, id: String(e.organization || "").split(":").pop(), name: e["organization~"]?.localizedName || null })).filter((o) => o.urn);
}

export async function liCallback({ code, state }) {
  const cur = await liSettings();
  if (!cur.oauth_state || cur.oauth_state !== state) throw new Error("La sesión de conexión no coincide: volvé a tocar Conectar");
  const r = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: LI_REDIRECT, client_id: process.env.LINKEDIN_CLIENT_ID, client_secret: process.env.LINKEDIN_CLIENT_SECRET }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || `LinkedIn HTTP ${r.status}`);
  const me = await liUserinfo(j.access_token);
  const cfg = {
    ...cur, access_token: j.access_token, refresh_token: j.refresh_token || null,
    expires_at: new Date(Date.now() + Number(j.expires_in || 5184000) * 1000).toISOString(),
    scopes: String(j.scope || "").split(/[ ,]+/).filter(Boolean),
    person_urn: `urn:li:person:${me.sub}`, name: me.name || [me.given_name, me.family_name].filter(Boolean).join(" ") || null, picture: me.picture || null,
    connected_at: new Date().toISOString(), oauth_state: null, org_error: null,
  };
  if (cfg.scopes.includes("rw_organization_admin")) {
    try { const orgs = await liOrganizations(cfg); const o = orgs.find((x) => /argencargo/i.test(x.name || "")) || orgs[0]; if (o) { cfg.org_urn = o.urn; cfg.org_id = o.id; cfg.org_name = o.name; } }
    catch (e) { cfg.org_error = String(e.message).slice(0, 200); }
  }
  await liSave(cfg);
  return cfg;
}

export async function guardarLinkedinSettings(v) {
  const cur = await liSettings();
  const next = { ...cur };
  if (v.por_semana != null) next.por_semana = Math.max(0, Math.min(5, Math.round(Number(v.por_semana) || 0)));
  if (v.modo) next.modo = v.modo === "auto" ? "auto" : "manual";
  if (v.org_id != null) {
    const id = String(v.org_id).replace(/\D/g, "");
    next.org_id = id || null; next.org_urn = id ? `urn:li:organization:${id}` : null;
    if (!id) next.org_name = null; else if (v.org_name) next.org_name = String(v.org_name).slice(0, 80);
  }
  await liSave(next);
  return next;
}

export async function liStatus() {
  const cfg = await liSettings();
  const dias = cfg.expires_at ? Math.floor((new Date(cfg.expires_at).getTime() - Date.now()) / 86400000) : null;
  const scopes = Array.isArray(cfg.scopes) ? cfg.scopes : [];
  return {
    configured: liConfigured(), connected: !!(cfg.access_token && cfg.person_urn), name: cfg.name || null, picture: cfg.picture || null,
    expires_at: cfg.expires_at || null, dias_restantes: dias, vencido: dias != null && dias < 0, connected_at: cfg.connected_at || null,
    org_id: cfg.org_id || null, org_name: cfg.org_name || null, org_error: cfg.org_error || null,
    puede_pagina: !!(cfg.org_urn && scopes.includes("w_organization_social")),
    por_semana: cfg.por_semana ?? 2, modo: cfg.modo === "auto" ? "auto" : "manual", redirect: LI_REDIRECT, scopes,
  };
}

// ── Publicación ──────────────────────────────────────────────────────────────
// "Little text format" de LinkedIn: estos caracteres van escapados con barra invertida (las menciones
// @[Nombre](urn:li:organization:123) se dejan intactas).
const MENCION = /@\[[^\]]+\]\(urn:li:[a-z]+:\d+\)/g;
const escapeLi = (s) => String(s || "").replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => `\\${c}`);
export function textoLinkedin(caption, cfg = {}) {
  const pagina = cfg.org_urn ? `@[${cfg.org_name || "Argencargo"}](${cfg.org_urn})` : "Argencargo";
  const raw = String(caption || "").replace(/\{\{\s*PAGINA\s*\}\}/g, pagina).trim();
  const menciones = raw.match(MENCION) || [];
  return raw.split(MENCION).map(escapeLi).reduce((acc, part, i) => acc + part + (menciones[i] || ""), "").slice(0, 2990);
}

async function liUploadImage(cfg, owner, url) {
  const init = await liFetch(cfg, "/rest/images?action=initializeUpload", { method: "POST", body: JSON.stringify({ initializeUploadRequest: { owner } }) });
  const { uploadUrl, image } = init.body?.value || {};
  if (!uploadUrl || !image) throw new Error("LinkedIn no devolvió la URL de subida de la imagen");
  const bin = await fetch(url);
  if (!bin.ok) throw new Error("no se pudo bajar la imagen de la pieza");
  const up = await fetch(uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${cfg.access_token}`, "Content-Type": "application/octet-stream" }, body: Buffer.from(await bin.arrayBuffer()) });
  if (!up.ok) throw new Error(`subida de imagen a LinkedIn: HTTP ${up.status}`);
  return image;
}

// Publica la pieza. Devuelve el URN del post (urn:li:share:… / urn:li:ugcPost:…).
export async function liPublish(piece, cfg) {
  if (!cfg?.access_token || !cfg?.person_urn) throw new Error("LinkedIn sin conectar (solapa Conexión)");
  if (cfg.expires_at && new Date(cfg.expires_at).getTime() < Date.now()) throw new Error("El token de LinkedIn venció: tocá Reconectar en Conexión");
  const comoPagina = piece.li_author === "pagina";
  if (comoPagina && !(cfg.org_urn && (cfg.scopes || []).includes("w_organization_social"))) throw new Error("Para publicar como la página hace falta la Community Management API aprobada y reconectar con la página");
  const author = comoPagina ? cfg.org_urn : cfg.person_urn;
  const commentary = textoLinkedin(piece.caption, cfg);
  if (!commentary) throw new Error("El post no tiene texto");
  const body = { author, commentary, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false };
  const urls = slideUrls(piece);
  const titulo = String(piece.headline || piece.title || "").slice(0, 200);
  if (piece.li_link) body.content = { article: { source: piece.li_link, title: titulo || "Argencargo" } };
  else if (urls[0]) body.content = { media: { id: await liUploadImage(cfg, author, urls[0]), altText: titulo } };
  const r = await liFetch(cfg, "/rest/posts", { method: "POST", body: JSON.stringify(body) });
  return r.headers.get("x-restli-id") || r.headers.get("x-linkedin-id") || null;
}
export const liPostUrl = (urn) => (urn ? `https://www.linkedin.com/feed/update/${urn}/` : null);

// El vigilante: publica en LinkedIn lo programado cuya hora ya pasó.
export async function publicarPendientesLinkedin() {
  const cfg = await liSettings();
  if (!cfg.access_token) return { skipped: "LinkedIn sin conectar" };
  const r = await sb(`/cs_pieces?status=eq.scheduled&kind=eq.linkedin&scheduled_at=lte.${new Date().toISOString()}&select=*&order=scheduled_at.asc&limit=2`);
  const out = [];
  for (const piece of Array.isArray(r.body) ? r.body : []) {
    try {
      const urn = await liPublish(piece, cfg);
      await sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "published", published_at: new Date().toISOString(), li_post_urn: urn, publish_error: null }) });
      out.push({ id: piece.id, ok: true, urn });
    } catch (e) {
      await sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ publish_error: String(e.message).slice(0, 300) }) });
      out.push({ id: piece.id, error: e.message });
    }
  }
  return { linkedin: out };
}

// Modo automático: próximo hueco hábil (lunes a viernes, 9:30 AR), a partir de mañana, sin dos posts el mismo día.
export async function proximoSlotLinkedin() {
  const r = await sb(`/cs_pieces?kind=eq.linkedin&status=in.(scheduled,published)&scheduled_at=gte.${new Date().toISOString()}&select=scheduled_at`);
  const ocupados = new Set((Array.isArray(r.body) ? r.body : []).map((p) => String(p.scheduled_at || "").slice(0, 10)));
  const d = new Date(Date.now() - 3 * 3600000); // hora AR
  for (let i = 1; i <= 21; i++) {
    const x = new Date(d.getTime() + i * 86400000);
    const dow = x.getUTCDay();
    const dia = x.toISOString().slice(0, 10);
    if (dow >= 1 && dow <= 5 && !ocupados.has(dia)) return new Date(`${dia}T09:30:00-03:00`);
  }
  return new Date(Date.now() + 86400000);
}

// ── Temas: qué se le pide a la Mac ───────────────────────────────────────────
const fechaAr = (d) => new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

// Resumen REAL de la semana con datos del sistema (sin nombres de clientes; sin cifras de plata).
export async function resumenSemana() {
  const desde = new Date(Date.now() - 7 * 86400000);
  const iso = desde.toISOString();
  const [ent, vue, nue, ahora] = await Promise.all([
    sb(`/operations?delivery_completed_at=gte.${iso}&select=id,gross_weight_kg,origin`),
    sb(`/flights?dispatched_at=gte.${iso}&select=flight_code,total_weight_kg,international_carrier`),
    sb(`/operations?created_at=gte.${iso}&select=id`),
    datosSistema(),
  ]);
  const entregadas = Array.isArray(ent.body) ? ent.body : [];
  const vuelos = Array.isArray(vue.body) ? vue.body : [];
  const kgVuelos = Math.round(vuelos.reduce((a, f) => a + Number(f.total_weight_kg || 0), 0));
  const carriers = [...new Set(vuelos.map((f) => String(f.international_carrier || "").trim()).filter(Boolean))];
  const lineas = [
    `- Cargas entregadas a clientes: ${entregadas.length}`,
    `- Vuelos despachados desde China: ${vuelos.length}${kgVuelos ? ` (${kgVuelos} kg en total)` : ""}${carriers.length ? ` · carriers: ${carriers.join(", ")}` : ""}`,
    `- Operaciones nuevas abiertas: ${Array.isArray(nue.body) ? nue.body.length : 0}`,
    `- Ahora mismo: ${ahora.vuelos_en_transito ?? 0} vuelos en tránsito, ${ahora.kg_en_el_aire ?? 0} kg en el aire`,
  ];
  return { texto: `RESUMEN REAL DE LA SEMANA (${fechaAr(desde)} al ${fechaAr(new Date())}), tomado del sistema de Argencargo. Usá SOLO estos datos; los que estén en 0 no los menciones:\n${lineas.join("\n")}`, entregadas: entregadas.length, vuelos: vuelos.length, hayDatos: entregadas.length + vuelos.length > 0 };
}

async function linksUsados() {
  const r = await sb(`/cs_pieces?kind=eq.linkedin&status=in.(generating,review,approved,scheduled,published)&select=li_link,material`);
  const rows = Array.isArray(r.body) ? r.body : [];
  return new Set(rows.flatMap((x) => [x.li_link, (String(x.material || "").match(/URL: (\S+)/) || [])[1]]).filter(Boolean));
}

// Notas del blog publicadas en los últimos 21 días que todavía no tienen post.
export async function notasSinPost() {
  const desde = new Date(Date.now() - 21 * 86400000).toISOString();
  const [notas, usados] = await Promise.all([sb(`/blog_posts?status=eq.published&published_at=gte.${desde}&select=slug,title,excerpt,content_md,source_name,source_url,relevance&order=published_at.desc&limit=10`), linksUsados()]);
  return (Array.isArray(notas.body) ? notas.body : []).map((n) => ({ ...n, link: `${BASE_URL}/blog/${n.slug}` })).filter((n) => !usados.has(n.link));
}

// Noticias del radar con artículo legible que no se usaron en LinkedIn.
export async function noticiasSinPost(n = 4) {
  const [radar, usados] = await Promise.all([radarReciente(20), linksUsados()]);
  const libres = radar.filter((x) => x.url && !usados.has(x.url)).slice(0, n + 3);
  const con = await detalleNoticias(libres, { max: n + 3, chars: 5000 });
  return con.filter((x) => (x.detalle || "").length >= 600).slice(0, n);
}

const TIPOS = {
  logros: { pillar: "logros", title: "Esta semana en Argencargo", brief: "Post de LinkedIn tipo LOGROS: \"esta semana en Argencargo\", contado en primera persona por Bautista con los números reales del material (cargas entregadas, vuelos despachados, kilos). Tono de empresa que funciona y crece, sin triunfalismo ni cifras de plata: lo que se movió, qué implica para los clientes y una reflexión corta de cómo se opera. Puede llevar imagen 1200×1200 tipo \"la semana en números\"." },
  nota: { pillar: "noticia", brief: "Post de LinkedIn que presenta una NOTA DEL BLOG de Argencargo (el material incluye la nota completa y el LINK). Contá en primera persona qué cambió y por qué importa para quien importa desde China, con 2 o 3 datos concretos, e invitá a leer la nota. Sin imagen: el sistema adjunta la nota como tarjeta." },
  noticia: { pillar: "noticia", brief: "Post de LinkedIn INFORMATIVO a partir de una noticia leída de su fuente (material). Explicá en simple qué cambió, a quién afecta y qué conviene hacer, con criterio propio. Nunca copies frases de la fuente; citala al final con su nombre (sin link). Sin imagen salvo que un dato grande lo pida." },
  educativo: { pillar: "educativo", title: "Post educativo", brief: "Post de LinkedIn EDUCATIVO: elegí un tema concreto de importación desde China que no esté en historial.md (leé productos.md y audiencia.md: las dudas repetidas, el peso volumétrico, qué incluye una cotización, aduana, consolidados, monotributista sí puede importar, etc.). Contalo como lo explicaría el fundador a un cliente, con ejemplo realista sin cifras inventadas. Puede llevar imagen si hay una lista corta o un dato grande." },
  opinion: { pillar: "marca", title: "Cómo trabajamos", brief: "Post de LinkedIn de MARCA / REFLEXIÓN: Bautista cuenta en primera persona algo de cómo opera Argencargo (el sistema propio: calculadora, link de retiro, seguimiento, bot de entregas; el depósito en China; la gestión punta a punta) o una lección del oficio (identidad.md, audiencia.md). Honesto y concreto, sin humo ni vender. Texto puro, sin imagen." },
};

// Encola N posts de LinkedIn eligiendo temas con datos reales; devuelve las piezas creadas.
export async function encolarLinkedin({ n = 1, tipos = null, source = "linkedin" } = {}) {
  const cant = Math.max(0, Math.min(10, Number(n) || 0));
  if (!cant) return [];
  const orden = Array.isArray(tipos) && tipos.length ? tipos : ["nota", "logros", "educativo", "noticia", "opinion"];
  const [semana, notas, noticias] = await Promise.all([resumenSemana().catch(() => null), notasSinPost().catch(() => []), noticiasSinPost(cant).catch(() => [])]);
  const ideas = [];
  let iNota = 0, iNoticia = 0, k = 0;
  while (ideas.length < cant && k < cant * 3) {
    const t = orden[k++ % orden.length];
    if (t === "nota") {
      const nt = notas[iNota++]; if (!nt) continue;
      ideas.push({ kind: "linkedin", pillar: TIPOS.nota.pillar, title: String(nt.title).slice(0, 90), brief: TIPOS.nota.brief, li_link: nt.link, material: `NOTA DEL BLOG (ya publicada en ${nt.link}):\nTÍTULO: ${nt.title}\nRESUMEN: ${nt.excerpt || ""}\n\nTEXTO DE LA NOTA (material; no copiar párrafos):\n${String(nt.content_md || "").slice(0, 6000)}\n\nLINK: ${nt.link}` });
    } else if (t === "noticia") {
      const nw = noticias[iNoticia++]; if (!nw) continue;
      ideas.push({ kind: "linkedin", pillar: TIPOS.noticia.pillar, title: String(nw.title).slice(0, 90), brief: TIPOS.noticia.brief, material: `FUENTE: ${nw.source_name || ""}\nTÍTULO ORIGINAL: ${nw.title}\nURL: ${nw.url}\n\nTEXTO DEL ARTÍCULO (solo como material; NO copiar frases):\n${nw.detalle || ""}` });
    } else if (t === "logros") {
      if (!semana?.hayDatos || ideas.some((i) => i.pillar === "logros")) continue;
      ideas.push({ kind: "linkedin", pillar: TIPOS.logros.pillar, title: TIPOS.logros.title, brief: TIPOS.logros.brief, material: semana.texto });
    } else {
      const d = TIPOS[t] || TIPOS.educativo;
      if (ideas.filter((i) => i.pillar === d.pillar).length >= 2) continue;
      ideas.push({ kind: "linkedin", pillar: d.pillar, title: d.title, brief: d.brief, material: null });
    }
  }
  // Si faltan temas con datos, se completa con educativo.
  while (ideas.length < cant) ideas.push({ kind: "linkedin", pillar: TIPOS.educativo.pillar, title: TIPOS.educativo.title, brief: TIPOS.educativo.brief, material: null });
  return crearPiezas(ideas, { source });
}

// Cron semanal (lunes a la mañana): encola los posts de la semana según la cadencia elegida.
export async function redactorSemanalLinkedin() {
  const cfg = await liSettings();
  const porSemana = Math.max(0, Math.min(5, Number(cfg.por_semana ?? 2)));
  if (!porSemana) return { skipped: "LinkedIn apagado (0 por semana)" };
  const lunes = new Date(Date.now() - 3 * 3600000); lunes.setUTCDate(lunes.getUTCDate() - ((lunes.getUTCDay() + 6) % 7)); lunes.setUTCHours(3, 0, 0, 0);
  const ya = await sb(`/cs_pieces?kind=eq.linkedin&created_at=gte.${lunes.toISOString()}&status=neq.rejected&select=id`);
  const faltan = porSemana - (Array.isArray(ya.body) ? ya.body.length : 0);
  if (faltan <= 0) return { skipped: "ya están los posts de la semana" };
  const created = await encolarLinkedin({ n: faltan, tipos: ["logros", "nota", "educativo", "noticia", "opinion"], source: "linkedin-cron" });
  return { encolados: created.map((c) => c.title) };
}
