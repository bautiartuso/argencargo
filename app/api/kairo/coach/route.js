// POST /api/kairo/coach   (usuario de Kairo; todo se lee y guarda con su user_id)
// El entrenador con IA de Kairo · Físico.
//   { action: "plan", routine_id }  → qué hacer hoy en cada ejercicio (kilos × reps por serie) según
//                                     lo que venís levantando. Se guarda en kairo_ai y se reusa hasta
//                                     el próximo entreno de esa rutina.
//   { action: "review" }            → revisión de todas tus rutinas: si son efectivas, volumen por
//                                     músculo, qué cambiar y por qué.

import { callClaudeText } from "../../../../lib/anthropic";
import { SPORTS, kcalFor, sportName } from "../../../kairo/score";
import { sb, arr, kairoUser } from "../../../../lib/kairo-server";

const MODEL = "claude-opus-5-5";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const COACH = `Sos el preparador físico de una sola persona dentro de su app Kairo. Escribís en castellano rioplatense con lenguaje técnico de entrenamiento: preciso, sobrio y profesional, como un coach de alto rendimiento. Nada de frases motivacionales, saludos, emojis ni relleno.
Planificás según su perfil (objetivo, experiencia, medidas, lesiones). Criterios:
- Volumen (superávit): prioridad hipertrofia; doble progresión, empujar cerca del fallo (RIR 1–2), volumen semanal alto (12–20 series por grupo grande).
- Definición (déficit): conservar fuerza y masa; mantener cargas, no perseguir PRs, recortar volumen accesorio si la recuperación cae; RIR 1–3.
- Recomposición: progresión conservadora de carga y reps, volumen moderado-alto, RIR 1–2.
- Mantenimiento: sostener cargas con volumen mínimo eficaz (~6–10 series por grupo).
- Fuerza: compuestos en rangos bajos (3–6), progresión de carga lineal, descansos largos; accesorios en 8–12.
Progresión: doble progresión dentro del rango de la rutina — primero reps; cuando todas las series llegan al tope con técnica, se sube la carga (≈2,5 kg compuestos, salto mínimo disponible en aislados) y se vuelve al piso del rango. Sin progreso en 2 sesiones: mantener; caída o estancamiento de 3+ sesiones: bajar 5–10 % o cambiar la variante. Sin historial: estimar una carga de trabajo conservadora según experiencia, sexo y peso corporal.
Ajustá a la experiencia: principiante progresa más rápido y necesita menos volumen; avanzado, progresiones más chicas.
Respetá lesiones y limitaciones: nunca propongas cargar una zona lesionada.
Kilos con un decimal como máximo y en saltos reales de gimnasio.
Respetá siempre las "reglas" que la persona te dejó (por ejemplo, si prioriza máquinas sobre peso libre).
Las indicaciones que ve en el gimnasio tienen que entenderse aunque sea principiante: lenguaje simple y concreto, sin siglas ni jerga (nada de "RIR", "RPE", "1RM", "tempo 3-1-1"). Si hace falta el concepto, decilo en criollo: por ejemplo "cortá la serie cuando te queden 2 repeticiones más en el tanque".`;

const PLAN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["ejercicios"],
  properties: {
    ejercicios: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["exercise_id", "accion", "series", "nota"],
        properties: {
          exercise_id: { type: "string" },
          accion: { type: "string", enum: ["subir_peso", "subir_reps", "mantener", "bajar_peso", "primera_vez", "cambiar"] },
          series: { type: "array", items: { type: "object", additionalProperties: false, required: ["kg", "reps"], properties: { kg: { type: "number" }, reps: { type: "integer" } } } },
          nota: { type: "string", description: "Indicación para hoy, máximo 16 palabras: un detalle de técnica o de esfuerzo, en palabras simples que entienda un principiante, sin siglas. Tono profesional. No digas 'primera vez' ni des ánimo." },
        },
      },
    },
  },
};

