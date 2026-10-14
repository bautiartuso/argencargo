"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { dq, loadSession, clearSession, ac, saveSession } from "../../lib/sb-client";

// ──────────────────────────────────────────────────────────────────────
// KAIRO · app personal (físico, nutrición, finanzas, objetivos). Mobile-first.
// Estética: casi negro + tarjetas grafito con borde fino, Inter, acento lima,
// azul eléctrico para plata/objetivos. Cada sección es independiente; "Hoy" resume.
// Por ahora la sección completa es Finanzas (presupuesto mensual + Mercado Pago).
// ──────────────────────────────────────────────────────────────────────

const C = {
  bg: "#0C0D10", card: "#15171B", cardHi: "#1C1F24", line: "#24262C",
  text: "#F2F3F5", sub: "#7D8089", dim: "#55585F",
  lime: "#C6F432", limeInk: "#1B2203", blue: "#3D7BFF", warn: "#FF8A5C", danger: "#FF5C5C",
};

const CSS = `
  html,body{background:${C.bg};margin:0;height:100%}
  .k-root{height:100%}
  html,body{color:${C.text};-webkit-font-smoothing:antialiased;overscroll-behavior-y:none}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  button{font-family:inherit;cursor:pointer}
  input,select{font-family:inherit;font-size:16px}
  .k-press{transition:transform 120ms ease, opacity 120ms ease}
  .k-press:active{transform:scale(0.97);opacity:.85}
  @keyframes kUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
  @keyframes kFade{from{opacity:0}to{opacity:1}}
  .k-num{font-variant-numeric:tabular-nums;letter-spacing:-0.02em}
`;

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => ymd(new Date());
const curMonth = () => today().slice(0, 7);
const ars = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const arsK = (n) => { const v = Math.round(Number(n) || 0); return Math.abs(v) >= 100000 ? "$" + Math.round(v / 1000).toLocaleString("es-AR") + "k" : ars(v); };
const monthName = (m) => { const [y, mm] = m.split("-").map(Number); const s = new Date(y, mm - 1, 15).toLocaleDateString("es-AR", { month: "long" }); return s[0].toUpperCase() + s.slice(1) + (y !== new Date().getFullYear() ? ` ${y}` : ""); };
const shiftMonth = (m, d) => { const [y, mm] = m.split("-").map(Number); const dt = new Date(y, mm - 1 + d, 1); return ymd(dt).slice(0, 7); };
const daysIn = (m) => { const [y, mm] = m.split("-").map(Number); return new Date(y, mm, 0).getDate(); };
const parseNum = (s) => Number(String(s).trim().replace(/\./g, "").replace(",", ".")) || 0;
const merchantKey = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const dayLabel = (d) => { if (d === today()) return "hoy"; const y = new Date(); y.setDate(y.getDate() - 1); if (d === ymd(y)) return "ayer"; return d.slice(8) + "/" + d.slice(5, 7); };

// ─────── Íconos (trazo fino, 24px) ───────
const I = {
  home: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z",
  gym: "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12",
  food: "M4 12h16a8 8 0 0 1-16 0zM9 4c0 2 2 2 2 4M14 4c0 2 2 2 2 4",
  wallet: "M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1zM4 7l11-3v3M16 13h1",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  plus: "M12 5v14M5 12h14",
  left: "M15 6l-6 6 6 6", right: "M9 6l6 6-6 6",
  sync: "M20 11a8 8 0 0 0-14.9-3M4 5v3h3M4 13a8 8 0 0 0 14.9 3M20 19v-3h-3",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
};
const Icon = ({ d, size = 22, color = "currentColor", sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

// ─────── Toast ───────
let pushToast = () => {};
function Toast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => { pushToast = (m) => { setMsg(m); setTimeout(() => setMsg(null), 2400); }; }, []);
  if (!msg) return null;
  return <div style={{ position: "fixed", left: 16, right: 16, top: "calc(env(safe-area-inset-top) + 12px)", zIndex: 60, display: "flex", justifyContent: "center", animation: "kFade 160ms" }}>
    <div style={{ background: C.cardHi, border: `0.5px solid ${C.line}`, borderRadius: 14, padding: "11px 16px", fontSize: 14 }}>{msg}</div>
  </div>;
}

// ─────── Root ───────
export default function KairoPage() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { const s = loadSession(); if (s?.token && s?.profile?.role === "admin") setSession(s); setReady(true); }, []);
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Toast />
      {!ready ? <div style={{ minHeight: "100dvh", background: C.bg }} /> : !session ? <Login onLogin={setSession} /> : <App session={session} onLogout={() => { clearSession(); setSession(null); }} />}
    </>
  );
}

