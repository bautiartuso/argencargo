export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured", fallback: true }, { status: 200 });

  try {
    const { description } = await req.json();
    if (!description) return Response.json({ error: "Description required" }, { status: 400 });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{ role: "user", content: `Sos un experto en clasificación arancelaria argentina (Nomenclatura Común del Mercosur - NCM).

Dada esta mercadería: "${description}"

Respondé SOLAMENTE con un JSON válido (sin markdown, sin explicación) con esta estructura exacta:
{
  "ncm_code": "XXXX.XX.XX",
  "ncm_description": "Descripción oficial corta del NCM",
  "import_duty_rate": XX,
  "statistics_rate": X,
  "iva_rate": 21
}

Reglas:
- import_duty_rate: el porcentaje de Derecho de Importación Extrazona (DIE) para ese NCM en Argentina. Valores comunes: 0%, 2%, 10.8%, 14%, 16%, 18%, 20%, 35%.
- statistics_rate: Tasa de Estadística, generalmente 3%. Para bienes de capital e informática puede ser 0%.
- iva_rate: IVA de importación, generalmente 21%. Para algunos bienes (alimentos, medicamentos, libros) es 10.5%.
- Usá la posición arancelaria más específica posible (8 dígitos).
- Si no estás seguro, usá el valor más probable.` }]
      })
    });

    const data = await r.json();
    const text = data.content?.[0]?.text || "";
    try {
      const parsed = JSON.parse(text);
      return Response.json(parsed);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return Response.json(JSON.parse(match[0]));
      return Response.json({ error: "Could not parse AI response", raw: text }, { status: 500 });
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
