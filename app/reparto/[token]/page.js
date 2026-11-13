"use client";
// App de los repartidores (13/11/2026) — pensada solo para el teléfono.
// Tres pantallas: Cargar (lo que hay para repartir, por zona), Ruta (paradas en orden, con mapa, hora
// estimada y cobro) y Plata (lo que tiene para rendir y lo que se le debe por kilómetro).
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { comprimirImagen } from "../../../lib/img";

// Los colores salen de variables de tema (claro / oscuro), definidas en <Pantalla>.
const TINTA = "var(--tinta)", GRIS = "var(--gris)", LINEA = "var(--linea)", FONDO = "var(--fondo)", CARTA = "var(--carta)", VERDE = "#16A34A", AMBAR = "var(--ambar)", ROJO = "var(--rojo)";
const FUERTE = "var(--fuerte)", SOBRE = "var(--sobre)", APAGADO = "var(--apagado)"; // botón oscuro (claro en modo oscuro) y su texto
const OK = { background: "var(--ok-f)", color: "var(--ok-t)" }, AVISO = { background: "var(--av-f)", color: "var(--av-t)" }, MAL = { background: "var(--mal-f)", color: "var(--mal-t)" };
const ZONAS = { CABA: "#2563EB", Norte: "#0D9488", Oeste: "#D97706", Sur: "#DB2777" };
const colorZona = (z) => ZONAS[z] || "#6B7280";
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MOTIVOS = [["no_estaba", "No había nadie"], ["direccion", "La dirección está mal"], ["rechazo", "No lo quiso recibir"], ["sin_pago", "No tenía el pago"], ["otro", "Otro motivo"]];

const plata = (n, dec = 0) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const usd = (n) => `USD ${plata(n, Number(n) % 1 ? 2 : 0)}`;
const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.round(min) % 60).padStart(2, "0")}`;
const franjaCorta = (f) => String(f || "").replace(/:00/g, "").replace(/\b0(\d)/g, "$1");
const inicioFranja = (f) => { const m = String(f || "").match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const finFranja = (f) => { const m = String(f || "").match(/a\s*(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const soloNumeros = (t) => String(t || "").replace(/\D/g, "");
const diaTxt = (iso, hoy) => {
  if (!iso) return "Sin día";
  const d = new Date(`${iso}T12:00:00`), h = new Date(`${hoy}T12:00:00`), dif = Math.round((d - h) / 86400000);
  const f = `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  return dif === 0 ? `Hoy · ${f}` : dif === 1 ? `Mañana · ${f}` : dif < 0 ? `Atrasado · ${f}` : f.charAt(0).toUpperCase() + f.slice(1);
};
const metodoTxt = (m) => (m === "transferencia" ? "transferencia" : m === "crypto" || m === "cripto" ? "cripto" : m === "efectivo" ? "efectivo" : "");

