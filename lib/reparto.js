// Reparto (13/11/2026): motor de la app de los fletes locales. Solo servidor.
// Junta los envíos a domicilio coordinados de Argencargo y de MyBox en un mismo formato, ubica cada
// dirección en el mapa, arma el orden de la ruta (primero por la franja que eligió el cliente, después
// por cercanía) y mide los kilómetros del recorrido, que son los que se le pagan al repartidor.
import { zonaDeCp, esCpCaba, isCabaText } from "./delivery";
import { hoyAR } from "./fecha-ar";

const AC_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const MB_URL = "https://yaolukpuufbomokwqahm.supabase.co";

const rest = (url, clave) => async (path, opts = {}) => {
  const key = process.env[clave];
  if (!key) return { ok: false, status: 0, body: null };
  const r = await fetch(`${url}/rest/v1${path}`, { ...opts, cache: "no-store", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opts.headers || {}) } }).catch(() => null);
  if (!r) return { ok: false, status: 0, body: null };
  const t = await r.text();
  let body = null;
  try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { ok: r.ok, status: r.status, body };
};
export const ac = rest(AC_URL, "SUPABASE_SERVICE_ROLE");
export const mb = rest(MB_URL, "MYBOX_SUPABASE_SERVICE_ROLE");
export const hayMyBox = () => !!process.env.MYBOX_SUPABASE_SERVICE_ROLE;
const filas = (r) => (Array.isArray(r?.body) ? r.body : []);
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// ───────────────────────── Envíos ─────────────────────────

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.,;()]/g, " ").replace(/\s+/g, " ").trim();
// "No", "-", "s/n", "n/a" escritos en la casilla del piso no son un piso.
const sinRelleno = (t) => { const v = String(t ?? "").trim(); return /^(no|-+|n\/?a|s\/?n|ninguno|x|\.)$/i.test(v) ? "" : v; };
const cp4 = (s) => (String(s || "").match(/\b(\d{4})\b(?!.*\b\d{4}\b)/) || [])[1] || "";

// "Av Jose Maria Moreno 675 5to O" → "Av Jose Maria Moreno 675". Se queda con la calle y la altura:
// el piso, el timbre o el barrio escritos después confunden al buscador de direcciones.
export function calleYAltura(texto, piso) {
  const t = String(texto || "").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const pal = t.split(" ");
  for (let i = 1; i < pal.length; i++) {
    if (!/^\d{1,5}$/.test(pal[i])) continue;
    if (/^(calle|ruta|km|av|avenida|diagonal)$/i.test(pal[i - 1]) && i + 1 < pal.length && /^\d{1,5}$/.test(pal[i + 1])) continue; // "Calle 13 1234"
    if (/^de$/i.test(pal[i + 1] || "")) continue; // "9 de Julio", "25 de Mayo"
    return pal.slice(0, i + 1).join(" ");
  }
  // "tonelero" + piso "5852": la altura quedó cargada en la casilla del piso.
  if (t && /^\d{2,5}$/.test(String(piso || "").trim())) return `${t} ${String(piso).trim()}`;
  return t;
}

