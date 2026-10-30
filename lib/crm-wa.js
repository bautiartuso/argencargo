// lib/crm-wa.js — CRM con WhatsApp (30/10/2026). El número comercial (+54 9 11 2508-8580) se conecta
// a la Cloud API en "coexistencia": sigue en el celu de Bautista y Meta nos espeja todo por el webhook
// de /api/bot/whatsapp (compartido con el bot de entregas; la separación por número está ahí).
//   messages             → lo que escriben los clientes (y los estados de lo que mandamos)
//   smb_message_echoes   → lo que Bautista manda desde el celu
//   smb_app_state_sync   → la agenda del celu (nombres)
//   history              → los últimos 6 meses de chats, una sola vez al conectar
//   account_update       → conexión / desconexión del número
// Nada de acá manda mensajes: el sistema solo lee. Guarda texto; fotos y audios se bajan al abrirlos.
import { waNumber } from "./wa";
import { tgNotify } from "./telegram";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
export const GRAPH_CRM = "https://graph.facebook.com/v26.0";
const key = () => process.env.SUPABASE_SERVICE_ROLE;
async function sb(path, { method = "GET", body, prefer = "return=representation" } = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, { method, headers: { apikey: key(), Authorization: `Bearer ${key()}`, "Content-Type": "application/json", Prefer: prefer }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => null);
  if (!r.ok) { console.error("[crm-wa] sb", method, path.slice(0, 90), r.status, JSON.stringify(d).slice(0, 200)); return null; }
  return d;
}
const MIN = "return=minimal";
const ahora = () => new Date().toISOString();

const WA_PHONE_ID = () => process.env.WA_PHONE_ID || "";
const WA_WABA_ID = () => process.env.WA_WABA_ID || "1010822298672112";
const CAMPOS_CRM = ["smb_message_echoes", "smb_app_state_sync", "history"];

// ¿Este cambio del webhook es del CRM (número comercial) o del bot de entregas?
export function esCambioCrm(change, entryId) {
  const pid = change?.value?.metadata?.phone_number_id;
  if (pid) return String(pid) !== WA_PHONE_ID();
  if (change?.field === "account_update") return String(entryId || "") !== WA_WABA_ID();
  return CAMPOS_CRM.includes(change?.field);
}

// ── Lectura de un mensaje de Meta ──
const MEDIA = ["image", "video", "document", "audio", "sticker"];
function textoDe(m) {
  const t = m?.type;
  if (t === "text") return m.text?.body || "";
  if (t === "button") return m.button?.text || "";
  if (t === "interactive") return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "";
  if (t === "reaction") return m.reaction?.emoji || "";
  if (t === "location") return [m.location?.name, m.location?.address, m.location ? `${m.location.latitude},${m.location.longitude}` : ""].filter(Boolean).join(" · ");
  if (t === "contacts") return (m.contacts || []).map((c) => c.name?.formatted_name).filter(Boolean).join(", ");
  if (MEDIA.includes(t)) return m[t]?.caption || "";
  if (t === "edit") return m.edit?.message?.text?.body || "";
  return "";
}
const mediaDe = (m) => { const x = MEDIA.includes(m?.type) ? m[m.type] : null; return x ? { media_id: x.id || null, media_mime: x.mime_type || null, media_filename: x.filename || null } : {}; };
const tsDe = (s) => (s ? new Date(Number(s) * 1000) : new Date()).toISOString();
const VISTA = { image: "📷 Foto", video: "🎥 Video", audio: "🎤 Audio", document: "📄 Documento", sticker: "Sticker", location: "📍 Ubicación", contacts: "👤 Contacto", media_placeholder: "📎 Adjunto", reaction: "Reacción" };
const vista = (m, txt) => (txt || VISTA[m?.type] || m?.type || "").slice(0, 160);

