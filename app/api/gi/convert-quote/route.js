// POST /api/gi/convert-quote
// Convierte una gi_quote con status='accepted' en una operación AC-XXXX.
// Solo lo dispara el admin desde el panel GI después de revisar la cotización.
// Body: { quote_id: uuid }

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

export async function POST(req) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  let body = null; try { body = await req.json(); } catch {}
  if (!body?.quote_id) return Response.json({ error: "quote_id requerido" }, { status: 400 });

  const qRes = await sbFetch(`/gi_quotes?id=eq.${body.quote_id}&select=*,gi_quote_requests(client_id,assigned_partner_id,profiles!assigned_partner_id(gi_partner_pct)),gi_quote_products(*)`);
  if (qRes.status >= 400 || !Array.isArray(qRes.body) || qRes.body.length === 0) {
    return Response.json({ error: "Cotización no encontrada" }, { status: 404 });
  }
  const quote = qRes.body[0];
  if (quote.status === "converted" && quote.operation_id) {
    return Response.json({ error: "Ya está convertida en operación", operation_id: quote.operation_id }, { status: 409 });
  }
  if (quote.status !== "accepted") {
    return Response.json({ error: "La cotización tiene que estar 'aceptada' para convertir" }, { status: 400 });
  }
  if (!quote.selected_channel) {
    return Response.json({ error: "La cotización no tiene canal seleccionado" }, { status: 400 });
  }

  const totalKey = {
    aereo_negro: "cost_courier_total_usd",
    aereo_blanco: "cost_aereo_int_total_usd",
    maritimo_negro: "cost_maritimo_lcl_total_usd",
    maritimo_blanco: "cost_maritimo_int_total_usd",
  }[quote.selected_channel];
  const channelTotal = Number(quote[totalKey] || 0);
  const deliveryCost = Number(quote.selected_delivery_cost_usd || 0);
  const finalTotal = channelTotal + deliveryCost;

  const clientId = quote.gi_quote_requests?.client_id;
  if (!clientId) return Response.json({ error: "Cliente no asociado a la cotización" }, { status: 500 });

  // Generar código AC-XXXX
  const codeRes = await sbFetch(`/rpc/next_operation_code`, { method: "POST", body: JSON.stringify({}) });
  const opCode = (typeof codeRes.body === "string") ? codeRes.body : (codeRes.body?.[0] || `AC-${Date.now()}`);

  const someUSA = (quote.gi_quote_products || []).some(p => p.origin === "usa");
  const opBody = {
    operation_code: opCode,
    client_id: clientId,
    channel: quote.selected_channel,
    origin: someUSA ? "USA" : "China",
    description: `Gestión Integral · ${quote.gi_quote_products?.length || 0} productos`,
    service_type: "gestion_integral",
    status: "en_preparacion",
    budget_total: finalTotal,
    gi_partner_id: quote.gi_quote_requests?.assigned_partner_id || null,
    gi_commission_pct: Number(quote.gi_quote_requests?.profiles?.gi_partner_pct || 0) || null,
    gi_admin_owned: false,
    is_collected: false,
    shipping_to_door: quote.selected_delivery_zone && quote.selected_delivery_zone !== "oficina",
    shipping_cost: deliveryCost,
  };

  const opRes = await sbFetch(`/operations?select=*`, { method: "POST", body: JSON.stringify(opBody), headers: { Prefer: "return=representation" } });
  if (opRes.status >= 400 || !Array.isArray(opRes.body) || opRes.body.length === 0) {
    console.error("[convert-quote] op create failed", opRes);
    return Response.json({ error: "No se pudo crear la operación" }, { status: 500 });
  }
  const opId = opRes.body[0].id;

  // operation_items desde gi_quote_products
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

  // Update quote como converted
  await sbFetch(`/gi_quotes?id=eq.${quote.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "converted", operation_id: opId }),
  });
  await sbFetch(`/gi_quote_requests?id=eq.${quote.request_id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "converted" }),
  });

  // Log
  try {
    await sbFetch(`/gi_quote_communications`, {
      method: "POST",
      body: JSON.stringify({
        quote_id: quote.id,
        request_id: quote.request_id,
        type: "converted",
        meta: { operation_code: opCode, operation_id: opId },
      }),
    });
  } catch (e) { console.error("[convert-quote] log failed", e.message); }

  return Response.json({ ok: true, operation_code: opCode, operation_id: opId });
}
