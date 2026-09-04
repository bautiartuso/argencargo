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
//   delivery_choice "oficina" | "propio"  — cambiar modalidad (requiere day+slot nuevos;
//                   el costo del envío lo calcula el sistema por la zona del cliente y se
//                   suma/quita del presupuesto; transportista se gestiona con un asesor)
//   delivery_address  dirección de entrega (solo envío propio)
// Cada cambio deja una nota "🤖 Bot de entregas" en la op para que se vea en el panel.

import { DELIVERY_CFG_KEYS, matchLocality, computeDeliveryCostUsd } from "../../../../lib/delivery";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 15;

// Zona y costo del envío propio para la localidad registrada del cliente —
// mismo cálculo server-side que usa el link (nunca se confía en montos del cliente).
async function envioDomicilio(client) {
  try {
    const [cfgRes, locRes] = await Promise.all([
      sb(`/calc_config?key=in.(${DELIVERY_CFG_KEYS})&select=key,value`),
      sb(`/delivery_localities?active=eq.true&select=name,keywords,km_from_origin&order=sort_order.asc`),
    ]);
    const cfg = {}; (Array.isArray(cfgRes.body) ? cfgRes.body : []).forEach((r) => { cfg[r.key] = Number(r.value); });
    const match = matchLocality(client?.city, client?.province, Array.isArray(locRes.body) ? locRes.body : []);
    if (!match) return null;
    return { zona: match.name, costo_usd: computeDeliveryCostUsd(match, cfg) };
  } catch { return null; }
}

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

const OP_SEL = "id,operation_code,link_opened_at,link_last_opened_at,link_open_count,status,budget_total,credit_applied_usd,debt_applied_usd,total_anticipos,discount_applied_usd,collected_amount,is_collected,collection_currency,collection_exchange_rate,delivery_choice,delivery_zone,delivery_address,delivery_cost_usd,payment_method_chosen,payment_split,cash_arrival_amount,cash_arrival_currency,delivery_day,delivery_slot,delivery_confirmed_at,delivery_completed_at,delivery_ready_at,delivery_public_token,delivery_contact,carrier_mode,delivery_group_id,client_id,clients(first_name,last_name,client_code,whatsapp,email,street,floor_apt,city,province,postal_code)";

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
      // Ops con el mismo grupo se entregan en la misma visita (coordinadas juntas).
      grupo: op.delivery_group_id || null,
    },
    pago: {
      metodo: op.payment_method_chosen,
      split: op.payment_split,
      llega_con: op.cash_arrival_amount ? { monto: Number(op.cash_arrival_amount), moneda: op.cash_arrival_currency } : null,
    },
    link_abierto: op.link_opened_at ? { veces: Number(op.link_open_count || 0), primera: op.link_opened_at, ultima: op.link_last_opened_at } : { veces: 0 },
    link: op.delivery_public_token ? `https://argencargo.com.ar/retiro/${op.delivery_public_token}` : null,
    franjas_validas: op.delivery_choice === "propio" ? FRANJAS.propio : FRANJAS.oficina,
    // Si se cambia la modalidad, las franjas válidas pasan a ser las de la nueva.
    franjas_por_modalidad: { oficina: FRANJAS.oficina, envio_domicilio: FRANJAS.propio },
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
    const [views, envio] = await Promise.all([
      Promise.all(ops.map(opView)),
      envioDomicilio(ops[0]?.clients || null),
    ]);
    const c0 = clients[0];
    return Response.json({
      cliente: { nombre: `${c0.first_name || ""} ${c0.last_name || ""}`.trim(), codigo: c0.client_code, email: c0.email },
      // null = la localidad del cliente está fuera del reparto propio (solo oficina/transportista).
      envio_domicilio: envio,
      operaciones: views,
    });
  }

  return Response.json({ error: "Falta ?op= o ?whatsapp=" }, { status: 400 });
}

