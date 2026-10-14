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
  C, LOGO, MONO, GOLD_GRADIENT, dq, dqTodos, arr, ok, ac, ensureFresh, sesionInicial, saveSession, clearSession, usarSesionPropia,
  fmtDate, fmtDateShort, fmtDateTime, fmtUSD, usd0, hace, hoyISO, nombre, buildQuoteWaMessage, cleanWaNumber, useMovil,
  Btn, Pill, Caja, Titulo, Chips, Vacio, Cargando, Modal, Campo, inp, Opciones, Dato, Fila, Codigo, Volver,
} from "./_base";
import { CotizadorWizard } from "./_cotizador";
import { ContactsPanel, PaneSettings } from "./_contactos";

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
    const [reqs, comms, ops, cobros, pagos, earnings, socios, settings] = await Promise.all([
      dq("gi_quote_requests", { token, filters: "?select=*,clients(id,first_name,last_name,client_code,whatsapp,email,gi_partner_id,gi_commission_pct),gi_quotes(*),gi_quote_request_products(id)&order=created_at.desc" }),
      dq("gi_quote_communications", { token, filters: "?select=quote_id,request_id,type,created_at,meta,content&order=created_at.desc&limit=2000" }),
      dq("operations", { token, filters: "?service_type=eq.gestion_integral&select=id,operation_code,status,channel,origin,client_id,description,budget_total,total_anticipos,eta,closed_at,created_at,gi_partner_id,gi_admin_owned,gi_commission_pct,is_collected,cost_flete,cost_impuestos_reales,cost_gasto_documental,cost_seguro,cost_flete_local,cost_otros,clients(id,first_name,last_name,client_code,whatsapp,gi_partner_id,gi_commission_pct)&order=created_at.desc" }),
      dq("operation_client_payments", { token, filters: "?select=operation_id,amount_usd,payment_date,operations!inner(service_type)&operations.service_type=eq.gestion_integral" }),
      plata ? dq("operation_supplier_payments", { token, filters: "?select=id,operation_id,amount_usd,amount_ars,type,is_paid,payment_date,notes,operations!inner(service_type,operation_code)&operations.service_type=eq.gestion_integral" }) : [],
      plata ? dq("gi_partner_earnings", { token, filters: "?select=*&order=closed_at.desc" }) : [],
      dq("profiles", { token, filters: "?is_gi_partner=eq.true&select=id,email,gi_partner_pct" }),
      dq("gi_settings", { token, filters: "?select=default_fx_rate&limit=1" }),
    ]);
    setD({
      reqs: arr(reqs), comms: arr(comms), ops: arr(ops), cobros: arr(cobros), pagos: arr(pagos),
      earnings: arr(earnings), socios: arr(socios), fx: Number(arr(settings)[0]?.default_fx_rate || 0),
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
  const ir = useCallback((p, extra = {}) => { const n = { p, ...extra }; setNav(n); try { sessionStorage.setItem("gi_nav", JSON.stringify(n)); } catch {} window.scrollTo(0, 0); }, []);
  // Links directos desde el admin: /gi?op=<id> o /gi?cot=<id>
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    if (u.get("op")) ir("operaciones", { id: u.get("op") });
    else if (u.get("cot")) ir("cotizaciones", { id: u.get("cot") });
    if (u.get("op") || u.get("cot")) window.history.replaceState({}, "", "/gi");
  }, [ir]);
  const ctx = { token, rol, perfil, d, recargar, ir, movil };

  const pendientes = d ? d.reqs.filter((r) => { const e = estadoCot(r, d.comms); return ["por_cotizar", "aceptada"].includes(e.k); }).length : 0;
  const NAV = [
    { k: "inicio", l: "Inicio" },
    { k: "cotizaciones", l: "Cotizaciones", badge: pendientes },
    { k: "operaciones", l: "Operaciones" },
    { k: "clientes", l: "Clientes" },
    rol === "admin" ? { k: "socios", l: "Socios" } : rol === "socio" ? { k: "socios", l: "Mis comisiones" } : null,
    { k: "contactos", l: "Contactos" },
    rol === "admin" ? { k: "config", l: "Configuración" } : null,
  ].filter(Boolean);
  const NAV_MOVIL = ["inicio", "cotizaciones", "operaciones", "clientes", "mas"];

  let cuerpo;
  if (!d) cuerpo = <Cargando />;
  else if (nav.p === "inicio") cuerpo = <Inicio ctx={ctx} />;
  else if (nav.p === "cotizaciones") cuerpo = nav.wizard ? <CotizadorWizard token={token} requestId={nav.wizard} profileId={perfil.id} onBack={() => { recargar(); ir("cotizaciones", { id: nav.wizard }); }} /> : nav.id ? <CotDetalle ctx={ctx} id={nav.id} /> : <Cotizaciones ctx={ctx} />;
  else if (nav.p === "operaciones") cuerpo = nav.id ? <OpDetalle ctx={ctx} id={nav.id} /> : <Operaciones ctx={ctx} />;
  else if (nav.p === "clientes") cuerpo = <Clientes ctx={ctx} />;
  else if (nav.p === "socios") cuerpo = <Socios ctx={ctx} />;
  else if (nav.p === "contactos") cuerpo = <Contactos token={token} />;
  else if (nav.p === "config" && rol === "admin") cuerpo = <PaneSettings token={token} />;
  else if (nav.p === "mas") cuerpo = <Mas nav={NAV} ir={ir} perfil={perfil} rol={rol} onLogout={onLogout} />;
  else cuerpo = <Inicio ctx={ctx} />;

  const rolTxt = rol === "admin" ? "Admin" : rol === "empleado" ? "Empleado" : "Socio GI";
  return <div style={{ minHeight: "100vh", background: C.bg, color: C.txt, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
    {!movil && <aside style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 228, background: C.panel, borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", zIndex: 5 }}>
      <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 10 }}>
        <img src={LOGO} alt="Argencargo" style={{ height: 28, width: "auto" }} />
        <span style={{ fontSize: 9, fontWeight: 900, padding: "3px 7px", borderRadius: 5, background: GOLD_GRADIENT, color: "#0A1628", letterSpacing: "0.14em" }}>GI</span>
      </div>
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        {NAV.map((it) => { const on = nav.p === it.k; return <button key={it.k} onClick={() => ir(it.k)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", marginBottom: 2, borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: on ? 800 : 600, background: on ? C.goldBg : "transparent", color: on ? C.txt : C.sub, fontFamily: "inherit", textAlign: "left" }}>
          <Ico k={it.k} c={on ? C.goldHi : C.mute} />
          <span style={{ flex: 1 }}>{it.l}</span>
          {it.badge > 0 && <span style={{ fontSize: 10.5, fontWeight: 900, padding: "1px 7px", borderRadius: 999, background: C.gold, color: "#0A1628" }}>{it.badge}</span>}
        </button>; })}
      </nav>
      <div style={{ padding: 14, borderTop: `1px solid ${C.line}` }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perfil.email}</p>
        <p style={{ fontSize: 11, color: C.mute, margin: "2px 0 10px" }}>{rolTxt}</p>
        <Btn small full onClick={onLogout}>Cerrar sesión</Btn>
      </div>
    </aside>}
    {movil && <header style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(8,18,33,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <img src={LOGO} alt="Argencargo" style={{ height: 24, width: "auto" }} />
        <span style={{ fontSize: 8.5, fontWeight: 900, padding: "2px 6px", borderRadius: 4, background: GOLD_GRADIENT, color: "#0A1628", letterSpacing: "0.14em" }}>GI</span>
      </div>
      <span style={{ fontSize: 11, color: C.mute }}>{rolTxt}</span>
    </header>}
    <main style={{ marginLeft: movil ? 0 : 228, padding: movil ? "16px 16px 96px" : "28px 32px 48px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>{cuerpo}</div>
    </main>
    {movil && <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 6, display: "grid", gridTemplateColumns: `repeat(${NAV_MOVIL.length},1fr)`, background: "rgba(13,26,46,0.97)", backdropFilter: "blur(12px)", borderTop: `1px solid ${C.line}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
      {NAV_MOVIL.map((k) => { const it = k === "mas" ? { k, l: "Más" } : NAV.find((x) => x.k === k); const on = nav.p === k || (k === "mas" && !NAV_MOVIL.includes(nav.p)); return <button key={k} onClick={() => ir(k)} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "9px 2px 8px", border: "none", background: "transparent", color: on ? C.goldHi : C.mute, fontSize: 10.5, fontWeight: on ? 800 : 600, fontFamily: "inherit", cursor: "pointer" }}>
        <Ico k={k} c={on ? C.goldHi : C.mute} s={21} />{it?.l}
        {it?.badge > 0 && <span style={{ position: "absolute", top: 5, left: "calc(50% + 6px)", fontSize: 9, fontWeight: 900, minWidth: 16, padding: "0 4px", borderRadius: 999, background: C.gold, color: "#0A1628" }}>{it.badge}</span>}
      </button>; })}
    </nav>}
  </div>;
}

function Mas({ nav, ir, perfil, rol, onLogout }) {
  const extra = nav.filter((x) => !["inicio", "cotizaciones", "operaciones", "clientes"].includes(x.k));
  return <div>
    <Titulo sub={perfil.email}>Más</Titulo>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {extra.map((it) => <Fila key={it.k} onClick={() => ir(it.k)}><Ico k={it.k} c={C.goldHi} /><span style={{ flex: 1, fontWeight: 700 }}>{it.l}</span><span style={{ color: C.mute }}>›</span></Fila>)}
    </div>
    <div style={{ marginTop: 20 }}><Btn full onClick={onLogout}>Cerrar sesión</Btn></div>
  </div>;
}

// ────────────────────────────────────────────
// INICIO: lo que hay que hacer hoy, en listas planas
// ────────────────────────────────────────────
function Inicio({ ctx }) {
  const { d, rol, ir } = ctx;
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
  const enviadas = cots.filter((x) => x.e.k === "enviada").length;

  const Grupo = ({ titulo, items, c, render }) => items.length === 0 ? null : <Caja title={<span style={{ color: c }}>{titulo} · {items.length}</span>}>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{items.slice(0, 8).map(render)}</div>
  </Caja>;
  const filaCot = ({ r, e }) => <Fila key={r.id} onClick={() => ir("cotizaciones", { id: r.id })}>
    <Codigo>{r.request_code}</Codigo>
    <span style={{ flex: 1, minWidth: 0, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre(r.clients)}</span>
    <Pill c={e.c}>{e.l}</Pill>
  </Fila>;
  const filaOp = ({ o, saldo }) => <Fila key={o.id} onClick={() => ir("operaciones", { id: o.id })}>
    <Codigo>{o.operation_code}</Codigo>
    <span style={{ flex: 1, minWidth: 0, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre(o.clients)}</span>
    {saldo != null ? <span style={{ fontWeight: 800, color: C.green, fontVariantNumeric: "tabular-nums" }}>{usd0(saldo)}</span> : <Pill c={(GI_ESTADOS[o.status] || {}).c}>{(GI_ESTADOS[o.status] || {}).l || o.status}</Pill>}
  </Fila>;
  const nada = !aceptadas.length && !porCotizar.length && !borradores.length && !vistasSinResp.length && !sinAbrir.length && !porVencer.length && !paraCobrar.length && !paraCerrar.length && !(rol === "admin" && pagosPend.length);

  return <div>
    <Titulo sub={`${enviadas} cotización${enviadas === 1 ? "" : "es"} esperando respuesta · ${activas.length} operación${activas.length === 1 ? "" : "es"} en curso · ${usd0(totalSaldo)} por cobrar`} right={<Btn v="gold" onClick={() => ir("cotizaciones", { nueva: 1 })}>+ Nueva cotización</Btn>}>Inicio</Titulo>
    {nada && <Vacio>Todo al día. No hay nada pendiente.</Vacio>}
    <Grupo titulo="Aceptadas · pasar a operación" c={C.green} items={aceptadas} render={filaCot} />
    <Grupo titulo="Para cobrar · listas para entregar" c={C.green} items={paraCobrar} render={filaOp} />
    {rol === "admin" && <Grupo titulo="Para cerrar · entregadas y cobradas" c={C.goldHi} items={paraCerrar.map((o) => ({ o }))} render={filaOp} />}
    <Grupo titulo="Pedidos sin cotizar" c={C.amber} items={porCotizar} render={filaCot} />
    <Grupo titulo="La vieron y no respondieron" c={C.blue} items={vistasSinResp} render={filaCot} />
    <Grupo titulo="Enviadas hace más de 2 días sin abrir" c={C.sub} items={sinAbrir} render={filaCot} />
    <Grupo titulo="Vencen en menos de 2 días" c={C.red} items={porVencer} render={filaCot} />
    <Grupo titulo="Borradores sin enviar" c={C.violet} items={borradores} render={filaCot} />
    {rol === "admin" && <Grupo titulo="Pagos a proveedor pendientes" c={C.amber} items={pagosPend} render={(p) => <Fila key={p.id} onClick={() => ir("operaciones", { id: p.operation_id })}>
      <Codigo>{p.operations?.operation_code || "—"}</Codigo>
      <span style={{ flex: 1, minWidth: 0, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.notes || "Pago a proveedor"}</span>
      <span style={{ fontWeight: 800, color: C.amber, fontVariantNumeric: "tabular-nums" }}>{Number(p.amount_usd || 0) > 0 ? usd0(p.amount_usd) : `ARS ${Number(p.amount_ars || 0).toLocaleString("es-AR")}`}</span>
    </Fila>} />}
  </div>;
}

// ────────────────────────────────────────────
// COTIZACIONES
// ────────────────────────────────────────────
function Cotizaciones({ ctx }) {
  const { d, ir, movil } = ctx;
  const [f, setF] = useState("activas");
  const [q, setQ] = useState("");
  const [nueva, setNueva] = useState(false);
  useEffect(() => { try { const n = JSON.parse(sessionStorage.getItem("gi_nav") || "{}"); if (n.nueva) { setNueva(true); sessionStorage.setItem("gi_nav", JSON.stringify({ p: "cotizaciones" })); } } catch {} }, []);
  const filas = d.reqs.map((r) => ({ r, e: estadoCot(r, d.comms) }));
  const grupos = {
    activas: (x) => ["por_cotizar", "borrador", "enviada", "aceptada"].includes(x.e.k),
    por_cotizar: (x) => x.e.k === "por_cotizar",
    borrador: (x) => x.e.k === "borrador",
    enviada: (x) => x.e.k === "enviada",
    aceptada: (x) => x.e.k === "aceptada",
    convertida: (x) => x.e.k === "convertida",
    perdidas: (x) => ["rechazada", "vencida"].includes(x.e.k),
  };
  const s = q.trim().toLowerCase();
  const lista = filas.filter(grupos[f]).filter((x) => !s || `${x.r.request_code} ${nombre(x.r.clients)} ${x.r.clients?.client_code || ""}`.toLowerCase().includes(s));
  const chips = [["activas", "En curso"], ["por_cotizar", "Por cotizar"], ["borrador", "Borradores"], ["enviada", "Enviadas"], ["aceptada", "Aceptadas"], ["convertida", "Convertidas"], ["perdidas", "Rechazadas / vencidas"]].map(([k, l]) => ({ k, l, n: filas.filter(grupos[k]).length }));

  return <div>
    <Titulo right={<Btn v="gold" onClick={() => setNueva(true)}>+ Nueva cotización</Btn>}>Cotizaciones</Titulo>
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o cliente" style={{ ...inp, marginBottom: 12 }} />
    <Chips items={chips} value={f} onChange={setF} />
    {lista.length === 0 ? <Vacio>No hay cotizaciones acá.</Vacio> : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {lista.map(({ r, e }) => {
        const qt = e.q;
        const total = qt ? (totalAceptado(qt) || canalMasBarato(qt)?.t || 0) : 0;
        return <Fila key={r.id} onClick={() => ir("cotizaciones", { id: r.id })} style={{ flexWrap: movil ? "wrap" : "nowrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <Codigo>{r.request_code}</Codigo>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre(r.clients)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: C.mute }}>{fmtDateShort(r.created_at)}{qt?.expires_at && ["enviada", "borrador"].includes(e.k) ? ` · vence ${fmtDateShort(qt.expires_at)}` : ""}{e.vistas > 1 ? ` · ${e.vistas} vistas` : ""}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: movil ? 0 : "auto" }}>
            {total > 0 && <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", fontSize: 13 }}>{totalAceptado(qt) ? "" : "desde "}{usd0(total)}</span>}
            <Pill c={e.c}>{e.l}</Pill>
          </div>
        </Fila>;
      })}
    </div>}
    {nueva && <NuevaCotizacion ctx={ctx} onClose={() => setNueva(false)} />}
  </div>;
}

// Alta de cotización: cliente existente (admin/empleado ven todos) o cliente nuevo.
function NuevaCotizacion({ ctx, onClose }) {
  const { token, rol, perfil, d, ir, recargar } = ctx;
  const staff = rol !== "socio";
  const [clientes, setClientes] = useState(null);
  const [modo, setModo] = useState("existente");
  const [busca, setBusca] = useState("");
  const [cli, setCli] = useState(null);
  const [nuevo, setNuevo] = useState({ first_name: "", last_name: "", whatsapp: "" });
  const [socio, setSocio] = useState(staff ? "" : perfil.id);
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
      const code = await dq("rpc/gi_next_request_code", { method: "POST", token, body: {} });
      if (typeof code !== "string" || !code.startsWith("GI-")) throw new Error("No se pudo generar el código");
      const ins = await dq("gi_quote_requests", { method: "POST", token, body: { request_code: code, client_id: c.id, assigned_partner_id: socio || null, notes: notas.trim() || null, status: "quoting", expires_at: new Date(Date.now() + Number(dias) * 86400000).toISOString().slice(0, 10) } });
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
  const [nota, setNota] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const e = r ? estadoCot(r, d.comms) : null;
  const q = e?.q;
  useEffect(() => { (async () => {
    if (!r) return;
    const [qp, rp] = await Promise.all([
      q ? dq("gi_quote_products", { token, filters: `?quote_id=eq.${q.id}&select=*&order=display_order.asc` }) : [],
      dq("gi_quote_request_products", { token, filters: `?request_id=eq.${id}&select=*&order=display_order.asc` }),
    ]);
    setProds(arr(qp).length ? arr(qp) : arr(rp));
  })(); }, [id, q?.id, token]);
  if (!r) return <div><Volver onClick={() => ir("cotizaciones")} /><Vacio>No se encontró la cotización.</Vacio></div>;

  const ev = d.comms.filter((c) => (q && c.quote_id === q.id) || (!c.quote_id && c.request_id === id));
  const url = q?.public_token ? `${window.location.origin}/cotizacion/${q.public_token}` : "";
  const log = (type, extra = {}) => dq("gi_quote_communications", { method: "POST", token, body: { quote_id: q?.id || null, request_id: id, type, author_id: perfil.id, ...extra } });
  const staff = rol !== "socio";
  const op = q?.operation_id ? d.ops.find((o) => o.id === q.operation_id) : null;

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
  const agregarNota = async () => { const t = nota.trim(); if (!t) return; await log("note", { content: t }); setNota(""); recargar(); };
  const pdf = () => printGiQuotePdf({ quote: q, products: prods || [], client: r.clients, settings: null, requestCode: r.request_code });

  const respuesta = ev.find((c) => c.type === "accepted" || c.type === "rejected");
  const totalElegido = totalAceptado(q);
  return <div>
    <Volver onClick={() => ir("cotizaciones")} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, color: C.goldHi }}>{r.request_code}</span>
          <Pill c={e.c}>{e.l}</Pill>
        </div>
        <p style={{ fontSize: 18, fontWeight: 800, margin: "6px 0 2px" }}>{nombre(r.clients)}</p>
        <p style={{ fontSize: 12.5, color: C.mute, margin: 0 }}>Creada {fmtDate(r.created_at)}{q?.expires_at ? ` · válida hasta ${fmtDate(q.expires_at)}` : ""}{r.clients?.whatsapp && r.clients.whatsapp !== "—" ? ` · ${r.clients.whatsapp}` : ""}</p>
      </div>
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {e.k === "aceptada" && <Btn v="green" onClick={convertir} disabled={trabajando || q?.status === "converting"}>{trabajando ? "Creando…" : "📦 Pasar a operación"}</Btn>}
      {op && <Btn v="gold" onClick={() => ir("operaciones", { id: op.id })}>Ver {op.operation_code} →</Btn>}
      {!["convertida", "aceptada"].includes(e.k) && <Btn v={e.k === "por_cotizar" ? "gold" : "sec"} onClick={() => ir("cotizaciones", { wizard: id })}>{e.k === "por_cotizar" ? "Armar cotización" : "✎ Editar"}</Btn>}
      {url && ["borrador", "enviada", "vencida"].includes(e.k) && <Btn v="wa" onClick={enviarWa}>💬 Enviar por WhatsApp</Btn>}
      {url && <Btn onClick={copiar}>Copiar link</Btn>}
      {url && <Btn onClick={() => window.open(url, "_blank", "noopener")}>Ver como cliente</Btn>}
      {q && prods?.length > 0 && <Btn onClick={pdf}>PDF</Btn>}
      {staff && ["por_cotizar", "borrador", "enviada", "vencida"].includes(e.k) && <Btn v="ghost" onClick={rechazar}>Marcar rechazada</Btn>}
      {staff && e.k !== "convertida" && <Btn v="ghost" onClick={borrar} style={{ color: C.red }}>Borrar</Btn>}
    </div>

    {(e.k === "aceptada" || e.k === "convertida" || e.k === "rechazada") && <Caja style={{ borderColor: `${e.c}55`, background: `${e.c}0d` }}>
      <p style={{ margin: 0, fontWeight: 800, color: e.c }}>{e.k === "rechazada" ? "✕ Rechazada" : "✓ Aceptada por el cliente"}{respuesta?.meta?.manual ? " (marcada a mano)" : ""}</p>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
        {respuesta?.created_at ? `${fmtDateTime(respuesta.created_at)}` : (e.cuando ? fmtDateTime(e.cuando) : "")}
        {respuesta?.meta?.email ? ` · ${respuesta.meta.email}` : ""}
        {e.k !== "rechazada" && q?.selected_channel ? ` · ${GI_CANALES[q.selected_channel]?.largo || q.selected_channel}` : ""}
        {e.k !== "rechazada" && q?.selected_delivery_zone ? ` · ${q.selected_delivery_zone === "oficina" ? "retira por oficina" : q.selected_delivery_zone === "interior_coordinar" ? "envío a coordinar" : `envío a ${q.selected_delivery_zone}`}` : ""}
      </p>
      {e.k !== "rechazada" && totalElegido > 0 && <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{fmtUSD(totalElegido)}</p>}
      {e.k === "rechazada" && e.motivo && <p style={{ margin: "8px 0 0", fontSize: 13.5 }}>Motivo: <strong>{e.motivo}</strong></p>}
    </Caja>}

    <div style={{ display: "grid", gridTemplateColumns: movil ? "1fr" : "1.25fr 1fr", gap: 14, alignItems: "start" }}>
      <div>
        {q && <Caja title="Precios por canal">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(GI_CANALES).map(([k, c]) => { const t = totalCanal(q, k); if (!t) return null; const el = q.selected_channel === k; return <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", borderRadius: 10, border: `1px solid ${el ? C.gold : C.line}`, background: el ? C.goldBg : "transparent" }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{c.largo}{el ? " ✓" : ""}</span><span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmtUSD(t)}</span>
            </div>; })}
          </div>
        </Caja>}
        <Caja title={`Productos${prods ? ` (${prods.length})` : ""}`}>
          {prods === null ? <Cargando /> : prods.length === 0 ? <p style={{ color: C.mute, margin: 0 }}>Sin productos cargados.</p> : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {prods.map((p, i) => <div key={p.id || i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: 44, height: 44, borderRadius: 9, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.line}` }} /> : <div style={{ width: 44, height: 44, borderRadius: 9, background: C.goldBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📦</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5 }}>{p.description || "—"}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: C.mute }}>{p.quantity ? `${p.quantity} u.` : ""}{p.ncm_code ? ` · NCM ${p.ncm_code}` : ""}{p.lead_time_days ? ` · ${p.lead_time_days} días prod.` : ""}{rol !== "empleado" && Number(p.unit_cost_usd) > 0 ? ` · costo ${fmtUSD(p.unit_cost_usd)}/u` : ""}</p>
              </div>
              {p.supplier_ref && /^https?:/.test(p.supplier_ref) && <a href={p.supplier_ref} target="_blank" rel="noopener" style={{ fontSize: 12, color: C.blue, fontWeight: 700, textDecoration: "none" }}>Proveedor ↗</a>}
            </div>)}
          </div>}
        </Caja>
        {r.notes && <Caja title="Notas"><p style={{ margin: 0, fontSize: 13.5, color: C.sub, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.notes}</p></Caja>}
      </div>
      <Caja title="Historial">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={nota} onChange={(x) => setNota(x.target.value)} onKeyDown={(x) => { if (x.key === "Enter") agregarNota(); }} placeholder="Agregar una nota…" style={{ ...inp, padding: "9px 11px", fontSize: 13 }} />
          <Btn small onClick={agregarNota} disabled={!nota.trim()}>Guardar</Btn>
        </div>
        {ev.length === 0 ? <p style={{ color: C.mute, fontSize: 13, margin: 0 }}>Sin movimientos todavía.</p> : <div style={{ display: "flex", flexDirection: "column" }}>
          {ev.map((c, i) => { const t = TIPO_EV[c.type] || { i: "·", l: c.type }; return <div key={i} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: i < ev.length - 1 ? `1px solid ${C.line}` : "none" }}>
            <span style={{ width: 22, textAlign: "center", flexShrink: 0 }}>{t.i}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{t.l}{c.meta?.email && ["accepted", "rejected", "link_viewed", "account_created"].includes(c.type) ? <span style={{ fontWeight: 500, color: C.mute }}> · {c.meta.email}</span> : null}</p>
              {c.content && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.sub, whiteSpace: "pre-wrap" }}>{c.content}</p>}
              {c.type === "rejected" && c.meta?.reason && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.sub }}>“{c.meta.reason}”</p>}
              {c.type === "accepted" && c.meta?.total ? <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.sub }}>{GI_CANALES[c.meta.channel]?.nombre || c.meta.channel} · {fmtUSD(c.meta.total)}</p> : null}
            </div>
            <span style={{ fontSize: 11, color: C.mute, whiteSpace: "nowrap" }}>{fmtDateTime(c.created_at)}</span>
          </div>; })}
        </div>}
      </Caja>
    </div>
  </div>;
}

