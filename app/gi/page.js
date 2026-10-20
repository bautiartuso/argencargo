"use client";
// Panel de Gestión Integral (renovado 13/10/2026). Independiente del admin: acá entran el admin,
// los empleados y los socios GI. Cotizaciones → operaciones → cobros/costos → liquidación del socio.
//   admin    → todo
//   empleado → todo menos costos, ganancia y comisiones
//   socio    → sus clientes/cotizaciones/operaciones y su comisión (lo limita la base por RLS)
import { useState, useEffect, useMemo, useCallback } from "react";
import { ToastStack, DialogHost, toast, confirmDialog, promptDialog } from "../../lib/ui";
import { printGiQuotePdf } from "../../lib/pdf-templates";
import DatePicker from "../components/DatePicker";
import { GI_CANALES, GI_ESTADOS, GI_FLUJO, resumenGI, totalAceptado, canalMasBarato, totalCanal, costosProveedor } from "../../lib/gi";
import {
  C, BG, LOGO, MONO, GOLD_GRADIENT, dq, dqTodos, arr, ok, ac, ensureFresh, sesionInicial, saveSession, clearSession, usarSesionPropia,
  fmtDate, fmtDateShort, fmtDateTime, fmtUSD, usd0, hace, hoyISO, nombre, buildQuoteWaMessage, cleanWaNumber, useMovil,
  Btn, Pill, Caja, Titulo, Chips, Vacio, Cargando, Modal, Campo, inp, Opciones, Dato, Fila, Codigo, Volver,
} from "./_base";
import { CotizadorWizard } from "./_cotizador";

const CSS = `@keyframes giShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
*{-webkit-tap-highlight-color:transparent}
.gi-scroll::-webkit-scrollbar{display:none}`;

// ────────────────────────────────────────────
// ENTRADA
// ────────────────────────────────────────────
export default function GIPage() {
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState("");

  const validar = async (s) => {
    const p = await dq("profiles", { token: s.access_token, filters: `?id=eq.${s.user.id}&select=id,role,is_gi_partner,email,gi_partner_pct` });
    const prof = arr(p)[0];
    if (!prof) return { error: "No se pudo cargar tu perfil." };
    if (!(["admin", "empleado"].includes(prof.role) || prof.is_gi_partner)) return { error: "Tu cuenta no tiene acceso al panel de Gestión Integral." };
    return { prof };
  };

  useEffect(() => { (async () => {
    const s = sesionInicial();
    if (s?.access_token && s.user?.id) {
      const r = await validar(s);
      if (r.prof) { setSesion(s); setPerfil(r.prof); }
      else { clearSession(); usarSesionPropia(); }
    }
    setCargando(false);
  })(); }, []);

  if (cargando) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.mute, fontFamily: "'Inter','Segoe UI',sans-serif" }}>Cargando…</div>;
  if (!sesion) return <Login err0={err} onLogin={async (s) => { usarSesionPropia(); saveSession(s); const r = await validar(s); if (!r.prof) { clearSession(); setErr(r.error); return r.error; } setSesion(s); setPerfil(r.prof); return null; }} />;
  return <>
    <style>{CSS}</style>
    <Shell sesion={sesion} perfil={perfil} onLogout={() => { clearSession(); setSesion(null); setPerfil(null); }} />
    <ToastStack /><DialogHost />
  </>;
}

