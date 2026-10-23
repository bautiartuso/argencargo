// GET /api/portal/legajo/pdf?op_id=…&doc=todo|recibo:<id>|factura:<token>[&ver=1]
// El legajo en PDF (22/10/2026): un recibo o una factura sueltos, o "todo" en un solo archivo
// (facturas de Argencargo, factura del courier, DSI, guía aérea y recibos, en ese orden). Recibos y facturas se
// imprimen con Chromium; la DSI y la factura del courier se bajan del bucket y se pegan con pdf-lib
// (si son foto, van en una hoja A4). ver=1 lo abre en la pestaña en vez de descargarlo.
import { PDFDocument } from "pdf-lib";
import { cargarLegajo, saldoLegajo, nombreArchivo, BASE_URL } from "../../../../../lib/legajo-server";
import { reciboHtml, documentoHtml } from "../../../../../lib/pdf-templates";
import { launchBrowser } from "../../../../../lib/chromium";

export const maxDuration = 60;

async function pegar(destino, bytes, ext) {
  if (ext === "pdf") {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    (await destino.copyPages(src, src.getPageIndices())).forEach((p) => destino.addPage(p));
    return;
  }
  const img = ext === "png" ? await destino.embedPng(bytes) : await destino.embedJpg(bytes);
  const page = destino.addPage([595.28, 841.89]);
  const k = Math.min((595.28 - 56) / img.width, (841.89 - 56) / img.height);
  page.drawImage(img, { x: (595.28 - img.width * k) / 2, y: (841.89 - img.height * k) / 2, width: img.width * k, height: img.height * k });
}

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const l = await cargarLegajo(req, q.get("op_id"));
  if (l.error) return Response.json({ error: l.error }, { status: l.status });
  if (!l.visible) return Response.json({ error: "no_visible" }, { status: 404 });
  const doc = q.get("doc") || "todo";
  const code = l.op.operation_code;
  const saldo = saldoLegajo(l);
  const recibos = doc === "todo" ? l.pagos : l.pagos.filter((p) => doc === `recibo:${p.id}`);
  const facturas = doc === "todo" ? l.facturas : l.facturas.filter((f) => doc === `factura:${f.token}`);
  const adjuntos = doc === "todo" ? ["factura_courier", "dsi", "guia_aerea"].map((t) => l.docs.find((d) => d.tipo === t)).filter(Boolean) : [];
  if (!recibos.length && !facturas.length && !adjuntos.length) return Response.json({ error: "sin_documentos" }, { status: 404 });

  const salida = await PDFDocument.create();
  const bajadas = adjuntos.map((d) => fetch(d.url).then(async (r) => (r.ok ? { d, bytes: new Uint8Array(await r.arrayBuffer()) } : null)).catch(() => null));
  let browser = null;
  try {
    const impresos = { facturas: [], recibos: [] };
    if (facturas.length || recibos.length) {
      browser = await launchBrowser();
      const page = await browser.newPage();
      for (const f of facturas) {
        await page.goto(f.url, { waitUntil: "networkidle0", timeout: 40000 });
        impresos.facturas.push(await page.pdf({ format: "A4", printBackground: true, margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" } }));
      }
      for (const p of recibos) {
        const { title, html } = reciboHtml({ op: l.op, payment: p, client: l.cliente, settings: l.settings, saldoRestante: saldo });
        await page.setContent(documentoHtml(title, html), { waitUntil: "networkidle0", timeout: 30000 });
        impresos.recibos.push(await page.pdf({ width: "210mm", height: "148mm", printBackground: true, pageRanges: "1" }));
      }
    }
    for (const b of impresos.facturas) await pegar(salida, b, "pdf");
    for (const x of await Promise.all(bajadas)) if (x) await pegar(salida, x.bytes, x.d.ext === "jpeg" ? "jpg" : x.d.ext);
    for (const b of impresos.recibos) await pegar(salida, b, "pdf");
  } finally { if (browser) await browser.close().catch(() => {}); }

  const nombre = nombreArchivo(doc === "todo" ? `Legajo ${code}.pdf` : recibos.length ? `Recibo ${String(recibos[0].receipt_number || "").padStart(5, "0")} ${code}.pdf` : `Factura ${facturas[0].numero} ${code}.pdf`);
  return new Response(Buffer.from(await salida.save()), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${q.get("ver") ? "inline" : "attachment"}; filename="${nombre}"`, "Cache-Control": "private, no-store" },
  });
}
