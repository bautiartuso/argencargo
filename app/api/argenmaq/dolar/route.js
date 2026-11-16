// GET /api/argenmaq/dolar — dólar blue (venta) + 5 pesos, regla de Bautista para mostrar los precios en
// pesos en ARGENMAQ (informativo: el anticipo se paga al TC del día). Desde el 16/11/2026 toma la
// cotización más reciente entre dos fuentes (lib/dolar.js) y se renueva cada 5 minutos.
import { blueCrudo } from "../../../../lib/dolar";
export const revalidate = 300;
export async function GET() {
  try {
    const d = await blueCrudo({ next: { revalidate: 300 } });
    const venta = Number(d?.venta || 0);
    if (!venta) throw new Error("sin cotización");
    return Response.json({ tc: venta + 5, blue: venta, actualizado: d.fechaActualizacion || null }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (e) {
    return Response.json({ tc: null, error: e.message }, { status: 200 });
  }
}
