// Datos y marco visual compartidos por las páginas de ARGENMAQ (legales, 404).
// El host propio se setea con NEXT_PUBLIC_ARGENMAQ_URL cuando Bautista compre el dominio;
// mientras tanto vive en argenmaq.vercel.app.
export const AM_URL = process.env.NEXT_PUBLIC_ARGENMAQ_URL || "https://argenmaq.vercel.app";

export const Y = "#FFD200";
export const INK = "#15171A";
export const GRIS = "#5B6066";
export const BORDE = "#E6E7EA";
export const SUAVE = "#F4F5F7";

export const WA_NUM = "5491125088580";
export const wa = (m) => `https://wa.me/${WA_NUM}?text=${encodeURIComponent(m)}`;

export const LINKS_LEGALES = [
  { href: "/legal", t: "Aviso legal" },
  { href: "/privacidad", t: "Política de privacidad" },
  { href: "/terminos", t: "Términos y condiciones" },
];

export function Logo({ size = 22, inv = false }) {
  const alto = size * 1.5;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <img src={inv ? "/argenmaq/isotipo-blanco.png" : "/argenmaq/isotipo.png"} alt="" style={{ height: alto, width: "auto" }} />
      <img src={inv ? "/argenmaq/texto-blanco.png" : "/argenmaq/texto.png"} alt="ARGENMAQ" style={{ height: alto * 0.62, width: "auto" }} />
    </span>
  );
}

const FUENTE = "'Montserrat',ui-sans-serif,system-ui,-apple-system,sans-serif";

// Marco de las páginas legales de ARGENMAQ: blanco, tipografía de la marca, amarillo de acento.
export default function DocArgenmaq({ titulo, bajada, secciones, actual }) {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: INK, fontFamily: FUENTE, WebkitFontSmoothing: "antialiased" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap');",
        }}
      />
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "36px 22px 70px" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 26, textDecoration: "none" }}>
          <Logo />
        </a>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.035em", margin: "0 0 6px" }}>{titulo}</h1>
        {bajada && <p style={{ fontSize: 13, color: GRIS, margin: "0 0 30px" }}>{bajada}</p>}

        {secciones.map((s, i) => (
          <section
            key={i}
            style={{
              marginBottom: 18,
              padding: s.destacado ? "18px 20px" : "0 0 4px",
              borderRadius: s.destacado ? 18 : 0,
              background: s.destacado ? SUAVE : "transparent",
              border: s.destacado ? `1px solid ${BORDE}` : "none",
            }}
          >
            {s.t && (
              <h2 style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: "-0.015em", margin: "0 0 8px" }}>
                {s.destacado ? <span style={{ background: Y, padding: "0 6px", borderRadius: 5 }}>{s.t}</span> : s.t}
              </h2>
            )}
            {(s.p || []).map((tx, k) => (
              <p key={k} style={{ fontSize: 14.5, lineHeight: 1.65, color: GRIS, margin: "0 0 9px" }}>
                {tx}
              </p>
            ))}
            {s.filas && (
              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "minmax(140px,auto) 1fr", gap: "8px 18px" }}>
                {s.filas.map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <dt style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{k}</dt>
                    <dd style={{ margin: 0, fontSize: 14.5, color: GRIS }}>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}

        <nav style={{ marginTop: 34, paddingTop: 18, borderTop: `1px solid ${BORDE}`, display: "flex", gap: 18, flexWrap: "wrap" }}>
          {LINKS_LEGALES.filter((l) => l.href !== actual).map((l) => (
            <a key={l.href} href={l.href} style={{ fontSize: 13, color: GRIS, textDecoration: "none" }}>
              {l.t}
            </a>
          ))}
          <a href="/" style={{ fontSize: 13, color: GRIS, textDecoration: "none" }}>
            Volver al inicio
          </a>
        </nav>
      </div>
    </div>
  );
}
