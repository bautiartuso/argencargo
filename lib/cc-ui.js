"use client";
// Piezas compartidas de la CC Financiera. La vista de lectura era una reimplementación aparte del
// panel del admin, así que las dos se fueron separando: el admin tenía los saldos en dos columnas
// pero no los filtros de fecha/tipo, y la de lectura tenía los filtros pero mostraba un solo saldo
// mezclando pesos y dólares. Ahora las dos usan esto y la única diferencia es que en la de lectura
// no se puede editar ni agregar.

import { useState, useEffect } from "react";
import DatePicker from "../app/components/DatePicker";
import { CARRIER_LOGOS } from "./carrier-logos";

// Logo del carrier en un cuadradito con el fondo de la marca. Las transferencias a DHL, FedEx y
// UPS salen en el libro con el logo de la empresa (lo detecta por la descripción).
export const carrierDe = (desc) => { const m = String(desc || "").match(/\b(dhl|fedex|ups)\b/i); return m ? m[1].toLowerCase() : null; };
export function LogoCarrier({ k, size = 28 }) {
  const L = CARRIER_LOGOS[k];
  if (!L) return null;
  return <span title={k.toUpperCase()} style={{ flexShrink: 0, width: size, height: size, borderRadius: Math.round(size / 4.5), background: L.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.12)", boxSizing: "border-box" }}>
    <svg viewBox={L.vb} style={{ width: size * 0.78, height: size * 0.78 }} preserveAspectRatio="xMidYMid meet"><path d={L.d} fill={L.fill} /></svg>
  </span>;
}

export const T = {
  bg: "#0A1628", bgSurface: "rgba(255,255,255,0.028)", bgSurfaceHi: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.07)", text: "#fff", textMuted: "rgba(255,255,255,0.62)",
  textDim: "rgba(255,255,255,0.38)", gold: "#E8D098", goldDark: "#B8956A",
  goldGrad: "linear-gradient(135deg,#E8D098,#B8956A)",
  green: "#4ade80", red: "#f87171", amber: "#fbbf24", blue: "#60a5fa",
};

export const fmtMoney = (n, currency = "ARS") =>
  `${currency} ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d) => {
  if (!d) return "—";
  const [y, m, dd] = String(d).slice(0, 10).split("-");
  return `${dd}/${m}/${String(y).slice(2)}`;
};

export const fmtDateLarga = (d) => {
  if (!d) return "—";
  const [y, m, dd] = String(d).slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
};

export function useIsMobile(breakpoint = 720) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

// Saldo corriente por moneda, de más viejo a más nuevo. Devuelve la lista al revés (lo último
// arriba) más los totales. Cada fila lleva el saldo de LAS DOS monedas en ese momento, para poder
// mostrarlas en columnas separadas sin volver a recorrer.
export function enrichMovements(movements) {
  const asc = [...(movements || [])].sort(
    (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created_at || "").localeCompare(String(b.created_at || ""))
  );
  let ars = 0, usd = 0;
  const withRunning = asc.map((m) => {
    const net = Number(m.net_amount || 0);
    const signed = m.type === "ingreso" ? net : -net;
    if (m.currency === "ARS") ars += signed; else usd += signed;
    return { ...m, _signed: signed, _arsBal: ars, _usdBal: usd };
  });
  return { withRunning: withRunning.reverse(), totals: { ars, usd } };
}

export function aplicarFiltros(rows, { currency, type, from, to }) {
  return rows.filter((m) => {
    if (currency && currency !== "all" && m.currency !== currency) return false;
    if (type && type !== "all" && m.type !== type) return false;
    const d = String(m.date || "").slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

export function calcStats(rows) {
  const base = () => ({ movs: 0, ingresos: 0, egresos: 0, comision: 0, ingresosBrutos: 0 });
  const acc = { ARS: base(), USD: base() };
  for (const m of rows) {
    const a = acc[m.currency] || (acc[m.currency] = base());
    a.movs++;
    if (m.type === "ingreso") {
      a.ingresos += Number(m.net_amount || 0);
      a.ingresosBrutos += Number(m.amount || 0);
      a.comision += Number(m.commission_amount || 0);
    } else a.egresos += Number(m.amount || 0);
  }
  return acc;
}

export function BalanceCard({ label, currency, amount }) {
  const positivo = Number(amount || 0) >= 0;
  const color = positivo ? T.green : T.red;
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015))", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: "20px 22px 18px", boxShadow: "0 14px 34px rgba(0,0,0,0.28)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, transparent 80%)` }} />
      <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: T.textMuted, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 900, margin: "8px 0 0", letterSpacing: "-0.03em", color, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
        {positivo ? "" : "− "}{currency} {Math.abs(Number(amount || 0)).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p style={{ fontSize: 12, color: T.textMuted, margin: "7px 0 0" }}>A favor de <b style={{ color: T.text }}>{positivo ? "Bautista" : "SOLFIN"}</b></p>
    </div>
  );
}

