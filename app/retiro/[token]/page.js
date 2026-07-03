"use client";
import { useState, useEffect } from "react";

const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const NAVY = "#0A1628";
const GOLD_A = "#B8956A";
const GOLD_B = "#E8D098";
const CREAM = "#faf8f3";
const LINE = "#eae4d6";
const INK = "#1a1a1a";
const MUTED = "#7a7362";

const fmt = (n) => "USD " + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CHANNEL_NAME = { aereo_blanco: "Aéreo Courier Comercial", aereo_negro: "Aéreo Integral AC", maritimo_blanco: "Marítimo LCL/FCL", maritimo_negro: "Marítimo Integral AC" };
const ZONES = ["CABA", "GBA Norte", "GBA Sur", "GBA Oeste"];

export default function EntregaPublica({ params }) {
  const token = params?.token;
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState("oficina"); // oficina | propio | carrier
  const [zone, setZone] = useState("CABA");
  const [address, setAddress] = useState("");
  const [addressChanged, setAddressChanged] = useState(false);
  const [payment, setPayment] = useState("efectivo");
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/entrega/${token}`);
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "No se pudo cargar"); setLoading(false); return; }
        setData(d);
        const inferred = d.delivery.inferred_zone;
        const hasPropio = ZONES.includes(inferred);
        setZone(hasPropio ? inferred : "CABA");
        setDelivery(hasPropio || !inferred ? "oficina" : "carrier");
        setAddress(d.delivery.default_address || "");
        if (payment === "efectivo" && !hasPropio && !inferred) setPayment("transferencia");
        setLoading(false);
      } catch (e) {
        setErr("Error de red"); setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) return <div style={pageStyle()}><p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Cargando…</p></div>;
  if (err) return <div style={pageStyle()}><div style={{ maxWidth: 440, padding: 30, background: "rgba(255,255,255,0.04)", borderRadius: 14, textAlign: "center" }}><p style={{ fontSize: 15, fontWeight: 600, color: "#f87171" }}>{err}</p></div></div>;
  if (!data) return null;

  const { op, client, cargo, delivery: deliveryInfo, payment: paymentInfo } = data;
  const isBlanco = op.channel?.includes("blanco");
  const inferredZone = deliveryInfo.inferred_zone;
  const hasPropio = ZONES.includes(inferredZone);
  const clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Cliente";

  const zonePrice = (z) => (z === "CABA" ? deliveryInfo.price_caba : deliveryInfo.price_amba);
  const deliveryCost = delivery === "propio" ? zonePrice(zone) : 0;
  const debtApp = Number(op.debt_applied_usd || 0);
  const creditApp = Number(op.credit_applied_usd || 0);
  const totAnt = Number(op.total_anticipos || 0);
  const collected = Number(op.collected_amount || 0);
  const saldo = Math.max(0, op.budget_total + debtApp - totAnt - collected - creditApp);
  const total = Math.round((saldo + deliveryCost) * 100) / 100;

  const efectivoBlocked = delivery === "carrier";
  useEffectSyncPayment(efectivoBlocked, payment, setPayment);

  const confirm = async () => {
    setConfirming(true);
    const r = await fetch(`/api/entrega/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delivery_choice: delivery, delivery_zone: delivery === "propio" ? zone : null, delivery_address: delivery === "propio" ? address : null, payment_method: payment }),
    });
    const d = await r.json();
    setConfirming(false);
    if (!r.ok) { alert(d.error || "Error al confirmar"); return; }
    setConfirmed(d);
  };

  if (confirmed) return <ConfirmedView data={confirmed} delivery={delivery} zone={zone} clientName={clientName} paymentInfo={paymentInfo} opCode={op.operation_code} />;

  return <div style={pageStyle()}>
    <div style={cardStyle()}>
      {/* header */}
      <div style={{ background: NAVY, color: "#fff", padding: "20px 28px 18px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
          <img src={LOGO} alt="Argencargo" style={{ height: 40, width: "auto" }} />
          <div style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, color: GOLD_B, letterSpacing: "0.03em", textAlign: "right", lineHeight: 1 }}>{op.operation_code}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div><p style={lblStyle()}>Cliente</p><p style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{clientName}</p></div>
          <div style={{ textAlign: "right" }}><p style={lblStyle()}>Canal</p><p style={{ fontSize: 17, fontWeight: 700, color: GOLD_B, letterSpacing: "-0.01em" }}>{CHANNEL_NAME[op.channel] || op.channel}</p></div>
        </div>
        <div style={{ height: 4, position: "absolute", left: 0, right: 0, bottom: 0, background: `linear-gradient(90deg,${GOLD_A},${GOLD_B},${GOLD_A})` }} />
      </div>

      <div style={{ padding: "22px 24px 26px", display: "flex", flexDirection: "column", gap: 16, background: CREAM, color: INK }}>
        {/* 01 — carga */}
        <div style={stepStyle()}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 12 }}><span style={stepNStyle()}>01</span><span style={stepTitleStyle()}>Tu carga</span></div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${LINE}` }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: "linear-gradient(135deg,#f3ead9,#e8d8b8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: "1px solid #ddc99a" }}>📦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, lineHeight: 1.35 }}>{op.description || "Tu mercadería"}</div>
              <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{cargo.bultos} bultos</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {isBlanco && <div style={factStyle()}><div style={factLblStyle()}>Peso factur.</div><div style={factValStyle()}>{cargo.peso_facturable.toLocaleString("es-AR")} kg</div></div>}
            {!isBlanco && <div style={factStyle()}><div style={factLblStyle()}>Bultos</div><div style={factValStyle()}>{cargo.bultos}</div></div>}
          </div>
          {isBlanco && <div style={{ marginTop: 12, paddingTop: 4, borderTop: `1px solid ${LINE}` }}>
            {op.budget_flete > 0 && <div style={rowStyle()}><span>Flete Internacional</span><span style={rowValStyle()}>{fmt(op.budget_flete)}</span></div>}
            {op.budget_taxes > 0 && <div style={rowStyle()}><span>Impuestos &amp; Aduana</span><span style={rowValStyle()}>{fmt(op.budget_taxes)}</span></div>}
            {op.budget_seguro > 0 && <div style={{ ...rowStyle(), borderBottom: "none" }}><span>Seguro de Carga</span><span style={rowValStyle()}>{fmt(op.budget_seguro)}</span></div>}
          </div>}
          {cargo.tracking.length > 0 && <>
            <p style={{ ...factLblStyle(), margin: "12px 0 6px" }}>Tracking</p>
            <div style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 12, color: INK, lineHeight: 1.9 }}>
              {cargo.tracking.map((t, i) => <div key={i}>– {t}</div>)}
            </div>
          </>}
        </div>

        {/* 02 — entrega */}
        <div style={stepStyle()}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 12 }}><span style={stepNStyle()}>02</span><span style={stepTitleStyle()}>¿Cómo la recibís?</span></div>
          <OptRow selected={delivery === "oficina"} onClick={() => setDelivery("oficina")} label="Retiro por oficina" meta={`${deliveryInfo.office_address || ""}${deliveryInfo.office_locality ? " · " + deliveryInfo.office_locality : ""}${deliveryInfo.office_hours ? " · " + deliveryInfo.office_hours : ""}`} />
          {hasPropio && <OptRow selected={delivery === "propio"} onClick={() => setDelivery("propio")} label="Envío a domicilio" meta="Coordinamos día y horario" price={"+ " + fmt(zonePrice(zone))} />}
          {hasPropio && delivery === "propio" && <div style={{ marginTop: 10 }}>
            <label style={fieldLblStyle()}>Zona</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ZONES.map(z => <button key={z} type="button" onClick={() => setZone(z)} style={zoneBtnStyle(zone === z)}>{z} <span style={{ fontSize: 10, fontWeight: 700, color: zone === z ? GOLD_A : MUTED }}>+{fmt(zonePrice(z)).replace("USD ", "")}</span></button>)}
            </div>
            <p style={{ fontSize: 10, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>Precargamos tu zona registrada. Si vas a recibirla en otra, elegí la que corresponda — el precio se actualiza solo.</p>
            <label style={{ ...fieldLblStyle(), marginTop: 10 }}>Dirección de entrega</label>
            <input value={address} onChange={e => { setAddress(e.target.value); setAddressChanged(e.target.value.trim() !== (deliveryInfo.default_address || "").trim()); }} style={inputStyle()} />
            <p style={{ fontSize: 10, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>Precargamos la dirección registrada en tu cuenta — la podés editar si querés que te entreguemos en otra.</p>
            {addressChanged && <p style={{ fontSize: 10, color: "#8b6f4a", marginTop: 4, lineHeight: 1.5 }}>🖊️ Vas a pedir entrega en una dirección distinta a la registrada — se lo avisamos a Argencargo junto con tu confirmación.</p>}
          </div>}
          {!hasPropio && <OptRow selected={delivery === "carrier"} onClick={() => setDelivery("carrier")} label="Envío por Via Cargo / Andreani" meta="Tu zona está fuera del reparto propio de Argencargo" price="A coordinar" />}
          {!hasPropio && delivery === "carrier" && <div style={noteBoxStyle()}>El costo lo fija el transportista (Via Cargo o Andreani) según tu localidad, no Argencargo. Coordinamos el despacho y el pago del flete por WhatsApp.</div>}
        </div>

        {/* 03 — total y pago */}
        <div style={stepStyle()}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 12 }}><span style={stepNStyle()}>03</span><span style={stepTitleStyle()}>Total y forma de pago</span></div>
          <div style={{ padding: "15px 17px", borderRadius: 11, background: `linear-gradient(135deg,${GOLD_A},${GOLD_B})`, color: NAVY, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 5px 16px rgba(184,149,106,0.25)" }}>
            <div>
              <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>Total a abonar</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(10,22,40,0.65)", marginTop: 2 }}>{CHANNEL_NAME[op.channel] || op.channel} · {delivery === "oficina" ? "Retiro por oficina" : delivery === "propio" ? `Envío a domicilio · ${zone}` : "Envío por transportista"}</p>
            </div>
            <p style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em" }}>{fmt(total)}</p>
          </div>
          {creditApp > 0.01 && <div style={adjustCardStyle(true)}><span>✓</span><span>Se descontaron <b>{fmt(creditApp)}</b> de tu saldo a favor</span></div>}
          {creditApp <= 0.01 && debtApp > 0.01 && <div style={adjustCardStyle(false)}><span>ⓘ</span><span>Se sumaron <b>{fmt(debtApp)}</b> por saldo pendiente anterior</span></div>}

          <div style={{ marginTop: 12 }}>
            <OptRow selected={payment === "efectivo"} onClick={() => !efectivoBlocked && setPayment("efectivo")} label="Efectivo" meta={efectivoBlocked ? "No disponible para envíos con transportista" : "En ARS o USD, al retirar o recibir"} disabled={efectivoBlocked} />
            <OptRow selected={payment === "transferencia"} onClick={() => setPayment("transferencia")} label="Transferencia en pesos" meta="Al tipo de cambio del día" />
            <OptRow selected={payment === "crypto"} onClick={() => setPayment("crypto")} label="Cripto" meta="USDT (TRC-20)" />
            {payment === "crypto" && paymentInfo.crypto_wallet && <div style={payDetailStyle()}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>Dirección USDT · TRC-20</div>
              <div style={cbuBoxStyle()}>{paymentInfo.crypto_wallet}</div>
            </div>}
          </div>
        </div>

        <button onClick={confirm} disabled={confirming} style={ctaStyle(confirming)}>{confirming ? "Confirmando…" : "Confirmar y avisar a Argencargo"}</button>
        <p style={{ textAlign: "center", fontSize: 10.5, color: MUTED, margin: "-8px 0 0" }}>Al confirmar, un asesor coordina el retiro o el envío por WhatsApp.</p>
      </div>

      <div style={{ background: NAVY, color: "#fff", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.08em" }}>ARGENCARGO</p>
          <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>{deliveryInfo.office_hours ? `Tel · ${deliveryInfo.office_hours}` : ""}</p>
        </div>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: GOLD_B, letterSpacing: "0.03em" }}>argencargo.com.ar</p>
      </div>
    </div>
  </div>;
}

// Si cambia a un envío que bloquea efectivo mientras el cliente ya tenía efectivo elegido, lo pasamos a transferencia.
function useEffectSyncPayment(blocked, payment, setPayment) {
  useEffect(() => { if (blocked && payment === "efectivo") setPayment("transferencia"); }, [blocked]); // eslint-disable-line react-hooks/exhaustive-deps
}

function OptRow({ selected, onClick, label, meta, price, disabled }) {
  return <div onClick={disabled ? undefined : onClick} style={{
    display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 9,
    border: `1.5px solid ${selected ? GOLD_A : LINE}`, cursor: disabled ? "not-allowed" : "pointer",
    background: selected ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : CREAM,
    boxShadow: selected ? "0 3px 10px rgba(184,149,106,0.18)" : "none", marginBottom: 7, opacity: disabled ? 0.45 : 1,
  }}>
    <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, border: `2px solid ${selected ? GOLD_A : "#c9bb9c"}`, background: selected ? GOLD_A : "transparent", boxShadow: selected ? "inset 0 0 0 3.5px #fff" : "none" }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{label}</div>
      <div style={{ fontSize: 10.5, color: MUTED, marginTop: 1 }}>{meta}</div>
    </div>
    {price && <div style={{ fontSize: 13, fontWeight: 800, color: GOLD_A, whiteSpace: "nowrap" }}>{price}</div>}
  </div>;
}

function ConfirmedView({ data, delivery, zone, clientName, paymentInfo, opCode }) {
  const payLabel = data.payment_method === "efectivo" ? "Efectivo" : data.payment_method === "transferencia" ? "Transferencia en pesos" : "Cripto (USDT)";
  const entregaLabel = delivery === "oficina" ? "Retiro por oficina" : delivery === "propio" ? `Envío a domicilio · ${zone}` : "Envío por transportista";
  const what = delivery === "oficina" ? "tu retiro" : delivery === "propio" ? "la entrega en tu domicilio" : "el envío con el transportista";
  return <div style={pageStyle()}>
    <div style={{ maxWidth: 480, width: "100%", padding: "32px 28px", background: CREAM, color: INK, borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.55)" }}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#fff", marginBottom: 10 }}>✓</div>
        <p style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.01em" }}>¡Listo, confirmamos tu pedido!</p>
        <p style={{ fontSize: 12.5, color: MUTED, margin: 0, lineHeight: 1.5 }}>Un asesor de Argencargo te escribe por WhatsApp para coordinar {what}.</p>
      </div>
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 800, margin: "0 0 10px" }}>Resumen</p>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${LINE}` }}><span style={{ color: MUTED }}>Entrega</span><span style={{ fontWeight: 700 }}>{entregaLabel}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${LINE}` }}><span style={{ color: MUTED }}>Pago</span><span style={{ fontWeight: 700 }}>{payLabel}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0" }}><span style={{ color: MUTED }}>Total</span><span style={{ fontWeight: 800, color: GOLD_A }}>{fmt(data.total)}</span></div>
      </div>
      <div style={payDetailStyle()}>
        {data.payment_method === "crypto" && data.crypto_wallet && <><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>Dirección USDT · TRC-20</div><div style={cbuBoxStyle()}>{data.crypto_wallet}</div></>}
        {data.payment_method === "transferencia" && <span>Te vamos a pasar por WhatsApp el monto exacto a transferir en pesos, al tipo de cambio del momento.</span>}
        {data.payment_method === "efectivo" && <span>Tené preparado el pago en efectivo (ARS o USD) para cuando {delivery === "oficina" ? "retires tu carga." : "la recibas."}</span>}
      </div>
    </div>
  </div>;
}

function pageStyle() { return { minHeight: "100vh", background: NAVY, padding: "32px 18px 60px", display: "flex", justifyContent: "center", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", color: "#fff" }; }
function cardStyle() { return { maxWidth: 640, width: "100%", background: CREAM, borderRadius: 14, overflow: "hidden", boxShadow: "0 28px 80px rgba(0,0,0,0.5)" }; }
function lblStyle() { return { fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(232,208,152,0.65)", textTransform: "uppercase", marginBottom: 3 }; }
function stepStyle() { return { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "16px 18px" }; }
function stepNStyle() { return { fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: GOLD_A, letterSpacing: "0.06em" }; }
function stepTitleStyle() { return { fontSize: 13.5, fontWeight: 800, color: INK, letterSpacing: "-0.005em" }; }
function factStyle() { return { flex: "0 0 auto", minWidth: 110, background: CREAM, border: `1px solid ${LINE}`, borderRadius: 8, padding: "9px 10px" }; }
function factLblStyle() { return { fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }; }
function factValStyle() { return { fontSize: 13, fontWeight: 700, color: INK, marginTop: 2 }; }
function rowStyle() { return { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${LINE}`, fontSize: 12, color: "#5c5646" }; }
function rowValStyle() { return { fontWeight: 700, color: INK }; }
function fieldLblStyle() { return { fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, display: "block", marginBottom: 5 }; }
function inputStyle() { return { width: "100%", padding: "9px 11px", fontSize: 12.5, border: `1px solid ${LINE}`, borderRadius: 8, background: "#fff", color: INK, fontFamily: "inherit", boxSizing: "border-box" }; }
function zoneBtnStyle(on) { return { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "7px 11px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${on ? GOLD_A : LINE}`, background: on ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : "#fff", color: INK, fontSize: 11.5, fontWeight: 700 }; }
function noteBoxStyle() { return { marginTop: 10, padding: "10px 12px", borderRadius: 8, fontSize: 11, lineHeight: 1.55, background: "#f4efe3", border: `1px solid ${LINE}`, color: "#4a4536" }; }
function adjustCardStyle(credit) { return { display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", borderRadius: 9, fontSize: 12, lineHeight: 1.4, marginTop: 10, background: credit ? "#eaf6ef" : "#fdf1ea", border: `1px solid ${credit ? "rgba(30,125,79,.25)" : "rgba(180,90,40,.25)"}`, color: credit ? "#1e5c3d" : "#7a4a28" }; }
function payDetailStyle() { return { marginTop: 11, padding: "12px 14px", borderRadius: 9, background: "#f4efe3", border: `1px solid ${LINE}`, fontSize: 11.5, color: "#4a4536", lineHeight: 1.6 }; }
function cbuBoxStyle() { return { fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: INK, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 6, padding: "6px 9px", display: "block", width: "100%", boxSizing: "border-box" }; }
function ctaStyle(loading) { return { width: "100%", padding: "14px 20px", background: NAVY, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, letterSpacing: "0.03em", cursor: loading ? "wait" : "pointer", fontFamily: "inherit" }; }
