// GET /api/cron/daily-summary
// Mail diario al admin con resumen del día anterior + tareas pendientes hoy.
// Cron: 7am AR (10 UTC).
// Auth: Bearer CRON_SECRET (Vercel cron) o admin manual con ?send=1 / ?preview=1

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "Argencargo <info@argencargo.com.ar>";
const ADMIN_EMAIL = process.env.ADMIN_REPORT_EMAIL || "bautista@argencargo.com.ar";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

export const maxDuration = 30;

async function sb(path) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  return r.ok ? r.json() : [];
}

async function isAuth(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${process.env.CRON_SECRET || ""}`) return true;
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    if (!payload?.sub) return false;
    const p = await sb(`/rest/v1/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p) && p[0]?.role === "admin";
  } catch { return false; }
}

const usd = (n) => `USD ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const NAVY = "#152D54", AC = "#3B7DD8", GOLD = "#B8956A", GOLD_LIGHT = "#D4B17A";

function renderHtml({ yesterdayDate, opsCreatedYesterday, opsCobradasYesterday, montoCobradoYesterday, packagesYesterday, todayPending, overdueReminders }) {
  const LOGO = `${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
  const dateStr = new Date(yesterdayDate).toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:20px 0"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">

      <tr><td align="center" style="background:linear-gradient(135deg,${NAVY},${AC});padding:24px 28px">
        <img src="${LOGO}" alt="Argencargo" width="140" style="display:block;margin:0 auto 8px"/>
        <div style="font-size:11px;font-weight:700;color:${GOLD_LIGHT};letter-spacing:0.18em;text-transform:uppercase">☀ Buenos días</div>
        <div style="font-size:18px;font-weight:800;color:#fff;margin-top:4px;text-transform:capitalize">${dateStr}</div>
      </td></tr>

      <tr><td style="padding:24px 28px">

        <h2 style="font-size:13px;color:${NAVY};margin:0 0 12px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid ${GOLD};padding-bottom:6px">📅 Ayer</h2>
        <table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom:18px">
          <tr>
            <td style="padding:10px 12px;background:#f8fafc;border-radius:6px;width:33%">
              <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.05em">Ops nuevas</div>
              <div style="font-size:20px;font-weight:800;color:${NAVY};margin-top:2px">${opsCreatedYesterday}</div>
            </td>
            <td style="width:6px"></td>
            <td style="padding:10px 12px;background:#f8fafc;border-radius:6px;width:33%">
              <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.05em">Cobradas</div>
              <div style="font-size:20px;font-weight:800;color:#22c55e;margin-top:2px">${opsCobradasYesterday}</div>
              <div style="font-size:10px;color:#666;margin-top:2px">${usd(montoCobradoYesterday)}</div>
            </td>
            <td style="width:6px"></td>
            <td style="padding:10px 12px;background:#f8fafc;border-radius:6px;width:33%">
              <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.05em">Paquetes recibidos</div>
              <div style="font-size:20px;font-weight:800;color:${NAVY};margin-top:2px">${packagesYesterday}</div>
            </td>
          </tr>
        </table>

        <h2 style="font-size:13px;color:${NAVY};margin:0 0 12px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid ${GOLD};padding-bottom:6px">⚡ Para hoy</h2>
        ${todayPending.length === 0 ? `<p style="background:#dcfce7;padding:12px;border-radius:8px;text-align:center;color:#166534;font-weight:600;font-size:13px;margin:0 0 18px">✓ No hay tareas urgentes pendientes</p>` : `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;margin-bottom:18px">
          ${todayPending.map(t => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;background:#fef3c7"><strong style="color:${NAVY}">${t.icon} ${t.title}</strong> <span style="color:#666">— ${t.count} ${t.count === 1 ? "operación" : "operaciones"}</span></td></tr>`).join("")}
        </table>`}

        ${overdueReminders.length > 0 ? `<h2 style="font-size:13px;color:#ef4444;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid #ef4444;padding-bottom:6px">⏰ Recordatorios vencidos (${overdueReminders.length})</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;margin-bottom:18px">
          ${overdueReminders.slice(0, 8).map(r => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">📌 <strong style="color:${NAVY}">${r.op_code}</strong> — ${r.body}</td></tr>`).join("")}
          ${overdueReminders.length > 8 ? `<tr><td style="padding:6px 12px;color:#999;font-style:italic;font-size:11px">+${overdueReminders.length - 8} más en el panel</td></tr>` : ""}
        </table>` : ""}

        <div style="text-align:center;margin:20px 0 0">
          <a href="${BASE_URL}/admin" style="display:inline-block;padding:12px 28px;background:${GOLD};color:#0A1628;text-decoration:none;font-weight:700;border-radius:8px;font-size:13px">Ir al panel admin →</a>
        </div>

      </td></tr>

      <tr><td style="padding:18px 28px;background:${NAVY};text-align:center"><p style="font-size:10px;color:#cfd8e8;margin:0">Resumen automático diario · Argencargo</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function GET(req) {
  if (!(await isAuth(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!RESEND_KEY) return Response.json({ error: "RESEND_API_KEY no configurado" }, { status: 500 });

  const url = new URL(req.url);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const yEnd = new Date(yesterday);
  yEnd.setHours(23, 59, 59, 999);

  const todayISO = new Date().toISOString();
  const yISO = yesterday.toISOString();
  const yEndISO = yEnd.toISOString();
  const d3agoISO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const d5agoISO = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  // Métricas de ayer
  const [opsCreated, opsClosed, payments, packages, opsToday] = await Promise.all([
    sb(`/rest/v1/operations?select=id&created_at=gte.${yISO}&created_at=lte.${yEndISO}`),
    sb(`/rest/v1/operations?select=id,collected_amount&is_collected=eq.true&closed_at=gte.${yISO}&closed_at=lte.${yEndISO}`),
    sb(`/rest/v1/operation_client_payments?select=amount_usd&payment_date=eq.${yISO.slice(0, 10)}`),
    sb(`/rest/v1/operation_packages?select=id&created_at=gte.${yISO}&created_at=lte.${yEndISO}`),
    sb(`/rest/v1/operations?select=id,status,delivered_at,is_collected,budget_total,collected_amount,channel`),
  ]);

  const opsCreatedYesterday = (opsCreated || []).length;
  const opsCobradasYesterday = (opsClosed || []).length;
  const montoCobradoYesterday = (payments || []).reduce((s, p) => s + Number(p.amount_usd || 0), 0);
  const packagesYesterday = (packages || []).length;

  // Pendientes hoy: cobranzas vencidas, vuelos listos, avisos sin confirmar, etc.
  const opsArr = Array.isArray(opsToday) ? opsToday : [];
  const cobrarVencidas = opsArr.filter(o => !o.is_collected && ["entregada", "operacion_cerrada"].includes(o.status) && o.delivered_at && o.delivered_at < d3agoISO).length;
  const flightsReady = await sb(`/rest/v1/flights?select=id&status=eq.preparando&invoice_presented_at=not.is.null`);
  const avisos = await sb(`/rest/v1/purchase_notifications?select=id&status=eq.pending&created_at=lt.${new Date(Date.now() - 86400000).toISOString()}`);

  const todayPending = [
    cobrarVencidas > 0 ? { icon: "💰", title: "Cobranzas vencidas (>3d)", count: cobrarVencidas } : null,
    Array.isArray(flightsReady) && flightsReady.length > 0 ? { icon: "✈️", title: "Vuelos listos para despachar", count: flightsReady.length } : null,
    Array.isArray(avisos) && avisos.length > 0 ? { icon: "📦", title: "Avisos compra +24h sin confirmar", count: avisos.length } : null,
  ].filter(Boolean);

  // Recordatorios vencidos del admin
  const overdueRem = await sb(`/rest/v1/operation_notes?select=body,operation_id,operations(operation_code)&remind_at=lte.${todayISO}&done_at=is.null&order=remind_at.asc`);
  const overdueReminders = (Array.isArray(overdueRem) ? overdueRem : []).map(r => ({ body: r.body, op_code: r.operations?.operation_code || "—" }));

  // Si NO hay nada relevante, no manda el mail (evita spam diario)
  const hasContent = opsCreatedYesterday > 0 || opsCobradasYesterday > 0 || packagesYesterday > 0 || todayPending.length > 0 || overdueReminders.length > 0;
  const html = renderHtml({ yesterdayDate: yesterday, opsCreatedYesterday, opsCobradasYesterday, montoCobradoYesterday, packagesYesterday, todayPending, overdueReminders });

  if (url.searchParams.get("preview") === "1") {
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (!hasContent && !url.searchParams.get("force")) {
    return Response.json({ ok: true, skipped: "Sin contenido relevante" });
  }

  const dateStr = yesterday.toLocaleDateString("es-AR", { day: "2-digit", month: "long" });
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [ADMIN_EMAIL], subject: `☀ Resumen Argencargo · ${dateStr}`, html }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) return Response.json({ error: "send failed", detail: j }, { status: 500 });

  return Response.json({ ok: true, sent_to: ADMIN_EMAIL, summary: { opsCreatedYesterday, opsCobradasYesterday, montoCobradoYesterday: montoCobradoYesterday.toFixed(2), packagesYesterday, todayPending: todayPending.length, overdueReminders: overdueReminders.length } });
}
