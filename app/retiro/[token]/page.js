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
  // Dirección estructurada para envío propio (precargada del cliente, editable)
  const [dirCalle, setDirCalle] = useState("");
  const [dirPiso, setDirPiso] = useState("");
  const [dirLocalidad, setDirLocalidad] = useState("");
  const [dirCP, setDirCP] = useState("");
  const [dirTel, setDirTel] = useState("");
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
  const [payMethods, setPayMethods] = useState([]); // arranca sin nada marcado; se pueden combinar
  const [payAmounts, setPayAmounts] = useState({}); // montos por método (el último seleccionado absorbe el resto)
  const [cashCurrencyMode, setCashCurrencyMode] = useState("USD"); // USD | ARS | mixto (solo efectivo)
  const [formError, setFormError] = useState("");
  const [taxOpen, setTaxOpen] = useState(false); // solapita del desglose de impuestos
  const [cashMixUsd, setCashMixUsd] = useState(""); // efectivo "un poco de cada": cuánto USD (opcional)
  const [cashMixArs, setCashMixArs] = useState(""); // y cuánto ARS (opcional)
  // Si paga (parte) en efectivo: con cuánto llega, para tener el cambio listo.
  const [cashAmount, setCashAmount] = useState("");
  const [cashCurrency, setCashCurrency] = useState("USD");
  const [carrierMode, setCarrierMode] = useState(""); // sucursal | domicilio (solo con transportista)
  const [contacto, setContacto] = useState({ nombre: "", apellido: "", dni: "", email: "", telefono: "", direccion: "", piso: "", cp: "", sucursal: "" });
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  // Otras cargas listas del mismo cliente: ids seleccionadas para coordinar en la misma visita.
  const [selExtra, setSelExtra] = useState([]);

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
        // arranca sin metodo marcado; con transportista el efectivo directamente no aparece habilitado
        setDirCalle(d.client?.street || "");
        setDirPiso(d.client?.floor_apt || "");
        setDirLocalidad(d.client?.city || "");
        setDirCP(d.client?.postal_code || "");
        setDirTel(d.client?.whatsapp || "");
        // Modo RI: el courier ya entrega/entregó en el domicilio — el link es solo
        // detalle + documentos + pago (sin modalidad, día ni franja).
        if (d.modo_ri) setPayMethods((p) => p.length ? p : ["transferencia"]);
        // Cargas hermanas: las que todavía no coordinaron arrancan marcadas (lo normal es
        // llevarse todo junto); las ya coordinadas para otro día arrancan sin marcar.
        const herm = Array.isArray(d.hermanas) ? d.hermanas : [];
        setSelExtra(herm.filter((h) => !h.delivery_confirmed_at).map((h) => h.id));
        // Op ya confirmada: abrir directo en el resumen final (no repetir el formulario).
        // "Cambiar algo" vuelve al paso 2 con las elecciones precargadas.
        if (d.op.delivery_confirmed_at) {
          const bt2 = Number(d.op.budget_total || 0);
          let saldo2 = Math.max(0, bt2 + Number(d.op.debt_applied_usd || 0) - Number(d.op.total_anticipos || 0) - Number(d.op.collected_amount || 0) - Number(d.op.credit_applied_usd || 0));
          // Si fue coordinada en grupo, el resumen muestra el total de la visita completa.
          const delGrupo = d.op.delivery_group_id ? herm.filter((h) => h.delivery_group_id === d.op.delivery_group_id) : [];
          saldo2 += delGrupo.reduce((a, h) => a + Number(h.saldo || 0), 0);
          if (delGrupo.length) setSelExtra(delGrupo.map((h) => h.id));
          // El split guardado es por op — para el resumen del grupo, el monto mostrado es el total de la visita.
          let split2 = Array.isArray(d.op.payment_split) ? d.op.payment_split : null;
          if (split2 && split2.length === 1 && delGrupo.length) split2 = [{ ...split2[0], amount: Math.round(saldo2 * 100) / 100 }];
          const metodos2 = split2 ? split2.map((p) => p.method) : (d.op.payment_method_chosen ? [d.op.payment_method_chosen] : []);
          if (d.modo_ri) setDelivery("ri"); else if (d.op.delivery_choice) setDelivery(d.op.delivery_choice);
          if (d.op.delivery_day) setDiaEntrega(d.op.delivery_day);
          if (d.op.delivery_slot) setFranjaEntrega(d.op.delivery_slot);
          if (metodos2.length) setPayMethods([metodos2[0]]);
          const efSplit = split2 ? split2.find((p) => p.method === "efectivo") : null;
          if (efSplit?.currency) setCashCurrencyMode(efSplit.currency);
          setConfirmed({
            total: Math.round(saldo2 * 100) / 100,
            ops_incluidas: [d.op.operation_code, ...delGrupo.map((h) => h.operation_code)],
            delivery_choice: d.op.delivery_choice,
            delivery_zone: d.op.delivery_zone,
            delivery_day: d.op.delivery_day,
            delivery_slot: d.op.delivery_slot,
            payment_method: d.op.payment_method_chosen,
            payment_methods: split2,
            transfer: metodos2.includes("transferencia") ? { alias: d.payment?.alias || "", titular: d.payment?.titular || "" } : null,
            crypto_wallet: metodos2.includes("crypto") ? (d.payment?.crypto_wallet || "") : null,
            tc_venta: d.tc?.venta || null,
          });
        }
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
  useEffect(() => { if (payMethods[0]) setPayment(payMethods[0]); setFormError(""); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMethods]);
  useEffect(() => { setFormError(""); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, diaEntrega, franjaEntrega, delivery]);

  if (loading) return <div style={pageStyle()}><p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Cargando…</p></div>;
  if (err) return <div style={pageStyle()}><div style={{ maxWidth: 440, padding: 30, background: "rgba(255,255,255,0.04)", borderRadius: 14, textAlign: "center" }}><p style={{ fontSize: 15, fontWeight: 600, color: "#f87171" }}>{err}</p></div></div>;
  if (!data) return null;

  const { op, client, cargo, delivery: deliveryInfo } = data;
  const modoRi = !!data.modo_ri;
  const facturas = Array.isArray(data.facturas) ? data.facturas : [];
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
  // Cargas hermanas seleccionadas: se suman al total de la visita (cada op mantiene su saldo).
  const hermanas = Array.isArray(data.hermanas) ? data.hermanas : [];
  const extraSel = hermanas.filter((h) => selExtra.includes(h.id));
  const saldoExtras = extraSel.reduce((a, h) => a + Number(h.saldo || 0), 0);
  const total = Math.round((saldo + saldoExtras + deliveryCost) * 100) / 100;

  const efectivoBlocked = delivery === "carrier";

  // Devuelve el motivo por el que no se puede avanzar, o null si está todo bien.
  const validarEntrega = () => {
    if (modoRi) return null; // entrega el courier: no hay nada que coordinar
    if (delivery === "carrier") {
      if (!carrierMode) return "Elegí si lo recibís en sucursal o en tu domicilio.";
      if (!contacto.nombre.trim() || !contacto.apellido.trim()) return "Completá nombre y apellido de quien recibe.";
      if (contacto.dni.replace(/\D/g, "").length < 7) return "Completá el DNI de quien recibe — el transportista lo necesita para el despacho.";
      if (contacto.telefono.replace(/\D/g, "").length < 8) return "Completá el teléfono de quien recibe — el transportista llama antes de entregar.";
      if (!contacto.cp.trim()) return "Completá el código postal — el transportista lo necesita para cotizar el despacho.";
      if (carrierMode === "sucursal" && !contacto.sucursal.trim()) return "Indicá en qué sucursal lo vas a retirar.";
      if (carrierMode === "domicilio" && !contacto.direccion.trim()) return "Completá la dirección de entrega.";
    }
    if (delivery === "propio" && (!dirCalle.trim() || !dirLocalidad.trim())) return "Completá al menos calle y localidad de la entrega.";
    if ((delivery === "oficina" || delivery === "propio") && (!diaEntrega || !franjaEntrega)) return delivery === "oficina" ? "Elegí qué día y en qué horario pasás a retirar." : "Elegí qué día y en qué franja querés recibir la entrega.";
    return null;
  };
  // Un solo método de pago (pedido 28/08): el split quedó soportado en el server por si vuelve.
  const splitCliente = payMethods.length ? [{ method: payMethods[0], amount: total }] : [];
  const tcVenta = Number(data?.tc?.venta || 0);
  const validarPago = () => {
    if (payMethods.length === 0) return "Elegí una forma de pago.";
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
        modo_ri: modoRi || undefined,
        delivery_choice: modoRi ? null : delivery,
        delivery_address: delivery === "propio" ? [dirCalle.trim(), dirPiso.trim(), dirLocalidad.trim(), dirCP.trim() ? `CP ${dirCP.trim()}` : ""].filter(Boolean).join(", ") : null,
        payment_method: payMethods[0],
        payment_methods: splitCliente.map((p) => p.method === "efectivo" ? { ...p, currency: cashCurrencyMode, ...(cashCurrencyMode === "mixto" ? { usd_part: Number(String(cashMixUsd).replace(",", ".")) || 0, ars_part: Number(String(cashMixArs).replace(",", ".")) || 0 } : {}) } : p),
        cash_amount: payMethods.includes("efectivo") && Number(String(cashAmount).replace(",", ".")) > 0 ? Number(String(cashAmount).replace(",", ".")) : null,
        cash_currency: payMethods.includes("efectivo") ? cashCurrency : null,
        delivery_day: (delivery === "oficina" || delivery === "propio") ? diaEntrega : null,
        delivery_slot: (delivery === "oficina" || delivery === "propio") ? franjaEntrega : null,
        delivery_contact: delivery === "carrier" ? contacto : delivery === "propio" ? { direccion: dirCalle.trim(), piso: dirPiso.trim(), localidad: dirLocalidad.trim(), cp: dirCP.trim(), telefono: dirTel.trim() } : null,
        carrier_mode: delivery === "carrier" ? carrierMode : null,
        extra_ops: selExtra,
      }),
    });
    const d = await r.json();
    setConfirming(false);
    if (!r.ok) { setFormError(d.error || "Error al confirmar"); return; }
    setConfirmed(d);
  };

  if (confirmed) return <ConfirmedView data={confirmed} delivery={modoRi ? "ri" : delivery} clientName={clientName} op={op} cargo={cargo} taxDetail={data.tax_detail} isBlanco={isBlanco} onEdit={() => { setConfirmed(null); setPaso(data.modo_ri ? 3 : 2); }} />;

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
        {modoRi&&<div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 15px", borderRadius: 11, background: "#eaf6ef", border: "1px solid rgba(30,125,79,.25)", color: "#1e5c3d", fontSize: 12.5, lineHeight: 1.5, fontWeight: 600 }}>
          <span style={{ fontSize: 16 }}>📦</span><span>Tu carga {op.status === "entregada" ? "fue entregada" : "se entrega"} directamente en tu domicilio por el courier internacional — no hace falta coordinar nada. Acá tenés el detalle completo, la documentación y los datos para abonar.</span>
        </div>}
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
            {op.budget_taxes > 0 && op.taxes_billed_by_argencargo !== false && <>
              <div style={{ ...rowStyle(), cursor: data.tax_detail ? "pointer" : "default" }} onClick={() => data.tax_detail && setTaxOpen(v => !v)}>
                <span>Impuestos &amp; Aduana{data.tax_detail && <span style={{ marginLeft: 6, fontSize: 10, color: GOLD_A, fontWeight: 700 }}>{taxOpen ? "ocultar ▲" : "ver desglose ▼"}</span>}</span>
                <span style={rowValStyle()}>{fmt(op.budget_taxes)}</span>
              </div>
              {taxOpen && data.tax_detail && <div style={{ padding: "8px 0 8px 12px", borderLeft: `2px solid ${LINE}`, margin: "4px 0" }}>
                {data.tax_detail.productos.map((pr, i) => <div key={i} style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: INK, margin: "0 0 3px" }}>{pr.name}</p>
                  {pr.rows.map(([l, v], k) => <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, padding: "2px 0" }}><span>{l}</span><span style={{ fontWeight: 600, color: "#5c5646" }}>{fmt(v)}</span></div>)}
                </div>)}
                {data.tax_detail.extras.map(([l, v], k) => <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, padding: "2px 0" }}><span>{l}</span><span style={{ fontWeight: 600, color: "#5c5646" }}>{fmt(v)}</span></div>)}
              </div>}
            </>}
            {op.budget_seguro > 0 && <div style={{ ...rowStyle(), borderBottom: "none" }}><span>Seguro de Carga</span><span style={rowValStyle()}>{fmt(op.budget_seguro)}</span></div>}
          </div>}
          {facturas.length > 0 && <>
            <p style={{ ...factLblStyle(), margin: "12px 0 6px" }}>📄 Documentos</p>
            {facturas.map((f, i) => <a key={i} href={f.url} target="_blank" rel="noopener" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: `1px solid ${LINE}`, background: "#fff", textDecoration: "none", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>🧾 Factura {f.numero}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: GOLD_A }}>ver / descargar →</span>
            </a>)}
          </>}
          {cargo.tracking.length > 0 && <>
            <p style={{ ...factLblStyle(), margin: "12px 0 6px" }}>Tracking</p>
            <div style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 12, color: INK, lineHeight: 1.9 }}>
              {cargo.tracking.map((t, i) => <div key={i}>– {t}</div>)}
            </div>
          </>}
          {paso===1&&(hermanas.length===0||modoRi)&&<button onClick={()=>setPaso(modoRi?3:2)} style={nextBtnStyle()}>Continuar →</button>}
        </div>

        {/* Cargas hermanas: coordinar todo en una sola visita, o destildar las que no se lleva hoy. */}
        {hermanas.length>0&&!modoRi&&<div style={stepStyle()}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 6 }}><span style={stepNStyle()}>+</span><span style={stepTitleStyle()}>También tenés {hermanas.length === 1 ? "otra carga lista" : `${hermanas.length} cargas más listas`}</span></div>
          <p style={{ fontSize: 11, color: MUTED, margin: "0 0 10px", lineHeight: 1.5 }}>Podés coordinar todo en una sola visita — destildá las que no quieras incluir ahora.</p>
          {hermanas.map((h) => {
            const on = selExtra.includes(h.id);
            const yaCoord = !!h.delivery_confirmed_at && h.delivery_day;
            return <PayCheck key={h.id} checked={on} onClick={() => setSelExtra((p) => on ? p.filter((x) => x !== h.id) : [...p, h.id])}
              label={`${h.operation_code} · ${h.description || "Carga"}`}
              meta={<>{h.bultos} {h.bultos === 1 ? "bulto" : "bultos"} · saldo {fmt(h.saldo)}{yaCoord && <span style={{ color: GOLD_A, fontWeight: 700 }}> · ya coordinada: {new Date(h.delivery_day + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "numeric" })}{h.delivery_slot ? ` · ${h.delivery_slot}` : ""}</span>}</>} />;
          })}
          {selExtra.length>0&&<p style={{ fontSize: 11, color: "#1e5c3d", background: "#eaf6ef", border: "1px solid rgba(30,125,79,.2)", borderRadius: 8, padding: "8px 10px", margin: "6px 0 0", lineHeight: 1.5 }}>Vas a coordinar <b>{1 + selExtra.length} cargas juntas</b> — total de la visita: <b>{fmt(total)}</b></p>}
          {paso===1&&<button onClick={()=>setPaso(2)} style={nextBtnStyle()}>Continuar →</button>}
        </div>}

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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
              <input value={dirCalle} onChange={e => setDirCalle(e.target.value)} placeholder="Calle y número" style={{ ...contactInputStyle(), gridColumn: "1 / -1" }} />
              <input value={dirPiso} onChange={e => setDirPiso(e.target.value)} placeholder="Piso / depto (si lleva)" style={contactInputStyle()} />
              <input value={dirLocalidad} onChange={e => setDirLocalidad(e.target.value)} placeholder="Localidad" style={contactInputStyle()} />
              <input value={dirCP} onChange={e => setDirCP(e.target.value)} placeholder="Código postal" inputMode="numeric" style={contactInputStyle()} />
              <input value={dirTel} onChange={e => setDirTel(e.target.value)} placeholder="Teléfono de contacto" inputMode="tel" style={contactInputStyle()} />
            </div>
            <p style={{ fontSize: 10, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>Precargamos los datos registrados en tu cuenta — editá lo que necesites.</p>
            <DiaFranja modo="propio" dia={diaEntrega} setDia={setDiaEntrega} franja={franjaEntrega} setFranja={setFranjaEntrega} />
          </div>}
          {!hasPropio && <OptRow selected={delivery === "carrier"} onClick={() => setDelivery("carrier")} label="Envío por Via Cargo / Andreani" meta="Tu zona está fuera del reparto propio de Argencargo" price="A coordinar" />}

          {/* Próximamente: envío directo al Full de Mercado Libre (solo anuncio, sin flujo aún) */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 9, border: `1.5px dashed ${LINE}`, background: "#f7f4ec", marginBottom: 7, opacity: 0.75, cursor: "default" }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, border: "2px solid #d5c9ab", background: "transparent" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>Envío a Full de Mercado Libre</div>
              <div style={{ fontSize: 10.5, color: MUTED, marginTop: 1 }}>Muy pronto vas a poder mandar tu carga directo al depósito de Full</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", color: "#8b6f4a", background: "linear-gradient(135deg,#fdf6e8,#faedd0)", border: `1px solid ${GOLD_A}`, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>PRÓXIMAMENTE</span>
          </div>

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
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(10,22,40,0.65)", marginTop: 2 }}>{CHANNEL_NAME[op.channel] || op.channel} · {modoRi ? "Entrega a domicilio por courier" : delivery === "oficina" ? "Retiro por oficina" : delivery === "propio" ? `Envío a domicilio · ${inferredZone}` : "Envío por transportista"}</p>
            </div>
            {(() => {
              const todoEnPesos = payMethods.length === 1 && tcVenta > 0 && (payMethods[0] === "transferencia" || (payMethods[0] === "efectivo" && cashCurrencyMode === "ARS"));
              return todoEnPesos
                ? <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em" }}>ARS {Math.round(total * tcVenta).toLocaleString("es-AR")}</p>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(10,22,40,0.6)" }}>USD {total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                : <p style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em" }}>{fmt(total)}</p>;
            })()}
          </div>
          {creditApp > 0.01 && <div style={adjustCardStyle(true)}><span>✓</span><span>Se descontaron <b>{fmt(creditApp)}</b> de tu saldo a favor</span></div>}
          {data.preferential && <div style={adjustCardStyle(true)}><span>⭐</span><span>Tenés <b>tarifa preferencial</b>: USD {data.preferential.usd_por_kg} por kilo, en vez de USD {data.preferential.lista_usd_por_kg}.</span></div>}
          {creditApp <= 0.01 && debtApp > 0.01 && <div style={adjustCardStyle(false)}><span>ⓘ</span><span>Se sumaron <b>{fmt(debtApp)}</b> por saldo pendiente anterior</span></div>}

          {(()=>{
            const elegir = (m) => setPayMethods([m]);
            const soloRemoto = modoRi; // courier entrega: el pago es remoto (transferencia/cripto)
            return <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: INK, margin: "0 0 9px" }}>¿Cómo querés pagar?</p>
              {!soloRemoto && <OptRow selected={payMethods.includes("efectivo")} onClick={() => !efectivoBlocked && elegir("efectivo")} label="Efectivo" meta={efectivoBlocked ? "No disponible para envíos con transportista" : "En dólares o pesos, al retirar o recibir"} disabled={efectivoBlocked} />}
              <OptRow selected={payMethods.includes("transferencia")} onClick={() => elegir("transferencia")} label="Transferencia en pesos" meta={payMethods.includes("transferencia") && tcVenta > 0 ? `Pagás ARS ${Math.round(total * tcVenta).toLocaleString("es-AR")}` : "El importe se pasa a pesos automáticamente"} />
              <OptRow selected={payMethods.includes("crypto")} onClick={() => elegir("crypto")} label="Cripto (USDT)" meta="Red TRC-20 · te pasamos la billetera por WhatsApp" />

              {payMethods.includes("efectivo") && <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 11, background: "#f4efe3", border: `1px solid ${LINE}` }}>
                <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(10,22,40,0.55)", margin: "0 0 8px" }}>💵 ¿Con qué vas a pagar?</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 6, marginBottom: 10 }}>
                  {[["USD", "Dólares"], ["ARS", "Pesos"], ["mixto", "Un poco de cada"]].map(([k, l]) => <button key={k} type="button" onClick={() => setCashCurrencyMode(k)} style={{ padding: "9px 8px", fontSize: 11.5, fontWeight: 800, borderRadius: 9, cursor: "pointer", border: `1.5px solid ${cashCurrencyMode === k ? GOLD_A : LINE}`, background: cashCurrencyMode === k ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : "#fff", color: cashCurrencyMode === k ? "#8b6f4a" : MUTED }}>{l}</button>)}
                </div>
                {cashCurrencyMode === "ARS" && tcVenta > 0 && <p style={{ fontSize: 11, color: "#1e5c3d", background: "#eaf6ef", border: "1px solid rgba(30,125,79,.2)", borderRadius: 8, padding: "8px 10px", margin: "0 0 10px", lineHeight: 1.5 }}>En pesos son <b>ARS {Math.round(total * tcVenta).toLocaleString("es-AR")}</b> (valor de hoy — se ajusta al día del pago).</p>}
                {cashCurrencyMode === "mixto" && <div style={{ margin: "0 0 10px" }}>
                  <p style={{ fontSize: 10.5, color: MUTED, margin: "0 0 7px", lineHeight: 1.5 }}>Si ya sabés cuánto vas a poner en cada moneda, anotalo (opcional):</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: MUTED }}>USD</span>
                      <input value={cashMixUsd} onChange={(e) => setCashMixUsd(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="0" style={{ ...contactInputStyle(), paddingLeft: 44, textAlign: "right" }} />
                    </div>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: MUTED }}>ARS</span>
                      <input value={cashMixArs} onChange={(e) => setCashMixArs(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="0" style={{ ...contactInputStyle(), paddingLeft: 44, textAlign: "right" }} />
                    </div>
                  </div>
                </div>}
                <p style={{ fontSize: 10.5, color: MUTED, margin: "0 0 7px", lineHeight: 1.5 }}>Si necesitás cambio, decinos con cuánto llegás así lo tenemos listo. (Opcional)</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={cashAmount} onChange={(e) => setCashAmount(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="Ej: 600" style={{ ...contactInputStyle(), flex: 1 }} />
                  <div style={{ display: "flex", gap: 4 }}>
                    {["USD", "ARS"].map((c) => <button key={c} type="button" onClick={() => setCashCurrency(c)} style={{ padding: "8px 13px", fontSize: 12, fontWeight: 800, borderRadius: 9, cursor: "pointer", border: `1.5px solid ${cashCurrency === c ? GOLD_A : LINE}`, background: cashCurrency === c ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : "#fff", color: cashCurrency === c ? "#8b6f4a" : MUTED }}>{c}</button>)}
                  </div>
                </div>
              </div>}
            </div>;
          })()}
        </div>

        {formError && <ErrorBanner msg={formError} />}
        <button onClick={()=>setPaso(modoRi?1:2)} style={{...backBtnStyle(), width: "100%", marginBottom: -4}}>← Volver{modoRi?"":" a la forma de entrega"}</button>
        <button onClick={confirm} disabled={confirming} style={ctaStyle(confirming)}>{confirming ? "Confirmando…" : "Confirmar y avisar a Argencargo"}</button>
        <p style={{ textAlign: "center", fontSize: 10.5, color: MUTED, margin: "-8px 0 0" }}>{modoRi ? "Al confirmar registramos tu forma de pago — cualquier duda te respondemos por WhatsApp." : "Al confirmar, un asesor coordina el retiro o el envío por WhatsApp."}</p>
        </>}
      </div>

      <div style={{ background: NAVY, color: "#fff", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.08em" }}>ARGENCARGO</p>
          <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>{deliveryInfo.office_hours ? `Tel · ${deliveryInfo.office_hours}` : ""}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: GOLD_B, letterSpacing: "0.03em" }}>argencargo.com.ar</p>
          <a href="/terminos" target="_blank" rel="noopener" style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>El servicio se rige por nuestros Términos y Condiciones</a>
        </div>
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
  // Una franja de HOY ya no sirve si su hora de fin ya pasó (12:24 → la de 10-12 no va más).
  const ahora = new Date();
  const finDe = (f) => Number(f.split(" a ")[1].split(":")[0]);
  const franjaPasada = (isoDia, f) => {
    const hoyIso = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
    return isoDia === hoyIso && (ahora.getHours() + ahora.getMinutes() / 60) >= finDe(f);
  };
  const dias = [];
  const d = new Date();
  while (dias.length < 5) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const esHoy = new Date().toDateString() === d.toDateString();
      const nombre = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][dow];
      // "Hoy" se deshabilita si ya no queda ninguna franja disponible.
      const sinFranjas = esHoy && franjas.every((f) => franjaPasada(iso, f));
      if (!(esHoy && sinFranjas && dias.length === 0)) dias.push({ iso, label: esHoy ? "Hoy" : nombre, fecha: `${d.getDate()}/${d.getMonth() + 1}` });
      else dias.push({ iso, label: "Hoy", fecha: `${d.getDate()}/${d.getMonth() + 1}`, disabled: true });
    }
    d.setDate(d.getDate() + 1);
  }
  const chip = (active, disabled) => ({ padding: "9px 6px", borderRadius: 9, cursor: disabled ? "not-allowed" : "pointer", textAlign: "center", border: `1.5px solid ${active ? GOLD_A : LINE}`, background: active ? "linear-gradient(135deg,#fdf6e8,#faedd0)" : "#fff", boxShadow: active ? "0 3px 10px rgba(184,149,106,0.18)" : "none", opacity: disabled ? 0.35 : 1 });
  return <div style={{ marginTop: 12 }}>
    <label style={fieldLblStyle()}>{modo === "oficina" ? "¿Qué día pasás a retirar?" : "¿Qué día querés recibirla?"}</label>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(62px,1fr))", gap: 6, marginBottom: 10 }}>
      {dias.map((x) => <div key={x.iso} onClick={() => { if (x.disabled) return; setDia(x.iso); if (franja && franjaPasada(x.iso, franja)) setFranja(""); }} style={chip(dia === x.iso, x.disabled)}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: INK }}>{x.label}</div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>{x.fecha}</div>
      </div>)}
    </div>
    <label style={fieldLblStyle()}>¿En qué horario?</label>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(108px,1fr))", gap: 6 }}>
      {franjas.map((f) => { const off = dia ? franjaPasada(dia, f) : false; return <div key={f} onClick={() => !off && setFranja(f)} style={chip(franja === f, off)}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: off ? MUTED : INK, whiteSpace: "nowrap", textDecoration: off ? "line-through" : "none" }}>{f}</div>
      </div>; })}
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

