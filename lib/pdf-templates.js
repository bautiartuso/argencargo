// PDF templates compartidos. Generan HTML que se abre en una pestaña nueva con auto-print.
// Estilo: navy/gold corporativo, logo Argencargo, info contacto en footer.
// Uso: import { printQuotePdf, printReceiptPdf, printClosingPdf } from "@/lib/pdf-templates";

const NAVY = "#1B4F8A";
const NAVY_DARK = "#152D54";
const GOLD = "#B8956A";
const GOLD_LIGHT = "#D4B17A";
const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png";
const LOGO_WHITE = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";

const usd = (n) => `USD ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  @page{size:A4 landscape;margin:10mm}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;font-size:10pt;line-height:1.45;background:#fff}
  .dsi-header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1B4F8A;padding-bottom:5mm;margin-bottom:5mm}
  .dsi-header-left{display:flex;align-items:center;gap:7mm}
  .dsi-header img{height:16mm}
  .dsi-arca{font-size:15pt;font-weight:800;color:#1B4F8A;letter-spacing:1px;line-height:1.2}
  .dsi-arca-sub{font-size:8pt;font-weight:600;color:#666;letter-spacing:0.5px;line-height:1.3}
  .dsi-title{font-size:15pt;font-weight:800;color:#1B4F8A;letter-spacing:0.4px;text-align:center;flex:1;line-height:1.25}
  .dsi-fecha{font-size:10pt;color:#444;text-align:right;font-weight:600;line-height:1.5}
  .dsi-section-title{background:#1B4F8A;color:#fff;font-weight:700;padding:2.5mm 4mm;font-size:9.5pt;letter-spacing:0.6px;text-transform:uppercase;margin-top:4mm;border-radius:3px 3px 0 0}
  .dsi-grid{display:grid;gap:0;padding:3.5mm 4mm;background:#fafbfc;border:1px solid #e5e7eb;border-top:none;border-bottom:1px solid #e5e7eb}
  .dsi-grid-cell{padding:1.5mm 3mm;border-right:1px dashed #d1d5db}
  .dsi-grid-cell:last-child{border-right:none}
  .dsi-label{font-size:8pt;color:#666;font-weight:600;display:block;margin-bottom:1.2mm;text-transform:uppercase;letter-spacing:0.3px}
  .dsi-value{font-size:11pt;color:#000;font-weight:700;line-height:1.3}
  .dsi-merch-block{margin-top:4mm;border:1px solid #d1d5db;border-radius:4px;overflow:hidden}
  .dsi-merch-header{background:#e5e7eb;padding:2.5mm 4mm;font-size:10pt;font-weight:700;color:#1B4F8A;text-transform:uppercase;letter-spacing:0.5px}
  .dsi-merch-data{padding:3.5mm 4mm;display:grid;grid-template-columns:90px 1fr 60px 70px 90px 90px 90px;gap:3mm;font-size:9pt;align-items:start}
  .dsi-merch-data .col-label{font-size:7.5pt;color:#666;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;margin-bottom:1.5mm}
  .dsi-merch-data .col-val{font-size:10.5pt;font-weight:700;color:#000;line-height:1.3}
  .dsi-liq-table{width:100%;border-collapse:collapse;margin-top:0;background:#fff}
  .dsi-liq-table th,.dsi-liq-table td{padding:2mm 4mm;text-align:right;font-size:9.5pt;border-bottom:1px solid #e5e7eb}
  .dsi-liq-table th{background:#1B4F8A;color:#fff;font-size:8.5pt;text-transform:uppercase;font-weight:700;text-align:center;letter-spacing:0.4px;padding:2.5mm 4mm}
  .dsi-liq-table td:first-child{text-align:left;color:#333;font-weight:600;width:60%}
  .dsi-liq-table tr.total td{background:#1B4F8A;color:#fff;font-weight:800;font-size:10pt;padding:2.5mm 4mm}
  .dsi-footer{margin-top:6mm;padding:4mm 5mm;background:#1B4F8A;color:#fff;border-radius:5px;font-size:9pt;display:flex;justify-content:space-between;align-items:center;line-height:1.5}
  .dsi-disclaimer{margin-top:3mm;padding:3mm 4mm;background:#fef3c7;border-left:4px solid #f59e0b;font-size:8.5pt;color:#78350f;line-height:1.55;border-radius:3px}
  .dsi-grand-total{margin-top:4mm;background:#1B4F8A;color:#fff;padding:4mm 5mm;border-radius:4px;display:flex;justify-content:space-between;align-items:center;font-size:14pt;font-weight:800;letter-spacing:0.3px}
`;

const conceptoLabels = {
  "010": "DERECHOS DE IMPORTACION",
  "011": "TASA DE ESTADISTICA",
  "415": "IVA",
  "416": "IVA ADICIONAL",
  "417": "IMPUESTO A LAS GANANCIAS",
  "418": "INGRESOS BRUTOS",
};