export function Filtros({ currency, setCurrency, type, setType, from, setFrom, to, setTo, cuenta }) {
  const grupo = { display: "flex", gap: 3, padding: 4, background: "rgba(0,0,0,0.22)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" };
  const btn = (activo, colorActivo) => ({
    padding: "7px 14px", fontSize: 12.5, fontWeight: 800, borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit",
    background: activo ? (colorActivo || T.gold) : "transparent", color: activo ? "#0A1628" : T.textMuted,
  });
  const hayFiltro = from || to || (type && type !== "all") || (currency && currency !== "all");
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <div style={grupo}>
        {[{ k: "all", l: "Todo" }, { k: "ARS", l: "ARS" }, { k: "USD", l: "USD" }].map((o) => (
          <button key={o.k} onClick={() => setCurrency(o.k)} style={btn(currency === o.k)}>{o.l}</button>
        ))}
      </div>
      <div style={grupo}>
        {[{ k: "all", l: "Ambos", c: T.gold }, { k: "ingreso", l: "▲ Ingresos", c: T.green }, { k: "egreso", l: "▼ Egresos", c: T.red }].map((o) => (
          <button key={o.k} onClick={() => setType(o.k)} style={btn(type === o.k, o.c)}>{o.l}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{ width: 150 }}><DatePicker value={from} onChange={(v) => setFrom(v || "")} placeholder="Desde" small /></div>
        <span style={{ color: T.textDim, fontSize: 12 }}>→</span>
        <div style={{ width: 150 }}><DatePicker value={to} onChange={(v) => setTo(v || "")} placeholder="Hasta" small /></div>
        {hayFiltro && (
          <button onClick={() => { setFrom(""); setTo(""); setType("all"); setCurrency("all"); }}
            style={{ padding: "6px 11px", fontSize: 11, fontWeight: 700, borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, cursor: "pointer" }}>✕ Limpiar</button>
        )}
      </div>
      <div style={{ flex: 1 }} />
      {cuenta}
    </div>
  );
}

// Grilla: agrupada por día, con el total acreditado de cada día como en MyBox. El acreditado es lo
// que realmente entró a la cuenta después de la comisión, que es el número que hay que cotejar
// contra el resumen de la financiera.
const COLS = (readOnly) => readOnly
  ? "84px 96px 58px 1fr 152px 110px 128px 138px 124px"
  : "84px 96px 58px 1fr 152px 110px 128px 138px 124px 60px";

export function MovimientosTabla({ rows, readOnly, onEdit, acciones, toolbar, total }) {
  const head = { fontSize: 9.5, fontWeight: 800, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.09em" };
  const [plegados, setPlegados] = useState(() => new Set());
  const toggle = (d) => setPlegados((p) => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });
  const porDia = [];
  for (const m of rows) {
    const d = String(m.date || "").slice(0, 10);
    if (!porDia.length || porDia[porDia.length - 1].dia !== d) porDia.push({ dia: d, movs: [] });
    porDia[porDia.length - 1].movs.push(m);
  }
  return (
    <div style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))", borderRadius: 18, border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", boxShadow: "0 14px 34px rgba(0,0,0,0.25)" }}>
      {(toolbar || total != null) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "16px 18px", borderBottom: `1px solid ${T.border}` }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text }}>Movimientos <span style={{ fontSize: 13, fontWeight: 600, color: T.textDim }}>· {total != null ? total : rows.length}</span></p>
          {toolbar}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: COLS(readOnly), gap: 10, padding: "11px 18px", background: "rgba(8,16,30,0.96)", position: "sticky", top: 0, zIndex: 5, borderBottom: `1px solid ${T.border}`, ...head }}>
        <div>Fecha</div><div>Tipo</div><div>Moneda</div><div>Descripción</div>
        <div style={{ textAlign: "right" }}>Importe</div>
        <div style={{ textAlign: "right" }}>Comisión</div>
        <div style={{ textAlign: "right" }}>Acreditado</div>
        <div style={{ textAlign: "right" }}>Saldo ARS</div>
        <div style={{ textAlign: "right" }}>Saldo USD</div>
        {!readOnly && <div />}
      </div>
      {porDia.map((g) => {
        const acredDia = g.movs.reduce((s, m) => s + (m.type === "ingreso" && m.currency === "ARS" ? Number(m.net_amount || 0) : 0), 0);
        const plegado = plegados.has(g.dia);
        return (
          <div key={g.dia}>
            <div onClick={() => toggle(g.dia)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 18px", background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${T.border}`, cursor: "pointer", userSelect: "none" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 800, color: T.text }}>
                <span style={{ fontSize: 10, color: T.gold, transition: "transform .15s", transform: plegado ? "rotate(-90deg)" : "none" }}>▼</span>
                {fmtDateLarga(g.dia)} <span style={{ fontSize: 11.5, fontWeight: 600, color: T.textDim }}>· {g.movs.length} mov.</span>
              </span>
              {acredDia > 0 && (
                <span style={{ ...head, color: T.textDim }}>
                  Total acreditado <b style={{ color: T.gold, fontSize: 13, fontVariantNumeric: "tabular-nums", marginLeft: 6 }}>{acredDia.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                </span>
              )}
            </div>
            {!plegado && g.movs.map((m) => <Fila key={m.id} m={m} readOnly={readOnly} onEdit={onEdit} acciones={acciones} />)}
          </div>
        );
      })}
    </div>
  );
}

