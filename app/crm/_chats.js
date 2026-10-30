"use client";
// Bandeja de WhatsApp del CRM (30/10/2026): lista de chats · hilo · ficha del contacto.
// Solo lectura por defecto: lo que se escribe acá se manda desde el celu (botón "Abrir en WhatsApp"
// con el texto ya puesto). Si en Conexiones se enciende "Responder desde el sistema", el botón manda
// por la API dentro de las 24 h y con tope mensual (/api/crm/enviar decide y avisa por qué no).
// Las fotos y audios no se guardan en Supabase: se piden a Meta al abrirlos (/api/crm/media).
import { useState, useEffect, useCallback, useRef } from "react";
import { C, MONO, dq, arr, Btn, Vacio, Cargando, inp, hace } from "../gi/_base";
import { toast } from "../../lib/ui";
import { fmtTel, nombreDe, hora, diaDe, VISTA, Avatar, Etapa, api, Accion, ETAPAS } from "./_comun";
import Ficha from "./_ficha";
import Plantillas from "./_plantillas";

const SEL_CONTACTO = "id,phone,name,wa_name,client_id,stage,stage_manual,source,ad_headline,campaign_name,last_msg_at,last_in_at,last_preview,last_direction,unread,summary,pending,next_contact_at,notes,lost_reason,created_at";
const FILTROS = [["todos", "Todos"], ["sinleer", "Sin leer"], ["leads", "Leads"], ["clientes", "Clientes"]];

