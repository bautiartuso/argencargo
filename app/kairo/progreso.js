"use client";
// Kairo · Perfil: logros y fotos de progreso. Los logros se calculan con tus datos (sin IA); las fotos
// quedan guardadas achicadas, privadas, y se comparan la primera contra la última.
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { dq } from "../../lib/sb-client";
import { C, I, Icon, pushToast, Sheet, SectionTitle, Label, card, field, btnLime, btnGhost, linkBtn, today, dayLabel, Skel } from "./ui";
import { shrink } from "./social";

const n1 = (v) => Number(v).toLocaleString("es-AR", { maximumFractionDigits: 1 });
export const weeksStreak = (ws) => {
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  let k = 0;
  for (let i = 0; i < 60; i++) { const s = new Date(mon); s.setDate(s.getDate() - i * 7); const e = new Date(s); e.setDate(e.getDate() + 7); if (ws.some(w => { const d = new Date(w.started_at); return d >= s && d < e; })) k++; else if (i > 0) break; }
  return k;
};

// Cada logro: grupo, id, nombre, cómo se gana, ícono y la regla.
const BADGES = [
  ["Entrenamiento", "primero", "Primer entreno", "Terminá tu primer entreno", I.gym, d => d.ws.length >= 1],
  ["Entrenamiento", "diez", "10 entrenos", "Diez entrenos terminados", I.gym, d => d.ws.length >= 10],
  ["Entrenamiento", "cincuenta", "50 entrenos", "Cincuenta entrenos terminados", I.gym, d => d.ws.length >= 50],
  ["Entrenamiento", "cien", "100 entrenos", "Cien entrenos. Una bestia", I.fire, d => d.ws.length >= 100],
  ["Entrenamiento", "madrugador", "Madrugador", "3 entrenos empezados antes de las 8", I.timer, d => d.ws.filter(w => new Date(w.started_at).getHours() < 8).length >= 3],
  ["Entrenamiento", "nocturno", "Nocturno", "3 entrenos empezados después de las 21", I.timer, d => d.ws.filter(w => new Date(w.started_at).getHours() >= 21).length >= 3],
  ["Constancia", "racha4", "Un mes seguido", "4 semanas seguidas entrenando al menos una vez", I.fire, d => d.streak >= 4],
  ["Constancia", "racha12", "Tres meses seguidos", "12 semanas seguidas entrenando", I.fire, d => d.streak >= 12],
  ["Constancia", "racha26", "Medio año", "26 semanas seguidas entrenando", I.fire, d => d.streak >= 26],
  ["Nutrición", "comida7", "Una semana contando", "7 días con comida cargada", I.food, d => d.foodDays >= 7],
  ["Nutrición", "comida30", "Un mes contando", "30 días con comida cargada", I.food, d => d.foodDays >= 30],
  ["Nutrición", "estrategia", "Con plan", "Calculaste tu estrategia de alimentación", I.spark, d => !!d.profile?.estrategia],
  ["Deporte", "deporte5", "Deportista", "5 sesiones de deporte registradas", I.fire, d => d.cardio >= 5],
  ["Deporte", "deporte25", "Atleta", "25 sesiones de deporte registradas", I.fire, d => d.cardio >= 25],
  ["Perfil", "objetivo", "Con rumbo", "Definiste tu objetivo", I.target, d => !!d.profile?.objetivo],
  ["Perfil", "foto", "Antes y después", "2 fotos de progreso cargadas", I.camera, d => d.photos >= 2],
];

export function Achievements({ profile, ws, foodDays, cardio, photos }) {
  const [open, setOpen] = useState(null);
  const d = { profile, ws, streak: weeksStreak(ws), foodDays, cardio, photos };
  const list = BADGES.map(([group, id, name, how, icon, test]) => ({ group, id, name, how, icon, ok: !!test(d) }));
  const got = list.filter(b => b.ok).length;
  const groups = [...new Set(list.map(b => b.group))];
  return <>
    <SectionTitle right={<span className="k-num" style={{ fontSize: 12, color: C.dim }}>{got} de {list.length}</span>}>Logros</SectionTitle>
    <div style={{ ...card, padding: "4px 12px 14px" }}>
      {groups.map(gName => <div key={gName}>
        <div style={{ fontSize: 12, color: C.sub, margin: "12px 2px 8px", display: "flex", justifyContent: "space-between" }}><span>{gName}</span><span className="k-num" style={{ color: C.dim }}>{list.filter(b => b.group === gName && b.ok).length}/{list.filter(b => b.group === gName).length}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px 6px" }}>
          {list.filter(b => b.group === gName).map(b => <button key={b.id} onClick={() => setOpen(b)} className="k-press" style={{ background: "none", border: "none", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: b.ok ? 1 : 0.4, color: C.text }}>
            <span style={{ width: 48, height: 48, borderRadius: 24, background: b.ok ? "rgba(198,244,50,0.14)" : C.cardHi, border: `1.5px solid ${b.ok ? C.lime : C.line}`, color: b.ok ? C.lime : C.sub, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={b.icon} size={22} sw={1.8} /></span>
            <span style={{ fontSize: 10.5, textAlign: "center", lineHeight: 1.25, color: b.ok ? C.text : C.sub }}>{b.name}</span>
          </button>)}
        </div>
      </div>)}
    </div>
    {open && <Sheet title={open.name} onClose={() => setOpen(null)}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 64, height: 64, borderRadius: 32, background: open.ok ? "rgba(198,244,50,0.14)" : C.cardHi, border: `1.5px solid ${open.ok ? C.lime : C.line}`, color: open.ok ? C.lime : C.sub, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon d={open.icon} size={30} sw={1.8} /></span>
        <span><span style={{ fontSize: 13, color: C.sub, display: "block" }}>{open.group}</span><span style={{ fontSize: 15, fontWeight: 600, color: open.ok ? C.lime : C.text }}>{open.ok ? "Conseguido" : "Todavía no"}</span></span>
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.5, margin: "16px 0 0" }}>{open.how}.</p>
    </Sheet>}
  </>;
}

