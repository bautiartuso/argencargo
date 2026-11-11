"use client";
// Tarifas del agente · v2 (10/11/2026, pedido de Bautista: "tiene que ser una bestialidad").
// Dos orígenes con bandera (China Mainland / Hong Kong) y, por courier, una planilla: filas = rangos de
// kg, columnas = servicio × divisor (FedEx International Economy / Priority, UPS Expedited / Saver, cada
// uno ÷5000 y ÷6000; DHL una sola columna). Abajo los adicionales y una barra fija para guardar.
// Todo en es / zh: el agente lo usa en chino. Usa las variables de color del panel del agente (claro y
// oscuro) con valores por defecto oscuros, así también se ve bien dentro del admin.
// Datos y conversión del formato viejo: lib/tarifas-agente.js. Se guarda por /api/agente/tarifas.
import { useEffect, useMemo, useRef, useState } from "react";
import CarrierLogo from "./CarrierLogo";
import { CARRIERS, ORIGENES, EXTRAS_KEYS, normalizarTarifas, aPlanilla, serviciosCargados, SERVICIOS_V2 } from "../../lib/tarifas-agente";

const INK = (a) => `rgba(var(--ink, 255,255,255),${a})`;
const TX = "var(--tx, #fff)";
const GOLD = "var(--gold, #E8D098)";
const GREEN = "var(--green, #22c55e)";

const TXT = {
  es: {
    titulo: "Tus tarifas", sub: "Precio por kg en USD, por origen, courier y servicio. Dejá vacío lo que no ofrecés.",
    CN: "China Mainland", CN2: "China continental", HK: "Hong Kong", HK2: "香港",
    cargados: (n, t) => `${n} de ${t} servicios con precio`,
    peso: "Peso (kg)", desde: "Desde", hasta: "Hasta", oMas: "o más", usdKg: "USD / kg", volum: "volumétrico",
    economico: "Más económico · más lento", rapido: "Más rápido",
    agregar: "+ Agregar rango", copiar: "Usar los rangos de China Mainland", quitar: "Quitar rango",
    extras: "Adicionales", extrasSub: "Valen para los dos orígenes",
    bateria: "Mercaderías que contienen baterías", marca: "Mercaderías con marcas registradas", sobrepeso: "Bultos con sobrepeso", remota: "Área remota de envío",
    porEnvio: "por envío", porKg: "por kg", porBulto: "por bulto", minimo: "mínimo",
    guardar: "Guardar tarifas", guardando: "Guardando…", guardado: "Tarifas guardadas", error: "No se pudieron guardar",
    sinGuardar: "Cambios sin guardar", alDia: "Todo guardado", cargando: "Cargando…", actualizado: "Actualizado",
    sinTarifa: "Sin tarifa cargada", masBarato: "más barato",
  },
  zh: {
    titulo: "我的运价", sub: "按发货地、快递公司和服务填写每公斤美元价格。不提供的服务请留空。",
    CN: "中国大陆", CN2: "Mainland China", HK: "香港", HK2: "Hong Kong",
    cargados: (n, t) => `已填写 ${n}/${t} 项服务`,
    peso: "重量 (kg)", desde: "起", hasta: "止", oMas: "以上", usdKg: "美元 / 公斤", volum: "体积重",
    economico: "更便宜 · 较慢", rapido: "更快",
    agregar: "+ 添加重量段", copiar: "使用中国大陆的重量段", quitar: "删除",
    extras: "附加费", extrasSub: "两个发货地通用",
    bateria: "含电池货物", marca: "含注册商标货物", sobrepeso: "超重包裹", remota: "偏远地区派送",
    porEnvio: "每票", porKg: "每公斤", porBulto: "每件", minimo: "最低",
    guardar: "保存运价", guardando: "保存中…", guardado: "运价已保存", error: "保存失败",
    sinGuardar: "有未保存的修改", alDia: "已全部保存", cargando: "加载中…", actualizado: "更新于",
    sinTarifa: "未设置运价", masBarato: "最低价",
  },
};