function Login({ onLogin, err0 }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(err0 || "");
  const [lo, setLo] = useState(false);
  const enviar = async (e) => {
    e?.preventDefault?.();
    if (!email || !pass) return;
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
        <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.22em", color: C.goldHi, textTransform: "uppercase", margin: "10px 0 0" }}>Gestión Integral</p>
      </div>
      {err && <div style={{ padding: "10px 12px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, fontSize: 12.5, color: C.red, marginBottom: 12 }}>{err}</div>}
      <Campo label="Email"><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inp} /></Campo>
      <Campo label="Contraseña"><input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} style={inp} /></Campo>
      <Btn type="submit" v="gold" full disabled={lo} style={{ marginTop: 6, padding: "12px 16px" }}>{lo ? "Ingresando…" : "Ingresar"}</Btn>
    </form>
  </div>;
}

// ────────────────────────────────────────────
// DATOS (una carga para todo el panel)
// ────────────────────────────────────────────
function useDatos(token, rol) {
  const [d, setD] = useState(null);
  const cargar = useCallback(async () => {
    const plata = rol !== "empleado";
    const [reqs, comms, ops, cobros, pagos, earnings, socios, settings, clientesSocio] = await Promise.all([
      dq("gi_quote_requests", { token, filters: "?select=*,clients(id,first_name,last_name,client_code,whatsapp,email,gi_partner_id,gi_commission_pct),gi_quotes(*),gi_quote_request_products(id)&order=created_at.desc" }),
      dq("gi_quote_communications", { token, filters: "?select=quote_id,request_id,type,created_at,meta,content&order=created_at.desc&limit=2000" }),
      dq("operations", { token, filters: "?service_type=eq.gestion_integral&select=id,operation_code,status,channel,origin,client_id,description,budget_total,total_anticipos,eta,closed_at,created_at,gi_partner_id,gi_admin_owned,gi_commission_pct,is_collected,cost_flete,cost_impuestos_reales,cost_gasto_documental,cost_seguro,cost_flete_local,cost_otros,clients(id,first_name,last_name,client_code,whatsapp,gi_partner_id,gi_commission_pct)&order=created_at.desc" }),
      dq("operation_client_payments", { token, filters: "?select=operation_id,amount_usd,payment_date,operations!inner(service_type)&operations.service_type=eq.gestion_integral" }),
      plata ? dq("operation_supplier_payments", { token, filters: "?select=id,operation_id,amount_usd,amount_ars,type,is_paid,payment_date,notes,operations!inner(service_type,operation_code)&operations.service_type=eq.gestion_integral" }) : [],
      plata ? dq("gi_partner_earnings", { token, filters: "?select=*&order=closed_at.desc" }) : [],
      dq("profiles", { token, filters: "?is_gi_partner=eq.true&select=id,email,gi_partner_pct" }),
      dq("gi_settings", { token, filters: "?select=default_fx_rate&limit=1" }),
      plata ? dq("clients", { token, filters: "?gi_partner_id=not.is.null&select=id,first_name,last_name,client_code,gi_partner_id,gi_commission_pct&order=first_name.asc" }) : [],
    ]);
    setD({
      reqs: arr(reqs), comms: arr(comms), ops: arr(ops), cobros: arr(cobros), pagos: arr(pagos),
      earnings: arr(earnings), socios: arr(socios), fx: Number(arr(settings)[0]?.default_fx_rate || 0), clientesSocio: arr(clientesSocio),
    });
  }, [token, rol]);
  useEffect(() => { cargar(); const iv = setInterval(() => { if (!document.hidden) cargar(); }, 90000); return () => clearInterval(iv); }, [cargar]);
  return [d, cargar];
}

const quoteDe = (r) => (Array.isArray(r?.gi_quotes) ? [...r.gi_quotes].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] : null) || null;
const vencida = (q) => q?.expires_at && ["draft", "sent"].includes(q.status) && new Date(q.expires_at) < new Date(new Date().toDateString());

// Estado legible de una cotización + último movimiento del cliente.
function estadoCot(r, comms) {
  const q = quoteDe(r);
  const ev = q ? comms.filter((c) => c.quote_id === q.id) : [];
  const vistas = ev.filter((c) => c.type === "link_viewed");
  const ultimaVista = vistas[0]?.created_at || null;
  if (!q) return { k: "por_cotizar", l: "Por cotizar", c: C.amber, q, vistas: 0 };
  if (q.status === "converted") return { k: "convertida", l: "Convertida", c: C.green, q, vistas: vistas.length };
  if (q.status === "accepted" || q.status === "converting") return { k: "aceptada", l: "Aceptada", c: C.green, q, vistas: vistas.length, cuando: q.accepted_at };
  if (q.status === "rejected" || r.status === "rejected") return { k: "rechazada", l: "Rechazada", c: C.red, q, vistas: vistas.length, cuando: q.rejected_at, motivo: q.reject_reason || ev.find((c) => c.type === "rejected")?.meta?.reason };
  if (vencida(q)) return { k: "vencida", l: "Vencida", c: C.mute, q, vistas: vistas.length };
  if (q.status === "draft") return { k: "borrador", l: "Borrador", c: C.violet, q, vistas: 0 };
  if (ultimaVista) return { k: "enviada", l: `Vista ${hace(ultimaVista)}`, c: C.blue, q, vistas: vistas.length, ultimaVista };
  return { k: "enviada", l: "Enviada · sin abrir", c: C.sub, q, vistas: 0, sinAbrir: true };
}

// ────────────────────────────────────────────
// SHELL
// ────────────────────────────────────────────
const ICON = {
  inicio: ["M3 11l9-8 9 8", "M5 10v10h14V10"],
  cotizaciones: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M8 13h8", "M8 17h5"],
  operaciones: ["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z", "M3.3 7L12 12l8.7-5", "M12 22V12"],
  clientes: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 7a4 4 0 1 0 0 .01", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  socios: ["M12 1v22", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
  contactos: ["M3 7h18l-2 12H5L3 7z", "M8 7V5a4 4 0 0 1 8 0v2"],
  config: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-2.82-1.17l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.17 14H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.17-2.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.83 10H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
  mas: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
};
const Ico = ({ k, c, s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{(ICON[k] || []).map((d, i) => <path key={i} d={d} />)}</svg>;

function Shell({ sesion, perfil, onLogout }) {
  const token = sesion.access_token;
  const rol = perfil.role === "admin" ? "admin" : perfil.role === "empleado" ? "empleado" : "socio";
  const movil = useMovil();
  const [d, recargar] = useDatos(token, rol);
  const [nav, setNav] = useState(() => { try { return JSON.parse(sessionStorage.getItem("gi_nav") || "null") || { p: "inicio" }; } catch { return { p: "inicio" }; } });
  const [menu, setMenu] = useState(false);
  const ir = useCallback((p, extra = {}) => { const n = { p, ...extra }; setNav(n); setMenu(false); try { sessionStorage.setItem("gi_nav", JSON.stringify(n)); } catch {} window.scrollTo(0, 0); }, []);
  // Links directos desde el admin: /gi?op=<id> o /gi?cot=<id>
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    if (u.get("op")) ir("operaciones", { id: u.get("op") });
    else if (u.get("cot")) ir("cotizaciones", { id: u.get("cot") });
    if (u.get("op") || u.get("cot")) window.history.replaceState({}, "", "/gi");
  }, [ir]);
  const ctx = { token, rol, perfil, d, recargar, ir, movil };

  const pendientes = d ? d.reqs.filter((r) => ["por_cotizar", "aceptada"].includes(estadoCot(r, d.comms).k)).length : 0;
  const SECCIONES = [
    { s: "Gestión", items: [{ k: "inicio", l: "Inicio" }, { k: "cotizaciones", l: "Cotizaciones", badge: pendientes }, { k: "operaciones", l: "Operaciones" }] },
    { s: "Equipo", items: [rol === "admin" ? { k: "socios", l: "Socios" } : rol === "socio" ? { k: "socios", l: "Mis comisiones" } : null, { k: "contactos", l: "Contactos" }].filter(Boolean) },
    rol === "admin" ? { s: "Ajustes", items: [{ k: "config", l: "Configuración" }] } : null,
  ].filter(Boolean);
  const NAV = SECCIONES.flatMap((x) => x.items);

  let cuerpo;
  if (!d) cuerpo = <Cargando />;
  else if (nav.p === "cotizaciones") cuerpo = nav.wizard ? <CotizadorWizard token={token} rol={rol} requestId={nav.wizard} profileId={perfil.id} onBack={() => { recargar(); ir("cotizaciones", { id: nav.wizard }); }} /> : nav.id ? <CotDetalle ctx={ctx} id={nav.id} /> : <Cotizaciones ctx={ctx} />;
  else if (nav.p === "operaciones") cuerpo = nav.id ? <OpDetalle ctx={ctx} id={nav.id} /> : <Operaciones ctx={ctx} />;
  else if (nav.p === "socios" && rol !== "empleado") cuerpo = <Socios ctx={ctx} />;
  else if (nav.p === "contactos") cuerpo = <Contactos ctx={ctx} />;
  else if (nav.p === "config" && rol === "admin") cuerpo = <Configuracion ctx={ctx} />;
  else cuerpo = <Inicio ctx={ctx} />;

  const rolTxt = rol === "admin" ? "Admin" : rol === "empleado" ? "Empleado" : "Socio GI";
  const iniciales = (perfil.email || "GI").slice(0, 2).toUpperCase();
  const barra = <>
    <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, position: "relative" }}>
      <img src={LOGO} alt="Argencargo" style={{ width: "100%", height: "auto", maxHeight: 50, objectFit: "contain" }} />
      <span style={{ fontSize: 9.5, fontWeight: 900, padding: "3px 10px", borderRadius: 5, background: GOLD_GRADIENT, color: "#0A1628", letterSpacing: "0.18em" }}>GESTIÓN INTEGRAL</span>
      {movil && <button onClick={() => setMenu(false)} aria-label="Cerrar menú" style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", color: C.sub, fontSize: 20, cursor: "pointer" }}>✕</button>}
    </div>
    <nav style={{ flex: 1, padding: "10px 10px 14px", overflowY: "auto" }}>
      {SECCIONES.map((sec) => <div key={sec.s} style={{ marginTop: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.32)", margin: "0 0 6px", padding: "0 14px", textTransform: "uppercase", letterSpacing: "0.14em" }}>{sec.s}</p>
        {sec.items.map((it) => { const on = nav.p === it.k; return <button key={it.k} onClick={() => ir(it.k)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 14px", marginBottom: 1, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: on ? 700 : 500, background: on ? "linear-gradient(90deg, rgba(184,149,106,0.12), rgba(184,149,106,0.02))" : "transparent", color: on ? "#fff" : "rgba(255,255,255,0.55)", fontFamily: "inherit", textAlign: "left", position: "relative" }}>
          {on && <span style={{ position: "absolute", left: -10, top: 7, bottom: 7, width: 3, borderRadius: "0 3px 3px 0", background: GOLD_GRADIENT }} />}
          <Ico k={it.k} c={on ? C.goldHi : "rgba(255,255,255,0.45)"} s={17} />
          <span style={{ flex: 1 }}>{it.l}</span>
          {it.badge > 0 && <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999, background: GOLD_GRADIENT, color: "#0A1628" }}>{it.badge}</span>}
        </button>; })}
      </div>)}
    </nav>
    <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "50%", background: "linear-gradient(135deg, rgba(184,149,106,0.22), rgba(184,149,106,0.08))", border: "1px solid rgba(184,149,106,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: C.goldHi }}>{iniciales}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", margin: 0 }}>{rolTxt}</p>
          <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perfil.email}</p>
        </div>
      </div>
      <button onClick={onLogout} style={{ width: "100%", padding: "8px 10px", fontSize: 11.5, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.55)", cursor: "pointer", fontWeight: 600, letterSpacing: "0.04em", fontFamily: "inherit" }}>Cerrar sesión</button>
    </div>
  </>;

  return <div style={{ minHeight: "100vh", background: BG, color: C.txt, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
    {/* El body es blanco por defecto: asomaba como una línea blanca en el borde derecho (20/10/2026). */}
    <style>{`html,body{background:#0A1628 !important;overflow-x:hidden}`}</style>
    {!movil && <aside style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(12px)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", zIndex: 5 }}>{barra}</aside>}
    {movil && <header style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, padding: "0 16px", background: "rgba(10,22,40,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={() => setMenu(true)} aria-label="Abrir menú" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", padding: "8px 10px", borderRadius: 8, cursor: "pointer", display: "inline-flex" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>
      <img src={LOGO} alt="Argencargo" style={{ height: 30, objectFit: "contain" }} />
      <span style={{ fontSize: 8.5, fontWeight: 900, padding: "3px 7px", borderRadius: 4, background: GOLD_GRADIENT, color: "#0A1628", letterSpacing: "0.14em" }}>GI</span>
    </header>}
    {movil && menu && <>
      <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }} />
      <aside style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 270, background: "#0b1729", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", zIndex: 41 }}>{barra}</aside>
    </>}
    <main style={{ marginLeft: movil ? 0 : 220, padding: movil ? "18px 16px 40px" : "30px 36px 48px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>{cuerpo}</div>
    </main>
  </div>;
}

// ────────────────────────────────────────────
// INICIO: lo que hay que hacer hoy, en listas planas
// ────────────────────────────────────────────
function Inicio({ ctx }) {
  const { d, rol, ir, movil } = ctx;
  const cots = d.reqs.map((r) => ({ r, e: estadoCot(r, d.comms) }));
  const ahora = Date.now();
  const aceptadas = cots.filter((x) => x.e.k === "aceptada");
  const porCotizar = cots.filter((x) => x.e.k === "por_cotizar" && !["rejected", "converted", "cancelled"].includes(x.r.status));
  const borradores = cots.filter((x) => x.e.k === "borrador");
  const vistasSinResp = cots.filter((x) => x.e.k === "enviada" && x.e.ultimaVista && ahora - new Date(x.e.ultimaVista).getTime() > 24 * 3600e3);
  const sinAbrir = cots.filter((x) => x.e.k === "enviada" && x.e.sinAbrir && x.e.q?.sent_at && ahora - new Date(x.e.q.sent_at).getTime() > 2 * 86400e3);
  const porVencer = cots.filter((x) => x.e.k === "enviada" && x.e.q?.expires_at && new Date(x.e.q.expires_at).getTime() - ahora < 2 * 86400e3);

  const cobradoPor = {}; d.cobros.forEach((c) => { cobradoPor[c.operation_id] = (cobradoPor[c.operation_id] || 0) + Number(c.amount_usd || 0); });
  const activas = d.ops.filter((o) => !["operacion_cerrada", "cancelada"].includes(o.status));
  const conSaldo = activas.map((o) => ({ o, saldo: Number(o.budget_total || 0) - (cobradoPor[o.id] || 0) })).filter((x) => x.saldo > 0.5);
  const paraCobrar = conSaldo.filter((x) => x.o.status === "entregada");
  const paraCerrar = activas.filter((o) => o.status === "entregada" && Number(o.budget_total || 0) - (cobradoPor[o.id] || 0) <= 0.5);
  const pagosPend = d.pagos.filter((p) => !p.is_paid && p.type !== "refund");
  const totalSaldo = conSaldo.reduce((s, x) => s + x.saldo, 0);
  const enCurso = activas.reduce((s, o) => s + Number(o.budget_total || 0), 0);

  // Números de los últimos 90 días.
  const desde90 = ahora - 90 * 86400e3;
  const conRespuesta = cots.filter((x) => x.e.q && new Date(x.r.created_at).getTime() > desde90 && ["aceptada", "convertida", "rechazada", "vencida"].includes(x.e.k));
  const ganadas = conRespuesta.filter((x) => ["aceptada", "convertida"].includes(x.e.k)).length;
  const tasa = conRespuesta.length ? Math.round((ganadas / conRespuesta.length) * 100) : null;
  const mesIni = new Date(); mesIni.setDate(1); mesIni.setHours(0, 0, 0, 0);
  const cotMes = cots.filter((x) => new Date(x.r.created_at) >= mesIni).length;

  const tareas = [
    { t: "Aceptadas · pasar a operación", c: C.green, items: aceptadas.map((x) => ({ k: x.r.id, code: x.r.request_code, n: nombre(x.r.clients), der: <Pill c={C.green}>Aceptada</Pill>, go: () => ir("cotizaciones", { id: x.r.id }) })) },
    { t: "Para cobrar · listas para entregar", c: C.green, items: paraCobrar.map(({ o, saldo }) => ({ k: o.id, code: o.operation_code, n: nombre(o.clients), der: <strong style={{ color: C.green, fontVariantNumeric: "tabular-nums" }}>{usd0(saldo)}</strong>, go: () => ir("operaciones", { id: o.id }) })) },
    rol === "admin" ? { t: "Para cerrar · entregadas y cobradas", c: C.goldHi, items: paraCerrar.map((o) => ({ k: o.id, code: o.operation_code, n: nombre(o.clients), der: <Pill c={C.goldHi}>Cerrar</Pill>, go: () => ir("operaciones", { id: o.id }) })) } : null,
    { t: "Pedidos sin cotizar", c: C.amber, items: porCotizar.map((x) => ({ k: x.r.id, code: x.r.request_code, n: nombre(x.r.clients), der: <span style={{ fontSize: 12, color: C.mute }}>{hace(x.r.created_at)}</span>, go: () => ir("cotizaciones", { id: x.r.id }) })) },
    { t: "La vieron y no respondieron", c: C.blue, items: vistasSinResp.map((x) => ({ k: x.r.id, code: x.r.request_code, n: nombre(x.r.clients), der: <span style={{ fontSize: 12, color: C.mute }}>vista {hace(x.e.ultimaVista)}</span>, go: () => ir("cotizaciones", { id: x.r.id }) })) },
    { t: "Enviadas hace más de 2 días sin abrir", c: C.sub, items: sinAbrir.map((x) => ({ k: x.r.id, code: x.r.request_code, n: nombre(x.r.clients), der: null, go: () => ir("cotizaciones", { id: x.r.id }) })) },
    { t: "Vencen en menos de 2 días", c: C.red, items: porVencer.map((x) => ({ k: x.r.id, code: x.r.request_code, n: nombre(x.r.clients), der: <span style={{ fontSize: 12, color: C.red }}>{fmtDateShort(x.e.q.expires_at)}</span>, go: () => ir("cotizaciones", { id: x.r.id }) })) },
    { t: "Borradores sin enviar", c: C.violet, items: borradores.map((x) => ({ k: x.r.id, code: x.r.request_code, n: nombre(x.r.clients), der: null, go: () => ir("cotizaciones", { id: x.r.id }) })) },
    rol === "admin" ? { t: "Pagos a proveedor pendientes", c: C.amber, items: pagosPend.map((p) => ({ k: p.id, code: p.operations?.operation_code || "—", n: p.notes || "Pago a proveedor", der: <strong style={{ color: C.amber, fontVariantNumeric: "tabular-nums" }}>{Number(p.amount_usd || 0) > 0 ? usd0(p.amount_usd) : `ARS ${Number(p.amount_ars || 0).toLocaleString("es-AR")}`}</strong>, go: () => ir("operaciones", { id: p.operation_id }) })) } : null,
  ].filter((g) => g && g.items.length);

  // Actividad reciente: lo que hizo el cliente con las cotizaciones.
  const reqPorQuote = {}; d.reqs.forEach((r) => (r.gi_quotes || []).forEach((q) => { reqPorQuote[q.id] = r; }));
  const actividad = d.comms.filter((c) => ["link_viewed", "accepted", "rejected", "account_created", "converted"].includes(c.type)).slice(0, 12).map((c) => ({ c, r: reqPorQuote[c.quote_id] || d.reqs.find((r) => r.id === c.request_id) })).filter((x) => x.r);

  const Stat = ({ l, v, sub, c }) => <div style={{ padding: "16px 18px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14 }}>
    <p style={{ fontSize: 10.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>{l}</p>
    <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color: c || C.txt, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{v}</p>
    {sub && <p style={{ fontSize: 11.5, color: C.mute, margin: "5px 0 0" }}>{sub}</p>}
  </div>;

  return <div>
    <Titulo eyebrow="Gestión Integral" sub="Lo que hay que mover hoy: respuestas de clientes, cobros, cierres y pedidos sin cotizar." right={<Btn v="gold" onClick={() => ir("cotizaciones", { nueva: 1 })}>+ Nueva cotización</Btn>}>Inicio</Titulo>
    <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
      <Stat l="Cotizaciones del mes" v={String(cotMes)} sub={`${cots.filter((x) => x.e.k === "enviada").length} esperando respuesta`} />
      <Stat l="Aceptación" v={tasa == null ? "—" : `${tasa}%`} sub="últimos 90 días" c={tasa == null ? C.mute : tasa >= 40 ? C.green : C.amber} />
      <Stat l="En curso" v={usd0(enCurso)} sub={`${activas.length} ${activas.length === 1 ? "operación" : "operaciones"}`} />
      <Stat l="Por cobrar" v={usd0(totalSaldo)} sub={`${conSaldo.length} con saldo`} c={totalSaldo > 0 ? C.amber : C.txt} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1.35fr 1fr", gap: 14, alignItems: "start" }}>
      <div>
        {tareas.length === 0 ? <Caja title="Para hacer"><p style={{ margin: 0, color: C.mute, fontSize: 13.5 }}>Todo al día, no hay nada pendiente.</p></Caja> : tareas.map((g) => <Caja key={g.t} title={<span style={{ color: g.c }}>{g.t} · {g.items.length}</span>} pad={12}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {g.items.slice(0, 6).map((it) => <div key={it.k} onClick={it.go} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 9, cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHi; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              <Codigo>{it.code}</Codigo>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.n}</span>
              {it.der}
            </div>)}
            {g.items.length > 6 && <p style={{ margin: "4px 8px 0", fontSize: 12, color: C.mute }}>y {g.items.length - 6} más</p>}
          </div>
        </Caja>)}
      </div>
      <div>
        <Caja title="Operaciones en curso" right={<Btn small v="ghost" onClick={() => ir("operaciones")}>Ver todas</Btn>} pad={12}>
          {activas.length === 0 ? <p style={{ margin: 0, color: C.mute, fontSize: 13 }}>No hay operaciones en curso.</p> : activas.slice(0, 6).map((o) => { const st = GI_ESTADOS[o.status] || { l: o.status, c: C.sub }; const i = GI_FLUJO.indexOf(o.status); const pct = i < 0 ? 0 : Math.round(((i + 1) / (GI_FLUJO.length - 1)) * 100); return <div key={o.id} onClick={() => ir("operaciones", { id: o.id })} style={{ padding: "10px 8px", borderRadius: 9, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Codigo>{o.operation_code}</Codigo>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre(o.clients)}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: st.c }}>{st.l}</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", marginTop: 8, overflow: "hidden" }}><div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: st.c, borderRadius: 4 }} /></div>
          </div>; })}
        </Caja>
        <Caja title="Actividad de clientes" pad={12}>
          {actividad.length === 0 ? <p style={{ margin: 0, color: C.mute, fontSize: 13 }}>Sin movimientos.</p> : actividad.map(({ c, r }, i) => { const t = TIPO_EV[c.type] || { i: "·", l: c.type }; return <div key={i} onClick={() => ir("cotizaciones", { id: r.id })} style={{ display: "flex", gap: 10, padding: "8px", borderRadius: 9, cursor: "pointer", alignItems: "center" }}>
            <span style={{ width: 20, textAlign: "center" }}>{t.i}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre(r.clients)} <span style={{ color: C.mute, fontWeight: 500 }}>· {r.request_code}</span></p>
              <p style={{ margin: "1px 0 0", fontSize: 11.5, color: C.mute }}>{t.l}</p>
            </div>
            <span style={{ fontSize: 11, color: C.mute, whiteSpace: "nowrap" }}>{hace(c.created_at)}</span>
          </div>; })}
        </Caja>
      </div>
    </div>
  </div>;
}

// Tablero por etapas: columnas en la compu, secciones apiladas en el celu. Lo cerrado va aparte.
function Tablero({ cols, movil, render, vacio = "—" }) {
  const conItems = movil ? cols.filter((c) => c.items.length) : cols;
  if (movil && !conItems.length) return <Vacio>Nada en curso.</Vacio>;
  return <div style={{ display: movil ? "block" : "grid", gridTemplateColumns: movil ? undefined : `repeat(${cols.length},minmax(0,1fr))`, gap: 12, alignItems: "start", marginBottom: 18 }}>
    {conItems.map((col) => <div key={col.k} style={{ background: movil ? "transparent" : "rgba(255,255,255,0.02)", border: movil ? "none" : `1px solid ${C.line}`, borderRadius: 14, padding: movil ? 0 : 10, marginBottom: movil ? 16 : 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: movil ? "0 2px 8px" : "4px 4px 10px" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.c }} />
        <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: C.sub }}>{col.l}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.mute }}>{col.items.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {col.items.length === 0 ? <p style={{ margin: "4px 4px 8px", fontSize: 12, color: C.mute }}>{vacio}</p> : col.items.map(render)}
      </div>
    </div>)}
  </div>;
}

function Tarjeta({ onClick, arriba, titulo, abajo, acento }) {
  return <div onClick={onClick} style={{ padding: "11px 12px", background: "rgba(10,22,40,0.7)", border: `1px solid ${C.line}`, borderLeft: `3px solid ${acento || C.line}`, borderRadius: 10, cursor: "pointer", transition: "border-color 120ms" }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(201,164,106,0.4)"; e.currentTarget.style.borderLeftColor = acento || C.gold; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.borderLeftColor = acento || C.line; }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>{arriba}</div>
    <p style={{ margin: "6px 0 0", fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</p>
    {abajo && <div style={{ marginTop: 6, fontSize: 11.5, color: C.mute, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>{abajo}</div>}
  </div>;
}

function Historial({ titulo, items, render }) {
  const [abierto, setAbierto] = useState(false);
  if (!items.length) return null;
  return <div>
    <button onClick={() => setAbierto((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: C.sub, fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: "6px 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
      <span style={{ display: "inline-block", transform: abierto ? "rotate(90deg)" : "none", transition: "transform 150ms" }}>›</span>{titulo} · {items.length}
    </button>
    {abierto && <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>{items.map(render)}</div>}
  </div>;
}

function Cotizaciones({ ctx }) {
  const { d, ir, movil } = ctx;
  const [q, setQ] = useState("");
  const [nueva, setNueva] = useState(false);
  useEffect(() => { try { const n = JSON.parse(sessionStorage.getItem("gi_nav") || "{}"); if (n.nueva) { setNueva(true); sessionStorage.setItem("gi_nav", JSON.stringify({ p: "cotizaciones" })); } } catch {} }, []);
  const s = q.trim().toLowerCase();
  const filas = d.reqs.map((r) => ({ r, e: estadoCot(r, d.comms) })).filter((x) => !s || `${x.r.request_code} ${nombre(x.r.clients)} ${x.r.clients?.client_code || ""}`.toLowerCase().includes(s));
  const de = (ks) => filas.filter((x) => ks.includes(x.e.k));
  const cols = [
    { k: "pc", l: "Por cotizar", c: C.amber, items: de(["por_cotizar"]) },
    { k: "bo", l: "Borradores", c: C.violet, items: de(["borrador"]) },
    { k: "en", l: "Esperando respuesta", c: C.blue, items: de(["enviada"]) },
    { k: "ac", l: "Aceptadas", c: C.green, items: de(["aceptada"]) },
  ];
  const tarjeta = ({ r, e }) => {
    const qt = e.q; const total = qt ? (totalAceptado(qt) || canalMasBarato(qt)?.t || 0) : 0;
    return <Tarjeta key={r.id} onClick={() => ir("cotizaciones", { id: r.id })} acento={e.c}
      arriba={<><Codigo>{r.request_code}</Codigo><span style={{ fontSize: 11, color: e.c, fontWeight: 700 }}>{e.k === "enviada" ? (e.sinAbrir ? "sin abrir" : `vista ${hace(e.ultimaVista)}`) : hace(r.created_at)}</span></>}
      titulo={nombre(r.clients)}
      abajo={<><span>{total > 0 ? `${totalAceptado(qt) ? "" : "desde "}${usd0(total)}` : "sin precio"}</span>{qt?.expires_at && e.k === "enviada" ? <span>vence {fmtDateShort(qt.expires_at)}</span> : null}</>} />;
  };
  const cerradas = de(["convertida", "rechazada", "vencida"]);
  return <div>
    <Titulo eyebrow="Gestión Integral" sub="Cada pedido de cotización desde que entra hasta que el cliente responde. Tocá una para ver el detalle, el historial y mandarla." right={<Btn v="gold" onClick={() => setNueva(true)}>+ Nueva cotización</Btn>}>Cotizaciones</Titulo>
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o cliente" style={{ ...inp, marginBottom: 14, maxWidth: movil ? "100%" : 360 }} />
    <Tablero cols={cols} movil={movil} render={tarjeta} vacio="Ninguna" />
    <Historial titulo="Convertidas, rechazadas y vencidas" items={cerradas} render={({ r, e }) => <Fila key={r.id} onClick={() => ir("cotizaciones", { id: r.id })}>
      <Codigo>{r.request_code}</Codigo>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre(r.clients)}</span>
      {e.vistas > 0 && <span style={{ fontSize: 11.5, color: C.mute }}>{e.vistas} vistas</span>}
      <Pill c={e.c}>{e.k === "convertida" && e.q?.operation_id ? `→ ${d.ops.find((o) => o.id === e.q.operation_id)?.operation_code || "Operación"}` : e.l}</Pill>
    </Fila>} />
    {nueva && <NuevaCotizacion ctx={ctx} onClose={() => setNueva(false)} />}
  </div>;
}

// ────────────────────────────────────────────
// COTIZACIONES
// ────────────────────────────────────────────
function NuevaCotizacion({ ctx, onClose }) {
  const { token, rol, perfil, d, ir, recargar } = ctx;
  const staff = rol !== "socio";
  const [clientes, setClientes] = useState(null);
  const [modo, setModo] = useState("existente");
  const [busca, setBusca] = useState("");
  const [cli, setCli] = useState(null);
  const [nuevo, setNuevo] = useState({ first_name: "", last_name: "", whatsapp: "" });
  const [socio, setSocio] = useState(staff ? "" : perfil.id);
  const [origen, setOrigen] = useState("china");
  const [dias, setDias] = useState("7");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { (async () => { setClientes(await dqTodos("clients", { token, filters: "?select=id,first_name,last_name,client_code,whatsapp,gi_partner_id&order=first_name.asc" })); })(); }, [token]);
  const s = busca.trim().toLowerCase();
  const encontrados = (clientes || []).filter((c) => s.length >= 2 && `${c.first_name || ""} ${c.last_name || ""} ${c.client_code || ""} ${c.whatsapp || ""}`.toLowerCase().includes(s)).slice(0, 8);
  const elegir = (c) => { setCli(c); setBusca(""); if (staff) setSocio(c.gi_partner_id || ""); };

  const crearCliente = async () => {
    const first = nuevo.first_name.trim(), last = nuevo.last_name.trim() || "—";
    const norm = (x) => (x || "").normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const base = (norm(first).slice(0, 3) + norm(last === "—" ? first : last).slice(0, 3)).padEnd(6, "X");
    for (const code of [base, ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => base.slice(0, 5) + n)]) {
      const r = await dq("clients", { method: "POST", token, body: { first_name: first, last_name: last, client_code: code, gi_partner_id: socio || null, whatsapp: nuevo.whatsapp.trim() || "—", email: "—", street: "—", postal_code: "—", city: "—", province: "—", tax_condition: "ninguna" } });
      const row = arr(r)[0];
      if (row?.id) return row;
      if (!String(r?.message || "").includes("duplicate")) break;
    }
    return null;
  };

  const crear = async () => {
    if (guardando) return;
    if (modo === "existente" && !cli) { toast.error("Elegí el cliente"); return; }
    if (modo === "nuevo" && !nuevo.first_name.trim()) { toast.error("Poné al menos el nombre"); return; }
    setGuardando(true);
    try {
      const c = modo === "nuevo" ? await crearCliente() : cli;
      if (!c?.id) throw new Error("No se pudo crear el cliente");
      if (modo === "existente" && staff && (socio || null) !== (cli.gi_partner_id || null)) {
        await dq("clients", { method: "PATCH", token, filters: `?id=eq.${c.id}`, body: { gi_partner_id: socio || null } });
      }
      // Socio (20/10/2026): ve toda la clientela; si el cliente no tenía socio, queda suyo.
      if (modo === "existente" && !staff && !cli.gi_partner_id) {
        await dq("rpc/gi_tomar_cliente", { method: "POST", token, body: { p_client: c.id } });
      }
      const code = await dq("rpc/gi_next_request_code", { method: "POST", token, body: {} });
      if (typeof code !== "string" || !code.startsWith("GI-")) throw new Error("No se pudo generar el código");
      const cuerpo = { request_code: code, client_id: c.id, assigned_partner_id: socio || null, origin: origen, notes: notas.trim() || null, status: "quoting", expires_at: new Date(Date.now() + Number(dias) * 86400000).toISOString().slice(0, 10) };
      let ins = await dq("gi_quote_requests", { method: "POST", token, body: cuerpo });
      // Hasta que se corra el SQL del 20/10 la columna origin no existe: se crea igual, sin origen.
      if (!Array.isArray(ins) && /origin/.test(String(ins?.message || ""))) { delete cuerpo.origin; ins = await dq("gi_quote_requests", { method: "POST", token, body: cuerpo }); }
      const id = arr(ins)[0]?.id;
      if (!id) throw new Error("No se pudo crear la cotización");
      toast.success(`${code} creada`);
      recargar();
      onClose();
      ir("cotizaciones", { wizard: id });
    } catch (e) { toast.error(e.message); }
    setGuardando(false);
  };

  return <Modal title="Nueva cotización" onClose={onClose} footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn v="gold" onClick={crear} disabled={guardando}>{guardando ? "Creando…" : "Crear y cotizar"}</Btn></>}>
    <Opciones value={modo} onChange={(k) => { setModo(k); }} cols={2} items={[{ k: "existente", l: "Cliente existente" }, { k: "nuevo", l: "Nuevo cliente" }]} />
    <div style={{ height: 14 }} />
    {modo === "existente" ? (cli ? <Fila style={{ marginBottom: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, fontWeight: 800 }}>{nombre(cli)}</p><p style={{ margin: "2px 0 0", fontSize: 11.5, color: C.mute }}>{cli.client_code}{cli.whatsapp && cli.whatsapp !== "—" ? ` · ${cli.whatsapp}` : ""}</p></div>
      <Btn small onClick={() => setCli(null)}>Cambiar</Btn>
    </Fila> : <Campo label={staff ? "Buscar entre todos los clientes" : "Buscar entre tus clientes"}>
      <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nombre, código o WhatsApp" style={inp} />
      {clientes === null && <p style={{ fontSize: 12, color: C.mute, margin: "8px 0 0" }}>Cargando clientes…</p>}
      {encontrados.length > 0 && <div style={{ marginTop: 6, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
        {encontrados.map((c) => <button key={c.id} type="button" onClick={() => elegir(c)} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 12px", border: "none", borderBottom: `1px solid ${C.line}`, background: "transparent", color: C.txt, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, textAlign: "left" }}>
          <strong>{nombre(c)}</strong><span style={{ fontFamily: MONO, fontSize: 11, color: C.goldHi }}>{c.client_code}</span>
        </button>)}
      </div>}
      {s.length >= 2 && clientes && encontrados.length === 0 && <div style={{ marginTop: 8, fontSize: 12.5, color: C.sub }}>No aparece. <button type="button" onClick={() => { const [a, ...b] = busca.trim().split(/\s+/); setNuevo((n) => ({ ...n, first_name: a || "", last_name: b.join(" ") })); setModo("nuevo"); }} style={{ background: "none", border: "none", color: C.goldHi, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, padding: 0 }}>Crearlo como cliente nuevo</button></div>}
    </Campo>) : <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Campo label="Nombre"><input autoFocus value={nuevo.first_name} onChange={(e) => setNuevo({ ...nuevo, first_name: e.target.value })} style={inp} /></Campo>
        <Campo label="Apellido"><input value={nuevo.last_name} onChange={(e) => setNuevo({ ...nuevo, last_name: e.target.value })} style={inp} /></Campo>
      </div>
      <Campo label="WhatsApp"><input inputMode="tel" value={nuevo.whatsapp} onChange={(e) => setNuevo({ ...nuevo, whatsapp: e.target.value })} placeholder="11 2345 6789" style={inp} /></Campo>
    </>}
    {staff && <Campo label="Socio">
      <Opciones value={socio} onChange={setSocio} items={[{ k: "", l: "Argencargo" }, ...d.socios.map((p) => ({ k: p.id, l: p.email.split("@")[0] }))]} />
    </Campo>}
    <Campo label="Origen de la mercadería">
      <Opciones value={origen} onChange={setOrigen} cols={2} items={[{ k: "china", l: "🇨🇳 China" }, { k: "usa", l: "🇺🇸 Estados Unidos" }]} />
    </Campo>
    <Campo label="Válida por">
      <Opciones value={dias} onChange={setDias} cols={4} items={[{ k: "7", l: "7 días" }, { k: "15", l: "15 días" }, { k: "30", l: "30 días" }, { k: "60", l: "60 días" }]} />
    </Campo>
    <Campo label="Notas (internas)"><textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Campo>
  </Modal>;
}

const TIPO_EV = {
  link_generated: { i: "🔗", l: "Link generado" },
  link_regenerated: { i: "🔄", l: "Cotización editada" },
  link_viewed: { i: "👁", l: "El cliente abrió la cotización" },
  link_copied: { i: "📋", l: "Link copiado" },
  wpp_sent: { i: "💬", l: "Enviada por WhatsApp" },
  account_created: { i: "👤", l: "El cliente creó su cuenta" },
  accepted: { i: "✅", l: "El cliente aceptó" },
  rejected: { i: "✕", l: "Rechazada" },
  converted: { i: "📦", l: "Pasó a operación" },
  note: { i: "📝", l: "Nota" },
};

function CotDetalle({ ctx, id }) {
  const { token, rol, perfil, d, ir, recargar, movil } = ctx;
  const r = d.reqs.find((x) => x.id === id);
  const [prods, setProds] = useState(null);
  const [bultos, setBultos] = useState([]);
  const [nota, setNota] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [fotoGrande, setFotoGrande] = useState(null);
  const e = r ? estadoCot(r, d.comms) : null;
  const q = e?.q;
  useEffect(() => { (async () => {
    if (!r) return;
    const [qp, rp, pk] = await Promise.all([
      q ? dq("gi_quote_products", { token, filters: `?quote_id=eq.${q.id}&select=*&order=display_order.asc` }) : [],
      dq("gi_quote_request_products", { token, filters: `?request_id=eq.${id}&select=*&order=display_order.asc` }),
      q ? dq("gi_quote_packages", { token, filters: `?quote_id=eq.${q.id}&select=*&order=display_order.asc` }).catch(() => []) : [],
    ]);
    const lista = arr(qp).length ? arr(qp) : arr(rp);
    setProds(lista);
    // Bultos de la cotización; las viejas los traen por producto.
    const pks = arr(pk);
    setBultos(pks.length ? pks.map((k) => ({ n: Number(k.pkg_count || 0), l: k.length_cm, w: k.width_cm, h: k.height_cm, kg: k.weight_kg, prods: Array.isArray(k.product_idx) ? k.product_idx : [] }))
      : lista.map((p, i) => Number(p.pkg_count || 0) > 0 && p.pkg_length_cm ? { n: Number(p.pkg_count), l: p.pkg_length_cm, w: p.pkg_width_cm, h: p.pkg_height_cm, kg: p.pkg_weight_kg, prods: [i] } : null).filter(Boolean));
  })(); }, [id, q?.id, token]);
  if (!r) return <div><Volver onClick={() => ir("cotizaciones")} /><Vacio>No se encontró la cotización.</Vacio></div>;

  const ev = d.comms.filter((c) => (q && c.quote_id === q.id) || (!c.quote_id && c.request_id === id));
  const url = q?.public_token ? `${window.location.origin}/cotizacion/${q.public_token}` : "";
  const log = (type, extra = {}) => dq("gi_quote_communications", { method: "POST", token, body: { quote_id: q?.id || null, request_id: id, type, author_id: perfil.id, ...extra } });
  const staff = rol !== "socio";
  const verPlata = rol !== "empleado";
  const op = q?.operation_id ? d.ops.find((o) => o.id === q.operation_id) : null;
  const socio = d.socios?.find((s) => s.id === (r.assigned_partner_id || r.clients?.gi_partner_id));

  const enviarWa = async () => {
    const num = cleanWaNumber(r.clients?.whatsapp && r.clients.whatsapp !== "—" ? r.clients.whatsapp : "");
    const txt = encodeURIComponent(buildQuoteWaMessage({ firstName: r.clients?.first_name || "", code: r.request_code, url, expiresAt: q?.expires_at }));
    window.open(num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`, "_blank", "noopener");
    if (q?.status === "draft") await dq("gi_quotes", { method: "PATCH", token, filters: `?id=eq.${q.id}`, body: { status: "sent", sent_at: new Date().toISOString() } });
    await log("wpp_sent"); recargar();
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(url); toast.success("Link copiado"); } catch { toast.info(url); } await log("link_copied"); recargar(); };
  const convertir = async () => {
    if (!await confirmDialog(`¿Pasar ${r.request_code} a operación? Se crea la AC con los productos, el total y el canal que eligió el cliente.`)) return;
    setTrabajando(true);
    try {
      const res = await fetch("/api/gi/convert-quote", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await ensureFresh(token)}` }, body: JSON.stringify({ quote_id: q.id }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "No se pudo convertir");
      toast.success(`${j.operation_code} creada`);
      await recargar();
      ir("operaciones", { id: j.operation_id });
    } catch (err) { toast.error(err.message); }
    setTrabajando(false);
  };
  const rechazar = async () => {
    const motivo = await promptDialog("¿Por qué se cae? (queda registrado)", { defaultValue: "" });
    if (motivo === null || motivo === undefined) return;
    if (q) {
      const res = await dq("gi_quotes", { method: "PATCH", token, filters: `?id=eq.${q.id}`, body: { status: "rejected", rejected_at: new Date().toISOString(), reject_reason: motivo || null } });
      if (!ok(res)) { toast.error("No se pudo marcar (¿falta correr el SQL del 13/10?)"); return; }
    }
    await dq("gi_quote_requests", { method: "PATCH", token, filters: `?id=eq.${id}`, body: { status: "rejected" } });
    await log("rejected", { meta: { reason: motivo || null, manual: true, email: perfil.email } });
    toast.success("Marcada como rechazada"); recargar();
  };
  const borrar = async () => {
    if (!await confirmDialog(`¿Borrar ${r.request_code}? No se puede deshacer.`, { danger: true })) return;
    await dq("gi_quote_requests", { method: "DELETE", token, filters: `?id=eq.${id}` });
    toast.success("Cotización borrada"); await recargar(); ir("cotizaciones");
  };
  const renovar = async () => {
    const v = await promptDialog("¿Por cuántos días más?", { defaultValue: "7" });
    const n = Number(v);
    if (!(n > 0)) return;
    const hasta = new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const res = await dq("gi_quotes", { method: "PATCH", token, filters: `?id=eq.${q.id}`, body: { expires_at: hasta, status: q.status === "draft" ? "draft" : "sent" } });
    if (!ok(res)) { toast.error("No se pudo renovar"); return; }
    await dq("gi_quote_requests", { method: "PATCH", token, filters: `?id=eq.${id}`, body: { expires_at: hasta, ...(r.status === "rejected" ? { status: "quoted" } : {}) } });
    await log("note", { content: `Validez renovada hasta el ${fmtDate(hasta)}` });
    toast.success(`Vigente hasta el ${fmtDate(hasta)}`); recargar();
  };
  const agregarNota = async () => { const t = nota.trim(); if (!t) return; await log("note", { content: t }); setNota(""); recargar(); };
  const pdf = () => printGiQuotePdf({ quote: q, products: prods || [], client: r.clients, settings: null, requestCode: r.request_code });

  // ── Números ──
  const lista = prods || [];
  const origen = r.origin || lista[0]?.origin || "china";
  const esUSA = origen === "usa";
  const fob = lista.reduce((s, p) => s + Number(p.unit_cost_usd || 0) * Number(p.quantity || 0), 0);
  const nBultos = bultos.reduce((s, k) => s + k.n, 0);
  const cbm = bultos.reduce((s, k) => s + (Number(k.l || 0) * Number(k.w || 0) * Number(k.h || 0) * k.n) / 1e6, 0);
  const kg = bultos.reduce((s, k) => s + Number(k.kg || 0) * k.n, 0);
  const TIEMPO = { aereo_blanco: "7 a 10 días hábiles", maritimo_blanco: "~60 días", maritimo_negro: "~60 días" };
  const honor = Number(q?.honorarios_pct || 0);
  const canales = Object.entries(GI_CANALES).filter(([k]) => !esUSA || k !== "maritimo_blanco").map(([k, c]) => {
    const total = totalCanal(q, k); const real = Number(q?.[c.key.replace("_total_", "_real_")] || 0);
    const impo = honor > 0 ? total / (1 + honor / 100) : total;
    return { k, ...c, total, real, impo, honorarios: total - impo, gana: real > 0 ? total - real : null };
  }).filter((c) => c.total > 0);
  const masBarato = canales.slice().sort((a, b) => a.total - b.total)[0];
  const elegido = q?.selected_channel ? canales.find((c) => c.k === q.selected_channel) : null;
  const totalElegido = totalAceptado(q);
  const baseCliente = totalElegido || masBarato?.total || 0;
  const plan = Array.isArray(q?.payment_plan) ? q.payment_plan : (q?.payment_plan ? (() => { try { return JSON.parse(q.payment_plan); } catch { return []; } })() : []);
  const respuesta = ev.find((c) => c.type === "accepted" || c.type === "rejected");
  const n2 = (v) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nombreProd = (i) => { const t = (lista[i]?.description || "").trim(); return t ? (t.length > 28 ? t.slice(0, 26) + "…" : t) : `Producto ${i + 1}`; };
  const fotosDe = (p) => Array.isArray(p.photo_urls) && p.photo_urls.length ? p.photo_urls : (p.photo_url ? [p.photo_url] : []);

  const Dato = ({ l, v, sub, c }) => <div style={{ minWidth: 0 }}><p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.mute, whiteSpace: "nowrap" }}>{l}</p><p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 800, color: c || C.txt, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</p>{sub && <p style={{ margin: "1px 0 0", fontSize: 11, color: C.mute, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</p>}</div>;
  const Tag = ({ c, children }) => <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, color: c, background: `${c}1f`, border: `1px solid ${c}55`, whiteSpace: "nowrap" }}>{children}</span>;
  const sec = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 12 };
  const tit = { margin: "0 0 10px", fontSize: 11, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.1em" };

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <Volver onClick={() => ir("cotizaciones")} />
      {e.vistas > 0 && <span style={{ fontSize: 12, color: C.mute }}>👁 El cliente la abrió {e.vistas} {e.vistas === 1 ? "vez" : "veces"}{e.ultimaVista ? ` · última ${hace(e.ultimaVista)}` : ""}</span>}
    </div>

    {/* Cabecera */}
    <section style={{ ...sec, padding: "18px 20px", borderColor: `${e.c}44`, background: `linear-gradient(180deg, ${e.c}10, ${C.card})` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, color: C.goldHi }}>{r.request_code}</span>
            <Pill c={e.c}>{e.l}</Pill>
            <Tag c={C.sub}>{esUSA ? "🇺🇸 Estados Unidos" : "🇨🇳 China"}</Tag>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "8px 0 2px", letterSpacing: "-0.01em" }}>{nombre(r.clients)}</p>
          <p style={{ fontSize: 12.5, color: C.mute, margin: 0 }}>
            <span style={{ fontFamily: MONO }}>{r.clients?.client_code}</span>{r.clients?.whatsapp && r.clients.whatsapp !== "—" ? ` · ${r.clients.whatsapp}` : ""} · Creada {fmtDate(r.created_at)}{q?.expires_at ? ` · válida hasta ${fmtDate(q.expires_at)}` : ""}{socio ? ` · Socio ${socio.email.split("@")[0]}` : ""}
          </p>
        </div>
        {baseCliente > 0 && <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.mute }}>{elegido ? `Aceptó · ${elegido.nombre}` : `Desde · ${masBarato?.nombre || ""}`}</p>
          <p style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 900, color: C.goldHi, fontVariantNumeric: "tabular-nums", lineHeight: 1.05 }}>{fmtUSD(baseCliente)}</p>
        </div>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {e.k === "aceptada" && <Btn v="green" onClick={convertir} disabled={trabajando || q?.status === "converting"}>{trabajando ? "Creando…" : "📦 Pasar a operación"}</Btn>}
        {op && <Btn v="gold" onClick={() => ir("operaciones", { id: op.id })}>Ver {op.operation_code} →</Btn>}
        {!["convertida", "aceptada"].includes(e.k) && <Btn v={e.k === "por_cotizar" ? "gold" : "sec"} onClick={() => ir("cotizaciones", { wizard: id })}>{e.k === "por_cotizar" ? "Armar cotización" : "✎ Editar"}</Btn>}
        {q && e.k === "vencida" && <Btn v="gold" onClick={renovar}>↻ Renovar validez</Btn>}
        {url && ["borrador", "enviada"].includes(e.k) && <Btn v="wa" onClick={enviarWa}>💬 Enviar por WhatsApp</Btn>}
        {url && <Btn onClick={copiar}>Copiar link</Btn>}
        {url && <Btn onClick={() => window.open(url, "_blank", "noopener")}>Ver como cliente ↗</Btn>}
        {q && lista.length > 0 && <Btn onClick={pdf}>PDF</Btn>}
        <span style={{ flex: 1 }} />
        {staff && ["por_cotizar", "borrador", "enviada", "vencida"].includes(e.k) && <Btn v="ghost" onClick={rechazar}>Marcar rechazada</Btn>}
        {staff && e.k !== "convertida" && <Btn v="ghost" onClick={borrar} style={{ color: C.red }}>Borrar</Btn>}
      </div>
    </section>

    {(e.k === "aceptada" || e.k === "convertida" || e.k === "rechazada") && <section style={{ ...sec, borderColor: `${e.c}55`, background: `${e.c}0d` }}>
      <p style={{ margin: 0, fontWeight: 800, color: e.c }}>{e.k === "rechazada" ? "✕ Rechazada" : "✓ Aceptada por el cliente"}{respuesta?.meta?.manual ? " (marcada a mano)" : ""}</p>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
        {respuesta?.created_at ? `${fmtDateTime(respuesta.created_at)}` : (e.cuando ? fmtDateTime(e.cuando) : "")}
        {respuesta?.meta?.email ? ` · ${respuesta.meta.email}` : ""}
        {e.k !== "rechazada" && q?.selected_channel ? ` · ${GI_CANALES[q.selected_channel]?.largo || q.selected_channel}` : ""}
        {e.k !== "rechazada" && q?.selected_delivery_zone ? ` · ${q.selected_delivery_zone === "oficina" ? "retira por oficina" : q.selected_delivery_zone === "interior_coordinar" ? "envío a coordinar" : `envío a ${q.selected_delivery_zone}`}` : ""}
      </p>
      {e.k === "rechazada" && e.motivo && <p style={{ margin: "8px 0 0", fontSize: 13.5 }}>Motivo: <strong>{e.motivo}</strong></p>}
    </section>}

    {/* Datos de un vistazo */}
    {q && <section style={{ ...sec, padding: "14px 18px" }}>
      <div style={{ display: "grid", gridTemplateColumns: movil ? "repeat(2,minmax(0,1fr))" : `repeat(${verPlata ? 6 : 4},minmax(0,1fr))`, gap: "10px 14px" }}>
        {verPlata && <Dato l="FOB al proveedor" v={fob > 0 ? fmtUSD(fob) : "—"} sub={lista.length ? `${lista.length} producto${lista.length !== 1 ? "s" : ""}` : null} />}
        {!verPlata && <Dato l="Productos" v={String(lista.length)} />}
        <Dato l="Bultos" v={nBultos ? String(nBultos) : "—"} sub={nBultos ? `${cbm.toFixed(3)} m³ · ${Math.round(kg)} kg` : "sin cargar"} c={nBultos ? C.txt : C.amber} />
        {verPlata && <Dato l="Honorarios GI" v={`${honor || 0} %`} sub={masBarato ? `${fmtUSD(masBarato.honorarios)} en ${masBarato.nombre.toLowerCase()}` : null} />}
        <Dato l="Anticipo proveedor" v={q.supplier_deposit_pct != null ? `${q.supplier_deposit_pct} %` : "—"} sub={fob > 0 && q.supplier_deposit_pct != null ? fmtUSD(fob * q.supplier_deposit_pct / 100) : null} />
        <Dato l="Producción" v={(() => { const m = Math.max(0, ...lista.map((p) => Number(p.lead_time_days || 0))); return m ? `${m} días` : "—"; })()} sub="la más larga" />
        <Dato l="Validez" v={q.expires_at ? fmtDate(q.expires_at) : "—"} sub={vencida(q) ? "vencida" : q.sent_at ? `enviada ${fmtDate(q.sent_at)}` : "sin enviar"} c={vencida(q) ? C.red : C.txt} />
      </div>
    </section>}

    <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "minmax(0,1.3fr) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
      <div>
        {/* Precios por canal */}
        {q && canales.length > 0 && <section style={sec}>
          <p style={tit}>Precio final al cliente</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canales.map((c) => { const el = elegido?.k === c.k; const barato = masBarato?.k === c.k; return <div key={c.k} style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${el ? C.gold : barato ? "rgba(52,211,153,0.35)" : C.line}`, background: el ? C.goldBg : barato ? "rgba(52,211,153,0.06)" : "rgba(0,0,0,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{c.largo} {el && <Tag c={C.goldHi}>Eligió esta</Tag>}{!el && barato && <Tag c={C.green}>Más económica</Tag>}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11.5, color: C.mute }}>{TIEMPO[c.k]}</p>
                </div>
                <p style={{ margin: 0, fontSize: 21, fontWeight: 900, color: C.goldHi, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtUSD(c.total)}</p>
              </div>
              {verPlata && <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 11.5, color: C.mute, fontVariantNumeric: "tabular-nums", flexWrap: "wrap" }}>
                <span>importación {fmtUSD(c.impo)} + honorarios {fmtUSD(c.honorarios)}</span>
                {c.gana != null && <span style={{ color: c.gana >= 0 ? C.green : C.red, fontWeight: 700 }}>gana {fmtUSD(c.gana)}</span>}
              </div>}
            </div>; })}
          </div>
        </section>}

        {/* Productos */}
        <section style={sec}>
          <p style={tit}>Productos{prods ? ` · ${lista.length}` : ""}</p>
          {prods === null ? <Cargando /> : lista.length === 0 ? <p style={{ color: C.mute, margin: 0 }}>Sin productos cargados.</p> : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lista.map((p, i) => { const fotos = fotosDe(p); const sub = Number(p.unit_cost_usd || 0) * Number(p.quantity || 0); return <div key={p.id || i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                {fotos.length ? fotos.slice(0, 3).map((u, k) => <button key={k} type="button" onClick={() => setFotoGrande(u)} style={{ width: k === 0 ? 56 : 28, height: 56, borderRadius: 9, overflow: "hidden", border: `1px solid ${C.line}`, background: "#000", padding: 0, cursor: "zoom-in" }}><img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></button>)
                  : <div style={{ width: 56, height: 56, borderRadius: 9, background: C.goldBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: C.gold }}>{i + 1}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{p.description || "—"}</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: C.sub, fontVariantNumeric: "tabular-nums" }}>
                  <b style={{ color: C.txt }}>{p.quantity || 0} u.</b>{verPlata && Number(p.unit_cost_usd) > 0 ? ` × ${n2(p.unit_cost_usd)} = ` : ""}{verPlata && sub > 0 ? <b style={{ color: C.txt }}>USD {n2(sub)}</b> : null}{p.lead_time_days ? ` · ${p.lead_time_days} días de producción` : ""}
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                  {p.ncm_code ? <><span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.blue }}>{p.ncm_code}</span><span style={{ fontSize: 11.5, color: C.mute }}>DI {p.ncm_di_pct ?? 0}% · Tasa {p.ncm_estad_pct ?? 0}% · IVA {p.ncm_iva_pct ?? 21}%</span></> : <span style={{ fontSize: 11.5, color: C.amber, fontWeight: 700 }}>Sin posición arancelaria</span>}
                  {p.supplier_ref && (/^https?:/.test(p.supplier_ref) ? <a href={p.supplier_ref} target="_blank" rel="noopener" style={{ fontSize: 12, color: C.blue, fontWeight: 700, textDecoration: "none" }}>Proveedor ↗</a> : <span style={{ fontSize: 11.5, color: C.mute }}>Proveedor: {p.supplier_ref}</span>)}
                </div>
              </div>
            </div>; })}
          </div>}
        </section>

        {/* Bultos */}
        {bultos.length > 0 && <section style={sec}>
          <p style={tit}>Bultos · {nBultos} · {cbm.toFixed(3)} m³ · {Math.round(kg)} kg</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bultos.map((k, i) => <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 12px", borderRadius: 10, background: "rgba(0,0,0,0.15)", border: `1px solid ${C.line}`, fontSize: 12.5 }}>
              <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{k.n} × {k.l}×{k.w}×{k.h} cm</span>
              <span style={{ color: C.sub, fontVariantNumeric: "tabular-nums" }}>{n2(Number(k.kg || 0))} kg c/u · {((Number(k.l || 0) * Number(k.w || 0) * Number(k.h || 0) * k.n) / 1e6).toFixed(3)} m³</span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.mute }}>{k.prods.length ? k.prods.map(nombreProd).join(" · ") : "todos los productos"}</span>
            </div>)}
          </div>
        </section>}

        {/* Plan de pagos */}
        {q && plan.length > 0 && <section style={sec}>
          <p style={tit}>Plan de pagos del cliente{baseCliente > 0 ? ` · sobre ${fmtUSD(baseCliente)}` : ""}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {plan.map((st, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span style={{ width: 44, textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: C.goldHi }}>{st.pct}%</span>
              <span style={{ flex: 1, color: C.txt }}>{st.label}</span>
              {baseCliente > 0 && <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmtUSD(baseCliente * Number(st.pct || 0) / 100)}</span>}
            </div>)}
          </div>
        </section>}

        {r.notes && <section style={sec}><p style={tit}>Notas internas</p><p style={{ margin: 0, fontSize: 13.5, color: C.sub, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.notes}</p></section>}
      </div>

      <section style={sec}>
        <p style={tit}>Historial</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={nota} onChange={(x) => setNota(x.target.value)} onKeyDown={(x) => { if (x.key === "Enter") agregarNota(); }} placeholder="Agregar una nota…" style={{ ...inp, padding: "9px 11px", fontSize: 13 }} />
          <Btn small onClick={agregarNota} disabled={!nota.trim()}>Guardar</Btn>
        </div>
        {ev.length === 0 ? <p style={{ color: C.mute, fontSize: 13, margin: 0 }}>Sin movimientos todavía.</p> : <div style={{ position: "relative", paddingLeft: 26 }}>
          <div style={{ position: "absolute", left: 9, top: 10, bottom: 10, width: 2, background: C.line }} />
          {ev.map((c, i) => { const t = TIPO_EV[c.type] || { i: "·", l: c.type }; const fuerte = ["accepted", "rejected", "converted", "link_viewed"].includes(c.type); return <div key={i} style={{ position: "relative", padding: "7px 0" }}>
            <span style={{ position: "absolute", left: -26, top: 9, width: 20, height: 20, borderRadius: "50%", background: fuerte ? C.goldBg : C.panel, border: `1px solid ${fuerte ? C.gold : C.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>{t.i}</span>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: fuerte ? 800 : 700 }}>{t.l}{c.meta?.email && ["accepted", "rejected", "link_viewed", "account_created"].includes(c.type) ? <span style={{ fontWeight: 500, color: C.mute }}> · {c.meta.email}</span> : null}</p>
              <span style={{ fontSize: 11, color: C.mute, whiteSpace: "nowrap" }}>{fmtDateTime(c.created_at)}</span>
            </div>
            {c.content && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.sub, whiteSpace: "pre-wrap" }}>{c.content}</p>}
            {c.type === "rejected" && c.meta?.reason && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.sub }}>“{c.meta.reason}”</p>}
            {c.type === "accepted" && c.meta?.total ? <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.sub }}>{GI_CANALES[c.meta.channel]?.nombre || c.meta.channel} · {fmtUSD(c.meta.total)}</p> : null}
          </div>; })}
        </div>}
      </section>
    </div>
    {fotoGrande && <div onClick={() => setFotoGrande(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(5,10,20,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}><img src={fotoGrande} alt="" style={{ maxWidth: "92vw", maxHeight: "88vh", borderRadius: 12, objectFit: "contain" }} /></div>}
  </div>;
}

// ────────────────────────────────────────────
// OPERACIONES
// ────────────────────────────────────────────
function Operaciones({ ctx }) {
  const { d, rol, ir, movil } = ctx;
  const [q, setQ] = useState("");
  const pagosPor = {}; d.pagos.forEach((p) => { (pagosPor[p.operation_id] = pagosPor[p.operation_id] || []).push(p); });
  const s = q.trim().toLowerCase();
  const filas = d.ops.filter((o) => !s || `${o.operation_code} ${nombre(o.clients)} ${o.description || ""}`.toLowerCase().includes(s)).map((o) => ({
    o, res: resumenGI({ op: o, cobros: d.cobros.filter((c) => c.operation_id === o.id), pagosProveedor: pagosPor[o.id] || [], fx: d.fx, socio: d.socios.find((x) => x.id === (o.gi_partner_id || o.clients?.gi_partner_id)) }),
  }));
  const de = (ks) => filas.filter((x) => ks.includes(x.o.status));
  const cols = [
    { k: "or", l: "En origen", c: GI_ESTADOS.pendiente.c, items: de(["pendiente", "en_deposito_origen", "en_preparacion"]) },
    { k: "vi", l: "Viajando", c: GI_ESTADOS.en_transito.c, items: de(["en_transito"]) },
    { k: "ar", l: "En Argentina", c: GI_ESTADOS.en_aduana.c, items: de(["arribo_argentina", "en_aduana"]) },
    { k: "en", l: "Para entregar", c: GI_ESTADOS.entregada.c, items: de(["entregada"]) },
  ];
  const verPlata = rol !== "empleado";
  const tarjeta = ({ o, res }) => { const st = GI_ESTADOS[o.status] || { l: o.status, c: C.sub }; return <Tarjeta key={o.id} onClick={() => ir("operaciones", { id: o.id })} acento={st.c}
    arriba={<><Codigo>{o.operation_code}</Codigo><span style={{ fontSize: 11, color: st.c, fontWeight: 700 }}>{st.l}</span></>}
    titulo={nombre(o.clients)}
    abajo={<><span>{GI_CANALES[o.channel]?.nombre || o.channel}{o.eta ? ` · ETA ${fmtDateShort(o.eta)}` : ""}</span><span style={{ color: res.saldo > 0.5 ? C.amber : C.green, fontWeight: 700 }}>{res.saldo > 0.5 ? `debe ${usd0(res.saldo)}` : "cobrada"}</span></>} />; };
  const cerradas = de(["operacion_cerrada", "cancelada"]);
  return <div>
    <Titulo eyebrow="Gestión Integral" sub="Las operaciones de GI según dónde está la mercadería. Adentro de cada una se cobran, se cargan costos y se cierran.">Operaciones</Titulo>
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o cliente" style={{ ...inp, marginBottom: 14, maxWidth: movil ? "100%" : 360 }} />
    <Tablero cols={cols} movil={movil} render={tarjeta} vacio="Ninguna" />
    <Historial titulo="Cerradas" items={cerradas} render={({ o, res }) => <Fila key={o.id} onClick={() => ir("operaciones", { id: o.id })}>
      <Codigo>{o.operation_code}</Codigo>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre(o.clients)}</span>
      <span style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{usd0(res.venta)}</span>
      {verPlata && <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: (rol === "socio" ? res.comision : res.real) >= 0 ? C.green : C.red }}>{rol === "socio" ? "comisión " : ""}{usd0(rol === "socio" ? res.comision : res.real)}</span>}
      <Pill c={(GI_ESTADOS[o.status] || {}).c}>{(GI_ESTADOS[o.status] || {}).l}</Pill>
    </Fila>} />
  </div>;
}

