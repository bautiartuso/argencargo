// Control del despacho contra la tarifa cargada por el agente (12/11/2026).
// Al despachar, el agente pone la tarifa por kg; acá el servidor mira qué tarifa le correspondía según
// lo que él mismo tiene cargado (origen + servicio pedido + tramo de kilos) y lo deja en
// flights.tarifa_control. Si no coincide, el panel de Vuelos del admin muestra el cartel TARIFA.
//
// POST { flight_id } | { flight_ids: [...] }
//   · El agente lo llama apenas despacha (solo sus vuelos).
//   · El admin lo llama al abrir Vuelos, para los despachados que quedaron sin control.
// Solo se escribe una vez por vuelo: después únicamente el equipo le agrega visto_at.
// Si el agente cambió sus tarifas DESPUÉS de despachar, la comparación ya no vale: queda "sin_dato".
import { quienLlama } from "../../../../lib/auth-server";
import { normalizarTarifas, controlTarifa } from "../../../../lib/tarifas-agente";

export const dynamic = "force-dynamic";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const svc = (path, init = {}) => fetch(`${SB_URL}${path}`, { ...init, cache: "no-store", headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", ...(init.headers || {}) } });
// Los vuelos despachados antes de que existiera el control no se comparan (quedan "sin_dato").
const DESDE = "2026-11-12";
const json = (d, s = 200) => Response.json(d, { status: s, headers: { "Cache-Control": "no-store" } });

async function tarifasDe(agentId) {
  // El parámetro evita la copia vieja del CDN de Storage justo después de que el agente guarda.
  const r = await svc(`/storage/v1/object/agent-tariffs/${agentId}.json?t=${Date.now()}`);
  if (!r.ok) return null;
  try { return normalizarTarifas(await r.json()); } catch { return null; }
}

export async function POST(req) {
  const yo = await quienLlama(req);
  if (!yo) return json({ error: "sin_permiso" }, 401);
  let b = {};
  try { b = await req.json(); } catch {}
  const ids = [...new Set((Array.isArray(b.flight_ids) ? b.flight_ids : [b.flight_id]).filter((x) => /^[0-9a-f-]{36}$/i.test(String(x || ""))))].slice(0, 60);
  if (!ids.length) return json({ controles: {} });
  const fr = await svc(`/rest/v1/flights?id=in.(${ids.join(",")})&select=id,agent_id,status,requested_carrier,international_carrier,cost_per_kg_usd,total_weight_kg,dispatched_at,tarifa_control`).then((r) => r.json()).catch(() => []);
  const vuelos = (Array.isArray(fr) ? fr : []).filter((f) => f.agent_id && f.status !== "preparando" && !f.tarifa_control && (yo.staff || f.agent_id === yo.id));
  const cache = new Map();
  const controles = {};
  for (const f of vuelos) {
    if (!cache.has(f.agent_id)) cache.set(f.agent_id, await tarifasDe(f.agent_id));
    const tarifas = cache.get(f.agent_id);
    let c = controlTarifa({ flight: f, tarifas });
    const cambio = tarifas?.actualizado && f.dispatched_at && Date.parse(tarifas.actualizado) > Date.parse(f.dispatched_at) + 60e3;
    const sinDato = (motivo) => ({ at: c.at, pedido: c.pedido, courier: c.courier, kg: c.kg, cobrada: c.cobrada, tarifas_al: c.tarifas_al, estado: "sin_dato", motivo });
    if (!f.dispatched_at || f.dispatched_at < DESDE) c = sinDato("anterior_al_control");
    else if (cambio && ["ok", "distinta", "sin_tarifa"].includes(c.estado)) c = sinDato("tarifas_cambiaron");
    const r = await svc(`/rest/v1/flights?id=eq.${f.id}&tarifa_control=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ tarifa_control: c }) });
    if (r.ok) controles[f.id] = c;
  }
  return json({ controles });
}
