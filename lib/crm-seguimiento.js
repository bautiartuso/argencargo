// lib/crm-seguimiento.js — reglas del seguimiento comercial (23/11/2026). Las usan Contactos y
// Seguimiento del CRM sobre las filas de crm_personas(): una fila por cliente (con su chat, si lo
// tiene) o por lead que escribió y no se registró. Funciones puras: no leen ni escriben nada.
//
// Reglas (las del seguimiento v3 del 27/10/2026, ahora con el chat adentro):
//  - Quien tiene algo en curso (op abierta, marítimo, bultos sin importación, reclamo) no se contacta.
//  - "Importó" se mide por la entrega y cuenta lo marítimo. Quien importó alguna vez es "importó".
//  - Descansos: 21 días desde el último contacto (un chat cuenta), 2 intentos sin respuesta → 90 días,
//    "no le interesa" → 120 días.
//  - Si la persona escribió por WhatsApp y nadie le contestó, va primero.
// Los mismos descansos están en la base para la IA (crm_personas_v.ia_apto): si cambia uno, cambia el otro.

export const n = (v) => Number(v || 0);
export const dias = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
export const diasTxt = (d) => (d == null ? "" : d <= 0 ? "hoy" : d === 1 ? "ayer" : d < 30 ? `hace ${d} días` : d < 60 ? "hace un mes" : d < 365 ? `hace ${Math.round(d / 30)} meses` : `hace ${Math.round((d / 365) * 10) / 10} años`);
export const fechaDM = (iso) => { if (!iso) return ""; const [, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}`; };
export const fmtUsd = (v) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const waNum = (c) => String(c.phone || c.whatsapp || "").replace(/[^0-9]/g, "");
export const canalTxt = (c) => (/mar/i.test(String(c || "")) ? "por marítimo" : /a[ée]r|courier/i.test(String(c || "")) ? "por aéreo" : "");
export const maxF = (...fs) => fs.filter(Boolean).reduce((a, b) => (!a ? b : new Date(a) > new Date(b) ? a : b), null);
export const nombreDe = (c) => [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.company_name || c.wa_name || "";
export const esLead = (c) => !c.id;

export const enCurso = (c) => {
  const l = [];
  if (n(c.ops_activas) > 0) l.push(`${c.ops_activas} operaci${n(c.ops_activas) === 1 ? "ón" : "ones"} abierta${n(c.ops_activas) === 1 ? "" : "s"}${c.ultima_op_code ? ` (${c.ultima_op_code})` : ""}`);
  if (n(c.mar_activos) > 0) l.push(`${c.mar_activos} marítimo${n(c.mar_activos) === 1 ? "" : "s"} en curso`);
  if (n(c.bultos_sin_op) > 0) l.push(`${c.bultos_sin_op} bulto${n(c.bultos_sin_op) === 1 ? "" : "s"} en depósito`);
  if (n(c.claims_pendientes) > 0) l.push("reclamo de depósito pendiente");
  return l;
};
export const importaciones = (c) => n(c.ops_cerradas) + (c.mar_ultima_fecha ? Math.max(0, n(c.mar_total) - n(c.mar_activos)) : 0);
export const ultimaImp = (c) => maxF(c.ultima_op_cierre, c.mar_ultima_fecha) || (n(c.ops_cerradas) > 0 ? c.ultima_op_fecha : null);
export const cotizoDespues = (c) => !!c.ultima_quote_fecha && (!ultimaImp(c) || new Date(c.ultima_quote_fecha) > new Date(ultimaImp(c)));
// ¿Escribió por WhatsApp y quedó sin contestar? (hasta un mes: después ya no es una charla abierta)
export const sinContestar = (c) => !!c.last_in_at && (!c.last_out_at || new Date(c.last_in_at) > new Date(c.last_out_at)) && dias(c.last_in_at) <= 30;
// Último contacto de cualquier tipo: lo que se registró en seguimiento o el último mensaje del chat.
export const ultimoToque = (c) => maxF(c.last_followup_at, c.ultimo_contacto_at, c.last_msg_at);

// Un grupo por persona.
export function clasificar(c) {
  if (c.followup_status === "no_contactar" || c.marketing_opt_out || c.stage === "perdido") return "no_contactar";
  if (enCurso(c).length) return "en_curso";
  if (esLead(c)) return "leads";
  if (importaciones(c) > 0) { const d = dias(ultimaImp(c)); return d != null && d < 30 && !sinContestar(c) ? "reciente" : "importaron"; }
  if (n(c.quotes_total) > 0) return "cotizaron";
  return "nunca";
}

// ¿Conviene escribirle hoy? si · espera · no, con el motivo en una frase.
export function semaforo(c, s, hoy) {
  const toque = ultimoToque(c);
  const dc = dias(toque);
  const porChat = !!c.last_msg_at && toque === c.last_msg_at;
  const dq = dias(c.ultima_quote_fecha), dImp = dias(ultimaImp(c)), imps = importaciones(c);
  const sinResp = n(c.intentos_sin_respuesta);
  if (s === "no_contactar") return { k: "no", t: c.marketing_opt_out ? "Se dio de baja de los mensajes" : c.stage === "perdido" && c.followup_status !== "no_contactar" ? "Marcado como perdido" : `No contactar${c.no_contactar_at ? ` desde el ${fechaDM(c.no_contactar_at)}` : ""}${c.no_contactar_nota ? ` · ${c.no_contactar_nota}` : ""}` };
  if (s === "en_curso") return { k: "no", t: `Tiene algo en curso: ${enCurso(c).join(" · ")}` };
  if (s === "reciente") return { k: "no", t: `Importó ${diasTxt(dImp)} · dejalo tranquilo hasta el mes` };
  if (!waNum(c)) return { k: "no", t: "Sin WhatsApp cargado" };
  if (sinContestar(c)) return { k: "si", t: `Te escribió ${diasTxt(dias(c.last_in_at))} y quedó sin contestar`, urgente: true };
  if (c.followup_next_at && c.followup_next_at > hoy) return { k: "espera", t: `Agendado para el ${fechaDM(c.followup_next_at)}` };
  if (c.followup_status === "no_interesado" && dc != null && dc < 120) return { k: "espera", t: `Dijo que no le interesa ${diasTxt(dc)} · se retoma a los 4 meses` };
  if (sinResp >= 2 && dc != null && dc < 90) return { k: "espera", t: `Ya le escribiste ${sinResp} veces sin respuesta · se retoma en ${90 - dc} días` };
  if (dc != null && dc < 21) return { k: "espera", t: porChat ? `Hablaron por WhatsApp ${diasTxt(dc)}` : `Le escribiste ${diasTxt(dc)}${c.ultimo_outcome === "sin_respuesta" || c.ultimo_outcome === "enviado" ? " · esperando respuesta" : c.ultimo_outcome === "respondio" ? " y te respondió" : ""}` };
  if (c.followup_next_at && c.followup_next_at <= hoy) return { k: "si", t: `Quedaste en volver a escribirle el ${fechaDM(c.followup_next_at)}`, urgente: true };
  if (s === "leads") return { k: "si", t: `Escribió ${diasTxt(dias(c.created_at))} y no se registró${c.last_msg_at ? ` · último chat ${diasTxt(dias(c.last_msg_at))}` : ""}` };
  if (s === "importaron") {
    const cad = n(c.cadencia_dias); const rec = imps >= 2 && cad >= 7 ? ` · suele volver cada ~${Math.round(cad)} días${dImp > cad * 1.3 ? ", ya se pasó" : ""}` : "";
    const cot = cotizoDespues(c) && dq <= 180 ? ` · cotizó de nuevo ${diasTxt(dq)} (USD ${fmtUsd(c.ultima_quote_total)}) y no la trajo` : "";
    if (dImp != null && dImp < 45 && !cot) return { k: "espera", t: `Importó ${diasTxt(dImp)} · todavía es pronto` };
    return { k: "si", t: `${imps} importaci${imps === 1 ? "ón" : "ones"}, la última entregada ${diasTxt(dImp)}${rec}${cot}` };
  }
  if (s === "cotizaron") return { k: dq > 365 ? "espera" : "si", t: `Cotizó ${canalTxt(c.ultima_quote_canal)} ${diasTxt(dq)} (USD ${fmtUsd(c.ultima_quote_total)}) y nunca importó${n(c.quotes_total) > 1 ? ` · ${c.quotes_total} cotizaciones` : ""}${dq > 365 ? " · muy viejo" : ""}` };
  if (dc != null && dc < 45) return { k: "espera", t: `Contactado ${diasTxt(dc)}, sin novedades` };
  return { k: "si", t: `Registrado ${diasTxt(dias(c.created_at))}, nunca cotizó` };
}

// Temperatura: la del análisis de la IA; mientras no lo tiene, una estimación por los datos.
export const TEMP = { caliente: { l: "Caliente", c: "#fb7185" }, tibio: { l: "Tibio", c: "#fbbf24" }, frio: { l: "Frío", c: "#7dd3fc" } };
export function temperatura(c, s) {
  if (TEMP[c.temperatura]) return c.temperatura;
  if (sinContestar(c)) return "caliente";
  if (s === "leads") return dias(c.last_msg_at) <= 14 ? "tibio" : "frio";
  if (s === "importaron" || s === "reciente" || s === "en_curso") return "tibio";
  if (s === "cotizaron") return dias(c.ultima_quote_fecha) <= 45 ? "tibio" : "frio";
  return "frio";
}

// Quién la lleva: la IA solo a los fríos sin nada puntual para retomar; una charla sin contestar o
// una fecha agendada siempre es de una persona.
export function lleva(c) {
  if (sinContestar(c) || c.followup_next_at) return "humano";
  return c.quien_ef === "ia" ? "ia" : "humano";
}

// Prioridad (0-100) dentro de lo que conviene escribir hoy.
export function prioridad(c, s, sem, hoy) {
  if (sem.k !== "si") return -1;
  if (sem.urgente) return 100;
  const castigo = Math.min(25, n(c.intentos_sin_respuesta) * 10);
  const calor = c.temperatura === "caliente" ? 18 : c.temperatura === "tibio" ? 8 : 0;
  if (s === "importaron") {
    const imps = importaciones(c); const dImp = dias(ultimaImp(c)) || 0; const cad = n(c.cadencia_dias);
    const valor = Math.min(20, Math.log10(1 + n(c.facturado_usd)) * 4); const rep = imps >= 3 ? 10 : imps === 2 ? 6 : 0;
    const atraso = cad >= 7 ? Math.min(15, Math.max(0, (dImp - cad) / cad) * 10) : Math.min(10, dImp / 30);
    const cot = cotizoDespues(c) && (dias(c.ultima_quote_fecha) || 999) <= 60 ? 12 : 0;
    return 50 + valor + rep + atraso + cot + calor - castigo;
  }
  if (s === "cotizaron") { const dq = dias(c.ultima_quote_fecha) || 0; const rec = dq <= 14 ? 25 : dq <= 45 ? 15 : dq <= 90 ? 8 : dq <= 180 ? 3 : 0; const valor = Math.min(8, Math.log10(1 + n(c.ultima_quote_total)) * 2); return 40 + rec + valor + calor - castigo; }
  if (s === "leads") { const dm = dias(c.last_msg_at) ?? 999; return 45 + (dm <= 7 ? 20 : dm <= 30 ? 10 : 0) + calor - castigo; }
  const dr = dias(c.created_at) || 0; return 10 + (dr <= 30 ? 10 : dr <= 90 ? 4 : 0) + calor - castigo;
}

// Todo junto: la fila con su grupo, semáforo, temperatura, prioridad y quién la lleva.
export function enriquecer(c, hoy) {
  const seg = clasificar(c); const sem = semaforo(c, seg, hoy);
  return { ...c, seg, sem, temp: temperatura(c, seg), prio: prioridad(c, seg, sem, hoy), lleva: lleva(c) };
}

// Qué está haciendo la IA con esta persona, en una frase.
export function estadoIa(c) {
  if (c.ia_ultimo_estado === "respondio") return `Le contestó a la IA ${diasTxt(dias(c.last_in_at || c.ia_ultimo_at))}`;
  if (c.ia_apto) return n(c.ia_enviados) > 0 ? `La IA le escribió ${diasTxt(dias(c.ia_ultimo_at))} sin respuesta · le vuelve a escribir` : "En la fila";
  if (c.ia_ultimo_at) return `La IA le escribió ${diasTxt(dias(c.ia_ultimo_at))} · sin respuesta${n(c.ia_enviados) >= 3 ? " · no insiste más" : ""}`;
  return c.sem?.t || "";
}
