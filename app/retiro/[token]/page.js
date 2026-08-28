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
const CHANNEL_NAME = { aereo_blanco: "Aéreo Courier Comercial", maritimo_blanco: "Marítimo LCL/FCL", maritimo_negro: "Marítimo Integral AC" };

export default function EntregaPublica({ params }) {
  const token = params?.token;
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState("oficina"); // oficina | propio | carrier
  const [address, setAddress] = useState("");
  const [addressChanged, setAddressChanged] = useState(false);
  const [payment, setPayment] = useState("efectivo"); // legacy: primer método (se mantiene sincronizado)
  // Quien recibe, solo para envio por transportista (Andreani): el despacho exige el DNI. Se
  // precarga con los datos del cliente, pero es editable porque a veces recibe otra persona.
  // El link avanza de a bloques, como el de MyBox: se ve un paso por vez y el siguiente aparece
  // recién cuando el anterior está resuelto. Mostrar los tres juntos hacía que el cliente saltara
  // datos y llegara al final con cosas sin completar.
  const [paso, setPaso] = useState(1);
  // Día y franja horaria elegidos (retiro por oficina y envío con fletero propio).
  const [diaEntrega, setDiaEntrega] = useState("");
  const [franjaEntrega, setFranjaEntrega] = useState("");
  // Pago combinado: hasta 2 métodos. payMethods = ["efectivo","crypto"], payAmounts = {efectivo:"600"}.
  const [payMethods, setPayMethods] = useState(["efectivo"]);
  const [payAmounts, setPayAmounts] = useState({}); // montos por método (el último seleccionado absorbe el resto)
  const [cashCurrencyMode, setCashCurrencyMode] = useState("USD"); // USD | ARS | mixto (solo efectivo)
  const [formError, setFormError] = useState("");
  // Si paga (parte) en efectivo: con cuánto llega, para tener el cambio listo.
  const [cashAmount, setCashAmount] = useState("");
  const [cashCurrency, setCashCurrency] = useState("USD");
  const [carrierMode, setCarrierMode] = useState(""); // sucursal | domicilio (solo con transportista)
  const [contacto, setContacto] = useState({ nombre: "", apellido: "", dni: "", email: "", telefono: "", direccion: "", piso: "", cp: "", sucursal: "" });
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/entrega/${token}`);
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "No se pudo cargar"); setLoading(false); return; }
        setData(d);
        // La localidad y el precio ya vienen calculados del server (tabla de zonas + fórmula del
        // fletero) — acá solo decidimos qué opción de entrega precargar.
        const hasPropio = d.delivery.price != null;
        setDelivery(hasPropio || !d.delivery.inferred_zone ? "oficina" : "carrier");
        setAddress(d.delivery.default_address || "");
        if (!hasPropio && !d.delivery.inferred_zone) setPayMethods(["transferencia"]);
        setContacto((c) => ({
          ...c,
          nombre: c.nombre || d.client?.first_name || "",
          apellido: c.apellido || d.client?.last_name || "",
          dni: c.dni || d.client?.dni || "",
          email: c.email || d.client?.email || "",
          telefono: c.telefono || d.client?.whatsapp || "",
          direccion: c.direccion || d.delivery?.default_address || "",
          cp: c.cp || d.client?.postal_code || "",
        }));
        setLoading(false);
      } catch (e) {
        setErr("Error de red"); setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Si el envío pasa a ser por transportista externo, efectivo queda bloqueado — hay que sacarlo
  // de la selección. Este efecto va ANTES de cualquier return temprano (loading/err/!data) para no
  // violar las reglas de hooks (la cantidad de hooks debe ser la misma en cada render).
  useEffect(() => {
    if (delivery === "carrier" && payMethods.includes("efectivo")) {
      const rest = payMethods.filter(m => m !== "efectivo");
      setPayMethods(rest.length ? rest : ["transferencia"]);
    }
    // Cambiar la forma de entrega invalida el día/franja elegidos (las franjas difieren).
    setDiaEntrega(""); setFranjaEntrega("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery]);
  useEffect(() => { setPayment(payMethods[0] || "transferencia"); setFormError(""); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMethods]);
  useEffect(() => { setFormError(""); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, diaEntrega, franjaEntrega, delivery]);

  if (loading) return <div style={pageStyle()}><p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Cargando…</p></div>;
  if (err) return <div style={pageStyle()}><div style={{ maxWidth: 440, padding: 30, background: "rgba(255,255,255,0.04)", borderRadius: 14, textAlign: "center" }}><p style={{ fontSize: 15, fontWeight: 600, color: "#f87171" }}>{err}</p></div></div>;
  if (!data) return null;

  const { op, client, cargo, delivery: deliveryInfo } = data;
  const isBlanco = op.channel?.includes("blanco");
  const inferredZone = deliveryInfo.inferred_zone;
  const hasPropio = deliveryInfo.price != null;
  const clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Cliente";

  const deliveryCost = delivery === "propio" ? deliveryInfo.price : 0;
  const debtApp = Number(op.debt_applied_usd || 0);
  const creditApp = Number(op.credit_applied_usd || 0);
  const totAnt = Number(op.total_anticipos || 0);
  const collected = Number(op.collected_amount || 0);
  const saldo = Math.max(0, op.budget_total + debtApp - totAnt - collected - creditApp);
  const total = Math.round((saldo + deliveryCost) * 100) / 100;

  const efectivoBlocked = delivery === "carrier";

  // Devuelve el motivo por el que no se puede avanzar, o null si está todo bien.
  const validarEntrega = () => {
    if (delivery === "carrier") {
      if (!carrierMode) return "Elegí si lo recibís en sucursal o en tu domicilio.";
      if (!contacto.nombre.trim() || !contacto.apellido.trim()) return "Completá nombre y apellido de quien recibe.";
      if (contacto.dni.replace(/\D/g, "").length < 7) return "Completá el DNI de quien recibe — el transportista lo necesita para el despacho.";
      if (contacto.telefono.replace(/\D/g, "").length < 8) return "Completá el teléfono de quien recibe — el transportista llama antes de entregar.";
      if (!contacto.cp.trim()) return "Completá el código postal — el transportista lo necesita para cotizar el despacho.";
      if (carrierMode === "sucursal" && !contacto.sucursal.trim()) return "Indicá en qué sucursal lo vas a retirar.";
      if (carrierMode === "domicilio" && !contacto.direccion.trim()) return "Completá la dirección de entrega.";
    }
    if (delivery === "propio" && !address.trim()) return "Completá la dirección de entrega.";
    if ((delivery === "oficina" || delivery === "propio") && (!diaEntrega || !franjaEntrega)) return delivery === "oficina" ? "Elegí qué día y en qué horario pasás a retirar." : "Elegí qué día y en qué franja querés recibir la entrega.";
    return null;
  };
  // Reparto del pago: con varios métodos, todos menos el ÚLTIMO tienen monto editable;
  // el último absorbe automáticamente el resto (nunca se descuadra la suma).
  const montoDe = (m) => Number(String(payAmounts[m] ?? "").replace(",", ".")) || 0;
  const editables = payMethods.slice(0, -1);
  const sumaEditables = editables.reduce((s2, m) => s2 + montoDe(m), 0);
  const montoResto = Math.max(0, Math.round((total - sumaEditables) * 100) / 100);
  const splitCliente = payMethods.length === 1
    ? [{ method: payMethods[0], amount: total }]
    : payMethods.map((m, i) => ({ method: m, amount: i === payMethods.length - 1 ? montoResto : montoDe(m) }));
  const tcVenta = Number(data?.tc?.venta || 0);
  const ars = (usd) => tcVenta > 0 ? `≈ ARS ${Math.round(usd * tcVenta).toLocaleString("es-AR")}` : null;
  const validarPago = () => {
    if (payMethods.length === 0) return "Elegí al menos una forma de pago.";
    if (payMethods.length > 1) {
      for (const m of editables) if (!(montoDe(m) > 0)) return "Completá cuánto pagás con cada método.";
      if (sumaEditables >= total) return "Los montos superan el total — bajá alguno para que quede algo para el último método.";
    }
    return null;
  };

  const confirm = async () => {
    // Andreani no despacha sin DNI del destinatario, asi que se pide antes de confirmar.
    const errEntrega = validarEntrega();
    if (errEntrega) { setFormError(errEntrega); return; }
    const errPago = validarPago();
    if (errPago) { setFormError(errPago); return; }
    setFormError("");
    setConfirming(true);
    // La zona/precio los recalcula el server a partir de la localidad registrada — no se manda acá.
    const r = await fetch(`/api/entrega/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        delivery_choice: delivery,
        delivery_address: delivery === "propio" ? address : null,
        payment_method: payMethods[0],
        payment_methods: splitCliente.map((p) => p.method === "efectivo" ? { ...p, currency: cashCurrencyMode } : p),
        cash_amount: payMethods.includes("efectivo") && Number(String(cashAmount).replace(",", ".")) > 0 ? Number(String(cashAmount).replace(",", ".")) : null,
        cash_currency: payMethods.includes("efectivo") ? cashCurrency : null,
        delivery_day: (delivery === "oficina" || delivery === "propio") ? diaEntrega : null,
        delivery_slot: (delivery === "oficina" || delivery === "propio") ? franjaEntrega : null,
        delivery_contact: delivery === "carrier" ? contacto : null,
        carrier_mode: delivery === "carrier" ? carrierMode : null,
      }),
    });
    const d = await r.json();
    setConfirming(false);
    if (!r.ok) { setFormError(d.error || "Error al confirmar"); return; }
    setConfirmed(d);
  };

  if (confirmed) return <ConfirmedView data={confirmed} delivery={delivery} clientName={clientName} />;

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
        {paso===1&&<>
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
            {op.budget_taxes > 0 && op.taxes_billed_by_argencargo !== false && <div style={rowStyle()}><span>Impuestos &amp; Aduana</span><span style={rowValStyle()}>{fmt(op.budget_taxes)}</span></div>}
            {op.budget_seguro > 0 && <div style={{ ...rowStyle(), borderBottom: "none" }}><span>Seguro de Carga</span><span style={rowValStyle()}>{fmt(op.budget_seguro)}</span></div>}
          </div>}
          {cargo.tracking.length > 0 && <>
            <p style={{ ...factLblStyle(), margin: "12px 0 6px" }}>Tracking</p>
            <div style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 12, color: INK, lineHeight: 1.9 }}>
              {cargo.tracking.map((t, i) => <div key={i}>– {t}</div>)}
            </div>
          </>}
          {paso===1&&<button onClick={()=>setPaso(2)} style={nextBtnStyle()}>Continuar →</button>}
        </div>

        </>}

        {paso===2&&<>
        {/* 02 — entrega */}
        <div style={stepStyle()}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 12 }}><span style={stepNStyle()}>02</span><span style={stepTitleStyle()}>¿Cómo la recibís?</span></div>
          <OptRow selected={delivery === "oficina"} onClick={() => setDelivery("oficina")} label="Retiro por oficina" meta={`${deliveryInfo.office_address || ""}${deliveryInfo.office_locality ? " · " + deliveryInfo.office_locality : ""}${deliveryInfo.office_hours ? " · " + deliveryInfo.office_hours : ""}`} />
          {delivery === "oficina" && <div style={{ margin: "4px 0 10px" }}><DiaFranja modo="oficina" dia={diaEntrega} setDia={setDiaEntrega} franja={franjaEntrega} setFranja={setFranjaEntrega} /></div>}
          {hasPropio && <OptRow selected={delivery === "propio"} onClick={() => setDelivery("propio")} label="Envío a domicilio" meta={`Coordinamos día y horario · ${inferredZone}`} price={"+ " + fmt(deliveryInfo.price)} />}
          {hasPropio && delivery === "propio" && <div style={{ marginTop: 10 }}>
            <label style={fieldLblStyle()}>Dirección de entrega</label>
            <input value={address} onChange={e => { setAddress(e.target.value); setAddressChanged(e.target.value.trim() !== (deliveryInfo.default_address || "").trim()); }} style={inputStyle()} />
            <p style={{ fontSize: 10, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>Precargamos la dirección registrada en tu cuenta — la podés editar si querés que te entreguemos en otra.</p>
            {addressChanged && <p style={{ fontSize: 10, color: "#8b6f4a", marginTop: 4, lineHeight: 1.5 }}>🖊️ Vas a pedir entrega en una dirección distinta a la registrada — se lo avisamos a Argencargo junto con tu confirmación.</p>}
            <DiaFranja modo="propio" dia={diaEntrega} setDia={setDiaEntrega} franja={franjaEntrega} setFranja={setFranjaEntrega} />
          </div>}
          {!hasPropio && <OptRow selected={delivery === "carrier"} onClick={() => setDelivery("carrier")} label="Envío por Via Cargo / Andreani" meta="Tu zona está fuera del reparto propio de Argencargo" price="A coordinar" />}

          {/* Con transportista hay dos modalidades y piden datos distintos: a sucursal alcanza con
              quién retira; a domicilio se suma la dirección. */}
          {!hasPropio && delivery === "carrier" && (
            <div style={{ marginTop: 12 }}>
              <label style={fieldLblStyle()}>¿Cómo querés recibirlo?</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  { k: "sucursal", t: "En sucursal", d: "Lo retirás en la sucursal más cercana" },
                  { k: "domicilio", t: "En tu domicilio", d: "Te lo llevan a la dirección que indiques" },
                ].map((m) => (
                  <div key={m.k} onClick={() => setCarrierMode(m.k)} style={{ padding: "11px 13px", borderRadius: 11, cursor: "pointer", border: `1.5px solid ${carrierMode === m.k ? "#B8956A" : "rgba(10,22,40,0.14)"}`, background: carrierMode === m.k ? "rgba(184,149,106,0.10)" : "#fff" }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0A1628", margin: 0 }}>{carrierMode === m.k ? "◉ " : "○ "}{m.t}</p>
                    <p style={{ fontSize: 11, color: MUTED, margin: "3px 0 0", lineHeight: 1.4 }}>{m.d}</p>
                  </div>
                ))}
              </div>

              {carrierMode && (
                <div style={{ padding: "13px 15px", borderRadius: 12, background: "rgba(10,22,40,0.035)", border: "1px solid rgba(10,22,40,0.10)" }}>
                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(10,22,40,0.55)", margin: "0 0 3px" }}>Datos de quien recibe</p>
                  <p style={{ fontSize: 11.5, color: MUTED, margin: "0 0 10px", lineHeight: 1.45 }}>El transportista pide el DNI del destinatario para poder despachar.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input value={contacto.nombre} onChange={(e) => setContacto((c) => ({ ...c, nombre: e.target.value }))} placeholder="Nombre" style={contactInputStyle()} />
                    <input value={contacto.apellido} onChange={(e) => setContacto((c) => ({ ...c, apellido: e.target.value }))} placeholder="Apellido" style={contactInputStyle()} />
                    <input value={contacto.dni} onChange={(e) => setContacto((c) => ({ ...c, dni: e.target.value }))} placeholder="DNI" inputMode="numeric" style={contactInputStyle()} />
                    <input value={contacto.telefono} onChange={(e) => setContacto((c) => ({ ...c, telefono: e.target.value }))} placeholder="Teléfono" inputMode="tel" style={contactInputStyle()} />
                    <input value={contacto.email} onChange={(e) => setContacto((c) => ({ ...c, email: e.target.value }))} placeholder="Email" style={{ ...contactInputStyle(), gridColumn: "1 / -1" }} />
                    {carrierMode === "sucursal" && <>
                      <input value={contacto.sucursal} onChange={(e) => setContacto((c) => ({ ...c, sucursal: e.target.value }))} placeholder="Sucursal donde lo retirás" style={contactInputStyle()} />
                      <input value={contacto.cp} onChange={(e) => setContacto((c) => ({ ...c, cp: e.target.value }))} placeholder="Código postal" inputMode="numeric" style={contactInputStyle()} />
                    </>}
                    {carrierMode === "domicilio" && <>
                      <input value={contacto.direccion} onChange={(e) => setContacto((c) => ({ ...c, direccion: e.target.value }))} placeholder="Dirección (calle y número)" style={{ ...contactInputStyle(), gridColumn: "1 / -1" }} />
                      <input value={contacto.piso} onChange={(e) => setContacto((c) => ({ ...c, piso: e.target.value }))} placeholder="Piso / depto (si lleva)" style={contactInputStyle()} />
                      <input value={contacto.cp} onChange={(e) => setContacto((c) => ({ ...c, cp: e.target.value }))} placeholder="Código postal" inputMode="numeric" style={contactInputStyle()} />
                    </>}
                  </div>
                </div>
              )}
            </div>
          )}
          {formError && <ErrorBanner msg={formError} />}
          {paso===2&&<div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={()=>setPaso(1)} style={backBtnStyle()}>← Volver</button>
            <button onClick={()=>{const e=validarEntrega();if(e){setFormError(e);return;}setFormError("");setPaso(3);}} style={{...nextBtnStyle(), marginTop: 0, flex: 1}}>Continuar →</button>
          </div>}
        </div>
        </>}

        {paso===3&&<>
        {/* 03 — total y pago */}
        <div style={stepStyle()}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 12 }}><span style={stepNStyle()}>03</span><span style={stepTitleStyle()}>Total y forma de pago</span></div>
          <div style={{ padding: "15px 17px", borderRadius: 11, background: `linear-gradient(135deg,${GOLD_A},${GOLD_B})`, color: NAVY, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 5px 16px rgba(184,149,106,0.25)" }}>
            <div>
              <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>Total a abonar</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(10,22,40,0.65)", marginTop: 2 }}>{CHANNEL_NAME[op.channel] || op.channel} · {delivery === "oficina" ? "Retiro por oficina" : delivery === "propio" ? `Envío a domicilio · ${inferredZone}` : "Envío por transportista"}</p>
            </div>
            <p style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em" }}>{fmt(total)}</p>
          </div>
          {creditApp > 0.01 && <div style={adjustCardStyle(true)}><span>✓</span><span>Se descontaron <b>{fmt(creditApp)}</b> de tu saldo a favor</span></div>}
          {data.preferential && <div style={adjustCardStyle(true)}><span>⭐</span><span>Tenés <b>tarifa preferencial</b>: USD {data.preferential.usd_por_kg} por kilo, en vez de USD {data.preferential.lista_usd_por_kg}.</span></div>}
          {creditApp <= 0.01 && debtApp > 0.01 && <div style={adjustCardStyle(false)}><span>ⓘ</span><span>Se sumaron <b>{fmt(debtApp)}</b> por saldo pendiente anterior</span></div>}

          {(()=>{
            const togglePay = (m) => setPayMethods((prev) => prev.includes(m) ? (prev.length > 1 ? prev.filter(x => x !== m) : prev) : [...prev, m]);
            const PAY_LBL = { efectivo: "Efectivo", transferencia: "Transferencia en pesos", crypto: "Cripto (USDT)" };
            const combinado = payMethods.length > 1;
            return <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: INK, margin: "0 0 2px" }}>¿Cómo querés pagar?</p>
              <p style={{ fontSize: 10.5, color: MUTED, margin: "0 0 9px", lineHeight: 1.5 }}>Marcá <b>una o varias</b> — si elegís más de una, repartís el total como quieras.</p>
              <PayCheck checked={payMethods.includes("efectivo")} onClick={() => !efectivoBlocked && togglePay("efectivo")} label="Efectivo" meta={efectivoBlocked ? "No disponible para envíos con transportista" : "En dólares o pesos, al retirar o recibir"} disabled={efectivoBlocked} />
              <PayCheck checked={payMethods.includes("transferencia")} onClick={() => togglePay("transferencia")} label="Transferencia en pesos" meta={(() => {
                const sel = payMethods.includes("transferencia");
                const parte = splitCliente.find((p) => p.method === "transferencia")?.amount || 0;
                if (sel && tcVenta > 0 && parte > 0) return `Pagás ARS ${Math.round(parte * tcVenta).toLocaleString("es-AR")}`;
                if (!sel && tcVenta > 0 && payMethods.length === 0) return `Serían ARS ${Math.round(total * tcVenta).toLocaleString("es-AR")}`;
                return "El importe se pasa a pesos automáticamente";
              })()} />
              <PayCheck checked={payMethods.includes("crypto")} onClick={() => togglePay("crypto")} label="Cripto (USDT)" meta="Red TRC-20 · te pasamos la billetera por WhatsApp" />

              {payMethods.includes("efectivo") && <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 11, background: "#f4efe3", border: `1px solid ${LINE}` }}>
                <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(10,22,40,0.55)", margin: "0 0 8px" }}>💵 El efectivo, ¿en qué moneda?</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 6, marginBottom: 10 }}>
                  {[["USD", "Dólares"], ["ARS", "Pesos"], ["mixto", "Un poco de cada"]].map(([k, l]) => <button key={k} type="button" onClick={() => setCashCurrencyMode(k)} style={{ padding: "9px 8px", fontSize: 11.5, fontWeight: 800, borderRadius: 9, cursor: "pointer", border: `1.5px solid ${cashCurrencyMode === k ? GOLD_A : LINE}`, background: cashCurrencyMode === k ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : "#fff", color: cashCurrencyMode === k ? "#8b6f4a" : MUTED }}>{l}</button>)}
                </div>
                {cashCurrencyMode === "ARS" && tcVenta > 0 && (() => { const parte = splitCliente.find((p) => p.method === "efectivo")?.amount || 0; return parte > 0 ? <p style={{ fontSize: 11, color: "#1e5c3d", background: "#eaf6ef", border: "1px solid rgba(30,125,79,.2)", borderRadius: 8, padding: "8px 10px", margin: "0 0 10px", lineHeight: 1.5 }}>En pesos son <b>ARS {Math.round(parte * tcVenta).toLocaleString("es-AR")}</b> (valor de hoy — se ajusta al día del pago).</p> : null; })()}
                {cashCurrencyMode === "mixto" && <p style={{ fontSize: 10.5, color: MUTED, margin: "0 0 10px", lineHeight: 1.5 }}>Coordinamos por WhatsApp cuánto en cada moneda.</p>}
                <p style={{ fontSize: 10.5, color: MUTED, margin: "0 0 7px", lineHeight: 1.5 }}>Si necesitás cambio, decinos con cuánto llegás así lo tenemos listo. (Opcional)</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={cashAmount} onChange={(e) => setCashAmount(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="Ej: 600" style={{ ...contactInputStyle(), flex: 1 }} />
                  <div style={{ display: "flex", gap: 4 }}>
                    {["USD", "ARS"].map((c) => <button key={c} type="button" onClick={() => setCashCurrency(c)} style={{ padding: "8px 13px", fontSize: 12, fontWeight: 800, borderRadius: 9, cursor: "pointer", border: `1.5px solid ${cashCurrency === c ? GOLD_A : LINE}`, background: cashCurrency === c ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : "#fff", color: cashCurrency === c ? "#8b6f4a" : MUTED }}>{c}</button>)}
                  </div>
                </div>
              </div>}

              {combinado && <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 11, background: "rgba(10,22,40,0.035)", border: "1px solid rgba(10,22,40,0.10)" }}>
                <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(10,22,40,0.55)", margin: "0 0 8px" }}>¿Cómo repartís el pago?</p>
                {payMethods.map((m, i2) => {
                  const esUltimo = i2 === payMethods.length - 1;
                  const monto = esUltimo ? montoResto : montoDe(m);
                  return <div key={m} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 120px", fontSize: 12.5, fontWeight: 700, color: INK }}>{PAY_LBL[m]}{esUltimo && <span style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, display: "block" }}>el resto va acá</span>}</span>
                    {(()=>{
                      const enPesos = m === "transferencia" || (m === "efectivo" && cashCurrencyMode === "ARS");
                      const arsTag = (v) => enPesos && tcVenta > 0 && v > 0 ? <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#1e5c3d", textAlign: "right" }}>= ARS {Math.round(v * tcVenta).toLocaleString("es-AR")}</span> : null;
                      return esUltimo
                        ? <span style={{ fontSize: 14, fontWeight: 800, color: montoResto > 0 ? GOLD_A : "#c0392b", fontVariantNumeric: "tabular-nums" }}>{fmt(montoResto)}{arsTag(montoResto)}</span>
                        : <div style={{ textAlign: "right" }}>
                            <div style={{ position: "relative" }}>
                              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: MUTED }}>USD</span>
                              <input value={payAmounts[m] ?? ""} onChange={(e) => setPayAmounts((p) => ({ ...p, [m]: e.target.value.replace(/[^0-9.,]/g, "") }))} inputMode="decimal" placeholder="0" style={{ ...contactInputStyle(), width: 120, paddingLeft: 42, textAlign: "right" }} />
                            </div>
                            {arsTag(montoDe(m))}
                          </div>;
                    })()}
                  </div>;
                })}
              </div>}
            </div>;
          })()}
        </div>

        {formError && <ErrorBanner msg={formError} />}
        <button onClick={()=>setPaso(2)} style={{...backBtnStyle(), width: "100%", marginBottom: -4}}>← Volver a la forma de entrega</button>
        <button onClick={confirm} disabled={confirming} style={ctaStyle(confirming)}>{confirming ? "Confirmando…" : "Confirmar y avisar a Argencargo"}</button>
        <p style={{ textAlign: "center", fontSize: 10.5, color: MUTED, margin: "-8px 0 0" }}>Al confirmar, un asesor coordina el retiro o el envío por WhatsApp.</p>
        </>}
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

