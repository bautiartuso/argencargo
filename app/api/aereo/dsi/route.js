// Pedido de DSI por mail (22/10/2026). Desde el vuelo se le pide la DSI al courier con el Gmail
// conectado en el admin: asunto "Solicitud DSI <guía>", destinatarios y texto por courier (se guardan
// como plantilla la primera vez que se manda). La respuesta se reconoce por ese asunto y prende la
// campanita de Aéreos hasta que alguien la revisa; el adjunto que es la DSI se sube al legajo desde el
// vuelo. Lo usan admin y empleado (Facu) y solo ve los mails de estos pedidos, no la casilla.
//
// GET  ?accion=estado                      → { respondidos } (y revisa Gmail cada 2 min como mucho)
// GET  ?accion=vuelo&flight_id=…           → { pedido, plantilla, mensajes }
// GET  ?accion=adjunto&msg=…&adj=…&nombre=…&tipo=…  → el archivo
// POST { accion:"pedir", flight_id, para, cc, texto } | { accion:"revisado", pedido_id }
import { leerConfig, gm, hdr, b64dec, b64url, recorrer, armarMime, BUCKET } from "../../../../lib/gmail";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const PLANTILLAS = "dsi.json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (d, status = 200) => Response.json(d, { status, headers: { "Cache-Control": "no-store" } });
async function sb(path, init = {}) {
  const r = await fetch(`${SB_URL}${path}`, { ...init, cache: "no-store", headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const t = await r.text(); let data = null; try { data = JSON.parse(t); } catch {}
  return { ok: r.ok, status: r.status, data };
}
const lista = (r) => (Array.isArray(r?.data) ? r.data : []);

async function staff(req) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return null;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!u?.id) return null;
  const p = await sb(`/rest/v1/profiles?id=eq.${u.id}&select=role&limit=1`);
  return ["admin", "empleado"].includes(lista(p)[0]?.role) ? u.id : null;
}

const asuntoDe = (guia) => `Solicitud DSI ${guia}`;
const claveCarrier = (c) => String(c || "otro").toLowerCase().replace(/[^a-z]/g, "") || "otro";
const textoBase = (f) => `Buenas tardes,\n\nLes pedimos la DSI (Destinación Simplificada de Importación) de la guía ${f.international_tracking}${f.dest_name ? `, destinatario ${f.dest_name}${f.dest_tax_id ? ` (CUIT ${f.dest_tax_id})` : ""}` : ""}.\n\nMuchas gracias.\nArgencargo`;

