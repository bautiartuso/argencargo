"use client";
import { useState, useEffect } from "react";

// Cotización del admin vista por el cliente, sin login. A diferencia del PDF de antes, acá compara
// las alternativas que se le ofrecen (aéreo, marítimo LCL/FCL, marítimo integral) con sus tiempos y
// precios, y elige una. La elección queda registrada Y el cliente nos manda el WhatsApp: el aviso
// automático solo no alcanzaba, queremos la conversación abierta con el cliente del otro lado.

const INK = "#0B1A30", TINTA_2 = "#1C3454";
const GOLD = "#B8956A", GOLD_CLARO = "#D9C08B", GOLD_SUAVE = "#F3EBDD";
const ROJO = "#DC2626", ROJO_OSC = "#A81E1E";
const PAPEL = "#FBFAF7", FONDO = "#EFEDE7";
const BORDE = "rgba(11,26,48,0.09)", TENUE = "rgba(11,26,48,0.52)";
const WA = "5491125088580";

// Los bultos vienen del formulario del admin, donde se tipea con coma decimal ("32,5").
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = (n) => `USD ${fmt(n)}`;
const fmtKg = (n) => `${fmt(n)} kg`;
const fmtCbm = (n) => `${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} m³`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }) : "";
const diasRestantes = (d) => { if (!d) return null; const ms = new Date(d) - new Date(); return ms <= 0 ? 0 : Math.ceil(ms / 86400000); };

