"use client";
// Panel de inteligencia: combina #10 importaciones similares + #11 predicción + #13 tendencias
import { useEffect, useState } from "react";

const GOLD = "#B8956A", GOLD_LIGHT = "#E8D098";
const Card = ({ title, children, actions }) => (
  <div style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 22, marginBottom: 16 }}>
    {title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 13, color: GOLD_LIGHT, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>{title}</h3>
      {actions}
    </div>}
    {children}
  </div>
);
const fmt$ = n => `USD ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function IntelligencePanel({ token, allClients = [] }) {
  const [mode, setMode] = useState("client"); // client | trends
  const [clientId, setClientId] = useState("");
  const [months, setMonths] = useState(6);
  const [data, setData] = useState(null);
  const [lo, setLo] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setLo(true); setErr(""); setData(null);
    try {
      const qs = mode === "client" ? `mode=client&clientId=${clientId}` : `mode=trends&months=${months}`;
      const r = await fetch(`/api/admin/intelligence?${qs}`);
      const j = await r.json();
      if (!j.ok) { setErr(j.error || "Error"); setLo(false); return; }
      setData(j);
    } catch (e) { setErr(e.message || "Error de red"); }
    setLo(false);
  };

  useEffect(() => { if (mode === "trends") load(); }, [mode, months]);

  return <div>
    <h2 style={{ color: "#fff", fontSize: 26, margin: "0 0 6px", fontWeight: 700 }}>🧠 Inteligencia</h2>
    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, margin: "0 0 22px" }}>Análisis 360 de cliente + tendencias globales de mercadería + predicción de próxima importación.</p>

    <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
      {[{ k: "client", l: "Por cliente" }, { k: "trends", l: "Tendencias globales" }].map(m =>
        <button key={m.k} onClick={() => { setMode(m.k); setData(null); }} style={{ padding: "8px 18px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: mode === m.k ? `1.5px solid ${GOLD}` : "1.5px solid rgba(255,255,255,0.08)", background: mode === m.k ? "rgba(184,149,106,0.12)" : "rgba(255,255,255,0.028)", color: mode === m.k ? GOLD_LIGHT : "rgba(255,255,255,0.45)", cursor: "pointer" }}>{m.l}</button>
      )}
    </div>

    {mode === "client" && <Card title="Seleccionar cliente">
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ flex: 1, padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", borderRadius: 8, fontSize: 13 }}>
          <option value="">— Elegir cliente —</option>
          {allClients.map(c => <option key={c.id} value={c.id}>{c.client_code} — {c.first_name} {c.last_name}</option>)}
        </select>
        <button onClick={load} disabled={!clientId || lo} style={{ padding: "10px 22px", background: GOLD, color: "#0A1628", border: "none", borderRadius: 8, fontWeight: 800, cursor: clientId ? "pointer" : "not-allowed", opacity: clientId ? 1 : 0.5 }}>{lo ? "Analizando…" : "Analizar"}</button>
      </div>
    </Card>}

    {mode === "trends" && <Card title="Período" actions={<select value={months} onChange={e => setMonths(Number(e.target.value))} style={{ padding: "6px 10px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", borderRadius: 6, fontSize: 12 }}>
      {[1, 3, 6, 12, 24].map(m => <option key={m} value={m}>Últimos {m} meses</option>)}
    </select>}>
      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, margin: 0 }}>Top NCMs, canales, orígenes y evolución mensual de toda la operación.</p>
    </Card>}

    {err && <Card><p style={{ color: "#ef4444", margin: 0 }}>{err}</p></Card>}
    {lo && <Card><p style={{ color: "rgba(255,255,255,0.5)", margin: 0 }}>Cargando análisis…</p></Card>}

    {data && mode === "client" && <ClientReport data={data} />}
    {data && mode === "trends" && <TrendsReport data={data} />}
  </div>;
}

function ClientReport({ data }) {
  const { client, stats, prediction, similar_imports, preferences, narrative, operations } = data;
  return <>
    <Card title={`${client.client_code} — ${client.first_name} ${client.last_name}`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          ["Ops totales", stats.ops_total],
          ["Ops cerradas", stats.ops_closed],
          ["Ticket promedio", fmt$(stats.avg_ticket_usd)],
          ["Días desde última", stats.days_since_last_op ?? "—"],
        ].map(([l, v], i) => <div key={i} style={{ background: "rgba(0,0,0,0.2)", padding: 14, borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 6 }}>{l}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{v}</div>
        </div>)}
      </div>
    </Card>

    {prediction && <Card title="Predicción próxima importación">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>FECHA ESTIMADA</div><div style={{ fontSize: 18, fontWeight: 800, color: GOLD_LIGHT }}>{fmtDate(prediction.next_estimated_date)}</div></div>
        <div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>CADENCIA MEDIANA</div><div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{prediction.median_interval_days} días</div></div>
        <div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>PROMEDIO</div><div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{prediction.avg_interval_days} días</div></div>
        <div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>CONFIANZA</div><div style={{ fontSize: 18, fontWeight: 800, color: prediction.confidence === "alta" ? "#22c55e" : prediction.confidence === "media" ? "#fbbf24" : "#94a3b8" }}>{prediction.confidence.toUpperCase()}</div></div>
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "12px 0 0", fontStyle: "italic" }}>Basado en {prediction.sample_size} operaciones históricas.</p>
    </Card>}

    {narrative && <Card title="🧠 Resumen IA"><div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{narrative}</div></Card>}

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Productos repetidos">
        {similar_imports.top_items.length === 0 && <p style={{ color: "rgba(255,255,255,0.4)" }}>Sin productos.</p>}
        {similar_imports.top_items.map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
          <span style={{ color: "#fff", flex: 1 }}>{it.description}</span>
          <span style={{ color: GOLD_LIGHT, fontWeight: 700, marginLeft: 12 }}>{it.count}× · {fmt$(it.total_fob)}</span>
        </div>)}
      </Card>
      <Card title="NCMs más frecuentes">
        {similar_imports.top_ncm.length === 0 && <p style={{ color: "rgba(255,255,255,0.4)" }}>Sin clasificaciones.</p>}
        {similar_imports.top_ncm.map((n, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
          <span style={{ color: "#fff", fontFamily: "'SF Mono',monospace" }}>{n.key}</span>
          <span style={{ color: GOLD_LIGHT, fontWeight: 700 }}>{n.count} ops</span>
        </div>)}
      </Card>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Canales preferidos">
        {preferences.by_channel.map((c, i) => <Bar key={i} label={c.key} value={c.count} max={preferences.by_channel[0]?.count || 1} />)}
      </Card>
      <Card title="Orígenes">
        {preferences.by_origin.map((c, i) => <Bar key={i} label={c.key} value={c.count} max={preferences.by_origin[0]?.count || 1} />)}
      </Card>
    </div>

    <Card title={`Últimas ${operations.length} operaciones`}>
      {operations.map(o => <div key={o.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
        <span style={{ color: "#fff", fontFamily: "'SF Mono',monospace" }}>{o.operation_code}</span>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>{o.channel} · {o.origin}</span>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>{fmtDate(o.created_at)}</span>
        <span style={{ color: GOLD_LIGHT, fontWeight: 700 }}>{fmt$(o.budget_total)}</span>
      </div>)}
    </Card>
  </>;
}

function TrendsReport({ data }) {
  return <>
    <Card title={`Resumen últimos ${data.period_months} meses`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>OPERACIONES</div><div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{data.total_ops}</div></div>
        <div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>ITEMS DECLARADOS</div><div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{data.total_items}</div></div>
        <div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>FOB TOTAL</div><div style={{ fontSize: 22, fontWeight: 800, color: GOLD_LIGHT }}>{fmt$(data.total_fob_usd)}</div></div>
      </div>
    </Card>

    <Card title="Top mercadería por FOB">
      {data.top_ncm.map((n, i) => <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "#fff", fontFamily: "'SF Mono',monospace", fontSize: 12 }}>{n.ncm}</span>
          <span style={{ color: GOLD_LIGHT, fontWeight: 700, fontSize: 12 }}>{fmt$(n.fob)} · {n.count} items · {n.qty} u.</span>
        </div>
        {n.samples?.length > 0 && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontStyle: "italic" }}>{n.samples.join(" · ")}</div>}
      </div>)}
    </Card>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Por canal">{data.by_channel.map((c, i) => <Bar key={i} label={c.key} value={c.count} max={data.by_channel[0]?.count || 1} />)}</Card>
      <Card title="Por origen">{data.by_origin.map((c, i) => <Bar key={i} label={c.key} value={c.count} max={data.by_origin[0]?.count || 1} />)}</Card>
    </div>

    <Card title="Evolución mensual">
      {data.monthly_trend.map((m, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
        <span style={{ color: "#fff", fontWeight: 700 }}>{m.month}</span>
        <span style={{ color: "rgba(255,255,255,0.6)" }}>{m.ops} operaciones</span>
        <span style={{ color: GOLD_LIGHT, fontWeight: 700 }}>{fmt$(m.budget)}</span>
      </div>)}
    </Card>
  </>;
}

function Bar({ label, value, max }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return <div style={{ marginBottom: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 3 }}>
      <span>{label}</span><span style={{ color: GOLD_LIGHT, fontWeight: 700 }}>{value}</span>
    </div>
    <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }} />
    </div>
  </div>;
}
