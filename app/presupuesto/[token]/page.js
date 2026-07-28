"use client";
import { useState, useEffect } from "react";

// Cotización del admin vista por el cliente, sin login. Compara las alternativas que se le ofrecen
// (aéreo, marítimo LCL/FCL, marítimo integral) con sus tiempos y precios, y elige una. La elección
// queda registrada Y el cliente nos manda el WhatsApp: el aviso automático solo no alcanzaba,
// queremos la conversación abierta con el cliente del otro lado.
//
// Mismo lenguaje visual que el link de retiro: un solo documento continuo (header navy compacto +
// cuerpo crema), no tarjetas sueltas flotando. Los estilos van en una hoja con clases porque la
// mayoría de los clientes lo abre del celular y hacen falta media queries de verdad: con estilos
// inline las tablas obligaban a scrollear de costado.

const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const WA = "5491125088580";

const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (n) => `USD ${fmt(n)}`;
const fmtKg = (n) => `${fmt(n)} kg`;
const fmtCbm = (n) => `${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} m³`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }) : "";
const dim = (v) => Number(num(v).toFixed(1)).toLocaleString("es-AR");
const diasRestantes = (d) => { if (!d) return null; const ms = new Date(d) - new Date(); return ms <= 0 ? 0 : Math.ceil(ms / 86400000); };

const esAereo = (a) => String(a.type || a.key || "").includes("aereo");
// El integral se cobra como un servicio único (ya lleva adentro impuestos y recargos), así que la
// línea del desglose no puede llamarse "flete": el cliente ve un número que no cierra con el total.
const esIntegral = (a) => String(a.type || a.key || "").endsWith("_b");
const rotuloServicio = (a) => esIntegral(a)
  ? (esAereo(a) ? "Servicio aéreo de importación completa" : "Servicio marítimo de importación completa")
  : (esAereo(a) ? "Flete aéreo internacional" : "Flete marítimo internacional");

