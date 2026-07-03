// GET  /api/entrega/[token] → datos de la operación para la pantalla pública de "carga lista"
// POST /api/entrega/[token] → cliente confirma envío/retiro + método de pago

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;

const sbFetch = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...init,
    headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) },
  });
  const txt = await r.text();
  let parsed = null; try { parsed = JSON.parse(txt); } catch {}
  return { status: r.status, body: parsed };
};

// Misma heurística que /cotizacion/[token]: infiere zona de reparto propio a partir de la
// localidad/provincia registrada del cliente. Si no matchea ninguna, se ofrece transportista externo.
function inferZone(city, province) {
  const txt = `${city || ""} ${province || ""}`.toLowerCase();
  if (!txt.trim()) return null;
  if (/\bcaba\b|capital federal|ciudad aut[oó]noma/.test(txt)) return "CABA";
  if (/buenos aires|gba|provincia/.test(txt)) {
    if (/(san isidro|vicente l[oó]pez|tigre|pilar|escobar|martinez|olivos|nordelta|beccar|acassuso|san fernando|del viso)/.test(txt)) return "GBA Norte";
    if (/(lomas|quilmes|avellaneda|berazategui|lan[uú]s|florencio varela|adrogu[eé])/.test(txt)) return "GBA Sur";
    if (/(mor[oó]n|matanza|merlo|moreno|ituzaing[oó]|hurlingham|ramos mej[ií]a|haedo|caseros)/.test(txt)) return "GBA Oeste";
  }
  return null;
}

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

function fullAddress(c) {
  const parts = [c.street, c.floor_apt].filter(Boolean).join(", ");
  return [parts, c.city].filter(Boolean).join(", ");
}

async function loadOpData(token) {
  const opRes = await sbFetch(`/operations?delivery_public_token=eq.${encodeURIComponent(token)}&select=*,clients(first_name,last_name,client_code,street,floor_apt,postal_code,city,province)&limit=1`);
  if (opRes.status >= 400 || !Array.isArray(opRes.body) || opRes.body.length === 0) return null;
  return opRes.body[0];
}

