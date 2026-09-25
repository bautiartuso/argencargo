// Impresos del panel de Entregas (25/09/2026): recibo de entrega y remito.
// Bautista imprime en A4: cada documento sale en media hoja (A5 apaisado) y la página trae dos
// copias con una línea de corte al medio — ORIGINAL para el cliente, DUPLICADO para Argencargo.
// Con varias operaciones, una página por operación.

const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png";
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f2 = (v) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = (v) => Math.round(Number(v || 0)).toLocaleString("es-AR");
const fecha = (d) => { const x = d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? `${d}T12:00:00` : d) : new Date(); return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`; };
const fechaDia = (iso) => { if (!iso) return ""; const d = new Date(iso + "T12:00:00"); return `${["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
const METODO = { efectivo: "Efectivo", transferencia: "Transferencia", crypto: "Cripto", cripto: "Cripto", tarjeta: "Tarjeta", cuenta_corriente: "Cuenta corriente" };
const metodoTxt = (m) => METODO[String(m || "").toLowerCase()] || (m ? String(m).replace(/_/g, " ") : "—");

const nombreCliente = (c) => (c?.company_name || "").trim() || `${c?.first_name || ""} ${c?.last_name || ""}`.trim() || "—";
const docCliente = (c) => c?.cuit ? `CUIT ${c.cuit}` : c?.dni ? `DNI ${c.dni}` : "";
const entregaTxt = (op) => op.delivery_choice === "propio" ? `Envío a domicilio · ${op.delivery_address || ""}`.trim() : op.delivery_choice === "carrier" ? `Envío por transportista${op.carrier_mode ? ` (${op.carrier_mode})` : ""}` : "Retiro por oficina";

// CSS compartido: A4 vertical, dos mitades de 148,5 mm con corte al medio.
const CSS = `
  @page{size:A4 portrait;margin:0}
  *{box-sizing:border-box}
  body{margin:0;font-family:Inter,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hoja{width:210mm;height:297mm;position:relative;page-break-after:always;overflow:hidden}
  .hoja:last-child{page-break-after:auto}
  .mitad{height:148.5mm;padding:10mm 12mm 9mm;position:relative;display:flex;flex-direction:column}
  .mitad+.mitad{border-top:1px dashed #9ca3af}
  .corte{position:absolute;left:4mm;top:146.5mm;font-size:8px;color:#9ca3af;letter-spacing:0.2em}
  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}
  .head img{height:14mm;width:auto;display:block}
  .head .tit{text-align:right}
  .head .tit h1{margin:0;font-size:18px;font-weight:900;letter-spacing:0.06em}
  .head .tit .sub{font-size:10.5px;color:#4b5563;margin-top:2px}
  .head .tit .copia{display:inline-block;margin-top:5px;font-size:9px;font-weight:800;letter-spacing:0.12em;padding:2px 8px;border:1px solid #111;border-radius:999px}
  .cod{font-family:ui-monospace,Menlo,monospace;font-weight:800}
  .fila{display:flex;gap:14px;font-size:11px;line-height:1.45}
  .fila .k{color:#6b7280;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-size:8.5px;white-space:nowrap;min-width:74px;padding-top:2px}
  .fila .v{flex:1;font-weight:600}
  .caja{border:1px solid #d1d5db;border-radius:6px;padding:6px 9px;margin-top:6px}
  .caja .t{font-size:8.5px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;margin:0 0 4px}
  table{width:100%;border-collapse:collapse;font-size:10.5px}
  th{text-align:left;font-size:8.5px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;padding:3px 4px;border-bottom:1px solid #d1d5db}
  td{padding:3px 4px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  td.n,th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .total{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:2px solid #111}
  .total .l{font-size:9px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase}
  .total .v{font-size:20px;font-weight:900;font-variant-numeric:tabular-nums}
  .estado{display:inline-block;font-size:10px;font-weight:900;letter-spacing:0.1em;padding:3px 10px;border-radius:4px;border:2px solid #111}
  .estado.ok{background:#111;color:#fff}
  .firmas{display:flex;gap:18px;margin-top:9px}
  .firma{flex:1;border-top:1px solid #111;padding-top:3px;font-size:8.5px;color:#4b5563;text-align:center;letter-spacing:0.06em;text-transform:uppercase}
  .nota{font-size:8px;color:#6b7280;margin-top:6px}
`;

function abrir(titulo, cuerpo) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head><body>${cuerpo}<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html); w.document.close();
  return true;
}

