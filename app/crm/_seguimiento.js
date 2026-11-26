"use client";
// Seguimiento comercial del CRM. Rehecho el 23/11/2026 sobre crm_personas(): una fila por cliente o
// por lead de WhatsApp, con lo que importó, lo que cotizó, el chat y el análisis de la IA en la misma
// fila. Las reglas (a quién conviene escribir, descansos, prioridad, quién lo lleva) están en
// lib/crm-seguimiento.js y las comparte Contactos.
//  - Es una lista de trabajo (26/11/2026): cada solapa muestra solo a quién toca escribirle hoy, por
//    prioridad; al mandar el WhatsApp o registrar, la fila se va. Los que descansan (se habló hace
//    poco, ya se les escribió, tienen fecha) se ven aparte, con un enlace al pie.
//  - El mensaje sugerido es el que escribió la IA con el análisis; si todavía no lo tiene, el armado
//    en lib/crm-mensaje.js. Los dos con la voz de Bauti (26/11/2026), distinto según la solapa.
import { useState, useRef, useEffect, useMemo } from "react";
import { apodoDe } from "../../lib/apodos";
import { toast, alertDialog, SkeletonTable, EmptyState } from "../../lib/ui";
import DatePicker from "../components/DatePicker";
import { hoyAR } from "../../lib/fecha-ar";
import { mensajeBase } from "../../lib/crm-mensaje";
import { GOLD_LIGHT, GOLD_GRADIENT, dq, dqPage, useEsCelu } from "./_compat";
import { api } from "./_comun";
import { n, dias, diasTxt, fechaDM, fmtUsd, waNum, canalTxt, enCurso, importaciones, ultimaImp, esLead, nombreDe, enriquecer, TEMP } from "../../lib/crm-seguimiento";

