// GET /api/tracking/check-duplicate?code=XXX&exclude_op=uuid
// Busca si un tracking ya existe en operaciones, paquetes, avisos o paquetes huérfanos.
// Útil para detectar cuando un cliente o agente carga un tracking que ya existe en otra op.
// Auth: cualquier usuario autenticado (necesitamos service role para ver TODO).

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 15;

async function sb(path) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  return r.ok ? r.json() : [];
}

async function isAuthenticated(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  if (token === process.env.CRON_SECRET) return true;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return !!payload?.sub;
  } catch { return false; }
}

export async function GET(req) {
  if (!(await isAuthenticated(req))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").trim();
  const excludeOp = url.searchParams.get("exclude_op");
  if (!code || code.length < 4) return Response.json({ ok: true, duplicates: [] });

  // Limpiamos el código para búsqueda (algunos carriers usan espacios o guiones)
  const codeNorm = code.replace(/[\s-]/g, "");
  const codeUpper = code.toUpperCase();

  const conflicts = [];

  // 1. Operations.international_tracking
  const ops = await sb(`/rest/v1/operations?select=id,operation_code,status,client_id,clients(client_code,first_name,last_name)&international_tracking=ilike.${encodeURIComponent("%" + code + "%")}&limit=10`);
  for (const o of (Array.isArray(ops) ? ops : [])) {
    if (excludeOp && o.id === excludeOp) continue;
    if (["operacion_cerrada", "cancelada"].includes(o.status)) continue;
    conflicts.push({
      type: "operation",
      where: "Tracking internacional de op",
      operation_code: o.operation_code,
      operation_id: o.id,
      status: o.status,
      client: o.clients ? `${o.clients.client_code} - ${o.clients.first_name || ""}` : null,
    });
  }

  // 2. Operation_packages.national_tracking
  const pkgs = await sb(`/rest/v1/operation_packages?select=id,operation_id,national_tracking,operations!inner(id,operation_code,status,client_id,clients(client_code,first_name,last_name))&national_tracking=ilike.${encodeURIComponent("%" + code + "%")}&limit=10`);
  for (const p of (Array.isArray(pkgs) ? pkgs : [])) {
    if (excludeOp && p.operation_id === excludeOp) continue;
    if (["operacion_cerrada", "cancelada"].includes(p.operations?.status)) continue;
    conflicts.push({
      type: "package",
      where: "Bulto en op",
      operation_code: p.operations?.operation_code,
      operation_id: p.operation_id,
      status: p.operations?.status,
      client: p.operations?.clients ? `${p.operations.clients.client_code} - ${p.operations.clients.first_name || ""}` : null,
    });
  }

  // 3. Purchase_notification_trackings (avisos pendientes)
  const notifTrk = await sb(`/rest/v1/purchase_notification_trackings?select=id,tracking_code,received_at,notification_id,purchase_notifications!inner(id,status,client_id,clients(client_code,first_name,last_name))&tracking_code=ilike.${encodeURIComponent("%" + code + "%")}&received_at=is.null&limit=10`);
  for (const t of (Array.isArray(notifTrk) ? notifTrk : [])) {
    const notif = t.purchase_notifications;
    if (!notif || notif.status === "cancelled") continue;
    conflicts.push({
      type: "notification",
      where: "Aviso de compra pendiente",
      operation_code: null,
      operation_id: null,
      notification_id: notif.id,
      status: notif.status,
      client: notif.clients ? `${notif.clients.client_code} - ${notif.clients.first_name || ""}` : null,
    });
  }

  // 4. Unassigned_packages (huérfanos sin cliente asignado)
  const orphans = await sb(`/rest/v1/unassigned_packages?select=id,national_tracking,assigned_to_op_id&national_tracking=ilike.${encodeURIComponent("%" + code + "%")}&assigned_to_op_id=is.null&limit=10`);
  for (const o of (Array.isArray(orphans) ? orphans : [])) {
    conflicts.push({
      type: "orphan",
      where: "Paquete huérfano (sin cliente)",
      operation_code: null,
      operation_id: null,
      orphan_id: o.id,
      status: null,
      client: "—",
    });
  }

  return Response.json({ ok: true, code, duplicates: conflicts, count: conflicts.length });
}
