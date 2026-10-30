"use client";
// Panel CRM (30/10/2026). Sección aparte del admin, como GI: entran admin y empleados (el empleado no
// ve plata ni la conexión del número). El WhatsApp comercial (+54 9 11 2508-8580) está conectado en
// "coexistencia": sigue en el celu y acá se ven los mismos chats. Por ahora SOLO lectura: no se manda
// nada desde el sistema (lo que llega gratis es lo que se recibe; se contesta desde el celu).
//   Etapa 1 (esta): conexión del número + chats para verificar que entra todo.
//   Etapa 2: bandeja definitiva + ficha de cada contacto.  Etapa 3: campañas.
// Sesión y piezas de UI: las mismas de GI (app/gi/_base.js).
import { useState, useEffect, useCallback, useRef } from "react";
import { ToastStack, DialogHost } from "../../lib/ui";
import {
  C, BG, LOGO, GOLD_GRADIENT, MONO, dq, arr, ac, sesionInicial, saveSession, clearSession, usarSesionPropia,
  hace, useMovil, Btn, Pill, Caja, Titulo, Vacio, Cargando, Campo, inp,
} from "../gi/_base";

const CSS = `@keyframes giShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
*{-webkit-tap-highlight-color:transparent}
.crm-scroll::-webkit-scrollbar{width:6px}.crm-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}`;

export default function CrmPage() {
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState("");
  const validar = async (s) => {
    const p = await dq("profiles", { token: s.access_token, filters: `?id=eq.${s.user.id}&select=id,role,email` });
    const prof = arr(p)[0];
    if (!prof) return { error: "No se pudo cargar tu perfil." };
    if (!["admin", "empleado"].includes(prof.role)) return { error: "Tu cuenta no tiene acceso al CRM." };
    return { prof };
  };
  useEffect(() => { (async () => {
    const s = sesionInicial();
    if (s?.access_token && s.user?.id) { const r = await validar(s); if (r.prof) { setSesion(s); setPerfil(r.prof); } else { clearSession(); usarSesionPropia(); } }
    setCargando(false);
  })(); }, []);
  if (cargando) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.mute, fontFamily: "'Inter','Segoe UI',sans-serif" }}>Cargando…</div>;
  if (!sesion) return <Login err0={err} onLogin={async (s) => { usarSesionPropia(); saveSession(s); const r = await validar(s); if (!r.prof) { clearSession(); setErr(r.error); return r.error; } setSesion(s); setPerfil(r.prof); return null; }} />;
  return <><style>{CSS}</style><Shell sesion={sesion} perfil={perfil} onLogout={() => { clearSession(); setSesion(null); setPerfil(null); }} /><ToastStack /><DialogHost /></>;
}

