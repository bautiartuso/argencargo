// GET /api/cron/factura-courier-mail — cada 15 min (16/11/2026, pedido de Bautista).
// DHL manda su factura en PDF por mail ("Documentación de soporte para AWB: <guía>" al pagar, o
// "DHL-Preliquidacion AWB <guía>" al entrar a nacionalización). Antes había que bajarla y subirla a mano al legajo del vuelo. Ahora este cron la toma del mail y la
// carga como factura del courier en todas las operaciones del vuelo de esa guía que todavía no la tengan.
// · Solo mails de @dhl.com, con la guía en el asunto y un PDF adjunto.
// · FedEx también desde el 26/11/2026: "FedEx - Pago de derechos e impuestos - Guía <guía>" con <guía>.pdf.
// · No pisa una factura ya cargada; sí reemplaza la marca "sin factura del courier".
// · Cada mail se procesa una vez (legajo_docs.gmail_msg). Avisa por Telegram lo que cargó.
import { esCronValido } from "../../../../lib/auth-server";
import { gm, hdr, recorrer, b64dec } from "../../../../lib/gmail";
import { tgNotify } from "../../../../lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const BUCKET = "legajos";
// Dos mails de DHL traen la factura (17/11/2026): "Documentación de soporte para AWB: <guía>" (después de
// pagar) y "DHL-Preliquidacion AWB <guía>" (cuando entra a nacionalizarse, con la factura de aranceles
// DHL_<número>.pdf). Vale el primero que llegue; el otro no pisa nada.
// FedEx (26/11/2026): "FedEx - Pago de derechos e impuestos - Guía <guía>" trae la factura como <guía>.pdf.
// Solo el mail original (las respuestas de la cadena no) y solo ese PDF.
const CONSULTA = '{(from:dhl.com {subject:"Documentación de soporte" subject:Preliquidacion}) (from:fedex.com subject:"Pago de derechos e impuestos")} has:attachment newer_than:12d';
const COURIERS = [
  { nombre: "DHL", de: (m) => m.endsWith("@dhl.com") || m.endsWith(".dhl.com"), guia: (asunto) => (asunto.match(/AWB:?\s*(\d{8,12})/i) || [])[1] || null, porAdjunto: true },
  { nombre: "FedEx", de: (m) => m.endsWith("@fedex.com") || m.endsWith(".fedex.com"), guia: (asunto) => (asunto.match(/^\s*FedEx - Pago de derechos e impuestos - Gu.{1,2}a\s*(\d{12})\b/i) || [])[1] || null, soloNombreGuia: true },
];
// Mails ya resueltos sin nada para cargar (no son del courier, sin guía, el vuelo ya tenía la factura): no se
// vuelven a leer mientras viva la instancia. Leer un mail entero cuesta 60 unidades del cupo de Gmail.
const SALTEAR = new Set();

