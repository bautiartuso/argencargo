"use client";
// Kairo · social. Historias de 24 h (tipo Instagram: al terminar un entreno o cuando quieras) y el
// perfil de cada usuario (foto, objetivo, cómo viene y sus últimos entrenos).
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { dq, loadSession } from "../../lib/sb-client";
import { C, I, Icon, pushToast, Sheet, SectionTitle, MiniStat, card, dayLabel, ymd } from "./ui";

const SEEN_KEY = "kairo_stories_seen";
const STORY_MS = 5000;
const seenSet = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { return new Set(); } };
const markSeen = (id) => { try { const s = seenSet(); s.add(id); localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-400))); } catch {} };
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 60 ? `${Math.max(1, m)} min` : `${Math.round(m / 60)} h`; };

// Achica la foto manteniendo la proporción (lado mayor `max`), en jpg. src: File o data URL.
export function shrink(src, max, q = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      if (typeof src !== "string") URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.onerror = reject; img.src = typeof src === "string" ? src : URL.createObjectURL(src);
  });
}

export async function postStory(token, src, caption) {
  const [image, thumb] = await Promise.all([shrink(src, 1350), shrink(src, 220, 0.7)]);
  const r = await dq("kairo_stories", { method: "POST", token, body: { image, thumb, caption: caption || null } });
  if (!Array.isArray(r) || !r[0]) { pushToast("No se pudo subir la historia"); return false; }
  pushToast("Historia subida");
  window.dispatchEvent(new Event("kairo-stories"));
  return true;
}

// Botón que abre la cámara de Kairo y sube la historia. Solo fotos del momento: no hay galería.
export function StoryPicker({ token, caption, children, onDone, style }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async (src) => { setOpen(false); setBusy(true); const ok = await postStory(token, src, caption); setBusy(false); if (ok) onDone?.(); };
  return <>
    <button onClick={() => setOpen(true)} disabled={busy} className="k-press" style={style}>{busy ? "Subiendo…" : children}</button>
    {open && createPortal(<Camera caption={caption} onShot={send} onClose={() => setOpen(false)} />, document.querySelector(".k-root") || document.body)}
  </>;
}

