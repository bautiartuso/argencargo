"use client";
// Kairo · escáner de código de barras (comida y suplementos) y búsqueda en Open Food Facts.
// El lector (ZXing) se baja del CDN la primera vez que lo usás, así no pesa en la app.
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { loadSession } from "../../lib/sb-client";
import { C, I, Icon, pushToast, Sheet, Label, card, field, btnLime, btnGhost, linkBtn, Skel } from "./ui";

const ZXING = "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm";
let zxingMod = null;
const loadZxing = () => zxingMod || (zxingMod = new Function("u", "return import(u)")(ZXING));

export const offFetch = (token, params) => fetch(`/api/kairo/off?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${loadSession()?.token || token}` } }).then(r => r.json()).catch(() => ({ error: "Sin conexión" }));

// Cámara a pantalla completa que lee EAN/UPC/QR. Si la cámara no abre, podés tipear el código.
export function BarcodeScanner({ onCode, onClose }) {
  const video = useRef(null), controls = useRef(null), done = useRef(false);
  const [status, setStatus] = useState("Cargando el lector…");
  const [manual, setManual] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await loadZxing();
        if (!alive) return;
        setStatus("Apuntá al código de barras");
        const reader = new BrowserMultiFormatReader();
        controls.current = await reader.decodeFromConstraints({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } }, video.current, (result) => {
          if (!result || done.current) return;
          const text = String(result.getText() || "").replace(/\D/g, "");
          if (text.length < 8) return;
          done.current = true; controls.current?.stop(); onCode(text);
        });
      } catch (e) { if (alive) setStatus("No pude abrir la cámara. Escribí el código abajo."); }
    })();
    return () => { alive = false; try { controls.current?.stop(); } catch {} };
  }, [onCode]);
  return createPortal(<div style={{ position: "fixed", inset: 0, zIndex: 112, background: "#000", display: "flex", flexDirection: "column" }}>
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      <video ref={video} playsInline muted autoPlay style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", left: "10%", right: "10%", top: "38%", height: 120, border: "2px solid rgba(255,255,255,0.85)", borderRadius: 14, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: "calc(38% + 136px)", textAlign: "center", color: "#fff", fontSize: 14, textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>{status}</div>
      <button onClick={onClose} aria-label="Cerrar" style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)", left: 14, width: 40, height: 40, borderRadius: 20, border: "none", background: "rgba(0,0,0,0.45)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={I.close} size={20} sw={2} /></button>
    </div>
    <div style={{ padding: "12px 16px calc(env(safe-area-inset-bottom) + 16px)", display: "flex", gap: 8 }}>
      <input value={manual} onChange={e => setManual(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="O escribí el código (ej. 7790…)" style={{ ...field, flex: 1 }} />
      <button className="k-press" onClick={() => manual.length >= 8 ? onCode(manual) : pushToast("El código tiene 8 a 13 números")} style={{ ...btnLime, width: "auto", padding: "0 18px" }}>Buscar</button>
    </div>
  </div>, document.querySelector(".k-root") || document.body);
}

// Busca productos por nombre o marca en Open Food Facts y te deja elegir uno.
export function OffSearch({ token, type = "food", initial = "", onPick, onClose }) {
  const [q, setQ] = useState(initial);
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  const search = async (term = q) => {
    if (term.trim().length < 2) return pushToast("Escribí al menos 2 letras");
    setBusy(true); setList(null);
    const r = await offFetch(token, { q: term.trim(), type });
    setBusy(false);
    if (r.error) return pushToast(r.error);
    setList(r.products || []);
  };
  const byCode = async (code) => {
    setScan(false); setBusy(true);
    const r = await offFetch(token, { code });
    setBusy(false);
    if (r.product) onPick(r.product); else pushToast(r.error || "No lo encontré");
  };
  useEffect(() => { if (initial.trim().length >= 2) search(initial); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Sheet title={type === "supp" ? "Buscar suplemento" : "Buscar producto"} onClose={onClose} tall>
    <div style={{ display: "flex", gap: 8 }}>
      <input autoFocus={!initial} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder={type === "supp" ? "Marca o producto, ej. ENA creatina" : "Marca o producto, ej. Ser yogur"} autoComplete="off" style={{ ...field, flex: 1 }} />
      <button className="k-press" onClick={() => search()} aria-label="Buscar" style={{ ...btnGhost, width: 50, padding: 0 }}><Icon d={I.search} size={20} /></button>
      <button className="k-press" onClick={() => setScan(true)} aria-label="Escanear código" style={{ ...btnGhost, width: 50, padding: 0, color: C.lime }}><Icon d={I.scan} size={22} /></button>
    </div>
    <div style={{ fontSize: 12, color: C.dim, margin: "8px 2px 0", lineHeight: 1.45 }}>Datos de Open Food Facts, la base abierta de productos con etiqueta. Si falta, escaneá el código de barras.</div>
    {busy && <div style={{ display: "grid", gap: 8, marginTop: 14 }}>{[0, 1, 2].map(i => <Skel key={i} h={62} r={14} />)}</div>}
    {list && !busy && (!list.length ? <div style={{ ...card, marginTop: 14, fontSize: 14, color: C.sub, lineHeight: 1.5 }}>No encontré nada con eso. Probá con la marca, o escaneá el código.</div>
      : <div style={{ ...card, padding: "2px 14px", marginTop: 14 }}>
        {list.map((p, i) => <button key={p.code} onClick={() => onPick(p)} style={{ width: "100%", background: "none", border: "none", color: C.text, textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < list.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
          {p.image ? <img src={p.image} alt="" style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover", background: "#fff", flexShrink: 0 }} /> : <span style={{ width: 42, height: 42, borderRadius: 10, background: C.cardHi, display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, flexShrink: 0 }}><Icon d={I.food} size={20} /></span>}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 15, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            <span className="k-num" style={{ fontSize: 12, color: C.sub }}>{[p.brand, p.quantity, p.per100.kcal != null ? `${Math.round(p.per100.kcal)} kcal/100 g` : null, p.serving ? `porción ${p.serving}` : null].filter(Boolean).join(" · ")}</span>
          </span>
          <Icon d={I.right} size={16} color={C.dim} />
        </button>)}
      </div>)}
    {scan && <BarcodeScanner onCode={byCode} onClose={() => setScan(false)} />}
  </Sheet>;
}
