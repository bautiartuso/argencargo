"use client";
// Tarifas del agente (03/10/2026, rediseño). El agente carga, para cada servicio, los rangos de kg
// que quiera con su USD/kg; abajo los adicionales fijos. Tres columnas: DHL · FedEx (÷ 5.000 y
// ÷ 6.000) · UPS (÷ 5.000 y ÷ 6.000). Argencargo las ve en Depósito → Agentes. Se guardan por
// /api/agente/tarifas. Usa las variables de color del panel del agente con valores por defecto
// oscuros, así también se ve bien dentro del admin.
import { useEffect, useState } from "react";
import CarrierLogo, { SERVICIOS_AGENTE } from "./CarrierLogo";

const INK = (a) => `rgba(var(--ink, 255,255,255),${a})`;
const TX = "var(--tx, #fff)";
const GOLD = "var(--gold, #E8D098)";

const TXT = {
  es: {
    kgDesde: "Desde kg", kgHasta: "Hasta kg", usdKg: "USD / kg", oMas: "o más", agregar: "+ Agregar rango",
    rangos: "Rangos", volum: "volumétrico", sinTarifa: "Sin tarifa cargada",
    extras: "Adicionales",
    bateria: "Mercadería con baterías", marca: "Mercadería con marca", sobrepeso: "Sobrepeso",
    remota: "Zona remota", remotaMin: "Zona remota · mínimo",
    porEnvio: "por envío", porKg: "por kg", porBulto: "por bulto", minimo: "mínimo",
    guardar: "Guardar tarifas", guardando: "Guardando…", guardado: "Tarifas guardadas", error: "No se pudieron guardar",
    cargando: "Cargando…", actualizado: "Actualizado",
  },
  zh: {
    kgDesde: "起始 kg", kgHasta: "截止 kg", usdKg: "USD / kg", oMas: "以上", agregar: "+ 添加区间",
    rangos: "区间", volum: "体积重", sinTarifa: "未设置运价",
    extras: "附加费",
    bateria: "带电池货物", marca: "品牌货物", sobrepeso: "超重",
    remota: "偏远地区", remotaMin: "偏远地区 · 最低",
    porEnvio: "每票", porKg: "每 kg", porBulto: "每件", minimo: "最低",
    guardar: "保存运价", guardando: "保存中…", guardado: "运价已保存", error: "保存失败",
    cargando: "加载中…", actualizado: "更新于",
  },
};

// Columnas: un logo por columna y, debajo, una tarjeta por divisor.
const COLUMNAS = [
  { logo: "dhl", servicios: ["DHL"] },
  { logo: "fedex", servicios: ["FEDEX_5000", "FEDEX_6000"] },
  { logo: "ups", servicios: ["UPS_5000", "UPS_6000"] },
];
const SERV = Object.fromEntries(SERVICIOS_AGENTE.map((s) => [s.k, s]));
const EXTRAS = [
  ["bateria_usd_total", "bateria", "porEnvio"],
  ["marca_usd_kg", "marca", "porKg"],
  ["sobrepeso_usd_pieza", "sobrepeso", "porBulto"],
  ["remota_usd_kg", "remota", "porKg"],
  ["remota_min_usd", "remotaMin", "minimo"],
];

const n2 = (v) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nk = (v) => Number(v || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const caja = { background: INK(0.035), border: `1px solid ${INK(0.09)}`, borderRadius: 16, padding: "16px", minWidth: 0 };
const inp = { width: "100%", height: 40, padding: "0 10px", fontSize: 15, fontWeight: 700, boxSizing: "border-box", border: `1px solid ${INK(0.14)}`, borderRadius: 9, background: INK(0.05), color: TX, outline: "none", fontFamily: "inherit", textAlign: "right", fontVariantNumeric: "tabular-nums" };
const lbl = { fontSize: 10.5, fontWeight: 800, color: INK(0.45), textTransform: "uppercase", letterSpacing: "0.07em" };
const CSS = `.ta-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}.ta-col{display:flex;flex-direction:column;gap:12px;min-width:0}@media(max-width:900px){.ta-cols{grid-template-columns:1fr}}`;

// Divisor del volumétrico bien visible: "÷ 5.000" en una pastilla dorada.
function Divisor({ div, t }) {
  if (!div) return <span style={{ ...lbl, fontSize: 12 }}>{t.rangos}</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 36, padding: "0 16px", borderRadius: 999, background: "rgba(184,149,106,0.16)", border: "1px solid rgba(232,208,152,0.45)" }}>
        <span style={{ fontSize: 22, fontWeight: 400, color: GOLD, lineHeight: 1 }}>÷</span>
        <span style={{ fontSize: 19, fontWeight: 800, color: TX, letterSpacing: "0.03em", fontVariantNumeric: "tabular-nums" }}>{div.toLocaleString("es-AR")}</span>
      </span>
      <span style={{ ...lbl, fontSize: 10 }}>{t.volum}</span>
    </span>
  );
}

