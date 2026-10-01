// Zona y costo del envío a domicilio (flete propio). Vive acá porque lo necesitan dos lados: el
// link público donde el cliente elige (/api/entrega/[token]) y la solapa Entrega del admin, cuando
// se cambia la forma de entrega a mano. Antes existía solo del lado del link, así que si el admin
// pasaba una op a "envío a domicilio" quedaba sin dirección ni costo.

export const DELIVERY_CFG_KEYS = "delivery_gba_per_km_ars,delivery_usd_ars_rate";

export function isCabaText(txt) {
  return /\bcaba\b|capital federal|ciudad aut[oó]noma/.test(txt);
}

// Matchea la localidad del cliente contra la tabla delivery_localities (editable desde el admin,
// sin necesidad de deploy). Solo busca match de GBA si el texto menciona Buenos Aires/GBA/provincia
// — evita falsos positivos con localidades homónimas de otras provincias (ej. "Pilar, Córdoba").
export function matchLocality(city, province, localities) {
  const txt = `${city || ""} ${province || ""}`.toLowerCase();
  if (!txt.trim()) return null;
  if (isCabaText(txt)) return { name: "CABA", km_from_origin: 0, isCaba: true };
  if (!/buenos aires|gba|provincia/.test(txt)) return null;
  for (const loc of localities || []) {
    const kws = String(loc.keywords || "").split(",").map((k) => k.trim()).filter(Boolean);
    if (kws.some((k) => txt.includes(k))) return { ...loc, isCaba: false };
  }
  return null;
}

// Costo del envío a domicilio (regla de Bautista, 01/10/2026 — igual en Argencargo y MyBox):
// - CABA: USD 13 de base hasta 10 kg y +USD 3 por cada 10 kg más (10–20 → 16, 20–30 → 19…).
// - GBA: USD 25 de base + $1.200 por km desde la oficina (dolarizado con el TC fijo de
//   Configuración) + recargo por peso acumulativo: desde 30 kg +5, 50 +5, 75 +5, 100 +5, 150 +20.
// El peso es el peso bruto real de los bultos que viajan en esa entrega.
const GBA_TRAMOS_KG = [[30, 5], [50, 5], [75, 5], [100, 5], [150, 20]];

export function recargoPorPesoUsd(match, kg) {
  const k = Number(kg || 0);
  if (!match || !(k > 0)) return 0;
  if (match.isCaba) return 3 * Math.floor(k / 10);
  return GBA_TRAMOS_KG.reduce((a, [desde, usd]) => a + (k >= desde ? usd : 0), 0);
}

export function computeDeliveryCostUsd(match, cfg, kg = 0) {
  if (!match) return 0;
  const recargo = recargoPorPesoUsd(match, kg);
  if (match.isCaba) return 13 + recargo;
  const rate = Number(cfg.delivery_usd_ars_rate || 1515);
  const km = Number(cfg.delivery_gba_per_km_ars || 1200) * Number(match.km_from_origin || 0);
  return Math.round(25 + km / rate + recargo);
}

// Peso bruto real de una lista de bultos (operation_packages).
export function kgDeBultos(pkgs) {
  return (pkgs || []).reduce((a, p) => a + Number(p.gross_weight_kg || 0) * Number(p.quantity || 1), 0);
}

// Dirección del cliente tal como se arma para mostrar/guardar en la entrega.
export function direccionDeCliente(c) {
  if (!c) return "";
  return [c.street, c.floor_apt, c.city, c.province, c.postal_code].filter(Boolean).join(", ");
}
