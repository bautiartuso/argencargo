// Lectura de la DSI del lado del servidor (27/10/2026): las DSI cargadas antes de que el lector sacara
// la cabecera (remitente, liquidación, domicilio) se vuelven a leer del PDF del legajo una sola vez y
// se guarda el resultado en legajo_docs.datos de todas las copias (cada op del vuelo tiene la suya).
import { parseDsiTokens } from "./dsi.js";

export async function tokensDePdf(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js");
  const lib = pdfjs.default || pdfjs;
  const pdf = await lib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  const toks = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    toks.push(...tc.items.map((x) => String(x.str || "").trim()).filter(Boolean));
  }
  return toks;
}

export async function leerDsiPdf(bytes) {
  return parseDsiTokens(await tokensDePdf(bytes));
}
