// Tipo de cambio automático del sistema (11/11/2026): dólar blue punta vendedora de dolarapi.com + 5 pesos,
// siempre (pedido de Bautista: el blue pelado quedaba unos pesos abajo de lo que se opera). Lo usan el
// admin, el panel GI, el link de retiro, el bot y los crons. ARGENMAQ ya sumaba sus 5 pesos por su lado
// (/api/argenmaq/dolar) y la conversión del gasto de Meta Ads usa el blue sin recargo.
export const TC_EXTRA = 5;
const URL_BLUE = "https://dolarapi.com/v1/dolares/blue";

export const conExtra = (d) => (d && Number(d.venta) > 0 ? { ...d, venta_base: Number(d.venta), venta: Number(d.venta) + TC_EXTRA } : d);

// Reemplaza a fetch(dolarapi…): devuelve algo con .ok y .json() como una respuesta común, pero con
// `venta` ya sumada (el valor original queda en `venta_base`).
export async function fetchDolar(init) {
  const r = await fetch(URL_BLUE, init);
  if (!r.ok) return r;
  const d = conExtra(await r.json());
  return { ok: true, status: r.status, json: async () => d };
}
