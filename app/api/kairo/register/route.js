// POST /api/kairo/register  { email, password }
// Alta abierta: cualquiera con el link se crea la cuenta (rol "kairo": entra solo a /kairo). Después
// entra con email y contraseña y el onboarding le pide nombre, foto y objetivo. El admin sigue viendo
// y pudiendo borrar usuarios desde Perfil.
import { sb, arr } from "../../../../lib/kairo-server";
import { SB_URL } from "../../../../lib/sb-client";

export const dynamic = "force-dynamic";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  const mail = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return Response.json({ error: "Email inválido" }, { status: 400 });
  if (!password || String(password).length < 6) return Response.json({ error: "La contraseña tiene que tener al menos 6 caracteres" }, { status: 400 });

  const r = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: mail, password, email_confirm: true }),
  });
  const u = await r.json().catch(() => ({}));
  if (!r.ok || !u?.id) return Response.json({ error: /already|registered|exists/i.test(u?.msg || u?.message || "") ? "Ya existe una cuenta con ese email. Iniciá sesión." : (u?.msg || u?.message || "No se pudo crear la cuenta") }, { status: 400 });

  // El trigger de alta crea el perfil como cliente de Argencargo: se pasa a "kairo".
  const [prof] = arr(await sb(`/rest/v1/profiles?id=eq.${u.id}&select=id`));
  const res = prof
    ? await sb(`/rest/v1/profiles?id=eq.${u.id}`, { method: "PATCH", body: JSON.stringify({ role: "kairo" }), headers: { Prefer: "return=representation" } })
    : await sb(`/rest/v1/profiles`, { method: "POST", body: JSON.stringify({ id: u.id, email: mail, role: "kairo" }), headers: { Prefer: "return=representation" } });
  if (!Array.isArray(res) || !res[0]) {
    await fetch(`${SB_URL}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } });
    return Response.json({ error: "No se pudo crear la cuenta, probá de nuevo" }, { status: 500 });
  }
  await sb(`/rest/v1/kairo_profile`, { method: "POST", body: JSON.stringify({ user_id: u.id }), headers: { Prefer: "return=minimal" } });
  return Response.json({ ok: true });
}
