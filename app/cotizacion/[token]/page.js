"use client";
import { useState, useEffect, use } from "react";

const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";

const fmtUSD = (n) => "USD " + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtUSD2 = (n) => "USD " + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CHANNEL_LABELS = {
  aereo_negro: { name: "Aéreo Courier Comercial", time: "7 a 10 días hábiles", costKey: "cost_courier_total_usd" },
  aereo_blanco: { name: "Aéreo Integral AC", time: "10 a 15 días hábiles", costKey: "cost_aereo_int_total_usd" },
  maritimo_negro: { name: "Marítimo LCL / FCL", time: "~ 60 días", costKey: "cost_maritimo_lcl_total_usd" },
  maritimo_blanco: { name: "Marítimo Integral AC", time: "~ 60 días", costKey: "cost_maritimo_int_total_usd" },
};

export default function CotizacionPublica({ params }) {
  const { token } = use(params);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState("oficina");
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/cotizacion/${token}`);
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "No se pudo cargar la cotización"); setLoading(false); return; }
        setData(d);
        // Pre-seleccionar canal: si hay producto USA, primer canal B; sino el "Recomendado" (aereo_blanco)
        const someUSA = (d.quote.gi_quote_products || []).some(p => p.origin === "usa");
        const def = someUSA ? "aereo_negro" : "aereo_blanco";
        setSelectedChannel(def);
        setLoading(false);
      } catch (e) {
        setErr("Error de red");
        setLoading(false);
      }
    })();
  }, [token]);

  const accept = async () => {
    if (!selectedChannel) return;
    if (!confirm("¿Confirmar la aceptación de la cotización? Se va a generar tu operación y vas a recibir las instrucciones para el primer pago.")) return;
    setAccepting(true);
    const r = await fetch(`/api/cotizacion/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: selectedChannel, delivery_zone: selectedDelivery }),
    });
    const d = await r.json();
    setAccepting(false);
    if (!r.ok) { alert(d.error || "Error al aceptar"); return; }
    setAccepted(d);
  };

  if (loading) return <div style={pageStyle()}><p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Cargando…</p></div>;
  if (err) return <div style={pageStyle()}><div style={{ maxWidth: 480, padding: 30, background: "rgba(255,255,255,0.04)", borderRadius: 14, textAlign: "center" }}><p style={{ fontSize: 16, fontWeight: 600, color: "#f87171" }}>{err}</p></div></div>;
  if (!data) return null;

  const { quote, rates, settings } = data;
  const products = (quote.gi_quote_products || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  const cn = quote.gi_quote_requests?.clients ? `${quote.gi_quote_requests.clients.first_name || ""} ${quote.gi_quote_requests.clients.last_name || ""}`.trim() : "Cliente";
  const someUSA = products.some(p => p.origin === "usa");

  // Lista de canales disponibles (filtrar por origen)
  const channels = Object.entries(CHANNEL_LABELS)
    .filter(([k]) => !someUSA || k.includes("negro") || k === "maritimo_blanco")
    .map(([key, def]) => ({ key, ...def, total: Number(quote[def.costKey] || 0) }))
    .filter(c => c.total > 0)
    .sort((a, b) => a.total - b.total);

  // Tarifas activas (sin Interior placeholder)
  const activeRates = rates.filter(r => r.cost_usd && r.cost_usd > 0);
  // Reducir tarifas a una entrada por zona (la más cara como representativa, el cálculo real se hace server-side al aceptar)
  const zoneOptions = activeRates.reduce((acc, r) => { if (!acc[r.zone] || Number(r.cost_usd) > Number(acc[r.zone].cost_usd)) acc[r.zone] = r; return acc; }, {});

  const selChannel = channels.find(c => c.key === selectedChannel);
  const channelTotal = selChannel ? selChannel.total : 0;
  const deliveryCost = selectedDelivery === "oficina" ? 0 : (zoneOptions[selectedDelivery]?.cost_usd ? Number(zoneOptions[selectedDelivery].cost_usd) : 0);
  const finalTotal = channelTotal + deliveryCost;

  // Plan de pagos
  const plan = Array.isArray(quote.payment_plan) ? quote.payment_plan : (typeof quote.payment_plan === "string" ? JSON.parse(quote.payment_plan) : []);

  const totalQty = products.reduce((s, p) => s + Number(p.quantity || 0), 0);
  const maxLead = products.reduce((m, p) => Math.max(m, Number(p.lead_time_days || 0)), 0);

  // Si ya fue aceptada
  if (accepted || quote.status === "accepted" || quote.status === "converted") {
    return <AcceptedView quote={quote} accepted={accepted} cn={cn} settings={settings}/>;
  }

  return <div style={pageStyle()}>
    <p style={{ textAlign: "center", fontSize: 10.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 24 }}>Cotización · Argencargo Gestión Integral</p>

    <div style={qdStyle()}>
      {/* Header */}
      <div style={qdHeadStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <img src={LOGO} alt="Argencargo" style={{ height: 46, width: "auto" }}/>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(232,208,152,0.85)", textTransform: "uppercase", marginBottom: 3 }}>Cotización · Gestión Integral</p>
            <p style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 17, fontWeight: 700, color: "#E8D098", letterSpacing: "0.04em", marginBottom: 1 }}>{quote.gi_quote_requests?.request_code || "—"}</p>
            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)" }}>{quote.expires_at ? `Válida hasta ${formatDate(quote.expires_at)}` : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div><p style={qdLblStyle()}>Cliente</p><p style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{cn}</p></div>
          <div><p style={qdLblStyle()}>{totalQty} unidades · {products.length} {products.length === 1 ? "producto" : "productos"}</p></div>
        </div>
        <div style={{ height: 5, background: "linear-gradient(90deg,#B8956A 0%,#E8D098 50%,#B8956A 100%)", position: "absolute", left: 0, right: 0, bottom: 0 }}/>
      </div>

      {/* Body 2-col */}
      <div style={{ padding: "24px 30px 28px", background: "#fafaf7" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 18, alignItems: "start" }}>
          {/* COL IZQUIERDA: productos + servicio */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div style={qdSecCardStyle()}>
              <p style={qdSecTitleStyle()}>Productos</p>
              {products.map((p, i) => {
                const sub = Number(p.unit_cost_usd || 0) * Number(p.quantity || 0);
                return <div key={p.id || i} style={qdProdRowStyle(i === 0)}>
                  <div style={{ width: 46, height: 46, borderRadius: 7, background: "linear-gradient(135deg,#f3eadb,#e7d8b8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, border: "1px solid #d4c5a0" }}>📦</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 1 }}>{p.description}</p>
                    {p.lead_time_days > 0 && <p style={{ fontSize: 10.5, color: "#B8956A", fontWeight: 600, marginTop: 3 }}>⏱ Producción {p.lead_time_days} días</p>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 11, color: "#666", fontFeatureSettings: '"tnum"', marginBottom: 2 }}>{p.quantity} u. × {fmtUSD2(p.unit_cost_usd)}</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#0A1628", fontFeatureSettings: '"tnum"', letterSpacing: "-0.01em" }}>{fmtUSD2(sub)}</p>
                  </div>
                </div>;
              })}
            </div>

            <div style={qdSecCardStyle()}>
              <p style={qdSecTitleStyle()}>Elegí qué servicio preferís</p>
              <p style={{ fontSize: 11, color: "#888", margin: "-4px 0 8px", lineHeight: 1.5 }}>El precio cambia según modo de transporte. Todos incluyen flete internacional, gestión aduanera y entrega final.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {channels.map((c, i) => <SvcRow key={c.key} channel={c} selected={selectedChannel === c.key} onClick={() => setSelectedChannel(c.key)} recommended={i === 0 && channels.length > 1}/>)}
              </div>
            </div>
          </div>

          {/* COL DERECHA: entrega + total + plan + tiempos */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div style={qdSecCardStyle()}>
              <p style={qdSecTitleStyle()}>¿Cómo querés recibirla?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                <DelivRow label="Retiro por oficina" meta={settings ? `${settings.office_address || ""} · ${settings.office_locality || ""} · ${settings.office_hours || ""}` : "Sin costo"} price="Incluido" selected={selectedDelivery === "oficina"} onClick={() => setSelectedDelivery("oficina")}/>
                {Object.values(zoneOptions).map(zone => <DelivRow key={zone.zone} label={`Envío a ${zone.zone}`} meta="Coordinamos día y horario" price={`+ ${fmtUSD(zone.cost_usd)}`} selected={selectedDelivery === zone.zone} onClick={() => setSelectedDelivery(zone.zone)}/>)}
              </div>
            </div>

            <div style={qdTotalBarStyle()}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>Total</p>
                <p style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(10,22,40,0.65)", marginTop: 2 }}>{selChannel?.name || "—"} · {selectedDelivery === "oficina" ? "Retiro por oficina" : `Envío a ${selectedDelivery}`}</p>
              </div>
              <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", fontFeatureSettings: '"tnum"' }}>{fmtUSD(finalTotal)}</p>
            </div>

            {plan.length > 0 && <div style={qdSecCardStyle()}>
              <p style={qdSecTitleStyle()}>Plan de pagos</p>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${plan.length}, 1fr)`, gap: 6 }}>
                {plan.map((stage, i) => <div key={i} style={{ padding: "10px 12px", background: "#fff", border: "1px solid #ebe6db", borderRadius: 9 }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "#B8956A", letterSpacing: "-0.02em", marginBottom: 1 }}>{stage.pct}%</p>
                  <p style={{ fontSize: 10, color: "#777", marginBottom: 5, lineHeight: 1.3 }}>{stage.label}</p>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "#1a1a1a", fontFeatureSettings: '"tnum"', paddingTop: 5, borderTop: "1px solid #f0eadc" }}>{fmtUSD(Math.round(finalTotal * Number(stage.pct) / 100))}</p>
                </div>)}
              </div>
            </div>}

            <div style={qdSecCardStyle()}>
              <p style={qdSecTitleStyle()}>Tiempos estimados</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <TimeStep n="1" name="Producción" meta={maxLead > 0 ? `Hasta ${maxLead} días hábiles` : "Según producto"}/>
                <TimeStep n="2" name="Envío y arribo" meta={selChannel?.time || "—"}/>
                <TimeStep n="3" name="Entrega final" meta={selectedDelivery === "oficina" ? `Retiro · ${settings?.office_locality || "Recoleta CABA"}` : `Envío a ${selectedDelivery}`}/>
              </div>
            </div>

            {settings?.terms_and_conditions && <details style={{ padding: "9px 12px", background: "#fff", border: "1px solid #ebe6db", borderRadius: 9, fontSize: 11, color: "#555" }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, color: "#1a1a1a", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase" }}>Términos y condiciones</summary>
              <div style={{ paddingTop: 8, marginTop: 8, borderTop: "1px solid #ebe6db", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{settings.terms_and_conditions}</div>
            </details>}

            <button onClick={accept} disabled={accepting || !selectedChannel} style={{ width: "100%", padding: "14px 22px", background: accepting ? "#444" : "#0A1628", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: accepting ? "wait" : "pointer", letterSpacing: "0.04em", fontFamily: "inherit" }}>{accepting ? "Procesando…" : "Aceptar y comenzar producción"}</button>
            <p style={{ textAlign: "center", fontSize: 10, color: "#888", marginTop: 6 }}>Al aceptar, recibís un email con instrucciones para el primer pago.</p>
          </div>
        </div>
      </div>

      {/* Footer estilo PDF */}
      <div style={{ background: "#0A1628", color: "#fff", padding: "14px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.08em", marginBottom: 6 }}>ARGENCARGO</p>
          {settings && <>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
              <strong style={{ color: "#E8D098" }}>Tel:</strong> {settings.office_phone || ""} {" "}·{" "} <strong style={{ color: "#E8D098" }}>Email:</strong> info@argencargo.com.ar
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{settings.office_address || ""}{settings.office_locality ? ` — ${settings.office_locality}` : ""}</p>
          </>}
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#E8D098", letterSpacing: "0.04em" }}>argencargo.com.ar</p>
      </div>
    </div>
  </div>;
}

function SvcRow({ channel, selected, onClick, recommended }) {
  return <label onClick={onClick} style={{ cursor: "pointer", display: "block", borderRadius: 9, border: `1.5px solid ${selected ? "#B8956A" : "#e6e6e6"}`, background: selected ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : "#fafaf7", boxShadow: selected ? "0 3px 10px rgba(184,149,106,0.18)" : "none", transition: "all 150ms" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px" }}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${selected ? "#B8956A" : "#c4b59a"}`, flexShrink: 0, background: selected ? "#B8956A" : "transparent", boxShadow: selected ? "inset 0 0 0 3.5px #fff" : "none" }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#1a1a1a", marginBottom: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {channel.name}
          {recommended && <span style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase" }}>Recomendado</span>}
        </p>
        <p style={{ fontSize: 10.5, color: "#777" }}>{channel.time}</p>
      </div>
      <p style={{ fontSize: 13.5, fontWeight: 800, color: "#B8956A", fontFeatureSettings: '"tnum"', whiteSpace: "nowrap" }}>{fmtUSD(channel.total)}</p>
    </div>
  </label>;
}

function DelivRow({ label, meta, price, selected, onClick }) {
  return <label onClick={onClick} style={{ cursor: "pointer", display: "block", borderRadius: 9, border: `1.5px solid ${selected ? "#B8956A" : "#e6e6e6"}`, background: selected ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : "#fafaf7", boxShadow: selected ? "0 3px 10px rgba(184,149,106,0.18)" : "none", transition: "all 150ms" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px" }}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${selected ? "#B8956A" : "#c4b59a"}`, flexShrink: 0, background: selected ? "#B8956A" : "transparent", boxShadow: selected ? "inset 0 0 0 3.5px #fff" : "none" }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#1a1a1a", marginBottom: 1 }}>{label}</p>
        <p style={{ fontSize: 10.5, color: "#777" }}>{meta}</p>
      </div>
      <p style={{ fontSize: 13.5, fontWeight: 800, color: "#B8956A", fontFeatureSettings: '"tnum"', whiteSpace: "nowrap" }}>{price}</p>
    </div>
  </label>;
}

function TimeStep({ n, name, meta }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", background: "#fff", border: "1px solid #ebe6db", borderRadius: 9 }}>
    <span style={{ width: 21, height: 21, borderRadius: "50%", background: "#0A1628", color: "#E8D098", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
    <div><p style={{ fontSize: 11.5, fontWeight: 700, color: "#1a1a1a", marginBottom: 1 }}>{name}</p><p style={{ fontSize: 10.5, color: "#777" }}>{meta}</p></div>
  </div>;
}

function AcceptedView({ quote, accepted, cn, settings }) {
  return <div style={pageStyle()}>
    <div style={{ maxWidth: 600, padding: "40px 30px", background: "#fafaf7", color: "#1a1a1a", borderRadius: 16, textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.55)" }}>
      <div style={{ fontSize: 60, marginBottom: 14 }}>✓</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", marginBottom: 8 }}>¡Cotización aceptada!</h1>
      <p style={{ fontSize: 14, color: "#444", marginBottom: 20, lineHeight: 1.6 }}>
        Hola <strong>{cn}</strong>, recibimos tu confirmación. {accepted?.operation_code && <>Tu operación es <strong style={{ fontFamily: "'JetBrains Mono',monospace", color: "#B8956A" }}>{accepted.operation_code}</strong>.</>}
      </p>
      <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>En las próximas horas te enviamos por email las instrucciones para el primer pago. Cualquier duda escribinos a <strong>info@argencargo.com.ar</strong>.</p>
      {settings?.office_phone && <p style={{ fontSize: 12, color: "#888", marginTop: 14 }}>Tel: {settings.office_phone}</p>}
    </div>
  </div>;
}

function formatDate(d) { if (!d) return "—"; const s = String(d).slice(0, 10); const [y, m, day] = s.split("-"); return new Date(y, m - 1, day).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }); }

function pageStyle() { return { minHeight: "100vh", background: "#1a1f2e", padding: "28px 20px", display: "flex", justifyContent: "center", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", color: "#fff" }; }
function qdStyle() { return { maxWidth: 1180, width: "100%", background: "#fafaf7", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.55)", color: "#1a1a1a", display: "flex", flexDirection: "column" }; }
function qdHeadStyle() { return { background: "#0A1628", color: "#fff", padding: "20px 30px 18px", position: "relative" }; }
function qdLblStyle() { return { fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(232,208,152,0.65)", textTransform: "uppercase", marginBottom: 3 }; }
function qdSecCardStyle() { return { padding: "14px 16px", background: "#fff", border: "1px solid #ebe6db", borderRadius: 11 }; }
function qdSecTitleStyle() { return { fontSize: 9.5, fontWeight: 800, letterSpacing: "0.18em", color: "#666", textTransform: "uppercase", marginBottom: 8 }; }
function qdProdRowStyle(first) { return { display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #ebe6db", paddingTop: first ? 4 : 12 }; }
function qdTotalBarStyle() { return { padding: "16px 18px", background: "linear-gradient(135deg,#B8956A,#E8D098)", color: "#0A1628", borderRadius: 11, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 5px 16px rgba(184,149,106,0.25)", gap: 10 }; }
