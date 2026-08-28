// GET/POST /api/bot/entrega — API server-to-server para el bot de entregas (n8n).
//
// Auth: Authorization: Bearer <CRON_SECRET> (igual que los otros calls server-to-server).
//
// GET  ?whatsapp=549XXXXXXXXXX  → cliente + sus operaciones entregables (por entregar / a cobrar)
// GET  ?op=AC-0150              → una operación puntual por código
//
// POST { op: "AC-0150", ...cambios }  → cambios parciales sobre la coordinación:
//   delivery_day    "YYYY-MM-DD" (hábil, no pasado)   ┐ reprogramar — van juntos
//   delivery_slot   franja válida según la modalidad  ┘
//   payment_method  "efectivo" | "transferencia" | "crypto"
//   cash_currency   "USD" | "ARS" | "mixto"   (solo efectivo)
//   cash_usd_part / cash_ars_part             (solo mixto, opcionales)
//   cash_amount     con cuánto llega (para el cambio) + cash_amount_currency USD/ARS
//   delivery_contact  quién recibe (envíos)
//   note            texto libre del bot que se agrega a la nota admin
//
// Cambiar la MODALIDAD (oficina ↔ envío) queda afuera a propósito: envío propio implica
// recalcular costo por zona y dirección — para eso el bot reenvía el link al cliente.
// Cada cambio deja una nota "🤖 Bot de entregas" en la op para que se vea en el panel.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 15;

const FRANJAS = {
  oficina: ["10:00 a 12:00", "12:00 a 14:00", "14:00 a 16:00", "16:00 a 18:00"],
  propio: ["10:00 a 13:00", "13:00 a 16:00", "16:00 a 19:00"],
};
const METODOS = ["efectivo", "transferencia", "crypto"];

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
      Prefer: opts.method === "PATCH" || opts.method === "POST" ? "return=representation" : undefined,
      ...(opts.headers || {}),
    },
  });
  const txt = await r.text();
  let body = null; try { body = JSON.parse(txt); } catch {}
  return { status: r.status, body };
}

function authOk(req) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET || "";
  return secret && auth === `Bearer ${secret}`;
}

function usdCollected(op) {
  if (!op.is_collected) return 0;
  const raw = Number(op.collected_amount || 0);
  if (op.collection_currency === "ARS") {
    const rate = Number(op.collection_exchange_rate || 0);
    return rate > 0 ? raw / rate : 0;
  }
  return raw;
}

// Mismo criterio que el panel de Entregas: los cobros parciales registrados pisan al legacy.
function saldoOf(op, pagosUsd) {
  const collected = pagosUsd > 0 ? pagosUsd : usdCollected(op);
  return Math.round(Math.max(0,
    Number(op.budget_total || 0) + Number(op.debt_applied_usd || 0)
    - Number(op.total_anticipos || 0) - collected
    - Number(op.credit_applied_usd || 0) - Number(op.discount_applied_usd || 0)
  ) * 100) / 100;
}

const OP_SEL = "id,operation_code,status,budget_total,credit_applied_usd,debt_applied_usd,total_anticipos,discount_applied_usd,collected_amount,is_collected,collection_currency,collection_exchange_rate,delivery_choice,delivery_zone,delivery_address,delivery_cost_usd,payment_method_chosen,payment_split,cash_arrival_amount,cash_arrival_currency,delivery_day,delivery_slot,delivery_confirmed_at,delivery_completed_at,delivery_ready_at,delivery_public_token,delivery_contact,carrier_mode,client_id,clients(first_name,last_name,client_code,whatsapp,email,street,floor_apt,city,province,postal_code)";

async function opView(op) {
  const [pagosRes, pkRes] = await Promise.all([
    sb(`/operation_client_payments?operation_id=eq.${op.id}&select=amount_usd`),
    sb(`/operation_packages?operation_id=eq.${op.id}&select=quantity`),
  ]);
  const pagos = (Array.isArray(pagosRes.body) ? pagosRes.body : []).reduce((a, p) => a + Number(p.amount_usd || 0), 0);
  const bultos = (Array.isArray(pkRes.body) ? pkRes.body : []).reduce((a, p) => a + Number(p.quantity || 1), 0);
  const c = op.clients || {};
  return {
    op: op.operation_code,
    cliente: { nombre: `${c.first_name || ""} ${c.last_name || ""}`.trim(), codigo: c.client_code, whatsapp: c.whatsapp, email: c.email },
    etapa: op.delivery_completed_at ? "a_cobrar" : (op.delivery_confirmed_at ? "por_entregar" : "esperando_link"),
    bultos,
    saldo_usd: saldoOf(op, pagos),
    entrega: {
      modalidad: op.delivery_choice,               // oficina | propio | carrier | null
      dia: op.delivery_day,
      franja: op.delivery_slot,
      zona: op.delivery_zone,
      direccion: op.delivery_address,
      contacto: op.delivery_contact,
      costo_envio_usd: Number(op.delivery_cost_usd || 0) || 0,
      confirmada: !!op.delivery_confirmed_at,
    },
    pago: {
      metodo: op.payment_method_chosen,
      split: op.payment_split,
      llega_con: op.cash_arrival_amount ? { monto: Number(op.cash_arrival_amount), moneda: op.cash_arrival_currency } : null,
    },
    link: op.delivery_public_token ? `https://argencargo.com.ar/retiro/${op.delivery_public_token}` : null,
    franjas_validas: op.delivery_choice === "propio" ? FRANJAS.propio : FRANJAS.oficina,
  };
}

