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
import { tgNotify, logUso, costoClaude, reportarErrorApi } from "./telegram";

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

// Borra archivos del bucket content-studio (rutas relativas al bucket). Silencioso si fallan.
export async function deleteStorage(paths) {
  const ps = (paths || []).filter(Boolean);
  if (!ps.length) return;
  try { await fetch(`${SB_URL}/storage/v1/object/content-studio`, { method: "DELETE", headers: { Authorization: `Bearer ${SB_SERVICE}`, apikey: SB_SERVICE, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: ps }) }); }
  catch (e) { console.error("[studio] deleteStorage", e.message); }
}
const storagePath = (url) => { const m = String(url || "").match(/\/object\/public\/content-studio\/(.+)$/); return m ? decodeURIComponent(m[1]) : null; };
// Borra las imágenes de una pieza (portada + slides) y deja la fila sin imágenes. Libera espacio al rechazar o al rehacer.
export async function borrarImagenesPieza(piece, { limpiarFila = true, incluirFoto = true } = {}) {
  const urls = new Set([piece.image_url, ...(Array.isArray(piece.images) ? piece.images.map((x) => (typeof x === "string" ? x : x?.url)) : []), incluirFoto ? piece.photo_url : null].filter(Boolean));
  await deleteStorage([...urls].map(storagePath));
  if (limpiarFila && piece.id) await sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ image_url: null, images: null, ...(incluirFoto ? { photo_url: null } : {}) }) });
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
  { key: "aprendizajes", title: "Aprendizajes (lo que Bautista corrige, automático)", file: "knowledge/aprendizajes.md" },
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
  const r = await sb(`/cs_pieces?status=in.(approved,scheduled,published)&kind=neq.blog&select=id,kind,title,headline,html,image_url,approved_at&order=approved_at.desc.nullslast&limit=${n}`);
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
export async function detalleNoticias(items, { max = 6, chars = 1800 } = {}) {
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
  catch (e) { if (model !== CLAUDE_MODEL && (e?.status === 404 || e?.status === 400)) res = await call(CLAUDE_MODEL); else { reportarErrorApi("claude", e); throw e; } }
  try { const u = res.usage || {}; logUso({ provider: "claude", model: res.model || model, feature: "studio-analista", input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0, cost_usd: costoClaude(res.model || model, u.input_tokens || 0, u.output_tokens || 0) }); } catch {}
  return JSON.parse(res.content.find((b) => b.type === "text")?.text || "{}");
}