// ── Acreditación automática de una transferencia (comprobante leído por el bot) ──
// Replica exactamente el flujo de "💰 Cobrar" del admin: operation_client_payments +
// movimiento en la CC de la financiera (SolFin, comisión 2,5 %) + collected_amount en la op.
// Cierra el cobro si lo pagado alcanza el saldo (tolerancia USD 1 o 0,5 %); si es parcial,
// deja el cobro abierto y devuelve lo que falta para que el bot se lo diga al cliente.
async function acreditar(body) {
  const op = await findOp(body.op);
  if (!op) return { error: `Operación ${body.op} no encontrada`, status: 404 };
  const monto = Number(body.monto_ars); const tc = Number(body.tc);
  if (!(monto > 0) || !(tc > 0)) return { error: "monto_ars y tc tienen que ser > 0", status: 400 };
  const ref = String(body.referencia || "").replace(/[^A-Za-z0-9-]/g, "").trim();
  if (ref) {
    const dup = await sb(`/operation_client_payments?operation_id=eq.${op.id}&notes=ilike.*ref%20${ref}*&select=id,amount_usd`);
    if (Array.isArray(dup.body) && dup.body.length) return { duplicado: true, ref };
  }
  const pagosRes = await sb(`/operation_client_payments?operation_id=eq.${op.id}&select=amount_usd`);
  let prev = (Array.isArray(pagosRes.body) ? pagosRes.body : []).reduce((a, x) => a + Number(x.amount_usd || 0), 0);
  const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  // Cobro legacy (registrado antes de que existiera la tabla de pagos): se preserva como fila.
  const legacyRaw = Number(op.collected_amount || 0); const legacyRate = Number(op.collection_exchange_rate || 0);
  const legacy = op.collection_currency === "ARS" && legacyRate > 0 ? legacyRaw / legacyRate : legacyRaw;
  if (prev <= 0.01 && op.is_collected === false && legacy > 0.01) {
    const lb = { operation_id: op.id, payment_date: hoy, amount_usd: legacy, currency: op.collection_currency || "USD", payment_method: op.collection_method || "transferencia", notes: "Cobro previo (migrado del registro anterior)" };
    if (op.collection_currency === "ARS" && legacyRate > 0) { lb.amount_ars = legacyRaw; lb.exchange_rate = legacyRate; }
    const insL = await sb(`/operation_client_payments`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(lb) });
    if (!(Array.isArray(insL.body) && insL.body[0]?.id)) return { error: "No se pudo preservar el cobro previo", status: 500 };
    prev = legacy;
  }
  const saldoAntes = saldoOf(op, prev);
  const usd = Math.round((monto / tc) * 100) / 100;
  const com = 2.5;
  const comArs = Math.round(monto * com) / 100;
  const ins = await sb(`/operation_client_payments`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
    operation_id: op.id, payment_date: hoy, amount_usd: usd, amount_ars: monto, exchange_rate: tc, currency: "ARS", payment_method: "transferencia",
    receipt_url: body.receipt_url || null, ars_destination: "financiera", commission_pct: com,
    notes: `Acreditado automáticamente por Argy (comprobante por WhatsApp${body.fecha ? ` del ${body.fecha}` : ""}${ref ? ` · ref ${ref}` : ""})`,
  }) });
  const pago = Array.isArray(ins.body) ? ins.body[0] : null;
  if (!pago?.id) return { error: ins.body?.message || "El cobro no se pudo guardar", status: 500 };
  try {
    await sb(`/cc_solfin_movements`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
      date: hoy, type: "ingreso", currency: "ARS", amount: monto, commission_pct: com, commission_amount: comArs, net_amount: monto - comArs, provisional_rate: tc,
      description: `Cobro ${op.operation_code}${op.clients?.client_code ? ` · ${op.clients.client_code}` : ""}`, image_url: body.receipt_url || null,
      operation_id: op.id, client_payment_id: pago.id, auto_generated: true,
    }) });
  } catch (e) { console.error("[bot/entrega] cc solfin", e.message); }
  const newTotal = Math.round((prev + usd) * 100) / 100;
  // Regla: el saldo en DÓLARES del sistema es el que manda. Lo pagado en pesos se convierte al TC
  // del día del pago; si el cliente transfirió los pesos que le dijimos otro día y el TC subió,
  // queda un saldo chico "por diferencia de tipo de cambio" — el bot se lo explica.
  const tol = Math.max(1, saldoAntes * 0.005);
  const restante = Math.round((saldoAntes - usd) * 100) / 100;
  const cierra = restante <= tol;
  const cierraReal = cierra;
  const cotizado = Array.isArray(op.payment_split) ? op.payment_split.reduce((a, p) => a + Number(p.amount || 0), 0) : 0;
  const diferenciaPresupuesto = 0;
  const upd = { collected_amount: newTotal, collection_method: "transferencia", collection_currency: "USD", collection_date: hoy };
  if (cierra) upd.is_collected = true;
  await sb(`/operations?id=eq.${op.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(upd) });
  await sb(`/op_communications`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ operation_id: op.id, type: "note", direction: "in", content: `✅ Cobro acreditado automáticamente por Argy: ARS ${monto.toLocaleString("es-AR")} (USD ${usd.toLocaleString("es-AR", { minimumFractionDigits: 2 })} al TC ${tc})${cierraReal ? " — cobro cerrado" : diferenciaPresupuesto > 0 ? ` — ⚠️ pagó lo cotizado (USD ${cotizado.toLocaleString("es-AR", { minimumFractionDigits: 2 })}) pero el presupuesto actual es mayor: diferencia USD ${diferenciaPresupuesto.toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : ` — queda saldo USD ${Math.max(0, restante).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`}` }) });
  return { ok: true, op: op.operation_code, usd, monto_ars: monto, tc, saldo_antes: saldoAntes, cotizado, restante: cierra ? 0 : Math.max(0, restante), excedente: restante < 0 ? Math.round(-restante * 100) / 100 : 0, cierra, cobro_cerrado: cierraReal, diferencia_presupuesto: diferenciaPresupuesto, entrega: { dia: op.delivery_day, franja: op.delivery_slot, modalidad: op.delivery_choice, confirmada: !!op.delivery_confirmed_at } };
}

