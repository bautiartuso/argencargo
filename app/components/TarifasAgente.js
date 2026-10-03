"use client";
// Tarifas del agente (03/10/2026). El agente carga, para cada servicio, los rangos de kg que quiera
// con su USD/kg y los adicionales; Argencargo las ve en Depósito → Agentes. Se guardan por
// /api/agente/tarifas. Usa las variables de color del panel del agente con valores por defecto
// oscuros, así el resumen también se ve bien dentro del admin.
import { useEffect, useState } from "react";
import CarrierLogo, { SERVICIOS_AGENTE } from "./CarrierLogo";
import DatePicker from "./DatePicker";

const INK = (a) => `rgba(var(--ink, 255,255,255),${a})`;
const TX = "var(--tx, #fff)";
const GOLD = "var(--gold, #E8D098)";

const TXT = {
  es: {
    vigencia: "Vigencia", desde: "Desde", hasta: "Hasta", rangos: "rangos", rango: "rango",
    kgDesde: "Desde kg", kgHasta: "Hasta kg", usdKg: "USD / kg", oMas: "o más", agregar: "+ Agregar rango",
    extras: "Adicionales", bateria: "Mercadería con baterías", bateriaU: "USD por envío",
    marca: "Mercadería con marca", marcaU: "USD por kg", sobrepeso: "Sobrepeso", sobrepesoU: "USD por bulto",
    remota: "Zona remota", remotaU: "USD por kg", remotaMin: "Mínimo USD", notas: "Notas",
    guardar: "Guardar tarifas", guardando: "Guardando…", guardado: "Tarifas guardadas", error: "No se pudieron guardar",
    cargando: "Cargando…", vacio: "Sin rangos cargados", actualizado: "Actualizado",
  },
  zh: {
    vigencia: "有效期", desde: "从", hasta: "到", rangos: "个区间", rango: "个区间",
    kgDesde: "起始 kg", kgHasta: "截止 kg", usdKg: "USD / kg", oMas: "以上", agregar: "+ 添加区间",
    extras: "附加费", bateria: "带电池货物", bateriaU: "每票 USD",
    marca: "品牌货物", marcaU: "每 kg USD", sobrepeso: "超重", sobrepesoU: "每件 USD",
    remota: "偏远地区", remotaU: "每 kg USD", remotaMin: "最低 USD", notas: "备注",
    guardar: "保存运价", guardando: "保存中…", guardado: "运价已保存", error: "保存失败",
    cargando: "加载中…", vacio: "未设置区间", actualizado: "更新于",
  },
};