function Login({ onLogin, err0 }) {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [err, setErr] = useState(err0 || ""); const [lo, setLo] = useState(false);
  const enviar = async (e) => {
    e?.preventDefault?.(); if (!email || !pass) return;
    setLo(true); setErr("");
    const r = await ac("token?grant_type=password", { email: email.trim(), password: pass });
    if (!r?.access_token) { setErr("Email o contraseña incorrectos"); setLo(false); return; }
    const e2 = await onLogin({ access_token: r.access_token, refresh_token: r.refresh_token, user: r.user });
    if (e2) setErr(e2);
    setLo(false);
  };
  return <div style={{ minHeight: "100vh", background: `radial-gradient(900px 500px at 80% -10%, rgba(201,164,106,0.12), transparent 60%), ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
    <form onSubmit={enviar} style={{ width: "100%", maxWidth: 380, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: "28px 22px", color: C.txt, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: GOLD_GRADIENT }} />
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <img src={LOGO} alt="Argencargo" style={{ height: 40, width: "auto" }} />
        <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.22em", color: C.goldHi, textTransform: "uppercase", margin: "10px 0 0" }}>CRM</p>
      </div>
      {err && <div style={{ padding: "10px 12px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, fontSize: 12.5, color: C.red, marginBottom: 12 }}>{err}</div>}
      <Campo label="Email"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inp} /></Campo>
      <Campo label="Contraseña"><input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} style={inp} /></Campo>
      <Btn type="submit" v="gold" full disabled={lo} style={{ marginTop: 6, padding: "12px 16px" }}>{lo ? "Ingresando…" : "Ingresar"}</Btn>
    </form>
  </div>;
}

// ────────────────────────────────────────────
// SHELL
// ────────────────────────────────────────────
const ICON = {
  chats: ["M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"],
  contactos: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 7a4 4 0 1 0 0 .01", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  campanas: ["M3 11l18-5v12L3 14v-3z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
  seguimiento: ["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M9 16l2 2 4-4"],
  conexion: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
};
const Ico = ({ k, c, s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{(ICON[k] || []).map((d, i) => <path key={i} d={d} />)}</svg>;

function Shell({ sesion, perfil, onLogout }) {
  const token = sesion.access_token;
  const admin = perfil.role === "admin";
  const movil = useMovil();
  const [nav, setNav] = useState(() => { try { return JSON.parse(sessionStorage.getItem("crm_nav") || "null") || { p: "chats" }; } catch { return { p: "chats" }; } });
  const [menu, setMenu] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
  const ir = useCallback((p, extra = {}) => { const n = { p, ...extra }; setNav(n); setMenu(false); try { sessionStorage.setItem("crm_nav", JSON.stringify(n)); } catch {} window.scrollTo(0, 0); }, []);
  const ctx = { token, admin, perfil, ir, movil, setSinLeer };

  const SECCIONES = [
    { s: "WhatsApp", items: [{ k: "chats", l: "Chats", badge: sinLeer }, { k: "contactos", l: "Contactos" }] },
    { s: "Comercial", items: [{ k: "campanas", l: "Campañas" }, { k: "seguimiento", l: "Seguimiento" }] },
    admin ? { s: "Ajustes", items: [{ k: "conexion", l: "Conexión" }] } : null,
  ].filter(Boolean);

  let cuerpo;
  if (nav.p === "conexion" && admin) cuerpo = <Conexion ctx={ctx} />;
  else if (nav.p === "contactos") cuerpo = <Vacio>Contactos: viene en la etapa 2.</Vacio>;
  else if (nav.p === "campanas") cuerpo = <Vacio>Campañas: viene en la etapa 3.</Vacio>;
  else if (nav.p === "seguimiento") cuerpo = <Vacio>El Seguimiento se muda acá en la etapa 2. Mientras tanto sigue en el admin.</Vacio>;
  else cuerpo = <Chats ctx={ctx} />;

  const iniciales = (perfil.email || "AC").slice(0, 2).toUpperCase();
  const barra = <>
    <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, position: "relative" }}>
      <img src={LOGO} alt="Argencargo" style={{ width: "100%", height: "auto", maxHeight: 50, objectFit: "contain" }} />
      <span style={{ fontSize: 9.5, fontWeight: 900, padding: "3px 10px", borderRadius: 5, background: GOLD_GRADIENT, color: "#0A1628", letterSpacing: "0.18em" }}>CRM</span>
      {movil && <button onClick={() => setMenu(false)} aria-label="Cerrar menú" style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", color: C.sub, fontSize: 20, cursor: "pointer" }}>✕</button>}
    </div>
    <nav style={{ flex: 1, padding: "10px 10px 14px", overflowY: "auto" }}>
      {SECCIONES.map((sec) => <div key={sec.s} style={{ marginTop: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.32)", margin: "0 0 6px", padding: "0 14px", textTransform: "uppercase", letterSpacing: "0.14em" }}>{sec.s}</p>
        {sec.items.map((it) => { const on = nav.p === it.k; return <button key={it.k} onClick={() => ir(it.k)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 14px", marginBottom: 1, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: on ? 700 : 500, background: on ? "linear-gradient(90deg, rgba(184,149,106,0.12), rgba(184,149,106,0.02))" : "transparent", color: on ? "#fff" : "rgba(255,255,255,0.55)", fontFamily: "inherit", textAlign: "left", position: "relative" }}>
          {on && <span style={{ position: "absolute", left: -10, top: 7, bottom: 7, width: 3, borderRadius: "0 3px 3px 0", background: GOLD_GRADIENT }} />}
          <Ico k={it.k} c={on ? C.goldHi : "rgba(255,255,255,0.45)"} s={17} />
          <span style={{ flex: 1 }}>{it.l}</span>
          {it.badge > 0 && <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999, background: "#ef4444", color: "#fff" }}>{it.badge}</span>}
        </button>; })}
      </div>)}
    </nav>
    <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "50%", background: "linear-gradient(135deg, rgba(184,149,106,0.22), rgba(184,149,106,0.08))", border: "1px solid rgba(184,149,106,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: C.goldHi }}>{iniciales}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", margin: 0 }}>{admin ? "Admin" : "Empleado"}</p>
          <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perfil.email}</p>
        </div>
      </div>
      <a href="/admin" style={{ display: "block", textAlign: "center", padding: "8px 10px", marginBottom: 6, fontSize: 11.5, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.55)", textDecoration: "none", fontWeight: 600 }}>Volver al admin</a>
      <button onClick={onLogout} style={{ width: "100%", padding: "8px 10px", fontSize: 11.5, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.55)", cursor: "pointer", fontWeight: 600, letterSpacing: "0.04em", fontFamily: "inherit" }}>Cerrar sesión</button>
    </div>
  </>;

  return <div style={{ minHeight: "100vh", background: BG, color: C.txt, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
    <style>{`html,body{background:#0A1628 !important;overflow-x:hidden}`}</style>
    {!movil && <aside style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", zIndex: 5 }}>{barra}</aside>}
    {movil && <header style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, padding: "0 16px", background: "rgba(10,22,40,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={() => setMenu(true)} aria-label="Abrir menú" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", padding: "8px 10px", borderRadius: 8, cursor: "pointer", display: "inline-flex" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>
      <img src={LOGO} alt="Argencargo" style={{ height: 30, objectFit: "contain" }} />
      <span style={{ fontSize: 8.5, fontWeight: 900, padding: "3px 7px", borderRadius: 4, background: GOLD_GRADIENT, color: "#0A1628", letterSpacing: "0.14em" }}>CRM</span>
    </header>}
    {movil && menu && <>
      <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }} />
      <aside style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 270, background: "#0b1729", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", zIndex: 41 }}>{barra}</aside>
    </>}
    <main style={{ marginLeft: movil ? 0 : 220, padding: movil ? "14px 12px 30px" : "26px 30px 40px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>{cuerpo}</div>
    </main>
  </div>;
}

// ────────────────────────────────────────────
// CHATS (etapa 1: lo justo para ver que entra todo)
// ────────────────────────────────────────────
const fmtTel = (p) => { const d = String(p || "").replace(/\D/g, ""); if (d.startsWith("549") && d.length === 13) return `+54 9 ${d.slice(3, 5)} ${d.slice(5, 9)}-${d.slice(9)}`; return d ? `+${d}` : "—"; };
const nombreDe = (c) => c.name || c.wa_name || fmtTel(c.phone);
const inicialesDe = (c) => { const n = c.name || c.wa_name; if (!n) return "#"; const p = n.trim().split(/\s+/); return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase(); };
const hora = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const diaDe = (ts) => { const d = new Date(ts); const hoy = new Date(); const ayer = new Date(Date.now() - 864e5); const mismo = (a, b) => a.toDateString() === b.toDateString(); if (mismo(d, hoy)) return "Hoy"; if (mismo(d, ayer)) return "Ayer"; return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }); };
const ETAPA = { nuevo: ["Nuevo", C.blue], hablando: ["Hablando", C.goldHi], cotizo: ["Cotizó", "#a78bfa"], importo: ["Importó", "#22c55e"], perdido: ["Perdido", C.mute] };

function Chats({ ctx }) {
  const { token, movil, setSinLeer } = ctx;
  const [lista, setLista] = useState(null);
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [q, setQ] = useState("");
  const selRef = useRef(null); selRef.current = sel;
  const fin = useRef(null);

  const cargarLista = useCallback(async () => {
    const r = await dq("crm_contacts", { token, filters: "?select=id,phone,name,wa_name,client_id,stage,source,ad_headline,last_msg_at,last_preview,last_direction,unread&order=last_msg_at.desc.nullslast&limit=300" });
    const l = arr(r); setLista(l); setSinLeer(l.filter((c) => c.unread > 0).length);
  }, [token, setSinLeer]);
  const cargarMsgs = useCallback(async (c) => {
    const r = await dq("crm_messages", { token, filters: `?select=id,direction,via,type,text,media_filename,status,deleted,ts,referral&contact_id=eq.${c.id}&order=ts.asc&limit=500` });
    if (selRef.current?.id === c.id) setMsgs(arr(r));
  }, [token]);
  useEffect(() => { cargarLista(); const t = setInterval(() => { cargarLista(); if (selRef.current) cargarMsgs(selRef.current); }, 15000); return () => clearInterval(t); }, [cargarLista, cargarMsgs]);
  useEffect(() => { fin.current?.scrollIntoView?.({ block: "end" }); }, [msgs]);

  const abrir = async (c) => {
    setSel(c); setMsgs(null); await cargarMsgs(c);
    if (c.unread > 0) { await dq("crm_contacts", { token, method: "PATCH", filters: `?id=eq.${c.id}`, body: { unread: 0, seen_at: new Date().toISOString() } }); cargarLista(); }
  };
  const filtrada = (lista || []).filter((c) => !q || `${c.name || ""} ${c.wa_name || ""} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));

  const Lista = <div style={{ display: "flex", flexDirection: "column", height: movil ? "auto" : "calc(100vh - 66px)" }}>
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono" style={{ ...inp, marginBottom: 10, padding: "9px 12px", fontSize: 13 }} />
    <div className="crm-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      {lista === null ? <Cargando /> : !filtrada.length ? <Vacio>{lista.length ? "Nada con ese nombre." : "Todavía no entró ningún chat. En cuanto alguien escriba al número comercial aparece acá."}</Vacio> :
        filtrada.map((c) => { const on = sel?.id === c.id; const et = ETAPA[c.stage] || ETAPA.nuevo; return <button key={c.id} onClick={() => abrir(c)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 10px", borderRadius: 12, border: `1px solid ${on ? C.lineHi : "transparent"}`, background: on ? "rgba(184,149,106,0.08)" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: C.txt }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, rgba(184,149,106,0.22), rgba(184,149,106,0.08))", border: "1px solid rgba(184,149,106,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12.5, color: C.goldHi }}>{inicialesDe(c)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 13.5, fontWeight: c.unread ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(c)}</span>
              <span style={{ fontSize: 10.5, color: C.mute, flexShrink: 0 }}>{c.last_msg_at ? hace(c.last_msg_at) : ""}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 2 }}>
              <span style={{ fontSize: 12, color: c.unread ? C.txt : C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last_direction === "out" ? "Vos: " : ""}{c.last_preview || ""}</span>
              {c.unread > 0 ? <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999, background: "#ef4444", color: "#fff", flexShrink: 0 }}>{c.unread}</span>
                : <span style={{ fontSize: 9.5, fontWeight: 800, color: et[1], letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0 }}>{et[0]}</span>}
            </div>
          </div>
        </button>; })}
    </div>
  </div>;

  const Hilo = sel && <div style={{ display: "flex", flexDirection: "column", height: movil ? "calc(100vh - 90px)" : "calc(100vh - 66px)", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${C.line}` }}>
      {movil && <button onClick={() => setSel(null)} style={{ background: "transparent", border: "none", color: C.sub, fontSize: 20, cursor: "pointer", padding: "0 4px" }}>‹</button>}
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(184,149,106,0.14)", border: "1px solid rgba(184,149,106,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: C.goldHi }}>{inicialesDe(sel)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{nombreDe(sel)}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: C.mute, fontFamily: MONO }}>{fmtTel(sel.phone)}{sel.wa_name && sel.name ? ` · ${sel.wa_name}` : ""}{sel.source === "ad" ? ` · 📣 ${sel.ad_headline || "anuncio"}` : ""}</p>
      </div>
      <Pill c={(ETAPA[sel.stage] || ETAPA.nuevo)[1]}>{(ETAPA[sel.stage] || ETAPA.nuevo)[0]}</Pill>
      <a href={`https://wa.me/${sel.phone}`} target="_blank" rel="noreferrer" title="Abrir en WhatsApp" style={{ fontSize: 12, color: C.goldHi, textDecoration: "none", fontWeight: 700 }}>WhatsApp ↗</a>
    </div>
    <div className="crm-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
      {msgs === null ? <Cargando /> : !msgs.length ? <Vacio>Sin mensajes guardados.</Vacio> : msgs.map((m, i) => {
        const nuevoDia = i === 0 || diaDe(m.ts) !== diaDe(msgs[i - 1].ts);
        const out = m.direction === "out";
        const txt = m.deleted ? "Mensaje eliminado" : m.text || ({ image: "📷 Foto", video: "🎥 Video", audio: "🎤 Audio", document: `📄 ${m.media_filename || "Documento"}`, sticker: "Sticker", location: "📍 Ubicación", contacts: "👤 Contacto", media_placeholder: "📎 Adjunto (anterior a la conexión)", reaction: "Reacción", unsupported: "Mensaje no soportado" }[m.type] || m.type || "");
        return <div key={m.id}>
          {nuevoDia && <div style={{ textAlign: "center", margin: "10px 0 8px" }}><span style={{ fontSize: 10.5, fontWeight: 700, color: C.mute, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.05)", textTransform: "capitalize" }}>{diaDe(m.ts)}</span></div>}
          <div style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "78%", padding: "8px 12px", borderRadius: out ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: out ? "rgba(184,149,106,0.22)" : "rgba(255,255,255,0.06)", border: `1px solid ${out ? "rgba(184,149,106,0.3)" : C.line}`, fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", fontStyle: m.deleted ? "italic" : "normal", color: m.deleted ? C.mute : C.txt }}>
              {m.referral && <div style={{ fontSize: 11, color: C.goldHi, fontWeight: 700, marginBottom: 4 }}>📣 Vino del anuncio{m.referral.headline ? `: ${m.referral.headline}` : ""}</div>}
              {txt}
              <div style={{ fontSize: 10, color: C.mute, textAlign: "right", marginTop: 3 }}>{hora(m.ts)}{out ? (m.status === "read" ? " ✓✓" : m.status === "delivered" ? " ✓✓" : m.status === "failed" ? " ✗" : " ✓") : ""}{m.via === "app" ? " · celu" : ""}</div>
            </div>
          </div>
        </div>; })}
      <div ref={fin} />
    </div>
    <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.mute }}>Por ahora se contesta desde el celu o WhatsApp Web. Lo que mandes aparece acá solo.</div>
  </div>;

  if (movil) return sel ? Hilo : Lista;
  return <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>
    {Lista}
    {sel ? Hilo : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: C.mute, fontSize: 13, border: `1px dashed ${C.line}`, borderRadius: 16 }}>Elegí un chat</div>}
  </div>;
}