const METODOS_COBRO = [
  { k: "transferencia", l: "Transferencia (ARS)", moneda: "ARS" },
  { k: "efectivo_usd", l: "Efectivo USD", moneda: "USD", metodo: "efectivo" },
  { k: "efectivo_ars", l: "Efectivo ARS", moneda: "ARS", metodo: "efectivo" },
  { k: "cripto", l: "USDT", moneda: "USD" },
];

function OpDetalle({ ctx, id }) {
  const { token, rol, d, ir, recargar, movil } = ctx;
  const [op, setOp] = useState(null);
  const [cobros, setCobros] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [items, setItems] = useState([]);
  const [bultos, setBultos] = useState([]);
  const [earning, setEarning] = useState(null);
  const [tarjetas, setTarjetas] = useState([]);
  const [modal, setModal] = useState(null);
  const verPlata = rol !== "empleado";
  const admin = rol === "admin";
  const staff = rol !== "socio";

  const cargar = useCallback(async () => {
    const [o, cp, sp, it, pk, ea, tj] = await Promise.all([
      dq("operations", { token, filters: `?id=eq.${id}&select=*,clients(id,first_name,last_name,client_code,whatsapp,gi_partner_id,gi_commission_pct)` }),
      dq("operation_client_payments", { token, filters: `?operation_id=eq.${id}&select=*&order=payment_date.asc` }),
      verPlata ? dq("operation_supplier_payments", { token, filters: `?operation_id=eq.${id}&select=*&order=payment_date.asc` }) : [],
      dq("operation_items", { token, filters: `?operation_id=eq.${id}&select=*&order=created_at.asc` }),
      dq("operation_packages", { token, filters: `?operation_id=eq.${id}&select=*&order=package_number.asc` }),
      verPlata ? dq("gi_partner_earnings", { token, filters: `?operation_id=eq.${id}&select=*&limit=1` }) : [],
      admin ? dq("credit_cards", { token, filters: "?select=id,name,brand&order=name.asc" }) : [],
    ]);
    setOp(arr(o)[0] || false); setCobros(arr(cp)); setPagos(arr(sp)); setItems(arr(it)); setBultos(arr(pk)); setEarning(arr(ea)[0] || null); setTarjetas(arr(tj));
  }, [id, token, verPlata, admin]);
  useEffect(() => { cargar(); }, [cargar]);
  if (op === null) return <div><Volver onClick={() => ir("operaciones")} /><Cargando /></div>;
  if (!op) return <div><Volver onClick={() => ir("operaciones")} /><Vacio>No se encontró la operación.</Vacio></div>;

  const socioId = op.gi_admin_owned ? null : op.gi_partner_id || op.clients?.gi_partner_id || null;
  const socio = d.socios.find((s) => s.id === socioId);
  const res = resumenGI({ op, cobros, pagosProveedor: pagos, fx: d.fx, socio });
  const st = GI_ESTADOS[op.status] || { l: op.status, c: C.sub };
  const cerrada = op.status === "operacion_cerrada";
  const refrescar = async () => { await cargar(); recargar(); };
  const patchOp = async (body, msg) => {
    const r = await dq("operations", { method: "PATCH", token, filters: `?id=eq.${op.id}`, body });
    if (!ok(r)) { toast.error("No se pudo guardar"); return false; }
    setOp((p) => ({ ...p, ...body })); if (msg) toast.success(msg); recargar(); return true;
  };
  const cambiarEtapa = async (k) => {
    if (k === op.status || !staff) return;
    if (k === "operacion_cerrada") return cerrar();
    await patchOp({ status: k }, `Etapa: ${GI_ESTADOS[k].l}`);
  };
  const cerrar = async () => {
    if (res.saldo > 0.5) { toast.error(`Falta cobrar ${fmtUSD(res.saldo)}`); return; }
    if (!await confirmDialog(`¿Cerrar ${op.operation_code}? Se liquida la comisión del socio con lo cobrado y los costos cargados.`)) return;
    if (await patchOp({ status: "operacion_cerrada", closed_at: new Date().toISOString(), is_collected: true }, "Operación cerrada")) cargar();
  };
  const reabrir = async () => {
    if (earning?.paid_to_partner) { toast.error("La comisión ya se le pagó al socio"); return; }
    if (!await confirmDialog(`¿Reabrir ${op.operation_code}?`)) return;
    if (await patchOp({ status: "entregada", closed_at: null }, "Operación reabierta")) cargar();
  };
  const borrarCobro = async (c) => {
    if (!await confirmDialog(`¿Borrar el cobro de ${fmtUSD(c.amount_usd)}?`, { danger: true })) return;
    await dq("operation_client_payments", { method: "DELETE", token, filters: `?id=eq.${c.id}` });
    const total = cobros.filter((x) => x.id !== c.id).reduce((s, x) => s + Number(x.amount_usd || 0), 0);
    await dq("operations", { method: "PATCH", token, filters: `?id=eq.${op.id}`, body: { total_anticipos: total, ...(total < Number(op.budget_total || 0) ? { is_collected: false } : {}) } });
    toast.success("Cobro borrado"); refrescar();
  };
  const borrarPago = async (p) => {
    if (!await confirmDialog("¿Borrar este costo?", { danger: true })) return;
    await dq("operation_supplier_payments", { method: "DELETE", token, filters: `?id=eq.${p.id}` });
    await sincronizarCostoProducto(pagos.filter((x) => x.id !== p.id));
    toast.success("Costo borrado"); refrescar();
  };
  const togglePagado = async (p) => {
    await dq("operation_supplier_payments", { method: "PATCH", token, filters: `?id=eq.${p.id}`, body: { is_paid: !p.is_paid, paid_at: !p.is_paid ? new Date().toISOString() : null } });
    refrescar();
  };
  // cost_producto_usd = pagos al proveedor en USD (lo usan los listados viejos del admin).
  const sincronizarCostoProducto = async (lista) => {
    const t = lista.reduce((s, p) => s + (p.type === "refund" ? -1 : 1) * Number(p.amount_usd || 0), 0);
    await dq("operations", { method: "PATCH", token, filters: `?id=eq.${op.id}`, body: { cost_producto_usd: Math.round(t * 100) / 100 } });
  };

  const kg = bultos.reduce((s, b) => s + Number(b.gross_weight_kg || 0) * Number(b.quantity || 1), 0);
  const cbm = bultos.reduce((s, b) => s + (Number(b.length_cm || 0) * Number(b.width_cm || 0) * Number(b.height_cm || 0)) / 1e6 * Number(b.quantity || 1), 0);
  const etapas = GI_FLUJO;
  const idx = etapas.indexOf(op.status);

  return <div>
    <Volver onClick={() => ir("operaciones")} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, color: C.goldHi }}>{op.operation_code}</span>
          <Pill c={st.c}>{st.l}</Pill>
        </div>
        <p style={{ fontSize: 18, fontWeight: 800, margin: "6px 0 2px" }}>{nombre(op.clients)}</p>
        <p style={{ fontSize: 12.5, color: C.mute, margin: 0 }}>{GI_CANALES[op.channel]?.largo || op.channel}{op.origin ? ` · ${op.origin}` : ""} · {socio ? `Socio: ${socio.email.split("@")[0]}` : "De Argencargo"}</p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {staff && <Btn v="gold" onClick={() => setModal("cobro")}>+ Cobro</Btn>}
        {admin && <Btn onClick={() => setModal("costo")}>+ Costo</Btn>}
        {admin && !cerrada && op.status !== "cancelada" && <Btn v={res.saldo > 0.5 ? "sec" : "green"} onClick={cerrar}>{res.saldo > 0.5 ? `Falta cobrar ${usd0(res.saldo)}` : "Cerrar operación"}</Btn>}
        {admin && cerrada && <Btn v="ghost" onClick={reabrir}>Reabrir</Btn>}
      </div>
    </div>

    {/* Etapa: se toca para cambiar */}
    <Caja title="Etapa" right={staff && !cerrada ? <div style={{ width: 170 }}><DatePicker small value={op.eta ? String(op.eta).slice(0, 10) : ""} onChange={(v) => patchOp({ eta: v || null }, "ETA guardada")} placeholder="ETA" /></div> : op.eta ? <span style={{ fontSize: 12.5, color: C.sub }}>ETA {fmtDate(op.eta)}</span> : null}>
      <div className="gi-scroll" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {etapas.map((k, i) => { const on = k === op.status; const hecho = idx >= 0 && i < idx; const e2 = GI_ESTADOS[k]; return <button key={k} onClick={() => cambiarEtapa(k)} disabled={!staff || (k === "operacion_cerrada" && !admin)} style={{ flexShrink: 0, padding: "9px 12px", borderRadius: 10, fontSize: 12, fontWeight: on ? 800 : 600, fontFamily: "inherit", cursor: staff ? "pointer" : "default", border: `1.5px solid ${on ? e2.c : hecho ? `${e2.c}55` : C.line}`, background: on ? `${e2.c}22` : "transparent", color: on ? e2.c : hecho ? C.sub : C.mute }}>{hecho ? "✓ " : ""}{e2.l}</button>; })}
      </div>
    </Caja>

    {/* Plata */}
    <Caja title="Plata">
      <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr 1fr" : `repeat(${verPlata ? (admin ? 6 : 5) : 3},1fr)`, gap: 14 }}>
        <Dato label="Venta" val={fmtUSD(res.venta)} />
        <Dato label="Cobrado" val={fmtUSD(res.cobrado)} c={C.green} />
        <Dato label="Saldo" val={fmtUSD(res.saldo)} c={res.saldo > 0.5 ? C.amber : C.sub} />
        {verPlata && <Dato label="Costos" val={fmtUSD(res.costos)} c={C.red} sub={res.estimado ? "con pesos estimados" : null} />}
        {verPlata && <Dato label={cerrada ? "Ganancia" : "Ganancia proy."} val={fmtUSD(cerrada ? res.real : res.ganancia)} c={(cerrada ? res.real : res.ganancia) >= 0 ? C.green : C.red} />}
        {verPlata && <Dato label={socio ? `Comisión ${res.pct}%` : "Comisión"} val={socio ? fmtUSD(earning ? earning.commission_usd : res.comision) : "—"} c={C.goldHi} sub={earning ? (earning.paid_to_partner ? `pagada ${fmtDateShort(earning.paid_at)}` : earning.is_estimated ? "estimada" : "a pagar") : null} />}
      </div>
      {admin && socio && <p style={{ margin: "12px 0 0", fontSize: 12.5, color: C.sub }}>Queda para Argencargo: <strong style={{ color: C.txt }}>{fmtUSD(earning ? Number(earning.net_profit_usd) - Number(earning.commission_usd) : res.margenAC)}</strong></p>}
    </Caja>

    <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1fr 1fr", gap: 14, alignItems: "start" }}>
      <Caja title={`Cobros del cliente (${cobros.length})`}>
        {cobros.length === 0 ? <p style={{ margin: 0, color: C.mute, fontSize: 13 }}>Sin cobros todavía.</p> : cobros.map((c) => <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{fmtDateShort(c.payment_date)} · {c.payment_method === "cripto" ? "USDT" : (c.payment_method || "—").replace(/_/g, " ")}{c.currency === "ARS" && c.amount_ars ? ` · ARS ${Number(c.amount_ars).toLocaleString("es-AR")} a ${c.exchange_rate}` : ""}</p>
            {c.notes && <p style={{ margin: "2px 0 0", fontSize: 12, color: C.mute }}>{c.notes}</p>}
          </div>
          <span style={{ fontWeight: 800, color: C.green, fontVariantNumeric: "tabular-nums" }}>{fmtUSD(c.amount_usd)}</span>
          {admin && <button onClick={() => borrarCobro(c)} aria-label="Borrar" style={{ border: "none", background: "transparent", color: C.mute, cursor: "pointer", fontSize: 15 }}>✕</button>}
        </div>)}
      </Caja>

      {verPlata && <Caja title={`Costos (${pagos.length + (res.costosFijos > 0 ? 1 : 0)})`}>
        {pagos.length === 0 && res.costosFijos === 0 ? <p style={{ margin: 0, color: C.mute, fontSize: 13 }}>Sin costos cargados.</p> : <>
          {pagos.map((p) => { const ref = p.type === "refund"; const pendiente = Number(p.amount_usd || 0) === 0 && Number(p.amount_ars || 0) > 0; return <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.line}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{ref ? "↩ Reembolso" : p.notes || "Pago a proveedor"}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: C.mute }}>{fmtDateShort(p.payment_date)} · {(p.payment_method || "—").replace(/_/g, " ")}{p.currency === "ARS" ? ` · ARS ${Number(p.amount_ars || 0).toLocaleString("es-AR")}` : ""}{pendiente ? " · sin dolarizar" : ""}</p>
            </div>
            {admin ? <button onClick={() => togglePagado(p)} style={{ fontSize: 11, fontWeight: 800, padding: "4px 9px", borderRadius: 999, border: `1px solid ${p.is_paid ? "rgba(52,211,153,0.4)" : "rgba(251,191,36,0.4)"}`, background: "transparent", color: p.is_paid ? C.green : C.amber, cursor: "pointer", fontFamily: "inherit" }}>{p.is_paid ? "Pagado" : "Pendiente"}</button> : <Pill c={p.is_paid ? C.green : C.amber}>{p.is_paid ? "Pagado" : "Pendiente"}</Pill>}
            <span style={{ fontWeight: 800, color: ref ? C.green : C.red, fontVariantNumeric: "tabular-nums", minWidth: 86, textAlign: "right" }}>{pendiente ? "—" : `${ref ? "+" : "−"}${usd0(p.amount_usd)}`}</span>
            {admin && <button onClick={() => borrarPago(p)} aria-label="Borrar" style={{ border: "none", background: "transparent", color: C.mute, cursor: "pointer", fontSize: 15 }}>✕</button>}
          </div>; })}
          {res.costosFijos > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.line}` }}>
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>Flete, impuestos y despacho</p><p style={{ margin: "2px 0 0", fontSize: 12, color: C.mute }}>Del vuelo / contenedor</p></div>
            <span style={{ fontWeight: 800, color: C.red, fontVariantNumeric: "tabular-nums" }}>−{usd0(res.costosFijos)}</span>
          </div>}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, fontWeight: 800 }}><span style={{ color: C.sub }}>Total</span><span style={{ color: C.red, fontVariantNumeric: "tabular-nums" }}>−{fmtUSD(res.costos)}</span></div>
        </>}
      </Caja>}

      <Caja title={`Productos (${items.length})`}>
        {items.length === 0 ? <p style={{ margin: 0, color: C.mute, fontSize: 13 }}>Sin productos.</p> : items.map((it) => <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ minWidth: 0 }}><p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{it.description}</p><p style={{ margin: "2px 0 0", fontSize: 12, color: C.mute }}>{it.quantity} u.{it.ncm_code ? ` · NCM ${it.ncm_code}` : ""}</p></div>
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{usd0(Number(it.unit_price_usd || 0) * Number(it.quantity || 0))}</span>
        </div>)}
      </Caja>

      <Caja title={`Bultos (${bultos.reduce((s, b) => s + Number(b.quantity || 1), 0)})`} right={bultos.length ? <span style={{ fontSize: 12.5, color: C.sub }}>{kg.toFixed(1)} kg · {cbm.toFixed(3)} m³</span> : null}>
        {bultos.length === 0 ? <p style={{ margin: 0, color: C.mute, fontSize: 13 }}>Sin bultos cargados.</p> : bultos.map((b) => <div key={b.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
          <span>#{b.package_number}{Number(b.quantity) > 1 ? ` ×${b.quantity}` : ""} · {b.length_cm && b.width_cm && b.height_cm ? `${b.length_cm}×${b.width_cm}×${b.height_cm} cm` : "sin medidas"}</span>
          <span style={{ color: C.sub }}>{Number(b.gross_weight_kg || 0) > 0 ? `${Number(b.gross_weight_kg).toFixed(1)} kg` : "—"}</span>
        </div>)}
      </Caja>

      {admin && <SocioOp op={op} socios={d.socios} onGuardar={patchOp} pctActual={res.pct} />}
    </div>

    {modal === "cobro" && <CobroModal op={op} saldo={res.saldo} token={token} cobrado={res.cobrado} onClose={() => setModal(null)} onListo={() => { setModal(null); refrescar(); }} />}
    {modal === "costo" && <CostoModal op={op} token={token} tarjetas={tarjetas} pagos={pagos} onClose={() => setModal(null)} onListo={async (lista) => { setModal(null); await sincronizarCostoProducto(lista); refrescar(); }} />}
  </div>;
}

function SocioOp({ op, socios, onGuardar, pctActual }) {
  const actual = op.gi_admin_owned ? "" : op.gi_partner_id || op.clients?.gi_partner_id || "";
  const [sel, setSel] = useState(actual);
  const [pct, setPct] = useState(op.gi_commission_pct != null ? String(op.gi_commission_pct) : "");
  useEffect(() => { setSel(actual); setPct(op.gi_commission_pct != null ? String(op.gi_commission_pct) : ""); }, [op.id, op.gi_partner_id, op.gi_admin_owned, op.gi_commission_pct]);
  const cambio = sel !== actual || pct !== (op.gi_commission_pct != null ? String(op.gi_commission_pct) : "");
  const guardar = () => onGuardar({ gi_admin_owned: !sel, gi_partner_id: sel || null, gi_commission_pct: sel && pct !== "" ? Number(pct) : null }, "Socio actualizado");
  return <Caja title="Socio y comisión">
    <Opciones value={sel} onChange={setSel} items={[{ k: "", l: "Argencargo" }, ...socios.map((s) => ({ k: s.id, l: s.email.split("@")[0] }))]} />
    {sel && <Campo label={`% de esta op (vacío = ${pctActual}% de la ficha/socio)`} style={{ marginTop: 12 }}><input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value.replace(",", "."))} style={inp} /></Campo>}
    {cambio && <Btn v="gold" small onClick={guardar} style={{ marginTop: 10 }}>Guardar</Btn>}
  </Caja>;
}

function CobroModal({ op, saldo, cobrado, token, onClose, onListo }) {
  const [metodo, setMetodo] = useState("transferencia");
  const [monto, setMonto] = useState(saldo > 0 ? String(Math.round(saldo * 100) / 100) : "");
  const [ars, setArs] = useState("");
  const [tc, setTc] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState("");
  const [g, setG] = useState(false);
  const m = METODOS_COBRO.find((x) => x.k === metodo);
  const enArs = m.moneda === "ARS";
  useEffect(() => { if (enArs && !tc) fetch("https://dolarapi.com/v1/dolares/blue").then((r) => r.json()).then((j) => { if (j?.venta) setTc(String(j.venta)); }).catch(() => {}); }, [enArs]);
  const usd = enArs ? (Number(ars) > 0 && Number(tc) > 0 ? Number(ars) / Number(tc) : 0) : Number(monto || 0);
  const guardar = async () => {
    if (!(usd > 0)) { toast.error("Poné el monto"); return; }
    setG(true);
    const body = { operation_id: op.id, payment_date: fecha, amount_usd: Math.round(usd * 100) / 100, currency: enArs ? "ARS" : "USD", payment_method: m.metodo || metodo, notes: nota.trim() || null };
    if (enArs) { body.amount_ars = Number(ars); body.exchange_rate = Number(tc); }
    const r = await dq("operation_client_payments", { method: "POST", token, body });
    if (!ok(r)) { toast.error("No se pudo guardar el cobro"); setG(false); return; }
    const total = cobrado + body.amount_usd;
    const upd = { total_anticipos: total };
    if (total >= Number(op.budget_total || 0) - 0.01 && Number(op.budget_total || 0) > 0) Object.assign(upd, { is_collected: true, collected_amount: total, collection_date: fecha, collection_method: body.payment_method, collection_currency: body.currency, ...(enArs ? { collection_exchange_rate: Number(tc) } : {}) });
    await dq("operations", { method: "PATCH", token, filters: `?id=eq.${op.id}`, body: upd });
    toast.success(`Cobro de ${fmtUSD(body.amount_usd)} registrado`);
    onListo();
  };
  return <Modal title={`Cobro · ${op.operation_code}`} onClose={onClose} footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn v="gold" onClick={guardar} disabled={g || !(usd > 0)}>{g ? "Guardando…" : `Registrar ${usd > 0 ? fmtUSD(usd) : ""}`}</Btn></>}>
    <p style={{ margin: "0 0 14px", fontSize: 13, color: C.sub }}>Saldo: <strong style={{ color: C.txt }}>{fmtUSD(saldo)}</strong></p>
    <Campo label="Cómo pagó"><Opciones value={metodo} onChange={setMetodo} cols={2} items={METODOS_COBRO.map((x) => ({ k: x.k, l: x.l }))} /></Campo>
    {enArs ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Campo label="Pesos"><input inputMode="decimal" value={ars} onChange={(e) => setArs(e.target.value.replace(/[^\d.]/g, ""))} style={inp} /></Campo>
      <Campo label="Tipo de cambio"><input inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value.replace(/[^\d.]/g, ""))} style={inp} /></Campo>
    </div> : <Campo label={metodo === "cripto" ? "USDT (1 USDT = 1 USD)" : "Dólares"}><input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ""))} style={inp} /></Campo>}
    <Campo label="Fecha"><DatePicker value={fecha} onChange={setFecha} /></Campo>
    <Campo label="Nota"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Anticipo 30%, saldo, etc." style={inp} /></Campo>
  </Modal>;
}

function CostoModal({ op, token, tarjetas, pagos, onClose, onListo }) {
  const [tipo, setTipo] = useState("payment");
  const [moneda, setMoneda] = useState("USD");
  const [metodo, setMetodo] = useState("transferencia");
  const [monto, setMonto] = useState("");
  const [tc, setTc] = useState("");
  const [tarjeta, setTarjeta] = useState(tarjetas[0]?.id || "");
  const [fecha, setFecha] = useState(hoyISO());
  const [pagado, setPagado] = useState(true);
  const [nota, setNota] = useState("");
  const [g, setG] = useState(false);
  const esTC = metodo === "tarjeta_credito";
  const guardar = async () => {
    const amt = Number(monto);
    if (!(amt > 0)) { toast.error("Poné el monto"); return; }
    if (esTC && !tarjeta) { toast.error("Elegí la tarjeta"); return; }
    const ars = moneda === "ARS";
    if (ars && !esTC && !(Number(tc) > 0)) { toast.error("Poné el tipo de cambio para dolarizarlo"); return; }
    setG(true);
    const dolarizado = ars && !esTC;
    const usd = ars ? (dolarizado ? Math.round((amt / Number(tc)) * 100) / 100 : 0) : amt;
    const body = {
      operation_id: op.id, payment_date: fecha, type: tipo, payment_method: metodo, currency: moneda,
      amount_usd: usd, amount_ars: ars ? amt : null, exchange_rate: dolarizado ? Number(tc) : null,
      credit_card_id: esTC ? tarjeta : null, notes: nota.trim() || null,
      is_paid: ars && esTC ? false : pagado, paid_at: (ars && esTC) || !pagado ? null : new Date(fecha + "T12:00:00Z").toISOString(),
    };
    const r = await dq("operation_supplier_payments", { method: "POST", token, body });
    const fila = arr(r)[0];
    if (!fila) { toast.error("No se pudo guardar el costo"); setG(false); return; }
    toast.success(ars && esTC ? "Costo en tarjeta: se dolariza al cierre" : "Costo registrado");
    onListo([...pagos, fila]);
  };
  return <Modal title={`Costo · ${op.operation_code}`} onClose={onClose} footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn v="gold" onClick={guardar} disabled={g}>{g ? "Guardando…" : "Guardar"}</Btn></>}>
    <Campo label="Tipo"><Opciones value={tipo} onChange={setTipo} cols={2} items={[{ k: "payment", l: "Pago a proveedor" }, { k: "refund", l: "Reembolso" }]} /></Campo>
    <Campo label="Medio"><Opciones value={metodo} onChange={setMetodo} items={[{ k: "transferencia", l: "Transferencia" }, { k: "efectivo", l: "Efectivo" }, { k: "tarjeta_credito", l: "Tarjeta" }, { k: "cripto", l: "USDT" }]} /></Campo>
    {esTC && <Campo label="Tarjeta">{tarjetas.length ? <Opciones value={tarjeta} onChange={setTarjeta} items={tarjetas.map((t) => ({ k: t.id, l: t.name }))} /> : <p style={{ margin: 0, color: C.mute, fontSize: 13 }}>No hay tarjetas cargadas.</p>}</Campo>}
    <Campo label="Moneda"><Opciones value={moneda} onChange={setMoneda} cols={2} items={[{ k: "USD", l: "Dólares" }, { k: "ARS", l: "Pesos" }]} /></Campo>
    <div style={{ display: "grid", gridTemplateColumns: moneda === "ARS" && !esTC ? "1fr 1fr" : "1fr", gap: 10 }}>
      <Campo label={moneda === "ARS" ? "Pesos" : "Dólares"}><input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ""))} style={inp} /></Campo>
      {moneda === "ARS" && !esTC && <Campo label="Tipo de cambio"><input inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value.replace(/[^\d.]/g, ""))} style={inp} /></Campo>}
    </div>
    <Campo label="Fecha"><DatePicker value={fecha} onChange={setFecha} /></Campo>
    {!(moneda === "ARS" && esTC) && <Campo label="Estado"><Opciones value={pagado ? "s" : "n"} onChange={(k) => setPagado(k === "s")} cols={2} items={[{ k: "s", l: "Ya pagado" }, { k: "n", l: "A pagar" }]} /></Campo>}
    <Campo label="Concepto"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Proveedor, seña 30%, etc." style={inp} /></Campo>
  </Modal>;
}

// ────────────────────────────────────────────
// CLIENTES
// ────────────────────────────────────────────
function ClienteSocioModal({ c, d, token, onClose, onListo }) {
  const [sel, setSel] = useState(c.gi_partner_id || "");
  const [pct, setPct] = useState(c.gi_commission_pct != null ? String(c.gi_commission_pct) : "");
  const guardar = async () => {
    const r = await dq("clients", { method: "PATCH", token, filters: `?id=eq.${c.id}`, body: { gi_partner_id: sel || null, gi_commission_pct: sel && pct !== "" ? Number(pct) : null } });
    if (!ok(r)) { toast.error("No se pudo guardar"); return; }
    toast.success("Guardado"); onListo();
  };
  const so = d.socios.find((p) => p.id === sel);
  return <Modal title={nombre(c)} onClose={onClose} footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn v="gold" onClick={guardar}>Guardar</Btn></>}>
    <Campo label="Socio de este cliente"><Opciones value={sel} onChange={setSel} items={[{ k: "", l: "Argencargo" }, ...d.socios.map((p) => ({ k: p.id, l: p.email.split("@")[0] }))]} /></Campo>
    {sel && <Campo label={`% para el socio (vacío = ${Number(so?.gi_partner_pct || 0)}% general)`}><input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value.replace(",", "."))} style={inp} /></Campo>}
  </Modal>;
}

// ────────────────────────────────────────────
// SOCIOS (admin) / MIS COMISIONES (socio)
// ────────────────────────────────────────────
function Socios({ ctx }) {
  const { token, rol, perfil, d, recargar } = ctx;
  const [invitar, setInvitar] = useState(false);
  const [pagando, setPagando] = useState(null);
  const [asignar, setAsignar] = useState(null);
  const [editCli, setEditCli] = useState(null);
  const opDe = (id) => d.ops.find((o) => o.id === id);
  const socios = rol === "admin" ? d.socios : [{ id: perfil.id, email: perfil.email, gi_partner_pct: perfil.gi_partner_pct }];

  const liquidar = async (s, lista) => {
    const est = lista.filter((e) => e.is_estimated);
    if (est.length) { toast.error(`${est.length} liquidación${est.length > 1 ? "es tienen" : " tiene"} costos en pesos sin dolarizar`); return; }
    const total = lista.reduce((a, e) => a + Number(e.commission_usd || 0), 0);
    if (!await confirmDialog(`¿Marcar como pagadas ${lista.length} comisión${lista.length > 1 ? "es" : ""} de ${s.email.split("@")[0]} por ${fmtUSD(total)}?`)) return;
    setPagando(s.id);
    const ahora = new Date().toISOString(), hoy = hoyISO();
    for (const e of lista) {
      const com = Number(e.commission_usd || 0);
      await dq("gi_partner_earnings", { method: "PATCH", token, filters: `?id=eq.${e.id}`, body: { paid_to_partner: true, paid_at: ahora, paid_amount_usd: com } });
      if (com !== 0) {
        const code = opDe(e.operation_id)?.operation_code || "—";
        await dq("finance_entries", { method: "POST", token, body: { date: hoy, type: com >= 0 ? "gasto" : "ingreso", category: "comisiones_socio", description: com >= 0 ? `Comisión socio GI · ${code}` : `Recupero pérdida socio GI · ${code}`, detail: `${Number(e.commission_pct || 0)}% sobre USD ${Number(e.net_profit_usd || 0).toFixed(2)} · Pagada ${hoy}`, amount: Math.abs(com), currency: "USD", is_paid: true, payment_method: "transferencia", auto_generated: true, operation_id: e.operation_id } });
      }
    }
    toast.success("Comisiones liquidadas"); setPagando(null); recargar();
  };
  const cambiarPct = async (s) => {
    const v = await promptDialog(`% general de ${s.email.split("@")[0]} (se usa cuando el cliente no tiene uno propio)`, { defaultValue: String(s.gi_partner_pct ?? "") });
    if (v === null || v === undefined) return;
    await dq("profiles", { method: "PATCH", token, filters: `?id=eq.${s.id}`, body: { gi_partner_pct: v === "" ? null : Number(String(v).replace(",", ".")) } });
    toast.success("Guardado"); recargar();
  };
  const quitar = async (s) => {
    if (!await confirmDialog(`¿Sacarle el acceso a ${s.email}? Sus clientes y comisiones quedan como están.`, { danger: true })) return;
    await dq("profiles", { method: "PATCH", token, filters: `?id=eq.${s.id}`, body: { is_gi_partner: false } });
    toast.success("Acceso quitado"); recargar();
  };

  return <div>
    <Titulo eyebrow="Equipo" sub={rol === "admin" ? "Cada socio con sus clientes, el % que cobra y las comisiones de las operaciones cerradas para liquidar." : "Tus clientes, el % que cobrás con cada uno y las comisiones de las operaciones cerradas."} right={rol === "admin" ? <Btn v="gold" onClick={() => setInvitar(true)}>+ Socio</Btn> : null}>{rol === "admin" ? "Socios" : "Mis comisiones"}</Titulo>
    {socios.length === 0 && <Vacio>Todavía no hay socios.</Vacio>}
    {socios.map((s) => {
      const ea = d.earnings.filter((e) => e.partner_id === s.id);
      const aPagar = ea.filter((e) => !e.paid_to_partner);
      const totalAPagar = aPagar.reduce((a, e) => a + Number(e.commission_usd || 0), 0);
      const pagado = ea.filter((e) => e.paid_to_partner).reduce((a, e) => a + Number(e.paid_amount_usd ?? e.commission_usd ?? 0), 0);
      const susClientes = d.clientesSocio.filter((c) => c.gi_partner_id === s.id);
      const nClientes = susClientes.length;
      const enCurso = d.ops.filter((o) => !o.gi_admin_owned && (o.gi_partner_id || o.clients?.gi_partner_id) === s.id && !["operacion_cerrada", "cancelada"].includes(o.status));
      return <Caja key={s.id} title={<span style={{ color: C.txt, textTransform: "none", letterSpacing: 0, fontSize: 15 }}>{s.email}</span>} right={rol === "admin" ? <div style={{ display: "flex", gap: 6 }}><Btn small onClick={() => cambiarPct(s)}>{Number(s.gi_partner_pct || 0)}% general</Btn><Btn small v="ghost" onClick={() => quitar(s)}>Quitar acceso</Btn></div> : null}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14, marginBottom: 14 }}>
          <Dato label="A cobrar" val={fmtUSD(totalAPagar)} c={totalAPagar >= 0 ? C.goldHi : C.red} sub={`${aPagar.length} op.`} />
          <Dato label="Ya cobrado" val={fmtUSD(pagado)} />
          <Dato label="En curso" val={String(enCurso.length)} sub="operaciones" />
          <Dato label="Clientes" val={String(nClientes)} />
        </div>
        {rol === "admin" && aPagar.length > 0 && <Btn v="gold" small onClick={() => liquidar(s, aPagar)} disabled={pagando === s.id} style={{ marginBottom: 12 }}>{pagando === s.id ? "Liquidando…" : `Liquidar ${fmtUSD(totalAPagar)}`}</Btn>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0 8px" }}>
          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>Clientes</p>
          {rol === "admin" && <Btn small v="ghost" onClick={() => setAsignar(s)}>+ Asignar cliente</Btn>}
        </div>
        {susClientes.length === 0 ? <p style={{ margin: "0 0 14px", color: C.mute, fontSize: 13 }}>Sin clientes asignados.</p> : <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {susClientes.map((c) => <button key={c.id} onClick={rol === "admin" ? () => setEditCli(c) : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, border: `1px solid ${C.line}`, background: C.card, color: C.txt, fontSize: 12.5, fontWeight: 600, cursor: rol === "admin" ? "pointer" : "default", fontFamily: "inherit" }}>
            {nombre(c)}<span style={{ fontWeight: 800, color: C.goldHi }}>{c.gi_commission_pct != null ? c.gi_commission_pct : Number(s.gi_partner_pct || 0)}%</span>
          </button>)}
        </div>}
        <p style={{ margin: "0 0 4px", fontSize: 11.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>Comisiones</p>
        {ea.length === 0 ? <p style={{ margin: 0, color: C.mute, fontSize: 13 }}>Sin operaciones cerradas todavía.</p> : <div style={{ display: "flex", flexDirection: "column" }}>
          {ea.map((e) => { const o = opDe(e.operation_id); return <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${C.line}`, fontSize: 13 }}>
            <Codigo>{o?.operation_code || "—"}</Codigo>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.sub }}>{nombre(o?.clients)} · ganancia {usd0(e.net_profit_usd)} × {Number(e.commission_pct || 0)}%</span>
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", color: Number(e.commission_usd) < 0 ? C.red : C.txt }}>{fmtUSD(e.commission_usd)}</span>
            <Pill c={e.paid_to_partner ? C.green : e.is_estimated ? C.mute : C.amber}>{e.paid_to_partner ? `Pagada ${fmtDateShort(e.paid_at)}` : e.is_estimated ? "Estimada" : "A pagar"}</Pill>
          </div>; })}
        </div>}
      </Caja>;
    })}
    {invitar && <InvitarSocio token={token} onClose={() => setInvitar(false)} onListo={() => recargar()} />}
    {asignar && <AsignarClienteModal ctx={ctx} socio={asignar} onClose={() => setAsignar(null)} />}
    {editCli && <ClienteSocioModal c={editCli} d={d} token={token} onClose={() => setEditCli(null)} onListo={() => { setEditCli(null); recargar(); }} />}
  </div>;
}