const MACRO = {
  "CABA": "CABA",
  "San Martín": "Norte", "Vicente López / Olivos / Martínez": "Norte", "San Isidro / Beccar / Acassuso": "Norte", "San Fernando": "Norte", "Tigre": "Norte", "Nordelta": "Norte", "San Miguel / José C. Paz / Malvinas Argentinas": "Norte", "Pilar": "Norte", "Escobar": "Norte",
  "Tres de Febrero (Caseros)": "Oeste", "Ituzaingó / Hurlingham": "Oeste", "Morón / Haedo": "Oeste", "Ramos Mejía / San Justo (La Matanza)": "Oeste", "Merlo": "Oeste", "Moreno": "Oeste",
  "Avellaneda": "Sur", "Lanús": "Sur", "Lomas de Zamora": "Sur", "Monte Grande (Esteban Echeverría)": "Sur", "Adrogué (Almirante Brown)": "Sur", "Quilmes": "Sur", "Berazategui": "Sur", "Florencio Varela": "Sur", "Ezeiza": "Sur", "La Plata / Berisso / Ensenada": "Sur",
};
// Partidos de cada zona, con el nombre que usa el nomenclador oficial de calles.
const PARTIDOS = {
  "San Martín": ["General San Martín"], "Tres de Febrero (Caseros)": ["Tres de Febrero"], "Ituzaingó / Hurlingham": ["Ituzaingó", "Hurlingham"], "Morón / Haedo": ["Morón"],
  "Ramos Mejía / San Justo (La Matanza)": ["La Matanza"], "Vicente López / Olivos / Martínez": ["Vicente López", "San Isidro"], "San Isidro / Beccar / Acassuso": ["San Isidro"],
  "San Fernando": ["San Fernando"], "Tigre": ["Tigre"], "Nordelta": ["Tigre"], "San Miguel / José C. Paz / Malvinas Argentinas": ["San Miguel", "José C. Paz", "Malvinas Argentinas"],
  "Pilar": ["Pilar"], "Escobar": ["Escobar"], "Avellaneda": ["Avellaneda"], "Lanús": ["Lanús"], "Lomas de Zamora": ["Lomas de Zamora"], "Monte Grande (Esteban Echeverría)": ["Esteban Echeverría"],
  "Adrogué (Almirante Brown)": ["Almirante Brown"], "Quilmes": ["Quilmes"], "Berazategui": ["Berazategui"], "Florencio Varela": ["Florencio Varela"], "Ezeiza": ["Ezeiza"],
  "Merlo": ["Merlo"], "Moreno": ["Moreno"], "La Plata / Berisso / Ensenada": ["La Plata", "Berisso", "Ensenada"],
};

// Zona grande (CABA / Norte / Oeste / Sur): por código postal y, si no alcanza, por dónde cae en el mapa.
export function zonaGrande({ cp, localidad, lat, lng }) {
  const z = zonaDeCp(cp);
  if (z && MACRO[z]) return MACRO[z];
  if (isCabaText(norm(localidad))) return "CABA";
  if (lat == null || lng == null) return null;
  if (lat > -34.705 && lat < -34.527 && lng > -58.531 && lng < -58.335) return "CABA";
  const rumbo = (Math.atan2((lng + 58.3816) * Math.cos((lat * Math.PI) / 180), lat + 34.6037) * 180) / Math.PI; // desde el Obelisco, 0 = norte
  const g = (rumbo + 360) % 360;
  return g >= 290 || g < 40 ? "Norte" : g >= 225 ? "Oeste" : "Sur";
}

const AC_SEL = "id,operation_code,status,budget_total,credit_applied_usd,debt_applied_usd,total_anticipos,discount_applied_usd,collected_amount,is_collected,collection_currency,collection_exchange_rate,delivery_choice,delivery_address,delivery_contact,delivery_day,delivery_slot,delivery_confirmed_at,delivery_completed_at,payment_method_chosen,cash_arrival_amount,cash_arrival_currency,clients(first_name,last_name,company_name,client_code,whatsapp,street,floor_apt,city,postal_code)";
const MB_SEL = "id,operation_code,status,paid_at,delivered_at,delivery_choice,delivery_address,delivery_day,delivery_slot,delivery_phone,delivery_notes,delivery_cost_usd,delivery_confirmed_at,payment_method_chosen,credit_applied_usd,debt_applied_usd,debt_registered_usd,extra_charge_usd,discount_applied_usd,clients(first_name,last_name,client_code,phone,direccion,piso_depto,localidad,codigo_postal)";

const porOp = (lista, f) => { const m = {}; for (const x of lista) m[x.operation_id] = (m[x.operation_id] || 0) + f(x); return m; };
const enLista = (ids) => `in.(${ids.join(",")})`;

