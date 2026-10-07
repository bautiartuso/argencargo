// GET /api/portal/maritime-cargo
// Cargas marítimas del cliente logueado que todavía no son operación: las que ya están en el
// depósito de China y las que viajan en un contenedor (28/09/2026). El portal las muestra en
// "En curso" como tarjetas.
//
// Whitelist estricta. Expone: descripción, tracking, fotos (bulto y mercadería), bultos con
// medidas, m³, ETA a Buenos Aires, entrega estimada y total estimado a abonar. El número de
// contenedor SOLO si el depósito lo muestra al cliente (hoy únicamente Luna 1, el único que
// carga el número real). NUNCA expone: depósito, naviera, costos ni datos de otros clientes (el
// cliente sale del JWT, no del request).
//
// Rápido a propósito: el pedido de las cargas (con bultos, productos, contenedor y depósito
// embebidos) sale en paralelo con la verificación del cliente. Antes eran cuatro esperas en fila y
// la tarjeta aparecía varios segundos después que el resto del portal.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

async function svc(path) {
  const r = await fetch(`${SB_URL}${path}`, { headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` }, cache: "no-store" });
  return r.ok ? r.json() : null;
}

const addDays = (d, n) => {
  if (!d) return null;
  const x = new Date(d + "T12:00:00");
  x.setDate(x.getDate() + (Number(n) || 0));
  return x.toISOString().slice(0, 10);
};
const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const esTrackingReal = (t) => !!t && !/^SEA[A-Z]*$/i.test(String(t).trim());

const SHIP_SEL = [
  "id,product_description,tracking_number,status,container_id,revenue_manual,created_at,received_at,fotos,fotos_mercaderia,origin",
  "maritime_packages(bulto_number,quantity,length_cm,width_cm,height_cm,cbm)",
  "maritime_items(description,quantity,unit_price_usd)",
  "maritime_containers(id,code,status,eta,transbordo_dias,transbordo_lugar)",
  "maritime_warehouses(id,mostrar_contenedor_cliente,origin)",
].join(",");
// En depósito (sin contenedor) o viajando en un contenedor; nunca lo que todavía espera al proveedor.
const shipsDe = (cid) => svc(`/rest/v1/maritime_shipments?client_id=eq.${cid}&operation_id=is.null&or=(container_id.not.is.null,status.eq.en_deposito)&select=${SHIP_SEL}&order=created_at.asc`);

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  const tok = auth.replace(/^Bearer\s+/i, "").trim();
  if (!tok) return Response.json({ cargo: [] }, { status: 401 });
  const reqClientId = new URL(req.url).searchParams.get("client_id");
  const idOk = (v) => !!v && /^[0-9a-f-]{36}$/i.test(v);

  const user = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!user?.id) return Response.json({ cargo: [] }, { status: 401 });

  // Verificación del cliente y datos del cliente pedido, en paralelo. Si al final el que pregunta
  // no puede ver ese cliente, lo traído se descarta.
  const [cl, prof, shipsPedido, tariffs, ovsPedido] = await Promise.all([
    svc(`/rest/v1/clients?auth_user_id=eq.${user.id}&select=id&limit=1`),
    svc(`/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`),
    idOk(reqClientId) ? shipsDe(reqClientId) : Promise.resolve(null),
    svc(`/rest/v1/tariffs?service_key=eq.maritimo_b&select=id,type,min_qty,max_qty,rate`),
    idOk(reqClientId) ? svc(`/rest/v1/client_tariff_overrides?client_id=eq.${reqClientId}&select=tariff_id,custom_rate`) : Promise.resolve(null),
  ]);
  const ownClientId = Array.isArray(cl) && cl[0]?.id;
  const isAdmin = Array.isArray(prof) && prof[0]?.role === "admin";
  let clientId = ownClientId || null;
  if (idOk(reqClientId) && (isAdmin || reqClientId === ownClientId)) clientId = reqClientId;
  if (!clientId) return Response.json({ cargo: [] });

  let ships = shipsPedido, ovs = ovsPedido;
  if (clientId !== reqClientId) {
    [ships, ovs] = await Promise.all([shipsDe(clientId), svc(`/rest/v1/client_tariff_overrides?client_id=eq.${clientId}&select=tariff_id,custom_rate`)]);
  }
  // Contenedores que ya arribaron salen: esas cargas pasan a ser operación.
  const list = (Array.isArray(ships) ? ships : []).filter((s) => s.maritime_containers?.status !== "arribado");
  if (list.length === 0) return Response.json({ cargo: [] });

  // Tarifa marítimo integral por rango de m³ (+ override del cliente) y recargo por valor.
  const tList = Array.isArray(tariffs) ? tariffs : [];
  const mbRates = tList.filter((t) => t.type === "rate").map((t) => ({ id: t.id, min: Number(t.min_qty || 0), max: t.max_qty != null ? Number(t.max_qty) : Infinity, rate: Number(t.rate || 0) })).sort((a, b) => a.min - b.min);
  const mbSurch = tList.filter((t) => t.type === "surcharge").map((t) => ({ id: t.id, min: Number(t.min_qty || 0), rate: Number(t.rate || 0) })).sort((a, b) => b.min - a.min);
  const ovMap = {};
  (Array.isArray(ovs) ? ovs : []).forEach((o) => { ovMap[o.tariff_id] = Number(o.custom_rate); });
  const fleteRate = (cbm) => {
    for (const r of mbRates) { if (cbm >= r.min && cbm < r.max) return ovMap[r.id] != null ? ovMap[r.id] : r.rate; }
    const last = mbRates[mbRates.length - 1];
    return last ? (ovMap[last.id] != null ? ovMap[last.id] : last.rate) : 0;
  };
  const surchargeFor = (fob, cbm) => {
    if (!(fob > 0 && cbm > 0)) return 0;
    const vpu = fob / cbm;
    for (const s of mbSurch) { if (vpu >= s.min) { const pct = ovMap[s.id] != null ? ovMap[s.id] : s.rate; return Math.round(fob * (pct / 100) * 100) / 100; } }
    return 0;
  };

  // Una tarjeta por contenedor (esas cargas van a ser UNA operación) y una por depósito para lo
  // que todavía espera contenedor.
  const groups = {};
  list.forEach((s) => {
    const c = s.maritime_containers;
    const key = c ? `c:${c.id}` : `d:${s.maritime_warehouses?.id || "x"}`;
    if (!groups[key]) {
      const tb = c ? Number(c.transbordo_dias || 0) : 0;
      const eta = c ? (tb > 0 ? addDays(c.eta, tb) : (c.eta || null)) : null;
      groups[key] = {
        id: key,
        etapa: c ? "transito" : "deposito",
        // Origen por el depósito (Chuse Di Fiori = USA): el portal dice "salió de China/Estados Unidos".
        origen: /usa|estados|ee\.?uu/i.test(String(s.maritime_warehouses?.origin || s.origin || "")) ? "usa" : "china",
        contenedor: c && s.maritime_warehouses?.mostrar_contenedor_cliente ? (c.code || null) : null,
        eta_puerto: eta,
        entrega_estimada: addDays(eta, 14),
        transbordo: tb > 0 ? { dias: tb, lugar: c.transbordo_lugar || "Brasil" } : null,
        cargas: [], bultos: 0, cbm: 0, _fob: 0, _ships: [],
      };
    }
    const g = groups[key];
    const pk = Array.isArray(s.maritime_packages) ? [...s.maritime_packages].sort((a, b) => (a.bulto_number || 0) - (b.bulto_number || 0)) : [];
    const it = Array.isArray(s.maritime_items) ? s.maritime_items : [];
    const cbm = pk.reduce((a, p) => a + Number(p.cbm || 0), 0);
    const bultos = pk.reduce((a, p) => a + Number(p.quantity || 1), 0);
    g.cargas.push({
      id: s.id,
      descripcion: s.product_description || null,
      tracking: esTrackingReal(s.tracking_number) ? s.tracking_number : null,
      fotos: Array.isArray(s.fotos) ? s.fotos.filter(Boolean) : [],
      fotos_merc: Array.isArray(s.fotos_mercaderia) ? s.fotos_mercaderia.filter(Boolean) : [],
      productos: it.filter((x) => x.description).map((x) => ({ d: x.description, q: Number(x.quantity || 0) })),
      bultos_detalle: pk.map((p) => ({
        qty: Number(p.quantity || 1),
        dims: p.length_cm && p.width_cm && p.height_cm ? `${Number(p.length_cm)} × ${Number(p.width_cm)} × ${Number(p.height_cm)} cm` : null,
        cbm: r4(Number(p.cbm || 0)),
      })),
      bultos, cbm: r4(cbm),
      llego: s.received_at || null,
    });
    g.bultos += bultos;
    g.cbm += cbm;
    g._fob += it.reduce((a, x) => a + Number(x.unit_price_usd || 0) * Number(x.quantity || 1), 0);
    g._ships.push({ cbm, revenue_manual: s.revenue_manual != null ? Number(s.revenue_manual) : null });
  });

  // Total estimado = flete (m³ combinados × rango) + recargo por valor. Una carga con "a cobrar"
  // fijado a mano usa ese valor y el resto su parte del automático, igual que el panel admin.
  const cargo = Object.values(groups).map((g) => {
    const auto = g.cbm * fleteRate(g.cbm) + surchargeFor(g._fob, g.cbm);
    const total = r2(g._ships.reduce((acc, sh) => acc + (sh.revenue_manual != null ? sh.revenue_manual : (g.cbm > 0 ? auto * (sh.cbm / g.cbm) : 0)), 0));
    const { _fob, _ships, ...rest } = g;
    // En depósito el total no se manda: se informa recién cuando la carga sube al contenedor.
    return { ...rest, cbm: r4(g.cbm), total_estimado: g.etapa === "deposito" ? null : (total > 0 ? total : null), descriptions: g.cargas.map((c) => c.descripcion).filter(Boolean) };
  }).sort((a, b) => {
    // Primero lo que viaja (por fecha de llegada), después lo que está en depósito.
    if (a.etapa !== b.etapa) return a.etapa === "transito" ? -1 : 1;
    const ea = a.eta_puerto, eb = b.eta_puerto;
    if (!ea && !eb) return 0;
    if (!ea) return 1;
    if (!eb) return -1;
    return ea.localeCompare(eb);
  });

  return Response.json({ cargo }, { headers: { "Cache-Control": "no-store" } });
}
