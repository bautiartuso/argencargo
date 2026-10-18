// GET/POST /api/admin/historias — Historias destacadas (admin y empleado). Ver lib/historias.js.
//
// GET                                        → últimas historias generadas y portadas (bucket content-studio)
// POST multipart {file}                      → sube la captura, Claude marca el recorte, arma la historia.
//                                              Devuelve {url, captura:{url,ancho,alto}, bbox, nombre}
// POST {action:"render", captura, bbox}      → vuelve a armar la historia con otro recorte (o sin recorte)
// POST {action:"telegram", url, texto}       → manda la foto al Telegram del dueño para subirla desde el celular
// POST {action:"portadas", rehacer?}         → genera (o devuelve) las portadas de los destacados

import { sb, uploadStorage } from "../../../../lib/studio";
import { callClaudeVision } from "../../../../lib/anthropic";
import { htmlToPng } from "../../../../lib/chromium";
import { tgNotify } from "../../../../lib/telegram";
import { htmlHistoriaCaptura, htmlPortadaDestacado, PORTADAS, SCHEMA_RECORTE, normBbox, VARIANTES } from "../../../../lib/historias";

export const maxDuration = 120;
export const runtime = "nodejs";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const PUB = `${SB_URL}/storage/v1/object/public/content-studio/`;

