"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8956A", GOLD_LIGHT = "#E8D098";
const STATUS_COLORS = { open: "#60a5fa", in_progress: "#fbbf24", waiting_client: "#a78bfa", resolved: "#22c55e", closed: "#94a3b8" };
const STATUS_LABELS = { open: "Abierto", in_progress: "En curso", waiting_client: "Esperando cliente", resolved: "Resuelto", closed: "Cerrado" };
const PRIORITY_COLORS = { low: "#94a3b8", normal: "#60a5fa", high: "#fbbf24", urgent: "#ef4444" };
const CATEGORY_LABELS = { general: "General", operacion: "Operación", pago: "Pago", tracking: "Tracking", reclamo: "Reclamo", sugerencia: "Sugerencia", tecnico: "Técnico" };

const Card = ({ title, children, actions }) => (
  <div style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 22, marginBottom: 16 }}>
    {title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 13, color: GOLD_LIGHT, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>{title}</h3>{actions}</div>}
    {children}
  </div>
);
const fmtDate = d => d ? new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function TicketsPanel({ token, allClients = [] }) {
  const [tickets, setTickets] = useState([]);
  const [lo, setLo] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(null);

  const load = async () => {
    setLo(true);
    const qs = filter === "all" ? "" : `?status=${filter}`;
    const r = await fetch(`/api/tickets${qs}`);
    const j = await r.json();
    setTickets(j.tickets || []);
    setLo(false);
  };
  useEffect(() => { load(); }, [filter]);

  if (sel) return <TicketDetail id={sel} onBack={() => { setSel(null); load(); }} />;

  const counts = { all: tickets.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
  for (const t of tickets) counts[t.status] = (counts[t.status] || 0) + 1;

  return <div>
    <h2 style={{ color: "#fff", fontSize: 26, margin: "0 0 6px", fontWeight: 700 }}>🎫 Tickets / Soporte</h2>
    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, margin: "0 0 22px" }}>Sistema de tickets e incidentes. Los clientes abren tickets desde el portal y vos los gestionás acá.</p>

    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {["all", "open", "in_progress", "waiting_client", "resolved", "closed"].map(f => <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", fontSize: 11, fontWeight: 700, borderRadius: 8, border: filter === f ? `1.5px solid ${GOLD}` : "1.5px solid rgba(255,255,255,0.08)", background: filter === f ? "rgba(184,149,106,0.12)" : "rgba(255,255,255,0.028)", color: filter === f ? GOLD_LIGHT : "rgba(255,255,255,0.5)", cursor: "pointer" }}>{f === "all" ? `Todos (${counts.all})` : `${STATUS_LABELS[f]}${counts[f] ? ` (${counts[f]})` : ""}`}</button>)}
    </div>

    <Card>
      {lo ? <p style={{ color: "rgba(255,255,255,0.4)" }}>Cargando…</p>
        : tickets.length === 0 ? <p style={{ color: "rgba(255,255,255,0.4)" }}>Sin tickets.</p>
          : tickets.map(t => <div key={t.id} onClick={() => setSel(t.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(184,149,106,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ background: STATUS_COLORS[t.status] + "20", color: STATUS_COLORS[t.status], fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.06em", border: `1px solid ${STATUS_COLORS[t.status]}40` }}>{STATUS_LABELS[t.status]}</span>
                <span style={{ background: PRIORITY_COLORS[t.priority] + "20", color: PRIORITY_COLORS[t.priority], fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 999, textTransform: "uppercase", border: `1px solid ${PRIORITY_COLORS[t.priority]}40` }}>{t.priority}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{CATEGORY_LABELS[t.category] || t.category}</span>
              </div>
              <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{t.subject}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
                {t.clients ? `${t.clients.client_code} · ${t.clients.first_name} ${t.clients.last_name}` : "—"}
                {t.operations ? ` · op ${t.operations.operation_code}` : ""}
              </div>
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textAlign: "right", marginLeft: 12 }}>{fmtDate(t.updated_at)}</div>
          </div>)}
    </Card>
  </div>;
}

function TicketDetail({ id, onBack }) {
  const [data, setData] = useState(null);
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await fetch(`/api/tickets/${id}`);
    const j = await r.json();
    setData(j);
  };
  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status) => {
    await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };
  const updatePriority = async (priority) => {
    await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority }) });
    load();
  };
  const addComment = async () => {
    if (!comment.trim()) return;
    setSaving(true);
    await fetch(`/api/tickets/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: comment, author_type: "admin", is_internal: internal }) });
    setComment(""); setInternal(false); setSaving(false);
    load();
  };

  if (!data?.ok) return <p style={{ color: "rgba(255,255,255,0.5)" }}>Cargando…</p>;
  const t = data.ticket;
  return <div>
    <button onClick={onBack} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "6px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 16, fontSize: 12 }}>← Volver</button>
    <Card title={t.subject} actions={<div style={{ display: "flex", gap: 6 }}>
      <select value={t.status} onChange={e => updateStatus(e.target.value)} style={{ padding: "6px 10px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 6, fontSize: 11 }}>
        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select value={t.priority} onChange={e => updatePriority(e.target.value)} style={{ padding: "6px 10px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 6, fontSize: 11 }}>
        {["low", "normal", "high", "urgent"].map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>}>
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 14, flexWrap: "wrap" }}>
        <span><strong style={{ color: GOLD_LIGHT }}>Cliente:</strong> {t.clients ? `${t.clients.client_code} · ${t.clients.first_name} ${t.clients.last_name}` : "—"}</span>
        {t.operations && <span><strong style={{ color: GOLD_LIGHT }}>Op:</strong> {t.operations.operation_code}</span>}
        <span><strong style={{ color: GOLD_LIGHT }}>Categoría:</strong> {CATEGORY_LABELS[t.category]}</span>
        <span><strong style={{ color: GOLD_LIGHT }}>Creado:</strong> {fmtDate(t.created_at)}</span>
      </div>
      <div style={{ background: "rgba(0,0,0,0.2)", padding: 14, borderRadius: 8, color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{t.description}</div>
    </Card>

    <Card title={`Conversación (${data.comments.length})`}>
      {data.comments.length === 0 && <p style={{ color: "rgba(255,255,255,0.4)", margin: "0 0 14px" }}>Sin comentarios todavía.</p>}
      {data.comments.map(c => <div key={c.id} style={{ marginBottom: 12, padding: 12, background: c.author_type === "admin" ? (c.is_internal ? "rgba(251,191,36,0.08)" : "rgba(184,149,106,0.06)") : "rgba(96,165,250,0.06)", borderRadius: 8, borderLeft: `3px solid ${c.author_type === "admin" ? GOLD : "#60a5fa"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: c.author_type === "admin" ? GOLD_LIGHT : "#60a5fa", textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.author_type}{c.is_internal ? " · NOTA INTERNA" : ""}</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{fmtDate(c.created_at)}</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{c.body}</div>
      </div>)}

      <div style={{ marginTop: 16 }}>
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Escribir respuesta..." rows={4} style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: 12, borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
            <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} /> Nota interna (no visible al cliente)
          </label>
          <button onClick={addComment} disabled={!comment.trim() || saving} style={{ padding: "8px 22px", background: GOLD, color: "#0A1628", border: "none", borderRadius: 8, fontWeight: 800, cursor: comment.trim() ? "pointer" : "not-allowed", opacity: comment.trim() ? 1 : 0.4 }}>{saving ? "Enviando…" : "Responder"}</button>
        </div>
      </div>
    </Card>
  </div>;
}
