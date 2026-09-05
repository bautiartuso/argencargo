#!/usr/bin/env node
// Runner local del Content Studio — corre en la Mac de Bautista (launchd cada 10 min).
//
//   1. Pide a la web la siguiente pieza de la cola (+ memoria, brand kit, referencias, aprobadas).
//   2. Arma una carpeta de trabajo: memoria/*.md, brand/ (logos), referencias/ (posteos que gustan),
//      aprobados/ (últimas piezas aprobadas: html + png) y brief.md.
//   3. Claude Code (`claude -p`, Opus, con la suscripción, sin API) como DISEÑADOR → slide-1.html..slide-N.html + meta.json
//      (posteo = 1 imagen; carrusel = 3 a 6; historia suelta = 1; secuencia de historias = 2 a 4).
//   4. Chrome invisible fotografía cada HTML en tamaño exacto → slide-N.png.
//   5. Claude Code como DIRECTOR DE ARTE mira los PNG y corrige (hasta 2 pasadas).
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
    // Medición: textos encimados, textos fuera del lienzo, texto en zona no segura de historias.
    return await page.evaluate((W, H) => {
      const out = [];
      const els = [...document.querySelectorAll("body *")].filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
        const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
        return t.length >= 2;
      });
      const boxes = els.map((el) => ({ el, r: el.getBoundingClientRect(), t: el.textContent.trim().slice(0, 40) })).filter((b) => b.r.width > 0 && b.r.height > 0);
      for (const b of boxes) {
        if (b.r.left < -1 || b.r.top < -1 || b.r.right > W + 1 || b.r.bottom > H + 1) out.push(`Texto fuera del lienzo: "${b.t}" (${Math.round(b.r.left)},${Math.round(b.r.top)}→${Math.round(b.r.right)},${Math.round(b.r.bottom)})`);
        if (H >= 1900 && (b.r.top < 250 || b.r.bottom > H - 250)) out.push(`Texto en zona no segura de historia (250 px arriba/abajo): "${b.t}"`);
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (ix > 8 && iy > 8) out.push(`Textos encimados: "${a.t}" y "${b.t}"`);
      }
      const imgs = [...document.images].filter((im) => /brand\//.test(im.getAttribute("src") || ""));
      for (const im of imgs) { const r = im.getBoundingClientRect(); if (r.width > 380) out.push(`Logo demasiado grande (${Math.round(r.width)} px de ancho)`); }
      return [...new Set(out)].slice(0, 12);
    }, width, height);
  } finally { await browser.close().catch(() => {}); }
}

async function bajar(url, dest) {
  try { const r = await fetch(url); if (!r.ok) return false; await fs.writeFile(dest, Buffer.from(await r.arrayBuffer())); return true; } catch { return false; }
}

