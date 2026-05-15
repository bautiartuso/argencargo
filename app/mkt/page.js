"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { dq, loadSession, clearSession, ac, saveSession } from "../../lib/sb-client";

// ──────────────────────────────────────────────────────────────────────
// Panel Marketing Argencargo · conectado a DB
// Acceso: mismo login admin (role='admin').
// ──────────────────────────────────────────────────────────────────────

const GOLD = "#B8956A", GOLD_LIGHT = "#E8D098", GOLD_DEEP = "#A68456";
const GOLD_GRADIENT = "linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";
const DARK_BG = "linear-gradient(135deg,#070C1A 0%,#0A1628 50%,#0F1F3A 100%)";

const NETWORKS = {
  instagram: { label: "Instagram", icon: "📷", color: "#E1306C", bg: "rgba(225,48,108,0.12)", bd: "rgba(225,48,108,0.4)", account: "@argencargo", brand: "empresa", line: "Más visual / comercial. Para clientes finales: precios, servicios, casos, behind-the-scenes." },
  linkedin: { label: "LinkedIn", icon: "💼", color: "#0A66C2", bg: "rgba(10,102,194,0.12)", bd: "rgba(10,102,194,0.4)", account: "@Bautista Artuso", brand: "personal + tag empresa", line: "B2B. Novedades del sector, anuncios, opinión profesional, casos de éxito." },
  x: { label: "X / Twitter", icon: "𝕏", color: "#fff", bg: "rgba(255,255,255,0.08)", bd: "rgba(255,255,255,0.3)", account: "@Bautista", brand: "personal", line: "Punzante. Novedades, opinión rápida, hilos técnicos, comercio exterior." },
};

const STATUS = {
  idea: { l: "Idea", c: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  guion: { l: "Guión", c: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  diseno: { l: "Diseño", c: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  revision: { l: "Revisión", c: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  programado: { l: "Programado", c: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  publicado: { l: "Publicado", c: "#22c55e", bg: "rgba(34,197,94,0.12)" },
};
const STATUS_OPTS = Object.entries(STATUS).map(([v, s]) => ({ v, l: s.l }));

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthOf = (dateStr) => dateStr.slice(0, 7);
const PUBLISH_DAYS = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28];

// ────── Root ──────
export default function MktPage() {
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const s = loadSession();
    if (s?.token && s?.profile?.role === "admin") setSession(s);
    setRestoring(false);
  }, []);

  if (restoring) return <FullScreenLoading />;
  if (!session) return <Login onLogin={s => setSession(s)} />;
  return <Dashboard session={session} onLogout={() => { clearSession(); setSession(null); }} />;
}

function FullScreenLoading() {
  return <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Cargando…</div>;
}

// ────── Login ──────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [lo, setLo] = useState(false);

  const doLogin = async () => {
    setLo(true); setErr("");
    try {
      const r = await ac("token?grant_type=password", { email, password: pw });
      if (r.error) { setErr(r.error_description || "Credenciales inválidas"); setLo(false); return; }
      const p = await dq("profiles", { token: r.access_token, filters: `?id=eq.${r.user.id}&select=*` });
      const prof = Array.isArray(p) ? p[0] : null;
      if (!prof || prof.role !== "admin") { setErr("Acceso denegado. Solo administradores."); setLo(false); return; }
      const ss = { token: r.access_token, refresh_token: r.refresh_token, user: r.user, profile: prof };
      saveSession(ss); onLogin(ss);
    } catch { setErr("Error de conexión."); }
    setLo(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: DARK_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "32px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "inline-flex", width: 44, height: 44, borderRadius: 10, background: GOLD_GRADIENT, color: "#0A1628", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 17, marginBottom: 14 }}>AC</div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: GOLD_LIGHT, letterSpacing: "0.2em", textTransform: "uppercase" }}>Marketing</p>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Iniciá sesión con tu cuenta de admin</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} placeholder="Contraseña" style={inputStyle} />
          {err && <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{err}</p>}
          <button onClick={doLogin} disabled={lo} style={{ ...btnPrimary, width: "100%", padding: "11px 16px", marginTop: 4 }}>{lo ? "Ingresando…" : "Ingresar"}</button>
        </div>
      </div>
    </div>
  );
}

// ────── Dashboard ──────
function Dashboard({ session, onLogout }) {
  const [tab, setTab] = useState("hoy");
  const [pieces, setPieces] = useState([]);
  const [reactives, setReactives] = useState([]);
  const [radar, setRadar] = useState([]);
  const [sources, setSources] = useState([]);
  const [extraTasks, setExtraTasks] = useState([]);
  const [dailyState, setDailyState] = useState({ task_date: todayStr(), done_keys: [] });
  const [lo, setLo] = useState(true);
  const token = session.token;

  const load = useCallback(async () => {
    setLo(true);
    const [p, r, ri, s, et, ds] = await Promise.all([
      dq("mkt_pieces", { token, filters: "?select=*&order=scheduled_date.asc" }),
      dq("mkt_reactives", { token, filters: "?select=*&is_dismissed=eq.false&order=created_at.desc" }),
      dq("mkt_radar_items", { token, filters: "?select=*&is_dismissed=eq.false&order=discovered_at.desc&limit=80" }),
      dq("mkt_sources", { token, filters: "?select=*&order=sort_order.asc" }),
      dq("mkt_extra_tasks", { token, filters: `?task_date=eq.${todayStr()}&order=created_at.asc` }),
      dq("mkt_daily_state", { token, filters: `?task_date=eq.${todayStr()}&select=*` }),
    ]);
    setPieces(Array.isArray(p) ? p : []);
    setReactives(Array.isArray(r) ? r : []);
    setRadar(Array.isArray(ri) ? ri : []);
    setSources(Array.isArray(s) ? s : []);
    setExtraTasks(Array.isArray(et) ? et : []);
    setDailyState(Array.isArray(ds) && ds[0] ? ds[0] : { task_date: todayStr(), done_keys: [] });
    setLo(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ minHeight: "100vh", background: DARK_BG, color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <Header user={session.user?.email?.split("@")[0] || "user"} onLogout={onLogout} />
      <Tabs tab={tab} setTab={setTab} />
      <main style={{ padding: "28px", maxWidth: 1320, margin: "0 auto" }}>
        {lo ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13, padding: "60px 0" }}>Cargando datos…</p>
        ) : (
          <>
            {tab === "hoy" && <Hoy token={token} pieces={pieces} radar={radar} reactives={reactives} extraTasks={extraTasks} setExtraTasks={setExtraTasks} dailyState={dailyState} setDailyState={setDailyState} reload={load} setTab={setTab} />}
            {tab === "plan" && <Plan token={token} pieces={pieces} reload={load} />}
            {tab === "radar" && <Radar token={token} items={radar} sources={sources} reload={load} />}
            {tab === "reactivos" && <Reactivos token={token} items={reactives} reload={load} />}
            {tab === "brief" && <Brief />}
          </>
        )}
      </main>
    </div>
  );
}

function Header({ user, onLogout }) {
  return (
    <header style={{ padding: "22px 28px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(7,12,26,0.55)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: GOLD_GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1628", fontWeight: 900, fontSize: 14, letterSpacing: "0.02em" }}>AC</div>
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: 14 }}>
          <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, color: GOLD_LIGHT, letterSpacing: "0.18em", textTransform: "uppercase" }}>Marketing</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, c => c.toUpperCase())}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 14px 5px 5px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, fontSize: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: GOLD_GRADIENT, color: "#0A1628", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 10.5 }}>{user.slice(0, 2).toUpperCase()}</div>
          <span style={{ color: "rgba(255,255,255,0.85)" }}>{user}</span>
        </div>
        <button onClick={onLogout} title="Cerrar sesión" style={{ ...btnSecMini, padding: "8px 12px" }}>Salir</button>
      </div>
    </header>
  );
}