function ConfirmedView({ data, delivery, clientName, op, cargo, taxDetail, isBlanco, onEdit }) {
  const L = { efectivo: "Efectivo", transferencia: "Transferencia en pesos", crypto: "Cripto (USDT)" };
  const tc = Number(data.tc_venta || 0);
  const enPesos = (p) => p.method === "transferencia" || (p.method === "efectivo" && p.currency === "ARS");
  const montoTxt = (p) => enPesos(p) && tc > 0 ? `ARS ${Math.round(p.amount * tc).toLocaleString("es-AR")}` : fmt(p.amount);
  const split = Array.isArray(data.payment_methods) ? data.payment_methods : null;
  const todoEnPesos = split && split.length > 0 && tc > 0 && split.every(enPesos);
  const payLabel = split && split.length > 1
    ? split.map((p) => `${L[p.method] || p.method} (${montoTxt(p)})`).join(" + ")
    : split && split[0] ? `${L[split[0].method]}${split[0].currency === "ARS" ? " en pesos" : split[0].currency === "mixto" ? " (USD + ARS)" : ""}` : (L[data.payment_method] || data.payment_method);
  const transfPart = split ? split.find((p) => p.method === "transferencia") : null;
  const entregaLabel = delivery === "ri" ? "Entrega a domicilio por courier" : delivery === "oficina" ? "Retiro por oficina" : delivery === "propio" ? `Envío a domicilio · ${data.delivery_zone || ""}` : "Envío por transportista";
  const [verDetalle, setVerDetalle] = useState(false);
  const rowS = { display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${LINE}`, gap: 12 };
  return <div style={pageStyle()}>
    <div style={{ maxWidth: 480, width: "100%", padding: "32px 28px", background: CREAM, color: INK, borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.55)" }}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#fff", marginBottom: 10 }}>✓</div>
        <p style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.01em" }}>{delivery === "ri" ? "¡Listo! Acá tenés todo para abonar" : `¡Listo, ya coordinaste ${delivery === "oficina" ? "tu retiro" : delivery === "propio" ? "tu entrega" : "tu envío"}!`}</p>
      </div>
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 800, margin: "0 0 10px" }}>Resumen</p>
        {Array.isArray(data.ops_incluidas) && data.ops_incluidas.length > 1 && <div style={rowS}><span style={{ color: MUTED }}>Cargas</span><span style={{ fontWeight: 700, textAlign: "right", fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 11.5 }}>{data.ops_incluidas.join(" + ")}</span></div>}
        <div style={rowS}><span style={{ color: MUTED }}>Entrega</span><span style={{ fontWeight: 700, textAlign: "right" }}>{entregaLabel}</span></div>
        {data.delivery_day && <div style={rowS}><span style={{ color: MUTED }}>{delivery === "oficina" ? "Retirás" : "Te la llevamos"}</span><span style={{ fontWeight: 700 }}>{new Date(data.delivery_day + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "numeric" })} · {data.delivery_slot}</span></div>}
        <div style={rowS}><span style={{ color: MUTED }}>Pago</span><span style={{ fontWeight: 700, textAlign: "right" }}>{payLabel}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0" }}><span style={{ color: MUTED }}>Total</span><span style={{ fontWeight: 800, color: GOLD_A, textAlign: "right" }}>{todoEnPesos ? <>ARS {Math.round(data.total * tc).toLocaleString("es-AR")}<span style={{ display: "block", fontSize: 10.5, color: MUTED, fontWeight: 600 }}>USD {Number(data.total).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></> : fmt(data.total)}</span></div>
      </div>

      {transfPart && data.transfer && (data.transfer.alias || data.transfer.titular) && <div style={{ background: "#eaf6ef", border: "1px solid rgba(30,125,79,.25)", borderRadius: 12, padding: "13px 16px", marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1e5c3d", margin: "0 0 7px" }}>💸 Datos para transferir</p>
        {data.transfer.alias && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}><span style={{ color: "#3d6b52" }}>Alias</span><span style={{ fontWeight: 800, fontFamily: "'SF Mono','JetBrains Mono',monospace" }}>{data.transfer.alias}</span></div>}
        {data.transfer.titular && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}><span style={{ color: "#3d6b52" }}>Titular</span><span style={{ fontWeight: 700 }}>{data.transfer.titular}</span></div>}
        {tc > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", borderTop: "1px dashed rgba(30,125,79,.25)", marginTop: 4, paddingTop: 7 }}><span style={{ color: "#3d6b52" }}>Monto a transferir</span><span style={{ fontWeight: 800 }}>ARS {Math.round(transfPart.amount * tc).toLocaleString("es-AR")}</span></div>}
        <p style={{ fontSize: 10, color: "#3d6b52", margin: "7px 0 0", lineHeight: 1.5 }}>El monto en pesos se ajusta al valor del día en que transferís — te lo reconfirmamos por WhatsApp.</p>
      </div>}

      {data.crypto_wallet && <div style={{ background: "#f4efe3", border: `1px solid ${LINE}`, borderRadius: 12, padding: "13px 16px", marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(10,22,40,0.55)", margin: "0 0 6px" }}>🪙 Billetera USDT (TRC-20)</p>
        <p style={{ fontSize: 11.5, fontFamily: "'SF Mono','JetBrains Mono',monospace", wordBreak: "break-all", margin: 0, fontWeight: 700 }}>{data.crypto_wallet}</p>
      </div>}

      {op && <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setVerDetalle(v => !v)}>
          <p style={{ fontSize: 12, fontWeight: 800, margin: 0 }}>Detalle de la operación · {op.operation_code}</p>
          <span style={{ fontSize: 10, color: GOLD_A, fontWeight: 700 }}>{verDetalle ? "ocultar ▲" : "ver ▼"}</span>
        </div>
        {verDetalle && <div style={{ marginTop: 8 }}>
          {cargo && <div style={rowS}><span style={{ color: MUTED }}>Bultos</span><span style={{ fontWeight: 700 }}>{cargo.bultos}</span></div>}
          {cargo && isBlanco && <div style={rowS}><span style={{ color: MUTED }}>Peso facturable</span><span style={{ fontWeight: 700 }}>{cargo.peso_facturable.toLocaleString("es-AR")} kg</span></div>}
          {op.budget_flete > 0 && <div style={rowS}><span style={{ color: MUTED }}>Flete internacional</span><span style={{ fontWeight: 700 }}>{fmt(op.budget_flete)}</span></div>}
          {op.budget_taxes > 0 && op.taxes_billed_by_argencargo !== false && <div style={rowS}><span style={{ color: MUTED }}>Impuestos &amp; Aduana</span><span style={{ fontWeight: 700 }}>{fmt(op.budget_taxes)}</span></div>}
          {taxDetail && taxDetail.productos.map((pr, i2) => <div key={i2} style={{ padding: "4px 0 4px 12px", borderLeft: `2px solid ${LINE}` }}>
            <p style={{ fontSize: 10.5, fontWeight: 800, margin: "0 0 2px" }}>{pr.name}</p>
            {pr.rows.map(([l, v], k) => <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: MUTED, padding: "1px 0" }}><span>{l}</span><span>{fmt(v)}</span></div>)}
          </div>)}
          {taxDetail && taxDetail.extras.map(([l, v], k) => <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: MUTED, padding: "1px 0 1px 12px" }}><span>{l}</span><span>{fmt(v)}</span></div>)}
          {op.budget_seguro > 0 && <div style={rowS}><span style={{ color: MUTED }}>Seguro de carga</span><span style={{ fontWeight: 700 }}>{fmt(op.budget_seguro)}</span></div>}
        </div>}
      </div>}

      <button onClick={onEdit} style={{ width: "100%", padding: "12px 16px", fontSize: 13, fontWeight: 700, borderRadius: 11, border: `1.5px solid ${GOLD_A}`, background: "#fff", color: "#8b6f4a", cursor: "pointer" }}>✏️ Cambiar algo (día, horario o forma de pago)</button>
      <p style={{ textAlign: "center", fontSize: 10, color: MUTED, margin: "8px 0 0", lineHeight: 1.5 }}>Podés modificar tu elección las veces que necesites — siempre vale la última confirmación.</p>
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
