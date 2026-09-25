// Aviso de nuevas tarifas aéreas (25/09/2026) a todos los clientes que alguna vez tuvieron una
// operación o tienen bultos en el depósito.
//   GET  → cuántos son y cuántos ya lo recibieron (email_log, trigger tarifas_2026_09).
//   POST → lo manda a los que todavía no lo recibieron. Solo admin / empleado.
import { enviarEmail } from "../../../../lib/email";
import { mailTarifas, TARIFAS_TRIGGER } from "../../../../lib/email-tarifas";

export const maxDuration = 300;
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const INTERNOS = ["BAUART", "BAUAR2", "ARGENMAQ"];

const sb = async (path) => {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, { headers: { apikey: SB, Authorization: `Bearer ${SB}` }, cache: "no-store" });
  return r.ok ? r.json() : null;
};

async function esAdmin(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split(".")[1], "base64").toString());
    const p = await sb(`/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p) && ["admin", "empleado"].includes(p[0]?.role);
  } catch { return false; }
}

async function destinatarios() {
  const [ops, pks, cls, log] = await Promise.all([
    sb(`/operations?select=client_id&client_id=not.is.null`),
    sb(`/operation_packages?select=client_id&operation_id=is.null&client_id=not.is.null`),
    sb(`/clients?select=id,client_code,first_name,last_name,email,tax_condition`),
    sb(`/email_log?select=client_id&trigger=eq.${TARIFAS_TRIGGER}&ok=eq.true`),
  ]);
  const ids = new Set([...(ops || []), ...(pks || [])].map((x) => x.client_id).filter(Boolean));
  const yaEnviado = new Set((log || []).map((x) => x.client_id).filter(Boolean));
  const todos = (cls || []).filter((c) => ids.has(c.id) && !INTERNOS.includes(c.client_code));
  const conMail = todos.filter((c) => String(c.email || "").includes("@"));
  return {
    total: todos.length,
    sinMail: todos.filter((c) => !String(c.email || "").includes("@")).map((c) => c.client_code),
    enviados: conMail.filter((c) => yaEnviado.has(c.id)).length,
    pendientes: conMail.filter((c) => !yaEnviado.has(c.id)),
    ri: conMail.filter((c) => c.tax_condition === "responsable_inscripto").length,
  };
}

export async function GET(req) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  if (!(await esAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const d = await destinatarios();
  return Response.json({ total: d.total, ri: d.ri, enviados: d.enviados, pendientes: d.pendientes.length, sinMail: d.sinMail });
}

export async function POST(req) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  if (!(await esAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const d = await destinatarios();
  // Prueba: un solo destinatario (mail explícito) antes de mandarlo a todos.
  if (body.test_to) {
    const { subject, html } = mailTarifas({ nombre: body.test_nombre || "Bautista", isRI: !!body.test_ri });
    const r = await enviarEmail({ to: body.test_to, subject, html, trigger: `${TARIFAS_TRIGGER}_test` });
    return Response.json({ ok: r.ok, error: r.error });
  }
  if (body.confirm !== true) return Response.json({ error: "Falta confirm" }, { status: 400 });
  let ok = 0, fallidos = [];
  for (const c of d.pendientes) {
    const { subject, html } = mailTarifas({ nombre: c.first_name, isRI: c.tax_condition === "responsable_inscripto" });
    const r = await enviarEmail({ to: c.email.trim(), subject, html, trigger: TARIFAS_TRIGGER, client_id: c.id });
    if (r.ok) ok++; else fallidos.push(`${c.client_code}: ${r.error || r.status}`);
    // Resend limita a ~2 envíos por segundo.
    await new Promise((res) => setTimeout(res, 600));
  }
  return Response.json({ ok: true, enviados: ok, fallidos, sinMail: d.sinMail });
}
