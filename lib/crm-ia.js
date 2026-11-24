// lib/crm-ia.js — el saludo automático de la IA a los contactos fríos (23/11/2026).
// Apagado por defecto (crm_numbers.ia_enabled). A quién le toca lo decide la base
// (crm_personas_v.ia_apto, con los mismos descansos del seguimiento a mano); acá solo se manda.
// Fuera de las 24 h del último mensaje del cliente Meta solo deja mandar una plantilla aprobada, y
// la cobra: por eso el saludo es un texto fijo y hay un tope por día. Cuando la persona contesta,
// la charla pasa a una persona (aviso por Telegram) y la IA no le escribe más.
import { GRAPH_CRM, tokenVigente } from "./crm-wa";
import { waNumber } from "./wa";
import { apodoDe } from "./apodos";
import { tgNotify } from "./telegram";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const sbh = (extra = {}) => { const k = process.env.SUPABASE_SERVICE_ROLE; return { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", ...extra }; };
const sb = (p, o = {}) => fetch(`${SB_URL}/rest/v1${p}`, { ...o, headers: sbh(o.headers || {}), cache: "no-store" });
const leer = (p) => sb(p).then((r) => r.json()).then((r) => (Array.isArray(r) ? r : [])).catch(() => []);
const MIN = { Prefer: "return=minimal" };

export const PLANTILLA_IA = { nombre: "saludo_seguimiento", idioma: "es_AR", texto: "Hola {{1}}, cómo estás? Todo bien?" };
export const textoSaludo = (nombre) => PLANTILLA_IA.texto.replace("{{1}}", nombre);

export const numeroCrm = () => leer(`/crm_numbers?select=phone_number_id,waba_id,token,status,ia_enabled,ia_por_dia&status=eq.conectado&order=connected_at.desc&limit=1`).then((r) => r[0] || null);

// Estado de la plantilla en Meta: APPROVED | PENDING | REJECTED | … o null si no existe.
export async function estadoPlantilla(num, token) {
  if (!num?.waba_id || !token) return null;
  const r = await fetch(`${GRAPH_CRM}/${num.waba_id}/message_templates?name=${PLANTILLA_IA.nombre}&fields=name,status,language,category&limit=10`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
  const d = await r?.json().catch(() => null);
  const t = (d?.data || []).find((x) => x.name === PLANTILLA_IA.nombre);
  return t ? { estado: t.status, categoria: t.category || null } : null;
}
export async function crearPlantilla(num, token) {
  const r = await fetch(`${GRAPH_CRM}/${num.waba_id}/message_templates`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: PLANTILLA_IA.nombre, language: PLANTILLA_IA.idioma, category: "MARKETING", components: [{ type: "BODY", text: PLANTILLA_IA.texto, example: { body_text: [["Martín"]] } }] }) });
  const d = await r.json().catch(() => null);
  if (!r.ok) return { error: d?.error?.error_user_msg || d?.error?.message || `Meta devolvió ${r.status}` };
  return { ok: true, estado: d?.status || "PENDING" };
}

// Cuántos saludos salieron hoy (día de Argentina).
export async function enviadosHoy() {
  const desde = new Date(new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10) + "T03:00:00Z").toISOString();
  const r = await sb(`/crm_ia_envios?estado=neq.fallo&created_at=gte.${encodeURIComponent(desde)}&select=id`, { headers: { Prefer: "count=exact", Range: "0-0" } });
  return Number((r.headers.get("content-range") || "").split("/")[1] || 0);
}
export const candidatos = (limite) => sb(`/rpc/crm_ia_candidatos`, { method: "POST", body: JSON.stringify({ p_limit: limite }) }).then((r) => r.json()).then((r) => (Array.isArray(r) ? r : [])).catch(() => []);

