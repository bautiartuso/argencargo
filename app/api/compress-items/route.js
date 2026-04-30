// POST /api/compress-items
// Body: { items: [{description, quantity, unit_price_usd, hs_code}], maxItems: 8 }
// Devuelve: { ok, groups: [{description, quantity, unit_price_usd, hs_code, source_indices: []}] }
// Comprime listas largas de items en N grupos para cumplir limitación aduanera (RG 5608: max 8 items/factura).

import { callClaudeText } from "../../../lib/anthropic";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Sos un asistente que ayuda a comprimir listas largas de items para declaraciones aduaneras argentinas.

CONTEXTO: La factura de exportación tiene un límite máximo de items (RG 5608 — usualmente 8). Cuando un cliente declara muchos productos, hay que agruparlos manteniendo trazabilidad.

REGLAS DE COMPRESIÓN:
1. Items con MISMO HS code Y producto similar (variantes de color, talle, material) → MERGE en 1 entrada.
   Ejemplo: 5 "T-shirt rosa", "T-shirt rojo", "T-shirt negro" → 1 entrada "T-shirts (assorted colors)".
2. Items realmente distintos (diferente NCM/función) → mantener separados.
3. Si hay >maxItems entradas resultantes, agrupar las más cercanas (mismo capítulo NCM) para reducir.

CÁLCULO DE GRUPO:
- description: en INGLÉS, genérica para cubrir las variantes (ej: "Stainless steel cookware (various sizes)").
- quantity: SUMA de las cantidades del grupo.
- unit_price_usd: PROMEDIO PONDERADO por cantidad. Es decir: (sum of quantity*price) / sum of quantity.
- hs_code: el HS code más específico común al grupo. Si los del grupo difieren ligeramente, usar el más general (ej: "8517.62" en vez de "8517.62.30").
- source_indices: array con los índices (0-based) de los items originales que se mergearon en este grupo.

CRÍTICO:
- Devolvé MÁXIMO maxItems grupos. Si no podés bajar a maxItems sin agrupar productos heterogéneos, hacelo igual pero ponelos al final.
- Cada índice del input debe aparecer en exactamente UN source_indices del output (sin duplicados ni omisiones).
- El total de USD del output debe ser igual al total del input (suma quantity*unit_price). Verificá antes de devolver.
- Devolvé SOLO el JSON, sin texto extra ni markdown.

FORMATO DE SALIDA:
{
  "groups": [
    {
      "description": "string en inglés",
      "quantity": number,
      "unit_price_usd": number,
      "hs_code": "string o null",
      "source_indices": [number, number, ...]
    }
  ]
}`;

export async function POST(req) {
  try {
    const { items, maxItems = 8 } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ ok: false, error: "missing items" }, { status: 400 });
    }
    if (items.length <= maxItems) {
      return Response.json({ ok: false, error: `Already ${items.length} items, no need to compress (max ${maxItems})` }, { status: 400 });
    }
    if (items.length > 100) {
      return Response.json({ ok: false, error: "max 100 items por compresión" }, { status: 400 });
    }

    const itemsList = items.map((it, i) => `[${i}] desc="${it.description}" qty=${it.quantity} price=${it.unit_price_usd} hs=${it.hs_code || "—"}`).join("\n");
    const totalFob = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price_usd || 0), 0);
    const userMsg = `Comprimí estos ${items.length} items a MÁXIMO ${maxItems} grupos. Total FOB original: USD ${totalFob.toFixed(2)} (debe coincidir con la suma del output).\n\n${itemsList}`;

    const text = await callClaudeText({
      system: SYSTEM_PROMPT,
      user: userMsg,
      max_tokens: 4000,
    });

    let parsed;
    try {
      const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return Response.json({ ok: false, error: "invalid JSON from model", raw: text.slice(0, 500) }, { status: 500 });
    }

    const groups = Array.isArray(parsed.groups) ? parsed.groups.filter(g =>
      g && typeof g.description === "string" && g.description.trim() &&
      typeof g.quantity === "number" && g.quantity > 0 &&
      typeof g.unit_price_usd === "number" && g.unit_price_usd > 0 &&
      Array.isArray(g.source_indices)
    ).map(g => ({
      description: g.description.trim(),
      quantity: Math.round(g.quantity),
      unit_price_usd: Number(g.unit_price_usd.toFixed(2)),
      hs_code: typeof g.hs_code === "string" && g.hs_code.trim() ? g.hs_code.trim() : null,
      source_indices: g.source_indices.filter(x => Number.isInteger(x) && x >= 0 && x < items.length),
    })) : [];

    if (groups.length > maxItems) {
      return Response.json({ ok: false, error: `IA devolvió ${groups.length} grupos, máximo ${maxItems}`, groups }, { status: 422 });
    }

    // Validación de cobertura: cada índice debe aparecer al menos una vez
    const covered = new Set();
    groups.forEach(g => g.source_indices.forEach(i => covered.add(i)));
    const missing = items.map((_, i) => i).filter(i => !covered.has(i));
    const newTotalFob = groups.reduce((s, g) => s + g.quantity * g.unit_price_usd, 0);
    const fobDelta = Math.abs(newTotalFob - totalFob);

    return Response.json({
      ok: true,
      groups,
      original_count: items.length,
      compressed_count: groups.length,
      original_fob: Number(totalFob.toFixed(2)),
      compressed_fob: Number(newTotalFob.toFixed(2)),
      fob_delta: Number(fobDelta.toFixed(2)),
      warnings: [
        ...(missing.length > 0 ? [`${missing.length} items no fueron mergeados (índices: ${missing.join(",")})`] : []),
        ...(fobDelta > 0.5 ? [`Diferencia de FOB: USD ${fobDelta.toFixed(2)} (revisar)`] : []),
      ],
    });
  } catch (e) {
    console.error("compress-items error:", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
