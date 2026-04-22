// GET/POST /api/points/expire
// Cron mensual: expira puntos viejos (>12 meses) y cancela redemptions pending (>6 meses).
// Protegido con CRON_SECRET.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE || "";

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return null; }
}

async function run(req) {
  const auth = req.headers.get("authorization") || new URL(req.url).searchParams.get("secret") || "";
  const expected = process.env.CRON_SECRET || "";
  const authorized = !expected || auth === `Bearer ${expected}` || auth === expected;
  if (!authorized) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "service role missing" }, { status: 500 });

  const now = new Date().toISOString();

  // 1) Puntos ganados que ya expiraron (earned_at + 12m). Solo los que todavía no tienen transacción de expire.
  // Estrategia: para cada earn con expires_at <= now y sin expire ya creado, insertar expire con -amount,
  // limitado al balance remanente de ese earn (considerando canjes posteriores).
  // Simplificación: expirar TODO earn expirado al 100% (el balance global se puede volver negativo si el cliente ya canjeó más de lo que le quedaba).
  // Para mantenerlo simple y evitar negativos, sólo expiramos lo que aún no se expiró y balance_clients >= amount.

  const expiredEarns = await sb(
    `/rest/v1/points_transactions?select=id,client_id,amount,earned_at,operation_id&type=eq.earn&expires_at=lte.${now}`
  );

  const results = { expired_earns: 0, expired_redemptions: 0, clients_affected: new Set() };

  for (const e of Array.isArray(expiredEarns) ? expiredEarns : []) {
    // Chequear si ya hay un expire para este earn
    const existing = await sb(
      `/rest/v1/points_transactions?select=id&type=eq.expire&description=ilike.*id=${e.id}*&limit=1`
    );
    if (Array.isArray(existing) && existing[0]) continue;

    // Balance actual del cliente
    const cl = await sb(`/rest/v1/clients?id=eq.${e.client_id}&select=points_balance`);
    const bal = Array.isArray(cl) && cl[0] ? Number(cl[0].points_balance || 0) : 0;

    const expireAmt = Math.min(Number(e.amount || 0), Math.max(0, bal));
    if (expireAmt <= 0) continue;

    await sb(`/rest/v1/points_transactions`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        client_id: e.client_id,
        type: "expire",
        amount: -expireAmt,
        description: `Expiración de puntos (id=${e.id})`,
      }),
    });
    // Trigger-style: recalcular balance via función RPC
    await sb(`/rest/v1/rpc/recompute_client_points_balance`, {
      method: "POST",
      body: JSON.stringify({ p_client_id: e.client_id }),
    });
    results.expired_earns += 1;
    results.clients_affected.add(e.client_id);
  }

  // 2) Redemptions pending que expiraron → cancelar + refund puntos
  const expiredReds = await sb(
    `/rest/v1/client_reward_redemptions?select=id&status=eq.pending&expires_at=lte.${now}`
  );
  for (const r of Array.isArray(expiredReds) ? expiredReds : []) {
    await sb(`/rest/v1/rpc/cancel_redemption`, {
      method: "POST",
      body: JSON.stringify({ p_redemption_id: r.id }),
    });
    results.expired_redemptions += 1;
  }

  return Response.json({
    ran_at: now,
    expired_earns: results.expired_earns,
    expired_redemptions: results.expired_redemptions,
    clients_affected: results.clients_affected.size,
  });
}

export async function GET(req) { return run(req); }
export async function POST(req) { return run(req); }
