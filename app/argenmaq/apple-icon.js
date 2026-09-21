// Ícono para "Agregar a pantalla de inicio" en iOS, que no toma SVG.
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFD200", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 124, fontWeight: 800, color: "#15171A", letterSpacing: "-0.06em", display: "flex", marginTop: -6 }}>M</div>
      </div>
    ),
    { ...size }
  );
}
