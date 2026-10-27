// GET /api/kairo/social          (usuario de Kairo)
//   → ranking del mes entre usuarios (solo entrenamiento) + historias de las últimas 24 h.
// POST /api/kairo/social { action: "posted" }           → avisa por push a los demás que subiste una historia
// POST /api/kairo/social { action: "view", story_id }    → marca que viste una historia de otro
// POST /api/kairo/social { action: "react", story_id, emoji } → reaccionás a una historia (le llega un aviso al dueño)
// POST /api/kairo/social { action: "trained", rutina, minutos } → avisa a los demás que terminaste de entrenar (1 vez por día)
// GET /api/kairo/social?user=<id> → perfil de otro usuario: foto, objetivo, cómo viene (lectura de
//   la IA) y sus últimos entrenos. Nunca expone finanzas ni números de peso/medidas.

import { sb, arr, kairoUser } from "../../../../lib/kairo-server";

export const dynamic = "force-dynamic";

const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export async function GET(req) {
  const me = await kairoUser(req);
  if (!me) return Response.json({ error: "No autorizado" }, { status: 401 });

  const who = new URL(req.url).searchParams.get("user");
  if (who) return /^[0-9a-f-]{36}$/i.test(who) ? profileOf(who) : Response.json({ error: "No existe" }, { status: 404 });

  const people = arr(await sb(`/rest/v1/kairo_profile?select=user_id,nombre,avatar`));
  const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1), since = new Date(now.getTime() - 120 * 86400e3);
  const workouts = arr(await sb(`/rest/v1/kairo_workouts?finished_at=not.is.null&started_at=gte.${since.toISOString()}&select=user_id,routine_name,started_at,finished_at,sets:kairo_sets(weight_kg,reps)&order=started_at.desc&limit=5000`));
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
  // En las tuyas va quién las vio (los demás no lo ven).
  const mine = stories.filter(s => s.user_id === me.id);
  if (mine.length) {
    const ids = mine.map(s => s.id).join(",");
    const [views, reacts] = await Promise.all([
      arr(await sb(`/rest/v1/kairo_story_views?story_id=in.(${ids})&select=story_id,viewer_id,viewed_at&order=viewed_at.desc`)),
      arr(await sb(`/rest/v1/kairo_story_reactions?story_id=in.(${ids})&select=story_id,user_id,emoji`)),
    ]);
    for (const s of mine) s.views = views.filter(v => v.story_id === s.id).map(v => ({ id: v.viewer_id, at: v.viewed_at, emoji: reacts.find(r => r.story_id === s.id && r.user_id === v.viewer_id)?.emoji || null }));
  }
  // Tus reacciones a las de los demás (para marcar cuál elegiste).
  const others = stories.filter(s => s.user_id !== me.id);
  if (others.length) {
    const mineR = arr(await sb(`/rest/v1/kairo_story_reactions?user_id=eq.${me.id}&story_id=in.(${others.map(s => s.id).join(",")})&select=story_id,emoji`));
    for (const s of others) s.my_emoji = mineR.find(r => r.story_id === s.id)?.emoji || null;
  }
  // Actividad de la última semana: entrenos terminados de todos (sin cargas ni peso corporal).
  const weekAgo = now.getTime() - 7 * 86400e3;
  const actividad = workouts.filter(w => new Date(w.finished_at).getTime() >= weekAgo).slice(0, 20).map(w => ({
    user_id: w.user_id, rutina: w.routine_name || "Entreno", at: w.finished_at,
    minutos: Math.round((new Date(w.finished_at) - new Date(w.started_at)) / 60000), series: arr(w.sets).length,
  }));
  return Response.json({ users: rows, stories, actividad });
}

