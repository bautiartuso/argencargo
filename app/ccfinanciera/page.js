"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { dq, loadSession, clearSession, ac, SB_URL, SB_KEY } from "../../lib/sb-client";
import { ToastStack, toast } from "../../lib/ui";
import DatePicker from "../components/DatePicker";
import { comprimirImagen } from "../../lib/img";
import { hoyAR } from "../../lib/fecha-ar";
import {
  T, fmtMoney, fmtDate, useIsMobile, enrichMovements, aplicarFiltros, calcStats,
  BalanceCard, Filtros, MovimientosTabla, MovimientoTarjeta, Estadisticas, LogoCarrier, IconoDolarizar, LogoMyBox,
} from "../../lib/cc-ui";

// ──────────────────────────────────────────────────────────────────────────────
// CC FINANCIERA SOLFIN — versión admin (auth requerido).
// Muestra saldos ARS/USD, listado de movimientos con saldo running, y permite
// agregar ingresos (con comisión opcional para ARS) y egresos.
// La versión read-only para SOLFIN vive en /ccfinanciera/share/[token].

// Parsea importes tolerando el formato argentino, para poder pegar un monto tal cual sale del
// homebanking ("2.356.944,04") sin tener que limpiarlo a mano. Reglas:
//   · si hay "." y "," → los puntos son separadores de miles y la coma es el decimal
//   · si hay solo "," → la coma es el decimal
//   · si hay solo "." → varios puntos son miles; uno solo con 3 digitos detras tambien
//     (convencion ARS: "2.356" = 2356), y con 1, 2 o 4+ digitos es decimal ("2.5", "1450.50")
export function parseMontoAr(v) {
  const t = String(v ?? "").trim().replace(/\s/g, "");
  if (!t) return 0;
  const tieneComa = t.includes(",");
  const puntos = (t.match(/\./g) || []).length;
  let norm;
  if (tieneComa) {
    norm = t.replace(/\./g, "").replace(",", ".");
  } else if (puntos > 1) {
    norm = t.replace(/\./g, "");
  } else if (puntos === 1) {
    const dec = t.split(".")[1] || "";
    norm = dec.length === 3 ? t.replace(".", "") : t;
  } else {
    norm = t;
  }
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
}

// ──────────────────────────────────────────────────────────────────────────────


const todayStr = () => hoyAR(); // fecha de Argentina (a la noche UTC ya es mañana)


export default function CcFinancieraPage() {
  const [session, setSession] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [restoring, setRestoring] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const s = loadSession();
    if (!s?.token) { setRestoring(false); return; }
    // Validar rol = admin
    dq("profiles", { token: s.token, filters: `?id=eq.${s.user.id}&select=role` })
      .then((rows) => {
        const role = Array.isArray(rows) && rows[0]?.role;
        if (role === "admin") setSession(s);
        else setAuthError("Solo admin tiene acceso a CC Financiera SOLFIN.");
      })
      .catch(() => setAuthError("Error verificando sesión"))
      .finally(() => setRestoring(false));
  }, []);

  if (restoring) return <div style={{ minHeight: "100vh", background: T.bg, color: T.textMuted, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif", fontSize: 13 }}>Cargando…</div>;
  if (authError) return <NoAccess message={authError} />;
  if (!session) return <Login onLogin={setSession} />;

  return <Dashboard token={session.token} onLogout={() => { clearSession(); setSession(null); }} />;
}

function NoAccess({ message }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p style={{ fontSize: 14, color: T.red, fontWeight: 700, margin: "0 0 8px" }}>⛔ Sin acceso</p>
        <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>{message}</p>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e?.preventDefault();
    setErr(""); setLoading(true);
    try {
      const r = await ac("token?grant_type=password", { email, password });
      if (r.error || r.error_description || r.msg) { setErr("Email o contraseña incorrectos"); setLoading(false); return; }
      // Validar admin
      const profile = await dq("profiles", { token: r.access_token, filters: `?id=eq.${r.user.id}&select=role` });
      const role = Array.isArray(profile) && profile[0]?.role;
      if (role !== "admin") { setErr("Solo admin tiene acceso."); setLoading(false); return; }
      const ss = { token: r.access_token, refresh_token: r.refresh_token, user: r.user };
      const { saveSession } = await import("../../lib/sb-client");
      saveSession(ss);
      onLogin(ss);
    } catch (e) { setErr(e.message); setLoading(false); }
  };
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 380, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: T.gold, letterSpacing: "-0.01em" }}>CC Financiera SOLFIN</h1>
        <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 22px" }}>Ingresá con tu cuenta admin de Argencargo</p>
        <Inp label="Email" value={email} onChange={setEmail} type="email" autoFocus />
        <Inp label="Contraseña" value={password} onChange={setPassword} type="password" />
        {err && <p style={{ fontSize: 12, color: T.red, margin: "6px 0 0" }}>{err}</p>}
        <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 16, padding: "12px 14px", fontSize: 13, fontWeight: 700, borderRadius: 10, border: `1px solid ${T.goldDeep}`, background: T.goldGrad, color: T.bg, cursor: loading ? "wait" : "pointer", letterSpacing: "0.04em" }}>{loading ? "Ingresando…" : "Ingresar"}</button>
      </form>
    </div>
  );
}

// embebido (04/10/2026): se muestra como solapa dentro del admin, sin pantalla completa.
export function CcFinancieraPanel({ token }) { return <Dashboard token={token} embebido />; }

