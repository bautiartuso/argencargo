// Estados automáticos de las operaciones (27/10/2026). Antes corría como pg_cron dentro de Supabase
// ("auto_update_ops", cada 15 min); ahora lo dispara Vercel para no depender de jobs en la base.
// La lógica sigue en la función SQL auto_update_op_statuses() (mira los tracking_events y pasa
// en_transito → arribo_argentina → en_aduana → entregada). El sync de tracking también la llama
// cuando entran eventos nuevos.
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
export const dynamic = "force-dynamic";

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const r = await fetch(`${SB_URL}/rest/v1/rpc/auto_update_op_statuses`, { method: "POST", cache: "no-store", headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" }, body: "{}" });
  const txt = await r.text();
  return Response.json({ ok: r.ok, status: r.status, result: txt.slice(0, 300) }, { status: r.ok ? 200 : 500 });
}