async function leerPlantillas() {
  const r = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${PLANTILLAS}`, { cache: "no-store", headers: { apikey: SB, Authorization: `Bearer ${SB}` } });
  if (!r.ok) return {};
  try { return await r.json(); } catch { return {}; }
}
async function guardarPlantillas(d) {
  return fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${PLANTILLAS}`, { method: "POST", headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", "x-upsert": "true" }, body: JSON.stringify(d) });
}

// Busca respuestas de los pedidos abiertos (los de los últimos 45 días sin respuesta todavía).
let ultimaRevision = 0;
async function revisar(forzar = false) {
  if (!forzar && Date.now() - ultimaRevision < 2 * 60000) return;
  ultimaRevision = Date.now();
  const desde = new Date(Date.now() - 45 * 86400000).toISOString();
  const abiertos = lista(await sb(`/rest/v1/dsi_pedidos?respuesta_at=is.null&enviado_at=gte.${desde}&select=id,guia`));
  await Promise.all(abiertos.map(async (p) => {
    const d = await gm(`/messages?maxResults=5&includeSpamTrash=true&q=${encodeURIComponent(`subject:"${asuntoDe(p.guia)}" -from:me`)}`).catch(() => null);
    const primero = (d?.messages || []).slice(-1)[0];
    if (!primero) return;
    const m = await gm(`/messages/${primero.id}?format=metadata&metadataHeaders=From`).catch(() => null);
    if (!m) return;
    await sb(`/rest/v1/dsi_pedidos?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ respuesta_at: new Date(Number(m.internalDate) || Date.now()).toISOString(), respuesta_de: hdr(m.payload?.headers, "From") || null }) });
  }));
}

// Vuelos llegados a Buenos Aires a los que todavía hay que pedirles la DSI (la pelotita naranja de
// Aéreos). Misma regla que la pantalla del empleado: aéreo courier comercial, sin pedido abierto, sin DSI en
// todas sus ops, y vigente (alguna op sin cerrar o llegado hace 14 días o menos).
async function contarPorPedir() {
  const desde = new Date(Date.now() - 150 * 86400000).toISOString();
  const fl = lista(await sb(`/rest/v1/flights?or=(status.eq.recibido,carrier_delivered_at.not.is.null)&dispatched_at=gte.${desde}&international_tracking=not.is.null&select=id,received_at,carrier_delivered_at,dispatched_at,flight_operations(operations(id,channel,service_type,status))`));
  const vuelos = fl.map((f) => ({ ...f, ops: (f.flight_operations || []).map((x) => x.operations).filter((o) => o && o.channel === "aereo_blanco" && o.service_type !== "gestion_integral") })).filter((f) => f.ops.length);
  if (!vuelos.length) return 0;
  const opIds = vuelos.flatMap((f) => f.ops.map((o) => o.id));
  const [docs, peds] = await Promise.all([
    sb(`/rest/v1/legajo_docs?operation_id=in.(${opIds.join(",")})&tipo=eq.dsi&borrado_at=is.null&select=operation_id`),
    sb(`/rest/v1/dsi_pedidos?flight_id=in.(${vuelos.map((f) => f.id).join(",")})&revisado_at=is.null&select=flight_id`),
  ]);
  const conDsi = new Set(lista(docs).map((d) => d.operation_id));
  const pedidos = new Set(lista(peds).map((p) => p.flight_id));
  return vuelos.filter((f) => {
    if (pedidos.has(f.id) || f.ops.every((o) => conDsi.has(o.id))) return false;
    const llego = new Date(f.received_at || f.carrier_delivered_at || f.dispatched_at).getTime();
    return f.ops.some((o) => !["operacion_cerrada", "cancelada"].includes(o.status)) || Date.now() - llego < 14 * 86400000;
  }).length;
}

const textoPlano = (html) => String(html || "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();

export async function GET(req) {
  const uid = await staff(req);
  if (!uid) return json({ error: "sin_permiso" }, 401);
  const u = new URL(req.url);
  const accion = u.searchParams.get("accion") || "estado";
  try {
    if (accion === "estado") {
      const cfg = await leerConfig().catch(() => null);
      if (cfg?.refresh_token) await revisar().catch(() => {});
      const [r, porPedir] = await Promise.all([sb(`/rest/v1/dsi_pedidos?respuesta_at=not.is.null&revisado_at=is.null&select=flight_id`), contarPorPedir()]);
      if (!r.ok) return json({ respondidos: 0, vuelos: [], porPedir, sinTabla: r.status === 404 || r.status === 400 });
      return json({ respondidos: lista(r).length, vuelos: lista(r).map((x) => x.flight_id), porPedir });
    }
    if (accion === "vuelo") {
      const fid = u.searchParams.get("flight_id") || "";
      const [fr, pr, cfg] = await Promise.all([
        sb(`/rest/v1/flights?id=eq.${fid}&select=id,flight_code,international_tracking,international_carrier,dest_name,dest_tax_id&limit=1`),
        sb(`/rest/v1/dsi_pedidos?flight_id=eq.${fid}&select=*&order=enviado_at.desc&limit=1`),
        leerConfig().catch(() => null),
      ]);
      const f = lista(fr)[0];
      if (!f) return json({ error: "no_encontrado" }, 404);
      const conectado = !!cfg?.refresh_token;
      const pedido = lista(pr)[0] || null;
      const pl = (await leerPlantillas())[claveCarrier(f.international_carrier)] || {};
      const plantilla = { para: pl.para || "", cc: pl.cc || "", asunto: f.international_tracking ? asuntoDe(f.international_tracking) : "", texto: pl.texto ? pl.texto.replace(/\{guia\}/g, f.international_tracking || "") : textoBase(f) };
      let mensajes = [];
      if (pedido && conectado) {
        if (!pedido.respuesta_at) await revisar(true).catch(() => {});
        const d = await gm(`/messages?maxResults=10&includeSpamTrash=true&q=${encodeURIComponent(`subject:"${asuntoDe(pedido.guia)}"`)}`).catch(() => ({}));
        const full = await Promise.all((d.messages || []).map((m) => gm(`/messages/${m.id}?format=full`).catch(() => null)));
        mensajes = full.filter(Boolean).map((m) => {
          const out = { html: "", texto: "", adjuntos: [] };
          recorrer(m.payload, out);
          const h = m.payload?.headers || [];
          const de = hdr(h, "From");
          return { id: m.id, de, mio: !!cfg.email && de.toLowerCase().includes(String(cfg.email).toLowerCase()), fecha: Number(m.internalDate) || 0, texto: (out.texto || textoPlano(out.html)).slice(0, 4000), adjuntos: out.adjuntos.filter((a) => !a.cid || /pdf|octet/i.test(a.tipo)).map(({ id, nombre, tipo, tamano }) => ({ id, nombre, tipo, tamano })) };
        }).sort((a, b) => a.fecha - b.fecha);
        if (!pedido.respuesta_at && mensajes.some((m) => !m.mio)) { const pr2 = lista(await sb(`/rest/v1/dsi_pedidos?id=eq.${pedido.id}&select=*`))[0]; if (pr2) Object.assign(pedido, pr2); }
      }
      return json({ conectado, guia: f.international_tracking || null, carrier: f.international_carrier || null, pedido, plantilla, mensajes });
    }
    if (accion === "adjunto") {
      const msg = u.searchParams.get("msg") || "";
      // Solo adjuntos de mails de un pedido de DSI: el empleado no ve el resto de la casilla.
      const m = await gm(`/messages/${msg}?format=metadata&metadataHeaders=Subject`);
      if (!/Solicitud DSI/i.test(hdr(m.payload?.headers, "Subject"))) return json({ error: "sin_permiso" }, 403);
      const d = await gm(`/messages/${msg}/attachments/${u.searchParams.get("adj")}`);
      const nombre = u.searchParams.get("nombre") || "adjunto.pdf";
      return new Response(b64dec(d.data), { headers: { "Content-Type": u.searchParams.get("tipo") || "application/pdf", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nombre)}`, "Cache-Control": "no-store" } });
    }
    return json({ error: "accion_desconocida" }, 400);
  } catch (e) {
    if (e.message === "no_conectado") return json({ error: "no_conectado" }, 409);
    return json({ error: e.message }, 500);
  }
}

