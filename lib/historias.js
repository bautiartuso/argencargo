// lib/historias.js — Historias destacadas de Instagram (18/10/2026).
//
// Bautista no quiere editar imágenes: pega la captura de la reseña de Google tal cual (con la foto
// real del cliente, su nombre y las estrellas como las muestra Google), Claude marca dónde está la
// reseña dentro de la captura, y acá se arma la historia 1080×1920 con la captura en grande sobre
// un fondo propio de la marca, sin textos de relleno. Lo que gustó de Shippar es que se vea la
// reseña real; el diseño tiene que ser original (la v2 con cielo/cinta/avión era una copia).
// Brand kit en docs/marca/03-brand-kit.md: blanco + degradé #0A3D91→#1E8BFF, Bebas Neue + Inter.
// Después la foto va a Telegram y él la sube a Instagram y al destacado "Clientes" desde el celular.

const BASE = "https://argencargo.com.ar";
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Recorte: x0,y0,x1,y1 en % de la captura (0-100). Sin recorte = la captura entera.
export function normBbox(b) {
  if (!b) return { x0: 0, y0: 0, x1: 100, y1: 100 };
  const n = (v, d) => { const x = Number(v); return Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : d; };
  let x0 = n(b.x0, 0), y0 = n(b.y0, 0), x1 = n(b.x1, 100), y1 = n(b.y1, 100);
  if (x1 - x0 < 20) { x0 = 0; x1 = 100; }
  if (y1 - y0 < 10) { y0 = 0; y1 = 100; }
  return { x0, y0, x1, y1 };
}

// Historia 1080×1920 con la captura. { captura: URL o data URL, ancho, alto (px de la captura), bbox }.
// Diseño propio (v3, 18/10/2026): navy de la marca con las tres barras inclinadas del isotipo en el
// degradé azul cruzando el fondo, trama de puntos, y la captura derecha (sin rotar) con borde en
// degradé y resplandor. Logo blanco arriba, argencargo.com.ar abajo. Sin cielo, nubes, cinta,
// stickers ni rotación (eso era Shippar). Sirve para aéreo y marítimo por igual.
export function htmlHistoriaCaptura({ captura, ancho, alto, bbox }) {
  const b = normBbox(bbox);
  const fw = (b.x1 - b.x0) / 100, fh = (b.y1 - b.y0) / 100;           // fracción recortada
  const aspect = (ancho * fw) / (alto * fh);                            // ancho/alto del recorte
  // La tarjeta entra en 880×1200 (zonas seguras de 250 px arriba y abajo ya descontadas).
  let cw = 880, ch = cw / aspect;
  if (ch > 1200) { ch = 1200; cw = ch * aspect; }
  cw = Math.round(cw); ch = Math.round(ch);
  const imgW = cw / fw, imgH = ch / fh;                                 // tamaño de la captura completa
  const offX = -(b.x0 / 100) * imgW, offY = -(b.y0 / 100) * imgH;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1920px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#fff;background:#0A1628}
  .fondo{position:absolute;inset:0;background:radial-gradient(900px 700px at 50% 42%,#102a5c 0%,#0A1628 70%)}
  .puntos{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.13) 1.6px,transparent 1.7px);background-size:36px 36px;opacity:.55}
  /* Las tres barras del isotipo, gigantes, cruzando en diagonal */
  .barra{position:absolute;width:300px;height:2600px;left:50%;top:50%;transform-origin:center;background:linear-gradient(180deg,#0A3D91 0%,#1E8BFF 100%);opacity:.22;border-radius:40px}
  .b1{transform:translate(-50%,-50%) rotate(28deg) translateX(-540px)}
  .b2{transform:translate(-50%,-50%) rotate(28deg) translateX(-90px);opacity:.16}
  .b3{transform:translate(-50%,-50%) rotate(28deg) translateX(360px);opacity:.11}
  .logo{position:absolute;left:50%;top:96px;transform:translateX(-50%);height:70px;width:auto;filter:brightness(0) invert(1)}
  .marco{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:6px;border-radius:34px;background:linear-gradient(135deg,#1E8BFF,#0A3D91 55%,#1E8BFF);box-shadow:0 0 0 1px rgba(255,255,255,.08),0 50px 120px rgba(0,0,0,.6),0 0 140px rgba(30,139,255,.28)}
  .card{width:${cw}px;height:${ch}px;border-radius:28px;overflow:hidden;background:#fff;position:relative}
  .card img{position:absolute;left:${offX.toFixed(1)}px;top:${offY.toFixed(1)}px;width:${imgW.toFixed(1)}px;height:${imgH.toFixed(1)}px;max-width:none}
  .pie{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:16px}
  .linea{width:120px;height:5px;border-radius:999px;background:linear-gradient(90deg,#0A3D91,#1E8BFF)}
  .url{font-size:31px;font-weight:800;letter-spacing:.02em;color:#fff;opacity:.95;white-space:nowrap}
</style></head><body>
<div class="fondo"></div><div class="puntos"></div>
<div class="barra b1"></div><div class="barra b2"></div><div class="barra b3"></div>
<img class="logo" src="${BASE}/brand/logo-horizontal.png" alt="">
<div class="marco"><div class="card"><img src="${captura}" alt=""></div></div>
<div class="pie"><div class="linea"></div><div class="url">argencargo.com.ar</div></div>
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

// Lo que Claude devuelve mirando la captura: dónde está la reseña (para recortar lo que sobra:
// barra de estado del teléfono, buscador de Google, botones de "Me gusta"/"Compartir"), y el nombre.
export const SCHEMA_RECORTE = {
  type: "object",
  additionalProperties: false,
  properties: {
    es_resena: { type: "boolean", description: "false si la imagen no contiene una reseña" },
    nombre: { type: "string", description: "Nombre del autor de la reseña, vacío si no se ve" },
    x0: { type: "number", description: "Borde izquierdo del bloque de la reseña, en % del ancho (0-100)" },
    y0: { type: "number", description: "Borde superior (desde la foto/nombre del autor), en % del alto (0-100)" },
    x1: { type: "number", description: "Borde derecho, en % del ancho (0-100)" },
    y1: { type: "number", description: "Borde inferior (fin del texto de la reseña), en % del alto (0-100)" },
  },
  required: ["es_resena", "nombre", "x0", "y0", "x1", "y1"],
};
