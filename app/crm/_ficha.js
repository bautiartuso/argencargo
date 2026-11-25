"use client";
// Ficha comercial de un contacto (30/10/2026; ampliada el 23/11/2026): quién es, qué tiene en curso,
// qué habló (resumen de Claude), qué cotizó y qué importó, en qué etapa está y cuándo tocarlo. La
// misma ficha se ve al costado del chat (con la paleta de WhatsApp, `wa`) y en Contactos. Los datos
// del cliente salen de la RPC crm_ficha; la etapa automática la pone crm_sync_etapas y acá se corrige.
import { useState, useEffect, useCallback } from "react";
import { C, MONO, dq, arr, Btn, inp, hace } from "../gi/_base";
import { toast, confirmDialog } from "../../lib/ui";
import DatePicker from "../components/DatePicker";
import { fmtTel, nombreDe, fechaCorta, usd, ETAPAS, etapaDe, Avatar, api, Accion, W } from "./_comun";
import { TEMP } from "../../lib/crm-seguimiento";

// "entregada" sin entrega registrada es la carga que espera al cliente: en el admin se llama LISTA PARA RETIRAR.
export const ESTADO_OP = { pendiente: "Pendiente", en_deposito_origen: "En depósito de origen", en_preparacion: "En preparación", en_transito: "En tránsito", en_aduana: "En aduana", entregada: "Lista para retirar", operacion_cerrada: "Cerrada" };
const CANAL = { aereo_blanco: "Aéreo", aereo_negro: "Aéreo", maritimo_blanco: "Marítimo LCL/FCL", maritimo_negro: "Marítimo" };
const FISCAL = { responsable_inscripto: "Responsable inscripto", monotributista: "Monotributista", ninguna: "Consumidor final" };
// Piezas de la ficha. Van afuera del componente (si no, se remontan en cada tecla y las notas pierden el foco).
const Seccion = ({ K, t, right, children }) => <div style={{ marginTop: 16 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: K.mute, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t}</p>{right}</div>{children}</div>;
const Numero = ({ K, l, v, c: col }) => <div style={{ flex: "1 1 0", minWidth: 0, padding: "8px 10px", borderRadius: 10, background: K.caja }}><p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: col || K.txt, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</p><p style={{ margin: "1px 0 0", fontSize: 10.5, color: K.mute, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</p></div>;
const Dato = ({ K, l, children }) => <div style={{ display: "flex", gap: 10, fontSize: 12.5, padding: "3px 0" }}><span style={{ color: K.mute, flexShrink: 0, width: 92 }}>{l}</span><span style={{ flex: 1, minWidth: 0, color: K.txt, overflowWrap: "anywhere" }}>{children}</span></div>;
// Quién lleva el seguimiento: una persona o la IA (elegible a mano).
const Quien = ({ K, v, onChange }) => <div style={{ display: "inline-flex", padding: 2, borderRadius: 999, background: K.caja, gap: 2 }}>{[["humano", "Vos"], ["ia", "IA"]].map(([k, l]) => <button key={k} type="button" onClick={() => v !== k && onChange(k)} style={{ padding: "4px 12px", borderRadius: 999, border: "none", background: v === k ? (k === "ia" ? "rgba(167,139,250,0.28)" : "rgba(184,149,106,0.28)") : "transparent", color: v === k ? K.txt : K.mute, fontSize: 11.5, fontWeight: 800, cursor: v === k ? "default" : "pointer", fontFamily: "inherit" }}>{l}</button>)}</div>;
const diasDesde = (f) => (f ? Math.floor((Date.now() - new Date(f).getTime()) / 864e5) : null);

// onDatos: avisa lo que devolvió crm_ficha (lo usa /crm/panel para la tira y las respuestas rápidas de la extensión).
export default function Ficha({ ctx, c, onChange, compacta, wa, onDatos }) {
  const { token, admin, ir } = ctx;
  // Paleta: la del CRM, o la de WhatsApp cuando va al costado del chat.
  const K = wa ? { panel: "transparent", line: W.line, mute: W.mute, sub: W.sub, txt: W.txt, hi: W.acento, ok: "#8fc0ff", caja: W.caja } : { panel: C.panel, line: C.line, mute: C.mute, sub: C.sub, txt: C.txt, hi: C.goldHi, ok: C.green, caja: "rgba(255,255,255,0.04)" };
  const [d, setD] = useState(null);
  const [notas, setNotas] = useState(c.notes || "");
  const [buscar, setBuscar] = useState("");
  const [clientes, setClientes] = useState(null);
  const [resumiendo, setResumiendo] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const [todo, setTodo] = useState(false);
  const [an, setAn] = useState(null); // análisis de la IA (crm_analisis)
  const [analizando, setAnalizando] = useState(false);
  const clave = c.client_id ? `c:${c.client_id}` : `k:${c.id}`;
  useEffect(() => { setNotas(c.notes || ""); setBuscar(""); setClientes(null); setEligiendo(false); setTodo(false); setD(null); }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const cargar = useCallback(async () => { const r = await dq("rpc/crm_ficha", { token, method: "POST", body: { p_contact_id: c.id } }); const v = r && !r.code ? r : { ops: [], cots: [] }; setD(v); onDatos?.(v, c.id); }, [token, c.id, c.client_id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { let vivo = true; setAn(null); dq("crm_analisis", { token, filters: `?clave=eq.${clave}&select=temperatura,lectura,siguiente,mensaje,quien,quien_manual,analizado_at,error` }).then((r) => { if (vivo) setAn(arr(r)[0] || {}); }); return () => { vivo = false; }; }, [token, clave]);
  const analizar = async () => { setAnalizando(true); const r = await api("/api/cron/crm-analisis", { clave }); setAnalizando(false); if (r.ok) setAn((a) => ({ ...(a || {}), ...r.analisis, error: null })); else toast(r.error || "No se pudo analizar", "error"); };
  const quienLleva = an?.quien_manual || an?.quien || c.quien_ef || "humano";
  const pasar = async (a) => { const r = await dq("crm_analisis?on_conflict=clave", { token, method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: { clave, client_id: c.client_id || null, contact_id: c.client_id ? null : c.id, quien_manual: a, updated_at: new Date().toISOString() } }); if (Array.isArray(r)) setAn((x) => ({ ...(x || {}), quien_manual: a })); else toast("No se pudo guardar", "error"); };
  // La fecha de próximo contacto es una sola: la de la ficha y la del seguimiento del cliente.
  const proximo = async (v) => { await patch({ next_contact_at: v || null }); if (c.client_id) await dq("clients", { token, method: "PATCH", filters: `?id=eq.${c.client_id}`, body: { followup_next_at: v || null } }); };

  const patch = async (p) => { const r = await dq("crm_contacts", { token, method: "PATCH", filters: `?id=eq.${c.id}`, body: { ...p, updated_at: new Date().toISOString() } }); if (Array.isArray(r)) onChange?.(p); else toast("No se pudo guardar", "error"); };
  const etapa = async (k) => {
    if (k === "perdido") { const ok = await confirmDialog(`¿Marcar a ${nombreDe(c)} como perdido? No aparece más en Seguimiento.`); if (!ok) return; }
    await patch({ stage: k, stage_manual: true, stage_at: new Date().toISOString() }); setEligiendo(false);
  };
  const automatica = async () => { await patch({ stage_manual: false }); const r = await dq("rpc/crm_sync_etapas", { token, method: "POST", body: {} }); if (r && !r.code) { const n = await dq("crm_contacts", { token, filters: `?id=eq.${c.id}&select=stage,stage_at` }); const x = arr(n)[0]; if (x) onChange?.(x); } setEligiendo(false); };
  const resumir = async () => { setResumiendo(true); const r = await api("/api/cron/crm-resumen", { contact_id: c.id }); setResumiendo(false); if (r.ok) onChange?.({ summary: r.summary, pending: r.pending, summary_at: r.summary_at }); else toast(r.error || "No se pudo resumir", "error"); };
  const buscarClientes = async (q) => { setBuscar(q); if (q.trim().length < 2) { setClientes(q.trim() ? [] : null); return; } const s = q.trim().replace(/[,.()&]/g, " "); const r = await dq("clients", { token, filters: `?select=id,first_name,last_name,client_code,company_name,whatsapp&or=(first_name.ilike.*${s}*,last_name.ilike.*${s}*,company_name.ilike.*${s}*,client_code.ilike.*${s}*)&limit=8` }); setClientes(arr(r)); };
  const vincular = async (cl) => { await patch({ client_id: cl.id, name: c.name || [cl.first_name, cl.last_name].filter(Boolean).join(" ") || cl.company_name }); setBuscar(""); setClientes(null); cargar(); };

  const cl = d?.cliente;
  const e = etapaDe(c.stage);
  const ops = d?.ops || [], cots = d?.cots || [];
  const enCurso = ops.filter((o) => !o.entregada);
  const hechas = ops.filter((o) => o.entregada);
  const aCobrar = ops.reduce((s, o) => s + Number(o.saldo || 0), 0);
  const ultima = hechas[0]?.delivered_at || hechas[0]?.created_at || null;
  const historial = [...hechas.map((o) => ({ k: `o${o.id}`, fecha: o.delivered_at || o.created_at, t: `${o.code || "Operación"} · ${CANAL[o.channel] || ""}`, v: admin && o.total ? usd(o.total) : "", ok: true })), ...cots.map((q) => ({ k: `q${q.id}`, fecha: q.created_at, t: `Cotización ${q.code || ""}${q.channel_name ? ` · ${q.channel_name}` : ""}`, v: admin && q.total ? usd(q.total) : "", ok: false }))].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  return <div style={{ background: compacta ? "transparent" : K.panel, border: compacta || wa ? "none" : `1px solid ${K.line}`, borderRadius: 16, padding: compacta || wa ? 0 : 14, color: K.txt }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {!wa && <Avatar c={c} s={44} />}
      <div style={{ minWidth: 0, maxWidth: "100%", flex: wa ? "none" : 1 }}>
        <p style={{ margin: 0, fontSize: wa ? 19 : 15, fontWeight: wa ? 600 : 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(c)}</p>
        <p style={{ margin: "2px 0 0", fontSize: wa ? 13.5 : 11.5, color: K.sub, fontFamily: wa ? "inherit" : MONO }}>{fmtTel(c.phone)}{c.name && c.wa_name && c.wa_name !== c.name ? ` · ~${c.wa_name}` : ""}</p>
      </div>
    </div>

    <Seccion K={K} t={`Análisis${an?.analizado_at && an?.lectura ? ` · ${hace(an.analizado_at)}` : ""}`} right={<Accion c={K.hi} onClick={analizar} disabled={analizando || an === null}>{analizando ? "Analizando…" : an?.lectura ? "Analizar de nuevo" : "Analizar"}</Accion>}>
      {an === null ? <p style={{ margin: 0, fontSize: 12.5, color: K.mute }}>Cargando…</p> : an.lectura ? <>
        {TEMP[an.temperatura] && <span style={{ display: "inline-block", marginBottom: 6, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, color: TEMP[an.temperatura].c, background: `${TEMP[an.temperatura].c}1f`, border: `1px solid ${TEMP[an.temperatura].c}55` }}>{TEMP[an.temperatura].l}</span>}
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{an.lectura}</p>
        {an.siguiente && <p style={{ margin: "5px 0 0", fontSize: 12.5, color: K.hi }}>→ {an.siguiente}</p>}
      </> : <p style={{ margin: 0, fontSize: 12.5, color: K.mute }}>{an.error ? "No se pudo analizar." : "Todavía sin análisis."}</p>}
      {an !== null && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}><span style={{ fontSize: 12, color: K.mute }}>Seguimiento</span><Quien K={K} v={quienLleva} onChange={pasar} /></div>}
    </Seccion>

    {c.client_id && d && <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
      <Numero K={K} l="Importó" v={hechas.length} />
      <Numero K={K} l="En curso" v={enCurso.length} c={enCurso.length ? K.hi : undefined} />
      <Numero K={K} l="Cotizó" v={cots.length} />
    </div>}
    {c.client_id && d && admin && (d.facturado > 0 || aCobrar > 0) && <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
      <Numero K={K} l="Facturado" v={usd(d.facturado)} />
      <Numero K={K} l="A cobrar" v={usd(aCobrar)} c={aCobrar > 0.5 ? "#f5c26b" : undefined} />
    </div>}

    {enCurso.length > 0 && <Seccion K={K} t="En curso">
      {enCurso.map((o) => <div key={o.id} style={{ padding: "7px 10px", marginBottom: 4, borderRadius: 10, background: K.caja, fontSize: 12.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontFamily: MONO }}>{o.code}</b><span style={{ color: K.hi, fontWeight: 700 }}>{ESTADO_OP[o.status] || o.status}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: K.sub, marginTop: 2 }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[CANAL[o.channel], o.description].filter(Boolean).join(" · ")}</span><span style={{ flexShrink: 0 }}>{o.eta ? `llega ${fechaCorta(o.eta)}` : ""}{admin && o.saldo > 0.5 ? `${o.eta ? " · " : ""}${usd(o.saldo)}` : ""}</span></div>
      </div>)}
    </Seccion>}

    <Seccion K={K} t="Qué hablaron" right={<Accion c={K.hi} onClick={resumir} disabled={resumiendo}>{resumiendo ? "Resumiendo…" : c.summary ? "Actualizar" : "Resumir"}</Accion>}>
      {c.summary ? <>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{c.summary}</p>
        {c.pending && <p style={{ margin: "5px 0 0", fontSize: 12.5, color: K.hi }}>→ {c.pending}</p>}
        <p style={{ margin: "4px 0 0", fontSize: 11, color: K.mute }}>{c.summary_at ? `Resumen de ${hace(c.summary_at)}` : ""}</p>
      </> : <p style={{ margin: 0, fontSize: 12.5, color: K.mute }}>Todavía sin resumen.</p>}
    </Seccion>

    <Seccion K={K} t="Cliente" right={!c.client_id && <Accion c={K.hi} onClick={() => buscarClientes(buscar || (c.name || c.wa_name || "").split(" ")[0] || " ")}>Vincular</Accion>}>
      {cl ? <div>
        <Dato K={K} l="Nombre">{cl.nombre || cl.company_name || "—"}{cl.client_code ? <span style={{ color: K.hi, fontFamily: MONO, marginLeft: 6 }}>{cl.client_code}</span> : null}</Dato>
        {cl.company_name && cl.nombre && <Dato K={K} l="Razón social">{cl.company_name}</Dato>}
        <Dato K={K} l="Condición">{FISCAL[cl.tax_condition] || "—"}{cl.cuit ? ` · ${cl.cuit}` : ""}</Dato>
        {(cl.city || cl.province) && <Dato K={K} l="Localidad">{[cl.city, cl.province].filter(Boolean).join(", ")}</Dato>}
        {cl.email && <Dato K={K} l="Mail">{cl.email}</Dato>}
        <Dato K={K} l="Cliente desde">{fechaCorta(cl.created_at)}</Dato>
        {ultima && <Dato K={K} l="Última entrega">{fechaCorta(ultima)}{diasDesde(ultima) != null ? ` · hace ${diasDesde(ultima)} días` : ""}</Dato>}
        <a href={`/admin?client=${cl.id}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: 12.5, color: K.hi, fontWeight: 700, textDecoration: "none" }}>Abrir en el admin ↗</a>
      </div> : c.client_id && !d ? <p style={{ margin: 0, fontSize: 12.5, color: K.mute }}>Cargando…</p> : <>
        <p style={{ margin: 0, fontSize: 12.5, color: K.sub }}>Todavía no es cliente.</p>
        {clientes !== null && <div style={{ marginTop: 6 }}>
          <input value={buscar} onChange={(ev) => buscarClientes(ev.target.value)} placeholder="Buscar cliente por nombre o código" data-enter-libre="1" style={{ ...inp, padding: "8px 10px", fontSize: 12.5 }} autoFocus />
          {clientes.map((x) => <button key={x.id} onClick={() => vincular(x)} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", marginTop: 3, borderRadius: 8, border: `1px solid ${K.line}`, background: K.caja, color: K.txt, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{[x.first_name, x.last_name].filter(Boolean).join(" ") || x.company_name} <span style={{ color: K.mute, fontFamily: MONO, fontSize: 11 }}>{x.client_code || ""} {x.whatsapp || ""}</span></button>)}
          {buscar.trim().length >= 2 && !clientes.length && <p style={{ margin: "6px 0 0", fontSize: 12, color: K.mute }}>Nadie con ese nombre.</p>}
        </div>}
      </>}
    </Seccion>

    {historial.length > 0 && <Seccion K={K} t="Historial" right={historial.length > 5 && <Accion c={K.hi} onClick={() => setTodo((v) => !v)}>{todo ? "Ver menos" : `Ver los ${historial.length}`}</Accion>}>
      {historial.slice(0, todo ? 60 : 5).map((x) => <div key={x.k} style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "5px 0", borderTop: `1px solid ${K.line}` }}><span style={{ color: K.mute, fontFamily: MONO, flexShrink: 0 }}>{fechaCorta(x.fecha)}</span><span style={{ flex: 1, minWidth: 0, color: x.ok ? K.ok : K.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.t}</span><span style={{ color: K.sub, fontFamily: MONO, flexShrink: 0 }}>{x.v}</span></div>)}
    </Seccion>}

    <Seccion K={K} t="Etapa" right={!eligiendo && <Accion c={K.hi} onClick={() => setEligiendo(true)}>Cambiar</Accion>}>
      {!eligiendo ? <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: e.c }}>{e.l}</span>
        <span style={{ fontSize: 11.5, color: K.mute }}>{c.stage_manual ? "puesta a mano" : "automática"}{c.stage_at ? ` · ${hace(c.stage_at)}` : ""}</span>
        {c.stage === "perdido" && c.lost_reason && <span style={{ fontSize: 11.5, color: K.sub }}>· {c.lost_reason}</span>}
      </div> : <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {ETAPAS.map((x) => <button key={x.k} onClick={() => etapa(x.k)} style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${c.stage === x.k ? x.c : K.line}`, background: c.stage === x.k ? `${x.c}22` : "transparent", color: x.c, fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{x.l}</button>)}
        {c.stage_manual && <button onClick={automatica} style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${K.line}`, background: "transparent", color: K.sub, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Volver a automática</button>}
        <button onClick={() => setEligiendo(false)} style={{ padding: "6px 10px", borderRadius: 999, border: "none", background: "transparent", color: K.mute, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
      </div>}
    </Seccion>

    <Seccion K={K} t="Origen">
      <Dato K={K} l="Llegó por">{c.source === "ad" ? <>Anuncio{c.campaign_name ? <> · <b>{c.campaign_name}</b>{c.ad_name ? ` › ${c.ad_name}` : ""}</> : c.ad_headline ? ` · ${c.ad_headline}` : ""}</> : c.source === "historial" ? "Chat anterior a la conexión" : c.first_in_at ? "Escribió por su cuenta" : "Le escribiste vos primero"}</Dato>
      <Dato K={K} l="Primer mensaje">{c.first_in_at ? fechaCorta(c.first_in_at) : "todavía no escribió"}</Dato>
      <Dato K={K} l="Último">{c.last_msg_at ? hace(c.last_msg_at) : "—"}{d?.mensajes ? ` · ${d.mensajes} mensajes guardados` : ""}</Dato>
    </Seccion>

    <Seccion K={K} t="Próximo contacto">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <DatePicker value={c.next_contact_at || ""} onChange={proximo} placeholder="Sin fecha" />
        {c.next_contact_at && <Accion c={K.mute} onClick={() => proximo(null)}>Quitar</Accion>}
      </div>
    </Seccion>

    <Seccion K={K} t="Notas">
      <textarea value={notas} onChange={(ev) => setNotas(ev.target.value)} onBlur={() => { if (notas !== (c.notes || "")) patch({ notes: notas || null }); }} data-enter-libre="1" rows={3} placeholder="Lo que quieras acordarte" style={{ ...inp, resize: "vertical", fontSize: 12.5, lineHeight: 1.45 }} />
    </Seccion>

    {ir && !wa && <div style={{ marginTop: 14 }}><Btn small full onClick={() => ir("chats", { id: c.id })}>Abrir el chat</Btn></div>}
  </div>;
}