const cabecera = (tipo, sub, copia) => `<div class="head">
  <img src="${LOGO}" alt="Argencargo"/>
  <div class="tit"><h1>${tipo}</h1><div class="sub">${esc(sub)}</div><span class="copia">${copia}</span></div>
</div>`;

const itemsTabla = (items, max) => {
  const lista = Array.isArray(items) ? items : [];
  const vis = lista.slice(0, max);
  const resto = lista.length - vis.length;
  const totU = lista.reduce((s, it) => s + Number(it.quantity || 0), 0);
  return `<table><thead><tr><th>Mercadería</th><th class="n">Cant.</th></tr></thead><tbody>
    ${vis.map((it) => `<tr><td>${esc(it.description || "—")}</td><td class="n">${f0(it.quantity)}</td></tr>`).join("")}
    ${resto > 0 ? `<tr><td style="color:#6b7280;font-style:italic">… y ${resto} ítem${resto !== 1 ? "s" : ""} más</td><td class="n"></td></tr>` : ""}
    ${lista.length === 0 ? `<tr><td colspan="2" style="color:#6b7280;font-style:italic">Sin detalle de mercadería cargado</td></tr>` : ""}
  </tbody><tfoot><tr><th>${lista.length} ítem${lista.length !== 1 ? "s" : ""}</th><th class="n">${f0(totU)} u</th></tr></tfoot></table>`;
};

// ── RECIBO DE ENTREGA ────────────────────────────────────────────────────────────────────────
// doc: { op, client, items, bultos, pagos:[{payment_date,amount_usd,amount_ars,currency,payment_method}], total, pagado, saldo, metodo, settings }
function reciboMitad(doc, copia) {
  const { op, client, items, bultos, pagos = [], total = 0, pagado = 0, saldo = 0, metodo, settings = {} } = doc;
  const pagoOk = saldo <= 0.005;
  const cuando = op.delivery_day ? `${fechaDia(op.delivery_day)}${op.delivery_slot ? ` · ${op.delivery_slot}` : ""}` : "a coordinar";
  const pagosHtml = pagos.length
    ? `<table><thead><tr><th>Fecha</th><th>Forma</th><th class="n">Importe</th></tr></thead><tbody>${pagos.map((p) => `<tr><td>${fecha(p.payment_date || p.created_at)}</td><td>${metodoTxt(p.payment_method)}${p.currency === "ARS" && Number(p.amount_ars) > 0 ? ` · $ ${f2(p.amount_ars)}${p.exchange_rate ? ` @ ${f0(p.exchange_rate)}` : ""}` : ""}</td><td class="n">USD ${f2(p.amount_usd)}</td></tr>`).join("")}</tbody></table>`
    : `<div style="font-size:10.5px;color:#6b7280;font-style:italic">Sin pagos registrados todavía.</div>`;
  const split = Array.isArray(op.payment_split) && op.payment_split.length ? op.payment_split.map((p) => `${metodoTxt(p.method)}${p.currency === "ARS" ? " en pesos" : p.currency === "mixto" ? " USD + ARS" : ""}`).join(" + ") : metodoTxt(metodo);
  return `<div class="mitad">
    ${cabecera("RECIBO DE ENTREGA", `${op.operation_code} · ${fecha()}`, copia)}
    <div class="fila"><span class="k">Cliente</span><span class="v">${esc(nombreCliente(client))}${client?.client_code ? ` <span class="cod" style="color:#6b7280;font-weight:600">${esc(client.client_code)}</span>` : ""}${docCliente(client) ? ` · ${esc(docCliente(client))}` : ""}</span></div>
    <div class="fila"><span class="k">Entrega</span><span class="v">${esc(entregaTxt(op))} · ${esc(cuando)}</span></div>
    <div class="fila"><span class="k">Bultos</span><span class="v">${f0(bultos)} bulto${bultos !== 1 ? "s" : ""}${items?.length ? ` · ${items.length} ítem${items.length !== 1 ? "s" : ""} (${f0(items.reduce((s, it) => s + Number(it.quantity || 0), 0))} u)` : ""}</span></div>
    <div class="caja" style="flex:1;overflow:hidden"><p class="t">Mercadería</p>${itemsTabla(items, 6)}</div>
    <div class="caja"><p class="t">Pagos recibidos</p>${pagosHtml}</div>
    <div class="caja" style="display:flex;justify-content:space-between;gap:12px;align-items:center">
      <div style="font-size:10.5px;line-height:1.5"><div><b>Total de la operación:</b> USD ${f2(total)}</div><div><b>Pagado:</b> USD ${f2(pagado)}</div><div><b>Forma de pago:</b> ${esc(split)}</div></div>
      <span class="estado${pagoOk ? " ok" : ""}">${pagoOk ? "✓ PAGADO" : "A COBRAR"}</span>
    </div>
    <div class="total"><span class="l">${pagoOk ? "Saldo" : "Saldo a cobrar en la entrega"}</span><span class="v">USD ${f2(saldo)}</span></div>
    <div class="firmas"><div class="firma">Entregó · ${esc(settings.receipt_issuer_name || "Argencargo")}</div><div class="firma">Recibí conforme · firma y aclaración</div></div>
    <div class="nota">Comprobante interno de entrega. No válido como factura.${settings.office_address ? ` · ${esc(settings.office_address)}` : ""}</div>
    <span class="corte">✂ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·</span>
  </div>`;
}