async function findOp(code) {
  const r = await sb(`/operations?operation_code=eq.${encodeURIComponent(String(code).trim().toUpperCase())}&select=${OP_SEL}&limit=1`);
  return Array.isArray(r.body) && r.body[0] ? r.body[0] : null;
}

export async function GET(req) {
  if (!authOk(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "Server config missing" }, { status: 500 });
  const url = new URL(req.url);
  const opCode = url.searchParams.get("op");
  const wa = url.searchParams.get("whatsapp");

  if (opCode) {
    const op = await findOp(opCode);
    if (!op) return Response.json({ error: "Operación no encontrada" }, { status: 404 });
    return Response.json({ operacion: await opView(op) });
  }

  if (wa) {
    // Los whatsapp guardados vienen con formatos mezclados (+54 9 11..., 549..., espacios):
    // se compara solo por dígitos, matcheando el sufijo más largo (últimos 8+).
    const digits = String(wa).replace(/\D/g, "");
    if (digits.length < 8) return Response.json({ error: "WhatsApp inválido" }, { status: 400 });
    const cRes = await sb(`/clients?whatsapp=not.is.null&select=id,first_name,last_name,client_code,whatsapp,email`);
    const clients = (Array.isArray(cRes.body) ? cRes.body : []).filter((c) => {
      const d = String(c.whatsapp || "").replace(/\D/g, "");
      return d.length >= 8 && (d.endsWith(digits.slice(-10)) || digits.endsWith(d.slice(-10)));
    });
    if (clients.length === 0) return Response.json({ cliente: null, operaciones: [] });
    const ids = clients.map((c) => c.id).join(",");
    const opsRes = await sb(`/operations?client_id=in.(${ids})&or=(and(delivery_completed_at.is.null,or(status.eq.entregada,delivery_ready_at.not.is.null)),and(delivery_completed_at.not.is.null,is_collected.eq.false))&select=${OP_SEL}&order=created_at.desc`);
    const ops = Array.isArray(opsRes.body) ? opsRes.body : [];
    const views = await Promise.all(ops.map(opView));
    const c0 = clients[0];
    return Response.json({
      cliente: { nombre: `${c0.first_name || ""} ${c0.last_name || ""}`.trim(), codigo: c0.client_code, email: c0.email },
      operaciones: views,
    });
  }

  return Response.json({ error: "Falta ?op= o ?whatsapp=" }, { status: 400 });
}

