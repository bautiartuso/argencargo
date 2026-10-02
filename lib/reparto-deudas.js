// Reparto de los pagos de deuda vieja (02/10/2026).
//
// Cuando una operación se cierra sin cobrar todo, lo que falta pasa como deuda a la cuenta
// corriente del cliente y se le suma a la siguiente operación (debt_applied_usd). El cliente paga
// esa operación nueva con la deuda incluida y todo el pago queda registrado ahí. Resultado: la op
// vieja figuraba con una pérdida enorme y la nueva con una ganancia inflada (AC-0252 de Dana).
//
// Regla (pedido de Bautista): la op que cobró de más se queda con lo suyo (su presupuesto) y lo
// que pagó de más por deuda vieja vuelve a las operaciones anteriores del mismo cliente que
// quedaron cortas, de la más vieja a la más nueva. No toca pagos ni cuenta corriente: solo cómo se
// reparte el cobro al calcular la rentabilidad. El total del negocio no cambia.
//
// ops: operaciones (de uno o varios clientes) con id, operation_code, client_id, status, closed_at,
//      collection_date, created_at, budget_total, discount_applied_usd, total_anticipos,
//      credit_applied_usd, debt_applied_usd, collected_amount, collection_currency,
//      collection_exchange_rate.
// pagosPorOp: { [operation_id]: [{ amount_usd }] } (operation_client_payments).
// Devuelve { recibe: {opId: USD}, cede: {opId: USD}, movimientos: [{de, a, monto}] }.

const n = (v) => Number(v || 0);
const fechaDe = (o, campo) => String(o[campo] || o.closed_at || o.collection_date || o.created_at || "").slice(0, 10);

export function cobradoPropio(o, pagosPorOp) {
  const pagos = (pagosPorOp && pagosPorOp[o.id]) || [];
  const enPagos = pagos.reduce((s, p) => s + n(p.amount_usd), 0);
  if (enPagos > 0) return enPagos;
  const raw = n(o.collected_amount);
  const tc = n(o.collection_exchange_rate);
  return o.collection_currency === "ARS" && tc > 0 ? raw / tc : raw;
}

export function repartirDeudas(ops, pagosPorOp) {
  const recibe = {}, cede = {}, movimientos = [];
  const porCliente = {};
  (ops || []).forEach((o) => {
    if (!o || !o.client_id || o.status === "cancelada") return;
    (porCliente[o.client_id] = porCliente[o.client_id] || []).push(o);
  });
  Object.values(porCliente).forEach((lista) => {
    const info = lista.map((o) => {
      const debe = Math.max(0, n(o.budget_total) - n(o.discount_applied_usd));
      const pago = cobradoPropio(o, pagosPorOp) + n(o.credit_applied_usd) + n(o.total_anticipos);
      return {
        o,
        // Lo que le quedó sin cobrar a una op ya cerrada (eso fue a deuda).
        falta: o.status === "operacion_cerrada" ? Math.max(0, debe - pago) : 0,
        // Lo que pagó de más por deuda vieja: nunca más que la deuda que se le sumó.
        sobra: Math.min(Math.max(0, pago - debe), n(o.debt_applied_usd)),
        cierre: fechaDe(o, "closed_at"),
        cobro: fechaDe(o, "collection_date"),
      };
    });
    const deudoras = info.filter((x) => x.falta > 0.01).sort((a, b) => a.cierre.localeCompare(b.cierre));
    const pagadoras = info.filter((x) => x.sobra > 0.01).sort((a, b) => a.cobro.localeCompare(b.cobro));
    pagadoras.forEach((p) => {
      let resto = p.sobra;
      for (const d of deudoras) {
        if (resto <= 0.005) break;
        if (d.o.id === p.o.id) continue;
        // La deuda solo se le puede haber sumado a una op que cobró después de que la vieja cerró.
        if (d.cierre && p.cobro && d.cierre > p.cobro) continue;
        const lugar = d.falta - (recibe[d.o.id] || 0);
        if (lugar <= 0.005) continue;
        const x = Math.round(Math.min(lugar, resto) * 100) / 100;
        recibe[d.o.id] = (recibe[d.o.id] || 0) + x;
        cede[p.o.id] = (cede[p.o.id] || 0) + x;
        movimientos.push({ de: p.o.id, deCodigo: p.o.operation_code, a: d.o.id, aCodigo: d.o.operation_code, monto: x });
        resto -= x;
      }
    });
  });
  return { recibe, cede, movimientos };
}
