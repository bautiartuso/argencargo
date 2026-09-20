// Precio de una máquina del catálogo, antes de la importación (20/09/2026).
//
// El catálogo mostraba "cuánto costaría" y nada más: la unidad ganaba cero. Acá se arma el
// precio de la máquina que ve el cliente, que lleva adentro tres cosas que él no ve por separado:
//   EXW           lo que cobra la fábrica
//   financiero    lo que cuesta pagarle: % + un fijo por la transferencia (una sola por pedido)
//   gestión       la ganancia de la unidad: un % que se decide máquina por máquina, con un piso
// La importación (flete, seguro, impuestos, servicio) la cotiza Argencargo como a cualquier
// cliente y va aparte: la unidad no le agrega nada, y la ganancia de Argencargo es de Argencargo.
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
// Gestión de una línea: % sobre el EXW unitario con piso por máquina, por la cantidad.
export const gestionLinea = (exwUnit, qty, pct, aj) => exwUnit > 0 ? Math.max(exwUnit * n(pct) / 100, n(aj.markup_minimo_usd)) * Math.max(1, n(qty, 1)) : 0;

// Una máquina sola (la ficha): exwUnit → { exw, financiero, gestion, pct, precio, adelantoMinimo, unit }
export function precioMaquina({ exwUnit, qty = 1, ajustes, gestionPct = null, conPrueba = false }) {
  const aj = ajustes || AJUSTES_DEFAULT;
  const q = Math.max(1, n(qty, 1));
  const exw = n(exwUnit) * q;
  const pct = gestionPct != null && gestionPct !== "" ? n(gestionPct) : n(aj.gestion_pct);
  const financiero = costoFinanciero(exw, aj);
  const gestion = gestionLinea(n(exwUnit), q, pct, aj);
  const prueba = conPrueba ? n(aj.prueba_fabrica_precio) : 0;
  const precio = exw + financiero + gestion + prueba;
  const adelantoMinimo = exw * (1 + n(aj.adelanto_extra_pct) / 100);
  return { exw, financiero, gestion, pct, prueba, precio, adelantoMinimo, cubreAdelanto: precio >= adelantoMinimo, unit: precio / q };
}

// Un pedido con varias líneas: items [{exw_unit, qty, gestion_pct}] → totales.
export function totalesPedido(items, ajustes, conPrueba = false) {
  const aj = ajustes || AJUSTES_DEFAULT;
  const exw_total = (items || []).reduce((s, it) => s + n(it.exw_unit) * Math.max(1, n(it.qty, 1)), 0);
  const financiero = costoFinanciero(exw_total, aj);
  const gestion = (items || []).reduce((s, it) => s + gestionLinea(n(it.exw_unit), n(it.qty, 1), it.gestion_pct != null && it.gestion_pct !== "" ? it.gestion_pct : aj.gestion_pct, aj), 0);
  const prueba_monto = conPrueba ? n(aj.prueba_fabrica_precio) : 0;
  const precio_total = exw_total + financiero + gestion + prueba_monto;
  const adelantoMinimo = exw_total * (1 + n(aj.adelanto_extra_pct) / 100);
  return { exw_total, financiero, gestion, prueba_monto, precio_total, adelantoMinimo, cubreAdelanto: precio_total >= adelantoMinimo };
}
