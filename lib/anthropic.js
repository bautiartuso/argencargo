// lib/anthropic.js
// Helper compartido para llamar a Claude API (texto + visión).
// Usado por /api/ncm, /api/parse-invoice-pdf, /api/ocr-tracking, /api/compress-items.

import Anthropic from "@anthropic-ai/sdk";

let _client = null;
function getClient() {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

const MODEL = "claude-opus-4-7";

/**
 * Llamada de texto. Devuelve string del primer text block.
 * @param {object} opts
 * @param {string} opts.system - System prompt
 * @param {string|Array} opts.user - User message (string o array de content blocks)
 * @param {number} opts.max_tokens - Default 4096
 * @param {object} [opts.json_schema] - Si se pasa, fuerza JSON schema
 */
export async function callClaudeText({ system, user, max_tokens = 4096, json_schema = null }) {
  const client = getClient();
  const params = {
    model: MODEL,
    max_tokens,
    system,
    messages: [{ role: "user", content: typeof user === "string" ? user : user }],
  };
  if (json_schema) {
    params.output_config = { format: { type: "json_schema", schema: json_schema } };
  }
  const response = await client.messages.create(params);
  const textBlock = response.content.find(b => b.type === "text");
  return textBlock?.text || "";
}

/**
 * Llamada con visión. Acepta array de imágenes base64.
 * @param {object} opts
 * @param {string} opts.system
 * @param {string} opts.prompt - texto que acompaña a las imágenes
 * @param {Array<string>} opts.images - array de base64 (con o sin data URL)
 * @param {number} opts.max_tokens
 * @param {object} [opts.json_schema]
 * @param {string} [opts.media_type] - 'image/png' (default) o 'image/jpeg'
 */
export async function callClaudeVision({ system, prompt, images, max_tokens = 4096, json_schema = null, media_type = "image/png" }) {
  const client = getClient();
  const content = [
    { type: "text", text: prompt },
    ...images.map(img => {
      // Strip data URL prefix si vino así
      const data = img.startsWith("data:") ? img.replace(/^data:[^;]+;base64,/, "") : img;
      // Detectar media_type real desde el data URL si está
      let mt = media_type;
      if (img.startsWith("data:")) {
        const m = img.match(/^data:([^;]+);/);
        if (m) mt = m[1];
      }
      return { type: "image", source: { type: "base64", media_type: mt, data } };
    }),
  ];
  const params = {
    model: MODEL,
    max_tokens,
    system,
    messages: [{ role: "user", content }],
  };
  if (json_schema) {
    params.output_config = { format: { type: "json_schema", schema: json_schema } };
  }
  const response = await client.messages.create(params);
  const textBlock = response.content.find(b => b.type === "text");
  return textBlock?.text || "";
}

export { MODEL as CLAUDE_MODEL };
