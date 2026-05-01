// POST /api/ncm
// Body: { description }
// Devuelve: { ncm_code, ncm_description, import_duty_rate, statistics_rate, iva_rate, intervention: {required, types, reason}, source }

import { callClaudeText, callClaudeVision } from "../../../lib/anthropic";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

async function searchDB(ncmCode) {
  let r = await fetch(`${SB_URL}/rest/v1/ncm_database?ncm_code=eq.${ncmCode}&select=ncm_code,description,die,te&limit=5`, { headers: { apikey: SB_KEY } });
  let d = await r.json();
  if (Array.isArray(d) && d.length > 0) return d;
  const prefix6 = ncmCode.substring(0, 7);
  r = await fetch(`${SB_URL}/rest/v1/ncm_database?ncm_code=like.${prefix6}*&select=ncm_code,description,die,te&limit=10`, { headers: { apikey: SB_KEY } });
  d = await r.json();
  if (Array.isArray(d) && d.length > 0) return d;
  const prefix4 = ncmCode.substring(0, 4);
  r = await fetch(`${SB_URL}/rest/v1/ncm_database?ncm_code=like.${prefix4}*&select=ncm_code,description,die,te&limit=10`, { headers: { apikey: SB_KEY } });
  d = await r.json();
  return Array.isArray(d) ? d : [];
}

function pickBest(results, fallbackIntervention = null) {
  const byCode = {};
  results.forEach(r => {
    if (!byCode[r.ncm_code] || r.die > byCode[r.ncm_code].die) byCode[r.ncm_code] = r;
  });
  const best = Object.values(byCode)[0];
  return {
    ncm_code: best.ncm_code,
    ncm_description: best.description,
    import_duty_rate: best.die,
    statistics_rate: Math.min(best.te, 3),
    iva_rate: 21,
    intervention: fallbackIntervention || { required: false, types: [], reason: null },
    source: "database",
  };
}

const SYSTEM_PROMPT = `Sos un despachante de aduana argentino experto en clasificación arancelaria NCM (Nomenclatura Común del Mercosur) y en regímenes de intervención de organismos.

El usuario importa productos desde China/USA para reventa en Argentina. Tu trabajo:

1. Devolver el código NCM más probable (formato XXXX.XX.XX, 8 dígitos).
2. Detectar si el producto requiere INTERVENCIÓN de algún organismo. SOLO considerá:
   - ANMAT: medicamentos, suplementos dietarios, productos médicos, cosméticos, productos de higiene personal
   - INAL: alimentos, bebidas, productos en contacto con alimentos (vajilla, utensilios, recipientes herméticos)
   - ENACOM: equipos con WiFi, Bluetooth, RF (router, celular, smartwatch con conectividad, parlante bluetooth, micrófonos inalámbricos, drones con telemetría)
   - SENASA: productos de origen animal o vegetal sin procesar (semillas, mascotas, alimento animal)
   - INTI: cuando aplica (raro, mayormente para certificación de algunos productos industriales)

   NO INCLUYAS jamás "Seguridad Eléctrica", "LCM", "Resolución 169/2018" ni nada relacionado a seguridad eléctrica — el usuario NO opera bajo ese régimen.

3. Reglas de clasificación específicas (overrides):
   - auriculares (bluetooth, TWS, inalámbricos, headphones, earbuds) → 8518.30.00 (NO 8517)
   - parlantes/altavoces → 8518.22.00
   - fundas de celular silicona/TPU → 3926.90.90 (NO clasificar como telecom)
   - smartwatch → 8517.62.72
   - protector pantalla vidrio → 7007.19.00
   - cargador USB → 8504.40.90
   - power bank → 8507.60.00
   - zapatillas deportivas → 6404.11.00
   - jabonera plástica/organizador baño/cocina → 3924.90.00 (sin intervención)

FORMATO DE SALIDA (JSON estricto, sin markdown):
{
  "ncm_code": "XXXX.XX.XX",
  "intervention": {
    "required": boolean,
    "types": ["ANMAT" | "INAL" | "ENACOM" | "SENASA" | "INTI"],
    "reason": "explicación corta o null si no aplica"
  }
}`;

async function classifyWithClaude(description) {
  const text = await callClaudeText({
    system: SYSTEM_PROMPT,
    user: `Clasificá: "${description}"`,
    max_tokens: 500,
  });
  return parseClaudeResponse(text);
}

