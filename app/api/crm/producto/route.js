// POST /api/crm/producto {contact_id} — analizador de productos (26/11/2026). Cuando un cliente manda
// por WhatsApp lo que quiere traer (texto y/o foto) y pregunta qué necesita, esto lee los últimos
// mensajes y las últimas fotos del chat, entiende qué producto es, lo clasifica con el mismo motor de
// la calculadora (/api/ncm: posición, alícuotas, intervención de ANMAT / INAL / ENACOM / SENASA / INTI
// y antidumping) y arma un borrador de respuesta con la voz de Bautista. No guarda ni manda nada: lo
// muestra la ficha del chat y él decide qué contestar.
import { usuarioConRol } from "../../../../lib/auth-server";
import { callClaudeText, callClaudeVision } from "../../../../lib/anthropic";
import { GRAPH_CRM, tokenVigente } from "../../../../lib/crm-wa";
import { VOZ_BAUTI } from "../../../../lib/crm-mensaje";

export const maxDuration = 120;
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const sbh = () => { const k = process.env.SUPABASE_SERVICE_ROLE; return { apikey: k, Authorization: `Bearer ${k}` }; };
const leer = (p) => fetch(`${SB_URL}/rest/v1${p}`, { headers: sbh(), cache: "no-store" }).then((r) => r.json()).then((r) => (Array.isArray(r) ? r : [])).catch(() => []);

const VISTA = { image: "[foto]", video: "[video]", audio: "[audio]", document: "[documento]", sticker: "[sticker]", location: "[ubicación]", contacts: "[contacto]", media_placeholder: "[adjunto]" };
const diaHora = (iso) => { const d = new Date(new Date(iso).getTime() - 3 * 3600e3); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };

