// GET /api/admin/email-status?ids=a,b,c — estado de entrega en Resend de los mails enviados
// (delivered / bounced / complained / delivery_delayed…). Solo admin. Sirve para diagnosticar
// "al cliente no le llegó" sin entrar al panel de Resend (06/10/2026).
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

export const dynamic = "force-dynamic";

async function esAdmin(req) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return false;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!u?.id) return false;
  const p = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${u.id}&select=role&limit=1`, { headers: { apikey: SB, Authorization: `Bearer ${SB}` } }).then((r) => r.json()).catch(() => []);
  return Array.isArray(p) && p[0]?.role === "admin";
}

export async function GET(req) {
  if (!(await esAdmin(req))) return Response.json({ error: "sin_permiso" }, { status: 401 });
  const key = process.env.RESEND_API_KEY;
  if (!key) return Response.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });
  const ids = (new URL(req.url).searchParams.get("ids") || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 30);
  const out = await Promise.all(ids.map(async (id) => {
    const r = await fetch(`https://api.resend.com/emails/${id}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    return { id, estado: d.last_event || d.status || null, error: r && !r.ok ? (d.message || r.status) : null, from: d.from || null, created_at: d.created_at || null };
  }));
  return Response.json({ emails: out }, { headers: { "Cache-Control": "no-store" } });
}