const CSS = `
.pz-wrap{min-height:100vh;background:#0A1628;padding:26px 16px 50px;display:flex;justify-content:center;font-family:'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased}
.pz-doc{width:100%;max-width:780px;background:#faf8f3;border-radius:14px;overflow:hidden;box-shadow:0 28px 80px rgba(0,0,0,.5);color:#1a1a1a}
.pz-head{background:#0A1628;padding:18px 26px 16px;position:relative}
.pz-head-top{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
.pz-head h1{font-size:19px;font-weight:800;color:#fff;letter-spacing:-.02em;margin:14px 0 0;line-height:1.25}
.pz-head h1 em{font-style:normal;color:#E8D098}
.pz-head p.sub{font-size:12.5px;color:rgba(255,255,255,.55);margin:5px 0 0}
.pz-rule{height:3px;position:absolute;left:0;right:0;bottom:0;background:linear-gradient(90deg,#E8D098,#B8956A,#E8D098)}
.pz-body{padding:0}
.pz-sec{padding:20px 26px;border-bottom:1px solid #eae4d6}
.pz-sec:last-child{border-bottom:none}
.pz-lbl{font-size:9.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(26,26,26,.45);margin:0 0 12px}
.pz-sub{font-size:12px;font-weight:800;margin:0 0 8px;letter-spacing:-.01em}
.pz-hint{font-size:13px;color:rgba(26,26,26,.6);margin:-6px 0 14px;line-height:1.55}

/* Filas de datos: grilla en escritorio, bloque apilado en el celular. */
.pz-row{display:grid;gap:8px;align-items:baseline;padding:8px 0;border-top:1px solid #eae4d6;font-size:12.5px;font-variant-numeric:tabular-nums}
.pz-row.head{border-top:none;padding-bottom:6px;font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(26,26,26,.45)}
.pz-row.tot{border-top:1.5px solid rgba(26,26,26,.18);font-weight:800}
.pz-prod{grid-template-columns:1fr 44px 96px 104px}
.pz-bul{grid-template-columns:44px 44px 1fr 96px 84px}
.pz-row>span:not(:first-child){text-align:right}
.pz-row .k{display:none}
@media(max-width:620px){
  .pz-row.head{display:none}
  .pz-row{grid-template-columns:1fr auto;gap:2px 10px;padding:10px 0}
  .pz-row>span:first-child{grid-column:1/-1;font-weight:700;font-size:13px;margin-bottom:2px}
  .pz-row>span:not(:first-child){grid-column:1/-1;display:flex;justify-content:space-between;text-align:right;color:rgba(26,26,26,.75)}
  .pz-row>span:empty{display:none}
  .pz-row .k{display:inline;color:rgba(26,26,26,.45);font-weight:600}
  .pz-row.tot>span:first-child{font-size:12.5px}
}

/* Opciones */
.pz-opt{display:block;width:100%;text-align:left;padding:0;border-radius:12px;overflow:hidden;font:inherit;color:inherit;background:#fff;border:1.5px solid #eae4d6;cursor:pointer;margin-bottom:10px;transition:border-color .16s,box-shadow .16s}
.pz-opt:last-child{margin-bottom:0}
.pz-opt.on{border-color:#B8956A;box-shadow:0 8px 24px rgba(184,149,106,.22)}
.pz-opt.off{cursor:default;opacity:.55}
.pz-opt-h{display:flex;align-items:center;gap:11px;padding:12px 14px;border-bottom:1px solid #eae4d6}
.pz-opt.on .pz-opt-h{background:#f7efe0;border-bottom-color:rgba(184,149,106,.28)}
.pz-n{width:24px;height:24px;flex-shrink:0;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;background:rgba(26,26,26,.07);color:rgba(26,26,26,.5)}
.pz-opt.on .pz-n{background:#B8956A;color:#fff}
.pz-opt-h b{display:block;font-size:14.5px;font-weight:800;letter-spacing:-.015em}
.pz-opt-h small{display:block;font-size:12px;color:rgba(26,26,26,.55);margin-top:2px}
.pz-tag{flex-shrink:0;font-size:8.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;padding:4px 8px;border-radius:999px;background:rgba(21,128,61,.1);color:#15803d}
.pz-opt-b{padding:12px 14px 14px}
.pz-price{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}
.pz-price span{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(26,26,26,.5);padding-bottom:3px}
.pz-price b{font-size:23px;font-weight:800;letter-spacing:-.035em;line-height:1;white-space:nowrap}
.pz-price b i{font-style:normal;font-size:12px;font-weight:700;color:rgba(26,26,26,.5);margin-right:4px}
.pz-desg{margin-top:12px;padding-top:10px;border-top:1px dashed #eae4d6}
.pz-desg div{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:4px 0;font-size:12.5px}
.pz-desg div span{color:rgba(26,26,26,.6)}
.pz-desg div b{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.pz-desg div.t{margin-top:7px;padding-top:8px;border-top:1px solid #eae4d6;font-size:13px}
.pz-desg div.t span{color:#1a1a1a;font-weight:800}
.pz-nota{font-size:11.5px;color:rgba(26,26,26,.55);margin:9px 0 0;line-height:1.5;font-style:italic}

.pz-cta{width:100%;padding:16px;font-size:15.5px;font-weight:800;border-radius:12px;border:none;letter-spacing:-.015em;cursor:pointer;color:#0A1628;background:linear-gradient(135deg,#E8D098,#B8956A);box-shadow:0 8px 22px rgba(184,149,106,.32)}
.pz-cta:disabled{cursor:not-allowed;color:rgba(26,26,26,.4);background:rgba(26,26,26,.07);box-shadow:none}
.pz-vig{margin-top:14px;padding:14px 16px;border-radius:12px;background:rgba(220,38,38,.06);border:1.5px solid rgba(220,38,38,.3);text-align:center}
.pz-vig p.k{font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#DC2626;margin:0}
.pz-vig p.v{font-size:14.5px;font-weight:800;margin:5px 0 0;letter-spacing:-.01em}
.pz-vig p.d{font-size:12.5px;color:rgba(26,26,26,.6);margin:5px 0 0;line-height:1.5}
.pz-pie{text-align:center;font-size:11.5px;color:rgba(26,26,26,.5);margin:12px 0 0;line-height:1.55}
.pz-wa{display:block;padding:14px;border-radius:12px;background:#25D366;color:#fff;font-size:14.5px;font-weight:800;text-decoration:none;text-align:center;box-shadow:0 8px 20px rgba(37,211,102,.28)}

.pz-modal{position:fixed;inset:0;background:rgba(10,22,40,.62);display:flex;align-items:center;justify-content:center;padding:18px;z-index:50}
.pz-modal-c{background:#faf8f3;border-radius:18px;max-width:390px;width:100%;padding:24px 21px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.4)}

@media(max-width:620px){
  .pz-wrap{padding:0}
  .pz-doc{border-radius:0;max-width:none;box-shadow:none;min-height:100vh}
  .pz-head{padding:16px 18px 15px}
  .pz-sec{padding:18px}
  .pz-head h1{font-size:18px}
}
`;

