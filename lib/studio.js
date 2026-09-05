// lib/studio.js — Content Studio: el motor que convierte una idea en un post listo para aprobar.
//
// Pipeline (igual que el diagrama de Minificando):
//   idea (brief manual / runner) → pieza en 'generating' → la COLA la agarra de a una →
//   Claude "diseñador" lee la memoria de marca y escribe el HTML + caption →
//   (opcional) Gemini genera la foto de fondo → Chromium saca la foto del HTML → PNG en storage →
//   'review' (vos aprobás) → 'approved' → 'scheduled' → 'published'.
//
// Memoria de marca: tabla cs_memory (se siembra desde docs/marca/*.md la primera vez y después se
// edita desde el admin). Historial: se escribe solo con cada pieza aprobada.

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { CLAUDE_MODEL } from "./anthropic";
import { htmlToPng } from "./chromium";
import { generatePhoto, geminiConfigured } from "./gemini-image";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
// Diseñar HTML largo con Opus se pasa del límite de la función: se usa un modelo rápido y,
// si no existe en la cuenta, se cae al modelo general de la app.
const DESIGN_MODEL = process.env.STUDIO_MODEL || "claude-sonnet-5";

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

// ── Memoria de marca ─────────────────────────────────────────────────────────
export const MEMORY_DOCS = [
  { key: "knowledge", title: "Identidad, audiencia y reglas", file: "02-knowledge.md" },
  { key: "brand-kit", title: "Brand kit (colores, tipografía, composición)", file: "03-brand-kit.md" },
  { key: "referencias", title: "Referencia de estilo", file: "05-referencias/magforce-estilo.md" },
  { key: "competencia", title: "Competencia (solo para aprender)", file: "04-competencia.md" },
  { key: "historial", title: "Historial (se escribe solo)", file: null },
];

