"use client";
import { useState, useEffect } from "react";
import { printGiQuotePdf } from "../../../lib/pdf-templates";

const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

// Misma sesión que el portal de clientes (localStorage "ac_s"): si ya entró al portal, la
// cotización se abre directo.
const loadSession = () => { try { return JSON.parse(localStorage.getItem("ac_s") || "null"); } catch { return null; } };
const saveSession = (d) => { try { localStorage.setItem("ac_s", JSON.stringify(d)); } catch {} };
const clearSession = () => { try { localStorage.removeItem("ac_s"); } catch {} };
const jwtExp = (t) => { try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000; } catch { return 0; } };
const authCall = async (path, body) => {
  const r = await fetch(`${SB_URL}/auth/v1/${path}`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({}));
};
// Sin sesión de cliente, se prueba la del panel GI o la del admin: el staff la ve como vista previa.
const tokenStaff = () => {
  try {
    const g = JSON.parse(localStorage.getItem("ac_gi_s") || "null")?.access_token;
    if (g && jwtExp(g) > Date.now() + 30000) return g;
    const a = JSON.parse(localStorage.getItem("ac_admin") || "null")?.token;
    if (a && jwtExp(a) > Date.now() + 30000) return a;
  } catch {}
  return null;
};
const tokenVigente = async () => {
  const s = loadSession();
  if (!s?.token) return tokenStaff();
  if (jwtExp(s.token) > Date.now() + 60000) return s.token;
  if (!s.refresh_token) { clearSession(); return null; }
  const r = await authCall("token?grant_type=refresh_token", { refresh_token: s.refresh_token });
  if (!r?.access_token) { clearSession(); return null; }
  saveSession({ ...s, token: r.access_token, refresh_token: r.refresh_token || s.refresh_token, user: r.user || s.user });
  return r.access_token;
};

const fmtUSD = (n) => "USD " + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtUSD2 = (n) => "USD " + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CHANNEL_LABELS = {
  aereo_blanco: { name: "Aéreo Courier Comercial", transitMin: 7, transitMax: 10, transitUnit: "días hábiles", costKey: "cost_aereo_int_total_usd" },
  // OJO con las keys: maritimo_blanco internamente apunta a LCL/FCL (con min 1 m³)
  // y maritimo_negro al servicio Integral AC (sin mínimo).
  maritimo_blanco: { name: "Marítimo LCL / FCL", transitMin: 60, transitMax: 60, transitUnit: "días", costKey: "cost_maritimo_int_total_usd" },
  maritimo_negro: { name: "Marítimo Integral AC", transitMin: 60, transitMax: 60, transitUnit: "días", costKey: "cost_maritimo_lcl_total_usd" },
};

// Texto resumido del tiempo total (producción + tránsito) — usado en la lista de servicios.
function channelTimeText(c, maxLead) {
  const tMin = c.transitMin || 0, tMax = c.transitMax || 0;
  const lead = Number(maxLead) || 0;
  const totMin = lead + tMin, totMax = lead + tMax;
  const transitStr = tMin === tMax ? `~${tMax}` : `${tMin} a ${tMax}`;
  const totalStr = totMin === totMax ? `~${totMax}` : `${totMin} a ${totMax}`;
  if (lead > 0) return `${lead}d producción + ${transitStr}d tránsito ≈ ${totalStr} ${c.transitUnit}`;
  return `${transitStr} ${c.transitUnit}`;
}
// Solo tránsito, sin producción.
function channelTransitText(c) {
  const tMin = c.transitMin || 0, tMax = c.transitMax || 0;
  if (tMin === tMax) return `~${tMax} ${c.transitUnit}`;
  return `${tMin} a ${tMax} ${c.transitUnit}`;
}
// Total desde el pago: producción + tránsito + 1 día buffer entrega final.
function totalDaysText(c, maxLead) {
  const tMin = c.transitMin || 0, tMax = c.transitMax || 0;
  const lead = Number(maxLead) || 0;
  const totMin = lead + tMin + 1, totMax = lead + tMax + 1;
  const totalStr = totMin === totMax ? `~${totMax}` : `aprox. ${totMin} a ${totMax}`;
  return `${totalStr} ${c.transitUnit} desde el pago`;
}

