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
// Estética del link (20/10/2026, v2): el formato anterior que a Bautista le gustaba — documento crema
// sobre fondo navy, cabecera navy con la línea dorada — con mejor jerarquía, tarjetas más limpias y una
// versión propia para el celular (misma identidad, pasos apilados y el total fijo abajo).
// ──────────────────────────────────────────────────────────────────────────────
const K = { navy: "#0A1628", navyBg: "radial-gradient(900px 500px at 70% -10%, rgba(184,149,106,0.18), transparent 60%), #0e1829", cream: "#faf8f3", card: "#ffffff", line: "#ebe6db", lineHi: "#d9d1c0", txt: "#1a1f2e", sub: "#5b6372", mute: "#8b919c", gold: "#B8956A", goldHi: "#E8D098", goldDeep: "#8b6f4a", goldBg: "#fdf6e8", goldBg2: "#f7efdf", green: "#15803d", greenBg: "#ecfdf3", red: "#b42318", redBg: "#fff4f4", blue: "#1d4ed8", blueBg: "#eef4ff" };
const FONT = "'Inter','Helvetica Neue',Arial,sans-serif";
const MONO = "'JetBrains Mono','SF Mono',ui-monospace,monospace";
const GOLD_GRAD = "linear-gradient(135deg,#B8956A 0%,#E8D098 50%,#B8956A 100%)";
const CSS_LINK = `
.cot-opt{transition:border-color .15s,box-shadow .15s,background .15s}
.cot-opt:hover{border-color:#B8956A!important}
details.cot-det>summary{list-style:none;cursor:pointer}
details.cot-det>summary::-webkit-details-marker{display:none}
`;
const Radio = ({ on }) => <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${on ? K.gold : K.lineHi}`, flexShrink: 0, background: on ? K.gold : "#fff", boxShadow: on ? "inset 0 0 0 4px #fff" : "none", transition: "all .15s" }}/>;
const SecT = ({ children, right }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 10 }}><p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.16em", color: K.goldDeep, textTransform: "uppercase", margin: 0 }}>{children}</p>{right}</div>;
const Card = ({ children, style = {}, pad = 18 }) => <section className="cot-in" style={{ background: K.card, border: `1px solid ${K.line}`, borderRadius: 14, padding: pad, boxShadow: "0 1px 2px rgba(26,31,46,0.04)", ...style }}>{children}</section>;
const Terminos = ({ texto }) => texto ? <details className="cot-det" style={{ padding: "12px 16px", background: K.card, border: `1px solid ${K.line}`, borderRadius: 12, fontSize: 12.5, color: K.sub }}>
  <summary style={{ fontWeight: 800, color: K.txt, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }}>Términos y condiciones <span style={{ color: K.mute, fontSize: 14 }}>›</span></summary>
  <div style={{ paddingTop: 10, marginTop: 10, borderTop: `1px solid ${K.line}`, lineHeight: 1.6 }}>{String(texto).split("\n").map((l, i) => {
    const t = l.trim();
    if (!t) return <div key={i} style={{ height: 6 }} />;
    if (/:$/.test(t) && !t.startsWith("-")) return <p key={i} style={{ margin: "8px 0 2px", fontWeight: 800, color: K.txt, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.replace(/:$/, "")}</p>;
    if (t.startsWith("-")) return <p key={i} style={{ margin: "2px 0", paddingLeft: 12, position: "relative" }}><span style={{ position: "absolute", left: 0, color: K.gold }}>•</span>{t.replace(/^-\s*/, "")}</p>;
    return <p key={i} style={{ margin: "2px 0" }}>{t}</p>;
  })}</div>
</details> : null;
const fotoDe = (p) => (Array.isArray(p.photo_urls) && p.photo_urls[0]) || p.photo_url || null;
const Foto = ({ p, size, radius = 10 }) => { const u = fotoDe(p); return u
  ? <img src={u} alt={p.description || ""} style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", flexShrink: 0, border: `1px solid ${K.lineHi}`, background: K.goldBg2 }} onError={e => { e.currentTarget.style.visibility = "hidden"; }}/>
  : <div style={{ width: size, height: size, borderRadius: radius, background: "linear-gradient(135deg,#f3eadb,#e7d8b8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.42), flexShrink: 0, border: `1px solid ${K.lineHi}` }}>📦</div>; };
const Aviso = ({ vencida, esCliente, cn, sinPrecios }) => sinPrecios
  ? <div style={{ padding: "14px 16px", background: K.goldBg, border: `1px solid ${K.lineHi}`, borderRadius: 12, textAlign: "center" }}><p style={{ fontSize: 13.5, fontWeight: 800, color: K.goldDeep, margin: 0 }}>Cotización en preparación</p><p style={{ fontSize: 12, color: K.sub, margin: "4px 0 0", lineHeight: 1.5 }}>Todavía no tiene precios cargados.</p></div>
  : vencida
  ? <div style={{ padding: "14px 16px", background: K.redBg, border: "1px solid #f3c4c4", borderRadius: 12, textAlign: "center" }}><p style={{ fontSize: 13.5, fontWeight: 800, color: K.red, margin: 0 }}>Esta cotización venció</p><p style={{ fontSize: 12, color: "#7a2e2e", margin: "4px 0 0", lineHeight: 1.5 }}>Los precios pueden haber cambiado. Escribinos y te mandamos una actualizada.</p></div>
  : !esCliente ? <div style={{ padding: "12px 14px", background: K.blueBg, border: "1px solid #c9d8f5", borderRadius: 12, textAlign: "center" }}><p style={{ fontSize: 12.5, fontWeight: 800, color: K.blue, margin: 0 }}>Vista previa</p><p style={{ fontSize: 11.5, color: "#334155", margin: "3px 0 0" }}>Solo {cn} puede aceptarla o rechazarla desde su cuenta.</p></div>
  : null;
const BotonAceptar = ({ accepting, onClick, label, style = {} }) => <button onClick={onClick} disabled={accepting} style={{ width: "100%", padding: "15px 22px", background: accepting ? "#555" : K.navy, color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: accepting ? "wait" : "pointer", letterSpacing: "0.03em", fontFamily: "inherit", boxShadow: "0 8px 22px rgba(10,22,40,0.28)", ...style }}>{accepting ? "Procesando…" : label || "Aceptar y comenzar producción"}</button>;
const BotonNo = ({ onClick, disabled }) => <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "11px 16px", marginTop: 8, background: "transparent", color: K.mute, border: `1px solid ${K.line}`, borderRadius: 12, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>No me interesa por ahora</button>;

const entregaOpciones = (v) => [
  { k: "oficina", t: "Retiro por oficina", m: `${v.settings?.office_address || "Virrey Loreto 2428"} · ${v.settings?.office_locality || "Belgrano, CABA"}`, m2: v.settings?.office_hours || "", p: "Incluido" },
  v.domicilio ? { k: v.domicilio.zona, t: `Envío a domicilio · ${v.domicilio.zona}`, m: "Coordinamos día y horario", m2: "", p: `+ ${fmtUSD(v.domicilio.costo)}` } : null,
  { k: "coordinar", t: v.domicilio ? "Envío a otra localidad" : "Envío a domicilio", m: "Te pasamos costo y plazo según la localidad", m2: "", p: "A coordinar" },
].filter(Boolean);

function FilaServicio({ c, on, rec, maxLead, onClick, grande }) {
  return <button type="button" className="cot-opt" onClick={onClick} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: grande ? "14px 14px" : "12px 14px", borderRadius: 12, border: `1.5px solid ${on ? K.gold : K.line}`, background: on ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : K.cream, boxShadow: on ? "0 4px 14px rgba(184,149,106,0.2)" : "none", cursor: "pointer", fontFamily: "inherit" }}>
    <Radio on={on}/>
    <span style={{ fontSize: 20, width: 26, textAlign: "center" }}>{c.key.startsWith("aereo") ? "✈️" : "🚢"}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: grande ? 14.5 : 13.5, fontWeight: 800, color: K.txt, margin: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{c.name}{rec && <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", letterSpacing: "0.08em", textTransform: "uppercase" }}>Recomendado</span>}</p>
      <p style={{ fontSize: 11.5, color: K.sub, margin: "2px 0 0" }}>{grande ? channelTimeText(c, maxLead) : `${channelTransitText(c)} de viaje`}</p>
    </div>
    <p style={{ fontSize: grande ? 18 : 16, fontWeight: 800, color: on ? K.goldDeep : K.txt, margin: 0, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{fmtUSD(c.total)}</p>
  </button>;
}
function FilaEntrega({ o, on, onClick }) {
  return <button type="button" className="cot-opt" onClick={onClick} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${on ? K.gold : K.line}`, background: on ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : K.cream, boxShadow: on ? "0 4px 14px rgba(184,149,106,0.2)" : "none", cursor: "pointer", fontFamily: "inherit" }}>
    <Radio on={on}/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 13.5, fontWeight: 800, color: K.txt, margin: 0 }}>{o.t}</p>
      <p style={{ fontSize: 11.5, color: K.sub, margin: "2px 0 0", lineHeight: 1.4 }}>{o.m}{o.m2 ? ` · ${o.m2}` : ""}</p>
    </div>
    <p style={{ fontSize: 14, fontWeight: 800, color: on ? K.goldDeep : K.txt, margin: 0, whiteSpace: "nowrap" }}>{o.p}</p>
  </button>;
}
const PlanLista = ({ plan, finalTotal }) => <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
  {plan.map((st, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: i === 0 ? K.goldBg : K.cream, border: `1px solid ${i === 0 ? K.lineHi : K.line}`, borderRadius: 10 }}>
    <span style={{ width: 26, height: 26, borderRadius: "50%", background: i === 0 ? GOLD_GRAD : "#e5e1d6", color: i === 0 ? K.navy : K.sub, fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
    <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 13, fontWeight: 800, color: K.txt, margin: 0 }}>{st.label}</p><p style={{ fontSize: 11, color: K.sub, margin: "1px 0 0" }}>{st.pct}% del total</p></div>
    <strong style={{ fontSize: 14.5, color: i === 0 ? K.goldDeep : K.txt, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtUSD(Math.round(finalTotal * Number(st.pct) / 100))}</strong>
  </div>)}
