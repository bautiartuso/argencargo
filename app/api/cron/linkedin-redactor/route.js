// GET /api/cron/linkedin-redactor — lunes a la mañana: encola los posts de LinkedIn de la semana
// (resumen real de la semana, notas del blog, noticias, educativo) para que la Mac los escriba. Auth: Bearer CRON_SECRET.
import { redactorSemanalLinkedin } from "../../../../lib/linkedin";
export const maxDuration = 120;
export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const ok = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ ok: true, ...(await redactorSemanalLinkedin()) });
}