const nSlides = (p) => Math.max(1, Number(p.slides) || 1);
function formatoLabel(p) {
  const n = nSlides(p);
  if (p.kind === "carousel") return `CARRUSEL de ${n} imágenes de 1080×1350 (4:5)`;
  if (p.kind === "story") return n > 1 ? `SECUENCIA de ${n} HISTORIAS de 1080×1920 (se publican seguidas, en orden)` : "HISTORIA suelta de 1080×1920";
  return "POSTEO DE FEED de UNA sola imagen de 1080×1350 (4:5)";
}
function reglasFormato(p) {
  const n = nSlides(p);
  if (p.kind === "carousel") return `REGLAS DEL CARRUSEL:
   - slide-1 es la PORTADA: el gancho grande (titular de 2 a 4 líneas con palabra resaltada) + un "Deslizá →" chico y discreto abajo a la derecha. Nada más.
   - slide-2 a slide-${n - 1}: UNA idea por imagen. Poco texto: un título corto + 1 a 3 líneas o una lista de máximo 3 ítems. El texto se reparte entre las imágenes, nunca se amontona. Número de imagen chico (ej. "2/${n}") en una esquina.
   - slide-${n} es el CIERRE: resumen en una línea + logo completo. Sin "seguinos", sin pedidos agresivos; a lo sumo "Cualquier duda, escribinos".
   - Misma paleta, mismo fondo y misma tipografía en todas: tiene que verse como una sola pieza. Seguí slides_plan del brief al pie de la letra.`;
  if (p.kind === "story" && n > 1) return `REGLAS DE LA SECUENCIA DE HISTORIAS:
   - slide-1: el gancho, dice de qué se trata en una frase concreta (no "cambió algo": QUÉ cambió).
   - slide-2 a slide-${n - 1}: el desarrollo, con lo concreto (qué cambió exactamente, a quién alcanza, desde cuándo, qué conviene hacer). Una idea por historia, se lee en 5 segundos.
   - slide-${n}: el cierre (una línea + logo). Indicador chico "1/${n}", "2/${n}"… en una esquina. Misma paleta en todas.`;
  if (p.kind === "story") return `REGLAS DE LA HISTORIA SUELTA: una sola idea, liviana, se lee en 3 segundos. Nada de "deslizá" ni "seguí leyendo".`;
  return `REGLAS DEL POSTEO SIMPLE: es UNA sola imagen. La idea cierra ahí. PROHIBIDO "Deslizá", "seguí leyendo", "ver más", flechas de continuar o numeración.`;
}

function promptDisenador(p, ctx) {
  const W = p.width, H = p.height;
  const n = nSlides(p);
  return `Sos el diseñador y redactor de Argencargo. Antes de empezar leé TODA la memoria de la marca en memoria/*.md (identidad, tono, audiencia, productos, dos-and-donts, campanas, historial, brand-kit, referencias-estilo) y el pedido en brief.md.
${ctx.referencias ? `Mirá también referencias/ (posteos que a Bautista le gustan: son la vara de calidad y estilo; no los copies, aprendé la lógica) ` : ""}${ctx.aprobados ? `y aprobados/ (las últimas piezas nuestras aprobadas, html + png: mantené continuidad de estilo con ellas).` : ""}

Creá UNA pieza de Instagram: ${formatoLabel(p)}.
${reglasFormato(p)}

Escribí estos archivos en esta carpeta:
1) ${n > 1 ? `slide-1.html … slide-${n}.html (uno por imagen, en orden)` : "slide-1.html"} — cada uno un documento HTML autocontenido (sin JavaScript) que se fotografía en ${W}×${H} px exactos: html y body con margin 0, width ${W}px, height ${H}px, overflow hidden.
   - Fuentes: <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">. Titular en 'Bebas Neue' (TODO el titular, incluida la palabra resaltada); textos en 'Inter' o 'Nunito'.
   - Imágenes: SOLO los logos de la carpeta brand/ (PNG con fondo TRANSPARENTE, ruta relativa, ej. src="brand/isotipo.png"). NUNCA los pongas dentro de un recuadro ni cápsula blanca. Sobre fondo oscuro, hacelos blancos con CSS: style="filter:brightness(0) invert(1)". Sobre fondo claro, van en su azul original. Ninguna imagen externa, ninguna foto. Todo lo demás se dibuja con CSS: degradés, franjas diagonales como las barras del logo, tarjetas, círculos, patrones, iconografía simple en SVG inline.
   - FONDO: respetá lo que dice el brief ("Fondo: claro" = blanco #FFFFFF o gris muy claro con textos en #0A3D91/#0A1628; "Fondo: oscuro" = navy #0A1628 o degradé azul con textos blancos). Si el brief no lo dice, elegí claro. La marca vive en blanco y azul; no todo es oscuro.
   - CONCEPTO VISUAL: respetá el "Concepto visual" del brief (número gigante, comparativa, checklist, mito vs realidad, etc.). Que la pieza se vea distinta a las anteriores en aprobados/.
   - LAYOUT: pensá la pieza como una grilla vertical de máximo 3 bloques (cabecera con logo chico, bloque principal, pie). Usá flex/grid, NUNCA position:absolute para texto (solo para formas decorativas de fondo). Cada bloque con su espacio; nada se superpone, nada se corta. Titular en mayúsculas, grande, 2 a 4 líneas, con 1 o 2 palabras resaltadas en un bloque #1E8BFF o #0A3D91 con texto blanco. Subtítulo 44–56 px, line-height 1.25. Márgenes internos mínimos 80 px. En historias, nada importante en los 250 px de arriba ni de abajo. Logo siempre presente y chico (isotipo 90–120 px o logo completo 260–320 px).
   - Sin emojis en el HTML, sin lorem ipsum, sin datos inventados (solo lo que dice el brief), sin llamados a la acción agresivos.
   - Nivel: campaña profesional. Composición con aire y jerarquía. HTML compacto y limpio.
2) meta.json — {"headline": "...", "subheadline": "...", "caption": "...", "hashtags": "..."}
   - caption (solo para POSTEOS y CARRUSELES; en historias dejalo vacío): el texto que se publica junto a la imagen, 4 a 10 líneas con saltos, tono de la marca (tono.md), una idea por línea, que amplíe lo que dicen las imágenes (no lo repita), sin hashtags, sin llamado a la acción agresivo; puede cerrar con "Cualquier duda, escribinos". En un carrusel puede arrancar con una pregunta y contar lo que el carrusel resume.
   - hashtags (solo POSTEOS y CARRUSELES): SIEMPRE incluí estos fijos: #argencargo #importardesdechina #importaciones #comercioexterior #courier #logisticainternacional, y sumá 5 a 8 específicos del tema (en español, sin espacios). Separados por espacio. En historias, vacío.

Cuando termines, respondé solo: LISTO.`;
}