// Selector de día (próximos 5 días hábiles) + franja horaria. Las franjas dependen del modo:
// oficina cada 2 hs (10-18), fletero propio cada 3 hs (10-19).
function DiaFranja({ modo, dia, setDia, franja, setFranja }) {
  const franjas = modo === "oficina"
    ? ["10:00 a 12:00", "12:00 a 14:00", "14:00 a 16:00", "16:00 a 18:00"]
    : ["10:00 a 13:00", "13:00 a 16:00", "16:00 a 19:00"];
  const dias = [];
  const d = new Date();
  while (dias.length < 5) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const hoy = dias.length === 0 && new Date().toDateString() === d.toDateString();
      const nombre = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][dow];
      dias.push({ iso, label: hoy ? "Hoy" : nombre, fecha: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    d.setDate(d.getDate() + 1);
  }
  const chip = (active) => ({ padding: "9px 6px", borderRadius: 9, cursor: "pointer", textAlign: "center", border: `1.5px solid ${active ? GOLD_A : LINE}`, background: active ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : "#fff", boxShadow: active ? "0 3px 10px rgba(184,149,106,0.18)" : "none" });
  return <div style={{ marginTop: 12 }}>
    <label style={fieldLblStyle()}>{modo === "oficina" ? "¿Qué día pasás a retirar?" : "¿Qué día querés recibirla?"}</label>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(62px,1fr))", gap: 6, marginBottom: 10 }}>
      {dias.map((x) => <div key={x.iso} onClick={() => setDia(x.iso)} style={chip(dia === x.iso)}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: INK }}>{x.label}</div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>{x.fecha}</div>
      </div>)}
    </div>
    <label style={fieldLblStyle()}>¿En qué horario?</label>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(108px,1fr))", gap: 6 }}>
      {franjas.map((f) => <div key={f} onClick={() => setFranja(f)} style={chip(franja === f)}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: INK, whiteSpace: "nowrap" }}>{f}</div>
      </div>)}
    </div>
  </div>;
}

