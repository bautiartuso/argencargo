// /api/cron/crm-resumen — mantenimiento del CRM cada 30 minutos:
//   · resume con Claude (Haiku) las charlas que quedaron quietas 2 h y tienen mensajes nuevos desde el
//     último resumen: dos líneas (qué hablaron / qué quedó pendiente) en crm_contacts.summary/pending
//   · corre crm_sync_etapas() (vincula fichas a clientes por teléfono y pone las etapas automáticas)
// POST {contact_id} con token de admin/empleado → resume ese contacto ahora (botón de la ficha).
import { esCronValido, usuarioConRol } from "../../../../lib/auth-server";
import { callClaudeText, HAIKU_MODEL } from "../../../../lib/anthropic";

export const maxDuration = 120;
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const sbh = (extra = {}) => { const k = process.env.SUPABASE_SERVICE_ROLE; return { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", ...extra }; };
const sb = (p, o = {}) => fetch(`${SB_URL}/rest/v1${p}`, { ...o, headers: sbh(o.headers || {}), cache: "no-store" });
const VISTA = { image: "[foto]", video: "[video]", audio: "[audio]", document: "[documento]", sticker: "[sticker]", location: "[ubicación]", contacts: "[contacto]", media_placeholder: "[adjunto]", reaction: "[reacción]" };
const SCHEMA = { type: "object", additionalProperties: false, required: ["summary", "pending"], properties: { summary: { type: "string" }, pending: { type: ["string", "null"] } } };
const SYSTEM = `Sos el asistente comercial de Argencargo, una empresa argentina que importa desde China (courier aéreo y marítimo) para clientes de todo el país.
Te paso una charla de WhatsApp entre Argencargo y un cliente o posible cliente. Devolvé:
- summary: en castellano rioplatense, 1 o 2 frases cortas con lo que quiere el cliente y qué se habló (producto, cantidad, canal, precio, dudas). Sin saludos ni relleno.
- pending: qué quedó pendiente y de quién (ej. "Argencargo tiene que pasarle la cotización", "El cliente va a mandar el link del producto"), o null si no quedó nada.
Si hay un resumen anterior, integralo con lo nuevo en vez de repetirlo.`;

const fecha = (ts) => { const d = new Date(ts); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

async function resumir(contactId) {
  const c = await sb(`/crm_contacts?id=eq.${contactId}&select=id,name,wa_name,summary,summary_at,last_msg_at`).then((r) => r.json()).then((r) => r?.[0] || null);
  if (!c) return { error: "Contacto inexistente" };
  const desde = c.summary_at ? `&ts=gt.${encodeURIComponent(c.summary_at)}` : "";
  const nuevos = await sb(`/crm_messages?contact_id=eq.${contactId}&deleted=is.false&select=direction,type,text,ts&order=ts.desc&limit=80${desde}`).then((r) => r.json()).catch(() => []);
  if (!Array.isArray(nuevos) || !nuevos.length) return { ok: true, summary: c.summary, pending: null, sin_cambios: true };
  const lineas = [...nuevos].reverse().map((m) => `[${fecha(m.ts)}] ${m.direction === "out" ? "Argencargo" : "Cliente"}: ${m.text || VISTA[m.type] || `[${m.type}]`}`);
  const user = `${c.summary ? `Resumen anterior: ${c.summary}\n\n` : ""}Contacto: ${c.name || c.wa_name || "sin nombre"}\n\nCharla:\n${lineas.join("\n")}`;
  const out = await callClaudeText({ model: HAIKU_MODEL, system: SYSTEM, user, max_tokens: 400, json_schema: SCHEMA, feature: "crm-resumen" });
  let d; try { d = JSON.parse(String(out).replace(/```json\s*|\s*```/g, "").trim()); } catch { return { error: "Claude no devolvió un resumen válido" }; }
  const summary = String(d.summary || "").trim().slice(0, 600); const pending = d.pending ? String(d.pending).trim().slice(0, 300) : null;
  if (!summary) return { error: "Resumen vacío" };
  const summary_at = new Date().toISOString();
  await sb(`/crm_contacts?id=eq.${contactId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ summary, pending, summary_at, updated_at: summary_at }) });
  return { ok: true, summary, pending, summary_at };
}

export async function GET(req) {
  if (!esCronValido(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  let etapas = null;
  try { const r = await sb(`/rpc/crm_sync_etapas`, { method: "POST", body: "{}" }); etapas = await r.json().catch(() => null); } catch (e) { console.error("[crm-resumen] etapas", e.message); }
  const quietas = new Date(Date.now() - 2 * 3600e3).toISOString();
  const pendientes = await sb(`/crm_contacts?select=id,summary_at,last_msg_at&last_msg_at=lt.${encodeURIComponent(quietas)}&or=(summary_at.is.null,summary_at.lt.last_msg_at)&order=last_msg_at.desc&limit=15`).then((r) => r.json()).catch(() => []);
  // PostgREST no compara dos columnas en el filtro: se filtra acá.
  const lista = (Array.isArray(pendientes) ? pendientes : []).filter((c) => !c.summary_at || c.summary_at < c.last_msg_at);
  let hechos = 0;
  for (const c of lista) { try { const r = await resumir(c.id); if (r.ok && !r.sin_cambios) hechos++; } catch (e) { console.error("[crm-resumen]", c.id, e.message); } }
  return Response.json({ ok: true, etapas, candidatos: lista.length, resumidos: hechos });
}

export async function POST(req) {
  const u = await usuarioConRol(req, ["admin", "empleado"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.contact_id) return Response.json({ error: "Falta contact_id" }, { status: 400 });
  try { const r = await resumir(b.contact_id); return Response.json(r, { status: r.error ? 500 : 200 }); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
