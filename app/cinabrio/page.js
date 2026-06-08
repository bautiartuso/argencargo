"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { dq, loadSession, clearSession, ac, saveSession } from "../../lib/sb-client";

// ──────────────────────────────────────────────────────────────────────
// CINABRIO · 2 secciones (Hábitos / Finanzas) separadas por un toggle.
// Sin header bar. Estética negro + rojo + dorado cálido. Inter weights.
// Modales/toasts in-app, cero diálogos nativos.
// ──────────────────────────────────────────────────────────────────────

const T = {
  bgBase: "#0A0606",
  bgSurface: "#16100E",
  bgSurfaceHi: "#1F1815",
  bgSurfaceHi2: "#2A1F1B",
  border: "#2A1F1B",
  borderHi: "#3D2D26",
  red: "#C8102E",
  redDeep: "#8E0820",
  redSoft: "rgba(200,16,46,0.12)",
  gold: "#C8941B",
  goldHi: "#E0A832",
  goldDeep: "#8A5F1B",
  goldGlow: "0 0 14px rgba(200,148,27,0.45)",
  textPrimary: "#F8EFDE",
  textSecondary: "rgba(248,239,222,0.82)",
  textMuted: "rgba(248,239,222,0.58)",
  success: "#7FB069",
  danger: "#E8514B",
};

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAYS_SHORT_FULL = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

// Fecha local (no UTC) — toISOString() devuelve UTC y a las 21+ en AR ya cambiaba de día.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayStr = () => ymd(new Date());
const dowOf = (date) => { const d = new Date(date + "T12:00:00").getDay(); return d === 0 ? 6 : d - 1; };
const todayDow = () => dowOf(todayStr());

// ¿En qué número de ocurrencia del día-de-la-semana está esta fecha dentro del mes?
// Ej: el 3er sábado de junio devuelve 3. El 1er domingo de julio devuelve 1.
function nthWeekdayOfMonth(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return Math.ceil(d.getDate() / 7);
}
// ¿Es la última ocurrencia de ese día-de-la-semana del mes?
function isLastWeekdayOfMonth(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() + 7 > lastDay;
}
// Días enteros entre dos fechas (a partir de b). Positivo si a > b.
function daysBetween(aStr, bStr) {
  const a = new Date(aStr + "T12:00:00");
  const b = new Date(bStr + "T12:00:00");
  return Math.round((a - b) / 86400000);
}

// Asegura que el dispositivo tenga registrado el service worker de cinabrio
// y una suscripción Web Push válida persistida en la DB. Devuelve true si OK.
async function ensureCinabrioPush(token) {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;
  const VAPID_PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  if (!VAPID_PUB) { console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY no seteado"); return false; }
  try {
    // 1. Permiso del usuario
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
    // 2. Registrar SW
    const reg = await navigator.serviceWorker.register("/sw-cinabrio.js", { scope: "/cinabrio" });
    await navigator.serviceWorker.ready;
    // 3. Suscribir (si no hay suscripción todavía)
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const urlBase64ToUint8Array = (b64) => {
        const pad = "=".repeat((4 - b64.length % 4) % 4);
        const s = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(s);
        const out = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
      };
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUB) });
    }
    // 4. Persistir en DB (portal='cinabrio')
    if (token) {
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub.toJSON(), portal: "cinabrio" }),
      });
    }
    return true;
  } catch (e) {
    console.error("ensureCinabrioPush error", e);
    return false;
  }
}

// Lógica central: ¿este hábito está programado para esta fecha?
// Tres modos:
//   weekly                → bitmask days_of_week (default histórico).
//   monthly_nth_weekday   → "1er/2do/3er/4to/último <weekday> del mes" (nth=5 significa "último").
//   every_n_days          → cada N días desde start_date (inclusive).
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
const monthStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (mm) => { const [y, m] = mm.split("-").map(Number); return new Date(y, m - 1, 15).toLocaleDateString("es-AR", { month: "long", year: "numeric" }).replace(/^./, c => c.toUpperCase()); };
const fmtArs = (n) => `ARS ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtUsd = (n) => `USD ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Helpers semana
function startOfWeek(date) {
  const d = new Date(date + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return ymd(d);
}
function weekDates(startStr) {
  const d = new Date(startStr + "T12:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + i);
    return ymd(x);
  });
}
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); }

// Mantiene una fecha/mes "vivo": cuando la pestaña vuelve a estar visible o pasa medianoche,
// vuelve a sincronizar al día/mes real (evita que la PWA quede en un mes viejo).
function useLiveNow() {
  const [nowDate, setNowDate] = useState(() => todayStr());
  useEffect(() => {
    const tick = () => setNowDate(todayStr());
    tick();
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", tick);
    const id = setInterval(tick, 60000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", tick);
      clearInterval(id);
    };
  }, []);
  return nowDate;
}

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:${T.bgBase};color:${T.textPrimary};font-feature-settings:'cv11','ss03';-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
  body{min-height:100vh}
  ::selection{background:${T.gold}55;color:${T.textPrimary}}
  ::-webkit-scrollbar{width:8px;height:8px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
  ::-webkit-scrollbar-thumb:hover{background:${T.borderHi}}
  button{font-family:inherit;-webkit-tap-highlight-color:transparent}
  input,textarea,select{font-family:inherit;font-size:16px}
  @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  @keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .cnb-page{padding:6px max(14px, env(safe-area-inset-right)) max(80px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));max-width:1280px;margin:0 auto}
  .cnb-header{padding:calc(env(safe-area-inset-top) + 10px) max(14px, env(safe-area-inset-right)) 8px max(14px, env(safe-area-inset-left));display:flex;justify-content:center;align-items:center;position:relative;z-index:5}
  .cnb-toggle-pill{padding:10px 20px}
  @media (min-width: 720px){
    .cnb-page{padding:14px 24px 80px}
    .cnb-header{padding:calc(env(safe-area-inset-top) + 22px) 24px 12px}
    .cnb-toggle-pill{padding:9px 24px}
  }
  .cnb-row{display:flex;align-items:center;gap:12px;padding:13px 14px;flex-wrap:wrap}
  .cnb-row-main{display:flex;align-items:center;gap:12px;flex:1;min-width:0}
  .cnb-row-tail{display:flex;align-items:center;gap:6px;margin-left:auto}
  .cnb-grid-stats{display:grid;grid-template-columns:1fr;gap:10px}
  @media (min-width: 560px){.cnb-grid-stats{grid-template-columns:repeat(3,1fr)}}
  .cnb-section-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .cnb-section-bar::-webkit-scrollbar{display:none}
  .cnb-card{padding:16px}
  @media (min-width: 720px){.cnb-card{padding:20px 22px}}
`;

// ─────── Root ───────
export default function CinabrioPage() {
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const s = loadSession();
    if (s?.token && s?.profile?.role === "admin") setSession(s);
    setRestoring(false);
  }, []);

  if (restoring) return <div style={{ background: T.bgBase, minHeight: "100vh" }} />;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <Toaster />
      {!session ? <Login onLogin={s => setSession(s)} /> : <App session={session} onLogout={() => { clearSession(); setSession(null); }} />}
    </>
  );
}

// ─────── Login ───────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [lo, setLo] = useState(false);

  const submit = async () => {
    setLo(true); setErr("");
    try {
      const r = await ac("token?grant_type=password", { email, password: pw });
      if (r.error) { setErr(r.error_description || "Credenciales inválidas"); setLo(false); return; }
      const p = await dq("profiles", { token: r.access_token, filters: `?id=eq.${r.user.id}&select=*` });
      const prof = Array.isArray(p) ? p[0] : null;
      if (!prof || prof.role !== "admin") { setErr("Acceso denegado."); setLo(false); return; }
      const ss = { token: r.access_token, refresh_token: r.refresh_token, user: r.user, profile: prof };
      saveSession(ss); onLogin(ss);
    } catch { setErr("Error de conexión."); }
    setLo(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at top, ${T.bgSurface} 0%, ${T.bgBase} 70%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, padding: "36px 32px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26 }}>
          <Logo size={72} />
          <p style={{ margin: "16px 0 4px", fontSize: 26, fontWeight: 600, color: T.textPrimary, letterSpacing: "-0.02em" }}>Cinabrio</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Contraseña" style={inputStyle} />
          {err && <p style={{ margin: 0, fontSize: 12, color: T.danger, fontWeight: 500 }}>⚠ {err}</p>}
          <button onClick={submit} disabled={lo} style={{ ...btnPrimary, width: "100%", padding: "12px 16px", marginTop: 6 }}>{lo ? "Ingresando…" : "Entrar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─────── App con Toggle Hábitos / Finanzas ───────
function App({ session, onLogout }) {
  const [mode, setMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("cinabrio_mode") || "habits";
    return "habits";
  });
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("cinabrio_mode", mode); }, [mode]);

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at top, ${T.bgSurface} 0%, ${T.bgBase} 75%)` }}>
      <header className="cnb-header">
        <ModeToggle mode={mode} setMode={setMode} />
      </header>
      <main className="cnb-page">
        {mode === "habits" ? <HabitsSection token={session.token} /> : <FinanceSection token={session.token} />}
      </main>
    </div>
  );
}

