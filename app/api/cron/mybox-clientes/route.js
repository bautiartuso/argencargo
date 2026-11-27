// /api/cron/mybox-clientes — quiénes son clientes de MyBox (27/11/2026). Los que operan u operaron
// con MyBox no entran en el Seguimiento del CRM de Argencargo, aunque antes hayan sido clientes de
// acá. MyBox vive en otro proyecto de Supabase: esto trae a los clientes de allá con al menos una
// operación o una carga marítima y deja teléfono (últimos 10 dígitos) y mail en crm_mybox_clientes,
// que es contra lo que cruza la vista crm_personas_v (columna es_mybox). Solo agrega y actualiza:
// quien operó alguna vez con MyBox queda afuera para siempre.
// GET con CRON_SECRET (cada 6 horas) · POST con token de admin (para correrlo en el momento).
// Necesita MYBOX_SUPABASE_SERVICE_ROLE (la misma clave que usa el puente de las cuentas corrientes).
import { esCronValido, usuarioConRol } from "../../../../lib/auth-server";
import { ac, mb, hayMyBox } from "../../../../lib/reparto";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// PostgREST corta en 1000 filas: se pagina.
async function todo(tabla, select) {
  const out = [];
  for (let desde = 0; desde < 50000; desde += 1000) {
    const r = await mb(`/${tabla}?select=${select}&order=id.asc&offset=${desde}&limit=1000`);
    if (!r.ok || !Array.isArray(r.body)) throw new Error(`MyBox no respondió (${tabla}, ${r.status})`);
    out.push(...r.body);
    if (r.body.length < 1000) break;
  }
  return out;
}

async function sincronizar() {
  if (!hayMyBox()) return { error: "Falta MYBOX_SUPABASE_SERVICE_ROLE" };
  const [ops, mar, clientes] = await Promise.all([todo("operations", "id,client_id"), todo("maritime_shipments", "id,client_id"), todo("clients", "id,first_name,last_name,phone,email")]);
  const cuenta = {};
  for (const o of [...ops, ...mar]) if (o.client_id) cuenta[o.client_id] = (cuenta[o.client_id] || 0) + 1;
  const ahora = new Date().toISOString();
  const filas = clientes.filter((c) => cuenta[c.id]).map((c) => {
    const tel = String(c.phone || "").replace(/\D/g, "");
    return { mybox_id: c.id, tel10: tel.length >= 10 ? tel.slice(-10) : null, email: String(c.email || "").trim().toLowerCase() || null, nombre: [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || null, operaciones: cuenta[c.id], updated_at: ahora };
  }).filter((f) => f.tel10 || f.email);
  for (let i = 0; i < filas.length; i += 500) {
    const r = await ac(`/crm_mybox_clientes?on_conflict=mybox_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(filas.slice(i, i + 500)) });
    if (!r.ok) return { error: `No se pudo guardar (${r.status})` };
  }
  return { ok: true, clientes_mybox: filas.length };
}

async function correr() {
  try { const r = await sincronizar(); if (r.error) console.error("[mybox-clientes]", r.error); return Response.json(r, { status: r.error ? 500 : 200 }); }
  catch (e) { console.error("[mybox-clientes]", e?.message || e); return Response.json({ error: String(e?.message || e) }, { status: 500 }); }
}

export async function GET(req) {
  if (!esCronValido(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  return correr();
}
export async function POST(req) {
  const u = await usuarioConRol(req, ["admin"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  return correr();
}
