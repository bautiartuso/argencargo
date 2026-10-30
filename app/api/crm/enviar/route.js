// POST /api/crm/enviar {contact_id, text} — mandar un mensaje desde el CRM por la Cloud API.
// Apagado por defecto (crm_numbers.send_enabled): Bautista contesta desde el celu. Si se enciende:
//   · solo dentro de las 24 h del último mensaje del cliente (fuera de eso Meta exige plantilla paga: no)
//   · tope mensual (send_cap, 950) para no pasar las 1.000 respuestas gratis por número
// Devuelve {ok} o {error, motivo: "apagado" | "ventana" | "tope"} para que la pantalla ofrezca el celu.
import { usuarioConRol } from "../../../../lib/auth-server";
import { GRAPH_CRM } from "../../../../lib/crm-wa";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const sbh = (extra = {}) => { const k = process.env.SUPABASE_SERVICE_ROLE; return { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", ...extra }; };
const sb = (p, o = {}) => fetch(`${SB_URL}/rest/v1${p}`, { ...o, headers: sbh(o.headers || {}), cache: "no-store" });

export async function POST(req) {
  const u = await usuarioConRol(req, ["admin", "empleado"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const text = String(b.text || "").trim().slice(0, 4000);
  if (!b.contact_id || !text) return Response.json({ error: "Faltan contact_id o text" }, { status: 400 });

  const [num, con] = await Promise.all([
    sb(`/crm_numbers?select=phone_number_id,token,send_enabled,send_month,send_count,send_cap&status=eq.conectado&token=not.is.null&order=connected_at.desc&limit=1`).then((r) => r.json()).then((r) => r?.[0] || null),
    sb(`/crm_contacts?id=eq.${encodeURIComponent(b.contact_id)}&select=id,phone,last_in_at,stage,stage_manual`).then((r) => r.json()).then((r) => r?.[0] || null),
  ]);
  if (!num) return Response.json({ error: "El número no está conectado", motivo: "apagado" }, { status: 409 });
  if (!con) return Response.json({ error: "Contacto inexistente" }, { status: 404 });
  if (!num.send_enabled) return Response.json({ error: "El envío desde el sistema está apagado", motivo: "apagado" }, { status: 409 });
  if (!con.last_in_at || Date.now() - new Date(con.last_in_at).getTime() > 24 * 3600e3) return Response.json({ error: "Pasaron más de 24 h del último mensaje del cliente", motivo: "ventana" }, { status: 409 });
  const mes = new Date().toISOString().slice(0, 7);
  const usados = num.send_month === mes ? num.send_count : 0;
  if (usados >= num.send_cap) return Response.json({ error: `Se llegó al tope de ${num.send_cap} mensajes de este mes`, motivo: "tope" }, { status: 409 });

  const r = await fetch(`${GRAPH_CRM}/${num.phone_number_id}/messages`, { method: "POST", headers: { Authorization: `Bearer ${num.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: con.phone, type: "text", text: { body: text } }) });
  const d = await r.json().catch(() => null);
  if (!r.ok) return Response.json({ error: d?.error?.message || `Meta devolvió ${r.status}` }, { status: 502 });
  const ts = new Date().toISOString();
  const wamid = d?.messages?.[0]?.id || null;
  await Promise.all([
    sb(`/crm_messages`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ contact_id: con.id, phone: con.phone, wamid, direction: "out", via: "api", type: "text", text, ts, status: "sent" }) }),
    sb(`/crm_contacts?id=eq.${con.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_out_at: ts, last_msg_at: ts, last_preview: text.slice(0, 160), last_direction: "out", unread: 0, seen_at: ts, updated_at: ts, ...(con.stage === "nuevo" && !con.stage_manual ? { stage: "hablando", stage_at: ts } : {}) }) }),
    sb(`/crm_numbers?phone_number_id=eq.${num.phone_number_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ send_month: mes, send_count: usados + 1, updated_at: ts }) }),
  ]);
  return Response.json({ ok: true, wamid, usados: usados + 1, tope: num.send_cap });
}
