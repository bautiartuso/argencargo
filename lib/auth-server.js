import crypto from "crypto";
// Verificación de sesión del lado del servidor (28/10/2026).
// Antes varias rutas leían el JWT con Buffer.from(token.split(".")[1]) SIN verificar la firma: con
// un token armado a mano y el id del admin se pasaba como admin. Ahora el token se valida contra
// Supabase Auth (/auth/v1/user), que chequea firma y vencimiento, y se cachea 5 minutos.
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const _cache = new Map();

// Devuelve { sub, email } si el token es válido; si no, lanza error (los llamadores ya lo atrapan).
export async function payloadVerificado(token) {
  const t = String(token || "").replace(/^Bearer\s+/i, "").trim();
  if (!t || t.split(".").length !== 3) throw new Error("token inválido");
  const hit = _cache.get(t);
  if (hit && Date.now() - hit.t < 5 * 60e3) { if (!hit.u) throw new Error("token inválido"); return hit.u; }
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${t}` }, cache: "no-store" }).catch(() => null);
  const u = r && r.ok ? await r.json().catch(() => null) : null;
  const val = u?.id ? { sub: u.id, email: u.email || null } : null;
  _cache.set(t, { t: Date.now(), u: val });
  if (_cache.size > 500) _cache.delete(_cache.keys().next().value);
  if (!val) throw new Error("token inválido");
  return val;
}

// Rol del usuario verificado (o null). roles: lista de roles aceptados (por defecto admin y empleado).
export async function usuarioConRol(req, roles = ["admin", "empleado"]) {
  try {
    const p = await payloadVerificado(req.headers.get("authorization") || "");
    const key = process.env.SUPABASE_SERVICE_ROLE;
    const r = await fetch(`${SB_URL}/rest/v1/profiles?select=role,email,is_gi_partner&id=eq.${p.sub}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    const prof = (await r.json())?.[0];
    if (!prof || !roles.includes(prof.role)) return null;
    return { id: p.sub, role: prof.role, email: prof.email || p.email, isGiPartner: !!prof.is_gi_partner };
  } catch { return null; }
}

export const esCronValido = (req) => {
  const s = process.env.CRON_SECRET;
  return !!s && (req.headers.get("authorization") || "") === `Bearer ${s}`;
};

// Quién llama: { id, role, staff, clientId } o null. staff = admin/empleado. clientId = su ficha de cliente.
export async function quienLlama(req) {
  try {
    const p = await payloadVerificado(req.headers.get("authorization") || "");
    const key = process.env.SUPABASE_SERVICE_ROLE;
    const h = { apikey: key, Authorization: `Bearer ${key}` };
    const [pr, cl] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/profiles?select=role,is_gi_partner,argenmaq_role&id=eq.${p.sub}`, { headers: h, cache: "no-store" }).then((r) => r.json()),
      fetch(`${SB_URL}/rest/v1/clients?select=id&auth_user_id=eq.${p.sub}&limit=1`, { headers: h, cache: "no-store" }).then((r) => r.json()),
    ]);
    const prof = Array.isArray(pr) ? pr[0] : null;
    const role = prof?.role || null;
    return { id: p.sub, role, staff: role === "admin" || role === "empleado", isGiPartner: !!prof?.is_gi_partner, argenmaqRole: prof?.argenmaq_role || null, clientId: Array.isArray(cl) && cl[0] ? cl[0].id : null };
  } catch { return null; }
}

// Firma corta para links públicos (feedback de una op): HMAC del código con un secreto del servidor.
export const firmaLink = (txt) => crypto.createHmac("sha256", process.env.LINK_SECRET || process.env.CRON_SECRET || "argencargo").update(String(txt || "").toUpperCase()).digest("hex").slice(0, 16);