// ─────────────────────────────────────────────────────────
// Destinación Simplificada de Importación · formato DHL-like
// (monoespaciado, layout tipo terminal, firma manuscrita SVG)
// ─────────────────────────────────────────────────────────
export function printSimplifiedDeclaration({ op, items = [], pkgs = [], client, signer }) {
  const signerName = signer?.name || "Walter Rodriguez";
  const signerRole = signer?.role || "Departamento de Operaciones";
  const signerCompany = signer?.company || "ARGENCARGO S.A.";
  const totFob = items.reduce((s, it) => s + Number(it.unit_price_usd || 0) * Number(it.quantity || 1), 0);
  const totGw = pkgs.reduce((s, p) => s + Number(p.gross_weight_kg || 0) * Number(p.quantity || 1), 0);
  const totBultos = pkgs.reduce((s, p) => s + Number(p.quantity || 1), 0);
  const today = new Date();
  const dateShort = today.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeShort = today.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

  // Generar ID liquidación estilo AFIP (referencia interna)
  const yy = String(today.getFullYear()).slice(2);
  const julian = String(Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)).padStart(3, "0");
  const rand = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
  const idLiquidacion = `${yy}${julian}LMAN${rand.slice(0, 6)}B`;

  // CIF: FOB + 10% flete + 1% seguro
  const fleteEst = totFob * 0.10;
  const seguroEst = (totFob + fleteEst) * 0.01;
  const cifTotal = totFob + fleteEst + seguroEst;
  const totalConceptos = items.length || 1;

  // Gasto documental total a prorratear por % FOB de cada item
  const gastoDocTotal = Number(op.documentation_cost ?? op.budget_documental ?? op.gasto_documental ?? 0);

  // Helper: rounding inteligente para alícuotas (preserva decimales relevantes ej. 10.5)
  const fmtAlic = (pct) => {
    const r = Math.round(pct * 100) / 100; // 2 decimales máx
    return Number.isInteger(r) ? String(r) : (r.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}).replace(/0$/, "").replace(/\.$/, ""));
  };

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
    const gastoDocProp = gastoDocTotal * pct;
    const liqRows = [
      { codigo: "010", concepto: conceptoLabels["010"], alic: fmtAlic(dr * 100), monto: derechos },
      { codigo: "011", concepto: conceptoLabels["011"], alic: fmtAlic(te * 100), monto: tasa },
      { codigo: "415", concepto: conceptoLabels["415"], alic: fmtAlic(ivaR * 100), monto: iva },
      { codigo: "—",   concepto: "GASTO DOCUMENTAL PROPORCIONAL",       alic: "—",                monto: gastoDocProp, noPct: true },
    ];
    const totalLiq = derechos + tasa + iva + gastoDocProp;
    return `<div class="dsi-merch-block">
      <div class="dsi-merch-header">Mercadería ${idx + 1} de ${items.length}</div>
      <div class="dsi-merch-data">
        <div><div class="col-label">Pos. Aranc.</div><div class="col-val" style="font-family:'SF Mono',monospace">${ncm}</div></div>
        <div><div class="col-label">Desc. Mercadería</div><div class="col-val">${desc}</div></div>
        <div><div class="col-label">Unidad</div><div class="col-val">07-1</div></div>
        <div><div class="col-label">Cantidad</div><div class="col-val">${it.quantity || 1}</div></div>
        <div><div class="col-label">FOB x PA</div><div class="col-val">${fob.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
        <div><div class="col-label">Base Imponible</div><div class="col-val">${baseImp.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
        <div><div class="col-label">CIF Proporcional</div><div class="col-val">${itCif.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
      </div>
      <table class="dsi-liq-table">
        <thead><tr><th style="width:60%;text-align:left">Concepto</th><th>Alícuota</th><th>Monto USD</th></tr></thead>
        <tbody>
          ${liqRows.map(l => `<tr><td>${l.codigo} - ${l.concepto}</td><td style="text-align:center">${l.noPct ? l.alic : l.alic + "%"}</td><td>${l.monto.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`).join("")}
          <tr class="total"><td>TOTAL TRIBUTOS DE ESTA MERCADERÍA</td><td></td><td>USD ${totalLiq.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>
        </tbody>
      </table>
    </div>`;
  }).join("");

  const totDerechos = items.reduce((s, it) => { const fob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1); const pct = totFob > 0 ? fob / totFob : 0; return s + cifTotal * pct * (Number(it.import_duty_rate ?? 0) / 100); }, 0);
  const totTasa = items.reduce((s, it) => { const fob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1); const pct = totFob > 0 ? fob / totFob : 0; return s + cifTotal * pct * (Number(it.statistics_rate ?? 0) / 100); }, 0);
  const totIva = items.reduce((s, it) => { const fob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1); const pct = totFob > 0 ? fob / totFob : 0; const itCif = cifTotal * pct; const dr = Number(it.import_duty_rate ?? 0) / 100; const te = Number(it.statistics_rate ?? 0) / 100; const ivaR = Number(it.iva_rate ?? 21) / 100; return s + (itCif + itCif * dr + itCif * te) * ivaR; }, 0);
  const totalGral = totDerechos + totTasa + totIva + gastoDocTotal;

  const cliName = `${(client?.first_name || "").toUpperCase()} ${(client?.last_name || "").toUpperCase()}`.trim() || "—";
  const cliDoc = client?.cuit ? `CUIT-${client.cuit}` : (client?.dni ? `DNI-${client.dni}` : "CONSUMIDOR FINAL");
  const cliAddr = `${client?.street || ""}${client?.floor_apt ? " " + client.floor_apt : ""}`.trim() || "—";
  const cliCity = (client?.city || "—").toUpperCase();
  const cliProv = (client?.province || "BUENOS AIRES").toUpperCase();
  const origenCountry = op.origin === "USA" ? "US-ESTADOS UNIDOS" : op.origin === "España" ? "ES-ESPAÑA" : "CN-CHINA";
  const aduana = op.origin === "USA" ? "073-EZEIZA" : op.origin === "España" ? "073-EZEIZA" : "073-EZEIZA";

  // ── Formato monoespaciado tipo DHL (terminal-like) ──
  const remitente = (op.shipper_name || op.supplier_name || "PROVEEDOR EXTERIOR").toUpperCase();
  const guia = op.international_tracking || op.operation_code || "—";
  const fechaLlegada = op.arrived_at ? new Date(op.arrived_at).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}) : dateShort;
  const cantPiezas = totBultos || items.length || 0;
  const facturaCom = op.commercial_invoice_no || op.invoice_no || "—";
  const cuit = client?.cuit || "—";
  const cotizacion = Number(op.exchange_rate || op.collection_exchange_rate || 0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}) || "—";
  const taxCondLbl = client?.tax_condition === "responsable_inscripto" ? "RIN Resp. Inscripto" : "CFN Cons. Final";

  // Padding utilitario para alinear el "label : valor" estilo dot-matrix
  const pad = (s, n) => String(s).padEnd(n, " ");
  const padR = (s, n) => String(s).padStart(n, " ");

  // Filas de la tabla de mercadería
  const rows = items.slice(0, 20).map((it, i) => {
    const fob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1);
    const pct = totFob > 0 ? fob / totFob : 0;
    const flete = fleteEst * pct;
    const seguro = seguroEst * pct;
    const vAduana = fob + flete + seguro;
    const drPct = Number(it.import_duty_rate ?? 0);
    const tePct = Number(it.statistics_rate ?? 0);
    const derecho = vAduana * drPct / 100;
    const estad = vAduana * tePct / 100;
    const desc = (it.description || "MERCADERIA").toUpperCase().slice(0, 22).padEnd(22, " ");
    const ncm = (it.ncm_code || "—").padEnd(10, " ");
    return `${padR(i + 1, 2)}  ${ncm} ${desc} ${padR(fob.toFixed(2), 8)} ${padR(flete.toFixed(2), 7)} ${padR(seguro.toFixed(2), 6)} ${padR(vAduana.toFixed(2), 8)} ${padR(drPct.toFixed(2), 6)} ${padR(derecho.toFixed(2), 7)} ${padR(tePct.toFixed(2), 5)} ${padR(estad.toFixed(2), 6)}`;
  }).join("\n");

  // SVG firma manuscrita (scribble cursiva). Encima de la línea ___.
  const signatureSvg = `<svg width="280" height="90" viewBox="0 0 280 90" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <path d="M 20 55 Q 25 25 40 30 Q 50 35 45 55 Q 38 70 30 60 Q 28 55 35 50 Q 50 45 55 55 Q 60 70 50 75 Q 45 76 50 70 Q 60 60 75 55 Q 85 50 80 65 Q 75 75 70 70 Q 72 65 82 60 Q 100 50 105 65 Q 108 75 100 70 Q 95 65 110 55 Q 130 40 135 60 Q 138 75 128 72 Q 125 70 138 58 Q 165 35 175 55 Q 180 75 170 75 Q 162 75 175 60 Q 195 45 215 50 Q 230 55 225 70 Q 218 75 215 70 L 220 50 Q 235 35 250 45"
      stroke="#1a1a1a" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 30 78 Q 70 75 110 80 Q 150 82 200 78 Q 230 76 250 80" stroke="#1a1a1a" stroke-width="0.6" fill="none" stroke-linecap="round"/>
  </svg>`;

  // Línea horizontal dashes (tabla DHL usa 120 = de ancho)
  const dashes120 = "------------------------------------------------------------------------------------------------------------------------";
  const equals50 = "==================================================";

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>DSI ${op.operation_code}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4;margin:14mm 12mm}
  html,body{background:#fff;color:#0a0a0a;font-family:'Courier New','Courier',monospace;font-size:9.2pt;line-height:1.35}
  .doc{max-width:185mm;margin:0 auto}
  .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6mm}
  .top-left{font-size:9pt}
  .top-right img{height:14mm;object-fit:contain}
  .title{text-align:center;font-weight:700;letter-spacing:0.05em;margin:4mm 0 0;font-size:10pt}
  .title-sep{text-align:center;font-size:9pt;letter-spacing:-0.5px;color:#555;margin-bottom:6mm}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:0 8mm;margin-bottom:5mm;white-space:pre}
  .meta-row{font-size:9pt;line-height:1.55}
  .meta-row b{font-weight:400}
  .dest-block{margin:3mm 0 5mm;padding:0;line-height:1.45;font-size:9pt}
  .table-hdr,.row{font-family:'Courier New',monospace;font-size:8.5pt;white-space:pre;line-height:1.4}
  .dash{font-family:'Courier New',monospace;font-size:8.5pt;letter-spacing:-0.5px;color:#555}
  .sig-block{margin-top:18mm;text-align:center}
  .sig-svg{margin:0 auto -2mm;display:inline-block;position:relative}
  .sig-line{display:inline-block;width:90mm;border-top:0.8px solid #000;padding-top:1.5mm;font-size:9pt;line-height:1.45}
  .sig-line strong{font-weight:600}
  .foot{margin-top:14mm;padding-top:3mm;border-top:1px solid #ddd;font-size:7.5pt;color:#777;text-align:center;letter-spacing:0.04em}
</style></head><body>
<div class="doc">
  <div class="top">
    <div class="top-left">Gerencia de Importacion</div>
    <div class="top-right"><img src="${LOGO}" alt="Argencargo"/></div>
  </div>

  <div class="title">DESTINACION SIMPLIFICADA DE IMPORTACION</div>
  <div class="title-sep">${equals50}</div>

  <div class="meta">
    <div class="meta-row">Nro. de Guia    : ${guia}</div>
    <div class="meta-row">Fecha LLegada   : ${fechaLlegada}</div>
    <div class="meta-row">Nro Solicitud   : ${idLiquidacion.slice(0,12)}</div>
    <div class="meta-row">Nro de Poliza   : ${idLiquidacion.slice(-8)} / Referencia: ${op.operation_code}</div>
    <div class="meta-row">Remitente       : ${remitente}</div>
    <div class="meta-row">Cant. Piezas    : ${cantPiezas}</div>
    <div class="meta-row">P.F. DGI        : ${taxCondLbl}</div>
    <div class="meta-row">Ruta Entrega    : </div>
    <div class="meta-row">Contenido       : ${(items[0]?.description || "MERCADERIA VARIOS").slice(0, 28).toUpperCase()}</div>
    <div class="meta-row">Nro. Cuit       : ${cuit}</div>
    <div class="meta-row">                  ${items.length > 1 ? `+ ${items.length-1} item(s) más` : "Sample"}</div>
    <div class="meta-row">Nro. de Factura Comercial: ${facturaCom}</div>
    <div class="meta-row">Contacto        : ${cliName}</div>
    <div class="meta-row">Marca DDP       : </div>
  </div>

  <div class="dest-block">
Destinatario    : Cotizacion ($/U$S) : ${cotizacion}
  ${cliName}
  ${cliAddr}. TAX CODE ${cuit !== "—" ? cuit.replace(/-/g, "").replace(/(\d{2})(\d{8})(\d{1})/, "$1-$2-$3").substring(0, 13) : "—"}    Tipo Envio: ${op.shipping_to_door ? "Domicilio" : "Comercial"}
  ${cliCity} ${cliProv}
  </div>

  <div class="dash">${dashes120}</div>
  <div class="table-hdr"> Posic.Aran Val.Fob.   Flete  Seguro V.Aduana %Dere Derech %Esta  Estad</div>
  <div class="dash">${dashes120}</div>
${rows ? rows.split("\n").map(r => `  <div class="row">${r}</div>`).join("") : `  <div class="row" style="text-align:center;color:#999;padding:3mm 0">Sin items declarados</div>`}

  <div class="sig-block">
    <div class="sig-svg">${signatureSvg}</div>
    <div class="sig-line">
      <strong>${signerName}</strong><br/>
      ${signerRole}<br/>
      ${signerCompany}
    </div>
  </div>

  <div class="foot">ARGENCARGO · Av. Callao 1137, Recoleta CABA · info@argencargo.com.ar · ${dateShort} ${timeShort}</div>
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
  .lbl-logo img{height:24mm;max-width:90mm;object-fit:contain}
  .lbl-code{font-family:'SF Mono','Courier New',monospace;font-size:20pt;font-weight:800;color:${NAVY};letter-spacing:1px;text-align:center;margin-bottom:1mm}
  .lbl-cli{font-size:10pt;color:#444;margin-bottom:3mm;font-weight:700;text-align:center}
  .lbl-bulto-num{display:block;padding:2mm 4mm;color:${NAVY};font-size:11pt;font-weight:800;letter-spacing:1px;margin-bottom:3mm;text-align:center;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb}
  .lbl-peso-box{background:#f5f7fa;border:1.5px solid ${NAVY};border-radius:6px;padding:3mm;text-align:center;margin-bottom:2.5mm}
  .lbl-peso-label{font-size:7pt;color:#666;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:1mm;font-weight:700}
  .lbl-peso-val{font-size:22pt;font-weight:800;color:${NAVY};letter-spacing:-0.5px;line-height:1}
  .lbl-peso-fact{font-size:9pt;color:${GOLD};margin-top:1.5mm;font-weight:700}
  .lbl-peso-detail{font-size:7pt;color:#888;margin-top:1mm}
  .lbl-totales{display:flex;gap:3mm;margin-bottom:3mm;padding:2.5mm;background:#fafbfc;border-radius:4px;border:1px solid #e5e7eb}
  .lbl-totales > div{flex:1;text-align:center}
  .lbl-totales .tot-label{font-size:7pt;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:1mm;display:block}
  .lbl-totales .tot-val{font-size:11pt;font-weight:800;color:${NAVY};display:block}
  .lbl-bottom{margin-top:auto;border-top:1.5px solid #e5e7eb;padding-top:3mm;text-align:center}
  .lbl-barcode-label{font-size:6.5pt;color:#999;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:1.5mm}
  .lbl-barcode{height:22mm;width:90mm;display:block;margin:0 auto;image-rendering:pixelated}
  .lbl-barcode-text{font-family:'SF Mono','Courier New',monospace;font-size:11pt;color:#000;letter-spacing:3px;margin-top:1.5mm;font-weight:800}
  @media print{.label{border:none}}
`;

function qrUrl(text, size = 200) {
  // QR generado por API pública gratuita (sin dependencias)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&margin=0&data=${encodeURIComponent(text)}`;
}

// Genera código de barras Code128 escaneable via API pública (sin deps)
// Compatible con scanners industriales y apps de smartphone
function barcodeUrl(text, height = 80) {
  // dpi alto + modulewidth grande => barcode ancho y nítido aun con strings cortos.
  // hidehrt=true: oculta el texto chico debajo del barcode (lo mostramos aparte abajo, más grande).
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(text)}&code=Code128&dpi=300&imagetype=Png&translate-esc=on&height=${height}&modulewidth=1.2&hidehrt=true`;
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
        ${dims ? `<div class="lbl-peso-detail">${dims} · ${(gw * q).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg</div>` : ""}
      </div>`;
    } else if (isAereoA) {
      // Aéreo A: peso facturable + bruto
      mainBox = `<div class="lbl-peso-box">
        <div class="lbl-peso-label">Peso bruto</div>
        <div class="lbl-peso-val">${gw > 0 ? `${(gw * q).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg` : "—"}</div>
        ${factU > 0 ? `<div class="lbl-peso-fact">Peso Facturable: ${factU.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg</div>` : ""}
        ${dims ? `<div class="lbl-peso-detail">${dims}</div>` : ""}
      </div>`;
    } else {
      // Aéreo B (default): solo peso bruto
      mainBox = `<div class="lbl-peso-box">
        <div class="lbl-peso-label">Peso bruto</div>
        <div class="lbl-peso-val">${gw > 0 ? `${(gw * q).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg` : "—"}</div>
        ${dims ? `<div class="lbl-peso-detail">${dims}</div>` : ""}
      </div>`;
    }

    // Totales de la carga (varía según canal)
    let totalLabel, totalValue;
    if (isMaritimo) {
      totalLabel = "Volumen total"; totalValue = `${totalCbm.toFixed(4)} m³`;
    } else if (isAereoA) {
      totalLabel = "Peso facturable total"; totalValue = `${totalFacturable.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg`;
    } else {
      totalLabel = "Peso bruto total"; totalValue = `${totalGw.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg`;
    }

    // Código de barras: usar operation_code (ej: "AC-0019") — escaneable como Code128
    const barcodeData = op.operation_code;

    return `<div class="label">
      <div class="lbl-logo"><img src="${LOGO}" alt="Argencargo"/></div>

      <div class="lbl-code">${op.operation_code}</div>
      <div class="lbl-cli">${client?.client_code || "—"} · ${client?.first_name || ""} ${client?.last_name || ""}</div>

      <div class="lbl-bulto-num">BULTO ${pk.package_number || idx + 1} DE ${packages.length}${q > 1 ? ` · CONTIENE ${q}` : ""}</div>

      ${mainBox}

      <div class="lbl-totales">
        <div>
          <div class="tot-label">Total bultos</div>
          <div class="tot-val">${totalBultos}</div>
        </div>
        <div>
          <div class="tot-label">${totalLabel}</div>
          <div class="tot-val">${totalValue}</div>
        </div>
      </div>

      <div class="lbl-bottom">
        <img class="lbl-barcode" src="${barcodeUrl(barcodeData, 80)}" alt="Código de barras"/>
        <div class="lbl-barcode-text">${barcodeData}</div>
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
    return `<tr><td class="c">${i + 1}</td><td class="c">${q}</td><td class="c">${l ? `${l}×${wd}×${h} cm` : "—"}</td><td class="r">${gw ? `${gw.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg` : "—"}</td><td class="r">${cbm ? cbm.toFixed(4) + " m³" : "—"}</td></tr>`;
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
      <tr><td style="color:#6b7280;font-weight:600">Peso bruto total</td><td><strong>${totGW.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg</strong></td></tr>
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

// ─────────────────────────────────────────────────────────
// PDF · COTIZACIÓN GI ACEPTADA (post-aceptación, sin vencimiento)
// ─────────────────────────────────────────────────────────
// Diseño tipo Underwave: navy header con logo + banda dorada + body claro
// + gold total bar + plan de pagos + footer corporativo.
// NO muestra "Válida hasta" porque ya fue aceptada.
//
// Inputs:
//   quote: gi_quote con request_code, selected_channel, selected_delivery_zone,
//          selected_delivery_cost_usd, payment_plan, accepted_at, operation_code
//   products: array de gi_quote_products
//   client: { first_name, last_name, client_code }
//   settings: { office_address, office_locality, office_hours, office_phone, terms_and_conditions }
//
const giStyles = `
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:0}
  @page{size:A4;margin:0}
  html,body{font-family:'Helvetica Neue','Inter',-apple-system,Arial,sans-serif;color:#1a1a1a;background:#fff;font-size:11pt;line-height:1.5}
  .gi-doc{max-width:210mm;min-height:297mm;margin:0 auto;background:#fafaf7;display:flex;flex-direction:column}
  .gi-head{background:#0A1628;color:#fff;padding:18mm 14mm 10mm;position:relative}
  .gi-head-top{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:14px}
  .gi-logo{height:18mm;width:auto}
  .gi-tag{font-size:8.5pt;font-weight:700;letter-spacing:0.18em;color:rgba(232,208,152,0.85);text-transform:uppercase;margin-bottom:3px}
  .gi-num{font-family:'SF Mono','Courier New',monospace;font-size:14pt;font-weight:700;color:#E8D098;letter-spacing:0.04em;margin-bottom:1px}
  .gi-date{font-size:9pt;color:rgba(255,255,255,0.6)}
  .gi-head-client{display:flex;justify-content:space-between;align-items:baseline;gap:14px;flex-wrap:wrap;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08)}
  .gi-head-lbl{font-size:8pt;font-weight:700;letter-spacing:0.14em;color:rgba(232,208,152,0.65);text-transform:uppercase;margin-bottom:3px}
  .gi-head-val{font-size:14pt;font-weight:700;color:#fff;letter-spacing:-0.01em}
  .gi-band{height:5px;background:linear-gradient(90deg,#B8956A 0%,#E8D098 50%,#B8956A 100%);position:absolute;left:0;right:0;bottom:0}
  .gi-body{padding:10mm 14mm;flex:1}
  .gi-sec{margin-bottom:7mm}
  .gi-sec-title{font-size:8.5pt;font-weight:800;letter-spacing:0.18em;color:#666;text-transform:uppercase;margin-bottom:3mm}
  .gi-card{padding:5mm 6mm;background:#fff;border:1px solid #ebe6db;border-radius:3mm}
  .gi-prod{display:flex;gap:4mm;align-items:center;padding:3mm 0;border-bottom:1px solid #ebe6db}
  .gi-prod:last-child{border-bottom:none}
  .gi-prod-info{flex:1}
  .gi-prod-name{font-size:11pt;font-weight:700;color:#1a1a1a;margin-bottom:1mm}
  .gi-prod-meta{font-size:8.5pt;color:#777}
  .gi-prod-lead{font-size:8.5pt;color:#B8956A;font-weight:600;margin-top:1mm}
  .gi-prod-pricing{text-align:right;flex-shrink:0}
  .gi-prod-line{font-size:9pt;color:#666;margin-bottom:1mm;font-feature-settings:"tnum"}
  .gi-prod-sub{font-size:11pt;font-weight:800;color:#0A1628;font-feature-settings:"tnum";letter-spacing:-0.01em}
  .gi-svc-card{padding:4mm 5mm;background:#fff;border:1.5px solid #B8956A;border-radius:3mm;background:linear-gradient(135deg,#fdf6e8,#faedd0);box-shadow:0 1mm 3mm rgba(184,149,106,0.18);display:flex;align-items:center;justify-content:space-between;gap:4mm}
  .gi-svc-name{font-size:11pt;font-weight:700;color:#1a1a1a}
  .gi-svc-time{font-size:9pt;color:#777;margin-top:0.5mm}
  .gi-svc-price{font-size:13pt;font-weight:800;color:#B8956A;font-feature-settings:"tnum"}
  .gi-deliv-card{padding:3mm 5mm;background:#fff;border:1px solid #ebe6db;border-radius:3mm;display:flex;align-items:center;gap:3mm;justify-content:space-between}
  .gi-deliv-name{font-size:10pt;font-weight:700;color:#1a1a1a;margin-bottom:0.5mm}
  .gi-deliv-meta{font-size:8.5pt;color:#777}
  .gi-deliv-price{font-size:11pt;font-weight:700;color:#B8956A;font-feature-settings:"tnum"}
  .gi-total-bar{padding:5mm 6mm;background:linear-gradient(135deg,#B8956A,#E8D098);color:#0A1628;border-radius:3mm;display:flex;justify-content:space-between;align-items:center;box-shadow:0 1.5mm 5mm rgba(184,149,106,0.25);margin:4mm 0}
  .gi-total-lbl{font-size:9pt;font-weight:800;letter-spacing:0.16em;text-transform:uppercase}
  .gi-total-sub{font-size:9pt;font-weight:600;color:rgba(10,22,40,0.65);margin-top:1mm}
  .gi-total-val{font-size:22pt;font-weight:800;letter-spacing:-0.02em;font-feature-settings:"tnum"}
  .gi-pay-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}
  .gi-pay-card{padding:3mm 4mm;background:#fff;border:1px solid #ebe6db;border-radius:3mm}
  .gi-pay-pct{font-size:14pt;font-weight:800;color:#B8956A;letter-spacing:-0.02em;margin-bottom:0.5mm}
  .gi-pay-when{font-size:8.5pt;color:#777;margin-bottom:2mm;line-height:1.4}
  .gi-pay-amt{font-size:10.5pt;font-weight:700;color:#1a1a1a;font-feature-settings:"tnum";padding-top:1.5mm;border-top:1px solid #f0eadc}
  .gi-times{display:flex;gap:2mm;margin-top:2mm}
  .gi-time-step{flex:1;display:flex;align-items:center;gap:2mm;padding:3mm 4mm;background:#fff;border:1px solid #ebe6db;border-radius:3mm}
  .gi-time-num{width:6mm;height:6mm;border-radius:50%;background:#0A1628;color:#E8D098;font-size:8.5pt;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .gi-time-name{font-size:9.5pt;font-weight:700;color:#1a1a1a}
  .gi-time-meta{font-size:8.5pt;color:#777;margin-top:0.5mm}
  .gi-tc{padding:4mm 5mm;background:#fff;border:1px solid #ebe6db;border-radius:3mm;font-size:8.5pt;color:#555;line-height:1.55;white-space:pre-wrap}
  .gi-tc-title{font-size:8.5pt;font-weight:700;color:#1a1a1a;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:2mm}
  .gi-foot{background:#0A1628;color:#fff;padding:8mm 14mm;display:flex;justify-content:space-between;align-items:center;gap:8mm}
  .gi-foot-brand{font-size:13pt;font-weight:800;letter-spacing:0.08em;margin-bottom:2mm}
  .gi-foot-line{font-size:9pt;color:rgba(255,255,255,0.7);line-height:1.6}
  .gi-foot-line strong{color:#E8D098;font-weight:700}
  .gi-foot-url{font-size:11pt;font-weight:700;color:#E8D098;letter-spacing:0.04em}
  .gi-accepted-stamp{display:inline-block;padding:2mm 4mm;background:#22c55e;color:#fff;border-radius:2mm;font-size:9pt;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-top:2mm}
  @media print{.gi-doc{margin:0;box-shadow:none}}
`;

const CHANNEL_PDF_NAMES = {
  aereo_negro: { name: "Aéreo Courier Comercial", time: "7 a 10 días hábiles" },
  aereo_blanco: { name: "Aéreo Integral AC", time: "10 a 15 días hábiles" },
  maritimo_negro: { name: "Marítimo LCL / FCL", time: "~ 60 días" },
  maritimo_blanco: { name: "Marítimo Integral AC", time: "~ 60 días" },
};

export function printGiAcceptedPdf({ quote, products = [], client, settings, operationCode }) {
  const cn = client ? `${client.first_name || ""} ${client.last_name || ""}`.trim() : "Cliente";
  const channelInfo = CHANNEL_PDF_NAMES[quote.selected_channel] || { name: quote.selected_channel || "—", time: "—" };
  const totalKey = {
    aereo_negro: "cost_courier_total_usd",
    aereo_blanco: "cost_aereo_int_total_usd",
    maritimo_negro: "cost_maritimo_lcl_total_usd",
    maritimo_blanco: "cost_maritimo_int_total_usd",
  }[quote.selected_channel];
  const channelTotal = Number(quote[totalKey] || 0);
  const deliveryCost = Number(quote.selected_delivery_cost_usd || 0);
  const finalTotal = channelTotal + deliveryCost;
  const deliveryZone = quote.selected_delivery_zone || "oficina";
  const deliveryName = deliveryZone === "oficina" ? "Retiro por oficina" : `Envío a ${deliveryZone}`;
  const deliveryMeta = deliveryZone === "oficina"
    ? `${settings?.office_address || ""}${settings?.office_locality ? ` · ${settings.office_locality}` : ""}${settings?.office_hours ? ` · ${settings.office_hours}` : ""}`
    : "Coordinamos día y horario";
  const totalQty = products.reduce((s, p) => s + Number(p.quantity || 0), 0);
  const maxLead = products.reduce((m, p) => Math.max(m, Number(p.lead_time_days || 0)), 0);
  const plan = Array.isArray(quote.payment_plan) ? quote.payment_plan : (typeof quote.payment_plan === "string" ? JSON.parse(quote.payment_plan) : []);

  const acceptedDate = quote.accepted_at ? fmtDate(quote.accepted_at) : "—";

  const productsHtml = products.map(p => {
    const sub = Number(p.unit_cost_usd || 0) * Number(p.quantity || 0);
    return `<div class="gi-prod">
      <div class="gi-prod-info">
        <p class="gi-prod-name">${p.description || "—"}</p>
        ${p.lead_time_days > 0 ? `<p class="gi-prod-lead">Producción ${p.lead_time_days} días hábiles</p>` : ""}
      </div>
      <div class="gi-prod-pricing">
        <p class="gi-prod-line">${p.quantity || 0} u. × ${usd(p.unit_cost_usd)}</p>
        <p class="gi-prod-sub">${usd(sub)}</p>
      </div>
    </div>`;
  }).join("");

  const planFiltered = (plan || []).filter(s => Number(s.pct || 0) > 0);
  const planHtml = planFiltered.length > 0 ? `<div class="gi-pay-grid">
    ${planFiltered.map(stage => `<div class="gi-pay-card">
      <p class="gi-pay-pct">${stage.pct}%</p>
      <p class="gi-pay-when">${stage.label || ""}</p>
      <p class="gi-pay-amt">${usd(Math.round(finalTotal * Number(stage.pct) / 100))}</p>
    </div>`).join("")}
  </div>` : "";

  const html = `<div class="gi-doc">
    <div class="gi-head">
      <div class="gi-head-top">
        <img src="${LOGO_WHITE}" alt="Argencargo" class="gi-logo"/>
        <div style="text-align:right">
          <p class="gi-tag">Cotización · Gestión Integral</p>
          <p class="gi-num">${quote.request_code || quote.gi_quote_requests?.request_code || "—"}</p>
          <p class="gi-date">Aceptada el ${acceptedDate}</p>
          ${operationCode ? `<span class="gi-accepted-stamp">✓ ${operationCode}</span>` : ""}
        </div>
      </div>
      <div class="gi-head-client">
        <div><p class="gi-head-lbl">Cliente</p><p class="gi-head-val">${cn}</p></div>
        <div><p class="gi-head-lbl">${totalQty} unidades · ${products.length} ${products.length === 1 ? "producto" : "productos"}</p></div>
      </div>
      <div class="gi-band"></div>
    </div>

    <div class="gi-body">
      <div class="gi-sec">
        <p class="gi-sec-title">Productos</p>
        <div class="gi-card">${productsHtml}</div>
      </div>

      <div class="gi-sec">
        <p class="gi-sec-title">Servicio elegido</p>
        <div class="gi-svc-card">
          <div>
            <p class="gi-svc-name">${channelInfo.name}</p>
            <p class="gi-svc-time">${channelInfo.time}</p>
          </div>
          <p class="gi-svc-price">${usd(channelTotal)}</p>
        </div>
      </div>

      <div class="gi-sec">
        <p class="gi-sec-title">Entrega</p>
        <div class="gi-deliv-card">
          <div>
            <p class="gi-deliv-name">${deliveryName}</p>
            <p class="gi-deliv-meta">${deliveryMeta}</p>
          </div>
          <p class="gi-deliv-price">${deliveryCost > 0 ? `+ ${usd(deliveryCost)}` : "Incluido"}</p>
        </div>
      </div>

      <div class="gi-total-bar">
        <div>
          <p class="gi-total-lbl">Total</p>
          <p class="gi-total-sub">${channelInfo.name} · ${deliveryName}</p>
        </div>
        <p class="gi-total-val">${usd(finalTotal)}</p>
      </div>

      ${planFiltered.length > 0 ? `<div class="gi-sec">
        <p class="gi-sec-title">Plan de pagos</p>
        ${planHtml}
      </div>` : ""}

      <div class="gi-sec">
        <p class="gi-sec-title">Tiempos estimados</p>
        <div class="gi-times">
          <div class="gi-time-step"><span class="gi-time-num">1</span><div><p class="gi-time-name">Producción</p><p class="gi-time-meta">${maxLead > 0 ? `Hasta ${maxLead} días hábiles` : "Según producto"}</p></div></div>
          <div class="gi-time-step"><span class="gi-time-num">2</span><div><p class="gi-time-name">Envío y arribo</p><p class="gi-time-meta">${channelInfo.time}</p></div></div>
          <div class="gi-time-step"><span class="gi-time-num">3</span><div><p class="gi-time-name">Entrega final</p><p class="gi-time-meta">${deliveryZone === "oficina" ? `Retiro · ${settings?.office_locality || "Recoleta CABA"}` : `Envío a ${deliveryZone}`}</p></div></div>
        </div>
      </div>

      ${settings?.terms_and_conditions ? `<div class="gi-sec">
        <p class="gi-sec-title">Términos y condiciones</p>
        <div class="gi-tc">${settings.terms_and_conditions}</div>
      </div>` : ""}
    </div>

    <div class="gi-foot">
      <div style="flex:1">
        <p class="gi-foot-brand">ARGENCARGO</p>
        <p class="gi-foot-line"><strong>Tel:</strong> ${settings?.office_phone || "+54 9 11 2508-8580"} &nbsp;·&nbsp; <strong>Email:</strong> info@argencargo.com.ar</p>
        <p class="gi-foot-line">${settings?.office_address || "Av. Callao 1137"}${settings?.office_locality ? ` — ${settings.office_locality}` : ""}</p>
      </div>
      <p class="gi-foot-url">argencargo.com.ar</p>
    </div>
  </div>`;

  const w = window.open("", "_blank");
  if (!w) { alert("El navegador bloqueó la ventana de impresión. Permití pop-ups."); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cotización ${quote.request_code || ""}</title><style>${giStyles}</style></head><body>${html}<script>setTimeout(()=>window.print(),500);</script></body></html>`);
  w.document.close();
}

// ─────────────────────────────────────────────────────────────────────
// PDF Cotización GI (estilo UNDW · Presupuesto Llave en Mano)
// Versión más limpia / comercial para mandar al cliente antes de aceptar.
// Header blanco + card cliente/modalidad + productos con foto + total gold + plan + tiempos.
// ─────────────────────────────────────────────────────────────────────
const giQuoteStyles = `
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:0}
  @page{size:A4;margin:0}
  html,body{font-family:'Helvetica Neue','Inter',-apple-system,Arial,sans-serif;color:#1a1a1a;background:#fff;font-size:10pt;line-height:1.45}
  .doc{max-width:210mm;min-height:297mm;margin:0 auto;background:#fff;display:flex;flex-direction:column}
  .hd{padding:11mm 14mm 5mm;display:flex;justify-content:space-between;align-items:flex-start;gap:8mm}
  .hd-left .ttl{font-size:16pt;font-weight:800;letter-spacing:-0.01em;color:#0A1628;margin-bottom:0.5mm}
  .hd-left .sub{font-size:7.5pt;font-weight:700;letter-spacing:0.16em;color:#B8956A;text-transform:uppercase}
  .hd-right{text-align:right}
  .hd-right .code{font-size:9pt;font-weight:800;color:#B8956A;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:1.5mm}
  .hd-right .meta{font-size:8.5pt;color:#666;margin-bottom:0.5mm}
  .hd-right .meta b{color:#0A1628;font-weight:700}
  .cli-bar{margin:0 14mm 4mm;background:#0A1628;color:#fff;border-radius:2.5mm;padding:3.5mm 5mm;display:flex;justify-content:space-between;align-items:center;gap:6mm}
  .cli-left{display:flex;align-items:center;gap:4mm;flex:1}
  .cli-circle{width:11mm;height:11mm;border-radius:50%;background:linear-gradient(135deg,#B8956A,#E8D098);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11pt;color:#0A1628;flex-shrink:0}
  .cli-lbl{font-size:7pt;font-weight:700;letter-spacing:0.14em;color:#E8D098;text-transform:uppercase;margin-bottom:0.5mm}
  .cli-name{font-size:12pt;font-weight:800;color:#fff}
  .cli-right{text-align:right}
  .cli-mod{font-size:10pt;font-weight:700;color:#fff}
  .body{padding:1mm 14mm 4mm;flex:1}
  .sec-title{font-size:8.5pt;font-weight:800;letter-spacing:0.16em;color:#B8956A;text-transform:uppercase;margin-bottom:2mm}
  .prod{padding:2.5mm 3.5mm;background:#fff;border:1px solid #ebe6db;border-left:2.5mm solid #0A1628;border-radius:1.5mm;margin-bottom:1.5mm;display:flex;gap:3.5mm;align-items:center;page-break-inside:avoid}
  .prod-img{width:14mm;height:14mm;border-radius:1.5mm;object-fit:cover;background:#f0eadc;flex-shrink:0;border:1px solid #ebe6db}
  .prod-img-ph{width:14mm;height:14mm;border-radius:1.5mm;background:#f0eadc;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#999;font-size:8pt}
  .prod-mid{flex:1;min-width:0}
  .prod-name{font-size:10pt;font-weight:800;color:#0A1628;margin-bottom:1.5mm;letter-spacing:-0.01em;line-height:1.25}
  .stats{display:flex;gap:5mm;flex-wrap:nowrap;align-items:flex-end}
  .stats > div{min-width:0}
  .stat-lbl{font-size:6.5pt;font-weight:700;letter-spacing:0.08em;color:#999;text-transform:uppercase;margin-bottom:0.5mm}
  .stat-val{font-size:9pt;font-weight:700;color:#1a1a1a;white-space:nowrap}
  .prod-sub-wrap{text-align:right;flex-shrink:0;border-left:1px solid #ebe6db;padding-left:4mm}
  .prod-sub-lbl{font-size:6.5pt;font-weight:700;letter-spacing:0.12em;color:#999;text-transform:uppercase;margin-bottom:0.5mm}
  .prod-sub-val{font-size:12pt;font-weight:800;color:#B8956A;font-feature-settings:"tnum";letter-spacing:-0.01em;white-space:nowrap}
  .total-bar{margin:3.5mm 0 4mm;padding:4mm 5.5mm;background:linear-gradient(135deg,#B8956A,#E8D098);color:#0A1628;border-radius:2.5mm;display:flex;justify-content:space-between;align-items:center;box-shadow:0 1mm 4mm rgba(184,149,106,0.22);page-break-inside:avoid}
  .total-lbl{font-size:10pt;font-weight:800;letter-spacing:0.05em;text-transform:uppercase}
  .total-val{font-size:20pt;font-weight:800;letter-spacing:-0.02em;font-feature-settings:"tnum"}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:3mm;page-break-inside:avoid}
  .panel{padding:3mm 4mm;background:#fafaf7;border:1px solid #ebe6db;border-radius:2.5mm}
  .panel-h{font-size:9pt;font-weight:800;letter-spacing:0.04em;color:#0A1628;margin-bottom:2mm}
  .pay-row{display:flex;justify-content:space-between;align-items:baseline;padding:1.3mm 0;border-bottom:1px dotted #e5e0d3}
  .pay-row:last-child{border-bottom:none}
  .pay-pct{font-size:10pt;font-weight:800;color:#B8956A;margin-right:2mm;font-feature-settings:"tnum"}
  .pay-lbl{flex:1;font-size:9pt;color:#444}
  .pay-amt{font-size:9.5pt;font-weight:800;color:#0A1628;font-feature-settings:"tnum"}
  .time-row{display:flex;justify-content:space-between;align-items:baseline;padding:1.3mm 0;border-bottom:1px dotted #e5e0d3}
  .time-row:last-child{border-bottom:none;padding-top:2mm;margin-top:1mm;border-top:1px solid #ebe6db;font-weight:700}
  .time-lbl{font-size:9pt;color:#444}
  .time-row:last-child .time-lbl{font-weight:700;color:#0A1628}
  .time-val{font-size:9pt;font-weight:700;color:#0A1628;font-feature-settings:"tnum"}
  .ft{background:#0A1628;color:#fff;padding:5mm 14mm;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;margin-top:auto}
  .ft-brand{font-size:11pt;font-weight:800;letter-spacing:0.08em;margin-bottom:1.5mm}
  .ft-line{font-size:8.5pt;color:rgba(255,255,255,0.72);line-height:1.5}
  .ft-line b{color:#E8D098;font-weight:700}
  .ft-url{font-size:9.5pt;font-weight:700;color:#E8D098;letter-spacing:0.04em;white-space:nowrap}
  /* Modo compacto cuando hay 6+ productos: aún más ajustado */
  .doc.compact .prod{padding:2mm 3mm;margin-bottom:1mm;gap:3mm}
  .doc.compact .prod-img,.doc.compact .prod-img-ph{width:11mm;height:11mm}
  .doc.compact .prod-name{font-size:9pt;margin-bottom:1mm}
  .doc.compact .stats{gap:4mm}
  .doc.compact .stat-val{font-size:8.5pt}
  .doc.compact .prod-sub-val{font-size:11pt}
  .doc.compact .total-val{font-size:18pt}
  @media print{.doc{margin:0;box-shadow:none}}
`;

const CHANNEL_PDF_VIA = {
  aereo_negro: "Aéreo",
  aereo_blanco: "Aéreo",
  maritimo_negro: "Marítimo",
  maritimo_blanco: "Marítimo",
};

export function printGiQuotePdf({ quote, products = [], client, settings, requestCode }) {
  const cn = client ? `${client.first_name || ""} ${client.last_name || ""}`.trim() : (quote.gi_quote_requests?.clients ? `${quote.gi_quote_requests.clients.first_name || ""} ${quote.gi_quote_requests.clients.last_name || ""}`.trim() : "Cliente");
  const code = requestCode || quote.request_code || quote.gi_quote_requests?.request_code || "GI-—";
  const issuedDate = fmtDate(quote.sent_at || quote.created_at || new Date().toISOString());
  // Validez: si expires_at está, calcular días. Sino default 15.
  let validityDays = 15;
  if (quote.expires_at) {
    const ref = new Date(quote.sent_at || quote.created_at || Date.now());
    const exp = new Date(quote.expires_at);
    const d = Math.round((exp - ref) / 86400000);
    if (d > 0) validityDays = d;
  }
  // Total: si hay canal seleccionado, usa ese. Si no, usa el más barato disponible.
  const channels = [
    { key: "aereo_negro", total: Number(quote.cost_courier_total_usd || 0) },
    { key: "aereo_blanco", total: Number(quote.cost_aereo_int_total_usd || 0) },
    { key: "maritimo_negro", total: Number(quote.cost_maritimo_lcl_total_usd || 0) },
    { key: "maritimo_blanco", total: Number(quote.cost_maritimo_int_total_usd || 0) },
  ].filter(c => c.total > 0).sort((a, b) => a.total - b.total);
  const selectedKey = quote.selected_channel || (channels[0]?.key);
  const totalKey = {
    aereo_negro: "cost_courier_total_usd",
    aereo_blanco: "cost_aereo_int_total_usd",
    maritimo_negro: "cost_maritimo_lcl_total_usd",
    maritimo_blanco: "cost_maritimo_int_total_usd",
  }[selectedKey];
  const channelTotal = Number(quote[totalKey] || 0);
  const deliveryCost = Number(quote.selected_delivery_cost_usd || 0);
  const finalTotal = channelTotal + deliveryCost;
  const via = CHANNEL_PDF_VIA[selectedKey] || "—";
  const maxLead = products.reduce((m, p) => Math.max(m, Number(p.lead_time_days || 0)), 0);
  const channelMeta = CHANNEL_PDF_NAMES[selectedKey] || { name: selectedKey, time: "—" };
  const plan = Array.isArray(quote.payment_plan) ? quote.payment_plan : (typeof quote.payment_plan === "string" ? (() => { try { return JSON.parse(quote.payment_plan); } catch { return []; } })() : []);
  const planFallback = (plan.length > 0 ? plan : [
    { pct: 30, label: "Al iniciar producción" },
    { pct: 20, label: "Producción terminada" },
    { pct: 50, label: "Contra entrega en Bs As" },
  ]).filter(s => Number(s.pct || 0) > 0);
  const cliInitial = (cn[0] || "C").toUpperCase();

  // El cliente paga el TOTAL llave-en-mano (finalTotal). Lo prorrateamos entre productos por share de FOB
  // y mostramos como "precio unitario" el precio FINAL al cliente (FOB + flete + impuestos + honorarios / qty),
  // no el costo FOB en origen — que es lo que importa al cliente que ve este PDF.
  const totalFobAll = products.reduce((s, p) => s + Number(p.unit_cost_usd || 0) * Number(p.quantity || 0), 0);
  const productsHtml = products.map(p => {
    const qty = Number(p.quantity || 0);
    const itemFob = qty * Number(p.unit_cost_usd || 0);
    const share = totalFobAll > 0 ? itemFob / totalFobAll : (1 / Math.max(products.length, 1));
    const itemSubtotal = finalTotal * share; // porción prorrateada del total llave-en-mano
    const itemUnitPrice = qty > 0 ? itemSubtotal / qty : 0;
    const lead = Number(p.lead_time_days || 0);
    const img = p.photo_url ? `<img src="${p.photo_url}" alt="" class="prod-img" onerror="this.style.display='none'"/>` : `<div class="prod-img-ph">📦</div>`;
    return `<div class="prod">
      ${img}
      <div class="prod-mid">
        <p class="prod-name">${p.description || "—"}</p>
        <div class="stats">
          <div><p class="stat-lbl">Cantidad</p><p class="stat-val">${qty} unidades</p></div>
          <div><p class="stat-lbl">Precio unitario</p><p class="stat-val">${usd(itemUnitPrice)}</p></div>
          ${lead > 0 ? `<div><p class="stat-lbl">Producción</p><p class="stat-val">${lead} días hábiles</p></div>` : ""}
          <div><p class="stat-lbl">Vía</p><p class="stat-val">${via}</p></div>
        </div>
      </div>
      <div class="prod-sub-wrap">
        <p class="prod-sub-lbl">Subtotal</p>
        <p class="prod-sub-val">${usd(itemSubtotal)}</p>
      </div>
    </div>`;
  }).join("");

  const planHtml = planFallback.map(s => `<div class="pay-row">
    <span class="pay-pct">${s.pct}%</span>
    <span class="pay-lbl">${s.label || ""}</span>
    <span class="pay-amt">${usd(Math.round(finalTotal * Number(s.pct || 0) / 100))}</span>
  </div>`).join("");

  // Tiempos
  const transitDays = via === "Aéreo" ? 10 : 60;
  const totalDays = maxLead + transitDays;
  const transitLabel = via === "Aéreo" ? "Envío aéreo + despacho aduanero" : "Envío marítimo + despacho aduanero";

  const compactMode = products.length >= 6;
  const html = `<div class="doc${compactMode ? " compact" : ""}">
    <div class="hd">
      <div class="hd-left">
        <p class="ttl">PRESUPUESTO</p>
        <p class="sub">Gestión Integral · Importación Llave en Mano</p>
      </div>
      <div class="hd-right">
        <p class="code">${code}</p>
        <p class="meta">EMITIDO: <b>${issuedDate}</b></p>
        <p class="meta">VALIDEZ: <b>${validityDays} días</b></p>
      </div>
    </div>

    <div class="cli-bar">
      <div class="cli-left">
        <div class="cli-circle">${cliInitial}</div>
        <div>
          <p class="cli-lbl">Cliente</p>
          <p class="cli-name">${cn}</p>
        </div>
      </div>
      <div class="cli-right">
        <p class="cli-lbl">Modalidad</p>
        <p class="cli-mod">Gestión Integral</p>
      </div>
    </div>

    <div class="body">
      <p class="sec-title">Productos cotizados</p>
      ${productsHtml}

      <div class="total-bar">
        <p class="total-lbl">Total Importación Llave en Mano</p>
        <p class="total-val">${usd(finalTotal)}</p>
      </div>

      <div class="grid2">
        <div class="panel">
          <p class="panel-h">💳 Modalidad de pago</p>
          ${planHtml}
        </div>
        <div class="panel">
          <p class="panel-h">📅 Tiempos estimados</p>
          <div class="time-row"><span class="time-lbl">Producción en origen</span><span class="time-val">${maxLead > 0 ? `${maxLead} días hábiles` : "Según producto"}</span></div>
          <div class="time-row"><span class="time-lbl">${transitLabel}</span><span class="time-val">${transitDays} días</span></div>
          <div class="time-row"><span class="time-lbl">Entrega total estimada</span><span class="time-val">~${totalDays} días hábiles</span></div>
        </div>
      </div>
    </div>

    <div class="ft">
      <div>
        <p class="ft-brand">ARGENCARGO</p>
        <p class="ft-line"><b>Tel:</b> ${settings?.office_phone || "+54 9 11 2508-8580"} &nbsp;·&nbsp; <b>Email:</b> info@argencargo.com.ar</p>
        <p class="ft-line">${settings?.office_address || "Av. Callao 1137"}${settings?.office_locality ? ` — ${settings.office_locality}` : ""}</p>
      </div>
      <p class="ft-url">argencargo.com.ar</p>
    </div>
  </div>`;

  const w = window.open("", "_blank");
  if (!w) { alert("El navegador bloqueó la ventana de impresión. Permití pop-ups."); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Presupuesto ${code}</title><style>${giQuoteStyles}</style></head><body>${html}<script>setTimeout(()=>window.print(),600);</script></body></html>`);
  w.document.close();
}

// ─────────────────────────────────────────────────────────────────────
// PDF Marítimos en tránsito por depósito
// ─────────────────────────────────────────────────────────────────────
const maritimeStyles = `
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:0}
  @page{size:A4;margin:0}
  @media print{
    @page{margin:0}
    .pedido{page-break-inside:avoid;break-inside:avoid}
    .index-table{page-break-inside:avoid;break-inside:avoid}
    .sec-detail{page-break-before:always;break-before:page}
  }
  html,body{font-family:'Helvetica Neue','Inter','PingFang SC','Hiragino Sans GB','Microsoft YaHei','Source Han Sans CN','Noto Sans CJK SC',-apple-system,Arial,sans-serif;color:#1a1a1a;font-size:10pt;line-height:1.5;background:#fff}
  .doc{padding:14mm 14mm 14mm 14mm;max-width:210mm;margin:0 auto}
  .hd{text-align:center;margin-bottom:7mm;padding-bottom:5mm;border-bottom:1.5px solid #0A1628}
  .hd-kicker{font-size:9pt;font-weight:700;letter-spacing:0.22em;color:#888;text-transform:uppercase;margin-bottom:2mm}
  .hd-title{font-size:20pt;font-weight:800;letter-spacing:-0.01em;color:#0A1628;line-height:1.15}
  .sec-bar{background:#0A1628;color:#fff;padding:2.5mm 4mm;font-size:9.5pt;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;border-radius:2mm 2mm 0 0;margin-top:5mm}
  .summary-table{width:100%;border-collapse:collapse;font-size:10pt;border:1px solid #ebe6db;border-top:none;border-radius:0 0 2mm 2mm;overflow:hidden}
  .summary-table tr{border-bottom:1px solid #f0eadc}
  .summary-table tr:last-child{border-bottom:none;background:#0A1628;color:#fff;font-weight:800}
  .summary-table td{padding:2.5mm 4mm}
  .summary-table td:last-child{text-align:right;font-feature-settings:"tnum";font-weight:700}
  .index-table{width:100%;border-collapse:collapse;font-size:9.5pt;border:1px solid #ebe6db;border-top:none;border-radius:0 0 2mm 2mm;overflow:hidden}
  .index-table th{background:#1B4F8A;color:#fff;padding:2mm 3mm;text-align:left;font-size:8.5pt;font-weight:700;letter-spacing:0.04em}
  .index-table th:last-child{text-align:right}
  .index-table td{padding:2mm 3mm;border-bottom:1px solid #f0eadc;font-feature-settings:"tnum"}
  .index-table td:last-child{text-align:right}
  .index-table tr:last-child td{border-bottom:none}
  .rotulo-box{margin-top:4mm;padding:3.5mm 5mm;background:#f8f6ef;border:1px solid #ebe6db;border-radius:2mm}
  .rotulo-lbl{font-size:8.5pt;font-weight:700;letter-spacing:0.1em;color:#666;text-transform:uppercase;margin-bottom:1.5mm}
  .rotulo-val{font-size:11pt;font-weight:700;color:#0A1628;line-height:1.55}
  .pedido{margin-top:5mm;padding-top:3mm;border-top:1px solid #ebe6db;page-break-inside:avoid}
  .pedido:first-of-type{border-top:none;padding-top:0}
  .pedido-head{display:flex;align-items:baseline;gap:3mm;margin-bottom:1mm;flex-wrap:wrap}
  .pedido-code{font-size:10pt;font-weight:800;color:#0A1628;letter-spacing:0.04em}
  .pedido-name{font-size:10.5pt;font-weight:700;color:#0A1628}
  .pedido-tracking{font-size:8.5pt;color:#555;margin-bottom:1.5mm}
  .pedido-tracking b{color:#1a1a1a;font-weight:700;font-family:'SF Mono',monospace}
  .bultos-table{width:100%;border-collapse:collapse;font-size:8.5pt;border:1px solid #ebe6db;border-radius:2mm;overflow:hidden;margin-top:1mm}
  .bultos-table th{background:#0A1628;color:#fff;padding:1.5mm 3mm;text-align:center;font-size:8pt;font-weight:700;letter-spacing:0.04em}
  .bultos-table th:first-child{text-align:left}
  .bultos-table td{padding:1.4mm 3mm;border-bottom:1px solid #f0eadc;font-feature-settings:"tnum";text-align:center}
  .bultos-table td:first-child{text-align:left}
  .bultos-table .total td{border-top:1.5px solid #0A1628;border-bottom:none;font-weight:800;background:#f8f6ef}
  .invoice-box{margin-top:1.5mm;padding:2.2mm 3.5mm;background:#fafaf7;border:1px dashed #ebe6db;border-radius:2mm}
  .invoice-h{font-size:7.5pt;font-weight:800;letter-spacing:0.06em;color:#666;text-transform:uppercase;margin-bottom:1mm}
  .invoice-row{display:flex;justify-content:space-between;font-size:8pt;padding:0.6mm 0;border-bottom:1px dotted #e5e0d3}
  .invoice-row:last-child{border-bottom:none}
  .invoice-row .name{flex:1;color:#333}
  .invoice-row .qty{color:#777;width:16mm;text-align:right;font-feature-settings:"tnum"}
  .invoice-row .amt{color:#0A1628;font-weight:700;width:20mm;text-align:right;font-feature-settings:"tnum"}
  .invoice-total{display:flex;justify-content:space-between;padding-top:1.2mm;margin-top:1mm;border-top:1.2px solid #0A1628;font-weight:800;font-size:8.5pt;color:#0A1628}
`;

// i18n del PDF marítimo (ES / EN / ZH)
const MARITIME_I18N = {
  es: {
    kicker: "Marítimos", summary: "Resumen", index: "Índice de pedidos", detailHdr: "Detalle por pedido",
    totalShipments: "Total de pedidos", totalBultos: "Total de bultos", cbmTotal: "CBM TOTAL", partial: "(parcial)",
    rotulo: "Rótulo de llegada de las cajas",
    col: { code: "Código", tracking: "Seguimiento", received: "Recepción", merchandise: "Mercadería", cbm: "CBM" },
    bultoTbl: { bulto: "Cant.", dims: "Medidas (cm)", cbm: "CBM", cbmTot: "CBM TOTAL" },
    pending: "Pendiente",
    noPkgs: "Sin detalle de bultos por ahora — CBM pendiente",
    invoiceTitle: "Detalle de mercadería", invoiceTotal: "Total mercadería",
    trackLabel: "Seguimiento", receivedLabel: "Recepción en depósito",
    noTrack: "Sin código de seguimiento",
    dateLocale: "es-AR",
  },
  en: {
    kicker: "Maritime", summary: "Summary", index: "Shipments index", detailHdr: "Shipment details",
    totalShipments: "Total shipments", totalBultos: "Total packages", cbmTotal: "TOTAL CBM", partial: "(partial)",
    rotulo: "Box arrival label",
    col: { code: "Code", tracking: "Tracking", received: "Received", merchandise: "Merchandise", cbm: "CBM" },
    bultoTbl: { bulto: "Qty", dims: "Dimensions (cm)", cbm: "CBM", cbmTot: "TOTAL CBM" },
    pending: "Pending",
    noPkgs: "No package details yet — CBM pending",
    invoiceTitle: "Merchandise detail", invoiceTotal: "Merchandise total",
    trackLabel: "Tracking", receivedLabel: "Warehouse reception",
    noTrack: "No tracking number",
    dateLocale: "en-US",
  },
  zh: {
    kicker: "海运", summary: "汇总", index: "订单索引", detailHdr: "订单明细",
    totalShipments: "订单总数", totalBultos: "件数总计", cbmTotal: "总体积 CBM", partial: "（部分）",
    rotulo: "到货标签",
    col: { code: "编号", tracking: "追踪号", received: "签收日期", merchandise: "货物", cbm: "体积" },
    bultoTbl: { bulto: "数量", dims: "尺寸 (cm)", cbm: "体积", cbmTot: "总体积" },
    pending: "待定",
    noPkgs: "暂无件数明细 — 体积待定",
    invoiceTitle: "货物清单", invoiceTotal: "货物总计",
    trackLabel: "追踪号", receivedLabel: "仓库签收",
    noTrack: "无追踪号",
    dateLocale: "zh-CN",
  },
};

export function printMaritimePdf({ warehouse, origin, shipments = [], rotulo = "", lang = "es", withValues = true }) {
  const T = MARITIME_I18N[lang] || MARITIME_I18N.es;
  const totalShipments = shipments.length;
  const totalBultos = shipments.reduce((s, sh) => s + (sh.packages || []).length, 0);
  const totalCbm = shipments.reduce((s, sh) => s + (sh.packages || []).reduce((x, p) => x + Number(p.cbm || 0), 0), 0);
  const pendingCbm = shipments.filter(sh => !(sh.packages || []).some(p => Number(p.cbm || 0) > 0)).length;
  const originLabel = origin === "usa" ? "USA" : "CHINA";

  const fmtShortDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString(T.dateLocale, { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  const cbmFmt = (n) => Number(n).toLocaleString(T.dateLocale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const idxRows = shipments.map((sh, i) => {
    const code = sh.shipment_code || `#${i + 1}`;
    const cbmSum = (sh.packages || []).reduce((s, p) => s + Number(p.cbm || 0), 0);
    const cbmTxt = cbmSum > 0 ? cbmFmt(cbmSum) : T.pending;
    return `<tr><td><b>${code}</b></td><td>${sh.tracking_number || "—"}</td><td>${fmtShortDate(sh.received_at)}</td><td>${sh.product_description || "—"}</td><td>${cbmTxt}</td></tr>`;
  }).join("");

  const detailHtml = shipments.map((sh, i) => {
    const code = sh.shipment_code || `#${i + 1}`;
    const tracking = sh.tracking_number || T.noTrack;
    const pkgs = sh.packages || [];
    const items = sh.items || [];
    const cbmSum = pkgs.reduce((s, p) => s + Number(p.cbm || 0), 0);
    const bultoRows = pkgs.length > 0 ? pkgs.map((p, idx) => {
      const dim = p.length_cm && p.width_cm && p.height_cm ? `${p.length_cm} × ${p.width_cm} × ${p.height_cm}` : "—";
      const cbm = p.cbm ? cbmFmt(p.cbm) : "—";
      const qty = Number(p.quantity || 1);
      return `<tr><td>×${qty}</td><td>${dim}</td><td>${cbm}</td></tr>`;
    }).join("") + `<tr class="total"><td colspan="2">${T.bultoTbl.cbmTot}</td><td>${cbmSum > 0 ? cbmFmt(cbmSum) : T.pending}</td></tr>` : "";
    const itemsRows = items.length > 0 ? items.map(it => {
      const qty = Number(it.quantity || 0);
      const price = Number(it.unit_price_usd || 0);
      const sub = qty * price;
      return `<div class="invoice-row"><span class="name">${it.description || "—"}${it.notes ? ` <small style="color:#999">· ${it.notes}</small>` : ""}</span><span class="qty">${qty} u.</span><span class="amt">${usd(sub)}</span></div>`;
    }).join("") : "";
    const invoiceSubtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price_usd || 0), 0);

    return `<div class="pedido">
      <div class="pedido-head">
        <span class="pedido-code">${code}</span>
        <span class="pedido-name">${sh.product_description || "—"}</span>
      </div>
      <p class="pedido-tracking"><b>${T.trackLabel}:</b> ${tracking}${sh.received_at ? ` &nbsp;·&nbsp; <b>${T.receivedLabel}:</b> ${fmtShortDate(sh.received_at)}` : ""}</p>
      ${pkgs.length > 0 ? `<table class="bultos-table">
        <thead><tr><th>${T.bultoTbl.bulto}</th><th>${T.bultoTbl.dims}</th><th>${T.bultoTbl.cbm}</th></tr></thead>
        <tbody>${bultoRows}</tbody>
      </table>` : `<div class="invoice-box" style="background:#fef3c7;border-color:#fcd34d;color:#92400e"><b>${T.noPkgs}</b></div>`}
      ${withValues && itemsRows ? `<div class="invoice-box">
        <p class="invoice-h">${T.invoiceTitle}</p>
        ${itemsRows}
        ${invoiceSubtotal > 0 ? `<div class="invoice-total"><span>${T.invoiceTotal}</span><span>${usd(invoiceSubtotal)}</span></div>` : ""}
      </div>` : ""}
    </div>`;
  }).join("");

  const html = `<div class="doc">
    <div class="hd">
      <p class="hd-kicker">${T.kicker}</p>
      <p class="hd-title">${warehouse}</p>
    </div>

    <div class="sec-bar">${T.summary}</div>
    <table class="summary-table">
      <tr><td>${T.totalShipments}</td><td>${totalShipments}</td></tr>
      <tr><td>${T.totalBultos}</td><td>${totalBultos}</td></tr>
      <tr><td><b>${T.cbmTotal} ${pendingCbm > 0 ? T.partial : ""}</b></td><td>${cbmFmt(totalCbm)}</td></tr>
    </table>

    ${rotulo ? `<div class="rotulo-box">
      <p class="rotulo-lbl">${T.rotulo}</p>
      <p class="rotulo-val">${rotulo.replace(/\n/g, "<br>")}</p>
    </div>` : ""}

    <div class="sec-bar">${T.index}</div>
    <table class="index-table">
      <thead><tr><th>${T.col.code}</th><th>${T.col.tracking}</th><th>${T.col.received}</th><th>${T.col.merchandise}</th><th>${T.col.cbm}</th></tr></thead>
      <tbody>${idxRows}</tbody>
    </table>

    <div class="sec-bar sec-detail">${T.detailHdr}</div>
    ${detailHtml}
  </div>`;

  const w = window.open("", "_blank");
  if (!w) { alert("El navegador bloqueó la ventana de impresión. Permití pop-ups."); return; }
  const packScript = `
    function packPedidos(){
      try {
        var detail = document.querySelector('.sec-detail');
        var pedidos = Array.prototype.slice.call(document.querySelectorAll('.pedido'));
        if (!detail || pedidos.length < 2) return;
        var parent = pedidos[0].parentNode;
        // A4 a 96dpi ≈ 1123px de alto; restamos un colchón para márgenes/padding del .doc (14mm + 14mm)
        var pageH = 297 * 3.7795;
        var bottomBuffer = 14 * 3.7795 + 12; // padding inferior + margen seguridad
        var availPerPage = pageH - bottomBuffer;
        var firstPageStart = detail.offsetTop + detail.offsetHeight;
        // Como .sec-detail tiene page-break-before:always, en impresión queda al tope de una página nueva.
        // Espacio disponible debajo del título en la primera página de detalle:
        var availFirstPage = availPerPage - detail.offsetHeight;
        var data = pedidos.map(function(el){
          var rect = el.getBoundingClientRect();
          var mt = parseFloat(getComputedStyle(el).marginTop) || 0;
          return { el: el, h: rect.height + mt };
        });
        var remaining = data.slice();
        var ordered = [];
        var yOnPage = 0;
        var firstPage = true;
        while (remaining.length > 0) {
          var cap = firstPage ? availFirstPage : availPerPage;
          var space = cap - yOnPage;
          var idx = -1;
          for (var i = 0; i < remaining.length; i++) {
            if (remaining[i].h <= space) { idx = i; break; }
          }
          if (idx === -1) {
            // ninguno entra → arranca página nueva con el siguiente
            ordered.push(remaining[0]);
            yOnPage = remaining[0].h;
            remaining.shift();
            firstPage = false;
          } else {
            ordered.push(remaining[idx]);
            yOnPage += remaining[idx].h;
            remaining.splice(idx, 1);
          }
        }
        ordered.forEach(function(o){ parent.appendChild(o.el); });
      } catch(e) { console.error('packPedidos failed', e); }
    }
    var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    fontsReady.then(function(){
      // Pequeña espera extra para asegurar que los glyphs CJK se descargaron antes del print
      setTimeout(function(){ packPedidos(); setTimeout(function(){ window.print(); }, 150); }, 500);
    });
  `;
  // Para chino, cargamos Noto Sans SC desde Google Fonts → garantiza glyphs CJK en el print
  // (sin esto, Chrome usa un fallback que a veces deja los CJK invisibles)
  const fontLink = lang === "zh"
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600;700;800&display=swap" rel="stylesheet">`
    : "";
  const extraCss = lang === "zh"
    ? `<style>html,body,.sec-bar,.hd-kicker,.hd-title,.rotulo-lbl,.rotulo-val,.index-table th,.index-table td,.summary-table td,.bultos-table th,.bultos-table td,.pedido-name,.pedido-code,.pedido-tracking,.invoice-h{font-family:'Noto Sans SC','PingFang SC','Hiragino Sans GB','Microsoft YaHei','Source Han Sans CN',-apple-system,Arial,sans-serif !important}</style>`
    : "";
  w.document.write(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title> </title>${fontLink}<style>${maritimeStyles}</style>${extraCss}</head><body>${html}<script>${packScript}</script></body></html>`);
  w.document.close();
}
