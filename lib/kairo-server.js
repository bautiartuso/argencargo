// Helpers de servidor para Kairo (rutas /api/kairo/*): Supabase con service role y quién pide.
// Usuarios de Kairo = profiles.role 'admin' (el dueño) o 'kairo' (cuentas creadas para amigos).
import { SB_URL, SB_KEY } from "./sb-client";

const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const sb = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}${path}`, {
    ...init,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return null; }
};
export const arr = (x) => (Array.isArray(x) ? x : []);

// { id, role, email } del usuario del token, o null si no es usuario de Kairo.
export async function kairoUser(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!token) return null;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null);
  if (!u?.id) return null;
  const [p] = arr(await sb(`/rest/v1/profiles?id=eq.${u.id}&select=role`));
  return p && ["admin", "kairo"].includes(p.role) ? { id: u.id, role: p.role, email: u.email } : null;
}

// Dueño de la cuenta de Mercado Pago (el admin que usa Kairo): sus movimientos son los que se sincronizan.
export async function mpOwnerId() {
  const admins = arr(await sb(`/rest/v1/profiles?role=eq.admin&select=id`)).map(p => p.id);
  if (!admins.length) return null;
  const [k] = arr(await sb(`/rest/v1/kairo_profile?user_id=in.(${admins.join(",")})&select=user_id&limit=1`));
  return k?.user_id || null;
}