function Fila({ m, readOnly, onEdit, acciones }) {
  const isIn = m.type === "ingreso";
  const color = isIn ? T.green : T.red;
  const esArs = m.currency === "ARS";
  // El acreditado solo tiene sentido en los ingresos: en un egreso no entró nada a la cuenta.
  const acreditado = isIn ? Number(m.net_amount || 0) : null;
  const saldo = (val, activa) => (
    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontSize: activa ? 13 : 11.5, fontWeight: activa ? 700 : 500, color: activa ? (val >= 0 ? T.green : T.red) : T.textDim }}>
      {Number(val || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>
  );
  return (
    <div className="cc-fila" style={{ display: "grid", gridTemplateColumns: COLS(readOnly), gap: 10, padding: "13px 18px", fontSize: 13.5, alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ fontFamily: "ui-monospace,monospace", color: T.text, fontWeight: 600, fontSize: 12 }}>{fmtDate(m.date)}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color, whiteSpace: "nowrap" }}>{isIn ? "▲ Ingreso" : "▼ Egreso"}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: T.textMuted }}>{m.currency}</div>
      <div style={{ color: T.text, overflow: "hidden", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {m.image_url && (
          <a href={m.image_url} target="_blank" rel="noreferrer" title="Ver comprobante" style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 5, overflow: "hidden", border: `1px solid ${T.border}`, background: T.bgSurfaceHi, display: "inline-block" }}>
            <img src={m.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </a>
        )}
        {!m.image_url && carrierDe(m.description) && <LogoCarrier k={carrierDe(m.description)} size={28} />}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.description || <span style={{ color: T.textDim, fontStyle: "italic" }}>(sin descripción)</span>}</span>
      </div>
      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color, fontWeight: 700, whiteSpace: "nowrap" }}>{isIn ? "+ " : "− "}{fmtMoney(m.amount, m.currency)}</div>
      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.textMuted, fontSize: 11.5 }}>
        {m.commission_pct
          ? <>{Number(m.commission_pct).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%<br /><span style={{ fontSize: 10, color: T.amber }}>−{fmtMoney(m.commission_amount, m.currency)}</span></>
          : <span style={{ color: T.textDim }}>—</span>}
      </div>
      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: 700, fontSize: 12.5, color: acreditado != null ? T.text : T.textDim }}>
        {acreditado != null ? acreditado.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
      </div>
      {saldo(m._arsBal, esArs)}
      {saldo(m._usdBal, !esArs)}
      {!readOnly && <div>{acciones ? acciones(m) : null}</div>}
    </div>
  );
}

