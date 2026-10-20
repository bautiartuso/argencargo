// POST /api/admin/clientes {action:"eliminar", client_id, forzar?} → borra un cliente de la base.
//
// Un cliente con operaciones NO se borra (las ops son historia contable): la respuesta dice cuántas
// tiene y el admin lo desactiva en vez de borrarlo. Sin ops, se limpian primero sus dependencias
// (cotizaciones, cuenta corriente, puntos, bultos sueltos, seguimiento) y después la fila y su
// usuario de login. Antes el botón hacía un DELETE directo que la base rechazaba en silencio y el
// cliente "volvía" al recargar (19/10/2026).

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const txt = await r.text();
  let body = null; try { body = JSON.parse(txt); } catch { body = txt; }
  return { ok: r.ok, status: r.status, body };
}

async function isAdmin(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64").toString());
    const p = await sb(`/rest/v1/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p.body) && p.body[0]?.role === "admin";
  } catch { return false; }
}

// Tablas que cuelgan del cliente y se limpian antes de borrarlo. Las que no existan se saltean.
const DEPENDIENTES = [
  "client_followups", "quotes", "client_account_movements", "points_transactions", "client_reward_redemptions",
  "tier_rewards", "client_tariff_overrides", "deposit_claims", "forward_requests", "gi_quote_requests", "notifications",
];

export async function POST(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body = null; try { body = await req.json(); } catch {}
  if (body?.action !== "eliminar") return Response.json({ error: "acción desconocida" }, { status: 400 });
  const id = String(body.client_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Cliente inválido" }, { status: 400 });

  const cl = await sb(`/rest/v1/clients?id=eq.${id}&select=id,client_code,first_name,last_name,auth_user_id`);
  const c = Array.isArray(cl.body) ? cl.body[0] : null;
  if (!c) return Response.json({ error: "No encontramos ese cliente" }, { status: 404 });

  const ops = await sb(`/rest/v1/operations?client_id=eq.${id}&select=id`, { headers: { Prefer: "count=exact" } });
  const nOps = Array.isArray(ops.body) ? ops.body.length : 0;
  if (nOps > 0) return Response.json({ error: `${c.client_code} tiene ${nOps} operación${nOps !== 1 ? "es" : ""} cargada${nOps !== 1 ? "s" : ""}: no se puede borrar. Desactivalo para que no aparezca.`, ops: nOps }, { status: 409 });

  // Bultos en depósito a su nombre: quedan sin cliente (no se pierden del depósito).
  await sb(`/rest/v1/operation_packages?client_id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ client_id: null }) });
  // Referidos: que no apunten a un cliente borrado.
  await sb(`/rest/v1/clients?referred_by_client_id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ referred_by_client_id: null }) });
  const limpiadas = [];
  for (const t of DEPENDIENTES) {
    const r = await sb(`/rest/v1/${t}?client_id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    if (r.ok) limpiadas.push(t);
  }
  const del = await sb(`/rest/v1/clients?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
  if (!del.ok || !Array.isArray(del.body) || del.body.length === 0) {
    const msg = del.body?.message || del.body?.details || "la base no dejó borrarlo";
    return Response.json({ error: `No se pudo borrar ${c.client_code}: ${msg}` }, { status: 409 });
  }
  // Usuario de login del portal (si lo tenía)
  let authBorrado = false;
  if (c.auth_user_id) {
    const r = await sb(`/auth/v1/admin/users/${c.auth_user_id}`, { method: "DELETE" });
    authBorrado = r.ok;
  }
  return Response.json({ ok: true, client_code: c.client_code, limpiadas, auth_borrado: authBorrado });
}