</div>;
const PlanGrid = ({ plan, finalTotal, cols }) => <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols || plan.length},minmax(0,1fr))`, gap: 8 }}>
  {plan.map((st, i) => <div key={i} style={{ padding: "12px 12px", background: i === 0 ? K.goldBg : K.cream, border: `1px solid ${i === 0 ? K.lineHi : K.line}`, borderRadius: 10 }}>
    <p style={{ fontSize: 20, fontWeight: 800, color: K.goldDeep, letterSpacing: "-0.02em", margin: 0 }}>{st.pct}%</p>
    <p style={{ fontSize: 11, color: K.sub, margin: "2px 0 8px", lineHeight: 1.3 }}>{st.label}</p>
    <p style={{ fontSize: 13.5, fontWeight: 800, color: K.txt, fontVariantNumeric: "tabular-nums", margin: 0, paddingTop: 8, borderTop: `1px solid ${K.line}` }}>{fmtUSD(Math.round(finalTotal * Number(st.pct) / 100))}</p>
  </div>)}
</div>;
const Tiempos = ({ v }) => <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
  {[["Producción", v.maxLead > 0 ? `Hasta ${v.maxLead} días hábiles · arranca con el primer pago` : "Según producto"], ["Envío y arribo", v.selChannel ? `${channelTransitText(v.selChannel)} · ${v.selChannel.name}` : "—"], ["Entrega final", v.selChannel ? `${totalDaysText(v.selChannel, v.maxLead)} · ${v.entregaTxt}` : "—"]].map(([n, m], i) => <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: K.cream, border: `1px solid ${K.line}`, borderRadius: 10 }}>
    <span style={{ width: 24, height: 24, borderRadius: "50%", background: K.navy, color: K.goldHi, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
    <div style={{ minWidth: 0 }}><p style={{ fontSize: 12.5, fontWeight: 800, color: K.txt, margin: 0 }}>{n}</p><p style={{ fontSize: 11.5, color: K.sub, margin: "1px 0 0" }}>{m}</p></div>
  </div>)}
</div>;
const Cabecera = ({ v, movil }) => <div style={{ background: K.navy, color: "#fff", padding: movil ? "14px 16px 12px" : "22px 30px 18px", position: "relative" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
    <img src={LOGO} alt="Argencargo" style={{ height: movil ? 30 : 44, width: "auto" }}/>
    <div style={{ textAlign: "right" }}>
      <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(232,208,152,0.85)", textTransform: "uppercase", margin: 0 }}>Cotización · Gestión Integral</p>
      <p style={{ fontFamily: MONO, fontSize: movil ? 14 : 17, fontWeight: 700, color: K.goldHi, letterSpacing: "0.04em", margin: "2px 0 0" }}>{v.quote.request_code || "—"}</p>
      {v.quote.expires_at && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", margin: "1px 0 0" }}>Válida hasta el {formatDate(v.quote.expires_at)}</p>}
    </div>
  </div>
  {!movil && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, flexWrap: "wrap", paddingTop: 12, marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
    <div><p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(232,208,152,0.65)", textTransform: "uppercase", margin: "0 0 3px" }}>Cliente</p><p style={{ fontSize: 19, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", margin: 0 }}>{v.cn}</p></div>
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(232,208,152,0.65)", textTransform: "uppercase", margin: 0 }}>{v.totalQty} unidades · {v.products.length} {v.products.length === 1 ? "producto" : "productos"}</p>
  </div>}
  <div style={{ height: 4, background: GOLD_GRAD, position: "absolute", left: 0, right: 0, bottom: 0 }}/>
</div>;
const Pie = ({ v, movil }) => <div style={{ background: K.navy, color: "#fff", padding: movil ? "14px 16px" : "14px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
  <div>
    <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", margin: "0 0 4px" }}>ARGENCARGO</p>
    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, margin: 0 }}><strong style={{ color: K.goldHi }}>Tel:</strong> {v.settings?.office_phone || ""} · <strong style={{ color: K.goldHi }}>Email:</strong> info@argencargo.com.ar</p>
    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, margin: 0 }}>{v.settings?.office_address || ""}{v.settings?.office_locality ? ` — ${v.settings.office_locality}` : ""}</p>
  </div>
  <p style={{ fontSize: 12.5, fontWeight: 700, color: K.goldHi, letterSpacing: "0.04em", margin: 0 }}>argencargo.com.ar</p>
</div>;

// ── Computadora: el documento de antes (productos + servicio a la izquierda; entrega, total, plan y tiempos a la derecha) ──
function VistaCompu(v) {
  const { settings, products, channels, selChannel, finalTotal, deliveryCost, plan } = v;
  const sinPrecios = channels.length === 0;
  return <div style={{ minHeight: "100vh", background: K.navyBg, padding: "28px 20px 40px", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: FONT, color: K.txt }}>
    <style>{CSS_LINK}</style>
    <div style={{ maxWidth: 1180, width: "100%", background: K.cream, borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 90px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
      <Cabecera v={v}/>
      <div style={{ padding: "24px 30px 28px" }}>
        <div className="cot-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, marginBottom: 18, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: K.txt }}>Hola {v.nombrePila || v.cn}, esta es tu cotización</h1>
            <p style={{ fontSize: 13.5, color: K.sub, margin: "6px 0 0", lineHeight: 1.55, maxWidth: 680 }}>Precio final en dólares con la mercadería <strong style={{ color: K.txt }}>puesta en Buenos Aires</strong>: flete, aduana, impuestos y nuestra gestión. Elegí el servicio y cómo la recibís; el total se actualiza solo.</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 18, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <Card>
              <SecT right={<span style={{ fontSize: 11, color: K.mute }}>{v.totalQty} unidades · {products.length} {products.length === 1 ? "producto" : "productos"}</span>}>Productos</SecT>
              <p style={{ fontSize: 11.5, color: K.sub, margin: "-2px 0 4px", lineHeight: 1.5 }}>Precios puestos en Buenos Aires con <strong style={{ color: K.txt }}>{selChannel?.name || "el servicio elegido"}</strong>{deliveryCost > 0 ? " y envío a domicilio" : ""}.</p>
              {products.map((p, i) => <div key={p.id || i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "12px 0", borderTop: `1px solid ${K.line}` }}>
                <Foto p={p} size={60}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: K.txt, margin: 0, lineHeight: 1.35, wordBreak: "break-word" }}>{p.description}</p>
                  <p style={{ fontSize: 11.5, color: K.sub, margin: "3px 0 0" }}>{p.quantity} unidades{p.lead_time_days > 0 ? <span style={{ color: K.gold, fontWeight: 700 }}> · ⏱ producción {p.lead_time_days} días</span> : null}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: K.txt, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", margin: 0, lineHeight: 1.1 }}>{sinPrecios ? "—" : fmtUSD2(v.landedUnit(p))} <span style={{ fontSize: 10, fontWeight: 600, color: K.mute }}>/ unidad</span></p>
                  <p style={{ fontSize: 10.5, color: K.mute, fontVariantNumeric: "tabular-nums", margin: "3px 0 0" }}>subtotal {sinPrecios ? "—" : fmtUSD2(v.landedSubtotal(p))}</p>
                </div>
              </div>)}
            </Card>
            <Card>
              <SecT>Elegí qué servicio preferís</SecT>
              <p style={{ fontSize: 11.5, color: K.sub, margin: "-2px 0 10px", lineHeight: 1.5 }}>El precio cambia según cómo viaja. Todos incluyen flete internacional, gestión aduanera y entrega final.</p>
              {sinPrecios ? <p style={{ margin: 0, fontSize: 13, color: K.mute }}>Todavía sin precios.</p> : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {channels.map((c, i) => <FilaServicio key={c.key} c={c} on={v.selectedChannel === c.key} rec={i === 0 && channels.length > 1} maxLead={v.maxLead} onClick={() => v.setSelectedChannel(c.key)} grande/>)}
              </div>}
            </Card>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, position: "sticky", top: 20 }}>
            <Card>
              <SecT>¿Cómo querés recibirla?</SecT>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {entregaOpciones(v).map(o => <FilaEntrega key={o.k} o={o} on={v.selectedDelivery === o.k} onClick={() => v.setSelectedDelivery(o.k)}/>)}
              </div>
            </Card>
            <div style={{ padding: "18px 20px", background: GOLD_GRAD, color: K.navy, borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 8px 22px rgba(184,149,106,0.3)", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", margin: 0 }}>Total puesto en Buenos Aires</p>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(10,22,40,0.7)", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selChannel?.name || "—"} · {v.entregaTxt}</p>
              </div>
              <p style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", margin: 0, whiteSpace: "nowrap" }}>{sinPrecios ? "—" : fmtUSD(finalTotal)}</p>
            </div>
            {plan.length > 0 && !sinPrecios && <Card><SecT>Plan de pagos</SecT><PlanGrid plan={plan} finalTotal={finalTotal}/></Card>}
            <Card><SecT>Tiempos estimados</SecT><Tiempos v={v}/></Card>
            <Terminos texto={settings?.terms_and_conditions}/>
            <Aviso vencida={v.vencida} esCliente={v.esCliente} cn={v.cn} sinPrecios={sinPrecios}/>
            {!v.vencida && v.esCliente && !sinPrecios && <div>
              <BotonAceptar accepting={v.accepting} onClick={v.openConfirm}/>
              <BotonNo onClick={v.onReject} disabled={v.accepting}/>
              {v.errAccion && <p style={{ textAlign: "center", fontSize: 12, color: K.red, fontWeight: 600, margin: "8px 0 0" }}>{v.errAccion}</p>}
            </div>}
          </div>
        </div>
      </div>
      <Pie v={v}/>
    </div>
  </div>;
}

// ── Celular: misma identidad, pensado para el pulgar: pasos apilados a todo el ancho y el total fijo abajo ──
function VistaCelu(v) {
  const { settings, products, channels, selChannel, finalTotal, deliveryCost, plan } = v;
  const sinPrecios = channels.length === 0;
  const puedeAceptar = !v.vencida && v.esCliente && !sinPrecios;
  const [verTodos, setVerTodos] = useState(false);
  const lista = verTodos ? products : products.slice(0, 3);
  return <div style={{ minHeight: "100vh", background: K.cream, fontFamily: FONT, color: K.txt, paddingBottom: puedeAceptar ? 108 : 16 }}>
    <style>{CSS_LINK}</style>
    <div style={{ position: "sticky", top: 0, zIndex: 20 }}><Cabecera v={v} movil/></div>

    <div style={{ padding: "18px 16px 0" }}>
      <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>Hola {v.nombrePila || v.cn}, esta es tu cotización</h1>
      <p style={{ fontSize: 13, color: K.sub, margin: "6px 0 0", lineHeight: 1.5 }}>Precio final con todo incluido, puesto en Buenos Aires. Elegí cómo viaja y dónde la recibís.</p>
    </div>

    <div style={{ padding: "14px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
      <Card pad={14}>
        <SecT right={<span style={{ fontSize: 11, color: K.mute }}>{v.totalQty} u. · {products.length} prod.</span>}>Productos</SecT>
        {lista.map((p, i) => <div key={p.id || i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderTop: `1px solid ${K.line}` }}>
          <Foto p={p} size={50}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13.5, fontWeight: 800, margin: 0, lineHeight: 1.3, wordBreak: "break-word" }}>{p.description}</p>
            <p style={{ fontSize: 11.5, color: K.sub, margin: "2px 0 0" }}>{p.quantity} u.{p.lead_time_days > 0 ? ` · ⏱ ${p.lead_time_days} días` : ""}{sinPrecios ? "" : ` · ${fmtUSD2(v.landedUnit(p))} c/u`}</p>
          </div>
          {!sinPrecios && <strong style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtUSD(v.landedSubtotal(p))}</strong>}
        </div>)}
        {products.length > 3 && <button type="button" onClick={() => setVerTodos(x => !x)} style={{ width: "100%", marginTop: 6, padding: "9px", background: K.cream, border: `1px solid ${K.line}`, borderRadius: 10, color: K.goldDeep, fontWeight: 700, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer" }}>{verTodos ? "Ver menos" : `Ver los ${products.length} productos`}</button>}
        <p style={{ fontSize: 11, color: K.mute, margin: "10px 0 0", lineHeight: 1.5 }}>Precios puestos en Buenos Aires con {selChannel?.name || "el servicio elegido"}{deliveryCost > 0 ? " y envío" : ""}.</p>
      </Card>

      <Card pad={14}>
        <SecT>1 · Elegí el servicio</SecT>
        {sinPrecios ? <p style={{ margin: 0, fontSize: 13, color: K.mute }}>Todavía sin precios.</p> : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {channels.map((c, i) => <FilaServicio key={c.key} c={c} on={v.selectedChannel === c.key} rec={i === 0 && channels.length > 1} maxLead={v.maxLead} onClick={() => v.setSelectedChannel(c.key)}/>)}
        </div>}
      </Card>

      <Card pad={14}>
        <SecT>2 · ¿Cómo querés recibirla?</SecT>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entregaOpciones(v).map(o => <FilaEntrega key={o.k} o={o} on={v.selectedDelivery === o.k} onClick={() => v.setSelectedDelivery(o.k)}/>)}
        </div>
      </Card>

      {!sinPrecios && <div style={{ padding: "16px 18px", background: GOLD_GRAD, color: K.navy, borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 8px 22px rgba(184,149,106,0.3)", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", margin: 0 }}>Total</p>
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(10,22,40,0.7)", margin: "2px 0 0", lineHeight: 1.35 }}>{selChannel?.name || "—"}<br/>{v.entregaTxt}</p>
        </div>
        <p style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", margin: 0, whiteSpace: "nowrap" }}>{fmtUSD(finalTotal)}</p>
      </div>}

      {plan.length > 0 && !sinPrecios && <Card pad={14}><SecT>3 · Plan de pagos</SecT><PlanLista plan={plan} finalTotal={finalTotal}/></Card>}
      <Card pad={14}><SecT>{plan.length > 0 && !sinPrecios ? "4 · " : "3 · "}Tiempos estimados</SecT><Tiempos v={v}/></Card>
      <Terminos texto={settings?.terms_and_conditions}/>
      <Aviso vencida={v.vencida} esCliente={v.esCliente} cn={v.cn} sinPrecios={sinPrecios}/>
      {puedeAceptar && <BotonNo onClick={v.onReject} disabled={v.accepting}/>}
      {v.errAccion && <p style={{ textAlign: "center", fontSize: 12, color: K.red, fontWeight: 600, margin: 0 }}>{v.errAccion}</p>}
    </div>
    <div style={{ marginTop: 18 }}><Pie v={v} movil/></div>

    {puedeAceptar && <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, padding: "10px 16px calc(10px + env(safe-area-inset-bottom))", background: "rgba(10,22,40,0.97)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(232,208,152,0.25)", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 9.5, fontWeight: 800, color: "rgba(232,208,152,0.8)", textTransform: "uppercase", letterSpacing: "0.14em", margin: 0 }}>Total</p>
        <p style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{fmtUSD(finalTotal)}</p>
        <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selChannel?.name || "—"} · {v.entregaTxt}</p>
      </div>
      <button onClick={v.openConfirm} disabled={v.accepting} style={{ padding: "13px 22px", background: GOLD_GRAD, color: K.navy, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: v.accepting ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{v.accepting ? "…" : "Aceptar"}</button>
    </div>}
  </div>;
}

function ConfirmarModal({ onCancel, onConfirm, selChannel, finalTotal, entregaTxt, plan, isMobile }) {
  const primero = plan?.[0];
  return <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(8,12,24,0.78)", backdropFilter: "blur(10px)", zIndex: 99999, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20, fontFamily: FONT }}>
    <div onClick={e => e.stopPropagation()} style={{ maxWidth: isMobile ? "100%" : 480, width: "100%", background: "linear-gradient(180deg,#fefcf6 0%,#fdf9ed 100%)", borderRadius: isMobile ? "18px 18px 0 0" : 16, padding: isMobile ? "24px 20px calc(22px + env(safe-area-inset-bottom))" : "28px 28px 22px", border: "1px solid rgba(184,149,106,0.3)", boxShadow: "0 30px 80px rgba(0,0,0,0.45)", color: K.txt }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: GOLD_GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>✓</div>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em", color: K.navy }}>Confirmar aceptación</h2>
      </div>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.55, color: "#4a4a4a" }}>Al confirmar, un asesor revisa tu pedido y te pasa las instrucciones del primer pago para arrancar la producción.</p>
      <div style={{ padding: "12px 14px", background: "rgba(184,149,106,0.10)", border: "1px solid rgba(184,149,106,0.3)", borderRadius: 10, marginBottom: 18 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: K.goldDeep, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>Lo que elegiste</p>
        <p style={{ fontSize: 14, fontWeight: 700, color: K.navy, margin: "4px 0 0" }}>{selChannel?.name || "—"} · {entregaTxt}</p>
        <p style={{ fontSize: 15, fontWeight: 800, color: K.gold, margin: "2px 0 0" }}>{fmtUSD(finalTotal)}</p>
        {primero && <p style={{ fontSize: 12, color: "#4a4a4a", margin: "6px 0 0" }}>Primer pago: <strong style={{ color: K.navy }}>{fmtUSD(Math.round(finalTotal * Number(primero.pct) / 100))}</strong> ({primero.pct}%) · {primero.label}</p>}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "12px 20px", background: "transparent", color: K.navy, border: "1.5px solid rgba(10,22,40,0.2)", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
        <button onClick={onConfirm} style={{ flex: 1.5, padding: "12px 20px", background: K.navy, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em" }}>Confirmar y aceptar</button>
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
  return <div style={{ minHeight: "100vh", background: K.navyBg, padding: "24px 16px 40px", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: FONT, color: K.txt }}>
    <style>{CSS_LINK}</style>
    <img src={LOGO} alt="Argencargo" style={{ height: 36, width: "auto", marginBottom: 18 }}/>
    <div className="cot-in" style={{ maxWidth: 640, width: "100%", padding: "clamp(22px,4vw,36px)", background: K.cream, color: K.txt, borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.5)", boxSizing: "border-box" }}>
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
