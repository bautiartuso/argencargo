// /api/admin/intelligence?mode=client&clientId=UUID  -> análisis 360 del cliente
// /api/admin/intelligence?mode=trends&months=6       -> tendencias globales mercadería
// Combina #10 Importaciones similares + #11 Predicción próxima importación + #13 Tendencias mercadería
// 100% determinístico — no consume API de IA

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;

async function sb(path) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB, Authorization: `Bearer ${SB}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  return r.json();
}

const j = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// Estima cadencia de importaciones por intervalo medio entre operaciones
function predictNextImport(opsAsc) {
  if (!opsAsc || opsAsc.length < 2) return null;
  const dates = opsAsc.map(o => new Date(o.created_at).getTime()).sort((a, b) => a - b);
  const intervals = [];
  for (let i = 1; i < dates.length; i++) intervals.push(dates[i] - dates[i - 1]);
  if (!intervals.length) return null;
  // Usar mediana para resistir outliers
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const last = dates[dates.length - 1];
  const nextEst = new Date(last + median);
  const days = Math.round(median / (1000 * 60 * 60 * 24));
  return {
    next_estimated_date: nextEst.toISOString().slice(0, 10),
    avg_interval_days: Math.round(avg / (1000 * 60 * 60 * 24)),
    median_interval_days: days,
    sample_size: intervals.length + 1,
    confidence: intervals.length >= 4 ? "alta" : intervals.length >= 2 ? "media" : "baja",
  };
}

function topByKey(rows, key, limit = 8) {
  const m = new Map();
  for (const r of rows) {
    const k = (r[key] || "").toString().trim();
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k, v]) => ({ key: k, count: v }));
}

export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "client";

  // ── MODE: trends globales (#13) ────────────────────────────
  if (mode === "trends") {
    const months = Math.max(1, Math.min(36, Number(url.searchParams.get("months")) || 6));
    const since = new Date(Date.now() - months * 30 * 86400000).toISOString();
    const ops = await sb(`/rest/v1/operations?select=id,channel,origin,created_at,budget_total,status&created_at=gte.${since}&order=created_at.desc&limit=2000`);
    const items = await sb(`/rest/v1/operation_items?select=ncm_code,description,quantity,unit_price_usd,operation_id,operations!inner(created_at)&operations.created_at=gte.${since}&limit=5000`);

    const byNcm = new Map();
    let totalFob = 0;
    for (const it of items || []) {
      const ncm = it.ncm_code || "—";
      const fob = Number(it.unit_price_usd || 0) * Number(it.quantity || 1);
      totalFob += fob;
      const cur = byNcm.get(ncm) || { ncm, count: 0, qty: 0, fob: 0, samples: new Set() };
      cur.count += 1;
      cur.qty += Number(it.quantity || 1);
      cur.fob += fob;
      if (it.description && cur.samples.size < 3) cur.samples.add(it.description.slice(0, 60));
      byNcm.set(ncm, cur);
    }
    const topNcm = [...byNcm.values()]
      .sort((a, b) => b.fob - a.fob)
      .slice(0, 15)
      .map(r => ({ ...r, samples: [...r.samples] }));

    const byChannel = topByKey(ops || [], "channel", 8);
    const byOrigin = topByKey(ops || [], "origin", 8);

    // Trend mensual (volumen ops y FOB total)
    const monthly = new Map();
    for (const o of ops || []) {
      const m = new Date(o.created_at).toISOString().slice(0, 7);
      const cur = monthly.get(m) || { month: m, ops: 0, budget: 0 };
      cur.ops += 1;
      cur.budget += Number(o.budget_total || 0);
      monthly.set(m, cur);
    }
    const trend = [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month));

    return j({
      ok: true,
      period_months: months,
      total_ops: ops?.length || 0,
      total_items: items?.length || 0,
      total_fob_usd: Math.round(totalFob * 100) / 100,
      top_ncm: topNcm,
      by_channel: byChannel,
      by_origin: byOrigin,
      monthly_trend: trend,
    });
  }

  // ── MODE: cliente (#10 + #11) ──────────────────────────────
  const clientId = url.searchParams.get("clientId");
  if (!clientId) return j({ ok: false, error: "clientId requerido" }, 400);

  const [client, ops, items] = await Promise.all([
    sb(`/rest/v1/clients?id=eq.${clientId}&select=id,client_code,first_name,last_name,tier,lifetime_points_earned,created_at`),
    sb(`/rest/v1/operations?client_id=eq.${clientId}&select=id,operation_code,channel,origin,status,budget_total,created_at,closed_at,delivered_at&order=created_at.asc`),
    sb(`/rest/v1/operation_items?select=ncm_code,description,quantity,unit_price_usd,operation_id,operations!inner(client_id,created_at,operation_code)&operations.client_id=eq.${clientId}&limit=2000`),
  ]);
  const cl = Array.isArray(client) ? client[0] : null;
  if (!cl) return j({ ok: false, error: "cliente no encontrado" }, 404);

  const opsArr = ops || [];
  const itemsArr = items || [];

  // Stats básicos
  const closed = opsArr.filter(o => o.status === "operacion_cerrada");
  const totalBudget = opsArr.reduce((s, o) => s + Number(o.budget_total || 0), 0);
  const avgTicket = closed.length ? closed.reduce((s, o) => s + Number(o.budget_total || 0), 0) / closed.length : 0;
  const lastOp = opsArr.length ? opsArr[opsArr.length - 1] : null;
  const daysSinceLast = lastOp ? Math.round((Date.now() - new Date(lastOp.created_at).getTime()) / 86400000) : null;

  // Predicción próxima importación
  const prediction = predictNextImport(opsArr);

  // Importaciones similares: top NCM y top descripciones
  const ncmStats = topByKey(itemsArr, "ncm_code", 10);
  const descMap = new Map();
  for (const it of itemsArr) {
    const d = (it.description || "").trim();
    if (!d) continue;
    const k = d.toLowerCase().slice(0, 50);
    const cur = descMap.get(k) || { description: d, count: 0, total_fob: 0 };
    cur.count += 1;
    cur.total_fob += Number(it.unit_price_usd || 0) * Number(it.quantity || 1);
    descMap.set(k, cur);
  }
  const topItems = [...descMap.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  // Canales y orígenes preferidos
  const byChannel = topByKey(opsArr, "channel", 5);
  const byOrigin = topByKey(opsArr, "origin", 5);

  // Resumen narrativo determinístico (sin IA) — bullets generados por reglas
  let narrative = null;
  if (opsArr.length >= 2) {
    const bullets = [];
    if (prediction?.next_estimated_date) {
      const daysToNext = Math.round((new Date(prediction.next_estimated_date).getTime() - Date.now()) / 86400000);
      if (daysToNext < 0) bullets.push(`📅 Está atrasado vs su patrón (debería haber importado hace ${Math.abs(daysToNext)} días). Buen momento para contactarlo.`);
      else if (daysToNext <= 14) bullets.push(`📅 Próxima importación estimada en ${daysToNext} días — armá presupuesto preventivo.`);
      else bullets.push(`📅 Próxima importación en ~${daysToNext} días, cadencia ${prediction.median_interval_days} días (confianza ${prediction.confidence}).`);
    }
    if (byChannel[0]) bullets.push(`📦 Canal preferido: ${byChannel[0].key} (${byChannel[0].count}/${opsArr.length} ops).`);
    if (topItems[0] && topItems[0].count >= 2) bullets.push(`🔁 Producto recurrente: "${topItems[0].description}" (${topItems[0].count}× · USD ${Math.round(topItems[0].total_fob)}).`);
    if (avgTicket > 0) bullets.push(`💵 Ticket promedio USD ${Math.round(avgTicket).toLocaleString("en-US")} · ${closed.length} ops cerradas de ${opsArr.length}.`);
    if (daysSinceLast !== null && prediction?.median_interval_days && daysSinceLast > prediction.median_interval_days * 1.5) {
      bullets.push(`⚠️ Pasaron ${daysSinceLast} días desde su última op (50% más que su cadencia) — posible churn, contactar ya.`);
    }
    narrative = bullets.join("\n");
  }

  return j({
    ok: true,
    client: cl,
    stats: {
      ops_total: opsArr.length,
      ops_closed: closed.length,
      total_budget_usd: Math.round(totalBudget * 100) / 100,
      avg_ticket_usd: Math.round(avgTicket * 100) / 100,
      days_since_last_op: daysSinceLast,
      first_op_at: opsArr[0]?.created_at || null,
      last_op_at: lastOp?.created_at || null,
    },
    prediction,
    similar_imports: { top_ncm: ncmStats, top_items: topItems },
    preferences: { by_channel: byChannel, by_origin: byOrigin },
    narrative,
    operations: opsArr.slice(-20).reverse(),
  });
}
