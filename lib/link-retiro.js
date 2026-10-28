// Link único de retiro (28/10/2026): si un cliente tiene dos o más cargas listas sin coordinar ni
// entregar, todas usan el MISMO link — el de la que se avisó primero. Ese link muestra todas las
// cargas juntas (una visita, un pago), así el cliente no recibe un link distinto por cada carga.
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";

// Mismo criterio que las "hermanas" del link: lista (entregada o avisada), sin entregar todavía.
const LISTAS = "delivery_completed_at=is.null&status=not.in.(pendiente,en_deposito_origen,en_preparacion,en_transito,operacion_cerrada,cancelada)&or=(status.eq.entregada,delivery_ready_at.not.is.null)";

// La entrega directa por courier (aéreo A de un RI) no se coordina: queda afuera del link compartido.
const esRiDirecta = (o) => o.channel === "aereo_blanco" && o.ri_entrega_directa !== false && (o.ri_entrega_directa === true || o.clients?.tax_condition === "responsable_inscripto");

// Cargas abiertas del cliente (sin coordinar), de la avisada primero a la última.
export async function cargasAbiertas(clientId) {
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!clientId || !key) return [];
  const r = await fetch(`${SB_URL}/rest/v1/operations?client_id=eq.${clientId}&delivery_confirmed_at=is.null&${LISTAS}&select=id,operation_code,description,channel,ri_entrega_directa,delivery_public_token,delivery_ready_at,created_at,sent_notifications,clients(tax_condition)&order=delivery_ready_at.asc.nullslast,created_at.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }).catch(() => null);
  const list = r && r.ok ? await r.json().catch(() => []) : [];
  return (Array.isArray(list) ? list : []).filter((o) => o.delivery_public_token && !esRiDirecta(o) && !o.sent_notifications?.silenciada);
}

// Token que hay que mandarle al cliente para esta op: el compartido si la op está en el grupo de
// cargas abiertas, o el suyo propio si ya se coordinó o va sola.
export async function tokenRetiro(op) {
  if (!op?.delivery_public_token) return null;
  if (op.delivery_confirmed_at || !op.client_id) return op.delivery_public_token;
  const abiertas = await cargasAbiertas(op.client_id);
  if (abiertas.length < 2 || !abiertas.some((o) => o.id === op.id)) return op.delivery_public_token;
  return abiertas[0].delivery_public_token;
}

// "Power Banks (AC-0353) y Action Camara (AC-0345)" para los mensajes del grupo.
export function nombreCargas(ops) {
  const n = (ops || []).map((o) => (o.description ? `${o.description} (${o.operation_code})` : o.operation_code));
  return n.length <= 1 ? (n[0] || "") : `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`;
}
