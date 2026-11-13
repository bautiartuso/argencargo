// /api/reparto/[token] — app de los repartidores (13/11/2026). El token es el link personal de cada uno.
// GET  → lo que hay para cargar (envíos a domicilio coordinados de Argencargo y MyBox), su viaje abierto
//        con la ruta ordenada y la plata (lo que tiene para rendir y lo que se le debe por kilómetro).
// POST → { accion }: cargar · quitar · mover · ordenar · entregar · no_entregado · terminar.
// Al entregar se marca la operación como entregada en su sistema y queda una nota con lo que cobró; el
// cobro lo registra la oficina (no se toca la plata de la operación desde acá). Los repartidores de
// prueba ven entregas ya hechas y no escriben nada en las operaciones.
import { ac, mb, hayMyBox, cargarEnvios, ubicar, origenOficina, ordenar, medir, subirFoto } from "../../../../lib/reparto";
import { hoyAR } from "../../../../lib/fecha-ar";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const filas = (r) => (Array.isArray(r?.body) ? r.body : []);
const json = (o, status = 200) => Response.json(o, { status, headers: { "Cache-Control": "no-store" } });
const EN_CAMINO = ["pendiente", "en_deposito_origen", "en_preparacion", "en_transito", "arribo_argentina", "en_aduana"];
const MOTIVOS = { no_estaba: "no había nadie", direccion: "la dirección está mal", rechazo: "no lo quiso recibir", sin_pago: "no tenía el pago", otro: "otro motivo" };

async function repartidorDe(token) {
  if (!/^[a-f0-9]{16,64}$/.test(String(token || ""))) return null;
  return filas(await ac(`/repartidores?token=eq.${token}&activo=eq.true&select=*&limit=1`))[0] || null;
}

async function viajeAbierto(rep) {
  const v = filas(await ac(`/reparto_viajes?repartidor_id=eq.${rep.id}&estado=eq.abierto&select=*&order=created_at.desc&limit=1`))[0];
  if (!v) return null;
  v.paradas = filas(await ac(`/reparto_paradas?viaje_id=eq.${v.id}&select=*&order=orden.asc,cargado_at.asc`));
  return v;
}

