// GET /api/argenmaq/dolar — dólar blue (venta) + 5 pesos, regla de Bautista para mostrar los precios en
// pesos en ARGENMAQ (informativo: el anticipo se paga al TC del día). Desde el 16/11/2026 toma la
// cotización más reciente entre dos fuentes (lib/dolar.js) y se renueva cada 5 minutos.
import { blueCrudo } from "../../../../lib/dolar";
// 25/11/2026: sin caché de Next ni "stale-while-revalidate" (devolvían la cotización vieja en la primera consulta).
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const d = await blueCrudo();
    const venta = Number(d?.venta || 0);
    if (!venta) throw new Error("sin cotización");
    return Response.json({ tc: venta + 5, blue: venta, actualizado: d.fechaActualizacion || null }, { headers: { "Cache-Control": "public, s-maxage=300" } });
  } catch (e) {
    return Response.json({ tc: null, error: e.message }, { status: 200 });
  }
}
