// /api/tickets/[id] — GET detalle + comentarios, PATCH actualizar (admin), POST agregar comentario
import { quienLlama } from "../../../../lib/auth-server";
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    method: opts.method || "GET",
    headers: {
      apikey: SB,
      Authorization: `Bearer ${SB}`,
      "Content-Type": "application/json",
      ...(opts.method && opts.method !== "GET" ? { Prefer: "return=representation" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (!r.ok) return null;
  if (r.status === 204) return true;
  return r.json();
}
const j = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });

// 28/10/2026: el equipo ve y edita todo; el cliente solo su ticket, sin comentarios internos.
const UUID = /^[0-9a-f-]{36}$/i;
async function ticketDe(id) { const t = await sb(`/rest/v1/support_tickets?id=eq.${id}&select=*,clients(client_code,first_name,last_name,email),operations(operation_code)`); return Array.isArray(t) ? t[0] : null; }
export async function GET(req, { params }) {
  const { id } = params;
  if (!UUID.test(id || "")) return j({ ok: false, error: "id" }, 400);
  const yo = await quienLlama(req);
  if (!yo) return j({ ok: false, error: "no_auth" }, 401);
  const ticket = await ticketDe(id);
  if (!ticket || (!yo.staff && ticket.client_id !== yo.clientId)) return j({ ok: false, error: "no encontrado" }, 404);
  const comments = await sb(`/rest/v1/support_ticket_comments?ticket_id=eq.${id}&order=created_at.asc&select=*${yo.staff ? "" : "&is_internal=eq.false"}`);
  return j({ ok: true, ticket, comments: Array.isArray(comments) ? comments : [] });
}

export async function PATCH(req, { params }) {
  const { id } = params;
  const yo = await quienLlama(req);
  if (!yo?.staff) return j({ ok: false, error: "no_auth" }, 401);
  if (!UUID.test(id || "")) return j({ ok: false, error: "id" }, 400);
  const body = await req.json().catch(() => null);
  if (!body) return j({ ok: false, error: "body inválido" }, 400);
  const allowed = ["status", "priority", "category", "assigned_to", "subject"];
  const upd = {};
  for (const k of allowed) if (k in body) upd[k] = body[k];
  if (Object.keys(upd).length === 0) return j({ ok: false, error: "nada para actualizar" }, 400);
  const r = await sb(`/rest/v1/support_tickets?id=eq.${id}`, { method: "PATCH", body: upd });
  if (!r) return j({ ok: false, error: "no se pudo actualizar" }, 500);
  return j({ ok: true, ticket: Array.isArray(r) ? r[0] : r });
}

export async function POST(req, { params }) {
  const { id } = params;
  const body = await req.json().catch(() => null);
  if (!body || !body.body) return j({ ok: false, error: "body requerido" }, 400);
  if (!UUID.test(id || "")) return j({ ok: false, error: "id" }, 400);
  const yo = await quienLlama(req);
  if (!yo) return j({ ok: false, error: "no_auth" }, 401);
  if (!yo.staff) { const t = await ticketDe(id); if (!t || t.client_id !== yo.clientId) return j({ ok: false, error: "no encontrado" }, 404); }
  const row = await sb(`/rest/v1/support_ticket_comments`, {
    method: "POST",
    body: {
      ticket_id: id,
      author_type: yo.staff ? (body.author_type || "admin") : "client",
      author_id: yo.staff ? (body.author_id || null) : yo.clientId,
      body: String(body.body).slice(0, 5000),
      is_internal: yo.staff ? !!body.is_internal : false,
    },
  });
  if (!row) return j({ ok: false, error: "no se pudo crear comentario" }, 500);
  return j({ ok: true, comment: Array.isArray(row) ? row[0] : row });
}
