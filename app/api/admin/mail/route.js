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
import { FIRMA_DEF, PLANTILLAS_DEF, firmaHtml, firmaTexto } from "../../../../lib/firma-mail";
import { leerConfig, guardarConfig, fijarToken, accessToken, gm, hdr, b64dec, b64url, recorrer, resumen, armarMime, GM } from "../../../../lib/gmail";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const CID = process.env.GOOGLE_CLIENT_ID;
const CSECRET = process.env.GOOGLE_CLIENT_SECRET;
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

// ── Firma y plantillas (23/10/2026): mail-config/preferencias.json ─────────────────────────
const PREFS = "/storage/v1/object/mail-config/preferencias.json";
async function leerPrefs() {
  const r = await svc(PREFS);
  let d = {}; if (r.ok) { try { d = await r.json(); } catch {} }
  return { firma: { ...FIRMA_DEF, ...(d.firma || {}) }, plantillas: Array.isArray(d.plantillas) ? d.plantillas : PLANTILLAS_DEF };
}
const guardarPrefs = (d) => svc(PREFS, { method: "POST", headers: { "Content-Type": "application/json", "x-upsert": "true" }, body: JSON.stringify(d) });

// ── OAuth ─────────────────────────────────────────────────────────────────────────────────
const redirectUri = (req) => `${new URL(req.url).origin}/api/admin/mail?accion=oauth`;
const firmar = (v) => crypto.createHmac("sha256", CSECRET || "x").update(v).digest("hex").slice(0, 32);

