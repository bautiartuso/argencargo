// UPS Tracking API v1
// Docs: https://developer.ups.com/api/reference/tracking/v1
// Env vars: UPS_CLIENT_ID, UPS_CLIENT_SECRET
// Sandbox: wwwcie.ups.com; Producción: onlinetools.ups.com

const UPS_HOST = process.env.UPS_HOST || "https://onlinetools.ups.com";

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

export async function POST(req) {
  try {
    const { trackingNumber } = await req.json();
    if (!trackingNumber) return Response.json({ error: "trackingNumber requerido" }, { status: 400 });

    const token = await getUpsToken();
    const r = await fetch(`${UPS_HOST}/api/track/v1/details/${encodeURIComponent(trackingNumber)}?locale=es_AR`, {
      headers: { Authorization: `Bearer ${token}`, transId: `ac_${Date.now()}`, transactionSrc: "argencargo" }
    });
    if (!r.ok) {
      const txt = await r.text();
      return Response.json({ error: `UPS ${r.status}: ${txt.slice(0, 300)}` }, { status: r.status });
    }
    const data = await r.json();
    const pkg = data.trackResponse?.shipment?.[0]?.package?.[0];
    if (!pkg) return Response.json({ events: [], status: "not_found" });

    const events = (pkg.activity || []).map(a => {
      const d = a.date || ""; // yyyymmdd
      const t = a.time || ""; // hhmmss
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
    return Response.json({ events, status: pkg.currentStatus?.description || "ok", trackingNumber, eta });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}
