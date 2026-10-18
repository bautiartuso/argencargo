// Kairo · éxito del día (0 a 100). La mitad es entrenar (o descansar si tocaba descanso); la otra
// mitad es la comida: qué tan cerca quedaste de tu objetivo de proteína, carbohidratos y grasas.
// Desvío de hasta 10 % en un macro vale el puntaje completo; de ahí baja derecho hasta 0 a un 60 %.
export const MACROS = [["p", "Proteína", "proteina_g"], ["c", "Carbohidratos", "carbohidratos_g"], ["g", "Grasas", "grasas_g"]];

export function macroScore(eaten, target) {
  if (target == null) return null;
  const e = Number(eaten) || 0, t = Number(target) || 0;
  const dev = t > 0 ? Math.abs(e - t) / t : e / 40; // objetivo 0 (ej. keto): 40 g de más ya es 0
  return dev <= 0.1 ? 1 : Math.max(0, (0.6 - dev) / 0.5);
}

// eaten: { p, c, g } del día · st: estrategia del perfil · trained: entrenó · rest: tocaba descanso
export function dayScore({ eaten, st, trained, rest, logged }) {
  const entreno = trained || rest ? 50 : 0;
  const macros = MACROS.map(([k, label, key]) => ({ k, label, eaten: eaten?.[k] || 0, target: st?.[key] ?? null, score: macroScore(eaten?.[k], st?.[key] ?? null) })).filter(m => m.target != null);
  const comida = !macros.length ? null : !logged ? 0 : Math.round(50 * macros.reduce((a, m) => a + m.score, 0) / macros.length);
  return { total: comida == null ? entreno * 2 : entreno + comida, entreno, comida, macros, trained, rest, sinObjetivo: comida == null };
}
