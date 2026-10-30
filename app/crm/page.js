"use client";
// Panel CRM (30/10/2026). Sección aparte del admin, como GI: entran admin y empleados. Regla del
// reparto: lo que sirve para conseguir y mantener clientes vive acá; lo que mueve la carga y la plata
// queda en el admin. Secciones:
//   WhatsApp  → Chats (el número comercial en coexistencia: sigue en el celu, acá se espeja) · Contactos
//   Comercial → Seguimiento (mudado del admin) · Campañas (Meta Ads: qué anuncio trae importadores)
//   Marketing → Content Studio · Historias de reseña · Blog (mudados del admin, código tal cual)
//   Ajustes   → Conexiones (lo último: WhatsApp, Meta Ads, Claude)
// Sesión y piezas de UI: las mismas de GI (app/gi/_base.js). Los paneles mudados usan app/crm/_compat.js.
import { useState, useEffect, useCallback } from "react";
import { ToastStack, DialogHost } from "../../lib/ui";
import { C, BG, LOGO, GOLD_GRADIENT, dq, arr, ac, sesionInicial, saveSession, clearSession, usarSesionPropia, useMovil, Btn, Campo, inp } from "../gi/_base";
import { setRolCrm } from "./_compat";
import Chats from "./_chats";
import Contactos from "./_contactos";
import Campanas from "./_campanas";
import Conexiones from "./_conexiones";
import { SeguimientoPanel } from "./_seguimiento";
import { StudioPanel, HistoriasPanel, BlogPanel } from "./_marketing";

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
    setRolCrm(prof.role);
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
  seguimiento: ["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M9 16l2 2 4-4"],
  campanas: ["M3 11l18-5v12L3 14v-3z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
  studio: ["M4 4h16v12H4z", "M8 20h8", "M12 16v4", "M8 8l3 3 2-2 3 3"],
  historias: ["M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.9z"],
  blog: ["M4 4h16v16H4z", "M8 8h8", "M8 12h8", "M8 16h5"],
  conexiones: ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"],
};
const Ico = ({ k, c, s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{(ICON[k] || []).map((d, i) => <path key={i} d={d} />)}</svg>;
const PAGINAS = ["chats", "contactos", "seguimiento", "campanas", "studio", "historias", "blog", "conexiones"];

function Shell({ sesion, perfil, onLogout }) {
  const token = sesion.access_token;
  const rol = perfil.role === "admin" ? "admin" : "empleado";
  const admin = rol === "admin";
  const movil = useMovil();
  // La página inicial: ?p= (vuelta del OAuth de LinkedIn a Content Studio), si no la última abierta.
  const [nav, setNav] = useState(() => {
    try { const p = new URLSearchParams(window.location.search).get("p"); if (p && PAGINAS.includes(p)) return { p }; } catch {}
    try { return JSON.parse(sessionStorage.getItem("crm_nav") || "null") || { p: "chats" }; } catch { return { p: "chats" }; }
  });
  const [menu, setMenu] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
  const ir = useCallback((p, extra = {}) => { const n = { p, ...extra }; setNav(n); setMenu(false); try { sessionStorage.setItem("crm_nav", JSON.stringify({ p })); } catch {} window.scrollTo(0, 0); }, []);
  const ctx = { token, rol, admin, perfil, ir, movil, setSinLeer };

  const SECCIONES = [
    { s: "WhatsApp", items: [{ k: "chats", l: "Chats", badge: sinLeer }, { k: "contactos", l: "Contactos" }] },
    { s: "Comercial", items: [{ k: "seguimiento", l: "Seguimiento" }, { k: "campanas", l: "Campañas" }] },
    { s: "Marketing", items: [{ k: "studio", l: "Content Studio" }, admin ? { k: "historias", l: "Hist. de reseña" } : null, { k: "blog", l: "Blog" }].filter(Boolean) },
    admin ? { s: "Ajustes", items: [{ k: "conexiones", l: "Conexiones" }] } : null,
  ].filter(Boolean);

  let cuerpo;
  if (nav.p === "contactos") cuerpo = <Contactos ctx={ctx} />;
  else if (nav.p === "seguimiento") cuerpo = <SeguimientoPanel token={token} rol={rol} movil={movil} />;
  else if (nav.p === "campanas") cuerpo = <Campanas ctx={ctx} />;
  else if (nav.p === "studio") cuerpo = <StudioPanel token={token} />;
  else if (nav.p === "historias" && admin) cuerpo = <HistoriasPanel token={token} />;
  else if (nav.p === "blog") cuerpo = <BlogPanel token={token} />;
  else if (nav.p === "conexiones" && admin) cuerpo = <Conexiones />;
  else cuerpo = <Chats ctx={ctx} inicial={nav.id || null} />;

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
      <a href="/admin" style={{ display: "block", textAlign: "center", padding: "8px 10px", marginBottom: 6, fontSize: 11.5, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.55)", textDecoration: "none", fontWeight: 600 }}>Ir al admin</a>
      <button onClick={onLogout} style={{ width: "100%", padding: "8px 10px", fontSize: 11.5, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.55)", cursor: "pointer", fontWeight: 600, letterSpacing: "0.04em", fontFamily: "inherit" }}>Cerrar sesión</button>
    </div>
  </>;

  const chat = nav.p === "chats";
  return <div style={{ minHeight: "100vh", background: BG, color: C.txt, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
    <style>{`html,body{background:#0A1628 !important;overflow-x:hidden}`}</style>
    {!movil && <aside style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", zIndex: 5 }}>{barra}</aside>}
    {movil && <header style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, padding: "0 16px", background: "rgba(10,22,40,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={() => setMenu(true)} aria-label="Abrir menú" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", padding: "8px 10px", borderRadius: 8, cursor: "pointer", display: "inline-flex", position: "relative" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        {sinLeer > 0 && nav.p !== "chats" && <span style={{ position: "absolute", top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{sinLeer}</span>}
      </button>
      <img src={LOGO} alt="Argencargo" style={{ height: 30, objectFit: "contain" }} />
      <span style={{ fontSize: 8.5, fontWeight: 900, padding: "3px 7px", borderRadius: 4, background: GOLD_GRADIENT, color: "#0A1628", letterSpacing: "0.14em" }}>CRM</span>
    </header>}
    {movil && menu && <>
      <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }} />
      <aside style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 270, background: "#0b1729", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", zIndex: 41 }}>{barra}</aside>
    </>}
    <main style={{ marginLeft: movil ? 0 : 220, padding: movil ? (chat ? "12px 10px 16px" : "16px 14px 40px") : (chat ? "20px 22px 20px" : "26px 30px 48px") }}>
      <div style={{ maxWidth: chat ? "none" : 1240, margin: "0 auto" }}>{cuerpo}</div>
    </main>
  </div>;
}
