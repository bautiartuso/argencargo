// GET  /api/facturas?operation_id=… | ?limit=…  → facturas emitidas (admin)
// POST /api/facturas → emite una Factura C vía ARCA y la guarda (admin)
//   body: { operation_id?, client_id?, doc_tipo (80 CUIT/96 DNI/99 CF), doc_nro,
//           receptor_nombre, receptor_domicilio, receptor_cond_iva, importe (ARS),
//           detalle, fecha? (default hoy AR) }
//
// El flujo es de una sola vía: se llama a ARCA únicamente acá, al emitir.

import { arcaReady, arcaConfig, emitirFacturaC } from "../../../lib/arca";

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
    const payload = JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64").toString());
    const p = await sb(`/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p.body) && p.body[0]?.role === "admin";
  } catch { return false; }
}

export async function GET(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const opId = url.searchParams.get("operation_id");
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
  const filt = opId ? `operation_id=eq.${opId}&` : "";
  const r = await sb(`/invoices?${filt}select=*,operations(operation_code),clients(first_name,last_name,client_code)&order=created_at.desc&limit=${limit}`);
  return Response.json({ facturas: Array.isArray(r.body) ? r.body : [], configured: arcaReady() });
}

export async function POST(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!arcaReady()) return Response.json({ error: "ARCA sin configurar: faltan ARCA_CUIT / ARCA_CERT / ARCA_KEY en Vercel" }, { status: 500 });
  let body = null; try { body = await req.json(); } catch {}
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
