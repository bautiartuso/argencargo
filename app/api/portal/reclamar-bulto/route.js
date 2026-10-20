// /api/portal/reclamar-bulto (20/10/2026)
// POST { tracking, note?, client_id? }  → el cliente reclama desde su Depósito un bulto que no le
//   figura. Se crea un reclamo (deposit_claims) por CADA agente de China aprobado: el que lo tenga
//   lo registra y, al registrarlo, se cierran los de los demás. El agente no puede rechazarlo.
// GET                                    → reclamos del cliente (pendientes + últimos 30 días).
// Va con service role: el cliente no tiene policies sobre deposit_claims ni agent_signups.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const UUID = /^[0-9a-f-]{36}$/i;

async function svc(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, { ...opts, headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const txt = await r.text(); let data = null; try { data = JSON.parse(txt); } catch { data = txt; }
  return { ok: r.ok, data, status: r.status };
}

// Quién pide: el cliente logueado (o el equipo en nombre de un cliente).
async function quien(req, bodyClientId) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return null;
  const user = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!user?.id) return null;
  const [cl, prof] = await Promise.all([
    svc(`/rest/v1/clients?auth_user_id=eq.${user.id}&select=id,client_code&limit=1`),
    svc(`/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`),
  ]);
  const own = Array.isArray(cl.data) && cl.data[0] ? cl.data[0] : null;
  const staff = Array.isArray(prof.data) && ["admin", "empleado"].includes(prof.data[0]?.role);
  if (bodyClientId && UUID.test(bodyClientId) && (staff || bodyClientId === own?.id)) {
    const c = await svc(`/rest/v1/clients?id=eq.${bodyClientId}&select=id,client_code&limit=1`);
    return Array.isArray(c.data) && c.data[0] ? { client: c.data[0], userId: user.id } : null;
  }
  return own ? { client: own, userId: user.id } : null;
}

const norm = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function GET(req) {
  const url = new URL(req.url);
  const q = await quien(req, url.searchParams.get("client_id") || "");
  if (!q) return Response.json({ error: "no_auth" }, { status: 401 });
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const r = await svc(`/rest/v1/deposit_claims?client_id=eq.${q.client.id}&or=(status.eq.pendiente,created_at.gte.${desde})&select=id,tracking,tracking_norm,status,note,created_at,resolved_at,agent_id&order=created_at.desc`);
  const rows = Array.isArray(r.data) ? r.data : [];
  // Un reclamo del cliente = varias filas (una por agente): se muestran agrupadas por tracking.
  const porTrk = {};
  rows.forEach((c) => { const k = c.tracking_norm; if (!porTrk[k]) porTrk[k] = { tracking: c.tracking, created_at: c.created_at, status: "pendiente", agentes: 0, resolved_at: null }; const g = porTrk[k]; g.agentes++; if (c.status === "recibido") { g.status = "recibido"; g.resolved_at = c.resolved_at; } else if (c.status === "cancelado" && g.status !== "recibido" && rows.filter((x) => x.tracking_norm === k).every((x) => x.status === "cancelado")) g.status = "cancelado"; });
  return Response.json({ ok: true, reclamos: Object.values(porTrk) });
}

export async function POST(req) {
  let body = {}; try { body = await req.json(); } catch {}
  const q = await quien(req, String(body.client_id || ""));
  if (!q) return Response.json({ error: "no_auth" }, { status: 401 });
  const tracking = String(body.tracking || "").trim().slice(0, 80);
  if (norm(tracking).length < 6) return Response.json({ error: "tracking_invalido" }, { status: 400 });
  const note = String(body.note || "").trim().slice(0, 300);

  // ¿Ya está registrado a su nombre? Entonces no hace falta reclamar.
  const suf = norm(tracking).slice(-8);
  const ya = await svc(`/rest/v1/operation_packages?client_id=eq.${q.client.id}&national_tracking=ilike.*${suf}*&select=id&limit=1`);
  if (Array.isArray(ya.data) && ya.data.length) return Response.json({ error: "ya_registrado" }, { status: 409 });
  // ¿Ya lo reclamó?
  const prev = await svc(`/rest/v1/deposit_claims?client_id=eq.${q.client.id}&tracking_norm=eq.${norm(tracking)}&status=eq.pendiente&select=id&limit=1`);
  if (Array.isArray(prev.data) && prev.data.length) return Response.json({ error: "ya_reclamado" }, { status: 409 });

  // Agentes de China aprobados (mismo criterio que el admin: aprobado, con usuario, no USA).
  const ag = await svc(`/rest/v1/agent_signups?status=eq.approved&auth_user_id=not.is.null&select=auth_user_id,country`);
  const agentes = (Array.isArray(ag.data) ? ag.data : []).filter((a) => !/estados unidos|usa|united states/i.test(String(a.country || "")));
  if (!agentes.length) return Response.json({ error: "sin_agentes" }, { status: 500 });

  const filas = agentes.map((a) => ({ tracking, client_id: q.client.id, agent_id: a.auth_user_id, origin: "China", note: `Reclamado por el cliente desde el portal${note ? ` · ${note}` : ""}`, created_by: null }));
  const ins = await svc(`/rest/v1/deposit_claims`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(filas) });
  if (!ins.ok) return Response.json({ error: "no_se_guardo", detail: ins.data }, { status: 500 });
  // Aviso al admin.
  try {
    const adm = await svc(`/rest/v1/profiles?role=eq.admin&select=id&limit=1`);
    const adminId = Array.isArray(adm.data) && adm.data[0] ? adm.data[0].id : null;
    if (adminId) await svc(`/rest/v1/notifications`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: adminId, portal: "admin", title: "📦 Un cliente reclamó un bulto desde el portal", body: `${q.client.client_code} · ${tracking}${note ? ` · ${note}` : ""}`, link: null }) });
  } catch {}
  return Response.json({ ok: true, agentes: agentes.length });
}
