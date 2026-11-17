"use client";
// Tickets con el agente (17/11/2026). La misma pantalla para los dos lados:
//   rol="admin"  → Argencargo (admin y empleado), en castellano
//   rol="agente" → panel del agente, en castellano o chino (lang)
// A la izquierda la lista de temas (abiertos / cerrados); a la derecha el chat del tema elegido, con fotos.
// En el celu es una cosa por vez: la lista, y al tocar un tema, su chat a pantalla completa.
// Todo va por /api/agente/tickets (la sesión la agrega instalarAuthFetch de cada panel).
// Colores: variables del panel del agente con el valor del admin como reserva, así sirve en los dos.
import { useState, useEffect, useRef, useCallback } from "react";
import { comprimirImagen } from "../../lib/img";

const TX = {
  es: { titulo: "Tickets", nuevo: "Nuevo ticket", abiertos: "Abiertos", cerrados: "Cerrados", asunto: "Asunto", detalle: "Detalle", abrir: "Abrir ticket", cancelar: "Cancelar",
    cerrar: "Cerrar ticket", reabrir: "Reabrir", teToca: "Te toca responder", escribir: "Escribí un mensaje…", enviar: "Enviar", foto: "Adjuntar", zona: "Arrastrá, pegá (⌘V) o tocá para adjuntar fotos y archivos", soltar: "Soltá para adjuntar",
    sinAbiertos: "No hay tickets abiertos", sinCerrados: "No hay tickets cerrados", elegi: "Elegí un ticket", original: "Original", cerrado: "Cerrado", agente: "Agente",
    cerradoPor: "Cerrado por", reabiertoPor: "Reabierto por", volver: "Volver", urgente: "Urgente", normal: "Normal", traduccion: "Traducción", subiendo: "Subiendo…", error: "No se pudo guardar", hoy: "hoy" },
  zh: { titulo: "工单", nuevo: "新建工单", abiertos: "未解决", cerrados: "已关闭", asunto: "主题", detalle: "详情", abrir: "提交工单", cancelar: "取消",
    cerrar: "关闭工单", reabrir: "重新打开", teToca: "待你回复", escribir: "输入消息…", enviar: "发送", foto: "添加附件", zona: "拖放、粘贴或点击添加照片和文件", soltar: "松开以添加",
    sinAbiertos: "没有未解决的工单", sinCerrados: "没有已关闭的工单", elegi: "请选择一个工单", original: "原文", cerrado: "已关闭", agente: "代理",
    cerradoPor: "已关闭：", reabiertoPor: "已重新打开：", volver: "返回", urgente: "紧急", normal: "普通", traduccion: "翻译", subiendo: "正在上传…", error: "保存失败", hoy: "今天" },
};
const INK = (a) => `rgba(var(--ink,255,255,255),${a})`;
const C = { tx: "var(--tx,#fff)", gold: "var(--gold,#E8D098)", panel: "var(--panel,#142038)", green: "var(--green,#22c55e)", red: "var(--red,#f87171)", amber: "var(--amber,#fbbf24)" };
const ORO = "linear-gradient(135deg,#E8D098,#B8956A)";
// Prioridad: alta = rojo, media = amarillo. No hay verde: un ticket abierto siempre es algo sin resolver.
const COLOR = { alta: "#ef4444", media: "#f5b301" };

// Un adjunto es una URL del bucket "tickets": foto (se ve en miniatura) o archivo (se ve como ficha con su nombre).
const esImagen = (u) => /\.(jpe?g|png|webp|gif|heic|heif)(\?|$)/i.test(String(u || ""));
const nombreDe = (u) => { try { const b = decodeURIComponent(String(u).split("/").pop() || ""); return b.replace(/^\d+_[a-z0-9]+_/i, "") || b; } catch { return "archivo"; } };
const ACEPTA = "image/*,application/pdf,.pdf,.xls,.xlsx,.doc,.docx,.csv,.txt";

