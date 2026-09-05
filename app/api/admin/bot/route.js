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

import { sendWaText, uploadWaMedia, forwardWaMedia, sendWaMediaTemplate } from "../../../../lib/wa";

export const maxDuration = 60;
export const runtime = "nodejs";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

// ── Envío de un archivo por el número del bot ───────────────────────────────
// Sube a storage (bot-adjuntos) + a Meta; primero mensaje libre (gratis, con ventana de
// 24 h); si Meta lo rechaza, plantilla con adjunto (documento_adjunto / imagen_adjunta).
async function enviarArchivo({ phone, buffer, mime, filename, caption, nombreCliente, descripcion }) {
  const safe = String(filename || "archivo").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
  const path = `${Date.now()}_${safe}`;
  const up = await fetch(`${SB_URL}/storage/v1/object/bot-adjuntos/${path}`, { method: "POST", headers: { Authorization: `Bearer ${SB_SERVICE}`, apikey: SB_SERVICE, "Content-Type": mime }, body: buffer });
  if (!up.ok) return { error: `No se pudo guardar el archivo (${up.status})` };
  const fileUrl = `${SB_URL}/storage/v1/object/public/bot-adjuntos/${path}`;
  const kind = /^image\//.test(mime) ? "image" : "document";
  const mediaId = await uploadWaMedia(buffer, mime, safe);
  if (!mediaId) return { error: "WhatsApp no aceptó el archivo (¿formato o tamaño?)" };
  let r = await forwardWaMedia(phone, mediaId, kind, caption || "", safe);
  let via = "libre";
  if (!r?.ok) {
    r = await sendWaMediaTemplate(phone, kind === "document" ? "documento_adjunto" : "imagen_adjunta", { kind, mediaId, filename: safe }, [nombreCliente || "Hola", descripcion || (caption ? caption : "un archivo")]);
    via = "plantilla";
  }
  if (!r?.ok) return { error: r?.error || "Meta rechazó el envío", url: fileUrl };
  if (via === "libre") {
    // lib/wa ya dejó la fila del envío (con wamid): se completa con el adjunto en vez de duplicarla.
    const upd = await sb(`/bot_messages?wamid=eq.${encodeURIComponent(r.id || "")}`, { method: "PATCH", body: JSON.stringify({ role: "human", content: caption || null, media_url: fileUrl, media_type: kind }) });
    if (!(Array.isArray(upd.body) && upd.body.length)) await sb(`/bot_messages`, { method: "POST", body: JSON.stringify({ phone, role: "human", content: caption || null, media_url: fileUrl, media_type: kind, wamid: r.id || null }) });
  } else {
    // La plantilla ya quedó logueada por lib/wa (texto); se agrega la URL del adjunto.
    await sb(`/bot_messages?wamid=eq.${encodeURIComponent(r.id || "")}`, { method: "PATCH", body: JSON.stringify({ media_url: fileUrl, media_type: kind }) }).catch(() => {});
  }
  await sb(`/bot_conversations?on_conflict=phone`, { method: "POST", body: JSON.stringify({ phone, admin_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
  return { ok: true, url: fileUrl, via };
}

// PDF de la factura pública (misma página que ve el cliente) con Chromium en el servidor.
async function facturaPdf(token) {
  const { urlToPdf } = await import("../../../../lib/chromium");
  return urlToPdf(`${BASE_URL}/factura/${token}`);
}

const fmtNum = (pv, n) => `${String(pv).padStart(5, "0")}-${String(n).padStart(8, "0")}`;


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
  const url = new URL(req.url);
  const phone = digits(url.searchParams.get("phone"));

  // Globo del menú: cuántas conversaciones tienen mensajes del cliente sin ver.
  if (url.searchParams.get("count") === "1") {
    const r = await sb(`/bot_conversations?select=phone,last_user_at,admin_seen_at&last_user_at=not.is.null`);
    const n = (Array.isArray(r.body) ? r.body : []).filter((c) => !c.admin_seen_at || new Date(c.last_user_at) > new Date(c.admin_seen_at)).length;
    return Response.json({ unread: n });
  }

  if (phone) {
    const [conv, msgs] = await Promise.all([
      sb(`/rpc/bot_conversations_list`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ p_phone: phone }) }),
      sb(`/bot_messages?phone=eq.${phone}&select=id,role,content,media_url,media_type,wamid,delivered_at,read_at,failed_at,error,created_at&order=created_at.asc&limit=500`),
    ]);
    const row = Array.isArray(conv.body) && conv.body[0] ? conv.body[0] : { phone, human_mode: false, last_user_at: null };
    // Marcar visto sin bloquear la respuesta.
    sb(`/bot_conversations?on_conflict=phone`, { method: "POST", body: JSON.stringify({ phone, admin_seen_at: new Date().toISOString() }) }).catch(() => {});
    const c = rowToConv(row);
    // Facturas emitidas del cliente que todavía no se mandaron por el bot (chips en el chat).
    let facturas = [];
    if (c.client?.id) {
      const f = await sb(`/invoices?client_id=eq.${c.client.id}&status=eq.emitida&wa_sent_at=is.null&select=id,punto_venta,numero,importe,fecha,operations(operation_code)&order=created_at.desc&limit=5`);
      facturas = (Array.isArray(f.body) ? f.body : []).map((x) => ({ id: x.id, numero: fmtNum(x.punto_venta, x.numero), importe: Number(x.importe || 0), fecha: x.fecha, op: x.operations?.operation_code || null }));
    }
    return Response.json({ phone, human_mode: c.human_mode, last_user_at: c.last_user_at, window_open: c.window_open, client: c.client, messages: Array.isArray(msgs.body) ? msgs.body : [], facturas_pendientes: facturas });
  }

  const r = await sb(`/rpc/bot_conversations_list`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({}) });
  const list = (Array.isArray(r.body) ? r.body : []).map(rowToConv);
  return Response.json({ conversations: list });
}

