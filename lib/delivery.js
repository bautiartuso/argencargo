// Zona y costo del envío a domicilio (flete propio). Vive acá porque lo necesitan dos lados: el
// link público donde el cliente elige (/api/entrega/[token]) y la solapa Entrega del admin, cuando
// se cambia la forma de entrega a mano. Antes existía solo del lado del link, así que si el admin
// pasaba una op a "envío a domicilio" quedaba sin dirección ni costo.

export const DELIVERY_CFG_KEYS = "delivery_caba_flat_ars,delivery_gba_flat_ars,delivery_gba_per_km_ars,delivery_usd_ars_rate,delivery_margin_usd";

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

// Costo real acordado con el fletero: CABA fijo, GBA fijo + variable por km desde la oficina (Virrey Loreto 2428, Belgrano).
// Se dolariza con un TC fijo (cargado a mano en Configuración, no una API en vivo) + un margen
// fijo en USD para no perder con las fluctuaciones — la idea es no ganar con el envío, solo cubrir.
export function computeDeliveryCostUsd(match, cfg) {
  if (!match) return 0;
  const rate = Number(cfg.delivery_usd_ars_rate || 1515);
  const margin = Number(cfg.delivery_margin_usd || 3);
  const ars = match.isCaba
    ? Number(cfg.delivery_caba_flat_ars || 15000)
    : Number(cfg.delivery_gba_flat_ars || 25000) + Number(cfg.delivery_gba_per_km_ars || 1200) * Number(match.km_from_origin || 0);
  return Math.round(ars / rate + margin);
}

// Dirección del cliente tal como se arma para mostrar/guardar en la entrega.
export function direccionDeCliente(c) {
  if (!c) return "";
  return [c.street, c.floor_apt, c.city, c.province, c.postal_code].filter(Boolean).join(", ");
}
