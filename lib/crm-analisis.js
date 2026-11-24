// lib/crm-analisis.js — el análisis comercial de una persona (23/11/2026). Junta todo lo que se sabe
// (qué importó, qué cotizó, qué se habló por WhatsApp, qué contactos de seguimiento hubo) y le pide a
// Claude una lectura: qué tan caliente está, en qué quedó, qué conviene hacer y qué mensaje mandarle.
// El resultado va a crm_analisis y lo muestran Contactos, Seguimiento y la ficha del chat.
// Solo servidor. Lo llaman /api/cron/crm-analisis (de a tandas) y el botón "Analizar de nuevo".
import { callClaudeText, HAIKU_MODEL } from "./anthropic";
import { apodoDe } from "./apodos";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const sbh = (extra = {}) => { const k = process.env.SUPABASE_SERVICE_ROLE; return { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", ...extra }; };
const sb = (p, o = {}) => fetch(`${SB_URL}/rest/v1${p}`, { ...o, headers: sbh(o.headers || {}), cache: "no-store" });
const leer = (p) => sb(p).then((r) => r.json()).then((r) => (Array.isArray(r) ? r : [])).catch(() => []);

const VISTA = { image: "[foto]", video: "[video]", audio: "[audio]", document: "[documento]", sticker: "[sticker]", location: "[ubicación]", contacts: "[contacto]", media_placeholder: "[adjunto]" };
const CANAL = { aereo_blanco: "aéreo courier (formal)", aereo_negro: "aéreo courier", maritimo_blanco: "marítimo LCL/FCL", maritimo_negro: "marítimo" };
const FISCAL = { responsable_inscripto: "responsable inscripto", monotributista: "monotributista", monotributo: "monotributista", ninguna: "consumidor final", consumidor_final: "consumidor final" };
const OUTCOME = { enviado: "se le escribió", sin_respuesta: "no respondió", respondio: "respondió", va_a_importar: "dijo que va a importar", mas_adelante: "dijo que más adelante", no_interesado: "dijo que no le interesa", nota: "nota" };
const dia = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
const diaHora = (iso) => { const d = new Date(new Date(iso).getTime() - 3 * 3600e3); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const hace = (iso) => { if (!iso) return ""; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5); return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`; };
const usd = (v) => `USD ${Math.round(Number(v || 0)).toLocaleString("es-AR")}`;

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["temperatura", "lectura", "siguiente", "basico", "mensaje", "no_cliente"],
  properties: {
    temperatura: { type: "string", enum: ["caliente", "tibio", "frio"] },
    lectura: { type: "string" },
    siguiente: { type: "string" },
    basico: { type: "boolean" },
    mensaje: { type: "string" },
    no_cliente: { type: "boolean" },
  },
};

const SYSTEM = `Sos el analista comercial de Argencargo, una empresa argentina que trae mercadería de China para clientes de todo el país: courier aéreo (llega en 7 a 15 días) y marítimo (más barato, tarda unos dos meses). Los clientes son comerciantes y emprendedores que revenden lo que importan.

Te paso todo lo que el sistema sabe de UNA persona: sus datos, qué importó, qué cotizó, lo que se habló por WhatsApp y los contactos de seguimiento anteriores. Cruzá todo y decile al vendedor en qué está esa persona y qué conviene hacer.

Cosas que tenés que saber para leer bien los datos:
- Las cotizaciones las arma el cliente solo, en la calculadora del portal. Una cotización NO significa que habló con alguien: significa que estuvo mirando precios para ese producto.
- Importar = una operación entregada. Un cliente que ya importó varias veces vale mucho más que uno nuevo.
- En el chat, "Argencargo" es el vendedor (Bauti, el dueño, o Facu) y "Cliente" es la persona.
- Si la última palabra del chat fue del cliente y nadie le contestó, eso es lo primero que hay que resolver.
- Si no hay chat guardado no quiere decir que nunca hablaron: el WhatsApp se conectó al sistema hace poco.

Devolvé:
- temperatura:
  "caliente" = hay una compra concreta en marcha o muy probable (pidió precio o hizo una consulta puntual hace pocos días, dijo que va a importar, está esperando algo de Argencargo, o es un cliente que repite y ya le toca volver).
  "tibio" = hubo interés real pero se enfrió o le falta un empujón (cotizó hace unas semanas, importó hace unos meses y puede repetir, quedó en avisar).
  "frio" = sin señales (se registró y nada más, cotizó hace mucho, curioseó una sola vez, no contesta).
- lectura: 1 o 2 frases concretas con lo que importa: qué producto, qué monto, hace cuánto, en qué quedó. Sin relleno, sin repetir el nombre.
- siguiente: una sola frase con la acción concreta que conviene hacer ahora (o "Esperar" y hasta cuándo, si no conviene escribirle).
- basico: true si no hay ningún tema puntual para retomar y alcanza con un saludo corto para reabrir la charla. false si hay algo concreto (una cotización reciente, un pedido o una duda sin contestar, un cliente que ya importó y vale la pena cuidar) que tiene que llevar una persona.
- mensaje: el WhatsApp que le mandaría Bauti. Castellano rioplatense, de vos, como escribe una persona en WhatsApp: corto (3 líneas como mucho), directo, sin signos de apertura (¿ ¡), sin "estimado", sin lista de servicios, un emoji como mucho. Tiene que arrancar con "Hola" y el nombre de pila que te paso. Si hay un tema concreto, nombralo (el producto, la cotización). Si es básico, que sea un saludo seco, por ejemplo: "Hola Maxi, cómo estás? Todo bien?".

- no_cliente: true SOLO si por el chat queda claro que esta persona no es un cliente ni un posible cliente de Argencargo: es un proveedor, un agente de carga o depósito en China, un despachante, un empleado o socio, un familiar o amigo, alguien que ofrece un servicio, o un número equivocado. Si está registrada como cliente, o ante la duda, false. Cuando sea true, decí en "lectura" quién es.

No inventes datos: usá solo lo que está abajo. No prometas precios, plazos ni descuentos.`;

// Arma el texto que lee Claude. p = fila de crm_personas_v.
async function contexto(p) {
  const [ops, cots, fups, msgs] = await Promise.all([
    p.id ? leer(`/operations?client_id=eq.${p.id}&status=neq.cancelada&select=operation_code,description,channel,status,created_at,closed_at,delivery_completed_at,budget_total&order=created_at.desc&limit=6`) : [],
    p.id ? leer(`/quotes?client_id=eq.${p.id}&select=quote_number,created_at,channel_name,client_selected_channel,total_cost,total_fob,total_weight,products,operation_id&order=created_at.desc&limit=4`) : [],
    leer(`/client_followups?or=(${[p.id ? `client_id.eq.${p.id}` : null, p.contact_id ? `contact_id.eq.${p.contact_id}` : null].filter(Boolean).join(",")})&select=created_at,channel,outcome,note,next_at&order=created_at.desc&limit=6`),
    p.contact_id ? leer(`/crm_messages?contact_id=eq.${p.contact_id}&deleted=is.false&type=neq.reaction&select=direction,type,text,ts&order=ts.desc&limit=70`) : [],
  ]);
  const nombre = [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.company_name || p.wa_name || "sin nombre";
  const pila = apodoDe(p.first_name || p.wa_name || "") || String(p.first_name || p.wa_name || "").trim().split(/\s+/)[0] || "";
  const L = [];
  L.push(`Hoy es ${dia(new Date().toISOString())}.`);
  L.push("");
  L.push("PERSONA");
  L.push(`Nombre: ${nombre}${p.company_name && p.company_name !== nombre ? ` (${p.company_name})` : ""}`);
  L.push(`Nombre de pila para el saludo: ${pila || "(no hay: saludá sin nombre)"}`);
  L.push(p.id ? `Cliente registrado ${hace(p.created_at)} (${dia(p.created_at)})${p.tax_condition ? ` · ${FISCAL[p.tax_condition] || p.tax_condition}` : ""}` : `No está registrado en la plataforma. Escribió por WhatsApp por primera vez ${hace(p.created_at)}.`);
  if (p.source === "ad") L.push(`Llegó por un anuncio${p.campaign_name ? ` (${p.campaign_name})` : ""}.`);

  L.push("");
  L.push("IMPORTACIONES");
  if (!ops.length && !Number(p.mar_total)) L.push("Nunca importó.");
  for (const o of ops) {
    const entregada = o.status === "operacion_cerrada" || o.delivery_completed_at;
    L.push(`- ${o.operation_code} · ${CANAL[o.channel] || o.channel || ""} · ${o.description || "sin descripción"} · ${entregada ? `entregada ${hace(o.delivery_completed_at || o.closed_at || o.created_at)}` : `EN CURSO (${o.status})`}${Number(o.budget_total) > 0 ? ` · ${usd(o.budget_total)}` : ""}`);
  }
  if (Number(p.ops_total) > ops.length) L.push(`(${p.ops_total} operaciones en total, facturó ${usd(p.facturado_usd)}${Number(p.cadencia_dias) >= 7 ? `, suele volver cada ~${Math.round(p.cadencia_dias)} días` : ""})`);
  else if (Number(p.ops_cerradas) >= 2 && Number(p.cadencia_dias) >= 7) L.push(`(suele volver cada ~${Math.round(p.cadencia_dias)} días · facturó ${usd(p.facturado_usd)} en total)`);
  if (Number(p.mar_total) > 0) L.push(`Marítimo: ${p.mar_total} carga${Number(p.mar_total) === 1 ? "" : "s"}${Number(p.mar_activos) > 0 ? `, ${p.mar_activos} en curso` : ""}${p.mar_ultima_fecha ? `, la última llegó ${hace(p.mar_ultima_fecha)}` : ""}.`);
  if (Number(p.bultos_sin_op) > 0) L.push(`Tiene ${p.bultos_sin_op} bulto(s) en el depósito de China sin importación armada.`);

  L.push("");
  L.push("COTIZACIONES (las arma el cliente en la calculadora)");
  if (!cots.length) L.push("Nunca cotizó.");
  for (const q of cots) {
    const prods = (Array.isArray(q.products) ? q.products : []).map((x) => `${String(x.description || "").trim()}${x.quantity ? ` x${x.quantity}` : ""}`).filter((x) => x && x !== "x").slice(0, 5).join("; ");
    L.push(`- ${q.quote_number || ""} · ${hace(q.created_at)} (${dia(q.created_at)}) · ${q.client_selected_channel || q.channel_name || ""} · total ${usd(q.total_cost)}${Number(q.total_fob) > 0 ? ` (mercadería ${usd(q.total_fob)})` : ""}${prods ? ` · ${prods}` : ""}${q.operation_id ? " · SE CONVIRTIÓ EN IMPORTACIÓN" : ""}`);
  }
  if (Number(p.quotes_total) > cots.length) L.push(`(${p.quotes_total} cotizaciones en total)`);

  L.push("");
  L.push("SEGUIMIENTO ANTERIOR");
  if (!fups.length) L.push("Nunca se le hizo seguimiento.");
  for (const f of fups) L.push(`- ${dia(f.created_at)} · ${OUTCOME[f.outcome] || f.outcome || ""}${f.note ? ` · ${f.note}` : ""}${f.next_at ? ` · volver a escribir el ${dia(f.next_at)}` : ""}`);
  if (Number(p.intentos_sin_respuesta) > 0) L.push(`(${p.intentos_sin_respuesta} intento(s) seguidos sin respuesta)`);
  if (p.followup_next_at) L.push(`Hay una fecha agendada para volver a escribirle: ${dia(p.followup_next_at)}.`);
  if (p.notes) L.push(`Notas del vendedor: ${String(p.notes).slice(0, 400)}`);

  L.push("");
  L.push("WHATSAPP");
  if (!msgs.length) L.push("No hay chat guardado.");
  else {
    if (p.summary) L.push(`Resumen anterior: ${p.summary}${p.pending ? ` · Pendiente: ${p.pending}` : ""}`);
    L.push(`Último mensaje ${hace(p.last_msg_at)}; lo mandó ${p.last_direction === "in" ? "el cliente" : "Argencargo"}.`);
    for (const m of [...msgs].reverse()) L.push(`[${diaHora(m.ts)}] ${m.direction === "out" ? "Argencargo" : "Cliente"}: ${String(m.text || VISTA[m.type] || `[${m.type}]`).slice(0, 500)}`);
  }
  return { texto: L.join("\n"), conChat: msgs.length > 0, pila };
}

// Analiza una persona y guarda el resultado. Devuelve la fila guardada o { error }.
export async function analizarPersona(p) {
  const base = { clave: p.clave, client_id: p.id || null, contact_id: p.contact_id || null, firma: p.firma, updated_at: new Date().toISOString() };
  const guardar = (fila) => sb(`/crm_analisis?on_conflict=clave`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(fila) });
  try {
    const { texto, conChat } = await contexto(p);
    // Con chat para leer va el modelo principal; sin chat (solo números y cotizaciones), el económico.
    const out = await callClaudeText({ ...(conChat ? {} : { model: HAIKU_MODEL }), system: SYSTEM, user: texto, max_tokens: 700, json_schema: SCHEMA, feature: "crm-analisis" });
    let d; try { d = JSON.parse(String(out).replace(/```json\s*|\s*```/g, "").trim()); } catch { d = null; }
    if (!d || !["caliente", "tibio", "frio"].includes(d.temperatura) || !String(d.lectura || "").trim()) throw new Error("Claude no devolvió un análisis válido");
    // Solo un lead puede no ser cliente (proveedores y agentes escriben al mismo número): sale del seguimiento.
    const noCliente = d.no_cliente === true && !p.id;
    const fila = {
      ...base, temperatura: noCliente ? "no_cliente" : d.temperatura, lectura: String(d.lectura).trim().slice(0, 500), siguiente: String(d.siguiente || "").trim().slice(0, 300) || null,
      mensaje: noCliente ? null : String(d.mensaje || "").trim().slice(0, 700) || null,
      // La IA se queda solo con los fríos que no tienen nada puntual para retomar.
      quien: !noCliente && d.basico === true && d.temperatura === "frio" ? "ia" : "humano",
      modelo: conChat ? "principal" : "economico", error: null, analizado_at: base.updated_at,
    };
    const r = await guardar(fila);
    if (!r.ok) throw new Error(`No se pudo guardar el análisis (${r.status})`);
    return fila;
  } catch (e) {
    // Sin la huella: se reintenta, pero recién a las 6 h (crm_analisis_pendientes), para no trabar la fila.
    await guardar({ clave: base.clave, client_id: base.client_id, contact_id: base.contact_id, updated_at: base.updated_at, error: String(e.message || e).slice(0, 300), analizado_at: base.updated_at }).catch(() => {});
    return { error: String(e.message || e) };
  }
}

export const personaPorClave = (clave) => leer(`/crm_personas_v?clave=eq.${encodeURIComponent(clave)}&select=*`).then((r) => r[0] || null);
export const personasPendientes = (limite) => sb(`/rpc/crm_analisis_pendientes`, { method: "POST", body: JSON.stringify({ p_limit: limite }) }).then((r) => r.json()).then((r) => (Array.isArray(r) ? r : [])).catch(() => []);
