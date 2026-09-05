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
          kind: { type: "string", enum: ["feed", "story"] },
          pillar: { type: "string", description: "educativo | datos | noticia | marca | rutina | caso" },
          title: { type: "string", description: "Nombre interno corto" },
          brief: { type: "string", description: "Qué comunicar, con el dato o el ángulo concreto, y qué estructura visual sugerís (2 a 5 frases)." },
        },
        required: ["kind", "pillar", "title", "brief"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

export async function planIdeas({ count = 4, kinds = null, brief = null, memory = null }) {
  const mem = memory || await loadMemory();
  const [radar, datos, recientes] = await Promise.all([
    radarReciente(12), datosSistema(),
    sb(`/cs_pieces?status=in.(review,approved,scheduled,published)&select=title,kind,pillar,created_at&order=created_at.desc&limit=40`),
  ]);
  const hoy = HOY_AR();
  const dia = DIAS[hoy.getUTCDay()];
  const ultimas = (Array.isArray(recientes.body) ? recientes.body : []).map((p) => `- [${p.kind}/${p.pillar || "?"}] ${p.title}`).join("\n") || "(ninguna todavía)";
  const system = `Sos el analista de contenido de Argencargo. Proponés ideas de posts e historias de Instagram que respetan a rajatabla la memoria de marca. Nunca repetís temas recientes. Cada idea trae un ángulo concreto, no genérico, y sugiere la estructura visual.

${memoriaCompleta(mem)}`;
  const user = `HOY es ${dia} ${hoy.toISOString().slice(0, 10)} (Argentina).

DATOS REALES DEL SISTEMA (usalos si sirven, sin inventar otros):
${JSON.stringify(datos)}

NOTICIAS DEL RADAR (últimos 7 días):
${radar.map((x) => `- ${x.title} (${x.source_name})`).join("\n") || "(nada nuevo)"}

PIEZAS RECIENTES (no repetir tema):
${ultimas}

${brief ? `PEDIDO DE BAUTISTA (tiene prioridad absoluta): ${brief}\n` : ""}
Proponé exactamente ${count} ideas${kinds ? ` con estos formatos, en este orden: ${kinds.join(", ")}` : " (mezclá feed e historias según el ritmo de campanas.md)"}.
Si es lunes, una historia es "buena semana"; si es viernes, una es "buen fin de semana". Variá pilares. Cada brief dice exactamente qué afirmar, con el número o el dato si aplica.`;
  const out = await claudeJson({ system, user, schema: IDEAS_SCHEMA, max_tokens: 3500 });
  return Array.isArray(out.ideas) ? out.ideas.slice(0, count) : [];
}

// ── 2) Chatbot: armar una idea conversando (texto, imágenes adjuntas, audio transcripto) ──
const CHAT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Respuesta al usuario, breve, en tono de estratega" },
    listo: { type: "boolean", description: "true cuando la idea está lo bastante definida como para generar la pieza" },
    kind: { type: "string", enum: ["feed", "story"] },
    title: { type: "string" },
    pillar: { type: "string" },
    brief: { type: "string", description: "Brief final para el diseñador (solo si listo=true)" },
  },
  required: ["reply", "listo", "kind", "title", "pillar", "brief"],
  additionalProperties: false,
};

