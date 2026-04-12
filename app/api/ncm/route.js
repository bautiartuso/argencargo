const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    const { description } = await req.json();
    if (!description) return Response.json({ error: "Description required" }, { status: 400 });

    // Step 1: Use AI to suggest NCM code
    let suggestedCode = null;
    if (apiKey) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 100,
            messages: [{ role: "user", content: `Clasificá esta mercadería en el NCM argentino (8 dígitos). Respondé SOLO el código, nada más. Ejemplo: 8518.30.00\n\nMercadería: ${description}` }]
          })
        });
        if (r.ok) {
          const data = await r.json();
          const text = data.content?.[0]?.text?.trim() || "";
          const match = text.match(/\d{4}\.\d{2}\.\d{2}/);
          if (match) suggestedCode = match[0];
        }
      } catch {}
    }

    // Step 2: Search our database for the NCM code (or by description)
    let results = [];

    if (suggestedCode) {
      // Try exact match first
      const r1 = await fetch(`${SB_URL}/rest/v1/ncm_database?ncm_code=eq.${suggestedCode}&select=ncm_code,description,die,te&limit=5`, {
        headers: { apikey: SB_KEY }
      });
      const d1 = await r1.json();
      if (Array.isArray(d1) && d1.length > 0) results = d1;

      // If no exact match, try prefix (e.g., 8517.62 instead of 8517.62.72)
      if (!results.length) {
        const prefix = suggestedCode.substring(0, 7); // XXXX.XX
        const r2 = await fetch(`${SB_URL}/rest/v1/ncm_database?ncm_code=like.${prefix}*&select=ncm_code,description,die,te&limit=10`, {
          headers: { apikey: SB_KEY }
        });
        const d2 = await r2.json();
        if (Array.isArray(d2) && d2.length > 0) results = d2;
      }
    }

    // Step 3: If AI didn't work or no DB match, try text search with each word separately
    if (!results.length) {
      const words = description.split(/\s+/).filter(w => w.length > 2);
      for (const word of words) {
        const r3 = await fetch(`${SB_URL}/rest/v1/ncm_database?description=ilike.*${encodeURIComponent(word)}*&select=ncm_code,description,die,te&limit=10`, {
          headers: { apikey: SB_KEY }
        });
        const d3 = await r3.json();
        if (Array.isArray(d3) && d3.length > 0) { results = d3; break; }
      }
    }

    // Step 4: Return results
    if (results.length > 0) {
      // Pick first result, deduplicate by ncm_code and take the one with highest DIE (most specific)
      const byCode = {};
      results.forEach(r => {
        if (!byCode[r.ncm_code] || r.die > byCode[r.ncm_code].die) byCode[r.ncm_code] = r;
      });
      const best = Object.values(byCode)[0];
      return Response.json({
        ncm_code: best.ncm_code,
        ncm_description: best.description,
        import_duty_rate: best.die,
        statistics_rate: Math.min(best.te, 3),
        iva_rate: 21,
        source: "database",
        alternatives: Object.values(byCode).slice(1, 5).map(r => ({
          ncm_code: r.ncm_code,
          description: r.description,
          die: r.die,
          te: r.te
        }))
      });
    }

    // No results found
    return Response.json({ error: "No se pudo clasificar la mercadería", fallback: true }, { status: 200 });

  } catch (e) {
    console.error("NCM route error:", e.message);
    return Response.json({ error: e.message, fallback: true }, { status: 200 });
  }
}
