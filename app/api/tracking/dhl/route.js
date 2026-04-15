// DHL Express Tracking API
// Docs: https://developer.dhl.com/api-reference/shipment-tracking
// Env var requerida: DHL_API_KEY

import { normalizeEvent } from "../_helpers";

export async function POST(req) {
  const { trackingNumber } = await req.json();
  const apiKey = process.env.DHL_API_KEY;
  if (!apiKey) return Response.json({ error: "DHL_API_KEY no configurada" }, { status: 500 });
  if (!trackingNumber) return Response.json({ error: "trackingNumber requerido" }, { status: 400 });

  const r = await fetch(`https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}`, {
    headers: { "DHL-API-Key": apiKey, Accept: "application/json" }
  });
  if (!r.ok) {
    const txt = await r.text();
    return Response.json({ error: `DHL ${r.status}: ${txt.slice(0, 300)}` }, { status: r.status });
  }
  const data = await r.json();
  const shipment = data.shipments?.[0];
  if (!shipment) return Response.json({ events: [], status: "not_found" });

  const events = (shipment.events || []).map(e => ({
    external_id: `dhl_${trackingNumber}_${e.timestamp}_${(e.statusCode || e.status || "").slice(0, 20)}`,
    title: e.status || e.description || "Actualización DHL",
    description: e.description || null,
    location: e.location?.address?.addressLocality || null,
    occurred_at: e.timestamp,
    status_code: e.statusCode || null
  }));

  return Response.json({ events, status: shipment.status?.status || shipment.status?.statusCode || "ok", trackingNumber });
}
