// Email del admin (04/10/2026): la casilla de Google Workspace de Bautista dentro del panel.
// Usa la API de Gmail con OAuth. Se necesitan en Vercel GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (de
// un "OAuth client" de Google Cloud con la API de Gmail habilitada y este redirect:
//   https://www.argencargo.com.ar/api/admin/mail?accion=oauth).
// Al tocar "Conectar Gmail" se autoriza una vez; el refresh token queda en un bucket privado de
// Storage (mail-config/gmail.json), como las tarifas de los agentes. Solo admin.
//
// GET  ?accion=estado | carpetas | lista&carpeta=…&q=…&pagina=… | mensaje&id=… | adjunto&id=…&adj=… |
//          filtros | no_leidos | conectar | oauth (callback de Google)
// POST {accion:"enviar"|"borrador"|"filtro"|"borrar_filtro"|"leido"|"papelera"|"ordenar"|"desconectar", …}
//      enviar con reenviar:id suma el mail original y sus adjuntos.

import crypto from "crypto";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const CID = process.env.GOOGLE_CLIENT_ID;
const CSECRET = process.env.GOOGLE_CLIENT_SECRET;
const BUCKET = "mail-config";
const ARCHIVO = "gmail.json";
const GM = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/gmail.settings.basic"];

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const svc = (path, init = {}) => fetch(`${SB_URL}${path}`, { ...init, cache: "no-store", headers: { apikey: SB, Authorization: `Bearer ${SB}`, ...(init.headers || {}) } });
const json = (d, status = 200) => Response.json(d, { status, headers: { "Cache-Control": "no-store" } });

async function esAdmin(req) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return false;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!u?.id) return false;
  const p = await svc(`/rest/v1/profiles?id=eq.${u.id}&select=role&limit=1`).then((r) => r.json()).catch(() => []);
  return Array.isArray(p) && p[0]?.role === "admin";
}

// ── Configuración guardada (refresh token) ────────────────────────────────────────────────
async function leerConfig() {
  const r = await svc(`/storage/v1/object/${BUCKET}/${ARCHIVO}`);
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}
async function guardarConfig(data) {
  const b = await svc(`/storage/v1/bucket/${BUCKET}`);
  if (!b.ok) await svc(`/storage/v1/bucket`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) });
  return svc(`/storage/v1/object/${BUCKET}/${ARCHIVO}`, { method: "POST", headers: { "Content-Type": "application/json", "x-upsert": "true" }, body: JSON.stringify(data) });
}

// ── OAuth ─────────────────────────────────────────────────────────────────────────────────
const redirectUri = (req) => `${new URL(req.url).origin}/api/admin/mail?accion=oauth`;
const firmar = (v) => crypto.createHmac("sha256", CSECRET || "x").update(v).digest("hex").slice(0, 32);