export async function loadMemory() {
  const r = await sb(`/cs_memory?select=key,title,content,updated_at&order=key`);
  let rows = Array.isArray(r.body) ? r.body : [];
  const missing = MEMORY_DOCS.filter((d) => !rows.find((x) => x.key === d.key));
  if (missing.length) {
    for (const d of missing) {
      let content = "";
      if (d.file) { try { content = await fs.readFile(path.join(process.cwd(), "docs/marca", d.file), "utf8"); } catch (e) { console.error("[studio] seed", d.file, e.message); } }
      await sb(`/cs_memory?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: d.key, title: d.title, content }) });
    }
    const r2 = await sb(`/cs_memory?select=key,title,content,updated_at&order=key`);
    rows = Array.isArray(r2.body) ? r2.body : rows;
  }
  return rows;
}

const memText = (rows, key) => rows.find((x) => x.key === key)?.content || "";

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
    const [vuelos, entregadas, clientes] = await Promise.all([
      sb(`/flights?dispatched_at=not.is.null&status=neq.recibido&select=flight_code,total_weight_kg,international_carrier`),
      sb(`/operations?delivery_completed_at=gte.${hace7}&select=id`),
      sb(`/clients?select=id&limit=1`, { headers: { Prefer: "count=exact" } }),
    ]);
    const vs = Array.isArray(vuelos.body) ? vuelos.body : [];
    out.vuelos_en_transito = vs.length;
    out.kg_en_el_aire = Math.round(vs.reduce((a, f) => a + Number(f.total_weight_kg || 0), 0));
    out.cargas_entregadas_7d = Array.isArray(entregadas.body) ? entregadas.body.length : null;
  } catch (e) { console.error("[studio] datos", e.message); }
  return out;
}

// ── Claude ───────────────────────────────────────────────────────────────────
async function claudeJson({ system, user, schema, max_tokens = 6000, model = DESIGN_MODEL }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const call = (m) => client.messages.create({
    model: m, max_tokens, system,
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema } },
  });
  let res;
  try { res = await call(model); }
  catch (e) {
    if (e?.status === 404 || /model/i.test(String(e?.message)) && e?.status === 400) res = await call(CLAUDE_MODEL);
    else throw e;
  }
  const txt = res.content.find((b) => b.type === "text")?.text || "{}";
  return JSON.parse(txt);
}

const HOY_AR = () => new Date(Date.now() - 3 * 3600 * 1000);
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// ── 1) Planificar ideas (el "runner" / analista) ─────────────────────────────
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
          title: { type: "string", description: "Nombre interno corto de la pieza" },
          brief: { type: "string", description: "Qué tiene que comunicar, con el dato o el ángulo concreto. 2 a 4 frases." },
          photo_prompt: { type: "string", description: "Descripción de la foto de fondo ideal (escena realista de la operación), o vacío si la pieza es solo tipográfica" },
        },
        required: ["kind", "pillar", "title", "brief", "photo_prompt"],
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
  const system = `Sos el analista de contenido de Argencargo. Proponés ideas de posts e historias de Instagram que respetan a rajatabla la memoria de marca. Nunca repetís temas recientes. Cada idea trae un ángulo concreto, no genérico.

=== MEMORIA: IDENTIDAD Y REGLAS ===
${memText(mem, "knowledge")}

=== HISTORIAL (no repetir) ===
${memText(mem, "historial")}`;
  const user = `HOY es ${dia} ${hoy.toISOString().slice(0, 10)} (Argentina).

DATOS REALES DEL SISTEMA (usalos si sirven, sin inventar otros):
${JSON.stringify(datos)}

NOTICIAS DEL RADAR (últimos 7 días):
${radar.map((x) => `- ${x.title} (${x.source_name})`).join("\n") || "(nada nuevo)"}

PIEZAS RECIENTES (no repetir tema):
${ultimas}

${brief ? `PEDIDO DE BAUTISTA (tiene prioridad): ${brief}\n` : ""}
Proponé exactamente ${count} ideas${kinds ? ` con estos formatos, en este orden: ${kinds.join(", ")}` : " (mezclá feed e historias según el ritmo: 1 feed por día y 3 historias por día)"}.
Reglas de ritmo: si es lunes, una de las historias es "buena semana" (saludo de inicio de semana, distinto cada lunes); si es viernes, una es "buen fin de semana". Las historias son livianas y rápidas; el feed tiene sustancia (educativo, dato real, noticia explicada, marca).
Variá pilares. Cada brief dice exactamente qué afirmar, con el número o el dato si aplica. Nada de "cotizá ya".`;
  const out = await claudeJson({ system, user, schema: IDEAS_SCHEMA, max_tokens: 3000, model: CLAUDE_MODEL });
  return Array.isArray(out.ideas) ? out.ideas.slice(0, count) : [];
}

// ── 2) Diseñar la pieza (el "diseñador"): HTML + caption ────────────────────
const PIECE_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    subheadline: { type: "string" },
    caption: { type: "string", description: "Texto del post para Instagram, con saltos de línea, sin hashtags" },
    hashtags: { type: "string", description: "8 a 15 hashtags separados por espacio" },
    html: { type: "string", description: "Documento HTML completo y autocontenido de la pieza" },
  },
  required: ["headline", "subheadline", "caption", "hashtags", "html"],
  additionalProperties: false,
};

function designerSystem(mem, piece, photoUrl) {
  const W = piece.width, H = piece.height;
  return `Sos el diseñador y redactor de Argencargo. Creás UNA pieza de Instagram como un documento HTML autocontenido que después se fotografía en ${W}×${H} px. Tu diseño tiene que verse como una pieza de campaña profesional, al nivel de la referencia de estilo.

=== MEMORIA: IDENTIDAD Y REGLAS (obligatorias) ===
${memText(mem, "knowledge")}

=== BRAND KIT ===
${memText(mem, "brand-kit")}

=== REFERENCIA DE ESTILO ===
${memText(mem, "referencias")}

=== REGLAS TÉCNICAS DEL HTML (no negociables) ===
- Un solo documento: <!doctype html><html><head>…</head><body>…</body></html>. Sin JavaScript.
- html, body: margin 0; width ${W}px; height ${H}px; overflow hidden. Todo el contenido dentro de ese lienzo exacto.
- Fuentes: <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">. Titulares en 'Bebas Neue', textos en 'Inter' (o 'Nunito' para algo más amigable).
- Imágenes permitidas: SOLO estas URLs: ${BASE_URL}/brand/logo-completo.png (isotipo + palabra, azul sobre transparente), ${BASE_URL}/brand/isotipo.png (solo símbolo), ${BASE_URL}/brand/logotipo-texto.png (solo la palabra)${photoUrl ? `, y la FOTO DE FONDO ${photoUrl} (usala a pantalla completa con object-fit cover y un degradé oscuro o azul encima para que el texto se lea)` : ""}. Ninguna otra imagen externa. Los logos son azules: sobre fondos oscuros ponelos dentro de una cápsula blanca redondeada o usá el isotipo sobre un bloque blanco.
- Colores de marca: azul profundo #0A3D91, azul eléctrico #1E8BFF, navy #0A1628, blanco #FFFFFF, gris #334155. Degradé oficial linear-gradient(135deg,#0A3D91,#1E8BFF). Podés dibujar formas, franjas diagonales (como las barras del logo), círculos, tarjetas y bloques de color con CSS. Sin emojis dentro del HTML (no siempre renderizan).
- Titular en mayúsculas, grande (Bebas Neue 120 a 190 px en feed, 130 a 210 px en historias), 2 a 4 líneas, con 1 o 2 palabras resaltadas en un bloque #1E8BFF o #0A3D91 con texto blanco (span con background y padding). Subtítulo en Inter 44 a 56 px. Línea de cierre chica opcional.
- Márgenes internos mínimos 80 px. En historias, nada importante en los 250 px de arriba ni de abajo.
- Logo siempre presente y chico (isotipo 90 a 130 px o logo completo 260 a 340 px de ancho), en una esquina o al pie.
- HTML COMPACTO: un solo <style> con las clases justas, sin comentarios, sin CSS repetido, sin frameworks. Apuntá a menos de 120 líneas en total: la pieza tiene que verse impecable con poco código.
- Texto exacto y correcto en castellano argentino con tildes. Sin lorem ipsum, sin texto de relleno, sin datos inventados: usá solo lo que dice el brief.
- Sin llamado a la acción agresivo. Nada de "cotizá ya". Como mucho "Cualquier duda, escribinos" chico al pie.
- El caption es aparte (no va en el HTML): 3 a 8 líneas, tono de la marca, con saltos de línea, sin hashtags (van en su campo).`;
}

export async function designPiece(piece, mem, photoUrl) {
  const system = designerSystem(mem, piece, photoUrl);
  const user = `Pieza: ${piece.kind === "story" ? "HISTORIA 1080×1920" : "POST DE FEED 1080×1350"}.
Título interno: ${piece.title || "(sin título)"}
Pilar: ${piece.pillar || "(libre)"}
Brief: ${piece.brief || "(libre)"}
${piece.feedback ? `\nCAMBIOS PEDIDOS POR BAUTISTA sobre la versión anterior (aplicalos todos): ${piece.feedback}\nVersión anterior (titular): ${piece.headline || ""} / ${piece.subheadline || ""}` : ""}
Diseñá la pieza completa.`;
  return claudeJson({ system, user, schema: PIECE_SCHEMA, max_tokens: 7000 });
}

// ── 3) Foto de fondo (opcional) ──────────────────────────────────────────────
async function uploadStorage(pathname, buffer, mime) {
  const up = await fetch(`${SB_URL}/storage/v1/object/content-studio/${pathname}`, { method: "POST", headers: { Authorization: `Bearer ${SB_SERVICE}`, apikey: SB_SERVICE, "Content-Type": mime, "x-upsert": "true" }, body: buffer });
  if (!up.ok) throw new Error(`storage ${up.status}`);
  return `${SB_URL}/storage/v1/object/public/content-studio/${pathname}`;
}

async function fotoDeFondo(piece) {
  if (!geminiConfigured() || !piece.photo_prompt) return null;
  try {
    const img = await generatePhoto(`${piece.photo_prompt}. Contexto: empresa argentina de logística internacional e importación desde China. Sin logos ni texto.`, { aspect: piece.kind === "story" ? "9:16" : "4:5" });
    if (!img) return null;
    const ext = img.mime.includes("jpeg") ? "jpg" : "png";
    return await uploadStorage(`fotos/${piece.id}-${Date.now()}.${ext}`, img.buffer, img.mime);
  } catch (e) { console.error("[studio] foto", e.message); return null; }
}

// ── 4) Render ────────────────────────────────────────────────────────────────
export async function renderPiece(piece) {
  const png = await htmlToPng(piece.html, { width: piece.width, height: piece.height });
  return uploadStorage(`piezas/${piece.id}-${Date.now()}.png`, png, "image/png");
}

// ── 4b) Director de arte: mira la foto y corrige el HTML (hasta 2 pasadas) ──
const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    aprobado: { type: "boolean", description: "true si la pieza está lista para publicar tal cual" },
    problemas: { type: "string", description: "Qué está mal, concreto (texto tapado, fuente equivocada, desalineado, logo mal, contraste, etc.)" },
    html: { type: "string", description: "HTML completo corregido. Si aprobado=true, repetí el HTML tal cual." },
  },
  required: ["aprobado", "problemas", "html"],
  additionalProperties: false,
};

async function reviewRender(piece, html, png, mem) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system = `Sos el director de arte de Argencargo. Revisás una pieza de Instagram YA RENDERIZADA (te llega la imagen final) junto con su HTML, y la corregís hasta que quede impecable. Criterios: nada de texto cortado, tapado ni fuera del lienzo; la tipografía de los titulares es 'Bebas Neue' en TODO el titular (incluida la palabra resaltada); jerarquía clara; márgenes generosos; logo visible, chico y sin tapar nada; contraste correcto; composición equilibrada, con aire, al nivel de una campaña profesional. Si algo está mal, devolvés el HTML corregido completo. Respetá el brand kit:\n${memText(mem, "brand-kit").slice(0, 3000)}`;
  const call = (m) => client.messages.create({
    model: m, max_tokens: 7000, system,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/png", data: png.toString("base64") } },
      { type: "text", text: `Pieza ${piece.kind === "story" ? "historia 1080×1920" : "feed 1080×1350"}. Titular esperado: ${piece.headline || ""}. Subtítulo: ${piece.subheadline || ""}.\n\nHTML actual:\n${html}` },
    ] }],
    output_config: { format: { type: "json_schema", schema: REVIEW_SCHEMA } },
  });
  let res;
  try { res = await call(DESIGN_MODEL); } catch (e) { if (e?.status === 404 || e?.status === 400) res = await call(CLAUDE_MODEL); else throw e; }
  const txt = res.content.find((b) => b.type === "text")?.text || "{}";
  return JSON.parse(txt);
}

export async function renderBuffer(piece, html) {
  return htmlToPng(html, { width: piece.width, height: piece.height });
}

// ── 5) Procesar UNA pieza de la cola (idea → HTML → PNG → review) ────────────
export async function processPiece(piece) {
  const mem = await loadMemory();
  const patch = (body) => sb(`/cs_pieces?id=eq.${piece.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }) });
  try {
    const photoUrl = piece.photo_url || await fotoDeFondo(piece);
    const d = await designPiece({ ...piece, photo_url: photoUrl }, mem, photoUrl);
    const html = String(d.html || "");
    if (!/<html/i.test(html)) throw new Error("El diseñador no devolvió HTML válido");
    // Render → director de arte mira la foto → corrige → re-render (máx. 2 pasadas).
    let finalHtml = html;
    let png = await renderBuffer(piece, finalHtml);
    for (let pass = 0; pass < 2; pass++) {
      let rev = null;
      try { rev = await reviewRender({ ...piece, headline: d.headline, subheadline: d.subheadline }, finalHtml, png, mem); } catch (e) { console.error("[studio] review", e.message); break; }
      if (!rev || rev.aprobado || !/<html/i.test(String(rev.html || ""))) break;
      finalHtml = String(rev.html);
      png = await renderBuffer(piece, finalHtml);
    }
    const image_url = await uploadStorage(`piezas/${piece.id}-${Date.now()}.png`, png, "image/png");
    await patch({ status: "review", headline: d.headline, subheadline: d.subheadline, caption: d.caption, hashtags: d.hashtags, html: finalHtml, image_url, photo_url: photoUrl, error: null, locked_at: null, feedback: null });
    return { ok: true, image_url };
  } catch (e) {
    console.error("[studio] processPiece", piece.id, e.message);
    await patch({ status: (piece.attempts || 0) + 1 >= 2 ? "error" : "generating", error: String(e.message).slice(0, 500), attempts: (piece.attempts || 0) + 1, locked_at: null });
    return { ok: false, error: e.message };
  }
}