export default function CotizacionPublica({ params }) {
  // En Next 14 params es un objeto plano. En Next 15 es Promise — soportar ambos sin React.use().
  const token = params?.token;
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState("oficina");
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [gate, setGate] = useState(null); // { login, nombre, codigo, tiene_cuenta } | { otra_cuenta, nombre, email }
  const [errAccion, setErrAccion] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== "undefined" && window.innerWidth < 760);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const tk = await tokenVigente();
        const r = await fetch(`/api/cotizacion/${token}`, { headers: tk ? { Authorization: `Bearer ${tk}` } : {} });
        const d = await r.json();
        if (r.status === 401 && d.login) { setGate(d); setLoading(false); return; }
        if (r.status === 403 && d.otra_cuenta) { setGate(d); setLoading(false); return; }
        if (!r.ok) { setErr(d.error || "No se pudo cargar la cotización"); setLoading(false); return; }
        setGate(null);
        setData(d);
        // Pre-seleccionar el canal MÁS BARATO disponible para el cliente (filtrando por origen).
        const someUSA = (d.productos || []).some(p => p.origin === "usa");
        const channelDefs = CHANNEL_LABELS;
        const available = Object.entries(channelDefs)
          .filter(([k]) => !someUSA || k.includes("negro") || k === "maritimo_blanco")
          .map(([key, def]) => ({ key, total: Number(d.quote[def.costKey] || 0) }))
          .filter(c => c.total > 0)
          .sort((a, b) => a.total - b.total);
        const def = available[0]?.key || (someUSA ? "maritimo_negro" : "aereo_blanco");
        setSelectedChannel(def);
        setLoading(false);
      } catch (e) {
        setErr("Error de red");
        setLoading(false);
      }
    })();
  }, [token, tick]);

  const openConfirm = () => { if (!selectedChannel) return; setShowConfirm(true); };
  const responder = async (payload) => {
    setErrAccion("");
    setAccepting(true);
    const tk = await tokenVigente();
    if (!tk) { setAccepting(false); setTick(x => x + 1); return null; }
    const r = await fetch(`/api/cotizacion/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    setAccepting(false);
    if (!r.ok) { setErrAccion(d.error || "No se pudo registrar la respuesta"); if (d.already) setTick(x => x + 1); return null; }
    return d;
  };
  const accept = async () => {
    setShowConfirm(false);
    const d = await responder({ action: "accept", channel: selectedChannel, delivery_zone: selectedDelivery });
    if (d) setAccepted(d);
  };
  const reject = async (reason) => {
    const d = await responder({ action: "reject", reason });
    if (d) { setShowReject(false); setRejected(true); }
  };

  if (loading) return <div style={pageStyle()}><p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Cargando…</p></div>;
  if (gate?.login) return <IngresoCotizacion gate={gate} token={token} onListo={() => setTick(x => x + 1)}/>;
  if (gate?.otra_cuenta) return <OtraCuenta gate={gate} onCambiar={() => { clearSession(); setTick(x => x + 1); }}/>;
  if (err) return <div style={pageStyle()}><div style={{ maxWidth: 480, padding: 30, background: "rgba(255,255,255,0.04)", borderRadius: 14, textAlign: "center" }}><p style={{ fontSize: 16, fontWeight: 600, color: "#f87171" }}>{err}</p></div></div>;
  if (!data) return null;

  const { quote, settings, rol, vencida } = data;
  const esCliente = rol === "cliente";
  // "unit_cost_usd" acá NO es el costo del proveedor: es el peso del producto en el total
  // repartido por unidad (lo usa el PDF para prorratear). El servidor nunca manda costos.
  const products = (data.productos || []).map(p => ({ ...p, unit_cost_usd: Number(p.quantity) > 0 ? p.peso / Number(p.quantity) : 0 }));
  const clientData = quote.client || {};
  const cn = `${clientData.first_name || ""} ${clientData.last_name || ""}`.trim() || "Cliente";
  const someUSA = products.some(p => p.origin === "usa");

  // Lista de canales disponibles (filtrar por origen)
  const channels = Object.entries(CHANNEL_LABELS)
    .filter(([k]) => !someUSA || k.includes("negro") || k === "maritimo_blanco")
    .map(([key, def]) => ({ key, ...def, total: Number(quote[def.costKey] || 0) }))
    .filter(c => c.total > 0)
    .sort((a, b) => a.total - b.total);

  // Calcular peso facturable total (kg = bruto, cbm volumetrico) entre todos los productos para elegir tier correcto.
  const totalKg = Number(data.carga?.kg || 0), totalCbm = Number(data.carga?.cbm || 0);
  // Entrega: retiro por oficina, envío a domicilio con las tarifas de Argencargo (si la ficha tiene
  // localidad conocida, esa; si no, CABA) u otra localidad a coordinar.
  const ent = data.entrega || {};
  const domicilio = ent.domicilio || (ent.caba != null ? { zona: "CABA", costo: ent.caba } : null);
  const selChannel = channels.find(c => c.key === selectedChannel);
  const channelTotal = selChannel ? selChannel.total : 0;
  const deliveryCost = domicilio && selectedDelivery === domicilio.zona ? Number(domicilio.costo || 0) : 0;
  const finalTotal = channelTotal + deliveryCost;

  // Distribuir el total del canal + envío proporcional al FOB de cada producto.
  // Si el cliente eligió envío a domicilio, el costo del envío también se prorratea.
  const landedSubtotal = (p) => (channelTotal + deliveryCost) * Number(p.peso || 0);
  const landedUnit = (p) => {
    const qty = Number(p.quantity || 0);
    if (!qty) return 0;
    return landedSubtotal(p) / qty;
  };

  // Plan de pagos
  const plan = (Array.isArray(quote.payment_plan) ? quote.payment_plan : (typeof quote.payment_plan === "string" ? JSON.parse(quote.payment_plan) : [])).filter(s => Number(s.pct || 0) > 0);

  const totalQty = products.reduce((s, p) => s + Number(p.quantity || 0), 0);
  const maxLead = products.reduce((m, p) => Math.max(m, Number(p.lead_time_days || 0)), 0);

  // Si ya fue aceptada
  if (accepted || quote.status === "accepted" || quote.status === "converted") {
    return <AcceptedView quote={quote} accepted={accepted} cn={cn} settings={settings} products={products} client={clientData}/>;
  }
  if (rejected || quote.status === "rejected") return <RejectedView cn={cn} code={quote.request_code}/>;

  return <div style={pageStyle(isMobile)}>
    <p style={{ textAlign: "center", fontSize: 10.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: isMobile ? 14 : 24 }}>Cotización · Argencargo Gestión Integral</p>

    <div style={qdStyle()}>
      {/* Header */}
      <div style={{ ...qdHeadStyle(), padding: isMobile ? "16px 18px 14px" : "20px 30px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <img src={LOGO} alt="Argencargo" style={{ height: isMobile ? 32 : 46, width: "auto" }}/>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(232,208,152,0.85)", textTransform: "uppercase", marginBottom: 3 }}>Cotización · Gestión Integral</p>
            <p style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: isMobile ? 14 : 17, fontWeight: 700, color: "#E8D098", letterSpacing: "0.04em", marginBottom: 1 }}>{quote.request_code || "—"}</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{quote.expires_at ? `Válida hasta ${formatDate(quote.expires_at)}` : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div><p style={qdLblStyle()}>Cliente</p><p style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{cn}</p></div>
          <div><p style={qdLblStyle()}>{totalQty} unidades · {products.length} {products.length === 1 ? "producto" : "productos"}</p></div>
        </div>
        <div style={{ height: 5, background: "linear-gradient(90deg,#B8956A 0%,#E8D098 50%,#B8956A 100%)", position: "absolute", left: 0, right: 0, bottom: 0 }}/>
      </div>

      {/* Body — 2 col en desktop, 1 col en mobile */}
      <div style={{ padding: isMobile ? "16px 14px 22px" : "24px 30px 28px", background: "#fafaf7" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.15fr 1fr", gap: isMobile ? 12 : 18, alignItems: "start" }}>
          {/* COL IZQUIERDA: productos + servicio */}
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 14, minWidth: 0 }}>
            <div style={qdSecCardStyle()}>
              <p style={qdSecTitleStyle()}>Productos</p>
              <p style={{ fontSize: 11, color: "#888", margin: "-4px 0 6px", lineHeight: 1.5 }}>Precios <strong style={{ color: "#0A1628" }}>puestos en Buenos Aires</strong> (incluye flete, aduana, impuestos{deliveryCost > 0 ? ", envío a domicilio" : ""} y honorarios) según el servicio{deliveryCost > 0 ? " y entrega" : ""} seleccionado.</p>
              {products.map((p, i) => {
                const subLanded = landedSubtotal(p);
                const unitLanded = landedUnit(p);
                return <div key={p.id || i} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 12, alignItems: isMobile ? "stretch" : "center", padding: "10px 0", borderBottom: "1px solid #ebe6db", paddingTop: i === 0 ? 4 : 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0 }}>
                    {p.photo_url ? <img src={p.photo_url} alt={p.description || ""} style={{ width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #d4c5a0", background: "#f3eadb" }} onError={e => { e.currentTarget.style.display = "none"; }}/>
                      : <div style={{ width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, borderRadius: 8, background: "linear-gradient(135deg,#f3eadb,#e7d8b8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, border: "1px solid #d4c5a0" }}>📦</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: isMobile ? 12.5 : 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 1, lineHeight: 1.35, wordBreak: "break-word" }}>{p.description}</p>
                      {p.lead_time_days > 0 && <p style={{ fontSize: 10.5, color: "#B8956A", fontWeight: 600, marginTop: 3 }}>⏱ Producción {p.lead_time_days} días</p>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: isMobile ? 60 : 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: "#0A1628", fontFeatureSettings: '"tnum"', letterSpacing: "-0.01em", lineHeight: 1.1 }}>{fmtUSD2(unitLanded)} <span style={{ fontSize: 10, fontWeight: 600, color: "#888", letterSpacing: 0 }}>/ unidad</span></p>
                    <p style={{ fontSize: 10.5, color: "#888", fontFeatureSettings: '"tnum"', marginTop: 3 }}>{p.quantity} u. · subtotal {fmtUSD2(subLanded)}</p>
                  </div>
                </div>;
              })}
            </div>

            <div style={qdSecCardStyle()}>
              <p style={qdSecTitleStyle()}>Elegí qué servicio preferís</p>
              <p style={{ fontSize: 11, color: "#888", margin: "-4px 0 8px", lineHeight: 1.5 }}>El precio cambia según modo de transporte. Todos incluyen flete internacional, gestión aduanera y entrega final.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {channels.map((c, i) => <SvcRow key={c.key} channel={c} maxLead={maxLead} selected={selectedChannel === c.key} onClick={() => setSelectedChannel(c.key)} recommended={i === 0 && channels.length > 1}/>)}
              </div>
            </div>
          </div>

          {/* COL DERECHA: entrega + total + plan + tiempos */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div style={qdSecCardStyle()}>
              <p style={qdSecTitleStyle()}>¿Cómo querés recibirla?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                <DelivRow label="Retiro por oficina" meta={settings ? `${settings.office_address || ""} · ${settings.office_locality || ""} · ${settings.office_hours || ""}` : "Sin costo"} price="Incluido" selected={selectedDelivery === "oficina"} onClick={() => setSelectedDelivery("oficina")}/>
                {domicilio && <DelivRow label={`Envío a domicilio · ${domicilio.zona}`} meta="Coordinamos día y horario" price={`+ ${fmtUSD(domicilio.costo)}`} selected={selectedDelivery === domicilio.zona} onClick={() => setSelectedDelivery(domicilio.zona)}/>}
                <DelivRow label={domicilio ? "Envío a otra localidad" : "Envío a domicilio"} meta="Te pasamos costo y plazo según la localidad" price="A coordinar" selected={selectedDelivery === "coordinar"} onClick={() => setSelectedDelivery("coordinar")}/>
              </div>
            </div>

            <div style={qdTotalBarStyle()}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>Total</p>
                <p style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(10,22,40,0.65)", marginTop: 2 }}>{selChannel?.name || "—"} · {selectedDelivery === "oficina" ? "Retiro por oficina" : selectedDelivery === "coordinar" ? "Envío a coordinar" : `Envío a ${selectedDelivery}`}</p>
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
                <TimeStep n="2" name="Envío y arribo" meta={selChannel ? channelTransitText(selChannel) : "—"}/>
                <TimeStep n="3" name="Entrega final" meta={selChannel ? `${totalDaysText(selChannel, maxLead)} · ${selectedDelivery === "oficina" ? `Retiro · ${settings?.office_locality || "Belgrano CABA"}` : selectedDelivery === "coordinar" ? "Envío a coordinar" : `Envío a ${selectedDelivery}`}` : "—"}/>
              </div>
            </div>

            {settings?.terms_and_conditions && <details style={{ padding: "9px 12px", background: "#fff", border: "1px solid #ebe6db", borderRadius: 9, fontSize: 11, color: "#555" }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, color: "#1a1a1a", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase" }}>Términos y condiciones</summary>
              <div style={{ paddingTop: 8, marginTop: 8, borderTop: "1px solid #ebe6db", lineHeight: 1.55 }}>{String(settings.terms_and_conditions).split("\n").map((l, i) => {
                const t = l.trim();
                if (!t) return <div key={i} style={{ height: 6 }} />;
                if (/:$/.test(t) && !t.startsWith("-")) return <p key={i} style={{ margin: "6px 0 2px", fontWeight: 800, color: "#0A1628", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.replace(/:$/, "")}</p>;
                if (t.startsWith("-")) return <p key={i} style={{ margin: "2px 0", paddingLeft: 12, position: "relative" }}><span style={{ position: "absolute", left: 0, color: "#B8956A" }}>•</span>{t.replace(/^-\s*/, "")}</p>;
                return <p key={i} style={{ margin: "2px 0" }}>{t}</p>;
              })}</div>
            </details>}

            {vencida ? <div style={{ padding: "14px 16px", background: "#fff4f4", border: "1px solid #f3c4c4", borderRadius: 10, textAlign: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#b42318", margin: 0 }}>Esta cotización venció</p>
              <p style={{ fontSize: 11.5, color: "#7a2e2e", margin: "4px 0 0", lineHeight: 1.5 }}>Los precios pueden haber cambiado. Escribinos y te mandamos una actualizada.</p>
            </div> : !esCliente ? <div style={{ padding: "12px 14px", background: "#eef4ff", border: "1px solid #c9d8f5", borderRadius: 10, textAlign: "center" }}>
              <p style={{ fontSize: 12.5, fontWeight: 800, color: "#1d4ed8", margin: 0 }}>Vista previa</p>
              <p style={{ fontSize: 11.5, color: "#334155", margin: "3px 0 0" }}>Solo {cn} puede aceptarla o rechazarla desde su cuenta.</p>
            </div> : <>
              <button onClick={openConfirm} disabled={accepting || !selectedChannel} style={{ width: "100%", padding: "14px 22px", background: accepting ? "#444" : "#0A1628", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: accepting ? "wait" : "pointer", letterSpacing: "0.04em", fontFamily: "inherit" }}>{accepting ? "Procesando…" : "Aceptar y comenzar producción"}</button>
              <button onClick={() => setShowReject(true)} disabled={accepting} style={{ width: "100%", padding: "10px 16px", marginTop: 8, background: "transparent", color: "#8a8a8a", border: "1px solid #e2ddd0", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>No me interesa por ahora</button>
              {errAccion && <p style={{ textAlign: "center", fontSize: 12, color: "#b42318", fontWeight: 600, margin: "8px 0 0" }}>{errAccion}</p>}
            </>}
            {showReject && <RechazoModal onCancel={() => setShowReject(false)} onConfirm={reject} enviando={accepting} err={errAccion}/>}

            {showConfirm && <div onClick={() => setShowConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(8,12,24,0.78)", backdropFilter: "blur(10px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: "100%", background: "linear-gradient(180deg,#fefcf6 0%,#fdf9ed 100%)", borderRadius: 16, padding: "28px 28px 22px", border: "1px solid rgba(184,149,106,0.3)", boxShadow: "0 30px 80px rgba(0,0,0,0.45)", color: "#1a1a1a", fontFamily: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#B8956A,#E8D098)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>✓</div>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em", color: "#0A1628" }}>Confirmar aceptación</h2>
                </div>
                <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.55, color: "#4a4a4a" }}>Al confirmar, un asesor revisa tu pedido y te pasa las instrucciones del primer pago para arrancar la producción.</p>
                <div style={{ padding: "12px 14px", background: "rgba(184,149,106,0.10)", border: "1px solid rgba(184,149,106,0.3)", borderRadius: 10, marginBottom: 18 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#8b6f4a", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>Servicio elegido</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0A1628", margin: "4px 0 0" }}>{selChannel?.name || "—"}</p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#B8956A", margin: "2px 0 0" }}>{fmtUSD(finalTotal)} · {selectedDelivery === "oficina" ? "Retiro por oficina" : selectedDelivery === "coordinar" ? "Envío a coordinar" : `Envío a ${selectedDelivery}`}</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: "12px 20px", background: "transparent", color: "#0A1628", border: "1.5px solid rgba(10,22,40,0.2)", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                  <button onClick={accept} style={{ flex: 1.5, padding: "12px 20px", background: "#0A1628", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em" }}>Confirmar y aceptar</button>
                </div>
              </div>
            </div>}
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

function SvcRow({ channel, maxLead, selected, onClick, recommended }) {
  return <label onClick={onClick} style={{ cursor: "pointer", display: "block", borderRadius: 9, border: `1.5px solid ${selected ? "#B8956A" : "#e6e6e6"}`, background: selected ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : "#fafaf7", boxShadow: selected ? "0 3px 10px rgba(184,149,106,0.18)" : "none", transition: "all 150ms" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px" }}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${selected ? "#B8956A" : "#c4b59a"}`, flexShrink: 0, background: selected ? "#B8956A" : "transparent", boxShadow: selected ? "inset 0 0 0 3.5px #fff" : "none" }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#1a1a1a", marginBottom: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {channel.name}
          {recommended && <span style={{ fontSize: 8.5, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase" }}>Recomendado</span>}
        </p>
        <p style={{ fontSize: 10.5, color: "#777" }}>{channelTimeText(channel, maxLead)}</p>
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

function AcceptedView({ quote, accepted, cn, settings, products, client }) {
  const downloadPdf = () => {
    // Mismo PDF que descarga el admin desde el panel GI — UNDW style con precio venta al cliente.
    printGiQuotePdf({
      quote: { ...quote, selected_channel: accepted?.channel || quote.selected_channel },
      products: products || [],
      client,
      settings,
      requestCode: quote.request_code,
    });
  };
  const totalGuardado = (() => {
    const k = { aereo_blanco: "cost_aereo_int_total_usd", maritimo_negro: "cost_maritimo_lcl_total_usd", maritimo_blanco: "cost_maritimo_int_total_usd" }[quote.selected_channel];
    return k ? Number(quote[k] || 0) + Number(quote.selected_delivery_cost_usd || 0) : 0;
  })();
  const total = Number(accepted?.total || 0) || totalGuardado;
  const plan = (Array.isArray(quote.payment_plan) ? quote.payment_plan : (typeof quote.payment_plan === "string" ? (() => { try { return JSON.parse(quote.payment_plan); } catch { return []; } })() : [])).filter(s => Number(s.pct || 0) > 0);
  const stages = plan.length > 0 ? plan : [
    { label: "Inicio de producción", pct: 30 },
    { label: "Producción terminada", pct: 20 },
    { label: "Contra entrega", pct: 50 },
  ];
  const stageAmount = (pct) => (total * (Number(pct) || 0)) / 100;
  return <div style={pageStyle()}>
    <div style={{ maxWidth: 640, width: "100%", padding: "36px 32px", background: "#fafaf7", color: "#1a1a1a", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.55)" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#fff", marginBottom: 12 }}>✓</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", margin: "0 0 6px" }}>¡Cotización aceptada!</h1>
        <p style={{ fontSize: 13.5, color: "#555", margin: 0, lineHeight: 1.55 }}>Hola <strong>{cn}</strong>, recibimos tu confirmación. En las próximas horas un asesor revisa tu pedido y te confirma el inicio.</p>
      </div>

      {/* Plan de pagos */}
      <div style={{ padding: "18px 20px", background: "#fff", border: "1px solid #ebe6db", borderRadius: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: "#8b6f4a", textTransform: "uppercase", margin: "0 0 10px" }}>Plan de pagos</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stages.map((s, i) => {
            const isFirst = i === 0;
            return <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: isFirst ? "linear-gradient(90deg,rgba(184,149,106,0.12),rgba(184,149,106,0.04))" : "#faf8f3", border: isFirst ? "1.5px solid rgba(184,149,106,0.4)" : "1px solid #ebe6db", borderRadius: 9 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: isFirst ? "linear-gradient(135deg,#B8956A,#E8D098)" : "#e5e1d6", color: isFirst ? "#0A1628" : "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{i + 1}</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", margin: 0 }}>{s.label}{isFirst && <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#0A1628", color: "#E8D098", marginLeft: 8, letterSpacing: "0.08em" }}>PRIMER PAGO</span>}</p>
                  <p style={{ fontSize: 11, color: "#666", margin: "2px 0 0" }}>{s.pct}% del total</p>
                </div>
              </div>
              <p style={{ fontSize: 15, fontWeight: 800, color: isFirst ? "#B8956A" : "#0A1628", margin: 0, fontVariantNumeric: "tabular-nums" }}>USD {stageAmount(s.pct).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, marginTop: 10, borderTop: "1px solid #ebe6db" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#666", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</p>
          <p style={{ fontSize: 16, fontWeight: 800, color: "#0A1628", margin: 0, fontVariantNumeric: "tabular-nums" }}>USD {total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Próximos pasos */}
      <div style={{ padding: "14px 16px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 11, marginBottom: 18 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Próximos pasos</p>
        <ol style={{ fontSize: 12.5, color: "#1a1a1a", lineHeight: 1.65, margin: 0, paddingLeft: 18 }}>
          <li>Un asesor revisa tu pedido y te confirma por email/WhatsApp.</li>
          <li>Te enviamos las instrucciones para el <strong>primer pago</strong> (USD {stageAmount(stages[0].pct).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) — con ese pago arranca la producción.</li>
          <li>Una vez que pagás, te creamos la operación y vas a poder seguirla en tu portal.</li>
        </ol>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <button onClick={downloadPdf} style={{ padding: "12px 24px", background: "#0A1628", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em", fontFamily: "inherit" }}>📄 Descargar cotización en PDF</button>
        <p style={{ fontSize: 11.5, color: "#888", margin: 0 }}>Cualquier duda: <strong style={{ color: "#0A1628" }}>info@argencargo.com.ar</strong>{settings?.office_phone ? ` · Tel ${settings.office_phone}` : ""}</p>
      </div>
    </div>
  </div>;
}

function formatDate(d) { if (!d) return "—"; const s = String(d).slice(0, 10); const [y, m, day] = s.split("-"); return new Date(y, m - 1, day).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }); }

function pageStyle(isMobile = false) { return { minHeight: "100vh", background: "#1a1f2e", padding: isMobile ? "14px 10px" : "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", color: "#fff" }; }
function qdStyle() { return { maxWidth: 1180, width: "100%", background: "#fafaf7", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.55)", color: "#1a1a1a", display: "flex", flexDirection: "column" }; }
function qdHeadStyle() { return { background: "#0A1628", color: "#fff", padding: "20px 30px 18px", position: "relative" }; }
function qdLblStyle() { return { fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(232,208,152,0.65)", textTransform: "uppercase", marginBottom: 3 }; }
function qdSecCardStyle() { return { padding: "14px 16px", background: "#fff", border: "1px solid #ebe6db", borderRadius: 11 }; }
function qdSecTitleStyle() { return { fontSize: 9.5, fontWeight: 800, letterSpacing: "0.18em", color: "#666", textTransform: "uppercase", marginBottom: 8 }; }
function qdProdRowStyle(first) { return { display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #ebe6db", paddingTop: first ? 4 : 12 }; }
function qdTotalBarStyle() { return { padding: "16px 18px", background: "linear-gradient(135deg,#B8956A,#E8D098)", color: "#0A1628", borderRadius: 11, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 5px 16px rgba(184,149,106,0.25)", gap: 10 }; }

// ── Ingreso: la cotización solo se ve con la cuenta del cliente ──
function IngresoCotizacion({ gate, token, onListo }) {
  const [modo, setModo] = useState(gate.tiene_cuenta ? "ingresar" : "crear");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [lo, setLo] = useState(false);
  const ingresar = async () => {
    const r = await authCall("token?grant_type=password", { email: email.trim(), password: pass });
    if (!r?.access_token) { setErr("Email o contraseña incorrectos"); return false; }
    saveSession({ token: r.access_token, refresh_token: r.refresh_token, user: r.user });
    return true;
  };
  const enviar = async (e) => {
    e?.preventDefault?.();
    if (!email.trim() || !pass) { setErr("Completá email y contraseña"); return; }
    setLo(true); setErr("");
    if (modo === "crear") {
      const r = await fetch(`/api/cotizacion/${token}/cuenta`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password: pass }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "No se pudo crear la cuenta"); if (d.tiene_cuenta) setModo("ingresar"); setLo(false); return; }
    }
    const ok = await ingresar();
    setLo(false);
    if (ok) onListo();
  };
  const inp = { width: "100%", padding: "12px 14px", fontSize: 15, boxSizing: "border-box", border: "1px solid #dcd5c4", borderRadius: 10, background: "#fff", color: "#0A1628", outline: "none", fontFamily: "inherit", marginBottom: 10 };
  return <div style={{ ...pageStyle(), justifyContent: "center" }}>
    <form onSubmit={enviar} style={{ width: "100%", maxWidth: 400, background: "#fafaf7", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.55)", color: "#1a1a1a" }}>
      <div style={{ background: "#0A1628", padding: "22px 22px 18px", textAlign: "center", position: "relative" }}>
        <img src={LOGO} alt="Argencargo" style={{ height: 38, width: "auto" }}/>
        <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(232,208,152,0.85)", textTransform: "uppercase", margin: "12px 0 2px" }}>Cotización · Gestión Integral</p>
        {gate.codigo && <p style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 15, fontWeight: 700, color: "#E8D098", margin: 0 }}>{gate.codigo}</p>}
        <div style={{ height: 4, background: "linear-gradient(90deg,#B8956A 0%,#E8D098 50%,#B8956A 100%)", position: "absolute", left: 0, right: 0, bottom: 0 }}/>
      </div>
      <div style={{ padding: "22px 22px 24px" }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: "#0A1628", margin: "0 0 4px" }}>{gate.nombre ? `Hola ${gate.nombre}` : "Hola"}</p>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 16px", lineHeight: 1.5 }}>{modo === "crear" ? "Creá tu cuenta para ver tu cotización. Con la misma cuenta después seguís tu importación." : "Ingresá con tu cuenta de Argencargo para ver tu cotización."}</p>
        <div style={{ display: "flex", gap: 4, padding: 4, background: "#efeadf", borderRadius: 10, marginBottom: 14 }}>
          {[["ingresar", "Ya tengo cuenta"], ["crear", "Crear cuenta"]].map(([k, l]) => <button key={k} type="button" onClick={() => { setModo(k); setErr(""); }} style={{ flex: 1, padding: "9px 8px", fontSize: 12.5, fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", background: modo === k ? "#fff" : "transparent", color: modo === k ? "#0A1628" : "#8a8270", boxShadow: modo === k ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>{l}</button>)}
        </div>
        <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inp}/>
        <input type="password" autoComplete={modo === "crear" ? "new-password" : "current-password"} placeholder={modo === "crear" ? "Contraseña (mínimo 6)" : "Contraseña"} value={pass} onChange={e => setPass(e.target.value)} style={inp}/>
        {err && <p style={{ fontSize: 12.5, color: "#b42318", fontWeight: 600, margin: "2px 0 10px" }}>{err}</p>}
        <button type="submit" disabled={lo} style={{ width: "100%", padding: "13px 18px", background: lo ? "#444" : "#0A1628", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: lo ? "wait" : "pointer", fontFamily: "inherit", marginTop: 4 }}>{lo ? "Un momento…" : modo === "crear" ? "Crear cuenta y ver cotización" : "Ver cotización"}</button>
        {modo === "ingresar" && <a href="/portal" style={{ display: "block", textAlign: "center", fontSize: 12, color: "#8b6f4a", marginTop: 12, fontWeight: 600 }}>¿Olvidaste la contraseña?</a>}
      </div>
    </form>
  </div>;
}

function OtraCuenta({ gate, onCambiar }) {
  return <div style={{ ...pageStyle(), justifyContent: "center" }}>
    <div style={{ width: "100%", maxWidth: 400, background: "#fafaf7", borderRadius: 16, padding: "26px 22px", boxShadow: "0 24px 80px rgba(0,0,0,0.55)", color: "#1a1a1a", textAlign: "center" }}>
      <p style={{ fontSize: 17, fontWeight: 800, color: "#0A1628", margin: "0 0 6px" }}>Esta cotización es para {gate.nombre || "otro cliente"}</p>
      <p style={{ fontSize: 13, color: "#666", margin: "0 0 18px", lineHeight: 1.5 }}>Estás con la cuenta <strong>{gate.email}</strong>. Entrá con la cuenta de {gate.nombre || "la persona"} para verla.</p>
      <button onClick={onCambiar} style={{ width: "100%", padding: "12px 18px", background: "#0A1628", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cambiar de cuenta</button>
    </div>
  </div>;
}

function RechazoModal({ onCancel, onConfirm, enviando, err }) {
  const [motivo, setMotivo] = useState("");
  const opciones = ["Es caro", "Tarda mucho", "Ya lo conseguí", "Lo dejo para más adelante"];
  return <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(8,12,24,0.78)", backdropFilter: "blur(10px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
    <div onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: "100%", background: "#fdfbf6", borderRadius: 16, padding: "22px 20px 18px", color: "#1a1a1a" }}>
      <p style={{ fontSize: 17, fontWeight: 800, color: "#0A1628", margin: "0 0 4px" }}>¿Nos contás por qué?</p>
      <p style={{ fontSize: 12.5, color: "#777", margin: "0 0 14px" }}>Nos ayuda a mejorar la próxima cotización.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {opciones.map(o => <button key={o} type="button" onClick={() => setMotivo(o)} style={{ padding: "8px 12px", fontSize: 12.5, fontWeight: 600, borderRadius: 999, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${motivo === o ? "#B8956A" : "#e2ddd0"}`, background: motivo === o ? "#faedd0" : "#fff", color: "#0A1628" }}>{o}</button>)}
      </div>
      <textarea value={opciones.includes(motivo) ? "" : motivo} onChange={e => setMotivo(e.target.value)} placeholder="Otro motivo (opcional)" rows={2} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 14, border: "1px solid #dcd5c4", borderRadius: 10, fontFamily: "inherit", resize: "none", outline: "none", marginBottom: 12 }}/>
      {err && <p style={{ fontSize: 12, color: "#b42318", fontWeight: 600, margin: "0 0 10px" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "12px", background: "transparent", color: "#0A1628", border: "1.5px solid rgba(10,22,40,0.2)", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Volver</button>
        <button onClick={() => onConfirm(motivo)} disabled={enviando} style={{ flex: 1.4, padding: "12px", background: "#0A1628", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: enviando ? "wait" : "pointer", fontFamily: "inherit" }}>{enviando ? "Enviando…" : "Rechazar cotización"}</button>
      </div>
    </div>
  </div>;
}

function RejectedView({ cn, code }) {
  return <div style={{ ...pageStyle(), justifyContent: "center" }}>
    <div style={{ width: "100%", maxWidth: 440, background: "#fafaf7", borderRadius: 16, padding: "28px 22px", boxShadow: "0 24px 80px rgba(0,0,0,0.55)", color: "#1a1a1a", textAlign: "center" }}>
      <p style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 13, fontWeight: 700, color: "#B8956A", margin: "0 0 10px" }}>{code}</p>
      <p style={{ fontSize: 19, fontWeight: 800, color: "#0A1628", margin: "0 0 8px" }}>Gracias por avisarnos{cn && cn !== "Cliente" ? `, ${cn.split(" ")[0]}` : ""}</p>
      <p style={{ fontSize: 13.5, color: "#555", margin: 0, lineHeight: 1.55 }}>Registramos que no vas a avanzar con esta cotización. Cuando quieras retomarla o cotizar otra cosa, escribinos.</p>
    </div>
  </div>;
}