const api = async (path = "", init) => {
  try { const r = await fetch(`/api/agente/tickets${path}`, init ? { ...init, headers: init.body instanceof FormData ? undefined : { "Content-Type": "application/json" } } : { cache: "no-store" }); return await r.json(); }
  catch { return { error: "sin_conexion" }; }
};

// resta = alto en px que ocupa lo que hay arriba y abajo en la pantalla donde se incrusta.
export default function TicketsAgente({ rol, lang = "es", onPendientes, resta = 170 }) {
  const t = TX[lang === "zh" ? "zh" : "es"];
  const traducido = rol === "admin" || lang === "zh"; // este lado lee al otro por la traducción
  const [d, setD] = useState(null);
  const [filtro, setFiltro] = useState("abierto");
  const [sel, setSel] = useState(null);
  const [hilo, setHilo] = useState(null);
  const [nuevo, setNuevo] = useState(null); // {titulo, texto, fotos, agent_id}
  const [texto, setTexto] = useState(""); const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState(0); const [enviando, setEnviando] = useState(false); const [err, setErr] = useState("");
  const [grande, setGrande] = useState(null);
  const [celu, setCelu] = useState(false);
  const fin = useRef(null); const archivo = useRef(null); const archivoNuevo = useRef(null); const cantidad = useRef(0);
  useEffect(() => { const f = () => setCelu(window.innerWidth < 860); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  // Alto de la pantalla (17/11/2026): llega hasta el borde de abajo de la ventana, esté donde esté incrustada.
  // Se mide desde dónde arranca la caja; si el panel está achicado con un transform (admin al 90 %), se compensa.
  const caja = useRef(null); const [altoPx, setAltoPx] = useState(null);
  const medir = useCallback(() => { const el = caja.current; if (!el) return; const r = el.getBoundingClientRect(); const esc = el.offsetWidth ? r.width / el.offsetWidth : 1; setAltoPx(Math.max(380, Math.floor((window.innerHeight - r.top - 16) / (esc || 1)))); }, []);
  useEffect(() => { medir(); const t1 = setTimeout(medir, 250); window.addEventListener("resize", medir); return () => { clearTimeout(t1); window.removeEventListener("resize", medir); }; }, [medir, celu, d === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargar = useCallback(async () => { const r = await api(); if (!r.error) { setD(r); onPendientes?.(r.pendientes || 0, r.abiertos || 0); } else setD((x) => x || { tickets: [], agentes: [], error: r.error }); }, [onPendientes]);
  const cargarHilo = useCallback(async (id) => { const r = await api(`?id=${id}`); if (!r.error) setHilo((h) => (id === (h?.ticket?.id || id) ? r : h)); }, []);
  useEffect(() => { cargar(); const iv = setInterval(() => { if (!document.hidden) cargar(); }, 30000); return () => clearInterval(iv); }, [cargar]);
  useEffect(() => { if (!sel) { setHilo(null); return; } setHilo(null); cargarHilo(sel).then(cargar); const iv = setInterval(() => { if (!document.hidden) cargarHilo(sel); }, 12000); return () => clearInterval(iv); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  // Al entrar un mensaje nuevo, el chat baja al final.
  useEffect(() => { const n = hilo?.mensajes?.length || 0; if (n !== cantidad.current) { cantidad.current = n; fin.current?.scrollIntoView({ block: "end" }); } }, [hilo]);

  const subir = async (lista, poner) => {
    for (const f of [...(lista || [])]) {
      setSubiendo((n) => n + 1); setErr("");
      try {
        const foto = String(f.type || "").startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name || "");
        const listo = foto ? await comprimirImagen(f, { maxLado: 1800 }).catch(() => f) : f;
        const fd = new FormData(); fd.append("file", listo, listo.name || f.name || (foto ? "foto.jpg" : "archivo"));
        const r = await api("", { method: "POST", body: fd });
        if (r.url) poner((p) => [...p, r.url]); else setErr(r.error || t.error);
      } finally { setSubiendo((n) => n - 1); }
    }
  };
  // Adónde van los adjuntos que se pegan o se sueltan: al ticket nuevo si se está armando, si no al chat abierto.
  const destino = useRef(null);
  destino.current = nuevo ? (f) => setNuevo((n) => (n ? { ...n, fotos: f(n.fotos) } : n)) : sel ? setFotos : null;
  // Pegar (⌘V / Ctrl+V) funciona con la pantalla abierta, esté donde esté el cursor.
  useEffect(() => {
    const f = (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length && destino.current) { e.preventDefault(); subir(fs, destino.current); } };
    document.addEventListener("paste", f); return () => document.removeEventListener("paste", f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Arrastrar y soltar sobre toda la pantalla de tickets.
  const [arrastra, setArrastra] = useState(false); const dentro = useRef(0);
  const conArchivos = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  const dnd = {
    onDragEnter: (e) => { if (!conArchivos(e) || !destino.current) return; e.preventDefault(); dentro.current++; setArrastra(true); },
    onDragOver: (e) => { if (conArchivos(e) && destino.current) e.preventDefault(); },
    onDragLeave: () => { dentro.current = Math.max(0, dentro.current - 1); if (!dentro.current) setArrastra(false); },
    onDrop: (e) => { dentro.current = 0; setArrastra(false); if (!conArchivos(e) || !destino.current) return; e.preventDefault(); subir(e.dataTransfer.files, destino.current); },
  };

  const enviar = async () => {
    if (enviando || subiendo || !sel || (!texto.trim() && !fotos.length)) return;
    setEnviando(true); setErr("");
    const r = await api("", { method: "POST", body: JSON.stringify({ accion: "mensaje", ticket_id: sel, texto, fotos }) });
    setEnviando(false);
    if (r.error) { setErr(r.error); return; }
    setTexto(""); setFotos([]); await cargarHilo(sel); cargar();
  };
  const crear = async () => {
    if (enviando || subiendo || !nuevo) return;
    if (!nuevo.titulo.trim()) { setErr(t.asunto); return; }
    setEnviando(true); setErr("");
    const r = await api("", { method: "POST", body: JSON.stringify({ accion: "crear", ...nuevo }) });
    setEnviando(false);
    if (r.error) { setErr(r.error); return; }
    setNuevo(null); setFiltro("abierto"); await cargar(); setSel(r.ticket.id);
  };
  const prioridad = async (p) => { if (!sel || rol !== "admin") return; setHilo((h) => (h ? { ...h, ticket: { ...h.ticket, prioridad: p } } : h)); const r = await api("", { method: "POST", body: JSON.stringify({ accion: "prioridad", ticket_id: sel, prioridad: p }) }); if (r.error) setErr(r.error); cargar(); };
  const estado = async (accion) => { if (!sel) return; const r = await api("", { method: "POST", body: JSON.stringify({ accion, ticket_id: sel }) }); if (r.error) { setErr(r.error); return; } await cargarHilo(sel); cargar(); if (accion === "cerrar") setFiltro("abierto"); };

  const hora = (iso) => { const x = new Date(iso); const mismo = x.toDateString() === new Date().toDateString(); const hm = x.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }); return mismo ? hm : `${x.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} ${hm}`; };
  const tituloDe = (k) => (k.creado_rol !== rol && traducido && k.titulo_tr) || k.titulo;
  const ultimoDe = (k) => (k.ultimo_rol !== rol && traducido && k.ultimo_texto_tr) || k.ultimo_texto || "";
  const meToca = (k) => k.status === "abierto" && k.ultimo_rol && k.ultimo_rol !== rol;
  const sinLeer = (k) => { const v = rol === "admin" ? k.visto_admin_at : k.visto_agente_at; return k.ultimo_rol && k.ultimo_rol !== rol && (!v || v < k.ultimo_at); };
  const quien = (r) => (r === "admin" ? "Argencargo" : t.agente);

  if (d === null) return <p ref={caja} style={{ color: INK(0.4) }}>…</p>;
  const tickets = d.tickets || [];
  const lista = tickets.filter((k) => k.status === filtro).sort((a, b) => (filtro === "abierto" ? (Number(b.prioridad === "alta") - Number(a.prioridad === "alta")) || (Number(meToca(b)) - Number(meToca(a))) : 0) || String(b.ultimo_at).localeCompare(String(a.ultimo_at)));
  const nAb = tickets.filter((k) => k.status === "abierto").length, nCe = tickets.length - nAb;
  const agentes = d.agentes || [];
  const abrirNuevo = () => { setErr(""); setSel(null); setNuevo({ titulo: "", texto: "", fotos: [], prioridad: "media", agent_id: (agentes.find((a) => a.principal) || agentes[0])?.id || "" }); };

  const campo = { width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 11, border: `1px solid ${INK(0.14)}`, background: INK(0.05), color: C.tx, fontSize: 14.5, fontFamily: "inherit", outline: "none" };
  const btn = (fuerte) => ({ height: 40, padding: "0 16px", borderRadius: 11, border: fuerte ? "none" : `1px solid ${INK(0.16)}`, background: fuerte ? ORO : "transparent", color: fuerte ? "#0A1628" : C.tx, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
  const ficha = (u, chica) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" title={nombreDe(u)} style={{ display: "inline-flex", alignItems: "center", gap: 7, maxWidth: chica ? 180 : 260, height: chica ? 64 : 38, padding: "0 12px", boxSizing: "border-box", borderRadius: 10, border: `1px solid ${INK(0.16)}`, background: INK(0.05), color: C.tx, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}><span>📄</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(u)}</span></a>;
  const miniaturas = (urls, quitar) => urls.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{urls.map((u) => <span key={u} style={{ position: "relative" }}>
    {esImagen(u) ? <img src={u} alt="" onClick={() => setGrande(u)} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, border: `1px solid ${INK(0.14)}`, cursor: "zoom-in", display: "block" }} /> : ficha(u, true)}
    {quitar && <button type="button" onClick={() => quitar(u)} aria-label="×" style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#0A1628", color: "#fff", fontSize: 12, lineHeight: 1, cursor: "pointer", boxShadow: "0 0 0 1.5px rgba(255,255,255,0.35)" }}>×</button>}
  </span>)}</div>;
  const clip = (ref) => <button type="button" onClick={() => ref.current?.click()} title={t.foto} aria-label={t.foto} style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 11, border: `1px solid ${INK(0.16)}`, background: "transparent", color: C.tx, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
  </button>;

  // Prioridad: dos fichas (amarillo Normal / rojo Urgente). Argencargo la elige; el agente solo la ve.
  const fichasPrioridad = (valor, poner) => <div style={{ display: "inline-flex", gap: 6 }}>{[["media", t.normal], ["alta", t.urgente]].map(([p, l]) => { const on = valor === p; if (!poner && !on) return null; return <button key={p} type="button" onClick={poner ? () => poner(p) : undefined} style={{ height: 30, padding: "0 12px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${on ? COLOR[p] : INK(0.14)}`, background: on ? `${COLOR[p]}26` : "transparent", color: on ? C.tx : INK(0.55), fontSize: 12.5, fontWeight: 800, cursor: poner ? "pointer" : "default", fontFamily: "inherit" }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: COLOR[p], opacity: on ? 1 : 0.5 }} />{l}</button>; })}</div>;

  // ── Lista ──
  const columnaLista = <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ display: "flex", padding: 3, borderRadius: 12, background: INK(0.05), border: `1px solid ${INK(0.08)}` }}>
        {[["abierto", t.abiertos, nAb], ["cerrado", t.cerrados, nCe]].map(([k, l, n]) => { const on = filtro === k; return <button key={k} type="button" onClick={() => setFiltro(k)} style={{ height: 34, padding: "0 13px", borderRadius: 9, border: "none", background: on ? INK(0.12) : "transparent", color: on ? C.tx : INK(0.55), fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{l}{n > 0 ? ` · ${n}` : ""}</button>; })}
      </div>
      <button type="button" onClick={abrirNuevo} style={{ ...btn(true), marginLeft: "auto", height: 38 }}>+ {t.nuevo}</button>
    </div>
    <div className="tk-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {lista.length === 0 ? <p style={{ color: INK(0.45), fontSize: 14, textAlign: "center", padding: "32px 0" }}>{filtro === "abierto" ? t.sinAbiertos : t.sinCerrados}</p>
        : lista.map((k) => { const on = sel === k.id, toca = meToca(k), nueva = sinLeer(k); return <button key={k.id} type="button" onClick={() => { setNuevo(null); setErr(""); setSel(k.id); }} style={{ textAlign: "left", padding: "12px 13px 12px 15px", borderRadius: 13, border: "none", borderBottom: `1px solid ${INK(0.06)}`, boxShadow: k.status === "abierto" ? `inset 4px 0 0 ${COLOR[k.prioridad] || COLOR.media}` : "none", background: on ? INK(0.09) : "transparent", color: C.tx, cursor: "pointer", fontFamily: "inherit", display: "block", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            {nueva && <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.gold, flexShrink: 0, alignSelf: "center" }} />}
            <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: nueva ? 800 : 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tituloDe(k)}</span>
            <span style={{ fontSize: 11.5, color: INK(0.45), whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{hora(k.ultimo_at)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: INK(nueva ? 0.8 : 0.5), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span style={{ color: INK(0.4), fontVariantNumeric: "tabular-nums" }}>#{k.numero}</span> · {ultimoDe(k)}</span>
            {toca && <span style={{ fontSize: 10.5, fontWeight: 800, color: C.amber, whiteSpace: "nowrap" }}>{t.teToca}</span>}
          </div>
        </button>; })}
    </div>
  </div>;

  // ── Alta ──
  const formNuevo = nuevo && <div style={{ maxWidth: 640 }}>
    <p style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: C.tx }}>{t.nuevo}</p>
    {rol === "admin" && agentes.length > 1 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{agentes.map((a) => { const on = nuevo.agent_id === a.id; return <button key={a.id} type="button" onClick={() => setNuevo((n) => ({ ...n, agent_id: a.id }))} style={{ height: 34, padding: "0 14px", borderRadius: 99, border: `1px solid ${on ? "rgba(232,208,152,0.7)" : INK(0.14)}`, background: on ? "rgba(184,149,106,0.18)" : "transparent", color: on ? C.gold : INK(0.65), fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{a.nombre}</button>; })}</div>}
    {rol === "admin" && <div style={{ marginBottom: 12 }}>{fichasPrioridad(nuevo.prioridad, (p) => setNuevo((n) => ({ ...n, prioridad: p })))}</div>}
    <input value={nuevo.titulo} onChange={(e) => setNuevo((n) => ({ ...n, titulo: e.target.value }))} placeholder={t.asunto} maxLength={140} autoFocus style={{ ...campo, fontWeight: 700, marginBottom: 10 }} />
    <textarea data-enter-libre="1" value={nuevo.texto} onChange={(e) => setNuevo((n) => ({ ...n, texto: e.target.value }))} placeholder={t.detalle} rows={5} style={{ ...campo, resize: "vertical", lineHeight: 1.5 }} />
    <button type="button" onClick={() => archivoNuevo.current?.click()} style={{ marginTop: 10, width: "100%", padding: "16px 14px", borderRadius: 12, border: `1.5px dashed ${arrastra ? "rgba(232,208,152,0.9)" : INK(0.22)}`, background: arrastra ? "rgba(184,149,106,0.14)" : INK(0.03), color: arrastra ? C.gold : INK(0.6), fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
      {arrastra ? t.soltar : t.zona}
    </button>
    <input ref={archivoNuevo} type="file" accept={ACEPTA} multiple style={{ display: "none" }} onChange={(e) => { subir(e.target.files, destino.current || (() => {})); e.target.value = ""; }} />
    {miniaturas(nuevo.fotos, (u) => setNuevo((n) => ({ ...n, fotos: n.fotos.filter((x) => x !== u) })))}
    {subiendo > 0 && <p style={{ fontSize: 12.5, color: INK(0.55), margin: "8px 0 0" }}>{t.subiendo}</p>}
    {err && <p style={{ fontSize: 12.5, color: C.red, margin: "8px 0 0" }}>{err}</p>}
    <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
      <span style={{ flex: 1 }} />
      <button type="button" onClick={() => { setNuevo(null); setErr(""); }} style={btn(false)}>{t.cancelar}</button>
      <button type="button" onClick={crear} disabled={enviando || subiendo > 0} style={{ ...btn(true), opacity: enviando || subiendo > 0 ? 0.6 : 1 }}>{enviando ? "…" : t.abrir}</button>
    </div>
  </div>;

  // ── Chat ──
  const k = hilo?.ticket;
  const chat = sel && <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: `1px solid ${INK(0.08)}` }}>
      {celu && <button type="button" onClick={() => setSel(null)} aria-label={t.volver} style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, border: `1px solid ${INK(0.14)}`, background: "transparent", color: C.tx, fontSize: 18, cursor: "pointer" }}>‹</button>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: celu ? "normal" : "nowrap" }}>{k ? tituloDe(k) : "…"}</p>
        {k && <p style={{ margin: "2px 0 0", fontSize: 12, color: INK(0.5) }}>#{k.numero} · {hora(k.created_at)}{k.creado_rol !== rol && traducido && k.titulo_tr ? ` · ${k.titulo}` : ""}{k.status === "cerrado" ? <b style={{ color: C.green }}> · ✓ {t.cerrado}</b> : null}</p>}
      </div>
      {k && k.status === "abierto" && fichasPrioridad(k.prioridad || "media", rol === "admin" ? prioridad : null)}
      {/* Cerrar y reabrir: solo Argencargo (17/11/2026). */}
      {k && rol === "admin" && (k.status === "abierto" ? <button type="button" onClick={() => estado("cerrar")} style={{ ...btn(false), height: 36, color: C.green, borderColor: "rgba(34,197,94,0.45)" }}>✓ {t.cerrar}</button>
        : <button type="button" onClick={() => estado("reabrir")} style={{ ...btn(false), height: 36 }}>{t.reabrir}</button>)}
    </div>
    <div className="tk-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 2px", display: "flex", flexDirection: "column", gap: 10 }}>
      {!hilo ? <p style={{ color: INK(0.4), textAlign: "center" }}>…</p> : hilo.mensajes.map((m) => {
        if (m.autor_rol === "sistema") { const [que, por] = String(m.texto || "").split(":"); return <p key={m.id} style={{ alignSelf: "center", margin: "2px 0", fontSize: 11.5, fontWeight: 700, color: INK(0.5), padding: "4px 12px", borderRadius: 99, background: INK(0.05) }}>{que === "cerrado" ? `✓ ${t.cerradoPor}` : t.reabiertoPor} {quien(por)} · {hora(m.created_at)}</p>; }
        const mio = m.autor_rol === rol;
        const principal = !mio && traducido && m.texto_tr ? m.texto_tr : m.texto;
        // Debajo va el otro idioma: en lo ajeno, el original; en lo propio, la traducción que lee el otro lado.
        const segundo = !mio && traducido && m.texto_tr ? m.texto : mio && m.texto_tr ? m.texto_tr : null;
        return <div key={m.id} style={{ alignSelf: mio ? "flex-end" : "flex-start", maxWidth: celu ? "88%" : "72%", padding: "10px 13px", borderRadius: 15, borderBottomRightRadius: mio ? 5 : 15, borderBottomLeftRadius: mio ? 15 : 5, background: mio ? "rgba(184,149,106,0.2)" : INK(0.07), border: `1px solid ${mio ? "rgba(232,208,152,0.3)" : INK(0.08)}` }}>
          {principal && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: C.tx, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{principal}</p>}
          {segundo && <p style={{ margin: "6px 0 0", paddingTop: 6, borderTop: `1px solid ${INK(0.08)}`, fontSize: 12, lineHeight: 1.45, color: INK(0.5), whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{segundo}</p>}
          {m.fotos?.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: principal ? 8 : 0 }}>{m.fotos.map((u) => esImagen(u) ? <img key={u} src={u} alt="" onClick={() => setGrande(u)} style={{ width: m.fotos.length === 1 ? 220 : 110, maxWidth: "100%", height: m.fotos.length === 1 ? "auto" : 110, objectFit: "cover", borderRadius: 10, cursor: "zoom-in", display: "block" }} /> : ficha(u, false))}</div>}
          <p style={{ margin: "5px 0 0", fontSize: 10.5, color: INK(0.4), textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{hora(m.created_at)}</p>
        </div>;
      })}
      <div ref={fin} />
    </div>
    <div style={{ paddingTop: 10, borderTop: `1px solid ${INK(0.08)}` }}>
      {miniaturas(fotos, (u) => setFotos((p) => p.filter((x) => x !== u)))}
      {subiendo > 0 && <p style={{ fontSize: 12.5, color: INK(0.55), margin: "6px 0 0" }}>{t.subiendo}</p>}
      {err && <p style={{ fontSize: 12.5, color: C.red, margin: "6px 0 0" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: fotos.length || subiendo || err ? 8 : 0 }}>
        {clip(archivo)}
        <input ref={archivo} type="file" accept={ACEPTA} multiple style={{ display: "none" }} onChange={(e) => { subir(e.target.files, setFotos); e.target.value = ""; }} />
        <textarea data-enter-libre="1" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !celu && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); enviar(); } }} placeholder={t.escribir} rows={Math.min(5, Math.max(1, texto.split("\n").length))} style={{ ...campo, flex: 1, resize: "none", lineHeight: 1.45, minHeight: 42 }} />
        <button type="button" onClick={enviar} disabled={enviando || subiendo > 0 || (!texto.trim() && !fotos.length)} style={{ ...btn(true), height: 42, opacity: enviando || subiendo > 0 || (!texto.trim() && !fotos.length) ? 0.5 : 1 }}>{enviando ? "…" : t.enviar}</button>
      </div>
    </div>
  </div>;

  const alto = altoPx ? `${altoPx}px` : celu ? `calc(100dvh - ${resta + 20}px)` : `calc(var(--vh100,100dvh) - ${resta}px)`;
  const derecha = nuevo ? formNuevo : sel ? chat : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: INK(0.35), fontSize: 14 }}>{t.elegi}</div>;
  return <div ref={caja} {...dnd} style={{ position: "relative" }}>
    {arrastra && sel && !nuevo && <div style={{ position: "absolute", inset: 0, zIndex: 20, borderRadius: 16, border: "2px dashed rgba(232,208,152,0.85)", background: "rgba(10,22,40,0.72)", display: "flex", alignItems: "center", justifyContent: "center", color: C.gold, fontSize: 17, fontWeight: 800, pointerEvents: "none" }}>{t.soltar}</div>}
    <style>{`.tk-scroll{scrollbar-width:thin;scrollbar-color:${INK(0.2)} transparent}.tk-scroll::-webkit-scrollbar{width:6px}.tk-scroll::-webkit-scrollbar-thumb{background:${INK(0.2)};border-radius:99px}`}</style>
    {celu ? <div style={{ height: nuevo ? "auto" : alto, minHeight: 380 }}>{nuevo ? formNuevo : sel ? chat : columnaLista}</div>
      : <div style={{ display: "grid", gridTemplateColumns: "minmax(300px,380px) minmax(0,1fr)", gap: 22, height: alto, minHeight: 440 }}>
        {columnaLista}
        <div style={{ minWidth: 0, minHeight: 0, paddingLeft: 22, borderLeft: `1px solid ${INK(0.08)}` }}>{derecha}</div>
      </div>}
    {grande && <div onClick={() => setGrande(null)} style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.86)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, cursor: "zoom-out" }}><img src={grande} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10 }} /></div>}
  </div>;
}
