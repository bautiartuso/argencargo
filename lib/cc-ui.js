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
// Miniatura del comprobante. Los PDF (los manda el bot o se adjuntan en el cobro) y las fotos que
// el navegador no puede mostrar (HEIC del iPhone) salían como imagen rota: ahora un PDF tiene su
// ícono y cualquier imagen que no carga cae a un clip. Siempre abre el archivo.
export function Comprobante({ url, size = 28 }) {
  const [rota, setRota] = useState(false);
  const esPdf = /\.pdf($|\?)/i.test(String(url || ""));
  const box = { flexShrink: 0, width: size, height: size, borderRadius: 5, overflow: "hidden", border: `1px solid ${T.border}`, background: T.bgSurfaceHi, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" };
  return <a href={url} target="_blank" rel="noreferrer" title="Ver comprobante" style={box}>
    {esPdf ? <span style={{ fontSize: Math.round(size * 0.32), fontWeight: 900, color: "#fff", background: "#dc2626", borderRadius: 3, padding: "2px 3px", letterSpacing: "0.02em", lineHeight: 1 }}>PDF</span>
      : rota ? <span style={{ fontSize: Math.round(size * 0.5) }}>📎</span>
      : <img src={url} alt="" onError={() => setRota(true)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
  </a>;
}

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

// Clase de movimiento según su descripción (los botones la escriben siempre igual, 07/10/2026):
// "Cable China…", "Transferencia a DHL/FedEx/UPS…" y "💱 Dolarización…".
// Pases entre la CC de Argencargo y la de MyBox (09/10/2026). Se leen "De CC MyBox" / "A CC MyBox"
// y también los primeros que quedaron como "🔁 Traído de MyBox" / "🔁 Pase a MyBox".
const RX_PUENTE = /^(?:🔁\s*)?(?:de cc mybox|a cc mybox|traído de mybox|traido de mybox|pase a mybox)\b/i;
const esPuente = (d) => RX_PUENTE.test(String(d || "").trim());
// Texto que se muestra en el libro: en los pases, "De CC MyBox" o "A CC MyBox" (+ la nota).
export function textoMov(m) {
  const d = String(m?.description || "").trim();
  if (!esPuente(d)) return m?.description;
  const nota = d.replace(RX_PUENTE, "").trim();
  return `${m.type === "ingreso" ? "De CC MyBox" : "A CC MyBox"}${nota ? ` ${nota}` : ""}`;
}

export function claseMovimiento(m) {
  const d = String(m?.description || "");
  if (/cable\s*china/i.test(d)) return "cable";
  if (/dolarizaci/i.test(d)) return "dolar";
  if (/\b(dhl|fedex|ups)\b/i.test(d)) return "courier";
  if (esPuente(d)) return "puente";
  return "otros";
}

export function aplicarFiltros(rows, { currency, type, from, to, clase }) {
  return rows.filter((m) => {
    if (clase && clase !== "all" && claseMovimiento(m) !== clase) return false;
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

// Ícono de Dolarizar (09/10/2026): pesos que pasan a dólares, en verde.
export function IconoDolarizar({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="11" fill="rgba(34,197,94,0.18)" stroke="#4ade80" strokeWidth="1.4" />
      <path d="M12 5.5v13M15 8.2c-.6-.8-1.7-1.3-3-1.3-1.8 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.3-3.1 2.3-1.4 0-2.6-.6-3.2-1.5" stroke="#4ade80" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
// Logo de MyBox: el mismo ícono de la app de MyBox (cubo lima sobre petróleo, ~/mybox/app/icon.svg).
export function LogoMyBox({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <rect width="64" height="64" rx="14" fill="#0F3D4C" />
      <g fill="none" stroke="#8BEA3A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 13 L49 22.5 V41.5 L32 51 L15 41.5 V22.5 Z" />
        <path d="M15 22.5 L32 32 L49 22.5" />
        <path d="M32 32 V51" />
      </g>
    </svg>
  );
}

// Filtros (09/10/2026): una sola fila de chips que se prenden y se apagan. Prendido filtra por
// eso; apagado (o sin ninguno del grupo) muestra todo. Uno por grupo: moneda, sentido y clase.
export function Filtros({ currency, setCurrency, type, setType, from, setFrom, to, setTo, cuenta, clase, setClase }) {
  // Cada chip con su color (como los botones de arriba): apagado se ve suave, prendido se enciende.
  const chip = (activo, color) => ({
    height: 34, padding: "0 12px", fontSize: 12.5, fontWeight: 800, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    display: "inline-flex", alignItems: "center", gap: 7,
    border: `1px solid ${color}${activo ? "" : "55"}`,
    background: activo ? `${color}33` : `${color}12`,
    color: activo ? "#fff" : color,
    boxShadow: activo ? `0 0 0 1px ${color}, 0 0 16px ${color}40` : "none",
    transition: "background 150ms, box-shadow 150ms, color 150ms",
  });
  const sep = <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />;
  const toggle = (actual, set, k) => set(actual === k ? "all" : k);
  const hayFiltro = from || to || (type && type !== "all") || (currency && currency !== "all") || (clase && clase !== "all");
  const logosCourier = <span style={{ display: "inline-flex", gap: 2 }}>{["dhl", "fedex", "ups"].map((k) => <LogoCarrier key={k} k={k} size={15} />)}</span>;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {[{ k: "ARS", l: "ARS", c: T.gold }, { k: "USD", l: "USD", c: T.green }].map((o) => (
        <button key={o.k} onClick={() => toggle(currency, setCurrency, o.k)} style={chip(currency === o.k, o.c)}>{o.l}</button>
      ))}
      {sep}
      {[{ k: "ingreso", l: "▲ Ingresos", c: T.green }, { k: "egreso", l: "▼ Egresos", c: T.red }].map((o) => (
        <button key={o.k} onClick={() => toggle(type, setType, o.k)} style={chip(type === o.k, o.c)}>{o.l}</button>
      ))}
      {setClase && <>
        {sep}
        <button onClick={() => toggle(clase || "all", setClase, "cable")} style={chip(clase === "cable", T.blue)}>🌏 Cables</button>
        <button onClick={() => toggle(clase || "all", setClase, "courier")} style={chip(clase === "courier", T.gold)}>{logosCourier}Couriers</button>
        <button onClick={() => toggle(clase || "all", setClase, "dolar")} style={chip(clase === "dolar", T.green)}><IconoDolarizar size={16} />Dolarizaciones</button>
        <button onClick={() => toggle(clase || "all", setClase, "puente")} style={chip(clase === "puente", "#D3F462")}><LogoMyBox size={16} />MyBox</button>
      </>}
      {sep}
      <div style={{ width: 132 }}><DatePicker value={from} onChange={(v) => setFrom(v || "")} placeholder="Desde" small /></div>
      <span style={{ color: T.textDim, fontSize: 12 }}>→</span>
      <div style={{ width: 132 }}><DatePicker value={to} onChange={(v) => setTo(v || "")} placeholder="Hasta" small /></div>
      {hayFiltro && (
        <button onClick={() => { setFrom(""); setTo(""); setType("all"); setCurrency("all"); setClase && setClase("all"); }}
          style={{ height: 34, padding: "0 11px", fontSize: 11.5, fontWeight: 700, borderRadius: 10, border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>✕ Limpiar</button>
      )}
      {cuenta && <><div style={{ flex: 1 }} />{cuenta}</>}
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
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}` }}>
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
        {m.image_url && <Comprobante url={m.image_url} size={28} />}
        {!m.image_url && carrierDe(m.description) && <LogoCarrier k={carrierDe(m.description)} size={28} />}
        {!m.image_url && claseMovimiento(m) === "puente" && <LogoMyBox size={28} />}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{textoMov(m) || <span style={{ color: T.textDim, fontStyle: "italic" }}>(sin descripción)</span>}</span>
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
        {m.image_url && <Comprobante url={m.image_url} size={30} />}
        {!m.image_url && carrierDe(m.description) && <LogoCarrier k={carrierDe(m.description)} size={30} />}
        {!m.image_url && claseMovimiento(m) === "puente" && <LogoMyBox size={30} />}
        <span style={{ fontSize: 13, color: T.text }}>{textoMov(m) || <span style={{ color: T.textDim, fontStyle: "italic" }}>(sin descripción)</span>}</span>
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
