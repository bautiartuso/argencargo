#!/usr/bin/env node
// Runner local del Content Studio — corre en la Mac de Bautista (launchd cada 10 min).
//
//   1. Pide a la web la siguiente pieza de la cola (+ memoria, brand kit, referencias, aprobadas).
//   2. Arma una carpeta de trabajo: memoria/*.md, brand/ (logos), referencias/ (posteos que gustan),
//      aprobados/ (últimas piezas aprobadas: html + png) y brief.md.
//   3. Claude Code (`claude -p`, Opus, con la suscripción, sin API) como DISEÑADOR → post.html + meta.json.
//   4. Chrome invisible fotografía el HTML en tamaño exacto → post.png.
//   5. Claude Code como DIRECTOR DE ARTE mira post.png y corrige (hasta 2 pasadas).
//   6. Sube la pieza → Aprobación.
//
// Config: ~/.argencargo-runner.json { base, secret, chrome, claude, model, maxPieces }

import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import puppeteer from "puppeteer-core";

const cfg = JSON.parse(await fs.readFile(path.join(os.homedir(), ".argencargo-runner.json"), "utf8"));
const WORK = path.join(os.homedir(), "argencargo-runner");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const api = (p, o = {}) => fetch(`${cfg.base}/api/studio/runner${p}`, { ...o, headers: { "x-runner-secret": cfg.secret, ...(o.headers || {}) } });