const HOY_AR = () => new Date(Date.now() - 3 * 3600 * 1000);
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Reglas de fotos reales (las lee el analista, el chatbot y el decisor de fotos de piezas directas).
const REGLAS_FOTO = `FOTOS REALES (el sistema genera la foto con IA a partir de tu pedido; vos decidís cuándo y cuál):
- Estilo Magforce: la foto va a pantalla completa en la PORTADA y el titular se pone encima en diseño. La foto NUNCA lleva texto, letras, números ni carteles: eso lo agrega el diseñador. En un carrusel solo la portada lleva foto.
- Cuándo sí: posteos y portadas de carrusel donde una escena real suma (una operación, un avión, cajas, un depósito, una persona con el celular mirando su seguimiento, el puerto, la ciudad). Historias: solo las de rutina o emoción (buena semana, buen finde) y no todas.
- Cuándo no: piezas de números, checklists, comparativas, mito vs realidad, listas: ahí el diseño tipográfico rinde más. Aproximadamente la MITAD de los posteos/carruseles de cada tanda con foto, la otra mitad solo diseño. Nunca todas con gente: variá objetos, lugares, detalles, planos cerrados.
- Marca en la foto (photo_brand=true) en 1 de cada 3 fotos como mucho: cajas de cartón con el logo de Argencargo, avión de carga con el logo en el fuselaje, chaleco o remera con el logo, cartel en el depósito. El sistema le pasa el logo real al modelo. El resto, escenas neutras sin marca.
- El pedido (photo_prompt) va en inglés y describe: sujeto, escenario, luz (natural, golden hour, luz de depósito), cámara (35mm, shallow depth of field), paleta (navy blue and white accents, clean), y sobre todo la COMPOSICIÓN con espacio libre para el texto: decí de qué lado va el sujeto y qué zona queda despejada (un tercio limpio, cielo, pared lisa). Vertical (4:5 en posteos, 9:16 en historias). Cerrá siempre con: "no text, no letters, no numbers, no watermark".
- Realismo: fotografía comercial editorial, nada de ilustración, nada de look de render ni de stock trillado; personas de espaldas, manos o planos medios antes que caras en primer plano.`;

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
          photo: { type: "boolean", description: "true si la portada lleva una FOTO REAL generada con IA como fondo (ver reglas de fotos). false = solo diseño." },
          photo_brand: { type: "boolean", description: "Solo si photo=true: true si en la foto aparece la marca en objetos (cajas con el logo, avión con el logo, uniforme). false = escena neutra sin marca." },
          photo_prompt: { type: "string", description: "Solo si photo=true: el pedido de la foto EN INGLÉS, 2 a 4 frases: sujeto, escenario, luz, cámara/lente, paleta (navy blue and white accents), y la composición con el espacio libre para el texto ('subject on the right, clean uncluttered sky on the upper-left third for typography'). Vertical. Sin texto ni letras en la foto. Vacío si photo=false." },
        },
        required: ["kind", "slides", "slides_plan", "pillar", "title", "brief", "visual", "background", "photo", "photo_brand", "photo_prompt"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

export async function planIdeas({ count = 4, kinds = null, brief = null, memory = null }) {
  const mem = memory || await loadMemory();
  const [radar0, datos, competencia, recientes] = await Promise.all([
    radarReciente(12), datosSistema(), competenciaReciente(),
    sb(`/cs_pieces?status=in.(review,approved,scheduled,published,rejected,generating)&select=title,kind,pillar,headline,brief,created_at&order=created_at.desc&limit=60`),
  ]);
  const conDetalle = await detalleNoticias(radar0);
  let rendimiento = ""; try { const { rendimientoPropioTexto } = await import("./ig-insights"); rendimiento = await rendimientoPropioTexto(); } catch {}
  const radar = radar0.map((x) => conDetalle.find((d) => d.url === x.url) || x);
  const hoy = HOY_AR();
  const dia = DIAS[hoy.getUTCDay()];
  const recs = Array.isArray(recientes.body) ? recientes.body : [];
  const estado = (s) => (s === "rejected" ? "descartada" : ["approved", "scheduled", "published"].includes(s) ? "aprobada" : "en revisión");
  const ultimas = recs.map((p) => `- [${p.kind}/${p.pillar || "?"} · ${estado(p.status)}] ${p.headline || p.title}${p.brief ? ` — ${String(p.brief).slice(0, 90)}` : ""}`).join("\n") || "(ninguna todavía)";
  const hace7 = Date.now() - 7 * 86400000;
  const datosUsados = recs.filter((p) => new Date(p.created_at).getTime() > hace7).map((p) => `${p.headline || ""} ${p.brief || ""}`).join(" ");
  const yaUsoKg = /kg|kilo/i.test(datosUsados), yaUsoVuelos = /vuelos? en tr/i.test(datosUsados), yaUsoEntregas = /entregad/i.test(datosUsados);
  const system = `Sos el analista de contenido de Argencargo: un creativo con oficio, no un generador de plantillas. Proponés ideas de posts e historias que respetan a rajatabla la memoria de marca y que NO se parecen entre sí ni a lo ya hecho.

TONO POR FORMATO: posteos y carruseles formales y serios (pueden abrir con un gancho fuerte, pero el conjunto es de empresa seria); historias más descontracturadas, sin exagerar.
APRENDIZAJES: en aprendizajes.md están las correcciones de Bautista a piezas anteriores. Son ley: no repitas ninguno de esos errores.

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
${REGLAS_FOTO}

- COMPETENCIA: abajo tenés lo que publicaron otras cuentas del rubro y qué les funcionó. Es un termómetro de ángulos y formatos, NO una fuente para copiar: si un tema les rindió, buscá NUESTRA versión con otro enfoque, otro texto y otro diseño. PROHIBIDO reutilizar sus titulares, ganchos o frases reconocibles, ni parafraseados (si ellos dijeron "¿sos importador o contrabandista?", nosotros no hacemos una pieza sobre eso con otras palabras: buscamos otra entrada al mismo tema o dejamos pasar el tema). Jamás se los nombra ni se los alude. Copiar a un competidor es un problema legal y de reputación.

${memoriaCompleta(mem)}`;
  const user = `HOY es ${dia} ${hoy.toISOString().slice(0, 10)} (Argentina).

DATOS REALES DEL SISTEMA (usalos si sirven, sin inventar otros):
${JSON.stringify(datos)}

NOTICIAS DEL RADAR (últimos 7 días; las que tienen DETALLE son las únicas que sirven para una pieza de noticia):
${radar.map((x) => `- ${x.title} (${x.source_name})${x.detalle ? `\n  DETALLE: ${x.detalle}` : ""}`).join("\n") || "(nada nuevo)"}

${rendimiento ? `${rendimiento}\nUsalo: más de lo que rinde (formato, tema, tipo de gancho), menos de lo que no.\n\n` : ""}LO QUE PUBLICÓ LA COMPETENCIA (últimos 10 días, ordenado por interacción; inspirarse en el ángulo, nunca copiar):
${competencia.map((c) => `- @${c.username} · ${c.analysis?.formato || c.media_type} · ${c.like_count ?? "?"} likes · tema: ${c.analysis?.tema || ""} · gancho: ${c.analysis?.gancho || ""} · visual: ${c.analysis?.concepto_visual || ""} · idea propia sugerida: ${c.analysis?.idea_argencargo || ""}`).join("\n") || "(sin radar de competencia todavía)"}

PIEZAS RECIENTES (no repetir tema, titular ni estructura). Ojo: "descartada" no significa que estuvo mal; Bautista elige pocas por tanda y descarta el resto, muchas veces porque el tema ya quedó cubierto. Tratalas igual que las aprobadas: tema usado, no volver.
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
    photo: { type: "boolean", description: "true si la portada lleva una foto real generada con IA (según las reglas de fotos)" },
    photo_brand: { type: "boolean", description: "Si photo=true: la marca aparece en objetos de la foto" },
    photo_prompt: { type: "string", description: "Si photo=true: pedido de la foto en inglés (sujeto, escena, luz, composición con espacio libre para el texto, sin texto). Vacío si no." },
  },
  required: ["reply", "listo", "kind", "slides", "slides_plan", "title", "pillar", "brief", "photo", "photo_brand", "photo_prompt"],
  additionalProperties: false,
};

export async function chatIdea({ messages, images = [], kindPref = "auto" }) {
  const mem = await loadMemory();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const formato = kindPref === "story" ? "El formato ya está decidido: HISTORIA 1080×1920 (kind=story); vos decidís si es una suelta (slides=1) o una secuencia de 2 a 4 si la idea necesita desarrollo. No preguntes por el formato." : kindPref === "carousel" ? "El formato ya está decidido: CARRUSEL de 2 a 6 imágenes 1080×1350 (kind=carousel). Armá slides_plan con lo que dice cada imagen. No preguntes por el formato." : kindPref === "feed" ? "El formato ya está decidido: POSTEO de UNA imagen 1080×1350 (kind=feed, slides=1): la idea tiene que cerrar en una sola imagen, sin 'deslizá'. No preguntes por el formato." : "El formato lo decidís vos según la idea, sin preguntar salvo que sea ambiguo: posteo (una imagen, una idea que cierra sola), carrusel (idea en partes: lista, pasos, comparativa; 2 a 6 imágenes, poco texto por imagen), historia suelta (liviana, 3 segundos) o secuencia de historias (2 a 4, cuando hay que desarrollar algo concreto). Nunca una historia que diga 'cambió algo' sin decir qué.";
  const system = `Sos el estratega de contenido de Argencargo. Conocés el tono, la audiencia y los productos de la marca y ayudás a Bautista a llegar a UNA idea de posteo concreta. Preguntás lo mínimo (una cosa por vez), proponés, y cuando la idea está clara marcás listo=true con un brief preciso para el diseñador (qué afirmar, qué dato, qué estructura visual). ${formato} Respuestas cortas, estilo chat. Si Bautista pide una foto real o la idea la merece, completá photo/photo_brand/photo_prompt según estas reglas:
${REGLAS_FOTO}

${memoriaCompleta(mem)}`;
  const msgs = messages.map((m, i) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.role !== "assistant" && i === messages.length - 1 && images.length
    ? [...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mime, data: img.b64 } })), { type: "text", text: m.content || "(imagen adjunta)" }]
    : String(m.content || "") }));
  const call = (model) => client.messages.create({ model, max_tokens: 1500, system, messages: msgs, output_config: { format: { type: "json_schema", schema: CHAT_SCHEMA } } });
  let res;
  try { res = await call(CHAT_MODEL); } catch (e) { if (e?.status === 404 || e?.status === 400) res = await call(CLAUDE_MODEL); else { reportarErrorApi("claude", e); throw e; } }
  try { const u = res.usage || {}; logUso({ provider: "claude", model: res.model || CHAT_MODEL, feature: "studio-chat", input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0, cost_usd: costoClaude(res.model || CHAT_MODEL, u.input_tokens || 0, u.output_tokens || 0) }); } catch {}
  return JSON.parse(res.content.find((b) => b.type === "text")?.text || "{}");
}

// ── 3) Cola ─────────────────────────────────────────────────────────────────
export const normKind = (k) => (k === "story" ? "story" : k === "carousel" ? "carousel" : k === "blog" ? "blog" : "feed");
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
    const photo = !!i.photo && String(i.photo_prompt || "").trim().length > 10;
    return {
      kind, slides: kind === "blog" ? 1 : slides, slides_plan: kind === "blog" ? null : (plan.length ? plan : null),
      material: i.material ? String(i.material).slice(0, 12000) : null,
      photo_prompt: photo ? String(i.photo_prompt).trim().slice(0, 1500) : null, photo_brand: photo && !!i.photo_brand, photo_url: null,
      width: kind === "blog" ? 1200 : 1080, height: kind === "blog" ? 630 : kind === "story" ? 1920 : 1350,
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
    for (const k of ["feed", "carousel", "story"]) for (let i = 0; i < Math.min(30, Math.max(0, Number(mix[k]) || 0)); i++) kinds.push(k);
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

// Decide si una pieza directa (sin analista) lleva foto y escribe el pedido.
const FOTO_SCHEMA = { type: "object", properties: { photo: { type: "boolean" }, photo_brand: { type: "boolean" }, photo_prompt: { type: "string" } }, required: ["photo", "photo_brand", "photo_prompt"], additionalProperties: false };
export async function decidirFoto({ brief, kind, title }) {
  try {
    const out = await claudeJson({ system: `Sos el analista de contenido de Argencargo. Decidís si esta pieza lleva foto real y, si sí, escribís el pedido.\n${REGLAS_FOTO}`, user: `Pieza: ${kind === "story" ? "historia" : kind === "carousel" ? "carrusel" : "posteo"} · ${title || ""}\nBrief: ${brief}`, schema: FOTO_SCHEMA, max_tokens: 600 });
    return { photo: !!out.photo, photo_brand: !!out.photo_brand, photo_prompt: String(out.photo_prompt || "") };
  } catch (e) { console.error("[studio] decidirFoto", e.message); return { photo: false, photo_brand: false, photo_prompt: "" }; }
}

// ── Fotos reales con fal.ai ──────────────────────────────────────────────────
// Marca en objetos → Nano Banana Pro (edit) con los logos como referencia; escena neutra → Flux 2 Pro.
const FAL_BRAND = "fal-ai/nano-banana-pro/edit";
const FAL_SCENE = "fal-ai/flux-2-pro";
export async function generarFoto(piece, { nota = "" } = {}) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY no configurada en Vercel");
  const base = String(piece.photo_prompt || "").trim();
  if (!base) throw new Error("La pieza no tiene pedido de foto");
  const story = piece.kind === "story";
  const extra = ` Photorealistic editorial commercial photograph, natural light, high detail, vertical composition, no text, no letters, no numbers, no watermark.${nota ? ` Adjustment requested by the client: ${nota}.` : ""}`;
  let endpoint, body;
  if (piece.photo_brand) {
    endpoint = FAL_BRAND;
    body = { prompt: `${base}${extra} Use the exact Argencargo logo from the reference images wherever the brand appears (printed on boxes, aircraft, vest or sign); keep the logo shape and colors exactly as in the reference, do not redraw it.`, image_urls: [`${BASE_URL}/brand/logo-completo.png`, `${BASE_URL}/brand/isotipo.png`], aspect_ratio: story ? "9:16" : "4:5", resolution: "1K", output_format: "jpeg", num_images: 1 };
  } else {
    endpoint = FAL_SCENE;
    body = { prompt: `${base}${extra}`, image_size: story ? { width: 1080, height: 1920 } : { width: 1080, height: 1350 }, output_format: "jpeg", safety_tolerance: 2 };
  }
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 110000);
  let r, j;
  try {
    r = await fetch(`https://fal.run/${endpoint}`, { method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    j = await r.json().catch(() => ({}));
  } finally { clearTimeout(tm); }
  if (!r.ok) { const err = new Error(`fal ${r.status}: ${JSON.stringify(j).slice(0, 200)}`); err.status = r.status; reportarErrorApi("fal", err); throw err; }
  const url = j?.images?.[0]?.url;
  if (!url) throw new Error("fal no devolvió imagen");
  const img = await fetch(url);
  if (!img.ok) throw new Error(`no se pudo bajar la foto (${img.status})`);
  const buf = Buffer.from(await img.arrayBuffer());
  const stored = await uploadStorage(`fotos/${piece.id}-${Date.now()}.jpg`, buf, "image/jpeg");
  if (piece.photo_url) await deleteStorage([storagePath(piece.photo_url)]);
  // Costo estimado según tarifa de fal.ai: Nano Banana Pro 1K ≈ USD 0,15 por imagen; Flux 2 Pro ≈ USD 0,03 por megapixel.
  const costo = piece.photo_brand ? 0.15 : Math.round(0.03 * ((story ? 1080 * 1920 : 1080 * 1350) / 1e6) * 1000) / 1000;
  logUso({ provider: "fal", model: endpoint, feature: piece.photo_brand ? "foto-marca" : "foto-escena", cost_usd: costo });
  const cur = await sb(`/cs_pieces?id=eq.${piece.id}&select=photo_cost_usd,photos_generated`);
  const c0 = Array.isArray(cur.body) && cur.body[0] ? cur.body[0] : {};
  await sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ photo_url: stored, photo_model: endpoint, photo_note: nota || null, photo_cost_usd: Math.round((Number(c0.photo_cost_usd || 0) + costo) * 10000) / 10000, photos_generated: Number(c0.photos_generated || 0) + 1, updated_at: new Date().toISOString() }) });
  return stored;
}

