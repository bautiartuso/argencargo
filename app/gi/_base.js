"use client";
// Base del panel de Gestión Integral: sesión, consultas a Supabase, formato y piezas visuales.
import { useEffect, useState } from "react";
import { comprimirImagen } from "../../lib/img";

export const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
export const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
export const LOGO = `${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;

// Paleta (navy + dorado de Argencargo).
// Fondo y paleta iguales al admin (#0A1628 con brillos dorado/azul).
export const BG = "radial-gradient(1200px 600px at 80% -10%, rgba(184,149,106,0.10), transparent 60%), radial-gradient(900px 700px at -10% 100%, rgba(96,165,250,0.06), transparent 50%), #0A1628";
export const C = {
  bg: "#0A1628",
  panel: "#0f1d33",
  card: "rgba(255,255,255,0.035)",
  cardHi: "rgba(255,255,255,0.06)",
  line: "rgba(255,255,255,0.08)",
  lineHi: "rgba(255,255,255,0.14)",
  txt: "#eef2f8",
  sub: "rgba(238,242,248,0.62)",
  mute: "rgba(238,242,248,0.4)",
  gold: "#C9A46A",
  goldHi: "#E8D098",
  goldBg: "rgba(201,164,106,0.12)",
  green: "#34d399",
  red: "#f87171",
  amber: "#fbbf24",
  blue: "#60a5fa",
  violet: "#a78bfa",
};
export const GOLD = "#B8956A", GOLD_LIGHT = "#E8D098", GOLD_DEEP = "#A68456";
export const GOLD_GRADIENT = "linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";
export const MONO = "'JetBrains Mono','SF Mono',ui-monospace,monospace";

// ── Sesión ──
// El panel tiene su propia sesión (ac_gi_s). Si el admin/empleado ya está logueado en /admin, se
// usa ESA misma sesión (se lee y se guarda en ac_admin): compartir el refresh token entre dos lugares
// haría que uno invalide al otro.
let _fuente = "gi";
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
export const loadSession = () => {
  if (_fuente === "admin") {
    const a = leer("ac_admin");
    return a?.token ? { access_token: a.token, refresh_token: a.refresh_token, user: a.user } : null;
  }
  return leer("ac_gi_s");
};
export const saveSession = (d) => {
  try {
    if (_fuente === "admin") {
      const a = leer("ac_admin") || {};
      localStorage.setItem("ac_admin", JSON.stringify({ ...a, token: d.access_token, refresh_token: d.refresh_token, user: d.user || a.user }));
    } else localStorage.setItem("ac_gi_s", JSON.stringify(d));
  } catch {}
};
export const clearSession = () => { try { if (_fuente === "gi") localStorage.removeItem("ac_gi_s"); } catch {} _fuente = "gi"; };
export const sesionInicial = () => {
  const g = leer("ac_gi_s");
  if (g?.access_token) { _fuente = "gi"; return g; }
  const a = leer("ac_admin");
  if (a?.token && a?.user?.id) { _fuente = "admin"; return loadSession(); }
  return null;
};
export const usarSesionPropia = () => { _fuente = "gi"; };

const sf = async (p, o = {}) => {
  const r = await fetch(`${SB_URL}${p}`, { ...o, headers: { apikey: SB_KEY, "Content-Type": "application/json", ...(o.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => null) };
};
export const ac = async (e, b) => (await sf(`/auth/v1/${e}`, { method: "POST", body: JSON.stringify(b) })).body;
const jwtExp = (t) => { try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000; } catch { return 0; } };
let _refresh = null;
const refreshToken = async () => {
  if (_refresh) return _refresh;
  _refresh = (async () => {
    const s = loadSession(); if (!s?.refresh_token) return null;
    const r = await ac("token?grant_type=refresh_token", { refresh_token: s.refresh_token });
    if (r?.access_token) { const ns = { access_token: r.access_token, refresh_token: r.refresh_token || s.refresh_token, user: r.user || s.user }; saveSession(ns); return ns.access_token; }
    clearSession(); if (typeof window !== "undefined") window.location.reload(); return null;
  })();
  try { return await _refresh; } finally { _refresh = null; }
};
export const ensureFresh = async (t) => {
  const s = loadSession();
  const actual = s?.access_token || t;
  if (jwtExp(actual) > Date.now() + 60000) return actual;
  return (await refreshToken()) || actual;
};
const _sanitize = (b) => { if (!b || typeof b !== "object" || Array.isArray(b)) return b; const o = {}; for (const k in b) o[k] = b[k] === "" ? null : b[k]; return o; };
export const dq = async (t, { method = "GET", body, token, filters = "", headers = {} }) => {
  const fresh = await ensureFresh(token);
  const cb = (method === "PATCH" || method === "POST") ? _sanitize(body) : body;
  const doReq = (tk) => sf(`/rest/v1/${t}${filters}`, { method, body: cb ? JSON.stringify(cb) : undefined, headers: { Authorization: `Bearer ${tk}`, ...(method === "POST" || method === "PATCH" ? { Prefer: "return=representation" } : {}), ...headers } });
  let r = await doReq(fresh);
  if (r.status === 401) { const nt = await refreshToken(); if (nt) r = await doReq(nt); }
  if (r.status >= 400) console.error(`[dq] ${method} ${t} ${r.status}`, r.body);
  return r.body;
};
// Pagina de a 1000 (PostgREST corta cada request en 1000).
export const dqTodos = async (t, { token, filters = "" }) => { const out = []; for (let desde = 0; ; desde += 1000) { const sep = filters.includes("?") ? "&" : "?"; const r = await dq(t, { token, filters: `${filters}${sep}offset=${desde}&limit=1000` }); if (!Array.isArray(r)) return out; out.push(...r); if (r.length < 1000) return out; } };
export const arr = (r) => (Array.isArray(r) ? r : []);
export const ok = (r) => Array.isArray(r) ? r.length > 0 : !!(r && !r.code && !r.message);

export const uploadProductPhoto = async (file, token) => {
  if (!file) return null;
  file = await comprimirImagen(file);
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `gi-prod/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const fresh = await ensureFresh(token);
  const r = await fetch(`${SB_URL}/storage/v1/object/package-photos/${path}`, { method: "POST", headers: { Authorization: `Bearer ${fresh}`, apikey: SB_KEY, "Content-Type": file.type || "image/jpeg" }, body: file });
  if (!r.ok) { console.error("upload failed", await r.text()); return null; }
  return `${SB_URL}/storage/v1/object/public/package-photos/${path}`;
};

