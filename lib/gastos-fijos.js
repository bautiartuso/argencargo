// Gastos fijos del negocio (12/11/2026) — cuentas compartidas entre el panel (Finanzas → Gastos fijos),
// el número del menú y el aviso diario por Telegram. Sin "use client": corre en los dos lados.
//
// Un concepto (tabla gastos_fijos) vence el día `dia_vence` de cada mes (sin día = fin de mes). La alerta
// arranca `avisar_dias` antes del vencimiento y se apaga al pagarlo (finance_entries con gasto_fijo_id +
// periodo) o al marcar "No va este mes" (salteados). Los opcionales (avisar=false) nunca avisan.

export const periodoDe = (fecha) => String(fecha || "").slice(0, 7);
export const periodoAnterior = (p) => { const [a, m] = p.split("-").map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`; };
export const periodoSiguiente = (p) => { const [a, m] = p.split("-").map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`; };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const nombrePeriodo = (p) => { const [a, m] = p.split("-").map(Number); return `${MESES[m - 1]} ${a}`; };
const ultimoDia = (p) => { const [a, m] = p.split("-").map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };

// Fecha de vencimiento de un concepto en un mes (YYYY-MM-DD).
export function venceEl(g, periodo) {
  const u = ultimoDia(periodo);
  const d = Math.min(Number(g?.dia_vence) || u, u);
  return `${periodo}-${String(d).padStart(2, "0")}`;
}
const diasEntre = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

// pagos: finance_entries con gasto_fijo_id. hoy: "YYYY-MM-DD" (hora de Argentina).
//   estado: pagado | salteado | pendiente · faltan: días hasta el vencimiento (negativo = vencido)
//   alerta: true cuando hay que avisar (entró en la ventana de aviso o ya venció)
export function estadoGasto(g, periodo, pagos, hoy) {
  const mios = (pagos || []).filter((e) => e.gasto_fijo_id === g.id && e.periodo === periodo);
  const vence = venceEl(g, periodo);
  if (mios.length) return { estado: "pagado", pagos: mios, vence };
  if ((g.salteados || []).includes(periodo)) return { estado: "salteado", vence };
  const faltan = diasEntre(hoy, vence);
  const desdeAlta = periodo >= periodoDe(g.created_at);
  const alerta = g.estado === "activo" && !!g.avisar && desdeAlta && periodo <= periodoDe(hoy) && faltan <= Number(g.avisar_dias ?? 3);
  return { estado: "pendiente", vence, faltan, vencido: faltan < 0, alerta };
}

// Lo que hay que avisar hoy: el mes en curso y el anterior (si quedó algo sin pagar ni saltear).
export function porAvisar(gastos, pagos, hoy) {
  const act = periodoDe(hoy);
  const out = [];
  for (const periodo of [periodoAnterior(act), act]) for (const g of gastos || []) {
    if (g.estado !== "activo") continue;
    const e = estadoGasto(g, periodo, pagos, hoy);
    if (e.estado === "pendiente" && e.alerta) out.push({ g, periodo, ...e });
  }
  return out.sort((a, b) => a.vence.localeCompare(b.vence));
}

export const textoVence = (faltan) => (faltan < 0 ? `venció hace ${-faltan} ${faltan === -1 ? "día" : "días"}` : faltan === 0 ? "vence hoy" : faltan === 1 ? "vence mañana" : `vence en ${faltan} días`);
