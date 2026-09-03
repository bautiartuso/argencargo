// POST /api/admin/extract-packages — lee la foto del desglose de bultos del courier
// (la que sube el agente al despachar) con visión de Claude y devuelve las filas
// estructuradas: peso real y dimensiones por bulto. El admin las revisa, asigna a la
// operación que corresponda (los vuelos multi-op no se adivinan) y las aplica.
//
// Body: { flight_id }  →  { bultos: [{peso_kg, largo_cm, ancho_cm, alto_cm}], total_kg }

import { callClaudeVision } from "../../../../lib/anthropic";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 60;

async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } });
  return r.ok ? r.json() : null;
}

async function isAdmin(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64").toString());
    const p = await sb(`/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p) && p[0]?.role === "admin";
  } catch { return false; }
}

export async function POST(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body = null; try { body = await req.json(); } catch {}
  if (!body?.flight_id) return Response.json({ error: "flight_id requerido" }, { status: 400 });

  const fl = await sb(`/flights?id=eq.${body.flight_id}&select=dispatch_photo_url,flight_code&limit=1`);
  const flight = Array.isArray(fl) && fl[0];
  if (!flight?.dispatch_photo_url) return Response.json({ error: "El vuelo no tiene foto del desglose cargada" }, { status: 400 });

  const imgRes = await fetch(flight.dispatch_photo_url);
  if (!imgRes.ok) return Response.json({ error: "No se pudo descargar la foto" }, { status: 502 });
  const mime = imgRes.headers.get("content-type") || "image/jpeg";
  const b64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");

  try {
    const raw = await callClaudeVision({
      system: "Extraés datos de capturas de sistemas de couriers chinos (tablas de bultos). Devolvés SOLO el JSON pedido, sin comentarios.",
      prompt: `La imagen es una tabla de bultos de un sistema de courier (columnas típicas en chino: 序号=nro, 实重=peso real kg, 长/宽/高=largo/ancho/alto cm, 材重=peso volumétrico, 收费重=peso facturable, 体积=volumen).
Extraé UNA fila por bulto con: peso real en kg (实重), largo, ancho y alto en cm (长, 宽, 高). Ignorá totales del pie y columnas que no pido. Si un valor no se lee, poné null.`,
      images: [b64],
      media_type: mime,
      max_tokens: 3000,
      json_schema: {
        type: "object",
        properties: {
          bultos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                peso_kg: { type: ["number", "null"] },
                largo_cm: { type: ["number", "null"] },
                ancho_cm: { type: ["number", "null"] },
                alto_cm: { type: ["number", "null"] },
              },
              required: ["peso_kg", "largo_cm", "ancho_cm", "alto_cm"],
            },
          },
        },
        required: ["bultos"],
      },
    });
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const bultos = (parsed?.bultos || []).filter((b) => b.peso_kg != null || b.largo_cm != null);
    if (bultos.length === 0) return Response.json({ error: "No se pudieron leer bultos de la foto" }, { status: 422 });
    const total = Math.round(bultos.reduce((a, b) => a + Number(b.peso_kg || 0), 0) * 100) / 100;
    return Response.json({ ok: true, bultos, total_kg: total, flight_code: flight.flight_code });
  } catch (e) {
    return Response.json({ error: `No se pudo procesar la imagen: ${String(e.message).slice(0, 200)}` }, { status: 502 });
  }
}
