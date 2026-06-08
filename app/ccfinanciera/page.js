"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { dq, loadSession, clearSession, ac, SB_URL, SB_KEY } from "../../lib/sb-client";
import { ToastStack, toast } from "../../lib/ui";

// ──────────────────────────────────────────────────────────────────────────────
// CC FINANCIERA SOLFIN — versión admin (auth requerido).
// Muestra saldos ARS/USD, listado de movimientos con saldo running, y permite
// agregar ingresos (con comisión opcional para ARS) y egresos.
// La versión read-only para SOLFIN vive en /ccfinanciera/share/[token].
// ──────────────────────────────────────────────────────────────────────────────

const T = {
  bg: "#0A1628",
  bgSurface: "#142038",
  bgSurfaceHi: "#1A2A48",
  border: "rgba(255,255,255,0.08)",
  borderHi: "rgba(255,255,255,0.15)",
  text: "#fff",
  textMuted: "rgba(255,255,255,0.55)",
  textDim: "rgba(255,255,255,0.4)",
  gold: "#E8D098",
  goldDeep: "#B8956A",
  goldGrad: "linear-gradient(135deg, #B8956A, #E8D098, #B8956A)",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
};

const fmtMoney = (n, currency = "ARS") => {
  const v = Number(n || 0);
  return `${currency} ${v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtDate = (d) => {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  return `${day}/${m}/${y.slice(2)}`;
};
const todayStr = () => new Date().toISOString().slice(0, 10);

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

function Dashboard({ token, onLogout }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCurrency, setFilterCurrency] = useState("all"); // all | ARS | USD
  const [showAdd, setShowAdd] = useState(null); // 'ingreso' | 'egreso' | null
  const [showShare, setShowShare] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await dq("cc_solfin_movements", { token, filters: "?select=*&order=date.desc,created_at.desc" });
    setMovements(Array.isArray(r) ? r : []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Saldo running por moneda (de más viejo a más nuevo, agregando net_amount con signo).
  const enriched = useMemo(() => {
    // Sort ascendente para acumular
    const asc = [...movements].sort((a, b) => (a.date.localeCompare(b.date)) || ((a.created_at || "").localeCompare(b.created_at || "")));
    let arsBal = 0, usdBal = 0;
    const withRunning = asc.map((m) => {
      const net = Number(m.net_amount || 0);
      const signed = m.type === "ingreso" ? net : -net;
      if (m.currency === "ARS") arsBal += signed; else usdBal += signed;
      return { ...m, _signed: signed, _arsBal: arsBal, _usdBal: usdBal };
    });
    // Devuelvo descendente para la UI
    return { withRunning: withRunning.reverse(), totals: { ars: arsBal, usd: usdBal } };
  }, [movements]);

  // Listado completo filtrado solo por moneda (acumulado, sin recorte por mes)
  const filtered = useMemo(() => filterCurrency === "all" ? enriched.withRunning : enriched.withRunning.filter((m) => m.currency === filterCurrency), [enriched, filterCurrency]);

  // Comisión SOLFIN acumulada (todos los ingresos ARS con comisión)
  const commissionTotal = useMemo(() => movements.filter((m) => m.type === "ingreso" && m.currency === "ARS").reduce((s, m) => s + Number(m.commission_amount || 0), 0), [movements]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <ToastStack />
      <Header onLogout={onLogout} onAdd={setShowAdd} onShare={() => setShowShare(true)} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 22px 40px" }}>
        {/* Saldos */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <BalanceCard label="Saldo ARS" currency="ARS" amount={enriched.totals.ars} />
          <BalanceCard label="Saldo USD" currency="USD" amount={enriched.totals.usd} />
        </section>
        {commissionTotal > 0 && (
          <div style={{ padding: "12px 16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, marginBottom: 16, fontSize: 13, color: T.amber, display: "flex", alignItems: "center", gap: 8 }}>
            <span>💸</span>
            <span>Comisión SOLFIN acumulada: <strong>{fmtMoney(commissionTotal, "ARS")}</strong></span>
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, padding: 3, background: T.bgSurface, borderRadius: 8, border: `1px solid ${T.border}` }}>
            {[{ k: "all", l: "Todo" }, { k: "ARS", l: "ARS" }, { k: "USD", l: "USD" }].map((o) => (
              <button key={o.k} onClick={() => setFilterCurrency(o.k)} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "none", background: filterCurrency === o.k ? T.goldGrad : "transparent", color: filterCurrency === o.k ? T.bg : T.textMuted, cursor: "pointer" }}>{o.l}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <p style={{ fontSize: 11, color: T.textDim, margin: 0 }}>{filtered.length} movimiento{filtered.length !== 1 ? "s" : ""} {filterCurrency !== "all" ? `(${filterCurrency})` : "totales"}</p>
        </div>

        {/* Listado */}
        {loading ? (
          <p style={{ textAlign: "center", padding: "3rem 0", color: T.textMuted, fontSize: 13 }}>Cargando…</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", background: T.bgSurface, border: `1px dashed ${T.border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>Sin movimientos en este período</p>
          </div>
        ) : (
          <MovementList rows={filtered} onEdit={setEditing} onReload={load} token={token} />
        )}
      </main>

      {showAdd && <MovementModal type={showAdd} token={token} editing={null} onClose={() => setShowAdd(null)} onSaved={() => { setShowAdd(null); load(); }} />}
      {editing && <MovementModal type={editing.type} token={token} editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {showShare && <ShareModal token={token} onClose={() => setShowShare(false)} />}
    </div>
  );
}