function InvitarSocio({ token, onClose, onListo }) {
  const [email, setEmail] = useState("");
  const [pct, setPct] = useState("");
  const [g, setG] = useState(false);
  const [res, setRes] = useState(null);
  const enviar = async () => {
    if (!email.trim()) return;
    setG(true);
    try {
      const r = await fetch("/api/admin/gi-invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await ensureFresh(token)}` }, body: JSON.stringify({ email: email.trim().toLowerCase(), gi_partner_pct: pct ? Number(pct) : null }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "No se pudo");
      setRes(j); onListo();
    } catch (e) { toast.error(e.message); }
    setG(false);
  };
  return <Modal title="Nuevo socio" onClose={onClose} footer={res ? <Btn v="gold" onClick={onClose}>Listo</Btn> : <><Btn onClick={onClose}>Cancelar</Btn><Btn v="gold" onClick={enviar} disabled={g || !email.trim()}>{g ? "Creando…" : "Dar acceso"}</Btn></>}>
    {res ? <div>
      <p style={{ margin: "0 0 10px", fontWeight: 700 }}>{res.message || "Acceso creado"}</p>
      {res.password && <div style={{ padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.3)", fontFamily: MONO, fontSize: 13, lineHeight: 1.8 }}>
        <div>{window.location.origin}/gi</div><div>{res.email}</div><div>{res.password}</div>
      </div>}
    </div> : <>
      <Campo label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inp} /></Campo>
      <Campo label="% general"><input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value.replace(",", "."))} style={inp} /></Campo>
    </>}
  </Modal>;
}

