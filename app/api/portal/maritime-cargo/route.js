// GET /api/portal/maritime-cargo
// Cargas marítimas del cliente logueado que YA están asignadas a un contenedor
// pero TODAVÍA no se convirtieron en operación. Le permite al cliente ver su carga
// "en camino" antes de que exista la op.
//
// Whitelist estricta. Expone SOLO: descripción, estado, cantidad de bultos,
// ETA puerto Buenos Aires y entrega estimada (ETA + 2 semanas).
// NUNCA expone: número/código de contenedor, naviera, tracking, costos,
// ni datos de otros clientes (se resuelve el cliente desde el JWT, no del request).

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

async function svc(path) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  return r.ok ? r.json() : null;
}

const addDays = (d, n) => {
  if (!d) return null;
  const x = new Date(d + "T12:00:00");
  x.setDate(x.getDate() + (Number(n) || 0));
  return x.toISOString().slice(0, 10);
};
const plus14 = (d) => addDays(d, 14);

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const tok = auth.replace(/^Bearer\s+/i, "").trim();
  if (!tok) return Response.json({ cargo: [] }, { status: 401 });
  const reqClientId = new URL(req.url).searchParams.get("client_id");

  // Verificar el JWT → user id.
  const user = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` },
  }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!user?.id) return Response.json({ cargo: [] }, { status: 401 });

  // Cliente propio (login real de cliente).
  const cl = await svc(`/rest/v1/clients?auth_user_id=eq.${user.id}&select=id&limit=1`);
  const ownClientId = Array.isArray(cl) && cl[0]?.id;
  // ¿El que pregunta es admin? (para el modo preview del portal, donde el token es de admin).
  const prof = await svc(`/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`);
  const isAdmin = Array.isArray(prof) && prof[0]?.role === "admin";

  // Cliente efectivo: el propio (cliente real), o el pedido por un admin en preview.
  // Nunca dejamos que un cliente pida los datos de otro.
  let clientId = ownClientId || null;
  if (reqClientId && (isAdmin || reqClientId === ownClientId)) clientId = reqClientId;
  if (!clientId) return Response.json({ cargo: [] });

  // Cargas del cliente que están en un contenedor y todavía no son operación.
  const ships = await svc(`/rest/v1/maritime_shipments?client_id=eq.${clientId}&operation_id=is.null&container_id=not.is.null&select=id,product_description,status,container_id&order=created_at.desc`);
  const list = Array.isArray(ships) ? ships : [];
  if (list.length === 0) return Response.json({ cargo: [] });

  // Contenedores (solo eta + status — NUNCA code ni shipping_line).
  const contIds = [...new Set(list.map(s => s.container_id).filter(Boolean))];
  const conts = contIds.length ? await svc(`/rest/v1/maritime_containers?id=in.(${contIds.join(",")})&select=id,eta,status,transbordo_dias,transbordo_lugar`) : [];
  const contMap = {};
  (Array.isArray(conts) ? conts : []).forEach(c => { contMap[c.id] = c; });

  // Bultos + CBM por carga.
  const shipIds = list.map(s => s.id);
  const pkgs = await svc(`/rest/v1/maritime_packages?shipment_id=in.(${shipIds.join(",")})&select=shipment_id,quantity,cbm`);
  const bultos = {}, cbmByShip = {};
  (Array.isArray(pkgs) ? pkgs : []).forEach(p => {
    bultos[p.shipment_id] = (bultos[p.shipment_id] || 0) + Number(p.quantity || 1);
    cbmByShip[p.shipment_id] = (cbmByShip[p.shipment_id] || 0) + Number(p.cbm || 0);
  });

  // FOB por carga (para el recargo por valor) + tarifas marítimas + overrides del cliente,
  // para estimar el total a abonar (mismo criterio que el panel admin).
  const its = await svc(`/rest/v1/maritime_items?shipment_id=in.(${shipIds.join(",")})&select=shipment_id,unit_price_usd,quantity`);
  const fobByShip = {};
  (Array.isArray(its) ? its : []).forEach(it => { fobByShip[it.shipment_id] = (fobByShip[it.shipment_id] || 0) + Number(it.unit_price_usd || 0) * Number(it.quantity || 1); });
  const tariffs = await svc(`/rest/v1/tariffs?service_key=eq.maritimo_b&select=id,type,min_qty,max_qty,rate`);
  const ovs = await svc(`/rest/v1/client_tariff_overrides?client_id=eq.${clientId}&select=tariff_id,custom_rate`);
  const tList = Array.isArray(tariffs) ? tariffs : [];
  const mbRates = tList.filter(t => t.type === "rate").map(t => ({ id: t.id, min: Number(t.min_qty || 0), max: t.max_qty != null ? Number(t.max_qty) : Infinity, rate: Number(t.rate || 0) })).sort((a, b) => a.min - b.min);
  const mbSurch = tList.filter(t => t.type === "surcharge").map(t => ({ min: Number(t.min_qty || 0), rate: Number(t.rate || 0) })).sort((a, b) => b.min - a.min);
  const ovMap = {};
  (Array.isArray(ovs) ? ovs : []).forEach(o => { ovMap[o.tariff_id] = Number(o.custom_rate); });
  const fleteRate = (cbm) => {
    for (const r of mbRates) { if (cbm >= r.min && cbm < r.max) return ovMap[r.id] != null ? ovMap[r.id] : r.rate; }
    const last = mbRates[mbRates.length - 1];
    return last ? (ovMap[last.id] != null ? ovMap[last.id] : last.rate) : 0;
  };
  const surchargeFor = (fob, cbm) => {
    if (!(fob > 0 && cbm > 0)) return 0;
    const vpu = fob / cbm;
    for (const s of mbSurch) { if (vpu >= s.min) return Math.round(fob * (s.rate / 100) * 100) / 100; }
    return 0;
  };

  // Agrupar por contenedor: todas las cargas del cliente en un mismo contenedor son
  // UNA sola operación futura → una sola tarjeta. Distinto contenedor → tarjetas separadas.
  const groups = {};
  list.forEach(s => {
    const cid = s.container_id;
    if (!groups[cid]) {
      const c = contMap[cid] || {};
      const tbDias = Number(c.transbordo_dias || 0);
      // ETA efectiva = ETA a puerto + demora por transbordo. La entrega = ETA efectiva + 2 semanas.
      const eEta = tbDias > 0 ? addDays(c.eta, tbDias) : (c.eta || null);
      groups[cid] = {
        id: cid,
        descriptions: [],
        bultos: 0,
        _cbm: 0,
        _fob: 0,
        container_status: c.status || null,       // en_transito | arribado
        eta_puerto: eEta,
        entrega_estimada: plus14(eEta),
        transbordo: tbDias > 0 ? { dias: tbDias, lugar: c.transbordo_lugar || "Brasil" } : null,
      };
    }
    if (s.product_description) groups[cid].descriptions.push(s.product_description);
    groups[cid].bultos += (bultos[s.id] || 0);
    groups[cid]._cbm += (cbmByShip[s.id] || 0);
    groups[cid]._fob += (fobByShip[s.id] || 0);
  });

  // Total a abonar estimado por contenedor = flete (CBM combinado × rango) + recargo por valor.
  const cargo = Object.values(groups).map(g => {
    const flete = g._cbm * fleteRate(g._cbm);
    const total = Math.round((flete + surchargeFor(g._fob, g._cbm)) * 100) / 100;
    const { _cbm, _fob, ...rest } = g;
    return { ...rest, total_estimado: total > 0 ? total : null };
  }).sort((a, b) => {
    // Orden por fecha de llegada (ETA a puerto) ascendente; sin ETA al final.
    const ea = a.eta_puerto, eb = b.eta_puerto;
    if (!ea && !eb) return 0;
    if (!ea) return 1;
    if (!eb) return -1;
    return ea.localeCompare(eb);
  });

  return Response.json({ cargo });
}
