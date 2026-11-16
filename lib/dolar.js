// Tipo de cambio automático del sistema (11/11/2026): dólar blue punta vendedora de dolarapi.com + TC_EXTRA pesos,
// siempre (pedido de Bautista: el blue pelado quedaba unos pesos abajo de lo que se opera). Lo usan el
// admin, el panel GI, el link de retiro, el bot y los crons. ARGENMAQ ya sumaba sus 5 pesos por su lado
// (/api/argenmaq/dolar) y la conversión del gasto de Meta Ads usa el blue sin recargo.
// 12/11/2026: bajó de 5 a 2 pesos ("por las dudas", pedido de Bautista).
// 16/11/2026: dolarapi se queda horas atrasado cuando el blue se mueve (marcaba 1585 con el blue en 1600).
// Se consultan dos fuentes a la vez (dolarapi y criptoya, que se actualiza cada minuto) y vale la cotización
// más reciente; si una no responde, queda la otra. En el servidor se guarda a lo sumo 5 minutos.
export const TC_EXTRA = 2;
const URL_BLUE = "https://dolarapi.com/v1/dolares/blue";
const URL_CRIPTOYA = "https://criptoya.com/api/dolar";

// Blue sin recargo: { venta, compra, fechaActualizacion, fuente } o null si no respondió ninguna fuente.
export async function blueCrudo(init) {
  const pedir = (u) => fetch(u, init).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [d, cy] = await Promise.all([pedir(URL_BLUE), pedir(URL_CRIPTOYA)]);
  const c = cy?.blue || null;
  const vd = Number(d?.venta) || 0, vc = Number(c?.ask) || 0;
  const td = Date.parse(d?.fechaActualizacion || "") || 0, tc = (Number(c?.timestamp) || 0) * 1000;
  // Por si una fuente manda un disparate: la segunda solo vale si está a menos de un 15 % de la primera.
  const cOk = vc > 0 && (!vd || Math.abs(vc - vd) / vd < 0.15);
  if (cOk && (!vd || tc >= td)) return { moneda: "USD", casa: "blue", nombre: "Blue", compra: Number(c.bid) || null, venta: vc, fechaActualizacion: new Date(tc || Date.now()).toISOString(), fuente: "criptoya" };
  if (vd) return { ...d, fuente: "dolarapi" };
  return null;
}

export const conExtra = (d) => (d && Number(d.venta) > 0 ? { ...d, venta_base: Number(d.venta), venta: Number(d.venta) + TC_EXTRA } : d);

// Reemplaza a fetch(dolarapi…): devuelve algo con .ok y .json() como una respuesta común, pero con
// `venta` ya sumada (el valor original queda en `venta_base`).
export async function fetchDolar(init) {
  const d = conExtra(await blueCrudo(init));
  if (!d) return { ok: false, status: 502, json: async () => null };
  return { ok: true, status: 200, json: async () => d };
}
