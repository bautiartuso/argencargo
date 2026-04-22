// GET/POST /api/reminders
// Cron diario (vercel.json). Protegido con CRON_SECRET.
//
// Detecta ops estancadas y dispara recordatorios por email al cliente.
// Guarda en operations.sent_notifications[reminder_X] para no duplicar.
//
// Reglas:
//   - `reminder_consolidation`: op en `en_deposito_origen` >3 días sin consolidation_confirmed.
//   - `reminder_docs`: op en `en_preparacion` >3 días sin productos cargados.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE || "";
const RESEND_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "Argencargo <info@argencargo.com.ar>";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://argencargo.com.ar";
const LOGO_WHITE = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";

export const maxDuration = 60;

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return null; }
}

function interpolate(text, data) {
  if (!text) return "";
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] != null ? String(data[k]) : "");
}

function mdToHtml(text) {
  if (!text) return "";
  const normalized = String(text).replace(/\\n/g, "\n").replace(/\\r/g, "");
  return normalized.split(/\n\n+/).map(p => `<p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 12px">${
    p.replace(/\n/g, "<br/>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  }</p>`).join("");
}

function renderShell({ subject, greeting, body, ctaLink, ctaText }) {
  const NAVY = "#152D54", AC = "#3B7DD8";
  const greetingHtml = greeting ? `<h2 style="color:${NAVY};font-size:20px;margin:0 0 16px;font-weight:700">${greeting}</h2>` : "";
  const ctaHtml = ctaText && ctaLink
    ? `<div style="text-align:center;margin:24px 0"><a href="${ctaLink}" style="display:inline-block;padding:14px 32px;background:${AC};color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:15px">${ctaText}</a></div>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject || "Argencargo"}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
        <tr><td align="center" style="background:linear-gradient(135deg,${NAVY},${AC});padding:40px 32px">
          <img src="${LOGO_WHITE}" alt="Argencargo" width="200" style="display:block;max-width:200px;height:auto;margin:0 auto"/>
        </td></tr>
        <tr><td style="padding:28px 32px">
          ${greetingHtml}
          ${body || ""}
          ${ctaHtml}
        </td></tr>
        <tr><td style="padding:28px 32px;background:${NAVY}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="110" valign="middle" style="padding-right:16px">
              <img src="${LOGO_WHITE}" alt="Argencargo" width="100" style="display:block;max-width:100px;height:auto"/>
            </td>
            <td valign="middle" style="font-size:12px;line-height:1.7;color:#cfd8e8">
              <div style="font-weight:800;color:#fff;margin-bottom:2px">ARGENCARGO</div>
              <div><span style="color:#8ea3c4">T.</span> +54 9 11 2508-8580</div>
              <div><span style="color:#8ea3c4">E-mail:</span> <a href="mailto:info@argencargo.com.ar" style="color:#8fb8ff;text-decoration:none">info@argencargo.com.ar</a></div>
              <div>Av Callao 1137 — Recoleta, CABA</div>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendReminder(op, trigger) {
  const client = op.clients;
  if (!client?.email) return { skipped: "no_email" };

  const tplArr = await sb(`/rest/v1/message_templates?key=eq.email_${trigger}&select=*`);
  const tpl = Array.isArray(tplArr) && tplArr[0] ? tplArr[0] : null;
  if (!tpl) return { skipped: "no_template" };

  const data = {
    firstName: client.first_name || "",
    opCode: op.operation_code || "",
    desc: op.description || "tu mercadería",
    portalLink: `${BASE_URL}/portal?op=${op.operation_code}`,
  };
  const subject = interpolate(tpl.subject, data);
  const greeting = interpolate(tpl.greeting, data);
  const body = mdToHtml(interpolate(tpl.body, data));
  const html = renderShell({ subject, greeting, body, ctaLink: data.portalLink, ctaText: tpl.cta_text });

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [client.email], subject, html }),
  });
  const resp = await r.json();
  if (!r.ok) return { error: "resend_failed", detail: resp };

  // Marcar como enviado
  const sentKey = `email_${trigger}`;
  const newSent = { ...(op.sent_notifications || {}), [sentKey]: new Date().toISOString() };
  await sb(`/rest/v1/operations?id=eq.${op.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ sent_notifications: newSent }),
  });
  return { ok: true, resend_id: resp.id };
}

async function runReminders(req) {
  const auth = req.headers.get("authorization") || new URL(req.url).searchParams.get("secret") || "";
  const expected = process.env.CRON_SECRET || "";
  const authorized = !expected || auth === `Bearer ${expected}` || auth === expected;
  if (!authorized) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!SB_SERVICE) return Response.json({ error: "SUPABASE_SERVICE_ROLE no configurado" }, { status: 500 });
  if (!RESEND_KEY) return Response.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });

  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const results = { reminder_consolidation: [], reminder_docs: [] };

  // 1) Consolidación pendiente
  const ops1 = await sb(
    `/rest/v1/operations?status=eq.en_deposito_origen&consolidation_confirmed=eq.false&updated_at=lte.${threeDaysAgo}&select=id,operation_code,description,sent_notifications,clients(first_name,email)`
  );
  if (Array.isArray(ops1)) {
    for (const op of ops1) {
      if (op.sent_notifications?.email_reminder_consolidation) continue;
      const res = await sendReminder(op, "reminder_consolidation");
      results.reminder_consolidation.push({ op: op.operation_code, ...res });
    }
  }

  // 2) Docs pendientes
  const ops2 = await sb(
    `/rest/v1/operations?status=eq.en_preparacion&updated_at=lte.${threeDaysAgo}&select=id,operation_code,description,sent_notifications,clients(first_name,email),operation_items(id)`
  );
  if (Array.isArray(ops2)) {
    for (const op of ops2) {
      if ((op.operation_items || []).length > 0) continue;
      if (op.sent_notifications?.email_reminder_docs) continue;
      const res = await sendReminder(op, "reminder_docs");
      results.reminder_docs.push({ op: op.operation_code, ...res });
    }
  }

  return Response.json({
    ran_at: new Date().toISOString(),
    consolidation_sent: results.reminder_consolidation.length,
    docs_sent: results.reminder_docs.length,
    details: results,
  });
}

export async function GET(req) { return runReminders(req); }
export async function POST(req) { return runReminders(req); }
