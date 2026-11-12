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
//      { accion:"responder", pedido_id, texto, msg? } → contesta en la misma cadena al mail del courier (11/11/2026)
//      { accion:"pedir_formulario", flight_ids } → deja anotado que se pidió por el formulario web del courier
//
// FedEx (12/11/2026): pidió que no se le manden más mails; las copias de despacho se piden por su formulario
// web (queda registrado en su sistema) y contestan por mail en 48 a 72 h. El panel muestra los datos que pide
// el formulario para copiarlos, y el pedido se anota a mano ("Ya la pedí"). La respuesta se reconoce por
// cualquier mail de @fedex.com que nombre la guía.
import { leerConfig, gm, hdr, b64dec, b64url, recorrer, armarMime, BUCKET } from "../../../../lib/gmail";
import { docEsAdjunto } from "../../../../lib/legajo";

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

// La sesión validada se recuerda 5 minutos por token (cada clic pedía usuario + rol de nuevo).
const sesiones = new Map();
async function staff(req) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return null;
  const c = sesiones.get(tok);
  if (c && c.vence > Date.now()) return c.uid;
  const uid = await staffSinCache(tok);
  if (uid) { if (sesiones.size > 200) sesiones.clear(); sesiones.set(tok, { uid, vence: Date.now() + 5 * 60000 }); }
  return uid;
}
async function staffSinCache(tok) {
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!u?.id) return null;
  const p = await sb(`/rest/v1/profiles?id=eq.${u.id}&select=role&limit=1`);
  return ["admin", "empleado"].includes(lista(p)[0]?.role) ? u.id : null;
}

