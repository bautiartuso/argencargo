// Lectura pública del catálogo desde el servidor (vistas con RLS abierta: sin precios ni proveedor).
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const get = async (path, revalidate = 120) => { try { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY }, next: { revalidate } }); const d = await r.json(); return Array.isArray(d) ? d : []; } catch { return []; } };

export async function categorias() {
  const cats = await get("cat_categorias?select=slug,nombre,padre_slug,orden&order=orden.asc,nombre.asc", 600);
  const arbol = cats.filter((c) => !c.padre_slug).map((c) => ({ ...c, subs: cats.filter((s) => s.padre_slug === c.slug) }));
  return { cats, arbol };
}
export const maquinas = (filtro = "") => get(`cat_maquinas_publicas?select=id,numero,nombre,descripcion,categoria,subcategoria,condicion,garantia_meses,fotos,video_url,dias_produccion,moq,vias,publicado_at&order=publicado_at.desc${filtro}`);
export const maquina = async (id) => (await get(`cat_maquinas_publicas?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, 60))[0] || null;
export async function ajustes() {
  const rows = await get("cat_ajustes?select=clave,valor&clave=in.(dias_via,negocio)", 600);
  const o = {}; rows.forEach((r) => { o[r.clave] = r.valor; });
  return { dias_via: o.dias_via || { aereo: 10, maritimo_lcl: 60, maritimo_integral: 60 }, negocio: o.negocio || {} };
}
// Cuántas operaciones lleva Argencargo (dato real para la landing). Solo con service role.
export async function operacionesArgencargo() {
  const key = process.env.SUPABASE_SERVICE_ROLE; if (!key) return null;
  try { const r = await fetch(`${SB_URL}/rest/v1/operations?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", "Range-Unit": "items", Range: "0-0" }, next: { revalidate: 3600 } }); const cr = r.headers.get("content-range") || ""; const t = Number(cr.split("/")[1]); return Number.isFinite(t) ? t : null; } catch { return null; }
}
