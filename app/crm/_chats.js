"use client";
// Bandeja de WhatsApp del CRM (30/10/2026; aspecto de WhatsApp desde el 23/11/2026): lista de chats ·
// hilo · ficha del contacto, que se abre y se cierra desde el encabezado del chat.
// Solo lectura por defecto: lo que se escribe acá se manda desde el celu (se abre WhatsApp con el
// texto ya puesto). Si en Conexiones se enciende "Responder desde el sistema", manda por la API
// dentro de las 24 h y con tope mensual (/api/crm/enviar decide y avisa por qué no).
// Las fotos y audios no se guardan en Supabase: se piden a Meta al abrirlos (/api/crm/media).
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { dq, arr } from "../gi/_base";
import { toast } from "../../lib/ui";
import { fmtTel, nombreDe, horaWa, cuandoLista, diaDe, VISTA, Etapa, api, W } from "./_comun";
import Ficha from "./_ficha";
import Plantillas from "./_plantillas";

const SEL_CONTACTO = "id,phone,name,wa_name,client_id,stage,stage_manual,stage_at,source,ad_headline,ad_name,ad_at,campaign_name,first_in_at,last_msg_at,last_in_at,last_preview,last_direction,unread,summary,summary_at,pending,next_contact_at,notes,lost_reason,created_at";
const FILTROS = [["todos", "Todos"], ["sinleer", "No leídos"], ["leads", "Leads"], ["clientes", "Clientes"]];
const ANCHO_LISTA = 264, ANCHO_FICHA = 330;

// Fondo del hilo (23/11/2026): el logo completo de Argencargo tal cual es, con un velo oscuro encima,
// igual que el fondo que Bautista usa en su WhatsApp. No se le tocan los colores al logo.
const fondoChat = (movil) => ({ background: `linear-gradient(rgba(0,0,0,0.62), rgba(0,0,0,0.62)), url(/brand/logo-completo-fondo.png) center / ${movil ? "contain" : "cover"} no-repeat #fefeff` });

