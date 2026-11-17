// /factura/[token] — Factura C con diseño propio (logo + marca de agua), lista para
// imprimir en A4 completo o mandar al cliente por link. Incluye todo lo que exige ARCA:
// emisor, receptor, tipo y número, CAE con vencimiento y el QR oficial (RG 4892).

import QRCode from "qrcode";
import { arcaConfig, qrUrl } from "../../../lib/arca";
import FacturaVista, { listaMercaderias, esFacturaDeVenta } from "../FacturaVista";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const NAVY = "#0A1628";

export const dynamic = "force-dynamic";

// El título de la página es el nombre de archivo que propone el navegador al guardar
// como PDF: "Cliente - AC-0123" (sin el sufijo del layout).
export async function generateMetadata({ params }) {
  const { token } = await params;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/invoices?public_token=eq.${encodeURIComponent(token)}&select=receptor_nombre,operations(operation_code)&limit=1`, {
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }, cache: "no-store",
    }).then((x) => x.json());
    const inv = Array.isArray(r) && r[0];
    if (inv?.receptor_nombre) {
      const nombre = `${inv.receptor_nombre}${inv.operations?.operation_code ? ` - ${inv.operations.operation_code}` : ""}`;
      return { title: { absolute: nombre } };
    }
  } catch {}
  return { title: { absolute: "Factura Argencargo" } };
}


export default async function FacturaPublica({ params }) {
  const { token } = await params;
  const r = await fetch(`${SB_URL}/rest/v1/invoices?public_token=eq.${encodeURIComponent(token)}&select=*,operations(operation_code,description)&limit=1`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }, cache: "no-store",
  }).then((x) => x.json()).catch(() => null);
  const inv = Array.isArray(r) && r[0];
  const cfg = await arcaConfig();

  if (!inv || inv.status !== "emitida") {
    return <div style={{ minHeight: "100vh", background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif" }}>
      <p style={{ opacity: 0.6 }}>{inv ? "Este comprobante todavía no fue emitido." : "Comprobante no encontrado."}</p>
    </div>;
  }

  const qr = await QRCode.toDataURL(qrUrl(inv, cfg?.cuit || process.env.ARCA_CUIT || "0"), { margin: 0, width: 220 });
  const esNC = Number(inv.tipo_cbte || 11) === 13;
  // Factura que anula (si es nota de crédito): por anula_id o, si la columna no existe, por el número en el detalle.
  let anula = null;
  if (esNC) {
    try {
      if (inv.anula_id) { const a = await fetch(`${SB_URL}/rest/v1/invoices?id=eq.${inv.anula_id}&select=punto_venta,numero,fecha&limit=1`, { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }, cache: "no-store" }).then((x) => x.json()); anula = Array.isArray(a) ? a[0] : null; }
      if (!anula) { const m = String(inv.detalle || "").match(/(\d{5})-(\d{8})/); if (m) anula = { punto_venta: Number(m[1]), numero: Number(m[2]) }; }
    } catch {}
  }
  // Mercaderías de la operación (si la factura salió de una op): lista numerada bajo el detalle.
  let mercaderias = [];
  if (inv.operation_id && !esFacturaDeVenta(inv)) {
    try {
      const mi = await fetch(`${SB_URL}/rest/v1/operation_items?operation_id=eq.${inv.operation_id}&select=description,quantity&order=created_at.asc`, {
        headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }, cache: "no-store",
      }).then((x) => x.json());
      // La factura tiene que entrar en UNA hoja: los ítems repetidos se suman (listaMercaderias).
      mercaderias = listaMercaderias(mi);
    } catch {}
  }

  return <FacturaVista inv={inv} cfg={cfg} qr={qr} anula={anula} mercaderias={mercaderias} />;
}