function Wordmark({ size = 22 }) {
  return <span style={{ fontSize: size, fontWeight: 600, letterSpacing: "-0.03em" }}>kairo<span style={{ color: C.lime }}>.</span></span>;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [err, setErr] = useState(""); const [lo, setLo] = useState(false);
  const submit = async () => {
    setLo(true); setErr("");
    try {
      const r = await ac("token?grant_type=password", { email, password: pw });
      if (r?.error || !r?.access_token) { setErr("Email o contraseña incorrectos"); setLo(false); return; }
      const p = await dq("profiles", { token: r.access_token, filters: `?id=eq.${r.user.id}&select=*` });
      const prof = Array.isArray(p) ? p[0] : null;
      if (prof?.role !== "admin") { setErr("Acceso denegado"); setLo(false); return; }
      const ss = { token: r.access_token, refresh_token: r.refresh_token, user: r.user, profile: prof };
      saveSession(ss); onLogin(ss);
    } catch { setErr("Sin conexión"); }
    setLo(false);
  };
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px", maxWidth: 420, margin: "0 auto" }}>
      <Wordmark size={34} />
      <p style={{ color: C.sub, margin: "8px 0 32px", fontSize: 15 }}>Tu mejor versión, todos los días.</p>
      <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="Email" style={field} />
      <input value={pw} onChange={e => setPw(e.target.value)} type="password" autoComplete="current-password" placeholder="Contraseña" onKeyDown={e => e.key === "Enter" && submit()} style={{ ...field, marginTop: 10 }} />
      {err && <p style={{ color: C.danger, fontSize: 13, margin: "10px 2px 0" }}>{err}</p>}
      <button className="k-press" onClick={submit} disabled={lo} style={{ ...btnLime, marginTop: 18 }}>{lo ? "Entrando…" : "Entrar"}</button>
    </div>
  );
}

// ─────── Shell con barra inferior ───────
const TABS = [
  { id: "hoy", label: "Hoy", icon: I.home },
  { id: "fisico", label: "Físico", icon: I.gym },
  { id: "nutricion", label: "Nutrición", icon: I.food },
  { id: "finanzas", label: "Finanzas", icon: I.wallet },
  { id: "objetivos", label: "Objetivos", icon: I.target },
];

function App({ session }) {
  const [tab, setTab] = useState("finanzas");
  const scroller = useRef(null);
  useEffect(() => { try { const t = localStorage.getItem("kairo_tab"); if (t) setTab(t); } catch {} }, []);
  const go = (t) => { setTab(t); try { localStorage.setItem("kairo_tab", t); } catch {} scroller.current?.scrollTo(0, 0); };
  const fin = useFinance(session.token);

  // Shell fijo a pantalla completa con el scroll adentro y la barra al fondo del flujo.
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg }}>
      <main ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "calc(env(safe-area-inset-top) + 18px) 16px 28px" }}>
          {tab === "hoy" && <Hoy fin={fin} go={go} />}
          {tab === "finanzas" && <Finanzas fin={fin} token={session.token} />}
          {["fisico", "nutricion", "objetivos"].includes(tab) && <Soon tab={TABS.find(t => t.id === tab)} />}
        </div>
      </main>
      <nav style={{ flexShrink: 0, background: C.bg, borderTop: `0.5px solid ${C.line}`, paddingBottom: "max(16px, min(env(safe-area-inset-bottom), 22px))" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", display: "flex" }}>
          {TABS.map(t => {
            const on = tab === t.id;
            return <button key={t.id} onClick={() => go(t.id)} aria-label={t.label} style={{ flex: 1, background: "none", border: "none", padding: "8px 0 2px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: on ? C.lime : C.dim }}>
              <Icon d={t.icon} size={23} sw={on ? 1.9 : 1.6} />
              <span style={{ fontSize: 10.5, fontWeight: on ? 600 : 500 }}>{t.label}</span>
            </button>;
          })}
        </div>
      </nav>
    </div>
  );
}

function Header({ title, right }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 40, marginBottom: 6 }}>
    <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em" }}>{title}</h1>{right}
  </div>;
}

function Soon({ tab }) {
  return <>
    <Header title={tab.label} />
    <div style={{ ...card, marginTop: 18, padding: "36px 20px", textAlign: "center" }}>
      <div style={{ color: C.dim, display: "flex", justifyContent: "center" }}><Icon d={tab.icon} size={34} sw={1.4} /></div>
      <p style={{ margin: "14px 0 4px", fontSize: 16, fontWeight: 500 }}>En construcción</p>
      <p style={{ margin: 0, fontSize: 14, color: C.sub }}>Esta sección llega después de Finanzas.</p>
    </div>
  </>;
}

