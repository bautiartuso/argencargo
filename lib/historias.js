// lib/historias.js — Historias destacadas de Instagram (18/10/2026).
//
// Bautista no quiere editar imágenes: pega la captura de una reseña de Google, Claude lee nombre,
// estrellas, fecha y texto, y acá se arma la historia 1080×1920 con la plantilla de la marca
// (brand kit en docs/marca/03-brand-kit.md: blanco + degradé #0A3D91→#1E8BFF, Bebas Neue + Inter,
// zonas seguras de 250 px arriba y abajo). Después la foto va a Telegram y él la sube al destacado
// "Clientes" desde el celular (Instagram no deja agregar a destacados por API).

const BASE = "https://argencargo.com.ar";
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Tamaño del texto según el largo: una reseña corta va grande, una larga baja hasta caber.
function fontSize(len) {
  if (len <= 90) return 58;
  if (len <= 160) return 50;
  if (len <= 260) return 44;
  if (len <= 380) return 38;
  if (len <= 520) return 33;
  return 29;
}

const GOOGLE_G = `<svg viewBox="0 0 48 48" width="52" height="52"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

const STAR = `<svg viewBox="0 0 24 24" width="40" height="40"><path fill="#FBBC04" d="M12 2.5l2.95 6.3 6.9.75-5.1 4.7 1.4 6.8L12 17.6l-6.15 3.45 1.4-6.8-5.1-4.7 6.9-.75z"/></svg>`;
const STAR_OFF = STAR.replace("#FBBC04", "#E2E8F0");

// Historia 1080×1920 con una reseña. datos = {nombre, estrellas, fecha, texto}.
export function htmlHistoriaResena(datos) {
  const nombre = String(datos.nombre || "Cliente de Argencargo").trim();
  const estrellas = Math.max(1, Math.min(5, Math.round(Number(datos.estrellas) || 5)));
  const fecha = String(datos.fecha || "").trim();
  const texto = String(datos.texto || "").trim();
  const inicial = (nombre.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/) || ["A"])[0].toUpperCase();
  const fs = fontSize(texto.length);
  const stars = Array.from({ length: 5 }, (_, i) => (i < estrellas ? STAR : STAR_OFF)).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1920px;overflow:hidden;background:#fff;font-family:Inter,system-ui,sans-serif;color:#0A1628}
  .bg{position:absolute;inset:0;background:#fff}
  .blob{position:absolute;border-radius:50%;background:linear-gradient(135deg,#0A3D91 0%,#1E8BFF 100%);opacity:.10}
  .b1{width:900px;height:900px;left:-380px;top:-420px}
  .b2{width:760px;height:760px;right:-320px;bottom:-300px;opacity:.14}
  .band{position:absolute;left:0;right:0;top:0;height:22px;background:linear-gradient(90deg,#0A3D91,#1E8BFF)}
  .wrap{position:absolute;left:0;right:0;top:0;bottom:0;padding:290px 84px 270px;display:flex;flex-direction:column;align-items:center}
  .eyebrow{font-family:'Bebas Neue',Inter,sans-serif;font-size:74px;letter-spacing:.04em;line-height:1;text-align:center;color:#0A3D91}
  .eyebrow b{display:inline-block;background:#1E8BFF;color:#fff;padding:4px 22px 0;border-radius:14px;font-weight:400}
  .sub{margin-top:18px;font-size:27px;font-weight:500;color:#334155;text-align:center}
  .card{margin-top:60px;width:100%;background:#fff;border-radius:40px;padding:56px 60px 60px;box-shadow:0 30px 80px rgba(10,61,145,.16),0 2px 0 rgba(10,61,145,.06);border:2px solid rgba(10,61,145,.08);position:relative}
  .card:before{content:"";position:absolute;left:0;top:70px;bottom:70px;width:10px;border-radius:0 10px 10px 0;background:linear-gradient(180deg,#0A3D91,#1E8BFF)}
  .head{display:flex;align-items:center;gap:22px}
  .g{width:84px;height:84px;border-radius:50%;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.10);display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .gt{font-size:24px;font-weight:700;color:#0A3D91;letter-spacing:.06em;text-transform:uppercase}
  .gs{font-size:22px;color:#64748B;font-weight:500;margin-top:4px}
  .stars{display:flex;gap:6px;margin:34px 0 26px}
  .quote{font-size:${fs}px;line-height:1.32;font-weight:500;color:#0A1628;letter-spacing:-.01em;overflow:hidden;max-height:${fs * 1.32 * 11}px}
  .quote:before{content:"\\201C";color:#1E8BFF;font-weight:800;margin-right:4px}
  .quote:after{content:"\\201D";color:#1E8BFF;font-weight:800;margin-left:4px}
  .who{display:flex;align-items:center;gap:20px;margin-top:40px;padding-top:34px;border-top:2px solid #EEF2F7}
  .av{width:84px;height:84px;border-radius:50%;background:linear-gradient(135deg,#0A3D91,#1E8BFF);color:#fff;font-weight:800;font-size:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .name{font-size:32px;font-weight:700;color:#0A1628}
  .when{font-size:22px;color:#64748B;font-weight:500;margin-top:4px}
  .foot{margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:22px}
  .pill{background:linear-gradient(135deg,#0A3D91,#1E8BFF);color:#fff;font-weight:700;font-size:30px;padding:20px 48px;border-radius:999px;letter-spacing:.01em;box-shadow:0 14px 40px rgba(30,139,255,.35)}
  .logo{height:54px;width:auto}
</style></head><body>
<div class="bg"><div class="blob b1"></div><div class="blob b2"></div><div class="band"></div></div>
<div class="wrap">
  <div class="eyebrow">LO QUE DICEN<br>NUESTROS <b>CLIENTES</b></div>
  <div class="sub">Importadores reales que ya trabajan con Argencargo</div>
  <div class="card">
    <div class="head"><div class="g">${GOOGLE_G}</div><div><div class="gt">Reseña en Google</div><div class="gs">Opinión verificada</div></div></div>
    <div class="stars">${stars}</div>
    <div class="quote">${esc(texto)}</div>
    <div class="who"><div class="av">${esc(inicial)}</div><div><div class="name">${esc(nombre)}</div>${fecha ? `<div class="when">${esc(fecha)}</div>` : ""}</div></div>
  </div>
  <div class="foot">
    <div class="pill">argencargo.com.ar</div>
    <img class="logo" src="${BASE}/brand/logo-horizontal.png" alt="">
  </div>
</div>
</body></html>`;
}