// Revisión de rutinas: el conjunto + cada rutina, con cambios que se pueden aplicar con un botón.
const CAMBIO = {
  type: "object", additionalProperties: false,
  required: ["id", "tipo", "item_id", "ejercicio_actual", "ejercicio_nuevo", "posicion", "series", "rep_min", "rep_max", "motivo"],
  properties: {
    id: { type: "string", description: "Identificador corto único (c1, c2…)." },
    tipo: { type: "string", enum: ["cambiar", "agregar", "sacar", "reordenar", "series"] },
    item_id: { type: "string", description: "item_id del ejercicio de la rutina al que se refiere (vacío si es agregar)." },
    ejercicio_actual: { type: "string", description: "Nombre del ejercicio actual (vacío si es agregar)." },
    ejercicio_nuevo: { type: "string", description: "Para cambiar o agregar: nombre EXACTO de la biblioteca. Vacío en los otros tipos." },
    posicion: { type: "integer", description: "Para agregar o reordenar: lugar en la rutina empezando en 1. -1 si no aplica." },
    series: { type: "integer", description: "Series nuevas (agregar o series). -1 si no cambia." },
    rep_min: { type: "integer", description: "Piso de repeticiones nuevo. -1 si no cambia." },
    rep_max: { type: "integer", description: "Tope de repeticiones nuevo. -1 si no cambia." },
    motivo: { type: "string", description: "Por qué, en una frase concreta." },
  },
};
const REVIEW_SCHEMA = {
  type: "object", additionalProperties: false, required: ["puntaje", "resumen", "fortalezas", "problemas", "volumen", "rutinas"],
  properties: {
    puntaje: { type: "integer", description: "Qué tan efectivo es el esquema completo para el objetivo, de 1 a 10." },
    resumen: { type: "string", description: "El esquema completo en 2-3 frases." },
    fortalezas: { type: "array", items: { type: "string" } },
    problemas: { type: "array", items: { type: "string" } },
    volumen: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["musculo", "series_semana", "opinion"],
        properties: { musculo: { type: "string" }, series_semana: { type: "integer" }, opinion: { type: "string", enum: ["poco", "bien", "mucho"] } },
      },
    },
    rutinas: {
      type: "array", description: "Una por rutina, en el mismo orden.",
      items: {
        type: "object", additionalProperties: false, required: ["routine_id", "nombre", "puntaje", "resumen", "cambios"],
        properties: {
          routine_id: { type: "string" }, nombre: { type: "string" },
          puntaje: { type: "integer", description: "1 a 10." },
          resumen: { type: "string", description: "Qué está bien y qué no de esta rutina, en 1-2 frases." },
          cambios: { type: "array", items: CAMBIO, description: "Cambios concretos y aplicables; vacío si la rutina está bien." },
        },
      },
    },
  },
};

const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

async function loadRoutines(uid, ids) {
  const filter = ids ? `&id=in.(${ids.join(",")})` : "";
  const routines = arr(await sb(`/rest/v1/kairo_routines?user_id=eq.${uid}&select=id,name,days&order=sort_order.asc${filter}`));
  const items = routines.length ? arr(await sb(`/rest/v1/kairo_routine_exercises?routine_id=in.(${routines.map(r => r.id).join(",")})&select=*,exercise:kairo_exercises(id,name,muscle,equipment)&order=sort_order.asc`)).filter(i => i.exercise) : [];
  return routines.map(r => ({ ...r, items: items.filter(i => i.routine_id === r.id) }));
}

// Últimas sesiones de cada ejercicio: [{ fecha, series: "60×10, 60×9, 60×8" }]
async function history(uid, exerciseIds, perExercise = 4) {
  if (!exerciseIds.length) return {};
  const sets = arr(await sb(`/rest/v1/kairo_sets?user_id=eq.${uid}&exercise_id=in.(${exerciseIds.join(",")})&select=exercise_id,workout_id,set_index,weight_kg,reps,created_at&order=created_at.desc&limit=1500`));
  const out = {};
  for (const id of exerciseIds) {
    const mine = sets.filter(s => s.exercise_id === id);
    const byWorkout = [];
    for (const s of mine) {
      let w = byWorkout.find(x => x.workout_id === s.workout_id);
      if (!w) { if (byWorkout.length >= perExercise) continue; w = { workout_id: s.workout_id, fecha: s.created_at.slice(0, 10), sets: [] }; byWorkout.push(w); }
      w.sets.push(s);
    }
    out[id] = byWorkout.map(w => {
      const sets = w.sets.sort((a, b) => a.set_index - b.set_index);
      return { fecha: w.fecha, raw: sets.map(s => ({ kg: Number(s.weight_kg), reps: s.reps })), series: sets.map(s => `${Number(s.weight_kg)}×${s.reps}`).join(", ") };
    });
  }
  return out;
}