// Cámara a pantalla completa. Sin espejo en ningún momento: lo que ves al sacar la foto (también la
// selfie) es exactamente lo que se sube. Si el navegador no da acceso a la cámara, abre la
// del sistema (también solo cámara, sin galería).
function Camera({ caption, onShot, onClose }) {
  const video = useRef(null), stream = useRef(null), fallback = useRef(null);
  const [facing, setFacing] = useState("environment");
  const [shot, setShot] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        stream.current?.getTracks().forEach(t => t.stop());
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false });
        if (!alive) { st.getTracks().forEach(t => t.stop()); return; }
        stream.current = st;
        if (video.current) { video.current.srcObject = st; await video.current.play().catch(() => {}); }
        setErr("");
      } catch { if (alive) setErr("nocam"); }
    })();
    return () => { alive = false; };
  }, [facing]);
  useEffect(() => () => stream.current?.getTracks().forEach(t => t.stop()), []);
  const take = () => {
    const v = video.current; if (!v?.videoWidth) return;
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    setShot(c.toDataURL("image/jpeg", 0.9));
  };
  const btn = { width: 46, height: 46, borderRadius: 23, border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 };
  return <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "#000", display: "flex", flexDirection: "column" }}>
    <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {shot ? <img src={shot} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        : err ? <div style={{ color: "#fff", textAlign: "center", padding: 24, fontSize: 15, lineHeight: 1.5 }}>No pudimos abrir la cámara dentro de Kairo.<br /><button onClick={() => fallback.current?.click()} style={{ marginTop: 16, background: C.lime, color: C.limeInk, border: "none", borderRadius: 14, padding: "12px 20px", fontSize: 15, fontWeight: 600 }}>Abrir la cámara del celular</button></div>
        : <video ref={video} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      <input ref={fallback} type="file" accept="image/*" capture="environment" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setShot(await shrink(f, 1920, 0.9)); }} />
      <button onClick={onClose} aria-label="Cerrar cámara" style={{ ...btn, position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)", left: 14 }}>×</button>
      {caption && <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, textAlign: "center", color: "#fff", fontSize: 14, fontWeight: 500, textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>{caption}</div>}
    </div>
    <div style={{ padding: "18px 24px calc(env(safe-area-inset-bottom) + 22px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {shot ? <>
        <button onClick={() => setShot(null)} style={{ ...btn, width: "auto", padding: "0 18px", borderRadius: 23, fontSize: 15 }}>Repetir</button>
        <button onClick={() => { stream.current?.getTracks().forEach(t => t.stop()); onShot(shot); }} style={{ ...btn, width: "auto", padding: "0 22px", borderRadius: 23, background: C.lime, color: C.limeInk, fontSize: 15, fontWeight: 600 }}>Subir historia</button>
      </> : <>
        <span style={{ width: 46 }} />
        <button onClick={take} disabled={!!err} aria-label="Sacar foto" style={{ width: 74, height: 74, borderRadius: 37, border: "4px solid #fff", background: "transparent", padding: 4 }}><span style={{ display: "block", width: "100%", height: "100%", borderRadius: "50%", background: "#fff" }} /></button>
        <button onClick={() => setFacing(facing === "user" ? "environment" : "user")} disabled={!!err} aria-label="Dar vuelta la cámara" style={btn}>⟲</button>
      </>}
    </div>
  </div>;
}

// Fila de historias de Inicio: la tuya primero (con + para subir), después las de tus amigos.
export function StoriesBar({ token, me, users = [], stories = [] }) {
  const [viewer, setViewer] = useState(null);
  const [seen, setSeen] = useState(() => seenSet());
  const myId = loadSession()?.user?.id;
  const byUser = [];
  for (const s of stories) { let g = byUser.find(x => x.user_id === s.user_id); if (!g) { g = { user_id: s.user_id, items: [] }; byUser.push(g); } g.items.push(s); }
  const info = (id) => users.find(u => u.id === id) || (id === myId ? { nombre: me?.nombre, avatar: me?.avatar } : { nombre: "" });
  const mine = byUser.find(g => g.user_id === myId);
  const others = byUser.filter(g => g.user_id !== myId).sort((a, b) => Number(a.items.every(s => seen.has(s.id))) - Number(b.items.every(s => seen.has(s.id))));
  const groups = [...(mine ? [mine] : []), ...others];
  // El visor recibe una copia fija del orden: si no, al marcar vistas se reordena la fila y saltea gente.
  const open = (g) => setViewer({ groups: groups.slice(), index: groups.indexOf(g) });

  return <>
    <div style={{ display: "flex", gap: 14, overflowX: "auto", margin: "0 -16px 6px", padding: "2px 16px 8px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, position: "relative" }}>
        {mine ? <Bubble src={me?.avatar} ring={mine.items.some(s => !seen.has(s.id)) ? C.lime : C.line} onClick={() => open(mine)} /> : <StoryPicker token={token} caption="" style={{ background: "none", border: "none", padding: 0 }}><Bubble src={me?.avatar} ring={C.line} /></StoryPicker>}
        <span style={{ position: "absolute", top: 42, left: 42, width: 22, height: 22, display: "flex" }}><StoryPicker token={token} caption="" style={{ width: 22, height: 22, minHeight: 22, boxSizing: "border-box", borderRadius: 11, border: `2px solid ${C.bg}`, background: C.lime, color: C.limeInk, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 0, fontSize: 0 }}><Icon d={I.plus} size={12} sw={3} /></StoryPicker></span>
        <span style={{ fontSize: 11.5, color: C.sub, whiteSpace: "nowrap" }}>Tu historia</span>
      </div>
      {others.map(g => { const u = info(g.user_id), unseen = g.items.some(s => !seen.has(s.id)); return <button key={g.user_id} onClick={() => open(g)} style={{ background: "none", border: "none", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, color: C.text }}>
        <Bubble src={u.avatar} ring={unseen ? C.lime : C.line} />
        <span style={{ fontSize: 11.5, color: unseen ? C.text : C.sub, maxWidth: 66, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(u.nombre || "").split(" ")[0]}</span>
      </button>; })}
    </div>
    {viewer && <StoryViewer token={token} groups={viewer.groups} start={viewer.index} info={info} myId={myId} onSeen={(id) => { markSeen(id); setSeen(seenSet()); }} onClose={() => setViewer(null)} />}
  </>;
}

function Bubble({ src, ring, onClick }) {
  const inner = <span style={{ width: 62, height: 62, borderRadius: 31, padding: 2.5, background: ring, display: "flex" }}>
    <span style={{ width: "100%", height: "100%", borderRadius: "50%", border: `2.5px solid ${C.bg}`, overflow: "hidden", background: C.cardHi, display: "flex", alignItems: "center", justifyContent: "center", color: C.sub }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon d={I.user} size={26} />}
    </span>
  </span>;
  return onClick ? <button onClick={onClick} style={{ background: "none", border: "none", padding: 0 }}>{inner}</button> : inner;
}

// Visor a pantalla completa: tocá a la derecha para avanzar, a la izquierda para volver.
function StoryViewer({ token, groups, start, info, myId, onSeen, onClose }) {
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(() => Math.max(0, groups[start].items.findIndex(s => !seenSet().has(s.id))));
  const [img, setImg] = useState(null);
  const [t0, setT0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [confirmDel, setConfirmDel] = useState(false);
  const g = groups[gi], s = g?.items[si], u = g ? info(g.user_id) : {};

  useEffect(() => {
    if (!s) return;
    setImg(null); setConfirmDel(false); onSeen(s.id);
    dq("kairo_stories", { token, filters: `?id=eq.${s.id}&select=image` }).then(r => { setImg(Array.isArray(r) && r[0] ? r[0].image : s.thumb); setT0(Date.now()); });
  }, [gi, si]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, []);
  const next = useCallback(() => { if (si < g.items.length - 1) setSi(si + 1); else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); } else onClose(); }, [si, gi, g, groups, onClose]);
  const prev = () => { if (si > 0) setSi(si - 1); else if (gi > 0) { setGi(gi - 1); setSi(groups[gi - 1].items.length - 1); } };
  useEffect(() => { if (img && !confirmDel && now - t0 >= STORY_MS) next(); }, [now]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return null;
  const pct = img ? Math.min(1, (now - t0) / STORY_MS) : 0;
  const del = async () => { await dq("kairo_stories", { method: "DELETE", token, filters: `?id=eq.${s.id}` }); pushToast("Historia eliminada"); window.dispatchEvent(new Event("kairo-stories")); onClose(); };

  return <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "#000", display: "flex", flexDirection: "column" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "calc(env(safe-area-inset-top) + 10px) 12px 0", zIndex: 2, background: "linear-gradient(rgba(0,0,0,0.55), transparent)" }}>
      <div style={{ display: "flex", gap: 4 }}>{g.items.map((x, k) => <span key={x.id} style={{ flex: 1, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", background: "#fff", width: `${k < si ? 100 : k === si ? pct * 100 : 0}%` }} /></span>)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, paddingBottom: 14 }}>
        <span style={{ width: 34, height: 34, borderRadius: 17, overflow: "hidden", background: C.cardHi, display: "flex", alignItems: "center", justifyContent: "center", color: C.sub }}>{u.avatar ? <img src={u.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon d={I.user} size={16} />}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{g.user_id === myId ? "Tu historia" : u.nombre}</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{ago(s.created_at)}</span>
        <span style={{ flex: 1 }} />
        {g.user_id === myId && <button onClick={() => confirmDel ? del() : setConfirmDel(true)} style={{ background: "none", border: "none", color: confirmDel ? C.danger : "#fff", fontSize: 13, padding: 6 }}>{confirmDel ? "¿Borrar?" : "Borrar"}</button>}
        <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", color: "#fff", fontSize: 26, lineHeight: 1, padding: "0 4px" }}>×</button>
      </div>
    </div>
    <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {img ? <img src={img} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Cargando…</span>}
      <button onClick={prev} aria-label="Anterior" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "35%", background: "none", border: "none" }} />
      <button onClick={next} aria-label="Siguiente" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "65%", background: "none", border: "none" }} />
    </div>
    {s.caption && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "40px 18px calc(env(safe-area-inset-bottom) + 22px)", background: "linear-gradient(transparent, rgba(0,0,0,0.7))", color: "#fff", fontSize: 15, fontWeight: 500, textAlign: "center", pointerEvents: "none" }}>{s.caption}</div>}
  </div>;
}

// Perfil de otro usuario (o el tuyo visto como lo ven los demás).
const ESTADO = { en_camino: ["Va bien", C.pos], lento: ["Avance lento", C.warn], desviado: ["Fuera de rumbo", C.neg], sin_datos: ["Sin datos todavía", C.sub] };
export function UserProfile({ token, id, onClose }) {
  const [p, setP] = useState(null);
  useEffect(() => {
    fetch(`/api/kairo/social?user=${id}`, { headers: { Authorization: `Bearer ${loadSession()?.token || token}` } }).then(r => r.json()).then(r => setP(r.profile || { error: true })).catch(() => setP({ error: true }));
  }, [id, token]);
  return <Sheet title={p?.nombre || "Perfil"} onClose={onClose}>
    {!p ? <p style={{ color: C.sub, fontSize: 14 }}>Cargando…</p> : p.error ? <p style={{ color: C.sub, fontSize: 14 }}>No se pudo cargar.</p> : <>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ width: 76, height: 76, borderRadius: 38, overflow: "hidden", background: C.cardHi, display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, border: `2px solid ${C.lime}`, flexShrink: 0 }}>{p.avatar ? <img src={p.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon d={I.user} size={30} />}</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{p.objetivo || "Sin objetivo cargado"}</div>
          {p.tendencia && <div style={{ fontSize: 14, color: C.lime, marginTop: 2 }}>{p.tendencia}</div>}
        </div>
      </div>
      {p.objetivo_detalle && <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.45, margin: "12px 0 0" }}>"{p.objetivo_detalle}"</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        <MiniStat label="Entrenos este mes" value={p.entrenos_mes} />
        <MiniStat label="Racha" value={`${p.racha_semanas} sem`} color={p.racha_semanas ? C.lime : undefined} />
      </div>
      {p.progreso && <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: C.cardHi }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: ESTADO[p.progreso.estado]?.[1] || C.sub }}>{ESTADO[p.progreso.estado]?.[0] || "Progreso"}</div>
        <div style={{ fontSize: 13.5, color: C.sub, marginTop: 4, lineHeight: 1.45 }}>{p.progreso.lectura}</div>
      </div>}
      <SectionTitle>Últimos entrenos</SectionTitle>
      {!p.ultimos.length ? <div style={{ ...card, color: C.sub, fontSize: 14 }}>Todavía no entrenó.</div> :
        <div style={{ ...card, padding: "2px 16px" }}>{p.ultimos.map((w, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "11px 0", borderBottom: i < p.ultimos.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <div><div style={{ fontSize: 15 }}>{w.rutina}</div><div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{dayLabel(ymd(new Date(w.fecha)))} · {w.minutos} min · {w.series} series</div></div>
          <span className="k-num" style={{ fontSize: 13.5, color: C.sub, whiteSpace: "nowrap" }}>{w.volumen.toLocaleString("es-AR")} kg</span>
        </div>)}</div>}
    </>}
  </Sheet>;
}
