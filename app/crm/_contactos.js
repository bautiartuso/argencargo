"use client";
// Contactos del CRM. Rehecho el 23/11/2026 sobre crm_personas(), la misma base que Seguimiento: una
// fila por cliente (con su chat, si lo tiene) o por lead que escribió y no se registró, con la
// temperatura y la lectura de la IA. Tocar uno abre la ficha comercial; a un cliente que todavía no
// tiene ficha de WhatsApp se le crea en el momento.
import { useState, useEffect, useCallback, useMemo } from "react";
import { C, MONO, dq, arr, Vacio, Cargando, inp, hace } from "../gi/_base";
import { toast } from "../../lib/ui";
import { hoyAR } from "../../lib/fecha-ar";
import { fmtTel, fechaCorta, Etapa } from "./_comun";
import { enriquecer, nombreDe, importaciones, ultimoToque, esLead, TEMP, n } from "../../lib/crm-seguimiento";
import Ficha from "./_ficha";

// Pagina de a 1000 (PostgREST corta cada request en 1000, también en las RPC).
async function rpcTodos(fn, token) {
  const out = [];
  for (let desde = 0; ; desde += 1000) { const r = await dq(fn, { token, method: "POST", body: {}, filters: `?offset=${desde}&limit=1000` }); if (!Array.isArray(r)) return out; out.push(...r); if (r.length < 1000) return out; }
}
const TIPOS = [["todos", "Todos"], ["leads", "Leads"], ["clientes", "Clientes"], ["chat", "Con chat"], ["agendados", "Con fecha"]];
const TEMPS = ["caliente", "tibio", "frio"];
// Etapa para mostrar: la de la ficha; un cliente sin ficha, por lo que hizo.
const etapaDe = (c) => c.stage || (importaciones(c) > 0 ? "importo" : n(c.quotes_total) > 0 ? "cotizo" : "nuevo");
const COLS = "minmax(190px,1.1fr) 78px 84px minmax(180px,2fr) 70px 96px";