const n2 = (v) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nk = (v) => Number(v || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const titulo = (s) => <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><CarrierLogo k={s.logo} alto={34} />{s.div && <span style={{ fontSize: 16, fontWeight: 900, color: TX, fontVariantNumeric: "tabular-nums" }}>÷{s.div.toLocaleString("es-AR")}</span>}</span>;
const caja = { background: INK(0.035), border: `1px solid ${INK(0.09)}`, borderRadius: 16, padding: "16px 16px 14px", minWidth: 0 };
const inp = { width: "100%", height: 40, padding: "0 10px", fontSize: 15, fontWeight: 700, boxSizing: "border-box", border: `1px solid ${INK(0.14)}`, borderRadius: 9, background: INK(0.05), color: TX, outline: "none", fontFamily: "inherit", textAlign: "right", fontVariantNumeric: "tabular-nums" };
const lbl = { display: "block", fontSize: 10.5, fontWeight: 800, color: INK(0.5), textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 5px" };

const vacioServ = () => [{ min: "", max: "", usd: "" }];
const aEdicion = (data) => {
  const servicios = {};
  SERVICIOS_AGENTE.forEach((s) => {
    const filas = data?.servicios?.[s.k];
    servicios[s.k] = Array.isArray(filas) && filas.length ? filas.map((f) => ({ min: f.min ?? "", max: f.max ?? "", usd: f.usd ?? "" })) : vacioServ();
  });
  const e = data?.extras || {};
  return {
    servicios,
    extras: { bateria_usd_total: e.bateria_usd_total ?? "", marca_usd_kg: e.marca_usd_kg ?? "", sobrepeso_usd_pieza: e.sobrepeso_usd_pieza ?? "", remota_usd_kg: e.remota_usd_kg ?? "", remota_min_usd: e.remota_min_usd ?? "" },
    vigencia: { desde: data?.vigencia?.desde || "", hasta: data?.vigencia?.hasta || "" },
    notas: data?.notas || "",
  };
};

// Editor del agente.
export function TarifasAgenteEditor({ token, lang = "es", onSaved }) {
  const t = TXT[lang] || TXT.es;
  const [d, setD] = useState(null);
  const [actualizado, setActualizado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    fetch("/api/agente/tarifas", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => { setD(aEdicion(j?.tarifas)); setActualizado(j?.tarifas?.actualizado || null); })
      .catch(() => setD(aEdicion(null)));
  }, [token]);
  if (!d) return <p style={{ color: INK(0.5), textAlign: "center", padding: "2rem 0" }}>{t.cargando}</p>;
  const soloNum = (v) => v === "" || /^[\d.,]*$/.test(v);
  const setFila = (sk, i, campo, v) => { if (!soloNum(v)) return; setD((p) => ({ ...p, servicios: { ...p.servicios, [sk]: p.servicios[sk].map((f, j) => (j === i ? { ...f, [campo]: v } : f)) } })); };
  const agregar = (sk) => setD((p) => { const l = p.servicios[sk]; const ult = l[l.length - 1]; return { ...p, servicios: { ...p.servicios, [sk]: [...l, { min: ult?.max || "", max: "", usd: "" }] } }; });
  const quitar = (sk, i) => setD((p) => { const l = p.servicios[sk].filter((_, j) => j !== i); return { ...p, servicios: { ...p.servicios, [sk]: l.length ? l : vacioServ() } }; });
  const setExtra = (k, v) => { if (!soloNum(v)) return; setD((p) => ({ ...p, extras: { ...p.extras, [k]: v } })); };
  const guardar = async () => {
    setGuardando(true); setMsg(null);
    try {
      const r = await fetch("/api/agente/tarifas", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(d) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "error");
      setD(aEdicion(j.tarifas)); setActualizado(j.tarifas?.actualizado || null);
      setMsg({ ok: true, t: t.guardado }); onSaved?.(j.tarifas);
    } catch (e) { setMsg({ ok: false, t: t.error }); }
    setGuardando(false);
  };
  const extraIn = (k, label, unidad) => <div style={{ minWidth: 0 }}><span style={lbl}>{label}</span><div style={{ position: "relative" }}><input inputMode="decimal" value={d.extras[k]} onChange={(e) => setExtra(k, e.target.value)} placeholder="0" style={{ ...inp, paddingRight: 92 }} /><span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: INK(0.4), pointerEvents: "none" }}>{unidad}</span></div></div>;
  return (
    <div>
      <div style={{ ...caja, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: TX, marginRight: "auto" }}>{t.vigencia}</span>
        <div style={{ width: 170 }}><span style={lbl}>{t.desde}</span><DatePicker value={d.vigencia.desde} onChange={(v) => setD((p) => ({ ...p, vigencia: { ...p.vigencia, desde: v || "" } }))} /></div>
        <div style={{ width: 170 }}><span style={lbl}>{t.hasta}</span><DatePicker value={d.vigencia.hasta} onChange={(v) => setD((p) => ({ ...p, vigencia: { ...p.vigencia, hasta: v || "" } }))} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))", gap: 14, marginBottom: 14 }}>
        {SERVICIOS_AGENTE.map((s) => (
          <div key={s.k} style={caja}>
            <div style={{ marginBottom: 12 }}>{titulo(s)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.1fr 30px", gap: 6, marginBottom: 5 }}>
              {[t.kgDesde, t.kgHasta, t.usdKg, ""].map((h, i) => <span key={i} style={{ ...lbl, margin: 0, textAlign: i < 3 ? "right" : "left" }}>{h}</span>)}
            </div>
            {d.servicios[s.k].map((f, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.1fr 30px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <input inputMode="decimal" value={f.min} onChange={(e) => setFila(s.k, i, "min", e.target.value)} placeholder="0" style={inp} />
                <input inputMode="decimal" value={f.max} onChange={(e) => setFila(s.k, i, "max", e.target.value)} placeholder={t.oMas} style={inp} />
                <input inputMode="decimal" value={f.usd} onChange={(e) => setFila(s.k, i, "usd", e.target.value)} placeholder="0,00" style={{ ...inp, color: GOLD }} />
                <button type="button" onClick={() => quitar(s.k, i)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${INK(0.12)}`, background: "transparent", color: INK(0.45), cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => agregar(s.k)} style={{ marginTop: 4, height: 34, padding: "0 12px", borderRadius: 9, border: "1px dashed rgba(232,208,152,0.45)", background: "transparent", color: GOLD, fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{t.agregar}</button>
          </div>
        ))}
      </div>
      <div style={{ ...caja, marginBottom: 14 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: TX, margin: "0 0 12px" }}>{t.extras}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
          {extraIn("bateria_usd_total", t.bateria, t.bateriaU)}
          {extraIn("marca_usd_kg", t.marca, t.marcaU)}
          {extraIn("sobrepeso_usd_pieza", t.sobrepeso, t.sobrepesoU)}
          {extraIn("remota_usd_kg", t.remota, t.remotaU)}
          {extraIn("remota_min_usd", `${t.remota} · ${t.remotaMin}`, "USD")}
        </div>
        <span style={{ ...lbl, marginTop: 14 }}>{t.notas}</span>
        <textarea value={d.notas} onChange={(e) => setD((p) => ({ ...p, notas: e.target.value }))} rows={2} style={{ ...inp, height: "auto", padding: "10px", textAlign: "left", fontWeight: 500, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button type="button" onClick={guardar} disabled={guardando} style={{ height: 46, padding: "0 28px", borderRadius: 12, border: "1px solid #B8956A", background: "linear-gradient(135deg,#B8956A 0%,#E8D098 50%,#B8956A 100%)", color: "#0A1628", fontWeight: 900, fontSize: 15, cursor: guardando ? "wait" : "pointer", fontFamily: "inherit" }}>{guardando ? t.guardando : t.guardar}</button>
        {msg && <span style={{ fontSize: 13, fontWeight: 700, color: msg.ok ? "var(--green, #22c55e)" : "var(--red, #ff6b6b)" }}>{msg.ok ? "✓ " : "⚠ "}{msg.t}</span>}
        {actualizado && <span style={{ fontSize: 12, color: INK(0.45) }}>{t.actualizado} {new Date(actualizado).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
    </div>
  );
}

// Resumen de solo lectura (admin → Depósito → Agentes).
export function TarifasAgenteResumen({ tarifas }) {
  if (!tarifas) return <p style={{ fontSize: 13, color: INK(0.45), margin: 0 }}>Todavía no cargó sus tarifas.</p>;
  const e = tarifas.extras || {};
  const v = tarifas.vigencia || {};
  const fd = (s) => (s ? s.split("-").reverse().join("/") : "");
  const extras = [
    e.bateria_usd_total != null && ["Baterías", `+USD ${n2(e.bateria_usd_total)} por envío`],
    e.marca_usd_kg != null && ["Con marca", `+USD ${n2(e.marca_usd_kg)}/kg`],
    e.sobrepeso_usd_pieza != null && ["Sobrepeso", `USD ${n2(e.sobrepeso_usd_pieza)} por bulto`],
    e.remota_usd_kg != null && ["Zona remota", `USD ${n2(e.remota_usd_kg)}/kg${e.remota_min_usd != null ? ` · mín. USD ${n2(e.remota_min_usd)}` : ""}`],
  ].filter(Boolean);
  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: INK(0.55), marginBottom: 12 }}>
        {(v.desde || v.hasta) && <span>Vigencia <b style={{ color: TX }}>{fd(v.desde) || "—"} → {fd(v.hasta) || "—"}</b></span>}
        {tarifas.actualizado && <span>Actualizado {new Date(tarifas.actualizado).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12, marginBottom: extras.length ? 12 : 0 }}>
        {SERVICIOS_AGENTE.map((s) => {
          const filas = tarifas.servicios?.[s.k] || [];
          return (
            <div key={s.k} style={caja}>
              <div style={{ marginBottom: 10 }}>{titulo(s)}</div>
              {filas.length === 0 ? <p style={{ fontSize: 12.5, color: INK(0.4), margin: 0 }}>Sin tarifa</p> : filas.map((f, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderTop: i ? `1px solid ${INK(0.06)}` : "none", fontSize: 13.5 }}>
                  <span style={{ color: INK(0.65) }}>{nk(f.min)}{f.max != null ? `–${nk(f.max)}` : "+"} kg</span>
                  <b style={{ color: GOLD, fontVariantNumeric: "tabular-nums" }}>USD {n2(f.usd)}/kg</b>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {extras.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{extras.map(([l, val]) => <span key={l} style={{ fontSize: 12.5, padding: "6px 11px", borderRadius: 9, background: INK(0.05), border: `1px solid ${INK(0.09)}`, color: INK(0.7) }}>{l}: <b style={{ color: TX }}>{val}</b></span>)}</div>}
      {tarifas.notas && <p style={{ fontSize: 12.5, color: INK(0.6), margin: "10px 0 0", whiteSpace: "pre-wrap" }}>📝 {tarifas.notas}</p>}
    </div>
  );
}
