"use client";
// Kairo · Perfil. El centro de la app: foto, objetivo (gym + nutrición) con matices, la estrategia
// que arma la IA, peso y medidas cuando quieras (y si venís progresando), y tus reglas para la IA.
import { useState, useEffect, useCallback, useRef } from "react";
import { dq, loadSession } from "../../lib/sb-client";
import { C, I, Icon, pushToast, Sheet, SectionTitle, Label, MiniStat, card, field, btnLime, btnGhost, linkBtn, dayLabel, today } from "./ui";

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

export default function Perfil({ token, isAdmin }) {
  const [p, setP] = useState(undefined);
  const [sheet, setSheet] = useState(null);
  const [thinking, setThinking] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const [pr] = await Promise.all([
      dq("kairo_profile", { token, filters: "?select=*&limit=1" }),
    ]);
    setP(Array.isArray(pr) ? pr[0] || null : null);
  }, [token]);
  useEffect(() => { load(); }, [load]);

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

  if (p === undefined) return <p style={{ color: C.sub, textAlign: "center", padding: "60px 0" }}>Cargando…</p>;
  const st = p?.estrategia;

  return <>
    {/* Encabezado */}
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 2px 0" }}>
      <button onClick={() => fileRef.current?.click()} aria-label="Cambiar foto de perfil" className="k-press" style={{ width: 76, height: 76, borderRadius: 38, border: `2px solid ${C.lime}`, padding: 2, background: "none", flexShrink: 0 }}>
        <span style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: C.cardHi, color: C.sub }}>
          {p?.avatar ? <img src={p.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: C.lime }}><Icon d={I.plus} size={20} sw={2.2} /><span style={{ fontSize: 9.5, fontWeight: 600, lineHeight: 1.1, textAlign: "center" }}>Cargá tu<br />foto</span></span>}
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => pickPhoto(e.target.files?.[0])} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{p?.nombre || "Tu perfil"}</div>
        {!p?.nombre && <button onClick={() => setSheet("objetivo")} style={{ ...linkBtn, fontSize: 13 }}>Poné tu nombre</button>}
        <div style={{ fontSize: 14, color: C.sub, marginTop: 2 }}>{p?.objetivo ? `${OBJ_LABEL[p.objetivo]}${p.tendencia ? ` · ${p.tendencia.split(":")[0].toLowerCase()}` : ""}` : "Definí tu objetivo"}</div>
      </div>
    </div>

    {/* Objetivo */}
    <SectionTitle right={<button onClick={() => setSheet("objetivo")} style={linkBtn}>Editar</button>}>Tu objetivo</SectionTitle>
    {!p?.objetivo ? <button className="k-press" onClick={() => setSheet("objetivo")} style={{ ...card, width: "100%", textAlign: "left", color: C.text, borderColor: "rgba(198,244,50,0.3)" }}>
      <div style={{ fontSize: 16, fontWeight: 500 }}>Contale a Kairo qué buscás</div>
      <div style={{ fontSize: 13, color: C.sub, marginTop: 4, lineHeight: 1.45 }}>Con tu objetivo y tus datos, la IA arma tu estrategia de entrenamiento y alimentación.</div>
    </button> : <button className="k-press" onClick={() => setSheet("objetivo")} style={{ ...card, width: "100%", textAlign: "left", color: C.text }}>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{OBJ_LABEL[p.objetivo]}</div>
      {p.tendencia && <div style={{ fontSize: 14, color: C.lime, marginTop: 2 }}>{p.tendencia}</div>}
      {p.objetivo_detalle && <div style={{ fontSize: 13, color: C.sub, marginTop: 8, lineHeight: 1.45 }}>"{p.objetivo_detalle}"</div>}
      <div style={{ fontSize: 12, color: C.dim, marginTop: 10 }}>{[p.sexo, (p.fecha_nacimiento || p.edad) && `${ageOf(p.fecha_nacimiento) ?? p.edad} años`, p.altura_cm && `${n1(p.altura_cm)} cm`, p.peso_kg && `${n1(p.peso_kg)} kg`, p.experiencia].filter(Boolean).join(" · ")}</div>
    </button>}

    {/* Estrategia de la IA */}
    {p?.objetivo && <>
      <SectionTitle right={<button onClick={askStrategy} disabled={thinking} style={linkBtn}>{thinking ? "Pensando…" : st ? "Actualizar" : ""}</button>}>Tu estrategia de alimentación</SectionTitle>
      {!st ? <button className="k-press" onClick={askStrategy} disabled={thinking} style={{ ...btnLime, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Icon d={I.spark} size={18} />{thinking ? "La IA está calculando tus calorías y macros…" : "Calcular calorías y macros con IA"}
      </button> : <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <div><span className="k-num" style={{ fontSize: 30, fontWeight: 500, color: C.lime }}>{st.calorias_dia.toLocaleString("es-AR")}</span><span style={{ color: C.sub }}> kcal/día</span></div>
          <span className="k-num" style={{ fontSize: 13, color: C.sub }}>{st.ritmo_peso_semanal_kg > 0 ? "+" : ""}{Number(st.ritmo_peso_semanal_kg).toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg/sem</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <MiniStat label="Proteína" value={`${st.proteina_g} g`} />
          {st.carbohidratos_g != null && <MiniStat label="Carbohidratos" value={`${st.carbohidratos_g} g`} />}
          {st.grasas_g != null && <MiniStat label="Grasas" value={`${st.grasas_g} g`} />}
          
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.5, margin: "14px 0 0" }}>{st.resumen}</p>
        {st.progreso && <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: C.cardHi }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: ESTADO[st.progreso.estado]?.[1] || C.sub }}>{ESTADO[st.progreso.estado]?.[0] || "Progreso"}</div>
          <div style={{ fontSize: 13.5, color: C.sub, marginTop: 4, lineHeight: 1.45 }}>{st.progreso.lectura}</div>
        </div>}
        <Pautas st={st} />
        {p.estrategia_at && <div style={{ fontSize: 11.5, color: C.dim, marginTop: 12 }}>Actualizada {dayLabel(p.estrategia_at.slice(0, 10))}. Actualizala cuando registres medidas nuevas.</div>}
      </div>}
    </>}

    {/* Reglas para la IA */}
    <SectionTitle right={<button onClick={() => setSheet("reglas")} style={linkBtn}>Editar</button>}>Reglas para la IA</SectionTitle>
    <button className="k-press" onClick={() => setSheet("reglas")} style={{ ...card, width: "100%", textAlign: "left", color: C.text, display: "grid", gap: 10 }}>
      <Rule label="Entrenamiento" text={p?.reglas_gym} placeholder="Ej: priorizo máquinas antes que peso libre" />
      <Rule label="Alimentación" text={p?.reglas_nutricion} placeholder="Ej: comidas simples, pollo a la plancha y listo" />
    </button>

    {sheet === "objetivo" && <ObjectiveSheet token={token} p={p} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {sheet === "reglas" && <RulesSheet token={token} p={p} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {isAdmin && <Users token={token} />}
  </>;
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

const Rule = ({ label, text, placeholder }) => <div>
  <div style={{ fontSize: 12, color: C.sub }}>{label}</div>
  <div style={{ fontSize: 14, marginTop: 2, color: text ? C.text : C.dim, lineHeight: 1.45 }}>{text || placeholder}</div>
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

const chip = (on) => ({ padding: "9px 14px", borderRadius: 999, fontSize: 14, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.cardHi, color: on ? C.limeInk : C.text, fontWeight: on ? 600 : 400, textAlign: "left" });

function ObjectiveSheet({ token, p, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ nombre: "", objetivo: "", tendencia: "", objetivo_detalle: "", experiencia: "", sexo: "", fecha_nacimiento: "", altura_cm: "", dias_semana: "", lesiones: "", ...(p || {}) }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF({ ...f, [k]: v });
  const tendencias = OBJETIVOS.find(([k]) => k === f.objetivo)?.[2] || [];
  const save = async () => {
    if (!f.nombre?.trim()) return pushToast("Poné tu nombre");
    setSaving(true);
    await saveProfile(token, { nombre: f.nombre?.trim() || null, objetivo: f.objetivo || null, tendencia: f.tendencia || null, objetivo_detalle: f.objetivo_detalle?.trim() || null, experiencia: f.experiencia || null, sexo: f.sexo || null, fecha_nacimiento: f.fecha_nacimiento || null, edad: ageOf(f.fecha_nacimiento), altura_cm: num(f.altura_cm) || null, lesiones: f.lesiones?.trim() || null, updated_at: new Date().toISOString() });
    setSaving(false); pushToast("Objetivo guardado"); onSaved();
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
export function Welcome({ token, onDone }) {
  const [nombre, setNombre] = useState("");
  const [nac, setNac] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const save = async () => {
    if (!nombre.trim()) return pushToast("Poné tu nombre");
    setSaving(true);
    await saveProfile(token, { nombre: nombre.trim(), fecha_nacimiento: nac || null, edad: ageOf(nac), avatar, updated_at: new Date().toISOString() });
    setSaving(false); onDone();
  };
  return <div style={{ position: "fixed", inset: 0, zIndex: 80, background: C.bg, overflowY: "auto" }}>
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "calc(env(safe-area-inset-top) + 48px) 24px 40px" }}>
      <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em" }}>Bienvenido a kairo<span style={{ color: C.lime }}>.</span></div>
      <p style={{ color: C.sub, fontSize: 15, lineHeight: 1.5, margin: "8px 0 28px" }}>Contanos cómo te llamás. Lo demás (objetivo, rutinas, comidas) lo vas completando cuando quieras.</p>
      <button onClick={() => fileRef.current?.click()} className="k-press" style={{ width: 96, height: 96, borderRadius: 48, border: `2px solid ${C.lime}`, padding: 3, background: "none", display: "block", margin: "0 auto" }}>
        <span style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: C.cardHi, color: C.lime }}>
          {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}><Icon d={I.plus} size={22} sw={2.2} /><span style={{ fontSize: 11, fontWeight: 600 }}>Tu foto</span></span>}
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setAvatar(await resizeImage(f, 256)); }} />
      <Label>Tu nombre *</Label>
      <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Cómo te llamás" style={field} />
      <Label>Fecha de nacimiento (opcional)</Label>
      <input type="date" value={nac} onChange={e => setNac(e.target.value)} style={{ ...field, colorScheme: "dark", minHeight: 48, WebkitAppearance: "none", appearance: "none" }} />
      <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 26 }}>{saving ? "Guardando…" : "Empezar"}</button>
    </div>
  </div>;
}
