// lib/studio.js — Content Studio (v2, calcado del sistema de Minificando).
//
//   Generar (brief / chatbot) o Runner (el analista propone N) → pieza en la COLA (cs_pieces,
//   sobrevive a reinicios) → la Mac con Claude Code (`claude -p`, Opus, memoria completa de la
//   marca) escribe post.html + meta.json → Chrome invisible saca la foto en tamaño exacto → PNG →
//   Aprobación → al aprobar se guarda en el historial y como referencia de estilo → Calendario
//   (día y hora) → el vigilante (cron cada minuto) publica por Instagram Graph API.
//
// Memoria de marca (cs_memory, sembrada desde docs/marca/knowledge): identidad, tono, audiencia,
// productos, dos-and-donts, campanas, historial (automático) + brand-kit + referencias-estilo.
// Brand kit y posteos de referencia (imágenes) viven en cs_assets.

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { CLAUDE_MODEL } from "./anthropic";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
export const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
// Planificación e ideas por API (corto y barato). El diseño NO usa API: lo hace la Mac.
const PLAN_MODEL = process.env.STUDIO_PLAN_MODEL || CLAUDE_MODEL;
const CHAT_MODEL = process.env.STUDIO_CHAT_MODEL || "claude-sonnet-5";

export async function sb(pathq, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${pathq}`, {
    ...opts,
    headers: {
      apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json",
      Prefer: opts.method === "POST" ? "resolution=merge-duplicates,return=representation" : opts.method === "PATCH" ? "return=representation" : undefined,
      ...(opts.headers || {}),
    },
  });
  const t = await r.text();
  let b = null; try { b = JSON.parse(t); } catch {}
  return { status: r.status, body: b };
}

export async function uploadStorage(pathname, buffer, mime) {
  const up = await fetch(`${SB_URL}/storage/v1/object/content-studio/${pathname}`, { method: "POST", headers: { Authorization: `Bearer ${SB_SERVICE}`, apikey: SB_SERVICE, "Content-Type": mime, "x-upsert": "true" }, body: buffer });
  if (!up.ok) throw new Error(`storage ${up.status}`);
  return `${SB_URL}/storage/v1/object/public/content-studio/${pathname}`;
}

// ── Memoria de marca ─────────────────────────────────────────────────────────
export const MEMORY_DOCS = [
  { key: "identidad", title: "Identidad", file: "knowledge/identidad.md" },
  { key: "tono", title: "Tono", file: "knowledge/tono.md" },
  { key: "audiencia", title: "Audiencia", file: "knowledge/audiencia.md" },
  { key: "productos", title: "Productos y servicios", file: "knowledge/productos.md" },
  { key: "dos-and-donts", title: "Do's & Don'ts", file: "knowledge/dos-and-donts.md" },
  { key: "campanas", title: "Campañas y calendario", file: "knowledge/campanas.md" },
  { key: "historial", title: "Historial de contenido (automático)", file: "knowledge/historial.md" },
  { key: "brand-kit", title: "Brand kit (colores, tipografía, composición)", file: "03-brand-kit.md" },
  { key: "referencias-estilo", title: "Referencia de estilo", file: "05-referencias/magforce-estilo.md" },
];

export async function loadMemory() {
  const r = await sb(`/cs_memory?select=key,title,content,updated_at`);
  let rows = Array.isArray(r.body) ? r.body : [];
  const missing = MEMORY_DOCS.filter((d) => !rows.find((x) => x.key === d.key));
  if (missing.length) {
    for (const d of missing) {
      let content = "";
      try { content = await fs.readFile(path.join(process.cwd(), "docs/marca", d.file), "utf8"); } catch (e) { console.error("[studio] seed", d.file, e.message); }
      await sb(`/cs_memory?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: d.key, title: d.title, content }) });
    }
    const r2 = await sb(`/cs_memory?select=key,title,content,updated_at`);
    rows = Array.isArray(r2.body) ? r2.body : rows;
  }
  const order = MEMORY_DOCS.map((d) => d.key);
  return rows.filter((x) => order.includes(x.key)).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}
