"use client";
// Kairo · Físico. Rutinas estilo Hevy, entreno en vivo a pantalla completa (WorkoutLayer, montado en
// el shell para que siga vivo al cambiar de pestaña), descanso con sonido + push, fotos y músculos
// de cada ejercicio (free-exercise-db, dominio público), progreso, y la IA de /api/kairo/coach con
// tu perfil (objetivo, experiencia, medidas).
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { dq, loadSession } from "../../lib/sb-client";
import BodyMap from "./body";
import { C, I, Icon, pushToast, Sheet, SectionTitle, Label, MiniStat, card, field, btnLime, btnGhost, linkBtn, dayLabel, ymd } from "./ui";

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const todayDow = () => (new Date().getDay() + 6) % 7; // 0 = lunes
const DRAFT_KEY = "kairo_workout";
const WORKOUT_EVENT = "kairo-workout";
const ACTION_LABEL = { subir_peso: "Subir carga", subir_reps: "Subir reps", mantener: "Mantener", bajar_peso: "Bajar carga", cambiar: "Cambiar variante" };
const MUSCLE_ES = { abdominals: "Abdomen", abductors: "Abductores", adductors: "Aductores", biceps: "Bíceps", calves: "Gemelos", chest: "Pecho", forearms: "Antebrazos", glutes: "Glúteos", hamstrings: "Isquiotibiales", lats: "Dorsales", "lower back": "Lumbares", "middle back": "Espalda media", neck: "Cuello", quadriceps: "Cuádriceps", shoulders: "Hombros", traps: "Trapecios", triceps: "Tríceps" };
const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

const IMG = (id, n = 0) => `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/${encodeURIComponent(id)}/${n}.jpg`;
const fmtKg = (n) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 1 });
const clock = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`; };
const restLabel = (s) => !s ? "Sin descanso" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}min${s % 60 ? ` ${s % 60}s` : ""}`;
const num = (s) => Number(String(s).replace(",", ".")) || 0;
const e1rm = (kg, reps) => reps > 0 ? kg * (1 + reps / 30) : 0; // Epley
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; } };
const saveDraft = (d) => { try { d ? localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) : localStorage.removeItem(DRAFT_KEY); } catch {} window.dispatchEvent(new Event(WORKOUT_EVENT)); };
const authToken = (token) => loadSession()?.token || token;

async function api(path, token, body) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken(token)}` }, body: JSON.stringify(body) });
  return r.json().catch(() => ({}));
}

// ─────── Sonido y push del descanso ───────
// El sonido sale por Web Audio con la sesión de audio en "playback": así suena aunque el iPhone
// esté en silencio, mientras Kairo esté abierto. Con el celu bloqueado avisa el push del servidor.
const sound = { ctx: null };
function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
    if (!sound.ctx) sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (sound.ctx.state === "suspended") sound.ctx.resume();
  } catch {}
}
function beep() {
  const ctx = sound.ctx; if (!ctx) return;
  [0, 0.28, 0.56].forEach((t, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22);
    o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.24);
  });
  try { navigator.vibrate?.([200, 80, 200]); } catch {}
}
async function ensurePush(token) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    if (!VAPID) return;
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    const reg = await navigator.serviceWorker.register("/sw-kairo.js", { scope: "/kairo" });
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const pad = "=".repeat((4 - VAPID.length % 4) % 4), raw = atob((VAPID + pad).replace(/-/g, "+").replace(/_/g, "/"));
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, c => c.charCodeAt(0)) });
    }
    await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken(token)}` }, body: JSON.stringify({ subscription: sub.toJSON(), portal: "kairo" }) });
  } catch (e) { console.warn("[kairo push]", e); }
}

// ─────── Datos ───────
function useGym(token) {
  const [routines, setRoutines] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [profile, setProfile] = useState(undefined);
  const [lo, setLo] = useState(true);
  const load = useCallback(async () => {
    const [r, it, ex, w, p] = await Promise.all([
      dq("kairo_routines", { token, filters: "?select=*&order=sort_order.asc,created_at.asc" }),
      dq("kairo_routine_exercises", { token, filters: "?select=*&order=sort_order.asc" }),
      dq("kairo_exercises", { token, filters: "?select=*&order=muscle.asc,name.asc" }),
      dq("kairo_workouts", { token, filters: "?select=*,sets:kairo_sets(exercise_id,weight_kg,reps,set_index)&finished_at=not.is.null&order=started_at.desc&limit=200" }),
      dq("kairo_profile", { token, filters: "?select=*&limit=1" }),
    ]);
    const exs = Array.isArray(ex) ? ex : [];
    const items = (Array.isArray(it) ? it : []).map(i => ({ ...i, exercise: exs.find(e => e.id === i.exercise_id) })).filter(i => i.exercise);
    setExercises(exs);
    setRoutines((Array.isArray(r) ? r : []).map(rt => ({ ...rt, items: items.filter(i => i.routine_id === rt.id) })));
    setWorkouts(Array.isArray(w) ? w : []);
    setProfile(Array.isArray(p) ? p[0] || null : null);
    setLo(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const f = () => { if (!loadDraft()) load(); }; window.addEventListener(WORKOUT_EVENT, f); return () => window.removeEventListener(WORKOUT_EVENT, f); }, [load]);
  return { routines, exercises, workouts, profile, lo, load };
}

// Arma el borrador de un entreno: lo último que hiciste de cada ejercicio queda como referencia.
async function buildItems(token, list) {
  const ids = list.map(i => i.exercise.id);
  const prevSets = ids.length ? await dq("kairo_sets", { token, filters: `?exercise_id=in.(${ids.join(",")})&select=exercise_id,workout_id,set_index,weight_kg,reps,created_at&order=created_at.desc&limit=600` }) : [];
  return list.map(i => {
    const mine = (Array.isArray(prevSets) ? prevSets : []).filter(s => s.exercise_id === i.exercise.id);
    const wid = mine[0]?.workout_id;
    const prev = mine.filter(s => s.workout_id === wid).sort((a, b) => a.set_index - b.set_index).map(s => ({ kg: Number(s.weight_kg), reps: s.reps }));
    return {
      key: Math.random().toString(36).slice(2), exercise_id: i.exercise.id, name: i.exercise.name, media_id: i.exercise.media_id || null,
      mp: i.exercise.muscles_primary || [], ms: i.exercise.muscles_secondary || [],
      rest_sec: i.rest_sec ?? 90, rep_min: i.rep_min ?? 8, rep_max: i.rep_max ?? 12, prev, ai: null,
      sets: Array.from({ length: i.sets || Math.max(prev.length, 3) }, () => ({ kg: "", reps: "", done: false })),
    };
  });
}

// ─────── Sección ───────
// Arranca un entreno (desde Físico o desde Inicio).
export async function startWorkout(token, routine) {
  if (loadDraft()) { window.dispatchEvent(new CustomEvent("kairo-workout-open")); return pushToast("Ya tenés un entreno en curso"); }
  unlockAudio(); ensurePush(token);
  const items = await buildItems(token, routine.items);
  saveDraft({ routine_id: routine.id, routine_name: routine.name, started_at: new Date().toISOString(), plan: false, items });
  window.dispatchEvent(new CustomEvent("kairo-workout-open"));
}

// Qué toca hoy. Dos formas de organizar los días (perfil.dias):
//  · días fijos: cada rutina tiene sus días de la semana.
//  · rotación: una secuencia de rutinas y descansos que se repite sin importar el día de la semana
//    (ej. pecho, espalda, pierna, descanso…); "inicio" es la fecha en que tocó el primer lugar.
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400e3);
export function todayPlan(routines, dias) {
  if (dias?.modo === "rotacion" && dias.orden?.length && dias.inicio) {
    const n = dias.orden.length, i = ((daysBetween(dias.inicio, ymd(new Date())) % n) + n) % n;
    const slot = dias.orden[i], next = dias.orden[(i + 1) % n];
    const find = (id) => routines.find(r => r.id === id) || null;
    return { modo: "rotacion", hoy: slot === "descanso" ? [] : [find(slot)].filter(Boolean), descanso: slot === "descanso", manana: next === "descanso" ? "Descanso" : find(next)?.name || null };
  }
  const dow = todayDow();
  return { modo: "fijos", hoy: routines.filter(r => r.days?.includes(dow)), descanso: false, manana: null };
}

