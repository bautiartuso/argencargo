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

QUÉ DEVOLVER POR GRUPO:
- description: en INGLÉS, descriptiva pero específica. NO usar términos vagos como "various items" o "mixed products".
- hs_code: el HS code común. Si difieren ligeramente (último dígito), usar el más general.
- source_indices: array de índices (0-based) de los items que se mergean en este grupo.

⚠️ NO CALCULES quantity NI unit_price_usd. Esos los calcula el código exactamente desde los items originales. Solo decidí agrupación.

REGLAS TÉCNICAS — CRÍTICAS:
- ⚠️ CADA ÍNDICE DEL INPUT DEBE APARECER EN EXACTAMENTE UN GRUPO. Ni más, ni menos. NO DUPLICAR.
- ⚠️ TODOS LOS ÍNDICES DEBEN ESTAR CUBIERTOS. Si tenés 22 items (índices 0..21), todos deben aparecer en algún source_indices.
- Items que NO se mergean con nadie quedan como grupo de 1 con source_indices=[i].
- Antes de devolver: VERIFICÁ MENTALMENTE que cada índice aparezca exactamente 1 vez. Si dudás, revisá tu output.
- Devolvé SOLO JSON, sin markdown.

FORMATO:
{
  "groups": [
    {"description": "...", "hs_code": "...", "source_indices": [...]}
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

    // CALCULAMOS quantity + unit_price_usd EN CÓDIGO desde los items originales
    // (no confiamos en lo que devuelve la IA porque suele errar en el promedio ponderado).
    // La IA solo decide cómo agrupar (description + hs_code + source_indices).
    // ROBUSTNESS: deduplicamos índices (si la IA repitió alguno, contamos solo 1ra ocurrencia)
    // y RESCATAMOS items perdidos como grupos singleton.
    const seenIndices = new Set();
    const rawGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
    const groups = [];
    const aiDuplicates = []; // índices que la IA puso en >1 grupo (los descartamos en grupos posteriores)
    for (const g of rawGroups) {
      if (!g || typeof g.description !== "string" || !g.description.trim() || !Array.isArray(g.source_indices)) continue;
      const validIndices = [];
      for (const x of g.source_indices) {
        if (!Number.isInteger(x) || x < 0 || x >= items.length) continue;
        if (seenIndices.has(x)) { aiDuplicates.push(x); continue; }
        seenIndices.add(x);
        validIndices.push(x);
      }
      if (validIndices.length === 0) continue;
      const groupItems = validIndices.map(i => items[i]);
      const totalQty = groupItems.reduce((s, it) => s + Number(it.quantity || 0), 0);
      const totalAmount = groupItems.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price_usd || 0), 0);
      const unit_price_usd = totalQty > 0 ? Number((totalAmount / totalQty).toFixed(4)) : 0;
      if (totalQty <= 0) continue;
      groups.push({
        description: g.description.trim(),
        quantity: totalQty,
        unit_price_usd,
        hs_code: typeof g.hs_code === "string" && g.hs_code.trim() ? g.hs_code.trim() : null,
        source_indices: validIndices,
      });
    }
    // RESCATE: items que la IA dejó afuera → los agregamos como grupos singleton
    const rescued = [];
    for (let i = 0; i < items.length; i++) {
      if (seenIndices.has(i)) continue;
      const it = items[i];
      const qty = Number(it.quantity || 0);
      const price = Number(it.unit_price_usd || 0);
      if (qty <= 0) continue;
      groups.push({
        description: it.description || `Item ${i + 1}`,
        quantity: qty,
        unit_price_usd: price,
        hs_code: it.hs_code || null,
        source_indices: [i],
      });
      rescued.push(i);
    }

    // Nota: NO rechazamos si groups.length > maxItems — el prompt conservador puede dejar
    // más grupos que el ideal cuando los items son muy heterogéneos. Lo marcamos en warnings.

    // Validación final: ahora cobertura está garantizada por el rescate
    const newTotalFob = groups.reduce((s, g) => s + g.quantity * g.unit_price_usd, 0);
    const fobDelta = Math.abs(newTotalFob - totalFob);
    const fobDeltaPct = totalFob > 0 ? (fobDelta / totalFob) * 100 : 0;

    // Solo error crítico es FOB delta significativo (no debería pasar con el cálculo en código)
    const criticalErrors = [];
    if (fobDeltaPct > 1.5) criticalErrors.push(`❌ Diferencia de FOB: USD ${fobDelta.toFixed(2)} (${fobDeltaPct.toFixed(1)}%)`);

    const warnings = [
      ...(rescued.length > 0 ? [`La IA dejó ${rescued.length} items sin agrupar (índices: ${rescued.join(",")}) — los agregué como grupos sueltos para no perderlos. Si querés más compresión, tocá Re-comprimir.`] : []),
      ...(aiDuplicates.length > 0 ? [`La IA duplicó ${aiDuplicates.length} índices (los descarté de la 2da ocurrencia).`] : []),
      ...(fobDelta > 0.5 && fobDeltaPct <= 1.5 ? [`Diferencia menor de FOB: USD ${fobDelta.toFixed(2)} (probable redondeo)`] : []),
      ...(groups.length > maxItems ? [`Quedaron ${groups.length} grupos (objetivo era ${maxItems}). Tocá Re-comprimir si necesitás reducir más.`] : []),
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