const vacioServ = () => [{ min: "", max: "", usd: "" }];
const aEdicion = (data) => {
  const servicios = {};
  SERVICIOS_AGENTE.forEach((s) => {
    const filas = data?.servicios?.[s.k];
    servicios[s.k] = Array.isArray(filas) && filas.length ? filas.map((f) => ({ min: f.min ?? "", max: f.max ?? "", usd: f.usd ?? "" })) : vacioServ();
  });
  const e = data?.extras || {};
  const extras = {};
  EXTRAS.forEach(([k]) => { extras[k] = e[k] ?? ""; });
  return { servicios, extras };
};

// Editor del agente (y del admin mirando a un agente: agentUserId).
export function TarifasAgenteEditor({ token, lang = "es", onSaved, agentUserId = null }) {
  const t = TXT[lang] || TXT.es;
  const [d, setD] = useState(null);
  const [actualizado, setActualizado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    fetch("/api/agente/tarifas", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => {
        const tar = agentUserId ? (j?.agentes || []).find((a) => a.auth_user_id === agentUserId)?.tarifas : j?.tarifas;
        setD(aEdicion(tar)); setActualizado(tar?.actualizado || null);
      })
      .catch(() => setD(aEdicion(null)));
  }, [token, agentUserId]);
  if (!d) return <p style={{ color: INK(0.5), textAlign: "center", padding: "2rem 0" }}>{t.cargando}</p>;
  const soloNum = (v) => v === "" || /^[\d.,]*$/.test(v);
  const setFila = (sk, i, campo, v) => { if (!soloNum(v)) return; setD((p) => ({ ...p, servicios: { ...p.servicios, [sk]: p.servicios[sk].map((f, j) => (j === i ? { ...f, [campo]: v } : f)) } })); };
  const agregar = (sk) => setD((p) => { const l = p.servicios[sk]; const ult = l[l.length - 1]; return { ...p, servicios: { ...p.servicios, [sk]: [...l, { min: ult?.max || "", max: "", usd: "" }] } }; });
  const quitar = (sk, i) => setD((p) => { const l = p.servicios[sk].filter((_, j) => j !== i); return { ...p, servicios: { ...p.servicios, [sk]: l.length ? l : vacioServ() } }; });
  const setExtra = (k, v) => { if (!soloNum(v)) return; setD((p) => ({ ...p, extras: { ...p.extras, [k]: v } })); };
  const guardar = async () => {
    setGuardando(true); setMsg(null);
    try {
      const r = await fetch("/api/agente/tarifas", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(agentUserId ? { ...d, agent_user_id: agentUserId } : d) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "error");
      setD(aEdicion(j.tarifas)); setActualizado(j.tarifas?.actualizado || null);
      setMsg({ ok: true, t: t.guardado }); onSaved?.(j.tarifas);
    } catch (e) { setMsg({ ok: false, t: t.error }); }
    setGuardando(false);
  };
  const tarjeta = (sk) => {
    const s = SERV[sk];
    return (
      <div key={sk} style={caja}>
        <div style={{ marginBottom: 14 }}><Divisor div={s.div} t={t} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.15fr 30px", gap: 6, marginBottom: 6 }}>
          {[t.kgDesde, t.kgHasta, t.usdKg, ""].map((h, i) => <span key={i} style={{ ...lbl, textAlign: "right" }}>{h}</span>)}
        </div>
        {d.servicios[sk].map((f, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.15fr 30px", gap: 6, marginBottom: 6, alignItems: "center" }}>
            <input inputMode="decimal" value={f.min} onChange={(e) => setFila(sk, i, "min", e.target.value)} placeholder="0" style={inp} />
            <input inputMode="decimal" value={f.max} onChange={(e) => setFila(sk, i, "max", e.target.value)} placeholder={t.oMas} style={inp} />
            <input inputMode="decimal" value={f.usd} onChange={(e) => setFila(sk, i, "usd", e.target.value)} placeholder="0,00" style={{ ...inp, color: GOLD }} />
            <button type="button" onClick={() => quitar(sk, i)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${INK(0.12)}`, background: "transparent", color: INK(0.45), cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => agregar(sk)} style={{ marginTop: 4, height: 34, padding: "0 12px", borderRadius: 9, border: "1px dashed rgba(232,208,152,0.45)", background: "transparent", color: GOLD, fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{t.agregar}</button>
      </div>
    );
  };
  return (
    <div>
      <style>{CSS}</style>
      <div className="ta-cols" style={{ marginBottom: 18 }}>
        {COLUMNAS.map((c) => (
          <div key={c.logo} className="ta-col">
            <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 2px" }}><CarrierLogo k={c.logo} alto={50} /></div>
            {c.servicios.map(tarjeta)}
          </div>
        ))}
      </div>
      <div style={{ ...caja, padding: "20px 22px", marginBottom: 18 }}>
        <p style={{ fontSize: 17, fontWeight: 800, color: TX, margin: "0 0 16px", textAlign: "center" }}>{t.extras}</p>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {EXTRAS.map(([k, lk, uk]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 140px 84px", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: TX }}>{t[lk]}</span>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 800, color: INK(0.4), pointerEvents: "none" }}>USD</span>
                <input inputMode="decimal" value={d.extras[k]} onChange={(e) => setExtra(k, e.target.value)} placeholder="0" style={{ ...inp, paddingLeft: 44, color: GOLD }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: INK(0.55) }}>{t[uk]}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button type="button" onClick={guardar} disabled={guardando} style={{ height: 48, padding: "0 34px", borderRadius: 12, border: "1px solid #B8956A", background: "linear-gradient(135deg,#B8956A 0%,#E8D098 50%,#B8956A 100%)", color: "#0A1628", fontWeight: 900, fontSize: 15, cursor: guardando ? "wait" : "pointer", fontFamily: "inherit" }}>{guardando ? t.guardando : t.guardar}</button>
        {msg && <span style={{ fontSize: 13, fontWeight: 700, color: msg.ok ? "var(--green, #22c55e)" : "var(--red, #ff6b6b)" }}>{msg.ok ? "✓ " : "⚠ "}{msg.t}</span>}
        {actualizado && <span style={{ fontSize: 12, color: INK(0.45) }}>{t.actualizado} {new Date(actualizado).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
    </div>
  );
}

// Resumen de solo lectura (admin → Depósito → Agentes), con la misma forma que el editor.
export function TarifasAgenteResumen({ tarifas }) {
  const t = TXT.es;
  if (!tarifas) return <p style={{ fontSize: 13.5, color: INK(0.45), margin: 0 }}>Todavía no cargó sus tarifas.</p>;
  const e = tarifas.extras || {};
  const extras = EXTRAS.filter(([k]) => e[k] != null);
  return (
    <div>
      <style>{CSS}</style>
      <div className="ta-cols" style={{ marginBottom: extras.length ? 14 : 0 }}>
        {COLUMNAS.map((c) => (
          <div key={c.logo} className="ta-col">
            <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 0" }}><CarrierLogo k={c.logo} alto={42} /></div>
            {c.servicios.map((sk) => {
              const filas = tarifas.servicios?.[sk] || [];
              return (
                <div key={sk} style={caja}>
                  <div style={{ marginBottom: 10 }}><Divisor div={SERV[sk].div} t={t} /></div>
                  {filas.length === 0 ? <p style={{ fontSize: 12.5, color: INK(0.4), margin: 0 }}>{t.sinTarifa}</p> : filas.map((f, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: i ? `1px solid ${INK(0.06)}` : "none", fontSize: 14 }}>
                      <span style={{ color: INK(0.65) }}>{nk(f.min)}{f.max != null ? ` – ${nk(f.max)}` : "+"} kg</span>
                      <b style={{ color: GOLD, fontVariantNumeric: "tabular-nums" }}>USD {n2(f.usd)}/kg</b>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {extras.length > 0 && <div style={{ ...caja, padding: "14px 18px" }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: TX, margin: "0 0 10px", textAlign: "center" }}>{t.extras}</p>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {extras.map(([k, lk, uk]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", fontSize: 13.5 }}><span style={{ color: INK(0.7) }}>{t[lk]}</span><span><b style={{ color: GOLD, fontVariantNumeric: "tabular-nums" }}>USD {n2(e[k])}</b> <span style={{ color: INK(0.5) }}>{t[uk]}</span></span></div>)}
        </div>
      </div>}
      {tarifas.actualizado && <p style={{ fontSize: 12, color: INK(0.45), margin: "10px 0 0" }}>{t.actualizado} {new Date(tarifas.actualizado).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>}
    </div>
  );
}

// Admin dentro del panel del agente: elige un agente y ve el mismo editor que él.
export function TarifasAgenteAdmin({ token, lang = "es" }) {
  const [agentes, setAgentes] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    fetch("/api/agente/tarifas", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => { const l = j?.agentes || []; setAgentes(l); if (l[0]) setSel(l[0].auth_user_id); })
      .catch(() => setAgentes([]));
  }, [token]);
  if (agentes == null) return <p style={{ color: INK(0.5), textAlign: "center", padding: "2rem 0" }}>Cargando…</p>;
  if (agentes.length === 0) return <p style={{ color: INK(0.5), textAlign: "center", padding: "2rem 0" }}>No hay agentes aprobados.</p>;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: GOLD }}>Vista admin · estás viendo lo que carga</span>
        {agentes.map((a) => { const on = sel === a.auth_user_id; return <button key={a.auth_user_id} type="button" onClick={() => setSel(a.auth_user_id)} style={{ height: 34, padding: "0 14px", borderRadius: 10, border: `1px solid ${on ? "rgba(232,208,152,0.6)" : INK(0.12)}`, background: on ? "rgba(184,149,106,0.18)" : "transparent", color: on ? GOLD : INK(0.7), fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{`${a.first_name || ""} ${a.last_name || ""}`.trim() || a.email}{a.tarifas ? "" : " · sin cargar"}</button>; })}
      </div>
      {sel && <TarifasAgenteEditor key={sel} token={token} lang={lang} agentUserId={sel} />}
    </div>
  );
}