let cacheToken = null; // { token, vence }
async function accessToken() {
  if (cacheToken && cacheToken.vence > Date.now() + 60000) return cacheToken.token;
  const cfg = await leerConfig();
  if (!cfg?.refresh_token) throw new Error("no_conectado");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: CID, client_secret: CSECRET, refresh_token: cfg.refresh_token, grant_type: "refresh_token" }) });
  const d = await r.json();
  if (!d.access_token) throw new Error("token_invalido");
  cacheToken = { token: d.access_token, vence: Date.now() + (Number(d.expires_in) || 3000) * 1000 };
  return d.access_token;
}
async function gm(path, init = {}) {
  const t = await accessToken();
  const r = await fetch(`${GM}${path}`, { ...init, cache: "no-store", headers: { Authorization: `Bearer ${t}`, ...(init.body && !(init.headers || {})["Content-Type"] ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
  if (r.status === 204) return {};
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Gmail ${r.status}`);
  return d;
}

// ── Utilidades de mensajes ────────────────────────────────────────────────────────────────
const hdr = (headers, n) => (headers || []).find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";
const b64dec = (s) => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function recorrer(part, out) {
  if (!part) return;
  const mime = part.mimeType || "";
  if (part.filename && part.body?.attachmentId) out.adjuntos.push({ id: part.body.attachmentId, nombre: part.filename, tipo: mime, tamano: part.body.size || 0, cid: hdr(part.headers, "Content-ID").replace(/[<>]/g, "") });
  else if (mime === "text/html" && part.body?.data) out.html += b64dec(part.body.data).toString("utf8");
  else if (mime === "text/plain" && part.body?.data) out.texto += b64dec(part.body.data).toString("utf8");
  (part.parts || []).forEach((p) => recorrer(p, out));
}
const resumen = (m) => {
  const h = m.payload?.headers || [];
  return { id: m.id, hilo: m.threadId, de: hdr(h, "From"), para: hdr(h, "To"), asunto: hdr(h, "Subject"), fecha: Number(m.internalDate) || Date.parse(hdr(h, "Date")) || 0, extracto: m.snippet || "", noLeido: (m.labelIds || []).includes("UNREAD"), spam: (m.labelIds || []).includes("SPAM"), etiquetas: m.labelIds || [], adjuntos: /multipart\/mixed/i.test(hdr(h, "Content-Type")) };
};

// Arma el MIME del mail (texto + html + adjuntos) en base64url para la API.
function armarMime({ de, para, cc, asunto, texto, adjuntos = [], enRespuestaA, referencias, htmlExtra = "", textoExtra = "" }) {
  const enc = (s) => `=?UTF-8?B?${Buffer.from(String(s || ""), "utf8").toString("base64")}?=`;
  const limite = "ac_" + crypto.randomBytes(8).toString("hex");
  const alt = "alt_" + crypto.randomBytes(8).toString("hex");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${String(texto || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>${htmlExtra}`;
  texto = `${texto || ""}${textoExtra}`;
  const lineas = [];
  if (de) lineas.push(`From: ${de}`);
  lineas.push(`To: ${para}`);
  if (cc) lineas.push(`Cc: ${cc}`);
  lineas.push(`Subject: ${enc(asunto)}`, "MIME-Version: 1.0");
  if (enRespuestaA) lineas.push(`In-Reply-To: ${enRespuestaA}`, `References: ${referencias || enRespuestaA}`);
  lineas.push(`Content-Type: multipart/mixed; boundary="${limite}"`, "", `--${limite}`, `Content-Type: multipart/alternative; boundary="${alt}"`, "",
    `--${alt}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(String(texto || ""), "utf8").toString("base64"),
    `--${alt}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(html, "utf8").toString("base64"), `--${alt}--`);
  for (const a of adjuntos) {
    lineas.push(`--${limite}`, `Content-Type: ${a.tipo || "application/octet-stream"}; name="${enc(a.nombre)}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${enc(a.nombre)}"`, "", String(a.datos || "").replace(/(.{76})/g, "$1\r\n"));
  }
  lineas.push(`--${limite}--`);
  return lineas.join("\r\n");
}

// Carpetas automáticas (04/10/2026): todo lo de DHL, FedEx, UPS y WhatsApp sale de la bandeja y va
// a su carpeta. Se asegura una vez por carga del panel (accion "ordenar"): crea la etiqueta y el
// filtro si faltan y barre lo que haya quedado en la bandeja.
const AUTO = [
  { nombre: "DHL", q: "from:dhl" },
  // FedEx: también el reclamo 875399955921 (hilos que Bautista respondió desde su casilla).
  { nombre: "FedEx", q: "from:fedex OR subject:875399955921" },
  { nombre: "UPS", q: "from:ups" },
  { nombre: "WhatsApp", q: "from:whatsapp OR subject:whatsapp" },
  // Informes DMARC diarios (Google, Microsoft, Yahoo…): no hace falta leerlos.
  { nombre: "DMARC", q: 'from:dmarc OR subject:"Report domain"' },
];
const SIN_AUTO = AUTO.map((a) => `-label:${a.nombre}`).join(" ");

// Separa una lista de direcciones respetando las comas dentro de comillas.
const separar = (s) => (String(s || "").match(/(?:"[^"]*"|[^,])+/g) || []).map((x) => x.trim()).filter(Boolean);
const direccion = (s) => (String(s).match(/<([^>]+)>/)?.[1] || String(s)).trim().toLowerCase();

// Carpetas especiales: bandeja incluye spam (pedido de Bautista: que no se le pierda nada).
const CONSULTA = { bandeja: `{in:inbox in:spam} ${SIN_AUTO}`, enviados: "in:sent", destacados: "is:starred", papelera: "in:trash" };

export async function GET(req) {
  const u = new URL(req.url);
  const accion = u.searchParams.get("accion") || "estado";

  // Callback de Google: no trae el token del admin, se valida con el "state" firmado.
  if (accion === "oauth") {
    const code = u.searchParams.get("code");
    const [ts, sig] = String(u.searchParams.get("state") || "").split(".");
    const vuelta = (q) => Response.redirect(`${u.origin}/admin?mail=${q}`, 302);
    if (!code || !ts || sig !== firmar(ts) || Date.now() - Number(ts) > 15 * 60000) return vuelta("error");
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: CID, client_secret: CSECRET, redirect_uri: redirectUri(req), grant_type: "authorization_code" }) });
    const d = await r.json();
    if (!d.refresh_token) return vuelta("sin_permiso");
    const prof = await fetch(`${GM}/profile`, { headers: { Authorization: `Bearer ${d.access_token}` } }).then((x) => x.json()).catch(() => ({}));
    await guardarConfig({ refresh_token: d.refresh_token, email: prof.emailAddress || null, conectado: new Date().toISOString() });
    cacheToken = { token: d.access_token, vence: Date.now() + (Number(d.expires_in) || 3000) * 1000 };
    return vuelta("ok");
  }

  if (!(await esAdmin(req))) return json({ error: "sin_permiso" }, 401);
  const configurado = !!(CID && CSECRET && SB);

  try {
    if (accion === "estado") {
      const cfg = configurado ? await leerConfig() : null;
      return json({ configurado, conectado: !!cfg?.refresh_token, email: cfg?.email || null });
    }
    if (accion === "conectar") {
      if (!configurado) return json({ error: "faltan_credenciales" }, 400);
      const ts = String(Date.now());
      const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: CID, redirect_uri: redirectUri(req), response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", state: `${ts}.${firmar(ts)}` })}`;
      return json({ url });
    }
    if (accion === "no_leidos") {
      const d = await gm(`/messages?maxResults=100&includeSpamTrash=true&q=${encodeURIComponent(`is:unread {in:inbox in:spam} ${SIN_AUTO}`)}`);
      return json({ n: (d.messages || []).length });
    }
    if (accion === "carpetas") {
      const d = await gm("/labels");
      const propias = (d.labels || []).filter((l) => l.type === "user");
      const conteos = await Promise.all(propias.map((l) => gm(`/labels/${l.id}`).catch(() => ({}))));
      const nl = await gm(`/messages?maxResults=100&includeSpamTrash=true&q=${encodeURIComponent(`is:unread {in:inbox in:spam} ${SIN_AUTO}`)}`).catch(() => ({}));
      return json({
        noLeidosBandeja: (nl.messages || []).length,
        carpetas: propias.map((l, i) => ({ id: l.id, nombre: l.name, noLeidos: conteos[i]?.messagesUnread || 0 })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      });
    }
    if (accion === "lista") {
      const carpeta = u.searchParams.get("carpeta") || "bandeja";
      const q = (u.searchParams.get("q") || "").trim();
      const pagina = u.searchParams.get("pagina") || "";
      if (carpeta === "borradores") {
        const d = await gm(`/drafts?maxResults=25${pagina ? `&pageToken=${pagina}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
        const full = await Promise.all((d.drafts || []).map((x) => gm(`/drafts/${x.id}?format=metadata`).catch(() => null)));
        return json({ mensajes: full.filter(Boolean).map((x) => ({ ...resumen(x.message), borrador: x.id })), siguiente: d.nextPageToken || null });
      }
      const base = CONSULTA[carpeta];
      const params = new URLSearchParams({ maxResults: "25", includeSpamTrash: "true" });
      if (base) params.set("q", `${base}${q ? ` ${q}` : ""}`);
      else { params.append("labelIds", carpeta); if (q) params.set("q", q); }
      if (pagina) params.set("pageToken", pagina);
      const d = await gm(`/messages?${params}`);
      const full = await Promise.all((d.messages || []).map((m) => gm(`/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Content-Type`).catch(() => null)));
      return json({ mensajes: full.filter(Boolean).map(resumen), siguiente: d.nextPageToken || null });
    }
    if (accion === "mensaje") {
      const id = u.searchParams.get("id");
      const m = await gm(`/messages/${id}?format=full`);
      const out = { html: "", texto: "", adjuntos: [] };
      recorrer(m.payload, out);
      if ((m.labelIds || []).includes("UNREAD")) gm(`/messages/${id}/modify`, { method: "POST", body: JSON.stringify({ removeLabelIds: ["UNREAD"] }) }).catch(() => {});
      const h = m.payload?.headers || [];
      return json({ ...resumen(m), cc: hdr(h, "Cc"), responderA: hdr(h, "Reply-To"), messageId: hdr(h, "Message-ID"), referencias: hdr(h, "References"), html: out.html, texto: out.texto, adjuntos: out.adjuntos });
    }
    if (accion === "adjunto") {
      const d = await gm(`/messages/${u.searchParams.get("id")}/attachments/${u.searchParams.get("adj")}`);
      const nombre = u.searchParams.get("nombre") || "adjunto";
      return new Response(b64dec(d.data), { headers: { "Content-Type": u.searchParams.get("tipo") || "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`, "Cache-Control": "no-store" } });
    }
    if (accion === "filtros") {
      const [f, l] = await Promise.all([gm("/settings/filters").catch(() => ({})), gm("/labels")]);
      const nombres = Object.fromEntries((l.labels || []).map((x) => [x.id, x.name]));
      return json({ filtros: (f.filter || []).map((x) => ({ id: x.id, de: x.criteria?.from || "", asunto: x.criteria?.subject || "", query: x.criteria?.query || "", carpeta: (x.action?.addLabelIds || []).map((i) => nombres[i]).filter(Boolean)[0] || "" })) });
    }
    return json({ error: "accion_desconocida" }, 400);
  } catch (e) {
    if (e.message === "no_conectado") return json({ error: "no_conectado" }, 409);
    return json({ error: e.message }, 500);
  }
}

export async function POST(req) {
  if (!(await esAdmin(req))) return json({ error: "sin_permiso" }, 401);
  let b = {};
  try { b = await req.json(); } catch {}
  try {
    if (b.accion === "ordenar") {
      const [l, f] = await Promise.all([gm("/labels"), gm("/settings/filters").catch(() => ({}))]);
      const labels = l.labels || [];
      let movidos = 0;
      // Lo que hoy se ve en la bandeja, para mover también los hilos enteros: si un hilo tiene un mail
      // de FedEx, las respuestas propias de ese hilo van a la misma carpeta.
      const bandeja = await gm(`/messages?maxResults=500&includeSpamTrash=true&q=${encodeURIComponent(`{in:inbox in:spam} ${SIN_AUTO}`)}`).catch(() => ({}));
      const enBandeja = bandeja.messages || [];
      for (const a of AUTO) {
        let label = labels.find((x) => x.name.toLowerCase() === a.nombre.toLowerCase());
        if (!label) label = await gm("/labels", { method: "POST", body: JSON.stringify({ name: a.nombre, labelListVisibility: "labelShow", messageListVisibility: "show" }) }).catch(() => null);
        if (!label) continue;
        const tiene = (f.filter || []).some((x) => x.criteria?.query === a.q && (x.action?.addLabelIds || []).includes(label.id));
        if (!tiene) await gm("/settings/filters", { method: "POST", body: JSON.stringify({ criteria: { query: a.q }, action: { addLabelIds: [label.id], removeLabelIds: ["INBOX"] } }) }).catch(() => {});
        const ex = await gm(`/messages?maxResults=500&includeSpamTrash=true&q=${encodeURIComponent(`(${a.q}) {in:inbox in:spam}`)}`).catch(() => ({}));
        const hilos = await gm(`/messages?maxResults=500&q=${encodeURIComponent(a.q)}`).catch(() => ({}));
        const deHilo = new Set((hilos.messages || []).map((m) => m.threadId));
        const ids = [...new Set([...(ex.messages || []).map((m) => m.id), ...enBandeja.filter((m) => deHilo.has(m.threadId)).map((m) => m.id)])];
        if (ids.length) { await gm("/messages/batchModify", { method: "POST", body: JSON.stringify({ ids, addLabelIds: [label.id], removeLabelIds: ["INBOX", "SPAM"] }) }).catch(() => {}); movidos += ids.length; }
      }
      return json({ ok: true, movidos });
    }
    if (b.accion === "desconectar") { await guardarConfig({}); cacheToken = null; return json({ ok: true }); }
    if (b.accion === "enviar" || b.accion === "borrador") {
      if (b.accion === "enviar" && !String(b.para || "").trim()) return json({ error: "Falta el destinatario" }, 400);
      const cfg = await leerConfig();
      // Reenviar: se suma el mail original (con sus adjuntos) debajo del texto.
      let extra = { htmlExtra: "", textoExtra: "" }, adjOrig = [];
      if (b.reenviar) {
        const m = await gm(`/messages/${b.reenviar}?format=full`);
        const out = { html: "", texto: "", adjuntos: [] };
        recorrer(m.payload, out);
        const h = m.payload?.headers || [];
        const esc = (x) => String(x || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const cab = [["De", hdr(h, "From")], ["Fecha", hdr(h, "Date")], ["Asunto", hdr(h, "Subject")], ["Para", hdr(h, "To")], ...(hdr(h, "Cc") ? [["Cc", hdr(h, "Cc")]] : [])];
        extra = {
          htmlExtra: `<br><div style="font-family:Arial,sans-serif;font-size:13px;color:#555">---------- Mensaje reenviado ----------<br>${cab.map(([k, v]) => `${k}: ${esc(v)}`).join("<br>")}</div><br>${out.html || `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${esc(out.texto)}</pre>`}`,
          textoExtra: `\n\n---------- Mensaje reenviado ----------\n${cab.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${out.texto}`,
        };
        adjOrig = await Promise.all(out.adjuntos.map(async (a) => { const d = await gm(`/messages/${b.reenviar}/attachments/${a.id}`).catch(() => null); return d?.data ? { nombre: a.nombre, tipo: a.tipo, datos: b64dec(d.data).toString("base64") } : null; }));
      }
      const mime = armarMime({ de: cfg?.email, para: b.para || "", cc: b.cc, asunto: b.asunto, texto: b.texto, adjuntos: [...(b.adjuntos || []), ...adjOrig.filter(Boolean)], enRespuestaA: b.enRespuestaA, referencias: b.referencias, ...extra });
      if (b.accion === "enviar" && b.reenviar) {
        // Por la carga de subida (hasta 35 MB): los adjuntos del original pueden ser pesados.
        const t = await accessToken();
        const r = await fetch("https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media", { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "message/rfc822" }, body: mime });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error?.message || `Gmail ${r.status}`);
        return json({ ok: true, id: d.id });
      }
      const raw = b64url(Buffer.from(mime, "utf8"));
      const message = { raw, ...(b.hilo ? { threadId: b.hilo } : {}) };
      if (b.accion === "enviar") {
        const d = await gm("/messages/send", { method: "POST", body: JSON.stringify(message) });
        if (b.borrador) gm(`/drafts/${b.borrador}`, { method: "DELETE" }).catch(() => {});
        return json({ ok: true, id: d.id });
      }
      const d = b.borrador ? await gm(`/drafts/${b.borrador}`, { method: "PUT", body: JSON.stringify({ id: b.borrador, message }) }) : await gm("/drafts", { method: "POST", body: JSON.stringify({ message }) });
      return json({ ok: true, borrador: d.id });
    }
    if (b.accion === "leido") {
      await gm(`/messages/${b.id}/modify`, { method: "POST", body: JSON.stringify(b.leido ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] }) });
      return json({ ok: true });
    }
    if (b.accion === "papelera") { await gm(`/messages/${b.id}/trash`, { method: "POST" }); return json({ ok: true }); }
    if (b.accion === "mover") {
      await gm(`/messages/${b.id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: b.carpeta ? [b.carpeta] : ["INBOX"], removeLabelIds: b.carpeta ? ["INBOX", "SPAM"] : ["SPAM"] }) });
      return json({ ok: true });
    }
    // Filtro: los mails de ese remitente (o con ese asunto) van directo a la carpeta. También mueve
    // los que ya estaban en la bandeja.
    if (b.accion === "filtro") {
      const nombre = String(b.carpeta || "").trim();
      const de = String(b.de || "").trim();
      const asunto = String(b.asunto || "").trim();
      if (!nombre || (!de && !asunto)) return json({ error: "Falta la carpeta y un remitente o asunto" }, 400);
      const l = await gm("/labels");
      let label = (l.labels || []).find((x) => x.name.toLowerCase() === nombre.toLowerCase());
      if (!label) label = await gm("/labels", { method: "POST", body: JSON.stringify({ name: nombre, labelListVisibility: "labelShow", messageListVisibility: "show" }) });
      const criteria = { ...(de ? { from: de } : {}), ...(asunto ? { subject: asunto } : {}) };
      const f = await gm("/settings/filters", { method: "POST", body: JSON.stringify({ criteria, action: { addLabelIds: [label.id], removeLabelIds: ["INBOX"] } }) });
      const q = [de ? `from:(${de})` : "", asunto ? `subject:(${asunto})` : ""].filter(Boolean).join(" ");
      const ex = await gm(`/messages?maxResults=500&includeSpamTrash=true&q=${encodeURIComponent(`${q} (in:inbox OR in:spam)`)}`).catch(() => ({}));
      const ids = (ex.messages || []).map((m) => m.id);
      if (ids.length) await gm("/messages/batchModify", { method: "POST", body: JSON.stringify({ ids, addLabelIds: [label.id], removeLabelIds: ["INBOX", "SPAM"] }) }).catch(() => {});
      return json({ ok: true, id: f.id, movidos: ids.length });
    }
    if (b.accion === "borrar_filtro") { await gm(`/settings/filters/${b.id}`, { method: "DELETE" }); return json({ ok: true }); }
    return json({ error: "accion_desconocida" }, 400);
  } catch (e) {
    if (e.message === "no_conectado") return json({ error: "no_conectado" }, 409);
    return json({ error: e.message }, 500);
  }
}
