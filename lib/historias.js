// lib/historias.js — Historias destacadas de Instagram (18/10/2026).
//
// Bautista no quiere editar imágenes: pega la captura de la reseña de Google tal cual (con la foto
// real del cliente, su nombre, las estrellas y la fila del corazón / Responder), Claude marca dónde
// está la reseña dentro de la captura, y acá se arma la historia 1080×1920 poniéndola en el hueco
// de la plantilla que diseñó él, con el logo arriba y argencargo.com.ar abajo (eso va por código).
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

// Historia 1080×1920 con la captura. { captura: URL, ancho, alto (px de la captura), bbox }.
//
// Plantilla definitiva (18/10/2026): la diseñó Bautista con GPT (mapa, contenedores, avión, cajas)
// y tiene un rectángulo blanco donde va la reseña. Está guardada en
// content-studio/historias-fondos/plantilla.png (1080×1920). La captura recortada se escala para
// entrar en ese rectángulo con un margen y se centra; como el rectángulo es blanco y la captura de
// Google también, queda integrada. Para cambiar la plantilla: subir otra imagen a la misma ruta y,
// si el hueco cambió, ajustar HUECO (en px de la imagen de 1080×1920).
export const PLANTILLA = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/content-studio/historias-fondos/plantilla.png";
export const HUECO = { x: 154, y: 392, w: 771, h: 1161 };
const MARGEN = 34;

export function htmlHistoriaCaptura({ captura, ancho, alto, bbox }) {
  const b = normBbox(bbox);
  const fw = (b.x1 - b.x0) / 100, fh = (b.y1 - b.y0) / 100;
  const aspect = (ancho * fw) / (alto * fh);
  const maxW = HUECO.w - MARGEN * 2, maxH = HUECO.h - MARGEN * 2;
  let cw = maxW, ch = cw / aspect;
  if (ch > maxH) { ch = maxH; cw = ch * aspect; }
  cw = Math.round(cw); ch = Math.round(ch);
  const imgW = cw / fw, imgH = ch / fh;
  const offX = -(b.x0 / 100) * imgW, offY = -(b.y0 / 100) * imgH;
  const left = Math.round(HUECO.x + (HUECO.w - cw) / 2), top = Math.round(HUECO.y + (HUECO.h - ch) / 2);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:1080px;height:1920px;overflow:hidden;background:#fff}
    .fondo{position:absolute;left:0;top:0;width:1080px;height:1920px}
    .res{position:absolute;left:${left}px;top:${top}px;width:${cw}px;height:${ch}px;overflow:hidden;background:#fff}
    .res img{position:absolute;left:${offX.toFixed(1)}px;top:${offY.toFixed(1)}px;width:${imgW.toFixed(1)}px;height:${imgH.toFixed(1)}px;max-width:none}
    .logo{position:absolute;left:50%;top:70px;transform:translateX(-50%);height:230px;width:auto;filter:drop-shadow(0 0 14px rgba(255,255,255,.95)) drop-shadow(0 0 30px rgba(255,255,255,.8)) drop-shadow(0 10px 24px rgba(0,0,0,.18))}
    .pie{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);background:#fff;color:#0A3D91;font-family:Inter,system-ui,sans-serif;font-weight:800;font-size:32px;letter-spacing:.02em;padding:20px 52px;border-radius:999px;box-shadow:0 14px 40px rgba(0,0,0,.35);white-space:nowrap}
  </style><link href="https://fonts.googleapis.com/css2?family=Inter:wght@800&display=swap" rel="stylesheet"></head><body><img class="fondo" src="${PLANTILLA}" alt=""><img class="logo" src="${BASE}/brand/logo-horizontal.png" alt=""><div class="res"><img src="${captura}" alt=""></div><div class="pie">argencargo.com.ar</div></body></html>`;
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
