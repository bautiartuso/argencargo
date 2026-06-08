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

export default function SharePage({ params }) {
  const [state, setState] = useState({ loading: true, error: null, movements: [], share: null });
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));

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

  const monthMovs = useMemo(() => enriched.withRunning.filter((m) => m.date.startsWith(filterMonth)), [enriched, filterMonth]);
  const filtered = useMemo(() => filterCurrency === "all" ? monthMovs : monthMovs.filter((m) => m.currency === filterCurrency), [monthMovs, filterCurrency]);
  const commissionMonth = useMemo(() => monthMovs.filter((m) => m.type === "ingreso" && m.currency === "ARS").reduce((s, m) => s + Number(m.commission_amount || 0), 0), [monthMovs]);
  const monthsList = useMemo(() => {
    const set = new Set(state.movements.map((m) => m.date.slice(0, 7)));
    set.add(new Date().toISOString().slice(0, 7));
    return [...set].sort().reverse();
  }, [state.movements]);

  if (state.loading) return <CenterMsg color={T.textMuted}>Cargando…</CenterMsg>;
  if (state.error) return <CenterMsg color={T.red}>⛔ {state.error}</CenterMsg>;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <header style={{ background: T.bgSurface, borderBottom: `1px solid ${T.border}`, padding: "14px 22px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: T.gold, letterSpacing: "-0.01em" }}>CC Financiera SOLFIN</h1>
            <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0" }}>Solo lectura · {state.share?.label || "Compartido"}</p>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 4, background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>👁 Vista lectura</span>
        </div>
      </header>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 22px 40px" }}>
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <BalanceCard label="Saldo ARS" currency="ARS" amount={enriched.totals.ars} />
          <BalanceCard label="Saldo USD" currency="USD" amount={enriched.totals.usd} />
        </section>
        {commissionMonth > 0 && (
          <div style={{ padding: "12px 16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, marginBottom: 16, fontSize: 13, color: T.amber }}>
            💸 Comisión SOLFIN acumulada este mes: <strong>{fmtMoney(commissionMonth, "ARS")}</strong>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, padding: 3, background: T.bgSurface, borderRadius: 8, border: `1px solid ${T.border}` }}>
            {[{ k: "all", l: "Todo" }, { k: "ARS", l: "ARS" }, { k: "USD", l: "USD" }].map((o) => (
              <button key={o.k} onClick={() => setFilterCurrency(o.k)} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "none", background: filterCurrency === o.k ? "linear-gradient(135deg, #B8956A, #E8D098, #B8956A)" : "transparent", color: filterCurrency === o.k ? T.bg : T.textMuted, cursor: "pointer" }}>{o.l}</button>
            ))}
          </div>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ padding: "8px 12px", fontSize: 13, borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgSurface, color: T.text, cursor: "pointer", outline: "none", fontFamily: "inherit" }}>
            {monthsList.map((m) => <option key={m} value={m}>{new Date(m + "-15").toLocaleDateString("es-AR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase())}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <p style={{ fontSize: 11, color: T.textDim, margin: 0 }}>{filtered.length} movimiento{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", background: T.bgSurface, border: `1px dashed ${T.border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>Sin movimientos en este período</p>
          </div>
        ) : (
          <div style={{ background: T.bgSurface, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "90px 90px 70px 1fr 120px 110px 140px", gap: 10, padding: "10px 14px", background: "rgba(0,0,0,0.2)", fontSize: 9.5, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${T.border}` }}>
              <div>Fecha</div><div>Tipo</div><div>Mon.</div><div>Descripción</div><div style={{ textAlign: "right" }}>Importe</div><div style={{ textAlign: "right" }}>Comisión</div><div style={{ textAlign: "right" }}>Saldo</div>
            </div>
            {filtered.map((m) => {
              const isIn = m.type === "ingreso";
              const color = isIn ? T.green : T.red;
              const running = m.currency === "ARS" ? m._arsBal : m._usdBal;
              return (
                <div key={m.id} style={{ display: "grid", gridTemplateColumns: "90px 90px 70px 1fr 120px 110px 140px", gap: 10, padding: "12px 14px", fontSize: 13, alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: "ui-monospace, monospace", color: T.text, fontWeight: 600 }}>{fmtDate(m.date)}</div>
                  <div><span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: `${color}22`, color, letterSpacing: "0.05em", textTransform: "uppercase" }}>{isIn ? "▲ Ingreso" : "▼ Egreso"}</span></div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted }}>{m.currency}</div>
                  <div style={{ color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.description || <span style={{ color: T.textDim, fontStyle: "italic" }}>(sin descripción)</span>}</div>
                  <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color, fontWeight: 600 }}>{isIn ? "+" : "−"} {fmtMoney(m.amount, m.currency)}</div>
                  <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.textMuted, fontSize: 11.5 }}>
                    {m.commission_pct ? <>{Number(m.commission_pct).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%<br /><span style={{ fontSize: 10, color: T.amber }}>−{fmtMoney(m.commission_amount, m.currency)}</span></> : <span style={{ color: T.textDim }}>—</span>}
                  </div>
                  <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: running >= 0 ? T.green : T.red, fontWeight: 700, fontSize: 12 }}>{fmtMoney(running, m.currency)}</div>
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
  const color = positive ? T.green : T.red;
  return (
    <div style={{ padding: "18px 20px", background: `linear-gradient(135deg, ${color}1A, ${color}06)`, border: `1px solid ${color}55`, borderRadius: 14, boxShadow: `0 0 30px ${color}10` }}>
      <p style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmtMoney(Math.abs(amount), currency)}</p>
      <p style={{ fontSize: 11, color: T.textMuted, margin: "4px 0 0" }}>{positive ? "a favor en SOLFIN" : "debés a SOLFIN"}</p>
    </div>
  );
}

function CenterMsg({ children, color }) {
  return <div style={{ minHeight: "100vh", background: T.bg, color: color || T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14, padding: 20 }}>{children}</div>;
}
