// Planilla compartida con el depósito de China (28/09/2026).
// Lo usan la página pública /deposito/[token], su API y el panel de Marítimos del admin, para que
// el costo que ve el depósito y el que ve Bautista salgan de la misma cuenta que el trigger
// maritime_costo_estimado de la base.

// Tarifa del depósito según el tipo de mercadería. Sin tipo (cargas viejas) = tarifa general.
export function tarifaDeposito(wh, tipo) {
  if (!wh) return 0;
  if (tipo === "blanca" && Number(wh.cost_cbm_blanca) > 0) return Number(wh.cost_cbm_blanca);
  if (tipo === "negra" && Number(wh.cost_cbm_negra) > 0) return Number(wh.cost_cbm_negra);
  return Number(wh.default_cost_per_cbm) || 0;
}

// Lo que cobra el depósito por una carga: m³ × tarifa del tipo, con el descuento por volumen
// (Luna: 10% si la carga supera 1 m³). El descuento solo corre para cargas con tipo, igual que en
// la base: las anteriores al cambio quedan como estaban.
export function costoDeposito(wh, tipo, cbm) {
  const rate = tarifaDeposito(wh, tipo);
  const m3 = Number(cbm) || 0;
  if (!(rate > 0 && m3 > 0)) return { rate, bruto: 0, descuento: 0, total: 0 };
  const bruto = m3 * rate;
  const pct = Number(wh?.descuento_pct) || 0;
  const aplica = !!tipo && pct > 0 && m3 > (Number(wh?.descuento_min_cbm) || 0);
  const descuento = aplica ? bruto * (pct / 100) : 0;
  const r2 = (v) => Math.round(v * 100) / 100;
  return { rate, bruto: r2(bruto), descuento: r2(descuento), total: r2(bruto - descuento) };
}

// Carga que todavía espera al proveedor (sin tracking real): el depósito no la ve.
// Misma regla que esPlaceholder del admin.
export const esperandoProveedor = (sh) =>
  sh.awaiting_supplier === true ||
  (sh.status === "proveedor" && !sh.container_id &&
    (!sh.tracking_number || /^SEA[A-Z]*$/i.test(String(sh.tracking_number).trim())));
