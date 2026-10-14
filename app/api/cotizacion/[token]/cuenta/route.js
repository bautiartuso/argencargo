// POST /api/cotizacion/[token]/cuenta  { email, password }
// Los clientes de GI los crea el socio sin cuenta (email "—"). Como el link de la cotización pide
// iniciar sesión, desde acá el cliente crea SU cuenta y queda atada a la ficha que ya existe (si se
// registrara por el portal se duplicaría la ficha). Solo funciona si la ficha todavía no tiene cuenta.
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;

const sb = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}${path}`, { ...init, headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const txt = await r.text(); let body = null; try { body = JSON.parse(txt); } catch {}
  return { status: r.status, body };
};

export async function POST(req, { params }) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  const { token } = await params;
  let body = {}; try { body = await req.json(); } catch {}
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Email inválido" }, { status: 400 });
  if (password.length < 6) return Response.json({ error: "La contraseña tiene que tener al menos 6 caracteres" }, { status: 400 });

  const q = await sb(`/rest/v1/gi_quotes?public_token=eq.${encodeURIComponent(token || "")}&select=id,request_id,gi_quote_requests(client_id,clients(id,auth_user_id,first_name,last_name,email))`);
  const quote = Array.isArray(q.body) ? q.body[0] : null;
  const cl = quote?.gi_quote_requests?.clients;
  if (!cl) return Response.json({ error: "Cotización no encontrada" }, { status: 404 });
  if (cl.auth_user_id) return Response.json({ error: "Ya tenés cuenta. Iniciá sesión.", tiene_cuenta: true }, { status: 409 });

  const u = await sb(`/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { role: "cliente", first_name: cl.first_name || "", last_name: cl.last_name || "" } }),
  });
  if (u.status >= 400 || !u.body?.id) {
    const ya = /already|registered|exists/i.test(JSON.stringify(u.body || ""));
    return Response.json({ error: ya ? "Ese email ya tiene cuenta. Iniciá sesión con él." : "No se pudo crear la cuenta" }, { status: ya ? 409 : 500 });
  }
  const uid = u.body.id;

  // Ata la cuenta a la ficha (solo si sigue sin cuenta: evita pisar si dos lo hacen a la vez).
  const link = await sb(`/rest/v1/clients?id=eq.${cl.id}&auth_user_id=is.null`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ auth_user_id: uid, ...((!cl.email || cl.email === "—") ? { email } : {}) }),
  });
  if (!Array.isArray(link.body) || !link.body.length) {
    await sb(`/auth/v1/admin/users/${uid}`, { method: "DELETE" });
    return Response.json({ error: "Ya tenés cuenta. Iniciá sesión.", tiene_cuenta: true }, { status: 409 });
  }
  // El perfil lo crea el trigger de alta; por las dudas, se asegura.
  const p = await sb(`/rest/v1/profiles?id=eq.${uid}&select=id`);
  if (!Array.isArray(p.body) || !p.body.length) {
    await sb(`/rest/v1/profiles`, { method: "POST", body: JSON.stringify({ id: uid, role: "cliente", email }) });
  }
  await sb(`/rest/v1/gi_quote_communications`, { method: "POST", body: JSON.stringify({ quote_id: quote.id, request_id: quote.request_id, type: "account_created", meta: { user_id: uid, email } }) });
  return Response.json({ ok: true });
}
