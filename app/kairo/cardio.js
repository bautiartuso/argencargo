"use client";
// Kairo · Deporte (cardio): lo que hacés además de las pesas. Planeás qué deporte va cada día de la
// semana (boxeo lunes, miércoles y viernes a la mañana; natación martes y jueves…) y registrás cada
// sesión con sus calorías estimadas. Eso se suma al objetivo del día y vale un 15 % del éxito del día.
import { useState, useEffect, useCallback } from "react";
import { dq } from "../../lib/sb-client";
import { C, I, Icon, pushToast, Sheet, SectionTitle, Label, MiniStat, card, field, btnLime, btnGhost, linkBtn, today, ymd, dayLabel } from "./ui";
import { saveProfile } from "./perfil";
import { SPORTS, INTENSITY, sportName, kcalFor, cardioOn } from "./score";

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const dowOf = (d) => (new Date(d + "T12:00:00").getDay() + 6) % 7;
const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const chip = (on) => ({ padding: "9px 14px", borderRadius: 999, fontSize: 14, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.cardHi, color: on ? C.limeInk : C.text, fontWeight: on ? 600 : 400 });
const daysText = (d) => !d?.length ? "sin días" : d.length === 7 ? "todos los días" : d.length === 5 && d.every(x => x < 5) ? "lunes a viernes" : d.map(x => DAYS[x]).join(" ");

export default function Cardio({ token, profile, onProfile }) {
  const [log, setLog] = useState([]);
  const [sheet, setSheet] = useState(null);
  const plan = Array.isArray(profile?.cardio_plan) ? profile.cardio_plan : [];
  const weight = profile?.peso_kg || 75;
  const load = useCallback(async () => {
    const r = await dq("kairo_cardio", { token, filters: "?select=*&order=log_date.desc,created_at.desc&limit=60" });
    setLog(Array.isArray(r) ? r : []);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const dow = dowOf(today());
  const todays = cardioOn(plan, dow);
  const doneToday = log.filter(l => l.log_date === today());
  const week = log.filter(l => l.log_date >= ymd(mondayOf(new Date())));
  const wk = { min: week.reduce((a, l) => a + l.minutes, 0), kcal: week.reduce((a, l) => a + l.kcal, 0) };
  const savePlan = async (next) => { await saveProfile(token, { cardio_plan: next }); onProfile(); };
  const del = async (l) => { await dq("kairo_cardio", { method: "DELETE", token, filters: `?id=eq.${l.id}` }); load(); window.dispatchEvent(new Event("kairo-cardio")); };

  return <>
    {/* Hoy */}
    <SectionTitle>Hoy</SectionTitle>
    {todays.length || doneToday.length ? <div style={{ display: "grid", gap: 8 }}>
      {todays.map((p, i) => { const done = doneToday.find(l => l.kind === p.kind); return <div key={i} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: 20, background: done ? "rgba(74,222,128,0.14)" : "rgba(61,123,255,0.14)", color: done ? C.pos : C.blue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon d={done ? I.check : I.fire} size={20} sw={done ? 2.6 : 1.8} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600, display: "block" }}>{sportName(p.kind)}</span>
          <span style={{ fontSize: 13, color: C.sub }}>{done ? `Hecho · ${done.minutes} min · ${done.kcal} kcal` : `${p.minutes} min${p.time ? ` · ${p.time}` : ""} · ≈ ${kcalFor(p.kind, p.minutes, p.intensity, weight)} kcal`}</span>
        </span>
        {!done && <button className="k-press" onClick={() => setSheet({ type: "log", pre: p })} style={{ ...btnLime, width: "auto", padding: "10px 16px", fontSize: 14 }}>Registrar</button>}
      </div>; })}
      {doneToday.filter(l => !todays.some(p => p.kind === l.kind)).map(l => <div key={l.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(74,222,128,0.14)", color: C.pos, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon d={I.check} size={20} sw={2.6} /></span>
        <span style={{ flex: 1 }}><span style={{ fontSize: 16, fontWeight: 600, display: "block" }}>{sportName(l.kind)}</span><span style={{ fontSize: 13, color: C.sub }}>Hecho · {l.minutes} min · {l.kcal} kcal</span></span>
      </div>)}
    </div> : <div style={{ ...card, fontSize: 14, color: C.sub }}>Hoy no tenés deporte planeado. Si hiciste algo igual, registralo abajo.</div>}
    <button className="k-press" onClick={() => setSheet({ type: "log" })} style={{ ...btnGhost, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon d={I.plus} size={17} sw={2.2} />Registrar una sesión</button>

    {/* Plan semanal */}
    <SectionTitle right={<button onClick={() => setSheet({ type: "plan" })} style={linkBtn}>+ Agregar</button>}>Tu semana de deporte</SectionTitle>
    {!plan.length ? <div style={{ ...card, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>Cargá qué deporte hacés cada día (boxeo, natación, running…). Las calorías que quemás se suman a tu objetivo del día y el deporte cuenta para el éxito del día.</div>
      : <div style={{ ...card, padding: "2px 14px" }}>
        {plan.map((p, i) => <button key={i} onClick={() => setSheet({ type: "plan", index: i })} style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < plan.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 15, display: "block" }}>{sportName(p.kind)} <span style={{ color: C.sub }}>· {p.minutes} min{p.time ? ` · ${p.time}` : ""}</span></span>
            <span style={{ fontSize: 12, color: C.sub }}>{daysText(p.days)} · ≈ {kcalFor(p.kind, p.minutes, p.intensity, weight)} kcal por sesión</span>
          </span>
          <Icon d={I.right} size={16} color={C.dim} />
        </button>)}
      </div>}
    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
      {DAYS.map((d, i) => { const on = cardioOn(plan, i); return <div key={i} style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: i === dow ? C.text : C.dim, fontWeight: i === dow ? 600 : 400 }}>{d}</div>
        <div style={{ fontSize: 10.5, color: on.length ? C.blue : C.dim, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{on.length ? on.map(x => sportName(x.kind).split(" ")[0]).join("+") : "—"}</div>
      </div>; })}
    </div>

    {/* Historial */}
    <SectionTitle right={<span className="k-num" style={{ fontSize: 12, color: C.dim }}>Esta semana: {wk.min} min · {wk.kcal.toLocaleString("es-AR")} kcal</span>}>Sesiones</SectionTitle>
    {!log.length ? <div style={{ fontSize: 13, color: C.dim, padding: "0 2px" }}>Todavía no registraste ninguna.</div>
      : <div style={{ ...card, padding: "2px 14px" }}>
        {log.slice(0, 20).map((l, i, arr) => <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < arr.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 15, display: "block" }}>{sportName(l.kind)} <span style={{ color: C.sub }}>· {l.minutes} min</span></span>
            <span style={{ fontSize: 12, color: C.sub }}>{dayLabel(l.log_date) === "hoy" ? "Hoy" : dayLabel(l.log_date) === "ayer" ? "Ayer" : DAYS_FULL[dowOf(l.log_date)] + " " + dayLabel(l.log_date)} · {l.intensity}{l.notes ? ` · ${l.notes}` : ""}</span>
          </span>
          <span className="k-num" style={{ fontSize: 14, whiteSpace: "nowrap" }}>{l.kcal} kcal</span>
          <button onClick={() => del(l)} aria-label="Quitar" style={{ ...linkBtn, color: C.dim, fontSize: 18, padding: "0 4px" }}>×</button>
        </div>)}
      </div>}

    {sheet?.type === "log" && <LogCardio token={token} pre={sheet.pre} weight={weight} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); window.dispatchEvent(new Event("kairo-cardio")); }} />}
    {sheet?.type === "plan" && <PlanSheet item={sheet.index != null ? plan[sheet.index] : null} weight={weight} onClose={() => setSheet(null)}
      onSave={async (item) => { const next = sheet.index != null ? plan.map((x, k) => k === sheet.index ? item : x) : [...plan, item]; await savePlan(next); setSheet(null); pushToast("Guardado"); }}
      onDelete={async () => { await savePlan(plan.filter((_, k) => k !== sheet.index)); setSheet(null); pushToast("Quitado del plan"); }} />}
  </>;
}

