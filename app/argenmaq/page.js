// Página de espera de Argenmaq. La landing real se arma después, paso a paso; esto solo marca
// el lugar y el color: amarillo de maquinaria sobre grafito.
export const metadata = {
  title: "Argenmaq — Maquinaria de China, puesta en Argentina",
  description: "Máquinas para tu negocio con el precio final puesto en Argentina. Una empresa del grupo Argencargo.",
};

export default function ArgenmaqLanding() {
  return (
    <main style={{ minHeight: "100vh", background: "#15171A", color: "#F2F3F4", fontFamily: "'Manrope',ui-sans-serif,system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=JetBrains+Mono:wght@500&display=swap" />
      <header style={{ padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em" }}>ARGEN<span style={{ background: "#FFD200", color: "#15171A", padding: "0 6px", borderRadius: 5, marginLeft: 1 }}>MAQ</span></span>
        <a href="/admin" style={{ color: "#9AA0A6", fontSize: 13, textDecoration: "none", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em" }}>PANEL</a>
      </header>
      <section style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 28px 80px", maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: "0.14em", color: "#FFD200", margin: "0 0 18px" }}>PRÓXIMAMENTE</p>
        <h1 style={{ fontSize: "clamp(34px,6vw,64px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.02, margin: "0 0 22px" }}>Maquinaria de China,<br />con el precio puesto en Argentina.</h1>
        <p style={{ fontSize: 18, color: "#9AA0A6", maxWidth: 560, lineHeight: 1.5, margin: 0 }}>Elegís la máquina, ves cuánto sale en tu puerta con flete e impuestos incluidos, y nosotros nos encargamos del resto.</p>
      </section>
      <footer style={{ padding: "18px 28px", borderTop: "1px solid #2A2D31", fontSize: 12.5, color: "#9AA0A6" }}>Una empresa del grupo Argencargo.</footer>
    </main>
  );
}
