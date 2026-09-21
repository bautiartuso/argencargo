// GET /api/argenmaq/dolar — dólar blue (venta) de dolarapi.com + 5 pesos, regla de Bautista para
// mostrar los precios en pesos en ARGENMAQ (informativo: el anticipo se paga al TC del día).
export const revalidate = 600;
export async function GET() {
  try {
    const r = await fetch("https://dolarapi.com/v1/dolares/blue", { next: { revalidate: 600 } });
    const d = await r.json();
    const venta = Number(d?.venta || 0);
    if (!venta) throw new Error("sin cotización");
    return Response.json({ tc: venta + 5, blue: venta, actualizado: d.fechaActualizacion || null }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
  } catch (e) {
    return Response.json({ tc: null, error: e.message }, { status: 200 });
  }
}
