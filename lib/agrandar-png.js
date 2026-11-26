// Agranda una captura PNG chica antes de pasarla por visión (26/11/2026). Las planillas que manda el agente
// llegan de ~650 px de ancho con números de 8 px de alto: la IA confundía un 5 con un 6 (FL-0188, 12,5 leído
// 12,6). Interpolación bilineal, solo PNG y solo si es chica; cualquier problema devuelve la imagen original.
import { PNG } from "pngjs";

export function agrandarPng(buf, { hastaAncho = 1900, maxFactor = 3 } = {}) {
  try {
    if (!buf || buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return buf;
    const src = PNG.sync.read(buf);
    const f = Math.min(maxFactor, Math.floor(hastaAncho / src.width));
    if (!(f >= 2) || src.width * src.height * f * f > 12e6) return buf;
    const W = src.width * f, H = src.height * f, out = new PNG({ width: W, height: H });
    for (let y = 0; y < H; y++) {
      const sy = Math.min(src.height - 1, Math.max(0, (y + 0.5) / f - 0.5)), y0 = Math.floor(sy), y1 = Math.min(src.height - 1, y0 + 1), fy = sy - y0;
      for (let x = 0; x < W; x++) {
        const sx = Math.min(src.width - 1, Math.max(0, (x + 0.5) / f - 0.5)), x0 = Math.floor(sx), x1 = Math.min(src.width - 1, x0 + 1), fx = sx - x0;
        const a = (y0 * src.width + x0) * 4, b = (y0 * src.width + x1) * 4, c = (y1 * src.width + x0) * 4, d = (y1 * src.width + x1) * 4, o = (y * W + x) * 4;
        for (let k = 0; k < 4; k++) out.data[o + k] = Math.round((src.data[a + k] * (1 - fx) + src.data[b + k] * fx) * (1 - fy) + (src.data[c + k] * (1 - fx) + src.data[d + k] * fx) * fy);
      }
    }
    return PNG.sync.write(out);
  } catch { return buf; }
}