function ModeToggle({ mode, setMode }) {
  const isFinance = mode === "finance";
  return (
    <button
      className="cnb-toggle"
      onClick={() => setMode(isFinance ? "habits" : "finance")}
      style={{
        display: "inline-flex", alignItems: "center", gap: 0, padding: 4,
        borderRadius: 999, border: `1.5px solid ${T.border}`,
        background: `linear-gradient(135deg, ${T.bgSurface}, ${T.bgSurfaceHi})`,
        cursor: "pointer", position: "relative",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.3)",
        transition: "all 200ms",
        fontFamily: "inherit",
      }}
    >
      <span className="cnb-toggle-pill" style={{
        position: "relative", fontSize: 12, fontWeight: 700,
        color: !isFinance ? T.bgBase : T.textMuted,
        letterSpacing: "0.1em", textTransform: "uppercase", zIndex: 2, transition: "color 220ms",
      }}>HÁBITOS</span>
      <span className="cnb-toggle-pill" style={{
        position: "relative", fontSize: 12, fontWeight: 700,
        color: isFinance ? T.bgBase : T.textMuted,
        letterSpacing: "0.1em", textTransform: "uppercase", zIndex: 2, transition: "color 220ms",
      }}>FINANZAS</span>
      <span style={{
        position: "absolute", top: 4, bottom: 4,
        left: isFinance ? "calc(50% - 0px)" : 4,
        width: "calc(50% - 4px)",
        borderRadius: 999,
        background: `linear-gradient(135deg, ${T.goldHi}, ${T.gold})`,
        boxShadow: T.goldGlow,
        transition: "left 280ms cubic-bezier(0.4,0,0.2,1)",
        zIndex: 1,
      }} />
    </button>
  );
}

function Logo({ size = 48 }) {
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <img
        src="/cinabrio-logo.png"
        alt="Cinabrio"
        style={{ width: size, height: size, borderRadius: size * 0.22, objectFit: "cover", display: "block", boxShadow: `0 6px 18px ${T.red}40` }}
        onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling.style.display = "flex"; }}
      />
      <div style={{ width: size, height: size, borderRadius: size * 0.22, background: `linear-gradient(135deg, ${T.red}, ${T.redDeep})`, display: "none", alignItems: "center", justifyContent: "center", position: "absolute", inset: 0, boxShadow: `0 6px 18px ${T.red}40` }}>
        <span style={{ fontSize: size * 0.5, fontWeight: 700, color: T.gold, lineHeight: 1, fontFamily: "serif" }}>馬</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// SECCIÓN HÁBITOS
