// Destinación simplificada de Argencargo (27/10/2026). A monotributistas y consumidores finales no se
// les muestra la DSI del courier (va a nombre de quien salió la guía y trae la carga de otros), así
// que se les arma una con el formato de la que emite DHL, pero con los datos REALES de la DSI de ARCA:
// guía, fecha, liquidación, remitente, destinatario de la guía y su condición. La tabla y el
// contenido traen solo la mercadería de ese cliente, con los valores que liquidó la aduana.

const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const n2 = (v) => (v == null || v === "" ? "" : Number(v).toFixed(2));
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dig = (s) => String(s || "").replace(/\D/g, "");

// "26073LMAN075412K" → "75412K" (lo que DHL pone como número de póliza).
export const polizaDe = (idLiquidacion) => {
  const m = String(idLiquidacion || "").match(/MAN0*([0-9A-Z]+)$/i);
  return m ? m[1].toUpperCase() : (idLiquidacion || "");
};

// Condición del destinatario de la guía según el padrón de ARCA (cond_iva 1 = RI, 6 = monotributo).
export const condicionDgi = (condIva) => (condIva === 1 ? "RIN  Resp. Inscripto" : condIva === 6 ? "MON  Monotributo" : condIva === 5 ? "CF   Consumidor Final" : null);

// A qué líneas de la DSI corresponde cada producto declarado del cliente en el vuelo.
// 1) misma cantidad y mismo FOB (la factura del vuelo y la DSI salen ítem por ítem);
// 2) si no, misma posición (8, 6 o 4 dígitos) y se toma la parte proporcional al FOB.
// Devuelve filas con los montos de la DSI (o su proporción).
export function filasDelCliente(lines, items) {
  const usadas = new Set();
  const filas = [];
  for (const it of items || []) {
    const fob = r2(Number(it.quantity || 0) * Number(it.unit_price_declared_usd ?? it.unit_price_usd ?? 0));
    const qty = Number(it.quantity || 0);
    let k = (lines || []).findIndex((l, i) => !usadas.has(i) && Number(l.qty) === qty && Math.abs(Number(l.fob) - fob) < 0.02);
    let parte = 1;
    if (k >= 0) usadas.add(k);
    else {
      const ncm = dig(it.hs_code || it.ncm_code);
      for (const len of [8, 6, 4]) {
        k = (lines || []).findIndex((l) => ncm && dig(l.ncm).slice(0, len) === ncm.slice(0, len));
        if (k >= 0) break;
      }
      if (k >= 0) parte = Number(lines[k].fob) > 0 ? Math.min(1, fob / Number(lines[k].fob)) : 0;
    }
    const l = k >= 0 ? lines[k] : null;
    filas.push({ l, parte, fob: l && parte === 1 ? Number(l.fob) : fob, desc: it.description || "" });
  }
  return filas;
}

