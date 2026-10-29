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
  // DHL/FedEx/UPS entregan a oficina Argencargo, NO al cliente final.
  // El estado "entregado al cliente" lo marca manualmente Argencargo cuando hace la entrega final.
  "DL": "Carga recibida en Argencargo — coordinamos entrega", "delivered": "Carga recibida en Argencargo — coordinamos entrega",
  // Problemas
  "EX": "Demora en tránsito", "failure": "Incidencia en el envío",
  "exception": "Incidencia en el envío", "RT": "Reintento de entrega"
};

function stripCourierRefs(text) {
  if (!text) return null;
  // Saca cualquier mención explícita de DHL, FedEx, UPS, "facility", AWB numbers, etc.
  // Y traduce las frases más comunes del status raw inglés al español.
  return String(text)
    // Frases completas comunes (traducción directa):
    .replace(/\bShipment is out with courier for delivery\b/gi, "Saliendo a oficina Argencargo para entrega final")
    .replace(/\bShipment is out for delivery\b/gi, "Saliendo a oficina Argencargo para entrega final")
    .replace(/\bShipment has been delivered\b/gi, "Recibido en oficina Argencargo")
    .replace(/\bArrived at Sort centro\b/gi, "Llegó a centro de clasificación")
    .replace(/\bArrived at Sort Facility\b/gi, "Llegó a centro de clasificación")
    .replace(/\bDeparted from Sort centro\b/gi, "Salió del centro de clasificación")
    .replace(/\bProcessed at\b/gi, "Procesado en")
    .replace(/\bClearance processing complete at\b/gi, "Despacho aduanero completado en")
    .replace(/\bClearance event\b/gi, "Gestión aduanera")
    .replace(/\bIn transit to\b/gi, "En camino a")
    .replace(/\bOn the way to\b/gi, "En camino a")
    .replace(/\bShipment information sent to\b/gi, "Información enviada a")
    .replace(/\bArrived at\b/gi, "Llegó a")
    .replace(/\bDeparted\b/gi, "Salida")
    .replace(/\bDelivered\b/gi, "Recibido en oficina Argencargo")
    // Frases compuestas con marca primero (ej "FedEx Office", "FedEx location", "DHL Express"):
    .replace(/\b(FedEx|FEDEX|Fed Ex|DHL|UPS)\s+(Office|Location|Station|Facility|Hub|Express|Ground|Home Delivery|Smartpost)\b/gi, "centro")
    .replace(/\b(On\s+)?(FedEx|FEDEX|Fed Ex|DHL|UPS)\s+vehicle\b/gi, "en vehículo de reparto")
    // Marca suelta
    .replace(/\b(DHL|FedEx|FEDEX|Fed Ex|UPS|United Parcel Service)\b/gi, "")
    .replace(/\bfacility\b/gi, "centro")
    .replace(/\bhub\b/gi, "centro")
    .replace(/\s+/g, " ")
    .trim() || null;
}

export function genericTitleFor(status_code, fallback) {
  if (status_code && GENERIC_TITLES[status_code]) return GENERIC_TITLES[status_code];
  // Fuzzy fallback: si el título crudo contiene palabras clave
  const f = (fallback || "").toLowerCase();
  if (f.includes("deliver")) return "Carga recibida en Argencargo — coordinamos entrega";
  if (f.includes("transit") || f.includes("in transit")) return "En tránsito internacional";
  if (f.includes("customs") || f.includes("aduana")) return "En gestión aduanera";
  if (f.includes("picked up") || f.includes("pickup")) return "Carga recolectada en origen";
  if (f.includes("arrived") || f.includes("arrival")) return "Arribo a centro de operaciones";
  if (f.includes("depart") || f.includes("departure")) return "Salida de centro de operaciones";
  if (f.includes("out for delivery")) return "En reparto final";
  if (f.includes("processed") || f.includes("processing")) return "Procesando";
  return stripCourierRefs(fallback) || "Actualización del envío";
}

// Saca el nombre del courier de un texto en castellano (28/10/2026): el cliente ve el movimiento tal cual
// lo informa el courier, pero sin la marca. "Envío arribado a una estación de DHL MIAMI GATEWAY - USA"
// → "Envío arribado a una estación de MIAMI GATEWAY - USA".
const MARCA = "(?:DHL\\s+Express|DHL|FedEx|FEDEX|Fed\\s?Ex|UPS|United\\s+Parcel\\s+Service)";
export function sinMarca(text) {
  if (!text) return null;
  const t = String(text)
    .replace(new RegExp(`\\b(?:a|al)\\s+${MARCA}(?=\\s*[.,;:]?\\s*$)`, "gi"), "al courier")
    .replace(new RegExp(`\\b(?:de|del)\\s+${MARCA}(?=\\s*[.,;:]?\\s*$)`, "gi"), "del courier")
    .replace(new RegExp(`\\bpor\\s+${MARCA}\\b`, "gi"), "por el courier")
    .replace(new RegExp(`\\b(?:de|del)\\s+${MARCA}\\s+(?=\\S)`, "gi"), "de ")
    .replace(new RegExp(`\\b${MARCA}\\b`, "gi"), "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t || null;
}

// Normaliza eventos al shape de tracking_events.
// Eventos del courier (28/10/2026): courier_text = el texto exacto (admin); title = ese texto sin la
// marca (cliente). Los internos siguen con su título propio.
export function normalizeEvent({ operation_id, source, external_id, title, description, location, occurred_at, status_code, carrier }) {
  const base = { operation_id, source, external_id: external_id || null, occurred_at: occurred_at || new Date().toISOString(), is_visible_to_client: true, carrier: carrier || null, status_code: status_code || null };
  if (source === "internal") {
    return { ...base, title: genericTitleFor(status_code, title), description: stripCourierRefs(description), location: stripCourierRefs(location) };
  }
  const raw = String(title || "").trim();
  const texto = (/^[A-Z]{1,3}$/.test(raw) && description ? String(description).trim() : raw) || String(description || "").trim();
  return {
    ...base,
    title: sinMarca(texto) || genericTitleFor(status_code, texto),
    description: null,
    courier_text: texto || null,
    location: sinMarca(location),
  };
}
