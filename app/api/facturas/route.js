// GET  /api/facturas?operation_id=… | ?limit=…  → facturas emitidas (admin)
// POST /api/facturas → emite una Factura C vía ARCA y la guarda (admin)
// POST /api/facturas {action:"omitir"|"reponer", operation_id} → marca/desmarca una op como "no se factura"
//   (cs_settings facturas_omitidas, lista de ids) para que salga de "Por facturar".
// POST /api/facturas {action:"nota_credito", invoice_id, importe?, motivo} → Nota de Crédito C (tipo 13)
//   asociada a esa factura, por el total (default) o parcial. Queda en invoices con tipo_cbte 13 y
//   anula_id = la factura (si la columna no existe todavía, la referencia va en el detalle).
//   body: { operation_id?, client_id?, doc_tipo (80 CUIT/96 DNI/99 CF), doc_nro,
//           receptor_nombre, receptor_domicilio, receptor_cond_iva, importe (ARS),
//           detalle, fecha? (default hoy AR) }
//
// El flujo es de una sola vía: se llama a ARCA únicamente acá, al emitir.

import { arcaReady, arcaConfig, emitirFacturaC } from "../../../lib/arca";
import { payloadVerificado } from "../../../lib/auth-server";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 60;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: opts.method === "POST" || opts.method === "PATCH" ? "return=representation" : undefined, ...(opts.headers || {}) },
  });
  const t = await r.text();
  let b = null; try { b = JSON.parse(t); } catch {}
  return { status: r.status, body: b };
}

async function isAdmin(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const payload = (await payloadVerificado(auth.slice(7)));
    const p = await sb(`/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p.body) && p.body[0]?.role === "admin";
  } catch { return false; }
}

async function omitidas() {
  const r = await sb(`/cs_settings?key=eq.facturas_omitidas&select=value`);
  const v = Array.isArray(r.body) && r.body[0] ? r.body[0].value : null;
  return Array.isArray(v) ? v : [];
}
async function guardarOmitidas(lista) {
  await sb(`/cs_settings?on_conflict=key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "facturas_omitidas", value: lista.slice(0, 2000), updated_at: new Date().toISOString() }) });
}

export async function GET(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const opId = url.searchParams.get("operation_id");
  const limit = Math.min(Number(url.searchParams.get("limit") || 300), 500);
  const filt = opId ? `operation_id=eq.${opId}&` : "";
  const r = await sb(`/invoices?${filt}select=*,operations(operation_code),clients(first_name,last_name,client_code)&order=created_at.desc&limit=${limit}`);
  if (r.status >= 400) return Response.json({ error: JSON.stringify(r.body || "").slice(0, 200) }, { status: 500 });
  return Response.json({ facturas: Array.isArray(r.body) ? r.body : [], configured: arcaReady(), omitidas: await omitidas() });
}

const pad = (n, l) => String(n ?? 0).padStart(l, "0");

