// GET  /api/cotizacion/[token] → cotización GI para el cliente (con sesión iniciada)
// POST /api/cotizacion/[token] → { action: "accept", channel, delivery_zone } | { action: "reject", reason }
//
// Desde 13/10/2026 el link NO es público: hay que iniciar sesión con la cuenta del cliente de la
// cotización (o ser admin/empleado/socio asignado, que la ven sin poder aceptar). Así queda
// registrado quién aceptó o rechazó. Tampoco viajan costos internos: ni costo unitario del
// proveedor, ni costos reales, ni honorarios. A cada producto se le manda solo su "peso" (parte
// del FOB total) para prorratear el precio final.
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

const sbFetch = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...init,
    headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const txt = await r.text();
  let parsed = null; try { parsed = JSON.parse(txt); } catch {}
  return { status: r.status, body: parsed };
};

const CHANNEL_KEYS = {
  aereo_blanco: "cost_aereo_int_total_usd",
  maritimo_negro: "cost_maritimo_lcl_total_usd",
  maritimo_blanco: "cost_maritimo_int_total_usd",
};

const cargarCotizacion = async (token) => {
  const q = await sbFetch(`/gi_quotes?public_token=eq.${encodeURIComponent(token)}&select=*,gi_quote_requests(request_code,client_id,assigned_partner_id,clients(id,auth_user_id,first_name,last_name,email,city,province,gi_partner_id)),gi_quote_products(*)`);
  return Array.isArray(q.body) && q.body[0] ? q.body[0] : null;
};

// Quién está mirando: "cliente" (dueño de la cotización), "staff" (admin/empleado/socio asignado),
// o null (otra cuenta).
const quienMira = async (req, quote) => {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return { user: null, rol: null };
  const user = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!user?.id) return { user: null, rol: null };
  const cl = quote.gi_quote_requests?.clients || {};
  if (cl.auth_user_id && cl.auth_user_id === user.id) return { user, rol: "cliente" };
  const p = await sbFetch(`/profiles?id=eq.${user.id}&select=role,is_gi_partner&limit=1`);
  const prof = Array.isArray(p.body) ? p.body[0] : null;
  if (["admin", "empleado"].includes(prof?.role)) return { user, rol: "staff" };
  if (prof?.is_gi_partner && (quote.gi_quote_requests?.assigned_partner_id === user.id || cl.gi_partner_id === user.id)) return { user, rol: "staff" };
  return { user, rol: null };
};

const cargaDe = (prods) => {
  let kg = 0, cbm = 0;
  for (const p of prods) {
    const n = Number(p.pkg_count || 0);
    kg += Number(p.pkg_weight_kg || 0) * n;
    cbm += (Number(p.pkg_length_cm || 0) * Number(p.pkg_width_cm || 0) * Number(p.pkg_height_cm || 0)) / 1e6 * n;
  }
  return { kg, cbm };
};

const vencida = (q) => q.expires_at && new Date(q.expires_at) < new Date() && !["accepted", "converted", "rejected"].includes(q.status);

// Hasta que se corra migrations/2026_10_13_gi_cotizacion_login.sql las columnas nuevas no existen:
// si el PATCH falla por eso, se reintenta sin ellas.
const NUEVAS = ["responded_by", "rejected_at", "reject_reason"];
const patchQuote = async (filtro, data) => {
  const ops = { method: "PATCH", headers: { Prefer: "return=representation" } };
  let r = await sbFetch(`/gi_quotes?${filtro}`, { ...ops, body: JSON.stringify(data) });
  if (r.status >= 400 && NUEVAS.some((c) => JSON.stringify(r.body || "").includes(c))) {
    const limpio = Object.fromEntries(Object.entries(data).filter(([k]) => !NUEVAS.includes(k)));
    r = await sbFetch(`/gi_quotes?${filtro}`, { ...ops, body: JSON.stringify(limpio) });
  }
  return r;
};

const registrar = (quote, type, meta) => sbFetch(`/gi_quote_communications`, {
  method: "POST",
  body: JSON.stringify({ quote_id: quote.id, request_id: quote.request_id, type, meta }),
}).catch(() => {});

