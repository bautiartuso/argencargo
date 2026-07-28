"use client";
import { useState, useEffect } from "react";

// Cotización del admin vista por el cliente, sin login. A diferencia del PDF de antes, acá compara
// las alternativas que se le ofrecen (aéreo, marítimo LCL/FCL, marítimo integral) con sus tiempos y
// precios, y elige una. La elección queda registrada Y el cliente nos manda el WhatsApp: el aviso
// automático solo no alcanzaba, queremos la conversación abierta con el cliente del otro lado.

const INK = "#0A1628", LINE = "rgba(10,22,40,0.10)", MUTED = "rgba(10,22,40,0.55)";
const GOLD_A = "#D9C08B", GOLD_B = "#B8956A";
const ROJO = "#DC2626", ROJO_OSC = "#B91C1C";
const WA = "5491125088580";

// Los bultos vienen del formulario del admin, donde se tipea con coma decimal ("32,5").
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const fmt = (n) => `USD ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtKg = (n) => `${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
const fmtCbm = (n) => `${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} m³`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }) : "";

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

  const productos = Array.isArray(q.products) ? q.products : [];
  const bultos = Array.isArray(q.packages) ? q.packages : [];
  const totBultos = bultos.reduce((s, p) => s + (num(p.qty) || 1), 0);
  const totCbm = bultos.reduce((s, p) => s + (num(p.length) * num(p.width) * num(p.height) / 1e6) * (num(p.qty) || 1), 0);
  const totKg = bultos.reduce((s, p) => s + num(p.weight) * (num(p.qty) || 1), 0);
  const totFob = productos.reduce((s, p) => s + num(p.unit_price) * (num(p.quantity) || 1), 0) || num(q.total_fob);

  // El mensaje lo manda el cliente desde su WhatsApp: así nos llega la conversación abierta,
  // no solo un aviso interno del sistema.
  const waLink = (a, i) => {
    const msg = `Hola Argencargo! Vi la cotización y elijo la *Cotización ${i + 1} — ${a.name}* (${fmt(a.totalAbonar)}).\n\nQuedo a la espera para coordinar los siguientes pasos.`;
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

  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EC", color: INK, fontFamily: "'Inter',system-ui,sans-serif", paddingBottom: 40 }}>

      {/* Encabezado */}
      <div style={{ background: `linear-gradient(150deg, ${INK} 0%, #12233d 100%)`, padding: "26px 16px 30px", textAlign: "center" }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: GOLD_A, margin: 0 }}>Argencargo</p>
        <h1 style={{ fontSize: 25, fontWeight: 800, letterSpacing: "-0.025em", margin: "7px 0 0", color: "#fff" }}>
          {alts.length > 1 ? `Tenés ${alts.length} formas de traer tu carga` : "Tu cotización"}
        </h1>
        {q.client_name && <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", margin: "6px 0 0" }}>Para {q.client_name}</p>}
        {q.expires_at && !yaAceptada && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 14, padding: "8px 15px", borderRadius: 999,
            background: vencida ? "rgba(220,38,38,0.18)" : "rgba(217,192,139,0.14)", border: `1px solid ${vencida ? "rgba(248,113,113,0.5)" : "rgba(217,192,139,0.35)"}` }}>
            <span style={{ fontSize: 13 }}>{vencida ? "⛔" : "⏳"}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: vencida ? "#fca5a5" : GOLD_A }}>
              {vencida ? `Venció el ${fmtDate(q.expires_at)}` : `Precios válidos hasta el ${fmtDate(q.expires_at)}`}
            </span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 14, marginTop: -14 }}>

        {yaAceptada && elegidaFinal && (
          <div style={{ ...card(), background: "#fff", border: "2px solid rgba(34,197,94,0.45)", textAlign: "center", padding: "22px 18px" }}>
            <div style={{ fontSize: 32, lineHeight: 1 }}>✅</div>
            <p style={{ fontSize: 17, fontWeight: 800, margin: "10px 0 0" }}>
              Elegiste la Cotización {idxElegida >= 0 ? idxElegida + 1 : ""} — {elegidaFinal.name}
            </p>
            <p style={{ fontSize: 13.5, color: MUTED, margin: "8px 0 0", lineHeight: 1.55 }}>
              Mandanos el mensaje por WhatsApp para que arranquemos. Si no se te abrió solo, tocá el botón.
            </p>
            <a href={waLink(elegidaFinal, idxElegida >= 0 ? idxElegida : 0)} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", marginTop: 15, padding: "14px", borderRadius: 12, background: "#25D366", color: "#fff", fontSize: 15, fontWeight: 800, textDecoration: "none" }}>
              💬 Escribirnos por WhatsApp
            </a>
          </div>
        )}

        {!yaAceptada && vencida && (
          <div style={{ ...card(), background: "#fff", border: "2px solid rgba(220,38,38,0.35)", textAlign: "center" }}>
            <p style={{ fontSize: 15.5, fontWeight: 800, margin: 0, color: ROJO }}>Esta cotización venció</p>
            <p style={{ fontSize: 13.5, color: MUTED, margin: "7px 0 0", lineHeight: 1.55 }}>Los precios valían hasta el {fmtDate(q.expires_at)}. Escribinos y te pasamos una actualizada.</p>
            <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Hola! Se me venció una cotización y quiero pedir una actualizada.")}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", marginTop: 14, padding: "13px", borderRadius: 12, background: "#25D366", color: "#fff", fontSize: 14.5, fontWeight: 800, textDecoration: "none" }}>
              💬 Pedir cotización actualizada
            </a>
          </div>
        )}

        {/* DETALLE DE LA CARGA — primero la mercadería, después los bultos */}
        <div style={card()}>
          <p style={rotulo()}>Detalle de la carga</p>

          {productos.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <p style={subtitulo()}>Mercadería</p>
              <Tabla
                cols={["Descripción", "Cant.", "Valor unit.", "Valor total"]}
                anchos={["auto", 58, 92, 100]}
                filas={productos.map((p) => {
                  const c = num(p.quantity) || 1, u = num(p.unit_price);
                  return [p.description || p.name || "Producto", String(c), fmt(u), fmt(u * c)];
                })}
                total={["Total mercadería", "", "", fmt(totFob)]}
              />
            </div>
          )}

          {bultos.length > 0 && (
            <div>
              <p style={subtitulo()}>Bultos</p>
              <Tabla
                cols={["Bulto", "Cant.", "Medidas", "Volumen", "Peso"]}
                anchos={[64, 52, 118, 96, 84]}
                filas={bultos.map((p, i) => {
                  const c = num(p.qty) || 1;
                  const cbm = (num(p.length) * num(p.width) * num(p.height) / 1e6) * c;
                  return [`#${i + 1}`, String(c), `${num(p.length)}×${num(p.width)}×${num(p.height)} cm`, fmtCbm(cbm), fmtKg(num(p.weight) * c)];
                })}
                total={[`${totBultos} ${totBultos === 1 ? "bulto" : "bultos"}`, "", "", fmtCbm(totCbm), fmtKg(totKg)]}
              />
            </div>
          )}

          {q.origin && (
            <p style={{ fontSize: 12.5, color: MUTED, margin: "14px 0 0", paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
              Origen: <b style={{ color: INK }}>{q.origin}</b>
            </p>
          )}
        </div>

        {/* OPCIONES */}
        {!yaAceptada && (
          <div style={card()}>
            <p style={rotulo()}>{alts.length > 1 ? "Elegí cómo querés hacer la importación" : "Tu opción"}</p>
            {alts.length > 1 && (
              <p style={{ fontSize: 13, color: MUTED, margin: "-5px 0 14px", lineHeight: 1.55 }}>
                Es la misma carga en todos los casos. Cambian el tiempo de tránsito y el costo final. Tocá la que te sirva para ver el desglose.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {alts.map((a, i) => {
                const sel = elegido === a.key;
                const masBarata = alts.length > 1 && a.totalAbonar === Math.min(...alts.map((x) => Number(x.totalAbonar || 0)));
                return (
                  <div key={a.key} onClick={() => !vencida && setElegido(a.key)}
                    style={{ padding: 0, borderRadius: 14, cursor: vencida ? "default" : "pointer", overflow: "hidden", opacity: vencida ? 0.55 : 1,
                      border: `2px solid ${sel ? GOLD_B : LINE}`, background: "#fff",
                      boxShadow: sel ? "0 6px 20px rgba(184,149,106,0.22)" : "0 1px 3px rgba(10,22,40,0.05)", transition: "border-color .15s, box-shadow .15s" }}>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 15px",
                      background: sel ? `linear-gradient(135deg,${GOLD_A},${GOLD_B})` : "rgba(10,22,40,0.04)" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: sel ? INK : MUTED }}>
                        Cotización {i + 1}
                      </span>
                      {masBarata && (
                        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999,
                          background: sel ? "rgba(10,22,40,0.14)" : "rgba(34,197,94,0.13)", color: sel ? INK : "#15803d" }}>
                          Más económica
                        </span>
                      )}
                    </div>

                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 165 }}>
                          <p style={{ fontSize: 15.5, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
                            <span style={{ color: sel ? GOLD_B : "rgba(10,22,40,0.3)", marginRight: 5 }}>{sel ? "◉" : "○"}</span>{a.name}
                          </p>
                          {a.info && <p style={{ fontSize: 12.5, color: MUTED, margin: "4px 0 0" }}>🕒 {a.info}</p>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: MUTED, margin: 0 }}>Total puesto en Argentina</p>
                          <p style={{ fontSize: 23, fontWeight: 800, margin: "1px 0 0", letterSpacing: "-0.03em" }}>{fmt(a.totalAbonar)}</p>
                        </div>
                      </div>
                      {sel && (
                        <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${LINE}` }}>
                          {a.flete > 0 && <Linea l="Flete internacional" v={fmt(a.flete)} />}
                          {a.seguro > 0 && <Linea l="Seguro" v={fmt(a.seguro)} />}
                          {a.totalTax > 0 && <Linea l="Impuestos y gastos de aduana" v={fmt(a.totalTax)} />}
                          {a.shipCost > 0 && <Linea l="Envío a domicilio" v={fmt(a.shipCost)} />}
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${LINE}` }}>
                            <span style={{ fontSize: 12.5, fontWeight: 800 }}>Total</span>
                            <span style={{ fontSize: 14, fontWeight: 800 }}>{fmt(a.totalAbonar)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {q.notes && (
          <div style={card()}>
            <p style={rotulo()}>Notas</p>
            <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{q.notes}</p>
          </div>
        )}

        {!yaAceptada && !vencida && (
          <>
            <button onClick={() => elegido && setConfirmando(true)} disabled={!elegido}
              style={{ width: "100%", padding: "17px 18px", fontSize: 16, fontWeight: 800, borderRadius: 14, border: "none", letterSpacing: "-0.01em",
                cursor: elegido ? "pointer" : "not-allowed", color: elegido ? "#fff" : MUTED,
                background: elegido ? `linear-gradient(135deg,${ROJO},${ROJO_OSC})` : "rgba(10,22,40,0.08)",
                boxShadow: elegido ? "0 8px 22px rgba(220,38,38,0.32)" : "none" }}>
              {elegido ? `Confirmar la Cotización ${iSel + 1} →` : "Elegí una opción para continuar"}
            </button>
            <p style={{ textAlign: "center", fontSize: 11.5, color: MUTED, margin: 0, lineHeight: 1.55 }}>
              Al confirmar se abre WhatsApp con el mensaje listo para enviarnos.
            </p>
          </>
        )}
      </div>

      {/* Alerta de confirmación */}
      {confirmando && seleccionada && (
        <div onClick={() => !enviando && setConfirmando(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 18, maxWidth: 380, width: "100%", padding: "24px 22px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ width: 46, height: 46, borderRadius: 999, background: "rgba(220,38,38,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: 22 }}>⚠️</div>
            <p style={{ fontSize: 17, fontWeight: 800, margin: "13px 0 0" }}>Antes de confirmar</p>
            <p style={{ fontSize: 13.5, color: MUTED, margin: "9px 0 0", lineHeight: 1.6 }}>
              Estás por elegir la <b style={{ color: INK }}>Cotización {iSel + 1} — {seleccionada.name}</b> por <b style={{ color: INK }}>{fmt(seleccionada.totalAbonar)}</b>.
            </p>
            <div style={{ marginTop: 13, padding: "11px 13px", borderRadius: 11, background: "rgba(10,22,40,0.035)", textAlign: "left" }}>
              <p style={{ fontSize: 12.5, color: MUTED, margin: 0, lineHeight: 1.55 }}>
                Los valores son estimados sobre los datos declarados. Si cambian la mercadería, las medidas o el peso, el total se recalcula.
              </p>
            </div>
            <button onClick={aceptar} disabled={enviando}
              style={{ width: "100%", marginTop: 17, padding: "15px", fontSize: 15, fontWeight: 800, borderRadius: 12, border: "none", color: "#fff",
                background: `linear-gradient(135deg,${ROJO},${ROJO_OSC})`, cursor: enviando ? "wait" : "pointer" }}>
              {enviando ? "Confirmando…" : "Sí, confirmo y mando el WhatsApp"}
            </button>
            <button onClick={() => setConfirmando(false)} disabled={enviando}
              style={{ width: "100%", marginTop: 8, padding: "12px", fontSize: 13.5, fontWeight: 700, borderRadius: 12, border: `1px solid ${LINE}`, background: "transparent", color: MUTED, cursor: "pointer" }}>
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function card() { return { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: "18px 18px", boxShadow: "0 1px 3px rgba(10,22,40,0.05)" }; }
function rotulo() { return { fontSize: 10, fontWeight: 800, letterSpacing: "0.13em", textTransform: "uppercase", color: MUTED, margin: "0 0 12px" }; }
function subtitulo() { return { fontSize: 12, fontWeight: 800, color: INK, margin: "0 0 8px" }; }

// Tabla con scroll horizontal propio: en el celular las medidas y los totales no entran,
// pero la página nunca tiene que scrollear de costado.
function Tabla({ cols, anchos, filas, total }) {
  const th = { fontSize: 9.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, padding: "0 8px 7px", textAlign: "left", whiteSpace: "nowrap" };
  const td = { fontSize: 12.5, padding: "8px", borderTop: `1px solid ${LINE}`, color: INK, verticalAlign: "top" };
  return (
    <div style={{ overflowX: "auto", margin: "0 -4px" }}>
      <table style={{ width: "100%", minWidth: 380, borderCollapse: "collapse" }}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={{ ...th, textAlign: i === 0 ? "left" : "right", width: anchos[i] === "auto" ? "auto" : anchos[i] }}>{c}</th>)}</tr></thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>{f.map((v, j) => (
              <td key={j} style={{ ...td, textAlign: j === 0 ? "left" : "right", fontWeight: j === 0 ? 600 : 500, fontVariantNumeric: "tabular-nums" }}>{v}</td>
            ))}</tr>
          ))}
          {total && (
            <tr>{total.map((v, j) => (
              <td key={j} style={{ ...td, borderTop: `2px solid ${LINE}`, textAlign: j === 0 ? "left" : "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{v}</td>
            ))}</tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Linea({ l, v }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "3px 0" }}>
    <span style={{ fontSize: 12.5, color: MUTED }}>{l}</span>
    <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{v}</span>
  </div>;
}
function Centro({ children }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F2EC", color: MUTED, fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14, padding: 20, textAlign: "center" }}>{children}</div>;
}