// ────────────────────────────────────────────
// CONTACTOS
// ────────────────────────────────────────────
function AsignarClienteModal({ ctx, socio, onClose }) {
  const { token, recargar } = ctx;
  const [clientes, setClientes] = useState(null);
  const [busca, setBusca] = useState("");
  const [cli, setCli] = useState(null);
  const [pct, setPct] = useState("");
  useEffect(() => { (async () => { setClientes(await dqTodos("clients", { token, filters: "?select=id,first_name,last_name,client_code,gi_partner_id&order=first_name.asc" })); })(); }, [token]);
  const s = busca.trim().toLowerCase();
  const encontrados = (clientes || []).filter((c) => s.length >= 2 && `${c.first_name || ""} ${c.last_name || ""} ${c.client_code || ""}`.toLowerCase().includes(s)).slice(0, 8);
  const guardar = async () => {
    if (!cli) return;
    const r = await dq("clients", { method: "PATCH", token, filters: `?id=eq.${cli.id}`, body: { gi_partner_id: socio.id, gi_commission_pct: pct !== "" ? Number(pct) : null } });
    if (!ok(r)) { toast.error("No se pudo asignar"); return; }
    toast.success(`${nombre(cli)} asignado`); recargar(); onClose();
  };
  return <Modal title={`Asignar cliente a ${socio.email.split("@")[0]}`} onClose={onClose} footer={<><Btn onClick={onClose}>Cancelar</Btn><Btn v="gold" onClick={guardar} disabled={!cli}>Asignar</Btn></>}>
    {cli ? <Fila style={{ marginBottom: 12 }}><span style={{ flex: 1, fontWeight: 800 }}>{nombre(cli)} <span style={{ fontFamily: MONO, fontSize: 11, color: C.goldHi }}>{cli.client_code}</span></span><Btn small onClick={() => setCli(null)}>Cambiar</Btn></Fila> : <Campo label="Buscar cliente">
      <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nombre o código" style={inp} />
      {encontrados.length > 0 && <div style={{ marginTop: 6, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
        {encontrados.map((c) => <button key={c.id} type="button" onClick={() => setCli(c)} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 12px", border: "none", borderBottom: `1px solid ${C.line}`, background: "transparent", color: C.txt, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, textAlign: "left" }}>
          <strong>{nombre(c)}</strong><span style={{ fontFamily: MONO, fontSize: 11, color: C.goldHi }}>{c.client_code}</span>
        </button>)}
      </div>}
    </Campo>}
    <Campo label={`% para el socio con este cliente (vacío = ${Number(socio.gi_partner_pct || 0)}% general)`}><input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value.replace(",", "."))} style={inp} /></Campo>
  </Modal>;
}

