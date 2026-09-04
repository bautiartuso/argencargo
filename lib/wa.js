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

// Textos de las plantillas aprobadas (BOT_WHATSAPP.md) — para dejar en el historial del
// admin (bot_messages) exactamente lo que recibió el cliente.
const TEMPLATE_TEXTS = {
  carga_lista: (p) => `Hola ${p[0]}! 🎉\n\nTu carga de ${p[1]} ya está lista en la oficina de Buenos Aires.\n\nEntrá acá para elegir cómo la recibís, el día y la forma de pago:\n${p[2]}\n\nCualquier duda, respondé este mensaje. ¡Gracias!`,
  recordatorio_coordinar: (p) => `Buenas ${p[0]}!\n\nTe recordamos que tu carga de ${p[1]} sigue pendiente de coordinar.\n\nElegí el día, el horario y la forma de pago acá: ${p[2]}\n\nCualquier duda, respondé este mensaje.`,
  recordatorio_almacenaje: (p) => `Hola ${p[0]}!\n\nPor favor recordá que tu carga de ${p[1]} sigue pendiente de coordinar.\n\nPodemos almacenar la mercadería durante el tiempo que necesites, pero necesitamos el pago!\n\nEn caso de que no se realice el pago, empezará a regir un *costo de almacenaje de USD 0,5 diarios por kg*.\n\nSi abonás el saldo, te la almacenamos sin cargo todo el tiempo que necesites. Coordiná y aboná acá: ${p[2]}\n\nCualquier duda, respondé este mensaje.`,
  ri_entregada: (p) => `Hola ${p[0]}! 📦\n\nTu carga de ${p[1]} ya fue entregada en tu domicilio.\n\nAcá tenés el detalle completo, la documentación y los datos para abonar:\n${p[2]}\n\nCualquier duda, respondé este mensaje. ¡Gracias!`,
  coordinacion_confirmada: (p) => `Hola ${p[0]}, quedó coordinada tu entrega de ${p[1]} ✅ ${p[2]}. Total a abonar: ${p[3]}. ${p[4]} Si necesitás cambiar el día, el horario o la forma de pago, respondé este mensaje.`,
  aviso_comprobante_img: (p) => `📎 [imagen] Actualización de la operación ${p[0]}: se recibió un comprobante de pago de ${p[1]}.\nDetalle leído: ${p[2]}.`,
  aviso_comprobante_pdf: (p) => `📎 [PDF] Actualización de la operación ${p[0]}: se recibió un comprobante de pago de ${p[1]}.\nDetalle leído: ${p[2]}.`,
};

// Deja constancia en el historial visible del admin (tabla bot_messages, service role).
// Best-effort: nunca frena un envío.
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
export async function logWaOutbound(phone, content, extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!key || !phone || !content) return;
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  try {
    await fetch(`${SB_URL}/rest/v1/bot_messages`, { method: "POST", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify({ phone, role: "assistant", content: String(content).slice(0, 4000), ...extra }) });
    await fetch(`${SB_URL}/rest/v1/bot_conversations?on_conflict=phone`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ phone, updated_at: new Date().toISOString() }) });
  } catch (e) { console.error("[lib/wa] log failed", e.message); }
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
  const r = await post({
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
  if (r?.ok) {
    const clean = params.map((p) => String(p).replace(/\s+/g, " ").trim());
    const render = TEMPLATE_TEXTS[name];
    await logWaOutbound(num, render ? render(clean) : `[plantilla ${name}] ${clean.join(" · ")}`, { wamid: r.id || null });
  }
  return r;
}

// Reenvía un media entrante (comprobante) a otro número reutilizando su media id.
// OJO: fuera de la ventana de 24 h del destinatario, Meta lo rechaza — el destinatario
// (ej. el número del dueño) tiene que haberle escrito al bot en las últimas 24 h.
// Los GRUPOS de WhatsApp no están soportados por la Cloud API (limitación de Meta).
export async function forwardWaMedia(to, mediaId, type, caption) {
  const num = waNumber(to);
  if (!num || !mediaId) return { error: "sin número o media" };
  const kind = type === "document" ? "document" : "image";
  return post({ to: num, type: kind, [kind]: { id: mediaId, caption: String(caption || "").slice(0, 900) } });
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

// Sube bytes al almacenamiento de medios de Meta (para adjuntarlos a una plantilla).
// Devuelve el media id o null.
export async function uploadWaMedia(buffer, mime, filename = "archivo") {
  if (!waConfigured() || !buffer) return null;
  const fd = new FormData();
  fd.append("messaging_product", "whatsapp");
  fd.append("type", mime);
  fd.append("file", new Blob([buffer], { type: mime }), filename);
  const r = await fetch(`${GRAPH}/${process.env.WA_PHONE_ID}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` },
    body: fd,
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) { console.error("[lib/wa] upload failed", r.status, JSON.stringify(body).slice(0, 300)); return null; }
  return body?.id || null;
}

// Plantilla aprobada con encabezado de imagen o documento (reenvío interno de comprobantes:
// llega aunque el destinatario no haya escrito en 24 h). kind: "image" | "document".
export async function sendWaMediaTemplate(to, name, { kind, mediaId, filename }, params = []) {
  const num = waNumber(to);
  if (!num || !mediaId) return { error: "sin número o media" };
  const r = await sendWaMediaTemplateRaw(num, name, { kind, mediaId, filename }, params);
  if (r?.ok) {
    const clean = params.map((p) => String(p).replace(/\s+/g, " ").trim());
    const render = TEMPLATE_TEXTS[name];
    await logWaOutbound(num, render ? render(clean) : `[plantilla ${name}] ${clean.join(" · ")}`, { wamid: r.id || null, media_type: kind });
  }
  return r;
}
async function sendWaMediaTemplateRaw(num, name, { kind, mediaId, filename }, params = []) {
  const header = kind === "document"
    ? { type: "document", document: { id: mediaId, filename: filename || "comprobante.pdf" } }
    : { type: "image", image: { id: mediaId } };
  return post({
    to: num,
    type: "template",
    template: {
      name,
      language: { code: "es_AR" },
      components: [
        { type: "header", parameters: [header] },
        ...(params.length ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: String(p).replace(/\s+/g, " ").trim().slice(0, 900) })) }] : []),
      ],
    },
  });
}
