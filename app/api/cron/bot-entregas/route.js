// GET /api/cron/bot-entregas — recordatorios automáticos del bot de entregas.
// Corre cada hora (vercel.json). Plantillas fijas de WhatsApp — cero IA, costo cero.
//
// Escalera para cargas LISTAS SIN COORDINAR, cada 60 h reloj, tope 2:
//   1º recordatorio_coordinar  → "tu carga sigue pendiente de coordinar" (simple)
//   2º recordatorio_almacenaje → "podemos almacenarla el tiempo que necesites pero
//      necesitamos el pago; sin pago rige USD 0,5 diarios por kg" — después de este,
//      pasa a GESTIÓN HUMANA (notificación al admin) y no se manda nada más.
//
// Sin credenciales de Meta todo es no-op. ?dry=1 devuelve qué mandaría sin mandar.

import { sendWaTemplate, waConfigured, waNumber } from "../../../../lib/wa";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

export const maxDuration = 60;

const H60 = 60 * 3600 * 1000;
const ESCALERA = ["recordatorio_coordinar", "recordatorio_almacenaje"];

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const t = await r.text();
  let b = null; try { b = JSON.parse(t); } catch {}
  return { status: r.status, body: b };
}

async function notifyAdmins(title, body) {
  const admins = await sb(`/profiles?role=eq.admin&select=id`);
  const ids = (Array.isArray(admins.body) ? admins.body : []).map((a) => a.id).filter(Boolean);
  await Promise.all(ids.flatMap((id) => [
    sb(`/notifications`, { method: "POST", body: JSON.stringify({ user_id: id, portal: "admin", title, body, link: "/admin" }) }).catch(() => {}),
    fetch(`${BASE_URL}/api/push/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: id, portal: "admin", title, body, url: "/admin" }) }).catch(() => {}),
  ]));
}

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const okAuth = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!okAuth) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "Server config missing" }, { status: 500 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const now = Date.now();

  const r1 = await sb(`/operations?delivery_ready_at=not.is.null&delivery_confirmed_at=is.null&delivery_completed_at=is.null&bot_coord_reminder_count=lt.2&select=id,operation_code,description,delivery_public_token,delivery_ready_at,bot_coord_reminder_at,bot_coord_reminder_count,clients(first_name,last_name,client_code,whatsapp)`);
  const out = { recordatorios: [], enviados: 0, wa: waConfigured() };

  for (const op of Array.isArray(r1.body) ? r1.body : []) {
    const base = new Date(op.bot_coord_reminder_at || op.delivery_ready_at).getTime();
    if (now - base < H60) continue;
    const num = waNumber(op.clients?.whatsapp);
    if (!num || !op.delivery_public_token) continue;
    const paso = op.bot_coord_reminder_count || 0; // 0, 1 o 2 → plantilla de la escalera
    const plantilla = ESCALERA[paso];
    out.recordatorios.push(`${op.operation_code} → ${plantilla}`);
    if (dry) continue;
    // "Mazos de cartas (AC-0121)" — con la descripción el cliente sabe de qué carga hablamos.
    const carga = op.description ? `${op.description} (${op.operation_code})` : op.operation_code;
    const r = await sendWaTemplate(num, plantilla, [
      op.clients?.first_name || "Hola", carga, `${BASE_URL}/retiro/${op.delivery_public_token}`,
    ]);
    if (r?.ok) {
      out.enviados++;
      await sb(`/operations?id=eq.${op.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ bot_coord_reminder_at: new Date().toISOString(), bot_coord_reminder_count: paso + 1 }) });
      // Tras el 2º y último aviso, la gestión pasa a un humano — el bot no insiste más.
      if (paso === 1) {
        const c = op.clients || {};
        await notifyAdmins("⚠️ Entrega sin respuesta — tomar gestión humana", `${c.first_name || ""} ${c.last_name || ""} (${c.client_code || "?"}) · ${op.operation_code}: 2 recordatorios sin coordinar ni pagar.`);
      }
    }
  }

  return Response.json(out);
}