// ────────────────────────────────────────────
// CONTACTOS
// ────────────────────────────────────────────
const CONTACTOS = {
  suppliers: { tabla: "gi_suppliers", l: "Proveedores", uno: "proveedor", grupo: "rubro", grupos: ["Indumentaria", "Electrónica", "Calzado", "Hogar", "Cosmética", "Juguetería", "Deportes", "Otros"],
    campos: [{ k: "name", l: "Nombre" }, { k: "rubro", l: "Rubro", grupo: true }, { k: "country", l: "País", opciones: ["China", "USA"] }, { k: "city", l: "Ciudad" }, { k: "phone", l: "WhatsApp / teléfono" }, { k: "email", l: "Email" }, { k: "wechat", l: "WeChat" }, { k: "moq", l: "Pedido mínimo (MOQ)", num: true }, { k: "lead_time_days", l: "Producción (días)", num: true }, { k: "notes", l: "Notas", largo: true }] },
  purchase_agents: { tabla: "gi_purchase_agents", l: "Agentes de compra", uno: "agente", grupo: "rubro", grupos: ["Indumentaria", "Electrónica", "Calzado", "General", "Otros"],
    campos: [{ k: "name", l: "Nombre" }, { k: "rubro", l: "Rubro", grupo: true }, { k: "base_city", l: "Ciudad" }, { k: "phone", l: "WhatsApp / teléfono" }, { k: "email", l: "Email" }, { k: "wechat", l: "WeChat" }, { k: "commission_pct", l: "Comisión %", num: true }, { k: "commission_fixed_usd", l: "Comisión fija USD", num: true }, { k: "notes", l: "Notas", largo: true }] },
  forwarders: { tabla: "gi_forwarders", l: "Embarcadores", uno: "embarcador", grupo: "city", grupos: ["Shanghái", "Guangzhou", "Shenzhen", "Yiwu", "Ningbo", "Miami", "Los Ángeles", "Otros"],
    campos: [{ k: "name", l: "Nombre" }, { k: "city", l: "Ciudad", grupo: true }, { k: "phone", l: "WhatsApp / teléfono" }, { k: "email", l: "Email" }, { k: "modes", l: "Modos", multi: ["aereo", "maritimo"] }, { k: "notes", l: "Notas", largo: true }] },
};

