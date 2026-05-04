"use client";
// Portal cliente: lista de tickets propios + crear nuevo. Usa i18n.
import { useEffect, useState } from "react";
import { useT } from "../../../lib/i18n-portal";

const GOLD = "#B8956A", GOLD_LIGHT = "#E8D098";
const STATUS_COLORS = { open: "#60a5fa", in_progress: "#fbbf24", waiting_client: "#a78bfa", resolved: "#22c55e", closed: "#94a3b8" };
const STATUS_LABELS_ES = { open: "Abierto", in_progress: "En curso", waiting_client: "Esperando tu respuesta", resolved: "Resuelto", closed: "Cerrado" };

const fmtDate = d => d ? new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function SupportPage({ token, client }) {
  const { t } = useT();
  const [tickets, setTickets] = useState([]);
  const [lo, setLo] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [sel, setSel] = useState(null);

  const load = async () => {
    if (!client?.id) { setLo(false); return; }
    setLo(true);
    const r = await fetch(`/api/tickets?clientId=${client.id}`);
    const j = await r.json();
    setTickets(j.tickets || []);
    setLo(false);
  };
  useEffect(() => { load(); }, [client?.id]);

  if (sel) return <TicketView id={sel} client={client} onBack={() => { setSel(null); load(); }} />;
  if (showNew) return <NewTicket client={client} onCancel={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />;

  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
      <div>
        <h2 style={{ color: "#fff", fontSize: 24, margin: "0 0 4px", fontWeight: 700 }}>{t("support.title")}</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 }}>Centro de ayuda y reclamos.</p>
      </div>
      <button onClick={() => setShowNew(true)} style={{ padding: "10px 20px", background: GOLD, color: "#0A1628", border: "none", borderRadius: 8, fontWeight: 800, cursor: "pointer", fontSize: 13 }}>+ {t("support.new")}</button>
    </div>

    <div style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 22 }}>
      {lo ? <p style={{ color: "rgba(255,255,255,0.4)" }}>{t("common.loading")}</p>
        : tickets.length === 0 ? <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "2rem 0" }}>{t("support.empty")}</p>
          : tickets.map(tk => <div key={tk.id} onClick={() => setSel(tk.id)} style={{ padding: "14px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ background: STATUS_COLORS[tk.status] + "20", color: STATUS_COLORS[tk.status], fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 999, textTransform: "uppercase", border: `1px solid ${STATUS_COLORS[tk.status]}40` }}>{STATUS_LABELS_ES[tk.status]}</span>
              </div>
              <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{tk.subject}</div>
            </div>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{fmtDate(tk.updated_at)}</span>
          </div>)}
    </div>
  </div>;
}

function NewTicket({ client, onCancel, onCreated }) {
  const { t } = useT();
  const [form, setForm] = useState({ subject: "", description: "", category: "general", priority: "normal" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!form.subject.trim() || !form.description.trim()) { setErr("Completá asunto y descripción"); return; }
    setSaving(true); setErr("");
    const r = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, client_id: client?.id, created_by_type: "client" }) });
    const j = await r.json();
    setSaving(false);
    if (!j.ok) { setErr(j.error || "Error"); return; }
    onCreated();
  };
  return <div>
    <button onClick={onCancel} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "6px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 16, fontSize: 12 }}>← {t("common.cancel")}</button>
    <h2 style={{ color: "#fff", fontSize: 22, margin: "0 0 22px" }}>{t("support.new")}</h2>
    <div style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 22 }}>
      <Field label={t("support.subject")}>
        <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} maxLength={200} style={inp} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label={t("support.category")}>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
            <option value="general">General</option>
            <option value="operacion">Operación</option>
            <option value="pago">Pago</option>
            <option value="tracking">Tracking</option>
            <option value="reclamo">Reclamo</option>
            <option value="sugerencia">Sugerencia</option>
            <option value="tecnico">Técnico</option>
          </select>
        </Field>
        <Field label={t("support.priority")}>
          <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inp}>
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </Field>
      </div>
      <Field label={t("support.description")}>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={6} maxLength={5000} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
      </Field>
      {err && <p style={{ color: "#ef4444", fontSize: 12, margin: "0 0 12px" }}>{err}</p>}
      <button onClick={submit} disabled={saving} style={{ padding: "10px 24px", background: GOLD, color: "#0A1628", border: "none", borderRadius: 8, fontWeight: 800, cursor: "pointer" }}>{saving ? t("common.loading") : t("common.send")}</button>
    </div>
  </div>;
}

function TicketView({ id, client, onBack }) {
  const { t } = useT();
  const [data, setData] = useState(null);
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const load = async () => {
    const r = await fetch(`/api/tickets/${id}`);
    setData(await r.json());
  };
  useEffect(() => { load(); }, [id]);
  const send = async () => {
    if (!reply.trim()) return;
    setSaving(true);
    await fetch(`/api/tickets/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: reply, author_type: "client", author_id: client?.id }) });
    setReply(""); setSaving(false); load();
  };
  if (!data?.ok) return <p style={{ color: "rgba(255,255,255,0.5)" }}>{t("common.loading")}</p>;
  const tk = data.ticket;
  const visibleComments = (data.comments || []).filter(c => !c.is_internal);
  return <div>
    <button onClick={onBack} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", padding: "6px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 16, fontSize: 12 }}>← Volver</button>
    <div style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 22, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <span style={{ background: STATUS_COLORS[tk.status] + "20", color: STATUS_COLORS[tk.status], fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 999, textTransform: "uppercase" }}>{STATUS_LABELS_ES[tk.status]}</span>
      </div>
      <h2 style={{ color: "#fff", fontSize: 20, margin: "0 0 14px" }}>{tk.subject}</h2>
      <div style={{ background: "rgba(0,0,0,0.2)", padding: 14, borderRadius: 8, color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{tk.description}</div>
    </div>
    <div style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 22 }}>
      {visibleComments.map(c => <div key={c.id} style={{ marginBottom: 12, padding: 12, background: c.author_type === "admin" ? "rgba(184,149,106,0.06)" : "rgba(96,165,250,0.06)", borderRadius: 8, borderLeft: `3px solid ${c.author_type === "admin" ? GOLD : "#60a5fa"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: c.author_type === "admin" ? GOLD_LIGHT : "#60a5fa", textTransform: "uppercase" }}>{c.author_type === "admin" ? "Argencargo" : "Vos"}</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{fmtDate(c.created_at)}</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{c.body}</div>
      </div>)}
      {tk.status !== "closed" && <div style={{ marginTop: 14 }}>
        <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Responder..." rows={3} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
        <button onClick={send} disabled={!reply.trim() || saving} style={{ padding: "8px 22px", background: GOLD, color: "#0A1628", border: "none", borderRadius: 8, fontWeight: 800, cursor: reply.trim() ? "pointer" : "not-allowed", opacity: reply.trim() ? 1 : 0.4, marginTop: 10 }}>{saving ? t("common.loading") : t("common.send")}</button>
      </div>}
    </div>
  </div>;
}

const inp = { width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 };
const Field = ({ label, children }) => <div style={{ marginBottom: 4 }}>
  <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 6 }}>{label}</label>
  {children}
</div>;
