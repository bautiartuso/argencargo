// GET /api/cron/blog-redactor — todos los días (después del radar de noticias): encola las notas del día
// para que el redactor de la Mac las escriba. Auth: Bearer CRON_SECRET.
import { redactorDiario } from "../../../../lib/blog";
export const maxDuration = 120;
export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const ok = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ ok: true, ...(await redactorDiario()) });
}
