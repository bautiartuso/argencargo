// lib/anthropic.js
// Helper compartido para llamar a Claude API (texto + visión).
// Con FALLBACK automático a OpenAI si Claude devuelve "credit balance" / billing error.
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

// Decidir si conviene fallback a OpenAI (problemas de cuenta Anthropic, no de prompt)
function shouldFallback(error) {
  const msg = String(error?.message || "").toLowerCase();
  if (msg.includes("credit balance")) return true;
  if (msg.includes("billing")) return true;
  if (msg.includes("api key not configured") && process.env.OPENAI_API_KEY) return true;
  if (error?.status === 402) return true;
  return false;
}

// ---------- OpenAI fallback ----------
async function callOpenAIText({ system, user, max_tokens = 4096 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured (and Claude unavailable)");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: typeof user === "string" ? user : user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callOpenAIVision({ system, prompt, images, max_tokens = 4096 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured (and Claude unavailable)");
  const content = [
    { type: "text", text: prompt },
    ...images.map(img => ({
      type: "image_url",
      image_url: { url: img.startsWith("data:") ? img : `data:image/png;base64,${img}` },
    })),
  ];
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ---------- Claude (con fallback automático) ----------
export async function callClaudeText({ system, user, max_tokens = 4096, json_schema = null }) {
  try {
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
  } catch (e) {
    if (shouldFallback(e)) {
      console.warn("[lib/anthropic] Claude unavailable → fallback OpenAI:", e.message?.slice(0, 80));
      return await callOpenAIText({ system, user, max_tokens });
    }
    throw e;
  }
}

export async function callClaudeVision({ system, prompt, images, max_tokens = 4096, json_schema = null, media_type = "image/png" }) {
  try {
    const client = getClient();
    const content = [
      { type: "text", text: prompt },
      ...images.map(img => {
        const data = img.startsWith("data:") ? img.replace(/^data:[^;]+;base64,/, "") : img;
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
  } catch (e) {
    if (shouldFallback(e)) {
      console.warn("[lib/anthropic] Claude vision unavailable → fallback OpenAI:", e.message?.slice(0, 80));
      return await callOpenAIVision({ system, prompt, images, max_tokens });
    }
    throw e;
  }
}

export { MODEL as CLAUDE_MODEL };