const Ico = ({ d, s = 20, c = "currentColor", fill }) => <svg width={s} height={s} viewBox="0 0 24 24" fill={fill ? c : "none"} stroke={fill ? "none" : c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{[].concat(d).map((x, i) => <path key={i} d={x} />)}</svg>;
const Tilde = ({ doble, leido }) => <svg width="17" height="11" viewBox="0 0 18 11" fill="none" stroke={leido ? W.azul : "rgba(255,255,255,0.55)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M1 6l3.2 3.4L11 1.6" />{doble && <path d="M7.4 9.2l.4.4L16.6 1.6" />}</svg>;
const botonRedondo = { width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", color: W.sub, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

export default function Chats({ ctx, inicial }) {
  const { token, movil } = ctx;
  const ancho = useAncho();
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState(null);
  // La ficha se abre y se cierra desde el encabezado del chat; se recuerda la última elección.
  const [fichaAbierta, setFichaAbierta] = useState(() => { try { return localStorage.getItem("crm_ficha") !== "0"; } catch { return true; } });
  const [fichaMovil, setFichaMovil] = useState(false);
  const [envio, setEnvio] = useState(null); // {enabled, usados, cap}
  const selRef = useRef(null); selRef.current = sel;
  const alternarFicha = () => setFichaAbierta((v) => { try { localStorage.setItem("crm_ficha", v ? "0" : "1"); } catch {} return !v; });

  const cargarLista = useCallback(async () => {
    const r = await dq("crm_contacts", { token, filters: `?select=${SEL_CONTACTO}&last_msg_at=not.is.null&order=last_msg_at.desc&limit=400` });
    const l = arr(r);
    // El chat que está abierto y a la vista se da por leído apenas llega algo.
    const abierto = selRef.current && l.find((c) => c.id === selRef.current.id);
    if (abierto?.unread > 0 && document.visibilityState === "visible") { abierto.unread = 0; dq("crm_contacts", { token, method: "PATCH", filters: `?id=eq.${abierto.id}`, body: { unread: 0, seen_at: new Date().toISOString() } }); }
    setLista(l); ctx.setSinLeer?.(l.filter((c) => c.unread > 0).length);
    if (selRef.current) { const n = l.find((c) => c.id === selRef.current.id); if (n) setSel((s) => ({ ...s, ...n, unread: 0 })); }
  }, [token, ctx]);
  const cargarMsgs = useCallback(async (c) => {
    const r = await dq("crm_messages", { token, filters: `?select=id,wamid,direction,via,type,text,media_id,media_mime,media_filename,status,deleted,ts,referral,reply_to&contact_id=eq.${c.id}&order=ts.asc&limit=600` });
    if (selRef.current?.id === c.id) setMsgs(arr(r));
  }, [token]);
  useEffect(() => { cargarLista(); api("/api/crm/conectar").then((s) => { const n = s?.numeros?.[0]; if (n) { const mes = new Date().toISOString().slice(0, 7); setEnvio({ enabled: !!n.send_enabled, usados: n.send_month === mes ? n.send_count : 0, cap: n.send_cap }); } }); }, [cargarLista]);
  // Casi en vivo (23/11/2026: había que recargar la pestaña para ver lo nuevo, el repaso era cada 15 s).
  // Cada 3 s se mira solo cuál fue el último movimiento (una fila, casi sin tráfico) y la lista y el hilo
  // se vuelven a traer únicamente si cambió. Cada 45 s va un repaso completo (tildes, reacciones) y al
  // volver a la pestaña se revisa en el momento. Con la pestaña oculta no se consulta nada.
  const marca = useRef(null);
  useEffect(() => {
    let vivo = true;
    const refrescar = async () => { await cargarLista(); if (selRef.current) cargarMsgs(selRef.current); };
    const mirar = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await dq("crm_contacts", { token, filters: "?select=last_msg_at&last_msg_at=not.is.null&order=last_msg_at.desc&limit=1" });
      const m = arr(r)[0]?.last_msg_at || "";
      if (!vivo || m === marca.current) return;
      const primera = marca.current === null; marca.current = m;
      if (!primera) refrescar();
    };
    const t = setInterval(mirar, 3000);
    const t2 = setInterval(() => { if (document.visibilityState === "visible") refrescar(); }, 45000);
    const alVolver = () => { if (document.visibilityState === "visible") { marca.current = marca.current === null ? null : "volver"; mirar(); } };
    document.addEventListener("visibilitychange", alVolver); window.addEventListener("focus", alVolver);
    return () => { vivo = false; clearInterval(t); clearInterval(t2); document.removeEventListener("visibilitychange", alVolver); window.removeEventListener("focus", alVolver); };
  }, [cargarLista, cargarMsgs, token]);
  // Llegar con un contacto elegido desde Contactos o Seguimiento.
  useEffect(() => { if (inicial && lista) { const c = lista.find((x) => x.id === inicial); if (c) abrir(c); } }, [inicial, lista === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = async (c) => {
    setSel(c); setMsgs(null); setFichaMovil(false); await cargarMsgs(c);
    if (c.unread > 0) { await dq("crm_contacts", { token, method: "PATCH", filters: `?id=eq.${c.id}`, body: { unread: 0, seen_at: new Date().toISOString() } }); cargarLista(); }
  };
  const actualizarContacto = (patch) => { setSel((s) => (s ? { ...s, ...patch } : s)); setLista((l) => (l || []).map((c) => (c.id === sel?.id ? { ...c, ...patch } : c))); };

  const sinLeer = (lista || []).filter((c) => c.unread > 0).length;
  const filtrada = (lista || []).filter((c) => {
    if (filtro === "sinleer" && !(c.unread > 0)) return false;
    if (filtro === "leads" && c.client_id) return false;
    if (filtro === "clientes" && !c.client_id) return false;
    if (q && !`${c.name || ""} ${c.wa_name || ""} ${c.phone} ${c.last_preview || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const alto = movil ? "calc(100dvh - 58px)" : "100vh";

  const Lista = <div style={{ display: "flex", flexDirection: "column", height: alto, minWidth: 0, background: W.bg, borderRight: movil ? "none" : `1px solid ${W.line}` }}>
    <div style={{ padding: "14px 14px 8px" }}>
      <p style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: W.txt }}>Chats</p>
      <label style={{ display: "flex", alignItems: "center", gap: 10, height: 38, padding: "0 14px", borderRadius: 999, background: W.caja, color: W.mute }}>
        <Ico s={16} d={["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M21 21l-4.3-4.3"]} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" data-enter-libre="1" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: W.txt, fontSize: 14, fontFamily: "inherit" }} />
      </label>
      <div className="crm-scroll" style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto" }}>
        {FILTROS.map(([k, l]) => { const on = filtro === k; return <button key={k} onClick={() => setFiltro(k)} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${on ? "transparent" : W.line}`, background: on ? W.chip : "transparent", color: on ? W.chipTxt : W.sub, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{l}{k === "sinleer" && sinLeer > 0 ? ` ${sinLeer}` : ""}</button>; })}
      </div>
    </div>
    <div className="crm-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 6px 8px" }}>
      {lista === null ? <p style={{ color: W.mute, fontSize: 13, textAlign: "center", padding: 24 }}>Cargando…</p> : !filtrada.length ? <p style={{ color: W.mute, fontSize: 13, textAlign: "center", padding: 24 }}>{lista.length ? "Nada con ese filtro." : "Todavía no entró ningún chat."}</p> :
        filtrada.map((c) => { const on = sel?.id === c.id; return <button key={c.id} onClick={() => abrir(c)} className="wa-fila" style={{ width: "100%", display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", borderRadius: 10, border: "none", marginBottom: 2, background: on ? W.sel : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: W.txt }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 15, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(c)}</span>
              <span style={{ fontSize: 11.5, color: c.unread ? W.acento : W.mute, flexShrink: 0 }}>{cuandoLista(c.last_msg_at)}</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>
              {c.last_direction === "out" && <Tilde doble />}
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: W.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last_preview || ""}</span>
              {c.unread > 0 ? <span style={{ minWidth: 20, height: 20, padding: "0 6px", boxSizing: "border-box", borderRadius: 999, background: W.acento, color: W.sobreAcento, fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.unread}</span> : <Etapa k={c.stage} small />}
            </div>
          </div>
        </button>; })}
    </div>
  </div>;

  const Hilo = sel && <Conversacion key={sel.id} ctx={ctx} c={sel} msgs={msgs} envio={envio} setEnvio={setEnvio} alto={alto} movil={movil} fichaAbierta={movil ? fichaMovil : fichaAbierta} onVolver={() => setSel(null)} onFicha={() => (movil ? setFichaMovil(true) : alternarFicha())} onEnviado={() => { cargarMsgs(sel); cargarLista(); }} />;
  const FichaBox = sel && <div className="crm-scroll" style={{ height: alto, overflowY: "auto", background: W.bg, borderLeft: movil ? "none" : `1px solid ${W.line}`, boxSizing: "border-box" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 60, padding: "0 10px", boxSizing: "border-box" }}>
      <button onClick={() => (movil ? setFichaMovil(false) : alternarFicha())} title="Cerrar" style={botonRedondo}><Ico d={["M6 6l12 12", "M18 6L6 18"]} /></button>
      <span style={{ fontSize: 15.5, fontWeight: 600, color: W.txt }}>Info. del contacto</span>
    </div>
    <div style={{ padding: "0 16px 20px" }}><Ficha ctx={ctx} c={sel} onChange={actualizarContacto} wa /></div>
  </div>;

  const estilos = <style>{`.wa-fila:hover{background:${W.hover} !important}.wa-chat .crm-scroll::-webkit-scrollbar{width:6px;height:0}.wa-chat .crm-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.14);border-radius:3px}`}</style>;
  if (movil) return <div className="wa-chat" style={{ background: W.bg, color: W.txt }}>{estilos}{!sel ? Lista : fichaMovil ? FichaBox : Hilo}</div>;
  // En pantallas angostas la ficha tapa el chat en vez de apretarlo.
  const fichaAlLado = fichaAbierta && sel && ancho >= 1100;
  const fichaEncima = fichaAbierta && sel && ancho < 1100;
  return <div className="wa-chat" style={{ display: "grid", gridTemplateColumns: `${ANCHO_LISTA}px minmax(0,1fr)${fichaAlLado ? ` ${ANCHO_FICHA}px` : ""}`, background: W.bg, color: W.txt, position: "relative" }}>
    {estilos}
    {Lista}
    {sel ? Hilo : <div style={{ height: alto, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "rgba(255,255,255,0.8)", fontSize: 14, ...fondoChat(false) }}><Ico s={46} c="rgba(255,255,255,0.35)" d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 20l1.3-5.1A8.4 8.4 0 1 1 21 11.5z" />Elegí un chat</div>}
    {fichaAlLado && FichaBox}
    {fichaEncima && <div onClick={alternarFicha} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 30 }}><div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: Math.min(ANCHO_FICHA + 20, ancho - 80) }}>{FichaBox}</div></div>}
  </div>;
}

function useAncho() {
  const [w, setW] = useState(typeof window === "undefined" ? 1400 : window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return w;
}

// ── Hilo + redacción ──
function Conversacion({ ctx, c, msgs, envio, setEnvio, alto, movil, fichaAbierta, onVolver, onFicha, onEnviado }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [plantillas, setPlantillas] = useState(false);
  const fin = useRef(null);
  const area = useRef(null);
  useEffect(() => { fin.current?.scrollIntoView?.({ block: "end" }); }, [msgs?.length]);
  const ventana = c.last_in_at && Date.now() - new Date(c.last_in_at).getTime() < 24 * 3600e3;
  const puedeApi = envio?.enabled && ventana && envio.usados < envio.cap;
  const linkWa = `https://wa.me/${c.phone}${texto.trim() ? `?text=${encodeURIComponent(texto.trim())}` : ""}`;

  // Las reacciones no son mensajes: van pegadas al mensaje al que apuntan (o al anterior, si Meta no
  // dijo a cuál). De cada lado cuenta la última; una reacción vacía es que la sacaron.
  const { visibles, reacciones } = useMemo(() => {
    const vis = [], porDestino = {};
    for (const m of msgs || []) {
      if (m.type !== "reaction") { vis.push(m); continue; }
      const destino = m.reply_to || vis[vis.length - 1]?.wamid || vis[vis.length - 1]?.id; if (!destino) continue;
      (porDestino[destino] = porDestino[destino] || {})[m.direction] = m.deleted ? "" : m.text || "";
    }
    const r = {};
    for (const [k, v] of Object.entries(porDestino)) { const e = [v.in, v.out].filter(Boolean); if (e.length) r[k] = e; }
    return { visibles: vis, reacciones: r };
  }, [msgs]);

  const enviar = async () => {
    const t = texto.trim(); if (!t) return;
    if (!puedeApi) { window.open(linkWa, "_blank", "noopener"); setTexto(""); return; }
    setEnviando(true); setAviso(null);
    const r = await api("/api/crm/enviar", { contact_id: c.id, text: t });
    setEnviando(false);
    if (r.ok) { setTexto(""); setEnvio((e) => (e ? { ...e, usados: r.usados } : e)); onEnviado(); return; }
    setAviso({ t: r.error || "No se pudo mandar", link: linkWa });
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); toast("Copiado"); } catch {} };
  const sub = [fmtTel(c.phone), c.wa_name && c.name && c.wa_name !== c.name ? `~${c.wa_name}` : null, c.source === "ad" ? `Anuncio: ${c.campaign_name || c.ad_headline || "sin nombre"}` : null].filter(Boolean).join(" · ");

  return <div style={{ display: "flex", flexDirection: "column", height: alto, minWidth: 0, background: W.fondo }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, height: 60, padding: "0 14px", boxSizing: "border-box", background: W.bg, borderBottom: `1px solid ${W.line}`, flexShrink: 0 }}>
      {movil && <button onClick={onVolver} style={{ ...botonRedondo, marginLeft: -8 }}><Ico d="M15 5l-7 7 7 7" /></button>}
      <button onClick={onFicha} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: W.txt, fontFamily: "inherit" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(c)}</p>
          <p style={{ margin: "1px 0 0", fontSize: 12.5, color: W.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</p>
        </div>
      </button>
      <Etapa k={c.stage} />
      <button onClick={onFicha} title={fichaAbierta ? "Cerrar la información del contacto" : "Información del contacto"} style={{ ...botonRedondo, background: fichaAbierta ? W.sel : "transparent", color: fichaAbierta ? W.txt : W.sub }}><Ico d={["M4 5h16v14H4z", "M14.5 5v14"]} /></button>
    </div>
    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, ...fondoChat(movil), pointerEvents: "none" }} />
    <div className="crm-scroll" style={{ position: "absolute", inset: 0, overflowY: "auto", padding: movil ? "10px 10px 6px" : "12px 5% 8px", display: "flex", flexDirection: "column" }}>
      {msgs === null ? <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, textAlign: "center", padding: 24 }}>Cargando…</p> : !visibles.length ? <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, textAlign: "center", padding: 24 }}>Sin mensajes guardados.</p> : visibles.map((m, i) => { const ant = visibles[i - 1]; const nuevoDia = !ant || diaDe(m.ts) !== diaDe(ant.ts); return <Burbuja key={m.id} m={m} nuevoDia={nuevoDia} primero={nuevoDia || ant.direction !== m.direction} reciente={i >= visibles.length - 30} reac={reacciones[m.wamid] || reacciones[m.id]} />; })}
      <div ref={fin} />
    </div>
    </div>
    <div style={{ background: W.bg, padding: "8px 12px 10px", flexShrink: 0 }}>
      {aviso && <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, color: "#f5c26b", padding: "2px 6px 8px" }}><span style={{ flex: 1 }}>{aviso.t}.</span><a href={aviso.link} target="_blank" rel="noreferrer" style={{ color: W.acento, fontWeight: 700, textDecoration: "none" }}>Mandar desde WhatsApp ↗</a></div>}
      {plantillas && <Plantillas ctx={ctx} c={c} onElegir={(t) => { setTexto(t); setPlantillas(false); setTimeout(() => area.current?.focus(), 0); }} onCerrar={() => setPlantillas(false)} />}
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        <button onClick={() => setPlantillas((v) => !v)} title="Plantillas" style={{ ...botonRedondo, width: 42, height: 42, color: plantillas ? W.acento : W.sub }}><Ico s={22} d={["M12 5v14", "M5 12h14"]} /></button>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end", background: W.caja, borderRadius: 22, padding: "0 6px 0 16px" }}>
          <textarea ref={area} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} placeholder="Escribe un mensaje" rows={1} data-enter-libre="1" style={{ flex: 1, minWidth: 0, resize: "none", border: "none", outline: "none", background: "transparent", color: W.txt, fontFamily: "inherit", fontSize: 15, lineHeight: 1.4, padding: "11px 0", minHeight: 42, maxHeight: 140, boxSizing: "border-box" }} onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }} />
          {texto.trim() && !puedeApi && <button onClick={copiar} title="Copiar el texto" style={{ ...botonRedondo, height: 42 }}><Ico s={18} d={["M9 9h11v11H9z", "M5 15H4V4h11v1"]} /></button>}
        </div>
        <button onClick={enviar} disabled={enviando || !texto.trim()} title={puedeApi ? "Enviar por el sistema" : "Abrir en WhatsApp con el texto"} style={{ ...botonRedondo, width: 42, height: 42, background: texto.trim() ? W.acento : W.caja, color: texto.trim() ? W.sobreAcento : W.mute, cursor: texto.trim() ? "pointer" : "default" }}><Ico s={20} fill d="M3.4 20.4l17.5-7.5a1 1 0 0 0 0-1.8L3.4 3.6a1 1 0 0 0-1.4 1.2L4 11l9 1-9 1-2 6.2a1 1 0 0 0 1.4 1.2z" /></button>
      </div>
      <p style={{ margin: "5px 54px 0", fontSize: 11, color: W.mute }}>{envio?.enabled ? (ventana ? `Sale por el sistema · ${envio.usados} de ${envio.cap} este mes` : "Pasaron más de 24 h del último mensaje del cliente: se abre en WhatsApp") : "Enter lo abre en WhatsApp con el texto listo"}</p>
    </div>
  </div>;
}

