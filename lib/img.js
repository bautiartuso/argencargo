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
// `cuadrado`: lado en px de un lienzo cuadrado blanco donde la foto entra completa (sin recorte).
// Lo usa el catálogo de ARGENMAQ para que todas las fotos de producto salgan del mismo tamaño
// (1080×1080) aunque se carguen de cualquier celular o del sitio del proveedor (21/09/2026).
export async function comprimirImagen(file, { maxLado = MAX_LADO, calidad = CALIDAD, cuadrado = 0 } = {}) {
  if (!file || !file.type?.startsWith("image/")) return file;
  try {
    const bitmap = await cargarBitmap(file);
    const { width: w, height: h } = bitmap;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (cuadrado > 0) {
      // Lienzo cuadrado blanco, la foto centrada y completa: mismo encuadre para todo el catálogo.
      canvas.width = cuadrado; canvas.height = cuadrado;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cuadrado, cuadrado);
      const k = Math.min(cuadrado / w, cuadrado / h);
      const dw = Math.round(w * k), dh = Math.round(h * k);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, Math.round((cuadrado - dw) / 2), Math.round((cuadrado - dh) / 2), dw, dh);
      bitmap.close?.();
      const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", calidad));
      if (!blob) return file;
      const nombre = (file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg";
      return new File([blob], nombre, { type: "image/jpeg", lastModified: Date.now() });
    }
    const f = Math.min(1, maxLado / Math.max(w, h));
    // Ya es chica y liviana: no la recomprimimos, solo le agregaríamos artefactos.
    if (f === 1 && file.size <= 700 * 1024) { bitmap.close?.(); return file; }

    canvas.width = Math.round(w * f);
    canvas.height = Math.round(h * f);
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
