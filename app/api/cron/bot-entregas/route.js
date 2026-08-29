// GET /api/cron/bot-entregas — recordatorios automáticos del bot de entregas.
// Corre cada hora (vercel.json). Plantillas fijas de WhatsApp — cero IA, costo cero.
//
// 1) Coordinación: carga lista avisada y sin coordinar → recordatorio cada 60 h
//    reloj desde el aviso (tope 5, después queda para gestión humana).
// 2) Pago/almacenaje: coordinada con transferencia, sin retirar y sin pago, a los
//    7 días de estar lista → recordatorio cada 60 h (tope 5): la primera semana de
//    almacenaje es sin cargo, desde la segunda se necesita el pago realizado.
//
// Sin credenciales de Meta todo es no-op: se puede deployar hoy y se enciende solo.
// ?dry=1 devuelve qué mandaría sin mandar nada (para probar la selección).

import { sendWaTemplate, waConfigured, waNumber } from "../../../../lib/wa";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

export const maxDuration = 60;

const H60 = 60 * 3600 * 1000;
const D7 = 7 * 24 * 3600 * 1000;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const t = await r.text();
  let b = null; try { b = JSON.parse(t); } catch {}
  return { status: r.status, body: b };
}

function usdCollected(op) {
  if (!op.is_collected) return 0;
  const raw = Number(op.collected_amount || 0);
  if (op.collection_currency === "ARS") { const rate = Number(op.collection_exchange_rate || 0); return rate > 0 ? raw / rate : 0; }
  return raw;
}

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    // También se acepta el secret de test del bot para ejecuciones manuales.
    if (!process.env.BOT_TEST_SECRET || auth !== `Bearer ${process.env.BOT_TEST_SECRET}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  if (!SB_SERVICE) return Response.json({ error: "Server config missing" }, { status: 500 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const now = Date.now();
  const sel = "id,operation_code,budget_total,credit_applied_usd,debt_applied_usd,total_anticipos,discount_applied_usd,collected_amount,is_collected,collection_currency,collection_exchange_rate,payment_method_chosen,delivery_public_token,delivery_ready_at,delivery_confirmed_at,bot_coord_reminder_at,bot_coord_reminder_count,bot_pay_reminder_at,bot_pay_reminder_count,clients(first_name,whatsapp)";

  const out = { coordinacion: [], pago: [], enviados: 0, wa: waConfigured() };

  // ── 1) Recordatorio de coordinación ────────────────────────────────────────
  const r1 = await sb(`/operations?delivery_ready_at=not.is.null&delivery_confirmed_at=is.null&delivery_completed_at=is.null&bot_coord_reminder_count=lt.5&select=${sel}`);
  for (const op of Array.isArray(r1.body) ? r1.body : []) {
    const base = new Date(op.bot_coord_reminder_at || op.delivery_ready_at).getTime();
    if (now - base < H60) continue;
    const num = waNumber(op.clients?.whatsapp);
    if (!num || !op.delivery_public_token) continue;
    out.coordinacion.push(op.operation_code);
    if (dry) continue;
    const r = await sendWaTemplate(num, "recordatorio_coordinar", [
      op.clients?.first_name || "Hola", op.operation_code, `${BASE_URL}/retiro/${op.delivery_public_token}`,
    ]);
    if (r?.ok) {
      out.enviados++;
      await sb(`/operations?id=eq.${op.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ bot_coord_reminder_at: new Date().toISOString(), bot_coord_reminder_count: (op.bot_coord_reminder_count || 0) + 1 }) });
    }
  }

  // ── 2) Recordatorio de pago + almacenaje (transferencia, sin retirar) ──────
  const r2 = await sb(`/operations?delivery_ready_at=not.is.null&delivery_confirmed_at=not.is.null&delivery_completed_at=is.null&payment_method_chosen=eq.transferencia&is_collected=eq.false&bot_pay_reminder_count=lt.5&select=${sel}`);
  const cand = (Array.isArray(r2.body) ? r2.body : []).filter((op) => {
    const listaDesde = new Date(op.delivery_ready_at).getTime();
    if (now - listaDesde < D7) return false; // primera semana: sin recordatorio de pago
    const base = op.bot_pay_reminder_at ? new Date(op.bot_pay_reminder_at).getTime() : listaDesde + D7;
    return now - base >= (op.bot_pay_reminder_at ? H60 : 0);
  });
  if (cand.length > 0) {
    // Cobros parciales: si ya pagó (o casi), no molestar.
    const cp = await sb(`/operation_client_payments?operation_id=in.(${cand.map((o) => o.id).join(",")})&select=operation_id,amount_usd`);
    const pag = {}; (Array.isArray(cp.body) ? cp.body : []).forEach((p) => { pag[p.operation_id] = (pag[p.operation_id] || 0) + Number(p.amount_usd || 0); });
    let tc = 0;
    try { const t = await fetch("https://dolarapi.com/v1/dolares/blue", { signal: AbortSignal.timeout(2500) }); if (t.ok) tc = Number((await t.json())?.venta) || 0; } catch {}
    for (const op of cand) {
      const collected = (pag[op.id] || 0) > 0 ? pag[op.id] : usdCollected(op);
      const saldo = Math.round(Math.max(0, Number(op.budget_total || 0) + Number(op.debt_applied_usd || 0) - Number(op.total_anticipos || 0) - collected - Number(op.credit_applied_usd || 0) - Number(op.discount_applied_usd || 0)) * 100) / 100;
      if (saldo <= 1) continue;
      const num = waNumber(op.clients?.whatsapp);
      if (!num) continue;
      const saldoTxt = tc > 0 ? `ARS ${Math.round(saldo * tc).toLocaleString("es-AR")} (USD ${saldo.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : `USD ${saldo.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      out.pago.push(op.operation_code);
      if (dry) continue;
      const r = await sendWaTemplate(num, "recordatorio_pago", [
        op.clients?.first_name || "Hola", op.operation_code, saldoTxt,
        "Tu carga ya cumplió la primera semana de almacenaje sin cargo — para seguir guardándola sin costo necesitamos el pago realizado; si no, se aplica un costo diario de almacenaje. Apenas transfieras, mandanos el comprobante por acá 🙏",
      ]);
      if (r?.ok) {
        out.enviados++;
        await sb(`/operations?id=eq.${op.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ bot_pay_reminder_at: new Date().toISOString(), bot_pay_reminder_count: (op.bot_pay_reminder_count || 0) + 1 }) });
      }
    }
  }

  return Response.json(out);
}
