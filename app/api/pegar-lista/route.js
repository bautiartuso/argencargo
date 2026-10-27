// POST /api/pegar-lista (28/10/2026) — interpreta con IA la lista que pega el admin en la calculadora
// (productos con cantidad y precio, bultos con medidas y peso), en cualquier formato: tabla de
// Excel, WhatsApp, PDF copiado, "30 unidades", "x30", "USD 9,00", precios totales, inglés/chino.
// Body: { texto } → { ok, productos:[{description,quantity,unit_price}], bultos:[{qty,length,width,height,weight}] }
import { callClaudeText, HAIKU_MODEL } from "../../../lib/anthropic";
import { limitar } from "../../../lib/ratelimit";

export const maxDuration = 60;
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

const SYSTEM = `Extraés productos y bultos de una lista pegada por un despachante argentino para cotizar una importación.

PRODUCTOS: description (tal cual, sin la cantidad ni el precio), quantity (unidades), unit_price (USD por unidad).
- La cantidad puede venir como "30 unidades", "30 u", "30 pcs", "x30", "30 pares", "qty 30", columna "Cantidad", etc.
- "set de 4 lámparas 8 unidades" → description "set de 4 lámparas", quantity 8 (el 4 es parte del producto).
- Si hay precio unitario y total, unit_price es el unitario. Si solo hay total y cantidad, unit_price = total / cantidad.
- Números con coma decimal argentina: "9,00" = 9; "1.250,50" = 1250.5; "1,250.50" = 1250.5.
- Ignorá encabezados, subtotales, totales, envío, impuestos y líneas sin producto.
- Si una línea no tiene precio, ponela con unit_price 0.

BULTOS: qty (cantidad de cajas iguales), length/width/height en cm, weight en kg POR CAJA.
- "60x40x40 12kg", "L60 W40 H40", "3 cajas de 50*40*30, 18 kg c/u". Si el peso es el total de varias cajas iguales, dividilo.
- mm → cm (÷10), m → cm (×100), pulgadas → cm (×2,54), lb → kg (×0,4536).
Si no hay bultos, bultos = []. Devolvé solo JSON.`;

const SCHEMA = {
  type: "object",
  properties: {
    productos: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unit_price: { type: "number" } }, required: ["description", "quantity", "unit_price"], additionalProperties: false } },
    bultos: { type: "array", items: { type: "object", properties: { qty: { type: "number" }, length: { type: "number" }, width: { type: "number" }, height: { type: "number" }, weight: { type: ["number", "null"] } }, required: ["qty", "length", "width", "height", "weight"], additionalProperties: false } },
  },
  required: ["productos", "bultos"],
  additionalProperties: false,
};

export async function POST(req) {
  const frenado = limitar(req, { clave: "pegar-lista", limite: 30 }); if (frenado) return frenado;
  try {
    const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const u = tok ? await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
    if (!u?.id) return Response.json({ ok: false, error: "no_auth" }, { status: 401 });
    const { texto } = await req.json();
    const t = String(texto || "").trim();
    if (!t) return Response.json({ ok: true, productos: [], bultos: [] });
    if (t.length > 20000) return Response.json({ ok: false, error: "texto muy largo" }, { status: 400 });
    const out = await callClaudeText({ model: HAIKU_MODEL, system: SYSTEM, user: t, max_tokens: 4000, json_schema: SCHEMA, feature: "pegar-lista" });
    const d = JSON.parse(String(out).replace(/```json\s*|\s*```/g, "").trim());
    const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const productos = (Array.isArray(d.productos) ? d.productos : []).map((p) => ({ description: String(p.description || "").trim(), quantity: Math.max(1, Math.round(num(p.quantity)) || 1), unit_price: Math.max(0, num(p.unit_price)) })).filter((p) => p.description);
    const bultos = (Array.isArray(d.bultos) ? d.bultos : []).map((b) => ({ qty: Math.max(1, Math.round(num(b.qty)) || 1), length: num(b.length), width: num(b.width), height: num(b.height), weight: b.weight == null ? "" : num(b.weight) })).filter((b) => b.length > 0 && b.width > 0 && b.height > 0);
    return Response.json({ ok: true, productos, bultos });
  } catch (e) {
    console.error("pegar-lista", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
