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
        let tk = await tokenVigente();
        let r = await fetch(`/api/cotizacion/${token}`, { headers: tk ? { Authorization: `Bearer ${tk}` } : {} });
        let d = await r.json();
        // Si hay sesión de cliente pero no es la dueña (ej. Bautista logueado con su cuenta personal),
        // se prueba con la del admin / panel GI del mismo navegador: el staff la ve como vista previa (20/10/2026).
        if (r.status === 403 && d.otra_cuenta) {
          const st = tokenStaff();
          if (st && st !== tk) {
            const r2 = await fetch(`/api/cotizacion/${token}`, { headers: { Authorization: `Bearer ${st}` } });
            const d2 = await r2.json();
            if (r2.ok) { r = r2; d = d2; tk = st; }
          }
        }
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
  const nombrePila = (clientData.first_name || "").trim();
  const someUSA = products.some(p => p.origin === "usa");

  const channels = Object.entries(CHANNEL_LABELS)
    .filter(([k]) => !someUSA || k.includes("negro") || k === "maritimo_blanco")
    .map(([key, def]) => ({ key, ...def, total: Number(quote[def.costKey] || 0) }))
    .filter(c => c.total > 0)
    .sort((a, b) => a.total - b.total);

  const ent = data.entrega || {};
  const domicilio = ent.domicilio || (ent.caba != null ? { zona: "CABA", costo: ent.caba } : null);
  const selChannel = channels.find(c => c.key === selectedChannel);
  const channelTotal = selChannel ? selChannel.total : 0;
  const deliveryCost = domicilio && selectedDelivery === domicilio.zona ? Number(domicilio.costo || 0) : 0;
  const finalTotal = channelTotal + deliveryCost;
  const landedSubtotal = (p) => (channelTotal + deliveryCost) * Number(p.peso || 0);
  const landedUnit = (p) => { const qty = Number(p.quantity || 0); return qty ? landedSubtotal(p) / qty : 0; };
  const plan = (Array.isArray(quote.payment_plan) ? quote.payment_plan : (typeof quote.payment_plan === "string" ? JSON.parse(quote.payment_plan) : [])).filter(s => Number(s.pct || 0) > 0);
  const totalQty = products.reduce((s, p) => s + Number(p.quantity || 0), 0);
  const maxLead = products.reduce((m, p) => Math.max(m, Number(p.lead_time_days || 0)), 0);
  const entregaTxt = selectedDelivery === "oficina" ? "Retiro por oficina" : selectedDelivery === "coordinar" ? "Envío a coordinar" : `Envío a ${selectedDelivery}`;

  if (accepted || quote.status === "accepted" || quote.status === "converted") {
    return <AcceptedView quote={quote} accepted={accepted} cn={cn} settings={settings} products={products} client={clientData}/>;
  }
  if (rejected || quote.status === "rejected") return <RejectedView cn={cn} code={quote.request_code}/>;

  const vm = {
    quote, settings, esCliente, vencida, products, cn, nombrePila, channels, domicilio, selChannel, channelTotal, deliveryCost, finalTotal,
    landedSubtotal, landedUnit, plan, totalQty, maxLead, entregaTxt,
    selectedChannel, setSelectedChannel, selectedDelivery, setSelectedDelivery,
    accepting, errAccion, openConfirm, onReject: () => setShowReject(true),
  };
  return <>
    {isMobile ? <VistaCelu {...vm}/> : <VistaCompu {...vm}/>}
    {showReject && <RechazoModal onCancel={() => setShowReject(false)} onConfirm={reject} enviando={accepting} err={errAccion}/>}
    {showConfirm && <ConfirmarModal onCancel={() => setShowConfirm(false)} onConfirm={accept} selChannel={selChannel} finalTotal={finalTotal} entregaTxt={entregaTxt} plan={plan} isMobile={isMobile}/>}
  </>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Paleta del link (20/10/2026): fondo claro, tarjetas blancas, navy y dorado de Argencargo.
