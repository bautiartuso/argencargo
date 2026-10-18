"use client";
// Kairo · Inicio. Lo primero que ves cada día: historias, cómo va tu día (comida y suplementos), tu
// semana de entrenos, tu peso, tu grupo (perfiles de todos), qué anduvieron haciendo, el ranking y la
// plata. El entreno de hoy va al final: se arranca desde Físico.
import { useState, useEffect, useCallback, useRef } from "react";
import { dq, loadSession } from "../../lib/sb-client";
import { C, I, Icon, pushToast, Sheet, SectionTitle, Label, card, btnLime, linkBtn, ars, monthName, curMonth, today, ymd, dayLabel, Bar, useRefresh, Skel } from "./ui";
import { startWorkout, todayPlan, planOn, ensurePush } from "./fisico";
import { dayScore, adjustTarget, cardioOn, plannedBurn, sportName } from "./score";
import { LogSheet, Spark, MeasuresTable, Avatar, saveProfile } from "./perfil";
import { StoriesBar, UserProfile } from "./social";

const n1 = (v) => Number(v).toLocaleString("es-AR", { maximumFractionDigits: 1 });
const r0 = (v) => Math.round(Number(v) || 0);
const DOW = ["L", "M", "X", "J", "V", "S", "D"];
const DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 60) return `hace ${Math.max(1, m)} min`; if (m < 1440) return `hace ${Math.round(m / 60)} h`; const d = Math.round(m / 1440); return d === 1 ? "ayer" : `hace ${d} días`; };
const addMin = (hhmm, m) => { const [h, mi] = hhmm.split(":").map(Number); const t = h * 60 + mi + m; return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
const lastTrained = (iso) => { if (!iso) return "Sin entrenos"; const d = ymd(new Date(iso)); return d === today() ? "Entrenó hoy" : dayLabel(d) === "ayer" ? "Entrenó ayer" : `Hace ${Math.round((Date.now() - new Date(iso)) / 86400e3)} días`; };

// Qué ordena el ranking (todo del mes en curso, solo entrenamiento).
const METRICS = [
  { id: "entrenos", label: "Entrenos", key: "entrenos_mes", unit: (v) => v === 1 ? "entreno" : "entrenos", help: "Entrenos terminados este mes. Si empatan, gana la racha más larga." },
  { id: "racha", label: "Racha", key: "racha_semanas", unit: (v) => v === 1 ? "semana" : "semanas", help: "Semanas seguidas con al menos un entreno, contando esta." },
  { id: "horas", label: "Horas", key: "minutos_mes", fmt: (v) => n1(v / 60), unit: () => "h", help: "Tiempo total entrenando este mes." },
  { id: "volumen", label: "Volumen", key: "volumen_mes", fmt: (v) => v >= 1000 ? n1(v / 1000) + "t" : r0(v), unit: () => "", help: "Kilos levantados en el mes (peso × repeticiones de cada serie)." },
];

export default function Hoy({ token, me, fin, go }) {
  const [routines, setRoutines] = useState(null);
  const [logs, setLogs] = useState([]);
  const [day, setDay] = useState(null);
  const [week, setWeek] = useState([]);
  const [weekFood, setWeekFood] = useState([]);
  const [weekCardio, setWeekCardio] = useState([]);
  // El grupo (ranking, historias, actividad) arranca con lo último que vimos, así no hay salto mientras se actualiza.
  const cached = (() => { try { return JSON.parse(localStorage.getItem("kairo_social_cache") || "null"); } catch { return null; } })();
  const [social, setSocial] = useState(cached?.users || null);
  const [stories, setStories] = useState(cached?.stories || []);
  const [actividad, setActividad] = useState(cached?.actividad || []);
  const [peso, setPeso] = useState("");
  const [metric, setMetric] = useState("entrenos");
  const [sheet, setSheet] = useState(null);
  const pesoRef = useRef(null);
  const [perm, setPerm] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);

  const loadSocial = useCallback(() => {
    fetch("/api/kairo/social", { headers: { Authorization: `Bearer ${loadSession()?.token || token}` } }).then(r => r.json()).then(r => { setSocial(r.users || []); setStories(r.stories || []); setActividad(r.actividad || []); try { localStorage.setItem("kairo_social_cache", JSON.stringify({ users: r.users || [], stories: (r.stories || []).map(({ thumb, ...s }) => ({ ...s, thumb: thumb?.length > 60000 ? null : thumb })), actividad: r.actividad || [] })); } catch {} }).catch(() => setSocial(s => s || []));
  }, [token]);
  const load = useCallback(async () => {
    const t = today(), dow = (new Date().getDay() + 6) % 7;
    const [r, it, ex, lg, food, supps, slog, ws, cardio] = await Promise.all([
      dq("kairo_routines", { token, filters: "?select=*&order=sort_order.asc,created_at.asc" }),
      dq("kairo_routine_exercises", { token, filters: "?select=*&order=sort_order.asc" }),
      dq("kairo_exercises", { token, filters: "?select=id,name,media_id,muscles_primary,muscles_secondary" }),
      dq("kairo_body_logs", { token, filters: "?select=*&order=log_date.desc,created_at.desc&limit=60" }),
      dq("kairo_food_log", { token, filters: `?log_date=gte.${ymd(mondayOf(new Date()))}&select=log_date,kcal,protein_g,carbs_g,fat_g` }),
      dq("kairo_supplements", { token, filters: "?active=eq.true&select=id,name,times,days" }),
      dq("kairo_supp_log", { token, filters: `?log_date=eq.${t}&select=supplement_id,slot` }),
      dq("kairo_workouts", { token, filters: `?finished_at=not.is.null&started_at=gte.${mondayOf(new Date()).toISOString()}&select=started_at,routine_name` }),
      dq("kairo_cardio", { token, filters: `?log_date=gte.${ymd(mondayOf(new Date()))}&select=log_date,kind,minutes,kcal` }),
    ]);
    setWeekCardio(Array.isArray(cardio) ? cardio : []);
    const exs = Array.isArray(ex) ? ex : [];
    const items = (Array.isArray(it) ? it : []).map(i => ({ ...i, exercise: exs.find(e => e.id === i.exercise_id) })).filter(i => i.exercise);
    setRoutines((Array.isArray(r) ? r : []).map(rt => ({ ...rt, items: items.filter(i => i.routine_id === rt.id) })));
    setLogs(Array.isArray(lg) ? lg : []);
    const wf = Array.isArray(food) ? food : [], f = wf.filter(x => x.log_date === t);
    setWeekFood(wf);
    const daySupps = (Array.isArray(supps) ? supps : []).filter(s => s.days?.includes(dow));
    const slots = daySupps.flatMap(s => (s.times?.length ? s.times : [""]).map(slot => s.id + "|" + slot));
    const taken = new Set((Array.isArray(slog) ? slog : []).map(x => x.supplement_id + "|" + x.slot));
    const pending = daySupps.flatMap(s => (s.times?.length ? s.times : [""]).filter(slot => !taken.has(s.id + "|" + slot)).map(slot => ({ name: s.name, slot }))).sort((a, b) => (a.slot || "99").localeCompare(b.slot || "99"));
    setDay({ kcal: f.reduce((a, x) => a + Number(x.kcal || 0), 0), p: f.reduce((a, x) => a + Number(x.protein_g || 0), 0), supps: slots.length, taken: slots.filter(x => taken.has(x)).length, pending, meals: f.length });
    setWeek(Array.isArray(ws) ? ws : []);
    loadSocial();
  }, [token, loadSocial]);
  useEffect(() => { load(); }, [load]);
  useRefresh(load);
  useEffect(() => { window.addEventListener("kairo-stories", loadSocial); return () => window.removeEventListener("kairo-stories", loadSocial); }, [loadSocial]);
  useEffect(() => { window.addEventListener("kairo-cardio", load); return () => window.removeEventListener("kairo-cardio", load); }, [load]);
  // Si ya diste permiso, se asegura la suscripción (para que te lleguen las historias de los demás).
  useEffect(() => { if (perm === "granted") ensurePush(token); }, [perm, token]);

  const d = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const plan = routines ? todayPlan(routines, me?.dias) : null;
  const weights = logs.filter(l => l.peso_kg).slice().reverse();
  const todayLog = logs.find(l => l.log_date === today() && l.peso_kg);
  // El objetivo de hoy incluye el deporte: lo registrado, o el estimado del plan hasta que lo registres.
  const todayDow = (new Date().getDay() + 6) % 7;
  const actualToday = weekCardio.filter(c => c.log_date === today()).reduce((a, c) => a + Number(c.kcal || 0), 0);
  const burnedToday = actualToday || plannedBurn(me?.cardio_plan, todayDow, me?.peso_kg);
  const st = adjustTarget(me?.estrategia, burnedToday);
  const myRow = social?.find(u => u.me);
  const others = (social || []).filter(u => !u.me);
  const M = METRICS.find(m => m.id === metric);
  const ranking = (social || []).slice().sort((a, b) => b[M.key] - a[M.key] || b.racha_semanas - a.racha_semanas || b.entrenos_mes - a.entrenos_mes);
  const person = (id) => (social || []).find(u => u.id === id) || {};
  const feed = [
    ...actividad.filter(a => a.user_id !== myRow?.id).map(a => ({ ...a, kind: "entreno" })),
    ...stories.filter(s => s.user_id !== myRow?.id).map(s => ({ user_id: s.user_id, at: s.created_at, kind: "historia" })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).filter((x, i, l) => x.kind === "entreno" || l.findIndex(y => y.kind === "historia" && y.user_id === x.user_id) === i).slice(0, 6);

  const savePeso = async () => {
    const v = Number(String(peso).replace(",", "."));
    if (!v) return pushToast("Poné tu peso");
    if (todayLog) await dq("kairo_body_logs", { method: "PATCH", token, filters: `?id=eq.${todayLog.id}`, body: { peso_kg: v } });
    else await dq("kairo_body_logs", { method: "POST", token, body: { log_date: today(), peso_kg: v } });
    await saveProfile(token, { peso_kg: v });
    setPeso(""); pushToast("Peso registrado"); load();
  };
  const askPush = async () => { await ensurePush(token); setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission); };

  // Éxito de cada día de la semana: pesas y comida en partes iguales, deporte un 15 % cuando toca.
  const mon = mondayOf(new Date()), todayIdx = (new Date().getDay() + 6) % 7;
  const days = DOW.map((l, i) => {
    const d = new Date(mon); d.setDate(d.getDate() + i); const date = ymd(d);
    if (i > todayIdx) return { i, l, date, future: true };
    const food = weekFood.filter(x => x.log_date === date);
    const eaten = { p: food.reduce((a, x) => a + Number(x.protein_g || 0), 0), c: food.reduce((a, x) => a + Number(x.carbs_g || 0), 0), g: food.reduce((a, x) => a + Number(x.fat_g || 0), 0), kcal: food.reduce((a, x) => a + Number(x.kcal || 0), 0) };
    const plan = routines ? planOn(routines, me?.dias, date) : { hoy: [], descanso: false, modo: "fijos" };
    const pesasPlan = plan.hoy.length > 0 || (plan.modo === "rotacion" && !plan.descanso);
    const pesasDone = week.some(w => ymd(new Date(w.started_at)) === date);
    const cPlan = cardioOn(me?.cardio_plan, i), cDone = weekCardio.filter(c => c.log_date === date);
    const actual = cDone.reduce((a, c) => a + Number(c.kcal || 0), 0);
    const burned = actual || (i === todayIdx ? plannedBurn(me?.cardio_plan, i, me?.peso_kg) : 0); // hoy: el estimado hasta que lo registres
    const sc = dayScore({ eaten, st: adjustTarget(me?.estrategia, burned), pesasPlan, pesasDone, cardioPlan: cPlan.reduce((a, x) => a + Number(x.minutes || 0), 0), cardioDone: cDone.reduce((a, c) => a + Number(c.minutes || 0), 0), logged: food.length > 0 });
    return { i, l, date, today: i === todayIdx, eaten, burned, cPlan, cDone, ...sc };
  });
  const past = days.filter(d => !d.future && !d.today), avg = past.length ? Math.round(past.reduce((a, d) => a + d.total, 0) / past.length) : null;
  const scoreColor = (n) => n >= 80 ? C.lime : n >= 50 ? C.warn : C.neg;
  const goal = me?.dias_semana || null;

  // Qué sigue: lo pendiente de hoy, en orden de urgencia. Se arma con datos, sin IA.
  const hhmm = new Date().toTimeString().slice(0, 5), hour = new Date().getHours();
  const next = [];
  if (plan) for (const r of plan.hoy) if (!week.some(w => ymd(new Date(w.started_at)) === today())) next.push({ k: "gym", icon: I.gym, text: `Entrenar ${r.name}`, sub: `${r.items.length} ejercicio${r.items.length === 1 ? "" : "s"}`, color: C.lime, run: () => startWorkout(token, r) });
  for (const c of cardioOn(me?.cardio_plan, todayIdx)) if (!weekCardio.some(x => x.log_date === today() && x.kind === c.kind)) next.push({ k: "cardio", icon: I.fire, text: `${sportName(c.kind)} ${c.minutes} min`, sub: c.time ? `a las ${c.time}` : "registralo cuando lo hagas", color: C.blue, run: () => { try { sessionStorage.setItem("kairo_fisico_view", "deporte"); } catch {} go("fisico"); } });
  const dueSupp = day?.pending?.find(p => !p.slot || p.slot <= hhmm) || (day?.pending?.[0]?.slot <= addMin(hhmm, 60) ? day.pending[0] : null);
  if (dueSupp) next.push({ k: "supp", icon: I.check, text: `Tomá ${dueSupp.name}`, sub: dueSupp.slot ? (dueSupp.slot <= hhmm ? `era a las ${dueSupp.slot}` : `a las ${dueSupp.slot}`) : "sin horario", color: dueSupp.slot && dueSupp.slot <= hhmm ? C.warn : C.pos, run: () => go("nutricion") });
  if (day && !day.meals && hour >= 11) next.push({ k: "food", icon: I.food, text: "Cargá lo que comiste", sub: "todavía no hay nada hoy", color: C.sub, run: () => go("nutricion") });
  else if (day && st?.proteina_g && hour >= 17 && st.proteina_g - day.p >= 20) next.push({ k: "prot", icon: I.food, text: `Te faltan ${r0(st.proteina_g - day.p)} g de proteína`, sub: "para llegar al objetivo de hoy", color: C.blue, run: () => go("nutricion") });
  if (!todayLog && hour < 12 && logs.length) next.push({ k: "peso", icon: I.target, text: "Pesate", sub: "mejor en ayunas", color: C.sub, run: () => pesoRef.current?.focus() });
  const todayScore = days[todayIdx]?.total ?? 0;

  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{me?.nombre ? `Hola, ${me.nombre.split(" ")[0]}` : "Hola"}</div>
        <div style={{ fontSize: 13, color: C.sub }}>{d[0].toUpperCase() + d.slice(1)}</div>
      </div>
      {myRow?.racha_semanas > 0 && <button onClick={() => setSheet({ type: "racha" })} className="k-press" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 999, border: "none", background: "rgba(198,244,50,0.1)", color: C.lime }}>
        <Icon d={I.fire} size={16} sw={1.8} /><span className="k-num" style={{ fontSize: 14, fontWeight: 600 }}>{myRow.racha_semanas}</span><span style={{ fontSize: 12, fontWeight: 500 }}>sem</span>
      </button>}
    </div>

    <StoriesBar token={token} me={me} users={social || []} stories={stories} onProfile={(id) => setSheet({ type: "user", id })} />

    {/* Hoy en vivo: el éxito del día hasta ahora y qué sigue */}
    {!day || !routines ? <Skel h={118} r={20} style={{ marginTop: 4 }} /> : <div style={{ ...card, marginTop: 4, display: "flex", gap: 14, alignItems: "center", padding: "14px 16px" }}>
      <button onClick={() => setSheet({ type: "day", i: todayIdx })} aria-label="Cómo va tu día" style={{ background: "none", border: "none", padding: 0, position: "relative", width: 86, height: 86, flexShrink: 0 }}>
        <svg width="86" height="86" viewBox="0 0 86 86" aria-hidden="true">
          <circle cx="43" cy="43" r="37" fill="none" stroke={C.line} strokeWidth="7" />
          {todayScore > 0 && <circle cx="43" cy="43" r="37" fill="none" stroke={scoreColor(todayScore)} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 37 * todayScore / 100} ${2 * Math.PI * 37}`} transform="rotate(-90 43 43)" style={{ transition: "stroke-dasharray 700ms cubic-bezier(.2,.9,.3,1)" }} />}
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span className="k-num" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>{todayScore}</span>
          <span style={{ fontSize: 10.5, color: C.sub, marginTop: 3 }}>hoy</span>
        </span>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 6 }}>{next.length ? "Qué sigue" : "Todo al día"}</div>
        {next.length ? next.slice(0, 3).map(n => <button key={n.k} onClick={n.run} className="k-press" style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", display: "flex", alignItems: "center", gap: 9, padding: "5px 0" }}>
          <span style={{ width: 26, height: 26, borderRadius: 13, background: C.cardHi, color: n.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon d={n.icon} size={14} sw={2} /></span>
          <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 14, fontWeight: 500, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.text}</span><span style={{ fontSize: 11.5, color: C.sub }}>{n.sub}</span></span>
          <Icon d={I.right} size={14} color={C.dim} />
        </button>) : <div style={{ fontSize: 14, lineHeight: 1.45 }}>No te queda nada pendiente por ahora.{todayScore >= 80 ? " Gran día." : ""}</div>}
      </div>
    </div>}

    {/* Tu día: calorías, proteína y suplementos */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
      <DayTile label="Calorías" onClick={() => go("nutricion")} value={day ? r0(day.kcal).toLocaleString("es-AR") : "—"} sub={st?.calorias_dia ? `de ${r0(st.calorias_dia).toLocaleString("es-AR")}${burnedToday ? ` · +${r0(burnedToday)} deporte${actualToday ? "" : " (est.)"}` : ""}` : "sin objetivo"} pct={st?.calorias_dia && day ? day.kcal / st.calorias_dia : 0} color={C.lime} />
      <DayTile label="Proteína" onClick={() => go("nutricion")} value={day ? `${r0(day.p)} g` : "—"} sub={st?.proteina_g ? `de ${r0(st.proteina_g)} g` : "sin objetivo"} pct={st?.proteina_g && day ? day.p / st.proteina_g : 0} color={C.blue} />
      <DayTile label="Suplementos" onClick={() => go("nutricion")} value={day ? (day.supps ? `${day.taken}/${day.supps}` : "—") : "—"} sub={day?.supps ? (day.taken === day.supps ? "todos tomados" : `${day.supps - day.taken} pendiente${day.supps - day.taken > 1 ? "s" : ""}`) : "sin cargar"} pct={day?.supps ? day.taken / day.supps : 0} color={C.pos} />
    </div>


    {perm === "default" && <button className="k-press" onClick={askPush} style={{ ...card, width: "100%", textAlign: "left", color: C.text, marginTop: 10, display: "flex", gap: 12, alignItems: "center", padding: 14 }}>
      <span style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(61,123,255,0.15)", color: C.blue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon d={I.bell} size={19} /></span>
      <span style={{ flex: 1 }}><span style={{ fontSize: 14.5, fontWeight: 500, display: "block" }}>Activá las notificaciones</span><span style={{ fontSize: 12.5, color: C.sub }}>Para enterarte cuando suben historias y no olvidarte los suplementos.</span></span>
    </button>}

    {me && !me.nombre && <button className="k-press" onClick={() => go("perfil")} style={{ ...card, width: "100%", textAlign: "left", color: C.text, marginTop: 10, borderColor: "rgba(198,244,50,0.3)" }}>
      <div style={{ fontSize: 15, fontWeight: 500 }}>Completá tu perfil</div>
      <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>Tu nombre y tu objetivo: con eso Kairo arma tu plan.</div>
    </button>}

    {/* Tu semana: el éxito de cada día */}
    <SectionTitle right={<button onClick={() => setSheet({ type: "day", i: todayIdx })} style={linkBtn}>Cómo se mide</button>}>Tu semana</SectionTitle>
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {days.map(d => <button key={d.i} onClick={() => !d.future && setSheet({ type: "day", i: d.i })} disabled={d.future} style={{ background: "none", border: "none", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: C.text }}>
          <span style={{ fontSize: 11.5, color: d.today ? C.text : C.dim, fontWeight: d.today ? 600 : 400 }}>{d.l}</span>
          <DayRing value={d.future ? null : d.total} color={d.future ? C.line : scoreColor(d.total)} today={d.today} />
        </button>)}
      </div>
      <div style={{ fontSize: 13, color: C.sub, marginTop: 14, display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span><span className="k-num" style={{ color: C.text, fontWeight: 600 }}>{week.length}</span>{goal ? ` de ${goal}` : ""} entreno{week.length === 1 ? "" : "s"}{avg != null ? <> · <span className="k-num" style={{ color: scoreColor(avg), fontWeight: 600 }}>{avg}%</span> de éxito</> : ""}</span>
        {myRow && <span>{myRow.racha_semanas ? `Racha: ${myRow.racha_semanas} sem` : "Arrancá la racha"}</span>}
      </div>
    </div>

    {/* Peso */}
    <SectionTitle right={<button onClick={() => setSheet({ type: "log" })} style={linkBtn}>+ Medidas</button>}>Peso</SectionTitle>
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "baseline", gap: 6 }}>
          <input ref={pesoRef} inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value)} placeholder={todayLog ? n1(todayLog.peso_kg) : weights.length ? n1(weights.at(-1).peso_kg) : "0"} className="k-num" style={{ width: "100%", minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 32, fontWeight: 500 }} />
          <span style={{ color: C.sub }}>kg</span>
        </div>
        <button className="k-press" onClick={savePeso} style={{ ...btnLime, width: "auto", padding: "10px 16px", fontSize: 14 }}>{todayLog ? "Corregir" : "Guardar"}</button>
      </div>
      <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{todayLog ? `Hoy: ${n1(todayLog.peso_kg)} kg` : "Todavía no te pesaste hoy"}{weights.length > 1 ? ` · ${weights.at(-1).peso_kg - weights[0].peso_kg > 0 ? "+" : ""}${n1(weights.at(-1).peso_kg - weights[0].peso_kg)} kg desde ${dayLabel(weights[0].log_date)}` : ""}</div>
      {weights.length > 1 && <Spark values={weights.map(w => Number(w.peso_kg))} />}
      <MeasuresTable logs={logs} />
    </div>

    {/* Tu grupo: los perfiles de todos */}
    {social === null && <><SectionTitle>Tu grupo</SectionTitle><div style={{ display: "flex", gap: 10 }}>{[0, 1, 2].map(i => <Skel key={i} h={128} w={116} r={20} />)}</div></>}
    {others.length > 0 && <>
      <SectionTitle>Tu grupo</SectionTitle>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", margin: "0 -16px", padding: "0 16px 2px", scrollbarWidth: "none" }}>
        {others.map(u => { const today_ = u.ultimo && ymd(new Date(u.ultimo)) === today(); return <button key={u.id} className="k-press" onClick={() => setSheet({ type: "user", id: u.id })} style={{ ...card, flexShrink: 0, width: 116, padding: "14px 10px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: C.text }}>
          <span style={{ position: "relative" }}>
            <Avatar src={u.avatar} size={60} />
            {today_ && <span style={{ position: "absolute", right: 1, bottom: 1, width: 14, height: 14, borderRadius: 7, background: C.pos, border: `2.5px solid ${C.card}` }} />}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.nombre.split(" ")[0]}</span>
          <span style={{ fontSize: 11.5, color: today_ ? C.pos : C.sub, marginTop: -4 }}>{lastTrained(u.ultimo)}</span>
        </button>; })}
      </div>
    </>}

    {/* Qué anduvieron haciendo */}
    {feed.length > 0 && <>
      <SectionTitle>Actividad</SectionTitle>
      <div style={{ ...card, padding: "2px 14px" }}>
        {feed.map((a, i) => { const u = person(a.user_id); return <button key={i} onClick={() => setSheet({ type: "user", id: a.user_id })} style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < feed.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <Avatar src={u.avatar} size={36} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14.5, display: "block", lineHeight: 1.35 }}><b style={{ fontWeight: 600 }}>{(u.nombre || "").split(" ")[0]}</b> {a.kind === "historia" ? "subió una historia" : <>entrenó <b style={{ fontWeight: 600 }}>{a.rutina}</b></>}</span>
            <span style={{ fontSize: 12, color: C.sub }}>{a.kind === "entreno" ? `${a.minutos} min · ${a.series} series · ` : ""}{ago(a.at)}</span>
          </span>
          <span style={{ width: 30, height: 30, borderRadius: 15, background: a.kind === "historia" ? "rgba(198,244,50,0.12)" : "rgba(61,123,255,0.14)", color: a.kind === "historia" ? C.lime : C.blue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon d={a.kind === "historia" ? I.camera : I.gym} size={16} /></span>
        </button>; })}
      </div>
    </>}

    {/* Ranking */}
    {social && social.length > 1 && <>
      <SectionTitle right={<span style={{ fontSize: 12, color: C.dim }}>{monthName(curMonth())}</span>}>Ranking</SectionTitle>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", scrollbarWidth: "none" }}>
        {METRICS.map(m => <button key={m.id} onClick={() => setMetric(m.id)} className="k-press" style={{ border: `0.5px solid ${metric === m.id ? C.lime : C.line}`, background: metric === m.id ? "rgba(198,244,50,0.1)" : C.card, color: metric === m.id ? C.lime : C.sub, borderRadius: 999, padding: "7px 13px", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>{m.label}</button>)}
      </div>
      <div style={{ ...card, padding: "4px 14px" }}>
        {ranking.map((u, i) => { const v = u[M.key]; return <button key={u.id} onClick={() => setSheet({ type: "user", id: u.id })} style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < ranking.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <span className="k-num" style={{ width: 22, height: 22, borderRadius: 11, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, background: i === 0 && v ? C.lime : "transparent", color: i === 0 && v ? C.limeInk : C.dim }}>{i + 1}</span>
          <Avatar src={u.avatar} size={34} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: u.me ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.nombre}{u.me ? " (vos)" : ""}</span>
          <span style={{ textAlign: "right" }}>
            <span className="k-num" style={{ fontSize: 18, fontWeight: 500 }}>{M.fmt ? M.fmt(v) : v}</span>
            <span style={{ fontSize: 11.5, color: C.sub, marginLeft: 4 }}>{M.unit(v)}</span>
          </span>
        </button>; })}
      </div>
      <div style={{ fontSize: 12, color: C.dim, margin: "8px 2px 0", lineHeight: 1.45 }}>{M.help}</div>
    </>}

    {/* Plata (solo vos la ves) */}
    {fin && (fin.budget != null || fin.spent > 0) && <>
      <SectionTitle>Finanzas · {monthName(curMonth()).toLowerCase()}</SectionTitle>
      <button className="k-press" onClick={() => go("finanzas")} style={{ ...card, width: "100%", textAlign: "left", color: C.text, display: "block" }}>
        <div className="k-num" style={{ fontSize: 26, fontWeight: 500, color: fin.monthLeft >= 0 ? C.pos : C.neg }}>{fin.monthLeft < 0 ? "−" : ""}{ars(Math.abs(fin.monthLeft))}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>saldo del mes{fin.daysLeft > 0 && fin.monthLeft > 0 ? ` · ${ars(fin.monthLeft / fin.daysLeft)} por día` : ""}</div>
        <Bar pct={fin.income > 0 ? fin.spent / fin.income : 1} color={C.blue} mark={fin.dayNow / fin.dim} />
        {fin.uncategorized.length > 0 && <div style={{ fontSize: 13, color: C.lime, marginTop: 12 }}>{fin.uncategorized.length} gasto{fin.uncategorized.length > 1 ? "s" : ""} sin categoría</div>}
      </button>
    </>}

    {/* Entreno de hoy, al final: se arranca desde Físico */}
    {plan && <div style={{ marginTop: 26, display: "grid", gap: 6 }}>
      {cardioOn(me?.cardio_plan, todayIdx).map((c, k) => { const done = weekCardio.find(x => x.log_date === today() && x.kind === c.kind); return <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, border: `0.5px solid ${C.line}` }}>
        <Icon d={done ? I.check : I.fire} size={17} color={done ? C.pos : C.sub} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.sub }}>{done ? <><span style={{ color: C.text }}>{sportName(c.kind)}</span> hecho · {done.kcal} kcal</> : <>Hoy te toca <span style={{ color: C.text }}>{sportName(c.kind)}</span> {c.minutes} min{c.time ? ` · ${c.time}` : ""}</>}</span>
        {!done && <button onClick={() => { try { sessionStorage.setItem("kairo_fisico_view", "deporte"); } catch {} go("fisico"); }} style={{ ...linkBtn, fontSize: 13.5 }}>Registrar</button>}
      </div>; })}
      {plan.hoy.length ? plan.hoy.map(r => <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, border: `0.5px solid ${C.line}` }}>
        <Icon d={I.gym} size={17} color={C.sub} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.sub }}>Hoy te toca <span style={{ color: C.text }}>{r.name}</span></span>
        {!week.some(w => ymd(new Date(w.started_at)) === today()) && <button onClick={() => startWorkout(token, r)} disabled={!r.items.length} style={{ ...linkBtn, fontSize: 13.5 }}>Empezar</button>}
      </div>)
        : <div style={{ fontSize: 12.5, color: C.dim, textAlign: "center" }}>{(w => w ? `Ya entrenaste hoy: ${w.routine_name || "entreno"}` : plan.descanso ? "Hoy no hay pesas" : routines.length ? "Hoy no tenés rutina asignada" : "Armá tu primera rutina en Físico")(week.find(w => ymd(new Date(w.started_at)) === today()))}{plan.manana ? ` · Mañana: ${plan.manana}` : ""}</div>}
    </div>}

    {sheet?.type === "racha" && <Sheet title={`Racha de ${myRow?.racha_semanas} ${myRow?.racha_semanas === 1 ? "semana" : "semanas"}`} onClose={() => setSheet(null)}>
      <p style={{ fontSize: 15, lineHeight: 1.55, margin: 0 }}>Son las semanas seguidas en las que entrenaste al menos una vez, contando esta. Se corta si pasa una semana entera (lunes a domingo) sin ningún entreno.</p>
      <div style={{ ...card, marginTop: 14, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>{week.length ? `Esta semana ya entrenaste ${week.length} ${week.length === 1 ? "vez" : "veces"}: la racha está a salvo.` : "Esta semana todavía no entrenaste: con un entreno antes del domingo la mantenés."}</div>
    </Sheet>}
    {sheet?.type === "day" && <DaySheet d={days[sheet.i]} go={go} onClose={() => setSheet(null)} />}
    {sheet?.type === "user" && <UserProfile token={token} id={sheet.id} onClose={() => setSheet(null)} />}
    {sheet?.type === "log" && <LogSheet token={token} last={logs[0]} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
  </>;
}

function DayTile({ label, value, sub, pct, color, onClick }) {
  return <button className="k-press" onClick={onClick} style={{ ...card, padding: "12px 12px 13px", textAlign: "left", color: C.text, minWidth: 0 }}>
    <div style={{ fontSize: 12, color: C.sub }}>{label}</div>
    <div className="k-num" style={{ fontSize: 19, fontWeight: 600, marginTop: 4, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{value}</div>
    <div className="k-num" style={{ fontSize: 11, color: C.dim, marginTop: 1, lineHeight: 1.3, minHeight: 28 }}>{sub}</div>
    <div style={{ height: 4, background: C.line, borderRadius: 2, marginTop: 9 }}><div style={{ width: `${Math.min(100, (pct || 0) * 100)}%`, height: 4, borderRadius: 2, background: pct > 1.08 && label !== "Suplementos" ? C.warn : color, transition: "width 500ms cubic-bezier(.2,.9,.3,1)" }} /></div>
  </button>;
}

// Anillo chico con el porcentaje del día adentro.
function DayRing({ value, color, today: now }) {
  const R = 14, L = 2 * Math.PI * R;
  return <span style={{ position: "relative", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
      <circle cx="18" cy="18" r={R} fill="none" stroke={now ? C.sub : C.line} strokeWidth={value == null ? 1.5 : 3} strokeDasharray={value == null && !now ? "3 3" : "none"} />
      {value > 0 && <circle cx="18" cy="18" r={R} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${L * value / 100} ${L}`} transform="rotate(-90 18 18)" style={{ transition: "stroke-dasharray 500ms cubic-bezier(.2,.9,.3,1)" }} />}
    </svg>
    <span className="k-num" style={{ fontSize: value === 100 ? 9.5 : 10.5, fontWeight: 600, color: value == null ? C.dim : C.text }}>{value == null ? "" : value}</span>
  </span>;
}