export default function Contactos({ ctx }) {
  const { token, movil, ir } = ctx;
  const [lista, setLista] = useState(null);
  const [tipo, setTipo] = useState("todos");
  const [temp, setTemp] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const cargar = useCallback(async () => { await dq("rpc/crm_sync_etapas", { token, method: "POST", body: {} }); setLista(await rpcTodos("rpc/crm_personas", token)); }, [token]);
  useEffect(() => { cargar(); }, [cargar]);

  const hoy = hoyAR();
  const personas = useMemo(() => (lista || []).map((c) => enriquecer(c, hoy)), [lista, hoy]);
  const filtrada = useMemo(() => personas.filter((c) => {
    if (tipo === "leads" && !esLead(c)) return false;
    if (tipo === "clientes" && esLead(c)) return false;
    if (tipo === "chat" && !c.last_msg_at) return false;
    if (tipo === "agendados" && !c.followup_next_at) return false;
    if (temp && c.temp !== temp) return false;
    if (q) { const s = q.toLowerCase(); if (!`${nombreDe(c)} ${c.wa_name || ""} ${c.client_code || ""} ${c.company_name || ""} ${c.email || ""} ${c.phone || ""}`.toLowerCase().includes(s)) return false; }
    return true;
  }).sort((a, b) => String(ultimoToque(b) || b.ultima_quote_fecha || b.created_at || "").localeCompare(String(ultimoToque(a) || a.ultima_quote_fecha || a.created_at || ""))), [personas, tipo, temp, q]);

  // La ficha trabaja sobre la fila de crm_contacts: se trae entera (o se crea si el cliente no tenía).
  const abrir = async (c) => {
    let ficha = null;
    if (c.contact_id) ficha = arr(await dq("crm_contacts", { token, filters: `?id=eq.${c.contact_id}&select=*` }))[0] || null;
    else {
      if (!c.phone) { toast("Este cliente no tiene WhatsApp cargado", "error"); return; }
      ficha = arr(await dq("crm_contacts", { token, method: "POST", body: { phone: c.phone, client_id: c.id, name: nombreDe(c) || null, source: "cliente", stage: etapaDe(c) } }))[0] || null;
      if (ficha) setLista((l) => (l || []).map((x) => (x.clave === c.clave ? { ...x, contact_id: ficha.id, stage: ficha.stage } : x)));
    }
    if (!ficha) { toast("No se pudo abrir la ficha", "error"); return; }
    setSel({ ...ficha, name: ficha.name || nombreDe(c) || null, clave: c.clave, quien_ef: c.quien_ef });
  };
  const onChange = (patch) => {
    setSel((s) => (s ? { ...s, ...patch } : s));
    const fila = {}; for (const k of ["stage", "notes", "summary", "pending"]) if (k in patch) fila[k] = patch[k];
    if ("next_contact_at" in patch) fila.followup_next_at = patch.next_contact_at;
    if (Object.keys(fila).length) setLista((l) => (l || []).map((x) => (x.clave === sel?.clave ? { ...x, ...fila } : x)));
  };

  const cuenta = (f) => personas.filter(f).length;
  const resumen = `${personas.length.toLocaleString("es-AR")} contactos · ${cuenta((c) => !esLead(c)).toLocaleString("es-AR")} clientes · ${cuenta(esLead)} leads · ${cuenta((c) => !!c.last_msg_at)} con chat · ${cuenta((c) => c.unread > 0)} sin leer`;
  const FichaBox = sel && <Ficha ctx={{ ...ctx, ir: (p, extra) => ir(p, extra) }} c={sel} onChange={onChange} />;

  if (movil && sel) return <div><button onClick={() => setSel(null)} style={{ background: "transparent", border: "none", color: C.goldHi, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "0 0 10px", fontFamily: "inherit" }}>‹ Contactos</button>{FichaBox}</div>;

  return <div style={{ display: "grid", gridTemplateColumns: movil || !sel ? "1fr" : "minmax(0,1fr) 340px", gap: 14 }}>
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: C.sub }}>{lista === null ? "Cargando…" : resumen}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, código, mail o teléfono" data-enter-libre="1" style={{ ...inp, width: movil ? "100%" : 300, padding: "8px 12px", fontSize: 13 }} />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{TIPOS.map(([k, l]) => <Chip key={k} on={tipo === k} onClick={() => setTipo(k)}>{l}</Chip>)}</div>
        <div style={{ display: "flex", gap: 4 }}>{TEMPS.map((k) => <Chip key={k} on={temp === k} c={TEMP[k].c} onClick={() => setTemp(temp === k ? null : k)}>{TEMP[k].l}</Chip>)}</div>
      </div>
      {lista === null ? <Cargando /> : !filtrada.length ? <Vacio>Nadie con ese filtro.</Vacio> :
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {!movil && <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "4px 10px", fontSize: 10.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}><span>Contacto</span><span>Temp.</span><span>Etapa</span><span>En qué está</span><span>Cot · Imp</span><span>Último</span></div>}
          {filtrada.slice(0, 300).map((c) => {
            const on = sel && sel.clave === c.clave; const T = TEMP[c.temp]; const toque = ultimoToque(c);
            const lectura = c.lectura || c.sem.t;
            const ultimo = c.followup_next_at ? `📅 ${fechaCorta(c.followup_next_at)}` : toque ? hace(toque) : "—";
            return <button key={c.clave} onClick={() => abrir(c)} style={{ display: movil ? "flex" : "grid", gridTemplateColumns: COLS, gap: 10, alignItems: "center", padding: "9px 10px", borderRadius: 12, border: "none", background: on ? "rgba(184,149,106,0.1)" : "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: C.txt, minWidth: 0 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: c.unread ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(c) || fmtTel(c.phone)}{c.unread > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: "#ef4444", color: "#fff" }}>{c.unread}</span>}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.mute, fontFamily: MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.client_code ? `${c.client_code} · ` : ""}{c.phone ? fmtTel(c.phone) : "sin WhatsApp"}</p>
                {movil && <p style={{ margin: "3px 0 0", fontSize: 12, color: C.sub, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{lectura}</p>}
              </div>
              {movil ? <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: T.c, flexShrink: 0 }}>{T.l}</span> : <>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: T.c }}>{T.l}</span>
                <div><Etapa k={etapaDe(c)} small /></div>
                <span title={lectura} style={{ fontSize: 12, color: c.lectura ? C.txt : C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lectura}</span>
                <span style={{ fontSize: 12, color: C.sub, fontFamily: MONO }}>{n(c.quotes_total)} · {importaciones(c)}</span>
                <span style={{ fontSize: 11.5, color: c.followup_next_at ? C.goldHi : C.mute, whiteSpace: "nowrap" }}>{ultimo}</span></>}
            </button>; })}
          {filtrada.length > 300 && <p style={{ margin: "8px 0 0", fontSize: 12, color: C.mute, textAlign: "center" }}>Se muestran 300 de {filtrada.length.toLocaleString("es-AR")}. Afiná la búsqueda.</p>}
        </div>}
    </div>
    {!movil && sel && <div style={{ position: "sticky", top: 20, alignSelf: "start", maxHeight: "calc(100vh - 40px)", overflowY: "auto" }} className="crm-scroll">{FichaBox}</div>}
  </div>;
}

function Chip({ on, onClick, children, c }) {
  const col = c || C.goldHi;
  return <button onClick={onClick} style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${on ? col : C.line}`, background: on ? `${col}22` : "transparent", color: on ? col : C.sub, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{children}</button>;
}