// Progresión exacta, serie por serie (doble progresión de a una repetición):
//  · si en una serie llegaste a la meta de la vez pasada (o no había meta) → +1 repetición con el mismo peso;
//  · si ya estás en el tope del rango → sube el peso un salto y vuelve al piso del rango;
//  · si no llegaste a la meta → se repite esa misma meta.
const STEP = (equipment, kg) => /mancuerna|barra z/i.test(equipment || "") ? (kg < 5 ? 1 : 2) : /corporal/i.test(equipment || "") ? 0 : 2.5;
function progression(item, lastSets, prevTargets) {
  if (!lastSets?.length) return null;
  const out = [];
  for (let i = 0; i < item.sets; i++) {
    const done = lastSets[Math.min(i, lastSets.length - 1)];
    const goal = prevTargets?.[i];
    if (goal && (done.reps < goal.reps || done.kg < goal.kg)) { out.push({ kg: goal.kg, reps: goal.reps }); continue; }
    if (done.reps + 1 <= item.rep_max) { out.push({ kg: done.kg, reps: done.reps + 1 }); continue; }
    const step = STEP(item.exercise.equipment, done.kg);
    out.push(step ? { kg: Math.round((done.kg + step) * 2) / 2, reps: item.rep_min } : { kg: done.kg, reps: done.reps + 1 });
  }
  return out;
}