// Arranque de Kairo: el acumulado entre meses cuenta desde acá (antes había gastos de Cinabrio sin ingresos).
const KAIRO_DESDE = "2026-10-01";
// Tope de una categoría en pesos: por % de lo que ingresó en el mes, o un monto fijo.
const catLimit = (c, income) => Number(c.limit_pct) > 0 ? (income * Number(c.limit_pct)) / 100 : Number(c.monthly_limit) || 0;
const MiniStat = ({ label, value, color }) => <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 14, padding: "10px 12px", minWidth: 0 }}>
  <div style={{ fontSize: 11, color: C.sub }}>{label}</div>
  <div className="k-num" style={{ fontSize: 15, fontWeight: 500, marginTop: 2, color: color || C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
</div>;

// ─────── Datos de finanzas (compartidos por Hoy y Finanzas) ───────
function useFinance(token) {
  const [month, setMonth] = useState(curMonth());
  const [cats, setCats] = useState([]);
  const [exps, setExps] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [carry, setCarry] = useState(0);
  const [lo, setLo] = useState(true);

  const load = useCallback(async () => {
    const from = shiftMonth(month, 0) + "-01", to = shiftMonth(month, 1) + "-01";
    // Acumulado: lo que sobró (o faltó) en los meses anteriores desde que arrancó Kairo.
    const sumOf = (r) => (Array.isArray(r) ? r : []).reduce((s, x) => s + Number(x.amount_ars || 0), 0);
    const prev = from > KAIRO_DESDE ? Promise.all([
      dq("kairo_incomes", { token, filters: `?select=amount_ars&source=neq.ignorado&income_date=gte.${KAIRO_DESDE}&income_date=lt.${from}` }),
      dq("mp_expenses", { token, filters: `?select=amount_ars&source=neq.ignorado&expense_date=gte.${KAIRO_DESDE}&expense_date=lt.${from}` }),
    ]).then(([i, o]) => sumOf(i) - sumOf(o)) : Promise.resolve(0);
    const [c, e, b, cr] = await Promise.all([
      dq("mp_expense_categories", { token, filters: "?select=*&order=sort_order.asc,name.asc" }),
      dq("mp_expenses", { token, filters: `?select=*&source=neq.ignorado&expense_date=gte.${from}&expense_date=lt.${to}&order=expense_date.desc,created_at.desc` }),
      dq("kairo_incomes", { token, filters: `?select=*&source=neq.ignorado&income_date=gte.${from}&income_date=lt.${to}&order=income_date.desc,created_at.desc` }),
      prev,
    ]);
    setCarry(cr);
    setCats(Array.isArray(c) ? c : []);
    setExps(Array.isArray(e) ? e : []);
    setIncomes(Array.isArray(b) ? b : []);
    setLo(false);
  }, [token, month]);
  useEffect(() => { load(); }, [load]);

  const spent = exps.reduce((s, e) => s + Number(e.amount_ars || 0), 0);
  // El presupuesto del mes es lo que entró (ingresos a mano + cobros de Mercado Pago).
  const income = incomes.reduce((s, e) => s + Number(e.amount_ars || 0), 0);
  // Disponible total = lo acumulado de meses anteriores + lo que entró este mes.
  const budget = income > 0 || carry !== 0 ? income + carry : null;
  const isCur = month === curMonth();
  const dim = daysIn(month);
  const dayNow = isCur ? new Date().getDate() : month < curMonth() ? dim : 0;
  const left = budget != null ? budget - spent : null;
  const monthLeft = income - spent; // lo de este mes, sin tocar lo acumulado
  const daysLeft = isCur ? dim - dayNow + 1 : 0;
  const byCat = useMemo(() => {
    const m = {}; for (const e of exps) { const k = e.category_id || "_none"; m[k] = (m[k] || 0) + Number(e.amount_ars || 0); } return m;
  }, [exps]);
  const uncategorized = exps.filter(e => !e.category_id);

  return { month, setMonth, cats, exps, incomes, income, carry, monthLeft, budget, spent, left, dim, dayNow, daysLeft, isCur, byCat, uncategorized, lo, load };
}

// ─────── Hoy ───────
function Hoy({ fin, go }) {
  const d = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
      <Wordmark /><span style={{ fontSize: 13, color: C.sub }}>{d[0].toUpperCase() + d.slice(1)}</span>
    </div>
    <button className="k-press" onClick={() => go("finanzas")} style={{ ...card, width: "100%", textAlign: "left", color: C.text, display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.sub }}><span>Finanzas · {monthName(curMonth()).toLowerCase()}</span><Icon d={I.right} size={16} /></div>
      {fin.budget != null ? <>
        <div className="k-num" style={{ fontSize: 30, fontWeight: 500, marginTop: 6 }}>{ars(fin.left)}</div>
        <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>podés gastar hasta{fin.daysLeft > 0 && fin.monthLeft > 0 ? ` · ${ars(fin.monthLeft / fin.daysLeft)} por día` : ""}</div>
        <Bar pct={fin.income > 0 ? fin.spent / fin.income : 1} color={C.blue} mark={fin.dayNow / fin.dim} />
      </> : <div style={{ fontSize: 15, marginTop: 8 }}>Cargá tus ingresos del mes</div>}
      {fin.uncategorized.length > 0 && <div style={{ fontSize: 13, color: C.lime, marginTop: 12 }}>{fin.uncategorized.length} gasto{fin.uncategorized.length > 1 ? "s" : ""} sin categoría</div>}
    </button>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
      {TABS.filter(t => ["fisico", "nutricion", "objetivos"].includes(t.id)).map(t =>
        <button key={t.id} className="k-press" onClick={() => go(t.id)} style={{ ...card, textAlign: "left", color: C.sub, display: "flex", flexDirection: "column", gap: 10 }}>
          <Icon d={t.icon} size={20} /><span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{t.label}</span><span style={{ fontSize: 12 }}>Próximamente</span>
        </button>)}
    </div>
  </>;
}

// ─────── Finanzas ───────
function Finanzas({ fin, token }) {
  const { month, setMonth, cats, exps, incomes, income, carry, monthLeft, budget, spent, left, dim, dayNow, daysLeft, isCur, byCat, lo, load } = fin;
  const [sheet, setSheet] = useState(null); // {type:'cat', exp} | {type:'add'} | {type:'budget'}
  const [syncing, setSyncing] = useState(false);

  // Mercado Pago se sincroniza solo: un cron cada 15 min y además cada vez que abrís Finanzas.
  useEffect(() => {
    let alive = true;
    (async () => {
      setSyncing(true);
      try {
        const r = await fetch("/api/kairo/mp-sync", { method: "POST", headers: { Authorization: `Bearer ${loadSession()?.token || token}` } }).then(r => r.json());
        const n = (r.inserted || 0) + (r.insertedIncomes || 0);
        if (alive && n) { pushToast(`${n} movimiento${n > 1 ? "s" : ""} nuevo${n > 1 ? "s" : ""} de Mercado Pago`); load(); }
      } catch {}
      if (alive) setSyncing(false);
    })();
    return () => { alive = false; };
  }, [token, load]);

  const pct = budget ? spent / budget : 0;
  const moves = useMemo(() => [
    ...exps.map(row => ({ kind: "out", row, date: row.expense_date })),
    ...incomes.map(row => ({ kind: "in", row, date: row.income_date })),
  ].sort((a, b) => b.date.localeCompare(a.date) || String(b.row.created_at || "").localeCompare(String(a.row.created_at || ""))), [exps, incomes]);
  const monthPct = dayNow / dim;
  const catRows = cats.map(c => ({ c, spent: byCat[c.id] || 0, limit: catLimit(c, income) })).filter(r => r.spent > 0 || r.limit > 0).sort((a, b) => b.spent - a.spent);

  return <>
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 999, padding: 2 }}>
        <RoundBtn onClick={() => setMonth(shiftMonth(month, -1))} label="Mes anterior"><Icon d={I.left} size={16} /></RoundBtn>
        <span style={{ fontSize: 14, fontWeight: 500, minWidth: 96, textAlign: "center" }}>{monthName(month)}</span>
        <RoundBtn onClick={() => setMonth(shiftMonth(month, 1))} label="Mes siguiente"><Icon d={I.right} size={16} /></RoundBtn>
      </div>
    </div>

    {lo ? <p style={{ color: C.sub, textAlign: "center", padding: "60px 0" }}>Cargando…</p> : <>
      {/* Resumen */}
      <button className="k-press" onClick={() => setSheet(budget != null ? { type: "budget" } : { type: "income" })} style={{ background: "none", border: "none", color: C.text, textAlign: "left", width: "100%", padding: "18px 2px 4px" }}>
        {budget != null ? <>
          <div style={{ fontSize: 13, color: C.sub }}>{left >= 0 ? "Podés gastar hasta" : "Te estás fundiendo"}</div>
          <div className="k-num" style={{ fontSize: 42, fontWeight: 500, marginTop: 2, color: left >= 0 ? C.text : C.danger }}>{left < 0 ? "−" : ""}{ars(Math.abs(left))}</div>
          {isCur && daysLeft > 0 && monthLeft > 0 && <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
            <span style={{ color: C.lime }}>{ars(monthLeft / daysLeft)}/día</span> para no tocar lo acumulado
          </div>}
          <Bar pct={income > 0 ? spent / income : 1} color={spent > income ? C.warn : C.blue} mark={isCur ? monthPct : null} h={6} />
          <div style={{ display: "grid", gridTemplateColumns: carry !== 0 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8, marginTop: 14 }}>
            <MiniStat label="Ingresó" value={arsK(income)} />
            <MiniStat label="Gastado" value={arsK(spent)} color={spent > income ? C.warn : undefined} />
            {carry !== 0 && <MiniStat label="Acumulado" value={(carry < 0 ? "−" : "+") + arsK(Math.abs(carry))} color={carry < 0 ? C.danger : C.lime} />}
          </div>
          {monthLeft < 0 && left >= 0 && <div style={{ fontSize: 12, color: C.warn, marginTop: 10 }}>Este mes gastaste más de lo que entró: estás usando lo acumulado.</div>}
        </> : <>
          <div style={{ fontSize: 13, color: C.sub }}>Gastado en {monthName(month).toLowerCase()}</div>
          <div className="k-num" style={{ fontSize: 42, fontWeight: 500, marginTop: 2 }}>{ars(spent)}</div>
          <div style={{ fontSize: 14, color: C.lime, marginTop: 6 }}>Cargá un ingreso para armar el presupuesto</div>
        </>}
      </button>

      {/* Acciones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
        <button className="k-press" onClick={() => setSheet({ type: "income" })} style={{ ...btnGhost, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Icon d={I.plus} size={18} sw={2.2} />Ingreso
        </button>
        <button className="k-press" onClick={() => setSheet({ type: "add" })} style={{ ...btnLime, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Icon d={I.plus} size={18} sw={2.2} />Gasto
        </button>
      </div>


      {/* Categorías */}
      <SectionTitle right={<button onClick={() => setSheet({ type: "budget" })} style={linkBtn}>Editar topes</button>}>Por categoría</SectionTitle>
      {catRows.length === 0 ? <div style={{ ...card, color: C.sub, fontSize: 14 }}>Todavía no hay gastos categorizados.</div> :
        <div style={{ ...card, padding: "2px 16px" }}>
          {catRows.map((r, i) => {
            const p = r.limit ? r.spent / r.limit : 0;
            const col = !r.limit ? C.dim : p >= 1 ? C.danger : p >= 0.85 ? C.warn : C.blue;
            return <div key={r.c.id} style={{ padding: "13px 0", borderBottom: i < catRows.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, gap: 10 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.c.name}</span>
                <span className="k-num" style={{ whiteSpace: "nowrap" }}>{arsK(r.spent)}{r.limit > 0 && <span style={{ color: C.sub }}> / {arsK(r.limit)}</span>}</span>
              </div>
              {r.limit > 0 ? <Bar pct={p} color={col} h={3} mt={8} /> : <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{budget ? Math.round((r.spent / budget) * 100) + "% del presupuesto" : "sin tope"}</div>}
            </div>;
          })}
        </div>}

      {/* Movimientos */}
      <SectionTitle right={<span style={{ fontSize: 12, color: C.dim }}>{syncing ? "Actualizando Mercado Pago…" : "Mercado Pago al día"}</span>}>Movimientos</SectionTitle>
      {moves.length === 0 ? <div style={{ ...card, color: C.sub, fontSize: 14 }}>Sin movimientos este mes. Lo que pagues o cobres con Mercado Pago aparece solo.</div> :
        <div style={{ ...card, padding: "2px 16px" }}>
          {moves.map(({ kind, row: e }, i) => {
            const last = i === moves.length - 1;
            if (kind === "in") return <button key={"in" + e.id} onClick={() => setSheet({ type: "income", inc: e })} style={{ width: "100%", background: "none", border: "none", color: C.text, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", textAlign: "left", borderBottom: last ? "none" : `0.5px solid ${C.line}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description || "Ingreso"}</div>
                <div style={{ fontSize: 12, marginTop: 2, color: C.sub }}>Ingreso · {dayLabel(e.income_date)}{e.source === "mp" ? " · MP" : ""}</div>
              </div>
              <span className="k-num" style={{ fontSize: 15, whiteSpace: "nowrap", color: C.lime }}>+{ars(e.amount_ars)}</span>
            </button>;
            const cat = cats.find(c => c.id === e.category_id);
            return <button key={e.id} onClick={() => setSheet({ type: "cat", exp: e })} style={{ width: "100%", background: "none", border: "none", color: C.text, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", textAlign: "left", borderBottom: last ? "none" : `0.5px solid ${C.line}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description || e.merchant || "Gasto"}</div>
                <div style={{ fontSize: 12, marginTop: 2, color: cat ? C.sub : C.lime }}>
                  {cat ? cat.name : "Sin categoría · tocá para asignar"} · {dayLabel(e.expense_date)}{e.source === "mp" ? " · MP" : ""}
                </div>
              </div>
              <span className="k-num" style={{ fontSize: 15, whiteSpace: "nowrap" }}>−{ars(e.amount_ars)}</span>
            </button>;
          })}
        </div>}
    </>}

    {sheet?.type === "cat" && <CategorySheet exp={sheet.exp} cats={cats} token={token} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {sheet?.type === "add" && <AddSheet cats={cats} token={token} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {sheet?.type === "income" && <IncomeSheet inc={sheet.inc} token={token} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {sheet?.type === "budget" && <BudgetSheet month={month} income={income} cats={cats} token={token} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
  </>;
}

// ─────── Sheets ───────
function Sheet({ title, onClose, children }) {
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, []);
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", animation: "kFade 160ms", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88dvh", overflowY: "auto", background: C.card, borderTop: `0.5px solid ${C.line}`, borderRadius: "22px 22px 0 0", padding: "10px 18px calc(env(safe-area-inset-bottom) + 18px)", animation: "kUp 260ms cubic-bezier(.2,.9,.3,1)" }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: C.line, margin: "0 auto 14px" }} />
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 14, letterSpacing: "-0.01em" }}>{title}</div>
      {children}
    </div>
  </div>;
}

function CatChips({ cats, value, onChange }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
    {cats.map(c => {
      const on = value === c.id;
      return <button key={c.id} className="k-press" onClick={() => onChange(on ? null : c.id)} style={{ padding: "9px 14px", borderRadius: 999, fontSize: 14, border: `0.5px solid ${on ? C.lime : C.line}`, background: on ? C.lime : C.cardHi, color: on ? C.limeInk : C.text, fontWeight: on ? 600 : 400 }}>{c.name}</button>;
    })}
  </div>;
}

function CategorySheet({ exp, cats, token, onClose, onSaved }) {
  const [cat, setCat] = useState(exp.category_id);
  const [desc, setDesc] = useState(exp.description || exp.merchant || "");
  const [remember, setRemember] = useState(exp.source === "mp");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const save = async () => {
    setSaving(true);
    await dq("mp_expenses", { method: "PATCH", token, filters: `?id=eq.${exp.id}`, body: { category_id: cat, description: desc.trim() || null } });
    if (remember && exp.merchant && cat) {
      const key = merchantKey(exp.merchant);
      await dq("kairo_merchant_rules", { method: "POST", token, filters: "?on_conflict=merchant_key", body: { merchant_key: key, category_id: cat, updated_at: new Date().toISOString() }, headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
      // Los otros gastos del mismo comercio que siguen sin categoría también se ordenan.
      await dq("mp_expenses", { method: "PATCH", token, filters: `?merchant=eq.${encodeURIComponent(exp.merchant)}&category_id=is.null`, body: { category_id: cat } });
    }
    setSaving(false); pushToast("Guardado"); onSaved();
  };
  // Los de Mercado Pago no se borran: quedan marcados para que la sincronización no los vuelva a traer.
  const notExpense = async () => {
    setSaving(true);
    if (exp.mp_payment_id) {
      await dq("mp_expenses", { method: "PATCH", token, filters: `?id=eq.${exp.id}`, body: { source: "ignorado", category_id: null } });
      if (remember && exp.merchant) {
        await dq("kairo_merchant_rules", { method: "POST", token, filters: "?on_conflict=merchant_key", body: { merchant_key: merchantKey(exp.merchant), category_id: null, updated_at: new Date().toISOString() }, headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
        await dq("mp_expenses", { method: "PATCH", token, filters: `?merchant=eq.${encodeURIComponent(exp.merchant)}&category_id=is.null&source=eq.mp`, body: { source: "ignorado" } });
      }
    } else {
      await dq("mp_expenses", { method: "DELETE", token, filters: `?id=eq.${exp.id}` });
    }
    setSaving(false); pushToast("Sacado del presupuesto"); onSaved();
  };

  return <Sheet title="Categorizar" onClose={onClose}>
    <div className="k-num" style={{ fontSize: 30, fontWeight: 500 }}>−{ars(exp.amount_ars)}</div>
    <div style={{ fontSize: 13, color: C.sub, margin: "2px 0 16px" }}>{exp.merchant ? `${exp.merchant} · ` : ""}{dayLabel(exp.expense_date)}{exp.payment_method ? ` · ${exp.payment_method}` : ""}</div>
    <Label>Concepto</Label>
    <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: envío, cena con amigos" style={field} />
    <Label>Categoría</Label>
    <CatChips cats={cats} value={cat} onChange={setCat} />
    {exp.merchant && <button onClick={() => setRemember(!remember)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", color: C.text, padding: "18px 0 4px", textAlign: "left" }}>
      <Toggle on={remember} />
      <span style={{ fontSize: 14 }}>Usar siempre para <b style={{ fontWeight: 500 }}>{exp.merchant}</b><br /><span style={{ color: C.sub, fontSize: 12 }}>Apagalo si no siempre es lo mismo (ej. Uber viaje vs. envío, o una transferencia que a veces es gasto y a veces no)</span></span>
    </button>}
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 18 }}>{saving ? "Guardando…" : "Guardar"}</button>
    {!confirmDel ? <button onClick={() => setConfirmDel(true)} className="k-press" style={{ ...btnGhost, marginTop: 10 }}>No es un gasto</button>
      : <button onClick={notExpense} disabled={saving} className="k-press" style={{ ...btnGhost, marginTop: 10, color: C.danger }}>{remember && exp.mp_payment_id && exp.merchant ? `Sacar este y los próximos de ${exp.merchant}` : "Tocá de nuevo para sacarlo"}</button>}
  </Sheet>;
}

function AddSheet({ cats, token, onClose, onSaved }) {
  const [amount, setAmount] = useState(""); const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(null); const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const n = parseNum(amount); if (n <= 0) return pushToast("Ingresá un monto");
    setSaving(true);
    await dq("mp_expenses", { method: "POST", token, body: { amount_ars: n, description: desc.trim() || null, category_id: cat, expense_date: date, payment_method: "Efectivo", installments: 1, source: "manual" } });
    setSaving(false); pushToast("Gasto cargado"); onSaved();
  };
  return <Sheet title="Nuevo gasto" onClose={onClose}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, borderBottom: `0.5px solid ${C.line}`, paddingBottom: 8 }}>
      <span style={{ fontSize: 30, color: C.sub }}>$</span>
      <input autoFocus inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="k-num" style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 36, fontWeight: 500 }} />
    </div>
    <Label>Concepto</Label>
    <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: verdulería" style={field} />
    <Label>Categoría</Label>
    <CatChips cats={cats} value={cat} onChange={setCat} />
    <Label>Fecha</Label>
    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...field, colorScheme: "dark" }} />
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Guardando…" : "Cargar gasto"}</button>
  </Sheet>;
}

