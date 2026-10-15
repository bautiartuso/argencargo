// POST /api/kairo/coach   (sesión de admin)
// El entrenador con IA de Kairo · Físico.
//   { action: "plan", routine_id }  → qué hacer hoy en cada ejercicio (kilos × reps por serie) según
//                                     lo que venís levantando. Se guarda en kairo_ai y se reusa hasta
//                                     el próximo entreno de esa rutina.
//   { action: "review" }            → revisión de todas tus rutinas: si son efectivas, volumen por
//                                     músculo, qué cambiar y por qué.

import { SB_URL, SB_KEY } from "../../../../lib/sb-client";
import { callClaudeText } from "../../../../lib/anthropic";

const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const MODEL = "claude-opus-5-5";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const sb = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}${path}`, {
    ...init,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return null; }
};
const arr = (x) => (Array.isArray(x) ? x : []);

async function isAdmin(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!token) return false;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null);
  if (!u?.id) return false;
  const p = await sb(`/rest/v1/profiles?id=eq.${u.id}&select=role`);
  return Array.isArray(p) && p[0]?.role === "admin";
}

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
Kilos con un decimal como máximo y en saltos reales de gimnasio.`;

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
          nota: { type: "string", description: "Indicación técnica de ejecución o de esfuerzo para hoy (RIR, tempo, rango, cue técnico), máximo 14 palabras, en tono profesional. No digas 'primera vez' ni des ánimo." },
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
        type: "object", additionalProperties: false, required: ["rutina", "ejercicio", "sugerencia", "reemplazo"],
        properties: { rutina: { type: "string" }, ejercicio: { type: "string" }, sugerencia: { type: "string" }, reemplazo: { type: "string", description: "Ejercicio que lo reemplaza, o vacío si no se reemplaza." } },
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

async function loadRoutines(ids) {
  const filter = ids ? `&id=in.(${ids.join(",")})` : "";
  const routines = arr(await sb(`/rest/v1/kairo_routines?select=id,name,days&order=sort_order.asc${filter}`));
  const items = routines.length ? arr(await sb(`/rest/v1/kairo_routine_exercises?routine_id=in.(${routines.map(r => r.id).join(",")})&select=*,exercise:kairo_exercises(id,name,muscle,equipment)&order=sort_order.asc`)) : [];
  return routines.map(r => ({ ...r, items: items.filter(i => i.routine_id === r.id) }));
}

// Últimas sesiones de cada ejercicio: [{ fecha, series: "60×10, 60×9, 60×8" }]
async function history(exerciseIds, perExercise = 4) {
  if (!exerciseIds.length) return {};
  const sets = arr(await sb(`/rest/v1/kairo_sets?exercise_id=in.(${exerciseIds.join(",")})&select=exercise_id,workout_id,set_index,weight_kg,reps,created_at&order=created_at.desc&limit=1500`));
  const out = {};
  for (const id of exerciseIds) {
    const mine = sets.filter(s => s.exercise_id === id);
    const byWorkout = [];
    for (const s of mine) {
      let w = byWorkout.find(x => x.workout_id === s.workout_id);
      if (!w) { if (byWorkout.length >= perExercise) continue; w = { workout_id: s.workout_id, fecha: s.created_at.slice(0, 10), sets: [] }; byWorkout.push(w); }
      w.sets.push(s);
    }
    out[id] = byWorkout.map(w => ({ fecha: w.fecha, series: w.sets.sort((a, b) => a.set_index - b.set_index).map(s => `${Number(s.weight_kg)}×${s.reps}`).join(", ") }));
  }
  return out;
}

const OBJ = { volumen: "Volumen (superávit calórico)", definicion: "Definición (déficit calórico)", recomposicion: "Recomposición corporal", mantenimiento: "Mantenimiento", fuerza: "Fuerza" };
async function loadProfile() {
  const [p] = arr(await sb(`/rest/v1/kairo_profile?id=eq.1&select=*`));
  return p || null;
}
function profileText(p) {
  if (!p) return "Perfil: no cargado (asumí hipertrofia general, nivel intermedio).";
  return `Perfil: objetivo ${OBJ[p.objetivo] || p.objetivo || "—"} · experiencia ${p.experiencia || "—"} · ${p.sexo || "—"}, ${p.edad || "—"} años, ${p.peso_kg || "—"} kg, ${p.altura_cm || "—"} cm · entrena ${p.dias_semana || "—"} días/semana${p.lesiones ? ` · lesiones/limitaciones: ${p.lesiones}` : ""}${p.notas ? ` · notas: ${p.notas}` : ""}.`;
}

