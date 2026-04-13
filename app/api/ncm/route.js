const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

async function searchDB(ncmCode) {
  let r = await fetch(`${SB_URL}/rest/v1/ncm_database?ncm_code=eq.${ncmCode}&select=ncm_code,description,die,te&limit=5`, {
    headers: { apikey: SB_KEY }
  });
  let d = await r.json();
  if (Array.isArray(d) && d.length > 0) return d;

  const prefix6 = ncmCode.substring(0, 7);
  r = await fetch(`${SB_URL}/rest/v1/ncm_database?ncm_code=like.${prefix6}*&select=ncm_code,description,die,te&limit=10`, {
    headers: { apikey: SB_KEY }
  });
  d = await r.json();
  if (Array.isArray(d) && d.length > 0) return d;

  const prefix4 = ncmCode.substring(0, 4);
  r = await fetch(`${SB_URL}/rest/v1/ncm_database?ncm_code=like.${prefix4}*&select=ncm_code,description,die,te&limit=10`, {
    headers: { apikey: SB_KEY }
  });
  d = await r.json();
  if (Array.isArray(d) && d.length > 0) return d;

  return [];
}

function pickBest(results) {
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
    source: "database"
  };
}

async function classifyWithGemini(description, apiKey) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Sos un despachante de aduana argentino experto en clasificación arancelaria NCM (Nomenclatura Común del Mercosur). Clasificá esta mercadería con el código NCM de 8 dígitos (formato XXXX.XX.XX). Respondé SOLO el código, nada más.\n\nIMPORTANTE: Los auriculares (bluetooth, inalámbricos, con cable, headphones, earbuds, TWS) SIEMPRE van en 8518.30.00, NO en 8517.\n\nEjemplos:\n- auriculares bluetooth/TWS/inalámbricos → 8518.30.00\n- parlantes/altavoces → 8518.22.00\n- fundas de celular silicona → 3926.90.90\n- smartwatch → 8517.62.72\n- protector pantalla vidrio → 7007.19.00\n- cargador USB → 8504.40.90\n- zapatillas deportivas → 6404.11.00\n- power bank → 8507.60.00\n\nMercadería: ${description}` }] }],
      generationConfig: { maxOutputTokens: 50 }
    })
  });
  if (!r.ok) return null;
  const data = await r.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  const match = text.match(/\d{4}\.\d{2}\.\d{2}/);
  return match ? match[0] : null;
}

async function classifyWithOpenAI(description, apiKey) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 200,
      messages: [
        { role: "system", content: "Sos un despachante de aduana argentino experto en clasificación arancelaria NCM. El usuario importa productos desde China para reventa en Argentina. Cuando dice 'fundas de teléfono' se refiere a fundas protectoras de silicona/TPU para celulares (NCM 3926.90.90), NO a equipos de telecomunicaciones. Cuando dice 'auriculares' se refiere a auriculares de audio (NCM 8518.30.00), NO a equipos de telecom." },
        { role: "user", content: `¿Cuál es la NCM más común para importar "${description}" desde China? Pensá en qué clasificación usa la aduana argentina para este tipo de producto cuando se importa en cantidad para reventa. Respondé con el código NCM de 8 dígitos (XXXX.XX.XX) en la primera línea, y opcionalmente una breve explicación después.` }
      ]
    })
  });
  if (!r.ok) return null;
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  const match = text.match(/\d{4}\.\d{2}\.\d{2}/);
  return match ? match[0] : null;
}

// Manual overrides for products that AI consistently misclassifies
const OVERRIDES = [
  {keywords:["auricular","headphone","earphone","earbuds","earbud","tws","headset","auriculares"],ncm:"8518.30.00",desc:"Auriculares",die:35,te:3},
  {keywords:["parlante","altavoz","speaker","bocina","boombox"],ncm:"8518.22.00",desc:"Altavoces/Parlantes",die:35,te:3},
];

function checkOverride(description) {
  const lower = description.toLowerCase();
  for (const ov of OVERRIDES) {
    if (ov.keywords.some(k => lower.includes(k))) {
      return { ncm_code: ov.ncm, ncm_description: ov.desc, import_duty_rate: ov.die, statistics_rate: ov.te, iva_rate: 21, source: "override" };
    }
  }
  return null;
}

export async function POST(req) {
  try {
    const { description } = await req.json();
    if (!description) return Response.json({ error: "Description required" }, { status: 400 });

    // Check manual overrides first
    const override = checkOverride(description);
    if (override) return Response.json(override);

    let suggestedCode = null;

    // Try Gemini (free, no credit card needed)
    const geminiKey = process.env.GEMINI_API_KEY;
    console.log("API keys available:", { gemini: !!geminiKey, openai: !!process.env.OPENAI_API_KEY });
    if (geminiKey && !suggestedCode) {
      try {
        suggestedCode = await classifyWithGemini(description, geminiKey);
        console.log("Gemini result:", suggestedCode);
      } catch (e) { console.error("Gemini error:", e.message); }
    }

    // Fallback: OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && !suggestedCode) {
      try { suggestedCode = await classifyWithOpenAI(description, openaiKey); }
      catch (e) { console.error("OpenAI error:", e.message); }
    }

    // Look up in database
    if (suggestedCode) {
      const results = await searchDB(suggestedCode);
      if (results.length > 0) return Response.json(pickBest(results));
    }

    return Response.json({ error: "No se pudo clasificar la mercadería", fallback: true }, { status: 200 });

  } catch (e) {
    console.error("NCM route error:", e.message);
    return Response.json({ error: e.message, fallback: true }, { status: 200 });
  }
}