export function printRecibosEntrega(docs) {
  const hojas = docs.map((d) => `<div class="hoja">${reciboMitad(d, "ORIGINAL · CLIENTE")}${reciboMitad(d, "DUPLICADO · ARGENCARGO")}</div>`).join("");
  return abrir(`Recibos de entrega · ${docs.map((d) => d.op.operation_code).join(", ")}`, hojas);
}

// ── REMITO ───────────────────────────────────────────────────────────────────────────────────
// doc: { op, client, items, bultos, settings }
function remitoMitad(doc, copia) {
  const { op, client, items, bultos, settings = {} } = doc;
  const c = client || {};
  const dir = op.delivery_choice === "propio" ? (op.delivery_address || [c.street, c.floor_apt, c.city, c.province].filter(Boolean).join(", ")) : op.delivery_choice === "carrier" ? entregaTxt(op) : (settings.office_address ? `Retiro en oficina · ${settings.office_address}` : "Retiro por oficina");
  const cuando = op.delivery_day ? `${fechaDia(op.delivery_day)}${op.delivery_slot ? ` · ${op.delivery_slot}` : ""}` : "";
  return `<div class="mitad">
    ${cabecera("REMITO", `${op.operation_code} · ${fecha()}`, copia)}
    <div class="fila"><span class="k">Cliente</span><span class="v">${esc(nombreCliente(c))}${c.client_code ? ` <span class="cod" style="color:#6b7280;font-weight:600">${esc(c.client_code)}</span>` : ""}${docCliente(c) ? ` · ${esc(docCliente(c))}` : ""}</span></div>
    <div class="fila"><span class="k">Entrega</span><span class="v">${esc(dir)}${cuando ? ` · ${esc(cuando)}` : ""}</span></div>
    <div class="fila"><span class="k">Bultos</span><span class="v" style="font-size:14px">${f0(bultos)} bulto${bultos !== 1 ? "s" : ""}</span></div>
    <div class="caja" style="flex:1;overflow:hidden"><p class="t">Detalle de la mercadería</p>${itemsTabla(items, 12)}</div>
    <div class="firmas"><div class="firma">Entregó · ${esc(settings.receipt_issuer_name || "Argencargo")}</div><div class="firma">Recibí conforme · firma, aclaración y DNI</div></div>
    <div class="nota">Documento no valorizado. La mercadería se entrega en ${f0(bultos)} bulto${bultos !== 1 ? "s" : ""} cerrado${bultos !== 1 ? "s" : ""}.</div>
    <span class="corte">✂ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·</span>
  </div>`;
}

export function printRemitos(docs) {
  const hojas = docs.map((d) => `<div class="hoja">${remitoMitad(d, "ORIGINAL · CLIENTE")}${remitoMitad(d, "DUPLICADO · ARGENCARGO")}</div>`).join("");
  return abrir(`Remitos · ${docs.map((d) => d.op.operation_code).join(", ")}`, hojas);
}