export default function PresupuestoPage({ params }) {
  const token = params?.token;
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [elegido, setElegido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [listo, setListo] = useState(null);

  useEffect(() => {
    fetch(`/api/presupuesto/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return setState({ loading: false, error: d.error || "No encontramos esta cotización", data: null });
        setState({ loading: false, error: null, data: d });
        if (d.quote.selected) setElegido(d.quote.selected);
      })
      .catch((e) => setState({ loading: false, error: e.message, data: null }));
  }, [token]);

  if (state.loading) return <Centro>Cargando…</Centro>;
  if (state.error) return <Centro>⛔ {state.error}</Centro>;

  const q = state.data.quote;
  const alts = q.alternativas || [];
  const vencida = state.data.vencida;
  const yaAceptada = state.data.aceptada || !!listo;
  const elegidaFinal = listo || alts.find((a) => a.key === q.selected);
  const idxElegida = alts.findIndex((a) => a.key === (elegidaFinal?.key || elegido));
  const dias = diasRestantes(q.expires_at);

  const productos = Array.isArray(q.products) ? q.products : [];
  const bultos = Array.isArray(q.packages) ? q.packages : [];
  const totBultos = bultos.reduce((s, p) => s + (num(p.qty) || 1), 0);
  const totCbm = bultos.reduce((s, p) => s + (num(p.length) * num(p.width) * num(p.height) / 1e6) * (num(p.qty) || 1), 0);
  const totKg = bultos.reduce((s, p) => s + num(p.weight) * (num(p.qty) || 1), 0);
  const totFob = productos.reduce((s, p) => s + num(p.unit_price) * (num(p.quantity) || 1), 0) || num(q.total_fob);

  // El mensaje lo manda el cliente desde su WhatsApp: así nos llega la conversación abierta,
  // no solo un aviso interno del sistema.
  const waLink = (a, i) => {
    const msg = `Hola Argencargo! Vi la cotización y elijo la *Cotización ${i + 1} — ${a.name}* (${usd(a.totalAbonar)}).\n\nQuedo a la espera para coordinar los siguientes pasos.`;
    return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  };

  const aceptar = async () => {
    const a = alts.find((x) => x.key === elegido);
    const i = alts.findIndex((x) => x.key === elegido);
    if (!a) return;
    setEnviando(true);
    // Abrimos la pestaña ANTES del await: si la abrimos después, Safari en iPhone la bloquea
    // por no venir de un gesto directo del usuario.
    const w = window.open(waLink(a, i), "_blank");
    try {
      const r = await fetch(`/api/presupuesto/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_key: elegido }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "No se pudo confirmar"); setEnviando(false); setConfirmando(false); return; }
      setListo(d.elegida || a);
    } catch { setListo(a); }
    setEnviando(false);
    setConfirmando(false);
    if (!w) window.location.href = waLink(a, i);
  };

  const seleccionada = alts.find((a) => a.key === elegido);
  const iSel = alts.findIndex((a) => a.key === elegido);
  const barata = alts.length > 1 ? Math.min(...alts.map((x) => Number(x.totalAbonar || 0))) : null;

  return (
    <div className="pz-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pz-doc">

        <div className="pz-head">
          <div className="pz-head-top">
            <img src={LOGO} alt="Argencargo" style={{ height: 34, width: "auto" }} />
            {q.expires_at && !yaAceptada && (
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: vencida ? "#fca5a5" : "rgba(232,208,152,0.75)" }}>
                {vencida ? "Vencida" : `Válida hasta ${fmtDate(q.expires_at)}`}
              </span>
            )}
          </div>
          <h1>{alts.length > 1 ? <>Tenés <em>{alts.length} formas</em> de traer tu carga</> : "Tu cotización"}</h1>
          <p className="sub">{q.client_name ? `Preparada para ${q.client_name}` : "Cotización preparada a tu medida"}</p>
          <div className="pz-rule" />
        </div>

        <div className="pz-body">

          {yaAceptada && elegidaFinal && (
            <div className="pz-sec" style={{ textAlign: "center" }}>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#15803d", margin: 0 }}>
                ✓ Cotización {idxElegida >= 0 ? idxElegida + 1 : ""} confirmada
              </p>
              <p style={{ fontSize: 18, fontWeight: 800, margin: "6px 0 0", letterSpacing: "-0.02em" }}>{elegidaFinal.name}</p>
              <p style={{ fontSize: 13, color: "rgba(26,26,26,0.6)", margin: "9px 0 14px", lineHeight: 1.6 }}>
                Ya casi. Mandanos el mensaje por WhatsApp y arrancamos. Si no se te abrió solo, tocá el botón.
              </p>
              <a className="pz-wa" href={waLink(elegidaFinal, idxElegida >= 0 ? idxElegida : 0)} target="_blank" rel="noopener noreferrer">Escribirnos por WhatsApp</a>
            </div>
          )}

          {!yaAceptada && vencida && (
            <div className="pz-sec" style={{ textAlign: "center" }}>
              <p style={{ fontSize: 15.5, fontWeight: 800, margin: 0, color: "#DC2626" }}>Esta cotización venció</p>
              <p style={{ fontSize: 13, color: "rgba(26,26,26,0.6)", margin: "8px 0 14px", lineHeight: 1.6 }}>
                Los precios valían hasta el {fmtDate(q.expires_at)}. Escribinos y te pasamos una actualizada, sin vueltas.
              </p>
              <a className="pz-wa" href={`https://wa.me/${WA}?text=${encodeURIComponent("Hola! Se me venció una cotización y quiero pedir una actualizada.")}`} target="_blank" rel="noopener noreferrer">
                Pedir cotización actualizada
              </a>
            </div>
          )}

          {/* DETALLE DE LA CARGA */}
          <div className="pz-sec">
            <p className="pz-lbl">Detalle de la carga</p>

            {productos.length > 0 && (
              <div style={{ marginBottom: bultos.length ? 20 : 0 }}>
                <p className="pz-sub">Mercadería</p>
                <div className="pz-row pz-prod head"><span>Descripción</span><span>Cant.</span><span>Valor unit.</span><span>Valor total</span></div>
                {productos.map((p, i) => {
                  const c = num(p.quantity) || 1, u = num(p.unit_price);
                  return <div className="pz-row pz-prod" key={i}>
                    <span>{p.description || p.name || "Producto"}</span>
                    <span><i className="k">Cantidad</i>{c}</span>
                    <span><i className="k">Valor unitario</i>{usd(u)}</span>
                    <span><i className="k">Valor total</i>{usd(u * c)}</span>
                  </div>;
                })}
                <div className="pz-row pz-prod tot"><span>Total mercadería</span><span /><span /><span>{usd(totFob)}</span></div>
              </div>
            )}

            {bultos.length > 0 && (
              <div>
                <p className="pz-sub">Bultos</p>
                <div className="pz-row pz-bul head"><span>Bulto</span><span>Cant.</span><span>Medidas</span><span>Volumen</span><span>Peso</span></div>
                {bultos.map((p, i) => {
                  const c = num(p.qty) || 1;
                  const cbm = (num(p.length) * num(p.width) * num(p.height) / 1e6) * c;
                  return <div className="pz-row pz-bul" key={i}>
                    <span>Bulto #{i + 1}</span>
                    <span><i className="k">Cantidad</i>{c}</span>
                    <span><i className="k">Medidas</i>{dim(p.length)}×{dim(p.width)}×{dim(p.height)} cm</span>
                    <span><i className="k">Volumen</i>{fmtCbm(cbm)}</span>
                    <span><i className="k">Peso</i>{fmtKg(num(p.weight) * c)}</span>
                  </div>;
                })}
                <div className="pz-row pz-bul tot">
                  <span>{totBultos} {totBultos === 1 ? "bulto" : "bultos"}</span><span /><span />
                  <span><i className="k">Volumen total</i>{fmtCbm(totCbm)}</span>
                  <span><i className="k">Peso total</i>{fmtKg(totKg)}</span>
                </div>
              </div>
            )}

            {q.origin && (
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 16, paddingTop: 13, borderTop: "1px solid #eae4d6" }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(26,26,26,0.45)" }}>Origen</span>
                <span style={{ flex: 1, height: 1, background: "#eae4d6" }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{q.origin}</span>
              </div>
            )}
          </div>

          {/* OPCIONES */}
          {!yaAceptada && (
            <div className="pz-sec">
              <p className="pz-lbl">{alts.length > 1 ? "Elegí cómo querés hacer la importación" : "Tu opción"}</p>
              {alts.length > 1 && <p className="pz-hint">Es la misma carga en todos los casos: cambian el tiempo de tránsito y el costo final. Tocá una para ver el desglose.</p>}

              {alts.map((a, i) => {
                const sel = elegido === a.key;
                const esBarata = barata != null && Number(a.totalAbonar || 0) === barata;
                const comps = [
                  a.flete > 0 && [rotuloServicio(a), usd(a.flete)],
                  a.seguro > 0 && ["Seguro", usd(a.seguro)],
                  a.totalTax > 0 && ["Impuestos y gastos de aduana", usd(a.totalTax)],
                  a.shipCost > 0 && ["Envío a domicilio", usd(a.shipCost)],
                ].filter(Boolean);
                return (
                  <button key={a.key} onClick={() => !vencida && setElegido(a.key)} disabled={vencida}
                    className={`pz-opt ${sel ? "on" : ""} ${vencida ? "off" : ""}`}>
                    <div className="pz-opt-h">
                      <span className="pz-n">{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b>{esAereo(a) ? "✈" : "🚢"} {a.name}</b>
                        {a.info && <small>Llega en {a.info}</small>}
                      </div>
                      {esBarata && <span className="pz-tag">Más económica</span>}
                    </div>
                    <div className="pz-opt-b">
                      <div className="pz-price">
                        <span>Total puesto en Argentina</span>
                        <b><i>USD</i>{fmt(a.totalAbonar)}</b>
                      </div>
                      {sel && comps.length > 0 && (
                        <div className="pz-desg">
                          {comps.map(([l, v], k) => <div key={k}><span>{l}</span><b>{v}</b></div>)}
                          {comps.length > 1 && <div className="t"><span>Total</span><b>{usd(a.totalAbonar)}</b></div>}
                          {esIntegral(a) && <p className="pz-nota">Servicio todo incluido: ya tiene adentro impuestos, aduana y recargos. No pagás nada aparte.</p>}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {q.notes && (
            <div className="pz-sec">
              <p className="pz-lbl">Notas</p>
              <p style={{ fontSize: 13, color: "rgba(26,26,26,0.65)", margin: 0, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{q.notes}</p>
            </div>
          )}

          {!yaAceptada && !vencida && (
            <div className="pz-sec">
              <button className="pz-cta" onClick={() => elegido && setConfirmando(true)} disabled={!elegido}>
                {elegido ? `Confirmar la Cotización ${iSel + 1}` : "Elegí una opción para continuar"}
              </button>

              {/* La vigencia va acá abajo y en rojo: es el dato que lo apura a decidir. */}
              {q.expires_at && (
                <div className="pz-vig">
                  <p className="k">Vigencia de la cotización</p>
                  <p className="v">Válida hasta el {fmtDate(q.expires_at)}</p>
                  <p className="d">{dias === 0 ? "Vence hoy." : dias === 1 ? "Te queda 1 día para aceptarla." : `Te quedan ${dias} días para aceptarla.`} Pasada esa fecha los precios pueden cambiar.</p>
                </div>
              )}

              <p className="pz-pie">Al confirmar se abre WhatsApp con el mensaje listo para enviarnos.</p>
            </div>
          )}
        </div>
      </div>

      {confirmando && seleccionada && (
        <div className="pz-modal" onClick={() => !enviando && setConfirmando(false)}>
          <div className="pz-modal-c" onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 46, height: 46, borderRadius: 999, background: "rgba(220,38,38,0.09)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: 22 }}>⚠️</div>
            <p style={{ fontSize: 17.5, fontWeight: 800, margin: "13px 0 0", letterSpacing: "-0.02em" }}>Antes de confirmar</p>
            <p style={{ fontSize: 13.5, color: "rgba(26,26,26,0.6)", margin: "10px 0 0", lineHeight: 1.65 }}>
              Estás por elegir la <b style={{ color: "#1a1a1a" }}>Cotización {iSel + 1} — {seleccionada.name}</b> por <b style={{ color: "#1a1a1a" }}>{usd(seleccionada.totalAbonar)}</b>.
            </p>
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 11, background: "rgba(26,26,26,0.04)", textAlign: "left" }}>
              <p style={{ fontSize: 12.5, color: "rgba(26,26,26,0.6)", margin: 0, lineHeight: 1.6 }}>
                Los valores son estimados sobre los datos declarados. Si cambian la mercadería, las medidas o el peso, el total se recalcula.
              </p>
            </div>
            <button onClick={aceptar} disabled={enviando} className="pz-cta" style={{ marginTop: 17 }}>
              {enviando ? "Confirmando…" : "Sí, confirmo y mando el WhatsApp"}
            </button>
            <button onClick={() => setConfirmando(false)} disabled={enviando}
              style={{ width: "100%", marginTop: 9, padding: "12px", fontSize: 13.5, fontWeight: 700, borderRadius: 12, border: "1px solid #eae4d6", background: "transparent", color: "rgba(26,26,26,0.55)", cursor: "pointer" }}>
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Centro({ children }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A1628", color: "rgba(255,255,255,0.6)", fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14, padding: 20, textAlign: "center" }}>{children}</div>;
}