async function classifyWithClaudeVision(imageBase64, description) {
  // Imagen en base64 (con o sin prefijo data:). Si tiene prefijo lo limpiamos.
  const cleanB64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
  const mediaType = imageBase64.match(/^data:(image\/[a-z]+);base64,/)?.[1] || "image/jpeg";
  const userPrompt = description?.trim()
    ? `Analizá la foto del producto y clasificá. Descripción adicional del usuario: "${description}"`
    : `Analizá la foto del producto y clasificá. No hay descripción adicional, basate solo en la imagen.`;
  const text = await callClaudeVision({
    system: SYSTEM_PROMPT_VISION,
    prompt: userPrompt,
    images: [cleanB64],
    media_type: mediaType,
    max_tokens: 600,
  });
  const parsed = parseClaudeResponse(text);
  if (!parsed) return null;
  // Vision también devuelve guess_description (descripción comercial breve)
  return parsed;
}

function parseClaudeResponse(text) {
  let json;
  try {
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    json = JSON.parse(cleaned);
  } catch (e) {
    const m = text.match(/\d{4}\.\d{2}\.\d{2}/);
    return m ? { ncm_code: m[0], intervention: { required: false, types: [], reason: null } } : null;
  }
  if (!json?.ncm_code || !/^\d{4}\.\d{2}\.\d{2}$/.test(json.ncm_code)) return null;
  return json;
}

// Prompt extendido para vision: pedimos también la descripción comercial detectada
const SYSTEM_PROMPT_VISION = SYSTEM_PROMPT.replace(
  "FORMATO DE SALIDA (JSON estricto, sin markdown):",
  `Cuando analizás una FOTO, primero identificá el producto observando: forma, color, packaging, marca visible, etiquetas, contexto. Después clasificá según las reglas anteriores.

FORMATO DE SALIDA (JSON estricto, sin markdown):`
).replace(
  '"ncm_code": "XXXX.XX.XX",',
  '"ncm_code": "XXXX.XX.XX",\n  "guess_description": "descripción comercial breve del producto detectado (max 80 chars, en español)",'
);

// Manual overrides para productos que la IA suele errar
const OVERRIDES = [
  { keywords: ["auricular", "headphone", "earphone", "earbuds", "earbud", "tws", "headset", "auriculares"], ncm: "8518.30.00", desc: "Auriculares", die: 35, te: 3, intervention: { required: true, types: ["ENACOM"], reason: "Inalámbrico o bluetooth — homologación ENACOM" } },
  { keywords: ["parlante", "altavoz", "speaker", "bocina", "boombox"], ncm: "8518.22.00", desc: "Altavoces/Parlantes", die: 35, te: 3, intervention: { required: false, types: [], reason: null } },
];

function checkOverride(description) {
  const lower = description.toLowerCase();
  for (const ov of OVERRIDES) {
    if (ov.keywords.some(k => lower.includes(k))) {
      return { ncm_code: ov.ncm, ncm_description: ov.desc, import_duty_rate: ov.die, statistics_rate: ov.te, iva_rate: 21, intervention: ov.intervention, source: "override" };
    }
  }
  return null;
}

export async function POST(req) {
  try {
    const { description, image } = await req.json();
    if (!description && !image) return Response.json({ error: "Description or image required" }, { status: 400 });

    // Si NO hay imagen, primero probar overrides por descripción (rápido y barato)
    if (!image && description) {
      const override = checkOverride(description);
      if (override) return Response.json(override);
    }

    // Clasificar: con imagen → vision, sin imagen → texto
    const claudeResult = image
      ? await classifyWithClaudeVision(image, description).catch(e => { console.error("Claude vision error:", e.message); return null; })
      : await classifyWithClaude(description).catch(e => { console.error("Claude error:", e.message); return null; });

    if (claudeResult?.ncm_code) {
      // Si vino guess_description de visión, lo devolvemos para que el cliente rellene el campo
      const extras = claudeResult.guess_description ? { guess_description: claudeResult.guess_description } : {};
      const results = await searchDB(claudeResult.ncm_code);
      if (results.length > 0) return Response.json({ ...pickBest(results, claudeResult.intervention), ...extras });
      // No match en DB pero tenemos NCM de Claude — devolver con defaults
      return Response.json({
        ncm_code: claudeResult.ncm_code,
        ncm_description: null,
        import_duty_rate: 35,
        statistics_rate: 3,
        iva_rate: 21,
        intervention: claudeResult.intervention || { required: false, types: [], reason: null },
        source: image ? "claude-vision" : "claude",
        ...extras,
      });
    }

    return Response.json({ error: "No se pudo clasificar la mercadería", fallback: true }, { status: 200 });
  } catch (e) {
    console.error("NCM route error:", e.message);
    return Response.json({ error: e.message, fallback: true }, { status: 200 });
  }
}
