"use client";
// Kairo · Inicio. Lo primero que ves cada día: qué entrenás hoy, tu peso (se carga en dos toques),
// cómo vienen tus amigos y un resumen de la plata.
import { useState, useEffect, useCallback } from "react";
import { dq, loadSession } from "../../lib/sb-client";
import { C, I, Icon, pushToast, SectionTitle, card, btnLime, linkBtn, ars, monthName, curMonth, today, dayLabel, Bar } from "./ui";
import { startWorkout, todayPlan } from "./fisico";
import { LogSheet, Spark, MeasuresTable, Avatar } from "./perfil";

const n1 = (v) => Number(v).toLocaleString("es-AR", { maximumFractionDigits: 1 });

export default function Hoy({ token, me, fin, go }) {
  const [routines, setRoutines] = useState(null);
  const [logs, setLogs] = useState([]);
  const [social, setSocial] = useState(null);
  const [peso, setPeso] = useState("");
  const [sheet, setSheet] = useState(null);

  const load = useCallback(async () => {
    const [r, it, ex, lg] = await Promise.all([
      dq("kairo_routines", { token, filters: "?select=*&order=sort_order.asc,created_at.asc" }),
      dq("kairo_routine_exercises", { token, filters: "?select=*&order=sort_order.asc" }),
      dq("kairo_exercises", { token, filters: "?select=id,name,media_id,muscles_primary,muscles_secondary" }),
      dq("kairo_body_logs", { token, filters: "?select=*&order=log_date.desc,created_at.desc&limit=60" }),
    ]);
    const exs = Array.isArray(ex) ? ex : [];
    const items = (Array.isArray(it) ? it : []).map(i => ({ ...i, exercise: exs.find(e => e.id === i.exercise_id) })).filter(i => i.exercise);
    setRoutines((Array.isArray(r) ? r : []).map(rt => ({ ...rt, items: items.filter(i => i.routine_id === rt.id) })));
    setLogs(Array.isArray(lg) ? lg : []);
    fetch("/api/kairo/social", { headers: { Authorization: `Bearer ${loadSession()?.token || token}` } }).then(r => r.json()).then(r => setSocial(r.users || [])).catch(() => setSocial([]));
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const d = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const plan = routines ? todayPlan(routines, me?.dias) : null;
  const weights = logs.filter(l => l.peso_kg).slice().reverse();
  const todayLog = logs.find(l => l.log_date === today() && l.peso_kg);
  const savePeso = async () => {
    const v = Number(String(peso).replace(",", "."));
    if (!v) return pushToast("Poné tu peso");
    if (todayLog) await dq("kairo_body_logs", { method: "PATCH", token, filters: `?id=eq.${todayLog.id}`, body: { peso_kg: v } });
    else await dq("kairo_body_logs", { method: "POST", token, body: { log_date: today(), peso_kg: v } });
    setPeso(""); pushToast("Peso registrado"); load();
  };

  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <button onClick={() => go("perfil")} aria-label="Tu perfil" style={{ background: "none", border: "none", padding: 0 }}><Avatar src={me?.avatar} size={44} /></button>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{me?.nombre ? `Hola, ${me.nombre.split(" ")[0]}` : "Hola"}</div>
        <div style={{ fontSize: 13, color: C.sub }}>{d[0].toUpperCase() + d.slice(1)}</div>
      </div>
    </div>

    {me && !me.nombre && <button className="k-press" onClick={() => go("perfil")} style={{ ...card, width: "100%", textAlign: "left", color: C.text, marginBottom: 10, borderColor: "rgba(198,244,50,0.3)" }}>
      <div style={{ fontSize: 15, fontWeight: 500 }}>Completá tu perfil</div>
      <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>Tu nombre y tu objetivo: con eso Kairo arma tu plan.</div>
    </button>}

    {/* Entreno de hoy */}
    <SectionTitle>Entreno de hoy</SectionTitle>
    {!plan ? <div style={{ ...card, color: C.sub, fontSize: 14 }}>Cargando…</div>
      : plan.hoy.length ? plan.hoy.map(r => <div key={r.id} style={{ ...card, marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em" }}>{r.name}</div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{r.items.length} ejercicios · {r.items.reduce((a, i) => a + i.sets, 0)} series</div>
          </div>
          <button className="k-press" onClick={() => startWorkout(token, r)} disabled={!r.items.length} style={{ ...btnLime, width: "auto", padding: "11px 20px" }}>Empezar</button>
        </div>
      </div>)
      : <button className="k-press" onClick={() => go("fisico")} style={{ ...card, width: "100%", textAlign: "left", color: C.text }}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>{plan.descanso ? "Hoy descansás" : routines.length ? "Hoy no tenés rutina asignada" : "Armá tu primera rutina"}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{plan.manana ? `Mañana: ${plan.manana}` : routines.length ? "Si querés, entrená cualquiera desde Físico." : "En Físico creás tus rutinas y la IA te marca las cargas."}</div>
      </button>}

    {/* Peso */}
    <SectionTitle right={<button onClick={() => setSheet({ type: "log" })} style={linkBtn}>Medidas</button>}>Peso</SectionTitle>
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

    {/* Amigos */}
    {social && social.length > 1 && <>
      <SectionTitle right={<span style={{ fontSize: 12, color: C.dim }}>{monthName(curMonth())}</span>}>Ranking</SectionTitle>
      <div style={{ ...card, padding: "4px 14px" }}>
        {social.map((u, i) => <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < social.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <span className="k-num" style={{ width: 18, fontSize: 14, color: i === 0 ? C.lime : C.dim, fontWeight: 600 }}>{i + 1}</span>
          <Avatar src={u.avatar} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: u.me ? 600 : 400 }}>{u.nombre}{u.me ? " (vos)" : ""}</div>
            <div style={{ fontSize: 12, color: C.sub }}>{u.racha_semanas ? `Racha de ${u.racha_semanas} sem` : "Sin racha"} · {Math.round(u.minutos_mes / 60)}h este mes</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="k-num" style={{ fontSize: 18, fontWeight: 500 }}>{u.entrenos_mes}</div>
            <div style={{ fontSize: 10.5, color: C.sub }}>entrenos</div>
          </div>
        </div>)}
      </div>
    </>}

    {/* Plata */}
    {fin && (fin.budget != null || fin.spent > 0) && <>
      <SectionTitle>Finanzas · {monthName(curMonth()).toLowerCase()}</SectionTitle>
      <button className="k-press" onClick={() => go("finanzas")} style={{ ...card, width: "100%", textAlign: "left", color: C.text, display: "block" }}>
        <div className="k-num" style={{ fontSize: 26, fontWeight: 500, color: fin.monthLeft >= 0 ? C.pos : C.neg }}>{fin.monthLeft < 0 ? "−" : ""}{ars(Math.abs(fin.monthLeft))}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>saldo del mes{fin.daysLeft > 0 && fin.monthLeft > 0 ? ` · ${ars(fin.monthLeft / fin.daysLeft)} por día` : ""}</div>
        <Bar pct={fin.income > 0 ? fin.spent / fin.income : 1} color={C.blue} mark={fin.dayNow / fin.dim} />
        {fin.uncategorized.length > 0 && <div style={{ fontSize: 13, color: C.lime, marginTop: 12 }}>{fin.uncategorized.length} gasto{fin.uncategorized.length > 1 ? "s" : ""} sin categoría</div>}
      </button>
    </>}

    {sheet?.type === "log" && <LogSheet token={token} last={logs[0]} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
  </>;
}
