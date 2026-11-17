// Hoja de la factura (16/11/2026 → compartida el 17/11/2026): la usan la página pública /factura/[token]
// (comprobante emitido, con CAE y QR) y /factura/vista-previa (borrador del facturador, sin validez).
// Sin hooks ni acceso a datos: recibe todo por props, así sirve del lado del servidor y del navegador.
const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const NAVY = "#0A1628";
const COND_IVA = { 1: "IVA Responsable Inscripto", 4: "IVA Sujeto Exento", 5: "Consumidor Final", 6: "Responsable Monotributo", 7: "Sujeto No Categorizado", 13: "Monotributista Social" };

const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (d) => d ? new Date(d + "T12:00:00Z").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";
const pad = (n, l) => String(n ?? 0).padStart(l, "0");

// Mercaderías de la operación para el recuadro "Detalle de mercaderías": los repetidos se suman.
export function listaMercaderias(filas) {
  const agr = new Map();
  for (const m of Array.isArray(filas) ? filas : []) {
    const d = String(m.description || "").trim(); if (!d) continue;
    const k = d.toLowerCase().replace(/\s+/g, " ");
    if (!agr.has(k)) agr.set(k, { d, q: 0 });
    agr.get(k).q += Number(m.quantity || 0);
  }
  return [...agr.values()].map((m) => `${m.d}${m.q > 1 ? ` x${m.q}` : ""}`);
}
// Factura de venta de mercadería (actividad "Venta…"): los ítems son los productos, con cantidad y
// precio unitario en su columna, y no lleva el recuadro de mercaderías (sería repetir lo mismo).
export const esFacturaDeVenta = (inv) => /venta/i.test(String(inv?.actividad_desc || "")) && Array.isArray(inv?.items) && inv.items.length > 0 && inv.items.every((it) => Number(it.cantidad) > 0 && Number(it.unitario) > 0);

