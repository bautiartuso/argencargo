// POST /api/cotizacion/pdf {datos} → PDF A4 de la cotización (29/10/2026).
// Antes el PDF salía de la ventana de imprimir del navegador: en el celular el navegador agrega sus
// márgenes y su encabezado (URL, fecha, "Página 1 de 4"), cada hoja de 296 mm deja de entrar y queda
// una hoja en blanco después de cada una (AGC-02223). Acá se arma con Chromium, igual en todos lados.
// Solo con sesión (cliente o equipo). La página se arma sin JavaScript y solo puede cargar la
// tipografía y el logo: nada que venga en los datos puede hacer que el servidor pida otra cosa.
import { quienLlama } from "../../../../lib/auth-server";
import { htmlCotizacionPdf } from "../../../../lib/cotizacion-pdf";
import { launchBrowser } from "../../../../lib/chromium";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const PERMITIDOS = /^(data:|https:\/\/fonts\.(googleapis|gstatic)\.com\/|https:\/\/(www\.)?argencargo\.com\.ar\/|https:\/\/nhfslvixhlbiyfmedmbr\.supabase\.co\/storage\/v1\/object\/public\/)/;

export async function POST(req) {
  const quien = await quienLlama(req);
  if (!quien?.id) return Response.json({ error: "no_autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const datos = body?.datos;
  if (!datos || typeof datos !== "object") return Response.json({ error: "datos_invalidos" }, { status: 400 });
  let html;
  try { html = htmlCotizacionPdf(datos); } catch (e) { return Response.json({ error: "datos_invalidos" }, { status: 400 }); }
  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (r) => (r.url() === "about:blank" || PERMITIDOS.test(r.url()) ? r.continue() : r.abort()));
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const ref = String(datos.ref || datos.codigo || "").replace(/[^\w-]/g, "");
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Cotizacion${ref ? "-" + ref : ""}.pdf"`, "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cotizacion/pdf]", e?.message);
    return Response.json({ error: "pdf" }, { status: 500 });
  } finally { if (browser) await browser.close().catch(() => {}); }
}
