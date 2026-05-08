// GET  /api/cotizacion/[token] → datos de la cotización GI para el cliente
// POST /api/cotizacion/[token] → cliente acepta (con channel + delivery seleccionados)

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;

const sbFetch = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...init,
    headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const txt = await r.text();
  let parsed = null; try { parsed = JSON.parse(txt); } catch {}
  return { status: r.status, body: parsed };
};

export async function GET(req, { params }) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  const { token } = await params;
  if (!token) return Response.json({ error: "Token requerido" }, { status: 400 });

  // Cotización + productos + cliente + tarifas + settings
  const qRes = await sbFetch(`/gi_quotes?public_token=eq.${encodeURIComponent(token)}&select=*,gi_quote_requests(request_code,client_id,clients(first_name,last_name,client_code)),gi_quote_products(*)`);
  if (qRes.status >= 400 || !Array.isArray(qRes.body) || qRes.body.length === 0) {
    return Response.json({ error: "Cotización no encontrada o expirada" }, { status: 404 });
  }
  const quote = qRes.body[0];
  // Si ya fue aceptada/convertida, mostrar sólo info read-only
  // Si está en draft, igual mostrar
  // Si expirada → mensaje
  if (quote.expires_at && new Date(quote.expires_at) < new Date() && quote.status !== "accepted" && quote.status !== "converted") {
    // No bloqueamos pero marcamos
  }

  const [ratesRes, settingsRes] = await Promise.all([
    sbFetch(`/gi_shipping_rates?select=*&order=display_order.asc`),
    sbFetch(`/gi_settings?select=*&limit=1`),
  ]);

  return Response.json({
    quote,
    rates: Array.isArray(ratesRes.body) ? ratesRes.body : [],
    settings: Array.isArray(settingsRes.body) && settingsRes.body[0] ? settingsRes.body[0] : null,
  });
}

export async function POST(req, { params }) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  const { token } = await params;
  let body = null; try { body = await req.json(); } catch {}
  if (!body || !body.channel || !body.delivery_zone) {
    return Response.json({ error: "Faltan datos: channel y delivery_zone" }, { status: 400 });
  }
  const validChannels = ["aereo_negro", "aereo_blanco", "maritimo_negro", "maritimo_blanco"];
  if (!validChannels.includes(body.channel)) return Response.json({ error: "Canal inválido" }, { status: 400 });

  // Buscar cotización
  const qRes = await sbFetch(`/gi_quotes?public_token=eq.${encodeURIComponent(token)}&select=*,gi_quote_requests(client_id),gi_quote_products(*)`);
  if (qRes.status >= 400 || !Array.isArray(qRes.body) || qRes.body.length === 0) {
    return Response.json({ error: "Cotización no encontrada" }, { status: 404 });
  }
  const quote = qRes.body[0];
  if (quote.status === "accepted" || quote.status === "converted") {
    return Response.json({ error: "Esta cotización ya fue aceptada", already: true }, { status: 409 });
  }

  // Calcular el total elegido
  const totalKey = {
    aereo_negro: "cost_courier_total_usd",
    aereo_blanco: "cost_aereo_int_total_usd",
    maritimo_negro: "cost_maritimo_lcl_total_usd",
    maritimo_blanco: "cost_maritimo_int_total_usd",
  }[body.channel];
  const channelTotal = Number(quote[totalKey] || 0);

  // Costo entrega: 0 si oficina, sino buscar tarifa
  let deliveryCost = 0;
  if (body.delivery_zone !== "oficina") {
    const ratesRes = await sbFetch(`/gi_shipping_rates?zone=eq.${encodeURIComponent(body.delivery_zone)}&select=*&order=display_order.asc&limit=1`);
    if (Array.isArray(ratesRes.body) && ratesRes.body[0]) deliveryCost = Number(ratesRes.body[0].cost_usd || 0);
  }
  const finalTotal = channelTotal + deliveryCost;

  // 1. Crear operación AC-XXXX
  const clientId = quote.gi_quote_requests?.client_id;
  if (!clientId) return Response.json({ error: "Cliente no asociado a la cotización" }, { status: 500 });

  // Generar código AC-XXXX
  const codeRes = await sbFetch(`/rpc/next_operation_code`, { method: "POST", body: JSON.stringify({}) });
  const opCode = (typeof codeRes.body === "string") ? codeRes.body : (codeRes.body?.[0] || `AC-${Date.now()}`);

  const opBody = {
    operation_code: opCode,
    client_id: clientId,
    channel: body.channel,
    origin: "China", // por defecto, se ajusta abajo si hay productos USA
    description: `Gestión Integral · ${quote.gi_quote_products?.length || 0} productos`,
    service_type: "gestion_integral",
    status: "en_preparacion",
    budget_total: finalTotal,
    is_collected: false,
    shipping_to_door: body.delivery_zone !== "oficina",
    shipping_cost: deliveryCost,
  };
  // Si hay producto USA, ajustar origin
  const someUSA = (quote.gi_quote_products || []).some(p => p.origin === "usa");
  if (someUSA) opBody.origin = "USA";

  const opRes = await sbFetch(`/operations?select=*`, { method: "POST", body: JSON.stringify(opBody), headers: { Prefer: "return=representation" } });
  if (opRes.status >= 400 || !Array.isArray(opRes.body) || opRes.body.length === 0) {
    console.error("[POST cotizacion] op create failed", opRes);
    return Response.json({ error: "No se pudo crear la operación" }, { status: 500 });
  }
  const opId = opRes.body[0].id;

  // 2. Crear operation_items a partir de gi_quote_products
  for (const p of (quote.gi_quote_products || [])) {
    await sbFetch(`/operation_items`, {
      method: "POST",
      body: JSON.stringify({
        operation_id: opId,
        description: p.description,
        quantity: p.quantity,
        unit_price_usd: p.unit_cost_usd,
        ncm_code: p.ncm_code,
        import_duty_rate: p.ncm_di_pct,
        statistics_rate: p.ncm_estad_pct,
        iva_rate: p.ncm_iva_pct,
      }),
    });
  }

  // 3. Update quote como aceptada + linkear op
  await sbFetch(`/gi_quotes?id=eq.${quote.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "converted",
      selected_channel: body.channel,
      selected_delivery_zone: body.delivery_zone,
      selected_delivery_cost_usd: deliveryCost,
      accepted_at: new Date().toISOString(),
      operation_id: opId,
    }),
  });

  // 4. Update request status
  await sbFetch(`/gi_quote_requests?id=eq.${quote.request_id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "converted" }),
  });

  return Response.json({ ok: true, operation_code: opCode, operation_id: opId, total: finalTotal });
}
