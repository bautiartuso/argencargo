// DHL Express Tracking API — thin wrapper sobre lib/tracking/carriers.js
// Docs: https://developer.dhl.com/api-reference/shipment-tracking
// Env var requerida: DHL_API_KEY

import { getDhlTracking } from "../../../../lib/tracking/carriers";
import { limitar } from "../../../../lib/ratelimit";

export async function POST(req) {
  // Endpoint público (lo usa el tracking sin login): freno para que no nos quemen la cuota.
  const frenado = limitar(req, { clave: "tracking-dhl", limite: 20, ventanaMs: 60_000 });
  if (frenado) return frenado;
  const { trackingNumber } = await req.json();
  const result = await getDhlTracking(trackingNumber);
  if (result.error) return Response.json(result, { status: 500 });
  return Response.json(result);
}