export default function Fisico({ token, onProfile }) {
  const gym = useGym(token);
  const [view, setView] = useState("entrenar");
  const [sheet, setSheet] = useState(null);
  const start = (routine) => startWorkout(token, routine);

  const dow = todayDow();
  const plan = todayPlan(gym.routines, gym.profile?.dias);
  const todays = plan.hoy;
  const others = gym.routines.filter(r => !todays.includes(r));

  return <>
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
      <Segmented value={view} onChange={setView} options={[["entrenar", "Entrenar"], ["rutinas", "Rutinas"], ["progreso", "Progreso"]]} />
      <button onClick={onProfile} aria-label="Tu perfil" className="k-press" style={{ position: "absolute", right: 0, width: 38, height: 38, borderRadius: 19, border: `0.5px solid ${C.line}`, background: C.card, color: C.sub, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon d={I.user} size={18} />
      </button>
    </div>

    {gym.lo ? <p style={{ color: C.sub, textAlign: "center", padding: "60px 0" }}>Cargando…</p> : <>
      {!gym.profile?.objetivo && <button className="k-press" onClick={onProfile} style={{ ...card, width: "100%", textAlign: "left", color: C.text, marginTop: 18, display: "flex", gap: 12, alignItems: "center", borderColor: "rgba(198,244,50,0.3)" }}>
        <Icon d={I.spark} size={20} color={C.lime} />
        <span style={{ flex: 1 }}><span style={{ fontSize: 15, fontWeight: 500, display: "block" }}>Definí tu objetivo</span><span style={{ fontSize: 13, color: C.sub }}>Volumen, definición, recomposición… La IA planifica las cargas con eso.</span></span>
        <Icon d={I.right} size={16} color={C.sub} />
      </button>}

      {view === "entrenar" && <>
        {gym.routines.length === 0 ? <Empty onNew={() => setSheet({ type: "routine" })} /> : <>
          <SectionTitle right={plan.manana && <span style={{ fontSize: 12, color: C.dim }}>Mañana: {plan.manana}</span>}>Hoy · {DAYS_FULL[dow]}{plan.modo === "rotacion" ? " · rotación" : ""}</SectionTitle>
          {todays.length === 0 ? <div style={{ ...card, color: C.sub, fontSize: 14 }}>{plan.descanso ? "Hoy te toca descanso. Si igual querés entrenar, elegí una de abajo." : "Hoy no tenés rutina asignada. Podés hacer cualquiera de abajo."}</div>
            : todays.map(r => <RoutineCard key={r.id} r={r} big onStart={() => start(r)} />)}
          {others.length > 0 && <>
            <SectionTitle>Otras rutinas</SectionTitle>
            <div style={{ display: "grid", gap: 10 }}>{others.map(r => <RoutineCard key={r.id} r={r} onStart={() => start(r)} />)}</div>
          </>}
          <WeekStats workouts={gym.workouts} />
        </>}
      </>}

      {view === "rutinas" && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
          <button className="k-press" onClick={() => setSheet({ type: "review" })} disabled={!gym.routines.length} style={{ ...btnGhost, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: gym.routines.length ? 1 : 0.5 }}>
            <Icon d={I.spark} size={17} color={C.lime} />Analizar con IA
          </button>
          <button className="k-press" onClick={() => setSheet({ type: "routine" })} style={{ ...btnLime, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Icon d={I.plus} size={18} sw={2.2} />Rutina
          </button>
        </div>
        {gym.routines.length > 0 && <button className="k-press" onClick={() => setSheet({ type: "dias" })} style={{ ...card, width: "100%", textAlign: "left", color: C.text, marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <Icon d={I.timer} size={20} color={C.lime} />
          <span style={{ flex: 1 }}><span style={{ fontSize: 15, fontWeight: 500, display: "block" }}>{gym.profile?.dias?.modo === "rotacion" ? "Rotación" : "Días fijos"}</span><span style={{ fontSize: 13, color: C.sub }}>{gym.profile?.dias?.modo === "rotacion" ? gym.profile.dias.orden.map(o => o === "descanso" ? "Descanso" : gym.routines.find(r => r.id === o)?.name || "—").join(" → ") : "Cada rutina en sus días de la semana"}</span></span>
          <Icon d={I.right} size={16} color={C.sub} />
        </button>}
        {gym.routines.length === 0 ? <div style={{ ...card, color: C.sub, fontSize: 14, marginTop: 18 }}>Creá tu primera rutina: nombre, días y ejercicios.</div> :
          <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
            {gym.routines.map(r => <button key={r.id} className="k-press" onClick={() => setSheet({ type: "routine", routine: r })} style={{ ...card, textAlign: "left", color: C.text, width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{r.name}</span>
                <DayDots days={r.days} />
              </div>
              <div style={{ display: "flex", marginTop: 12 }}>{r.items.slice(0, 7).map((i, k) => <span key={i.id} style={{ marginLeft: k ? -8 : 0 }}><Thumb ex={i.exercise} size={30} ring /></span>)}</div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 10, lineHeight: 1.5 }}>{r.items.length} ejercicios · {r.items.reduce((s, i) => s + i.sets, 0)} series</div>
            </button>)}
          </div>}
      </>}

      {view === "progreso" && <Progress workouts={gym.workouts} exercises={gym.exercises} onOpenWorkout={(w) => setSheet({ type: "workout", w })} onOpenExercise={(ex) => setSheet({ type: "exercise", ex })} />}
    </>}

    {sheet?.type === "routine" && <RoutineSheet token={token} routine={sheet.routine} exercises={gym.exercises} count={gym.routines.length} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); gym.load(); }} />}
    {sheet?.type === "dias" && <DaysSheet token={token} routines={gym.routines} dias={gym.profile?.dias} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); gym.load(); }} />}
    {sheet?.type === "review" && <ReviewSheet token={token} onClose={() => setSheet(null)} />}
    {sheet?.type === "workout" && <WorkoutDetail w={sheet.w} exercises={gym.exercises} token={token} onClose={() => setSheet(null)} onDeleted={() => { setSheet(null); gym.load(); }} />}
    {sheet?.type === "exercise" && <ExerciseInfo ex={sheet.ex} token={token} onClose={() => setSheet(null)} />}
  </>;
}

function Segmented({ value, onChange, options }) {
  return <div style={{ display: "flex", background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 999, padding: 3 }}>
    {options.map(([id, label]) => <button key={id} onClick={() => onChange(id)} className="k-press" style={{ border: "none", borderRadius: 999, padding: "7px 15px", fontSize: 14, fontWeight: 500, background: value === id ? C.cardHi : "transparent", color: value === id ? C.text : C.sub }}>{label}</button>)}
  </div>;
}

