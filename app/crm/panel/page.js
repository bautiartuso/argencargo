"use client";
// Panel del CRM para la extensión de WhatsApp Web (25/11/2026). Bautista contesta desde WhatsApp Web
// (mandar por la API cuesta) y quiere ver ahí mismo la ficha de la persona. La extensión (carpeta
// /extension) detecta el chat abierto y carga esta página en un costado; la página busca a la persona
// por teléfono (o por nombre, si el chat no lo muestra) y dibuja la misma Ficha del CRM.
//
// Cómo se hablan:
//   extensión → página : postMessage { ac: "chat", id, chat: { tel, lid, nombre, grupo } }   (o #tel=…&nombre=… en la URL)
//   página → extensión : postMessage { ac: "ficha", id, tira, rapidas } a web.whatsapp.com
// La página nunca recibe ni guarda mensajes: solo el teléfono o el nombre del chat abierto.
// Adentro de WhatsApp Web el navegador le da a esta página un almacenamiento aparte: la sesión se
// inicia una vez acá y queda guardada (no comparte la de la pestaña del CRM).
import { useState, useEffect, useCallback, useRef } from "react";
import { ToastStack, DialogHost, toast } from "../../../lib/ui";
import { dq, arr, ac, sesionInicial, saveSession, clearSession, usarSesionPropia, ensureFresh, inp } from "../../gi/_base";
import Ficha, { ESTADO_OP } from "../_ficha";
import { W, fmtTel, usd } from "../_comun";
import { fechaDM } from "../../../lib/crm-seguimiento";

