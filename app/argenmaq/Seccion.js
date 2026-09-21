// Secciones del pie de ARGENMAQ que todavía no tienen contenido propio. Bautista pidió crear el pie
// completo como el de B2Box (21/09/2026) e ir llenando cada página después.
import { Proveedor, Marco } from "./kit";

export default function Seccion({ titulo, bajada, hijos }) {
  return <Proveedor><Marco actual="seccion">
    <div className="wrap" style={{ padding: "40px 24px 80px", maxWidth: 820 }}>
      <h1 className="h2" style={{ marginBottom: 12 }}>{titulo}</h1>
      <p style={{ color: "var(--gris)", fontSize: 16.5, lineHeight: 1.6, margin: "0 0 24px" }}>{bajada}</p>
      {hijos}
      <p style={{ marginTop: 28, fontSize: 14, color: "var(--gris)" }}>¿Tenés una duda puntual? <a href="https://wa.me/5491125088580?text=Hola%20ARGENMAQ" target="_blank" rel="noreferrer" style={{ fontWeight: 800 }}>Escribinos por WhatsApp</a>.</p>
    </div>
  </Marco></Proveedor>;
}