export const memText = (rows, key) => rows.find((x) => x.key === key)?.content || "";
const memoriaCompleta = (mem) => mem.filter((m) => m.key !== "referencias-estilo").map((m) => `=== ${m.title.toUpperCase()} (${m.key}) ===\n${m.content}`).join("\n\n");

export async function loadAssets() {
  const r = await sb(`/cs_assets?select=id,kind,url,name,note,created_at&order=created_at.asc`);
  return Array.isArray(r.body) ? r.body : [];
}

// Últimas piezas aprobadas/publicadas: referencia de estilo viva (HTML + imagen).
export async function ejemplosAprobados(n = 6) {
  const r = await sb(`/cs_pieces?status=in.(approved,scheduled,published)&select=id,kind,title,headline,html,image_url,approved_at&order=approved_at.desc.nullslast&limit=${n}`);
  return Array.isArray(r.body) ? r.body : [];
}

// ── Contexto: radar de noticias + datos reales del sistema ──────────────────
export async function radarReciente(n = 12) {
  const desde = new Date(Date.now() - 7 * 86400000).toISOString();
  const r = await sb(`/mkt_radar_items?discovered_at=gte.${desde}&is_dismissed=eq.false&select=title,source_name,url,is_hot&order=is_hot.desc,discovered_at.desc&limit=${n}`);
  return Array.isArray(r.body) ? r.body : [];
}

// Lee el cuerpo de las noticias (texto plano, recortado) para que el analista tenga el DETALLE:
// qué cambió, a quién alcanza, desde cuándo. Sin detalle, una noticia no se usa.
async function detalleNoticias(items, { max = 6, chars = 1800 } = {}) {
  const out = [];
  await Promise.all(items.slice(0, max).map(async (it) => {
    if (!it.url) return;
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 7000);
      const r = await fetch(it.url, { signal: ctl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; ArgencargoRadar/1.0)" } });
      clearTimeout(tm);
      if (!r.ok) return;
      const html = await r.text();
      const body = (html.match(/<article[\s\S]*?<\/article>/i) || html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
      const txt = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
      if (txt.length > 200) out.push({ ...it, detalle: txt.slice(0, chars) });
    } catch {}
  }));
  return out;
}

export async function datosSistema() {
  const out = {};
  try {
    const hace7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const [vuelos, entregadas] = await Promise.all([
      sb(`/flights?dispatched_at=not.is.null&status=neq.recibido&select=flight_code,total_weight_kg,international_carrier`),
      sb(`/operations?delivery_completed_at=gte.${hace7}&select=id`),
    ]);
    const vs = Array.isArray(vuelos.body) ? vuelos.body : [];
    out.vuelos_en_transito = vs.length;
    out.kg_en_el_aire = Math.round(vs.reduce((a, f) => a + Number(f.total_weight_kg || 0), 0));
    out.cargas_entregadas_7d = Array.isArray(entregadas.body) ? entregadas.body.length : null;
  } catch (e) { console.error("[studio] datos", e.message); }
  return out;
}

// ── Claude (API, solo para planificar y chatear: el diseño lo hace la Mac) ──
async function claudeJson({ system, user, schema, max_tokens = 3000, model = PLAN_MODEL }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const call = (m) => client.messages.create({ model: m, max_tokens, system, messages: [{ role: "user", content: user }], output_config: { format: { type: "json_schema", schema } } });
  let res;
  try { res = await call(model); }
  catch (e) { if (model !== CLAUDE_MODEL && (e?.status === 404 || e?.status === 400)) res = await call(CLAUDE_MODEL); else throw e; }
  return JSON.parse(res.content.find((b) => b.type === "text")?.text || "{}");
}