function DayDots({ days }) {
  return <span style={{ display: "flex", gap: 3 }}>{DAYS.map((d, i) => <span key={i} style={{ width: 17, height: 17, borderRadius: 9, fontSize: 9.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", background: days?.includes(i) ? C.lime : "transparent", color: days?.includes(i) ? C.limeInk : C.dim }}>{d}</span>)}</span>;
}

// Miniatura del ejercicio: la figura con los músculos que trabaja (del lado que más se ve).
function Thumb({ ex, size = 44, ring }) {
  return <span style={{ width: size, height: size, borderRadius: size / 2, background: C.cardHi, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: ring ? `2px solid ${C.card}` : `0.5px solid ${C.line}` }}>
    <BodyMap primary={ex?.muscles_primary || []} secondary={ex?.muscles_secondary || []} side="auto" zoom size={size * 0.96} />
  </span>;
}

function Empty({ onNew }) {
  return <div style={{ ...card, marginTop: 22, padding: "32px 20px", textAlign: "center" }}>
    <div style={{ color: C.dim, display: "flex", justifyContent: "center" }}><Icon d={I.gym} size={34} sw={1.4} /></div>
    <p style={{ margin: "14px 0 4px", fontSize: 16, fontWeight: 500 }}>Armá tu primera rutina</p>
    <p style={{ margin: "0 0 18px", fontSize: 14, color: C.sub }}>La IA la revisa y te marca carga y repeticiones en cada entreno.</p>
    <button className="k-press" onClick={onNew} style={btnLime}>Crear rutina</button>
  </div>;
}

function RoutineCard({ r, big, onStart }) {
  const sets = r.items.reduce((s, i) => s + i.sets, 0);
  const muscles = [...new Set(r.items.flatMap(i => i.exercise.muscles_primary || []))];
  return <div style={{ ...card, marginBottom: big ? 10 : 0, padding: big ? 18 : 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: big ? 21 : 16, fontWeight: 600, letterSpacing: "-0.02em" }}>{r.name}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{r.items.length} ejercicios · {sets} series</div>
      </div>
      {big ? <BodyMap primary={muscles} size={70} /> : <button className="k-press" onClick={onStart} disabled={!r.items.length} style={{ ...btnGhost, width: "auto", padding: "9px 16px", fontSize: 14 }}>Empezar</button>}
    </div>
    {big && <>
      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        {r.items.map(i => <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Thumb ex={i.exercise} size={32} />
          <span style={{ flex: 1, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.exercise.name}</span>
          <span className="k-num" style={{ fontSize: 13, color: C.sub }}>{i.sets} × {i.rep_min}–{i.rep_max}</span>
        </div>)}
      </div>
      <button className="k-press" onClick={onStart} disabled={!r.items.length} style={{ ...btnLime, marginTop: 16 }}>Empezar entreno</button>
    </>}
  </div>;
}

function WeekStats({ workouts }) {
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - todayDow());
  const week = workouts.filter(w => new Date(w.started_at) >= monday);
  const vol = week.reduce((s, w) => s + (w.sets || []).reduce((a, x) => a + Number(x.weight_kg) * x.reps, 0), 0);
  const mins = week.reduce((s, w) => s + (new Date(w.finished_at) - new Date(w.started_at)) / 60000, 0);
  return <>
    <SectionTitle>Esta semana</SectionTitle>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <MiniStat label="Entrenos" value={week.length} />
      <MiniStat label="Tiempo" value={mins >= 60 ? `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m` : `${Math.round(mins)}m`} />
      <MiniStat label="Volumen" value={`${fmtKg(vol / 1000)} t`} />
    </div>
  </>;
}

// ─────── Entreno en vivo (capa a pantalla completa; vive en el shell) ───────
export function WorkoutLayer({ token }) {
  const [draft, setDraftState] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sync = () => { const d = loadDraft(); setDraftState(d); if (!d) setOpen(false); };
    const openIt = () => { setDraftState(loadDraft()); setOpen(true); };
    sync();
    window.addEventListener(WORKOUT_EVENT, sync); window.addEventListener("kairo-workout-open", openIt);
    return () => { window.removeEventListener(WORKOUT_EVENT, sync); window.removeEventListener("kairo-workout-open", openIt); };
  }, []);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!draft) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [draft]);
  if (!draft) return null;
  if (!open) return <button onClick={() => { unlockAudio(); setOpen(true); }} className="k-press" style={{ position: "fixed", left: 12, right: 12, bottom: "calc(max(16px, min(env(safe-area-inset-bottom), 22px)) + 62px)", zIndex: 45, maxWidth: 456, margin: "0 auto", background: C.cardHi, border: `0.5px solid ${C.line}`, borderRadius: 16, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", color: C.text, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
    <span style={{ textAlign: "left" }}><span style={{ fontSize: 11, color: C.sub, display: "block" }}>Entreno en curso</span><span style={{ fontSize: 15, fontWeight: 500 }}>{draft.routine_name}</span></span>
    <span className="k-num" style={{ fontSize: 18, color: C.lime, fontWeight: 500 }}>{clock((now - new Date(draft.started_at)) / 1000)}</span>
  </button>;
  return <Workout token={token} draft={draft} now={now} setDraft={(d) => { setDraftState(d); saveDraft(d); }} onMinimize={() => setOpen(false)} onDone={() => { saveDraft(null); setDraftState(null); setOpen(false); }} />;
}

function Workout({ token, draft, now, setDraft, onMinimize, onDone }) {
  const [rest, setRest] = useState(null); // { until, total, timerId, label }
  const [sheet, setSheet] = useState(null);
  const [loadingAi, setLoadingAi] = useState(!draft.plan);
  const latest = useRef(draft); latest.current = draft;
  const restRef = useRef(rest); restRef.current = rest;

  // Plan de la IA (una vez por entreno; queda guardado en el borrador).
  useEffect(() => {
    if (draft.plan || !draft.routine_id) { setLoadingAi(false); return; }
    let alive = true;
    api("/api/kairo/coach", token, { action: "plan", routine_id: draft.routine_id }).then(r => {
      if (!alive) return;
      setLoadingAi(false);
      if (!r.plan) return;
      const d = latest.current;
      setDraft({ ...d, plan: true, items: d.items.map(it => ({ ...it, ai: r.plan.ejercicios.find(e => e.exercise_id === it.exercise_id) || it.ai })) });
    }).catch(() => alive && setLoadingAi(false));
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fin del descanso: si Kairo está a la vista suena adentro (y se cancela el push); si no, avisa el push.
  useEffect(() => {
    if (!rest) return;
    if (now >= rest.until - 1500 && rest.timerId && !rest.cancelled && document.visibilityState === "visible") {
      api("/api/kairo/rest", token, { cancel: rest.timerId });
      setRest({ ...rest, cancelled: true });
    }
    if (now >= rest.until) { if (document.visibilityState === "visible") beep(); setRest(null); }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRest = async (seconds, label) => {
    const prev = restRef.current;
    if (prev?.timerId && !prev.cancelled) api("/api/kairo/rest", token, { cancel: prev.timerId });
    if (!seconds) return setRest(null);
    const until = Date.now() + seconds * 1000;
    setRest({ until, total: seconds, label, timerId: null });
    const r = await api("/api/kairo/rest", token, { seconds, title: "Descanso terminado", body: label || "A la próxima serie" });
    setRest(cur => cur && cur.until === until ? { ...cur, timerId: r.id || null } : cur);
    if (r.id && restRef.current?.until !== until) api("/api/kairo/rest", token, { cancel: r.id });
  };
  const shiftRest = (delta) => { const r = restRef.current; if (!r) return; const left = Math.max(0, (r.until - Date.now()) / 1000) + delta; startRest(Math.round(left), r.label).then(() => {}); setRest(cur => cur ? { ...cur, total: Math.max(cur.total + delta, 1) } : cur); };
  const skipRest = () => { const r = restRef.current; if (r?.timerId && !r.cancelled) api("/api/kairo/rest", token, { cancel: r.timerId }); setRest(null); };

  const elapsed = (now - new Date(draft.started_at).getTime()) / 1000;
  const mapItems = (fn) => setDraft({ ...latest.current, items: latest.current.items.map(fn) });
  const update = (key, si, patch) => mapItems(it => it.key !== key ? it : { ...it, sets: it.sets.map((s, j) => j !== si ? s : { ...s, ...patch }) });
  const target = (it, si) => {
    const ai = it.ai?.series;
    if (ai?.length) return ai[Math.min(si, ai.length - 1)];
    const p = it.prev[si] || it.prev[it.prev.length - 1];
    return p ? { kg: p.kg, reps: p.reps } : null;
  };
  const nextLabel = (key, si) => {
    const items = latest.current.items, ix = items.findIndex(i => i.key === key), it = items[ix];
    const nextSet = it.sets.findIndex((s, j) => j > si && !s.done);
    const [nit, nsi] = nextSet >= 0 ? [it, nextSet] : [items.slice(ix + 1).find(i => i.sets.some(s => !s.done)), 0];
    if (!nit) return "Última serie hecha. Terminá cuando quieras.";
    const t = target(nit, nsi);
    return `${nit.name} · serie ${nsi + 1}${t ? ` · ${fmtKg(t.kg)} kg × ${t.reps}` : ""}`;
  };
  const toggle = (it, si) => {
    unlockAudio();
    const s = it.sets[si], t = target(it, si);
    if (s.done) return update(it.key, si, { done: false });
    const kgV = s.kg !== "" ? s.kg : t ? String(t.kg).replace(".", ",") : "";
    const repsV = s.reps !== "" ? s.reps : t ? String(t.reps) : "";
    if (repsV === "") return pushToast("Poné las repeticiones");
    update(it.key, si, { done: true, kg: kgV || "0", reps: repsV });
    startRest(it.rest_sec, nextLabel(it.key, si));
  };

  const done = draft.items.flatMap(it => it.sets.filter(s => s.done));
  const volume = done.reduce((a, s) => a + num(s.kg) * num(s.reps), 0);
  const trained = draft.items.filter(it => it.sets.some(s => s.done));
  const mp = [...new Set(trained.flatMap(it => it.mp))], ms = [...new Set(trained.flatMap(it => it.ms))].filter(m => !mp.includes(m));

  const addExercises = async (exs) => {
    const items = await buildItems(token, exs.map(ex => ({ exercise: ex })));
    setDraft({ ...latest.current, changed: true, items: [...latest.current.items, ...items] });
  };
  const replaceExercise = async (key, ex) => {
    const [item] = await buildItems(token, [{ exercise: ex }]);
    const old = latest.current.items.find(i => i.key === key);
    setDraft({ ...latest.current, changed: true, items: latest.current.items.map(i => i.key !== key ? i : { ...item, rest_sec: old.rest_sec, rep_min: old.rep_min, rep_max: old.rep_max, sets: old.sets.map(() => ({ kg: "", reps: "", done: false })) }) });
  };

  return <div onPointerDown={unlockAudio} style={{ position: "fixed", inset: 0, zIndex: 70, background: C.bg, display: "flex", flexDirection: "column" }}>
    {/* Encabezado fijo */}
    <div style={{ paddingTop: "env(safe-area-inset-top)", background: C.bg, borderBottom: `0.5px solid ${C.line}` }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onMinimize} aria-label="Minimizar entreno" className="k-press" style={roundIcon}><Icon d={I.down} size={20} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.routine_name}</div>
        </div>
        <button onClick={() => setSheet({ type: "finish" })} className="k-press" style={{ ...btnLime, width: "auto", padding: "9px 18px", fontSize: 15 }}>Terminar</button>
      </div>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "4px 18px 12px", display: "flex", alignItems: "center" }}>
        <Stat label="Duración" value={clock(elapsed)} color={C.lime} />
        <Stat label="Volumen" value={`${Math.round(volume).toLocaleString("es-AR")} kg`} />
        <Stat label="Series" value={done.length} />
        <BodyMap primary={mp} secondary={ms} size={46} />
      </div>
    </div>

    {/* Ejercicios */}
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: `6px 0 ${rest ? 170 : 40}px` }}>
        {loadingAi && <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.sub, padding: "12px 18px 0" }}><Icon d={I.spark} size={15} color={C.lime} />Calculando cargas de hoy según tu historial…</div>}
        {draft.items.map(it => <ExerciseBlock key={it.key} it={it} target={target} update={update} toggle={toggle}
          onInfo={() => setSheet({ type: "info", ex: { id: it.exercise_id, name: it.name, media_id: it.media_id, muscles_primary: it.mp, muscles_secondary: it.ms } })}
          onMenu={() => setSheet({ type: "menu", it })}
          onRest={() => setSheet({ type: "rest", it })}
          onAddSet={() => mapItems(x => x.key !== it.key ? x : { ...x, sets: [...x.sets, { kg: "", reps: "", done: false }] })} />)}
        <div style={{ padding: "18px 16px 0", display: "grid", gap: 10 }}>
          <button className="k-press" onClick={() => setSheet({ type: "add" })} style={{ ...btnGhost, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: C.lime }}><Icon d={I.plus} size={18} sw={2.2} />Agregar ejercicio</button>
          <button onClick={() => setSheet({ type: "discard" })} style={{ ...linkBtn, color: C.danger, padding: 10, fontSize: 14 }}>Descartar entreno</button>
        </div>
      </div>
    </div>

    {rest && <RestBar rest={rest} now={now} onShift={shiftRest} onSkip={skipRest} />}

    {sheet?.type === "info" && <ExerciseInfo ex={sheet.ex} token={token} onClose={() => setSheet(null)} />}
    {sheet?.type === "add" && <ExercisePicker token={token} multi onClose={() => setSheet(null)} onPick={(exs) => { setSheet(null); addExercises(exs); }} />}
    {sheet?.type === "replace" && <ExercisePicker token={token} onClose={() => setSheet(null)} onPick={([ex]) => { setSheet(null); replaceExercise(sheet.it.key, ex); }} />}
    {sheet?.type === "menu" && <Sheet title={sheet.it.name} onClose={() => setSheet(null)}>
      <div style={{ display: "grid", gap: 8 }}>
        <button className="k-press" style={btnGhost} onClick={() => setSheet({ type: "info", ex: { id: sheet.it.exercise_id, name: sheet.it.name, media_id: sheet.it.media_id, muscles_primary: sheet.it.mp, muscles_secondary: sheet.it.ms } })}>Ver técnica y progreso</button>
        <button className="k-press" style={btnGhost} onClick={() => setSheet({ type: "replace", it: sheet.it })}>Reemplazar ejercicio</button>
        <button className="k-press" style={btnGhost} onClick={() => { mapItems(x => x.key !== sheet.it.key ? x : { ...x, sets: x.sets.length > 1 ? x.sets.slice(0, -1) : x.sets }); setSheet(null); }}>Quitar la última serie</button>
        <button className="k-press" style={{ ...btnGhost, color: C.danger }} onClick={() => { setDraft({ ...latest.current, changed: true, items: latest.current.items.filter(x => x.key !== sheet.it.key) }); setSheet(null); }}>Quitar ejercicio</button>
      </div>
    </Sheet>}
    {sheet?.type === "rest" && <Sheet title="Descanso" onClose={() => setSheet(null)}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {REST_OPTIONS.map(s => { const on = sheet.it.rest_sec === s; return <button key={s} className="k-press" onClick={() => { mapItems(x => x.key !== sheet.it.key ? x : { ...x, rest_sec: s }); setSheet(null); }} style={{ ...btnGhost, padding: "12px 6px", fontSize: 14, borderColor: on ? C.lime : C.line, color: on ? C.lime : C.text }}>{restLabel(s)}</button>; })}
      </div>
    </Sheet>}
    {sheet?.type === "discard" && <Sheet title="¿Descartar el entreno?" onClose={() => setSheet(null)}>
      <p style={{ fontSize: 14, color: C.sub, margin: "0 0 16px" }}>Se pierden las series que marcaste.</p>
      <button className="k-press" onClick={() => { skipRest(); onDone(); pushToast("Entreno descartado"); }} style={{ ...btnGhost, color: C.danger }}>Descartar</button>
    </Sheet>}
    {sheet?.type === "finish" && <FinishSheet token={token} draft={draft} elapsed={elapsed} volume={volume} done={done.length} onClose={() => setSheet(null)} onSaved={() => { skipRest(); onDone(); }} />}
  </div>;
}

