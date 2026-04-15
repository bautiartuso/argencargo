// FedEx Track API v1
// Docs: https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html
// Env vars: FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET
// Sandbox: cambiar apis-sandbox.fedex.com; Producción: apis.fedex.com

const FEDEX_HOST = process.env.FEDEX_HOST || "https://apis.fedex.com";

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

export async function POST(req) {
  try {
    const { trackingNumber } = await req.json();
    if (!trackingNumber) return Response.json({ error: "trackingNumber requerido" }, { status: 400 });

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
      return Response.json({ error: `FedEx ${r.status}: ${txt.slice(0, 300)}` }, { status: r.status });
    }
    const data = await r.json();
    const track = data.output?.completeTrackResults?.[0]?.trackResults?.[0];
    if (!track) return Response.json({ events: [], status: "not_found" });

    const events = (track.scanEvents || []).map(e => ({
      external_id: `fedex_${trackingNumber}_${e.date}_${(e.eventType || "").slice(0, 20)}`,
      title: e.eventDescription || e.eventType || "Actualización FedEx",
      description: e.exceptionDescription || null,
      location: [e.scanLocation?.city, e.scanLocation?.stateOrProvinceCode, e.scanLocation?.countryCode].filter(Boolean).join(", ") || null,
      occurred_at: e.date,
      status_code: e.eventType || null
    }));

    // ETA: prioridad 1) ESTIMATED_DELIVERY en dateAndTimes, 2) estimatedDeliveryTimeWindow, 3) standardTransitTimeWindow
    const dt = track.dateAndTimes || [];
    const estDelivery = dt.find(x => x.type === "ESTIMATED_DELIVERY")?.dateTime;
    const eta = estDelivery
      || track.estimatedDeliveryTimeWindow?.window?.ends
      || track.estimatedDeliveryTimeWindow?.window?.begins
      || track.standardTransitTimeWindow?.window?.ends
      || null;
    const actualDelivery = dt.find(x => x.type === "ACTUAL_DELIVERY")?.dateTime || null;

    return Response.json({ events, status: track.latestStatusDetail?.description || "ok", trackingNumber, eta, actualDelivery });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}
