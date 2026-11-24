// /api/crm/ia — el saludo automático de la IA, visto desde las pantallas del CRM.
//   GET  (admin/empleado) → cómo está: encendida o no, tope por día, cuántos salieron hoy, cuánta gente
//        hay en la fila, estado de la plantilla en Meta y qué pasó con los saludos mandados.
//   POST (admin) {accion:"config", activa, por_dia}  → encender / apagar y cambiar el tope
//        (admin) {accion:"plantilla"}                → crear la plantilla del saludo en Meta
import { usuarioConRol } from "../../../../lib/auth-server";
import { tokenVigente } from "../../../../lib/crm-wa";
import { numeroCrm, estadoPlantilla, crearPlantilla, enviadosHoy, textoSaludo } from "../../../../lib/crm-ia";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const sbh = (extra = {}) => { const k = process.env.SUPABASE_SERVICE_ROLE; return { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", ...extra }; };
const contar = async (path) => { const r = await fetch(`${SB_URL}/rest/v1${path}`, { headers: sbh({ Prefer: "count=exact", Range: "0-0" }), cache: "no-store" }); return Number((r.headers.get("content-range") || "").split("/")[1] || 0); };

async function estado() {
  const num = await numeroCrm();
  if (!num) return { conectado: false, activa: false, por_dia: 10, hoy: 0, en_fila: 0, enviados: 0, respondieron: 0, plantilla: null, texto: textoSaludo("Martín") };
  const token = await tokenVigente(num);
  const [pl, hoy, enFila, enviados, respondieron] = await Promise.all([
    estadoPlantilla(num, token), enviadosHoy(),
    contar(`/crm_personas_v?ia_apto=is.true&select=clave`),
    contar(`/crm_ia_envios?estado=neq.fallo&select=id`),
    contar(`/crm_ia_envios?estado=eq.respondio&select=id`),
  ]);
  return { conectado: true, activa: !!num.ia_enabled, por_dia: num.ia_por_dia, hoy, en_fila: enFila, enviados, respondieron, plantilla: pl?.estado || null, categoria: pl?.categoria || null, texto: textoSaludo("Martín") };
}

export async function GET(req) {
  const u = await usuarioConRol(req, ["admin", "empleado"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  return Response.json(await estado());
}

export async function POST(req) {
  const u = await usuarioConRol(req, ["admin"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const num = await numeroCrm();
  if (!num) return Response.json({ error: "El número no está conectado" }, { status: 409 });
  const token = await tokenVigente(num);
  if (b.accion === "plantilla") {
    if (!token) return Response.json({ error: "Ningún token sirve para el número" }, { status: 409 });
    const ya = await estadoPlantilla(num, token);
    if (ya) return Response.json({ ok: true, ...(await estado()) });
    const r = await crearPlantilla(num, token);
    if (r.error) return Response.json({ error: r.error }, { status: 502 });
    return Response.json({ ok: true, ...(await estado()) });
  }
  if (b.accion === "config") {
    const patch = { updated_at: new Date().toISOString() };
    if (b.por_dia != null) patch.ia_por_dia = Math.max(1, Math.min(50, Math.round(Number(b.por_dia) || 10)));
    if (b.activa != null) {
      if (b.activa) { const pl = await estadoPlantilla(num, token); if (pl?.estado !== "APPROVED") return Response.json({ error: pl ? "Meta todavía no aprobó la plantilla del saludo" : "Primero hay que crear la plantilla del saludo" }, { status: 409 }); }
      patch.ia_enabled = !!b.activa;
    }
    const r = await fetch(`${SB_URL}/rest/v1/crm_numbers?phone_number_id=eq.${encodeURIComponent(num.phone_number_id)}`, { method: "PATCH", headers: sbh({ Prefer: "return=minimal" }), body: JSON.stringify(patch) });
    if (!r.ok) return Response.json({ error: "No se pudo guardar" }, { status: 500 });
    return Response.json({ ok: true, ...(await estado()) });
  }
  return Response.json({ error: "Acción desconocida" }, { status: 400 });
}
