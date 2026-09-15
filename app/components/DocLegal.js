// Marco compartido por las páginas legales (/legal, /privacidad).
// Mismo lenguaje visual que /terminos para que se lean como un solo bloque.
const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const BG = "#0a1223";
const GOLD = "#E8C99B";

export const LINKS_LEGALES = [
  { href: "/legal", t: "Aviso legal" },
  { href: "/privacidad", t: "Política de privacidad" },
  { href: "/terminos", t: "Términos y condiciones" },
];

export default function DocLegal({ titulo, bajada, secciones, actual }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "36px 22px 70px" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 26 }}>
          <img src={LOGO} alt="Argencargo" width={52} height={34} style={{ height: 34, width: "auto" }} />
        </a>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{titulo}</h1>
        {bajada && <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", margin: "0 0 30px" }}>{bajada}</p>}

        {secciones.map((s, i) => (
          <section
            key={i}
            style={{
              marginBottom: 18,
              padding: s.destacado ? "16px 18px" : "0 0 4px",
              borderRadius: s.destacado ? 12 : 0,
              background: s.destacado ? "rgba(232,201,155,0.05)" : "transparent",
              border: s.destacado ? "1px solid rgba(232,201,155,0.22)" : "none",
            }}
          >
            {s.t && (
              <h2 style={{ fontSize: 15.5, fontWeight: 800, color: s.destacado ? GOLD : "#fff", margin: "0 0 8px", letterSpacing: "-0.005em" }}>
                {s.t}
              </h2>
            )}
            {(s.p || []).map((tx, k) => (
              <p key={k} style={{ fontSize: 13.5, lineHeight: 1.65, color: "rgba(255,255,255,0.72)", margin: "0 0 9px" }}>
                {tx}
              </p>
            ))}
            {s.filas && (
              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "minmax(140px,auto) 1fr", gap: "8px 18px" }}>
                {s.filas.map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <dt style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>{k}</dt>
                    <dd style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.85)" }}>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}

        <nav style={{ marginTop: 34, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 18, flexWrap: "wrap" }}>
          {LINKS_LEGALES.filter((l) => l.href !== actual).map((l) => (
            <a key={l.href} href={l.href} style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>
              {l.t}
            </a>
          ))}
          <a href="/" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>
            Volver al inicio
          </a>
        </nav>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>© 2026 Argencargo</span>
          <a href="mailto:info@argencargo.com.ar" style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>
            info@argencargo.com.ar
          </a>
        </div>
      </div>
    </div>
  );
}
