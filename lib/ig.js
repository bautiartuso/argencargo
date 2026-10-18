// lib/ig.js — bot de Instagram de Argencargo: NO conversa, deriva todo a WhatsApp.
//
// Cada DM y cada comentario de una cuenta ajena recibe UNA sola respuesta que manda al
// WhatsApp (wa.me/5491125088580). Nada de IA, nada de historial: textos fijos editables
// desde la solapa Bot del admin (cs_settings 'ig_dm_text' / 'ig_comment_text').
//
// Credenciales (orden de prioridad):
//   1) Env de Vercel: IG_PAGE_TOKEN (token de página de larga duración, con
//      instagram_manage_messages + instagram_manage_comments + pages_manage_metadata)
//      e IG_USER_ID (id de la cuenta profesional de Instagram).
//   2) La cuenta de Instagram conectada en el Estudio (cs_settings 'instagram'): sirve si
//      ese token tiene los permisos de mensajes; si no, Meta rechaza el envío y se avisa.
//
// Dedupe persistente en Storage (bucket privado solfin-comprobantes, carpeta _ig/, el mismo
// truco que usa el bot de WhatsApp con _wamid/): creación atómica (x-upsert:false) por id de
// mensaje y por id de comentario (Meta reintenta el webhook), y un marcador por usuario con
// la fecha del último DM para volver a contestarle solo si pasaron más de 7 días.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = () => process.env.SUPABASE_SERVICE_ROLE;
const BUCKET = "solfin-comprobantes";
export const IG_WA_LINK = "https://wa.me/5491125088580";
export const IG_DM_DEFAULT = `Hola! Por acá no gestionamos consultas 🙂 Escribinos al WhatsApp y te respondemos al toque 👉 ${IG_WA_LINK}`;
export const IG_COMMENT_DEFAULT = "¡Hola! Te escribimos por privado 👋";
export const IG_REPLY_DAYS = 7;

async function sbq(pathq, opts = {}) {
  const key = SB_SERVICE();
  const r = await fetch(`${SB_URL}/rest/v1${pathq}`, { ...opts, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: opts.method === "POST" ? "resolution=merge-duplicates,return=representation" : undefined, ...(opts.headers || {}) } });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch {}
  return { status: r.status, body: b };
}

// ── Configuración ────────────────────────────────────────────────────────────
export async function igBotConfig() {
  if (process.env.IG_PAGE_TOKEN && process.env.IG_USER_ID) {
    return { ok: true, source: "env", host: "https://graph.facebook.com/v21.0", token: process.env.IG_PAGE_TOKEN, igUserId: String(process.env.IG_USER_ID) };
  }
  try {
    const r = await sbq(`/cs_settings?key=eq.instagram&select=value`);
    const cfg = Array.isArray(r.body) && r.body[0] ? r.body[0].value || {} : {};
    if (cfg.access_token && cfg.ig_user_id) {
      return { ok: true, source: "estudio", username: cfg.username || null, host: cfg.mode === "ig_login" ? "https://graph.instagram.com/v21.0" : "https://graph.facebook.com/v21.0", token: cfg.access_token, igUserId: String(cfg.ig_user_id) };
    }
  } catch {}
  return { ok: false, source: null };
}

// Textos editables (solapa Bot → Instagram). Sin fila → el texto por defecto.
export async function igTexts() {
  const r = await sbq(`/cs_settings?key=in.(ig_dm_text,ig_comment_text)&select=key,value`);
  const rows = Array.isArray(r.body) ? r.body : [];
  const get = (k) => { const v = rows.find((x) => x.key === k)?.value; const t = v && typeof v === "object" ? v.text : v; return typeof t === "string" && t.trim() ? t.trim() : null; };
  return { dm_text: get("ig_dm_text") || IG_DM_DEFAULT, comment_text: get("ig_comment_text") || IG_COMMENT_DEFAULT };
}
export async function igSaveTexts({ dm_text, comment_text }) {
  const now = new Date().toISOString();
  const rows = [
    { key: "ig_dm_text", value: { text: String(dm_text || "").trim().slice(0, 900) || IG_DM_DEFAULT }, updated_at: now },
    { key: "ig_comment_text", value: { text: String(comment_text || "").trim().slice(0, 300) || IG_COMMENT_DEFAULT }, updated_at: now },
  ];
  const r = await sbq(`/cs_settings?on_conflict=key`, { method: "POST", body: JSON.stringify(rows) });
  if (r.status >= 300) throw new Error(r.body?.message || `No se pudo guardar (HTTP ${r.status})`);
}

