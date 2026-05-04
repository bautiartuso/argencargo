// GET /api/cron/monthly-report
// Genera P&L del mes anterior y manda mail HTML al admin.
// Cron: día 1 de cada mes a las 8am (configurado en vercel.json).
// Auth: Vercel cron envía con Authorization: Bearer ${CRON_SECRET}

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "Argencargo <info@argencargo.com.ar>";
const ADMIN_EMAIL = process.env.ADMIN_REPORT_EMAIL || "bautista@argencargo.com.ar";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

export const maxDuration = 60;

async function sb(path) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  return r.ok ? r.json() : [];
}

function usd(n) { return `USD ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function buildReport(ops, clientPayments, supplierPayments, financeEntries, periodStart, periodEnd) {
  const periodMs = (d) => new Date(d).getTime();
  const inPeriod = (d) => d && periodMs(d) >= periodMs(periodStart) && periodMs(d) <= periodMs(periodEnd);

  // Ops cerradas en el período
  const opsCerradas = ops.filter(o => o.closed_at && inPeriod(o.closed_at));
  const opsCancelled = ops.filter(o => o.status === "cancelada" && o.updated_at && inPeriod(o.updated_at));
  const opsCreadas = ops.filter(o => inPeriod(o.created_at));

  // Cobros del mes (lo que efectivamente entró)
  const cobrosMes = clientPayments.filter(p => inPeriod(p.payment_date)).reduce((s, p) => s + Number(p.amount_usd || 0), 0);

  // Costos pagados en el mes (a proveedores)
  const costosMes = supplierPayments.filter(p => p.is_paid && inPeriod(p.payment_date)).reduce((s, p) => s + Number(p.amount_usd || 0) * (p.type === "refund" ? -1 : 1), 0);

  // Costos fijos del mes (finance_entries no auto)
  const costosFijos = financeEntries.filter(e => !e.auto_generated && e.date && inPeriod(e.date)).reduce((s, e) => s + Number(e.amount || 0), 0);

  const ganancia = cobrosMes - costosMes - costosFijos;
  const margen = cobrosMes > 0 ? (ganancia / cobrosMes) * 100 : 0;

  // Por canal
  const porCanal = {};
  for (const o of opsCerradas) {
    const ch = o.channel || "—";
    if (!porCanal[ch]) porCanal[ch] = { count: 0, revenue: 0, cost: 0 };
    porCanal[ch].count++;
    porCanal[ch].revenue += Number(o.collected_amount || o.budget_total || 0);
    porCanal[ch].cost += Number(o.cost_flete || 0) + Number(o.cost_impuestos_reales || 0) + Number(o.cost_gasto_documental || 0) + Number(o.cost_seguro || 0) + Number(o.cost_flete_local || 0) + Number(o.cost_otros || 0);
  }

  // Top 5 clientes por ingresos del mes
  const porCliente = {};
  for (const p of clientPayments.filter(p => inPeriod(p.payment_date))) {
    const op = ops.find(o => o.id === p.operation_id);
    if (!op) continue;
    const cl = op.clients;
    if (!cl) continue;
    const key = cl.client_code;
    if (!porCliente[key]) porCliente[key] = { name: `${cl.first_name || ""} ${cl.last_name || ""}`.trim(), total: 0, ops: 0 };
    porCliente[key].total += Number(p.amount_usd || 0);
    porCliente[key].ops++;
  }
  const topClientes = Object.entries(porCliente).map(([code, v]) => ({ code, ...v })).sort((a, b) => b.total - a.total).slice(0, 5);

  // Alertas
  const deudasPendientes = ops.filter(o => !o.is_collected && ["entregada", "operacion_cerrada"].includes(o.status));
  const deudaTotal = deudasPendientes.reduce((s, o) => s + Number(o.budget_total || 0) - Number(o.collected_amount || 0), 0);

  return { opsCerradas, opsCancelled, opsCreadas, cobrosMes, costosMes, costosFijos, ganancia, margen, porCanal, topClientes, deudasPendientes, deudaTotal };
}

const NAVY = "#152D54";
const AC = "#3B7DD8";
const GOLD = "#B8956A";
const GOLD_LIGHT = "#D4B17A";

function renderEmailHtml(r, periodLabel) {
  const LOGO = `${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
  const channelLabels = { aereo_blanco: "Aéreo Courier Comercial", aereo_negro: "Aéreo Integral AC", maritimo_blanco: "Marítimo LCL/FCL", maritimo_negro: "Marítimo Integral AC" };
  const ganColor = r.ganancia >= 0 ? "#22c55e" : "#ef4444";
  const margenColor = r.margen >= 30 ? "#22c55e" : r.margen >= 15 ? "#fbbf24" : "#ef4444";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte ${periodLabel}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:24px 0">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">

        <tr><td align="center" style="background:linear-gradient(135deg,${NAVY},${AC});padding:32px 28px">
          <img src="${LOGO}" alt="Argencargo" width="160" style="display:block;margin:0 auto 12px"/>
          <div style="font-size:11px;font-weight:700;color:${GOLD_LIGHT};letter-spacing:0.18em;text-transform:uppercase">📊 Reporte Mensual</div>
          <div style="font-size:22px;font-weight:800;color:#fff;margin-top:6px;letter-spacing:-0.01em">${periodLabel}</div>
        </td></tr>

        <tr><td style="padding:28px">

          <h2 style="font-size:14px;color:${NAVY};margin:0 0 14px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid ${GOLD};padding-bottom:8px">💰 Resumen financiero</h2>

          <table width="100%" cellpadding="12" cellspacing="0" style="margin-bottom:18px">
            <tr>
              <td style="background:#f8fafc;border-radius:8px;padding:14px;width:33%">
                <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Cobrado</div>
                <div style="font-size:22px;font-weight:800;color:${NAVY};margin-top:4px">${usd(r.cobrosMes)}</div>
              </td>
              <td style="width:8px"></td>
              <td style="background:#f8fafc;border-radius:8px;padding:14px;width:33%">
                <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Costos</div>
                <div style="font-size:22px;font-weight:800;color:#ef4444;margin-top:4px">${usd(r.costosMes + r.costosFijos)}</div>
              </td>
              <td style="width:8px"></td>
              <td style="background:#f8fafc;border-radius:8px;padding:14px;width:33%">
                <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Ganancia</div>
                <div style="font-size:22px;font-weight:800;color:${ganColor};margin-top:4px">${usd(r.ganancia)}</div>
              </td>
            </tr>
          </table>

          <div style="background:linear-gradient(90deg,#fef3c7,#fef9c3);padding:14px 18px;border-radius:8px;margin-bottom:24px;text-align:center">
            <div style="font-size:11px;color:#78350f;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">Margen del mes</div>
            <div style="font-size:30px;font-weight:800;color:${margenColor};margin-top:4px">${r.margen.toFixed(1)}%</div>
          </div>

          <h2 style="font-size:14px;color:${NAVY};margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid ${GOLD};padding-bottom:8px">📦 Operaciones del mes</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;margin-bottom:24px">
            <tr><td style="padding:6px 0">Operaciones cerradas</td><td style="text-align:right;font-weight:700">${r.opsCerradas.length}</td></tr>
            <tr><td style="padding:6px 0">Operaciones nuevas</td><td style="text-align:right;font-weight:700">${r.opsCreadas.length}</td></tr>
            <tr><td style="padding:6px 0;color:#9ca3af">Operaciones canceladas</td><td style="text-align:right;font-weight:700;color:#9ca3af">${r.opsCancelled.length}</td></tr>
          </table>

          ${Object.keys(r.porCanal).length > 0 ? `<h2 style="font-size:14px;color:${NAVY};margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid ${GOLD};padding-bottom:8px">🚚 Por canal</h2>
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size:12px;margin-bottom:24px;border-collapse:collapse">
            <tr style="background:${NAVY};color:#fff">
              <th style="padding:8px 12px;text-align:left;font-size:10px;letter-spacing:0.05em">Canal</th>
              <th style="padding:8px 12px;text-align:center;font-size:10px;letter-spacing:0.05em">Ops</th>
              <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:0.05em">Cobrado</th>
              <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:0.05em">Costo</th>
              <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:0.05em">Margen</th>
            </tr>
            ${Object.entries(r.porCanal).map(([ch, v]) => {
              const m = v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0;
              return `<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:8px 12px">${channelLabels[ch] || ch}</td><td style="padding:8px 12px;text-align:center">${v.count}</td><td style="padding:8px 12px;text-align:right">${usd(v.revenue)}</td><td style="padding:8px 12px;text-align:right;color:#ef4444">${usd(v.cost)}</td><td style="padding:8px 12px;text-align:right;font-weight:700;color:${m >= 20 ? "#22c55e" : "#fbbf24"}">${m.toFixed(1)}%</td></tr>`;
            }).join("")}
          </table>` : ""}

          ${r.topClientes.length > 0 ? `<h2 style="font-size:14px;color:${NAVY};margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid ${GOLD};padding-bottom:8px">🏆 Top 5 clientes del mes</h2>
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size:12px;margin-bottom:24px;border-collapse:collapse">
            ${r.topClientes.map((c, i) => `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px 4px;font-size:14px;width:30px;color:${GOLD};font-weight:700">${i + 1}.</td><td style="padding:8px 12px"><strong>${c.code}</strong> — ${c.name}</td><td style="padding:8px 12px;text-align:center;color:#6b7280">${c.ops} pago${c.ops > 1 ? "s" : ""}</td><td style="padding:8px 12px;text-align:right;font-weight:700">${usd(c.total)}</td></tr>`).join("")}
          </table>` : ""}

          ${r.deudasPendientes.length > 0 ? `<h2 style="font-size:14px;color:#ef4444;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #ef4444;padding-bottom:8px">⚠ Cobranzas pendientes</h2>
          <p style="font-size:13px;color:#374151;margin:0 0 14px">Hay <strong>${r.deudasPendientes.length} operaciones entregadas/cerradas</strong> sin cobrar por un total de <strong style="color:#ef4444">${usd(r.deudaTotal)}</strong>.</p>
          <a href="${BASE_URL}/admin" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:13px">Revisar cobranzas →</a>` : `<div style="background:#dcfce7;padding:14px;border-radius:8px;text-align:center;color:#166534;font-weight:600;font-size:13px">✓ Todas las operaciones entregadas están cobradas</div>`}

        </td></tr>

        <tr><td style="padding:24px 28px;background:${NAVY};text-align:center">
          <p style="font-size:11px;color:#cfd8e8;margin:0;line-height:1.6">Reporte generado automáticamente el día 1 de cada mes.<br/>Argencargo · <a href="${BASE_URL}/admin" style="color:#8fb8ff;text-decoration:none">Panel admin</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function GET(req) {
  // Auth: Vercel cron usa Bearer del CRON_SECRET, o el admin lo dispara manual
  const auth = req.headers.get("authorization") || "";
  const isCron = auth === `Bearer ${process.env.CRON_SECRET || ""}`;
  const url = new URL(req.url);
  const isManual = url.searchParams.get("preview") === "1" || url.searchParams.get("send") === "1";
  if (!isCron && !isManual) return Response.json({ error: "unauthorized" }, { status: 401 });

  if (!RESEND_KEY) return Response.json({ error: "RESEND_API_KEY no configurado" }, { status: 500 });

  // Período: mes anterior (si manual con ?month=YYYY-MM permite override)
  const monthParam = url.searchParams.get("month");
  let periodStart, periodEnd, periodLabel;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    periodStart = new Date(y, m - 1, 1);
    periodEnd = new Date(y, m, 0, 23, 59, 59);
  } else {
    const today = new Date();
    periodStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    periodEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
  }
  periodLabel = periodStart.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  periodLabel = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);

  // Cargar datos
  const [ops, clientPayments, supplierPayments, financeEntries] = await Promise.all([
    sb(`/rest/v1/operations?select=*,clients(client_code,first_name,last_name)`),
    sb(`/rest/v1/operation_client_payments?select=*&order=payment_date.desc`),
    sb(`/rest/v1/operation_supplier_payments?select=*&order=payment_date.desc`),
    sb(`/rest/v1/finance_entries?select=*&order=date.desc`),
  ]);

  const report = buildReport(ops, clientPayments, supplierPayments, financeEntries, periodStart.toISOString(), periodEnd.toISOString());
  const html = renderEmailHtml(report, periodLabel);
  const subject = `📊 Argencargo — Reporte ${periodLabel}`;

  // Modo preview: devuelve el HTML para visualizar en browser
  if (url.searchParams.get("preview") === "1") {
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Enviar mail
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [ADMIN_EMAIL], subject, html }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) return Response.json({ error: "send failed", detail: j }, { status: 500 });

  return Response.json({
    ok: true,
    period: periodLabel,
    sent_to: ADMIN_EMAIL,
    resend_id: j?.id,
    summary: {
      ops_cerradas: report.opsCerradas.length,
      cobrado: report.cobrosMes.toFixed(2),
      costos: (report.costosMes + report.costosFijos).toFixed(2),
      ganancia: report.ganancia.toFixed(2),
      margen: report.margen.toFixed(1) + "%",
      deudas_pendientes: report.deudasPendientes.length,
    },
  });
}