// ────────────────────────────────────────────────────────────────────
function HabitsSection({ token }) {
  const nowDate = useLiveNow();
  const [habitCats, setHabitCats] = useState([]);
  const [habits, setHabits] = useState([]);
  const [habitLog, setHabitLog] = useState([]);
  const [lo, setLo] = useState(true);
  const [view, setView] = useState("day"); // day | week | manage
  const [selectedDate, setSelectedDate] = useState(nowDate);
  const [touchedDate, setTouchedDate] = useState(false);
  // Si el usuario no movió la fecha manualmente, mantenela en hoy real.
  useEffect(() => { if (!touchedDate) setSelectedDate(nowDate); }, [nowDate, touchedDate]);
  const pickDate = (d) => { setTouchedDate(d !== nowDate); setSelectedDate(d); };
  const [editCat, setEditCat] = useState(null);
  const [editHabit, setEditHabit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLo(true);
    const [hc, h, hl] = await Promise.all([
      dq("mp_habit_categories", { token, filters: "?select=*&order=sort_order.asc,name.asc" }),
      dq("mp_habits", { token, filters: "?select=*&archived_at=is.null&order=time.asc,sort_order.asc" }),
      dq("mp_habit_log", { token, filters: `?select=*&log_date=gte.${addDays(-90)}&order=log_date.desc` }),
    ]);
    setHabitCats(Array.isArray(hc) ? hc : []);
    setHabits(Array.isArray(h) ? h : []);
    setHabitLog(Array.isArray(hl) ? hl : []);
    setLo(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (habit, date) => {
    const existing = habitLog.find(l => l.habit_id === habit.id && l.log_date === date);
    if (existing) {
      const wasDone = !!existing.completed_at;
      await dq("mp_habit_log", { method: "PATCH", token, filters: `?id=eq.${existing.id}`, body: { completed_at: wasDone ? null : new Date().toISOString() } });
    } else {
      await dq("mp_habit_log", { method: "POST", token, body: { habit_id: habit.id, log_date: date, completed_at: new Date().toISOString() } });
    }
    load();
  };

  const delHabit = (h) => setConfirm({ title: "Eliminar hábito", body: `¿Eliminar "${h.name}"? Se pierde el historial.`, danger: true, onConfirm: async () => { await dq("mp_habits", { method: "DELETE", token, filters: `?id=eq.${h.id}` }); toast.success("Hábito eliminado"); load(); } });
  const delCat = (c) => setConfirm({ title: "Eliminar categoría", body: `¿Eliminar "${c.name}"?`, danger: true, onConfirm: async () => { await dq("mp_habit_categories", { method: "DELETE", token, filters: `?id=eq.${c.id}` }); toast.success("Categoría eliminada"); load(); } });

  if (lo) return <p style={{ textAlign: "center", color: T.textMuted, padding: "80px 0" }}>Cargando hábitos…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <SubTab active={view === "day"} onClick={() => setView("day")}>Hoy</SubTab>
        <SubTab active={view === "week"} onClick={() => setView("week")}>Semana</SubTab>
        <SubTab active={view === "month"} onClick={() => setView("month")}>Mes</SubTab>
        <SubTab active={view === "manage"} onClick={() => setView("manage")}>Hábitos & categorías</SubTab>
        <div style={{ flex: 1 }} />
        {view === "manage" && <button onClick={() => setEditHabit({})} style={btnPrimary}>+ Nuevo hábito</button>}
      </div>

      {view === "day" && <DayView habits={habits} cats={habitCats} log={habitLog} date={selectedDate} setDate={pickDate} onToggle={toggle} onNew={() => setEditHabit({})} />}
      {view === "week" && <WeekView habits={habits} cats={habitCats} log={habitLog} onToggle={toggle} />}
      {view === "month" && <MonthView habits={habits} cats={habitCats} log={habitLog} onPickDay={(d) => { pickDate(d); setView("day"); }} />}
      {view === "manage" && <ManageView habits={habits} cats={habitCats} onEditHabit={setEditHabit} onDelHabit={delHabit} onEditCat={setEditCat} onDelCat={delCat} onNewCat={() => setEditCat({})} />}

      {editCat && <CategoryModal token={token} editing={editCat.id ? editCat : null} onClose={() => setEditCat(null)} onSaved={() => { setEditCat(null); load(); }} />}
      {editHabit && <HabitModal token={token} editing={editHabit.id ? editHabit : null} categories={habitCats} onClose={() => setEditHabit(null)} onSaved={() => { setEditHabit(null); load(); }} />}
      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// Vista Día (timeline tipo Structured)
function DayView({ habits, cats, log, date, setDate, onToggle, onNew }) {
  const todaysHabits = habits.filter(h => isHabitScheduled(h, date));
  const dayLog = log.filter(l => l.log_date === date);
  const completedIds = new Set(dayLog.filter(l => l.completed_at).map(l => l.habit_id));
  const totalW = todaysHabits.reduce((s, h) => s + (h.weight || 2), 0);
  const doneW = todaysHabits.filter(h => completedIds.has(h.id)).reduce((s, h) => s + (h.weight || 2), 0);
  const pct = totalW > 0 ? Math.round((doneW / totalW) * 100) : 0;
  const isToday = date === todayStr();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <DayHeader date={date} setDate={setDate} pct={pct} completed={completedIds.size} total={todaysHabits.length} isToday={isToday} />
      {todaysHabits.length === 0 ? (
        <Card><EmptyState text={isToday ? "No hay hábitos hoy. Empezá creando algunos." : "Sin hábitos este día."} action={isToday && <button onClick={onNew} style={btnPrimary}>+ Crear hábito</button>} /></Card>
      ) : (
        <Card padded={false}>
          <Timeline habits={todaysHabits} cats={cats} completedIds={completedIds} onToggle={(h) => onToggle(h, date)} />
        </Card>
      )}
    </div>
  );
}

function DayHeader({ date, setDate, pct, completed, total, isToday }) {
  const d = new Date(date + "T12:00:00");
  const navDay = (n) => { const x = new Date(d); x.setDate(d.getDate() + n); setDate(ymd(x)); };

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 11, color: T.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>{isToday ? "Hoy" : DAYS_FULL[dowOf(date)]}</p>
            <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, color: T.textPrimary }}>{d.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}</p>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.textSecondary }}>{completed} de {total} hábitos completados</p>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <IconBtn onClick={() => navDay(-1)} title="Día anterior">‹</IconBtn>
            {!isToday && <IconBtn onClick={() => setDate(todayStr())} title="Hoy">⌂</IconBtn>}
            <IconBtn onClick={() => navDay(1)} title="Día siguiente">›</IconBtn>
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 10.5, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>Progreso</span>
            <span style={{ fontSize: 22, fontWeight: 600, color: pct === 100 ? T.success : T.gold, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: T.bgSurfaceHi, borderRadius: 3, overflow: "hidden", border: `1px solid ${T.border}` }}>
            <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? `linear-gradient(90deg, ${T.success}, #5FB854)` : `linear-gradient(90deg, ${T.redDeep}, ${T.red}, ${T.gold})`, transition: "width 500ms", boxShadow: pct > 0 ? `0 0 8px ${pct === 100 ? T.success : T.gold}55` : "none" }} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Timeline({ habits, cats, completedIds, onToggle }) {
  return (
    <div style={{ position: "relative", padding: "8px 0" }}>
      {/* Línea vertical */}
      <div style={{ position: "absolute", left: 76, top: 28, bottom: 28, width: 2, background: `linear-gradient(180deg, ${T.border}, ${T.borderHi}, ${T.border})` }} />
      {habits.map((h, i) => {
        const cat = cats.find(c => c.id === h.category_id);
        const color = cat?.color || T.gold;
        const done = completedIds.has(h.id);
        const time = h.time ? String(h.time).slice(0, 5) : null;
        return (
          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 22px", position: "relative" }}>
            <span style={{ width: 48, textAlign: "right", fontFamily: "ui-monospace, monospace", fontSize: 12.5, color: done ? T.textMuted : T.textSecondary, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{time || ""}</span>
            <div style={{
              width: 44, height: 44, borderRadius: 22, position: "relative", zIndex: 2,
              background: done ? `linear-gradient(135deg, ${color}, ${color}99)` : T.bgSurfaceHi,
              border: `2px solid ${done ? color : T.borderHi}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, boxShadow: done ? `0 0 14px ${color}66` : "none",
              transition: "all 220ms",
            }}>
              {cat?.icon || "●"}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: done ? T.textMuted : T.textPrimary, textDecoration: done ? "line-through" : "none", textDecorationColor: color }}>{h.name}</p>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                {cat && <span style={{ fontSize: 10.5, fontWeight: 700, color, letterSpacing: "0.06em", textTransform: "uppercase" }}>{cat.name}</span>}
                {h.duration_min > 0 && <span style={{ fontSize: 10.5, color: T.textMuted }}>· {h.duration_min} min</span>}
              </div>
            </div>
            <button onClick={() => onToggle(h)} style={{
              width: 28, height: 28, borderRadius: 16, padding: 0, cursor: "pointer",
              background: done ? `linear-gradient(135deg, ${T.goldHi}, ${T.gold})` : "transparent",
              border: done ? `1.5px solid ${T.gold}` : `1.5px solid ${T.borderHi}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: done ? T.goldGlow : "none", transition: "all 200ms",
            }}>
              {done && <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 8l3.5 3.5L13 5" stroke={T.bgBase} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Vista Semana (grilla)
function WeekView({ habits, cats, log, onToggle }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayStr()));
  const dates = weekDates(weekStart);
  const navWeek = (n) => {
    const d = new Date(weekStart + "T12:00:00"); d.setDate(d.getDate() + n * 7);
    setWeekStart(ymd(d));
  };
  const ts = todayStr();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header semana */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: T.textPrimary, letterSpacing: "-0.01em" }}>
            Semana del {new Date(dates[0] + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })} al {new Date(dates[6] + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
          </p>
          <div style={{ display: "flex", gap: 4 }}>
            <IconBtn onClick={() => navWeek(-1)} title="Semana anterior">‹</IconBtn>
            <IconBtn onClick={() => setWeekStart(startOfWeek(todayStr()))} title="Esta semana">⌂</IconBtn>
            <IconBtn onClick={() => navWeek(1)} title="Semana siguiente">›</IconBtn>
          </div>
        </div>
      </Card>

      {/* Grilla */}
      {habits.length === 0 ? (
        <Card><EmptyState text="Sin hábitos. Creá algunos para verlos acá." /></Card>
      ) : (
        <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1.5fr) repeat(7, minmax(58px,1fr))", minWidth: 720 }}>
            {/* Header */}
            <div style={{ padding: "12px 16px", background: T.bgSurfaceHi, fontSize: 10.5, fontWeight: 700, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>Hábito</div>
            {dates.map((d, i) => {
              const dd = new Date(d + "T12:00:00");
              const isToday = d === ts;
              return (
                <div key={d} style={{ padding: "10px 8px", textAlign: "center", background: T.bgSurfaceHi, borderBottom: `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}` }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: isToday ? T.gold : T.textMuted, letterSpacing: "0.1em", textTransform: "uppercase" }}>{DAYS_SHORT_FULL[i]}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 600, color: isToday ? T.gold : T.textPrimary, fontVariantNumeric: "tabular-nums" }}>{dd.getDate()}</p>
                </div>
              );
            })}
            {/* Filas de hábitos */}
            {habits.map((h, hi) => {
              const cat = cats.find(c => c.id === h.category_id);
              const color = cat?.color || T.gold;
              return (
                <div key={`row-${h.id}`} style={{ display: "contents" }}>
                  <div key={`name-${h.id}`} style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: hi === habits.length - 1 ? "none" : `1px solid ${T.border}` }}>
                    <span style={{ width: 32, height: 32, borderRadius: 16, background: T.bgSurfaceHi, border: `1.5px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{cat?.icon || "●"}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: T.textMuted, fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>{h.time ? String(h.time).slice(0, 5) : ""} {cat ? `· ${cat.name}` : ""}</p>
                    </div>
                  </div>
                  {dates.map((d, di) => {
                    const isScheduled = isHabitScheduled(h, d);
                    const entry = log.find(l => l.habit_id === h.id && l.log_date === d);
                    const done = !!entry?.completed_at;
                    const isToday = d === ts;
                    return (
                      <div key={`cell-${h.id}-${d}`} onClick={() => isScheduled && onToggle(h, d)} style={{
                        padding: "10px 0", borderBottom: hi === habits.length - 1 ? "none" : `1px solid ${T.border}`, borderLeft: `1px solid ${T.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: isScheduled ? "pointer" : "default", background: isToday ? `${T.gold}08` : "transparent",
                        transition: "background 150ms",
                      }}
                        onMouseEnter={e => { if (isScheduled) e.currentTarget.style.background = T.bgSurfaceHi; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isToday ? `${T.gold}08` : "transparent"; }}>
                        {!isScheduled ? <span style={{ fontSize: 14, color: T.textMuted, opacity: 0.3 }}>·</span> : (
                          <div style={{
                            width: 22, height: 22, borderRadius: 12,
                            background: done ? `linear-gradient(135deg, ${T.goldHi}, ${T.gold})` : "transparent",
                            border: done ? `1.5px solid ${T.gold}` : `1.5px solid ${T.borderHi}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 200ms",
                          }}>
                            {done && <svg width="11" height="11" viewBox="0 0 16 16"><path d="M3 8l3.5 3.5L13 5" stroke={T.bgBase} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Vista Mes (calendario tipo heatmap con % de cumplimiento)
function MonthView({ habits, cats, log, onPickDay }) {
  const nowDate = useLiveNow();
  const currentMonth = nowDate.slice(0, 7);
  const [monthCursor, setMonthCursor] = useState(currentMonth);
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!touched) setMonthCursor(currentMonth); }, [currentMonth, touched]);
  const [y, m] = monthCursor.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0);
  const daysInMonth = lastDay.getDate();
  // Lunes = 0
  const offset = (firstDay.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const navMonth = (n) => {
    const dt = new Date(y, m - 1 + n, 1);
    const next = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    setTouched(next !== currentMonth);
    setMonthCursor(next);
  };

  // Compute pct + scheduled for each date
  const stats = cells.map(date => {
    if (!date) return null;
    const scheduled = habits.filter(h => isHabitScheduled(h, date));
    if (scheduled.length === 0) return { date, pct: null, doneCount: 0, total: 0 };
    const dayLog = log.filter(l => l.log_date === date);
    const doneSet = new Set(dayLog.filter(l => l.completed_at).map(l => l.habit_id));
    const totalW = scheduled.reduce((s, h) => s + (h.weight || 2), 0);
    const doneW = scheduled.filter(h => doneSet.has(h.id)).reduce((s, h) => s + (h.weight || 2), 0);
    return { date, pct: totalW > 0 ? Math.round((doneW / totalW) * 100) : 0, doneCount: doneSet.size, total: scheduled.length };
  });

  // Resumen del mes (solo días con hábitos programados y pasados/hoy)
  const ts = todayStr();
  const evaluable = stats.filter(s => s && s.date <= ts && s.total > 0);
  const avgPct = evaluable.length > 0 ? Math.round(evaluable.reduce((s, x) => s + x.pct, 0) / evaluable.length) : 0;
  const perfectDays = evaluable.filter(x => x.pct === 100).length;
  const zeroDays = evaluable.filter(x => x.pct === 0).length;

  const colorFor = (pct) => {
    if (pct === null) return T.bgSurfaceHi;
    if (pct === 0) return `${T.red}26`;
    if (pct < 50) return `${T.red}66`;
    if (pct < 100) return `${T.gold}88`;
    return T.gold;
  };

  const ts2 = todayStr();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconBtn onClick={() => navMonth(-1)} title="Mes anterior">‹</IconBtn>
            <p style={{ margin: "0 12px", fontSize: 20, fontWeight: 600, color: T.textPrimary, letterSpacing: "-0.01em", minWidth: 180, textAlign: "center" }}>
              {monthLabel(monthCursor)}
            </p>
            <IconBtn onClick={() => navMonth(1)} title="Mes siguiente">›</IconBtn>
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <SmallStat label="Promedio" value={`${avgPct}%`} color={avgPct >= 80 ? T.success : avgPct >= 50 ? T.gold : T.red} />
            <SmallStat label="Días 100%" value={perfectDays} color={T.gold} />
            <SmallStat label="Días en 0" value={zeroDays} color={T.danger} />
          </div>
        </div>
      </Card>

      {/* Grilla */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 0" }}>{d}</div>
          ))}
          {stats.map((s, i) => {
            if (!s) return <div key={`empty-${i}`} />;
            const isToday = s.date === ts2;
            const isFuture = s.date > ts2;
            const hasHabits = s.total > 0;
            const pct = s.pct;
            const d = Number(s.date.slice(-2));
            return (
              <button
                key={s.date}
                onClick={() => onPickDay(s.date)}
                disabled={!hasHabits}
                style={{
                  aspectRatio: "1 / 1", border: isToday ? `1.5px solid ${T.gold}` : `1px solid ${T.border}`,
                  background: hasHabits && !isFuture ? colorFor(pct) : T.bgSurfaceHi,
                  borderRadius: 10, cursor: hasHabits ? "pointer" : "default",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  padding: "6px 8px", color: T.textPrimary, fontFamily: "inherit",
                  opacity: isFuture ? 0.4 : 1, position: "relative",
                  transition: "transform 120ms",
                }}
                onMouseEnter={e => { if (hasHabits) e.currentTarget.style.transform = "scale(1.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: isToday ? T.gold : (pct === null || !hasHabits ? T.textMuted : pct >= 50 ? T.bgBase : T.textPrimary), fontVariantNumeric: "tabular-nums", textAlign: "left" }}>{d}</span>
                {hasHabits && !isFuture && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 50 ? T.bgBase : T.textPrimary, alignSelf: "flex-end", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
                )}
                {hasHabits && isFuture && (
                  <span style={{ fontSize: 10, color: T.textMuted, alignSelf: "flex-end" }}>{s.total}</span>
                )}
              </button>
            );
          })}
        </div>
        {/* Leyenda */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10.5, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>0%</span>
          {[`${T.red}26`, `${T.red}66`, `${T.gold}88`, T.gold].map((c, i) => (
            <span key={i} style={{ width: 18, height: 18, borderRadius: 4, background: c, border: `1px solid ${T.border}` }} />
          ))}
          <span style={{ fontSize: 10.5, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>100%</span>
        </div>
      </Card>
    </div>
  );
}

function SmallStat({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 9.5, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 600, color, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

// Vista Manage (categorías + hábitos editables)
function ManageView({ habits, cats, onEditHabit, onDelHabit, onEditCat, onDelCat, onNewCat }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <SectionHeader title="Categorías" action={<button onClick={onNewCat} style={btnSec}>+ Nueva categoría</button>} />
        {cats.length === 0 ? (
          <Card><EmptyState text="Sin categorías. Creá la primera para agrupar tus hábitos." /></Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
            {cats.map(c => {
              const count = habits.filter(h => h.category_id === c.id).length;
              return (
                <div key={c.id} style={{ padding: "14px 16px", background: T.bgSurface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${c.color || T.gold}`, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {c.icon && <span style={{ fontSize: 18 }}>{c.icon}</span>}
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{c.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted }}>{count} hábito{count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <IconBtn onClick={() => onEditCat(c)} title="Editar">✎</IconBtn>
                    <IconBtn onClick={() => onDelCat(c)} title="Eliminar" danger>×</IconBtn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <SectionHeader title={`Hábitos (${habits.length})`} />
        {habits.length === 0 ? (
          <Card><EmptyState text="Sin hábitos. Empezá definiendo qué querés hacer cada día." /></Card>
        ) : (
          <Card padded={false}>
            {habits.map((h, i) => {
              const cat = cats.find(c => c.id === h.category_id);
              return (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i === habits.length - 1 ? "none" : `1px solid ${T.border}` }}>
                  <span style={{ width: 36, height: 36, borderRadius: 18, background: T.bgSurfaceHi, border: `1.5px solid ${(cat?.color || T.gold) + "55"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{cat?.icon || "●"}</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: T.textMuted, minWidth: 48, fontWeight: 500 }}>{h.time ? String(h.time).slice(0, 5) : "—"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.textPrimary }}>{h.name}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: T.textMuted }}>{frequencyLabel(h)}</p>
                  </div>
                  {cat && <Badge color={cat.color || T.gold} label={cat.name} />}
                  <div style={{ display: "flex", gap: 4 }}>
                    <IconBtn onClick={() => onEditHabit(h)} title="Editar">✎</IconBtn>
                    <IconBtn onClick={() => onDelHabit(h)} title="Eliminar" danger>×</IconBtn>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// SECCIÓN FINANZAS
// ────────────────────────────────────────────────────────────────────
function FinanceSection({ token }) {
  const nowDate = useLiveNow();
  const currentMonth = nowDate.slice(0, 7);
  const [expCats, setExpCats] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [lo, setLo] = useState(true);
  const [month, setMonth] = useState(currentMonth);
  const [touchedMonth, setTouchedMonth] = useState(false);
  useEffect(() => { if (!touchedMonth) setMonth(currentMonth); }, [currentMonth, touchedMonth]);
  const [view, setView] = useState("ledger"); // ledger | dashboard | categories
  const [editCat, setEditCat] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [editWithdraw, setEditWithdraw] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLo(true);
    const [ec, e, w] = await Promise.all([
      dq("mp_expense_categories", { token, filters: "?select=*&order=sort_order.asc,name.asc" }),
      dq("mp_expenses", { token, filters: `?select=*&expense_date=gte.${addDays(-365)}&order=expense_date.desc` }),
      dq("mp_salary_withdrawals", { token, filters: `?select=*&withdrawal_date=gte.${addDays(-365)}&order=withdrawal_date.desc` }),
    ]);
    setExpCats(Array.isArray(ec) ? ec : []);
    setExpenses(Array.isArray(e) ? e : []);
    setWithdrawals(Array.isArray(w) ? w : []);
    setLo(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const monthExp = expenses.filter(e => e.expense_date.slice(0, 7) === month);
  const monthWdraw = withdrawals.filter(w => w.withdrawal_date.slice(0, 7) === month);
  const totalSpent = monthExp.reduce((s, e) => s + Number(e.amount_ars || 0), 0);
  const totalIn = monthWdraw.reduce((s, w) => s + Number(w.amount_ars || 0), 0);

  // Libro diario unificado (ingresos + gastos del mes, ordenados por fecha desc)
  const ledger = useMemo(() => {
    const rows = [
      ...monthWdraw.map(w => ({ kind: "in", id: w.id, date: w.withdrawal_date, amount: Number(w.amount_ars || 0), label: `Ingreso · ${fmtUsd(w.amount_usd)} @ ${Number(w.exchange_rate).toLocaleString("es-AR")}`, notes: w.notes, raw: w })),
      ...monthExp.map(e => ({ kind: "out", id: e.id, date: e.expense_date, amount: Number(e.amount_ars || 0), label: e.description || "(sin descripción)", category: expCats.find(c => c.id === e.category_id), payment_method: e.payment_method, installments: e.installments, raw: e })),
    ];
    rows.sort((a, b) => b.date.localeCompare(a.date) || (b.id || "").localeCompare?.(a.id || "") || 0);
    return rows;
  }, [monthExp, monthWdraw, expCats]);

  const delCat = (c) => setConfirm({ title: "Eliminar categoría", body: `¿Eliminar "${c.name}"?`, danger: true, onConfirm: async () => { await dq("mp_expense_categories", { method: "DELETE", token, filters: `?id=eq.${c.id}` }); toast.success("Categoría eliminada"); load(); } });
  const delExp = (e) => setConfirm({ title: "Eliminar gasto", body: `¿Eliminar este gasto de ${fmtArs(e.amount_ars)}?`, danger: true, onConfirm: async () => { await dq("mp_expenses", { method: "DELETE", token, filters: `?id=eq.${e.id}` }); toast.success("Gasto eliminado"); load(); } });
  const delWdraw = (w) => setConfirm({ title: "Eliminar ingreso", body: `¿Eliminar ingreso de ${fmtUsd(w.amount_usd)}?`, danger: true, onConfirm: async () => { await dq("mp_salary_withdrawals", { method: "DELETE", token, filters: `?id=eq.${w.id}` }); toast.success("Ingreso eliminado"); load(); } });

  const navMonth = (d) => {
    const [y, m] = month.split("-").map(Number);
    const dt = new Date(y, m - 1 + d, 1);
    const next = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    setTouchedMonth(next !== currentMonth);
    setMonth(next);
  };

  if (lo) return <p style={{ textAlign: "center", color: T.textMuted, padding: "80px 0" }}>Cargando finanzas…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <SubTab active={view === "ledger"} onClick={() => setView("ledger")}>Libro diario</SubTab>
        <SubTab active={view === "dashboard"} onClick={() => setView("dashboard")}>Dashboard</SubTab>
        <SubTab active={view === "categories"} onClick={() => setView("categories")}>Categorías</SubTab>
        <div style={{ flex: 1 }} />
        {view === "ledger" && (
          <>
            <button onClick={() => setEditWithdraw({})} style={btnSec}>+ Ingreso</button>
            <button onClick={() => setEditExpense({})} style={btnPrimary}>+ Gasto</button>
          </>
        )}
        {view === "categories" && <button onClick={() => setEditCat({})} style={btnPrimary}>+ Categoría</button>}
      </div>

      {/* Header mes */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4 }}>
        <IconBtn onClick={() => navMonth(-1)} title="Mes anterior">‹</IconBtn>
        <p style={{ margin: "0 12px", fontSize: 20, fontWeight: 600, color: T.textPrimary, letterSpacing: "-0.01em", minWidth: 180, textAlign: "center" }}>
          {monthLabel(month)}
        </p>
        <IconBtn onClick={() => navMonth(1)} title="Mes siguiente">›</IconBtn>
      </div>

      {/* Stats siempre visibles.
          Reorganizado para que Disponible sea el HERO (centrado, grande, fondo verde vivo)
          y los otros 2 sean cards más sobrias con la paleta financiera (teal/coral). */}
      <div style={{ marginBottom: 14 }}>
        <HeroDispoCard ingresado={totalIn} gastado={totalSpent} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FinanceCard label="Ingresado" value={fmtArs(totalIn)} sub={monthWdraw.length === 0 ? "Sin ingresos aún" : `${monthWdraw.length} ingreso${monthWdraw.length !== 1 ? "s" : ""}`} kind="in" />
        <FinanceCard label="Gastado" value={fmtArs(totalSpent)} sub={`${monthExp.length} gasto${monthExp.length !== 1 ? "s" : ""}`} kind="out" />
      </div>

      {view === "ledger" && (
        ledger.length === 0 ? (
          <Card><EmptyState text="Sin movimientos este mes. Empezá registrando un ingreso o un gasto." /></Card>
        ) : (
          <Card padded={false}>
            {ledger.map((r, i) => (
              <div key={`${r.kind}-${r.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: i === ledger.length - 1 ? "none" : `1px solid ${T.border}` }}>
                <span style={{
                  width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                  background: r.kind === "in" ? `${T.gold}1F` : `${T.red}1F`,
                  border: `1px solid ${r.kind === "in" ? T.gold + "55" : T.red + "55"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: r.kind === "in" ? T.gold : T.red, fontSize: 16, fontWeight: 700, lineHeight: 1,
                }}>{r.kind === "in" ? "↓" : "↑"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{r.label}</p>
                    <span style={{ fontSize: 14, fontWeight: 600, color: r.kind === "in" ? T.gold : T.textPrimary, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0 }}>{r.kind === "in" ? "+" : "−"} {fmtArs(r.amount)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{r.date.slice(5).split("-").reverse().join("/")}</span>
                    {r.category && <span style={{ fontSize: 11, color: r.category.color || T.gold, fontWeight: 600 }}>{r.category.icon ? `${r.category.icon} ` : ""}{r.category.name}</span>}
                    {r.payment_method && <span style={{ fontSize: 10.5, color: T.textMuted, padding: "1px 7px", borderRadius: 999, border: `1px solid ${T.border}` }}>{r.payment_method}{r.installments > 1 ? ` · ${r.installments}x` : ""}</span>}
                    {r.notes && <span style={{ fontSize: 10.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes}</span>}
                    <span style={{ flex: 1 }} />
                    <IconBtn onClick={() => r.kind === "in" ? setEditWithdraw(r.raw) : setEditExpense(r.raw)} title="Editar">✎</IconBtn>
                    <IconBtn onClick={() => r.kind === "in" ? delWdraw(r.raw) : delExp(r.raw)} title="Eliminar" danger>×</IconBtn>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        )
      )}

      {view === "dashboard" && <Dashboard expenses={expenses} cats={expCats} currentMonth={month} />}

      {view === "categories" && (
        expCats.length === 0 ? (
          <Card><EmptyState text="Sin categorías. Creá la primera para agrupar tus gastos." action={<button onClick={() => setEditCat({})} style={btnPrimary}>+ Crear primera</button>} /></Card>
        ) : (
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {expCats.map(c => {
                const spent = monthExp.filter(e => e.category_id === c.id).reduce((s, e) => s + Number(e.amount_ars || 0), 0);
                const count = monthExp.filter(e => e.category_id === c.id).length;
                const color = c.color || T.gold;
                return (
                  <div key={c.id} style={{ padding: "12px 14px", background: T.bgSurfaceHi, borderRadius: 10, border: `1px solid ${T.border}`, borderLeft: `3px solid ${color}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, color: T.textPrimary, minWidth: 0, flex: 1 }}>
                      {c.icon && <span style={{ fontSize: 18, flexShrink: 0 }}>{c.icon}</span>}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: spent > 0 ? T.textPrimary : T.textMuted, fontVariantNumeric: "tabular-nums" }}>{fmtArs(spent)}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 10.5, color: T.textMuted, letterSpacing: "0.04em" }}>{count === 0 ? "sin gastos" : `${count} gasto${count !== 1 ? "s" : ""}`}</p>
                      </div>
                      <IconBtn onClick={() => setEditCat(c)} title="Editar">✎</IconBtn>
                      <IconBtn onClick={() => delCat(c)} title="Eliminar" danger>×</IconBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )
      )}

      {editCat && <CategoryModal isExpense token={token} editing={editCat.id ? editCat : null} onClose={() => setEditCat(null)} onSaved={() => { setEditCat(null); load(); }} />}
      {editExpense && <ExpenseModal token={token} editing={editExpense.id ? editExpense : null} categories={expCats} onClose={() => setEditExpense(null)} onSaved={() => { setEditExpense(null); load(); }} />}
      {editWithdraw && <WithdrawalModal token={token} editing={editWithdraw.id ? editWithdraw : null} onClose={() => setEditWithdraw(null)} onSaved={() => { setEditWithdraw(null); load(); }} />}
      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// Dashboard: gastos por mes + top conceptos
function Dashboard({ expenses, cats, currentMonth }) {
  // Últimos 6 meses incluyendo current
  const months = useMemo(() => {
    const arr = [];
    const [y, m] = currentMonth.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(y, m - 1 - i, 1);
      arr.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
    }
    return arr;
  }, [currentMonth]);

  const byMonth = months.map(mm => {
    const total = expenses.filter(e => e.expense_date.slice(0, 7) === mm).reduce((s, e) => s + Number(e.amount_ars || 0), 0);
    const [yy, mn] = mm.split("-").map(Number);
    const d = new Date(yy, mn - 1, 15);
    return { month: mm, total, label: d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "") };
  });
  const maxM = Math.max(1, ...byMonth.map(b => b.total));

  // Top conceptos del mes actual por categoría
  const monthExp = expenses.filter(e => e.expense_date.slice(0, 7) === currentMonth);
  const byCat = cats.map(c => ({
    cat: c,
    total: monthExp.filter(e => e.category_id === c.id).reduce((s, e) => s + Number(e.amount_ars || 0), 0),
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
  const totalMonth = byCat.reduce((s, x) => s + x.total, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <SectionHeader title="Gasto mensual · últimos 6 meses" />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160, padding: "6px 4px 0" }}>
          {byMonth.map((b, i) => {
            const h = b.total > 0 ? Math.max(4, (b.total / maxM) * 130) : 4;
            const isCurrent = b.month === currentMonth;
            return (
              <div key={b.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10.5, color: isCurrent ? T.gold : T.textMuted, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  {b.total > 0 ? `${(b.total / 1000).toFixed(0)}k` : "—"}
                </span>
                <div style={{
                  width: "100%", height: h, borderRadius: "6px 6px 2px 2px",
                  background: isCurrent ? `linear-gradient(180deg, ${T.goldHi}, ${T.gold})` : `linear-gradient(180deg, ${T.redDeep}, ${T.red}AA)`,
                  boxShadow: isCurrent ? T.goldGlow : "none", transition: "all 200ms",
                }} />
                <span style={{ fontSize: 11, color: isCurrent ? T.textPrimary : T.textMuted, fontWeight: 600, textTransform: "capitalize", letterSpacing: "0.04em" }}>{b.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Top categorías del mes" />
        {byCat.length === 0 ? (
          <p style={{ margin: 0, color: T.textMuted, fontSize: 13, fontStyle: "italic", padding: "20px 0", textAlign: "center" }}>Sin gastos categorizados este mes.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {byCat.map(({ cat, total }) => {
              const pct = totalMonth > 0 ? (total / totalMonth) * 100 : 0;
              return (
                <div key={cat.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5, gap: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, color: T.textPrimary }}>
                      {cat.icon && <span style={{ fontSize: 14 }}>{cat.icon}</span>}
                      {cat.name}
                    </span>
                    <span style={{ fontSize: 12.5, color: T.textSecondary, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{fmtArs(total)} <span style={{ color: T.textMuted, marginLeft: 6 }}>{pct.toFixed(0)}%</span></span>
                  </div>
                  <div style={{ height: 6, background: T.bgSurfaceHi, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: cat.color || T.gold, transition: "width 300ms" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ────────────── Modales ──────────────
// Paleta cálida para auto-asignar a categorías. Hash determinístico por nombre → mismo nombre, mismo color siempre.
const CAT_PALETTE = ["#C8941B", "#C8102E", "#E0825C", "#A0855B", "#7FB069", "#5BA8FF", "#C9A4FF", "#FF9F66", "#E8B14B", "#9B5DE5"];
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return Math.abs(h); }
const colorForName = (name) => CAT_PALETTE[hashStr(String(name || "").toLowerCase().trim()) % CAT_PALETTE.length];

function CategoryModal({ isExpense, token, editing, onClose, onSaved }) {
  const table = isExpense ? "mp_expense_categories" : "mp_habit_categories";
  const [name, setName] = useState(editing?.name || "");
  const [icon, setIcon] = useState(editing?.icon || "");
  const [saving, setSaving] = useState(false);

  // El color se decide automáticamente. Si la categoría ya tenía uno, lo respetamos al editar.
  const previewColor = editing?.color || colorForName(name || (isExpense ? "Nueva" : "Nueva"));

  const save = async () => {
    if (!name.trim()) return toast.error("Falta el nombre");
    setSaving(true);
    const finalColor = editing?.color || colorForName(name);
    const body = { name: name.trim(), color: finalColor, icon: icon || null };
    if (editing?.id) await dq(table, { method: "PATCH", token, filters: `?id=eq.${editing.id}`, body });
    else await dq(table, { method: "POST", token, body });
    setSaving(false);
    toast.success(editing?.id ? "Actualizada" : "Creada");
    onSaved();
  };

  return (
    <Modal title={editing?.id ? "Editar categoría" : "Nueva categoría"} onClose={onClose}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${previewColor}, ${previewColor}AA)`, border: `1px solid ${previewColor}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: `0 0 12px ${previewColor}40`, flexShrink: 0 }}>
          {icon || "●"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>Preview</p>
          <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{name || "Sin nombre"}</p>
        </div>
      </div>
      <Field label="Nombre"><input autoFocus value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={isExpense ? "Comida, Transporte…" : "Cuerpo, Trabajo, Mente…"} /></Field>
      <Field label="Emoji (opcional)"><input value={icon} onChange={e => setIcon(e.target.value)} style={{ ...inputStyle, width: 100, fontSize: 22, textAlign: "center" }} placeholder="🏋️" maxLength={2} /></Field>
      <p style={{ margin: "0 0 6px", fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>El color se asigna automáticamente según el nombre. Si querés otro, cambiá el nombre o tocá el ícono.</p>
      <ModalFooter onCancel={onClose} onConfirm={save} loading={saving} confirmLabel={editing?.id ? "Guardar" : "Crear"} />
    </Modal>
  );
}

// Picker custom (hora + minuto) que reemplaza al <input type="time"> nativo del browser.
// El nativo en iOS abre un picker grande blanco con "a.m./p.m." muy mal integrado con el theme oscuro.
// Acá usamos 2 selects styled + botón × para limpiar. Valor en formato "HH:MM" (24hs).
function TimePickerDual({ value, onChange, inputStyle }) {
  const [hStr, mStr] = (value || "").split(":");
  const h = hStr || "";
  const m = mStr || "";
  const selStyle = { ...inputStyle, flex: 1, padding: "10px 8px", appearance: "none", WebkitAppearance: "none", textAlign: "center", textAlignLast: "center", cursor: "pointer" };
  const setH = (v) => onChange(v ? `${v}:${m || "00"}` : "");
  const setM = (v) => onChange(v ? `${h || "08"}:${v}` : (h ? `${h}:00` : ""));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select value={h} onChange={e => setH(e.target.value)} style={selStyle}>
        <option value="" style={{ background: T.bgSurface, color: T.textMuted }}>--</option>
        {Array.from({ length: 24 }, (_, i) => {
          const v = String(i).padStart(2, "0");
          return <option key={v} value={v} style={{ background: T.bgSurface, color: T.textPrimary }}>{v}</option>;
        })}
      </select>
      <span style={{ color: T.textMuted, fontWeight: 700, fontSize: 18, paddingBottom: 2 }}>:</span>
      <select value={m} onChange={e => setM(e.target.value)} style={selStyle}>
        <option value="" style={{ background: T.bgSurface, color: T.textMuted }}>--</option>
        {Array.from({ length: 12 }, (_, i) => {
          const v = String(i * 5).padStart(2, "0");
          return <option key={v} value={v} style={{ background: T.bgSurface, color: T.textPrimary }}>{v}</option>;
        })}
      </select>
      {value && <button type="button" onClick={() => onChange("")} title="Quitar horario" style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, color: T.textMuted, fontSize: 14, cursor: "pointer", padding: "8px 10px", lineHeight: 1 }}>×</button>}
    </div>
  );
}

function HabitModal({ token, editing, categories, onClose, onSaved }) {
  const [name, setName] = useState(editing?.name || "");
  const [catId, setCatId] = useState(editing?.category_id || categories[0]?.id || "");
  const [time, setTime] = useState(editing?.time?.slice(0, 5) || "");
  const [duration, setDuration] = useState(editing?.duration_min || "");
  const [days, setDays] = useState(editing?.days_of_week ?? 31);
  const [weight, setWeight] = useState(editing?.weight ?? 2);
  const [notify, setNotify] = useState(editing?.notify_enabled ?? false);
  const [saving, setSaving] = useState(false);
  // Frecuencia avanzada: weekly (default) / monthly_nth_weekday / every_n_days.
  const [freqType, setFreqType] = useState(editing?.frequency_type || "weekly");
  const [monthlyNth, setMonthlyNth] = useState(editing?.monthly_nth ?? 1);
  const [monthlyWeekday, setMonthlyWeekday] = useState(editing?.monthly_weekday ?? 6);
  const [everyNDays, setEveryNDays] = useState(editing?.every_n_days ?? 15);
  const [startDate, setStartDate] = useState(editing?.start_date || todayStr());

  const toggleDay = (i) => setDays(p => p ^ (1 << i));
  const setPreset = (mask) => setDays(mask);

  const save = async () => {
    if (!name.trim()) return toast.error("Falta el nombre");
    if (freqType === "weekly" && days === 0) return toast.error("Elegí al menos un día");
    if (freqType === "monthly_nth_weekday" && (monthlyNth == null || monthlyWeekday == null)) return toast.error("Elegí la ocurrencia y el día");
    if (freqType === "every_n_days" && (!everyNDays || Number(everyNDays) <= 0)) return toast.error("Indicá cada cuántos días");
    setSaving(true);
    const body = {
      name: name.trim(),
      category_id: catId || null,
      time: time || null,
      notify_enabled: notify,
      duration_min: Number(duration) || null,
      weight,
      frequency_type: freqType,
      // Para weekly: días útiles. Para otros tipos guardo 0 (limpia) por consistencia.
      days_of_week: freqType === "weekly" ? days : 0,
      monthly_nth: freqType === "monthly_nth_weekday" ? Number(monthlyNth) : null,
      monthly_weekday: freqType === "monthly_nth_weekday" ? Number(monthlyWeekday) : null,
      every_n_days: freqType === "every_n_days" ? Number(everyNDays) : null,
      start_date: freqType === "every_n_days" ? (startDate || todayStr()) : null,
    };
    if (editing?.id) await dq("mp_habits", { method: "PATCH", token, filters: `?id=eq.${editing.id}`, body });
    else await dq("mp_habits", { method: "POST", token, body });
    setSaving(false);
    toast.success(editing?.id ? "Hábito actualizado" : "Hábito creado");
    onSaved();
  };

  return (
    <Modal title={editing?.id ? "Editar hábito" : "Nuevo hábito"} onClose={onClose}>
      <Field label="Nombre"><input autoFocus value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ej: Gym empuje" /></Field>
      <Field label="Categoría">
        <select value={catId} onChange={e => setCatId(e.target.value)} style={inputStyle}>
          <option value="">— Sin categoría —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon}  ` : ""}{c.name}</option>)}
        </select>
        <p style={{ margin: "6px 2px 0", fontSize: 10.5, color: T.textMuted, letterSpacing: "0.04em" }}>El emoji se hereda de la categoría.</p>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Horario"><TimePickerDual value={time} onChange={setTime} inputStyle={inputStyle} /></Field>
        <Field label="Duración (min)"><input type="number" value={duration} onChange={e => setDuration(e.target.value)} style={inputStyle} placeholder="30 (opcional)" /></Field>
      </div>
      <Field label="Importancia">
        <div style={{ display: "flex", gap: 6 }}>
          {[{ v: 1, label: "Baja", desc: "1 pt" }, { v: 2, label: "Normal", desc: "2 pts" }, { v: 3, label: "Alta", desc: "3 pts" }].map(o => {
            const active = weight === o.v;
            return (
              <button key={o.v} onClick={() => setWeight(o.v)} style={{
                flex: 1, padding: "10px 8px", fontSize: 12, fontWeight: 700,
                borderRadius: 8, border: active ? `1px solid ${T.gold}` : `1px solid ${T.border}`,
                background: active ? `linear-gradient(135deg, ${T.goldHi}, ${T.gold})` : "transparent",
                color: active ? T.bgBase : T.textSecondary, cursor: "pointer", transition: "all 150ms",
                letterSpacing: "0.04em", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}>
                <span>{o.label}</span>
                <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 600 }}>{o.desc}</span>
              </button>
            );
          })}
        </div>
        <p style={{ margin: "6px 2px 0", fontSize: 10.5, color: T.textMuted }}>Define cuánto pesa este hábito en el % del día.</p>
      </Field>
      <Field label="Frecuencia">
        {/* Selector del tipo de frecuencia */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
          {[
            { v: "weekly", label: "Semanal" },
            { v: "monthly_nth_weekday", label: "Mensual" },
            { v: "every_n_days", label: "Cada N días" },
          ].map(o => (
            <Chip key={o.v} onClick={() => setFreqType(o.v)} active={freqType === o.v}>{o.label}</Chip>
          ))}
        </div>
        {/* Modo: Semanal — bitmask de días + presets */}
        {freqType === "weekly" && <>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
            <Chip onClick={() => setPreset(127)} active={days === 127}>Todos</Chip>
            <Chip onClick={() => setPreset(31)} active={days === 31}>L–V</Chip>
            <Chip onClick={() => setPreset(96)} active={days === 96}>Fin de semana</Chip>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {DAYS.map((d, i) => {
              const active = days & (1 << i);
              return (
                <button key={i} onClick={() => toggleDay(i)} style={{
                  flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 700,
                  borderRadius: 8, border: active ? `1px solid ${T.gold}` : `1px solid ${T.border}`,
                  background: active ? `linear-gradient(135deg, ${T.goldHi}, ${T.gold})` : "transparent",
                  color: active ? T.bgBase : T.textSecondary, cursor: "pointer", transition: "all 150ms",
                }}>{d}</button>
              );
            })}
          </div>
        </>}
        {/* Modo: Mensual — Nth + weekday. Ej: "1er Domingo de cada mes". */}
        {freqType === "monthly_nth_weekday" && <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select value={monthlyNth} onChange={e => setMonthlyNth(Number(e.target.value))} style={inputStyle}>
              <option value={1}>1er</option>
              <option value={2}>2do</option>
              <option value={3}>3er</option>
              <option value={4}>4to</option>
              <option value={5}>Último</option>
            </select>
            <select value={monthlyWeekday} onChange={e => setMonthlyWeekday(Number(e.target.value))} style={inputStyle}>
              {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <p style={{ margin: "8px 2px 0", fontSize: 11, color: T.gold, fontWeight: 600 }}>{frequencyLabel({ frequency_type: "monthly_nth_weekday", monthly_nth: monthlyNth, monthly_weekday: monthlyWeekday })}</p>
        </>}
        {/* Modo: Cada N días — N + fecha de referencia. */}
        {freqType === "every_n_days" && <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.textMuted, marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>Cada N días</label>
              <input type="number" min={1} value={everyNDays} onChange={e => setEveryNDays(e.target.value)} style={inputStyle} placeholder="15" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.textMuted, marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>Desde</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={dateInputStyle} />
            </div>
          </div>
          <p style={{ margin: "8px 2px 0", fontSize: 11, color: T.gold, fontWeight: 600 }}>{frequencyLabel({ frequency_type: "every_n_days", every_n_days: Number(everyNDays) || 0 })} · desde {startDate || "hoy"}</p>
        </>}
      </Field>
      <Field label="Recordatorio">
        <button onClick={async () => {
          // Si va a prender el toggle, asegurar que haya suscripción push activa.
          // Si va a apagarlo, directo.
          if (!notify) {
            const ok = await ensureCinabrioPush(token);
            if (!ok) { toast.error("No se pudo activar push (permiso denegado o sin soporte)"); return; }
          }
          setNotify(v => !v);
        }} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          padding: "11px 14px", borderRadius: 8, border: `1px solid ${T.border}`,
          background: T.bgSurfaceHi, color: T.textPrimary, cursor: "pointer",
          fontSize: 13, fontWeight: 500, fontFamily: "inherit",
        }}>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
            <span>Recordatorio push a la hora</span>
            <span style={{ fontSize: 10.5, color: T.textMuted, letterSpacing: "0.04em" }}>{time ? `Te aviso a las ${time}` : "Cargá un horario para que te avise"}</span>
          </span>
          <span style={{
            width: 36, height: 20, borderRadius: 999, position: "relative",
            background: notify ? `linear-gradient(135deg, ${T.goldHi}, ${T.gold})` : T.bgSurface,
            border: `1px solid ${notify ? T.gold : T.border}`, transition: "all 200ms", flexShrink: 0,
          }}>
            <span style={{
              position: "absolute", top: 1, left: notify ? 17 : 1,
              width: 16, height: 16, borderRadius: "50%", background: notify ? T.bgBase : T.textMuted,
              transition: "left 220ms cubic-bezier(0.4,0,0.2,1)",
            }} />
          </span>
        </button>
      </Field>
      <ModalFooter onCancel={onClose} onConfirm={save} loading={saving} confirmLabel={editing?.id ? "Guardar" : "Crear"} />
    </Modal>
  );
}

function ExpenseModal({ token, editing, categories, onClose, onSaved }) {
  const [catId, setCatId] = useState(editing?.category_id || categories[0]?.id || "");
  const [amount, setAmount] = useState(editing?.amount_ars || "");
  const [desc, setDesc] = useState(editing?.description || "");
  const [date, setDate] = useState(editing?.expense_date || todayStr());
  const [pm, setPm] = useState(editing?.payment_method || "Efectivo");
  const [inst, setInst] = useState(editing?.installments || 1);
  const [notes, setNotes] = useState(editing?.notes || "");
  const [saving, setSaving] = useState(false);

  const isCredit = pm === "Tarjeta de crédito";
  const totalN = Number(String(amount).replace(/\./g, "").replace(",", ".")) || 0;
  const perInst = isCredit && inst > 1 ? totalN / inst : null;

  const save = async () => {
    if (!isFinite(totalN) || totalN <= 0) return toast.error("Monto inválido");
    setSaving(true);
    const body = {
      category_id: catId || null, amount_ars: totalN, description: desc.trim() || null,
      expense_date: date, notes: notes.trim() || null,
      payment_method: pm, installments: isCredit ? Number(inst) || 1 : 1,
    };
    if (editing?.id) await dq("mp_expenses", { method: "PATCH", token, filters: `?id=eq.${editing.id}`, body });
    else await dq("mp_expenses", { method: "POST", token, body });
    setSaving(false);
    toast.success(editing?.id ? "Actualizado" : "Registrado");
    onSaved();
  };

  const methods = ["Efectivo", "Débito", "Transferencia", "Tarjeta de crédito"];

  return (
    <Modal title={editing?.id ? "Editar gasto" : "Registrar gasto"} onClose={onClose}>
      <Field label="Descripción"><input autoFocus value={desc} onChange={e => setDesc(e.target.value)} style={inputStyle} placeholder="Ej: Supermercado Coto" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Monto (ARS)"><input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0" /></Field>
        <Field label="Categoría">
          <select value={catId} onChange={e => setCatId(e.target.value)} style={inputStyle}>
            <option value="">— Sin categoría —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon}  ` : ""}{c.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Medio de pago">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {methods.map(m => (
            <button key={m} onClick={() => setPm(m)} style={{
              flex: "1 1 calc(50% - 3px)", padding: "9px 10px", fontSize: 12, fontWeight: 600,
              borderRadius: 8, border: pm === m ? `1px solid ${T.gold}` : `1px solid ${T.border}`,
              background: pm === m ? `linear-gradient(135deg, ${T.goldHi}, ${T.gold})` : "transparent",
              color: pm === m ? T.bgBase : T.textSecondary, cursor: "pointer", transition: "all 150ms",
            }}>{m}</button>
          ))}
        </div>
      </Field>
      {isCredit && (
        <Field label="Cuotas">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[1, 3, 6, 12, 18, 24].map(n => (
              <button key={n} onClick={() => setInst(n)} style={{
                flex: 1, minWidth: 56, padding: "9px 8px", fontSize: 12, fontWeight: 700,
                borderRadius: 8, border: inst === n ? `1px solid ${T.gold}` : `1px solid ${T.border}`,
                background: inst === n ? `linear-gradient(135deg, ${T.goldHi}, ${T.gold})` : "transparent",
                color: inst === n ? T.bgBase : T.textSecondary, cursor: "pointer", transition: "all 150ms",
              }}>{n === 1 ? "1 (sin cuotas)" : `${n}x`}</button>
            ))}
          </div>
          {perInst && inst > 1 && <p style={{ margin: "6px 2px 0", fontSize: 11, color: T.textMuted }}>≈ {fmtArs(perInst)} por cuota</p>}
        </Field>
      )}
      <Field label="Fecha"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={dateInputStyle} /></Field>
      <Field label="Notas (opcional)"><input value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} /></Field>
      <ModalFooter onCancel={onClose} onConfirm={save} loading={saving} confirmLabel={editing?.id ? "Guardar" : "Registrar"} />
    </Modal>
  );
}

function WithdrawalModal({ token, editing, onClose, onSaved }) {
  const [usd, setUsd] = useState(editing?.amount_usd || "");
  const [rate, setRate] = useState(editing?.exchange_rate || "");
  const [date, setDate] = useState(editing?.withdrawal_date || todayStr());
  const [notes, setNotes] = useState(editing?.notes || "");
  const [saving, setSaving] = useState(false);

  const usdN = Number(String(usd).replace(",", ".")) || 0;
  const rateN = Number(String(rate).replace(/\./g, "").replace(",", ".")) || 0;
  const ars = usdN * rateN;

  const save = async () => {
    if (usdN <= 0) return toast.error("Monto USD inválido");
    if (rateN <= 0) return toast.error("TC inválido");
    setSaving(true);
    const body = { amount_usd: usdN, exchange_rate: rateN, amount_ars: ars, withdrawal_date: date, notes: notes.trim() || null };
    if (editing?.id) await dq("mp_salary_withdrawals", { method: "PATCH", token, filters: `?id=eq.${editing.id}`, body });
    else await dq("mp_salary_withdrawals", { method: "POST", token, body });
    setSaving(false);
    toast.success(editing?.id ? "Actualizado" : "Registrado");
    onSaved();
  };

  return (
    <Modal title={editing?.id ? "Editar ingreso" : "Registrar ingreso"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="USD retirados"><input autoFocus type="text" inputMode="decimal" value={usd} onChange={e => setUsd(e.target.value)} style={inputStyle} placeholder="500" /></Field>
        <Field label="TC del día"><input type="text" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} style={inputStyle} placeholder="1250" /></Field>
      </div>
      {ars > 0 && <div style={{ padding: "10px 14px", background: T.bgSurfaceHi, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 10.5, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Equivalente ARS</p>
        <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 600, color: T.gold, fontVariantNumeric: "tabular-nums" }}>{fmtArs(ars)}</p>
      </div>}
      <Field label="Fecha"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={dateInputStyle} /></Field>
      <Field label="Notas (opcional)"><input value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} placeholder="Ej: Mitad del sueldo del mes" /></Field>
      <ModalFooter onCancel={onClose} onConfirm={save} loading={saving} confirmLabel={editing?.id ? "Guardar" : "Registrar"} />
    </Modal>
  );
}

// ────────────── Toast & atoms ──────────────
let toastListeners = [];
const toast = {
  success: (msg) => toastListeners.forEach(l => l({ kind: "success", msg })),
  error: (msg) => toastListeners.forEach(l => l({ kind: "error", msg })),
};
function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = ({ kind, msg }) => {
      const id = Math.random();
      setItems(p => [...p, { id, kind, msg }]);
      setTimeout(() => setItems(p => p.filter(x => x.id !== id)), 3000);
    };
    toastListeners.push(fn);
    return () => { toastListeners = toastListeners.filter(x => x !== fn); };
  }, []);
  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, display: "flex", flexDirection: "column", gap: 8, zIndex: 99999 }}>
      {items.map(t => (
        <div key={t.id} style={{
          padding: "12px 18px", borderRadius: 10,
          background: t.kind === "success" ? `linear-gradient(135deg, ${T.bgSurface}, ${T.bgSurfaceHi})` : "rgba(232,81,75,0.12)",
          border: `1px solid ${t.kind === "success" ? T.gold + "55" : T.danger + "55"}`,
          color: t.kind === "success" ? T.textPrimary : T.danger,
          fontSize: 13, fontWeight: 500, boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          animation: "slideIn 200ms ease",
        }}>{t.kind === "success" ? "✓" : "⚠"} {t.msg}</div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px 26px", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: T.textPrimary, letterSpacing: "-0.01em" }}>{title}</p>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.textMuted, fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onConfirm, loading, confirmLabel = "Confirmar", danger }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
      <button onClick={onCancel} style={btnSec}>Cancelar</button>
      <button onClick={onConfirm} disabled={loading} style={danger ? { ...btnPrimary, background: `linear-gradient(135deg, ${T.danger}, #C13030)`, border: `1px solid ${T.danger}`, color: "#fff", boxShadow: "0 0 14px rgba(232,81,75,0.4)" } : btnPrimary}>{loading ? "…" : confirmLabel}</button>
    </div>
  );
}

function ConfirmModal({ title, body, onConfirm, onClose, danger }) {
  const [running, setRunning] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ margin: 0, fontSize: 13.5, color: T.textSecondary, lineHeight: 1.55 }}>{body}</p>
      <ModalFooter onCancel={onClose} loading={running} danger={danger} confirmLabel={danger ? "Eliminar" : "Confirmar"} onConfirm={async () => { setRunning(true); try { await onConfirm(); } catch (e) { toast.error("Error"); } setRunning(false); onClose(); }} />
    </Modal>
  );
}

function Card({ children, padded = true }) {
  return <div className={padded ? "cnb-card" : ""} style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, padding: padded ? undefined : 0, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>{children}</div>;
}

function SectionHeader({ title, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.textPrimary, letterSpacing: "-0.01em" }}>{title}</p>
      {action}
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ padding: "16px 18px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12, borderTop: `2px solid ${accent}` }}>
      <p style={{ margin: 0, fontSize: 10, color: T.textMuted, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>{label}</p>
      <p style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 600, color: T.textPrimary, letterSpacing: "-0.01em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11, color: T.textSecondary }}>{sub}</p>
    </div>
  );
}

// Paleta financiera (tonos sobrios, sin el rojo/dorado del cinabrio que se cruzaban con Hábitos):
//   in    → emerald sutil (entradas)
//   out   → coral profundo (salidas)
//   hero  → verde vivo con glow (saldo disponible)
const F = {
  inText: "#5AB897",   // verde teal suave
  inBg:   "rgba(90,184,151,0.08)",
  inBorder: "rgba(90,184,151,0.28)",
  outText: "#E27876",  // coral
  outBg:   "rgba(226,120,118,0.08)",
  outBorder: "rgba(226,120,118,0.28)",
  heroGreen: "#22C55E",
  heroGreenDeep: "#15803D",
  heroGlow: "0 0 50px rgba(34,197,94,0.25)",
  heroRed: "#EF4444",
  heroRedDeep: "#991B1B",
};

function FinanceCard({ label, value, sub, kind }) {
  const isIn = kind === "in";
  const fg = isIn ? F.inText : F.outText;
  const bg = isIn ? F.inBg : F.outBg;
  const bd = isIn ? F.inBorder : F.outBorder;
  const sign = isIn ? "▲" : "▼";
  return (
    <div style={{ padding: "14px 16px", background: bg, border: `1px solid ${bd}`, borderRadius: 12 }}>
      <p style={{ margin: 0, fontSize: 9.5, color: fg, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11 }}>{sign}</span> {label}
      </p>
      <p style={{ margin: "6px 0 2px", fontSize: 18, fontWeight: 700, color: T.textPrimary, letterSpacing: "-0.01em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p style={{ margin: 0, fontSize: 10.5, color: T.textMuted }}>{sub}</p>
    </div>
  );
}

function HeroDispoCard({ ingresado, gastado }) {
  const dispo = ingresado - gastado;
  const positive = dispo >= 0;
  const color = positive ? F.heroGreen : F.heroRed;
  const colorDeep = positive ? F.heroGreenDeep : F.heroRedDeep;
  const glow = positive ? F.heroGlow : "0 0 50px rgba(239,68,68,0.22)";
  return (
    <div style={{
      padding: "26px 22px 22px",
      background: `linear-gradient(160deg, ${color}1F 0%, ${colorDeep}14 60%, rgba(22,16,14,0) 100%)`,
      border: `1.5px solid ${color}55`,
      borderRadius: 16,
      textAlign: "center",
      boxShadow: glow,
      position: "relative",
      overflow: "hidden",
    }}>
      <p style={{ margin: 0, fontSize: 10.5, color, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800, opacity: 0.95 }}>
        {positive ? "Disponible" : "Déficit"}
      </p>
      <p style={{
        margin: "10px 0 2px", fontSize: 32, fontWeight: 800, color, letterSpacing: "-0.02em",
        lineHeight: 1.05, fontVariantNumeric: "tabular-nums",
        textShadow: `0 0 22px ${color}55`,
      }}>
        {fmtArs(Math.abs(dispo))}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: T.textSecondary, letterSpacing: "0.04em" }}>
        {positive ? "en mano este mes" : "este mes (gastos > ingresos)"}
      </p>
    </div>
  );
}

function EmptyState({ text, action }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <p style={{ color: T.textMuted, fontSize: 13, fontStyle: "italic", margin: action ? "0 0 16px" : 0 }}>{text}</p>
      {action}
    </div>
  );
}

function Badge({ color, label }) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: `${color}1A`, color, border: `1px solid ${color}40`, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>;
}

function Chip({ children, active, onClick }) {
  return <button onClick={onClick} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, borderRadius: 999, border: active ? `1px solid ${T.gold}` : `1px solid ${T.border}`, background: active ? `${T.gold}1A` : "transparent", color: active ? T.gold : T.textSecondary, cursor: "pointer", letterSpacing: "0.04em" }}>{children}</button>;
}

function SubTab({ children, active, onClick }) {
  return <button onClick={onClick} style={{ padding: "9px 16px", fontSize: 13, fontWeight: 600, borderRadius: 999, border: active ? `1px solid ${T.borderHi}` : "1px solid transparent", background: active ? T.bgSurface : "transparent", color: active ? T.textPrimary : T.textSecondary, cursor: "pointer", transition: "all 160ms", letterSpacing: "0.02em" }}>{children}</button>;
}

function IconBtn({ children, onClick, title, danger }) {
  return <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={title} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${danger ? T.danger + "40" : T.border}`, background: "transparent", color: danger ? T.danger : T.textSecondary, cursor: "pointer", fontSize: 14, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
    onMouseEnter={e => { e.currentTarget.style.background = danger ? `${T.danger}1A` : T.bgSurfaceHi; e.currentTarget.style.color = danger ? T.danger : T.textPrimary; }}
    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = danger ? T.danger : T.textSecondary; }}>{children}</button>;
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "flex", alignItems: "flex-end", fontSize: 10.5, fontWeight: 700, color: T.textMuted, marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase", minHeight: 28, lineHeight: 1.25 }}>{label}</label>}
      {children}
    </div>
  );
}

function daysToLabel(mask) {
  if (mask === 127) return "Todos los días";
  if (mask === 31) return "Lunes a Viernes";
  if (mask === 96) return "Fin de semana";
  return DAYS.filter((_, i) => mask & (1 << i)).join(" · ");
}

// Label legible para mostrar al usuario la frecuencia de un hábito.
const NTH_LABEL = { 1: "1er", 2: "2do", 3: "3er", 4: "4to", 5: "Último" };
function frequencyLabel(h) {
  if (!h) return "";
  const type = h.frequency_type || "weekly";
  if (type === "weekly") return daysToLabel(h.days_of_week || 0);
  if (type === "monthly_nth_weekday") {
    const nth = NTH_LABEL[h.monthly_nth] || "?";
    const wd = DAYS_SHORT_FULL[h.monthly_weekday] || "?";
    return `${nth} ${wd} de cada mes`;
  }
  if (type === "every_n_days") {
    const n = Number(h.every_n_days || 0);
    if (n === 1) return "Cada día";
    if (n === 7) return "Cada semana";
    if (n === 14) return "Cada 2 semanas";
    if (n === 30) return "Cada mes (aprox)";
    return `Cada ${n} días`;
  }
  return "";
}

const inputStyle = { width: "100%", padding: "11px 14px", fontSize: 13.5, fontWeight: 500, border: `1px solid ${T.border}`, borderRadius: 8, background: T.bgSurfaceHi, color: T.textPrimary, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
// Reset específico para inputs date — iOS Safari aplica un layout propio que recorta el
// texto (queda "1 jun 2026" pegado al borde izquierdo) si no se desactiva el appearance.
const dateInputStyle = { ...inputStyle, WebkitAppearance: "none", appearance: "none", minHeight: 46, lineHeight: "20px", textAlign: "left" };
const btnPrimary = { padding: "10px 18px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: `1px solid ${T.gold}`, background: `linear-gradient(135deg, ${T.goldHi}, ${T.gold})`, color: T.bgBase, cursor: "pointer", letterSpacing: "0.04em", boxShadow: T.goldGlow, whiteSpace: "nowrap" };
const btnSec = { padding: "10px 16px", fontSize: 12.5, fontWeight: 600, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textPrimary, cursor: "pointer", whiteSpace: "nowrap" };
const btnGhost = { padding: "8px 14px", fontSize: 12, fontWeight: 500, borderRadius: 8, border: "none", background: "transparent", color: T.textSecondary, cursor: "pointer", whiteSpace: "nowrap" };
