// GET /api/cron/client-nudges
// Cron diario que detecta ops/avisos donde el cliente tiene una acción pendiente
// y le manda recordatorio (in-app notification + web push si está suscripto).
// Cron: una vez por día (configurado en vercel.json).
// Auth: Bearer CRON_SECRET (Vercel cron) o admin manual.
// Anti-spam: usa la columna last_nudged_at en operations + dedup por op+kind.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

export const maxDuration = 60;

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

async function isAuthorized(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${process.env.CRON_SECRET || ""}`) return true;
  // Admin manual
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    if (!payload?.sub) return false;
    const p = await sb(`/rest/v1/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p) && p[0]?.role === "admin";
  } catch { return false; }
}

async function sendPush(userId, title, body, url) {
  try {
    await fetch(`${BASE_URL}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET}` },
      body: JSON.stringify({ user_id: userId, title, body, url }),
    });
  } catch {}
}

export async function GET(req) {
  if (!(await isAuthorized(req))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1";
  const todayISO = new Date().toISOString();
  const d3agoISO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const d5agoISO = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  // Ops aéreo blanco que llegaron al depósito hace +3d sin confirmar consolidación
  const op1 = await sb(`/rest/v1/operations?select=id,operation_code,client_id,status,created_at,consolidation_confirmed,last_client_nudge_at,clients(first_name,auth_user_id)&channel=eq.aereo_blanco&status=eq.en_deposito_origen&consolidation_confirmed=eq.false&created_at=lt.${d3agoISO}`);
  // Ops en preparación sin items declarados hace +3d
  const op2Raw = await sb(`/rest/v1/operations?select=id,operation_code,client_id,status,created_at,last_client_nudge_at,clients(first_name,auth_user_id)&channel=eq.aereo_blanco&status=eq.en_preparacion&created_at=lt.${d3agoISO}`);
  // Filtrar solo las que NO tienen items
  const op2 = [];
  for (const o of (Array.isArray(op2Raw) ? op2Raw : [])) {
    const items = await sb(`/rest/v1/operation_items?operation_id=eq.${o.id}&select=id&limit=1`);
    if (!Array.isArray(items) || items.length === 0) op2.push(o);
  }
  // Ops entregadas sin cobrar hace +5d
  const op3 = await sb(`/rest/v1/operations?select=id,operation_code,client_id,status,delivered_at,budget_total,collected_amount,last_client_nudge_at,clients(first_name,auth_user_id)&status=eq.entregada&is_collected=eq.false&delivered_at=lt.${d5agoISO}`);

  const allCandidates = [
    ...(Array.isArray(op1) ? op1 : []).map(o => ({ ...o, kind: "consolidation", title: "📦 Confirmá tu carga", body: `Tu paquete está en nuestro depósito. Confirmá si es el único o esperás más para enviar.` })),
    ...op2.map(o => ({ ...o, kind: "documentation", title: "📋 Completá tu documentación", body: `Tu carga está lista para preparar el envío. Cargá los productos para avanzar.` })),
    ...(Array.isArray(op3) ? op3 : []).map(o => {
      const saldo = Math.max(0, Number(o.budget_total || 0) - Number(o.collected_amount || 0));
      return { ...o, kind: "payment", title: "💰 Tu carga está lista para retirar", body: `Saldo pendiente: USD ${saldo.toFixed(2)}. Coordinemos el pago para el retiro.` };
    }),
  ];

  // Filtrar: no nudgear si ya se le mandó nudge en los últimos 5 días para esta op
  const toNudge = allCandidates.filter(o => {
    if (!o.last_client_nudge_at) return true;
    const lastMs = new Date(o.last_client_nudge_at).getTime();
    return Date.now() - lastMs > 5 * 24 * 60 * 60 * 1000;
  });

  if (dryRun) {
    return Response.json({ ok: true, dry_run: true, candidates: allCandidates.length, would_nudge: toNudge.length, items: toNudge.map(o => ({ op: o.operation_code, kind: o.kind, client: o.clients?.first_name })) });
  }

  let sent = 0;
  for (const o of toNudge) {
    if (!o.clients?.auth_user_id) continue;
    const link = `?op=${o.operation_code}`;
    // 1. In-app notification
    await sb(`/rest/v1/notifications`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: o.clients.auth_user_id,
        portal: "cliente",
        title: o.title,
        body: o.body,
        link,
      }),
    });
    // 2. Web push
    await sendPush(o.clients.auth_user_id, o.title, o.body, `/portal${link}`);
    // 3. Marcar nudge en la op
    await sb(`/rest/v1/operations?id=eq.${o.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_client_nudge_at: todayISO }),
    });
    sent++;
  }

  return Response.json({ ok: true, candidates: allCandidates.length, sent });
}
