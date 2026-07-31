// POST /api/notify/preview
// Body: { to, key }   (o { to, trigger } — forma vieja, se mantiene)
// Renderiza la plantilla de email correspondiente con datos de EJEMPLO
// y la envía al destinatario indicado. Solo admin. No toca ninguna op real.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "Argencargo <info@argencargo.com.ar>";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://argencargo.com.ar";
const LOGO_WHITE = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const LOGO_COLOR = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png";

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
        <tr><td align="center" style="background:linear-gradient(135deg,${NAVY},${AC});padding:40px 32px">
          <img src="${LOGO_WHITE}" alt="Argencargo" width="200" style="display:block;max-width:200px;height:auto;margin:0 auto"/>
        </td></tr>
        <tr><td style="padding:28px 32px">
          ${greetingHtml}
          ${body || ""}
          ${extraHtml || ""}
        </td></tr>
        ${opCode ? `<tr><td style="padding:0 32px 24px"><p style="color:#666;font-size:13px;margin:0;padding-top:16px;border-top:1px solid #eee">Código de operación: <strong style="color:${NAVY};font-family:monospace">${opCode}</strong><br/>Cualquier consulta, respondé este email o escribinos por WhatsApp.</p></td></tr>` : ""}
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

export async function POST(req) {
  try {
    if (!await verifyAdmin(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!RESEND_KEY) return Response.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });
    const body = await req.json();
    const to = body.to;
    // Antes esto aceptaba solo tres triggers fijos, asi que el boton Preview fallaba en 6 de las
    // 9 plantillas de email. Ahora sirve cualquier plantilla que exista, buscada por su key.
    const key = body.key || (body.trigger ? `email_${body.trigger}` : null);
    if (!to || !key) return Response.json({ error: "faltan el email y la plantilla" }, { status: 400 });

    const tpl = await fetchTemplate(key);
    if (!tpl) return Response.json({ error: `no existe la plantilla "${key}"` }, { status: 404 });
    if (tpl.channel && tpl.channel !== "email")
      return Response.json({ error: "el preview por mail es solo para plantillas de email" }, { status: 400 });

    // Datos de EJEMPLO (cliente/op ficticios)
    const opCode = "AC-XXXX";
    // Todas las variables que usan las plantillas hoy. Si falta alguna, interpolate la deja
    // vacia y el preview sale con un hueco, que es peor que verla con un valor de ejemplo.
    const data = {
      firstName: "Juan",
      clientCode: "JUAPER",
      opCode,
      desc: "Auriculares Bluetooth",
      portalLink: `${BASE_URL}/portal?op=${opCode}`,
      feedbackLink: `${BASE_URL}/feedback?op=${opCode}`,
      retiroLink: `${BASE_URL}/retiro/ejemplo`,
      importTotal: "USD 1.250,00",
      envioCost: "USD 13,00",
      totalAbonar: "USD 1.263,00",
      ajustesTxt: "Descuento por demora: -USD 20,00",
    };

    const subject = "[PREVIEW] " + interpolate(tpl.subject, data);
    const greeting = interpolate(tpl.greeting, data);
    const bodyRendered = mdToHtml(interpolate(tpl.body, data));

    // Las de cierre que piden reseña llevan las estrellas; el resto, el botón CTA si lo tiene.
    // (email_cerrada_ya_reseno no pide reseña y sí tiene CTA, por eso manda el cta_text.)
    const NAVY = "#152D54", AC = "#3B7DD8";
    const pideResena = !tpl.cta_text && key.startsWith("email_cerrada");
    const extraHtml = pideResena
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
    return Response.json({ ok: true, resend_id: resp.id, key });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
