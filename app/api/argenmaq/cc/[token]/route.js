// GET /api/argenmaq/cc/[token] — lectura pública de la CC Financiera de Argenmaq para quien
// tenga el link (el chico de la financiera), sin login. Valida el token activo.
export const dynamic = "force-dynamic";
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const sb = async (path) => (await fetch(`${SB_URL}${path}`, { cache: "no-store", headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } })).json();

export async function validarToken(token) {
  if (!SB_SERVICE || !token) return null;
  const rows = await sb(`/rest/v1/cat_cc_tokens?token=eq.${encodeURIComponent(token)}&active=eq.true&select=id,label,created_at&limit=1`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
export async function movimientos() {
  const m = await sb(`/rest/v1/cat_cc_financiera?select=id,fecha,tipo,moneda,monto,comision_pct,comision,acreditado,tipo_cambio,concepto,comprobante_url,created_at&order=fecha.desc,created_at.desc`);
  return Array.isArray(m) ? m : [];
}
export async function GET(_req, { params }) {
  try {
    if (!SB_SERVICE) return Response.json({ ok: false, error: "server no configurado" }, { status: 500 });
    const t = await validarToken(params?.token);
    if (!t) return Response.json({ ok: false, error: "Link inválido o revocado" }, { status: 404 });
    return Response.json({ ok: true, share: t, movimientos: await movimientos() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return Response.json({ ok: false, error: e.message }, { status: 500 }); }
}
