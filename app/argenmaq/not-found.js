// 404 de ARGENMAQ. El middleware manda acá cualquier ruta desconocida del host de
// ARGENMAQ, así no cae en la 404 de Argencargo (otra marca, otros links).
import { Logo, wa, Y, INK, GRIS, BORDE, SUAVE } from "./_marca";

export const metadata = {
  title: { absolute: "Página no encontrada — ARGENMAQ" },
  robots: { index: false, follow: true },
};

const SALIDAS = [
  { href: "/", t: "Ver el catálogo", d: "Toda la maquinaria, por rubro" },
  { href: "/#como", t: "Cómo funciona", d: "De la fábrica en China a tu taller" },
  { href: "/#pago", t: "Cómo se paga", d: "Anticipo, producción y contra entrega" },
];

export default function NotFoundArgenmaq() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: INK, fontFamily: "'Montserrat',ui-sans-serif,system-ui,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 22px" }}>
      <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap');" }} />
      <div style={{ maxWidth: 540, width: "100%" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 28, textDecoration: "none" }}>
          <Logo />
        </a>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: GRIS, margin: "0 0 12px", fontFamily: "'JetBrains Mono',ui-monospace,monospace" }}>ERROR 404</p>
        <h1 style={{ fontSize: "clamp(34px, 8vw, 60px)", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 0.98, margin: "0 0 14px" }}>
          Esta página no <span style={{ background: Y, padding: "0 0.12em", borderRadius: "0.12em", display: "inline-block", transform: "rotate(-1.2deg)" }}>está en stock.</span>
        </h1>
        <p style={{ fontSize: 16.5, lineHeight: 1.55, color: GRIS, margin: "0 0 28px" }}>
          El link que seguiste no existe o cambió de lugar. La máquina que buscabas seguro sí está.
        </p>

        <div style={{ display: "grid", gap: 10, marginBottom: 26 }}>
          {SALIDAS.map((s) => (
            <a key={s.t} href={s.href} style={{ display: "block", padding: "15px 18px", borderRadius: 18, background: SUAVE, border: `1px solid ${BORDE}`, textDecoration: "none", color: INK }}>
              <span style={{ display: "block", fontSize: 15.5, fontWeight: 800, letterSpacing: "-0.015em", marginBottom: 2 }}>{s.t}</span>
              <span style={{ display: "block", fontSize: 13, color: GRIS }}>{s.d}</span>
            </a>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/" style={{ display: "inline-flex", padding: "13px 22px", borderRadius: 999, fontWeight: 800, fontSize: 14.5, background: INK, color: "#fff", textDecoration: "none" }}>
            Volver al inicio
          </a>
          <a href={wa("Hola ARGENMAQ, estaba buscando algo en la web y no lo encontré")} target="_blank" rel="noopener" style={{ display: "inline-flex", padding: "13px 22px", borderRadius: 999, fontWeight: 800, fontSize: 14.5, background: Y, color: INK, textDecoration: "none" }}>
            Escribinos por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