const HOY_AR = () => new Date(Date.now() - 3 * 3600 * 1000);
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// ── 1) El analista (runner): propone N ideas ────────────────────────────────
const IDEAS_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["feed", "carousel", "story"], description: "feed = posteo de una sola imagen; carousel = carrusel (varias imágenes en un posteo); story = historia (1 sola) o secuencia de historias (2 a 4, ver slides)" },
          slides: { type: "integer", description: "Cantidad de imágenes. feed: siempre 1. carousel: 2 a 6 (2 es válido: portada + una imagen de desarrollo). story: 1 si es una idea liviana; 2 a 4 si es una nota que hay que desarrollar (secuencia)." },
          slides_plan: { type: "array", items: { type: "string" }, description: "Solo si slides > 1: qué dice cada imagen, en orden, una frase concreta por imagen (la 1 es la portada/gancho, la última el cierre). Vacío si slides = 1." },
          pillar: { type: "string", description: "educativo | datos | noticia | marca | rutina | caso" },
          title: { type: "string", description: "Nombre interno corto" },
          brief: { type: "string", description: "Qué comunicar, con el dato o el ángulo concreto (2 a 5 frases). Sin repetir datos ni temas recientes." },
          visual: { type: "string", description: "Concepto visual, distinto en cada idea. Elegí uno del banco: numero-gigante | comparativa-dos-columnas | checklist | mito-vs-realidad | pregunta-gancho | cita-destacada | timeline-3-pasos | ruta-mapa | infografia-mini | tarjeta-blanca-minimal | franjas-diagonales | patron-geometrico | ticket-recibo | sello-tipografico | lista-top-5 | antes-despues" },
          background: { type: "string", enum: ["claro", "oscuro"], description: "Fondo de la pieza. Al menos la mitad de las ideas de cada tanda tienen que ser 'claro' (blanco o gris muy claro)." },
        },
        required: ["kind", "slides", "slides_plan", "pillar", "title", "brief", "visual", "background"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

export async function planIdeas({ count = 4, kinds = null, brief = null, memory = null }) {
  const mem = memory || await loadMemory();
  const [radar0, datos, recientes] = await Promise.all([
    radarReciente(12), datosSistema(),
    sb(`/cs_pieces?status=in.(review,approved,scheduled,published,rejected,generating)&select=title,kind,pillar,headline,brief,created_at&order=created_at.desc&limit=60`),
  ]);
  const conDetalle = await detalleNoticias(radar0);
  const radar = radar0.map((x) => conDetalle.find((d) => d.url === x.url) || x);
  const hoy = HOY_AR();
  const dia = DIAS[hoy.getUTCDay()];
  const recs = Array.isArray(recientes.body) ? recientes.body : [];
  const ultimas = recs.map((p) => `- [${p.kind}/${p.pillar || "?"}] ${p.headline || p.title}${p.brief ? ` — ${String(p.brief).slice(0, 90)}` : ""}`).join("\n") || "(ninguna todavía)";
  const hace7 = Date.now() - 7 * 86400000;
  const datosUsados = recs.filter((p) => new Date(p.created_at).getTime() > hace7).map((p) => `${p.headline || ""} ${p.brief || ""}`).join(" ");
  const yaUsoKg = /kg|kilo/i.test(datosUsados), yaUsoVuelos = /vuelos? en tr/i.test(datosUsados), yaUsoEntregas = /entregad/i.test(datosUsados);
  const system = `Sos el analista de contenido de Argencargo: un creativo con oficio, no un generador de plantillas. Proponés ideas de posts e historias que respetan a rajatabla la memoria de marca y que NO se parecen entre sí ni a lo ya hecho.

REGLAS DE CREATIVIDAD (obligatorias):
- Cada idea de la tanda tiene un ángulo distinto, un pilar distinto cuando se pueda, y un concepto visual distinto del banco.
- Nada de "X vuelos en tránsito / X kg en el aire / X cargas entregadas" si ya se usó en la semana (ver abajo). Los datos del sistema son un condimento, no el plato de todos los días.
- Buscá ganchos con tensión: un error común, una creencia falsa, un número que sorprende, una pregunta que el cliente se hace a las 2 de la mañana, una comparación injusta, una historia mínima de una operación real, un "sabías que" del comercio exterior, un consejo de proveedor, una fecha del calendario chino, una noticia explicada en una línea.
- Fondos: mitad claros (blanco) y mitad oscuros, alternados. Decilo en background.
- Prohibido repetir titulares, estructuras o metáforas de la lista de piezas recientes.

CRITERIO DE FORMATO (cada idea nace en el formato que le corresponde; esto es lo más importante):
- POSTEO (kind=feed, slides=1): UNA idea fuerte que se entiende completa en una sola imagen (un dato, una frase, un mito, una pregunta con su respuesta). Como es una sola imagen, JAMÁS dice "deslizá", "seguí leyendo" ni "ver más". Si la idea necesita más de una imagen, no es un posteo: es un carrusel.
- CARRUSEL (kind=carousel, slides=2 a 6; dos imágenes es un carrusel perfectamente válido, estilo portada + desarrollo): una idea que se desarrolla en partes: lista, pasos, comparativa, checklist, "5 errores", mito vs realidad con varios casos, una noticia explicada. La imagen 1 es la portada: gancho + "Deslizá →". Cada imagen siguiente dice UNA sola cosa con poco texto (el texto se reparte entre las imágenes, nunca se amontona). La última cierra: resumen de una línea + marca. Es el formato preferido para lo educativo.
- HISTORIA SUELTA (kind=story, slides=1): algo momentáneo y liviano que se lee en 3 segundos: buena semana, buen finde, un dato rápido, una pregunta, un recordatorio de fecha. Nunca una nota que haya que explicar.
- SECUENCIA DE HISTORIAS (kind=story, slides=2 a 4): cuando querés contar algo con sustancia en historias (una noticia, un consejo con pasos): la 1 es el gancho y dice de qué se trata, las del medio desarrollan lo concreto (QUÉ cambió exactamente, a quién alcanza, desde cuándo, qué conviene hacer), la última cierra. Prohibido el "cambió algo" sin decir qué: si en slides_plan no podés escribir el dato concreto, la idea no va.
- NOTICIAS: usá solo las que tienen DETALLE abajo (leíste el artículo) y decí en el brief el hecho concreto con sus datos. Un título sin detalle no alcanza para una pieza.

${memoriaCompleta(mem)}`;
  const user = `HOY es ${dia} ${hoy.toISOString().slice(0, 10)} (Argentina).

DATOS REALES DEL SISTEMA (usalos si sirven, sin inventar otros):
${JSON.stringify(datos)}

NOTICIAS DEL RADAR (últimos 7 días; las que tienen DETALLE son las únicas que sirven para una pieza de noticia):
${radar.map((x) => `- ${x.title} (${x.source_name})${x.detalle ? `\n  DETALLE: ${x.detalle}` : ""}`).join("\n") || "(nada nuevo)"}

PIEZAS RECIENTES (no repetir tema, titular ni estructura):
${ultimas}

DATOS YA USADOS ESTA SEMANA (no volver a usarlos): ${[yaUsoKg && "kilos en el aire", yaUsoVuelos && "vuelos en tránsito", yaUsoEntregas && "cargas entregadas"].filter(Boolean).join(", ") || "ninguno"}.

${brief ? `PEDIDO DE BAUTISTA (tiene prioridad absoluta): ${brief}\n` : ""}
Proponé exactamente ${count} ideas${kinds ? ` con estos formatos, en este orden: ${kinds.map((k) => k === "carousel" ? "carrusel" : k === "story" ? "historia (vos decidís si es suelta o secuencia de 2 a 4)" : "posteo").join(", ")}` : " (mezclá posteos, carruseles e historias según el criterio de formato y el ritmo de campanas.md)"}.
Si es lunes, una historia es "buena semana"; si es viernes, una es "buen fin de semana". Variá pilares. Cada brief dice exactamente qué afirmar, con el número o el dato si aplica. En carruseles y secuencias, slides_plan tiene una línea por imagen con lo que dice esa imagen.`;
  const out = await claudeJson({ system, user, schema: IDEAS_SCHEMA, max_tokens: 6000 });
  let ideas = Array.isArray(out.ideas) ? out.ideas.slice(0, count) : [];
  // Si se pidió una mezcla concreta, se respeta aunque el modelo se haya desviado.
  if (kinds) ideas = ideas.map((i, n) => ({ ...i, kind: kinds[n] || i.kind }));
  return ideas;
}

// ── 2) Chatbot: armar una idea conversando (texto, imágenes adjuntas, audio transcripto) ──
const CHAT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Respuesta al usuario, breve, en tono de estratega" },
    listo: { type: "boolean", description: "true cuando la idea está lo bastante definida como para generar la pieza" },
    kind: { type: "string", enum: ["feed", "carousel", "story"], description: "feed = posteo de una imagen; carousel = carrusel; story = historia (suelta o secuencia, ver slides)" },
    slides: { type: "integer", description: "feed: 1. carousel: 2 a 6. story: 1 suelta, 2 a 4 secuencia." },
    slides_plan: { type: "array", items: { type: "string" }, description: "Si slides > 1: qué dice cada imagen, en orden. Vacío si slides = 1." },
    title: { type: "string" },
    pillar: { type: "string" },
    brief: { type: "string", description: "Brief final para el diseñador (solo si listo=true)" },
  },
  required: ["reply", "listo", "kind", "slides", "slides_plan", "title", "pillar", "brief"],
  additionalProperties: false,
};