function Contactos({ ctx }) {
  const { token, rol, movil } = ctx;
  const [tipo, setTipo] = useState("suppliers");
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const cfg = CONTACTOS[tipo];
  const cargar = useCallback(async () => { setItems(null); setItems(arr(await dq(cfg.tabla, { token, filters: "?select=*&order=name.asc" }))); }, [cfg.tabla, token]);
  useEffect(() => { cargar(); }, [cargar]);
  const s = q.trim().toLowerCase();
  const lista = (items || []).filter((it) => !s || JSON.stringify([it.name, it[cfg.grupo], it.city, it.notes]).toLowerCase().includes(s));
  const grupos = {}; lista.forEach((it) => { const g = it[cfg.grupo] || "Sin clasificar"; (grupos[g] = grupos[g] || []).push(it); });
  const wa = (tel) => { const n = String(tel || "").replace(/[^\d]/g, ""); return n.length >= 8 ? `https://wa.me/${n}` : null; };
  const borrar = async (it) => {
    if (!await confirmDialog(`¿Borrar ${it.name}?`, { danger: true })) return;
    await dq(cfg.tabla, { method: "DELETE", token, filters: `?id=eq.${it.id}` }); toast.success("Borrado"); setEdit(null); cargar();
  };
  return <div>
    <Titulo eyebrow="Equipo" sub="Proveedores, agentes de compra y embarcadores con los que trabajamos, para tenerlos a mano al cotizar." right={<Btn v="gold" onClick={() => setEdit({})}>+ Nuevo {cfg.uno}</Btn>}>Contactos</Titulo>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
      <div style={{ display: "inline-flex", padding: 4, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12 }}>
        {Object.entries(CONTACTOS).map(([k, c]) => <button key={k} onClick={() => setTipo(k)} style={{ padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: tipo === k ? C.goldBg : "transparent", color: tipo === k ? C.goldHi : C.sub }}>{c.l}</button>)}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" style={{ ...inp, maxWidth: movil ? "100%" : 280 }} />
    </div>
    {items === null ? <Cargando /> : lista.length === 0 ? <Vacio>No hay {cfg.l.toLowerCase()} cargados.</Vacio> : Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0])).map(([g, its]) => <div key={g} style={{ marginBottom: 18 }}>
      <p style={{ fontSize: 11.5, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>{g} · {its.length}</p>
      <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
        {its.map((it) => <div key={it.id} onClick={() => setEdit(it)} style={{ padding: 14, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.goldBg, color: C.goldHi, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{(it.name || "?").slice(0, 1).toUpperCase()}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: C.mute }}>{[it.city || it.base_city, it.country, it.moq ? `MOQ ${it.moq}` : null, it.lead_time_days ? `${it.lead_time_days} días` : null, it.commission_pct ? `${it.commission_pct}%` : null, Array.isArray(it.modes) && it.modes.length ? it.modes.join(" / ") : null].filter(Boolean).join(" · ") || "—"}</p>
            </div>
          </div>
          {it.notes && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: C.sub, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.notes}</p>}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
            {wa(it.phone) && <a href={wa(it.phone)} target="_blank" rel="noopener" style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 8, background: "rgba(37,211,102,0.12)", color: "#4ade80", textDecoration: "none" }}>WhatsApp</a>}
            {it.email && <a href={`mailto:${it.email}`} style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 8, background: "rgba(96,165,250,0.12)", color: C.blue, textDecoration: "none" }}>Email</a>}
            {it.wechat && <button onClick={async () => { try { await navigator.clipboard.writeText(it.wechat); toast.success("WeChat copiado"); } catch {} }} style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: C.sub, border: "none", cursor: "pointer", fontFamily: "inherit" }}>WeChat: {it.wechat}</button>}
          </div>
        </div>)}
      </div>
    </div>)}
    {edit && <ContactoModal cfg={cfg} item={edit} token={token} puedeBorrar={rol === "admin"} onBorrar={borrar} onClose={() => setEdit(null)} onListo={() => { setEdit(null); cargar(); }} />}
  </div>;
}

