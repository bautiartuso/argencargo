// GET /api/cron/autocierre — cada hora (vercel.json).
// Cierra las operaciones que ya están entregadas y cobradas completas (22/10/2026). Antes el cierre
// era siempre manual: las de RI con entrega directa (el tracking del courier marca la entrega y el
// cobro se acredita aparte) quedaban para siempre en "lista para retirar" (AC-0240, AC-0256).
// Hace lo mismo que cerrar a mano: status operacion_cerrada + el mail de cierre (con el pedido de
// reseña, salvo que la op o el cliente lo tengan apagado). Gestión Integral queda afuera: su cierre
// liquida la comisión del socio y lo decide el panel GI.
// Auth: Bearer CRON_SECRET (Vercel cron).

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

export const maxDuration = 60;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const txt = await r.text();
  try { return { ok: r.ok, body: JSON.parse(txt) }; } catch { return { ok: r.ok, body: null }; }
}

function autorizado(req) {
  const auth = req.headers.get("authorization") || "";
  return !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ ok: false, error: "Server no configurado" }, { status: 500 });
  const r = await sb(`/rest/v1/operations?status=eq.entregada&is_collected=is.true&delivery_completed_at=not.is.null&or=(service_type.is.null,service_type.neq.gestion_integral)&select=id,operation_code,closed_at,channel,retenida_at`);
  const ops = Array.isArray(r.body) ? r.body : [];
  // Aéreo courier: sin legajo completo (DSI + factura del courier) no se cierra (22/10/2026).
  const aereos = ops.filter((o) => o.channel === "aereo_blanco").map((o) => o.id);
  let legajo = null;
  if (aereos.length) {
    const l = await sb(`/rest/v1/legajo_docs?operation_id=in.(${aereos.join(",")})&borrado_at=is.null&select=operation_id,tipo`);
    if (l.ok && Array.isArray(l.body)) legajo = l.body; // si la tabla no existe todavía, no se bloquea
  }
  const sinLegajo = [];
  const cerradas = [], errores = [];
  for (const o of ops) {
    // Retenida por Aduana: no hay legajo del courier que exigir.
    if (o.channel === "aereo_blanco" && !o.retenida_at && legajo && !["dsi", "factura_courier"].every((t) => legajo.some((d) => d.operation_id === o.id && d.tipo === t))) { sinLegajo.push(o.operation_code); continue; }
    const p = await sb(`/rest/v1/operations?id=eq.${o.id}&status=eq.entregada`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "operacion_cerrada", closed_at: o.closed_at || new Date().toISOString() }),
    });
    if (!p.ok || !Array.isArray(p.body) || !p.body.length) { errores.push(o.operation_code); continue; }
    cerradas.push(o.operation_code);
    // Mail de cierre, igual que al cerrar desde el admin (notify ya respeta silenciada / sin reseña / ya enviado).
    try {
      await fetch(`${BASE_URL}/api/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET}` },
        body: JSON.stringify({ op_id: o.id, trigger: "cerrada" }),
      });
    } catch (e) { console.error("[autocierre] notify", o.operation_code, e); }
  }
  return Response.json({ ok: true, cerradas, errores, sin_legajo: sinLegajo });
}
