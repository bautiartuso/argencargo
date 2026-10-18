// GET/POST /api/admin/historias — Historias destacadas (admin y empleado). Ver lib/historias.js.
//
// GET                                  → últimas historias generadas (bucket content-studio/historias)
// POST multipart {file}                → lee la captura con Claude, arma la historia y la sube. Devuelve {url, datos}
// POST {action:"render", datos}        → vuelve a armar la historia con los datos corregidos a mano
// POST {action:"telegram", url, texto} → manda la foto al Telegram del dueño para subirla desde el celular
// POST {action:"portadas"}             → genera (o devuelve) las portadas de los destacados

import { sb, uploadStorage } from "../../../../lib/studio";
import { callClaudeVision } from "../../../../lib/anthropic";
import { htmlToPng } from "../../../../lib/chromium";
import { tgNotify } from "../../../../lib/telegram";
import { htmlHistoriaResena, htmlPortadaDestacado, PORTADAS, SCHEMA_RESENA } from "../../../../lib/historias";

export const maxDuration = 120;
export const runtime = "nodejs";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

async function isStaff(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64").toString());
    const p = await sb(`/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p.body) && ["admin", "empleado"].includes(p.body[0]?.role);
  } catch { return false; }
}

const limpiar = (d) => ({
  nombre: String(d?.nombre || "").trim().slice(0, 60),
  estrellas: Math.max(1, Math.min(5, Math.round(Number(d?.estrellas) || 5))),
  fecha: String(d?.fecha || "").trim().slice(0, 40),
  texto: String(d?.texto || "").trim().slice(0, 900),
});

async function listar(prefix, limit = 30) {
  const r = await fetch(`${SB_URL}/storage/v1/object/list/content-studio`, {
    method: "POST", headers: { Authorization: `Bearer ${SB_SERVICE}`, apikey: SB_SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit, offset: 0, sortBy: { column: "created_at", order: "desc" } }),
  });
  const j = await r.json().catch(() => []);
  return (Array.isArray(j) ? j : []).filter((f) => f.name && !f.name.startsWith(".")).map((f) => ({
    name: f.name, created_at: f.created_at, url: `${SB_URL}/storage/v1/object/public/content-studio/${prefix}/${f.name}`,
  }));
}

async function renderYSubir(datos) {
  const png = await htmlToPng(htmlHistoriaResena(datos), { width: 1080, height: 1920 });
  const slug = (datos.nombre || "cliente").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "cliente";
  const url = await uploadStorage(`historias/${Date.now()}_${slug}.png`, png, "image/png");
  return url;
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
      const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      const raw = await callClaudeVision({
        system: "Leés capturas de pantalla de reseñas (Google, Instagram, WhatsApp) y devolvés los datos exactos. Nunca inventes ni corrijas el texto: copialo tal cual, incluidos errores. Si la imagen no es una reseña, es_resena=false.",
        prompt: "Extraé la reseña de esta captura.",
        images: [`data:${mime};base64,${b64}`],
        json_schema: SCHEMA_RESENA, max_tokens: 1500, feature: "historias",
      });
      let d = null; try { d = JSON.parse(raw); } catch {}
      if (!d || d.es_resena === false || !String(d.texto || "").trim()) return Response.json({ error: "No encontré una reseña en la captura. Probá con otra o cargá el texto a mano." }, { status: 422 });
      const datos = limpiar(d);
      const url = await renderYSubir(datos);
      return Response.json({ ok: true, url, datos });
    }
    const body = await req.json().catch(() => ({}));
    const a = body.action;
    if (a === "render") {
      const datos = limpiar(body.datos);
      if (!datos.texto) return Response.json({ error: "Falta el texto de la reseña" }, { status: 400 });
      const url = await renderYSubir(datos);
      return Response.json({ ok: true, url, datos });
    }
    if (a === "telegram") {
      const url = String(body.url || "");
      if (!url.startsWith(`${SB_URL}/storage/v1/object/public/content-studio/`)) return Response.json({ error: "URL inválida" }, { status: 400 });
      const r = await tgNotify(String(body.texto || "⭐ Historia para el destacado <b>Clientes</b>: guardala y subila desde Instagram."), { photo: url });
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
