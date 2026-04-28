// GET /api/cron/agent-summary
// Cron diario a las 9am UTC = 17h hora China (UTC+8).
// Para cada agente aprobado: calcula resumen del día y manda push.
// "Tenés X paquetes sin foto · Y ops listas para vuelo · saldo USD Z"

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 60;

async function sb(path) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  return r.json();
}

async function sendPush(userId, title, body, url) {
  try {
    const baseUrl = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
    await fetch(`${baseUrl}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, title, body, url }),
    });
  } catch (e) {
    console.error("push send error", e);
  }
}

export async function GET() {
  try {
    const agents = await sb(`/rest/v1/agent_signups?status=eq.approved&select=auth_user_id,first_name`);
    if (!Array.isArray(agents)) return Response.json({ ok: false, error: "no agents" });

    const results = [];
    for (const a of agents) {
      const agentId = a.auth_user_id;
      if (!agentId) continue;

      // Paquetes en depósito de este agente sin foto
      const pkgsNoPhoto = await sb(
        `/rest/v1/operation_packages?registered_by_agent_id=eq.${agentId}&photo_url=is.null&select=id`
      );
      const noPhotoCount = Array.isArray(pkgsNoPhoto) ? pkgsNoPhoto.length : 0;

      // Ops del agente listas para vuelo (consolidación confirmada + en preparación)
      const opsReady = await sb(
        `/rest/v1/operations?created_by_agent_id=eq.${agentId}&consolidation_confirmed=eq.true&status=in.(en_deposito_origen,en_preparacion)&select=id`
      );
      const readyCount = Array.isArray(opsReady) ? opsReady.length : 0;

      // Saldo del agente
      const movs = await sb(
        `/rest/v1/agent_account_movements?agent_id=eq.${agentId}&select=type,amount_usd`
      );
      const balance = (Array.isArray(movs) ? movs : []).reduce(
        (s, m) => s + (m.type === "anticipo" ? Number(m.amount_usd) : -Number(m.amount_usd)),
        0
      );

      // Solo enviar si hay algo accionable o si el saldo justifica el aviso
      if (noPhotoCount === 0 && readyCount === 0) {
        results.push({ agent: a.first_name, skipped: "nothing_actionable" });
        continue;
      }

      const parts = [];
      if (noPhotoCount > 0) parts.push(`${noPhotoCount} 包裹 sin foto`);
      if (readyCount > 0) parts.push(`${readyCount} op listas para vuelo`);
      parts.push(`saldo USD ${balance.toFixed(2)}`);

      const title = `📋 Resumen del día`;
      const body = parts.join(" · ");

      await sendPush(agentId, title, body, "/agente");
      results.push({ agent: a.first_name, sent: true, body });
    }

    return Response.json({ ok: true, processed: agents.length, results });
  } catch (e) {
    console.error("agent-summary cron error", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