// Manda el saludo a una persona (fila de crm_personas_v) y deja todo registrado: el mensaje en su
// chat, el contacto en el seguimiento (cuenta para los descansos) y el envío de la IA.
export async function mandarSaludo(num, token, p) {
  const phone = waNumber(p.phone);
  const nombre = apodoDe(p.first_name || p.wa_name || "");
  const base = { clave: p.clave, client_id: p.id || null, contact_id: p.contact_id || null, phone: phone || String(p.phone || ""), nombre: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.wa_name || null, plantilla: PLANTILLA_IA.nombre };
  const falla = async (error) => { await sb(`/crm_ia_envios`, { method: "POST", headers: MIN, body: JSON.stringify({ ...base, estado: "fallo", error: String(error).slice(0, 300) }) }); return { error }; };
  if (!phone) return falla("Teléfono inválido");
  if (!nombre) return falla("Sin nombre de pila para el saludo");

  const r = await fetch(`${GRAPH_CRM}/${num.phone_number_id}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "template", template: { name: PLANTILLA_IA.nombre, language: { code: PLANTILLA_IA.idioma }, components: [{ type: "body", parameters: [{ type: "text", text: nombre }] }] } }) }).catch((e) => ({ ok: false, json: async () => ({ error: { message: e.message } }) }));
  const d = await r.json().catch(() => null);
  if (!r.ok) return falla(d?.error?.message || `Meta devolvió ${r.status}`);
  const wamid = d?.messages?.[0]?.id || null;
  const ts = new Date().toISOString();
  const texto = textoSaludo(nombre);

  // La ficha del chat (se crea si el cliente todavía no tenía).
  let contactId = p.contact_id;
  if (!contactId) {
    const ya = await leer(`/crm_contacts?phone=eq.${phone}&select=id`);
    contactId = ya[0]?.id || null;
    if (!contactId) {
      const ins = await sb(`/crm_contacts?on_conflict=phone`, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ phone, client_id: p.id || null, name: base.nombre, source: "cliente", stage: "nuevo" }) }).then((x) => x.json()).catch(() => null);
      contactId = Array.isArray(ins) ? ins[0]?.id || null : null;
    }
  }
  await Promise.all([
    sb(`/crm_ia_envios`, { method: "POST", headers: MIN, body: JSON.stringify({ ...base, contact_id: contactId, estado: "enviado", wamid }) }),
    contactId && sb(`/crm_messages`, { method: "POST", headers: MIN, body: JSON.stringify({ contact_id: contactId, phone, wamid, direction: "out", via: "ia", type: "text", text: texto, ts, status: "sent" }) }),
    contactId && sb(`/crm_contacts?id=eq.${contactId}`, { method: "PATCH", headers: MIN, body: JSON.stringify({ last_out_at: ts, last_msg_at: ts, last_preview: texto.slice(0, 160), last_direction: "out", updated_at: ts, ...(p.id ? {} : { followup_status: "contactado" }) }) }),
    sb(`/client_followups`, { method: "POST", headers: MIN, body: JSON.stringify({ client_id: p.id || null, contact_id: p.id ? null : contactId, channel: "whatsapp", outcome: "enviado", note: "Saludo automático de la IA" }) }),
    p.id && sb(`/clients?id=eq.${p.id}`, { method: "PATCH", headers: MIN, body: JSON.stringify({ last_followup_at: ts, ...(p.followup_status === "sin_contacto" || !p.followup_status ? { followup_status: "contactado" } : {}) }) }),
  ].filter(Boolean));
  // El saludo cambia la huella de la persona; se deja al día para que no se la vuelva a analizar por
  // un mensaje que mandó la propia IA (se analiza de nuevo cuando conteste).
  const nueva = await leer(`/crm_personas_v?clave=eq.${encodeURIComponent(p.clave)}&select=firma`);
  if (nueva[0]?.firma) await sb(`/crm_analisis?on_conflict=clave`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ clave: p.clave, client_id: p.id || null, contact_id: p.id ? null : contactId, firma: nueva[0].firma, ...(p.temperatura ? {} : { temperatura: "frio", quien: "ia", analizado_at: ts }), updated_at: ts }) });
  return { ok: true, wamid, nombre };
}

// Lo llama el webhook cuando entra un mensaje: si esa persona tenía un saludo de la IA sin contestar,
// se marca como respondido y se avisa. Devuelve true si era una respuesta a la IA.
export async function respondioALaIa(phone, texto) {
  const hace14 = new Date(Date.now() - 14 * 864e5).toISOString();
  const pend = await leer(`/crm_ia_envios?phone=eq.${phone}&estado=eq.enviado&created_at=gt.${encodeURIComponent(hace14)}&select=id,nombre&order=created_at.desc&limit=1`);
  if (!pend.length) return false;
  await sb(`/crm_ia_envios?phone=eq.${phone}&estado=eq.enviado`, { method: "PATCH", headers: MIN, body: JSON.stringify({ estado: "respondio", respondio_at: new Date().toISOString() }) });
  await tgNotify(`🤖 ${pend[0].nombre || phone} le contestó al saludo de la IA${texto ? `: «${String(texto).slice(0, 200)}»` : ""}\nLa charla quedó en Chats para que la sigas vos.`).catch(() => {});
  return true;
}
