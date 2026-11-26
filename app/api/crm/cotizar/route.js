// POST /api/crm/cotizar {contact_id} — arma los datos de una cotización leyendo el chat (27/11/2026).
// Lo usa el botón "Generar cotización" de la extensión de WhatsApp Web: abre la calculadora del admin,
// que llama acá. Se leen los últimos mensajes de TEXTO guardados de ese contacto (audios, fotos y
// archivos no) y Claude saca productos, precio, cantidad y bultos. No guarda nada: devuelve los datos
// y la calculadora los muestra para revisar; la cotización recién existe cuando Bautista la genera.
import { usuarioConRol } from "../../../../lib/auth-server";
import { callClaudeText } from "../../../../lib/anthropic";

export const maxDuration = 60;
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const sbh = () => { const k = process.env.SUPABASE_SERVICE_ROLE; return { apikey: k, Authorization: `Bearer ${k}` }; };
const leer = (p) => fetch(`${SB_URL}/rest/v1${p}`, { headers: sbh(), cache: "no-store" }).then((r) => r.json()).then((r) => (Array.isArray(r) ? r : [])).catch(() => []);

const NUM = { type: ["number", "null"] };
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["productos", "bultos", "origen", "bateria", "marca", "falta"],
  properties: {
    productos: { type: "array", items: { type: "object", additionalProperties: false, required: ["descripcion", "precio_usd", "cantidad"], properties: { descripcion: { type: "string" }, precio_usd: NUM, cantidad: NUM } } },
    bultos: { type: "array", items: { type: "object", additionalProperties: false, required: ["cantidad", "largo_cm", "ancho_cm", "alto_cm", "peso_kg"], properties: { cantidad: NUM, largo_cm: NUM, ancho_cm: NUM, alto_cm: NUM, peso_kg: NUM } } },
    origen: { type: "string", enum: ["China", "USA"] },
    bateria: { type: ["boolean", "null"] },
    marca: { type: ["boolean", "null"] },
    falta: { type: "array", items: { type: "string" } },
  },
};
const SYSTEM = `Sos el asistente de cotizaciones de Argencargo, una empresa argentina que importa mercadería de China y de Estados Unidos para sus clientes.
Te paso los últimos mensajes de un chat de WhatsApp entre el vendedor ("Argencargo") y una persona que quiere importar ("Cliente"). Sacá los datos para armar la cotización de lo que quiere traer AHORA (lo último que se está hablando).

Devolvé:
- productos: uno por cada producto distinto. "descripcion": qué es, en castellano, corto y sin adjetivos ("Cortinas", "Auriculares inalámbricos", "Paletas de pádel"). "precio_usd": el precio por unidad en dólares que le pasó su proveedor. "cantidad": el total de unidades que quiere traer.
- bultos: las cajas. "cantidad" de cajas iguales, medidas en centímetros y "peso_kg" bruto de UNA caja. Si dicen cuántas unidades entran por caja, calculá cuántas cajas hacen falta para la cantidad pedida (40 unidades a 20 por caja = 2 cajas). Si dan el peso total, dividilo por la cantidad de cajas. Si las medidas vienen en otra unidad, pasalas a centímetros.
- origen: "USA" solo si queda claro que la mercadería sale de Estados Unidos; si no, "China".
- bateria: true si el producto lleva batería (litio, recargable, pilas incluidas); false si claramente no lleva; null si no se sabe.
- marca: true si es de una marca conocida o registrada (Apple, Nike, Samsung…); false si es genérico o de fábrica sin marca; null si no se sabe.
- falta: lista corta, en castellano, de lo que falta para poder cotizar (por ejemplo "precio por unidad", "medidas de las cajas", "peso"). Vacía si está todo.

Reglas:
- Lo último que se dijo corrige lo anterior ("40 unidades, perdón" reemplaza a "30 unidades").
- No inventes números: lo que no está en el chat va en null y se anota en "falta".
- Los audios, fotos y archivos no los podés leer (aparecen como [audio], [foto], [documento]). Si parece que un dato se pasó por ahí, anotalo en "falta".
- Si en el chat no se habla de ninguna mercadería para importar, devolvé productos y bultos vacíos y explicalo en "falta".`;

