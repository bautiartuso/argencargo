"use client";
import { useState, useEffect } from "react";
import { printGiQuotePdf } from "../../../lib/pdf-templates";

const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";

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
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== "undefined" && window.innerWidth < 760);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/cotizacion/${token}`);
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "No se pudo cargar la cotización"); setLoading(false); return; }
        setData(d);
        // Pre-seleccionar el canal MÁS BARATO disponible para el cliente (filtrando por origen).
        const someUSA = (d.quote.gi_quote_products || []).some(p => p.origin === "usa");
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
  }, [token]);

  const openConfirm = () => { if (!selectedChannel) return; setShowConfirm(true); };
  const accept = async () => {
    setShowConfirm(false);
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

  // Calcular peso facturable total (kg = bruto, cbm volumetrico) entre todos los productos para elegir tier correcto.
  let totalKg = 0, totalCbm = 0;
  for (const p of products) {
    const pkgs = Number(p.pkg_count || 0);
    const w = Number(p.pkg_weight_kg || 0) * pkgs;
    const vol = (Number(p.pkg_length_cm || 0) * Number(p.pkg_width_cm || 0) * Number(p.pkg_height_cm || 0)) / 1000000 * pkgs;
    totalKg += w; totalCbm += vol;
  }
  const activeRates = rates.filter(r => r.cost_usd && Number(r.cost_usd) > 0);
  // Filtrar zonas según la declarada por el socio en el wizard.
  // Si delivery_zone está vacía, intentar inferir por la ficha del cliente.
  const inferZoneFromClient = () => {
    const cl = quote.gi_quote_requests?.clients || {};
    const txt = `${cl.city || ""} ${cl.province || ""}`.toLowerCase();
    if (!txt.trim()) return null;
    if (/\bcaba\b|capital federal|ciudad aut[oó]noma/.test(txt)) return "CABA";
    if (/buenos aires|gba|provincia/.test(txt)) {
      if (/(san isidro|vicente l[oó]pez|tigre|pilar|escobar|maschwitz|martinez|olivos|nordelta|beccar|acassuso|san fernando|del viso)/.test(txt)) return "GBA Norte";
      if (/(lomas|quilmes|avellaneda|berazategui|lan[uú]s|florencio varela|adrogu[eé])/.test(txt)) return "GBA Sur";
      if (/(mor[oó]n|matanza|merlo|moreno|ituzaing[oó]|hurlingham|ramos mej[ií]a|haedo|caseros)/.test(txt)) return "GBA Oeste";
      return null; // no inferimos GBA genérico — mejor dejar que el socio elija
    }
    return "Interior";
  };
  const declaredZone = quote.delivery_zone || inferZoneFromClient();
  const zoneOptions = {};
  if (declaredZone === "Interior") {
    // No mostramos opciones — el cliente ve un mensaje "a coordinar" más abajo.
  } else if (declaredZone) {
    const tiers = activeRates.filter(r => r.zone === declaredZone).sort((a, b) => Number(a.cost_usd) - Number(b.cost_usd));
    if (tiers.length > 0) {
      const fits = tiers.find(t => totalKg <= Number(t.max_kg || Infinity) && totalCbm <= Number(t.max_cbm || Infinity));
      zoneOptions[declaredZone] = fits || tiers[tiers.length - 1];
    }
  } else {
    const zonesSeen = new Set(activeRates.map(r => r.zone));
    for (const zone of zonesSeen) {
      const tiers = activeRates.filter(r => r.zone === zone).sort((a, b) => Number(a.cost_usd) - Number(b.cost_usd));
      const fits = tiers.find(t => totalKg <= Number(t.max_kg || Infinity) && totalCbm <= Number(t.max_cbm || Infinity));
      zoneOptions[zone] = fits || tiers[tiers.length - 1];
    }
  }
  const isInterior = declaredZone === "Interior";

  const selChannel = channels.find(c => c.key === selectedChannel);
  const channelTotal = selChannel ? selChannel.total : 0;
  const deliveryCost = selectedDelivery === "oficina" ? 0 : (zoneOptions[selectedDelivery]?.cost_usd ? Number(zoneOptions[selectedDelivery].cost_usd) : 0);
  const finalTotal = channelTotal + deliveryCost;

  // Distribuir el total del canal + envío proporcional al FOB de cada producto.
  // Si el cliente eligió envío a domicilio, el costo del envío también se prorratea.
  const totalFobPub = products.reduce((s, p) => s + Number(p.unit_cost_usd || 0) * Number(p.quantity || 0), 0);
  const landedSubtotal = (p) => {
    const baseTotal = channelTotal + deliveryCost; // incluye envío si aplica
    if (!baseTotal || !totalFobPub) return Number(p.unit_cost_usd || 0) * Number(p.quantity || 0);
    const fob = Number(p.unit_cost_usd || 0) * Number(p.quantity || 0);
    return baseTotal * (fob / totalFobPub);
  };
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
    return <AcceptedView quote={quote} accepted={accepted} cn={cn} settings={settings} products={products} client={quote.gi_quote_requests?.clients}/>;
  }

  return <div style={pageStyle(isMobile)}>
    <p style={{ textAlign: "center", fontSize: 10.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: isMobile ? 14 : 24 }}>Cotización · Argencargo Gestión Integral</p>

    <div style={qdStyle()}>
      {/* Header */}
      <div style={{ ...qdHeadStyle(), padding: isMobile ? "16px 18px 14px" : "20px 30px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <img src={LOGO} alt="Argencargo" style={{ height: isMobile ? 32 : 46, width: "auto" }}/>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(232,208,152,0.85)", textTransform: "uppercase", marginBottom: 3 }}>Cotización · Gestión Integral</p>
            <p style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: isMobile ? 14 : 17, fontWeight: 700, color: "#E8D098", letterSpacing: "0.04em", marginBottom: 1 }}>{quote.gi_quote_requests?.request_code || "—"}</p>
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
                {Object.values(zoneOptions).map(zone => <DelivRow key={zone.zone} label={`Envío a ${zone.zone}`} meta="Coordinamos día y horario" price={`+ ${fmtUSD(zone.cost_usd)}`} selected={selectedDelivery === zone.zone} onClick={() => setSelectedDelivery(zone.zone)}/>)}
                {isInterior && <DelivRow label="Envío a domicilio" meta="Coordinamos costo y plazo según localidad" price="A coordinar" selected={selectedDelivery === "interior_coordinar"} onClick={() => setSelectedDelivery("interior_coordinar")}/>}
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
                <TimeStep n="2" name="Envío y arribo" meta={selChannel ? channelTransitText(selChannel) : "—"}/>
                <TimeStep n="3" name="Entrega final" meta={selChannel ? `${totalDaysText(selChannel, maxLead)} · ${selectedDelivery === "oficina" ? `Retiro · ${settings?.office_locality || "Recoleta CABA"}` : `Envío a ${selectedDelivery}`}` : "—"}/>
              </div>
            </div>

            {settings?.terms_and_conditions && <details style={{ padding: "9px 12px", background: "#fff", border: "1px solid #ebe6db", borderRadius: 9, fontSize: 11, color: "#555" }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, color: "#1a1a1a", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase" }}>Términos y condiciones</summary>
              <div style={{ paddingTop: 8, marginTop: 8, borderTop: "1px solid #ebe6db", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{settings.terms_and_conditions}</div>
            </details>}

            <button onClick={openConfirm} disabled={accepting || !selectedChannel} style={{ width: "100%", padding: "14px 22px", background: accepting ? "#444" : "#0A1628", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: accepting ? "wait" : "pointer", letterSpacing: "0.04em", fontFamily: "inherit" }}>{accepting ? "Procesando…" : "Aceptar y comenzar producción"}</button>
            <p style={{ textAlign: "center", fontSize: 10, color: "#888", marginTop: 6 }}>Al aceptar, recibís un email con instrucciones para el primer pago.</p>

            {showConfirm && <div onClick={() => setShowConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(8,12,24,0.78)", backdropFilter: "blur(10px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: "100%", background: "linear-gradient(180deg,#fefcf6 0%,#fdf9ed 100%)", borderRadius: 16, padding: "28px 28px 22px", border: "1px solid rgba(184,149,106,0.3)", boxShadow: "0 30px 80px rgba(0,0,0,0.45)", color: "#1a1a1a", fontFamily: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#B8956A,#E8D098)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>✓</div>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em", color: "#0A1628" }}>Confirmar aceptación</h2>
                </div>
                <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.55, color: "#4a4a4a" }}>Al confirmar se genera tu operación y te enviamos por email las instrucciones del primer pago para arrancar la producción.</p>
                <div style={{ padding: "12px 14px", background: "rgba(184,149,106,0.10)", border: "1px solid rgba(184,149,106,0.3)", borderRadius: 10, marginBottom: 18 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#8b6f4a", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>Servicio elegido</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0A1628", margin: "4px 0 0" }}>{(rates.find(r => r.key === selectedChannel) || {}).name || "—"}</p>
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
      quote: { ...quote, request_code: quote.gi_quote_requests?.request_code || quote.request_code },
      products: products || [],
      client: client || quote.gi_quote_requests?.clients,
      settings,
      requestCode: quote.gi_quote_requests?.request_code || quote.request_code,
    });
  };
  const total = Number(accepted?.total || 0);
  const plan = (Array.isArray(accepted?.payment_plan) ? accepted.payment_plan : (Array.isArray(quote.payment_plan) ? quote.payment_plan : [])).filter(s => Number(s.pct || 0) > 0);
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
