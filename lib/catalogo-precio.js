// Precio de una máquina del catálogo, antes de la importación (20/09/2026).
//
// El catálogo mostraba "cuánto costaría" y nada más: la unidad ganaba cero. Acá se arma el
// precio de la máquina que ve el cliente, que lleva adentro tres cosas que él no ve por separado:
//   EXW           lo que cobra la fábrica
//   financiero    lo que cuesta pagarle: % + un fijo por la transferencia (una sola por pedido)
//   gestión       la ganancia de la unidad: un % que se decide máquina por máquina, con un piso,
//                 y se cobra SOBRE TODOS LOS COSTOS: EXW + financiero + importación de Argencargo
//                 (regla de Bautista, 21/09/2026: "el costo de la gestión es sobre el total").
// La importación (flete, seguro, impuestos, servicio) la cotiza Argencargo como a cualquier
// cliente; la ganancia de Argencargo es de Argencargo, pero la gestión de Argenmaq la incluye en su base.
//
// Los parámetros salen de cat_ajustes (Finanzas → Tarifas).

const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

export const AJUSTES_DEFAULT = {
  gestion_pct: 10,          // % por defecto; cada máquina / cada pedido lo puede pisar
  markup_minimo_usd: 100,   // piso de gestión por máquina
  fin_pct: 2.25,
  fin_fijo_usd: 40,
  fin_pagos: 1,
  prueba_fabrica_precio: 350,
  prueba_fabrica_costo: 250,
  adelanto_extra_pct: 10,
  // Del negocio (Ajustes), no del precio
  negocio: { nombre: "Argenmaq", razon_social: "", cuit: "", whatsapp: "", email: "", direccion: "" },
  prefs: { dias_verificar: 30, fotos_minimas: 5 },
  notif: { pedido_nuevo: true, cobro: true, precio_vencido: true, produccion_vencida: true },
  argencargo_client_id: null,   // el cliente "Argenmaq" dentro de Argencargo: sus ops son los pedidos de acá
};

// De la tabla clave/valor a un objeto plano con defaults.
export function leerAjustes(filas) {
  const out = { ...AJUSTES_DEFAULT };
  (filas || []).forEach((f) => { if (f && f.clave in out) out[f.clave] = f.valor; });
  return out;
}

// Costo financiero de pagarle a la fábrica un total EXW (una transferencia por pedido).
export const costoFinanciero = (exwTotal, aj) => exwTotal > 0 ? exwTotal * n(aj.fin_pct) / 100 + n(aj.fin_fijo_usd) * Math.max(1, n(aj.fin_pagos, 1)) : 0;
// Gestión: % sobre la base (costos totales) con piso por máquina.
export const gestionSobre = (base, unidades, pct, aj) => base > 0 ? Math.max(base * n(pct) / 100, n(aj.markup_minimo_usd) * Math.max(1, n(unidades, 1))) : 0;

// Una máquina sola (la ficha): exwUnit → { exw, financiero, gestion, pct, precio, adelantoMinimo, unit }
export function precioMaquina({ exwUnit, qty = 1, ajustes, gestionPct = null, importacion = 0, gestionUsd = null }) {
  const aj = ajustes || AJUSTES_DEFAULT;
  const q = Math.max(1, n(qty, 1));
  const exw = n(exwUnit) * q;
  const pct = gestionPct != null && gestionPct !== "" ? n(gestionPct) : n(aj.gestion_pct);
  const financiero = costoFinanciero(exw, aj);
  const arg = n(importacion);
  const base = exw + financiero + arg;
  const gestion = gestionUsd != null && gestionUsd !== "" ? n(gestionUsd) : gestionSobre(base, q, pct, aj);
  const precio = exw + financiero + gestion;          // lo que cobra Argenmaq (sin la importación)
  const total = precio + arg;                          // lo que paga el cliente en total
  const adelantoMinimo = exw * (1 + n(aj.adelanto_extra_pct) / 100);
  return { exw, financiero, gestion, pct, base, argencargo: arg, precio, total, adelantoMinimo, cubreAdelanto: precio >= adelantoMinimo, unit: precio / q };
}

// Un pedido con varias líneas: items [{exw_unit, qty, gestion_pct}] → totales.
// Una operación con varias líneas: la base de la gestión de cada línea es su parte de los costos
// (su EXW + su parte proporcional del financiero y de la importación).
export function totalesPedido(items, ajustes, importacion = 0) {
  const aj = ajustes || AJUSTES_DEFAULT;
  const lineas = (items || []).map((it) => ({ it, exw: n(it.exw_unit) * Math.max(1, n(it.qty, 1)), q: Math.max(1, n(it.qty, 1)) }));
  const exw_total = lineas.reduce((s, l) => s + l.exw, 0);
  const financiero = costoFinanciero(exw_total, aj);
  const arg = n(importacion);
  const gestion = lineas.reduce((s, l) => {
    const parte = exw_total > 0 ? l.exw / exw_total : 0;
    const base = l.exw + financiero * parte + arg * parte;
    const pct = l.it.gestion_pct != null && l.it.gestion_pct !== "" ? l.it.gestion_pct : aj.gestion_pct;
    return s + gestionSobre(base, l.q, pct, aj);
  }, 0);
  const prueba_monto = 0;
  const precio_total = exw_total + financiero + gestion;
  const total = precio_total + arg;
  const adelantoMinimo = exw_total * (1 + n(aj.adelanto_extra_pct) / 100);
  return { exw_total, financiero, gestion, prueba_monto, precio_total, importacion: arg, total, adelantoMinimo, cubreAdelanto: precio_total >= adelantoMinimo };
}
