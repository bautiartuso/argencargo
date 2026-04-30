// POST /api/compress-items
// Body: { items: [{description, quantity, unit_price_usd, hs_code}], maxItems: 8 }
// Devuelve: { ok, groups: [{description, quantity, unit_price_usd, hs_code, source_indices: []}] }
// Comprime listas largas de items en N grupos para cumplir limitación aduanera (RG 5608: max 8 items/factura).

import { callClaudeText } from "../../../lib/anthropic";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Sos un asistente que comprime listas de items para declaraciones aduaneras argentinas.

CONTEXTO: La factura de exportación tiene un límite máximo de items (RG 5608 — usualmente 8). Hay que agruparlos preservando la información lo más posible.

PRINCIPIO CLAVE — CONSERVADOR, NO AGRESIVO:
- La compresión debe ser MÍNIMA. Solo agrupar lo que sea CLARAMENTE la misma cosa con variantes obvias.
- Si alcanzás el maxItems mergeando solo variantes obvias, listo, parar ahí.
- Si todavía superás maxItems pero el resto son productos heterogéneos → ES PREFERIBLE devolver más de maxItems que mergear cosas distintas. El admin puede ajustar a mano.
- ANTES era muy agresivo: por favor sé conservador. Mejor dejar 9-10 items que mergear "auriculares" con "fundas".

QUÉ MERGEAR (variantes obvias):
- Mismo producto + variante de color: "Camiseta roja", "Camiseta azul", "Camiseta negra" → "Cotton T-shirts (assorted colors)"
- Mismo producto + variante de talle: "Zapatilla 38", "Zapatilla 39" → "Sport sneakers (assorted sizes)"
- Mismo producto + variante de material similar: "Funda silicona iPhone 13", "Funda silicona iPhone 14" → "Silicone phone cases"
- Items con MISMO HS code Y descripción muy similar (>70% de palabras en común)

QUÉ NO MERGEAR — JAMÁS:
- HS code de capítulos distintos (primeros 2 dígitos diferentes)
- Productos de función/uso totalmente diferente aunque compartan HS code
- Si el merge requiere una descripción genérica que pierde info útil para el cliente o aduana

CÁLCULO DEL GRUPO MERGEADO:
- description: en INGLÉS, descriptiva pero específica. NO usar términos vagos como "various items" o "mixed products".
- quantity: SUMA de las cantidades del grupo.
- unit_price_usd: PROMEDIO PONDERADO. (sum of quantity*price) / sum of quantity. Redondear a 2 decimales.
- hs_code: el HS code común. Si difieren ligeramente (último dígito), usar el más general.
- source_indices: array de índices (0-based) que se mergearon.

REGLAS TÉCNICAS — CRÍTICAS, ROMPER ALGUNA INVALIDA TODO EL OUTPUT:
- ⚠️ CADA ÍNDICE DEL INPUT DEBE APARECER EN EXACTAMENTE UN GRUPO. Ni más, ni menos. NO DUPLICAR.
- ⚠️ TODOS LOS ÍNDICES DEBEN ESTAR CUBIERTOS. Si tenés 22 items (índices 0..21), todos los 22 deben aparecer en algún source_indices.
- Items que NO se mergean con nadie quedan como grupo de 1 con source_indices=[i].
- ⚠️ EL TOTAL Σ(quantity × unit_price_usd) DEL OUTPUT DEBE SER IGUAL AL DEL INPUT (con tolerancia <$0.50 por redondeo).
- Antes de devolver: VERIFICÁ MENTALMENTE que cada índice aparezca exactamente 1 vez en algún grupo. Si dudás, revisá tu output.
- Devolvé SOLO JSON, sin markdown.

FORMATO:
{
  "groups": [
    {"description": "...", "quantity": N, "unit_price_usd": N, "hs_code": "...", "source_indices": [...]}
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

    // Nota: NO rechazamos si groups.length > maxItems — el prompt conservador puede dejar
    // más grupos que el ideal cuando los items son muy heterogéneos. Lo marcamos en warnings.

    // Validación: cobertura + DUPLICADOS + FOB
    const covered = new Set();
    const duplicates = new Set(); // índices que aparecen >1 vez
    groups.forEach(g => g.source_indices.forEach(i => {
      if (covered.has(i)) duplicates.add(i);
      covered.add(i);
    }));
    const missing = items.map((_, i) => i).filter(i => !covered.has(i));
    const newTotalFob = groups.reduce((s, g) => s + g.quantity * g.unit_price_usd, 0);
    const fobDelta = Math.abs(newTotalFob - totalFob);
    const fobDeltaPct = totalFob > 0 ? (fobDelta / totalFob) * 100 : 0;

    // Errores críticos: bloquean el aplicar (UI no debería dejar)
    const criticalErrors = [];
    if (duplicates.size > 0) criticalErrors.push(`❌ La IA duplicó items (índices: ${[...duplicates].join(",")}) → totales mal calculados`);
    if (missing.length > 0) criticalErrors.push(`❌ ${missing.length} items no fueron mergeados (índices: ${missing.join(",")})`);
    if (fobDeltaPct > 1.5) criticalErrors.push(`❌ Diferencia de FOB: USD ${fobDelta.toFixed(2)} (${fobDeltaPct.toFixed(1)}%) — la suma no cierra`);

    const warnings = [
      ...(fobDelta > 0.5 && fobDeltaPct <= 1.5 ? [`Diferencia menor de FOB: USD ${fobDelta.toFixed(2)} (probable redondeo)`] : []),
      ...(groups.length > maxItems ? [`La IA prefirió dejar ${groups.length} grupos (>${maxItems}) en vez de mergear productos heterogéneos.`] : []),
    ];

    return Response.json({
      ok: true,
      groups,
      original_count: items.length,
      compressed_count: groups.length,
      original_fob: Number(totalFob.toFixed(2)),
      compressed_fob: Number(newTotalFob.toFixed(2)),
      fob_delta: Number(fobDelta.toFixed(2)),
      critical_errors: criticalErrors,
      warnings,
      can_apply: criticalErrors.length === 0,
    });
  } catch (e) {
    console.error("compress-items error:", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
