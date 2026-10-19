// lib/cotizacion-pdf.js — El PDF de cotización (18/10/2026), uno solo para la calculadora del admin y
// la del portal. Dos hojas A4:
//   1) Resumen: cliente, origen, vía, medidas, el total grande, los servicios y la aduana abiertos
//      renglón por renglón, los bultos y las condiciones.
//   2) Detalle de la mercadería: cada producto con su posición arancelaria y las alícuotas de
//      derechos / tasa estadística / IVA, lo que paga de cada impuesto, y el costo puesto en
//      Argentina por producto (unitario y total), con FOB + impuestos + servicio prorrateado.
// Los dos lados arman el mismo objeto `datos` con armarDatosAdmin / armarDatosPortal y llaman
// abrirCotizacionPdf(datos), que abre la ventana e imprime.

import { costoPuestoEnArgentina } from "./calc.js";

const n = (v) => Number(v || 0);
const toN = (v) => { if (typeof v === "number") return v; const x = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (v) => n(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (v) => `USD ${fmt(v)}`;
const pct = (v) => `${n(v).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
const fecha = (d) => new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

const CANAL_TXT = {
  aereo_a_china: { nombre: "Aéreo Courier Comercial", transito: "7 a 10 días hábiles" },
  maritimo_a_china: { nombre: "Marítimo Carga LCL/FCL", transito: "60 a 70 días" },
  maritimo_b: { nombre: "Marítimo Integral AC", transito: "60 a 70 días" },
  aereo_b_usa: { nombre: "Aéreo Integral AC", transito: "48 a 72 hs" },
  aereo_b_spain: { nombre: "Aéreo Integral AC", transito: "5 a 7 días hábiles" },
};
const COND_TXT = { responsable_inscripto: "Responsable Inscripto", monotributo: "Monotributista", consumidor_final: "Consumidor Final", monotributista: "Monotributista" };

// ── Datos comunes ──────────────────────────────────────────────────────────────
// productos: [{description, quantity, unit_price (o unit_price_usd), ncm:{ncm_code, ncm_description,
//             import_duty_rate, statistics_rate, iva_rate, antidumping, intervention}, package_ids?}]
// pkgs:      [{id?, qty, length, width, height, weight}] (cm / kg, como en las calculadoras)
function medidasDe(pkgs, isAereo) {
  const bultos = (pkgs || []).map((pk, i) => {
    const q = toN(pk.qty ?? pk.quantity) || 1, l = toN(pk.length ?? pk.length_cm), w = toN(pk.width ?? pk.width_cm), h = toN(pk.height ?? pk.height_cm), g = toN(pk.weight ?? pk.gross_weight_kg);
    const vol = l && w && h ? (l * w * h) / 5000 : 0, cbm = l && w && h ? (l * w * h) / 1e6 : 0;
    return { id: pk.id != null ? pk.id : i, q, l, w, h, g, vol, cbm, bruto: g * q, volTot: vol * q, cbmTot: cbm * q };
  }).filter((b) => b.bruto > 0 || b.cbmTot > 0);
  const pesoBruto = bultos.reduce((s, b) => s + b.bruto, 0), pesoVol = bultos.reduce((s, b) => s + b.volTot, 0), cbm = bultos.reduce((s, b) => s + b.cbmTot, 0);
  const pesoFact = bultos.reduce((s, b) => s + Math.max(b.bruto, b.volTot), 0);
  return { bultos, pesoBruto, pesoVol, cbm, pesoFact, isAereo };
}

function productosDe(products, taxItems, isBlanco, gastoDocTotal) {
  const validos = (products || []).filter((p) => toN(p.unit_price_usd ?? p.unit_price) > 0);
  const fobTot = validos.reduce((s, p) => s + toN(p.unit_price_usd ?? p.unit_price) * (toN(p.quantity) || 1), 0) || 1;
  return validos.map((p, k) => {
    const cantidad = toN(p.quantity) || 1, unitario = toN(p.unit_price_usd ?? p.unit_price), fob = unitario * cantidad;
    const ncm = p.ncm || {};
    const ti = Array.isArray(taxItems) ? taxItems[k] || {} : {};
    const derechos = n(ti.derechos), tasaE = n(ti.tasaE ?? ti.tasa_e), iva = n(ti.iva);
    const otros = n(ti.ivaAdic) + n(ti.iigg) + n(ti.iibb);
    const gastoDoc = gastoDocTotal != null ? n(gastoDocTotal) * (fob / fobTot) : n(ti.gastoDoc) + n(ti.desembolso) + n(ti.ivaDesemb);
    return {
      descripcion: p.description || `Producto ${k + 1}`, cantidad, unitario, fob,
      ncm: ncm.ncm_code && ncm.ncm_code !== "MANUAL" ? ncm.ncm_code : (p.ncm_code && p.ncm_code !== "MANUAL" ? p.ncm_code : null),
      ncmDesc: ncm.ncm_description || "",
      drPct: ti.drPct ?? ncm.import_duty_rate ?? null, tePct: ti.tePct ?? ncm.statistics_rate ?? null, ivaPct: ti.ivaPct ?? ncm.iva_rate ?? 21,
      derechos, tasaE, iva, otros, gastoDoc, impuestos: isBlanco ? derechos + tasaE + iva + otros + gastoDoc : 0,
      antidumping: ncm.antidumping?.medidaTexto || ncm.antidumping?.nota ? (ncm.antidumping.medidaTexto || "Sujeto a antidumping") : null,
      intervencion: ncm.intervention?.required ? (Array.isArray(ncm.intervention.types) && ncm.intervention.types.length ? ncm.intervention.types.join(", ") : "Requiere intervención") : null,
    };
  });
}

function landedDe(productos, pkgs, est, isMaritimo, impuestosTotal) {
  const items = productos.map((p, k) => ({ id: k, description: p.descripcion, quantity: p.cantidad, unit_price_usd: p.unitario, package_ids: p.package_ids || null }));
  const pk = (pkgs || []).map((b) => ({ id: b.id, quantity: b.q, gross_weight_kg: b.g, length_cm: b.l, width_cm: b.w, height_cm: b.h }));
  try {
    return costoPuestoEnArgentina(items, pk, est, { impuestosTotal, repartirPor: isMaritimo ? "volumen" : "peso" }).map((r) => ({
      descripcion: r.it.description, cantidad: r.qty, fobUnit: r.fobUnit, taxUnit: r.taxUnit, svcUnit: r.svcUnit, totalUnit: r.totalUnit, fob: r.fob, tax: r.tax, svc: r.svc, total: r.total,
    }));
  } catch { return []; }
}

// ── Admin: calculadora del admin (ch = canal calculado, eff = valores efectivos con overrides) ──
export function armarDatosAdmin({ ch, eff, products, pkgs, origin, taxCond, clientName, codigo, validezDias = 7 }) {
  const bd = eff?.bd || ch.bd || {};
  const isBlanco = !!bd.isBlanco, isAereo = !!bd.isAereo, isMaritimo = !!bd.isMaritimo;
  const canal = CANAL_TXT[ch.key] || { nombre: ch.name || ch.key, transito: ch.info || "" };
  const medidas = medidasDe(pkgs, isAereo);
  const battExtra = n(ch.battExtra), ow = n(ch.overweightSurcharge), fleteBase = n(ch.flete) - battExtra;
  const recargoValor = isBlanco ? 0 : n(eff?.recargoValor ?? ch.surcharge);
  const desEff = n(eff?.desEff), ivaDesEff = n(eff?.ivaDesEff);
  const servicios = [];
  if (fleteBase + recargoValor > 0) servicios.push([ch.key === "maritimo_a_china" ? "Servicio marítimo de importación" : isBlanco ? "Flete aéreo internacional" : "Servicio Integral de importación", fleteBase + recargoValor]);
  if (battExtra > 0) servicios.push(["Recargo por baterías", battExtra]);
  if (ow > 0) servicios.push(["Recargo por sobrepeso", ow]);
  if (n(ch.seguro) > 0) servicios.push(["Seguro de carga (1%)", n(ch.seguro)]);
  const aduana = [];
  if (isBlanco) {
    if (n(bd.derechos) > 0) aduana.push(["Derechos de importación", n(bd.derechos)]);
    if (n(bd.tasaE) > 0) aduana.push(["Tasa estadística", n(bd.tasaE)]);
    if (n(bd.iva) > 0) aduana.push(["IVA de importación", n(bd.iva)]);
    if (isMaritimo) { if (n(bd.ivaAdic) > 0) aduana.push(["IVA adicional (20%)", n(bd.ivaAdic)]); if (n(bd.iigg) > 0) aduana.push(["Ganancias IIGG (6%)", n(bd.iigg)]); if (n(bd.iibb) > 0) aduana.push(["Ingresos brutos IIBB (5%)", n(bd.iibb)]); }
    for (const [l, v] of (eff?.certLines || [])) aduana.push([l, n(v)]);
    if (isAereo && desEff > 0) aduana.push(["Desaduanaje (gastos documentales)", desEff]);
    if (isAereo && ivaDesEff > 0) aduana.push(["IVA 21% sobre desaduanaje", ivaDesEff]);
  }
  const taxItems = ch.taxDetail?.items || bd.items || null;
  const productos = productosDe(products, taxItems, isBlanco, isAereo && isBlanco ? desEff + ivaDesEff : null);
  const fob = productos.reduce((s, p) => s + p.fob, 0);
  const total = n(eff?.effTotal ?? ch.totalAbonar ?? ch.total);
  const totalAduana = aduana.reduce((s, [, v]) => s + v, 0), totalServicios = servicios.reduce((s, [, v]) => s + v, 0);
  const est = { flete: n(ch.flete) + recargoValor, seguro: n(ch.seguro), overweightSurcharge: ow, shipCost: 0, taxDetail: { items: (taxItems || []).map((t) => ({ derechos: n(t.derechos), tasaE: n(t.tasaE), iva: n(t.iva) })), desembolso: desEff, ivaDesembolso: ivaDesEff } };
  // El desaduanaje y su IVA ya entran por el servicio (est.taxDetail.desembolso): van fuera de impuestosTotal.
  const landed = landedDe(productos, medidas.bultos, est, isMaritimo, totalAduana - (isAereo ? desEff + ivaDesEff : 0));
  return {
    codigo: codigo || null, fecha: new Date(), validaHasta: new Date(Date.now() + validezDias * 864e5),
    cliente: { nombre: clientName || "", codigo: "", condicion: COND_TXT[taxCond] || (taxCond === "responsable_inscripto" ? "Responsable Inscripto" : "Monotributista") },
    origen: origin || "China", canal: { ...canal, key: ch.key, isBlanco, isAereo, isMaritimo },
    medidas, productos, servicios, aduana, envio: 0, fob, total, totalServicios, totalAduana, landed,
    riFuera: false,
  };
}

// ── Portal: calculadora del cliente (ch = canal calculado con items por producto) ──
export function armarDatosPortal({ ch, products, pkgs, origin, client, delivCost = 0, codigo, validezDias = 7 }) {
  const isBlanco = !!ch.isBlanco, isAereo = !!(ch.key || "").includes("aereo"), isMaritimo = !!(ch.key || "").includes("maritimo");
  const canal = CANAL_TXT[ch.key] || { nombre: ch.name || ch.key, transito: ch.info || "" };
  const medidas = medidasDe(pkgs, isAereo);
  const items = Array.isArray(ch.items) ? ch.items : [];
  const sum = (f) => items.reduce((s, it) => s + n(f(it)), 0);
  const battExtra = n(ch.battExtra), ow = n(ch.overweightSurcharge);
  const svcBase = n(ch.flete) + n(ch.surcharge);
  const servicios = [];
  if (svcBase > 0) servicios.push([ch.key === "maritimo_a_china" ? "Servicio marítimo de importación" : isBlanco ? "Flete aéreo internacional" : "Servicio Integral de importación", svcBase]);
  if (battExtra > 0) servicios.push(["Recargo por baterías", battExtra]);
  if (ow > 0) servicios.push(["Recargo por sobrepeso", ow]);
  if (n(ch.seguro) > 0) servicios.push(["Seguro de carga (1%)", n(ch.seguro)]);
  const aduana = [];
  const des = sum((it) => it.desembolso), ivaDes = sum((it) => it.ivaDesemb);
  if (isBlanco) {
    const d = sum((it) => it.derechos), te = sum((it) => it.tasa_e), iv = sum((it) => it.iva);
    if (d > 0) aduana.push(["Derechos de importación", d]);
    if (te > 0) aduana.push(["Tasa estadística", te]);
    if (iv > 0) aduana.push(["IVA de importación", iv]);
    if (isMaritimo) { const a = sum((it) => it.ivaAdic), g = sum((it) => it.iigg), b = sum((it) => it.iibb); if (a > 0) aduana.push(["IVA adicional (20%)", a]); if (g > 0) aduana.push(["Ganancias IIGG (6%)", g]); if (b > 0) aduana.push(["Ingresos brutos IIBB (5%)", b]); }
    if (isAereo && des > 0) aduana.push(["Desaduanaje (gastos documentales)", des]);
    if (isAereo && ivaDes > 0) aduana.push(["IVA 21% sobre desaduanaje", ivaDes]);
  }
  const productos = productosDe(products, items, isBlanco, null);
  const fob = productos.reduce((s, p) => s + p.fob, 0);
  const total = n(ch.total) + n(delivCost);
  const totalAduana = aduana.reduce((s, [, v]) => s + v, 0), totalServicios = servicios.reduce((s, [, v]) => s + v, 0);
  const est = { flete: svcBase + battExtra, seguro: n(ch.seguro), overweightSurcharge: ow, shipCost: n(delivCost), taxDetail: { items: items.map((it) => ({ derechos: n(it.derechos), tasaE: n(it.tasa_e), iva: n(it.iva) })), desembolso: des, ivaDesembolso: ivaDes } };
  const landed = landedDe(productos, medidas.bultos, est, isMaritimo, totalAduana - (isAereo ? des + ivaDes : 0));
  const nombre = client ? `${client.first_name || ""} ${client.last_name || ""}`.trim() : "";
  return {
    codigo: codigo || null, fecha: new Date(), validaHasta: new Date(Date.now() + validezDias * 864e5),
    cliente: { nombre, codigo: client?.client_code || "", condicion: COND_TXT[client?.tax_condition] || "" },
    origen: origin || "China", canal: { ...canal, key: ch.key, isBlanco, isAereo, isMaritimo },
    medidas, productos, servicios, aduana, envio: n(delivCost), fob, total, totalServicios, totalAduana, landed,
    riFuera: false,
  };
}

// ── HTML ───────────────────────────────────────────────────────────────────────
export function htmlCotizacionPdf(d) {
  const base = typeof window !== "undefined" && /argencargo\.com\.ar$/.test(window.location.hostname) ? window.location.origin : "https://argencargo.com.ar";
  const logo = `${base}/brand/logo-horizontal.png`;
  const ref = d.codigo || `COT-${new Date(d.fecha).toISOString().slice(0, 10).replace(/-/g, "")}`;
  const m = d.medidas;
  const unidad = d.canal.isAereo ? `${fmt(m.pesoFact)} kg facturables` : `${m.cbm.toFixed(3)} m³`;
  const fila = (l, v, cls = "") => `<div class="fila ${cls}"><span>${esc(l)}</span><b>${usd(v)}</b></div>`;
  const hayAduana = d.aduana.length > 0;
  const costoImportacion = d.fob + d.total;
  const notas = [
    `Cotización válida hasta el ${fecha(d.validaHasta)}. Los valores están expresados en dólares estadounidenses.`,
    d.canal.isBlanco ? "Los impuestos se calculan sobre el valor CIF declarado con las alícuotas vigentes de cada posición arancelaria; el despacho definitivo puede ajustarlos según la clasificación y el valor que determine la Aduana." : "El Servicio Integral incluye flete, gestión aduanera y entrega en nuestra oficina de Buenos Aires. No se discriminan impuestos: el precio es final.",
    d.canal.isAereo ? "El peso facturable es el mayor entre el peso bruto y el volumétrico (largo × ancho × alto ÷ 5.000) de cada bulto, verificado al ingreso al depósito." : "El volumen se verifica al ingreso al depósito; de haber diferencia con lo declarado, se ajusta el importe.",
    "El precio no incluye el valor de la mercadería (FOB), que el cliente paga directamente a su proveedor, salvo que contrate la gestión de pagos de Argencargo.",
    "Mercadería con baterías, líquidos, marcas registradas o sujeta a intervenciones (ANMAT, INAL, ENACOM, Seguridad Eléctrica) puede requerir condiciones especiales.",
  ];
  const prodRows = d.productos.map((p) => `<tr>
    <td><div class="pn">${esc(p.descripcion)}</div>${p.ncmDesc ? `<div class="pd">${esc(p.ncmDesc)}</div>` : ""}${p.antidumping ? `<div class="pw">⚠ Antidumping: ${esc(p.antidumping)}</div>` : ""}${p.intervencion ? `<div class="pw">⚠ Intervención: ${esc(p.intervencion)}</div>` : ""}</td>
    <td class="c">${p.cantidad}</td><td class="r">${fmt(p.unitario)}</td><td class="r">${fmt(p.fob)}</td>
    <td class="c mono">${p.ncm ? esc(p.ncm) : "—"}</td>
    ${d.canal.isBlanco ? `<td class="c">${p.drPct != null ? pct(p.drPct) : "—"}</td><td class="c">${p.tePct != null ? pct(p.tePct) : "—"}</td><td class="c">${pct(p.ivaPct)}</td><td class="r">${fmt(p.derechos)}</td><td class="r">${fmt(p.tasaE)}</td><td class="r">${fmt(p.iva)}</td><td class="r b">${fmt(p.impuestos)}</td>` : ""}
  </tr>`).join("");
  const totImp = d.productos.reduce((s, p) => s + p.impuestos, 0);
  const landedRows = d.landed.map((r) => `<tr><td class="pn">${esc(r.descripcion)}</td><td class="c">${r.cantidad}</td><td class="r">${fmt(r.fobUnit)}</td><td class="r">${fmt(r.taxUnit)}</td><td class="r">${fmt(r.svcUnit)}</td><td class="r b">${fmt(r.totalUnit)}</td><td class="r b">${fmt(r.total)}</td></tr>`).join("");
  const landedTot = d.landed.reduce((s, r) => s + r.total, 0);
  const bultoRows = m.bultos.map((b, i) => `<tr><td class="c">${i + 1}</td><td class="c">${b.q}</td><td class="c">${b.l && b.w && b.h ? `${b.l} × ${b.w} × ${b.h} cm` : "sin medidas"}</td><td class="r">${fmt(b.g)} kg</td><td class="r">${d.canal.isAereo ? `${fmt(b.vol)} kg` : `${b.cbm.toFixed(4)} m³`}</td><td class="r b">${d.canal.isAereo ? `${fmt(Math.max(b.bruto, b.volTot))} kg` : `${b.cbmTot.toFixed(4)} m³`}</td></tr>`).join("");
  const footer = (pg) => `<div class="pie"><div><b>Argencargo</b> · Virrey Loreto 2428, Belgrano, CABA · Lunes a viernes de 10 a 18 h · WhatsApp +54 9 11 2508-8580 · argencargo.com.ar</div><div>${ref} · Hoja ${pg} de 2</div></div>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cotización ${esc(ref)} · Argencargo</title><style>
    @page{size:A4;margin:0}
    *,*:before,*:after{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{margin:0;padding:0;background:#fff}
    body{font-family:'Helvetica Neue',Inter,Arial,sans-serif;color:#0f172a;font-size:10.5px;line-height:1.4}
    .page{width:210mm;min-height:297mm;padding:13mm 14mm 16mm;position:relative;page-break-after:always;background:#fff}
    .page:last-child{page-break-after:auto}
    .cab{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid #0A3D91}
    .cab img{height:46px;width:auto}
    .cab .ref{text-align:right}
    .cab .ref .t{font-size:19px;font-weight:800;color:#0A3D91;letter-spacing:-.01em}
    .cab .ref .c{font-family:Menlo,Consolas,monospace;font-size:12px;font-weight:700;color:#0A3D91;margin-top:2px}
    .cab .ref .f{font-size:9.5px;color:#64748b;margin-top:3px}
    .datos{display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;gap:10px;margin-top:12px}
    .dato{padding:9px 11px;background:#F3F7FD;border-radius:8px;border:1px solid #E0EAF7}
    .dato .l{font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:700}
    .dato .v{font-size:12px;font-weight:700;color:#0f172a;margin-top:3px}
    .dato .s{font-size:9.5px;color:#64748b;margin-top:1px}
    .hero{margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1.25fr;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#0A3D91,#1E8BFF);color:#fff}
    .hero div{padding:14px 16px}
    .hero .l{font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;opacity:.85;font-weight:700}
    .hero .v{font-size:17px;font-weight:800;margin-top:4px;letter-spacing:-.01em}
    .hero .s{font-size:9px;opacity:.8;margin-top:2px}
    .hero .big{background:rgba(255,255,255,.14)}
    .hero .big .v{font-size:24px}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
    .caja{border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px}
    .caja h4{margin:0 0 6px;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#0A3D91;font-weight:800}
    .fila{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid #F1F5F9;font-size:10.5px}
    .fila:last-child{border-bottom:none}
    .fila b{font-variant-numeric:tabular-nums;white-space:nowrap}
    .fila.tot{border-top:1.5px solid #0A3D91;border-bottom:none;margin-top:4px;padding-top:6px;font-weight:800;color:#0A3D91}
    h3{margin:14px 0 6px;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:#0A3D91;font-weight:800}
    table{width:100%;border-collapse:collapse;font-size:9.5px}
    th{background:#0A3D91;color:#fff;font-size:8px;text-transform:uppercase;letter-spacing:.06em;padding:6px 7px;text-align:left;font-weight:700}
    th.c,td.c{text-align:center}th.r,td.r{text-align:right}
    td{padding:6px 7px;border-bottom:1px solid #EEF2F7;vertical-align:top;font-variant-numeric:tabular-nums}
    tr:nth-child(even) td{background:#FAFCFF}
    td.b{font-weight:800}
    td.mono{font-family:Menlo,Consolas,monospace;font-size:9px}
    .pn{font-weight:700;color:#0f172a}.pd{font-size:8.5px;color:#64748b;margin-top:1px}.pw{font-size:8.5px;color:#b45309;font-weight:700;margin-top:2px}
    tfoot td{background:#F3F7FD !important;font-weight:800;border-top:1.5px solid #0A3D91;color:#0A3D91}
    .notas{margin-top:12px;padding:10px 12px;background:#FFF8E6;border-left:3px solid #E8C99B;border-radius:6px;font-size:9px;color:#5C4A1F;line-height:1.5}
    .notas p{margin:0 0 3px}
    .expl{margin-top:8px;font-size:9px;color:#64748b;line-height:1.5}
    .pie{position:absolute;left:14mm;right:14mm;bottom:8mm;display:flex;justify-content:space-between;gap:12px;font-size:8.5px;color:#64748b;border-top:1px solid #E2E8F0;padding-top:6px}
    .pie b{color:#0A3D91}
    @media print{.page{height:297mm}}
  </style></head><body>

  <div class="page">
    <div class="cab">
      <img src="${logo}" alt="Argencargo">
      <div class="ref"><div class="t">Cotización de importación</div><div class="c">${esc(ref)}</div><div class="f">Emitida el ${fecha(d.fecha)} · válida hasta el ${fecha(d.validaHasta)}</div></div>
    </div>
    <div class="datos">
      <div class="dato"><div class="l">Cliente</div><div class="v">${esc(d.cliente.nombre || "—")}</div><div class="s">${[d.cliente.codigo, d.cliente.condicion].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</div></div>
      <div class="dato"><div class="l">Origen → destino</div><div class="v">${esc(d.origen)} → Buenos Aires</div><div class="s">Retiro en oficina${d.envio > 0 ? " o envío a domicilio" : ""}</div></div>
      <div class="dato"><div class="l">Vía</div><div class="v">${esc(d.canal.nombre)}</div><div class="s">${esc(d.canal.transito || "")}&nbsp;</div></div>
      <div class="dato"><div class="l">${d.canal.isAereo ? "Peso" : "Volumen"}</div><div class="v">${esc(unidad)}</div><div class="s">${d.canal.isAereo ? `bruto ${fmt(m.pesoBruto)} kg · vol. ${fmt(m.pesoVol)} kg` : `${m.bultos.reduce((s, b) => s + b.q, 0)} bulto(s) · ${fmt(m.pesoBruto)} kg`}</div></div>
    </div>
    <div class="hero">
      <div><div class="l">Valor de la mercadería (FOB)</div><div class="v">${usd(d.fob)}</div><div class="s">lo que pagás a tu proveedor</div></div>
      <div><div class="l">Costo puesto en Argentina</div><div class="v">${usd(costoImportacion)}</div><div class="s">FOB + importación</div></div>
      <div class="big"><div class="l">Total a abonar a Argencargo</div><div class="v">${usd(d.total)}</div><div class="s">flete, seguro${hayAduana ? ", impuestos y despacho" : " y gestión"}${d.envio > 0 ? " y envío" : ""}</div></div>
    </div>
    <div class="cols">
      <div class="caja"><h4>Servicios</h4>${d.servicios.map(([l, v]) => fila(l, v)).join("")}${d.envio > 0 ? fila("Envío a domicilio", d.envio) : ""}${fila("Subtotal servicios", d.totalServicios + d.envio, "tot")}</div>
      <div class="caja"><h4>Aduana e impuestos</h4>${hayAduana ? d.aduana.map(([l, v]) => fila(l, v)).join("") + fila("Subtotal aduana", d.totalAduana, "tot") : `<div class="expl" style="margin-top:2px">${d.canal.isBlanco ? "Sin impuestos calculados para esta vía." : "El Servicio Integral es un precio final: incluye la gestión aduanera y no se discriminan impuestos."}</div>`}</div>
    </div>
    ${m.bultos.length ? `<h3>Bultos</h3><table><thead><tr><th class="c">#</th><th class="c">Cant.</th><th class="c">Medidas</th><th class="r">Peso unit.</th><th class="r">${d.canal.isAereo ? "Volumétrico unit." : "Volumen unit."}</th><th class="r">${d.canal.isAereo ? "Facturable" : "Volumen"}</th></tr></thead><tbody>${bultoRows}</tbody>
      <tfoot><tr><td></td><td class="c">${m.bultos.reduce((s, b) => s + b.q, 0)}</td><td></td><td class="r">${fmt(m.pesoBruto)} kg</td><td class="r">${d.canal.isAereo ? `${fmt(m.pesoVol)} kg` : ""}</td><td class="r">${d.canal.isAereo ? `${fmt(m.pesoFact)} kg` : `${m.cbm.toFixed(4)} m³`}</td></tr></tfoot></table>` : ""}
    <div class="notas">${notas.map((t) => `<p>• ${esc(t)}</p>`).join("")}</div>
    ${footer(1)}
  </div>

  <div class="page">
    <div class="cab">
      <img src="${logo}" alt="Argencargo">
      <div class="ref"><div class="t">Detalle de la mercadería</div><div class="c">${esc(ref)}</div><div class="f">${d.productos.length} producto(s) · ${esc(d.canal.nombre)}</div></div>
    </div>
    <h3>Productos${d.canal.isBlanco ? ", posición arancelaria e impuestos" : ""}</h3>
    <table><thead><tr><th>Producto</th><th class="c">Cant.</th><th class="r">Unit. USD</th><th class="r">FOB USD</th><th class="c">NCM</th>${d.canal.isBlanco ? `<th class="c">Derechos</th><th class="c">Tasa est.</th><th class="c">IVA</th><th class="r">Derechos USD</th><th class="r">Tasa USD</th><th class="r">IVA USD</th><th class="r">Impuestos USD</th>` : ""}</tr></thead>
      <tbody>${prodRows}</tbody>
      <tfoot><tr><td>Total</td><td class="c">${d.productos.reduce((s, p) => s + p.cantidad, 0)}</td><td></td><td class="r">${fmt(d.fob)}</td><td></td>${d.canal.isBlanco ? `<td colspan="3"></td><td class="r">${fmt(d.productos.reduce((s, p) => s + p.derechos, 0))}</td><td class="r">${fmt(d.productos.reduce((s, p) => s + p.tasaE, 0))}</td><td class="r">${fmt(d.productos.reduce((s, p) => s + p.iva, 0))}</td><td class="r">${fmt(totImp)}</td>` : ""}</tr></tfoot></table>
    ${d.canal.isBlanco ? `<div class="expl">Los porcentajes son las alícuotas de cada posición arancelaria (NCM). Los derechos y la tasa estadística se aplican sobre el valor CIF (FOB + flete + seguro) y el IVA sobre el CIF más derechos y tasa. "Impuestos USD" incluye además ${d.canal.isMaritimo ? "IVA adicional, Ganancias e Ingresos Brutos" : "la parte proporcional del desaduanaje y su IVA"}.</div>` : ""}
    ${d.landed.length ? `<h3>Costo puesto en Argentina por producto</h3>
    <table><thead><tr><th>Producto</th><th class="c">Cant.</th><th class="r">FOB unit.</th><th class="r">Impuestos unit.</th><th class="r">Servicio unit.</th><th class="r">Costo unit. puesto</th><th class="r">Costo total</th></tr></thead>
      <tbody>${landedRows}</tbody>
      <tfoot><tr><td>Total</td><td class="c">${d.landed.reduce((s, r) => s + r.cantidad, 0)}</td><td class="r">${fmt(d.landed.reduce((s, r) => s + r.fob, 0))}</td><td class="r">${fmt(d.landed.reduce((s, r) => s + r.tax, 0))}</td><td class="r">${fmt(d.landed.reduce((s, r) => s + r.svc, 0))}</td><td></td><td class="r">${fmt(landedTot)}</td></tr></tfoot></table>
    <div class="expl">El servicio (flete, seguro, recargos${d.envio > 0 ? ", envío" : ""}${d.canal.isAereo && d.canal.isBlanco ? " y desaduanaje" : ""}) se reparte entre los productos según el ${d.canal.isMaritimo ? "volumen" : "peso facturable"} del bulto en que viaja cada uno; los impuestos, según lo que paga cada producto. Es el costo real de cada unidad puesta en Buenos Aires, para que sepas a cuánto te sale lo que vas a vender.</div>` : ""}
    ${footer(2)}
  </div>
  </body></html>`;
}

export function abrirCotizacionPdf(datos) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(htmlCotizacionPdf(datos));
  w.document.close();
  const go = () => { try { w.focus(); w.print(); } catch {} };
  // Esperar el logo antes de imprimir.
  const img = w.document.querySelector("img");
  if (img && !img.complete) { img.onload = go; img.onerror = go; setTimeout(go, 2500); } else setTimeout(go, 300);
}
