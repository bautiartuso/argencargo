// /factura/[token] — Factura C con diseño propio (logo + marca de agua), lista para
// imprimir en A4 completo o mandar al cliente por link. Incluye todo lo que exige ARCA:
// emisor, receptor, tipo y número, CAE con vencimiento y el QR oficial (RG 4892).

import QRCode from "qrcode";
import { arcaConfig, qrUrl, COND_IVA } from "../../../lib/arca";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
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

const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (d) => d ? new Date(d + "T12:00:00Z").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";
const pad = (n, l) => String(n ?? 0).padStart(l, "0");

export default async function FacturaPublica({ params }) {
  const { token } = await params;
  const r = await fetch(`${SB_URL}/rest/v1/invoices?public_token=eq.${encodeURIComponent(token)}&select=*,operations(operation_code,description)&limit=1`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }, cache: "no-store",
  }).then((x) => x.json()).catch(() => null);
  const inv = Array.isArray(r) && r[0];
  const cfg = await arcaConfig();

  if (!inv || inv.status !== "emitida") {
    return <div style={{ minHeight: "100vh", background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif" }}>
      <p style={{ opacity: 0.6 }}>{inv ? "Esta factura todavía no fue emitida." : "Factura no encontrada."}</p>
    </div>;
  }

  const qr = await QRCode.toDataURL(qrUrl(inv, cfg?.cuit || process.env.ARCA_CUIT || "0"), { margin: 0, width: 220 });
  const nroCompleto = `${pad(inv.punto_venta, 5)}-${pad(inv.numero, 8)}`;
  const esHomo = inv.environment !== "produccion";
  const docLbl = inv.doc_tipo === 80 ? "CUIT" : inv.doc_tipo === 96 ? "DNI" : "Documento";
  const items = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [{ label: inv.detalle, usd: 0, ars: inv.importe }];

  // Mercaderías de la operación (si la factura salió de una op): lista numerada bajo el detalle.
  let mercaderias = [];
  if (inv.operation_id) {
    try {
      const mi = await fetch(`${SB_URL}/rest/v1/operation_items?operation_id=eq.${inv.operation_id}&select=description,quantity&order=created_at.asc`, {
        headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }, cache: "no-store",
      }).then((x) => x.json());
      mercaderias = (Array.isArray(mi) ? mi : []).filter((m) => (m.description || "").trim()).map((m) => `${m.description.trim()}${Number(m.quantity) > 1 ? ` x${Number(m.quantity)}` : ""}`);
    } catch {}
  }

  const kv = { display: "flex", flexDirection: "column", gap: 2 };
  const kLbl = { fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8" };
  const kVal = { fontSize: 13.5, fontWeight: 700, color: "#111" };

  return <div className="fac-page" style={{ minHeight: "100vh", background: "#e8eaee", padding: "28px 14px 60px", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", color: "#111" }}>
    <style>{`
      @page{size:A4;margin:0}
      .fac-card{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @media print{
        .fac-page{background:#fff !important;padding:0 !important;min-height:auto !important}
        .fac-wrap{max-width:none !important}
        .fac-card{border-radius:0 !important;box-shadow:none !important;min-height:297mm;display:flex;flex-direction:column;padding:12mm 13mm 10mm !important;box-sizing:border-box}
        .fac-inner{flex:1;display:flex;flex-direction:column}
        .fac-detalle{flex:1}
        .fac-foot-url,.fac-banner{display:none !important}
      }
    `}</style>
    <div className="fac-wrap" style={{ maxWidth: 780, margin: "0 auto" }}>
      {esHomo && <div className="fac-banner" style={{ background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, marginBottom: 12, textAlign: "center" }}>⚠ COMPROBANTE DE PRUEBA (ambiente de homologación de ARCA) — SIN VALOR FISCAL</div>}

      <div className="fac-card" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.12)", padding: "26px 30px", position: "relative", overflow: "hidden" }}>
        {/* Marca de agua: el logo grande y translúcido, centrado detrás de todo */}
        <img src={LOGO} alt="" aria-hidden style={{ position: "absolute", left: "50%", top: "52%", transform: "translate(-50%,-50%) rotate(-14deg)", width: "78%", opacity: 0.045, filter: "brightness(0.25)", pointerEvents: "none" }} />

        <div className="fac-inner" style={{ position: "relative" }}>
          {/* Encabezado */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <img src={LOGO} alt="Argencargo" style={{ height: 54, filter: "brightness(0.2)" }} />
              <p style={{ fontSize: 15, fontWeight: 800, margin: "12px 0 2px", letterSpacing: "-0.01em" }}>{cfg?.razon_social || "—"}</p>
              <p style={{ fontSize: 11.5, color: "#475569", margin: 0, lineHeight: 1.5, maxWidth: 300 }}>{cfg?.domicilio || ""}</p>
              <p style={{ fontSize: 11.5, color: "#475569", margin: "2px 0 0" }}>Responsable Monotributo · CUIT <b style={{ fontFamily: "ui-monospace,monospace", color: "#111" }}>{cfg?.cuit || "—"}</b></p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>Inicio de actividades: {fmtFecha(cfg?.inicio_actividades)}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 52, height: 52, border: `2.5px solid ${NAVY}`, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  <span style={{ fontSize: 26, fontWeight: 900 }}>C</span>
                  <span style={{ fontSize: 7.5, color: "#64748b", marginTop: 1 }}>COD. {pad(inv.tipo_cbte, 2)}</span>
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontSize: 21, fontWeight: 900, letterSpacing: "0.01em", margin: 0 }}>FACTURA</p>
                  <p style={{ fontSize: 14, fontWeight: 800, fontFamily: "ui-monospace,monospace", margin: "1px 0 0", color: "#334155" }}>{nroCompleto}</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Fecha de emisión: <b style={{ color: "#111" }}>{fmtFecha(inv.fecha)}</b></p>
            </div>
          </div>

          <div style={{ height: 3.5, background: NAVY, borderRadius: 2, margin: "18px 0", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />

          {/* Cliente */}
          <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: NAVY, margin: "0 0 8px" }}>Facturado a</p>
          <div style={{ background: "#f7f8fa", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "12px 22px", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            <div style={{ ...kv, gridColumn: "1 / -1" }}><span style={kLbl}>Cliente</span><span style={{ ...kVal, fontSize: 16 }}>{inv.receptor_nombre || "Consumidor Final"}</span></div>
            <div style={kv}><span style={kLbl}>{docLbl}</span><span style={{ ...kVal, fontFamily: "ui-monospace,monospace" }}>{inv.doc_nro || "—"}</span></div>
            <div style={kv}><span style={kLbl}>Condición IVA</span><span style={kVal}>{COND_IVA[inv.receptor_cond_iva] || "—"}</span></div>
            {inv.operations?.operation_code && <div style={kv}><span style={kLbl}>Operación</span><span style={{ ...kVal, fontFamily: "ui-monospace,monospace" }}>{inv.operations.operation_code}</span></div>}
            {inv.receptor_domicilio && <div style={{ ...kv, gridColumn: "1 / -1" }}><span style={kLbl}>Domicilio</span><span style={kVal}>{inv.receptor_domicilio}</span></div>}
          </div>

          {/* Detalle */}
          <div className="fac-detalle" style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 7 }}>
              <span>Descripción</span><span>Importe</span>
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid #eef2f6", fontSize: 13.5, alignItems: "baseline" }}>
                <span style={{ fontWeight: 600 }}>{it.label}</span>
                <b style={{ fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap", fontSize: 14 }}>$ {fmt(it.ars)}</b>
              </div>
            ))}
            {mercaderias.length > 0 && <div style={{ marginTop: 12, padding: "10px 14px", background: "#f7f8fa", border: "1px solid #e2e8f0", borderRadius: 10, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", margin: "0 0 5px" }}>Detalle de mercaderías</p>
              {mercaderias.map((m, i) => <p key={i} style={{ fontSize: 11.5, color: "#334155", margin: "2px 0", lineHeight: 1.45 }}>{i + 1} - {m}</p>)}
            </div>}
          </div>

          {/* Total */}
          <div style={{ marginTop: 18, background: NAVY, color: "#fff", borderRadius: 12, padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.14em" }}>TOTAL</span>
            <span style={{ fontSize: 23, fontWeight: 900, fontFamily: "ui-monospace,monospace" }}>$ {fmt(inv.importe)}</span>
          </div>

          {/* CAE + QR */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src={qr} alt="QR ARCA" style={{ width: 96, height: 96 }} />
              <p style={{ fontSize: 9.5, color: "#94a3b8", maxWidth: 130, lineHeight: 1.5, margin: 0 }}>Escaneá el código para verificar este comprobante en ARCA</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>CAE N° <b style={{ fontFamily: "ui-monospace,monospace", color: "#111", fontSize: 13 }}>{inv.cae}</b></p>
              <p style={{ fontSize: 11, color: "#64748b", margin: "3px 0 0" }}>Vencimiento CAE: <b style={{ color: "#111" }}>{fmtFecha(inv.cae_vto)}</b></p>
              <p style={{ fontSize: 9.5, color: "#94a3b8", margin: "6px 0 0" }}>Comprobante autorizado por ARCA · argencargo.com.ar</p>
            </div>
          </div>
        </div>
      </div>
      <p className="fac-foot-url" style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 14 }}>argencargo.com.ar</p>
    </div>
  </div>;
}