const roundIcon = { width: 38, height: 38, borderRadius: 19, border: `0.5px solid ${C.line}`, background: C.card, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const Stat = ({ label, value, color }) => <div style={{ flex: 1, minWidth: 0 }}>
  <div style={{ fontSize: 11, color: C.sub }}>{label}</div>
  <div className="k-num" style={{ fontSize: 17, fontWeight: 500, marginTop: 2, color: color || C.text, whiteSpace: "nowrap" }}>{value}</div>
</div>;

function ExerciseBlock({ it, target, update, toggle, onInfo, onMenu, onRest, onAddSet }) {
  const showAction = it.ai && ACTION_LABEL[it.ai.accion];
  return <div style={{ padding: "18px 16px 6px", borderBottom: `0.5px solid ${C.line}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={onInfo} aria-label="Ver ejercicio" style={{ background: "none", border: "none", padding: 0 }}><Thumb ex={{ muscles_primary: it.mp, muscles_secondary: it.ms }} size={46} /></button>
      <button onClick={onInfo} style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", color: C.text, fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.25 }}>{it.name}</button>
      <button onClick={onMenu} aria-label="Opciones del ejercicio" className="k-press" style={{ ...roundIcon, width: 34, height: 34, border: "none", background: "transparent", color: C.sub }}><Icon d={I.dots} size={20} sw={3.2} /></button>
    </div>
    {it.ai?.nota && <div style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 13, lineHeight: 1.45, color: C.sub }}>
      <span style={{ marginTop: 1 }}><Icon d={I.spark} size={14} color={C.lime} /></span>
      <span>{showAction && <span style={{ color: it.ai.accion === "cambiar" || it.ai.accion === "bajar_peso" ? C.warn : C.lime, fontWeight: 500 }}>{ACTION_LABEL[it.ai.accion]} · </span>}{it.ai.nota}</span>
    </div>}
    <button onClick={onRest} style={{ ...linkBtn, display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 13, color: C.blue }}><Icon d={I.timer} size={15} />Descanso: {restLabel(it.rest_sec)} · {it.rep_min}–{it.rep_max} reps</button>
    <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, alignItems: "center", marginTop: 12, fontSize: 11, color: C.dim, letterSpacing: "0.04em" }}>
      <span>SERIE</span><span>META</span><span style={{ textAlign: "center" }}>KG</span><span style={{ textAlign: "center" }}>REPS</span><span style={{ textAlign: "center" }}>✓</span>
    </div>
    {it.sets.map((s, si) => {
      const t = target(it, si);
      return <div key={si} style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, alignItems: "center", marginTop: 7, borderRadius: 12, background: s.done ? "rgba(74,222,128,0.08)" : "transparent", transition: "background 200ms" }}>
        <span style={{ height: 38, borderRadius: 10, background: C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>{si + 1}</span>
        <span className="k-num" style={{ fontSize: 13.5, color: t ? C.sub : C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t ? <><span style={{ color: C.text }}>{fmtKg(t.kg)}</span> kg × <span style={{ color: C.text }}>{t.reps}</span></> : "—"}</span>
        <input inputMode="decimal" value={s.kg} placeholder={t ? fmtKg(t.kg) : "0"} onChange={e => update(it.key, si, { kg: e.target.value })} className="k-num" style={cell} />
        <input inputMode="numeric" value={s.reps} placeholder={t ? String(t.reps) : "0"} onChange={e => update(it.key, si, { reps: e.target.value.replace(/[^\d]/g, "") })} className="k-num" style={cell} />
        <button onClick={() => toggle(it, si)} aria-label={s.done ? "Desmarcar serie" : "Marcar serie hecha"} className="k-press" style={{ height: 38, borderRadius: 10, border: "none", background: s.done ? C.pos : C.card, color: s.done ? "#05210F" : C.sub, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 160ms" }}>
          <Icon d={I.check} size={18} sw={2.4} />
        </button>
      </div>;
    })}
    <button onClick={onAddSet} className="k-press" style={{ ...btnGhost, marginTop: 12, padding: "11px 16px", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon d={I.plus} size={16} sw={2.2} />Agregar serie</button>
  </div>;
}

const COLS = "36px minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr) 44px";
const cell = { width: "100%", height: 38, border: `0.5px solid ${C.line}`, borderRadius: 10, background: "transparent", color: C.text, textAlign: "center", fontSize: 16, outline: "none", padding: 0 };

function RestBar({ rest, now, onShift, onSkip }) {
  const left = Math.max(0, (rest.until - now) / 1000);
  return <div style={{ position: "absolute", left: 12, right: 12, bottom: "calc(env(safe-area-inset-bottom) + 12px)", display: "flex", justifyContent: "center", zIndex: 5 }}>
    <div style={{ width: "100%", maxWidth: 456, background: C.cardHi, border: `0.5px solid ${C.line}`, borderRadius: 20, padding: "14px 16px", boxShadow: "0 16px 40px rgba(0,0,0,0.55)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.sub }}>Descanso</div>
          <div className="k-num" style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.1 }}>{clock(left)}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onShift(-15)} className="k-press" style={pill}>−15</button>
          <button onClick={() => onShift(15)} className="k-press" style={pill}>+15</button>
          <button onClick={onSkip} className="k-press" style={{ ...pill, background: C.lime, color: C.limeInk, borderColor: C.lime, fontWeight: 600 }}>Saltar</button>
        </div>
      </div>
      {rest.label && <div style={{ fontSize: 12, color: C.sub, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Sigue: {rest.label}</div>}
      <div style={{ height: 3, background: C.line, borderRadius: 2, marginTop: 10 }}><div style={{ width: `${Math.min(100, (left / rest.total) * 100)}%`, height: 3, background: C.lime, borderRadius: 2, transition: "width 1s linear" }} /></div>
    </div>
  </div>;
}
const pill = { border: `0.5px solid ${C.line}`, background: C.card, color: C.text, borderRadius: 12, padding: "10px 12px", fontSize: 14 };

function FinishSheet({ token, draft, elapsed, volume, done, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [updateRoutine, setUpdateRoutine] = useState(!!draft.changed);
  const save = async () => {
    if (!done) { onSaved(); pushToast("Entreno descartado: no marcaste series"); return; }
    setSaving(true);
    const w = await dq("kairo_workouts", { method: "POST", token, body: { routine_id: draft.routine_id, routine_name: draft.routine_name, started_at: draft.started_at, finished_at: new Date().toISOString() } });
    const wid = Array.isArray(w) ? w[0]?.id : null;
    if (!wid) { setSaving(false); return pushToast("No se pudo guardar, probá de nuevo"); }
    const rows = draft.items.flatMap(it => it.sets.filter(s => s.done).map((s, j) => ({ workout_id: wid, exercise_id: it.exercise_id, set_index: j, weight_kg: num(s.kg), reps: Math.round(num(s.reps)) })));
    await dq("kairo_sets", { method: "POST", token, body: rows });
    if (updateRoutine && draft.routine_id) {
      await dq("kairo_routine_exercises", { method: "DELETE", token, filters: `?routine_id=eq.${draft.routine_id}` });
      await dq("kairo_routine_exercises", { method: "POST", token, body: draft.items.map((it, i) => ({ routine_id: draft.routine_id, exercise_id: it.exercise_id, sort_order: i, sets: it.sets.length, rep_min: it.rep_min, rep_max: it.rep_max, rest_sec: it.rest_sec })) });
    }
    setSaving(false);
    pushToast(`Entreno guardado · ${rows.length} series · ${Math.round(volume).toLocaleString("es-AR")} kg`);
    onSaved();
  };
  return <Sheet title="Terminar entreno" onClose={onClose}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <MiniStat label="Duración" value={clock(elapsed)} />
      <MiniStat label="Volumen" value={`${Math.round(volume).toLocaleString("es-AR")} kg`} />
      <MiniStat label="Series" value={done} />
    </div>
    {draft.changed && draft.routine_id && <button onClick={() => setUpdateRoutine(!updateRoutine)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", color: C.text, padding: "18px 0 0", textAlign: "left" }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${updateRoutine ? C.lime : C.dim}`, background: updateRoutine ? C.lime : "transparent", color: C.limeInk, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{updateRoutine && <Icon d={I.check} size={14} sw={2.6} />}</span>
      <span style={{ fontSize: 14 }}>Guardar los cambios de ejercicios en la rutina "{draft.routine_name}"</span>
    </button>}
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Guardando…" : done ? "Guardar entreno" : "Salir sin guardar"}</button>
    <button className="k-press" onClick={onClose} style={{ ...btnGhost, marginTop: 8 }}>Seguir entrenando</button>
  </Sheet>;
}

// ─────── Ficha del ejercicio: fotos, músculos y tu progreso ───────
function ExerciseInfo({ ex, token, onClose }) {
  const [frame, setFrame] = useState(0);
  const [hist, setHist] = useState(null);
  const id = ex.id || ex.exercise_id;
  useEffect(() => { const t = setInterval(() => setFrame(f => 1 - f), 1100); return () => clearInterval(t); }, []);
  useEffect(() => {
    dq("kairo_sets", { token, filters: `?exercise_id=eq.${id}&select=workout_id,weight_kg,reps,created_at&order=created_at.asc&limit=1000` }).then(r => {
      const by = {};
      for (const s of Array.isArray(r) ? r : []) {
        const w = (by[s.workout_id] ||= { date: s.created_at.slice(0, 10), best: 0, top: null, vol: 0 });
        const e = e1rm(Number(s.weight_kg), s.reps); w.vol += Number(s.weight_kg) * s.reps;
        if (e > w.best) { w.best = e; w.top = s; }
      }
      setHist(Object.values(by));
    });
  }, [id, token]);
  const best = hist?.reduce((a, h) => h.best > (a?.best || 0) ? h : a, null);
  return <Sheet title={ex.name} onClose={onClose}>
    <div style={{ display: "flex", justifyContent: "center", background: C.cardHi, borderRadius: 18, padding: "18px 0 14px" }}>
      <BodyMap primary={ex.muscles_primary || []} secondary={ex.muscles_secondary || []} size={230} labels />
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {(ex.muscles_primary || []).length > 0 && <div><span style={{ color: C.sub }}>Principal: </span>{ex.muscles_primary.map(m => MUSCLE_ES[m] || m).join(", ")}</div>}
        {(ex.muscles_secondary || []).length > 0 && <div><span style={{ color: C.sub }}>Secundarios: </span>{ex.muscles_secondary.map(m => MUSCLE_ES[m] || m).join(", ")}</div>}
      </div>
    </div>
    {ex.media_id && <>
      <Label>Cómo se hace</Label>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
        {[0, 1].map(n => <img key={n} src={IMG(ex.media_id, n)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: frame === n ? 1 : 0, transition: "opacity 350ms" }} />)}
      </div>
    </>}
    <Label>Tu progreso</Label>
    {!hist ? <p style={{ color: C.sub, fontSize: 14 }}>Cargando…</p> : hist.length === 0 ? <p style={{ color: C.sub, fontSize: 14, margin: 0 }}>Todavía no lo registraste.</p> : <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <MiniStat label="Mejor serie" value={`${fmtKg(best.top.weight_kg)}×${best.top.reps}`} />
        <MiniStat label="1RM estimado" value={`${fmtKg(Math.round(best.best * 2) / 2)} kg`} color={C.lime} />
        <MiniStat label="Sesiones" value={hist.length} />
      </div>
      {hist.length > 1 && <LineChart values={hist.map(h => h.best)} labels={hist.map(h => h.date.slice(8) + "/" + h.date.slice(5, 7))} />}
    </>}
  </Sheet>;
}

function LineChart({ values, labels }) {
  const W = 320, H = 110, P = 8, max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => [P + (i * (W - 2 * P)) / Math.max(1, values.length - 1), H - P - ((v - min) / span) * (H - 2 * P)]);
  return <div style={{ background: C.cardHi, borderRadius: 14, padding: "12px 10px 8px", marginTop: 10 }}>
    <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>1RM estimado por sesión</div>
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} aria-hidden="true">
      <polyline points={pts.map(p => p.join(",")).join(" ")} fill="none" stroke={C.lime} strokeWidth="2" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={C.lime} />)}
    </svg>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.dim }}><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></div>
  </div>;
}

