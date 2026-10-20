// POST /api/portal/eliminar-importacion
// Body: { operation_id, client_id? }
//
// El cliente armó una importación desde su depósito y se equivocó (dejó un bulto afuera, mezcló
// bultos). Mientras no cargó la mercadería puede deshacerla: los bultos vuelven al depósito
// (operation_id null) y la operación se borra. Va con service role porque el cliente no puede
// borrar en `operations` (RLS). Pedido de Bautista del 18/10/2026 (AC-0294/AC-0295 de GABSAN).
//
// Solo se permite si la op es del cliente, está en depósito o preparación, no tiene mercadería
// cargada, no tiene presupuesto, no está en un vuelo y no confirmó documentación.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const UUID = /^[0-9a-f-]{36}$/i;

async function svc(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, { ...opts, headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const txt = await r.text(); let data = null; try { data = JSON.parse(txt); } catch { data = txt; }
  return { ok: r.ok, data, status: r.status };
}

export async function POST(req) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return Response.json({ error: "no_auth" }, { status: 401 });
  let body = {}; try { body = await req.json(); } catch {}
  const opId = String(body.operation_id || "");
  if (!UUID.test(opId)) return Response.json({ error: "op_invalida" }, { status: 400 });

  const user = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!user?.id) return Response.json({ error: "no_auth" }, { status: 401 });
  const [cl, prof] = await Promise.all([
    svc(`/rest/v1/clients?auth_user_id=eq.${user.id}&select=id&limit=1`),
    svc(`/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`),
  ]);
  const ownClientId = Array.isArray(cl.data) && cl.data[0]?.id;
  const isAdmin = Array.isArray(prof.data) && ["admin", "empleado"].includes(prof.data[0]?.role);
  let clientId = ownClientId || null;
  if (body.client_id && (isAdmin || body.client_id === ownClientId)) clientId = body.client_id;
  if (!clientId) return Response.json({ error: "sin_cliente" }, { status: 403 });

  const o = await svc(`/rest/v1/operations?id=eq.${opId}&client_id=eq.${clientId}&select=id,operation_code,status,budget_total,docs_confirmed_at,service_type,channel&limit=1`);
  const op = Array.isArray(o.data) ? o.data[0] : null;
  if (!op) return Response.json({ error: "op_no_encontrada" }, { status: 404 });
  if (!["en_deposito_origen", "en_preparacion"].includes(op.status) || op.docs_confirmed_at || Number(op.budget_total || 0) > 0 || op.service_type === "gestion_integral")
    return Response.json({ error: "no_se_puede", motivo: "etapa" }, { status: 409 });
  const [items, flights] = await Promise.all([
    svc(`/rest/v1/operation_items?operation_id=eq.${opId}&select=id&limit=1`),
    svc(`/rest/v1/flight_operations?operation_id=eq.${opId}&select=flight_id&limit=1`),
  ]);
  if (Array.isArray(items.data) && items.data.length) return Response.json({ error: "no_se_puede", motivo: "mercaderia" }, { status: 409 });
  if (Array.isArray(flights.data) && flights.data.length) return Response.json({ error: "no_se_puede", motivo: "vuelo" }, { status: 409 });

  // 1) Los bultos vuelven al depósito del cliente (quedan con su client_id, sin operación).
  const pk = await svc(`/rest/v1/operation_packages?operation_id=eq.${opId}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ operation_id: null }) });
  if (!pk.ok) return Response.json({ error: "no_se_soltaron_bultos", detail: pk.data }, { status: 500 });
  const n = Array.isArray(pk.data) ? pk.data.length : 0;
  // 2) La operación se borra. La RPC eliminar_operacion exige rol admin y el service role no lo es
  //    ("Solo el equipo puede eliminar operaciones"): soltaba los bultos y dejaba la op viva
  //    (AC-0298, 20/10/2026). Como acá la op está vacía por definición (sin mercadería, sin vuelo,
  //    sin presupuesto), alcanza con limpiar sus rastros y borrar la fila.
  for (const t of ["tracking_events", "operation_items", "op_feedback", "deposit_claims", "repack_requests"]) {
    await svc(`/rest/v1/${t}?operation_id=eq.${opId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  }
  await svc(`/rest/v1/quotes?operation_id=eq.${opId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ operation_id: null }) });
  const del = await svc(`/rest/v1/operations?id=eq.${opId}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
  if (!del.ok || !Array.isArray(del.data) || del.data.length === 0) return Response.json({ error: "no_se_borro", detail: del.data, bultos_sueltos: n }, { status: 500 });
  return Response.json({ ok: true, code: op.operation_code, bultos: n });
}
