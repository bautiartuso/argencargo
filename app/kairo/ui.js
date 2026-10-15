"use client";
// Piezas compartidas de Kairo (tokens, íconos, hojas, botones). Cada sección importa de acá.
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export const C = {
  bg: "#0C0D10", card: "#15171B", cardHi: "#1C1F24", line: "#24262C",
  text: "#F2F3F5", sub: "#7D8089", dim: "#55585F",
  lime: "#C6F432", limeInk: "#1B2203", blue: "#3D7BFF", warn: "#FF8A5C", danger: "#FF5C5C",
  pos: "#4ADE80", neg: "#FF6B6B", // entra / sale
};

export const CSS = `
  html,body{background:${C.bg};margin:0;height:100%}
  .k-root{height:100%}
  html,body{color:${C.text};-webkit-font-smoothing:antialiased;overscroll-behavior-y:none}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  button{font-family:inherit;cursor:pointer}
  input,select{font-family:inherit;font-size:16px}
  .k-press{transition:transform 120ms ease, opacity 120ms ease}
  .k-press:active{transform:scale(0.97);opacity:.85}
  @keyframes kUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
  @keyframes kFade{from{opacity:0}to{opacity:1}}
  .k-num{font-variant-numeric:tabular-nums;letter-spacing:-0.02em}
`;

export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => ymd(new Date());
export const curMonth = () => today().slice(0, 7);
export const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
export const arsK = (n) => { const v = Math.round(Number(n) || 0); return Math.abs(v) >= 100000 ? "$" + Math.round(v / 1000).toLocaleString("es-AR") + "k" : ars(v); };
export const monthName = (m) => { const [y, mm] = m.split("-").map(Number); const s = new Date(y, mm - 1, 15).toLocaleDateString("es-AR", { month: "long" }); return s[0].toUpperCase() + s.slice(1) + (y !== new Date().getFullYear() ? ` ${y}` : ""); };
export const shiftMonth = (m, d) => { const [y, mm] = m.split("-").map(Number); const dt = new Date(y, mm - 1 + d, 1); return ymd(dt).slice(0, 7); };
export const daysIn = (m) => { const [y, mm] = m.split("-").map(Number); return new Date(y, mm, 0).getDate(); };
export const parseNum = (s) => Number(String(s).trim().replace(/\./g, "").replace(",", ".")) || 0;
export const merchantKey = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
export const dayLabel = (d) => { if (d === today()) return "hoy"; const y = new Date(); y.setDate(y.getDate() - 1); if (d === ymd(y)) return "ayer"; return d.slice(8) + "/" + d.slice(5, 7); };

// ─────── Íconos (trazo fino, 24px) ───────
export const I = {
  home: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z",
  gym: "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12",
  food: "M4 12h16a8 8 0 0 1-16 0zM9 4c0 2 2 2 2 4M14 4c0 2 2 2 2 4",
  wallet: "M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1zM4 7l11-3v3M16 13h1",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  plus: "M12 5v14M5 12h14",
  left: "M15 6l-6 6 6 6", right: "M9 6l6 6-6 6",
  sync: "M20 11a8 8 0 0 0-14.9-3M4 5v3h3M4 13a8 8 0 0 0 14.9 3M20 19v-3h-3",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  check: "M5 12.5l4.5 4.5L19 7.5",
  camera: "M4 8h3l2-2.5h6L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  down: "M6 9l6 6 6-6",
  dots: "M12 5.5v.01M12 12v.01M12 18.5v.01",
  timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M9.5 2.5h5",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z",
};
export const Icon = ({ d, size = 22, color = "currentColor", sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

// ─────── Toast ───────
export let pushToast = () => {};
export function Toast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => { pushToast = (m) => { setMsg(m); setTimeout(() => setMsg(null), 2400); }; }, []);
  if (!msg) return null;
  return <div style={{ position: "fixed", left: 16, right: 16, top: "calc(env(safe-area-inset-top) + 12px)", zIndex: 120, display: "flex", justifyContent: "center", animation: "kFade 160ms" }}>
    <div style={{ background: C.cardHi, border: `0.5px solid ${C.line}`, borderRadius: 14, padding: "11px 16px", fontSize: 14 }}>{msg}</div>
  </div>;
}

