// POST /api/chatbot
// Body: { messages: [{role:"user"|"assistant", content}], client_id?, op_code? }
// Devuelve: { ok, message }
// Asistente IA del cliente: responde dudas sobre tracking, cotizaciones, documentación, etc.
// Solo accesible desde la sesión del cliente (JWT del propio cliente).

import { callClaudeText } from "../../../lib/anthropic";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 60;

async function sb(path) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  return r.ok ? r.json() : null;
}

// Verificar JWT del cliente
async function getClientFromToken(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    if (!payload?.sub) return null;
    const cl = await sb(`/rest/v1/clients?select=*&auth_user_id=eq.${payload.sub}&limit=1`);
    return Array.isArray(cl) && cl[0] ? cl[0] : null;
  } catch { return null; }
}

// Cargar contexto del cliente: ops activas + saldo a favor + canjes
async function buildClientContext(client) {
  if (!client) return "";
  const [ops, payments, redemptions] = await Promise.all([
    sb(`/rest/v1/operations?select=operation_code,description,status,channel,origin,budget_total,collected_amount,is_collected,eta,delivered_at,international_tracking,international_carrier&client_id=eq.${client.id}&order=created_at.desc&limit=10`),
    sb(`/rest/v1/operation_client_payments?select=operation_id,amount_usd,payment_date,operations!inner(client_id)&operations.client_id=eq.${client.id}&order=payment_date.desc&limit=20`),
    sb(`/rest/v1/client_reward_redemptions?select=reward_name,points_spent,status,redeemed_at&client_id=eq.${client.id}&order=redeemed_at.desc&limit=5`),
  ]);

  let ctx = `\n\n---\nCONTEXTO DEL CLIENTE ACTUAL:\n`;
  ctx += `- Código: ${client.client_code}\n`;
  ctx += `- Nombre: ${client.first_name || ""} ${client.last_name || ""}\n`;
  ctx += `- Tier: ${client.tier || "standard"} · Puntos: ${client.points_balance || 0}\n`;
  if (Number(client.account_balance_usd || 0) > 0) ctx += `- Saldo a favor en cuenta: USD ${Number(client.account_balance_usd).toFixed(2)}\n`;

  if (Array.isArray(ops) && ops.length > 0) {
    ctx += `\nOPERACIONES (${ops.length} más recientes):\n`;
    const statusLbl = { pendiente: "Pendiente", en_deposito_origen: "En depósito origen (China/USA)", en_preparacion: "En preparación", en_transito: "En tránsito internacional", arribo_argentina: "Arribó a Argentina", en_aduana: "En aduana", entregada: "Lista para retirar", operacion_cerrada: "Operación cerrada", cancelada: "Cancelada" };
    const chLbl = { aereo_blanco: "Aéreo Courier Comercial", aereo_negro: "Aéreo Integral AC", maritimo_blanco: "Marítimo LCL/FCL", maritimo_negro: "Marítimo Integral AC" };
    for (const op of ops) {
      ctx += `- ${op.operation_code}: ${op.description || "—"} | ${chLbl[op.channel] || op.channel} | ${statusLbl[op.status] || op.status}`;
      if (op.budget_total) ctx += ` | Total: USD ${Number(op.budget_total).toFixed(2)}`;
      if (op.is_collected) ctx += ` | ✓ Cobrada`;
      else if (op.collected_amount) ctx += ` | Pagado: USD ${Number(op.collected_amount).toFixed(2)}`;
      if (op.eta && !op.delivered_at) ctx += ` | ETA: ${op.eta}`;
      if (op.delivered_at) ctx += ` | Entregada: ${op.delivered_at.slice(0, 10)}`;
      if (op.international_tracking) ctx += ` | Tracking: ${op.international_tracking} (${op.international_carrier || "?"})`;
      ctx += `\n`;
    }
  } else {
    ctx += `\nEl cliente no tiene operaciones todavía.\n`;
  }

  if (Array.isArray(redemptions) && redemptions.length > 0) {
    ctx += `\nCANJES DE PUNTOS:\n`;
    for (const r of redemptions) {
      ctx += `- ${r.reward_name} (${r.points_spent} pts) — ${r.status}\n`;
    }
  }
  return ctx;
}