const OBJ = { volumen: "Volumen (superávit calórico)", definicion: "Definición (déficit calórico)", recomposicion: "Recomposición corporal", mantenimiento: "Mantenimiento", fuerza: "Fuerza" };
const ageOf = (d) => { if (!d) return null; const b = new Date(d + "T12:00:00"), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
// Suplementos activos con su total diario: la IA los tiene que considerar en todo (ej. si toma omega 3
// no le pide pescado; si toma creatina lo tiene en cuenta para el entrenamiento y la hidratación).
const n1 = (v) => Number(v).toLocaleString("es-AR", { maximumFractionDigits: 2 });
function suppLine(s) {
  const tomas = (s.times || []).length || 1;
  if (s.amount) return `${s.name} ${n1(s.amount)} ${s.unit || ""} × ${tomas} toma${tomas > 1 ? "s" : ""} = ${n1(s.amount * tomas)} ${s.unit || ""} por día`.replace(/\s+/g, " ").trim();
  return `${s.name}${s.dose ? ` ${s.dose}` : ""}${tomas > 1 ? ` (${tomas} tomas por día)` : ""}`;
}
async function loadProfile(uid) {
  const [p] = arr(await sb(`/rest/v1/kairo_profile?user_id=eq.${uid}&select=*`));
  const supps = arr(await sb(`/rest/v1/kairo_supplements?user_id=eq.${uid}&active=eq.true&select=name,dose,amount,unit,times`));
  const [first] = arr(await sb(`/rest/v1/kairo_workouts?user_id=eq.${uid}&finished_at=not.is.null&select=started_at&order=started_at.asc&limit=1`));
  if (p) { p.supps = supps; p.desde = first?.started_at?.slice(0, 10) || null; }
  if (p && p.fecha_nacimiento) p.edad = ageOf(p.fecha_nacimiento);
  return p || null;
}
function profileText(p) {
  if (!p) return "Perfil: no cargado (asumí hipertrofia general, nivel intermedio).";
  return `Perfil: objetivo ${OBJ[p.objetivo] || p.objetivo || "—"}${p.tendencia ? ` (${p.tendencia})` : ""}${p.objetivo_detalle ? ` · en sus palabras: "${p.objetivo_detalle}"` : ""}${p.reglas_gym ? ` · reglas para el entrenamiento: "${p.reglas_gym}"` : ""}${p.dieta ? ` · tipo de alimentación: ${p.dieta} (respetalo a rajatabla: en keto los carbohidratos van a 20-30 g como mucho, en vegana nada de origen animal, en sin gluten nada con trigo/cebada/centeno; los ajustes mueven los macros sobre esa base: "más proteína" = 2,2-2,6 g/kg, "menos carbohidratos" = la mitad de lo habitual, "menos grasas" = 20 % de las calorías, etc.)` : ""}${p.reglas_nutricion ? ` · reglas para la alimentación: "${p.reglas_nutricion}"` : ""} · experiencia ${p.experiencia || "—"} · ${p.sexo || "—"}, ${p.edad || "—"} años, ${p.peso_kg || "—"} kg, ${p.altura_cm || "—"} cm · entrena ${p.dias_semana || "—"} días/semana${p.lesiones ? ` · lesiones/limitaciones: ${p.lesiones}` : ""}${p.notas ? ` · notas: ${p.notas}` : ""}.
Deporte además de las pesas: ${Array.isArray(p.cardio_plan) && p.cardio_plan.length ? p.cardio_plan.map(x => `${sportName(x.kind)} ${x.minutes} min ${x.days.map(d => DAYS[d]).join("/")}${x.time ? ` a las ${x.time}` : ""} (≈ ${kcalFor(x.kind, x.minutes, x.intensity, p.peso_kg)} kcal por sesión)`).join("; ") : "ninguno"}. Esas calorías Kairo las suma al objetivo de cada día que corresponde: calculá calorias_dia SIN el deporte (solo basal + pesas + vida diaria).
Suplementos que toma todos los días: ${p.supps?.length ? p.supps.map(suppLine).join("; ") : "ninguno"}. Tenelos en cuenta siempre: no le sugieras comida para cubrir algo que ya cubre un suplemento.
Usa Kairo desde ${p.desde || "hace muy poco (todavía no registró entrenos)"}: no juzgues frecuencia ni adherencia con días anteriores a esa fecha (antes no registraba nada). Con menos de 3 semanas de datos, no saques conclusiones de constancia.`;
}

async function ask(user, schema, feature) {
  const text = await callClaudeText({ system: COACH, user, max_tokens: 8000, json_schema: schema, thinking: "adaptive", model: MODEL, feature });
  return JSON.parse(text);
}

async function plan(uid, routineId) {
  const [routine] = await loadRoutines(uid, [routineId]);
  if (!routine) return Response.json({ error: "Rutina no encontrada" }, { status: 404 });
  if (!routine.items.length) return Response.json({ error: "La rutina no tiene ejercicios" }, { status: 400 });

  // Reusa el plan si no hubo un entreno de esta rutina ni cambió el perfil después de generarlo.
  const profile = await loadProfile(uid);
  const [last] = arr(await sb(`/rest/v1/kairo_ai?user_id=eq.${uid}&kind=eq.plan&routine_id=eq.${routineId}&select=content,created_at&order=created_at.desc&limit=1`));
  const [lastWorkout] = arr(await sb(`/rest/v1/kairo_workouts?user_id=eq.${uid}&routine_id=eq.${routineId}&finished_at=not.is.null&select=finished_at&order=finished_at.desc&limit=1`));
  if (last && (!lastWorkout || last.created_at > lastWorkout.finished_at) && (!profile || last.created_at > profile.updated_at)) {
    const ids = new Set(routine.items.map(i => i.exercise_id));
    if (last.content.ejercicios?.every(e => ids.has(e.exercise_id))) return Response.json({ plan: last.content, cached: true });
  }

  const hist = await history(uid, routine.items.map(i => i.exercise_id));
  // Metas de la vez pasada (el plan que se usó en el último entreno de esta rutina).
  const prevPlan = last && lastWorkout && last.created_at < lastWorkout.finished_at ? last.content : null;
  const proposals = {};
  const lines = routine.items.map(i => {
    const h = hist[i.exercise_id] || [];
    const prev = prevPlan?.ejercicios?.find(e => e.exercise_id === i.exercise_id)?.series || null;
    const prop = progression(i, h[0]?.raw, prev);
    if (prop) proposals[i.exercise_id] = prop;
    const fmt = (l) => l.map(x => `${x.kg}×${x.reps}`).join(", ");
    return `- exercise_id ${i.exercise_id} · ${i.exercise.name} (${i.exercise.muscle}, ${i.exercise.equipment || "—"}) · ${i.sets} series, tope de repeticiones ${i.rep_max} (piso ${i.rep_min})\n  Últimas sesiones (la más reciente primero): ${h.length ? h.map(x => `${x.fecha}: ${x.series}`).join(" | ") : "sin historial"}${prev ? `\n  Meta de la vez pasada: ${fmt(prev)}` : ""}${prop ? `\n  PROPUESTA DE HOY (progresión calculada): ${fmt(prop)}` : ""}`;
  }).join("\n");
  const user = `${profileText(profile)}\n\nHoy entrena la rutina "${routine.name}". Para cada ejercicio devolvé exactamente una serie por cada serie de la rutina, con kilos y repeticiones exactos (nunca rangos). Si hay PROPUESTA DE HOY, devolvela tal cual: la progresión ya está calculada (+1 repetición por serie si cumplió la meta anterior, sube el peso al llegar al tope, repite la meta si no llegó). Solo apartate de la propuesta con un motivo claro (estancamiento de 3+ sesiones, una caída fuerte, una lesión o un objetivo de definición que pida sostener cargas) y en ese caso usá accion "mantener", "bajar_peso" o "cambiar". Si no hay historial, proponé una carga inicial conservadora. Usá el exercise_id tal cual.\n\n${lines}`;
  const content = await ask(user, PLAN_SCHEMA, "kairo-coach-plan");
  // La progresión manda: si la IA cambió números sin un motivo de los permitidos, se usa la calculada.
  for (const e of content.ejercicios || []) {
    const prop = proposals[e.exercise_id];
    if (prop && !["mantener", "bajar_peso", "cambiar"].includes(e.accion)) e.series = prop;
  }
  await sb(`/rest/v1/kairo_ai`, { method: "POST", body: JSON.stringify({ user_id: uid, kind: "plan", routine_id: routineId, content }), headers: { Prefer: "return=minimal" } });
  return Response.json({ plan: content });
}

// Topes semanales para controlar el gasto de IA (el admin no tiene tope). El plan de cada entreno
// no tiene tope: se arma solo, una vez por entreno.
const WEEKLY = { review: [3, "análisis de rutinas"], strategy: [1, "cálculo de alimentación"], nutrition: [2, "análisis de tu semana de comidas"] };
async function overLimit(uid, kind) {
  const [max, label] = WEEKLY[kind];
  const weekAgo = new Date(Date.now() - 7 * 86400e3).toISOString();
  const done = arr(await sb(`/rest/v1/kairo_ai?user_id=eq.${uid}&kind=eq.${kind}&created_at=gte.${weekAgo}&select=created_at&order=created_at.asc`));
  if (done.length < max) return null;
  const next = new Date(new Date(done[0].created_at).getTime() + 7 * 86400e3);
  return Response.json({ error: `Ya usaste ${max === 1 ? "el" : `los ${max}`} ${label} de esta semana. Se libera el ${next.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "numeric" })}.` }, { status: 429 });
}

async function review(uid) {
  const routines = await loadRoutines(uid, null);
  if (!routines.length) return Response.json({ error: "Todavía no cargaste rutinas" }, { status: 400 });
  const ids = [...new Set(routines.flatMap(r => r.items.map(i => i.exercise_id)))];
  const hist = await history(uid, ids, 3);
  const profile = await loadProfile(uid);
  const desde = profile?.desde;
  const done = desde ? arr(await sb(`/rest/v1/kairo_workouts?user_id=eq.${uid}&finished_at=not.is.null&started_at=gte.${desde}&select=routine_name`)) : [];
  const lib = arr(await sb(`/rest/v1/kairo_exercises?or=(created_by.is.null,created_by.eq.${uid})&select=name,muscle,equipment&order=muscle.asc,name.asc`));
  const libText = Object.entries(lib.reduce((a, e) => { (a[e.muscle] ||= []).push(e.name); return a; }, {})).map(([m, n]) => `${m}: ${n.join(" · ")}`).join("\n");
  const text = routines.map(r => `Rutina "${r.name}" (routine_id ${r.id}) · días: ${r.days?.length ? r.days.map(d => DAYS[d]).join(", ") : "sin día fijo"}\n` + r.items.map((i, k) => {
    const h = hist[i.exercise_id] || [];
    return `  ${k + 1}. [item_id ${i.id}] ${i.exercise.name} (${i.exercise.muscle}, ${i.exercise.equipment || "—"}): ${i.sets} series, reps ${i.rep_min}–${i.rep_max}, descanso ${i.rest_sec}s${h.length ? ` · últimas: ${h.map(x => x.series).join(" | ")}` : ""}`;
  }).join("\n")).join("\n\n");
  const user = `${profileText(profile)}\n\nRevisá su esquema de entrenamiento: primero el conjunto (distribución de grupos musculares entre los días, volumen semanal por músculo) y después cada rutina por separado (orden de los ejercicios —compuestos pesados primero—, si sobra o falta algo, series y repeticiones). Para cada rutina proponé cambios concretos y aplicables solo donde valga la pena: cambiar un ejercicio por otro, agregar uno, sacar uno, cambiarlo de lugar o ajustar series/repeticiones. Para cambiar o agregar usá SOLO nombres exactos de esta biblioteca:\n${libText}\n\nEntrenos registrados en Kairo desde que la usa: ${done.length}.\n\n${text}`;
  const content = await ask(user, REVIEW_SCHEMA, "kairo-coach-review");
  const [row] = arr(await sb(`/rest/v1/kairo_ai`, { method: "POST", body: JSON.stringify({ user_id: uid, kind: "review", content }), headers: { Prefer: "return=representation" } }));
  return Response.json({ review: content, id: row?.id });
}

const STRATEGY_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["resumen", "calorias_dia", "proteina_g", "carbohidratos_g", "grasas_g", "ritmo_peso_semanal_kg", "alimentacion", "micronutrientes", "progreso"],
  properties: {
    resumen: { type: "string", description: "La estrategia de alimentación en 2-3 frases, en criollo y concreto." },
    calorias_dia: { type: "integer", description: "Calorías diarias objetivo (día promedio, contando el entrenamiento)." },
    proteina_g: { type: "integer" },
    carbohidratos_g: { type: "integer" },
    grasas_g: { type: "integer" },
    ritmo_peso_semanal_kg: { type: "number", description: "Cambio de peso semanal buscado (negativo = bajar)." },
    alimentacion: { type: "array", items: { type: "string" }, description: "3-5 pautas concretas para comer, respetando sus reglas de alimentación." },
    micronutrientes: { type: "array", items: { type: "string" }, description: "2-4 tips de micronutrientes a cuidar con este objetivo y este volumen de entrenamiento (ej. hierro, magnesio, vitamina D, sodio y potasio si suda mucho), con alimentos simples donde conseguirlos." },
    progreso: {
      type: "object", additionalProperties: false, required: ["estado", "lectura"],
      properties: {
        estado: { type: "string", enum: ["en_camino", "lento", "desviado", "sin_datos"] },
        lectura: { type: "string", description: "Qué dicen el peso y las medidas respecto del objetivo (ej. baja el peso pero sube el brazo: recomposición funcionando). Si no hay datos suficientes, qué registrar." },
      },
    },
  },
};