async function notaCredito(body) {
  const id = String(body.invoice_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Factura inválida" }, { status: 400 });
  const r0 = await sb(`/invoices?id=eq.${id}&select=*&limit=1`);
  const fc = Array.isArray(r0.body) ? r0.body[0] : null;
  if (!fc || fc.status !== "emitida" || !fc.numero) return Response.json({ error: "La factura no está emitida" }, { status: 409 });
  if (Number(fc.tipo_cbte || 11) === 13) return Response.json({ error: "Eso ya es una nota de crédito" }, { status: 409 });
  const total = Math.round(Number(fc.importe) * 100) / 100;
  const importe = body.importe != null && body.importe !== "" ? Math.round(Number(body.importe) * 100) / 100 : total;
  if (!(importe > 0) || importe > total + 0.005) return Response.json({ error: `El importe tiene que ser mayor a 0 y hasta $ ${total.toFixed(2)}` }, { status: 400 });
  const motivo = String(body.motivo || "").trim().slice(0, 300);
  const cfg = await arcaConfig();
  const env = cfg?.environment === "produccion" ? "produccion" : "homologacion";
  if (fc.environment && fc.environment !== env) return Response.json({ error: `La factura es de ${fc.environment} y ARCA está en ${env}` }, { status: 409 });
  const fecha = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const nroFc = `${pad(fc.punto_venta, 5)}-${pad(fc.numero, 8)}`;
  const detalle = `Nota de crédito ${importe < total ? "parcial " : ""}por Factura C ${nroFc}${motivo ? ` · ${motivo}` : ""}`.slice(0, 500);
  const base = {
    operation_id: fc.operation_id || null, client_id: fc.client_id || null, environment: env, punto_venta: Number(cfg?.punto_venta || 1),
    fecha, doc_tipo: fc.doc_tipo, doc_nro: fc.doc_nro || null, receptor_nombre: fc.receptor_nombre, receptor_domicilio: fc.receptor_domicilio,
    receptor_cond_iva: fc.receptor_cond_iva, detalle, importe, tipo_cbte: 13, items: [{ label: detalle, usd: 0, ars: importe }], tc: fc.tc || null, status: "pendiente",
  };
  let ins = await sb(`/invoices`, { method: "POST", body: JSON.stringify({ ...base, anula_id: fc.id }) });
  if (ins.status >= 400 && /anula_id/.test(JSON.stringify(ins.body || ""))) ins = await sb(`/invoices`, { method: "POST", body: JSON.stringify(base) });
  const nc = Array.isArray(ins.body) ? ins.body[0] : null;
  if (!nc?.id) return Response.json({ error: `No se pudo registrar la nota de crédito: ${JSON.stringify(ins.body || "").slice(0, 200)}` }, { status: 500 });
  try {
    const r = await emitirFacturaC({ tipo: 13, docTipo: fc.doc_tipo, docNro: fc.doc_tipo === 99 ? 0 : fc.doc_nro, condIvaReceptor: fc.receptor_cond_iva, importe, fecha, asociado: { tipo: Number(fc.tipo_cbte || 11), ptoVta: fc.punto_venta, nro: fc.numero, fecha: fc.fecha } }, env);
    await sb(`/invoices?id=eq.${nc.id}`, { method: "PATCH", body: JSON.stringify({ numero: r.numero, cae: r.cae, cae_vto: r.caeVto, status: "emitida" }) });
    return Response.json({ ok: true, id: nc.id, numero: r.numero, cae: r.cae, public_token: nc.public_token, importe });
  } catch (e) {
    await sb(`/invoices?id=eq.${nc.id}`, { method: "PATCH", body: JSON.stringify({ status: "error", error_detalle: String(e.message).slice(0, 500) }) });
    return Response.json({ error: String(e.message) }, { status: 502 });
  }
}

export async function POST(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body = null; try { body = await req.json(); } catch {}
  if (body?.action === "omitir" || body?.action === "reponer") {
    const id = String(body.operation_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Operación inválida" }, { status: 400 });
    const lista = (await omitidas()).filter((x) => x !== id);
    if (body.action === "omitir") lista.unshift(id);
    await guardarOmitidas(lista);
    return Response.json({ ok: true, omitidas: lista });
  }
  if (!arcaReady()) return Response.json({ error: "ARCA sin configurar: faltan ARCA_CUIT / ARCA_CERT / ARCA_KEY en Vercel" }, { status: 500 });
  if (body?.action === "nota_credito") return notaCredito(body);
  const docTipo = Number(body?.doc_tipo);
  const importe = Math.round(Number(body?.importe) * 100) / 100;
  const condIva = Number(body?.receptor_cond_iva);
  if (![80, 96, 99].includes(docTipo)) return Response.json({ error: "doc_tipo inválido (80 CUIT / 96 DNI / 99 consumidor final)" }, { status: 400 });
  if (!(importe > 0)) return Response.json({ error: "Importe inválido" }, { status: 400 });
  if (!condIva) return Response.json({ error: "Falta la condición IVA del receptor" }, { status: 400 });
  const docNro = String(body.doc_nro || "").replace(/\D/g, "");
  if (docTipo !== 99 && docNro.length < 7) return Response.json({ error: "Documento del receptor inválido" }, { status: 400 });

  const cfg = await arcaConfig();
  const env = cfg?.environment === "produccion" ? "produccion" : "homologacion";
  const fecha = body.fecha && /^\d{4}-\d{2}-\d{2}$/.test(body.fecha) ? body.fecha : new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

  // Se guarda primero como pendiente: si ARCA aprueba y el guardado fallara, el
  // comprobante no queda huérfano sin registro local.
  const ins = await sb(`/invoices`, {
    method: "POST",
    body: JSON.stringify({
      operation_id: body.operation_id || null,
      client_id: body.client_id || null,
      environment: env,
      punto_venta: Number(cfg?.punto_venta || 1),
      fecha,
      doc_tipo: docTipo,
      doc_nro: docTipo === 99 ? null : docNro,
      receptor_nombre: String(body.receptor_nombre || "").slice(0, 200) || (docTipo === 99 ? "Consumidor Final" : null),
      receptor_domicilio: String(body.receptor_domicilio || "").slice(0, 300) || null,
      receptor_cond_iva: condIva,
      detalle: String(body.detalle || "Servicios logísticos").slice(0, 500),
      importe,
      // Conceptos con su USD y el TC aplicado — solo presentación del PDF (el total fiscal es importe).
      items: Array.isArray(body.items) && body.items.length > 0 ? body.items.slice(0, 12).map((i) => ({ label: String(i.label || "").slice(0, 120), usd: Number(i.usd) || 0, ars: Number(i.ars) || 0 })) : null,
      tc: Number(body.tc) > 0 ? Number(body.tc) : null,
      status: "pendiente",
    }),
  });
  const inv = Array.isArray(ins.body) ? ins.body[0] : null;
  if (!inv?.id) return Response.json({ error: "No se pudo registrar la factura" }, { status: 500 });

  try {
    const r = await emitirFacturaC({ docTipo, docNro: docTipo === 99 ? 0 : docNro, condIvaReceptor: condIva, importe, fecha }, env);
    await sb(`/invoices?id=eq.${inv.id}`, { method: "PATCH", body: JSON.stringify({ numero: r.numero, cae: r.cae, cae_vto: r.caeVto, status: "emitida" }) });
    return Response.json({ ok: true, id: inv.id, numero: r.numero, cae: r.cae, cae_vto: r.caeVto, environment: env, public_token: inv.public_token });
  } catch (e) {
    await sb(`/invoices?id=eq.${inv.id}`, { method: "PATCH", body: JSON.stringify({ status: "error", error_detalle: String(e.message).slice(0, 500) }) });
    return Response.json({ error: String(e.message) }, { status: 502 });
  }
}
