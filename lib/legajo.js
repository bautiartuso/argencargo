// Legajo de la operación (22/10/2026) — solo aéreo courier comercial.
// Documentos: DSI y factura del courier por los impuestos (se suben desde el vuelo o la op, tabla
// legajo_docs + bucket privado "legajos"); la factura de Argencargo sale de invoices y el recibo de
// los cobros. Para cerrar la op hacen falta la DSI y la factura del courier.
import { parseDsiTokens } from "./dsi.js";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const BUCKET = "legajos";

export const TIPOS_LEGAJO = {
  dsi: { l: "Destinación simplificada (DSI)", corto: "DSI", obligatorio: true },
  factura_courier: { l: "Factura del courier (impuestos)", corto: "Factura courier", obligatorio: true },
  // Guía aérea (AWB) del courier: llega con la DSI en el mail, no hace falta para cerrar (23/10/2026).
  guia_aerea: { l: "Guía aérea", corto: "Guía aérea", obligatorio: false },
  // Factura de la mercadería (26/10/2026, la "comercial del vuelo"): la del courier (exportador →
  // consignatario), la sube el agente al despachar. La ve solo quien tiene el legajo completo.
  factura_comercial: { l: "Factura de la mercadería", corto: "Factura mercadería", obligatorio: false },
};
export const TIPOS_INTERNOS = ["factura_comercial"];

// Solo el aéreo courier comercial lleva legajo (Gestión Integral no: su cierre lo maneja el panel GI).
export const llevaLegajo = (op) => op?.channel === "aereo_blanco" && op?.service_type !== "gestion_integral";

const h = (token, extra = {}) => ({ apikey: SB_KEY, Authorization: `Bearer ${token}`, ...extra });

export async function listarLegajo(token, { opIds = null, flightId = null } = {}) {
  const f = opIds ? `operation_id=in.(${opIds.join(",")})` : `flight_id=eq.${flightId}`;
  const r = await fetch(`${SB_URL}/rest/v1/legajo_docs?${f}&borrado_at=is.null&select=*&order=uploaded_at.desc`, { headers: h(token) });
  if (!r.ok) return { ok: false, docs: [], sinTabla: r.status === 404 || r.status === 400 };
  return { ok: true, docs: await r.json() };
}

// ¿Tiene lo obligatorio para cerrar? Si la tabla todavía no existe (falta correr el SQL) no se bloquea.
// Retenida por Aduana (26/10/2026): la carga salió del régimen courier, no va a haber DSI ni factura
// del courier. No se exige nada para cerrar.
export const legajoObligatorio = (op) => llevaLegajo(op) && !op?.retenida_at;
export async function legajoCompleto(token, op) {
  if (!legajoObligatorio(op)) return { ok: true, faltan: [] };
  const { ok, docs, sinTabla } = await listarLegajo(token, { opIds: [op.id] });
  // Sin tabla (falta el SQL) no se bloquea; cualquier otro error (sesión vencida, red) bloquea el
  // cierre: antes dejaba pasar y una op se cerró sin la factura del courier (AC-0289, 26/10/2026).
  if (!ok) return sinTabla ? { ok: true, faltan: [] } : { ok: false, faltan: Object.keys(TIPOS_LEGAJO).filter((t) => TIPOS_LEGAJO[t].obligatorio), error: "No se pudo leer el legajo" };
  const faltan = Object.keys(TIPOS_LEGAJO).filter((t) => TIPOS_LEGAJO[t].obligatorio && !docs.some((d) => d.tipo === t));
  return { ok: faltan.length === 0, faltan };
}
export const nombresFaltan = (faltan) => faltan.map((t) => TIPOS_LEGAJO[t]?.corto || t).join(" y ");

// Ops que viajaron en el mismo vuelo (misma guía): la DSI, la factura del courier y la guía aérea son
// del vuelo, así que lo que se sube desde una op se asigna también a las otras (27/10/2026).
export async function opsDelMismoVuelo(token, opId) {
  const r = await fetch(`${SB_URL}/rest/v1/flight_operations?operation_id=eq.${opId}&select=flight_id`, { headers: h(token) });
  if (!r.ok) return [];
  const fids = [...new Set((await r.json()).map((x) => x.flight_id).filter(Boolean))];
  if (!fids.length) return [];
  const r2 = await fetch(`${SB_URL}/rest/v1/flight_operations?flight_id=in.(${fids.join(",")})&select=operation_id,operations(id,channel,service_type)`, { headers: h(token) });
  if (!r2.ok) return [];
  return [...new Set((await r2.json()).map((x) => x.operations).filter((o) => o && o.id !== opId && llevaLegajo(o)).map((o) => o.id))];
}
// A qué ops va un documento subido desde una op: la propia más las del mismo vuelo. La DSI solo a las
// hermanas que todavía no tienen una (cada RI puede tener la suya); factura y guía siempre a todas.
export async function destinosLegajo(token, opId, tipo) {
  const hermanas = await opsDelMismoVuelo(token, opId);
  if (!hermanas.length) return [opId];
  if (tipo !== "dsi") return [opId, ...hermanas];
  const { docs } = await listarLegajo(token, { opIds: hermanas });
  return [opId, ...hermanas.filter((hid) => !(docs || []).some((d) => d.operation_id === hid && d.tipo === "dsi"))];
}

