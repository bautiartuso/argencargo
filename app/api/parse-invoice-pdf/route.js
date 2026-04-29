// POST /api/parse-invoice-pdf
// Body: { images: [base64...] } — array de páginas del PDF como imágenes base64
// Devuelve: { ok, items: [{description, quantity, unit_price_usd}], raw }
// Usa OpenAI Vision (gpt-4o-mini) para extraer items de facturas comerciales chinas/USA

export const maxDuration = 60;

const SYSTEM_PROMPT = `Sos un asistente que extrae items de facturas comerciales (commercial invoice / packing list) de proveedores chinos o estadounidenses para importaciones argentinas.

Tu trabajo: extraer todos los productos listados con su descripción, cantidad, precio unitario en USD, y HS Code / NCM si está presente.

REGLAS:
- Buscá tablas con columnas tipo: Description / Item / Product, Quantity / Qty / 数量, Unit Price / 单价, Total / Amount, HS Code / HSCode / HS / NCM / 海关编码 / 商品编码.
- Si el precio está en CNY/RMB/¥ convertilo a USD aproximadamente (1 USD = 7.2 CNY).
- Si la moneda no está clara, asumí USD.
- Si el precio unitario no aparece pero sí el total y la cantidad, dividí.
- Ignorá líneas de subtotal, freight, tax, total, etc.
- IMPORTANTE: las descripciones se usan para declaraciones aduaneras y deben estar SIEMPRE en INGLÉS.
  · Si la descripción ya está en inglés, dejala TAL CUAL (no traduzcas).
  · Si está en chino, traducila al inglés: "无线耳机" → "Wireless earphones".
  · Si está en español u otro idioma, traducila al inglés: "Auriculares inalámbricos" → "Wireless earphones".
  · Usá terminología comercial estándar (la que aparecería en una commercial invoice).
- Cantidad debe ser un número entero. Precio unitario debe ser número decimal.
- HS Code: extraé el código tal cual aparece. Suele ser 6, 8 o 10 dígitos (ej: "8517.62", "8517.62.00", "85176200"). Si no aparece HS code para ese item, omitilo (no inventes).
- Devolvé SOLO el JSON, sin texto adicional ni markdown.

FORMATO DE SALIDA (JSON estricto):
{
  "items": [
    {"description": "string en INGLÉS", "quantity": number, "unit_price_usd": number, "hs_code": "string o null"}
  ]
}

Si no encontrás ningún item, devolvé {"items": []}.`;

export async function POST(req) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json({ ok: false, error: "OpenAI key not configured" }, { status: 500 });

    const { images } = await req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return Response.json({ ok: false, error: "missing images" }, { status: 400 });
    }
    if (images.length > 10) {
      return Response.json({ ok: false, error: "max 10 pages" }, { status: 400 });
    }

    // Build user content: text prompt + all images
    const userContent = [
      { type: "text", text: `Analizá ${images.length === 1 ? "esta factura" : `estas ${images.length} páginas de factura`} y extraé todos los items en JSON.` },
      ...images.map(img => ({
        type: "image_url",
        image_url: {
          url: img.startsWith("data:") ? img : `data:image/png;base64,${img}`,
          detail: "high",
        },
      })),
    ];

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error("OpenAI error:", err);
      return Response.json({ ok: false, error: "OpenAI error", detail: err.slice(0, 500) }, { status: 502 });
    }
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "{}";
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) {
      return Response.json({ ok: false, error: "invalid JSON from model", raw: text.slice(0, 500) }, { status: 500 });
    }
    const items = Array.isArray(parsed.items) ? parsed.items.filter(it =>
      it && typeof it.description === "string" && it.description.trim() &&
      typeof it.quantity === "number" && it.quantity > 0 &&
      typeof it.unit_price_usd === "number" && it.unit_price_usd > 0
    ).map(it => ({
      description: it.description.trim(),
      quantity: it.quantity,
      unit_price_usd: it.unit_price_usd,
      hs_code: typeof it.hs_code === "string" && it.hs_code.trim() ? it.hs_code.trim() : null,
    })) : [];
    return Response.json({ ok: true, items, count: items.length });
  } catch (e) {
    console.error("parse-invoice-pdf error:", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