export async function chatIdea({ messages, images = [], kindPref = "auto" }) {
  const mem = await loadMemory();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const formato = kindPref === "story" ? "El formato ya está decidido: HISTORIA 1080×1920 (kind=story); vos decidís si es una suelta (slides=1) o una secuencia de 2 a 4 si la idea necesita desarrollo. No preguntes por el formato." : kindPref === "carousel" ? "El formato ya está decidido: CARRUSEL de 2 a 6 imágenes 1080×1350 (kind=carousel). Armá slides_plan con lo que dice cada imagen. No preguntes por el formato." : kindPref === "feed" ? "El formato ya está decidido: POSTEO de UNA imagen 1080×1350 (kind=feed, slides=1): la idea tiene que cerrar en una sola imagen, sin 'deslizá'. No preguntes por el formato." : "El formato lo decidís vos según la idea, sin preguntar salvo que sea ambiguo: posteo (una imagen, una idea que cierra sola), carrusel (idea en partes: lista, pasos, comparativa; 2 a 6 imágenes, poco texto por imagen), historia suelta (liviana, 3 segundos) o secuencia de historias (2 a 4, cuando hay que desarrollar algo concreto). Nunca una historia que diga 'cambió algo' sin decir qué.";
  const system = `Sos el estratega de contenido de Argencargo. Conocés el tono, la audiencia y los productos de la marca y ayudás a Bautista a llegar a UNA idea de posteo concreta. Preguntás lo mínimo (una cosa por vez), proponés, y cuando la idea está clara marcás listo=true con un brief preciso para el diseñador (qué afirmar, qué dato, qué estructura visual). ${formato} Respuestas cortas, estilo chat.

${memoriaCompleta(mem)}`;
  const msgs = messages.map((m, i) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.role !== "assistant" && i === messages.length - 1 && images.length
    ? [...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mime, data: img.b64 } })), { type: "text", text: m.content || "(imagen adjunta)" }]
    : String(m.content || "") }));
  const call = (model) => client.messages.create({ model, max_tokens: 1500, system, messages: msgs, output_config: { format: { type: "json_schema", schema: CHAT_SCHEMA } } });
  let res;
  try { res = await call(CHAT_MODEL); } catch (e) { if (e?.status === 404 || e?.status === 400) res = await call(CLAUDE_MODEL); else throw e; }
  return JSON.parse(res.content.find((b) => b.type === "text")?.text || "{}");
}

