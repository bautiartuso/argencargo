// GET  /api/entrega/[token] → datos de la operación para la pantalla pública de "carga lista"
// POST /api/entrega/[token] → cliente confirma envío/retiro + método de pago

import { DELIVERY_CFG_KEYS, matchLocality, computeDeliveryCostUsd } from "../../../../lib/delivery";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

const sbFetch = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...init,
    headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) },
  });
  const txt = await r.text();
  let parsed = null; try { parsed = JSON.parse(txt); } catch {}
  return { status: r.status, body: parsed };
};

// collected_amount puede estar cargado en ARS (collection_currency) — convertir a USD antes de
// restar, si no el saldo (y el total) da mal para cualquier cobro que no esté en USD.
function usdCollected(op) {
  if (!op.is_collected) return 0;
  const raw = Number(op.collected_amount || 0);
  if (op.collection_currency === "ARS") {
    const rate = Number(op.collection_exchange_rate || 0);
    return rate > 0 ? raw / rate : 0;
  }
  return raw;
}

// RI con entrega directa por courier al domicilio: el link no coordina nada — es
// detalle + documentos + pago. NULL en ri_entrega_directa = automatico para RI;
// false = excepcion (ese RI usa el flujo normal); true = forzar.
function esRiDirecta(op) {
  if (op.ri_entrega_directa === false) return false;
  return op.ri_entrega_directa === true || op.clients?.tax_condition === "responsable_inscripto";
}

function fullAddress(c) {
  const parts = [c.street, c.floor_apt].filter(Boolean).join(", ");
  return [parts, c.city].filter(Boolean).join(", ");
}

// Cobros parciales registrados por op (operation_client_payments) — el link los tiene que
// restar igual que el panel de Entregas, si no le muestra al cliente un saldo inflado.
async function pagosParciales(ids) {
  if (!ids.length) return {};
  const r = await sbFetch(`/operation_client_payments?operation_id=in.(${ids.join(",")})&select=operation_id,amount_usd`);
  const m = {};
  (Array.isArray(r.body) ? r.body : []).forEach((p) => { m[p.operation_id] = (m[p.operation_id] || 0) + Number(p.amount_usd || 0); });
  return m;
}
// Mismo criterio que el panel: los cobros parciales registrados pisan al legacy collected.
function collectedOf(op, pagos) { const p = Number(pagos || 0); return p > 0 ? p : usdCollected(op); }
function saldoOf(op, pagos) {
  return Math.max(0, Number(op.budget_total || 0) + Number(op.debt_applied_usd || 0)
    - Number(op.total_anticipos || 0) - collectedOf(op, pagos)
    - Number(op.credit_applied_usd || 0) - Number(op.discount_applied_usd || 0));
}

const HERMANA_SEL = "id,operation_code,description,budget_total,credit_applied_usd,debt_applied_usd,total_anticipos,discount_applied_usd,collected_amount,is_collected,collection_currency,collection_exchange_rate,delivery_choice,delivery_day,delivery_slot,delivery_confirmed_at,delivery_group_id";

// Otras cargas LISTAS del mismo cliente (avisadas o entregables, sin entregar todavía):
// el link las ofrece para coordinar todo en una sola visita.
async function loadHermanas(op) {
  if (!op.client_id) return [];
  const r = await sbFetch(`/operations?client_id=eq.${op.client_id}&id=neq.${op.id}&delivery_completed_at=is.null&or=(status.eq.entregada,delivery_ready_at.not.is.null)&select=${HERMANA_SEL}&order=created_at.asc`);
  const list = Array.isArray(r.body) ? r.body : [];
  if (list.length === 0) return [];
  const [pk, pagos] = await Promise.all([
    sbFetch(`/operation_packages?operation_id=in.(${list.map((o) => o.id).join(",")})&select=operation_id,quantity`),
    pagosParciales(list.map((o) => o.id)),
  ]);
  const bm = {};
  (Array.isArray(pk.body) ? pk.body : []).forEach((p) => { bm[p.operation_id] = (bm[p.operation_id] || 0) + Number(p.quantity || 1); });
  return list.map((o) => ({
    id: o.id,
    operation_code: o.operation_code,
    description: o.description,
    bultos: bm[o.id] || 0,
    saldo: Math.round(saldoOf(o, pagos[o.id]) * 100) / 100,
    delivery_day: o.delivery_day,
    delivery_slot: o.delivery_slot,
    delivery_confirmed_at: o.delivery_confirmed_at,
    delivery_group_id: o.delivery_group_id,
  }));
}

async function loadOpData(token) {
  const opRes = await sbFetch(`/operations?delivery_public_token=eq.${encodeURIComponent(token)}&select=*,clients(first_name,last_name,client_code,street,floor_apt,postal_code,city,province,tax_condition,dni,email,whatsapp)&limit=1`);
  if (opRes.status >= 400 || !Array.isArray(opRes.body) || opRes.body.length === 0) return null;
  return opRes.body[0];
}