// ── Formato ──
export const fmtDate = (d) => { if (!d) return "—"; const s = String(d).slice(0, 10); const [y, m, day] = s.split("-"); return new Date(y, m - 1, day).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }); };
export const fmtDateShort = (d) => { if (!d) return "—"; const s = String(d).slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, day] = s.split("-"); return `${day}/${m}/${y.slice(2)}`; } return "—"; };
export const fmtDateTime = (d) => { if (!d) return "—"; const dd = new Date(d); if (isNaN(dd.getTime())) return "—"; return `${String(dd.getDate()).padStart(2, "0")}/${String(dd.getMonth() + 1).padStart(2, "0")}/${String(dd.getFullYear()).slice(2)} ${String(dd.getHours()).padStart(2, "0")}:${String(dd.getMinutes()).padStart(2, "0")}`; };
export const fmtDateLong = (d) => { if (!d) return ""; const s = String(d).slice(0, 10); const [y, m, day] = s.split("-"); if (!y || !m || !day) return ""; const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]; return `${Number(day)} de ${meses[Number(m) - 1]} de ${y}`; };
export const fmtUSD = (n) => "USD " + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd0 = (n) => "USD " + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
export const hace = (d) => {
  if (!d) return "";
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const dd = Math.round(h / 24);
  return dd === 1 ? "ayer" : `hace ${dd} días`;
};
export const hoyISO = () => { const d = new Date(Date.now() - 3 * 3600000); return d.toISOString().slice(0, 10); };
export const nombre = (c) => (c ? `${c.first_name || ""} ${c.last_name || ""}`.replace(/\s—$/, "").trim() || "—" : "—");

