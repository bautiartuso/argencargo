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
  type: "object", additionalProperties: false, required: ["productos", "bultos", "origen", "bateria", "marca", "regimen", "falta"],
  properties: {
    productos: { type: "array", items: { type: "object", additionalProperties: false, required: ["descripcion", "precio_usd", "cantidad"], properties: { descripcion: { type: "string" }, precio_usd: NUM, cantidad: NUM } } },
    bultos: { type: "array", items: { type: "object", additionalProperties: false, required: ["cantidad", "largo_cm", "ancho_cm", "alto_cm", "peso_kg", "volumen_m3"], properties: { cantidad: NUM, largo_cm: NUM, ancho_cm: NUM, alto_cm: NUM, peso_kg: NUM, volumen_m3: NUM } } },
    origen: { type: "string", enum: ["China", "USA"] },
    bateria: { type: "boolean" },
    marca: { type: "boolean" },
    regimen: { type: "string", enum: ["responsable_inscripto", "monotributo", "no_dice"] },
    falta: { type: "array", items: { type: "string" } },
  },
};
const SYSTEM = `Sos el asistente de cotizaciones de Argencargo, una empresa argentina que importa mercadería de China y de Estados Unidos para sus clientes.
Te paso los últimos mensajes de un chat de WhatsApp entre el vendedor ("Argencargo") y una persona que quiere importar ("Cliente"). Sacá los datos para armar la cotización de lo que quiere traer AHORA (lo último que se está hablando).

Devolvé:
- productos: uno por cada producto distinto. "descripcion": la mercadería y nada más, en castellano, corta y sin adjetivos ("Cortinas", "Auriculares inalámbricos", "Camperas y prendas de ropa"). No pongas "muestras de", "lote de", "pedido de" ni para qué es. "precio_usd": el precio por unidad en dólares que le pasó su proveedor. "cantidad": el total de unidades que quiere traer.
  Si solo dan el valor total de la mercadería (valor FOB, valor comercial, "son USD 1.500 en total") sin abrirlo por unidad: precio_usd = ese total y cantidad = 1. Eso alcanza para cotizar: no lo anotes en "falta".
- bultos: las cajas. "cantidad" de cajas iguales, medidas en centímetros y "peso_kg" bruto de UNA caja. Si dicen cuántas unidades entran por caja, calculá cuántas cajas hacen falta para la cantidad pedida (40 unidades a 20 por caja = 2 cajas). Si dan el peso total, dividilo por la cantidad de cajas. Si las medidas vienen en otra unidad, pasalas a centímetros. "volumen_m3" va en null cuando hay medidas.
  Si no dan las medidas de las cajas pero sí el volumen total de la carga (m³ o CBM): un solo bulto con cantidad 1, medidas en null, peso_kg = el peso real total y volumen_m3 = ese volumen. Eso alcanza para cotizar: no anotes medidas ni cantidad de cajas en "falta". Si solo dan el peso volumétrico (kg), volumen_m3 = peso volumétrico ÷ 200.
- origen: "USA" solo si queda claro que la mercadería sale de Estados Unidos; si no, "China".
- bateria: true si el producto lleva batería (litio, recargable, pilas incluidas); si no lleva o no se sabe, false.
- marca: true solo si se nombra una marca conocida o registrada (Apple, Nike, Samsung…) o dicen que lleva marca o logo; si es genérico, de fábrica, o no se dice nada, false.
- regimen: la condición fiscal si el cliente la dice en el chat: "responsable_inscripto" (responsable inscripto, RI, tiene empresa/SRL/SA, pide factura A) o "monotributo" (monotributista, consumidor final, particular). Si no lo dice, "no_dice".
- falta: lista corta, en castellano, de lo que de verdad impide cotizar (por ejemplo "valor de la mercadería", "peso", "medidas o volumen"). Vacía si está todo.

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
  // Quien todavía no es cliente no tiene condición fiscal cargada: vale la que dijo en el chat.
  if (!msgs.length) return Response.json({ ok: true, cliente, origen: "China", bateria: null, marca: null, productos: [], bultos: [], falta: ["No hay mensajes guardados de este chat"], mensajes: 0 });

  const lineas = [...msgs].reverse().map((m) => `[${diaHora(m.ts)}] ${m.direction === "out" ? "Argencargo" : "Cliente"}: ${String(m.text || VISTA[m.type] || `[${m.type}]`).slice(0, 700)}`);
  let d;
  try {
    const out = await callClaudeText({ system: SYSTEM, user: `Chat:\n${lineas.join("\n")}`, max_tokens: 1200, json_schema: SCHEMA, feature: "crm-cotizar" });
    d = JSON.parse(String(out).replace(/```json\s*|\s*```/g, "").trim());
  } catch (e) { console.error("[crm-cotizar]", e?.message || e); return Response.json({ error: "No se pudo leer el chat" }, { status: 502 }); }
  const productos = (Array.isArray(d.productos) ? d.productos : []).map((p) => ({ descripcion: String(p.descripcion || "").trim().slice(0, 120), precio_usd: num(p.precio_usd), cantidad: num(p.cantidad) })).filter((p) => p.descripcion).slice(0, 30);
  const bultos = (Array.isArray(d.bultos) ? d.bultos : []).map((k) => ({ cantidad: Math.max(1, Math.round(num(k.cantidad) || 1)), largo_cm: num(k.largo_cm), ancho_cm: num(k.ancho_cm), alto_cm: num(k.alto_cm), peso_kg: num(k.peso_kg), volumen_m3: num(k.largo_cm) && num(k.ancho_cm) && num(k.alto_cm) ? null : num(k.volumen_m3) })).filter((k) => k.largo_cm || k.peso_kg || k.volumen_m3).slice(0, 30);
  if (!cliente.id && ["responsable_inscripto", "monotributo"].includes(d.regimen)) cliente.regimen = d.regimen;
  return Response.json({ ok: true, cliente, origen: d.origen === "USA" ? "USA" : "China", bateria: d.bateria === true, marca: d.marca === true, productos, bultos, falta: (Array.isArray(d.falta) ? d.falta : []).map((x) => String(x).slice(0, 120)).slice(0, 8), mensajes: msgs.length });
}
