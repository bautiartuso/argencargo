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
const fmtM3 = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtCm = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 1 });

// Marítimo: por cada tracking, cantidad de bultos, medidas, m³ por bulto y m³ de la fila; al pie el
// total de la carga (05/10/2026).
function MedidasMaritimo({ m }) {
  return <div style={{ marginTop: 14 }}>
    {m.grupos.map((g, i) => <div key={i} style={{ padding: "11px 0", borderTop: `1px solid ${LINE}` }}>
      <p style={{ margin: "0 0 7px", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>Tracking</p>
      <p style={{ margin: "0 0 8px", fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 700, color: INK, wordBreak: "break-all" }}>{g.tracking || "Sin tracking"}</p>
      {g.bultos.map((b, k) => <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", padding: "5px 10px", marginBottom: 4, borderRadius: 8, background: "#fff", border: `1px solid ${LINE}` }}>
        <span style={{ fontSize: 12, color: INK }}><b>{b.q} {b.q === 1 ? "bulto" : "bultos"}</b> · {fmtCm(b.l)} × {fmtCm(b.w)} × {fmtCm(b.h)} cm</span>
        <span style={{ fontSize: 11.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{b.q > 1 ? <>{fmtM3(b.m3_u)} m³ c/u · </> : null}<b style={{ color: INK }}>{fmtM3(b.m3_t)} m³</b></span>
      </div>)}
      {m.grupos.length > 1 && g.bultos.length > 1 && <p style={{ margin: "4px 2px 0", fontSize: 11, color: MUTED, textAlign: "right" }}>Subtotal {fmtM3(g.m3)} m³</p>}
    </div>)}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "11px 12px", borderRadius: 10, background: "#f3ead9", border: "1px solid #ddc99a" }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: INK }}>Total de la carga</span>
      <span style={{ fontSize: 15, fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" }}>{fmtM3(m.m3_total)} m³</span>
    </div>
  </div>;
}
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
  const [taxOpen, setTaxOpen] = useState(true); // desglose de impuestos: abierto de entrada (02/10/2026)
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
  const [verCarga, setVerCarga] = useState(null); // carga desplegada en el link único
  // Cotización del envío con la dirección que el cliente editó (localidad / CP). null = la de la carga.
  const [cotEnvio, setCotEnvio] = useState(null);

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
          // Siempre el saldo actual de la operación (22/10/2026): si el presupuesto cambió después de
          // coordinar, el link muestra lo mismo que el panel. Con un solo método, su monto es el saldo.
          const total2 = Math.round(saldo2 * 100) / 100;
          if (split2 && split2.length === 1) split2 = [{ ...split2[0], amount: total2 }];
          setConfirmed({
            total: total2,
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
  // Si el cliente cambia localidad o CP del envío a domicilio, se vuelve a cotizar (con el peso de
  // las cargas que coordina juntas). Si vuelve a lo registrado, queda la cotización original.
  useEffect(() => {
    if (!data || delivery !== "propio") return;
    const orig = (dirLocalidad || "") === (data.client?.city || "") && (dirCP || "") === (data.client?.postal_code || "") && selExtra.length === 0;
    if (orig) { setCotEnvio(null); return; }
    const t = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ cotizar: "1", localidad: dirLocalidad || "", cp: dirCP || "", extra: selExtra.join(",") });
        const r = await fetch(`/api/entrega/${token}?${q}`);
        const d = await r.json();
        if (r.ok) setCotEnvio({ price: d.price, zone: d.zone });
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [data, delivery, dirLocalidad, dirCP, selExtra, token]);
  useEffect(() => { setFormError(""); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, diaEntrega, franjaEntrega, delivery]);

  if (loading) return <div style={pageStyle()}><p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Cargando…</p></div>;
  if (err) return <div style={pageStyle()}><div style={{ maxWidth: 440, padding: 30, background: "rgba(255,255,255,0.04)", borderRadius: 14, textAlign: "center" }}><p style={{ fontSize: 15, fontWeight: 600, color: "#f87171" }}>{err}</p></div></div>;
  if (!data) return null;

  const { op, client, cargo, delivery: deliveryInfo } = data;
  const modoRi = !!data.modo_ri;
  // Carga ya entregada: el link solo deja cambiar la forma de pago (el día y la entrega ya pasaron).
  const entregada = !!op.delivery_completed_at && !modoRi;
  const facturas = Array.isArray(data.facturas) ? data.facturas : [];
  const isBlanco = op.channel?.includes("blanco");
  const esMaritimo = String(op.channel || "").startsWith("maritimo");
  const inferredZone = deliveryInfo.inferred_zone;
  const hasPropio = deliveryInfo.price != null;
  const clientName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Cliente";

  const precioPropio = cotEnvio ? cotEnvio.price : deliveryInfo.price;
  const deliveryCost = delivery === "propio" ? Number(precioPropio || 0) : 0;
  const debtApp = Number(op.debt_applied_usd || 0);
  const creditApp = Number(op.credit_applied_usd || 0);
  const totAnt = Number(op.total_anticipos || 0);
  const collected = Number(op.collected_amount || 0);
  const saldo = Math.max(0, op.budget_total + debtApp - totAnt - collected - creditApp);
  // Cargas hermanas seleccionadas: se suman al total de la visita (cada op mantiene su saldo).
  const hermanas = Array.isArray(data.hermanas) ? data.hermanas : [];
  const extraSel = hermanas.filter((h) => selExtra.includes(h.id));
  const saldoExtras = extraSel.reduce((a, h) => a + Number(h.saldo || 0), 0);
  // El saldo ya trae el envío coordinado antes (está en budget_total): se suma solo la diferencia.
  const total = Math.round((saldo + saldoExtras + (entregada ? 0 : deliveryCost - Number(op.delivery_cost_usd || 0))) * 100) / 100;

  const efectivoBlocked = delivery === "carrier";

  // Devuelve el motivo por el que no se puede avanzar, o null si está todo bien.
  const validarEntrega = () => {
    if (modoRi || entregada) return null; // entrega el courier / ya entregada: no hay nada que coordinar
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
    if (delivery === "propio" && cotEnvio && cotEnvio.price == null) return "Esa localidad queda fuera de nuestro reparto propio. Elegí retiro por oficina o envío por transportista.";
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
        solo_pago: entregada || undefined,
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

  // Link único: con otras cargas listas, todas se muestran iguales (ordenadas por cuándo se avisaron),
  // así el link es el mismo para el cliente sin importar desde qué carga lo abra.
  const multi = hermanas.length > 0 && !modoRi && !entregada;
  const cargas = [{ key: "main", main: true, id: null, operation_code: op.operation_code, description: op.description, channel: op.channel, bultos: cargo.bultos, m3: cargo.maritimo?.m3_total || 0, peso_facturable: cargo.peso_facturable, saldo: Math.round(saldo * 100) / 100, orden: op.delivery_ready_at || op.created_at || "" },
    ...hermanas.map((h) => ({ ...h, key: h.id, orden: h.delivery_ready_at || h.created_at || "" }))]
    .sort((a, b) => String(a.orden || "9").localeCompare(String(b.orden || "9")));
  const canales = [...new Set((multi ? cargas.filter((c) => c.main || selExtra.includes(c.id)) : [op]).map((c) => CHANNEL_NAME[c.channel] || c.channel))];
  const canalTxt = canales.length === 1 ? canales[0] : "Varios canales";
  const detalleOp = <>
          {!multi&&<div style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${LINE}` }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: "linear-gradient(135deg,#f3ead9,#e8d8b8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: "1px solid #ddc99a" }}>📦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, lineHeight: 1.35 }}>{op.description || "Tu mercadería"}</div>
              <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{cargo.bultos} {cargo.bultos === 1 ? "bulto" : "bultos"}</div>
            </div>
          </div>}
          <div style={{ display: "flex", gap: 8, marginTop: multi ? 4 : 12, flexWrap: "wrap" }}>
            {isBlanco && !esMaritimo && <div style={factStyle()}><div style={factLblStyle()}>Peso factur.</div><div style={factValStyle()}>{cargo.peso_facturable.toLocaleString("es-AR")} kg</div></div>}
            {(!isBlanco || esMaritimo) && <div style={factStyle()}><div style={factLblStyle()}>Bultos</div><div style={factValStyle()}>{cargo.bultos}</div></div>}
            {esMaritimo && cargo.maritimo && <div style={factStyle()}><div style={factLblStyle()}>Volumen</div><div style={factValStyle()}>{fmtM3(cargo.maritimo.m3_total)} m³</div></div>}
          </div>
          {isBlanco && <div style={{ marginTop: 12, paddingTop: 4, borderTop: `1px solid ${LINE}` }}>
            {op.budget_flete > 0 && (() => {
              // Valor por kilo a la vista (y si es preferencial, contra el de lista); baterías aparte.
              const fd = data.flete_detalle; const pref = data.preferential;
              const n2 = (v) => Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              return <>
                <div style={rowStyle()}>
                  <span>Flete Internacional{fd && <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 2 }}>USD {n2(fd.usd_por_kg)} por kg × {Number(fd.kg).toLocaleString("es-AR")} kg{pref && <> · <b style={{ color: "#1e7d4f" }}>tarifa preferencial</b> <s style={{ opacity: 0.7 }}>USD {n2(pref.lista_usd_por_kg)}</s></>}</span>}</span>
                  <span style={{ ...rowValStyle(), whiteSpace: "nowrap", paddingLeft: 12 }}>{fmt(Number(op.budget_flete) - Number(fd?.bateria || 0))}</span>
                </div>
                {fd?.bateria > 0 && <div style={rowStyle()}><span>Recargo por baterías</span><span style={rowValStyle()}>{fmt(fd.bateria)}</span></div>}
              </>;
            })()}
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
          {esMaritimo && cargo.maritimo && <MedidasMaritimo m={cargo.maritimo} />}
          {cargo.tracking.length > 0 && <>
            <p style={{ ...factLblStyle(), margin: "12px 0 6px" }}>Tracking</p>
            <div style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 12, color: INK, lineHeight: 1.9 }}>
              {cargo.tracking.map((t, i) => <div key={i}>– {t}</div>)}
            </div>
          </>}
  </>;

  if (confirmed) return <ConfirmedView data={confirmed} delivery={modoRi ? "ri" : delivery} clientName={clientName} op={op} cargo={cargo} taxDetail={data.tax_detail} isBlanco={isBlanco} entregada={entregada} onEdit={() => { setConfirmed(null); setPaso(data.modo_ri || entregada ? 3 : 2); }} />;

  return <div style={pageStyle()}>
    <div style={cardStyle()}>
      {/* header */}
      <div style={{ background: NAVY, color: "#fff", padding: "20px 28px 18px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
          <img src={LOGO} alt="Argencargo" style={{ height: 40, width: "auto" }} />
          {multi
            ? <div style={{ textAlign: "right" }}>
                <span style={{ display: "inline-block", padding: "4px 11px", borderRadius: 999, background: "rgba(232,208,152,0.14)", border: "1px solid rgba(232,208,152,0.35)", color: GOLD_B, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{cargas.length} cargas listas</span>
                <div style={{ marginTop: 7, fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 700, color: "rgba(232,208,152,0.85)", letterSpacing: "0.03em" }}>{cargas.map((c) => c.operation_code).join(" · ")}</div>
              </div>
            : <div style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, color: GOLD_B, letterSpacing: "0.03em", textAlign: "right", lineHeight: 1 }}>{op.operation_code}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div><p style={lblStyle()}>Cliente</p><p style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{clientName}</p></div>
          <div style={{ textAlign: "right" }}><p style={lblStyle()}>Canal</p><p style={{ fontSize: 17, fontWeight: 700, color: GOLD_B, letterSpacing: "-0.01em" }}>{canalTxt}</p></div>
        </div>
        <div style={{ height: 4, position: "absolute", left: 0, right: 0, bottom: 0, background: `linear-gradient(90deg,${GOLD_A},${GOLD_B},${GOLD_A})` }} />
      </div>

      <div style={{ padding: "22px 24px 26px", display: "flex", flexDirection: "column", gap: 16, background: CREAM, color: INK }}>
        {paso===1&&<>
        {modoRi&&<div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 15px", borderRadius: 11, background: "#eaf6ef", border: "1px solid rgba(30,125,79,.25)", color: "#1e5c3d", fontSize: 12.5, lineHeight: 1.5, fontWeight: 600 }}>
          <span style={{ fontSize: 16 }}>📦</span><span>Tu carga {op.status === "entregada" ? "fue entregada" : "se entrega"} directamente en tu domicilio por el courier internacional — no hace falta coordinar nada. Acá tenés el detalle completo, la documentación y los datos para abonar.</span>
        </div>}
        {/* 01 — carga */}
        {!multi&&<div style={stepStyle()}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 12 }}><span style={stepNStyle()}>01</span><span style={stepTitleStyle()}>Tu carga</span></div>
          {detalleOp}
          {paso===1&&<button onClick={()=>setPaso(modoRi?3:2)} style={nextBtnStyle()}>Continuar →</button>}
        </div>}

        {/* Link único (28/10/2026): varias cargas listas se coordinan como una sola visita. Todas se
            ven iguales; la del link no se puede sacar, las demás sí (se apagan y no suman). */}
        {multi&&<div style={stepStyle()}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 4 }}><span style={stepNStyle()}>01</span><span style={stepTitleStyle()}>Tus cargas</span></div>
          <p style={{ fontSize: 12, color: MUTED, margin: "0 0 14px", lineHeight: 1.55 }}>Tenés <b style={{ color: INK }}>{cargas.length} cargas listas</b>. Las coordinamos juntas: una sola visita y un solo pago.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {cargas.map((c, i) => {
              const on = c.main || selExtra.includes(c.id);
              const abierta = verCarga === c.key;
              const yaCoord = !c.main && !!c.delivery_confirmed_at && c.delivery_day;
              const esMar = String(c.channel || "").startsWith("maritimo");
              const medida = esMar ? (c.m3 > 0 ? `${fmtM3(c.m3)} m³` : null) : (c.peso_facturable > 0 ? `${Number(c.peso_facturable).toLocaleString("es-AR")} kg` : null);
              return <div key={c.key} style={{ borderRadius: 13, border: `1.5px solid ${on ? "#ddc99a" : LINE}`, background: on ? "#fff" : "#fbfaf6", boxShadow: on ? "0 4px 14px rgba(184,149,106,0.12)" : "none", transition: "all .18s", overflow: "hidden" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 14px" }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 800, background: on ? `linear-gradient(135deg,${GOLD_A},${GOLD_B})` : "#efe9dc", color: on ? NAVY : MUTED, transition: "all .18s" }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0, opacity: on ? 1 : 0.55, transition: "opacity .18s" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: INK, lineHeight: 1.3, letterSpacing: "-0.005em" }}>{c.description || "Tu mercadería"}</div>
                    <div style={{ marginTop: 3, fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: GOLD_A, letterSpacing: "0.02em" }}>{c.operation_code}</div>
                    <div style={{ marginTop: 3, fontSize: 11, color: MUTED, lineHeight: 1.45 }}>{c.bultos} {c.bultos === 1 ? "bulto" : "bultos"}{medida ? ` · ${medida}` : ""}{canales.length > 1 || cargas.some((x) => x.channel !== c.channel) ? ` · ${CHANNEL_NAME[c.channel] || c.channel}` : ""}</div>
                    {yaCoord && <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: "#8b6f4a" }}>Ya coordinada para el {new Date(c.delivery_day + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "numeric" })}{c.delivery_slot ? ` · ${c.delivery_slot}` : ""}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: on ? INK : MUTED, fontVariantNumeric: "tabular-nums", textDecoration: on ? "none" : "line-through", whiteSpace: "nowrap" }}>{fmt(c.saldo)}</div>
                    <button type="button" onClick={() => { if (!c.main) setSelExtra((p) => on ? p.filter((x) => x !== c.id) : [...p, c.id]); }} style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 9px 4px 6px", borderRadius: 999, border: `1px solid ${on ? "rgba(30,125,79,.3)" : LINE}`, background: on ? "#eaf6ef" : "#fff", color: on ? "#1e5c3d" : MUTED, fontSize: 10.5, fontWeight: 800, cursor: c.main ? "default" : "pointer", fontFamily: "inherit", transition: "all .18s" }}>
                      <span style={{ width: 14, height: 14, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? "#1e7d4f" : "transparent", border: on ? "none" : "1.5px solid #c9bb9c", color: "#fff", fontSize: 9 }}>{on ? "✓" : ""}</span>{on ? "Incluida" : "Sumar"}
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => setVerCarga(abierta ? null : c.key)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", border: "none", borderTop: `1px solid ${LINE}`, background: "transparent", color: GOLD_A, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  <span>{abierta ? "Ocultar detalle" : "Ver detalle"}</span><span style={{ display: "inline-block", transform: abierta ? "rotate(180deg)" : "none", transition: "transform .18s" }}>▾</span>
                </button>
                {abierta && <div style={{ padding: "2px 14px 14px" }}>
                  {c.main ? detalleOp : <>
                    {c.tracking?.length > 0 && <>
                      <p style={{ ...factLblStyle(), margin: "10px 0 6px" }}>Tracking</p>
                      <div style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 12, color: INK, lineHeight: 1.9 }}>{c.tracking.map((t, k) => <div key={k}>– {t}</div>)}</div>
                    </>}
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <div style={factStyle()}><div style={factLblStyle()}>Bultos</div><div style={factValStyle()}>{c.bultos}</div></div>
                      {esMar && c.m3 > 0 && <div style={factStyle()}><div style={factLblStyle()}>Volumen</div><div style={factValStyle()}>{fmtM3(c.m3)} m³</div></div>}
                      {!esMar && c.peso_facturable > 0 && <div style={factStyle()}><div style={factLblStyle()}>Peso factur.</div><div style={factValStyle()}>{Number(c.peso_facturable).toLocaleString("es-AR")} kg</div></div>}
                    </div>
                    <p style={{ fontSize: 11, color: MUTED, margin: "10px 0 0", lineHeight: 1.5 }}>El detalle completo de esta carga lo tenés en tu portal.</p>
                  </>}
                </div>}
              </div>;
            })}
          </div>
          <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 13, background: `radial-gradient(120% 140% at 100% 0%, rgba(232,208,152,0.22), transparent 60%), ${NAVY}`, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(232,208,152,0.8)" }}>Total de la visita</p>
              <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.65)" }}>{1 + selExtra.length} de {cargas.length} cargas</p>
            </div>
            <p style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", color: GOLD_B, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(total)}</p>
          </div>
          {paso===1&&<button onClick={()=>setPaso(2)} style={nextBtnStyle()}>{selExtra.length ? `Coordinar las ${1 + selExtra.length} juntas →` : "Continuar →"}</button>}
        </div>}
        </>}

        {paso===2&&<>
        {/* 02 — entrega */}
        <div style={stepStyle()}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 12 }}><span style={stepNStyle()}>02</span><span style={stepTitleStyle()}>¿Cómo la recibís?</span></div>
          <OptRow selected={delivery === "oficina"} onClick={() => setDelivery("oficina")} label="Retiro por oficina" meta={`${deliveryInfo.office_address || ""}${deliveryInfo.office_locality ? " · " + deliveryInfo.office_locality : ""}${deliveryInfo.office_hours ? " · " + deliveryInfo.office_hours : ""}`} />
          {delivery === "oficina" && <div style={{ margin: "4px 0 10px" }}><DiaFranja modo="oficina" minDia={data?.delivery_min_day} feriados={data?.feriados_ar} dia={diaEntrega} setDia={setDiaEntrega} franja={franjaEntrega} setFranja={setFranjaEntrega} /></div>}
          {hasPropio && <OptRow selected={delivery === "propio"} onClick={() => setDelivery("propio")} label="Envío a domicilio" meta={`Coordinamos día y horario · ${cotEnvio?.zone || inferredZone}`} price={precioPropio != null ? "+ " + fmt(precioPropio) : "Fuera de zona"} />}
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
            <DiaFranja modo="propio" minDia={data?.delivery_min_day} feriados={data?.feriados_ar} dia={diaEntrega} setDia={setDiaEntrega} franja={franjaEntrega} setFranja={setFranjaEntrega} />
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
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(10,22,40,0.65)", marginTop: 2 }}>{selExtra.length ? `${1 + selExtra.length} cargas` : (CHANNEL_NAME[op.channel] || op.channel)} · {modoRi ? "Entrega a domicilio por courier" : delivery === "oficina" ? "Retiro por oficina" : delivery === "propio" ? `Envío a domicilio · ${cotEnvio?.zone || inferredZone}` : "Envío por transportista"}</p>
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
        {entregada
          ? <button onClick={()=>window.location.reload()} style={{...backBtnStyle(), width: "100%", marginBottom: -4}}>← Volver sin cambiar</button>
          : <button onClick={()=>setPaso(modoRi?1:2)} style={{...backBtnStyle(), width: "100%", marginBottom: -4}}>← Volver{modoRi?"":" a la forma de entrega"}</button>}
        <button onClick={confirm} disabled={confirming} style={ctaStyle(confirming)}>{confirming ? "Confirmando…" : entregada ? "Guardar forma de pago" : "Confirmar y avisar a Argencargo"}</button>
        <p style={{ textAlign: "center", fontSize: 10.5, color: MUTED, margin: "-8px 0 0" }}>{entregada ? "Guardamos tu nueva forma de pago — cualquier duda te respondemos por WhatsApp." : modoRi ? "Al confirmar registramos tu forma de pago — cualquier duda te respondemos por WhatsApp." : "Al confirmar, un asesor coordina el retiro o el envío por WhatsApp."}</p>
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
function DiaFranja({ modo, dia, setDia, franja, setFranja, minDia, feriados }) {
  const fer = new Set(Array.isArray(feriados) ? feriados : []);
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
  // Excepción por contenedor: no se puede coordinar antes de minDia → la lista arranca ese día.
  const desde = minDia ? new Date(minDia + "T12:00:00") : null;
  if (desde && desde > d) { d.setFullYear(desde.getFullYear(), desde.getMonth(), desde.getDate()); }
  while (dias.length < 5) {
    const dow = d.getDay();
    const isoD = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (dow >= 1 && dow <= 5 && !fer.has(isoD)) {
      const iso = isoD;
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
    {desde && desde > new Date() && <p style={{ fontSize: 11.5, color: MUTED, margin: "0 0 8px", lineHeight: 1.5 }}>Esta carga se puede coordinar a partir del <strong>{["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][desde.getDay()]} {desde.getDate()}/{desde.getMonth() + 1}</strong>.</p>}
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

function ConfirmedView({ data, delivery, clientName, op, cargo, taxDetail, isBlanco, entregada, onEdit }) {
  const esMaritimoCv = String(op?.channel || "").startsWith("maritimo");
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
  // Rediseño 22/10/2026: cabecera navy con el estado, total grande, datos para pagar con botón de copiar.
  const nombre = (clientName || "").split(" ")[0];
  const diaTxt = (d) => new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const titulo = entregada ? "¡Ya recibiste tu carga!" : delivery === "ri" ? "Acá tenés todo para abonar" : delivery === "oficina" ? "¡Retiro coordinado!" : delivery === "propio" ? "¡Entrega coordinada!" : "¡Envío coordinado!";
  const bajada = entregada && op?.delivery_completed_at ? `Entregada el ${new Date(op.delivery_completed_at).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}`
    : data.delivery_day ? `${delivery === "oficina" ? "Te esperamos el" : "Te la llevamos el"} ${diaTxt(data.delivery_day)} · ${data.delivery_slot || ""}`
    : delivery === "carrier" ? "Te avisamos apenas se despache" : null;
  const [copiado, setCopiado] = useState("");
  const copiar = (k, t) => { try { navigator.clipboard.writeText(String(t)); setCopiado(k); setTimeout(() => setCopiado(""), 1600); } catch {} };
  const btnCopiar = (k, t) => <button type="button" onClick={() => copiar(k, t)} style={{ flexShrink: 0, height: 30, padding: "0 11px", borderRadius: 8, border: "1px solid rgba(30,125,79,.3)", background: copiado === k ? "#1e7d4f" : "#fff", color: copiado === k ? "#fff" : "#1e5c3d", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}>{copiado === k ? "Copiado ✓" : "Copiar"}</button>;
  const totalGrande = todoEnPesos ? `ARS ${Math.round(data.total * tc).toLocaleString("es-AR")}` : fmt(data.total);
  const fila = (l, v) => <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "11px 0", borderTop: `1px solid ${LINE}`, fontSize: 13.5 }}><span style={{ color: MUTED }}>{l}</span><span style={{ fontWeight: 700, textAlign: "right", color: INK }}>{v}</span></div>;
  return <div style={pageStyle()}>
    <div style={{ maxWidth: 480, width: "100%", background: CREAM, color: INK, borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 90px rgba(0,0,0,0.55)" }}>
      <div style={{ background: `radial-gradient(120% 120% at 100% 0%, rgba(232,208,152,0.18), transparent 55%), ${NAVY}`, color: "#fff", padding: "22px 24px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <img src={LOGO} alt="Argencargo" style={{ height: 26, width: "auto", opacity: 0.95 }} />
          <span style={{ fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: GOLD_B, letterSpacing: "0.04em" }}>{Array.isArray(data.ops_incluidas) && data.ops_incluidas.length > 1 ? data.ops_incluidas.join(" + ") : op?.operation_code}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22 }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#22c55e,#15803d)", boxShadow: "0 8px 22px rgba(34,197,94,0.35)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <div style={{ minWidth: 0 }}>
            {nombre && <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>{nombre},</p>}
            <p style={{ margin: "1px 0 0", fontSize: 20, fontWeight: 800, letterSpacing: "-0.015em", lineHeight: 1.2 }}>{titulo}</p>
          </div>
        </div>
        {bajada && <p style={{ margin: "14px 0 0", padding: "10px 12px", borderRadius: 11, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 13, color: "rgba(255,255,255,0.88)", fontWeight: 600, textTransform: "none" }}>{bajada.charAt(0).toUpperCase() + bajada.slice(1)}</p>}
      </div>

      <div style={{ padding: "20px 20px 22px" }}>
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: "18px 18px 8px", marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>Total a abonar</p>
          <p style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 800, letterSpacing: "-0.025em", color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.05 }}>{totalGrande}</p>
          {todoEnPesos && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{fmt(data.total)} · dólar {tc.toLocaleString("es-AR")}</p>}
          <div style={{ marginTop: 14 }}>
            {fila("Entrega", entregaLabel)}
            {fila("Pago", payLabel)}
          </div>
        </div>

        {transfPart && data.transfer && (data.transfer.alias || data.transfer.titular) && <div style={{ background: "#eaf6ef", border: "1px solid rgba(30,125,79,.22)", borderRadius: 16, padding: "16px 16px 14px", marginBottom: 12 }}>
          <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1e5c3d", margin: "0 0 10px" }}>Datos para transferir</p>
          {data.transfer.alias && (() => {
            // El dato guardado puede traer "CBU xxxx · CUIT yyyy": se muestra y se copia el CBU solo (22/10/2026).
            const raw = String(data.transfer.alias);
            const cbu = raw.match(/\d{22}/)?.[0];
            const cuit = raw.match(/CUIT\s*([\d-]{11,13})/i)?.[1];
            return <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, fontSize: 11, color: "#3d6b52" }}>{cbu ? "CBU" : "Alias"}</p><p style={{ margin: "2px 0 0", fontWeight: 800, fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 13.5, wordBreak: "break-all", color: INK }}>{cbu || raw}</p></div>
                {btnCopiar("alias", cbu || raw)}
              </div>
              {cuit && <div style={{ padding: "8px 0", borderTop: "1px solid rgba(30,125,79,.15)" }}><p style={{ margin: 0, fontSize: 11, color: "#3d6b52" }}>CUIT</p><p style={{ margin: "2px 0 0", fontWeight: 700, fontFamily: "'SF Mono','JetBrains Mono',monospace", fontSize: 13, color: INK }}>{cuit}</p></div>}
            </>;
          })()}
          {data.transfer.titular && <div style={{ padding: "8px 0", borderTop: "1px solid rgba(30,125,79,.15)" }}><p style={{ margin: 0, fontSize: 11, color: "#3d6b52" }}>Titular</p><p style={{ margin: "2px 0 0", fontWeight: 800, fontSize: 13.5, color: INK }}>{data.transfer.titular}</p></div>}
          {tc > 0 && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0 2px", borderTop: "1px solid rgba(30,125,79,.15)" }}>
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 11, color: "#3d6b52" }}>Monto a transferir</p><p style={{ margin: "2px 0 0", fontWeight: 800, fontSize: 17, color: INK, fontVariantNumeric: "tabular-nums" }}>ARS {Math.round(transfPart.amount * tc).toLocaleString("es-AR")}</p></div>
            {btnCopiar("monto", String(Math.round(transfPart.amount * tc)))}
          </div>}
          <p style={{ fontSize: 11, color: "#3d6b52", margin: "10px 0 0", lineHeight: 1.5 }}>El monto en pesos se ajusta al dólar del día en que transferís. Mandanos el comprobante por WhatsApp.</p>
        </div>}

        {data.crypto_wallet && <div style={{ background: "#f4efe3", border: `1px solid ${LINE}`, borderRadius: 16, padding: "16px", marginBottom: 12 }}>
          <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, margin: "0 0 8px" }}>Billetera USDT · TRC-20</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <p style={{ flex: 1, fontSize: 12, fontFamily: "'SF Mono','JetBrains Mono',monospace", wordBreak: "break-all", margin: 0, fontWeight: 700 }}>{data.crypto_wallet}</p>
            {btnCopiar("wallet", data.crypto_wallet)}
          </div>
        </div>}

        {op && <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setVerDetalle(v => !v)}>
            <p style={{ fontSize: 13, fontWeight: 800, margin: 0 }}>Detalle de la operación</p>
            <span style={{ fontSize: 11.5, color: GOLD_A, fontWeight: 800 }}>{verDetalle ? "Ocultar ▲" : "Ver ▼"}</span>
          </div>
          {verDetalle && <div style={{ marginTop: 8 }}>
            {cargo && <div style={rowS}><span style={{ color: MUTED }}>Bultos</span><span style={{ fontWeight: 700 }}>{cargo.bultos}</span></div>}
            {cargo && esMaritimoCv && cargo.maritimo && <div style={rowS}><span style={{ color: MUTED }}>Volumen</span><span style={{ fontWeight: 700 }}>{fmtM3(cargo.maritimo.m3_total)} m³</span></div>}
            {cargo && isBlanco && !esMaritimoCv && <div style={rowS}><span style={{ color: MUTED }}>Peso facturable</span><span style={{ fontWeight: 700 }}>{cargo.peso_facturable.toLocaleString("es-AR")} kg</span></div>}
            {op.budget_flete > 0 && <div style={rowS}><span style={{ color: MUTED }}>Flete internacional</span><span style={{ fontWeight: 700 }}>{fmt(op.budget_flete)}</span></div>}
            {op.budget_taxes > 0 && op.taxes_billed_by_argencargo !== false && <div style={rowS}><span style={{ color: MUTED }}>Impuestos &amp; Aduana</span><span style={{ fontWeight: 700 }}>{fmt(op.budget_taxes)}</span></div>}
            {taxDetail && taxDetail.productos.map((pr, i2) => <div key={i2} style={{ padding: "4px 0 4px 12px", borderLeft: `2px solid ${LINE}` }}>
              <p style={{ fontSize: 10.5, fontWeight: 800, margin: "0 0 2px" }}>{pr.name}</p>
              {pr.rows.map(([l, v], k) => <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: MUTED, padding: "1px 0" }}><span>{l}</span><span>{fmt(v)}</span></div>)}
            </div>)}
            {taxDetail && taxDetail.extras.map(([l, v], k) => <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: MUTED, padding: "1px 0 1px 12px" }}><span>{l}</span><span>{fmt(v)}</span></div>)}
            {op.budget_seguro > 0 && <div style={rowS}><span style={{ color: MUTED }}>Seguro de carga</span><span style={{ fontWeight: 700 }}>{fmt(op.budget_seguro)}</span></div>}
            {Number(op.delivery_cost_usd || 0) > 0 && <div style={rowS}><span style={{ color: MUTED }}>Envío a domicilio</span><span style={{ fontWeight: 700 }}>{fmt(op.delivery_cost_usd)}</span></div>}
          </div>}
        </div>}

        <button onClick={onEdit} style={{ width: "100%", height: 48, fontSize: 14, fontWeight: 800, borderRadius: 13, border: "none", background: NAVY, color: "#fff", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 10px 24px rgba(10,22,40,0.2)" }}>{entregada ? "Cambiar la forma de pago" : delivery === "ri" ? "Cambiar la forma de pago" : "Cambiar día, horario o forma de pago"}</button>
        <p style={{ textAlign: "center", fontSize: 11.5, color: MUTED, margin: "10px 0 0", lineHeight: 1.5 }}>{entregada ? "La carga ya se entregó: solo podés cambiar cómo pagás." : "Podés cambiarlo las veces que quieras: vale la última confirmación."}</p>
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
