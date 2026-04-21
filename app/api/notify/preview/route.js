// POST /api/notify/preview
// Body: { to, trigger }
// Renderiza la plantilla de email correspondiente con datos de EJEMPLO
// y la envía al destinatario indicado. Solo admin. No toca ninguna op real.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "Argencargo <info@argencargo.com.ar>";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://argencargo.com.ar";
const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";

async function verifyAdmin(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const jwt = auth.slice(7);
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString());
    const r = await fetch(`${SB_URL}/rest/v1/profiles?select=role&id=eq.${payload.sub}`, {
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
    });
    const p = await r.json();
    return Array.isArray(p) && p[0]?.role === "admin";
  } catch { return false; }
}

function interpolate(text, data) {
  if (!text) return "";
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] != null ? String(data[k]) : "");
}

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

function renderShell({ subject, greeting, body, extraHtml, opCode, isPreview }) {
  const NAVY = "#152D54", AC = "#3B7DD8";
  const greetingHtml = greeting ? `<h2 style="color:${NAVY};font-size:20px;margin:0 0 16px;font-weight:700">${greeting}</h2>` : "";
  const previewBanner = isPreview ? `<div style="background:#fff3cd;border-bottom:1px solid #ffc107;padding:10px 16px;text-align:center;font-size:12px;color:#856404;font-weight:600">📧 EMAIL DE PREVIEW · Este es un test de plantilla con datos de ejemplo, no es real.</div>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject || "Argencargo"}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
        ${previewBanner}
        <tr><td align="center" style="background:linear-gradient(135deg,${NAVY},${AC});padding:36px 32px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="background:#fff;border-radius:14px;padding:18px 32px;box-shadow:0 4px 12px rgba(0,0,0,0.15)">
              <img src="${LOGO}" alt="Argencargo" width="180" style="display:block;max-width:180px;height:auto"/>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 32px">
          ${greetingHtml}
          ${body || ""}
          ${extraHtml || ""}
        </td></tr>
        ${opCode ? `<tr><td style="padding:0 32px 24px"><p style="color:#666;font-size:13px;margin:0;padding-top:16px;border-top:1px solid #eee">Código de operación: <strong style="color:${NAVY};font-family:monospace">${opCode}</strong><br/>Cualquier consulta, respondé este email o escribinos por WhatsApp.</p></td></tr>` : ""}
        <tr><td style="padding:28px 32px;background:#f5f7fa;border-top:1px solid #eef1f5">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="90" valign="top" style="padding-right:16px">
                <img src="${LOGO}" alt="Argencargo" width="80" style="display:block;max-width:80px;height:auto"/>
              </td>
              <td valign="top" style="font-size:12px;line-height:1.7;color:#333">
                <div style="font-weight:800;color:${NAVY};letter-spacing:0.02em;margin-bottom:2px">ARGENCARGO</div>
                <div><span style="color:#888">T.</span> +54 9 11 2508-8580</div>
                <div><span style="color:#888">E-mail:</span> <a href="mailto:info@argencargo.com.ar" style="color:${AC};text-decoration:none">info@argencargo.com.ar</a></div>
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

export async function POST(req) {
  try {
    if (!await verifyAdmin(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!RESEND_KEY) return Response.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });
    const { to, trigger } = await req.json();
    if (!to || !trigger) return Response.json({ error: "to y trigger requeridos" }, { status: 400 });
    if (!["deposito", "arribo", "cerrada"].includes(trigger))
      return Response.json({ error: "trigger inválido (deposito/arribo/cerrada)" }, { status: 400 });

    const tpl = await fetchTemplate(`email_${trigger}`);
    if (!tpl) return Response.json({ error: "plantilla no encontrada" }, { status: 404 });

    // Datos de EJEMPLO (cliente/op ficticios)
    const opCode = "AC-XXXX";
    const data = {
      firstName: "Juan",
      opCode,
      desc: "Auriculares Bluetooth",
      portalLink: `${BASE_URL}/portal?op=${opCode}`,
      feedbackLink: `${BASE_URL}/feedback?op=${opCode}`,
    };

    const subject = "[PREVIEW] " + interpolate(tpl.subject, data);
    const greeting = interpolate(tpl.greeting, data);
    const bodyRendered = mdToHtml(interpolate(tpl.body, data));

    // Para 'cerrada': 5 estrellas; para los otros: botón CTA.
    const NAVY = "#152D54", AC = "#3B7DD8";
    const extraHtml = trigger === "cerrada"
      ? `<div style="text-align:center;margin:24px 0;padding:20px;background:#f5f7fa;border-radius:12px"><p style="font-size:13px;color:#666;margin:0 0 12px;font-weight:600">Tocá las estrellas según tu experiencia:</p><div>${[1,2,3,4,5].map(n=>`<a href="${BASE_URL}/feedback?op=${opCode}&r=${n}" style="text-decoration:none;font-size:40px;color:#fbbf24;margin:0 4px;display:inline-block">★</a>`).join("")}</div><p style="font-size:11px;color:#999;margin:12px 0 0">1 = muy mala · 5 = excelente</p></div>`
      : (tpl.cta_text ? `<div style="text-align:center;margin:24px 0"><a href="${data.portalLink}" style="display:inline-block;padding:14px 32px;background:${AC};color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:15px">${tpl.cta_text}</a></div>` : "");

    const html = renderShell({ subject, greeting, body: bodyRendered, extraHtml, opCode, isPreview: true });

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
    });
    const resp = await r.json();
    if (!r.ok) return Response.json({ error: "resend_failed", detail: resp }, { status: 500 });
    return Response.json({ ok: true, resend_id: resp.id, trigger });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
