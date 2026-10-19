"use client";
// Hist. de reseña (18/10/2026): Bautista pega la captura de una reseña de Google y se lleva la historia
// armada con su plantilla. Ver lib/historias.js y app/api/admin/historias/route.js.
//
// Tres momentos: 1) pegar la captura, 2) la historia generada con sus acciones y el encuadre por si
// el recorte quedó corrido, 3) las publicadas. El camino principal es DESCARGAR (o mandarla al
// celular por Telegram) y subirla él desde Instagram, porque así puede etiquetar al cliente; la API
// de Instagram no etiqueta en historias. Después toca "Ya la publiqué" y queda en la lista.
// "Publicar en Instagram" (por API, sin etiquetas) queda como atajo secundario.
import { useEffect, useRef, useState } from "react";
import { toast } from "../../../lib/ui";
import { PLANTILLA } from "../../../lib/historias";

const GOLD_LIGHT = "#E8D098", SKY = "#8CC8F5", NAVY = "#0A1628";
const CARD = { background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 };
const H = { margin: 0, fontSize: 12, color: GOLD_LIGHT, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 800 };
const SUB = { margin: "5px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 };
const LBL = { display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", margin: "0 0 6px" };
const INP = { width: "100%", padding: "10px 12px", fontSize: 13.5, borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)", color: "#fff", fontFamily: "inherit", outline: "none", textAlign: "center" };
const BTN = (v = "ghost", extra = {}) => ({
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "14px 18px", fontSize: 14, fontWeight: 800, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 150ms",
  border: v === "primary" ? "1px solid rgba(184,149,106,0.6)" : v === "sky" ? "1px solid rgba(140,200,245,0.35)" : v === "ok" ? "1px solid rgba(74,222,128,0.5)" : "1px solid rgba(255,255,255,0.14)",
  background: v === "primary" ? "linear-gradient(135deg,#B8956A,#E8C99B)" : v === "sky" ? "rgba(140,200,245,0.1)" : v === "ok" ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
  color: v === "primary" ? NAVY : v === "sky" ? SKY : v === "ok" ? "#4ade80" : "#fff",
  boxShadow: v === "primary" ? "0 8px 24px rgba(184,149,106,0.3)" : "none",
  ...extra,
});
const LINK = (color = SKY) => ({ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color, fontFamily: "inherit" });

export default function HistoriasPanel({ token }) {
  const [publicadas, setPublicadas] = useState([]);
  const [busy, setBusy] = useState(null); // "leyendo" | "armando" | "publicar" | "telegram" | "marcar"
  const [actual, setActual] = useState(null); // {url, captura:{url,ancho,alto}, nombre, recortada, bajada}
  const [bbox, setBbox] = useState({ x0: 0, y0: 0, x1: 100, y1: 100 }); // recorte en % de la captura
  const [encuadre, setEncuadre] = useState(false);
  const [arrastre, setArrastre] = useState(false);
  const fileRef = useRef(null);

  const api = async (init = {}) => {
    const r = await fetch("/api/admin/historias", { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  };
  const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const cargar = async () => { try { const j = await api(); setPublicadas(j.publicadas || []); } catch (e) { toast(e.message, "error"); } };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const subir = async (file) => {
    if (!file || !file.type?.startsWith("image/")) { toast("Pegá o elegí una imagen", "error"); return; }
    setBusy("leyendo"); setEncuadre(false);
    try {
      const fd = new FormData(); fd.append("file", file, file.name || "captura.png");
      const j = await api({ method: "POST", body: fd });
      setActual({ url: j.url, captura: j.captura, nombre: j.nombre, recortada: j.recortada, bajada: false }); setBbox(j.bbox);
      if (!j.recortada) { setEncuadre(true); toast("No ubiqué la reseña: va la captura entera. Ajustá el encuadre.", "error"); }
    } catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  // Pegar con Ctrl+V desde cualquier lado del panel.
  useEffect(() => {
    const onPaste = (e) => { const it = [...(e.clipboardData?.items || [])].find((x) => x.type.startsWith("image/")); if (it) { e.preventDefault(); subir(it.getAsFile()); } };
    window.addEventListener("paste", onPaste); return () => window.removeEventListener("paste", onPaste);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const num = (v) => Math.max(0, Math.min(100, Number(String(v).replace(",", ".")) || 0));
  const rehacer = async (b = bbox) => {
    if (!actual?.captura) return;
    setBusy("armando");
    try { const j = await api(json({ action: "render", captura: actual.captura, bbox: b, nombre: actual.nombre })); setActual((p) => ({ ...p, url: j.url, bajada: false })); setBbox(j.bbox); toast("Historia rehecha", "success"); }
    catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  const descargar = () => { if (!actual?.url) return; const a = document.createElement("a"); a.href = actual.url; a.download = "historia-resena.png"; a.target = "_blank"; a.rel = "noreferrer"; document.body.appendChild(a); a.click(); a.remove(); setActual((p) => ({ ...p, bajada: true })); };
  const telegram = async () => {
    if (!actual?.url) return;
    setBusy("telegram");
    try { await api(json({ action: "telegram", url: actual.url, texto: "⭐ Historia de reseña lista: guardala, subila desde Instagram etiquetando al cliente y después marcala como publicada en el admin." })); toast("Enviada a tu Telegram", "success"); setActual((p) => ({ ...p, bajada: true })); }
    catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  const marcarPublicada = async () => {
    if (!actual?.url) return;
    setBusy("marcar");
    try { const j = await api(json({ action: "publicada", url: actual.url, nombre: actual.nombre })); setPublicadas(j.publicadas || []); toast("Anotada como publicada", "success"); setActual(null); }
    catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  const publicarApi = async () => {
    if (!actual?.url) return;
    setBusy("publicar");
    try { const j = await api(json({ action: "publicar", url: actual.url, nombre: actual.nombre })); setPublicadas(j.publicadas || []); toast("Publicada en Instagram. Agregala al destacado desde el celular.", "success"); setActual(null); }
    catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  const bajar = (url) => { const a = document.createElement("a"); a.href = url; a.download = "historia-resena.png"; a.target = "_blank"; a.rel = "noreferrer"; document.body.appendChild(a); a.click(); a.remove(); };
  const fecha = (d) => { try { return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }); } catch { return ""; } };
  const sinRecorte = { x0: 0, y0: 0, x1: 100, y1: 100 };
  const esEntera = bbox.x0 === 0 && bbox.y0 === 0 && bbox.x1 === 100 && bbox.y1 === 100;

  return <div style={{ maxWidth: 1180 }}>
    {/* 1 · Pegar la captura: la zona es el protagonista, con la plantilla de muestra al costado */}
    {!actual && <div className="ac-hist-drop" style={{ ...CARD, padding: 0, overflow: "hidden", display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", background: "linear-gradient(120deg, rgba(184,149,106,0.07) 0%, rgba(255,255,255,0.025) 45%, rgba(140,200,245,0.06) 100%)" }}>
      <div onClick={() => !busy && fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setArrastre(true); }} onDragLeave={() => setArrastre(false)} onDrop={(e) => { e.preventDefault(); setArrastre(false); subir(e.dataTransfer.files?.[0]); }}
        style={{ padding: "74px 40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: busy ? "wait" : "pointer", background: arrastre ? "rgba(140,200,245,0.07)" : "transparent", transition: "background 150ms", minHeight: 360 }}>
        {busy === "leyendo" ? <>
          <div style={{ width: 54, height: 54, borderRadius: "50%", border: "3px solid rgba(232,208,152,0.2)", borderTopColor: GOLD_LIGHT, marginBottom: 22, animation: "ac-spin 0.9s linear infinite" }} />
          <p style={{ margin: 0, fontSize: 17, color: "#fff", fontWeight: 800 }}>Armando la historia…</p>
        </> : <>
          <div style={{ width: 84, height: 84, borderRadius: "50%", padding: 2, background: "linear-gradient(135deg,#B8956A,#E8D098)", boxShadow: "0 12px 34px rgba(184,149,106,0.3)", marginBottom: 24 }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={GOLD_LIGHT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M9 3v2h6V3" /><path d="M12 9v7" /><path d="M8.5 12.5 12 9l3.5 3.5" /></svg>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 21, color: "#fff", fontWeight: 800, letterSpacing: "-0.01em" }}>Pegá la captura de la reseña</p>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
            {["Ctrl + V", "Arrastrar", "Elegir archivo"].map((t) => <span key={t} style={{ fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", background: "rgba(0,0,0,0.2)" }}>{t}</span>)}
          </div>
        </>}
      </div>
      <div className="ac-hist-side" style={{ position: "relative", borderLeft: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", background: "rgba(0,0,0,0.18)" }}>
        <img src={PLANTILLA} alt="" style={{ position: "absolute", left: "50%", top: 34, width: 196, transform: "translateX(-50%) rotate(-6deg)", borderRadius: 22, boxShadow: "0 30px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.1)" }} />
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ""; }} />
    </div>}

    {/* 2 · Historia generada */}
    {actual && <div style={{ ...CARD, display: "grid", gridTemplateColumns: "minmax(0,320px) minmax(0,1fr)", gap: 28, alignItems: "start" }} className="ac-hist-res">
      <img src={actual.url} alt="" style={{ display: "block", width: "100%", borderRadius: 18, border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 20px 50px rgba(0,0,0,0.45)" }} />
      <div>
        <h3 style={H}>Historia generada</h3>
        <p style={SUB}>{actual.nombre ? <>Reseña de <b style={{ color: "#fff" }}>{actual.nombre}</b> · </> : null}1080 × 1920, lista para subir.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18, maxWidth: 400 }}>
          <button onClick={descargar} style={BTN("primary")}>⬇ Descargar</button>
          <button disabled={!!busy} onClick={telegram} style={BTN()}>{busy === "telegram" ? "Enviando…" : "📲 Mandar a mi Telegram"}</button>
          {actual.bajada && <div style={{ marginTop: 6, padding: "14px 16px", borderRadius: 12, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.3)" }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#fff", lineHeight: 1.5 }}>Subila desde Instagram etiquetando al cliente y, cuando esté, marcala acá.</p>
            <button disabled={!!busy} onClick={marcarPublicada} style={BTN("ok")}>{busy === "marcar" ? "Guardando…" : "✓ Ya la publiqué"}</button>
          </div>}
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 20, flexWrap: "wrap", alignItems: "center" }}>
          <button disabled={!!busy} onClick={publicarApi} style={LINK("rgba(255,255,255,0.55)")} title="La sube la API del Estudio, sin etiquetar a nadie">{busy === "publicar" ? "Publicando…" : "Publicar por la API (sin etiquetar)"}</button>
          <button onClick={() => setEncuadre((v) => !v)} style={LINK()}>{encuadre ? "▲ Ocultar encuadre" : "▼ Ajustar encuadre"}</button>
          <button disabled={!!busy} onClick={() => { setActual(null); setEncuadre(false); }} style={LINK("rgba(255,255,255,0.55)")}>✕ Otra captura</button>
        </div>
        {encuadre && actual.captura && <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ ...SUB, margin: "0 0 12px" }}>{actual.recortada ? "La reseña se recortó sola. Si quedó algo de más o de menos, mové los bordes (en % de la captura)." : "No pude ubicar la reseña: va la captura entera. Marcá los bordes a mano."}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[["y0", "Arriba"], ["y1", "Abajo"], ["x0", "Izquierda"], ["x1", "Derecha"]].map(([k, l]) => <div key={k}><label style={LBL}>{l}</label><input inputMode="decimal" style={INP} value={bbox[k]} onChange={(e) => setBbox((p) => ({ ...p, [k]: e.target.value }))} onBlur={(e) => setBbox((p) => ({ ...p, [k]: num(e.target.value) }))} /></div>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button disabled={!!busy} onClick={() => rehacer({ x0: num(bbox.x0), y0: num(bbox.y0), x1: num(bbox.x1), y1: num(bbox.y1) })} style={BTN("sky", { width: "auto", padding: "10px 16px", fontSize: 13 })}>{busy === "armando" ? "Armando…" : "↻ Rehacer"}</button>
            {!esEntera && <button disabled={!!busy} onClick={() => { setBbox(sinRecorte); rehacer(sinRecorte); }} style={BTN("ghost", { width: "auto", padding: "10px 16px", fontSize: 13 })}>Captura entera</button>}
          </div>
          <img src={actual.captura.url} alt="" style={{ display: "block", width: "100%", maxWidth: 200, marginTop: 14, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", opacity: 0.8 }} />
        </div>}
      </div>
    </div>}

    {/* 3 · Publicadas */}
    <div style={{ ...CARD, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}><h3 style={H}>Publicadas</h3>{publicadas.length > 0 && <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>{publicadas.length}</span>}</div>
      {publicadas.length === 0 ? <p style={SUB}>Todavía no hay ninguna.</p>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 14, marginTop: 16 }}>
          {publicadas.map((f) => <div key={f.url} style={{ textAlign: "center" }}>
            <img src={f.url} alt="" style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", display: "block" }} />
            <p style={{ margin: "8px 0 2px", fontSize: 12.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre || "Reseña"}</p>
            <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "rgba(255,255,255,0.45)" }}>{fecha(f.at)}</p>
            <button onClick={() => bajar(f.url)} style={BTN("ghost", { width: "auto", padding: "6px 12px", fontSize: 11.5, margin: "0 auto" })}>⬇ Descargar</button>
          </div>)}
        </div>}
    </div>
    <style>{`@keyframes ac-spin{to{transform:rotate(360deg)}} @media (max-width:760px){.ac-hist-res,.ac-hist-drop{grid-template-columns:1fr!important}.ac-hist-side{display:none}}`}</style>
  </div>;
}
