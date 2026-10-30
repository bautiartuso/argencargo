"use client";
// Ficha comercial de un contacto (30/10/2026): quién es, de dónde vino, en qué etapa está, qué
// habló (resumen de Claude), qué cotizó y qué importó, y cuándo tocarlo. La misma ficha se ve al
// costado del chat y en Contactos. Los datos del cliente salen de la RPC crm_ficha (ops, cotizaciones,
// facturado); la etapa automática la pone crm_sync_etapas y acá se puede corregir a mano.
import { useState, useEffect, useCallback } from "react";
import { C, MONO, dq, arr, Btn, inp, hace } from "../gi/_base";
import { toast, confirmDialog } from "../../lib/ui";
import DatePicker from "../components/DatePicker";
import { fmtTel, nombreDe, fechaCorta, usd, ETAPAS, etapaDe, Avatar, api, Accion } from "./_comun";

const Seccion = ({ t, right, children }) => <div style={{ marginTop: 14 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t}</p>{right}</div>{children}</div>;
const ESTADO_OP = { delivered: "Entregada", closed: "Cerrada", in_transit: "En tránsito", pending: "Pendiente", cancelled: "Cancelada" };

export default function Ficha({ ctx, c, onChange, compacta }) {
  const { token, admin, ir } = ctx;
  const [d, setD] = useState(null);
  const [notas, setNotas] = useState(c.notes || "");
  const [buscar, setBuscar] = useState("");
  const [clientes, setClientes] = useState(null);
  const [resumiendo, setResumiendo] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  useEffect(() => { setNotas(c.notes || ""); setBuscar(""); setClientes(null); setEligiendo(false); }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const cargar = useCallback(async () => { const r = await dq("rpc/crm_ficha", { token, method: "POST", body: { p_contact_id: c.id } }); setD(r && !r.code ? r : { ops: [], cots: [] }); }, [token, c.id]);
  useEffect(() => { cargar(); }, [cargar]);

  const patch = async (p) => { const r = await dq("crm_contacts", { token, method: "PATCH", filters: `?id=eq.${c.id}`, body: { ...p, updated_at: new Date().toISOString() } }); if (Array.isArray(r)) onChange?.(p); else toast("No se pudo guardar", "error"); };
  const etapa = async (k) => {
    if (k === "perdido") { const ok = await confirmDialog(`¿Marcar a ${nombreDe(c)} como perdido? No aparece más en Seguimiento.`); if (!ok) return; }
    await patch({ stage: k, stage_manual: true, stage_at: new Date().toISOString() }); setEligiendo(false);
  };
  const automatica = async () => { await patch({ stage_manual: false }); const r = await dq("rpc/crm_sync_etapas", { token, method: "POST", body: {} }); if (r && !r.code) { const n = await dq("crm_contacts", { token, filters: `?id=eq.${c.id}&select=stage,stage_at` }); const x = arr(n)[0]; if (x) onChange?.(x); } setEligiendo(false); };
  const resumir = async () => { setResumiendo(true); const r = await api("/api/crm/resumen", { contact_id: c.id }); setResumiendo(false); if (r.ok) onChange?.({ summary: r.summary, pending: r.pending, summary_at: r.summary_at }); else toast(r.error || "No se pudo resumir", "error"); };
  const buscarClientes = async (q) => { setBuscar(q); if (q.trim().length < 2) { setClientes(null); return; } const s = q.trim().replace(/[,.()]/g, " "); const r = await dq("clients", { token, filters: `?select=id,first_name,last_name,client_code,company_name,whatsapp&or=(first_name.ilike.*${s}*,last_name.ilike.*${s}*,company_name.ilike.*${s}*,client_code.ilike.*${s}*)&limit=8` }); setClientes(arr(r)); };
  const vincular = async (cl) => { await patch({ client_id: cl.id, name: c.name || [cl.first_name, cl.last_name].filter(Boolean).join(" ") || cl.company_name }); setBuscar(""); setClientes(null); cargar(); };

  const cl = d?.cliente;
  const e = etapaDe(c.stage);
  return <div style={{ background: compacta ? "transparent" : C.panel, border: compacta ? "none" : `1px solid ${C.line}`, borderRadius: 16, padding: compacta ? 0 : 14 }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Avatar c={c} s={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(c)}</p>
        <p style={{ margin: "1px 0 0", fontSize: 11.5, color: C.mute, fontFamily: MONO }}>{fmtTel(c.phone)}</p>
      </div>
    </div>

    <Seccion t="Etapa" right={!eligiendo && <Accion onClick={() => setEligiendo(true)}>Cambiar</Accion>}>
      {!eligiendo ? <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: e.c }}>{e.l}</span>
        <span style={{ fontSize: 11.5, color: C.mute }}>{c.stage_manual ? "puesta a mano" : "automática"}{c.stage_at ? ` · ${hace(c.stage_at)}` : ""}</span>
        {c.stage === "perdido" && c.lost_reason && <span style={{ fontSize: 11.5, color: C.sub }}>· {c.lost_reason}</span>}
      </div> : <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {ETAPAS.map((x) => <button key={x.k} onClick={() => etapa(x.k)} style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${c.stage === x.k ? x.c : C.line}`, background: c.stage === x.k ? `${x.c}22` : "transparent", color: x.c, fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{x.l}</button>)}
        {c.stage_manual && <button onClick={automatica} style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${C.line}`, background: "transparent", color: C.sub, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Volver a automática</button>}
        <button onClick={() => setEligiendo(false)} style={{ padding: "6px 10px", borderRadius: 999, border: "none", background: "transparent", color: C.mute, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
      </div>}
    </Seccion>

    <Seccion t="Origen">
      <p style={{ margin: 0, fontSize: 13, color: C.txt }}>
        {c.source === "ad" ? <>📣 Anuncio{c.campaign_name ? <> · <b>{c.campaign_name}</b>{c.ad_name ? ` › ${c.ad_name}` : ""}</> : c.ad_headline ? ` · ${c.ad_headline}` : ""}{c.ad_at ? <span style={{ color: C.mute }}> · {fechaCorta(c.ad_at)}</span> : null}</>
          : c.source === "historial" ? "Chat anterior a la conexión" : "Escribió por su cuenta"}
      </p>
      <p style={{ margin: "3px 0 0", fontSize: 11.5, color: C.mute }}>Primer mensaje {c.first_in_at ? fechaCorta(c.first_in_at) : "—"} · último {c.last_msg_at ? hace(c.last_msg_at) : "—"}</p>
    </Seccion>

    <Seccion t="Cliente" right={!c.client_id && <Accion onClick={() => buscarClientes(buscar || (c.name || "").split(" ")[0] || "")}>Vincular</Accion>}>
      {cl ? <div style={{ fontSize: 13 }}>
        <p style={{ margin: 0 }}><b>{cl.nombre || cl.company_name || "—"}</b>{cl.client_code ? <span style={{ color: C.goldHi, fontFamily: MONO, marginLeft: 6 }}>{cl.client_code}</span> : null}</p>
        {cl.email && <p style={{ margin: "2px 0 0", color: C.sub }}>{cl.email}</p>}
        <p style={{ margin: "2px 0 0", color: C.mute, fontSize: 11.5 }}>Cliente desde {fechaCorta(cl.created_at)}{admin && d.facturado > 0 ? ` · facturado ${usd(d.facturado)}` : ""}</p>
        <a href={`/admin?client=${cl.id}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 4, fontSize: 12, color: C.goldHi, fontWeight: 700, textDecoration: "none" }}>Abrir en el admin ↗</a>
      </div> : c.client_id && !d ? <p style={{ margin: 0, fontSize: 12.5, color: C.mute }}>Cargando…</p> : <>
        <p style={{ margin: 0, fontSize: 12.5, color: C.sub }}>Lead sin ficha de cliente.</p>
        {(clientes !== null || buscar) && <div style={{ marginTop: 6 }}>
          <input value={buscar} onChange={(ev) => buscarClientes(ev.target.value)} placeholder="Buscar cliente por nombre o código" data-enter-libre="1" style={{ ...inp, padding: "8px 10px", fontSize: 12.5 }} autoFocus />
          {clientes && clientes.map((x) => <button key={x.id} onClick={() => vincular(x)} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", marginTop: 3, borderRadius: 8, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.03)", color: C.txt, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{[x.first_name, x.last_name].filter(Boolean).join(" ") || x.company_name} <span style={{ color: C.mute, fontFamily: MONO, fontSize: 11 }}>{x.client_code || ""} {x.whatsapp || ""}</span></button>)}
          {clientes && !clientes.length && <p style={{ margin: "6px 0 0", fontSize: 12, color: C.mute }}>Nadie con ese nombre.</p>}
        </div>}
      </>}
    </Seccion>

    {c.client_id && d && (d.cots?.length > 0 || d.ops?.length > 0) && <Seccion t={`Cotizó ${d.cots?.length || 0} · importó ${d.ops?.filter((o) => o.entregada).length || 0}`}>
      {[...(d.ops || []).map((o) => ({ k: `o${o.id}`, fecha: o.delivered_at || o.created_at, t: `${o.code || "Op"} · ${ESTADO_OP[o.status] || o.status || ""}`, v: admin && o.total ? usd(o.total) : "", ok: o.entregada })), ...(d.cots || []).map((q) => ({ k: `q${q.id}`, fecha: q.created_at, t: `Cotización ${q.code || ""}`, v: admin && q.total ? usd(q.total) : "", ok: false }))]
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 8)
        .map((x) => <div key={x.k} style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "4px 0", borderTop: `1px solid ${C.line}` }}><span style={{ color: C.mute, fontFamily: MONO, flexShrink: 0 }}>{fechaCorta(x.fecha)}</span><span style={{ flex: 1, color: x.ok ? C.green : C.txt }}>{x.t}</span><span style={{ color: C.sub, fontFamily: MONO }}>{x.v}</span></div>)}
    </Seccion>}

    <Seccion t="Qué hablaron" right={<Accion onClick={resumir} disabled={resumiendo}>{resumiendo ? "Resumiendo…" : c.summary ? "Actualizar" : "Resumir"}</Accion>}>
      {c.summary ? <>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{c.summary}</p>
        {c.pending && <p style={{ margin: "5px 0 0", fontSize: 12.5, color: C.goldHi }}>→ {c.pending}</p>}
        <p style={{ margin: "4px 0 0", fontSize: 11, color: C.mute }}>{c.summary_at ? `Resumen de ${hace(c.summary_at)}` : ""}</p>
      </> : <p style={{ margin: 0, fontSize: 12.5, color: C.mute }}>Se arma solo cuando la charla queda quieta un rato.</p>}
    </Seccion>

    <Seccion t="Próximo contacto">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <DatePicker value={c.next_contact_at || ""} onChange={(v) => patch({ next_contact_at: v || null })} placeholder="Sin fecha" />
        {c.next_contact_at && <Accion c={C.mute} onClick={() => patch({ next_contact_at: null })}>Quitar</Accion>}
      </div>
    </Seccion>

    <Seccion t="Notas">
      <textarea value={notas} onChange={(ev) => setNotas(ev.target.value)} onBlur={() => { if (notas !== (c.notes || "")) patch({ notes: notas || null }); }} data-enter-libre="1" rows={3} placeholder="Lo que quieras acordarte" style={{ ...inp, resize: "vertical", fontSize: 12.5, lineHeight: 1.45 }} />
    </Seccion>

    {ir && <div style={{ marginTop: 14 }}><Btn small full onClick={() => ir("chats", { id: c.id })}>Abrir el chat</Btn></div>}
  </div>;
}
