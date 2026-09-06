// GET /api/cron/studio-publisher — el VIGILANTE de Instagram: corre cada minuto y publica por
// Instagram Graph API lo que está programado y cuya hora ya pasó. Auth: Bearer CRON_SECRET.
import { publicarPendientes, analizarPendientesCompetencia } from "../../../../lib/studio";
export const maxDuration = 60;
export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const ok = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  const pub = await publicarPendientes();
  // De paso, analiza de a 3 los posts de la competencia que faltan (cola en segundo plano).
  let competencia = 0; try { competencia = await analizarPendientesCompetencia(3); } catch (e) { console.error("[studio] competencia", e.message); }
  return Response.json({ ok: true, ...pub, competencia_analizados: competencia });
}
