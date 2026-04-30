// GET /api/marketing/optout?cid=<client_id>
// Marca al cliente como marketing_opt_out=true. Devuelve HTML simple.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export async function GET(req) {
  const url = new URL(req.url);
  const cid = url.searchParams.get("cid");
  let msg = "";
  if (!cid || cid === "preview" || cid === "test") {
    msg = "Esto es solo un preview del enlace.";
  } else if (!SB_SERVICE) {
    msg = "Error: configuración faltante.";
  } else {
    const r = await fetch(`${SB_URL}/rest/v1/clients?id=eq.${cid}`, {
      method: "PATCH",
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ marketing_opt_out: true }),
    });
    msg = r.ok ? "Listo. No vas a recibir más comunicaciones de novedades. Las notificaciones operativas de tus envíos siguen activas." : "Hubo un error. Escribinos a info@argencargo.com.ar.";
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Suscripción cancelada — Argencargo</title></head>
<body style="margin:0;padding:40px 20px;background:#eef1f5;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:36px;box-shadow:0 2px 8px rgba(0,0,0,0.05);text-align:center">
    <h1 style="color:#152D54;font-size:22px;margin:0 0 14px">Suscripción gestionada</h1>
    <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 20px">${msg}</p>
    <a href="https://www.argencargo.com.ar" style="display:inline-block;padding:10px 24px;background:#3B7DD8;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px">Ir al sitio</a>
  </div>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
