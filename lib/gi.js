// Gestión Integral: la plata de una operación en un solo lugar.
// Es la MISMA fórmula que liquida la base (public.gi_liquidar, migrations/2026_10_13_gi_socios.sql):
//   costos   = pagos al proveedor − reembolsos + flete + impuestos + gasto documental + seguro + flete local + otros
//   ganancia = venta − costos           (proyectada, con lo acordado con el cliente)
//   real     = cobrado − costos         (lo que liquida la base al cerrar)
//   comisión = ganancia × % del socio   (negativa si hubo pérdida)

export const GI_CANALES = {
  aereo_blanco: { nombre: "Aéreo courier", largo: "Aéreo Courier Comercial", key: "cost_aereo_int_total_usd" },
  maritimo_blanco: { nombre: "Marítimo LCL/FCL", largo: "Marítimo LCL / FCL", key: "cost_maritimo_int_total_usd" },
  maritimo_negro: { nombre: "Marítimo Integral", largo: "Marítimo Integral AC", key: "cost_maritimo_lcl_total_usd" },
};

export const GI_ESTADOS = {
  pendiente: { l: "Proveedor", c: "#94a3b8" },
  en_deposito_origen: { l: "En depósito origen", c: "#fbbf24" },
  en_preparacion: { l: "Preparación", c: "#a78bfa" },
  en_transito: { l: "En tránsito", c: "#60a5fa" },
  arribo_argentina: { l: "Arribó", c: "#818cf8" },
  en_aduana: { l: "En aduana", c: "#fb923c" },
  entregada: { l: "Lista para entregar", c: "#22c55e" },
  operacion_cerrada: { l: "Cerrada", c: "#10b981" },
  cancelada: { l: "Cancelada", c: "#f87171" },
};
// Orden del flujo para el selector de etapa.
export const GI_FLUJO = ["pendiente", "en_deposito_origen", "en_transito", "arribo_argentina", "en_aduana", "entregada", "operacion_cerrada"];

const n = (v) => Number(v || 0) || 0;

export const costosFijosOp = (op) =>
  n(op?.cost_flete) + n(op?.cost_impuestos_reales) + n(op?.cost_gasto_documental) + n(op?.cost_seguro) + n(op?.cost_flete_local) + n(op?.cost_otros);

// pagosProveedor: filas de operation_supplier_payments; fx: TC para estimar pesos sin dolarizar.
export function costosProveedor(pagosProveedor = [], fx = 0) {
  let usd = 0, arsPend = 0, pagado = 0;
  for (const p of pagosProveedor) {
    const s = p.type === "refund" ? -1 : 1;
    if (n(p.amount_usd) === 0 && n(p.amount_ars) !== 0) arsPend += s * n(p.amount_ars);
    else { usd += s * n(p.amount_usd); if (p.is_paid) pagado += s * n(p.amount_usd); }
  }
  const estimado = arsPend !== 0 && fx > 0 ? arsPend / fx : 0;
  return { usd, arsPend, estimado, pagado, total: usd + estimado };
}

// % del socio: el de la op, si no el de la ficha del cliente, si no el general del socio.
export function pctSocio(op, cliente, socio) {
  if (op?.gi_admin_owned) return 0;
  if (op?.gi_commission_pct != null) return n(op.gi_commission_pct);
  if (cliente?.gi_commission_pct != null) return n(cliente.gi_commission_pct);
  return n(socio?.gi_partner_pct);
}
export const socioDeOp = (op, cliente) => (op?.gi_admin_owned ? null : op?.gi_partner_id || cliente?.gi_partner_id || null);

export function resumenGI({ op, cobros = [], pagosProveedor = [], fx = 0, cliente = null, socio = null }) {
  const venta = n(op?.budget_total);
  const cobrado = cobros.reduce((s, c) => s + n(c.amount_usd), 0);
  const prov = costosProveedor(pagosProveedor, fx);
  const fijos = costosFijosOp(op);
  // Mercadería (22/10/2026): lo pactado con el proveedor (cost_producto_usd, de la cotización o de los
  // productos) cuenta aunque todavía no se hayan cargado los pagos. Si se pagó más (extras), mandan los pagos.
  const pactado = n(op?.cost_producto_usd);
  const mercaderia = Math.max(pactado, prov.total);
  const costos = mercaderia + fijos;
  const ganancia = venta - costos;
  const real = cobrado - costos;
  const socioId = socioDeOp(op, cliente || op?.clients);
  const pct = socioId ? pctSocio(op, cliente || op?.clients, socio) : 0;
  const base = op?.status === "operacion_cerrada" ? real : ganancia;
  const comision = socioId ? (base * pct) / 100 : 0;
  return {
    venta, cobrado, saldo: Math.max(0, venta - cobrado),
    costos, costosProveedor: prov.total, costosFijos: fijos, costosPagados: prov.pagado + fijos,
    mercaderia, mercaderiaPactada: pactado, mercaderiaPagada: prov.pagado, mercaderiaFalta: Math.max(0, mercaderia - prov.pagado),
    estimado: prov.estimado !== 0, ganancia, real, socioId, pct, comision, margenAC: base - comision,
  };
}

export const totalCanal = (quote, canal) => n(quote?.[GI_CANALES[canal]?.key]);
export const totalAceptado = (quote) => (quote?.selected_channel ? totalCanal(quote, quote.selected_channel) + n(quote.selected_delivery_cost_usd) : 0);
export const canalMasBarato = (quote) => {
  const c = Object.keys(GI_CANALES).map((k) => ({ k, t: totalCanal(quote, k) })).filter((x) => x.t > 0).sort((a, b) => a.t - b.t);
  return c[0] || null;
};
