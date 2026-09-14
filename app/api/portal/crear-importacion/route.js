// POST /api/portal/crear-importacion
// Body: { package_ids: [uuid], client_id? }
//
// El cliente elige bultos de su depósito (operation_packages sin operation_id) y arma con ellos
// una importación aérea. Va por acá con service role porque el cliente no puede insertar en
// `operations` (RLS): el cliente se resuelve del JWT, los bultos se validan como suyos y sin
// operación, y todo queda atado a la op nueva en un solo paso.
//
// La op nace en `en_preparacion` con la consolidación confirmada: el cliente acaba de decir
// qué bultos viajan juntos, así que no hay nada que confirmar después. Lo que sigue es cargar
// la mercadería (documentación).

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

async function svc(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const txt = await r.text();
  let data = null; try { data = JSON.parse(txt); } catch {}
  return { ok: r.ok, data, status: r.status };
}

export async function POST(req) {
  const auth = req.headers.get("authorization") || "";
  const tok = auth.replace(/^Bearer\s+/i, "").trim();
  if (!tok) return Response.json({ error: "no_auth" }, { status: 401 });
  let body = {}; try { body = await req.json(); } catch {}
  const ids = Array.isArray(body.package_ids) ? body.package_ids.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) : [];
  if (ids.length === 0) return Response.json({ error: "sin_bultos" }, { status: 400 });

  const user = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!user?.id) return Response.json({ error: "no_auth" }, { status: 401 });

  const [cl, prof] = await Promise.all([
    svc(`/rest/v1/clients?auth_user_id=eq.${user.id}&select=id&limit=1`),
    svc(`/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`),
  ]);
  const ownClientId = Array.isArray(cl.data) && cl.data[0]?.id;
  const isAdmin = Array.isArray(prof.data) && ["admin", "empleado"].includes(prof.data[0]?.role);
  // Un admin en modo preview del portal puede armar la importación por el cliente.
  let clientId = ownClientId || null;
  if (body.client_id && (isAdmin || body.client_id === ownClientId)) clientId = body.client_id;
  if (!clientId) return Response.json({ error: "sin_cliente" }, { status: 403 });

  // Los bultos tienen que ser del cliente y estar sin operación.
  const pk = await svc(`/rest/v1/operation_packages?id=in.(${ids.join(",")})&client_id=eq.${clientId}&operation_id=is.null&select=id,origin,registered_by_agent_id,created_at&order=created_at.asc`);
  const pkgs = Array.isArray(pk.data) ? pk.data : [];
  if (pkgs.length !== ids.length) return Response.json({ error: "bultos_invalidos", encontrados: pkgs.length }, { status: 409 });

  const rpc = await svc(`/rest/v1/rpc/next_operation_code`, { method: "POST", body: "{}" });
  const code = typeof rpc.data === "string" ? rpc.data : null;
  if (!code) return Response.json({ error: "sin_codigo" }, { status: 500 });

  // Origen: el de los bultos (si son mixtos, el más frecuente). Agente: el que registró el primero,
  // así el agente sigue viendo la op para armar el vuelo (su RLS es por created_by_agent_id).
  const cnt = {}; pkgs.forEach((p) => { const o = p.origin || "China"; cnt[o] = (cnt[o] || 0) + 1; });
  const origin = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || "China";
  const agentId = pkgs.find((p) => p.registered_by_agent_id)?.registered_by_agent_id || null;
  const now = new Date().toISOString();
  const opBody = {
    operation_code: code, client_id: clientId, channel: "aereo_blanco", status: "en_preparacion", origin,
    service_type: "courier", consolidation_confirmed: true, consolidation_confirmed_at: now, created_by_agent_id: agentId,
  };
  const ins = await svc(`/rest/v1/operations`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(opBody) });
  const op = Array.isArray(ins.data) ? ins.data[0] : ins.data;
  if (!op?.id) return Response.json({ error: "no_se_creo", detail: ins.data }, { status: 500 });

  // Atar los bultos a la op, renumerados 1..n en orden de llegada.
  for (let i = 0; i < pkgs.length; i++) {
    await svc(`/rest/v1/operation_packages?id=eq.${pkgs[i].id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ operation_id: op.id, package_number: i + 1 }) });
  }
  await svc(`/rest/v1/tracking_events`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
    operation_id: op.id, title: `Importación creada por el cliente con ${pkgs.length} bulto${pkgs.length !== 1 ? "s" : ""}`, occurred_at: now, source: "internal", status_code: "en_preparacion", is_visible_to_client: true,
  }) });
  return Response.json({ ok: true, op });
}
