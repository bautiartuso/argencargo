// Planilla compartida con el depósito de China (28/09/2026).
// GET  /api/deposito/[token] → cargas del depósito: en camino, en depósito y contenedores en viaje.
// POST /api/deposito/[token] → el depósito marca que una carga llegó (fecha + confirma el tipo de
//                              mercadería), corrige el tipo, o deshace una llegada que marcó mal.
//
// El token es el link único del depósito (maritime_warehouses.share_token), sin contraseña.
// Lo que ve el depósito: código de cliente, tracking, mercadería, valor, bultos, m³, tipo, fotos y
// lo que cobra ese depósito. Nunca nombres de clientes, tarifas de Argencargo ni ganancias.

import { costoDeposito, esperandoProveedor, llegadaSinConfirmar } from "../../../../lib/deposito";
import { limitar } from "../../../../lib/ratelimit";
import { tgNotify } from "../../../../lib/telegram";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB = process.env.SUPABASE_SERVICE_ROLE;

const sbFetch = async (path, init = {}) => {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, {
    ...init,
    cache: "no-store",
    headers: { apikey: SB, Authorization: `Bearer ${SB}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) },
  });
  const txt = await r.text();
  let parsed = null; try { parsed = JSON.parse(txt); } catch {}
  return { status: r.status, body: parsed };
};

const WH_SEL = "id,name,rotulo,origin,default_cost_per_cbm,cost_cbm_blanca,cost_cbm_negra,descuento_pct,descuento_min_cbm";
const SH_SEL = "id,shipment_code,tracking_number,product_description,status,awaiting_supplier,received_at,shipped_to_ar_at,container_id,created_at,mercaderia_tipo,tipo_confirmado_at,tipo_corregido,fotos,fotos_mercaderia,is_fragile,is_repack,llegada_marcada_por,operation_id,clients(client_code)";

async function depositoDe(token) {
  if (!token || !/^[a-z0-9]{16,64}$/i.test(token)) return null;
  const r = await sbFetch(`/maritime_warehouses?share_token=eq.${encodeURIComponent(token)}&select=${WH_SEL}&limit=1`);
  return Array.isArray(r.body) && r.body[0] ? r.body[0] : null;
}

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;

export async function GET(req, { params }) {
  const frenado = limitar(req, { clave: "deposito-get", limite: 60 });
  if (frenado) return frenado;
  const wh = await depositoDe(params.token);
  if (!wh) return Response.json({ error: "link_invalido" }, { status: 404 });

  const [shR, ctR] = await Promise.all([
    sbFetch(`/maritime_shipments?warehouse_id=eq.${wh.id}&operation_id=is.null&select=${SH_SEL}&order=created_at.asc`),
    sbFetch(`/maritime_containers?warehouse_id=eq.${wh.id}&select=id,code,status,shipping_line,departed_at,eta,transbordo_dias,transbordo_lugar&order=departed_at.asc.nullslast`),
  ]);
  const conts = Array.isArray(ctR.body) ? ctR.body : [];
  const arribados = new Set(conts.filter((c) => c.status === "arribado").map((c) => c.id));
  const enViaje = conts.filter((c) => c.status !== "arribado");
  const ships = (Array.isArray(shR.body) ? shR.body : [])
    .filter((s) => !esperandoProveedor(s))
    .filter((s) => !(s.container_id && arribados.has(s.container_id)));

  const ids = ships.map((s) => s.id);
  let pkgs = [], items = [];
  if (ids.length) {
    const lista = ids.join(",");
    const [pR, iR] = await Promise.all([
      sbFetch(`/maritime_packages?shipment_id=in.(${lista})&select=shipment_id,quantity,length_cm,width_cm,height_cm,cbm&order=bulto_number.asc`),
      sbFetch(`/maritime_items?shipment_id=in.(${lista})&select=shipment_id,description,quantity,unit_price_usd&order=sort_order.asc`),
    ]);
    pkgs = Array.isArray(pR.body) ? pR.body : [];
    items = Array.isArray(iR.body) ? iR.body : [];
  }

  const cbmDe = (id) => pkgs.filter((x) => x.shipment_id === id).reduce((a, x) => a + Number(x.cbm || 0), 0);
  // m³ de este depósito en cada contenedor: define el descuento por volumen.
  const cbmCont = {};
  ships.forEach((s) => { if (s.container_id) cbmCont[s.container_id] = (cbmCont[s.container_id] || 0) + cbmDe(s.id); });
  const cargas = ships.map((s) => {
    const p = pkgs.filter((x) => x.shipment_id === s.id);
    const it = items.filter((x) => x.shipment_id === s.id);
    const cbm = cbmDe(s.id);
    const costo = costoDeposito(wh, s.mercaderia_tipo, cbm, s.container_id ? cbmCont[s.container_id] : null);
    // "Esperando confirmación": lo que el proveedor despachó y lo que Argencargo marcó como llegado
    // pero el depósito todavía no confirmó.
    const pendiente = llegadaSinConfirmar(s);
    const etapa = s.container_id ? "contenedor" : (s.status === "proveedor" || pendiente) ? "camino" : "deposito";
    return {
      id: s.id,
      etapa,
      numero: s.shipment_code || null,
      cliente: s.clients?.client_code || null,
      tracking: s.tracking_number || null,
      mercaderia: s.product_description || null,
      valor: r2(it.reduce((a, x) => a + Number(x.unit_price_usd || 0) * Number(x.quantity || 1), 0)),
      bultos: p.reduce((a, x) => a + Number(x.quantity || 1), 0),
      cbm: r4(cbm),
      medidas: p.map((x) => ({ q: Number(x.quantity || 1), l: Number(x.length_cm || 0), w: Number(x.width_cm || 0), h: Number(x.height_cm || 0), cbm: r4(Number(x.cbm || 0)) })),
      productos: it.map((x) => ({ d: x.description || "", q: Number(x.quantity || 0), u: Number(x.unit_price_usd || 0) })),
      tipo: s.mercaderia_tipo || null,
      tipo_confirmado: !!s.tipo_confirmado_at,
      tipo_corregido: !!s.tipo_corregido,
      fotos: Array.isArray(s.fotos) ? s.fotos.filter(Boolean) : [],
      fotos_merc: Array.isArray(s.fotos_mercaderia) ? s.fotos_mercaderia.filter(Boolean) : [],
      marcado_argencargo: pendiente ? s.received_at : null,
      fragil: !!s.is_fragile,
      reenvio: !!s.is_repack,
      llego: s.received_at || null,
      llego_por_deposito: s.llegada_marcada_por === "deposito",
      contenedor: s.container_id || null,
      costo,
    };
  });

  return Response.json({
    deposito: {
      nombre: wh.name,
      rotulo: wh.rotulo || null,
      tarifa_blanca: Number(wh.cost_cbm_blanca) || Number(wh.default_cost_per_cbm) || 0,
      tarifa_negra: Number(wh.cost_cbm_negra) || Number(wh.default_cost_per_cbm) || 0,
      descuento_pct: Number(wh.descuento_pct) || 0,
      descuento_min_cbm: Number(wh.descuento_min_cbm) || 0,
    },
    // ETA a Buenos Aires con la demora del transbordo (igual que el panel y el portal).
    contenedores: enViaje.map((c) => ({ id: c.id, codigo: c.code, naviera: c.shipping_line || null, salio: c.departed_at || null, eta: c.eta ? (Number(c.transbordo_dias) > 0 ? sumarDias(c.eta, Number(c.transbordo_dias)) : c.eta) : null })),
    cargas,
  }, { headers: { "Cache-Control": "no-store" } });
}

const hoyUtc = () => new Date().toISOString().slice(0, 10);
const sumarDias = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export async function POST(req, { params }) {
  const frenado = limitar(req, { clave: "deposito-post", limite: 40 });
  if (frenado) return frenado;
  const wh = await depositoDe(params.token);
  if (!wh) return Response.json({ error: "link_invalido" }, { status: 404 });

  let body = {};
  try { body = await req.json(); } catch {}
  const { accion, id } = body || {};
  if (!id || !/^[0-9a-f-]{36}$/i.test(String(id))) return Response.json({ error: "carga_invalida" }, { status: 400 });

  const r = await sbFetch(`/maritime_shipments?id=eq.${id}&warehouse_id=eq.${wh.id}&operation_id=is.null&select=${SH_SEL}&limit=1`);
  const sh = Array.isArray(r.body) ? r.body[0] : null;
  if (!sh) return Response.json({ error: "carga_invalida" }, { status: 404 });

  const tipoNuevo = body.tipo === "blanca" || body.tipo === "negra" ? body.tipo : null;
  const ahora = new Date().toISOString();
  let patch = null;

  if (accion === "llego") {
    if (sh.container_id || !(llegadaSinConfirmar(sh) || (sh.status === "proveedor" && !esperandoProveedor(sh)))) return Response.json({ error: "estado" }, { status: 409 });
    const fecha = String(body.fecha || "");
    // China va 11 h adelante de Argentina: se acepta hasta mañana (UTC) y hasta 60 días atrás.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > sumarDias(hoyUtc(), 1) || fecha < sumarDias(hoyUtc(), -60)) return Response.json({ error: "fecha" }, { status: 400 });
    if (!tipoNuevo) return Response.json({ error: "tipo" }, { status: 400 });
    patch = {
      status: "en_deposito", received_at: fecha, shipped_to_ar_at: null,
      llegada_marcada_por: "deposito", llegada_marcada_at: ahora,
      mercaderia_tipo: tipoNuevo, tipo_confirmado_at: ahora,
      tipo_corregido: sh.tipo_corregido || (!!sh.mercaderia_tipo && sh.mercaderia_tipo !== tipoNuevo),
      updated_at: ahora,
    };
  } else if (accion === "tipo") {
    if (!tipoNuevo) return Response.json({ error: "tipo" }, { status: 400 });
    patch = {
      mercaderia_tipo: tipoNuevo, tipo_confirmado_at: ahora,
      tipo_corregido: sh.tipo_corregido || (!!sh.mercaderia_tipo && sh.mercaderia_tipo !== tipoNuevo),
      updated_at: ahora,
    };
  } else if (accion === "deshacer") {
    // Solo lo que marcó el propio depósito y todavía no subió a un contenedor.
    if (sh.status !== "en_deposito" || sh.container_id || sh.llegada_marcada_por !== "deposito") return Response.json({ error: "estado" }, { status: 409 });
    patch = { status: "proveedor", received_at: null, llegada_marcada_por: null, llegada_marcada_at: null, tipo_confirmado_at: null, updated_at: ahora };
  } else {
    return Response.json({ error: "accion" }, { status: 400 });
  }

  const u = await sbFetch(`/maritime_shipments?id=eq.${id}&warehouse_id=eq.${wh.id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (u.status >= 300 || !Array.isArray(u.body) || !u.body.length) return Response.json({ error: "no_guardado" }, { status: 500 });

  // Si el depósito dice que el tipo es otro, Bautista se entera al toque (cambia lo que cobra).
  if (tipoNuevo && sh.mercaderia_tipo && sh.mercaderia_tipo !== tipoNuevo) {
    const cod = sh.clients?.client_code || "sin cliente";
    tgNotify(`⚠️ <b>${wh.name}</b> corrigió el tipo de mercadería\n${cod} · ${sh.tracking_number || "sin tracking"}\n${sh.product_description || ""}\nLo cargamos como <b>${sh.mercaderia_tipo}</b> y el depósito dice <b>${tipoNuevo}</b>.`).catch(() => {});
  }
  return Response.json({ ok: true });
}
