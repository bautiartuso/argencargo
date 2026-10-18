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
  // Les llega un aviso a los demás: "Turi subió una historia".
  fetch("/api/kairo/social", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${loadSession()?.token || token}` }, body: JSON.stringify({ action: "posted" }) }).catch(() => {});
  return true;
}

// Botón que abre la cámara de Kairo y sube la historia. Solo fotos del momento: no hay galería.
export function StoryPicker({ token, caption, avatar, children, onDone, style }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async (src, text) => { setOpen(false); setBusy(true); const ok = await postStory(token, src, text); setBusy(false); if (ok) onDone?.(); };
  return <>
    <button onClick={() => setOpen(true)} disabled={busy} className="k-press" style={style}>{busy ? "Subiendo…" : children}</button>
    {open && createPortal(<Camera caption={caption} avatar={avatar} onShot={send} onClose={() => setOpen(false)} />, document.querySelector(".k-root") || document.body)}
  </>;
}

const glass = { border: "none", background: "rgba(0,0,0,0.38)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" };
const round = (n) => ({ ...glass, width: n, height: n, borderRadius: n / 2, padding: 0 });

// Cámara a pantalla completa, como la de Instagram: la frontal se ve como un espejo (levantás la mano
// derecha y se mueve la del lado derecho) y la foto sale igual a lo que viste. Se recorta al mismo
// encuadre de la pantalla, así lo que subís es exactamente lo que estabas viendo.
// Zoom con dos dedos (o tocando el "1,0×") en las dos cámaras: usa el zoom óptico del celular si el
// navegador lo deja, y si no, acerca la imagen y recorta la foto igual a lo que ves. Para el 0,5× pasa
// a la cámara ultra gran angular de ese lado si el celu la tiene (o usa el zoom nativo si llega solo).
// Flash: la linterna si el navegador la deja manejar; si no (o en la frontal), la pantalla se pone
// blanca un instante al sacar la foto, como hace Instagram.
function Camera({ caption, avatar, onShot, onClose }) {
  const video = useRef(null), frame = useRef(null), stream = useRef(null), fallback = useRef(null);
  const native = useRef(null), ptrs = useRef(new Map()), pinch = useRef(null), zoomRef = useRef(1);
  const [facing, setFacing] = useState("environment");
  const [zoom, setZoom] = useState(1);
  const [ultras, setUltras] = useState({}); // deviceId de la ultra gran angular de cada lado, si existe
  const [dev, setDev] = useState(null);     // cámara usada cuando no es la principal (la ultra)
  const [noHalf, setNoHalf] = useState({});  // lados donde comprobamos que el 0,5× no funciona
  const [, tick] = useState(0);
  const [flash, setFlash] = useState(false);
  const [white, setWhite] = useState(false); // pantalla blanca: flash de la frontal
  const torch = useRef(false), flashRef = useRef(false); // linterna disponible / flash elegido
  flashRef.current = flash;
  const ultra = ultras[facing] || null;
  const factor = dev ? 0.5 : 1;             // cuánto vale el "1" de la cámara en uso
  const [shot, setShot] = useState(null);
  const [text, setText] = useState(caption || "");
  const [editing, setEditing] = useState(false);
  const [fx, setFx] = useState(false);
  const [err, setErr] = useState("");
  const selfie = facing === "user";
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        stream.current?.getTracks().forEach(t => t.stop());
        const size = { width: { ideal: 1920 }, height: { ideal: 1920 } };
        const st = await navigator.mediaDevices.getUserMedia({ video: dev ? { deviceId: { exact: dev }, ...size } : { facingMode: facing, ...size }, audio: false });
        if (!alive) { st.getTracks().forEach(t => t.stop()); return; }
        stream.current = st; native.current = null;
        try {
          const track = st.getVideoTracks()[0], caps = track.getCapabilities?.();
          // El "1" de la cámara es el zoom 1 real (no el que quedó de la vez anterior, que a veces iOS recuerda).
          if (caps?.zoom && caps.zoom.max > caps.zoom.min) {
            const base = Math.min(Math.max(1, caps.zoom.min), caps.zoom.max);
            native.current = { track, base, min: caps.zoom.min / base, max: caps.zoom.max / base };
            const f = dev ? 0.5 : 1;
            track.applyConstraints({ advanced: [{ zoom: base * (zoomRef.current / f) }] }).catch(() => {});
          }
          torch.current = !!caps?.torch;
          if (torch.current && flashRef.current) track.applyConstraints({ advanced: [{ torch: true }] }).catch(() => {});
          // Con el permiso dado ya se ven los nombres de las cámaras: buscamos la ultra gran angular de cada lado.
          if (!dev) navigator.mediaDevices.enumerateDevices?.().then(ds => {
            const front = (d) => /front|frontal|delantera|facetime/i.test(d.label);
            const cams = ds.filter(d => d.kind === "videoinput" && /ultra/i.test(d.label));
            const u = { user: cams.find(front)?.deviceId, environment: cams.find(d => !front(d))?.deviceId };
            if (alive) setUltras(u);
          }).catch(() => {});
        } catch {}
        if (video.current) { video.current.srcObject = st; await video.current.play().catch(() => {}); }
        setErr("");
      } catch { if (alive) { if (dev) setDev(null); else setErr("nocam"); } }
    })();
    return () => { alive = false; };
  }, [facing, dev]);
  // Aplica el zoom nativo y comprueba que la cámara lo haya tomado (Safari a veces lo ignora en silencio).
  const applyZoom = (track, value) => {
    const target = Math.round(value * 100) / 100;
    const check = () => {
      const got = track.getSettings?.().zoom;
      if (got > 0 && Math.abs(got - target) <= 0.06) return;
      const n = native.current; if (!n || n.track !== track) return;
      if (target < n.base) {
        if (ultra && !dev) setDev(ultra); // hay una ultra gran angular aparte: vamos por ahí
        else { setNoHalf(h => ({ ...h, [facing]: true })); zoomRef.current = 1; setZoom(1); track.applyConstraints({ advanced: [{ zoom: n.base }] }).catch(() => {}); pushToast("Esta cámara no llega a 0,5× desde Safari"); }
      } else { native.current = null; tick(t => t + 1); } // acercar: lo hacemos agrandando la imagen
    };
    track.applyConstraints({ advanced: [{ zoom: target }] }).then(() => setTimeout(check, 200))
      .catch(() => track.applyConstraints({ zoom: target }).then(() => setTimeout(check, 200)).catch(check));
  };
  useEffect(() => () => stream.current?.getTracks().forEach(t => t.stop()), []);
  const nativeWide = native.current?.min < 1 && !dev && !noHalf[facing]; // la cámara principal ya llega sola al 0,5×
  const canHalf = !noHalf[facing] && (nativeWide || !!ultra);
  const setZ = (z) => {
    const n = native.current;
    const lo = nativeWide ? Math.max(0.5, n.min) : canHalf ? 0.5 : 1, hi = (n ? Math.min(6, n.max) : 4) * factor;
    z = Math.round(Math.max(lo, Math.min(hi, z)) * 20) / 20;
    zoomRef.current = z; setZoom(z);
    if (!nativeWide && ultra) {
      if (!dev && z < 1) return setDev(ultra); // pasa a la ultra gran angular
      if (dev && z >= 1) return setDev(null);  // vuelve a la principal
    }
    if (n) applyZoom(n.track, n.base * (z / factor));
  };
  const flip = () => { setDev(null); zoomRef.current = 1; setZoom(1); setFacing(selfie ? "environment" : "user"); };
  const toggleFlash = () => {
    const on = !flash; setFlash(on);
    if (torch.current) stream.current?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ torch: on }] }).catch(() => { torch.current = false; });
  };
  const digital = !native.current; // sin zoom óptico, se agranda la imagen y se recorta la foto
  const onPD = (e) => { if (shot) return; ptrs.current.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoom }; } };
  const onPM = (e) => { if (!ptrs.current.has(e.pointerId)) return; ptrs.current.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.current.size === 2 && pinch.current) { const [a, b] = [...ptrs.current.values()]; setZ(pinch.current.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.current.d); } };
  const onPU = (e) => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinch.current = null; };
  const take = async () => {
    const v = video.current, box = frame.current?.getBoundingClientRect(); if (!v?.videoWidth || !box) return;
    const screenFlash = flash && !torch.current; // sin linterna: la pantalla ilumina
    if (screenFlash) { setWhite(true); await new Promise(r => setTimeout(r, 450)); }
    // Parte del video que se ve en pantalla (object-fit: cover, más el zoom digital si lo hay).
    const k = Math.max(box.width / v.videoWidth, box.height / v.videoHeight), z = digital ? zoom / factor : 1;
    const sw = box.width / k / z, sh = box.height / k / z, sx = (v.videoWidth - sw) / 2, sy = (v.videoHeight - sh) / 2;
    const c = document.createElement("canvas"); c.width = Math.round(box.width / k); c.height = Math.round(box.height / k);
    const ctx = c.getContext("2d");
    if (selfie) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    setShot(c.toDataURL("image/jpeg", 0.9));
    if (screenFlash) setTimeout(() => setWhite(false), 120); else { setFx(true); setTimeout(() => setFx(false), 160); }
  };
  const top = "calc(env(safe-area-inset-top) + 10px)";
  return <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "#000", display: "flex", flexDirection: "column" }}>
    {white && <div style={{ position: "absolute", inset: 0, background: "#fff", zIndex: 5 }} />}
    <div ref={frame} onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU} onWheel={e => !shot && setZ(zoom - e.deltaY / 400)} style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: "0 0 22px 22px", background: "#0a0a0a", touchAction: "none" }}>
      {shot ? <img src={shot} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        : err ? <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", textAlign: "center", padding: 24, fontSize: 15, lineHeight: 1.5 }}>No pudimos abrir la cámara dentro de Kairo.<button onClick={() => fallback.current?.click()} style={{ marginTop: 16, background: C.lime, color: C.limeInk, border: "none", borderRadius: 14, padding: "12px 20px", fontSize: 15, fontWeight: 600 }}>Abrir la cámara del celular</button></div>
        : <video ref={video} playsInline muted autoPlay style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `${selfie ? "scaleX(-1) " : ""}scale(${digital ? zoom / factor : 1})`, transition: "transform 80ms" }} />}
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: fx ? 0.75 : 0, transition: "opacity 160ms", pointerEvents: "none" }} />
      <input ref={fallback} type="file" accept="image/*" capture="environment" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setShot(await shrink(f, 1920, 0.9)); }} />

      <button onClick={shot ? () => { setShot(null); setEditing(false); } : onClose} aria-label={shot ? "Descartar foto" : "Cerrar cámara"} style={{ ...round(40), position: "absolute", top, left: 14 }}><Icon d={I.close} size={20} sw={2} /></button>
      {!shot && !err && <button onClick={() => setZ(zoom < 0.95 ? 1 : zoom < 1.5 ? 2 : canHalf ? 0.5 : 1)} aria-label="Zoom" style={{ ...round(40), position: "absolute", top, left: "50%", transform: "translateX(-50%)", width: "auto", padding: "0 12px", fontSize: 13, fontWeight: 600 }}>{zoom.toFixed(1).replace(".", ",")}×</button>}
      {!shot && !err && <button onClick={toggleFlash} aria-label={flash ? "Apagar flash" : "Prender flash"} style={{ ...round(40), position: "absolute", top, right: 14, background: flash ? "#fff" : "rgba(0,0,0,0.38)", color: flash ? "#000" : "#fff" }}><Icon d={I.bolt} size={20} sw={1.8} /></button>}
      {shot && <button onClick={() => setEditing(true)} aria-label="Agregar texto" style={{ ...round(40), position: "absolute", top, right: 14 }}><Icon d={I.text} size={20} sw={2} /></button>}

      {shot && (editing
        ? <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setEditing(false)}>
            <input autoFocus value={text} onChange={e => setText(e.target.value.slice(0, 90))} onClick={e => e.stopPropagation()} onKeyDown={e => e.key === "Enter" && setEditing(false)} placeholder="Escribí algo…" enterKeyHint="done" style={{ width: "100%", background: "none", border: "none", outline: "none", color: "#fff", fontSize: 24, fontWeight: 600, textAlign: "center", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }} />
          </div>
        : text && <button onClick={() => setEditing(true)} style={{ position: "absolute", left: 20, right: 20, bottom: 22, background: "none", border: "none", color: "#fff", fontSize: 17, fontWeight: 600, textAlign: "center", textShadow: "0 1px 8px rgba(0,0,0,0.7)", lineHeight: 1.35 }}>{text}</button>)}
      {!shot && caption && <div style={{ position: "absolute", left: 20, right: 20, bottom: 22, textAlign: "center", color: "#fff", fontSize: 15, fontWeight: 600, textShadow: "0 1px 8px rgba(0,0,0,0.7)" }}>{caption}</div>}
    </div>

    <div style={{ height: 116, padding: "0 22px env(safe-area-inset-bottom)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, boxSizing: "content-box" }}>
      {shot ? <>
        <button onClick={() => { setShot(null); setEditing(false); }} style={{ ...glass, background: "rgba(255,255,255,0.12)", height: 46, borderRadius: 23, padding: "0 18px", fontSize: 15, gap: 8 }}><Icon d={I.camera} size={18} />Otra</button>
        <button onClick={() => { stream.current?.getTracks().forEach(t => t.stop()); onShot(shot, text.trim()); }} className="k-press" style={{ height: 50, borderRadius: 25, border: "none", background: C.lime, color: C.limeInk, padding: "0 8px 0 6px", display: "flex", alignItems: "center", gap: 10, fontSize: 15.5, fontWeight: 600 }}>
          <span style={{ width: 38, height: 38, borderRadius: 19, overflow: "hidden", background: "rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>{avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon d={I.user} size={18} />}</span>
          Tu historia
          <span style={{ width: 30, height: 30, borderRadius: 15, background: C.limeInk, color: C.lime, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={I.right} size={16} sw={2.4} /></span>
        </button>
      </> : <>
        <span style={{ width: 46 }} />
        <button onClick={take} disabled={!!err} aria-label="Sacar foto" className="k-press" style={{ width: 78, height: 78, borderRadius: 39, border: "4px solid #fff", background: "transparent", padding: 5, opacity: err ? 0.3 : 1 }}><span style={{ display: "block", width: "100%", height: "100%", borderRadius: "50%", background: "#fff" }} /></button>
        <button onClick={flip} disabled={!!err} aria-label="Dar vuelta la cámara" style={{ ...round(46), background: "rgba(255,255,255,0.12)" }}><Icon d={I.flip} size={22} sw={1.8} /></button>
      </>}
    </div>
  </div>;
}

// Fila de historias de Inicio: la tuya primero (con + para subir), después las de tus amigos.
export function StoriesBar({ token, me, users = [], stories = [], onProfile }) {
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
    <div style={{ display: "flex", gap: 14, overflowX: "auto", margin: "0 -16px 6px", padding: "2px 16px 8px", scrollbarWidth: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, position: "relative" }}>
        {mine ? <Bubble src={me?.avatar} ring={mine.items.some(s => !seen.has(s.id)) ? C.lime : C.line} onClick={() => open(mine)} /> : <StoryPicker token={token} caption="" avatar={me?.avatar} style={{ background: "none", border: "none", padding: 0 }}><Bubble src={me?.avatar} ring={C.line} /></StoryPicker>}
        <span style={{ position: "absolute", top: 42, left: 42, width: 22, height: 22, display: "flex" }}><StoryPicker token={token} caption="" avatar={me?.avatar} style={{ width: 22, height: 22, minHeight: 22, boxSizing: "border-box", borderRadius: 11, border: `2px solid ${C.bg}`, background: C.lime, color: C.limeInk, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 0, fontSize: 0 }}><Icon d={I.plus} size={12} sw={3} /></StoryPicker></span>
        <span style={{ fontSize: 11.5, color: C.sub, whiteSpace: "nowrap" }}>Tu historia</span>
      </div>
      {others.map(g => { const u = info(g.user_id), unseen = g.items.some(s => !seen.has(s.id)); return <button key={g.user_id} onClick={() => open(g)} style={{ background: "none", border: "none", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0, color: C.text }}>
        <Bubble src={u.avatar} ring={unseen ? C.lime : C.line} />
        <span style={{ fontSize: 11.5, color: unseen ? C.text : C.sub, maxWidth: 66, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(u.nombre || "").split(" ")[0]}</span>
      </button>; })}
    </div>
    {viewer && createPortal(<StoryViewer token={token} groups={viewer.groups} start={viewer.index} info={info} myId={myId} onProfile={onProfile} onSeen={(id) => { markSeen(id); setSeen(seenSet()); }} onClose={() => setViewer(null)} />, document.querySelector(".k-root") || document.body)}
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
const Face = ({ src, size, border }) => <span style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", background: C.cardHi, display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.sub, flexShrink: 0, border }}>{src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon d={I.user} size={size * 0.5} />}</span>;

// Visor a pantalla completa: tocá a la derecha para avanzar, a la izquierda para volver y mantené
// apretado para pausar. En las tuyas abajo ves quién la vio y la podés borrar.
function StoryViewer({ token, groups, start, info, myId, onSeen, onProfile, onClose }) {
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(() => Math.max(0, groups[start].items.findIndex(s => !seenSet().has(s.id))));
  const [img, setImg] = useState(null);
  const [pct, setPct] = useState(0);
  const [held, setHeld] = useState(false);
  const [panel, setPanel] = useState(null); // "views" | "delete"
  const [reacted, setReacted] = useState({}); // story_id → emoji que mandaste en esta sesión
  const elapsed = useRef(0), down = useRef(0);
  const g = groups[gi], s = g?.items[si], u = g ? info(g.user_id) : {}, own = g?.user_id === myId;
  const paused = held || !!panel || !img;

  useEffect(() => {
    if (!s) return;
    setImg(null); setPanel(null); elapsed.current = 0; setPct(0); onSeen(s.id);
    dq("kairo_stories", { token, filters: `?id=eq.${s.id}&select=image` }).then(r => setImg(Array.isArray(r) && r[0] ? r[0].image : s.thumb));
    if (!own) fetch("/api/kairo/social", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${loadSession()?.token || token}` }, body: JSON.stringify({ action: "view", story_id: s.id }) }).catch(() => {});
  }, [gi, si]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = useCallback(() => { if (si < g.items.length - 1) setSi(si + 1); else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); } else onClose(); }, [si, gi, g, groups, onClose]);
  const prev = () => { if (si > 0) setSi(si - 1); else if (gi > 0) { setGi(gi - 1); setSi(groups[gi - 1].items.length - 1); } else { elapsed.current = 0; setPct(0); } };
  useEffect(() => {
    if (paused) return;
    let last = Date.now();
    const t = setInterval(() => { const n = Date.now(); elapsed.current += n - last; last = n; const p = elapsed.current / STORY_MS; if (p >= 1) { clearInterval(t); next(); } else setPct(p); }, 50);
    return () => clearInterval(t);
  }, [paused, next]);
  if (!s) return null;
  const del = async () => { await dq("kairo_stories", { method: "DELETE", token, filters: `?id=eq.${s.id}` }); pushToast("Historia eliminada"); window.dispatchEvent(new Event("kairo-stories")); onClose(); };
  // Toque corto = navegar; mantener = pausa.
  const onDown = () => { down.current = Date.now(); setHeld(true); };
  const onUp = (e) => {
    setHeld(false);
    if (Date.now() - down.current > 250) return;
    const r = e.currentTarget.getBoundingClientRect();
    (e.clientX - r.left < r.width * 0.33 ? prev : next)();
  };
  const views = s.views || [];
  const top = "calc(env(safe-area-inset-top) + 8px)";
  const myEmoji = reacted[s.id] ?? s.my_emoji ?? null;
  const react = async (emoji) => {
    setReacted({ ...reacted, [s.id]: emoji }); setHeld(false);
    const r = await fetch("/api/kairo/social", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${loadSession()?.token || token}` }, body: JSON.stringify({ action: "react", story_id: s.id, emoji }) }).then(r => r.json()).catch(() => ({}));
    if (r?.ok) pushToast(`Le mandaste ${emoji} a ${(u.nombre || "").split(" ")[0]}`); else pushToast("No se pudo enviar");
  };

  return <div style={{ position: "fixed", inset: 0, zIndex: 105, background: "#000", display: "flex", flexDirection: "column" }}>
    <div style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: own ? "0 0 22px 22px" : 0, background: "#0a0a0a" }}>
      {img ? <img src={img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Cargando…</span>}
      <div onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={() => setHeld(false)} onContextMenu={e => e.preventDefault()} style={{ position: "absolute", inset: 0, touchAction: "manipulation", WebkitUserSelect: "none", userSelect: "none" }} />

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: `${top} 10px 26px`, background: "linear-gradient(rgba(0,0,0,0.55), transparent)", opacity: held ? 0 : 1, transition: "opacity 200ms", pointerEvents: held ? "none" : "auto" }}>
        <div style={{ display: "flex", gap: 3 }}>{g.items.map((x, k) => <span key={x.id} style={{ flex: 1, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", background: "#fff", width: `${k < si ? 100 : k === si ? pct * 100 : 0}%` }} /></span>)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <button onClick={() => !own && onProfile && (onClose(), onProfile(g.user_id))} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, color: "#fff", minWidth: 0 }}>
            <Face src={u.avatar} size={34} />
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{own ? "Tu historia" : (u.nombre || "").split(" ")[0]}</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{ago(s.created_at)}</span>
          </button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Cerrar" style={{ ...round(36), background: "transparent", backdropFilter: "none", WebkitBackdropFilter: "none" }}><Icon d={I.close} size={22} sw={2} /></button>
        </div>
      </div>
      {s.caption && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: `48px 20px ${own ? 20 : "calc(env(safe-area-inset-bottom) + 76px)"}`, background: "linear-gradient(transparent, rgba(0,0,0,0.6))", color: "#fff", fontSize: 16, fontWeight: 600, textAlign: "center", pointerEvents: "none", lineHeight: 1.35, opacity: held ? 0 : 1, transition: "opacity 200ms" }}>{s.caption}</div>}
    </div>

    {!own && <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom) + 18px)", display: "flex", justifyContent: "center", gap: 10, opacity: held ? 0 : 1, transition: "opacity 200ms" }}>
      {["🔥", "💪", "😂", "❤️", "👏"].map(e => <button key={e} onClick={() => react(e)} className="k-press" style={{ width: 46, height: 46, borderRadius: 23, border: myEmoji === e ? `2px solid ${C.lime}` : "none", background: myEmoji === e ? "rgba(198,244,50,0.25)" : "rgba(0,0,0,0.38)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", transform: myEmoji === e ? "scale(1.12)" : "none", transition: "transform 160ms" }}>{e}</button>)}
    </div>}
    {own && <div style={{ height: 64, padding: "0 16px env(safe-area-inset-bottom)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, boxSizing: "content-box" }}>
      <button onClick={() => setPanel("views")} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", color: "#fff", padding: 0, flex: 1, minWidth: 0 }}>
        {views.length ? <span style={{ display: "flex" }}>{views.slice(0, 3).map((v, k) => <span key={v.id} style={{ marginLeft: k ? -8 : 0 }}><Face src={info(v.id).avatar} size={26} border="2px solid #000" /></span>)}</span> : <Icon d={I.eye} size={20} />}
        <span style={{ fontSize: 14, fontWeight: 500 }}>{views.length ? `Visto por ${views.length}` : "Nadie la vio todavía"}{views.some(v => v.emoji) ? <span style={{ marginLeft: 8 }}>{[...new Set(views.filter(v => v.emoji).map(v => v.emoji))].slice(0, 4).join(" ")}</span> : null}</span>
      </button>
      <button onClick={() => setPanel("delete")} aria-label="Eliminar historia" style={{ ...round(42), background: "rgba(255,255,255,0.1)" }}><Icon d={I.trash} size={20} sw={1.8} /></button>
    </div>}

    {panel && <div onClick={() => setPanel(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: C.card, borderRadius: "22px 22px 0 0", padding: "10px 18px calc(env(safe-area-inset-bottom) + 18px)", maxHeight: "65%", overflowY: "auto", animation: "kUp 240ms cubic-bezier(.2,.9,.3,1)" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.line, margin: "0 auto 14px" }} />
        {panel === "views" ? <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600 }}><Icon d={I.eye} size={19} color={C.sub} />{views.length ? `Visto por ${views.length}` : "Todavía nadie la vio"}</div>
          {!views.length && <p style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.5, margin: "8px 0 0" }}>Cuando alguien la abra, aparece acá.</p>}
          <div style={{ marginTop: 8 }}>{views.map(v => { const x = info(v.id); return <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `0.5px solid ${C.line}` }}>
            <Face src={x.avatar} size={40} />
            <span style={{ flex: 1, fontSize: 15 }}>{x.nombre || "Usuario"}</span>
            {v.emoji && <span style={{ fontSize: 20 }}>{v.emoji}</span>}
            <span style={{ fontSize: 12.5, color: C.sub }}>hace {ago(v.at)}</span>
          </div>; })}</div>
        </> : <>
          <div style={{ fontSize: 17, fontWeight: 600, textAlign: "center" }}>¿Eliminar esta historia?</div>
          <div style={{ fontSize: 13.5, color: C.sub, textAlign: "center", marginTop: 6 }}>Deja de verse para todos.</div>
          <button onClick={del} className="k-press" style={{ width: "100%", marginTop: 18, background: "rgba(255,107,107,0.14)", color: C.neg, border: "none", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 600 }}>Eliminar</button>
          <button onClick={() => setPanel(null)} className="k-press" style={{ width: "100%", marginTop: 8, background: C.cardHi, color: C.text, border: "none", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 500 }}>Cancelar</button>
        </>}
      </div>
    </div>}
  </div>;
}

// Perfil de otro usuario (o el tuyo visto como lo ven los demás).
const ESTADO = { en_camino: ["Va bien", C.pos], lento: ["Avance lento", C.warn], desviado: ["Fuera de rumbo", C.neg], sin_datos: ["Sin datos todavía", C.sub] };
export function UserProfile({ token, id, onClose }) {
  const [p, setP] = useState(null);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    fetch(`/api/kairo/social?user=${id}`, { headers: { Authorization: `Bearer ${loadSession()?.token || token}` } }).then(r => r.json()).then(r => setP(r.profile || { error: true })).catch(() => setP({ error: true }));
  }, [id, token]);
  return <Sheet title={p?.nombre || "Perfil"} onClose={onClose}>
    {!p ? <p style={{ color: C.sub, fontSize: 14 }}>Cargando…</p> : p.error ? <p style={{ color: C.sub, fontSize: 14 }}>No se pudo cargar.</p> : <>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => p.avatar && setZoom(true)} aria-label="Ver foto" style={{ width: 84, height: 84, borderRadius: 42, overflow: "hidden", background: C.cardHi, display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, border: `2px solid ${C.lime}`, flexShrink: 0, padding: 0 }}>{p.avatar ? <img src={p.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon d={I.user} size={30} />}</button>
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
      {zoom && createPortal(<div onClick={() => setZoom(false)} style={{ position: "fixed", inset: 0, zIndex: 115, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "kFade 180ms ease" }}>
        <img src={p.avatar} alt={p.nombre} style={{ width: "min(88vw, 420px)", aspectRatio: "1", borderRadius: "50%", objectFit: "cover" }} />
        <button aria-label="Cerrar" style={{ ...round(40), position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)", right: 14 }}><Icon d={I.close} size={20} sw={2} /></button>
      </div>, document.querySelector(".k-root") || document.body)}
      <SectionTitle>Últimos entrenos</SectionTitle>
      {!p.ultimos.length ? <div style={{ ...card, color: C.sub, fontSize: 14 }}>Todavía no entrenó.</div> :
        <div style={{ ...card, padding: "2px 16px" }}>{p.ultimos.map((w, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "11px 0", borderBottom: i < p.ultimos.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <div><div style={{ fontSize: 15 }}>{w.rutina}</div><div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{dayLabel(ymd(new Date(w.fecha)))} · {w.minutos} min · {w.series} series</div></div>
          <span className="k-num" style={{ fontSize: 13.5, color: C.sub, whiteSpace: "nowrap" }}>{w.volumen.toLocaleString("es-AR")} kg</span>
        </div>)}</div>}
    </>}
  </Sheet>;
}