const WA_WEB = "https://web.whatsapp.com";
const FUENTE = "'Inter','Segoe UI',-apple-system,sans-serif";
const digitos = (t) => String(t || "").replace(/\D/g, "");
const ult10 = (t) => digitos(t).slice(-10);
// Igual que crm_norm_tel de la base.
const normTel = (t) => { const d = digitos(t); if (d.startsWith("549") && d.length >= 12) return d; if (d.startsWith("54") && d.length >= 11) return d; if (d.length === 10) return "549" + d; return d.length >= 11 ? d : null; };
const limpio = (q) => String(q || "").replace(/[,.()&*%\\]/g, " ").replace(/\s+/g, " ").trim();
const nombreCliente = (x) => [x.first_name, x.last_name].filter(Boolean).join(" ").trim() || x.company_name || "";
const primerNombre = (n) => { const p = String(n || "").trim().split(/\s+/)[0] || ""; return /^[\p{L}'-]{2,}$/u.test(p) ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""; };
const SEL_CLIENTE = "id,first_name,last_name,company_name,client_code,whatsapp";

// Lo que el dueño eligió a mano para los chats sin teléfono (identificador del chat → ficha).
const RECORDADOS = "ac_panel_elegidos";
const leerElegidos = () => { try { return JSON.parse(localStorage.getItem(RECORDADOS) || "{}") || {}; } catch { return {}; } };
const recordar = (k, id) => { if (!k) return; try { const m = leerElegidos(); if (id) m[k] = id; else delete m[k]; localStorage.setItem(RECORDADOS, JSON.stringify(m)); } catch {} };
const claveChat = (ch) => (ch?.lid ? `l:${ch.lid}` : ch?.nombre ? `n:${ch.nombre.toLowerCase()}` : null);

// Textos de las respuestas rápidas. La extensión los escribe en la caja de WhatsApp; el envío es siempre a mano.
const FRASE = { en_preparacion: "está en preparación", en_transito: "está en tránsito", en_aduana: "está en aduana" };
function armarRapidas({ c, d, admin }) {
  const n = primerNombre(d?.cliente?.nombre || c.name || c.wa_name);
  const hola = n ? `Hola ${n}, ` : "Hola, ";
  const out = [];
  const enCurso = (d?.ops || []).filter((o) => !o.entregada && o.code);
  for (const o of enCurso.slice(0, 3)) {
    if (o.status === "entregada") out.push({ l: `Avisar que ${o.code} está lista`, t: `${hola}tu carga ${o.code} ya está lista para retirar.` });
    else if (FRASE[o.status]) out.push({ l: `Estado de ${o.code}`, t: `${hola}tu carga ${o.code} ${FRASE[o.status]}${o.eta ? ` y llega aproximadamente el ${fechaDM(o.eta)}` : ""}.` });
  }
  if (admin) { const o = enCurso.find((x) => Number(x.saldo) > 0.5); if (o) out.push({ l: "Saldo", t: `${hola}te queda un saldo de ${usd(o.saldo)} de la ${o.code}.` }); }
  if (!c.client_id) out.push({ l: "Pedir datos para cotizar", t: `${hola}para cotizarte necesito saber qué producto es, el peso y las medidas de los bultos.` });
  return out;
}
function armarTira({ c, d, admin }) {
  const enCurso = (d?.ops || []).filter((o) => !o.entregada && o.code);
  if (enCurso.length) {
    const debe = admin ? enCurso.reduce((s, o) => s + Number(o.saldo || 0), 0) : 0;
    return { items: enCurso.slice(0, 3).map((o) => ({ b: o.code, ok: ESTADO_OP[o.status] || o.status, t: o.eta && o.status !== "entregada" ? `llega ${fechaDM(o.eta)}` : "" })), der: debe > 0.5 ? `A cobrar ${usd(debe)}` : "" };
  }
  if (!c.client_id) return { txt: "Todavía no es cliente" };
  const q = (d?.cots || [])[0];
  const hechas = (d?.ops || []).filter((o) => o.entregada).length;
  if (hechas) return { txt: `${hechas} ${hechas === 1 ? "importación" : "importaciones"} · nada en curso` };
  if (q?.code) return { items: [{ b: q.code, ok: "Cotizó", t: fechaDM(q.created_at) }] };
  return { txt: "Cliente sin operaciones" };
}

const Linea = ({ children, c = W.sub }) => <p style={{ margin: "10px 0 0", fontSize: 13.5, color: c, lineHeight: 1.45 }}>{children}</p>;
const Rotulo = ({ children }) => <p style={{ margin: "18px 0 7px", fontSize: 10.5, fontWeight: 800, color: W.mute, textTransform: "uppercase", letterSpacing: "0.1em" }}>{children}</p>;
const BtnP = ({ children, onClick, disabled, type = "button", full }) => <button type={type} onClick={onClick} disabled={disabled} style={{ width: full ? "100%" : "auto", padding: "9px 14px", borderRadius: 10, border: "none", background: W.acento, color: W.sobreAcento, fontSize: 13, fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "inherit" }}>{children}</button>;
const campo = { ...inp, background: W.caja, border: `1px solid ${W.line}`, color: W.txt, padding: "9px 11px", fontSize: 13 };

function Login({ onLogin }) {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [err, setErr] = useState(""); const [lo, setLo] = useState(false);
  const enviar = async (e) => {
    e?.preventDefault?.(); if (!email || !pass) return;
    setLo(true); setErr("");
    const r = await ac("token?grant_type=password", { email: email.trim(), password: pass });
    if (!r?.access_token) { setErr("Email o contraseña incorrectos"); setLo(false); return; }
    const e2 = await onLogin({ access_token: r.access_token, refresh_token: r.refresh_token, user: r.user });
    if (e2) setErr(e2);
    setLo(false);
  };
  return <form onSubmit={enviar} style={{ padding: "22px 16px" }}>
    <p style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: W.txt }}>Ingresá al CRM</p>
    {err && <p style={{ margin: "0 0 10px", fontSize: 12.5, color: W.rojo }}>{err}</p>}
    <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...campo, marginBottom: 8 }} />
    <input type="password" autoComplete="current-password" placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} style={{ ...campo, marginBottom: 12 }} />
    <BtnP type="submit" full disabled={lo}>{lo ? "Ingresando…" : "Ingresar"}</BtnP>
  </form>;
}

