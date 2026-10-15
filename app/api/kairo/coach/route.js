// POST /api/kairo/coach   (usuario de Kairo; todo se lee y guarda con su user_id)
// El entrenador con IA de Kairo · Físico.
//   { action: "plan", routine_id }  → qué hacer hoy en cada ejercicio (kilos × reps por serie) según
//                                     lo que venís levantando. Se guarda en kairo_ai y se reusa hasta
//                                     el próximo entreno de esa rutina.
//   { action: "review" }            → revisión de todas tus rutinas: si son efectivas, volumen por
//                                     músculo, qué cambiar y por qué.

import { callClaudeText } from "../../../../lib/anthropic";
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

const REVIEW_SCHEMA = {
  type: "object", additionalProperties: false, required: ["puntaje", "resumen", "fortalezas", "problemas", "cambios", "volumen"],
  properties: {
    puntaje: { type: "integer", description: "Qué tan efectivas son las rutinas para el objetivo, de 1 a 10." },
    resumen: { type: "string" },
    fortalezas: { type: "array", items: { type: "string" } },
    problemas: { type: "array", items: { type: "string" } },
    cambios: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["tipo", "rutina", "ejercicio", "sugerencia", "reemplazo"],
        properties: {
          tipo: { type: "string", enum: ["cambiar", "agregar", "sacar", "reordenar", "series"], description: "cambiar = reemplazar por otro; agregar = sumar un ejercicio; sacar = quitarlo; reordenar = moverlo de lugar; series = ajustar series/repeticiones/descanso." },
          rutina: { type: "string" }, ejercicio: { type: "string" }, sugerencia: { type: "string", description: "Qué hacer y por qué, concreto (ej. 'pasalo al principio: es el compuesto más pesado')." },
          reemplazo: { type: "string", description: "Ejercicio nuevo si es cambiar o agregar; vacío si no aplica." },
        },
      },
    },
    volumen: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["musculo", "series_semana", "opinion"],
        properties: { musculo: { type: "string" }, series_semana: { type: "integer" }, opinion: { type: "string", enum: ["poco", "bien", "mucho"] } },
      },
    },
  },
};

const DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

