// POST /api/portal/baterias
// Body: { op_id, has_battery }
// El cliente avisa si la carga lleva baterías. Es un dato operativo (el aéreo cobra recargo y
// la aerolínea necesita saberlo), así que se puede informar incluso cuando la mercadería ya está
// congelada por el vuelo: hasta hoy el aviso se perdía en silencio porque el único lugar donde se
// guardaba era el panel de mercadería, que se bloquea al asignar el vuelo (21/09/2026).
// NO toca plata: el presupuesto guardado queda como está y lo recalcula Argencargo si corresponde.
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

async function svc(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, { ...opts, headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const txt = await r.text(); let data = null; try { data = JSON.parse(txt); } catch {}
  return { ok: r.ok, data, status: r.status };
}
const arr = (r) => (Array.isArray(r?.data) ? r.data : null);

export async function POST(req) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return Response.json({ error: "no_auth" }, { status: 401 });
  let body = {}; try { body = await req.json(); } catch {}
  const opId = String(body.op_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(opId)) return Response.json({ error: "op_invalida" }, { status: 400 });
  if (typeof body.has_battery !== "boolean") return Response.json({ error: "sin_valor" }, { status: 400 });

  const user = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!user?.id) return Response.json({ error: "no_auth" }, { status: 401 });
  const [cl, prof] = await Promise.all([
    svc(`/rest/v1/clients?auth_user_id=eq.${user.id}&select=id&limit=1`),
    svc(`/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`),
  ]);
  const ownClientId = (arr(cl) || [])[0]?.id || null;
  const isAdmin = ["admin", "empleado"].includes((arr(prof) || [])[0]?.role);
  if (!ownClientId && !isAdmin) return Response.json({ error: "sin_cliente" }, { status: 403 });

  const opR = await svc(`/rest/v1/operations?id=eq.${opId}${isAdmin ? "" : `&client_id=eq.${ownClientId}`}&select=id,operation_code,status,has_battery,client_id&limit=1`);
  const op = (arr(opR) || [])[0];
  if (!op) return Response.json({ error: "op_no_encontrada" }, { status: 404 });
  if (["entregada", "operacion_cerrada", "cancelada"].includes(op.status)) return Response.json({ error: "op_cerrada" }, { status: 409 });
  if (!!op.has_battery === body.has_battery) return Response.json({ ok: true, sin_cambios: true });

  const up = await svc(`/rest/v1/operations?id=eq.${opId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ has_battery: body.has_battery }) });
  if (!up.ok) return Response.json({ error: "no_se_guardo", detail: up.data }, { status: 500 });

  const now = new Date().toISOString();
  const titulo = body.has_battery ? "El cliente informó que la carga lleva baterías" : "El cliente informó que la carga NO lleva baterías";
  await svc(`/rest/v1/tracking_events`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ operation_id: opId, title: titulo, occurred_at: now, source: "internal", status_code: op.status, is_visible_to_client: true }) }).catch(() => {});
  const adm = await svc(`/rest/v1/profiles?role=eq.admin&select=id`);
  for (const a of (arr(adm) || [])) {
    await svc(`/rest/v1/notifications`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: a.id, portal: "admin", title: `${body.has_battery ? "⚡" : "✓"} ${op.operation_code}: ${body.has_battery ? "la carga lleva baterías" : "la carga no lleva baterías"}`, body: body.has_battery ? "Lo informó el cliente desde el portal. Revisá el recargo del presupuesto." : "Lo informó el cliente desde el portal.", link: `?op=${op.operation_code}` }) }).catch(() => {});
  }
  return Response.json({ ok: true, has_battery: body.has_battery });
}
