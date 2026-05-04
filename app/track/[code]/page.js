// Página pública de seguimiento. URL: /track/AC-XXXX
// Compartible sin login. Muestra status, ETA, timeline.
// Sin info sensible (cliente, monto, items).

"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const NAVY = "#0A1628";
const GOLD = "#B8956A";
const GOLD_LIGHT = "#D4B17A";
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const LOGO = `${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;

const STATUS_INFO = {
  pendiente: { label: "Pendiente", color: "#94a3b8", icon: "📋" },
  en_deposito_origen: { label: "En depósito de origen", color: "#60a5fa", icon: "📦" },
  en_preparacion: { label: "En preparación", color: "#a78bfa", icon: "🔧" },
  en_transito: { label: "En tránsito internacional", color: "#fbbf24", icon: "✈️" },
  arribo_argentina: { label: "Arribó a Argentina", color: "#22c55e", icon: "🇦🇷" },
  en_aduana: { label: "En aduana", color: "#f97316", icon: "🛂" },
  entregada: { label: "Lista para retirar / Entregada", color: "#22c55e", icon: "✅" },
  operacion_cerrada: { label: "Operación cerrada", color: "#22c55e", icon: "✓" },
  cancelada: { label: "Cancelada", color: "#ef4444", icon: "✕" },
};

const CHANNEL_LABELS = {
  aereo_blanco: "Aéreo Courier Comercial",
  aereo_negro: "Aéreo Integral AC",
  maritimo_blanco: "Marítimo Carga LCL/FCL",
  maritimo_negro: "Marítimo Integral AC",
};

const formatDate = (d, withTime = true) => {
  if (!d) return null;
  const date = new Date(typeof d === "string" && d.length === 10 ? d + "T12:00:00" : d);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
};

export default function PublicTrackPage() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/track/${code}`);
        const j = await r.json();
        if (j.ok) setData(j);
        else setError(j.error || "No encontrado");
      } catch (e) {
        setError("Error de conexión");
      }
      setLoading(false);
    })();
  }, [code]);

  const bg = `linear-gradient(160deg, #0A1628 0%, #142038 50%, #0A1628 100%)`;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontFamily: "'Inter',sans-serif" }}>
      Cargando seguimiento…
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", fontFamily: "'Inter',sans-serif" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 16, padding: "2rem 2.5rem", textAlign: "center", maxWidth: 480 }}>
        <p style={{ fontSize: 48, margin: "0 0 12px" }}>🔍</p>
        <h1 style={{ fontSize: 22, color: "#fff", margin: "0 0 10px", fontWeight: 700 }}>Operación no encontrada</h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "0 0 20px" }}>El código <strong style={{ color: GOLD_LIGHT, fontFamily: "monospace" }}>{code}</strong> no existe o todavía no fue creado.</p>
        <a href="https://argencargo.com.ar" style={{ color: GOLD_LIGHT, fontSize: 13, textDecoration: "none", fontWeight: 600 }}>← Ir al sitio principal</a>
      </div>
    </div>
  );

  const st = STATUS_INFO[data.status] || { label: data.status, color: "#999", icon: "•" };
  const isAereo = (data.channel || "").includes("aereo");
  const isClosed = ["entregada", "operacion_cerrada", "cancelada"].includes(data.status);

  // Timeline visual de status
  const statusOrder = isAereo
    ? ["pendiente", "en_deposito_origen", "en_preparacion", "en_transito", "arribo_argentina", "en_aduana", "entregada"]
    : ["pendiente", "en_deposito_origen", "en_preparacion", "en_transito", "arribo_argentina", "en_aduana", "entregada"];
  const currentIdx = statusOrder.indexOf(data.status);

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif", color: "#fff", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header con logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <a href="https://argencargo.com.ar" style={{ display: "block" }}>
            <img src={LOGO} alt="Argencargo" style={{ height: 36 }} />
          </a>
          <a href="https://argencargo.com.ar/portal" style={{ fontSize: 12, color: GOLD_LIGHT, textDecoration: "none", padding: "6px 12px", border: `1px solid ${GOLD}55`, borderRadius: 7, fontWeight: 600 }}>
            Portal cliente →
          </a>
        </div>

        {/* Card principal */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "28px 28px 24px", marginBottom: 18, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT}, ${GOLD})` }} />

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Seguimiento</span>
            <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.2)" }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'JetBrains Mono','SF Mono',monospace", letterSpacing: "0.04em" }}>{data.operation_code}</span>
          </div>

          {data.description && <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 18px", letterSpacing: "-0.01em" }}>{data.description}</h1>}

          {/* Estado actual destacado */}
          <div style={{ padding: "16px 20px", background: `linear-gradient(135deg, ${st.color}22, ${st.color}08)`, border: `1.5px solid ${st.color}55`, borderRadius: 12, display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <span style={{ fontSize: 28 }}>{st.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", margin: 0, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700 }}>Estado actual</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: st.color, margin: "2px 0 0" }}>{st.label}</p>
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14 }}>
            {data.channel && <div><p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase" }}>Canal</p><p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: "3px 0 0" }}>{CHANNEL_LABELS[data.channel] || data.channel}</p></div>}
            {data.origin && <div><p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase" }}>Origen</p><p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: "3px 0 0" }}>{data.origin}</p></div>}
            {data.eta && !isClosed && <div><p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase" }}>ETA</p><p style={{ fontSize: 13, fontWeight: 600, color: GOLD_LIGHT, margin: "3px 0 0" }}>{formatDate(data.eta, false)}</p></div>}
            {data.delivered_at && <div><p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase" }}>Entregada</p><p style={{ fontSize: 13, fontWeight: 600, color: "#22c55e", margin: "3px 0 0" }}>{formatDate(data.delivered_at, false)}</p></div>}
            {data.international_carrier && <div><p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase" }}>Carrier</p><p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: "3px 0 0" }}>{data.international_carrier}</p></div>}
            {data.international_tracking && <div><p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase" }}>Tracking</p><p style={{ fontSize: 12, fontWeight: 600, color: "#fff", margin: "3px 0 0", fontFamily: "monospace" }}>{data.international_tracking}</p></div>}
          </div>
        </div>

        {/* Timeline de eventos */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "24px 28px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: GOLD_LIGHT, margin: "0 0 18px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Línea de tiempo</h2>

          {data.events.length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0, fontStyle: "italic" }}>Sin eventos de seguimiento registrados todavía.</p>
          ) : (
            <div style={{ paddingLeft: 18, borderLeft: `2px solid rgba(184,149,106,0.2)`, display: "flex", flexDirection: "column", gap: 18 }}>
              {data.events.map((ev, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: -25, top: 6, width: 10, height: 10, borderRadius: "50%", background: i === 0 ? GOLD : "rgba(255,255,255,0.15)", boxShadow: i === 0 ? `0 0 0 4px rgba(184,149,106,0.2)` : "none" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: i === 0 ? "#fff" : "rgba(255,255,255,0.6)", margin: 0 }}>{ev.title}</p>
                    <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", margin: 0, whiteSpace: "nowrap" }}>{formatDate(ev.occurred_at)}</p>
                  </div>
                  {ev.location && <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", margin: "3px 0 0" }}>📍 {ev.location}</p>}
                  {ev.description && ev.description !== ev.title && <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", margin: "3px 0 0", fontStyle: "italic" }}>{ev.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 28, padding: "20px 24px", background: "rgba(0,0,0,0.25)", borderRadius: 14, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "0 0 6px" }}>
            ¿Sos el dueño de esta operación?
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: "0 0 10px" }}>
            Iniciá sesión en el portal para ver el detalle completo, descargar comprobantes y gestionar tu importación.
          </p>
          <a href="https://argencargo.com.ar/portal" style={{ display: "inline-block", padding: "9px 20px", background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: NAVY, fontSize: 12, fontWeight: 700, textDecoration: "none", borderRadius: 8, letterSpacing: "0.04em" }}>
            Ir al Portal Cliente
          </a>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "16px 0 0" }}>
            Argencargo · Importaciones desde China, USA y España · <a href="https://argencargo.com.ar" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>argencargo.com.ar</a>
          </p>
        </div>

      </div>
    </div>
  );
}
