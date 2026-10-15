"use client";
// Kairo · Nutrición. Tu semana fija de comidas (repetitiva a propósito: escribís lo que comés y la IA
// calcula macros), el día de hoy para ir tildando y ver cuánto falta, el análisis de la semana con IA,
// y los suplementos con horarios y recordatorios (la proteína en polvo va como comida).
import { useState, useEffect, useCallback, useMemo } from "react";
import { dq, loadSession } from "../../lib/sb-client";
import { C, I, Icon, pushToast, Sheet, SectionTitle, Label, MiniStat, card, field, btnLime, btnGhost, linkBtn, today, ymd, dayLabel } from "./ui";
import { ensurePush } from "./fisico";

const MEALS = [["desayuno", "Desayuno"], ["almuerzo", "Almuerzo"], ["merienda", "Merienda"], ["cena", "Cena"], ["snacks", "Snacks"]];
const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const dowOf = (d) => (new Date(d + "T12:00:00").getDay() + 6) % 7;
const r0 = (n) => Math.round(Number(n) || 0);
const sum = (list) => list.reduce((a, x) => ({ kcal: a.kcal + Number(x.kcal || 0), p: a.p + Number(x.protein_g || 0), c: a.c + Number(x.carbs_g || 0), g: a.g + Number(x.fat_g || 0) }), { kcal: 0, p: 0, c: 0, g: 0 });
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
      dq("kairo_profile", { token, filters: "?select=estrategia,reglas_nutricion&limit=1" }),
    ]);
    setPlan(Array.isArray(p) ? p : []); setSupps(Array.isArray(s) ? s : []); setProfile(Array.isArray(pr) ? pr[0] || null : null); setLo(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const st = profile?.estrategia;
  const target = st ? { kcal: st.calorias_dia, p: st.proteina_g, c: st.carbohidratos_g, g: st.grasas_g } : null;
  return { plan, supps, target, lo, load };
}

export default function Nutricion({ token, onProfile }) {
  const n = useNutri(token);
  const [view, setView] = useState("hoy");
  return <>
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 999, padding: 3 }}>
        {[["hoy", "Hoy"], ["semana", "Mi semana"], ["supps", "Suplementos"]].map(([id, label]) => <button key={id} onClick={() => setView(id)} className="k-press" style={{ border: "none", borderRadius: 999, padding: "7px 14px", fontSize: 14, fontWeight: 500, background: view === id ? C.cardHi : "transparent", color: view === id ? C.text : C.sub }}>{label}</button>)}
      </div>
    </div>
    {n.lo ? <p style={{ color: C.sub, textAlign: "center", padding: "60px 0" }}>Cargando…</p> : <>
      {!n.target && view !== "supps" && <button className="k-press" onClick={onProfile} style={{ ...card, width: "100%", textAlign: "left", color: C.text, marginTop: 18, display: "flex", gap: 12, alignItems: "center", borderColor: "rgba(198,244,50,0.3)" }}>
        <Icon d={I.spark} size={20} color={C.lime} />
        <span style={{ flex: 1 }}><span style={{ fontSize: 15, fontWeight: 500, display: "block" }}>Calculá tus calorías y macros</span><span style={{ fontSize: 13, color: C.sub }}>En Perfil → Tu estrategia de alimentación. Con eso Kairo te dice cuánto te falta cada día.</span></span>
        <Icon d={I.right} size={16} color={C.sub} />
      </button>}
      {view === "hoy" && <Today token={token} n={n} />}
      {view === "semana" && <Week token={token} n={n} />}
      {view === "supps" && <Supps token={token} n={n} />}
    </>}
  </>;
}

