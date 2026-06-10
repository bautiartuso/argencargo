"use client";
import { useState, useEffect, useMemo } from "react";

// Página pública read-only para SOLFIN. Acceso vía /ccfinanciera/share/[token].
// El token se valida server-side en /api/ccfinanciera/share/[token].

const T = {
  bg: "#0A1628",
  bgSurface: "#142038",
  bgSurfaceHi: "#1A2A48",
  border: "rgba(255,255,255,0.08)",
  text: "#fff",
  textMuted: "rgba(255,255,255,0.55)",
  textDim: "rgba(255,255,255,0.4)",
  gold: "#E8D098",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
};

const fmtMoney = (n, currency = "ARS") => {
  const v = Number(n || 0);
  return `${currency} ${v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtDate = (d) => {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  return `${day}/${m}/${y.slice(2)}`;
};

function useIsMobile(breakpoint = 720) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const check = () => setM(typeof window !== "undefined" && window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return m;
}

export default function SharePage({ params }) {
  const [state, setState] = useState({ loading: true, error: null, movements: [], share: null });
  const [filterCurrency, setFilterCurrency] = useState("all");

  useEffect(() => {
    fetch(`/api/ccfinanciera/share/${encodeURIComponent(params.token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setState({ loading: false, error: d.error || "Error", movements: [], share: null });
        else setState({ loading: false, error: null, movements: d.movements || [], share: d.share });
      })
      .catch((e) => setState({ loading: false, error: e.message, movements: [], share: null }));
  }, [params.token]);

  // Saldo running por moneda (igual lógica que el admin)
  const enriched = useMemo(() => {
    const asc = [...state.movements].sort((a, b) => (a.date.localeCompare(b.date)) || ((a.created_at || "").localeCompare(b.created_at || "")));
    let arsBal = 0, usdBal = 0;
    const withRunning = asc.map((m) => {
      const net = Number(m.net_amount || 0);
      const signed = m.type === "ingreso" ? net : -net;
      if (m.currency === "ARS") arsBal += signed; else usdBal += signed;
      return { ...m, _arsBal: arsBal, _usdBal: usdBal };
    });
    return { withRunning: withRunning.reverse(), totals: { ars: arsBal, usd: usdBal } };
  }, [state.movements]);

  const filtered = useMemo(() => filterCurrency === "all" ? enriched.withRunning : enriched.withRunning.filter((m) => m.currency === filterCurrency), [enriched, filterCurrency]);
  const isMobile = useIsMobile();

  if (state.loading) return <CenterMsg color={T.textMuted}>Cargando…</CenterMsg>;
  if (state.error) return <CenterMsg color={T.red}>⛔ {state.error}</CenterMsg>;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <header style={{ background: "linear-gradient(180deg, #10203C 0%, #0C1830 100%)", borderBottom: "1px solid rgba(184,149,106,0.22)", boxShadow: "0 1px 0 rgba(232,208,152,0.06), 0 10px 30px rgba(0,0,0,0.35)", padding: "16px 22px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -90, left: -60, width: 320, height: 200, background: "radial-gradient(ellipse, rgba(184,149,106,0.16), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, background: "linear-gradient(135deg, rgba(184,149,106,0.22), rgba(184,149,106,0.06))", border: "1px solid rgba(232,208,152,0.35)", boxShadow: "0 0 18px rgba(184,149,106,0.18), inset 0 1px 0 rgba(255,255,255,0.08)" }}>🏦</div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", background: "linear-gradient(135deg, #E8D098 20%, #B8956A 60%, #E8D098 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>CC Financiera</h1>
              <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 700, color: "rgba(232,208,152,0.75)", letterSpacing: "0.12em" }}>SOLFIN</span>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "inline-block" }} />
                Solo lectura · {state.share?.label || "Compartido"}
              </p>
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "5px 12px", borderRadius: 999, background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>👁 Vista lectura</span>
        </div>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "16px 14px 40px" : "20px 22px 40px" }}>
        <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 10 : 16, marginBottom: 16 }}>
          <BalanceCard label="Saldo ARS" currency="ARS" amount={enriched.totals.ars} />
          <BalanceCard label="Saldo USD" currency="USD" amount={enriched.totals.usd} />
        </section>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, padding: 3, background: T.bgSurface, borderRadius: 8, border: `1px solid ${T.border}` }}>
            {[{ k: "all", l: "Todo" }, { k: "ARS", l: "ARS" }, { k: "USD", l: "USD" }].map((o) => (
              <button key={o.k} onClick={() => setFilterCurrency(o.k)} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "none", background: filterCurrency === o.k ? "linear-gradient(135deg, #B8956A, #E8D098, #B8956A)" : "transparent", color: filterCurrency === o.k ? T.bg : T.textMuted, cursor: "pointer" }}>{o.l}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <p style={{ fontSize: 11, color: T.textDim, margin: 0 }}>{filtered.length} movimiento{filtered.length !== 1 ? "s" : ""} {filterCurrency !== "all" ? `(${filterCurrency})` : "totales"}</p>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", background: T.bgSurface, border: `1px dashed ${T.border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>Sin movimientos en este período</p>
          </div>
        ) : isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((m) => <ShareMovementCardMobile key={m.id} m={m} />)}
          </div>
        ) : (
          <div style={{ background: T.bgSurface, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "90px 90px 60px 1fr 170px 110px 170px", gap: 10, padding: "10px 14px", background: "rgba(0,0,0,0.2)", fontSize: 9.5, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${T.border}` }}>
              <div>Fecha</div><div>Tipo</div><div>Mon.</div><div>Descripción</div><div style={{ textAlign: "right" }}>Importe</div><div style={{ textAlign: "right" }}>Comisión</div><div style={{ textAlign: "right" }}>Saldo</div>
            </div>
            {filtered.map((m) => {
              const isIn = m.type === "ingreso";
              const color = isIn ? T.green : T.red;
              const running = m.currency === "ARS" ? m._arsBal : m._usdBal;
              return (
                <div key={m.id} style={{ display: "grid", gridTemplateColumns: "90px 90px 60px 1fr 170px 110px 170px", gap: 10, padding: "12px 14px", fontSize: 13, alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: "ui-monospace, monospace", color: T.text, fontWeight: 600 }}>{fmtDate(m.date)}</div>
                  <div><span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: `${color}22`, color, letterSpacing: "0.05em", textTransform: "uppercase" }}>{isIn ? "▲ Ingreso" : "▼ Egreso"}</span></div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted }}>{m.currency}</div>
                  <div style={{ color: T.text, overflow: "hidden", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {m.image_url && (
                      <a href={m.image_url} target="_blank" rel="noreferrer" title="Ver comprobante" style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 5, overflow: "hidden", border: `1px solid ${T.border}`, background: T.bgSurfaceHi, display: "inline-block" }}>
                        <img src={m.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </a>
                    )}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.description || <span style={{ color: T.textDim, fontStyle: "italic" }}>(sin descripción)</span>}</span>
                  </div>
                  <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>{isIn ? "+ " : "− "}{fmtMoney(m.amount, m.currency)}</div>
                  <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.textMuted, fontSize: 11.5 }}>
                    {m.commission_pct ? <>{Number(m.commission_pct).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%<br /><span style={{ fontSize: 10, color: T.amber }}>−{fmtMoney(m.commission_amount, m.currency)}</span></> : <span style={{ color: T.textDim }}>—</span>}
                  </div>
                  <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: running >= 0 ? T.green : T.red, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>{fmtMoney(running, m.currency)}</div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function BalanceCard({ label, currency, amount }) {
  const positive = amount >= 0;
  const color = currency === "USD" ? T.green : T.gold;
  const isMobile = useIsMobile();
  return (
    <div style={{ padding: "16px 18px", background: `linear-gradient(135deg, ${color}1A, ${color}06)`, border: `1px solid ${color}55`, borderRadius: 14, boxShadow: `0 0 30px ${color}10`, minWidth: 0, overflow: "hidden" }}>
      <p style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.16em", textTransform: "uppercase", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: T.text, margin: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{positive ? "" : "− "}{fmtMoney(Math.abs(amount), currency)}</p>
      <p style={{ fontSize: 11, color: T.textMuted, margin: "4px 0 0" }}>{positive ? "a favor para Bautista" : "a favor para SOLFIN"}</p>
    </div>
  );
}

function ShareMovementCardMobile({ m }) {
  const isIn = m.type === "ingreso";
  const color = isIn ? T.green : T.red;
  const running = m.currency === "ARS" ? m._arsBal : m._usdBal;
  return (
    <div style={{ padding: "12px 14px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: `${color}22`, color, letterSpacing: "0.05em", textTransform: "uppercase" }}>{isIn ? "▲ Ingreso" : "▼ Egreso"}</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: T.textMuted, letterSpacing: "0.05em" }}>{m.currency}</span>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: T.textMuted }}>{fmtDate(m.date)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, minWidth: 0 }}>
        {m.image_url && (
          <a href={m.image_url} target="_blank" rel="noreferrer" title="Ver comprobante" style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 5, overflow: "hidden", border: `1px solid ${T.border}`, background: T.bgSurfaceHi, display: "inline-block" }}>
            <img src={m.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </a>
        )}
        <span style={{ flex: 1, fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.description || <span style={{ color: T.textDim, fontStyle: "italic" }}>(sin descripción)</span>}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 2px" }}>Importe</p>
          <p style={{ fontSize: 14, fontWeight: 700, color, margin: 0, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{isIn ? "+ " : "− "}{fmtMoney(m.amount, m.currency)}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 2px" }}>Saldo</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: running >= 0 ? T.green : T.red, margin: 0, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fmtMoney(running, m.currency)}</p>
        </div>
        {m.commission_pct ? (
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.amber, marginTop: 2 }}>
            <span>Comisión {Number(m.commission_pct).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
            <span>− {fmtMoney(m.commission_amount, m.currency)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CenterMsg({ children, color }) {
  return <div style={{ minHeight: "100vh", background: T.bg, color: color || T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14, padding: 20 }}>{children}</div>;
}
