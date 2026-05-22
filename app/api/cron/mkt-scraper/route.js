// GET /api/cron/mkt-scraper
// Cron diario 8am AR (11 UTC). Scrappea las fuentes activas de mkt_sources y crea
// mkt_radar_items con los headlines nuevos. Sin IA, solo HTML parsing.
// Auth: Bearer CRON_SECRET.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 60;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) {
    console.error("sb error", path, r.status, await r.text());
    return null;
  }
  return r.json();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ").replace(/&Ntilde;/g, "Ñ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripTags(s) { return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }

// Ruido financiero / cotización de divisas — no aporta valor al radar aduanero,
// ensucia el feed con widgets de "Dólar HOY", cotizaciones, etc. Si el title matchea, descartamos.
function isFinanceNoise(title) {
  const t = String(title || "").toLowerCase();
  return /(d[oó]lar(?:\s|:|,|$)|tipo\s+de\s+cambio|cotizaci[oó]n\s+del?\s+d[oó]lar|compra:?\s*\$|venta:?\s*\$|d[oó]lar\s+(blue|mep|ccl|oficial|mayorista|tarjeta)|cotizar\s+divisas?)/.test(t);
}

function absUrl(href, base) {
  try { return new URL(href, base).toString(); } catch { return href; }
}

// Parser muy básico: extrae anchors con texto de longitud razonable.
// Para refinamiento por fuente, agregar selectores específicos en MKT_PARSERS abajo.
function extractGeneric(html, baseUrl) {
  const anchors = [...html.matchAll(/<a\s+[^>]*?href=["']([^"']+)["'][^>]*?>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  const out = [];
  for (const m of anchors) {
    const url = absUrl(m[1], baseUrl);
    const text = decodeEntities(stripTags(m[2]));
    if (text.length < 30 || text.length > 220) continue;
    if (/^(home|inicio|contacto|men[uú]|registrar|login|leer m[aá]s|m[aá]s informaci[oó]n|ver m[aá]s)/i.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: text, url });
    if (out.length >= 12) break;
  }
  return out;
}

// Selectores específicos por dominio (fallback al genérico si no matchea)
const MKT_PARSERS = {
  // Boletin Oficial — busca anchors dentro de section.norma
  "boletinoficial.gob.ar": (html, baseUrl) => {
    const matches = [...html.matchAll(/<a[^>]*href=["']([^"']*\/detalleAviso\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const out = [];
    const seen = new Set();
    for (const m of matches) {
      const url = absUrl(m[1], baseUrl);
      const title = decodeEntities(stripTags(m[2]));
      if (title.length < 25) continue;
      if (seen.has(title.toLowerCase())) continue;
      seen.add(title.toLowerCase());
      out.push({ title, url });
      if (out.length >= 10) break;
    }
    return out.length ? out : extractGeneric(html, baseUrl);
  },
};

function pickParser(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return MKT_PARSERS[host] || extractGeneric;
  } catch { return extractGeneric; }
}

async function fetchHtml(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Argencargo-MktBot/1.0; +https://www.argencargo.com.ar)",
        "Accept-Language": "es-AR,es;q=0.9",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch (e) {
    console.error("fetchHtml fail", url, e.message);
    return null;
  }
}

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET || ""}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const sources = await sb("/rest/v1/mkt_sources?enabled=eq.true&select=*&order=sort_order.asc");
  if (!sources) return new Response(JSON.stringify({ error: "sources fetch failed" }), { status: 500 });

  const existingTitles = await sb("/rest/v1/mkt_radar_items?select=title&order=discovered_at.desc&limit=500");
  const existingSet = new Set((existingTitles || []).map(r => String(r.title || "").toLowerCase().trim()));

  let totalNew = 0;
  const results = [];

  for (const src of sources) {
    const html = await fetchHtml(src.url);
    if (!html) { results.push({ source: src.name, status: "fetch_failed" }); continue; }
    const parser = pickParser(src.url);
    const items = parser(html, src.url);
    // Filtramos: nuevos + sin ruido financiero (cotizaciones de dólar, TC, etc.)
    const fresh = items.filter(it => !existingSet.has(it.title.toLowerCase().trim()) && !isFinanceNoise(it.title));
    if (fresh.length > 0) {
      const toInsert = fresh.slice(0, 6).map(it => ({
        source_id: src.id,
        source_name: src.name.split(" — ")[0].split("/")[0].trim(),
        title: it.title.slice(0, 320),
        url: it.url,
      }));
      const ins = await sb("/rest/v1/mkt_radar_items", { method: "POST", body: JSON.stringify(toInsert) });
      if (ins) {
        totalNew += toInsert.length;
        toInsert.forEach(t => existingSet.add(t.title.toLowerCase().trim()));
      }
    }
    await sb(`/rest/v1/mkt_sources?id=eq.${src.id}`, { method: "PATCH", body: JSON.stringify({ last_fetched_at: new Date().toISOString() }) });
    results.push({ source: src.name, found: items.length, new: fresh.length });
  }

  return new Response(JSON.stringify({ ok: true, totalNew, results }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
}