// Estado general para el panel del Runner: cola, Mac, mes, fotos y costo, radar.
export async function estadoEstudio() {
  const inicioMes = new Date(); inicioMes.setUTCDate(1); inicioMes.setUTCHours(3, 0, 0, 0); // 00:00 AR del día 1
  const desde = inicioMes.toISOString();
  const [mes, cola, hb, comps, disc] = await Promise.all([
    sb(`/cs_pieces?created_at=gte.${desde}&select=status,kind,source,photo_url,photos_generated,photo_cost_usd`),
    sb(`/cs_pieces?status=eq.generating&select=id,locked_at`),
    sb(`/cs_settings?key=eq.runner_heartbeat&select=value`),
    loadCompetitors(), igDiscoverySettings(),
  ]);
  const rows = Array.isArray(mes.body) ? mes.body : [];
  const n = (f) => rows.filter(f).length;
  const colaRows = Array.isArray(cola.body) ? cola.body : [];
  const ultimoRadar = Math.max(0, ...comps.map((c) => (c.last_checked_at ? new Date(c.last_checked_at).getTime() : 0)));
  return {
    mes: {
      propuestas: rows.length, aprobadas: n((r) => ["approved", "scheduled", "published"].includes(r.status)), publicadas: n((r) => r.status === "published"),
      descartadas: n((r) => r.status === "rejected"), en_revision: n((r) => r.status === "review"),
      posteos: n((r) => r.kind === "feed"), carruseles: n((r) => r.kind === "carousel"), historias: n((r) => r.kind === "story"),
      fotos: rows.reduce((a, r) => a + Number(r.photos_generated || 0), 0), costo_fotos_usd: Math.round(rows.reduce((a, r) => a + Number(r.photo_cost_usd || 0), 0) * 100) / 100,
    },
    cola: { total: colaRows.length, en_curso: colaRows.filter((r) => r.locked_at && Date.now() - new Date(r.locked_at).getTime() < 15 * 60000).length },
    mac: { last_seen_at: Array.isArray(hb.body) && hb.body[0] ? hb.body[0].value?.last_seen_at || null : null },
    radar: { conectado: !!(disc.ig_user_id && disc.access_token), cuentas: comps.filter((c) => c.active !== false).length, ultimo: ultimoRadar ? new Date(ultimoRadar).toISOString() : null },
  };
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

// Aprendizajes: cada descarte con comentario o cambio pedido se anota; el analista y el diseñador lo leen.
export async function appendAprendizaje(piece, tipo, texto) {
  const nota = String(texto || "").trim();
  if (!nota) return;
  const mem = await loadMemory();
  const prev = memText(mem, "aprendizajes");
  const fmtKind = piece.kind === "carousel" ? "carrusel" : piece.kind === "story" ? "historia" : "posteo";
  const linea = `- ${new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)} · ${tipo} · ${fmtKind} "${(piece.headline || piece.title || "").slice(0, 70)}": ${nota.slice(0, 600)}`;
  // Se conservan las últimas 120 líneas de reglas para que no crezca sin fin.
  const lines = prev.split("\n");
  const idx = lines.findIndex((l) => l.startsWith("## Reglas"));
  const head = idx >= 0 ? lines.slice(0, idx + 1) : lines;
  const bullets = (idx >= 0 ? lines.slice(idx + 1) : []).filter((l) => l.trim());
  const content = [...head, ...bullets, linea].slice(0, head.length + 120).join("\n");
  await sb(`/cs_memory?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: "aprendizajes", title: "Aprendizajes (lo que Bautista corrige, automático)", content, updated_at: new Date().toISOString() }) });
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
  let pages = Array.isArray(jf.data) ? jf.data : [];
  // Algunas cuentas (administradas desde un portafolio comercial) devuelven me/accounts vacío aunque
  // el permiso incluya páginas: se leen los IDs concedidos (granular_scopes) y se consulta cada página.
  if (!pages.length) {
    try {
      const d = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`);
      const dj = await d.json().catch(() => ({}));
      const ids = (dj?.data?.granular_scopes || []).filter((g) => g.scope === "pages_show_list").flatMap((g) => g.target_ids || []);
      for (const id of [...new Set(ids)]) {
        const rp = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`);
        const pj = await rp.json().catch(() => ({}));
        if (rp.ok && pj.id) pages.push(pj);
      }
    } catch {}
  }
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

// ── 6) Radar de competencia ─────────────────────────────────────────────────
// Business Discovery de Meta: solo funciona con un token de FACEBOOK (página vinculada a la cuenta
// de Instagram). La conexión para publicar (ig_login) queda aparte; acá se guarda un segundo token
// en cs_settings 'instagram_discovery'. Un cron SEMANAL (domingos 22:00 AR) baja los últimos posts de cada competidor
// (cs_competitors → cs_competitor_posts) y Claude mira cada imagen y anota qué se puede aprender.
export async function igDiscoverySettings() {
  const r = await sb(`/cs_settings?key=eq.instagram_discovery&select=value`);
  return Array.isArray(r.body) && r.body[0] ? r.body[0].value : {};
}
export async function loadCompetitors() {
  const r = await sb(`/cs_competitors?select=*&order=created_at.asc`);
  return Array.isArray(r.body) ? r.body : [];
}
export const normUsername = (s) => String(s || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").replace(/^@/, "").toLowerCase();

export async function discoverAccount(cfg, username) {
  const fields = `business_discovery.username(${username}){id,username,name,followers_count,media_count,media.limit(20){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{media_url,media_type}}}`;
  const r = await fetch(`https://graph.facebook.com/v21.0/${cfg.ig_user_id}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(cfg.access_token)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
  return j.business_discovery || null;
}

const ANALISIS_SCHEMA = {
  type: "object",
  properties: {
    formato: { type: "string", enum: ["posteo", "carrusel", "reel", "otro"] },
    tema: { type: "string", description: "De qué habla, en una línea" },
    gancho: { type: "string", description: "El titular o la frase que engancha, tal como aparece (o resumida)" },
    concepto_visual: { type: "string", description: "Cómo está resuelto visualmente: foto real / diseño tipográfico / captura / persona a cámara / infografía, colores, composición" },
    texto_en_imagen: { type: "string", description: "Cuánto texto hay en la imagen y cómo está distribuido (si es carrusel, cómo reparte el texto entre imágenes)" },
    por_que_funciona: { type: "string", description: "Por qué puede funcionar con el público (o por qué no), en 1 o 2 frases" },
    idea_argencargo: { type: "string", description: "Una idea PROPIA para Argencargo que aprende del ángulo pero entra por otro lado: otro gancho, otro texto, otra estructura visual. Nunca el mismo titular ni una paráfrasis, nunca aludir a la otra marca. Si el gancho de ellos es muy reconocible, proponé una entrada distinta al mismo tema. Qué decir y cómo mostrarlo, 2 a 4 frases" },
    formato_sugerido: { type: "string", enum: ["feed", "carousel", "story"] },
    puntaje: { type: "integer", description: "1 a 5: qué tan aprovechable es el ángulo para Argencargo" },
  },
  required: ["formato", "tema", "gancho", "concepto_visual", "texto_en_imagen", "por_que_funciona", "idea_argencargo", "formato_sugerido", "puntaje"],
  additionalProperties: false,
};

// Mira las imágenes del post (por URL) y devuelve el análisis.
export async function analizarPostCompetencia(post, memory = null) {
  const mem = memory || await loadMemory();
  const urls = [];
  if (post.media_type === "CAROUSEL_ALBUM" && Array.isArray(post.children)) for (const ch of post.children) { if (ch?.media_url && ch.media_type !== "VIDEO") urls.push(ch.media_url); }
  if (!urls.length) urls.push(post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url);
  // El CDN de Instagram bloquea la descarga por URL desde Anthropic (robots.txt): se bajan acá y van en base64.
  const imgs = [];
  for (const u of urls.filter(Boolean).slice(0, 6)) {
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(u, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0" } });
      clearTimeout(tm);
      if (!r.ok) continue;
      const mime = (r.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
      if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 4.5 * 1024 * 1024) continue;
      imgs.push({ type: "image", source: { type: "base64", media_type: mime, data: buf.toString("base64") } });
    } catch {}
  }
  if (!imgs.length) throw new Error("no se pudo bajar la imagen");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system = `Sos el analista de contenido de Argencargo (courier e importación desde China, Argentina). Mirás un post de otra cuenta del rubro para aprender ángulos y formatos. Respondés en español rioplatense, concreto. Conocés la marca:\n\n${memText(mem, "identidad").slice(0, 2500)}\n\n${memText(mem, "dos-and-donts").slice(0, 2000)}`;
  const texto = `Post de @${post.username} (${post.media_type}${post.media_type === "CAROUSEL_ALBUM" ? `, carrusel de ${Array.isArray(post.children) ? post.children.length : "?"} imágenes; ves ${imgs.length}, en orden` : ""}) · ${post.like_count ?? "?"} likes · ${post.comments_count ?? "?"} comentarios · ${post.posted_at ? String(post.posted_at).slice(0, 10) : ""}\nCaption: ${(post.caption || "(sin caption)").slice(0, 1200)}\n\nAnalizalo.`;
  const call = (model) => client.messages.create({ model, max_tokens: 1200, system, messages: [{ role: "user", content: [...imgs, { type: "text", text: texto }] }], output_config: { format: { type: "json_schema", schema: ANALISIS_SCHEMA } } });
  let res;
  try { res = await call(CHAT_MODEL); } catch (e) { if (e?.status === 404 || e?.status === 400) res = await call(CLAUDE_MODEL); else { reportarErrorApi("claude", e); throw e; } }
  try { const u = res.usage || {}; logUso({ provider: "claude", model: res.model || CHAT_MODEL, feature: "radar-competencia", input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0, cost_usd: costoClaude(res.model || CHAT_MODEL, u.input_tokens || 0, u.output_tokens || 0) }); } catch {}
  return JSON.parse(res.content.find((b) => b.type === "text")?.text || "{}");
}

// Corre el radar: baja los últimos posts de cada cuenta activa y analiza los que faltan.
export async function radarCompetencia({ analizar = 12, minDias = 0 } = {}) {
  const cfg = await igDiscoverySettings();
  if (!cfg.ig_user_id || !cfg.access_token) return { skipped: "Radar de competencia sin conectar (hace falta el token de Facebook en Conexión)" };
  const comps = (await loadCompetitors()).filter((c) => c.active !== false);
  if (minDias > 0) {
    const ultimo = Math.max(0, ...comps.map((c) => (c.last_checked_at && !c.error ? new Date(c.last_checked_at).getTime() : 0)));
    if (ultimo && Date.now() - ultimo < minDias * 86400000) return { skipped: `ya se revisó hace ${Math.round((Date.now() - ultimo) / 3600000)} h (mínimo ${minDias} días entre corridas)` };
  }
  const out = { cuentas: 0, nuevos: 0, analizados: 0, errores: [] };
  const now = new Date().toISOString();
  for (const c of comps) {
    try {
      const bd = await discoverAccount(cfg, c.username);
      if (!bd?.id) throw new Error("Instagram no devolvió la cuenta (¿es profesional?)");
      // Solo publicaciones (imagen o carrusel): los reels no se miran.
      const media = (Array.isArray(bd.media?.data) ? bd.media.data : []).filter((m) => m.media_type === "IMAGE" || m.media_type === "CAROUSEL_ALBUM");
      const ex = await sb(`/cs_competitor_posts?username=eq.${encodeURIComponent(c.username)}&select=ig_media_id`);
      const yaVistos = new Set((Array.isArray(ex.body) ? ex.body : []).map((x) => x.ig_media_id));
      const rows = media.map((m) => ({
        username: c.username, ig_media_id: m.id, media_type: m.media_type || null, caption: String(m.caption || "").slice(0, 2000),
        media_url: m.media_url || null, thumbnail_url: m.thumbnail_url || null, permalink: m.permalink || null,
        children: Array.isArray(m.children?.data) ? m.children.data : null, like_count: m.like_count ?? null, comments_count: m.comments_count ?? null, posted_at: m.timestamp || null,
      }));
      if (rows.length) await sb(`/cs_competitor_posts?on_conflict=ig_media_id`, { method: "POST", body: JSON.stringify(rows) });
      out.nuevos += rows.filter((r) => !yaVistos.has(r.ig_media_id)).length;
      await sb(`/cs_competitors?id=eq.${c.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ig_user_id: bd.id, name: bd.name || c.name, followers_count: bd.followers_count ?? null, media_count: bd.media_count ?? null, last_checked_at: now, error: null }) });
      out.cuentas++;
    } catch (e) {
      out.errores.push(`@${c.username}: ${e.message}`);
      await sb(`/cs_competitors?id=eq.${c.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_checked_at: now, error: String(e.message).slice(0, 300) }) });
    }
  }
  if (analizar > 0) out.analizados = await analizarPendientesCompetencia(analizar);
  const rest = await sb(`/cs_competitor_posts?analysis=is.null&media_type=neq.VIDEO&select=id`);
  out.pendientes = Array.isArray(rest.body) ? rest.body.length : 0;
  return out;
}

