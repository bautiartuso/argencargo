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
function matchClient(clients, phone) {
  const d = digits(phone);
  if (d.length < 8) return null;
  return clients.find((c) => {
    const cd = digits(c.whatsapp);
    return cd.length >= 8 && (cd.endsWith(d.slice(-10)) || d.endsWith(cd.slice(-10)));
  }) || null;
}
const H24 = 24 * 3600 * 1000;
const windowOpen = (lastUserAt) => !!lastUserAt && Date.now() - new Date(lastUserAt).getTime() < H24;

export async function GET(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "Server config missing" }, { status: 500 });
  const phone = digits(new URL(req.url).searchParams.get("phone"));
  // PostgREST corta en 1000 filas y ya hay más clientes que eso: se pagina.
  const clients = [];
  for (let off = 0; off < 20000; off += 1000) {
    const r = await sb(`/clients?whatsapp=not.is.null&select=id,first_name,last_name,client_code,whatsapp&offset=${off}&limit=1000`);
    const rows = Array.isArray(r.body) ? r.body : [];
    clients.push(...rows);
    if (rows.length < 1000) break;
  }

  if (phone) {
    const [conv, msgs] = await Promise.all([
      sb(`/bot_conversations?phone=eq.${phone}&select=phone,label,human_mode,last_user_at,admin_seen_at,updated_at&limit=1`),
      sb(`/bot_messages?phone=eq.${phone}&select=id,role,content,media_url,media_type,wamid,delivered_at,read_at,failed_at,error,created_at&order=created_at.asc&limit=500`),
    ]);
    const c = Array.isArray(conv.body) && conv.body[0] ? conv.body[0] : { phone, human_mode: false, last_user_at: null };
    await sb(`/bot_conversations?on_conflict=phone`, { method: "POST", body: JSON.stringify({ phone, admin_seen_at: new Date().toISOString() }) });
    const cli = matchClient(clients, phone);
    return Response.json({
      phone,
      human_mode: !!c.human_mode,
      last_user_at: c.last_user_at,
      window_open: windowOpen(c.last_user_at),
      client: cli ? { id: cli.id, nombre: `${cli.first_name || ""} ${cli.last_name || ""}`.trim(), codigo: cli.client_code } : (c.label ? { id: null, nombre: c.label, codigo: null } : null),
      messages: Array.isArray(msgs.body) ? msgs.body : [],
    });
  }

  const [convs, last] = await Promise.all([
    sb(`/bot_conversations?select=phone,label,human_mode,last_user_at,admin_seen_at,updated_at&order=updated_at.desc&limit=300`),
    sb(`/bot_messages?select=phone,role,content,media_type,created_at&order=created_at.desc&limit=600`),
  ]);
  const lastByPhone = {};
  for (const m of Array.isArray(last.body) ? last.body : []) if (!lastByPhone[m.phone]) lastByPhone[m.phone] = m;
  const list = (Array.isArray(convs.body) ? convs.body : []).map((c) => {
    const cli = matchClient(clients, c.phone);
    const lm = lastByPhone[c.phone] || null;
    const unread = !!c.last_user_at && (!c.admin_seen_at || new Date(c.last_user_at) > new Date(c.admin_seen_at));
    return {
      phone: c.phone,
      client: cli ? { id: cli.id, nombre: `${cli.first_name || ""} ${cli.last_name || ""}`.trim(), codigo: cli.client_code } : (c.label ? { id: null, nombre: c.label, codigo: null } : null),
      human_mode: !!c.human_mode,
      last_user_at: c.last_user_at,
      last_at: lm?.created_at || c.updated_at,
      last: lm ? { role: lm.role, content: lm.media_type ? `📎 ${lm.media_type === "document" ? "documento" : "imagen"}${lm.content ? ` · ${lm.content}` : ""}` : lm.content } : null,
      unread,
      window_open: windowOpen(c.last_user_at),
    };
  }).sort((a, b) => new Date(b.last_at) - new Date(a.last_at));
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
