// Seguimiento de contenedores por naviera (27/10/2026), gratis.
//   COSCO : endpoints públicos de su página de tracking (sin clave). Dan el estado actual del
//           contenedor y la ETA al puerto de destino; el historial completo está enmascarado para
//           quien no es parte del embarque, así que se guarda lo que se ve en cada pasada.
//   Maersk: API oficial Track & Trace (DCSA), gratis con registro: MAERSK_CONSUMER_KEY en Vercel.
//           Cubre Maersk, Sealand/MCC y Hamburg Süd.
//   MSC y OOCL no tienen API gratis: quedan manuales.
// Devuelve siempre la misma forma: { ok, naviera, ultimo, eventos, eta, salida, llegada, buque, error }.
//   tipo de cada evento: salida (zarpó del puerto de origen) · transbordo · llegada (en Buenos
//   Aires) · entregado (salió del puerto) · otro.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
export const CODIGO_CONTENEDOR = /^[A-Z]{4}\d{7}$/;
export const navieraDe = (s) => {
  const t = String(s || "").toLowerCase();
  if (/cosco/.test(t)) return "COSCO";
  if (/maersk|mcc|sealand|hamburg/.test(t)) return "MAERSK";
  return null;
};
export const soportaTracking = (c) => !!navieraDe(c?.shipping_line) && CODIGO_CONTENEDOR.test(String(c?.code || "").trim().toUpperCase());

const fechaIso = (s) => { const m = String(s || "").match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; };
const clasificar = (estado) => {
  const e = String(estado || "").toLowerCase();
  if (/discharged at last pod|arriv\w* at last pod|discharged at pod|arrived at pod/.test(e)) return "llegada";
  if (/gate-?out|empty .*return/.test(e)) return "entregado";
  if (/loaded at first pol|departure from first pol|vessel departure|departed/.test(e)) return "salida";
  if (/tran(s|sh|ss)hipment/.test(e)) return "transbordo";
  return "otro";
};

async function rastrearCosco(code) {
  const h = { sys: "eb", language: "en_US", Accept: "application/json", "User-Agent": UA, Referer: "https://elines.coscoshipping.com/ebusiness/cargoTracking" };
  const ts = Date.now();
  const r = await fetch(`https://elines.coscoshipping.com/ebtracking/public/containers/${code}?timestamp=${ts}`, { headers: h, cache: "no-store" });
  const txt = await r.text();
  let d = null; try { d = JSON.parse(txt); } catch {}
  if (!d) return { ok: false, naviera: "COSCO", error: r.status === 403 ? "COSCO bloqueó la consulta (bot). Reintenta en la próxima pasada." : `COSCO respondió ${r.status}` };
  const cont = d?.data?.content?.containers?.[0];
  const st = cont?.containerCircleStatus?.[0];
  if (!cont || !st?.containerNumberStatus) return { ok: true, naviera: "COSCO", ultimo: null, eventos: [], eta: null, salida: null, llegada: null, buque: null, error: "COSCO no tiene movimientos para este contenedor" };
  let eta = null;
  try {
    const re = await fetch(`https://elines.coscoshipping.com/ebtracking/public/container/eta/${code}?timestamp=${ts + 1}`, { headers: h, cache: "no-store" });
    const de = await re.json(); eta = fechaIso(de?.data?.content);
  } catch {}
  const tipo = clasificar(st.containerNumberStatus);
  const ev = { fecha: String(st.timeOfIssue || "").slice(0, 16) || null, estado: st.containerNumberStatus, lugar: st.location || null, transporte: st.transportation || null, buque: st.transportId || null, tipo, estimada: false };
  return {
    ok: true, naviera: "COSCO", ultimo: ev, eventos: [ev], eta,
    salida: tipo === "salida" ? fechaIso(ev.fecha) : null,
    llegada: tipo === "llegada" || tipo === "entregado" ? fechaIso(ev.fecha) : null,
    buque: ev.buque, error: null,
  };
}

