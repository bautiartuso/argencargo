// Legajo del lado del servidor (22/10/2026): lo usan /api/portal/legajo (la lista) y
// /api/portal/legajo/pdf (los PDF). Todo en paralelo: la sesión del cliente se valida al mismo tiempo
// que se traen los datos con service role, y lo que no corresponde se descarta antes de responder.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
export const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
import { firmaLink } from "./auth-server.js";
const UUID = /^[0-9a-f-]{36}$/i;

export async function svc(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, { ...opts, headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const txt = await r.text(); let data = null; try { data = JSON.parse(txt); } catch {}
  return { ok: r.ok, data };
}
const lista = (r) => (Array.isArray(r?.data) ? r.data : []);

// Solo aéreo courier comercial. RI ("completo"): automático si es entrega directa que paga los
// impuestos, o lo que Bautista haya marcado a mano (operations.legajo_visible). Monotributo y
// consumidor final ("basico", 23/10/2026): siempre, pero solo la guía aérea y los recibos de pago.
const visibleParaCliente = (op, taxCondition) => {
  if (op?.channel !== "aereo_blanco" || op?.service_type === "gestion_integral") return false;
  if (taxCondition !== "responsable_inscripto") return "basico";
  if (op.legajo_visible === true || op.legajo_visible === false) return op.legajo_visible ? "completo" : false;
  return op.ri_entrega_directa !== false && !op.ri_argencargo_collects_taxes ? "completo" : false;
};
const TIPOS_BASICO = ["guia_aerea"];
// Internos: nunca van al cliente (la factura comercial del courier lleva el valor declarado).
const TIPOS_INTERNOS = ["factura_comercial"];

export const nombreArchivo = (s) => String(s || "documento").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");

// Devuelve { error, status } o { visible:false } o el legajo completo con links firmados.
export async function cargarLegajo(req, opId) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim() || "";
  if (!tok) return { error: "no_auth", status: 401 };
  if (!UUID.test(opId || "")) return { error: "op_invalida", status: 400 };
  const userP = fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [user, o, docsR, facR, pagR, stR] = await Promise.all([
    userP,
    svc(`/rest/v1/operations?id=eq.${opId}&select=*,clients(id,auth_user_id,tax_condition,first_name,last_name,company_name,cuit,dni,client_code)&limit=1`),
    svc(`/rest/v1/legajo_docs?operation_id=eq.${opId}&borrado_at=is.null&storage_path=not.is.null&select=tipo,storage_path,file_name,uploaded_at&order=uploaded_at.desc`),
    svc(`/rest/v1/invoices?operation_id=eq.${opId}&status=eq.emitida&select=tipo_cbte,punto_venta,numero,fecha,public_token&order=created_at.asc`),
    svc(`/rest/v1/operation_client_payments?operation_id=eq.${opId}&select=*&order=payment_date.asc`),
    svc(`/rest/v1/gi_settings?select=receipt_issuer_name,receipt_issuer_doc,office_locality,office_address&limit=1`),
  ]);
  if (!user?.id) return { error: "no_auth", status: 401 };
  const op = lista(o)[0];
  if (!op) return { error: "no_encontrada", status: 404 };
  if (op.clients?.auth_user_id !== user.id) {
    const prof = await svc(`/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`);
    if (!["admin", "empleado"].includes(lista(prof)[0]?.role)) return { error: "no_encontrada", status: 404 };
  }
  const nivel = visibleParaCliente(op, op.clients?.tax_condition);
  if (!nivel) return { visible: false };

  // Un documento por tipo (el más nuevo). Links firmados en una sola llamada, con "Ver" y "Descargar".
  const docsRaw = [];
  for (const d of lista(docsR)) if (!TIPOS_INTERNOS.includes(d.tipo) && (nivel === "completo" || TIPOS_BASICO.includes(d.tipo)) && !docsRaw.some((x) => x.tipo === d.tipo)) docsRaw.push(d);
  const pagos = lista(pagR);
  const sinNumero = pagos.filter((p) => !p.receipt_number);
  const [firmas] = await Promise.all([
    docsRaw.length ? svc(`/storage/v1/object/sign/legajos`, { method: "POST", body: JSON.stringify({ expiresIn: 3600, paths: docsRaw.map((d) => d.storage_path) }) }) : Promise.resolve({ data: [] }),
    // Recibos numerados: si un cobro todavía no tiene número, se le asigna (misma secuencia que el admin).
    ...sinNumero.map((p) => svc(`/rest/v1/rpc/next_receipt_number`, { method: "POST", body: JSON.stringify({ p_payment_id: p.id }) }).then((n) => { if (n.ok && n.data != null) p.receipt_number = Number(n.data) || null; })),
  ]);
  const code = op.operation_code;
  // Monotributo y consumidor final (27/10/2026): no ven la DSI del courier (va a nombre de quien
  // salió la guía y trae la carga de otros) sino la destinación simplificada de Argencargo, con solo
  // su mercadería. Link firmado a /api/portal/dsi, que la arma en el momento.
  const dsiCourier = lista(docsR).find((d) => d.tipo === "dsi");
  const dsiAc = nivel === "basico" && dsiCourier ? (() => {
    const url = `${BASE_URL}/api/portal/dsi?op_id=${opId}&s=${firmaLink(`dsi:${opId}`)}`;
    return { tipo: "dsi_ac", file_name: `Destinacion simplificada ${code}.pdf`, fecha: dsiCourier.uploaded_at, storage_path: null, ext: "pdf", url: `${url}&ver=1`, descarga: url };
  })() : null;
  const docs = docsRaw.map((d) => {
    const f = lista(firmas).find((x) => x.path === d.storage_path);
    if (!f?.signedURL) return null;
    const url = `${SB_URL}/storage/v1${f.signedURL}`;
    const ext = (d.storage_path.split(".").pop() || "pdf").toLowerCase();
    const nombre = nombreArchivo(`${({ dsi: "DSI", factura_courier: "Factura courier", guia_aerea: "Guia aerea" })[d.tipo] || "Documento"} ${code}.${ext}`);
    return { tipo: d.tipo, file_name: d.file_name, fecha: d.uploaded_at, storage_path: d.storage_path, ext, url, descarga: `${url}&download=${encodeURIComponent(nombre)}` };
  }).filter(Boolean);
  if (dsiAc) docs.push(dsiAc);

  const { clients, ...opSafe } = op;
  const { auth_user_id, ...cliente } = clients || {};
  return {
    visible: true,
    nivel,
    facturas: (nivel === "completo" ? lista(facR) : []).map((f) => ({ tipo: f.tipo_cbte === 13 ? "Nota de crédito C" : "Factura C", numero: `${String(f.punto_venta).padStart(4, "0")}-${String(f.numero).padStart(8, "0")}`, fecha: f.fecha, token: f.public_token, url: `${BASE_URL}/factura/${f.public_token}` })),
    docs,
    pagos,
    cliente,
    op: { id: opSafe.id, operation_code: code, budget_total: opSafe.budget_total, debt_applied_usd: opSafe.debt_applied_usd, total_anticipos: opSafe.total_anticipos, credit_applied_usd: opSafe.credit_applied_usd, discount_applied_usd: opSafe.discount_applied_usd, description: opSafe.description, channel: opSafe.channel },
    settings: lista(stR)[0] || {},
  };
}

// Lo que queda por pagar después de cada recibo (para el renglón "Saldo de la operación").
export function saldoLegajo(l) {
  const op = l.op || {};
  const pagado = (l.pagos || []).reduce((a, p) => a + Number(p.amount_usd || 0), 0);
  return Math.round(Math.max(0, Number(op.budget_total || 0) + Number(op.debt_applied_usd || 0) - Number(op.total_anticipos || 0) - Number(op.credit_applied_usd || 0) - Number(op.discount_applied_usd || 0) - pagado) * 100) / 100;
}