function BudgetSheet({ month, income, cats, token, onClose, onSaved }) {
  // Cada tope es un monto fijo ($) o un % de lo que ingresa en el mes (%).
  const [rows, setRows] = useState(() => Object.fromEntries(cats.map(c => [c.id, Number(c.limit_pct) > 0
    ? { mode: "%", v: String(Number(c.limit_pct)) }
    : { mode: "$", v: c.monthly_limit ? String(Math.round(c.monthly_limit)) : "" }])));
  const [newCat, setNewCat] = useState("");
  const [saving, setSaving] = useState(false);
  const t = income || 0;
  const pesos = (r) => r.mode === "%" ? (t * parseNum(r.v)) / 100 : parseNum(r.v);
  const sumLimits = Object.values(rows).reduce((s, r) => s + pesos(r), 0);
  const setRow = (id, patch) => setRows({ ...rows, [id]: { ...rows[id], ...patch } });
  const flip = (id) => {
    const r = rows[id], p = pesos(r);
    // Al cambiar de modo convierte el valor, así no se pierde lo que habías puesto.
    setRow(id, r.mode === "$" ? { mode: "%", v: t > 0 && p > 0 ? String(Math.round((p / t) * 100)) : "" } : { mode: "$", v: p > 0 ? String(Math.round(p)) : "" });
  };

  const save = async () => {
    setSaving(true);
    await Promise.all(cats.map(c => {
      const r = rows[c.id];
      const body = r.mode === "%" ? { limit_pct: parseNum(r.v) || null, monthly_limit: null } : { monthly_limit: parseNum(r.v) || null, limit_pct: null };
      if ((Number(c.limit_pct) || null) === body.limit_pct && (Number(c.monthly_limit) || null) === body.monthly_limit) return null;
      return dq("mp_expense_categories", { method: "PATCH", token, filters: `?id=eq.${c.id}`, body });
    }));
    if (newCat.trim()) await dq("mp_expense_categories", { method: "POST", token, body: { name: newCat.trim(), sort_order: cats.length } });
    setSaving(false); pushToast("Guardado"); onSaved();
  };

  return <Sheet title={`Topes de ${monthName(month).toLowerCase()}`} onClose={onClose}>
    <div style={{ fontSize: 13, color: C.sub }}>Ingresó este mes</div>
    <div className="k-num" style={{ fontSize: 30, fontWeight: 500, marginTop: 2 }}>{ars(t)}</div>
    <div style={{ fontSize: 12, color: sumLimits > t && t > 0 ? C.warn : C.sub, marginTop: 6 }}>
      Repartido en topes {ars(sumLimits)}{t > 0 ? ` · ${Math.round((sumLimits / t) * 100)}%` : ""}
    </div>
    <Label>Tope por categoría · tocá $ o % para cambiar</Label>
    <div style={{ background: C.cardHi, borderRadius: 14, padding: "0 14px" }}>
      {cats.map((c, i) => {
        const r = rows[c.id];
        return <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < cats.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
            {parseNum(r.v) > 0 && <div style={{ fontSize: 11, color: C.sub }}>{r.mode === "%" ? `≈ ${ars(pesos(r))} este mes` : t > 0 ? `${Math.round((pesos(r) / t) * 100)}% de lo que ingresó` : ""}</div>}
          </div>
          <button onClick={() => flip(c.id)} className="k-press" aria-label="Cambiar entre monto y porcentaje" style={{ width: 34, height: 34, borderRadius: 10, border: `0.5px solid ${C.line}`, background: C.card, color: C.lime, fontSize: 14, fontWeight: 600 }}>{r.mode}</button>
          <div style={{ width: 104 }}>
            <div style={{ ...field, display: "flex", alignItems: "center", gap: 4, padding: "8px 10px" }}>
              <input inputMode="numeric" value={r.v} onChange={e => setRow(c.id, { v: e.target.value.replace(/[^\d]/g, "") })} placeholder="0" className="k-num" style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 16, textAlign: "right" }} />
              {r.mode === "%" && <span style={{ color: C.sub }}>%</span>}
            </div>
          </div>
        </div>;
      })}
    </div>
    <Label>Nueva categoría</Label>
    <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Ej: Suscripciones" style={field} />
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Guardando…" : "Guardar"}</button>
  </Sheet>;
}

