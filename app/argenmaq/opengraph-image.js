// Imagen que se ve al compartir ARGENMAQ (WhatsApp, Instagram, Google).
// Antes se compartía con la OG de Argencargo: otro logo, otro texto, otra empresa.
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ARGENMAQ — Maquinaria de China, puesta en tu puerta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 108, fontWeight: 800, letterSpacing: "-0.05em", color: "#15171A" }}>
          <span>ARGEN</span>
          <span style={{ background: "#FFD200", padding: "0 20px", borderRadius: 16, marginLeft: 6 }}>MAQ</span>
        </div>
        <div style={{ marginTop: 34, fontSize: 40, color: "#5B6066", textAlign: "center", maxWidth: 900, display: "flex" }}>
          Maquinaria de China, puesta en tu puerta
        </div>
        <div style={{ marginTop: 40, fontSize: 24, color: "#9DA3A9", letterSpacing: "0.18em", display: "flex" }}>
          UNA EMPRESA DEL GRUPO ARGENCARGO
        </div>
      </div>
    ),
    { ...size }
  );
}