// DCSA Track & Trace v2: eventos TRANSPORT (ARRI/DEPA), EQUIPMENT (LOAD/DISC/GTIN/GTOT) y SHIPMENT,
// cada uno ACT (ocurrido), EST (estimado) o PLN (planificado).
async function rastrearMaersk(code) {
  const key = process.env.MAERSK_CONSUMER_KEY;
  if (!key) return { ok: false, naviera: "MAERSK", error: "Falta MAERSK_CONSUMER_KEY en Vercel (developer.maersk.com → app → Track & Trace)" };
  const r = await fetch(`https://api.maersk.com/track-and-trace/events?equipmentReference=${code}&limit=200`, { headers: { "Consumer-Key": key, Accept: "application/json", "User-Agent": UA }, cache: "no-store" });
  const txt = await r.text();
  let d = null; try { d = JSON.parse(txt); } catch {}
  if (!r.ok) return { ok: false, naviera: "MAERSK", error: `Maersk respondió ${r.status}: ${String(d?.message || d?.error || txt).slice(0, 160)}` };
  const lista = Array.isArray(d) ? d : Array.isArray(d?.events) ? d.events : [];
  const NOMBRES = { ARRI: "Arribo", DEPA: "Zarpe", LOAD: "Cargado al buque", DISC: "Descargado del buque", GTIN: "Ingresó a terminal", GTOT: "Salió de terminal", STUF: "Consolidado", STRP: "Desconsolidado", RECE: "Recibido", DRFT: "Borrador", CONF: "Confirmado", ISSU: "Emitido", RELS: "Liberado" };
  const eventos = lista.map((e) => {
    const cod = e.transportEventTypeCode || e.equipmentEventTypeCode || e.shipmentEventTypeCode || "";
    const loc = e.eventLocation || e.transportCall?.location || {};
    const un = loc.UNLocationCode || e.transportCall?.UNLocationCode || "";
    const lugar = [loc.locationName || loc.facilityName, un].filter(Boolean).join(" · ") || null;
    const buque = e.transportCall?.vessel?.vesselName || e.transportCall?.vessel?.name || null;
    const esBue = /^ARBUE$/i.test(un) || /buenos aires/i.test(lugar || "");
    let tipo = "otro";
    if (cod === "ARRI" || cod === "DISC") tipo = esBue ? "llegada" : "transbordo";
    else if (cod === "DEPA" || cod === "LOAD") tipo = esBue ? "otro" : "salida";
    else if (cod === "GTOT" && esBue) tipo = "entregado";
    return { fecha: String(e.eventDateTime || e.eventCreatedDateTime || "").replace("T", " ").slice(0, 16) || null, estado: NOMBRES[cod] || cod, lugar, transporte: e.transportCall?.modeOfTransport || null, buque, tipo, estimada: e.eventClassifierCode !== "ACT", esBue };
  }).filter((e) => e.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const hechos = eventos.filter((e) => !e.estimada);
  const salida = hechos.find((e) => e.tipo === "salida");
  const llegada = hechos.find((e) => e.tipo === "llegada" || e.tipo === "entregado");
  const etaEv = [...eventos].reverse().find((e) => e.estimada && (e.tipo === "llegada"));
  const ultimo = hechos[hechos.length - 1] || null;
  const buque = [...hechos].reverse().find((e) => e.buque)?.buque || null;
  return { ok: true, naviera: "MAERSK", ultimo, eventos, eta: etaEv ? fechaIso(etaEv.fecha) : null, salida: salida ? fechaIso(salida.fecha) : null, llegada: llegada ? fechaIso(llegada.fecha) : null, buque, error: eventos.length ? null : "Maersk no tiene eventos para este contenedor" };
}

export async function rastrearContenedor(container) {
  const code = String(container?.code || "").trim().toUpperCase();
  const nav = navieraDe(container?.shipping_line);
  if (!nav) return { ok: false, naviera: null, error: "Naviera sin seguimiento gratis (solo COSCO y Maersk)" };
  if (!CODIGO_CONTENEDOR.test(code)) return { ok: false, naviera: nav, error: "El código no es un número de contenedor (4 letras + 7 dígitos)" };
  try { return nav === "COSCO" ? await rastrearCosco(code) : await rastrearMaersk(code); }
  catch (e) { return { ok: false, naviera: nav, error: e.message }; }
}

// Texto corto para la tarjeta: "Loaded at First POL · Yangshan, Shanghai · 26/10 06:59"
export const resumenEvento = (ev) => {
  if (!ev) return null;
  const f = ev.fecha ? `${ev.fecha.slice(8, 10)}/${ev.fecha.slice(5, 7)} ${ev.fecha.slice(11, 16)}`.trim() : "";
  const lugar = ev.lugar ? ev.lugar.split(",").slice(0, 2).join(",") : "";
  return [ev.estado, lugar, f].filter(Boolean).join(" · ");
};