export async function chatIdea({ messages, images = [] }) {
  const mem = await loadMemory();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system = `Sos el estratega de contenido de Argencargo. Conocés el tono, la audiencia y los productos de la marca y ayudás a Bautista a llegar a UNA idea de posteo concreta. Preguntás lo mínimo (una cosa por vez), proponés, y cuando la idea está clara marcás listo=true con un brief preciso para el diseñador (qué afirmar, qué dato, qué estructura visual, formato). Respuestas cortas, estilo chat.

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
export async function crearPiezas(ideas, { source = "manual", run_id = null } = {}) {
  const rows = ideas.map((i) => ({
    kind: i.kind === "story" ? "story" : "feed",
    width: 1080, height: i.kind === "story" ? 1920 : 1350,
    status: "generating", source, run_id,
    pillar: i.pillar || null, title: i.title || null, brief: i.brief || null,
  }));
  const r = await sb(`/cs_pieces`, { method: "POST", body: JSON.stringify(rows) });
  return Array.isArray(r.body) ? r.body : [];
}

export async function runner({ count = 4, brief = null, kinds = null, source = "runner" }) {
  const run = await sb(`/cs_runs`, { method: "POST", body: JSON.stringify({ kind: source, requested: count }) });
  const runId = Array.isArray(run.body) && run.body[0]?.id;
  const ideas = await planIdeas({ count, brief, kinds });
  const created = await crearPiezas(ideas, { source, run_id: runId });
  if (runId) await sb(`/cs_runs?id=eq.${runId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ created: created.length, finished_at: new Date().toISOString(), log: ideas.map((i) => `${i.kind} · ${i.pillar} · ${i.title}`).join("\n") }) });
  return created;
}

// El servidor no diseña (lo hace la Mac). Queda por compatibilidad con la cola vieja.
export async function processNext() { return { skipped: "el diseño corre en la Mac (runner local)" }; }

// ── 4) Historial automático al aprobar ───────────────────────────────────────
export async function appendHistorial(piece) {
  const mem = await loadMemory();
  const prev = memText(mem, "historial");
  const linea = `- ${new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)} · ${piece.kind === "story" ? "historia" : "feed"} · ${piece.pillar || ""} · ${piece.headline || piece.title || ""}`;
  const content = `${prev.trimEnd()}\n${linea}`;
  await sb(`/cs_memory?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: "historial", title: "Historial de contenido (automático)", content, updated_at: new Date().toISOString() }) });
}

// ── 5) Instagram: conexión y publicación (Graph API) ─────────────────────────
export async function igSettings() {
  const r = await sb(`/cs_settings?key=eq.instagram&select=value`);
  return Array.isArray(r.body) && r.body[0] ? r.body[0].value : {};
}

export async function igTest(cfg) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${cfg.ig_user_id}?fields=id,username,name,profile_picture_url,followers_count,media_count&access_token=${encodeURIComponent(cfg.access_token)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
  return j;
}

// Publica una pieza: crea el contenedor de medios (imagen pública) y lo publica.
export async function igPublish(piece, cfg) {
  const base = `https://graph.facebook.com/v21.0/${cfg.ig_user_id}`;
  const params = new URLSearchParams({ image_url: piece.image_url, access_token: cfg.access_token });
  if (piece.kind === "story") params.set("media_type", "STORIES");
  else params.set("caption", `${piece.caption || ""}\n\n${piece.hashtags || ""}`.trim());
  const c = await fetch(`${base}/media`, { method: "POST", body: params });
  const cj = await c.json().catch(() => ({}));
  if (!c.ok || !cj.id) throw new Error(cj?.error?.message || `contenedor HTTP ${c.status}`);
  for (let i = 0; i < 10; i++) {
    const s = await fetch(`https://graph.facebook.com/v21.0/${cj.id}?fields=status_code&access_token=${encodeURIComponent(cfg.access_token)}`);
    const sj = await s.json().catch(() => ({}));
    if (sj.status_code === "FINISHED") break;
    if (sj.status_code === "ERROR") throw new Error("Instagram no pudo procesar la imagen");
    await new Promise((r) => setTimeout(r, 3000));
  }
  const p = await fetch(`${base}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: cj.id, access_token: cfg.access_token }) });
  const pj = await p.json().catch(() => ({}));
  if (!p.ok || !pj.id) throw new Error(pj?.error?.message || `publicación HTTP ${p.status}`);
  return pj.id;
}

// El vigilante: publica lo programado cuya hora ya pasó.
export async function publicarPendientes() {
  const cfg = await igSettings();
  if (!cfg.ig_user_id || !cfg.access_token) return { skipped: "Instagram sin conectar" };
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