async function loadDeliveryPricing() {
  const [configRes, locRes] = await Promise.all([
    sbFetch(`/calc_config?key=in.(${DELIVERY_CFG_KEYS})&select=key,value`),
    sbFetch(`/delivery_localities?active=eq.true&select=name,keywords,km_from_origin&order=sort_order.asc`),
  ]);
  const cfg = {};
  (Array.isArray(configRes.body) ? configRes.body : []).forEach(r => { cfg[r.key] = Number(r.value); });
  const localities = Array.isArray(locRes.body) ? locRes.body : [];
  return { cfg, localities };
}

export async function GET(req, { params }) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  const { token } = await params;
  if (!token) return Response.json({ error: "Token requerido" }, { status: 400 });

  const op = await loadOpData(token);
  if (!op) return Response.json({ error: "No encontramos esta operación o el link expiró" }, { status: 404 });

  const [pkgsRes, settingsRes, itemsRes, { cfg, localities }, hermanas, pagosOp, factRes] = await Promise.all([
    sbFetch(`/operation_packages?operation_id=eq.${op.id}&select=package_number,quantity,gross_weight_kg,length_cm,width_cm,height_cm,national_tracking&order=package_number.asc`),
    sbFetch(`/gi_settings?select=office_address,office_locality,office_hours,office_phone,payment_titular,payment_alias,payment_crypto_wallet&limit=1`),
    sbFetch(`/operation_items?operation_id=eq.${op.id}&select=description,quantity,unit_price_usd,import_duty_rate,statistics_rate,iva_rate,iva_additional_rate,iigg_rate,iibb_rate&order=created_at.asc`),
    loadDeliveryPricing(),
    loadHermanas(op).catch(() => []),
    pagosParciales([op.id]).catch(() => ({})),
    sbFetch(`/invoices?operation_id=eq.${op.id}&status=eq.emitida&select=numero,punto_venta,fecha,importe,public_token&order=created_at.desc`).catch(() => ({ body: [] })),
  ]);

  const pkgs = Array.isArray(pkgsRes.body) ? pkgsRes.body : [];
  const bultos = pkgs.reduce((s, p) => s + Number(p.quantity || 1), 0);
  const tracking = pkgs.map(p => p.national_tracking).filter(Boolean);
  let pesoFacturable = 0;
  pkgs.forEach(p => {
    const q = Number(p.quantity || 1);
    const gw = Number(p.gross_weight_kg || 0) * q;
    const l = Number(p.length_cm || 0), w = Number(p.width_cm || 0), h = Number(p.height_cm || 0);
    const vol = l && w && h ? ((l * w * h) / 5000) * q : 0;
    pesoFacturable += Math.max(gw, vol);
  });

  const settings = Array.isArray(settingsRes.body) && settingsRes.body[0] ? settingsRes.body[0] : {};

  const client = op.clients || {};
  const match = matchLocality(client.city, client.province, localities);
  const price = match ? computeDeliveryCostUsd(match, cfg) : null;

  // Tarifa preferencial: la op la tiene cuando el flete que se le cobra no sale de la tarifa de
  // lista — sea por descuento manual, por tarifa custom del cliente, por volumen o por lo que sea.
  // Se compara el USD/kg efectivo contra el de lista vigente (effective_to null = version actual).
  // Si no se puede determinar la tarifa de lista, NO se marca: mejor no decir nada que afirmar de
  // mas en algo que ve el cliente.
  // Desglose impositivo POR PRODUCTO para la solapita del link. Misma descomposición que el
  // motor (certificación derivada del seguro guardado, prorrateo por FOB, desaduanaje por tabla).
  // Solo se devuelve si las lineas SUMAN el budget_taxes guardado (±0,05) — si no cuadra
  // (despacho real RI, antidumping, presupuesto manual raro), no se muestra y listo.
  let taxDetail = null;
  try {
    const items = (Array.isArray(itemsRes.body) ? itemsRes.body : []).filter((it) => Number(it.unit_price_usd) > 0);
    const bTaxes = Number(op.budget_taxes || 0);
    const bSeg = Number(op.budget_seguro || 0);
    const isAereoCh = String(op.channel || "").includes("aereo");
    const totFob = items.reduce((a, it) => a + Number(it.unit_price_usd) * Number(it.quantity || 1), 0);
    const certFl = bSeg * 100 - totFob;
    if (items.length > 0 && bTaxes > 0 && totFob > 0 && certFl > -0.01) {
      const cif = totFob + certFl + bSeg;
      const desembTabla = [[5, 0], [9, 36], [20, 50], [50, 58], [100, 65], [400, 72], [800, 84], [1000, 96], [Infinity, 120]];
      const getDes = (c) => { for (const [mx, amt] of desembTabla) if (c < mx) return amt; return 120; };
      const r2 = (v) => Math.round(v * 100) / 100;
      const pct1 = (v) => String(r2(v)).replace(".", ",");
      let suma = 0, desembTot = 0;
      const productos = items.map((it) => {
        const fob = Number(it.unit_price_usd) * Number(it.quantity || 1);
        const pct = fob / totFob;
        const iCif = fob + certFl * pct + (fob + certFl * pct) * 0.01;
        const dr = (it.import_duty_rate == null || it.import_duty_rate === "") ? 0 : Number(it.import_duty_rate) / 100;
        const te = (it.statistics_rate == null || it.statistics_rate === "") ? 0 : Number(it.statistics_rate) / 100;
        const ivaR = (it.iva_rate == null || it.iva_rate === "") ? 0.21 : Number(it.iva_rate) / 100;
        const die = iCif * dr, tasa = iCif * te, bi = iCif + die + tasa, iva = bi * ivaR;
        const rows = [];
        if (die > 0.005) rows.push([`Derechos importación (${pct1(dr * 100)}%)`, r2(die)]);
        if (tasa > 0.005) rows.push([`Tasa estadística (${pct1(te * 100)}%)`, r2(tasa)]);
        if (iva > 0.005) rows.push([`IVA de Importación (${pct1(ivaR * 100)}%)`, r2(iva)]);
        suma += die + tasa + iva;
        if (isAereoCh) { desembTot += getDes(cif) * pct; }
        else {
          const adR = (it.iva_additional_rate == null) ? 0.20 : Number(it.iva_additional_rate) / 100;
          const igR = (it.iigg_rate == null) ? 0.06 : Number(it.iigg_rate) / 100;
          const ibR = (it.iibb_rate == null) ? 0.05 : Number(it.iibb_rate) / 100;
          const ad = bi * adR, ig = bi * igR, ib = bi * ibR;
          if (ad > 0.005) rows.push([`IVA adicional (${pct1(adR * 100)}%)`, r2(ad)]);
          if (ig > 0.005) rows.push([`Ganancias IIGG (${pct1(igR * 100)}%)`, r2(ig)]);
          if (ib > 0.005) rows.push([`Ingresos brutos IIBB (${pct1(ibR * 100)}%)`, r2(ib)]);
          suma += ad + ig + ib;
        }
        return { name: it.description || "Producto", rows };
      });
      const extras = [];
      if (isAereoCh && desembTot > 0) {
        extras.push(["Desaduanaje", r2(desembTot)], ["IVA 21% sobre desaduanaje", r2(desembTot * 0.21)]);
        suma += desembTot + desembTot * 0.21;
      }
      if (Math.abs(suma - bTaxes) <= 0.05) taxDetail = { productos, extras };
    }
  } catch (e) { console.error("[GET entrega] taxDetail", e.message); }

  let preferential = null;
  try {
    const bFlete = Number(op.budget_flete || 0);
    if (bFlete > 0 && pesoFacturable > 0 && String(op.channel || "").includes("aereo")) {
      const svc = `aereo_a_${String(op.origin || "China").toLowerCase()}`;
      const tarRes = await sbFetch(`/tariffs?service_key=eq.${svc}&type=eq.rate&effective_to=is.null&select=min_qty,max_qty,rate`);
      const tar = Array.isArray(tarRes.body) ? tarRes.body : [];
      const bracket = tar.find((t) => pesoFacturable >= Number(t.min_qty || 0) && (t.max_qty == null || pesoFacturable < Number(t.max_qty)));
      if (bracket) {
        const listaKg = Number(bracket.rate || 0);
        const efectivoKg = bFlete / pesoFacturable;
        // Margen del 1% para no marcar como preferencial una diferencia de redondeo.
        if (listaKg > 0 && efectivoKg < listaKg * 0.99) {
          preferential = { usd_por_kg: Math.round(efectivoKg * 100) / 100, lista_usd_por_kg: listaKg };
        }
      }
    }
  } catch (e) { console.error("[GET entrega] preferential", e.message); }

  // Tipo de cambio blue automático (DolarAPI, sin key). Best-effort: si falla, el link
  // simplemente no muestra equivalentes en pesos.
  let tc = null;
  try {
    // Timeout corto: si DolarAPI esta lenta NO puede colgar la carga del link (paso 28/08:
    // 55 segundos de "Cargando..." por este fetch sin limite).
    const tcRes = await fetch("https://dolarapi.com/v1/dolares/blue", { next: { revalidate: 300 }, signal: AbortSignal.timeout(2500) });
    if (tcRes.ok) {
      const d = await tcRes.json();
      if (Number(d?.venta) > 0) tc = { venta: Number(d.venta), fuente: "Dólar blue (venta)", actualizado: d.fechaActualizacion || null };
    }
  } catch (e) { console.error("[GET entrega] tc", e.message); }

  return Response.json({
    tc,
    op: {
      operation_code: op.operation_code,
      description: op.description,
      channel: op.channel,
      origin: op.origin,
      status: op.status,
      budget_total: Number(op.budget_total || 0),
      budget_flete: Number(op.budget_flete || 0),
      budget_seguro: Number(op.budget_seguro || 0),
      budget_taxes: Number(op.budget_taxes || 0),
      // RI que abona los impuestos directo al despachante: no se le cobran a Argencargo,
      // asi que el desglose del retiro no debe listarlos (sino no cierra con budget_total).
      taxes_billed_by_argencargo: !(op.clients?.tax_condition === "responsable_inscripto") || !!op.ri_argencargo_collects_taxes,
      credit_applied_usd: Number(op.credit_applied_usd || 0),
      debt_applied_usd: Number(op.debt_applied_usd || 0),
      total_anticipos: Number(op.total_anticipos || 0),
      // "Cobrado efectivo": cobros parciales registrados (pisan al legacy) + descuento aplicado.
      // El front lo resta tal cual para el saldo — así el link muestra lo mismo que el panel.
      collected_amount: Math.round((collectedOf(op, pagosOp[op.id]) + Number(op.discount_applied_usd || 0)) * 100) / 100,
      delivery_choice: op.delivery_choice,
      delivery_zone: op.delivery_zone,
      delivery_address: op.delivery_address,
      payment_method_chosen: op.payment_method_chosen,
      delivery_confirmed_at: op.delivery_confirmed_at,
      delivery_day: op.delivery_day,
      delivery_slot: op.delivery_slot,
      payment_split: op.payment_split,
      delivery_group_id: op.delivery_group_id,
    },
    // Modo RI: la carga la entrega el courier en el domicilio — el link es solo pago+docs.
    modo_ri: esRiDirecta(op),
    facturas: (Array.isArray(factRes?.body) ? factRes.body : []).map((f) => ({
      numero: `${String(f.punto_venta).padStart(5, "0")}-${String(f.numero).padStart(8, "0")}`,
      fecha: f.fecha, importe: Number(f.importe), url: `/factura/${f.public_token}`,
    })),
    hermanas,
    client: { first_name: client.first_name, last_name: client.last_name, dni: client.dni || "", email: client.email || "", whatsapp: client.whatsapp || "", postal_code: client.postal_code || "", street: client.street || "", floor_apt: client.floor_apt || "", city: client.city || "" },
    tax_detail: taxDetail,
    cargo: { bultos, tracking, peso_facturable: Math.round(pesoFacturable * 100) / 100 },
    preferential,
    delivery: {
      inferred_zone: match ? match.name : null,
      price: price,
      default_address: fullAddress(client),
      office_address: settings.office_address || "",
      office_locality: settings.office_locality || "",
      office_hours: settings.office_hours || "",
    },
    payment: {
      titular: settings.payment_titular || "",
      alias: settings.payment_alias || "",
      crypto_wallet: settings.payment_crypto_wallet || "",
    },
  });
}

