"use client";
// Kairo · Nutrición. Tu semana fija de comidas (repetitiva a propósito: escribís lo que comés y la IA
// calcula macros), el día de hoy para ir tildando y ver cuánto falta, el análisis de la semana con IA,
// y los suplementos con horarios y recordatorios (la proteína en polvo va como comida).
import { useState, useEffect, useCallback, useMemo } from "react";
import { dq, loadSession } from "../../lib/sb-client";
import { C, I, Icon, pushToast, Sheet, SectionTitle, Label, MiniStat, card, field, btnLime, btnGhost, linkBtn, today, ymd, dayLabel } from "./ui";
import { ensurePush } from "./fisico";
import { adjustTarget, plannedBurn, cardioOn, sportName } from "./score";

const MEALS = [["desayuno", "Desayuno"], ["almuerzo", "Almuerzo"], ["merienda", "Merienda"], ["cena", "Cena"], ["snacks", "Snacks"]];
const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const dowOf = (d) => (new Date(d + "T12:00:00").getDay() + 6) % 7;
const r0 = (n) => Math.round(Number(n) || 0);
const sum = (list) => list.reduce((a, x) => ({ kcal: a.kcal + Number(x.kcal || 0), p: a.p + Number(x.protein_g || 0), c: a.c + Number(x.carbs_g || 0), g: a.g + Number(x.fat_g || 0) }), { kcal: 0, p: 0, c: 0, g: 0 });
const n1 = (v) => Number(v).toLocaleString("es-AR", { maximumFractionDigits: 2 });
// "2,5 g" por toma y "7,5 g por día" si se toma más de una vez (la dosis que cargás es por toma).
const unitOf = (n, u) => n === 1 && /^(cápsulas|comprimidos|gotas)$/.test(u || "") ? u.slice(0, -1) : u || "";
const perToma = (s) => s.amount ? `${n1(s.amount)} ${unitOf(Number(s.amount), s.unit)}`.trim() : s.dose || "";
const perDia = (s) => { const k = s.times?.length || 1; return s.amount && k > 1 ? `${n1(s.amount * k)} ${s.unit || ""} por día`.trim() : ""; };
const auth = (token) => ({ Authorization: `Bearer ${loadSession()?.token || token}` });

