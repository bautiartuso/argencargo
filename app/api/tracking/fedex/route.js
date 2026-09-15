// FedEx Track API v1 — thin wrapper sobre lib/tracking/carriers.js
// Docs: https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html
// Env vars: FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET

import { getFedexTracking } from "../../../../lib/tracking/carriers";
import { limitar } from "../../../../lib/ratelimit";

export async function POST(req) {
  // Endpoint público (lo usa el tracking sin login): freno para que no nos quemen la cuota.
  const frenado = limitar(req, { clave: "tracking-fedex", limite: 20, ventanaMs: 60_000 });
  if (frenado) return frenado;
  const { trackingNumber } = await req.json();
  const result = await getFedexTracking(trackingNumber);
  if (result.error) return Response.json(result, { status: 500 });
  return Response.json(result);
}
