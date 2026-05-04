// /api/tickets/[id] — GET detalle + comentarios, PATCH actualizar (admin), POST agregar comentario
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

export async function GET(_req, { params }) {
  const { id } = params;
  const t = await sb(`/rest/v1/support_tickets?id=eq.${id}&select=*,clients(client_code,first_name,last_name,email),operations(operation_code)`);
  const ticket = Array.isArray(t) ? t[0] : null;
  if (!ticket) return j({ ok: false, error: "no encontrado" }, 404);
  const comments = await sb(`/rest/v1/support_ticket_comments?ticket_id=eq.${id}&order=created_at.asc&select=*`);
  return j({ ok: true, ticket, comments: Array.isArray(comments) ? comments : [] });
}

export async function PATCH(req, { params }) {
  const { id } = params;
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
  const row = await sb(`/rest/v1/support_ticket_comments`, {
    method: "POST",
    body: {
      ticket_id: id,
      author_type: body.author_type || "admin",
      author_id: body.author_id || null,
      body: String(body.body).slice(0, 5000),
      is_internal: !!body.is_internal,
    },
  });
  if (!row) return j({ ok: false, error: "no se pudo crear comentario" }, 500);
  return j({ ok: true, comment: Array.isArray(row) ? row[0] : row });
}
