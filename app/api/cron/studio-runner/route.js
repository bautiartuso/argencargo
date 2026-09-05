// GET /api/cron/studio-runner — el RUNNER diario del Content Studio: a las 7 AR (10 UTC) el
// analista propone las piezas del día (1 post de feed + 3 historias) y las deja en la cola.
// Nunca publica solo: todo cae en Aprobación.
// Auth: Bearer CRON_SECRET. ?count=N para forzar otra cantidad.

import { runner } from "../../../../lib/studio";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const ok = [process.env.CRON_SECRET, process.env.BOT_TEST_SECRET].filter(Boolean).some((s) => auth === `Bearer ${s}`);
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });
  const count = Math.min(8, Math.max(1, Number(new URL(req.url).searchParams.get("count")) || 4));
  const created = await runner({ count, kinds: ["feed", "story", "story", "story"].slice(0, count), source: "runner" });
  return Response.json({ ok: true, created: created.length, titulos: created.map((c) => c.title) });
}