// Reordena lo que falta entregar (si se pide), numera las paradas y vuelve a medir el recorrido.
async function replanificar(viaje, { reordenar }) {
  const oficina = await origenOficina();
  const hechas = viaje.paradas.filter((p) => p.estado !== "cargado").sort((a, b) => String(a.resuelto_at).localeCompare(String(b.resuelto_at)));
  let faltan = viaje.paradas.filter((p) => p.estado === "cargado");
  if (reordenar) {
    const desde = [...hechas].reverse().find((p) => p.lat != null) || oficina;
    faltan = ordenar(faltan.map((p) => ({ ...p, franja: p.datos?.franja })), desde).map((p) => viaje.paradas.find((x) => x.id === p.id));
  }
  const lista = [...hechas, ...faltan];
  await Promise.all(lista.map((p, i) => (p.orden === i ? null : ac(`/reparto_paradas?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ orden: i }) }))));
  lista.forEach((p, i) => { p.orden = i; });
  const ubicadas = lista.filter((p) => p.lat != null && p.lng != null);
  const m = await medir([oficina, ...ubicadas]);
  const llegada = {};
  ubicadas.forEach((p, i) => { if (m.tramos[i]) llegada[p.id] = m.tramos[i]; });
  const ruta = { llegada, dibujo: m.dibujo, metros: m.metros, estimado: m.estimado };
  await ac(`/reparto_viajes?id=eq.${viaje.id}`, { method: "PATCH", body: JSON.stringify({ ruta }) });
  viaje.paradas = lista;
  viaje.ruta = ruta;
  return viaje;
}

// Estado al día de lo que está cargado: si el cliente pagó por transferencia mientras el auto está en la
// calle, el repartidor lo tiene que ver como pago. `cambio` avisa que la oficina la sacó del reparto.
async function alDia(viaje, rep) {
  if (!viaje || rep.prueba) return;
  const carg = viaje.paradas.filter((p) => p.estado === "cargado");
  if (!carg.length) return;
  const vivos = await cargarEnvios({ ids: { argencargo: carg.filter((p) => p.base === "argencargo").map((p) => p.operation_id), mybox: carg.filter((p) => p.base === "mybox").map((p) => p.operation_id) } });
  for (const p of carg) {
    const e = vivos.find((x) => x.base === p.base && x.id === p.operation_id);
    if (!e) continue;
    p.datos = { ...p.datos, saldo: e.saldo, pagado: e.pagado, metodo: e.metodo, telefono: e.telefono || p.datos.telefono, llega_con: e.llega_con, franja: e.franja || p.datos.franja };
    p.cambio = !e.vigente;
  }
}

const sumaRendir = (paradas) => {
  const t = { USD: 0, ARS: 0 };
  for (const p of paradas) if (!p.rendido_at) for (const c of p.cobros || []) if (c.metodo === "efectivo") t[c.moneda === "ARS" ? "ARS" : "USD"] += Number(c.monto || 0);
  return t;
};

async function estado(rep) {
  const viaje = await viajeAbierto(rep);
  const [envios, cargadas, viejos] = await Promise.all([
    cargarEnvios(rep.prueba ? "prueba" : "pendientes"),
    ac(`/reparto_paradas?estado=eq.cargado&select=base,operation_id`),
    ac(`/reparto_viajes?repartidor_id=eq.${rep.id}&estado=eq.terminado&select=id,fecha,km,km_manual,tarifa_km_ars,pago_ars,pagado_at,reparto_paradas(estado,cobros,rendido_at)&order=terminado_at.desc&limit=30`),
  ]);
  const enAuto = new Set(filas(cargadas).map((p) => `${p.base}:${p.operation_id}`));
  // En prueba, lo que ya pasó por el viaje abierto no vuelve a ofrecerse.
  if (rep.prueba) for (const p of viaje?.paradas || []) enAuto.add(`${p.base}:${p.operation_id}`);
  const pendientes = await ubicar(envios.filter((e) => !enAuto.has(`${e.base}:${e.id}`)));
  // Intentos anteriores que no se pudieron entregar.
  if (pendientes.length && !rep.prueba) {
    const fall = filas(await ac(`/reparto_paradas?estado=eq.no_entregado&operation_id=in.(${pendientes.map((e) => e.id).join(",")})&select=operation_id,motivo,resuelto_at&order=resuelto_at.desc`));
    for (const e of pendientes) { const f = fall.find((x) => x.operation_id === e.id); if (f) e.intento = { motivo: MOTIVOS[f.motivo] || f.motivo, fecha: f.resuelto_at }; }
  }
  await alDia(viaje, rep);
  const terminados = filas(viejos);
  const rendir = sumaRendir([...(viaje?.paradas || []), ...terminados.flatMap((v) => v.reparto_paradas || [])]);
  return {
    ok: true,
    hoy: hoyAR(),
    repartidor: { nombre: rep.nombre, tarifa_km_ars: Number(rep.tarifa_km_ars || 0), prueba: !!rep.prueba },
    oficina: await origenOficina(),
    mybox: hayMyBox(),
    pendientes,
    viaje: viaje ? { id: viaje.id, fecha: viaje.fecha, ruta: viaje.ruta || null, paradas: viaje.paradas.map((p) => ({ id: p.id, base: p.base, codigo: p.operation_code, orden: p.orden, estado: p.estado, lat: p.lat, lng: p.lng, datos: p.datos, cobros: p.cobros, motivo: p.motivo, resuelto_at: p.resuelto_at, foto: !!p.foto_path, cambio: !!p.cambio })) } : null,
    plata: {
      rendir,
      viajes: terminados.map((v) => {
        const km = Number(v.km_manual ?? v.km ?? 0);
        return { id: v.id, fecha: v.fecha, km, pago: v.km_manual != null ? Math.round(km * Number(v.tarifa_km_ars || 0)) : Number(v.pago_ars || 0), pagado: !!v.pagado_at, entregas: (v.reparto_paradas || []).filter((p) => p.estado === "entregado").length };
      }),
    },
  };
}

export async function GET(_req, { params }) {
  const rep = await repartidorDe(params.token);
  if (!rep) return json({ error: "link_invalido" }, 404);
  return json(await estado(rep));
}

export async function POST(req, { params }) {
  const rep = await repartidorDe(params.token);
  if (!rep) return json({ error: "link_invalido" }, 404);
  const b = await req.json().catch(() => ({}));
  const error = (msg, st = 400) => json({ error: msg }, st);
  let viaje = await viajeAbierto(rep);
  const parada = () => viaje?.paradas.find((p) => p.id === b.parada_id && p.estado === "cargado");

  if (b.accion === "cargar") {
    const pedidos = (Array.isArray(b.items) ? b.items : []).map((i) => `${i.base}:${i.id}`);
    if (!pedidos.length) return error("Elegí qué cargaste");
    const envios = (await cargarEnvios(rep.prueba ? "prueba" : "pendientes")).filter((e) => pedidos.includes(`${e.base}:${e.id}`));
    if (!envios.length) return error("Esos envíos ya no están para repartir");
    await ubicar(envios, 12);
    if (!viaje) {
      const nuevo = await ac("/reparto_viajes", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ repartidor_id: rep.id, fecha: hoyAR() }) });
      viaje = filas(nuevo)[0];
      if (!viaje) return error("No se pudo abrir el viaje", 500);
      viaje.paradas = [];
    }
    let ocupados = 0;
    for (const e of envios) {
      const { lat, lng, id, base, codigo, vigente, ...datos } = e;
      const ins = await ac("/reparto_paradas", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ viaje_id: viaje.id, base, operation_id: id, operation_code: codigo, orden: 999, datos, lat, lng }) });
      if (filas(ins)[0]) viaje.paradas.push(filas(ins)[0]); else ocupados++;
    }
    if (!viaje.paradas.length) { await ac(`/reparto_viajes?id=eq.${viaje.id}`, { method: "DELETE" }); return error("Ya los cargó otro repartidor", 409); }
    await replanificar(viaje, { reordenar: true });
    return json({ ...(await estado(rep)), aviso: ocupados ? `${ocupados} ya ${ocupados === 1 ? "lo" : "los"} había cargado otro repartidor` : null });
  }

  if (!viaje) return error("No tenés un viaje abierto");

  if (b.accion === "quitar") {
    const p = parada();
    if (!p) return error("Esa parada ya no está");
    await ac(`/reparto_paradas?id=eq.${p.id}`, { method: "DELETE" });
    viaje.paradas = viaje.paradas.filter((x) => x.id !== p.id);
    if (!viaje.paradas.length) await ac(`/reparto_viajes?id=eq.${viaje.id}`, { method: "DELETE" });
    else await replanificar(viaje, { reordenar: true });
    return json(await estado(rep));
  }

  if (b.accion === "mover") {
    const faltan = viaje.paradas.filter((p) => p.estado === "cargado");
    const i = faltan.findIndex((p) => p.id === b.parada_id), j = i + (b.hacia === "arriba" ? -1 : 1);
    if (i < 0 || j < 0 || j >= faltan.length) return json(await estado(rep));
    [faltan[i], faltan[j]] = [faltan[j], faltan[i]];
    viaje.paradas = [...viaje.paradas.filter((p) => p.estado !== "cargado"), ...faltan];
    faltan.forEach((p) => { p.orden = -1; }); // fuerza a renumerar
    await replanificar(viaje, { reordenar: false });
    return json(await estado(rep));
  }

  if (b.accion === "ordenar") {
    await replanificar(viaje, { reordenar: true });
    return json(await estado(rep));
  }

  if (b.accion === "entregar" || b.accion === "no_entregado") {
    const p = parada();
    if (!p) return error("Esa parada ya no está");
    await alDia(viaje, rep);
    const ahora = new Date().toISOString();
    const entregado = b.accion === "entregar";
    const cobros = entregado ? (Array.isArray(b.cobros) ? b.cobros : []).map((c) => ({ monto: Math.round(Number(String(c.monto).replace(",", ".")) * 100) / 100, moneda: c.moneda === "ARS" ? "ARS" : "USD", metodo: "efectivo" })).filter((c) => c.monto > 0).slice(0, 4) : [];
    const motivo = entregado ? null : MOTIVOS[b.motivo] ? b.motivo : "otro";
    const nota = String(b.nota || "").trim().slice(0, 300) || null;
    const foto_path = entregado && b.foto ? await subirFoto(`${viaje.id}/${p.id}.jpg`, b.foto) : null;
    const upd = await ac(`/reparto_paradas?id=eq.${p.id}&estado=eq.cargado`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ estado: entregado ? "entregado" : "no_entregado", cobros: cobros.length ? cobros : null, motivo, nota, resuelto_at: ahora, datos: p.datos, foto_path }) });
    if (!filas(upd)[0]) return error("No se pudo guardar", 500);
    Object.assign(p, filas(upd)[0]);
    if (!rep.prueba) {
      const cobroTxt = cobros.length ? `Cobró en efectivo ${cobros.map((c) => `${c.moneda} ${c.monto.toLocaleString("es-AR")}`).join(" + ")}` : p.datos?.pagado ? "Ya estaba paga" : "No cobró nada";
      if (p.base === "argencargo") {
        if (entregado) {
          const op = filas(await ac(`/operations?id=eq.${p.operation_id}&select=status,delivered_at,delivery_completed_at`))[0];
          if (op && !op.delivery_completed_at) await ac(`/operations?id=eq.${p.operation_id}`, { method: "PATCH", body: JSON.stringify({ delivery_completed_at: ahora, ...(EN_CAMINO.includes(op.status) ? { status: "entregada", delivered_at: op.delivered_at || ahora } : {}) }) });
        }
        await ac("/op_communications", { method: "POST", body: JSON.stringify({ operation_id: p.operation_id, type: "note", direction: "in", content: entregado ? `🚚 ${rep.nombre} entregó el envío.\n${cobroTxt}${foto_path ? "\nCon foto de la entrega (Admin → Reparto)" : ""}${nota ? `\nNota: ${nota}` : ""}` : `🚚 ${rep.nombre} no pudo entregar: ${MOTIVOS[motivo]}${nota ? `\nNota: ${nota}` : ""}` }) });
      } else if (entregado) {
        const op = filas(await mb(`/operations?id=eq.${p.operation_id}&select=paid_at,delivered_at`))[0];
        if (op && !op.delivered_at) await mb(`/operations?id=eq.${p.operation_id}`, { method: "PATCH", body: JSON.stringify({ delivered_at: ahora, ...(op.paid_at ? { status: "cerrada" } : {}) }) });
      }
    }
    await replanificar(viaje, { reordenar: false });
    return json(await estado(rep));
  }

  if (b.accion === "terminar") {
    const faltan = viaje.paradas.filter((p) => p.estado === "cargado").length;
    if (faltan) return error(`Te ${faltan === 1 ? "queda 1 parada" : `quedan ${faltan} paradas`} sin resolver`);
    const oficina = await origenOficina();
    const visitadas = viaje.paradas.filter((p) => p.lat != null).sort((a, b2) => String(a.resuelto_at).localeCompare(String(b2.resuelto_at)));
    const m = await medir([oficina, ...visitadas, ...(rep.cuenta_vuelta ? [oficina] : [])]);
    const km = Math.round(m.metros / 100) / 10;
    const tarifa = Number(rep.tarifa_km_ars || 0);
    await ac(`/reparto_viajes?id=eq.${viaje.id}`, { method: "PATCH", body: JSON.stringify({ estado: "terminado", km, tarifa_km_ars: tarifa, pago_ars: Math.round(km * tarifa), terminado_at: new Date().toISOString() }) });
    return json({ ...(await estado(rep)), cierre: { km, pago: Math.round(km * tarifa) } });
  }

  return error("Acción desconocida");
}