// Arma todo lo que va en el documento. dsi = legajo_docs.datos (con cab), flight = vuelo, items = lo
// declarado del cliente en el vuelo (flight_invoice_items), unica = la guía es solo de este cliente.
export function armarDsiArgencargo({ dsi, flight, op, items, bultos, condicion, unica }) {
  const cab = dsi?.cab || {};
  const lines = Array.isArray(dsi?.lines) ? dsi.lines : [];
  const totFobGuia = Number(cab.montoFob) || lines.reduce((a, l) => a + Number(l.fob || 0), 0);
  const kFlete = totFobGuia > 0 ? Number(cab.montoFlete || 0) / totFobGuia : 0;
  const kSeguro = totFobGuia > 0 ? Number(cab.montoSeguro || 0) / totFobGuia : 0;
  const base = unica || !(items || []).length ? lines.map((l) => ({ l, parte: 1, fob: Number(l.fob), desc: "" })) : filasDelCliente(lines, items);
  const filas = base.map(({ l, parte, fob }) => {
    const flete = r2(fob * kFlete), seguro = r2(fob * kSeguro);
    const va = l && parte === 1 && l.valorAduana != null ? Number(l.valorAduana) : r2(fob + flete + seguro);
    const pDer = l?.alic?.["010"], pEst = l?.alic?.["011"];
    return {
      ncm: l?.ncm || "",
      desc: String(l?.desc || "").replace(/\s+S D S D$/i, "").replace(/\s+/g, "*").slice(0, 25),
      fob, flete, seguro, va,
      pDer, der: l ? r2(Number(l.die || 0) * parte) : null,
      pEst, est: l ? r2(Number(l.te || 0) * parte) : null,
    };
  });
  // Contenido: lo comercial del cliente, en dos renglones como el de DHL.
  const contenido = (() => {
    const txt = [...new Set((items || []).map((i) => String(i.description || "").trim()).filter(Boolean))].join(", ") || filas.map((f) => f.desc.replace(/\*/g, " ")).join(", ");
    const ancho = 25, palabras = txt.split(/\s+/), r = [""];
    for (const p of palabras) {
      if ((r[r.length - 1] + " " + p).trim().length <= ancho) r[r.length - 1] = (r[r.length - 1] + " " + p).trim();
      else if (r.length < 2) r.push(p.slice(0, ancho));
      else { r[1] = (r[1].length > ancho - 1 ? r[1].slice(0, ancho - 1) : r[1]) + "…"; break; }
    }
    return r;
  })();
  const fechaLlegada = cab.registrado || (flight?.received_at ? new Date(flight.received_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }) : "");
  return {
    guia: cab.guia || flight?.international_tracking || dsi?.guia || "",
    fechaLlegada,
    solicitud: op?.operation_code || "",
    poliza: polizaDe(cab.idLiquidacion),
    referencia: cab.idParticular || "",
    remitente: cab.remitente || "",
    piezas: bultos,
    pfDgi: condicion || "",
    contenido,
    cuit: cab.destinatarioCuit || dig(flight?.dest_tax_id) || dsi?.destinatario?.cuit || "",
    contacto: cab.destinatarioNombre || dsi?.destinatario?.nombre || flight?.dest_name || "",
    destinatario: cab.destinatarioNombre || dsi?.destinatario?.nombre || flight?.dest_name || "",
    domicilio: String(cab.destinatarioDomicilio || flight?.dest_address || "").replace(/\s*\b[A-Z]{2}-INDETERMINADO\b/gi, "").trim(),
    tipoEnvio: cab.tipoEnvio ? cab.tipoEnvio.charAt(0) + cab.tipoEnvio.slice(1).toLowerCase() : "Comercial",
    courier: cab.pspNombre || flight?.international_carrier || "",
    idLiquidacion: cab.idLiquidacion || "",
    filas,
  };
}

const LOGO = "https://www.argencargo.com.ar/brand/logo-horizontal.png";

