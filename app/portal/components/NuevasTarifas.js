"use client";
// Aviso de nuevas tarifas aéreas (temporada alta + recargo por combustible, vigentes desde el
// 25/09/2026). Las primeras TRES veces que el cliente entra al portal aparece como ventana; además
// queda un banner arriba de Importaciones hasta el 10/10/2026. Las ops abiertas y en tránsito
// mantienen la tarifa anterior.
import { useEffect, useState } from "react";

const HASTA = Date.parse("2026-10-10T23:59:59-03:00");
const KEY = "ac_aviso_tarifas_2026_09";
const GOLD = "#B8956A", GOLD_LIGHT = "#E8D098";

function Tabla({ t, isRI }) {
  // RI: dos tramos (10-25 · +25). Monotributo / consumidor final: tres (10-25 · 25-100 · +100).
  const filas = isRI
    ? [[t("tarifas26.tier1"), "USD 16 / kg"], [t("tarifas26.tier2ri"), "USD 15 / kg"]]
    : [[t("tarifas26.tier1"), "USD 16 / kg"], [t("tarifas26.tier2"), "USD 15 / kg"], [t("tarifas26.tier3"), "USD 14 / kg"]];
  return <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, overflow: "hidden" }}>
    {filas.map(([l, v], i) => <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "11px 16px", borderTop: i ? "1px solid rgba(255,255,255,0.06)" : "none", fontSize: 14 }}>
      <span style={{ color: "rgba(255,255,255,0.7)" }}>{l}</span><strong style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>{v}</strong>
    </div>)}
  </div>;
}

export default function NuevasTarifas({ t, client, onVerTarifas, soloBanner }) {
  const [abierto, setAbierto] = useState(false);
  const vigente = Date.now() <= HASTA;
  const isRI = client?.tax_condition === "responsable_inscripto";
  useEffect(() => {
    if (!vigente || soloBanner) return;
    // Se muestra en las primeras 3 entradas al portal (contador por dispositivo).
    try {
      const vistas = Number(localStorage.getItem(KEY) || 0);
      if (vistas < 3) { localStorage.setItem(KEY, String(vistas + 1)); setAbierto(true); }
    } catch { setAbierto(true); }
  }, [vigente, soloBanner]);
  if (!vigente) return null;
  const cerrar = () => setAbierto(false);

  if (soloBanner) return <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", marginBottom: 16, borderRadius: 12, background: "linear-gradient(135deg,rgba(184,149,106,0.16),rgba(184,149,106,0.04))", border: "1px solid rgba(184,149,106,0.45)" }}>
    <span style={{ fontSize: 18 }}>✈️</span>
    <div style={{ flex: 1, minWidth: 220 }}>
      <p style={{ fontSize: 13.5, fontWeight: 700, color: GOLD_LIGHT, margin: 0 }}>{t("tarifas26.bannerTitle")}</p>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", margin: "2px 0 0" }}>{t("tarifas26.bannerSub")}</p>
    </div>
    <button onClick={onVerTarifas} style={{ padding: "8px 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: `1px solid ${GOLD}`, background: "transparent", color: GOLD_LIGHT, cursor: "pointer", fontFamily: "inherit" }}>{t("tarifas26.seeRates")} →</button>
  </div>;

  if (!abierto) return null;
  return <div onClick={cerrar} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(3,8,18,0.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", background: "linear-gradient(180deg,#142038,#0F1A2D)", border: "1px solid rgba(184,149,106,0.45)", borderRadius: 18, padding: "24px 22px", boxShadow: "0 24px 70px rgba(0,0,0,0.6)", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${GOLD},${GOLD_LIGHT},${GOLD})`, borderRadius: "18px 18px 0 0" }} />
      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD_LIGHT, margin: "0 0 8px" }}>{t("tarifas26.kicker")}</p>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 10px", letterSpacing: "-0.02em" }}>{t("tarifas26.title")}</h2>
      <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.7)", margin: "0 0 18px", lineHeight: 1.55 }}>{t("tarifas26.intro")}</p>
      <Tabla t={t} isRI={isRI} />
      <ul style={{ margin: "16px 0 0", paddingLeft: 18, color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.7 }}>
        <li>{t("tarifas26.min")}</li>
        <li>{t("tarifas26.batt")}</li>
        <li><strong style={{ color: "#fff" }}>{t("tarifas26.keep")}</strong></li>
      </ul>
      <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
        <button onClick={cerrar} style={{ flex: 1, minWidth: 140, padding: "12px 16px", fontSize: 14, fontWeight: 800, borderRadius: 10, border: "none", background: `linear-gradient(135deg,${GOLD},${GOLD_LIGHT},${GOLD})`, color: "#0A1628", cursor: "pointer", fontFamily: "inherit" }}>{t("tarifas26.ok")}</button>
        <button onClick={() => { cerrar(); onVerTarifas?.(); }} style={{ padding: "12px 16px", fontSize: 13.5, fontWeight: 700, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>{t("tarifas26.seeRates")}</button>
      </div>
    </div>
  </div>;
}