// Una foto del chat: Meta la guarda; se pide en el momento (la URL vence a los 5 minutos).
async function fotoDe(mediaId, token) {
  try {
    const meta = await fetch(`${GRAPH_CRM}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => r.json());
    if (!meta?.url) return null;
    const f = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!f.ok) return null;
    const mime = String(meta.mime_type || f.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return null;
    const buf = Buffer.from(await f.arrayBuffer());
    if (buf.length > 4.5e6) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

const SCHEMA_VER = {
  type: "object", additionalProperties: false, required: ["productos", "pregunta", "cantidad", "via"],
  properties: {
    productos: { type: "array", items: { type: "object", additionalProperties: false, required: ["nombre", "descripcion", "bateria", "inalambrico", "marca", "contacto_alimentos", "uso_corporal"],
      properties: {
        nombre: { type: "string" }, descripcion: { type: "string" },
        bateria: { type: "string", enum: ["ninguna", "pila_comun", "litio", "no_se_sabe"] },
        inalambrico: { type: "boolean" }, marca: { type: "boolean" }, contacto_alimentos: { type: "boolean" }, uso_corporal: { type: "boolean" },
      } } },
    pregunta: { type: "string" }, cantidad: { type: ["string", "null"] }, via: { type: "string", enum: ["aereo", "maritimo", "no_dice"] },
  },
};
const SYSTEM_VER = `Trabajás en Argencargo, una empresa argentina que importa mercadería de China y Estados Unidos para sus clientes. Te paso los últimos mensajes de un chat de WhatsApp entre el vendedor ("Argencargo") y un cliente, y las últimas fotos que mandó el cliente. Tenés que entender qué producto quiere traer AHORA (lo último que consulta) para que después un despachante lo clasifique.

Devolvé:
- productos: uno por cada producto distinto que esté consultando ahora (normalmente uno). Para cada uno:
  · nombre: cómo lo diría una persona, dos o tres palabras ("Peluche con sonido", "Vasos térmicos").
  · descripcion: una frase técnica en castellano para clasificarlo en la nomenclatura aduanera: qué es, de qué material, para qué sirve y qué lleva adentro (motor, electrónica, pila, líquido, imán…). Usá lo que dice el texto y lo que se ve en la foto. Sin marcas ni adjetivos de venta.
  · bateria: "litio" si lleva batería recargable o de litio; "pila_comun" si lleva pilas alcalinas o de botón no recargables; "ninguna" si no lleva; "no_se_sabe" si no queda claro.
  · inalambrico: true si tiene Bluetooth, WiFi o radiofrecuencia.
  · marca: true solo si es de una marca conocida o registrada o lleva un personaje con licencia (Disney, Pokémon, Nike…).
  · contacto_alimentos: true si va en contacto con comida o bebida (vajilla, botellas, utensilios, recipientes).
  · uso_corporal: true si se aplica sobre el cuerpo o se ingiere (cosmético, suplemento, producto médico, higiene).
- pregunta: en una frase, qué quiere saber el cliente (por ejemplo "qué certificaciones y restricciones tiene").
- cantidad: la cantidad que quiere traer, como la dice ("unas 300 unidades"), o null.
- via: "aereo" o "maritimo" si dijo por dónde lo quiere traer; si no, "no_dice".

No inventes: si no hay ningún producto en consulta, devolvé productos vacío y explicalo en "pregunta". Los audios y documentos no los podés leer (aparecen como [audio], [documento]).`;

const SYSTEM_RESP = `Sos Bautista (Bauti), el dueño de Argencargo, contestando por WhatsApp a un cliente que consultó qué necesita un producto para importarlo. Te paso lo que preguntó y lo que determinó el sistema (posición arancelaria, derechos, si lleva intervención de algún organismo, antidumping, batería, marca). Escribí la respuesta.

${VOZ_BAUTI}

Reglas de esta respuesta:
- Contestá lo que preguntó, directo, sin saludo (ya están hablando). Entre 2 y 5 renglones cortos.
- Usá SOLO los datos que te paso. No inventes certificaciones, organismos, costos, plazos ni requisitos que no estén ahí.
- Si no lleva intervención: decilo simple ("no lleva ninguna certificacion, se puede traer sin problema").
- Si lleva intervención: nombrá el organismo, decí que se puede traer pero hay que hacer el trámite, y que le pasás los costos. No pongas montos.
- Si tiene antidumping: avisale que esa mercadería paga un derecho extra.
- Batería de litio: avisale que por la batería va con un recargo en el aéreo. Pila común: no hace falta aclarar nada.
- Marca registrada o personaje con licencia: avisale que con marca no se puede traer por el canal formal.
- No des el código de la posición arancelaria ni los porcentajes salvo que los haya pedido.
- Cerrá, si queda natural, pidiendo lo que falta para cotizar o con "cualquier cosa avisame".`;

export async function POST(req) {
  const u = await usuarioConRol(req, ["admin", "empleado"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(b.contact_id || ""))) return Response.json({ error: "Falta el contacto" }, { status: 400 });
  const con = (await leer(`/crm_contacts?id=eq.${b.contact_id}&select=id`))[0];
  if (!con) return Response.json({ error: "Contacto inexistente" }, { status: 404 });
  const desde = new Date(Date.now() - 10 * 864e5).toISOString();
  const [msgs, numeros] = await Promise.all([
    leer(`/crm_messages?contact_id=eq.${con.id}&deleted=is.false&type=neq.reaction&ts=gte.${encodeURIComponent(desde)}&select=direction,type,text,media_id,ts&order=ts.desc&limit=40`),
    leer(`/crm_numbers?select=phone_number_id,token&status=eq.conectado&order=connected_at.desc&limit=1`),
  ]);
  if (!msgs.length) return Response.json({ error: "No hay mensajes guardados de este chat" }, { status: 404 });

  // Las últimas fotos que mandó el cliente (hasta 3), de la más vieja a la más nueva.
  const token = numeros[0] ? await tokenVigente(numeros[0]) : null;
  const idsFoto = msgs.filter((m) => m.direction === "in" && m.type === "image" && /^\d+$/.test(String(m.media_id || ""))).slice(0, 3).map((m) => m.media_id).reverse();
  const fotos = token ? (await Promise.all(idsFoto.map((id) => fotoDe(id, token)))).filter(Boolean) : [];
  const lineas = [...msgs].reverse().map((m) => `[${diaHora(m.ts)}] ${m.direction === "out" ? "Argencargo" : "Cliente"}: ${String(m.text || VISTA[m.type] || `[${m.type}]`).slice(0, 700)}`);
  const pedido = `Chat:\n${lineas.join("\n")}\n\n${fotos.length ? `Van ${fotos.length} foto(s) del cliente, de la más vieja a la más nueva.` : "No hay fotos para ver."}`;

  let v;
  try {
    const out = fotos.length
      ? await callClaudeVision({ system: SYSTEM_VER, prompt: pedido, images: fotos, max_tokens: 1200, json_schema: SCHEMA_VER, feature: "crm-producto" })
      : await callClaudeText({ system: SYSTEM_VER, user: pedido, max_tokens: 1200, json_schema: SCHEMA_VER, feature: "crm-producto" });
    v = JSON.parse(String(out).replace(/```json\s*|\s*```/g, "").trim());
  } catch (e) { console.error("[crm-producto]", e?.message || e); return Response.json({ error: "No se pudo leer el chat" }, { status: 502 }); }
  const vistos = (Array.isArray(v.productos) ? v.productos : []).filter((p) => String(p.descripcion || "").trim()).slice(0, 4);
  if (!vistos.length) return Response.json({ ok: true, productos: [], pregunta: String(v.pregunta || "").slice(0, 300), fotos: fotos.length, mensajes: msgs.length });

  // La clasificación la hace el mismo motor que usan las calculadoras.
  const origen = new URL(req.url).origin;
  const productos = await Promise.all(vistos.map(async (p) => {
    let n = null;
    try { n = await fetch(`${origen}/api/ncm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: p.descripcion }) }).then((r) => r.json()); } catch {}
    const inter = n?.intervention?.required ? { tipos: Array.isArray(n.intervention.types) ? n.intervention.types : [], motivo: n.intervention.reason || null } : null;
    return {
      nombre: String(p.nombre || "").slice(0, 80), descripcion: String(p.descripcion).slice(0, 400),
      ncm: n?.ncm_code || null, ncm_desc: n?.ncm_description || null, die: n?.import_duty_rate ?? null, te: n?.statistics_rate ?? null, iva: n?.iva_rate ?? null,
      intervencion: inter, antidumping: n?.antidumping ? (n.antidumping.medidaTexto || n.antidumping.nota || "Sujeto a antidumping") : null,
      bateria: p.bateria, inalambrico: !!p.inalambrico, marca: !!p.marca, contacto_alimentos: !!p.contacto_alimentos, uso_corporal: !!p.uso_corporal,
    };
  }));

  const BAT = { ninguna: "no lleva", pila_comun: "pila común (no recargable)", litio: "batería de litio", no_se_sabe: "no se sabe" };
  const datos = productos.map((p, i) => [
    `PRODUCTO ${i + 1}: ${p.nombre} — ${p.descripcion}`,
    p.ncm ? `Posición: ${p.ncm} · derechos ${p.die ?? "?"} % · tasa de estadística ${p.te ?? "?"} % · IVA ${p.iva ?? "?"} %` : "No se pudo clasificar.",
    p.intervencion ? `Intervención: SÍ, de ${p.intervencion.tipos.join(" y ") || "un organismo"}${p.intervencion.motivo ? ` (${p.intervencion.motivo})` : ""}` : "Intervención: no lleva ninguna.",
    p.antidumping ? `Antidumping: sí (${p.antidumping})` : "Antidumping: no.",
    `Batería: ${BAT[p.bateria] || "no se sabe"} · Marca registrada o licencia: ${p.marca ? "sí" : "no"}`,
  ].join("\n")).join("\n\n");
  let respuesta = "";
  try {
    respuesta = String(await callClaudeText({ system: SYSTEM_RESP, user: `Lo que preguntó el cliente: ${v.pregunta || "qué necesita para traerlo"}${v.cantidad ? `\nCantidad: ${v.cantidad}` : ""}${v.via && v.via !== "no_dice" ? `\nLo quiere traer por: ${v.via}` : ""}\n\n${datos}`, max_tokens: 500, feature: "crm-producto" })).trim().replace(/^["“]|["”]$/g, "");
  } catch (e) { console.error("[crm-producto] respuesta", e?.message || e); }
  return Response.json({ ok: true, productos, pregunta: String(v.pregunta || "").slice(0, 300), cantidad: v.cantidad || null, via: v.via && v.via !== "no_dice" ? v.via : null, respuesta, fotos: fotos.length, mensajes: msgs.length });
}