function claude(prompt, { cwd, tools = ["Read", "Write", "Glob"], model = cfg.model || "opus", timeoutMs = 15 * 60000 } = {}) {
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

async function bajar(url, dest) {
  try { const r = await fetch(url); if (!r.ok) return false; await fs.writeFile(dest, Buffer.from(await r.arrayBuffer())); return true; } catch { return false; }
}

function promptDisenador(p, ctx) {
  const W = p.width, H = p.height;
  return `Sos el diseñador y redactor de Argencargo. Antes de empezar leé TODA la memoria de la marca en memoria/*.md (identidad, tono, audiencia, productos, dos-and-donts, campanas, historial, brand-kit, referencias-estilo) y el pedido en brief.md.
${ctx.referencias ? `Mirá también referencias/ (posteos que a Bautista le gustan: son la vara de calidad y estilo; no los copies, aprendé la lógica) ` : ""}${ctx.aprobados ? `y aprobados/ (las últimas piezas nuestras aprobadas, html + png: mantené continuidad de estilo con ellas).` : ""}

Creá UNA pieza de Instagram: ${p.kind === "story" ? "HISTORIA de 1080×1920" : "POST DE FEED de 1080×1350 (4:5)"} px.

Escribí dos archivos en esta carpeta:
1) post.html — documento HTML autocontenido (sin JavaScript) que se fotografía en ${W}×${H} px exactos: html y body con margin 0, width ${W}px, height ${H}px, overflow hidden.
   - Fuentes: <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">. Titular en 'Bebas Neue' (TODO el titular, incluida la palabra resaltada); textos en 'Inter' o 'Nunito'.
   - Imágenes: SOLO los logos de la carpeta brand/ (usalos con ruta relativa, ej. src="brand/isotipo.png"). Ninguna imagen externa, ninguna foto. Todo lo demás se dibuja con CSS: degradés, franjas diagonales como las barras del logo, tarjetas, círculos, patrones, iconografía simple en SVG inline. Los logos son azules: sobre fondo oscuro van en cápsula blanca o el isotipo sobre bloque blanco.
   - Titular en mayúsculas, grande, 2 a 4 líneas, con 1 o 2 palabras resaltadas en un bloque #1E8BFF o #0A3D91 con texto blanco. Subtítulo 44–56 px. Márgenes internos mínimos 80 px. En historias, nada importante en los 250 px de arriba ni de abajo. Logo siempre presente y chico.
   - Sin emojis en el HTML, sin lorem ipsum, sin datos inventados (solo lo que dice el brief), sin llamados a la acción agresivos.
   - Nivel: campaña profesional. Composición con aire y jerarquía. HTML compacto y limpio.
2) meta.json — {"headline": "...", "subheadline": "...", "caption": "texto del post, 3 a 8 líneas con saltos, sin hashtags", "hashtags": "8 a 15 hashtags separados por espacio"}

Cuando termines, respondé solo: LISTO.`;
}

function promptDirector(p, pass) {
  return `Sos el director de arte de Argencargo. En esta carpeta está la pieza YA RENDERIZADA: post.png (mirala con Read) y su código post.html; la memoria en memoria/*.md; ${"referencias/ y aprobados/ como vara de estilo."}

Revisá post.png (pasada ${pass} de 2): texto cortado, tapado o fuera del lienzo; tipografía equivocada (el titular completo debe ser 'Bebas Neue'); jerarquía floja; poco aire; logo tapando algo; contraste; composición desequilibrada; que se vea amateur o genérica. Compará con referencias/ y aprobados/: tiene que estar a ese nivel.

Si hay algo que mejorar: corregí post.html (reescribilo completo, respetando que los logos van con ruta relativa brand/...) y respondé "CORREGIDO: " y en una línea qué cambiaste.
Si está impecable: no toques nada y respondé "APROBADO".`;
}

async function procesar(data) {
  const p = data.piece;
  const dir = path.join(WORK, "work", p.id);
  await fs.rm(dir, { recursive: true, force: true });
  for (const d of ["memoria", "brand", "referencias", "aprobados"]) await fs.mkdir(path.join(dir, d), { recursive: true });
  for (const [k, v] of Object.entries(data.memory || {})) await fs.writeFile(path.join(dir, "memoria", `${k}.md`), v || "");
  // Logos y posteos de referencia (imágenes) para que Claude los mire y use.
  const ctx = { referencias: 0, aprobados: 0 };
  for (const a of data.assets || []) {
    const ext = (a.url.split("?")[0].match(/\.(png|jpe?g|webp|svg)$/i) || [".png"])[0];
    if (a.kind === "logo") {
      const name = a.url.split("/").pop().split("?")[0];
      await bajar(a.url, path.join(dir, "brand", name));
    } else {
      ctx.referencias++;
      await bajar(a.url, path.join(dir, "referencias", `ref-${ctx.referencias}${ext}`));
      if (a.note) await fs.writeFile(path.join(dir, "referencias", `ref-${ctx.referencias}.md`), a.note);
    }
  }
  for (const ap of data.aprobados || []) {
    ctx.aprobados++;
    if (ap.html) await fs.writeFile(path.join(dir, "aprobados", `ok-${ctx.aprobados}.html`), ap.html);
    if (ap.image_url) await bajar(ap.image_url, path.join(dir, "aprobados", `ok-${ctx.aprobados}.png`));
  }
  const brief = `# Pieza a crear\n\n- Formato: ${p.kind === "story" ? "historia 1080×1920" : "post de feed 1080×1350 (4:5)"}\n- Pilar: ${p.pillar || "(libre)"}\n- Título interno: ${p.title || ""}\n\n## Brief\n${p.brief || "(libre)"}\n${p.feedback ? `\n## CAMBIOS PEDIDOS POR BAUTISTA sobre la versión anterior (aplicalos todos)\n${p.feedback}\n\nVersión anterior: ${p.headline || ""} / ${p.subheadline || ""}\n` : ""}`;
  await fs.writeFile(path.join(dir, "brief.md"), brief);
  await fs.writeFile(path.join(dir, "CLAUDE.md"), "Trabajás dentro de esta carpeta. Leé memoria/*.md y brief.md; mirá brand/, referencias/ y aprobados/. Escribí únicamente post.html y meta.json (y corregí post.html cuando se te pida). No crees otros archivos ni salgas de la carpeta.");

  log(`🎨 ${p.kind} · ${p.title}`);
  await claude(promptDisenador(p, ctx), { cwd: dir });
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

  // El HTML que se guarda lleva los logos con URL absoluta (para re-renderizar en la web si hace falta).
  const html = (await fs.readFile(htmlPath, "utf8")).replace(/(src|url\()=?["']?brand\//g, (m) => m.replace("brand/", `${cfg.base}/brand/`));
  let meta = {}; try { meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf8")); } catch {}
  const fd = new FormData();
  fd.append("id", p.id); fd.append("html", html);
  for (const k of ["headline", "subheadline", "caption", "hashtags"]) fd.append(k, String(meta[k] || ""));
  fd.append("png", new Blob([await fs.readFile(pngPath)], { type: "image/png" }), "post.png");
  const up = await api("?op=done", { method: "POST", body: fd });
  if (!up.ok) throw new Error(`subida ${up.status}: ${(await up.text()).slice(0, 200)}`);
  log(`   ✅ lista para aprobar`);
}

const max = Number(cfg.maxPieces || 4);
for (let i = 0; i < max; i++) {
  const r = await api("", {});
  if (r.status === 204) { if (i === 0) log("cola vacía"); break; }
  if (!r.ok) { log("error pidiendo pieza", r.status, (await r.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 160)); break; }
  const data = await r.json();
  try { await procesar(data); }
  catch (e) {
    log("   ❌", e.message.slice(0, 300));
    await api("?op=error", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.piece.id, error: e.message.slice(0, 500) }) }).catch(() => {});
  }
}
