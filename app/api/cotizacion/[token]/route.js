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
  const qRes = await sbFetch(`/gi_quotes?public_token=eq.${encodeURIComponent(token)}&select=*,gi_quote_requests(request_code,client_id,clients(first_name,last_name,client_code,city,province)),gi_quote_products(*)`);
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

  // Log "link_viewed" — pero solo si la cotización aún no fue aceptada y la última vista del mismo
  // public_token fue hace más de 30 minutos (anti-spam de refresh).
  if (quote.status !== "accepted" && quote.status !== "converted") {
    try {
      const recent = await sbFetch(`/gi_quote_communications?quote_id=eq.${quote.id}&type=eq.link_viewed&select=created_at&order=created_at.desc&limit=1`);
      const last = Array.isArray(recent.body) && recent.body[0] ? new Date(recent.body[0].created_at) : null;
      const minutesSince = last ? (Date.now() - last.getTime()) / 60000 : Infinity;
      if (minutesSince > 30) {
        const ua = req.headers.get("user-agent") || null;
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
        await sbFetch(`/gi_quote_communications`, {
          method: "POST",
          body: JSON.stringify({
            quote_id: quote.id,
            request_id: quote.request_id,
            type: "link_viewed",
            meta: { ua, ip },
          }),
        });
      }
    } catch (e) { console.error("[GET cotizacion] log view failed", e.message); }
  }

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
  const validChannels = ["aereo_blanco", "maritimo_negro", "maritimo_blanco"];
  if (!validChannels.includes(body.channel)) return Response.json({ error: "Canal inválido" }, { status: 400 });

  // Buscar cotización
  const qRes = await sbFetch(`/gi_quotes?public_token=eq.${encodeURIComponent(token)}&select=*,gi_quote_products(*)`);
  if (qRes.status >= 400 || !Array.isArray(qRes.body) || qRes.body.length === 0) {
    return Response.json({ error: "Cotización no encontrada" }, { status: 404 });
  }
  const quote = qRes.body[0];
  if (quote.status === "accepted" || quote.status === "converted") {
    return Response.json({ error: "Esta cotización ya fue aceptada", already: true }, { status: 409 });
  }

  // Calcular el total elegido
  const totalKey = {
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

  // NO crear operación todavía. Solo marcar cotización como "accepted".
  // El admin debe revisar y convertirla manualmente desde el panel GI (con review de productos, links Alibaba, etc).
  await sbFetch(`/gi_quotes?id=eq.${quote.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "accepted",
      selected_channel: body.channel,
      selected_delivery_zone: body.delivery_zone,
      selected_delivery_cost_usd: deliveryCost,
      accepted_at: new Date().toISOString(),
    }),
  });

  // Update request status → accepted (no aún converted)
  await sbFetch(`/gi_quote_requests?id=eq.${quote.request_id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "accepted" }),
  });

  // Log evento "accepted"
  try {
    await sbFetch(`/gi_quote_communications`, {
      method: "POST",
      body: JSON.stringify({
        quote_id: quote.id,
        request_id: quote.request_id,
        type: "accepted",
        meta: { channel: body.channel, delivery_zone: body.delivery_zone, total: finalTotal },
      }),
    });
  } catch (e) { console.error("[POST cotizacion] log accept failed", e.message); }

  return Response.json({
    ok: true,
    total: finalTotal,
    channel: body.channel,
    delivery_zone: body.delivery_zone,
    payment_plan: quote.payment_plan || null,
    pending_conversion: true,
  });
}
