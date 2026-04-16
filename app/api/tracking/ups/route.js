// UPS Tracking API v1 — thin wrapper sobre lib/tracking/carriers.js
// Docs: https://developer.ups.com/api/reference/tracking/v1
// Env vars: UPS_CLIENT_ID, UPS_CLIENT_SECRET

import { getUpsTracking } from "../../../../lib/tracking/carriers";

export async function POST(req) {
  const { trackingNumber } = await req.json();
  const result = await getUpsTracking(trackingNumber);
  if (result.error) return Response.json(result, { status: 500 });
  return Response.json(result);
}
