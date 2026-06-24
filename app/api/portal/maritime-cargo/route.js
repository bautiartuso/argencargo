// GET /api/portal/maritime-cargo
// Cargas marítimas del cliente logueado que YA están asignadas a un contenedor
// pero TODAVÍA no se convirtieron en operación. Le permite al cliente ver su carga
// "en camino" antes de que exista la op.
//
// Whitelist estricta. Expone SOLO: descripción, estado, cantidad de bultos,
// ETA puerto Buenos Aires y entrega estimada (ETA + 2 semanas).
// NUNCA expone: número/código de contenedor, naviera, tracking, costos,
// ni datos de otros clientes (se resuelve el cliente desde el JWT, no del request).

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

async function svc(path) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  return r.ok ? r.json() : null;
}

const plus14 = (d) => {
  if (!d) return null;
  const x = new Date(d + "T12:00:00");
  x.setDate(x.getDate() + 14);
  return x.toISOString().slice(0, 10);
};

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const tok = auth.replace(/^Bearer\s+/i, "").trim();
  if (!tok) return Response.json({ cargo: [] }, { status: 401 });

  // Verificar el JWT del cliente → user id (no confiamos en ningún client_id del request).
  const user = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` },
  }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!user?.id) return Response.json({ cargo: [] }, { status: 401 });

  // Resolver el cliente a partir del usuario autenticado.
  const cl = await svc(`/rest/v1/clients?auth_user_id=eq.${user.id}&select=id&limit=1`);
  const clientId = Array.isArray(cl) && cl[0]?.id;
  if (!clientId) return Response.json({ cargo: [] });

  // Cargas del cliente que están en un contenedor y todavía no son operación.
  const ships = await svc(`/rest/v1/maritime_shipments?client_id=eq.${clientId}&operation_id=is.null&container_id=not.is.null&select=id,product_description,status,container_id&order=created_at.desc`);
  const list = Array.isArray(ships) ? ships : [];
  if (list.length === 0) return Response.json({ cargo: [] });

  // Contenedores (solo eta + status — NUNCA code ni shipping_line).
  const contIds = [...new Set(list.map(s => s.container_id).filter(Boolean))];
  const conts = contIds.length ? await svc(`/rest/v1/maritime_containers?id=in.(${contIds.join(",")})&select=id,eta,status`) : [];
  const contMap = {};
  (Array.isArray(conts) ? conts : []).forEach(c => { contMap[c.id] = c; });

  // Bultos por carga.
  const shipIds = list.map(s => s.id);
  const pkgs = await svc(`/rest/v1/maritime_packages?shipment_id=in.(${shipIds.join(",")})&select=shipment_id,quantity`);
  const bultos = {};
  (Array.isArray(pkgs) ? pkgs : []).forEach(p => { bultos[p.shipment_id] = (bultos[p.shipment_id] || 0) + Number(p.quantity || 1); });

  const cargo = list.map(s => {
    const c = contMap[s.container_id] || {};
    return {
      id: s.id,
      description: s.product_description || null,
      shipment_status: s.status || null,        // proveedor | en_deposito | en_camino_ar
      container_status: c.status || null,        // en_transito | arribado
      bultos: bultos[s.id] || 0,
      eta_puerto: c.eta || null,
      entrega_estimada: plus14(c.eta),
    };
  });

  return Response.json({ cargo });
}
