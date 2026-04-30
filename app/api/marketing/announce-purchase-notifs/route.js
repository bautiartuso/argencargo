// /api/marketing/announce-purchase-notifs
//
// GET  ?preview=1                  → devuelve HTML del email (para abrir en browser)
// GET  ?stats=1                    → devuelve { pending, sent, opted_out }
// POST { mode: "test", email }     → manda 1 mail a esa dirección (no toca DB)
// POST { mode: "send", limit?: 100 } → manda batch a clientes pendientes (free tier Resend = 100/día)
//
// Auth: solo admin (JWT con role=admin) o CRON_SECRET.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "Argencargo <info@argencargo.com.ar>";
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

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

async function isAdmin(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && token === cronSecret) return true;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    if (!payload?.sub) return false;
    const p = await sb(`/rest/v1/profiles?select=role&id=eq.${payload.sub}`);
    return Array.isArray(p) && p[0]?.role === "admin";
  } catch { return false; }
}

function renderEmail({ firstName, portalLink, optOutLink }) {
  const NAVY = "#152D54";
  const AC = "#3B7DD8";
  const GOLD = "#B8956A";
  const GOLD_LIGHT = "#D4B17A";
  const LOGO_WHITE = `${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
  const greeting = firstName ? `Hola ${firstName},` : "Hola,";
  const subject = "Nueva función: avisanos tus compras antes de que lleguen 📦";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">

        <!-- HEADER -->
        <tr><td align="center" style="background:linear-gradient(135deg,${NAVY},${AC});padding:36px 32px">
          <img src="${LOGO_WHITE}" alt="Argencargo" width="180" style="display:block;max-width:180px;height:auto;margin:0 auto 14px"/>
          <div style="font-size:11px;font-weight:700;color:${GOLD_LIGHT};letter-spacing:0.18em;text-transform:uppercase;margin-top:8px">✨ Nueva función</div>
        </td></tr>

        <!-- BODY -->
        <tr><td style="padding:32px 36px 8px">
          <h1 style="color:${NAVY};font-size:24px;line-height:1.3;margin:0 0 6px;font-weight:700;letter-spacing:-0.01em">Avisanos tus compras antes de que lleguen al depósito</h1>
          <p style="font-size:14px;color:#6b7280;margin:0 0 20px">${greeting}</p>

          <p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 16px">
            Sumamos una nueva sección al portal: <strong style="color:${NAVY}">Compras en camino</strong>. Ahora podés avisarnos cada compra que estés esperando antes de que llegue a nuestro depósito en China o USA.
          </p>

          <p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 22px">
            Es simple y trae <strong>tres beneficios concretos</strong> para vos:
          </p>

          <!-- BENEFITS -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">
            <tr><td style="padding:14px 16px;background:#f8fafc;border-left:3px solid ${AC};border-radius:6px">
              <div style="font-size:14px;font-weight:700;color:${NAVY};margin-bottom:4px">🚀 Tu carga se procesa más rápido</div>
              <div style="font-size:13px;line-height:1.55;color:#4b5563">Cuando llega al depósito, la asociamos al instante con tu aviso y empezamos a prepararla en el día — sin esperar a que la identifiquemos manualmente.</div>
            </td></tr>
            <tr><td style="height:10px"></td></tr>
            <tr><td style="padding:14px 16px;background:#f8fafc;border-left:3px solid ${AC};border-radius:6px">
              <div style="font-size:14px;font-weight:700;color:${NAVY};margin-bottom:4px">📍 Visibilidad desde el primer día</div>
              <div style="font-size:13px;line-height:1.55;color:#4b5563">Ves todas tus compras pendientes en un solo lugar, con su estado (pendiente, recibida o cancelada). No hay sorpresas.</div>
            </td></tr>
            <tr><td style="height:10px"></td></tr>
            <tr><td style="padding:14px 16px;background:#f8fafc;border-left:3px solid ${AC};border-radius:6px">
              <div style="font-size:14px;font-weight:700;color:${NAVY};margin-bottom:4px">🤝 Mejor coordinación</div>
              <div style="font-size:13px;line-height:1.55;color:#4b5563">Sabemos qué carga tuya esperar, en qué modalidad (aéreo o marítimo) y aproximadamente cuándo. Eso nos permite planificar mejor cada vuelo y consolidación.</div>
            </td></tr>
          </table>

          <!-- HOW TO -->
          <h2 style="color:${NAVY};font-size:17px;margin:24px 0 12px;font-weight:700">Cómo usarlo</h2>
          <ol style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 24px;padding-left:22px">
            <li>Entrá a tu portal y andá a <strong>Compras en camino</strong></li>
            <li>Tocá <strong>+ Nuevo aviso</strong></li>
            <li>Cargá el tracking, el origen (China/USA), la modalidad y una breve descripción</li>
            <li>Listo — al confirmarlo en depósito, lo ves automáticamente como operación oficial</li>
          </ol>

          <!-- CTA -->
          <div style="text-align:center;margin:28px 0 8px">
            <a href="${portalLink}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,${GOLD},${GOLD_LIGHT});color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:15px;letter-spacing:0.02em;box-shadow:0 4px 12px rgba(184,149,106,0.3)">Probar Compras en camino →</a>
          </div>

          <p style="font-size:12px;color:#9ca3af;text-align:center;margin:14px 0 0;font-style:italic">El tracking es obligatorio (sin él no podemos hacer el match). El resto de los datos podés editarlos hasta que confirmemos la recepción.</p>

          <p style="font-size:14px;line-height:1.65;color:#374151;margin:28px 0 0">
            Cualquier consulta, escribinos por WhatsApp al <a href="https://wa.me/5491125088580" style="color:${AC};text-decoration:none;font-weight:600">+54 9 11 2508-8580</a>.
          </p>
          <p style="font-size:14px;line-height:1.65;color:#374151;margin:8px 0 0">
            Saludos,<br/>
            <strong>El equipo de Argencargo</strong>
          </p>
        </td></tr>

        <!-- FOOTER -->
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

      <p style="font-size:10px;color:#aaa;margin:12px 0 0;text-align:center;line-height:1.5">
        © ${new Date().getFullYear()} Argencargo · <a href="https://argencargo.com.ar" style="color:#888;text-decoration:none">argencargo.com.ar</a><br/>
        ${optOutLink ? `Si no querés recibir más comunicaciones de novedades, <a href="${optOutLink}" style="color:#888">cancelá la suscripción</a>.` : ""}
      </p>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}

export async function GET(req) {
  const url = new URL(req.url);
  if (url.searchParams.get("preview") === "1") {
    const { html } = renderEmail({
      firstName: url.searchParams.get("name") || "Bautista",
      portalLink: `${BASE_URL}/portal`,
      optOutLink: `${BASE_URL}/api/marketing/optout?token=preview`,
    });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (url.searchParams.get("stats") === "1") {
    if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });
    const all = await sb(`/rest/v1/clients?select=id,email,marketing_purchase_notifs_sent_at,marketing_opt_out`);
    if (!Array.isArray(all)) return Response.json({ error: "fetch failed" }, { status: 500 });
    const withEmail = all.filter(c => c.email);
    const sent = withEmail.filter(c => c.marketing_purchase_notifs_sent_at).length;
    const opted = withEmail.filter(c => c.marketing_opt_out).length;
    const pending = withEmail.filter(c => !c.marketing_purchase_notifs_sent_at && !c.marketing_opt_out).length;
    return Response.json({ ok: true, total_with_email: withEmail.length, pending, sent, opted_out: opted });
  }
  return Response.json({ error: "use ?preview=1 or ?stats=1" }, { status: 400 });
}

export async function POST(req) {
  if (!RESEND_KEY) return Response.json({ error: "RESEND_API_KEY no configurado" }, { status: 500 });
  if (!(await isAdmin(req))) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const mode = body.mode || "test";

  // MODO TEST: 1 mail a una dirección, no toca DB
  if (mode === "test") {
    const email = body.email;
    if (!email) return Response.json({ error: "email requerido" }, { status: 400 });
    const { subject, html } = renderEmail({
      firstName: body.firstName || "Bautista",
      portalLink: `${BASE_URL}/portal`,
      optOutLink: `${BASE_URL}/api/marketing/optout?token=test`,
    });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [email], subject, html }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) return Response.json({ error: "send failed", detail: j }, { status: 500 });
    return Response.json({ ok: true, mode: "test", to: email, resend_id: j?.id });
  }

  // MODO SEND: batch a clientes pendientes
  if (mode === "send") {
    const limit = Math.min(Math.max(1, Number(body.limit) || 100), 100);
    const list = await sb(`/rest/v1/clients?select=id,first_name,email&email=not.is.null&marketing_purchase_notifs_sent_at=is.null&marketing_opt_out=eq.false&order=created_at.asc&limit=${limit}`);
    if (!Array.isArray(list)) return Response.json({ error: "fetch failed" }, { status: 500 });
    if (list.length === 0) return Response.json({ ok: true, mode: "send", sent: 0, msg: "no hay pendientes" });

    const results = { sent: 0, failed: 0, errors: [] };
    for (const c of list) {
      const { subject, html } = renderEmail({
        firstName: c.first_name || "",
        portalLink: `${BASE_URL}/portal`,
        optOutLink: `${BASE_URL}/api/marketing/optout?cid=${c.id}`,
      });
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: RESEND_FROM, to: [c.email], subject, html }),
        });
        if (!r.ok) {
          const err = await r.text().catch(() => "");
          results.failed++;
          results.errors.push({ client_id: c.id, email: c.email, error: err.slice(0, 200) });
          // si Resend dice "rate limit" cortar acá
          if (err.toLowerCase().includes("rate") || r.status === 429) break;
          continue;
        }
        await sb(`/rest/v1/clients?id=eq.${c.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ marketing_purchase_notifs_sent_at: new Date().toISOString() }),
        });
        results.sent++;
        // pequeño delay para no saturar
        await new Promise(r => setTimeout(r, 600));
      } catch (e) {
        results.failed++;
        results.errors.push({ client_id: c.id, email: c.email, error: e.message });
      }
    }
    return Response.json({ ok: true, mode: "send", batch_size: list.length, ...results });
  }

  return Response.json({ error: "mode debe ser 'test' o 'send'" }, { status: 400 });
}
