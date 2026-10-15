// POST /api/kairo/mp-sync
// Trae los pagos que hiciste con Mercado Pago (QR, débito, online) y los carga como gastos en
// mp_expenses (source='mp'). No duplica: se saltean los mp_payment_id ya cargados.
// Solo cuenta desde MP_DESDE: lo anterior de la cuenta era de otros usos. Mientras MP_DESDE sea
// null, es una prueba: muestra qué encontraría sin cargar nada.
// Si el comercio tiene una regla en kairo_merchant_rules, entra ya categorizado.
// Requiere MP_ACCESS_TOKEN (access token de producción de tu cuenta) y sesión de admin.

import { sb, kairoUser, mpOwnerId } from "../../../../lib/kairo-server";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MP_DESDE = "2026-10-13"; // hora Argentina; antes de esto la cuenta se usaba para otras cosas


const merchantKey = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();


const mp = async (path) => {
  const r = await fetch(`https://api.mercadopago.com${path}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
  if (!r.ok) throw new Error(`MP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

// Nombre de la otra persona en una transferencia, si MP lo manda (titular de la cuenta o nombre del pagador).
const counterpart = (p, side) => {
  const bank = p.point_of_interaction?.transaction_data?.bank_info?.[side];
  const name = bank?.account_holder_name || bank?.long_name
    || (side === "payer" ? [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ") : "");
  return name ? String(name).trim() : "";
};

const arDate = (iso) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 10);

// POST: la app al abrir Finanzas (sesión de admin). GET: el cron de Vercel cada 15 min (CRON_SECRET).
// La cuenta de Mercado Pago es una sola (la del dueño): para el resto de los usuarios no hace nada.
export async function POST(req) {
  const me = await kairoUser(req);
  if (!me) return Response.json({ error: "No autorizado" }, { status: 401 });
  const owner = await mpOwnerId();
  if (!owner || owner !== me.id) return Response.json({ ok: true, skipped: "sin Mercado Pago" });
  return sync(owner);
}

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "No autorizado" }, { status: 401 });
  const owner = await mpOwnerId();
  if (!owner) return Response.json({ ok: true, skipped: "sin dueño" });
  return sync(owner);
}

