// POST /api/wechat-notify
// Body: { agent_id, title, body, link }
// Envía notificación al WeChat Work del agente vía webhook de bot grupal.
// Si el agente no tiene wechat_webhook_url configurado, devuelve {skipped:true}.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 15;

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

export async function POST(req) {
  try {
    const { agent_id, title, body, link } = await req.json();
    if (!agent_id || !title) {
      return Response.json({ ok: false, error: "missing fields" }, { status: 400 });
    }

    const rows = await sb(`/rest/v1/agent_signups?auth_user_id=eq.${agent_id}&select=wechat_webhook_url,first_name`);
    const agent = Array.isArray(rows) ? rows[0] : null;
    const url = agent?.wechat_webhook_url;
    if (!url) {
      return Response.json({ ok: true, skipped: "no_webhook" });
    }

    const fullLink = link ? `https://www.argencargo.com.ar/agente${link}` : "https://www.argencargo.com.ar/agente";
    const text = `📦 ${title}${body ? "\n\n" + body : ""}\n\n${fullLink}`;

    const wxResp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "text",
        text: { content: text },
      }),
    });
    const wxBody = await wxResp.json().catch(() => ({}));
    if (wxBody.errcode && wxBody.errcode !== 0) {
      return Response.json({ ok: false, error: wxBody.errmsg || "wechat error", wxBody }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