function SportSelect({ value, onChange }) {
  return <div style={{ position: "relative" }}>
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...field, appearance: "none", WebkitAppearance: "none", colorScheme: "dark", paddingRight: 40 }}>
      {SPORTS.map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
    </select>
    <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}><Icon d={I.down} size={16} color={C.sub} /></span>
  </div>;
}
const Intensity = ({ value, onChange }) => <div style={{ display: "flex", gap: 8 }}>{Object.keys(INTENSITY).map(k => <button key={k} onClick={() => onChange(k)} className="k-press" style={{ ...chip(value === k), flex: 1, textAlign: "center" }}>{k[0].toUpperCase() + k.slice(1)}</button>)}</div>;

// Registrar una sesión hecha. Las calorías se estiman (MET × peso × tiempo) y las podés corregir.
function LogCardio({ token, pre, weight, onClose, onSaved }) {
  const [f, setF] = useState({ kind: pre?.kind || "boxeo", minutes: String(pre?.minutes || 45), intensity: pre?.intensity || "media", kcal: "", notes: "", date: today() });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const est = kcalFor(f.kind, Number(f.minutes), f.intensity, weight);
  const save = async () => {
    if (!Number(f.minutes)) return pushToast("Poné los minutos");
    setSaving(true);
    await dq("kairo_cardio", { method: "POST", token, body: { log_date: f.date, kind: f.kind, minutes: Number(f.minutes), intensity: f.intensity, kcal: Number(f.kcal) || est, notes: f.notes.trim() || null } });
    setSaving(false); pushToast(`${sportName(f.kind)} registrado · ${Number(f.kcal) || est} kcal`); onSaved();
  };
  return <Sheet title="Registrar deporte" onClose={onClose}>
    <Label>Deporte</Label>
    <SportSelect value={f.kind} onChange={v => set("kind", v)} />
    <Label>Cuánto tiempo</Label>
    <div style={{ ...field, display: "flex", alignItems: "center", gap: 6 }}>
      <input inputMode="numeric" value={f.minutes} onChange={e => set("minutes", e.target.value.replace(/[^\d]/g, ""))} style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 16 }} />
      <span style={{ color: C.sub }}>min</span>
    </div>
    <Label>Intensidad</Label>
    <Intensity value={f.intensity} onChange={v => set("intensity", v)} />
    <Label>Calorías quemadas</Label>
    <div style={{ ...field, display: "flex", alignItems: "center", gap: 6 }}>
      <input inputMode="numeric" value={f.kcal} onChange={e => set("kcal", e.target.value.replace(/[^\d]/g, ""))} placeholder={String(est)} className="k-num" style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 16 }} />
      <span style={{ color: C.sub }}>kcal</span>
    </div>
    <div style={{ fontSize: 12, color: C.dim, marginTop: 6, lineHeight: 1.45 }}>Estimado para tus {Math.round(weight)} kg. Si tu reloj te dice otra cosa, ponelo.</div>
    <Label>Día</Label>
    <input type="date" value={f.date} max={today()} onChange={e => set("date", e.target.value)} style={{ ...field, colorScheme: "dark", WebkitAppearance: "none", appearance: "none", minHeight: 48 }} />
    <Label>Notas (opcional)</Label>
    <input value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="Ej: 6 rounds de sparring" style={field} />
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Guardando…" : "Guardar"}</button>
  </Sheet>;
}

