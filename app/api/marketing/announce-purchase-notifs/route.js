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
  const greeting = firstName ? `Hola ${firstName},` : "Hola,";
  // Subject estilo personal — sin emojis, sin "promo words"
  const subject = "Algo nuevo en el portal";
  // HTML mínimo, estilo email personal, sin botones, sin gradientes, sin imágenes
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:24px 16px;background:#ffffff;font-family:Arial,sans-serif;color:#222;font-size:15px;line-height:1.6">
  <div style="max-width:580px;margin:0 auto">
    <p style="margin:0 0 14px">${greeting}</p>

    <p style="margin:0 0 14px">Te escribo para contarte sobre una función nueva que sumamos al portal: ahora podés avisarnos las compras que estás esperando, antes de que lleguen al depósito.</p>

    <p style="margin:0 0 14px">¿Para qué sirve? Cuando nos avisás con el tracking, apenas la carga llega la asociamos al instante con tu aviso y empezamos a procesarla en el día, sin tener que identificarla manualmente. Vas a tener visibilidad desde el primer día y nosotros podemos planificar mejor cada vuelo.</p>

    <p style="margin:0 0 14px">Para usarla, entrá al portal y andá a <strong>"Compras en camino"</strong> &rarr; <strong>Nuevo aviso</strong>. Cargás el tracking, el origen (China o USA), la modalidad (aéreo o marítimo) y una breve descripción. Listo.</p>

    <p style="margin:0 0 14px"><a href="${portalLink}" style="color:#1B4F8A;text-decoration:underline">${portalLink.replace(/^https?:\/\//,"")}</a></p>

    <p style="margin:0 0 14px">Cualquier duda escribime por acá o por WhatsApp al +54 9 11 2508-8580.</p>

    <p style="margin:0 0 6px">Saludos,</p>
    <p style="margin:0 0 4px">Bautista Artuso</p>
    <p style="margin:0;color:#666;font-size:14px">Argencargo</p>

    ${optOutLink ? `<p style="margin:36px 0 0;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px">Si no querés recibir más estos mensajes, <a href="${optOutLink}" style="color:#999">cancelá acá</a>.</p>` : ""}
  </div>
</body></html>`;
  // Versión texto plano (mejora delivery a Primary inbox)
  const text = `${greeting}

Te escribo para contarte sobre una función nueva que sumamos al portal: ahora podés avisarnos las compras que estás esperando, antes de que lleguen al depósito.

¿Para qué sirve? Cuando nos avisás con el tracking, apenas la carga llega la asociamos al instante con tu aviso y empezamos a procesarla en el día, sin tener que identificarla manualmente. Vas a tener visibilidad desde el primer día y nosotros podemos planificar mejor cada vuelo.

Para usarla, entrá al portal y andá a "Compras en camino" -> Nuevo aviso. Cargás el tracking, el origen (China o USA), la modalidad (aéreo o marítimo) y una breve descripción. Listo.

${portalLink}

Cualquier duda escribime por acá o por WhatsApp al +54 9 11 2508-8580.

Saludos,
Bautista Artuso
Argencargo${optOutLink ? `

---
Si no querés recibir más estos mensajes: ${optOutLink}` : ""}`;
  return { subject, html, text };
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
    const { subject, html, text } = renderEmail({
      firstName: body.firstName || "Bautista",
      portalLink: `${BASE_URL}/portal`,
      optOutLink: `${BASE_URL}/api/marketing/optout?token=test`,
    });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [email], subject, html, text, reply_to: "info@argencargo.com.ar" }),
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
      const { subject, html, text } = renderEmail({
        firstName: c.first_name || "",
        portalLink: `${BASE_URL}/portal`,
        optOutLink: `${BASE_URL}/api/marketing/optout?cid=${c.id}`,
      });
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: RESEND_FROM, to: [c.email], subject, html, text, reply_to: "info@argencargo.com.ar" }),
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
