// /api/argenmaq/repuesto — formulario público "Te conseguimos el repuesto" (argenmaq/repuestos).
// Cualquiera puede mandarlo, sin cuenta. Se guarda en cat_busquedas (panel › Comercial › A pedido)
// marcado como repuesto, y se avisa por Telegram al equipo. La descripción lleva una primera línea
// "[Repuesto]" con email y zona, porque la tabla no tiene esas columnas (el panel la lee y la limpia).
import { tgNotify } from "../../../../lib/telegram";

export const dynamic = "force-dynamic";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

const limpiar = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch { return Response.json({ error: "Datos inválidos." }, { status: 400 }); }

  // Trampa para bots: un campo que la persona no ve. Si viene lleno, se responde OK y no se guarda nada.
  if (b.sitio) return Response.json({ ok: true });

  const nombre = limpiar(b.nombre, 120);
  const telefono = limpiar(b.telefono, 40);
  const email = limpiar(b.email, 160).toLowerCase();
  const zona = limpiar(b.zona, 120);
  const descripcion = String(b.descripcion ?? "").trim().slice(0, 4000);

  if (nombre.length < 2) return Response.json({ error: "Falta tu nombre." }, { status: 400 });
  if (telefono.replace(/\D/g, "").length < 8) return Response.json({ error: "Revisá el teléfono." }, { status: 400 });
  if (email && !emailOk(email)) return Response.json({ error: "Revisá el email." }, { status: 400 });
  if (descripcion.length < 10) return Response.json({ error: "Contanos un poco más del repuesto." }, { status: 400 });
  if (!SB_SERVICE) return Response.json({ error: "No pudimos guardar tu pedido. Escribinos por WhatsApp." }, { status: 500 });

  const cabecera = ["[Repuesto]", email && `Email: ${email}`, zona && `Zona: ${zona}`].filter(Boolean).join(" · ");
  const fila = { cliente: nombre, contacto: telefono, descripcion: `${cabecera}\n\n${descripcion}`, situacion: "gestion_integral" };

  const r = await fetch(`${SB_URL}/rest/v1/cat_busquedas`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(fila),
  });
  if (!r.ok) return Response.json({ error: "No pudimos guardar tu pedido. Escribinos por WhatsApp." }, { status: 500 });
  const [creada] = await r.json().catch(() => []);
  const codigo = creada?.numero ? `BQ-${String(creada.numero).padStart(5, "0")}` : "";

  // El aviso no frena la respuesta al cliente: si Telegram falla, el pedido igual quedó guardado.
  try {
    const datos = [`👤 ${nombre}`, `📱 ${telefono}`];
    if (email) datos.push(`✉️ ${email}`);
    if (zona) datos.push(`📍 ${zona}`);
    await tgNotify([`🔧 Nuevo pedido de repuesto ${codigo}`.trim(), ...datos, "", descripcion.slice(0, 900), "", "Panel ARGENMAQ › Comercial › A pedido"].join("\n"));
  } catch {}

  return Response.json({ ok: true, codigo });
}