// Alta de un ingreso a mano (sueldo, efectivo, otro banco) o detalle de uno existente.
function IncomeSheet({ inc, token, onClose, onSaved }) {
  const [amount, setAmount] = useState(inc ? String(Math.round(inc.amount_ars)) : "");
  const [desc, setDesc] = useState(inc?.description || "");
  const [date, setDate] = useState(inc?.income_date || today());
  const [saving, setSaving] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const fromMp = !!inc?.mp_payment_id;

  const save = async () => {
    const n = parseNum(amount); if (n <= 0) return pushToast("Ingresá un monto");
    setSaving(true);
    const body = fromMp ? { description: desc.trim() || null } : { amount_ars: n, description: desc.trim() || null, income_date: date };
    if (inc) await dq("kairo_incomes", { method: "PATCH", token, filters: `?id=eq.${inc.id}`, body });
    else await dq("kairo_incomes", { method: "POST", token, body: { ...body, source: "manual" } });
    setSaving(false); pushToast(inc ? "Guardado" : "Ingreso cargado"); onSaved();
  };
  // Los de Mercado Pago quedan marcados para que no vuelvan a entrar; los manuales se borran.
  const notIncome = async () => {
    setSaving(true);
    if (fromMp) await dq("kairo_incomes", { method: "PATCH", token, filters: `?id=eq.${inc.id}`, body: { source: "ignorado" } });
    else await dq("kairo_incomes", { method: "DELETE", token, filters: `?id=eq.${inc.id}` });
    setSaving(false); pushToast("Sacado del presupuesto"); onSaved();
  };

  return <Sheet title={inc ? "Ingreso" : "Nuevo ingreso"} onClose={onClose}>
    {fromMp ? <>
      <div className="k-num" style={{ fontSize: 30, fontWeight: 500, color: C.lime }}>+{ars(inc.amount_ars)}</div>
      <div style={{ fontSize: 13, color: C.sub, margin: "2px 0 4px" }}>Mercado Pago · {dayLabel(inc.income_date)}</div>
    </> : <div style={{ display: "flex", alignItems: "baseline", gap: 4, borderBottom: `0.5px solid ${C.line}`, paddingBottom: 8 }}>
      <span style={{ fontSize: 30, color: C.sub }}>$</span>
      <input autoFocus={!inc} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="k-num" style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: C.text, fontSize: 36, fontWeight: 500 }} />
    </div>}
    <Label>Concepto</Label>
    <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: sueldo, cobro de un trabajo" style={field} />
    {!fromMp && <>
      <Label>Fecha</Label>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...field, colorScheme: "dark" }} />
    </>}
    <button className="k-press" onClick={save} disabled={saving} style={{ ...btnLime, marginTop: 20 }}>{saving ? "Guardando…" : inc ? "Guardar" : "Cargar ingreso"}</button>
    {inc && (!confirmOut ? <button onClick={() => setConfirmOut(true)} className="k-press" style={{ ...btnGhost, marginTop: 10 }}>No es un ingreso</button>
      : <button onClick={notIncome} disabled={saving} className="k-press" style={{ ...btnGhost, marginTop: 10, color: C.danger }}>Tocá de nuevo para sacarlo</button>)}
  </Sheet>;
}

