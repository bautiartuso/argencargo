"use client";
// Marítimo FCL (29/10/2026): contenedores enteros de una operación de Marítimo A.
// - Solapa "Contenedor" de la op: LCL o FCL; para FCL, subir el BL (se lee solo), los datos de cada
//   contenedor, los hitos del puerto y los días libres para devolver el vacío.
// - FclResumen: la línea compacta que muestra el tablero LCL/FCL.
// El seguimiento automático lo hace /api/cron/maritimo-tracking (las navieras que tienen fuente).
import { useEffect, useState } from "react";
import { dq, SB_URL, SB_KEY } from "../../../lib/sb-client";
import { toast, confirmDialog } from "../../../lib/ui";
import DatePicker from "../../components/DatePicker";
import { NAVIERAS, navieraDe } from "../../../lib/navieras";
import { hoyAR } from "../../../lib/fecha-ar";

const GOLD = "#B8956A", GOLD_LIGHT = "#E8D098";
const useEsCelu = () => { const [c, setC] = useState(false); useEffect(() => { const f = () => setC(window.innerWidth < 760); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []); return c; };
const fd = (d) => { if (!d) return "—"; const [y, m, dd] = String(d).slice(0, 10).split("-"); return `${dd}/${m}/${y.slice(2)}`; };
const diasEntre = (a, b) => Math.round((new Date(String(b).slice(0, 10) + "T12:00:00") - new Date(String(a).slice(0, 10) + "T12:00:00")) / 86400000);
const sumarDias = (d, n) => { const x = new Date(String(d).slice(0, 10) + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
export const TAMANOS = ["20", "40", "40HC", "45HC", "20RF", "40RF"];

// Página de seguimiento de cada naviera (para mirarlo a mano cuando no hay seguimiento automático).
export const linkNaviera = (naviera, num) => {
  const n = encodeURIComponent(num || "");
  switch (navieraDe(naviera)?.n) {
    case "MSC": return `https://www.msc.com/en/track-a-shipment?trackingNumber=${n}&trackingMode=0`;
    case "Maersk": return `https://www.maersk.com/tracking/${n}`;
    case "COSCO": return `https://elines.coscoshipping.com/ebusiness/cargoTracking?trackingType=CONTAINER&number=${n}`;
    case "CMA CGM": return `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference=${n}`;
    case "ZIM": return `https://www.zim.com/tools/track-a-shipment?consnumber=${n}`;
    case "ONE": return `https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?trakNoParam=${n}&trakNoTpCdParam=C`;
    case "Hapag-Lloyd": return `https://www.hapag-lloyd.com/en/online-business/track/track-by-container-solution.html?container=${n}`;
    default: return null;
  }
};
// Hitos del contenedor, en orden. El último cargado define en qué está.
export const HITOS = [
  ["departed_at", "Zarpó"], ["discharged_at", "Llegó a Bs. As."], ["released_at", "Liberado"],
  ["picked_up_at", "Retirado"], ["delivered_at", "Entregado"], ["empty_returned_at", "Vacío devuelto"],
];
export const estadoContenedor = (c) => { let k = -1; HITOS.forEach(([f], i) => { if (c[f]) k = i; }); return k; };
// Días libres para devolver el vacío: corren desde la descarga.
export const vencimientoVacio = (c) => (c.discharged_at && Number(c.free_days) > 0 ? sumarDias(c.discharged_at, Number(c.free_days)) : null);

function LogoNaviera({ n, h = 22 }) {
  const nv = navieraDe(n);
  if (!nv) return <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.55)" }}>{n || "Sin naviera"}</span>;
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: h, padding: nv.sq ? 0 : "0 6px", borderRadius: 5, background: nv.sq ? "transparent" : "#fff", overflow: "hidden" }}>
    <img src={nv.logo} alt={nv.n} style={{ height: nv.sq ? h : h - 8, width: "auto", display: "block" }} />
  </span>;
}