const esAereo = (a) => String(a.type || a.key || "").includes("aereo");
// El integral se cobra como un servicio único (ya lleva adentro impuestos y recargos), así que la
// línea del desglose no puede llamarse "flete": el cliente ve un número que no cierra con el total.
const esIntegral = (a) => String(a.type || a.key || "").endsWith("_b");
const rotuloServicio = (a) => esIntegral(a)
  ? (esAereo(a) ? "Servicio aéreo de importación completa" : "Servicio marítimo de importación completa")
  : (esAereo(a) ? "Flete aéreo internacional" : "Flete marítimo internacional");

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
    <div style={{ minHeight: "100vh", background: FONDO, color: INK, fontFamily: "'Inter',-apple-system,system-ui,sans-serif", paddingBottom: 48 }}>

      {/* ENCABEZADO */}
      <div style={{ background: `linear-gradient(158deg, ${INK} 0%, ${TINTA_2} 100%)`, padding: "30px 16px 54px", textAlign: "center", position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 22, height: 1.5, background: `linear-gradient(90deg,transparent,${GOLD_CLARO})` }} />
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD_CLARO, margin: 0 }}>Argencargo</p>
          <span style={{ width: 22, height: 1.5, background: `linear-gradient(90deg,${GOLD_CLARO},transparent)` }} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", margin: "12px 0 0", color: "#fff", lineHeight: 1.2 }}>
          {alts.length > 1 ? <>Tenés <span style={{ color: GOLD_CLARO }}>{alts.length} formas</span><br />de traer tu carga</> : "Tu cotización"}
        </h1>
        <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", margin: "10px 0 0" }}>
          {q.client_name ? `Preparada para ${q.client_name}` : "Cotización preparada a tu medida"}
        </p>
      </div>

      <div style={{ maxWidth: 640, margin: "-34px auto 0", padding: "0 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {yaAceptada && elegidaFinal && (
          <div style={{ ...card(), borderColor: "rgba(21,128,61,0.3)", textAlign: "center", padding: "26px 20px" }}>
            <div style={{ width: 52, height: 52, margin: "0 auto", borderRadius: 999, background: "rgba(34,197,94,0.11)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25 }}>✓</div>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#15803d", margin: "14px 0 0" }}>Cotización {idxElegida >= 0 ? idxElegida + 1 : ""} confirmada</p>
            <p style={{ fontSize: 19, fontWeight: 800, margin: "5px 0 0", letterSpacing: "-0.02em" }}>{elegidaFinal.name}</p>
            <p style={{ fontSize: 13.5, color: TENUE, margin: "10px 0 0", lineHeight: 1.6 }}>
              Ya casi. Mandanos el mensaje por WhatsApp y arrancamos. Si no se te abrió solo, tocá el botón.
            </p>
            <a href={waLink(elegidaFinal, idxElegida >= 0 ? idxElegida : 0)} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", marginTop: 18, padding: "15px", borderRadius: 13, background: "#25D366", color: "#fff", fontSize: 15, fontWeight: 800, textDecoration: "none", boxShadow: "0 8px 20px rgba(37,211,102,0.3)" }}>
              Escribirnos por WhatsApp
            </a>
          </div>
        )}

        {!yaAceptada && vencida && (
          <div style={{ ...card(), borderColor: "rgba(220,38,38,0.3)", textAlign: "center" }}>
            <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: ROJO, letterSpacing: "-0.01em" }}>Esta cotización venció</p>
            <p style={{ fontSize: 13.5, color: TENUE, margin: "8px 0 0", lineHeight: 1.6 }}>Los precios valían hasta el {fmtDate(q.expires_at)}. Escribinos y te pasamos una actualizada, sin vueltas.</p>
            <a href={`https://wa.me/${WA}?text=${encodeURIComponent("Hola! Se me venció una cotización y quiero pedir una actualizada.")}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", marginTop: 16, padding: "14px", borderRadius: 13, background: "#25D366", color: "#fff", fontSize: 14.5, fontWeight: 800, textDecoration: "none" }}>
              Pedir cotización actualizada
            </a>
          </div>
        )}

        {/* DETALLE DE LA CARGA */}
        <div style={card()}>
          <Rotulo>Detalle de la carga</Rotulo>

          {productos.length > 0 && (
            <div style={{ marginBottom: productos.length && bultos.length ? 22 : 0 }}>
              <Sub>Mercadería</Sub>
              <Tabla
                cols={["Descripción", "Cant.", "Valor unit.", "Valor total"]}
                filas={productos.map((p) => {
                  const c = num(p.quantity) || 1, u = num(p.unit_price);
                  return [p.description || p.name || "Producto", String(c), usd(u), usd(u * c)];
                })}
                total={["Total mercadería", "", "", usd(totFob)]}
              />
            </div>
          )}

          {bultos.length > 0 && (
            <div>
              <Sub>Bultos</Sub>
              <Tabla
                cols={["Bulto", "Cant.", "Medidas", "Volumen", "Peso"]}
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
            <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "18px 0 0", paddingTop: 14, borderTop: `1px solid ${BORDE}` }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: TENUE }}>Origen</span>
              <span style={{ flex: 1, height: 1, background: BORDE }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{q.origin}</span>
            </div>
          )}
        </div>

        {/* OPCIONES */}
        {!yaAceptada && (
          <div>
            <div style={{ padding: "0 4px 12px" }}>
              <Rotulo margen={4}>{alts.length > 1 ? "Elegí cómo querés hacer la importación" : "Tu opción"}</Rotulo>
              {alts.length > 1 && (
                <p style={{ fontSize: 13.5, color: TENUE, margin: 0, lineHeight: 1.6 }}>
                  Es la misma carga en todos los casos: cambian el tiempo de tránsito y el costo final. Tocá una para ver el desglose.
                </p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                    style={{ display: "block", width: "100%", textAlign: "left", padding: 0, borderRadius: 16, overflow: "hidden", font: "inherit", color: "inherit",
                      cursor: vencida ? "default" : "pointer", opacity: vencida ? 0.55 : 1, background: PAPEL,
                      border: `1.5px solid ${sel ? GOLD : BORDE}`,
                      boxShadow: sel ? `0 10px 30px rgba(184,149,106,0.25)` : "0 1px 2px rgba(11,26,48,0.05)",
                      transition: "border-color .18s, box-shadow .18s, transform .18s", transform: sel ? "translateY(-1px)" : "none" }}>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 17px", background: sel ? GOLD_SUAVE : "transparent", borderBottom: sel ? `1px solid rgba(184,149,106,0.25)` : `1px solid ${BORDE}` }}>
                      <span style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
                        background: sel ? GOLD : "rgba(11,26,48,0.06)", color: sel ? "#fff" : TENUE }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 15.5, fontWeight: 800, margin: 0, letterSpacing: "-0.015em" }}>{esAereo(a) ? "✈ " : "🚢 "}{a.name}</p>
                        {a.info && <p style={{ fontSize: 12.5, color: TENUE, margin: "3px 0 0" }}>Llega en {a.info}</p>}
                      </div>
                      {esBarata && (
                        <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 999,
                          background: "rgba(21,128,61,0.1)", color: "#15803d" }}>Más económica</span>
                      )}
                    </div>

                    <div style={{ padding: "14px 17px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: TENUE, paddingBottom: 4 }}>Total puesto en Argentina</span>
                        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1, color: sel ? INK : TINTA_2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: TENUE, marginRight: 4 }}>USD</span>{fmt(a.totalAbonar)}
                        </span>
                      </div>
                      {sel && comps.length > 0 && (
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${BORDE}` }}>
                          {comps.map(([l, v], k) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "4px 0" }}>
                              <span style={{ fontSize: 12.5, color: TENUE }}>{l}</span>
                              <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v}</span>
                            </div>
                          ))}
                          {comps.length > 1 && (
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 9, borderTop: `1px solid ${BORDE}` }}>
                              <span style={{ fontSize: 13, fontWeight: 800 }}>Total</span>
                              <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{usd(a.totalAbonar)}</span>
                            </div>
                          )}
                          {esIntegral(a) && (
                            <p style={{ fontSize: 11.5, color: TENUE, margin: "10px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                              Servicio todo incluido: ya tiene adentro impuestos, aduana y recargos. No pagás nada aparte.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {q.notes && (
          <div style={card()}>
            <Rotulo>Notas</Rotulo>
            <p style={{ fontSize: 13.5, color: TENUE, margin: 0, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{q.notes}</p>
          </div>
        )}

        {!yaAceptada && !vencida && (
          <>
            <button onClick={() => elegido && setConfirmando(true)} disabled={!elegido}
              style={{ width: "100%", padding: "18px", fontSize: 16, fontWeight: 800, borderRadius: 14, border: "none", letterSpacing: "-0.015em",
                cursor: elegido ? "pointer" : "not-allowed", color: elegido ? "#fff" : TENUE,
                background: elegido ? `linear-gradient(135deg,${ROJO},${ROJO_OSC})` : "rgba(11,26,48,0.07)",
                boxShadow: elegido ? "0 10px 26px rgba(220,38,38,0.3)" : "none", transition: "background .2s, box-shadow .2s" }}>
              {elegido ? `Confirmar la Cotización ${iSel + 1}` : "Elegí una opción para continuar"}
            </button>

            {/* Vigencia bien abajo: es lo último que lee antes de decidir. */}
            {q.expires_at && (
              <div style={{ padding: "16px 18px", borderRadius: 14, background: GOLD_SUAVE, border: `1px solid rgba(184,149,106,0.3)`, textAlign: "center" }}>
                <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD, margin: 0 }}>Vigencia de la cotización</p>
                <p style={{ fontSize: 15, fontWeight: 800, margin: "6px 0 0", letterSpacing: "-0.01em" }}>
                  Válida hasta el {fmtDate(q.expires_at)}
                </p>
                <p style={{ fontSize: 12.5, color: TENUE, margin: "6px 0 0", lineHeight: 1.55 }}>
                  {dias === 0 ? "Vence hoy." : dias === 1 ? "Te queda 1 día para aceptarla." : `Te quedan ${dias} días para aceptarla.`} Pasada esa fecha los precios pueden cambiar.
                </p>
              </div>
            )}

            <p style={{ textAlign: "center", fontSize: 12, color: TENUE, margin: 0, lineHeight: 1.6 }}>
              Al confirmar se abre WhatsApp con el mensaje listo para enviarnos.
            </p>
          </>
        )}
      </div>

      {/* ALERTA DE CONFIRMACIÓN */}
      {confirmando && seleccionada && (
        <div onClick={() => !enviando && setConfirmando(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(11,26,48,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: PAPEL, borderRadius: 20, maxWidth: 390, width: "100%", padding: "26px 22px", textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,0.35)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 999, background: "rgba(220,38,38,0.09)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: 23 }}>⚠️</div>
            <p style={{ fontSize: 18, fontWeight: 800, margin: "14px 0 0", letterSpacing: "-0.02em" }}>Antes de confirmar</p>
            <p style={{ fontSize: 13.5, color: TENUE, margin: "10px 0 0", lineHeight: 1.65 }}>
              Estás por elegir la <b style={{ color: INK }}>Cotización {iSel + 1} — {seleccionada.name}</b> por <b style={{ color: INK }}>{usd(seleccionada.totalAbonar)}</b>.
            </p>
            <div style={{ marginTop: 15, padding: "12px 14px", borderRadius: 12, background: "rgba(11,26,48,0.035)", textAlign: "left" }}>
              <p style={{ fontSize: 12.5, color: TENUE, margin: 0, lineHeight: 1.6 }}>
                Los valores son estimados sobre los datos declarados. Si cambian la mercadería, las medidas o el peso, el total se recalcula.
              </p>
            </div>
            <button onClick={aceptar} disabled={enviando}
              style={{ width: "100%", marginTop: 18, padding: "16px", fontSize: 15, fontWeight: 800, borderRadius: 13, border: "none", color: "#fff",
                background: `linear-gradient(135deg,${ROJO},${ROJO_OSC})`, cursor: enviando ? "wait" : "pointer", boxShadow: "0 8px 22px rgba(220,38,38,0.28)" }}>
              {enviando ? "Confirmando…" : "Sí, confirmo y mando el WhatsApp"}
            </button>
            <button onClick={() => setConfirmando(false)} disabled={enviando}
              style={{ width: "100%", marginTop: 9, padding: "13px", fontSize: 13.5, fontWeight: 700, borderRadius: 13, border: `1px solid ${BORDE}`, background: "transparent", color: TENUE, cursor: "pointer" }}>
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function card() { return { background: PAPEL, border: `1px solid ${BORDE}`, borderRadius: 18, padding: "20px 19px", boxShadow: "0 2px 10px rgba(11,26,48,0.05)" }; }
function Rotulo({ children, margen = 14 }) {
  return <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: TENUE, margin: `0 0 ${margen}px` }}>{children}</p>;
}
function Sub({ children }) {
  return <p style={{ fontSize: 12.5, fontWeight: 800, color: INK, margin: "0 0 9px", letterSpacing: "-0.01em" }}>{children}</p>;
}

// Tabla con scroll horizontal propio: en el celular las medidas y los totales no entran,
// pero la página nunca tiene que scrollear de costado.
function Tabla({ cols, filas, total }) {
  const th = { fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: TENUE, padding: "0 9px 8px", whiteSpace: "nowrap" };
  const td = { fontSize: 12.5, padding: "9px", color: INK, verticalAlign: "top", fontVariantNumeric: "tabular-nums" };
  return (
    <div style={{ overflowX: "auto", margin: "0 -5px" }}>
      <table style={{ width: "100%", minWidth: 372, borderCollapse: "collapse" }}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={{ ...th, textAlign: i === 0 ? "left" : "right" }}>{c}</th>)}</tr></thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} style={{ background: i % 2 ? "rgba(11,26,48,0.022)" : "transparent" }}>
              {f.map((v, j) => <td key={j} style={{ ...td, textAlign: j === 0 ? "left" : "right", fontWeight: j === 0 ? 600 : 500, whiteSpace: j === 0 ? "normal" : "nowrap" }}>{v}</td>)}
            </tr>
          ))}
          {total && (
            <tr>{total.map((v, j) => (
              <td key={j} style={{ ...td, borderTop: `1.5px solid rgba(11,26,48,0.16)`, textAlign: j === 0 ? "left" : "right", fontWeight: 800, whiteSpace: "nowrap" }}>{v}</td>
            ))}</tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Centro({ children }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: FONDO, color: TENUE, fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14, padding: 20, textAlign: "center" }}>{children}</div>;
}
