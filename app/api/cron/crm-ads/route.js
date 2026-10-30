// /api/cron/crm-ads — gasto de Meta Ads para el tablero de Campañas (todos los días a las 4:20 UTC).
//   · trae los últimos 3 días de gasto por anuncio y día (Meta ajusta los números durante ~48 h) → crm_ad_spend
//   · a los leads que llegaron desde un anuncio y todavía no tienen nombre de campaña, se lo pone
// POST {dias} con token de admin → trae más días hacia atrás (para rellenar al conectar la cuenta).
import { esCronValido, usuarioConRol } from "../../../../lib/auth-server";
import { adsConfigured, insightsPorAnuncio, datosAnuncio } from "../../../../lib/meta-ads";

export const maxDuration = 120;
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const sbh = (extra = {}) => { const k = process.env.SUPABASE_SERVICE_ROLE; return { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", ...extra }; };
const fecha = (d) => new Date(d).toISOString().slice(0, 10);

async function correr(dias) {
  if (!adsConfigured()) return { skipped: true, motivo: "Meta Ads sin conectar" };
  const until = fecha(Date.now()), since = fecha(Date.now() - dias * 864e5);
  const filas = await insightsPorAnuncio(since, until);
  for (let i = 0; i < filas.length; i += 200) {
    await fetch(`${SB_URL}/rest/v1/crm_ad_spend?on_conflict=date,ad_id`, { method: "POST", headers: sbh({ Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify(filas.slice(i, i + 200).map((f) => ({ ...f, updated_at: new Date().toISOString() }))) });
  }
  // Nombres para los leads que vinieron de un anuncio (de a 40 por corrida; una llamada a Meta por anuncio distinto).
  const sinNombre = await fetch(`${SB_URL}/rest/v1/crm_contacts?select=id,ad_source_id&ad_source_id=not.is.null&campaign_id=is.null&limit=40`, { headers: sbh(), cache: "no-store" }).then((r) => r.json()).catch(() => []);
  const cache = {}; let nombrados = 0;
  for (const c of Array.isArray(sinNombre) ? sinNombre : []) {
    try {
      cache[c.ad_source_id] = cache[c.ad_source_id] || (filas.find((f) => f.ad_id === c.ad_source_id) || (await datosAnuncio(c.ad_source_id)));
      const d = cache[c.ad_source_id]; if (!d?.campaign_id) continue;
      await fetch(`${SB_URL}/rest/v1/crm_contacts?id=eq.${c.id}`, { method: "PATCH", headers: sbh({ Prefer: "return=minimal" }), body: JSON.stringify({ campaign_id: d.campaign_id, campaign_name: d.campaign_name, adset_id: d.adset_id, adset_name: d.adset_name, ad_name: d.ad_name, updated_at: new Date().toISOString() }) });
      nombrados++;
    } catch (e) { console.error("[crm-ads] nombre", c.ad_source_id, e.message); }
  }
  return { ok: true, since, until, filas: filas.length, nombrados };
}

export async function GET(req) {
  if (!esCronValido(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  try { return Response.json(await correr(3)); } catch (e) { console.error("[crm-ads]", e.message); return Response.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req) {
  const u = await usuarioConRol(req, ["admin"]);
  if (!u) return Response.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try { return Response.json(await correr(Math.min(Math.max(Number(b.dias) || 30, 1), 90))); } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