function Burbuja({ m, nuevoDia, primero, reciente, reac }) {
  const out = m.direction === "out";
  const conMedia = !m.deleted && m.media_id && ["image", "video", "audio", "document", "sticker"].includes(m.type);
  const txt = m.deleted ? "Se eliminó este mensaje" : m.text || (conMedia ? "" : VISTA[m.type] || m.type || "");
  const pie = <span style={{ float: "right", display: "inline-flex", alignItems: "center", gap: 4, margin: "7px 0 -3px 12px", fontSize: 11, color: out ? "rgba(255,255,255,0.7)" : W.innSub, whiteSpace: "nowrap", position: "relative", top: 2 }}>
    {m.via === "api" && out ? "sistema · " : ""}{horaWa(m.ts)}{out && (m.status === "failed" ? <span style={{ color: W.rojo }}>✗</span> : <Tilde doble={m.status === "delivered" || m.status === "read" || m.via === "app"} leido={m.status === "read"} />)}
  </span>;
  return <>
    {nuevoDia && <div style={{ textAlign: "center", margin: "10px 0 8px" }}><span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", padding: "5px 14px", borderRadius: 10, background: "#15181b", textTransform: "capitalize" }}>{diaDe(m.ts)}</span></div>}
    <div style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start", marginTop: primero && !nuevoDia ? 10 : 2, marginBottom: reac ? 16 : 0 }}>
      <div style={{ position: "relative", maxWidth: "min(65%, 560px)", minWidth: 76, padding: "6px 9px 7px", borderRadius: 10, borderTopRightRadius: out && primero ? 2 : 10, borderTopLeftRadius: !out && primero ? 2 : 10, background: out ? W.out : W.inn, fontSize: 14.5, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word", fontStyle: m.deleted ? "italic" : "normal", color: m.deleted ? (out ? "rgba(255,255,255,0.6)" : W.innSub) : out ? "#ffffff" : W.innTxt, boxShadow: "0 1px 1.5px rgba(0,0,0,0.3)" }}>
        {m.referral && <div style={{ fontSize: 12, color: "#cfe2ff", fontWeight: 600, marginBottom: 4, padding: "5px 8px", borderRadius: 6, background: "rgba(0,0,0,0.22)" }}>Vino del anuncio{m.referral.headline ? `: ${m.referral.headline}` : ""}</div>}
        {conMedia && <Adjunto m={m} auto={m.type === "image" && reciente} out={out} />}
        {txt}{pie}
        {reac && <span style={{ position: "absolute", bottom: -17, [out ? "right" : "left"]: 8, display: "inline-flex", gap: 2, padding: "2px 6px", borderRadius: 999, background: "#15181b", border: "1px solid rgba(255,255,255,0.12)", fontSize: 14, lineHeight: 1.3, fontStyle: "normal" }}>{reac.join("")}</span>}
      </div>
    </div>
  </>;
}

// Un adjunto se pide a Meta recién cuando hace falta (fotos recientes solas; el resto, al tocar).
function Adjunto({ m, auto, out }) {
  const [url, setUrl] = useState(null);
  const [estado, setEstado] = useState(auto ? "cargando" : "cerrado");
  const cargar = useCallback(async () => {
    setEstado("cargando");
    try { const r = await fetch(`/api/crm/media?id=${m.media_id}`); if (!r.ok) { setEstado("error"); return null; } const u = URL.createObjectURL(await r.blob()); setUrl(u); setEstado("ok"); return u; } catch { setEstado("error"); return null; }
  }, [m.media_id]);
  useEffect(() => { if (auto) cargar(); }, [auto, cargar]);
  if (m.type === "audio") return <NotaDeVoz m={m} url={url} estado={estado} cargar={cargar} out={out} />;
  const etiqueta = m.type === "document" ? m.media_filename || "Documento" : VISTA[m.type] || "Adjunto";
  const caja = { display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 8, background: "rgba(0,0,0,0.24)", color: "inherit", fontSize: 13.5, marginBottom: 4, border: "none", fontFamily: "inherit", textAlign: "left", width: "100%", boxSizing: "border-box", textDecoration: "none" };
  const enlace = "#a9cdfb";
  const icono = <Ico s={22} c="rgba(255,255,255,0.75)" d={m.type === "document" ? ["M6 3h8l5 5v13H6z", "M14 3v5h5"] : ["M4 5h16v14H4z", "M4 15l4.5-4.5 4 4 3-3L20 16"]} />;
  if (estado === "error") return <div style={{ ...caja, opacity: 0.7 }}>{icono}<span>{etiqueta} · Meta ya no lo tiene</span></div>;
  if (estado === "cargando") return <div style={{ ...caja, opacity: 0.7 }}>{icono}<span>{etiqueta} · cargando…</span></div>;
  if (estado === "cerrado") return <button onClick={cargar} style={{ ...caja, cursor: "pointer" }}>{icono}<span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{etiqueta}</span><span style={{ color: enlace, fontWeight: 600 }}>Ver</span></button>;
  if (m.type === "image" || m.type === "sticker") return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 7, display: "block", marginBottom: 4 }} /></a>;
  if (m.type === "video") return <video src={url} controls style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 7, display: "block", marginBottom: 4 }} />;
  return <a href={url} download={m.media_filename || "documento"} style={caja}>{icono}<span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{etiqueta}</span><span style={{ color: enlace, fontWeight: 600 }}>Descargar</span></a>;
}