export async function GET(req, { params }) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  const { token } = await params;
  if (!token) return Response.json({ error: "Token requerido" }, { status: 400 });

  const op = await loadOpData(token);
  if (!op) return Response.json({ error: "No encontramos esta operación o el link expiró" }, { status: 404 });

  const [pkgsRes, configRes, settingsRes] = await Promise.all([
    sbFetch(`/operation_packages?operation_id=eq.${op.id}&select=package_number,quantity,gross_weight_kg,length_cm,width_cm,height_cm,national_tracking&order=package_number.asc`),
    sbFetch(`/calc_config?key=in.(delivery_price_caba,delivery_price_amba)&select=key,value`),
    sbFetch(`/gi_settings?select=office_address,office_locality,office_hours,office_phone,payment_titular,payment_alias,payment_crypto_wallet&limit=1`),
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

  const configMap = {};
  (Array.isArray(configRes.body) ? configRes.body : []).forEach(r => { configMap[r.key] = Number(r.value); });
  const settings = Array.isArray(settingsRes.body) && settingsRes.body[0] ? settingsRes.body[0] : {};

  const client = op.clients || {};
  const inferredZone = inferZone(client.city, client.province);

  return Response.json({
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
      credit_applied_usd: Number(op.credit_applied_usd || 0),
      debt_applied_usd: Number(op.debt_applied_usd || 0),
      total_anticipos: Number(op.total_anticipos || 0),
      collected_amount: usdCollected(op),
      delivery_choice: op.delivery_choice,
      delivery_zone: op.delivery_zone,
      delivery_address: op.delivery_address,
      payment_method_chosen: op.payment_method_chosen,
      delivery_confirmed_at: op.delivery_confirmed_at,
    },
    client: { first_name: client.first_name, last_name: client.last_name },
    cargo: { bultos, tracking, peso_facturable: Math.round(pesoFacturable * 100) / 100 },
    delivery: {
      inferred_zone: inferredZone,
      default_address: fullAddress(client),
      price_caba: configMap.delivery_price_caba ?? 20,
      price_amba: configMap.delivery_price_amba ?? 30,
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
  if (!body || !body.delivery_choice || !body.payment_method) {
    return Response.json({ error: "Faltan datos: delivery_choice y payment_method" }, { status: 400 });
  }
  const { delivery_choice, delivery_zone, delivery_address, payment_method } = body;
  if (!["oficina", "propio", "carrier"].includes(delivery_choice)) return Response.json({ error: "Entrega inválida" }, { status: 400 });
  if (!["efectivo", "transferencia", "crypto"].includes(payment_method)) return Response.json({ error: "Método de pago inválido" }, { status: 400 });
  if (payment_method === "efectivo" && delivery_choice === "carrier") {
    return Response.json({ error: "Efectivo no disponible para envíos con transportista externo" }, { status: 400 });
  }

  const op = await loadOpData(token);
  if (!op) return Response.json({ error: "No encontramos esta operación o el link expiró" }, { status: 404 });

  const configRes = await sbFetch(`/calc_config?key=in.(delivery_price_caba,delivery_price_amba)&select=key,value`);
  const configMap = {};
  (Array.isArray(configRes.body) ? configRes.body : []).forEach(r => { configMap[r.key] = Number(r.value); });

  // El costo de envío se calcula server-side — nunca se confía en un monto mandado por el cliente.
  let deliveryCost = 0;
  if (delivery_choice === "propio") {
    if (delivery_zone === "CABA") deliveryCost = configMap.delivery_price_caba ?? 20;
    else if (["GBA Norte", "GBA Sur", "GBA Oeste"].includes(delivery_zone)) deliveryCost = configMap.delivery_price_amba ?? 30;
    else return Response.json({ error: "Zona inválida" }, { status: 400 });
  }

  const bt = Number(op.budget_total || 0);
  const debtApp = Number(op.debt_applied_usd || 0);
  const creditApp = Number(op.credit_applied_usd || 0);
  const totAnt = Number(op.total_anticipos || 0);
  const collected = usdCollected(op);
  const saldo = Math.max(0, bt + debtApp - totAnt - collected - creditApp);
  const finalTotal = Math.round((saldo + deliveryCost) * 100) / 100;

  // El costo de envío a domicilio es parte de lo que el cliente debe pagar — se suma al
  // budget_total real de la op (no solo a un total mostrado ad-hoc) para que quede reflejado en
  // Presupuesto y Finanzas, Rentabilidad, cobros, etc. Solo se suma la primera vez que confirma
  // (si ya había confirmado antes, delivery_confirmed_at ya estaba seteado) para no duplicarlo
  // si el cliente reenvía el formulario.
  const alreadyConfirmed = !!op.delivery_confirmed_at;
  const newBudgetTotal = !alreadyConfirmed && deliveryCost > 0 ? Math.round((bt + deliveryCost) * 100) / 100 : bt;

  await sbFetch(`/operations?id=eq.${op.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      delivery_choice,
      delivery_zone: delivery_choice === "propio" ? delivery_zone : null,
      delivery_address: delivery_choice === "propio" ? (delivery_address || null) : null,
      delivery_cost_usd: deliveryCost,
      budget_total: newBudgetTotal,
      payment_method_chosen: payment_method,
      delivery_confirmed_at: new Date().toISOString(),
    }),
  });

  const deliveryLabel = delivery_choice === "oficina" ? "Retiro por oficina" : delivery_choice === "propio" ? `Envío a domicilio · ${delivery_zone}` : "Envío por transportista (Via Cargo/Andreani)";
  const payLabel = payment_method === "efectivo" ? "Efectivo" : payment_method === "transferencia" ? "Transferencia en pesos" : "Cripto (USDT)";
  try {
    await sbFetch(`/op_communications`, {
      method: "POST",
      body: JSON.stringify({
        operation_id: op.id,
        type: "note",
        direction: "in",
        content: `✅ Cliente confirmó carga lista.\nEntrega: ${deliveryLabel}${delivery_choice === "propio" ? `\nDirección: ${delivery_address || "(sin especificar)"}` : ""}\nPago: ${payLabel}\nTotal: USD ${finalTotal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      }),
    });
  } catch (e) { console.error("[POST entrega] log failed", e.message); }

  const settingsRes = await sbFetch(`/gi_settings?select=payment_crypto_wallet&limit=1`);
  const wallet = Array.isArray(settingsRes.body) && settingsRes.body[0] ? settingsRes.body[0].payment_crypto_wallet : "";

  return Response.json({
    ok: true,
    total: finalTotal,
    delivery_choice,
    delivery_zone: delivery_choice === "propio" ? delivery_zone : null,
    payment_method,
    crypto_wallet: payment_method === "crypto" ? wallet : null,
  });
}