// Contador para la solapa Bot (best-effort, cs_settings 'instagram_bot').
export async function igStats() {
  const r = await sbq(`/cs_settings?key=eq.instagram_bot&select=value`);
  return Array.isArray(r.body) && r.body[0] ? r.body[0].value || {} : {};
}
export async function igBumpStats(kind) {
  try {
    const s = await igStats();
    const v = { ...s, [kind]: Number(s[kind] || 0) + 1, last_at: new Date().toISOString(), last_kind: kind };
    await sbq(`/cs_settings?on_conflict=key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "instagram_bot", value: v, updated_at: v.last_at }) });
  } catch (e) { console.error("[ig] stats", e.message); }
}

// ── Dedupe en Storage ────────────────────────────────────────────────────────
const objUrl = (path) => `${SB_URL}/storage/v1/object/${BUCKET}/_ig/${path}`;
const stHeaders = (extra = {}) => ({ Authorization: `Bearer ${SB_SERVICE()}`, apikey: SB_SERVICE(), ...extra });

// Crea el marcador si no existe. true = recién creado (primera vez); false = ya existía.
async function claim(path, content = "1") {
  const r = await fetch(objUrl(path), { method: "POST", headers: stHeaders({ "Content-Type": "text/plain", "x-upsert": "false" }), body: content }).catch(() => null);
  if (!r) return true; // Storage caído: mejor contestar de más que de menos
  if (r.ok) return true;
  const t = await r.text().catch(() => "");
  if (/exist|duplicate/i.test(t) || r.status === 409) return false;
  console.error("[ig] claim", r.status, t.slice(0, 200));
  return true;
}
async function readMarker(path) {
  const r = await fetch(objUrl(path), { headers: stHeaders() }).catch(() => null);
  if (!r || !r.ok) return null;
  return (await r.text().catch(() => "")).trim();
}
async function writeMarker(path, content) {
  await fetch(objUrl(path), { method: "POST", headers: stHeaders({ "Content-Type": "text/plain", "x-upsert": "true" }), body: content }).catch(() => {});
}
async function dropMarker(path) {
  await fetch(objUrl(path), { method: "DELETE", headers: stHeaders() }).catch(() => {});
}

// Un evento de Meta (mensaje o comentario) se procesa una sola vez aunque el webhook se reintente.
export const igClaimEvent = (kind, id) => claim(`${kind}/${encodeURIComponent(String(id))}.txt`);
// Un usuario recibe el DM a lo sumo una vez cada IG_REPLY_DAYS días (DM directo o privado por comentario).
export async function igClaimUser(igsid) {
  const path = `user/${encodeURIComponent(String(igsid))}.txt`;
  const now = new Date().toISOString();
  if (await claim(path, now)) return true;
  const last = await readMarker(path);
  const t = last ? new Date(last).getTime() : 0;
  if (t && Date.now() - t < IG_REPLY_DAYS * 86400000) return false;
  await writeMarker(path, now);
  return true;
}
export const igReleaseUser = (igsid) => dropMarker(`user/${encodeURIComponent(String(igsid))}.txt`);

// ── Graph API ────────────────────────────────────────────────────────────────
async function graph(cfg, path, payload) {
  const r = await fetch(`${cfg.host}/${path}`, { method: "POST", headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error?.message || `HTTP ${r.status}`;
    console.error("[ig] graph", path, r.status, msg);
    return { error: msg, code: j?.error?.code || r.status };
  }
  return { ok: true, id: j.message_id || j.id || null };
}
// Send API: "me/messages" resuelve a la página (token de página) o a la cuenta de Instagram
// (inicio de sesión de Instagram), así que sirve para los dos modos.
// DM a un usuario que nos escribió (ventana de 24 h de Meta).
export const igSendDm = (cfg, igsid, text) => graph(cfg, `me/messages`, { recipient: { id: String(igsid) }, message: { text: String(text).slice(0, 1000) } });
// DM privado al autor de un comentario (permitido hasta 7 días después del comentario).
export const igPrivateReply = (cfg, commentId, text) => graph(cfg, `me/messages`, { recipient: { comment_id: String(commentId) }, message: { text: String(text).slice(0, 1000) } });
// Respuesta pública debajo del comentario.
export const igPublicReply = (cfg, commentId, text) => graph(cfg, `${encodeURIComponent(String(commentId))}/replies`, { message: String(text).slice(0, 300) });
