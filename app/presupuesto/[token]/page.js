"use client";
import { useState, useEffect } from "react";

// Cotización del admin vista por el cliente, sin login. A diferencia del PDF de antes, acá compara
// las alternativas que se le ofrecen (aéreo, marítimo LCL/FCL, marítimo integral) con sus tiempos y
// precios, y elige una. La elección le llega al admin por campanita y push.

const INK = "#0A1628", LINE = "rgba(10,22,40,0.12)", MUTED = "rgba(10,22,40,0.55)";
const GOLD_A = "#D9C08B", GOLD_B = "#B8956A";

const fmt = (n) => `USD ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }) : "";

export default function PresupuestoPage({ params }) {
  const token = params?.token;
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [elegido, setElegido] = useState("");
  const [enviando, setEnviando] = useState(false);
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

  const aceptar = async () => {
    if (!elegido) return;
    setEnviando(true);
    const r = await fetch(`/api/presupuesto/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_key: elegido }),
    });
    const d = await r.json();
    setEnviando(false);
    if (!r.ok) { alert(d.error || "No se pudo confirmar"); return; }
    setListo(d.elegida);
  };

  if (state.loading) return <Centro>Cargando…</Centro>;
  if (state.error) return <Centro>⛔ {state.error}</Centro>;

  const q = state.data.quote;
  const alts = q.alternativas || [];
  const vencida = state.data.vencida;
  const yaAceptada = state.data.aceptada || !!listo;
  const elegidaFinal = listo || alts.find((a) => a.key === q.selected);

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0", color: INK, fontFamily: "'Inter',system-ui,sans-serif", padding: "22px 16px 40px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED, margin: 0 }}>Argencargo</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", margin: "4px 0 0" }}>Tu cotización</h1>
          {q.client_name && <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 0" }}>{q.client_name}</p>}
        </div>

        {yaAceptada && elegidaFinal && (
          <div style={{ ...card(), background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.35)", textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>✓ Elegiste {elegidaFinal.name}</p>
            <p style={{ fontSize: 13, color: MUTED, margin: "6px 0 0", lineHeight: 1.5 }}>Ya avisamos a Argencargo. Un asesor te escribe por WhatsApp para coordinar los siguientes pasos.</p>
          </div>
        )}

        {!yaAceptada && vencida && (
          <div style={{ ...card(), background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)", textAlign: "center" }}>
            <p style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>Esta cotización venció</p>
            <p style={{ fontSize: 13, color: MUTED, margin: "6px 0 0", lineHeight: 1.5 }}>Los precios valían hasta el {fmtDate(q.expires_at)}. Escribinos y te pasamos una actualizada.</p>
          </div>
        )}

        {/* Qué se cotizó */}
        <div style={card()}>
          <p style={rotulo()}>La carga</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {q.total_weight > 0 && <Dato l="Peso" v={`${Number(q.total_weight).toLocaleString("es-AR")} kg`} />}
            {q.total_cbm > 0 && <Dato l="Volumen" v={`${Number(q.total_cbm).toLocaleString("es-AR")} m³`} />}
            {q.total_fob > 0 && <Dato l="Valor mercadería" v={fmt(q.total_fob)} />}
            {q.origin && <Dato l="Origen" v={q.origin} />}
          </div>
          {Array.isArray(q.products) && q.products.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
              {q.products.slice(0, 8).map((p, i) => (
                <p key={i} style={{ fontSize: 12.5, color: MUTED, margin: "0 0 3px" }}>
                  {p.description || p.name || "Producto"}{p.quantity ? ` · ${p.quantity} u` : ""}
                </p>
              ))}
              {q.products.length > 8 && <p style={{ fontSize: 11.5, color: MUTED, margin: "3px 0 0", fontStyle: "italic" }}>+{q.products.length - 8} productos más</p>}
            </div>
          )}
        </div>

        {/* Alternativas */}
        <div style={card()}>
          <p style={rotulo()}>{alts.length > 1 ? "Elegí cómo querés traerla" : "Tu opción"}</p>
          {alts.length > 1 && <p style={{ fontSize: 12.5, color: MUTED, margin: "-4px 0 12px", lineHeight: 1.5 }}>Mismo envío, distintos tiempos y costos. Tocá la que te sirva.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {alts.map((a) => {
              const sel = elegido === a.key;
              const bloqueado = yaAceptada || vencida;
              return (
                <div key={a.key} onClick={() => !bloqueado && setElegido(a.key)}
                  style={{ padding: "14px 16px", borderRadius: 13, cursor: bloqueado ? "default" : "pointer", opacity: bloqueado && !sel ? 0.5 : 1,
                    border: `1.5px solid ${sel ? GOLD_B : LINE}`, background: sel ? "rgba(184,149,106,0.09)" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 170 }}>
                      <p style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{sel ? "◉ " : "○ "}{a.name}</p>
                      {a.info && <p style={{ fontSize: 12, color: MUTED, margin: "3px 0 0" }}>🕒 {a.info}</p>}
                    </div>
                    <p style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{fmt(a.totalAbonar)}</p>
                  </div>
                  {sel && (
                    <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${LINE}`, display: "flex", gap: 14, flexWrap: "wrap" }}>
                      {a.flete > 0 && <Mini l="Flete" v={fmt(a.flete)} />}
                      {a.totalTax > 0 && <Mini l="Impuestos y aduana" v={fmt(a.totalTax)} />}
                      {a.seguro > 0 && <Mini l="Seguro" v={fmt(a.seguro)} />}
                      {a.shipCost > 0 && <Mini l="Envío a domicilio" v={fmt(a.shipCost)} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {q.notes && (
          <div style={card()}>
            <p style={rotulo()}>Notas</p>
            <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{q.notes}</p>
          </div>
        )}

        {!yaAceptada && !vencida && (
          <>
            <button onClick={aceptar} disabled={!elegido || enviando}
              style={{ width: "100%", padding: "15px 18px", fontSize: 15, fontWeight: 800, borderRadius: 13, border: "none", cursor: elegido && !enviando ? "pointer" : "not-allowed",
                background: elegido && !enviando ? `linear-gradient(135deg,${GOLD_A},${GOLD_B})` : "rgba(10,22,40,0.10)", color: elegido && !enviando ? INK : MUTED }}>
              {enviando ? "Confirmando…" : elegido ? "Confirmar esta opción" : "Elegí una opción"}
            </button>
            <p style={{ textAlign: "center", fontSize: 11, color: MUTED, margin: 0, lineHeight: 1.5 }}>
              Al confirmar avisamos a Argencargo y un asesor te contacta.
              {q.expires_at && <> Precios válidos hasta el <b>{fmtDate(q.expires_at)}</b>.</>}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function card() { return { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "16px 18px" }; }
function rotulo() { return { fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, margin: "0 0 10px" }; }
function Dato({ l, v }) {
  return <div style={{ flex: "1 1 120px", padding: "9px 11px", borderRadius: 10, background: "rgba(10,22,40,0.035)" }}>
    <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, margin: 0 }}>{l}</p>
    <p style={{ fontSize: 14, fontWeight: 700, margin: "2px 0 0" }}>{v}</p>
  </div>;
}
function Mini({ l, v }) {
  return <span style={{ fontSize: 11.5, color: MUTED }}>{l}: <b style={{ color: INK }}>{v}</b></span>;
}
function Centro({ children }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F5F0", color: MUTED, fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14, padding: 20, textAlign: "center" }}>{children}</div>;
}
