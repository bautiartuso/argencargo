// 404 propia. Reemplaza la pantalla por defecto de Next ("This page could not be found"),
// que salía en inglés y sin ninguna salida hacia el resto del sitio.
const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const BG = "#0a1223";
const AC = "#3B7DD8";
const NAVY = "#152D54";
const WA = "5491125088580";

export const metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: true },
};

const SALIDAS = [
  { href: "/portal", t: "Cotizar una importación", d: "Calculadora de costos y portal de clientes" },
  { href: "/portal", t: "Seguir mi carga", d: "Entrá al portal y mirá el tracking en vivo" },
  { href: "/blog", t: "Blog", d: "Aduana, régimen courier y aranceles, en simple" },
];

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "'Inter','Segoe UI',system-ui,-apple-system,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 22px" }}>
      <div style={{ maxWidth: 520, width: "100%" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 30 }}>
          <img src={LOGO} alt="Argencargo" width={52} height={34} style={{ height: 34, width: "auto" }} />
        </a>

        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: AC, margin: "0 0 10px" }}>ERROR 404</p>
        <h1 style={{ fontSize: "clamp(26px, 6vw, 36px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
          Esta página se perdió en tránsito
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.6)", margin: "0 0 28px" }}>
          El link que seguiste no existe o cambió de lugar. Tu carga está bien: lo único extraviado es esta dirección.
        </p>

        <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
          {SALIDAS.map((s) => (
            <a
              key={s.t}
              href={s.href}
              style={{
                display: "block",
                padding: "14px 16px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                textDecoration: "none",
              }}
            >
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{s.t}</span>
              <span style={{ display: "block", fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>{s.d}</span>
            </a>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a
            href="/"
            style={{ padding: "13px 24px", fontSize: 14, fontWeight: 700, borderRadius: 10, background: `linear-gradient(135deg,${AC},${NAVY})`, color: "#fff", textDecoration: "none" }}
          >
            Volver al inicio
          </a>
          <a
            href={`https://wa.me/${WA}?text=${encodeURIComponent("Hola! Estaba buscando algo en la web y no lo encontré")}`}
            target="_blank"
            rel="noopener"
            style={{ padding: "13px 24px", fontSize: 14, fontWeight: 700, borderRadius: 10, background: "#25D366", color: "#0a1223", textDecoration: "none" }}
          >
            Escribinos por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