export async function POST(req) {
  const uid = await staff(req);
  if (!uid) return json({ error: "sin_permiso" }, 401);
  let b = {};
  try { b = await req.json(); } catch {}
  try {
    if (b.accion === "pedir") {
      const para = String(b.para || "").trim();
      if (!para) return json({ error: "Falta a quién se lo mandamos" }, 400);
      const f = lista(await sb(`/rest/v1/flights?id=eq.${b.flight_id}&select=id,international_tracking,international_carrier&limit=1`))[0];
      if (!f?.international_tracking) return json({ error: "El vuelo no tiene número de guía" }, 400);
      const cfg = await leerConfig();
      if (!cfg?.refresh_token) return json({ error: "no_conectado" }, 409);
      const asunto = asuntoDe(f.international_tracking);
      const texto = String(b.texto || "").trim();
      const mime = armarMime({ de: cfg.email, para, cc: String(b.cc || "").trim() || undefined, asunto, texto });
      const enviado = await gm("/messages/send", { method: "POST", body: JSON.stringify({ raw: b64url(Buffer.from(mime, "utf8")) }) });
      const ins = await sb(`/rest/v1/dsi_pedidos`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ flight_id: f.id, guia: f.international_tracking, carrier: f.international_carrier, para, cc: String(b.cc || "").trim() || null, asunto, gmail_id: enviado.id || null, gmail_hilo: enviado.threadId || null, enviado_por: uid }) });
      // Lo que se mandó queda como plantilla de ese courier (la guía vuelve a {guia}).
      const pls = await leerPlantillas();
      pls[claveCarrier(f.international_carrier)] = { para, cc: String(b.cc || "").trim(), texto: texto.split(f.international_tracking).join("{guia}") };
      await guardarPlantillas(pls).catch(() => {});
      if (!ins.ok) return json({ ok: true, aviso: "Se mandó el mail pero falta correr el SQL de dsi_pedidos" });
      return json({ ok: true, pedido: lista(ins)[0] });
    }
    if (b.accion === "revisado") {
      await sb(`/rest/v1/dsi_pedidos?id=eq.${b.pedido_id}`, { method: "PATCH", body: JSON.stringify({ revisado_at: new Date().toISOString(), revisado_por: uid }) });
      return json({ ok: true });
    }
    return json({ error: "accion_desconocida" }, 400);
  } catch (e) {
    if (e.message === "no_conectado") return json({ error: "no_conectado" }, 409);
    return json({ error: e.message }, 500);
  }
}