export async function GET(req, { params }) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  const { token } = await params;
  const quote = token ? await cargarCotizacion(token) : null;
  if (!quote) return Response.json({ error: "Cotización no encontrada" }, { status: 404 });
  const cl = quote.gi_quote_requests?.clients || {};

  const { user, rol } = await quienMira(req, quote);
  if (!user) {
    // Sin sesión: solo lo mínimo para armar la pantalla de ingreso.
    return Response.json({
      login: true,
      nombre: cl.first_name || "",
      codigo: quote.gi_quote_requests?.request_code || "",
      tiene_cuenta: !!cl.auth_user_id,
    }, { status: 401 });
  }
  if (!rol) {
    return Response.json({ otra_cuenta: true, nombre: cl.first_name || "", email: user.email || "" }, { status: 403 });
  }

  const [ratesRes, settingsRes] = await Promise.all([
    sbFetch(`/gi_shipping_rates?select=zone,max_kg,max_cbm,cost_usd&order=display_order.asc`),
    sbFetch(`/gi_settings?select=office_address,office_locality,office_hours,office_phone,terms_and_conditions&limit=1`),
  ]);

  // Vista del cliente: se registra como máximo una vez cada 30 min.
  if (rol === "cliente" && !["accepted", "converted", "rejected"].includes(quote.status)) {
    try {
      const recent = await sbFetch(`/gi_quote_communications?quote_id=eq.${quote.id}&type=eq.link_viewed&select=created_at&order=created_at.desc&limit=1`);
      const last = Array.isArray(recent.body) && recent.body[0] ? new Date(recent.body[0].created_at) : null;
      if (!last || (Date.now() - last.getTime()) / 60000 > 30) {
        await registrar(quote, "link_viewed", { user_id: user.id, email: user.email || null, ua: req.headers.get("user-agent") || null });
      }
    } catch {}
  }

  const prods = (quote.gi_quote_products || []).slice().sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  const fobTotal = prods.reduce((s, p) => s + Number(p.unit_cost_usd || 0) * Number(p.quantity || 0), 0);
  const { kg, cbm } = cargaDe(prods);
  const productos = prods.map((p) => {
    const fob = Number(p.unit_cost_usd || 0) * Number(p.quantity || 0);
    return {
      id: p.id, description: p.description, quantity: p.quantity, photo_url: p.photo_url,
      lead_time_days: p.lead_time_days, origin: p.origin, display_order: p.display_order,
      peso: fobTotal > 0 ? fob / fobTotal : 1 / Math.max(prods.length, 1),
    };
  });

  return Response.json({
    rol,
    vencida: vencida(quote),
    quote: {
      id: quote.id, status: quote.status, expires_at: quote.expires_at, sent_at: quote.sent_at, created_at: quote.created_at,
      payment_plan: quote.payment_plan, delivery_zone: quote.delivery_zone,
      selected_channel: quote.selected_channel, selected_delivery_zone: quote.selected_delivery_zone,
      selected_delivery_cost_usd: quote.selected_delivery_cost_usd, accepted_at: quote.accepted_at,
      cost_aereo_int_total_usd: quote.cost_aereo_int_total_usd,
      cost_maritimo_lcl_total_usd: quote.cost_maritimo_lcl_total_usd,
      cost_maritimo_int_total_usd: quote.cost_maritimo_int_total_usd,
      request_code: quote.gi_quote_requests?.request_code || "",
      client: { first_name: cl.first_name, last_name: cl.last_name, city: cl.city, province: cl.province },
    },
    productos,
    carga: { kg, cbm },
    rates: Array.isArray(ratesRes.body) ? ratesRes.body : [],
    settings: Array.isArray(settingsRes.body) && settingsRes.body[0] ? settingsRes.body[0] : null,
  });
}