export function ProgressPhotos({ token, profile }) {
  const [photos, setPhotos] = useState(null);
  const [sheet, setSheet] = useState(null); // {type:"add", file} | {type:"view", p} | {type:"compare"}
  const fileRef = useRef(null);
  const load = useCallback(async () => {
    const r = await dq("kairo_progress_photos", { token, filters: "?select=id,taken_on,thumb,note,peso_kg&order=taken_on.desc,created_at.desc" });
    setPhotos(Array.isArray(r) ? r : []);
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const pick = (file) => { if (file) setSheet({ type: "add", file }); };
  return <>
    <SectionTitle right={<span style={{ display: "flex", gap: 14 }}>{photos?.length >= 2 && <button onClick={() => setSheet({ type: "compare" })} style={linkBtn}>Comparar</button>}<button onClick={() => fileRef.current?.click()} style={linkBtn}>+ Foto</button></span>}>Fotos de progreso</SectionTitle>
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    {!photos ? <Skel h={110} r={20} /> : !photos.length ? <button className="k-press" onClick={() => fileRef.current?.click()} style={{ ...card, width: "100%", textAlign: "left", color: C.text, display: "flex", gap: 12, alignItems: "center" }}>
      <span style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(198,244,50,0.12)", color: C.lime, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon d={I.camera} size={20} /></span>
      <span><span style={{ fontSize: 15, fontWeight: 500, display: "block" }}>Sacate la primera</span><span style={{ fontSize: 13, color: C.sub }}>Misma luz, misma pose, cada 2 semanas. Las ves solo vos.</span></span>
    </button> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
      {photos.map(p => <button key={p.id} onClick={() => setSheet({ type: "view", p })} className="k-press" style={{ position: "relative", aspectRatio: "3 / 4", borderRadius: 14, overflow: "hidden", border: "none", padding: 0, background: C.cardHi }}>
        <img src={p.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 8px 6px", background: "linear-gradient(transparent, rgba(0,0,0,0.7))", color: "#fff", fontSize: 11, textAlign: "left" }}>{p.taken_on.slice(8)}/{p.taken_on.slice(5, 7)}{p.peso_kg ? ` · ${n1(p.peso_kg)} kg` : ""}</span>
      </button>)}
    </div>}
    {sheet?.type === "add" && <AddPhoto token={token} file={sheet.file} peso={profile?.peso_kg} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {sheet?.type === "view" && <ViewPhoto token={token} p={sheet.p} onClose={() => setSheet(null)} onDeleted={() => { setSheet(null); load(); }} />}
    {sheet?.type === "compare" && <Compare token={token} photos={photos} onClose={() => setSheet(null)} />}
  </>;
}

function AddPhoto({ token, file, peso, onClose, onSaved }) {
  const [preview, setPreview] = useState(null);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [kg, setKg] = useState(peso ? String(peso).replace(".", ",") : "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { shrink(file, 1200, 0.85).then(setPreview); }, [file]);
  const save = async () => {
    if (!preview) return;
    setSaving(true);
    const thumb = await shrink(preview, 360, 0.75);
    const r = await dq("kairo_progress_photos", { method: "POST", token, body: { taken_on: date, image: preview, thumb, note: note.trim() || null, peso_kg: Number(String(kg).replace(",", ".")) || null } });
    setSaving(false);
    if (!Array.isArray(r) || !r[0]) return pushToast("No se pudo guardar");
    pushToast("Foto guardada"); onSaved();
  };
  return <Sheet title="Foto de progreso" onClose={onClose} tall>
    <div style={{ borderRadius: 16, overflow: "hidden", background: C.cardHi, aspectRatio: "3 / 4", maxHeight: 360, display: "flex", alignItems: "center", justifyContent: "center" }}>{preview ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Skel h="100%" />}</div>
    <Label>Fecha</Label>
    <input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} style={{ ...field, colorScheme: "dark", WebkitAppearance: "none", appearance: "none", minHeight: 48 }} />
    <Label>Peso ese día (opcional)</Label>
    <div style={{ ...field, display: "flex", alignItems: "center", gap: 6 }}><input inputMode="decimal" value={kg} onChange={e => setKg(e.target.value.replace(/[^0-9.,]/g, ""))} className="k-num" style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 16 }} /><span style={{ color: C.sub }}>kg</span></div>
    <Label>Nota (opcional)</Label>
    <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ej: fin del volumen" style={field} />
    <button className="k-press" onClick={save} disabled={saving || !preview} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Guardando…" : "Guardar"}</button>
  </Sheet>;
}

function ViewPhoto({ token, p, onClose, onDeleted }) {
  const [img, setImg] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { dq("kairo_progress_photos", { token, filters: `?id=eq.${p.id}&select=image` }).then(r => setImg(Array.isArray(r) && r[0] ? r[0].image : p.thumb)); }, [p, token]);
  const del = async () => { await dq("kairo_progress_photos", { method: "DELETE", token, filters: `?id=eq.${p.id}` }); pushToast("Foto eliminada"); onDeleted(); };
  return createPortal(<div style={{ position: "fixed", inset: 0, zIndex: 105, background: "#000", display: "flex", flexDirection: "column" }}>
    <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {img ? <img src={img} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ color: C.sub }}>Cargando…</span>}
      <button onClick={onClose} aria-label="Cerrar" style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 10px)", left: 14, width: 40, height: 40, borderRadius: 20, border: "none", background: "rgba(0,0,0,0.4)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={I.close} size={20} sw={2} /></button>
    </div>
    <div style={{ padding: "12px 16px calc(env(safe-area-inset-bottom) + 16px)", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ flex: 1, color: "#fff" }}><span style={{ fontSize: 15, fontWeight: 600, display: "block" }}>{new Date(p.taken_on + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}</span><span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{[p.peso_kg && `${n1(p.peso_kg)} kg`, p.note].filter(Boolean).join(" · ") || "Sin nota"}</span></span>
      <button onClick={() => confirm ? del() : setConfirm(true)} style={{ background: confirm ? "rgba(255,107,107,0.2)" : "rgba(255,255,255,0.1)", color: confirm ? C.neg : "#fff", border: "none", borderRadius: 999, padding: "10px 14px", fontSize: 13.5, fontWeight: 600 }}>{confirm ? "¿Eliminar?" : "Eliminar"}</button>
    </div>
  </div>, document.querySelector(".k-root") || document.body);
}