// ─────── Progreso ───────
function Progress({ workouts, exercises, onOpenWorkout, onOpenExercise }) {
  const [metric, setMetric] = useState("duracion");
  const weeks = useMemo(() => {
    const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - todayDow());
    return Array.from({ length: 12 }, (_, k) => { const s = new Date(monday); s.setDate(s.getDate() - (11 - k) * 7); return s; }).map(s => {
      const e = new Date(s); e.setDate(e.getDate() + 7);
      const ws = workouts.filter(w => { const d = new Date(w.started_at); return d >= s && d < e; });
      return {
        label: `${s.getDate()}/${s.getMonth() + 1}`,
        duracion: ws.reduce((a, w) => a + (new Date(w.finished_at) - new Date(w.started_at)) / 3600000, 0),
        volumen: ws.reduce((a, w) => a + (w.sets || []).reduce((b, x) => b + Number(x.weight_kg) * x.reps, 0), 0) / 1000,
        series: ws.reduce((a, w) => a + (w.sets || []).length, 0),
      };
    });
  }, [workouts]);
  const vals = weeks.map(w => w[metric]), max = Math.max(1e-9, ...vals);
  const unit = { duracion: "h", volumen: "t", series: "" }[metric];
  const cur = vals[vals.length - 1];
  const exCount = {};
  for (const w of workouts) for (const s of w.sets || []) exCount[s.exercise_id] = (exCount[s.exercise_id] || 0) + 1;
  const topEx = Object.entries(exCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ ex: exercises.find(e => e.id === id), n })).filter(x => x.ex);

  return <>
    <div style={{ padding: "22px 2px 0" }}>
      <div style={{ fontSize: 13, color: C.sub }}>Esta semana</div>
      <div className="k-num" style={{ fontSize: 34, fontWeight: 500, marginTop: 2 }}>{metric === "series" ? cur : fmtKg(Math.round(cur * 10) / 10)} <span style={{ fontSize: 16, color: C.sub }}>{metric === "duracion" ? "horas" : metric === "volumen" ? "toneladas" : "series"}</span></div>
    </div>
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 130, marginTop: 14 }}>
      {weeks.map((w, i) => <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
        <div style={{ width: "100%", height: `${Math.max(2, (w[metric] / max) * 100)}%`, background: i === weeks.length - 1 ? C.lime : w[metric] ? C.blue : C.line, borderRadius: 4, transition: "height 400ms cubic-bezier(.2,.9,.3,1)" }} />
      </div>)}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.dim, marginTop: 6 }}><span>{weeks[0].label}</span><span>{weeks[6].label}</span><span>hoy</span></div>
    <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
      <Segmented value={metric} onChange={setMetric} options={[["duracion", "Duración"], ["volumen", "Volumen"], ["series", "Series"]]} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 18 }}>
      <MiniStat label="Entrenos" value={workouts.length} />
      <MiniStat label="Prom. semanal" value={`${fmtKg(Math.round((vals.reduce((a, b) => a + b, 0) / 12) * 10) / 10)}${unit ? " " + unit : ""}`} />
      <MiniStat label="Racha" value={`${streak(workouts)} sem`} />
    </div>

    {topEx.length > 0 && <>
      <SectionTitle>Ejercicios</SectionTitle>
      <div style={{ ...card, padding: "2px 14px" }}>
        {topEx.map(({ ex, n }, i) => <button key={ex.id} onClick={() => onOpenExercise(ex)} style={{ width: "100%", background: "none", border: "none", color: C.text, display: "flex", alignItems: "center", gap: 12, padding: "10px 0", textAlign: "left", borderBottom: i < topEx.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <Thumb ex={ex} size={36} />
          <span style={{ flex: 1, fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.name}</span>
          <span style={{ fontSize: 12, color: C.sub }}>{n} series</span>
        </button>)}
      </div>
    </>}

    <SectionTitle>Entrenamientos</SectionTitle>
    {!workouts.length ? <div style={{ ...card, color: C.sub, fontSize: 14 }}>Cuando termines tu primer entreno aparece acá.</div> :
      <div style={{ ...card, padding: "2px 16px" }}>
        {workouts.slice(0, 40).map((w, i) => {
          const vol = (w.sets || []).reduce((a, s) => a + Number(s.weight_kg) * s.reps, 0);
          const mins = Math.round((new Date(w.finished_at) - new Date(w.started_at)) / 60000);
          return <button key={w.id} onClick={() => onOpenWorkout(w)} style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", padding: "12px 0", borderBottom: i < Math.min(workouts.length, 40) - 1 ? `0.5px solid ${C.line}` : "none", display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{w.routine_name || "Entreno"}</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{dayLabel(ymd(new Date(w.started_at)))} · {mins} min · {(w.sets || []).length} series</div>
            </div>
            <span className="k-num" style={{ fontSize: 14, color: C.sub, whiteSpace: "nowrap" }}>{Math.round(vol).toLocaleString("es-AR")} kg</span>
          </button>;
        })}
      </div>}
  </>;
}
function streak(workouts) {
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - todayDow());
  let n = 0;
  for (let k = 0; k < 104; k++) {
    const s = new Date(monday); s.setDate(s.getDate() - k * 7); const e = new Date(s); e.setDate(e.getDate() + 7);
    const has = workouts.some(w => { const d = new Date(w.started_at); return d >= s && d < e; });
    if (has) n++; else if (k > 0) break;
  }
  return n;
}

// Cómo organizás los días: fijos por rutina, o una rotación que se repite (pecho → espalda →
// pierna → descanso…) sin importar el día de la semana.
function DaysSheet({ token, routines, dias, onClose, onSaved }) {
  const [modo, setModo] = useState(dias?.modo || "fijos");
  const [orden, setOrden] = useState(dias?.orden?.length ? dias.orden : routines.map(r => r.id));
  const curIdx = dias?.modo === "rotacion" && dias.inicio && dias.orden?.length ? (((daysBetween(dias.inicio, ymd(new Date())) % dias.orden.length) + dias.orden.length) % dias.orden.length) : 0;
  const [hoy, setHoy] = useState(Math.min(curIdx, Math.max(0, orden.length - 1)));
  const [saving, setSaving] = useState(false);
  const label = (o) => o === "descanso" ? "Descanso" : routines.find(r => r.id === o)?.name || "—";
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= orden.length) return; const n = [...orden]; [n[i], n[j]] = [n[j], n[i]]; setOrden(n); if (hoy === i) setHoy(j); else if (hoy === j) setHoy(i); };
  const save = async () => {
    if (modo === "rotacion" && !orden.length) return pushToast("Agregá al menos una rutina");
    setSaving(true);
    const inicio = new Date(); inicio.setDate(inicio.getDate() - hoy);
    const body = { user_id: loadSession()?.user?.id, dias: modo === "rotacion" ? { modo, orden, inicio: ymd(inicio) } : { modo: "fijos" } };
    await dq("kairo_profile", { method: "POST", token, filters: "?on_conflict=user_id", body, headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
    setSaving(false); pushToast("Guardado"); onSaved();
  };
  const chip = (on) => ({ flex: 1, padding: "12px 10px", borderRadius: 14, fontSize: 14, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? "rgba(198,244,50,0.1)" : C.cardHi, color: on ? C.lime : C.text, fontWeight: on ? 600 : 400 });
  return <Sheet title="Cómo organizás los días" onClose={onClose}>
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={() => setModo("fijos")} className="k-press" style={chip(modo === "fijos")}>Días fijos</button>
      <button onClick={() => setModo("rotacion")} className="k-press" style={chip(modo === "rotacion")}>Rotación</button>
    </div>
    {modo === "fijos" ? <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.5, margin: "14px 2px 0" }}>Cada rutina se hace en los días de la semana que le marcás al editarla (por ejemplo, Pecho lunes y jueves).</p> : <>
      <p style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.5, margin: "14px 2px 0" }}>Armá la secuencia con tus rutinas y descansos: se repite una y otra vez, sin importar el día de la semana. Tocá la que te toca hoy.</p>
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {orden.map((o, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.cardHi, borderRadius: 14, padding: "8px 10px", border: `0.5px solid ${hoy === i ? C.lime : "transparent"}` }}>
          <span className="k-num" style={{ width: 22, fontSize: 13, color: C.dim }}>{i + 1}</span>
          <button onClick={() => setHoy(i)} style={{ flex: 1, background: "none", border: "none", color: o === "descanso" ? C.sub : C.text, textAlign: "left", fontSize: 15, padding: "4px 0" }}>{label(o)}{hoy === i && <span style={{ fontSize: 12, color: C.lime }}> · hoy</span>}</button>
          <SmallBtn onClick={() => move(i, -1)} label="Subir">↑</SmallBtn>
          <SmallBtn onClick={() => move(i, 1)} label="Bajar">↓</SmallBtn>
          <SmallBtn onClick={() => { setOrden(orden.filter((_, k) => k !== i)); setHoy(Math.max(0, hoy > i ? hoy - 1 : Math.min(hoy, orden.length - 2))); }} label="Quitar">×</SmallBtn>
        </div>)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {routines.map(r => <button key={r.id} onClick={() => setOrden([...orden, r.id])} className="k-press" style={{ padding: "8px 12px", borderRadius: 999, fontSize: 13.5, border: `0.5px solid ${C.line}`, background: C.card, color: C.text }}>+ {r.name}</button>)}
        <button onClick={() => setOrden([...orden, "descanso"])} className="k-press" style={{ padding: "8px 12px", borderRadius: 999, fontSize: 13.5, border: `0.5px solid ${C.line}`, background: C.card, color: C.sub }}>+ Descanso</button>
      </div>
    </>}
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Guardando…" : "Guardar"}</button>
  </Sheet>;
}

