// lib/chromium.js — Chromium headless en Vercel (PDFs de facturas, fotos de posts del Content Studio).
// @sparticuz/chromium decide qué libs de sistema descomprimir (AL2 vs AL2023) leyendo
// AWS_EXECUTION_ENV / AWS_LAMBDA_JS_RUNTIME, que Vercel no setea: se le indica según Node.
export async function launchBrowser() {
  if (!process.env.AWS_EXECUTION_ENV && !process.env.AWS_LAMBDA_JS_RUNTIME) {
    const major = Number(process.versions.node.split(".")[0]);
    process.env.AWS_LAMBDA_JS_RUNTIME = major >= 22 ? "nodejs22.x" : major >= 20 ? "nodejs20.x" : "nodejs18.x";
  }
  const chromium = (await import("@sparticuz/chromium")).default;
  const puppeteer = (await import("puppeteer-core")).default;
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
}

// HTML → PNG en tamaño exacto (1080×1350 feed, 1080×1920 historia). Devuelve Buffer.
export async function htmlToPng(html, { width = 1080, height = 1350 } = {}) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 45000 });
    // Fuentes web: esperar a que estén cargadas antes de la foto.
    await page.evaluate(async () => {
      if (!document.fonts) return;
      try { await Promise.all(["Bebas Neue", "Inter", "Nunito"].flatMap((f) => [400, 700, 800].map((w) => document.fonts.load(`${w} 40px "${f}"`).catch(() => null)))); } catch {}
      await document.fonts.ready;
    });
    await new Promise((r) => setTimeout(r, 400));
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
    return Buffer.from(png);
  } finally { await browser.close().catch(() => {}); }
}

// URL → PDF A4 (facturas).
export async function urlToPdf(url) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 40000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" } });
    return Buffer.from(pdf);
  } finally { await browser.close().catch(() => {}); }
}
