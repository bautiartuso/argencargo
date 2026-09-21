// POST|GET /api/argenmaq/recalcular
// Recalcula los canales (costo de Argencargo + precio de venta) de todas las máquinas con las
// tarifas de Argencargo vigentes, incluida la preferencial del cliente ARGENMAQ. Respeta la
// gestión cargada y qué vías ve el cliente: solo cambian los números.
//
// Corre solo: por cron cada hora y cada vez que se abre el panel de ARGENMAQ. Antes los costos
// quedaban congelados en el momento de guardar los canales, así que una tarifa nueva no se veía
// hasta volver a entrar máquina por máquina (21/09/2026).
import { VIAS, analizarVias, armarCanales } from "../../../../lib/canales-maquinas";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, { ...opts, headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {}
  if (!r.ok) throw new Error(d?.message || `HTTP ${r.status}`);
  return d;
}
const clave = (canales) => {
  const e = canales?.escalera ? { ...canales.escalera, calculado_at: undefined } : null;
  return VIAS.map((v) => `${canales?.[v.k]?.argencargo?.total ?? ""}|${canales?.[v.k]?.precio?.total ?? ""}`).join(";") + "#" + JSON.stringify(e);
};

async function recalcular() {
  if (!SB_SERVICE) return { error: "sin_service_role" };
  const ajRows = await sb("/cat_ajustes?select=clave,valor");
  const ajustes = {}; (ajRows || []).forEach((r) => { ajustes[r.clave] = r.valor; });
  const clienteId = ajustes.argencargo_client_id;
  const [tariffs, cfgRows, overrides, cls, prods] = await Promise.all([
    sb("/tariffs?select=*&order=sort_order.asc"),
    sb("/calc_config?select=key,value"),
    clienteId ? sb(`/client_tariff_overrides?client_id=eq.${clienteId}&select=*`) : Promise.resolve([]),
    clienteId ? sb(`/clients?id=eq.${clienteId}&select=id,tax_condition,client_code`) : Promise.resolve([]),
    sb("/cat_productos?select=id,numero,nombre,nombre_raw,exw_usd,packing,die,te,iva,ncm_code,intervencion,markup_pct,canales&order=numero.asc"),
  ]);
  const config = {}; (cfgRows || []).forEach((r) => { config[r.key] = Number(r.value); });
  const tarifas = { tariffs: tariffs || [], config, overrides: overrides || [], cliente: (cls || [])[0] || { tax_condition: "responsable_inscripto" } };
  if (!tarifas.tariffs.length) return { error: "sin_tarifas" };

  let revisadas = 0; const actualizadas = [];
  for (const m of prods || []) {
    if (!m.canales) continue;
    revisadas++;
    const an = analizarVias({ ...m, nombre: m.nombre || m.nombre_raw }, tarifas);
    const cfg = Object.fromEntries(VIAS.map((v) => [v.k, { mostrar: !!m.canales[v.k]?.mostrar, gestion_pct: m.canales[v.k]?.gestion_pct ?? "", gestion_usd: m.canales[v.k]?.gestion_usd ?? "" }]));
    const nuevos = armarCanales(an, cfg, m, ajustes, tarifas);
    if (clave(m.canales) === clave(nuevos)) continue;
    await sb(`/cat_productos?id=eq.${m.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ canales: nuevos }) });
    actualizadas.push(m.numero);
  }
  return { revisadas, actualizadas };
}

export async function GET() { try { return Response.json(await recalcular()); } catch (e) { return Response.json({ error: e.message }, { status: 500 }); } }
export const POST = GET;
