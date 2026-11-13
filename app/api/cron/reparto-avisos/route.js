// Cron cada 10 minutos, de 9 a 21 h de Argentina: avisos a los repartidores (13/11/2026).
// · La primera pasada del día (9 h): "Hola Leo, hoy hay N envíos programados".
// · Después: cada envío a domicilio que se coordina para hoy mismo avisa una sola vez.
// Lo que ya se avisó queda en reparto_avisos. Los repartidores de prueba no reciben estos avisos.
import { esCronValido } from "../../../../lib/auth-server";
import { ac, cargarEnvios } from "../../../../lib/reparto";
import { enviarPush, hayPush } from "../../../../lib/push-web";
import { hoyAR } from "../../../../lib/fecha-ar";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const filas = (r) => (Array.isArray(r?.body) ? r.body : []);

export async function GET(req) {
  if (!esCronValido(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!hayPush()) return Response.json({ ok: true, sin_push: true });
  const hoy = hoyAR(), hora = new Date(Date.now() - 3 * 3600e3).getUTCHours();
  if (hora < 9 || hora >= 21) return Response.json({ ok: true, fuera_de_hora: true });
  const subs = filas(await ac("/reparto_push?select=id,endpoint,p256dh,auth,repartidores!inner(nombre,token,activo,prueba)&repartidores.activo=eq.true&repartidores.prueba=eq.false"));
  if (!subs.length) return Response.json({ ok: true, suscriptos: 0 });
  const deHoy = (await cargarEnvios("pendientes")).filter((e) => e.dia === hoy);
  const claveResumen = `resumen:${hoy}`, claves = deHoy.map((e) => `envio:${e.base}:${e.id}:${hoy}`);
  const ya = new Set(filas(await ac(`/reparto_avisos?select=clave&created_at=gte.${hoy}T00:00:00-03:00`)).map((a) => a.clave));
  const resumen = !ya.has(claveResumen);
  const nuevos = deHoy.filter((_, i) => !ya.has(claves[i]));
  if (!deHoy.length || (!resumen && !nuevos.length)) {
    if (resumen) await ac("/reparto_avisos", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify([{ clave: claveResumen }]) });
    return Response.json({ ok: true, hoy: deHoy.length, enviados: 0 });
  }
  const n = resumen ? deHoy.length : nuevos.length;
  let enviados = 0;
  for (const s of subs) {
    const r = s.repartidores;
    const body = resumen
      ? `Hola ${r.nombre}, hoy hay ${n} ${n === 1 ? "envío programado" : "envíos programados"}. Entrá para ${n === 1 ? "verlo" : "verlos"}.`
      : n === 1 ? `Hola ${r.nombre}, se sumó un envío para hoy: ${[nuevos[0].localidad, nuevos[0].franja && `de ${nuevos[0].franja}`].filter(Boolean).join(", ")}.` : `Hola ${r.nombre}, se sumaron ${n} envíos para hoy. Entrá para verlos.`;
    const st = await enviarPush(s, { title: "Reparto", body, url: `/reparto/${r.token}`, tag: resumen ? "resumen" : "nuevo" });
    if (st === 404 || st === 410) await ac(`/reparto_push?id=eq.${s.id}`, { method: "DELETE" });
    else if (st >= 200 && st < 300) enviados++;
  }
  await ac("/reparto_avisos", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify([...(resumen ? [{ clave: claveResumen }] : []), ...claves.filter((c) => !ya.has(c)).map((clave) => ({ clave }))]) });
  return Response.json({ ok: true, hoy: deHoy.length, resumen, nuevos: nuevos.length, enviados });
}
