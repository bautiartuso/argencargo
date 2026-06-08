// GET /api/cron/cinabrio-habits
// Cron cada minuto. Busca hábitos con notify_enabled=true cuya hora coincide con la
// hora actual en Argentina y que están programados para hoy según su frecuencia.
// Manda push a las suscripciones cinabrio del usuario.

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;

export const maxDuration = 30;
export const dynamic = "force-dynamic";

async function sb(path) {
  const r = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
  });
  return r.json();
}

async function sendPush(userId, title, body, url, tag) {
  try {
    const baseUrl = process.env.PUBLIC_BASE_URL || "https://www.argencargo.com.ar";
    await fetch(`${baseUrl}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, title, body, url, tag }),
    });
  } catch (e) {
    console.error("push send error", e);
  }
}

// --- Lógica de "¿está este hábito programado para esta fecha?" ---
// Espejo de isHabitScheduled de app/cinabrio/page.js (Lunes=0, Domingo=6).
function dowOf(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const j = d.getDay();
  return j === 0 ? 6 : j - 1;
}
function nthWeekdayOfMonth(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return Math.ceil(d.getDate() / 7);
}
function isLastWeekdayOfMonth(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() + 7 > lastDay;
}
function daysBetween(aStr, bStr) {
  const a = new Date(aStr + "T12:00:00");
  const b = new Date(bStr + "T12:00:00");
  return Math.round((a - b) / 86400000);
}
function isHabitScheduled(h, dateStr) {
  if (!h) return false;
  const type = h.frequency_type || "weekly";
  const dow = dowOf(dateStr);
  if (type === "weekly") return Boolean(h.days_of_week & (1 << dow));
  if (type === "monthly_nth_weekday") {
    if (h.monthly_weekday == null || h.monthly_nth == null) return false;
    if (dow !== h.monthly_weekday) return false;
    if (h.monthly_nth === 5) return isLastWeekdayOfMonth(dateStr);
    return nthWeekdayOfMonth(dateStr) === h.monthly_nth;
  }
  if (type === "every_n_days") {
    const n = Number(h.every_n_days || 0);
    if (n <= 0) return false;
    const start = h.start_date || (h.created_at ? String(h.created_at).slice(0, 10) : null);
    if (!start) return false;
    const diff = daysBetween(dateStr, start);
    return diff >= 0 && diff % n === 0;
  }
  return false;
}

// --- Hora actual en Argentina (UTC-3) sin necesidad de tz libraries ---
// offsetMin permite mirar al futuro/pasado. La noti se dispara 10 minutos ANTES del
// horario del hábito → al pedir "+10 min" buscamos hábitos cuya hora coincide con
// la hora actual + 10. Si el hábito está agendado a las 10:00 y son las 09:50, hace match.
function nowInAR(offsetMin = 0) {
  const utcNow = new Date();
  const arMs = utcNow.getTime() - 3 * 60 * 60 * 1000 + offsetMin * 60 * 1000;
  const ar = new Date(arMs);
  const yyyy = ar.getUTCFullYear();
  const mm = String(ar.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ar.getUTCDate()).padStart(2, "0");
  const HH = String(ar.getUTCHours()).padStart(2, "0");
  const MM = String(ar.getUTCMinutes()).padStart(2, "0");
  return { dateStr: `${yyyy}-${mm}-${dd}`, timeStr: `${HH}:${MM}` };
}

// Cuántos minutos antes del horario del hábito se manda la notificación.
const LEAD_MINUTES = 10;

export async function GET() {
  try {
    if (!SB_SERVICE) return Response.json({ ok: false, error: "no service role" }, { status: 500 });

    // Disparamos las notis con LEAD_MINUTES de anticipación. Si ahora son las 09:50,
    // buscamos hábitos cuya hora es 10:00.
    const { dateStr, timeStr } = nowInAR(LEAD_MINUTES);
    // Traigo todos los hábitos con notify_enabled + time seteado, no archivados.
    // Filtro por hora == timeStr (HH:MM exacto). El cron corre cada minuto.
    const habits = await sb(`/rest/v1/mp_habits?select=*&notify_enabled=eq.true&archived_at=is.null&time=eq.${encodeURIComponent(timeStr + ":00")}`);
    if (!Array.isArray(habits) || habits.length === 0) {
      return Response.json({ ok: true, dateStr, timeStr, matched: 0 });
    }

    // Filtrar los que están agendados HOY según su frecuencia.
    const due = habits.filter((h) => isHabitScheduled(h, dateStr));
    if (due.length === 0) {
      return Response.json({ ok: true, dateStr, timeStr, candidates: habits.length, matched: 0 });
    }

    // Para cada hábito due, mandar push a TODAS las suscripciones cinabrio.
    // mp_habits no tiene user_id (cinabrio es de un solo owner) → mandamos a todas
    // las subs con portal=cinabrio. Si en el futuro es multi-tenant, hay que sumar
    // user_id al schema y filtrar acá.
    const subs = await sb(`/rest/v1/push_subscriptions?select=user_id&portal=eq.cinabrio`);
    const userIds = Array.from(new Set((Array.isArray(subs) ? subs : []).map((s) => s.user_id).filter(Boolean)));
    if (userIds.length === 0) {
      return Response.json({ ok: true, dateStr, timeStr, matched: due.length, recipients: 0 });
    }

    let sent = 0;
    for (const h of due) {
      // Title: ícono + nombre del hábito. Si no hay ícono, usamos una campana.
      const title = `${h.icon || "🔔"}  ${h.name || "Hábito"}`;
      // Body: aviso anticipado con hora exacta y duración estimada si hay.
      const timeOnly = h.time ? String(h.time).slice(0, 5) : null;
      const bodyParts = [];
      bodyParts.push(`En ${LEAD_MINUTES} min`);
      if (timeOnly) bodyParts.push(timeOnly);
      if (h.duration_min) bodyParts.push(`${h.duration_min} min de duración`);
      const body = bodyParts.join(" · ");
      const url = "/cinabrio";
      for (const uid of userIds) {
        await sendPush(uid, title, body, url, `cinabrio-habit-${h.id}`);
        sent++;
      }
    }

    return Response.json({ ok: true, dateStr, timeStr, due: due.length, recipients: userIds.length, sent });
  } catch (e) {
    console.error("cinabrio cron error", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