// ─────── Hoy ───────
function Today({ token, n }) {
  const [date, setDate] = useState(today());
  const [log, setLog] = useState([]);
  const [suppLog, setSuppLog] = useState([]);
  const [adding, setAdding] = useState(null);
  const load = useCallback(async () => {
    const [l, s] = await Promise.all([
      dq("kairo_food_log", { token, filters: `?log_date=eq.${date}&select=*&order=created_at.asc` }),
      dq("kairo_supp_log", { token, filters: `?log_date=eq.${date}&select=*` }),
    ]);
    setLog(Array.isArray(l) ? l : []); setSuppLog(Array.isArray(s) ? s : []);
  }, [token, date]);
  useEffect(() => { load(); }, [load]);
  const dow = dowOf(date);
  const planToday = n.plan.filter(p => p.dow === dow);
  const eaten = sum(log), t = n.target;
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

    {daySupps.length > 0 && <>
      <SectionTitle>Suplementos</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {daySupps.flatMap(s => (s.times?.length ? s.times : [""]).map(slot => { const on = suppLog.some(x => x.supplement_id === s.id && x.slot === slot); return <button key={s.id + slot} onClick={() => toggleSupp(s, slot)} className="k-press" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 999, fontSize: 13.5, border: `0.5px solid ${on ? C.pos : C.line}`, background: on ? "rgba(74,222,128,0.12)" : C.card, color: on ? C.pos : C.text }}>
          <span style={{ width: 16, height: 16, borderRadius: 8, border: `1.5px solid ${on ? C.pos : C.dim}`, background: on ? C.pos : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#05210F" }}>{on && <Icon d={I.check} size={11} sw={3} />}</span>
          {s.name}{slot ? <span style={{ color: on ? C.pos : C.sub }}>· {slot}</span> : null}
        </button>; }))}
      </div>
    </>}

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
    {!planToday.length && <div style={{ ...card, marginTop: 18, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>No tenés comidas fijas para {DAYS_FULL[dow].toLowerCase()}. Armalas en "Mi semana" y acá solo las vas tildando.</div>}
    {adding && <AddFood token={token} title={`Agregar a ${MEALS.find(x => x[0] === adding)[1].toLowerCase()}`} onClose={() => setAdding(null)} onAdd={async (items, alsoPlan) => {
      await dq("kairo_food_log", { method: "POST", token, body: items.map(it => ({ ...it, log_date: date, meal: adding })) });
      if (alsoPlan) await dq("kairo_meal_plan", { method: "POST", token, body: items.map((it, k) => ({ ...it, dow, meal: adding, sort_order: 100 + k })) });
      setAdding(null); load(); if (alsoPlan) n.load(); pushToast("Agregado");
    }} planOption={`Sumarlo también a mi ${DAYS_FULL[dow].toLowerCase()} fijo`} />}
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

// ─────── Mi semana: lo que comés cada día, fijo ───────
function Week({ token, n }) {
  const [dow, setDow] = useState(() => dowOf(today()));
  const [adding, setAdding] = useState(null);
  const [copying, setCopying] = useState(false);
  const [review, setReview] = useState(false);
  const items = n.plan.filter(p => p.dow === dow);
  const tot = sum(items), t = n.target;
  const del = async (it) => { await dq("kairo_meal_plan", { method: "DELETE", token, filters: `?id=eq.${it.id}` }); n.load(); };
  const totals = DAYS.map((_, i) => sum(n.plan.filter(p => p.dow === i)).kcal);

  return <>
    <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
      {DAYS.map((d, i) => { const on = dow === i, k = totals[i], off = t && k && Math.abs(k - t.kcal) > t.kcal * 0.1; return <button key={i} onClick={() => setDow(i)} className="k-press" style={{ flex: 1, padding: "8px 0 6px", borderRadius: 12, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.card, color: on ? C.limeInk : C.text, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
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

    {adding && <AddFood token={token} title={`${DAYS_FULL[dow]} · ${MEALS.find(x => x[0] === adding)[1].toLowerCase()}`} onClose={() => setAdding(null)} onAdd={async (list) => {
      await dq("kairo_meal_plan", { method: "POST", token, body: list.map((it, k) => ({ ...it, dow, meal: adding, sort_order: items.length + k })) });
      setAdding(null); n.load(); pushToast("Agregado a tu semana");
    }} />}
    {copying && <CopyDay token={token} from={dow} items={items} plan={n.plan} onClose={() => setCopying(false)} onDone={() => { setCopying(false); n.load(); }} />}
    {review && <NutritionReview token={token} onClose={() => setReview(false)} />}
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

function NutritionReview({ token, onClose }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");
  const run = useCallback(async () => {
    setR(null); setErr("");
    const res = await fetch("/api/kairo/coach", { method: "POST", headers: { "Content-Type": "application/json", ...auth(token) }, body: JSON.stringify({ action: "nutrition" }) }).then(r => r.json()).catch(() => ({ error: "Sin conexión" }));
    if (res.nutrition) setR({ ...res.nutrition, at: new Date().toISOString() }); else setErr(res.error || "No se pudo analizar");
  }, [token]);
  useEffect(() => {
    dq("kairo_ai", { token, filters: "?kind=eq.nutrition&select=content,created_at&order=created_at.desc&limit=1" }).then(last => { if (Array.isArray(last) && last[0]) setR({ ...last[0].content, at: last[0].created_at }); else run(); });
  }, [token, run]);
  const EST = { bien: ["Bien", C.pos], faltan: ["Faltan", C.warn], sobran: ["Sobran", C.warn], sin_cargar: ["Sin cargar", C.dim] };
  return <Sheet title="Análisis de tu semana" onClose={onClose}>
    {err ? <p style={{ color: C.danger, fontSize: 14 }}>{err}</p> : !r ? <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.5 }}>Revisando tu semana contra tu objetivo y tus suplementos…</p> : <>
      <p style={{ fontSize: 15, lineHeight: 1.5, margin: 0 }}>{r.resumen}</p>
      <Label>Día por día</Label>
      <div style={{ background: C.cardHi, borderRadius: 14, padding: "0 14px" }}>
        {r.dias.map((d, i) => <div key={i} style={{ padding: "10px 0", borderBottom: i < r.dias.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>{d.dia}</span><span style={{ color: EST[d.estado]?.[1], fontWeight: 600, fontSize: 13 }}>{EST[d.estado]?.[0]}</span></div>
          {d.nota && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3, lineHeight: 1.4 }}>{d.nota}</div>}
        </div>)}
      </div>
      {r.faltantes?.length > 0 && <><Label>Nutrientes a cuidar</Label>
        {r.faltantes.map((f, i) => <div key={i} style={{ background: C.cardHi, borderRadius: 14, padding: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 15, fontWeight: 500 }}>{f.nutriente}</span>{f.cubierto_por ? <span style={{ fontSize: 12, color: C.pos }}>Cubierto: {f.cubierto_por}</span> : <span style={{ fontSize: 12, color: C.warn }}>Sin cubrir</span>}</div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 4, lineHeight: 1.45 }}>{f.detalle}</div>
        </div>)}
      </>}
      {r.sugerencias?.length > 0 && <><Label>Cambios simples</Label>{r.sugerencias.map((x, i) => <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.45, marginBottom: 8 }}><span style={{ width: 5, height: 5, borderRadius: 3, background: C.lime, marginTop: 8, flexShrink: 0 }} /><span>{x}</span></div>)}</>}
      <button className="k-press" onClick={run} style={{ ...btnGhost, marginTop: 16 }}>Volver a analizar</button>
      {r.at && <div style={{ fontSize: 12, color: C.dim, textAlign: "center", marginTop: 8 }}>Análisis del {dayLabel(ymd(new Date(r.at)))}</div>}
    </>}
  </Sheet>;
}

// ─────── Suplementos ───────
function Supps({ token, n }) {
  const [edit, setEdit] = useState(null);
  return <>
    <div style={{ fontSize: 13, color: C.sub, margin: "18px 2px 0", lineHeight: 1.5 }}>Creatina, magnesio, omega 3, pre-entreno… con sus horarios: te llega el recordatorio y lo tildás en Hoy. La proteína en polvo cargala como comida.</div>
    <button className="k-press" onClick={() => setEdit({})} style={{ ...btnLime, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon d={I.plus} size={18} sw={2.2} />Suplemento</button>
    {n.supps.length > 0 && <div style={{ ...card, padding: "2px 14px", marginTop: 14 }}>
      {n.supps.map((s, i) => <button key={s.id} onClick={() => setEdit(s)} style={{ ...rowBtn, borderBottom: i < n.supps.length - 1 ? `0.5px solid ${C.line}` : "none", opacity: s.active ? 1 : 0.5 }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, display: "block" }}>{s.name}{s.dose ? <span style={{ color: C.sub }}> · {s.dose}</span> : null}</span>
          <span style={{ fontSize: 12, color: C.sub }}>{s.times?.length ? s.times.join(" · ") : "Sin horario"} · {s.days?.length === 7 ? "todos los días" : s.days?.map(d => DAYS[d]).join(" ")}{!s.active ? " · pausado" : ""}</span>
        </span>
        <Icon d={I.right} size={16} color={C.dim} />
      </button>)}
    </div>}
    {edit && <SuppSheet token={token} s={edit.id ? edit : null} count={n.supps.length} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); n.load(); }} />}
  </>;
}

function SuppSheet({ token, s, count, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ name: s?.name || "", dose: s?.dose || "", times: s?.times || ["09:00"], days: s?.days || [0, 1, 2, 3, 4, 5, 6], notes: s?.notes || "", active: s?.active ?? true }));
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const save = async () => {
    if (!f.name.trim()) return pushToast("Ponele un nombre");
    if (/prote[ií]na|whey/i.test(f.name)) return pushToast("La proteína en polvo cargala como comida, en Mi semana");
    setSaving(true);
    const body = { name: f.name.trim(), dose: f.dose.trim() || null, times: [...new Set(f.times.filter(Boolean))].sort(), days: [...f.days].sort((a, b) => a - b), notes: f.notes.trim() || null, active: f.active };
    if (s) await dq("kairo_supplements", { method: "PATCH", token, filters: `?id=eq.${s.id}`, body });
    else await dq("kairo_supplements", { method: "POST", token, body: { ...body, sort_order: count } });
    if (body.times.length) ensurePush(token);
    setSaving(false); pushToast("Guardado"); onSaved();
  };
  const del = async () => { await dq("kairo_supplements", { method: "DELETE", token, filters: `?id=eq.${s.id}` }); pushToast("Suplemento eliminado"); onSaved(); };
  return <Sheet title={s ? s.name : "Nuevo suplemento"} onClose={onClose}>
    <Label>Nombre</Label>
    <input value={f.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Creatina" style={field} />
    <Label>Dosis</Label>
    <input value={f.dose} onChange={e => set("dose", e.target.value)} placeholder="Ej: 5 g" style={field} />
    <Label>Horarios (te llega un recordatorio)</Label>
    <div style={{ display: "grid", gap: 8 }}>
      {f.times.map((t, i) => <div key={i} style={{ display: "flex", gap: 8 }}>
        <input type="time" value={t} onChange={e => set("times", f.times.map((x, k) => k === i ? e.target.value : x))} style={{ ...field, flex: 1, colorScheme: "dark", minHeight: 48 }} />
        <button onClick={() => set("times", f.times.filter((_, k) => k !== i))} aria-label="Quitar horario" className="k-press" style={{ ...btnGhost, width: 48, padding: 0, fontSize: 18 }}>×</button>
      </div>)}
    </div>
    <button onClick={() => set("times", [...f.times, "21:00"])} style={{ ...linkBtn, marginTop: 10, fontSize: 14 }}>+ Otro horario</button>
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
