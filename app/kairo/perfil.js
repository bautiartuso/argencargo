"use client";
// Kairo · Perfil. El centro de la app: foto, objetivo (gym + nutrición) con matices, la estrategia
// que arma la IA, peso y medidas cuando quieras (y si venís progresando), y tus reglas para la IA.
import { useState, useEffect, useCallback, useRef } from "react";
import { dq, loadSession } from "../../lib/sb-client";
import { C, I, Icon, pushToast, Sheet, SectionTitle, Label, MiniStat, card, field, btnLime, btnGhost, linkBtn, dayLabel, today, useRefresh, Skel, SkelCards } from "./ui";
import { adjustTarget, extraSplit, kcalFor, sportName } from "./score";
import { Achievements, ProgressPhotos, weeksStreak } from "./progreso";
import { ensurePush } from "./fisico";

export { MEDIDAS };
export const OBJETIVOS = [
  ["volumen", "Volumen", ["Limpio: subir despacio con poca grasa", "Agresivo: subir rápido"]],
  ["definicion", "Definición", ["Suave: bajar sin perder fuerza", "Agresiva: bajar rápido"]],
  ["recomposicion", "Recomposición", ["Tirando a volumen", "Equilibrada", "Tirando a definición"]],
  ["mantenimiento", "Mantenimiento", ["Mantener y mejorar rendimiento", "Mantener con poco tiempo"]],
  ["fuerza", "Fuerza", ["Subiendo de peso corporal", "Sin cambiar de peso"]],
];
const OBJ_LABEL = Object.fromEntries(OBJETIVOS.map(([k, l]) => [k, l]));
const MEDIDAS = [["cintura_cm", "Cintura"], ["pecho_cm", "Pecho"], ["brazo_cm", "Brazo"], ["muslo_cm", "Muslo"], ["cadera_cm", "Cadera"], ["cuello_cm", "Cuello"], ["grasa_pct", "% grasa"]];
const ESTADO = { en_camino: ["Vas bien", C.pos], lento: ["Avance lento", C.warn], desviado: ["Fuera de rumbo", C.neg], sin_datos: ["Faltan datos", C.sub] };
const n1 = (v) => Number(v).toLocaleString("es-AR", { maximumFractionDigits: 1 });
const num = (s) => Number(String(s).replace(",", ".")) || 0;

