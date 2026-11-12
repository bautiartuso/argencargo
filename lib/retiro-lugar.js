// Dónde y en qué horarios se retira una carga (12/11/2026).
// Marítimo LCL/FCL (canal maritimo_blanco) se retira en el depósito de Conesa, con sus propias franjas. Todo lo demás sigue retirándose en la oficina, con las franjas de siempre. La dirección de
// la oficina sale de gi_settings; la del depósito está acá porque es exclusiva de LCL/FCL.
// Lo usan el link de retiro, /api/entrega, los formularios del admin y la herramienta del bot:
// si cambia el lugar o un horario, se cambia SOLO acá.
export const FRANJAS_OFICINA = ["10:00 a 12:00", "12:00 a 14:00", "14:00 a 16:00", "16:00 a 18:00"];
export const FRANJAS_PROPIO = ["10:00 a 13:00", "13:00 a 16:00", "16:00 a 19:00"];
export const DEPOSITO_LCLFCL = {
  address: "Conesa 3664",
  locality: "Núñez, CABA",
  // 12/11/2026 (segunda versión, pedido de Bautista): abre 8:30, corta de 13 a 14 y la última franja
  // termina 16:30. Cinco franjas: tres de hora y media a la mañana y dos de una hora y cuarto a la tarde.
  hours: "Lunes a viernes de 8:30 a 13 y de 14 a 16:30",
  franjas: ["08:30 a 10:00", "10:00 a 11:30", "11:30 a 13:00", "14:00 a 15:15", "15:15 a 16:30"],
};

export const esLclFcl = (channel) => String(channel || "") === "maritimo_blanco";

// modo: "oficina" (el cliente pasa a retirar) | "propio" (se la llevamos).
export const franjasRetiro = (channel, modo = "oficina") => (modo === "propio" ? FRANJAS_PROPIO : esLclFcl(channel) ? DEPOSITO_LCLFCL.franjas : FRANJAS_OFICINA);

// { address, locality, hours, nombre: "oficina" | "depósito", lclfcl }
export function lugarRetiro(channel, settings = {}) {
  if (esLclFcl(channel)) return { address: DEPOSITO_LCLFCL.address, locality: DEPOSITO_LCLFCL.locality, hours: DEPOSITO_LCLFCL.hours, nombre: "depósito", lclfcl: true };
  return { address: settings?.office_address || "Virrey Loreto 2428", locality: settings?.office_locality || "Belgrano, CABA", hours: settings?.office_hours || "", nombre: "oficina", lclfcl: false };
}

// "08:30 a 10:00" → "8:30 a 10" (para los mensajes).
export const franjaCorta = (f) => String(f || "").replace(/:00/g, "").replace(/\b0(\d)/g, "$1").replace(/\s*a\s*/, " a ").trim();
// Hora de fin de una franja, en horas decimales ("12:00 a 13:30" → 13.5).
export const finDeFranja = (f) => { const [h, m] = String(f || "").split(" a ")[1]?.split(":").map(Number) || []; return (h || 0) + (m || 0) / 60; };