// Qué deporte va qué días de la semana.
function PlanSheet({ item, weight, onClose, onSave, onDelete }) {
  const [f, setF] = useState({ kind: item?.kind || "boxeo", days: item?.days || [0, 2, 4], minutes: String(item?.minutes || 45), time: item?.time || "", intensity: item?.intensity || "media" });
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const save = () => {
    if (!f.days.length) return pushToast("Elegí los días");
    if (!Number(f.minutes)) return pushToast("Poné los minutos");
    onSave({ kind: f.kind, days: [...f.days].sort((a, b) => a - b), minutes: Number(f.minutes), time: f.time || null, intensity: f.intensity });
  };
  return <Sheet title={item ? sportName(item.kind) : "Nuevo deporte"} onClose={onClose}>
    <Label>Deporte</Label>
    <SportSelect value={f.kind} onChange={v => set("kind", v)} />
    <Label>Días</Label>
    <div style={{ display: "flex", gap: 6 }}>
      {DAYS.map((d, i) => { const on = f.days.includes(i); return <button key={i} onClick={() => set("days", on ? f.days.filter(x => x !== i) : [...f.days, i])} className="k-press" style={{ flex: 1, height: 40, borderRadius: 12, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.cardHi, color: on ? C.limeInk : C.text, fontWeight: on ? 600 : 400, fontSize: 14 }}>{d}</button>; })}
    </div>
    <Label>Cuánto dura</Label>
    <div style={{ ...field, display: "flex", alignItems: "center", gap: 6 }}>
      <input inputMode="numeric" value={f.minutes} onChange={e => set("minutes", e.target.value.replace(/[^\d]/g, ""))} style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 16 }} />
      <span style={{ color: C.sub }}>min</span>
    </div>
    <Label>A qué hora (opcional)</Label>
    <input type="time" value={f.time} onChange={e => set("time", e.target.value)} style={{ ...field, colorScheme: "dark", minHeight: 48 }} />
    <Label>Intensidad habitual</Label>
    <Intensity value={f.intensity} onChange={v => set("intensity", v)} />
    <div className="k-num" style={{ fontSize: 13, color: C.sub, margin: "12px 2px 0" }}>≈ {kcalFor(f.kind, Number(f.minutes), f.intensity, weight)} kcal por sesión · {f.days.length} {f.days.length === 1 ? "vez" : "veces"} por semana</div>
    <button className="k-press" onClick={save} style={{ ...btnLime, marginTop: 18 }}>Guardar</button>
    {item && (!confirmDel ? <button onClick={() => setConfirmDel(true)} style={{ ...linkBtn, color: C.sub, width: "100%", marginTop: 14 }}>Quitar del plan</button>
      : <button onClick={onDelete} style={{ ...linkBtn, color: C.danger, width: "100%", marginTop: 14 }}>Tocá de nuevo para quitarlo</button>)}
  </Sheet>;
}
