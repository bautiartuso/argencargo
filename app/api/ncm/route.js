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
  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    const { description } = await req.json();
    if (!description) return Response.json({ error: "Description required" }, { status: 400 });

    // PRIORITY 1: Use AI to get NCM code, then look up real rates in our database
    if (apiKey) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 100,
            messages: [{ role: "user", content: `Sos un despachante de aduana argentino. Clasificá esta mercadería en el NCM argentino (Nomenclatura Común del Mercosur, 8 dígitos formato XXXX.XX.XX). Respondé SOLO el código NCM, nada más.\n\nMercadería: ${description}` }]
          })
        });
        if (r.ok) {
          const data = await r.json();
          const text = data.content?.[0]?.text?.trim() || "";
          const match = text.match(/\d{4}\.\d{2}\.\d{2}/);
          if (match) {
            const results = await searchDB(match[0]);
            if (results.length > 0) return Response.json(pickBest(results));
          }
        }
      } catch (e) {
        console.error("AI error:", e.message);
      }
    }

    // PRIORITY 2: No AI or AI+DB didn't match — return fallback
    // Don't try text search because it's unreliable (e.g., "fundas" matches wrong category)
    return Response.json({ error: "No se pudo clasificar la mercadería", fallback: true }, { status: 200 });

  } catch (e) {
    console.error("NCM route error:", e.message);
    return Response.json({ error: e.message, fallback: true }, { status: 200 });
  }
}
