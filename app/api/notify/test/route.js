// POST /api/notify/test
// Body: { to }
// Envía un email de prueba al destinatario indicado (solo admin).
// Útil para verificar que Resend está configurado correctamente.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "Argencargo <info@argencargo.com.ar>";

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
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7fa;font-family:'Segoe UI',system-ui,sans-serif">
      <div style="max-width:600px;margin:0 auto;background:#fff">
        <div style="background:linear-gradient(135deg,${NAVY},${AC});padding:32px 24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">Argencargo</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px">Test de notificaciones</p>
        </div>
        <div style="padding:32px 28px;color:#1a1a1a">
          <h2 style="color:${NAVY};font-size:20px;margin:0 0 12px">✅ ¡Todo funciona!</h2>
          <p style="font-size:15px;line-height:1.6;color:#444">Este es un email de prueba enviado desde <strong>info@argencargo.com.ar</strong> via Resend.</p>
          <p style="font-size:15px;line-height:1.6;color:#444">Si estás viendo este mensaje, significa que:</p>
          <ul style="font-size:14px;line-height:1.8;color:#444">
            <li>✓ La API de Resend está conectada correctamente</li>
            <li>✓ El dominio <strong>argencargo.com.ar</strong> está verificado (SPF/DKIM/DMARC)</li>
            <li>✓ Los emails automáticos al cambiar estado de una op van a funcionar</li>
          </ul>
          <p style="font-size:13px;color:#888;margin:24px 0 0;padding-top:16px;border-top:1px solid #eee">Enviado: ${new Date().toLocaleString("es-AR")}</p>
        </div>
      </div>
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
