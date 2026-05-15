// GET /api/cron/mkt-generate-month
// Cron 1ro de cada mes 7am AR (10 UTC). Crea 30 slots vacíos en mkt_pieces:
// 10 por red (instagram, linkedin, x) en los días 1, 4, 7, 10, 13, 16, 19, 22, 25, 28.
// Idempotente: si ya existen no duplica.
// Auth: Bearer CRON_SECRET.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const PUBLISH_DAYS = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28];
const NETWORKS = ["instagram", "linkedin", "x"];

export const maxDuration = 30;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!r.ok) { console.error("sb error", path, r.status); return null; }
  return r.json();
}

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET || ""}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month"); // "YYYY-MM" opcional
  const dt = monthParam ? new Date(monthParam + "-01") : new Date();
  const year = dt.getFullYear();
  const month = dt.getMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  // Trae los slots existentes del mes
  const existing = await sb(`/rest/v1/mkt_pieces?select=network,scheduled_date&scheduled_date=gte.${monthStr}-01&scheduled_date=lt.${monthStr}-32`) || [];
  const existSet = new Set(existing.map(p => `${p.network}|${p.scheduled_date}`));

  const toCreate = [];
  for (const network of NETWORKS) {
    for (let i = 0; i < 10; i++) {
      const dom = PUBLISH_DAYS[i];
      const date = `${monthStr}-${String(dom).padStart(2, "0")}`;
      const key = `${network}|${date}`;
      if (existSet.has(key)) continue;
      toCreate.push({ network, scheduled_date: date, slot_number: i + 1, status: "idea", copy: "" });
    }
  }

  if (toCreate.length === 0) {
    return new Response(JSON.stringify({ ok: true, monthStr, created: 0, note: "all slots already exist" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const ins = await sb("/rest/v1/mkt_pieces", { method: "POST", body: JSON.stringify(toCreate) });
  return new Response(JSON.stringify({ ok: true, monthStr, created: ins?.length || 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
}