// ── Fichas ──
const nombreCliente = (cl) => [cl.first_name, cl.last_name].filter(Boolean).join(" ").trim() || cl.company_name || null;
async function clienteDe(phone) {
  const r = await sb(`/clients?select=id,first_name,last_name,company_name&whatsapp_digitos=like.*${String(phone).slice(-10)}&limit=1`);
  return Array.isArray(r) && r[0] ? r[0] : null;
}
const SEL = "id,client_id,stage,stage_manual,source,ad_source_id,unread,name,wa_name,first_in_at";
// Devuelve la ficha del teléfono (la crea si no existe) y la vincula al cliente por teléfono.
async function fichaDe(phone, datos = {}) {
  const r = await sb(`/crm_contacts?phone=eq.${phone}&select=${SEL}`);
  let c = Array.isArray(r) ? r[0] : null;
  if (c) {
    const patch = {};
    if (!c.client_id) { const cl = await clienteDe(phone); if (cl) { patch.client_id = cl.id; if (!c.name) patch.name = nombreCliente(cl); } }
    if (datos.wa_name && datos.wa_name !== c.wa_name) patch.wa_name = datos.wa_name;
    if (datos.name && datos.name !== c.name) patch.name = datos.name;
    if (Object.keys(patch).length) { await sb(`/crm_contacts?id=eq.${c.id}`, { method: "PATCH", body: patch, prefer: MIN }); Object.assign(c, patch); }
    return c;
  }
  const [cl, ag] = await Promise.all([clienteDe(phone), datos.name ? null : sb(`/crm_agenda?phone=eq.${phone}&select=name`)]);
  const nuevo = { phone, name: datos.name || (cl ? nombreCliente(cl) : null) || (Array.isArray(ag) && ag[0]?.name) || null, wa_name: datos.wa_name || null, client_id: cl?.id || null, source: datos.source || null, stage: "nuevo" };
  const ins = await sb(`/crm_contacts?on_conflict=phone`, { method: "POST", body: nuevo, prefer: "resolution=ignore-duplicates,return=representation" });
  if (Array.isArray(ins) && ins[0]) return ins[0];
  const otra = await sb(`/crm_contacts?phone=eq.${phone}&select=${SEL}`);
  return Array.isArray(otra) ? otra[0] || null : null;
}
const guardar = (fila) => sb(`/crm_messages?on_conflict=wamid`, { method: "POST", body: fila, prefer: "resolution=ignore-duplicates,return=representation" });

// ── messages: lo que escriben los clientes + estados de lo que mandamos ──
async function entrante(value) {
  const perfiles = {};
  for (const c of value.contacts || []) if (c.wa_id) perfiles[waNumber(c.wa_id)] = c.profile?.name || null;
  for (const m of value.messages || []) {
    const phone = waNumber(m.from); if (!phone) continue;
    const c = await fichaDe(phone, { wa_name: perfiles[phone] }); if (!c) continue;
    const txt = textoDe(m);
    const fila = { contact_id: c.id, phone, wamid: m.id || null, direction: "in", via: "api", type: m.type || null, text: txt || null, ...mediaDe(m), reply_to: m.context?.id || null, referral: m.referral || null, ts: tsDe(m.timestamp) };
    const ins = await guardar(fila);
    if (!Array.isArray(ins) || !ins.length) continue; // reintento de Meta: ya estaba guardado
    const patch = { last_in_at: fila.ts, last_msg_at: fila.ts, last_preview: vista(m, txt), last_direction: "in", unread: (c.unread || 0) + 1, updated_at: ahora() };
    if (!c.first_in_at) patch.first_in_at = fila.ts;
    // Atribución: el primer mensaje que llega desde un anuncio marca al contacto para siempre.
    if (m.referral && !c.ad_source_id) { const r = m.referral; Object.assign(patch, { source: "ad", ad_source_id: r.source_id || null, ad_source_url: r.source_url || null, ad_headline: r.headline || null, ad_body: r.body || null, ad_media_type: r.media_type || null, ad_ctwa_clid: r.ctwa_clid || null, ad_at: fila.ts }); }
    else if (!c.source) patch.source = "organico";
    await sb(`/crm_contacts?id=eq.${c.id}`, { method: "PATCH", body: patch, prefer: MIN });
  }
  for (const st of value.statuses || []) {
    if (st.id && st.status) await sb(`/crm_messages?wamid=eq.${encodeURIComponent(st.id)}`, { method: "PATCH", body: { status: st.status }, prefer: MIN });
  }
}

// ── smb_message_echoes: lo que Bautista manda desde el celu ──
async function ecos(value) {
  for (const m of value.message_echoes || []) {
    if (m.type === "revoke" || m.type === "edit") {
      const orig = m[m.type]?.original_message_id;
      if (orig) await sb(`/crm_messages?wamid=eq.${encodeURIComponent(orig)}`, { method: "PATCH", body: m.type === "revoke" ? { deleted: true } : { text: textoDe(m) || null }, prefer: MIN });
      continue;
    }
    const phone = waNumber(m.to); if (!phone) continue;
    const c = await fichaDe(phone); if (!c) continue;
    const txt = textoDe(m);
    const fila = { contact_id: c.id, phone, wamid: m.id || null, direction: "out", via: "app", type: m.type || null, text: txt || null, ...mediaDe(m), reply_to: m.context?.id || null, ts: tsDe(m.timestamp), status: "sent" };
    const ins = await guardar(fila);
    if (!Array.isArray(ins) || !ins.length) continue;
    const patch = { last_out_at: fila.ts, last_msg_at: fila.ts, last_preview: vista(m, txt), last_direction: "out", unread: 0, seen_at: fila.ts, updated_at: ahora() };
    if (c.stage === "nuevo" && !c.stage_manual) { patch.stage = "hablando"; patch.stage_at = fila.ts; }
    await sb(`/crm_contacts?id=eq.${c.id}`, { method: "PATCH", body: patch, prefer: MIN });
  }
}

