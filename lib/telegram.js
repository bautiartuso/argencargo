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

// ── Alertas con enfriamiento (no repetir la misma alerta cada minuto) ────────
export async function tgAlert(key, text, { cooldownHours = 6 } = {}) {
  if (!tgConfigured()) return { skipped: "sin token" };
  const cfg = await tgSettings();
  const last = new Date(cfg?.alerts?.[key] || 0).getTime();
  if (Date.now() - last < cooldownHours * 3600000) return { skipped: "enfriamiento" };
  const r = await tgNotify(text);
  if (r?.ok) await tgSave({ ...cfg, alerts: { ...(cfg.alerts || {}), [key]: new Date().toISOString() } });
  return r;
}

// Detecta errores de crédito / clave en las APIs pagas y avisa (una vez cada 12 h por proveedor).
export async function reportarErrorApi(provider, e) {
  try {
    const msg = String(e?.message || e || "").toLowerCase();
    const status = e?.status || e?.statusCode || 0;
    if (provider === "claude") {
      if (status === 402 || msg.includes("credit balance") || msg.includes("billing")) return tgAlert("claude_credits", `🚨 <b>Claude API sin crédito.</b> Las funciones que usan la API (NCM, OCR, bot Argy, analista del estudio) están fallando o cayendo al plan B. Cargá crédito en console.anthropic.com → Billing (y activá la recarga automática para que no vuelva a pasar).`, { cooldownHours: 12 });
      if (status === 401 || msg.includes("invalid x-api-key") || msg.includes("authentication")) return tgAlert("claude_auth", `🚨 <b>Claude API rechaza la clave</b> (ANTHROPIC_API_KEY en Vercel). Revisala en console.anthropic.com.`, { cooldownHours: 12 });
    }
    if (provider === "fal") {
      if (status === 402 || status === 403 || msg.includes("locked") || msg.includes("top_up") || msg.includes("balance")) return tgAlert("fal_credits", `🚨 <b>fal.ai sin crédito:</b> no se pueden generar fotos reales. Las piezas con foto quedan esperando. Cargá crédito en fal.ai/dashboard/billing.`, { cooldownHours: 12 });
      if (status === 401 || msg.includes("unauthorized")) return tgAlert("fal_auth", `🚨 <b>fal.ai rechaza la clave</b> (FAL_KEY en Vercel).`, { cooldownHours: 12 });
    }
  } catch {}
  return null;
}

// Registro de consumo (para el gasto estimado del mes y las alertas de presupuesto).
const PRECIOS = [ // USD por millón de tokens [entrada, salida]
  [/opus/i, [5, 25]], [/sonnet/i, [3, 15]], [/haiku/i, [1, 5]],
];
export function costoClaude(model, input = 0, output = 0) {
  const p = (PRECIOS.find(([re]) => re.test(String(model || ""))) || [null, [5, 25]])[1];
  return Math.round(((input * p[0] + output * p[1]) / 1e6) * 100000) / 100000;
}
export function logUso({ provider, model = null, feature = null, input_tokens = null, output_tokens = null, cost_usd = 0 }) {
  if (!SB_SERVICE) return;
  sbq(`/api_usage`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ provider, model, feature, input_tokens, output_tokens, cost_usd }) }).catch(() => {});
}