// ── 3) Cola ─────────────────────────────────────────────────────────────────
export const normKind = (k) => (k === "story" ? "story" : k === "carousel" ? "carousel" : "feed");
export function normSlides(kind, n) {
  const v = Number(n) || 1;
  if (kind === "carousel") return Math.min(7, Math.max(2, v || 4));
  if (kind === "story") return Math.min(4, Math.max(1, v));
  return 1;
}
export async function crearPiezas(ideas, { source = "manual", run_id = null } = {}) {
  const rows = ideas.map((i) => {
    const kind = normKind(i.kind);
    const slides = normSlides(kind, i.slides);
    const plan = slides > 1 && Array.isArray(i.slides_plan) ? i.slides_plan.map((s) => String(s || "").trim()).filter(Boolean).slice(0, slides) : [];
    return {
      kind, slides, slides_plan: plan.length ? plan : null,
      width: 1080, height: kind === "story" ? 1920 : 1350,
      status: "generating", source, run_id,
      pillar: i.pillar || null, title: i.title || null,
      brief: [i.brief || "", i.visual ? `Concepto visual: ${i.visual}.` : "", i.background ? `Fondo: ${i.background}.` : ""].filter(Boolean).join("\n"),
    };
  });
  const r = await sb(`/cs_pieces`, { method: "POST", body: JSON.stringify(rows) });
  return Array.isArray(r.body) ? r.body : [];
}