async function sync(uid) {
  if (!process.env.MP_ACCESS_TOKEN) return Response.json({ error: "Falta MP_ACCESS_TOKEN en Vercel" }, { status: 400 });

  try {
    const me = await mp("/users/me");
    const begin = MP_DESDE ? `${MP_DESDE}T00:00:00.000-03:00` : "NOW-35DAYS";
    const search = async (who) => {
      const out = [];
      for (let offset = 0; offset < 1000; offset += 100) {
        const res = await mp(`/v1/payments/search?${who}.id=${me.id}&sort=date_created&criteria=desc&range=date_created&begin_date=${encodeURIComponent(begin)}&end_date=NOW&limit=100&offset=${offset}`);
        out.push(...(res.results || []));
        if (out.length >= (res.paging?.total || 0) || !(res.results || []).length) break;
      }
      return out;
    };
    const [all, received] = await Promise.all([search("payer"), search("collector")]);
    // Lo que pagaste vos a otro (no las ventas que cobra la cuenta).
    // account_fund = ingreso de dinero desde tu banco a tu propia cuenta de MP: no es gasto ni ingreso.
    const OWN_MONEY = new Set(["account_fund"]);
    const payments = all.filter(p => p.status === "approved" && String(p.collector_id) !== String(me.id) && !OWN_MONEY.has(p.operation_type));
    const ownIds = all.filter(p => OWN_MONEY.has(p.operation_type)).map(p => String(p.id));
    if (ownIds.length) await sb(`/rest/v1/mp_expenses?user_id=eq.${uid}&mp_payment_id=in.(${ownIds.join(",")})&source=eq.mp`, { method: "PATCH", body: JSON.stringify({ source: "ignorado" }) });

    // Diagnóstico (temporal): qué datos de la otra persona trae MP en transferencias y pagos.
    for (const p of [...all, ...received].filter(p => p.operation_type !== "regular_payment").slice(0, 6)) {
      const poi = p.point_of_interaction || {};
      console.log("[kairo mp-sync] detalle", JSON.stringify({ op: p.operation_type, type: p.payment_type_id, desc: p.description, payer: p.payer && { first_name: p.payer.first_name, last_name: p.payer.last_name, has_email: !!p.payer.email, id_type: p.payer.identification?.type }, poi_type: poi.type, poi_keys: Object.keys(poi), td_keys: Object.keys(poi.transaction_data || {}), bank_info: poi.transaction_data?.bank_info, add_keys: Object.keys(p.additional_info || {}) }));
    }

    // Qué tipos trae MP (para confirmar si aparecen transferencias, servicios, etc.).
    const kinds = {};
    for (const p of payments) { const k = `${p.operation_type}/${p.payment_type_id}`; kinds[k] = (kinds[k] || 0) + 1; }
    console.log("[kairo mp-sync] tipos", JSON.stringify(kinds));

    if (!MP_DESDE) {
      return Response.json({ preview: true, found: payments.length, sample: payments.slice(0, 3).map(p => ({ merchant: p.description, amount: p.transaction_amount })) });
    }

    const rulesArr = await sb(`/rest/v1/kairo_merchant_rules?user_id=eq.${uid}&select=merchant_key,category_id`);
    // Regla con category_id null = "no es un gasto" para ese comercio/destinatario.
    const rules = new Map((Array.isArray(rulesArr) ? rulesArr : []).map(r => [r.merchant_key, r.category_id]));
    // Incluye los marcados como "no es un gasto" (source='ignorado') para no volver a traerlos.
    const known = await sb(`/rest/v1/mp_expenses?user_id=eq.${uid}&mp_payment_id=not.is.null&select=mp_payment_id`);
    if (!Array.isArray(known)) throw new Error("No se pudo leer los gastos ya cargados");
    const seen = new Set(known.map(k => k.mp_payment_id));

    const rows = payments.filter(p => !seen.has(String(p.id))).map(p => {
      const isTransfer = p.operation_type === "money_transfer";
      const merchant = p.description || p.statement_descriptor || counterpart(p, "collector") || p.point_of_interaction?.business_info?.sub_unit || (isTransfer ? "Transferencia" : "Mercado Pago");
      const key = merchantKey(merchant);
      const ignored = rules.has(key) && rules.get(key) === null;
      return {
        user_id: uid,
        mp_payment_id: String(p.id),
        source: ignored ? "ignorado" : "mp",
        merchant,
        description: merchant,
        amount_ars: Number(p.transaction_amount || 0),
        expense_date: arDate(p.date_approved || p.date_created),
        payment_method: isTransfer ? "Transferencia" : p.payment_type_id === "debit_card" || p.payment_type_id === "prepaid_card" ? "Débito" : p.payment_type_id === "credit_card" ? "Tarjeta de crédito" : p.point_of_interaction?.type === "QR" || p.pos_id ? "QR" : "Mercado Pago",
        installments: p.installments || 1,
        category_id: rules.get(key) || null,
      };
    });

    let inserted = [];
    if (rows.length) {
      const r = await sb(`/rest/v1/mp_expenses`, { method: "POST", body: JSON.stringify(rows), headers: { Prefer: "return=representation" } });
      if (!Array.isArray(r)) throw new Error(`No se pudieron guardar: ${JSON.stringify(r).slice(0, 200)}`);
      inserted = r;
    }

    // Ingresos: lo que te pagaron a vos (transferencias recibidas, cobros). Lo que pagaste vos mismo
    // a tu propia cuenta no cuenta.
    const incomes = received.filter(p => p.status === "approved" && String(p.payer?.id) !== String(me.id) && !OWN_MONEY.has(p.operation_type));
    const knownIn = await sb(`/rest/v1/kairo_incomes?user_id=eq.${uid}&mp_payment_id=not.is.null&select=mp_payment_id`);
    if (!Array.isArray(knownIn)) throw new Error("No se pudo leer los ingresos ya cargados (¿corriste el SQL de ingresos?)");
    const seenIn = new Set(knownIn.map(k => k.mp_payment_id));
    const inRows = incomes.filter(p => !seenIn.has(String(p.id))).map(p => ({
      user_id: uid,
      mp_payment_id: String(p.id),
      source: "mp",
      description: p.description || counterpart(p, "payer") || (p.operation_type === "money_transfer" ? "Transferencia recibida" : "Cobro Mercado Pago"),
      amount_ars: Number(p.transaction_amount || 0),
      income_date: arDate(p.date_approved || p.date_created),
    }));
    let insertedIn = [];
    if (inRows.length) {
      const r = await sb(`/rest/v1/kairo_incomes`, { method: "POST", body: JSON.stringify(inRows), headers: { Prefer: "return=representation" } });
      if (!Array.isArray(r)) throw new Error(`No se pudieron guardar los ingresos: ${JSON.stringify(r).slice(0, 200)}`);
      insertedIn = r;
    }
    return Response.json({ found: payments.length, inserted: inserted.length, insertedIncomes: insertedIn.length });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
