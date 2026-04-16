// DHL Express Tracking API — thin wrapper sobre lib/tracking/carriers.js
// Docs: https://developer.dhl.com/api-reference/shipment-tracking
// Env var requerida: DHL_API_KEY

import { getDhlTracking } from "../../../../lib/tracking/carriers";

export async function POST(req) {
  const { trackingNumber } = await req.json();
  const result = await getDhlTracking(trackingNumber);
  if (result.error) return Response.json(result, { status: 500 });
  return Response.json(result);
}
