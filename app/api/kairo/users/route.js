// /api/kairo/users   (solo el admin de Kairo)
//   GET                          → usuarios de Kairo (nombre, email, foto)
//   POST { email, password }    → crea la cuenta con rol "kairo": entra solo a /kairo. El nombre y
//                                  lo demás los completa la persona al entrar por primera vez.
//   PATCH { id, email?, password? } → cambia el email y/o la contraseña (solo cuentas "kairo").
//   DELETE ?id=…                 → borra la cuenta y todos sus datos de Kairo (solo cuentas "kairo").

import { SB_URL } from "../../../../lib/sb-client";
import { sb, arr, kairoUser } from "../../../../lib/kairo-server";

const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
export const dynamic = "force-dynamic";

export async function GET(req) {
  const me = await kairoUser(req);
  if (me?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
  const profiles = arr(await sb(`/rest/v1/kairo_profile?select=user_id,nombre,avatar`));
  const ids = profiles.map(p => p.user_id);
  const kairos = arr(await sb(`/rest/v1/profiles?role=eq.kairo&select=id,email,role`));
  const emails = ids.length ? arr(await sb(`/rest/v1/profiles?id=in.(${ids.join(",")})&select=id,email,role`)) : [];
  const all = new Map();
  for (const p of [...emails, ...kairos]) all.set(p.id, { id: p.id, email: p.email, role: p.role, nombre: null, avatar: null });
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

// Solo se tocan cuentas con rol "kairo" (nunca el admin ni cuentas de Argencargo).
async function kairoAccount(id) {
  const [p] = arr(await sb(`/rest/v1/profiles?id=eq.${id}&select=id,role`));
  return p?.role === "kairo" ? p : null;
}
const adminAuth = (path, init = {}) => fetch(`${SB_URL}/auth/v1/admin/users${path}`, { ...init, headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) } });

export async function PATCH(req) {
  const me = await kairoUser(req);
  if (me?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
  const { id, email, password } = await req.json().catch(() => ({}));
  if (!id || !(await kairoAccount(id))) return Response.json({ error: "Esa cuenta no se puede editar desde Kairo" }, { status: 400 });
  const body = { email_confirm: true };
  if (email) {
    const mail = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return Response.json({ error: "Email inválido" }, { status: 400 });
    body.email = mail;
  }
  if (password) {
    if (String(password).length < 6) return Response.json({ error: "La contraseña tiene que tener al menos 6 caracteres" }, { status: 400 });
    body.password = String(password);
  }
  if (!body.email && !body.password) return Response.json({ error: "No hay nada para cambiar" }, { status: 400 });
  const r = await adminAuth(`/${id}`, { method: "PUT", body: JSON.stringify(body) });
  const u = await r.json().catch(() => ({}));
  if (!r.ok) return Response.json({ error: /already|registered|exists/i.test(u?.msg || u?.message || "") ? "Ya existe una cuenta con ese email" : (u?.msg || u?.message || "No se pudo guardar") }, { status: 400 });
  if (body.email) await sb(`/rest/v1/profiles?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ email: body.email }) });
  return Response.json({ ok: true });
}

const KAIRO_TABLES = ["kairo_stories", "kairo_sets", "kairo_workouts", "kairo_routine_exercises", "kairo_routines", "kairo_ai", "kairo_body_logs", "kairo_rest_timers",
  "kairo_incomes", "kairo_budgets", "kairo_merchant_rules", "mp_expenses", "mp_expense_categories", "kairo_profile"];

export async function DELETE(req) {
  const me = await kairoUser(req);
  if (me?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !(await kairoAccount(id))) return Response.json({ error: "Esa cuenta no se puede eliminar desde Kairo" }, { status: 400 });
  for (const t of KAIRO_TABLES) await sb(`/rest/v1/${t}?user_id=eq.${id}`, { method: "DELETE" });
  await sb(`/rest/v1/kairo_exercises?created_by=eq.${id}`, { method: "DELETE" });
  await sb(`/rest/v1/push_subscriptions?user_id=eq.${id}`, { method: "DELETE" });
  await sb(`/rest/v1/profiles?id=eq.${id}`, { method: "DELETE" });
  const r = await adminAuth(`/${id}`, { method: "DELETE" });
  if (!r.ok) return Response.json({ error: "Se borraron sus datos pero no la cuenta; probá de nuevo" }, { status: 500 });
  return Response.json({ ok: true });
}