export const buildQuoteWaMessage = ({ firstName, code, url, expiresAt }) => {
  const greeting = firstName ? `Hola ${firstName}, ¿cómo estás?` : "Hola, ¿cómo estás?";
  const validez = expiresAt ? `\n\nVálida hasta el ${fmtDateLong(expiresAt)}.` : "";
  return `${greeting}\n\nTe enviamos la cotización${code ? ` ${code}` : ""} para tu importación 🚢\n\n${url}${validez}\n\nPara verla entrá con tu cuenta de Argencargo (si no tenés, la creás ahí mismo en un minuto).\n\nCualquier duda estamos a disposición ✨\n\n*ARGENCARGO*`;
};
export const cleanWaNumber = (raw) => { if (!raw) return ""; let s = String(raw).replace(/[^0-9]/g, ""); if (!s) return ""; if (s.startsWith("0")) s = s.slice(1); if (s.startsWith("15")) s = "54911" + s.slice(2); if (!s.startsWith("54")) s = "54" + s; return s; };

// ── Ancho de pantalla ──
export function useMovil(bp = 820) {
  const [m, setM] = useState(false);
  useEffect(() => { const f = () => setM(window.innerWidth < bp); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, [bp]);
  return m;
}

// ── Piezas visuales ──
export function Btn({ children, onClick, v = "sec", disabled, small, full, style = {}, title, type = "button" }) {
  const base = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: small ? "7px 12px" : "10px 16px", fontSize: small ? 12 : 13, fontWeight: 700, borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", border: "1px solid transparent", whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1, width: full ? "100%" : undefined, transition: "background 120ms, border-color 120ms" };
  const vs = {
    gold: { background: GOLD_GRADIENT, color: "#0A1628" },
    sec: { background: "rgba(255,255,255,0.05)", color: C.txt, borderColor: C.line },
    ghost: { background: "transparent", color: C.sub, borderColor: "transparent" },
    green: { background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff" },
    red: { background: "rgba(248,113,113,0.1)", color: C.red, borderColor: "rgba(248,113,113,0.3)" },
    wa: { background: "linear-gradient(135deg,#25D366,#128C7E)", color: "#fff" },
  };
  return <button type={type} title={title} onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...vs[v], ...style }}>{children}</button>;
}

export function Pill({ c = C.sub, children, solid }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, color: solid ? "#0A1628" : c, background: solid ? c : `${c}1c`, border: `1px solid ${c}40`, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>{children}</span>;
}

export function Caja({ title, right, children, pad = 16, style = {} }) {
  return <section style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: pad, marginBottom: 14, ...style }}>
    {(title || right) && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
      {title && <h3 style={{ fontSize: 12, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{title}</h3>}
      {right}
    </div>}
    {children}
  </section>;
}

// Encabezado de cada sección: mini título dorado, título y descripción.
export function Titulo({ children, sub, right, eyebrow }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
    <div style={{ minWidth: 0 }}>
      {eyebrow && <p style={{ fontSize: 10.5, fontWeight: 800, color: C.gold, textTransform: "uppercase", letterSpacing: "0.16em", margin: "0 0 6px" }}>{eyebrow}</p>}
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: C.txt }}>{children}</h1>
      {sub && <p style={{ fontSize: 13.5, color: C.sub, margin: "6px 0 0", lineHeight: 1.5, maxWidth: 640 }}>{sub}</p>}
    </div>
    {right}
  </div>;
}