// Carpetas automáticas (04/10/2026): todo lo de DHL, FedEx, UPS y WhatsApp sale de la bandeja y va
// a su carpeta. Se asegura una vez por carga del panel (accion "ordenar"): crea la etiqueta y el
// filtro si faltan y barre lo que haya quedado en la bandeja.
// Avisos automáticos de DHL (15/10/2026): documentación de soporte del AWB, recibo de pago y
// On Demand Delivery ("Entregado" / "Su entrega se realizará hoy"). Van a su propia carpeta, ya
// leídos, para que en "DHL" queden solo los mails de personas y no se pierdan entre los avisos.
// 23/10/2026: también van a "DHL avisos" (ya leídos) las respuestas de los pedidos de DSI (las ve Facu
// desde Aéreos), el mail "DESPACHOS" de FedEx y las alertas de pago de derechos de DHL.
const DHL_AVISOS = ['subject:"Documentación de soporte para AWB"', 'subject:"Recibo de pago de DHL"', 'subject:"On Demand Delivery"', 'subject:"Solicitud DSI"', 'subject:"Alerta de Pago de Derechos"', "subject:DESPACHOS"];
const sinAvisos = DHL_AVISOS.map((x) => `-${x}`).join(" ");
const AUTO = [
  { nombre: "DHL", q: `from:dhl ${sinAvisos}` },
  { nombre: "DHL avisos", q: `{from:dhl from:fedex from:ups} {${DHL_AVISOS.join(" ")}}`, leido: true, sacar: ["DHL", "FedEx", "UPS"] },
  // FedEx: también el reclamo 875399955921 (hilos que Bautista respondió desde su casilla).
  { nombre: "FedEx", q: `{from:fedex subject:875399955921} ${sinAvisos}` },
  { nombre: "UPS", q: `from:ups ${sinAvisos}` },
  { nombre: "WhatsApp", q: "from:whatsapp OR subject:whatsapp" },
  // Informes DMARC diarios (Google, Microsoft, Yahoo…): no hace falta leerlos.
  { nombre: "DMARC", q: 'from:dmarc OR subject:"Report domain"', leido: true },
];
// Filtros viejos que se reemplazaron (se borran al ordenar).
const AVISOS_15_10 = ['subject:"Documentación de soporte para AWB"', 'subject:"Recibo de pago de DHL"', 'subject:"On Demand Delivery"'];
const FILTROS_VIEJOS = ["from:dhl", `from:dhl ${AVISOS_15_10.map((x) => `-${x}`).join(" ")}`, `from:dhl {${AVISOS_15_10.join(" ")}}`, "from:fedex OR subject:875399955921", "from:ups"];
// Lo que cuenta para el globo del Email (23/10/2026): bandeja + DHL, FedEx y UPS. Avisos, DMARC y
// WhatsApp no.
const Q_NO_LEIDOS = 'is:unread {in:inbox in:spam label:DHL label:FedEx label:UPS} -label:DHL-avisos -label:DMARC -label:WhatsApp';
const etiquetaQ = (n) => String(n).replace(/\s+/g, "-");
const SIN_AUTO = AUTO.map((a) => `-label:${etiquetaQ(a.nombre)}`).join(" ");

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
    fijarToken({ token: d.access_token, vence: Date.now() + (Number(d.expires_in) || 3000) * 1000 });
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
      const d = await gm(`/messages?maxResults=200&includeSpamTrash=true&q=${encodeURIComponent(Q_NO_LEIDOS)}`);
      return json({ n: (d.messages || []).length });
    }
    if (accion === "carpetas") {
      const d = await gm("/labels");
      const propias = (d.labels || []).filter((l) => l.type === "user");
      const conteos = await Promise.all(propias.map((l) => gm(`/labels/${l.id}`).catch(() => ({}))));
      const [nl, tot] = await Promise.all([
        gm(`/messages?maxResults=100&includeSpamTrash=true&q=${encodeURIComponent(`is:unread {in:inbox in:spam} ${SIN_AUTO}`)}`).catch(() => ({})),
        gm(`/messages?maxResults=200&includeSpamTrash=true&q=${encodeURIComponent(Q_NO_LEIDOS)}`).catch(() => ({})),
      ]);
      return json({
        noLeidosBandeja: (nl.messages || []).length,
        noLeidosTotal: (tot.messages || []).length,
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
    if (accion === "preferencias") return json(await leerPrefs());
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
      for (const x of (f.filter || []).filter((x) => FILTROS_VIEJOS.includes(x.criteria?.query))) await gm(`/settings/filters/${x.id}`, { method: "DELETE" }).catch(() => {});
      for (const a of AUTO) {
        let label = labels.find((x) => x.name.toLowerCase() === a.nombre.toLowerCase());
        if (!label) label = await gm("/labels", { method: "POST", body: JSON.stringify({ name: a.nombre, labelListVisibility: "labelShow", messageListVisibility: "show" }) }).catch(() => null);
        if (!label) continue;
        const quitar = ["INBOX", ...(a.leido ? ["UNREAD"] : [])];
        const mismos = (f.filter || []).filter((x) => x.criteria?.query === a.q && (x.action?.addLabelIds || []).includes(label.id));
        const tiene = mismos.some((x) => quitar.every((q) => (x.action?.removeLabelIds || []).includes(q)));
        if (!tiene) {
          for (const x of mismos) await gm(`/settings/filters/${x.id}`, { method: "DELETE" }).catch(() => {});
          await gm("/settings/filters", { method: "POST", body: JSON.stringify({ criteria: { query: a.q }, action: { addLabelIds: [label.id], removeLabelIds: quitar } }) }).catch(() => {});
        }
        // Carpetas que se leen solas: lo que haya quedado sin leer adentro se marca leído.
        if (a.leido) {
          const nl = await gm(`/messages?maxResults=500&includeSpamTrash=true&q=${encodeURIComponent(`label:${etiquetaQ(a.nombre)} is:unread`)}`).catch(() => ({}));
          const ids = (nl.messages || []).map((m) => m.id);
          if (ids.length) await gm("/messages/batchModify", { method: "POST", body: JSON.stringify({ ids, removeLabelIds: ["UNREAD"] }) }).catch(() => {});
        }
        // Etiquetas de las que estos mails tienen que salir (los avisos de DHL estaban en "DHL").
        const sacarIds = (a.sacar || []).map((n) => labels.find((x) => x.name.toLowerCase() === n.toLowerCase())?.id).filter(Boolean);
        const ex = await gm(`/messages?maxResults=500&includeSpamTrash=true&q=${encodeURIComponent(sacarIds.length ? `(${a.q}) -label:${etiquetaQ(a.nombre)}` : `(${a.q}) {in:inbox in:spam}`)}`).catch(() => ({}));
        const hilos = sacarIds.length ? { messages: [] } : await gm(`/messages?maxResults=500&q=${encodeURIComponent(a.q)}`).catch(() => ({}));
        const deHilo = new Set((hilos.messages || []).map((m) => m.threadId));
        const ids = [...new Set([...(ex.messages || []).map((m) => m.id), ...enBandeja.filter((m) => deHilo.has(m.threadId)).map((m) => m.id)])];
        if (ids.length) { await gm("/messages/batchModify", { method: "POST", body: JSON.stringify({ ids, addLabelIds: [label.id], removeLabelIds: [...quitar, "SPAM", ...sacarIds] }) }).catch(() => {}); movidos += ids.length; }
      }
      return json({ ok: true, movidos });
    }
    if (b.accion === "preferencias") {
      const actual = await leerPrefs();
      const firma = b.firma ? { ...actual.firma, ...b.firma } : actual.firma;
      const plantillas = Array.isArray(b.plantillas) ? b.plantillas.filter((x) => String(x?.titulo || "").trim() && String(x?.texto || "").trim()).map((x, i) => ({ id: x.id || `p${Date.now()}${i}`, titulo: String(x.titulo).trim(), asunto: String(x.asunto || "").trim(), texto: String(x.texto) })) : actual.plantillas;
      const r = await guardarPrefs({ firma, plantillas });
      if (!r.ok) return json({ error: "No se pudo guardar" }, 500);
      return json({ ok: true, firma, plantillas });
    }
    if (b.accion === "desconectar") { await guardarConfig({}); fijarToken(null); return json({ ok: true }); }
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
      // La firma va debajo del texto y antes del mail reenviado (salvo que se saque para este mail).
      const { firma } = await leerPrefs();
      if (firma.activa !== false && !b.sinFirma) extra = { htmlExtra: firmaHtml(firma) + extra.htmlExtra, textoExtra: firmaTexto(firma) + extra.textoExtra };
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