// ─────── Piezas ───────
function Bar({ pct, color, mark, h = 4, mt = 14 }) {
  return <div style={{ position: "relative", height: h, background: C.line, borderRadius: h, marginTop: mt }}>
    <div style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%`, height: "100%", background: color, borderRadius: h, transition: "width 500ms cubic-bezier(.2,.9,.3,1)" }} />
    {mark != null && <div title="Día del mes" style={{ position: "absolute", top: -3, left: `${Math.min(100, mark * 100)}%`, width: 1.5, height: h + 6, background: C.text, opacity: 0.55, borderRadius: 1 }} />}
  </div>;
}
function Toggle({ on }) {
  return <span style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 13, background: on ? C.lime : C.line, position: "relative", transition: "background 160ms" }}>
    <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: on ? C.limeInk : C.sub, transition: "left 160ms" }} />
  </span>;
}
const SectionTitle = ({ children, right }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "28px 2px 10px" }}><span style={{ fontSize: 13, color: C.sub }}>{children}</span>{right}</div>;
const Label = ({ children }) => <div style={{ fontSize: 13, color: C.sub, margin: "18px 2px 8px" }}>{children}</div>;
const RoundBtn = ({ children, onClick, label }) => <button onClick={onClick} aria-label={label} className="k-press" style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: "transparent", color: C.sub, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</button>;

const card = { background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 20, padding: 16 };
const field = { width: "100%", background: C.cardHi, border: `0.5px solid ${C.line}`, borderRadius: 12, padding: "13px 14px", color: C.text, outline: "none" };
const btnLime = { width: "100%", background: C.lime, color: C.limeInk, border: "none", borderRadius: 14, padding: "14px 16px", fontSize: 15, fontWeight: 600 };
const btnGhost = { width: "100%", background: C.card, color: C.text, border: `0.5px solid ${C.line}`, borderRadius: 14, padding: "14px 16px", fontSize: 15, fontWeight: 500 };
const linkBtn = { background: "none", border: "none", color: C.lime, fontSize: 13, padding: 0 };