export async function POST(req) {
  const me = await kairoUser(req);
  if (!me) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { action, story_id } = body;

  if (action === "view" && story_id) {
    const [st] = arr(await sb(`/rest/v1/kairo_stories?id=eq.${story_id}&select=user_id`));
    if (st && st.user_id !== me.id) {
      const r = await sb(`/rest/v1/kairo_story_views?on_conflict=story_id,viewer_id`, { method: "POST", body: JSON.stringify({ story_id, viewer_id: me.id }), headers: { Prefer: "resolution=ignore-duplicates,return=minimal" } }).catch(e => ({ message: String(e) }));
      if (r && (r.code || r.message)) { console.error("[kairo story view]", r); return Response.json({ ok: false, error: r.message || r.code }); }
    }
    return Response.json({ ok: true });
  }

  const base = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
  const push = (user_id, title, body, tag) => fetch(`${base}/api/push/send`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET}` }, body: JSON.stringify({ user_id, portal: "kairo", strict: true, title, body, url: "/kairo?tab=hoy", tag }) }).catch(() => {});
  const myName = async () => ((arr(await sb(`/rest/v1/kairo_profile?user_id=eq.${me.id}&select=nombre`))[0]?.nombre) || "Alguien").split(" ")[0];

  if (action === "react" && story_id) {
    const emoji = String(body.emoji || "").slice(0, 4);
    const [st] = arr(await sb(`/rest/v1/kairo_stories?id=eq.${story_id}&select=user_id`));
    if (!st || st.user_id === me.id || !emoji) return Response.json({ error: "No válido" }, { status: 400 });
    const r = await sb(`/rest/v1/kairo_story_reactions?on_conflict=story_id,user_id`, { method: "POST", body: JSON.stringify({ story_id, user_id: me.id, emoji }), headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
    if (r && (r.code || r.message)) { console.error("[kairo react]", r); return Response.json({ ok: false, error: r.message || r.code }); }
    await push(st.user_id, `${await myName()} reaccionó ${emoji} a tu historia`, "Tocá para verla", `kairo-react-${story_id}`);
    return Response.json({ ok: true });
  }

  if (action === "trained") {
    // Solo el primer entreno del día avisa, para no ser pesados.
    const ar = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    const todays = arr(await sb(`/rest/v1/kairo_workouts?user_id=eq.${me.id}&finished_at=not.is.null&started_at=gte.${ar}T03:00:00Z&select=id`));
    if (todays.length > 1) return Response.json({ ok: true, sent: 0 });
    const name = await myName();
    const people = arr(await sb(`/rest/v1/kairo_profile?select=user_id&user_id=neq.${me.id}`));
    await Promise.all(people.map(p => push(p.user_id, `${name} terminó de entrenar`, `${String(body.rutina || "Entreno").slice(0, 40)}${body.minutos ? ` · ${Number(body.minutos)} min` : ""}. Mandale fuerza con una reacción.`, `kairo-trained-${me.id}`)));
    return Response.json({ ok: true, sent: people.length });
  }

  if (action === "posted") {
    // Solo si de verdad subió una en los últimos minutos (para que no se pueda usar para spamear).
    const [st] = arr(await sb(`/rest/v1/kairo_stories?user_id=eq.${me.id}&created_at=gte.${new Date(Date.now() - 5 * 60e3).toISOString()}&select=id&limit=1`));
    if (!st) return Response.json({ ok: true, sent: 0 });
    const people = arr(await sb(`/rest/v1/kairo_profile?select=user_id,nombre`));
    const name = (people.find(p => p.user_id === me.id)?.nombre || "Alguien").split(" ")[0];
    const base = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
    const others = people.filter(p => p.user_id !== me.id);
    await Promise.all(others.map(p => fetch(`${base}/api/push/send`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET}` },
      body: JSON.stringify({ user_id: p.user_id, portal: "kairo", strict: true, title: `${name} subió una historia`, body: "Tocá para verla", url: "/kairo?tab=hoy", tag: `kairo-story-${me.id}` }),
    }).catch(() => {})));
    return Response.json({ ok: true, sent: others.length });
  }
  return Response.json({ error: "Acción inválida" }, { status: 400 });
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
