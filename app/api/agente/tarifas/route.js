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

// ── Costo del aéreo courier (20/10/2026) ─────────────────────────────────────────────────────
// El costo que usa Argencargo para calcular la ganancia del aéreo comercial sale de la tarifa DHL
// del agente de China que las tiene cargadas (el primero aprobado con rangos DHL). Se copia a la
// tabla `tariffs` con service_key "costo_aereo_dhl" (rate = USD/kg del agente, cost = con el costo
// financiero) para que lib/calc.js la use en todas las pantallas sin tocar Storage. El costo
// financiero es la comisión que se paga por los anticipos a la cuenta corriente de ese agente en
// los últimos 12 meses (pagado ÷ acreditado − 1), guardada en calc_config.costo_financiero_pct.
// Se versiona como el resto de tarifas: la vigente se cierra (effective_to) y entra la nueva.
const SVC_COSTO_DHL = "costo_aereo_dhl";
const r2 = (n) => Math.round(n * 100) / 100;

async function agenteFuente() {
  const ags = await svc(`/rest/v1/agent_signups?status=eq.approved&auth_user_id=not.is.null&select=auth_user_id,first_name,last_name,country&order=created_at.asc`).then((r) => r.json()).catch(() => []);
  for (const a of Array.isArray(ags) ? ags : []) {
    if (/estados unidos|usa|united states/i.test(String(a.country || ""))) continue;
    const t = await leer(a.auth_user_id);
    const dhl = Array.isArray(t?.servicios?.DHL) ? t.servicios.DHL.filter((f) => f.usd != null) : [];
    if (dhl.length) return { agente: a, dhl: dhl.slice().sort((x, y) => Number(x.min || 0) - Number(y.min || 0)) };
  }
  return null;
}

async function costoFinancieroPct(agentId) {
  const desde = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const mvs = await svc(`/rest/v1/agent_account_movements?agent_id=eq.${agentId}&type=eq.anticipo&date=gte.${desde}&select=amount_usd,amount_received_usd`).then((r) => r.json()).catch(() => []);
  let pag = 0, rec = 0;
  (Array.isArray(mvs) ? mvs : []).forEach((m) => { const r = Number(m.amount_received_usd), p = Number(m.amount_usd); if (!(r > 0) || !(p >= r)) return; pag += p; rec += r; });
  return rec > 0 ? r2((pag / rec - 1) * 100) : 0;
}

async function sincronizarCostoDhl() {
  const f = await agenteFuente();
  if (!f) return { ok: false, motivo: "sin_tarifas" };
  const nombre = `${f.agente.first_name || ""} ${f.agente.last_name || ""}`.trim();
  const pct = await costoFinancieroPct(f.agente.auth_user_id);
  const nuevas = f.dhl.map((r, i) => ({
    service_key: SVC_COSTO_DHL, type: "rate", unit: "kg",
    label: `DHL ${Number(r.min || 0)}${r.max != null ? ` - ${Number(r.max)}` : "+"} kg`,
    min_qty: Number(r.min || 0), max_qty: r.max != null ? Number(r.max) : null,
    rate: r2(Number(r.usd)), cost: r2(Number(r.usd) * (1 + pct / 100)),
    sort_order: i + 1, notes: `${nombre} · DHL + ${String(pct).replace(".", ",")}% costo financiero`,
  }));
  // calc_config.costo_financiero_pct (clave única)
  await svc(`/rest/v1/calc_config?on_conflict=key`, { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "costo_financiero_pct", value: pct }) });
  const act = await svc(`/rest/v1/tariffs?service_key=eq.${SVC_COSTO_DHL}&effective_to=is.null&select=id,min_qty,max_qty,rate,cost&order=min_qty.asc`).then((r) => r.json()).catch(() => []);
  const vig = Array.isArray(act) ? act : [];
  const firma = (rows) => rows.map((r) => [Number(r.min_qty || 0), r.max_qty == null ? "" : Number(r.max_qty), Number(r.rate), Number(r.cost)].join("/")).join("|");
  if (vig.length && firma(vig) === firma(nuevas)) return { ok: true, cambiado: false, pct, agente: nombre, filas: vig.length };
  const ahora = new Date().toISOString();
  if (vig.length) await svc(`/rest/v1/tariffs?service_key=eq.${SVC_COSTO_DHL}&effective_to=is.null`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ effective_to: ahora }) });
  const ins = await svc(`/rest/v1/tariffs`, { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(nuevas.map((n) => ({ ...n, effective_from: vig.length ? ahora : null }))) });
  if (!ins.ok) return { ok: false, motivo: "no_guardado", detalle: await ins.text() };
  return { ok: true, cambiado: true, pct, agente: nombre, filas: nuevas.length };
}

// PUT → el equipo fuerza la sincronización del costo DHL (Tarifas → Actualizar desde el agente).
export async function PUT(req) {
  const yo = await quienEs(req);
  if (!yo?.staff) return Response.json({ error: "sin_permiso" }, { status: 401 });
  const r = await sincronizarCostoDhl();
  return Response.json(r, { status: r.ok ? 200 : 500 });
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
  // Si cambió la tarifa DHL del agente fuente, el costo del aéreo de Argencargo se actualiza solo.
  let sync = null; try { sync = await sincronizarCostoDhl(); } catch (e) { sync = { ok: false, motivo: String(e?.message || e) }; }
  return Response.json({ ok: true, tarifas: data, sync });
}
