// Tarifas de los agentes · formato v2 (10/11/2026).
// Dos orígenes (China Mainland y Hong Kong) y, en cada uno, 9 tarifas por kg:
//   DHL · FedEx International Economy / Priority · UPS Expedited / Saver, FedEx y UPS en ÷5000 y ÷6000.
// Lo comparten el panel del agente, el admin y /api/agente/tarifas (sin "use client": corre en los dos lados).
//
// Formato guardado (Storage agent-tariffs/<uid>.json):
//   { version: 2, origenes: { CN: { servicios }, HK: { servicios } }, extras, vigencia, notas, actualizado,
//     servicios: <copia de CN> }   ← la copia queda para lo que todavía lee el formato viejo (costo DHL).
//
// Formato viejo (03/10/2026): { servicios: { DHL, FEDEX_5000, FEDEX_6000, UPS_5000, UPS_6000 } }, sin origen
// (era China) y sin tipo de servicio. Al migrar: UPS → UPS Saver y FedEx → FedEx International Priority
// (las tarifas viejas eran las express; Bautista separó los servicios el 10/11/2026).

export const ORIGENES = ["CN", "HK"];

export const CARRIERS = [
  { k: "dhl", nombre: "DHL", servicios: [{ k: "DHL_EXP", nombre: "DHL Express", vel: "rapido", cols: [{ key: "DHL", div: null }] }] },
  {
    k: "fedex", nombre: "FedEx", servicios: [
      { k: "FEDEX_IE", nombre: "FedEx International Economy", corto: "International Economy", vel: "economico", cols: [{ key: "FEDEX_IE_5000", div: 5000 }, { key: "FEDEX_IE_6000", div: 6000 }] },
      { k: "FEDEX_IP", nombre: "FedEx International Priority", corto: "International Priority", vel: "rapido", cols: [{ key: "FEDEX_IP_5000", div: 5000 }, { key: "FEDEX_IP_6000", div: 6000 }] },
    ],
  },
  {
    k: "ups", nombre: "UPS", servicios: [
      { k: "UPS_EXP", nombre: "UPS Expedited", corto: "Expedited", vel: "economico", cols: [{ key: "UPS_EXP_5000", div: 5000 }, { key: "UPS_EXP_6000", div: 6000 }] },
      { k: "UPS_SAV", nombre: "UPS Saver", corto: "Saver", vel: "rapido", cols: [{ key: "UPS_SAV_5000", div: 5000 }, { key: "UPS_SAV_6000", div: 6000 }] },
    ],
  },
];

export const SERVICIOS_V2 = CARRIERS.flatMap((c) => c.servicios.flatMap((s) => s.cols.map((col) => col.key)));
export const EXTRAS_KEYS = ["bateria_usd_total", "marca_usd_kg", "sobrepeso_usd_pieza", "remota_usd_kg", "remota_min_usd"];

const VIEJO_A_NUEVO = { DHL: "DHL", UPS_5000: "UPS_SAV_5000", UPS_6000: "UPS_SAV_6000", FEDEX_5000: "FEDEX_IP_5000", FEDEX_6000: "FEDEX_IP_6000" };

const num = (v) => { if (v === "" || v == null) return null; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };

const filasLimpias = (filas) => (Array.isArray(filas) ? filas : [])
  .map((f) => ({ min: num(f.min) ?? 0, max: num(f.max), usd: num(f.usd) }))
  .filter((f) => f.usd != null && f.usd >= 0)
  .sort((a, b) => a.min - b.min)
  .slice(0, 30);

const serviciosVacios = () => Object.fromEntries(SERVICIOS_V2.map((k) => [k, []]));

// Lleva cualquier versión guardada al formato v2 (sin tocar lo guardado: solo para leer).
export function normalizarTarifas(data) {
  if (!data) return null;
  if (data.origenes) {
    const origenes = {};
    ORIGENES.forEach((o) => { const s = data.origenes?.[o]?.servicios || {}; origenes[o] = { servicios: Object.fromEntries(SERVICIOS_V2.map((k) => [k, filasLimpias(s[k])])) }; });
    return { ...data, version: 2, origenes };
  }
  const cn = serviciosVacios();
  Object.entries(VIEJO_A_NUEVO).forEach(([viejo, nuevo]) => { cn[nuevo] = filasLimpias(data?.servicios?.[viejo]); });
  return { ...data, version: 2, origenes: { CN: { servicios: cn }, HK: { servicios: serviciosVacios() } } };
}

// Lo que manda el editor → lo que se guarda.
export function limpiarTarifas(body) {
  const origenes = {};
  ORIGENES.forEach((o) => {
    const s = body?.origenes?.[o]?.servicios || {};
    origenes[o] = { servicios: Object.fromEntries(SERVICIOS_V2.map((k) => [k, filasLimpias(s[k])])) };
  });
  const e = body?.extras || {};
  const extras = Object.fromEntries(EXTRAS_KEYS.map((k) => [k, num(e[k])]));
  const fecha = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
  return {
    version: 2, origenes, extras,
    vigencia: { desde: fecha(body?.vigencia?.desde), hasta: fecha(body?.vigencia?.hasta) },
    notas: String(body?.notas || "").slice(0, 500),
    servicios: origenes.CN.servicios,
  };
}

// Cuántos de los 9 servicios tienen al menos un precio en un origen.
export const serviciosCargados = (tar, o) => SERVICIOS_V2.filter((k) => (tar?.origenes?.[o]?.servicios?.[k] || []).length > 0).length;

// Rangos de un courier como planilla: filas = rangos (unión de los de todos sus servicios), columnas = claves.
export function aPlanilla(servicios, keys) {
  const idx = new Map();
  keys.forEach((k) => (servicios?.[k] || []).forEach((f) => {
    const id = `${f.min ?? 0}|${f.max ?? ""}`;
    if (!idx.has(id)) idx.set(id, { min: f.min ?? 0, max: f.max ?? null, v: {} });
    idx.get(id).v[k] = f.usd;
  }));
  return [...idx.values()].sort((a, b) => Number(a.min) - Number(b.min) || Number(a.max ?? 1e9) - Number(b.max ?? 1e9));
}
