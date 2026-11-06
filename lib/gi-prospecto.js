// Interesados de Gestión Integral sin ficha (06/11/2026, pedido de Bautista: "hasta que la operación no
// se hace, no es cliente"). Una cotización a alguien nuevo guarda solo nombre, apellido y WhatsApp en
// gi_quote_requests.prospect_*; la ficha en `clients` se crea recién cuando la persona crea su cuenta desde
// el link de la cotización (/api/cotizacion/[token]/cuenta) o cuando la cotización pasa a operación
// (/api/gi/convert-quote). Solo servidor: escribe con la clave de servicio.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";

// Lo que el panel muestra como "cliente" cuando el pedido todavía no tiene ficha.
export const prospectoDe = (r) => (r?.prospect_first_name || r?.prospect_last_name
  ? { id: null, prospecto: true, first_name: r.prospect_first_name || "", last_name: r.prospect_last_name || "", whatsapp: r.prospect_whatsapp || "—", email: "—", client_code: null, gi_partner_id: r.assigned_partner_id || null }
  : null);
export const clienteDe = (r) => r?.clients || prospectoDe(r);

const norm = (x) => String(x || "").normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
export const codigosPosibles = (first, last) => {
  const base = (norm(first).slice(0, 3) + norm(last && last !== "—" ? last : first).slice(0, 3)).padEnd(6, "X");
  return [base, ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => base.slice(0, 5) + n)];
};

// Crea la ficha a partir del pedido y la deja enganchada (gi_quote_requests.client_id). Devuelve la ficha
// o null. `extra` permite sumar email/auth_user_id en el mismo alta (cuenta creada desde el link).
export async function crearClienteDesdeProspecto(serviceKey, request, extra = {}) {
  const first = String(request?.prospect_first_name || "").trim();
  if (!first) return null;
  const last = String(request?.prospect_last_name || "").trim() || "—";
  const h = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const base = { first_name: first, last_name: last, gi_partner_id: request.assigned_partner_id || null, whatsapp: String(request.prospect_whatsapp || "").trim() || "—", email: "—", street: "—", postal_code: "—", city: "—", province: "—", tax_condition: "ninguna", ...extra };
  for (const code of codigosPosibles(first, last)) {
    const r = await fetch(`${SB_URL}/rest/v1/clients`, { method: "POST", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify({ ...base, client_code: code }) });
    const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {}
    const row = Array.isArray(d) ? d[0] : null;
    if (row?.id) {
      await fetch(`${SB_URL}/rest/v1/gi_quote_requests?id=eq.${request.id}&client_id=is.null`, { method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify({ client_id: row.id }) });
      return row;
    }
    if (!/duplicate/i.test(t)) break;
  }
  return null;
}