export function Chips({ items, value, onChange }) {
  return <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 14, scrollbarWidth: "none" }}>
    {items.map((it) => { const on = value === it.k; return <button key={it.k} onClick={() => onChange(it.k)} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${on ? C.gold : C.line}`, background: on ? C.goldBg : "transparent", color: on ? C.goldHi : C.sub }}>
      {it.l}{it.n != null && <span style={{ fontSize: 10.5, fontWeight: 800, padding: "1px 7px", borderRadius: 999, background: on ? C.gold : "rgba(255,255,255,0.08)", color: on ? "#0A1628" : C.sub }}>{it.n}</span>}
    </button>; })}
  </div>;
}

export function Vacio({ children }) {
  return <div style={{ padding: "34px 16px", textAlign: "center", color: C.mute, fontSize: 13, border: `1px dashed ${C.line}`, borderRadius: 14 }}>{children}</div>;
}

export function Cargando() {
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[0, 1, 2].map((i) => <div key={i} style={{ height: 58, borderRadius: 12, background: "linear-gradient(90deg,rgba(255,255,255,0.03),rgba(255,255,255,0.07),rgba(255,255,255,0.03))", backgroundSize: "200% 100%", animation: "giShimmer 1.2s infinite" }} />)}</div>;
}

export function Modal({ title, onClose, children, width = 520, footer }) {
  const movil = useMovil();
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose?.(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,8,16,0.72)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: movil ? "flex-end" : "center", justifyContent: "center", padding: movil ? 0 : 20 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: movil ? "100%" : width, maxHeight: movil ? "92vh" : "88vh", display: "flex", flexDirection: "column", background: C.panel, border: `1px solid ${C.lineHi}`, borderRadius: movil ? "18px 18px 0 0" : 16, boxShadow: "0 30px 80px rgba(0,0,0,0.6)", color: C.txt }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px 12px", borderBottom: `1px solid ${C.line}` }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{title}</h2>
        <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.sub, cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>
      <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>{children}</div>
      {footer && <div style={{ padding: "12px 18px 16px", borderTop: `1px solid ${C.line}`, display: "flex", gap: 8, justifyContent: "flex-end" }}>{footer}</div>}
    </div>
  </div>;
}

export function Campo({ label, children, style = {} }) {
  return <label style={{ display: "block", marginBottom: 12, ...style }}>
    <span style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>{label}</span>
    {children}
  </label>;
}
export const inp = { width: "100%", padding: "10px 12px", fontSize: 14, boxSizing: "border-box", border: `1px solid ${C.lineHi}`, borderRadius: 10, background: "rgba(0,0,0,0.25)", color: C.txt, outline: "none", fontFamily: "inherit" };

// Opciones como botones (en vez de <select> nativo).
export function Opciones({ value, onChange, items, cols }) {
  return <div style={{ display: "grid", gridTemplateColumns: cols ? `repeat(${cols},1fr)` : `repeat(auto-fill,minmax(120px,1fr))`, gap: 6 }}>
    {items.map((it) => { const on = value === it.k; return <button key={it.k} type="button" onClick={() => onChange(it.k)} style={{ padding: "9px 10px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textAlign: "center", border: `1.5px solid ${on ? C.gold : C.line}`, background: on ? C.goldBg : "rgba(255,255,255,0.02)", color: on ? C.goldHi : C.sub }}>{it.l}</button>; })}
  </div>;
}

export function Dato({ label, val, c, sub }) {
  return <div style={{ minWidth: 0 }}>
    <p style={{ fontSize: 10, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>{label}</p>
    <p style={{ fontSize: 17, fontWeight: 800, color: c || C.txt, margin: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val}</p>
    {sub && <p style={{ fontSize: 11, color: C.mute, margin: "3px 0 0" }}>{sub}</p>}
  </div>;
}

export function Fila({ onClick, children, style = {} }) {
  return <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, cursor: onClick ? "pointer" : "default", transition: "border-color 120ms, background 120ms", ...style }}
    onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.borderColor = "rgba(201,164,106,0.35)"; e.currentTarget.style.background = C.cardHi; } }}
    onMouseLeave={(e) => { if (onClick) { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.background = C.card; } }}>{children}</div>;
}

export function Codigo({ children }) {
  return <span style={{ fontFamily: MONO, fontWeight: 700, color: C.goldHi, fontSize: 12.5, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{children}</span>;
}

export function Volver({ onClick }) {
  return <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.sub, background: "transparent", border: `1px solid ${C.line}`, cursor: "pointer", fontWeight: 700, padding: "7px 12px", borderRadius: 9, marginBottom: 14, fontFamily: "inherit" }}>← Volver</button>;
}
