// Control de los topes del monotributo (12/11/2026) — Facturación del admin.
// La escala la publica ARCA y se actualiza dos veces por año (febrero y agosto, por inflación): cuando
// cambie hay que reemplazar TOPES y las dos fechas. El panel avisa solo cuando pasa la fecha de revisión.
// Fuente de la escala vigente: tabla de ARCA desde el 01/08/2026 (verificada en cuatro medios).
export const ESCALA = {
  desde: "2026-08-01",
  revisar: "2027-02-01",
  topes: { A: 12009410.45, B: 17595182.74, C: 24670494.31, D: 30628651.43, E: 36028231.33, F: 45151659.41, G: 53995798.87, H: 81924660.37, I: 91699761.90, J: 105012519.20, K: 126610838.75 },
};
export const CATEGORIAS = Object.keys(ESCALA.topes);
export const TOPE_MAX = ESCALA.topes.K;

// Categoría que corresponde a un total facturado en 12 meses (null = se pasa del régimen).
export const categoriaPorIngresos = (total) => CATEGORIAS.find((c) => Number(total) <= ESCALA.topes[c]) || null;

const mesAnterior = (p) => { const [a, m] = p.split("-").map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`; };
const mesSiguiente = (p) => { const [a, m] = p.split("-").map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`; };

// Los 12 meses que se miran: el mes en curso y los 11 anteriores, del más viejo al más nuevo.
export function ventana12(hoy) {
  const out = [String(hoy).slice(0, 7)];
  while (out.length < 12) out.unshift(mesAnterior(out[0]));
  return out;
}

// sistema / externos: { "AAAA-MM": pesos }. externos = lo facturado por fuera del sistema (web de ARCA),
// que se carga a mano. categoria: la letra actual (de ARCA o elegida a mano); si falta, la que da la cuenta.
export function resumenMonotributo({ sistema = {}, externos = {}, categoria = null, hoy }) {
  const meses = ventana12(hoy).map((mes) => { const s = Number(sistema[mes] || 0), e = Number(externos[mes] || 0); return { mes, sistema: s, externo: e, total: s + e }; });
  const total = meses.reduce((a, m) => a + m.total, 0);
  const corresponde = categoriaPorIngresos(total);
  const cat = CATEGORIAS.includes(categoria) ? categoria : corresponde || "K";
  const tope = ESCALA.topes[cat];
  // Ritmo: promedio de los tres últimos meses completos.
  const completos = meses.slice(8, 11);
  const ritmo = completos.reduce((a, m) => a + m.total, 0) / 3;
  // ¿Cuándo se pasa un tope si se sigue facturando a ese ritmo? Cada mes sale el más viejo y entra uno al ritmo.
  const cuando = (limite) => {
    if (total > limite) return { ya: true };
    if (!(ritmo > 0)) return null;
    const actual = Math.max(meses[11].total, ritmo);
    let mes = meses[11].mes;
    if (total - meses[11].total + actual > limite) return { mes };
    for (let k = 1; k <= 12; k++) {
      mes = mesSiguiente(mes);
      const quedan = meses.slice(k, 11).reduce((a, m) => a + m.total, 0) + actual + k * ritmo;
      if (quedan > limite) return { mes };
    }
    return null;
  };
  return {
    meses, total, categoria: cat, categoriaElegida: CATEGORIAS.includes(categoria), corresponde, tope,
    queda: tope - total, pct: tope > 0 ? total / tope : 0,
    topeMax: TOPE_MAX, quedaMax: TOPE_MAX - total, pctMax: total / TOPE_MAX,
    ritmo, proyeccion: ritmo * 12, pasaCategoria: cuando(tope), pasaMax: cuando(TOPE_MAX),
    escalaVieja: String(hoy) >= ESCALA.revisar,
  };
}
