// GET /api/kairo/off?code=7790...        → un producto por código de barras (Open Food Facts)
// GET /api/kairo/off?q=creatina&type=supp → búsqueda por nombre o marca (type: food | supp)
// Open Food Facts es una base abierta de millones de productos (comida y suplementos) con sus
// etiquetas. Pasamos por el servidor para poner el User-Agent que piden y normalizar los campos.
import { kairoUser } from "../../../../lib/kairo-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const OFF = "https://world.openfoodfacts.org", SEARCH = "https://search.openfoodfacts.org";
const FIELDS = "code,product_name,product_name_es,brands,quantity,serving_size,serving_quantity,nutriments,categories_tags,image_front_small_url";
const headers = { "User-Agent": "Kairo/1.0 (www.argencargo.com.ar/kairo)" };
const num = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 10) / 10);

function normalize(p) {
  if (!p?.code) return null;
  const n = p.nutriments || {};
  const name = (p.product_name_es || p.product_name || "").trim();
  if (!name) return null;
  return {
    code: p.code, name, brand: (Array.isArray(p.brands) ? p.brands[0] : String(p.brands || "").split(",")[0] || "").trim() || null, quantity: p.quantity || null,
    serving: p.serving_size || null, serving_g: num(p.serving_quantity),
    per100: { kcal: num(n["energy-kcal_100g"] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null)), p: num(n.proteins_100g), c: num(n.carbohydrates_100g), g: num(n.fat_100g) },
    supp: (p.categories_tags || []).some(t => /supplement|suplemento|complement/i.test(t)),
    image: p.image_front_small_url || null,
  };
}

export async function GET(req) {
  const me = await kairoUser(req);
  if (!me) return Response.json({ error: "No autorizado" }, { status: 401 });
  const u = new URL(req.url), code = (u.searchParams.get("code") || "").replace(/\D/g, ""), q = (u.searchParams.get("q") || "").trim().slice(0, 80), type = u.searchParams.get("type") || "food";
  try {
    if (code) {
      const r = await fetch(`${OFF}/api/v2/product/${code}.json?fields=${FIELDS}`, { headers, next: { revalidate: 86400 } }).then(r => r.json());
      const prod = r?.status === 1 ? normalize(r.product) : null;
      return Response.json({ product: prod, error: prod ? null : "No encontré ese código en Open Food Facts" });
    }
    if (q.length >= 2) {
      // Buscador nuevo de Open Food Facts (el viejo cgi/search.pl ya no responde seguido).
      const search = (term) => fetch(`${SEARCH}/search?q=${encodeURIComponent(term)}&page_size=15&langs=es,en&fields=${FIELDS}`, { headers, next: { revalidate: 3600 } }).then(r => r.json()).then(r => (r?.hits || []).map(normalize).filter(Boolean));
      let list = await search(type === "supp" ? `${q} categories_tags:"en:dietary-supplements"` : q);
      if (type === "supp" && !list.length) list = await search(q); // muchos suplementos están sin categoría
      if (type === "supp") list.sort((a, b) => Number(b.supp) - Number(a.supp));
      return Response.json({ products: list });
    }
    return Response.json({ error: "Falta qué buscar" }, { status: 400 });
  } catch (e) {
    console.error("[kairo off]", e);
    return Response.json({ error: "Open Food Facts no respondió, probá de nuevo" }, { status: 502 });
  }
}
