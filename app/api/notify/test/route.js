// POST /api/notify/test
// Body: { to }
// Envía un email de prueba al destinatario indicado (solo admin).
// Útil para verificar que Resend está configurado correctamente.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "Argencargo <info@argencargo.com.ar>";
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

export async function POST(req) {
  try {
    if (!await verifyAdmin(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!RESEND_KEY) return Response.json({ error: "RESEND_API_KEY no configurada" }, { status: 500 });
    const { to } = await req.json();
    if (!to) return Response.json({ error: "to requerido" }, { status: 400 });

    const NAVY = "#152D54"; const AC = "#3B7DD8";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Argencargo — Test</title></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
        <!-- HEADER: banner azul con logo blanco directo -->
        <tr><td align="center" style="background:linear-gradient(135deg,${NAVY},${AC});padding:40px 32px">
          <img src="${LOGO_WHITE}" alt="Argencargo" width="200" style="display:block;max-width:200px;height:auto;margin:0 auto"/>
        </td></tr>
        <!-- BODY -->
        <tr><td style="padding:28px 32px">
          <h2 style="color:${NAVY};font-size:20px;margin:0 0 16px;font-weight:700">✅ ¡Todo funciona!</h2>
          <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 12px">Este es un email de prueba enviado desde <strong>info@argencargo.com.ar</strong> via Resend.</p>
          <p style="font-size:15px;line-height:1.6;color:#444;margin:0 0 12px">Si estás viendo este mensaje, significa que:</p>
          <ul style="font-size:14px;line-height:1.8;color:#444;margin:0 0 12px;padding-left:20px">
            <li>La API de Resend está conectada correctamente</li>
            <li>El dominio <strong>argencargo.com.ar</strong> está verificado (SPF/DKIM/DMARC)</li>
            <li>Los emails automáticos al cambiar estado de una op van a funcionar</li>
          </ul>
          <p style="font-size:12px;color:#999;margin:20px 0 0">Enviado: ${new Date().toLocaleString("es-AR")}</p>
        </td></tr>
        <!-- FOOTER: fondo navy + logo BLANCO (evita cuadrado blanco del JPG) -->
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

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject: "✅ Argencargo — Test de notificaciones",
        html,
      }),
    });
    const resp = await r.json();
    if (!r.ok) return Response.json({ error: "resend_failed", detail: resp }, { status: 500 });
    return Response.json({ ok: true, resend_id: resp.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
