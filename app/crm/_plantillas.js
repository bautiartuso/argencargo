"use client";
// Plantillas de respuesta rápida para el chat (30/10/2026). Viven en message_templates (canal
// whatsapp), la misma tabla que usa Seguimiento, con {{firstName}} y {{clientCode}} como variables.
// Las nuevas que se crean desde acá llevan key crm_<slug>.
import { useState, useEffect } from "react";
import { C, dq, arr, Btn, inp } from "../gi/_base";
import { toast } from "../../lib/ui";
import { Accion } from "./_comun";

const interp = (t, d) => String(t || "").replace(/\{\{(\w+)\}\}/g, (_, k) => (d[k] != null ? String(d[k]) : ""));
const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

export default function Plantillas({ ctx, c, onElegir, onCerrar }) {
  const { token } = ctx;
  const [lista, setLista] = useState(null);
  const [edit, setEdit] = useState(null); // {id?, label, body}
  const cargar = async () => { const r = await dq("message_templates", { token, filters: "?channel=eq.whatsapp&select=id,key,label,body&order=label.asc" }); setLista(arr(r)); };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const datos = { firstName: (c.name || c.wa_name || "").trim().split(/\s+/)[0] || "", clientCode: c.client_code || "" };

  const guardar = async () => {
    if (!edit.label.trim() || !edit.body.trim()) return;
    const body = { label: edit.label.trim(), body: edit.body, updated_at: new Date().toISOString() };
    const r = edit.id ? await dq("message_templates", { token, method: "PATCH", filters: `?id=eq.${edit.id}`, body })
      : await dq("message_templates", { token, method: "POST", body: { ...body, key: `crm_${slug(edit.label) || Date.now()}`, channel: "whatsapp" } });
    if (!Array.isArray(r)) { toast("No se pudo guardar la plantilla", "error"); return; }
    setEdit(null); cargar();
  };
  const borrar = async (t) => { const r = await dq("message_templates", { token, method: "DELETE", filters: `?id=eq.${t.id}`, headers: { Prefer: "return=representation" } }); if (!Array.isArray(r)) toast("No se pudo borrar", "error"); cargar(); };

  return <div style={{ marginBottom: 8, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.25)", border: `1px solid ${C.line}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: "0.1em" }}>Plantillas</span>
      <div style={{ display: "flex", gap: 8 }}>{!edit && <Accion onClick={() => setEdit({ label: "", body: "" })}>Nueva</Accion>}<Accion c={C.mute} onClick={onCerrar}>Cerrar</Accion></div>
    </div>
    {edit ? <div>
      <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} placeholder="Nombre corto" data-enter-libre="1" style={{ ...inp, padding: "8px 10px", fontSize: 12.5, marginBottom: 6 }} autoFocus />
      <textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} placeholder="Texto. Podés usar {{firstName}} y {{clientCode}}." data-enter-libre="1" rows={4} style={{ ...inp, padding: "8px 10px", fontSize: 12.5, resize: "vertical", marginBottom: 6 }} />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><Btn small v="ghost" onClick={() => setEdit(null)}>Cancelar</Btn><Btn small v="gold" onClick={guardar}>Guardar</Btn></div>
    </div> : lista === null ? <p style={{ margin: 0, fontSize: 12, color: C.mute }}>Cargando…</p> : !lista.length ? <p style={{ margin: 0, fontSize: 12, color: C.mute }}>Todavía no hay plantillas.</p> :
      <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 220, overflowY: "auto" }}>
        {lista.map((t) => <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => onElegir(interp(t.body, datos))} title={interp(t.body, datos)} style={{ flex: 1, textAlign: "left", padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.03)", color: C.txt, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", overflow: "hidden" }}>
            <b>{t.label || t.key}</b><span style={{ color: C.mute, marginLeft: 8, fontSize: 11.5, whiteSpace: "nowrap" }}>{String(t.body || "").replace(/\s+/g, " ").slice(0, 70)}</span>
          </button>
          <Accion c={C.mute} onClick={() => setEdit({ id: t.id, label: t.label || "", body: t.body || "" })}>✎</Accion>
          {String(t.key).startsWith("crm_") && <Accion c={C.mute} onClick={() => borrar(t)}>✕</Accion>}
        </div>)}
      </div>}
  </div>;
}