async function ask(user, schema, feature) {
  const text = await callClaudeText({ system: COACH, user, max_tokens: 8000, json_schema: schema, thinking: "adaptive", model: MODEL, feature });
  return JSON.parse(text);
}

async function plan(routineId) {
  const [routine] = await loadRoutines([routineId]);
  if (!routine) return Response.json({ error: "Rutina no encontrada" }, { status: 404 });
  if (!routine.items.length) return Response.json({ error: "La rutina no tiene ejercicios" }, { status: 400 });

  // Reusa el plan si no hubo un entreno de esta rutina ni cambió el perfil después de generarlo.
  const profile = await loadProfile();
  const [last] = arr(await sb(`/rest/v1/kairo_ai?kind=eq.plan&routine_id=eq.${routineId}&select=content,created_at&order=created_at.desc&limit=1`));
  const [lastWorkout] = arr(await sb(`/rest/v1/kairo_workouts?routine_id=eq.${routineId}&finished_at=not.is.null&select=finished_at&order=finished_at.desc&limit=1`));
  if (last && (!lastWorkout || last.created_at > lastWorkout.finished_at) && (!profile || last.created_at > profile.updated_at)) {
    const ids = new Set(routine.items.map(i => i.exercise_id));
    if (last.content.ejercicios?.every(e => ids.has(e.exercise_id))) return Response.json({ plan: last.content, cached: true });
  }

  const hist = await history(routine.items.map(i => i.exercise_id));
  const lines = routine.items.map(i => {
    const h = hist[i.exercise_id] || [];
    return `- exercise_id ${i.exercise_id} · ${i.exercise.name} (${i.exercise.muscle}, ${i.exercise.equipment || "—"}) · objetivo de la rutina: ${i.sets} series de ${i.rep_min}–${i.rep_max} reps\n  Últimas sesiones (la más reciente primero): ${h.length ? h.map(x => `${x.fecha}: ${x.series}`).join(" | ") : "sin historial"}`;
  }).join("\n");
  const user = `${profileText(profile)}\n\nHoy entrena la rutina "${routine.name}". Para cada ejercicio decidí qué hacer hoy y devolvé exactamente una serie por cada serie objetivo (kilos y repeticiones a buscar). Usá el exercise_id tal cual.\n\n${lines}`;
  const content = await ask(user, PLAN_SCHEMA, "kairo-coach-plan");
  await sb(`/rest/v1/kairo_ai`, { method: "POST", body: JSON.stringify({ kind: "plan", routine_id: routineId, content }), headers: { Prefer: "return=minimal" } });
  return Response.json({ plan: content });
}

async function review() {
  const routines = await loadRoutines(null);
  if (!routines.length) return Response.json({ error: "Todavía no cargaste rutinas" }, { status: 400 });
  const ids = [...new Set(routines.flatMap(r => r.items.map(i => i.exercise_id)))];
  const hist = await history(ids, 3);
  const since = new Date(Date.now() - 28 * 86400e3).toISOString();
  const recent = arr(await sb(`/rest/v1/kairo_workouts?finished_at=gte.${since}&select=routine_name,started_at`));
  const text = routines.map(r => `Rutina "${r.name}" · días: ${r.days?.length ? r.days.map(d => DAYS[d]).join(", ") : "sin día fijo"}\n` + r.items.map(i => {
    const h = hist[i.exercise_id] || [];
    return `  - ${i.exercise.name} (${i.exercise.muscle}): ${i.sets}×${i.rep_min}–${i.rep_max}, descanso ${i.rest_sec}s${h.length ? ` · últimas: ${h.map(x => x.series).join(" | ")}` : ""}`;
  }).join("\n")).join("\n\n");
  const profile = await loadProfile();
  const user = `${profileText(profile)}\n\nRevisá estas rutinas en función de ese objetivo. Decí si son efectivas para el objetivo, calculá las series semanales por grupo muscular (contando los días de cada rutina), y proponé cambios concretos (ejercicio por ejercicio) solo donde valga la pena.\nEntrenamientos hechos en las últimas 4 semanas: ${recent.length}.\n\n${text}`;
  const content = await ask(user, REVIEW_SCHEMA, "kairo-coach-review");
  await sb(`/rest/v1/kairo_ai`, { method: "POST", body: JSON.stringify({ kind: "review", content }), headers: { Prefer: "return=minimal" } });
  return Response.json({ review: content });
}

export async function POST(req) {
  if (!(await isAdmin(req))) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "plan" && body.routine_id) return await plan(body.routine_id);
    if (body.action === "review") return await review();
    return Response.json({ error: "Acción inválida" }, { status: 400 });
  } catch (e) {
    console.error("[kairo coach]", e);
    return Response.json({ error: "La IA no respondió, probá de nuevo" }, { status: 502 });
  }
}
