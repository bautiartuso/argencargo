// /api/catalogo/usuarios — cambiar el mail o la contraseña de un usuario del equipo desde
// Ajustes → Usuarios de Argenmaq. Regla de Bautista: si alguien se olvidó la contraseña, se la
// cambia él desde el panel. Solo admin/empleado/socio GI pueden llamar, y solo sobre cuentas
// del equipo (nunca sobre un cliente).
export const dynamic = "force-dynamic";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

async function quien(token) {
  if (!token) return null;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!u.ok) return null;
  const { id } = await u.json();
  const p = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${id}&select=id,role,is_gi_partner,argenmaq_role`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const rows = await p.json();
  const prof = Array.isArray(rows) ? rows[0] : null;
  if (!prof || !(["admin", "empleado"].includes(prof.role) || prof.is_gi_partner === true || prof.argenmaq_role)) return null;
  return prof;
}
const svc = (path, init = {}) => fetch(`${SB_URL}${path}`, { ...init, cache: "no-store", headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) } });

export async function GET(req) {
  try {
    if (!SB_SERVICE) return Response.json({ error: "server no configurado" }, { status: 500 });
    const token = String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!(await quien(token))) return Response.json({ error: "No autorizado" }, { status: 401 });
    const q = new URL(req.url).searchParams.get("buscar");
    if (q) {
      const s = q.trim().toLowerCase().replace(/[%,()]/g, "");
      const r = await svc(`/rest/v1/profiles?select=id,email,role,is_gi_partner,argenmaq_role&email=ilike.*${encodeURIComponent(s)}*&limit=6`);
      const rows = await r.json();
      return Response.json({ usuarios: Array.isArray(rows) ? rows : [] });
    }
    const r = await svc(`/rest/v1/profiles?select=id,email,role,is_gi_partner,argenmaq_role,created_at&or=(role.eq.admin,role.eq.empleado,is_gi_partner.eq.true,argenmaq_role.not.is.null)&order=created_at.asc`);
    const rows = await r.json();
    return Response.json({ usuarios: Array.isArray(rows) ? rows : [] });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req) {
  try {
    if (!SB_SERVICE) return Response.json({ error: "server no configurado" }, { status: 500 });
    const token = String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!(await quien(token))) return Response.json({ error: "No autorizado" }, { status: 401 });
    const b = await req.json();
    const id = String(b.id || "");
    if (!id) return Response.json({ error: "Falta el usuario" }, { status: 400 });
    const p = await (await svc(`/rest/v1/profiles?id=eq.${id}&select=id,role,is_gi_partner,argenmaq_role`)).json();
    const prof = Array.isArray(p) ? p[0] : null;
    if (!prof) return Response.json({ error: "Usuario no encontrado" }, { status: 400 });
    // Rol en ARGENMAQ: admin / socio / empleado / null (sin acceso). Puede darse a cualquier cuenta.
    if ("argenmaq_role" in b) {
      const rol = b.argenmaq_role || null;
      if (rol && !["admin", "socio", "empleado"].includes(rol)) return Response.json({ error: "Rol inválido" }, { status: 400 });
      const r = await svc(`/rest/v1/profiles?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ argenmaq_role: rol }) });
      if (!r.ok) return Response.json({ error: "No se pudo cambiar el rol" }, { status: 400 });
      if (!b.password && !b.email) return Response.json({ ok: true });
    }
    const esEquipo = ["admin", "empleado"].includes(prof.role) || prof.is_gi_partner === true || prof.argenmaq_role || ("argenmaq_role" in b && b.argenmaq_role);
    if (!esEquipo) return Response.json({ error: "Ese usuario no es del equipo" }, { status: 400 });
    const cambios = {};
    if (b.password) { if (String(b.password).length < 8) return Response.json({ error: "La contraseña tiene que tener al menos 8 caracteres" }, { status: 400 }); cambios.password = String(b.password); }
    if (b.email) { cambios.email = String(b.email).trim().toLowerCase(); cambios.email_confirm = true; }
    if (!Object.keys(cambios).length) return Response.json({ error: "Nada para cambiar" }, { status: 400 });
    const r = await svc(`/auth/v1/admin/users/${id}`, { method: "PUT", body: JSON.stringify(cambios) });
    const d = await r.json();
    if (!r.ok) return Response.json({ error: d.msg || d.message || d.error_description || "No se pudo actualizar" }, { status: 400 });
    if (cambios.email) await svc(`/rest/v1/profiles?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ email: cambios.email }) });
    return Response.json({ ok: true });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
