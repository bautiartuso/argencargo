// POST /api/kairo/food   (usuario de Kairo)
//   { text } → separa lo que escribiste ("200 g de pollo con una taza de arroz y 2 huevos") en
//              alimentos con cantidad, calorías y macros. Sonnet: es una extracción simple y barata.

import { callClaudeText } from "../../../../lib/anthropic";
import { kairoUser } from "../../../../lib/kairo-server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SYSTEM = `Sos un nutricionista que calcula macros de comidas argentinas comunes. Te pasan lo que alguien come, escrito en lenguaje natural, y devolvés cada alimento por separado con su cantidad y sus valores nutricionales para ESA cantidad.
Reglas:
- Si dice gramos, usá esos gramos. Si no, estimá una porción típica argentina y escribila (ej. "1 unidad (50 g)", "1 taza (160 g cocido)").
- Pollo, carne, arroz, fideos: si no aclara, asumí peso cocido.
- La proteína en polvo cuenta como alimento (1 scoop ≈ 30 g ≈ 24 g de proteína salvo que diga otra cosa).
- Valores realistas de tablas nutricionales (USDA / tablas argentinas). Redondeá: kcal a entero, macros a 1 decimal.
- Nombres cortos en castellano, con mayúscula inicial (ej. "Pechuga de pollo", "Arroz blanco", "Huevo").`;

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["nombre", "cantidad", "kcal", "proteina_g", "carbohidratos_g", "grasas_g"],
        properties: { nombre: { type: "string" }, cantidad: { type: "string" }, kcal: { type: "number" }, proteina_g: { type: "number" }, carbohidratos_g: { type: "number" }, grasas_g: { type: "number" } },
      },
    },
  },
};

export async function POST(req) {
  const me = await kairoUser(req);
  if (!me) return Response.json({ error: "No autorizado" }, { status: 401 });
  const { text } = await req.json().catch(() => ({}));
  const t = String(text || "").trim().slice(0, 600);
  if (!t) return Response.json({ error: "Escribí qué comiste" }, { status: 400 });
  try {
    const out = JSON.parse(await callClaudeText({ system: SYSTEM, user: t, max_tokens: 2000, json_schema: SCHEMA, model: "claude-sonnet-5-5", feature: "kairo-food-parse" }));
    return Response.json({ items: (out.items || []).map(i => ({ name: i.nombre, qty: i.cantidad, kcal: Math.round(i.kcal), protein_g: Math.round(i.proteina_g * 10) / 10, carbs_g: Math.round(i.carbohidratos_g * 10) / 10, fat_g: Math.round(i.grasas_g * 10) / 10 })) });
  } catch (e) {
    console.error("[kairo food]", e);
    return Response.json({ error: "No pude interpretarlo, probá escribirlo distinto" }, { status: 502 });
  }
}
