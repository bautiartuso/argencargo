// Estilos y piezas compartidas del blog público (misma línea que la landing: navy + dorado).
export const BG = "#0a1223";
export const GOLD = "#E8C99B";
export const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
export const fecha = (d) => (d ? new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "");

export function Marco({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(10,18,35,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/" style={{ display: "flex", alignItems: "center" }}><img src={LOGO} alt="Argencargo" style={{ height: 34 }} /></a>
          <a href="/blog" style={{ color: GOLD, textDecoration: "none", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>Novedades</a>
          <a href="/#cotizar" style={{ marginLeft: "auto", color: "#0A1628", background: GOLD, textDecoration: "none", fontWeight: 800, fontSize: 12.5, padding: "8px 14px", borderRadius: 9 }}>Cotizar</a>
        </div>
      </header>
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 20px 60px" }}>{children}</main>
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "26px 20px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
        Argencargo · Courier y forwarder internacional · <a href="/terminos" style={{ color: "rgba(255,255,255,0.55)" }}>Términos</a>
      </footer>
    </div>
  );
}
