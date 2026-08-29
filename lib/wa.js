// lib/wa.js — envío de WhatsApp por la Cloud API de Meta (bot de entregas).
//
// Regla de oro del costo: los mensajes AUTOMÁTICOS (aviso de carga lista,
// recordatorios, confirmación de coordinación) son PLANTILLAS fijas — cero IA.
// La IA solo corre cuando el cliente escribe (app/api/bot/whatsapp).
//
// Cloud API: para INICIAR una conversación (fuera de la ventana de 24 h desde el
// último mensaje del cliente) solo se permiten plantillas aprobadas por Meta.
// Los nombres/textos exactos a cargar en Meta están en BOT_WHATSAPP.md.
//
// Sin WA_TOKEN/WA_PHONE_ID configurados, todo es no-op (devuelve {skipped:true}):
// el código queda listo y se enciende solo al cargar las credenciales en Vercel.

const GRAPH = "https://graph.facebook.com/v21.0";

export function waConfigured() {
  return !!(process.env.WA_TOKEN && process.env.WA_PHONE_ID);
}

// Los teléfonos del sistema vienen en formatos mezclados ("+54 9 11...", "11-...").
// La Cloud API espera solo dígitos con código de país; se asume AR si faltan.
export function waNumber(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("549") && d.length >= 12) return d;
  if (d.startsWith("54") && d.length >= 11) return d;
  if (d.length === 10) return `549${d}`; // 11XXXXXXXX → 54911XXXXXXXX
  return d.length >= 11 ? d : null;
}

async function post(payload) {
  if (!waConfigured()) return { skipped: true };
  const r = await fetch(`${GRAPH}/${process.env.WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    console.error("[lib/wa] send failed", r.status, JSON.stringify(body).slice(0, 300));
    return { error: body?.error?.message || `HTTP ${r.status}` };
  }
  return { ok: true, id: body?.messages?.[0]?.id };
}

// Texto libre — SOLO llega si hay ventana de 24 h abierta (el cliente escribió antes).
export async function sendWaText(to, body) {
  const num = waNumber(to);
  if (!num) return { error: "sin número" };
  return post({ to: num, type: "text", text: { body: String(body).slice(0, 4000) } });
}

// Plantilla aprobada. params = array de strings para {{1}}..{{n}} del body.
// Meta no admite saltos de línea ni tabs dentro de un parámetro — se sanitizan.
export async function sendWaTemplate(to, name, params = []) {
  const num = waNumber(to);
  if (!num) return { error: "sin número" };
  return post({
    to: num,
    type: "template",
    template: {
      name,
      language: { code: "es_AR" },
      components: params.length ? [{
        type: "body",
        parameters: params.map((p) => ({ type: "text", text: String(p).replace(/\s+/g, " ").trim().slice(0, 900) })),
      }] : [],
    },
  });
}

// Descarga un media entrante (comprobantes): id → URL efímera → bytes.
export async function fetchWaMedia(mediaId) {
  if (!waConfigured()) return null;
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` } }).then((r) => r.ok ? r.json() : null);
  if (!meta?.url) return null;
  const bin = await fetch(meta.url, { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` } });
  if (!bin.ok) return null;
  return { buffer: Buffer.from(await bin.arrayBuffer()), mime: meta.mime_type || "application/octet-stream" };
}