// ── smb_app_state_sync: la agenda del celu ──
async function agenda(value) {
  for (const s of value.state_sync || []) {
    if (s.type !== "contact") continue;
    const phone = waNumber(s.contact?.phone_number); if (!phone) continue;
    if (s.action === "remove") { await sb(`/crm_agenda?phone=eq.${phone}`, { method: "DELETE", prefer: MIN }); continue; }
    const name = s.contact?.full_name || s.contact?.first_name || null; if (!name) continue;
    await sb(`/crm_agenda?on_conflict=phone`, { method: "POST", body: { phone, name, updated_at: ahora() }, prefer: "resolution=merge-duplicates,return=minimal" });
    await sb(`/crm_contacts?phone=eq.${phone}`, { method: "PATCH", body: { name, updated_at: ahora() }, prefer: MIN });
  }
}

// ── history: los últimos 6 meses de chats, en pedazos que pueden llegar desordenados ──
async function historial(value, pid) {
  const propio = String(value.metadata?.display_phone_number || "").replace(/\D/g, "");
  const tocados = new Set();
  for (const h of value.history || []) {
    if (Array.isArray(h.errors) && h.errors.length) {
      console.log("[crm-wa] history error", JSON.stringify(h.errors).slice(0, 200));
      if (pid) await sb(`/crm_numbers?phone_number_id=eq.${pid}`, { method: "PATCH", body: { history_progress: -1, updated_at: ahora() }, prefer: MIN });
      continue;
    }
    const filas = [];
    for (const th of h.threads || []) {
      const phone = waNumber(th.id); if (!phone) continue;
      const c = await fichaDe(phone, { source: "historial" }); if (!c) continue;
      tocados.add(phone);
      for (const m of th.messages || []) {
        const from = String(m.from || "").replace(/\D/g, "");
        const out = !!m.to || (propio && from === propio) || (from && waNumber(from) !== phone);
        const txt = textoDe(m);
        filas.push({ contact_id: c.id, phone, wamid: m.id || null, direction: out ? "out" : "in", via: "history", type: m.type || null, text: txt || null, ...mediaDe(m), reply_to: m.context?.id || null, ts: tsDe(m.timestamp), status: m.history_context?.status ? String(m.history_context.status).toLowerCase() : null });
      }
    }
    for (let i = 0; i < filas.length; i += 200) await sb(`/crm_messages?on_conflict=wamid`, { method: "POST", body: filas.slice(i, i + 200), prefer: "resolution=ignore-duplicates,return=minimal" });
    const prog = Number(h.metadata?.progress);
    if (pid && !isNaN(prog)) await sb(`/crm_numbers?phone_number_id=eq.${pid}`, { method: "PATCH", body: { history_progress: prog, updated_at: ahora() }, prefer: MIN });
    console.log("[crm-wa] history", `fase ${h.metadata?.phase} pedazo ${h.metadata?.chunk_order} ${prog}%`, filas.length, "mensajes");
  }
  if (tocados.size) await sb(`/rpc/crm_recalcular_contactos`, { method: "POST", body: { p_phones: [...tocados] }, prefer: MIN });
}

// ── account_update: el número se conectó / desconectó ──
async function cuenta(value, entryId) {
  const ev = value?.event || "";
  const waba = value?.waba_info?.waba_id || entryId || null;
  const reason = value?.disconnection_info?.reason || null;
  console.log("[crm-wa] account_update", ev, waba, reason);
  if (!waba) return;
  const patch = ev === "PARTNER_REMOVED" ? { status: "desconectado", disconnect_reason: reason, disconnected_at: ahora() }
    : ev === "ACCOUNT_OFFBOARDED" ? { status: "reconectando", disconnect_reason: reason }
    : ev === "ACCOUNT_RECONNECTED" || ev === "PARTNER_ADDED" ? { status: "conectado", disconnect_reason: null } : null;
  if (!patch) return;
  await sb(`/crm_numbers?waba_id=eq.${waba}`, { method: "PATCH", body: { ...patch, updated_at: ahora() }, prefer: MIN });
  if (ev === "PARTNER_REMOVED") await tgNotify(`📵 El WhatsApp comercial se desconectó del CRM (${reason || ev}). Si fue por no abrir la app en 14 días, hay que volver a conectarlo desde /crm.`).catch(() => {});
  if (ev === "ACCOUNT_RECONNECTED") await tgNotify("✅ El WhatsApp comercial volvió a conectarse al CRM.").catch(() => {});
}

export async function procesarCambiosCrm(cambios) {
  for (const c of cambios || []) {
    const v = c.value || {};
    try {
      if (c.field === "messages") await entrante(v);
      else if (c.field === "smb_message_echoes") await ecos(v);
      else if (c.field === "smb_app_state_sync") await agenda(v);
      else if (c.field === "history") await historial(v, v.metadata?.phone_number_id || null);
      else if (c.field === "account_update") await cuenta(v, c.entry_id);
      else console.log("[crm-wa] campo ignorado", c.field);
    } catch (e) { console.error("[crm-wa]", c.field, e.message); }
  }
}