export const MiniStat = ({ label, value, color }) => <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 14, padding: "10px 12px", minWidth: 0 }}>
  <div style={{ fontSize: 11, color: C.sub }}>{label}</div>
  <div className="k-num" style={{ fontSize: 15, fontWeight: 500, marginTop: 2, color: color || C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
</div>;

// ─────── Sheets ───────
// tall: ocupa casi toda la pantalla aunque el contenido sea corto (buscadores: con el teclado
// abierto, una hoja que se achica queda escondida detrás del teclado en el iPhone).
// Se dibuja afuera de la zona que scrollea (portal a .k-root, que tiene la tipografía): adentro, el
// iPhone dejaba la barra de abajo por encima de la hoja y tapaba los botones. z 100: arriba de todo
// (también del entreno a pantalla completa).
export function Sheet({ title, onClose, children, tall }) {
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)", animation: "kFade 160ms", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88dvh", ...(tall ? { height: "calc(100dvh - env(safe-area-inset-top) - 16px)", maxHeight: "none" } : {}), overflowY: "auto", background: C.card, borderTop: `0.5px solid ${C.line}`, borderRadius: "22px 22px 0 0", padding: "10px 18px calc(env(safe-area-inset-bottom) + 18px)", animation: "kUp 260ms cubic-bezier(.2,.9,.3,1)" }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: C.line, margin: "0 auto 14px" }} />
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 14, letterSpacing: "-0.01em" }}>{title}</div>
      {children}
    </div>
  </div>, document.querySelector(".k-root") || document.body);
}

// ─────── Piezas ───────
export function Bar({ pct, color, mark, h = 4, mt = 14 }) {
  return <div style={{ position: "relative", height: h, background: C.line, borderRadius: h, marginTop: mt }}>
    <div style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%`, height: "100%", background: color, borderRadius: h, transition: "width 500ms cubic-bezier(.2,.9,.3,1)" }} />
    {mark != null && <div title="Día del mes" style={{ position: "absolute", top: -3, left: `${Math.min(100, mark * 100)}%`, width: 1.5, height: h + 6, background: C.text, opacity: 0.55, borderRadius: 1 }} />}
  </div>;
}
export function Toggle({ on }) {
  return <span style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 13, background: on ? C.lime : C.line, position: "relative", transition: "background 160ms" }}>
    <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: on ? C.limeInk : C.sub, transition: "left 160ms" }} />
  </span>;
}
export const SectionTitle = ({ children, right }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "28px 2px 10px" }}><span style={{ fontSize: 13, color: C.sub }}>{children}</span>{right}</div>;
export const Label = ({ children }) => <div style={{ fontSize: 13, color: C.sub, margin: "18px 2px 8px" }}>{children}</div>;
export const RoundBtn = ({ children, onClick, label }) => <button onClick={onClick} aria-label={label} className="k-press" style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: "transparent", color: C.sub, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</button>;

export const card = { background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 20, padding: 16 };
export const field = { width: "100%", background: C.cardHi, border: `0.5px solid ${C.line}`, borderRadius: 12, padding: "13px 14px", color: C.text, outline: "none" };
export const btnLime = { width: "100%", background: C.lime, color: C.limeInk, border: "none", borderRadius: 14, padding: "14px 16px", fontSize: 15, fontWeight: 600 };
export const btnGhost = { width: "100%", background: C.card, color: C.text, border: `0.5px solid ${C.line}`, borderRadius: 14, padding: "14px 16px", fontSize: 15, fontWeight: 500 };
export const linkBtn = { background: "none", border: "none", color: C.lime, fontSize: 13, padding: 0 };
