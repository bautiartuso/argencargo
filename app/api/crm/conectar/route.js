// /api/crm/conectar — alta del número comercial en el CRM (coexistencia, 30/10/2026).
//
// POST {code, phone_number_id, waba_id, business_id} → lo manda el navegador al terminar el
// Embedded Signup de Meta (app/crm/page.js). Pasos, cada uno informado por separado:
//   1. cambia el code por un token de negocio (no vence; queda en crm_numbers, que solo lee el servidor)
//   2. suscribe la app a la WABA nueva (si no, Meta no manda los webhooks de ese número)
//   3. se asegura de que la app esté suscripta a los campos del CRM (ecos, agenda, historial, cuenta)
//   4. pide la agenda y los últimos 6 meses de chats (Meta deja pedirlos una sola vez, dentro de las 24 h)
//   5. lee el número y lo guarda
// POST {accion:"reintentar", phone_number_id} → repite 2, 3 y 5 con el token guardado.
// GET → estado para la pantalla Conexión (sin el token).
//
// Env: NEXT_PUBLIC_META_APP_ID (id de la app de Meta) · la clave secreta de esa app es alguna de
// WA_APP_SECRET / META_APP_SECRET / IG_APP_SECRET (se prueban en orden) · WA_VERIFY_TOKEN · PUBLIC_BASE_URL
import { usuarioConRol } from "../../../../lib/auth-server";
import { GRAPH_CRM } from "../../../../lib/crm-wa";

export const maxDuration = 60;
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const APP_ID = () => process.env.NEXT_PUBLIC_META_APP_ID || "";
const SECRETOS = () => [process.env.WA_APP_SECRET, process.env.META_APP_SECRET, process.env.IG_APP_SECRET].filter(Boolean);
const CAMPOS = ["messages", "smb_message_echoes", "smb_app_state_sync", "history", "account_update"];

