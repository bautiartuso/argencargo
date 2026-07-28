// GET  /api/presupuesto/[token] → cotización del admin para que el cliente la vea sin login
// POST /api/presupuesto/[token] → el cliente acepta una de las alternativas
//
// Es el equivalente de /api/cotizacion (cotizaciones GI) pero para las cotizaciones que arma el
// admin. La diferencia central: acá el cliente compara VARIOS servicios (aéreo, marítimo LCL/FCL,
// marítimo integral) y elige uno, en vez de recibir un PDF con una sola alternativa.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";

export const dynamic = "force-dynamic";

const sbFetch = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...init,
    cache: "no-store",
    headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const txt = await r.text();
  let parsed = null; try { parsed = JSON.parse(txt); } catch {}
  return { status: r.status, body: parsed };
};

// Deja pasar solo las alternativas que el admin eligió mostrar. Si no eligió ninguna en particular,
// se muestran todas las cotizadas.
function alternativasVisibles(quote) {
  const alts = Array.isArray(quote.channel_alternatives) ? quote.channel_alternatives : [];
  const visibles = Array.isArray(quote.visible_channels) ? quote.visible_channels : null;
  if (!visibles || visibles.length === 0) return alts;
  return alts.filter((a) => visibles.includes(a.key));
}

async function cargar(token) {
  const qRes = await sbFetch(`/quotes?public_token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
  if (qRes.status >= 400 || !Array.isArray(qRes.body) || qRes.body.length === 0) return null;
  return qRes.body[0];
}

export async function GET(_req, { params }) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  const { token } = await params;
  if (!token) return Response.json({ error: "Token requerido" }, { status: 400 });

  const quote = await cargar(token);
  if (!quote) return Response.json({ error: "Cotización no encontrada" }, { status: 404 });

  const vencida = quote.expires_at ? new Date(quote.expires_at).getTime() < Date.now() : false;

  return Response.json({
    ok: true,
    vencida,
    aceptada: !!quote.accepted_at,
    quote: {
      id: quote.id,
      client_name: quote.client_name,
      client_code: quote.client_code,
      origin: quote.origin,
      products: quote.products || [],
      packages: quote.packages || [],
      total_fob: Number(quote.total_fob || 0),
      total_weight: Number(quote.total_weight || 0),
      total_cbm: Number(quote.total_cbm || 0),
      notes: quote.notes || null,
      created_at: quote.created_at,
      expires_at: quote.expires_at,
      accepted_at: quote.accepted_at,
      selected: quote.client_selected_channel || null,
      alternativas: alternativasVisibles(quote),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req, { params }) {
  if (!SB) return Response.json({ error: "Server config missing" }, { status: 500 });
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const { channel_key } = body;
  if (!channel_key) return Response.json({ error: "Elegí una opción" }, { status: 400 });

  const quote = await cargar(token);
  if (!quote) return Response.json({ error: "Cotización no encontrada" }, { status: 404 });
  if (quote.expires_at && new Date(quote.expires_at).getTime() < Date.now()) {
    return Response.json({ error: "Esta cotización venció. Pedinos una nueva." }, { status: 410 });
  }
  // El canal elegido tiene que ser uno de los que se le mostraron: si no, se podria aceptar por API
  // una alternativa que el admin decidio no ofrecer.
  const visibles = alternativasVisibles(quote);
  const elegida = visibles.find((a) => a.key === channel_key);
  if (!elegida) return Response.json({ error: "Esa opción no está disponible en esta cotización" }, { status: 400 });

  await sbFetch(`/quotes?id=eq.${quote.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      client_selected_channel: channel_key,
      accepted_at: quote.accepted_at || new Date().toISOString(),
      status: "accepted",
    }),
  });

  // Avisar al admin: sin esto la aceptacion queda esperando a que alguien entre a mirar.
  try {
    const admins = await sbFetch(`/profiles?role=eq.admin&select=id`);
    const ids = (Array.isArray(admins.body) ? admins.body : []).map((a) => a.id).filter(Boolean);
    const quien = `${quote.client_name || ""}${quote.client_code ? ` · ${quote.client_code}` : ""}`.trim() || "Un cliente";
    const title = "✅ Cotización aceptada";
    const msg = `${quien} eligió ${elegida.name || channel_key} · USD ${Number(elegida.totalAbonar || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    for (const id of ids) {
      await sbFetch(`/notifications`, {
        method: "POST",
        body: JSON.stringify({ user_id: id, portal: "admin", title, body: msg, link: "/admin" }),
      }).catch(() => {});
      fetch(`${BASE_URL}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id, portal: "admin", title, body: msg, url: "/admin" }),
      }).catch(() => {});
    }
  } catch (e) { console.error("[POST presupuesto] aviso admin", e.message); }

  return Response.json({ ok: true, elegida });
}
