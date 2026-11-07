// POST /api/compress-items
// Body: { items: [{description, quantity, unit_price_usd, hs_code}], maxItems: 8 }
// Devuelve: { ok, groups: [{description, quantity, unit_price_usd, hs_code, source_indices: []}] }
// Comprime listas largas de items en N grupos para cumplir limitación aduanera (RG 5608: max 8 items/factura).

import { callClaudeText, HAIKU_MODEL } from "../../../lib/anthropic";
import { quienLlama } from "../../../lib/auth-server";
import { limitar } from "../../../lib/ratelimit";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Sos un asistente que comprime listas de items para declaraciones aduaneras argentinas.

CONTEXTO: La factura de exportación tiene un límite máximo de items (RG 5608 — usualmente 8). Hay que agruparlos preservando la información lo más posible.

PRINCIPIO CLAVE — CONSERVADOR, NO AGRESIVO:
- La compresión debe ser MÍNIMA. Solo agrupar lo que sea CLARAMENTE la misma cosa con variantes obvias.
- Si alcanzás el maxItems mergeando solo variantes obvias, listo, parar ahí.
- maxItems es el OBJETIVO, no una condición de todo o nada. Si no llegás a maxItems sin mezclar
  productos distintos, igual hacé TODOS los merges de variantes obvias y bajá lo más que se pueda
  (por ejemplo a 10, 11 o 12). Nunca devuelvas la lista sin comprimir solo porque no llegás a maxItems.
- ANTES era muy agresivo: sé conservador. Mejor dejar 9-10 items que mergear "auriculares" con "fundas".

QUÉ MERGEAR (variantes obvias):
- Mismo producto + variante de color: "Camiseta roja", "Camiseta azul", "Camiseta negra" → "Cotton T-shirts (assorted colors)"
- Mismo producto + variante de talle: "Zapatilla 38", "Zapatilla 39" → "Sport sneakers (assorted sizes)"
- Mismo producto + variante de material similar: "Funda silicona iPhone 13", "Funda silicona iPhone 14" → "Silicone phone cases"
- Items de la MISMA PARTIDA (4 primeros dígitos del HS) y descripción muy similar. La subpartida
  (dígitos 5 a 8) suele cambiar solo por el material (6204.42 algodón, 6204.43 sintético, 6204.44
  artificial, 6204.49 otros): eso NO impide juntar. "Lace dress 6204.49" y "Pleated dress 6204.43" son
  los mismos vestidos de mujer 6204. Para el grupo usá el hs_code del item con más cantidad.

QUÉ NO MERGEAR — JAMÁS:
- HS code de partidas distintas (primeros 4 dígitos diferentes). El código lo verifica y separa.
- Productos de función/uso distinto aunque compartan HS code: una aspiradora, un calentador de
  mamaderas y un disco externo NUNCA van juntos, ni para llegar al máximo.
- Si el merge requiere una descripción genérica o una lista de cosas sueltas ("X, Y, Z and W").
  Un grupo describe UN tipo de producto con sus variantes, no una bolsa de cosas distintas.
- Si no llegás al máximo sin forzar, devolvé más grupos: el exceso se le cobra al cliente, pero
  una factura forzada hace que la Aduana retenga el vuelo entero (pasó, 26/10/2026).

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

// Modo exigido (07/11/2026, Bautista): el admin decide forzar la compresión hasta el objetivo. Se agrega
// al prompt conservador, que sigue siendo el modo por defecto.
const FORZAR_ADDENDUM = `

MODO EXIGIDO — EL ADMIN LO PIDIÓ EXPLÍCITAMENTE:
- Esta vez SÍ tenés que devolver como máximo maxItems grupos. No pares en "variantes obvias".
- Agrupá por FAMILIA de producto aunque cambien estilo, modelo, color, talle o material:
  todos los vestidos de mujer → "Women's dresses, assorted styles"; todos los shorts → "Women's shorts, assorted styles";
  todas las fundas → "Phone cases, assorted models".
- Lo único que sigue prohibido es mezclar partidas HS de 4 dígitos distintas (el código las separa igual).
  Los códigos que solo difieren después del 4.º dígito son LA MISMA partida y SÍ se juntan:
  6204.42 / 6204.43 / 6204.44 / 6204.49 = un solo grupo "Women's dresses, assorted styles" con el hs_code
  del item de mayor cantidad. Nunca devuelvas dos grupos con la misma descripción y la misma partida.
  Si para llegar al objetivo tenés que elegir, juntá primero lo que comparte partida.
- La descripción sigue siendo de la familia, específica y en inglés: nunca "various items" ni listas de cosas sueltas.
- Si aun juntando por familia dentro de cada partida no llegás, devolvé lo mínimo posible.`;

