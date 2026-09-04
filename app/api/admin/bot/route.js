// GET/POST /api/admin/bot — bandeja de conversaciones del bot de WhatsApp (solo admin).
//
// GET            → lista de conversaciones (cliente matcheado por WhatsApp, último mensaje,
//                  no leídos, modo humano, ventana de 24 h abierta o no).
// GET ?phone=X   → hilo completo de ese número (bot_messages) + marca como visto.
// POST {phone, action:"reply", text}   → responde por el número del bot (texto libre: solo
//                                        llega con la ventana de 24 h abierta; si Meta lo
//                                        rechaza, devuelve el motivo).
// POST {phone, action:"human", on}     → pausa (on=true) o devuelve (on=false) a Argy.
//
// Todo con service role: bot_messages no tiene policies, así que el cliente nunca la toca.

import { sendWaText } from "../../../../lib/wa";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json",
      Prefer: opts.method === "POST" ? "resolution=merge-duplicates,return=representation" : opts.method === "PATCH" ? "return=representation" : undefined,
      ...(opts.headers || {}),
    },
  });
  const t = await r.text();
  let b = null; try { b = JSON.parse(t); } catch {}
  return { status: r.status, body: b };
}

async function isAdmin(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64").toString());
    const p = await sb(`/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p.body) && ["admin","empleado"].includes(p.body[0]?.role);
  } catch { return false; }
}

const digits = (s) => String(s || "").replace(/\D/g, "");
const H24 = 24 * 3600 * 1000;
const windowOpen = (lastUserAt) => !!lastUserAt && Date.now() - new Date(lastUserAt).getTime() < H24;

const rowToConv = (r) => ({
  phone: r.phone,
  client: r.client_id ? { id: r.client_id, nombre: r.client_nombre || r.client_codigo || "", codigo: r.client_codigo } : (r.label ? { id: null, nombre: r.label, codigo: null } : null),
  human_mode: !!r.human_mode,
  last_user_at: r.last_user_at,
  admin_seen_at: r.admin_seen_at,
  last_at: r.last_at || r.updated_at,
  last: r.last_role ? { role: r.last_role, content: r.last_media_type ? `📎 ${r.last_media_type === "document" ? "documento" : "imagen"}${r.last_content ? ` · ${r.last_content}` : ""}` : r.last_content } : null,
  unread: !!r.last_user_at && (!r.admin_seen_at || new Date(r.last_user_at) > new Date(r.admin_seen_at)),
  window_open: windowOpen(r.last_user_at),
});

export async function GET(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "Server config missing" }, { status: 500 });
  const phone = digits(new URL(req.url).searchParams.get("phone"));

  if (phone) {
    const [conv, msgs] = await Promise.all([
      sb(`/rpc/bot_conversations_list`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ p_phone: phone }) }),
      sb(`/bot_messages?phone=eq.${phone}&select=id,role,content,media_url,media_type,wamid,delivered_at,read_at,failed_at,error,created_at&order=created_at.asc&limit=500`),
    ]);
    const row = Array.isArray(conv.body) && conv.body[0] ? conv.body[0] : { phone, human_mode: false, last_user_at: null };
    // Marcar visto sin bloquear la respuesta.
    sb(`/bot_conversations?on_conflict=phone`, { method: "POST", body: JSON.stringify({ phone, admin_seen_at: new Date().toISOString() }) }).catch(() => {});
    const c = rowToConv(row);
    return Response.json({ phone, human_mode: c.human_mode, last_user_at: c.last_user_at, window_open: c.window_open, client: c.client, messages: Array.isArray(msgs.body) ? msgs.body : [] });
  }

  const r = await sb(`/rpc/bot_conversations_list`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({}) });
  const list = (Array.isArray(r.body) ? r.body : []).map(rowToConv);
  return Response.json({ conversations: list });
}

export async function POST(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "Server config missing" }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  const phone = digits(body.phone);
  if (!phone) return Response.json({ error: "Falta phone" }, { status: 400 });

  if (body.action === "human") {
    const on = !!body.on;
    await sb(`/bot_conversations?on_conflict=phone`, { method: "POST", body: JSON.stringify({ phone, human_mode: on }) });
    await sb(`/bot_messages`, { method: "POST", body: JSON.stringify({ phone, role: "system", content: on ? "Conversación tomada por un humano — Argy en pausa" : "Conversación devuelta a Argy" }) });
    return Response.json({ ok: true, human_mode: on });
  }

  if (body.action === "reply") {
    const text = String(body.text || "").trim().slice(0, 4000);
    if (!text) return Response.json({ error: "Texto vacío" }, { status: 400 });
    const r = await sendWaText(phone, text);
    if (!r?.ok) {
      const msg = r?.skipped ? "WhatsApp no configurado" : (r?.error || "Meta rechazó el envío");
      const cerrada = /24|window|re-engagement|131047|131026/i.test(String(msg));
      return Response.json({ error: cerrada ? "Ventana de 24 h cerrada: el cliente tiene que escribir primero (o mandale una plantilla desde Entregas)." : msg }, { status: 400 });
    }
    await sb(`/bot_messages`, { method: "POST", body: JSON.stringify({ phone, role: "human", content: text, wamid: r.id || null }) });
    await sb(`/bot_conversations?on_conflict=phone`, { method: "POST", body: JSON.stringify({ phone, admin_seen_at: new Date().toISOString() }) });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Acción desconocida" }, { status: 400 });
}
