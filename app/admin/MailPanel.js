"use client";
// Solapa Email del admin (04/10/2026). Habla con /api/admin/mail (API de Gmail).
// Bandeja (incluye spam), Enviados, Borradores y carpetas propias con filtros. DHL, FedEx, UPS y
// WhatsApp (y los informes DMARC) son automáticas: el servidor crea los filtros y saca esos mails de la bandeja.
// Redactar con varios adjuntos y arrastrar y soltar. En el celu: carpetas → lista → mensaje.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "../../lib/ui";
import CarrierLogo from "../components/CarrierLogo";

const GOLD = "#B8956A", GOLD_LIGHT = "#E8C99B";
const MAX_ADJ = 3.2 * 1024 * 1024; // límite de Vercel para el cuerpo de la request (~4,5 MB en base64)
const AUTO = ["DHL", "FedEx", "UPS", "WhatsApp", "DMARC"];

const useCelu = () => { const [c, setC] = useState(false); useEffect(() => { const f = () => setC(window.innerWidth < 760); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []); return c; };
const Ico = ({ d, s = 17 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d.map((x, i) => <path key={i} d={x} />)}</svg>;
const I = {
  bandeja: ["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"],
  enviados: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"],
  borradores: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"],
  carpeta: ["M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"],
  clip: ["M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"],
  volver: ["M19 12H5", "M12 19l-7-7 7-7"],
  responder: ["M7 17l-5-5 5-5", "M12 17l-5-5 5-5", "M22 18v-2a4 4 0 0 0-4-4H7"],
  reenviar: ["M15 17l5-5-5-5", "M4 18v-2a4 4 0 0 1 4-4h12"],
  papelera: ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6"],
  bajar: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  x: ["M18 6L6 18", "M6 6l12 12"],
};
const fmtFecha = (ms) => { if (!ms) return ""; const d = new Date(ms); const hoy = new Date(); return d.toDateString() === hoy.toDateString() ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }); };
const nombreDe = (s) => { const m = String(s || "").match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/); return m ? (m[1].trim() || m[2]) : String(s || "").trim(); };
const separar = (s) => (String(s || "").match(/(?:"[^"]*"|[^,])+/g) || []).map((x) => x.trim()).filter(Boolean);
const direccion = (s) => (String(s).match(/<([^>]+)>/)?.[1] || String(s)).trim().toLowerCase();
const WA = <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3M12 21.8a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.7-.2-.4A9.9 9.9 0 1 1 12 21.8M20.5 3.5A11.8 11.8 0 0 0 12 0C5.5 0 .2 5.3.2 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7a11.9 11.9 0 0 0 5.7 1.4c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.4-8.4z" /></svg>;
const pesoTxt = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export default function MailPanel({ token }) {
  const celu = useCelu();
  const [estado, setEstado] = useState(null);
  const [carpetas, setCarpetas] = useState([]);
  const [noLeidos, setNoLeidos] = useState(0);
  const [carpeta, setCarpeta] = useState("bandeja");
  const [lista, setLista] = useState([]);
  const [sig, setSig] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [q, setQ] = useState("");
  const [busq, setBusq] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [redactar, setRedactar] = useState(null);
  const [vista, setVista] = useState("lista"); // celu: carpetas | lista | mensaje
  const [filtrosAbierto, setFiltrosAbierto] = useState(false);

  const api = useCallback(async (params, init) => {
    const r = init ? await fetch("/api/admin/mail", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(init) })
      : await fetch(`/api/admin/mail?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
    return d;
  }, [token]);

  useEffect(() => { (async () => { try { setEstado(await api({ accion: "estado" })); } catch (e) { setEstado({ error: e.message }); } })(); }, [api]);
  useEffect(() => { try { const m = new URLSearchParams(location.search).get("mail"); if (m === "ok") toast("Gmail conectado", "success"); else if (m) toast("No se pudo conectar Gmail", "error"); } catch {} }, []);

  const cargarCarpetas = useCallback(async () => { try { const d = await api({ accion: "carpetas" }); setCarpetas(d.carpetas || []); setNoLeidos(d.noLeidosBandeja || 0); } catch {} }, [api]);
  // El globo del menú (Email) sigue al de la bandeja.
  useEffect(() => { try { window.dispatchEvent(new CustomEvent("ac_mail_noleidos", { detail: noLeidos })); } catch {} }, [noLeidos]);
  const cargarLista = useCallback(async (mas) => {
    setCargando(true);
    try { const d = await api({ accion: "lista", carpeta, q: busq, ...(mas && sig ? { pagina: sig } : {}) }); setLista((p) => mas ? [...p, ...d.mensajes] : d.mensajes); setSig(d.siguiente); }
    catch (e) { toast(e.message, "error"); }
    setCargando(false);
  }, [api, carpeta, busq, sig]);
  useEffect(() => { if (estado?.conectado) cargarCarpetas(); }, [estado, cargarCarpetas]);
  // Una vez por carga: asegura las carpetas automáticas y saca de la bandeja lo que les corresponde.
  useEffect(() => { if (!estado?.conectado) return; (async () => { try { const d = await api(null, { accion: "ordenar" }); if (d.movidos) { cargarCarpetas(); if (carpeta === "bandeja") cargarLista(false); } } catch {} })(); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (estado?.conectado) { setAbierto(null); cargarLista(false); } }, [estado, carpeta, busq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => setBusq(q.trim()), 400); return () => clearTimeout(t); }, [q]);

  const abrir = async (m) => {
    if (m.borrador) { setRedactar({ para: nombreDe(m.para) === m.para ? m.para : m.para, asunto: m.asunto, texto: "", borrador: m.borrador }); return; }
    setAbierto({ ...m, cargando: true }); if (celu) setVista("mensaje");
    try {
      const d = await api({ accion: "mensaje", id: m.id }); setAbierto(d); setLista((p) => p.map((x) => x.id === m.id ? { ...x, noLeido: false } : x));
      if (m.noLeido) { if (carpeta === "bandeja") setNoLeidos((n) => Math.max(0, n - 1)); else setCarpetas((p) => p.map((c) => c.id === carpeta ? { ...c, noLeidos: Math.max(0, (c.noLeidos || 0) - 1) } : c)); }
    }
    catch (e) { toast(e.message, "error"); setAbierto(null); }
  };
  const bajar = async (m, a) => {
    try {
      const r = await fetch(`/api/admin/mail?${new URLSearchParams({ accion: "adjunto", id: m.id, adj: a.id, nombre: a.nombre, tipo: a.tipo })}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("No se pudo bajar");
      const url = URL.createObjectURL(await r.blob());
      const el = document.createElement("a"); el.href = url; el.download = a.nombre; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { toast(e.message, "error"); }
  };
  const verAdjunto = async (m, a) => {
    try {
      const r = await fetch(`/api/admin/mail?${new URLSearchParams({ accion: "adjunto", id: m.id, adj: a.id, nombre: a.nombre, tipo: a.tipo })}`, { headers: { Authorization: `Bearer ${token}` } });
      const url = URL.createObjectURL(await r.blob()); window.open(url, "_blank");
    } catch (e) { toast(e.message, "error"); }
  };
  // Al borrar se abre el mail de abajo (o el de arriba si era el último).
  const papelera = async (m) => {
    try {
      await api(null, { accion: "papelera", id: m.id });
      const i = lista.findIndex((x) => x.id === m.id);
      const resto = lista.filter((x) => x.id !== m.id);
      setLista(resto);
      toast("Movido a la papelera", "success");
      const prox = i >= 0 ? (resto[i] || resto[i - 1]) : null;
      if (prox && !prox.borrador) abrir(prox); else { setAbierto(null); if (celu) setVista("lista"); }
    } catch (e) { toast(e.message, "error"); }
  };
  // Responder es siempre responder a todos: el remitente (o su Reply-To) + los demás destinatarios, sin mi casilla.
  const responder = (m) => {
    const yo = String(estado?.email || "").toLowerCase();
    const vistos = new Set([yo]);
    const unicos = (l) => l.filter((x) => { const d = direccion(x); if (!d || vistos.has(d)) return false; vistos.add(d); return true; });
    const para = unicos([...separar(m.responderA || m.de), ...separar(m.para)]);
    const cc = unicos(separar(m.cc));
    setRedactar({ para: para.join(", "), cc: cc.join(", "), asunto: /^re:/i.test(m.asunto) ? m.asunto : `Re: ${m.asunto}`, texto: "", hilo: m.hilo, enRespuestaA: m.messageId, referencias: [m.referencias, m.messageId].filter(Boolean).join(" ") });
  };
  const reenviar = (m) => setRedactar({ para: "", asunto: /^(fwd?|rv):/i.test(m.asunto) ? m.asunto : `Fwd: ${m.asunto}`, texto: "", reenviar: m.id, adjOrig: m.adjuntos || [] });

  // ── Sin conectar ──
  if (!estado) return <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "3rem 0" }}>Cargando…</p>;
  if (!estado.conectado) return <div style={{ maxWidth: 520, margin: "40px auto", textAlign: "center", padding: "32px 24px", borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
    <div style={{ width: 54, height: 54, borderRadius: 16, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(184,149,106,0.14)", color: GOLD_LIGHT }}><Ico d={I.bandeja} s={26} /></div>
    <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Conectá tu Gmail</p>
    {!estado.configurado && <p style={{ fontSize: 13, color: "#fbbf24", margin: "0 0 16px", lineHeight: 1.5 }}>Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel.</p>}
    <button disabled={!estado.configurado} onClick={async () => { try { const d = await api({ accion: "conectar" }); window.location.href = d.url; } catch (e) { toast(e.message, "error"); } }} style={{ height: 46, padding: "0 24px", borderRadius: 12, border: "none", background: estado.configurado ? `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})` : "rgba(255,255,255,0.08)", color: estado.configurado ? "#0A1628" : "rgba(255,255,255,0.4)", fontWeight: 800, fontSize: 14, cursor: estado.configurado ? "pointer" : "not-allowed" }}>Conectar Gmail</button>
  </div>;

  const NAV = [{ k: "bandeja", l: "Bandeja", ic: I.bandeja, n: noLeidos }, { k: "enviados", l: "Enviados", ic: I.enviados }, { k: "borradores", l: "Borradores", ic: I.borradores }];
  const elegir = (k) => { setCarpeta(k); if (celu) setVista("lista"); };
  // Carpetas de DHL, FedEx y UPS: con el logo de la empresa en vez del ícono de carpeta.
  const marca = (l) => { const x = String(l || "").toLowerCase(); return x === "dhl" ? "dhl" : x === "fedex" ? "fedex" : x === "ups" ? "ups" : null; };
  const itemNav = (k, l, ic, n) => { const on = carpeta === k; const mk = ic === I.carpeta ? marca(l) : null; const wa = ic === I.carpeta && String(l).toLowerCase() === "whatsapp"; return <button key={k} onClick={() => elegir(k)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: on ? "rgba(184,149,106,0.16)" : "transparent", color: on ? GOLD_LIGHT : "rgba(255,255,255,0.72)", fontSize: 13.5, fontWeight: on ? 800 : 600, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>{mk ? <CarrierLogo k={mk} alto={24} radio={6} /> : wa ? <>{WA}WhatsApp</> : <><Ico d={ic} />{l}</>}{n > 0 && <span style={{ marginLeft: "auto", minWidth: 22, textAlign: "center", fontSize: 11.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#ef4444", color: "#fff" }}>{n}</span>}</button>; };
  const ordenCarpetas = [...carpetas].sort((a, b) => { const ia = AUTO.findIndex((x) => x.toLowerCase() === a.nombre.toLowerCase()), ib = AUTO.findIndex((x) => x.toLowerCase() === b.nombre.toLowerCase()); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.nombre.localeCompare(b.nombre); });

  const panelCarpetas = <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <button onClick={() => setRedactar({ para: "", asunto: "", texto: "" })} style={{ height: 44, marginBottom: 12, borderRadius: 12, border: "none", background: `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})`, color: "#0A1628", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Redactar</button>
    {NAV.map((x) => itemNav(x.k, x.l, x.ic, x.n))}
    <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "16px 12px 6px" }}>Carpetas</p>
    {ordenCarpetas.map((c) => itemNav(c.id, c.nombre, I.carpeta, c.noLeidos))}
    <button onClick={() => setFiltrosAbierto(true)} style={{ marginTop: 6, padding: "9px 12px", borderRadius: 10, border: "1px dashed rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>+ Carpetas y filtros</button>
    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "14px 12px 0", wordBreak: "break-all" }}>{estado.email}</p>
  </div>;

  const titulo = NAV.find((x) => x.k === carpeta)?.l || carpetas.find((c) => c.id === carpeta)?.nombre || "";
  const nCarpeta = carpeta === "bandeja" ? noLeidos : carpetas.find((c) => c.id === carpeta)?.noLeidos || 0;
  const panelLista = <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
      {celu && <button onClick={() => setVista("carpetas")} style={btnIco} aria-label="Carpetas"><Ico d={I.carpeta} /></button>}
      {nCarpeta > 0 && <span title="Sin leer" style={{ flexShrink: 0, height: 40, padding: "0 12px", borderRadius: 11, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5", fontSize: 12.5, fontWeight: 800 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} />{nCarpeta} sin leer</span>}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar en ${titulo.toLowerCase()}`} style={{ flex: 1, minWidth: 0, height: 40, padding: "0 14px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, outline: "none" }} />
      {celu && <button onClick={() => setRedactar({ para: "", asunto: "", texto: "" })} style={{ ...btnIco, background: `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})`, color: "#0A1628", border: "none" }} aria-label="Redactar"><Ico d={I.borradores} /></button>}
    </div>
    <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", overflow: "hidden" }}>
      {lista.length === 0 && !cargando && <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "2.5rem 0", fontSize: 13 }}>No hay mails.</p>}
      {lista.map((m) => { const on = abierto?.id === m.id; return <button key={m.id} onClick={() => abrir(m)} style={{ width: "100%", display: "block", textAlign: "left", padding: "12px 14px", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", background: on ? "rgba(184,149,106,0.1)" : "transparent", cursor: "pointer", fontFamily: "inherit", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {m.noLeido && <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD_LIGHT, flexShrink: 0 }} />}
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: m.noLeido ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{carpeta === "enviados" || m.borrador ? `Para: ${nombreDe(m.para)}` : nombreDe(m.de)}</span>
          {m.spam && <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "rgba(248,113,113,0.15)", color: "#f87171" }}>SPAM</span>}
          {m.adjuntos && <span style={{ color: "rgba(255,255,255,0.45)" }}><Ico d={I.clip} s={13} /></span>}
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", flexShrink: 0 }}>{fmtFecha(m.fecha)}</span>
        </div>
        <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: m.noLeido ? 700 : 500, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.asunto || "(sin asunto)"}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.extracto}</p>
      </button>; })}
      {cargando && <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "1rem 0", fontSize: 12.5 }}>Cargando…</p>}
      {sig && !cargando && <button onClick={() => cargarLista(true)} style={{ width: "100%", padding: "12px", border: "none", background: "transparent", color: GOLD_LIGHT, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Ver más</button>}
    </div>
  </div>;

  const panelMensaje = abierto ? <div style={{ minWidth: 0, borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: celu ? "14px" : "18px 20px" }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
      {celu && <button onClick={() => { setVista("lista"); setAbierto(null); }} style={btnIco} aria-label="Volver"><Ico d={I.volver} /></button>}
      <span style={{ flex: 1 }} />
      <button onClick={() => responder(abierto)} disabled={abierto.cargando} style={btnTxt}><Ico d={I.responder} s={15} />Responder a todos</button>
      <button onClick={() => reenviar(abierto)} disabled={abierto.cargando} style={btnTxt}><Ico d={I.reenviar} s={15} />Reenviar</button>
      <button onClick={() => papelera(abierto)} style={btnIco} aria-label="Papelera"><Ico d={I.papelera} s={15} /></button>
    </div>
    <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 10px", lineHeight: 1.3 }}>{abierto.asunto || "(sin asunto)"}</p>
    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: 0, wordBreak: "break-word" }}><b style={{ color: "#fff" }}>{nombreDe(abierto.de)}</b> <span style={{ color: "rgba(255,255,255,0.45)" }}>{String(abierto.de).match(/<([^>]+)>/)?.[1] || ""}</span></p>
    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "2px 0 14px" }}>Para {abierto.para}{abierto.cc ? ` · Cc ${abierto.cc}` : ""} · {abierto.fecha ? new Date(abierto.fecha).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</p>
    {abierto.cargando ? <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Cargando…</p> : <>
      {abierto.adjuntos?.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {abierto.adjuntos.map((a) => <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", maxWidth: "100%" }}>
          <Ico d={I.clip} s={14} />
          <button onClick={() => verAdjunto(abierto, a)} style={{ border: "none", background: "transparent", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "inherit" }}>{a.nombre}</button>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{pesoTxt(a.tamano)}</span>
          <button onClick={() => bajar(abierto, a)} aria-label="Descargar" style={{ ...btnIco, width: 28, height: 28 }}><Ico d={I.bajar} s={14} /></button>
        </div>)}
      </div>}
      {abierto.html ? <CuerpoMail key={abierto.id} html={abierto.html} />
        : <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.6 }}>{abierto.texto}</pre>}
    </>}
  </div> : !celu && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16, border: "1px dashed rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)", fontSize: 13, minHeight: 300 }}>Elegí un mail</div>;

  return <div>
    {celu
      ? (vista === "carpetas" ? panelCarpetas : vista === "mensaje" && abierto ? panelMensaje : panelLista)
      : <div style={{ display: "grid", gridTemplateColumns: "200px minmax(280px,0.75fr) minmax(0,1.5fr)", gap: 16, alignItems: "start" }}>{panelCarpetas}{panelLista}{panelMensaje}</div>}
    {redactar && <Redactar inicial={redactar} celu={celu} api={api} onCerrar={(enviado) => { setRedactar(null); if (enviado && (carpeta === "enviados" || carpeta === "borradores")) cargarLista(false); }} />}
    {filtrosAbierto && <Filtros api={api} celu={celu} onCerrar={() => { setFiltrosAbierto(false); cargarCarpetas(); }} />}
  </div>;
}

// Cuerpo HTML del mail: sin scripts, pero con allow-same-origin para medir el alto y mostrarlo entero
// (sin scroll interno). Sigue el alto cuando cargan las imágenes.
function CuerpoMail({ html }) {
  const ref = useRef(null);
  const medir = () => { try { const doc = ref.current?.contentDocument; if (!doc?.body) return; const h = Math.ceil(doc.body.getBoundingClientRect().height); if (h > 0) ref.current.style.height = `${Math.max(160, h + 4)}px`; } catch {} };
  useEffect(() => { let ro; const el = ref.current; const al = () => { medir(); try { const doc = el.contentDocument; ro = new ResizeObserver(medir); ro.observe(doc.body); doc.querySelectorAll("img").forEach((i) => i.addEventListener("load", medir)); } catch {} }; el?.addEventListener("load", al); try { if (el?.contentDocument?.readyState === "complete" && el.contentDocument.body?.childElementCount) al(); } catch {} return () => { el?.removeEventListener("load", al); ro?.disconnect(); }; }, [html]);
  return <iframe ref={ref} title="mail" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={`<!doctype html><meta charset="utf-8"><base target="_blank"><style>html,body{overflow:hidden}body{margin:0;font-family:Arial,sans-serif;font-size:14px;color:#111;background:#fff;padding:16px;word-break:break-word}img{max-width:100%;height:auto}table{max-width:100%}</style>${html}`} style={{ width: "100%", height: 600, border: "none", borderRadius: 12, background: "#fff", display: "block" }} />;
}

const btnIco = { width: 36, height: 36, flexShrink: 0, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.8)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 };
const btnTxt = { height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.85)", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit" };
const campo = { width: "100%", height: 42, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13.5, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

function Modal({ celu, onCerrar, children, ancho = 640 }) {
  return <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: celu ? "stretch" : "flex-start", justifyContent: "center", padding: celu ? 0 : "40px 16px", overflowY: "auto" }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: celu ? "none" : ancho, minHeight: celu ? "100%" : undefined, boxSizing: "border-box", background: "linear-gradient(160deg,#142038,#0e1a2c)", border: celu ? "none" : "1px solid rgba(255,255,255,0.1)", borderRadius: celu ? 0 : 18, padding: celu ? "16px" : "20px 22px", margin: celu ? 0 : "auto" }}>{children}</div>
  </div>;
}

