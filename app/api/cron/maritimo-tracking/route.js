// Seguimiento de contenedores (27/10/2026): cada hora consulta la naviera de cada contenedor en
// viaje (COSCO sin clave, Maersk con MAERSK_CONSUMER_KEY) y actualiza:
//   - departed_at   : el día que zarpó, si la naviera lo tiene y el contenedor no tenía fecha
//   - eta           : la ETA a Buenos Aires que informa la naviera (aviso por Telegram si cambia)
//   - port_arrived_at: cuando la naviera marca descargado/arribado en Buenos Aires → queda "En
//                     aduana" solo; los mails a los clientes siguen saliendo con el botón del admin.
//   - tracking_*    : último evento, buque, lista de eventos, hora de consulta y error si hubo.
// GET  → Vercel cron (Bearer CRON_SECRET), todos los contenedores en viaje.
// POST { container_id } → admin/empleado (JWT) o CRON_SECRET: uno solo, al toque.
// FCL (29/10/2026): también los contenedores enteros de las ops de Marítimo A (operation_containers)
// que todavía no llegaron. Se actualiza el contenedor y la ETA de la op. POST { fcl_id } para uno.
import { rastrearContenedor, soportaTracking, resumenEvento } from "../../../../lib/tracking/maritimo";
import { tgNotify } from "../../../../lib/telegram";
import { payloadVerificado } from "../../../../lib/auth-server";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const sb = async (path, opts = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, { ...opts, cache: "no-store", headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation", ...(opts.headers || {}) } });
  const t = await r.text(); try { return { ok: r.ok, status: r.status, data: JSON.parse(t) }; } catch { return { ok: r.ok, status: r.status, data: t }; }
};
const esCron = (req) => { const a = req.headers.get("authorization") || ""; return !!process.env.CRON_SECRET && a === `Bearer ${process.env.CRON_SECRET}`; };
async function esStaff(req) {
  const a = req.headers.get("authorization") || "";
  if (!a.startsWith("Bearer ")) return false;
  try {
    const payload = (await payloadVerificado(a.slice(7)));
    const p = await sb(`/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p.data) && ["admin", "empleado"].includes(p.data[0]?.role);
  } catch { return false; }
}
const dd = (d) => (d ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}` : "—");
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function procesar(c) {
  const r = await rastrearContenedor(c);
  const body = { tracking_updated_at: new Date().toISOString(), tracking_error: r.ok ? (r.error || null) : (r.error || "error") };
  const avisos = [];
  if (r.ok) {
    body.tracking_events = r.eventos || [];
    body.tracking_last = resumenEvento(r.ultimo);
    body.tracking_vessel = r.buque || c.tracking_vessel || null;
    if (r.eta) {
      body.eta_naviera = r.eta;
      if (r.eta !== (c.eta || "").slice(0, 10)) { body.eta = r.eta; avisos.push(`📅 ETA ${c.code}: ${dd(c.eta)} → ${dd(r.eta)} (${r.naviera})`); }
    }
    if (r.salida && !c.departed_at) { body.departed_at = r.salida; avisos.push(`🚢 ${c.code} zarpó el ${dd(r.salida)}`); }
    if (r.llegada && !c.port_arrived_at) { body.port_arrived_at = r.llegada; avisos.push(`⚓ ${c.code} llegó a Buenos Aires (${dd(r.llegada)}): quedó En aduana. Mandá el aviso a los clientes desde el panel.`); }
  }
  const p = await sb(`/maritime_containers?id=eq.${c.id}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!p.ok) {
    // Sin las columnas nuevas (falta el SQL) igual se actualizan las fechas, que son lo importante.
    const { tracking_events, tracking_last, tracking_vessel, tracking_updated_at, tracking_error, eta_naviera, ...solo } = body;
    if (Object.keys(solo).length) await sb(`/maritime_containers?id=eq.${c.id}`, { method: "PATCH", body: JSON.stringify(solo) });
    return { code: c.code, ok: r.ok, error: r.error || `No se pudo guardar (${p.status}): ¿falta correr migrations/2026_10_27_tracking_maritimo.sql?`, ultimo: body.tracking_last || null, cambios: avisos };
  }
  return { code: c.code, ok: r.ok, error: r.error || null, ultimo: body.tracking_last || null, eta: r.eta || null, cambios: avisos };
}

// Contenedor FCL de una op: misma consulta; se guarda en operation_containers y la ETA va a la op.
async function procesarFcl(c) {
  const r = await rastrearContenedor({ shipping_line: c.shipping_line, code: c.container_number });
  const body = { tracking_updated_at: new Date().toISOString(), tracking_error: r.ok ? (r.error || null) : (r.error || "error") };
  const avisos = [];
  const cod = c.operations?.operation_code || c.container_number;
  if (r.ok) {
    body.tracking_events = r.eventos || [];
    body.tracking_last = resumenEvento(r.ultimo);
    body.tracking_vessel = r.buque || c.tracking_vessel || null;
    if (r.eta) {
      body.eta_naviera = r.eta;
      if (r.eta !== (c.eta || "").slice(0, 10)) { body.eta = r.eta; avisos.push(`📅 ETA ${cod} (${c.container_number}): ${dd(c.eta)} → ${dd(r.eta)}`); }
    }
    if (r.salida && !c.departed_at) { body.departed_at = r.salida; avisos.push(`🚢 ${cod} (${c.container_number}) zarpó el ${dd(r.salida)}`); }
    if (r.llegada && !c.discharged_at) { body.discharged_at = r.llegada; avisos.push(`⚓ ${cod} (${c.container_number}) llegó a Buenos Aires (${dd(r.llegada)}). Corren los días libres del vacío.`); }
  }
  await sb(`/operation_containers?id=eq.${c.id}`, { method: "PATCH", body: JSON.stringify(body) });
  const op = {};
  if (body.eta) op.eta = body.eta;
  if (body.departed_at && !c.operations?.dispatched_at) op.dispatched_at = body.departed_at;
  if (body.discharged_at && !c.operations?.arrived_in_argentina_at) op.arrived_in_argentina_at = body.discharged_at;
  if (Object.keys(op).length) await sb(`/operations?id=eq.${c.operation_id}`, { method: "PATCH", body: JSON.stringify(op) });
  return { code: c.container_number, ok: r.ok, error: r.error || null, ultimo: body.tracking_last || null, eta: r.eta || null, cambios: avisos };
}

async function correrFcl(ids = null) {
  const f = ids ? `id=in.(${ids.join(",")})` : `discharged_at=is.null&delivered_at=is.null`;
  const q = await sb(`/operation_containers?${f}&select=*,operations(operation_code,status,dispatched_at,arrived_in_argentina_at)&order=created_at.desc`);
  const lista = (Array.isArray(q.data) ? q.data : []).filter((c) => (ids || !["operacion_cerrada", "cancelada"].includes(c.operations?.status)) && soportaTracking({ shipping_line: c.shipping_line, code: c.container_number }));
  const out = [];
  for (let i = 0; i < lista.length; i++) { if (i) await pausa(2500); out.push(await procesarFcl(lista[i])); }
  return out;
}

async function correr(ids = null) {
  const f = ids ? `id=in.(${ids.join(",")})` : `status=eq.en_transito&port_arrived_at=is.null`;
  const q = await sb(`/maritime_containers?${f}&select=*&order=created_at.desc`);
  const lista = (Array.isArray(q.data) ? q.data : []).filter(soportaTracking);
  const out = [];
  for (let i = 0; i < lista.length; i++) {
    if (i) await pausa(2500); // COSCO corta las ráfagas
    out.push(await procesar(lista[i]));
  }
  if (!ids) out.push(...(await correrFcl()));
  const avisos = out.flatMap((o) => o.cambios || []);
  if (avisos.length) { try { await tgNotify(["🛰 Seguimiento marítimo", ...avisos].join("\n")); } catch {} }
  return { ok: true, consultados: out.length, resultados: out };
}

export async function GET(req) {
  if (!esCron(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await correr());
}
export async function POST(req) {
  if (!esCron(req) && !(await esStaff(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.fcl_id) {
    if (!/^[0-9a-f-]{36}$/i.test(String(b.fcl_id))) return Response.json({ error: "fcl_id" }, { status: 400 });
    const out = await correrFcl([String(b.fcl_id)]);
    if (!out.length) return Response.json({ ok: false, error: "Esa naviera no tiene seguimiento automático todavía (hoy: COSCO). Usá Rastrear en la naviera." });
    const avisos = out[0].cambios || [];
    if (avisos.length) { try { await tgNotify(["🛰 Seguimiento marítimo", ...avisos].join("\n")); } catch {} }
    return Response.json({ ok: true, ...out[0] });
  }
  const id = String(b.container_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "container_id" }, { status: 400 });
  const r = await correr([id]);
  if (!r.consultados) return Response.json({ ok: false, error: "Ese contenedor no tiene naviera con seguimiento (COSCO o Maersk) o el código no es un número de contenedor" });
  return Response.json({ ok: true, ...r.resultados[0] });
}