async function isStaff(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64").toString());
    const p = await sb(`/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p.body) && ["admin", "empleado"].includes(p.body[0]?.role);
  } catch { return false; }
}

async function listar(prefix, limit = 30) {
  const r = await fetch(`${SB_URL}/storage/v1/object/list/content-studio`, {
    method: "POST", headers: { Authorization: `Bearer ${SB_SERVICE}`, apikey: SB_SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit, offset: 0, sortBy: { column: "created_at", order: "desc" } }),
  });
  const j = await r.json().catch(() => []);
  return (Array.isArray(j) ? j : []).filter((f) => f.name && !f.name.startsWith(".")).map((f) => ({ name: f.name, created_at: f.created_at, url: `${PUB}${prefix}/${f.name}` }));
}

// Ancho y alto de un PNG/JPEG/WebP leyendo la cabecera (sin dependencias).
function dimensiones(buf, mime) {
  try {
    if (mime.includes("png") && buf.length > 24) return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) };
    if (mime.includes("jpeg") || mime.includes("jpg")) {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (mime.includes("webp") && buf.length > 30) {
      const tag = buf.toString("ascii", 12, 16);
      if (tag === "VP8X") return { ancho: 1 + buf.readUIntLE(24, 3), alto: 1 + buf.readUIntLE(27, 3) };
      if (tag === "VP8L") { const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24]; return { ancho: 1 + (((b1 & 0x3f) << 8) | b0), alto: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) }; }
      if (tag === "VP8 ") return { ancho: buf.readUInt16LE(26) & 0x3fff, alto: buf.readUInt16LE(28) & 0x3fff };
    }
  } catch {}
  return null;
}

const slugDe = (s) => String(s || "cliente").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "cliente";

const VARIANTE_DEFAULT = "A";
async function renderYSubir(captura, bbox, nombre, variante = VARIANTE_DEFAULT) {
  const png = await htmlToPng(htmlHistoriaCaptura({ captura: captura.url, ancho: captura.ancho, alto: captura.alto, bbox, variante }), { width: 1080, height: 1920 });
  return uploadStorage(`historias/${Date.now()}_${slugDe(nombre)}${variante !== VARIANTE_DEFAULT ? `_${variante}` : ""}.png`, png, "image/png");
}

export async function GET(req) {
  if (!(await isStaff(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const [historias, portadas] = await Promise.all([listar("historias"), listar("historias-portadas", 10)]);
  return Response.json({ historias, portadas });
}

export async function POST(req) {
  if (!(await isStaff(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
      const fd = await req.formData();
      const file = fd.get("file");
      if (!file || typeof file === "string") return Response.json({ error: "Falta la captura" }, { status: 400 });
      if (file.size > 12 * 1024 * 1024) return Response.json({ error: "Máximo 12 MB" }, { status: 400 });
      const mime = file.type || "image/png";
      const buf = Buffer.from(await file.arrayBuffer());
      const dim = dimensiones(buf, mime);
      if (!dim) return Response.json({ error: "Formato no reconocido: usá PNG, JPG o WebP" }, { status: 400 });
      const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
      const capUrl = await uploadStorage(`historias-capturas/${Date.now()}.${ext}`, buf, mime);
      const captura = { url: capUrl, ancho: dim.ancho, alto: dim.alto };
      // Claude marca dónde está la reseña dentro de la captura para recortar lo que sobra.
      let bbox = null, nombre = "";
      try {
        const raw = await callClaudeVision({
          system: "Mirás capturas de pantalla de reseñas (Google Maps, Instagram, WhatsApp) y devolvés dónde está la reseña dentro de la imagen, en porcentaje del ancho y del alto. El bloque va desde la foto y el nombre del autor hasta el final del texto de la reseña, incluyendo las estrellas. Dejá AFUERA la barra de estado del teléfono, el buscador, el nombre del negocio, las pestañas, y también la fila de abajo con el corazón / Me gusta / Responder / Compartir: el recorte termina en la última línea del texto de la reseña. Si hay varias reseñas, elegí la que esté completa y más grande. Dejá un margen chico (1-2%) alrededor.",
          prompt: `La imagen mide ${dim.ancho}×${dim.alto} px. Marcá el recorte de la reseña.`,
          images: [`data:${mime};base64,${buf.toString("base64")}`],
          json_schema: SCHEMA_RECORTE, max_tokens: 400, feature: "historias",
        });
        const d = JSON.parse(raw);
        if (d && d.es_resena !== false) { bbox = normBbox(d); nombre = String(d.nombre || "").trim(); }
      } catch (e) { console.warn("[historias] recorte", e?.message); }
      const variante = VARIANTES.includes(String(fd.get("variante") || "")) ? String(fd.get("variante")) : VARIANTE_DEFAULT;
      const url = fd.get("solo_recorte") ? null : await renderYSubir(captura, bbox, nombre, variante);
      return Response.json({ ok: true, url, captura, bbox: bbox || normBbox(null), nombre, recortada: !!bbox });
    }
    const body = await req.json().catch(() => ({}));
    const a = body.action;
    if (a === "render") {
      const c = body.captura || {};
      if (!String(c.url || "").startsWith(`${PUB}historias-capturas/`) || !(Number(c.ancho) > 0) || !(Number(c.alto) > 0)) return Response.json({ error: "Captura inválida" }, { status: 400 });
      const bbox = normBbox(body.bbox);
      const cap = { url: c.url, ancho: Number(c.ancho), alto: Number(c.alto) };
      // {variantes:true} arma las cinco (para elegir plantilla por chat); si no, una sola.
      if (body.variantes) {
        const urls = {};
        for (const v of VARIANTES) urls[v] = await renderYSubir(cap, bbox, body.nombre, v);
        return Response.json({ ok: true, urls, bbox });
      }
      const url = await renderYSubir(cap, bbox, body.nombre, VARIANTES.includes(body.variante) ? body.variante : VARIANTE_DEFAULT);
      return Response.json({ ok: true, url, bbox });
    }
    if (a === "telegram") {
      const url = String(body.url || "");
      if (!url.startsWith(PUB)) return Response.json({ error: "URL inválida" }, { status: 400 });
      const r = await tgNotify(String(body.texto || "⭐ Historia para Instagram: guardala, subila como historia y agregala al destacado <b>Clientes</b>."), { photo: url });
      if (r?.error || r?.skipped) return Response.json({ error: r.error || r.skipped }, { status: 500 });
      return Response.json({ ok: true });
    }
    if (a === "portadas") {
      const existentes = await listar("historias-portadas", 10);
      const out = [];
      for (const p of PORTADAS) {
        const ya = existentes.find((f) => f.name === `${p.key}.png`);
        if (ya && !body.rehacer) { out.push({ ...p, url: ya.url }); continue; }
        const png = await htmlToPng(htmlPortadaDestacado(p), { width: 1080, height: 1920 });
        const url = await uploadStorage(`historias-portadas/${p.key}.png`, png, "image/png");
        out.push({ ...p, url: `${url}?v=${Date.now()}` });
      }
      return Response.json({ ok: true, portadas: out });
    }
    return Response.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (e) {
    console.error("[historias]", e);
    return Response.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