// Versión celular: la grilla de 9 columnas no entra, así que cada movimiento es una tarjeta con
// los mismos datos apilados.
export function MovimientoTarjeta({ m, readOnly, acciones }) {
  const isIn = m.type === "ingreso";
  const color = isIn ? T.green : T.red;
  const acreditado = isIn ? Number(m.net_amount || 0) : null;
  const linea = (l, v, c) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
      <span style={{ color: T.textDim }}>{l}</span>
      <span style={{ color: c || T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
  return (
    <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 11, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: `${color}22`, color, textTransform: "uppercase" }}>{isIn ? "▲ Ingreso" : "▼ Egreso"}</span>
        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11.5, color: T.textMuted }}>{fmtDate(m.date)}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted }}>{m.currency}</span>
        <div style={{ flex: 1 }} />
        {!readOnly && acciones && acciones(m)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {m.image_url && (
          <a href={m.image_url} target="_blank" rel="noreferrer" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 5, overflow: "hidden", border: `1px solid ${T.border}` }}>
            <img src={m.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </a>
        )}
        {!m.image_url && carrierDe(m.description) && <LogoCarrier k={carrierDe(m.description)} size={30} />}
        <span style={{ fontSize: 13, color: T.text }}>{m.description || <span style={{ color: T.textDim, fontStyle: "italic" }}>(sin descripción)</span>}</span>
      </div>
      <div style={{ height: 1, background: T.border, margin: "2px 0" }} />
      {linea("Importe", `${isIn ? "+ " : "− "}${fmtMoney(m.amount, m.currency)}`, color)}
      {m.commission_pct ? linea(`Comisión ${Number(m.commission_pct).toLocaleString("es-AR")}%`, `−${fmtMoney(m.commission_amount, m.currency)}`, T.amber) : null}
      {acreditado != null && linea("Acreditado", fmtMoney(acreditado, m.currency))}
      {linea("Saldo ARS", Number(m._arsBal || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), m._arsBal >= 0 ? T.green : T.red)}
      {linea("Saldo USD", Number(m._usdBal || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), m._usdBal >= 0 ? T.green : T.red)}
    </div>
  );
}

export function Estadisticas({ stats }) {
  const fmt = (n, cur) => `${cur} ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
      {["ARS", "USD"].map((cur) => {
        const s = stats[cur] || { movs: 0, ingresos: 0, egresos: 0, comision: 0, ingresosBrutos: 0 };
        const neto = s.ingresos - s.egresos;
        const filas = [
          ["Movimientos", String(s.movs), T.text],
          ["Ingresos brutos", fmt(s.ingresosBrutos, cur), T.textMuted],
          ["Comisión de la financiera", `− ${fmt(s.comision, cur)}`, T.amber],
          ["Ingresos acreditados", fmt(s.ingresos, cur), T.green],
          ["Egresos", `− ${fmt(s.egresos, cur)}`, T.red],
        ];
        return (
          <div key={cur} style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 13, padding: "16px 18px" }}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.13em", textTransform: "uppercase", color: T.gold, margin: "0 0 12px" }}>{cur}</p>
            {filas.map(([l, v, c]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 12.5 }}>
                <span style={{ color: T.textDim }}>{l}</span>
                <span style={{ color: c, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 9, paddingTop: 9, borderTop: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>Resultado del período</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: neto >= 0 ? T.green : T.red, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(neto, cur)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