// Analiza hasta N posts sin análisis. El vigilante (cron de cada minuto) va llamando de a pocos
// hasta vaciar la cola, así una primera tanda grande queda lista en una hora sin bloquear nada.
export async function analizarPendientesCompetencia(max = 3) {
  const pend = await sb(`/cs_competitor_posts?analysis=is.null&media_type=neq.VIDEO&select=*&order=posted_at.desc.nullslast&limit=${max}`);
  const rows = Array.isArray(pend.body) ? pend.body : [];
  if (!rows.length) return 0;
  const mem = await loadMemory();
  let ok = 0;
  for (const p of rows) {
    let analysis;
    try { analysis = await analizarPostCompetencia(p, mem); ok++; } catch (e) { analysis = { error: String(e.message).slice(0, 200) }; }
    await sb(`/cs_competitor_posts?id=eq.${p.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ analysis, analyzed_at: new Date().toISOString() }) });
  }
  return ok;
}

// Para el analista: lo mejor que publicó la competencia en los últimos días (con análisis).
export async function competenciaReciente(days = 10, n = 25) {
  try {
    const desde = new Date(Date.now() - days * 86400000).toISOString();
    const r = await sb(`/cs_competitor_posts?analysis=not.is.null&posted_at=gte.${desde}&select=username,media_type,like_count,comments_count,posted_at,analysis&order=like_count.desc.nullslast&limit=${n}`);
    return (Array.isArray(r.body) ? r.body : []).filter((p) => p.analysis && !p.analysis.error);
  } catch { return []; }
}

// ── Facebook: la misma pieza sale también en la página (token del radar con pages_manage_posts) ──
// Posteo → foto con texto; carrusel → publicación con varias fotos; historia → historia de la página.
const FB = "https://graph.facebook.com/v21.0";
async function fbPost(path, params) {
  const r = await fetch(`${FB}/${path}`, { method: "POST", body: new URLSearchParams(params) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Facebook HTTP ${r.status}`);
  return j;
}
export async function fbPublish(piece, cfg) {
  const page = cfg.page_id; const token = cfg.access_token;
  if (!page || !token) throw new Error("Facebook sin página conectada");
  const urls = slideUrls(piece);
  if (!urls.length) throw new Error("La pieza no tiene imagen");
  const message = `${piece.caption || ""}\n\n${piece.hashtags || ""}`.trim();
  if (piece.kind === "story") {
    const ids = [];
    for (const u of urls) {
      const ph = await fbPost(`${page}/photos`, { url: u, published: "false", access_token: token });
      const st = await fbPost(`${page}/photo_stories`, { photo_id: ph.id, access_token: token });
      ids.push(st.post_id || st.id || ph.id);
    }
    return ids.join(",");
  }
  if (urls.length > 1) {
    const media = [];
    for (const u of urls) { const ph = await fbPost(`${page}/photos`, { url: u, published: "false", access_token: token }); media.push(ph.id); }
    const params = { message, access_token: token };
    media.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
    const post = await fbPost(`${page}/feed`, params);
    return post.id;
  }
  const post = await fbPost(`${page}/photos`, { url: urls[0], message, access_token: token });
  return post.post_id || post.id;
}
// Publica en Facebook si está activado; nunca frena la publicación en Instagram.
export async function publicarEnFacebook(piece) {
  try {
    const cfg = await igDiscoverySettings();
    if (!cfg.facebook_publish || !cfg.page_id || !cfg.access_token) return null;
    const id = await fbPublish(piece, cfg);
    await sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ fb_post_id: id, fb_error: null }) });
    return id;
  } catch (e) {
    console.error("[studio] facebook", e.message);
    await sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ fb_error: String(e.message).slice(0, 300) }) }).catch(() => {});
    return null;
  }
}

