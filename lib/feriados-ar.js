// Feriados de Argentina (08/10/2026): en esos días no se coordinan retiros ni envíos. Se cargan en
// Ajustes → Feriados con país "Argentina" (tabla holidays_calendar, country="argentina"); el link de
// retiro, el bot y la agenda de Arribadas los saltean. No aparecen en el banner del portal (ese es
// para feriados de China/USA que demoran la carga).
export const PAIS_FERIADO_AR = "argentina";

// Filas {start_date,end_date} → Set de días "YYYY-MM-DD".
export function diasFeriados(rows) {
  const s = new Set();
  for (const h of Array.isArray(rows) ? rows : []) {
    if (!h?.start_date) continue;
    let d = new Date(`${h.start_date}T12:00:00Z`);
    const fin = new Date(`${h.end_date || h.start_date}T12:00:00Z`);
    for (let i = 0; d <= fin && i < 60; i++, d = new Date(d.getTime() + 864e5)) s.add(d.toISOString().slice(0, 10));
  }
  return s;
}

export const queryFeriadosAr = (desdeIso) => `holidays_calendar?country=eq.${PAIS_FERIADO_AR}&end_date=gte.${desdeIso}&select=start_date,end_date,name&order=start_date.asc`;