// ────────────────────────────────────────────
// CONEXIÓN (solo admin): alta del número comercial por Embedded Signup de Meta
// ────────────────────────────────────────────
function cargarFb(appId) {
  return new Promise((res) => {
    if (window.FB) return res(window.FB);
    window.fbAsyncInit = () => { window.FB.init({ appId, autoLogAppEvents: false, xfbml: false, version: "v26.0" }); res(window.FB); };
    const s = document.createElement("script"); s.src = "https://connect.facebook.net/es_LA/sdk.js"; s.async = true; s.defer = true; s.crossOrigin = "anonymous"; document.body.appendChild(s);
  });
}
const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || "";
const CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID || "";

function Conexion() {
  const [st, setSt] = useState(null);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const datos = useRef({});
  const agregar = (t) => setLog((l) => [...l, `${hora(new Date())} · ${t}`]);
  const cargar = useCallback(async () => { const r = await fetch("/api/crm/conectar", { cache: "no-store" }).then((r) => r.json()).catch(() => null); setSt(r); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  // Los ids del número llegan por postMessage mientras el usuario está en la ventana de Meta.
  useEffect(() => {
    const onMsg = (e) => {
      if (!String(e.origin || "").endsWith("facebook.com")) return;
      let d; try { d = JSON.parse(e.data); } catch { return; }
      if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
      agregar(`Meta: ${d.event || "?"}${d.data?.current_step ? ` · paso ${d.data.current_step}` : ""}${d.data?.error_message ? ` · ${d.data.error_message}` : ""}${d.data?.error_id ? ` (${d.data.error_id})` : ""}`);
      if (d.data?.phone_number_id || d.data?.waba_id) datos.current = { ...datos.current, phone_number_id: d.data.phone_number_id, waba_id: d.data.waba_id, business_id: d.data.business_id };
    };
    window.addEventListener("message", onMsg); return () => window.removeEventListener("message", onMsg);
  }, []);

  const conectar = async () => {
    if (!APP_ID || !CONFIG_ID) { agregar("Faltan en Vercel NEXT_PUBLIC_META_APP_ID y/o NEXT_PUBLIC_META_ES_CONFIG_ID."); return; }
    setBusy(true); datos.current = {}; agregar("Abriendo el alta de Meta…");
    const FB = await cargarFb(APP_ID);
    FB.login(async (resp) => {
      const code = resp?.authResponse?.code;
      if (!code) { agregar("Alta cancelada o sin permiso: Meta no devolvió el código."); setBusy(false); return; }
      for (let i = 0; i < 25 && !datos.current.phone_number_id; i++) await new Promise((r) => setTimeout(r, 200));
      if (!datos.current.phone_number_id) { agregar("Meta devolvió el código pero no el id del número. ¿Se completó el alta hasta el final?"); setBusy(false); return; }
      agregar("Terminando la conexión…");
      const r = await fetch("/api/crm/conectar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, ...datos.current }) }).then((r) => r.json()).catch((e) => ({ error: e.message }));
      for (const p of r.pasos || []) agregar(`${p.ok ? "✓" : "✗"} ${p.t}`);
      if (r.error) agregar(`✗ ${r.error}`);
      setBusy(false); cargar();
    }, { config_id: CONFIG_ID, response_type: "code", override_default_response_type: true, extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" } });
  };
  const reintentar = async (n) => {
    setBusy(true); agregar(`Revisando la conexión de ${n.display_phone || n.phone_number_id}…`);
    const r = await fetch("/api/crm/conectar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "reintentar", phone_number_id: n.phone_number_id }) }).then((r) => r.json()).catch((e) => ({ error: e.message }));
    for (const p of r.pasos || []) agregar(`${p.ok ? "✓" : "✗"} ${p.t}`);
    if (r.error) agregar(`✗ ${r.error}`);
    setBusy(false); cargar();
  };

  const ESTADO = { conectado: ["Conectado", "#22c55e"], desconectado: ["Desconectado", C.red], reconectando: ["Reconectando", C.goldHi] };
  const nums = st?.numeros || [];
  return <div style={{ maxWidth: 760 }}>
    <Titulo eyebrow="Ajustes" sub="El número comercial sigue andando en el celu; acá se espejan los chats.">Conexión de WhatsApp</Titulo>
    {st === null ? <Cargando /> : <>
      <Caja title="Número" right={<Btn v="gold" small onClick={conectar} disabled={busy}>{nums.length ? "Conectar otro número" : "Conectar WhatsApp"}</Btn>}>
        {!nums.length ? <p style={{ margin: 0, fontSize: 13, color: C.sub }}>Ningún número conectado todavía.</p> :
          nums.map((n) => { const e = ESTADO[n.status] || ESTADO.conectado; return <div key={n.phone_number_id} style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.line}` }}>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: MONO }}>{n.display_phone ? `+${n.display_phone.replace(/\D/g, "")}` : n.phone_number_id}</span>
            <Pill c={e[1]}>{e[0]}</Pill>
            <span style={{ fontSize: 12, color: C.sub }}>desde {hace(n.connected_at)}</span>
            {n.is_on_biz_app === false && <Pill c={C.red}>Ya no está en la app del celu</Pill>}
            {n.disconnect_reason && <span style={{ fontSize: 12, color: C.red }}>{n.disconnect_reason}</span>}
            <span style={{ fontSize: 12, color: C.sub }}>Historial: {n.history_progress == null ? (n.sync_history_at ? "pedido, esperando" : "no pedido") : n.history_progress < 0 ? "el celu no lo compartió" : `${n.history_progress}%`}</span>
            <Btn small onClick={() => reintentar(n)} disabled={busy}>Revisar conexión</Btn>
          </div>; })}
      </Caja>
      <div style={{ height: 12 }} />
      <Caja title="Estado">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, fontSize: 13 }}>
          <Dato k="Chats" v={st.contactos} /><Dato k="Mensajes" v={st.mensajes} />
          <Dato k="App de Meta" v={st.env?.app_id ? "cargada" : "falta NEXT_PUBLIC_META_APP_ID"} mal={!st.env?.app_id} />
          <Dato k="Configuración del alta" v={st.env?.config_id ? "cargada" : "falta NEXT_PUBLIC_META_ES_CONFIG_ID"} mal={!st.env?.config_id} />
          <Dato k="Clave secreta" v={st.env?.secreto ? "cargada" : "falta"} mal={!st.env?.secreto} />
          {st.campos && <Dato k="Campos del webhook" v={st.campos.error ? st.campos.error : st.campos.faltan?.length ? `faltan ${st.campos.faltan.join(", ")}` : "completos"} mal={!!(st.campos.error || st.campos.faltan?.length)} />}
        </div>
      </Caja>
      {log.length > 0 && <><div style={{ height: 12 }} /><Caja title="Registro"><div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: C.sub, whiteSpace: "pre-wrap" }}>{log.join("\n")}</div></Caja></>}
    </>}
  </div>;
}
const Dato = ({ k, v, mal }) => <div><p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</p><p style={{ margin: "3px 0 0", fontSize: 13.5, fontWeight: 700, color: mal ? C.red : C.txt }}>{v}</p></div>;
