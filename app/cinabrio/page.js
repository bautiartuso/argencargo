"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { dq, loadSession, clearSession, ac, saveSession } from "../../lib/sb-client";

// ──────────────────────────────────────────────────────────────────────
// CINABRIO · módulo personal · hábitos + finanzas
// Estética propia: negro + rojo + dorado cálido. Inter para todo.
// ──────────────────────────────────────────────────────────────────────

const T = {
  bgBase: "#0A0606",
  bgSurface: "#16100E",
  bgSurfaceHi: "#1F1815",
  border: "#2A1F1B",
  borderHi: "#3D2D26",
  red: "#C8102E",
  redDeep: "#8E0820",
  redSoft: "rgba(200,16,46,0.12)",
  gold: "#C8941B",
  goldHi: "#E0A832",
  goldSoft: "#8A5F1B",
  goldGlow: "0 0 14px rgba(200,148,27,0.45)",
  textPrimary: "#F4E8D3",
  textSecondary: "rgba(244,232,211,0.62)",
  textMuted: "rgba(244,232,211,0.35)",
  success: "#7FB069",
  danger: "#E8514B",
};

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const todayStr = () => new Date().toISOString().slice(0, 10);
const todayDow = () => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }; // 0..6 (L..D)
const monthStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const fmtArs = (n) => `ARS ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtUsd = (n) => `USD ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:${T.bgBase};color:${T.textPrimary};font-feature-settings:'cv11','ss03'}
  ::selection{background:${T.gold}55;color:${T.textPrimary}}
  ::-webkit-scrollbar{width:8px;height:8px}
  ::-webkit-scrollbar-track{background:${T.bgBase}}
  ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
  ::-webkit-scrollbar-thumb:hover{background:${T.borderHi}}
  button{font-family:inherit}
  input,textarea,select{font-family:inherit}
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

  if (restoring) return <Splash />;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <Toaster />
      {!session ? <Login onLogin={s => setSession(s)} /> : <Dashboard session={session} onLogout={() => { clearSession(); setSession(null); }} />}
    </>
  );
}

