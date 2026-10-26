// Factura comercial del vuelo (26/10/2026): la que genera el courier (exportador → consignatario,
// con la guía, la mercadería y los valores). El agente la sube al despachar, junto con el desglose
// de bultos. Va al bucket privado "legajos" y queda en el legajo de cada op del vuelo
// (legajo_docs, tipo factura_comercial) más flights.commercial_invoice_path para que el agente
// (que no lee legajo_docs) sepa que ya está. El agente no tiene RLS sobre legajo_docs ni sobre el
// bucket: por eso pasa por acá con la clave del servidor.
//   POST multipart: flight_id, file (PDF o imagen) → { ok, path, name }

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const BUCKET = "legajos";
export const maxDuration = 30;

const svc = (path, init = {}) => fetch(`${SB_URL}${path}`, { ...init, cache: "no-store", headers: { apikey: SB, Authorization: `Bearer ${SB}`, ...(init.headers || {}) } });

async function quienEs(req) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return null;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!u?.id) return null;
  const [prof, sgn] = await Promise.all([
    svc(`/rest/v1/profiles?id=eq.${u.id}&select=role&limit=1`).then((r) => r.json()).catch(() => []),
    svc(`/rest/v1/agent_signups?auth_user_id=eq.${u.id}&select=status&limit=1`).then((r) => r.json()).catch(() => []),
  ]);
  const role = Array.isArray(prof) && prof[0] ? prof[0].role : null;
  return { id: u.id, staff: role === "admin" || role === "empleado", agente: Array.isArray(sgn) && sgn[0]?.status === "approved" };
}

export async function POST(req) {
  try {
    const yo = await quienEs(req);
    if (!yo || !(yo.staff || yo.agente)) return Response.json({ ok: false, error: "no_auth" }, { status: 401 });
    const form = await req.formData();
    const flightId = String(form.get("flight_id") || "");
    const file = form.get("file");
    if (!/^[0-9a-f-]{36}$/i.test(flightId) || !file || typeof file === "string") return Response.json({ ok: false, error: "faltan_datos" }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return Response.json({ ok: false, error: "archivo_grande" }, { status: 400 });
    const fl = await svc(`/rest/v1/flights?id=eq.${flightId}&select=id,agent_id,flight_code&limit=1`).then((r) => r.json()).catch(() => []);
    const flight = Array.isArray(fl) ? fl[0] : null;
    if (!flight) return Response.json({ ok: false, error: "vuelo_inexistente" }, { status: 404 });
    if (!yo.staff && flight.agent_id !== yo.id) return Response.json({ ok: false, error: "no_es_tu_vuelo" }, { status: 403 });

    const nombre = String(file.name || "factura.pdf");
    const ext = (nombre.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
    const path = `${new Date().toISOString().slice(0, 7)}/factura_comercial-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await svc(`/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers: { "Content-Type": file.type || "application/pdf", "x-upsert": "false" }, body: file });
    if (!up.ok) return Response.json({ ok: false, error: `storage_${up.status}` }, { status: 500 });

    const ahora = new Date().toISOString();
    const fos = await svc(`/rest/v1/flight_operations?flight_id=eq.${flightId}&select=operation_id`).then((r) => r.json()).catch(() => []);
    const opIds = [...new Set((Array.isArray(fos) ? fos : []).map((x) => x.operation_id).filter(Boolean))];
    if (opIds.length) {
      await svc(`/rest/v1/legajo_docs?operation_id=in.(${opIds.join(",")})&tipo=eq.factura_comercial&borrado_at=is.null`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ borrado_at: ahora }) });
      const ins = await svc(`/rest/v1/legajo_docs`, { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(opIds.map((id) => ({ operation_id: id, flight_id: flightId, tipo: "factura_comercial", storage_path: path, file_name: nombre, uploaded_by: yo.id, uploaded_at: ahora }))) });
      if (!ins.ok) return Response.json({ ok: false, error: `legajo_${ins.status} (¿falta correr migrations/2026_10_26_factura_comercial.sql?)` }, { status: 500 });
    }
    await svc(`/rest/v1/flights?id=eq.${flightId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ commercial_invoice_path: path, commercial_invoice_name: nombre }) });
    return Response.json({ ok: true, path, name: nombre, ops: opIds.length });
  } catch (e) {
    console.error("factura-vuelo", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