export async function POST(req, { params }) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  const { token } = await params;
  let body = null; try { body = await req.json(); } catch {}
  if (!body || !body.payment_method || (!body.delivery_choice && !body.modo_ri)) {
    return Response.json({ error: "Faltan datos: delivery_choice y payment_method" }, { status: 400 });
  }
  // ── Modo RI (entrega directa por courier): solo se registra la forma de pago ──
  if (body.modo_ri === true) {
    const opRi = await loadOpData(token);
    if (!opRi) return Response.json({ error: "No encontramos esta operación o el link expiró" }, { status: 404 });
    if (!esRiDirecta(opRi)) return Response.json({ error: "Esta operación no es de entrega directa" }, { status: 400 });
    if (!["efectivo", "transferencia", "crypto"].includes(body.payment_method)) return Response.json({ error: "Método de pago inválido" }, { status: 400 });
    const pagosRi = await pagosParciales([opRi.id]).catch(() => ({}));
    const saldoRi = Math.round(saldoOf(opRi, pagosRi[opRi.id]) * 100) / 100;
    const splitRi = [{ method: body.payment_method, amount: saldoRi }];
    await sbFetch(`/operations?id=eq.${opRi.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        payment_method_chosen: body.payment_method,
        payment_split: splitRi,
        delivery_choice: null, delivery_day: null, delivery_slot: null, delivery_cost_usd: 0,
        delivery_confirmed_at: new Date().toISOString(),
      }),
    });
    const PLri = { efectivo: "Efectivo", transferencia: "Transferencia en pesos", crypto: "Cripto (USDT)" };
    sbFetch(`/op_communications`, { method: "POST", body: JSON.stringify({ operation_id: opRi.id, type: "note", direction: "in", content: `✅ Cliente RI (entrega directa por courier) eligió forma de pago: ${PLri[body.payment_method]}\nSaldo: USD ${saldoRi.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }) }).catch(() => {});
    const [stgRi, tcRi] = await Promise.all([
      sbFetch(`/gi_settings?select=payment_crypto_wallet,payment_alias,payment_titular&limit=1`),
      fetch("https://dolarapi.com/v1/dolares/blue", { next: { revalidate: 300 }, signal: AbortSignal.timeout(2500) }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    const stg0 = Array.isArray(stgRi.body) && stgRi.body[0] ? stgRi.body[0] : {};
    return Response.json({
      ok: true, total: saldoRi,
      transfer: body.payment_method === "transferencia" ? { alias: stg0.payment_alias || "", titular: stg0.payment_titular || "" } : null,
      crypto_wallet: body.payment_method === "crypto" ? (stg0.payment_crypto_wallet || "") : null,
      tc_venta: Number(tcRi?.venta) > 0 ? Number(tcRi.venta) : null,
      delivery_choice: null, delivery_day: null, delivery_slot: null,
      payment_method: body.payment_method, payment_methods: splitRi,
      ops_incluidas: [opRi.operation_code],
    });
  }
  const { delivery_choice, delivery_address, payment_method, delivery_contact, carrier_mode, delivery_day, delivery_slot, cash_amount, cash_currency } = body;
  if (!["oficina", "propio", "carrier"].includes(delivery_choice)) return Response.json({ error: "Entrega inválida" }, { status: 400 });
  if (!["efectivo", "transferencia", "crypto"].includes(payment_method)) return Response.json({ error: "Método de pago inválido" }, { status: 400 });
  // Pago combinado: hasta 2 métodos con montos. Se valida acá y se recorta contra el total real más abajo.
  const payMethods = Array.isArray(body.payment_methods) ? body.payment_methods.filter((p) => p && ["efectivo", "transferencia", "crypto"].includes(p.method)) : null;
  if (payMethods && (payMethods.length < 1 || payMethods.length > 3)) return Response.json({ error: "Elegí entre una y tres formas de pago" }, { status: 400 });
  if (payMethods && new Set(payMethods.map((p) => p.method)).size !== payMethods.length) return Response.json({ error: "Formas de pago repetidas" }, { status: 400 });
  const usaEfectivo = payMethods ? payMethods.some((p) => p.method === "efectivo") : payment_method === "efectivo";
  if (usaEfectivo && delivery_choice === "carrier") {
    return Response.json({ error: "Efectivo no disponible para envíos con transportista externo" }, { status: 400 });
  }
  // Día y franja: obligatorios para oficina y fletero propio.
  if ((delivery_choice === "oficina" || delivery_choice === "propio")) {
    if (!delivery_day || !/^\d{4}-\d{2}-\d{2}$/.test(String(delivery_day))) return Response.json({ error: "Elegí el día" }, { status: 400 });
    if (!delivery_slot || String(delivery_slot).length > 30) return Response.json({ error: "Elegí la franja horaria" }, { status: 400 });
    const dow = new Date(delivery_day + "T12:00:00Z").getUTCDay();
    if (dow === 0 || dow === 6) return Response.json({ error: "Elegí un día hábil (lunes a viernes)" }, { status: 400 });
  }

  const op = await loadOpData(token);
  if (!op) return Response.json({ error: "No encontramos esta operación o el link expiró" }, { status: 404 });

  // Cargas hermanas seleccionadas para coordinar en la misma visita. Solo cuentan ids que
  // realmente sean cargas listas DEL MISMO CLIENTE — cualquier otra cosa se ignora.
  let extraOps = [];
  if (Array.isArray(body.extra_ops) && body.extra_ops.length > 0) {
    const ids = body.extra_ops.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)).slice(0, 20);
    if (ids.length > 0) {
      const exRes = await sbFetch(`/operations?id=in.(${ids.join(",")})&client_id=eq.${op.client_id}&delivery_completed_at=is.null&or=(status.eq.entregada,delivery_ready_at.not.is.null)&select=${HERMANA_SEL}`);
      extraOps = Array.isArray(exRes.body) ? exRes.body : [];
    }
  }

  // El costo de envío se calcula server-side a partir de la localidad REGISTRADA del cliente —
  // nunca se confía en una zona/monto mandado por el cliente.
  const { cfg, localities } = await loadDeliveryPricing();
  const client = op.clients || {};
  const match = matchLocality(client.city, client.province, localities);
  let deliveryCost = 0, deliveryZone = null;
  if (delivery_choice === "propio") {
    if (!match) return Response.json({ error: "No encontramos una zona de envío propio para tu localidad" }, { status: 400 });
    deliveryCost = computeDeliveryCostUsd(match, cfg);
    deliveryZone = match.name;
  }

  const bt = Number(op.budget_total || 0);
  // Cobros parciales de la op y de las hermanas seleccionadas — mismo saldo que muestra el GET.
  const pagosMap = await pagosParciales([op.id, ...extraOps.map((x) => x.id)]).catch(() => ({}));
  const saldo = saldoOf(op, pagosMap[op.id]);
  const finalTotal = Math.round((saldo + deliveryCost) * 100) / 100;
  // Reparto del pago: los montos se recalculan server-side contra el total real (el 2do metodo
  // absorbe el resto) — nunca se confia en montos que sumen otra cosa.
  let splitFinal = null;
  if (payMethods) {
    const cur = (p) => {
      if (p.method !== "efectivo" || !["USD", "ARS", "mixto"].includes(p.currency)) return {};
      const out = { currency: p.currency };
      if (p.currency === "mixto") {
        if (Number(p.usd_part) > 0) out.usd_part = Math.round(Number(p.usd_part) * 100) / 100;
        if (Number(p.ars_part) > 0) out.ars_part = Math.round(Number(p.ars_part));
      }
      return out;
    };
    if (payMethods.length === 1) {
      splitFinal = [{ method: payMethods[0].method, amount: finalTotal, ...cur(payMethods[0]) }];
    } else {
      // Todos menos el último con monto propio (validado); el último absorbe el resto.
      const editables = payMethods.slice(0, -1);
      for (const p of editables) if (!(Number(p.amount) > 0)) return Response.json({ error: "Completá cuánto pagás con cada método" }, { status: 400 });
      let suma = 0;
      splitFinal = editables.map((p) => { const m = Math.round(Number(p.amount) * 100) / 100; suma += m; return { method: p.method, amount: m, ...cur(p) }; });
      const resto = Math.round((finalTotal - suma) * 100) / 100;
      if (!(resto > 0)) return Response.json({ error: "Los montos superan el total a abonar" }, { status: 400 });
      const last = payMethods[payMethods.length - 1];
      splitFinal.push({ method: last.method, amount: resto, ...cur(last) });
    }
  }

  // El costo de envío a domicilio es parte de lo que el cliente debe pagar — se suma al
  // budget_total real de la op (no solo a un total mostrado ad-hoc) para que quede reflejado en
  // Presupuesto y Finanzas, Rentabilidad, cobros, etc. Solo se suma la primera vez que confirma
  // (si ya había confirmado antes, delivery_confirmed_at ya estaba seteado) para no duplicarlo
  // si el cliente reenvía el formulario.
  const alreadyConfirmed = !!op.delivery_confirmed_at;
  const newBudgetTotal = !alreadyConfirmed && deliveryCost > 0 ? Math.round((bt + deliveryCost) * 100) / 100 : bt;

  // Grupo de entrega: N ops que se retiran/reciben en la misma visita. El costo de envío va UNA
  // sola vez (en la op del token); cada op guarda su propio split con SU saldo — nada se fusiona.
  const groupId = extraOps.length > 0 ? crypto.randomUUID() : null;
  const extrasCalc = extraOps.map((x) => {
    const saldoX = Math.round(saldoOf(x, pagosMap[x.id]) * 100) / 100;
    const splitX = splitFinal && splitFinal[0]
      ? [{ method: splitFinal[0].method, amount: saldoX, ...(splitFinal[0].currency ? { currency: splitFinal[0].currency } : {}) }]
      : [{ method: payment_method, amount: saldoX }];
    return { op: x, saldo: saldoX, split: splitX };
  });
  const combinedTotal = Math.round((finalTotal + extrasCalc.reduce((a, e) => a + e.saldo, 0)) * 100) / 100;
  const nowIso = new Date().toISOString();
  const extraPatchesP = Promise.all(extrasCalc.map((e) => sbFetch(`/operations?id=eq.${e.op.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      delivery_choice,
      delivery_zone: delivery_choice === "propio" ? deliveryZone : null,
      delivery_address: delivery_choice === "propio" ? (delivery_address || null) : null,
      delivery_cost_usd: 0,
      payment_method_chosen: payment_method,
      delivery_contact: (delivery_choice === "carrier" || delivery_choice === "propio") ? (delivery_contact || null) : null,
      carrier_mode: delivery_choice === "carrier" ? (carrier_mode || null) : null,
      delivery_day: (delivery_choice === "oficina" || delivery_choice === "propio") ? delivery_day : null,
      delivery_slot: (delivery_choice === "oficina" || delivery_choice === "propio") ? delivery_slot : null,
      payment_split: e.split,
      delivery_group_id: groupId,
      delivery_confirmed_at: nowIso,
    }),
  }).catch((err) => console.error("[POST entrega] extra patch failed", e.op.operation_code, err.message))));

  const patchP = sbFetch(`/operations?id=eq.${op.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      delivery_group_id: groupId,
      delivery_choice,
      delivery_zone: delivery_choice === "propio" ? deliveryZone : null,
      delivery_address: delivery_choice === "propio" ? (delivery_address || null) : null,
      delivery_cost_usd: deliveryCost,
      budget_total: newBudgetTotal,
      payment_method_chosen: payment_method,
      // Solo para transportista: quien recibe, con el DNI que exige el despacho.
      delivery_contact: (delivery_choice === "carrier" || delivery_choice === "propio") ? (delivery_contact || null) : null,
      carrier_mode: delivery_choice === "carrier" ? (carrier_mode || null) : null,
      delivery_day: (delivery_choice === "oficina" || delivery_choice === "propio") ? delivery_day : null,
      delivery_slot: (delivery_choice === "oficina" || delivery_choice === "propio") ? delivery_slot : null,
      payment_split: splitFinal,
      cash_arrival_amount: usaEfectivo && Number(cash_amount) > 0 ? Number(cash_amount) : null,
      cash_arrival_currency: usaEfectivo && Number(cash_amount) > 0 ? (cash_currency === "ARS" ? "ARS" : "USD") : null,
      delivery_confirmed_at: new Date().toISOString(),
    }),
  });
  // Todo lo que sigue (nota, avisos, settings, TC) corre EN PARALELO con el PATCH para que
  // el "Confirmar" no acumule latencias en serie (la demora que se veia era esta suma).
  const settingsP = sbFetch(`/gi_settings?select=payment_crypto_wallet,payment_alias,payment_titular&limit=1`);
  const tcP = fetch("https://dolarapi.com/v1/dolares/blue", { next: { revalidate: 300 }, signal: AbortSignal.timeout(2500) }).then((r) => r.ok ? r.json() : null).catch(() => null);

  const deliveryLabel = delivery_choice === "oficina" ? "Retiro por oficina" : delivery_choice === "propio" ? `Envío a domicilio · ${deliveryZone}` : "Envío por transportista (Via Cargo/Andreani)";
  const PL = { efectivo: "Efectivo", transferencia: "Transferencia en pesos", crypto: "Cripto (USDT)" };
  const CUR_LBL = { USD: "en dólares", ARS: "en pesos", mixto: "USD + ARS" };
  const payLabel = splitFinal && splitFinal.length > 1
    ? splitFinal.map((p) => `${PL[p.method]}${p.currency ? ` ${CUR_LBL[p.currency]}` : ""} (USD ${p.amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`).join(" + ")
    : splitFinal && splitFinal[0]
      ? `${PL[splitFinal[0].method]}${splitFinal[0].currency ? ` ${CUR_LBL[splitFinal[0].currency]}` : ""}`
      : (PL[payment_method] || payment_method);
  const diaLabel = delivery_day ? new Date(delivery_day + "T12:00:00Z").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" }) : null;
  const opsIncluidas = [op.operation_code, ...extrasCalc.map((e) => e.op.operation_code)];
  const grupoTxt = extrasCalc.length > 0 ? `\n🔗 Se entrega junto con: ${extrasCalc.map((e) => e.op.operation_code).join(", ")} (total del grupo: USD ${combinedTotal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : "";
  const noteP = (async () => {
    await sbFetch(`/op_communications`, {
      method: "POST",
      body: JSON.stringify({
        operation_id: op.id,
        type: "note",
        direction: "in",
        content: `✅ Cliente confirmó carga lista.\nEntrega: ${deliveryLabel}${diaLabel ? `\nDía y franja: ${diaLabel} · ${delivery_slot}` : ""}${delivery_choice === "propio" ? `\nDirección: ${delivery_address || "(sin especificar)"}` : ""}\nPago: ${payLabel}${usaEfectivo && Number(cash_amount) > 0 ? `\n💵 Llega con ${cash_currency === "ARS" ? "ARS" : "USD"} ${Number(cash_amount).toLocaleString("es-AR")} — tener cambio listo` : ""}\nTotal: USD ${finalTotal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${grupoTxt}`,
      }),
    });
    await Promise.all(extrasCalc.map((e) => sbFetch(`/op_communications`, {
      method: "POST",
      body: JSON.stringify({
        operation_id: e.op.id,
        type: "note",
        direction: "in",
        content: `🔗 Coordinada junto con ${op.operation_code} (misma visita).\nEntrega: ${deliveryLabel}${diaLabel ? `\nDía y franja: ${diaLabel} · ${delivery_slot}` : ""}\nPago: ${payLabel}\nSaldo de esta op: USD ${e.saldo.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      }),
    }).catch(() => {})));
  })().catch((e) => console.error("[POST entrega] log failed", e.message));

  // Avisar al admin: el cliente completo la info de retiro. Antes esto no notificaba nada, asi que
  // el admin se enteraba solo si entraba a mirar el panel de Entregas. Best-effort: si el aviso
  // falla, la confirmacion del cliente ya quedo guardada arriba.
  const avisosP = (async () => {
    const admins = await sbFetch(`/profiles?role=eq.admin&select=id`);
    const ids = (Array.isArray(admins.body) ? admins.body : []).map((a) => a.id).filter(Boolean);
    const cliCode = client.client_code ? `${client.client_code} · ` : "";
    const title = `🚚 Retiro coordinado · ${opsIncluidas.join(" + ")}`;
    const body2 = `${cliCode}${deliveryLabel} · ${payLabel}${extrasCalc.length > 0 ? ` · ${opsIncluidas.length} ops juntas` : ""}`;
    await Promise.all(ids.flatMap((id) => [
      sbFetch(`/notifications`, { method: "POST", body: JSON.stringify({ user_id: id, portal: "admin", title, body: body2, link: "/admin" }) }).catch(() => {}),
      fetch(`${BASE_URL}/api/push/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: id, portal: "admin", title, body: body2, url: "/admin" }) }).catch(() => {}),
    ]));
  })().catch((e) => console.error("[POST entrega] aviso admin failed", e.message));

  const [, , , , settingsRes, tcJson] = await Promise.all([patchP, extraPatchesP, noteP, avisosP, settingsP, tcP]);
  const stg = Array.isArray(settingsRes.body) && settingsRes.body[0] ? settingsRes.body[0] : {};
  const wallet = stg.payment_crypto_wallet || "";
  const tcVenta = Number(tcJson?.venta) > 0 ? Number(tcJson.venta) : 0;

  const anyCrypto = splitFinal ? splitFinal.some((p) => p.method === "crypto") : payment_method === "crypto";
  const anyTransfer = splitFinal ? splitFinal.some((p) => p.method === "transferencia") : payment_method === "transferencia";

  // Confirmación por WhatsApp con el detalle de lo coordinado (plantilla fija, sin IA).
  // Best-effort: si Meta no está configurado o falla, la coordinación ya quedó guardada.
  try {
    const { sendWaTemplate, waConfigured } = await import("../../../../lib/wa");
    if (waConfigured() && client.whatsapp) {
      const combinedTot = Math.round((finalTotal + extrasCalc.reduce((a, e) => a + e.saldo, 0)) * 100) / 100;
      const fmtU = (v) => `USD ${v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const tcV = Number(tcJson?.venta) > 0 ? Number(tcJson.venta) : 0;
      const cuando = (delivery_choice === "carrier")
        ? "Va por transportista — te avisamos apenas se despache"
        : `${delivery_choice === "oficina" ? "Te esperamos" : "Te la llevamos"} el ${diaLabel} de ${delivery_slot}`;
      const enPesos = payment_method === "transferencia" || (payment_method === "efectivo" && splitFinal?.[0]?.currency === "ARS");
      const totalTxt = enPesos && tcV > 0 ? `ARS ${Math.round(combinedTot * tcV).toLocaleString("es-AR")} (${fmtU(combinedTot)})` : fmtU(combinedTot);
      let pagoTxt;
      if (payment_method === "transferencia") {
        const stg2 = Array.isArray(settingsRes.body) && settingsRes.body[0] ? settingsRes.body[0] : {};
        pagoTxt = `Pagás por transferencia en pesos${stg2.payment_alias ? ` — alias: ${stg2.payment_alias}${stg2.payment_titular ? `, titular: ${stg2.payment_titular}` : ""}` : ""}. Apenas transfieras, mandanos el comprobante por acá 🙏`;
      } else if (payment_method === "crypto") {
        const stg3 = Array.isArray(settingsRes.body) && settingsRes.body[0] ? settingsRes.body[0] : {};
        pagoTxt = `Pagás en USDT — IMPORTANTE: red TRC-20.${stg3.payment_crypto_wallet ? ` Billetera: ${stg3.payment_crypto_wallet}` : " La billetera está en el link de tu carga."}`;
      } else {
        pagoTxt = `Pagás en efectivo${splitFinal?.[0]?.currency === "ARS" ? " en pesos" : splitFinal?.[0]?.currency === "mixto" ? " (USD + ARS)" : " en dólares"} al momento de la entrega${usaEfectivo && Number(cash_amount) > 0 ? ` — te esperamos con el cambio listo` : ""}.`;
      }
      // Una sola carga → con su descripción ("Mazos de cartas (AC-0121)"); grupo → los códigos.
      const cargaTxt = opsIncluidas.length === 1 && op.description ? `${op.description} (${op.operation_code})` : opsIncluidas.join(" + ");
      await sendWaTemplate(client.whatsapp, "coordinacion_confirmada", [
        client.first_name || "Hola", cargaTxt, cuando, totalTxt, pagoTxt,
      ]);
    }
  } catch (e) { console.error("[POST entrega] wa confirm failed", e.message); }
  // Para el resumen del cliente: con grupo, el split que se muestra lleva el total COMBINADO
  // (lo que efectivamente paga en la visita) — los splits por op ya quedaron guardados arriba.
  const splitDisplay = splitFinal && splitFinal.length === 1 && extrasCalc.length > 0
    ? [{ ...splitFinal[0], amount: combinedTotal }]
    : splitFinal;
  return Response.json({
    transfer: anyTransfer ? { alias: stg.payment_alias || "", titular: stg.payment_titular || "" } : null,
    tc_venta: tcVenta || null,
    ok: true,
    total: combinedTotal,
    ops_incluidas: opsIncluidas,
    delivery_choice,
    delivery_zone: deliveryZone,
    delivery_day: (delivery_choice === "oficina" || delivery_choice === "propio") ? delivery_day : null,
    delivery_slot: (delivery_choice === "oficina" || delivery_choice === "propio") ? delivery_slot : null,
    payment_method,
    payment_methods: splitDisplay,
    crypto_wallet: anyCrypto ? wallet : null,
  });
}