async function loadRoutines(uid, ids) {
  const filter = ids ? `&id=in.(${ids.join(",")})` : "";
  const routines = arr(await sb(`/rest/v1/kairo_routines?user_id=eq.${uid}&select=id,name,days&order=sort_order.asc${filter}`));
  const items = routines.length ? arr(await sb(`/rest/v1/kairo_routine_exercises?routine_id=in.(${routines.map(r => r.id).join(",")})&select=*,exercise:kairo_exercises(id,name,muscle,equipment)&order=sort_order.asc`)) : [];
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
async function loadProfile(uid) {
  const [p] = arr(await sb(`/rest/v1/kairo_profile?user_id=eq.${uid}&select=*`));
  if (p && p.fecha_nacimiento) p.edad = ageOf(p.fecha_nacimiento);
  return p || null;
}
function profileText(p) {
  if (!p) return "Perfil: no cargado (asumí hipertrofia general, nivel intermedio).";
  return `Perfil: objetivo ${OBJ[p.objetivo] || p.objetivo || "—"}${p.tendencia ? ` (${p.tendencia})` : ""}${p.objetivo_detalle ? ` · en sus palabras: "${p.objetivo_detalle}"` : ""}${p.reglas_gym ? ` · reglas para el entrenamiento: "${p.reglas_gym}"` : ""}${p.reglas_nutricion ? ` · reglas para la alimentación: "${p.reglas_nutricion}"` : ""} · experiencia ${p.experiencia || "—"} · ${p.sexo || "—"}, ${p.edad || "—"} años, ${p.peso_kg || "—"} kg, ${p.altura_cm || "—"} cm · entrena ${p.dias_semana || "—"} días/semana${p.lesiones ? ` · lesiones/limitaciones: ${p.lesiones}` : ""}${p.notas ? ` · notas: ${p.notas}` : ""}.`;
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
  const since = new Date(Date.now() - 28 * 86400e3).toISOString();
  const recent = arr(await sb(`/rest/v1/kairo_workouts?user_id=eq.${uid}&finished_at=gte.${since}&select=routine_name,started_at`));
  const text = routines.map(r => `Rutina "${r.name}" · días: ${r.days?.length ? r.days.map(d => DAYS[d]).join(", ") : "sin día fijo"}\n` + r.items.map(i => {
    const h = hist[i.exercise_id] || [];
    return `  - ${i.exercise.name} (${i.exercise.muscle}): ${i.sets}×${i.rep_min}–${i.rep_max}, descanso ${i.rest_sec}s${h.length ? ` · últimas: ${h.map(x => x.series).join(" | ")}` : ""}`;
  }).join("\n")).join("\n\n");
  const profile = await loadProfile(uid);
  const user = `${profileText(profile)}\n\nRevisá estas rutinas a fondo en función de ese objetivo: si son efectivas, la distribución de grupos musculares entre los días, el orden de los ejercicios dentro de cada rutina (compuestos pesados primero, aislados al final), si sobra o falta volumen, y las series y repeticiones de cada ejercicio. Calculá las series semanales por grupo muscular (contando los días de cada rutina o la rotación) y proponé cambios concretos solo donde valga la pena: reemplazar un ejercicio, agregar uno que falte, sacar uno que sobre, cambiarlo de lugar o ajustar sus series.\nEntrenamientos hechos en las últimas 4 semanas: ${recent.length}.\n\n${text}`;
  const content = await ask(user, REVIEW_SCHEMA, "kairo-coach-review");
  await sb(`/rest/v1/kairo_ai`, { method: "POST", body: JSON.stringify({ user_id: uid, kind: "review", content }), headers: { Prefer: "return=minimal" } });
  return Response.json({ review: content });
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
  const supps = arr(await sb(`/rest/v1/kairo_supplements?user_id=eq.${uid}&active=eq.true&select=name,dose`));
  const fmt = (l) => [l.log_date, l.peso_kg && `${l.peso_kg} kg`, l.grasa_pct && `${l.grasa_pct}% grasa`, l.cintura_cm && `cintura ${l.cintura_cm}`, l.pecho_cm && `pecho ${l.pecho_cm}`, l.brazo_cm && `brazo ${l.brazo_cm}`, l.muslo_cm && `muslo ${l.muslo_cm}`, l.cadera_cm && `cadera ${l.cadera_cm}`, l.cuello_cm && `cuello ${l.cuello_cm}`].filter(Boolean).join(", ");
  const user = `${profileText(profile)}\n\nArmá su estrategia de alimentación para ese objetivo (calorías y macros: proteína, carbohidratos y grasas que cierren con las calorías) con tips de micronutrientes (teniendo en cuenta los suplementos que ya toma: ${supps.length ? supps.map(x => x.name + (x.dose ? ` ${x.dose}` : "")).join(", ") : "ninguno"}), y leé si viene progresando según su peso y medidas. Usá Mifflin-St Jeor para el gasto basal y ajustá por actividad (${recent.length} entrenamientos en las últimas 4 semanas).\nRegistros de peso y medidas (más viejo primero):\n${logs.length ? logs.map(fmt).join("\n") : "sin registros"}`;
  const content = await ask(user, STRATEGY_SCHEMA, "kairo-coach-strategy");
  await sb(`/rest/v1/kairo_ai`, { method: "POST", body: JSON.stringify({ user_id: uid, kind: "strategy", content }), headers: { Prefer: "return=minimal" } });
  await sb(`/rest/v1/kairo_profile?user_id=eq.${uid}`, { method: "PATCH", body: JSON.stringify({ estrategia: content, estrategia_at: new Date().toISOString() }) });
  return Response.json({ strategy: content });
}

// Análisis de la semana de comidas (la plantilla fija L–D) contra el objetivo y los suplementos.
const NUTRITION_SCHEMA = {
  type: "object", additionalProperties: false, required: ["resumen", "dias", "faltantes", "sugerencias"],
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
    sugerencias: { type: "array", items: { type: "string" }, description: "3-5 cambios simples y repetibles (mismos alimentos de todos los días, cantidades concretas). Nada de recetas elaboradas." },
  },
};
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
async function nutrition(uid) {
  const profile = await loadProfile(uid);
  const plan = arr(await sb(`/rest/v1/kairo_meal_plan?user_id=eq.${uid}&select=dow,meal,name,qty,kcal,protein_g,carbs_g,fat_g&order=dow.asc,sort_order.asc`));
  if (!plan.length) return Response.json({ error: "Primero cargá tu semana de comidas" }, { status: 400 });
  const supps = arr(await sb(`/rest/v1/kairo_supplements?user_id=eq.${uid}&active=eq.true&select=name,dose,times`));
  const st = profile?.estrategia;
  const target = st ? `Objetivo diario: ${st.calorias_dia} kcal · ${st.proteina_g} g proteína · ${st.carbohidratos_g ?? "?"} g carbohidratos · ${st.grasas_g ?? "?"} g grasas.` : "Objetivo diario: todavía no calculado (estimalo con el perfil).";
  const days = DIAS.map((d, i) => {
    const items = plan.filter(p => p.dow === i);
    if (!items.length) return `${d}: sin cargar`;
    const sum = items.reduce((a, x) => ({ k: a.k + Number(x.kcal), p: a.p + Number(x.protein_g), c: a.c + Number(x.carbs_g), g: a.g + Number(x.fat_g) }), { k: 0, p: 0, c: 0, g: 0 });
    return `${d} (total ${Math.round(sum.k)} kcal · P ${Math.round(sum.p)} · C ${Math.round(sum.c)} · G ${Math.round(sum.g)}): ` + items.map(x => `[${x.meal}] ${x.name}${x.qty ? ` ${x.qty}` : ""}`).join("; ");
  }).join("\n");
  const user = `${profileText(profile)}\n${target}\nSuplementos que toma: ${supps.length ? supps.map(s => `${s.name}${s.dose ? ` (${s.dose})` : ""}`).join(", ") : "ninguno"}.\n\nAnalizá su semana de comidas (come de forma repetitiva a propósito; no le propongas recetas). Decí día por día si llega al objetivo, qué nutrientes le quedan cortos o desbalanceados (fibra, hierro, calcio, omega 3, potasio, vitaminas, etc.) y si algún suplemento que ya toma lo cubre. Las sugerencias tienen que ser cambios simples con los mismos alimentos o agregados fáciles.\n\n${days}`;
  const content = await ask(user, NUTRITION_SCHEMA, "kairo-coach-nutrition");
  await sb(`/rest/v1/kairo_ai`, { method: "POST", body: JSON.stringify({ user_id: uid, kind: "nutrition", content }), headers: { Prefer: "return=minimal" } });
  return Response.json({ nutrition: content });
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
