// GET /api/cron/ig-insights — dos veces por día: seguidores, alcance, métricas de publicaciones e historias
// (las historias solo tienen métricas mientras están activas, por eso se capturan seguido). Auth: Bearer CRON_SECRET.
import { actualizarInsights } from "../../../../lib/ig-insights";
export const maxDuration = 120;
export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const ok = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ ok: true, ...(await actualizarInsights()) });
}