// Buscador de fichas y clientes (para vincular, o para elegir quién es cuando el chat no muestra el teléfono).
function Buscador({ token, inicial = "", soloClientes, placeholder, onElegir }) {
  const [q, setQ] = useState(inicial);
  const [res, setRes] = useState(null);
  const turno = useRef(0);
  const buscar = useCallback(async (texto) => {
    const s = limpio(texto); const mio = ++turno.current;
    if (s.length < 2) { setRes(null); return; }
    const pal = s.split(" "); const d = digitos(s);
    const filtroCl = d.length >= 6 ? `whatsapp_digitos.like.*${d}*` : `first_name.ilike.*${pal[0]}*,last_name.ilike.*${pal[0]}*,company_name.ilike.*${s}*,client_code.ilike.*${s}*`;
    const [cl, fi] = await Promise.all([
      dq("clients", { token, filters: `?select=${SEL_CLIENTE}&or=(${filtroCl})&limit=12` }),
      soloClientes ? [] : dq("crm_contacts", { token, filters: `?select=id,phone,name,wa_name,client_id&or=(${d.length >= 6 ? `phone.like.*${d}*` : `name.ilike.*${s}*,wa_name.ilike.*${s}*`})&order=last_msg_at.desc.nullslast&limit=8` }),
    ]);
    if (mio !== turno.current) return;
    const todas = (txt) => pal.every((p) => txt.toLowerCase().includes(p.toLowerCase()));
    const fichas = arr(fi).map((c) => ({ k: `f${c.id}`, tipo: "ficha", c, t: c.name || c.wa_name || fmtTel(c.phone), s: fmtTel(c.phone) }));
    const conFicha = new Set(arr(fi).map((c) => c.client_id).filter(Boolean));
    const clientes = arr(cl).filter((x) => !conFicha.has(x.id) && (d.length >= 6 || todas(`${nombreCliente(x)} ${x.company_name || ""} ${x.client_code || ""}`))).map((x) => ({ k: `c${x.id}`, tipo: "cliente", cl: x, t: nombreCliente(x), s: [x.client_code, x.whatsapp].filter(Boolean).join(" · ") }));
    setRes([...fichas, ...clientes].slice(0, 10));
  }, [token, soloClientes]);
  useEffect(() => { if (inicial) buscar(inicial); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div>
    <input value={q} onChange={(e) => { setQ(e.target.value); buscar(e.target.value); }} placeholder={placeholder} data-enter-libre="1" style={campo} />
    {(res || []).map((x) => <button key={x.k} type="button" onClick={() => onElegir(x)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 11px", marginTop: 5, borderRadius: 10, border: "none", background: W.caja, color: W.txt, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
      {x.t}<span style={{ display: "block", fontSize: 11.5, color: W.sub, marginTop: 1 }}>{x.s || (x.tipo === "cliente" ? "Cliente" : "")}</span>
    </button>)}
    {res && !res.length && <Linea c={W.mute}>Nadie con ese nombre.</Linea>}
  </div>;
}

function Panel({ sesion, perfil, chat, turno, onSalir }) {
  const token = sesion.access_token;
  const admin = perfil.role === "admin";
  const ctx = { token, admin, rol: admin ? "admin" : "empleado", perfil };
  // est: { v: "cargando" | "ficha" | "sinFicha" | "elegir" }
  const [est, setEst] = useState({ v: "cargando" });
  const [creando, setCreando] = useState(false);
  const vivo = useRef(0);
  const avisar = useCallback((datos) => { if (typeof window !== "undefined" && window.top !== window) { try { window.top.postMessage({ ac: "ficha", id: turno, ...datos }, WA_WEB); } catch {} } }, [turno]);

  const crearFicha = useCallback(async ({ tel, cl, waNombre }) => {
    const phone = normTel(tel || cl?.whatsapp);
    if (!phone) { toast("Este cliente no tiene WhatsApp cargado", "error"); return null; }
    const ya = arr(await dq("crm_contacts", { token, filters: `?phone=eq.${phone}&select=*` }))[0];
    if (ya) { if (cl && !ya.client_id) { await dq("crm_contacts", { token, method: "PATCH", filters: `?id=eq.${ya.id}`, body: { client_id: cl.id, name: ya.name || nombreCliente(cl) || null } }); return { ...ya, client_id: cl.id, name: ya.name || nombreCliente(cl) || null }; } return ya; }
    const r = await dq("crm_contacts", { token, method: "POST", body: { phone, client_id: cl?.id || null, name: cl ? nombreCliente(cl) || null : null, wa_name: waNombre || null, source: cl ? "cliente" : null } });
    let f = arr(r)[0] || null;
    if (!f) { toast("No se pudo crear la ficha", "error"); return null; }
    if (cl) { await dq("rpc/crm_sync_etapas", { token, method: "POST", body: {} }); f = arr(await dq("crm_contacts", { token, filters: `?id=eq.${f.id}&select=*` }))[0] || f; }
    return f;
  }, [token]);

  useEffect(() => {
    const mio = ++vivo.current; const sigue = () => mio === vivo.current;
    setEst({ v: "cargando" }); avisar({ tira: null, rapidas: [] });
    (async () => {
      const u = ult10(chat.tel);
      if (u.length === 10) {
        const c = arr(await dq("crm_contacts", { token, filters: `?phone=like.*${u}&select=*&limit=1` }))[0];
        if (!sigue()) return;
        if (c) { setEst({ v: "ficha", c }); return; }
        const cl = arr(await dq("clients", { token, filters: `?whatsapp_digitos=like.*${u}&select=${SEL_CLIENTE}&limit=2` }));
        if (!sigue()) return;
        if (cl.length === 1) { const f = await crearFicha({ tel: chat.tel, cl: cl[0], waNombre: chat.nombre }); if (!sigue()) return; if (f) { setEst({ v: "ficha", c: f }); return; } }
        setEst({ v: "sinFicha" }); avisar({ tira: { txt: "Todavía no es cliente" }, rapidas: armarRapidas({ c: { name: chat.nombre }, d: null, admin }) });
        return;
      }
      // Sin teléfono: lo elegido antes para este chat, o una ficha con ese nombre exacto.
      const k = claveChat(chat); const id = k ? leerElegidos()[k] : null;
      if (id) { const c = arr(await dq("crm_contacts", { token, filters: `?id=eq.${id}&select=*` }))[0]; if (!sigue()) return; if (c) { setEst({ v: "ficha", c, porNombre: true }); return; } recordar(k, null); }
      const s = limpio(chat.nombre);
      if (s.length >= 3) {
        const r = arr(await dq("crm_contacts", { token, filters: `?select=*&or=(name.ilike.${s},wa_name.ilike.${s})&limit=3` }));
        if (!sigue()) return;
        if (r.length === 1) { setEst({ v: "ficha", c: r[0], porNombre: true }); return; }
      }
      setEst({ v: "elegir" });
    })();
  }, [chat.tel, chat.lid, chat.nombre]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegir = async (x) => {
    setCreando(true);
    const f = x.tipo === "ficha" ? arr(await dq("crm_contacts", { token, filters: `?id=eq.${x.c.id}&select=*` }))[0] : await crearFicha({ tel: chat.tel, cl: x.cl, waNombre: chat.nombre });
    setCreando(false);
    if (!f) return;
    if (!chat.tel) recordar(claveChat(chat), f.id);
    setEst({ v: "ficha", c: f, porNombre: !chat.tel });
  };
  const crearSuelta = async () => { setCreando(true); const f = await crearFicha({ tel: chat.tel, waNombre: chat.nombre }); setCreando(false); if (f) setEst({ v: "ficha", c: f }); };
  const noEs = () => { recordar(claveChat(chat), null); setEst({ v: "elegir" }); avisar({ tira: null, rapidas: [] }); };
  const alCambiar = (p) => setEst((e) => (e.v === "ficha" ? { ...e, c: { ...e.c, ...p } } : e));
  const alDatos = (d, id) => { if (est.v === "ficha" && est.c.id === id) avisar({ tira: armarTira({ c: est.c, d, admin }), rapidas: armarRapidas({ c: est.c, d, admin }) }); };

  let cuerpo;
  if (est.v === "cargando") cuerpo = <Linea c={W.mute}>Cargando…</Linea>;
  else if (est.v === "ficha") cuerpo = <>
    <Ficha ctx={ctx} c={est.c} onChange={alCambiar} onDatos={alDatos} wa />
    {est.porNombre && <button type="button" onClick={noEs} style={{ marginTop: 16, background: "transparent", border: "none", padding: 0, color: W.mute, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>No es esta persona</button>}
  </>;
  else if (est.v === "sinFicha") cuerpo = <>
    <p style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>{chat.nombre || fmtTel(chat.tel)}</p>
    <p style={{ margin: "2px 0 0", fontSize: 13.5, color: W.sub }}>{fmtTel(chat.tel)}</p>
    <Linea>Todavía no es cliente.</Linea>
    <Rotulo>Cliente</Rotulo>
    <Buscador token={token} soloClientes placeholder="Buscar cliente para vincular" onElegir={elegir} />
    <div style={{ marginTop: 16 }}><BtnP onClick={crearSuelta} disabled={creando}>{creando ? "Creando…" : "Crear ficha"}</BtnP></div>
  </>;
  else cuerpo = <>
    <p style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>{chat.nombre || "Chat sin nombre"}</p>
    <p style={{ margin: "2px 0 0", fontSize: 13.5, color: W.sub }}>Este chat no muestra el teléfono</p>
    <Rotulo>¿Quién es?</Rotulo>
    <Buscador key={chat.nombre || "x"} token={token} inicial={chat.nombre || ""} placeholder="Buscar por nombre o teléfono" onElegir={elegir} />
  </>;

  return <div style={{ padding: "16px 16px 22px" }}>
    {cuerpo}
    <p style={{ margin: "26px 0 0", fontSize: 11.5, color: W.mute, display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perfil.email}</span>
      <button type="button" onClick={onSalir} style={{ background: "transparent", border: "none", padding: 0, color: W.mute, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Cerrar sesión</button>
    </p>
  </div>;
}

export default function PanelPage() {
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [chat, setChat] = useState(null); // null = todavía no se sabe · { nada: true } = sin chat abierto
  const [turno, setTurno] = useState(0);
  const validar = async (s) => {
    const p = await dq("profiles", { token: s.access_token, filters: `?id=eq.${s.user.id}&select=id,role,email` });
    const prof = arr(p)[0];
    if (!prof) return { error: "No se pudo cargar tu perfil." };
    if (!["admin", "empleado"].includes(prof.role)) return { error: "Tu cuenta no tiene acceso al CRM." };
    return { prof };
  };
  useEffect(() => { (async () => {
    const s = sesionInicial();
    if (s?.access_token && s.user?.id) { const r = await validar(s); if (r.prof) { setSesion(s); setPerfil(r.prof); } else { clearSession(); usarSesionPropia(); } }
    setCargando(false);
  })(); }, []);
  // El token vence a la hora: se mantiene al día (igual que /crm).
  useEffect(() => {
    if (!sesion?.access_token) return;
    let vivo = true;
    const alDia = async () => { const t = await ensureFresh(sesion.access_token).catch(() => null); if (vivo && t && t !== sesion.access_token) setSesion((s) => (s ? { ...s, access_token: t } : s)); };
    const id = setInterval(alDia, 60e3);
    document.addEventListener("visibilitychange", alDia); window.addEventListener("focus", alDia);
    return () => { vivo = false; clearInterval(id); document.removeEventListener("visibilitychange", alDia); window.removeEventListener("focus", alDia); };
  }, [sesion?.access_token]);
  // El chat abierto: lo manda la extensión; sin extensión (pestaña suelta) sale del # de la URL.
  useEffect(() => {
    const u = new URLSearchParams(window.location.hash.slice(1)); // en el #, que no viaja al servidor
    if (u.get("tel") || u.get("nombre")) setChat({ tel: digitos(u.get("tel")) || null, nombre: u.get("nombre") || null, lid: null });
    else if (window.parent === window) setChat({ nada: true });
    const oir = (e) => {
      if (!e.data || e.data.ac !== "chat" || !String(e.origin).startsWith("chrome-extension://")) return;
      const ch = e.data.chat;
      setTurno(Number(e.data.id) || 0);
      setChat(!ch ? { nada: true } : ch.grupo ? { grupo: true } : { tel: digitos(ch.tel) || null, nombre: ch.nombre ? String(ch.nombre).slice(0, 80) : null, lid: ch.lid ? String(ch.lid).slice(0, 40) : null });
    };
    window.addEventListener("message", oir);
    if (window.parent !== window) { try { window.parent.postMessage({ ac: "listo" }, "*"); } catch {} }
    return () => window.removeEventListener("message", oir);
  }, []);

  let cuerpo;
  if (cargando) cuerpo = <div style={{ padding: 16 }}><Linea c={W.mute}>Cargando…</Linea></div>;
  else if (!sesion) cuerpo = <Login onLogin={async (s) => { usarSesionPropia(); saveSession(s); const r = await validar(s); if (!r.prof) { clearSession(); return r.error; } setSesion(s); setPerfil(r.prof); return null; }} />;
  else if (!chat || chat.nada) cuerpo = <div style={{ padding: 16 }}><Linea c={W.mute}>{chat ? "Abrí un chat." : "Cargando…"}</Linea></div>;
  else if (chat.grupo) cuerpo = <div style={{ padding: 16 }}><Linea c={W.mute}>Es un grupo.</Linea></div>;
  else if (!chat.tel && !chat.nombre) cuerpo = <div style={{ padding: 16 }}><Linea c={W.mute}>No se pudo leer este chat.</Linea></div>;
  else cuerpo = <Panel key={`${chat.tel || ""}|${chat.lid || ""}|${chat.nombre || ""}`} sesion={sesion} perfil={perfil} chat={chat} turno={turno} onSalir={() => { clearSession(); setSesion(null); setPerfil(null); }} />;

  return <div style={{ minHeight: "100vh", background: W.bg, color: W.txt, fontFamily: FUENTE }}>
    <style>{`html,body{background:${W.bg} !important;margin:0}*{-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:3px}`}</style>
    {cuerpo}
    <ToastStack /><DialogHost />
  </div>;
}