function useNutri(token) {
  const [plan, setPlan] = useState([]);
  const [supps, setSupps] = useState([]);
  const [profile, setProfile] = useState(null);
  const [lo, setLo] = useState(true);
  const load = useCallback(async () => {
    const [p, s, pr] = await Promise.all([
      dq("kairo_meal_plan", { token, filters: "?select=*&order=dow.asc,sort_order.asc,created_at.asc" }),
      dq("kairo_supplements", { token, filters: "?select=*&order=sort_order.asc,created_at.asc" }),
      dq("kairo_profile", { token, filters: "?select=estrategia,reglas_nutricion,cardio_plan,peso_kg&limit=1" }),
    ]);
    setPlan(Array.isArray(p) ? p : []); setSupps(Array.isArray(s) ? s : []); setProfile(Array.isArray(pr) ? pr[0] || null : null); setLo(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const st = profile?.estrategia;
  const target = st ? { kcal: st.calorias_dia, p: st.proteina_g, c: st.carbohidratos_g, g: st.grasas_g } : null;
  // Objetivo de un día de la semana con el deporte planeado sumado (para armar la dieta por adelantado).
  const targetOn = (dow) => { if (!st) return null; const b = plannedBurn(profile?.cardio_plan, dow, profile?.peso_kg); const a = adjustTarget(st, b); return { kcal: a.calorias_dia, p: a.proteina_g, c: a.carbohidratos_g, g: a.grasas_g, extra: b, sports: cardioOn(profile?.cardio_plan, dow).map(x => sportName(x.kind)) }; };
  return { plan, supps, target, targetOn, lo, load };
}

export default function Nutricion({ token, onProfile }) {
  const n = useNutri(token);
  const [view, setView] = useState("hoy");
  return <>
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 999, padding: 3 }}>
        {[["hoy", "Hoy"], ["semana", "Plan semanal"], ["supps", "Suplementos"]].map(([id, label]) => <button key={id} onClick={() => setView(id)} className="k-press" style={{ border: "none", borderRadius: 999, padding: "7px 14px", fontSize: 14, fontWeight: 500, background: view === id ? C.cardHi : "transparent", color: view === id ? C.text : C.sub }}>{label}</button>)}
      </div>
    </div>
    {n.lo ? <p style={{ color: C.sub, textAlign: "center", padding: "60px 0" }}>Cargando…</p> : <>
      {!n.target && view !== "supps" && <button className="k-press" onClick={onProfile} style={{ ...card, width: "100%", textAlign: "left", color: C.text, marginTop: 18, display: "flex", gap: 12, alignItems: "center", borderColor: "rgba(198,244,50,0.3)" }}>
        <Icon d={I.spark} size={20} color={C.lime} />
        <span style={{ flex: 1 }}><span style={{ fontSize: 15, fontWeight: 500, display: "block" }}>Calculá tus calorías y macros</span><span style={{ fontSize: 13, color: C.sub }}>En Perfil → Tu estrategia de alimentación. Con eso Kairo te dice cuánto te falta cada día.</span></span>
        <Icon d={I.right} size={16} color={C.sub} />
      </button>}
      {view === "hoy" && <Today token={token} n={n} />}
      {view === "semana" && <Week token={token} n={n} onSupps={() => setView("supps")} />}
      {view === "supps" && <Supps token={token} n={n} />}
    </>}
  </>;
}

// ─────── Hoy ───────
function Today({ token, n }) {
  const [date, setDate] = useState(today());
  const [log, setLog] = useState([]);
  const [suppLog, setSuppLog] = useState([]);
  const [burned, setBurned] = useState(0);
  const [adding, setAdding] = useState(null);
  const load = useCallback(async () => {
    const [l, s, c] = await Promise.all([
      dq("kairo_food_log", { token, filters: `?log_date=eq.${date}&select=*&order=created_at.asc` }),
      dq("kairo_supp_log", { token, filters: `?log_date=eq.${date}&select=*` }),
      dq("kairo_cardio", { token, filters: `?log_date=eq.${date}&select=kcal` }),
    ]);
    setLog(Array.isArray(l) ? l : []); setSuppLog(Array.isArray(s) ? s : []); setBurned((Array.isArray(c) ? c : []).reduce((a, x) => a + Number(x.kcal || 0), 0));
  }, [token, date]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { window.addEventListener("kairo-cardio", load); return () => window.removeEventListener("kairo-cardio", load); }, [load]);
  const dow = dowOf(date);
  const planToday = n.plan.filter(p => p.dow === dow);
  // Lo que quemaste haciendo deporte ese día se suma al objetivo (carbos y grasas; la proteína no cambia).
  const planned = date === today() ? (n.targetOn(dow)?.extra || 0) : 0, extra = burned || planned;
  const eaten = sum(log), st = adjustTarget(n.target && { calorias_dia: n.target.kcal, proteina_g: n.target.p, carbohidratos_g: n.target.c, grasas_g: n.target.g }, extra);
  const t = st ? { kcal: st.calorias_dia, p: st.proteina_g, c: st.carbohidratos_g, g: st.grasas_g } : null;
  const shift = (d) => { const x = new Date(date + "T12:00:00"); x.setDate(x.getDate() + d); const s = ymd(x); if (s <= today()) setDate(s); };

  const togglePlan = async (item) => {
    const row = log.find(l => l.plan_item_id === item.id);
    if (row) { setLog(log.filter(l => l.id !== row.id)); await dq("kairo_food_log", { method: "DELETE", token, filters: `?id=eq.${row.id}` }); }
    else {
      const body = { log_date: date, meal: item.meal, name: item.name, qty: item.qty, kcal: item.kcal, protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g, plan_item_id: item.id };
      setLog([...log, { ...body, id: "tmp" + item.id }]);
      await dq("kairo_food_log", { method: "POST", token, body });
    }
    load();
  };
  const removeExtra = async (row) => { setLog(log.filter(l => l.id !== row.id)); await dq("kairo_food_log", { method: "DELETE", token, filters: `?id=eq.${row.id}` }); };
  const daySupps = n.supps.filter(s => s.active && s.days?.includes(dow));
  const toggleSupp = async (s, slot) => {
    const row = suppLog.find(x => x.supplement_id === s.id && x.slot === slot);
    if (row) await dq("kairo_supp_log", { method: "DELETE", token, filters: `?id=eq.${row.id}` });
    else await dq("kairo_supp_log", { method: "POST", token, body: { supplement_id: s.id, log_date: date, slot } });
    load();
  };

  return <>
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, marginTop: 14 }}>
      <button onClick={() => shift(-1)} aria-label="Día anterior" className="k-press" style={arrow}><Icon d={I.left} size={16} /></button>
      <span style={{ fontSize: 15, fontWeight: 500, minWidth: 130, textAlign: "center" }}>{date === today() ? "Hoy" : dayLabel(date) === "ayer" ? "Ayer" : DAYS_FULL[dow] + " " + date.slice(8) + "/" + date.slice(5, 7)}</span>
      <button onClick={() => shift(1)} aria-label="Día siguiente" className="k-press" style={{ ...arrow, opacity: date === today() ? 0.3 : 1 }}><Icon d={I.right} size={16} /></button>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 16 }}>
      <Ring value={eaten.kcal} max={t?.kcal || 0} />
      <div style={{ flex: 1, display: "grid", gap: 10 }}>
        <MacroBar label="Proteína" v={eaten.p} max={t?.p} color={C.lime} />
        <MacroBar label="Carbohidratos" v={eaten.c} max={t?.c} color={C.blue} />
        <MacroBar label="Grasas" v={eaten.g} max={t?.g} color={C.warn} />
      </div>
    </div>
    {extra > 0 && <div style={{ fontSize: 12.5, color: C.sub, textAlign: "center", marginTop: 10 }}>Incluye <span style={{ color: C.blue }}>+{extra.toLocaleString("es-AR")} kcal</span> por el deporte de {date === today() ? "hoy" : "ese día"}{!burned ? " (estimado hasta que lo registres)" : ""}</div>}

    {daySupps.length > 0 && <SuppDay supps={daySupps} isTaken={(s, slot) => suppLog.some(x => x.supplement_id === s.id && x.slot === slot)} onToggle={toggleSupp} />}

    {MEALS.map(([m, label]) => {
      const items = planToday.filter(p => p.meal === m), extras = log.filter(l => l.meal === m && !l.plan_item_id);
      const tot = sum(log.filter(l => l.meal === m));
      return <div key={m}>
        <SectionTitle right={<button onClick={() => setAdding(m)} style={linkBtn}>+ Agregar</button>}>{label}{tot.kcal ? ` · ${r0(tot.kcal)} kcal` : ""}</SectionTitle>
        {!items.length && !extras.length ? <div style={{ fontSize: 13, color: C.dim, padding: "0 2px" }}>Nada {date === today() ? "todavía" : ""}</div> :
          <div style={{ ...card, padding: "2px 14px" }}>
            {items.map((it, i) => { const on = log.some(l => l.plan_item_id === it.id); return <button key={it.id} onClick={() => togglePlan(it)} style={{ ...rowBtn, borderBottom: i < items.length + extras.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
              <span style={{ width: 24, height: 24, borderRadius: 12, flexShrink: 0, border: `1.5px solid ${on ? C.pos : C.dim}`, background: on ? C.pos : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#05210F" }}>{on && <Icon d={I.check} size={14} sw={3} />}</span>
              <FoodText it={it} dim={!on} />
            </button>; })}
            {extras.map((it, i) => <div key={it.id} style={{ ...rowBtn, borderBottom: items.length + i < items.length + extras.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
              <span style={{ width: 24, height: 24, borderRadius: 12, flexShrink: 0, background: C.pos, display: "flex", alignItems: "center", justifyContent: "center", color: "#05210F" }}><Icon d={I.plus} size={13} sw={3} /></span>
              <FoodText it={it} />
              <button onClick={() => removeExtra(it)} aria-label="Quitar" style={{ ...linkBtn, color: C.dim, fontSize: 18, padding: "0 4px" }}>×</button>
            </div>)}
          </div>}
      </div>;
    })}
    {!planToday.length && <div style={{ ...card, marginTop: 18, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>No tenés comidas fijas para {DAYS_FULL[dow].toLowerCase()}. Armalas en "Plan semanal" y acá solo las vas tildando.</div>}
    {adding && <AddFood token={token} title={`Agregar a ${MEALS.find(x => x[0] === adding)[1].toLowerCase()}`} onClose={() => setAdding(null)} onAdd={async (items, alsoPlan) => {
      await dq("kairo_food_log", { method: "POST", token, body: items.map(it => ({ ...it, log_date: date, meal: adding })) });
      if (alsoPlan) await dq("kairo_meal_plan", { method: "POST", token, body: items.map((it, k) => ({ ...it, dow, meal: adding, sort_order: 100 + k })) });
      setAdding(null); load(); if (alsoPlan) n.load(); pushToast("Agregado");
    }} planOption={`Sumarlo también a mi ${DAYS_FULL[dow].toLowerCase()} fijo`} />}
  </>;
}
// Suplementos del día, una fila por toma y en orden de horario (son parte de la dieta: se toman igual aunque la comida se corra).
function SuppDay({ supps, isTaken, onToggle }) {
  const rows = supps.flatMap(s => (s.times?.length ? s.times : [""]).map(slot => ({ s, slot }))).sort((a, b) => (a.slot || "99").localeCompare(b.slot || "99"));
  const done = isTaken ? rows.filter(r => isTaken(r.s, r.slot)).length : 0;
  const now = new Date().toTimeString().slice(0, 5);
  return <>
    <SectionTitle right={isTaken ? <span className="k-num" style={{ fontSize: 13, color: done === rows.length ? C.pos : C.sub }}>{done}/{rows.length}</span> : <span className="k-num" style={{ fontSize: 13, color: C.sub }}>{rows.length} toma{rows.length > 1 ? "s" : ""}</span>}>Suplementos</SectionTitle>
    <div style={{ ...card, padding: "2px 14px" }}>
      {rows.map(({ s, slot }, i) => {
        const on = !!isTaken?.(s, slot), late = !on && slot && slot < now && onToggle;
        return <button key={s.id + slot} onClick={() => onToggle?.(s, slot)} disabled={!onToggle} style={{ ...rowBtn, borderBottom: i < rows.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          {onToggle && <span style={{ width: 24, height: 24, borderRadius: 12, flexShrink: 0, border: `1.5px solid ${on ? C.pos : late ? C.warn : C.dim}`, background: on ? C.pos : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#05210F" }}>{on && <Icon d={I.check} size={14} sw={3} />}</span>}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 15, color: !onToggle || on ? C.text : C.sub }}>{s.name}</span>
              <span className="k-num" style={{ fontSize: 14, color: late ? C.warn : C.sub, whiteSpace: "nowrap" }}>{slot || "sin hora"}</span>
            </span>
            {(perToma(s) || perDia(s)) && <span className="k-num" style={{ fontSize: 12, color: C.dim }}>{perToma(s)}{perDia(s) ? ` · ${perDia(s)}` : ""}</span>}
          </span>
        </button>;
      })}
    </div>
  </>;
}

const arrow = { width: 34, height: 34, borderRadius: 17, border: "none", background: "transparent", color: C.sub, display: "flex", alignItems: "center", justifyContent: "center" };
const rowBtn = { width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "11px 0" };

function FoodText({ it, dim }) {
  return <span style={{ flex: 1, minWidth: 0 }}>
    <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 15, color: dim ? C.sub : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
      <span className="k-num" style={{ fontSize: 14, color: dim ? C.dim : C.text, whiteSpace: "nowrap" }}>{r0(it.kcal)} kcal</span>
    </span>
    <span className="k-num" style={{ fontSize: 12, color: C.dim }}>{it.qty ? `${it.qty} · ` : ""}P {r0(it.protein_g)} · C {r0(it.carbs_g)} · G {r0(it.fat_g)}</span>
  </span>;
}

function Ring({ value, max }) {
  const R = 52, L = 2 * Math.PI * R, pct = max ? Math.min(1, value / max) : 0, over = max && value > max;
  return <div style={{ position: "relative", width: 132, height: 132, flexShrink: 0 }}>
    <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
      <circle cx="66" cy="66" r={R} fill="none" stroke={C.line} strokeWidth="10" />
      <circle cx="66" cy="66" r={R} fill="none" stroke={over ? C.warn : C.lime} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${L * pct} ${L}`} transform="rotate(-90 66 66)" style={{ transition: "stroke-dasharray 500ms cubic-bezier(.2,.9,.3,1)" }} />
    </svg>
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <span className="k-num" style={{ fontSize: 24, fontWeight: 500 }}>{max ? r0(Math.abs(max - value)).toLocaleString("es-AR") : r0(value).toLocaleString("es-AR")}</span>
      <span style={{ fontSize: 11.5, color: over ? C.warn : C.sub }}>{!max ? "kcal comidas" : over ? "kcal de más" : "kcal te quedan"}</span>
      {max ? <span className="k-num" style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{r0(value).toLocaleString("es-AR")} / {r0(max).toLocaleString("es-AR")}</span> : null}
    </div>
  </div>;
}

function MacroBar({ label, v, max, color }) {
  const over = max && v > max * 1.05;
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
      <span style={{ color: C.sub }}>{label}</span>
      <span className="k-num" style={{ color: over ? C.warn : C.text }}>{r0(v)}{max ? <span style={{ color: C.dim }}> / {r0(max)} g</span> : " g"}</span>
    </div>
    <div style={{ height: 5, background: C.line, borderRadius: 3, marginTop: 5 }}><div style={{ width: `${max ? Math.min(100, (v / max) * 100) : 0}%`, height: 5, background: over ? C.warn : color, borderRadius: 3, transition: "width 500ms cubic-bezier(.2,.9,.3,1)" }} /></div>
  </div>;
}

// ─────── Agregar comida: escribís lo que comés y la IA lo separa con macros ───────
function AddFood({ token, title, onClose, onAdd, planOption }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [alsoPlan, setAlsoPlan] = useState(false);
  const parse = async () => {
    if (!text.trim()) return pushToast("Escribí qué comiste");
    setBusy(true);
    const r = await fetch("/api/kairo/food", { method: "POST", headers: { "Content-Type": "application/json", ...auth(token) }, body: JSON.stringify({ text }) }).then(r => r.json()).catch(() => ({ error: "Sin conexión" }));
    setBusy(false);
    if (r.error) return pushToast(r.error);
    setItems(r.items || []);
  };
  const tot = items ? sum(items) : null;
  return <Sheet title={title} onClose={onClose}>
    {!items ? <>
      <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Ej: 200 g de pollo con 150 g de arroz y una ensalada de tomate" style={{ ...field, resize: "none", lineHeight: 1.45 }} />
      <div style={{ fontSize: 12, color: C.dim, marginTop: 8, lineHeight: 1.45 }}>Escribilo como lo dirías. Si ponés gramos es más preciso; si no, se estima una porción normal.</div>
      <button className="k-press" onClick={parse} disabled={busy} style={{ ...btnLime, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon d={I.spark} size={17} />{busy ? "Calculando…" : "Calcular"}</button>
    </> : <>
      <div style={{ ...card, padding: "2px 14px", background: C.cardHi }}>
        {items.map((it, i) => <div key={i} style={{ ...rowBtn, borderBottom: i < items.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <FoodText it={it} />
          <button onClick={() => setItems(items.filter((_, k) => k !== i))} aria-label="Quitar" style={{ ...linkBtn, color: C.dim, fontSize: 18, padding: "0 4px" }}>×</button>
        </div>)}
      </div>
      {tot && <div className="k-num" style={{ fontSize: 13, color: C.sub, margin: "10px 2px 0" }}>Total: <span style={{ color: C.text }}>{r0(tot.kcal)} kcal</span> · P {r0(tot.p)} · C {r0(tot.c)} · G {r0(tot.g)}</div>}
      {planOption && <button onClick={() => setAlsoPlan(!alsoPlan)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", color: C.text, padding: "16px 2px 0", fontSize: 14, textAlign: "left" }}>
        <span style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${alsoPlan ? C.lime : C.dim}`, background: alsoPlan ? C.lime : "transparent", color: C.limeInk, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{alsoPlan && <Icon d={I.check} size={14} sw={2.6} />}</span>{planOption}
      </button>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginTop: 18 }}>
        <button className="k-press" onClick={() => setItems(null)} style={btnGhost}>Editar</button>
        <button className="k-press" onClick={() => items.length && onAdd(items, alsoPlan)} style={btnLime}>Agregar</button>
      </div>
    </>}
  </Sheet>;
}

// ─────── Plan semanal: lo que comés cada día, fijo, con los suplementos ───────
function Week({ token, n, onSupps }) {
  const [dow, setDow] = useState(() => dowOf(today()));
  const [adding, setAdding] = useState(null);
  const [copying, setCopying] = useState(false);
  const [review, setReview] = useState(false);
  const items = n.plan.filter(p => p.dow === dow);
  const tot = sum(items), t = n.targetOn(dow);
  const del = async (it) => { await dq("kairo_meal_plan", { method: "DELETE", token, filters: `?id=eq.${it.id}` }); n.load(); };
  const totals = DAYS.map((_, i) => sum(n.plan.filter(p => p.dow === i)).kcal);

  return <>
    <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
      {DAYS.map((d, i) => { const on = dow === i, k = totals[i], ti = n.targetOn(i), off = ti && k && Math.abs(k - ti.kcal) > ti.kcal * 0.1; return <button key={i} onClick={() => setDow(i)} className="k-press" style={{ flex: 1, padding: "8px 0 6px", borderRadius: 12, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.card, color: on ? C.limeInk : C.text, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{d}</span>
        <span className="k-num" style={{ fontSize: 9.5, color: on ? C.limeInk : off ? C.warn : C.dim }}>{k ? Math.round(k / 100) / 10 + "k" : "—"}</span>
      </button>; })}
    </div>

    <div style={{ ...card, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{DAYS_FULL[dow]}</span>
        <span className="k-num" style={{ fontSize: 15 }}>{r0(tot.kcal).toLocaleString("es-AR")}{t ? <span style={{ color: C.sub }}> / {r0(t.kcal).toLocaleString("es-AR")}</span> : ""} kcal</span>
      </div>
      <div className="k-num" style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>P {r0(tot.p)}{t ? `/${r0(t.p)}` : ""} · C {r0(tot.c)}{t?.c ? `/${r0(t.c)}` : ""} · G {r0(tot.g)}{t?.g ? `/${r0(t.g)}` : ""} g</div>
      {t?.extra > 0 && <div style={{ fontSize: 12, color: C.blue, marginTop: 4 }}>Día con {t.sports.join(" y ")}: el objetivo sube {t.extra.toLocaleString("es-AR")} kcal</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <button className="k-press" onClick={() => setCopying(true)} disabled={!items.length} style={{ ...btnGhost, padding: "10px 8px", fontSize: 13.5, whiteSpace: "nowrap", opacity: items.length ? 1 : 0.5 }}>Copiar a otros días</button>
        <button className="k-press" onClick={() => setReview(true)} disabled={!n.plan.length} style={{ ...btnGhost, padding: "10px 8px", fontSize: 13.5, whiteSpace: "nowrap", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: n.plan.length ? 1 : 0.5 }}><Icon d={I.spark} size={15} color={C.lime} />Analizar con IA</button>
      </div>
    </div>

    {MEALS.map(([m, label]) => {
      const list = items.filter(p => p.meal === m), mt = sum(list);
      return <div key={m}>
        <SectionTitle right={<button onClick={() => setAdding(m)} style={linkBtn}>+ Agregar</button>}>{label}{mt.kcal ? ` · ${r0(mt.kcal)} kcal` : ""}</SectionTitle>
        {!list.length ? <div style={{ fontSize: 13, color: C.dim, padding: "0 2px" }}>Sin cargar</div> :
          <div style={{ ...card, padding: "2px 14px" }}>
            {list.map((it, i) => <div key={it.id} style={{ ...rowBtn, borderBottom: i < list.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
              <FoodText it={it} />
              <button onClick={() => del(it)} aria-label="Quitar" style={{ ...linkBtn, color: C.dim, fontSize: 18, padding: "0 4px" }}>×</button>
            </div>)}
          </div>}
      </div>;
    })}

    {(() => { const ds = n.supps.filter(s => s.active && s.days?.includes(dow)); return ds.length ? <SuppDay supps={ds} /> : <>
      <SectionTitle right={<button onClick={onSupps} style={linkBtn}>+ Agregar</button>}>Suplementos</SectionTitle>
      <div style={{ fontSize: 13, color: C.dim, padding: "0 2px" }}>Ninguno este día</div>
    </>; })()}

    {adding && <AddFood token={token} title={`${DAYS_FULL[dow]} · ${MEALS.find(x => x[0] === adding)[1].toLowerCase()}`} onClose={() => setAdding(null)} onAdd={async (list) => {
      await dq("kairo_meal_plan", { method: "POST", token, body: list.map((it, k) => ({ ...it, dow, meal: adding, sort_order: items.length + k })) });
      setAdding(null); n.load(); pushToast("Agregado a tu semana");
    }} />}
    {copying && <CopyDay token={token} from={dow} items={items} plan={n.plan} onClose={() => setCopying(false)} onDone={() => { setCopying(false); n.load(); }} />}
    {review && <NutritionReview token={token} plan={n.plan} onApplied={n.load} onClose={() => setReview(false)} />}
  </>;
}

function CopyDay({ token, from, items, plan, onClose, onDone }) {
  const [to, setTo] = useState([]);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!to.length) return pushToast("Elegí los días");
    setBusy(true);
    const ids = plan.filter(p => to.includes(p.dow)).map(p => p.id);
    if (ids.length) await dq("kairo_meal_plan", { method: "DELETE", token, filters: `?id=in.(${ids.join(",")})` });
    await dq("kairo_meal_plan", { method: "POST", token, body: to.flatMap(d => items.map(({ id, user_id, created_at, ...it }) => ({ ...it, dow: d }))) });
    setBusy(false); pushToast(`Copiado a ${to.length} día${to.length > 1 ? "s" : ""}`); onDone();
  };
  return <Sheet title={`Copiar el ${DAYS_FULL[from].toLowerCase()}`} onClose={onClose}>
    <p style={{ fontSize: 13.5, color: C.sub, margin: "-4px 0 14px", lineHeight: 1.45 }}>Reemplaza lo que tengan cargado los días que elijas.</p>
    <div style={{ display: "flex", gap: 6 }}>
      {DAYS.map((d, i) => { const on = to.includes(i), self = i === from; return <button key={i} disabled={self} onClick={() => setTo(on ? to.filter(x => x !== i) : [...to, i])} className="k-press" style={{ flex: 1, height: 42, borderRadius: 12, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.cardHi, color: on ? C.limeInk : C.text, fontWeight: on ? 600 : 400, opacity: self ? 0.3 : 1 }}>{d}</button>; })}
    </div>
    <button onClick={() => setTo([0, 1, 2, 3, 4, 5, 6].filter(i => i !== from))} style={{ ...linkBtn, marginTop: 12 }}>Todos los días</button>
    <button className="k-press" onClick={go} disabled={busy} style={{ ...btnLime, marginTop: 18 }}>{busy ? "Copiando…" : "Copiar"}</button>
  </Sheet>;
}

const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const sameFood = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a === b || a.includes(b) || b.includes(a)); };
const parseFood = async (token, text) => {
  const r = await fetch("/api/kairo/food", { method: "POST", headers: { "Content-Type": "application/json", ...auth(token) }, body: JSON.stringify({ text }) }).then(r => r.json()).catch(() => ({ error: "Sin conexión" }));
  if (r.error || !r.items?.length) throw new Error(r.error || "No pude calcular el alimento nuevo");
  return r.items;
};
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const diasText = (d) => !d?.length || d.length === 7 ? "Todos los días" : d.length === 5 && d.every(x => x < 5) ? "Lunes a viernes" : d.map(x => DAYS_FULL[x]).join(", ");

// Aplica una acción del análisis sobre el plan semanal: cambia, suma o saca un alimento en los días que dice.
async function applyAction(token, plan, a) {
  const dias = a.dias?.length ? a.dias : ALL_DAYS;
  let olds = [];
  if (a.tipo !== "agregar") {
    olds = plan.filter(p => dias.includes(p.dow) && sameFood(p.name, a.alimento_actual));
    const inMeal = olds.filter(p => p.meal === a.comida);
    if (inMeal.length) olds = inMeal;
    if (!olds.length) throw new Error(`No encontré "${a.alimento_actual}" en tu plan`);
  }
  const items = a.tipo === "sacar" ? [] : await parseFood(token, a.nuevo);
  if (olds.length) await dq("kairo_meal_plan", { method: "DELETE", token, filters: `?id=in.(${olds.map(o => o.id).join(",")})` });
  if (!items.length) return;
  // Va en el mismo lugar que el que reemplaza (una vez por día y comida), o al final de la comida si es nuevo.
  const slots = a.tipo === "cambiar"
    ? [...new Map(olds.map(o => [o.dow + o.meal, { dow: o.dow, meal: o.meal, sort_order: o.sort_order ?? 0 }])).values()]
    : dias.map(d => ({ dow: d, meal: a.comida, sort_order: 100 }));
  await dq("kairo_meal_plan", { method: "POST", token, body: slots.flatMap(sl => items.map((it, k) => ({ ...it, dow: sl.dow, meal: sl.meal, sort_order: sl.sort_order + k }))) });
}

function NutritionReview({ token, plan, onApplied, onClose }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null);
  const run = useCallback(async () => {
    setR(null); setErr("");
    const res = await fetch("/api/kairo/coach", { method: "POST", headers: { "Content-Type": "application/json", ...auth(token) }, body: JSON.stringify({ action: "nutrition" }) }).then(r => r.json()).catch(() => ({ error: "Sin conexión" }));
    if (res.nutrition) setR({ c: res.nutrition, id: res.id, at: new Date().toISOString() }); else setErr(res.error || "No se pudo analizar");
  }, [token]);
  useEffect(() => {
    dq("kairo_ai", { token, filters: "?kind=eq.nutrition&select=id,content,created_at&order=created_at.desc&limit=1" }).then(last => { if (Array.isArray(last) && last[0]) setR({ c: last[0].content, id: last[0].id, at: last[0].created_at }); else run(); });
  }, [token, run]);
  const apply = async (a) => {
    setBusy(a.id);
    try {
      await applyAction(token, plan, a);
      const c = { ...r.c, aplicadas: [...(r.c.aplicadas || []), a.id] };
      setR({ ...r, c });
      if (r.id) await dq("kairo_ai", { method: "PATCH", token, filters: `?id=eq.${r.id}`, body: { content: c } });
      onApplied(); pushToast("Listo, cambiado en tu plan");
    } catch (e) { pushToast(e.message || "No se pudo aplicar"); }
    setBusy(null);
  };
  const EST = { bien: ["Bien", C.pos], faltan: ["Faltan", C.warn], sobran: ["Sobran", C.warn], sin_cargar: ["Sin cargar", C.dim] };
  const TIPO = { cambiar: "Cambiar", agregar: "Sumar", sacar: "Sacar" };
  const x = r?.c;
  return <Sheet title="Análisis de tu semana" onClose={onClose}>
    {err ? <p style={{ color: C.danger, fontSize: 14 }}>{err}</p> : !x ? <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.5 }}>Revisando tu semana contra tu objetivo y tus suplementos…</p> : <>
      <p style={{ fontSize: 15, lineHeight: 1.5, margin: 0 }}>{x.resumen}</p>
      {x.acciones?.length > 0 && <><Label>Plan de acción</Label>
        <div style={{ fontSize: 12.5, color: C.sub, margin: "-4px 2px 10px", lineHeight: 1.45 }}>Aplicás solo los que quieras: se cambian en tu plan semanal.</div>
        {x.acciones.map(a => { const done = x.aplicadas?.includes(a.id); return <div key={a.id} style={{ background: C.cardHi, borderRadius: 14, padding: 12, marginBottom: 8, opacity: done ? 0.6 : 1 }}>
          <div style={{ fontSize: 12, color: C.sub }}>{TIPO[a.tipo]} · {MEALS.find(m => m[0] === a.comida)?.[1] || a.comida} · {diasText(a.dias)}</div>
          <div style={{ fontSize: 15, marginTop: 4, lineHeight: 1.4 }}>
            {a.tipo === "cambiar" ? <><span style={{ color: C.sub, textDecoration: "line-through" }}>{a.alimento_actual}</span> → <span style={{ fontWeight: 500 }}>{a.nuevo}</span></>
              : a.tipo === "agregar" ? <span style={{ fontWeight: 500 }}>+ {a.nuevo}</span> : <span style={{ fontWeight: 500 }}>Sacar {a.alimento_actual}</span>}
          </div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 4, lineHeight: 1.45 }}>{a.motivo}</div>
          {done ? <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.pos, fontSize: 13.5, marginTop: 10 }}><Icon d={I.check} size={15} sw={2.6} />Aplicado</div>
            : <button className="k-press" onClick={() => apply(a)} disabled={!!busy} style={{ ...btnLime, padding: "10px 14px", fontSize: 14, marginTop: 10, opacity: busy && busy !== a.id ? 0.5 : 1 }}>{busy === a.id ? "Aplicando…" : "Aplicar"}</button>}
        </div>; })}
      </>}
      <Label>Día por día</Label>
      <div style={{ background: C.cardHi, borderRadius: 14, padding: "0 14px" }}>
        {x.dias.map((d, i) => <div key={i} style={{ padding: "10px 0", borderBottom: i < x.dias.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>{d.dia}</span><span style={{ color: EST[d.estado]?.[1], fontWeight: 600, fontSize: 13 }}>{EST[d.estado]?.[0]}</span></div>
          {d.nota && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3, lineHeight: 1.4 }}>{d.nota}</div>}
        </div>)}
      </div>
      {x.faltantes?.length > 0 && <><Label>Nutrientes a cuidar</Label>
        {x.faltantes.map((f, i) => <div key={i} style={{ background: C.cardHi, borderRadius: 14, padding: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 15, fontWeight: 500 }}>{f.nutriente}</span>{f.cubierto_por ? <span style={{ fontSize: 12, color: C.pos }}>Cubierto: {f.cubierto_por}</span> : <span style={{ fontSize: 12, color: C.warn }}>Sin cubrir</span>}</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 4, lineHeight: 1.45 }}>{f.detalle}</div>
        </div>)}
      </>}
      {x.sugerencias?.length > 0 && <><Label>{x.acciones ? "Consejos" : "Cambios simples"}</Label>{x.sugerencias.map((t, i) => <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.45, marginBottom: 8 }}><span style={{ width: 5, height: 5, borderRadius: 3, background: C.lime, marginTop: 8, flexShrink: 0 }} /><span>{t}</span></div>)}</>}
      <button className="k-press" onClick={run} style={{ ...btnGhost, marginTop: 16 }}>Volver a analizar</button>
      {r.at && <div style={{ fontSize: 12, color: C.dim, textAlign: "center", marginTop: 8 }}>{(l => /^(hoy|ayer)$/.test(l) ? `Análisis de ${l}` : `Análisis del ${l}`)(dayLabel(ymd(new Date(r.at))))}</div>}
    </>}
  </Sheet>;
}

// ─────── Suplementos ───────
function Supps({ token, n }) {
  const [edit, setEdit] = useState(null);
  return <>
    <button className="k-press" onClick={() => setEdit({})} style={{ ...btnLime, marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon d={I.plus} size={18} sw={2.2} />Suplemento</button>
    {n.supps.length > 0 && <div style={{ ...card, padding: "2px 14px", marginTop: 14 }}>
      {n.supps.map((s, i) => <button key={s.id} onClick={() => setEdit(s)} style={{ ...rowBtn, borderBottom: i < n.supps.length - 1 ? `0.5px solid ${C.line}` : "none", opacity: s.active ? 1 : 0.5 }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, display: "block" }}>{s.name}{perToma(s) ? <span style={{ color: C.sub }}> · {perToma(s)}{s.times?.length > 1 ? " por toma" : ""}</span> : null}</span>
          <span style={{ fontSize: 12, color: C.sub }}>{s.times?.length ? s.times.join(" · ") : "Sin horario"}{perDia(s) ? ` · ${perDia(s)}` : ""} · {s.days?.length === 7 ? "todos los días" : s.days?.map(d => DAYS[d]).join(" ")}{!s.active ? " · pausado" : ""}</span>
        </span>
        <Icon d={I.right} size={16} color={C.dim} />
      </button>)}
    </div>}
    {edit && <SuppSheet token={token} s={edit.id ? edit : null} count={n.supps.length} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); n.load(); }} />}
  </>;
}

