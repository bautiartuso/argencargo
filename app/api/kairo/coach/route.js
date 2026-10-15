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

const COACH = `Sos el entrenador personal de una sola persona, dentro de su app Kairo. Hablás en castellano rioplatense, directo y corto, como un buen coach de gimnasio: concreto, sin vueltas ni frases de relleno.
Su objetivo es el mayor desarrollo físico posible (hipertrofia y fuerza), entrenando de forma sostenible y sin lesionarse.
Principios que aplicás:
- Sobrecarga progresiva con doble progresión: dentro del rango de repeticiones de la rutina, primero se suben repeticiones; cuando todas las series llegan al tope del rango con buena técnica, se sube el peso (≈2,5 kg en compuestos, 1–2 kg o el salto mínimo de mancuerna en aislados) y se vuelve al piso del rango.
- Si en las últimas sesiones no progresó o bajó, mantenés o bajás un poco el peso; si se estancó 3+ sesiones, sugerís cambiar la variante del ejercicio.
- Volumen semanal razonable: ~10–20 series efectivas por grupo muscular grande; cuidás el balance empuje/tracción y que nada quede sin trabajar.
- Si no hay historial de un ejercicio, proponés un punto de partida conservador para encontrar el peso de trabajo.
Los kilos van con un decimal como máximo y en saltos que existan en un gimnasio.`;

const PLAN_SCHEMA = {
  type: "object", additionalProperties: false, required: ["mensaje", "ejercicios"],
  properties: {
    mensaje: { type: "string", description: "Una o dos frases para arrancar el entreno de hoy." },
    ejercicios: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["exercise_id", "accion", "series", "nota"],
        properties: {
          exercise_id: { type: "string" },
          accion: { type: "string", enum: ["subir_peso", "subir_reps", "mantener", "bajar_peso", "primera_vez", "cambiar"] },
          series: { type: "array", items: { type: "object", additionalProperties: false, required: ["kg", "reps"], properties: { kg: { type: "number" }, reps: { type: "integer" } } } },
          nota: { type: "string", description: "Por qué, en una frase corta." },
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

async function ask(user, schema, feature) {
  const text = await callClaudeText({ system: COACH, user, max_tokens: 8000, json_schema: schema, thinking: "adaptive", model: MODEL, feature });
  return JSON.parse(text);
}

async function plan(routineId) {
  const [routine] = await loadRoutines([routineId]);
  if (!routine) return Response.json({ error: "Rutina no encontrada" }, { status: 404 });
  if (!routine.items.length) return Response.json({ error: "La rutina no tiene ejercicios" }, { status: 400 });

  // Reusa el plan si no hubo un entreno de esta rutina después de generarlo.
  const [last] = arr(await sb(`/rest/v1/kairo_ai?kind=eq.plan&routine_id=eq.${routineId}&select=content,created_at&order=created_at.desc&limit=1`));
  const [lastWorkout] = arr(await sb(`/rest/v1/kairo_workouts?routine_id=eq.${routineId}&finished_at=not.is.null&select=finished_at&order=finished_at.desc&limit=1`));
  if (last && (!lastWorkout || last.created_at > lastWorkout.finished_at)) {
    const ids = new Set(routine.items.map(i => i.exercise_id));
    if (last.content.ejercicios?.every(e => ids.has(e.exercise_id))) return Response.json({ plan: last.content, cached: true });
  }

  const hist = await history(routine.items.map(i => i.exercise_id));
  const lines = routine.items.map(i => {
    const h = hist[i.exercise_id] || [];
    return `- exercise_id ${i.exercise_id} · ${i.exercise.name} (${i.exercise.muscle}, ${i.exercise.equipment || "—"}) · objetivo de la rutina: ${i.sets} series de ${i.rep_min}–${i.rep_max} reps\n  Últimas sesiones (la más reciente primero): ${h.length ? h.map(x => `${x.fecha}: ${x.series}`).join(" | ") : "sin historial"}`;
  }).join("\n");
  const user = `Hoy entrena la rutina "${routine.name}". Para cada ejercicio decidí qué hacer hoy y devolvé exactamente una serie por cada serie objetivo (kilos y repeticiones a buscar). Usá el exercise_id tal cual.\n\n${lines}`;
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
  const user = `Revisá estas rutinas. Decí si son efectivas para el objetivo, calculá las series semanales por grupo muscular (contando los días de cada rutina), y proponé cambios concretos (ejercicio por ejercicio) solo donde valga la pena.\nEntrenamientos hechos en las últimas 4 semanas: ${recent.length}.\n\n${text}`;
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