// Checkbox de forma de pago (cuadrado con tilde: comunica que se puede marcar más de uno).
function PayCheck({ checked, onClick, label, meta, disabled }) {
  return <div onClick={disabled ? undefined : onClick} style={{
    display: "flex", alignItems: "center", gap: 11, padding: "12px 13px", borderRadius: 10,
    border: `1.5px solid ${checked ? GOLD_A : LINE}`, cursor: disabled ? "not-allowed" : "pointer",
    background: checked ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : "#fff",
    boxShadow: checked ? "0 3px 10px rgba(184,149,106,0.18)" : "none", marginBottom: 7, opacity: disabled ? 0.45 : 1,
  }}>
    <span style={{ width: 19, height: 19, borderRadius: 6, flexShrink: 0, border: `2px solid ${checked ? GOLD_A : "#c9bb9c"}`, background: checked ? GOLD_A : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 900 }}>{checked ? "✓" : ""}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{label}</div>
      <div style={{ fontSize: 10.5, color: MUTED, marginTop: 1 }}>{meta}</div>
    </div>
  </div>;
}

// Cartel de error propio (nada de alert() del navegador).
function ErrorBanner({ msg }) {
  return <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 14px", borderRadius: 10, marginTop: 12, background: "#fdecea", border: "1.5px solid rgba(192,57,43,0.35)", color: "#8f2318", fontSize: 12.5, fontWeight: 600, lineHeight: 1.45 }}>
    <span style={{ fontSize: 14 }}>⚠️</span><span>{msg}</span>
  </div>;
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

function ConfirmedView({ data, delivery, clientName }) {
  const L = { efectivo: "Efectivo", transferencia: "Transferencia en pesos", crypto: "Cripto (USDT)" };
  const payLabel = Array.isArray(data.payment_methods) && data.payment_methods.length > 1
    ? data.payment_methods.map((p) => `${L[p.method] || p.method} (${fmt(p.amount)})`).join(" + ")
    : (L[data.payment_method] || data.payment_method);
  const entregaLabel = delivery === "oficina" ? "Retiro por oficina" : delivery === "propio" ? `Envío a domicilio · ${data.delivery_zone || ""}` : "Envío por transportista";
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
        {data.delivery_day && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${LINE}` }}><span style={{ color: MUTED }}>{delivery === "oficina" ? "Retirás" : "Te la llevamos"}</span><span style={{ fontWeight: 700 }}>{new Date(data.delivery_day + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "numeric" })} · {data.delivery_slot}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${LINE}`, gap: 12 }}><span style={{ color: MUTED }}>Pago</span><span style={{ fontWeight: 700, textAlign: "right" }}>{payLabel}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0" }}><span style={{ color: MUTED }}>Total</span><span style={{ fontWeight: 800, color: GOLD_A }}>{fmt(data.total)}</span></div>
      </div>
      <div style={payDetailStyle()}>
        {data.payment_method === "crypto" && <span>Te vamos a pasar por WhatsApp la billetera y el monto exacto a transferir.</span>}
        {data.payment_method === "transferencia" && <span>Te vamos a pasar por WhatsApp el monto exacto a transferir en pesos, al tipo de cambio del momento.</span>}
        {data.payment_method === "efectivo" && <span>Tené preparado el pago en efectivo (ARS o USD) para cuando {delivery === "oficina" ? "retires tu carga." : "la recibas."}</span>}
      </div>
    </div>
  </div>;
}