function Splash() {
  return <div style={{ minHeight: "100vh", background: T.bgBase, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontFamily: "Inter, sans-serif" }}>...</div>;
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
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at top, ${T.bgSurface} 0%, ${T.bgBase} 70%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 380, padding: "36px 32px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26 }}>
            <Logo size={62} />
            <p style={{ margin: "16px 0 4px", fontSize: 28, fontWeight: 600, color: T.textPrimary, letterSpacing: "-0.02em" }}>Cinabrio</p>
            <p style={{ margin: 0, fontSize: 11, color: T.textMuted, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>Ingreso</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Contraseña" style={inputStyle} />
            {err && <p style={{ margin: 0, fontSize: 12, color: T.danger, fontWeight: 500 }}>⚠ {err}</p>}
            <button onClick={submit} disabled={lo} style={{ ...btnPrimary, width: "100%", padding: "12px 16px", marginTop: 6 }}>{lo ? "Ingresando…" : "Entrar"}</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────── Dashboard ───────
function Dashboard({ session, onLogout }) {
  const [tab, setTab] = useState("hoy");
  const [habitCats, setHabitCats] = useState([]);
  const [habits, setHabits] = useState([]);
  const [habitLog, setHabitLog] = useState([]);
  const [expCats, setExpCats] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [settings, setSettings] = useState({ monthly_salary_usd: 1500 });
  const [lo, setLo] = useState(true);
  const token = session.token;

  const load = useCallback(async () => {
    setLo(true);
    const [hc, h, hl, ec, e, w, s] = await Promise.all([
      dq("mp_habit_categories", { token, filters: "?select=*&order=sort_order.asc,name.asc" }),
      dq("mp_habits", { token, filters: "?select=*&archived_at=is.null&order=time.asc,sort_order.asc" }),
      dq("mp_habit_log", { token, filters: `?select=*&log_date=gte.${addDays(-90)}&order=log_date.desc` }),
      dq("mp_expense_categories", { token, filters: "?select=*&order=sort_order.asc,name.asc" }),
      dq("mp_expenses", { token, filters: `?select=*&expense_date=gte.${addDays(-180)}&order=expense_date.desc` }),
      dq("mp_salary_withdrawals", { token, filters: `?select=*&withdrawal_date=gte.${addDays(-180)}&order=withdrawal_date.desc` }),
      dq("mp_settings", { token, filters: "?select=*&id=eq.1" }),
    ]);
    setHabitCats(Array.isArray(hc) ? hc : []);
    setHabits(Array.isArray(h) ? h : []);
    setHabitLog(Array.isArray(hl) ? hl : []);
    setExpCats(Array.isArray(ec) ? ec : []);
    setExpenses(Array.isArray(e) ? e : []);
    setWithdrawals(Array.isArray(w) ? w : []);
    setSettings(Array.isArray(s) && s[0] ? s[0] : { monthly_salary_usd: 1500 });
    setLo(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at top, ${T.bgSurface} 0%, ${T.bgBase} 75%)` }}>
      <Header onLogout={onLogout} user={session.user?.email?.split("@")[0] || "Bauti"} />
      <Tabs tab={tab} setTab={setTab} />
      <main style={{ padding: "24px 32px 60px", maxWidth: 1200, margin: "0 auto" }}>
        {lo ? <p style={{ textAlign: "center", color: T.textMuted, padding: "80px 0", fontSize: 13 }}>Cargando…</p> : <>
          {tab === "hoy" && <Hoy {...{ token, habits, habitCats, habitLog, expCats, expenses, withdrawals, settings, reload: load }} />}
          {tab === "habitos" && <Habitos {...{ token, habits, habitCats, habitLog, reload: load }} />}
          {tab === "finanzas" && <Finanzas {...{ token, expCats, expenses, withdrawals, settings, reload: load }} />}
          {tab === "ajustes" && <Ajustes {...{ token, settings, reload: load }} />}
        </>}
      </main>
    </div>
  );
}

function Logo({ size = 48 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.22, background: `linear-gradient(135deg, ${T.red}, ${T.redDeep})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 24px ${T.red}40, inset 0 1px 0 rgba(255,255,255,0.08)`, position: "relative", overflow: "hidden" }}>
      <span style={{ fontSize: size * 0.56, fontWeight: 700, color: T.gold, lineHeight: 1, fontFamily: "serif", textShadow: `0 1px 2px rgba(0,0,0,0.3)` }}>馬</span>
    </div>
  );
}

function Header({ user, onLogout }) {
  return (
    <header style={{ borderBottom: `1px solid ${T.border}`, padding: "18px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(10,6,6,0.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Logo size={40} />
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: T.textPrimary }}>Cinabrio</p>
          <p style={{ margin: "2px 0 0", fontSize: 10.5, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>{new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12.5, color: T.textSecondary, fontWeight: 500 }}>{user}</span>
        <button onClick={onLogout} style={{ ...btnGhost, padding: "7px 14px" }}>Salir</button>
      </div>
    </header>
  );
}

function Tabs({ tab, setTab }) {
  const items = [
    { k: "hoy", l: "Hoy" },
    { k: "habitos", l: "Hábitos" },
    { k: "finanzas", l: "Finanzas" },
    { k: "ajustes", l: "Ajustes" },
  ];
  return (
    <nav style={{ display: "flex", justifyContent: "center", gap: 2, padding: "0 32px", borderBottom: `1px solid ${T.border}`, maxWidth: 1200, margin: "0 auto" }}>
      {items.map(t => (
        <button key={t.k} onClick={() => setTab(t.k)} style={{
          padding: "16px 24px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: "transparent",
          color: tab === t.k ? T.textPrimary : T.textMuted,
          borderBottom: tab === t.k ? `2px solid ${T.gold}` : "2px solid transparent",
          marginBottom: -1, letterSpacing: "0.14em", textTransform: "uppercase", transition: "color 180ms",
        }}>{t.l}</button>
      ))}
    </nav>
  );
}

// ─────── HOY ───────
function Hoy({ token, habits, habitCats, habitLog, expCats, expenses, withdrawals, settings, reload }) {
  const ts = todayStr();
  const dow = todayDow();
  const todaysHabits = habits.filter(h => h.days_of_week & (1 << dow));
  const todaysLog = habitLog.filter(l => l.log_date === ts);
  const completedIds = new Set(todaysLog.filter(l => l.completed_at).map(l => l.habit_id));
  const pct = todaysHabits.length > 0 ? Math.round(completedIds.size / todaysHabits.length * 100) : 0;

  const toggle = async (h) => {
    const existing = todaysLog.find(l => l.habit_id === h.id);
    if (existing) {
      const wasDone = !!existing.completed_at;
      await dq("mp_habit_log", { method: "PATCH", token, filters: `?id=eq.${existing.id}`, body: { completed_at: wasDone ? null : new Date().toISOString() } });
    } else {
      await dq("mp_habit_log", { method: "POST", token, body: { habit_id: h.id, log_date: ts, completed_at: new Date().toISOString() } });
    }
    reload();
  };

  // Métricas finanzas mes
  const m = monthStr();
  const monthExp = expenses.filter(e => e.expense_date.slice(0, 7) === m);
  const monthWithdraw = withdrawals.filter(w => w.withdrawal_date.slice(0, 7) === m);
  const totalSpent = monthExp.reduce((s, e) => s + Number(e.amount_ars || 0), 0);
  const totalIncome = monthWithdraw.reduce((s, w) => s + Number(w.amount_ars || 0), 0);
  const available = totalIncome - totalSpent;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Progreso del día */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: T.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>Hoy</p>
            <p style={{ margin: "6px 0 0", fontSize: 38, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1, color: T.textPrimary }}>{pct}%</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textSecondary }}>{completedIds.size} de {todaysHabits.length} hábitos completados</p>
          </div>
          <div style={{ minWidth: 220, flex: 1, maxWidth: 320 }}>
            <ProgressBar pct={pct} />
          </div>
        </div>
      </Card>

      {/* Lista de hábitos de hoy */}
      <Card padded={false}>
        <CardHeader title="Hábitos de hoy" sub={DAYS_FULL[dow]} />
        {todaysHabits.length === 0 ? (
          <EmptyState text="No hay hábitos programados para hoy" />
        ) : (
          <div>{todaysHabits.map((h, i) => {
            const cat = habitCats.find(c => c.id === h.category_id);
            const done = completedIds.has(h.id);
            return (
              <HabitRow key={h.id} habit={h} cat={cat} done={done} onToggle={() => toggle(h)} last={i === todaysHabits.length - 1} />
            );
          })}</div>
        )}
      </Card>

      {/* Resumen finanzas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14 }}>
        <StatCard label="Ingresado este mes" value={fmtArs(totalIncome)} sub={`${monthWithdraw.length} retiro${monthWithdraw.length !== 1 ? "s" : ""}`} accent={T.gold} />
        <StatCard label="Gastado" value={fmtArs(totalSpent)} sub={`${monthExp.length} gasto${monthExp.length !== 1 ? "s" : ""}`} accent={T.red} />
        <StatCard label="Disponible" value={fmtArs(available)} sub={available >= 0 ? "en mano" : "en rojo"} accent={available >= 0 ? T.success : T.danger} />
      </div>
    </div>
  );
}

function HabitRow({ habit, cat, done, onToggle, last }) {
  return (
    <div onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: 16, padding: "15px 20px",
      borderBottom: last ? "none" : `1px solid ${T.border}`,
      cursor: "pointer", transition: "background 160ms", opacity: done ? 0.55 : 1,
    }} onMouseEnter={e => e.currentTarget.style.background = T.bgSurfaceHi} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <Check done={done} />
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5, color: T.textMuted, minWidth: 48, fontFeatureSettings: '"tnum"', fontWeight: 500 }}>{habit.time ? String(habit.time).slice(0, 5) : "—"}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: T.textPrimary, textDecoration: done ? "line-through" : "none" }}>{habit.name}</span>
      {cat && <Badge color={cat.color || T.gold} label={cat.name} />}
    </div>
  );
}

function Check({ done }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 6,
      border: done ? `1.5px solid ${T.gold}` : `1.5px solid ${T.borderHi}`,
      background: done ? `linear-gradient(135deg, ${T.goldHi}, ${T.gold})` : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: done ? T.goldGlow : "none", transition: "all 200ms",
    }}>
      {done && <svg width="13" height="13" viewBox="0 0 16 16"><path d="M3 8l3.5 3.5L13 5" stroke={T.bgBase} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </div>
  );
}

// ─────── HÁBITOS ───────
function Habitos({ token, habits, habitCats, habitLog, reload }) {
  const [editCat, setEditCat] = useState(null);
  const [editHabit, setEditHabit] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const delCat = async (c) => {
    setConfirm({ title: "Eliminar categoría", body: `¿Eliminar "${c.name}"? Los hábitos asociados quedan sin categoría.`, danger: true, onConfirm: async () => { await dq("mp_habit_categories", { method: "DELETE", token, filters: `?id=eq.${c.id}` }); reload(); toast.success("Categoría eliminada"); } });
  };
  const delHabit = async (h) => {
    setConfirm({ title: "Eliminar hábito", body: `¿Eliminar "${h.name}"? Se pierde el historial.`, danger: true, onConfirm: async () => { await dq("mp_habits", { method: "DELETE", token, filters: `?id=eq.${h.id}` }); reload(); toast.success("Hábito eliminado"); } });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Categorías */}
      <div>
        <SectionHeader title="Categorías" action={<button onClick={() => setEditCat({})} style={btnPrimary}>+ Nueva</button>} />
        {habitCats.length === 0 ? (
          <Card><EmptyState text="Sin categorías. Creá la primera para organizar tus hábitos." /></Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
            {habitCats.map(c => {
              const count = habits.filter(h => h.category_id === c.id).length;
              return (
                <div key={c.id} style={{ padding: "14px 16px", background: T.bgSurface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${c.color || T.gold}`, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{c.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted }}>{count} hábito{count !== 1 ? "s" : ""}</p>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <IconBtn onClick={() => setEditCat(c)} title="Editar">✎</IconBtn>
                    <IconBtn onClick={() => delCat(c)} title="Eliminar" danger>×</IconBtn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hábitos */}
      <div>
        <SectionHeader title={`Hábitos (${habits.length})`} action={<button onClick={() => setEditHabit({})} style={btnPrimary}>+ Nuevo hábito</button>} />
        {habits.length === 0 ? (
          <Card><EmptyState text="Sin hábitos. Definí qué querés hacer cada día." /></Card>
        ) : (
          <Card padded={false}>
            {habits.map((h, i) => {
              const cat = habitCats.find(c => c.id === h.category_id);
              return (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderBottom: i === habits.length - 1 ? "none" : `1px solid ${T.border}` }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: T.textMuted, minWidth: 50, fontWeight: 500 }}>{h.time ? String(h.time).slice(0, 5) : "—"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.textPrimary }}>{h.name}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: T.textMuted }}>{daysToLabel(h.days_of_week)}</p>
                  </div>
                  {cat && <Badge color={cat.color || T.gold} label={cat.name} />}
                  <div style={{ display: "flex", gap: 4 }}>
                    <IconBtn onClick={() => setEditHabit(h)} title="Editar">✎</IconBtn>
                    <IconBtn onClick={() => delHabit(h)} title="Eliminar" danger>×</IconBtn>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {editCat && <CategoryModal mode="habit" token={token} editing={editCat.id ? editCat : null} onClose={() => setEditCat(null)} onSaved={() => { setEditCat(null); reload(); }} />}
      {editHabit && <HabitModal token={token} editing={editHabit.id ? editHabit : null} categories={habitCats} onClose={() => setEditHabit(null)} onSaved={() => { setEditHabit(null); reload(); }} />}
      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// ─────── FINANZAS ───────
function Finanzas({ token, expCats, expenses, withdrawals, settings, reload }) {
  const [editCat, setEditCat] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [editWithdraw, setEditWithdraw] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [month, setMonth] = useState(monthStr());

  const monthExp = expenses.filter(e => e.expense_date.slice(0, 7) === month);
  const monthWdraw = withdrawals.filter(w => w.withdrawal_date.slice(0, 7) === month);
  const totalSpent = monthExp.reduce((s, e) => s + Number(e.amount_ars || 0), 0);
  const totalIn = monthWdraw.reduce((s, w) => s + Number(w.amount_ars || 0), 0);
  const totalBudget = expCats.reduce((s, c) => s + Number(c.monthly_budget_ars || 0), 0);

  const delCat = (c) => setConfirm({ title: "Eliminar categoría", body: `¿Eliminar "${c.name}"? Los gastos asociados quedan sin categoría.`, danger: true, onConfirm: async () => { await dq("mp_expense_categories", { method: "DELETE", token, filters: `?id=eq.${c.id}` }); reload(); toast.success("Categoría eliminada"); } });
  const delExp = (e) => setConfirm({ title: "Eliminar gasto", body: `¿Eliminar este gasto de ${fmtArs(e.amount_ars)}?`, danger: true, onConfirm: async () => { await dq("mp_expenses", { method: "DELETE", token, filters: `?id=eq.${e.id}` }); reload(); toast.success("Gasto eliminado"); } });
  const delWdraw = (w) => setConfirm({ title: "Eliminar retiro", body: `¿Eliminar retiro de ${fmtUsd(w.amount_usd)}?`, danger: true, onConfirm: async () => { await dq("mp_salary_withdrawals", { method: "DELETE", token, filters: `?id=eq.${w.id}` }); reload(); toast.success("Retiro eliminado"); } });

  const navMonth = (d) => {
    const [y, m] = month.split("-").map(Number);
    const dt = new Date(y, m - 1 + d, 1);
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Header mes */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navMonth(-1)} style={btnSec}>‹</button>
          <p style={{ margin: "0 8px", fontSize: 20, fontWeight: 600, color: T.textPrimary, letterSpacing: "-0.01em", minWidth: 180, textAlign: "center" }}>
            {new Date(month + "-01").toLocaleDateString("es-AR", { month: "long", year: "numeric" }).replace(/^./, c => c.toUpperCase())}
          </p>
          <button onClick={() => navMonth(1)} style={btnSec}>›</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setEditWithdraw({})} style={btnSec}>+ Retiro sueldo</button>
          <button onClick={() => setEditExpense({})} style={btnPrimary}>+ Gasto</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14 }}>
        <StatCard label="Ingresado" value={fmtArs(totalIn)} sub={monthWdraw.length === 0 ? "Sin retiros aún" : `${fmtUsd(monthWdraw.reduce((s, w) => s + Number(w.amount_usd || 0), 0))} en total`} accent={T.gold} />
        <StatCard label="Gastado" value={fmtArs(totalSpent)} sub={totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(0)}% del presupuesto` : `${monthExp.length} mov.`} accent={T.red} />
        <StatCard label="Disponible" value={fmtArs(totalIn - totalSpent)} sub={totalIn - totalSpent >= 0 ? "en mano" : "déficit"} accent={totalIn - totalSpent >= 0 ? T.success : T.danger} />
      </div>

      {/* Categorías con presupuesto */}
      <div>
        <SectionHeader title="Categorías y presupuestos" action={<button onClick={() => setEditCat({})} style={btnPrimary}>+ Categoría</button>} />
        {expCats.length === 0 ? (
          <Card><EmptyState text="Definí categorías con presupuesto mensual para controlar el gasto." /></Card>
        ) : (
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {expCats.map(c => {
                const spent = monthExp.filter(e => e.category_id === c.id).reduce((s, e) => s + Number(e.amount_ars || 0), 0);
                const budget = Number(c.monthly_budget_ars || 0);
                const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                const over = budget > 0 && spent > budget;
                return (
                  <div key={c.id} style={{ padding: "12px 14px", background: T.bgSurfaceHi, borderRadius: 10, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7, gap: 10 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: c.color || T.gold }} /> {c.name}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12.5, color: over ? T.danger : T.textSecondary, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                          {fmtArs(spent)}{budget > 0 && ` / ${fmtArs(budget)}`}
                        </span>
                        <IconBtn onClick={() => setEditCat(c)} title="Editar">✎</IconBtn>
                        <IconBtn onClick={() => delCat(c)} title="Eliminar" danger>×</IconBtn>
                      </div>
                    </div>
                    {budget > 0 && <div style={{ height: 5, background: T.bgSurface, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: over ? T.danger : c.color || T.gold, transition: "width 300ms" }} />
                    </div>}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Retiros del mes */}
      <div>
        <SectionHeader title={`Retiros del sueldo (${monthWdraw.length})`} />
        {monthWdraw.length === 0 ? (
          <Card><EmptyState text="Sin retiros este mes." /></Card>
        ) : (
          <Card padded={false}>
            {monthWdraw.map((w, i) => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderBottom: i === monthWdraw.length - 1 ? "none" : `1px solid ${T.border}` }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: T.textMuted, minWidth: 78, fontWeight: 500 }}>{w.withdrawal_date.slice(5).split("-").reverse().join("/")}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.textPrimary, fontVariantNumeric: "tabular-nums" }}>{fmtUsd(w.amount_usd)} → {fmtArs(w.amount_ars)}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: T.textMuted }}>TC ${Number(w.exchange_rate).toLocaleString("es-AR")} · {w.notes || ""}</p>
                </div>
                <IconBtn onClick={() => setEditWithdraw(w)} title="Editar">✎</IconBtn>
                <IconBtn onClick={() => delWdraw(w)} title="Eliminar" danger>×</IconBtn>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Gastos del mes */}
      <div>
        <SectionHeader title={`Gastos del mes (${monthExp.length})`} />
        {monthExp.length === 0 ? (
          <Card><EmptyState text="Aún sin gastos este mes." /></Card>
        ) : (
          <Card padded={false}>
            {monthExp.map((e, i) => {
              const cat = expCats.find(c => c.id === e.category_id);
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderBottom: i === monthExp.length - 1 ? "none" : `1px solid ${T.border}` }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: T.textMuted, minWidth: 50, fontWeight: 500 }}>{e.expense_date.slice(5).split("-").reverse().join("/")}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description || "(sin descripción)"}</p>
                    {cat && <p style={{ margin: "2px 0 0", fontSize: 11, color: cat.color || T.gold, fontWeight: 600 }}>{cat.name}</p>}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, fontVariantNumeric: "tabular-nums" }}>{fmtArs(e.amount_ars)}</span>
                  <IconBtn onClick={() => setEditExpense(e)} title="Editar">✎</IconBtn>
                  <IconBtn onClick={() => delExp(e)} title="Eliminar" danger>×</IconBtn>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {editCat && <CategoryModal mode="expense" token={token} editing={editCat.id ? editCat : null} onClose={() => setEditCat(null)} onSaved={() => { setEditCat(null); reload(); }} />}
      {editExpense && <ExpenseModal token={token} editing={editExpense.id ? editExpense : null} categories={expCats} onClose={() => setEditExpense(null)} onSaved={() => { setEditExpense(null); reload(); }} />}
      {editWithdraw && <WithdrawalModal token={token} editing={editWithdraw.id ? editWithdraw : null} onClose={() => setEditWithdraw(null)} onSaved={() => { setEditWithdraw(null); reload(); }} />}
      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

// ─────── AJUSTES ───────
function Ajustes({ token, settings, reload }) {
  const [salary, setSalary] = useState(settings.monthly_salary_usd || 1500);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await dq("mp_settings", { method: "PATCH", token, filters: "?id=eq.1", body: { monthly_salary_usd: Number(salary), updated_at: new Date().toISOString() } });
    setSaving(false);
    reload();
    toast.success("Configuración guardada");
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <SectionHeader title="Configuración" />
      <Card>
        <Field label="Sueldo mensual (USD)">
          <input type="number" value={salary} onChange={e => setSalary(e.target.value)} style={inputStyle} />
        </Field>
        <p style={{ fontSize: 11.5, color: T.textMuted, margin: "8px 0 16px", lineHeight: 1.5 }}>
          El sueldo que te asignás desde Argencargo. Lo usamos como referencia para el panel mensual.
        </p>
        <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Guardando…" : "Guardar"}</button>
      </Card>
    </div>
  );
}

// ─────── MODALES ───────
function CategoryModal({ mode, token, editing, onClose, onSaved }) {
  const isHabit = mode === "habit";
  const table = isHabit ? "mp_habit_categories" : "mp_expense_categories";
  const colors = [T.red, T.gold, "#7FB069", "#FF9F66", "#C9A4FF", "#5BA8FF", "#FFB5A7", "#A0855B"];
  const [name, setName] = useState(editing?.name || "");
  const [color, setColor] = useState(editing?.color || colors[0]);
  const [budget, setBudget] = useState(editing?.monthly_budget_ars || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Falta el nombre");
    setSaving(true);
    const body = { name: name.trim(), color };
    if (!isHabit) body.monthly_budget_ars = Number(budget) || 0;
    if (editing?.id) await dq(table, { method: "PATCH", token, filters: `?id=eq.${editing.id}`, body });
    else await dq(table, { method: "POST", token, body });
    setSaving(false);
    onSaved();
    toast.success(editing?.id ? "Categoría actualizada" : "Categoría creada");
  };

  return (
    <Modal title={editing?.id ? "Editar categoría" : "Nueva categoría"} onClose={onClose}>
      <Field label="Nombre"><input autoFocus value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={isHabit ? "Cuerpo, Trabajo, Mente…" : "Comida, Transporte, Salidas…"} /></Field>
      <Field label="Color">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {colors.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{ width: 34, height: 34, borderRadius: 8, background: c, border: color === c ? `2px solid ${T.textPrimary}` : `1px solid ${T.border}`, cursor: "pointer", padding: 0, boxShadow: color === c ? `0 0 10px ${c}66` : "none" }} />
          ))}
        </div>
      </Field>
      {!isHabit && <Field label="Presupuesto mensual (ARS)"><input type="number" value={budget} onChange={e => setBudget(e.target.value)} style={inputStyle} placeholder="0" /></Field>}
      <ModalFooter onCancel={onClose} onConfirm={save} loading={saving} confirmLabel={editing?.id ? "Guardar" : "Crear"} />
    </Modal>
  );
}

function HabitModal({ token, editing, categories, onClose, onSaved }) {
  const [name, setName] = useState(editing?.name || "");
  const [catId, setCatId] = useState(editing?.category_id || categories[0]?.id || "");
  const [time, setTime] = useState(editing?.time?.slice(0, 5) || "");
  const [days, setDays] = useState(editing?.days_of_week ?? 31);
  const [notify, setNotify] = useState(editing?.notify_enabled ?? false);
  const [saving, setSaving] = useState(false);

  const toggleDay = (i) => setDays(p => p ^ (1 << i));

  const save = async () => {
    if (!name.trim()) return toast.error("Falta el nombre");
    if (days === 0) return toast.error("Elegí al menos un día");
    setSaving(true);
    const body = { name: name.trim(), category_id: catId || null, time: time || null, days_of_week: days, notify_enabled: notify };
    if (editing?.id) await dq("mp_habits", { method: "PATCH", token, filters: `?id=eq.${editing.id}`, body });
    else await dq("mp_habits", { method: "POST", token, body });
    setSaving(false);
    onSaved();
    toast.success(editing?.id ? "Hábito actualizado" : "Hábito creado");
  };

  return (
    <Modal title={editing?.id ? "Editar hábito" : "Nuevo hábito"} onClose={onClose}>
      <Field label="Nombre"><input autoFocus value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ej: Gym empuje" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Categoría">
          <select value={catId} onChange={e => setCatId(e.target.value)} style={inputStyle}>
            <option value="">— Sin categoría —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Horario"><input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} /></Field>
      </div>
      <Field label="Días de la semana">
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
      </Field>
      <Field label="">
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: T.textPrimary }}>
          <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} style={{ accentColor: T.gold, width: 16, height: 16 }} />
          Recordatorio push a la hora del hábito (próximamente)
        </label>
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
  const [notes, setNotes] = useState(editing?.notes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = Number(String(amount).replace(/\./g, "").replace(",", "."));
    if (!isFinite(n) || n <= 0) return toast.error("Monto inválido");
    setSaving(true);
    const body = { category_id: catId || null, amount_ars: n, description: desc.trim() || null, expense_date: date, notes: notes.trim() || null };
    if (editing?.id) await dq("mp_expenses", { method: "PATCH", token, filters: `?id=eq.${editing.id}`, body });
    else await dq("mp_expenses", { method: "POST", token, body });
    setSaving(false);
    onSaved();
    toast.success(editing?.id ? "Gasto actualizado" : "Gasto registrado");
  };

  return (
    <Modal title={editing?.id ? "Editar gasto" : "Registrar gasto"} onClose={onClose}>
      <Field label="Descripción"><input autoFocus value={desc} onChange={e => setDesc(e.target.value)} style={inputStyle} placeholder="Ej: Supermercado Coto" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Monto (ARS)"><input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0" /></Field>
        <Field label="Categoría">
          <select value={catId} onChange={e => setCatId(e.target.value)} style={inputStyle}>
            <option value="">— Sin categoría —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Fecha"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></Field>
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
    onSaved();
    toast.success(editing?.id ? "Retiro actualizado" : "Retiro registrado");
  };

  return (
    <Modal title={editing?.id ? "Editar retiro" : "Registrar retiro de sueldo"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="USD retirados"><input autoFocus type="text" inputMode="decimal" value={usd} onChange={e => setUsd(e.target.value)} style={inputStyle} placeholder="500" /></Field>
        <Field label="TC del día (ARS por USD)"><input type="text" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} style={inputStyle} placeholder="1250" /></Field>
      </div>
      {ars > 0 && <div style={{ padding: "10px 14px", background: T.bgSurfaceHi, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 11, color: T.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Equivalente ARS</p>
        <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 600, color: T.gold, fontVariantNumeric: "tabular-nums" }}>{fmtArs(ars)}</p>
      </div>}
      <Field label="Fecha"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></Field>
      <Field label="Notas (opcional)"><input value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} placeholder="Ej: Mitad del sueldo del mes" /></Field>
      <ModalFooter onCancel={onClose} onConfirm={save} loading={saving} confirmLabel={editing?.id ? "Guardar" : "Registrar"} />
    </Modal>
  );
}

// ─────── Toast system ───────
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
      <style dangerouslySetInnerHTML={{ __html: `@keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}` }} />
    </div>
  );
}

// ─────── UI atoms ───────
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
      <button onClick={onConfirm} disabled={loading} style={danger ? { ...btnPrimary, background: `linear-gradient(135deg, ${T.danger}, #C13030)`, border: `1px solid ${T.danger}`, color: "#fff" } : btnPrimary}>{loading ? "…" : confirmLabel}</button>
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
  return <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, padding: padded ? "20px 22px" : 0, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>{children}</div>;
}

function CardHeader({ title, sub }) {
  return (
    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <p style={{ margin: 0, fontSize: 12, color: T.textMuted, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>{title}</p>
      {sub && <p style={{ margin: 0, fontSize: 12, color: T.gold, fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.textPrimary, letterSpacing: "-0.01em" }}>{title}</p>
      {action}
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <>
      <div style={{ height: 8, background: T.bgSurfaceHi, borderRadius: 4, overflow: "hidden", border: `1px solid ${T.border}` }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${T.redDeep}, ${T.red}, ${T.gold})`, transition: "width 500ms ease", boxShadow: pct > 0 ? `0 0 10px ${T.gold}55` : "none" }} />
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 10, color: T.textMuted, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>Progreso</p>
    </>
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

function EmptyState({ text }) {
  return <p style={{ padding: "40px 20px", textAlign: "center", color: T.textMuted, fontSize: 13, fontStyle: "italic", margin: 0 }}>{text}</p>;
}

function Badge({ color, label }) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: `${color}1A`, color, border: `1px solid ${color}40`, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>;
}

function IconBtn({ children, onClick, title, danger }) {
  return <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={title} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${danger ? T.danger + "40" : T.border}`, background: "transparent", color: danger ? T.danger : T.textSecondary, cursor: "pointer", fontSize: 14, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 150ms" }}
    onMouseEnter={e => { e.currentTarget.style.background = danger ? `${T.danger}1A` : T.bgSurfaceHi; e.currentTarget.style.color = danger ? T.danger : T.textPrimary; }}
    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = danger ? T.danger : T.textSecondary; }}>{children}</button>;
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: T.textMuted, marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</label>}
      {children}
    </div>
  );
}

// helpers
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function daysToLabel(mask) {
  if (mask === 127) return "Todos los días";
  if (mask === 31) return "Lunes a Viernes";
  if (mask === 96) return "Fin de semana";
  return DAYS.filter((_, i) => mask & (1 << i)).join(" · ");
}

// styles
const inputStyle = { width: "100%", padding: "11px 14px", fontSize: 13.5, fontWeight: 500, border: `1px solid ${T.border}`, borderRadius: 8, background: T.bgSurfaceHi, color: T.textPrimary, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const btnPrimary = { padding: "10px 18px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: `1px solid ${T.gold}`, background: `linear-gradient(135deg, ${T.goldHi}, ${T.gold})`, color: T.bgBase, cursor: "pointer", letterSpacing: "0.04em", boxShadow: T.goldGlow, whiteSpace: "nowrap" };
const btnSec = { padding: "10px 16px", fontSize: 12.5, fontWeight: 600, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textPrimary, cursor: "pointer", whiteSpace: "nowrap" };
const btnGhost = { padding: "8px 14px", fontSize: 12, fontWeight: 500, borderRadius: 8, border: "none", background: "transparent", color: T.textSecondary, cursor: "pointer", whiteSpace: "nowrap" };
