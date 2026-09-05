#!/usr/bin/env node
// Runner local del Content Studio — corre en la Mac de Bautista.
//
// Cada vez que arranca (launchd lo dispara cada 10 min mientras la Mac está prendida):
//   1. Pide a la web la siguiente pieza de la cola (/api/studio/runner/next).
//   2. Arma una carpeta de trabajo con la memoria de marca y el brief.
//   3. Corre Claude Code (`claude -p`, con la suscripción Max, sin API) como DISEÑADOR: escribe
//      post.html + meta.json.
//   4. Saca la foto del HTML con Chrome en modo invisible → post.png.
//   5. Corre Claude Code como DIRECTOR DE ARTE: mira post.png, corrige post.html si hace falta
//      (hasta 2 pasadas), se vuelve a fotografiar.
//   6. Sube la pieza terminada a la web → queda en Aprobación.
//
// Config: ~/.argencargo-runner.json  { base, secret, chrome, claude, model, maxPieces }

import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import puppeteer from "puppeteer-core";

const CFG_PATH = path.join(os.homedir(), ".argencargo-runner.json");
const cfg = JSON.parse(await fs.readFile(CFG_PATH, "utf8"));
const WORK = path.join(os.homedir(), "argencargo-runner");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const api = (p, o = {}) => fetch(`${cfg.base}/api/studio/runner${p}`, { ...o, headers: { "x-runner-secret": cfg.secret, ...(o.headers || {}) } });

