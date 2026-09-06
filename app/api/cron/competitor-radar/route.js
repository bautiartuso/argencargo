// GET /api/cron/competitor-radar — RADAR DE COMPETENCIA: los domingos a las 22 (AR) baja los últimos posts de las
// cuentas de cs_competitors (Business Discovery, token de Facebook) y Claude anota qué aprender de
// cada uno. El analista del runner lo lee al proponer ideas. Auth: Bearer CRON_SECRET.
import { radarCompetencia } from "../../../../lib/studio";
export const maxDuration = 300;
export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const ok = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ ok: true, ...(await radarCompetencia({ analizar: 30 })) });
}