export async function POST(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "Server config missing" }, { status: 500 });

  // Adjunto desde el chat (multipart: phone, caption, file).
  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    const fd = await req.formData();
    const phone = digits(fd.get("phone"));
    const file = fd.get("file");
    if (!phone || !file || typeof file === "string") return Response.json({ error: "Falta phone o file" }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return Response.json({ error: "Máximo 20 MB" }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const conv = await sb(`/rpc/bot_conversations_list`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ p_phone: phone }) });
    const nombre = Array.isArray(conv.body) && conv.body[0]?.client_nombre ? conv.body[0].client_nombre.split(" ")[0] : "Hola";
    const r = await enviarArchivo({ phone, buffer, mime: file.type || "application/octet-stream", filename: file.name, caption: String(fd.get("caption") || "").trim(), nombreCliente: nombre, descripcion: String(fd.get("caption") || "").trim() || "un archivo" });
    return Response.json(r, { status: r.ok ? 200 : 400 });
  }

  const body = await req.json().catch(() => ({}));

  // Factura emitida → PDF → WhatsApp del cliente por el bot.
  if (body.action === "factura") {
    const inv = await sb(`/invoices?id=eq.${encodeURIComponent(body.invoice_id || "")}&select=id,public_token,punto_venta,numero,importe,client_id,operation_id,wa_sent_at,operations(operation_code,client_id),clients(first_name,whatsapp)&limit=1`);
    const f = Array.isArray(inv.body) && inv.body[0];
    if (!f) return Response.json({ error: "Factura no encontrada" }, { status: 404 });
    let cli = f.clients || null;
    if (!cli?.whatsapp && f.operations?.client_id) {
      const c2 = await sb(`/clients?id=eq.${f.operations.client_id}&select=first_name,whatsapp&limit=1`);
      cli = Array.isArray(c2.body) && c2.body[0] ? c2.body[0] : cli;
    }
    const phone = digits(body.phone) || digits(cli?.whatsapp);
    if (!phone) return Response.json({ error: "El cliente no tiene WhatsApp cargado" }, { status: 400 });
    const numero = fmtNum(f.punto_venta, f.numero);
    const opCode = f.operations?.operation_code || null;
    let buffer;
    try { buffer = await facturaPdf(f.public_token); }
    catch (e) { console.error("[admin/bot] pdf", e.message); return Response.json({ error: `No se pudo generar el PDF: ${e.message}` }, { status: 500 }); }
    const r = await enviarArchivo({
      phone, buffer, mime: "application/pdf", filename: `Factura-C-${numero}.pdf`,
      caption: `Factura C ${numero}${opCode ? ` · ${opCode}` : ""}`,
      nombreCliente: cli?.first_name || "Hola", descripcion: `la factura C ${numero}${opCode ? ` de tu operación ${opCode}` : ""}`,
    });
    if (r.ok) await sb(`/invoices?id=eq.${f.id}`, { method: "PATCH", body: JSON.stringify({ wa_sent_at: new Date().toISOString() }) });
    return Response.json(r, { status: r.ok ? 200 : 400 });
  }

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