function ContactoModal({ cfg, item, token, puedeBorrar, onBorrar, onClose, onListo }) {
  const nuevo = !item.id;
  const [f, setF] = useState(() => { const o = {}; cfg.campos.forEach((c) => { o[c.k] = c.multi ? (Array.isArray(item[c.k]) ? item[c.k] : []) : item[c.k] ?? ""; }); return o; });
  const [g, setG] = useState(false);
  const guardar = async () => {
    if (!String(f.name || "").trim()) { toast.error("Poné el nombre"); return; }
    setG(true);
    const body = {};
    cfg.campos.forEach((c) => { body[c.k] = c.multi ? (f[c.k].length ? f[c.k] : null) : c.num ? (f[c.k] === "" ? null : Number(f[c.k])) : (String(f[c.k] || "").trim() || null); });
    const r = nuevo ? await dq(cfg.tabla, { method: "POST", token, body }) : await dq(cfg.tabla, { method: "PATCH", token, filters: `?id=eq.${item.id}`, body: { ...body, updated_at: new Date().toISOString() } });
    setG(false);
    if (!ok(r)) { toast.error("No se pudo guardar"); return; }
    toast.success(nuevo ? "Creado" : "Guardado"); onListo();
  };
  return <Modal title={nuevo ? `Nuevo ${cfg.uno}` : item.name} onClose={onClose} footer={<>{!nuevo && puedeBorrar && <Btn v="ghost" onClick={() => onBorrar(item)} style={{ color: C.red, marginRight: "auto" }}>Borrar</Btn>}<Btn onClick={onClose}>Cancelar</Btn><Btn v="gold" onClick={guardar} disabled={g}>{g ? "Guardando…" : "Guardar"}</Btn></>}>
    {cfg.campos.map((c) => <Campo key={c.k} label={c.l}>
      {c.grupo ? <Opciones value={f[c.k]} onChange={(v) => setF({ ...f, [c.k]: v })} items={cfg.grupos.map((x) => ({ k: x, l: x }))} />
        : c.opciones ? <Opciones value={f[c.k]} onChange={(v) => setF({ ...f, [c.k]: v })} cols={c.opciones.length} items={c.opciones.map((x) => ({ k: x, l: x }))} />
        : c.multi ? <div style={{ display: "flex", gap: 6 }}>{c.multi.map((m) => { const on = f[c.k].includes(m); return <button key={m} type="button" onClick={() => setF({ ...f, [c.k]: on ? f[c.k].filter((x) => x !== m) : [...f[c.k], m] })} style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${on ? C.gold : C.line}`, background: on ? C.goldBg : "transparent", color: on ? C.goldHi : C.sub }}>{m === "aereo" ? "Aéreo" : "Marítimo"}</button>; })}</div>
        : c.largo ? <textarea value={f[c.k]} onChange={(e) => setF({ ...f, [c.k]: e.target.value })} rows={3} style={{ ...inp, resize: "vertical" }} />
        : <input value={f[c.k]} inputMode={c.num ? "decimal" : undefined} onChange={(e) => setF({ ...f, [c.k]: e.target.value })} style={inp} />}
    </Campo>)}
  </Modal>;
}

// ────────────────────────────────────────────
// CONFIGURACIÓN: términos y condiciones de la cotización
// ────────────────────────────────────────────
const TERMINOS_SUGERIDOS = `Qué incluye:
- Búsqueda y coordinación con el proveedor en origen.
- Control visual de la mercadería con fotos antes del embarque.
- Flete internacional con seguro de la mercadería.
- Despacho de aduana, impuestos y tasas de importación.
- Entrega en nuestra oficina o envío a domicilio, según lo que elijas.

Precio:
- El precio es final, en dólares, con la mercadería puesta en Argentina.
- Vale hasta la fecha de vencimiento de la cotización.
- Puede cambiar si cambian las cantidades, si el proveedor modifica medidas o peso de los bultos, o si la Aduana clasifica la mercadería distinto.

Pagos:
- Se paga según el plan de pagos de la cotización. La producción arranca con el primer pago.
- Pesos por transferencia al tipo de cambio del día del pago; dólares en efectivo o USDT.

Plazos:
- Los plazos son estimados: dependen de la producción del proveedor, de la naviera o aerolínea y de la Aduana.

Responsabilidades:
- Argencargo responde por la logística, el despacho y la entrega.
- Los defectos de fabricación son responsabilidad del proveedor; nosotros gestionamos el reclamo.
- No respondemos por demoras de Aduana o de fuerza mayor ajenas a nuestro control.

Cancelación:
- Una vez hecho el pago al proveedor, el anticipo no se puede devolver salvo que el proveedor lo reintegre.`;

function TerminosVista({ texto }) {
  return <div style={{ fontSize: 13, lineHeight: 1.6 }}>{String(texto || "").split("\n").map((l, i) => {
    const t = l.trim();
    if (!t) return <div key={i} style={{ height: 8 }} />;
    if (/:$/.test(t) && !t.startsWith("-")) return <p key={i} style={{ margin: "6px 0 2px", fontWeight: 800, color: C.goldHi, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.replace(/:$/, "")}</p>;
    if (t.startsWith("-")) return <p key={i} style={{ margin: "2px 0", paddingLeft: 14, position: "relative", color: C.sub }}><span style={{ position: "absolute", left: 0, color: C.gold }}>•</span>{t.replace(/^-\s*/, "")}</p>;
    return <p key={i} style={{ margin: "2px 0", color: C.sub }}>{t}</p>;
  })}</div>;
}

function Configuracion({ ctx }) {
  const { token, movil } = ctx;
  const [fila, setFila] = useState(null);
  const [texto, setTexto] = useState("");
  const [g, setG] = useState(false);
  useEffect(() => { (async () => { const r = arr(await dq("gi_settings", { token, filters: "?select=id,terms_and_conditions,updated_at&limit=1" }))[0] || {}; setFila(r); setTexto(r.terms_and_conditions || ""); })(); }, [token]);
  const guardar = async () => {
    setG(true);
    const r = await dq("gi_settings", { method: "PATCH", token, filters: `?id=eq.${fila.id}`, body: { terms_and_conditions: texto, updated_at: new Date().toISOString() } });
    setG(false);
    if (!ok(r)) { toast.error("No se pudo guardar"); return; }
    setFila({ ...fila, terms_and_conditions: texto }); toast.success("Términos guardados");
  };
  const cambio = fila && texto !== (fila.terms_and_conditions || "");
  return <div>
    <Titulo eyebrow="Ajustes" sub="Los términos y condiciones que ve el cliente en cada cotización. El envío a domicilio, el tipo de cambio y la oficina salen de Argencargo.">Configuración</Titulo>
    {!fila ? <Cargando /> : <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1fr 1fr", gap: 14, alignItems: "start" }}>
      <Caja title="Términos y condiciones" right={<Btn small v="ghost" onClick={async () => { if (!texto.trim() || await confirmDialog("¿Reemplazar el texto por la versión sugerida? No se guarda hasta que toques Guardar.")) setTexto(TERMINOS_SUGERIDOS); }}>Usar versión sugerida</Btn>}>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={movil ? 16 : 26} style={{ ...inp, resize: "vertical", fontSize: 13.5, lineHeight: 1.55 }} />
        <p style={{ margin: "8px 0 12px", fontSize: 12, color: C.mute }}>Títulos terminados en “:” y cada punto empezando con “-”.</p>
        <Btn v="gold" onClick={guardar} disabled={!cambio || g}>{g ? "Guardando…" : cambio ? "Guardar" : "Guardado"}</Btn>
      </Caja>
      <Caja title="Así lo ve el cliente"><TerminosVista texto={texto} /></Caja>
    </div>}
  </div>;
}