// Suplementos comunes con su unidad y dosis por toma habitual (el "Otro" deja escribir cualquiera).
const COMMON = [
  ["Creatina", "g", 5], ["Magnesio", "mg", 300], ["Omega 3", "cápsulas", 1], ["Vitamina D3", "UI", 2000], ["Multivitamínico", "comprimidos", 1],
  ["Zinc", "mg", 15], ["ZMA", "cápsulas", 3], ["Pre-entreno", "scoop", 1], ["Cafeína", "mg", 200], ["BCAA", "g", 5], ["EAA", "g", 10],
  ["Glutamina", "g", 5], ["Beta-alanina", "g", 3], ["Citrulina", "g", 6], ["Taurina", "g", 1], ["Electrolitos", "scoop", 1],
  ["L-teanina", "mg", 200], ["Ashwagandha", "mg", 600], ["Melatonina", "mg", 3], ["Colágeno", "g", 10], ["Vitamina C", "mg", 500],
  ["Vitamina B12", "mcg", 1000], ["Hierro", "mg", 18], ["Calcio", "mg", 500], ["Probióticos", "cápsulas", 1], ["Psyllium", "g", 5],
];
const UNITS = ["g", "mg", "mcg", "UI", "cápsulas", "comprimidos", "scoop", "ml", "gotas"];

