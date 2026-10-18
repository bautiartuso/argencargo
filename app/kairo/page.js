"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { dq, loadSession, clearSession, ac, saveSession } from "../../lib/sb-client";
import Fisico, { WorkoutLayer } from "./fisico";
import Perfil, { Welcome } from "./perfil";
import Inicio from "./hoy";
import Nutricion from "./nutricion";
import { C, CSS, ymd, today, curMonth, ars, arsK, monthName, shiftMonth, daysIn, parseNum, merchantKey, dayLabel, I, Icon, pushToast, Toast, MiniStat, Sheet, Bar, Toggle, SectionTitle, Label, RoundBtn, card, field, btnLime, btnGhost, linkBtn, useRefresh, SkelCards } from "./ui";

// ──────────────────────────────────────────────────────────────────────
// KAIRO · app personal (físico, nutrición, finanzas, objetivos). Mobile-first.
// Estética: casi negro + tarjetas grafito con borde fino, Inter, acento lima,
// azul eléctrico para plata/objetivos. Cada sección es independiente; "Hoy" resume.
// Por ahora la sección completa es Finanzas (presupuesto mensual + Mercado Pago).
// ──────────────────────────────────────────────────────────────────────

// Quién entra a Kairo: el dueño (admin) y las cuentas creadas para amigos (rol "kairo").
const KAIRO_ROLES = ["admin", "kairo"];

// ─────── Root ───────
export default function KairoPage() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { const s = loadSession(); if (s?.token && KAIRO_ROLES.includes(s?.profile?.role)) setSession(s); setReady(true); }, []);
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
      if (!KAIRO_ROLES.includes(prof?.role)) { setErr("Esta cuenta no tiene acceso a Kairo"); setLo(false); return; }
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
  { id: "hoy", label: "Inicio", icon: I.home },
  { id: "fisico", label: "Físico", icon: I.gym },
  { id: "nutricion", label: "Nutrición", icon: I.food },
  { id: "finanzas", label: "Finanzas", icon: I.wallet },
  { id: "perfil", label: "Perfil", icon: I.user },
];

