"use client";
// Solapa Email del admin (04/10/2026, rediseñada el 23/10/2026). Habla con /api/admin/mail (API de Gmail).
// Bandeja, Notificaciones, Enviados, Borradores, Spam y Papelera (como Gmail, 16/11/2026) y carpetas propias
// con filtros. DHL, FedEx, UPS, WhatsApp, Facebook, Google y Tracking cargas China (y los informes DMARC) son
// automáticas: el servidor crea los filtros y saca esos mails de la bandeja. La lista se actualiza sola.
// Redactar con varios adjuntos y arrastrar y soltar. En el celu: carpetas → lista → mensaje.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "../../lib/ui";
import CarrierLogo from "../components/CarrierLogo";
import { FIRMA_DEF, PLANTILLAS_DEF, firmaHtml, aplicarPlantilla } from "../../lib/firma-mail";
import { instalarAuthFetch } from "../../lib/auth-fetch";
instalarAuthFetch(["ac_admin"]);

const GOLD = "#B8956A", GOLD_LIGHT = "#E8C99B";
const MAX_ADJ = 3.2 * 1024 * 1024; // límite de Vercel para el cuerpo de la request (~4,5 MB en base64)

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
  notificaciones: ["M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9", "M13.73 21a2 2 0 0 1-3.46 0"],
  spam: ["M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z", "M12 8v4", "M12 16h.01"],
  restaurar: ["M1 4v6h6", "M3.51 15a9 9 0 1 0 2.13-9.36L1 10"],
};
const fmtFecha = (ms) => { if (!ms) return ""; const d = new Date(ms); const hoy = new Date(); return d.toDateString() === hoy.toDateString() ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }); };
const nombreDe = (s) => { const m = String(s || "").match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/); return m ? (m[1].trim() || m[2]) : String(s || "").trim(); };
const separar = (s) => (String(s || "").match(/(?:"[^"]*"|[^,])+/g) || []).map((x) => x.trim()).filter(Boolean);
const direccion = (s) => (String(s).match(/<([^>]+)>/)?.[1] || String(s)).trim().toLowerCase();
const WA = <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3M12 21.8a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.7-.2-.4A9.9 9.9 0 1 1 12 21.8M20.5 3.5A11.8 11.8 0 0 0 12 0C5.5 0 .2 5.3.2 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7a11.9 11.9 0 0 0 5.7 1.4c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.4-8.4z" /></svg>;
const FB = <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877F2" /><path fill="#fff" d="M16.67 15.47l.53-3.47h-3.33V9.75c0-.95.47-1.88 1.96-1.88h1.51V4.92s-1.37-.23-2.69-.23c-2.74 0-4.53 1.66-4.53 4.67V12H7.08v3.47h3.04V24h3.75v-8.53h2.8z" /></svg>;
const GOOGLE = <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>;
// Carpetas con marca (16/11/2026). "Tracking cargas China" son los avisos de Xiexie: va con el logo de MyBox.
const MARCAS_CARPETA = { whatsapp: 1, facebook: 2, google: 3, "tracking cargas china": 4 };
const pesoTxt = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const tipoArchivo = (a) => { const n = String(a.nombre || "").toLowerCase(); return /\.pdf$/.test(n) ? ["PDF", "#ef4444"] : /\.(png|jpe?g|gif|webp|heic)$/.test(n) ? ["IMG", "#a78bfa"] : /\.(xlsx?|csv)$/.test(n) ? ["XLS", "#22c55e"] : /\.(docx?)$/.test(n) ? ["DOC", "#3b82f6"] : ["ARCH", "#94a3b8"]; };
const fechaTxt = (f) => f ? new Date(f).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

const FIJAS = ["bandeja", "notificaciones", "enviados", "borradores", "spam", "papelera"];

export default function MailPanel({ token }) {
  const celu = useCelu();
  const [estado, setEstado] = useState(null);
  const [carpetas, setCarpetas] = useState([]);
  const [noLeidos, setNoLeidos] = useState(0);
  const [noLeidosNotif, setNoLeidosNotif] = useState(0);
  const [noLeidosSpam, setNoLeidosSpam] = useState(0);
  const [noLeidosTotal, setNoLeidosTotal] = useState(null); // bandeja + notificaciones + spam + DHL, FedEx y UPS (globo del menú)
  const [carpeta, setCarpeta] = useState("bandeja");
  const [lista, setLista] = useState([]);
  const [sig, setSig] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [q, setQ] = useState("");
  const [busq, setBusq] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [verTodos, setVerTodos] = useState(false); // cadena abierta: mostrar también los mensajes viejos
  const [redactar, setRedactar] = useState(null);
  const [vista, setVista] = useState("lista"); // celu: carpetas | lista | mensaje
  const [filtrosAbierto, setFiltrosAbierto] = useState(false);
  const [prefs, setPrefs] = useState({ firma: FIRMA_DEF, plantillas: PLANTILLAS_DEF });
  const [prefsAbierto, setPrefsAbierto] = useState(false);
  const [menuPlantillas, setMenuPlantillas] = useState(false);

  const api = useCallback(async (params, init) => {
    const r = init ? await fetch("/api/admin/mail", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(init) })
      : await fetch(`/api/admin/mail?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
    return d;
  }, [token]);

  useEffect(() => { (async () => { try { setEstado(await api({ accion: "estado" })); } catch (e) { setEstado({ error: e.message }); } })(); }, [api]);
  useEffect(() => { try { const m = new URLSearchParams(location.search).get("mail"); if (m === "ok") toast("Gmail conectado", "success"); else if (m) toast("No se pudo conectar Gmail", "error"); } catch {} }, []);

  const cargarCarpetas = useCallback(async () => { try { const d = await api({ accion: "carpetas" }); setCarpetas(d.carpetas || []); setNoLeidos(d.noLeidosBandeja || 0); setNoLeidosNotif(d.noLeidosNotif || 0); setNoLeidosSpam(d.noLeidosSpam || 0); setNoLeidosTotal(d.noLeidosTotal ?? null); } catch {} }, [api]);
  // El globo del menú (Email) suma la bandeja y las carpetas de DHL, FedEx y UPS (23/10/2026).
  useEffect(() => { if (noLeidosTotal == null) return; try { window.dispatchEvent(new CustomEvent("ac_mail_noleidos", { detail: noLeidosTotal })); } catch {} }, [noLeidosTotal]);
  const cargarLista = useCallback(async (mas) => {
    setCargando(true);
    try { const d = await api({ accion: "lista", carpeta, q: busq, ...(mas && sig ? { pagina: sig } : {}) }); setLista((p) => mas ? [...p, ...d.mensajes.filter((m) => !m.hilo || !p.some((x) => x.hilo === m.hilo))] : d.mensajes); setSig(d.siguiente); }
    catch (e) { toast(e.message, "error"); }
    setCargando(false);
  }, [api, carpeta, busq, sig]);
  useEffect(() => { if (estado?.conectado) cargarCarpetas(); }, [estado, cargarCarpetas]);
  useEffect(() => { if (estado?.conectado) api({ accion: "preferencias" }).then(setPrefs).catch(() => {}); }, [estado, api]);
  // Una vez por carga: asegura las carpetas automáticas y saca de la bandeja lo que les corresponde.
  useEffect(() => { if (!estado?.conectado) return; (async () => { try { const d = await api(null, { accion: "ordenar" }); if (d.movidos) { cargarCarpetas(); if (carpeta === "bandeja") cargarLista(false); } } catch {} })(); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (estado?.conectado) { setAbierto(null); cargarLista(false); } }, [estado, carpeta, busq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => setBusq(q.trim()), 400); return () => clearTimeout(t); }, [q]);
  // Se actualiza sola (16/11/2026): cada minuto, y al volver a la pestaña, trae la primera página de la
  // carpeta abierta sin tocar lo que se está leyendo. Antes había que tocar Actualizar para ver lo nuevo.
  const enVivo = useRef({});
  enVivo.current = { carpeta, busq, api, cargarCarpetas };
  useEffect(() => {
    if (!estado?.conectado) return;
    let ocupado = false;
    const tick = async () => {
      const v = enVivo.current;
      if (document.hidden || ocupado || v.busq || v.carpeta === "borradores") return;
      ocupado = true;
      try {
        const d = await v.api({ accion: "lista", carpeta: v.carpeta });
        if (enVivo.current.carpeta === v.carpeta && !enVivo.current.busq && Array.isArray(d.mensajes)) {
          const nuevos = new Set(d.mensajes.map((m) => m.hilo));
          const piso = d.mensajes.reduce((a, m) => Math.min(a, m.fecha || a), Infinity);
          // Lo de páginas siguientes ("Ver más") se conserva; la primera página se reemplaza entera.
          setLista((p) => [...d.mensajes, ...p.filter((x) => !nuevos.has(x.hilo) && (x.fecha || 0) < piso)]);
          v.cargarCarpetas();
        }
      } catch {}
      ocupado = false;
    };
    const id = setInterval(tick, 60000);
    const vis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [estado]);

  const abrir = async (m) => {
    if (m.borrador) { setRedactar({ para: nombreDe(m.para) === m.para ? m.para : m.para, asunto: m.asunto, texto: "", borrador: m.borrador }); return; }
    setAbierto({ ...m, cargando: true }); setVerTodos(false); if (celu) setVista("mensaje");
    try {
      // La cadena entera (03/11/2026): lo abierto es el último mensaje (de ahí salen Responder y
      // Reenviar) y abajo vienen los anteriores. Abrirla la deja leída completa.
      const d = await api({ accion: "hilo", id: m.hilo || m.id, carpeta, leer: "1" });
      const msgs = d.mensajes?.length ? d.mensajes : [];
      setAbierto({ ...m, ...(msgs[0] || {}), mensajes: msgs, cargando: false }); setLista((p) => p.map((x) => x.id === m.id ? { ...x, noLeido: false, nNoLeidos: 0 } : x));
      if (m.noLeido) {
        const k = m.nNoLeidos || 1;
        const baja = (n) => Math.max(0, n - k);
        if (carpeta === "bandeja") setNoLeidos(baja); else if (carpeta === "notificaciones") setNoLeidosNotif(baja); else if (carpeta === "spam") setNoLeidosSpam(baja); else setCarpetas((p) => p.map((c) => c.id === carpeta ? { ...c, noLeidos: Math.max(0, (c.noLeidos || 0) - k) } : c));
        const nombre = FIJAS.includes(carpeta) ? carpeta : String(carpetas.find((c) => c.id === carpeta)?.nombre || "").toLowerCase();
        if (["bandeja", "notificaciones", "spam", "dhl", "fedex", "ups"].includes(nombre)) setNoLeidosTotal((n) => (n == null ? n : Math.max(0, n - k)));
      }
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
      await api(null, { accion: "papelera", id: m.id, hilo: m.hilo });
      const i = lista.findIndex((x) => x.id === m.id);
      const resto = lista.filter((x) => x.id !== m.id);
      setLista(resto);
      toast("Movido a la papelera", "success");
      const prox = i >= 0 ? (resto[i] || resto[i - 1]) : null;
      if (prox && !prox.borrador) abrir(prox); else { setAbierto(null); if (celu) setVista("lista"); }
    } catch (e) { toast(e.message, "error"); }
  };
  // Papelera → Restaurar; Spam → No es spam. Las dos sacan la conversación de la lista.
  const sacar = async (m, accion, aviso) => {
    try {
      await api(null, { accion, id: m.id, hilo: m.hilo });
      setLista((p) => p.filter((x) => x.id !== m.id));
      setAbierto(null); if (celu) setVista("lista");
      toast(aviso, "success"); cargarCarpetas();
    } catch (e) { toast(e.message, "error"); }
  };
  // Responder es siempre responder a todos: el remitente (o su Reply-To) + los demás destinatarios, sin mi casilla.
  const responder = (m, plantilla = null) => {
    const yo = String(estado?.email || "").toLowerCase();
    const vistos = new Set([yo]);
    const unicos = (l) => l.filter((x) => { const d = direccion(x); if (!d || vistos.has(d)) return false; vistos.add(d); return true; });
    const para = unicos([...separar(m.responderA || m.de), ...separar(m.para)]);
    const cc = unicos(separar(m.cc));
    setRedactar({ para: para.join(", "), cc: cc.join(", "), asunto: /^re:/i.test(m.asunto) ? m.asunto : `Re: ${m.asunto}`, texto: plantilla ? aplicarPlantilla(plantilla.texto, nombreDe(m.de)) : "", nombreDestino: nombreDe(m.de), hilo: m.hilo, enRespuestaA: m.messageId, referencias: [m.referencias, m.messageId].filter(Boolean).join(" "), origen: m });
  };
  const reenviar = (m) => setRedactar({ para: "", asunto: /^(fwd?|rv):/i.test(m.asunto) ? m.asunto : `Fwd: ${m.asunto}`, texto: "", reenviar: m.id, adjOrig: m.adjuntos || [], origen: m });

  // ── Sin conectar ──
  if (!estado) return <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "3rem 0" }}>Cargando…</p>;
  if (!estado.conectado) return <div style={{ maxWidth: 520, margin: "40px auto", textAlign: "center", padding: "32px 24px", borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
    <div style={{ width: 54, height: 54, borderRadius: 16, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(184,149,106,0.14)", color: GOLD_LIGHT }}><Ico d={I.bandeja} s={26} /></div>
    <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>Conectá tu Gmail</p>
    {!estado.configurado && <p style={{ fontSize: 13, color: "#fbbf24", margin: "0 0 16px", lineHeight: 1.5 }}>Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel.</p>}
    <button disabled={!estado.configurado} onClick={async () => { try { const d = await api({ accion: "conectar" }); window.location.href = d.url; } catch (e) { toast(e.message, "error"); } }} style={{ height: 46, padding: "0 24px", borderRadius: 12, border: "none", background: estado.configurado ? `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})` : "rgba(255,255,255,0.08)", color: estado.configurado ? "#0A1628" : "rgba(255,255,255,0.4)", fontWeight: 800, fontSize: 14, cursor: estado.configurado ? "pointer" : "not-allowed" }}>Conectar Gmail</button>
  </div>;

  // ── Rediseño 23/10/2026: tres columnas a pantalla completa, cada una con su scroll. Desde el
  // 02/11/2026 sin tarjeta: ocupa todo el ancho y alto del admin, como parte del sistema. ──
  const NAV = [{ k: "bandeja", l: "Bandeja", ic: I.bandeja, n: noLeidos }, { k: "notificaciones", l: "Notificaciones", ic: I.notificaciones, n: noLeidosNotif }, { k: "enviados", l: "Enviados", ic: I.enviados }, { k: "borradores", l: "Borradores", ic: I.borradores }, { k: "spam", l: "Spam", ic: I.spam, n: noLeidosSpam }, { k: "papelera", l: "Papelera", ic: I.papelera }];
  const elegir = (k) => { setCarpeta(k); if (celu) setVista("lista"); };
  const marca = (l) => { const x = String(l || "").toLowerCase(); return x === "dhl" ? "dhl" : x === "fedex" ? "fedex" : x === "ups" ? "ups" : null; };
  const esAuto = (n) => /avisos|dmarc/i.test(n);
  const couriers = carpetas.filter((c) => marca(c.nombre)).sort((x, y) => ["dhl", "fedex", "ups"].indexOf(marca(x.nombre)) - ["dhl", "fedex", "ups"].indexOf(marca(y.nombre)));
  const automaticas = carpetas.filter((c) => esAuto(c.nombre)).sort((x, y) => x.nombre.localeCompare(y.nombre));
  const ordenMarca = (c) => MARCAS_CARPETA[String(c.nombre).toLowerCase()] || 99;
  const otras = carpetas.filter((c) => !marca(c.nombre) && !esAuto(c.nombre)).sort((x, y) => ordenMarca(x) - ordenMarca(y) || x.nombre.localeCompare(y.nombre));
  const iconoCarpeta = (n) => { const x = String(n).toLowerCase(); return x === "whatsapp" ? WA : x === "facebook" ? FB : x === "google" ? GOOGLE : <Ico d={I.carpeta} />; };

  // soloLogo: los couriers van con su logo y sin texto (el logo ya dice qué es).
  const fila = (k, l, icono, n, { tenue = false, soloLogo = false, alto = 0 } = {}) => {
    const on = carpeta === k;
    return <button key={k} onClick={() => elegir(k)} className="mp-fila" data-on={on ? "1" : "0"} style={{ position: "relative", width: "100%", display: "flex", alignItems: "center", gap: 10, height: alto || (soloLogo ? 42 : 38), padding: "0 10px 0 12px", borderRadius: 10, border: "none", background: on ? "rgba(184,149,106,0.14)" : "transparent", color: on ? GOLD_LIGHT : tenue ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.78)", fontSize: 13.5, fontWeight: on ? 800 : 600, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
      {on && <span style={{ position: "absolute", left: 0, top: 9, bottom: 9, width: 3, borderRadius: 3, background: GOLD_LIGHT }} />}
      {soloLogo ? <span title={l} style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center" }}>{icono}</span> : <>
        <span style={{ width: 22, display: "inline-flex", justifyContent: "center", flexShrink: 0 }}>{icono}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</span>
      </>}
      {n > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 7px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, background: tenue ? "rgba(255,255,255,0.08)" : "#ef4444", color: tenue ? "rgba(255,255,255,0.55)" : "#fff" }}>{n}</span>}
    </button>;
  };
  const seccion = (t) => <p style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", margin: "18px 12px 6px" }}>{t}</p>;

  const panelCarpetas = <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: celu ? 0 : "14px 10px" }}>
    <button onClick={() => setRedactar({ para: "", asunto: "", texto: "" })} style={{ height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, border: "none", background: `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})`, color: "#0A1628", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 22px rgba(184,149,106,0.22)", fontFamily: "inherit" }}><Ico d={I.borradores} s={16} />Redactar</button>
    {seccion("Correo")}
    {NAV.map((x) => fila(x.k, x.l, <Ico d={x.ic} />, x.n))}
    {couriers.length > 0 && seccion("Couriers")}
    {couriers.map((c) => fila(c.id, c.nombre, <CarrierLogo k={marca(c.nombre)} alto={26} radio={7} />, c.noLeidos, { soloLogo: true }))}
    {otras.length > 0 && seccion("Carpetas")}
    {otras.map((c) => String(c.nombre).toLowerCase() === "tracking cargas china"
      ? fila(c.id, c.nombre, <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}><img src="/brand/mybox.png" alt="MyBox" style={{ height: 15, width: "auto", alignSelf: "flex-start", display: "block" }} /><span style={{ fontSize: 12.5, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</span></span>, c.noLeidos, { soloLogo: true, alto: 50 })
      : fila(c.id, c.nombre, iconoCarpeta(c.nombre), c.noLeidos))}
    {automaticas.length > 0 && seccion("Automáticas · se leen solas")}
    {automaticas.map((c) => fila(c.id, c.nombre, <Ico d={I.carpeta} />, c.noLeidos, { tenue: true }))}
    <div style={{ marginTop: "auto", paddingTop: 16 }}>
      <button onClick={() => setPrefsAbierto(true)} style={{ width: "100%", height: 36, marginBottom: 6, borderRadius: 10, border: "1px solid rgba(184,149,106,0.35)", background: "rgba(184,149,106,0.08)", color: GOLD_LIGHT, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✍ Firma y plantillas</button>
      <button onClick={() => setFiltrosAbierto(true)} style={{ width: "100%", height: 36, borderRadius: 10, border: "1px dashed rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Carpetas y filtros</button>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "10px 4px 0", wordBreak: "break-all" }}>{estado.email}</p>
    </div>
  </div>;

  const titulo = NAV.find((x) => x.k === carpeta)?.l || carpetas.find((c) => c.id === carpeta)?.nombre || "";
  const nCarpeta = carpeta === "bandeja" ? noLeidos : carpeta === "notificaciones" ? noLeidosNotif : carpeta === "spam" ? noLeidosSpam : carpetas.find((c) => c.id === carpeta)?.noLeidos || 0;
  const panelLista = <div style={{ display: "flex", flexDirection: "column", minWidth: 0, height: celu ? "auto" : "100%" }}>
    <div style={{ padding: celu ? "0 0 12px" : "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {celu && <button onClick={() => setVista("carpetas")} style={btnIco} aria-label="Carpetas"><Ico d={I.carpeta} /></button>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</p>
          <p style={{ margin: "1px 0 0", fontSize: 12, color: nCarpeta > 0 ? "#fca5a5" : "rgba(255,255,255,0.4)", fontWeight: 600 }}>{nCarpeta > 0 ? `${nCarpeta} sin leer` : "Todo leído"}</p>
        </div>
        <button onClick={() => { cargarCarpetas(); cargarLista(false); }} style={btnIco} aria-label="Actualizar" title="Actualizar"><Ico d={["M23 4v6h-6", "M1 20v-6h6", "M3.51 9a9 9 0 0 1 14.85-3.36L23 10", "M1 14l4.64 4.36A9 9 0 0 0 20.49 15"]} s={15} /></button>
        {celu && <button onClick={() => setRedactar({ para: "", asunto: "", texto: "" })} style={{ ...btnIco, background: `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})`, color: "#0A1628", border: "none" }} aria-label="Redactar"><Ico d={I.borradores} /></button>}
      </div>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: 11, color: "rgba(255,255,255,0.35)" }}><Ico d={["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.35-4.35"]} s={15} /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar en ${titulo.toLowerCase()}`} style={{ width: "100%", boxSizing: "border-box", height: 38, padding: "0 12px 0 36px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.22)", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
      </div>
    </div>
    <div style={{ flex: 1, overflowY: celu ? "visible" : "auto", minHeight: 0 }}>
      {lista.length === 0 && !cargando && <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "3rem 1rem", fontSize: 13 }}>No hay mails.</div>}
      {lista.map((m) => { const on = abierto?.id === m.id; const quien = carpeta === "enviados" || m.borrador ? nombreDe(m.para) : nombreDe(m.de); return <button key={m.id} onClick={() => abrir(m)} className="mp-mail" data-on={on ? "1" : "0"} style={{ position: "relative", width: "100%", display: "flex", gap: 12, textAlign: "left", padding: "12px 16px", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", background: on ? "rgba(184,149,106,0.1)" : "transparent", cursor: "pointer", fontFamily: "inherit", color: "#fff" }}>
        {on && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: GOLD_LIGHT }} />}
        <Avatar nombre={quien} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: m.noLeido ? 800 : 600, color: m.noLeido ? "#fff" : "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{carpeta === "enviados" || m.borrador ? `Para: ${quien}` : quien}</span>
            {m.n > 1 && <span title={`${m.n} mensajes en la conversación`} style={{ fontSize: 10.5, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", flexShrink: 0 }}>{m.n}</span>}
            {m.spam && carpeta !== "spam" && <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "rgba(248,113,113,0.15)", color: "#f87171" }}>SPAM</span>}
            {m.adjuntos && <span style={{ color: "rgba(255,255,255,0.4)", display: "inline-flex" }}><Ico d={I.clip} s={13} /></span>}
            <span style={{ fontSize: 11.5, color: m.noLeido ? GOLD_LIGHT : "rgba(255,255,255,0.4)", fontWeight: m.noLeido ? 700 : 500, flexShrink: 0 }}>{fmtFecha(m.fecha)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            {m.noLeido && <span style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD_LIGHT, flexShrink: 0 }} />}
            <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13, fontWeight: m.noLeido ? 700 : 500, color: m.noLeido ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.asunto || "(sin asunto)"}</p>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.extracto}</p>
        </div>
      </button>; })}
      {cargando && <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "1rem 0", fontSize: 12.5 }}>Cargando…</p>}
      {sig && !cargando && <button onClick={() => cargarLista(true)} style={{ width: "100%", padding: "14px", border: "none", background: "transparent", color: GOLD_LIGHT, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Ver más</button>}
    </div>
  </div>;

  const noLeido = async (m) => { try { await api(null, { accion: "leido", id: m.id, leido: false }); setLista((p) => p.map((x) => x.id === m.id ? { ...x, noLeido: true } : x)); cargarCarpetas(); toast("Marcado como no leído", "success"); setAbierto(null); if (celu) setVista("lista"); } catch (e) { toast(e.message, "error"); } };
  const panelMensaje = abierto ? <div style={{ minWidth: 0, height: celu ? "auto" : "100%", display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: celu ? "0 0 12px" : "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, flexWrap: "wrap" }}>
      {celu && <button onClick={() => { setVista("lista"); setAbierto(null); }} style={btnIco} aria-label="Volver"><Ico d={I.volver} /></button>}
      <button onClick={() => responder(abierto)} disabled={abierto.cargando} style={{ ...btnTxt, border: "none", background: `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})`, color: "#0A1628" }}><Ico d={I.responder} s={15} />Responder a todos</button>
      <button onClick={() => reenviar(abierto)} disabled={abierto.cargando} style={btnTxt}><Ico d={I.reenviar} s={15} />Reenviar</button>
      {prefs.plantillas.length > 0 && <div style={{ position: "relative" }}>
        <button onClick={() => setMenuPlantillas((v) => !v)} disabled={abierto.cargando} style={btnTxt}><Ico d={["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M8 13h8", "M8 17h5"]} s={15} />Responder con plantilla ▾</button>
        {menuPlantillas && <><div onClick={() => setMenuPlantillas(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: 42, left: 0, zIndex: 41, minWidth: 240, padding: 6, borderRadius: 12, background: "#14223a", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 16px 40px rgba(0,0,0,0.45)" }}>
            {prefs.plantillas.map((pl) => <button key={pl.id} onClick={() => { setMenuPlantillas(false); responder(abierto, pl); }} style={{ width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 8, border: "none", background: "transparent", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>{pl.titulo}</button>)}
          </div></>}
      </div>}
      <span style={{ flex: 1 }} />
      <button onClick={() => noLeido(abierto)} style={btnIco} aria-label="Marcar como no leído" title="Marcar como no leído"><Ico d={["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z", "M22 6l-10 7L2 6"]} s={15} /></button>
      {carpeta === "spam" && <button onClick={() => sacar(abierto, "mover", "Movido a la bandeja")} style={btnTxt}><Ico d={I.bandeja} s={15} />No es spam</button>}
      {carpeta === "papelera"
        ? <button onClick={() => sacar(abierto, "restaurar", "Restaurado")} style={btnTxt}><Ico d={I.restaurar} s={15} />Restaurar</button>
        : <button onClick={() => papelera(abierto)} style={{ ...btnIco, color: "#fca5a5" }} aria-label="Papelera" title="Mover a la papelera"><Ico d={I.papelera} s={15} /></button>}
    </div>
    <div style={{ flex: 1, overflowY: celu ? "visible" : "auto", minHeight: 0, padding: celu ? "14px 0" : "20px 24px 28px" }}>
      <p style={{ fontSize: 21, fontWeight: 800, color: "#fff", margin: "0 0 4px", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{abierto.asunto || "(sin asunto)"}</p>
      {(abierto.mensajes?.length || 0) > 1 && <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{abierto.mensajes.length} mensajes</p>}
      {abierto.cargando ? <>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, margin: "14px 0 16px" }}>
          <Avatar nombre={nombreDe(abierto.de)} tam={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, color: "#fff", margin: 0, fontWeight: 800, wordBreak: "break-word" }}>{nombreDe(abierto.de)}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "2px 0 0", wordBreak: "break-word" }}>Para {abierto.para}</p>
          </div>
        </div>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Cargando…</p>
      </> : (() => {
        // Toda la conversación (03/11/2026), del más nuevo al más viejo; con más de 4 mensajes los
        // viejos quedan plegados en un botón.
        const todos = abierto.mensajes || [];
        const visibles = verTodos || todos.length <= 4 ? todos : todos.slice(0, 3);
        return <>
          {visibles.map((m, i) => <MensajeCadena key={m.id} m={m} verAdjunto={verAdjunto} bajar={bajar} primero={i === 0} />)}
          {visibles.length < todos.length && <button onClick={() => setVerTodos(true)} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)", color: GOLD_LIGHT, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Ver los {todos.length - visibles.length} mensajes anteriores</button>}
        </>;
      })()}
    </div>
  </div> : !celu && <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(255,255,255,0.35)" }}>
    <span style={{ width: 64, height: 64, borderRadius: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(184,149,106,0.1)", color: GOLD_LIGHT }}><Ico d={I.bandeja} s={28} /></span>
    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>Elegí un mail para leerlo</p>
    {nCarpeta > 0 && <p style={{ margin: 0, fontSize: 12.5 }}>{nCarpeta} sin leer en {titulo}</p>}
  </div>;

  return <div>
    <style>{`.mp-fila[data-on="0"]:hover{background:rgba(255,255,255,0.05)!important}.mp-mail[data-on="0"]:hover{background:rgba(255,255,255,0.035)!important}`}</style>
    {celu
      ? (vista === "carpetas" ? panelCarpetas : vista === "mensaje" && abierto ? panelMensaje : panelLista)
      : <div style={{ display: "grid", gridTemplateColumns: "196px minmax(290px,330px) minmax(0,1fr)", height: "var(--vh100)", minHeight: 560, overflow: "hidden" }}>
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", background: "rgba(0,0,0,0.12)" }}>{panelCarpetas}</div>
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", minHeight: 0, overflow: "hidden" }}>{panelLista}</div>
        <div style={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>{panelMensaje}</div>
      </div>}
    {redactar && <Redactar inicial={redactar} celu={celu} api={api} prefs={prefs} verAdjunto={verAdjunto} bajar={bajar} onCerrar={(enviado) => { setRedactar(null); if (enviado) { cargarLista(false); if (abierto && !abierto.cargando && !abierto.borrador) abrir(abierto); } }} />}
    {filtrosAbierto && <Filtros api={api} celu={celu} onCerrar={() => { setFiltrosAbierto(false); cargarCarpetas(); }} />}
    {prefsAbierto && <Preferencias api={api} celu={celu} prefs={prefs} onCerrar={(nuevas) => { setPrefsAbierto(false); if (nuevas) setPrefs(nuevas); }} />}
  </div>;
}

// Avatar con las iniciales; el color sale del nombre (siempre el mismo para el mismo remitente).
function Avatar({ nombre, tam = 34 }) {
  const n = String(nombre || "?").replace(/["']/g, "").trim();
  const ini = (n.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("") || "?").toUpperCase();
  let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return <span style={{ width: tam, height: tam, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `hsl(${h} 45% 32%)`, color: `hsl(${h} 80% 85%)`, fontSize: tam * 0.36, fontWeight: 800, letterSpacing: "0.02em" }}>{ini}</span>;
}

// Cuerpo HTML del mail: sin scripts, pero con allow-same-origin para medir el alto y mostrarlo entero
// (sin scroll interno). Sigue el alto cuando cargan las imágenes.
function CuerpoMail({ html }) {
  const ref = useRef(null);
  // Los mails más anchos que la columna (FedEx, DHL) se achican con zoom para verse enteros
  // (02/11/2026); si aun así no entran, queda el scroll lateral.
  const medir = () => { try {
    const el = ref.current; const doc = el?.contentDocument; const body = doc?.body; if (!body) return;
    body.style.zoom = "1";
    const ancho = el.clientWidth; const natural = body.scrollWidth;
    const z = ancho > 0 && natural > ancho ? Math.max(0.55, ancho / natural) : 1;
    if (z < 1) body.style.zoom = String(z);
    const h = Math.ceil(body.getBoundingClientRect().height); if (h > 0) el.style.height = `${Math.max(160, h + 4)}px`;
  } catch {} };
  useEffect(() => { let ro; const el = ref.current; const al = () => { medir(); try { const doc = el.contentDocument; ro = new ResizeObserver(medir); ro.observe(doc.body); ro.observe(el); doc.querySelectorAll("img").forEach((i) => i.addEventListener("load", medir)); } catch {} }; el?.addEventListener("load", al); try { if (el?.contentDocument?.readyState === "complete" && el.contentDocument.body?.childElementCount) al(); } catch {} return () => { el?.removeEventListener("load", al); ro?.disconnect(); }; }, [html]);
  return <iframe ref={ref} title="mail" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={`<!doctype html><meta charset="utf-8"><base target="_blank"><style>html{overflow:hidden}body{overflow-x:auto;overflow-y:hidden;margin:0;font-family:Arial,sans-serif;font-size:14px;color:#111;background:#fff;padding:16px;word-break:break-word}img{max-width:100%;height:auto}table{max-width:100%}</style>${html}`} style={{ width: "100%", height: 600, border: "none", borderRadius: 12, background: "#fff", display: "block" }} />;
}

const btnIco = { width: 36, height: 36, flexShrink: 0, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.8)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 };
const btnTxt = { height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.85)", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit" };
const campo = { width: "100%", height: 42, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13.5, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

function Modal({ celu, onCerrar, children, ancho = 640 }) {
  return <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: celu ? "stretch" : "flex-start", justifyContent: "center", padding: celu ? 0 : "40px 16px", overflowY: "auto" }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: celu ? "none" : ancho, minHeight: celu ? "100%" : undefined, boxSizing: "border-box", background: "linear-gradient(160deg,#142038,#0e1a2c)", border: celu ? "none" : "1px solid rgba(255,255,255,0.1)", borderRadius: celu ? 0 : 18, padding: celu ? "16px" : "20px 22px", margin: celu ? 0 : "auto" }}>{children}</div>
  </div>;
}

// Adjuntos de un mail recibido (ver / bajar): en el mensaje abierto y en cada mail de la cadena.
function Adjuntos({ m, verAdjunto, bajar }) {
  if (!m.adjuntos?.length) return null;
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8, marginBottom: 16 }}>
    {m.adjuntos.map((a) => { const [t, c] = tipoArchivo(a); return <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px 8px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.03)", minWidth: 0 }}>
      <span style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${c}22`, color: c, fontSize: 9.5, fontWeight: 900, letterSpacing: "0.04em" }}>{t}</span>
      <button onClick={() => verAdjunto(m, a)} title={a.nombre} style={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "transparent", color: "#fff", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span>
        <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{pesoTxt(a.tamano)}</span>
      </button>
      <button onClick={() => bajar(m, a)} aria-label="Descargar" title="Descargar" style={{ ...btnIco, width: 30, height: 30 }}><Ico d={I.bajar} s={14} /></button>
    </div>; })}
  </div>;
}

// Un mail de la cadena, al lado del redactor.
function MensajeCadena({ m, verAdjunto, bajar, primero }) {
  return <div style={{ padding: "18px 0 20px", borderTop: primero ? "none" : "1px solid rgba(255,255,255,0.07)" }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
      <Avatar nombre={nombreDe(m.de)} tam={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, color: "#fff", margin: 0, fontWeight: 800, wordBreak: "break-word" }}>{nombreDe(m.de)} <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 500, fontSize: 12 }}>{String(m.de).match(/<([^>]+)>/)?.[1] || ""}</span></p>
        <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", margin: "2px 0 0", wordBreak: "break-word" }}>Para {m.para}{m.cc ? ` · Cc ${m.cc}` : ""}</p>
      </div>
      <span style={{ fontSize: 11.5, color: primero ? GOLD_LIGHT : "rgba(255,255,255,0.45)", fontWeight: primero ? 800 : 500, whiteSpace: "nowrap" }}>{fechaTxt(m.fecha)}</span>
    </div>
    <Adjuntos m={m} verAdjunto={verAdjunto} bajar={bajar} />
    {m.html ? <CuerpoMail key={m.id} html={m.html} />
      : <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.6 }}>{m.texto || m.extracto || ""}</pre>}
  </div>;
}

// Redactor a pantalla entera (02/11/2026). Al responder o reenviar, la cadena completa queda a la
// izquierda (del más nuevo al más viejo) y el mail se escribe a la derecha, sin cerrar nada para
// releer lo que se habló. En el celu: Respuesta / Cadena con un selector arriba.
function Redactar({ inicial, celu, api, prefs, verAdjunto, bajar, onCerrar }) {
  const [f, setF] = useState({ para: inicial.para || "", cc: inicial.cc || "", asunto: inicial.asunto || "", texto: inicial.texto || "" });
  const [conFirma, setConFirma] = useState(true);
  const firmaOn = prefs?.firma?.activa !== false;
  const usarPlantilla = (pl) => setF((p) => ({ ...p, texto: aplicarPlantilla(pl.texto, inicial.nombreDestino || ""), asunto: p.asunto || pl.asunto || "" }));
  const [adj, setAdj] = useState([]);
  const [verCc, setVerCc] = useState(!!inicial.cc);
  const [arrastrando, setArrastrando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const input = useRef(null);
  const total = adj.reduce((a, x) => a + x.tamano, 0);
  const origen = inicial.origen || null;
  const [cadena, setCadena] = useState(null);
  const [solapa, setSolapa] = useState("escribir");
  useEffect(() => {
    if (!origen?.hilo) return;
    let vivo = true;
    api({ accion: "hilo", id: origen.hilo }).then((d) => { if (vivo) setCadena(d.mensajes?.length ? d.mensajes : [origen]); }).catch(() => { if (vivo) setCadena([origen]); });
    return () => { vivo = false; };
  }, [api, origen]);
  const agregar = async (files) => {
    const nuevos = await Promise.all([...files].map((file) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ nombre: file.name, tipo: file.type || "application/octet-stream", tamano: file.size, datos: String(r.result).split(",")[1] || "" }); r.onerror = () => res(null); r.readAsDataURL(file); })));
    setAdj((p) => [...p, ...nuevos.filter(Boolean)]);
  };
  const ir = async (accion) => {
    if (total > MAX_ADJ) { toast(`Los adjuntos pesan ${pesoTxt(total)}: el máximo es ${pesoTxt(MAX_ADJ)}`, "error"); return; }
    setEnviando(true);
    try { await api(null, { accion, ...f, sinFirma: !conFirma, adjuntos: adj, hilo: inicial.hilo, enRespuestaA: inicial.enRespuestaA, referencias: inicial.referencias, borrador: inicial.borrador, reenviar: inicial.reenviar }); toast(accion === "enviar" ? "Mail enviado" : "Borrador guardado", "success"); onCerrar(true); }
    catch (e) { toast(e.message, "error"); setEnviando(false); }
  };
  const titulo = inicial.reenviar ? "Reenviar" : inicial.hilo ? "Responder a todos" : "Nuevo mail";
  const fijo = { ...campo, flexShrink: 0 };
  const seg = (k, l) => <button onClick={() => setSolapa(k)} style={{ height: 30, padding: "0 12px", borderRadius: 999, border: "none", background: solapa === k ? `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})` : "transparent", color: solapa === k ? "#0A1628" : "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>;

  const lista = cadena || (origen ? [origen] : []);
  const panelCadena = origen && <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto", padding: celu ? "4px 16px 24px" : "16px 28px 28px" }}>
    <p style={{ fontSize: 19, fontWeight: 800, color: "#fff", margin: "0 0 2px", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{origen.asunto || "(sin asunto)"}</p>
    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "0 0 6px" }}>{cadena ? `${cadena.length} mensaje${cadena.length === 1 ? "" : "s"}` : "Cargando la cadena…"}</p>
    {lista.map((m, i) => <MensajeCadena key={m.id} m={m} verAdjunto={verAdjunto} bajar={bajar} primero={i === 0} />)}
  </div>;

  const solo = !origen && !celu;
  const panelEscribir = <div onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)} onDrop={(e) => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files); }}
    style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: 0, boxSizing: "border-box", overflowY: "auto", flex: celu || solo ? 1 : "0 0 560px", width: celu || solo ? "100%" : 560, maxWidth: solo ? 820 : "none", margin: solo ? "0 auto" : 0, padding: celu ? "12px 16px 16px" : "18px 22px 20px", borderLeft: origen && !celu ? "1px solid rgba(255,255,255,0.07)" : "none", background: origen && !celu ? "rgba(0,0,0,0.14)" : "transparent" }}>
    {arrastrando && <div style={{ position: "absolute", inset: 8, zIndex: 5, borderRadius: 14, border: `2px dashed ${GOLD}`, background: "rgba(184,149,106,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: GOLD_LIGHT, fontWeight: 800, fontSize: 15, pointerEvents: "none" }}>Soltá los archivos acá</div>}
    <div style={{ display: "flex", gap: 8, marginBottom: 8, flexShrink: 0 }}>
      <input value={f.para} onChange={(e) => setF((p) => ({ ...p, para: e.target.value }))} placeholder="Para" style={campo} />
      {!verCc && <button onClick={() => setVerCc(true)} style={{ ...btnTxt, height: 42 }}>Cc</button>}
    </div>
    {verCc && <input value={f.cc} onChange={(e) => setF((p) => ({ ...p, cc: e.target.value }))} placeholder="Cc" style={{ ...fijo, marginBottom: 8 }} />}
    <input value={f.asunto} onChange={(e) => setF((p) => ({ ...p, asunto: e.target.value }))} placeholder="Asunto" style={{ ...fijo, marginBottom: 8 }} />
    {prefs?.plantillas?.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8, flexShrink: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 2 }}>Plantillas</span>
      {prefs.plantillas.map((pl) => <button key={pl.id} onClick={() => usarPlantilla(pl)} style={{ height: 28, padding: "0 11px", borderRadius: 999, border: "1px solid rgba(184,149,106,0.4)", background: "rgba(184,149,106,0.1)", color: GOLD_LIGHT, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{pl.titulo}</button>)}
    </div>}
    <textarea data-enter-libre="1" value={f.texto} onChange={(e) => setF((p) => ({ ...p, texto: e.target.value }))} placeholder="Escribí el mail o arrastrá archivos acá" style={{ ...campo, flex: "1 1 220px", minHeight: celu ? 260 : 220, height: "auto", padding: 12, resize: "none", lineHeight: 1.55 }} />
    {firmaOn && <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: conFirma ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.35)", textDecoration: conFirma ? "none" : "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>✍ Firma: {[prefs.firma.nombre, prefs.firma.cargo].filter(Boolean).join(" · ")}</span>
      <button onClick={() => setConFirma((v) => !v)} style={{ height: 26, padding: "0 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{conFirma ? "Sin firma en este mail" : "Poner firma"}</button>
    </div>}
    {inicial.reenviar && <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12.5, color: "rgba(255,255,255,0.65)", flexShrink: 0 }}>Va el mail original abajo{inicial.adjOrig?.length ? <> con {inicial.adjOrig.length} adjunto{inicial.adjOrig.length > 1 ? "s" : ""}: <b style={{ color: "#fff" }}>{inicial.adjOrig.map((a) => a.nombre).join(", ")}</b></> : null}</div>}
    {adj.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, flexShrink: 0 }}>
      {adj.map((a, i) => <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 6px 6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12, color: "#fff", maxWidth: "100%" }}>
        <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span><span style={{ color: "rgba(255,255,255,0.45)" }}>{pesoTxt(a.tamano)}</span>
        <button onClick={() => setAdj((p) => p.filter((_, j) => j !== i))} aria-label="Quitar" style={{ width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ico d={I.x} s={11} /></button>
      </span>)}
      {total > MAX_ADJ && <span style={{ fontSize: 12, color: "#f87171", fontWeight: 700, alignSelf: "center" }}>Máximo {pesoTxt(MAX_ADJ)} en total</span>}
    </div>}
    <input ref={input} type="file" multiple style={{ display: "none" }} onChange={(e) => { agregar(e.target.files); e.target.value = ""; }} />
    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", flexShrink: 0 }}>
      <button onClick={() => input.current?.click()} style={btnTxt}><Ico d={I.clip} s={15} />Adjuntar</button>
      <span style={{ flex: 1 }} />
      {!inicial.reenviar && <button onClick={() => ir("borrador")} disabled={enviando} style={btnTxt}>Guardar borrador</button>}
      <button onClick={() => ir("enviar")} disabled={enviando} style={{ ...btnTxt, border: "none", background: `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})`, color: "#0A1628", padding: "0 20px" }}>{enviando ? "Enviando…" : "Enviar"}</button>
    </div>
  </div>;

  return <div style={{ position: "fixed", inset: 0, zIndex: 1200, background: "linear-gradient(160deg,#142038,#0e1a2c)", display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: celu ? "10px 12px" : "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, background: "rgba(0,0,0,0.18)" }}>
      <button onClick={() => !enviando && onCerrar(false)} style={btnIco} aria-label="Cerrar"><Ico d={celu ? I.volver : I.x} s={15} /></button>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}{!celu && origen ? <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 600 }}> · {origen.asunto}</span> : null}</p>
      {celu && origen && <div style={{ display: "inline-flex", padding: 3, borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>{seg("escribir", "Respuesta")}{seg("cadena", cadena ? `Cadena · ${cadena.length}` : "Cadena")}</div>}
    </div>
    <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      {celu ? (origen && solapa === "cadena" ? panelCadena : panelEscribir) : <>{panelCadena}{panelEscribir}</>}
    </div>
  </div>;
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

// Firma y plantillas (23/10/2026): la firma va sola al final de cada mail; las plantillas se insertan con
// un toque al redactar o con "Responder con plantilla". {nombre} se reemplaza por el nombre de a quién
// se le responde.
function Preferencias({ api, celu, prefs, onCerrar }) {
  const [firma, setFirma] = useState({ ...FIRMA_DEF, ...(prefs.firma || {}) });
  const [plantillas, setPlantillas] = useState(prefs.plantillas || []);
  const [guardando, setGuardando] = useState(false);
  const campoF = (k, l, ph) => <label style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</span><input value={firma[k] || ""} onChange={(e) => setFirma((p) => ({ ...p, [k]: e.target.value }))} placeholder={ph} style={campo} /></label>;
  const guardar = async () => {
    setGuardando(true);
    try { const d = await api(null, { accion: "preferencias", firma, plantillas }); toast("Firma y plantillas guardadas", "success"); onCerrar({ firma: d.firma, plantillas: d.plantillas }); }
    catch (e) { toast(e.message, "error"); setGuardando(false); }
  };
  const ch = (i, k, v) => setPlantillas((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return <Modal celu={celu} onCerrar={() => !guardando && onCerrar(null)} ancho={760}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>Firma y plantillas</p>
      <button onClick={() => onCerrar(null)} style={btnIco} aria-label="Cerrar"><Ico d={I.x} s={15} /></button>
    </div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.1em" }}>Firma</p>
      <button onClick={() => setFirma((p) => ({ ...p, activa: p.activa === false }))} style={{ height: 28, padding: "0 12px", borderRadius: 999, border: `1px solid ${firma.activa !== false ? "rgba(74,222,128,0.45)" : "rgba(255,255,255,0.15)"}`, background: firma.activa !== false ? "rgba(34,197,94,0.12)" : "transparent", color: firma.activa !== false ? "#4ade80" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{firma.activa !== false ? "✓ Va en todos los mails" : "Apagada"}</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: celu ? "1fr" : "1fr 1fr", gap: 10 }}>
      {campoF("nombre", "Nombre", "Bautista Artuso")}
      {campoF("cargo", "Cargo / empresa", "Argencargo")}
      {campoF("whatsapp", "WhatsApp", "+54 9 11 ...")}
      {campoF("web", "Web", "argencargo.com.ar")}
      <div style={{ gridColumn: celu ? "auto" : "1 / -1" }}>{campoF("direccion", "Dirección", "Calle, barrio, ciudad")}</div>
    </div>
    <p style={{ margin: "12px 0 6px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>Así se ve</p>
    <iframe title="firma" srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;padding:6px 16px 16px;background:#fff">${firmaHtml(firma)}</body>`} style={{ width: "100%", height: 150, border: "none", borderRadius: 12, background: "#fff", display: "block" }} />

    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 10px" }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.1em" }}>Plantillas</p>
      <button onClick={() => setPlantillas((p) => [...p, { id: `p${Date.now()}`, titulo: "", asunto: "", texto: "" }])} style={btnTxt}>+ Nueva plantilla</button>
    </div>
    <p style={{ margin: "0 0 10px", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{"{nombre}"} se cambia por el nombre de la persona a la que le respondés.</p>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {plantillas.map((pl, i) => <div key={pl.id || i} style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={pl.titulo} onChange={(e) => ch(i, "titulo", e.target.value)} placeholder="Nombre de la plantilla (ej. Cotización → WhatsApp)" style={{ ...campo, fontWeight: 700 }} />
          <button onClick={() => setPlantillas((p) => p.filter((_, j) => j !== i))} style={{ ...btnIco, height: 42, width: 42, color: "#fca5a5" }} aria-label="Borrar plantilla"><Ico d={I.papelera} s={15} /></button>
        </div>
        <input value={pl.asunto || ""} onChange={(e) => ch(i, "asunto", e.target.value)} placeholder="Asunto (opcional, para mails nuevos)" style={campo} />
        <textarea data-enter-libre="1" value={pl.texto} onChange={(e) => ch(i, "texto", e.target.value)} placeholder="Texto de la plantilla" style={{ ...campo, height: 150, padding: 12, resize: "vertical", lineHeight: 1.55 }} />
      </div>)}
      {!plantillas.length && <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Sin plantillas.</p>}
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
      <button onClick={() => onCerrar(null)} disabled={guardando} style={btnTxt}>Cancelar</button>
      <button onClick={guardar} disabled={guardando} style={{ ...btnTxt, border: "none", background: `linear-gradient(135deg,${GOLD_LIGHT},${GOLD})`, color: "#0A1628", padding: "0 20px" }}>{guardando ? "Guardando…" : "Guardar"}</button>
    </div>
  </Modal>;
}
