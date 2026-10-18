"use client";
// Historias destacadas (18/10/2026): Bautista pega la captura de una reseña de Google y se lleva
// la historia armada con la plantilla de la marca, sin editar nada. Ver lib/historias.js y
// app/api/admin/historias/route.js.
import { useEffect, useRef, useState } from "react";
import { toast } from "../../../lib/ui";

const GOLD_LIGHT = "#E8D098", SKY = "#8CC8F5";
const CARD = { background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 22, marginBottom: 16 };
const H = { margin: 0, fontSize: 13, color: GOLD_LIGHT, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 };
const SUB = { margin: "4px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.5)" };
const BTN = (v = "ghost") => ({
  padding: "10px 16px", fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  border: v === "primary" ? "1px solid rgba(184,149,106,0.6)" : "1px solid rgba(255,255,255,0.14)",
  background: v === "primary" ? "linear-gradient(135deg,#B8956A,#E8C99B)" : v === "sky" ? "rgba(140,200,245,0.1)" : "rgba(255,255,255,0.05)",
  color: v === "primary" ? "#0A1628" : v === "sky" ? SKY : "#fff",
});
const INP = { width: "100%", padding: "10px 12px", fontSize: 13.5, borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)", color: "#fff", fontFamily: "inherit", outline: "none" };
const LBL = { display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", margin: "0 0 6px" };

export default function HistoriasPanel({ token }) {
  const [lista, setLista] = useState([]);
  const [portadas, setPortadas] = useState([]);
  const [busy, setBusy] = useState(null); // "leyendo" | "armando" | "telegram" | "portadas"
  const [actual, setActual] = useState(null); // {url, captura:{url,ancho,alto}, nombre, recortada}
  const [bbox, setBbox] = useState({ x0: 0, y0: 0, x1: 100, y1: 100 }); // recorte en % de la captura
  const [arrastre, setArrastre] = useState(false);
  const fileRef = useRef(null);

  const api = async (init = {}) => {
    const r = await fetch("/api/admin/historias", { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  };
  const cargar = async () => { try { const j = await api(); setLista(j.historias || []); setPortadas(j.portadas || []); } catch (e) { toast(e.message, "error"); } };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const subir = async (file) => {
    if (!file || !file.type?.startsWith("image/")) { toast("Pegá o elegí una imagen", "error"); return; }
    setBusy("leyendo");
    try {
      const fd = new FormData(); fd.append("file", file, file.name || "captura.png");
      const j = await api({ method: "POST", body: fd });
      setActual({ url: j.url, captura: j.captura, nombre: j.nombre, recortada: j.recortada }); setBbox(j.bbox);
      toast(j.recortada ? "Historia armada" : "Historia armada con la captura entera (no pude ubicar la reseña)", j.recortada ? "success" : "error"); cargar();
    } catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  // Pegar con Ctrl+V desde cualquier lado del panel.
  useEffect(() => {
    const onPaste = (e) => { const it = [...(e.clipboardData?.items || [])].find((x) => x.type.startsWith("image/")); if (it) { e.preventDefault(); subir(it.getAsFile()); } };
    window.addEventListener("paste", onPaste); return () => window.removeEventListener("paste", onPaste);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const rehacer = async (b = bbox) => {
    if (!actual?.captura) return;
    setBusy("armando");
    try { const j = await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "render", captura: actual.captura, bbox: b, nombre: actual.nombre }) }); setActual((p) => ({ ...p, url: j.url })); setBbox(j.bbox); toast("Historia rehecha", "success"); cargar(); }
    catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  const sinRecorte = { x0: 0, y0: 0, x1: 100, y1: 100 };
  const esEntera = bbox.x0 === 0 && bbox.y0 === 0 && bbox.x1 === 100 && bbox.y1 === 100;
  const num = (v) => Math.max(0, Math.min(100, Number(String(v).replace(",", ".")) || 0));
  const telegram = async (url) => {
    setBusy("telegram");
    try { await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "telegram", url }) }); toast("Enviada a tu Telegram", "success"); }
    catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  const generarPortadas = async (rehacerP = false) => {
    setBusy("portadas");
    try { const j = await api({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "portadas", rehacer: rehacerP }) }); setPortadas((j.portadas || []).map((p) => ({ name: `${p.key}.png`, url: p.url, nombre: p.nombre }))); toast("Portadas listas", "success"); }
    catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  const descargar = (url, name) => { const a = document.createElement("a"); a.href = url; a.download = name || "historia.png"; a.target = "_blank"; a.rel = "noreferrer"; document.body.appendChild(a); a.click(); a.remove(); };
  const nombrePortada = (f) => ({ "clientes.png": "Clientes", "como-funciona.png": "Cómo funciona", "cotiza.png": "Cotizá" })[f.name] || f.nombre || f.name;

  return <div>
    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, margin: "0 0 18px" }}>Historias para el destacado <b style={{ color: "#fff" }}>Clientes</b>: pegás la captura de la reseña y sale la historia lista para subir.</p>

    <div style={{ display: "grid", gridTemplateColumns: actual ? "minmax(0,1fr) minmax(0,1fr)" : "1fr", gap: 16, alignItems: "start" }}>
      <div style={CARD}>
        <h3 style={H}>Nueva historia</h3>
        <p style={SUB}>La captura de la reseña tal cual se ve en Google: foto, nombre, estrellas y texto.</p>
        <div onClick={() => !busy && fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setArrastre(true); }} onDragLeave={() => setArrastre(false)} onDrop={(e) => { e.preventDefault(); setArrastre(false); subir(e.dataTransfer.files?.[0]); }}
          style={{ marginTop: 16, padding: "38px 20px", borderRadius: 14, border: `2px dashed ${arrastre ? SKY : "rgba(255,255,255,0.18)"}`, background: arrastre ? "rgba(140,200,245,0.08)" : "rgba(0,0,0,0.18)", textAlign: "center", cursor: busy ? "wait" : "pointer" }}>
          {busy === "leyendo" ? <p style={{ margin: 0, fontSize: 14, color: SKY, fontWeight: 700 }}>Leyendo la reseña y armando la historia…</p>
            : <><p style={{ margin: 0, fontSize: 15, color: "#fff", fontWeight: 700 }}>📋 Pegá la captura (Ctrl+V) o tocá para elegirla</p><p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>También podés arrastrarla acá</p></>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ""; }} />

        {actual?.captura && <div style={{ marginTop: 20 }}>
          <h3 style={H}>Encuadre</h3>
          <p style={SUB}>{actual.recortada ? "La reseña se recortó sola. Si quedó algo de más o de menos, ajustá los bordes." : "No pude ubicar la reseña: va la captura entera. Ajustá los bordes a mano."}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 12 }}>
            {[["y0", "Arriba"], ["y1", "Abajo"], ["x0", "Izquierda"], ["x1", "Derecha"]].map(([k, l]) => <div key={k}><label style={LBL}>{l} %</label><input inputMode="decimal" style={INP} value={bbox[k]} onChange={(e) => setBbox((p) => ({ ...p, [k]: e.target.value }))} onBlur={(e) => setBbox((p) => ({ ...p, [k]: num(e.target.value) }))} /></div>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button disabled={!!busy} onClick={() => rehacer({ x0: num(bbox.x0), y0: num(bbox.y0), x1: num(bbox.x1), y1: num(bbox.y1) })} style={BTN("sky")}>{busy === "armando" ? "Armando…" : "↻ Rehacer con este encuadre"}</button>
            {!esEntera && <button disabled={!!busy} onClick={() => { setBbox(sinRecorte); rehacer(sinRecorte); }} style={BTN()}>Usar la captura entera</button>}
          </div>
          <img src={actual.captura.url} alt="" style={{ display: "block", width: "100%", maxWidth: 260, marginTop: 14, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", opacity: 0.8 }} />
        </div>}
      </div>

      {actual && <div style={CARD}>
        <h3 style={H}>Historia lista</h3>
        <p style={SUB}>1080 × 1920 · la subís como historia desde el celular y la agregás al destacado Clientes.</p>
        <img src={actual.url} alt="" style={{ display: "block", width: "100%", maxWidth: 360, margin: "16px auto 0", borderRadius: 18, border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 16px 40px rgba(0,0,0,0.4)" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <button disabled={!!busy} onClick={() => telegram(actual.url)} style={BTN("primary")}>{busy === "telegram" ? "Enviando…" : "📲 Mandar a mi Telegram"}</button>
          <button onClick={() => descargar(actual.url, "historia-clientes.png")} style={BTN()}>⬇ Descargar</button>
        </div>
      </div>}
    </div>

    <div style={CARD}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div><h3 style={H}>Portadas de los destacados</h3><p style={SUB}>Se hacen una vez: Clientes, Cómo funciona y Cotizá.</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={!!busy} onClick={() => generarPortadas(portadas.length > 0)} style={BTN("sky")}>{busy === "portadas" ? "Generando…" : portadas.length ? "↻ Rehacer portadas" : "Generar portadas"}</button>
        </div>
      </div>
      {portadas.length > 0 && <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
        {portadas.map((p) => <div key={p.name} style={{ textAlign: "center" }}>
          <div style={{ width: 110, height: 110, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.15)", margin: "0 auto" }}><img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", transform: "scale(2.55)" }} /></div>
          <p style={{ margin: "8px 0 4px", fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{nombrePortada(p)}</p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            <button onClick={() => telegram(p.url)} style={{ ...BTN("sky"), padding: "6px 10px", fontSize: 11.5 }}>📲</button>
            <button onClick={() => descargar(p.url, p.name)} style={{ ...BTN(), padding: "6px 10px", fontSize: 11.5 }}>⬇</button>
          </div>
        </div>)}
      </div>}
    </div>

    {lista.length > 0 && <div style={CARD}>
      <h3 style={H}>Últimas historias</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 12, marginTop: 14 }}>
        {lista.map((f) => <div key={f.name} style={{ textAlign: "center" }}>
          <img src={f.url} alt="" onClick={() => setActual((p) => ({ ...(p || {}), url: f.url, captura: p?.captura || null }))} style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "block" }} />
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 6 }}>
            <button onClick={() => telegram(f.url)} style={{ ...BTN("sky"), padding: "5px 9px", fontSize: 11 }}>📲</button>
            <button onClick={() => descargar(f.url, f.name)} style={{ ...BTN(), padding: "5px 9px", fontSize: 11 }}>⬇</button>
          </div>
        </div>)}
      </div>
    </div>}
  </div>;
}