const MARCA = { dhl: "#FFCC00", fedex: "#7B3FC4", ups: "#FFB500" };
const TARJ_EXTRAS = [
  { titulo: "bateria", campos: [["bateria_usd_total", "porEnvio"]], ic: "⚡" },
  { titulo: "marca", campos: [["marca_usd_kg", "porKg"]], ic: "®" },
  { titulo: "sobrepeso", campos: [["sobrepeso_usd_pieza", "porBulto"]], ic: "⚖" },
  { titulo: "remota", campos: [["remota_usd_kg", "porKg"], ["remota_min_usd", "minimo"]], ic: "⌖" },
];

const n2 = (v) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nk = (v) => Number(v || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const numOk = (v) => v === "" || /^[\d.,]*$/.test(v);
const aNum = (v) => { if (v === "" || v == null) return null; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
const fechaCorta = (iso) => new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// ── Banderas dibujadas (los emoji de bandera no se ven en Windows) ─────────────────────────────────
const estrella = (cx, cy, R, rot = -90) => {
  const p = [];
  for (let i = 0; i < 10; i++) { const r = i % 2 ? R * 0.382 : R; const a = ((rot + i * 36) * Math.PI) / 180; p.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`); }
  return p.join(" ");
};
export function Bandera({ o, w = 36 }) {
  const h = (w * 2) / 3;
  return (
    <svg viewBox="0 0 30 20" width={w} height={h} style={{ display: "block", borderRadius: 4, flexShrink: 0, boxShadow: "0 0 0 1px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.25)" }}>
      <rect width="30" height="20" fill="#DE2910" />
      {o === "CN" ? <>
        <polygon points={estrella(5, 5, 3)} fill="#FFDE00" />
        {[[10, 2, 18], [12, 4, 45], [12, 7, 70], [10, 9, 90]].map(([x, y, r], i) => <polygon key={i} points={estrella(x, y, 1, r)} fill="#FFDE00" />)}
      </> : (
        <g transform="translate(15 10)">
          {[0, 72, 144, 216, 288].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <path d="M0 0 C -2.6 -1.2 -3.4 -4.6 -1.2 -6.9 C 0.4 -5.6 1.6 -3.8 0.9 -2.2 C 0.6 -1.3 0.3 -0.6 0 0 Z" fill="#fff" />
              <polygon points={estrella(-1.1, -4.4, 0.55, a)} fill="#DE2910" />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

function VelChip({ vel, t }) {
  const rap = vel === "rapido";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.02em", whiteSpace: "nowrap", color: rap ? GOLD : GREEN, background: rap ? "rgba(232,208,152,0.12)" : "rgba(34,197,94,0.1)", border: `1px solid ${rap ? "rgba(232,208,152,0.4)" : "rgba(34,197,94,0.35)"}` }}>
      <span aria-hidden>{rap ? "⚡" : "◷"}</span>{t[vel]}
    </span>
  );
}

// ── Selector de origen ──────────────────────────────────────────────────────────────────────────
function Origenes({ o, setO, t, cuenta, chico }) {
  const total = SERVICIOS_V2.length;
  return (
    <div className="ta2-or" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: chico ? 8 : 12, marginBottom: chico ? 14 : 20 }}>
      {ORIGENES.map((k) => {
        const on = o === k; const n = cuenta(k);
        return (
          <button key={k} type="button" onClick={() => setO(k)} style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: chico ? 10 : 14, padding: chico ? "10px 14px" : "16px 18px", borderRadius: chico ? 12 : 16, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: TX, border: `1.5px solid ${on ? "rgba(232,208,152,0.75)" : INK(0.1)}`, background: on ? "linear-gradient(135deg, rgba(222,41,16,0.16), rgba(184,149,106,0.1))" : INK(0.03), boxShadow: on ? "0 10px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)" : "none", transition: "all 160ms" }}>
            <Bandera o={k} w={chico ? 30 : 44} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontSize: chico ? 14 : 17, fontWeight: 900, letterSpacing: "-0.01em" }}>{t[k]}</span>
              {!chico && <span style={{ display: "block", fontSize: 12, color: INK(0.5), fontWeight: 600, marginTop: 1 }}>{t[`${k}2`]}</span>}
            </span>
            <span style={{ flexShrink: 0, textAlign: "right" }}>
              <span style={{ display: "block", fontSize: chico ? 13 : 15, fontWeight: 900, color: n ? (on ? GOLD : TX) : INK(0.35), fontVariantNumeric: "tabular-nums" }}>{n}/{total}</span>
              {!chico && <span style={{ display: "block", width: 64, height: 4, borderRadius: 4, background: INK(0.1), marginTop: 5, overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(n / total) * 100}%`, background: "linear-gradient(90deg,#B8956A,#E8D098)", borderRadius: 4 }} /></span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Estado de edición ───────────────────────────────────────────────────────────────────────────
let _id = 0;
const nid = () => `r${++_id}`;
const keysDe = (c) => c.servicios.flatMap((s) => s.cols.map((x) => x.key));
const aFilasEdicion = (servicios, c) => {
  const p = aPlanilla(servicios, keysDe(c)).map((r) => ({ id: nid(), min: r.min == null ? "" : String(r.min), max: r.max == null ? "" : String(r.max), v: Object.fromEntries(Object.entries(r.v).map(([k, x]) => [k, x == null ? "" : String(x)])) }));
  return p.length ? p : [{ id: nid(), min: "", max: "", v: {} }];
};
const aEdicion = (raw) => {
  const tar = normalizarTarifas(raw) || normalizarTarifas({ servicios: {} });
  const orig = {};
  ORIGENES.forEach((o) => { orig[o] = Object.fromEntries(CARRIERS.map((c) => [c.k, aFilasEdicion(tar.origenes[o].servicios, c)])); });
  const e = tar.extras || {};
  return { orig, extras: Object.fromEntries(EXTRAS_KEYS.map((k) => [k, e[k] == null ? "" : String(e[k])])), vigencia: tar.vigencia, notas: tar.notas || "" };
};
const aCuerpo = (d) => {
  const origenes = {};
  ORIGENES.forEach((o) => {
    const servicios = Object.fromEntries(SERVICIOS_V2.map((k) => [k, []]));
    CARRIERS.forEach((c) => d.orig[o][c.k].forEach((r) => keysDe(c).forEach((k) => {
      const usd = aNum(r.v[k]); if (usd == null) return;
      servicios[k].push({ min: aNum(r.min) ?? 0, max: aNum(r.max), usd });
    })));
    origenes[o] = { servicios };
  });
  return { origenes, extras: d.extras, vigencia: d.vigencia, notas: d.notas };
};
const leerBorrador = (clave) => { try { const b = JSON.parse(localStorage.getItem(clave) || "null"); return b?.origenes ? b : null; } catch { return null; } };
const cuentaEdicion = (d, o) => SERVICIOS_V2.filter((k) => CARRIERS.some((c) => keysDe(c).includes(k) && d.orig[o][c.k].some((r) => aNum(r.v[k]) != null))).length;

const CSS = `
.ta2 input::placeholder{color:${INK(0.28)};font-weight:600}
.ta2-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.ta2-t{width:100%;border-collapse:separate;border-spacing:0}
.ta2-t th{font-weight:800;text-align:center;padding:0 4px}
.ta2-t td{padding:4px}
.ta2-in{width:100%;min-width:72px;height:42px;padding:0 10px;font-size:15px;font-weight:700;box-sizing:border-box;border:1px solid ${INK(0.13)};border-radius:10px;background:${INK(0.045)};color:${TX};outline:none;font-family:inherit;text-align:right;font-variant-numeric:tabular-nums;transition:border-color 120ms,background 120ms,box-shadow 120ms}
.ta2-in:focus{border-color:rgba(232,208,152,0.75);background:${INK(0.07)};box-shadow:0 0 0 3px rgba(232,208,152,0.14)}
.ta2-in.p{color:${GOLD}}
.ac-ag[data-theme="light"] .ta2-in{background:#fff;border-color:rgba(10,22,40,0.16)}
.ac-ag[data-theme="light"] .ta2-in.p.lleno{background:#fbf6ec;border-color:rgba(140,107,62,0.4)}
.ta2-in.p.lleno{border-color:rgba(232,208,152,0.35);background:rgba(184,149,106,0.08)}
.ta2-x{width:32px;height:32px;border-radius:9px;border:1px solid ${INK(0.1)};background:transparent;color:${INK(0.4)};cursor:pointer;font-size:16px;padding:0;transition:all 120ms}
.ta2-x:hover{color:var(--red,#ff6b6b);border-color:rgba(255,107,107,0.4)}
.ta2-ext{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media(max-width:1100px){.ta2-ext{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.ta2-ext{grid-template-columns:1fr}.ta2-or{grid-template-columns:1fr!important}}
`;

// ── Planilla de un courier (editable o de solo lectura) ─────────────────────────────────────────
function PlanillaCourier({ c, filas, t, editable, onCampo, onAgregar, onQuitar, onCopiar, puedeCopiar }) {
  const cols = c.servicios.flatMap((s) => s.cols.map((col) => ({ ...col, s })));
  const multi = c.servicios.length > 1;
  const cargados = cols.filter((col) => filas.some((r) => aNum(editable ? r.v[col.key] : r.v[col.key]) != null)).length;
  const sepIzq = (i) => (i > 0 && cols[i - 1].s.k !== cols[i].s.k ? `2px solid ${INK(0.08)}` : "none");
  const minFila = (r) => { const vs = cols.map((col) => aNum(r.v[col.key])).filter((x) => x != null); return vs.length > 1 ? Math.min(...vs) : null; };
  const hayAlgo = filas.some((r) => cols.some((col) => aNum(r.v[col.key]) != null));
  return (
    <div style={{ position: "relative", borderRadius: 20, border: `1px solid ${INK(0.09)}`, background: `linear-gradient(180deg, ${INK(0.045)}, ${INK(0.02)})`, padding: "0 0 16px", marginBottom: 16, overflow: "hidden", boxShadow: "0 12px 34px rgba(0,0,0,0.16)" }}>
      <div aria-hidden style={{ height: 4, background: `linear-gradient(90deg, ${MARCA[c.k]}, ${MARCA[c.k]}55 60%, transparent)` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px 12px", flexWrap: "wrap" }}>
        <CarrierLogo k={c.k} alto={46} />
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: TX, letterSpacing: "-0.01em" }}>{c.nombre}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: cargados ? GOLD : INK(0.4) }}>{t.cargados(cargados, cols.length)}</p>
        </div>
        {editable && puedeCopiar && <button type="button" onClick={onCopiar} style={{ height: 34, padding: "0 12px", borderRadius: 10, border: `1px solid ${INK(0.14)}`, background: INK(0.04), color: INK(0.75), fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7 }}><Bandera o="CN" w={18} />{t.copiar}</button>}
      </div>
      {!editable && !hayAlgo ? <p style={{ margin: "0 18px", fontSize: 13, color: INK(0.4) }}>{t.sinTarifa}</p> : (
        <div className="ta2-scroll" style={{ padding: "0 14px" }}>
          <table className="ta2-t" style={multi ? { minWidth: 720 } : { width: "auto", minWidth: 360 }}>
            <thead>
              <tr>
                <th colSpan={2} style={{ textAlign: "left", verticalAlign: "bottom", paddingBottom: 8 }}><span style={{ fontSize: 10.5, color: INK(0.45), textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.peso}</span></th>
                {c.servicios.map((s, si) => (
                  <th key={s.k} colSpan={s.cols.length} style={{ padding: "0 4px 8px", borderLeft: si ? `2px solid ${INK(0.08)}` : "none" }}>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 900, color: TX, letterSpacing: "-0.005em", whiteSpace: "nowrap" }}>{multi ? s.corto : s.nombre}</span>
                      <VelChip vel={s.vel} t={t} />
                    </span>
                  </th>
                ))}
                {editable && <th />}
              </tr>
              <tr>
                {editable ? <><th style={{ textAlign: "right", paddingBottom: 6 }}><span style={{ fontSize: 10.5, color: INK(0.45), textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.desde}</span></th><th style={{ textAlign: "right", paddingBottom: 6 }}><span style={{ fontSize: 10.5, color: INK(0.45), textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.hasta}</span></th></> : <th colSpan={2} />}
                {cols.map((col, i) => (
                  <th key={col.key} style={{ paddingBottom: 6, borderLeft: sepIzq(i) }}>
                    {col.div ? <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, padding: "3px 10px", borderRadius: 999, background: "rgba(184,149,106,0.14)", border: "1px solid rgba(232,208,152,0.35)" }}><span style={{ fontSize: 14, color: GOLD, lineHeight: 1 }}>÷</span><span style={{ fontSize: 12.5, fontWeight: 900, color: TX, fontVariantNumeric: "tabular-nums" }}>{col.div.toLocaleString("es-AR")}</span></span>
                      : <span style={{ fontSize: 10.5, color: INK(0.45), textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.usdKg}</span>}
                  </th>
                ))}
                {editable && <th />}
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => {
                const mn = editable ? null : minFila(r);
                return (
                  <tr key={r.id}>
                    {editable ? <>
                      <td style={{ width: 88 }}><input className="ta2-in" inputMode="decimal" value={r.min} onChange={(e) => onCampo(r.id, "min", e.target.value)} placeholder="0" /></td>
                      <td style={{ width: 88 }}><input className="ta2-in" inputMode="decimal" value={r.max} onChange={(e) => onCampo(r.id, "max", e.target.value)} placeholder={t.oMas} /></td>
                    </> : <td colSpan={2} style={{ padding: "10px 4px", fontSize: 14, fontWeight: 700, color: INK(0.75), whiteSpace: "nowrap", borderTop: `1px solid ${INK(0.06)}` }}>{nk(r.min)}{r.max != null && r.max !== "" ? ` – ${nk(r.max)}` : "+"} kg</td>}
                    {cols.map((col, i) => {
                      const v = r.v[col.key];
                      if (editable) return <td key={col.key} style={{ borderLeft: sepIzq(i) }}><input className={`ta2-in p${aNum(v) != null ? " lleno" : ""}`} inputMode="decimal" value={v ?? ""} onChange={(e) => onCampo(r.id, col.key, e.target.value)} placeholder="—" /></td>;
                      const x = aNum(v); const barato = x != null && mn != null && x === mn;
                      return (
                        <td key={col.key} style={{ textAlign: "center", padding: "8px 4px", borderTop: `1px solid ${INK(0.06)}`, borderLeft: sepIzq(i) }}>
                          {x == null ? <span style={{ color: INK(0.25), fontWeight: 700 }}>—</span> : (
                            <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", padding: barato ? "4px 10px" : "4px 0", borderRadius: 10, background: barato ? "rgba(34,197,94,0.12)" : "transparent", border: barato ? "1px solid rgba(34,197,94,0.4)" : "1px solid transparent" }}>
                              <b style={{ fontSize: 15, color: barato ? GREEN : GOLD, fontVariantNumeric: "tabular-nums" }}>{n2(x)}</b>
                              {barato && <span style={{ fontSize: 9, fontWeight: 800, color: GREEN, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.masBarato}</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {editable && <td style={{ width: 40, textAlign: "center" }}><button type="button" className="ta2-x" title={t.quitar} onClick={() => onQuitar(r.id)}>×</button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {editable && <button type="button" onClick={onAgregar} style={{ margin: "8px 4px 0", height: 36, padding: "0 14px", borderRadius: 10, border: "1px dashed rgba(232,208,152,0.5)", background: "rgba(184,149,106,0.06)", color: GOLD, fontWeight: 800, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{t.agregar}</button>}
        </div>
      )}
    </div>
  );
}

function Adicionales({ t, valores, onCampo }) {
  const editable = !!onCampo;
  const lista = editable ? TARJ_EXTRAS : TARJ_EXTRAS.filter((x) => x.campos.some(([k]) => valores[k] != null && valores[k] !== ""));
  if (!lista.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "0 2px 12px", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: TX }}>{t.extras}</p>
        <span style={{ fontSize: 12, fontWeight: 600, color: INK(0.45) }}>{t.extrasSub}</span>
      </div>
      <div className="ta2-ext">
        {lista.map((x) => (
          <div key={x.titulo} style={{ borderRadius: 16, border: `1px solid ${INK(0.09)}`, background: INK(0.035), padding: "14px 15px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: GOLD, background: "rgba(184,149,106,0.14)", border: "1px solid rgba(232,208,152,0.3)", flexShrink: 0 }}>{x.ic}</span>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: TX, lineHeight: 1.3 }}>{t[x.titulo]}</span>
            </div>
            {x.campos.map(([k, uk]) => editable ? (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 800, color: INK(0.4), pointerEvents: "none" }}>USD</span>
                  <input className="ta2-in p" inputMode="decimal" value={valores[k]} onChange={(e) => onCampo(k, e.target.value)} placeholder="0" style={{ paddingLeft: 46, fontSize: 16 }} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: INK(0.55), minWidth: 56 }}>{t[uk]}</span>
              </div>
            ) : valores[k] != null && valores[k] !== "" && (
              <p key={k} style={{ margin: 0, fontSize: 14 }}><b style={{ color: GOLD, fontVariantNumeric: "tabular-nums" }}>USD {n2(valores[k])}</b> <span style={{ color: INK(0.55) }}>{t[uk]}</span></p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Encabezado({ t, actualizado }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: TX, letterSpacing: "-0.02em" }}>{t.titulo}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: INK(0.55), lineHeight: 1.5 }}>{t.sub}</p>
      </div>
      {actualizado && <span style={{ fontSize: 12, fontWeight: 600, color: INK(0.45) }}>{t.actualizado} {fechaCorta(actualizado)}</span>}
    </div>
  );
}

// ── Editor del agente (y del admin mirando a un agente: agentUserId) ────────────────────────────
export function TarifasAgenteEditor({ token, lang = "es", onSaved, agentUserId = null }) {
  const t = TXT[lang] || TXT.es;
  const [d, setD] = useState(null);
  const [o, setO] = useState("CN");
  const [actualizado, setActualizado] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sucio, setSucio] = useState(false);
  const base = useRef("");
  const clave = `ac_tarifas_borrador_${agentUserId || "yo"}`;
  useEffect(() => {
    fetch("/api/agente/tarifas", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => {
        const tar = agentUserId ? (j?.agentes || []).find((a) => a.auth_user_id === agentUserId)?.tarifas : j?.tarifas;
        const e = aEdicion(tar); base.current = JSON.stringify(aCuerpo(e)); setActualizado(tar?.actualizado || null);
        // Borrador local (11/11/2026): lo tipeado y no guardado sobrevive a una recarga o a un guardado que falló.
        const b = leerBorrador(clave);
        setD(b && JSON.stringify(b) !== base.current ? aEdicion(b) : e);
      })
      .catch(() => { const b = leerBorrador(clave); setD(aEdicion(b)); });
  }, [token, agentUserId]);
  useEffect(() => {
    if (!d) return;
    const cuerpo = JSON.stringify(aCuerpo(d)); const cambio = cuerpo !== base.current;
    setSucio(cambio);
    try { if (cambio) localStorage.setItem(clave, cuerpo); else localStorage.removeItem(clave); } catch {}
  }, [d]);
  if (!d) return <p style={{ color: INK(0.5), textAlign: "center", padding: "2rem 0" }}>{t.cargando}</p>;

  const cambiarFilas = (ck, fn) => { setMsg(null); setD((p) => ({ ...p, orig: { ...p.orig, [o]: { ...p.orig[o], [ck]: fn(p.orig[o][ck]) } } })); };
  const onCampo = (ck) => (id, campo, v) => {
    if (!numOk(v)) return;
    cambiarFilas(ck, (l) => l.map((r) => (r.id !== id ? r : campo === "min" || campo === "max" ? { ...r, [campo]: v } : { ...r, v: { ...r.v, [campo]: v } })));
  };
  const onAgregar = (ck) => () => cambiarFilas(ck, (l) => { const ult = l[l.length - 1]; return [...l, { id: nid(), min: ult?.max || "", max: "", v: {} }]; });
  const onQuitar = (ck) => (id) => cambiarFilas(ck, (l) => { const r = l.filter((x) => x.id !== id); return r.length ? r : [{ id: nid(), min: "", max: "", v: {} }]; });
  const onCopiar = (ck) => () => cambiarFilas(ck, () => d.orig.CN[ck].map((r) => ({ id: nid(), min: r.min, max: r.max, v: {} })));
  const vacio = (ck) => !d.orig[o][ck].some((r) => r.min !== "" || r.max !== "" || Object.values(r.v).some((x) => x !== ""));
  const cnTieneRangos = (ck) => d.orig.CN[ck].some((r) => r.min !== "" || r.max !== "");
  const setExtra = (k, v) => { if (!numOk(v)) return; setMsg(null); setD((p) => ({ ...p, extras: { ...p.extras, [k]: v } })); };

  const guardar = async () => {
    setGuardando(true); setMsg(null);
    try {
      const cuerpo = aCuerpo(d);
      const r = await fetch("/api/agente/tarifas", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(agentUserId ? { ...cuerpo, agent_user_id: agentUserId } : cuerpo) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "error");
      const e = aEdicion(j.tarifas); base.current = JSON.stringify(aCuerpo(e)); setD(e);
      setActualizado(j.tarifas?.actualizado || null); setMsg({ ok: true, t: t.guardado }); onSaved?.(j.tarifas);
    } catch { setMsg({ ok: false, t: t.error }); }
    setGuardando(false);
  };

  return (
    <div className="ta2">
      <style>{CSS}</style>
      <Encabezado t={t} actualizado={actualizado} />
      <Origenes o={o} setO={setO} t={t} cuenta={(k) => cuentaEdicion(d, k)} />
      {CARRIERS.map((c) => (
        <PlanillaCourier key={`${o}-${c.k}`} c={c} filas={d.orig[o][c.k]} t={t} editable
          onCampo={onCampo(c.k)} onAgregar={onAgregar(c.k)} onQuitar={onQuitar(c.k)} onCopiar={onCopiar(c.k)}
          puedeCopiar={o === "HK" && vacio(c.k) && cnTieneRangos(c.k)} />
      ))}
      <Adicionales t={t} valores={d.extras} onCampo={setExtra} />
      <div style={{ position: "sticky", bottom: 12, zIndex: 20, marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 12px 10px 18px", borderRadius: 18, background: "var(--isla, rgba(10,22,40,0.86))", backdropFilter: "blur(16px) saturate(1.4)", WebkitBackdropFilter: "blur(16px) saturate(1.4)", border: `1px solid ${sucio ? "rgba(232,208,152,0.5)" : INK(0.1)}`, boxShadow: "0 16px 40px rgba(0,0,0,0.3)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: msg ? (msg.ok ? GREEN : "var(--red, #ff6b6b)") : sucio ? GOLD : INK(0.5) }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: msg ? (msg.ok ? GREEN : "var(--red, #ff6b6b)") : sucio ? GOLD : INK(0.3) }} />
          {msg ? msg.t : sucio ? t.sinGuardar : t.alDia}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {ORIGENES.map((k) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: INK(0.6) }}><Bandera o={k} w={18} />{cuentaEdicion(d, k)}/{SERVICIOS_V2.length}</span>)}
          <button type="button" onClick={guardar} disabled={guardando} style={{ height: 44, padding: "0 28px", borderRadius: 12, border: "1px solid #B8956A", background: "linear-gradient(135deg,#B8956A 0%,#E8D098 50%,#B8956A 100%)", color: "#0A1628", fontWeight: 900, fontSize: 14.5, cursor: guardando ? "wait" : "pointer", fontFamily: "inherit", boxShadow: sucio ? "0 0 22px rgba(232,208,152,0.35)" : "none" }}>{guardando ? t.guardando : t.guardar}</button>
        </span>
      </div>
    </div>
  );
}

// ── Solo lectura (admin → Depósito → Agentes): misma planilla, con el más barato de cada rango ──
export function TarifasAgenteResumen({ tarifas }) {
  const t = TXT.es;
  const tar = useMemo(() => normalizarTarifas(tarifas), [tarifas]);
  const [o, setO] = useState(() => (tar && serviciosCargados(tar, "CN") === 0 && serviciosCargados(tar, "HK") > 0 ? "HK" : "CN"));
  if (!tar) return <p style={{ fontSize: 13.5, color: INK(0.45), margin: 0 }}>Todavía no cargó sus tarifas.</p>;
  const filasDe = (c) => aPlanilla(tar.origenes[o].servicios, keysDe(c)).map((r, i) => ({ ...r, id: `${o}${c.k}${i}` }));
  return (
    <div className="ta2">
      <style>{CSS}</style>
      <Origenes o={o} setO={setO} t={t} cuenta={(k) => serviciosCargados(tar, k)} chico />
      {CARRIERS.map((c) => <PlanillaCourier key={`${o}-${c.k}`} c={c} filas={filasDe(c)} t={t} />)}
      <Adicionales t={t} valores={tar.extras || {}} />
      {tar.actualizado && <p style={{ fontSize: 12, color: INK(0.45), margin: "12px 0 0" }}>{t.actualizado} {fechaCorta(tar.actualizado)}</p>}
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
