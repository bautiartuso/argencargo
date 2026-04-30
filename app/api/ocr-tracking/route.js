// POST /api/ocr-tracking
// Body: { image_base64 }   (data URL o raw base64 de jpeg/png)
// Devuelve: { ok, tracking, raw } — código de tracking detectado y texto crudo.
// Usa Claude Vision (claude-opus-4-7) para extraer el código.

import { callClaudeVision } from "../../../lib/anthropic";

export const maxDuration = 30;

const SYSTEM = "Sos un asistente que extrae códigos de tracking de etiquetas de courier (DHL, FedEx, UPS, China Post, EMS, Yunda, SF Express, etc.). Respondé SOLO el código, sin explicación. Si hay varios códigos, devolvé el principal (el más prominente). Si no encontrás ninguno, respondé exactamente 'NONE'.";

export async function POST(req) {
  try {
    const { image_base64 } = await req.json();
    if (!image_base64) return Response.json({ ok: false, error: "missing image" }, { status: 400 });

    const text = await callClaudeVision({
      system: SYSTEM,
      prompt: "Extraé el código de tracking de esta etiqueta:",
      images: [image_base64],
      max_tokens: 100,
      media_type: "image/jpeg",
    });

    const trimmed = text.trim();
    if (!trimmed || trimmed.toUpperCase() === "NONE") {
      return Response.json({ ok: true, tracking: null, raw: trimmed });
    }
    const cleaned = trimmed.replace(/[\s]/g, "").replace(/[^\w-]/g, "");
    return Response.json({ ok: true, tracking: cleaned, raw: trimmed });
  } catch (e) {
    console.error("ocr-tracking error:", e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
