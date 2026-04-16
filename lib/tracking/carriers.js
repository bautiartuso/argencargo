// Funciones de tracking de carriers (FedEx / DHL / UPS).
// Mantenemos la lógica acá para poder llamarla desde:
//   - Los route handlers (/api/tracking/{carrier}/route.js) → HTTP
//   - El orquestador (/api/tracking/sync/route.js) → directo, sin doble hop HTTP

const FEDEX_HOST = process.env.FEDEX_HOST || "https://apis.fedex.com";
const UPS_HOST = process.env.UPS_HOST || "https://onlinetools.ups.com";

// ---------- Disponibilidad ----------
export function fedexConfigured() {
  return !!(process.env.FEDEX_CLIENT_ID && process.env.FEDEX_CLIENT_SECRET);
}
export function upsConfigured() {
  return !!(process.env.UPS_CLIENT_ID && process.env.UPS_CLIENT_SECRET);
}
export function dhlConfigured() {
  return !!process.env.DHL_API_KEY;
}

// ---------- FedEx ----------
async function getFedexToken() {
  const clientId = process.env.FEDEX_CLIENT_ID;
  const clientSecret = process.env.FEDEX_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("FEDEX_CLIENT_ID / FEDEX_CLIENT_SECRET no configuradas");
  const r = await fetch(`${FEDEX_HOST}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret })
  });
  if (!r.ok) throw new Error(`FedEx token ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.access_token;
}

export async function getFedexTracking(trackingNumber) {
  if (!trackingNumber) return { error: "trackingNumber requerido" };
  try {
    const token = await getFedexToken();
    const r = await fetch(`${FEDEX_HOST}/track/v1/trackingnumbers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-locale": "es_AR" },
      body: JSON.stringify({
        includeDetailedScans: true,
        trackingInfo: [{ trackingNumberInfo: { trackingNumber } }]
      })
    });
    if (!r.ok) {
      const txt = await r.text();
      return { error: `FedEx ${r.status}: ${txt.slice(0, 300)}` };
    }
    const data = await r.json();
    const track = data.output?.completeTrackResults?.[0]?.trackResults?.[0];
    if (!track) return { events: [], status: "not_found" };

    const events = (track.scanEvents || []).map(e => ({
      external_id: `fedex_${trackingNumber}_${e.date}_${(e.eventType || "").slice(0, 20)}`,
      title: e.eventDescription || e.eventType || "Actualización FedEx",
      description: e.exceptionDescription || null,
      location: [e.scanLocation?.city, e.scanLocation?.stateOrProvinceCode, e.scanLocation?.countryCode].filter(Boolean).join(", ") || null,
      occurred_at: e.date,
      status_code: e.eventType || null
    }));

    const dt = track.dateAndTimes || [];
    const estDelivery = dt.find(x => x.type === "ESTIMATED_DELIVERY")?.dateTime;
    const eta = estDelivery
      || track.estimatedDeliveryTimeWindow?.window?.ends
      || track.estimatedDeliveryTimeWindow?.window?.begins
      || track.standardTransitTimeWindow?.window?.ends
      || null;
    const actualDelivery = dt.find(x => x.type === "ACTUAL_DELIVERY")?.dateTime || null;

    return { events, status: track.latestStatusDetail?.description || "ok", trackingNumber, eta, actualDelivery };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

// ---------- UPS ----------
async function getUpsToken() {
  const clientId = process.env.UPS_CLIENT_ID;
  const clientSecret = process.env.UPS_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("UPS_CLIENT_ID / UPS_CLIENT_SECRET no configuradas");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const r = await fetch(`${UPS_HOST}/security/v1/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", "x-merchant-id": clientId },
    body: "grant_type=client_credentials"
  });
  if (!r.ok) throw new Error(`UPS token ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.access_token;
}

export async function getUpsTracking(trackingNumber) {
  if (!trackingNumber) return { error: "trackingNumber requerido" };
  try {
    const token = await getUpsToken();
    const r = await fetch(`${UPS_HOST}/api/track/v1/details/${encodeURIComponent(trackingNumber)}?locale=es_AR`, {
      headers: { Authorization: `Bearer ${token}`, transId: `ac_${Date.now()}`, transactionSrc: "argencargo" }
    });
    if (!r.ok) {
      const txt = await r.text();
      return { error: `UPS ${r.status}: ${txt.slice(0, 300)}` };
    }
    const data = await r.json();
    const pkg = data.trackResponse?.shipment?.[0]?.package?.[0];
    if (!pkg) return { events: [], status: "not_found" };

    const events = (pkg.activity || []).map(a => {
      const d = a.date || "";
      const t = a.time || "";
      const iso = d.length === 8 && t.length === 6
        ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}Z`
        : new Date().toISOString();
      return {
        external_id: `ups_${trackingNumber}_${d}${t}_${(a.status?.code || "").slice(0, 10)}`,
        title: a.status?.description || "Actualización UPS",
        description: a.status?.statusCode || null,
        location: [a.location?.address?.city, a.location?.address?.stateProvince, a.location?.address?.country].filter(Boolean).join(", ") || null,
        occurred_at: iso,
        status_code: a.status?.code || null
      };
    });

    const ed = pkg.deliveryDate?.find?.(d => d.type === "RDD")?.date || pkg.deliveryDate?.[0]?.date;
    const eta = ed && ed.length === 8 ? `${ed.slice(0,4)}-${ed.slice(4,6)}-${ed.slice(6,8)}` : null;
    return { events, status: pkg.currentStatus?.description || "ok", trackingNumber, eta };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

// ---------- DHL ----------
export async function getDhlTracking(trackingNumber) {
  if (!trackingNumber) return { error: "trackingNumber requerido" };
  const apiKey = process.env.DHL_API_KEY;
  if (!apiKey) return { error: "DHL_API_KEY no configurada" };

  try {
    const r = await fetch(`https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}`, {
      headers: { "DHL-API-Key": apiKey, Accept: "application/json" }
    });
    if (!r.ok) {
      const txt = await r.text();
      return { error: `DHL ${r.status}: ${txt.slice(0, 300)}` };
    }
    const data = await r.json();
    const shipment = data.shipments?.[0];
    if (!shipment) return { events: [], status: "not_found" };

    const events = (shipment.events || []).map(e => ({
      external_id: `dhl_${trackingNumber}_${e.timestamp}_${(e.statusCode || e.status || "").slice(0, 20)}`,
      title: e.status || e.description || "Actualización DHL",
      description: e.description || null,
      location: e.location?.address?.addressLocality || null,
      occurred_at: e.timestamp,
      status_code: e.statusCode || null
    }));

    const eta = shipment.estimatedTimeOfDelivery || shipment.estimatedDeliveryTime || null;
    return { events, status: shipment.status?.status || shipment.status?.statusCode || "ok", trackingNumber, eta };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}
