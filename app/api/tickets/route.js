// /api/tickets — GET listado (admin: todos / cliente: solo propios), POST crear
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    method: opts.method || "GET",
    headers: {
      apikey: SB,
      Authorization: `Bearer ${SB}`,
      "Content-Type": "application/json",
      ...(opts.method === "POST" ? { Prefer: "return=representation" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (!r.ok) return null;
  if (r.status === 204) return true;
  return r.json();
}

const j = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export async function GET(req) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId");
  const status = url.searchParams.get("status");
  const limit = Math.min(500, Number(url.searchParams.get("limit")) || 200);

  let q = `?select=*,clients(client_code,first_name,last_name),operations(operation_code)&order=updated_at.desc&limit=${limit}`;
  if (clientId) q += `&client_id=eq.${clientId}`;
  if (status) q += `&status=eq.${status}`;
  const rows = await sb(`/rest/v1/support_tickets${q}`);
  return j({ ok: true, tickets: Array.isArray(rows) ? rows : [] });
}

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body) return j({ ok: false, error: "body inválido" }, 400);
  const { client_id, operation_id, subject, description, category, priority, created_by_type } = body;
  if (!subject || !description) return j({ ok: false, error: "subject y description requeridos" }, 400);
  const row = await sb(`/rest/v1/support_tickets`, {
    method: "POST",
    body: {
      client_id: client_id || null,
      operation_id: operation_id || null,
      subject: String(subject).slice(0, 200),
      description: String(description).slice(0, 5000),
      category: category || "general",
      priority: priority || "normal",
      status: "open",
      created_by_type: created_by_type || "client",
    },
  });
  if (!row) return j({ ok: false, error: "no se pudo crear" }, 500);
  const ticket = Array.isArray(row) ? row[0] : row;

  // Notificación a admin
  try {
    await sb(`/rest/v1/notifications`, {
      method: "POST",
      body: {
        portal: "admin",
        title: `🎫 Nuevo ticket: ${ticket.subject}`,
        body: `Prioridad: ${ticket.priority} · Categoría: ${ticket.category}`,
        link: `?page=tickets&id=${ticket.id}`,
      },
    });
  } catch (e) { /* notifs es opcional */ }

  return j({ ok: true, ticket });
}