function promptDirector(p, pass, defectos) {
  const n = nSlides(p);
  const pngs = n > 1 ? `slide-1.png … slide-${n}.png (miralos TODOS con Read, en orden)` : "slide-1.png (miralo con Read)";
  const htmls = n > 1 ? "slide-N.html correspondiente" : "slide-1.html";
  return `Sos el director de arte de Argencargo. En esta carpeta está la pieza YA RENDERIZADA: ${pngs} y su código ${n > 1 ? "slide-N.html" : "slide-1.html"}; la memoria en memoria/*.md; referencias/ y aprobados/ como vara de estilo. Formato: ${formatoLabel(p)}.
${defectos.length ? `\nDEFECTOS MEDIDOS AUTOMÁTICAMENTE EN EL RENDER (corregilos sí o sí):\n${defectos.map((d) => `- ${d}`).join("\n")}\n` : ""}
Revisá (pasada ${pass} de 2): texto cortado, tapado o fuera del lienzo; textos encimados; tipografía equivocada (el titular completo debe ser 'Bebas Neue'); jerarquía floja; poco aire; logo dentro de un recuadro blanco (prohibido: el logo va transparente, blanco con filter:brightness(0) invert(1) sobre fondo oscuro); fondo que no respeta el brief (claro/oscuro); composición desequilibrada; que se vea amateur o genérica.${n > 1 ? " En carruseles y secuencias: continuidad (misma paleta y tipografía en todas), poco texto por imagen, portada con gancho, cierre con logo, numeración discreta." : p.kind === "feed" ? ' Si aparece "Deslizá", flechas de continuar o numeración en un posteo de una sola imagen, sacalo.' : ""} Compará con referencias/ y aprobados/: tiene que estar a ese nivel.

Si hay algo que mejorar: corregí el ${htmls} (reescribilo completo, respetando que los logos van con ruta relativa brand/...) y respondé "CORREGIDO: " y en una línea qué cambiaste.
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
  const n = nSlides(p);
  const plan = Array.isArray(p.slides_plan) && p.slides_plan.length ? `\n## Plan de imágenes (una línea por imagen, en orden; respetalo)\n${p.slides_plan.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n` : "";
  const brief = `# Pieza a crear\n\n- Formato: ${formatoLabel(p)}\n- Pilar: ${p.pillar || "(libre)"}\n- Título interno: ${p.title || ""}\n\n## Brief\n${p.brief || "(libre)"}\n${plan}${p.feedback ? `\n## CAMBIOS PEDIDOS POR BAUTISTA sobre la versión anterior (aplicalos todos)\n${p.feedback}\n\nVersión anterior: ${p.headline || ""} / ${p.subheadline || ""}\n` : ""}`;
  await fs.writeFile(path.join(dir, "brief.md"), brief);
  await fs.writeFile(path.join(dir, "CLAUDE.md"), `Trabajás dentro de esta carpeta. Leé memoria/*.md y brief.md; mirá brand/, referencias/ y aprobados/. Escribí únicamente ${n > 1 ? `slide-1.html … slide-${n}.html` : "slide-1.html"} y meta.json (y corregilos cuando se te pida). No crees otros archivos ni salgas de la carpeta.`);

  log(`🎨 ${p.kind}${n > 1 ? ` ×${n}` : ""} · ${p.title}`);
  await claude(promptDisenador(p, ctx), { cwd: dir });
  const slides = Array.from({ length: n }, (_, i) => ({ html: path.join(dir, `slide-${i + 1}.html`), png: path.join(dir, `slide-${i + 1}.png`) }));
  for (const s of slides) await fs.access(s.html);
  const renderAll = async () => {
    const out = [];
    for (let i = 0; i < slides.length; i++) { const d = await render(slides[i].html, slides[i].png, { width: p.width, height: p.height }); out.push(...d.map((x) => (n > 1 ? `[slide-${i + 1}] ${x}` : x))); }
    return out;
  };
  let defectos = await renderAll();
  if (defectos.length) log(`   📐 medición: ${defectos.length} defecto(s)`);
  const leerTodo = async () => (await Promise.all(slides.map((s) => fs.readFile(s.html, "utf8")))).join("\n<!--slide-->\n");

  for (let pass = 1; pass <= 2; pass++) {
    const before = await leerTodo();
    const r = await claude(promptDirector(p, pass, defectos), { cwd: dir });
    const after = await leerTodo();
    const txt = String(r.result || "");
    log(`   🧐 pasada ${pass}: ${txt.slice(0, 120).replace(/\n/g, " ")}`);
    if (after === before || (/^APROBADO/i.test(txt.trim()) && !defectos.length)) break;
    defectos = await renderAll();
    if (defectos.length) log(`   📐 medición: ${defectos.length} defecto(s)`); else break;
  }

  // El HTML que se guarda lleva los logos con URL absoluta (para re-renderizar en la web si hace falta).
  const absoluto = (h) => h.replace(/(src|url\()=?["']?brand\//g, (m) => m.replace("brand/", `${cfg.base}/brand/`));
  let meta = {}; try { meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf8")); } catch {}
  const fd = new FormData();
  fd.append("id", p.id);
  for (const k of ["headline", "subheadline", "caption", "hashtags"]) fd.append(k, String(meta[k] || ""));
  for (let i = 0; i < slides.length; i++) {
    fd.append(`html_${i + 1}`, absoluto(await fs.readFile(slides[i].html, "utf8")));
    fd.append(`png_${i + 1}`, new Blob([await fs.readFile(slides[i].png)], { type: "image/png" }), `slide-${i + 1}.png`);
  }
  const up = await api("?op=done", { method: "POST", body: fd });
  if (!up.ok) throw new Error(`subida ${up.status}: ${(await up.text()).slice(0, 200)}`);
  log(`   ✅ lista para aprobar${n > 1 ? ` (${n} imágenes)` : ""}`);
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
