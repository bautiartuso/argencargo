"use client";
// Kairo · Inicio. Lo primero que ves cada día: historias, cómo va tu día (comida y suplementos), tu
// semana de entrenos, tu peso, tu grupo (perfiles de todos), qué anduvieron haciendo, el ranking y la
// plata. El entreno de hoy va al final: se arranca desde Físico.
import { useState, useEffect, useCallback } from "react";
import { dq, loadSession } from "../../lib/sb-client";
import { C, I, Icon, pushToast, SectionTitle, card, btnLime, linkBtn, ars, monthName, curMonth, today, ymd, dayLabel, Bar } from "./ui";
import { startWorkout, todayPlan, ensurePush } from "./fisico";
import { LogSheet, Spark, MeasuresTable, Avatar, saveProfile } from "./perfil";
import { StoriesBar, UserProfile } from "./social";

const n1 = (v) => Number(v).toLocaleString("es-AR", { maximumFractionDigits: 1 });
const r0 = (v) => Math.round(Number(v) || 0);
const DOW = ["L", "M", "X", "J", "V", "S", "D"];
const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 60) return `hace ${Math.max(1, m)} min`; if (m < 1440) return `hace ${Math.round(m / 60)} h`; const d = Math.round(m / 1440); return d === 1 ? "ayer" : `hace ${d} días`; };
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
  const [social, setSocial] = useState(null);
  const [stories, setStories] = useState([]);
  const [actividad, setActividad] = useState([]);
  const [peso, setPeso] = useState("");
  const [metric, setMetric] = useState("entrenos");
  const [sheet, setSheet] = useState(null);
  const [perm, setPerm] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);

  const loadSocial = useCallback(() => {
    fetch("/api/kairo/social", { headers: { Authorization: `Bearer ${loadSession()?.token || token}` } }).then(r => r.json()).then(r => { setSocial(r.users || []); setStories(r.stories || []); setActividad(r.actividad || []); }).catch(() => setSocial([]));
  }, [token]);
  const load = useCallback(async () => {
    const t = today(), dow = (new Date().getDay() + 6) % 7;
    const [r, it, ex, lg, food, supps, slog, ws] = await Promise.all([
      dq("kairo_routines", { token, filters: "?select=*&order=sort_order.asc,created_at.asc" }),
      dq("kairo_routine_exercises", { token, filters: "?select=*&order=sort_order.asc" }),
      dq("kairo_exercises", { token, filters: "?select=id,name,media_id,muscles_primary,muscles_secondary" }),
      dq("kairo_body_logs", { token, filters: "?select=*&order=log_date.desc,created_at.desc&limit=60" }),
      dq("kairo_food_log", { token, filters: `?log_date=eq.${t}&select=kcal,protein_g` }),
      dq("kairo_supplements", { token, filters: "?active=eq.true&select=id,times,days" }),
      dq("kairo_supp_log", { token, filters: `?log_date=eq.${t}&select=supplement_id,slot` }),
      dq("kairo_workouts", { token, filters: `?finished_at=not.is.null&started_at=gte.${mondayOf(new Date()).toISOString()}&select=started_at,routine_name` }),
    ]);
    const exs = Array.isArray(ex) ? ex : [];
    const items = (Array.isArray(it) ? it : []).map(i => ({ ...i, exercise: exs.find(e => e.id === i.exercise_id) })).filter(i => i.exercise);
    setRoutines((Array.isArray(r) ? r : []).map(rt => ({ ...rt, items: items.filter(i => i.routine_id === rt.id) })));
    setLogs(Array.isArray(lg) ? lg : []);
    const f = Array.isArray(food) ? food : [];
    const daySupps = (Array.isArray(supps) ? supps : []).filter(s => s.days?.includes(dow));
    const slots = daySupps.flatMap(s => (s.times?.length ? s.times : [""]).map(slot => s.id + "|" + slot));
    const taken = new Set((Array.isArray(slog) ? slog : []).map(x => x.supplement_id + "|" + x.slot));
    setDay({ kcal: f.reduce((a, x) => a + Number(x.kcal || 0), 0), p: f.reduce((a, x) => a + Number(x.protein_g || 0), 0), supps: slots.length, taken: slots.filter(x => taken.has(x)).length });
    setWeek(Array.isArray(ws) ? ws : []);
    loadSocial();
  }, [token, loadSocial]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { window.addEventListener("kairo-stories", loadSocial); return () => window.removeEventListener("kairo-stories", loadSocial); }, [loadSocial]);
  // Si ya diste permiso, se asegura la suscripción (para que te lleguen las historias de los demás).
  useEffect(() => { if (perm === "granted") ensurePush(token); }, [perm, token]);

  const d = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const plan = routines ? todayPlan(routines, me?.dias) : null;
  const weights = logs.filter(l => l.peso_kg).slice().reverse();
  const todayLog = logs.find(l => l.log_date === today() && l.peso_kg);
  const st = me?.estrategia;
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

  // Días entrenados de esta semana.
  const mon = mondayOf(new Date()), todayIdx = (new Date().getDay() + 6) % 7;
  const trained = new Set(week.map(w => Math.floor((new Date(w.started_at) - mon) / 86400e3)));
  const goal = me?.dias_semana || null;

  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{me?.nombre ? `Hola, ${me.nombre.split(" ")[0]}` : "Hola"}</div>
        <div style={{ fontSize: 13, color: C.sub }}>{d[0].toUpperCase() + d.slice(1)}</div>
      </div>
      {myRow?.racha_semanas > 0 && <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 999, background: "rgba(198,244,50,0.1)", color: C.lime }}>
        <Icon d={I.fire} size={16} sw={1.8} /><span className="k-num" style={{ fontSize: 14, fontWeight: 600 }}>{myRow.racha_semanas}</span>
      </div>}
    </div>

    <StoriesBar token={token} me={me} users={social || []} stories={stories} onProfile={(id) => setSheet({ type: "user", id })} />

    {/* Tu día: calorías, proteína y suplementos, pegado a las historias */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
      <DayTile label="Calorías" onClick={() => go("nutricion")} value={day ? r0(day.kcal).toLocaleString("es-AR") : "—"} sub={st?.calorias_dia ? `de ${r0(st.calorias_dia).toLocaleString("es-AR")}` : "sin objetivo"} pct={st?.calorias_dia && day ? day.kcal / st.calorias_dia : 0} color={C.lime} />
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

    {/* Tu semana */}
    <SectionTitle right={<button onClick={() => go("fisico")} style={linkBtn}>Físico</button>}>Tu semana</SectionTitle>
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {DOW.map((l, i) => { const on = trained.has(i), now = i === todayIdx, future = i > todayIdx; return <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11.5, color: now ? C.text : C.dim, fontWeight: now ? 600 : 400 }}>{l}</span>
          <span style={{ width: 34, height: 34, borderRadius: 17, display: "flex", alignItems: "center", justifyContent: "center", background: on ? C.lime : "transparent", border: on ? "none" : `1.5px ${future ? "dashed" : "solid"} ${now ? C.sub : C.line}`, color: C.limeInk }}>{on && <Icon d={I.check} size={16} sw={2.8} />}</span>
        </div>; })}
      </div>
      <div style={{ fontSize: 13, color: C.sub, marginTop: 14, display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span><span className="k-num" style={{ color: C.text, fontWeight: 600 }}>{week.length}</span>{goal ? ` de ${goal}` : ""} entreno{week.length === 1 ? "" : "s"} esta semana</span>
        {myRow && <span>{myRow.racha_semanas ? `Racha: ${myRow.racha_semanas} sem` : "Arrancá la racha"}</span>}
      </div>
    </div>

    {/* Peso */}
    <SectionTitle right={<button onClick={() => setSheet({ type: "log" })} style={linkBtn}>+ Medidas</button>}>Peso</SectionTitle>
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "baseline", gap: 6 }}>
          <input inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value)} placeholder={todayLog ? n1(todayLog.peso_kg) : weights.length ? n1(weights.at(-1).peso_kg) : "0"} className="k-num" style={{ width: "100%", minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 32, fontWeight: 500 }} />
          <span style={{ color: C.sub }}>kg</span>
        </div>
        <button className="k-press" onClick={savePeso} style={{ ...btnLime, width: "auto", padding: "10px 16px", fontSize: 14 }}>{todayLog ? "Corregir" : "Guardar"}</button>
      </div>
      <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{todayLog ? `Hoy: ${n1(todayLog.peso_kg)} kg` : "Todavía no te pesaste hoy"}{weights.length > 1 ? ` · ${weights.at(-1).peso_kg - weights[0].peso_kg > 0 ? "+" : ""}${n1(weights.at(-1).peso_kg - weights[0].peso_kg)} kg desde ${dayLabel(weights[0].log_date)}` : ""}</div>
      {weights.length > 1 && <Spark values={weights.map(w => Number(w.peso_kg))} />}
      <MeasuresTable logs={logs} />
    </div>

    {/* Tu grupo: los perfiles de todos */}
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
      {plan.hoy.length ? plan.hoy.map(r => <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, border: `0.5px solid ${C.line}` }}>
        <Icon d={I.gym} size={17} color={C.sub} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.sub }}>Hoy te toca <span style={{ color: C.text }}>{r.name}</span></span>
        {!week.some(w => ymd(new Date(w.started_at)) === today()) && <button onClick={() => startWorkout(token, r)} disabled={!r.items.length} style={{ ...linkBtn, fontSize: 13.5 }}>Empezar</button>}
      </div>)
        : <div style={{ fontSize: 12.5, color: C.dim, textAlign: "center" }}>{plan.descanso ? "Hoy descansás" : routines.length ? "Hoy no tenés rutina asignada" : "Armá tu primera rutina en Físico"}{plan.manana ? ` · Mañana: ${plan.manana}` : ""}</div>}
    </div>}

    {sheet?.type === "user" && <UserProfile token={token} id={sheet.id} onClose={() => setSheet(null)} />}
    {sheet?.type === "log" && <LogSheet token={token} last={logs[0]} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
  </>;
}

function DayTile({ label, value, sub, pct, color, onClick }) {
  return <button className="k-press" onClick={onClick} style={{ ...card, padding: "12px 12px 13px", textAlign: "left", color: C.text, minWidth: 0 }}>
    <div style={{ fontSize: 12, color: C.sub }}>{label}</div>
    <div className="k-num" style={{ fontSize: 19, fontWeight: 600, marginTop: 4, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{value}</div>
    <div className="k-num" style={{ fontSize: 11, color: C.dim, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
    <div style={{ height: 4, background: C.line, borderRadius: 2, marginTop: 9 }}><div style={{ width: `${Math.min(100, (pct || 0) * 100)}%`, height: 4, borderRadius: 2, background: pct > 1.08 && label !== "Suplementos" ? C.warn : color, transition: "width 500ms cubic-bezier(.2,.9,.3,1)" }} /></div>
  </button>;
}
