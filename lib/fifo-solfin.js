// Dolarización FIFO de la CC de SolFin (30/10/2026). Los pesos que entran a la financiera forman una
// cola; cada salida de pesos (una dolarización, una transferencia a FedEx, un retiro) se lleva primero
// los que entraron antes. Así, un ingreso recién cuenta como dolarizado cuando ya salieron todos los
// pesos que estaban delante, y su TC es el de la dolarización (o el promedio, si lo cubrieron varias).
// Lo que salió en pesos sin dolarizar (pagos en pesos) no tiene TC: se toma al TC del cobro.
import { parseMontoAr } from "../app/ccfinanciera/page";

const tcDe = (d) => { const m = String(d || "").match(/@\s*TC\s*([\d.,]+)/i); return m ? parseMontoAr(m[1]) : 0; };
export const esDolarizacion = (m) => /dolarizaci/i.test(String(m?.description || ""));

// movs: movimientos en ARS de cc_solfin_movements (id, date, created_at, type, net_amount, description).
// Devuelve, por id de ingreso: { neto, pendiente, arsDolarizado, usd, arsEnPesos, fecha, delante, tc }
//   pendiente : pesos de este ingreso que siguen en la cuenta
//   delante   : pesos que entraron antes y todavía no salieron (lo que falta dolarizar antes que este)
//   fecha     : el día que salió el último peso de este ingreso (null si sigue pendiente)
//   tc        : TC promedio al que se dolarizó lo que se dolarizó
export function fifoSolfin(movs) {
  const orden = [...(movs || [])].filter((m) => m.currency == null || m.currency === "ARS")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
  const cola = [];
  const deuda = []; // salidas que se llevaron pesos que todavía no habían entrado (fechas cargadas después)
  const res = {};
  const consumir = (f, toma, tc, fecha) => {
    f.pendiente -= toma;
    if (tc > 0) { f.arsDolarizado += toma; f.usd += toma / tc; } else f.arsEnPesos += toma;
    if (f.pendiente <= 0.005) { f.pendiente = 0; f.fecha = fecha; return true; }
    return false;
  };
  for (const m of orden) {
    const monto = Number(m.net_amount || 0);
    if (!(monto > 0)) continue;
    if (m.type === "ingreso") {
      const e = { id: m.id, neto: monto, pendiente: monto, arsDolarizado: 0, usd: 0, arsEnPesos: 0, fecha: null };
      res[m.id] = e;
      while (deuda.length && e.pendiente > 0.005) {
        const d = deuda[0]; const toma = Math.min(d.resta, e.pendiente);
        d.resta -= toma; if (d.resta <= 0.005) deuda.shift();
        consumir(e, toma, d.tc, m.date);
      }
      if (e.pendiente > 0.005) cola.push(e);
      continue;
    }
    const tc = esDolarizacion(m) ? tcDe(m.description) : 0;
    let resta = monto;
    while (resta > 0.005 && cola.length) {
      const f = cola[0];
      const toma = Math.min(resta, f.pendiente);
      resta -= toma;
      if (consumir(f, toma, tc, m.date)) cola.shift();
    }
    if (resta > 0.005) deuda.push({ resta, tc });
  }
  let acum = 0;
  for (const e of cola) { e.delante = acum; acum += e.pendiente; }
  for (const e of Object.values(res)) { if (e.delante == null) e.delante = 0; e.tc = e.usd > 0 ? e.arsDolarizado / e.usd : 0; }
  return res;
}
