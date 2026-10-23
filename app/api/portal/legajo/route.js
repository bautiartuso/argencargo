// GET /api/portal/legajo?op_id=…  — Legajo de la importación para el cliente (22/10/2026).
// Solo aéreo courier comercial y solo clientes RI: lo ve solo si es RI con entrega directa que paga
// los impuestos (automático) o si Bautista lo marcó a mano (operations.legajo_visible). Monotributo
// y consumidor final nunca. Devuelve solo lo que existe: facturas de Argencargo, factura del courier,
// DSI (links firmados por 1 hora al bucket privado) y los cobros para armar los recibos.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
const UUID = /^[0-9a-f-]{36}$/i;

async function svc(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, { ...opts, headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const txt = await r.text(); let data = null; try { data = JSON.parse(txt); } catch {}
  return { ok: r.ok, data };
}

const visibleParaCliente = (op, taxCondition) => {
  if (op?.channel !== "aereo_blanco" || op?.service_type === "gestion_integral") return false;
  if (taxCondition !== "responsable_inscripto") return false;
  if (op.legajo_visible === true || op.legajo_visible === false) return op.legajo_visible;
  return op.ri_entrega_directa !== false && !op.ri_argencargo_collects_taxes;
};

export async function GET(req) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return Response.json({ error: "no_auth" }, { status: 401 });
  const opId = new URL(req.url).searchParams.get("op_id") || "";
  if (!UUID.test(opId)) return Response.json({ error: "op_invalida" }, { status: 400 });
  const user = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!user?.id) return Response.json({ error: "no_auth" }, { status: 401 });
  const [cl, prof] = await Promise.all([
    svc(`/rest/v1/clients?auth_user_id=eq.${user.id}&select=id&limit=1`),
    svc(`/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`),
  ]);
  const ownClientId = Array.isArray(cl.data) && cl.data[0]?.id;
  const isStaff = Array.isArray(prof.data) && ["admin", "empleado"].includes(prof.data[0]?.role);
  const o = await svc(`/rest/v1/operations?id=eq.${opId}&select=*,clients(id,tax_condition,first_name,last_name,company_name,cuit,dni,client_code)&limit=1`);
  const op = Array.isArray(o.data) ? o.data[0] : null;
  if (!op || (!isStaff && op.client_id !== ownClientId)) return Response.json({ error: "no_encontrada" }, { status: 404 });
  if (!visibleParaCliente(op, op.clients?.tax_condition)) return Response.json({ visible: false });

  const [docsR, facR, pagR, stR] = await Promise.all([
    svc(`/rest/v1/legajo_docs?operation_id=eq.${opId}&borrado_at=is.null&storage_path=not.is.null&select=tipo,storage_path,file_name,uploaded_at`),
    svc(`/rest/v1/invoices?operation_id=eq.${opId}&status=eq.emitida&select=tipo_cbte,punto_venta,numero,fecha,public_token&order=created_at.asc`),
    svc(`/rest/v1/operation_client_payments?operation_id=eq.${opId}&select=*&order=payment_date.asc`),
    svc(`/rest/v1/gi_settings?select=receipt_issuer_name,receipt_issuer_doc,office_locality,office_address&limit=1`),
  ]);
  const docs = [];
  for (const d of Array.isArray(docsR.data) ? docsR.data : []) {
    const s = await svc(`/storage/v1/object/sign/legajos/${d.storage_path}`, { method: "POST", body: JSON.stringify({ expiresIn: 3600 }) });
    if (s.ok && s.data?.signedURL) docs.push({ tipo: d.tipo, file_name: d.file_name, fecha: d.uploaded_at, url: `${SB_URL}/storage/v1${s.data.signedURL}` });
  }
  // Recibos numerados: si un cobro todavía no tiene número, se le asigna (misma secuencia que el admin).
  const pagos = Array.isArray(pagR.data) ? pagR.data : [];
  for (const p of pagos) {
    if (p.receipt_number) continue;
    const n = await svc(`/rest/v1/rpc/next_receipt_number`, { method: "POST", body: JSON.stringify({ p_payment_id: p.id }) });
    if (n.ok && n.data != null) p.receipt_number = Number(n.data) || null;
  }
  const { clients, ...opSafe } = op;
  return Response.json({
    visible: true,
    facturas: (Array.isArray(facR.data) ? facR.data : []).map((f) => ({ tipo: f.tipo_cbte === 13 ? "Nota de crédito C" : "Factura C", numero: `${String(f.punto_venta).padStart(4, "0")}-${String(f.numero).padStart(8, "0")}`, fecha: f.fecha, url: `${BASE_URL}/factura/${f.public_token}` })),
    docs,
    pagos,
    cliente: clients,
    op: { id: opSafe.id, operation_code: opSafe.operation_code, budget_total: opSafe.budget_total, debt_applied_usd: opSafe.debt_applied_usd, total_anticipos: opSafe.total_anticipos, credit_applied_usd: opSafe.credit_applied_usd, discount_applied_usd: opSafe.discount_applied_usd, description: opSafe.description, channel: opSafe.channel },
    settings: Array.isArray(stR.data) && stR.data[0] ? stR.data[0] : {},
  });
}
