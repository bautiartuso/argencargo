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
  const token = auth.slice(7);
  // Bypass para calls server-to-server (ej: desde /api/tracking/sync)
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && token === cronSecret) return true;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    const p = await sb(`/rest/v1/profiles?select=role&id=eq.${payload.sub}`);
    // El empleado tambien dispara estos mails: al marcar un contenedor arribado salen los
    // avisos de retiro, y desde Entregas se reenvian.
    return Array.isArray(p) && ["admin", "empleado"].includes(p[0]?.role);
  } catch { return false; }
}

// Reemplaza {{vars}} en un texto con los valores de data.
function interpolate(text, data) {
  if (!text) return "";
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] != null ? String(data[k]) : "");
}

// Convierte markdown simple (**bold**, \n párrafos) a HTML inline.
// Normaliza literal '\n' (backslash-n como texto) a saltos reales primero.
function mdToHtml(text) {
  if (!text) return "";
  const normalized = String(text).replace(/\\n/g, "\n").replace(/\\r/g, "");
  return normalized
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

// Elige la variante del mail de cierre segun el historial de resenas del cliente:
//   · ya dejo resena alguna vez -> variante corta, sin volver a pedirsela
//   · 4+ ops cerradas y ninguna resena -> variante mas insistente
//   · resto -> el mail de cierre de siempre
// Si algo falla, cae al template original: nunca deja de mandarse el mail por esto.
async function templateKeyCierre(op, client) {
  const base = "email_cerrada";
  try {
    if (!client?.id) return base;
    const cerradasR = await fetch(
      `${SB_URL}/rest/v1/operations?client_id=eq.${client.id}&status=in.(operacion_cerrada,entregada)&select=id`,
      { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
    );
    const cerradas = await cerradasR.json();
    const ids = (Array.isArray(cerradas) ? cerradas : []).map((o) => o.id).filter(Boolean);
    if (ids.length === 0) return base;
    const fbR = await fetch(
      `${SB_URL}/rest/v1/op_feedback?operation_id=in.(${ids.join(",")})&google_review_confirmed=is.true&select=id&limit=1`,
      { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } }
    );
    const fb = await fbR.json();
    // Solo cuenta la resena en Google CONFIRMADA a mano. Que nos hayan puntuado en el formulario
    // interno no ayuda a la reputacion publica, asi que a esos les sigue tocando el mail que la
    // pide. Y clicked_google_review no sirve para esto: solo dice que abrieron el link, no que
    // hayan escrito nada — asi es como GUISCI recibio el mail de "ya dejaste tu reseña" sin
    // haberla dejado.
    const yaReseno = Array.isArray(fb) && fb.length > 0;
    if (yaReseno) return "email_cerrada_ya_reseno";
    // La op que se esta cerrando ahora cuenta, asi que el umbral se mide sobre lo ya cerrado.
    if (ids.length >= 4) return "email_cerrada_insistente";
    return base;
  } catch (e) {
    console.error("[notify] templateKeyCierre", e.message);
    return base;
  }
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

  // El cierre tiene tres variantes segun si el cliente ya dejo resena; el resto usa su unico template.
  const tplKey = trigger === "cerrada" ? await templateKeyCierre(op, client) : `email_${trigger}`;
  const tpl = (await fetchTemplate(tplKey)) || (trigger === "cerrada" ? await fetchTemplate("email_cerrada") : null);
  if (!tpl) return null;

  const subject = interpolate(tpl.subject, data);
  const greeting = interpolate(tpl.greeting, data);
  const body = interpolate(tpl.body, data);
  const ctaText = tpl.cta_text;

  const pideResena = trigger === "cerrada" && tplKey !== "email_cerrada_ya_reseno";
  const ctaLink = pideResena ? null : portalLink;

  const button = (href, text, color = AC) =>
    `<div style="text-align:center;margin:24px 0"><a href="${href}" style="display:inline-block;padding:14px 32px;background:${color};color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:15px">${text}</a></div>`;

  // Para cerrada: renderizamos 5 estrellas clickables en vez de botón CTA.
  const extraHtml = pideResena
    ? `<div style="text-align:center;margin:24px 0;padding:20px;background:#f5f7fa;border-radius:12px">
        <p style="font-size:13px;color:#666;margin:0 0 12px;font-weight:600">Tocá las estrellas según tu experiencia:</p>
        <div>${[1,2,3,4,5].map(n => `<a href="${BASE_URL}/feedback?op=${opCode}&r=${n}" style="text-decoration:none;font-size:40px;color:#fbbf24;margin:0 4px;display:inline-block">★</a>`).join("")}</div>
        <p style="font-size:11px;color:#999;margin:12px 0 0">1 = muy mala · 5 = excelente</p>
      </div>`
    : (ctaText && ctaLink ? button(ctaLink, ctaText) : "");

  const html = renderEmailShell({ subject, greeting, body, extraHtml, opCode, NAVY, AC });
  return { subject, html };
}

// Shell HTML compartido entre /api/notify y /api/notify/test.
// Header: logo centrado sobre fondo blanco. Footer: logo + datos de contacto.
function renderEmailShell({ subject, greeting, body, extraHtml, opCode, NAVY = "#152D54", AC = "#3B7DD8" }) {
  const LOGO_WHITE = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
  const LOGO_COLOR = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png";
  const greetingHtml = greeting ? `<h2 style="color:${NAVY};font-size:20px;margin:0 0 16px;font-weight:700">${greeting}</h2>` : "";
  const opCodeHtml = opCode ? `<tr><td style="padding:24px 32px 0"><p style="color:#666;font-size:13px;margin:0;padding-top:16px;border-top:1px solid #eee">Código de operación: <strong style="color:${NAVY};font-family:monospace">${opCode}</strong><br/>Cualquier consulta, respondé este email o escribinos por WhatsApp.</p></td></tr>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject || "Argencargo"}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">

        <!-- HEADER: banner azul con logo BLANCO directo -->
        <tr><td align="center" style="background:linear-gradient(135deg,${NAVY},${AC});padding:40px 32px">
          <img src="${LOGO_WHITE}" alt="Argencargo" width="200" style="display:block;max-width:200px;height:auto;margin:0 auto"/>
        </td></tr>

        <!-- BODY: saludo + cuerpo + cta -->
        <tr><td style="padding:28px 32px">
          ${greetingHtml}
          ${body || ""}
          ${extraHtml || ""}
        </td></tr>

        <!-- Código op + nota de respuesta -->
        ${opCodeHtml}

        <!-- FOOTER: fondo navy + logo BLANCO (evita problema de cuadrado blanco del JPG) -->
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
                <div>Virrey Loreto 2428 — Belgrano, CABA</div>
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
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!RESEND_KEY) return Response.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });

    const { op_id, trigger, force } = await req.json();
    if (!op_id || !trigger) return Response.json({ error: "op_id y trigger requeridos" }, { status: 400 });
    if (!["deposito", "arribo", "retiro", "cerrada"].includes(trigger))
      return Response.json({ error: "trigger inválido" }, { status: 400 });

    // Fetch op + client
    const opArr = await sb(`/rest/v1/operations?id=eq.${op_id}&select=*,clients(id,first_name,last_name,email,whatsapp,skip_review_request)`);
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
    if (trigger === "cerrada" && (op.skip_review_request || client.skip_review_request)) {
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

    // Aviso de retiro también por WhatsApp (bot de entregas): plantilla fija, sin IA.
    // Best-effort y no-op sin credenciales de Meta — el mail ya salió igual.
    const newSent = { ...(op.sent_notifications || {}), [sentKey]: new Date().toISOString() };
    if (trigger === "retiro" && client.whatsapp && op.delivery_public_token) {
      try {
        const { sendWaTemplate, waConfigured } = await import("../../../lib/wa");
        if (waConfigured() && (force || !op.sent_notifications?.wa_retiro)) {
          const link = `${BASE_URL}/retiro/${op.delivery_public_token}`;
          const r2 = await sendWaTemplate(client.whatsapp, "carga_lista", [client.first_name || "Hola", op.operation_code, link]);
          if (r2?.ok) newSent.wa_retiro = new Date().toISOString();
        }
      } catch (e) { console.error("[notify] wa_retiro failed", e.message); }
    }
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
