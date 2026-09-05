// GET /api/cron/studio-publisher — el VIGILANTE de Instagram: corre cada minuto y publica por
// Instagram Graph API lo que está programado y cuya hora ya pasó. Auth: Bearer CRON_SECRET.
import { publicarPendientes } from "../../../../lib/studio";
export const maxDuration = 60;
export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const ok = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ ok: true, ...(await publicarPendientes()) });
}