function Dashboard({ token, onLogout, embebido }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterClase, setFilterClase] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState("movs");
  const [showAdd, setShowAdd] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [showDollarize, setShowDollarize] = useState(false);
  const [showCable, setShowCable] = useState(false);
  const [showCourier, setShowCourier] = useState(false);
  const [showPuente, setShowPuente] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await dq("cc_solfin_movements", { token, filters: "?select=*&order=date.desc,created_at.desc" });
    setMovements(Array.isArray(r) ? r : []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const enriched = useMemo(() => enrichMovements(movements), [movements]);
  const filtered = useMemo(
    () => aplicarFiltros(enriched.withRunning, { currency: filterCurrency, type: filterType, from, to, clase: filterClase }),
    [enriched, filterCurrency, filterType, from, to, filterClase]
  );
  const stats = useMemo(() => calcStats(filtered), [filtered]);
  const isMobile = useIsMobile();

  // Botones de editar/borrar que la vista de lectura no tiene.
  const acciones = (m) => <AccionesFila m={m} onEdit={setEditing} onReload={load} token={token} />;

  return (
    <div style={embebido ? { color: T.text } : { height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg, color: T.text, fontFamily: "'Inter',system-ui,sans-serif" }}>
      {!embebido && <ToastStack />}
      <main style={embebido ? { width: "100%" } : { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", maxWidth: 1320, width: "100%", margin: "0 auto", padding: "20px 22px 0", boxSizing: "border-box" }}>
        <section style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 10 : 16, marginBottom: 16 }}>
          <BalanceCard label="Saldo en pesos (ARS)" currency="ARS" amount={enriched.totals.ars} />
          <BalanceCard label="Saldo en dólares (USD)" currency="USD" amount={enriched.totals.usd} />
        </section>

        {/* Una sola fila (01/10/2026): solapas a la izquierda y todas las acciones a la derecha.
            Sin barra de título arriba ni botón de salir. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 3, padding: 4, background: "rgba(0,0,0,0.22)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", width: isMobile ? "100%" : "fit-content", boxSizing: "border-box" }}>
            {[{ k: "movs", l: "Movimientos" }, { k: "stats", l: "Estadísticas" }].map((o) => (
              <button key={o.k} onClick={() => setTab(o.k)} style={{ flex: isMobile ? 1 : "none", height: 38, padding: "0 18px", fontSize: 13, fontWeight: 800, borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", background: tab === o.k ? T.goldGrad : "transparent", color: tab === o.k ? "#0A1628" : T.textMuted }}>{o.l}</button>
            ))}
          </div>
          <div style={{ display: isMobile ? "grid" : "flex", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, flexWrap: "wrap", alignItems: "center", width: isMobile ? "100%" : "auto" }}>
            <button onClick={() => setShowShare(true)} style={btnBar}>🔗 Compartir</button>
            <button onClick={() => setShowDollarize(true)} style={{ ...btnBar, ...btnDolarTone }}><IconoDolarizar size={18} />Dolarizar</button>
            <button onClick={() => setShowPuente(true)} style={{ ...btnBar, ...btnMyBoxTone }}><LogoMyBox size={18} />{isMobile ? "MyBox" : "Traer de MyBox"}</button>
            <button onClick={() => setShowCable(true)} style={{ ...btnBar, ...btnCableTone }}>🌏 Cable China</button>
            <button onClick={() => setShowCourier(true)} style={{ ...btnBar, ...btnCourierTone }}>
              <span style={{ display: "inline-flex", gap: 3 }}>{["dhl", "fedex", "ups"].map((k) => <LogoCarrier key={k} k={k} size={isMobile ? 20 : 18} />)}</span>{!isMobile && " Courier"}
            </button>
            <button onClick={() => setShowAdd("egreso")} style={{ ...btnBar, ...btnEgresoTone }}>− Egreso</button>
            <button onClick={() => setShowAdd("ingreso")} style={{ ...btnBar, ...btnIngresoTone }}>+ Ingreso</button>
          </div>
        </div>

        <div style={embebido ? { paddingBottom: 30 } : { flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 30, marginRight: -22, paddingRight: 22 }}>
          {loading ? (
            <p style={{ textAlign: "center", padding: "3rem 0", color: T.textMuted, fontSize: 13 }}>Cargando…</p>
          ) : tab === "stats" ? (
            <Estadisticas stats={stats} />
          ) : isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ marginBottom: 4 }}><Filtros
                currency={filterCurrency} setCurrency={setFilterCurrency}
                type={filterType} setType={setFilterType} clase={filterClase} setClase={setFilterClase}
                from={from} setFrom={setFrom} to={to} setTo={setTo}
              /></div>
              {filtered.length === 0 ? <p style={{ fontSize: 14, color: T.textMuted, textAlign: "center", padding: "40px 0" }}>Sin movimientos con estos filtros</p>
                : filtered.map((m) => <MovimientoTarjeta key={m.id} m={m} acciones={acciones} />)}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <MovimientosTabla rows={filtered} onEdit={setEditing} acciones={acciones} total={filtered.length}
                toolbar={<Filtros
                currency={filterCurrency} setCurrency={setFilterCurrency}
                type={filterType} setType={setFilterType} clase={filterClase} setClase={setFilterClase}
                from={from} setFrom={setFrom} to={to} setTo={setTo}
              />} />
              {filtered.length === 0 && <p style={{ fontSize: 14, color: T.textMuted, textAlign: "center", padding: "40px 0" }}>Sin movimientos con estos filtros</p>}
            </div>
          )}
        </div>
      </main>

      {showAdd && <MovementModal type={showAdd} token={token} editing={null} onClose={() => setShowAdd(null)} onSaved={() => { setShowAdd(null); load(); }} />}
      {editing && <MovementModal type={editing.type} token={token} editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {showShare && <ShareModal token={token} onClose={() => setShowShare(false)} />}
      {showCourier && <CourierModal token={token} onClose={() => setShowCourier(false)} onSaved={() => { setShowCourier(false); load(); }} />}
      {showCable && <CableChinaModal token={token} onClose={() => setShowCable(false)} onSaved={() => { setShowCable(false); load(); }} />}
      {showPuente && <TraerMyBoxModal token={token} onClose={() => setShowPuente(false)} onSaved={() => { setShowPuente(false); load(); }} />}
      {showDollarize && <DollarizeModal token={token} arsBalance={enriched.totals.ars} onClose={() => setShowDollarize(false)} onSaved={() => { setShowDollarize(false); load(); }} />}
    </div>
  );
}

// Editar / borrar un movimiento. Es lo unico que la vista de lectura no ofrece.
function AccionesFila({ m, onEdit, onReload, token }) {
  const [busy, setBusy] = useState(false);
  const iconBtn = { width: 24, height: 24, borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0 };
  const borrar = async () => {
    if (!confirm(`¿Eliminar este ${m.type}? No se puede deshacer.`)) return;
    setBusy(true);
    await dq("cc_solfin_movements", { method: "DELETE", token, filters: `?id=eq.${m.id}` });
    toast("Movimiento eliminado", "success");
    onReload();
  };
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button onClick={() => onEdit(m)} disabled={busy} title="Editar" style={iconBtn}>✎</button>
      <button onClick={borrar} disabled={busy} title="Eliminar" style={{ ...iconBtn, color: T.red }}>×</button>
    </div>
  );
}


const LOGO = `${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;

// Courier (01/10/2026): transferencia a DHL, FedEx o UPS. Es un egreso por el monto y nada más
// (sin comisión). Queda "Transferencia a FedEx" y en el libro sale con el logo de la empresa.
const COURIERS = [{ k: "dhl", l: "DHL" }, { k: "fedex", l: "FedEx" }, { k: "ups", l: "UPS" }];
function CourierModal({ token, onClose, onSaved }) {
  const [date, setDate] = useState(todayStr());
  const [carrier, setCarrier] = useState(null);
  const [currency, setCurrency] = useState("ARS");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const m = parseMontoAr(monto);
  const nombre = COURIERS.find((c) => c.k === carrier)?.l;
  const save = async () => {
    if (!carrier) { toast.error("Elegí a qué courier fue la transferencia"); return; }
    if (!(m > 0)) { toast.error("Cargá el monto"); return; }
    setSaving(true);
    try {
      await dq("cc_solfin_movements", { method: "POST", token, body: {
        date, type: "egreso", currency, amount: m, net_amount: m,
        description: `Transferencia a ${nombre}${nota.trim() ? ` · ${nota.trim()}` : ""}`,
      }});
      toast.success(`Transferencia a ${nombre}: ${fmtMoney(m, currency)}`);
      onSaved();
    } catch (e) { toast.error(e.message); setSaving(false); }
  };
  const seg = (on) => ({ flex: 1, height: 46, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, border: `1px solid ${on ? "rgba(232,208,152,0.6)" : "rgba(255,255,255,0.12)"}`, background: on ? "rgba(184,149,106,0.15)" : "rgba(255,255,255,0.03)", color: on ? T.gold : T.textMuted });
  return (
    <Modal title="Transferencia a courier" onClose={onClose}>
      <Field label="Courier">
        <div style={{ display: "flex", gap: 8 }}>
          {COURIERS.map((c) => <button key={c.k} type="button" onClick={() => setCarrier(c.k)} style={{ ...seg(carrier === c.k), display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}><LogoCarrier k={c.k} size={26} />{c.l}</button>)}
        </div>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Fecha"><DatePicker value={date} onChange={(v) => setDate(v || todayStr())} /></Field>
        <Field label="Moneda">
          <div style={{ display: "flex", gap: 6 }}>{["ARS", "USD"].map((c) => <button key={c} type="button" onClick={() => setCurrency(c)} style={seg(currency === c)}>{c}</button>)}</div>
        </Field>
      </div>
      <Field label={`Monto (${currency})`}>
        <input type="text" inputMode="decimal" value={monto} onChange={(e) => { const v = e.target.value; if (v === "" || /^[\d.,]*$/.test(v)) setMonto(v); }} placeholder="0,00" style={{ ...campoCable, fontWeight: 800 }} autoFocus />
      </Field>
      <Field label="Nota (opcional)">
        <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: vuelo AC-0227" style={campoCable} />
      </Field>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.25)", marginBottom: 6 }}>
        {carrier ? <LogoCarrier k={carrier} size={34} /> : <span style={{ width: 34, height: 34, borderRadius: 8, border: "1px dashed rgba(255,255,255,0.2)", flexShrink: 0 }} />}
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.text }}>{nombre ? `Transferencia a ${nombre}` : "Elegí el courier"}</span>
        <span style={{ fontSize: 15, fontWeight: 900, color: T.red, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>− {fmtMoney(m, currency)}</span>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Cancelar</button>
        <button onClick={save} disabled={saving} style={btnEgreso}>{saving ? "Guardando…" : "Registrar egreso"}</button>
      </div>
    </Modal>
  );
}

// Cable China (30/09/2026): transferencia en dólares a China. Se carga el monto a transferir, la
// comisión (% sobre la transferencia, 2,25 por defecto) y el gasto fijo (USD 40 por defecto),
// ambos editables. En la CC queda un solo egreso en USD por el total resultante.
function CableChinaModal({ token, onClose, onSaved }) {
  const [date, setDate] = useState(todayStr());
  const [monto, setMonto] = useState("");
  const [pct, setPct] = useState("2,25");
  const [fijo, setFijo] = useState("40");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const m = parseMontoAr(monto), p = parseMontoAr(pct), f = parseMontoAr(fijo);
  const comision = Math.round(m * (p / 100) * 100) / 100;
  const total = Math.round((m + comision + f) * 100) / 100;
  const soloNum = (set) => (e) => { const v = e.target.value; if (v === "" || /^[\d.,]*$/.test(v)) set(v); };
  const save = async () => {
    if (!(m > 0)) { toast.error("Cargá el monto a transferir"); return; }
    setSaving(true);
    try {
      await dq("cc_solfin_movements", { method: "POST", token, body: {
        date, type: "egreso", currency: "USD", amount: total, net_amount: total,
        description: `Cable China${nota.trim() ? ` · ${nota.trim()}` : ""}`,
      }});
      toast.success(`Cable China registrado: ${fmtMoney(total, "USD")}`);
      onSaved();
    } catch (e) { toast.error(e.message); setSaving(false); }
  };
  const linea = (l, v, c, fuerte) => <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: fuerte ? "10px 0 0" : "4px 0", marginTop: fuerte ? 6 : 0, borderTop: fuerte ? `1px solid ${T.border}` : "none", fontSize: fuerte ? 15 : 13 }}>
    <span style={{ color: fuerte ? T.text : T.textMuted, fontWeight: fuerte ? 800 : 500 }}>{l}</span>
    <span style={{ color: c || T.text, fontWeight: fuerte ? 900 : 700, fontVariantNumeric: "tabular-nums" }}>{v}</span>
  </div>;
  return (
    <Modal title="🌏 Cable China" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Fecha"><DatePicker value={date} onChange={(v) => setDate(v || todayStr())} /></Field>
        <Field label="Monto (USD)">
          <input type="text" inputMode="decimal" value={monto} onChange={soloNum(setMonto)} placeholder="0,00" style={{ ...campoCable, fontWeight: 800 }} autoFocus />
        </Field>
        <Field label="Comisión (%)">
          <input type="text" inputMode="decimal" value={pct} onChange={soloNum(setPct)} placeholder="2,25" style={campoCable} />
        </Field>
        <Field label="Gasto fijo (USD)">
          <input type="text" inputMode="decimal" value={fijo} onChange={soloNum(setFijo)} placeholder="40" style={campoCable} />
        </Field>
      </div>
      <Field label="Nota (opcional)">
        <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: proveedor de maquinaria" style={campoCable} />
      </Field>
      <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.25)", marginBottom: 6 }}>
        {linea("Transferencia", fmtMoney(m, "USD"))}
        {linea(`Comisión ${p.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`, `+ ${fmtMoney(comision, "USD")}`, T.amber)}
        {linea("Gasto fijo", `+ ${fmtMoney(f, "USD")}`, T.amber)}
        {linea("Total que sale de la cuenta", `− ${fmtMoney(total, "USD")}`, T.red, true)}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Cancelar</button>
        <button onClick={save} disabled={saving} style={btnCable}>{saving ? "Guardando…" : "🌏 Registrar cable"}</button>
      </div>
    </Modal>
  );
}

function MovementModal({ type, token, editing, onClose, onSaved }) {
  const isIngreso = type === "ingreso";
  const [date, setDate] = useState(editing?.date || todayStr());
  const [currency, setCurrency] = useState(editing?.currency || "ARS");
  const [amount, setAmount] = useState(editing?.amount ? String(editing.amount) : "");
  const [commissionPct, setCommissionPct] = useState(editing?.commission_pct != null ? String(editing.commission_pct) : "2.5");
  const [description, setDescription] = useState(editing?.description || "");
  const [imageUrl, setImageUrl] = useState(editing?.image_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Solo ingresos ARS tienen comisión
  const showCommission = isIngreso && currency === "ARS";
  // Comprobante: lo permitimos en todos los ingresos (no solo ARS), para flexibilidad
  const showComprobante = isIngreso;

  const uploadFile = useCallback(async (file) => {
    if (!file || !file.type?.startsWith("image/")) { toast.error("Solo imágenes"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Máx 8 MB"); return; }
    setUploading(true);
    try {
      const ext = (file.name?.split(".").pop() || file.type.split("/")[1] || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      file = await comprimirImagen(file, { maxLado: 2000 });
      const r = await fetch(`${SB_URL}/storage/v1/object/solfin-comprobantes/${filename}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, apikey: SB_KEY, "Content-Type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(t || "Error subiendo"); }
      const publicUrl = `${SB_URL}/storage/v1/object/public/solfin-comprobantes/${filename}`;
      setImageUrl(publicUrl);
      toast.success("Comprobante cargado");
    } catch (e) { toast.error(e.message); }
    setUploading(false);
  }, [token]);

  // Paste handler global mientras el modal está abierto
  useEffect(() => {
    if (!showComprobante) return;
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type?.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) { uploadFile(file); e.preventDefault(); break; }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [showComprobante, uploadFile]);
  const amt = parseMontoAr(amount);
  const pct = showCommission ? parseMontoAr(commissionPct) : 0;
  const commissionAmt = showCommission ? Math.round(amt * (pct / 100) * 100) / 100 : 0;
  const net = showCommission ? amt - commissionAmt : amt;

  const save = async () => {
    if (amt <= 0) { toast.error("Cargá un importe válido"); return; }
    setSaving(true);
    const body = {
      date,
      type,
      currency,
      amount: amt,
      commission_pct: showCommission ? pct : null,
      commission_amount: showCommission ? commissionAmt : null,
      net_amount: net,
      description: description.trim() || null,
      image_url: showComprobante ? (imageUrl || null) : null,
    };
    try {
      if (editing?.id) await dq("cc_solfin_movements", { method: "PATCH", token, filters: `?id=eq.${editing.id}`, body });
      else await dq("cc_solfin_movements", { method: "POST", token, body });
      toast.success(editing?.id ? "Movimiento actualizado" : `${isIngreso ? "Ingreso" : "Egreso"} registrado`);
      onSaved();
    } catch (e) { toast.error(e.message); setSaving(false); }
  };

  return (
    <Modal title={`${editing?.id ? "Editar" : "Nuevo"} ${isIngreso ? "ingreso" : "egreso"}`} onClose={onClose}>
      {isIngreso && !editing?.id && (
        <div style={{ padding: "10px 12px", marginBottom: 14, background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.22)", borderRadius: 9, fontSize: 11.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
          <strong style={{ color: "#60a5fa" }}>Ojo con duplicar:</strong> los cobros por transferencia en pesos que registrás en una operación (eligiendo destino <em>Financiera</em>) ya generan su movimiento acá solos, marcados como <strong>AUTO</strong>. Cargá a mano únicamente lo que no venga de un cobro de operación.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Fecha"><DatePicker value={date} onChange={(v) => setDate(v || new Date().toISOString().slice(0, 10))} /></Field>
        <Field label="Moneda">
          <div style={{ display: "flex", gap: 4, padding: 3, background: T.bgSurface, borderRadius: 8, border: `1px solid ${T.border}` }}>
            {["ARS", "USD"].map((c) => (
              <button key={c} onClick={() => setCurrency(c)} style={{ flex: 1, padding: "8px 12px", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "none", background: currency === c ? T.goldGrad : "transparent", color: currency === c ? T.bg : T.textMuted, cursor: "pointer" }}>{c}</button>
            ))}
          </div>
        </Field>
      </div>
      <Field label={`Importe (${currency})`}>
        <input type="text" inputMode="decimal" value={amount} onChange={(e) => { const v = e.target.value; if (v === "" || /^[\d.,]*$/.test(v)) setAmount(v); }} placeholder="0,00" style={{ ...inputStyle, fontSize: 18, fontWeight: 700 }} autoFocus />
      </Field>
      {showCommission && (
        <Field label="Comisión SOLFIN (%)">
          <input type="text" inputMode="decimal" value={commissionPct} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*[.,]?\d*$/.test(v)) setCommissionPct(v); }} placeholder="2,5" style={inputStyle} />
          <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, fontSize: 11.5, color: T.amber, display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span>Comisión: <strong>{fmtMoney(commissionAmt, "ARS")}</strong></span>
            <span style={{ color: T.green, fontWeight: 700 }}>Neto a SOLFIN: <strong>{fmtMoney(net, "ARS")}</strong></span>
          </div>
        </Field>
      )}
      <Field label="Descripción (opcional)">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isIngreso ? "Ej: Transferencia cliente AC-0162" : "Ej: Retiro para pagar proveedor"} style={inputStyle} />
      </Field>
      {showComprobante && (
        <Field label="Comprobante (opcional) — pegá con ⌘V / Ctrl+V o subí un archivo">
          {imageUrl ? (
            <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}`, background: T.bgSurfaceHi }}>
              <a href={imageUrl} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                <img src={imageUrl} alt="Comprobante" style={{ display: "block", maxWidth: "100%", maxHeight: 280, margin: "0 auto" }} />
              </a>
              <button onClick={() => setImageUrl("")} type="button" style={{ position: "absolute", top: 6, right: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: `1px solid ${T.red}55`, background: "rgba(0,0,0,0.55)", color: T.red, cursor: "pointer" }}>× Quitar</button>
            </div>
          ) : (
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "22px 14px", border: `1px dashed ${T.border}`, borderRadius: 10, background: T.bgSurfaceHi, cursor: uploading ? "wait" : "pointer", textAlign: "center" }}>
              <span style={{ fontSize: 22 }}>{uploading ? "⏳" : "📎"}</span>
              <span style={{ fontSize: 12, color: T.textMuted }}>
                {uploading ? "Subiendo…" : <>Clic para elegir archivo · o pegá una imagen del portapapeles</>}
              </span>
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} disabled={uploading} style={{ display: "none" }} />
            </label>
          )}
        </Field>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={btnGhost}>Cancelar</button>
        <button onClick={save} disabled={saving || amt <= 0} style={isIngreso ? btnIngreso : btnEgreso}>{saving ? "Guardando…" : (editing?.id ? "Guardar" : (isIngreso ? "+ Registrar ingreso" : "+ Registrar egreso"))}</button>
      </div>
    </Modal>
  );
}

function ShareModal({ token, onClose }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await dq("cc_solfin_share_tokens", { token, filters: "?select=*&order=created_at.desc" });
    setTokens(Array.isArray(r) ? r : []);
    setLoading(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const createToken = async () => {
    setCreating(true);
    const newToken = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 32);
    try {
      await dq("cc_solfin_share_tokens", { method: "POST", token, body: { token: newToken, label: label.trim() || null } });
      toast.success("Link generado");
      setLabel("");
      load();
    } catch (e) { toast.error(e.message); }
    setCreating(false);
  };

  const toggleActive = async (t) => {
    await dq("cc_solfin_share_tokens", { method: "PATCH", token, filters: `?id=eq.${t.id}`, body: { active: !t.active } });
    load();
  };
  const deleteTok = async (t) => {
    if (!confirm("¿Eliminar este link permanentemente?")) return;
    await dq("cc_solfin_share_tokens", { method: "DELETE", token, filters: `?id=eq.${t.id}` });
    load();
  };
  const copy = (tok) => {
    const url = `${window.location.origin}/ccfinanciera/share/${tok}`;
    navigator.clipboard?.writeText(url).then(() => toast.success("Link copiado"));
  };

  return (
    <Modal title="🔗 Compartir con SOLFIN" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: T.textMuted, margin: "0 0 16px", lineHeight: 1.5 }}>Generá un link público de solo lectura para el muchacho de SOLFIN. Lo puede bookmarkar y entra sin login. Podés revocarlo cuando quieras.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Etiqueta (opcional, ej: Juan SOLFIN)" style={{ ...inputStyle, flex: 1 }} />
        <button onClick={createToken} disabled={creating} style={btnPrimary}>{creating ? "Generando…" : "+ Generar link"}</button>
      </div>
      {loading ? (
        <p style={{ textAlign: "center", color: T.textMuted, fontSize: 12 }}>Cargando…</p>
      ) : tokens.length === 0 ? (
        <p style={{ textAlign: "center", color: T.textDim, fontSize: 12, padding: "20px 0", fontStyle: "italic" }}>Sin links generados todavía</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tokens.map((t) => (
            <div key={t.id} style={{ padding: "10px 12px", background: T.bgSurface, border: `1px solid ${t.active ? T.border : "rgba(239,68,68,0.3)"}`, borderRadius: 8, opacity: t.active ? 1 : 0.55 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: T.text }}>{t.label || "(sin etiqueta)"}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: T.textDim }}>Creado {fmtDate(t.created_at)} · {t.active ? <span style={{ color: T.green }}>● Activo</span> : <span style={{ color: T.red }}>● Revocado</span>}</p>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => copy(t.token)} title="Copiar link" style={iconBtn}>📋</button>
                  <button onClick={() => toggleActive(t)} title={t.active ? "Revocar" : "Reactivar"} style={iconBtn}>{t.active ? "🚫" : "✓"}</button>
                  <button onClick={() => deleteTok(t)} title="Eliminar" style={{ ...iconBtn, color: T.red }}>×</button>
                </div>
              </div>
              <code style={{ display: "block", padding: "6px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 4, fontSize: 10.5, color: T.gold, fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>{`${typeof window !== "undefined" ? window.location.origin : ""}/ccfinanciera/share/${t.token}`}</code>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// Puente con MyBox (09/10/2026): trae a esta CC una parte del saldo de la CC financiera de
// MyBox. Queda un egreso en MyBox y un ingreso acá (lo hace /api/ccfinanciera/puente).
function TraerMyBoxModal({ token, onClose, onSaved }) {
  const [date, setDate] = useState(todayStr());
  const [currency, setCurrency] = useState("ARS");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [saldos, setSaldos] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch("/api/ccfinanciera/puente", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { if (d?.ok) setSaldos(d); else setError(d?.error === "falta_config" ? "Falta conectar MyBox: cargá MYBOX_SUPABASE_SERVICE_ROLE en Vercel." : d?.error || "No se pudo leer MyBox"); })
      .catch(() => setError("No se pudo leer MyBox"));
  }, [token]);
  const m = parseMontoAr(monto);
  const disp = saldos ? (currency === "USD" ? saldos.usd : saldos.ars) : null;
  const save = async () => {
    if (!(m > 0)) { toast.error("Cargá el monto"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/ccfinanciera/puente", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ currency, amount: m, date, note: nota }) });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) { toast.error(d?.error === "falta_config" ? "Falta conectar MyBox" : d?.error || "No se pudo traer"); setSaving(false); return; }
      toast.success(`Traído de MyBox: ${fmtMoney(m, currency)}`);
      onSaved();
    } catch (e) { toast.error(e.message); setSaving(false); }
  };
  const seg = (on) => ({ flex: 1, height: 46, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, border: `1px solid ${on ? "rgba(211,244,98,0.6)" : "rgba(255,255,255,0.12)"}`, background: on ? "rgba(211,244,98,0.12)" : "rgba(255,255,255,0.03)", color: on ? "#D3F462" : T.textMuted });
  return (
    <Modal title={<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><LogoMyBox size={22} />Traer saldo de MyBox</span>} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[["ARS", saldos?.ars], ["USD", saldos?.usd]].map(([c, v]) => (
          <button key={c} type="button" onClick={() => setCurrency(c)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${currency === c ? "rgba(211,244,98,0.55)" : T.border}`, background: currency === c ? "rgba(211,244,98,0.08)" : "rgba(255,255,255,0.03)" }}>
            <span style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: currency === c ? "#D3F462" : T.textMuted }}>MyBox · {c}</span>
            <span style={{ display: "block", marginTop: 4, fontSize: 16, fontWeight: 900, color: v != null && v < 0 ? T.red : T.text, fontVariantNumeric: "tabular-nums" }}>{v == null ? (error ? "—" : "…") : fmtMoney(v, c)}</span>
          </button>
        ))}
      </div>
      {error && <p style={{ margin: "-6px 0 14px", fontSize: 12.5, color: T.amber }}>{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Fecha"><DatePicker value={date} onChange={(v) => setDate(v || todayStr())} /></Field>
        <Field label="Moneda">
          <div style={{ display: "flex", gap: 6 }}>{["ARS", "USD"].map((c) => <button key={c} type="button" onClick={() => setCurrency(c)} style={seg(currency === c)}>{c}</button>)}</div>
        </Field>
      </div>
      <Field label={`Monto a traer (${currency})`}>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" inputMode="decimal" value={monto} onChange={(e) => { const v = e.target.value; if (v === "" || /^[\d.,]*$/.test(v)) setMonto(v); }} placeholder="0,00" style={{ ...campoCable, fontWeight: 800, flex: 1 }} autoFocus />
          {disp > 0 && <button type="button" onClick={() => setMonto(String(disp).replace(".", ","))} style={{ ...btnGhost, height: 46 }}>Todo</button>}
        </div>
      </Field>
      <Field label="Nota (opcional)">
        <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: para el cable de la semana" style={campoCable} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`, marginBottom: 6 }}>
        <div><span style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Sale de MyBox</span><span style={{ fontSize: 15, fontWeight: 900, color: T.red, fontVariantNumeric: "tabular-nums" }}>− {fmtMoney(m, currency)}</span></div>
        <span style={{ fontSize: 18, color: T.textMuted }}>→</span>
        <div style={{ textAlign: "right" }}><span style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Entra a Argencargo</span><span style={{ fontSize: 15, fontWeight: 900, color: T.green, fontVariantNumeric: "tabular-nums" }}>+ {fmtMoney(m, currency)}</span></div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Cancelar</button>
        <button onClick={save} disabled={saving || !!error || !(m > 0)} style={{ ...btnMyBox, opacity: saving || error || !(m > 0) ? 0.5 : 1 }}>{saving ? "Trayendo…" : "Traer de MyBox"}</button>
      </div>
    </Modal>
  );
}

// Dolarizar saldo: convierte ARS → USD al TC ingresado. Genera DOS movimientos
// visibles en el libro (egreso ARS + ingreso USD) — también en la vista de SOLFIN.
// Rediseño 09/10/2026: pesos que salen → dólares que entran, con "Todo el saldo".
function DollarizeModal({ token, arsBalance, onClose, onSaved }) {
  const [date, setDate] = useState(todayStr());
  const [amountArs, setAmountArs] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  const ars = parseMontoAr(amountArs);
  const tc = parseMontoAr(rate);
  const usd = tc > 0 ? Math.round((ars / tc) * 100) / 100 : 0;
  const exceeds = ars > arsBalance + 0.01;
  const listo = ars > 0 && tc > 0 && !exceeds;

  const save = async () => {
    if (ars <= 0) { toast.error("Cargá el importe ARS a dolarizar"); return; }
    if (tc <= 0) { toast.error("Cargá el tipo de cambio ARS/USD"); return; }
    if (exceeds) { toast.error(`Supera el saldo ARS disponible (${fmtMoney(arsBalance, "ARS")})`); return; }
    setSaving(true);
    const tcTxt = tc.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    try {
      // Egreso ARS (sale del saldo en pesos)
      await dq("cc_solfin_movements", { method: "POST", token, body: {
        date, type: "egreso", currency: "ARS", amount: ars, net_amount: ars,
        description: `💱 Dolarización → ${fmtMoney(usd, "USD")} @ TC ${tcTxt}`,
      }});
      // Ingreso USD (entra al saldo en dólares). Sin comisión — es conversión, no transferencia.
      await dq("cc_solfin_movements", { method: "POST", token, body: {
        date, type: "ingreso", currency: "USD", amount: usd, net_amount: usd,
        description: `💱 Dolarización de ${fmtMoney(ars, "ARS")} @ TC ${tcTxt}`,
      }});
      toast.success(`Dolarizado: ${fmtMoney(ars, "ARS")} → ${fmtMoney(usd, "USD")}`);
      onSaved();
    } catch (e) { toast.error(e.message); setSaving(false); }
  };
  const lblCaja = { display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" };

  return (
    <Modal title={<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><IconoDolarizar size={24} />Dolarizar saldo</span>} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Fecha"><DatePicker value={date} onChange={(v) => setDate(v || todayStr())} /></Field>
        <Field label="Tipo de cambio">
          <input type="text" inputMode="decimal" value={rate} onChange={(e) => { const v = e.target.value; if (v === "" || /^[\d.,]*$/.test(v)) setRate(v); }} placeholder="Ej: 1.190" style={{ ...campoCable, fontWeight: 800 }} autoFocus />
        </Field>
      </div>
      <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(248,113,113,0.05)", border: `1px solid ${exceeds ? T.red + "88" : "rgba(248,113,113,0.22)"}`, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
          <span style={{ ...lblCaja, color: "#f87171" }}>Pesos que salen</span>
          <button type="button" onClick={() => setAmountArs(String(Math.round(arsBalance * 100) / 100).replace(".", ","))} disabled={!(arsBalance > 0)} style={{ background: "transparent", border: "none", color: T.textMuted, fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Disponible <b style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(arsBalance, "ARS")}</b> · <span style={{ color: T.gold, fontWeight: 800 }}>Todo</span></button>
        </div>
        <input type="text" inputMode="decimal" value={amountArs} onChange={(e) => { const v = e.target.value; if (v === "" || /^[\d.,]*$/.test(v)) setAmountArs(v); }} placeholder="0,00" style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 26, fontWeight: 900, fontFamily: "inherit", fontVariantNumeric: "tabular-nums", padding: 0 }} />
        {exceeds && <p style={{ fontSize: 11.5, color: T.red, margin: "6px 0 0" }}>Supera el saldo en pesos disponible</p>}
      </div>
      <div style={{ display: "flex", justifyContent: "center", margin: "-4px 0 6px" }}>
        <span style={{ width: 32, height: 32, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.45)", color: "#4ade80", fontSize: 16, fontWeight: 900 }}>↓</span>
      </div>
      <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.35)", boxShadow: listo ? "0 0 22px rgba(34,197,94,0.12)" : "none", marginBottom: 6 }}>
        <span style={{ ...lblCaja, color: "#4ade80", marginBottom: 6 }}>Dólares que entran</span>
        <span style={{ display: "block", fontSize: 26, fontWeight: 900, color: listo ? "#4ade80" : T.textMuted, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(usd, "USD")}</span>
        {ars > 0 && tc > 0 && <span style={{ display: "block", marginTop: 4, fontSize: 12, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(ars, "ARS")} ÷ {tc.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onClose} style={btnGhost}>Cancelar</button>
        <button onClick={save} disabled={saving || !listo} style={{ ...btnDolar, opacity: saving || !listo ? 0.5 : 1 }}><IconoDolarizar size={18} />{saving ? "Dolarizando…" : "Dolarizar"}</button>
      </div>
    </Modal>
  );
}

// ─── UI primitivos ─────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: "100%", maxHeight: "90vh", overflow: "auto", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: T.text }}>{title}</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.textDim, fontSize: 18, cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      {children}
    </div>
  );
}

function Inp({ label, value, onChange, type = "text", autoFocus }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: T.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} style={inputStyle} />
    </div>
  );
}

const inputStyle = { width: "100%", padding: "10px 14px", fontSize: 13.5, fontWeight: 500, border: `1px solid ${T.border}`, borderRadius: 8, background: T.bgSurfaceHi, color: T.text, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
// Botones de la fila de acciones: misma altura y forma, cada uno con su tono.
const btnBar = { height: 40, minWidth: 0, overflow: "hidden", padding: "0 12px", fontSize: 13, fontWeight: 800, borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: T.text, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, boxSizing: "border-box" };
const btnCableTone = { border: "1px solid rgba(96,165,250,0.45)", background: "rgba(96,165,250,0.1)", color: "#93c5fd" };
const btnCourierTone = { border: "1px solid rgba(232,208,152,0.35)", background: "rgba(184,149,106,0.08)", color: "#E8D098" };
const btnDolarTone = { border: "1px solid rgba(34,197,94,0.5)", background: "rgba(34,197,94,0.1)", color: "#4ade80" };
const btnMyBoxTone = { border: "1px solid rgba(211,244,98,0.45)", background: "rgba(211,244,98,0.08)", color: "#D3F462" };
const btnDolar = { padding: "11px 18px", fontSize: 13.5, fontWeight: 800, borderRadius: 11, border: "1px solid rgba(34,197,94,0.6)", background: "linear-gradient(135deg, rgba(34,197,94,0.22), rgba(22,163,74,0.12))", color: "#4ade80", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 0 18px rgba(34,197,94,0.18)" };
const btnMyBox = { padding: "11px 18px", fontSize: 13.5, fontWeight: 900, borderRadius: 11, border: "none", background: "#D3F462", color: "#0A1628", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" };
const btnEgresoTone = { border: "1px solid rgba(248,113,113,0.4)", background: "rgba(239,68,68,0.1)", color: "#f87171" };
const btnIngresoTone = { border: "none", background: T.goldGrad, color: "#0A1628" };
const btnPrimary = { padding: "10px 18px", fontSize: 13, fontWeight: 900, borderRadius: 11, border: "none", background: T.goldGrad, color: "#0A1628", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", boxShadow: "0 6px 18px rgba(184,149,106,0.3)" };
const btnGhost = { padding: "10px 15px", fontSize: 13, fontWeight: 700, borderRadius: 11, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", color: T.text, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" };
// Mismo alto que el selector de fecha, para que la grilla del cable quede pareja.
const campoCable = { ...inputStyle, height: 46, fontSize: 15 };
const btnCable = { padding: "10px 16px", fontSize: 13, fontWeight: 800, borderRadius: 11, border: "1px solid rgba(96,165,250,0.5)", background: "rgba(96,165,250,0.12)", color: "#93c5fd", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" };
const btnIngreso = { padding: "10px 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: `1px solid ${T.green}55`, background: "linear-gradient(135deg, rgba(34,197,94,0.16), rgba(22,163,74,0.10))", color: T.green, cursor: "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap", fontFamily: "inherit", boxShadow: "0 0 14px rgba(34,197,94,0.12)" };
const btnEgreso = { padding: "10px 16px", fontSize: 13, fontWeight: 800, borderRadius: 11, border: `1px solid ${T.red}55`, background: "linear-gradient(135deg, rgba(239,68,68,0.16), rgba(220,38,38,0.10))", color: T.red, cursor: "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap", fontFamily: "inherit", boxShadow: "0 0 14px rgba(239,68,68,0.12)" };
const iconBtn = { padding: "4px 8px", fontSize: 13, borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 };