export async function urlFirmada(token, path, seg = 3600) {
  if (!path) return null;
  const r = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${path}`, { method: "POST", headers: h(token, { "Content-Type": "application/json" }), body: JSON.stringify({ expiresIn: seg }) });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.signedURL ? `${SB_URL}/storage/v1${j.signedURL}` : null;
}

// Sube un archivo una sola vez y lo asigna a una o varias ops (reemplaza el mismo tipo que hubiera).
export async function subirLegajo(token, { file, opIds, flightId = null, tipo, datos = null, userId = null }) {
  if (!file || !opIds?.length || !TIPOS_LEGAJO[tipo]) throw new Error("Faltan datos");
  const ext = (file.name || "doc.pdf").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  const path = `${new Date().toISOString().slice(0, 7)}/${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: h(token, { "Content-Type": file.type || "application/pdf", "x-upsert": "false" }), body: file });
  if (!up.ok) throw new Error(`No se pudo subir el archivo (${up.status})`);
  const ahora = new Date().toISOString();
  // Lo anterior del mismo tipo en esas ops queda borrado (la limpieza de 180 días se lleva el archivo).
  await fetch(`${SB_URL}/rest/v1/legajo_docs?operation_id=in.(${opIds.join(",")})&tipo=eq.${tipo}&borrado_at=is.null`, { method: "PATCH", headers: h(token, { "Content-Type": "application/json" }), body: JSON.stringify({ borrado_at: ahora }) });
  const filas = opIds.map((id) => ({ operation_id: id, flight_id: flightId, tipo, storage_path: path, file_name: file.name || null, datos, uploaded_by: userId }));
  const r = await fetch(`${SB_URL}/rest/v1/legajo_docs`, { method: "POST", headers: h(token, { "Content-Type": "application/json", Prefer: "return=representation" }), body: JSON.stringify(filas) });
  if (!r.ok) throw new Error((await r.text()).slice(0, 160) || "No se pudo guardar");
  return r.json();
}

export async function quitarLegajo(token, docId) {
  await fetch(`${SB_URL}/rest/v1/legajo_docs?id=eq.${docId}`, { method: "PATCH", headers: h(token, { "Content-Type": "application/json" }), body: JSON.stringify({ borrado_at: new Date().toISOString() }) });
}

// Lee un PDF (pdf.js ya cargado) y dice qué es y de quién.
export async function analizarDocumento(pdfjs, file) {
  const esPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
  if (!esPdf) return { tipo: null, texto: "" };
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const toks = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) { const pg = await pdf.getPage(i); const tc = await pg.getTextContent(); toks.push(...tc.items.map((x) => String(x.str || "").trim()).filter(Boolean)); }
  const texto = toks.join(" ");
  if (/DESTINACI[OÓ]N SIMPLIFICADA/i.test(texto)) {
    const dsi = parseDsiTokens(toks);
    return { tipo: "dsi", dsi, guia: dsi.guia, cuits: dsi.destinatario?.cuit ? [dsi.destinatario.cuit] : [], nombre: dsi.destinatario?.nombre || null, texto };
  }
  // Factura del courier: CUIT/CUIL de 11 dígitos (con o sin guiones) y números de guía de 10-12 dígitos.
  const cuits = [...new Set((texto.match(/\b\d{2}-?\d{8}-?\d\b/g) || []).map((x) => x.replace(/\D/g, "")))];
  const guias = [...new Set(texto.match(/\b\d{10,12}\b/g) || [])];
  return { tipo: "factura_courier", cuits, guias, texto, desaduanaje: desaduanajeDeFactura(texto) };
}

// "1,526.00" / "1.526,00" / "183120" → número (el último separador es el decimal si tiene 1-2 dígitos).
const numFactura = (t) => {
  const x = String(t || "").trim();
  const m = x.match(/^(.*?)[.,](\d{1,2})$/);
  const n = m ? Number(`${m[1].replace(/[.,\s]/g, "")}.${m[2]}`) : Number(x.replace(/[.,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
// Desaduanaje de la factura del courier (23/10/2026): FedEx lo pone como "Tasa de Desembolso (ROD)"
// (reintegro y honorarios en pesos) con el "Tipo de Cambio" arriba. Se pasa a USD sin IVA y con el 21%.
export function desaduanajeDeFactura(texto) {
  const t = String(texto || "").replace(/\s+/g, " ");
  const tcM = t.match(/Tipo de Cambio:?\s*([\d.,]+)/i);
  const rodM = t.match(/(?:Tasa de )?Desembolso(?:\s*\(ROD\))?\s*([\d.,]+)\s+([\d.,]+)/i);
  const tc = tcM ? numFactura(tcM[1]) : null;
  if (!rodM || !(tc > 0)) return null;
  const ars = Math.max(numFactura(rodM[1]) || 0, numFactura(rodM[2]) || 0);
  if (!(ars > 0)) return null;
  const usd = Math.round((ars / tc) * 100) / 100;
  return { ars, tc, usdSinIva: usd, usdConIva: Math.round(usd * 1.21 * 100) / 100 };
}

// A qué ops del vuelo pertenece. ops: [{ id, operation_code, international_tracking, clients:{cuit,first_name,last_name,company_name} }]
// Devuelve ids o null si no se puede saber solo.
export function emparejarDocumento(info, ops) {
  if (!ops?.length) return null;
  const dig = (s) => String(s || "").replace(/\D/g, "");
  const guias = [info.guia, ...(info.guias || [])].map(dig).filter(Boolean);
  let m = ops.filter((o) => dig(o.international_tracking) && guias.includes(dig(o.international_tracking)));
  if (m.length) return m.map((o) => o.id);
  const cuits = (info.cuits || []).map(dig);
  m = ops.filter((o) => dig(o.clients?.cuit) && cuits.includes(dig(o.clients.cuit)));
  if (m.length) return m.map((o) => o.id);
  if (info.nombre) {
    const n = info.nombre.toLowerCase();
    m = ops.filter((o) => { const ap = String(o.clients?.last_name || "").toLowerCase().split(/\s+/)[0]; return ap.length > 2 && n.includes(ap); });
    if (m.length === 1) return [m[0].id];
  }
  return ops.length === 1 ? [ops[0].id] : null;
}
