// /api/kairo/users   (solo el admin de Kairo)
//   GET                          → usuarios de Kairo (nombre, email, foto)
//   POST { email, password }    → crea la cuenta con rol "kairo": entra solo a /kairo. El nombre y
//                                  lo demás los completa la persona al entrar por primera vez.

import { SB_URL } from "../../../../lib/sb-client";
import { sb, arr, kairoUser } from "../../../../lib/kairo-server";

const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
export const dynamic = "force-dynamic";

export async function GET(req) {
  const me = await kairoUser(req);
  if (me?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
  const profiles = arr(await sb(`/rest/v1/kairo_profile?select=user_id,nombre,avatar`));
  const ids = profiles.map(p => p.user_id);
  const kairos = arr(await sb(`/rest/v1/profiles?role=eq.kairo&select=id,email`));
  const emails = ids.length ? arr(await sb(`/rest/v1/profiles?id=in.(${ids.join(",")})&select=id,email`)) : [];
  const all = new Map();
  for (const p of [...emails, ...kairos]) all.set(p.id, { id: p.id, email: p.email, nombre: null, avatar: null });
  for (const p of profiles) if (all.has(p.user_id)) Object.assign(all.get(p.user_id), { nombre: p.nombre, avatar: p.avatar });
  return Response.json({ users: [...all.values()] });
}

export async function POST(req) {
  const me = await kairoUser(req);
  if (me?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
  const { email, password, nombre } = await req.json().catch(() => ({}));
  const mail = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return Response.json({ error: "Email inválido" }, { status: 400 });
  if (!password || String(password).length < 6) return Response.json({ error: "La contraseña tiene que tener al menos 6 caracteres" }, { status: 400 });

  const r = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: mail, password, email_confirm: true }),
  });
  const u = await r.json().catch(() => ({}));
  if (!r.ok || !u?.id) return Response.json({ error: /already|registered|exists/i.test(u?.msg || u?.message || "") ? "Ya existe una cuenta con ese email" : (u?.msg || u?.message || "No se pudo crear la cuenta") }, { status: 400 });

  // El trigger de alta crea el perfil de Argencargo como cliente: se pasa a "kairo" (solo Kairo).
  const [prof] = arr(await sb(`/rest/v1/profiles?id=eq.${u.id}&select=id`));
  const res = prof
    ? await sb(`/rest/v1/profiles?id=eq.${u.id}`, { method: "PATCH", body: JSON.stringify({ role: "kairo" }), headers: { Prefer: "return=representation" } })
    : await sb(`/rest/v1/profiles`, { method: "POST", body: JSON.stringify({ id: u.id, email: mail, role: "kairo" }), headers: { Prefer: "return=representation" } });
  if (!Array.isArray(res) || !res[0]) {
    // Sin el rol no puede quedar: borramos la cuenta para no dejar un cliente suelto.
    await fetch(`${SB_URL}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } });
    return Response.json({ error: "No se pudo asignar el rol de Kairo (¿corriste el SQL de usuarios?)" }, { status: 500 });
  }
  await sb(`/rest/v1/kairo_profile`, { method: "POST", body: JSON.stringify({ user_id: u.id, nombre: String(nombre || "").trim() || null }), headers: { Prefer: "return=minimal" } });
  return Response.json({ ok: true, id: u.id });
}