function pageStyle() { return { minHeight: "100vh", background: NAVY, padding: "32px 18px 60px", display: "flex", justifyContent: "center", alignItems: "flex-start", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", color: "#fff" }; }
function cardStyle() { return { maxWidth: 640, width: "100%", background: CREAM, borderRadius: 14, overflow: "hidden", boxShadow: "0 28px 80px rgba(0,0,0,0.5)" }; }
function lblStyle() { return { fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(232,208,152,0.65)", textTransform: "uppercase", marginBottom: 3 }; }
function backBtnStyle() { return { padding: "12px 16px", fontSize: 13.5, fontWeight: 700, borderRadius: 11, border: `1px solid ${LINE}`, background: "#fff", color: MUTED, cursor: "pointer" }; }
function nextBtnStyle() { return { width: "100%", marginTop: 14, padding: "12px 16px", fontSize: 14, fontWeight: 700, borderRadius: 11, border: "none", background: "#0A1628", color: "#fff", cursor: "pointer" }; }
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
function contactInputStyle() { return { width: "100%", boxSizing: "border-box", padding: "9px 11px", fontSize: 13, borderRadius: 9, border: "1px solid rgba(10,22,40,0.16)", background: "#fff", color: "#0A1628", outline: "none" }; }
function noteBoxStyle() { return { marginTop: 10, padding: "10px 12px", borderRadius: 8, fontSize: 11, lineHeight: 1.55, background: "#f4efe3", border: `1px solid ${LINE}`, color: "#4a4536" }; }
function adjustCardStyle(credit) { return { display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", borderRadius: 9, fontSize: 12, lineHeight: 1.4, marginTop: 10, background: credit ? "#eaf6ef" : "#fdf1ea", border: `1px solid ${credit ? "rgba(30,125,79,.25)" : "rgba(180,90,40,.25)"}`, color: credit ? "#1e5c3d" : "#7a4a28" }; }
function payDetailStyle() { return { marginTop: 11, padding: "12px 14px", borderRadius: 9, background: "#f4efe3", border: `1px solid ${LINE}`, fontSize: 11.5, color: "#4a4536", lineHeight: 1.6 }; }
function ctaStyle(loading) { return { width: "100%", padding: "14px 20px", background: NAVY, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, letterSpacing: "0.03em", cursor: loading ? "wait" : "pointer", fontFamily: "inherit" }; }