export async function POST(req, { params }) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  const { token } = await params;
  let body = null; try { body = await req.json(); } catch {}
  const quote = token ? await cargarCotizacion(token) : null;
  if (!quote) return Response.json({ error: "Cotización no encontrada" }, { status: 404 });

  const { user, rol } = await quienMira(req, quote);
  if (!user) return Response.json({ error: "Iniciá sesión para responder la cotización" }, { status: 401 });
  if (rol !== "cliente") return Response.json({ error: "Solo el cliente puede responder la cotización" }, { status: 403 });
  if (["accepted", "converted"].includes(quote.status)) return Response.json({ error: "Esta cotización ya fue aceptada", already: true }, { status: 409 });
  if (quote.status === "rejected") return Response.json({ error: "Esta cotización ya fue rechazada" }, { status: 409 });
  if (vencida(quote)) return Response.json({ error: "La cotización está vencida. Pedinos una actualizada." }, { status: 410 });

  const quien = { user_id: user.id, email: user.email || null };

  if (body?.action === "reject") {
    const reason = String(body.reason || "").trim().slice(0, 500) || null;
    const r = await patchQuote(`id=eq.${quote.id}`, { status: "rejected", rejected_at: new Date().toISOString(), reject_reason: reason, responded_by: user.id });
    if (r.status >= 400) return Response.json({ error: "No se pudo registrar la respuesta" }, { status: 500 });
    await sbFetch(`/gi_quote_requests?id=eq.${quote.request_id}`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) });
    await registrar(quote, "rejected", { ...quien, reason });
    return Response.json({ ok: true, rejected: true });
  }

  if (!body?.channel || !CHANNEL_KEYS[body.channel]) return Response.json({ error: "Elegí un servicio" }, { status: 400 });
  const channelTotal = Number(quote[CHANNEL_KEYS[body.channel]] || 0);
  if (!(channelTotal > 0)) return Response.json({ error: "Ese servicio no está disponible en esta cotización" }, { status: 400 });
  const zone = String(body.delivery_zone || "oficina");

  let deliveryCost = 0;
  if (zone !== "oficina" && zone !== "interior_coordinar") {
    // Mismo criterio que la pantalla: el tramo más barato de la zona que banca el peso y volumen.
    const ratesRes = await sbFetch(`/gi_shipping_rates?zone=eq.${encodeURIComponent(zone)}&select=cost_usd,max_kg,max_cbm`);
    const tiers = (Array.isArray(ratesRes.body) ? ratesRes.body : []).filter((t) => Number(t.cost_usd) > 0).sort((a, b) => Number(a.cost_usd) - Number(b.cost_usd));
    if (!tiers.length) return Response.json({ error: "Zona de entrega inválida" }, { status: 400 });
    const { kg, cbm } = cargaDe(quote.gi_quote_products || []);
    const t = tiers.find((x) => kg <= Number(x.max_kg || Infinity) && cbm <= Number(x.max_cbm || Infinity)) || tiers[tiers.length - 1];
    deliveryCost = Number(t.cost_usd || 0);
  }
  const finalTotal = channelTotal + deliveryCost;

  // Se acepta con un PATCH condicionado al estado: si se toca dos veces, el segundo no hace nada.
  const r = await patchQuote(`id=eq.${quote.id}&status=in.(draft,sent)`, {
    status: "accepted", selected_channel: body.channel, selected_delivery_zone: zone,
    selected_delivery_cost_usd: deliveryCost, accepted_at: new Date().toISOString(), responded_by: user.id,
  });
  if (r.status >= 400) return Response.json({ error: "No se pudo registrar la aceptación" }, { status: 500 });
  if (!Array.isArray(r.body) || !r.body.length) return Response.json({ error: "Esta cotización ya fue respondida", already: true }, { status: 409 });
  await sbFetch(`/gi_quote_requests?id=eq.${quote.request_id}`, { method: "PATCH", body: JSON.stringify({ status: "accepted" }) });
  await registrar(quote, "accepted", { ...quien, channel: body.channel, delivery_zone: zone, total: finalTotal });

  // Aviso al admin (campana + push), sin bloquear la respuesta.
  try {
    const admins = await sbFetch(`/profiles?role=eq.admin&select=id`);
    const cl = quote.gi_quote_requests?.clients || {};
    const title = `✅ Cotización ${quote.gi_quote_requests?.request_code || ""} aceptada`;
    const bodyTxt = `${`${cl.first_name || ""} ${cl.last_name || ""}`.trim()} · USD ${finalTotal.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
    for (const a of (Array.isArray(admins.body) ? admins.body : [])) {
      await sbFetch(`/notifications`, { method: "POST", body: JSON.stringify({ user_id: a.id, portal: "admin", title, body: bodyTxt, link: "/gi" }) });
    }
  } catch {}

  return Response.json({ ok: true, total: finalTotal, channel: body.channel, delivery_zone: zone });
}
