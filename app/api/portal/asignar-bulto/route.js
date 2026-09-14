// POST /api/portal/asignar-bulto
// Body: { item_id, package_ids: [uuid] | [], client_id? }
//
// El cliente marca en qué bulto viaja cada producto. Solo afecta cómo se prorratea el flete en
// "Costo por producto" (no toca precios, NCM ni presupuesto), así que se permite en cualquier
// etapa de la importación. Va con service role porque la RLS del cliente sobre operation_items
// solo deja actualizar mientras la op está en depósito o preparación.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const UUID = /^[0-9a-f-]{36}$/i;

async function svc(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, { ...opts, headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const txt = await r.text(); let data = null; try { data = JSON.parse(txt); } catch {}
  return { ok: r.ok, data };
}

export async function POST(req) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return Response.json({ error: "no_auth" }, { status: 401 });
  let body = {}; try { body = await req.json(); } catch {}
  const itemId = String(body.item_id || "");
  if (!UUID.test(itemId)) return Response.json({ error: "item_invalido" }, { status: 400 });
  const pkgIds = (Array.isArray(body.package_ids) ? body.package_ids : []).map(String).filter((x) => UUID.test(x));

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

  // El ítem tiene que ser de una op del cliente, y los bultos de esa misma op.
  const it = await svc(`/rest/v1/operation_items?id=eq.${itemId}&select=id,operation_id,operations!inner(client_id)&operations.client_id=eq.${clientId}&limit=1`);
  const item = Array.isArray(it.data) ? it.data[0] : null;
  if (!item) return Response.json({ error: "item_no_encontrado" }, { status: 404 });
  if (pkgIds.length) {
    const pk = await svc(`/rest/v1/operation_packages?id=in.(${pkgIds.join(",")})&operation_id=eq.${item.operation_id}&select=id`);
    if (!Array.isArray(pk.data) || pk.data.length !== pkgIds.length) return Response.json({ error: "bultos_invalidos" }, { status: 409 });
  }
  const up = await svc(`/rest/v1/operation_items?id=eq.${itemId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ package_ids: pkgIds.length ? pkgIds : null }) });
  if (!up.ok) return Response.json({ error: "no_se_guardo", detail: up.data }, { status: 500 });
  return Response.json({ ok: true, package_ids: pkgIds });
}