function claude(prompt, { cwd, tools = ["Read", "Write"], model = cfg.model || "opus", timeoutMs = 15 * 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const bin = cfg.claude || "claude";
    const args = ["-p", prompt, "--output-format", "json", "--model", model, "--allowedTools", ...tools];
    const env = { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${path.dirname(bin)}` };
    execFile(bin, args, { cwd, env, maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs }, (err, stdout, stderr) => {
      let j = null; try { j = JSON.parse(stdout); } catch {}
      if (j?.is_error) return reject(new Error(`Claude: ${j.result}`));
      if (err && !j) return reject(new Error(stderr?.slice(0, 400) || err.message));
      resolve(j || { result: stdout });
    });
  });
}

async function render(htmlPath, pngPath, { width, height }) {
  const browser = await puppeteer.launch({ executablePath: cfg.chrome || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(async () => { if (document.fonts) { try { await document.fonts.ready; } catch {} } });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: pngPath, type: "png", clip: { x: 0, y: 0, width, height } });
  } finally { await browser.close().catch(() => {}); }
}

const BASE_ASSETS = "https://www.argencargo.com.ar";

function promptDisenador(p, photoUrl) {
  const W = p.width, H = p.height;
  return `Sos el diseñador y redactor de Argencargo. En esta carpeta tenés la memoria de la marca (memoria/*.md: leelos TODOS antes de empezar) y el pedido (brief.md).

Creá UNA pieza de Instagram: ${p.kind === "story" ? "HISTORIA de 1080×1920" : "POST DE FEED de 1080×1350"} px.

Escribí dos archivos en esta carpeta:
1) post.html — documento HTML autocontenido (sin JavaScript) que se va a fotografiar en ${W}×${H} px exactos: html y body con margin 0, width ${W}px, height ${H}px, overflow hidden.
   - Fuentes: <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">. Titulares en 'Bebas Neue' (TODO el titular, incluida la palabra resaltada), textos en 'Inter' o 'Nunito'.
   - Imágenes permitidas: SOLO ${BASE_ASSETS}/brand/logo-completo.png, ${BASE_ASSETS}/brand/isotipo.png, ${BASE_ASSETS}/brand/logotipo-texto.png${photoUrl ? ` y la FOTO DE FONDO ${photoUrl} (a pantalla completa, object-fit cover, con un degradé oscuro o azul encima para que el texto se lea)` : ""}. Nada más. Los logos son azules: sobre fondo oscuro van en una cápsula blanca o el isotipo sobre bloque blanco.
   - Titular en mayúsculas, grande (Bebas Neue 120–190 px en feed, 130–210 px en historia), 2 a 4 líneas, con 1 o 2 palabras resaltadas en un bloque #1E8BFF o #0A3D91 con texto blanco. Subtítulo Inter 44–56 px. Márgenes internos mínimos 80 px. En historias, nada importante en los 250 px de arriba ni de abajo. Logo siempre presente y chico.
   - Sin emojis en el HTML, sin lorem ipsum, sin datos inventados (solo lo que dice el brief), sin llamados a la acción agresivos.
   - Nivel: pieza de campaña profesional, como la referencia de estilo. Formas, franjas diagonales como las barras del logo, tarjetas y bloques de color con CSS son bienvenidos. HTML compacto y limpio.
2) meta.json — {"headline": "...", "subheadline": "...", "caption": "texto del post, 3 a 8 líneas con saltos, sin hashtags", "hashtags": "8 a 15 hashtags separados por espacio"}

Cuando termines los dos archivos, respondé solo: LISTO.`;
}

function promptDirector(p, pass) {
  return `Sos el director de arte de Argencargo. En esta carpeta está la pieza YA RENDERIZADA: post.png (mirala con Read) y su código post.html, más la memoria de marca en memoria/*.md (brand kit y referencia de estilo).

Revisá post.png con ojo de director de arte (pasada ${pass} de 2): texto cortado, tapado o fuera del lienzo; tipografía equivocada (el titular completo debe ser 'Bebas Neue'); jerarquía floja; poco aire; logo tapando algo; contraste; composición desequilibrada; que se vea amateur o genérica. Tiene que estar al nivel de una campaña profesional.

Si hay algo que mejorar: corregí post.html (reescribilo completo) y respondé "CORREGIDO: " y en una línea qué cambiaste.
Si está impecable: no toques nada y respondé "APROBADO".`;
}

async function procesar(data) {
  const p = data.piece;
  const dir = path.join(WORK, "work", p.id);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(path.join(dir, "memoria"), { recursive: true });
  for (const [k, v] of Object.entries(data.memory || {})) await fs.writeFile(path.join(dir, "memoria", `${k}.md`), v || "");
  const brief = `# Pieza a crear\n\n- Formato: ${p.kind === "story" ? "historia 1080×1920" : "post de feed 1080×1350"}\n- Pilar: ${p.pillar || "(libre)"}\n- Título interno: ${p.title || ""}\n\n## Brief\n${p.brief || "(libre)"}\n${p.feedback ? `\n## CAMBIOS PEDIDOS POR BAUTISTA sobre la versión anterior (aplicalos todos)\n${p.feedback}\n\nVersión anterior: ${p.headline || ""} / ${p.subheadline || ""}\n` : ""}${p.photo_url ? `\n## Foto de fondo disponible\n${p.photo_url}\n` : ""}`;
  await fs.writeFile(path.join(dir, "brief.md"), brief);
  // Archivo de instrucciones que Claude Code lee solo al arrancar en la carpeta.
  await fs.writeFile(path.join(dir, "CLAUDE.md"), "Trabajás dentro de esta carpeta. Leé memoria/*.md y brief.md. Escribí únicamente post.html y meta.json (y corregí post.html cuando se te pida). No crees otros archivos.");

  log(`🎨 ${p.kind} · ${p.title}`);
  await claude(promptDisenador(p, p.photo_url), { cwd: dir });
  const htmlPath = path.join(dir, "post.html"), pngPath = path.join(dir, "post.png");
  await fs.access(htmlPath);
  await render(htmlPath, pngPath, { width: p.width, height: p.height });

  for (let pass = 1; pass <= 2; pass++) {
    const before = await fs.readFile(htmlPath, "utf8");
    const r = await claude(promptDirector(p, pass), { cwd: dir });
    const after = await fs.readFile(htmlPath, "utf8");
    const txt = String(r.result || "");
    log(`   🧐 pasada ${pass}: ${txt.slice(0, 120).replace(/\n/g, " ")}`);
    if (after === before || /^APROBADO/i.test(txt.trim())) break;
    await render(htmlPath, pngPath, { width: p.width, height: p.height });
  }

  const html = await fs.readFile(htmlPath, "utf8");
  let meta = {}; try { meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf8")); } catch {}
  const fd = new FormData();
  fd.append("id", p.id); fd.append("html", html);
  for (const k of ["headline", "subheadline", "caption", "hashtags"]) fd.append(k, String(meta[k] || ""));
  fd.append("png", new Blob([await fs.readFile(pngPath)], { type: "image/png" }), "post.png");
  const up = await api("?op=done", { method: "POST", body: fd });
  if (!up.ok) throw new Error(`subida ${up.status}: ${await up.text()}`);
  log(`   ✅ lista para aprobar`);
}

const max = Number(cfg.maxPieces || 4);
for (let i = 0; i < max; i++) {
  const r = await api("/next".replace("/next", ""), {});
  if (r.status === 204) { if (i === 0) log("cola vacía"); break; }
  if (!r.ok) { log("error pidiendo pieza", r.status, (await r.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 160)); break; }
  const data = await r.json();
  try { await procesar(data); }
  catch (e) {
    log("   ❌", e.message.slice(0, 300));
    await api("?op=error", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.piece.id, error: e.message.slice(0, 500) }) }).catch(() => {});
  }
}