function App({ session }) {
  const [tab, setTab] = useState("hoy");
  // Tu perfil (nombre, foto, organización de días): lo usan Inicio y la barra de abajo.
  const [me, setMe] = useState(null);
  useEffect(() => {
    const load = () => dq("kairo_profile", { token: session.token, filters: "?select=*&limit=1" }).then(r => setMe(Array.isArray(r) ? r[0] || {} : null));
    load(); window.addEventListener("kairo-profile", load);
    return () => window.removeEventListener("kairo-profile", load);
  }, [session.token]);
  const scroller = useRef(null);
  useEffect(() => { try { const t = localStorage.getItem("kairo_tab"); if (t) setTab(t === "objetivos" ? "perfil" : t); } catch {} }, []);
  // Al tocar una notificación ("Turi subió una historia") la app abre en la pestaña que dice.
  useEffect(() => {
    const open = (url) => { const t = new URL(url, location.origin).searchParams.get("tab"); if (t && TABS.some(x => x.id === t)) go(t); };
    if (location.search.includes("tab=")) { open(location.href); history.replaceState(null, "", "/kairo"); }
    const onMsg = (e) => e.data?.type === "kairo-open" && open(e.data.url);
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (t) => { setTab(t); try { localStorage.setItem("kairo_tab", t); } catch {} scroller.current?.scrollTo(0, 0); };
  const fin = useFinance(session.token);

  // Deslizar hacia abajo desde arriba de todo = actualizar (como Instagram). Avisa a todas las pantallas.
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touch = useRef(null);
  const onTouchStart = (e) => { touch.current = scroller.current?.scrollTop <= 0 && !refreshing ? e.touches[0].clientY : null; };
  const onTouchMove = (e) => { if (touch.current == null) return; const dy = e.touches[0].clientY - touch.current; if (dy > 0 && scroller.current?.scrollTop <= 0) setPull(Math.min(96, dy * 0.45)); else if (pull) setPull(0); };
  const onTouchEnd = async () => {
    if (touch.current == null) return; touch.current = null;
    if (pull < 56) return setPull(0);
    setRefreshing(true); setPull(52);
    window.dispatchEvent(new Event("kairo-refresh")); window.dispatchEvent(new Event("kairo-profile"));
    await new Promise(r => setTimeout(r, 900));
    setRefreshing(false); setPull(0);
  };

  // Shell fijo a pantalla completa con el scroll adentro y la barra al fondo del flujo.
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg }}>
      <main ref={scroller} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd} style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", position: "relative" }}>
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: "calc(env(safe-area-inset-top) + 6px)", display: "flex", justifyContent: "center", pointerEvents: "none", opacity: Math.min(1, pull / 40), transform: `translateY(${pull - 40}px)`, transition: touch.current == null ? "transform 220ms cubic-bezier(.2,.9,.3,1), opacity 220ms" : "none" }}>
          <span style={{ width: 34, height: 34, borderRadius: 17, background: C.card, border: `0.5px solid ${C.line}`, color: pull >= 56 || refreshing ? C.lime : C.sub, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${refreshing ? 0 : pull * 4}deg)`, animation: refreshing ? "kSpin 800ms linear infinite" : "none" }}><Icon d={I.sync} size={17} sw={1.8} /></span>
        </div>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "calc(env(safe-area-inset-top) + 18px) 16px 28px", transform: `translateY(${pull}px)`, transition: touch.current == null ? "transform 220ms cubic-bezier(.2,.9,.3,1)" : "none" }}>
          <div key={tab} className="k-tab">
            {tab === "hoy" && <Inicio token={session.token} me={me} fin={fin} go={go} />}
            {tab === "finanzas" && <Finanzas fin={fin} token={session.token} />}
            {tab === "fisico" && <Fisico token={session.token} onProfile={() => go("perfil")} />}
            {tab === "perfil" && <Perfil token={session.token} isAdmin={session.profile?.role === "admin"} />}
            {tab === "nutricion" && <Nutricion token={session.token} onProfile={() => go("perfil")} />}
          </div>
        </div>
      </main>
      <WorkoutLayer token={session.token} />
      {me && !me.nombre && <Welcome token={session.token} onDone={() => window.dispatchEvent(new Event("kairo-profile"))} />}
      <nav style={{ flexShrink: 0, background: C.bg, borderTop: `0.5px solid ${C.line}`, paddingBottom: "max(16px, min(env(safe-area-inset-bottom), 22px))" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", display: "flex" }}>
          {TABS.map(t => {
            const on = tab === t.id;
            return <button key={t.id} onClick={() => go(t.id)} aria-label={t.label} style={{ flex: 1, background: "none", border: "none", padding: "8px 0 2px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: on ? C.lime : C.dim }}>
              {t.id === "perfil" && me?.avatar ? <span style={{ width: 25, height: 25, borderRadius: 13, overflow: "hidden", border: `1.5px solid ${on ? C.lime : "transparent"}`, display: "flex" }}><img src={me.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></span> : <Icon d={t.icon} size={23} sw={on ? 1.9 : 1.6} />}
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
  useRefresh(load);
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

// ─────── Finanzas ───────
function Finanzas({ fin, token }) {
  const { month, setMonth, cats, exps, incomes, income, carry, monthLeft, budget, spent, left, dim, dayNow, daysLeft, isCur, byCat, lo, load } = fin;
  const [sheet, setSheet] = useState(null); // {type:'cat', exp} | {type:'add'} | {type:'budget'}
  const [syncing, setSyncing] = useState(false);
  const [noMp, setNoMp] = useState(false); // cuentas sin Mercado Pago conectado
  const [view, setView] = useState("mes");

  // Mercado Pago se sincroniza solo: un cron cada 15 min y además cada vez que abrís Finanzas.
  useEffect(() => {
    let alive = true;
    (async () => {
      setSyncing(true);
      try {
        const r = await fetch("/api/kairo/mp-sync", { method: "POST", headers: { Authorization: `Bearer ${loadSession()?.token || token}` } }).then(r => r.json());
        if (alive && r.skipped) setNoMp(true);
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
      <div style={{ display: "flex", background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 999, padding: 3 }}>
        {[["mes", "Mes"], ["resumen", "Resumen"]].map(([id, label]) =>
          <button key={id} onClick={() => setView(id)} className="k-press" style={{ border: "none", borderRadius: 999, padding: "7px 18px", fontSize: 14, fontWeight: 500, background: view === id ? C.cardHi : "transparent", color: view === id ? C.text : C.sub }}>{label}</button>)}
      </div>
    </div>

    {view === "resumen" ? <Resumen token={token} cats={cats} /> : <>
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, marginTop: 14 }}>
      <RoundBtn onClick={() => setMonth(shiftMonth(month, -1))} label="Mes anterior"><Icon d={I.left} size={16} /></RoundBtn>
      <span style={{ fontSize: 15, fontWeight: 500, minWidth: 100, textAlign: "center" }}>{monthName(month)}</span>
      <RoundBtn onClick={() => setMonth(shiftMonth(month, 1))} label="Mes siguiente"><Icon d={I.right} size={16} /></RoundBtn>
    </div>

    {lo ? <SkelCards n={3} h={96} /> : <>
      {/* Resumen */}
      <button className="k-press" onClick={() => setSheet(budget != null ? { type: "budget" } : { type: "income" })} style={{ background: "none", border: "none", color: C.text, textAlign: "left", width: "100%", padding: "18px 2px 4px" }}>
        {budget != null ? <>
          <div style={{ fontSize: 13, color: C.sub }}>Saldo del mes</div>
          <div className="k-num" style={{ fontSize: 42, fontWeight: 500, marginTop: 2, color: monthLeft >= 0 ? C.pos : C.neg }}>{monthLeft < 0 ? "−" : ""}{ars(Math.abs(monthLeft))}</div>
          {isCur && daysLeft > 0 && monthLeft > 0 && <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
            Podés gastar <span style={{ color: C.text }}>{ars(monthLeft / daysLeft)} por día</span> hasta fin de mes
          </div>}
          <Bar pct={income > 0 ? spent / income : 1} color={spent > income ? C.neg : C.blue} mark={isCur ? monthPct : null} h={6} />
          <div style={{ display: "grid", gridTemplateColumns: carry !== 0 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8, marginTop: 14 }}>
            <MiniStat label="Ingresos" value={"+" + arsK(income)} color={C.pos} />
            <MiniStat label="Gastos" value={"−" + arsK(spent)} color={C.neg} />
            {carry !== 0 && <MiniStat label="Ahorro previo" value={(carry < 0 ? "−" : "+") + arsK(Math.abs(carry))} color={carry < 0 ? C.neg : C.pos} />}
          </div>
          {monthLeft < 0 && left >= 0 && <div style={{ fontSize: 12, color: C.warn, marginTop: 10 }}>Gastaste {ars(-monthLeft)} más de lo que entró: sale de tu ahorro (te quedan {ars(left)}).</div>}
          {left < 0 && <div style={{ fontSize: 12, color: C.neg, marginTop: 10 }}>Te estás fundiendo: gastaste {ars(-left)} más de todo lo que tenías.</div>}
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
      <SectionTitle right={!noMp && <span style={{ fontSize: 12, color: C.dim }}>{syncing ? "Actualizando Mercado Pago…" : "Mercado Pago al día"}</span>}>Movimientos</SectionTitle>
      {moves.length === 0 ? <div style={{ ...card, color: C.sub, fontSize: 14 }}>Sin movimientos este mes. Cargá tus ingresos y gastos con los botones de arriba.</div> :
        <div style={{ ...card, padding: "2px 16px" }}>
          {moves.map(({ kind, row: e }, i) => {
            const last = i === moves.length - 1;
            if (kind === "in") return <button key={"in" + e.id} onClick={() => setSheet({ type: "income", inc: e })} style={{ width: "100%", background: "none", border: "none", color: C.text, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", textAlign: "left", borderBottom: last ? "none" : `0.5px solid ${C.line}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description || "Ingreso"}</div>
                <div style={{ fontSize: 12, marginTop: 2, color: C.sub }}>Ingreso · {dayLabel(e.income_date)}{e.source === "mp" ? " · MP" : ""}</div>
              </div>
              <span className="k-num" style={{ fontSize: 15, whiteSpace: "nowrap", color: C.pos }}>+{ars(e.amount_ars)}</span>
            </button>;
            const cat = cats.find(c => c.id === e.category_id);
            return <button key={e.id} onClick={() => setSheet({ type: "cat", exp: e })} style={{ width: "100%", background: "none", border: "none", color: C.text, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", textAlign: "left", borderBottom: last ? "none" : `0.5px solid ${C.line}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description || e.merchant || "Gasto"}</div>
                <div style={{ fontSize: 12, marginTop: 2, color: cat ? C.sub : C.lime }}>
                  {cat ? cat.name : "Sin categoría · tocá para asignar"} · {dayLabel(e.expense_date)}{e.source === "mp" ? " · MP" : ""}
                </div>
              </div>
              <span className="k-num" style={{ fontSize: 15, whiteSpace: "nowrap", color: C.neg }}>−{ars(e.amount_ars)}</span>
            </button>;
          })}
        </div>}
    </>}
    </>}

    {sheet?.type === "cat" && <CategorySheet exp={sheet.exp} cats={cats} token={token} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {sheet?.type === "add" && <AddSheet cats={cats} token={token} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {sheet?.type === "income" && <IncomeSheet inc={sheet.inc} token={token} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
    {sheet?.type === "budget" && <BudgetSheet month={month} income={income} cats={cats} token={token} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />}
  </>;
}

// ─────── Resumen: todo desde que arrancó Kairo, mes por mes ───────
function Resumen({ token, cats }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      const [i, o] = await Promise.all([
        dq("kairo_incomes", { token, filters: `?select=amount_ars,income_date&source=neq.ignorado&income_date=gte.${KAIRO_DESDE}` }),
        dq("mp_expenses", { token, filters: `?select=amount_ars,expense_date,category_id&source=neq.ignorado&expense_date=gte.${KAIRO_DESDE}` }),
      ]);
      setData({ ins: Array.isArray(i) ? i : [], outs: Array.isArray(o) ? o : [] });
    })();
  }, [token]);
  if (!data) return <SkelCards n={3} h={96} />;

  const months = [];
  for (let m = KAIRO_DESDE.slice(0, 7); m <= curMonth(); m = shiftMonth(m, 1)) months.push(m);
  const rows = months.map(m => {
    const inc = data.ins.filter(x => x.income_date.startsWith(m)).reduce((s, x) => s + Number(x.amount_ars || 0), 0);
    const out = data.outs.filter(x => x.expense_date.startsWith(m)).reduce((s, x) => s + Number(x.amount_ars || 0), 0);
    return { m, inc, out, bal: inc - out };
  }).reverse();
  const totIn = rows.reduce((s, r) => s + r.inc, 0), totOut = rows.reduce((s, r) => s + r.out, 0), totBal = totIn - totOut;
  const maxV = Math.max(1, ...rows.map(r => Math.max(r.inc, r.out)));
  const byCat = {};
  for (const x of data.outs) { const k = x.category_id || "_none"; byCat[k] = (byCat[k] || 0) + Number(x.amount_ars || 0); }
  const top = Object.entries(byCat).map(([k, v]) => ({ name: cats.find(c => c.id === k)?.name || "Sin categoría", v })).sort((a, b) => b.v - a.v).slice(0, 6);
  const signed = (n) => (n < 0 ? "−" : "+") + ars(Math.abs(n));

  return <>
    <div style={{ padding: "22px 2px 4px" }}>
      <div style={{ fontSize: 13, color: C.sub }}>Ahorrado desde {monthName(KAIRO_DESDE.slice(0, 7)).toLowerCase()}</div>
      <div className="k-num" style={{ fontSize: 42, fontWeight: 500, marginTop: 2, color: totBal >= 0 ? C.pos : C.neg }}>{signed(totBal)}</div>
      {totIn > 0 && <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>Guardaste el {Math.round((totBal / totIn) * 100)}% de lo que entró</div>}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
      <MiniStat label="Ingresos" value={"+" + arsK(totIn)} color={C.pos} />
      <MiniStat label="Gastos" value={"−" + arsK(totOut)} color={C.neg} />
      <MiniStat label="Gasto/mes" value={arsK(totOut / months.length)} />
    </div>

    <SectionTitle>Mes por mes</SectionTitle>
    <div style={{ ...card, padding: "2px 16px" }}>
      {rows.map((r, i) => <div key={r.m} style={{ padding: "13px 0", borderBottom: i < rows.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 15 }}>{monthName(r.m)}</span>
          <span className="k-num" style={{ fontSize: 15, color: r.bal >= 0 ? C.pos : C.neg }}>{signed(r.bal)}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", columnGap: 10, rowGap: 4, alignItems: "center", marginTop: 8, fontSize: 12, color: C.sub }}>
          <div style={{ height: 3, background: C.line, borderRadius: 2 }}><div style={{ width: `${(r.inc / maxV) * 100}%`, height: 3, background: C.pos, borderRadius: 2 }} /></div>
          <span className="k-num">+{arsK(r.inc)}</span>
          <div style={{ height: 3, background: C.line, borderRadius: 2 }}><div style={{ width: `${(r.out / maxV) * 100}%`, height: 3, background: C.neg, borderRadius: 2 }} /></div>
          <span className="k-num">−{arsK(r.out)}</span>
        </div>
      </div>)}
    </div>

    {top.length > 0 && <>
      <SectionTitle>En qué se va la plata</SectionTitle>
      <div style={{ ...card, padding: "2px 16px" }}>
        {top.map((t, i) => <div key={t.name} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 0", fontSize: 15, borderBottom: i < top.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
          <span className="k-num" style={{ whiteSpace: "nowrap" }}>{arsK(t.v)} <span style={{ color: C.sub }}>· {Math.round((t.v / (totOut || 1)) * 100)}%</span></span>
        </div>)}
      </div>
    </>}
  </>;
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
  const [remember, setRemember] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const save = async () => {
    setSaving(true);
    await dq("mp_expenses", { method: "PATCH", token, filters: `?id=eq.${exp.id}`, body: { category_id: cat, description: desc.trim() || null } });
    if (remember && exp.merchant && cat) {
      const key = merchantKey(exp.merchant);
      await dq("kairo_merchant_rules", { method: "POST", token, filters: "?on_conflict=user_id,merchant_key", body: { user_id: loadSession()?.user?.id, merchant_key: key, category_id: cat, updated_at: new Date().toISOString() }, headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
      // Los otros gastos del mismo comercio que siguen sin categoría también se ordenan.
      await dq("mp_expenses", { method: "PATCH", token, filters: `?merchant=eq.${encodeURIComponent(exp.merchant)}&category_id=is.null`, body: { category_id: cat } });
    }
    setSaving(false); pushToast("Guardado"); onSaved();
  };
  // Los de Mercado Pago no se borran: quedan marcados para que la sincronización no los vuelva a traer.
  const notExpense = async (always) => {
    setSaving(true);
    if (exp.mp_payment_id) {
      await dq("mp_expenses", { method: "PATCH", token, filters: `?id=eq.${exp.id}`, body: { source: "ignorado", category_id: null } });
      if (always && exp.merchant) {
        await dq("kairo_merchant_rules", { method: "POST", token, filters: "?on_conflict=user_id,merchant_key", body: { user_id: loadSession()?.user?.id, merchant_key: merchantKey(exp.merchant), category_id: null, updated_at: new Date().toISOString() }, headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
        await dq("mp_expenses", { method: "PATCH", token, filters: `?merchant=eq.${encodeURIComponent(exp.merchant)}&category_id=is.null&source=eq.mp`, body: { source: "ignorado" } });
      }
    } else {
      await dq("mp_expenses", { method: "DELETE", token, filters: `?id=eq.${exp.id}` });
    }
    setSaving(false); pushToast("Sacado del presupuesto"); onSaved();
  };

  return <Sheet title="Categorizar" onClose={onClose}>
    <div className="k-num" style={{ fontSize: 30, fontWeight: 500, color: C.neg }}>−{ars(exp.amount_ars)}</div>
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
      : <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        <button onClick={() => notExpense(false)} disabled={saving} className="k-press" style={{ ...btnGhost, color: C.danger }}>Sacar solo este</button>
        {exp.mp_payment_id && exp.merchant && <button onClick={() => notExpense(true)} disabled={saving} className="k-press" style={{ ...btnGhost, color: C.danger, fontSize: 14 }}>Sacar este y todos los de {exp.merchant}</button>}
        <button onClick={() => setConfirmDel(false)} style={{ ...linkBtn, color: C.sub, padding: 8 }}>Cancelar</button>
      </div>}
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
      <div className="k-num" style={{ fontSize: 30, fontWeight: 500, color: C.pos }}>+{ars(inc.amount_ars)}</div>
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

