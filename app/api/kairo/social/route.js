// GET /api/kairo/social          (usuario de Kairo)
//   → ranking del mes entre usuarios (solo entrenamiento) + historias de las últimas 24 h.
// GET /api/kairo/social?user=<id> → perfil de otro usuario: foto, objetivo, cómo viene (lectura de
//   la IA) y sus últimos entrenos. Nunca expone finanzas ni números de peso/medidas.

import { sb, arr, kairoUser } from "../../../../lib/kairo-server";

export const dynamic = "force-dynamic";

const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export async function GET(req) {
  const me = await kairoUser(req);
  if (!me) return Response.json({ error: "No autorizado" }, { status: 401 });

  const who = new URL(req.url).searchParams.get("user");
  if (who) return profileOf(who);

  const people = arr(await sb(`/rest/v1/kairo_profile?select=user_id,nombre,avatar`));
  const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1), since = new Date(now.getTime() - 120 * 86400e3);
  const workouts = arr(await sb(`/rest/v1/kairo_workouts?finished_at=not.is.null&started_at=gte.${since.toISOString()}&select=user_id,started_at,finished_at,sets:kairo_sets(weight_kg,reps)&order=started_at.desc&limit=5000`));
  const week = mondayOf(now);

  const rows = people.map(p => {
    const mine = workouts.filter(w => w.user_id === p.user_id);
    const month = mine.filter(w => new Date(w.started_at) >= monthStart);
    let streak = 0;
    for (let k = 0; k < 17; k++) {
      const s = new Date(week); s.setDate(s.getDate() - k * 7); const e = new Date(s); e.setDate(e.getDate() + 7);
      if (mine.some(w => { const d = new Date(w.started_at); return d >= s && d < e; })) streak++; else if (k > 0) break;
    }
    return {
      id: p.user_id, me: p.user_id === me.id, nombre: p.nombre || "Sin nombre", avatar: p.avatar || null,
      entrenos_mes: month.length,
      entrenos_semana: mine.filter(w => new Date(w.started_at) >= week).length,
      minutos_mes: Math.round(month.reduce((a, w) => a + (new Date(w.finished_at) - new Date(w.started_at)) / 60000, 0)),
      volumen_mes: Math.round(month.reduce((a, w) => a + arr(w.sets).reduce((b, s) => b + Number(s.weight_kg) * s.reps, 0), 0)),
      racha_semanas: streak,
      ultimo: mine[0]?.started_at || null,
    };
  }).sort((a, b) => b.entrenos_mes - a.entrenos_mes || b.racha_semanas - a.racha_semanas || b.minutos_mes - a.minutos_mes);
  // Historias: las de 24 h (sin la imagen, que se pide al abrirla) y limpieza de las de más de 2 días.
  sb(`/rest/v1/kairo_stories?created_at=lt.${new Date(now.getTime() - 48 * 3600e3).toISOString()}`, { method: "DELETE" }).catch(() => {});
  const stories = arr(await sb(`/rest/v1/kairo_stories?created_at=gte.${new Date(now.getTime() - 24 * 3600e3).toISOString()}&select=id,user_id,thumb,caption,created_at&order=created_at.asc`));
  return Response.json({ users: rows, stories });
}

const OBJ = { volumen: "Volumen", definicion: "Definición", recomposicion: "Recomposición", mantenimiento: "Mantenimiento", fuerza: "Fuerza" };
async function profileOf(id) {
  const [p] = arr(await sb(`/rest/v1/kairo_profile?user_id=eq.${id}&select=user_id,nombre,avatar,objetivo,tendencia,objetivo_detalle,estrategia,estrategia_at`));
  if (!p) return Response.json({ error: "No existe" }, { status: 404 });
  const since = new Date(Date.now() - 120 * 86400e3).toISOString();
  const ws = arr(await sb(`/rest/v1/kairo_workouts?user_id=eq.${id}&finished_at=not.is.null&started_at=gte.${since}&select=routine_name,started_at,finished_at,sets:kairo_sets(weight_kg,reps)&order=started_at.desc&limit=200`));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const week = mondayOf(new Date());
  let streak = 0;
  for (let k = 0; k < 17; k++) {
    const s = new Date(week); s.setDate(s.getDate() - k * 7); const e = new Date(s); e.setDate(e.getDate() + 7);
    if (ws.some(w => { const d = new Date(w.started_at); return d >= s && d < e; })) streak++; else if (k > 0) break;
  }
  const prog = p.estrategia?.progreso;
  return Response.json({
    profile: {
      id: p.user_id, nombre: p.nombre || "Sin nombre", avatar: p.avatar || null,
      objetivo: OBJ[p.objetivo] || null, tendencia: p.tendencia || null, objetivo_detalle: p.objetivo_detalle || null,
      progreso: prog ? { estado: prog.estado, lectura: prog.lectura } : null,
      entrenos_mes: ws.filter(w => new Date(w.started_at) >= monthStart).length, racha_semanas: streak,
      ultimos: ws.slice(0, 8).map(w => ({ rutina: w.routine_name || "Entreno", fecha: w.started_at, minutos: Math.round((new Date(w.finished_at) - new Date(w.started_at)) / 60000), series: arr(w.sets).length, volumen: Math.round(arr(w.sets).reduce((a, s) => a + Number(s.weight_kg) * s.reps, 0)) })),
    },
  });
}
