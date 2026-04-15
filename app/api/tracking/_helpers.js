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

// Mapeo status_code → título genérico en español (no menciona courier).
// Cubre códigos comunes entre DHL, FedEx y UPS.
const GENERIC_TITLES = {
  // Pre-transit / info recibida
  "pre-transit": "Información del envío recibida", "OC": "Información del envío recibida",
  "pickup": "Carga recolectada en origen", "PU": "Carga recolectada en origen",
  "IT": "En tránsito internacional", "transit": "En tránsito internacional",
  // In transit / procesamiento
  "DP": "Salida de centro de operaciones", "AR": "Arribo a centro de operaciones",
  "AF": "Arribo a centro de operaciones", "DF": "Salida de centro de operaciones",
  "CC": "En gestión aduanera", "customs-clearance": "En gestión aduanera",
  "RC": "Arribo al país de destino", "IA": "Arribo al país de destino",
  "ID": "En distribución local", "OD": "En reparto final",
  "DL": "Entregado", "delivered": "Entregado",
  // Problemas
  "EX": "Demora en tránsito", "failure": "Incidencia en el envío",
  "exception": "Incidencia en el envío", "RT": "Reintento de entrega"
};

function stripCourierRefs(text) {
  if (!text) return null;
  // Saca cualquier mención explícita de DHL, FedEx, UPS, "facility", AWB numbers, etc.
  return String(text)
    .replace(/\b(DHL|FedEx|FEDEX|Fed Ex|UPS|United Parcel Service)\b/gi, "")
    .replace(/\bfacility\b/gi, "centro")
    .replace(/\bhub\b/gi, "centro")
    .replace(/\bDHL Express\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

export function genericTitleFor(status_code, fallback) {
  if (status_code && GENERIC_TITLES[status_code]) return GENERIC_TITLES[status_code];
  // Fuzzy fallback: si el título crudo contiene palabras clave
  const f = (fallback || "").toLowerCase();
  if (f.includes("deliver")) return "Entregado";
  if (f.includes("transit") || f.includes("in transit")) return "En tránsito internacional";
  if (f.includes("customs") || f.includes("aduana")) return "En gestión aduanera";
  if (f.includes("picked up") || f.includes("pickup")) return "Carga recolectada en origen";
  if (f.includes("arrived") || f.includes("arrival")) return "Arribo a centro de operaciones";
  if (f.includes("depart") || f.includes("departure")) return "Salida de centro de operaciones";
  if (f.includes("out for delivery")) return "En reparto final";
  if (f.includes("processed") || f.includes("processing")) return "Procesando";
  return stripCourierRefs(fallback) || "Actualización del envío";
}

// Normaliza eventos al shape de tracking_events.
// Por defecto aplica sanitización de marca para NO exponer el courier al cliente.
export function normalizeEvent({ operation_id, source, external_id, title, description, location, occurred_at, status_code, carrier }) {
  const cleanTitle = genericTitleFor(status_code, title);
  const cleanDesc = stripCourierRefs(description);
  const cleanLocation = stripCourierRefs(location);
  return {
    operation_id,
    source,
    external_id: external_id || null,
    title: cleanTitle,
    description: cleanDesc,
    location: cleanLocation,
    occurred_at: occurred_at || new Date().toISOString(),
    is_visible_to_client: true,
    carrier: carrier || null,
    status_code: status_code || null
  };
}