const asuntoDe = (guia) => `Solicitud DSI ${guia}`;
const claveCarrier = (c) => String(c || "otro").toLowerCase().replace(/[^a-z]/g, "") || "otro";
// Couriers que piden la DSI por formulario web en vez de por mail.
const FORMULARIOS = { fedex: { url: "https://www.fedex.com/ar/contact/orderform_2.html", dominio: "fedex.com", para: "Formulario de FedEx" } };
const esPorFormulario = (para) => /^formulario/i.test(String(para || ""));
const CAMPOS_FORM = "id,international_tracking,international_carrier,dest_tax_id,liberado_rg_at,carrier_delivered_at,received_at";
// Lo que hay que cargar en el formulario: la primera guía en los campos y el resto en comentarios.
function datosFormulario(fl, email) {
  const cfg = FORMULARIOS[claveCarrier(fl[0]?.international_carrier)];
  if (!cfg) return null;
  const fecha = (f) => { const v = f.liberado_rg_at || f.carrier_delivered_at || f.received_at; return v ? new Date(v).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" }) : ""; };
  const items = fl.filter((f) => f.international_tracking).map((f) => ({ flight_id: f.id, guia: f.international_tracking, cuit: String(f.dest_tax_id || "").replace(/\D/g, ""), fecha: fecha(f) }));
  return { url: cfg.url, email: email || "", items };
}
// Solo se pide la DSI. Entre el 05/11 y el 10/11/2026 también se pedía la factura del courier con los
// impuestos; Bautista lo sacó ("solamente necesitamos la destinación simplificada").
const textoBase = (f) => `Buenas tardes,\n\nLes pedimos la DSI (Destinación Simplificada de Importación) de la guía ${f.international_tracking}${f.dest_name ? `, destinatario ${f.dest_name}${f.dest_tax_id ? ` (CUIT ${f.dest_tax_id})` : ""}` : ""}.\n\nMuchas gracias.\nArgencargo`;

// Mail para varias guías juntas (FedEx, 23/10/2026): la plantilla dice "la destinación simplificada de
// la guía {guia}"; con varias pasa a plural y las guías van una por renglón.
function textoVarias(plantilla, guias) {
  const t = plantilla || "Buenas tardes,\n\nLes pedimos la DSI de la guía {guia}.\n\nMuchas gracias.\nArgencargo";
  if (guias.length === 1) return t.replace(/\{guia\}/g, guias[0]);
  const lista = guias.map((g) => `- ${g}`).join("\n");
  return t.replace(/la destinaci[oó]n simplificada/gi, "las destinaciones simplificadas").replace(/la DSI/g, "las DSI")
    .replace(/(de )?la gu[ií]a \{guia\}\.?/gi, (m, de) => `${de || ""}las guías:\n\n${lista}`).replace(/\{guia\}/g, `\n${lista}\n`);
}
const asuntoVarias = (guias) => (guias.length === 1 ? asuntoDe(guias[0]) : `Solicitud DSI ${guias.join(" / ")}`);

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
// Qué mails son respuesta de un pedido (23/10/2026): los del hilo "Solicitud DSI <guía>" o cualquier
// mail de quien se le pidió (p.para) que nombre la guía en el texto o en un adjunto. FedEx contesta un
// solo mail "DESPACHOS" con varias guías, el manifiesto (guía aérea) y una DSI por guía.
const direccionesDe = (para) => String(para || "").split(/[,;]/).map((x) => (x.match(/[\w.+-]+@[\w.-]+/) || [])[0]).filter(Boolean);
function consultaPedido(p, { sinMios = false } = {}) {
  // Después de contestarle al courier (espera_desde), solo cuenta como respuesta lo que llegue desde ahí.
  const desde = sinMios && p.espera_desde ? Math.floor(new Date(p.espera_desde).getTime() / 1000) : Math.floor(new Date(p.enviado_at || Date.now()).getTime() / 1000) - 86400;
  const de = direccionesDe(p.para);
  const form = esPorFormulario(p.para) ? FORMULARIOS[claveCarrier(p.carrier)] || FORMULARIOS.fedex : null;
  const porRemitente = form ? ` (from:${form.dominio} "${p.guia}")` : de.length ? ` (from:(${de.join(" OR ")}) "${p.guia}")` : "";
  return `{subject:"${asuntoDe(p.guia)}"${porRemitente}} after:${desde}${sinMios ? " -from:me" : ""}`;
}

async function revisar(forzar = false) {
  if (!forzar && Date.now() - ultimaRevision < 2 * 60000) return;
  ultimaRevision = Date.now();
  const desde = new Date(Date.now() - 45 * 86400000).toISOString();
  const abiertos = lista(await sb(`/rest/v1/dsi_pedidos?respuesta_at=is.null&enviado_at=gte.${desde}&select=id,guia,para,carrier,enviado_at,espera_desde`));
  await Promise.all(abiertos.map(revisarUno));
}
async function revisarUno(p) {
  const d = await gm(`/messages?maxResults=5&includeSpamTrash=true&q=${encodeURIComponent(consultaPedido(p, { sinMios: true }))}`).catch(() => null);
  const primero = (d?.messages || []).slice(-1)[0];
  if (!primero) return;
  const m = await gm(`/messages/${primero.id}?format=metadata&metadataHeaders=From`).catch(() => null);
  if (!m) return;
  await sb(`/rest/v1/dsi_pedidos?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ respuesta_at: new Date(Number(m.internalDate) || Date.now()).toISOString(), respuesta_de: hdr(m.payload?.headers, "From") || null }) });
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
      // DSI ya cargada en todas las ops del vuelo (11/11/2026): no hay nada que adjuntar, el pedido se da por
      // revisado solo y el cartel 📬 DSI desaparece (antes quedaba hasta abrir la respuesta del courier).
      let abiertos = [...new Set(lista(r).map((x) => x.flight_id).filter(Boolean))];
      if (abiertos.length) {
        const fos = lista(await sb(`/rest/v1/flight_operations?flight_id=in.(${abiertos.join(",")})&select=flight_id,operation_id`));
        const opIds = [...new Set(fos.map((x) => x.operation_id))];
        const docs = opIds.length ? lista(await sb(`/rest/v1/legajo_docs?operation_id=in.(${opIds.join(",")})&tipo=eq.dsi&borrado_at=is.null&select=operation_id`)) : [];
        const conDsi = new Set(docs.map((d) => d.operation_id));
        const listos = abiertos.filter((fid) => { const o = fos.filter((x) => x.flight_id === fid); return o.length && o.every((x) => conDsi.has(x.operation_id)); });
        if (listos.length) {
          await sb(`/rest/v1/dsi_pedidos?flight_id=in.(${listos.join(",")})&revisado_at=is.null`, { method: "PATCH", body: JSON.stringify({ revisado_at: new Date().toISOString(), revisado_por: uid }) });
          abiertos = abiertos.filter((fid) => !listos.includes(fid));
        }
      }
      return json({ respondidos: abiertos.length, vuelos: abiertos, porPedir });
    }
    if (accion === "vuelo") {
      const fid = u.searchParams.get("flight_id") || "";
      const [fr, pr, cfg, pls] = await Promise.all([
        sb(`/rest/v1/flights?id=eq.${fid}&select=${CAMPOS_FORM},flight_code,dest_name&limit=1`),
        sb(`/rest/v1/dsi_pedidos?flight_id=eq.${fid}&select=*&order=enviado_at.desc&limit=1`),
        leerConfig().catch(() => null),
        leerPlantillas(),
      ]);
      const f = lista(fr)[0];
      if (!f) return json({ error: "no_encontrado" }, 404);
      const conectado = !!cfg?.refresh_token;
      const pedido = lista(pr)[0] || null;
      const pl = pls[claveCarrier(f.international_carrier)] || {};
      const plantilla = { para: pl.para || "", cc: pl.cc || "", asunto: f.international_tracking ? asuntoDe(f.international_tracking) : "", texto: pl.texto ? pl.texto.replace(/\{guia\}/g, f.international_tracking || "") : textoBase(f) };
      let mensajes = [];
      if (pedido && conectado) {
        const [, d, otrosR] = await Promise.all([
          pedido.respuesta_at ? null : revisarUno(pedido).catch(() => {}),
          gm(`/messages?maxResults=10&includeSpamTrash=true&q=${encodeURIComponent(consultaPedido(pedido))}`).catch(() => ({})),
          sb(`/rest/v1/dsi_pedidos?enviado_at=gte.${new Date(Date.now() - 60 * 86400000).toISOString()}&select=id,guia,flight_id,revisado_at&order=enviado_at.desc`),
        ]);
        // Guías de otros pedidos que aparecen en el mismo mail (texto o nombre de los adjuntos).
        const pedidosGuia = []; for (const x of lista(otrosR)) if (!pedidosGuia.some((y) => y.guia === x.guia)) pedidosGuia.push(x);
        const full = await Promise.all((d.messages || []).map((m) => gm(`/messages/${m.id}?format=full`).catch(() => null)));
        mensajes = full.filter(Boolean).map((m) => {
          const out = { html: "", texto: "", adjuntos: [] };
          recorrer(m.payload, out);
          const h = m.payload?.headers || [];
          const de = hdr(h, "From");
          const texto = out.texto || textoPlano(out.html);
          const adjuntos = out.adjuntos.filter((a) => !a.cid || /pdf|octet/i.test(a.tipo)).map(({ id, nombre, tipo, tamano }) => ({ id, nombre, tipo, tamano, guia: (pedidosGuia.find((x) => String(nombre || "").includes(x.guia)) || {}).guia || null }));
          const todo = `${hdr(h, "Subject")} ${texto} ${adjuntos.map((a) => a.nombre).join(" ")}`;
          const guias = pedidosGuia.filter((x) => todo.includes(x.guia)).map((x) => ({ guia: x.guia, flight_id: x.flight_id, pedido_id: x.id }));
          return { id: m.id, de, asunto: hdr(h, "Subject"), mio: !!cfg.email && de.toLowerCase().includes(String(cfg.email).toLowerCase()), fecha: Number(m.internalDate) || 0, texto: texto.slice(0, 4000), adjuntos, guias };
        }).sort((a, b) => a.fecha - b.fecha);
        // Adjuntos que ya se cargaron en el legajo de otro vuelo (23/10/2026): se muestran tachados. Cuenta solo si
        // el documento salió de ese mismo mail (gmail_msg, 06/11/2026), no por el nombre del archivo.
        const nombres = [...new Set(mensajes.flatMap((m) => m.adjuntos.map((x) => x.nombre)).filter(Boolean))];
        if (nombres.length) {
          const lst = nombres.map((n) => `"${String(n).replace(/"/g, '\\"')}"`).join(",");
          const usados = lista(await sb(`/rest/v1/legajo_docs?file_name=in.(${encodeURIComponent(lst)})&borrado_at=is.null&flight_id=not.is.null&flight_id=neq.${fid}&select=file_name,tipo,gmail_msg,uploaded_at,flights(flight_code)`));
          for (const m of mensajes) for (const x of m.adjuntos) { const u = usados.find((y) => docEsAdjunto(y, m.id, m.fecha, x.nombre)); if (u) x.usadoEn = { vuelo: u.flights?.flight_code || "otro vuelo", tipo: u.tipo }; }
        }
        if (!pedido.respuesta_at && mensajes.some((m) => !m.mio)) { const pr2 = lista(await sb(`/rest/v1/dsi_pedidos?id=eq.${pedido.id}&select=*`))[0]; if (pr2) Object.assign(pedido, pr2); }
      }
      return json({ conectado, guia: f.international_tracking || null, carrier: f.international_carrier || null, pedido, plantilla, mensajes, formulario: datosFormulario([f], cfg?.email) });
    }
    if (accion === "plantilla") {
      const ids = (u.searchParams.get("flight_ids") || "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x));
      const fl = ids.length ? lista(await sb(`/rest/v1/flights?id=in.(${ids.join(",")})&select=${CAMPOS_FORM}`)) : [];
      fl.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      const guias = fl.map((f) => f.international_tracking).filter(Boolean);
      const pl = (await leerPlantillas())[claveCarrier(fl[0]?.international_carrier)] || {};
      const formulario = FORMULARIOS[claveCarrier(fl[0]?.international_carrier)] ? datosFormulario(fl, (await leerConfig().catch(() => null))?.email) : null;
      return json({ para: pl.para || "", cc: pl.cc || "", asunto: asuntoVarias(guias), texto: textoVarias(pl.texto, guias), guias, formulario });
    }
    if (accion === "adjunto") {
      const msg = u.searchParams.get("msg") || "";
      // Solo adjuntos de mails de un pedido de DSI (el hilo o quien contesta los pedidos): el empleado
      // no ve el resto de la casilla.
      const [m, parasR, d] = await Promise.all([
        gm(`/messages/${msg}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`),
        sb(`/rest/v1/dsi_pedidos?select=para`),
        gm(`/messages/${msg}/attachments/${u.searchParams.get("adj")}`),
      ]);
      const remitente = ((hdr(m.payload?.headers, "From").match(/[\w.+-]+@[\w.-]+/) || [])[0] || "").toLowerCase();
      const paras = new Set(lista(parasR).flatMap((x) => direccionesDe(x.para)).map((x) => x.toLowerCase()));
      // Los pedidos hechos por formulario los contesta cualquier casilla del courier.
      const delCourier = lista(parasR).some((x) => esPorFormulario(x.para)) && Object.values(FORMULARIOS).some((c) => remitente.endsWith(`@${c.dominio}`) || remitente.endsWith(`.${c.dominio}`));
      if (!/Solicitud DSI/i.test(hdr(m.payload?.headers, "Subject")) && !paras.has(remitente) && !delCourier) return json({ error: "sin_permiso" }, 403);
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
      // Uno (flight_id) o varios vuelos del mismo courier en un solo mail (flight_ids, FedEx).
      const ids = (Array.isArray(b.flight_ids) ? b.flight_ids : [b.flight_id]).filter((x) => /^[0-9a-f-]{36}$/i.test(String(x || "")));
      const fl = ids.length ? lista(await sb(`/rest/v1/flights?id=in.(${ids.join(",")})&select=id,international_tracking,international_carrier`)).filter((f) => f.international_tracking) : [];
      if (!fl.length) return json({ error: "El vuelo no tiene número de guía" }, 400);
      const cfg = await leerConfig();
      if (!cfg?.refresh_token) return json({ error: "no_conectado" }, 409);
      const guias = fl.map((f) => f.international_tracking);
      const asunto = asuntoVarias(guias);
      const texto = String(b.texto || "").trim() || textoVarias(((await leerPlantillas())[claveCarrier(fl[0].international_carrier)] || {}).texto, guias);
      const cc = String(b.cc || "").trim();
      const mime = armarMime({ de: cfg.email, para, cc: cc || undefined, asunto, texto });
      const enviado = await gm("/messages/send", { method: "POST", body: JSON.stringify({ raw: b64url(Buffer.from(mime, "utf8")) }) });
      const ins = await sb(`/rest/v1/dsi_pedidos`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(fl.map((f) => ({ flight_id: f.id, guia: f.international_tracking, carrier: f.international_carrier, para, cc: cc || null, asunto, gmail_id: enviado.id || null, gmail_hilo: enviado.threadId || null, enviado_por: uid }))) });
      // Lo que se mandó queda como plantilla de ese courier (la guía vuelve a {guia}); con varias guías
      // solo se guardan los destinatarios, el texto en plural no sirve de plantilla.
      const pls = await leerPlantillas();
      const k = claveCarrier(fl[0].international_carrier);
      pls[k] = { ...(pls[k] || {}), para, cc, ...(fl.length === 1 ? { texto: texto.split(guias[0]).join("{guia}") } : {}) };
      await guardarPlantillas(pls).catch(() => {});
      if (!ins.ok) return json({ ok: true, aviso: "Se mandó el mail pero falta correr el SQL de dsi_pedidos" });
      return json({ ok: true, pedidos: lista(ins), pedido: lista(ins)[0] });
    }
    if (b.accion === "pedir_formulario") {
      const ids = (Array.isArray(b.flight_ids) ? b.flight_ids : [b.flight_id]).filter((x) => /^[0-9a-f-]{36}$/i.test(String(x || "")));
      const fl = ids.length ? lista(await sb(`/rest/v1/flights?id=in.(${ids.join(",")})&select=id,international_tracking,international_carrier`)).filter((f) => f.international_tracking && FORMULARIOS[claveCarrier(f.international_carrier)]) : [];
      if (!fl.length) return json({ error: "Ese courier no se pide por formulario" }, 400);
      const guias = fl.map((f) => f.international_tracking);
      const ins = await sb(`/rest/v1/dsi_pedidos`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(fl.map((f) => ({ flight_id: f.id, guia: f.international_tracking, carrier: f.international_carrier, para: FORMULARIOS[claveCarrier(f.international_carrier)].para, asunto: asuntoVarias(guias), enviado_por: uid }))) });
      if (!ins.ok) return json({ error: "No se pudo anotar el pedido" }, 500);
      return json({ ok: true, pedidos: lista(ins) });
    }
    if (b.accion === "responder") {
      const texto = String(b.texto || "").trim();
      if (!texto) return json({ error: "Escribí la respuesta" }, 400);
      const pid = String(b.pedido_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(pid)) return json({ error: "pedido_invalido" }, 400);
      const p = lista(await sb(`/rest/v1/dsi_pedidos?id=eq.${pid}&select=*&limit=1`))[0];
      if (!p) return json({ error: "no_encontrado" }, 404);
      const cfg = await leerConfig();
      if (!cfg?.refresh_token) return json({ error: "no_conectado" }, 409);
      // Solo se puede contestar un mail de este pedido: el que eligió la pantalla o el último del courier.
      const delPedido = ((await gm(`/messages?maxResults=20&includeSpamTrash=true&q=${encodeURIComponent(consultaPedido({ ...p, espera_desde: null }, { sinMios: true }))}`).catch(() => ({}))).messages || []).map((x) => x.id);
      const msgId = delPedido.includes(String(b.msg || "")) ? String(b.msg) : delPedido[0];
      if (!msgId) return json({ error: "Todavía no hay un mail del courier para responder" }, 400);
      const m = await gm(`/messages/${msgId}?format=full`);
      const h = m.payload?.headers || [];
      const correos = (x) => String(x || "").toLowerCase().match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/g) || [];
      const yo = String(cfg.email || "").toLowerCase();
      const para = hdr(h, "Reply-To") || hdr(h, "From");
      const cc = [...new Set([...correos(hdr(h, "To")), ...correos(hdr(h, "Cc")), ...correos(p.cc)])].filter((e) => e !== yo && !correos(para).includes(e));
      const asunto0 = hdr(h, "Subject") || p.asunto || asuntoDe(p.guia);
      const mid = hdr(h, "Message-ID") || hdr(h, "Message-Id");
      // Debajo va el mail al que se contesta, citado, como en cualquier respuesta.
      const out = { html: "", texto: "", adjuntos: [] };
      recorrer(m.payload, out);
      const orig = (out.texto || textoPlano(out.html)).slice(0, 6000);
      const cuando = new Date(Number(m.internalDate) || Date.now()).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
      const cab = `El ${cuando}, ${hdr(h, "From")} escribió:`;
      const esc = (x) => String(x || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
      const mime = armarMime({
        de: cfg.email, para, cc: cc.join(", ") || undefined, asunto: /^\s*re:/i.test(asunto0) ? asunto0 : `Re: ${asunto0}`, texto,
        enRespuestaA: mid || undefined, referencias: [hdr(h, "References"), mid].filter(Boolean).join(" ") || undefined,
        textoExtra: `\n\n${cab}\n${orig.split("\n").map((l) => `> ${l}`).join("\n")}`,
        htmlExtra: `<br><div style="font-family:Arial,sans-serif;font-size:13px;color:#555">${esc(cab)}</div><blockquote style="margin:6px 0 0 6px;padding-left:10px;border-left:2px solid #ccc;font-family:Arial,sans-serif;font-size:13px;color:#555;white-space:pre-wrap">${esc(orig)}</blockquote>`,
      });
      const enviado = await gm("/messages/send", { method: "POST", body: JSON.stringify({ raw: b64url(Buffer.from(mime, "utf8")), threadId: m.threadId }) });
      if (!enviado?.id) return json({ error: "No se pudo mandar la respuesta" }, 500);
      // El pedido vuelve a "esperando respuesta": el cartel se prende de nuevo cuando el courier conteste.
      await sb(`/rest/v1/dsi_pedidos?id=eq.${pid}`, { method: "PATCH", body: JSON.stringify({ respuesta_at: null, respuesta_de: null, espera_desde: new Date().toISOString() }) });
      return json({ ok: true, para, cc });
    }
    if (b.accion === "revisado") {
      const marca = { revisado_at: new Date().toISOString(), revisado_por: uid };
      await sb(`/rest/v1/dsi_pedidos?id=eq.${b.pedido_id}`, { method: "PATCH", body: JSON.stringify(marca) });
      // Los otros pedidos del mismo mail se cierran solos si su vuelo ya tiene la DSI en todas sus ops.
      const otros = (Array.isArray(b.otros) ? b.otros : []).filter((x) => /^[0-9a-f-]{36}$/i.test(x) && x !== b.pedido_id);
      const cerrados = [];
      for (const id of otros) {
        const p = lista(await sb(`/rest/v1/dsi_pedidos?id=eq.${id}&revisado_at=is.null&select=id,flight_id`))[0];
        if (!p) continue;
        const ops = lista(await sb(`/rest/v1/flight_operations?flight_id=eq.${p.flight_id}&select=operations(id,channel,service_type)`)).map((x) => x.operations).filter((o) => o && o.channel === "aereo_blanco" && o.service_type !== "gestion_integral");
        if (!ops.length) continue;
        const docs = lista(await sb(`/rest/v1/legajo_docs?operation_id=in.(${ops.map((o) => o.id).join(",")})&tipo=eq.dsi&borrado_at=is.null&select=operation_id`));
        if (!ops.every((o) => docs.some((d) => d.operation_id === o.id))) continue;
        await sb(`/rest/v1/dsi_pedidos?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(marca) });
        cerrados.push(id);
      }
      return json({ ok: true, cerrados });
    }
    return json({ error: "accion_desconocida" }, 400);
  } catch (e) {
    if (e.message === "no_conectado") return json({ error: "no_conectado" }, 409);
    return json({ error: e.message }, 500);
  }
}
