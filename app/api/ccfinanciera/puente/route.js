// /api/ccfinanciera/puente — puente entre la CC financiera de Argencargo y la de MyBox (09/10/2026).
// GET  → saldos ARS/USD de la CC de MyBox (para mostrar cuánto hay para traer).
// POST { currency, amount, date, note } → trae plata de MyBox a Argencargo: egreso en la CC de
//      MyBox y su ingreso en la de Argencargo, con la misma descripción. Si el segundo paso falla
//      se borra el primero, para que nunca quede plata de un solo lado.
// Solo admin de Argencargo. Necesita MYBOX_SUPABASE_SERVICE_ROLE (clave service_role del proyecto
// de MyBox) cargada en Vercel.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const MB_URL = "https://yaolukpuufbomokwqahm.supabase.co";
const MB_SERVICE = process.env.MYBOX_SUPABASE_SERVICE_ROLE;

export const dynamic = "force-dynamic";

const req = (base, key) => (path, opts = {}) =>
  fetch(`${base}${path}`, { ...opts, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
const ac = req(SB_URL, SB_SERVICE);
const mb = req(MB_URL, MB_SERVICE);

async function esAdmin(request) {
  const tok = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!tok) return false;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!u?.id) return false;
  const p = await ac(`/rest/v1/profiles?id=eq.${u.id}&select=role&limit=1`).then((r) => r.json()).catch(() => []);
  return Array.isArray(p) && p[0]?.role === "admin";
}

async function saldosMyBox() {
  let ars = 0, usd = 0;
  for (let desde = 0; ; desde += 1000) {
    const r = await mb(`/rest/v1/cc_financiera_movements?select=type,currency,net_amount&order=id.asc`, { headers: { "Range-Unit": "items", Range: `${desde}-${desde + 999}` } });
    if (!r.ok) throw new Error("No se pudo leer la CC de MyBox");
    const filas = await r.json();
    for (const m of filas) { const s = (m.type === "ingreso" ? 1 : -1) * Number(m.net_amount || 0); if (m.currency === "USD") usd += s; else ars += s; }
    if (filas.length < 1000) break;
  }
  return { ars: Math.round(ars * 100) / 100, usd: Math.round(usd * 100) / 100 };
}

export async function GET(request) {
  if (!(await esAdmin(request))) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!MB_SERVICE) return Response.json({ error: "falta_config" }, { status: 500 });
  try { return Response.json({ ok: true, ...(await saldosMyBox()) }); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request) {
  if (!(await esAdmin(request))) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!MB_SERVICE || !SB_SERVICE) return Response.json({ error: "falta_config" }, { status: 500 });
  const b = await request.json().catch(() => ({}));
  const currency = b.currency === "USD" ? "USD" : "ARS";
  const amount = Math.round(Number(b.amount) * 100) / 100;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || "")) ? b.date : new Date().toISOString().slice(0, 10);
  const nota = String(b.note || "").trim().slice(0, 200);
  if (!(amount > 0)) return Response.json({ error: "Monto inválido" }, { status: 400 });

  const sufijo = nota ? ` · ${nota}` : "";
  // 1) Sale de MyBox
  const r1 = await mb(`/rest/v1/cc_financiera_movements`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
    date, type: "egreso", currency, amount, commission_pct: 0, commission_amount: 0, net_amount: amount,
    description: `🔁 Pase a Argencargo${sufijo}`, auto_generated: true,
  }) });
  const d1 = await r1.json().catch(() => null);
  if (!r1.ok || !Array.isArray(d1) || !d1[0]?.id) return Response.json({ error: `No se pudo registrar en MyBox: ${d1?.message || r1.status}` }, { status: 500 });
  // 2) Entra a Argencargo
  const r2 = await ac(`/rest/v1/cc_solfin_movements`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
    date, type: "ingreso", currency, amount, net_amount: amount,
    description: `🔁 Traído de MyBox${sufijo}`, auto_generated: true,
  }) });
  const d2 = await r2.json().catch(() => null);
  if (!r2.ok || !Array.isArray(d2)) {
    await mb(`/rest/v1/cc_financiera_movements?id=eq.${d1[0].id}`, { method: "DELETE" }).catch(() => {});
    return Response.json({ error: `No se pudo registrar en Argencargo: ${d2?.message || r2.status}` }, { status: 500 });
  }
  return Response.json({ ok: true });
}