export function FclResumen({ conts }) {
  if (!conts?.length) return null;
  const c = conts[0];
  const k = estadoContenedor(c);
  const venc = vencimientoVacio(c);
  const quedan = venc && !c.empty_returned_at ? diasEntre(hoyAR(), venc) : null;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>
    <LogoNaviera n={c.shipping_line} h={18} />
    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#fff" }}>{c.container_number}</span>
    <span>{conts.length > 1 ? `${conts.length} contenedores` : c.size || ""}</span>
    {k >= 0 && <span style={{ color: "#8CC8F5", fontWeight: 700 }}>{HITOS[k][1]}</span>}
    {quedan != null && <span style={{ fontWeight: 800, color: quedan < 0 ? "#f87171" : quedan <= 3 ? "#fbbf24" : "#4ade80" }}>{quedan < 0 ? `Vacío vencido hace ${-quedan} d` : `Vacío: quedan ${quedan} d`}</span>}
    {c.tracking_last && <span style={{ color: "rgba(255,255,255,0.45)" }}>· {c.tracking_last}</span>}
  </span>;
}

async function leerTextoPdf(file) {
  if (!window.pdfjsLib) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar el lector de PDF")); document.head.appendChild(s); });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let t = "";
  for (let i = 1; i <= Math.min(pdf.numPages, 8); i++) { const pg = await pdf.getPage(i); t += "\n" + (await pg.getTextContent()).items.map((x) => x.str).join(" "); }
  return t;
}

