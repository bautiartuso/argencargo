"use client";
// Hist. de reseña (18/10/2026): Bautista pega la captura de una reseña de Google y se lleva la historia
// armada con su plantilla. Ver lib/historias.js y app/api/admin/historias/route.js.
//
// Tres zonas, siempre visibles: 1) pegar la captura (nunca se traba: se puede seguir generando),
// 2) GENERADAS: cada una con dos salidas, Descargar (la sube él desde el celular, etiquetando al
// cliente: la API de Instagram no etiqueta en historias) o Publicar por la API; cualquiera de las dos
// la pasa a 3) PUBLICADAS. Las listas viven en cs_settings (historias_generadas / historias_publicadas).
import { useEffect, useRef, useState } from "react";
import { toast, confirmDialog } from "../../../lib/ui";
import { PLANTILLA } from "../../../lib/historias";

const GOLD_LIGHT = "#E8D098", SKY = "#8CC8F5", NAVY = "#0A1628";
const CARD = { background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24 };
const H = { margin: 0, fontSize: 12, color: GOLD_LIGHT, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 800 };
const SUB = { margin: "5px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 };
const LBL = { display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", margin: "0 0 6px" };
const INP = { width: "100%", padding: "9px 10px", fontSize: 13, borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)", color: "#fff", fontFamily: "inherit", outline: "none", textAlign: "center" };
const BTN = (v = "ghost", extra = {}) => ({
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 14px", fontSize: 13, fontWeight: 800, borderRadius: 11, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 150ms",
  border: v === "primary" ? "1px solid rgba(184,149,106,0.6)" : v === "sky" ? "1px solid rgba(140,200,245,0.35)" : "1px solid rgba(255,255,255,0.14)",
  background: v === "primary" ? "linear-gradient(135deg,#B8956A,#E8C99B)" : v === "sky" ? "rgba(140,200,245,0.1)" : "rgba(255,255,255,0.05)",
  color: v === "primary" ? NAVY : v === "sky" ? SKY : "#fff",
  boxShadow: v === "primary" ? "0 8px 24px rgba(184,149,106,0.25)" : "none",
  ...extra,
});
const LINK = (color = SKY) => ({ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 700, color, fontFamily: "inherit" });
const fecha = (d) => { try { return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }); } catch { return ""; } };
const bajar = (url) => { const a = document.createElement("a"); a.href = url; a.download = "historia-resena.png"; a.target = "_blank"; a.rel = "noreferrer"; document.body.appendChild(a); a.click(); a.remove(); };