// Portada de destacado 1080×1920 (Instagram muestra el centro en un círculo): icono grande y
// nombre chico, fondo con el degradé de la marca. Se hace una sola vez por destacado.
export function htmlPortadaDestacado({ icono, nombre }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@600;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1920px;overflow:hidden;background:linear-gradient(160deg,#0A3D91 0%,#1E8BFF 100%);font-family:Inter,sans-serif;color:#fff}
  .c{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:760px;height:760px;border-radius:50%;background:rgba(255,255,255,.10);border:6px solid rgba(255,255,255,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
  .i{font-size:300px;line-height:1}
  .n{font-family:'Bebas Neue',Inter,sans-serif;font-size:96px;letter-spacing:.08em;line-height:1;opacity:.95}
</style></head><body><div class="c"><div class="i">${icono}</div><div class="n">${esc(nombre)}</div></div></body></html>`;
}

export const PORTADAS = [
  { key: "clientes", nombre: "Clientes", icono: "⭐" },
  { key: "como-funciona", nombre: "Cómo funciona", icono: "📦" },
  { key: "cotiza", nombre: "Cotizá", icono: "🧮" },
];

export const SCHEMA_RESENA = {
  type: "object",
  additionalProperties: false,
  properties: {
    nombre: { type: "string", description: "Nombre del autor tal como aparece" },
    estrellas: { type: "integer", minimum: 1, maximum: 5 },
    fecha: { type: "string", description: "Texto de la fecha tal como aparece (ej. 'Hace un mes'), vacío si no se ve" },
    texto: { type: "string", description: "Texto completo de la reseña, sin recortar ni corregir" },
    es_resena: { type: "boolean", description: "false si la imagen no es una reseña" },
  },
  required: ["nombre", "estrellas", "fecha", "texto", "es_resena"],
};
