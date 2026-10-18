// GET /api/kairo/nudges   (cron de Vercel cada 30 minutos, Bearer CRON_SECRET)
// Avisos inteligentes, sin IA, hora Argentina:
//   · a tu hora habitual de entrenar, si hoy te toca y todavía no entrenaste: "Hora de entrenar Pecho"
//   · 20:30: si te faltan 25 g o más de proteína para el objetivo del día
//   · domingo 18:00: si no entrenaste en toda la semana (y la racha se corta)
import { sb, arr } from "../../../../lib/kairo-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOW = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const slot = (h, m) => `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`; // redondea a la media hora

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "No autorizado" }, { status: 401 });

  const ar = new Date(Date.now() - 3 * 3600e3);
  const hhmm = slot(ar.getUTCHours(), ar.getUTCMinutes()), date = ar.toISOString().slice(0, 10), dow = (ar.getUTCDay() + 6) % 7;
  const dayStart = `${date}T03:00:00Z`; // medianoche argentina en UTC
  const base = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
  const push = (user_id, title, body, tag, tab = "hoy") => fetch(`${base}/api/push/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id, portal: "kairo", strict: true, title, body, url: `/kairo?tab=${tab}`, tag }) }).catch(() => {});

  const people = arr(await sb(`/rest/v1/kairo_profile?select=user_id,nombre,dias,estrategia,cardio_plan,peso_kg`));
  if (!people.length) return Response.json({ ok: true, sent: 0 });
  const ids = people.map(p => p.user_id).join(",");
  const [routines, todays, recent, food] = await Promise.all([
    arr(await sb(`/rest/v1/kairo_routines?user_id=in.(${ids})&select=user_id,id,name,days`)),
    arr(await sb(`/rest/v1/kairo_workouts?user_id=in.(${ids})&finished_at=not.is.null&started_at=gte.${dayStart}&select=user_id`)),
    arr(await sb(`/rest/v1/kairo_workouts?user_id=in.(${ids})&finished_at=not.is.null&started_at=gte.${new Date(ar.getTime() - 60 * 86400e3).toISOString()}&select=user_id,started_at&order=started_at.desc&limit=3000`)),
    hhmm === "20:30" ? arr(await sb(`/rest/v1/kairo_food_log?user_id=in.(${ids})&log_date=eq.${date}&select=user_id,protein_g`)) : [],
  ]);
  let sent = 0;

  for (const p of people) {
    const mine = routines.filter(r => r.user_id === p.user_id);
    const trainedToday = todays.some(w => w.user_id === p.user_id);
    // Qué toca hoy: días fijos, o rotación.
    let due = mine.filter(r => r.days?.includes(dow));
    if (p.dias?.modo === "rotacion" && p.dias.orden?.length && p.dias.inicio) {
      const n = p.dias.orden.length, k = ((Math.round((new Date(date + "T12:00:00") - new Date(p.dias.inicio + "T12:00:00")) / 86400e3) % n) + n) % n;
      const id = p.dias.orden[k]; due = id === "descanso" ? [] : mine.filter(r => r.id === id);
    }

    // 1) Hora habitual de entrenar (mediana de la hora de inicio de los últimos entrenos, en hora Argentina).
    if (due.length && !trainedToday) {
      const hs = recent.filter(w => w.user_id === p.user_id).slice(0, 12).map(w => { const d = new Date(new Date(w.started_at).getTime() - 3 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); }).sort((a, b) => a - b);
      if (hs.length >= 3) {
        const med = hs[Math.floor(hs.length / 2)], habitual = slot(Math.floor(med / 60), med % 60);
        if (habitual === hhmm) { await push(p.user_id, `Hora de entrenar ${due[0].name}`, "Es tu horario de siempre. La rutina te espera en Físico.", `kairo-train-${date}`, "fisico"); sent++; }
      }
    }

    // 2) 20:30: proteína que falta.
    if (hhmm === "20:30" && p.estrategia?.proteina_g) {
      const eaten = food.filter(f => f.user_id === p.user_id).reduce((a, f) => a + Number(f.protein_g || 0), 0);
      const gap = Math.round(Number(p.estrategia.proteina_g) - eaten);
      if (eaten > 0 && gap >= 25) { await push(p.user_id, `Te faltan ${gap} g de proteína`, "Un yogur griego o una lata de atún y cerrás el día.", `kairo-prot-${date}`, "nutricion"); sent++; }
    }

    // 3) Domingo 18:00: semana sin entrenar.
    if (dow === 6 && hhmm === "18:00" && mine.length) {
      const weekStart = new Date(ar); weekStart.setUTCDate(weekStart.getUTCDate() - 6); weekStart.setUTCHours(3, 0, 0, 0);
      const thisWeek = recent.filter(w => w.user_id === p.user_id && new Date(w.started_at) >= weekStart).length;
      if (!thisWeek) { await push(p.user_id, "Esta semana no entrenaste", "Todavía estás a tiempo de salvar la racha con un entreno hoy.", `kairo-week-${date}`, "fisico"); sent++; }
    }
  }
  return Response.json({ ok: true, hhmm, dow: DOW[dow], sent });
}