function SuppSheet({ token, s, count, onClose, onSaved }) {
  const known = (name) => COMMON.some(c => c[0] === name);
  const [f, setF] = useState(() => ({ pick: !s ? "" : known(s.name) ? s.name : "otro", name: s?.name || "", amount: s?.amount != null ? String(s.amount).replace(".", ",") : "", unit: s?.unit || "g", dose: s?.dose || "", times: s?.times || ["09:00"], days: s?.days || [0, 1, 2, 3, 4, 5, 6], notes: s?.notes || "", active: s?.active ?? true }));
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const pick = (v) => { const c = COMMON.find(x => x[0] === v); setF(c ? { ...f, pick: v, name: v, unit: c[1], amount: f.amount || String(c[2]).replace(".", ",") } : { ...f, pick: v, name: v === "otro" && known(f.name) ? "" : f.name }); };
  const amount = Number(String(f.amount).replace(",", ".")) || null, tomas = new Set(f.times.filter(Boolean)).size;
  // El horario nuevo va unas horas después del último (sin repetir ni pasarse de las 23).
  const nextTime = () => { const last = [...f.times].filter(Boolean).sort().pop(); if (!last) return "09:00"; let h = Math.min(23, Number(last.slice(0, 2)) + 5); while (f.times.includes(`${String(h).padStart(2, "0")}:00`) && h > 0) h--; return `${String(h).padStart(2, "0")}:00`; };
  const save = async () => {
    if (!f.name.trim()) return pushToast("Elegí o escribí el suplemento");
    if (/prote[ií]na|whey/i.test(f.name)) return pushToast("La proteína en polvo cargala como comida, en Plan semanal");
    setSaving(true);
    const dose = amount ? `${n1(amount)} ${unitOf(amount, f.unit)}` : f.dose.trim() || null;
    const body = { name: f.name.trim(), amount, unit: amount ? f.unit : null, dose, times: [...new Set(f.times.filter(Boolean))].sort(), days: [...f.days].sort((a, b) => a - b), notes: f.notes.trim() || null, active: f.active };
    if (s) await dq("kairo_supplements", { method: "PATCH", token, filters: `?id=eq.${s.id}`, body });
    else await dq("kairo_supplements", { method: "POST", token, body: { ...body, sort_order: count } });
    if (body.times.length) ensurePush(token);
    setSaving(false); pushToast("Guardado"); onSaved();
  };
  const del = async () => { await dq("kairo_supplements", { method: "DELETE", token, filters: `?id=eq.${s.id}` }); pushToast("Suplemento eliminado"); onSaved(); };
  return <Sheet title={s ? s.name : "Nuevo suplemento"} onClose={onClose}>
    <Label>Suplemento</Label>
    <div style={{ position: "relative" }}>
      <select value={f.pick} onChange={e => pick(e.target.value)} style={{ ...field, appearance: "none", WebkitAppearance: "none", colorScheme: "dark", color: f.pick ? C.text : C.dim, paddingRight: 40 }}>
        <option value="" disabled>Elegí uno</option>
        {COMMON.map(c => <option key={c[0]} value={c[0]}>{c[0]}</option>)}
        <option value="otro">Otro…</option>
      </select>
      <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}><Icon d={I.down} size={16} color={C.sub} /></span>
    </div>
    {f.pick === "otro" && <input value={f.name} onChange={e => set("name", e.target.value)} placeholder="Nombre del suplemento" style={{ ...field, marginTop: 8 }} />}
    <Label>Cantidad por toma</Label>
    <div style={{ display: "flex", gap: 8 }}>
      <input value={f.amount} onChange={e => set("amount", e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="Ej: 2,5" style={{ ...field, flex: 1 }} />
      <div style={{ position: "relative", width: 140 }}>
        <select value={f.unit} onChange={e => set("unit", e.target.value)} style={{ ...field, appearance: "none", WebkitAppearance: "none", colorScheme: "dark", paddingRight: 34 }}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}><Icon d={I.down} size={15} color={C.sub} /></span>
      </div>
    </div>
    {amount && tomas > 1 ? <div className="k-num" style={{ fontSize: 13, color: C.sub, margin: "8px 2px 0" }}>{n1(amount)} {f.unit} × {tomas} tomas = <span style={{ color: C.lime }}>{n1(amount * tomas)} {f.unit} por día</span></div> : null}
    <Label>Horarios (te llega un recordatorio)</Label>
    <div style={{ display: "grid", gap: 8 }}>
      {f.times.map((t, i) => <div key={i} style={{ display: "flex", gap: 8 }}>
        <input type="time" value={t} onChange={e => set("times", f.times.map((x, k) => k === i ? e.target.value : x))} style={{ ...field, flex: 1, colorScheme: "dark", minHeight: 48 }} />
        <button onClick={() => set("times", f.times.filter((_, k) => k !== i))} aria-label="Quitar horario" className="k-press" style={{ ...btnGhost, width: 48, padding: 0, fontSize: 18 }}>×</button>
      </div>)}
    </div>
    <button onClick={() => set("times", [...f.times, nextTime()])} style={{ ...linkBtn, marginTop: 10, fontSize: 14 }}>+ Otro horario</button>
    <Label>Días</Label>
    <div style={{ display: "flex", gap: 6 }}>
      {DAYS.map((d, i) => { const on = f.days.includes(i); return <button key={i} onClick={() => set("days", on ? f.days.filter(x => x !== i) : [...f.days, i])} className="k-press" style={{ flex: 1, height: 40, borderRadius: 12, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.cardHi, color: on ? C.limeInk : C.text, fontWeight: on ? 600 : 400, fontSize: 14 }}>{d}</button>; })}
    </div>
    <Label>Notas (opcional)</Label>
    <input value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="Ej: con la comida, antes de entrenar" style={field} />
    {s && <button onClick={() => set("active", !f.active)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", color: C.text, padding: "16px 2px 0", fontSize: 14 }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${f.active ? C.lime : C.dim}`, background: f.active ? C.lime : "transparent", color: C.limeInk, display: "flex", alignItems: "center", justifyContent: "center" }}>{f.active && <Icon d={I.check} size={14} sw={2.6} />}</span>Lo estoy tomando
    </button>}
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Guardando…" : "Guardar"}</button>
    {s && (!confirmDel ? <button onClick={() => setConfirmDel(true)} style={{ ...linkBtn, color: C.sub, width: "100%", marginTop: 14 }}>Eliminar</button>
      : <button onClick={del} style={{ ...linkBtn, color: C.danger, width: "100%", marginTop: 14 }}>Tocá de nuevo para eliminarlo</button>)}
  </Sheet>;
}