function Redactar({ inicial, celu, api, onCerrar }) {
  const [f, setF] = useState({ para: inicial.para || "", cc: inicial.cc || "", asunto: inicial.asunto || "", texto: inicial.texto || "" });
  const [adj, setAdj] = useState([]);
  const [verCc, setVerCc] = useState(!!inicial.cc);
  const [arrastrando, setArrastrando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const input = useRef(null);
  const total = adj.reduce((a, x) => a + x.tamano, 0);
  const agregar = async (files) => {
    const nuevos = await Promise.all([...files].map((file) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ nombre: file.name, tipo: file.type || "application/octet-stream", tamano: file.size, datos: String(r.result).split(",")[1] || "" }); r.onerror = () => res(null); r.readAsDataURL(file); })));
    setAdj((p) => [...p, ...nuevos.filter(Boolean)]);
  };
  const ir = async (accion) => {
    if (total > MAX_ADJ) { toast(`Los adjuntos pesan ${pesoTxt(total)}: el máximo es ${pesoTxt(MAX_ADJ)}`, "error"); return; }
    setEnviando(true);
    try { await api(null, { accion, ...f, adjuntos: adj, hilo: inicial.hilo, enRespuestaA: inicial.enRespuestaA, referencias: inicial.referencias, borrador: inicial.borrador, reenviar: inicial.reenviar }); toast(accion === "enviar" ? "Mail enviado" : "Borrador guardado", "success"); onCerrar(true); }
    catch (e) { toast(e.message, "error"); setEnviando(false); }
  };
  return <Modal celu={celu} onCerrar={() => !enviando && onCerrar(false)}>
    <div onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)} onDrop={(e) => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files); }} style={{ position: "relative" }}>
      {arrastrando && <div style={{ position: "absolute", inset: -8, zIndex: 5, borderRadius: 14, border: `2px dashed ${GOLD}`, background: "rgba(184,149,106,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD_LIGHT, fontWeight: 800, fontSize: 15, pointerEvents: "none" }}>Soltá los archivos acá</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>{inicial.reenviar ? "Reenviar" : inicial.hilo ? "Responder a todos" : "Nuevo mail"}</p>
        <button onClick={() => onCerrar(false)} style={btnIco} aria-label="Cerrar"><Ico d={I.x} s={15} /></button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input value={f.para} onChange={(e) => setF((p) => ({ ...p, para: e.target.value }))} placeholder="Para" style={campo} />
        {!verCc && <button onClick={() => setVerCc(true)} style={{ ...btnTxt, height: 42 }}>Cc</button>}
      </div>
      {verCc && <input value={f.cc} onChange={(e) => setF((p) => ({ ...p, cc: e.target.value }))} placeholder="Cc" style={{ ...campo, marginBottom: 8 }} />}
      <input value={f.asunto} onChange={(e) => setF((p) => ({ ...p, asunto: e.target.value }))} placeholder="Asunto" style={{ ...campo, marginBottom: 8 }} />
      <textarea value={f.texto} onChange={(e) => setF((p) => ({ ...p, texto: e.target.value }))} placeholder="Escribí el mail o arrastrá archivos acá" style={{ ...campo, height: celu ? 260 : 240, padding: 12, resize: "vertical", lineHeight: 1.55 }} />
      {inicial.reenviar && <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12.5, color: "rgba(255,255,255,0.65)" }}>Va el mail original abajo{inicial.adjOrig?.length ? <> con {inicial.adjOrig.length} adjunto{inicial.adjOrig.length > 1 ? "s" : ""}: <b style={{ color: "#fff" }}>{inicial.adjOrig.map((a) => a.nombre).join(", ")}</b></> : null}</div>}
      {adj.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {adj.map((a, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 6px 6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12, color: "#fff", maxWidth: "100%" }}>
          <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span><span style={{ color: "rgba(255,255,255,0.45)" }}>{pesoTxt(a.tamano)}</span>
          <button onClick={() => setAdj((p) => p.filter((_, j) => j !== i))} aria-label="Quitar" style={{ width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ico d={I.x} s={11} /></button>
        </span>)}
        {total > MAX_ADJ && <span style={{ fontSize: 12, color: "#f87171", fontWeight: 700, alignSelf: "center" }}>Máximo {pesoTxt(MAX_ADJ)} en total</span>}
      </div>}
      <input ref={input} type="file" multiple style={{ display: "none" }} onChange={(e) => { agregar(e.target.files); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button onClick={() => input.current?.click()} style={btnTxt}><Ico d={I.clip} s={15} />Adjuntar</button>
        <span style={{ flex: 1 }} />
        {!inicial.reenviar && <button onClick={() => ir("borrador")} disabled={enviando} style={btnTxt}>Guardar borrador</button>}
        <button onClick={() => ir("enviar")} disabled={enviando} style={{ ...btnTxt, border: "none", background: `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})`, color: "#0A1628", padding: "0 20px" }}>{enviando ? "Enviando…" : "Enviar"}</button>
      </div>
    </div>
  </Modal>;
}

function Filtros({ api, celu, onCerrar }) {
  const [filtros, setFiltros] = useState(null);
  const [f, setF] = useState({ carpeta: "", de: "", asunto: "" });
  const [guardando, setGuardando] = useState(false);
  const cargar = useCallback(async () => { try { const d = await api({ accion: "filtros" }); setFiltros(d.filtros || []); } catch (e) { toast(e.message, "error"); setFiltros([]); } }, [api]);
  useEffect(() => { cargar(); }, [cargar]);
  const crear = async (x) => {
    setGuardando(true);
    try { const d = await api(null, { accion: "filtro", ...x }); toast(`Carpeta ${x.carpeta} lista${d.movidos ? ` · ${d.movidos} mails movidos` : ""}`, "success"); setF({ carpeta: "", de: "", asunto: "" }); await cargar(); }
    catch (e) { toast(e.message, "error"); }
    setGuardando(false);
  };
  return <Modal celu={celu} onCerrar={onCerrar} ancho={560}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>Carpetas y filtros</p>
      <button onClick={onCerrar} style={btnIco} aria-label="Cerrar"><Ico d={I.x} s={15} /></button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: celu ? "1fr" : "1fr 1fr", gap: 8 }}>
      <input value={f.carpeta} onChange={(e) => setF((p) => ({ ...p, carpeta: e.target.value }))} placeholder="Carpeta (ej. Proveedores)" style={campo} />
      <input value={f.de} onChange={(e) => setF((p) => ({ ...p, de: e.target.value }))} placeholder="De (mail o dominio)" style={campo} />
      <input value={f.asunto} onChange={(e) => setF((p) => ({ ...p, asunto: e.target.value }))} placeholder="Asunto contiene (opcional)" style={{ ...campo, gridColumn: celu ? "auto" : "1 / -1" }} />
    </div>
    <button disabled={guardando || !f.carpeta.trim() || (!f.de.trim() && !f.asunto.trim())} onClick={() => crear(f)} style={{ ...btnTxt, marginTop: 10, border: "none", background: `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})`, color: "#0A1628", width: celu ? "100%" : "auto", justifyContent: "center" }}>{guardando ? "Creando…" : "Crear filtro"}</button>
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
      {filtros === null ? <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Cargando…</p> : filtros.map((x) => <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <Ico d={I.carpeta} s={15} />
        <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#fff" }}>{x.carpeta || "—"}</p><p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[x.de && `De: ${x.de}`, x.asunto && `Asunto: ${x.asunto}`, x.query && x.query].filter(Boolean).join(" · ")}</p></div>
        <button onClick={async () => { try { await api(null, { accion: "borrar_filtro", id: x.id }); await cargar(); } catch (e) { toast(e.message, "error"); } }} style={btnIco} aria-label="Borrar filtro"><Ico d={I.papelera} s={14} /></button>
      </div>)}
    </div>
  </Modal>;
}
