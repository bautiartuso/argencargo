// lib/gemini-image.js — fotos realistas para los posts.
// Proveedores: OpenAI (gpt-image-1, el mismo motor de imágenes de ChatGPT) si hay OPENAI_API_KEY;
// si no, Gemini Image ("Nano Banana") con GEMINI_API_KEY. Sin ninguna clave devuelve null y las
// piezas salen solo con tipografía y color.

const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const PROVIDER = process.env.IMAGE_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : process.env.GEMINI_API_KEY ? "gemini" : "");

export function geminiConfigured() {
  return !!PROVIDER;
}
export function imageProvider() { return PROVIDER; }

const SUFIJO = "Fotografía realista de campaña publicitaria, iluminación natural, colores sobrios con acentos azules, sin texto ni letras ni logos en la imagen, sin marcas de agua.";

async function openaiPhoto(prompt, aspect) {
  const size = "1024x1536"; // vertical: sirve para 4:5 y 9:16 (se recorta con object-fit cover)
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, prompt: `${prompt}\n\n${SUFIJO}`, size, quality: process.env.OPENAI_IMAGE_QUALITY || "medium", n: 1, output_format: "jpeg" }),
    signal: AbortSignal.timeout(90000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) { console.error("[openai-image]", r.status, JSON.stringify(j).slice(0, 300)); return null; }
  const b64 = j?.data?.[0]?.b64_json;
  return b64 ? { buffer: Buffer.from(b64, "base64"), mime: "image/jpeg" } : null;
}

async function geminiPhoto(prompt, aspect) {
  const body = {
    contents: [{ parts: [{ text: `${prompt}\n\nFormato vertical ${aspect}. ${SUFIJO}` }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) { console.error("[gemini-image]", r.status, JSON.stringify(j).slice(0, 300)); return null; }
  const img = (j?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
  return img ? { buffer: Buffer.from(img.inlineData.data, "base64"), mime: img.inlineData.mimeType || "image/png" } : null;
}

// prompt → { buffer, mime } o null.
export async function generatePhoto(prompt, { aspect = "4:5" } = {}) {
  if (!prompt) return null;
  try {
    if (PROVIDER === "openai") return (await openaiPhoto(prompt, aspect)) || (process.env.GEMINI_API_KEY ? geminiPhoto(prompt, aspect) : null);
    if (PROVIDER === "gemini") return geminiPhoto(prompt, aspect);
  } catch (e) { console.error("[image]", e.message); }
  return null;
}