export async function POST(req) {
  // 28/10/2026: gasta IA; antes estaba abierta a cualquiera.
  if (!(await quienLlama(req))) return Response.json({ ok: false, error: "no_auth" }, { status: 401 });
  const frenado = limitar(req, { clave: "compress", limite: 20, ventanaMs: 60_000 });
  if (frenado) return frenado;
  try {
    const { items, maxItems = 8, forzar = false } = await req.json();
    const system = forzar ? SYSTEM_PROMPT + FORZAR_ADDENDUM : SYSTEM_PROMPT;
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
    const userMsg = `Comprimí estos ${items.length} items: ${forzar ? `OBJETIVO EXIGIDO: como máximo ${maxItems} grupos, agrupando por familia de producto dentro de cada partida HS.` : `objetivo ${maxItems} grupos; si no se puede sin mezclar productos distintos, lo más cerca posible.`} Total FOB original: USD ${totalFob.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} (debe coincidir con la suma del output).\n\n${itemsList}`;

    const JSON_SCHEMA = {
      type: "object",
      properties: {
        groups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              hs_code: { type: "string" },
              source_indices: { type: "array", items: { type: "integer" } },
            },
            required: ["description", "hs_code", "source_indices"],
            additionalProperties: false,
          },
        },
      },
      required: ["groups"],
      additionalProperties: false,
    };

    // Forzamos structured output (json_schema) en vez de confiar en "devolvé SOLO JSON" por prompt —
    // así el modelo no puede devolver texto/markdown alrededor ni JSON malformado, y se elimina la
    // clase de error "invalid JSON from model" que antes solo se podía resolver reintentando a mano.
    let text;
    try {
      text = await callClaudeText({ model: HAIKU_MODEL,
        system,
        user: userMsg,
        max_tokens: 4000,
        json_schema: JSON_SCHEMA,
      });
    } catch (e) {
      // Si el fallback a OpenAI entra en juego, json_schema no aplica ahí — reintentamos una vez sin schema.
      text = await callClaudeText({ model: HAIKU_MODEL, system, user: userMsg, max_tokens: 4000 });
    }

    // Si la IA rodeó el JSON con texto, se toma el bloque {...} (29/10/2026: "invalid JSON from model").
    let parsed;
    try {
      const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
      try { parsed = JSON.parse(cleaned); }
      catch { const a = cleaned.indexOf("{"), b = cleaned.lastIndexOf("}"); parsed = JSON.parse(cleaned.slice(a, b + 1)); }
    } catch (e) {
      return Response.json({ ok: false, error: "La IA respondió algo que no se pudo leer. Tocá Reintentar; si vuelve a pasar, comprimí a mano.", raw: text.slice(0, 500) }, { status: 500 });
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
      // hs_code solo se guarda si tiene forma de código NCM real (dígitos, opcionalmente con
      // puntos). Si el grupo mezcla items sin capítulo NCM común, el modelo a veces devuelve un
      // placeholder tipo "—" o "N/A" en vez de omitirlo — eso quedaría guardado tal cual y el
      // admin nunca podría re-clasificar el item (se lo toma como "NCM ya cargado a mano").
      const hsRaw = typeof g.hs_code === "string" ? g.hs_code.trim() : "";
      const hs_code = /^\d{4}(\.?\d{2}){0,2}$/.test(hsRaw) ? hsRaw : null;
      groups.push({
        description: g.description.trim(),
        quantity: totalQty,
        unit_price_usd,
        hs_code,
        source_indices: validIndices,
      });
    }
    // GUARDIA (26/10/2026): un grupo que mezcla partidas distintas (4 primeros dígitos del HS)
    // se parte por partida. La IA ya no lo hace, pero una factura forzada retiene el vuelo.
    const partirPorPartida = (gs) => {
      const out = [];
    for (const g of gs) {
      const porPartida = {};
      for (const i of g.source_indices) { const k = String(items[i].hs_code || "").replace(/[^0-9]/g, "").slice(0, 4) || "sin"; (porPartida[k] = porPartida[k] || []).push(i); }
      const ks = Object.keys(porPartida);
      if (ks.length <= 1) { out.push(g); continue; }
      for (const k of ks) {
        const idx = porPartida[k]; const gi = idx.map(i => items[i]);
        const q = gi.reduce((s, it) => s + Number(it.quantity || 0), 0);
        const amt = gi.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price_usd || 0), 0);
        out.push({ description: idx.length === 1 ? (gi[0].description || g.description) : g.description, quantity: q, unit_price_usd: q > 0 ? Number((amt / q).toFixed(4)) : 0, hs_code: gi[0].hs_code || null, source_indices: idx });
      }
    }
      return out;
    };
    const split = partirPorPartida(groups);
    const partidasSeparadas = split.length - groups.length;
    groups.length = 0; groups.push(...split);
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

    // SEGUNDA PASADA EXIGIDA (07/11/2026): si la IA se quedó corta aun en modo exigido (AC-0373: cuatro
    // grupos "Women's dresses" separados por subpartida), se le vuelven a dar los grupos y tiene que
    // juntar por partida hasta el objetivo. Los índices del resultado apuntan a grupos, no a items.
    let segundaPasada = false;
    if (forzar && groups.length > maxItems) {
      const lista2 = groups.map((g, i) => `[${i}] desc="${g.description}" qty=${g.quantity} hs=${g.hs_code || "—"} partida=${String(g.hs_code || "").replace(/\D/g, "").slice(0, 4) || "?"}`).join("\n");
      const msg2 = `SEGUNDA PASADA EXIGIDA. Estos ${groups.length} grupos tienen que quedar en como máximo ${maxItems}. Juntá en UN solo grupo todo lo que comparte partida (4 dígitos) y es la misma familia de prenda o producto, con nombre de familia en inglés (ej. "Women's dresses, assorted styles", "Women's knit shorts and skirts", "Women's two-piece sets") y el hs_code del grupo con más cantidad. Si juntando así quedan menos de ${maxItems}, podés dejar separadas familias claramente distintas dentro de una partida mientras no pases de ${maxItems}. Cada índice en exactamente un grupo.\n\n${lista2}`;
      let t2 = null;
      try { t2 = await callClaudeText({ model: HAIKU_MODEL, system, user: msg2, max_tokens: 3000, json_schema: JSON_SCHEMA }); }
      catch { try { t2 = await callClaudeText({ model: HAIKU_MODEL, system, user: msg2, max_tokens: 3000 }); } catch {} }
      let p2 = null;
      try { const c2 = String(t2 || "").replace(/```json\s*|\s*```/g, "").trim(); try { p2 = JSON.parse(c2); } catch { const a = c2.indexOf("{"), b = c2.lastIndexOf("}"); p2 = JSON.parse(c2.slice(a, b + 1)); } } catch {}
      const raw2 = Array.isArray(p2?.groups) ? p2.groups : [];
      const usados = new Set(); const nuevos = [];
      for (const g2 of raw2) {
        if (!g2 || typeof g2.description !== "string" || !Array.isArray(g2.source_indices)) continue;
        const idx = g2.source_indices.filter((x) => Number.isInteger(x) && x >= 0 && x < groups.length && !usados.has(x));
        if (!idx.length) continue;
        idx.forEach((x) => usados.add(x));
        const src = idx.flatMap((x) => groups[x].source_indices);
        const gi = src.map((i) => items[i]);
        const q = gi.reduce((a, it) => a + Number(it.quantity || 0), 0);
        const amt = gi.reduce((a, it) => a + Number(it.quantity || 0) * Number(it.unit_price_usd || 0), 0);
        const mayor = idx.map((x) => groups[x]).sort((a, b) => b.quantity - a.quantity)[0];
        const hsRaw2 = typeof g2.hs_code === "string" ? g2.hs_code.trim() : "";
        nuevos.push({ description: g2.description.trim() || mayor.description, quantity: q, unit_price_usd: q > 0 ? Number((amt / q).toFixed(4)) : 0, hs_code: /^\d{4}(\.?\d{2}){0,2}$/.test(hsRaw2) ? hsRaw2 : (mayor.hs_code || null), source_indices: src });
      }
      for (let x = 0; x < groups.length; x++) if (!usados.has(x)) nuevos.push(groups[x]);
      if (nuevos.length && nuevos.length < groups.length) {
        const s2 = partirPorPartida(nuevos);
        groups.length = 0; groups.push(...s2);
        segundaPasada = true;
      }
    }

    // Nota: NO rechazamos si groups.length > maxItems — el prompt conservador puede dejar
    // más grupos que el ideal cuando los items son muy heterogéneos. Lo marcamos en warnings.

    // Validación final: ahora cobertura está garantizada por el rescate
    const newTotalFob = groups.reduce((s, g) => s + g.quantity * g.unit_price_usd, 0);
    const fobDelta = Math.abs(newTotalFob - totalFob);
    const fobDeltaPct = totalFob > 0 ? (fobDelta / totalFob) * 100 : 0;

    // Solo error crítico es FOB delta significativo (no debería pasar con el cálculo en código)
    const criticalErrors = [];
    if (fobDeltaPct > 1.5) criticalErrors.push(`❌ Diferencia de FOB: USD ${fobDelta.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} (${fobDeltaPct.toFixed(1)}%)`);

    const warnings = [
      ...(rescued.length > 0 ? [`La IA dejó ${rescued.length} items sin agrupar (índices: ${rescued.join(",")}) — los agregué como grupos sueltos para no perderlos. Si querés más compresión, tocá Re-comprimir.`] : []),
      ...(aiDuplicates.length > 0 ? [`La IA duplicó ${aiDuplicates.length} índices (los descarté de la 2da ocurrencia).`] : []),
      ...(fobDelta > 0.5 && fobDeltaPct <= 1.5 ? [`Diferencia menor de FOB: USD ${fobDelta.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} (probable redondeo)`] : []),
      ...(partidasSeparadas > 0 ? [`Separé ${partidasSeparadas} grupo${partidasSeparadas > 1 ? "s" : ""} que mezclaban partidas distintas (HS de 4 dígitos).`] : []),
      ...(groups.length > maxItems ? [forzar
        ? `Ni exigiendo (${segundaPasada ? "dos pasadas" : "una pasada"}) bajó de ${groups.length} grupos (objetivo ${maxItems}): lo que queda son partidas HS distintas, que no se mezclan. El exceso se le cobra al cliente (USD 5 por ítem de más de 8).`
        : `Quedaron ${groups.length} grupos (objetivo ${maxItems}): no se pudo bajar más sin forzar. El exceso se le cobra al cliente (USD 5 por ítem de más de 8). Si querés que junte productos distintos de la misma familia, tocá Exigir.`] : []),
    ];

    return Response.json({
      ok: true,
      groups,
      original_count: items.length,
      compressed_count: groups.length,
      original_fob: Math.round((totalFob)*100)/100,
      compressed_fob: Math.round((newTotalFob)*100)/100,
      fob_delta: Math.round((fobDelta)*100)/100,
      critical_errors: criticalErrors,
      warnings,
      can_apply: criticalErrors.length === 0,
      forzado: !!forzar,
      segunda_pasada: segundaPasada,
    });
  } catch (e) {
    console.error("compress-items error:", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