async function strategy(uid) {
  const profile = await loadProfile(uid);
  if (!profile?.objetivo) return Response.json({ error: "Primero cargá tu objetivo" }, { status: 400 });
  const logs = arr(await sb(`/rest/v1/kairo_body_logs?user_id=eq.${uid}&select=log_date,peso_kg,grasa_pct,cintura_cm,pecho_cm,brazo_cm,muslo_cm,cadera_cm,cuello_cm&order=log_date.asc&limit=120`));
  const since = new Date(Date.now() - 28 * 86400e3).toISOString();
  const recent = arr(await sb(`/rest/v1/kairo_workouts?user_id=eq.${uid}&finished_at=gte.${since}&select=started_at`));
  const fmt = (l) => [l.log_date, l.peso_kg && `${l.peso_kg} kg`, l.grasa_pct && `${l.grasa_pct}% grasa`, l.cintura_cm && `cintura ${l.cintura_cm}`, l.pecho_cm && `pecho ${l.pecho_cm}`, l.brazo_cm && `brazo ${l.brazo_cm}`, l.muslo_cm && `muslo ${l.muslo_cm}`, l.cadera_cm && `cadera ${l.cadera_cm}`, l.cuello_cm && `cuello ${l.cuello_cm}`].filter(Boolean).join(", ");
  const user = `${profileText(profile)}\n\nArmá su estrategia de alimentación para ese objetivo (calorías y macros: proteína, carbohidratos y grasas que cierren con las calorías) con tips de micronutrientes (teniendo en cuenta los suplementos que ya toma), y leé si viene progresando según su peso y medidas. Usá Mifflin-St Jeor para el gasto basal y ajustá por actividad (${recent.length} entrenamientos registrados en Kairo en las últimas 4 semanas; si empezó a usarla hace poco, guiate por los días por semana que declaró).\nRegistros de peso y medidas (más viejo primero):\n${logs.length ? logs.map(fmt).join("\n") : "sin registros"}`;
  const content = await ask(user, STRATEGY_SCHEMA, "kairo-coach-strategy");
  await sb(`/rest/v1/kairo_ai`, { method: "POST", body: JSON.stringify({ user_id: uid, kind: "strategy", content }), headers: { Prefer: "return=minimal" } });
  await sb(`/rest/v1/kairo_profile?user_id=eq.${uid}`, { method: "PATCH", body: JSON.stringify({ estrategia: content, estrategia_at: new Date().toISOString() }) });
  return Response.json({ strategy: content });
}

