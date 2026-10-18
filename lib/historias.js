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

// Historia 1080×1920 con la captura. { captura: URL, ancho, alto (px de la captura), bbox, variante }.
// Cinco diseños distintos (18/10/2026) para que Bautista elija uno; la captura real de Google
// (foto, nombre, estrellas y texto tal cual) siempre va en grande y sin textos de relleno:
//   A "editorial": blanco, la reseña integrada sin tarjeta, comilla gigante en degradé, pie en degradé.
//   B "telefono":  fondo degradé azul, la reseña dentro de un teléfono (así se ve en Google).
//   C "corte":     mitad de arriba en degradé con corte diagonal, tarjeta a caballo, G de Google.
//   D "burbuja":   celeste claro, la reseña como globo de diálogo con cola, pie en cápsula.
//   E "aurora":    negro azulado con manchas de luz difusas, tarjeta de vidrio con resplandor.
export const VARIANTES = ["A", "B", "C", "D", "E"];

function recorte({ ancho, alto, bbox, maxW, maxH }) {
  const b = normBbox(bbox);
  const fw = (b.x1 - b.x0) / 100, fh = (b.y1 - b.y0) / 100;
  const aspect = (ancho * fw) / (alto * fh);
  let cw = maxW, ch = cw / aspect;
  if (ch > maxH) { ch = maxH; cw = ch * aspect; }
  cw = Math.round(cw); ch = Math.round(ch);
  const imgW = cw / fw, imgH = ch / fh;
  const offX = -(b.x0 / 100) * imgW, offY = -(b.y0 / 100) * imgH;
  const img = (src) => `<img src="${src}" alt="" style="position:absolute;left:${offX.toFixed(1)}px;top:${offY.toFixed(1)}px;width:${imgW.toFixed(1)}px;height:${imgH.toFixed(1)}px;max-width:none">`;
  return { cw, ch, img };
}

const GOOGLE_G = `<svg viewBox="0 0 48 48" width="64" height="64"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

const HEAD = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}html,body{width:1080px;height:1920px;overflow:hidden;font-family:Inter,system-ui,sans-serif}`;
const LOGO_B = `<img src="${BASE}/brand/logo-horizontal.png" alt="" style="position:absolute;left:50%;top:96px;transform:translateX(-50%);height:70px;width:auto;filter:brightness(0) invert(1)">`;
const LOGO_A = `<img src="${BASE}/brand/logo-horizontal.png" alt="" style="position:absolute;left:50%;top:96px;transform:translateX(-50%);height:70px;width:auto">`;

