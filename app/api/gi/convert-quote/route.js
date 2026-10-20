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

const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

export async function POST(req) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  // Solo admin/empleado o el socio dueño del pedido (antes no pedía sesión: cualquiera con el id convertía).
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const user = tok ? await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
  if (!user?.id) return Response.json({ error: "Iniciá sesión" }, { status: 401 });
  const profR = await sbFetch(`/profiles?id=eq.${user.id}&select=role,is_gi_partner`);
  const prof = Array.isArray(profR.body) ? profR.body[0] : null;
  const esStaff = ["admin", "empleado"].includes(prof?.role);
  if (!esStaff && !prof?.is_gi_partner) return Response.json({ error: "Sin permiso" }, { status: 403 });

  let body = null; try { body = await req.json(); } catch {}
  if (!body?.quote_id || !/^[0-9a-f-]{36}$/i.test(String(body.quote_id))) return Response.json({ error: "quote_id requerido" }, { status: 400 });

  const qRes = await sbFetch(`/gi_quotes?id=eq.${body.quote_id}&select=*,gi_quote_requests(client_id,assigned_partner_id,origin,clients(gi_partner_id,gi_commission_pct)),gi_quote_products(*),gi_quote_packages(*)`);
  if (qRes.status >= 400 || !Array.isArray(qRes.body) || qRes.body.length === 0) {
    return Response.json({ error: "Cotización no encontrada" }, { status: 404 });
  }
  const quote = qRes.body[0];
  const req0 = quote.gi_quote_requests || {};
  const partnerId = req0.assigned_partner_id || req0.clients?.gi_partner_id || null;
  if (!esStaff && partnerId !== user.id) return Response.json({ error: "Sin permiso" }, { status: 403 });
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
    aereo_blanco: "cost_aereo_int_total_usd",
    maritimo_negro: "cost_maritimo_lcl_total_usd",
    maritimo_blanco: "cost_maritimo_int_total_usd",
  }[quote.selected_channel];
  const channelTotal = Number(quote[totalKey] || 0);
  const deliveryCost = Number(quote.selected_delivery_cost_usd || 0);
  const finalTotal = channelTotal + deliveryCost;

  const clientId = req0.client_id;
  if (!clientId) return Response.json({ error: "Cliente no asociado a la cotización" }, { status: 500 });

  // Traba: pasa a "converting" solo si sigue "accepted". Un doble toque no crea dos operaciones.
  const lock = await sbFetch(`/gi_quotes?id=eq.${quote.id}&status=eq.accepted`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "converting" }) });
  // (si falla con error es el CHECK viejo de estado, antes de la migración del 13/10: sigue sin traba)
  const trabado = lock.status < 400;
  if (trabado && (!Array.isArray(lock.body) || !lock.body.length)) return Response.json({ error: "Ya se está convirtiendo" }, { status: 409 });
  const soltar = () => trabado ? sbFetch(`/gi_quotes?id=eq.${quote.id}`, { method: "PATCH", body: JSON.stringify({ status: "accepted" }) }) : null;

  // Comisión del socio: la de la ficha del cliente si tiene una propia; si no, la del socio.
  let commissionPct = Number(req0.clients?.gi_commission_pct || 0) || null;
  if (partnerId && !commissionPct) {
    const pp = await sbFetch(`/profiles?id=eq.${partnerId}&select=gi_partner_pct`);
    commissionPct = Number(Array.isArray(pp.body) && pp.body[0]?.gi_partner_pct || 0) || null;
  }

  // Generar código AC-XXXX
  const codeRes = await sbFetch(`/rpc/next_operation_code`, { method: "POST", body: JSON.stringify({}) });
  const opCode = (typeof codeRes.body === "string") ? codeRes.body : (codeRes.body?.[0] || `AC-${Date.now()}`);

  const someUSA = req0.origin === "usa" || (quote.gi_quote_products || []).some(p => p.origin === "usa");
  // Costo total al proveedor = SUM(unit_cost × qty) de los productos cotizados.
  // Este queda guardado en operations.cost_producto_usd para tracking de ganancia neta.
  const supplierTotal = (quote.gi_quote_products || []).reduce((s, p) =>
    s + Number(p.unit_cost_usd || 0) * Number(p.quantity || 1), 0);
  const opBody = {
    operation_code: opCode,
    client_id: clientId,
    channel: quote.selected_channel,
    origin: someUSA ? "USA" : "China",
    description: `Gestión Integral · ${quote.gi_quote_products?.length || 0} productos`,
    service_type: "gestion_integral",
    // GI arranca en "pendiente" (PROVEEDOR) — no tiene etapa de documentación porque la cotización ya cierra esa parte.
    status: "pendiente",
    budget_total: finalTotal,
    // Modo manual para que el trigger sync_gi_budget_total no pise el precio acordado con la suma de items.
    // Los items se guardan con unit_price_usd = precio cliente (ya prorrateado al final), pero por seguridad fijamos el total.
    budget_mode: "manual",
    cost_producto_usd: supplierTotal,
    gi_partner_id: partnerId,
    gi_commission_pct: partnerId ? commissionPct : null,
    gi_admin_owned: !partnerId,
    is_collected: false,
    shipping_to_door: quote.selected_delivery_zone && quote.selected_delivery_zone !== "oficina",
    shipping_cost: deliveryCost,
  };

  const opRes = await sbFetch(`/operations?select=*`, { method: "POST", body: JSON.stringify(opBody), headers: { Prefer: "return=representation" } });
  if (opRes.status >= 400 || !Array.isArray(opRes.body) || opRes.body.length === 0) {
    console.error("[convert-quote] op create failed", opRes);
    await soltar();
    return Response.json({ error: "No se pudo crear la operación" }, { status: 500 });
  }
  const opId = opRes.body[0].id;

  // operation_items desde gi_quote_products.
  // Para GI, unit_price_usd debe representar el PRECIO CLIENTE (no el costo del proveedor),
  // así el subtotal de productos coincide con el total acordado del canal seleccionado.
  // Prorrateamos linealmente: unit_price_cliente = unit_cost × (finalTotal / supplierTotal)
  const multiplier = supplierTotal > 0 ? (finalTotal / supplierTotal) : 1;
  for (const p of (quote.gi_quote_products || [])) {
    const unitCost = Number(p.unit_cost_usd || 0);
    const clientUnitPrice = Math.round(unitCost * multiplier * 10000) / 10000; // 4 decimales para mantener total exacto
    await sbFetch(`/operation_items`, {
      method: "POST",
      body: JSON.stringify({
        operation_id: opId,
        description: p.description,
        quantity: p.quantity,
        unit_price_usd: clientUnitPrice,
        ncm_code: p.ncm_code,
        import_duty_rate: p.ncm_di_pct,
        statistics_rate: p.ncm_estad_pct,
        iva_rate: p.ncm_iva_pct,
      }),
    });
  }

  // operation_packages desde los bultos anotados en la cotización (pkg_* de cada producto).
  // Sin esto, la op nace sin bultos y la tarjeta "Bultos" del panel GI queda vacía.
  // Desde el 20/10/2026 los bultos son de la cotización (gi_quote_packages); las viejas los tienen por producto.
  const bultos = (quote.gi_quote_packages || []).length
    ? quote.gi_quote_packages.slice().sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map((k) => ({ cnt: Number(k.pkg_count || 0), l: k.length_cm, w: k.width_cm, h: k.height_cm, kg: k.weight_kg }))
    : (quote.gi_quote_products || []).map((p) => ({ cnt: Number(p.pkg_count || 0), l: p.pkg_length_cm, w: p.pkg_width_cm, h: p.pkg_height_cm, kg: p.pkg_weight_kg }));
  let pkgNum = 0;
  for (const k of bultos) {
    if (k.cnt <= 0) continue;
    pkgNum++;
    await sbFetch(`/operation_packages`, {
      method: "POST",
      body: JSON.stringify({ operation_id: opId, package_number: pkgNum, quantity: k.cnt, length_cm: k.l ?? null, width_cm: k.w ?? null, height_cm: k.h ?? null, gross_weight_kg: k.kg ?? null }),
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