export async function saveProfile(token, patch) {
  const r = await dq("kairo_profile", { method: "POST", token, filters: "?on_conflict=user_id", body: { user_id: loadSession()?.user?.id, ...patch }, headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
  window.dispatchEvent(new Event("kairo-profile"));
  return r;
}
export const ageOf = (d) => { if (!d) return null; const b = new Date(d + "T12:00:00"), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };

export default function Perfil({ token, isAdmin, email, onLogout }) {
  const [p, setP] = useState(undefined);
  const [sheet, setSheet] = useState(null);
  const [perm, setPerm] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [thinking, setThinking] = useState(false);
  const fileRef = useRef(null);

  const [stats, setStats] = useState({ ws: [], foodDays: 0, cardio: 0, photos: 0 });
  const load = useCallback(async () => {
    const [pr, ws, fd, cd, ph] = await Promise.all([
      dq("kairo_profile", { token, filters: "?select=*&limit=1" }),
      dq("kairo_workouts", { token, filters: "?select=started_at&finished_at=not.is.null&order=started_at.desc&limit=1000" }),
      dq("kairo_food_log", { token, filters: "?select=log_date&order=log_date.desc&limit=3000" }),
      dq("kairo_cardio", { token, filters: "?select=id&limit=1000" }),
      dq("kairo_progress_photos", { token, filters: "?select=id" }),
    ]);
    setP(Array.isArray(pr) ? pr[0] || null : null);
    setStats({ ws: Array.isArray(ws) ? ws : [], foodDays: new Set((Array.isArray(fd) ? fd : []).map(x => x.log_date)).size, cardio: Array.isArray(cd) ? cd.length : 0, photos: Array.isArray(ph) ? ph.length : 0 });
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useRefresh(load);

  const askStrategy = async () => {
    setThinking(true);
    const r = await fetch("/api/kairo/coach", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${loadSession()?.token || token}` }, body: JSON.stringify({ action: "strategy" }) }).then(r => r.json()).catch(() => ({ error: "Sin conexión" }));
    setThinking(false);
    if (r.error) return pushToast(r.error);
    load();
  };

  const pickPhoto = async (file) => {
    if (!file) return;
    const url = await resizeImage(file, 256);
    await saveProfile(token, { avatar: url });
    pushToast("Foto actualizada"); load();
  };

  if (p === undefined) return <><div style={{ display: "flex", gap: 16, alignItems: "center", padding: "6px 2px 0" }}><Skel h={76} w={76} r={38} /><div style={{ flex: 1 }}><Skel h={22} w="60%" /><Skel h={14} w="40%" style={{ marginTop: 8 }} /></div></div><SkelCards n={3} h={96} /></>;
  const st = p?.estrategia;
  const { base: dietaBase, ajustes } = splitDieta(p?.dieta);
  const streak = weeksStreak(stats.ws);
  const rowBtn = { ...card, width: "100%", textAlign: "left", color: C.text, display: "flex", alignItems: "center", gap: 12 };
  const Chevron = () => <Icon d={I.right} size={16} color={C.dim} />;

  return <>
    {/* Encabezado: foto, nombre y tres números */}
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 2px 0" }}>
      <button onClick={() => fileRef.current?.click()} aria-label="Cambiar foto de perfil" className="k-press" style={{ width: 76, height: 76, borderRadius: 38, border: `2px solid ${C.lime}`, padding: 2, background: "none", flexShrink: 0 }}>
        <span style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: C.cardHi, color: C.sub }}>
          {p?.avatar ? <img src={p.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: C.lime }}><Icon d={I.plus} size={20} sw={2.2} /><span style={{ fontSize: 9.5, fontWeight: 600, lineHeight: 1.1, textAlign: "center" }}>Cargá tu<br />foto</span></span>}
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => pickPhoto(e.target.files?.[0])} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.nombre || "Tu perfil"}</div>
        <div style={{ fontSize: 13.5, color: C.sub, marginTop: 2 }}>{[email, (p?.fecha_nacimiento || p?.edad) && `${ageOf(p.fecha_nacimiento) ?? p.edad} años`].filter(Boolean).join(" · ")}</div>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
      <MiniStat label="Entrenos" value={stats.ws.length} />
      <MiniStat label="Racha" value={`${streak} sem`} color={streak ? C.lime : undefined} />
      <MiniStat label="Días contando" value={stats.foodDays} />
    </div>

    {/* Objetivo: solo el título; el detalle se edita en la hoja */}
    <SectionTitle>Tu objetivo</SectionTitle>
    {!p?.objetivo ? <button className="k-press" onClick={() => setSheet("objetivo")} style={{ ...rowBtn, borderColor: "rgba(198,244,50,0.3)" }}>
      <span style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(198,244,50,0.12)", color: C.lime, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon d={I.target} size={20} /></span>
      <span style={{ flex: 1 }}><span style={{ fontSize: 15, fontWeight: 500, display: "block" }}>Contale a Kairo qué buscás</span><span style={{ fontSize: 13, color: C.sub }}>Con eso la IA arma tu estrategia.</span></span><Chevron />
    </button> : <button className="k-press" onClick={() => setSheet("objetivo")} style={rowBtn}>
      <span style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(198,244,50,0.12)", color: C.lime, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon d={I.target} size={20} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 600, display: "block" }}>{OBJ_LABEL[p.objetivo]}{p.tendencia ? <span style={{ color: C.sub, fontWeight: 400 }}> · {p.tendencia.split(":")[0]}</span> : null}</span>
        <span style={{ fontSize: 12.5, color: C.sub, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[dietaBase !== DIETAS[0] ? dietaBase : null, ...ajustes, p.experiencia, p.altura_cm && `${n1(p.altura_cm)} cm`, p.peso_kg && `${n1(p.peso_kg)} kg`].filter(Boolean).join(" · ") || "Tocá para completar tus datos"}</span>
      </span><Chevron />
    </button>}

    {/* Estrategia: los números; el resto en la hoja */}
    {p?.objetivo && <>
      <SectionTitle>Tu estrategia de alimentación</SectionTitle>
      {!st ? <button className="k-press" onClick={askStrategy} disabled={thinking} style={{ ...btnLime, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Icon d={I.spark} size={18} />{thinking ? "La IA está calculando tus calorías y macros…" : "Calcular calorías y macros con IA"}
      </button> : <button className="k-press" onClick={() => setSheet("estrategia")} style={rowBtn}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span className="k-num" style={{ fontSize: 24, fontWeight: 600, color: C.lime, letterSpacing: "-0.02em" }}>{Number(st.calorias_dia).toLocaleString("es-AR")}</span><span style={{ fontSize: 13, color: C.sub }}>kcal/día{Array.isArray(p.cardio_plan) && p.cardio_plan.length ? " sin deporte" : ""}</span></span>
          <span className="k-num" style={{ fontSize: 13, color: C.sub, display: "block", marginTop: 2 }}>P {st.proteina_g} · C {st.carbohidratos_g} · G {st.grasas_g} g{st.manual ? " · a mano" : ""}{st.progreso ? <span style={{ color: ESTADO[st.progreso.estado]?.[1] || C.sub }}> · {ESTADO[st.progreso.estado]?.[0]}</span> : null}</span>
        </span><Chevron />
      </button>}
    </>}

    {/* Reglas: una línea cada una */}
    <SectionTitle>Reglas para la IA</SectionTitle>
    <button className="k-press" onClick={() => setSheet("reglas")} style={rowBtn}>
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
        <Rule label="Entrenamiento" text={p?.reglas_gym} placeholder="Ej: priorizo máquinas antes que peso libre" oneLine />
        <Rule label="Alimentación" text={p?.reglas_nutricion} placeholder="Ej: comidas simples, pollo a la plancha y listo" oneLine />
      </span><Chevron />
    </button>

    <ProgressPhotos token={token} profile={p} />
    <Achievements profile={p} ws={stats.ws} foodDays={stats.foodDays} cardio={stats.cardio} photos={stats.photos} />

    {/* Ajustes */}
    <SectionTitle>Ajustes</SectionTitle>
    <div style={{ ...card, padding: "2px 16px" }}>
      <button onClick={async () => { if (perm === "granted") return pushToast("Ya están activadas"); if (perm === "denied") return pushToast("Están bloqueadas: activalas desde Ajustes del iPhone → Kairo"); await ensurePush(token); setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission); }} style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: `0.5px solid ${C.line}` }}>
        <Icon d={I.bell} size={20} color={C.sub} /><span style={{ flex: 1, fontSize: 15 }}>Notificaciones</span><span style={{ fontSize: 13, color: perm === "granted" ? C.pos : perm === "denied" ? C.neg : C.sub }}>{perm === "granted" ? "Activadas" : perm === "denied" ? "Bloqueadas" : perm === "unsupported" ? "No disponible" : "Activar"}</span>
      </button>
      <button onClick={() => setSheet("salir")} style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "13px 0" }}>
        <Icon d={I.close} size={20} color={C.sub} /><span style={{ flex: 1, fontSize: 15 }}>Cerrar sesión</span><span style={{ fontSize: 13, color: C.sub }}>{email}</span>
      </button>
    </div>

    {sheet === "objetivo" && <ObjectiveSheet token={token} p={p} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {sheet === "estrategia" && st && <StrategySheet p={p} st={st} thinking={thinking} onRecalc={askStrategy} onEdit={() => setSheet("macros")} onClose={() => setSheet(null)} />}
    {sheet === "macros" && <MacrosSheet token={token} st={st} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {sheet === "reglas" && <RulesSheet token={token} p={p} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {sheet === "salir" && <Sheet title="¿Cerrás sesión?" onClose={() => setSheet(null)}>
      <p style={{ fontSize: 14, color: C.sub, margin: "-4px 0 16px", lineHeight: 1.5 }}>Tus datos quedan guardados. Para volver, entrás con tu email y contraseña.</p>
      <button className="k-press" onClick={onLogout} style={{ ...btnLime, background: "rgba(255,107,107,0.14)", color: C.neg }}>Cerrar sesión</button>
      <button className="k-press" onClick={() => setSheet(null)} style={{ ...btnGhost, marginTop: 8 }}>Cancelar</button>
    </Sheet>}
    {isAdmin && <Users token={token} />}
  </>;
}

// La estrategia completa: resumen, cómo viene el progreso, pautas, deporte, y los botones para editar o recalcular.
function StrategySheet({ p, st, thinking, onRecalc, onEdit, onClose }) {
  const sp = extraSplit(st);
  return <Sheet title="Tu estrategia" onClose={onClose} tall>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <div><span className="k-num" style={{ fontSize: 32, fontWeight: 600, color: C.lime, letterSpacing: "-0.02em" }}>{Number(st.calorias_dia).toLocaleString("es-AR")}</span><span style={{ color: C.sub }}> kcal/día{Array.isArray(p.cardio_plan) && p.cardio_plan.length ? " sin deporte" : ""}</span></div>
      {st.ritmo_peso_semanal_kg != null && <span className="k-num" style={{ fontSize: 13, color: C.sub }}>{st.ritmo_peso_semanal_kg > 0 ? "+" : ""}{Number(st.ritmo_peso_semanal_kg).toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg/sem</span>}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
      <MiniStat label="Proteína" value={`${st.proteina_g} g`} />
      <MiniStat label="Carbohidratos" value={`${st.carbohidratos_g} g`} />
      <MiniStat label="Grasas" value={`${st.grasas_g} g`} />
    </div>
    {(p.dieta || st.manual) && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 10 }}>{[p.dieta, st.manual && "objetivos editados a mano"].filter(Boolean).join(" · ")}</div>}
    {st.resumen && <p style={{ fontSize: 14.5, lineHeight: 1.55, margin: "14px 0 0" }}>{st.resumen}</p>}
    {st.progreso && <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: C.cardHi }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: ESTADO[st.progreso.estado]?.[1] || C.sub }}>{ESTADO[st.progreso.estado]?.[0] || "Progreso"}</div>
      <div style={{ fontSize: 13.5, color: C.sub, marginTop: 4, lineHeight: 1.45 }}>{st.progreso.lectura}</div>
    </div>}
    {Array.isArray(p.cardio_plan) && p.cardio_plan.length > 0 && <div style={{ fontSize: 13, color: C.sub, marginTop: 14, lineHeight: 1.55 }}>Los días con deporte el extra va {Math.round(sp.p * 100)} % a proteína, {Math.round(sp.c * 100)} % a carbohidratos y {Math.round(sp.g * 100)} % a grasas{sp.motivo ? ` (${sp.motivo.replace(/\.$/, "")})` : ""}: {p.cardio_plan.map(x => { const a = adjustTarget(st, kcalFor(x.kind, x.minutes, x.intensity, p.peso_kg)); return `${sportName(x.kind)} ≈ ${a.calorias_dia.toLocaleString("es-AR")} kcal · P ${a.proteina_g} · C ${a.carbohidratos_g} · G ${a.grasas_g}`; }).join(" · ")}.</div>}
    <Pautas st={st} />
    {p.estrategia_at && <div style={{ fontSize: 11.5, color: C.dim, marginTop: 14 }}>Actualizada {dayLabel(p.estrategia_at.slice(0, 10))}. Recalculala cuando registres medidas nuevas o cambies de objetivo.</div>}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
      <button className="k-press" onClick={onEdit} style={btnGhost}>Editar a mano</button>
      <button className="k-press" onClick={onRecalc} disabled={thinking} style={{ ...btnLime, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon d={I.spark} size={16} />{thinking ? "Pensando…" : "Recalcular"}</button>
    </div>
  </Sheet>;
}

function Pautas({ st }) {
  const tabs = [["alimentacion", "Alimentación"], ["micronutrientes", "Micronutrientes"], ["entrenamiento", "Gimnasio"]].filter(([k]) => st[k]?.length);
  const [tab, setTab] = useState(tabs[0]?.[0] || "alimentacion");
  const list = st[tab] || [];
  return <div style={{ marginTop: 14 }}>
    <div style={{ display: "flex", gap: 6 }}>
      {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className="k-press" style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, border: `0.5px solid ${tab === k ? C.lime : C.line}`, background: tab === k ? "rgba(198,244,50,0.1)" : "transparent", color: tab === k ? C.lime : C.sub }}>{l}</button>)}
    </div>
    <div style={{ marginTop: 10 }}>{list.map((x, i) => <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.45, marginBottom: 8 }}><span style={{ width: 5, height: 5, borderRadius: 3, background: C.lime, marginTop: 8, flexShrink: 0 }} /><span>{x}</span></div>)}</div>
  </div>;
}

const Rule = ({ label, text, placeholder, oneLine }) => <div style={{ minWidth: 0 }}>
  <div style={{ fontSize: 12, color: C.sub }}>{label}</div>
  <div style={{ fontSize: 14, marginTop: 2, color: text ? C.text : C.dim, lineHeight: 1.45, ...(oneLine ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : {}) }}>{text || placeholder}</div>
</div>;

export function MeasuresTable({ logs }) {
  const rows = MEDIDAS.map(([k, label]) => {
    const vals = logs.filter(l => l[k] != null);
    if (!vals.length) return null;
    const last = Number(vals[0][k]), first = Number(vals[vals.length - 1][k]);
    return { label, last, diff: last - first, unit: k === "grasa_pct" ? "%" : "cm" };
  }).filter(Boolean);
  if (!rows.length) return null;
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
    {rows.map(r => <div key={r.label} style={{ background: C.cardHi, borderRadius: 12, padding: "9px 10px" }}>
      <div style={{ fontSize: 11, color: C.sub }}>{r.label}</div>
      <div className="k-num" style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{n1(r.last)}<span style={{ fontSize: 11, color: C.sub }}> {r.unit}</span></div>
      {r.diff !== 0 && <div className="k-num" style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>{r.diff > 0 ? "+" : ""}{n1(r.diff)}</div>}
    </div>)}
  </div>;
}

export function Spark({ values }) {
  const W = 320, H = 70, P = 6, max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => [P + (i * (W - 2 * P)) / Math.max(1, values.length - 1), H - P - ((v - min) / span) * (H - 2 * P)]);
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", marginTop: 10 }} aria-hidden="true">
    <polyline points={pts.map(p => p.join(",")).join(" ")} fill="none" stroke={C.lime} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx={pts.at(-1)[0]} cy={pts.at(-1)[1]} r="3.5" fill={C.lime} />
  </svg>;
}

// Tipo de alimentación = base (keto, vegana…) + ajustes sobre esa misma dieta, como en Fitia
// ("más proteína", "menos carbohidratos"…). Se guarda junto en kairo_profile.dieta: "Keto · Más proteína".
export const DIETAS = ["Sin restricción", "Keto", "Low carb", "Vegetariana", "Vegana", "Pescetariana", "Sin gluten (celíaca)", "Sin lactosa", "Mediterránea", "Ayuno intermitente", "Paleo", "Carnívora"];
export const AJUSTES = ["Más proteína", "Menos carbohidratos", "Más carbohidratos", "Menos grasas", "Sin azúcar", "Más fibra"];
const OPUESTOS = { "Menos carbohidratos": "Más carbohidratos", "Más carbohidratos": "Menos carbohidratos" };
const splitDieta = (d) => { const parts = String(d || "").split(" · ").filter(Boolean); const base = DIETAS.includes(parts[0]) ? parts[0] : DIETAS[0]; return { base, ajustes: parts.filter(x => AJUSTES.includes(x)) }; };
const joinDieta = (base, ajustes) => [base !== DIETAS[0] ? base : null, ...ajustes].filter(Boolean).join(" · ") || null;
const chip = (on) => ({ padding: "9px 14px", borderRadius: 999, fontSize: 14, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.cardHi, color: on ? C.limeInk : C.text, fontWeight: on ? 600 : 400, textAlign: "left" });

function ObjectiveSheet({ token, p, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ nombre: "", objetivo: "", tendencia: "", objetivo_detalle: "", experiencia: "", sexo: "", fecha_nacimiento: "", altura_cm: "", dias_semana: "", lesiones: "", ...(p || {}), ...splitDieta(p?.dieta) }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const tendencias = OBJETIVOS.find(([k]) => k === f.objetivo)?.[2] || [];
  const save = async () => {
    if (!f.nombre?.trim()) return pushToast("Poné tu nombre");
    setSaving(true);
    await saveProfile(token, { nombre: f.nombre?.trim() || null, objetivo: f.objetivo || null, tendencia: f.tendencia || null, objetivo_detalle: f.objetivo_detalle?.trim() || null, experiencia: f.experiencia || null, sexo: f.sexo || null, fecha_nacimiento: f.fecha_nacimiento || null, edad: ageOf(f.fecha_nacimiento), altura_cm: num(f.altura_cm) || null, lesiones: f.lesiones?.trim() || null, dieta: joinDieta(f.base, f.ajustes), updated_at: new Date().toISOString() });
    setSaving(false); pushToast(p?.estrategia && joinDieta(f.base, f.ajustes) !== (p?.dieta || null) ? "Guardado. Recalculá tu estrategia para que los macros lo reflejen" : "Objetivo guardado"); onSaved();
  };
  return <Sheet title="Tu objetivo" onClose={onClose}>
    <Label>Tu nombre *</Label>
    <input value={f.nombre || ""} onChange={e => set("nombre", e.target.value)} placeholder="Cómo te llamamos" style={field} />
    <Label>Qué buscás</Label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{OBJETIVOS.map(([k, l]) => <button key={k} onClick={() => setF({ ...f, objetivo: k, tendencia: "" })} className="k-press" style={chip(f.objetivo === k)}>{l}</button>)}</div>
    {tendencias.length > 0 && <>
      <Label>Con qué intención</Label>
      <div style={{ display: "grid", gap: 8 }}>{tendencias.map(t => <button key={t} onClick={() => set("tendencia", t)} className="k-press" style={{ ...chip(f.tendencia === t), borderRadius: 14, padding: "11px 14px" }}>{t}</button>)}</div>
    </>}
    <Label>Contalo con tus palabras (opcional)</Label>
    <textarea value={f.objetivo_detalle || ""} onChange={e => set("objetivo_detalle", e.target.value)} rows={3} placeholder="Ej: quiero marcar abdomen para el verano sin perder lo que gané de pecho" style={{ ...field, resize: "vertical", lineHeight: 1.45 }} />
    <Label>Tipo de alimentación</Label>
    <div style={{ position: "relative" }}>
      <select value={f.base} onChange={e => set("base", e.target.value)} style={{ ...field, appearance: "none", WebkitAppearance: "none", colorScheme: "dark", paddingRight: 40 }}>
        {DIETAS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}><Icon d={I.down} size={16} color={C.sub} /></span>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>{AJUSTES.map(a => { const on = f.ajustes.includes(a); return <button key={a} onClick={() => set("ajustes", on ? f.ajustes.filter(x => x !== a) : [...f.ajustes.filter(x => x !== OPUESTOS[a]), a])} className="k-press" style={{ ...chip(on), padding: "8px 13px", fontSize: 13.5 }}>{a}</button>; })}</div>
    <div style={{ fontSize: 12, color: C.dim, marginTop: 8, lineHeight: 1.45 }}>La base y los ajustes los respeta la IA al calcular tus macros y al analizar tu plan semanal (en keto los carbohidratos van casi a cero; "más proteína" sube la proteína y baja el resto).</div>
    <Label>Experiencia entrenando</Label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{[["principiante", "Menos de 1 año"], ["intermedio", "1 a 3 años"], ["avanzado", "Más de 3"]].map(([k, l]) => <button key={k} onClick={() => set("experiencia", k)} className="k-press" style={chip(f.experiencia === k)}>{l}</button>)}</div>
    <Label>Sexo</Label>
    <div style={{ display: "flex", gap: 8 }}>{[["hombre", "Hombre"], ["mujer", "Mujer"]].map(([k, l]) => <button key={k} onClick={() => set("sexo", k)} className="k-press" style={chip(f.sexo === k)}>{l}</button>)}</div>
    <Label>Fecha de nacimiento{f.fecha_nacimiento ? ` · ${ageOf(f.fecha_nacimiento)} años` : ""}</Label>
    <input type="date" value={f.fecha_nacimiento || ""} onChange={e => set("fecha_nacimiento", e.target.value)} style={{ ...field, colorScheme: "dark", minWidth: 0, WebkitAppearance: "none", appearance: "none", minHeight: 48 }} />
    <Label>Altura</Label>
    <div style={{ ...field, display: "flex", alignItems: "center", gap: 6 }}>
      <input inputMode="numeric" value={f.altura_cm ?? ""} onChange={e => set("altura_cm", e.target.value.replace(/[^\d]/g, ""))} placeholder="178" style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 16 }} />
      <span style={{ color: C.sub }}>cm</span>
    </div>
    <Label>Lesiones o limitaciones</Label>
    <input value={f.lesiones || ""} onChange={e => set("lesiones", e.target.value)} placeholder="Ej: hombro derecho" style={field} />
    <div style={{ fontSize: 12, color: C.dim, marginTop: 10 }}>El peso lo cargás en Inicio. Podés guardar ahora y completar el resto después.</div>
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 18 }}>{saving ? "Guardando…" : "Guardar"}</button>
  </Sheet>;
}

// Calorías y macros a mano (por si la IA no acertó, o para una dieta puntual). El éxito del día se mide con esto.
function MacrosSheet({ token, st, onClose, onSaved }) {
  const sp = extraSplit(st);
  const [f, setF] = useState({ kcal: st.calorias_dia ?? "", p: st.proteina_g ?? "", c: st.carbohidratos_g ?? "", g: st.grasas_g ?? "", xp: String(Math.round(sp.p * 100)), xc: String(Math.round(sp.c * 100)), xg: String(Math.round(sp.g * 100)) });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v.replace(/[^\d]/g, "") });
  const calc = (Number(f.p) || 0) * 4 + (Number(f.c) || 0) * 4 + (Number(f.g) || 0) * 9;
  const xsum = (Number(f.xp) || 0) + (Number(f.xc) || 0) + (Number(f.xg) || 0);
  const save = async () => {
    if (!Number(f.kcal) || f.p === "") return pushToast("Poné al menos calorías y proteína");
    if (xsum !== 100) return pushToast("El reparto del extra tiene que sumar 100 %");
    setSaving(true);
    const xChanged = [f.xp, f.xc, f.xg].map(Number).join() !== [sp.p, sp.c, sp.g].map(x => Math.round(x * 100)).join();
    const deporte_extra = { proteina_pct: Number(f.xp), carbohidratos_pct: Number(f.xc), grasas_pct: Number(f.xg), motivo: xChanged ? "Reparto elegido a mano" : (st.deporte_extra?.motivo || "") };
    await saveProfile(token, { estrategia: { ...st, calorias_dia: Number(f.kcal), proteina_g: Number(f.p), carbohidratos_g: Number(f.c) || 0, grasas_g: Number(f.g) || 0, deporte_extra, manual: true }, updated_at: new Date().toISOString() });
    setSaving(false); pushToast("Objetivos guardados"); onSaved();
  };
  const row = (k, label, unit) => <div style={{ ...field, display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
    <span style={{ flex: 1, color: C.sub, fontSize: 14 }}>{label}</span>
    <input inputMode="numeric" value={f[k]} onChange={e => set(k, e.target.value)} className="k-num" style={{ width: 80, textAlign: "right", background: "none", border: "none", outline: "none", color: C.text, fontSize: 17, fontWeight: 500 }} />
    <span style={{ color: C.sub, width: 28 }}>{unit}</span>
  </div>;
  return <Sheet title="Tus objetivos del día" onClose={onClose}>
    <p style={{ fontSize: 13, color: C.sub, margin: "-4px 0 6px", lineHeight: 1.45 }}>Lo que la IA calculó lo podés ajustar. En keto, por ejemplo, los carbohidratos van en 20 o 30. El éxito de cada día se mide contra esto.</p>
    {row("kcal", "Calorías", "kcal")}
    {row("p", "Proteína", "g")}
    {row("c", "Carbohidratos", "g")}
    {row("g", "Grasas", "g")}
    <div className="k-num" style={{ fontSize: 12.5, color: Math.abs(calc - Number(f.kcal)) > 150 ? C.warn : C.dim, margin: "10px 2px 0" }}>Los macros suman {calc.toLocaleString("es-AR")} kcal{Math.abs(calc - Number(f.kcal)) > 150 ? " · no cierran con las calorías" : ""}</div>
    <Label>Los días con deporte, el extra va a…</Label>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      {[["xp", "Proteína"], ["xc", "Carbos"], ["xg", "Grasas"]].map(([k, l]) => <div key={k} style={{ ...field, padding: "10px 12px" }}>
        <div style={{ fontSize: 11.5, color: C.sub }}>{l}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}><input inputMode="numeric" value={f[k]} onChange={e => set(k, e.target.value)} className="k-num" style={{ width: "100%", minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 17, fontWeight: 500 }} /><span style={{ color: C.sub, fontSize: 13 }}>%</span></div>
      </div>)}
    </div>
    <div className="k-num" style={{ fontSize: 12.5, color: xsum === 100 ? C.dim : C.warn, margin: "8px 2px 0", lineHeight: 1.45 }}>{xsum === 100 ? `Lo que quemás haciendo deporte se reparte así entre los macros de ese día.${sp.motivo ? ` La IA propuso esto porque: ${sp.motivo.replace(/\.$/, "").toLowerCase()}.` : ""}` : `Suma ${xsum} %, tiene que dar 100 %.`}</div>
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 18 }}>{saving ? "Guardando…" : "Guardar"}</button>
  </Sheet>;
}

function RulesSheet({ token, p, onClose, onSaved }) {
  const [gym, setGym] = useState(p?.reglas_gym || "");
  const [food, setFood] = useState(p?.reglas_nutricion || "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await saveProfile(token, { reglas_gym: gym.trim() || null, reglas_nutricion: food.trim() || null, updated_at: new Date().toISOString() });
    setSaving(false); pushToast("Reglas guardadas"); onSaved();
  };
  return <Sheet title="Reglas para la IA" onClose={onClose}>
    <p style={{ fontSize: 13, color: C.sub, margin: "-4px 0 0", lineHeight: 1.45 }}>Cómo te gusta entrenar y comer. La IA lo respeta en cada plan y recomendación.</p>
    <Label>Entrenamiento</Label>
    <textarea value={gym} onChange={e => setGym(e.target.value)} rows={4} placeholder="Ej: priorizo máquinas antes que peso libre porque me cuesta controlar la técnica. Entreno de noche, máximo 75 minutos." style={{ ...field, resize: "vertical", lineHeight: 1.45 }} />
    <Label>Alimentación</Label>
    <textarea value={food} onChange={e => setFood(e.target.value)} rows={4} placeholder="Ej: comidas simples y rápidas, tipo pollo a la plancha con arroz. No como pescado." style={{ ...field, resize: "vertical", lineHeight: 1.45 }} />
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 18 }}>{saving ? "Guardando…" : "Guardar"}</button>
  </Sheet>;
}

export function LogSheet({ token, log, last, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ log_date: today(), peso_kg: "", ...Object.fromEntries(MEDIDAS.map(([k]) => [k, ""])), ...(log ? Object.fromEntries(Object.entries(log).map(([k, v]) => [k, v == null ? "" : String(v).replace(".", ",")])) : {}) }));
  const [more, setMore] = useState(!!log && MEDIDAS.some(([k]) => log[k] != null));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const save = async () => {
    const body = { log_date: f.log_date || today(), peso_kg: num(f.peso_kg) || null, ...Object.fromEntries(MEDIDAS.map(([k]) => [k, num(f[k]) || null])) };
    if (!body.peso_kg && !MEDIDAS.some(([k]) => body[k])) return pushToast("Cargá el peso o alguna medida");
    setSaving(true);
    if (log) await dq("kairo_body_logs", { method: "PATCH", token, filters: `?id=eq.${log.id}`, body });
    else await dq("kairo_body_logs", { method: "POST", token, body });
    if (body.peso_kg) await saveProfile(token, { peso_kg: body.peso_kg });
    setSaving(false); pushToast("Registrado"); onSaved();
  };
  const del = async () => { await dq("kairo_body_logs", { method: "DELETE", token, filters: `?id=eq.${log.id}` }); pushToast("Registro eliminado"); onSaved(); };
  return <Sheet title={log ? "Editar registro" : "Registrar"} onClose={onClose}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, borderBottom: `0.5px solid ${C.line}`, paddingBottom: 8 }}>
      <input autoFocus={!log} inputMode="decimal" value={f.peso_kg} onChange={e => set("peso_kg", e.target.value)} placeholder={last?.peso_kg ? String(last.peso_kg).replace(".", ",") : "0"} className="k-num" style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 40, fontWeight: 500 }} />
      <span style={{ fontSize: 20, color: C.sub }}>kg</span>
    </div>
    <Label>Fecha</Label>
    <input type="date" value={f.log_date} onChange={e => set("log_date", e.target.value)} style={{ ...field, colorScheme: "dark" }} />
    {!more ? <button onClick={() => setMore(true)} style={{ ...linkBtn, marginTop: 16, fontSize: 14 }}>+ Agregar medidas (opcional)</button> : <>
      <Label>Medidas (cm) · medí siempre en el mismo lugar y a la misma hora</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {MEDIDAS.map(([k, label]) => <label key={k}>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>{label}</div>
          <input inputMode="decimal" value={f[k]} onChange={e => set(k, e.target.value)} placeholder={last?.[k] ? String(last[k]).replace(".", ",") : ""} style={field} />
        </label>)}
      </div>
    </>}
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Guardando…" : "Guardar"}</button>
    {log && <button onClick={del} style={{ ...linkBtn, color: C.danger, width: "100%", marginTop: 14 }}>Eliminar registro</button>}
  </Sheet>;
}

// Achica la foto en el celular antes de guardarla (cuadrada, jpg liviano).
export function resizeImage(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = size; c.height = size;
      const s = Math.min(img.width, img.height), ctx = c.getContext("2d");
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Usuarios de Kairo (solo el admin): crear cuentas para amigos. Entran solo a /kairo.
function Users({ token }) {
  const [list, setList] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const auth = () => ({ Authorization: `Bearer ${loadSession()?.token || token}` });
  const load = useCallback(async () => {
    const r = await fetch("/api/kairo/users", { headers: auth() }).then(r => r.json()).catch(() => ({}));
    setList(r.users || []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return <>
    <SectionTitle right={<button onClick={() => setAdding(true)} style={linkBtn}>+ Crear usuario</button>}>Usuarios de Kairo</SectionTitle>
    <div style={{ ...card, padding: "2px 16px" }}>
      {!list ? <p style={{ color: C.sub, fontSize: 14 }}>Cargando…</p> : list.length === 0 ? <p style={{ color: C.sub, fontSize: 14 }}>Todavía no hay usuarios.</p> :
        list.map((u, i) => <button key={u.id} disabled={u.role !== "kairo"} onClick={() => setEditing(u)} style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < list.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <Avatar src={u.avatar} size={36} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15 }}>{u.nombre || "Todavía no entró"}{u.role !== "kairo" && <span style={{ fontSize: 12, color: C.dim }}> · vos</span>}</div>
            <div style={{ fontSize: 12, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
          </div>
          {u.role === "kairo" && <Icon d={I.right} size={16} color={C.dim} />}
        </button>)}
    </div>
    {adding && <NewUserSheet auth={auth} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    {editing && <EditUserSheet auth={auth} user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
  </>;
}

function NewUserSheet({ auth, onClose, onSaved }) {
  const [f, setF] = useState({ email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const r = await fetch("/api/kairo/users", { method: "POST", headers: { "Content-Type": "application/json", ...auth() }, body: JSON.stringify(f) }).then(r => r.json()).catch(() => ({ error: "Sin conexión" }));
    setSaving(false);
    if (r.error) return pushToast(r.error);
    pushToast("Usuario creado"); onSaved();
  };
  return <Sheet title="Crear usuario" onClose={onClose}>
    <p style={{ fontSize: 13, color: C.sub, margin: "-4px 0 0", lineHeight: 1.45 }}>La cuenta entra solo a Kairo (no ve nada de Argencargo). Pasale el email y la contraseña: cuando entre por primera vez, pone su nombre, su foto y sus datos.</p>
    <Label>Email</Label>
    <input type="email" autoComplete="off" autoCapitalize="none" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="juan@gmail.com" style={field} />
    <Label>Contraseña</Label>
    <input type="text" autoComplete="new-password" autoCapitalize="none" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder="Mínimo 6 caracteres" style={field} />
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Creando…" : "Crear usuario"}</button>
  </Sheet>;
}

function EditUserSheet({ auth, user, onClose, onSaved }) {
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const save = async () => {
    const body = { id: user.id, ...(email.trim() !== user.email ? { email } : {}), ...(password ? { password } : {}) };
    if (!body.email && !body.password) return onClose();
    setSaving(true);
    const r = await fetch("/api/kairo/users", { method: "PATCH", headers: { "Content-Type": "application/json", ...auth() }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ error: "Sin conexión" }));
    setSaving(false);
    if (r.error) return pushToast(r.error);
    pushToast("Usuario actualizado"); onSaved();
  };
  const del = async () => {
    setSaving(true);
    const r = await fetch(`/api/kairo/users?id=${user.id}`, { method: "DELETE", headers: auth() }).then(r => r.json()).catch(() => ({ error: "Sin conexión" }));
    setSaving(false);
    if (r.error) return pushToast(r.error);
    pushToast("Usuario eliminado"); onSaved();
  };
  return <Sheet title={user.nombre || "Usuario"} onClose={onClose}>
    <Label>Email</Label>
    <input type="email" autoComplete="off" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} style={field} />
    <Label>Nueva contraseña (dejala vacía para no cambiarla)</Label>
    <input type="text" autoComplete="new-password" autoCapitalize="none" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={field} />
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Guardando…" : "Guardar"}</button>
    {!confirmDel ? <button onClick={() => setConfirmDel(true)} className="k-press" style={{ ...btnGhost, marginTop: 10, color: C.danger }}>Eliminar usuario</button>
      : <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: "rgba(255,92,92,0.08)", border: `0.5px solid rgba(255,92,92,0.35)` }}>
        <div style={{ fontSize: 14, lineHeight: 1.45 }}>Se borra la cuenta y todo lo que cargó (rutinas, entrenos, peso, finanzas, historias). No se puede deshacer.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <button className="k-press" onClick={() => setConfirmDel(false)} style={btnGhost}>Cancelar</button>
          <button className="k-press" onClick={del} disabled={saving} style={{ ...btnGhost, color: C.danger, borderColor: "rgba(255,92,92,0.5)" }}>Eliminar</button>
        </div>
      </div>}
  </Sheet>;
}

export function Avatar({ src, size = 40 }) {
  return <span style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", background: C.cardHi, color: C.sub, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon d={I.user} size={size * 0.48} />}
  </span>;
}

// Primera vez que entra un usuario (la cuenta la crea el admin solo con email y contraseña):
// pone su nombre (obligatorio), y si quiere su foto y su fecha de nacimiento.
// Onboarding: la primera vez que entrás (la cuenta la creaste vos con email y contraseña). Tres pasos:
// quién sos (foto obligatoria), qué buscás, cómo comés. Con eso Kairo ya puede armar tu estrategia.
export function Welcome({ token, onDone }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ nombre: "", avatar: null, fecha_nacimiento: "", sexo: "", altura_cm: "", objetivo: "", tendencia: "", experiencia: "", dias_semana: "", base: DIETAS[0], ajustes: [] });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const tendencias = OBJETIVOS.find(([k]) => k === f.objetivo)?.[2] || [];
  const next = () => {
    if (step === 0) { if (!f.avatar) return pushToast("Subí una foto: tus amigos te reconocen por ella"); if (!f.nombre.trim()) return pushToast("Poné tu nombre"); }
    if (step === 1 && !f.objetivo) return pushToast("Elegí qué buscás");
    setStep(step + 1);
  };
  const finish = async () => {
    setSaving(true);
    await saveProfile(token, { nombre: f.nombre.trim(), avatar: f.avatar, fecha_nacimiento: f.fecha_nacimiento || null, edad: ageOf(f.fecha_nacimiento), sexo: f.sexo || null, altura_cm: num(f.altura_cm) || null, objetivo: f.objetivo || null, tendencia: f.tendencia || null, experiencia: f.experiencia || null, dias_semana: Number(f.dias_semana) || null, dieta: joinDieta(f.base, f.ajustes), updated_at: new Date().toISOString() });
    setSaving(false); onDone();
  };
  const titles = [["Quién sos", "Tu foto y tu nombre es lo que ven tus amigos en Kairo."], ["Qué buscás", "Con esto la IA arma tu estrategia y las cargas de cada entreno."], ["Cómo comés", "Para que los macros y los análisis respeten tu forma de comer."]];
  return <div style={{ position: "fixed", inset: 0, zIndex: 80, background: C.bg, overflowY: "auto" }}>
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "calc(env(safe-area-inset-top) + 36px) 24px calc(env(safe-area-inset-bottom) + 40px)" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 26 }}>{[0, 1, 2].map(i => <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? C.lime : C.line, transition: "background 200ms" }} />)}</div>
      <div style={{ fontSize: 13, color: C.lime, fontWeight: 600 }}>Paso {step + 1} de 3</div>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", marginTop: 4 }}>{titles[step][0]}</div>
      <p style={{ color: C.sub, fontSize: 14.5, lineHeight: 1.5, margin: "8px 0 20px" }}>{titles[step][1]}</p>

      {step === 0 && <div key="s0" className="k-tab">
        <button onClick={() => fileRef.current?.click()} className="k-press" style={{ width: 110, height: 110, borderRadius: 55, border: `2px solid ${f.avatar ? C.lime : C.line}`, padding: 3, background: "none", display: "block", margin: "0 auto" }}>
          <span style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: C.cardHi, color: C.lime }}>
            {f.avatar ? <img src={f.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Icon d={I.camera} size={26} sw={1.8} /><span style={{ fontSize: 11.5, fontWeight: 600 }}>Tu foto *</span></span>}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={async e => { const file = e.target.files?.[0]; if (file) set("avatar", await resizeImage(file, 256)); }} />
        <Label>Tu nombre *</Label>
        <input value={f.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Cómo te llamás" autoComplete="given-name" style={field} />
        <Label>Fecha de nacimiento{f.fecha_nacimiento ? ` · ${ageOf(f.fecha_nacimiento)} años` : ""}</Label>
        <input type="date" value={f.fecha_nacimiento} onChange={e => set("fecha_nacimiento", e.target.value)} style={{ ...field, colorScheme: "dark", minHeight: 48, WebkitAppearance: "none", appearance: "none" }} />
        <Label>Sexo</Label>
        <div style={{ display: "flex", gap: 8 }}>{[["hombre", "Hombre"], ["mujer", "Mujer"]].map(([k, l]) => <button key={k} onClick={() => set("sexo", k)} className="k-press" style={{ ...chip(f.sexo === k), flex: 1, textAlign: "center" }}>{l}</button>)}</div>
        <Label>Altura</Label>
        <div style={{ ...field, display: "flex", alignItems: "center", gap: 6 }}><input inputMode="numeric" value={f.altura_cm} onChange={e => set("altura_cm", e.target.value.replace(/[^\d]/g, ""))} placeholder="178" style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 16 }} /><span style={{ color: C.sub }}>cm</span></div>
      </div>}

      {step === 1 && <div key="s1" className="k-tab">
        <Label>Qué buscás *</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{OBJETIVOS.map(([k, l]) => <button key={k} onClick={() => setF(prev => ({ ...prev, objetivo: k, tendencia: "" }))} className="k-press" style={chip(f.objetivo === k)}>{l}</button>)}</div>
        {tendencias.length > 0 && <><Label>Con qué intención</Label><div style={{ display: "grid", gap: 8 }}>{tendencias.map(t => <button key={t} onClick={() => set("tendencia", t)} className="k-press" style={{ ...chip(f.tendencia === t), borderRadius: 14, padding: "11px 14px" }}>{t}</button>)}</div></>}
        <Label>Experiencia entrenando</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{[["principiante", "Menos de 1 año"], ["intermedio", "1 a 3 años"], ["avanzado", "Más de 3"]].map(([k, l]) => <button key={k} onClick={() => set("experiencia", k)} className="k-press" style={chip(f.experiencia === k)}>{l}</button>)}</div>
        <Label>Cuántos días por semana querés entrenar</Label>
        <div style={{ display: "flex", gap: 6 }}>{[2, 3, 4, 5, 6].map(n => <button key={n} onClick={() => set("dias_semana", String(n))} className="k-press" style={{ ...chip(f.dias_semana === String(n)), flex: 1, textAlign: "center", padding: "10px 0" }}>{n}</button>)}</div>
      </div>}

      {step === 2 && <div key="s2" className="k-tab">
        <Label>Tipo de alimentación</Label>
        <div style={{ position: "relative" }}>
          <select value={f.base} onChange={e => set("base", e.target.value)} style={{ ...field, appearance: "none", WebkitAppearance: "none", colorScheme: "dark", paddingRight: 40 }}>{DIETAS.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}><Icon d={I.down} size={16} color={C.sub} /></span>
        </div>
        <Label>Ajustes (los que quieras)</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{AJUSTES.map(a => { const on = f.ajustes.includes(a); return <button key={a} onClick={() => setF(prev => ({ ...prev, ajustes: on ? prev.ajustes.filter(x => x !== a) : [...prev.ajustes.filter(x => x !== OPUESTOS[a]), a] }))} className="k-press" style={{ ...chip(on), padding: "8px 13px", fontSize: 13.5 }}>{a}</button>; })}</div>
        <div style={{ ...card, marginTop: 20, fontSize: 13.5, color: C.sub, lineHeight: 1.5 }}>Después, en Perfil, la IA te calcula calorías y macros con todo esto. El peso lo cargás en Inicio cuando quieras.</div>
      </div>}

      <div style={{ display: "flex", gap: 8, marginTop: 28 }}>
        {step > 0 && <button className="k-press" onClick={() => setStep(step - 1)} style={{ ...btnGhost, width: "auto", padding: "14px 18px" }}>Atrás</button>}
        {step < 2 ? <button className="k-press" onClick={next} style={btnLime}>Seguir</button> : <button className="k-press" onClick={finish} disabled={saving} style={btnLime}>{saving ? "Guardando…" : "Empezar a usar Kairo"}</button>}
      </div>
    </div>
  </div>;
}