export function htmlHistoriaCaptura({ captura, ancho, alto, bbox, variante = "A" }) {
  const v = VARIANTES.includes(variante) ? variante : "A";

  if (v === "A") {
    const r = recorte({ ancho, alto, bbox, maxW: 880, maxH: 1080 });
    return `${HEAD}
      body{background:#fff}
      .q{position:absolute;left:96px;top:250px;font-size:520px;line-height:.6;font-weight:800;background:linear-gradient(135deg,#0A3D91,#1E8BFF);-webkit-background-clip:text;background-clip:text;color:transparent;opacity:.9}
      .bar{position:absolute;left:96px;top:50%;transform:translateY(-50%);width:12px;height:${r.ch}px;border-radius:999px;background:linear-gradient(180deg,#0A3D91,#1E8BFF)}
      .res{position:absolute;left:150px;top:50%;transform:translateY(-50%);width:${r.cw}px;height:${r.ch}px;overflow:hidden;background:#fff}
      .pie{position:absolute;left:0;right:0;bottom:0;height:210px;background:linear-gradient(90deg,#0A3D91,#1E8BFF);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:34px;letter-spacing:.02em}
      .pie:before{content:"";position:absolute;left:0;right:0;top:-70px;height:70px;background:linear-gradient(180deg,rgba(255,255,255,0),#fff);}
    </style></head><body>${LOGO_A}<div class="q">&ldquo;</div><div class="bar"></div><div class="res">${r.img(captura)}</div><div class="pie">argencargo.com.ar</div></body></html>`;
  }

  if (v === "B") {
    const SW = 700;
    const r = recorte({ ancho, alto, bbox, maxW: SW, maxH: 1380 });
    return `${HEAD}
      body{background:linear-gradient(160deg,#0A3D91 0%,#1E8BFF 100%)}
      .luz{position:absolute;left:-200px;top:-200px;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.22),rgba(255,255,255,0) 70%)}
      .tel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${SW + 60}px;height:1540px;border-radius:120px;background:#0b1220;box-shadow:0 60px 140px rgba(0,0,0,.5),inset 0 0 0 6px #2a3650,0 0 0 2px rgba(255,255,255,.25)}
      .pant{position:absolute;left:30px;top:30px;width:${SW}px;height:1480px;border-radius:92px;background:#fff;overflow:hidden}
      .notch{position:absolute;left:50%;top:22px;transform:translateX(-50%);width:200px;height:52px;border-radius:999px;background:#0b1220;z-index:2}
      .res{position:absolute;left:0;top:${Math.max(110, Math.round((1480 - r.ch) / 2))}px;width:${r.cw}px;height:${r.ch}px;overflow:hidden}
      .url{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);color:#fff;font-weight:800;font-size:32px;letter-spacing:.02em;white-space:nowrap;text-shadow:0 4px 20px rgba(0,0,0,.3)}
    </style></head><body><div class="luz"></div>${LOGO_B}<div class="tel"><div class="pant"><div class="notch"></div><div class="res">${r.img(captura)}</div></div></div><div class="url">argencargo.com.ar</div></body></html>`;
  }

  if (v === "C") {
    const r = recorte({ ancho, alto, bbox, maxW: 880, maxH: 1150 });
    return `${HEAD}
      body{background:#fff}
      .top{position:absolute;left:0;top:0;width:1080px;height:1160px;background:linear-gradient(135deg,#0A3D91 0%,#1E8BFF 100%);clip-path:polygon(0 0,100% 0,100% 78%,0 100%)}
      .trama{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.16) 1.6px,transparent 1.7px);background-size:34px 34px;clip-path:polygon(0 0,100% 0,100% 78%,0 100%);height:1160px}
      .card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${r.cw}px;height:${r.ch}px;border-radius:32px;overflow:hidden;background:#fff;box-shadow:0 50px 110px rgba(10,61,145,.35),0 0 0 1px rgba(10,61,145,.08)}
      .g{position:absolute;left:calc(50% + ${Math.round(r.cw / 2) - 70}px);top:calc(50% - ${Math.round(r.ch / 2) + 62}px);width:124px;height:124px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 16px 40px rgba(10,61,145,.3)}
      .url{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);color:#0A3D91;font-weight:800;font-size:32px;letter-spacing:.02em;white-space:nowrap;padding:18px 44px;border-radius:999px;border:3px solid #0A3D91}
    </style></head><body><div class="top"></div><div class="trama"></div>${LOGO_B}<div class="card">${r.img(captura)}</div><div class="g">${GOOGLE_G}</div><div class="url">argencargo.com.ar</div></body></html>`;
  }

  if (v === "D") {
    const r = recorte({ ancho, alto, bbox, maxW: 860, maxH: 1080 });
    return `${HEAD}
      body{background:#EAF4FF}
      .an{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;border:2px solid rgba(30,139,255,.18)}
      .a1{width:1300px;height:1300px}.a2{width:1700px;height:1700px}.a3{width:2100px;height:2100px;border-color:rgba(30,139,255,.1)}
      .glo{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${r.cw + 56}px;height:${r.ch + 56}px;border-radius:52px;background:#fff;box-shadow:0 40px 100px rgba(10,61,145,.18)}
      .glo:after{content:"";position:absolute;left:90px;bottom:-34px;width:70px;height:70px;background:#fff;transform:skewX(32deg) rotate(10deg);border-radius:0 0 14px 0}
      .res{position:absolute;left:28px;top:28px;width:${r.cw}px;height:${r.ch}px;border-radius:30px;overflow:hidden}
      .pie{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);background:linear-gradient(135deg,#0A3D91,#1E8BFF);color:#fff;font-weight:800;font-size:32px;padding:20px 50px;border-radius:999px;box-shadow:0 14px 40px rgba(30,139,255,.35);white-space:nowrap}
    </style></head><body><div class="an a3"></div><div class="an a2"></div><div class="an a1"></div>${LOGO_A}<div class="glo"><div class="res">${r.img(captura)}</div></div><div class="pie">argencargo.com.ar</div></body></html>`;
  }

  // E
  const r = recorte({ ancho, alto, bbox, maxW: 880, maxH: 1150 });
  return `${HEAD}
    body{background:#050a16}
    .m{position:absolute;border-radius:50%;filter:blur(110px);opacity:.85}
    .m1{width:820px;height:820px;left:-220px;top:120px;background:#0A3D91}
    .m2{width:760px;height:760px;right:-240px;top:520px;background:#1E8BFF;opacity:.7}
    .m3{width:700px;height:700px;left:120px;bottom:-200px;background:#3ab0ff;opacity:.45}
    .card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${r.cw}px;height:${r.ch}px;border-radius:34px;overflow:hidden;background:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.35),0 0 0 14px rgba(255,255,255,.07),0 60px 140px rgba(0,0,0,.65)}
    .url{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);color:#fff;font-weight:800;font-size:32px;letter-spacing:.02em;white-space:nowrap;opacity:.95}
  </style></head><body><div class="m m1"></div><div class="m m2"></div><div class="m m3"></div>${LOGO_B}<div class="card">${r.img(captura)}</div><div class="url">argencargo.com.ar</div></body></html>`;
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
