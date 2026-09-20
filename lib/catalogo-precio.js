// Precio de una máquina del catálogo, antes de la importación (20/09/2026).
//
// El catálogo mostraba "cuánto costaría" y nada más: la unidad ganaba cero. Acá se arma el
// precio de la máquina que ve el cliente, que lleva adentro tres cosas que él no ve por separado:
//   EXW           lo que cobra la fábrica
//   financiero    lo que cuesta pagarle (2,25 % + USD 40 por transferencia, hoy; se ajusta)
//   gestión       la ganancia de la unidad: % sobre el EXW, escalonado por valor, con piso
// La importación (flete, seguro, impuestos, servicio de Argencargo) va aparte y la calcula
// Argencargo con su calculadora: esa parte no lleva markup, es de Argencargo.
//
// Los parámetros salen de cat_ajustes; `markupPct` es el override de una máquina puntual.

const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

export const AJUSTES_DEFAULT = {
  markup_escalas: [{ hasta: 3000, pct: 15 }, { hasta: 15000, pct: 12 }, { hasta: null, pct: 8 }],
  markup_minimo_usd: 300,
  fin_pct: 2.25,
  fin_fijo_usd: 40,
  fin_pagos: 2,
  prueba_fabrica_precio: 350,
  prueba_fabrica_costo: 250,
  adelanto_extra_pct: 10,
};

// De la tabla clave/valor a un objeto plano con defaults.
export function leerAjustes(filas) {
  const out = { ...AJUSTES_DEFAULT };
  (filas || []).forEach((f) => { if (f && f.clave in out) out[f.clave] = f.valor; });
  return out;
}

// % de gestión que corresponde a un valor EXW total según las escalas.
export function pctGestion(exwTotal, aj) {
  const esc = Array.isArray(aj?.markup_escalas) && aj.markup_escalas.length ? aj.markup_escalas : AJUSTES_DEFAULT.markup_escalas;
  for (const e of esc) { if (e.hasta == null || exwTotal <= n(e.hasta)) return n(e.pct); }
  return n(esc[esc.length - 1].pct);
}

// exwUnit × qty → { exw, financiero, gestion, pct, precio, adelantoMinimo, unit }
export function precioMaquina({ exwUnit, qty = 1, ajustes, markupPct = null, conPrueba = false }) {
  const aj = ajustes || AJUSTES_DEFAULT;
  const q = Math.max(1, n(qty, 1));
  const exw = n(exwUnit) * q;
  const financiero = exw > 0 ? exw * n(aj.fin_pct) / 100 + n(aj.fin_fijo_usd) * Math.max(1, n(aj.fin_pagos, 1)) : 0;
  const pct = markupPct != null && markupPct !== "" ? n(markupPct) : pctGestion(exw, aj);
  const gestion = exw > 0 ? Math.max(exw * pct / 100, n(aj.markup_minimo_usd)) : 0;
  const prueba = conPrueba ? n(aj.prueba_fabrica_precio) : 0;
  const precio = exw + financiero + gestion + prueba;
  // Regla de Bautista: lo que entra por adelantado tiene que cubrir el costo de la máquina más un %.
  const adelantoMinimo = exw * (1 + n(aj.adelanto_extra_pct) / 100);
  return { exw, financiero, gestion, pct, prueba, precio, adelantoMinimo, cubreAdelanto: precio >= adelantoMinimo, unit: precio / q };
}