function Header({ onLogout, onAdd, onShare }) {
  return (
    <header style={{ background: T.bgSurface, borderBottom: `1px solid ${T.border}`, padding: "14px 22px", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: T.gold, letterSpacing: "-0.01em" }}>CC Financiera SOLFIN</h1>
          <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0" }}>Cuenta corriente con SOLFIN · ARS y USD</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onShare} style={btnGhost}>🔗 Compartir</button>
          <button onClick={() => onAdd("ingreso")} style={btnIngreso}>+ Ingreso</button>
          <button onClick={() => onAdd("egreso")} style={btnEgreso}>+ Egreso</button>
          <button onClick={onLogout} style={btnGhost}>Salir</button>
        </div>
      </div>
    </header>
  );
}

function BalanceCard({ label, currency, amount }) {
  const positive = amount >= 0;
  // Color por moneda: ARS dorado, USD verde
  const color = currency === "USD" ? T.green : T.gold;
  return (
    <div style={{ padding: "18px 20px", background: `linear-gradient(135deg, ${color}1A, ${color}06)`, border: `1px solid ${color}55`, borderRadius: 14, boxShadow: `0 0 30px ${color}10` }}>
      <p style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{positive ? "" : "− "}{fmtMoney(Math.abs(amount), currency)}</p>
      <p style={{ fontSize: 11, color: T.textMuted, margin: "4px 0 0" }}>{positive ? "a favor para Bautista" : "a favor para SOLFIN"}</p>
    </div>
  );
}

