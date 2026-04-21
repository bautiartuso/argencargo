// POST /api/notify
// Body: { op_id, trigger, force }
// Triggers soportados: 'deposito' | 'arribo' | 'cerrada'
//
// Envía email al cliente usando Resend (free tier: 3k/mes).
// Marca en operations.sent_notifications para evitar doble envío (a menos que force=true).
//
// Env vars requeridas:
//   RESEND_API_KEY        → API key de Resend
//   RESEND_FROM           → opcional, default 'Argencargo <onboarding@resend.dev>'
//   PUBLIC_BASE_URL       → opcional, default https://argencargo.com.ar (para links)
//   SUPABASE_SERVICE_ROLE → para auth/consultas server-side

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const RESEND_KEY = process.env.RESEND_API_KEY;
// Dominio argencargo.com.ar verificado en Resend → emails salen desde info@
const RESEND_FROM = process.env.RESEND_FROM || "Argencargo <info@argencargo.com.ar>";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://argencargo.com.ar";

export const maxDuration = 30;

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

async function verifyAdmin(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const jwt = auth.slice(7);
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString());
    const p = await sb(`/rest/v1/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p) && p[0]?.role === "admin";
  } catch { return false; }
}

// Reemplaza {{vars}} en un texto con los valores de data.
function interpolate(text, data) {
  if (!text) return "";
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] != null ? String(data[k]) : "");
}

// Convierte markdown simple (**bold**, \n párrafos) a HTML inline.
function mdToHtml(text) {
  if (!text) return "";
  return String(text)
    .split(/\n\n+/)
    .map(p => `<p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 12px">${
      p.replace(/\n/g, "<br/>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    }</p>`)
    .join("");
}

async function fetchTemplate(key) {
  const r = await fetch(`${SB_URL}/rest/v1/message_templates?key=eq.${key}&select=*`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  const arr = await r.json();
  return Array.isArray(arr) && arr[0] ? arr[0] : null;
}

// Plantillas de email HTML por trigger (leídas de DB)
async function renderEmail(trigger, op, client) {
  const firstName = client?.first_name || "";
  const opCode = op.operation_code || "";
  const desc = op.description || "tu mercadería";
  const portalLink = `${BASE_URL}/portal?op=${opCode}`;
  const feedbackLink = `${BASE_URL}/feedback?op=${opCode}`;
  const data = { firstName, opCode, desc, portalLink, feedbackLink };
  const NAVY = "#152D54"; const AC = "#3B7DD8";

  const tpl = await fetchTemplate(`email_${trigger}`);
  if (!tpl) return null;

  const subject = interpolate(tpl.subject, data);
  const greeting = interpolate(tpl.greeting, data);
  const body = interpolate(tpl.body, data);
  const ctaText = tpl.cta_text;

  const ctaLink = trigger === "cerrada" ? null : (trigger === "arribo" ? portalLink : portalLink);

  const button = (href, text, color = AC) =>
    `<div style="text-align:center;margin:24px 0"><a href="${href}" style="display:inline-block;padding:14px 32px;background:${color};color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:15px">${text}</a></div>`;

  // Para cerrada: renderizamos 5 estrellas clickables en vez de botón CTA.
  const extraHtml = trigger === "cerrada"
    ? `<div style="text-align:center;margin:24px 0;padding:20px;background:#f5f7fa;border-radius:12px">
        <p style="font-size:13px;color:#666;margin:0 0 12px;font-weight:600">Tocá las estrellas según tu experiencia:</p>
        <div>${[1,2,3,4,5].map(n => `<a href="${BASE_URL}/feedback?op=${opCode}&r=${n}" style="text-decoration:none;font-size:40px;color:#fbbf24;margin:0 4px;display:inline-block">★</a>`).join("")}</div>
        <p style="font-size:11px;color:#999;margin:12px 0 0">1 = muy mala · 5 = excelente</p>
      </div>`
    : (ctaText && ctaLink ? button(ctaLink, ctaText) : "");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a1a">
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:linear-gradient(135deg,${NAVY},${AC});padding:32px 24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">Argencargo</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px">Tu operación de importación, resuelta</p>
    </div>
    <div style="padding:32px 28px">
      ${greeting ? `<h2 style="color:${NAVY};font-size:20px;margin:0 0 12px">${greeting}</h2>` : ""}
      ${mdToHtml(body)}
      ${extraHtml}
      <p style="color:#666;font-size:13px;margin:28px 0 0;padding-top:16px;border-top:1px solid #eee">
        Código de operación: <strong style="color:${NAVY};font-family:monospace">${opCode}</strong><br/>
        Cualquier consulta, respondé este email o escribinos por WhatsApp.
      </p>
    </div>
    <div style="padding:16px 24px;background:#f5f7fa;text-align:center;color:#888;font-size:11px">
      Argencargo · Av. Callao 1137, CABA · <a href="${BASE_URL}" style="color:${AC};text-decoration:none">argencargo.com.ar</a>
    </div>
  </div>
</body></html>`;

  return { subject, html };
}

export async function POST(req) {
  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!RESEND_KEY) return Response.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });

    const { op_id, trigger, force } = await req.json();
    if (!op_id || !trigger) return Response.json({ error: "op_id y trigger requeridos" }, { status: 400 });
    if (!["deposito", "arribo", "cerrada"].includes(trigger))
      return Response.json({ error: "trigger inválido" }, { status: 400 });

    // Fetch op + client
    const opArr = await sb(`/rest/v1/operations?id=eq.${op_id}&select=*,clients(first_name,last_name,email)`);
    const op = Array.isArray(opArr) ? opArr[0] : null;
    if (!op) return Response.json({ error: "op no encontrada" }, { status: 404 });
    const client = op.clients;
    if (!client?.email) return Response.json({ error: "cliente sin email" }, { status: 400 });

    // Check ya enviado
    const sentKey = `email_${trigger}`;
    if (!force && op.sent_notifications?.[sentKey]) {
      return Response.json({ skipped: "already_sent", at: op.sent_notifications[sentKey] });
    }
    // Respetar skip_review_request para el trigger 'cerrada' (admin marca ops que no deben pedir reseña)
    if (trigger === "cerrada" && op.skip_review_request) {
      return Response.json({ skipped: "skip_review_request" });
    }

    // Render + send
    const tpl = await renderEmail(trigger, op, client);
    if (!tpl) return Response.json({ error: "template no encontrada" }, { status: 500 });

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [client.email],
        subject: tpl.subject,
        html: tpl.html,
      }),
    });
    const resp = await r.json();
    if (!r.ok) return Response.json({ error: "resend_failed", detail: resp }, { status: 500 });

    // Marcar como enviado
    const newSent = { ...(op.sent_notifications || {}), [sentKey]: new Date().toISOString() };
    await sb(`/rest/v1/operations?id=eq.${op_id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ sent_notifications: newSent }),
    });

    return Response.json({ ok: true, resend_id: resp.id, sent_at: new Date().toISOString() });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
