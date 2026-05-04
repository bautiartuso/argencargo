// GET /api/track/[code]
// Devuelve info pública de seguimiento de una op (sin auth).
// Solo expone: code, descripción, estado, ETA, tracking events del carrier, fechas clave.
// NO expone: cliente, monto, items declarados, costos, datos personales.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

async function sb(path) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  return r.ok ? r.json() : null;
}

export async function GET(req, { params }) {
  const code = (params.code || "").toUpperCase().trim();
  if (!code || !/^AC-?\d+$/i.test(code)) {
    return Response.json({ error: "código inválido" }, { status: 400 });
  }
  const codeNorm = code.replace("AC", "AC-").replace("AC--", "AC-");

  const ops = await sb(`/rest/v1/operations?select=id,operation_code,description,status,channel,origin,eta,arrived_in_argentina_at,delivered_at,created_at,international_tracking,international_carrier&operation_code=eq.${codeNorm}&limit=1`);
  if (!Array.isArray(ops) || ops.length === 0) {
    return Response.json({ error: "operación no encontrada", code: codeNorm }, { status: 404 });
  }
  const op = ops[0];

  // Eventos del carrier (sin auto-internos ni pre-clearance Argentina)
  const events = await sb(`/rest/v1/tracking_events?operation_id=eq.${op.id}&select=title,description,location,occurred_at,source,status_code&order=occurred_at.desc&limit=50`);
  const filtered = (Array.isArray(events) ? events : []).filter(e => {
    if (e.source === "internal" && String(e.title || "").startsWith("Estado actualizado")) return false;
    if (e.source === "dhl" && String(e.description || "").toLowerCase().includes("customs clearance status updated")) return false;
    if (e.source === "dhl" && String(e.title || "").trim() === "SD") return false;
    return true;
  });

  return Response.json({
    ok: true,
    operation_code: op.operation_code,
    description: op.description || null,
    status: op.status,
    channel: op.channel,
    origin: op.origin,
    eta: op.eta,
    created_at: op.created_at,
    arrived_in_argentina_at: op.arrived_in_argentina_at,
    delivered_at: op.delivered_at,
    international_carrier: op.international_carrier || null,
    international_tracking: op.international_tracking || null,
    events: filtered.map(e => ({
      title: e.title,
      description: e.description,
      location: e.location,
      occurred_at: e.occurred_at,
      source: e.source,
    })),
  });
}
