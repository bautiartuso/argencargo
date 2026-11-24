// /api/cron/crm-ia — el saludo automático de la IA (23/11/2026). Corre cada 20 minutos de lunes a
// viernes en horario de oficina (10 a 18 de Argentina) y manda de a pocos, hasta el tope del día.
// No hace nada si está apagado (crm_numbers.ia_enabled), si es feriado o si la plantilla no está aprobada.
import { esCronValido } from "../../../../lib/auth-server";
import { tokenVigente } from "../../../../lib/crm-wa";
import { numeroCrm, estadoPlantilla, enviadosHoy, candidatos, mandarSaludo } from "../../../../lib/crm-ia";

export const maxDuration = 120;
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";

export async function GET(req) {
  if (!esCronValido(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const num = await numeroCrm();
  if (!num) return Response.json({ ok: true, motivo: "sin número conectado" });
  if (!num.ia_enabled) return Response.json({ ok: true, motivo: "apagado" });
  const hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const k = process.env.SUPABASE_SERVICE_ROLE;
  const fer = await fetch(`${SB_URL}/rest/v1/holidays_calendar?country=eq.argentina&start_date=lte.${hoy}&end_date=gte.${hoy}&select=name&limit=1`, { headers: { apikey: k, Authorization: `Bearer ${k}` }, cache: "no-store" }).then((r) => r.json()).catch(() => []);
  if (Array.isArray(fer) && fer.length) return Response.json({ ok: true, motivo: `feriado: ${fer[0].name}` });
  const tope = Math.max(0, Number(num.ia_por_dia || 0));
  const van = await enviadosHoy();
  if (van >= tope) return Response.json({ ok: true, motivo: "tope del día", van, tope });
  const token = await tokenVigente(num);
  if (!token) return Response.json({ ok: false, motivo: "ningún token sirve para el número" });
  const pl = await estadoPlantilla(num, token);
  if (pl?.estado !== "APPROVED") return Response.json({ ok: true, motivo: `plantilla ${pl?.estado || "sin crear"}` });
  // De a pocos por corrida para que salgan repartidos en el día y no todos juntos.
  const ahora = Math.min(tope - van, Math.max(1, Math.ceil(tope / 20)));
  const fila = await candidatos(ahora);
  const hechos = [];
  for (const p of fila) { const r = await mandarSaludo(num, token, p); hechos.push({ clave: p.clave, ok: !!r.ok, error: r.error || null }); }
  return Response.json({ ok: true, van: van + hechos.filter((h) => h.ok).length, tope, hechos });
}
