// POST /api/kairo/mp-sync
// Trae los pagos que hiciste con Mercado Pago (QR, débito, online) de los últimos 35 días y los
// carga como gastos en mp_expenses (source='mp'). No duplica: mp_payment_id es único.
// Si el comercio tiene una regla en kairo_merchant_rules, entra ya categorizado.
// Requiere MP_ACCESS_TOKEN (access token de producción de tu cuenta) y sesión de admin.

import { SB_URL, SB_KEY } from "../../../../lib/sb-client";

const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const sb = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}${path}`, {
    ...init,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return null; }
};

const merchantKey = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

async function isAdmin(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!token) return false;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null);
  if (!u?.id) return false;
  const p = await sb(`/rest/v1/profiles?id=eq.${u.id}&select=role`);
  return Array.isArray(p) && p[0]?.role === "admin";
}

const mp = async (path) => {
  const r = await fetch(`https://api.mercadopago.com${path}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
  if (!r.ok) throw new Error(`MP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

const arDate = (iso) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 10);

export async function POST(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!process.env.MP_ACCESS_TOKEN) return Response.json({ error: "Falta MP_ACCESS_TOKEN en Vercel" }, { status: 400 });

  try {
    const me = await mp("/users/me");
    const since = new Date(Date.now() - 35 * 86400e3).toISOString();
    const res = await mp(`/v1/payments/search?payer.id=${me.id}&sort=date_created&criteria=desc&range=date_created&begin_date=${encodeURIComponent(since)}&end_date=NOW&limit=100`);
    const payments = (res.results || []).filter(p => p.status === "approved" && String(p.collector_id) !== String(me.id));

    const rulesArr = await sb(`/rest/v1/kairo_merchant_rules?select=merchant_key,category_id`);
    const rules = Object.fromEntries((Array.isArray(rulesArr) ? rulesArr : []).map(r => [r.merchant_key, r.category_id]));

    const rows = payments.map(p => {
      const merchant = p.description || p.statement_descriptor || p.point_of_interaction?.business_info?.sub_unit || "Mercado Pago";
      return {
        mp_payment_id: String(p.id),
        source: "mp",
        merchant,
        description: merchant,
        amount_ars: Number(p.transaction_amount || 0),
        expense_date: arDate(p.date_approved || p.date_created),
        payment_method: p.payment_type_id === "debit_card" || p.payment_type_id === "prepaid_card" ? "Débito" : p.payment_type_id === "credit_card" ? "Tarjeta de crédito" : "Mercado Pago",
        installments: p.installments || 1,
        category_id: rules[merchantKey(merchant)] || null,
      };
    });

    let inserted = [];
    if (rows.length) {
      // ignore-duplicates: lo ya sincronizado (y lo que recategorizaste a mano) no se pisa.
      const r = await sb(`/rest/v1/mp_expenses?on_conflict=mp_payment_id`, {
        method: "POST", body: JSON.stringify(rows),
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      });
      inserted = Array.isArray(r) ? r : [];
    }
    return Response.json({ found: payments.length, inserted: inserted.length });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
