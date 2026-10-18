// Kairo · éxito del día (0 a 100) y calorías del deporte. Compartido por Inicio, Nutrición y la IA.
//
// Partes del día: pesas (si tocaban o las hiciste), deporte (si tocaba o lo hiciste) y comida (siempre).
// El deporte vale 15 %; lo que queda se reparte en partes iguales entre pesas y comida. Un día sin pesas
// ni deporte es 100 % comida. La comida se mide por qué tan cerca quedaste de tu objetivo de proteína,
// carbohidratos y grasas: hasta 10 % de desvío vale completo; de ahí baja derecho hasta 0 a un 60 %.
export const MACROS = [["p", "Proteína", "proteina_g"], ["c", "Carbohidratos", "carbohidratos_g"], ["g", "Grasas", "grasas_g"]];

export function macroScore(eaten, target) {
  if (target == null) return null;
  const e = Number(eaten) || 0, t = Number(target) || 0;
  const dev = t > 0 ? Math.abs(e - t) / t : e / 40; // objetivo 0 (ej. keto): 40 g de más ya es 0
  return dev <= 0.1 ? 1 : Math.max(0, (0.6 - dev) / 0.5);
}

// eaten: { p, c, g } · st: objetivo del día (ya con el deporte sumado) · pesasPlan/pesasDone · cardioPlan (min) / cardioDone (min)
export function dayScore({ eaten, st, pesasPlan, pesasDone, cardioPlan, cardioDone, logged }) {
  const hasPesas = !!(pesasPlan || pesasDone), hasCardio = !!(cardioPlan || cardioDone);
  const wCardio = hasCardio ? 15 : 0, wPesas = hasPesas ? (100 - wCardio) / 2 : 0, wComida = 100 - wCardio - wPesas;
  const macros = MACROS.map(([k, label, key]) => ({ k, label, eaten: eaten?.[k] || 0, target: st?.[key] ?? null, score: macroScore(eaten?.[k], st?.[key] ?? null) })).filter(m => m.target != null);
  const sinObjetivo = !macros.length;
  const comida = sinObjetivo ? null : !logged ? 0 : macros.reduce((a, m) => a + m.score, 0) / macros.length;
  const pesas = pesasDone ? 1 : 0;
  const cardio = !hasCardio ? 0 : cardioPlan ? Math.min(1, (cardioDone || 0) / cardioPlan) : 1;
  const parts = [
    hasPesas && { id: "pesas", label: "Pesas", w: wPesas, got: pesas },
    hasCardio && { id: "cardio", label: "Deporte", w: wCardio, got: cardio },
    { id: "comida", label: "Comida", w: wComida, got: comida ?? 0 },
  ].filter(Boolean);
  // Sin objetivo de macros la comida no se puede medir: el día se reparte entre lo demás (o queda en 0 si no hay nada).
  const usable = sinObjetivo ? parts.filter(x => x.id !== "comida") : parts;
  const wSum = usable.reduce((a, x) => a + x.w, 0);
  const total = wSum ? Math.round(usable.reduce((a, x) => a + x.w * x.got, 0) * 100 / wSum) : 0;
  return { total, parts, macros, comida, sinObjetivo, pesasDone, pesasPlan, cardioPlan, cardioDone };
}

// Deportes con su MET (calorías por kilo y hora, aprox.). kcal = MET × peso × horas × intensidad.
export const SPORTS = [
  ["boxeo", "Boxeo", 9], ["natacion", "Natación", 7], ["running", "Running", 9.5], ["caminata", "Caminata", 3.5], ["bici", "Bicicleta", 7.5],
  ["futbol", "Fútbol", 8], ["padel", "Pádel / tenis", 7], ["basquet", "Básquet", 7.5], ["hiit", "HIIT / funcional", 9], ["soga", "Salto de soga", 11],
  ["remo", "Remo", 7], ["escalador", "Escalador / elíptico", 6], ["artes", "Artes marciales", 9], ["otro", "Otro", 6],
];
export const INTENSITY = { suave: 0.8, media: 1, fuerte: 1.2 };
export const sportName = (kind) => SPORTS.find(s => s[0] === kind)?.[1] || kind;
export function kcalFor(kind, minutes, intensity = "media", weightKg = 75) {
  const met = SPORTS.find(s => s[0] === kind)?.[2] || 6;
  return Math.round(met * (Number(weightKg) || 75) * (Number(minutes) || 0) / 60 * (INTENSITY[intensity] || 1));
}

// Objetivo del día con el deporte sumado. La estrategia es para un día SIN deporte; lo que quemás se
// repone subiendo los tres macros en la misma proporción (más proteína también: el músculo se desgasta más).
export function adjustTarget(st, burned) {
  if (!st || !burned || !Number(st.calorias_dia)) return st;
  const k = 1 + burned / Number(st.calorias_dia);
  const up = (v) => v == null ? v : Math.round(Number(v) * k);
  return { ...st, calorias_dia: Math.round(Number(st.calorias_dia) + burned), proteina_g: up(st.proteina_g), carbohidratos_g: up(st.carbohidratos_g), grasas_g: up(st.grasas_g), quemadas: burned };
}
export const cardioOn = (plan, dow) => (Array.isArray(plan) ? plan : []).filter(x => x.days?.includes(dow));
// Calorías del deporte planeado para un día de la semana (para armar la dieta por adelantado).
export const plannedBurn = (plan, dow, weightKg) => cardioOn(plan, dow).reduce((a, x) => a + kcalFor(x.kind, x.minutes, x.intensity, weightKg), 0);
