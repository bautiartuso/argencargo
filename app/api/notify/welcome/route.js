// POST /api/notify/welcome
// Body: { client_id }  — envía email de bienvenida al cliente recién registrado.
//
// Permite llamadas autenticadas con JWT del propio cliente (auth_user_id match)
// o con CRON_SECRET (server-to-server).

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "Argencargo <info@argencargo.com.ar>";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

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

function interpolate(text, data) {
  if (!text) return "";
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, k) =>
    data[k] != null ? String(data[k]) : ""
  );
}

function mdToHtml(text) {
  if (!text) return "";
  const normalized = String(text).replace(/\\n/g, "\n").replace(/\\r/g, "");
  return normalized
    .split(/\n\n+/)
    .map(p =>
      `<p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 12px">${
        p.replace(/\n/g, "<br/>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      }</p>`
    )
    .join("");
}

function renderShell({ subject, greeting, body, ctaLink, ctaText }) {
  const NAVY = "#152D54";
  const AC = "#3B7DD8";
  const LOGO_WHITE = `${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
  const greetingHtml = greeting
    ? `<h2 style="color:${NAVY};font-size:20px;margin:0 0 16px;font-weight:700">${greeting}</h2>`
    : "";
  const ctaHtml = ctaLink && ctaText
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
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="110" valign="middle" style="padding-right:16px">
                <img src="${LOGO_WHITE}" alt="Argencargo" width="100" style="display:block;max-width:100px;height:auto"/>
              </td>
              <td valign="middle" style="font-size:12px;line-height:1.7;color:#cfd8e8">
                <div style="font-weight:800;color:#fff;letter-spacing:0.02em;margin-bottom:2px">ARGENCARGO</div>
                <div><span style="color:#8ea3c4">T.</span> +54 9 11 2508-8580</div>
                <div><span style="color:#8ea3c4">E-mail:</span> <a href="mailto:info@argencargo.com.ar" style="color:#8fb8ff;text-decoration:none">info@argencargo.com.ar</a></div>
                <div>Av Callao 1137 — Recoleta, CABA</div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
      <p style="font-size:10px;color:#aaa;margin:12px 0 0;text-align:center">© ${new Date().getFullYear()} Argencargo · <a href="https://argencargo.com.ar" style="color:#888;text-decoration:none">argencargo.com.ar</a></p>
    </td></tr>
  </table>
</body></html>`;
}

async function isAuthorized(req, clientId) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && token === cronSecret) return true;
  // JWT del propio cliente: verificamos que el auth_user_id del client coincida con el sub
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    if (!payload?.sub || !clientId) return false;
    const cl = await sb(`/rest/v1/clients?select=auth_user_id&id=eq.${clientId}`);
    const ownerId = Array.isArray(cl) && cl[0] ? cl[0].auth_user_id : null;
    if (ownerId && ownerId === payload.sub) return true;
    // también admin
    const p = await sb(`/rest/v1/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p) && p[0]?.role === "admin";
  } catch { return false; }
}

export async function POST(req) {
  try {
    if (!RESEND_KEY) return Response.json({ error: "RESEND_API_KEY no configurado" }, { status: 500 });
    if (!SB_SERVICE) return Response.json({ error: "SUPABASE_SERVICE_ROLE no configurado" }, { status: 500 });

    const { client_id } = await req.json();
    if (!client_id) return Response.json({ error: "client_id requerido" }, { status: 400 });

    const authOk = await isAuthorized(req, client_id);
    if (!authOk) return Response.json({ error: "unauthorized" }, { status: 401 });

    // Cargar cliente
    const cl = await sb(`/rest/v1/clients?select=*&id=eq.${client_id}`);
    const client = Array.isArray(cl) && cl[0] ? cl[0] : null;
    if (!client) return Response.json({ error: "cliente no encontrado" }, { status: 404 });
    if (!client.email) return Response.json({ error: "cliente sin email" }, { status: 400 });

    // No duplicar: si ya enviamos welcome_sent_at, skip (a menos que force=true)
    if (client.welcome_sent_at) {
      return Response.json({ ok: true, skipped: "welcome ya enviado previamente" });
    }

    // Template
    const tpl = await sb(`/rest/v1/message_templates?key=eq.email_welcome&select=*`);
    const t = Array.isArray(tpl) && tpl[0] ? tpl[0] : null;
    if (!t) return Response.json({ error: "template email_welcome no encontrada" }, { status: 500 });

    const data = {
      firstName: client.first_name || "",
      lastName: client.last_name || "",
      clientCode: client.client_code || "",
      portalLink: `${BASE_URL}/portal`,
    };

    const subject = interpolate(t.subject, data);
    const greeting = interpolate(t.greeting, data);
    const body = mdToHtml(interpolate(t.body, data));
    const ctaText = t.cta_text;
    const ctaLink = data.portalLink;

    const html = renderShell({ subject, greeting, body, ctaLink, ctaText });

    // Enviar via Resend
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [client.email],
        subject,
        html,
      }),
    });

    const respBody = await resp.json().catch(() => null);
    if (!resp.ok) {
      return Response.json(
        { error: "fallo en envío", detail: respBody, status: resp.status },
        { status: 500 }
      );
    }

    // Marcar welcome_sent_at
    await sb(`/rest/v1/clients?id=eq.${client_id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ welcome_sent_at: new Date().toISOString() }),
    });

    return Response.json({ ok: true, resend_id: respBody?.id || null });
  } catch (e) {
    console.error("welcome error", e);
    return Response.json({ error: e.message || "error interno" }, { status: 500 });
  }
}
