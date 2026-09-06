// lib/telegram.js — avisos gratis por Telegram (bot de @BotFather, TELEGRAM_BOT_TOKEN en Vercel).
// El chat de Bautista se detecta solo: cuando le manda /start al bot, getUpdates lo devuelve y se guarda
// en cs_settings 'telegram' {chat_id, username, first_name, connected_at}.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || "";
export const tgConfigured = () => !!TOKEN();

async function sbq(pathq, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${pathq}`, { ...opts, headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: opts.method === "POST" ? "resolution=merge-duplicates,return=representation" : undefined, ...(opts.headers || {}) } });
  const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch {}
  return { status: r.status, body: b };
}

async function tg(method, body) {
  if (!TOKEN()) throw new Error("TELEGRAM_BOT_TOKEN no configurado");
  const r = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || `telegram HTTP ${r.status}`);
  return j.result;
}

export async function tgSettings() {
  const r = await sbq(`/cs_settings?key=eq.telegram&select=value`);
  return Array.isArray(r.body) && r.body[0] ? r.body[0].value || {} : {};
}
async function tgSave(cfg) {
  await sbq(`/cs_settings?on_conflict=key`, { method: "POST", body: JSON.stringify({ key: "telegram", value: cfg, updated_at: new Date().toISOString() }) });
}
export async function tgDisconnect() { await sbq(`/cs_settings?key=eq.telegram`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); }

// Busca el último chat privado que le escribió al bot (el /start de Bautista) y lo guarda.
export async function tgDiscoverChat() {
  const upd = await tg("getUpdates", { limit: 100, allowed_updates: ["message"] });
  const msgs = (Array.isArray(upd) ? upd : []).map((u) => u.message).filter((m) => m && m.chat && m.chat.type === "private");
  if (!msgs.length) return null;
  const m = msgs[msgs.length - 1];
  const cfg = { chat_id: String(m.chat.id), username: m.chat.username || null, first_name: m.chat.first_name || null, connected_at: new Date().toISOString() };
  await tgSave(cfg);
  return cfg;
}

// Manda texto (HTML), una foto con texto, o varias fotos (hasta 10) con el texto en la primera.
export async function tgNotify(text, { photo = null, photos = null } = {}) {
  if (!tgConfigured()) return { skipped: "sin token" };
  let cfg = await tgSettings();
  if (!cfg.chat_id) { try { cfg = await tgDiscoverChat(); } catch (e) { return { error: e.message }; } }
  if (!cfg?.chat_id) return { skipped: "sin chat: mandale /start al bot" };
  try {
    const list = Array.isArray(photos) ? photos.filter(Boolean).slice(0, 10) : photo ? [photo] : [];
    if (list.length > 1) await tg("sendMediaGroup", { chat_id: cfg.chat_id, media: list.map((u, i) => ({ type: "photo", media: u, ...(i === 0 ? { caption: text.slice(0, 1024), parse_mode: "HTML" } : {}) })) });
    else if (list.length === 1) await tg("sendPhoto", { chat_id: cfg.chat_id, photo: list[0], caption: text.slice(0, 1024), parse_mode: "HTML" });
    else await tg("sendMessage", { chat_id: cfg.chat_id, text: text.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true });
    return { ok: true };
  } catch (e) { console.error("[telegram]", e.message); return { error: e.message }; }
}
