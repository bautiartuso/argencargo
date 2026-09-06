// lib/blog.js — Blog de novedades de Argencargo (argencargo.com.ar/blog).
//   Radar de noticias (mkt-scraper, sin costo) → candidatos con el artículo leído → pieza kind "blog" en la cola
//   → el redactor es Claude Code en la Mac (claude -p, sin costo): escribe la nota en markdown + portada 1200×630
//   → blog_posts (review) → Bautista publica desde Contenido (✓) o, en modo automático, sale sola.
import { marked } from "marked";
import { sb, radarReciente, detalleNoticias, crearPiezas, slideUrls } from "./studio";
import { tgNotify } from "./telegram";

export const slugify = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "nota";

// modo: "manual" (todas esperan tu ✓) · "relevantes" (relevancia ≥ 4 sale sola, el resto espera) · "todas" (salen solas).
export async function blogSettings() {
  const r = await sb(`/cs_settings?key=eq.blog&select=value`);
  const v = Array.isArray(r.body) && r.body[0] ? r.body[0].value || {} : {};
  const modo = ["manual", "relevantes", "todas"].includes(v.modo) ? v.modo : v.auto ? "todas" : "relevantes";
  return { modo, por_dia: Math.max(0, Math.min(5, Number(v.por_dia ?? 1))) };
}
export async function guardarBlogSettings(v) {
  const modo = ["manual", "relevantes", "todas"].includes(v.modo) ? v.modo : "relevantes";
  await sb(`/cs_settings?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: "blog", value: { modo, por_dia: Math.max(0, Math.min(5, Number(v.por_dia ?? 1))) }, updated_at: new Date().toISOString() }) });
}
export async function notasPendientes() {
  const r = await sb(`/blog_posts?status=eq.review&select=id`);
  return Array.isArray(r.body) ? r.body.length : 0;
}

// Noticias del radar con artículo legible que todavía no tienen nota.
export async function candidatosBlog(n = 10) {
  const radar = await radarReciente(25);
  const [usadas, enCola] = await Promise.all([sb(`/blog_posts?select=source_url`), sb(`/cs_pieces?kind=eq.blog&status=in.(generating,review,approved,published)&select=material`)]);
  const urls = new Set([...(Array.isArray(usadas.body) ? usadas.body : []).map((x) => x.source_url), ...(Array.isArray(enCola.body) ? enCola.body : []).map((x) => (String(x.material || "").match(/URL: (\S+)/) || [])[1])].filter(Boolean));
  const libres = radar.filter((x) => x.url && !urls.has(x.url)).slice(0, n);
  const con = await detalleNoticias(libres, { max: n, chars: 7000 });
  return con.filter((x) => (x.detalle || "").length >= 700);
}

export async function encolarNota(item, { source = "blog" } = {}) {
  const material = `FUENTE: ${item.source_name || ""}\nTÍTULO ORIGINAL: ${item.title}\nURL: ${item.url}\n\nTEXTO DEL ARTÍCULO (solo como material; NO copiar frases):\n${item.detalle || ""}`;
  const created = await crearPiezas([{ kind: "blog", pillar: "noticia", title: String(item.title || "Nota").slice(0, 90), brief: `Nota para el blog de Argencargo a partir de esta noticia: "${item.title}" (${item.source_name}). Explicar en simple qué cambió, a quién afecta (importadores, e-commerce, courier) y qué conviene hacer. Fuente citada al final con link.`, material, background: "claro", visual: "portada-editorial" }], { source });
  return created[0] || null;
}

// Cron diario: encola hasta por_dia notas nuevas.
export async function redactorDiario() {
  const cfg = await blogSettings();
  if (!cfg.por_dia) return { skipped: "blog apagado (0 por día)" };
  const desde = new Date(); desde.setUTCHours(3, 0, 0, 0);
  const hoy = await sb(`/cs_pieces?kind=eq.blog&created_at=gte.${desde.toISOString()}&select=id`);
  const yaHoy = Array.isArray(hoy.body) ? hoy.body.length : 0;
  const faltan = cfg.por_dia - yaHoy;
  if (faltan <= 0) return { skipped: `ya hay ${yaHoy} nota(s) hoy` };
  const cands = await candidatosBlog(faltan + 4);
  const out = [];
  for (const c of cands.slice(0, faltan)) { const p = await encolarNota(c, { source: "blog-cron" }); if (p) out.push(p.title); }
  return { encoladas: out };
}

export function mdToHtml(md) {
  try { return marked.parse(String(md || ""), { gfm: true, breaks: false }); } catch { return `<p>${String(md || "")}</p>`; }
}

async function slugLibre(base, pieceId) {
  let slug = slugify(base); let i = 2;
  for (;;) {
    const r = await sb(`/blog_posts?slug=eq.${encodeURIComponent(slug)}&select=id,piece_id`);
    const row = Array.isArray(r.body) && r.body[0];
    if (!row || row.piece_id === pieceId) return slug;
    slug = `${slugify(base)}-${i++}`;
  }
}

// Guarda (o actualiza) la nota que escribió el runner. Devuelve la fila.
export async function guardarNota(piece, f) {
  const content_md = String(f.content_md || "").trim();
  const title = String(f.title || piece.headline || piece.title || "Nota").trim().slice(0, 140);
  const slug = await slugLibre(f.slug || title, piece.id);
  const words = content_md.split(/\s+/).filter(Boolean).length;
  const m = String(piece.material || "");
  const row = {
    slug, title, excerpt: String(f.excerpt || "").slice(0, 300), content_md, content_html: mdToHtml(content_md), cover_url: piece.image_url || null, story_url: slideUrls(piece)[1] || null,
    tags: String(f.tags || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8),
    source_name: (m.match(/FUENTE: (.*)/) || [])[1]?.trim() || null, source_title: (m.match(/TÍTULO ORIGINAL: (.*)/) || [])[1]?.trim() || null, source_url: (m.match(/URL: (\S+)/) || [])[1] || null,
    seo_title: String(f.seo_title || title).slice(0, 70), seo_description: String(f.seo_description || f.excerpt || "").slice(0, 160),
    relevance: Math.max(1, Math.min(5, Number(f.relevance) || 3)), relevance_reason: String(f.relevance_reason || "").slice(0, 300),
    reading_min: Math.max(1, Math.round(words / 200)), piece_id: piece.id, updated_at: new Date().toISOString(),
  };
  const ex = await sb(`/blog_posts?piece_id=eq.${piece.id}&select=id,status`);
  const prev = Array.isArray(ex.body) && ex.body[0];
  if (prev) { const r = await sb(`/blog_posts?id=eq.${prev.id}`, { method: "PATCH", body: JSON.stringify(row) }); return Array.isArray(r.body) ? r.body[0] : null; }
  const r = await sb(`/blog_posts`, { method: "POST", body: JSON.stringify({ ...row, status: "review" }) });
  return Array.isArray(r.body) ? r.body[0] : null;
}

export async function publicarNota(pieceId) {
  const now = new Date().toISOString();
  const r = await sb(`/blog_posts?piece_id=eq.${pieceId}`, { method: "PATCH", body: JSON.stringify({ status: "published", published_at: now, updated_at: now }) });
  await sb(`/cs_pieces?id=eq.${pieceId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "published", published_at: now, approved_at: now, updated_at: now }) });
  const nota = Array.isArray(r.body) ? r.body[0] : null;
  // Telegram (gratis): la historia lista para subir con el link de la nota.
  if (nota) {
    const url = `https://www.argencargo.com.ar/blog/${nota.slug}`;
    tgNotify(`📝 <b>Nota publicada en el blog</b>\n${nota.title}\n${url}\n\n${nota.story_url ? "Historia lista: subila a Instagram y pegale el sticker de link con esa dirección." : "Portada adjunta (esta nota no tiene historia): usala como imagen y pegale el sticker de link."}`, { photo: nota.story_url || nota.cover_url || null }).catch(() => {});
  }
  return nota;
}
export async function despublicarNota(id) {
  await sb(`/blog_posts?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "review", updated_at: new Date().toISOString() }) });
}

// Lectura pública (server components): solo publicadas.
export async function notasPublicadas({ limit = 12, offset = 0 } = {}) {
  const r = await sb(`/blog_posts?status=eq.published&select=slug,title,excerpt,cover_url,tags,published_at,reading_min&order=published_at.desc&limit=${limit}&offset=${offset}`);
  return Array.isArray(r.body) ? r.body : [];
}
export async function notaPorSlug(slug) {
  const r = await sb(`/blog_posts?status=eq.published&slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`);
  return Array.isArray(r.body) && r.body[0] ? r.body[0] : null;
}
export async function sumarVista(slug) {
  try { const r = await sb(`/blog_posts?slug=eq.${encodeURIComponent(slug)}&select=id,views`); const row = Array.isArray(r.body) && r.body[0]; if (row) await sb(`/blog_posts?id=eq.${row.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ views: Number(row.views || 0) + 1 }) }); } catch {}
}