// ── Íconos (trazo) ──
const Ic = ({ d, s = 20, w = 2 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{[].concat(d).map((p, i) => <path key={i} d={p} />)}</svg>;
const I = {
  caja: ["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z", "M3.3 7L12 12l8.7-5", "M12 22V12"],
  ruta: ["M9 20l-5.5-3V4L9 7m0 13l6-3m-6 3V7m6 10l5.5 3V7L15 4m0 13V4M9 7l6-3"],
  plata: ["M12 2v20", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
  mapa: ["M12 21s7-5.7 7-11.5A7 7 0 0 0 5 9.500C5 15.3 12 21 12 21z", "M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  tel: ["M22 16.900v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.600-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.700c.100 1 .400 1.900.7 2.800a2 2 0 0 1-.500 2.100L8.1 9.900a16 16 0 0 0 6 6l1.300-1.300a2 2 0 0 1 2.100-.400c.900.3 1.800.6 2.800.700a2 2 0 0 1 1.7 2z"],
  chat: ["M21 11.500a8.4 8.4 0 0 1-.900 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.800-.900L3 21l1.900-5.700a8.4 8.4 0 0 1-.900-3.8 8.5 8.5 0 0 1 4.700-7.6 8.4 8.4 0 0 1 3.800-.900h.500a8.5 8.5 0 0 1 8 8z"],
  ok: ["M20 6L9 17l-5-5"],
  arriba: ["M18 15l-6-6-6 6"],
  abajo: ["M6 9l6 6 6-6"],
  x: ["M18 6L6 18", "M6 6l12 12"],
  mas: ["M12 5v14", "M5 12h14"],
  orden: ["M3 6h13", "M3 12h9", "M3 18h5", "M17 10v10", "M21 16l-4 4-4-4"],
  reloj: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
  camara: ["M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  sol: ["M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "M12 1v2", "M12 21v2", "M4.2 4.2l1.4 1.4", "M18.4 18.4l1.4 1.4", "M1 12h2", "M21 12h2", "M4.2 19.8l1.4-1.4", "M18.4 5.6l1.4-1.4"],
  luna: ["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"],
  enviar: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"],
};

// ── Mapa (Leaflet, cargado desde el CDN solo en esta pantalla) ──
let leafletListo = null;
function cargarLeaflet() {
  if (typeof window === "undefined") return Promise.reject();
  if (window.L) return Promise.resolve(window.L);
  if (leafletListo) return leafletListo;
  leafletListo = new Promise((ok, mal) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = () => ok(window.L); js.onerror = () => { leafletListo = null; mal(); };
    document.head.appendChild(js);
  });
  return leafletListo;
}

// puntos: [{ id, lat, lng, texto, color, apagado }]  ·  linea: [[lat,lng]…]  ·  oficina: {lat,lng}
function Mapa({ puntos, linea, oficina, alto = 230, onTocar }) {
  const caja = useRef(null), mapa = useRef(null), capa = useRef(null);
  const [falla, setFalla] = useState(false);
  const firma = JSON.stringify([puntos.map((p) => [p.id, p.lat, p.lng, p.texto, p.color, p.apagado]), linea?.length, oficina?.lat]);
  useEffect(() => {
    let vivo = true;
    cargarLeaflet().then((L) => {
      if (!vivo || !caja.current) return;
      if (!mapa.current) {
        // En el teléfono el mapa queda quieto: arrastrar el dedo encima tiene que bajar la pantalla, no mover el
        // mapa. Se acerca y se aleja con los botones + y −.
        const tactil = window.matchMedia?.("(pointer: coarse)").matches;
        mapa.current = L.map(caja.current, { zoomControl: true, attributionControl: true, dragging: !tactil, touchZoom: !tactil, doubleClickZoom: !tactil, scrollWheelZoom: false, boxZoom: false, keyboard: false }).setView([oficina?.lat ?? -34.6, oficina?.lng ?? -58.44], 11);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(mapa.current);
        capa.current = L.layerGroup().addTo(mapa.current);
      }
      capa.current.clearLayers();
      const limites = [];
      if (linea?.length > 1) L.polyline(linea, { color: "#2563EB", weight: 4.5, opacity: 0.8 }).addTo(capa.current);
      if (oficina?.lat != null) {
        L.marker([oficina.lat, oficina.lng], { icon: L.divIcon({ className: "", html: `<div style="width:26px;height:26px;border-radius:8px;background:#111827;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:800 11px system-ui">OF</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(capa.current);
        limites.push([oficina.lat, oficina.lng]);
      }
      for (const p of puntos) {
        if (p.lat == null || p.lng == null) continue;
        const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: `<div style="min-width:30px;height:30px;padding:0 6px;box-sizing:border-box;border-radius:15px;background:${p.apagado ? "#9CA3AF" : p.color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font:800 13px system-ui">${p.texto}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(capa.current);
        if (onTocar) m.on("click", () => onTocar(p.id));
        limites.push([p.lat, p.lng]);
      }
      if (limites.length > 1) mapa.current.fitBounds(limites, { padding: [34, 34], maxZoom: 15 });
      else if (limites.length === 1) mapa.current.setView(limites[0], 13);
      setTimeout(() => mapa.current && mapa.current.invalidateSize(), 60);
    }).catch(() => vivo && setFalla(true));
    return () => { vivo = false; };
  }, [firma]);
  useEffect(() => () => { if (mapa.current) { mapa.current.remove(); mapa.current = null; } }, []);
  if (falla) return null;
  return <div ref={caja} style={{ height: alto, borderRadius: 16, overflow: "hidden", background: LINEA, border: `1px solid ${LINEA}`, zIndex: 0, position: "relative" }} />;
}

// ── Piezas ──
const Marca = ({ base, codigo }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: GRIS, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", padding: "2px 5px", borderRadius: 5, background: base === "mybox" ? "#0F3D4C" : "#0F1E3D", color: base === "mybox" ? "#8BEA3A" : "#E8D098" }}>{base === "mybox" ? "MYBOX" : "ARGENCARGO"}</span>
    {codigo}
  </span>
);

function Cobro({ d }) {
  if (d.pagado) return <span className="rp-pill" style={OK}><Ic d={I.ok} s={14} w={3} />Ya está pago</span>;
  const m = metodoTxt(d.metodo);
  // Si transfiere, el repartidor no le cobra nada.
  if (m === "transferencia" || m === "cripto") return <span className="rp-pill" style={{ background: FONDO, color: TINTA }}>{usd(d.saldo)} · paga por {m}</span>;
  return <span className="rp-pill" style={AVISO}>Cobrar {usd(d.saldo)}</span>;
}

function Hoja({ titulo, onCerrar, children }) {
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, []);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,0.55)", display: "flex", alignItems: "flex-end" }} onClick={onCerrar}>
      <div className="rp-hoja" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "92dvh", overflowY: "auto", background: CARTA, borderRadius: "22px 22px 0 0", padding: "10px 18px calc(20px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: "var(--linea2)", margin: "0 auto 12px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TINTA, lineHeight: 1.2 }}>{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="rp-tocar" style={{ width: 40, height: 40, borderRadius: 20, border: "none", background: FONDO, color: GRIS, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic d={I.x} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Hoja "Entregado" ──
// El repartidor solo cobra efectivo: carga cuánto recibió en dólares y/o en pesos, o marca que no cobró
// nada. Si el cliente paga por transferencia no hay nada que cobrarle (arranca en "No cobré nada").
// La foto de la entrega queda como comprobante.
function HojaEntregar({ parada, onCerrar, onGuardar, ocupado }) {
  const d = parada.datos;
  const transfiere = !d.pagado && ["transferencia", "crypto", "cripto"].includes(d.metodo);
  const [usdTxt, setUsdTxt] = useState("");
  const [arsTxt, setArsTxt] = useState("");
  const [nada, setNada] = useState(transfiere);
  const [nota, setNota] = useState("");
  const [foto, setFoto] = useState(null); // { vista, base64 }
  const [leyendo, setLeyendo] = useState(false);
  const archivo = useRef(null);
  const num = (t) => Number(String(t).replace(/\./g, "").replace(",", ".")) || 0;
  const nUsd = num(usdTxt), nArs = num(arsTxt);
  const cobros = d.pagado || nada ? [] : [nUsd > 0 && { monto: nUsd, moneda: "USD", metodo: "efectivo" }, nArs > 0 && { monto: nArs, moneda: "ARS", metodo: "efectivo" }].filter(Boolean);
  const puede = d.pagado || nada || cobros.length > 0;
  const deMas = !d.pagado && !nada && nUsd > Number(d.saldo || 0) + Math.max(20, Number(d.saldo || 0) * 0.2);
  const elegirFoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setLeyendo(true);
    try {
      const chica = await comprimirImagen(f, { maxLado: 1280, calidad: 0.72 });
      const url = await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = mal; r.readAsDataURL(chica); });
      setFoto({ vista: url, base64: url.slice(url.indexOf(",") + 1) });
    } catch { setFoto(null); }
    setLeyendo(false);
  };
  const campo = (rotulo, signo, valor, set) => (
    <label style={{ display: "flex", alignItems: "center", gap: 12, height: 62, padding: "0 16px", marginBottom: 10, border: `1.5px solid ${LINEA}`, borderRadius: 14, background: "var(--campo)" }}>
      <span style={{ width: 70, flexShrink: 0, fontSize: 15, fontWeight: 700, color: GRIS }}>{rotulo}</span>
      <span style={{ fontSize: 20, fontWeight: 800, color: GRIS }}>{signo}</span>
      <input value={valor} onChange={(e) => { set(e.target.value.replace(/[^\d.,]/g, "")); setNada(false); }} inputMode="decimal" placeholder="0" aria-label={`Cobrado en ${rotulo.toLowerCase()}`} style={{ flex: 1, minWidth: 0, height: 56, fontSize: 24, fontWeight: 800, border: "none", outline: "none", background: "transparent", color: TINTA, fontFamily: "inherit", fontVariantNumeric: "tabular-nums", textAlign: "right" }} />
    </label>
  );
  return (
    <Hoja titulo={`Entregar a ${d.cliente}`} onCerrar={onCerrar}>
      {d.pagado ? (
        <div style={{ padding: "14px 16px", borderRadius: 14, ...OK, fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Ya está pago. No hay que cobrar nada.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: GRIS, fontWeight: 700 }}>{transfiere ? "Paga por transferencia" : "Debe"}</span>
            <span style={{ fontSize: 26, fontWeight: 800, color: TINTA, fontVariantNumeric: "tabular-nums" }}>{usd(d.saldo)}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: GRIS, margin: "0 2px 8px" }}>¿Cuánto pagó?</div>
          <div style={{ opacity: nada ? 0.45 : 1 }}>
            {campo("Dólares", "USD", usdTxt, setUsdTxt)}
            {campo("Pesos", "$", arsTxt, setArsTxt)}
          </div>
          <button onClick={() => setNada((v) => !v)} aria-pressed={nada} className="rp-tocar" style={{ width: "100%", height: 52, marginBottom: 14, borderRadius: 14, border: `1.5px solid ${nada ? FUERTE : LINEA}`, background: nada ? FUERTE : CARTA, color: nada ? SOBRE : TINTA, fontSize: 16, fontWeight: 800, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{nada && <Ic d={I.ok} s={18} w={3} />}No cobré nada</button>
        </>
      )}
      {deMas && <div role="alert" style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, ...MAL, fontSize: 14.5, fontWeight: 700 }}>Es más de lo que debe. Revisá el monto antes de confirmar.</div>}
      <input ref={archivo} type="file" accept="image/*" capture="environment" onChange={elegirFoto} style={{ display: "none" }} tabIndex={-1} aria-hidden="true" />
      {foto ? (
        <div style={{ position: "relative", marginBottom: 12, borderRadius: 14, overflow: "hidden", border: `1.5px solid ${LINEA}` }}>
          <img src={foto.vista} alt="Foto de la entrega" style={{ display: "block", width: "100%", maxHeight: 190, objectFit: "cover" }} />
          <button onClick={() => archivo.current?.click()} className="rp-tocar" style={{ position: "absolute", right: 10, bottom: 10, height: 40, padding: "0 14px", borderRadius: 12, border: "none", background: "rgba(17,24,39,.8)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}>Sacar otra</button>
        </div>
      ) : (
        <button onClick={() => archivo.current?.click()} disabled={leyendo} className="rp-tocar" style={{ width: "100%", height: 54, marginBottom: 12, borderRadius: 14, border: `1.5px dashed var(--linea2)`, background: "transparent", color: TINTA, fontSize: 16, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Ic d={I.camara} s={20} />{leyendo ? "Preparando la foto…" : "Foto de la entrega"}</button>
      )}
      <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota para la oficina" aria-label="Nota para la oficina" style={{ width: "100%", height: 48, padding: "0 14px", fontSize: 16, border: `1.5px solid ${LINEA}`, borderRadius: 12, outline: "none", background: "var(--campo)", color: TINTA, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />
      <button disabled={!puede || ocupado || leyendo} onClick={() => onGuardar({ cobros, nota, foto: foto?.base64 || null })} className="rp-tocar" style={{ width: "100%", height: 58, borderRadius: 16, border: "none", background: puede ? VERDE : APAGADO, color: "#fff", fontSize: 18, fontWeight: 800, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Ic d={I.ok} w={3} />{ocupado ? "Guardando…" : "Confirmar entrega"}</button>
    </Hoja>
  );
}

// ── Hoja "No pude entregar" ──
function HojaNoPude({ parada, onCerrar, onGuardar, onQuitar, ocupado }) {
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  return (
    <Hoja titulo={`No pude entregar a ${parada.datos.cliente}`} onCerrar={onCerrar}>
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {MOTIVOS.map(([k, l]) => <button key={k} onClick={() => setMotivo(k)} className="rp-tocar" style={{ height: 52, padding: "0 16px", textAlign: "left", borderRadius: 14, border: `1.5px solid ${motivo === k ? FUERTE : LINEA}`, background: motivo === k ? FUERTE : CARTA, color: motivo === k ? SOBRE : TINTA, fontSize: 16, fontWeight: 700, fontFamily: "inherit" }}>{l}</button>)}
      </div>
      <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota para la oficina" aria-label="Nota para la oficina" style={{ width: "100%", height: 48, padding: "0 14px", fontSize: 16, border: `1.5px solid ${LINEA}`, borderRadius: 12, outline: "none", background: "var(--campo)", color: TINTA, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />
      <button disabled={!motivo || ocupado} onClick={() => onGuardar({ motivo, nota })} className="rp-tocar" style={{ width: "100%", height: 56, borderRadius: 16, border: "none", background: motivo ? FUERTE : APAGADO, color: motivo ? SOBRE : "#fff", fontSize: 17, fontWeight: 800, fontFamily: "inherit", marginBottom: 10 }}>{ocupado ? "Guardando…" : "Guardar"}</button>
      <button disabled={ocupado} onClick={onQuitar} className="rp-tocar" style={{ width: "100%", height: 48, borderRadius: 14, border: "none", background: "transparent", color: GRIS, fontSize: 15, fontWeight: 700, fontFamily: "inherit" }}>No lo cargué: sacarlo de mi ruta</button>
    </Hoja>
  );
}

export default function Reparto({ params }) {
  const { token } = params;
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("cargar");
  const [sel, setSel] = useState(() => new Set());
  const [zona, setZona] = useState(null);
  const [hoja, setHoja] = useState(null); // { tipo: "entregar" | "nopude" | "cierre", parada | cierre }
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [reloj, setReloj] = useState(() => Date.now());
  const primera = useRef(true);
  // Claro u oscuro: lo elige el repartidor y queda guardado en su teléfono (si nunca eligió, sigue al sistema).
  const [tema, setTema] = useState("claro");
  useEffect(() => {
    let t = null;
    try { t = localStorage.getItem("reparto-tema"); } catch {}
    if (t !== "claro" && t !== "oscuro") t = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
    setTema(t);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.rpTema = tema;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", tema === "oscuro" ? "#0B1220" : "#F3F4F6");
  }, [tema]);
  const cambiarTema = () => setTema((t) => { const n = t === "oscuro" ? "claro" : "oscuro"; try { localStorage.setItem("reparto-tema", n); } catch {} return n; });

  const traer = useCallback(async () => {
    try {
      const r = await fetch(`/api/reparto/${token}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) { setError(j.error === "link_invalido" ? "Este link ya no sirve. Pedile uno nuevo a la oficina." : "No se pudo cargar"); return; }
      setError(""); setD(j);
      if (primera.current) { primera.current = false; if (j.viaje?.paradas?.length) setTab("ruta"); }
    } catch { if (!d) setError("Sin conexión. Probá de nuevo."); }
  }, [token]);

  useEffect(() => {
    traer();
    const t = setInterval(() => { setReloj(Date.now()); if (document.visibilityState === "visible") traer(); }, 60000);
    const alVolver = () => { if (document.visibilityState === "visible") traer(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", alVolver); };
  }, [traer]);

  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(""), 3200); };
  const accion = async (cuerpo) => {
    setOcupado(true);
    try {
      const r = await fetch(`/api/reparto/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const j = await r.json();
      if (!r.ok) { avisar(j.error || "No se pudo"); return null; }
      setD(j);
      if (j.aviso) avisar(j.aviso);
      return j;
    } catch { avisar("Sin conexión"); return null; } finally { setOcupado(false); }
  };

  const paradas = d?.viaje?.paradas || [];
  const faltan = paradas.filter((p) => p.estado === "cargado");
  const hechas = paradas.filter((p) => p.estado !== "cargado");

  // Hora estimada de llegada a cada parada que falta: sale ahora, suma el viaje de cada tramo y unos
  // minutos por entrega; si llega antes de que abra la franja del cliente, espera.
  const llegadas = useMemo(() => {
    const ahora = new Date(reloj);
    let t = ahora.getHours() * 60 + ahora.getMinutes();
    const m = {};
    for (const p of faltan) {
      const tr = d?.viaje?.ruta?.llegada?.[p.id];
      t += tr ? tr.s / 60 : 15;
      const ini = inicioFranja(p.datos.franja);
      if (ini != null && t < ini) t = ini;
      m[p.id] = t;
      t += 8;
    }
    return m;
  }, [d, reloj]);

  if (error && !d) return <Pantalla><div style={{ padding: "30vh 28px 0", textAlign: "center", fontSize: 17, fontWeight: 700, color: TINTA, lineHeight: 1.4 }}>{error}<div><button onClick={traer} className="rp-tocar" style={{ marginTop: 18, height: 50, padding: "0 26px", borderRadius: 14, border: "none", background: FUERTE, color: SOBRE, fontSize: 16, fontWeight: 800, fontFamily: "inherit" }}>Reintentar</button></div></div></Pantalla>;
  if (!d) return <Pantalla><div style={{ padding: "22px 16px" }}>{[0, 1, 2, 3].map((i) => <div key={i} className="rp-late" style={{ height: i ? 92 : 200, borderRadius: 16, background: LINEA, marginBottom: 12 }} />)}</div></Pantalla>;

  const pend = d.pendientes || [];
  const zonasHay = [...new Set(pend.map((e) => e.zona || "Sin ubicar"))];
  const pendVista = zona ? pend.filter((e) => (e.zona || "Sin ubicar") === zona) : pend;
  const porDia = {};
  for (const e of pendVista) (porDia[e.dia || ""] = porDia[e.dia || ""] || []).push(e);
  const dias = Object.keys(porDia).sort((a, b) => (a || "9999").localeCompare(b || "9999"));
  const clave = (e) => `${e.base}:${e.id}`;
  const tildar = (e) => setSel((s) => { const n = new Set(s); n.has(clave(e)) ? n.delete(clave(e)) : n.add(clave(e)); return n; });
  const elegidos = pend.filter((e) => sel.has(clave(e)));

  const cargar = async () => {
    const j = await accion({ accion: "cargar", items: elegidos.map((e) => ({ base: e.base, id: e.id })) });
    if (j) { setSel(new Set()); setTab("ruta"); window.scrollTo(0, 0); }
  };
  const kmRuta = (d.viaje?.ruta?.metros || 0) / 1000;
  const ultimaLlegada = faltan.length ? llegadas[faltan[faltan.length - 1].id] : null;
  const irAParada = (id) => { const el = document.getElementById(`parada-${id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); };

  return (
    <Pantalla>
      <header style={{ padding: "calc(14px + env(safe-area-inset-top)) 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: GRIS }}>{diaTxt(d.hoy, d.hoy).replace("Hoy · ", "")}</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: TINTA, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Hola, {d.repartidor.nombre}</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {d.repartidor.prueba && <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", padding: "5px 9px", borderRadius: 8, ...AVISO }}>PRUEBA</span>}
          <button onClick={cambiarTema} aria-label={tema === "oscuro" ? "Pasar a modo claro" : "Pasar a modo oscuro"} className="rp-tocar" style={{ width: 44, height: 44, borderRadius: 22, border: `1.5px solid ${LINEA}`, background: CARTA, color: TINTA, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic d={tema === "oscuro" ? I.sol : I.luna} s={20} /></button>
        </div>
      </header>

      <main style={{ padding: "4px 14px calc(150px + env(safe-area-inset-bottom))" }}>
        {tab === "cargar" && (
          <>
            {pend.length === 0 ? (
              <Vacio titulo="No hay envíos para cargar" sub="Cuando un cliente coordine un envío a domicilio aparece acá." />
            ) : (
              <>
                <Mapa alto={210} oficina={d.oficina} puntos={pendVista.map((e) => ({ id: clave(e), lat: e.lat, lng: e.lng, texto: sel.has(clave(e)) ? "✓" : "", color: colorZona(e.zona) }))} onTocar={(id) => { const e = pend.find((x) => clave(x) === id); if (e) tildar(e); }} />
                {zonasHay.length > 1 && (
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 2px 2px", margin: "0 -2px" }} className="rp-sinbarra">
                    <button onClick={() => setZona(null)} className="rp-tocar rp-chip" style={{ background: !zona ? FUERTE : CARTA, color: !zona ? SOBRE : TINTA, borderColor: !zona ? FUERTE : LINEA }}>Todas {pend.length}</button>
                    {zonasHay.map((z) => <button key={z} onClick={() => setZona(zona === z ? null : z)} className="rp-tocar rp-chip" style={{ background: zona === z ? colorZona(z) : CARTA, color: zona === z ? "#fff" : TINTA, borderColor: zona === z ? colorZona(z) : LINEA }}><span style={{ width: 9, height: 9, borderRadius: 5, background: zona === z ? "#fff" : colorZona(z), display: "inline-block" }} />{z} {pend.filter((e) => (e.zona || "Sin ubicar") === z).length}</button>)}
                  </div>
                )}
                {dias.map((dia) => (
                  <section key={dia || "sin"}>
                    <h3 style={{ margin: "18px 4px 8px", fontSize: 13, fontWeight: 800, color: dia && dia < d.hoy ? ROJO : GRIS, letterSpacing: "0.02em" }}>{diaTxt(dia, d.hoy)}</h3>
                    {porDia[dia].sort((a, b) => (inicioFranja(a.franja) ?? 9999) - (inicioFranja(b.franja) ?? 9999)).map((e) => {
                      const on = sel.has(clave(e));
                      return (
                        <button key={clave(e)} onClick={() => tildar(e)} aria-pressed={on} className="rp-tocar" style={{ width: "100%", textAlign: "left", display: "flex", gap: 12, alignItems: "flex-start", padding: 14, marginBottom: 10, borderRadius: 16, border: `2px solid ${on ? VERDE : "transparent"}`, background: CARTA, boxShadow: "var(--sombra)", fontFamily: "inherit", color: TINTA }}>
                          <span style={{ width: 30, height: 30, borderRadius: 15, flexShrink: 0, marginTop: 2, border: `2px solid ${on ? VERDE : "var(--linea2)"}`, background: on ? VERDE : CARTA, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{on && <Ic d={I.ok} s={17} w={3.2} />}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "6px 8px", alignItems: "center", marginBottom: 8 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 17, fontWeight: 800, color: TINTA, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}><Ic d={I.reloj} s={17} w={2.4} />{e.franja ? `${franjaCorta(e.franja)} hs` : "Sin horario"}</span>
                              <Cobro d={e} />
                            </span>
                            <span style={{ display: "block", fontSize: 16.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.cliente}</span>
                            <span style={{ display: "block", fontSize: 14.5, color: "var(--tinta2)", margin: "3px 0 8px", lineHeight: 1.35 }}>{e.calle}{e.localidad ? ` · ${e.localidad}` : ""}</span>
                            <span style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", alignItems: "center" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: colorZona(e.zona) }}><span style={{ width: 9, height: 9, borderRadius: 5, background: colorZona(e.zona) }} />{e.zona || "Sin ubicar"}</span>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: GRIS }}>{e.bultos} {e.bultos === 1 ? "bulto" : "bultos"}{e.kg ? ` · ${plata(e.kg, e.kg % 1 ? 1 : 0)} kg` : ""}</span>
                              <Marca base={e.base} codigo={e.codigo} />
                            </span>
                            {e.intento && <span style={{ display: "block", marginTop: 8, fontSize: 13, fontWeight: 700, color: AMBAR }}>Ya se intentó: {e.intento.motivo}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </section>
                ))}
              </>
            )}
          </>
        )}

        {tab === "ruta" && (
          <>
            {paradas.length === 0 ? (
              <Vacio titulo="Todavía no cargaste nada" sub="Marcá lo que subiste al auto y te armo la ruta." boton="Ver qué hay para cargar" onBoton={() => setTab("cargar")} />
            ) : (
              <>
                <Mapa alto={230} oficina={d.oficina} linea={d.viaje.ruta?.dibujo} puntos={paradas.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, texto: p.estado === "cargado" ? String(faltan.indexOf(p) + 1) : p.estado === "entregado" ? "✓" : "✕", color: colorZona(p.datos.zona), apagado: p.estado !== "cargado" }))} onTocar={irAParada} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "12px 4px 12px" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: TINTA, fontVariantNumeric: "tabular-nums" }}>
                    {faltan.length ? `${faltan.length} ${faltan.length === 1 ? "parada" : "paradas"}` : "Todo entregado"}{kmRuta > 0 ? ` · ${plata(kmRuta, 1)} km` : ""}{ultimaLlegada != null ? ` · terminás ≈ ${hhmm(ultimaLlegada)}` : ""}
                  </div>
                  {faltan.length > 1 && <button disabled={ocupado} onClick={() => accion({ accion: "ordenar" })} className="rp-tocar rp-chip" style={{ background: CARTA, color: TINTA, borderColor: LINEA }}><Ic d={I.orden} s={15} />Ordenar</button>}
                </div>

                {faltan.map((p, i) => {
                  const x = p.datos, eta = llegadas[p.id], fin = finFranja(x.franja), tarde = fin != null && eta > fin;
                  const tel = soloNumeros(x.telefono);
                  const destino = encodeURIComponent([x.calle, x.localidad, "Buenos Aires"].filter(Boolean).join(", "));
                  return (
                    <article key={p.id} id={`parada-${p.id}`} style={{ background: CARTA, borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: "var(--sombra)", border: i === 0 ? `2px solid ${TINTA}` : "2px solid transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <span style={{ width: 40, height: 40, borderRadius: 20, background: colorZona(x.zona), color: "#fff", fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: tarde ? ROJO : TINTA, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>≈ {hhmm(eta)}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: tarde ? ROJO : GRIS }}>{x.franja ? `Lo esperan de ${franjaCorta(x.franja)}` : "Sin horario"}{x.dia && x.dia !== d.hoy ? ` · ${diaTxt(x.dia, d.hoy).split(" · ")[0].toLowerCase()}` : ""}</div>
                        </div>
                        {faltan.length > 1 && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button disabled={ocupado || i === 0} onClick={() => accion({ accion: "mover", parada_id: p.id, hacia: "arriba" })} aria-label="Subir en la ruta" className="rp-tocar rp-flecha" style={{ opacity: i === 0 ? 0.3 : 1 }}><Ic d={I.arriba} /></button>
                            <button disabled={ocupado || i === faltan.length - 1} onClick={() => accion({ accion: "mover", parada_id: p.id, hacia: "abajo" })} aria-label="Bajar en la ruta" className="rp-tocar rp-flecha" style={{ opacity: i === faltan.length - 1 ? 0.3 : 1 }}><Ic d={I.abajo} /></button>
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                        <div style={{ fontSize: 19, fontWeight: 800, color: TINTA, lineHeight: 1.2 }}>{x.cliente}</div>
                        <Marca base={p.base} codigo={p.codigo} />
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 600, color: TINTA, marginTop: 6, lineHeight: 1.3 }}>{x.calle}{x.piso ? <span style={{ color: GRIS, fontWeight: 600 }}> · {x.piso}</span> : null}</div>
                      <div style={{ fontSize: 14.5, color: GRIS, fontWeight: 600, marginTop: 2 }}>{[x.localidad, x.cp ? `CP ${x.cp}` : ""].filter(Boolean).join(" · ")}{p.lat == null ? " · sin ubicar en el mapa" : ""}</div>
                      {x.notas && <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: FONDO, fontSize: 15, fontWeight: 600, color: TINTA, lineHeight: 1.35 }}>{x.notas}</div>}

                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "12px 0" }}>
                        <Cobro d={x} />
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: GRIS }}>{x.bultos} {x.bultos === 1 ? "bulto" : "bultos"}{x.kg ? ` · ${plata(x.kg, x.kg % 1 ? 1 : 0)} kg` : ""}</span>
                      </div>
                      {!x.pagado && x.llega_con && <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 700, color: AMBAR }}>Paga con {x.llega_con.moneda === "ARS" ? "$" : "USD"} {plata(x.llega_con.monto)}: llevá cambio</div>}
                      {p.cambio && <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, ...MAL, fontSize: 14.5, fontWeight: 700 }}>La oficina cambió este envío. Consultá antes de entregarlo.</div>}

                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${destino}`} target="_blank" rel="noreferrer" className="rp-tocar rp-link"><Ic d={I.mapa} s={21} /><span>Cómo llegar</span></a>
                        {tel && <a href={`tel:+${tel}`} className="rp-tocar rp-link"><Ic d={I.tel} s={21} /><span>Llamar</span></a>}
                        {tel && <a href={`https://wa.me/${tel}?text=${encodeURIComponent(`¡Hola ${String(x.cliente || "").split(" ")[0]}! Soy ${d.repartidor.nombre}, de ${p.base === "mybox" ? "MyBox" : "Argencargo"}. Estoy yendo para tu domicilio con tu pedido${eta != null ? `, llego aproximadamente a las ${hhmm(eta)}` : ""}.`)}`} target="_blank" rel="noreferrer" className="rp-tocar rp-link"><Ic d={I.enviar} s={21} /><span>Avisar que voy</span></a>}
                      </div>
                      <button disabled={ocupado} onClick={() => setHoja({ tipo: "entregar", parada: p })} className="rp-tocar" style={{ width: "100%", height: 56, borderRadius: 15, border: "none", background: VERDE, color: "#fff", fontSize: 18, fontWeight: 800, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Ic d={I.ok} w={3} />Entregado</button>
                      <button disabled={ocupado} onClick={() => setHoja({ tipo: "nopude", parada: p })} className="rp-tocar" style={{ width: "100%", height: 46, marginTop: 6, borderRadius: 14, border: "none", background: "transparent", color: GRIS, fontSize: 15, fontWeight: 700, fontFamily: "inherit" }}>No pude entregar</button>
                    </article>
                  );
                })}

                {faltan.length === 0 && (
                  <button disabled={ocupado} onClick={async () => { const j = await accion({ accion: "terminar" }); if (j?.cierre) { setHoja({ tipo: "cierre", cierre: j.cierre }); setTab("plata"); } }} className="rp-tocar" style={{ width: "100%", height: 60, borderRadius: 16, border: "none", background: FUERTE, color: SOBRE, fontSize: 18, fontWeight: 800, fontFamily: "inherit", marginBottom: 14 }}>{ocupado ? "Cerrando…" : "Terminar viaje"}</button>
                )}

                {hechas.length > 0 && <h3 style={{ margin: "18px 4px 8px", fontSize: 13, fontWeight: 800, color: GRIS }}>Hechas</h3>}
                {hechas.map((p) => (
                  <div key={p.id} id={`parada-${p.id}`} style={{ display: "flex", gap: 12, alignItems: "center", background: CARTA, borderRadius: 14, padding: "12px 14px", marginBottom: 8, opacity: 0.85 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 15, flexShrink: 0, ...(p.estado === "entregado" ? OK : MAL), display: "flex", alignItems: "center", justifyContent: "center" }}><Ic d={p.estado === "entregado" ? I.ok : I.x} s={16} w={3} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: TINTA, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.datos.cliente}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: GRIS }}>{p.estado === "entregado" ? (p.cobros?.length ? `Cobraste ${p.cobros.map((c) => `${c.moneda === "ARS" ? "$" : "USD"} ${plata(c.monto, c.monto % 1 ? 2 : 0)}`).join(" + ")}` : p.datos.pagado ? "Ya estaba pago" : "Sin cobrar") : `No entregado: ${(MOTIVOS.find((m) => m[0] === p.motivo) || [0, "otro motivo"])[1].toLowerCase()}`}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: GRIS, fontVariantNumeric: "tabular-nums" }}>{p.resuelto_at ? new Date(p.resuelto_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : ""}</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {tab === "plata" && (
          <>
            <div style={{ background: FUERTE, color: SOBRE, borderRadius: 18, padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}>Efectivo para rendir en la oficina</div>
              {d.plata.rendir.USD > 0 || d.plata.rendir.ARS > 0 ? (
                <div style={{ display: "flex", gap: 22, marginTop: 8, flexWrap: "wrap" }}>
                  {d.plata.rendir.USD > 0 && <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{usd(d.plata.rendir.USD)}</div>}
                  {d.plata.rendir.ARS > 0 && <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>$ {plata(d.plata.rendir.ARS)}</div>}
                </div>
              ) : <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>Nada pendiente</div>}
            </div>
            {(() => {
              const debe = d.plata.viajes.filter((v) => !v.pagado).reduce((a, v) => a + v.pago, 0);
              return (
                <div style={{ background: CARTA, borderRadius: 18, padding: 18, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: GRIS }}>Te deben por viajes</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: TINTA, fontVariantNumeric: "tabular-nums" }}>$ {plata(debe)}</div>
                  </div>
                  {d.repartidor.tarifa_km_ars > 0 && <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: GRIS }}>$ {plata(d.repartidor.tarifa_km_ars)}<br />por km</div>}
                </div>
              );
            })()}
            {d.plata.viajes.length > 0 && <h3 style={{ margin: "18px 4px 8px", fontSize: 13, fontWeight: 800, color: GRIS }}>Viajes</h3>}
            {d.plata.viajes.map((v) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, background: CARTA, borderRadius: 14, padding: "13px 14px", marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: TINTA }}>{diaTxt(v.fecha, d.hoy).replace(/^(Hoy|Atrasado) · /, "").replace(/^./, (c) => c.toUpperCase())}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: GRIS, fontVariantNumeric: "tabular-nums" }}>{v.entregas} {v.entregas === 1 ? "entrega" : "entregas"} · {plata(v.km, 1)} km</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: TINTA, fontVariantNumeric: "tabular-nums" }}>$ {plata(v.pago)}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: v.pagado ? VERDE : AMBAR }}>{v.pagado ? "Pagado" : "Pendiente"}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </main>

      {tab === "cargar" && elegidos.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(74px + env(safe-area-inset-bottom))", padding: "0 14px", zIndex: 500 }}>
          <button disabled={ocupado} onClick={cargar} className="rp-tocar" style={{ width: "100%", height: 58, borderRadius: 16, border: "none", background: VERDE, color: "#fff", fontSize: 18, fontWeight: 800, fontFamily: "inherit", boxShadow: "0 8px 24px rgba(22,163,74,.4)" }}>{ocupado ? "Armando la ruta…" : `Cargué ${elegidos.length} ${elegidos.length === 1 ? "envío" : "envíos"}`}</button>
        </div>
      )}

      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 600, background: "var(--barra)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderTop: `1px solid ${LINEA}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "6px 8px calc(6px + env(safe-area-inset-bottom))" }}>
        {[["cargar", "Cargar", I.caja, pend.length], ["ruta", "Ruta", I.ruta, faltan.length], ["plata", "Plata", I.plata, 0]].map(([k, l, ic, n]) => (
          <button key={k} onClick={() => { setTab(k); window.scrollTo(0, 0); }} aria-current={tab === k ? "page" : undefined} className="rp-tocar" style={{ height: 56, border: "none", background: "transparent", color: tab === k ? TINTA : "#9CA3AF", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, position: "relative" }}>
            <span style={{ position: "relative" }}><Ic d={ic} s={24} w={tab === k ? 2.4 : 2} />{n > 0 && <span style={{ position: "absolute", top: -6, right: -13, minWidth: 18, height: 18, padding: "0 5px", boxSizing: "border-box", borderRadius: 9, background: k === "ruta" ? VERDE : FUERTE, color: k === "ruta" ? "#fff" : SOBRE, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>}</span>
            <span style={{ fontSize: 12, fontWeight: tab === k ? 800 : 600 }}>{l}</span>
          </button>
        ))}
      </nav>

      {hoja?.tipo === "entregar" && <HojaEntregar parada={hoja.parada} ocupado={ocupado} onCerrar={() => setHoja(null)} onGuardar={async (x) => { const j = await accion({ accion: "entregar", parada_id: hoja.parada.id, ...x }); if (j) { setHoja(null); avisar("Entrega guardada"); } }} />}
      {hoja?.tipo === "nopude" && <HojaNoPude parada={hoja.parada} ocupado={ocupado} onCerrar={() => setHoja(null)} onGuardar={async (x) => { const j = await accion({ accion: "no_entregado", parada_id: hoja.parada.id, ...x }); if (j) setHoja(null); }} onQuitar={async () => { const j = await accion({ accion: "quitar", parada_id: hoja.parada.id }); if (j) setHoja(null); }} />}
      {hoja?.tipo === "cierre" && (
        <Hoja titulo="Viaje terminado" onCerrar={() => setHoja(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ background: FONDO, borderRadius: 14, padding: 16 }}><div style={{ fontSize: 13, fontWeight: 700, color: GRIS }}>Recorrido</div><div style={{ fontSize: 26, fontWeight: 800, color: TINTA, fontVariantNumeric: "tabular-nums" }}>{plata(hoja.cierre.km, 1)} km</div></div>
            <div style={{ background: FONDO, borderRadius: 14, padding: 16 }}><div style={{ fontSize: 13, fontWeight: 700, color: GRIS }}>Te corresponde</div><div style={{ fontSize: 26, fontWeight: 800, color: TINTA, fontVariantNumeric: "tabular-nums" }}>$ {plata(hoja.cierre.pago)}</div></div>
          </div>
          <button onClick={() => setHoja(null)} className="rp-tocar" style={{ width: "100%", height: 56, borderRadius: 16, border: "none", background: FUERTE, color: SOBRE, fontSize: 17, fontWeight: 800, fontFamily: "inherit" }}>Listo</button>
        </Hoja>
      )}

      {aviso && <div role="status" style={{ position: "fixed", left: 16, right: 16, top: "calc(14px + env(safe-area-inset-top))", zIndex: 1100, padding: "14px 16px", borderRadius: 14, background: FUERTE, color: SOBRE, fontSize: 15, fontWeight: 700, textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,.3)" }}>{aviso}</div>}
    </Pantalla>
  );
}

function Vacio({ titulo, sub, boton, onBoton }) {
  return (
    <div style={{ textAlign: "center", padding: "18vh 24px 0" }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: CARTA, color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Ic d={I.caja} s={30} /></div>
      <div style={{ fontSize: 19, fontWeight: 800, color: TINTA }}>{titulo}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: GRIS, marginTop: 6, lineHeight: 1.4 }}>{sub}</div>
      {boton && <button onClick={onBoton} className="rp-tocar" style={{ marginTop: 20, height: 52, padding: "0 24px", borderRadius: 14, border: "none", background: FUERTE, color: SOBRE, fontSize: 16, fontWeight: 800, fontFamily: "inherit" }}>{boton}</button>}
    </div>
  );
}

function Pantalla({ children }) {
  return (
    <div style={{ minHeight: "100dvh", background: FONDO, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", color: TINTA, maxWidth: 560, margin: "0 auto", WebkitTapHighlightColor: "transparent" }}>
      {/* Con dangerouslySetInnerHTML: las comillas del CSS se escapan distinto en el servidor y rompen la hidratación. */}
      <style dangerouslySetInnerHTML={{ __html: `
        html{--tinta:#111827;--tinta2:#374151;--gris:#6B7280;--linea:#E5E7EB;--linea2:#D1D5DB;--fondo:#F3F4F6;--carta:#FFFFFF;--campo:#FFFFFF;--fuerte:#111827;--sobre:#FFFFFF;--apagado:#D1D5DB;--ambar:#B45309;--rojo:#DC2626;--barra:rgba(255,255,255,.96);--ok-f:#DCFCE7;--ok-t:#166534;--av-f:#FEF3C7;--av-t:#92400E;--mal-f:#FEE2E2;--mal-t:#991B1B;--sombra:0 1px 2px rgba(17,24,39,.06);color-scheme:light}
        html[data-rp-tema="oscuro"]{--tinta:#F9FAFB;--tinta2:#D1D5DB;--gris:#9CA3AF;--linea:#2B3648;--linea2:#4B5563;--fondo:#0B1220;--carta:#172033;--campo:#0F1727;--fuerte:#F9FAFB;--sobre:#111827;--apagado:#374151;--ambar:#FBBF24;--rojo:#F87171;--barra:rgba(15,23,39,.95);--ok-f:rgba(34,197,94,.18);--ok-t:#86EFAC;--av-f:rgba(251,191,36,.16);--av-t:#FCD34D;--mal-f:rgba(248,113,113,.18);--mal-t:#FCA5A5;--sombra:0 0 0 1px rgba(255,255,255,.04);color-scheme:dark}
        html[data-rp-tema="oscuro"] .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.95) contrast(.88) saturate(.7)}
        html[data-rp-tema="oscuro"] .leaflet-control-attribution{background:rgba(15,23,39,.75);color:#9CA3AF}
        html[data-rp-tema="oscuro"] .leaflet-control-attribution a{color:#9CA3AF}
        html,body{background:${FONDO}}
        .leaflet-container{touch-action:pan-y}
        .leaflet-bar a{width:34px!important;height:34px!important;line-height:34px!important}
        input::placeholder{color:var(--gris);opacity:.8}
        .rp-tocar{cursor:pointer;transition:transform 90ms ease,opacity 120ms ease;-webkit-user-select:none;user-select:none;touch-action:manipulation}
        .rp-tocar:active{transform:scale(0.97)}
        .rp-tocar:disabled{cursor:default}
        .rp-tocar:focus-visible{outline:3px solid #2563EB;outline-offset:2px}
        .rp-pill{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;border-radius:15px;font-size:14px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
        .rp-chip{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 14px;border-radius:19px;border:1.5px solid;font-size:14px;font-weight:700;font-family:inherit;white-space:nowrap;flex-shrink:0}
        .rp-link{flex:1 1 0;min-width:0;height:66px;border-radius:14px;background:${FONDO};color:${TINTA};font-size:13px;font-weight:700;line-height:1.1;text-align:center;text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
        .rp-flecha{width:42px;height:42px;border-radius:12px;border:1.5px solid ${LINEA};background:${CARTA};color:${TINTA};display:flex;align-items:center;justify-content:center}
        .rp-sinbarra{scrollbar-width:none}.rp-sinbarra::-webkit-scrollbar{display:none}
        .rp-hoja{animation:rp-sube 220ms cubic-bezier(.2,.8,.2,1)}
        @keyframes rp-sube{from{transform:translateY(48px)}to{transform:none}}
        .rp-late{animation:rp-late 1.2s ease-in-out infinite alternate}
        @keyframes rp-late{from{opacity:.55}to{opacity:1}}
        .leaflet-container{font-family:inherit}
        @media (prefers-reduced-motion:reduce){.rp-hoja,.rp-late{animation:none}.rp-tocar{transition:none}}
      ` }} />
      {children}
    </div>
  );
}