// modo: "pendientes" (coordinados y sin entregar) | "prueba" (los últimos entregados, para probar la app)
// | { ids } (los que ya están cargados en un auto, con su estado al día).
async function enviosArgencargo(modo) {
  const filtro = modo?.ids ? `id=${enLista(modo.ids)}`
    : modo === "prueba" ? "delivery_choice=eq.propio&delivery_completed_at=not.is.null&order=delivery_completed_at.desc&limit=5"
    : "delivery_choice=eq.propio&delivery_completed_at=is.null&delivery_confirmed_at=not.is.null&status=not.in.(operacion_cerrada,cancelada)&order=delivery_day.asc.nullslast";
  const ops = filas(await ac(`/operations?${filtro}&select=${AC_SEL}`));
  if (!ops.length) return [];
  const ids = ops.map((o) => o.id);
  const [pk, pg] = await Promise.all([
    ac(`/operation_packages?operation_id=${enLista(ids)}&select=operation_id,quantity,gross_weight_kg`),
    ac(`/operation_client_payments?operation_id=${enLista(ids)}&select=operation_id,amount_usd`),
  ]);
  const bultos = porOp(filas(pk), (p) => Number(p.quantity || 1));
  const kg = porOp(filas(pk), (p) => Number(p.gross_weight_kg || 0) * Number(p.quantity || 1));
  const pagos = porOp(filas(pg), (p) => Number(p.amount_usd || 0));
  return ops.map((o, i) => {
    const c = o.clients || {}, dc = o.delivery_contact || {};
    // Mismo saldo que el link de retiro y el panel de Entregas.
    const legacy = Number(o.collected_amount || 0) / (o.collection_currency === "ARS" ? Number(o.collection_exchange_rate || 0) || Infinity : 1);
    const cobrado = pagos[o.id] > 0 ? pagos[o.id] : legacy;
    let saldo = Math.max(0, Number(o.budget_total || 0) + Number(o.debt_applied_usd || 0) - Number(o.total_anticipos || 0) - cobrado - Number(o.credit_applied_usd || 0) - Number(o.discount_applied_usd || 0));
    let pagado = !!o.is_collected || saldo <= 0.005;
    if (modo === "prueba") { pagado = i % 2 === 0; saldo = pagado ? 0 : Math.round(Number(o.budget_total || 0)); }
    const dir = String(o.delivery_address || "").trim();
    const piso = sinRelleno(dc.piso ?? c.floor_apt);
    const calleBase = String(dc.direccion || dir.split(",")[0] || c.street || "").trim();
    const alturaEnPiso = !/\d/.test(calleBase) && /^\d{2,5}$/.test(piso); // "tonelero" + piso "5852"
    return {
      base: "argencargo", id: o.id, codigo: o.operation_code,
      cliente: String(c.company_name || "").trim() || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "—",
      cod_cliente: c.client_code || "",
      calle: calleYAltura(calleBase, piso),
      piso: alturaEnPiso ? "" : piso,
      localidad: String(dc.localidad || c.city || "").trim(),
      cp: String(dc.cp || cp4(dir) || c.postal_code || "").trim(),
      direccion: dir || [c.street, c.floor_apt, c.city].filter(Boolean).join(", "),
      telefono: String(dc.telefono || c.whatsapp || "").trim(),
      notas: String(dc.notas || dc.aclaracion || dc.referencia || "").trim(),
      dia: modo === "prueba" ? hoyAR() : o.delivery_day, franja: o.delivery_slot || "",
      bultos: bultos[o.id] || 0, kg: r2(kg[o.id]),
      saldo: pagado ? 0 : r2(saldo), pagado, metodo: o.payment_method_chosen || "",
      llega_con: Number(o.cash_arrival_amount) > 0 ? { monto: Number(o.cash_arrival_amount), moneda: o.cash_arrival_currency === "ARS" ? "ARS" : "USD" } : null,
      vigente: o.delivery_choice === "propio" && !o.delivery_completed_at && !["operacion_cerrada", "cancelada"].includes(o.status),
    };
  });
}

