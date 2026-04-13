const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

async function searchDB(ncmCode) {
  // Try exact match
  let r = await fetch(`${SB_URL}/rest/v1/ncm_database?ncm_code=eq.${ncmCode}&select=ncm_code,description,die,te&limit=5`, {
    headers: { apikey: SB_KEY }
  });
  let d = await r.json();
  if (Array.isArray(d) && d.length > 0) return d;

  // Try prefix XXXX.XX
  const prefix6 = ncmCode.substring(0, 7);
  r = await fetch(`${SB_URL}/rest/v1/ncm_database?ncm_code=like.${prefix6}*&select=ncm_code,description,die,te&limit=10`, {
    headers: { apikey: SB_KEY }
  });
  d = await r.json();
  if (Array.isArray(d) && d.length > 0) return d;

  // Try prefix XXXX
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

export async function POST(req) {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  try {
    const { description } = await req.json();
    if (!description) return Response.json({ error: "Description required" }, { status: 400 });

    let suggestedCode = null;
    const prompt = `Sos un despachante de aduana argentino. Clasificá esta mercadería en el NCM argentino (Nomenclatura Común del Mercosur, 8 dígitos formato XXXX.XX.XX). Respondé SOLO el código NCM, nada más.\n\nMercadería: ${description}`;

    // Try OpenAI first
    if (openaiKey && !suggestedCode) {
      try {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 50,
            messages: [{ role: "user", content: prompt }]
          })
        });
        if (r.ok) {
          const data = await r.json();
          const text = data.choices?.[0]?.message?.content?.trim() || "";
          const match = text.match(/\d{4}\.\d{2}\.\d{2}/);
          if (match) suggestedCode = match[0];
        }
      } catch (e) { console.error("OpenAI error:", e.message); }
    }

    // Fallback to Anthropic
    if (anthropicKey && !suggestedCode) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 50,
            messages: [{ role: "user", content: prompt }]
          })
        });
        if (r.ok) {
          const data = await r.json();
          const text = data.content?.[0]?.text?.trim() || "";
          const match = text.match(/\d{4}\.\d{2}\.\d{2}/);
          if (match) suggestedCode = match[0];
        }
      } catch (e) { console.error("Anthropic error:", e.message); }
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
