// Compresión de imágenes del lado del cliente, con el canvas del navegador — sin librerías.
//
// Las fotos del agente se subían tal cual salían del celular: 4.032×3.024 y 2 MB de promedio,
// con picos de 4,7 MB. Para verificar un bulto no hace falta nada de eso. A 1600px de lado mayor
// y calidad 85 la misma foto pasa de 4.760 kB a 659 kB y se sigue leyendo la etiqueta china,
// la tabla de talles y los códigos.

export const MAX_LADO = 1600;
export const CALIDAD = 0.85;

// Devuelve un File comprimido. Si algo falla (formato raro, HEIC que el navegador no decodifica),
// devuelve el original: mejor subir pesado que perder la foto.
export async function comprimirImagen(file, { maxLado = MAX_LADO, calidad = CALIDAD } = {}) {
  if (!file || !file.type?.startsWith("image/")) return file;
  try {
    const bitmap = await cargarBitmap(file);
    const { width: w, height: h } = bitmap;
    const f = Math.min(1, maxLado / Math.max(w, h));
    // Ya es chica y liviana: no la recomprimimos, solo le agregaríamos artefactos.
    if (f === 1 && file.size <= 700 * 1024) { bitmap.close?.(); return file; }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * f);
    canvas.height = Math.round(h * f);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", calidad));
    if (!blob || blob.size >= file.size) return file; // no mejoró: dejamos el original
    const nombre = (file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function cargarBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file); } catch {}
  }
  // Respaldo para navegadores viejos
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const pesoLegible = (b) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} kB`;
