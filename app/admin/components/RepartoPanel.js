"use client";
// Reparto (13/11/2026): lado del dueño de la app de los fletes locales (Argencargo + MyBox).
// Repartidores con su link y su tarifa por kilómetro, lo que está en la calle ahora, y los viajes
// terminados con los kilómetros, lo que se le debe a cada uno y el efectivo que tiene que rendir.
import { useEffect, useState, useCallback } from "react";
import { toast, confirmDialog } from "../../../lib/ui";

const GOLD = "#B8956A", GOLD_LIGHT = "#E8D098";
const plata = (n, dec = 0) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fecha = (iso) => { if (!iso) return "—"; const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return `${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
const cobroTxt = (cobros) => (cobros || []).map((c) => `${c.moneda === "ARS" ? "$" : "USD"} ${plata(c.monto, c.monto % 1 ? 2 : 0)}${c.metodo === "transferencia" ? " transf." : ""}`).join(" + ");
const MOTIVOS = { no_estaba: "no había nadie", direccion: "dirección mal", rechazo: "no lo quiso recibir", sin_pago: "no tenía el pago", otro: "otro motivo" };

const caja = { background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 18, marginBottom: 16 };
const titulo = { margin: "0 0 12px", fontSize: 12, color: GOLD_LIGHT, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 };
const inp = { width: "100%", height: 42, padding: "0 12px", fontSize: 14, fontWeight: 600, boxSizing: "border-box", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, background: "rgba(0,0,0,0.25)", color: "#fff", outline: "none", fontFamily: "inherit" };
const rot = { display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 5, letterSpacing: "0.03em" };
const btn = (lleno) => ({ height: 36, padding: "0 14px", borderRadius: 9, border: `1px solid ${lleno ? "transparent" : "rgba(255,255,255,0.14)"}`, background: lleno ? `linear-gradient(180deg,${GOLD_LIGHT},${GOLD})` : "rgba(255,255,255,0.04)", color: lleno ? "#0F1E3D" : "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
const chip = (color) => ({ display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, color, background: `${color}22`, whiteSpace: "nowrap" });
const Llave = ({ on, onCambio, texto }) => (
  <button type="button" onClick={() => onCambio(!on)} aria-pressed={on} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
    <span style={{ width: 36, height: 20, borderRadius: 10, background: on ? GOLD : "rgba(255,255,255,0.15)", position: "relative", transition: "background 150ms", flexShrink: 0 }}><span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: 8, background: "#fff", transition: "left 150ms" }} /></span>{texto}
  </button>
);

function FormRepartidor({ inicial, onGuardar, onCancelar, guardando }) {
  const [f, setF] = useState(() => ({ nombre: "", telefono: "", tarifa_km_ars: "", cuenta_vuelta: true, activo: true, prueba: false, ...(inicial || {}), ...(inicial ? { tarifa_km_ars: String(inicial.tarifa_km_ars ?? "").replace(".", ",") } : {}) }));
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div style={{ padding: 14, borderRadius: 12, background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 14 }}>
        <label><span style={rot}>Nombre</span><input style={inp} value={f.nombre} onChange={set("nombre")} autoFocus /></label>
        <label><span style={rot}>WhatsApp</span><input style={inp} value={f.telefono || ""} onChange={set("telefono")} inputMode="tel" /></label>
        <label><span style={rot}>Pesos por km</span><input style={inp} value={f.tarifa_km_ars} onChange={(e) => setF((p) => ({ ...p, tarifa_km_ars: e.target.value.replace(/[^\d.,]/g, "") }))} inputMode="decimal" /></label>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 22px", marginBottom: 14 }}>
        <Llave on={f.cuenta_vuelta} onCambio={(v) => setF((p) => ({ ...p, cuenta_vuelta: v }))} texto="Se le paga la vuelta a la oficina" />
        <Llave on={f.prueba} onCambio={(v) => setF((p) => ({ ...p, prueba: v }))} texto="De prueba" />
        {inicial && <Llave on={f.activo} onCambio={(v) => setF((p) => ({ ...p, activo: v }))} texto="Activo" />}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn(true)} disabled={guardando} onClick={() => onGuardar(f)}>{guardando ? "Guardando…" : "Guardar"}</button>
        <button style={btn(false)} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

export default function RepartoPanel({ token }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // "nuevo" | id
  const [abierto, setAbierto] = useState(null); // viaje desplegado
  const [km, setKm] = useState({}); // viaje_id → texto en edición
  const [guardando, setGuardando] = useState(false);

  const pedir = useCallback(async (cuerpo) => {
    const r = await fetch("/api/reparto/admin", { method: cuerpo ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { "Content-Type": "application/json" } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined, cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo");
    if (j.repartidores) setD(j);
    return j;
  }, [token]);
  useEffect(() => { pedir().catch((e) => setError(e.message)); }, [pedir]);
  const hacer = async (cuerpo, ok) => { setGuardando(true); try { await pedir(cuerpo); if (ok) toast(ok); return true; } catch (e) { toast(e.message, "error"); return false; } finally { setGuardando(false); } };

  if (error) return <div style={{ ...caja, color: "#fca5a5" }}>{error}</div>;
  if (!d) return <div style={{ ...caja, color: "rgba(255,255,255,0.5)" }}>Cargando…</div>;

  const reps = d.repartidores, porId = Object.fromEntries(reps.map((r) => [r.id, r]));
  const link = (r) => `${window.location.origin.replace("argenmaq.vercel.app", "www.argencargo.com.ar")}/reparto/${r.token}`;
  const enCalle = d.viajes.filter((v) => v.estado === "abierto");
  const terminados = d.viajes.filter((v) => v.estado === "terminado");
  const rendirDe = (v) => { const t = { USD: 0, ARS: 0 }; for (const p of v.paradas) if (!p.rendido_at) for (const c of p.cobros || []) if (c.metodo === "efectivo") t[c.moneda === "ARS" ? "ARS" : "USD"] += Number(c.monto || 0); return t; };
  const rendirTxt = (t) => [t.USD > 0 ? `USD ${plata(t.USD, t.USD % 1 ? 2 : 0)}` : "", t.ARS > 0 ? `$ ${plata(t.ARS)}` : ""].filter(Boolean).join(" + ");
  // Lo que cada uno tiene pendiente: efectivo sin rendir y viajes sin pagar.
  const saldo = (r) => {
    const suyos = d.viajes.filter((v) => v.repartidor_id === r.id);
    const t = { USD: 0, ARS: 0 };
    for (const v of suyos) { const x = rendirDe(v); t.USD += x.USD; t.ARS += x.ARS; }
    return { rendir: rendirTxt(t), debe: suyos.filter((v) => v.estado === "terminado" && !v.pagado_at).reduce((a, v) => a + v.pago_final, 0) };
  };

  const paradaFila = (p) => (
    <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
      <span style={{ width: 16, flexShrink: 0, fontWeight: 800, color: p.estado === "entregado" ? "#22c55e" : p.estado === "no_entregado" ? "#f87171" : "rgba(255,255,255,0.4)" }}>{p.estado === "entregado" ? "✓" : p.estado === "no_entregado" ? "✕" : "·"}</span>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: p.base === "mybox" ? "#8BEA3A" : GOLD_LIGHT, flexShrink: 0 }}>{p.operation_code}</span>
      <span style={{ flex: 1, minWidth: 0, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.datos?.cliente}<span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 500 }}> · {p.datos?.calle}{p.datos?.localidad ? `, ${p.datos.localidad}` : ""}</span></span>
      <span style={{ flexShrink: 0, textAlign: "right", color: p.estado === "no_entregado" ? "#fca5a5" : p.cobros?.length ? "#fbbf24" : "rgba(255,255,255,0.5)", fontWeight: 700 }}>
        {p.estado === "cargado" ? `${p.datos?.franja || ""}` : p.estado === "no_entregado" ? MOTIVOS[p.motivo] || "no entregado" : p.cobros?.length ? `cobró ${cobroTxt(p.cobros)}` : p.datos?.pagado ? "ya paga" : "sin cobrar"}
        {p.resuelto_at ? <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 500 }}> · {hora(p.resuelto_at)}</span> : null}
      </span>
      {p.foto_path && <button onClick={async () => { try { const j = await pedir({ accion: "foto", parada_id: p.id }); window.open(j.url, "_blank", "noopener"); } catch (e) { toast(e.message, "error"); } }} style={{ ...btn(false), height: 26, padding: "0 9px", fontSize: 11.5, flexShrink: 0 }}>Foto</button>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" }}>Reparto</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!d.mybox && <span style={chip("#f87171")}>MyBox sin conectar</span>}
          <button style={btn(false)} onClick={() => pedir().catch((e) => toast(e.message, "error"))}>Actualizar</button>
        </div>
      </div>

      <div style={caja}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ ...titulo, margin: 0 }}>Repartidores</h3>
          {form !== "nuevo" && <button style={btn(true)} onClick={() => setForm("nuevo")}>+ Repartidor</button>}
        </div>
        {form === "nuevo" && <FormRepartidor guardando={guardando} onCancelar={() => setForm(null)} onGuardar={async (f) => { if (await hacer({ accion: "repartidor", ...f }, "Repartidor creado")) setForm(null); }} />}
        {reps.length === 0 && form !== "nuevo" && <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Todavía no hay repartidores.</div>}
        {reps.map((r) => {
          if (form === r.id) return <FormRepartidor key={r.id} inicial={r} guardando={guardando} onCancelar={() => setForm(null)} onGuardar={async (f) => { if (await hacer({ accion: "repartidor", id: r.id, ...f }, "Guardado")) setForm(null); }} />;
          const s = saldo(r);
          return (
            <div key={r.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px", padding: "11px 0", borderTop: "1px solid rgba(255,255,255,0.06)", opacity: r.activo ? 1 : 0.5 }}>
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{r.nombre}{r.prueba && <span style={chip("#fbbf24")}>PRUEBA</span>}{!r.activo && <span style={chip("#94a3b8")}>INACTIVO</span>}</div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>$ {plata(r.tarifa_km_ars)} por km{r.cuenta_vuelta ? "" : " · sin la vuelta"}{s.rendir ? <span style={{ color: "#fbbf24", fontWeight: 700 }}> · tiene {s.rendir} para rendir</span> : null}{s.debe > 0 ? <span style={{ color: GOLD_LIGHT, fontWeight: 700 }}> · se le deben $ {plata(s.debe)}</span> : null}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {s.rendir && <button style={btn(true)} disabled={guardando} onClick={async () => { if (await confirmDialog(`¿${r.nombre} te entregó ${s.rendir}?`, { title: "Rendición", confirmText: "Me lo entregó" })) hacer({ accion: "rendido", repartidor_id: r.id }, "Rendición anotada"); }}>Me lo entregó</button>}
                <button style={btn(false)} onClick={() => { navigator.clipboard?.writeText(link(r)); toast("Link copiado"); }}>Copiar link</button>
                {r.telefono && <a style={{ ...btn(false), display: "inline-flex", alignItems: "center", textDecoration: "none" }} href={`https://wa.me/${String(r.telefono).replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${r.nombre}! Este es tu link del reparto: ${link(r)}`)}`} target="_blank" rel="noreferrer">Mandar por WhatsApp</a>}
                <button style={btn(false)} onClick={() => setForm(r.id)}>Editar</button>
                <button style={btn(false)} onClick={async () => { if (await confirmDialog(`¿Darle un link nuevo a ${r.nombre}? El que tiene ahora deja de funcionar.`, { title: "Link nuevo", confirmText: "Link nuevo" })) hacer({ accion: "link", id: r.id }, "Link nuevo generado"); }}>Link nuevo</button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={caja}>
        <h3 style={titulo}>En la calle</h3>
        {enCalle.length === 0 && <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Nadie está repartiendo ahora.</div>}
        {enCalle.map((v) => {
          const hechas = v.paradas.filter((p) => p.estado !== "cargado").length;
          return (
            <div key={v.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{porId[v.repartidor_id]?.nombre || "—"} <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 600, fontSize: 13 }}>· {hechas} de {v.paradas.length}</span></div>
                {(porId[v.repartidor_id]?.prueba || hechas === 0) && <button style={{ ...btn(false), height: 28, fontSize: 11.5 }} onClick={async () => { if (await confirmDialog("¿Borrar este viaje? Los envíos vuelven a quedar para cargar.", { title: "Borrar viaje", confirmText: "Borrar" })) hacer({ accion: "borrar_viaje", viaje_id: v.id }, "Viaje borrado"); }}>Borrar</button>}
              </div>
              {v.paradas.map(paradaFila)}
            </div>
          );
        })}
        {d.sin_cargar.length > 0 && (
          <div style={{ marginTop: enCalle.length ? 16 : 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>Coordinados sin cargar · {d.sin_cargar.length}</div>
            {d.sin_cargar.map((e) => (
              <div key={`${e.base}${e.codigo}`} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: e.base === "mybox" ? "#8BEA3A" : GOLD_LIGHT, flexShrink: 0 }}>{e.codigo}</span>
                <span style={{ flex: 1, minWidth: 0, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.cliente}<span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{e.localidad ? ` · ${e.localidad}` : ""}</span></span>
                <span style={{ flexShrink: 0, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{fecha(e.dia)}{e.franja ? ` · ${e.franja}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={caja}>
        <h3 style={titulo}>Viajes</h3>
        {terminados.length === 0 && <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Todavía no hay viajes terminados.</div>}
        {terminados.map((v) => {
          const r = porId[v.repartidor_id], rendir = rendirTxt(rendirDe(v)), entregas = v.paradas.filter((p) => p.estado === "entregado").length, on = abierto === v.id;
          const cobroAlgo = v.paradas.some((p) => (p.cobros || []).some((c) => c.metodo === "efectivo"));
          return (
            <div key={v.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "11px 0" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px" }}>
                <button onClick={() => setAbierto(on ? null : v.id)} aria-expanded={on} style={{ flex: "1 1 200px", minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", color: "#fff" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{fecha(v.fecha)} · {r?.nombre || "—"}{r?.prueba ? <span style={{ ...chip("#fbbf24"), marginLeft: 8 }}>PRUEBA</span> : null}</div>
                  <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{entregas} {entregas === 1 ? "entrega" : "entregas"} · {plata(v.km_final, 1)} km{v.km_manual != null ? " (corregido)" : ""} × $ {plata(v.tarifa_km_ars)}{rendir ? <span style={{ color: "#fbbf24", fontWeight: 700 }}> · rendir {rendir}</span> : null}</div>
                </button>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>$ {plata(v.pago_final)}</div>
                <button style={{ ...btn(!v.pagado_at), minWidth: 92 }} disabled={guardando} onClick={() => hacer({ accion: "pagado", viaje_id: v.id, si: !v.pagado_at }, v.pagado_at ? "Marcado sin pagar" : "Viaje pagado")}>{v.pagado_at ? "✓ Pagado" : "Pagar"}</button>
              </div>
              {on && (
                <div style={{ marginTop: 10, padding: "4px 12px 12px", borderRadius: 10, background: "rgba(0,0,0,0.2)" }}>
                  {v.paradas.map(paradaFila)}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginTop: 12 }}>
                    <label style={{ width: 130 }}><span style={rot}>Km del viaje</span><input style={{ ...inp, height: 36 }} inputMode="decimal" value={km[v.id] ?? String(v.km_final).replace(".", ",")} onChange={(e) => setKm((p) => ({ ...p, [v.id]: e.target.value.replace(/[^\d.,]/g, "") }))} /></label>
                    <button style={btn(false)} disabled={guardando || km[v.id] == null} onClick={async () => { if (await hacer({ accion: "km", viaje_id: v.id, km: km[v.id] }, "Kilómetros corregidos")) setKm((p) => { const n = { ...p }; delete n[v.id]; return n; }); }}>Guardar km</button>
                    {v.km_manual != null && <button style={btn(false)} disabled={guardando} onClick={() => hacer({ accion: "km", viaje_id: v.id, km: "" }, `Volvió a ${plata(v.km, 1)} km`)}>Usar los {plata(v.km, 1)} km medidos</button>}
                    {cobroAlgo && <button style={btn(!!rendir)} disabled={guardando} onClick={() => hacer({ accion: "rendido", viaje_id: v.id, si: !!rendir }, rendir ? "Efectivo rendido" : "Marcado sin rendir")}>{rendir ? "Rindió el efectivo" : "✓ Rendido"}</button>}
                    {r?.prueba && <button style={btn(false)} disabled={guardando} onClick={() => hacer({ accion: "borrar_viaje", viaje_id: v.id }, "Viaje borrado")}>Borrar</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