// Toma la pieza más vieja pendiente (con lock de 4 min) y la procesa. Devuelve null si no hay.
export async function processNext() {
  // Motor local (la Mac con Claude Code): el servidor no diseña, solo espera al runner.
  if (process.env.STUDIO_ENGINE === "local") return { skipped: "motor local" };
  const stale = new Date(Date.now() - 4 * 60000).toISOString();
  const r = await sb(`/cs_pieces?status=eq.generating&or=(locked_at.is.null,locked_at.lt.${stale})&select=*&order=created_at.asc&limit=1`);
  const piece = Array.isArray(r.body) && r.body[0];
  if (!piece) return null;
  const lock = await sb(`/cs_pieces?id=eq.${piece.id}&status=eq.generating&or=(locked_at.is.null,locked_at.lt.${stale})`, { method: "PATCH", body: JSON.stringify({ locked_at: new Date().toISOString() }) });
  if (!(Array.isArray(lock.body) && lock.body.length)) return null; // otro proceso la agarró
  const res = await processPiece(piece);
  return { id: piece.id, title: piece.title, ...res };
}

// ── 6) Crear piezas (manual o runner) ───────────────────────────────────────
export async function crearPiezas(ideas, { source = "manual", run_id = null } = {}) {
  const rows = ideas.map((i) => ({
    kind: i.kind === "story" ? "story" : i.kind === "carousel" ? "carousel" : "feed",
    width: 1080, height: i.kind === "story" ? 1920 : 1350,
    status: "generating", source, run_id,
    pillar: i.pillar || null, title: i.title || null, brief: i.brief || null, photo_prompt: i.photo_prompt || null,
  }));
  const r = await sb(`/cs_pieces`, { method: "POST", body: JSON.stringify(rows) });
  return Array.isArray(r.body) ? r.body : [];
}

export async function runner({ count = 4, brief = null, kinds = null, source = "runner" }) {
  const run = await sb(`/cs_runs`, { method: "POST", body: JSON.stringify({ kind: source, requested: count }) });
  const runId = Array.isArray(run.body) && run.body[0]?.id;
  const ideas = await planIdeas({ count, brief, kinds });
  const created = await crearPiezas(ideas, { source, run_id: runId });
  if (runId) await sb(`/cs_runs?id=eq.${runId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ created: created.length, finished_at: new Date().toISOString(), log: ideas.map((i) => `${i.kind}: ${i.title}`).join("\n") }) });
  return created;
}

// ── 7) Historial automático ─────────────────────────────────────────────────
export async function appendHistorial(piece) {
  const mem = await loadMemory();
  const prev = memText(mem, "historial");
  const linea = `- ${new Date().toISOString().slice(0, 10)} · ${piece.kind} · ${piece.pillar || ""} · ${piece.title || piece.headline || ""}`;
  const content = (prev ? prev + "\n" : "# Historial de piezas aprobadas (automático)\n\n") + linea;
  await sb(`/cs_memory?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: "historial", title: "Historial (se escribe solo)", content, updated_at: new Date().toISOString() }) });
}