async function enviosMyBox(modo) {
  if (!hayMyBox()) return [];
  const filtro = modo?.ids ? `id=${enLista(modo.ids)}`
    : modo === "prueba" ? "delivery_choice=eq.propio&delivered_at=not.is.null&order=delivered_at.desc&limit=5"
    : "delivery_choice=eq.propio&delivered_at=is.null&status=eq.abierta&delivery_confirmed_at=not.is.null&order=delivery_day.asc.nullslast";
  const ops = filas(await mb(`/operations?${filtro}&select=${MB_SEL}`));
  if (!ops.length) return [];
  const ids = ops.map((o) => o.id);
  const [pk, pg] = await Promise.all([
    mb(`/packages?operation_id=${enLista(ids)}&select=operation_id,ingreso_usd,peso_real`),
    mb(`/finance_entries?operation_id=${enLista(ids)}&type=eq.ingreso&select=operation_id,amount`),
  ]);
  const bultos = porOp(filas(pk), () => 1);
  const kg = porOp(filas(pk), (p) => Number(p.peso_real || 0));
  const ingreso = porOp(filas(pk), (p) => Number(p.ingreso_usd || 0));
  const pagos = porOp(filas(pg), (p) => Number(p.amount || 0));
  return ops.map((o, i) => {
    const c = o.clients || {};
    // Fórmula del saldo de Operaciones de MyBox.
    let saldo = (ingreso[o.id] || 0) + Number(o.delivery_cost_usd || 0) + Number(o.extra_charge_usd || 0) + Number(o.debt_applied_usd || 0)
      - (pagos[o.id] || 0) - Number(o.credit_applied_usd || 0) - Number(o.debt_registered_usd || 0) - Number(o.discount_applied_usd || 0);
    let pagado = !!o.paid_at || saldo <= 0.005;
    if (modo === "prueba") { pagado = i % 2 === 1; saldo = pagado ? 0 : Math.round((ingreso[o.id] || 0) + Number(o.delivery_cost_usd || 0)); }
    // "Mamberti 1117 Casa, Lanus, Buenos Aires (CP 1824)": calle y piso antes de la primera coma, localidad después.
    const dir = String(o.delivery_address || "").trim();
    const corte = dir.indexOf(",");
    const antes = corte > 0 ? dir.slice(0, corte) : dir;
    const despues = corte > 0 ? dir.slice(corte + 1).replace(/\(?\s*(CP)?\s*\d{4}\s*\)?\s*$/i, "").replace(/,\s*buenos aires\s*$/i, "").trim() : "";
    const calle = calleYAltura(antes || c.direccion, "");
    return {
      base: "mybox", id: o.id, codigo: o.operation_code,
      cliente: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "—", cod_cliente: c.client_code || "",
      calle, piso: sinRelleno(dir ? antes.slice(calle.length) : c.piso_depto),
      localidad: despues || String(c.localidad || "").trim(),
      cp: cp4(dir) || String(c.codigo_postal || "").trim(),
      direccion: dir || [c.direccion, c.piso_depto, c.localidad].filter(Boolean).join(", "),
      telefono: String(o.delivery_phone || c.phone || "").trim(),
      notas: String(o.delivery_notes || "").trim(),
      dia: modo === "prueba" ? hoyAR() : o.delivery_day, franja: o.delivery_slot || "",
      bultos: bultos[o.id] || 0, kg: r2(kg[o.id]),
      saldo: pagado ? 0 : r2(saldo), pagado, metodo: o.payment_method_chosen || "",
      llega_con: null,
      vigente: o.delivery_choice === "propio" && !o.delivered_at && o.status === "abierta",
    };
  });
}

export async function cargarEnvios(modo) {
  if (modo?.ids) {
    const [a, m] = await Promise.all([
      modo.ids.argencargo?.length ? enviosArgencargo({ ids: modo.ids.argencargo }) : [],
      modo.ids.mybox?.length ? enviosMyBox({ ids: modo.ids.mybox }) : [],
    ]);
    return [...a, ...m];
  }
  const [a, m] = await Promise.all([enviosArgencargo(modo), enviosMyBox(modo)]);
  return [...a, ...m];
}

