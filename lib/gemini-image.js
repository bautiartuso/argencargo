// lib/gemini-image.js — fotos realistas para los posts (Gemini Image, "Nano Banana").
// Sin GEMINI_API_KEY devuelve null: las piezas salen solo con tipografía y color.

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

export function geminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

// prompt → Buffer PNG/JPEG + mime. null si no hay clave o si el modelo no devolvió imagen.
export async function generatePhoto(prompt, { aspect = "4:5" } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !prompt) return null;
  const body = {
    contents: [{ parts: [{ text: `${prompt}\n\nFormato vertical ${aspect}. Fotografía realista, iluminación natural, sin texto ni letras en la imagen, sin marcas de agua.` }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(50000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) { console.error("[gemini-image]", r.status, JSON.stringify(j).slice(0, 300)); return null; }
  const parts = j?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) return null;
  return { buffer: Buffer.from(img.inlineData.data, "base64"), mime: img.inlineData.mimeType || "image/png" };
}
