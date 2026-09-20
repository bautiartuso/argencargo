// POST /api/catalogo/ia
// A partir de lo que el empleado copia del proveedor (nombre crudo, modelo, specs y un texto
// suyo) devuelve la ficha comercial: nombre completo con código, categoría y subcategoría de
// la lista cerrada, descripción en castellano y los datos técnicos que se puedan leer.
// Usa el modelo barato: es redacción, no clasificación aduanera (eso sigue en /api/ncm).

import { callClaudeText, HAIKU_MODEL } from "../../../../lib/anthropic";

export const maxDuration = 30;

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

// Solo el equipo puede gastar créditos acá: admin, empleado o socio GI.
async function puedeEditar(token) {
  if (!token) return false;
  try {
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } });
    if (!u.ok) return false;
    const { id } = await u.json();
    const p = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${id}&select=role,is_gi_partner`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } });
    const rows = await p.json();
    const prof = Array.isArray(rows) ? rows[0] : null;
    return !!prof && (["admin", "empleado"].includes(prof.role) || prof.is_gi_partner === true);
  } catch { return false; }
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["nombre", "categoria", "subcategoria", "descripcion"],
  properties: {
    nombre:       { type: "string", description: "Nombre comercial completo en castellano: tipo de máquina + característica que la define + código de modelo al final, separado por ' · '. Ej: 'Escuadradora de 3.200 mm con incisor · MJ6132TD'" },
    categoria:    { type: "string", description: "slug exacto de una categoría de la lista" },
    subcategoria: { type: "string", description: "slug exacto de una subcategoría de esa categoría" },
    descripcion:  { type: "string", description: "Descripción comercial en castellano rioplatense, 3 a 5 párrafos cortos separados por línea en blanco. Tiene que incluir la capacidad o producción y qué viene incluido cuando figuren en el material. Sin inventar datos." },
  },
};

const SYSTEM = `Sos el redactor del catálogo de maquinaria de un importador argentino. Recibís lo que un proveedor chino le pasó al equipo (nombre crudo, modelo, especificaciones copiadas y un texto del empleado) y devolvés la ficha comercial en castellano rioplatense.

Reglas:
- El nombre tiene que decir qué máquina es y qué la distingue (tamaño, capacidad, tecnología), y terminar con el código de modelo exactamente como lo pasó el proveedor, separado por " · ". Nunca un nombre genérico como "Escuadradora" o "Máquina de helados".
- Categoría y subcategoría: elegí solo entre los slugs de la lista que te paso. Si nada encaja, usá "otros" / "otros-otros".
- La descripción es para un comprador que quiere la máquina para su negocio, no para un técnico: qué hace, para quién es, qué la hace conveniente, y los datos técnicos importantes. Dedicá un párrafo a la capacidad o producción (piezas por hora, litros, tamaño máximo de trabajo, potencia) y otro a qué viene incluido (accesorios, repuestos, manual), siempre que figuren en el material. Todas las máquinas se entregan en 220 V, no hace falta aclararlo. No inventes números ni prestaciones que no estén en el material. No menciones al proveedor, a China ni precios.`;

export async function POST(req) {
  try {
    const token = String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!(await puedeEditar(token))) return Response.json({ error: "No autorizado" }, { status: 401 });
    const b = await req.json();
    const cats = Array.isArray(b.categorias) ? b.categorias : [];
    if (!String(b.nombre_raw || b.specs_raw || b.descripcion_raw || "").trim()) return Response.json({ error: "Falta el material del proveedor" }, { status: 400 });
    const lista = cats.map((c) => `- ${c.slug} (${c.nombre}): ${(c.subs || []).map((s) => `${s.slug} (${s.nombre})`).join(", ")}`).join("\n");
    const user = `Categorías disponibles (slug (nombre)):\n${lista}\n\nNombre crudo del proveedor: ${b.nombre_raw || "—"}\nModelo / código: ${b.modelo || "—"}\nCondición: ${b.condicion === "usada" ? "usada" : "nueva"}\nEspecificaciones copiadas:\n${b.specs_raw || "—"}\n\nTexto del empleado sobre la máquina:\n${b.descripcion_raw || "—"}`;
    const txt = await callClaudeText({ system: SYSTEM, user, max_tokens: 1500, json_schema: SCHEMA, model: HAIKU_MODEL, feature: "catalogo_ia" });
    let out;
    try { out = JSON.parse(txt); } catch { return Response.json({ error: "La IA no devolvió un JSON válido" }, { status: 502 }); }
    // Que los slugs existan de verdad: si la IA inventa uno, cae en "otros".
    const cat = cats.find((c) => c.slug === out.categoria);
    if (!cat) { out.categoria = "otros"; out.subcategoria = "otros-otros"; }
    else if (!(cat.subs || []).some((s) => s.slug === out.subcategoria)) out.subcategoria = (cat.subs || [])[0]?.slug || "otros-otros";
    return Response.json(out);
  } catch (e) {
    console.error("[catalogo/ia]", e);
    return Response.json({ error: e.message || "Error" }, { status: 500 });
  }
}
