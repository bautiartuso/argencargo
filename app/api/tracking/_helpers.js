// Helpers compartidos para integración de tracking de couriers.
// Las credenciales se leen desde env vars (Vercel → Project Settings → Environment Variables).

export const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
// Service role: para poder insertar en tracking_events sin pasar por RLS cliente.
// Configurar SUPABASE_SERVICE_ROLE en Vercel.
export const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE || "";

// Dedupe por (operation_id, source, external_id) usando upsert.
export async function upsertEvent(ev) {
  if (!SB_SERVICE) return { error: "missing SUPABASE_SERVICE_ROLE" };
  const r = await fetch(`${SB_URL}/rest/v1/tracking_events?on_conflict=operation_id,source,external_id`, {
    method: "POST",
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(ev)
  });
  if (!r.ok) return { error: `${r.status} ${await r.text()}` };
  return { ok: true };
}

// Marca de sync por operación.
export async function updateSyncStatus(operation_id, carrier, eventsCount, err) {
  if (!SB_SERVICE) return;
  await fetch(`${SB_URL}/rest/v1/tracking_sync_status?on_conflict=operation_id`, {
    method: "POST",
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      operation_id,
      last_synced_at: new Date().toISOString(),
      last_sync_carrier: carrier,
      last_sync_error: err || null,
      events_count: eventsCount
    })
  });
}

// Normaliza eventos al shape de tracking_events.
export function normalizeEvent({ operation_id, source, external_id, title, description, location, occurred_at, status_code, carrier }) {
  return {
    operation_id,
    source,
    external_id: external_id || null,
    title: title || "Actualización",
    description: description || null,
    location: location || null,
    occurred_at: occurred_at || new Date().toISOString(),
    is_visible_to_client: true,
    carrier: carrier || null,
    status_code: status_code || null
  };
}