// Aviso por Telegram al publicar: las historias van con las imágenes para compartirlas como estado de WhatsApp.
export async function avisarPublicada(piece) {
  try {
    const urls = slideUrls(piece);
    const titulo = (piece.headline || piece.title || "").slice(0, 120);
    // Solo historias (posteos y carruseles no se avisan, por pedido de Bautista).
    if (piece.kind === "story") return await tgNotify(`📣 <b>Historia publicada en Instagram</b>\n${titulo}\n\nPara subirla a tu estado de WhatsApp: mantené apretada la imagen → Compartir → WhatsApp → Mi estado.`, { photos: urls });
    return null;
  } catch (e) { console.error("[studio] aviso telegram", e.message); return null; }
}

// El vigilante: publica lo programado cuya hora ya pasó.
export async function publicarPendientes() {
  let cfg = await igSettings();
  if (!cfg.ig_user_id || !cfg.access_token) return { skipped: "Instagram sin conectar" };
  cfg = await igRefreshIfNeeded(cfg);
  const r = await sb(`/cs_pieces?status=eq.scheduled&kind=neq.blog&scheduled_at=lte.${new Date().toISOString()}&image_url=not.is.null&select=*&order=scheduled_at.asc&limit=3`);
  const out = [];
  for (const piece of Array.isArray(r.body) ? r.body : []) {
    try {
      const id = await igPublish(piece, cfg);
      await sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "published", published_at: new Date().toISOString(), ig_media_id: id, publish_error: null }) });
      await publicarEnFacebook(piece);
      await avisarPublicada(piece);
      out.push({ id: piece.id, ok: true });
    } catch (e) {
      await sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ publish_error: String(e.message).slice(0, 300) }) });
      out.push({ id: piece.id, error: e.message });
    }
  }
  return { publicadas: out };
}