// Cómo se armó el éxito de un día: cada parte con su peso, y la comida macro por macro.
function DaySheet({ d, go, onClose }) {
  const title = d.today ? "Hoy" : DAYS_FULL[d.i] + " " + d.date.slice(8) + "/" + d.date.slice(5, 7);
  const pct = (n) => `${Math.round(n * 100)}%`, w = (n) => `${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
  const col = (x) => x >= 0.8 ? C.lime : x >= 0.4 ? C.warn : C.neg;
  const detail = (p) => p.id === "pesas" ? (d.pesasDone ? "Entrenaste" : d.today ? "Todavía no entrenaste" : "No entrenaste")
    : p.id === "cardio" ? (d.cDone.length ? `${d.cDone.map(c => sportName(c.kind)).join(" + ")} · ${d.cardioDone} min · ${d.burned} kcal` : `${d.cPlan.map(c => sportName(c.kind)).join(" + ")} ${d.cardioPlan} min · ${d.today ? "todavía no" : "no lo hiciste"}`)
    : d.sinObjetivo ? "Sin objetivo de macros" : !d.eaten.kcal ? (d.today ? "Todavía no cargaste comida" : "No cargaste comida") : `${Math.round(d.eaten.kcal).toLocaleString("es-AR")} kcal`;
  return <Sheet title={`${title} · ${d.total}%`} onClose={onClose}>
    <p style={{ fontSize: 13.5, color: C.sub, margin: "-4px 0 0", lineHeight: 1.5 }}>Pesas y comida valen lo mismo. Si ese día tenés deporte, vale un 15 % y el resto se reparte. Un día sin pesas ni deporte es 100 % comida. La comida se mide por qué tan cerca quedaste de tu objetivo de proteína, carbohidratos y grasas (hasta 10 % de diferencia vale completo).</p>
    <Label>Cómo se armó</Label>
    <div style={{ ...card, padding: "4px 14px" }}>
      {d.parts.map((p, i) => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: i < d.parts.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
        <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 15, display: "block" }}>{p.label} <span style={{ color: C.dim, fontSize: 12.5 }}>· vale {w(p.w)}</span></span><span style={{ fontSize: 12.5, color: C.sub }}>{detail(p)}</span></span>
        <span className="k-num" style={{ fontSize: 16, fontWeight: 600, color: p.id === "comida" && d.sinObjetivo ? C.dim : col(p.got) }}>{p.id === "comida" && d.sinObjetivo ? "—" : `${Math.round(p.got * p.w)}/${w(p.w).replace("%", "")}`}</span>
      </div>)}
    </div>
    <Label>Comida</Label>
    {d.sinObjetivo ? <button className="k-press" onClick={() => { onClose(); go("perfil"); }} style={{ ...card, width: "100%", textAlign: "left", color: C.text, borderColor: "rgba(198,244,50,0.3)" }}>
      <div style={{ fontSize: 15, fontWeight: 500 }}>Todavía no tenés objetivo de macros</div>
      <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>Calculalos en Perfil y la comida empieza a contar. Mientras tanto, el día se mide por lo demás.</div>
    </button> : <div style={{ ...card, padding: "4px 14px" }}>
      {d.macros.map((m, i) => <div key={m.k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `0.5px solid ${C.line}` }}>
        <span style={{ flex: 1, fontSize: 14.5 }}>{m.label}</span>
        <span className="k-num" style={{ fontSize: 13, color: C.sub }}>{Math.round(m.eaten)} / {Math.round(m.target)} g</span>
        <span className="k-num" style={{ width: 44, textAlign: "right", fontSize: 14, fontWeight: 600, color: col(m.score) }}>{!d.eaten.kcal ? "—" : pct(m.score)}</span>
      </div>)}
      <div style={{ fontSize: 12.5, color: C.sub, padding: "10px 0" }}>{d.burned ? `El objetivo de ese día incluye +${d.burned} kcal por el deporte.` : "Sin deporte registrado ese día."}</div>
    </div>}
  </Sheet>;
}
