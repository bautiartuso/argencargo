// POST /api/push/subscribe — guardar la suscripción de Web Push del usuario
// Headers: Authorization Bearer <user_token>
// Body: { subscription: PushSubscriptionJSON, portal: 'agente'|'cliente'|'admin' }

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

export async function POST(req) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ ok: false, error: "no token" }, { status: 401 });

    const userR = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
    });
    if (!userR.ok) return Response.json({ ok: false, error: "invalid token" }, { status: 401 });
    const user = await userR.json();
    const userId = user?.id;
    if (!userId) return Response.json({ ok: false, error: "no user" }, { status: 401 });

    const { subscription, portal } = await req.json();
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return Response.json({ ok: false, error: "bad subscription" }, { status: 400 });
    }

    // Upsert (por endpoint único)
    const r = await fetch(`${SB_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
      method: "POST",
      headers: {
        apikey: SB_SERVICE,
        Authorization: `Bearer ${SB_SERVICE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        portal: portal || "agente",
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return Response.json({ ok: false, error: txt }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
