"use client";
// Contactos del CRM (30/10/2026): clientes y leads en una sola lista, sobre la misma base que el
// admin (RPC crm_contactos: fichas del CRM + clientes que todavía no tienen ficha). Tocar uno abre
// la ficha comercial; a un cliente sin ficha se le crea en el momento (si tiene WhatsApp cargado).
import { useState, useEffect, useCallback, useMemo } from "react";
import { C, MONO, dq, arr, Vacio, Cargando, inp, hace } from "../gi/_base";
import { toast } from "../../lib/ui";
import { fmtTel, fechaCorta, ETAPAS, Avatar, Etapa } from "./_comun";
import Ficha from "./_ficha";

// Pagina de a 1000 (PostgREST corta cada request en 1000, también en las RPC).
async function rpcTodos(fn, token) {
  const out = [];
  for (let desde = 0; ; desde += 1000) { const r = await dq(fn, { token, method: "POST", body: {}, filters: `?offset=${desde}&limit=1000` }); if (!Array.isArray(r)) return out; out.push(...r); if (r.length < 1000) return out; }
}
const TIPOS = [["todos", "Todos"], ["leads", "Leads"], ["clientes", "Clientes"], ["agendados", "Con fecha"]];

export default function Contactos({ ctx }) {
  const { token, movil, ir } = ctx;
  const [lista, setLista] = useState(null);
  const [tipo, setTipo] = useState("todos");
  const [etapa, setEtapa] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const cargar = useCallback(async () => { await dq("rpc/crm_sync_etapas", { token, method: "POST", body: {} }); setLista(await rpcTodos("rpc/crm_contactos", token)); }, [token]);
  useEffect(() => { cargar(); }, [cargar]);

  const filtrada = useMemo(() => (lista || []).filter((c) => {
    if (tipo === "leads" && c.client_id) return false;
    if (tipo === "clientes" && !c.client_id) return false;
    if (tipo === "agendados" && !c.next_contact_at) return false;
    if (etapa && c.stage !== etapa) return false;
    if (q) { const s = q.toLowerCase(); if (!`${c.nombre || ""} ${c.wa_name || ""} ${c.client_code || ""} ${c.company_name || ""} ${c.email || ""} ${c.phone || ""}`.toLowerCase().includes(s)) return false; }
    return true;
  }).sort((a, b) => String(b.last_msg_at || b.created_at || "").localeCompare(String(a.last_msg_at || a.created_at || ""))), [lista, tipo, etapa, q]);

  const abrir = async (c) => {
    if (c.contact_id) { setSel({ ...c, id: c.contact_id, name: c.nombre }); return; }
    if (!c.phone) { toast("Este cliente no tiene WhatsApp cargado", "error"); return; }
    const r = await dq("crm_contacts", { token, method: "POST", body: { phone: c.phone, client_id: c.client_id, name: c.nombre, source: "cliente", stage: c.stage } });
    const n = arr(r)[0];
    if (!n) { toast("No se pudo abrir la ficha", "error"); return; }
    setLista((l) => (l || []).map((x) => (x.client_id === c.client_id ? { ...x, contact_id: n.id } : x)));
    setSel({ ...c, ...n, nombre: c.nombre });
  };
  const onChange = (patch) => { setSel((s) => (s ? { ...s, ...patch } : s)); setLista((l) => (l || []).map((x) => (x.contact_id === sel?.id ? { ...x, ...patch, nombre: patch.name || x.nombre } : x))); };

  const n = lista || [];
  const resumen = `${n.length} contactos · ${n.filter((c) => !c.client_id).length} leads · ${n.filter((c) => c.client_id).length} clientes · ${n.filter((c) => c.unread > 0).length} sin leer`;
  const FichaBox = sel && <Ficha ctx={{ ...ctx, ir: (p, extra) => ir(p, extra) }} c={sel} onChange={onChange} />;

  if (movil && sel) return <div><button onClick={() => setSel(null)} style={{ background: "transparent", border: "none", color: C.goldHi, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "0 0 10px", fontFamily: "inherit" }}>‹ Contactos</button>{FichaBox}</div>;

  return <div style={{ display: "grid", gridTemplateColumns: movil || !sel ? "1fr" : "minmax(0,1fr) 340px", gap: 14 }}>
    <div>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: C.sub }}>{lista === null ? "Cargando…" : resumen}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, código, mail o teléfono" data-enter-libre="1" style={{ ...inp, width: movil ? "100%" : 300, padding: "8px 12px", fontSize: 13 }} />
        <div style={{ display: "flex", gap: 4 }}>{TIPOS.map(([k, l]) => <Chip key={k} on={tipo === k} onClick={() => setTipo(k)}>{l}</Chip>)}</div>
        <div style={{ display: "flex", gap: 4 }}>{ETAPAS.map((e) => <Chip key={e.k} on={etapa === e.k} c={e.c} onClick={() => setEtapa(etapa === e.k ? null : e.k)}>{e.l}</Chip>)}</div>
      </div>
      {lista === null ? <Cargando /> : !filtrada.length ? <Vacio>Nadie con ese filtro.</Vacio> :
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {!movil && <div style={{ display: "grid", gridTemplateColumns: "minmax(200px,1.5fr) 110px 150px 90px 110px", gap: 10, padding: "4px 10px", fontSize: 10.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}><span>Contacto</span><span>Etapa</span><span>Origen</span><span>Cot · Imp</span><span>Último</span></div>}
          {filtrada.slice(0, 400).map((c) => { const on = sel && (sel.id === c.contact_id || (!c.contact_id && sel.client_id === c.client_id)); return <button key={c.contact_id || `cl-${c.client_id}`} onClick={() => abrir(c)} style={{ display: movil ? "flex" : "grid", gridTemplateColumns: "minmax(200px,1.5fr) 110px 150px 90px 110px", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 12, border: "none", background: on ? "rgba(184,149,106,0.1)" : "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: C.txt }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0, flex: 1 }}>
              <Avatar c={{ name: c.nombre, wa_name: c.wa_name }} s={34} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: c.unread ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre || fmtTel(c.phone)}{c.unread > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: "#ef4444", color: "#fff" }}>{c.unread}</span>}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.mute, fontFamily: MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.client_code ? `${c.client_code} · ` : ""}{c.phone ? fmtTel(c.phone) : "sin WhatsApp"}{movil ? ` · ${c.cotizaciones} cot · ${c.importaciones} imp` : ""}</p>
              </div>
            </div>
            {movil ? <Etapa k={c.stage} small /> : <><div><Etapa k={c.stage} small /></div>
              <span style={{ fontSize: 12, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.source === "ad" ? `📣 ${c.campaign_name || c.ad_headline || "anuncio"}` : c.source === "cliente" ? "Cliente" : c.source === "historial" ? "Chat viejo" : c.source === "organico" ? "Escribió solo" : "—"}</span>
              <span style={{ fontSize: 12, color: C.sub, fontFamily: MONO }}>{c.cotizaciones} · {c.importaciones}</span>
              <span style={{ fontSize: 11.5, color: c.next_contact_at ? C.goldHi : C.mute }}>{c.next_contact_at ? `📅 ${fechaCorta(c.next_contact_at)}` : c.last_msg_at ? hace(c.last_msg_at) : "sin chat"}</span></>}
          </button>; })}
          {filtrada.length > 400 && <p style={{ margin: "8px 0 0", fontSize: 12, color: C.mute, textAlign: "center" }}>Se muestran 400 de {filtrada.length}. Afiná la búsqueda.</p>}
        </div>}
    </div>
    {!movil && sel && <div style={{ position: "sticky", top: 20, alignSelf: "start" }}>{FichaBox}</div>}
  </div>;
}

function Chip({ on, onClick, children, c }) {
  const col = c || C.goldHi;
  return <button onClick={onClick} style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${on ? col : C.line}`, background: on ? `${col}22` : "transparent", color: on ? col : C.sub, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{children}</button>;
}
