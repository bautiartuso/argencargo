// /api/reparto/admin — lado del dueño de la app de reparto (13/11/2026). Solo admin.
// GET  → repartidores, viajes de los últimos 60 días con sus paradas y lo que falta cargar en algún auto.
// POST → { accion }: repartidor (alta/edición) · link (link nuevo) · km (corregir kilómetros) ·
//        pagado (viaje pagado sí/no) · rendido (la plata del viaje ya se rindió) · borrar_viaje.
import { usuarioConRol } from "../../../../lib/auth-server";
import { ac, hayMyBox, cargarEnvios, nuevoToken } from "../../../../lib/reparto";

export const dynamic = "force-dynamic";

const filas = (r) => (Array.isArray(r?.body) ? r.body : []);
const json = (o, status = 200) => Response.json(o, { status, headers: { "Cache-Control": "no-store" } });
const num = (v) => Number(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0;

async function panel() {
  const desde = new Date(Date.now() - 60 * 86400e3).toISOString().slice(0, 10);
  const [reps, viajes, envios, cargadas] = await Promise.all([
    ac("/repartidores?select=*&order=activo.desc,nombre.asc"),
    ac(`/reparto_viajes?fecha=gte.${desde}&select=id,repartidor_id,fecha,estado,km,km_manual,tarifa_km_ars,pago_ars,pagado_at,terminado_at,created_at,reparto_paradas(id,base,operation_code,orden,estado,datos,cobros,motivo,nota,resuelto_at,rendido_at)&order=created_at.desc&limit=200`),
    cargarEnvios("pendientes"),
    ac("/reparto_paradas?estado=eq.cargado&select=base,operation_id"),
  ]);
  const enAuto = new Set(filas(cargadas).map((p) => `${p.base}:${p.operation_id}`));
  return {
    ok: true,
    mybox: hayMyBox(),
    repartidores: filas(reps),
    viajes: filas(viajes).map((v) => {
      const km = Number(v.km_manual ?? v.km ?? 0);
      return { ...v, km_final: km, pago_final: v.km_manual != null ? Math.round(km * Number(v.tarifa_km_ars || 0)) : Number(v.pago_ars || 0), paradas: (v.reparto_paradas || []).sort((a, b) => a.orden - b.orden), reparto_paradas: undefined };
    }),
    sin_cargar: envios.filter((e) => !enAuto.has(`${e.base}:${e.id}`)).map((e) => ({ base: e.base, codigo: e.codigo, cliente: e.cliente, localidad: e.localidad, dia: e.dia, franja: e.franja })),
  };
}

export async function GET(req) {
  if (!(await usuarioConRol(req, ["admin"]))) return json({ error: "No autorizado" }, 401);
  return json(await panel());
}

export async function POST(req) {
  if (!(await usuarioConRol(req, ["admin"]))) return json({ error: "No autorizado" }, 401);
  const b = await req.json().catch(() => ({}));
  const error = (msg, st = 400) => json({ error: msg }, st);
  const ahora = new Date().toISOString();

  if (b.accion === "repartidor") {
    const nombre = String(b.nombre || "").trim().slice(0, 60);
    if (!nombre) return error("Falta el nombre");
    const datos = { nombre, telefono: String(b.telefono || "").trim().slice(0, 40) || null, tarifa_km_ars: Math.max(0, num(b.tarifa_km_ars)), cuenta_vuelta: !!b.cuenta_vuelta, activo: b.activo !== false, prueba: !!b.prueba };
    const r = b.id
      ? await ac(`/repartidores?id=eq.${b.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(datos) })
      : await ac("/repartidores", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...datos, token: nuevoToken() }) });
    if (!filas(r)[0]) return error("No se pudo guardar", 500);
  } else if (b.accion === "link") {
    await ac(`/repartidores?id=eq.${b.id}`, { method: "PATCH", body: JSON.stringify({ token: nuevoToken() }) });
  } else if (b.accion === "km") {
    const km = b.km === "" || b.km == null ? null : Math.max(0, Math.round(num(b.km) * 10) / 10);
    await ac(`/reparto_viajes?id=eq.${b.viaje_id}&estado=eq.terminado`, { method: "PATCH", body: JSON.stringify({ km_manual: km }) });
  } else if (b.accion === "pagado") {
    await ac(`/reparto_viajes?id=eq.${b.viaje_id}&estado=eq.terminado`, { method: "PATCH", body: JSON.stringify({ pagado_at: b.si ? ahora : null }) });
  } else if (b.accion === "rendido") {
    await ac(`/reparto_paradas?viaje_id=eq.${b.viaje_id}&cobros=not.is.null`, { method: "PATCH", body: JSON.stringify({ rendido_at: b.si === false ? null : ahora }) });
  } else if (b.accion === "borrar_viaje") {
    // Solo viajes de prueba o sin ninguna entrega hecha: lo demás es historia de plata.
    const v = filas(await ac(`/reparto_viajes?id=eq.${b.viaje_id}&select=id,repartidores(prueba),reparto_paradas(estado)`))[0];
    if (!v) return error("Ese viaje no existe", 404);
    if (!v.repartidores?.prueba && (v.reparto_paradas || []).some((p) => p.estado === "entregado")) return error("Ese viaje tiene entregas hechas");
    await ac(`/reparto_viajes?id=eq.${v.id}`, { method: "DELETE" });
  } else return error("Acción desconocida");

  return json(await panel());
}