// Análisis de la semana de comidas (la plantilla fija L–D) contra el objetivo y los suplementos.
const NUTRITION_SCHEMA = {
  type: "object", additionalProperties: false, required: ["resumen", "dias", "faltantes", "sugerencias", "acciones"],
  properties: {
    resumen: { type: "string", description: "2-3 frases: si la semana cierra con el objetivo y qué es lo más importante a corregir." },
    dias: {
      type: "array", description: "Un elemento por día (lunes a domingo).",
      items: {
        type: "object", additionalProperties: false, required: ["dia", "estado", "nota"],
        properties: { dia: { type: "string" }, estado: { type: "string", enum: ["bien", "faltan", "sobran", "sin_cargar"] }, nota: { type: "string", description: "Qué pasa ese día en una frase (ej. 'faltan ~300 kcal y 40 g de proteína')." } },
      },
    },
    faltantes: {
      type: "array", description: "Nutrientes que quedan cortos o desbalanceados con esta forma de comer (micro o macro).",
      items: {
        type: "object", additionalProperties: false, required: ["nutriente", "detalle", "cubierto_por"],
        properties: { nutriente: { type: "string" }, detalle: { type: "string" }, cubierto_por: { type: "string", description: "Suplemento que ya toma y lo cubre, o vacío si no está cubierto." } },
      },
    },
    sugerencias: { type: "array", items: { type: "string" }, description: "1-3 consejos generales que no son un cambio puntual del plan (hidratación, horarios, cómo tomar un suplemento). Lo concreto va en acciones." },
    acciones: {
      type: "array", description: "Plan de acción: cambios concretos al plan semanal que la persona puede aplicar con un botón. Entre 2 y 6, los que más impacto tengan.",
      items: {
        type: "object", additionalProperties: false, required: ["id", "tipo", "dias", "comida", "alimento_actual", "nuevo", "motivo"],
        properties: {
          id: { type: "string", description: "Identificador corto único (a1, a2…)." },
          tipo: { type: "string", enum: ["cambiar", "agregar", "sacar"] },
          dias: { type: "array", items: { type: "integer" }, description: "Días donde aplica: 0 lunes … 6 domingo." },
          comida: { type: "string", enum: ["desayuno", "almuerzo", "merienda", "cena", "snacks"] },
          alimento_actual: { type: "string", description: "Para cambiar o sacar: nombre EXACTO del alimento como figura en el plan. Vacío si es agregar." },
          nuevo: { type: "string", description: "Para cambiar o agregar: alimento con cantidad en lenguaje natural (ej. '200 g de papa hervida'). Vacío si es sacar." },
          motivo: { type: "string", description: "Por qué, con el número que mueve (ej. '+25 g de proteína, llegás al objetivo')." },
        },
      },
    },
  },
};
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
async function nutrition(uid) {
  const profile = await loadProfile(uid);
  const plan = arr(await sb(`/rest/v1/kairo_meal_plan?user_id=eq.${uid}&select=dow,meal,name,qty,kcal,protein_g,carbs_g,fat_g&order=dow.asc,sort_order.asc`));
  if (!plan.length) return Response.json({ error: "Primero cargá tu semana de comidas" }, { status: 400 });
  const st = profile?.estrategia;
  const target = st ? `Objetivo diario: ${st.calorias_dia} kcal · ${st.proteina_g} g proteína · ${st.carbohidratos_g ?? "?"} g carbohidratos · ${st.grasas_g ?? "?"} g grasas.` : "Objetivo diario: todavía no calculado (estimalo con el perfil).";
  const days = DIAS.map((d, i) => {
    const items = plan.filter(p => p.dow === i);
    if (!items.length) return `${d}: sin cargar`;
    const sum = items.reduce((a, x) => ({ k: a.k + Number(x.kcal), p: a.p + Number(x.protein_g), c: a.c + Number(x.carbs_g), g: a.g + Number(x.fat_g) }), { k: 0, p: 0, c: 0, g: 0 });
    const cardio = (Array.isArray(profile?.cardio_plan) ? profile.cardio_plan : []).filter(x => x.days?.includes(i));
    const extra = cardio.reduce((a, x) => a + kcalFor(x.kind, x.minutes, x.intensity, profile?.peso_kg), 0);
    return `${d}${extra ? ` [hace ${cardio.map(x => sportName(x.kind)).join(" y ")}: el objetivo de ese día sube ≈ ${extra} kcal, en carbohidratos y grasas]` : ""} (total ${Math.round(sum.k)} kcal · P ${Math.round(sum.p)} · C ${Math.round(sum.c)} · G ${Math.round(sum.g)}): ` + items.map(x => `[${x.meal}] ${x.name}${x.qty ? ` ${x.qty}` : ""}`).join("; ");
  }).join("\n");
  const user = `${profileText(profile)}\n${target}\n\nAnalizá su plan semanal de comidas (come de forma repetitiva a propósito; no le propongas recetas). Los suplementos son parte de su día: contalos (si toma omega 3 no le falta omega 3 aunque no coma pescado; si toma creatina, es para el entrenamiento). Decí día por día si llega al objetivo, qué nutrientes le quedan cortos o desbalanceados (fibra, hierro, calcio, potasio, vitaminas, etc.) y si algún suplemento lo cubre. Después armá el plan de acción: cambios concretos sobre los alimentos que ya come (cambiar 100 g de arroz por 100 g de papa, sumar 1 huevo en el desayuno, sacar algo que sobra), con el nombre exacto del alimento del plan y los días donde aplica.\n\n${days}`;
  const content = await ask(user, NUTRITION_SCHEMA, "kairo-coach-nutrition");
  const [row] = arr(await sb(`/rest/v1/kairo_ai`, { method: "POST", body: JSON.stringify({ user_id: uid, kind: "nutrition", content }), headers: { Prefer: "return=representation" } }));
  return Response.json({ nutrition: content, id: row?.id });
}

export async function POST(req) {
  const me = await kairoUser(req);
  if (!me) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "plan" && body.routine_id) return await plan(me.id, body.routine_id);
    if (body.action === "review") return (me.role !== "admin" && await overLimit(me.id, "review")) || await review(me.id);
    if (body.action === "nutrition") return (me.role !== "admin" && await overLimit(me.id, "nutrition")) || await nutrition(me.id);
    if (body.action === "strategy") return (me.role !== "admin" && await overLimit(me.id, "strategy")) || await strategy(me.id);
    return Response.json({ error: "Acción inválida" }, { status: 400 });
  } catch (e) {
    console.error("[kairo coach]", e);
    return Response.json({ error: "La IA no respondió, probá de nuevo" }, { status: 502 });
  }
}
