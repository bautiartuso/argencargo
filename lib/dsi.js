// Destinación Simplificada de Importación (DSI) del courier — 22/10/2026.
// El admin sube el PDF; el navegador saca el texto con pdf.js y acá se arma cada ítem con lo que
// realmente se liquidó en aduana. Después `asignarDsi` reparte esos montos entre los productos de la
// operación sin que nadie tenga que tocar nada, aunque en el vuelo se hayan comprimido ítems.
//
// Conceptos de la liquidación: 010 derechos, 011 tasa de estadística, 415 IVA. Cualquier otro
// (417, 056, 422…) va a "otros" para que el total cierre con el "Monto Total" de la DSI.

const num = (s) => {
  const t = String(s || "").trim();
  if (!/^-?[\d.]+(,\d+)?$/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : null;
};
const esNcm = (s) => /^\d{4}\.\d{2}\.\d{2}$/.test(String(s || "").trim());
const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;

// Basura del pie/encabezado de cada hoja impresa desde el navegador ("891 de 2090", la URL, la fecha).
const esBasura = (x) => /^Destinaci[oó]n Simplificada Courier/i.test(x) || /^https?:\/\//i.test(x) || /^\d+ de \d+$/.test(x) || /^\d{1,2}\/\d{1,2}\/\d{4},\s*\d{1,2}:\d{2}$/.test(x);

// Cabecera de la DSI (27/10/2026): ARCA imprime una fila de rótulos y abajo sus valores, en el mismo
// orden. Se ubica la fila por su primer rótulo y se toman tantos valores como rótulos tenga.
function cabeceraDsi(tk) {
  const fila = (rotulos) => {
    const i = tk.indexOf(rotulos[0]);
    if (i < 0) return {};
    for (let k = 1; k < rotulos.length; k++) if (tk[i + k] !== rotulos[k]) return {};
    const out = {};
    rotulos.forEach((r, k) => { out[r] = tk[i + rotulos.length + k] ?? null; });
    return out;
  };
  const g = fila(["Id.Particular/Id.Liquidación", "Registrado", "Aduana", "Id.Viaje", "Id.Manifiesto", "Nro.Doc.Transporte"]);
  const psp = fila(["CUIT PSP", "Razón Social PSP"]);
  const env = fila(["Doc.Transporte", "Tipo envío", "Ventaja", "Actuación", "Bultos", "Pais Procedencia", "Peso Bruto"]);
  const rem = fila(["Remitente", "Domicilio Remitente"]);
  const rem2 = fila(["Provincia Remitente", "Localidad Remitente", "País Remitente", "Monto FOB Envio"]);
  const des = fila(["Doc.Destinatario", "Destinatario", "Monto Flete"]);
  const des2 = fila(["Domicilio Destinatario", "Localidad Destinatario", "Monto Seguro"]);
  const des3 = fila(["Provincia Destinatario", "Monto Total"]);
  const [idParticular, idLiquidacion] = String(g["Id.Particular/Id.Liquidación"] || "").split("/").map((x) => x.trim());
  const limpio = (v) => (v && v !== "-" && v !== "_" ? String(v).trim() : null);
  return {
    idParticular: limpio(idParticular),
    idLiquidacion: limpio(idLiquidacion),
    registrado: limpio(g.Registrado),
    aduana: limpio(g.Aduana),
    idManifiesto: limpio(g["Id.Manifiesto"]),
    pspCuit: limpio(psp["CUIT PSP"]),
    pspNombre: limpio(psp["Razón Social PSP"]),
    guia: limpio(env["Doc.Transporte"]),
    tipoEnvio: limpio(env["Tipo envío"]),
    bultos: num(env.Bultos),
    procedencia: limpio(env["Pais Procedencia"]),
    pesoBruto: num(env["Peso Bruto"]),
    remitente: limpio(rem.Remitente),
    remitenteDomicilio: [limpio(rem["Domicilio Remitente"]), limpio(rem2["Provincia Remitente"]), limpio(rem2["Localidad Remitente"])].filter(Boolean).join(" · ") || null,
    remitentePais: limpio(rem2["País Remitente"]),
    montoFob: num(rem2["Monto FOB Envio"]),
    destinatarioCuit: String(des["Doc.Destinatario"] || "").replace(/\D/g, "") || null,
    destinatarioNombre: limpio(des.Destinatario),
    montoFlete: num(des["Monto Flete"]),
    destinatarioDomicilio: [limpio(des2["Domicilio Destinatario"]), limpio(des2["Localidad Destinatario"]), limpio(des3["Provincia Destinatario"])].filter(Boolean).join(" ") || null,
    montoSeguro: num(des2["Monto Seguro"]),
    montoTotal: num(des3["Monto Total"]),
  };
}

// tokens: los textos del PDF en orden (pdf.js getTextContent → items[].str, sin vacíos).
export function parseDsiTokens(tokens) {
  const tk = (tokens || []).map((x) => String(x || "").trim()).filter(Boolean).filter((x, i) => i < 2 || !esBasura(x));
  const despuesDe = (label, salto = 1) => { const i = tk.indexOf(label); return i >= 0 ? tk[i + salto] : null; };
  const lines = [];
  for (let i = 0; i < tk.length; i++) {
    if (!esNcm(tk[i])) continue;
    const ncm = tk[i];
    const desc = tk[i + 1] || "";
    const qty = num(tk[i + 3]) ?? num(tk[i + 2]) ?? 0;
    // Hasta el próximo ítem (o el final): FOB y liquidaciones.
    let fin = tk.length;
    for (let j = i + 1; j < tk.length; j++) if (esNcm(tk[j])) { fin = j; break; }
    const bloque = tk.slice(i, fin);
    const iFob = bloque.indexOf("FOB x PA"), iBase = bloque.indexOf("Base Imponible x PA");
    let fob = 0;
    if (iFob >= 0) { const tramo = bloque.slice(iFob + 1, iBase > iFob ? iBase : iFob + 5).map(num).filter((v) => v != null); fob = tramo.length ? tramo[tramo.length - 1] : 0; }
    // "Base Imponible x PA" y "Valor por PA" (valor en aduana) vienen como dos rótulos y dos valores.
    const iValor = bloque.indexOf("Valor por PA");
    const base = iBase >= 0 && iValor === iBase + 1 ? num(bloque[iValor + 1]) : null;
    const valorAduana = iBase >= 0 && iValor === iBase + 1 ? num(bloque[iValor + 2]) : null;
    const iMonto = bloque.indexOf("Monto", bloque.indexOf("Liquidaciones"));
    const l = { ncm, desc, qty, fob: r2(fob), die: 0, te: 0, iva: 0, otros: 0, base, valorAduana, alic: {} };
    if (iMonto >= 0) {
      for (let k = iMonto + 1; k + 2 < bloque.length; k += 3) {
        const cod = bloque[k], alic = num(bloque[k + 1]), monto = num(bloque[k + 2]);
        if (!/^\d{3}$/.test(cod) || monto == null) break;
        if (alic != null) l.alic[cod] = alic;
        if (cod === "010") l.die += monto; else if (cod === "011") l.te += monto; else if (cod === "415") l.iva += monto; else l.otros += monto;
      }
    }
    l.total = r2(l.die + l.te + l.iva + l.otros);
    lines.push(l);
  }
  const total = num(despuesDe("Monto Total", 2)) ?? num(despuesDe("Monto Total", 1));
  const fecha = tk[1] && /^\d{2}\/\d{2}\/\d{4}$/.test(tk[1]) ? tk[1] : null;
  const suma = r2(lines.reduce((a, l) => a + l.total, 0));
  // Destinatario: "CUIT-27963492117" seguido del nombre.
  const iCuit = tk.findIndex((x) => /^CUIT-?\d{11}$/i.test(x));
  const destinatario = iCuit >= 0 ? { cuit: tk[iCuit].replace(/\D/g, ""), nombre: tk[iCuit + 1] || null } : null;
  const cab = cabeceraDsi(tk);
  return {
    destinatario,
    fecha,
    guia: cab.guia || (() => { const i = tk.indexOf("Peso Bruto"); return i >= 0 && /^\d{6,}$/.test(tk[i + 1] || "") ? tk[i + 1] : null; })(),
    total: total != null ? total : suma,
    suma,
    cierra: total == null || Math.abs(total - suma) <= 0.05,
    cab,
    lines,
  };
}

// Reparte cada ítem de la DSI entre los productos de la op. Orden de búsqueda: misma posición
// (8 dígitos), mismos 6, mismos 4 y, si no, misma cantidad. Si un ítem cae en varios productos
// (comprimidos en el vuelo), se reparte por FOB. Lo que no encuentra dueño va a todos por FOB.
// Devuelve, por índice de producto, { derechos, tasaE, iva, otros, lineas: [ncm…] }.
export function asignarDsi(lines, items) {
  const its = (items || []).map((it) => ({ ncm: String(it.ncm_code || "").replace(/[^\d]/g, ""), qty: Number(it.quantity || 0), fob: Number(it.unit_price_usd || 0) * Number(it.quantity || 1) }));
  const out = its.map(() => ({ derechos: 0, tasaE: 0, iva: 0, otros: 0, lineas: [] }));
  if (!its.length) return out;
  const repartir = (l, idxs) => {
    const base = idxs.reduce((a, i) => a + (its[i].fob || 0), 0);
    idxs.forEach((i) => {
      const k = base > 0 ? (its[i].fob || 0) / base : 1 / idxs.length;
      out[i].derechos += l.die * k; out[i].tasaE += l.te * k; out[i].iva += l.iva * k; out[i].otros += (l.otros || 0) * k;
      if (!out[i].lineas.includes(l.ncm)) out[i].lineas.push(l.ncm);
    });
  };
  for (const l of lines || []) {
    const n = String(l.ncm || "").replace(/[^\d]/g, "");
    const por = (len) => its.map((x, i) => (x.ncm && x.ncm.slice(0, len) === n.slice(0, len) ? i : -1)).filter((i) => i >= 0);
    let idxs = por(8);
    if (!idxs.length) idxs = por(6);
    if (!idxs.length) idxs = por(4);
    if (!idxs.length && l.qty > 0) idxs = its.map((x, i) => (x.qty === l.qty ? i : -1)).filter((i) => i >= 0);
    if (!idxs.length) idxs = its.map((_, i) => i);
    repartir(l, idxs);
  }
  return out;
}
