// lib/historias.js — Historias destacadas de Instagram (18/10/2026).
//
// Bautista no quiere editar imágenes: pega la captura de la reseña de Google tal cual (con la foto
// real del cliente, su nombre y las estrellas como las muestra Google), Claude marca dónde está la
// reseña dentro de la captura, y acá se arma la historia 1080×1920: la captura recortada va "pegada"
// con cinta sobre un fondo creativo de la marca (cielo + ruta de vuelo + avión + caja), sin textos
// de relleno. Referencia que gustó: Shippar (reseña real sobre un corcho) — misma idea, otra estética.
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
export function htmlHistoriaCaptura({ captura, ancho, alto, bbox }) {
  const b = normBbox(bbox);
  const fw = (b.x1 - b.x0) / 100, fh = (b.y1 - b.y0) / 100;           // fracción recortada
  const aspect = (ancho * fw) / (alto * fh);                            // ancho/alto del recorte
  // La tarjeta entra en 860×1180 (zonas seguras de 250 px arriba y abajo ya descontadas).
  let cw = 860, ch = cw / aspect;
  if (ch > 1180) { ch = 1180; cw = ch * aspect; }
  cw = Math.round(cw); ch = Math.round(ch);
  const imgW = cw / fw, imgH = ch / fh;                                 // tamaño de la captura completa
  const offX = -(b.x0 / 100) * imgW, offY = -(b.y0 / 100) * imgH;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1080px;height:1920px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#0A1628}
  body{background:linear-gradient(180deg,#0A3D91 0%,#1E8BFF 46%,#9CD0FF 78%,#EAF5FF 100%)}
  /* Nubes */
  .cl{position:absolute;background:#fff;border-radius:999px;opacity:.92;filter:drop-shadow(0 12px 24px rgba(10,61,145,.18))}
  .cl:before,.cl:after{content:"";position:absolute;background:#fff;border-radius:50%}
  .c1{width:300px;height:96px;left:-60px;top:560px}.c1:before{width:120px;height:120px;left:50px;top:-60px}.c1:after{width:160px;height:160px;left:130px;top:-90px}
  .c2{width:260px;height:84px;right:-40px;top:300px;opacity:.85}.c2:before{width:100px;height:100px;left:40px;top:-50px}.c2:after{width:140px;height:140px;left:110px;top:-78px}
  .c3{width:380px;height:110px;left:120px;bottom:120px;opacity:.95}.c3:before{width:150px;height:150px;left:60px;top:-76px}.c3:after{width:200px;height:200px;left:170px;top:-110px}
  .c4{width:220px;height:70px;right:60px;bottom:330px;opacity:.9}.c4:before{width:90px;height:90px;left:30px;top:-44px}.c4:after{width:120px;height:120px;left:90px;top:-66px}
  /* Ruta punteada avión → caja */
  .ruta{position:absolute;left:0;top:0;width:1080px;height:1920px}
  .sticker{position:absolute;background:#fff;border-radius:28px;padding:18px 22px;box-shadow:0 14px 34px rgba(10,61,145,.25);font-size:92px;line-height:1;transform:rotate(-12deg)}
  .avion{left:70px;top:190px}
  .caja{right:60px;bottom:230px;transform:rotate(9deg);font-size:84px}
  /* Cabecera y pie */
  .logo{position:absolute;left:50%;top:84px;transform:translateX(-50%);height:66px;width:auto;filter:brightness(0) invert(1);opacity:.98}
  .pie{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);background:#fff;color:#0A3D91;font-weight:800;font-size:31px;padding:20px 50px;border-radius:999px;box-shadow:0 14px 40px rgba(10,61,145,.25);letter-spacing:.01em;white-space:nowrap}
  /* La captura, pegada con cinta */
  .card{position:absolute;left:50%;top:50%;width:${cw}px;height:${ch}px;transform:translate(-50%,-50%) rotate(-1.6deg);background:#fff;border-radius:26px;overflow:hidden;box-shadow:0 40px 90px rgba(5,30,80,.42),0 0 0 10px #fff}
  .card img{position:absolute;left:${offX.toFixed(1)}px;top:${offY.toFixed(1)}px;width:${imgW.toFixed(1)}px;height:${imgH.toFixed(1)}px;max-width:none}
  .tape{position:absolute;width:230px;height:62px;background:rgba(30,139,255,.55);border:1px solid rgba(255,255,255,.55);box-shadow:0 6px 16px rgba(5,30,80,.25);backdrop-filter:blur(1px)}
  .t1{left:calc(50% - ${Math.round(cw / 2) + 70}px);top:calc(50% - ${Math.round(ch / 2) + 26}px);transform:rotate(-38deg)}
  .t2{left:calc(50% + ${Math.round(cw / 2) - 160}px);top:calc(50% + ${Math.round(ch / 2) - 44}px);transform:rotate(-34deg)}
</style></head><body>
<svg class="ruta" viewBox="0 0 1080 1920" fill="none"><path d="M190 300 C 420 180, 760 220, 900 420 S 980 760, 760 900 S 230 1100, 300 1400 S 760 1620, 960 1640" stroke="#fff" stroke-width="6" stroke-dasharray="4 26" stroke-linecap="round" opacity=".85"/></svg>
<div class="cl c1"></div><div class="cl c2"></div><div class="cl c3"></div><div class="cl c4"></div>
<div class="sticker avion">✈️</div>
<div class="sticker caja">📦</div>
<img class="logo" src="${BASE}/brand/logo-horizontal.png" alt="">
<div class="card"><img src="${captura}" alt=""></div>
<div class="tape t1"></div><div class="tape t2"></div>
<div class="pie">argencargo.com.ar</div>
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