function MovementList({ rows, onEdit, onReload, token }) {
  return (
    <div style={{ background: T.bgSurface, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "90px 90px 60px 1fr 170px 110px 170px 70px", gap: 10, padding: "10px 14px", background: "rgba(0,0,0,0.2)", fontSize: 9.5, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${T.border}` }}>
        <div>Fecha</div><div>Tipo</div><div>Mon.</div><div>Descripción</div><div style={{ textAlign: "right" }}>Importe</div><div style={{ textAlign: "right" }}>Comisión</div><div style={{ textAlign: "right" }}>Saldo</div><div></div>
      </div>
      {rows.map((m) => <MovementRow key={m.id} m={m} onEdit={onEdit} onReload={onReload} token={token} />)}
    </div>
  );
}

function MovementRow({ m, onEdit, onReload, token }) {
  const isIn = m.type === "ingreso";
  const color = isIn ? T.green : T.red;
  const running = m.currency === "ARS" ? m._arsBal : m._usdBal;
  const handleDelete = async () => {
    if (!confirm(`¿Eliminar este ${m.type}?`)) return;
    await dq("cc_solfin_movements", { method: "DELETE", token, filters: `?id=eq.${m.id}` });
    toast.success("Eliminado");
    onReload();
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "90px 90px 60px 1fr 170px 110px 170px 70px", gap: 10, padding: "12px 14px", fontSize: 13, alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ fontFamily: "ui-monospace, monospace", color: T.text, fontWeight: 600 }}>{fmtDate(m.date)}</div>
      <div><span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: `${color}22`, color, letterSpacing: "0.05em", textTransform: "uppercase" }}>{isIn ? "▲ Ingreso" : "▼ Egreso"}</span></div>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted }}>{m.currency}</div>
      <div style={{ color: T.text, fontSize: 13, overflow: "hidden", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {m.image_url && (
          <a href={m.image_url} target="_blank" rel="noreferrer" title="Ver comprobante" style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 5, overflow: "hidden", border: `1px solid ${T.border}`, background: T.bgSurfaceHi, display: "inline-block" }}>
            <img src={m.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </a>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.description || <span style={{ color: T.textDim, fontStyle: "italic" }}>(sin descripción)</span>}</span>
      </div>
      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
        {isIn ? "+ " : "− "}{fmtMoney(m.amount, m.currency)}
      </div>
      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.textMuted, fontSize: 11.5 }}>
        {m.commission_pct ? <>{Number(m.commission_pct).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%<br /><span style={{ fontSize: 10, color: T.amber }}>−{fmtMoney(m.commission_amount, m.currency)}</span></> : <span style={{ color: T.textDim }}>—</span>}
      </div>
      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: running >= 0 ? T.green : T.red, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>{fmtMoney(running, m.currency)}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
        <button onClick={() => onEdit(m)} title="Editar" style={iconBtn}>✎</button>
        <button onClick={handleDelete} title="Eliminar" style={{ ...iconBtn, color: T.red }}>×</button>
      </div>
    </div>
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
  const amt = Number(String(amount).replace(",", ".")) || 0;
  const pct = showCommission ? (Number(String(commissionPct).replace(",", ".")) || 0) : 0;
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></Field>
        <Field label="Moneda">
          <div style={{ display: "flex", gap: 4, padding: 3, background: T.bgSurface, borderRadius: 8, border: `1px solid ${T.border}` }}>
            {["ARS", "USD"].map((c) => (
              <button key={c} onClick={() => setCurrency(c)} style={{ flex: 1, padding: "8px 12px", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "none", background: currency === c ? T.goldGrad : "transparent", color: currency === c ? T.bg : T.textMuted, cursor: "pointer" }}>{c}</button>
            ))}
          </div>
        </Field>
      </div>
      <Field label={`Importe (${currency})`}>
        <input type="text" inputMode="decimal" value={amount} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*[.,]?\d*$/.test(v)) setAmount(v); }} placeholder="0,00" style={{ ...inputStyle, fontSize: 18, fontWeight: 700 }} autoFocus />
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
const btnPrimary = { padding: "10px 18px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: `1px solid ${T.goldDeep}`, background: T.goldGrad, color: T.bg, cursor: "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap", fontFamily: "inherit" };
const btnGhost = { padding: "9px 14px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.text, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" };
const btnIngreso = { padding: "10px 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: `1px solid ${T.green}55`, background: "linear-gradient(135deg, rgba(34,197,94,0.16), rgba(22,163,74,0.10))", color: T.green, cursor: "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap", fontFamily: "inherit", boxShadow: "0 0 14px rgba(34,197,94,0.12)" };
const btnEgreso = { padding: "10px 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: `1px solid ${T.red}55`, background: "linear-gradient(135deg, rgba(239,68,68,0.16), rgba(220,38,38,0.10))", color: T.red, cursor: "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap", fontFamily: "inherit", boxShadow: "0 0 14px rgba(239,68,68,0.12)" };
const iconBtn = { padding: "4px 8px", fontSize: 13, borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 };
