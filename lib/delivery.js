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
// Sin tildes ni puntos: "José C. Paz", "Jose C Paz" y "jose c. paz" son lo mismo (23/10/2026).
const normLoc = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").replace(/\s+/g, " ").trim();

// Zona por código postal (23/10/2026, pedido de Bautista: "el CP es lo más fácil"). Los nombres son
// los de delivery_localities. Si el CP no está acá, se sigue buscando por la localidad escrita.
const ZONA_CP = {
  "San Martín": [1650, 1651, 1652, 1653, 1654, 1655, 1656, 1672],
  "Tres de Febrero (Caseros)": [1657, 1674, 1675, 1676, 1678, 1682, 1683, 1685, 1687, 1702, 1703],
  "Ituzaingó / Hurlingham": [1686, 1688, 1713, 1714],
  "Morón / Haedo": [1684, 1706, 1707, 1708, 1712],
  "Ramos Mejía / San Justo (La Matanza)": [1704, 1751, 1752, 1753, 1754, 1755, 1757, 1759, 1763, 1765, 1766, 1768, 1770, 1772, 1778],
  "Vicente López / Olivos / Martínez": [1602, 1603, 1604, 1605, 1606, 1607, 1636, 1637, 1638, 1640],
  "San Isidro / Beccar / Acassuso": [1609, 1641, 1642, 1643],
  "San Fernando": [1644, 1645, 1646],
  "Tigre": [1611, 1617, 1618, 1621, 1648],
  "Nordelta": [1670],
  "San Miguel / José C. Paz / Malvinas Argentinas": [1612, 1613, 1614, 1615, 1661, 1662, 1663, 1665, 1667],
  "Pilar": [1629, 1631, 1635, 1669],
  "Escobar": [1619, 1623, 1625],
  "Avellaneda": [1868, 1869, 1870, 1871, 1872, 1874, 1875],
  "Lanús": [1822, 1824, 1825, 1826],
  "Lomas de Zamora": [1828, 1832, 1834, 1836],
  "Monte Grande (Esteban Echeverría)": [1838, 1839, 1842],
  "Adrogué (Almirante Brown)": [1845, 1846, 1847, 1849, 1852, 1854, 1856],
  "Quilmes": [1876, 1878, 1879, 1881, 1882],
  "Berazategui": [1884, 1885, 1886],
  "Florencio Varela": [1888],
  "Ezeiza": [1802, 1804, 1806, 1812],
  "Merlo": [1716, 1718, 1722],
  "Moreno": [1742, 1744],
  "La Plata / Berisso / Ensenada": [1900, 1923, 1925],
};
const CP_A_ZONA = Object.fromEntries(Object.entries(ZONA_CP).flatMap(([n, cps]) => cps.map((c) => [c, n])));
const cpNumero = (cp) => Number((String(cp || "").match(/\d{4}/) || [])[0]) || 0;

export function matchLocality(city, province, localities, cp = null) {
  const n = cpNumero(cp);
  if (n >= 1000 && n <= 1499) return { name: "CABA", km_from_origin: 0, isCaba: true };
  const porCp = CP_A_ZONA[n] && (localities || []).find((l) => l.name === CP_A_ZONA[n]);
  if (porCp) return { ...porCp, isCaba: false };
  const txt = normLoc(`${city || ""} ${province || ""}`);
  if (!txt.trim()) return null;
  if (isCabaText(txt)) return { name: "CABA", km_from_origin: 0, isCaba: true };
  if (!/buenos aires|gba|provincia/.test(txt)) return null;
  for (const loc of localities || []) {
    const kws = String(loc.keywords || "").split(",").map((k) => normLoc(k)).filter(Boolean);
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

// Peso facturable de una lista de bultos (operation_packages) para el envío a domicilio: por bulto,
// el mayor entre el peso bruto y el volumétrico (largo × ancho × alto / 5000). Así una carga marítima
// voluminosa (o un bulto sin peso cargado) no sale al precio base (21/10/2026, pedido de Bautista).
export function kgDeBultos(pkgs) {
  return (pkgs || []).reduce((a, p) => {
    const q = Number(p.quantity || 1);
    const bruto = Number(p.gross_weight_kg || 0);
    const l = Number(p.length_cm || 0), w = Number(p.width_cm || 0), h = Number(p.height_cm || 0);
    const vol = l > 0 && w > 0 && h > 0 ? (l * w * h) / 5000 : 0;
    return a + Math.max(bruto, vol) * q;
  }, 0);
}

// CABA por código postal: 1000–1499 (con o sin la "C" del CPA).
export function esCpCaba(cp) {
  const t = String(cp || "").trim().toUpperCase();
  if (/^C\d{4}/.test(t)) return true;
  const n = Number((t.match(/\d{4}/) || [])[0]);
  return n >= 1000 && n <= 1499;
}

// Zona a partir de la dirección que el cliente edita en el link (localidad + CP). Si el CP es de
// CABA, es CABA aunque escriba el barrio; si no, se busca la localidad en la tabla de GBA.
export function matchDireccion(localidad, cp, localities) {
  const loc = String(localidad || "").trim();
  if (esCpCaba(cp) || isCabaText(loc.toLowerCase())) return { name: "CABA", km_from_origin: 0, isCaba: true };
  if (!loc && !cpNumero(cp)) return null;
  return matchLocality(loc, "Buenos Aires", localities, cp);
}

// Dirección del cliente tal como se arma para mostrar/guardar en la entrega.
export function direccionDeCliente(c) {
  if (!c) return "";
  return [c.street, c.floor_apt, c.city, c.province, c.postal_code].filter(Boolean).join(", ");
}