const SYSTEM_PROMPT = `Sos el asistente virtual de **Argencargo**, una empresa argentina especializada en importaciones desde China, USA y España.

TU ROL:
- Ayudar a clientes con consultas sobre sus envíos, cotizaciones, pagos, documentación.
- Responder en **español argentino** (vos, no tú; "dale", "cualquier cosa", "tranquilo/a").
- Tono: profesional pero cercano y cálido. NO formal ni acartonado. Como hablaría Bautista.
- Mensajes BREVES y al grano. Si la respuesta es corta, una o dos oraciones. Si requiere detalle, máximo 4-5 oraciones.
- Usá emojis con moderación (1-2 por respuesta máximo, solo si aportan).

INFORMACIÓN CLAVE DE ARGENCARGO:
- Owner/contacto principal: Bautista Artuso
- WhatsApp: +54 9 11 2508-8580
- Email: info@argencargo.com.ar
- Oficinas: Av. Callao 1137, Recoleta, CABA
- Horario: Lunes a viernes 9:00 a 19:00

CANALES DE ENVÍO QUE OFRECEMOS:

**Desde China:**
- Aéreo Courier Comercial (Canal A formal): 7-10 días, despacho aduanero, requiere documentación. Para mercadería sin marca.
- Aéreo Integral AC (Canal B integral): 10-15 días, servicio puerta a puerta integral.
- Marítimo Carga LCL/FCL (Canal A formal): para volúmenes grandes, despacho aduanero.
- Marítimo Integral AC (Canal B integral): puerta a puerta integral.
- IMPORTANTE: para ropa/calzado, marítimo LCL/FCL solo permitido con +5 CBM.

**Desde USA:**
- Aéreo Integral AC: 48-72 hs hábiles
- Marítimo Integral AC: para volumen
- NO ofrecemos aéreo formal canal A para USA.

**Desde España:**
- Aéreo Integral AC únicamente: USD 55/kg (peso facturable, max bruto/volumétrico)
- 5-7 días hábiles
- NO ofrecemos marítimo desde España.

ESTADOS DE OPERACIÓN (en orden):
1. Pendiente → recién creada
2. En depósito origen → la carga llegó al depósito en China/USA
3. En preparación → consolidando con otras cargas
4. En tránsito → ya despachada, viajando
5. Arribo Argentina → llegó a Buenos Aires
6. En aduana → trámite aduanero (canal A) o gestión integral (canal B)
7. Entregada → lista para retirar / entregada al cliente
8. Operación cerrada → finalizada y pagada

INTERVENCIONES (productos restringidos):
- ANMAT: medicamentos, suplementos, productos médicos (oxímetros, tensiómetros), cosméticos
- ENACOM: equipos con WiFi/Bluetooth (auriculares BT, smartwatch con conectividad, parlantes BT)
- INAL: alimentos, bebidas, productos en contacto con alimentos
- SENASA: productos de origen animal o vegetal
- INTI: certificación de algunos productos industriales

PROGRAMA DE PUNTOS:
- 1 USD pagado = 1 punto
- Tiers: Standard, Silver (100+ pts, +2% bonus, 10% dcto), Gold (500+, +5%, 25% dcto), Platinum (1000+, +10%, 50% dcto), Diamond (2000+, +15%, 50% dcto + envío gratis CABA)
- Los puntos se pueden canjear por descuentos en flete, envíos gratis a domicilio, etc.

REGLAS DE CONDUCTA:
1. Si te preguntan algo que NO sabés → NUNCA inventes. Decí "te paso con Bautista por WhatsApp" y compartí: https://wa.me/5491125088580
2. Si te preguntan sobre estado/tracking → usá el contexto del cliente (te paso sus ops actuales).
3. Si preguntan precios genéricos → derivá al cotizador del portal: "Calcula tu importación → en el menú izquierdo".
4. Si es una queja o algo serio → derivá a Bautista por WhatsApp con un mensaje empático.
5. Si preguntan algo NO relacionado a importaciones/Argencargo → cortés pero brevemente "no soy el indicado, te paso con Bautista".
6. NUNCA prometas plazos exactos que no podés garantizar. Usá rangos ("entre 7 y 10 días").
7. NUNCA des consejos legales/fiscales específicos. Decí "consultá con un contador/despachante".
8. Si el cliente pregunta algo que requiere acción del admin (refund, cambio de tracking, etc) → derivá a Bautista.
9. Si te dan las gracias o saludan → respondé natural y breve.

EJEMPLOS DE BUENAS RESPUESTAS:
- "¿Cuándo llega mi pedido?" → mirá las ops del cliente, da info concreta del status + ETA si hay.
- "¿Cuánto cuesta importar X?" → derivá al cotizador con una mini explicación.
- "¿Puedo importar perfumes?" → "Sí, pero los perfumes requieren intervención ANMAT. Contactate con Bautista para ver si te conviene."
- "Hola" → "¡Hola ${`{firstName}`}! ¿En qué puedo ayudarte?"`;

export async function POST(req) {
  try {
    const client = await getClientFromToken(req);
    if (!client) return Response.json({ error: "unauthorized" }, { status: 401 });

    const { messages = [] } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages requerido" }, { status: 400 });
    }

    // Filtro: máximo 30 mensajes en historial (reduce tokens)
    const trimmed = messages.slice(-30).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 2000),
    }));

    // Construir contexto del cliente
    const clientCtx = await buildClientContext(client);
    const fullSystem = SYSTEM_PROMPT.replace("${`{firstName}`}", client.first_name || "") + clientCtx;

    // Últimos 4 mensajes como input directo, los anteriores como historial implícito
    const userText = trimmed[trimmed.length - 1].content;
    // Construir prompt como conversación
    const conversationHistory = trimmed.slice(0, -1).map(m => `${m.role === "user" ? "Cliente" : "Asistente"}: ${m.content}`).join("\n\n");
    const userMsg = conversationHistory ? `${conversationHistory}\n\nCliente: ${userText}` : userText;

    const text = await callClaudeText({
      system: fullSystem,
      user: userMsg,
      max_tokens: 800,
    });

    return Response.json({ ok: true, message: text.trim() });
  } catch (e) {
    console.error("chatbot error", e);
    return Response.json({ error: e.message || "error interno" }, { status: 500 });
  }
}