// La primera contra la última (o las dos que elijas).
function Compare({ token, photos, onClose }) {
  const sorted = [...photos].sort((a, b) => a.taken_on.localeCompare(b.taken_on));
  const [a, setA] = useState(sorted[0]), [b, setB] = useState(sorted[sorted.length - 1]);
  const [imgs, setImgs] = useState({});
  useEffect(() => {
    for (const p of [a, b]) if (p && !imgs[p.id]) dq("kairo_progress_photos", { token, filters: `?id=eq.${p.id}&select=image` }).then(r => setImgs(x => ({ ...x, [p.id]: Array.isArray(r) && r[0] ? r[0].image : p.thumb })));
  }, [a, b]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = Math.round((new Date(b.taken_on) - new Date(a.taken_on)) / 86400e3);
  const dk = a.peso_kg && b.peso_kg ? Number(b.peso_kg) - Number(a.peso_kg) : null;
  const Side = ({ p, onPick }) => <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ borderRadius: 14, overflow: "hidden", background: C.cardHi, aspectRatio: "3 / 4" }}>{imgs[p.id] ? <img src={imgs[p.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Skel h="100%" r={0} />}</div>
    <select value={p.id} onChange={e => onPick(sorted.find(x => x.id === e.target.value))} style={{ ...field, marginTop: 8, padding: "9px 10px", fontSize: 13, colorScheme: "dark" }}>
      {sorted.map(x => <option key={x.id} value={x.id}>{x.taken_on.slice(8)}/{x.taken_on.slice(5, 7)}/{x.taken_on.slice(2, 4)}{x.peso_kg ? ` · ${n1(x.peso_kg)} kg` : ""}</option>)}
    </select>
  </div>;
  return <Sheet title="Antes y después" onClose={onClose} tall>
    <div style={{ display: "flex", gap: 8 }}><Side p={a} onPick={setA} /><Side p={b} onPick={setB} /></div>
    <div style={{ ...card, marginTop: 12, textAlign: "center", fontSize: 14 }}>
      <span className="k-num" style={{ fontSize: 22, fontWeight: 600, display: "block" }}>{days} días</span>
      <span style={{ color: C.sub }}>{dk != null ? `${dk > 0 ? "+" : ""}${n1(dk)} kg entre una y otra` : "Cargá el peso en cada foto para ver la diferencia"}</span>
    </div>
  </Sheet>;
}
