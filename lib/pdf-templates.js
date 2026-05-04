// PDF templates compartidos. Generan HTML que se abre en una pestaña nueva con auto-print.
// Estilo: navy/gold corporativo, logo Argencargo, info contacto en footer.
// Uso: import { printQuotePdf, printReceiptPdf, printClosingPdf } from "@/lib/pdf-templates";

const NAVY = "#1B4F8A";
const NAVY_DARK = "#152D54";
const GOLD = "#B8956A";
const GOLD_LIGHT = "#D4B17A";
const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png";
const LOGO_WHITE = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";

const usd = (n) => `USD ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(typeof d === "string" && d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }) : "—";
const fmtDateShort = (d) => d ? new Date(typeof d === "string" && d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const baseStyles = `
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4;margin:0}
  body{font-family:'Helvetica Neue',-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#1a1a1a;margin:0;padding:0;background:#fff;font-size:12px;line-height:1.5}
  .page{padding:32px 40px;max-width:794px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${NAVY};padding-bottom:18px;margin-bottom:22px}
  .header img{max-width:170px;height:auto}
  .header .meta{text-align:right;font-size:11px;color:#666;line-height:1.6}
  .header .meta .doc-type{display:inline-block;padding:5px 14px;background:${NAVY};color:#fff;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-radius:4px;margin-bottom:8px}
  .header .meta .code{color:${NAVY};font-size:14px;font-weight:700;font-family:'SF Mono','Courier New',monospace;display:block;margin-bottom:2px}
  h1{font-size:20px;margin:0 0 6px;color:${NAVY};font-weight:700;letter-spacing:-0.01em}
  .sub{color:#666;font-size:12px;margin-bottom:22px}
  .info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;padding:16px;background:#f5f7fa;border-radius:8px;border:1px solid #e5e7eb}
  .info-grid div{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.05em;font-weight:600}
  .info-grid b{font-size:13px;color:#111;display:block;margin-top:3px;text-transform:none;letter-spacing:0;font-weight:600}
  h3{margin:24px 0 8px;font-size:13px;color:${NAVY};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;padding-bottom:6px;border-bottom:1.5px solid ${GOLD}55}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
  th,td{padding:9px 11px;border-bottom:1px solid #e5e7eb;text-align:left}
  th{background:${NAVY};color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;font-weight:700}
  td.c{text-align:center}td.r{text-align:right}td.mono{font-family:'SF Mono','Courier New',monospace;font-size:10.5px}
  tr:nth-child(even) td{background:#fafbfc}
  .totals{margin-top:18px;padding:18px 22px;background:linear-gradient(135deg,${NAVY_DARK},${NAVY});color:#fff;border-radius:10px;box-shadow:0 4px 12px rgba(27,79,138,0.15)}
  .totals .row{display:flex;justify-content:space-between;padding:5px 0;font-size:12px}
  .totals .row.big{border-top:1px solid rgba(255,255,255,0.25);margin-top:8px;padding-top:12px;font-size:16px;font-weight:700}
  .totals .lbl{opacity:0.85}
  .badge{display:inline-block;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em}
  .badge-paid{background:#dcfce7;color:#166534;border:1px solid #86efac}
  .badge-pending{background:#fef3c7;color:#78350f;border:1px solid #fcd34d}
  .badge-info{background:#dbeafe;color:#1e3a8a;border:1px solid #93c5fd}
  .receipt-box{margin:24px 0;padding:24px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #22c55e;border-radius:12px;text-align:center}
  .receipt-box .label{font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}
  .receipt-box .amount{font-size:34px;font-weight:800;color:#166534;margin:4px 0;letter-spacing:-0.02em}
  .receipt-box .method{font-size:13px;color:#15803d;margin-top:6px}
  .footer{margin-top:auto;padding:18px 22px;background:${NAVY_DARK};color:#fff;border-radius:10px;display:flex;align-items:center;gap:18px}
  .footer img{max-width:75px;height:auto;filter:brightness(0) invert(1);opacity:0.9}
  .footer .info{font-size:10.5px;line-height:1.7;flex:1}
  .footer .info b{display:block;font-size:13px;letter-spacing:0.04em;margin-bottom:4px;color:#fff}
  .footer .lbl{color:#8ea3c4;margin-right:4px}
  .footer a{color:#8fb8ff;text-decoration:none}
  .disclaimer{margin-top:14px;font-size:9px;color:#999;line-height:1.5;text-align:center;padding:0 10px}
  .signature{margin-top:30px;padding-top:14px;border-top:1px solid #e5e7eb;display:flex;gap:40px}
  .signature .sig-block{flex:1;font-size:11px;color:#666}
  .signature .sig-line{border-top:1px solid #999;margin-top:48px;padding-top:6px}
  @media print{
    .page{padding:20px 28px;min-height:auto}
    body{font-size:11px}
  }
`;

const footerHtml = `
  <div class="footer">
    <img src="${LOGO_WHITE}" alt="Argencargo"/>
    <div class="info">
      <b>ARGENCARGO</b>
      <div><span class="lbl">T.</span>+54 9 11 2508-8580 · <span class="lbl">E:</span><a href="mailto:info@argencargo.com.ar">info@argencargo.com.ar</a></div>
      <div>Av Callao 1137 — Recoleta, CABA, Argentina · <a href="https://argencargo.com.ar">argencargo.com.ar</a></div>
    </div>
  </div>
`;

function openPrintWindow(title, html) {
  const w = window.open("", "_blank");
  if (!w) { alert("El navegador bloqueó la ventana de impresión. Permití pop-ups para este sitio."); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${baseStyles}</style></head><body>${html}<script>setTimeout(()=>window.print(),400);</script></body></html>`);
  w.document.close();
}

// ─────────────────────────────────────────────────────────
// 0bis. DECLARACIÓN SIMPLIFICADA DE IMPORTACIÓN (formato AFIP/courier)
// ─────────────────────────────────────────────────────────
// Replica visualmente la "Destinación Simplificada Courier de Importación" oficial
// (formato que emiten UPS, DHL, FedEx). Horizontal A4, estilo AFIP/ARCA.
// NO es documento fiscal real, es demostrativo para mostrar al cliente la composición tributaria.

const dsiStyles = `
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:0}
  @page{size:A4 landscape;margin:8mm}
  body{font-family:Arial,sans-serif;color:#000;font-size:8pt;line-height:1.3;background:#fff}
  .dsi-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2.5px solid #1B4F8A;padding-bottom:4mm;margin-bottom:3mm;background:linear-gradient(to right,#fff 0%,#fff 60%,#f0f4fa 100%)}
  .dsi-header-left{display:flex;align-items:center;gap:6mm}
  .dsi-header img{height:14mm}
  .dsi-arca{font-size:13pt;font-weight:800;color:#1B4F8A;letter-spacing:1px;line-height:1.2}
  .dsi-arca-sub{font-size:7pt;font-weight:600;color:#666;letter-spacing:0.5px}
  .dsi-title{font-size:14pt;font-weight:800;color:#1B4F8A;letter-spacing:0.5px;text-align:center;flex:1}
  .dsi-fecha{font-size:9pt;color:#444;text-align:right;font-weight:600;line-height:1.4}
  .dsi-row{display:flex;border-bottom:1px solid #d1d5db;background:#f0f4fa;padding:2mm 3mm;align-items:center;font-size:8pt}
  .dsi-row strong{color:#1B4F8A;margin-right:1mm}
  .dsi-section-title{background:#1B4F8A;color:#fff;font-weight:700;padding:1.5mm 3mm;font-size:8pt;letter-spacing:0.5px;text-transform:uppercase;margin-top:2mm}
  .dsi-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0;padding:2.5mm 3mm;background:#fafbfc;border-bottom:1px solid #e5e7eb}
  .dsi-grid-cell{padding:1mm 2mm;border-right:1px dashed #d1d5db}
  .dsi-grid-cell:last-child{border-right:none}
  .dsi-label{font-size:7pt;color:#666;font-weight:600;display:block;margin-bottom:0.5mm}
  .dsi-value{font-size:9pt;color:#000;font-weight:700}
  .dsi-merch-block{margin-top:2mm;border:1px solid #d1d5db;border-radius:3px;overflow:hidden}
  .dsi-merch-header{background:#e5e7eb;padding:1.5mm 3mm;font-size:8pt;font-weight:700;color:#1B4F8A;text-transform:uppercase;letter-spacing:0.5px}
  .dsi-merch-data{padding:2.5mm 3mm;display:grid;grid-template-columns:80px 1fr 60px 60px 80px 80px 80px;gap:2mm;font-size:8pt;align-items:center}
  .dsi-merch-data .col-label{font-size:6.5pt;color:#666;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;margin-bottom:1mm}
  .dsi-merch-data .col-val{font-size:9pt;font-weight:700;color:#000}
  .dsi-liq-table{width:100%;border-collapse:collapse;margin-top:1mm;background:#fafbfc}
  .dsi-liq-table th,.dsi-liq-table td{padding:1mm 3mm;text-align:right;font-size:7.5pt;border-bottom:1px dashed #e5e7eb}
  .dsi-liq-table th{background:#1B4F8A;color:#fff;font-size:7pt;text-transform:uppercase;font-weight:700;text-align:center;letter-spacing:0.4px}
  .dsi-liq-table td:first-child{text-align:left;color:#666;font-weight:600;width:60%}
  .dsi-liq-table tr.total td{background:#1B4F8A;color:#fff;font-weight:800;font-size:8.5pt}
  .dsi-footer{margin-top:4mm;padding:3mm 4mm;background:#1B4F8A;color:#fff;border-radius:4px;font-size:7pt;display:flex;justify-content:space-between;align-items:center;line-height:1.5}
  .dsi-disclaimer{margin-top:2mm;padding:2mm 3mm;background:#fef3c7;border-left:3px solid #f59e0b;font-size:7pt;color:#78350f;line-height:1.5;border-radius:2px}
  .dsi-grand-total{margin-top:2mm;background:#1B4F8A;color:#fff;padding:3mm 4mm;border-radius:3px;display:flex;justify-content:space-between;align-items:center;font-size:11pt;font-weight:800}
`;

const conceptoLabels = {
  "010": "DERECHOS DE IMPORTACION",
  "011": "TASA DE ESTADISTICA",
  "415": "IVA",
  "416": "IVA ADICIONAL",
  "417": "IMPUESTO A LAS GANANCIAS",
  "418": "INGRESOS BRUTOS",
};

export function printSimplifiedDeclaration({ op, items = [], pkgs = [], client }) {
  const totFob = items.reduce((s, it) => s + Number(it.unit_price_usd || 0) * Number(it.quantity || 1), 0);
  const totGw = pkgs.reduce((s, p) => s + Number(p.gross_weight_kg || 0) * Number(p.quantity || 1), 0);
  const totBultos = pkgs.reduce((s, p) => s + Number(p.quantity || 1), 0);
  const today = new Date();
  const dateShort = today.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeShort = today.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

  // Generar IDs estilo AFIP
  const yy = String(today.getFullYear()).slice(2);
  const julian = String(Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)).padStart(3, "0");
  const rand = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
  const idParticular = `${yy}${julian}PART${rand}H`;
  const idLiquidacion = `${yy}${julian}LMAN${rand.slice(0, 6)}B`;
  const idManifiesto = `${yy}${julian}MANI${rand.slice(0, 6)}M`;
  const docTransporte = op.international_tracking || `40${rand.slice(0, 9)}`;

  // CIF: FOB + 10% flete + 1% seguro
  const fleteEst = totFob * 0.10;
  const seguroEst = (totFob + fleteEst) * 0.01;
  const cifTotal = totFob + fleteEst + seguroEst;
  const totalConceptos = items.length || 1;

  // Por item: bloque mercadería + tabla liquidaciones
  const merchBlocks = items.map((it, idx) => {
    const fob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1);
    const pct = totFob > 0 ? fob / totFob : 1 / totalConceptos;
    const itCif = cifTotal * pct;
    const dr = Number(it.import_duty_rate ?? 0) / 100;
    const te = Number(it.statistics_rate ?? 0) / 100;
    const ivaR = Number(it.iva_rate ?? 21) / 100;
    const derechos = itCif * dr;
    const tasa = itCif * te;
    const baseImp = itCif + derechos + tasa;
    const iva = baseImp * ivaR;
    const ncm = it.ncm_code || "—";
    const desc = (it.description || "Mercadería").toUpperCase().slice(0, 40);
    const liqRows = [
      { codigo: "010", concepto: conceptoLabels["010"], alic: (dr * 100).toFixed(2), monto: derechos },
      { codigo: "011", concepto: conceptoLabels["011"], alic: (te * 100).toFixed(2), monto: tasa },
      { codigo: "415", concepto: conceptoLabels["415"], alic: (ivaR * 100).toFixed(0), monto: iva },
    ];
    const totalLiq = derechos + tasa + iva;
    return `<div class="dsi-merch-block">
      <div class="dsi-merch-header">Mercadería ${idx + 1} de ${items.length}</div>
      <div class="dsi-merch-data">
        <div><div class="col-label">Pos. Aranc.</div><div class="col-val" style="font-family:'SF Mono',monospace">${ncm}</div></div>
        <div><div class="col-label">Desc. Mercadería</div><div class="col-val">${desc}</div></div>
        <div><div class="col-label">Unidad</div><div class="col-val">07-1</div></div>
        <div><div class="col-label">Cantidad</div><div class="col-val">${it.quantity || 1}</div></div>
        <div><div class="col-label">FOB x PA</div><div class="col-val">${fob.toFixed(2)}</div></div>
        <div><div class="col-label">Base Imponible</div><div class="col-val">${baseImp.toFixed(2)}</div></div>
        <div><div class="col-label">CIF Proporcional</div><div class="col-val">${itCif.toFixed(2)}</div></div>
      </div>
      <table class="dsi-liq-table">
        <thead><tr><th style="width:60%;text-align:left">Concepto</th><th>Alícuota</th><th>Monto USD</th></tr></thead>
        <tbody>
          ${liqRows.map(l => `<tr><td>${l.codigo} - ${l.concepto}</td><td style="text-align:center">${l.alic}%</td><td>${l.monto.toFixed(2)}</td></tr>`).join("")}
          <tr class="total"><td>TOTAL TRIBUTOS DE ESTA MERCADERÍA</td><td></td><td>USD ${totalLiq.toFixed(2)}</td></tr>
        </tbody>
      </table>
    </div>`;
  }).join("");

  const totDerechos = items.reduce((s, it) => { const fob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1); const pct = totFob > 0 ? fob / totFob : 0; return s + cifTotal * pct * (Number(it.import_duty_rate ?? 0) / 100); }, 0);
  const totTasa = items.reduce((s, it) => { const fob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1); const pct = totFob > 0 ? fob / totFob : 0; return s + cifTotal * pct * (Number(it.statistics_rate ?? 0) / 100); }, 0);
  const totIva = items.reduce((s, it) => { const fob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1); const pct = totFob > 0 ? fob / totFob : 0; const itCif = cifTotal * pct; const dr = Number(it.import_duty_rate ?? 0) / 100; const te = Number(it.statistics_rate ?? 0) / 100; const ivaR = Number(it.iva_rate ?? 21) / 100; return s + (itCif + itCif * dr + itCif * te) * ivaR; }, 0);
  const totalGral = totDerechos + totTasa + totIva;

  const cliName = `${(client?.first_name || "").toUpperCase()} ${(client?.last_name || "").toUpperCase()}`.trim() || "—";
  const cliDoc = client?.cuit ? `CUIT-${client.cuit}` : (client?.dni ? `DNI-${client.dni}` : "CONSUMIDOR FINAL");
  const cliAddr = `${client?.street || ""}${client?.floor_apt ? " " + client.floor_apt : ""}`.trim() || "—";
  const cliCity = (client?.city || "—").toUpperCase();
  const cliProv = (client?.province || "BUENOS AIRES").toUpperCase();
  const origenCountry = op.origin === "USA" ? "US-ESTADOS UNIDOS" : op.origin === "España" ? "ES-ESPAÑA" : "CN-CHINA";
  const aduana = op.origin === "USA" ? "073-EZEIZA" : op.origin === "España" ? "073-EZEIZA" : "073-EZEIZA";

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>DSI ${op.operation_code}</title><style>${dsiStyles}</style></head><body>
    <div class="dsi-header">
      <div class="dsi-header-left">
        <img src="${LOGO}" alt="Argencargo"/>
        <div>
          <div class="dsi-arca">ARCA</div>
          <div class="dsi-arca-sub">Agencia de Recaudación<br/>y Control Aduanero</div>
        </div>
      </div>
      <div class="dsi-title">DESTINACIÓN SIMPLIFICADA DE IMPORTACIÓN</div>
      <div class="dsi-fecha">${dateShort}<br/>${timeShort}</div>
    </div>

    <div class="dsi-row">
      <strong>COURIER:</strong> 30700940957 (ARGENCARGO IMPORTACIONES SRL)
      <span style="margin:0 6mm;color:#9ca3af">|</span>
      <strong>IDENTIFICADOR PARTICULAR:</strong> ${idParticular}
    </div>

    <div class="dsi-section-title">Datos Generales de la Particular</div>
    <div class="dsi-grid">
      <div class="dsi-grid-cell"><span class="dsi-label">Id. Particular / Liquidación</span><span class="dsi-value" style="font-family:'SF Mono',monospace;font-size:7.5pt">${idParticular} / ${idLiquidacion}</span></div>
      <div class="dsi-grid-cell"><span class="dsi-label">Registrado</span><span class="dsi-value">${dateShort}</span></div>
      <div class="dsi-grid-cell"><span class="dsi-label">Aduana</span><span class="dsi-value">${aduana}</span></div>
      <div class="dsi-grid-cell"><span class="dsi-label">Id. Manifiesto</span><span class="dsi-value" style="font-family:'SF Mono',monospace;font-size:8pt">${idManifiesto}</span></div>
    </div>

    <div class="dsi-section-title">Datos del Envío</div>
    <div class="dsi-grid" style="grid-template-columns:1.5fr 1fr 0.7fr 0.7fr 1fr 1fr">
      <div class="dsi-grid-cell"><span class="dsi-label">Doc. Transporte</span><span class="dsi-value" style="font-family:'SF Mono',monospace">${docTransporte}</span></div>
      <div class="dsi-grid-cell"><span class="dsi-label">Tipo Envío</span><span class="dsi-value">COMERCIAL</span></div>
      <div class="dsi-grid-cell"><span class="dsi-label">Bultos</span><span class="dsi-value">${totBultos}</span></div>
      <div class="dsi-grid-cell"><span class="dsi-label">Peso Bruto</span><span class="dsi-value">${totGw.toFixed(2)} kg</span></div>
      <div class="dsi-grid-cell"><span class="dsi-label">País Procedencia</span><span class="dsi-value" style="font-size:8pt">${origenCountry}</span></div>
      <div class="dsi-grid-cell"><span class="dsi-label">Monto FOB Envío</span><span class="dsi-value">USD ${totFob.toFixed(2)}</span></div>
    </div>

    <div class="dsi-grid" style="grid-template-columns:2fr 2fr 1fr">
      <div class="dsi-grid-cell">
        <span class="dsi-label">Destinatario</span>
        <span class="dsi-value">${cliName}</span>
        <div style="font-size:7pt;color:#666;margin-top:1mm">${cliDoc}</div>
      </div>
      <div class="dsi-grid-cell">
        <span class="dsi-label">Domicilio Destinatario</span>
        <span class="dsi-value" style="font-size:8pt">${cliAddr}</span>
        <div style="font-size:7pt;color:#666;margin-top:1mm">${cliCity} - ${cliProv}</div>
      </div>
      <div class="dsi-grid-cell">
        <span class="dsi-label">Monto Flete / Seguro</span>
        <div style="font-size:8pt"><strong>Flete:</strong> USD ${fleteEst.toFixed(2)}</div>
        <div style="font-size:8pt"><strong>Seguro:</strong> USD ${seguroEst.toFixed(2)}</div>
        <div style="font-size:9pt;color:#1B4F8A;font-weight:800;margin-top:1mm">CIF: USD ${cifTotal.toFixed(2)}</div>
      </div>
    </div>

    ${merchBlocks || `<div style="padding:8mm;text-align:center;color:#999;font-style:italic;font-size:9pt">Sin items declarados</div>`}

    <div class="dsi-grand-total">
      <span>TOTAL TRIBUTOS A ABONAR</span>
      <span>USD ${totalGral.toFixed(2)}</span>
    </div>

    <div class="dsi-disclaimer">
      <strong>NOTA INFORMATIVA:</strong> Documento informativo emitido por Argencargo en formato simulado de Destinación Simplificada Courier (RG AFIP 2.999/2010). Los valores reflejan la composición tributaria estimada del envío. Los importes oficiales son liquidados al momento del despacho aduanero por el despachante actuante en función del tipo de cambio oficial vigente.
    </div>

    <div class="dsi-footer">
      <div><strong>ARGENCARGO IMPORTACIONES</strong> · Av. Callao 1137, Recoleta CABA · +54 9 11 2508-8580 · info@argencargo.com.ar</div>
      <div>Operación ${op.operation_code} · Generado ${dateShort} ${timeShort}</div>
    </div>

    <script>setTimeout(()=>window.print(),500);</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("El navegador bloqueó la ventana. Permití pop-ups."); return; }
  w.document.write(html);
  w.document.close();
}

// ─────────────────────────────────────────────────────────
// 0. ETIQUETAS DE PAQUETES (100x150mm — formato shipping label)
// ─────────────────────────────────────────────────────────
// Imprime una etiqueta por bulto en la op. Branding Argencargo + peso destacado + QR
// que linkea a /track/AC-XXXX. Pensado para impresora térmica o A4 con corte.

const labelStyles = `
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:0}
  @page{size:100mm 150mm;margin:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#000}
  .label{width:100mm;height:150mm;padding:5mm;display:flex;flex-direction:column;page-break-after:always;border:1px dashed #ddd}
  .label:last-child{page-break-after:auto}
  .lbl-logo{display:flex;justify-content:center;border-bottom:2px solid ${NAVY};padding-bottom:3mm;margin-bottom:3mm}
  .lbl-logo img{height:18mm;max-width:80mm;object-fit:contain}
  .lbl-code{font-family:'SF Mono','Courier New',monospace;font-size:20pt;font-weight:800;color:${NAVY};letter-spacing:1px;text-align:center;margin-bottom:1mm}
  .lbl-cli{font-size:10pt;color:#444;margin-bottom:3mm;font-weight:700;text-align:center}
  .lbl-bulto-num{display:block;padding:2mm 4mm;background:${GOLD};color:#fff;font-size:10pt;font-weight:800;border-radius:3px;letter-spacing:1px;margin-bottom:3mm;text-align:center}
  .lbl-peso-box{background:#f5f7fa;border:1.5px solid ${NAVY};border-radius:6px;padding:3mm;text-align:center;margin-bottom:2.5mm}
  .lbl-peso-label{font-size:7pt;color:#666;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:1mm;font-weight:700}
  .lbl-peso-val{font-size:22pt;font-weight:800;color:${NAVY};letter-spacing:-0.5px;line-height:1}
  .lbl-peso-fact{font-size:9pt;color:${GOLD};margin-top:1.5mm;font-weight:700}
  .lbl-peso-detail{font-size:7pt;color:#888;margin-top:1mm}
  .lbl-totales{display:flex;gap:3mm;margin-bottom:3mm;padding:2.5mm;background:#fafbfc;border-radius:4px;border:1px solid #e5e7eb}
  .lbl-totales > div{flex:1;text-align:center}
  .lbl-totales .label{font-size:7pt;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:1mm}
  .lbl-totales .val{font-size:11pt;font-weight:800;color:${NAVY}}
  .lbl-bottom{margin-top:auto;display:flex;align-items:center;gap:3mm;border-top:1.5px solid #e5e7eb;padding-top:3mm}
  .lbl-qr{width:22mm;height:22mm;flex-shrink:0}
  .lbl-qr img{width:100%;height:100%}
  .lbl-bottom-info{flex:1;font-size:8pt;color:${NAVY};line-height:1.4;font-weight:700}
  .lbl-bottom-info b{color:${NAVY};font-size:9pt;display:block;margin-bottom:1mm;letter-spacing:0.5px}
  .lbl-barcode{margin-top:2mm;text-align:center}
  .lbl-barcode img{height:10mm;width:auto;max-width:100%}
  .lbl-barcode-text{font-family:'SF Mono','Courier New',monospace;font-size:7pt;color:#444;letter-spacing:1px;margin-top:0.5mm}
  @media print{.label{border:none}}
`;

function qrUrl(text, size = 200) {
  // QR generado por API pública gratuita (sin dependencias)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&margin=0&data=${encodeURIComponent(text)}`;
}

// Genera código de barras Code128 escaneable via API pública (sin deps)
// Compatible con scanners industriales y apps de smartphone
function barcodeUrl(text, height = 30) {
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(text)}&code=Code128&dpi=96&imagetype=Png&translate-esc=on&height=${height}&modulewidth=fit`;
}

export function printPackageLabels({ op, packages = [], items = [], client, baseUrl = "https://www.argencargo.com.ar" }) {
  if (!packages || packages.length === 0) {
    alert("Esta operación no tiene bultos cargados.");
    return;
  }
  const trackUrl = `${baseUrl}/track/${op.operation_code}`;
  // Detectar tipo de envío: aéreo A (canal A blanco), aéreo B (negro), marítimo
  const isMaritimo = op.channel?.includes("maritimo");
  const isAereoA = op.channel === "aereo_blanco";
  const isAereoB = op.channel === "aereo_negro";

  // Calcular totales de toda la carga
  let totalBultos = 0, totalGw = 0, totalCbm = 0, totalFacturable = 0;
  packages.forEach(pk => {
    const q = Number(pk.quantity || 1);
    const gw = Number(pk.gross_weight_kg || 0);
    const l = Number(pk.length_cm || 0), w = Number(pk.width_cm || 0), h = Number(pk.height_cm || 0);
    totalBultos += q;
    totalGw += gw * q;
    if (l && w && h) totalCbm += ((l * w * h) / 1000000) * q;
    // Peso facturable = max(bruto, volumétrico) por bulto
    const vol = l && w && h ? ((l * w * h) / 5000) * q : 0;
    totalFacturable += Math.max(gw * q, vol);
  });

  const labels = packages.map((pk, idx) => {
    const q = Number(pk.quantity || 1);
    const gw = Number(pk.gross_weight_kg || 0);
    const l = Number(pk.length_cm || 0), w = Number(pk.width_cm || 0), h = Number(pk.height_cm || 0);
    const dims = l && w && h ? `${l}×${w}×${h} cm` : null;
    const cbmU = l && w && h ? ((l * w * h) / 1000000) * q : 0;
    const volU = l && w && h ? ((l * w * h) / 5000) * q : 0;
    const factU = Math.max(gw * q, volU);

    // Bloque principal según canal
    let mainBox;
    if (isMaritimo) {
      // Marítimo: mostrar CBM
      mainBox = `<div class="lbl-peso-box">
        <div class="lbl-peso-label">Volumen (CBM)</div>
        <div class="lbl-peso-val">${cbmU > 0 ? `${cbmU.toFixed(4)} m³` : "—"}</div>
        ${dims ? `<div class="lbl-peso-detail">${dims} · ${(gw * q).toFixed(2)} kg</div>` : ""}
      </div>`;
    } else if (isAereoA) {
      // Aéreo A: peso facturable + bruto
      mainBox = `<div class="lbl-peso-box">
        <div class="lbl-peso-label">Peso bruto</div>
        <div class="lbl-peso-val">${gw > 0 ? `${(gw * q).toFixed(2)} kg` : "—"}</div>
        ${factU > 0 ? `<div class="lbl-peso-fact">⚡ Facturable: ${factU.toFixed(2)} kg</div>` : ""}
        ${dims ? `<div class="lbl-peso-detail">${dims}</div>` : ""}
      </div>`;
    } else {
      // Aéreo B (default): solo peso bruto
      mainBox = `<div class="lbl-peso-box">
        <div class="lbl-peso-label">Peso bruto</div>
        <div class="lbl-peso-val">${gw > 0 ? `${(gw * q).toFixed(2)} kg` : "—"}</div>
        ${dims ? `<div class="lbl-peso-detail">${dims}</div>` : ""}
      </div>`;
    }

    // Totales de la carga (varía según canal)
    let totalLabel, totalValue;
    if (isMaritimo) {
      totalLabel = "Volumen total"; totalValue = `${totalCbm.toFixed(4)} m³`;
    } else if (isAereoA) {
      totalLabel = "Peso facturable total"; totalValue = `${totalFacturable.toFixed(2)} kg`;
    } else {
      totalLabel = "Peso bruto total"; totalValue = `${totalGw.toFixed(2)} kg`;
    }

    // Código de barras: usar operation_code (ej: "AC-0019") — escaneable como Code128
    const barcodeData = op.operation_code;

    return `<div class="label">
      <div class="lbl-logo"><img src="${LOGO}" alt="Argencargo"/></div>

      <div class="lbl-code">${op.operation_code}</div>
      <div class="lbl-cli">${client?.client_code || "—"} · ${client?.first_name || ""} ${client?.last_name || ""}</div>

      <div class="lbl-bulto-num">📦 BULTO ${pk.package_number || idx + 1} de ${packages.length}${q > 1 ? ` · CONTIENE ${q}` : ""}</div>

      ${mainBox}

      <div class="lbl-totales">
        <div>
          <div class="label">Total bultos</div>
          <div class="val">${totalBultos}</div>
        </div>
        <div>
          <div class="label">${totalLabel}</div>
          <div class="val">${totalValue}</div>
        </div>
      </div>

      <div class="lbl-bottom">
        <div class="lbl-qr"><img src="${qrUrl(trackUrl, 200)}" alt="QR"/></div>
        <div class="lbl-bottom-info">
          <b>Detalle OP</b>
          <div class="lbl-barcode"><img src="${barcodeUrl(barcodeData, 30)}" alt="Código de barras"/></div>
          <div class="lbl-barcode-text">${barcodeData}</div>
        </div>
      </div>
    </div>`;
  }).join("");

  const w = window.open("", "_blank");
  if (!w) { alert("El navegador bloqueó la ventana de impresión. Permití pop-ups."); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${op.operation_code}</title><style>${labelStyles}</style></head><body>${labels}<script>setTimeout(()=>window.print(),900);</script></body></html>`);
  w.document.close();
}

// ─────────────────────────────────────────────────────────
// 1. PRESUPUESTO
// ─────────────────────────────────────────────────────────
export function printQuotePdf({ op, items = [], pkgs = [], payments = [], cliPmts = [] }) {
  const isB = op.channel?.includes("negro");
  const chLbl = ({ aereo_blanco: "Aéreo Courier Comercial", aereo_negro: "Aéreo Integral AC", maritimo_blanco: "Marítimo Carga LCL/FCL", maritimo_negro: "Marítimo Integral AC" })[op.channel] || op.channel;
  const totFob = items.reduce((s, it) => s + Number(it.unit_price_usd || 0) * Number(it.quantity || 1), 0);
  const bt = Number(op.budget_total || 0);
  const bTax = Number(op.budget_taxes || 0);
  const bFlete = Number(op.budget_flete || 0);
  const bSeg = Number(op.budget_seguro || 0);
  const shipC = op.shipping_to_door ? Number(op.shipping_cost || 0) : 0;
  const pmtTotal = payments.reduce((s, p) => s + Number(p.client_amount_usd || 0), 0);
  const pmtAnt = Number(op.total_anticipos || 0);
  const pmtPend = Math.max(0, pmtTotal - pmtAnt);
  const totalAbonar = bt + pmtPend;
  const cliPaid = cliPmts.reduce((s, p) => s + Number(p.amount_usd || 0), 0);
  const saldoReal = Math.max(0, totalAbonar - cliPaid);

  const prodRows = items.map(it => {
    const fob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1);
    return `<tr><td>${it.description || ""}</td><td class="c">${it.quantity || 1}</td><td class="r">${usd(it.unit_price_usd)}</td><td class="r">${usd(fob)}</td>${!isB ? `<td class="c mono">${it.ncm_code || "—"}</td><td class="c">${Number(it.import_duty_rate || 0)}%</td><td class="c">${Number(it.statistics_rate || 0)}%</td><td class="c">${Number(it.iva_rate || 21)}%</td>` : ""}</tr>`;
  }).join("");

  const pkgRows = pkgs.map((p, i) => {
    const q = Number(p.quantity || 1), gw = Number(p.gross_weight_kg || 0), l = Number(p.length_cm || 0), wd = Number(p.width_cm || 0), h = Number(p.height_cm || 0);
    const cbm = l && wd && h ? ((l * wd * h) / 1000000) * q : 0;
    return `<tr><td class="c">${i + 1}</td><td class="c">${q}</td><td class="c">${l ? `${l}×${wd}×${h} cm` : "—"}</td><td class="r">${gw ? `${gw.toFixed(2)} kg` : "—"}</td><td class="r">${cbm ? cbm.toFixed(4) + " m³" : "—"}</td></tr>`;
  }).join("");

  const pagosRows = cliPmts.map(p => `<tr><td>${fmtDateShort(p.payment_date)}</td><td class="r">${usd(p.amount_usd)}${p.currency === "ARS" ? `<br/><span style="font-size:9px;color:#666">ARS ${Number(p.amount_ars || 0).toLocaleString("es-AR")} @ ${p.exchange_rate}</span>` : ""}</td><td>${p.payment_method || "—"}</td><td>${p.notes || "—"}</td></tr>`).join("");

  const statusLbl = { pendiente: "Pendiente", en_deposito_origen: "En depósito origen", en_preparacion: "En preparación", en_transito: "En tránsito", arribo_argentina: "Arribó a Argentina", en_aduana: "En aduana", entregada: "Lista para retirar", operacion_cerrada: "Operación cerrada", cancelada: "Cancelada" }[op.status] || op.status;

  const html = `<div class="page">
    <div class="header">
      <img src="${LOGO}" alt="Argencargo"/>
      <div class="meta">
        <span class="doc-type">Presupuesto</span>
        <span class="code">${op.operation_code}</span>
        <div>Emitido ${fmtDate(new Date())}</div>
        <div>Estado: <strong>${statusLbl}</strong></div>
      </div>
    </div>

    <h1>Presupuesto de importación</h1>
    <p class="sub">Detalle completo de costos para tu operación de importación.</p>

    <div class="info-grid">
      <div>Mercadería<b>${op.description || "—"}</b></div>
      <div>Canal<b>${chLbl}</b></div>
      <div>Origen<b>${op.origin || "—"}</b></div>
      <div>Estado<b>${statusLbl}</b></div>
    </div>

    ${items.length > 0 ? `<h3>Productos declarados</h3>
    <table><thead><tr><th>Descripción</th><th>Cant</th><th>Unit.</th><th>FOB</th>${!isB ? "<th>NCM</th><th>Derechos</th><th>TE</th><th>IVA</th>" : ""}</tr></thead><tbody>${prodRows}</tbody></table>
    <div style="text-align:right;font-size:11px;color:#666;margin-top:8px">Valor FOB total: <b style="color:#111;font-size:13px">${usd(totFob)}</b></div>` : ""}

    ${pkgs.length > 0 ? `<h3>Bultos</h3>
    <table><thead><tr><th class="c">#</th><th class="c">Cant</th><th class="c">Dimensiones</th><th class="r">Peso</th><th class="r">CBM</th></tr></thead><tbody>${pkgRows}</tbody></table>` : ""}

    <h3>Detalle de costos</h3>
    <div class="totals">
      ${!isB && bTax > 0 ? `<div class="row"><span class="lbl">Total Impuestos</span><span>${usd(bTax)}</span></div>` : ""}
      ${bFlete > 0 ? `<div class="row"><span class="lbl">${isB ? "Servicio Integral ARGENCARGO" : "Flete internacional"}</span><span>${usd(bFlete)}</span></div>` : ""}
      ${!isB && bSeg > 0 ? `<div class="row"><span class="lbl">Seguro de carga</span><span>${usd(bSeg)}</span></div>` : ""}
      ${shipC > 0 ? `<div class="row"><span class="lbl">Envío a domicilio</span><span>${usd(shipC)}</span></div>` : ""}
      ${pmtTotal > 0 ? `<div class="row"><span class="lbl">Gestión de pagos (saldo pendiente)</span><span>${usd(pmtPend)}</span></div>` : ""}
      <div class="row big"><span>TOTAL A ABONAR</span><span>${usd(totalAbonar)}</span></div>
      ${cliPaid > 0 ? `<div class="row" style="margin-top:8px"><span class="lbl">Ya pagado</span><span>${usd(cliPaid)}</span></div><div class="row" style="font-weight:700"><span>Saldo</span><span>${saldoReal > 0.01 ? usd(saldoReal) : "PAGADO EN SU TOTALIDAD ✓"}</span></div>` : ""}
    </div>

    ${cliPmts.length > 0 ? `<h3>Pagos realizados</h3>
    <table><thead><tr><th>Fecha</th><th class="r">Monto</th><th>Método</th><th>Detalle</th></tr></thead><tbody>${pagosRows}</tbody></table>` : ""}

    ${footerHtml}
    <div class="disclaimer">Este presupuesto incluye flete internacional, seguro y gestión aduanera${shipC > 0 ? ", más envío a domicilio" : ""}. Los valores pueden variar según tipo de cambio, volumen final despachado y gastos documentales reales al momento del cierre de la operación.</div>
  </div>`;

  openPrintWindow(`Presupuesto ${op.operation_code}`, html);
}

// ─────────────────────────────────────────────────────────
// 2. RECIBO DE PAGO
// ─────────────────────────────────────────────────────────
export function printReceiptPdf({ op, payment, client }) {
  const amount = Number(payment.amount_usd || 0);
  const isArs = payment.currency === "ARS";
  const arsLine = isArs ? `<div style="font-size:13px;color:#15803d;margin-top:4px">Equivalente: ARS ${Number(payment.amount_ars || 0).toLocaleString("es-AR")} @ ${payment.exchange_rate}</div>` : "";
  const receiptNum = `R-${op.operation_code}-${(payment.id || "").slice(0, 8).toUpperCase()}`;

  const html = `<div class="page">
    <div class="header">
      <img src="${LOGO}" alt="Argencargo"/>
      <div class="meta">
        <span class="doc-type">Recibo de pago</span>
        <span class="code">${receiptNum}</span>
        <div>Emitido ${fmtDate(new Date())}</div>
      </div>
    </div>

    <h1>Comprobante de pago recibido</h1>
    <p class="sub">Confirmación de cobro registrado en el sistema.</p>

    <div class="info-grid">
      <div>Operación<b>${op.operation_code}</b></div>
      <div>Cliente<b>${client?.client_code || "—"}</b></div>
      <div>Nombre<b>${client?.first_name || ""} ${client?.last_name || ""}</b></div>
      <div>Fecha de cobro<b>${fmtDate(payment.payment_date)}</b></div>
    </div>

    <div class="receipt-box">
      <div class="label">Monto recibido</div>
      <div class="amount">${usd(amount)}</div>
      <div class="method">Método: <strong>${(payment.payment_method || "—").replace(/_/g, " ")}</strong></div>
      ${arsLine}
    </div>

    ${payment.notes ? `<h3>Detalle</h3>
    <p style="font-size:12px;color:#374151;padding:14px;background:#f5f7fa;border-radius:6px;border-left:3px solid ${GOLD}">${payment.notes}</p>` : ""}

    <h3>Sobre la operación</h3>
    <table><tbody>
      <tr><td style="width:35%;color:#6b7280;font-weight:600">Mercadería</td><td>${op.description || "—"}</td></tr>
      <tr><td style="color:#6b7280;font-weight:600">Origen</td><td>${op.origin || "—"}</td></tr>
      <tr><td style="color:#6b7280;font-weight:600">Presupuesto total</td><td><strong>${usd(op.budget_total)}</strong></td></tr>
      <tr><td style="color:#6b7280;font-weight:600">Total cobrado a la fecha</td><td><strong>${usd(op.collected_amount)}</strong></td></tr>
    </tbody></table>

    <div class="signature">
      <div class="sig-block">
        <div class="sig-line">Cliente</div>
      </div>
      <div class="sig-block">
        <div class="sig-line">Argencargo</div>
      </div>
    </div>

    ${footerHtml}
    <div class="disclaimer">Este comprobante acredita la recepción del pago indicado. Conservar para futuras consultas.</div>
  </div>`;

  openPrintWindow(`Recibo ${op.operation_code}`, html);
}

// ─────────────────────────────────────────────────────────
// 3. RESUMEN FINAL / CIERRE
// ─────────────────────────────────────────────────────────
export function printClosingPdf({ op, items = [], pkgs = [], cliPmts = [], events = [] }) {
  const chLbl = ({ aereo_blanco: "Aéreo Courier Comercial", aereo_negro: "Aéreo Integral AC", maritimo_blanco: "Marítimo Carga LCL/FCL", maritimo_negro: "Marítimo Integral AC" })[op.channel] || op.channel;
  const cliPaid = cliPmts.reduce((s, p) => s + Number(p.amount_usd || 0), 0);
  const totFob = items.reduce((s, it) => s + Number(it.unit_price_usd || 0) * Number(it.quantity || 1), 0);
  const totGW = pkgs.reduce((s, p) => s + Number(p.gross_weight_kg || 0) * Number(p.quantity || 1), 0);
  const totCBM = pkgs.reduce((s, p) => { const q = Number(p.quantity || 1), l = Number(p.length_cm || 0), w = Number(p.width_cm || 0), h = Number(p.height_cm || 0); return s + (l && w && h ? ((l * w * h) / 1000000) * q : 0); }, 0);
  const totBultos = pkgs.reduce((s, p) => s + Number(p.quantity || 1), 0);

  const itemsRows = items.map(it => `<tr><td>${it.description || ""}</td><td class="c">${it.quantity || 1}</td><td class="r">${usd(Number(it.unit_price_usd) * Number(it.quantity || 1))}</td></tr>`).join("");
  const pagosRows = cliPmts.map(p => `<tr><td>${fmtDateShort(p.payment_date)}</td><td>${(p.payment_method || "—").replace(/_/g, " ")}</td><td class="r">${usd(p.amount_usd)}</td></tr>`).join("");

  // Hitos clave del timeline
  const carrierEvents = events.filter(e => e.source !== "internal" && !String(e.description || "").toLowerCase().includes("customs clearance status updated") && String(e.title || "").trim() !== "SD");
  const milestones = [
    op.created_at ? { l: "Operación creada", d: op.created_at } : null,
    op.consolidation_confirmed_at ? { l: "Carga confirmada en depósito", d: op.consolidation_confirmed_at } : null,
    carrierEvents.length > 0 ? { l: "Despacho internacional", d: carrierEvents[carrierEvents.length - 1].occurred_at } : null,
    op.arrived_in_argentina_at ? { l: "Arribo a Argentina", d: op.arrived_in_argentina_at } : null,
    op.delivered_at ? { l: "Entrega al cliente", d: op.delivered_at } : null,
    op.closed_at ? { l: "Operación cerrada", d: op.closed_at } : null,
  ].filter(Boolean);
  const timelineRows = milestones.map(m => `<tr><td style="width:35%;color:#6b7280;font-weight:600">${m.l}</td><td>${fmtDate(m.d)}</td></tr>`).join("");

  const html = `<div class="page">
    <div class="header">
      <img src="${LOGO}" alt="Argencargo"/>
      <div class="meta">
        <span class="doc-type">Resumen Final</span>
        <span class="code">${op.operation_code}</span>
        <div>Emitido ${fmtDate(new Date())}</div>
        <div><span class="badge badge-paid">✓ Operación cerrada</span></div>
      </div>
    </div>

    <h1>Resumen final de operación</h1>
    <p class="sub">Detalle completo de tu importación, desde la creación hasta la entrega.</p>

    <div class="info-grid">
      <div>Mercadería<b>${op.description || "—"}</b></div>
      <div>Canal<b>${chLbl}</b></div>
      <div>Origen<b>${op.origin || "—"}</b></div>
      <div>Total cobrado<b>${usd(cliPaid)}</b></div>
    </div>

    <h3>Resumen de la carga</h3>
    <table><tbody>
      <tr><td style="width:50%;color:#6b7280;font-weight:600">Cantidad de bultos</td><td><strong>${totBultos}</strong></td></tr>
      <tr><td style="color:#6b7280;font-weight:600">Peso bruto total</td><td><strong>${totGW.toFixed(2)} kg</strong></td></tr>
      <tr><td style="color:#6b7280;font-weight:600">Volumen total (CBM)</td><td><strong>${totCBM.toFixed(4)} m³</strong></td></tr>
      ${totFob > 0 ? `<tr><td style="color:#6b7280;font-weight:600">Valor FOB de mercadería</td><td><strong>${usd(totFob)}</strong></td></tr>` : ""}
    </tbody></table>

    ${milestones.length > 0 ? `<h3>Línea de tiempo</h3>
    <table><tbody>${timelineRows}</tbody></table>` : ""}

    ${items.length > 0 ? `<h3>Productos</h3>
    <table><thead><tr><th>Descripción</th><th class="c">Cant</th><th class="r">Subtotal</th></tr></thead><tbody>${itemsRows}</tbody></table>` : ""}

    ${cliPmts.length > 0 ? `<h3>Pagos realizados</h3>
    <table><thead><tr><th>Fecha</th><th>Método</th><th class="r">Monto</th></tr></thead><tbody>${pagosRows}</tbody></table>
    <div style="text-align:right;font-size:13px;color:#111;margin-top:8px;font-weight:700">Total pagado: ${usd(cliPaid)}</div>` : ""}

    <div style="margin-top:30px;padding:20px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:10px;border:1.5px solid #86efac;text-align:center">
      <p style="margin:0;font-size:13px;color:#166534;font-weight:600">¡Gracias por confiar en Argencargo!</p>
      <p style="margin:6px 0 0;font-size:11px;color:#15803d">Esperamos verte pronto en tu próxima importación 🚀</p>
    </div>

    ${footerHtml}
    <div class="disclaimer">Este documento es un resumen final de tu operación. Conservalo para tus registros contables.</div>
  </div>`;

  openPrintWindow(`Resumen ${op.operation_code}`, html);
}
