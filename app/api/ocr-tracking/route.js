// POST /api/ocr-tracking
// Body: { image_base64 }   (data URL or raw base64 of jpeg/png)
// Devuelve: { tracking, raw } — código de tracking detectado y texto crudo.
// Usa OpenAI Vision (gpt-4o-mini) para extraer el código.

export const maxDuration = 30;

export async function POST(req) {
  try {
    const { image_base64 } = await req.json();
    if (!image_base64) return Response.json({ ok: false, error: "missing image" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ ok: false, error: "OpenAI key not configured" }, { status: 500 });

    // Normalizar a data URL si vino raw base64
    const imgUrl = image_base64.startsWith("data:") ? image_base64 : `data:image/jpeg;base64,${image_base64}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 100,
        messages: [
          {
            role: "system",
            content: "Sos un asistente que extrae códigos de tracking de etiquetas de courier (DHL, FedEx, UPS, China Post, EMS, Yunda, SF Express, etc.). Respondé SOLO el código, sin explicación. Si hay varios códigos, devolvé el principal (el más prominente). Si no encontrás ninguno, respondé 'NONE'.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraé el código de tracking de esta etiqueta:" },
              { type: "image_url", image_url: { url: imgUrl } },
            ],
          },
        ],
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      return Response.json({ ok: false, error: "OpenAI error", detail: err }, { status: 502 });
    }
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    if (!text || text.toUpperCase() === "NONE") {
      return Response.json({ ok: true, tracking: null, raw: text });
    }
    // Limpiar: quitar espacios, guiones internos quedan
    const cleaned = text.replace(/[\s]/g, "").replace(/[^\w-]/g, "");
    return Response.json({ ok: true, tracking: cleaned, raw: text });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