export default function Chats({ ctx, inicial }) {
  const { token, movil } = ctx;
  const ancho = useAncho();
  const conFicha = ancho >= 1180;
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [envio, setEnvio] = useState(null); // {enabled, usados, cap}
  const selRef = useRef(null); selRef.current = sel;
  const fin = useRef(null);

  const cargarLista = useCallback(async () => {
    const r = await dq("crm_contacts", { token, filters: `?select=${SEL_CONTACTO}&last_msg_at=not.is.null&order=last_msg_at.desc&limit=400` });
    const l = arr(r); setLista(l); ctx.setSinLeer?.(l.filter((c) => c.unread > 0).length);
    if (selRef.current) { const n = l.find((c) => c.id === selRef.current.id); if (n) setSel((s) => ({ ...s, ...n, unread: 0 })); }
  }, [token, ctx]);
  const cargarMsgs = useCallback(async (c) => {
    const r = await dq("crm_messages", { token, filters: `?select=id,wamid,direction,via,type,text,media_id,media_mime,media_filename,status,deleted,ts,referral,reply_to&contact_id=eq.${c.id}&order=ts.asc&limit=600` });
    if (selRef.current?.id === c.id) setMsgs(arr(r));
  }, [token]);
  useEffect(() => { cargarLista(); api("/api/crm/conectar").then((s) => { const n = s?.numeros?.[0]; if (n) { const mes = new Date().toISOString().slice(0, 7); setEnvio({ enabled: !!n.send_enabled, usados: n.send_month === mes ? n.send_count : 0, cap: n.send_cap }); } }); }, [cargarLista]);
  useEffect(() => { const t = setInterval(() => { cargarLista(); if (selRef.current) cargarMsgs(selRef.current); }, 15000); return () => clearInterval(t); }, [cargarLista, cargarMsgs]);
  useEffect(() => { fin.current?.scrollIntoView?.({ block: "end" }); }, [msgs?.length, sel?.id]);
  // Llegar con un contacto elegido desde Contactos o Seguimiento.
  useEffect(() => { if (inicial && lista) { const c = lista.find((x) => x.id === inicial); if (c) abrir(c); } }, [inicial, lista === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = async (c) => {
    setSel(c); setMsgs(null); setFichaAbierta(false); await cargarMsgs(c);
    if (c.unread > 0) { await dq("crm_contacts", { token, method: "PATCH", filters: `?id=eq.${c.id}`, body: { unread: 0, seen_at: new Date().toISOString() } }); cargarLista(); }
  };
  const actualizarContacto = (patch) => { setSel((s) => (s ? { ...s, ...patch } : s)); setLista((l) => (l || []).map((c) => (c.id === sel?.id ? { ...c, ...patch } : c))); };

  const filtrada = (lista || []).filter((c) => {
    if (filtro === "sinleer" && !(c.unread > 0)) return false;
    if (filtro === "leads" && c.client_id) return false;
    if (filtro === "clientes" && !c.client_id) return false;
    if (q && !`${c.name || ""} ${c.wa_name || ""} ${c.phone} ${c.last_preview || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const alto = movil ? "calc(100vh - 86px)" : "calc(100vh - 56px)";

  const Lista = <div style={{ display: "flex", flexDirection: "column", height: alto, minWidth: 0 }}>
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" data-enter-libre="1" style={{ ...inp, padding: "9px 12px", fontSize: 13, marginBottom: 8 }} />
    <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
      {FILTROS.map(([k, l]) => { const on = filtro === k; const n = k === "sinleer" ? (lista || []).filter((c) => c.unread > 0).length : 0; return <button key={k} onClick={() => setFiltro(k)} style={{ flex: 1, padding: "6px 4px", borderRadius: 8, border: `1px solid ${on ? "rgba(184,149,106,0.5)" : "transparent"}`, background: on ? "rgba(184,149,106,0.12)" : "rgba(255,255,255,0.03)", color: on ? C.goldHi : C.sub, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{l}{n > 0 ? ` ${n}` : ""}</button>; })}
    </div>
    <div className="crm-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
      {lista === null ? <Cargando /> : !filtrada.length ? <Vacio>{lista.length ? "Nada con ese filtro." : "Todavía no entró ningún chat. Cuando el número esté conectado, aparecen acá solos."}</Vacio> :
        filtrada.map((c) => { const on = sel?.id === c.id; return <button key={c.id} onClick={() => abrir(c)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 10px", borderRadius: 12, border: "none", background: on ? "rgba(184,149,106,0.1)" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: C.txt }}>
          <Avatar c={c} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 13.5, fontWeight: c.unread ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(c)}</span>
              <span style={{ fontSize: 10.5, color: c.unread ? C.goldHi : C.mute, flexShrink: 0 }}>{hace(c.last_msg_at)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 2 }}>
              <span style={{ fontSize: 12, color: c.unread ? C.txt : C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last_direction === "out" ? "Vos: " : ""}{c.last_preview || ""}</span>
              {c.unread > 0 ? <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999, background: "#ef4444", color: "#fff", flexShrink: 0 }}>{c.unread}</span> : <Etapa k={c.stage} small />}
            </div>
          </div>
        </button>; })}
    </div>
  </div>;

  const Hilo = sel && <Conversacion key={sel.id} ctx={ctx} c={sel} msgs={msgs} envio={envio} setEnvio={setEnvio} alto={alto} movil={movil} conFicha={conFicha} onVolver={() => setSel(null)} onFicha={() => setFichaAbierta((v) => !v)} onEnviado={() => { cargarMsgs(sel); cargarLista(); }} onContacto={actualizarContacto} />;
  const FichaBox = sel && <div className="crm-scroll" style={{ height: alto, overflowY: "auto" }}><Ficha ctx={ctx} c={sel} onChange={actualizarContacto} /></div>;

  if (movil) {
    if (!sel) return Lista;
    if (fichaAbierta) return <div><button onClick={() => setFichaAbierta(false)} style={{ background: "transparent", border: "none", color: C.goldHi, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "0 0 10px", fontFamily: "inherit" }}>‹ Volver al chat</button>{FichaBox}</div>;
    return Hilo;
  }
  return <div style={{ display: "grid", gridTemplateColumns: conFicha ? "320px minmax(0,1fr) 320px" : "320px minmax(0,1fr)", gap: 14 }}>
    {Lista}
    {sel ? Hilo : <div style={{ height: alto, display: "flex", alignItems: "center", justifyContent: "center", color: C.mute, fontSize: 13, border: `1px dashed ${C.line}`, borderRadius: 16 }}>Elegí un chat</div>}
    {conFicha && (sel ? FichaBox : <div />)}
    {!conFicha && sel && fichaAbierta && <div onClick={() => setFichaAbierta(false)} style={{ position: "fixed", inset: 0, background: "rgba(3,8,16,0.6)", zIndex: 30 }}><div onClick={(e) => e.stopPropagation()} className="crm-scroll" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 360, background: C.panel, borderLeft: `1px solid ${C.lineHi}`, overflowY: "auto", padding: 14 }}><Ficha ctx={ctx} c={sel} onChange={actualizarContacto} /></div></div>}
  </div>;
}

function useAncho() {
  const [w, setW] = useState(typeof window === "undefined" ? 1400 : window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return w;
}

// ── Hilo + redacción ──
function Conversacion({ ctx, c, msgs, envio, setEnvio, alto, movil, conFicha, onVolver, onFicha, onEnviado, onContacto }) {
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

  return <div style={{ display: "flex", flexDirection: "column", height: alto, minWidth: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${C.line}` }}>
      {movil && <button onClick={onVolver} style={{ background: "transparent", border: "none", color: C.sub, fontSize: 22, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>‹</button>}
      <Avatar c={c} s={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(c)}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: C.mute, fontFamily: MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtTel(c.phone)}{c.wa_name && c.name ? ` · ${c.wa_name}` : ""}{c.source === "ad" ? ` · 📣 ${c.campaign_name || c.ad_headline || "anuncio"}` : ""}</p>
      </div>
      <Etapa k={c.stage} />
      {!conFicha && <Accion onClick={onFicha}>Ficha</Accion>}
    </div>
    <div className="crm-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 14px 6px", display: "flex", flexDirection: "column", gap: 3 }}>
      {msgs === null ? <Cargando /> : !msgs.length ? <Vacio>Sin mensajes guardados.</Vacio> : msgs.map((m, i) => <Burbuja key={m.id} m={m} nuevoDia={i === 0 || diaDe(m.ts) !== diaDe(msgs[i - 1].ts)} reciente={i >= msgs.length - 30} />)}
      <div ref={fin} />
    </div>
    <div style={{ borderTop: `1px solid ${C.line}`, padding: "8px 10px 10px" }}>
      {aviso && <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: C.amber, padding: "4px 4px 8px" }}><span style={{ flex: 1 }}>{aviso.t}.</span><a href={aviso.link} target="_blank" rel="noreferrer" style={{ color: C.goldHi, fontWeight: 700, textDecoration: "none" }}>Mandar desde WhatsApp ↗</a></div>}
      {plantillas && <Plantillas ctx={ctx} c={c} onElegir={(t) => { setTexto(t); setPlantillas(false); setTimeout(() => area.current?.focus(), 0); }} onCerrar={() => setPlantillas(false)} />}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea ref={area} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} placeholder={puedeApi ? "Escribí y Enter manda por el sistema" : "Escribí y Enter lo abre en WhatsApp con el texto listo"} rows={1} style={{ ...inp, resize: "none", minHeight: 40, maxHeight: 140, lineHeight: 1.4, padding: "10px 12px", fontSize: 13.5 }} onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }} />
        <Btn small onClick={() => setPlantillas((v) => !v)} title="Plantillas">✎</Btn>
        {texto.trim() && !puedeApi && <Btn small onClick={copiar} title="Copiar el texto">⧉</Btn>}
        <Btn small v={puedeApi ? "gold" : "wa"} onClick={enviar} disabled={enviando || !texto.trim()}>{puedeApi ? "Enviar" : "WhatsApp ↗"}</Btn>
      </div>
      <p style={{ margin: "6px 4px 0", fontSize: 10.5, color: C.mute }}>{envio?.enabled ? (ventana ? `Por el sistema · ${envio.usados} de ${envio.cap} este mes` : "Pasaron más de 24 h del último mensaje del cliente: se manda desde WhatsApp") : "Se manda desde WhatsApp (el envío por el sistema está apagado en Conexiones)"}</p>
    </div>
  </div>;
}

