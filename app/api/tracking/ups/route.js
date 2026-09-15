// UPS Tracking API v1 — thin wrapper sobre lib/tracking/carriers.js
// Docs: https://developer.ups.com/api/reference/tracking/v1
// Env vars: UPS_CLIENT_ID, UPS_CLIENT_SECRET

import { getUpsTracking } from "../../../../lib/tracking/carriers";
import { limitar } from "../../../../lib/ratelimit";

export async function POST(req) {
  // Endpoint público (lo usa el tracking sin login): freno para que no nos quemen la cuota.
  const frenado = limitar(req, { clave: "tracking-ups", limite: 20, ventanaMs: 60_000 });
  if (frenado) return frenado;
  const { trackingNumber } = await req.json();
  const result = await getUpsTracking(trackingNumber);
  if (result.error) return Response.json(result, { status: 500 });
  return Response.json(result);
}