const sbh = () => { const k = process.env.SUPABASE_SERVICE_ROLE; return { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json" }; };
async function graph(path, { token, method = "GET", body, form } = {}) {
  const r = await fetch(`${GRAPH_CRM}/${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : form ? new URLSearchParams(form) : undefined });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error?.message ? `${d.error.message} (código ${d.error.code}${d.error.error_subcode ? "/" + d.error.error_subcode : ""})` : `HTTP ${r.status}`);
  return d;
}
const numeroGuardado = async (pid) => (await fetch(`${SB_URL}/rest/v1/crm_numbers?phone_number_id=eq.${encodeURIComponent(pid)}&select=*`, { headers: sbh(), cache: "no-store" }).then((r) => r.json()).catch(() => []))?.[0] || null;

// 1. code → token de negocio. Se prueba cada clave secreta cargada hasta dar con la de esta app.
async function canjear(code) {
  let ultimo = "sin clave secreta cargada";
  for (const secret of SECRETOS()) {
    try {
      const d = await graph(`oauth/access_token?client_id=${APP_ID()}&client_secret=${secret}&code=${encodeURIComponent(code)}`);
      if (d?.access_token) return { token: d.access_token, secret };
    } catch (e) { ultimo = e.message; }
  }
  throw new Error(ultimo);
}

// 3. Campos del webhook de la app (a nivel app, para todas las WABAs). Lee los actuales y agrega los que faltan.
async function asegurarCampos(secret) {
  const appToken = `${APP_ID()}|${secret}`;
  const d = await graph(`${APP_ID()}/subscriptions?access_token=${appToken}`);
  const wa = (d?.data || []).find((s) => s.object === "whatsapp_business_account");
  const tiene = (wa?.fields || []).map((f) => (typeof f === "string" ? f : f.name));
  const faltan = CAMPOS.filter((c) => !tiene.includes(c));
  if (!faltan.length) return { campos: tiene, agregados: [] };
  const callback = wa?.callback_url || `${process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar"}/api/bot/whatsapp`;
  await graph(`${APP_ID()}/subscriptions`, { method: "POST", form: { access_token: appToken, object: "whatsapp_business_account", callback_url: callback, verify_token: process.env.WA_VERIFY_TOKEN || "", fields: [...new Set([...tiene, ...CAMPOS])].join(","), include_values: "true" } });
  return { campos: [...new Set([...tiene, ...CAMPOS])], agregados: faltan, callback };
}

async function pasosComunes(token, secret, waba_id, phone_number_id, pasos) {
  try { await graph(`${waba_id}/subscribed_apps`, { token, method: "POST" }); pasos.push({ k: "suscripcion", ok: true, t: "App suscripta a la cuenta de WhatsApp del número" }); }
  catch (e) { pasos.push({ k: "suscripcion", ok: false, t: `No se pudo suscribir la app a la cuenta: ${e.message}` }); }
  if (secret) {
    try { const c = await asegurarCampos(secret); pasos.push({ k: "campos", ok: true, t: c.agregados.length ? `Campos del webhook agregados: ${c.agregados.join(", ")}` : "Campos del webhook ya estaban", campos: c.campos }); }
    catch (e) { pasos.push({ k: "campos", ok: false, t: `No se pudieron revisar los campos del webhook: ${e.message}` }); }
  }
  let info = null;
  try { info = await graph(`${phone_number_id}?fields=display_phone_number,verified_name,is_on_biz_app,platform_type,quality_rating`, { token }); pasos.push({ k: "numero", ok: true, t: `Número ${info.display_phone_number || ""} · ${info.is_on_biz_app ? "sigue en la app del celu" : "NO figura en la app del celu"} · ${info.platform_type || ""}` }); }
  catch (e) { pasos.push({ k: "numero", ok: false, t: `No se pudo leer el número: ${e.message}` }); }
  return info;
}

export async function POST(req) {
  const u = await usuarioConRol(req, ["admin"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const pasos = [];
  const ahora = new Date().toISOString();

  if (b.accion === "reintentar") {
    const n = await numeroGuardado(b.phone_number_id);
    if (!n?.token) return Response.json({ error: "Ese número no está guardado" }, { status: 404 });
    const secret = SECRETOS()[0] || null;
    const info = await pasosComunes(n.token, secret, n.waba_id, n.phone_number_id, pasos);
    await fetch(`${SB_URL}/rest/v1/crm_numbers?phone_number_id=eq.${encodeURIComponent(n.phone_number_id)}`, { method: "PATCH", headers: { ...sbh(), Prefer: "return=minimal" }, body: JSON.stringify({ display_phone: info?.display_phone_number || n.display_phone, is_on_biz_app: info?.is_on_biz_app ?? n.is_on_biz_app, updated_at: ahora }) });
    return Response.json({ ok: pasos.every((p) => p.ok), pasos });
  }

  const { code, phone_number_id, waba_id, business_id } = b;
  if (!code || !phone_number_id || !waba_id) return Response.json({ error: "Faltan code, phone_number_id o waba_id" }, { status: 400 });
  if (!APP_ID()) return Response.json({ error: "Falta NEXT_PUBLIC_META_APP_ID en Vercel" }, { status: 500 });

  let token, secret;
  try { ({ token, secret } = await canjear(code)); pasos.push({ k: "token", ok: true, t: "Token de negocio obtenido" }); }
  catch (e) { return Response.json({ ok: false, pasos: [{ k: "token", ok: false, t: `Meta no entregó el token: ${e.message}` }] }); }

  const info = await pasosComunes(token, secret, waba_id, phone_number_id, pasos);

  // 4. Sincronizaciones (una sola vez cada una). Se piden ahora; Meta las manda por el webhook en pedazos.
  const sync = {};
  for (const tipo of ["smb_app_state_sync", "history"]) {
    try { const d = await graph(`${phone_number_id}/smb_app_data`, { token, method: "POST", body: { messaging_product: "whatsapp", sync_type: tipo } }); sync[tipo] = ahora; pasos.push({ k: tipo, ok: true, t: tipo === "history" ? `Historial de chats pedido (pedido ${d?.request_id || ""})` : `Agenda pedida (pedido ${d?.request_id || ""})` }); }
    catch (e) { pasos.push({ k: tipo, ok: false, t: `${tipo === "history" ? "Historial" : "Agenda"}: ${e.message}` }); }
  }

  const fila = { phone_number_id, waba_id, business_id: business_id || null, display_phone: info?.display_phone_number || null, token, status: "conectado", connected_at: ahora, sync_contacts_at: sync.smb_app_state_sync || null, sync_history_at: sync.history || null, is_on_biz_app: info?.is_on_biz_app ?? null, updated_at: ahora };
  const g = await fetch(`${SB_URL}/rest/v1/crm_numbers?on_conflict=phone_number_id`, { method: "POST", headers: { ...sbh(), Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(fila) });
  pasos.push({ k: "guardado", ok: g.ok, t: g.ok ? "Número guardado en el CRM" : `No se pudo guardar el número (${g.status})` });
  return Response.json({ ok: pasos.every((p) => p.ok), pasos });
}

async function contar(tabla) {
  const r = await fetch(`${SB_URL}/rest/v1/${tabla}?select=id&limit=1`, { headers: { ...sbh(), Prefer: "count=exact" }, cache: "no-store" });
  const cr = r.headers.get("content-range") || "";
  return Number(cr.split("/")[1]) || 0;
}

export async function GET(req) {
  const u = await usuarioConRol(req, ["admin", "empleado"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [numeros, contactos, mensajes] = await Promise.all([
    fetch(`${SB_URL}/rest/v1/crm_numbers?select=phone_number_id,waba_id,business_id,display_phone,status,disconnect_reason,connected_at,disconnected_at,sync_contacts_at,sync_history_at,history_progress,is_on_biz_app,updated_at&order=connected_at.desc`, { headers: sbh(), cache: "no-store" }).then((r) => r.json()).catch(() => []),
    contar("crm_contacts"), contar("crm_messages"),
  ]);
  let campos = null;
  if (u.role === "admin" && APP_ID() && SECRETOS().length) {
    try { const d = await graph(`${APP_ID()}/subscriptions?access_token=${APP_ID()}|${SECRETOS()[0]}`); const wa = (d?.data || []).find((s) => s.object === "whatsapp_business_account"); campos = { callback: wa?.callback_url || null, fields: (wa?.fields || []).map((f) => (typeof f === "string" ? f : f.name)), faltan: CAMPOS.filter((c) => !(wa?.fields || []).map((f) => (typeof f === "string" ? f : f.name)).includes(c)) }; }
    catch (e) { campos = { error: e.message }; }
  }
  return Response.json({ numeros: Array.isArray(numeros) ? numeros : [], contactos, mensajes, campos, env: { app_id: !!APP_ID(), config_id: !!process.env.NEXT_PUBLIC_META_ES_CONFIG_ID, secreto: SECRETOS().length > 0 } });
}
