// Tarifas de los agentes (03/10/2026).
// Cada agente carga, para los 5 servicios (DHL, FedEx ÷5000, FedEx ÷6000, UPS ÷5000, UPS ÷6000),
// los rangos de kg que quiera con su USD/kg, más los adicionales (baterías, marca, sobrepeso, zona
// remota) y la vigencia. Argencargo las ve en Depósito → Agentes.
//
// Se guardan como un JSON por agente en un bucket PRIVADO de Storage (agent-tariffs/<user_id>.json):
// así no hace falta una tabla nueva. Solo se accede por esta ruta, con la clave del servidor:
//   GET  → el agente recibe las suyas; admin/empleado recibe las de todos los agentes.
//   POST → el agente guarda las suyas (admin puede guardar las de cualquiera con agent_user_id).

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const BUCKET = "agent-tariffs";
const SERVICIOS = ["DHL", "FEDEX_5000", "FEDEX_6000", "UPS_5000", "UPS_6000"];

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
  const staff = role === "admin" || role === "empleado";
  const agente = Array.isArray(sgn) && sgn[0]?.status === "approved";
  return { id: u.id, staff, agente };
}

async function asegurarBucket() {
  const r = await svc(`/storage/v1/bucket/${BUCKET}`);
  if (r.ok) return;
  await svc(`/storage/v1/bucket`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) });
}

async function leer(userId) {
  const r = await svc(`/storage/v1/object/${BUCKET}/${userId}.json`);
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

const num = (v) => { if (v === "" || v == null) return null; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };

function limpiar(body) {
  const servicios = {};
  SERVICIOS.forEach((s) => {
    const filas = Array.isArray(body?.servicios?.[s]) ? body.servicios[s] : [];
    servicios[s] = filas
      .map((f) => ({ min: num(f.min) ?? 0, max: num(f.max), usd: num(f.usd) }))
      .filter((f) => f.usd != null && f.usd >= 0)
      .sort((a, b) => a.min - b.min)
      .slice(0, 20);
  });
  const e = body?.extras || {};
  const extras = {
    bateria_usd_total: num(e.bateria_usd_total),
    marca_usd_kg: num(e.marca_usd_kg),
    sobrepeso_usd_pieza: num(e.sobrepeso_usd_pieza),
    remota_usd_kg: num(e.remota_usd_kg),
    remota_min_usd: num(e.remota_min_usd),
  };
  const fecha = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
  return { servicios, extras, vigencia: { desde: fecha(body?.vigencia?.desde), hasta: fecha(body?.vigencia?.hasta) }, notas: String(body?.notas || "").slice(0, 500) };
}

export async function GET(req) {
  const yo = await quienEs(req);
  if (!yo || (!yo.staff && !yo.agente)) return Response.json({ error: "sin_permiso" }, { status: 401 });
  if (!yo.staff) return Response.json({ tarifas: await leer(yo.id) }, { headers: { "Cache-Control": "no-store" } });
  // Staff: todos los agentes aprobados, con sus tarifas (o null si todavía no cargaron).
  const ags = await svc(`/rest/v1/agent_signups?status=eq.approved&select=auth_user_id,first_name,last_name,email,country&order=created_at.asc`).then((r) => r.json()).catch(() => []);
  const lista = Array.isArray(ags) ? ags.filter((a) => a.auth_user_id) : [];
  const agentes = await Promise.all(lista.map(async (a) => ({ ...a, tarifas: await leer(a.auth_user_id) })));
  return Response.json({ agentes }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req) {
  const yo = await quienEs(req);
  if (!yo || (!yo.staff && !yo.agente)) return Response.json({ error: "sin_permiso" }, { status: 401 });
  let body = {};
  try { body = await req.json(); } catch {}
  const destino = yo.staff && /^[0-9a-f-]{36}$/i.test(String(body?.agent_user_id || "")) ? body.agent_user_id : yo.id;
  if (!yo.staff && destino !== yo.id) return Response.json({ error: "sin_permiso" }, { status: 403 });
  await asegurarBucket();
  const data = { ...limpiar(body), actualizado: new Date().toISOString() };
  const r = await svc(`/storage/v1/object/${BUCKET}/${destino}.json`, { method: "POST", headers: { "Content-Type": "application/json", "x-upsert": "true" }, body: JSON.stringify(data) });
  if (!r.ok) return Response.json({ error: "no_guardado", detalle: await r.text() }, { status: 500 });
  return Response.json({ ok: true, tarifas: data });
}
