// Impresos del panel de Entregas (25/09/2026), con la misma estética del recibo de pago
// (marco negro, RECIBO en itálica, logo a la derecha, renglones subrayados).
//
// · printRecibosEntrega: una hoja A4 por operación. Arriba el COMPROBANTE DE ENTREGA que firma el
//   cliente (recibió conforme la mercadería, N bultos); abajo el RECIBO de la plata con el importe
//   que paga en la entrega con el medio que eligió (o lo ya abonado, si pagó antes). Sin duplicado.
// · printRemitos: dos remitos por hoja (ORIGINAL cliente / DUPLICADO Argencargo), sin plata: la
//   mercadería que contiene, los bultos y la operación de referencia.
import { numeroALetras } from "./pdf-templates";

const ISOTIPO = "https://www.argencargo.com.ar/brand/isotipo.png";
const LOGO_COLOR = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const METODO = { efectivo: "Efectivo", transferencia: "Transferencia bancaria", crypto: "Criptomoneda (USDT · TRC-20)", cripto: "Criptomoneda (USDT · TRC-20)", tarjeta: "Tarjeta", mercado_pago: "Mercado Pago", cuenta_corriente: "Cuenta corriente" };

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f2 = (v) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = (v) => Math.round(Number(v || 0)).toLocaleString("es-AR");
const dObj = (d) => (d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? `${d}T12:00:00` : d) : new Date());
const fechaLarga = (d) => { const x = dObj(d); return `${x.getDate()} de ${MESES[x.getMonth()]} de ${x.getFullYear()}`; };
const fechaDia = (iso) => { if (!iso) return ""; const d = dObj(iso); return `${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
const metodoTxt = (m) => METODO[String(m || "").toLowerCase()] || (m ? String(m).replace(/_/g, " ") : "—");
const fmtCuit = (c) => { const d = String(c || "").replace(/\D/g, ""); return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : String(c || ""); };
const fmtDni = (c) => { const d = String(c || "").replace(/\D/g, ""); return d ? Number(d).toLocaleString("es-AR") : String(c || ""); };
const nombreCliente = (c) => (c?.company_name || "").trim() || `${c?.first_name || ""} ${c?.last_name || ""}`.trim() || "—";
const docCliente = (c) => (c?.cuit ? `CUIT ${fmtCuit(c.cuit)}` : c?.dni ? `DNI ${fmtDni(c.dni)}` : "");
const enLetras = (monto, ars) => { const entero = Math.floor(monto), cent = Math.round((monto - entero) * 100); return `${ars ? "Pesos" : "Dólares estadounidenses"} ${numeroALetras(entero)}${cent ? ` con ${String(cent).padStart(2, "0")}/100` : ""}`; };
const entregaTxt = (op, settings = {}) => op.delivery_choice === "propio"
  ? `Envío a domicilio · ${op.delivery_address || ""}`.trim()
  : op.delivery_choice === "carrier" ? `Envío por transportista${op.carrier_mode ? ` · ${op.carrier_mode}` : ""}`
  : `Retiro por oficina${settings.office_address ? ` · ${settings.office_address}` : ""}`;

// Misma hoja de estilos que el recibo de pago, adaptada a media hoja A4 (dos marcos por página).
const CSS = `
  @page{size:A4 portrait;margin:0}
  *{box-sizing:border-box}
  body{margin:0;font-family:Inter,Helvetica,Arial,sans-serif;color:#111;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hoja{width:210mm;height:297mm;position:relative;page-break-after:always;overflow:hidden;padding:6mm 9mm 0}
  .hoja:last-child{page-break-after:auto}
  .rc{width:192mm;height:126mm;overflow:hidden;padding:7mm 9mm;border:1.5px solid #111;border-radius:6px;position:relative;display:flex;flex-direction:column}
  .rc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
  .rc-head .left{display:flex;align-items:baseline;gap:22px}
  .rc-head h1{font-size:24px;font-weight:900;letter-spacing:0.04em;margin:0;font-style:italic;color:#1B4F8A}
  .rc-head .nro{font-size:13px;font-weight:700}
  .rc-head .nro b{font-family:ui-monospace,Menlo,monospace;font-size:16px;border-bottom:1.5px solid #111;padding:0 10px}
  .rc-head .right img{height:20mm;width:auto;display:block;margin:-2mm 0}
  .rc-lbl{font-size:8.5px;font-style:italic;color:#6b7280;margin-top:2px}
  .rc-row{display:flex;align-items:baseline;gap:8px;font-size:12px;line-height:1.5;padding:2px 0}
  .rc-row .k{flex:0 0 auto;font-style:italic;color:#374151;white-space:nowrap}
  .rc-row .v{flex:1;border-bottom:1px solid #6b7280;padding:0 6px;min-height:16px;font-weight:600}
  .rc-row.big .v{font-size:15px;font-weight:800}
  .rc-box{background:#e5e7eb;border-radius:9px;padding:0 16px;height:34px;display:flex;align-items:center;font-size:13px;font-weight:700;font-style:italic;color:#111;line-height:1;margin:3px 0 5px}
  .rc-det{display:grid;grid-template-columns:1fr 1fr;gap:2px 22px;margin-top:2px}
  .rc-det .rc-row{font-size:11px}
  .rc-sign{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:30px;padding-top:14px}
  .rc-sign .sg{flex:0 0 46%;border-top:1px solid #111;padding-top:5px;font-size:10.5px;color:#374151;text-align:center}
  .rc-sign .sg b{display:block;font-size:11.5px;color:#111}
  .rc-sign .sg small{font-size:8.5px;color:#6b7280}
  table.mer{width:100%;border-collapse:collapse;font-size:10.5px;margin-top:4px}
  table.mer th{text-align:left;font-size:8.5px;font-style:italic;font-weight:600;color:#6b7280;padding:2px 4px;border-bottom:1px solid #6b7280}
  table.mer td{padding:2px 4px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-weight:600}
  table.mer td.n,table.mer th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .rc-after{width:192mm;height:14mm;display:flex;justify-content:space-between;align-items:center;gap:24px;padding:0 3mm}
  .rc-after .dis{flex:1;font-size:8.5px;color:#9ca3af;line-height:1.45;max-width:80mm}
  .rc-after .txt{text-align:right;font-size:10px;color:#374151;line-height:1.6}
  .rc-after .txt b{color:#111;font-size:11px}
  .corte{height:8mm;display:flex;align-items:center;gap:6px;color:#9ca3af;font-size:8px;letter-spacing:0.2em}
  .corte:before,.corte:after{content:"";flex:1;border-top:1px dashed #9ca3af}
`;

function abrir(titulo, cuerpo) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head><body>${cuerpo}<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html); w.document.close();
  return true;
}

const row = (k, v, extra = "") => `<div class="rc-row${extra}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
const head = (titulo, sub, nro) => `<div class="rc-head">
  <div class="left"><div><h1>${titulo}</h1><div class="rc-lbl">${esc(sub)}</div></div>${nro != null ? `<div class="nro">N.º <b>${nro ? esc(nro) : "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"}</b></div>` : ""}</div>
  <div class="right"><img src="${ISOTIPO}" alt="Argencargo" onerror="this.src='${LOGO_COLOR}'"/></div>
</div>`;
const pie = (settings, dis) => `<div class="rc-after">
  <div class="dis">${dis}</div>
  <div class="txt"><b>argencargo.com.ar</b><br/>info@argencargo.com.ar &nbsp;·&nbsp; +54 9 11 2508-8580<br/>${esc(settings.office_address || "Virrey Loreto 2428")}, ${esc(settings.office_locality || "Belgrano, CABA")}</div>
</div>`;
const firmas = (izq, der) => `<div class="rc-sign">
  <div class="sg"><b>${esc(izq.nombre)}</b>${izq.doc ? esc(izq.doc) : "&nbsp;"}<br/><small>${izq.rol}</small></div>
  <div class="sg"><b>${esc(der.nombre)}</b>${der.doc ? esc(der.doc) : "&nbsp;"}<br/><small>${der.rol}</small></div>
</div>`;
const tablaMercaderia = (items, max) => {
  const lista = Array.isArray(items) ? items : [];
  const vis = lista.slice(0, max), resto = lista.length - vis.length;
  const totU = lista.reduce((s, it) => s + Number(it.quantity || 0), 0);
  if (!lista.length) return `<div class="rc-lbl" style="margin-top:6px">Sin detalle de mercadería cargado en la operación.</div>`;
  return `<table class="mer"><thead><tr><th>Mercadería</th><th class="n">Cantidad</th></tr></thead><tbody>
    ${vis.map((it) => `<tr><td>${esc(it.description || "—")}</td><td class="n">${f0(it.quantity)}</td></tr>`).join("")}
    ${resto > 0 ? `<tr><td style="color:#6b7280;font-style:italic;font-weight:500">… y ${resto} ítem${resto !== 1 ? "s" : ""} más</td><td class="n"></td></tr>` : ""}
    <tr><td style="font-style:italic;color:#374151">${lista.length} ítem${lista.length !== 1 ? "s" : ""}</td><td class="n">${f0(totU)} u</td></tr>
  </tbody></table>`;
};
const resumenMercaderia = (items, max = 3) => {
  const lista = Array.isArray(items) ? items : [];
  if (!lista.length) return "mercadería según operación";
  const txt = lista.slice(0, max).map((it) => `${f0(it.quantity)} ${esc(it.description || "")}`.trim()).join(" · ");
  return lista.length > max ? `${txt} · y ${lista.length - max} ítem${lista.length - max !== 1 ? "s" : ""} más` : txt;
};

// ── COMPROBANTE DE ENTREGA (lo firma el cliente) ─────────────────────────────────────────────
function comprobanteEntrega(doc) {
  const { op, client, items, bultos, settings = {} } = doc;
  const c = client || {};
  const emisor = settings.receipt_issuer_name || "Argencargo";
  const emisorDoc = settings.receipt_issuer_doc || "";
  return `<div class="rc">
    ${head("COMPROBANTE DE ENTREGA", `Argencargo · ${op.operation_code}${c.client_code ? ` · ${c.client_code}` : ""}`, op.operation_code)}
    ${row("Lugar y fecha:", `En ${esc(settings.office_locality || "Belgrano, CABA")}, a ${fechaLarga()}`)}
    ${row("Recibí de Argencargo:", `la mercadería de la operación <b>${esc(op.operation_code)}</b>${op.description ? ` · ${esc(op.description)}` : ""}`)}
    ${row("Cantidad de bultos:", `${f0(bultos)} bulto${bultos !== 1 ? "s" : ""} cerrado${bultos !== 1 ? "s" : ""}`, " big")}
    ${row("Contenido:", resumenMercaderia(items, 4))}
    ${row("Modalidad:", esc(entregaTxt(op, settings)) + (op.delivery_day ? ` · ${esc(fechaDia(op.delivery_day))}${op.delivery_slot ? ` ${esc(op.delivery_slot)}` : ""}` : ""))}
    <div class="rc-box" style="height:30px;font-size:12px">Recibí conforme la mercadería detallada, en buen estado y sin faltantes.</div>
    ${firmas({ nombre: emisor, doc: emisorDoc, rol: "Entregó · por Argencargo" }, { nombre: nombreCliente(c), doc: docCliente(c), rol: "Recibió conforme · firma y aclaración" })}
  </div>`;
}

// ── RECIBO (la plata: lo que paga en la entrega, o lo ya abonado) ───────────────────────────
function reciboPlata(doc) {
  const { op, client, pagos = [], pagado = 0, saldo = 0, metodo, monedaElegida, tc = 0, receiptNumber, settings = {} } = doc;
  const c = client || {};
  const emisor = settings.receipt_issuer_name || "Argencargo";
  const emisorDoc = settings.receipt_issuer_doc || "";
  const yaPago = saldo <= 0.005;
  let montoUsd, isArs, montoArs, tcTxt, metodoLbl, fechaPago, concepto;
  if (yaPago) {
    // Ya abonó antes de la entrega: el recibo refleja lo cobrado.
    const ult = pagos[pagos.length - 1] || null;
    montoUsd = pagado;
    isArs = pagos.length === 1 && ult?.currency === "ARS" && Number(ult.amount_ars) > 0;
    montoArs = isArs ? Number(ult.amount_ars) : 0;
    tcTxt = isArs && Number(ult.exchange_rate) > 0 ? `$ ${f0(ult.exchange_rate)} por USD` : "";
    const metodos = [...new Set(pagos.map((p) => metodoTxt(p.payment_method)))].filter(Boolean);
    metodoLbl = metodos.length ? metodos.join(" + ") : metodoTxt(metodo);
    fechaPago = fechaLarga(ult?.payment_date || ult?.created_at || null);
    concepto = `Pago total de la operación ${op.operation_code}${op.description ? ` · ${op.description}` : ""}`;
  } else {
    // Paga en la entrega con el medio que eligió en el link.
    montoUsd = saldo;
    isArs = monedaElegida === "ARS" && tc > 0;
    montoArs = isArs ? Math.round(saldo * tc) : 0;
    tcTxt = isArs ? `$ ${f0(tc)} por USD` : "";
    metodoLbl = metodoTxt(metodo) + (monedaElegida === "ARS" ? " · en pesos" : monedaElegida === "mixto" ? " · USD + pesos" : "");
    fechaPago = fechaLarga(op.delivery_day || null);
    concepto = `Pago ${pagado > 0.005 ? "del saldo" : "total"} de la operación ${op.operation_code}${op.description ? ` · ${op.description}` : ""}`;
  }
  const montoTxt = isArs ? `$ ${f2(montoArs)}` : `USD ${f2(montoUsd)}`;
  const nro = receiptNumber ? String(receiptNumber).padStart(5, "0") : "";
  return `<div class="rc">
    ${head("RECIBO", `Argencargo · ${op.operation_code}${c.client_code ? ` · ${c.client_code}` : ""}`, nro)}
    ${row("Lugar y fecha de expedición:", `En ${esc(settings.office_locality || "Belgrano, CABA")}, a ${fechaLarga()}`)}
    ${row("Recibí de:", `${esc(nombreCliente(c))}${docCliente(c) ? ` &nbsp;·&nbsp; ${esc(docCliente(c))}` : ""}`)}
    ${row("La cantidad de:", montoTxt, " big")}
    <div class="rc-lbl">Cantidad en letra</div>
    <div class="rc-box">${esc(enLetras(isArs ? montoArs : montoUsd, isArs))}</div>
    ${row("Por concepto de:", esc(concepto))}
    <div class="rc-det">
      ${row("Forma de pago:", esc(metodoLbl))}
      ${row("Fecha del pago:", esc(fechaPago))}
      ${isArs && tcTxt ? row("Tipo de cambio:", tcTxt) : ""}
      ${isArs ? row("Equivalente:", `USD ${f2(montoUsd)}`) : ""}
      ${row("Saldo de la operación:", "Cancelada en su totalidad")}
      ${!yaPago && pagado > 0.005 ? row("Abonado antes:", `USD ${f2(pagado)}`) : ""}
    </div>
    ${firmas({ nombre: nombreCliente(c), doc: docCliente(c), rol: "Entregó" }, { nombre: emisor, doc: emisorDoc, rol: "Nombre y firma de quien recibe · por Argencargo" })}
  </div>`;
}

export function printRecibosEntrega(docs) {
  const hojas = docs.map((d) => `<div class="hoja">
    ${comprobanteEntrega(d)}
    ${pie(d.settings || {}, "Comprobante de entrega de mercadería.<br/>No válido como factura.")}
    <div class="corte">✂</div>
    ${reciboPlata(d)}
    ${pie(d.settings || {}, "Documento no válido como factura.<br/>Acredita únicamente la recepción del importe indicado.")}
  </div>`).join("");
  return abrir(`Recibos · ${docs.map((d) => d.op.operation_code).join(", ")}`, hojas);
}

// ── REMITO ───────────────────────────────────────────────────────────────────────────────────
function remito(doc, copia) {
  const { op, client, items, bultos, settings = {} } = doc;
  const c = client || {};
  const emisor = settings.receipt_issuer_name || "Argencargo";
  const emisorDoc = settings.receipt_issuer_doc || "";
  const domicilio = op.delivery_choice === "propio"
    ? (op.delivery_address || [c.street, c.floor_apt, c.city, c.province, c.postal_code].filter(Boolean).join(", "))
    : op.delivery_choice === "carrier" ? entregaTxt(op) : `Retiro en oficina${settings.office_address ? ` · ${settings.office_address}` : ""}`;
  return `<div class="rc">
    ${head("REMITO", `Argencargo · ${op.operation_code}${c.client_code ? ` · ${c.client_code}` : ""} · ${copia}`, op.operation_code)}
    ${row("Lugar y fecha:", `En ${esc(settings.office_locality || "Belgrano, CABA")}, a ${fechaLarga()}`)}
    ${row("Destinatario:", `${esc(nombreCliente(c))}${docCliente(c) ? ` &nbsp;·&nbsp; ${esc(docCliente(c))}` : ""}`)}
    ${row("Domicilio de entrega:", esc(domicilio) + (op.delivery_day ? ` · ${esc(fechaDia(op.delivery_day))}${op.delivery_slot ? ` ${esc(op.delivery_slot)}` : ""}` : ""))}
    ${row("Cantidad de bultos:", `${f0(bultos)} bulto${bultos !== 1 ? "s" : ""}`, " big")}
    <div style="flex:1;overflow:hidden">${tablaMercaderia(items, 9)}</div>
    ${firmas({ nombre: emisor, doc: emisorDoc, rol: "Entregó · por Argencargo" }, { nombre: nombreCliente(c), doc: docCliente(c), rol: "Recibí conforme · firma, aclaración y DNI" })}
  </div>`;
}

export function printRemitos(docs) {
  const hojas = docs.map((d) => `<div class="hoja">
    ${remito(d, "ORIGINAL")}
    ${pie(d.settings || {}, "Documento no valorizado. Acredita la entrega de la mercadería detallada.")}
    <div class="corte">✂</div>
    ${remito(d, "DUPLICADO")}
    ${pie(d.settings || {}, "Documento no valorizado. Acredita la entrega de la mercadería detallada.")}
  </div>`).join("");
  return abrir(`Remitos · ${docs.map((d) => d.op.operation_code).join(", ")}`, hojas);
}
