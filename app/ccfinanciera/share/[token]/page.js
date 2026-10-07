"use client";
import { useState, useEffect, useMemo } from "react";
import {
  T, useIsMobile, enrichMovements, aplicarFiltros, calcStats,
  BalanceCard, Filtros, MovimientosTabla, MovimientoTarjeta, Estadisticas,
} from "../../../../lib/cc-ui";

// Página pública read-only para SOLFIN. Acceso vía /ccfinanciera/share/[token].
// El token se valida server-side en /api/ccfinanciera/share/[token].
//
// Es la MISMA vista que el panel del admin (mismas columnas, mismos filtros, mismas estadísticas):
// todo sale de lib/cc-ui. Lo único que cambia es que acá no se puede agregar ni editar.

export default function SharePage({ params }) {
  const [state, setState] = useState({ loading: true, error: null, movements: [], share: null });
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterClase, setFilterClase] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState("movs");

  useEffect(() => {
    fetch(`/api/ccfinanciera/share/${encodeURIComponent(params.token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setState({ loading: false, error: d.error || "Error", movements: [], share: null });
        else setState({ loading: false, error: null, movements: d.movements || [], share: d.share });
      })
      .catch((e) => setState({ loading: false, error: e.message, movements: [], share: null }));
  }, [params.token]);

  const enriched = useMemo(() => enrichMovements(state.movements), [state.movements]);
  const filtered = useMemo(
    () => aplicarFiltros(enriched.withRunning, { currency: filterCurrency, type: filterType, from, to, clase: filterClase }),
    [enriched, filterCurrency, filterType, from, to, filterClase]
  );
  const stats = useMemo(() => calcStats(filtered), [filtered]);
  const isMobile = useIsMobile();

  if (state.loading) return <CenterMsg color={T.textMuted}>Cargando…</CenterMsg>;
  if (state.error) return <CenterMsg color={T.red}>⛔ {state.error}</CenterMsg>;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <header style={{ background: "linear-gradient(180deg, #10203C 0%, #0C1830 100%)", borderBottom: "1px solid rgba(184,149,106,0.22)", boxShadow: "0 1px 0 rgba(232,208,152,0.06), 0 10px 30px rgba(0,0,0,0.35)", padding: "16px 22px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -90, left: -60, width: 320, height: 200, background: "radial-gradient(ellipse, rgba(184,149,106,0.16), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <img src="https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png" alt="Argencargo" style={{ height: 32, width: "auto" }} />
            <span style={{ width: 1, height: 36, background: "rgba(255,255,255,0.15)" }} />
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.02em", color: "#fff" }}>CC Financiera</h1>
              <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 700, color: "rgba(232,208,152,0.75)", letterSpacing: "0.12em" }}>SOLFIN</span>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "inline-block" }} />
                Solo lectura · {state.share?.label || "Compartido"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href={`/api/ccfinanciera/share/${encodeURIComponent(params.token)}/xlsx`} download
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, padding: "8px 14px", borderRadius: 8, background: "linear-gradient(135deg, #B8956A, #E8D098)", color: T.bg, textDecoration: "none", letterSpacing: "0.02em" }}>
              📥 Descargar Excel
            </a>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "5px 12px", borderRadius: 999, background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>👁 Vista lectura</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1320, margin: "0 auto", padding: isMobile ? "16px 14px 40px" : "20px 22px 40px" }}>
        <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 10 : 16, marginBottom: 16 }}>
          <BalanceCard label="Saldo en pesos (ARS)" currency="ARS" amount={enriched.totals.ars} />
          <BalanceCard label="Saldo en dólares (USD)" currency="USD" amount={enriched.totals.usd} />
        </section>

        <div style={{ display: "flex", gap: 3, padding: 4, background: "rgba(0,0,0,0.22)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 14, width: "fit-content" }}>
          {[{ k: "movs", l: "Movimientos" }, { k: "stats", l: "Estadísticas" }].map((o) => (
            <button key={o.k} onClick={() => setTab(o.k)} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 800, borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", background: tab === o.k ? T.goldGrad : "transparent", color: tab === o.k ? "#0A1628" : T.textMuted }}>{o.l}</button>
          ))}
        </div>

        {(() => {
          const filtros = <Filtros currency={filterCurrency} setCurrency={setFilterCurrency} type={filterType} setType={setFilterType} clase={filterClase} setClase={setFilterClase} from={from} setFrom={setFrom} to={to} setTo={setTo} />;
          const vacio = <p style={{ fontSize: 14, color: T.textMuted, textAlign: "center", padding: "40px 0" }}>Sin movimientos con estos filtros</p>;
          if (tab === "stats") return <Estadisticas stats={stats} />;
          if (isMobile) return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><div style={{ marginBottom: 4 }}>{filtros}</div>{filtered.length === 0 ? vacio : filtered.map((m) => <MovimientoTarjeta key={m.id} m={m} readOnly />)}</div>;
          return <div style={{ overflowX: "auto" }}><MovimientosTabla rows={filtered} readOnly total={filtered.length} toolbar={filtros} />{filtered.length === 0 && vacio}</div>;
        })()}
      </main>
    </div>
  );
}

function CenterMsg({ children, color }) {
  return <div style={{ minHeight: "100vh", background: T.bg, color: color || T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14, padding: 20 }}>{children}</div>;
}
