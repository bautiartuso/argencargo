// GET /api/kairo/social   (usuario de Kairo)
// Comparativa entre los usuarios de Kairo: solo entrenamiento (constancia primero, fuerza aparte).
// Nunca expone finanzas, peso ni medidas.

import { sb, arr, kairoUser } from "../../../../lib/kairo-server";

export const dynamic = "force-dynamic";

const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export async function GET(req) {
  const me = await kairoUser(req);
  if (!me) return Response.json({ error: "No autorizado" }, { status: 401 });

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
  return Response.json({ users: rows });
}