// Mismo esqueleto que la de DHL: monoespaciada, rótulos con dos puntos y la tabla entre guiones.
export function dsiArgencargoHtml(d) {
  const campo = (rot, val) => `<div class="c"><span class="r">${esc(rot)}</span><span class="dp">:</span><span class="v">${val}</span></div>`;
  const filas = d.filas.map((f, i) => `<tr><td class="n">${i + 1}</td><td>${esc(f.ncm)}</td><td class="d">${esc(f.desc)}</td><td>${n2(f.fob)}</td><td>${n2(f.flete)}</td><td>${n2(f.seguro)}</td><td>${n2(f.va)}</td><td>${f.pDer != null ? n2(f.pDer) : ""}</td><td>${f.der != null ? n2(f.der) : ""}</td><td>${f.pEst != null ? n2(f.pEst) : ""}</td><td>${f.est != null ? n2(f.est) : ""}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Destinación simplificada ${esc(d.guia)}</title><style>
  @page{size:A4;margin:14mm 12mm 16mm}
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:"Courier New",Courier,monospace;font-size:9pt;color:#111;line-height:1.6}
  .top{display:flex;justify-content:space-between;align-items:flex-start}
  .top img{height:15mm}
  .tit{text-align:center;margin:9mm 0 10mm;letter-spacing:.5px}
  .tit div{display:inline-block;border-bottom:1.5px double #111;padding:0 4mm 1.5mm;font-weight:700}
  .grid{display:grid;grid-template-columns:44% 56%}
  .c{display:flex;min-height:5.2mm}
  .r{width:25mm;flex:none}.dp{width:4mm;flex:none}.v{flex:1;white-space:nowrap}
  .col2 .r{width:27mm}
  .dest{margin-left:29mm;white-space:nowrap}
  .te{margin:2.5mm 0 0 31mm}
  table{width:100%;border-collapse:collapse;margin-top:9mm;font-size:9pt}
  thead th{font-weight:400;text-align:right;padding:1.6mm 1mm;border-top:1px dashed #111;border-bottom:1px dashed #111}
  thead th:nth-child(2),thead th:nth-child(3){text-align:left}
  td{text-align:right;padding:1.3mm 1mm;white-space:nowrap}
  td:nth-child(2),td.d{text-align:left}
  td.n{text-align:left;width:6mm}
  .firma{margin:16mm auto 0;width:78mm;text-align:center;border-top:1px solid #111;padding-top:2mm}
  .pie{margin-top:12mm;font-size:7.5pt;color:#555;line-height:1.5}
  </style></head><body>
  <div class="top"><div>Gerencia de Importacion</div><img src="${LOGO}" alt="Argencargo"></div>
  <div class="tit"><div>DESTINACION SIMPLIFICADA &nbsp; DE &nbsp; IMPORTACION</div></div>
  <div class="grid">
    <div>
      ${campo("Nro. de Guia", esc(d.guia))}
      ${campo("Nro Solicitud", esc(d.solicitud))}
      ${campo("Remitente", esc(d.remitente))}
      ${campo("P.F. DGI", esc(d.pfDgi).replace(/  /g, "&nbsp;&nbsp;"))}
      ${campo("Contenido", esc(d.contenido[0] || ""))}
      ${d.contenido[1] ? `<div class="c"><span class="r"></span><span class="dp"></span><span class="v">${esc(d.contenido[1])}</span></div>` : ""}
      ${campo("Contacto", esc(d.contacto))}
      ${campo("Destinatario", "")}
      <div class="dest">${esc(d.destinatario)}<br>${esc(d.domicilio)}</div>
    </div>
    <div class="col2">
      ${campo("Fecha Llegada", esc(d.fechaLlegada))}
      ${campo("Nro de Poliza", `${esc(d.poliza)}${d.referencia ? ` / Referencia: ${esc(d.referencia)}` : ""}`)}
      ${campo("Cant. Piezas", esc(d.piezas))}
      ${campo("Nro. Cuit", esc(d.cuit))}
      <div class="te">Tipo Envio: ${esc(d.tipoEnvio)}</div>
    </div>
  </div>
  <table><thead><tr><th></th><th>Posic.Aran</th><th></th><th>Val.Fob.</th><th>Flete</th><th>Seguro</th><th>V.Aduana</th><th>%Dere</th><th>Derech</th><th>%Esta</th><th>Estad</th></tr></thead><tbody>${filas}</tbody></table>
  <div class="firma">Departamento de Operaciones<br>ARGENCARGO</div>
  <div class="pie">Datos de la Destinación Simplificada de Importación registrada en ARCA${d.idLiquidacion ? ` (liquidación ${esc(d.idLiquidacion)}` : ""}${d.courier ? `${d.idLiquidacion ? ", " : " ("}courier ${esc(d.courier)})` : d.idLiquidacion ? ")" : ""}. Detalle correspondiente a la operación ${esc(d.solicitud)}.</div>
  </body></html>`;
}
