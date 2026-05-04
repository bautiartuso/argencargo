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
// 0. ETIQUETAS DE PAQUETES (100x150mm — formato shipping label)
// ─────────────────────────────────────────────────────────
// Imprime una etiqueta por bulto en la op. Branding Argencargo + peso destacado + QR
// que linkea a /track/AC-XXXX. Pensado para impresora térmica o A4 con corte.

const labelStyles = `
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:0}
  @page{size:100mm 150mm;margin:0}
  body{font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#000}
  .label{width:100mm;height:150mm;padding:6mm 5mm;display:flex;flex-direction:column;page-break-after:always;border:1px dashed #ddd}
  .label:last-child{page-break-after:auto}
  .lbl-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${NAVY};padding-bottom:4mm;margin-bottom:4mm}
  .lbl-header img{height:11mm}
  .lbl-header .ar{font-size:8pt;font-weight:700;color:${NAVY};text-transform:uppercase;letter-spacing:0.5px;text-align:right;line-height:1.3}
  .lbl-code{font-family:'SF Mono','Courier New',monospace;font-size:18pt;font-weight:800;color:${NAVY};letter-spacing:1px;margin-bottom:1mm}
  .lbl-cli{font-size:9pt;color:#444;margin-bottom:3mm;font-weight:600}
  .lbl-bulto-num{display:inline-block;padding:1.5mm 4mm;background:${GOLD};color:#fff;font-size:9pt;font-weight:800;border-radius:3px;letter-spacing:1px;margin-bottom:3mm}
  .lbl-peso-box{background:#f5f7fa;border:1.5px solid ${NAVY};border-radius:6px;padding:4mm;text-align:center;margin-bottom:3mm}
  .lbl-peso-label{font-size:7pt;color:#666;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:1mm;font-weight:700}
  .lbl-peso-val{font-size:24pt;font-weight:800;color:${NAVY};letter-spacing:-0.5px;line-height:1}
  .lbl-peso-detail{font-size:7pt;color:#888;margin-top:1mm}
  .lbl-merch{font-size:8pt;color:#444;margin-bottom:3mm;line-height:1.3;max-height:14mm;overflow:hidden}
  .lbl-merch b{color:${NAVY};font-weight:700;font-size:7pt;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:1mm}
  .lbl-bottom{margin-top:auto;display:flex;align-items:center;gap:3mm;border-top:1.5px solid #e5e7eb;padding-top:3mm}
  .lbl-qr{width:25mm;height:25mm;flex-shrink:0}
  .lbl-qr img{width:100%;height:100%}
  .lbl-bottom-info{flex:1;font-size:7pt;color:#666;line-height:1.4}
  .lbl-bottom-info b{color:${NAVY};font-size:8pt;display:block;margin-bottom:1mm;letter-spacing:0.5px}
  .lbl-tracking{font-family:'SF Mono','Courier New',monospace;font-size:7pt;background:#f0f0f0;padding:1mm 2mm;border-radius:2px;display:inline-block;margin-top:1mm}
  @media print{.label{border:none}}
`;

function qrUrl(text, size = 200) {
  // QR generado por API pública gratuita (sin dependencias)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&margin=0&data=${encodeURIComponent(text)}`;
}

// Resume items para mostrar en la etiqueta (max 3 líneas)
function summarizeItems(items) {
  if (!items || items.length === 0) return "—";
  const list = items.slice(0, 3).map(it => `• ${it.description || "Producto"}${it.quantity > 1 ? ` (x${it.quantity})` : ""}`);
  if (items.length > 3) list.push(`• +${items.length - 3} producto${items.length - 3 > 1 ? "s" : ""} más`);
  return list.join("\n");
}

export function printPackageLabels({ op, packages = [], items = [], client, baseUrl = "https://www.argencargo.com.ar" }) {
  if (!packages || packages.length === 0) {
    alert("Esta operación no tiene bultos cargados.");
    return;
  }
  const trackUrl = `${baseUrl}/track/${op.operation_code}`;
  const itemsSummary = summarizeItems(items);
  const labels = packages.map((pk, idx) => {
    const q = Number(pk.quantity || 1);
    const gw = Number(pk.gross_weight_kg || 0);
    const l = Number(pk.length_cm || 0), w = Number(pk.width_cm || 0), h = Number(pk.height_cm || 0);
    const totalGw = (gw * q).toFixed(2);
    const dims = l && w && h ? `${l}×${w}×${h} cm` : null;
    const cbm = l && w && h ? ((l * w * h) / 1000000) * q : 0;
    return `<div class="label">
      <div class="lbl-header">
        <img src="${LOGO}" alt="Argencargo"/>
        <div class="ar">Argencargo<br/>Importaciones</div>
      </div>

      <div class="lbl-code">${op.operation_code}</div>
      <div class="lbl-cli">${client?.client_code || "—"} · ${client?.first_name || ""} ${client?.last_name || ""}</div>

      <div class="lbl-bulto-num">📦 BULTO ${pk.package_number || idx + 1} de ${packages.length}${q > 1 ? ` · CONTIENE ${q}` : ""}</div>

      <div class="lbl-peso-box">
        <div class="lbl-peso-label">Peso bruto</div>
        <div class="lbl-peso-val">${gw > 0 ? `${totalGw} kg` : "—"}</div>
        ${dims ? `<div class="lbl-peso-detail">${dims}${cbm > 0 ? ` · ${cbm.toFixed(4)} m³` : ""}</div>` : ""}
      </div>

      <div class="lbl-merch">
        <b>Mercadería</b>
        ${itemsSummary.replace(/\n/g, "<br/>")}
      </div>

      <div class="lbl-bottom">
        <div class="lbl-qr"><img src="${qrUrl(trackUrl, 200)}" alt="QR seguimiento"/></div>
        <div class="lbl-bottom-info">
          <b>Seguimiento</b>
          Escaneá para ver el estado en tiempo real
          <div class="lbl-tracking">${op.operation_code}</div>
        </div>
      </div>
    </div>`;
  }).join("");

  const w = window.open("", "_blank");
  if (!w) { alert("El navegador bloqueó la ventana de impresión. Permití pop-ups."); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${op.operation_code}</title><style>${labelStyles}</style></head><body>${labels}<script>setTimeout(()=>window.print(),700);</script></body></html>`);
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
