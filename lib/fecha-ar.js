// Fechas en hora de Argentina (01/10/2026).
// `new Date().toISOString().slice(0,10)` da la fecha en UTC: desde las 21 h de Argentina ya es el
// día siguiente, y por eso "Hoy" saltaba a mañana a la noche en Entregas, cobros, agenda, etc.
// Argentina es UTC-3 todo el año (sin horario de verano desde 2009).
const AR_MS = 3 * 3600 * 1000;

// AAAA-MM-DD en Argentina del instante dado (Date, timestamp, ISO). Sin argumento: ahora.
export const isoAR = (d) => new Date((d == null ? Date.now() : new Date(d).getTime()) - AR_MS).toISOString().slice(0, 10);
export const hoyAR = () => isoAR();