function Tabs({ tab, setTab }) {
  const items = [
    { k: "hoy", l: "Hoy", e: "◐" },
    { k: "plan", l: "Plan del mes", e: "▦" },
    { k: "radar", l: "Radar aduanero", e: "◎" },
    { k: "reactivos", l: "Reactivos", e: "◆" },
    { k: "brief", l: "Brief copy", e: "✎" },
  ];
  return (
    <nav style={{ display: "flex", justifyContent: "center", gap: 0, padding: "0 28px", borderBottom: "1px solid rgba(255,255,255,0.05)", maxWidth: 1320, margin: "0 auto", overflowX: "auto" }}>
      {items.map(t => (
        <button key={t.k} onClick={() => setTab(t.k)} style={{
          padding: "16px 26px", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
          background: "transparent",
          color: tab === t.k ? "#fff" : "rgba(255,255,255,0.45)",
          borderBottom: tab === t.k ? `2px solid ${GOLD_LIGHT}` : "2px solid transparent",
          marginBottom: -1, whiteSpace: "nowrap", transition: "color 180ms",
          display: "flex", alignItems: "center", gap: 10, textTransform: "uppercase", letterSpacing: "0.18em",
        }}
          onMouseEnter={e => { if (tab !== t.k) e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
          onMouseLeave={e => { if (tab !== t.k) e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}>
          <span style={{ fontSize: 13, color: tab === t.k ? GOLD_LIGHT : "inherit", letterSpacing: 0 }}>{t.e}</span>
          <span>{t.l}</span>
        </button>
      ))}
    </nav>
  );
}

// ────── HOY ──────
function Hoy({ token, pieces, radar, reactives, extraTasks, setExtraTasks, dailyState, setDailyState, reload, setTab }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const ts = todayStr();
  const todayPieces = pieces.filter(p => p.scheduled_date === ts && p.status !== "publicado");
  const newRadar = radar.filter(r => String(r.discovered_at).slice(0, 10) === ts);
  const hotRadar = newRadar.filter(r => r.is_hot && !r.is_read);
  const pendingReactives = reactives.filter(r => !r.piece_id);

  const baseTasks = useMemo(() => [
    { id: "t-radar", icon: "📰", title: "Revisar portales aduaneros", sub: `${newRadar.length} novedad${newRadar.length !== 1 ? "es" : ""} nueva${newRadar.length !== 1 ? "s" : ""} · CDA · AFIP · Boletín Oficial · ...`, group: "Diario", goto: "radar" },
    { id: "t-story-ig", icon: "📸", title: "Story en Instagram", sub: "1 historia diaria @argencargo — pregunta, dato corto, behind-the-scenes", group: "Diario" },
    { id: "t-status-wa", icon: "💚", title: "Estado en WhatsApp", sub: "Actualizar estado (Argencargo o personal) — algo del día", group: "Diario" },
    ...(hotRadar.length > 0 ? [{ id: "t-reactivo", icon: "🔥", title: "Producir contenido reactivo", sub: `Hay ${hotRadar.length} novedad${hotRadar.length !== 1 ? "es" : ""} importante${hotRadar.length !== 1 ? "s" : ""} en el radar — evaluar si conviene postearla`, group: "Diario", goto: "radar" }] : []),
    ...todayPieces.map(p => ({
      id: "post-" + p.id, icon: NETWORKS[p.network]?.icon || "📱", title: `Publicar ${NETWORKS[p.network]?.label || p.network}`, sub: p.copy || "(sin copy)", group: "Publicaciones del día", autoGenerated: true,
    })),
  ], [pieces, radar, reactives, ts]);

  const allTasks = [...baseTasks, ...extraTasks.map(t => ({ id: "u-" + t.id, dbId: t.id, icon: t.icon || "✏️", title: t.title, sub: "Tarea agregada manualmente", group: "Personalizadas", isExtra: true, isDone: t.is_done }))];

  const isChecked = (id) => {
    const task = allTasks.find(t => t.id === id);
    if (task?.isExtra) return task.isDone;
    return (dailyState.done_keys || []).includes(id);
  };

  const toggle = async (task) => {
    if (task.isExtra) {
      const next = !task.isDone;
      setExtraTasks(p => p.map(t => t.id === task.dbId ? { ...t, is_done: next } : t));
      await dq("mkt_extra_tasks", { method: "PATCH", token, filters: `?id=eq.${task.dbId}`, body: { is_done: next, done_at: next ? new Date().toISOString() : null } });
    } else {
      const keys = dailyState.done_keys || [];
      const next = keys.includes(task.id) ? keys.filter(k => k !== task.id) : [...keys, task.id];
      setDailyState(p => ({ ...p, done_keys: next }));
      // Upsert
      await dq("mkt_daily_state", { method: "POST", token, filters: "?on_conflict=task_date", body: { task_date: ts, done_keys: next, updated_at: new Date().toISOString() }, headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
    }
  };

  const done = allTasks.filter(t => isChecked(t.id)).length;
  const pct = allTasks.length > 0 ? Math.round(done / allTasks.length * 100) : 0;
  const hue = Math.round(pct * 1.42);
  const progColor = `hsl(${hue}, 72%, 55%)`;
  const progColorDark = `hsl(${hue}, 72%, 48%)`;

  const addTask = async () => {
    if (!newTitle.trim()) return;
    const r = await dq("mkt_extra_tasks", { method: "POST", token, body: { task_date: ts, title: newTitle.trim() } });
    const created = Array.isArray(r) ? r[0] : r;
    if (created?.id) setExtraTasks(p => [...p, created]);
    setNewTitle(""); setShowAdd(false);
  };

  const delExtra = async (id) => {
    setExtraTasks(p => p.filter(t => t.id !== id));
    await dq("mkt_extra_tasks", { method: "DELETE", token, filters: `?id=eq.${id}` });
  };

  const byGroup = {};
  allTasks.forEach(t => { byGroup[t.group] = byGroup[t.group] || []; byGroup[t.group].push(t); });
  const groupOrder = ["Diario", "Publicaciones del día", "Personalizadas"];

  return (
    <div>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.12em" }}>Rutina del día</p>
            <h2 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>{new Date().toLocaleDateString("es-AR", { weekday: "long" }).replace(/^./, c => c.toUpperCase())}, {new Date().getDate()}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{done} de {allTasks.length} tareas completadas</p>
          </div>
          <div style={{ minWidth: 260, flex: "0 0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Progreso</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: progColor, fontFeatureSettings: '"tnum"', transition: "color 400ms" }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${progColorDark}, ${progColor})`, transition: "width 400ms, background 400ms", borderRadius: 4, boxShadow: pct > 0 ? `0 0 12px ${progColor}55` : "none" }} />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 18 }}>
          <Stat label="A publicar hoy" value={todayPieces.length} color={GOLD_LIGHT} />
          <Stat label="Novedades hoy" value={newRadar.length} color="#60a5fa" />
          <Stat label="Reactivos" value={pendingReactives.length} color="#fb923c" />
          <Stat label="Piezas pendientes" value={pieces.filter(p => p.status !== "publicado").length} color="rgba(255,255,255,0.55)" />
        </div>
      </Card>

      {groupOrder.filter(g => byGroup[g]).map(g => (
        <div key={g} style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", paddingLeft: 4 }}>{g}</p>
          <Card padded={false}>
            {byGroup[g].map((t, idx) => {
              const checked = isChecked(t.id);
              return (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                  borderBottom: idx < byGroup[g].length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  opacity: checked ? 0.45 : 1, transition: "opacity 200ms, background 150ms", cursor: "pointer",
                }} onClick={() => toggle(t)} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(t)} onClick={e => e.stopPropagation()} style={{ width: 18, height: 18, accentColor: GOLD, cursor: "pointer" }} />
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#fff", textDecoration: checked ? "line-through" : "none", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {t.title}
                      {t.autoGenerated && <span style={{ fontSize: 8.5, fontWeight: 800, padding: "1.5px 6px", borderRadius: 3, background: "rgba(96,165,250,0.15)", color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em" }}>AUTO</span>}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t.sub}</p>
                  </div>
                  {t.goto && <button onClick={e => { e.stopPropagation(); setTab(t.goto); }} style={btnSecMini}>Ver →</button>}
                  {t.isExtra && <button onClick={e => { e.stopPropagation(); delExtra(t.dbId); }} style={{ ...btnSecMini, color: "#f87171", borderColor: "rgba(255,80,80,0.3)" }}>×</button>}
                </div>
              );
            })}
          </Card>
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        {showAdd ? (
          <Card>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Nueva tarea</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="¿Qué hay que hacer hoy?" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={addTask} style={btnPrimary}>Agregar</button>
              <button onClick={() => { setShowAdd(false); setNewTitle(""); }} style={btnSec}>Cancelar</button>
            </div>
          </Card>
        ) : (
          <button onClick={() => setShowAdd(true)} style={{ width: "100%", padding: "14px 18px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.02)", border: "1.5px dashed rgba(255,255,255,0.12)", borderRadius: 12, cursor: "pointer", transition: "all 150ms" }}
            onMouseEnter={e => { e.currentTarget.style.color = GOLD_LIGHT; e.currentTarget.style.borderColor = "rgba(184,149,106,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}>
            + Agregar tarea
          </button>
        )}
      </div>
    </div>
  );
}

// ────── PLAN DEL MES ──────
function Plan({ token, pieces, reload }) {
  const [redSel, setRedSel] = useState("instagram");
  const [monthSel, setMonthSel] = useState(monthOf(todayStr()));
  const [editing, setEditing] = useState(null); // pieza en edición

  const monthPieces = pieces.filter(p => monthOf(p.scheduled_date) === monthSel);
  const piezasRed = monthPieces.filter(p => p.network === redSel).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const net = NETWORKS[redSel];

  const navMonth = (delta) => {
    const [y, m] = monthSel.split("-").map(Number);
    const dt = new Date(y, m - 1 + delta, 1);
    setMonthSel(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  };

  const ensureMonth = async () => {
    // Crear los 30 slots del mes si no existen (10 por red, cada 3 días: 1,4,7,10,13,16,19,22,25,28)
    const existing = monthPieces;
    const [y, m] = monthSel.split("-").map(Number);
    const toCreate = [];
    for (const network of Object.keys(NETWORKS)) {
      for (let i = 0; i < 10; i++) {
        const dom = PUBLISH_DAYS[i];
        const date = `${y}-${String(m).padStart(2, "0")}-${String(dom).padStart(2, "0")}`;
        if (!existing.find(p => p.network === network && p.scheduled_date === date)) {
          toCreate.push({ network, scheduled_date: date, slot_number: i + 1, status: "idea", copy: "" });
        }
      }
    }
    if (toCreate.length > 0) {
      await dq("mkt_pieces", { method: "POST", token, body: toCreate });
      await reload();
    }
  };

  return (
    <div>
      <PageHeader
        title={`Plan ${new Date(monthSel + "-01").toLocaleDateString("es-AR", { month: "long", year: "numeric" }).replace(/^./, c => c.toUpperCase())}`}
        sub="10 piezas por red — cada 3 días (1, 4, 7, 10, 13, 16, 19, 22, 25, 28)"
        right={<button onClick={() => navMonth(-1)} style={btnSec}>‹ Mes anterior</button>}
        rightExtra={<button onClick={() => navMonth(1)} style={btnSec}>Mes siguiente ›</button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        {Object.entries(NETWORKS).map(([k, n]) => {
          const pp = monthPieces.filter(p => p.network === k);
          const pub = pp.filter(p => p.status === "publicado").length;
          const isSel = redSel === k;
          return (
            <button key={k} onClick={() => setRedSel(k)} style={{
              padding: "14px 16px", textAlign: "left",
              border: `1.5px solid ${isSel ? n.bd : "rgba(255,255,255,0.08)"}`,
              borderRadius: 12, cursor: "pointer", background: isSel ? n.bg : "rgba(255,255,255,0.025)", transition: "all 150ms",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{n.icon}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: isSel ? (n.color === "#fff" ? "#fff" : n.color) : "#fff" }}>{n.label}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{n.account}</div>
              <div style={{ marginTop: 8, height: 4, background: "rgba(0,0,0,0.3)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${pp.length > 0 ? pub / pp.length * 100 : 0}%`, height: "100%", background: n.color === "#fff" ? "#fff" : n.color, transition: "width 300ms" }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.55)", display: "flex", justifyContent: "space-between" }}>
                <span>{pub}/{pp.length} publicadas</span>
                <span style={{ fontWeight: 700, color: isSel ? (n.color === "#fff" ? "#fff" : n.color) : "rgba(255,255,255,0.65)" }}>{pp.length > 0 ? Math.round(pub / pp.length * 100) : 0}%</span>
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.1em" }}>Línea editorial · {net.label}</p>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{net.brand}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.55 }}>{net.line}</p>
      </Card>

      {piezasRed.length === 0 ? (
        <div style={{ marginTop: 18, padding: "40px 20px", textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1.5px dashed rgba(255,255,255,0.1)", borderRadius: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Este mes todavía no tiene slots creados.</p>
          <button onClick={ensureMonth} style={{ ...btnPrimary, marginTop: 12 }}>Generar 30 slots (10 por red)</button>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", paddingLeft: 4 }}>Piezas del mes · {net.label}</p>
          <Card padded={false}>
            {piezasRed.map((p, i) => {
              const st = STATUS[p.status] || STATUS.idea;
              return (
                <div key={p.id} style={{
                  display: "grid", gridTemplateColumns: "44px 90px 1fr 110px 80px",
                  gap: 14, alignItems: "center", padding: "13px 18px",
                  borderBottom: i < piezasRed.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  cursor: "pointer", transition: "background 120ms",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  onClick={() => setEditing(p)}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.35)" }}>#{p.slot_number || i + 1}</span>
                  <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", fontFamily: "ui-monospace, monospace", fontFeatureSettings: '"tnum"' }}>{p.scheduled_date.slice(8)}/{p.scheduled_date.slice(5, 7)}</span>
                  <span style={{ fontSize: 13.5, color: "#fff", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.copy?.trim() || <i style={{ color: "rgba(255,255,255,0.3)" }}>Sin contenido</i>}</span>
                  <Badge color={st.c} bg={st.bg}>{st.l}</Badge>
                  <button style={btnSecMini}>Abrir →</button>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {editing && <PieceEditor token={token} piece={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function PieceEditor({ token, piece, onClose, onSaved }) {
  const [data, setData] = useState({
    copy: piece.copy || "", hashtags: piece.hashtags || "", format: piece.format || "feed",
    status: piece.status || "idea", asset_url: piece.asset_url || "", notes: piece.notes || "",
    published_url: piece.published_url || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await dq("mkt_pieces", { method: "PATCH", token, filters: `?id=eq.${piece.id}`, body: data });
    setSaving(false);
    onSaved();
  };

  const net = NETWORKS[piece.network];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", background: "#0F1F3A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "22px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.12em" }}>{net?.icon} {net?.label} · #{piece.slot_number}</p>
            <h3 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>{piece.scheduled_date}</h3>
          </div>
          <button onClick={onClose} style={btnSecMini}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <Fld label="Copy" multi value={data.copy} onChange={v => setData(p => ({ ...p, copy: v }))} placeholder="Copy del post" />
          <Fld label="Hashtags" value={data.hashtags} onChange={v => setData(p => ({ ...p, hashtags: v }))} placeholder="#argencargo #importarchina" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Sel label="Formato" value={data.format} onChange={v => setData(p => ({ ...p, format: v }))} options={["feed", "reel", "carrusel", "story", "hilo", "post-text"].map(f => ({ v: f, l: f }))} />
            <Sel label="Estado" value={data.status} onChange={v => setData(p => ({ ...p, status: v }))} options={STATUS_OPTS} />
          </div>
          <Fld label="Asset (URL)" value={data.asset_url} onChange={v => setData(p => ({ ...p, asset_url: v }))} placeholder="https://..." />
          <Fld label="URL publicada" value={data.published_url} onChange={v => setData(p => ({ ...p, published_url: v }))} placeholder="Link al post una vez publicado" />
          <Fld label="Notas internas" multi value={data.notes} onChange={v => setData(p => ({ ...p, notes: v }))} placeholder="Cualquier nota..." />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={btnSec}>Cancelar</button>
          <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

// ────── RADAR ──────
function Radar({ token, items, sources, reload }) {
  const [filt, setFilt] = useState("all");
  const [showSources, setShowSources] = useState(false);
  const [editingSource, setEditingSource] = useState(null);

  const filtered = items.filter(i => (filt === "all" || i.source_name === filt) && !i.is_dismissed);

  const setRead = async (id, val) => {
    await dq("mkt_radar_items", { method: "PATCH", token, filters: `?id=eq.${id}`, body: { is_read: val } });
    reload();
  };
  const dismiss = async (id) => {
    await dq("mkt_radar_items", { method: "PATCH", token, filters: `?id=eq.${id}`, body: { is_dismissed: true } });
    reload();
  };
  const toReactive = async (item) => {
    const r = await dq("mkt_reactives", { method: "POST", token, body: { radar_item_id: item.id, source_label: item.source_name, title: item.title, note: "", target_network: "linkedin", status: "idea" } });
    const created = Array.isArray(r) ? r[0] : r;
    if (created?.id) {
      await dq("mkt_radar_items", { method: "PATCH", token, filters: `?id=eq.${item.id}`, body: { converted_reactive_id: created.id, is_read: true } });
    }
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Radar aduanero"
        sub={<>Headlines de portales relevantes · <span style={{ color: GOLD_LIGHT, fontWeight: 600 }}>scrappeo diario sin IA</span></>}
        right={<button onClick={() => setShowSources(s => !s)} style={btnSec}>⚙ Fuentes ({sources.length})</button>}
      />

      {showSources && (
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.08em" }}>Portales registrados</p>
          {sources.map(s => (
            <div key={s.id} style={{ padding: "9px 0", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{s.url}</p>
              </div>
              <button onClick={() => setEditingSource(s)} style={btnSecMini}>Editar</button>
            </div>
          ))}
          <button onClick={() => setEditingSource({})} style={{ ...btnSec, marginTop: 12, width: "100%" }}>+ Agregar fuente</button>
        </Card>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 16, marginBottom: 14, flexWrap: "wrap" }}>
        <FilterPill active={filt === "all"} onClick={() => setFilt("all")}>Todos · {items.filter(i => !i.is_dismissed).length}</FilterPill>
        {Array.from(new Set(items.map(i => i.source_name).filter(Boolean))).map(s => (
          <FilterPill key={s} active={filt === s} onClick={() => setFilt(s)}>{s} · {items.filter(i => i.source_name === s && !i.is_dismissed).length}</FilterPill>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1.5px dashed rgba(255,255,255,0.1)", borderRadius: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Sin novedades por ahora. El cron diario las trae a las 8am.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(item => (
            <div key={item.id} style={{
              padding: "14px 18px",
              background: item.is_hot ? "linear-gradient(135deg, rgba(251,146,60,0.08), rgba(251,146,60,0.03))" : "rgba(255,255,255,0.025)",
              border: `1px solid ${item.is_hot ? "rgba(251,146,60,0.35)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap",
              opacity: item.is_read ? 0.6 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                  <Badge color="#60a5fa" bg="rgba(96,165,250,0.15)">{item.source_name || "—"}</Badge>
                  {item.is_hot && <Badge color="#fb923c" bg="rgba(251,146,60,0.18)">🔥 Importante</Badge>}
                  {item.is_read && <Badge color="rgba(255,255,255,0.45)" bg="rgba(255,255,255,0.05)">Leído</Badge>}
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{String(item.discovered_at).slice(0, 10)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: "#fff", fontWeight: 500, lineHeight: 1.4 }}>{item.title}</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ ...btnSecMini, textDecoration: "none", display: "inline-block" }}>🔗 Abrir</a>}
                <button onClick={() => toReactive(item)} style={{ ...btnSecMini, borderColor: "rgba(184,149,106,0.5)", color: GOLD_LIGHT, background: "rgba(184,149,106,0.08)" }}>→ Reactivo</button>
                <button onClick={() => setRead(item.id, !item.is_read)} style={btnSecMini}>{item.is_read ? "Marcar no leído" : "✓ Leído"}</button>
                <button onClick={() => dismiss(item.id)} style={{ ...btnSecMini, color: "#f87171", borderColor: "rgba(255,80,80,0.3)" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <InfoBox>
        <b style={{ color: GOLD_LIGHT }}>💡 ¿Cómo funciona?</b> Un cron diario (8am) descarga los headlines de cada portal sin usar IA — solo HTML parsing.
        Apretás <b>→ Reactivo</b> para mandar la novedad a la bandeja donde la trabajás antes de publicarla.
      </InfoBox>

      {editingSource && <SourceEditor token={token} source={editingSource} onClose={() => setEditingSource(null)} onSaved={() => { setEditingSource(null); reload(); }} />}
    </div>
  );
}

function SourceEditor({ token, source, onClose, onSaved }) {
  const isNew = !source.id;
  const [data, setData] = useState({ name: source.name || "", url: source.url || "", selector: source.selector || "", enabled: source.enabled !== false });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!data.name.trim() || !data.url.trim()) return alert("Nombre y URL son obligatorios");
    setSaving(true);
    if (isNew) await dq("mkt_sources", { method: "POST", token, body: { ...data, sort_order: 999 } });
    else await dq("mkt_sources", { method: "PATCH", token, filters: `?id=eq.${source.id}`, body: data });
    setSaving(false); onSaved();
  };
  const del = async () => {
    if (!confirm("¿Eliminar esta fuente?")) return;
    await dq("mkt_sources", { method: "DELETE", token, filters: `?id=eq.${source.id}` });
    onSaved();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#0F1F3A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "22px 24px" }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{isNew ? "Nueva fuente" : "Editar fuente"}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 14 }}>
          <Fld label="Nombre" value={data.name} onChange={v => setData(p => ({ ...p, name: v }))} placeholder="Ej: CDA — Centro Despachantes" />
          <Fld label="URL" value={data.url} onChange={v => setData(p => ({ ...p, url: v }))} placeholder="https://..." />
          <Fld label="CSS selector (opcional, para parseo)" value={data.selector} onChange={v => setData(p => ({ ...p, selector: v }))} placeholder="Ej: article h2 a" />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "rgba(255,255,255,0.75)", cursor: "pointer" }}>
            <input type="checkbox" checked={data.enabled} onChange={e => setData(p => ({ ...p, enabled: e.target.checked }))} style={{ accentColor: GOLD }} />
            Activa (incluir en el scraper diario)
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16 }}>
          {!isNew && <button onClick={del} style={{ ...btnSec, color: "#f87171", borderColor: "rgba(255,80,80,0.3)" }}>Eliminar</button>}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button onClick={onClose} style={btnSec}>Cancelar</button>
            <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────── REACTIVOS ──────
function Reactivos({ token, items, reload }) {
  const pending = items.filter(r => !r.piece_id && !r.is_dismissed);

  const dismiss = async (id) => {
    if (!confirm("¿Descartar este reactivo?")) return;
    await dq("mkt_reactives", { method: "PATCH", token, filters: `?id=eq.${id}`, body: { is_dismissed: true } });
    reload();
  };

  const toPlan = async (item) => {
    // Crea una pieza en el plan del mes para la red sugerida en la próxima fecha disponible
    const ts = todayStr();
    const [y, m, d] = ts.split("-").map(Number);
    const nextPubDay = PUBLISH_DAYS.find(day => day >= d) || PUBLISH_DAYS[0];
    const targetDate = nextPubDay >= d
      ? `${y}-${String(m).padStart(2, "0")}-${String(nextPubDay).padStart(2, "0")}`
      : (() => { const dt = new Date(y, m, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`; })();

    const r = await dq("mkt_pieces", { method: "POST", token, body: {
      network: item.target_network || "linkedin",
      scheduled_date: targetDate,
      status: item.status || "guion",
      copy: item.title + (item.note ? "\n\n" + item.note : ""),
      is_reactive: true,
      reactive_source: item.source_label,
    } });
    const created = Array.isArray(r) ? r[0] : r;
    if (created?.id) {
      await dq("mkt_reactives", { method: "PATCH", token, filters: `?id=eq.${item.id}`, body: { piece_id: created.id } });
    }
    reload();
  };

  return (
    <div>
      <PageHeader title="Bandeja de reactivos" sub="Ideas pendientes de producir que vienen del radar." />

      <InfoBox>
        <b style={{ color: GOLD_LIGHT }}>📌 Flow:</b>
        <ol style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
          <li>Novedad en el <b>Radar</b> → click <b>"→ Reactivo"</b>.</li>
          <li>Trabajás la idea acá (copy, red, formato).</li>
          <li>Click <b>"→ Al plan del mes"</b> → se convierte en pieza programada.</li>
          <li>Aparece en <b>Hoy</b> el día programado como tarea de publicación.</li>
        </ol>
      </InfoBox>

      {pending.length === 0 ? (
        <div style={{ marginTop: 16, padding: "60px 20px", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13, background: "rgba(255,255,255,0.02)", border: "1.5px dashed rgba(255,255,255,0.1)", borderRadius: 12 }}>
          Sin reactivos pendientes. Cuando convertís una novedad del Radar, aparece acá.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 12, marginTop: 16 }}>
          {pending.map(it => {
            const st = STATUS[it.status] || STATUS.idea;
            const net = NETWORKS[it.target_network] || NETWORKS.linkedin;
            return (
              <div key={it.id} style={{
                padding: "16px 18px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                borderLeft: `3px solid ${net.color === "#fff" ? "rgba(255,255,255,0.7)" : net.color}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>📡 {it.source_label || "—"}</span>
                  <Badge color={st.c} bg={st.bg}>{st.l}</Badge>
                </div>
                <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#fff" }}>{it.title}</h3>
                {it.note && <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, fontStyle: "italic" }}>"{it.note}"</p>}
                <p style={{ margin: "10px 0 0", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Red sugerida: <b style={{ color: net.color === "#fff" ? "#fff" : net.color }}>{net.icon} {net.label}</b></p>
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={() => toPlan(it)} style={{ ...btnSecMini, borderColor: "rgba(184,149,106,0.5)", color: GOLD_LIGHT, background: "rgba(184,149,106,0.08)" }}>→ Al plan del mes</button>
                  <button onClick={() => dismiss(it.id)} style={{ ...btnSecMini, color: "#f87171", borderColor: "rgba(255,80,80,0.3)" }}>🗑 Descartar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────── BRIEF ──────
function Brief() {
  const [data, setData] = useState({ red: "instagram", objetivo: "", publico: "", tono: "casual", formato: "feed", cta: "", datos: "" });
  const net = NETWORKS[data.red];
  const prompt = `Necesito una idea de copy para **${net.label}** (${net.account}, línea editorial: ${net.line}).

**Objetivo del post:** ${data.objetivo || "(falta)"}
**Público:** ${data.publico || "(falta)"}
**Tono:** ${data.tono}
**Formato:** ${data.formato}
**CTA:** ${data.cta || "(falta)"}
**Datos clave:** ${data.datos || "(falta)"}

Dame 3 variantes claramente diferenciadas en estilo. Para cada una:
- Copy principal con saltos de línea bien marcados
- 5-8 hashtags relevantes (si aplica a la red)
- Sugerencia visual / asset

Tono Argencargo: claro, directo, profesional pero cercano. Empresa argentina de importaciones desde China y USA.`;

  return (
    <div>
      <PageHeader title="Brief copy" sub={<>Completá → copiá → pegámelo en el chat y te tiro 3 variantes. <b style={{ color: GOLD_LIGHT }}>0 costo de API.</b></>} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <Sel label="Red" value={data.red} onChange={v => setData(p => ({ ...p, red: v }))} options={Object.entries(NETWORKS).map(([k, n]) => ({ v: k, l: `${n.icon} ${n.label}` }))} />
            <Fld label="Objetivo del post" value={data.objetivo} onChange={v => setData(p => ({ ...p, objetivo: v }))} placeholder="Ej: anunciar la nueva ruta USA" />
            <Fld label="Público objetivo" value={data.publico} onChange={v => setData(p => ({ ...p, publico: v }))} placeholder="Ej: emprendedores que importan, 25-40" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Sel label="Tono" value={data.tono} onChange={v => setData(p => ({ ...p, tono: v }))} options={[{ v: "casual", l: "Casual" }, { v: "formal", l: "Formal" }, { v: "tecnico", l: "Técnico" }, { v: "divertido", l: "Divertido" }]} />
              <Sel label="Formato" value={data.formato} onChange={v => setData(p => ({ ...p, formato: v }))} options={["feed", "reel", "carrusel", "story", "hilo", "post-text"].map(f => ({ v: f, l: f }))} />
            </div>
            <Fld label="Call to action" value={data.cta} onChange={v => setData(p => ({ ...p, cta: v }))} placeholder="Ej: escribinos para cotizar" />
            <Fld label="Datos clave" value={data.datos} onChange={v => setData(p => ({ ...p, datos: v }))} placeholder="Ej: USD 4500/CBM, 30-40 días" multi />
          </div>
        </Card>
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.08em" }}>Brief armado</p>
          <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px", fontSize: 12, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", lineHeight: 1.6, maxHeight: 360, overflow: "auto", margin: 0 }}>{prompt}</pre>
          <button style={{ ...btnPrimary, marginTop: 12, width: "100%" }} onClick={() => { navigator.clipboard?.writeText(prompt); }}>📋 Copiar brief</button>
        </Card>
      </div>
    </div>
  );
}

// ────── UI helpers ──────
function Card({ children, padded = true }) {
  return <div style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: padded ? "18px 20px" : 0, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>{children}</div>;
}
function PageHeader({ title, sub, right, rightExtra }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h2>
        <p style={{ margin: "5px 0 0", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{sub}</p>
      </div>
      {(right || rightExtra) && <div style={{ display: "flex", gap: 6 }}>{right}{rightExtra}</div>}
    </div>
  );
}
function Stat({ label, value, color }) {
  return (
    <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
      <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</p>
      <p style={{ margin: "5px 0 0", fontSize: 26, fontWeight: 800, color, fontFeatureSettings: '"tnum"', lineHeight: 1 }}>{value}</p>
    </div>
  );
}
function Badge({ children, color, bg }) {
  return <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 4, background: bg, color, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{children}</span>;
}
function FilterPill({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, border: `1px solid ${active ? GOLD_DEEP : "rgba(255,255,255,0.1)"}`, borderRadius: 999, cursor: "pointer", background: active ? "rgba(184,149,106,0.12)" : "rgba(255,255,255,0.025)", color: active ? GOLD_LIGHT : "rgba(255,255,255,0.65)", transition: "all 150ms" }}>{children}</button>
  );
}
function InfoBox({ children }) {
  return <div style={{ marginTop: 18, padding: "14px 18px", background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.18)", borderRadius: 10, fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{children}</div>;
}
function Fld({ label, value, onChange, placeholder, multi }) {
  const Comp = multi ? "textarea" : "input";
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      <Comp value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={multi ? 3 : undefined}
        style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, background: "rgba(0,0,0,0.3)", color: "#fff", outline: "none", fontFamily: "inherit", resize: multi ? "vertical" : "none" }} />
    </div>
  );
}
function Sel({ label, value, onChange, options }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, background: "rgba(0,0,0,0.3)", color: "#fff", outline: "none" }}>
        {options.map(o => <option key={o.v} value={o.v} style={{ background: "#0F1F3A" }}>{o.l}</option>)}
      </select>
    </div>
  );
}
const inputStyle = { padding: "10px 14px", fontSize: 13.5, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, background: "rgba(0,0,0,0.3)", color: "#fff", outline: "none" };
const btnPrimary = { padding: "9px 18px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: `1px solid ${GOLD_DEEP}`, background: GOLD_GRADIENT, color: "#0A1628", cursor: "pointer", letterSpacing: "0.02em", whiteSpace: "nowrap" };
const btnSec = { padding: "7px 14px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.8)", cursor: "pointer", whiteSpace: "nowrap" };
const btnSecMini = { padding: "5.5px 11px", fontSize: 11.5, fontWeight: 600, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.78)", cursor: "pointer", whiteSpace: "nowrap", transition: "all 150ms" };
