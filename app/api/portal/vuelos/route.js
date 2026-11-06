// GET /api/portal/vuelos?client_id=
// Vuelo de cada importación aérea del cliente logueado (05/11/2026). El cliente no puede leer la
// tabla flights (RLS: admin, empleado y agente), y el portal necesita saber si el vuelo ya está
// listo para despachar (factura presentada) o despachado y pendiente de recolección para mostrar
// la operación EN TRÁNSITO en vez de "Documentación" mientras la base la sigue teniendo en
// "en_preparacion". También dice si la op ya está en un vuelo (la mercadería deja de editarse).
//
// Whitelist estricta: estado y fechas del vuelo. Nunca costos, agente ni tracking.
// El cliente sale del JWT; client_id en la URL solo vale para el admin (vista previa del portal).
import { quienLlama } from "../../../../lib/auth-server";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const idOk = (v) => !!v && /^[0-9a-f-]{36}$/i.test(v);

export async function GET(req) {
  const q = await quienLlama(req);
  if (!q) return Response.json({ vuelos: {} }, { status: 401 });
  const pedido = new URL(req.url).searchParams.get("client_id");
  const clientId = idOk(pedido) && (q.role === "admin" || pedido === q.clientId) ? pedido : q.clientId;
  if (!clientId) return Response.json({ vuelos: {} });

  const key = process.env.SUPABASE_SERVICE_ROLE;
  const sel = "operation_id,flights(status,invoice_presented_at,dispatched_at,carrier_pickup_at),operations!inner(client_id,status)";
  const r = await fetch(`${SB_URL}/rest/v1/flight_operations?select=${sel}&operations.client_id=eq.${clientId}&operations.status=in.(en_deposito_origen,en_preparacion,en_transito)`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }).catch(() => null);
  const rows = r && r.ok ? await r.json().catch(() => []) : [];
  const vuelos = {};
  (Array.isArray(rows) ? rows : []).forEach((fo) => {
    const f = fo.flights;
    if (!fo.operation_id || !f) return;
    vuelos[fo.operation_id] = { status: f.status || null, invoice_presented_at: f.invoice_presented_at || null, dispatched_at: f.dispatched_at || null, carrier_pickup_at: f.carrier_pickup_at || null };
  });
  return Response.json({ vuelos });
}
