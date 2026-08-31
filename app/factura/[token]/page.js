// /factura/[token] — Factura C con diseño propio (logo + marca), lista para imprimir
// o mandar al cliente. Incluye todo lo que exige ARCA: datos de emisor y receptor,
// tipo y número de comprobante, CAE con vencimiento y el QR oficial (RG 4892).

import QRCode from "qrcode";
import { arcaConfig, qrUrl, COND_IVA } from "../../../lib/arca";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const NAVY = "#0A1628";

export const metadata = { title: "Factura — Argencargo" };
export const dynamic = "force-dynamic";

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
  const row = { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "2px 0" };
  const lbl = { color: "#64748b" };

  return <div className="fac-page" style={{ minHeight: "100vh", background: "#e8eaee", padding: "28px 14px 60px", fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", color: "#111" }}>
    <style>{`
      @page{size:A4;margin:0}
      @media print{
        .fac-page{background:#fff !important;padding:0 !important;min-height:auto !important}
        .fac-wrap{max-width:none !important}
        .fac-card{border-radius:0 !important;box-shadow:none !important;min-height:297mm;display:flex;flex-direction:column;padding:10mm 12mm 8mm;box-sizing:border-box}
        .fac-detalle{flex:1}
        .fac-foot-url{display:none !important}
      }
    `}</style>
    <div className="fac-wrap" style={{ maxWidth: 760, margin: "0 auto" }}>
      {esHomo && <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, marginBottom: 12, textAlign: "center" }}>⚠ COMPROBANTE DE PRUEBA (ambiente de homologación de ARCA) — SIN VALOR FISCAL</div>}
      <div className="fac-card" style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.12)" }}>

        {/* Encabezado */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 1fr", alignItems: "stretch", borderBottom: `3px solid ${NAVY}` }}>
          <div style={{ padding: "18px 20px" }}>
            <img src={LOGO} alt="Argencargo" style={{ height: 38, filter: "brightness(0.2)" }} />
            <p style={{ fontSize: 13.5, fontWeight: 800, margin: "10px 0 2px" }}>{cfg?.razon_social || "—"}</p>
            <p style={{ fontSize: 11.5, color: "#475569", margin: 0, lineHeight: 1.5 }}>{cfg?.domicilio || ""}</p>
            <p style={{ fontSize: 11.5, color: "#475569", margin: "3px 0 0" }}>Responsable Monotributo</p>
          </div>
          <div style={{ borderLeft: "1.5px solid #cbd5e1", borderRight: "1.5px solid #cbd5e1", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14 }}>
            <span style={{ fontSize: 34, fontWeight: 900, lineHeight: 1 }}>C</span>
            <span style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>COD. {pad(inv.tipo_cbte, 2)}</span>
          </div>
          <div style={{ padding: "18px 20px", textAlign: "right" }}>
            <p style={{ fontSize: 17, fontWeight: 900, margin: "0 0 6px", letterSpacing: "0.02em" }}>FACTURA</p>
            <div style={{ ...row, justifyContent: "flex-end", gap: 8 }}><span style={lbl}>Nº</span><b style={{ fontFamily: "ui-monospace,monospace" }}>{nroCompleto}</b></div>
            <div style={{ ...row, justifyContent: "flex-end", gap: 8 }}><span style={lbl}>Fecha</span><b>{fmtFecha(inv.fecha)}</b></div>
            <div style={{ ...row, justifyContent: "flex-end", gap: 8 }}><span style={lbl}>CUIT</span><b style={{ fontFamily: "ui-monospace,monospace" }}>{cfg?.cuit || "—"}</b></div>
            {cfg?.inicio_actividades && <div style={{ ...row, justifyContent: "flex-end", gap: 8 }}><span style={lbl}>Inicio act.</span><b>{fmtFecha(cfg.inicio_actividades)}</b></div>}
          </div>
        </div>

        {/* Receptor */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "4px 24px" }}>
          <div style={row}><span style={lbl}>Cliente</span><b>{inv.receptor_nombre || "Consumidor Final"}</b></div>
          <div style={row}><span style={lbl}>{inv.doc_tipo === 80 ? "CUIT" : inv.doc_tipo === 96 ? "DNI" : "Doc."}</span><b style={{ fontFamily: "ui-monospace,monospace" }}>{inv.doc_nro || "—"}</b></div>
          {inv.receptor_domicilio && <div style={row}><span style={lbl}>Domicilio</span><b style={{ textAlign: "right" }}>{inv.receptor_domicilio}</b></div>}
          <div style={row}><span style={lbl}>Cond. IVA</span><b>{COND_IVA[inv.receptor_cond_iva] || "—"}</b></div>
          <div style={row}><span style={lbl}>Cond. de venta</span><b>Contado</b></div>
        </div>

        {/* Detalle — una fila por concepto; cada uno con su USD y el TC aplicado */}
        <div className="fac-detalle" style={{ padding: "16px 20px 6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", borderBottom: "1.5px solid #cbd5e1", paddingBottom: 6 }}>
            <span>Descripción</span><span>Importe</span>
          </div>
          {Array.isArray(inv.items) && inv.items.length > 0 ? inv.items.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13.5, alignItems: "baseline" }}>
              <span>{it.label}{inv.operations?.operation_code && i === 0 ? ` · Operación ${inv.operations.operation_code}` : ""}
                {Number(it.usd) > 0 && Number(inv.tc) > 0 && <span style={{ display: "block", fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>USD {fmt(it.usd)} · TC $ {fmt(inv.tc)}</span>}
              </span>
              <b style={{ fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap" }}>$ {fmt(it.ars)}</b>
            </div>
          )) : (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0 14px", fontSize: 13.5 }}>
              <span>{inv.detalle}{inv.operations?.operation_code ? ` · Operación ${inv.operations.operation_code}` : ""}</span>
              <b style={{ fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap" }}>$ {fmt(inv.importe)}</b>
            </div>
          )}
        </div>

        {/* Total */}
        <div style={{ margin: "0 20px", background: NAVY, color: "#fff", borderRadius: 10, padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.1em" }}>TOTAL</span>
          <span style={{ fontSize: 21, fontWeight: 900, fontFamily: "ui-monospace,monospace" }}>$ {fmt(inv.importe)}</span>
        </div>

        {/* CAE + QR */}
        <div style={{ padding: "16px 20px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <img src={qr} alt="QR ARCA" style={{ width: 108, height: 108 }} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...row, justifyContent: "flex-end", gap: 8 }}><span style={lbl}>CAE Nº</span><b style={{ fontFamily: "ui-monospace,monospace" }}>{inv.cae}</b></div>
            <div style={{ ...row, justifyContent: "flex-end", gap: 8 }}><span style={lbl}>Vto. CAE</span><b>{fmtFecha(inv.cae_vto)}</b></div>
            <p style={{ fontSize: 10, color: "#94a3b8", margin: "8px 0 0" }}>Comprobante autorizado por ARCA</p>
          </div>
        </div>
      </div>
      <p className="fac-foot-url" style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 14 }}>argencargo.com.ar</p>
    </div>
  </div>;
}