export default function FacturaVista({ inv, cfg, qr = null, anula = null, mercaderias = [], previa = false }) {
  const esNC = Number(inv.tipo_cbte || 11) === 13;
  const nroCompleto = `${pad(inv.punto_venta, 5)}-${previa ? "········" : pad(inv.numero, 8)}`;
  const esHomo = !previa && inv.environment !== "produccion";
  const docLbl = inv.doc_tipo === 80 ? "CUIT" : inv.doc_tipo === 96 ? "DNI" : "Documento";
  const items = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [{ label: inv.detalle, usd: 0, ars: inv.importe }];
  const venta = esFacturaDeVenta(inv);
  const chico = venta && items.length > 9;
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
      {previa && <div className="fac-banner" style={{ background: "#e0e7ff", border: "1px solid #6366f1", color: "#3730a3", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, marginBottom: 12, textAlign: "center" }}>VISTA PREVIA — todavía no se emitió. Sin validez fiscal.</div>}
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
                {/* Letra y código del comprobante: obligatorios, pero chicos y discretos (17/11/2026). */}
                <div style={{ width: 30, height: 30, border: "1.2px solid #cbd5e1", borderRadius: 7, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#64748b" }}>C</span>
                  <span style={{ fontSize: 5.5, color: "#94a3b8", marginTop: 1 }}>COD. {pad(inv.tipo_cbte || 11, 2)}</span>
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontSize: esNC ? 17 : 21, fontWeight: 900, letterSpacing: "0.01em", margin: 0 }}>{esNC ? "NOTA DE CRÉDITO" : "FACTURA"}</p>
                  <p style={{ fontSize: 14, fontWeight: 800, fontFamily: "ui-monospace,monospace", margin: "1px 0 0", color: "#334155" }}>{nroCompleto}</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Fecha de emisión: <b style={{ color: "#111" }}>{fmtFecha(inv.fecha)}</b></p>
              {esNC && anula && <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0" }}>Anula Factura C <b style={{ fontFamily: "ui-monospace,monospace", color: "#111" }}>{pad(anula.punto_venta, 5)}-{pad(anula.numero, 8)}</b>{anula.fecha ? ` del ${fmtFecha(anula.fecha)}` : ""}</p>}
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
            {venta ? <>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 58px 112px 128px", gap: 12, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 7 }}>
                <span>Descripción</span><span style={{ textAlign: "right" }}>Cant.</span><span style={{ textAlign: "right" }}>Precio unit.</span><span style={{ textAlign: "right" }}>Importe</span>
              </div>
              {items.map((it, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 58px 112px 128px", gap: 12, padding: chico ? "7px 0" : "11px 0", borderBottom: "1px solid #eef2f6", fontSize: chico ? 12 : 13.5, alignItems: "baseline" }}>
                  <span style={{ fontWeight: 600 }}>{it.label}</span>
                  <span style={{ textAlign: "right", fontFamily: "ui-monospace,monospace" }}>{fmt(it.cantidad).replace(/,00$/, "")}</span>
                  <span style={{ textAlign: "right", fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap", color: "#334155" }}>$ {fmt(it.unitario)}</span>
                  <b style={{ textAlign: "right", fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap" }}>$ {fmt(it.ars)}</b>
                </div>
              ))}
            </> : <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 7 }}>
              <span>Descripción</span><span>Importe</span>
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid #eef2f6", fontSize: 13.5, alignItems: "baseline" }}>
                <span style={{ fontWeight: 600 }}>{it.label}{Number(it.cantidad) > 0 && Number(it.unitario) > 0 && <span style={{ display: "block", fontSize: 11, color: "#64748b", fontWeight: 500, marginTop: 2 }}>{fmt(it.cantidad).replace(/,00$/, "")} × $ {fmt(it.unitario)}</span>}</span>
                <b style={{ fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap", fontSize: 14 }}>$ {fmt(it.ars)}</b>
              </div>
            ))}
            </>}
            {inv.actividad_desc && <p style={{ fontSize: 10.5, color: "#64748b", margin: "8px 0 0" }}>Actividad: {inv.actividad_desc}</p>}
            {!venta && mercaderias.length > 0 && <div style={{ marginTop: 12, padding: "10px 14px", background: "#f7f8fa", border: "1px solid #e2e8f0", borderRadius: 10, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", margin: "0 0 5px" }}>Detalle de mercaderías</p>
              {mercaderias.slice(0, 8).map((m, i) => <p key={i} title={m} style={{ fontSize: 11, color: "#334155", margin: "2px 0", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i + 1} - {m}</p>)}
              {mercaderias.length > 8 && <p style={{ fontSize: 10.5, color: "#64748b", margin: "4px 0 0", fontStyle: "italic" }}>… y {mercaderias.length - 8} ítem{mercaderias.length - 8 !== 1 ? "s" : ""} más ({mercaderias.length} en total). El detalle completo está en la operación.</p>}
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
              {qr ? <img src={qr} alt="QR ARCA" style={{ width: 96, height: 96 }} /> : <div style={{ width: 96, height: 96, border: "1.5px dashed #cbd5e1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>QR</div>}
              <p style={{ fontSize: 9.5, color: "#94a3b8", maxWidth: 130, lineHeight: 1.5, margin: 0 }}>{previa ? "El código QR aparece cuando se emite" : "Escaneá el código para verificar este comprobante en ARCA"}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>CAE N° <b style={{ fontFamily: "ui-monospace,monospace", color: "#111", fontSize: 13 }}>{previa ? "—" : inv.cae}</b></p>
              <p style={{ fontSize: 11, color: "#64748b", margin: "3px 0 0" }}>Vencimiento CAE: <b style={{ color: "#111" }}>{previa ? "—" : fmtFecha(inv.cae_vto)}</b></p>
              <p style={{ fontSize: 9.5, color: "#94a3b8", margin: "6px 0 0" }}>Comprobante autorizado por ARCA · argencargo.com.ar</p>
            </div>
          </div>
        </div>
      </div>
      <p className="fac-foot-url" style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 14 }}>argencargo.com.ar</p>
    </div>
  </div>;
}