// mix = {feed, carousel, story}: cuántos de cada formato (el analista decide si cada historia es suelta o secuencia).
export async function runner({ count = 4, brief = null, kinds = null, mix = null, source = "runner" }) {
  if (mix) {
    kinds = [];
    for (const k of ["feed", "carousel", "story"]) for (let i = 0; i < Math.min(20, Math.max(0, Number(mix[k]) || 0)); i++) kinds.push(k);
    count = kinds.length;
  }
  if (!count) return [];
  const run = await sb(`/cs_runs`, { method: "POST", body: JSON.stringify({ kind: source, requested: count }) });
  const runId = Array.isArray(run.body) && run.body[0]?.id;
  const ideas = await planIdeas({ count, brief, kinds });
  const created = await crearPiezas(ideas, { source, run_id: runId });
  const etiqueta = (i) => i.kind === "carousel" ? `carrusel ×${i.slides || "?"}` : i.kind === "story" ? (Number(i.slides) > 1 ? `historias ×${i.slides}` : "historia") : "posteo";
  if (runId) await sb(`/cs_runs?id=eq.${runId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ created: created.length, finished_at: new Date().toISOString(), log: ideas.map((i) => `${etiqueta(i)} · ${i.pillar} · ${i.title}`).join("\n") }) });
  return created;
}

// El servidor no diseña (lo hace la Mac). Queda por compatibilidad con la cola vieja.
export async function processNext() { return { skipped: "el diseño corre en la Mac (runner local)" }; }

// ── 4) Historial automático al aprobar ───────────────────────────────────────
export async function appendHistorial(piece) {
  const mem = await loadMemory();
  const prev = memText(mem, "historial");
  const fmtKind = piece.kind === "carousel" ? `carrusel ×${piece.slides || "?"}` : piece.kind === "story" ? (Number(piece.slides) > 1 ? `secuencia de historias ×${piece.slides}` : "historia") : "posteo";
  const linea = `- ${new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)} · ${fmtKind} · ${piece.pillar || ""} · ${piece.headline || piece.title || ""}`;
  const content = `${prev.trimEnd()}\n${linea}`;
  await sb(`/cs_memory?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: "historial", title: "Historial de contenido (automático)", content, updated_at: new Date().toISOString() }) });
}