const sb = (path, init = {}) => {
  const key = process.env.SUPABASE_SERVICE_ROLE;
  return fetch(`${SB_URL}${path}`, { ...init, cache: "no-store", headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
};
const lista = async (r) => { const j = await r.json().catch(() => []); return Array.isArray(j) ? j : []; };

export async function GET(req) {
  if (!esCronValido(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const out = [];
  try {
    const ids = ((await gm(`/messages?q=${encodeURIComponent(CONSULTA)}&maxResults=40`)).messages || []).map((m) => m.id);
    if (!ids.length) return Response.json({ ok: true, mails: 0 });
    // Los mails que ya dieron un documento no se vuelven a mirar.
    const hechos = new Set((await lista(await sb(`/rest/v1/legajo_docs?gmail_msg=in.(${ids.join(",")})&select=gmail_msg`))).map((d) => d.gmail_msg));
    for (const id of ids.filter((x) => !hechos.has(x) && !SALTEAR.has(x))) {
      // Primero solo el encabezado (20 unidades): el mail entero (60) se pide recién cuando hay algo para cargar.
      const cab = await gm(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
      const de = (hdr(cab.payload?.headers, "From").match(/[\w.+-]+@[\w.-]+/) || [""])[0].toLowerCase();
      const asunto = hdr(cab.payload?.headers, "Subject");
      const courier = COURIERS.find((c) => c.de(de));
      if (!courier) { SALTEAR.add(id); continue; }
      let guia = courier.guia(asunto);
      if (!guia && !courier.porAdjunto) { SALTEAR.add(id); continue; }
      let m = null, pdfs = [];
      const completo = async () => {
        if (m) return;
        m = await gm(`/messages/${id}?format=full`);
        const partes = { adjuntos: [], html: "", texto: "" };
        recorrer(m.payload, partes);
        pdfs = partes.adjuntos.filter((a) => /pdf/i.test(a.tipo) || /\.pdf$/i.test(a.nombre || ""));
      };
      if (!guia) { await completo(); guia = pdfs.map((a) => (String(a.nombre).match(/^(\d{8,12})\.pdf$/i) || [])[1]).find(Boolean) || null; }
      if (!guia) { SALTEAR.add(id); continue; }
      const vuelo = (await lista(await sb(`/rest/v1/flights?international_tracking=eq.${guia}&select=id,flight_code&order=created_at.desc&limit=1`)))[0];
      if (!vuelo) { out.push({ guia, salto: "sin_vuelo" }); continue; }
      const fos = await lista(await sb(`/rest/v1/flight_operations?flight_id=eq.${vuelo.id}&select=operations(id,operation_code,channel,service_type)`));
      const ops = fos.map((f) => f.operations).filter((o) => o && o.channel === "aereo_blanco" && o.service_type !== "gestion_integral");
      if (!ops.length) { out.push({ guia, vuelo: vuelo.flight_code, salto: "sin_ops_con_legajo" }); continue; }
      const docs = await lista(await sb(`/rest/v1/legajo_docs?operation_id=in.(${ops.map((o) => o.id).join(",")})&tipo=eq.factura_courier&borrado_at=is.null&select=id,operation_id,storage_path`));
      const faltan = ops.filter((o) => !docs.some((d) => d.operation_id === o.id && d.storage_path));
      if (!faltan.length) { SALTEAR.add(id); out.push({ guia, vuelo: vuelo.flight_code, salto: "ya_tenia" }); continue; }
      await completo();
      if (!pdfs.length) { SALTEAR.add(id); continue; }
      const adj = pdfs.find((a) => courier.soloNombreGuia ? new RegExp(`^${guia}\\s*\\.pdf$`, "i").test(String(a.nombre || "").trim()) : String(a.nombre || "").includes(guia)) || (!courier.soloNombreGuia && pdfs.length === 1 ? pdfs[0] : null);
      if (!adj) { SALTEAR.add(id); out.push({ guia, salto: courier.soloNombreGuia ? "sin_pdf_de_la_guia" : "varios_pdf" }); continue; }
      const bytes = b64dec((await gm(`/messages/${id}/attachments/${adj.id}`)).data);
      if (bytes.length < 500 || bytes.slice(0, 5).toString("latin1") !== "%PDF-") { out.push({ guia, vuelo: vuelo.flight_code, salto: "adjunto_invalido" }); continue; }
      const path = `${new Date().toISOString().slice(0, 7)}/factura_courier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
      const up = await sb(`/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { "Content-Type": "application/pdf", "x-upsert": "false" }, body: bytes });
      if (!up.ok) { out.push({ guia, vuelo: vuelo.flight_code, error: `storage ${up.status}` }); continue; }
      // Las marcas "sin factura del courier" de esas ops dejan de valer: llegó la factura.
      const marcas = docs.filter((d) => !d.storage_path && faltan.some((o) => o.id === d.operation_id)).map((d) => d.id);
      if (marcas.length) await sb(`/rest/v1/legajo_docs?id=in.(${marcas.join(",")})`, { method: "PATCH", body: JSON.stringify({ borrado_at: new Date().toISOString() }) });
      const ins = await sb(`/rest/v1/legajo_docs`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(faltan.map((o) => ({ operation_id: o.id, flight_id: vuelo.id, tipo: "factura_courier", storage_path: path, file_name: adj.nombre || `${guia}.pdf`, datos: null, gmail_msg: id }))) });
      if (!ins.ok) { out.push({ guia, vuelo: vuelo.flight_code, error: (await ins.text()).slice(0, 140) }); continue; }
      out.push({ courier: courier.nombre, guia, vuelo: vuelo.flight_code, ops: faltan.map((o) => o.operation_code) });
      await tgNotify(`🧾 <b>${vuelo.flight_code}</b>: cargué sola la factura de ${courier.nombre} (guía ${guia}) que llegó por mail en ${faltan.map((o) => o.operation_code).join(", ")}.`).catch(() => {});
    }
    return Response.json({ ok: true, mails: ids.length, resultado: out });
  } catch (e) {
    if (e.message === "no_conectado") return Response.json({ ok: true, sin_gmail: true });
    return Response.json({ ok: false, error: String(e.message || e).slice(0, 200), resultado: out }, { status: 500 });
  }
}