function Burbuja({ m, nuevoDia, reciente }) {
  const out = m.direction === "out";
  const txt = m.deleted ? "Mensaje eliminado" : m.text || (m.type === "document" ? `📄 ${m.media_filename || "Documento"}` : VISTA[m.type] || m.type || "");
  const conMedia = !m.deleted && m.media_id && ["image", "video", "audio", "document", "sticker"].includes(m.type);
  return <div>
    {nuevoDia && <div style={{ textAlign: "center", margin: "10px 0 8px" }}><span style={{ fontSize: 10.5, fontWeight: 700, color: C.mute, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.05)", textTransform: "capitalize" }}>{diaDe(m.ts)}</span></div>}
    <div style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start" }}>
      <div style={{ maxWidth: "78%", padding: "7px 11px", borderRadius: out ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: out ? "rgba(184,149,106,0.2)" : "rgba(255,255,255,0.06)", border: `1px solid ${out ? "rgba(184,149,106,0.28)" : C.line}`, fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", fontStyle: m.deleted ? "italic" : "normal", color: m.deleted ? C.mute : C.txt }}>
        {m.referral && <div style={{ fontSize: 11, color: C.goldHi, fontWeight: 700, marginBottom: 4 }}>📣 Vino del anuncio{m.referral.headline ? `: ${m.referral.headline}` : ""}</div>}
        {conMedia && <Adjunto m={m} auto={m.type === "image" && reciente} />}
        {(!conMedia || m.text) && txt}
        <div style={{ fontSize: 10, color: C.mute, textAlign: "right", marginTop: 3 }}>{hora(m.ts)}{out ? (m.status === "read" ? " ✓✓" : m.status === "delivered" ? " ✓✓" : m.status === "failed" ? " ✗" : " ✓") : ""}{m.via === "app" ? " · celu" : m.via === "api" && out ? " · sistema" : ""}</div>
      </div>
    </div>
  </div>;
}

// Un adjunto se pide a Meta recién cuando hace falta (fotos recientes solas; el resto, al tocar).
function Adjunto({ m, auto }) {
  const [url, setUrl] = useState(null);
  const [estado, setEstado] = useState(auto ? "cargando" : "cerrado");
  const cargar = useCallback(async () => {
    setEstado("cargando");
    try { const r = await fetch(`/api/crm/media?id=${m.media_id}`); if (!r.ok) { setEstado("error"); return; } setUrl(URL.createObjectURL(await r.blob())); setEstado("ok"); } catch { setEstado("error"); }
  }, [m.media_id]);
  useEffect(() => { if (auto) cargar(); }, [auto, cargar]);
  const etiqueta = m.type === "document" ? `📄 ${m.media_filename || "Documento"}` : VISTA[m.type] || "Adjunto";
  if (estado === "error") return <div style={{ fontSize: 12, color: C.mute, marginBottom: 4 }}>{etiqueta} · Meta ya no lo tiene</div>;
  if (estado === "cargando") return <div style={{ fontSize: 12, color: C.mute, marginBottom: 4 }}>{etiqueta} · cargando…</div>;
  if (estado === "cerrado") return <button onClick={cargar} style={{ display: "block", background: "rgba(0,0,0,0.2)", border: `1px solid ${C.line}`, borderRadius: 9, padding: "7px 10px", color: C.goldHi, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 4 }}>{etiqueta} · ver</button>;
  if (m.type === "image" || m.type === "sticker") return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 9, display: "block", marginBottom: 4 }} /></a>;
  if (m.type === "video") return <video src={url} controls style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 9, display: "block", marginBottom: 4 }} />;
  if (m.type === "audio") return <audio src={url} controls style={{ display: "block", marginBottom: 4, maxWidth: 260 }} />;
  return <a href={url} download={m.media_filename || "documento"} style={{ display: "inline-block", color: C.goldHi, fontWeight: 700, fontSize: 12.5, marginBottom: 4 }}>{etiqueta} · descargar</a>;
}
