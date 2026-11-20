// POST /api/admin/presupuesto-reempaque  { op_ids: [uuid] }
// Después de reemplazar los bultos de una op con los que midió el courier (archivo del vuelo),
// el presupuesto guardado se recalcula y se guarda, suba o baje (20/11/2026). Solo admin/empleado.
import { usuarioConRol } from "../../../../lib/auth-server";
import { recalcularPresupuestoOp, fmtUsd } from "../../../../lib/reempaque-aviso";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE;
const H = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });
const svc = async (p) => { const r = await fetch(`${SB_URL}/rest/v1${p}`, { headers: H(), cache: "no-store" }); const j = await r.json().catch(() => null); return Array.isArray(j) ? j : null; };
const patch = async (p, body) => (await fetch(`${SB_URL}/rest/v1${p}`, { method: "PATCH", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify(body) })).ok;

export async function POST(req) {
  if (!KEY) return Response.json({ error: "Server config missing" }, { status: 500 });
  const u = await usuarioConRol(req);
  if (!u) return Response.json({ error: "no_auth" }, { status: 401 });
  let body = {}; try { body = await req.json(); } catch {}
  const ids = (Array.isArray(body.op_ids) ? body.op_ids : []).filter((x) => /^[0-9a-f-]{36}$/i.test(String(x))).slice(0, 40);
  const res = [];
  for (const id of ids) {
    try {
      const r = await recalcularPresupuestoOp(svc, patch, id);
      res.push({ op_id: id, ...r });
      // El cron del bot no vuelve a recalcular estos reempaques.
      await patch(`/repack_requests?operation_id=eq.${id}&status=eq.done`, { budget_synced_at: new Date().toISOString() });
      if (r && !r.omitido && !r.igual) {
        await fetch(`${SB_URL}/rest/v1/op_communications`, { method: "POST", headers: { ...H(), Prefer: "return=minimal" }, body: JSON.stringify({ operation_id: id, type: "note", content: `Presupuesto actualizado con los bultos del courier: ${fmtUsd(r.antes)} → ${fmtUsd(r.ahora)}.` }) }).catch(() => {});
      }
    } catch (e) { res.push({ op_id: id, omitido: e.message }); }
  }
  return Response.json({ ok: true, res });
}
