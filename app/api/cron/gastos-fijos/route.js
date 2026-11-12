// GET /api/cron/gastos-fijos — aviso por Telegram de los gastos fijos por pagar (12/11/2026).
// Corre una vez por día (9:00 de Argentina). Manda un solo mensaje con todo lo que está en ventana de
// aviso o vencido, pero solo los días en que algo cambia: cuando un gasto entra en su ventana, el día
// que vence y, si ya venció, día por medio. Así no molesta todos los días con lo mismo.
import { esCronValido } from "../../../../lib/auth-server";
import { tgNotify } from "../../../../lib/telegram";
import { hoyAR } from "../../../../lib/fecha-ar";
import { periodoDe, periodoAnterior, porAvisar, textoVence, nombrePeriodo } from "../../../../lib/gastos-fijos";

export const dynamic = "force-dynamic";
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const sb = (path) => fetch(`${SB_URL}/rest/v1${path}`, { cache: "no-store", headers: { apikey: SB, Authorization: `Bearer ${SB}` } }).then((r) => (r.ok ? r.json() : []));

export async function GET(req) {
  if (!esCronValido(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const hoy = hoyAR();
  const act = periodoDe(hoy);
  const [gastos, pagos] = await Promise.all([
    sb(`/gastos_fijos?estado=eq.activo&avisar=is.true&select=*`),
    sb(`/finance_entries?gasto_fijo_id=not.is.null&periodo=in.(${periodoAnterior(act)},${act})&select=gasto_fijo_id,periodo`),
  ]);
  const lista = porAvisar(Array.isArray(gastos) ? gastos : [], Array.isArray(pagos) ? pagos : [], hoy);
  const dispara = lista.some((x) => x.faltan === Number(x.g.avisar_dias ?? 3) || x.faltan === 0 || (x.faltan < 0 && -x.faltan % 2 === 1));
  if (!lista.length || !dispara) return Response.json({ ok: true, enviados: 0, pendientes: lista.length });
  const renglones = lista.map((x) => `${x.faltan < 0 ? "🔴" : x.faltan === 0 ? "🟠" : "🟡"} ${x.g.emoji || ""} <b>${x.g.nombre}</b>${x.periodo !== act ? ` (${nombrePeriodo(x.periodo)})` : ""}: ${textoVence(x.faltan)}`);
  const r = await tgNotify(`🧾 <b>Gastos fijos por pagar</b>\n\n${renglones.join("\n")}\n\nhttps://www.argencargo.com.ar/admin`);
  return Response.json({ ok: true, enviados: lista.length, tg: r });
}
