"use client";
// Logo de DHL / FedEx / UPS con presencia (03/10/2026): pastilla del color de la marca con el
// logo a lo largo (no un cuadradito). El alto lo fija `alto`; el ancho sale de la proporción de
// cada logo, así el de DHL (alargado) no queda finito.
import { CARRIER_LOGOS } from "../../lib/carrier-logos";

// Qué parte del alto ocupa cada logo: DHL es una tira, UPS un escudo.
const ESCALA = { dhl: 0.4, fedex: 0.52, ups: 0.8 };

export default function CarrierLogo({ k, alto = 34, radio }) {
  const L = CARRIER_LOGOS[k];
  if (!L) return null;
  const [, , w, h] = String(L.vb).split(" ").map(Number);
  const hh = alto * (ESCALA[k] || 0.6);
  const ww = h > 0 ? hh * (w / h) : hh;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: alto, minWidth: Math.max(ww + alto * 0.7, alto), padding: `0 ${Math.round(alto * 0.32)}px`, borderRadius: radio ?? Math.round(alto / 4), background: L.bg, boxSizing: "border-box", flexShrink: 0 }}>
      <svg viewBox={L.vb} style={{ height: hh, width: ww, display: "block" }} preserveAspectRatio="xMidYMid meet"><path d={L.d} fill={L.fill} /></svg>
    </span>
  );
}

// Servicios que cotiza el agente: logo + divisor del volumétrico.
export const SERVICIOS_AGENTE = [
  { k: "DHL", logo: "dhl", div: null, nombre: "DHL" },
  { k: "FEDEX_5000", logo: "fedex", div: 5000, nombre: "FedEx" },
  { k: "FEDEX_6000", logo: "fedex", div: 6000, nombre: "FedEx" },
  { k: "UPS_5000", logo: "ups", div: 5000, nombre: "UPS" },
  { k: "UPS_6000", logo: "ups", div: 6000, nombre: "UPS" },
];