// ─────── Rutina: crear / editar ───────
function RoutineSheet({ token, routine, exercises, count, onClose, onSaved }) {
  const [name, setName] = useState(routine?.name || "");
  const [days, setDays] = useState(routine?.days || []);
  const [items, setItems] = useState(() => (routine?.items || []).map(i => ({ exercise_id: i.exercise_id, sets: i.sets, rep_min: i.rep_min, rep_max: i.rep_max, rest_sec: i.rest_sec })));
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [extra, setExtra] = useState([]);
  const exOf = (id) => exercises.find(e => e.id === id) || extra.find(e => e.id === id);
  const setItem = (ix, patch) => setItems(items.map((it, i) => i === ix ? { ...it, ...patch } : it));
  const move = (ix, d) => { const j = ix + d; if (j < 0 || j >= items.length) return; const n = [...items]; [n[ix], n[j]] = [n[j], n[ix]]; setItems(n); };

  const save = async () => {
    if (!name.trim()) return pushToast("Ponele un nombre");
    setSaving(true);
    let id = routine?.id;
    const body = { name: name.trim(), days: [...days].sort((a, b) => a - b) };
    if (id) await dq("kairo_routines", { method: "PATCH", token, filters: `?id=eq.${id}`, body });
    else { const r = await dq("kairo_routines", { method: "POST", token, body: { ...body, sort_order: count } }); id = Array.isArray(r) ? r[0]?.id : null; }
    if (!id) { setSaving(false); return pushToast("No se pudo guardar"); }
    await dq("kairo_routine_exercises", { method: "DELETE", token, filters: `?routine_id=eq.${id}` });
    if (items.length) await dq("kairo_routine_exercises", { method: "POST", token, body: items.map((it, i) => ({ ...it, routine_id: id, sort_order: i })) });
    setSaving(false); pushToast("Rutina guardada"); onSaved();
  };
  const del = async () => { await dq("kairo_routines", { method: "DELETE", token, filters: `?id=eq.${routine.id}` }); pushToast("Rutina eliminada"); onSaved(); };

  if (picking) return <ExercisePicker token={token} multi onClose={() => setPicking(false)} onPick={(exs) => { setExtra([...extra, ...exs]); setItems([...items, ...exs.map(ex => ({ exercise_id: ex.id, sets: 3, rep_min: 8, rep_max: 12, rest_sec: 90 }))]); setPicking(false); }} />;

  return <Sheet title={routine ? "Editar rutina" : "Nueva rutina"} onClose={onClose}>
    <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Pecho y tríceps" style={{ ...field, fontSize: 17, fontWeight: 500 }} />
    <Label>Días</Label>
    <div style={{ display: "flex", gap: 6 }}>
      {DAYS.map((d, i) => { const on = days.includes(i); return <button key={i} onClick={() => setDays(on ? days.filter(x => x !== i) : [...days, i])} className="k-press" style={{ flex: 1, height: 40, borderRadius: 12, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.cardHi, color: on ? C.limeInk : C.text, fontWeight: on ? 600 : 400, fontSize: 14 }}>{d}</button>; })}
    </div>
    <Label>Ejercicios</Label>
    {items.length === 0 && <div style={{ fontSize: 14, color: C.sub, marginBottom: 8 }}>Todavía no agregaste ejercicios.</div>}
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((it, ix) => { const ex = exOf(it.exercise_id); return <div key={ix} style={{ background: C.cardHi, borderRadius: 16, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Thumb ex={ex} size={34} />
          <span style={{ flex: 1, fontSize: 15, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex?.name || "—"}</span>
          <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <SmallBtn onClick={() => move(ix, -1)} label="Subir">↑</SmallBtn>
            <SmallBtn onClick={() => move(ix, 1)} label="Bajar">↓</SmallBtn>
            <SmallBtn onClick={() => setItems(items.filter((_, i) => i !== ix))} label="Quitar">×</SmallBtn>
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
          <NumField label="Series" value={it.sets} onChange={v => setItem(ix, { sets: Math.max(1, v) })} />
          <NumField label="Reps mín" value={it.rep_min} onChange={v => setItem(ix, { rep_min: Math.max(1, v) })} />
          <NumField label="Reps máx" value={it.rep_max} onChange={v => setItem(ix, { rep_max: Math.max(it.rep_min, v) })} />
          <NumField label="Desc. (s)" value={it.rest_sec} onChange={v => setItem(ix, { rest_sec: v })} />
        </div>
      </div>; })}
    </div>
    <button className="k-press" onClick={() => setPicking(true)} style={{ ...btnGhost, marginTop: 10, color: C.lime }}>+ Agregar ejercicios</button>
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 16 }}>{saving ? "Guardando…" : "Guardar rutina"}</button>
    {routine && (!confirmDel ? <button onClick={() => setConfirmDel(true)} style={{ ...linkBtn, color: C.sub, width: "100%", marginTop: 14 }}>Eliminar rutina</button>
      : <button onClick={del} style={{ ...linkBtn, color: C.danger, width: "100%", marginTop: 14 }}>Tocá de nuevo para eliminarla (el historial queda)</button>)}
  </Sheet>;
}

