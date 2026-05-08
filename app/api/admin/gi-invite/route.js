// POST /api/admin/gi-invite
// Body: { email, password?, gi_partner_pct? }
// Crea (o reutiliza) un auth user, marca el profile como is_gi_partner=true, devuelve credenciales.
// Requiere que el caller sea admin (verificado por JWT).

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

const sbFetch = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}${path}`, {
    ...init,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const txt = await r.text();
  let parsed = null; try { parsed = JSON.parse(txt); } catch {}
  return { status: r.status, body: parsed };
};

const generatePassword = () => {
  // 12 chars: letras (mayús/minús) + números + 1 símbolo
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 11; i++) p += chars[Math.floor(Math.random() * chars.length)];
  p += "!"; // garantía de símbolo
  return p;
};

export async function POST(req) {
  if (!SB_SERVICE) return Response.json({ error: "SUPABASE_SERVICE_ROLE no configurado" }, { status: 500 });

  // Verify caller is admin
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return Response.json({ error: "Auth requerido" }, { status: 401 });
  const callerToken = auth.slice(7);
  // Decode JWT payload (sin verificar firma — Supabase ya validó al recibir)
  let callerId = null;
  try {
    const payload = JSON.parse(Buffer.from(callerToken.split(".")[1], "base64").toString());
    callerId = payload.sub;
  } catch { return Response.json({ error: "Token inválido" }, { status: 401 }); }
  if (!callerId) return Response.json({ error: "Token sin sub" }, { status: 401 });

  const callerProfile = await sbFetch(`/rest/v1/profiles?id=eq.${callerId}&select=role`);
  if (!Array.isArray(callerProfile.body) || callerProfile.body[0]?.role !== "admin") {
    return Response.json({ error: "Solo admin puede invitar socios GI" }, { status: 403 });
  }

  let body = null; try { body = await req.json(); } catch {}
  if (!body?.email) return Response.json({ error: "Falta email" }, { status: 400 });
  const email = String(body.email).trim().toLowerCase();
  const password = body.password?.trim() || generatePassword();
  const pct = body.gi_partner_pct ? Number(body.gi_partner_pct) : null;

  // 1. Buscar si el profile ya existe
  const existing = await sbFetch(`/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,is_gi_partner`);
  if (Array.isArray(existing.body) && existing.body[0]) {
    // Ya existe: activar GI sin tocar password
    const p = existing.body[0];
    await sbFetch(`/rest/v1/profiles?id=eq.${p.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_gi_partner: true, gi_partner_pct: pct }),
    });
    return Response.json({
      ok: true,
      already_existed: true,
      email,
      message: `La cuenta ${email} ya existía. Acceso GI activado.`,
    });
  }

  // 2. Crear auth user vía admin API
  const createRes = await sbFetch(`/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true, // skip confirmación de mail
    }),
  });
  if (createRes.status >= 400) {
    return Response.json({ error: "No se pudo crear el usuario", detail: createRes.body }, { status: 500 });
  }
  const newUserId = createRes.body?.id;
  if (!newUserId) return Response.json({ error: "No se devolvió ID" }, { status: 500 });

  // 3. Esperar/crear profile (el trigger de Supabase lo crea, pero por las dudas)
  await new Promise(r => setTimeout(r, 400));
  const profCheck = await sbFetch(`/rest/v1/profiles?id=eq.${newUserId}&select=id`);
  if (!Array.isArray(profCheck.body) || profCheck.body.length === 0) {
    // Crear profile manualmente
    await sbFetch(`/rest/v1/profiles`, {
      method: "POST",
      body: JSON.stringify({ id: newUserId, email, role: "cliente" }),
    });
  }

  // 4. Activar GI
  await sbFetch(`/rest/v1/profiles?id=eq.${newUserId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_gi_partner: true, gi_partner_pct: pct }),
  });

  return Response.json({
    ok: true,
    already_existed: false,
    email,
    password,
    message: `Cuenta creada. Compartile estas credenciales al socio.`,
  });
}
