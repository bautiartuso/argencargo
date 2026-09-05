// GET /api/cron/studio-queue — la COLA del Content Studio: procesa UNA pieza pendiente por
// pasada (idea → HTML → PNG → review). Corre cada 2 minutos (vercel.json); el admin también la
// dispara al crear piezas para no esperar al cron.
// Auth: Bearer CRON_SECRET.

import { processNext } from "../../../../lib/studio";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const ok = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  const r = await processNext();
  return Response.json({ ok: true, processed: r });
}
