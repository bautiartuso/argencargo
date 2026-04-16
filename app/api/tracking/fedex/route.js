// FedEx Track API v1 — thin wrapper sobre lib/tracking/carriers.js
// Docs: https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html
// Env vars: FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET

import { getFedexTracking } from "../../../../lib/tracking/carriers";

export async function POST(req) {
  const { trackingNumber } = await req.json();
  const result = await getFedexTracking(trackingNumber);
  if (result.error) return Response.json(result, { status: 500 });
  return Response.json(result);
}
