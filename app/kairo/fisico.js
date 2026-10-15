"use client";
// Kairo · Físico. Rutinas estilo Hevy (nombre, días, ejercicios con series/reps/descanso),
// entreno en vivo con descanso automático, historial, y la IA de /api/kairo/coach:
// plan del día por ejercicio (kilos × reps) y revisión de las rutinas.
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { dq, loadSession } from "../../lib/sb-client";
import { C, I, Icon, pushToast, Sheet, SectionTitle, Label, MiniStat, card, field, btnLime, btnGhost, linkBtn, dayLabel, ymd } from "./ui";

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const todayDow = () => (new Date().getDay() + 6) % 7; // 0 = lunes
const DRAFT_KEY = "kairo_workout";
const ACTION_LABEL = { subir_peso: "Subí peso", subir_reps: "Subí reps", mantener: "Mantené", bajar_peso: "Bajá peso", primera_vez: "Primera vez", cambiar: "Conviene cambiarlo" };
const kg = (n) => `${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 1 })}`;
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const num = (s) => Number(String(s).replace(",", ".")) || 0;
const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; } };
const saveDraft = (d) => { try { d ? localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) : localStorage.removeItem(DRAFT_KEY); } catch {} };

async function coach(token, body) {
  const r = await fetch("/api/kairo/coach", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${loadSession()?.token || token}` }, body: JSON.stringify(body) });
  return r.json();
}

// ─────── Datos ───────
function useGym(token) {
  const [routines, setRoutines] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [lo, setLo] = useState(true);
  const load = useCallback(async () => {
    const [r, it, ex, w] = await Promise.all([
      dq("kairo_routines", { token, filters: "?select=*&order=sort_order.asc,created_at.asc" }),
      dq("kairo_routine_exercises", { token, filters: "?select=*&order=sort_order.asc" }),
      dq("kairo_exercises", { token, filters: "?select=*&order=muscle.asc,name.asc" }),
      dq("kairo_workouts", { token, filters: "?select=*,sets:kairo_sets(exercise_id,weight_kg,reps,set_index)&finished_at=not.is.null&order=started_at.desc&limit=30" }),
    ]);
    const exs = Array.isArray(ex) ? ex : [];
    const items = (Array.isArray(it) ? it : []).map(i => ({ ...i, exercise: exs.find(e => e.id === i.exercise_id) })).filter(i => i.exercise);
    setExercises(exs);
    setRoutines((Array.isArray(r) ? r : []).map(rt => ({ ...rt, items: items.filter(i => i.routine_id === rt.id) })));
    setWorkouts(Array.isArray(w) ? w : []);
    setLo(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);
  return { routines, exercises, workouts, lo, load };
}

// ─────── Sección ───────
export default function Fisico({ token }) {
  const gym = useGym(token);
  const [view, setView] = useState("entrenar");
  const [sheet, setSheet] = useState(null);
  const [draft, setDraft] = useState(null);
  useEffect(() => { setDraft(loadDraft()); }, []);

  const start = async (routine) => {
    // Lo último que hiciste en cada ejercicio, para precargar y comparar.
    const ids = routine.items.map(i => i.exercise_id);
    const prevSets = ids.length ? await dq("kairo_sets", { token, filters: `?exercise_id=in.(${ids.join(",")})&select=exercise_id,workout_id,set_index,weight_kg,reps,created_at&order=created_at.desc&limit=400` }) : [];
    const prev = {};
    for (const id of ids) {
      const mine = (Array.isArray(prevSets) ? prevSets : []).filter(s => s.exercise_id === id);
      const wid = mine[0]?.workout_id;
      prev[id] = mine.filter(s => s.workout_id === wid).sort((a, b) => a.set_index - b.set_index).map(s => ({ kg: Number(s.weight_kg), reps: s.reps }));
    }
    const d = {
      routine_id: routine.id, routine_name: routine.name, started_at: new Date().toISOString(), plan: null, planMsg: "",
      items: routine.items.map(i => ({
        exercise_id: i.exercise_id, name: i.exercise.name, muscle: i.exercise.muscle, rest_sec: i.rest_sec, rep_min: i.rep_min, rep_max: i.rep_max,
        prev: prev[i.exercise_id] || [], ai: null,
        sets: Array.from({ length: i.sets }, () => ({ kg: "", reps: "", done: false })),
      })),
    };
    saveDraft(d); setDraft(d);
  };

  if (draft) return <Workout token={token} draft={draft} setDraft={(d) => { saveDraft(d); setDraft(d); }} onDone={() => { saveDraft(null); setDraft(null); gym.load(); }} />;

  const dow = todayDow();
  const todays = gym.routines.filter(r => r.days?.includes(dow));
  const others = gym.routines.filter(r => !r.days?.includes(dow));

  return <>
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 999, padding: 3 }}>
        {[["entrenar", "Entrenar"], ["rutinas", "Rutinas"], ["historial", "Historial"]].map(([id, label]) =>
          <button key={id} onClick={() => setView(id)} className="k-press" style={{ border: "none", borderRadius: 999, padding: "7px 16px", fontSize: 14, fontWeight: 500, background: view === id ? C.cardHi : "transparent", color: view === id ? C.text : C.sub }}>{label}</button>)}
      </div>
    </div>

    {gym.lo ? <p style={{ color: C.sub, textAlign: "center", padding: "60px 0" }}>Cargando…</p> : <>
      {view === "entrenar" && <>
        {gym.routines.length === 0 ? <Empty onNew={() => setSheet({ type: "routine" })} /> : <>
          <SectionTitle>{DAYS_FULL[dow]}</SectionTitle>
          {todays.length === 0 ? <div style={{ ...card, color: C.sub, fontSize: 14 }}>Hoy no tenés ninguna rutina asignada. Podés hacer cualquiera de abajo.</div>
            : todays.map(r => <RoutineCard key={r.id} r={r} big onStart={() => start(r)} />)}
          {others.length > 0 && <>
            <SectionTitle>Otras rutinas</SectionTitle>
            <div style={{ display: "grid", gap: 10 }}>{others.map(r => <RoutineCard key={r.id} r={r} onStart={() => start(r)} />)}</div>
          </>}
          <ThisWeek workouts={gym.workouts} />
        </>}
      </>}

      {view === "rutinas" && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
          <button className="k-press" onClick={() => setSheet({ type: "review" })} disabled={!gym.routines.length} style={{ ...btnGhost, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: gym.routines.length ? 1 : 0.5 }}>
            <Icon d={I.spark} size={17} color={C.lime} />Analizar con IA
          </button>
          <button className="k-press" onClick={() => setSheet({ type: "routine" })} style={{ ...btnLime, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Icon d={I.plus} size={18} sw={2.2} />Rutina
          </button>
        </div>
        {gym.routines.length === 0 ? <div style={{ ...card, color: C.sub, fontSize: 14, marginTop: 18 }}>Creá tu primera rutina: le ponés nombre, los días y los ejercicios.</div> :
          <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
            {gym.routines.map(r => <button key={r.id} className="k-press" onClick={() => setSheet({ type: "routine", routine: r })} style={{ ...card, textAlign: "left", color: C.text, width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 500 }}>{r.name}</span>
                <span style={{ fontSize: 12, color: C.sub }}>{r.days?.length ? [...r.days].sort((a, b) => a - b).map(d => DAYS[d]).join(" · ") : "sin día"}</span>
              </div>
              <div style={{ fontSize: 13, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>{r.items.map(i => i.exercise.name).join(" · ") || "Sin ejercicios"}</div>
            </button>)}
          </div>}
      </>}

      {view === "historial" && <History workouts={gym.workouts} exercises={gym.exercises} onOpen={(w) => setSheet({ type: "workout", w })} />}
    </>}

    {sheet?.type === "routine" && <RoutineSheet token={token} routine={sheet.routine} exercises={gym.exercises} count={gym.routines.length} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); gym.load(); }} />}
    {sheet?.type === "review" && <ReviewSheet token={token} onClose={() => setSheet(null)} />}
    {sheet?.type === "workout" && <WorkoutDetail w={sheet.w} exercises={gym.exercises} token={token} onClose={() => setSheet(null)} onDeleted={() => { setSheet(null); gym.load(); }} />}
  </>;
}

function Empty({ onNew }) {
  return <div style={{ ...card, marginTop: 22, padding: "32px 20px", textAlign: "center" }}>
    <div style={{ color: C.dim, display: "flex", justifyContent: "center" }}><Icon d={I.gym} size={34} sw={1.4} /></div>
    <p style={{ margin: "14px 0 4px", fontSize: 16, fontWeight: 500 }}>Armá tu primera rutina</p>
    <p style={{ margin: "0 0 18px", fontSize: 14, color: C.sub }}>Después la IA la revisa y te dice cuánto levantar en cada entreno.</p>
    <button className="k-press" onClick={onNew} style={btnLime}>Crear rutina</button>
  </div>;
}

function RoutineCard({ r, big, onStart }) {
  const sets = r.items.reduce((s, i) => s + i.sets, 0);
  return <div style={{ ...card, marginBottom: big ? 10 : 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: big ? 20 : 16, fontWeight: 500, letterSpacing: "-0.01em" }}>{r.name}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{r.items.length} ejercicios · {sets} series</div>
      </div>
      {!big && <button className="k-press" onClick={onStart} disabled={!r.items.length} style={{ ...btnGhost, width: "auto", padding: "9px 16px", fontSize: 14 }}>Empezar</button>}
    </div>
    {big && <>
      <div style={{ fontSize: 13, color: C.sub, marginTop: 10, lineHeight: 1.5 }}>{r.items.map(i => i.exercise.name).join(" · ")}</div>
      <button className="k-press" onClick={onStart} disabled={!r.items.length} style={{ ...btnLime, marginTop: 14 }}>Empezar entreno</button>
    </>}
  </div>;
}

function ThisWeek({ workouts }) {
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - todayDow());
  const week = workouts.filter(w => new Date(w.started_at) >= monday);
  const vol = week.reduce((s, w) => s + (w.sets || []).reduce((a, x) => a + Number(x.weight_kg) * x.reps, 0), 0);
  const sets = week.reduce((s, w) => s + (w.sets || []).length, 0);
  return <>
    <SectionTitle>Esta semana</SectionTitle>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <MiniStat label="Entrenos" value={week.length} />
      <MiniStat label="Series" value={sets} />
      <MiniStat label="Volumen" value={`${Math.round(vol / 100) / 10}t`} />
    </div>
  </>;
}

// ─────── Entreno en vivo ───────
function Workout({ token, draft, setDraft, onDone }) {
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState(null); // { until, total }
  const [finishing, setFinishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingAi, setLoadingAi] = useState(!draft.plan);
  const latest = useRef(draft); latest.current = draft;

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (rest && now >= rest.until) { setRest(null); try { navigator.vibrate?.([200, 100, 200]); } catch {} } }, [now, rest]);

  // Plan de la IA para hoy (una vez por entreno; queda en el borrador).
  useEffect(() => {
    if (draft.plan || !draft.routine_id) return;
    let alive = true;
    coach(token, { action: "plan", routine_id: draft.routine_id }).then(r => {
      if (!alive) return;
      setLoadingAi(false);
      if (!r.plan) { if (r.error) pushToast(r.error); return; }
      const d = latest.current;
      setDraft({ ...d, plan: true, planMsg: r.plan.mensaje, items: d.items.map(it => ({ ...it, ai: r.plan.ejercicios.find(e => e.exercise_id === it.exercise_id) || null })) });
    }).catch(() => { if (alive) setLoadingAi(false); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = (now - new Date(draft.started_at).getTime()) / 1000;
  const update = (ix, si, patch) => setDraft({ ...draft, items: draft.items.map((it, i) => i !== ix ? it : { ...it, sets: it.sets.map((s, j) => j !== si ? s : { ...s, ...patch }) }) });
  const target = (it, si) => it.ai?.series?.[si] || it.ai?.series?.[it.ai.series.length - 1] || (it.prev[si] ? { kg: it.prev[si].kg, reps: it.prev[si].reps } : null);
  const toggle = (ix, si) => {
    const it = draft.items[ix], s = it.sets[si], t = target(it, si);
    if (s.done) return update(ix, si, { done: false });
    const kgV = s.kg !== "" ? s.kg : t ? String(t.kg) : "";
    const repsV = s.reps !== "" ? s.reps : t ? String(t.reps) : "";
    if (repsV === "") return pushToast("Poné las repeticiones");
    update(ix, si, { done: true, kg: kgV || "0", reps: repsV });
    setRest({ until: Date.now() + it.rest_sec * 1000, total: it.rest_sec });
  };
  const addSet = (ix) => setDraft({ ...draft, items: draft.items.map((it, i) => i !== ix ? it : { ...it, sets: [...it.sets, { kg: it.sets.at(-1)?.kg || "", reps: "", done: false }] }) });
  const dropSet = (ix) => setDraft({ ...draft, items: draft.items.map((it, i) => i !== ix || it.sets.length <= 1 ? it : { ...it, sets: it.sets.slice(0, -1) }) });

  const doneSets = draft.items.flatMap(it => it.sets.filter(s => s.done).map((s, j) => ({ ...s, it })));
  const volume = doneSets.reduce((a, s) => a + num(s.kg) * num(s.reps), 0);

  const finish = async () => {
    if (!doneSets.length) { onDone(); pushToast("Entreno descartado"); return; }
    setSaving(true);
    const w = await dq("kairo_workouts", { method: "POST", token, body: { routine_id: draft.routine_id, routine_name: draft.routine_name, started_at: draft.started_at, finished_at: new Date().toISOString() } });
    const wid = Array.isArray(w) ? w[0]?.id : null;
    if (!wid) { setSaving(false); return pushToast("No se pudo guardar, probá de nuevo"); }
    const rows = draft.items.flatMap(it => it.sets.filter(s => s.done).map((s, j) => ({ workout_id: wid, exercise_id: it.exercise_id, set_index: j, weight_kg: num(s.kg), reps: Math.round(num(s.reps)) })));
    await dq("kairo_sets", { method: "POST", token, body: rows });
    setSaving(false);
    pushToast(`Entreno guardado · ${rows.length} series · ${Math.round(volume).toLocaleString("es-AR")} kg`);
    onDone();
  };

  return <div style={{ paddingBottom: rest ? 90 : 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: C.sub }}>Entrenando</div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.routine_name}</div>
      </div>
      <div className="k-num" style={{ fontSize: 22, fontWeight: 500, color: C.lime }}>{clock(elapsed)}</div>
    </div>

    <div style={{ ...card, marginTop: 14, display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(198,244,50,0.06)", borderColor: "rgba(198,244,50,0.18)" }}>
      <span style={{ marginTop: 1 }}><Icon d={I.spark} size={18} color={C.lime} /></span>
      <span style={{ fontSize: 14, lineHeight: 1.45, color: loadingAi ? C.sub : C.text }}>{loadingAi ? "La IA está armando tu plan de hoy según lo que venís levantando…" : draft.planMsg || "Sin plan de la IA: usá tus números de la última vez."}</span>
    </div>

    {draft.items.map((it, ix) => <div key={it.exercise_id + ix} style={{ ...card, marginTop: 12, padding: "14px 14px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>{it.name}</span>
        <span style={{ fontSize: 12, color: C.sub, whiteSpace: "nowrap" }}>{it.rep_min}–{it.rep_max} reps · {it.rest_sec}s</span>
      </div>
      {it.ai && <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>
        <span style={{ color: it.ai.accion === "cambiar" || it.ai.accion === "bajar_peso" ? C.warn : C.lime, fontWeight: 500 }}>{ACTION_LABEL[it.ai.accion] || "IA"}</span>
        <span style={{ color: C.sub }}> · {it.ai.nota}</span>
      </div>}
      <div style={{ display: "grid", gridTemplateColumns: "26px 1fr 1fr 1fr 40px", gap: 6, alignItems: "center", marginTop: 12, fontSize: 11, color: C.dim }}>
        <span>#</span><span>Anterior</span><span style={{ textAlign: "center" }}>kg</span><span style={{ textAlign: "center" }}>reps</span><span />
      </div>
      {it.sets.map((s, si) => {
        const t = target(it, si), p = it.prev[si];
        return <div key={si} style={{ display: "grid", gridTemplateColumns: "26px 1fr 1fr 1fr 40px", gap: 6, alignItems: "center", marginTop: 6, opacity: s.done ? 0.75 : 1 }}>
          <span style={{ fontSize: 13, color: C.sub }}>{si + 1}</span>
          <span className="k-num" style={{ fontSize: 13, color: C.sub }}>{p ? `${kg(p.kg)}×${p.reps}` : "—"}</span>
          <input inputMode="decimal" value={s.kg} placeholder={t ? kg(t.kg) : "0"} onChange={e => update(ix, si, { kg: e.target.value })} className="k-num" style={{ ...cell, background: s.done ? "rgba(74,222,128,0.10)" : C.cardHi }} />
          <input inputMode="numeric" value={s.reps} placeholder={t ? String(t.reps) : "0"} onChange={e => update(ix, si, { reps: e.target.value.replace(/[^\d]/g, "") })} className="k-num" style={{ ...cell, background: s.done ? "rgba(74,222,128,0.10)" : C.cardHi }} />
          <button onClick={() => toggle(ix, si)} aria-label={s.done ? "Desmarcar serie" : "Marcar serie hecha"} className="k-press" style={{ height: 38, borderRadius: 10, border: "none", background: s.done ? C.pos : C.cardHi, color: s.done ? "#05210F" : C.sub, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon d={I.check} size={18} sw={2.4} />
          </button>
        </div>;
      })}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <button onClick={() => dropSet(ix)} style={{ ...linkBtn, color: C.sub, padding: "6px 2px" }}>− Serie</button>
        <button onClick={() => addSet(ix)} style={{ ...linkBtn, padding: "6px 2px" }}>+ Serie</button>
      </div>
    </div>)}

    {!finishing ? <button className="k-press" onClick={() => setFinishing(true)} style={{ ...btnLime, marginTop: 18 }}>Terminar entreno</button>
      : <div style={{ ...card, marginTop: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{doneSets.length ? `${doneSets.length} series · ${Math.round(volume).toLocaleString("es-AR")} kg · ${clock(elapsed)}` : "No marcaste ninguna serie"}</div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <button className="k-press" onClick={finish} disabled={saving} style={btnLime}>{saving ? "Guardando…" : doneSets.length ? "Guardar entreno" : "Salir sin guardar"}</button>
          <button className="k-press" onClick={() => setFinishing(false)} style={btnGhost}>Seguir entrenando</button>
          {doneSets.length > 0 && <button onClick={() => { onDone(); pushToast("Entreno descartado"); }} style={{ ...linkBtn, color: C.danger, padding: 8 }}>Descartar entreno</button>}
        </div>
      </div>}

    {rest && <RestBar rest={rest} now={now} onAdd={() => setRest({ ...rest, until: rest.until + 15000, total: rest.total + 15 })} onSkip={() => setRest(null)} />}
  </div>;
}

const cell = { width: "100%", height: 38, border: `0.5px solid ${C.line}`, borderRadius: 10, color: C.text, textAlign: "center", fontSize: 16, outline: "none", padding: 0 };

function RestBar({ rest, now, onAdd, onSkip }) {
  const left = Math.max(0, (rest.until - now) / 1000);
  return <div style={{ position: "fixed", left: 12, right: 12, bottom: "calc(env(safe-area-inset-bottom) + 76px)", zIndex: 45, display: "flex", justifyContent: "center" }}>
    <div style={{ width: "100%", maxWidth: 456, background: C.cardHi, border: `0.5px solid ${C.line}`, borderRadius: 18, padding: "12px 14px", boxShadow: "0 12px 30px rgba(0,0,0,0.45)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div><div style={{ fontSize: 11, color: C.sub }}>Descanso</div><div className="k-num" style={{ fontSize: 24, fontWeight: 500 }}>{clock(left)}</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onAdd} className="k-press" style={{ ...btnGhost, width: "auto", padding: "9px 14px", fontSize: 14 }}>+15s</button>
          <button onClick={onSkip} className="k-press" style={{ ...btnGhost, width: "auto", padding: "9px 14px", fontSize: 14 }}>Saltar</button>
        </div>
      </div>
      <div style={{ height: 3, background: C.line, borderRadius: 2, marginTop: 10 }}><div style={{ width: `${(left / rest.total) * 100}%`, height: 3, background: C.lime, borderRadius: 2, transition: "width 1s linear" }} /></div>
    </div>
  </div>;
}

// ─────── Rutina: crear / editar ───────
function RoutineSheet({ token, routine, exercises, count, onClose, onSaved }) {
  const [name, setName] = useState(routine?.name || "");
  const [days, setDays] = useState(routine?.days || []);
  const [items, setItems] = useState(() => (routine?.items || []).map(i => ({ exercise_id: i.exercise_id, sets: i.sets, rep_min: i.rep_min, rep_max: i.rep_max, rest_sec: i.rest_sec })));
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const exName = (id) => exercises.find(e => e.id === id)?.name || "—";
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

  if (picking) return <ExercisePicker token={token} exercises={exercises} onClose={() => setPicking(false)} onPick={(ex) => { setItems([...items, { exercise_id: ex.id, sets: 3, rep_min: 8, rep_max: 12, rest_sec: 90 }]); setPicking(false); }} />;

  return <Sheet title={routine ? "Editar rutina" : "Nueva rutina"} onClose={onClose}>
    <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Pecho y tríceps" style={field} />
    <Label>Días</Label>
    <div style={{ display: "flex", gap: 6 }}>
      {DAYS.map((d, i) => { const on = days.includes(i); return <button key={i} onClick={() => setDays(on ? days.filter(x => x !== i) : [...days, i])} className="k-press" style={{ flex: 1, height: 40, borderRadius: 12, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.cardHi, color: on ? C.limeInk : C.text, fontWeight: on ? 600 : 400, fontSize: 14 }}>{d}</button>; })}
    </div>
    <Label>Ejercicios</Label>
    {items.length === 0 && <div style={{ fontSize: 14, color: C.sub, marginBottom: 8 }}>Todavía no agregaste ejercicios.</div>}
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((it, ix) => <div key={ix} style={{ background: C.cardHi, borderRadius: 14, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exName(it.exercise_id)}</span>
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
          <NumField label="Desc. s" value={it.rest_sec} onChange={v => setItem(ix, { rest_sec: v })} />
        </div>
      </div>)}
    </div>
    <button className="k-press" onClick={() => setPicking(true)} style={{ ...btnGhost, marginTop: 10 }}>+ Agregar ejercicio</button>
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

function ExercisePicker({ token, exercises, onClose, onPick }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState(null);
  const muscles = useMemo(() => [...new Set(exercises.map(e => e.muscle))], [exercises]);
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const list = exercises.filter(e => (!muscle || e.muscle === muscle) && (!q || norm(e.name).includes(norm(q))));
  const create = async () => {
    const r = await dq("kairo_exercises", { method: "POST", token, body: { name: q.trim(), muscle: muscle || "Otro", is_custom: true } });
    const ex = Array.isArray(r) ? r[0] : null;
    if (!ex) return pushToast("Ese ejercicio ya existe");
    exercises.push(ex); onPick(ex);
  };
  return <Sheet title="Agregar ejercicio" onClose={onClose}>
    <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar ejercicio" style={field} />
    <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "12px -2px 4px", paddingBottom: 4 }}>
      {muscles.map(m => <button key={m} onClick={() => setMuscle(muscle === m ? null : m)} className="k-press" style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 999, fontSize: 13, border: `0.5px solid ${muscle === m ? C.lime : C.line}`, background: muscle === m ? C.lime : C.cardHi, color: muscle === m ? C.limeInk : C.text }}>{m}</button>)}
    </div>
    <div style={{ marginTop: 6 }}>
      {list.map((e, i) => <button key={e.id} onClick={() => onPick(e)} style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", padding: "12px 2px", borderBottom: i < list.length - 1 ? `0.5px solid ${C.line}` : "none", display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 15 }}>{e.name}</span><span style={{ fontSize: 12, color: C.sub, whiteSpace: "nowrap" }}>{e.muscle}</span>
      </button>)}
      {q.trim() && !list.some(e => norm(e.name) === norm(q.trim())) && <button className="k-press" onClick={create} style={{ ...btnGhost, marginTop: 12 }}>Crear "{q.trim()}"{muscle ? ` · ${muscle}` : ""}</button>}
    </div>
  </Sheet>;
}

// ─────── Revisión de la IA ───────
function ReviewSheet({ token, onClose }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      // Muestra la última revisión al toque; "Volver a analizar" pide una nueva.
      const last = await dq("kairo_ai", { token, filters: "?kind=eq.review&select=content,created_at&order=created_at.desc&limit=1" });
      if (Array.isArray(last) && last[0]) setR({ ...last[0].content, at: last[0].created_at });
      else run();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async () => {
    setR(null); setErr("");
    const res = await coach(token, { action: "review" }).catch(() => ({ error: "Sin conexión" }));
    if (res.review) setR({ ...res.review, at: new Date().toISOString() }); else setErr(res.error || "No se pudo analizar");
  };
  return <Sheet title="Análisis de tus rutinas" onClose={onClose}>
    {err ? <p style={{ color: C.danger, fontSize: 14 }}>{err}</p> : !r ? <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.5 }}>La IA está revisando tus rutinas, el volumen por músculo y lo que venís levantando…</p> : <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="k-num" style={{ fontSize: 40, fontWeight: 500, color: r.puntaje >= 7 ? C.pos : r.puntaje >= 5 ? C.warn : C.neg }}>{r.puntaje}</span>
        <span style={{ color: C.sub }}>/ 10</span>
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.5, margin: "6px 0 0" }}>{r.resumen}</p>
      {r.fortalezas?.length > 0 && <><Label>Lo que está bien</Label>{r.fortalezas.map((x, i) => <Bullet key={i} color={C.pos}>{x}</Bullet>)}</>}
      {r.problemas?.length > 0 && <><Label>A mejorar</Label>{r.problemas.map((x, i) => <Bullet key={i} color={C.warn}>{x}</Bullet>)}</>}
      {r.cambios?.length > 0 && <><Label>Cambios sugeridos</Label>
        {r.cambios.map((c, i) => <div key={i} style={{ background: C.cardHi, borderRadius: 14, padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: C.sub }}>{c.rutina}</div>
          <div style={{ fontSize: 15, marginTop: 2 }}>{c.ejercicio}{c.reemplazo ? <span style={{ color: C.lime }}> → {c.reemplazo}</span> : null}</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 4, lineHeight: 1.45 }}>{c.sugerencia}</div>
        </div>)}
      </>}
      {r.volumen?.length > 0 && <><Label>Series por semana</Label>
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

// ─────── Historial ───────
function History({ workouts, exercises, onOpen }) {
  if (!workouts.length) return <div style={{ ...card, color: C.sub, fontSize: 14, marginTop: 22 }}>Cuando termines tu primer entreno aparece acá.</div>;
  return <div style={{ ...card, padding: "2px 16px", marginTop: 22 }}>
    {workouts.map((w, i) => {
      const vol = (w.sets || []).reduce((a, s) => a + Number(s.weight_kg) * s.reps, 0);
      const mins = w.finished_at ? Math.round((new Date(w.finished_at) - new Date(w.started_at)) / 60000) : 0;
      return <button key={w.id} onClick={() => onOpen(w)} style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", padding: "12px 0", borderBottom: i < workouts.length - 1 ? `0.5px solid ${C.line}` : "none", display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15 }}>{w.routine_name || "Entreno"}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{dayLabel(ymd(new Date(w.started_at)))} · {mins} min · {(w.sets || []).length} series</div>
        </div>
        <span className="k-num" style={{ fontSize: 14, color: C.sub, whiteSpace: "nowrap" }}>{Math.round(vol).toLocaleString("es-AR")} kg</span>
      </button>;
    })}
  </div>;
}

function WorkoutDetail({ w, exercises, token, onClose, onDeleted }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const byEx = [];
  for (const s of [...(w.sets || [])].sort((a, b) => a.set_index - b.set_index)) {
    let g = byEx.find(x => x.id === s.exercise_id);
    if (!g) { g = { id: s.exercise_id, name: exercises.find(e => e.id === s.exercise_id)?.name || "—", sets: [] }; byEx.push(g); }
    g.sets.push(s);
  }
  const del = async () => { await dq("kairo_workouts", { method: "DELETE", token, filters: `?id=eq.${w.id}` }); pushToast("Entreno eliminado"); onDeleted(); };
  return <Sheet title={w.routine_name || "Entreno"} onClose={onClose}>
    <div style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>{new Date(w.started_at).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</div>
    {byEx.map(g => <div key={g.id} style={{ background: C.cardHi, borderRadius: 14, padding: 12, marginBottom: 8 }}>
      <div style={{ fontSize: 15 }}>{g.name}</div>
      <div className="k-num" style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>{g.sets.map(s => `${kg(s.weight_kg)}×${s.reps}`).join("  ·  ")}</div>
    </div>)}
    {!confirmDel ? <button onClick={() => setConfirmDel(true)} style={{ ...linkBtn, color: C.sub, width: "100%", marginTop: 10 }}>Eliminar entreno</button>
      : <button onClick={del} style={{ ...linkBtn, color: C.danger, width: "100%", marginTop: 10 }}>Tocá de nuevo para eliminarlo</button>}
  </Sheet>;
}