const SmallBtn = ({ children, onClick, label }) => <button onClick={onClick} aria-label={label} className="k-press" style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: C.card, color: C.sub, fontSize: 15 }}>{children}</button>;
function NumField({ label, value, onChange }) {
  return <label style={{ display: "block" }}>
    <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>{label}</div>
    <input inputMode="numeric" value={value} onChange={e => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)} className="k-num" style={{ ...cell, height: 36, background: C.card }} />
  </label>;
}

// Selector de ejercicios (uno o varios), con foto, filtro por músculo y alta de propios.
function ExercisePicker({ token, multi, onClose, onPick }) {
  const [all, setAll] = useState(null);
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState(null);
  const [sel, setSel] = useState([]);
  const [creating, setCreating] = useState(false);
  useEffect(() => { dq("kairo_exercises", { token, filters: "?select=*&order=muscle.asc,name.asc" }).then(r => setAll(Array.isArray(r) ? r : [])); }, [token]);
  const muscles = useMemo(() => [...new Set((all || []).map(e => e.muscle))], [all]);
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const list = (all || []).filter(e => (!muscle || e.muscle === muscle) && (!q || norm(e.name).includes(norm(q))));
  const tap = (e) => multi ? setSel(sel.some(x => x.id === e.id) ? sel.filter(x => x.id !== e.id) : [...sel, e]) : onPick([e]);
  if (creating) return <CreateExercise token={token} initialName={q} onClose={() => setCreating(false)} onCreated={(ex) => { setAll([...(all || []), ex]); setCreating(false); tap(ex); }} />;
  return <Sheet title={multi ? "Agregar ejercicios" : "Elegir ejercicio"} onClose={onClose} tall>
    <div style={{ display: "flex", gap: 8 }}>
      <input type="search" name="kairo-ejercicio" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="search" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} placeholder="Buscar ejercicio" style={{ ...field, flex: 1 }} />
      <button onClick={() => setCreating(true)} className="k-press" style={{ ...btnGhost, width: "auto", padding: "0 14px", fontSize: 14, color: C.lime, whiteSpace: "nowrap" }}>+ Crear</button>
    </div>
    <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "12px -2px 4px", paddingBottom: 4 }}>
      {muscles.map(m => <button key={m} onClick={() => setMuscle(muscle === m ? null : m)} className="k-press" style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 999, fontSize: 13, border: `0.5px solid ${muscle === m ? C.lime : C.line}`, background: muscle === m ? C.lime : C.cardHi, color: muscle === m ? C.limeInk : C.text }}>{m}</button>)}
    </div>
    {!all ? <p style={{ color: C.sub, fontSize: 14 }}>Cargando…</p> : <div style={{ marginTop: 6, paddingBottom: multi && sel.length ? 70 : 0 }}>
      {list.map((e, i) => { const on = sel.some(x => x.id === e.id); return <button key={e.id} onClick={() => tap(e)} style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", padding: "9px 2px", borderBottom: i < list.length - 1 ? `0.5px solid ${C.line}` : "none", display: "flex", alignItems: "center", gap: 12 }}>
        <Thumb ex={e} size={40} />
        <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 15, display: "block" }}>{e.name}</span><span style={{ fontSize: 12, color: C.sub }}>{e.muscle}{e.equipment ? ` · ${e.equipment}` : ""}</span></span>
        {multi && <span style={{ width: 22, height: 22, borderRadius: 11, border: `1.5px solid ${on ? C.lime : C.dim}`, background: on ? C.lime : "transparent", color: C.limeInk, display: "flex", alignItems: "center", justifyContent: "center" }}>{on && <Icon d={I.check} size={13} sw={2.8} />}</span>}
      </button>; })}
      {q.trim() && !list.some(e => norm(e.name) === norm(q.trim())) && <button className="k-press" onClick={() => setCreating(true)} style={{ ...btnGhost, marginTop: 12 }}>Crear "{q.trim()}"</button>}
    </div>}
    {multi && sel.length > 0 && <div style={{ position: "sticky", bottom: 0, paddingTop: 10, background: C.card }}>
      <button className="k-press" onClick={() => onPick(sel)} style={btnLime}>Agregar {sel.length} ejercicio{sel.length > 1 ? "s" : ""}</button>
    </div>}
  </Sheet>;
}