export async function POST(req) {
  if (!authOk(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "Server config missing" }, { status: 500 });
  let body = null; try { body = await req.json(); } catch {}
  if (!body || !body.op) return Response.json({ error: "Falta op (código de operación)" }, { status: 400 });

  const op = await findOp(body.op);
  if (!op) return Response.json({ error: "Operación no encontrada" }, { status: 404 });
  if (op.delivery_completed_at) return Response.json({ error: "La operación ya fue entregada — no se puede recoordinar" }, { status: 409 });

  const patch = {};
  const cambios = [];

  // ── Reprogramar día y franja ─────────────────────────────────────────────
  const quiereDia = body.delivery_day !== undefined || body.delivery_slot !== undefined;
  if (quiereDia) {
    const modo = op.delivery_choice === "propio" ? "propio" : "oficina";
    if (op.delivery_choice === "carrier") return Response.json({ error: "Envío por transportista: no lleva día y franja" }, { status: 400 });
    const dia = body.delivery_day, franja = body.delivery_slot;
    if (!dia || !/^\d{4}-\d{2}-\d{2}$/.test(String(dia))) return Response.json({ error: "delivery_day inválido (YYYY-MM-DD)" }, { status: 400 });
    if (!FRANJAS[modo].includes(franja)) return Response.json({ error: `Franja inválida para ${modo}. Válidas: ${FRANJAS[modo].join(" / ")}` }, { status: 400 });
    const dow = new Date(dia + "T12:00:00Z").getUTCDay();
    if (dow === 0 || dow === 6) return Response.json({ error: "Elegí un día hábil (lunes a viernes)" }, { status: 400 });
    // Hoy en Argentina (UTC-3) — un día anterior no sirve para coordinar.
    const hoyAr = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    if (dia < hoyAr) return Response.json({ error: "El día ya pasó" }, { status: 400 });
    patch.delivery_day = dia;
    patch.delivery_slot = franja;
    cambios.push(`Día y franja → ${dia.split("-").reverse().join("/")} · ${franja}`);
  }

  // ── Cambiar forma de pago ────────────────────────────────────────────────
  if (body.payment_method !== undefined) {
    const m = body.payment_method;
    if (!METODOS.includes(m)) return Response.json({ error: "payment_method inválido (efectivo/transferencia/crypto)" }, { status: 400 });
    if (m === "efectivo" && op.delivery_choice === "carrier") return Response.json({ error: "Efectivo no disponible para transportista externo" }, { status: 400 });
    const pagosRes = await sb(`/operation_client_payments?operation_id=eq.${op.id}&select=amount_usd`);
    const pagos = (Array.isArray(pagosRes.body) ? pagosRes.body : []).reduce((a, p) => a + Number(p.amount_usd || 0), 0);
    const saldo = saldoOf(op, pagos);
    const split = { method: m, amount: saldo };
    if (m === "efectivo") {
      const cur = body.cash_currency;
      if (cur && !["USD", "ARS", "mixto"].includes(cur)) return Response.json({ error: "cash_currency inválida (USD/ARS/mixto)" }, { status: 400 });
      if (cur) split.currency = cur;
      if (cur === "mixto") {
        if (Number(body.cash_usd_part) > 0) split.usd_part = Math.round(Number(body.cash_usd_part) * 100) / 100;
        if (Number(body.cash_ars_part) > 0) split.ars_part = Math.round(Number(body.cash_ars_part));
      }
    }
    patch.payment_method_chosen = m;
    patch.payment_split = [split];
    const usaEfectivo = m === "efectivo";
    patch.cash_arrival_amount = usaEfectivo && Number(body.cash_amount) > 0 ? Number(body.cash_amount) : null;
    patch.cash_arrival_currency = usaEfectivo && Number(body.cash_amount) > 0 ? (body.cash_amount_currency === "ARS" ? "ARS" : "USD") : null;
    const PL = { efectivo: "Efectivo", transferencia: "Transferencia en pesos", crypto: "Cripto (USDT)" };
    cambios.push(`Pago → ${PL[m]}${split.currency ? ` (${split.currency})` : ""}`);
    if (patch.cash_arrival_amount) cambios.push(`💵 Llega con ${patch.cash_arrival_currency} ${patch.cash_arrival_amount.toLocaleString("es-AR")} — tener cambio listo`);
  }

  // ── Quién recibe ─────────────────────────────────────────────────────────
  if (body.delivery_contact !== undefined) {
    patch.delivery_contact = body.delivery_contact ? String(body.delivery_contact).slice(0, 300) : null;
    cambios.push(`Recibe → ${patch.delivery_contact || "(borrado)"}`);
  }

  if (cambios.length === 0) return Response.json({ error: "Sin cambios: mandá delivery_day+delivery_slot, payment_method o delivery_contact" }, { status: 400 });

  // Si con esto la coordinación queda completa (día+franja+pago, o carrier+pago), se confirma.
  const efDay = patch.delivery_day ?? op.delivery_day;
  const efSlot = patch.delivery_slot ?? op.delivery_slot;
  const efPay = patch.payment_method_chosen ?? op.payment_method_chosen;
  const completa = efPay && (op.delivery_choice === "carrier" || (efDay && efSlot));
  if (completa && !op.delivery_confirmed_at) patch.delivery_confirmed_at = new Date().toISOString();
  if (!op.delivery_ready_at) patch.delivery_ready_at = new Date().toISOString();

  const upd = await sb(`/operations?id=eq.${op.id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (upd.status >= 400) return Response.json({ error: "No se pudo actualizar la operación" }, { status: 500 });

  await sb(`/op_communications`, {
    method: "POST",
    body: JSON.stringify({
      operation_id: op.id,
      type: "note",
      direction: "in",
      content: `🤖 Bot de entregas — el cliente cambió por WhatsApp:\n${cambios.map((c) => `• ${c}`).join("\n")}${body.note ? `\n📝 ${String(body.note).slice(0, 500)}` : ""}`,
    }),
  });

  const fresh = await findOp(body.op);
  return Response.json({ ok: true, cambios, operacion: await opView(fresh || op) });
}
