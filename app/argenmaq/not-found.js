// 404 de ARGENMAQ. El middleware manda acá cualquier ruta desconocida del host de ARGENMAQ, así no
// cae en la 404 de Argencargo (otra marca, otros links). Va dentro del marco del sitio (isla y
// pie), como la de B2Box: el visitante sigue adentro de la tienda (22/09/2026).
import { Proveedor, Marco, Logo, BotonRecargar } from "./kit";

export const metadata = {
  title: { absolute: "Página no encontrada — ARGENMAQ" },
  robots: { index: false, follow: true },
};

export default function NotFoundArgenmaq() {
  return <Proveedor><Marco actual="404">
    <div className="wrap" style={{ padding: "40px 24px 80px" }}>
      <div style={{ position: "relative", overflow: "hidden", border: "1px solid var(--borde)", borderRadius: 26, background: "var(--card)", padding: "clamp(28px,5vw,64px) clamp(22px,5vw,64px)", boxShadow: "var(--sombra)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: "var(--y)" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 640 }}>
          <Logo alto={30} />
          <p style={{ margin: "34px 0 12px", fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--gris)" }}>Página no encontrada</p>
          <h1 style={{ margin: "0 0 16px", fontSize: "clamp(34px,6vw,60px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>No encontramos<br />lo que buscabas</h1>
          <p style={{ margin: "0 0 28px", fontSize: 17, lineHeight: 1.55, color: "var(--gris)" }}>Puede que el enlace haya cambiado o que la máquina ya no esté publicada.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <BotonRecargar />
            <a className="btn" href="/">← Volver al inicio</a>
            <a className="btn" href="/catalogo">Ver el catálogo</a>
          </div>
        </div>
        <span aria-hidden style={{ position: "absolute", right: 24, bottom: -18, fontSize: "clamp(120px,22vw,260px)", fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 1, color: "var(--suave)", pointerEvents: "none", userSelect: "none", zIndex: 0 }}>404</span>
      </div>
    </div>
  </Marco></Proveedor>;
}