// ───────────────────────── Mapa ─────────────────────────

const enAmba = (lat, lng) => lat > -35.35 && lat < -34.15 && lng > -59.4 && lng < -57.7;
const conTope = (url, init = {}, ms = 4500) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return fetch(url, { ...init, signal: c.signal, cache: "no-store" }).finally(() => clearTimeout(t)); };

async function georef(calle, filtros) {
  const u = new URL("https://apis.datos.gob.ar/georef/api/direcciones");
  u.searchParams.set("direccion", calle);
  for (const [k, v] of Object.entries(filtros)) u.searchParams.set(k, v);
  u.searchParams.set("max", "1");
  u.searchParams.set("campos", "ubicacion.lat,ubicacion.lon");
  const j = await conTope(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const p = j?.direcciones?.[0]?.ubicacion;
  return p && p.lat != null && enAmba(p.lat, p.lon) ? { lat: p.lat, lng: p.lon, fuente: "georef" } : null;
}
async function nominatim(q) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("format", "jsonv2"); u.searchParams.set("countrycodes", "ar"); u.searchParams.set("limit", "1"); u.searchParams.set("q", q);
  const j = await conTope(u, { headers: { "User-Agent": "reparto-app/1.0" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const p = Array.isArray(j) ? j[0] : null;
  const lat = Number(p?.lat), lng = Number(p?.lon);
  return p && enAmba(lat, lng) ? { lat, lng, fuente: "osm" } : null;
}

// Dirección → punto del mapa. CABA y el conurbano salen del nomenclador oficial de calles (filtrado por
// el partido que marca el código postal); lo que no aparece ahí se busca en OpenStreetMap.
export async function ubicarDireccion({ calle, localidad, cp }) {
  if (!calle || !/\d/.test(calle)) return null;
  const caba = esCpCaba(cp) || (!cp && isCabaText(norm(localidad)));
  if (caba) {
    const g = await georef(calle, { provincia: "Ciudad Autónoma de Buenos Aires" });
    if (g) return g;
  } else {
    for (const partido of PARTIDOS[zonaDeCp(cp)] || []) {
      const g = await georef(calle, { provincia: "Buenos Aires", departamento: partido });
      if (g) return g;
    }
  }
  const loc = String(localidad || "").replace(/,?\s*buenos aires\s*$/i, "").trim();
  return nominatim([calle, caba ? "Ciudad Autónoma de Buenos Aires" : loc, caba ? "" : "Buenos Aires", "Argentina"].filter(Boolean).join(", "));
}

const claveGeo = (e) => `${norm(e.calle)}|${String(e.cp || "").trim()}|${norm(e.localidad)}`.slice(0, 180);

// Completa lat/lng/zona de cada envío. Lo ya buscado sale de reparto_geo; por pedido se buscan a lo sumo
// `tope` direcciones nuevas (el resto queda para la próxima actualización de la pantalla).
export async function ubicar(envios, tope = 6) {
  const claves = [...new Set(envios.map(claveGeo))];
  const cache = {};
  if (claves.length) {
    const r = await ac(`/reparto_geo?select=clave,lat,lng,created_at&clave=in.(${claves.map((c) => `"${c.replace(/"/g, "")}"`).map(encodeURIComponent).join(",")})`);
    for (const g of filas(r)) cache[g.clave] = g;
  }
  let nuevas = 0;
  for (const e of envios) {
    const k = claveGeo(e);
    let g = cache[k];
    // Las que no se encontraron se vuelven a intentar pasadas 12 horas.
    const vencida = g && g.lat == null && Date.now() - new Date(g.created_at).getTime() > 12 * 3600e3;
    if ((!g || vencida) && nuevas < tope) {
      nuevas++;
      const p = await ubicarDireccion(e);
      g = cache[k] = { clave: k, lat: p?.lat ?? null, lng: p?.lng ?? null, created_at: new Date().toISOString() };
      await ac("/reparto_geo?on_conflict=clave", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ clave: k, lat: g.lat, lng: g.lng, fuente: p?.fuente || "nada", created_at: g.created_at }) });
    }
    e.lat = g?.lat ?? null;
    e.lng = g?.lng ?? null;
    e.zona = zonaGrande(e);
  }
  return envios;
}