// ────────────────────────────────────────────
// OPERACIONES
// ────────────────────────────────────────────
function Operaciones({ ctx }) {
  const { d, rol, ir, movil } = ctx;
  const [f, setF] = useState("curso");
  const [q, setQ] = useState("");
  const cobradoPor = {}; d.cobros.forEach((c) => { cobradoPor[c.operation_id] = (cobradoPor[c.operation_id] || 0) + Number(c.amount_usd || 0); });
  const pagosPor = {}; d.pagos.forEach((p) => { (pagosPor[p.operation_id] = pagosPor[p.operation_id] || []).push(p); });
  const filas = d.ops.map((o) => {
    const res = resumenGI({ op: o, cobros: d.cobros.filter((c) => c.operation_id === o.id), pagosProveedor: pagosPor[o.id] || [], fx: d.fx, socio: d.socios.find((s) => s.id === (o.gi_partner_id || o.clients?.gi_partner_id)) });
    return { o, res };
  });
  const G = {
    curso: (x) => !["operacion_cerrada", "cancelada"].includes(x.o.status),
    cobrar: (x) => !["cancelada"].includes(x.o.status) && x.res.saldo > 0.5,
    cerradas: (x) => x.o.status === "operacion_cerrada",
    todas: () => true,
  };
  const s = q.trim().toLowerCase();
  const lista = filas.filter(G[f]).filter((x) => !s || `${x.o.operation_code} ${nombre(x.o.clients)} ${x.o.description || ""}`.toLowerCase().includes(s));
  const verPlata = rol !== "empleado";
  return <div>
    <Titulo>Operaciones</Titulo>
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o cliente" style={{ ...inp, marginBottom: 12 }} />
    <Chips value={f} onChange={setF} items={[["curso", "En curso"], ["cobrar", "Con saldo"], ["cerradas", "Cerradas"], ["todas", "Todas"]].map(([k, l]) => ({ k, l, n: filas.filter(G[k]).length }))} />
    {lista.length === 0 ? <Vacio>No hay operaciones acá.</Vacio> : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {lista.map(({ o, res }) => { const st = GI_ESTADOS[o.status] || { l: o.status, c: C.sub }; return <Fila key={o.id} onClick={() => ir("operaciones", { id: o.id })} style={{ flexWrap: movil ? "wrap" : "nowrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <Codigo>{o.operation_code}</Codigo>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre(o.clients)}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: C.mute }}>{GI_CANALES[o.channel]?.nombre || o.channel}{o.eta && !["operacion_cerrada", "cancelada"].includes(o.status) ? ` · ETA ${fmtDateShort(o.eta)}` : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: movil ? 0 : "auto", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}><span style={{ color: C.mute }}>Total </span><strong>{usd0(res.venta)}</strong></span>
          {res.saldo > 0.5 && <span style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums", color: C.amber }}>Saldo <strong>{usd0(res.saldo)}</strong></span>}
          {verPlata && <span style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums", color: (o.status === "operacion_cerrada" ? res.real : res.ganancia) >= 0 ? C.green : C.red }}>{rol === "socio" ? "Comisión" : "Ganancia"} <strong>{usd0(rol === "socio" ? res.comision : (o.status === "operacion_cerrada" ? res.real : res.ganancia))}</strong></span>}
          <Pill c={st.c}>{st.l}</Pill>
        </div>
      </Fila>; })}
    </div>}
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
function Clientes({ ctx }) {
  const { token, rol, d, ir } = ctx;
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const mapa = new Map();
  const tocar = (c) => { if (!c?.id) return null; if (!mapa.has(c.id)) mapa.set(c.id, { c, cots: 0, ops: 0, vendido: 0, abiertas: 0 }); return mapa.get(c.id); };
  d.reqs.forEach((r) => { const x = tocar(r.clients); if (x) x.cots++; });
  d.ops.forEach((o) => { const x = tocar(o.clients); if (x) { x.ops++; if (o.status !== "cancelada") x.vendido += Number(o.budget_total || 0); if (!["operacion_cerrada", "cancelada"].includes(o.status)) x.abiertas++; } });
  const s = q.trim().toLowerCase();
  const lista = [...mapa.values()].filter((x) => !s || `${nombre(x.c)} ${x.c.client_code || ""}`.toLowerCase().includes(s)).sort((a, b) => b.vendido - a.vendido || b.cots - a.cots);
  const socioDe = (id) => d.socios.find((p) => p.id === id);
  return <div>
    <Titulo sub={`${lista.length} cliente${lista.length === 1 ? "" : "s"} con cotizaciones u operaciones de GI`}>Clientes</Titulo>
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente" style={{ ...inp, marginBottom: 12 }} />
    {lista.length === 0 ? <Vacio>Sin clientes todavía.</Vacio> : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {lista.map(({ c, cots, ops, vendido, abiertas }) => { const so = socioDe(c.gi_partner_id); return <Fila key={c.id} onClick={rol === "admin" ? () => setEdit(c) : undefined}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{nombre(c)} <span style={{ fontFamily: MONO, fontSize: 11, color: C.goldHi, fontWeight: 600 }}>{c.client_code}</span></p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: C.mute }}>{cots} cotiz. · {ops} op.{abiertas ? ` (${abiertas} en curso)` : ""}{rol !== "socio" ? ` · ${so ? `socio ${so.email.split("@")[0]}${c.gi_commission_pct != null ? ` ${c.gi_commission_pct}%` : ""}` : "Argencargo"}` : ""}</p>
        </div>
        {vendido > 0 && <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{usd0(vendido)}</span>}
      </Fila>; })}
    </div>}
    {edit && <ClienteSocioModal c={edit} d={d} token={token} onClose={() => setEdit(null)} onListo={() => { setEdit(null); ctx.recargar(); }} />}
  </div>;
}

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
    <Titulo right={rol === "admin" ? <Btn v="gold" onClick={() => setInvitar(true)}>+ Socio</Btn> : null}>{rol === "admin" ? "Socios" : "Mis comisiones"}</Titulo>
    {socios.length === 0 && <Vacio>Todavía no hay socios.</Vacio>}
    {socios.map((s) => {
      const ea = d.earnings.filter((e) => e.partner_id === s.id);
      const aPagar = ea.filter((e) => !e.paid_to_partner);
      const totalAPagar = aPagar.reduce((a, e) => a + Number(e.commission_usd || 0), 0);
      const pagado = ea.filter((e) => e.paid_to_partner).reduce((a, e) => a + Number(e.paid_amount_usd ?? e.commission_usd ?? 0), 0);
      const nClientes = new Set(d.ops.filter((o) => (o.gi_partner_id || o.clients?.gi_partner_id) === s.id).map((o) => o.client_id)).size;
      const enCurso = d.ops.filter((o) => !o.gi_admin_owned && (o.gi_partner_id || o.clients?.gi_partner_id) === s.id && !["operacion_cerrada", "cancelada"].includes(o.status));
      return <Caja key={s.id} title={<span style={{ color: C.txt, textTransform: "none", letterSpacing: 0, fontSize: 15 }}>{s.email}</span>} right={rol === "admin" ? <div style={{ display: "flex", gap: 6 }}><Btn small onClick={() => cambiarPct(s)}>{Number(s.gi_partner_pct || 0)}% general</Btn><Btn small v="ghost" onClick={() => quitar(s)}>Quitar acceso</Btn></div> : null}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14, marginBottom: 14 }}>
          <Dato label="A cobrar" val={fmtUSD(totalAPagar)} c={totalAPagar >= 0 ? C.goldHi : C.red} sub={`${aPagar.length} op.`} />
          <Dato label="Ya cobrado" val={fmtUSD(pagado)} />
          <Dato label="En curso" val={String(enCurso.length)} sub="operaciones" />
          <Dato label="Clientes" val={String(nClientes)} />
        </div>
        {rol === "admin" && aPagar.length > 0 && <Btn v="gold" small onClick={() => liquidar(s, aPagar)} disabled={pagando === s.id} style={{ marginBottom: 12 }}>{pagando === s.id ? "Liquidando…" : `Liquidar ${fmtUSD(totalAPagar)}`}</Btn>}
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
function Contactos({ token }) {
  const [t, setT] = useState("suppliers");
  return <div>
    <Chips value={t} onChange={setT} items={[{ k: "suppliers", l: "Proveedores" }, { k: "agents", l: "Agentes de compra" }, { k: "forwarders", l: "Embarcadores" }]} />
    {t === "suppliers" && <ContactsPanel token={token} type="suppliers" title="Proveedores" desc="" groupBy="rubro" rubroOptions={["Indumentaria", "Electrónica", "Calzado", "Hogar", "Cosmética", "Juguetería", "Deportes", "Otros"]} fields={[{ k: "name", l: "Nombre", req: true }, { k: "rubro", l: "Rubro", select: true }, { k: "country", l: "País", options: ["China", "USA"] }, { k: "city", l: "Ciudad" }, { k: "email", l: "Email" }, { k: "phone", l: "Teléfono" }, { k: "wechat", l: "WeChat" }, { k: "moq", l: "MOQ", num: true }, { k: "lead_time_days", l: "Lead time (días)", num: true }, { k: "notes", l: "Notas", textarea: true }]} />}
    {t === "agents" && <ContactsPanel token={token} type="purchase_agents" title="Agentes de compra" desc="" groupBy="rubro" rubroOptions={["Indumentaria", "Electrónica", "Calzado", "General", "Otros"]} fields={[{ k: "name", l: "Nombre", req: true }, { k: "rubro", l: "Rubro", select: true }, { k: "base_city", l: "Ciudad base" }, { k: "email", l: "Email" }, { k: "phone", l: "Teléfono" }, { k: "wechat", l: "WeChat" }, { k: "commission_pct", l: "Comisión %", num: true }, { k: "commission_fixed_usd", l: "Comisión fija USD", num: true }, { k: "notes", l: "Notas", textarea: true }]} />}
    {t === "forwarders" && <ContactsPanel token={token} type="forwarders" title="Embarcadores" desc="" groupBy="city" rubroOptions={["Shanghái", "Guangzhou", "Shenzhen", "Yiwu", "Ningbo", "Miami", "Los Ángeles", "Otros"]} fields={[{ k: "name", l: "Nombre", req: true }, { k: "city", l: "Ciudad", select: true }, { k: "email", l: "Email" }, { k: "phone", l: "Teléfono" }, { k: "modes_str", l: "Modos (coma separado)", placeholder: "aereo,maritimo" }, { k: "notes", l: "Notas", textarea: true }]} />}
  </div>;
}
