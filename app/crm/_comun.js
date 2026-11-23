"use client";
// Piezas chicas compartidas por las pantallas del CRM (30/10/2026). La paleta, la sesión y los
// componentes grandes vienen de app/gi/_base.js; acá va lo propio de contactos y chats.
import { C } from "../gi/_base";

export const fmtTel = (p) => { const d = String(p || "").replace(/\D/g, ""); if (d.startsWith("549") && d.length === 13) return `+54 9 ${d.slice(3, 5)} ${d.slice(5, 9)}-${d.slice(9)}`; return d ? `+${d}` : "—"; };
export const nombreDe = (c) => c?.name || c?.wa_name || fmtTel(c?.phone);
export const inicialesDe = (c) => { const n = c?.name || c?.wa_name; if (!n) return "#"; const p = n.trim().split(/\s+/); return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase(); };
export const hora = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
export const diaDe = (ts) => { const d = new Date(ts); const hoy = new Date(); const ayer = new Date(Date.now() - 864e5); const mismo = (a, b) => a.toDateString() === b.toDateString(); if (mismo(d, hoy)) return "Hoy"; if (mismo(d, ayer)) return "Ayer"; return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }); };
// Hora como la muestra WhatsApp ("5:41 p. m.") y fecha de la lista de chats (hora si es de hoy, "Ayer", o el día).
export const horaWa = (ts) => { const d = new Date(ts); let h = d.getHours(); const pm = h >= 12; h = h % 12 || 12; return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${pm ? "p. m." : "a. m."}`; };
export const cuandoLista = (ts) => { if (!ts) return ""; const d = new Date(ts); const hoy = new Date(); if (d.toDateString() === hoy.toDateString()) return horaWa(ts); if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return "Ayer"; return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`; };
// Paleta del chat: la de WhatsApp en modo oscuro (23/11/2026, pedido de Bautista: "lo más similar a WhatsApp posible").
export const W = { bg: "#161717", fondo: "#0c0d0d", hover: "#1f2121", sel: "#2b2d2d", caja: "#242626", line: "rgba(255,255,255,0.08)", txt: "#fafafa", sub: "#a8a9a9", mute: "#858686", out: "#144d37", inn: "#242626", verde: "#21c063", azul: "#53bdeb", rojo: "#f15c6d" };
export const fechaCorta = (ts) => { if (!ts) return "—"; const d = new Date(ts); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`; };
export const usd = (n) => "USD " + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });

// Etapas del lead. Las automáticas salen del sistema; "perdido" la marca una persona.
export const ETAPAS = [
  { k: "nuevo", l: "Nuevo", c: "#60a5fa" },
  { k: "hablando", l: "Hablando", c: "#E8D098" },
  { k: "cotizo", l: "Cotizó", c: "#a78bfa" },
  { k: "importo", l: "Importó", c: "#22c55e" },
  { k: "perdido", l: "Perdido", c: "rgba(255,255,255,0.4)" },
];
export const etapaDe = (k) => ETAPAS.find((e) => e.k === k) || ETAPAS[0];

// Lo que se ve de un mensaje sin texto (foto, audio…).
export const VISTA = { image: "📷 Foto", video: "🎥 Video", audio: "🎤 Audio", document: "📄 Documento", sticker: "Sticker", location: "📍 Ubicación", contacts: "👤 Contacto", media_placeholder: "📎 Adjunto anterior a la conexión", reaction: "Reacción", unsupported: "Mensaje no soportado", request_welcome: "Abrió el chat desde un anuncio" };

export function Avatar({ c, s = 38, wa }) {
  if (wa) return <div style={{ width: s, height: s, borderRadius: "50%", flexShrink: 0, background: c?.name || c?.wa_name ? "#2f4f43" : "#3a3c3c", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: s * 0.36, color: "#e7f6ee" }}>{c?.name || c?.wa_name ? inicialesDe(c) : <svg width={s * 0.5} height={s * 0.5} viewBox="0 0 24 24" fill="#cfd1d1"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" /></svg>}</div>;
  return <div style={{ width: s, height: s, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, rgba(184,149,106,0.22), rgba(184,149,106,0.08))", border: "1px solid rgba(184,149,106,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: s * 0.33, color: C.goldHi }}>{inicialesDe(c)}</div>;
}

export function Etapa({ k, small }) {
  const e = etapaDe(k);
  return <span style={{ fontSize: small ? 9.5 : 10.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: e.c, padding: small ? 0 : "3px 9px", borderRadius: 999, border: small ? "none" : `1px solid ${e.c}55`, background: small ? "transparent" : `${e.c}18`, whiteSpace: "nowrap" }}>{e.l}</span>;
}

// Llamadas a /api/crm/* (el Bearer lo agrega instalarAuthFetch de app/gi/_base.js).
export async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  return r.json().catch(() => ({ error: `HTTP ${r.status}` }));
}

// Botón chico de texto (acciones secundarias dentro de tarjetas).
export function Accion({ children, onClick, c = C.goldHi, disabled, title }) {
  return <button type="button" onClick={onClick} disabled={disabled} title={title} style={{ background: "transparent", border: "none", padding: "2px 4px", color: disabled ? C.mute : c, fontSize: 12, fontWeight: 700, cursor: disabled ? "default" : "pointer", fontFamily: "inherit" }}>{children}</button>;
}