// De dónde salen los repartos: la oficina (Ajustes → dirección de la oficina).
export async function origenOficina() {
  const s = filas(await ac("/gi_settings?select=office_address,office_locality&limit=1"))[0] || {};
  const calle = s.office_address || "Virrey Loreto 2428";
  const e = { calle, localidad: s.office_locality || "Belgrano, CABA", cp: "1426" };
  await ubicar([e], 1);
  return { lat: e.lat ?? -34.5672, lng: e.lng ?? -58.4484, direccion: calle };
}

// ───────────────────────── Ruta ─────────────────────────

const rad = (g) => (g * Math.PI) / 180;
export function distanciaRecta(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}
// "13:00 a 16:00" → 780 (minutos desde las 0 h en que abre la franja); sin franja, al final.
export const inicioFranja = (f) => { const m = String(f || "").match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 9999; };

// Orden de visita: primero la franja horaria que eligió el cliente; dentro de la misma franja, siempre
// la parada más cercana a la anterior. Las que no se pudieron ubicar van al final de su franja.
export function ordenar(paradas, desde) {
  const grupos = {};
  for (const p of paradas) (grupos[inicioFranja(p.franja)] = grupos[inicioFranja(p.franja)] || []).push(p);
  const orden = [];
  let aca = desde;
  for (const k of Object.keys(grupos).map(Number).sort((a, b) => a - b)) {
    const con = grupos[k].filter((p) => p.lat != null && p.lng != null), sin = grupos[k].filter((p) => p.lat == null || p.lng == null);
    while (con.length) {
      let mejor = 0;
      if (aca) for (let i = 1; i < con.length; i++) if (distanciaRecta(aca, con[i]) < distanciaRecta(aca, con[mejor])) mejor = i;
      const [p] = con.splice(mejor, 1);
      orden.push(p);
      aca = p;
    }
    orden.push(...sin);
  }
  return orden;
}

// Recorrido por calles entre los puntos, en orden: metros y segundos de cada tramo + el dibujo para el mapa.
// Si el servicio de rutas no contesta, se estima con la línea recta (× 1,35) a 22 km/h.
export async function medir(puntos) {
  const pts = puntos.filter((p) => p && p.lat != null && p.lng != null);
  if (pts.length < 2) return { tramos: [], dibujo: pts.map((p) => [p.lat, p.lng]), metros: 0, estimado: false };
  const url = `https://router.project-osrm.org/route/v1/driving/${pts.map((p) => `${p.lng},${p.lat}`).join(";")}?overview=full&geometries=geojson&steps=false`;
  const j = await conTope(url, {}, 6000).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const ruta = j?.code === "Ok" ? j.routes?.[0] : null;
  if (ruta?.legs?.length === pts.length - 1) {
    // El servicio calcula sin tránsito: se le suma un 35 % al tiempo.
    const tramos = ruta.legs.map((l) => ({ m: Math.round(l.distance), s: Math.round(l.duration * 1.35) }));
    // El dibujo completo trae miles de puntos: se deja uno de cada tantos (a lo sumo ~500).
    const cs = ruta.geometry?.coordinates || [], paso = Math.max(1, Math.ceil(cs.length / 500));
    const dibujo = cs.filter((_, i) => i % paso === 0 || i === cs.length - 1).map(([lng, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
    return { tramos, dibujo, metros: tramos.reduce((a, t) => a + t.m, 0), estimado: false };
  }
  const tramos = pts.slice(1).map((p, i) => { const m = Math.round(distanciaRecta(pts[i], p) * 1.35); return { m, s: Math.round(m / (22000 / 3600)) }; });
  return { tramos, dibujo: pts.map((p) => [p.lat, p.lng]), metros: tramos.reduce((a, t) => a + t.m, 0), estimado: true };
}

export const nuevoToken = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