// Campo de texto que guarda al salir (fuera del componente para no perder el foco al escribir).
function CampoFcl({ c, f, l, mono, num, guardar, lbl, inp }) {
  const [v, setV] = useState(c[f] ?? "");
  useEffect(() => { setV(c[f] ?? ""); }, [c[f]]);
  return <div style={{ minWidth: 0 }}>
    <label style={lbl}>{l}</label>
    <input value={v} inputMode={num ? "decimal" : undefined} onChange={(e) => setV(mono ? e.target.value.toUpperCase() : e.target.value)}
      onBlur={() => { const nv = num ? (String(v).trim() === "" ? null : Number(String(v).replace(",", "."))) : String(v).trim(); if ((nv ?? "") !== (c[f] ?? "")) guardar(c, f, nv); }}
      style={{ ...inp, fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit" }} />
  </div>;
}

export default function FclContenedoresTab({ op, setOp, token }) {
  const celu = useEsCelu();
  const [conts, setConts] = useState([]);
  const [lo, setLo] = useState(true);
  const [leyendo, setLeyendo] = useState(false);
  const [rastreando, setRastreando] = useState(null);
  const modo = op.maritime_mode || "lcl";
  const load = async () => {
    const r = await dq("operation_containers", { token, filters: `?operation_id=eq.${op.id}&select=*&order=created_at.asc` });
    setConts(Array.isArray(r) ? r : []); setLo(false);
  };
  useEffect(() => { load(); }, [op.id]);

  const setModo = async (m) => {
    setOp((p) => ({ ...p, maritime_mode: m }));
    await dq("operations", { method: "PATCH", token, filters: `?id=eq.${op.id}`, body: { maritime_mode: m } });
  };
  // Algunas fechas del contenedor alimentan la op: la ETA, el zarpe y el arribo (si la op no las tenía).
  const reflejarEnOp = async (c, campo, v) => {
    const upd = {};
    if (campo === "eta" && v) upd.eta = v;
    if (campo === "departed_at" && v && !op.dispatched_at) upd.dispatched_at = v;
    if (campo === "discharged_at" && v && !op.arrived_in_argentina_at) upd.arrived_in_argentina_at = v;
    if (Object.keys(upd).length) { setOp((p) => ({ ...p, ...upd })); await dq("operations", { method: "PATCH", token, filters: `?id=eq.${op.id}`, body: upd }); }
  };
  const guardar = async (c, campo, v) => {
    const val = v === "" ? null : v;
    setConts((cs) => cs.map((x) => (x.id === c.id ? { ...x, [campo]: val } : x)));
    const r = await dq("operation_containers", { method: "PATCH", token, filters: `?id=eq.${c.id}`, body: { [campo]: val } });
    if (r && !Array.isArray(r) && r.message) { toast("No se guardó: " + r.message, "error"); return; }
    await reflejarEnOp(c, campo, val);
  };
  const agregar = async (datos = {}) => {
    const r = await dq("operation_containers", { method: "POST", token, body: { operation_id: op.id, container_number: datos.container_number || "NUEVO", ...datos }, headers: { Prefer: "return=representation" } });
    if (!Array.isArray(r)) throw new Error(r?.message || "No se pudo agregar el contenedor");
    return r[0];
  };
  const borrar = async (c) => {
    if (!(await confirmDialog(`¿Borrar el contenedor ${c.container_number}?`, { confirmText: "Borrar" }))) return;
    await dq("operation_containers", { method: "DELETE", token, filters: `?id=eq.${c.id}` });
    load();
  };

  // Subir el BL: se guarda el PDF y se leen los datos para crear o completar los contenedores.
  const subirBl = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name || "")) { toast("El BL tiene que ser un PDF", "error"); return; }
    setLeyendo(true);
    try {
      const nombre = `fcl-bl/${op.operation_code}_${Date.now()}.pdf`;
      const up = await fetch(`${SB_URL}/storage/v1/object/package-photos/${nombre}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: SB_KEY, "Content-Type": "application/pdf", "x-upsert": "false" }, body: file });
      const blUrl = up.ok ? `${SB_URL}/storage/v1/object/public/package-photos/${nombre}` : null;
      const texto = await leerTextoPdf(file);
      const r = await fetch("/api/maritimo/leer-bl", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ texto }) }).then((x) => x.json());
      if (!r.ok) throw new Error(r.error || "No se pudo leer el BL");
      const comun = { shipping_line: r.shipping_line, vessel: r.vessel, voyage: r.voyage, mbl: r.mbl, hbl: r.hbl, forwarder: r.forwarder, destination_agent: r.destination_agent, pol: r.pol, pod: r.pod, etd: r.etd, bl_url: blUrl };
      Object.keys(comun).forEach((k) => comun[k] == null && delete comun[k]);
      let n = 0;
      for (const c of r.contenedores || []) {
        const datos = { ...comun, container_number: c.container_number, size: c.size, seal: c.seal, packages: c.packages, gross_kg: c.gross_kg, cbm: c.cbm };
        Object.keys(datos).forEach((k) => datos[k] == null && delete datos[k]);
        const ya = conts.find((x) => x.container_number === c.container_number) || conts.find((x) => x.container_number === "NUEVO");
        if (ya) await dq("operation_containers", { method: "PATCH", token, filters: `?id=eq.${ya.id}`, body: datos });
        else await agregar(datos);
        n++;
      }
      if (!n) throw new Error("El BL no tiene un número de contenedor legible");
      if (modo !== "fcl") await setModo("fcl");
      toast(`BL leído: ${n} contenedor${n !== 1 ? "es" : ""}`, "success");
      await load();
    } catch (e) { toast(e.message, "error"); }
    setLeyendo(false);
  };
  const rastrear = async (c) => {
    setRastreando(c.id);
    try {
      const r = await fetch("/api/cron/maritimo-tracking", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ fcl_id: c.id }) }).then((x) => x.json());
      if (!r.ok) toast(r.error || "No se pudo consultar", "error"); else toast(r.ultimo ? `Último: ${r.ultimo}` : "Consultado, sin movimientos nuevos", "success");
      await load();
    } catch (e) { toast(e.message, "error"); }
    setRastreando(null);
  };

  const lbl = { display: "block", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.42)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.09em" };
  const inp = { width: "100%", height: 38, padding: "0 11px", fontSize: celu ? 16 : 13, fontWeight: 600, boxSizing: "border-box", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, background: "rgba(0,0,0,0.22)", color: "#fff", outline: "none", fontFamily: "inherit" };
  const caja = { padding: celu ? 14 : 18, borderRadius: 14, background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 14 };
  const seg = (ops, val, on) => <div style={{ display: "inline-flex", gap: 3, padding: 3, borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}>{ops.map(([v, l]) => <button key={v} type="button" onClick={() => on(v)} style={{ padding: "7px 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 7, border: "none", cursor: "pointer", background: val === v ? "rgba(184,149,106,0.24)" : "transparent", color: val === v ? GOLD_LIGHT : "rgba(255,255,255,0.6)", fontFamily: "inherit" }}>{l}</button>)}</div>;
  const Desplegable = ({ c, f, l, opciones }) => <div style={{ minWidth: 0 }}>
    <label style={lbl}>{l}</label>
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{opciones.map((o) => { const on = c[f] === o; return <button key={o} type="button" onClick={() => guardar(c, f, on ? null : o)} style={{ height: 30, padding: "0 10px", borderRadius: 8, border: `1px solid ${on ? GOLD : "rgba(255,255,255,0.1)"}`, background: on ? "rgba(184,149,106,0.18)" : "transparent", color: on ? GOLD_LIGHT : "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{o}</button>; })}</div>
  </div>;

  const zonaBl = (txt) => <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 58, padding: "12px 16px", borderRadius: 12, border: "1.5px dashed rgba(232,208,152,0.35)", background: "rgba(184,149,106,0.05)", cursor: leyendo ? "wait" : "pointer", color: GOLD_LIGHT, fontSize: 13.5, fontWeight: 700, textAlign: "center" }}
    onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); subirBl(e.dataTransfer.files?.[0]); }}>
    {leyendo ? "Leyendo el BL…" : txt}
    <input type="file" accept="application/pdf" style={{ display: "none" }} disabled={leyendo} onChange={(e) => { subirBl(e.target.files?.[0]); e.target.value = ""; }} />
  </label>;

  if (lo) return <p style={{ color: "rgba(255,255,255,0.4)", padding: "1.5rem 0", textAlign: "center" }}>Cargando…</p>;
  return <div>
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
      {seg([["lcl", "LCL · carga suelta"], ["fcl", "FCL · contenedor entero"]], modo, setModo)}
    </div>

    {modo === "lcl"
      ? <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>Carga consolidada: se sigue por la ETA de la operación. Si es un contenedor entero, pasala a FCL.</p>
      : <>
        {conts.length === 0
          ? <div style={caja}>{zonaBl("Subí el BL (PDF) y se cargan solos los datos del contenedor")}<div style={{ textAlign: "center", marginTop: 10 }}><button type="button" onClick={async () => { try { await agregar(); load(); } catch (e) { toast(e.message, "error"); } }} style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.55)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>o cargarlo a mano</button></div></div>
          : conts.map((c) => {
            const k = estadoContenedor(c); const venc = vencimientoVacio(c);
            const quedan = venc && !c.empty_returned_at ? diasEntre(hoyAR(), venc) : null;
            const link = linkNaviera(c.shipping_line, c.container_number);
            const auto = ["COSCO"].includes(navieraDe(c.shipping_line)?.n);
            return <div key={c.id} style={caja}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0 }}>
                  <LogoNaviera n={c.shipping_line} h={28} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>{c.container_number}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{[c.size && `Contenedor ${c.size}`, c.seal && `Precinto ${c.seal}`, c.vessel && `${c.vessel}${c.voyage ? ` · ${c.voyage}` : ""}`].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {c.bl_url && <a href={c.bl_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: "#8CC8F5", textDecoration: "none" }}>Ver BL</a>}
                  {link && <a href={link} target="_blank" rel="noreferrer" style={{ height: 32, display: "inline-flex", alignItems: "center", padding: "0 12px", borderRadius: 9, border: "1px solid rgba(140,200,245,0.35)", color: "#8CC8F5", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>Rastrear en {navieraDe(c.shipping_line)?.n} ↗</a>}
                  {auto && <button type="button" onClick={() => rastrear(c)} disabled={rastreando === c.id} style={{ height: 32, padding: "0 12px", borderRadius: 9, border: "1px solid rgba(232,208,152,0.35)", background: "transparent", color: GOLD_LIGHT, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{rastreando === c.id ? "Consultando…" : "Actualizar seguimiento"}</button>}
                </div>
              </div>

              {/* Seguimiento: lo último que informó la naviera (automático) o aviso de que es manual. */}
              <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.18)", marginBottom: 14, fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
                {c.tracking_last
                  ? <>Último movimiento: <b style={{ color: "#fff" }}>{c.tracking_last}</b>{c.eta_naviera && <> · ETA naviera <b style={{ color: "#fff" }}>{fd(c.eta_naviera)}</b></>}<span style={{ color: "rgba(255,255,255,0.4)" }}> · consultado {c.tracking_updated_at ? new Date(c.tracking_updated_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</span></>
                  : auto ? <>Seguimiento automático cada hora. Todavía sin movimientos.</>
                    : <>{navieraDe(c.shipping_line)?.n || "Esta naviera"} no tiene seguimiento automático todavía: miralo con "Rastrear" y cargá las fechas acá abajo.</>}
                {c.tracking_error && <span style={{ color: "#fbbf24" }}> · {c.tracking_error}</span>}
              </div>

              {/* Hitos del contenedor */}
              <div style={{ display: "grid", gridTemplateColumns: celu ? "1fr 1fr" : "repeat(7,minmax(0,1fr))", gap: 10, marginBottom: 14 }}>
                <div style={{ minWidth: 0 }}><label style={{ ...lbl, color: "#8CC8F5" }}>ETA Bs. As.</label><DatePicker small value={c.eta || ""} onChange={(v) => guardar(c, "eta", v || null)} placeholder="—" /></div>
                {HITOS.map(([f, l], i) => <div key={f} style={{ minWidth: 0 }}>
                  <label style={{ ...lbl, color: c[f] ? "#4ade80" : i === k + 1 ? GOLD_LIGHT : lbl.color }}>{c[f] ? "✓ " : ""}{l}</label>
                  <DatePicker small value={c[f] || ""} onChange={(v) => guardar(c, f, v || null)} placeholder="—" />
                </div>)}
              </div>

              {/* Días libres del vacío */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
                <div style={{ width: 130 }}><CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="free_days" l="Días libres" num /></div>
                <p style={{ margin: "14px 0 0", fontSize: 13, fontWeight: 700, color: c.empty_returned_at ? "#4ade80" : quedan == null ? "rgba(255,255,255,0.45)" : quedan < 0 ? "#f87171" : quedan <= 3 ? "#fbbf24" : "#fff" }}>
                  {c.empty_returned_at ? `Vacío devuelto el ${fd(c.empty_returned_at)}${venc ? (c.empty_returned_at > venc ? ` · ${diasEntre(venc, c.empty_returned_at)} d de demora` : " · en término") : ""}`
                    : !c.free_days ? "Cargá los días libres para calcular la devolución del vacío"
                      : !c.discharged_at ? `Los ${c.free_days} días corren desde que llega a Bs. As.`
                        : quedan < 0 ? `Devolución del vacío vencida el ${fd(venc)} (hace ${-quedan} d): corre demora`
                          : `Devolver el vacío antes del ${fd(venc)} · quedan ${quedan} d`}
                </p>
              </div>

              {/* Datos del BL */}
              <div style={{ display: "grid", gridTemplateColumns: celu ? "1fr 1fr" : "repeat(4,minmax(0,1fr))", gap: "12px 12px" }}>
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="container_number" l="Contenedor" mono />
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="seal" l="Precinto" mono />
                <div style={{ gridColumn: celu ? "span 2" : "span 2" }}><Desplegable c={c} f="size" l="Tipo" opciones={TAMANOS} /></div>
                <div style={{ gridColumn: "1 / -1" }}><Desplegable c={c} f="shipping_line" l="Naviera" opciones={NAVIERAS.map((x) => x.n)} /></div>
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="vessel" l="Buque" />
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="voyage" l="Viaje" mono />
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="mbl" l="MBL" mono />
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="hbl" l="HBL" mono />
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="pol" l="Puerto de carga" />
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="pod" l="Puerto de descarga" />
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="forwarder" l="Forwarder" />
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="destination_agent" l="Agente en destino" />
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="packages" l="Bultos" num />
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="gross_kg" l="Peso bruto kg" num />
                <CampoFcl guardar={guardar} lbl={lbl} inp={inp} c={c} f="cbm" l="m³" num />
                <div style={{ minWidth: 0 }}><label style={lbl}>ETD (salida)</label><DatePicker small value={c.etd || ""} onChange={(v) => guardar(c, "etd", v || null)} placeholder="—" /></div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button type="button" onClick={() => borrar(c)} style={{ border: "none", background: "transparent", color: "rgba(255,120,120,0.75)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Borrar contenedor</button>
              </div>
            </div>;
          })}
        {conts.length > 0 && <div style={{ display: "grid", gridTemplateColumns: celu ? "1fr" : "1fr auto", gap: 10, alignItems: "center" }}>
          {zonaBl("Subir otro BL")}
          <button type="button" onClick={async () => { try { await agregar(); load(); } catch (e) { toast(e.message, "error"); } }} style={{ height: 44, padding: "0 16px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Contenedor a mano</button>
        </div>}
      </>}
  </div>;
}
