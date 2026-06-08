// GET /api/ccfinanciera/share/[token]
// Endpoint público read-only para que SOLFIN vea la CC sin login.
// Valida el token activo y devuelve los movimientos.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

async function sb(path, init = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    ...init,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, ...(init.headers || {}) },
  });
  return r.json();
}

export async function GET(_req, { params }) {
  try {
    if (!SB_SERVICE) return Response.json({ ok: false, error: "server no configurado" }, { status: 500 });
    const token = params?.token;
    if (!token) return Response.json({ ok: false, error: "token requerido" }, { status: 400 });

    // 1. Validar token activo
    const tokenRow = await sb(`/rest/v1/cc_solfin_share_tokens?token=eq.${encodeURIComponent(token)}&active=eq.true&select=id,label,created_at&limit=1`);
    if (!Array.isArray(tokenRow) || tokenRow.length === 0) {
      return Response.json({ ok: false, error: "Link inválido o revocado" }, { status: 404 });
    }

    // 2. Traer todos los movimientos
    const movs = await sb(`/rest/v1/cc_solfin_movements?select=*&order=date.desc,created_at.desc`);
    return Response.json({
      ok: true,
      share: { label: tokenRow[0].label, created_at: tokenRow[0].created_at },
      movements: Array.isArray(movs) ? movs : [],
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