// ── 5) Instagram: conexión y publicación ────────────────────────────────────
// Dos modos: "ig_login" (API de Instagram con inicio de sesión de Instagram: token de usuario de
// Instagram, host graph.instagram.com, sin página de Facebook) y "fb" (token de página, host
// graph.facebook.com). El vigilante refresca solo el token de ig_login antes de que venza (60 días).
const igHost = (cfg) => (cfg.mode === "ig_login" ? "https://graph.instagram.com/v21.0" : "https://graph.facebook.com/v21.0");

export async function igSettings() {
  const r = await sb(`/cs_settings?key=eq.instagram&select=value`);
  return Array.isArray(r.body) && r.body[0] ? r.body[0].value : {};
}
async function igSave(cfg) {
  await sb(`/cs_settings?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: "instagram", value: cfg, updated_at: new Date().toISOString() }) });
}

export async function igTest(cfg) {
  const fields = cfg.mode === "ig_login" ? "id,username,account_type,media_count,followers_count" : "id,username,name,followers_count,media_count";
  const r = await fetch(`${igHost(cfg)}/${cfg.mode === "ig_login" ? "me" : cfg.ig_user_id}?fields=${fields}&access_token=${encodeURIComponent(cfg.access_token)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
  return j;
}

// Detecta el tipo de token y arma la configuración. Devuelve cfg listo para guardar.
export async function igConnect(token, igUserIdHint = "") {
  // 1) ¿Token de Instagram (inicio de sesión de Instagram)?
  const ri = await fetch(`https://graph.instagram.com/v21.0/me?fields=id,username,account_type&access_token=${encodeURIComponent(token)}`);
  const ji = await ri.json().catch(() => ({}));
  if (ri.ok && ji.id) {
    if (ji.account_type && !["BUSINESS", "MEDIA_CREATOR"].includes(String(ji.account_type).toUpperCase())) throw new Error(`La cuenta @${ji.username} es ${ji.account_type}: tiene que ser profesional (Empresa o Creador).`);
    return { mode: "ig_login", ig_user_id: ji.id, access_token: token, username: ji.username || null, connected_at: new Date().toISOString(), refreshed_at: new Date().toISOString() };
  }
  // 2) ¿Token de usuario de Facebook con páginas?
  const rf = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=50&access_token=${encodeURIComponent(token)}`);
  const jf = await rf.json().catch(() => ({}));
  if (!rf.ok) throw new Error(ji?.error?.message || jf?.error?.message || "Token inválido");
  const pages = Array.isArray(jf.data) ? jf.data : [];
  const conIg = pages.filter((pg) => pg.instagram_business_account?.id);
  if (!conIg.length) throw new Error(pages.length ? `Tu usuario administra ${pages.length} página(s) de Facebook pero ninguna tiene Instagram vinculado.` : "El token no ve páginas de Facebook ni una cuenta de Instagram.");
  const pg = (igUserIdHint && conIg.find((x) => x.instagram_business_account.id === igUserIdHint)) || conIg[0];
  return { mode: "fb", ig_user_id: pg.instagram_business_account.id, access_token: pg.access_token || token, page_name: pg.name, username: pg.instagram_business_account.username || null, connected_at: new Date().toISOString() };
}

// Token de ig_login: dura 60 días; se refresca si tiene más de 30.
async function igRefreshIfNeeded(cfg) {
  if (cfg.mode !== "ig_login") return cfg;
  const age = Date.now() - new Date(cfg.refreshed_at || cfg.connected_at || 0).getTime();
  if (age < 30 * 86400000) return cfg;
  try {
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(cfg.access_token)}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.access_token) { const nc = { ...cfg, access_token: j.access_token, refreshed_at: new Date().toISOString() }; await igSave(nc); return nc; }
    console.error("[studio] refresh token IG", JSON.stringify(j).slice(0, 200));
  } catch (e) { console.error("[studio] refresh", e.message); }
  return cfg;
}

// Imágenes de una pieza en orden (portada primero). Piezas viejas: solo image_url.
export const slideUrls = (piece) => {
  const imgs = Array.isArray(piece.images) ? piece.images.map((x) => (typeof x === "string" ? x : x?.url)).filter(Boolean) : [];
  return imgs.length ? imgs : piece.image_url ? [piece.image_url] : [];
};

async function igContainer(cfg, params) {
  const c = await fetch(`${igHost(cfg)}/${cfg.ig_user_id}/media`, { method: "POST", body: new URLSearchParams({ ...params, access_token: cfg.access_token }) });
  const cj = await c.json().catch(() => ({}));
  if (!c.ok || !cj.id) throw new Error(cj?.error?.message || `contenedor HTTP ${c.status}`);
  for (let i = 0; i < 12; i++) {
    const s = await fetch(`${igHost(cfg)}/${cj.id}?fields=status_code&access_token=${encodeURIComponent(cfg.access_token)}`);
    const sj = await s.json().catch(() => ({}));
    if (sj.status_code === "FINISHED") break;
    if (sj.status_code === "ERROR" || sj.status_code === "EXPIRED") throw new Error("Instagram no pudo procesar la imagen");
    await new Promise((r) => setTimeout(r, 3000));
  }
  return cj.id;
}
async function igPublishContainer(cfg, creationId) {
  const p = await fetch(`${igHost(cfg)}/${cfg.ig_user_id}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: creationId, access_token: cfg.access_token }) });
  const pj = await p.json().catch(() => ({}));
  if (!p.ok || !pj.id) throw new Error(pj?.error?.message || `publicación HTTP ${p.status}`);
  return pj.id;
}