export async function POST(req) {
  if (!authOk(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "Server config missing" }, { status: 500 });
  let body = null; try { body = await req.json(); } catch {}
  if (body?.accion === "acreditar") {
    const r = await acreditar(body);
    return Response.json(r, { status: r.status || 200 });
  }
  // Una op ("op") o varias ("ops") — con varias, el mismo cambio se aplica a todas y quedan
  // agrupadas para entregarse en la misma visita (delivery_group_id compartido).
  const codes = Array.isArray(body?.ops) ? body.ops : body?.op ? [body.op] : [];
  if (codes.length === 0 || codes.length > 20) return Response.json({ error: "Falta op (código) u ops (lista de códigos)" }, { status: 400 });

  const opsList = [];
  for (const c of codes) {
    const o = await findOp(c);
    if (!o) return Response.json({ error: `Operación ${c} no encontrada` }, { status: 404 });
    if (o.delivery_completed_at) return Response.json({ error: `${o.operation_code} ya fue entregada — no se puede recoordinar` }, { status: 409 });
    opsList.push(o);
  }
  if (new Set(opsList.map((o) => o.client_id)).size > 1) return Response.json({ error: "Las ops de un grupo tienen que ser del mismo cliente" }, { status: 400 });
  // Grupo: con varias ops se agrupan (manteniendo un grupo ya existente entre ellas si lo hay).
  const groupId = opsList.length > 1 ? (opsList.find((o) => o.delivery_group_id)?.delivery_group_id || crypto.randomUUID()) : null;

  const resultados = [];
  for (const op of opsList) {
  const patch = {};
  const cambios = [];

  // ── Cambiar modalidad (retiro por oficina ↔ envío a domicilio) ──────────
  // El costo del envío lo calcula el sistema por la zona REGISTRADA del cliente y se
  // suma/resta del presupuesto — nunca se acepta un monto que diga el cliente.
  let choiceEfectivo = op.delivery_choice;
  if (body.delivery_choice !== undefined) {
    const dc = body.delivery_choice;
    if (!["oficina", "propio"].includes(dc)) return Response.json({ error: "delivery_choice inválido (oficina/propio — transportista se gestiona con un asesor)" }, { status: 400 });
    if (body.delivery_day === undefined || body.delivery_slot === undefined) {
      return Response.json({ error: "Cambiar la modalidad requiere delivery_day y delivery_slot (las franjas difieren entre oficina y envío)" }, { status: 400 });
    }
    const costoActual = Number(op.delivery_cost_usd || 0);
    if (dc === "propio" && op.delivery_choice !== "propio") {
      const envio = await envioDomicilio(op.clients);
      if (!envio) return Response.json({ error: "La localidad del cliente está fuera de la zona de envío propio — derivar a un asesor" }, { status: 400 });
      patch.delivery_choice = "propio";
      patch.delivery_zone = envio.zona;
      patch.delivery_cost_usd = envio.costo_usd;
      patch.delivery_address = body.delivery_address ? String(body.delivery_address).slice(0, 300) : [op.clients?.street, op.clients?.floor_apt, op.clients?.city].filter(Boolean).join(", ");
      patch.budget_total = Math.round((Number(op.budget_total || 0) - costoActual + envio.costo_usd) * 100) / 100;
      cambios.push(`Modalidad → Envío a domicilio · ${envio.zona} (+USD ${envio.costo_usd.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
    } else if (dc === "oficina" && op.delivery_choice !== "oficina") {
      patch.delivery_choice = "oficina";
      patch.delivery_zone = null;
      patch.delivery_address = null;
      patch.delivery_cost_usd = 0;
      if (costoActual > 0) patch.budget_total = Math.round((Number(op.budget_total || 0) - costoActual) * 100) / 100;
      cambios.push(`Modalidad → Retiro por oficina${costoActual > 0 ? ` (se quitó el envío de USD ${costoActual.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ""}`);
    }
    choiceEfectivo = dc;
  } else if (body.delivery_address !== undefined && op.delivery_choice === "propio") {
    patch.delivery_address = String(body.delivery_address).slice(0, 300);
    cambios.push(`Dirección de entrega → ${patch.delivery_address}`);
  }

  // ── Reprogramar día y franja ─────────────────────────────────────────────
  const quiereDia = body.delivery_day !== undefined || body.delivery_slot !== undefined;
  if (quiereDia) {
    const modo = choiceEfectivo === "propio" ? "propio" : "oficina";
    if (choiceEfectivo === "carrier") return Response.json({ error: "Envío por transportista: no lleva día y franja" }, { status: 400 });
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
    if (m === "efectivo" && choiceEfectivo === "carrier") return Response.json({ error: "Efectivo no disponible para transportista externo" }, { status: 400 });
    const pagosRes = await sb(`/operation_client_payments?operation_id=eq.${op.id}&select=amount_usd`);
    const pagos = (Array.isArray(pagosRes.body) ? pagosRes.body : []).reduce((a, p) => a + Number(p.amount_usd || 0), 0);
    const saldo = Math.round(saldoOf({ ...op, budget_total: patch.budget_total ?? op.budget_total }, pagos) * 100) / 100;
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

  // Si el presupuesto cambió (envío sumado o quitado) y el pago no se tocó, el split
  // guardado queda con el monto viejo — se refresca con el saldo nuevo.
  if (patch.budget_total !== undefined && body.payment_method === undefined && Array.isArray(op.payment_split) && op.payment_split.length === 1) {
    const pr = await sb(`/operation_client_payments?operation_id=eq.${op.id}&select=amount_usd`);
    const pg = (Array.isArray(pr.body) ? pr.body : []).reduce((a, p) => a + Number(p.amount_usd || 0), 0);
    const saldoN = Math.round(saldoOf({ ...op, budget_total: patch.budget_total }, pg) * 100) / 100;
    patch.payment_split = [{ ...op.payment_split[0], amount: saldoN }];
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
  const completa = efPay && (choiceEfectivo === "carrier" || (efDay && efSlot));
  if (completa && !op.delivery_confirmed_at) patch.delivery_confirmed_at = new Date().toISOString();
  if (!op.delivery_ready_at) patch.delivery_ready_at = new Date().toISOString();
  if (groupId) patch.delivery_group_id = groupId;

  resultados.push({ op, patch, cambios });
  } // fin del loop de validación — recién acá, con todas las ops válidas, se aplica.

  const grupoTxt = opsList.length > 1 ? `\n🔗 Misma visita que: ${opsList.map((o) => o.operation_code).join(", ")}` : "";
  for (const r of resultados) {
    const upd = await sb(`/operations?id=eq.${r.op.id}`, { method: "PATCH", body: JSON.stringify(r.patch) });
    if (upd.status >= 400) return Response.json({ error: `No se pudo actualizar ${r.op.operation_code}` }, { status: 500 });
    await sb(`/op_communications`, {
      method: "POST",
      body: JSON.stringify({
        operation_id: r.op.id,
        type: "note",
        direction: "in",
        content: `🤖 Bot de entregas — el cliente cambió por WhatsApp:\n${r.cambios.map((c) => `• ${c}`).join("\n")}${grupoTxt}${body.note ? `\n📝 ${String(body.note).slice(0, 500)}` : ""}`,
      }),
    }).catch(() => {});
  }

  const vistas = await Promise.all(resultados.map(async (r) => opView(await findOp(r.op.operation_code) || r.op)));
  return Response.json({
    ok: true,
    cambios: resultados[0].cambios,
    grupo: groupId,
    ...(vistas.length === 1 ? { operacion: vistas[0] } : { operaciones: vistas }),
  });
}