// Nota de voz como en WhatsApp: se ve lista para escuchar y el audio se baja recién al darle play.
const mmss = (s) => { const n = Math.max(0, Math.floor(s || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; };
function NotaDeVoz({ m, url, estado, cargar, out }) {
  const audio = useRef(null);
  const [sonando, setSonando] = useState(false);
  const [pos, setPos] = useState(0); const [dur, setDur] = useState(0); const [vel, setVel] = useState(1);
  // Las barritas son un dibujo fijo por mensaje (Meta no manda la forma de onda).
  const barras = useMemo(() => { let h = 0; for (const ch of String(m.media_id || m.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return Array.from({ length: 34 }, () => { h = (h * 1103515245 + 12345) >>> 0; return 4 + ((h >>> 16) % 15); }); }, [m.media_id, m.id]);
  const tocar = async () => {
    const a = audio.current; if (!a) return;
    if (sonando) { a.pause(); return; }
    if (!a.src) { const u = url || (await cargar()); if (!u) return; a.src = u; a.playbackRate = vel; }
    a.play().catch(() => {});
  };
  const ir = (e) => { const a = audio.current; if (!a || !dur) return; const r = e.currentTarget.getBoundingClientRect(); a.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * dur; };
  const cambiarVel = () => { const n = vel === 1 ? 1.5 : vel === 1.5 ? 2 : 1; setVel(n); if (audio.current) audio.current.playbackRate = n; };
  const frac = dur ? pos / dur : 0;
  const color = out ? "#8fa9cf" : "#8d96a1";
  const tinta = "#ffffff";
  const contador = estado === "error" ? "No disponible" : sonando || pos > 0 ? mmss(pos) : dur ? mmss(dur) : "";
  return <div style={{ display: "flex", alignItems: "center", gap: 8, width: "min(280px, 60vw)", padding: "2px 2px 0" }}>
    <audio ref={audio} preload="none" onPlay={() => setSonando(true)} onPause={() => setSonando(false)} onEnded={() => { setSonando(false); setPos(0); }} onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDur(isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)} onDurationChange={(e) => setDur(isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)} style={{ display: "none" }} />
    <button onClick={tocar} disabled={estado === "error"} title={estado === "error" ? "Meta ya no tiene este audio" : sonando ? "Pausar" : "Escuchar"} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "transparent", color: estado === "error" ? "#9aa5b1" : tinta, cursor: estado === "error" ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {estado === "cargando" ? <span style={{ fontSize: 18, lineHeight: 1 }}>…</span> : sonando ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4.2" height="15" rx="1" /><rect x="13.8" y="4.5" width="4.2" height="15" rx="1" /></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 4.8v14.4a.8.8 0 0 0 1.2.7l11.6-7.2a.8.8 0 0 0 0-1.4L9.2 4.1A.8.8 0 0 0 8 4.8z" /></svg>}
    </button>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div onClick={ir} style={{ display: "flex", alignItems: "center", gap: 2, height: 26, cursor: dur ? "pointer" : "default" }}>
        {barras.map((h, i) => <span key={i} style={{ flex: 1, height: h, borderRadius: 2, background: i / barras.length < frac ? W.azul : color, opacity: i / barras.length < frac ? 1 : 0.75 }} />)}
      </div>
      {contador && <div style={{ fontSize: 11, color: out ? "rgba(255,255,255,0.7)" : W.innSub, marginTop: 1 }}>{contador}</div>}
    </div>
    <button onClick={cambiarVel} title="Velocidad" style={{ minWidth: 38, height: 24, borderRadius: 999, border: "none", background: "rgba(0,0,0,0.28)", color: tinta, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{String(vel).replace(".", ",")}×</button>
  </div>;
}