// Publica una pieza según su formato:
//   posteo   → 1 contenedor de imagen con caption
//   carrusel → N contenedores hijos (is_carousel_item) + 1 contenedor CAROUSEL con caption
//   historia → 1 contenedor STORIES por imagen, en orden (una secuencia sale como historias consecutivas)
export async function igPublish(piece, cfg) {
  const urls = slideUrls(piece);
  if (!urls.length) throw new Error("La pieza no tiene imagen");
  const caption = `${piece.caption || ""}\n\n${piece.hashtags || ""}`.trim();
  if (piece.kind === "story") {
    const ids = [];
    for (const u of urls) ids.push(await igPublishContainer(cfg, await igContainer(cfg, { image_url: u, media_type: "STORIES" })));
    return ids.join(",");
  }
  if (piece.kind === "carousel" && urls.length > 1) {
    const children = [];
    for (const u of urls) children.push(await igContainer(cfg, { image_url: u, is_carousel_item: "true" }));
    const cid = await igContainer(cfg, { media_type: "CAROUSEL", children: children.join(","), caption });
    return igPublishContainer(cfg, cid);
  }
  return igPublishContainer(cfg, await igContainer(cfg, { image_url: urls[0], caption }));
}

// El vigilante: publica lo programado cuya hora ya pasó.
export async function publicarPendientes() {
  let cfg = await igSettings();
  if (!cfg.ig_user_id || !cfg.access_token) return { skipped: "Instagram sin conectar" };
  cfg = await igRefreshIfNeeded(cfg);
  const r = await sb(`/cs_pieces?status=eq.scheduled&scheduled_at=lte.${new Date().toISOString()}&image_url=not.is.null&select=*&order=scheduled_at.asc&limit=3`);
  const out = [];
  for (const piece of Array.isArray(r.body) ? r.body : []) {
    try {
      const id = await igPublish(piece, cfg);
      await sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "published", published_at: new Date().toISOString(), ig_media_id: id, publish_error: null }) });
      out.push({ id: piece.id, ok: true });
    } catch (e) {
      await sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ publish_error: String(e.message).slice(0, 300) }) });
      out.push({ id: piece.id, error: e.message });
    }
  }
  return { publicadas: out };
}