export default function HistoriasPanel({ token }) {
  const [generadas, setGeneradas] = useState([]);
  const [publicadas, setPublicadas] = useState([]);
  const [leyendo, setLeyendo] = useState(false);
  const [busy, setBusy] = useState(null); // url de la generada sobre la que se está trabajando
  const [encuadre, setEncuadre] = useState(null); // {url, bbox} de la generada que se está ajustando
  const [arrastre, setArrastre] = useState(false);
  const fileRef = useRef(null);

  const api = async (init = {}) => {
    const r = await fetch("/api/admin/historias", { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  };
  const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const aplicar = (j) => { if (Array.isArray(j.generadas)) setGeneradas(j.generadas); if (Array.isArray(j.publicadas)) setPublicadas(j.publicadas); };
  useEffect(() => { (async () => { try { aplicar(await api()); } catch (e) { toast(e.message, "error"); } })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Las capturas del iPhone pesan 3 a 6 MB en PNG y Vercel rechaza el pedido (límite 4,5 MB):
  // se achican acá a JPEG de hasta 1400 px de ancho antes de mandarlas. La reseña se lee igual.
  const achicar = (file) => new Promise((resolve) => {
    try {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1400 / img.width); const w = Math.round(img.width * k), h = Math.round(img.height * k);
        const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
        c.toBlob((b) => { URL.revokeObjectURL(url); resolve(b ? new File([b], "captura.jpg", { type: "image/jpeg" }) : file); }, "image/jpeg", 0.9);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    } catch { resolve(file); }
  });
  const subir = async (file0) => {
    if (!file0 || !file0.type?.startsWith("image/")) { toast("Pegá o elegí una imagen", "error"); return; }
    setLeyendo(true);
    try {
      const file = await achicar(file0);
      const fd = new FormData(); fd.append("file", file, file.name || "captura.jpg");
      const j = await api({ method: "POST", body: fd });
      aplicar(j);
      if (!j.recortada) { setEncuadre({ url: j.url, bbox: j.bbox }); toast("No ubiqué la reseña: va la captura entera. Ajustá el encuadre.", "error"); }
    } catch (e) { toast(e.message, "error"); }
    setLeyendo(false);
  };
  useEffect(() => {
    const onPaste = (e) => { const it = [...(e.clipboardData?.items || [])].find((x) => x.type.startsWith("image/")); if (it) { e.preventDefault(); subir(it.getAsFile()); } };
    window.addEventListener("paste", onPaste); return () => window.removeEventListener("paste", onPaste);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const num = (v) => Math.max(0, Math.min(100, Number(String(v).replace(",", ".")) || 0));
  const rehacer = async (g, b) => {
    setBusy(g.url);
    try { const j = await api(json({ action: "render", captura: g.captura, bbox: b, nombre: g.nombre, anterior: g.url })); aplicar(j); setEncuadre({ url: j.url, bbox: j.bbox }); toast("Historia rehecha", "success"); }
    catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  // Descargar = la va a subir él desde el celular: pasa a publicadas.
  const descargar = async (g) => {
    bajar(g.url); setBusy(g.url);
    try { aplicar(await api(json({ action: "publicada", url: g.url }))); } catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  const publicarApi = async (g) => {
    if (!await confirmDialog(`¿Publicar la historia${g.nombre ? ` de ${g.nombre}` : ""} en Instagram por la API? Sale sin etiquetar al cliente.`, { confirmText: "Publicar" })) return;
    setBusy(g.url);
    try { aplicar(await api(json({ action: "publicar", url: g.url, nombre: g.nombre }))); toast("Publicada en Instagram", "success"); }
    catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };
  const descartar = async (g) => {
    if (!await confirmDialog("¿Descartar esta historia?", { confirmText: "Descartar", danger: true })) return;
    setBusy(g.url);
    try { aplicar(await api(json({ action: "descartar", url: g.url }))); } catch (e) { toast(e.message, "error"); }
    setBusy(null);
  };

  return <div style={{ maxWidth: 1180 }}>
    {/* 1 · Pegar la captura (siempre disponible) */}
    <div className="ac-hist-drop" style={{ ...CARD, padding: 0, overflow: "hidden", display: "grid", gridTemplateColumns: "minmax(0,1fr) 260px", background: "linear-gradient(120deg, rgba(184,149,106,0.07) 0%, rgba(255,255,255,0.025) 45%, rgba(140,200,245,0.06) 100%)" }}>
      <div onClick={() => !leyendo && fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setArrastre(true); }} onDragLeave={() => setArrastre(false)} onDrop={(e) => { e.preventDefault(); setArrastre(false); subir(e.dataTransfer.files?.[0]); }}
        style={{ padding: "54px 40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: leyendo ? "wait" : "pointer", background: arrastre ? "rgba(140,200,245,0.07)" : "transparent", transition: "background 150ms", minHeight: 280 }}>
        {leyendo ? <>
          <div style={{ width: 54, height: 54, borderRadius: "50%", border: "3px solid rgba(232,208,152,0.2)", borderTopColor: GOLD_LIGHT, marginBottom: 20, animation: "ac-spin 0.9s linear infinite" }} />
          <p style={{ margin: 0, fontSize: 17, color: "#fff", fontWeight: 800 }}>Armando la historia…</p>
        </> : <>
          <div style={{ width: 76, height: 76, borderRadius: "50%", padding: 2, background: "linear-gradient(135deg,#B8956A,#E8D098)", boxShadow: "0 12px 34px rgba(184,149,106,0.3)", marginBottom: 20 }}>
            <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={GOLD_LIGHT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M9 3v2h6V3" /><path d="M12 9v7" /><path d="M8.5 12.5 12 9l3.5 3.5" /></svg>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 20, color: "#fff", fontWeight: 800, letterSpacing: "-0.01em" }}>Pegá la captura de la reseña</p>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", justifyContent: "center" }}>
            {["Ctrl + V", "Arrastrar", "Elegir archivo"].map((t) => <span key={t} style={{ fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", background: "rgba(0,0,0,0.2)" }}>{t}</span>)}
          </div>
        </>}
      </div>
      <div className="ac-hist-side" style={{ position: "relative", borderLeft: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", background: "rgba(0,0,0,0.18)" }}>
        <img src={PLANTILLA} alt="" style={{ position: "absolute", left: "50%", top: 28, width: 170, transform: "translateX(-50%) rotate(-6deg)", borderRadius: 20, boxShadow: "0 30px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.1)" }} />
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ""; }} />
    </div>

    {/* 2 · Generadas */}
    <div style={{ ...CARD, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}><h3 style={H}>Generadas</h3>{generadas.length > 0 && <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>{generadas.length}</span>}</div>
      {generadas.length === 0 ? <p style={SUB}>Ninguna esperando. Pegá una captura arriba.</p>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16, marginTop: 16 }}>
          {generadas.map((g) => { const ocupado = busy === g.url; const enc = encuadre?.url === g.url ? encuadre : null; return <div key={g.url} style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.18)", padding: 12, opacity: ocupado ? 0.6 : 1 }}>
            <img src={g.url} alt="" style={{ display: "block", width: "100%", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)" }} />
            <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.nombre || "Reseña"}</p>
            <p style={{ margin: "2px 0 10px", fontSize: 11.5, color: "rgba(255,255,255,0.45)" }}>{fecha(g.at)}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button disabled={ocupado} onClick={() => descargar(g)} style={BTN("primary")}>⬇ Descargar</button>
              <button disabled={ocupado} onClick={() => publicarApi(g)} style={BTN()}>Publicar por la API</button>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 10, justifyContent: "center" }}>
              {g.captura && <button onClick={() => setEncuadre(enc ? null : { url: g.url, bbox: { yf: 0, ...(g.bbox || { x0: 0, y0: 0, x1: 100, y1: 100 }) } })} style={LINK()}>{enc ? "Ocultar encuadre" : "Encuadre"}</button>}
              <button disabled={ocupado} onClick={() => descartar(g)} style={LINK("rgba(255,255,255,0.45)")}>Descartar</button>
            </div>
            {enc && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                {[["y0", "Arriba"], ["y1", "Abajo"], ["x0", "Izq."], ["x1", "Der."], ["yf", "Foto hasta"]].map(([k, l]) => <div key={k}><label style={LBL}>{l} %</label><input inputMode="decimal" style={INP} value={enc.bbox[k]} onChange={(e) => setEncuadre((p) => ({ ...p, bbox: { ...p.bbox, [k]: e.target.value } }))} /></div>)}
              </div>
              <button disabled={ocupado} onClick={() => rehacer(g, { x0: num(enc.bbox.x0), y0: num(enc.bbox.y0), x1: num(enc.bbox.x1), y1: num(enc.bbox.y1), yf: num(enc.bbox.yf) })} style={BTN("sky", { marginTop: 10 })}>{ocupado ? "Armando…" : "↻ Rehacer"}</button>
            </div>}
          </div>; })}
        </div>}
    </div>

    {/* 3 · Publicadas */}
    <div style={{ ...CARD, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}><h3 style={H}>Publicadas</h3>{publicadas.length > 0 && <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>{publicadas.length}</span>}</div>
      {publicadas.length === 0 ? <p style={SUB}>Todavía no hay ninguna.</p>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 14, marginTop: 16 }}>
          {publicadas.map((f) => <div key={f.url} style={{ textAlign: "center" }}>
            <img src={f.url} alt="" style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", display: "block" }} />
            <p style={{ margin: "8px 0 2px", fontSize: 12.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre || "Reseña"}</p>
            <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "rgba(255,255,255,0.45)" }}>{fecha(f.at)}{f.media_id ? " · API" : ""}</p>
            <button onClick={() => bajar(f.url)} style={LINK()}>⬇ Descargar</button>
          </div>)}
        </div>}
    </div>
    <style>{`@keyframes ac-spin{to{transform:rotate(360deg)}} @media (max-width:760px){.ac-hist-drop{grid-template-columns:1fr!important}.ac-hist-side{display:none}}`}</style>
  </div>;
}