// ──────────────────────────────────────────────────────────────────────────────
const K = { navy: "#0A1628", navy2: "#132340", gold: "#B8956A", goldHi: "#E8D098", goldDeep: "#8b6f4a", goldBg: "#fbf6ec", bg: "#f3f4f7", card: "#ffffff", line: "#e6e9ef", lineHi: "#d2d8e2", txt: "#0f1d33", sub: "#4b5a70", mute: "#8593a8", green: "#15803d", greenBg: "#ecfdf3", red: "#b42318", redBg: "#fef2f2", blue: "#1d4ed8", blueBg: "#eff6ff" };
const FONT = "'Inter','Helvetica Neue',Arial,sans-serif";
const MONO = "'JetBrains Mono','SF Mono',ui-monospace,monospace";
const GOLD_GRAD = "linear-gradient(135deg,#B8956A 0%,#E8D098 50%,#B8956A 100%)";
const CSS_LINK = `
@keyframes cotIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.cot-in{animation:cotIn .35s ease both}
.cot-snap{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 16px 14px;margin:0 -16px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.cot-snap::-webkit-scrollbar{display:none}
.cot-snap>*{scroll-snap-align:center;flex:0 0 82%}
.cot-opt{transition:border-color .15s,box-shadow .15s,transform .15s}
.cot-opt:active{transform:scale(.985)}
.cot-opt:hover{border-color:#B8956A!important}
details.cot-det>summary{list-style:none;cursor:pointer}
details.cot-det>summary::-webkit-details-marker{display:none}
`;
const Radio = ({ on }) => <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${on ? K.gold : K.lineHi}`, flexShrink: 0, background: on ? K.gold : "#fff", boxShadow: on ? "inset 0 0 0 4px #fff" : "none", transition: "all .15s" }}/>;
const Lbl = ({ children, c }) => <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: c || K.mute, textTransform: "uppercase", margin: "0 0 10px" }}>{children}</p>;
const Card = ({ children, style = {}, pad = 20 }) => <section className="cot-in" style={{ background: K.card, border: `1px solid ${K.line}`, borderRadius: 18, padding: pad, boxShadow: "0 1px 2px rgba(10,22,40,0.04), 0 10px 30px rgba(10,22,40,0.06)", ...style }}>{children}</section>;
const Terminos = ({ texto, compacto }) => texto ? <details className="cot-det" style={{ padding: compacto ? "12px 16px" : "14px 18px", background: K.card, border: `1px solid ${K.line}`, borderRadius: 14, fontSize: 12.5, color: K.sub }}>
  <summary style={{ fontWeight: 800, color: K.txt, fontSize: 12.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>Términos y condiciones <span style={{ color: K.mute }}>›</span></summary>
  <div style={{ paddingTop: 10, marginTop: 10, borderTop: `1px solid ${K.line}`, lineHeight: 1.6 }}>{String(texto).split("\n").map((l, i) => {
    const t = l.trim();
    if (!t) return <div key={i} style={{ height: 6 }} />;
    if (/:$/.test(t) && !t.startsWith("-")) return <p key={i} style={{ margin: "8px 0 2px", fontWeight: 800, color: K.txt, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.replace(/:$/, "")}</p>;
    if (t.startsWith("-")) return <p key={i} style={{ margin: "2px 0", paddingLeft: 12, position: "relative" }}><span style={{ position: "absolute", left: 0, color: K.gold }}>•</span>{t.replace(/^-\s*/, "")}</p>;
    return <p key={i} style={{ margin: "2px 0" }}>{t}</p>;
  })}</div>
</details> : null;
const fotoDe = (p) => (Array.isArray(p.photo_urls) && p.photo_urls[0]) || p.photo_url || null;
const Foto = ({ p, size, radius = 12 }) => { const u = fotoDe(p); return u
  ? <img src={u} alt={p.description || ""} style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", flexShrink: 0, border: `1px solid ${K.line}`, background: K.bg }} onError={e => { e.currentTarget.style.visibility = "hidden"; }}/>
  : <div style={{ width: size, height: size, borderRadius: radius, background: "linear-gradient(135deg,#f6f0e4,#eadfc7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, flexShrink: 0, border: `1px solid ${K.line}` }}>📦</div>; };
const Aviso = ({ vencida, esCliente, cn }) => vencida
  ? <div style={{ padding: "14px 16px", background: K.redBg, border: "1px solid #f3c4c4", borderRadius: 14, textAlign: "center" }}><p style={{ fontSize: 13.5, fontWeight: 800, color: K.red, margin: 0 }}>Esta cotización venció</p><p style={{ fontSize: 12, color: "#7a2e2e", margin: "4px 0 0", lineHeight: 1.5 }}>Los precios pueden haber cambiado. Escribinos y te mandamos una actualizada.</p></div>
  : !esCliente ? <div style={{ padding: "12px 14px", background: K.blueBg, border: "1px solid #c9d8f5", borderRadius: 14, textAlign: "center" }}><p style={{ fontSize: 12.5, fontWeight: 800, color: K.blue, margin: 0 }}>Vista previa</p><p style={{ fontSize: 11.5, color: "#334155", margin: "3px 0 0" }}>Solo {cn} puede aceptarla o rechazarla desde su cuenta.</p></div>
  : null;
const BotonAceptar = ({ accepting, onClick, label, style = {} }) => <button onClick={onClick} disabled={accepting} style={{ width: "100%", padding: "15px 22px", background: accepting ? "#64748b" : K.navy, color: "#fff", border: "none", borderRadius: 14, fontSize: 14.5, fontWeight: 800, cursor: accepting ? "wait" : "pointer", letterSpacing: "0.02em", fontFamily: "inherit", boxShadow: "0 10px 24px rgba(10,22,40,0.25)", ...style }}>{accepting ? "Procesando…" : label || "Aceptar y comenzar producción"}</button>;

// ──────────────────────────────────────────────────────────────────────────────
// VISTA PARA COMPUTADORA: dos columnas, resumen fijo a la derecha.
// ──────────────────────────────────────────────────────────────────────────────
function VistaCompu(v) {
  const { quote, settings, products, channels, domicilio, selChannel, finalTotal, deliveryCost, plan, maxLead } = v;
  return <div style={{ minHeight: "100vh", background: K.bg, fontFamily: FONT, color: K.txt }}>
    <style>{CSS_LINK}</style>
    <header style={{ background: K.navy, color: "#fff" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <img src={LOGO} alt="Argencargo" style={{ height: 40, width: "auto" }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 12.5 }}>
          <span style={{ color: "rgba(255,255,255,0.55)" }}>Cotización · Gestión Integral</span>
          <span style={{ fontFamily: MONO, fontWeight: 700, color: K.goldHi, fontSize: 15 }}>{quote.request_code}</span>
          {quote.expires_at && <span style={{ padding: "5px 11px", borderRadius: 999, background: "rgba(232,208,152,0.14)", color: K.goldHi, fontWeight: 700, fontSize: 11.5 }}>Válida hasta el {formatDate(quote.expires_at)}</span>}
        </div>
      </div>
      <div style={{ height: 4, background: GOLD_GRAD }}/>
    </header>

    <main style={{ maxWidth: 1160, margin: "0 auto", padding: "34px 28px 60px" }}>
      <div className="cot-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 26, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 800, color: K.goldDeep, textTransform: "uppercase", letterSpacing: "0.16em", margin: "0 0 8px" }}>Tu cotización</p>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.1 }}>Hola {v.nombrePila || v.cn}, esto es lo que cuesta tu importación</h1>
          <p style={{ fontSize: 15, color: K.sub, margin: "10px 0 0", lineHeight: 1.6, maxWidth: 620 }}>Precio final en dólares con la mercadería <strong style={{ color: K.txt }}>puesta en Buenos Aires</strong>: flete, aduana, impuestos y nuestra gestión. Elegí cómo viaja y dónde la recibís; el total se actualiza solo.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 22, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* Servicio */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div><Lbl>1 · Cómo viaja</Lbl><h2 style={{ fontSize: 19, fontWeight: 800, margin: "-4px 0 14px", letterSpacing: "-0.01em" }}>Elegí el servicio</h2></div>
              {maxLead > 0 && <span style={{ fontSize: 12, color: K.mute }}>Producción: hasta {maxLead} días hábiles</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(channels.length, 3)},minmax(0,1fr))`, gap: 12 }}>
              {channels.map((c, i) => { const on = v.selectedChannel === c.key; const rec = i === 0 && channels.length > 1; return <button key={c.key} type="button" className="cot-opt" onClick={() => v.setSelectedChannel(c.key)} style={{ textAlign: "left", padding: "18px 18px 16px", borderRadius: 16, border: `2px solid ${on ? K.gold : K.line}`, background: on ? K.goldBg : "#fff", cursor: "pointer", fontFamily: "inherit", boxShadow: on ? "0 8px 24px rgba(184,149,106,0.18)" : "none", position: "relative" }}>
                {rec && <span style={{ position: "absolute", top: -10, left: 14, fontSize: 9.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>Más conveniente</span>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}><Radio on={on}/><span style={{ fontSize: 22 }}>{c.key.startsWith("aereo") ? "✈️" : "🚢"}</span></div>
                <p style={{ fontSize: 15, fontWeight: 800, margin: 0, color: K.txt, lineHeight: 1.25 }}>{c.name}</p>
                <p style={{ fontSize: 12, color: K.sub, margin: "4px 0 12px" }}>{channelTransitText(c)} de viaje</p>
                <p style={{ fontSize: 24, fontWeight: 900, margin: 0, color: on ? K.goldDeep : K.txt, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(c.total)}</p>
                <p style={{ fontSize: 11, color: K.mute, margin: "2px 0 0" }}>{totalDaysText(c, maxLead)}</p>
              </button>; })}
            </div>
          </Card>

          {/* Entrega */}
          <Card>
            <Lbl>2 · Dónde la recibís</Lbl>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: "-4px 0 14px", letterSpacing: "-0.01em" }}>Entrega</h2>
            <div style={{ display: "grid", gridTemplateColumns: domicilio ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
              {[
                { k: "oficina", t: "Retiro por oficina", m: `${settings?.office_address || ""} · ${settings?.office_locality || ""}`, m2: settings?.office_hours || "", p: "Sin costo" },
                domicilio ? { k: domicilio.zona, t: `A domicilio · ${domicilio.zona}`, m: "Coordinamos día y horario", m2: "", p: `+ ${fmtUSD(domicilio.costo)}` } : null,
                { k: "coordinar", t: domicilio ? "Otra localidad" : "Envío a domicilio", m: "Te pasamos costo y plazo", m2: "", p: "A coordinar" },
              ].filter(Boolean).map(o => { const on = v.selectedDelivery === o.k; return <button key={o.k} type="button" className="cot-opt" onClick={() => v.setSelectedDelivery(o.k)} style={{ textAlign: "left", padding: "16px 16px 14px", borderRadius: 16, border: `2px solid ${on ? K.gold : K.line}`, background: on ? K.goldBg : "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}><Radio on={on}/><span style={{ fontSize: 14, fontWeight: 800, color: K.txt }}>{o.t}</span></div>
                <p style={{ fontSize: 12, color: K.sub, margin: 0, lineHeight: 1.45 }}>{o.m}{o.m2 ? <><br/>{o.m2}</> : null}</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: on ? K.goldDeep : K.txt, margin: "10px 0 0" }}>{o.p}</p>
              </button>; })}
            </div>
          </Card>

          {/* Productos */}
          <Card>
            <Lbl>3 · Qué vas a recibir</Lbl>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: "-4px 0 4px", letterSpacing: "-0.01em" }}>Productos</h2>
            <p style={{ fontSize: 12.5, color: K.mute, margin: "0 0 10px" }}>{v.totalQty} unidades · {products.length} {products.length === 1 ? "producto" : "productos"} · precios con {selChannel?.name || "el servicio elegido"}{deliveryCost > 0 ? " y envío" : ""}</p>
            {products.map((p, i) => <div key={p.id || i} style={{ display: "flex", gap: 16, alignItems: "center", padding: "14px 0", borderTop: `1px solid ${K.line}` }}>
              <Foto p={p} size={72}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, margin: 0, lineHeight: 1.35, wordBreak: "break-word" }}>{p.description}</p>
                <p style={{ fontSize: 12.5, color: K.sub, margin: "4px 0 0" }}>{p.quantity} unidades{p.lead_time_days > 0 ? ` · producción ${p.lead_time_days} días` : ""}</p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: 17, fontWeight: 800, margin: 0, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{fmtUSD2(v.landedUnit(p))} <span style={{ fontSize: 11, fontWeight: 600, color: K.mute }}>c/u</span></p>
                <p style={{ fontSize: 12, color: K.mute, margin: "3px 0 0", fontVariantNumeric: "tabular-nums" }}>subtotal {fmtUSD2(v.landedSubtotal(p))}</p>
              </div>
            </div>)}
          </Card>

          {/* Tiempos */}
          <Card>
            <Lbl>4 · Cuándo llega</Lbl>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, position: "relative" }}>
              {[
                ["Producción", maxLead > 0 ? `Hasta ${maxLead} días hábiles` : "Según producto", "Arranca con el primer pago"],
                ["Viaje y arribo", selChannel ? channelTransitText(selChannel) : "—", selChannel?.name || ""],
                ["Entrega", selChannel ? totalDaysText(selChannel, maxLead) : "—", v.entregaTxt],
              ].map(([t, m, m2], i) => <div key={t} style={{ padding: "0 14px 0 0", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: K.navy, color: K.goldHi, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  {i < 2 && <span style={{ flex: 1, height: 2, background: K.line }}/>}
                </div>
                <p style={{ fontSize: 13.5, fontWeight: 800, margin: 0 }}>{t}</p>
                <p style={{ fontSize: 12.5, color: K.txt, margin: "3px 0 0" }}>{m}</p>
                <p style={{ fontSize: 11.5, color: K.mute, margin: "2px 0 0" }}>{m2}</p>
              </div>)}
            </div>
          </Card>

          <Terminos texto={settings?.terms_and_conditions}/>
        </div>

        {/* Resumen fijo */}
        <aside style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <Card pad={0} style={{ overflow: "hidden" }}>
            <div style={{ padding: "20px 22px 18px", background: K.navy, color: "#fff" }}>
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(232,208,152,0.8)", margin: 0 }}>Total puesto en Buenos Aires</p>
              <p style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-0.03em", margin: "6px 0 0", color: "#fff", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{fmtUSD(finalTotal)}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "8px 0 0" }}>{selChannel?.name || "—"} · {v.entregaTxt}</p>
            </div>
            <div style={{ padding: "16px 22px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", color: K.sub }}><span>{selChannel?.name || "Servicio"}</span><strong style={{ color: K.txt, fontVariantNumeric: "tabular-nums" }}>{fmtUSD(v.channelTotal)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", color: K.sub, borderBottom: `1px solid ${K.line}` }}><span>{v.entregaTxt}</span><strong style={{ color: K.txt, fontVariantNumeric: "tabular-nums" }}>{deliveryCost > 0 ? fmtUSD(deliveryCost) : v.selectedDelivery === "coordinar" ? "a coordinar" : "incluido"}</strong></div>
              {plan.length > 0 && <div style={{ marginTop: 14 }}>
                <Lbl>Plan de pagos</Lbl>
                {plan.map((st, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: i ? `1px solid ${K.line}` : "none" }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: i === 0 ? GOLD_GRAD : K.bg, color: i === 0 ? K.navy : K.sub, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{st.label}</p><p style={{ fontSize: 11.5, color: K.mute, margin: "1px 0 0" }}>{st.pct}% del total</p></div>
                  <strong style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", color: i === 0 ? K.goldDeep : K.txt }}>{fmtUSD(Math.round(finalTotal * Number(st.pct) / 100))}</strong>
                </div>)}
              </div>}
              <div style={{ marginTop: 16 }}>
                <Aviso vencida={v.vencida} esCliente={v.esCliente} cn={v.cn}/>
                {!v.vencida && v.esCliente && <>
                  <BotonAceptar accepting={v.accepting} onClick={v.openConfirm}/>
                  <button onClick={v.onReject} disabled={v.accepting} style={{ width: "100%", padding: "11px 16px", marginTop: 8, background: "transparent", color: K.mute, border: `1px solid ${K.line}`, borderRadius: 12, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>No me interesa por ahora</button>
                  {v.errAccion && <p style={{ textAlign: "center", fontSize: 12, color: K.red, fontWeight: 600, margin: "8px 0 0" }}>{v.errAccion}</p>}
                </>}
              </div>
            </div>
          </Card>
          <p style={{ fontSize: 12, color: K.mute, textAlign: "center", margin: 0, lineHeight: 1.6 }}>¿Dudas? <strong style={{ color: K.txt }}>{settings?.office_phone || ""}</strong> · info@argencargo.com.ar</p>
        </aside>
      </div>
    </main>
    <footer style={{ background: K.navy, color: "rgba(255,255,255,0.7)", padding: "18px 28px", fontSize: 12 }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span><strong style={{ color: "#fff", letterSpacing: "0.08em" }}>ARGENCARGO</strong> · {settings?.office_address || ""}{settings?.office_locality ? `, ${settings.office_locality}` : ""}</span>
        <span style={{ color: K.goldHi, fontWeight: 700 }}>argencargo.com.ar</span>
      </div>
    </footer>
  </div>;
}

// ──────────────────────────────────────────────────────────────────────────────
// VISTA PARA CELULAR: hecha para el pulgar. Pasos cortos, tarjetas deslizables y el total siempre abajo.
// ──────────────────────────────────────────────────────────────────────────────
function VistaCelu(v) {
  const { quote, settings, products, channels, domicilio, selChannel, finalTotal, deliveryCost, plan, maxLead } = v;
  const [verProductos, setVerProductos] = useState(false);
  const puedeAceptar = !v.vencida && v.esCliente;
  return <div style={{ minHeight: "100vh", background: K.bg, fontFamily: FONT, color: K.txt, paddingBottom: puedeAceptar ? 112 : 24 }}>
    <style>{CSS_LINK}</style>
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: K.navy, color: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <img src={LOGO} alt="Argencargo" style={{ height: 28, width: "auto" }}/>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: MONO, fontWeight: 700, color: K.goldHi, fontSize: 13, margin: 0 }}>{quote.request_code}</p>
          {quote.expires_at && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", margin: "1px 0 0" }}>Válida hasta el {formatDate(quote.expires_at)}</p>}
        </div>
      </div>
      <div style={{ height: 3, background: GOLD_GRAD }}/>
    </header>

    <div style={{ padding: "22px 16px 0" }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: K.goldDeep, textTransform: "uppercase", letterSpacing: "0.16em", margin: "0 0 6px" }}>Tu cotización</p>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.2 }}>Hola {v.nombrePila || v.cn} 👋</h1>
      <p style={{ fontSize: 14, color: K.sub, margin: "8px 0 0", lineHeight: 1.55 }}>Precio final con todo incluido, puesto en Buenos Aires. Elegí cómo viaja y dónde la recibís.</p>
    </div>

    {/* Resumen de la carga */}
    <div style={{ padding: "16px 16px 0" }}>
      <Card pad={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex" }}>{products.slice(0, 3).map((p, i) => <div key={i} style={{ marginLeft: i ? -14 : 0, border: "2px solid #fff", borderRadius: 12 }}><Foto p={p} size={48} radius={10}/></div>)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 800, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{products.length === 1 ? products[0].description : `${products.length} productos`}</p>
            <p style={{ fontSize: 12, color: K.mute, margin: "2px 0 0" }}>{v.totalQty} unidades{maxLead > 0 ? ` · producción ${maxLead} días` : ""}</p>
          </div>
          <button type="button" onClick={() => setVerProductos(x => !x)} style={{ background: K.bg, border: `1px solid ${K.line}`, color: K.txt, fontSize: 12, fontWeight: 700, padding: "8px 12px", borderRadius: 999, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>{verProductos ? "Ocultar" : "Ver detalle"}</button>
        </div>
        {verProductos && <div style={{ marginTop: 12, borderTop: `1px solid ${K.line}` }}>
          {products.map((p, i) => <div key={p.id || i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${K.line}` }}>
            <Foto p={p} size={52} radius={10}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0, lineHeight: 1.3, wordBreak: "break-word" }}>{p.description}</p>
              <p style={{ fontSize: 12, color: K.mute, margin: "3px 0 0" }}>{p.quantity} u. · {fmtUSD2(v.landedUnit(p))} c/u</p>
            </div>
            <strong style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtUSD(v.landedSubtotal(p))}</strong>
          </div>)}
          <p style={{ fontSize: 11.5, color: K.mute, margin: "10px 0 0", lineHeight: 1.5 }}>Precios con {selChannel?.name || "el servicio elegido"}{deliveryCost > 0 ? " y envío" : ""}: incluyen flete, aduana, impuestos y gestión.</p>
        </div>}
      </Card>
    </div>

    {/* Paso 1: servicio (deslizable) */}
    <div style={{ padding: "22px 16px 0" }}>
      <Lbl>1 · Cómo viaja</Lbl>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: "-4px 0 10px", letterSpacing: "-0.01em" }}>Elegí el servicio</h2>
    </div>
    <div style={{ padding: "0 16px" }}>
      <div className="cot-snap">
        {channels.map((c, i) => { const on = v.selectedChannel === c.key; const rec = i === 0 && channels.length > 1; return <button key={c.key} type="button" className="cot-opt" onClick={() => v.setSelectedChannel(c.key)} style={{ textAlign: "left", padding: "18px 16px 16px", borderRadius: 18, border: `2px solid ${on ? K.gold : K.line}`, background: on ? K.goldBg : "#fff", cursor: "pointer", fontFamily: "inherit", boxShadow: on ? "0 10px 26px rgba(184,149,106,0.22)" : "0 1px 2px rgba(10,22,40,0.04)", position: "relative", minHeight: 150 }}>
          {rec && <span style={{ position: "absolute", top: 12, right: 12, fontSize: 9.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase" }}>Más conveniente</span>}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><Radio on={on}/><span style={{ fontSize: 22 }}>{c.key.startsWith("aereo") ? "✈️" : "🚢"}</span></div>
          <p style={{ fontSize: 16, fontWeight: 800, margin: 0, lineHeight: 1.25 }}>{c.name}</p>
          <p style={{ fontSize: 12.5, color: K.sub, margin: "4px 0 12px" }}>{channelTransitText(c)} de viaje</p>
          <p style={{ fontSize: 26, fontWeight: 900, margin: 0, color: on ? K.goldDeep : K.txt, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(c.total)}</p>
          <p style={{ fontSize: 11.5, color: K.mute, margin: "2px 0 0" }}>{totalDaysText(c, maxLead)}</p>
        </button>; })}
      </div>
      {channels.length > 1 && <p style={{ fontSize: 11, color: K.mute, margin: "-6px 0 0", textAlign: "center" }}>Deslizá para ver las {channels.length} opciones</p>}
    </div>

    {/* Paso 2: entrega */}
    <div style={{ padding: "22px 16px 0" }}>
      <Lbl>2 · Dónde la recibís</Lbl>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: "-4px 0 10px", letterSpacing: "-0.01em" }}>Entrega</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { k: "oficina", t: "Retiro por oficina", m: `${settings?.office_locality || "Belgrano, CABA"} · ${settings?.office_hours || ""}`, p: "Sin costo" },
          domicilio ? { k: domicilio.zona, t: `A domicilio · ${domicilio.zona}`, m: "Coordinamos día y horario", p: `+ ${fmtUSD(domicilio.costo)}` } : null,
          { k: "coordinar", t: domicilio ? "Otra localidad" : "Envío a domicilio", m: "Te pasamos costo y plazo", p: "A coordinar" },
        ].filter(Boolean).map(o => { const on = v.selectedDelivery === o.k; return <button key={o.k} type="button" className="cot-opt" onClick={() => v.setSelectedDelivery(o.k)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "14px 14px", borderRadius: 16, border: `2px solid ${on ? K.gold : K.line}`, background: on ? K.goldBg : "#fff", cursor: "pointer", fontFamily: "inherit" }}>
          <Radio on={on}/>
          <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{o.t}</p><p style={{ fontSize: 12, color: K.sub, margin: "2px 0 0", lineHeight: 1.4 }}>{o.m}</p></div>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: on ? K.goldDeep : K.txt, whiteSpace: "nowrap" }}>{o.p}</span>
        </button>; })}
      </div>
    </div>

    {/* Paso 3: pagos */}
    {plan.length > 0 && <div style={{ padding: "22px 16px 0" }}>
      <Lbl>3 · Cómo se paga</Lbl>
      <Card pad={16}>
        {plan.map((st, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${K.line}` : "none" }}>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: i === 0 ? GOLD_GRAD : K.bg, color: i === 0 ? K.navy : K.sub, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{st.label}</p><p style={{ fontSize: 11.5, color: K.mute, margin: "1px 0 0" }}>{st.pct}% del total</p></div>
          <strong style={{ fontSize: 15, fontVariantNumeric: "tabular-nums", color: i === 0 ? K.goldDeep : K.txt }}>{fmtUSD(Math.round(finalTotal * Number(st.pct) / 100))}</strong>
        </div>)}
      </Card>
    </div>}

    {/* Paso 4: tiempos */}
    <div style={{ padding: "22px 16px 0" }}>
      <Lbl>4 · Cuándo llega</Lbl>
      <Card pad={16}>
        <div style={{ position: "relative", paddingLeft: 36 }}>
          <div style={{ position: "absolute", left: 13, top: 14, bottom: 14, width: 2, background: K.line }}/>
          {[
            ["Producción", maxLead > 0 ? `Hasta ${maxLead} días hábiles` : "Según producto"],
            ["Viaje y arribo", selChannel ? `${channelTransitText(selChannel)} · ${selChannel.name}` : "—"],
            ["Entrega", selChannel ? `${totalDaysText(selChannel, maxLead)} · ${v.entregaTxt}` : "—"],
          ].map(([t, m], i) => <div key={t} style={{ position: "relative", padding: "6px 0" }}>
            <span style={{ position: "absolute", left: -36, top: 6, width: 28, height: 28, borderRadius: "50%", background: K.navy, color: K.goldHi, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
            <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{t}</p>
            <p style={{ fontSize: 12.5, color: K.sub, margin: "2px 0 0", lineHeight: 1.45 }}>{m}</p>
          </div>)}
        </div>
      </Card>
    </div>

    <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
      <Terminos texto={settings?.terms_and_conditions} compacto/>
      <Aviso vencida={v.vencida} esCliente={v.esCliente} cn={v.cn}/>
      {puedeAceptar && <button onClick={v.onReject} disabled={v.accepting} style={{ width: "100%", padding: "12px 16px", background: "transparent", color: K.mute, border: `1px solid ${K.line}`, borderRadius: 12, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>No me interesa por ahora</button>}
      {v.errAccion && <p style={{ textAlign: "center", fontSize: 12, color: K.red, fontWeight: 600, margin: 0 }}>{v.errAccion}</p>}
      <p style={{ fontSize: 12, color: K.mute, textAlign: "center", margin: "4px 0 0", lineHeight: 1.6 }}>¿Dudas? <strong style={{ color: K.txt }}>{settings?.office_phone || ""}</strong><br/>info@argencargo.com.ar</p>
    </div>

    {/* Total fijo abajo */}
    {puedeAceptar && <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", background: "rgba(255,255,255,0.96)", backdropFilter: "blur(14px)", borderTop: `1px solid ${K.line}`, boxShadow: "0 -10px 30px rgba(10,22,40,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: K.mute, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>Total</p>
          <p style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{fmtUSD(finalTotal)}</p>
          <p style={{ fontSize: 11, color: K.mute, margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selChannel?.name || "—"} · {v.entregaTxt}</p>
        </div>
        <BotonAceptar accepting={v.accepting} onClick={v.openConfirm} label="Aceptar" style={{ width: "auto", padding: "14px 24px", borderRadius: 14 }}/>
      </div>
    </div>}
  </div>;
}

function ConfirmarModal({ onCancel, onConfirm, selChannel, finalTotal, entregaTxt, plan, isMobile }) {
  const primero = plan?.[0];
  return <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(8,12,24,0.7)", backdropFilter: "blur(10px)", zIndex: 99999, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, fontFamily: FONT }}>
    <div onClick={e => e.stopPropagation()} style={{ maxWidth: isMobile ? "100%" : 480, width: "100%", background: "#fff", borderRadius: isMobile ? "22px 22px 0 0" : 20, padding: isMobile ? "24px 20px calc(22px + env(safe-area-inset-bottom))" : "28px 28px 22px", boxShadow: "0 30px 80px rgba(0,0,0,0.45)", color: K.txt }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: GOLD_GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: K.navy }}>✓</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>Confirmar aceptación</h2>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.55, color: K.sub }}>Al confirmar, un asesor revisa tu pedido y te pasa las instrucciones del primer pago para arrancar la producción.</p>
      <div style={{ padding: "14px 16px", background: K.goldBg, border: `1px solid #ead9b8`, borderRadius: 14, marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: K.goldDeep, margin: 0, textTransform: "uppercase", letterSpacing: "0.1em" }}>Lo que elegiste</p>
        <p style={{ fontSize: 15, fontWeight: 800, margin: "4px 0 0" }}>{selChannel?.name || "—"} · {entregaTxt}</p>
        <p style={{ fontSize: 22, fontWeight: 900, color: K.txt, margin: "4px 0 0", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmtUSD(finalTotal)}</p>
        {primero && <p style={{ fontSize: 12.5, color: K.sub, margin: "6px 0 0" }}>Primer pago: <strong style={{ color: K.txt }}>{fmtUSD(Math.round(finalTotal * Number(primero.pct) / 100))}</strong> ({primero.pct}%) · {primero.label}</p>}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "13px 20px", background: "transparent", color: K.txt, border: `1.5px solid ${K.lineHi}`, borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
        <button onClick={onConfirm} style={{ flex: 1.5, padding: "13px 20px", background: K.navy, color: "#fff", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Confirmar y aceptar</button>
      </div>
    </div>
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
  return <div style={{ minHeight: "100vh", background: K.bg, padding: "24px 16px 40px", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: FONT, color: K.txt }}>
    <style>{CSS_LINK}</style>
    <img src={LOGO} alt="Argencargo" style={{ height: 34, width: "auto", marginBottom: 18, filter: "invert(1) brightness(0.2)" }}/>
    <div className="cot-in" style={{ maxWidth: 640, width: "100%", padding: "clamp(22px,4vw,36px)", background: "#fff", color: K.txt, borderRadius: 20, border: `1px solid ${K.line}`, boxShadow: "0 10px 30px rgba(10,22,40,0.08)", boxSizing: "border-box" }}>
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