// Alta de un ejercicio propio: nombre, músculo principal (para la figura y la IA) y equipo.
const GROUP_OF = { chest: "Pecho", lats: "Espalda", "middle back": "Espalda", "lower back": "Espalda", traps: "Espalda", shoulders: "Hombros", biceps: "Bíceps", triceps: "Tríceps", forearms: "Antebrazos", quadriceps: "Piernas", hamstrings: "Piernas", adductors: "Piernas", abductors: "Glúteos", glutes: "Glúteos", calves: "Gemelos", abdominals: "Abdomen", neck: "Cuello" };
function CreateExercise({ token, initialName, onClose, onCreated }) {
  const [name, setName] = useState(initialName || "");
  const [main, setMain] = useState(null);
  const [extra, setExtra] = useState([]);
  const [equip, setEquip] = useState("Máquina");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) return pushToast("Ponele un nombre");
    if (!main) return pushToast("Elegí el músculo principal");
    setSaving(true);
    const r = await dq("kairo_exercises", { method: "POST", token, body: { name: name.trim(), muscle: GROUP_OF[main] || "Otro", equipment: equip, is_custom: true, muscles_primary: [main], muscles_secondary: extra.filter(m => m !== main) } });
    setSaving(false);
    const ex = Array.isArray(r) ? r[0] : null;
    if (!ex) return pushToast("Ya existe un ejercicio con ese nombre");
    pushToast("Ejercicio creado"); onCreated(ex);
  };
  const chip = (on) => ({ padding: "8px 12px", borderRadius: 999, fontSize: 13.5, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.cardHi, color: on ? C.limeInk : C.text, fontWeight: on ? 600 : 400 });
  return <Sheet title="Crear ejercicio" onClose={onClose}>
    <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Press de pecho convergente (máquina)" style={field} />
    <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}><BodyMap primary={main ? [main] : []} secondary={extra} size={170} labels /></div>
    <Label>Músculo principal</Label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{Object.entries(MUSCLE_ES).filter(([k]) => k !== "neck").map(([k, l]) => <button key={k} onClick={() => setMain(k)} className="k-press" style={chip(main === k)}>{l}</button>)}</div>
    <Label>Secundarios (opcional)</Label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{Object.entries(MUSCLE_ES).filter(([k]) => k !== "neck" && k !== main).map(([k, l]) => { const on = extra.includes(k); return <button key={k} onClick={() => setExtra(on ? extra.filter(x => x !== k) : [...extra, k])} className="k-press" style={chip(on)}>{l}</button>; })}</div>
    <Label>Equipo</Label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{["Máquina", "Polea", "Barra", "Mancuernas", "Peso corporal", "Otro"].map(e => <button key={e} onClick={() => setEquip(e)} className="k-press" style={chip(equip === e)}>{e}</button>)}</div>
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Guardando…" : "Crear ejercicio"}</button>
  </Sheet>;
}

// ─────── Revisión de la IA ───────
function ReviewSheet({ token, onClose }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");
  const run = useCallback(async () => {
    setR(null); setErr("");
    const res = await api("/api/kairo/coach", token, { action: "review" }).catch(() => ({ error: "Sin conexión" }));
    if (res.review) setR({ ...res.review, at: new Date().toISOString() }); else setErr(res.error || "No se pudo analizar");
  }, [token]);
  useEffect(() => {
    (async () => {
      const last = await dq("kairo_ai", { token, filters: "?kind=eq.review&select=content,created_at&order=created_at.desc&limit=1" });
      if (Array.isArray(last) && last[0]) setR({ ...last[0].content, at: last[0].created_at }); else run();
    })();
  }, [token, run]);
  return <Sheet title="Análisis de tus rutinas" onClose={onClose}>
    {err ? <p style={{ color: C.danger, fontSize: 14 }}>{err}</p> : !r ? <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.5 }}>Analizando rutinas, volumen por músculo e historial de cargas…</p> : <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="k-num" style={{ fontSize: 44, fontWeight: 500, color: r.puntaje >= 7 ? C.pos : r.puntaje >= 5 ? C.warn : C.neg }}>{r.puntaje}</span>
        <span style={{ color: C.sub }}>/ 10</span>
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.5, margin: "6px 0 0" }}>{r.resumen}</p>
      {r.fortalezas?.length > 0 && <><Label>Lo que está bien</Label>{r.fortalezas.map((x, i) => <Bullet key={i} color={C.pos}>{x}</Bullet>)}</>}
      {r.problemas?.length > 0 && <><Label>A corregir</Label>{r.problemas.map((x, i) => <Bullet key={i} color={C.warn}>{x}</Bullet>)}</>}
      {r.cambios?.length > 0 && <><Label>Cambios sugeridos</Label>
        {r.cambios.map((c, i) => <div key={i} style={{ background: C.cardHi, borderRadius: 14, padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: C.sub }}>{c.rutina}</div>
          <div style={{ fontSize: 15, marginTop: 2 }}>{c.ejercicio}{c.reemplazo ? <span style={{ color: C.lime }}> → {c.reemplazo}</span> : null}</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 4, lineHeight: 1.45 }}>{c.sugerencia}</div>
        </div>)}
      </>}
      {r.volumen?.length > 0 && <><Label>Series semanales por músculo</Label>
        <div style={{ background: C.cardHi, borderRadius: 14, padding: "0 14px" }}>
          {r.volumen.map((v, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 14, borderBottom: i < r.volumen.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
            <span>{v.musculo}</span><span className="k-num" style={{ color: v.opinion === "bien" ? C.pos : C.warn }}>{v.series_semana} · {v.opinion}</span>
          </div>)}
        </div>
      </>}
      <button className="k-press" onClick={run} style={{ ...btnGhost, marginTop: 18 }}>Volver a analizar</button>
      {r.at && <div style={{ fontSize: 12, color: C.dim, textAlign: "center", marginTop: 8 }}>Análisis del {dayLabel(ymd(new Date(r.at)))}</div>}
    </>}
  </Sheet>;
}
const Bullet = ({ children, color }) => <div style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.45, marginBottom: 8 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: color, marginTop: 7, flexShrink: 0 }} /><span>{children}</span></div>;

function WorkoutDetail({ w, exercises, token, onClose, onDeleted }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const byEx = [];
  for (const s of [...(w.sets || [])].sort((a, b) => a.set_index - b.set_index)) {
    let g = byEx.find(x => x.id === s.exercise_id);
    if (!g) { g = { id: s.exercise_id, ex: exercises.find(e => e.id === s.exercise_id), sets: [] }; byEx.push(g); }
    g.sets.push(s);
  }
  const vol = (w.sets || []).reduce((a, s) => a + Number(s.weight_kg) * s.reps, 0);
  const del = async () => { await dq("kairo_workouts", { method: "DELETE", token, filters: `?id=eq.${w.id}` }); pushToast("Entreno eliminado"); onDeleted(); };
  return <Sheet title={w.routine_name || "Entreno"} onClose={onClose}>
    <div style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>{new Date(w.started_at).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
      <MiniStat label="Duración" value={clock((new Date(w.finished_at) - new Date(w.started_at)) / 1000)} />
      <MiniStat label="Volumen" value={`${Math.round(vol).toLocaleString("es-AR")} kg`} />
      <MiniStat label="Series" value={(w.sets || []).length} />
    </div>
    {byEx.map(g => <div key={g.id} style={{ display: "flex", gap: 12, alignItems: "center", background: C.cardHi, borderRadius: 14, padding: 12, marginBottom: 8 }}>
      <Thumb ex={g.ex} size={38} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15 }}>{g.ex?.name || "—"}</div>
        <div className="k-num" style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{g.sets.map(s => `${fmtKg(s.weight_kg)}×${s.reps}`).join("  ·  ")}</div>
      </div>
    </div>)}
    {!confirmDel ? <button onClick={() => setConfirmDel(true)} style={{ ...linkBtn, color: C.sub, width: "100%", marginTop: 10 }}>Eliminar entreno</button>
      : <button onClick={del} style={{ ...linkBtn, color: C.danger, width: "100%", marginTop: 10 }}>Tocá de nuevo para eliminarlo</button>}
  </Sheet>;
}