const VISTA = { image: "[foto]", video: "[video]", audio: "[audio]", document: "[documento]", sticker: "[sticker]", location: "[ubicación]", contacts: "[contacto]", media_placeholder: "[adjunto]" };
const diaHora = (iso) => { const d = new Date(new Date(iso).getTime() - 3 * 3600e3); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const num = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? v : null);

export async function POST(req) {
  const u = await usuarioConRol(req, ["admin", "empleado"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(b.contact_id || ""))) return Response.json({ error: "Falta el contacto" }, { status: 400 });
  const con = (await leer(`/crm_contacts?id=eq.${b.contact_id}&select=id,client_id,name,wa_name`))[0];
  if (!con) return Response.json({ error: "Contacto inexistente" }, { status: 404 });
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const [cl, msgs] = await Promise.all([
    con.client_id ? leer(`/clients?id=eq.${con.client_id}&select=id,client_code,first_name,last_name,tax_condition`) : [],
    leer(`/crm_messages?contact_id=eq.${con.id}&deleted=is.false&type=neq.reaction&ts=gte.${encodeURIComponent(desde)}&select=direction,type,text,ts&order=ts.desc&limit=90`),
  ]);
  const c = cl[0] || null;
  const cliente = c ? { id: c.id, code: c.client_code || "", nombre: [c.first_name, c.last_name].filter(Boolean).join(" ").trim(), regimen: c.tax_condition === "responsable_inscripto" ? "responsable_inscripto" : "monotributo" } : { id: null, code: "", nombre: con.name || con.wa_name || "", regimen: null };
  if (!msgs.length) return Response.json({ ok: true, cliente, origen: "China", bateria: null, marca: null, productos: [], bultos: [], falta: ["No hay mensajes guardados de este chat"], mensajes: 0 });

  const lineas = [...msgs].reverse().map((m) => `[${diaHora(m.ts)}] ${m.direction === "out" ? "Argencargo" : "Cliente"}: ${String(m.text || VISTA[m.type] || `[${m.type}]`).slice(0, 700)}`);
  let d;
  try {
    const out = await callClaudeText({ system: SYSTEM, user: `Chat:\n${lineas.join("\n")}`, max_tokens: 1200, json_schema: SCHEMA, feature: "crm-cotizar" });
    d = JSON.parse(String(out).replace(/```json\s*|\s*```/g, "").trim());
  } catch (e) { return Response.json({ error: "No se pudo leer el chat" }, { status: 502 }); }
  const productos = (Array.isArray(d.productos) ? d.productos : []).map((p) => ({ descripcion: String(p.descripcion || "").trim().slice(0, 120), precio_usd: num(p.precio_usd), cantidad: num(p.cantidad) })).filter((p) => p.descripcion).slice(0, 30);
  const bultos = (Array.isArray(d.bultos) ? d.bultos : []).map((k) => ({ cantidad: Math.max(1, Math.round(num(k.cantidad) || 1)), largo_cm: num(k.largo_cm), ancho_cm: num(k.ancho_cm), alto_cm: num(k.alto_cm), peso_kg: num(k.peso_kg) })).filter((k) => k.largo_cm || k.peso_kg).slice(0, 30);
  return Response.json({ ok: true, cliente, origen: d.origen === "USA" ? "USA" : "China", bateria: typeof d.bateria === "boolean" ? d.bateria : null, marca: typeof d.marca === "boolean" ? d.marca : null, productos, bultos, falta: (Array.isArray(d.falta) ? d.falta : []).map((x) => String(x).slice(0, 120)).slice(0, 8), mensajes: msgs.length });
}