const POR_PAG = 40;
const SEGS = [
  { k: "importaron", l: "Importaron y no volvieron", c: "#8CC8F5" },
  { k: "cotizaron", l: "Cotizaron y no importaron", c: "#E8D098" },
  { k: "nunca", l: "Nunca cotizaron", c: "#c4b5fd" },
  { k: "leads", l: "Escribieron y no se registraron", c: "#6ee7b7" },
  { k: "no_contactar", l: "No contactar", c: "#f87171" },
];
const ESTADO = { enviado: "contactado", sin_respuesta: "contactado", respondio: "respondio", va_a_importar: "va_a_importar", mas_adelante: "mas_adelante", no_interesado: "no_interesado", no_contactar: "no_contactar", reactivar: "sin_contacto" };
const OUTCOMES = [["respondio", "Respondió", "#4ade80"], ["sin_respuesta", "Sin respuesta", "#fbbf24"], ["va_a_importar", "Va a importar", "#8CC8F5"], ["mas_adelante", "Más adelante", "#c4b5fd"], ["no_interesado", "No le interesa", "rgba(255,255,255,0.6)"]];
const OUT_LBL = { respondio: "Respondió", sin_respuesta: "Sin respuesta", va_a_importar: "Va a importar", mas_adelante: "Más adelante", no_interesado: "No le interesa", no_contactar: "No contactar", enviado: "Mensaje enviado", nota: "Nota" };
const COND = { responsable_inscripto: "RI", monotributo: "Mono", monotributista: "Mono", consumidor_final: "CF", ninguna: "CF" };
const SEM_COLOR = { si: "#4ade80", espera: "#fbbf24", no: "#f87171" };
const SEM_ORD = { si: 0, espera: 1, no: 2 };
const generico = (s) => !s || /^(consolidado|varios|mercader[ií]a|productos varios|-+|\.+)$/i.test(String(s).trim());
const minus = (s) => String(s || "").trim().split(/\s+/).map((w) => (/^[A-ZÁÉÍÓÚÑ0-9]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");

const pill = (txt, color, extra = {}) => <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, color, background: `${color}1f`, border: `1px solid ${color}55`, whiteSpace: "nowrap", ...extra }}>{txt}</span>;
const btn = (txt, on, { color = "rgba(255,255,255,0.75)", bg = "rgba(255,255,255,0.04)", border = "rgba(255,255,255,0.12)", strong, title, disabled } = {}) => <button type="button" title={title} onClick={on} disabled={disabled} style={{ height: 34, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 9, border: `1px solid ${border}`, background: bg, color, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap", ...(strong ? { boxShadow: "0 6px 16px rgba(37,211,102,0.25)" } : {}) }}>{txt}</button>;
const titulo = (t) => <p style={{ margin: "0 0 8px", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>{t}</p>;
const caja = { padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" };

function SeguimientoPanelBase({ token, flash, ir, admin }) {
  const celu = useEsCelu();
  const [rows, setRows] = useState([]); const [lo, setLo] = useState(true); const [err, setErr] = useState("");
  const [seg, setSeg] = useState("importaron"); const [verEsperan, setVerEsperan] = useState(false); const [pag, setPag] = useState(0);
  const [abierto, setAbierto] = useState(null); const [hist, setHist] = useState({});
  const [reg, setReg] = useState(null); // {clave,outcome,note,next}
  const [confNc, setConfNc] = useState(null);
  const [analizando, setAnalizando] = useState(null);
  const ctxRef = useRef({});
  useEffect(() => { setPag(0); }, [seg, verEsperan]);
  useEffect(() => { setVerEsperan(false); }, [seg]);

  const cargar = async () => {
    setLo(true); setErr("");
    let todo = []; let desde = 0;
    while (true) { const r = await dqPage("rpc/crm_personas", { token, filters: "?select=*", desde, hasta: desde + 999 }); if (r.error) { setErr("No pudimos cargar el seguimiento."); break; } todo = todo.concat(r.rows); if (r.rows.length < 1000) break; desde += 1000; }
    setRows(todo); setLo(false);
  };
  useEffect(() => { cargar(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoy = hoyAR();
  const enriquecidas = useMemo(() => rows.map((c) => enriquecer(c, hoy)), [rows, hoy]);
  // El número de cada solapa: a cuántos toca escribirles hoy.
  const cuenta = (k) => enriquecidas.filter((c) => c.seg === k && (k === "no_contactar" || c.sem.k === "si")).length;
  const delGrupo = useMemo(() => enriquecidas.filter((c) => c.seg === seg), [enriquecidas, seg]);
  const partido = seg !== "no_contactar";
  const nEsperan = partido ? delGrupo.filter((c) => c.sem.k !== "si").length : 0;
  const lista = useMemo(() => {
    if (!partido) return [...delGrupo].sort((a, b) => new Date(b.no_contactar_at || b.ultimo_contacto_at || 0) - new Date(a.no_contactar_at || a.ultimo_contacto_at || 0));
    return delGrupo.filter((c) => (verEsperan ? c.sem.k !== "si" : c.sem.k === "si")).sort((a, b) => SEM_ORD[a.sem.k] - SEM_ORD[b.sem.k] || b.prio - a.prio || n(b.facturado_usd) - n(a.facturado_usd) || new Date(b.ultima_quote_fecha || b.last_msg_at || b.created_at || 0) - new Date(a.ultima_quote_fecha || a.last_msg_at || a.created_at || 0));
  }, [delGrupo, verEsperan, partido]);
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAG)); const visibles = lista.slice(pag * POR_PAG, pag * POR_PAG + POR_PAG);
  const parchar = (clave, patch) => setRows((p) => p.map((x) => (x.clave === clave ? { ...x, ...(typeof patch === "function" ? patch(x) : patch) } : x)));

  // ── Mensaje: el de la IA; si no hay análisis (el que nunca cotizó no se analiza), el armado con la
  // voz de Bauti (lib/crm-mensaje.js) ──
  const contextoDe = async (c) => {
    if (ctxRef.current[c.clave]) return ctxRef.current[c.clave];
    const ctx = { opDesc: "", quoteDesc: "" };
    try {
      const [o, q] = await Promise.all([
        c.id && importaciones(c) > 0 ? dq("operations", { token, filters: `?client_id=eq.${c.id}&status=eq.operacion_cerrada&select=description&order=closed_at.desc.nullslast&limit=1` }) : Promise.resolve([]),
        c.ultima_quote_num ? dq("quotes", { token, filters: `?quote_number=eq.${c.ultima_quote_num}&select=products&limit=1` }) : Promise.resolve([]),
      ]);
      const d = Array.isArray(o) && o[0]?.description; if (!generico(d)) ctx.opDesc = String(d).trim().slice(0, 80);
      const prods = Array.isArray(q) && Array.isArray(q[0]?.products) ? q[0].products.map((p) => String(p.description || "").trim()).filter((x) => x && !generico(x)) : [];
      if (prods.length) ctx.quoteDesc = prods.length === 1 ? minus(prods[0]) : `${minus(prods[0])} y ${minus(prods[1])}${prods.length > 2 ? " (entre otras cosas)" : ""}`;
    } catch (e) { console.error("contexto seguimiento", e); }
    ctxRef.current[c.clave] = ctx; return ctx;
  };
  const mensajeDe = async (c) => {
    if (c.mensaje) return c.mensaje;
    const pila = apodoDe(c.first_name || c.wa_name || "");
    const grupo = esLead(c) ? "lead" : importaciones(c) > 0 ? "importo" : n(c.quotes_total) > 0 ? "cotizo" : "nunca";
    const ctx = grupo === "cotizo" ? await contextoDe(c) : {};
    const producto = String(ctx.quoteDesc || "").replace(/\s*\(entre otras cosas\)/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return mensajeBase({ clave: c.clave, grupo, pila, presentarse: !c.last_msg_at && grupo !== "importo", producto, vuelta: n(c.contactos) });
  };

  // ── Registrar un contacto (cliente o lead) ──
  const registrar = async (c, outcome, { note = "", next = null, channel = "nota" } = {}) => {
    const now = new Date().toISOString();
    const reactiva = outcome === "reactivar";
    const r = await dq("client_followups", { method: "POST", token, body: { client_id: c.id || null, contact_id: c.id ? null : c.contact_id, channel, outcome: reactiva ? "nota" : outcome, note: reactiva ? (note || "Vuelve a seguimiento") : (note || null), next_at: next || null } });
    if (r && !Array.isArray(r) && r.code) { toast(`No se pudo guardar: ${r.message || r.code}`, "error"); return false; }
    const estado = ESTADO[outcome] || c.followup_status || "sin_contacto";
    const local = { followup_status: estado, followup_next_at: next || null };
    if (c.id) {
      const patch = { followup_status: estado, followup_next_at: next || null };
      if (channel !== "nota") { patch.last_followup_at = now; local.last_followup_at = now; }
      if (reactiva) { patch.marketing_opt_out = false; local.marketing_opt_out = false; }
      await dq("clients", { method: "PATCH", token, filters: `?id=eq.${c.id}`, body: patch });
    }
    if (c.contact_id) {
      const patch = { next_contact_at: next || null, updated_at: now };
      if (!c.id) patch.followup_status = estado;
      if (reactiva && c.stage === "perdido") { patch.stage = "hablando"; patch.stage_manual = false; local.stage = "hablando"; }
      await dq("crm_contacts", { method: "PATCH", token, filters: `?id=eq.${c.contact_id}`, body: patch });
    }
    parchar(c.clave, (x) => ({ ...local, contactos: n(x.contactos) + 1, ultimo_contacto_at: now, ultimo_outcome: reactiva ? "nota" : outcome, ultimo_note: note || x.ultimo_note,
      ...(outcome === "enviado" || outcome === "sin_respuesta" ? { intentos_sin_respuesta: n(x.intentos_sin_respuesta) + 1 } : ["respondio", "va_a_importar", "mas_adelante", "no_interesado"].includes(outcome) ? { intentos_sin_respuesta: 0 } : {}),
      ...(outcome === "no_contactar" ? { no_contactar_at: now, no_contactar_nota: note || null, ia_apto: false } : reactiva ? { no_contactar_at: null, no_contactar_nota: null } : { ia_apto: false }) }));
    setHist((h) => (h[c.clave] ? { ...h, [c.clave]: [{ id: "tmp" + now, created_at: now, channel, outcome: reactiva ? "nota" : outcome, note: reactiva ? (note || "Vuelve a seguimiento") : note, next_at: next }, ...h[c.clave]] } : h));
    return true;
  };
  const abrirWA = async (c) => {
    const num = waNum(c); if (!num) { alertDialog("Esta persona no tiene WhatsApp cargado."); return; }
    const texto = await mensajeDe(c);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(texto)}`, "_blank");
    await registrar(c, "enviado", { channel: "whatsapp" });
    flash(`WhatsApp abierto · ${c.client_code || nombreDe(c)}. Cuando te conteste, registralo acá.`);
  };
  const noContactar = async (c) => { setConfNc(null); const ok = await registrar(c, "no_contactar", { note: "" }); if (ok) toast(`${nombreDe(c)}: no se le escribe más. Lo ves en la solapa No contactar.`, "success"); };
  const reactivar = async (c) => { const ok = await registrar(c, "reactivar", {}); if (ok) toast(`${nombreDe(c)} vuelve al seguimiento`, "success"); };
  const cargarHist = async (c) => { if (hist[c.clave]) return; const f = [c.id ? `client_id.eq.${c.id}` : null, c.contact_id ? `contact_id.eq.${c.contact_id}` : null].filter(Boolean).join(","); const r = await dq("client_followups", { token, filters: `?or=(${f})&select=*&order=created_at.desc&limit=30` }); setHist((h) => ({ ...h, [c.clave]: Array.isArray(r) ? r : [] })); };
  const toggle = (c) => { const nx = abierto === c.clave ? null : c.clave; setAbierto(nx); if (nx) cargarHist(c); };
  const guardarReg = async (c) => {
    if (!reg || reg.clave !== c.clave || !reg.outcome) { toast("Elegí qué pasó", "warn"); return; }
    if (reg.outcome === "mas_adelante" && !reg.next) { toast("Poné la fecha para volver a escribirle", "warn"); return; }
    const ok = await registrar(c, reg.outcome, { note: reg.note, next: reg.next || null, channel: reg.outcome === "respondio" || reg.outcome === "sin_respuesta" ? "whatsapp" : "nota" });
    if (ok) { setReg(null); toast("Registrado", "success"); }
  };

  const analizar = async (c) => {
    setAnalizando(c.clave);
    const r = await api("/api/cron/crm-analisis", { clave: c.clave });
    setAnalizando(null);
    if (!r.ok) { toast(r.error || "No se pudo analizar", "error"); return; }
    parchar(c.clave, (x) => ({ ...r.analisis, analisis_error: null, quien_ef: x.quien_manual || r.analisis.quien }));
  };

  const fila = (c) => {
    const dc = dias(c.ultimo_contacto_at || c.last_followup_at); const open = abierto === c.clave; const r = reg && reg.clave === c.clave ? reg : null;
    const nc = c.seg === "no_contactar"; const imps = importaciones(c); const T = TEMP[c.temp];
    const col = SEM_COLOR[c.sem.k];
    const principal = c.lectura || c.sem.t;
    const chat = c.last_msg_at ? `Último chat ${diasTxt(dias(c.last_msg_at))}${c.last_direction === "in" ? " · escribió él" : ""}` : "";
    const contacto = (c.ultimo_contacto_at || c.last_followup_at) ? `Último contacto ${diasTxt(dc)}${c.ultimo_outcome ? ` · ${OUT_LBL[c.ultimo_outcome] || c.ultimo_outcome}` : ""}${n(c.intentos_sin_respuesta) > 0 ? ` · ${c.intentos_sin_respuesta} sin respuesta` : ""}${c.ultimo_note ? ` · “${String(c.ultimo_note).slice(0, 80)}”` : ""}` : "";
    const pie = nc ? "" : [c.lectura ? c.sem.t : "", chat, contacto, c.followup_next_at ? `próximo ${fechaDM(c.followup_next_at)}` : ""].filter(Boolean).join(" · ");
    return <div key={c.clave} style={{ borderRadius: 14, border: `1px solid ${nc ? "rgba(248,113,113,0.35)" : open ? "rgba(184,149,106,0.4)" : "rgba(255,255,255,0.08)"}`, background: nc ? "linear-gradient(180deg,rgba(60,16,22,0.55),rgba(8,16,32,0.9))" : "linear-gradient(180deg,rgba(13,24,45,0.9),rgba(8,16,32,0.9))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: celu ? "12px 12px" : "12px 16px", flexWrap: "wrap" }}>
        <span title={c.sem.k === "si" ? "Conviene escribirle" : c.sem.k === "espera" ? "Mejor esperar" : "No escribirle"} style={{ width: 10, height: 10, borderRadius: "50%", background: col, boxShadow: `0 0 0 4px ${col}22`, flexShrink: 0 }} />
        <div style={{ flex: "1 1 240px", minWidth: 0, cursor: "pointer" }} onClick={() => toggle(c)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{nombreDe(c) || c.phone}</span>
            {c.company_name && nombreDe(c) !== c.company_name && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{c.company_name}</span>}
            {c.client_code && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: GOLD_LIGHT }}>{c.client_code}</span>}
            {nc && pill("🚫 No contactar", "#f87171")}
            {!nc && T && pill(T.l, T.c)}
            {esLead(c) && c.source === "ad" && pill("Anuncio", "#6ee7b7")}
            {COND[c.tax_condition] && pill(COND[c.tax_condition], "rgba(255,255,255,0.5)")}
            {imps > 0 && pill(`${admin && n(c.facturado_usd) > 0 ? `USD ${fmtUsd(c.facturado_usd)} · ` : ""}${imps} importaci${imps !== 1 ? "ones" : "ón"}`, "#8CC8F5")}
            {n(c.mar_total) > 0 && pill("marítimo", "#60a5fa")}
            {c.unread > 0 && pill(`${c.unread} sin leer`, "#ef4444")}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: nc ? "#fca5a5" : c.sem.k === "si" ? "#fff" : "rgba(255,255,255,0.7)", lineHeight: 1.45 }}>{principal}</p>
          {!nc && c.siguiente && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: GOLD_LIGHT, lineHeight: 1.4 }}>→ {c.siguiente}</p>}
          {pie && <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.42)", lineHeight: 1.4 }}>{pie}</p>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginLeft: celu ? 22 : 0 }}>
          {nc ? btn("↩ Volver a contactar", () => reactivar(c), { color: "#fff", bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.2)" })
            : <>
              {btn("Mensaje", async () => alertDialog(await mensajeDe(c), { title: `Mensaje para ${apodoDe(c.first_name || c.wa_name || "") || nombreDe(c)}` }), { title: "Ver el WhatsApp que se le mandaría" })}
              {btn(r ? "✕" : "Registrar", () => setReg(r ? null : { clave: c.clave, outcome: "", note: "", next: "" }), { color: r ? "rgba(255,255,255,0.6)" : GOLD_LIGHT, border: r ? "rgba(255,255,255,0.12)" : "rgba(184,149,106,0.45)", bg: r ? "transparent" : "rgba(184,149,106,0.1)" })}
              {btn("WhatsApp", () => abrirWA(c), { color: "#fff", bg: "linear-gradient(135deg,#25D366,#128C7E)", border: "transparent", strong: c.sem.k === "si" })}
              {confNc === c.clave
                ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>{btn("Sí, no contactar más", () => noContactar(c), { color: "#fff", bg: "linear-gradient(135deg,#ef4444,#b91c1c)", border: "transparent" })}{btn("Cancelar", () => setConfNc(null), { color: "rgba(255,255,255,0.6)" })}</span>
                : btn("🚫", () => setConfNc(c.clave), { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.45)", title: "No contactar más" })}
            </>}
          {btn(open ? "▲" : "▼", () => toggle(c), { color: "rgba(255,255,255,0.45)" })}
        </div>
      </div>
      {r && <div style={{ padding: "0 16px 14px", marginLeft: celu ? 0 : 22 }}>
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{OUTCOMES.map(([k, l, color]) => <button key={k} type="button" onClick={() => setReg((p) => ({ ...p, outcome: k }))} style={{ height: 32, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${r.outcome === k ? color : "rgba(255,255,255,0.12)"}`, background: r.outcome === k ? `${color}22` : "transparent", color: r.outcome === k ? color : "rgba(255,255,255,0.7)" }}>{l}</button>)}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            <input value={r.note} onChange={(e) => setReg((p) => ({ ...p, note: e.target.value }))} placeholder="Nota (qué te dijo, qué quedó pendiente)…" style={{ flex: "1 1 240px", height: 36, padding: "0 12px", fontSize: 13, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, background: "rgba(0,0,0,0.22)", color: "#fff", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            <div style={{ flex: "0 0 170px" }}><DatePicker value={r.next || ""} onChange={(v) => setReg((p) => ({ ...p, next: v }))} placeholder="Volver a escribir el…" small /></div>
            {btn("Guardar", () => guardarReg(c), { color: "#0A1628", bg: GOLD_GRADIENT, border: "transparent" })}
          </div>
        </div>
      </div>}
      {open && <div style={{ padding: "0 16px 14px", marginLeft: celu ? 0 : 22, display: "grid", gridTemplateColumns: celu ? "1fr" : "1fr 1fr", gap: 10 }}>
        {!nc && <div style={{ ...caja, gridColumn: celu ? "auto" : "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Análisis{c.analizado_at && c.lectura ? ` · ${diasTxt(dias(c.analizado_at))}` : ""}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {c.contact_id && c.last_msg_at && ir && btn("Abrir el chat", () => ir("chats", { id: c.contact_id }))}
              {btn(analizando === c.clave ? "Analizando…" : c.lectura ? "Analizar de nuevo" : "Analizar", () => analizar(c), { disabled: analizando === c.clave })}
            </div>
          </div>
          {c.lectura ? <>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.88)", lineHeight: 1.55 }}>{c.lectura}</p>
            {c.siguiente && <p style={{ margin: "5px 0 0", fontSize: 12.5, color: GOLD_LIGHT, lineHeight: 1.45 }}>→ {c.siguiente}</p>}
            {c.mensaje && <p style={{ margin: "9px 0 0", padding: "9px 12px", borderRadius: 10, background: "rgba(37,211,102,0.07)", border: "1px solid rgba(37,211,102,0.2)", fontSize: 12.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.mensaje}</p>}
          </> : <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>{c.analisis_error ? "No se pudo analizar." : "Todavía sin análisis."}</p>}
          {c.summary && <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}><b style={{ color: "rgba(255,255,255,0.75)" }}>Qué hablaron:</b> {c.summary}{c.pending ? ` · ${c.pending}` : ""}</p>}
        </div>}
        <div style={caja}>
          {titulo("Quién es")}
          <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
            {c.whatsapp || c.phone || "sin WhatsApp"}{c.email ? ` · ${c.email}` : ""}<br />
            {esLead(c) ? <>Escribió por primera vez {diasTxt(dias(c.created_at))} · no está registrado</> : <>Registrado {diasTxt(dias(c.created_at))}{c.tax_condition ? ` · ${COND[c.tax_condition] || c.tax_condition}` : ""}</>}<br />
            {!esLead(c) && <>{imps > 0 ? <>{imps} importaci{imps === 1 ? "ón" : "ones"}{n(c.ops_cerradas) > 0 && c.ultima_op_code ? ` · última ${c.ultima_op_code}` : ""}{ultimaImp(c) ? ` entregada ${diasTxt(dias(ultimaImp(c)))}` : ""}{admin && n(c.facturado_usd) > 0 ? ` · facturó USD ${fmtUsd(c.facturado_usd)}` : ""}{n(c.cadencia_dias) >= 7 && imps >= 2 ? ` · cada ~${Math.round(c.cadencia_dias)} días` : ""}</> : "Nunca importó"}<br />
              {n(c.quotes_total) > 0 ? <>{c.quotes_total} cotizaci{n(c.quotes_total) === 1 ? "ón" : "ones"} · última {c.ultima_quote_num} {diasTxt(dias(c.ultima_quote_fecha))} {canalTxt(c.ultima_quote_canal)} por USD {fmtUsd(c.ultima_quote_total)}</> : "Nunca cotizó"}<br /></>}
            {c.last_msg_at ? <>Último chat {diasTxt(dias(c.last_msg_at))}{c.last_preview ? ` · “${String(c.last_preview).slice(0, 70)}”` : ""}</> : "Sin chat guardado"}
            {enCurso(c).length > 0 && <><br /><b style={{ color: "#fbbf24" }}>En curso: {enCurso(c).join(" · ")}</b></>}
          </p>
        </div>
        <div style={caja}>
          {titulo(`Contactos${hist[c.clave] ? ` · ${hist[c.clave].length}` : ""}`)}
          {!hist[c.clave] ? <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Cargando…</p>
            : hist[c.clave].length === 0 ? <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{c.last_followup_at ? `Contactado ${diasTxt(dias(c.last_followup_at))} (antes del historial).` : "Nunca se lo contactó."}</p>
              : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{hist[c.clave].slice(0, 8).map((h) => <div key={h.id} style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.45 }}><span style={{ color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>{new Date(h.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span> · {h.channel === "whatsapp" ? "WhatsApp" : h.channel === "email" ? "Email" : h.channel === "llamada" ? "Llamada" : "Nota"} · <b style={{ color: h.outcome === "no_contactar" ? "#f87171" : "inherit" }}>{OUT_LBL[h.outcome] || h.outcome || ""}</b>{h.note ? ` · ${h.note}` : ""}{h.next_at ? ` · volver el ${fechaDM(h.next_at)}` : ""}</div>)}</div>}
        </div>
      </div>}
    </div>;
  };


  return <div>
    <div style={{ display: "grid", gridTemplateColumns: celu ? "1fr 1fr" : "repeat(5,minmax(0,1fr))", gap: 4, padding: 5, marginBottom: 12, borderRadius: 18, background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {SEGS.map((o, i) => { const on = seg === o.k; const nn = cuenta(o.k); return <button key={o.k} type="button" onClick={() => setSeg(o.k)} style={{ gridColumn: celu && i === SEGS.length - 1 ? "1 / -1" : "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: celu ? "10px 4px" : "11px 8px", borderRadius: 14, border: "none", background: on ? `linear-gradient(180deg,${o.c}33,${o.c}14)` : "transparent", boxShadow: on ? `inset 0 0 0 1.5px ${o.c}88, 0 6px 22px ${o.c}26` : "none", color: on ? "#fff" : "rgba(255,255,255,0.55)", cursor: "pointer", fontFamily: "inherit", transition: "all 160ms" }}>
        <span style={{ fontSize: celu ? 12 : 12.5, fontWeight: 800, letterSpacing: "-0.01em", textAlign: "center", lineHeight: 1.25 }}>{o.l}</span>
        <span style={{ minWidth: 24, height: 20, padding: "0 7px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800, fontVariantNumeric: "tabular-nums", background: on ? o.c : "rgba(255,255,255,0.08)", color: on ? "#0A1628" : "rgba(255,255,255,0.6)" }}>{lo ? "…" : nn}</span>
      </button>; })}
    </div>
    {partido && !lo && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0 2px 12px", fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>
      <span>{verEsperan ? `${lista.length} en espera` : `${lista.length} para escribir hoy`}</span>
      {(verEsperan || nEsperan > 0) && <button type="button" onClick={() => setVerEsperan((v) => !v)} style={{ background: "transparent", border: "none", padding: 0, color: GOLD_LIGHT, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{verEsperan ? "← Volver a los de hoy" : `Ver los ${nEsperan} en espera`}</button>}
    </div>}
    {err && <div style={{ padding: "12px 16px", marginBottom: 14, borderRadius: 10, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", fontSize: 13 }}>{err}</div>}

    {lo ? <SkeletonTable rows={8} cols={3} /> : visibles.length === 0
      ? <EmptyState icon="users" title="Nada por acá" description={partido && !verEsperan ? "No queda nadie para escribir hoy en este grupo." : "No hay nadie en este grupo."} />
      : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{visibles.map(fila)}</div>}

    {paginas > 1 && <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 18 }}>
      {btn("← Anterior", () => { setPag((p) => Math.max(0, p - 1)); window.scrollTo(0, 0); }, { color: pag > 0 ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.25)" })}
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums" }}>Página {pag + 1} de {paginas} · {lista.length} personas</span>
      {btn("Siguiente →", () => { setPag((p) => Math.min(paginas - 1, p + 1)); window.scrollTo(0, 0); }, { color: pag < paginas - 1 ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.25)" })}
    </div>}
  </div>;
}

// Capa de afuera: arma el flash (texto verde arriba + toast).
export function SeguimientoPanel({ token, rol, ir }) {
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2500); const v = /^[❌✕]|falló|error/i.test(m) ? "error" : /^⚠/.test(m) ? "warn" : "success"; toast(m.replace(/^[✓✉️❌⚠️✕★📧⭐]\s*/u, ""), v); };
  return <>
    {msg && <p style={{ fontSize: 12, color: "#22c55e", fontWeight: 600, marginBottom: 12 }}>{msg}</p>}
    <SeguimientoPanelBase token={token} flash={flash} ir={ir} admin={rol === "admin"} />
  </>;
}
