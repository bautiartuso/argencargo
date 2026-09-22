"use client";
// Vistas del sitio público de ARGENMAQ: catálogo (carriles por rubro), ficha, cuenta, carrito,
// cómo funciona y quiénes somos. Sin cuenta no se ve ningún número.
import { useEffect, useMemo, useState } from "react";
import { useAM, Ico, MONO, WA, viaLabel, diasVia, primeraFoto, usePrecios, precioVidriera, lineaCarrito, Logo } from "./kit";
import { escalonPara } from "../../lib/canales-maquinas";
import { PAISES, bandera, paisDe } from "./_paises";
import { PROVINCIAS } from "../../lib/provincias";
export { usePrecios, precioVidriera } from "./kit";

const COND = [["ninguna", "Consumidor final"], ["monotributista", "Monotributista"], ["responsable_inscripto", "Responsable inscripto"]];

// Desplegable propio para los formularios públicos (regla: nada nativo del navegador).
function Elegir({ value, onChange, opciones, placeholder = "Elegir…", buscable }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const sel = opciones.find((o) => o.v === value);
  const conBusqueda = buscable || opciones.length > 14;
  const lista = q.trim() ? opciones.filter((o) => `${o.l} ${o.busca || ""}`.toLowerCase().includes(q.toLowerCase())) : opciones;
  const Img = ({ o }) => o.img ? <img src={o.img} alt="" style={{ width: 22, height: 15, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} /> : null;
  return <div style={{ position: "relative" }}>
    <button type="button" className="inp" onClick={() => { setAbierto((v) => !v); setQ(""); }} style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>{sel && <Img o={sel} />}<span style={{ flex: 1, color: sel ? "var(--ink)" : "var(--gris)", fontWeight: sel ? 600 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sel ? (sel.corto || sel.l) : placeholder}</span><Ico d={["M6 9l6 6 6-6"]} size={14} /></button>
    {abierto && <><div onClick={() => setAbierto(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} /><div style={{ position: "absolute", left: 0, zIndex: 21, marginTop: 6, minWidth: "100%", width: conBusqueda ? 300 : undefined, background: "var(--card)", border: "1px solid var(--borde)", borderRadius: 14, boxShadow: "var(--sombra)", overflow: "hidden" }}>
      {conBusqueda && <div style={{ padding: 8, borderBottom: "1px solid var(--borde)" }}><input autoFocus className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} style={{ padding: "9px 12px", fontSize: 13.5 }} /></div>}
      <div style={{ maxHeight: 260, overflowY: "auto" }}>{lista.map((o) => <button key={o.v} type="button" onClick={() => { onChange(o.v); setAbierto(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 14px", border: "none", background: o.v === value ? "var(--ysuave)" : "transparent", color: "var(--ink)", cursor: "pointer", fontSize: 14, fontWeight: o.v === value ? 800 : 600 }}><Img o={o} /><span style={{ flex: 1 }}>{o.l}</span>{o.extra && <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--gris)" }}>{o.extra}</span>}</button>)}{lista.length === 0 && <p style={{ margin: 0, padding: "10px 14px", fontSize: 13, color: "var(--gris)" }}>Sin resultados</p>}</div>
    </div></>}
  </div>;
}

// ── Tarjeta de máquina ────────────────────────────────────────────────────────────────────
const CANDADO = ["M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M5 10V8a7 7 0 0 1 14 0v2", "M4 10h16v11H4z"];
export const codigoMaq = (m) => `MAQ-${String(m?.numero || 0).padStart(5, "0")}`;

export function Tarjeta({ m, precios }) {
  const { t, fmt, ses } = useAM();
  const foto = primeraFoto(m);
  const pv = precioVidriera(precios?.[m.id]);
  const [fav, setFav] = useState(false);
  useEffect(() => { try { setFav((JSON.parse(localStorage.getItem("am_fav") || "[]")).includes(m.id)); } catch {} }, [m.id]);
  const toggleFav = (e) => { e.preventDefault(); e.stopPropagation(); try { const l = JSON.parse(localStorage.getItem("am_fav") || "[]"); const nl = l.includes(m.id) ? l.filter((x) => x !== m.id) : [...l, m.id]; localStorage.setItem("am_fav", JSON.stringify(nl)); setFav(nl.includes(m.id)); } catch {} };
  return <a className="prod" href={`/m/${m.id}`}>
    <div className="img">
      {foto ? <img src={foto} alt={m.nombre} loading="lazy" /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gris)", fontSize: 13 }}>Sin foto</div>}
      {m.condicion === "usada" && <span className="tag" style={{ position: "absolute", top: 12, left: 12 }}>{t("usada").toUpperCase()}</span>}
      <button className={`fav${fav ? " on" : ""}`} onClick={toggleFav} aria-label={t("guardarFav")}><svg width="17" height="17" viewBox="0 0 24 24" fill={fav ? "#fff" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg></button>
    </div>
    <p className="nom">{m.nombre}</p>
    {ses && pv
      ? <p className="precio">{fmt(pv.unit)}{pv.q > 1 && <small>{t("desde")} {pv.q} {t("unidades")}</small>}</p>
      : <p className="precio" style={{ fontSize: 13, fontWeight: 700, color: "var(--gris)", display: "inline-flex", alignItems: "center", gap: 6 }}><Ico d={CANDADO} size={14} />{t("verPrecio")}</p>}
  </a>;
}

// ── Catálogo: carriles por rubro, panel de rubros a la derecha, búsqueda desde la isla ────
export function CatalogoVista({ arbol, lista, diasVia: dv, rubro }) {
  const { t } = useAM();
  const [q, setQ] = useState("");
  useEffect(() => { try { setQ(new URLSearchParams(window.location.search).get("q") || ""); } catch {} }, []);
  const [sub, setSub] = useState("");
  const precios = usePrecios(lista.map((m) => m.id));
  const cat = rubro ? arbol.find((c) => c.slug === rubro) : null;
  const filtradas = lista.filter((m) => (!sub || m.subcategoria === sub) && (!q.trim() || `${m.nombre} ${m.descripcion || ""} ${codigoMaq(m)}`.toLowerCase().includes(q.toLowerCase())));
  const cuenta = (slug) => lista.filter((m) => m.categoria === slug).length;
  const rubros = arbol.filter((c) => c.slug !== "otros" || cuenta(c.slug) > 0);
  return <div className="wrap" style={{ padding: "26px 24px 70px" }}>
    <div className="catGrid">
      <aside className="rubros">
        <p className="lbl">{t("rubros")}</p>
        <a className={!cat && !q.trim() ? "on" : ""} href="/catalogo">{t("todosRubros")}<span>{lista.length}</span></a>
        <hr />
        {rubros.map((c) => <a key={c.slug} className={cat?.slug === c.slug ? "on" : ""} href={`/catalogo/${c.slug}`}>{c.nombre}<span>{cuenta(c.slug) || ""}</span></a>)}
      </aside>
      <div style={{ minWidth: 0 }}>
        {(cat || q.trim()) && <div style={{ marginBottom: 18 }}>
          {cat && <a href="/catalogo" style={{ fontSize: 13, color: "var(--gris)", fontWeight: 700 }}>← {t("catalogo")}</a>}
          <h1 className="h2" style={{ marginTop: cat ? 6 : 0, fontSize: 30 }}>{q.trim() ? `${t("resultados")} “${q.trim()}”` : cat.nombre}</h1>
        </div>}
        {cat && !q.trim() && cat.subs.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}><button className={`chip${!sub ? " on" : ""}`} onClick={() => setSub("")}>{t("verTodo")}</button>{cat.subs.map((s) => <button key={s.slug} className={`chip${sub === s.slug ? " on" : ""}`} onClick={() => setSub(sub === s.slug ? "" : s.slug)}>{s.nombre}</button>)}</div>}
        {(cat || q.trim())
          ? (filtradas.length === 0 ? <p style={{ color: "var(--gris)" }}>{t("sinMaquinas")}</p> : <div className="grilla">{filtradas.map((m) => <Tarjeta key={m.id} m={m} precios={precios} />)}</div>)
          : arbol.map((c) => { const del = lista.filter((m) => m.categoria === c.slug); if (!del.length) return null; return <section key={c.slug} style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}><h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{c.nombre}</h2><span style={{ fontFamily: MONO, fontSize: 11, color: "var(--gris)" }}>{del.length}</span><span style={{ flex: 1 }} /><a href={`/catalogo/${c.slug}`} style={{ fontSize: 13.5, fontWeight: 700 }}>{t("verTodo")} →</a></div>
            <div className="carril">{del.slice(0, 10).map((m) => <Tarjeta key={m.id} m={m} precios={precios} />)}</div>
          </section>; })}
        <div style={{ marginTop: 30, padding: "22px 24px", borderRadius: 20, background: "var(--suave)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}><div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t("noEsta")}</p><p style={{ margin: "2px 0 0", color: "var(--gris)", fontSize: 14 }}>{t("noEstaSub")}</p></div><a className="btn y" href={WA("Hola ARGENMAQ, busco una máquina que no está en el catálogo: ")} target="_blank" rel="noreferrer">{t("consultar")}</a></div>
        {lista.length > 0 && !cat && <p style={{ margin: "18px 0 0", fontSize: 12.5, color: "var(--gris)" }}>{t("precioPuesto")}. {t("envioAdicional")}.</p>}
      </div>
    </div>
  </div>;
}

// ── Ficha: galería con visor, precio por cantidad, detalles técnicos y similares ─────────
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const fmtCm = (v) => (num(v) != null ? `${num(v).toLocaleString("es-AR")} cm` : null);
const fmtKg = (v) => (num(v) != null ? `${num(v).toLocaleString("es-AR")} kg` : null);

export function FichaVista({ m, cats, diasVia: dv, relacionadas }) {
  const { t, fmt, ses, carrito, setCarrito, lang, moneda } = useAM();
  const precios = usePrecios(m ? [m.id] : []);
  const [foto, setFoto] = useState(0);
  const [luz, setLuz] = useState(false);
  const [qty, setQty] = useState(1);
  const [fav, setFav] = useState(false);
  const [aviso, setAviso] = useState("");
  useEffect(() => { try { setFav((JSON.parse(localStorage.getItem("am_fav") || "[]")).includes(m?.id)); } catch {} }, [m?.id]);
  const fotos = Array.isArray(m?.fotos) ? m.fotos : [];
  const nFotos = fotos.length;
  const ir = (d) => setFoto((f) => (nFotos ? (f + d + nFotos) % nFotos : 0));
  useEffect(() => { if (!luz) return; const k = (e) => { if (e.key === "Escape") setLuz(false); if (e.key === "ArrowRight") ir(1); if (e.key === "ArrowLeft") ir(-1); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [luz, nFotos]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <div className="wrap" style={{ padding: "60px 24px" }}><h1 className="h2">Esta máquina ya no está publicada.</h1><a className="btn y" href="/catalogo" style={{ marginTop: 18 }}>{t("catalogo")}</a></div>;

  const pr = precios?.[m.id];
  const esc = pr?.escalera;
  const tramos = esc?.maritima?.length ? esc.maritima : (esc?.aerea || []);
  const minQ = Number(tramos[0]?.q) || 1;
  const q = Math.max(minQ, qty);
  const tramo = escalonPara(tramos, q);
  const unit = tramo ? Number(tramo.unit) : (precioVidriera(pr)?.unit ?? null);
  const via = tramo?.via || precioVidriera(pr)?.via || (Array.isArray(m.vias) ? m.vias[0] : null);
  const dias = via ? diasVia(via, dv) + Number(m.dias_produccion || 0) : null;
  // Fecha concreta de llegada estimada: hoy + produccion + transito. Con anio solo si cae en otro anio.
  const llegaFicha = dias != null ? (() => { const d = new Date(Date.now() + dias * 864e5); const loc = lang === "en" ? "en-GB" : lang === "ru" ? "ru-RU" : "es-AR"; return d.toLocaleDateString(loc, { day: "numeric", month: "long", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) }); })() : null;
  const enCarrito = carrito.find((i) => i.id === m.id);
  const nombreCat = (slug) => cats.find((c) => c.slug === slug)?.nombre || "";
  const codigo = codigoMaq(m);
  const agregar = () => setCarrito((c) => [...c.filter((i) => i.id !== m.id), { id: m.id, nombre: m.nombre, codigo, foto: fotos[0] || null, qty: q, modo: esc?.maritima?.length ? "maritima" : "aerea", dias_produccion: Number(m.dias_produccion || 0) }]);
  const compartir = async () => { const url = typeof window !== "undefined" ? window.location.href : ""; try { if (navigator.share) { await navigator.share({ title: m.nombre, url }); return; } } catch { return; } try { await navigator.clipboard.writeText(url); setAviso(t("copiado")); setTimeout(() => setAviso(""), 1800); } catch {} };
  const toggleFav = () => { try { const l = JSON.parse(localStorage.getItem("am_fav") || "[]"); const nl = l.includes(m.id) ? l.filter((x) => x !== m.id) : [...l, m.id]; localStorage.setItem("am_fav", JSON.stringify(nl)); setFav(nl.includes(m.id)); } catch {} };
  const med = m.medidas || {};
  const packing = Array.isArray(m.packing) ? m.packing : [];
  const pesoPacking = packing.reduce((s, b) => s + (num(b.peso_kg) || 0) * (num(b.cantidad) || 1), 0);
  const CORAZON = ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"];
  const COMPARTIR = ["M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M8.6 13.5l6.8 4", "M15.4 6.5l-6.8 4"];
  const Fila = ({ l, v }) => <div className="fila"><span>{l}</span><b>{v ?? t("sinDato")}</b></div>;
  const etiquetaTramo = (tr, i) => i === 0 ? (tramos.length > 1 ? `${t("inicial")} · ${tr.q} ${Number(tr.q) === 1 ? t("unidad") : t("unidades")}` : t("precioUnit")) : `${tr.q}+ ${t("unidades")}`;

  return <div className="wrap" style={{ padding: "22px 24px 70px" }}>
    <div className="fichaGrid">
      {/* Galería */}
      <div>
        <div className="galeriaMain" onClick={() => nFotos && setLuz(true)}>
          {fotos[foto] ? <img src={fotos[foto]} alt={m.nombre} /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gris)" }}>Sin foto</div>}
          <div className="galeriaAcc" onClick={(e) => e.stopPropagation()}>
            <button className="redondo" onClick={compartir} title={t("compartir")} aria-label={t("compartir")}><Ico d={COMPARTIR} size={17} /></button>
            <button className={`redondo${fav ? " on" : ""}`} onClick={toggleFav} title={fav ? t("guardada") : t("guardarFav")} aria-label={t("guardarFav")}><svg width="17" height="17" viewBox="0 0 24 24" fill={fav ? "#fff" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={CORAZON[0]} /></svg></button>
          </div>
          {nFotos > 1 && <><button className="flecha izq" onClick={(e) => { e.stopPropagation(); ir(-1); }} aria-label="Anterior">‹</button><button className="flecha der" onClick={(e) => { e.stopPropagation(); ir(1); }} aria-label="Siguiente">›</button></>}
          {nFotos > 0 && <span className="contador">{foto + 1} de {nFotos}</span>}
          {aviso && <span className="contador" style={{ left: "auto", right: 14, background: "var(--y)", color: "#15171A" }}>{aviso}</span>}
        </div>
        {nFotos > 1 && <div className="miniaturas">{fotos.map((f, i) => <button key={f} className={i === foto ? "on" : ""} onClick={() => setFoto(i)}><img src={f} alt="" /></button>)}</div>}
        {m.video_url && <video src={m.video_url} controls style={{ width: "100%", borderRadius: 16, marginTop: 14, background: "#000" }} />}
      </div>
      {/* Precio y compra */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12, fontFamily: MONO, fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--gris)" }}>
          <a href="/catalogo" style={{ fontWeight: 700 }}>← {t("volver")}</a><span>·</span><a href="/">{t("inicio")}</a><span>/</span><a href={`/catalogo/${m.categoria}`} style={{ fontWeight: 700 }}>{nombreCat(m.categoria)}</a>
          <span style={{ flex: 1 }} /><span>{codigo}</span>
        </div>
        <h1 style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 16px" }}>{m.nombre}</h1>
        <div className="cajaPrecio">
          {!ses && <>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Ico d={CANDADO} size={16} />{t("verPrecio")}</p>
            <p style={{ margin: "6px 0 14px", fontSize: 13.5, color: "var(--gris)" }}>{t("precioPuesto")}. {t("envioAdicional")}.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="btn y" href={`/cuenta?volver=/m/${m.id}`}>{t("ingresar")}</a><a className="btn" href={`/cuenta?registro=1&volver=/m/${m.id}`}>{t("crear")}</a></div>
          </>}
          {ses && <>
            <div className="cabPrecio"><p className="lbl" style={{ margin: 0 }}>{t("precioVolumen")}</p><div className="stepper chico" aria-label={t("cantidad")}><button onClick={() => setQty(Math.max(minQ, q - 1))} disabled={q <= minQ} aria-label="−">−</button><input type="number" min={minQ} value={q} onChange={(e) => setQty(Math.max(minQ, Math.round(Number(e.target.value) || minQ)))} /><button onClick={() => setQty(q + 1)} aria-label="+">+</button></div></div>
            {minQ > 1 && <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--gris)" }}>{t("minimo")} {minQ} {t("unidades")}</p>}
            {tramos.length === 0 && unit == null && <p style={{ margin: "10px 0 0", color: "var(--gris)" }}>Precio a confirmar. Consultanos.</p>}
            {tramos.length > 0 && <div className="tramos">{tramos.map((tr, i) => { const base = Number(tramos[0].unit); const desc = i > 0 && base > 0 ? Math.round((1 - Number(tr.unit) / base) * 100) : 0; return <button key={tr.q} className={`tramo${tramo?.q === tr.q ? " on" : ""}`} onClick={() => setQty(Number(tr.q))}><small>{etiquetaTramo(tr, i)}</small><b>{fmt(tr.unit)}</b><small>{t("precioUnit")}</small>{desc > 0 && <span className="desc">−{desc} %</span>}</button>; })}</div>}
            {tramo && (() => { const a = Number(tramo.maquina) * q, s = Number(tramo.argencargo) * q, tot = a + s, pa = tot > 0 ? Math.round((a / tot) * 100) : 0; return <div className="dosPagos">
              <div className="dosCab"><p className="lbl" style={{ margin: 0 }}>{t("seDosVeces")}</p><span>{q} {q === 1 ? t("unidad") : t("unidades")} · {pa}% + {100 - pa}%</span></div>
              <div className="dosBarra"><i style={{ width: `${pa}%` }} /></div>
              <div className="dosVeces">
                <div className="hoy"><span className="paso">1</span><p className="lbl">{t("hoy")} · {t("anticipo")}</p><b>{fmt(a)}</b><small>{fmt(tramo.maquina)} / {t("unidad")}</small><p className="nota">{t("conEstoArranca")}</p></div>
                <div><span className="paso">2</span><p className="lbl">{t("alRecibir")}</p><b>{fmt(s)}</b><small>{fmt(tramo.argencargo)} / {t("unidad")}</small><p className="nota">{llegaFicha ? `${t("aprox")} ${llegaFicha}` : t("teAvisamos")}</p></div>
              </div>
            </div>; })()}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
              <button className="btn verde" onClick={() => { agregar(); window.location.href = "/carrito"; }} disabled={unit == null}>{t("comprarAhora")}</button>
              <button className="btn y" onClick={agregar} disabled={unit == null}>{enCarrito && enCarrito.qty === q ? t("agregado") : t("agregar")}</button>
              <a className="btn k" href={WA(`Hola ARGENMAQ, consulto por ${m.nombre} (${codigo})`)} target="_blank" rel="noreferrer" style={{ gridColumn: "span 2" }}>{t("consultarWa")}</a>
            </div>
          </>}
        </div>
      </div>
    </div>

    {/* Detalles técnicos + descripción, en una sola tarjeta como la de B2Box */}
    <section className="granCard" style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 16px" }}>{t("detalles")}</h2>
      <div className="detGrid">
        <div className="detCard"><h3><span className="cir"><Ico d={["M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z", "M3.3 7l8.7 5 8.7-5", "M12 22V12"]} size={17} /></span>{t("producto")}</h3><Fila l={t("codigo")} v={codigo} /><Fila l={t("categoria")} v={nombreCat(m.categoria) || null} /><Fila l={t("subcategoria")} v={nombreCat(m.subcategoria) || null} /><Fila l={t("condicion")} v={m.condicion === "usada" ? t("usada") : t("nueva")} /></div>
        <div className="detCard"><h3><span className="cir"><Ico d={["M3 17l14-14 4 4L7 21l-4-4z", "M14 6l1.5 1.5", "M11 9l1.5 1.5", "M8 12l1.5 1.5", "M5 15l1.5 1.5"]} size={17} /></span>{t("medidas")}</h3><Fila l={t("largo")} v={fmtCm(med.largo_cm)} /><Fila l={t("ancho")} v={fmtCm(med.ancho_cm)} /><Fila l={t("alto")} v={fmtCm(med.alto_cm)} /><Fila l={t("peso")} v={fmtKg(med.peso_kg)} /></div>
        <div className="detCard"><h3><span className="cir"><Ico d={["M3 7l9-4 9 4v10l-9 4-9-4z", "M3 7l9 4 9-4", "M12 11v10", "M7.5 5l9 4"]} size={17} /></span>{t("packing")}</h3><Fila l={t("bultos")} v={packing.length ? String(packing.reduce((s, b) => s + (num(b.cantidad) || 1), 0)) : null} />{packing.map((b, i) => <Fila key={i} l={`${t("bulto")} ${i + 1}${(num(b.cantidad) || 1) > 1 ? ` × ${b.cantidad}` : ""}`} v={num(b.largo_cm) ? `${b.largo_cm} × ${b.ancho_cm} × ${b.alto_cm} cm · ${fmtKg(b.peso_kg)}` : null} />)}{packing.length > 1 && <Fila l={t("peso")} v={fmtKg(pesoPacking)} />}{m.garantia_meses > 0 && <Fila l={t("garantia")} v={`${m.garantia_meses} ${t("meses")}`} />}</div>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", margin: "30px 0 12px" }}>{t("descripcion")}</h2>
      <div style={{ padding: "20px 24px", borderRadius: 18, background: "var(--suave)" }}>{(m.descripcion || "").split(/\n{2,}/).map((par, i) => <p key={i} style={{ fontSize: 15.5, lineHeight: 1.7, margin: i ? "14px 0 0" : 0 }}>{par}</p>)}</div>
    </section>

    {relacionadas?.length > 0 && <section style={{ marginTop: 40 }}><div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}><h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>{t("similares")}</h2><span style={{ flex: 1 }} /><a href={`/catalogo/${m.categoria}`} style={{ fontSize: 13.5, fontWeight: 700 }}>{t("verTodo")} →</a></div><div className="carril">{relacionadas.map((r) => <Tarjeta key={r.id} m={r} />)}</div></section>}

    {/* Visor de fotos */}
    {luz && <div className="luz" onClick={() => setLuz(false)}>
      <div className="luzCaja" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="contador" style={{ position: "static" }}>{foto + 1} de {nFotos}</span><span style={{ flex: 1 }} /><button className="redondo" onClick={() => setLuz(false)} aria-label="Cerrar">✕</button></div>
        <div className="luzImg">{fotos[foto] && <img src={fotos[foto]} alt={m.nombre} />}{nFotos > 1 && <><button className="flecha izq" onClick={() => ir(-1)} aria-label="Anterior">‹</button><button className="flecha der" onClick={() => ir(1)} aria-label="Siguiente">›</button></>}</div>
        {nFotos > 1 && <div className="miniaturas" style={{ marginTop: 0 }}>{fotos.map((f, i) => <button key={f} className={i === foto ? "on" : ""} onClick={() => setFoto(i)}><img src={f} alt="" /></button>)}</div>}
      </div>
    </div>}
  </div>;
}

// ── Checkout en tres pasos, como el de B2Box: datos · cómo viaja · pago ─────────────────
export function CarritoVista({ diasVia: dv }) {
  const { t, fmt, ses, carrito, setCarrito, cliente, setCliente, dq, tc, lang } = useAM();
  const precios = usePrecios(carrito.map((i) => i.id));
  const [paso, setPaso] = useState(1);
  const [pago, setPago] = useState("transferencia"); const [monedaPago, setMonedaPago] = useState("ARS");
  const [codigo, setCodigo] = useState(""); const [verCodigo, setVerCodigo] = useState(false); const [codigoOk, setCodigoOk] = useState(false);
  const [enviando, setEnviando] = useState(false); const [err, setErr] = useState("");
  const [hecho, setHecho] = useState(null);
  const lineas = carrito.map((i) => ({ i, L: lineaCarrito(i, precios) }));
  const total = lineas.reduce((s, { L }) => s + (L.total || 0), 0);
  const anticipo = lineas.reduce((s, { L }) => s + (L.anticipo || 0), 0);
  const saldo = lineas.reduce((s, { L }) => s + (L.saldo || 0), 0);
  // Los días de producción salen de la ficha (vista de precios), no de lo guardado en el navegador.
  const diasMax = lineas.reduce((mx, { L }) => Math.max(mx, (L.via ? diasVia(L.via, dv) : 0) + L.diasProd), 0);
  const loc = lang === "en" ? "en-GB" : lang === "ru" ? "ru-RU" : "es-AR";
  const llega = new Date(Date.now() + Math.max(15, diasMax) * 864e5).toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
  const pct = (v) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const ars = (usd) => `$ ${Math.round(usd * (tc || 0)).toLocaleString("es-AR")}`;
  const usd = (v) => `USD ${Number(v).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  const enPesos = pago === "transferencia" || monedaPago === "ARS";
  const monto = (v) => (enPesos && tc ? ars(v) : usd(v));
  const setQty = (id, q) => setCarrito((c) => c.map((x) => x.id === id ? { ...x, qty: Math.max(1, Math.round(q) || 1) } : x));
  const confirmar = async () => { setEnviando(true); setErr(""); try { const r = await fetch("/api/argenmaq/pedido", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ses.token}` }, body: JSON.stringify({ items: lineas.map(({ i, L }) => ({ id: i.id, qty: L.q, modo: L.modo })), pago: { metodo: pago, moneda: enPesos ? "ARS" : "USD", tc: tc || null }, codigo: codigo.trim() || null }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo enviar"); setHecho(d); setCarrito([]); } catch (e) { setErr(e.message); } setEnviando(false); };
  if (hecho) return <div className="wrap" style={{ padding: "60px 24px", textAlign: "center", maxWidth: 640 }}><span className="tag">{hecho.codigo}</span><h1 className="h2" style={{ margin: "14px 0 10px" }}>¡Pedido recibido!</h1><p style={{ color: "var(--gris)", fontSize: 16, lineHeight: 1.5 }}>Te escribimos por WhatsApp con los datos para el anticipo. Podés seguir el pedido desde <a href="/cuenta" style={{ fontWeight: 800 }}>Mi cuenta</a>.</p><a className="btn y" href="/catalogo" style={{ marginTop: 18 }}>{t("catalogo")}</a></div>;
  if (!ses) return <div className="wrap" style={{ padding: "60px 24px", maxWidth: 560 }}><h1 className="h2" style={{ marginBottom: 12 }}>{t("carrito")}</h1><p style={{ color: "var(--gris)", margin: "0 0 16px" }}>{t("verPrecio")}</p><div style={{ display: "flex", gap: 8 }}><a className="btn y" href="/cuenta?volver=/carrito">{t("ingresar")}</a><a className="btn" href="/cuenta?registro=1&volver=/carrito">{t("crear")}</a></div></div>;
  if (carrito.length === 0) return <div className="wrap" style={{ padding: "60px 24px" }}><h1 className="h2" style={{ marginBottom: 12 }}>{t("carrito")}</h1><p style={{ color: "var(--gris)" }}>{t("vacio")} <a href="/catalogo" style={{ fontWeight: 800 }}>{t("catalogo")} →</a></p></div>;
  const PASOS = [t("envio"), t("pago"), t("confirmacion")];
  const idx = paso <= 2 ? 0 : 1;
  const Resumen = <div style={{ display: "grid", gap: 14, position: "sticky", top: 22 }}>
    <div className="cajaSec">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><p className="lbl" style={{ margin: 0 }}>{t("queCompras")}</p><span style={{ fontFamily: MONO, fontSize: 11, color: "var(--gris)" }}>{carrito.reduce((s, i) => s + (i.qty || 1), 0)} {t("unidades")}</span></div>
      {lineas.map(({ i, L }) => <div key={i.id} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--borde)", alignItems: "start" }}>
        {i.foto ? <img src={i.foto} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10, border: "1px solid var(--borde)", background: "#fff" }} /> : <div style={{ width: 56, height: 56, borderRadius: 10, background: "var(--suave)" }} />}
        <div style={{ minWidth: 0 }}><p style={{ margin: 0, fontWeight: 800, fontSize: 13.5, lineHeight: 1.3 }}>{i.nombre}</p><p style={{ margin: "3px 0 8px", fontFamily: MONO, fontSize: 11, color: "var(--gris)" }}>{L.q} × {L.unit != null ? fmt(L.unit) : "—"}{L.modo === "aerea" ? ` · ${t("viaAerea")}` : ""}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="stepper" style={{ height: 34 }}><button style={{ height: 34, width: 34, fontSize: 16 }} onClick={() => setQty(i.id, L.q - 1)} disabled={L.q <= L.minQ}>−</button><input style={{ height: 34, width: 42, fontSize: 13 }} type="number" value={L.q} onChange={(e) => setQty(i.id, Number(e.target.value))} /><button style={{ height: 34, width: 34, fontSize: 16 }} onClick={() => setQty(i.id, L.q + 1)}>+</button></div><button className="ico" style={{ width: 30, height: 30, border: "none" }} onClick={() => setCarrito((c) => c.filter((x) => x.id !== i.id))} aria-label={t("quitar")}><Ico d={["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6"]} size={14} /></button></div></div>
        <b style={{ fontSize: 14 }}>{L.total != null ? fmt(L.total) : "—"}</b>
      </div>)}
      <p className="lbl" style={{ margin: "16px 0 6px" }}>{t("lasCuentas")}</p>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5 }}><span style={{ color: "var(--gris)" }}>{t("subtotal")}</span><b>{fmt(total)}</b></div>
    </div>
    <div className="cajaSec">
      <p className="lbl" style={{ margin: 0 }}>{t("seDosVeces")}</p>
      <div className="dosBarra"><i style={{ width: `${pct(anticipo)}%` }} /></div>
      <div className="dosVeces" style={{ marginTop: 0 }}>
        <div className="hoy"><p className="lbl" style={{ marginBottom: 6 }}>{t("hoy")} · {pct(anticipo)}%</p><b style={{ fontSize: 22, letterSpacing: "-0.02em", display: "block" }}>{fmt(anticipo)}</b><p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.4 }}>{t("conEstoArranca")}</p></div>
        <div style={{ background: "var(--suave)", borderColor: "transparent" }}><p className="lbl" style={{ marginBottom: 6 }}>{t("alLlegar")} · {pct(saldo)}%</p><b style={{ fontSize: 22, letterSpacing: "-0.02em", display: "block" }}>{fmt(saldo)}</b><p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.4, color: "var(--gris)" }}>{t("teAvisamos")}<br /><b style={{ color: "var(--ink)" }}>{llega}</b></p></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--borde)" }}><span style={{ fontWeight: 800, fontSize: 15.5 }}>{t("totalPedido")}</span><b style={{ fontSize: 22, letterSpacing: "-0.02em" }}>{fmt(total)}</b></div>
    </div>
  </div>;
  return <div className="chkPagina">
      <div className="chkIzq" style={{ minWidth: 0 }}>
        <div className="chkNav"><a href="/" style={{ display: "flex", alignItems: "center" }}><Logo /></a><span style={{ flex: 1 }} /><a className="lk" href="/catalogo"><Ico d={["M19 12H5", "M12 19l-7-7 7-7"]} size={15} />{t("volverTienda")}</a><span className="lk"><Ico d={CANDADO} size={15} />{t("compraSegura")}</span></div>
        <p className="lbl" style={{ marginBottom: 4 }}>{t("paso")} {idx + 1} {lang === "es" ? "de" : lang === "en" ? "of" : "из"} 3</p>
        <h1 className="h2" style={{ fontSize: 36 }}>{paso === 1 ? t("infoContacto") : paso === 2 ? t("metodoImport") : t("pago")}</h1>
        <div className="pasos">{PASOS.map((pl, i) => <div key={pl} style={{ height: "auto", background: "transparent" }}><div className={i < idx ? "hecho" : i === idx ? "actual" : ""} /><span className={i === idx ? "on" : ""}>{i < idx ? "✓ " : `${i + 1} `}{pl}</span></div>)}</div>

        {paso === 1 && <>
          <div className="cajaSec"><h3>{t("infoContacto")}</h3><FormDatos key={cliente?.id || "nuevo"} cliente={cliente} setCliente={setCliente} dq={dq} ses={ses} t={t} formId="fDatos" sinBoton onListo={() => setPaso(2)} /></div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><button form="fDatos" className="btn k" style={{ minWidth: 220, height: 52 }}>{t("continuar")}</button></div>
        </>}

        {paso === 2 && <>
          <div className="cajaSec"><h3>{t("metodoImport")}</h3><p style={{ margin: "-6px 0 16px", fontSize: 14, color: "var(--gris)" }}>{t("metodoImportSub")}</p>
            <div style={{ display: "grid", gap: 14 }}>{lineas.map(({ i, L }) => { const opciones = [["maritima", t("viaMaritima")], ...(L.esc?.aerea?.length ? [["aerea", t("viaAerea")]] : [])]; return <div key={i.id} style={{ border: "1px solid var(--borde)", borderRadius: 18, padding: 14 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>{i.foto && <img src={i.foto} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", border: "1px solid var(--borde)" }} />}<div><p style={{ margin: 0, fontWeight: 800, fontSize: 14.5 }}>{i.nombre}</p><p style={{ margin: 0, fontSize: 12, color: "var(--gris)", fontFamily: MONO }}>{L.q} {t("unidades")}</p></div></div>
              <div style={{ display: "grid", gridTemplateColumns: opciones.length > 1 ? "1fr 1fr" : "1fr", gap: 8 }}>{opciones.map(([modo, l]) => { const tr = escalonPara(L.esc?.[modo] || [], L.q); const tr2 = tr?.via ? diasVia(tr.via, dv) : null; const pd = L.diasProd; return <button key={modo} className={`opcion${L.modo === modo ? " on" : ""}`} onClick={() => setCarrito((c) => c.map((x) => x.id === i.id ? { ...x, modo } : x))} disabled={!tr}><span className="radio" /><span style={{ flex: 1 }}><span style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: 800, fontSize: 14.5 }}><span>{l}</span><span>{tr ? fmt(tr.unit) : ""}{tr ? <small style={{ fontWeight: 600, color: "var(--gris)" }}> / {t("unidad")}</small> : null}</span></span>{tr ? <span style={{ display: "block", fontSize: 12, color: "var(--gris)", fontFamily: MONO, marginTop: 4 }}>{t("produccion2")} {pd} {t("dias")} + {t("transito")} {tr2} {t("dias")} · {t("llegaEn")} {pd + tr2} {t("dias")}</span> : <span style={{ display: "block", fontSize: 12, color: "var(--gris)" }}>{t("noDisponibleQty")}</span>}</span></button>; })}</div>
            </div>; })}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16, flexWrap: "wrap" }}><button className="btn" onClick={() => setPaso(1)}>← {t("volver")}</button><button className="btn k" style={{ minWidth: 220, height: 52 }} onClick={() => setPaso(3)}>{t("continuar")}</button></div>
        </>}

        {paso === 3 && <>
          <p style={{ margin: "0 0 14px", fontSize: 14.5, color: "var(--gris)" }}>{t("reservaPago")}</p>
          <div className="acord" style={{ marginBottom: 20 }}>
            <button type="button" onClick={() => setVerCodigo((v) => !v)}><Ico d={["M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z", "M7 7h.01"]} size={16} /><span style={{ flex: 1 }}>{t("codigoDesc")}</span><Ico d={[verCodigo ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"]} size={15} /></button>
            {verCodigo && <div style={{ display: "flex", gap: 8, padding: "0 0 14px" }}><input className="inp" value={codigo} onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setCodigoOk(false); }} placeholder="CÓDIGO" style={{ fontFamily: MONO }} /><button className="btn k" onClick={() => setCodigoOk(!!codigo.trim())}>{t("aplicar")}</button></div>}
            {codigoOk && <p style={{ margin: "-4px 0 14px", fontSize: 12.5, color: "var(--ok)", fontWeight: 700 }}>✓ {codigo} · {t("codigoOk")}</p>}
          </div>
          <p className="lbl">{t("elegiPago")}</p>
          <div className="pagoOpc">
            <button className={pago === "transferencia" ? "on" : ""} onClick={() => setPago("transferencia")}><b><Ico d={["M3 7h18v10H3z", "M3 11h18", "M7 15h2"]} size={17} />{t("transferencia")}</b><small>{t("transferenciaSub2")}</small></button>
            <button className={pago === "efectivo" ? "on" : ""} onClick={() => setPago("efectivo")}><b><Ico d={["M2 7h20v10H2z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M6 12h.01", "M18 12h.01"]} size={17} />{t("efectivo")}</b><small>{t("efectivoSub")}</small></button>
          </div>
          <div className="cajaSec" style={{ marginTop: 14 }}>
            {pago === "efectivo" && <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}><span style={{ fontSize: 13.5, fontWeight: 700 }}>{t("cantidad") === "Cantidad" ? "Moneda" : lang === "en" ? "Currency" : "Валюта"}</span><div className="monedaChips"><button className={monedaPago === "USD" ? "on" : ""} onClick={() => setMonedaPago("USD")}>USD</button><button className={monedaPago === "ARS" ? "on" : ""} onClick={() => setMonedaPago("ARS")}>ARS</button></div></div>}
            <div className="dosVeces" style={{ marginTop: 0 }}>
              <div className="hoy"><p className="lbl" style={{ marginBottom: 6 }}>{t("hoyPagas")}</p><b style={{ fontSize: 24, letterSpacing: "-0.02em", display: "block" }}>{monto(anticipo)}</b><p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.4 }}>{t("conEstoArranca")}</p></div>
              <div style={{ background: "var(--suave)", borderColor: "transparent" }}><p className="lbl" style={{ marginBottom: 6 }}>{t("alLlegarPagas")}</p><b style={{ fontSize: 24, letterSpacing: "-0.02em", display: "block" }}>{enPesos ? usd(saldo) : usd(saldo)}</b><p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.4, color: "var(--gris)" }}>{t("teAvisamos")} <b style={{ color: "var(--ink)" }}>{llega}</b>{enPesos ? ` · ${lang === "es" ? "al dólar de ese día" : lang === "en" ? "at that day's rate" : "по курсу того дня"}` : ""}</p></div>
            </div>
          </div>
          {err && <p style={{ color: "#D23B3B", fontSize: 13.5, margin: "12px 0 0" }}>{err}</p>}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 18, flexWrap: "wrap", alignItems: "center" }}><button className="btn" onClick={() => setPaso(2)}>← {t("volver")}</button><button className="btn k" style={{ minWidth: 240, height: 52 }} onClick={confirmar} disabled={enviando || !cliente}><Ico d={["M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M5 10V8a7 7 0 0 1 14 0v2", "M4 10h16v11H4z"]} size={15} />{enviando ? "…" : t("confirmarPedido")}</button></div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--gris)" }}>Al confirmar aceptás los <a href="/terminos" style={{ fontWeight: 700 }}>términos y condiciones</a>. Tenés 24 horas desde el anticipo para arrepentirte sin costo.</p>
        </>}
      </div>
      <div className="chkDer">{Resumen}</div>
  </div>;
}

// ── Cuenta: ingresar, crear cuenta (mismos datos que Argencargo) y panel del cliente ─────
export function CuentaVista() {
  const { t, fmt, ses, cliente, setCliente, login, salir, sf, dq, guardarSes } = useAM();
  const [modo, setModo] = useState("login");
  const [volver, setVolver] = useState("/catalogo");
  useEffect(() => { try { const u = new URL(window.location.href); if (u.searchParams.get("registro")) setModo("registro"); if (u.searchParams.get("volver")) setVolver(u.searchParams.get("volver")); } catch {} }, []);
  if (ses) return <Panel cliente={cliente} setCliente={setCliente} dq={dq} salir={salir} t={t} fmt={fmt} ses={ses} />;
  return <div className="wrap" style={{ padding: "40px 24px 70px", maxWidth: 560 }}>
    <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 999, background: "var(--suave)", marginBottom: 22 }}>{[["login", t("tengo")], ["registro", t("crear")]].map(([k, l]) => <button key={k} onClick={() => setModo(k)} style={{ padding: "9px 16px", borderRadius: 999, border: "none", background: modo === k ? "var(--y)" : "transparent", color: modo === k ? "#15171A" : "var(--gris)", fontWeight: 800, cursor: "pointer", fontSize: 13.5 }}>{l}</button>)}</div>
    {modo === "login" ? <Login login={login} t={t} volver={volver} /> : <Registro sf={sf} guardarSes={guardarSes} t={t} volver={volver} />}
  </div>;
}
// Input de formulario. Vive a nivel de módulo a propósito: definido dentro del componente se
// volvía un componente nuevo en cada render, React lo desmontaba y el foco se perdía a cada letra.
function CampoTxt({ k, l, f, set, type = "text", req = true, span }) {
  return <label className="lbl" style={{ gridColumn: span ? "span 2" : undefined }}>{l}<input className="inp" type={type} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} required={req} style={{ marginTop: 6 }} /></label>;
}
// WhatsApp con código de país aparte (todos los países, con bandera). Se guarda como +54911… .
const OPC_PAISES = PAISES.map(([iso, dial, nombre]) => ({ v: iso, l: `${nombre} ${dial}`, corto: dial, extra: "", img: bandera(iso), busca: `${dial} ${iso}` }));
function CampoWa({ f, set }) {
  return <div style={{ gridColumn: "span 2" }}><span className="lbl">WhatsApp</span><div className="waPref">
    <Elegir value={f.wa_iso} onChange={(v) => set("wa_iso", v)} opciones={OPC_PAISES} placeholder="País" buscable />
    <input className="inp" type="tel" inputMode="numeric" value={f.wa_num ?? ""} onChange={(e) => set("wa_num", e.target.value.replace(/[^0-9 ]/g, ""))} placeholder="9 11 2345 6789" required />
  </div></div>;
}
// Los clientes de Argencargo tienen el número guardado como dígitos con país y sin "+" (5491…):
// se reconoce el prefijo igual, con o sin el signo, para no duplicarlo al guardar. Entre países
// que comparten prefijo (+1, +7) gana el primero de la lista con el prefijo más largo.
const partirWa = (w) => { const d = String(w || "").replace(/[^0-9]/g, ""); if (!d) return { wa_iso: "AR", wa_num: "" }; const cand = PAISES.filter((p) => d.startsWith(p[1].slice(1))).sort((a, b) => b[1].length - a[1].length)[0]; return cand ? { wa_iso: cand[0], wa_num: d.slice(cand[1].length - 1) } : { wa_iso: "AR", wa_num: d }; };
const unirWa = (f) => `${paisDe(f.wa_iso || "AR")[1]}${String(f.wa_num || "").replace(/\D/g, "")}`;

function Login({ login, t, volver }) {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [err, setErr] = useState(""); const [lo, setLo] = useState(false);
  const entrar = async (e) => { e.preventDefault(); setLo(true); setErr(""); try { await login(email.trim(), pass); window.location.href = volver || "/catalogo"; } catch (er) { setErr(er.message); } setLo(false); };
  return <form onSubmit={entrar} style={{ display: "grid", gap: 12 }}>
    <h1 className="h2" style={{ fontSize: 30 }}>{t("ingresar")}</h1>
    <p style={{ margin: "-4px 0 6px", color: "var(--gris)", fontSize: 14 }}>Es la misma cuenta que usás en Argencargo.</p>
    <label className="lbl">{t("email")}<input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ marginTop: 6 }} /></label>
    <label className="lbl">{t("pass")}<input className="inp" type="password" value={pass} onChange={(e) => setPass(e.target.value)} required style={{ marginTop: 6 }} /></label>
    {err && <p style={{ color: "#D23B3B", fontSize: 13.5, margin: 0 }}>{err}</p>}
    <button className="btn y" disabled={lo}>{lo ? "…" : t("entrar")}</button>
  </form>;
}
function Registro({ sf, guardarSes, t, volver }) {
  const [f, setF] = useState({ first_name: "", last_name: "", wa_iso: "AR", wa_num: "", email: "", password: "", street: "", floor_apt: "", postal_code: "", city: "", province: "", tax_condition: "ninguna", company_name: "", cuit: "", dni: "" });
  const [err, setErr] = useState(""); const [lo, setLo] = useState(false); const [ok, setOk] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const gc = (fn, ln) => (fn.substring(0, 3) + ln.substring(0, 3)).toUpperCase();
  const registrar = async (e) => { e.preventDefault(); setErr(""); if (f.password.length < 6) { setErr("La contraseña tiene que tener al menos 6 caracteres"); return; } if (String(f.wa_num || "").replace(/\D/g, "").length < 8) { setErr("WhatsApp inválido"); return; } if (["responsable_inscripto", "monotributista"].includes(f.tax_condition) && f.cuit.replace(/\D/g, "").length !== 11) { setErr("CUIT inválido (11 dígitos)"); return; } if (f.tax_condition === "ninguna" && f.dni.replace(/\D/g, "").length < 7) { setErr("DNI inválido"); return; } if (!f.province) { setErr("Elegí la provincia"); return; } setLo(true); try {
    const data = { role: "cliente", first_name: f.first_name.trim(), last_name: f.last_name.trim(), whatsapp: unirWa(f), dni: f.dni.trim() || null, tax_condition: f.tax_condition, company_name: f.company_name.trim(), cuit: f.cuit.trim(), street: f.street.trim(), floor_apt: f.floor_apt.trim(), postal_code: f.postal_code.trim(), city: f.city.trim(), province: f.province, origen: "argenmaq" };
    const a = (await sf("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email: f.email.trim(), password: f.password, data }) })).body;
    if (a?.error || a?.msg || a?.error_description) throw new Error(a.error?.message || a.msg || a.error_description);
    if (!a?.access_token) { setOk("Te enviamos un mail para confirmar la cuenta. Después ingresá con tu email y contraseña."); setLo(false); return; }
    const body = { auth_user_id: a.user.id, first_name: data.first_name, last_name: data.last_name, whatsapp: data.whatsapp, dni: data.dni, email: f.email.trim(), tax_condition: f.tax_condition, company_name: f.tax_condition === "responsable_inscripto" ? data.company_name : null, cuit: ["responsable_inscripto", "monotributista"].includes(f.tax_condition) ? data.cuit : null, street: data.street, floor_apt: data.floor_apt || null, postal_code: data.postal_code, city: data.city, province: data.province, terms_accepted_at: new Date().toISOString() };
    const base = gc(data.first_name, data.last_name); let creado = null;
    for (let i = 0; i < 12 && !creado; i++) { const code = i === 0 ? base : `${base.slice(0, 5)}${i + 1}`; const r = await sf("/rest/v1/clients", { method: "POST", body: JSON.stringify({ ...body, client_code: code }), headers: { Authorization: `Bearer ${a.access_token}`, Prefer: "return=representation" } }); if (r.status < 300 && Array.isArray(r.body) && r.body[0]?.id) creado = r.body[0]; else if (!(r.body?.code === "23505" || /client_code|duplicate|unique/i.test(`${r.body?.message || ""}`))) throw new Error(r.body?.message || "No se pudo guardar tu ficha"); }
    guardarSes({ token: a.access_token, refresh: a.refresh_token, user: a.user }); window.location.href = volver || "/catalogo";
  } catch (er) { setErr(er.message || "Error"); } setLo(false); };
  if (ok) return <p style={{ fontSize: 15, lineHeight: 1.5 }}>{ok}</p>;
  return <form onSubmit={registrar} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
    <h1 className="h2" style={{ fontSize: 30, gridColumn: "span 2" }}>{t("crear")}</h1>
    <p style={{ margin: "-4px 0 4px", color: "var(--gris)", fontSize: 14, gridColumn: "span 2" }}>Con la cuenta ves los precios de todas las máquinas. Es la misma cuenta que Argencargo.</p>
    <CampoTxt f={f} set={set} k="first_name" l="Nombre" /><CampoTxt f={f} set={set} k="last_name" l="Apellido" />
    <CampoTxt f={f} set={set} k="email" l={t("email")} type="email" span /><CampoWa f={f} set={set} />
    <CampoTxt f={f} set={set} k="password" l={t("pass")} type="password" span />
    <CampoTxt f={f} set={set} k="street" l="Calle y número" /><CampoTxt f={f} set={set} k="floor_apt" l="Piso / depto" req={false} />
    <CampoTxt f={f} set={set} k="city" l="Localidad" /><div><span className="lbl">Provincia</span><Elegir value={f.province} onChange={(v) => set("province", v)} opciones={PROVINCIAS} /></div>
    <CampoTxt f={f} set={set} k="postal_code" l="Código postal" />
    <div><span className="lbl">Condición fiscal</span><Elegir value={f.tax_condition} onChange={(v) => set("tax_condition", v)} opciones={COND.map(([v, l]) => ({ v, l }))} /></div>
    {f.tax_condition === "responsable_inscripto" && <CampoTxt f={f} set={set} k="company_name" l="Razón social" />}
    {["responsable_inscripto", "monotributista"].includes(f.tax_condition) ? <CampoTxt f={f} set={set} k="cuit" l="CUIT" /> : <CampoTxt f={f} set={set} k="dni" l="DNI" />}
    {err && <p style={{ color: "#D23B3B", fontSize: 13.5, margin: 0, gridColumn: "span 2" }}>{err}</p>}
    <button className="btn y" disabled={lo} style={{ gridColumn: "span 2" }}>{lo ? "…" : t("registrarse")}</button>
    <p style={{ margin: 0, fontSize: 12, color: "var(--gris)", gridColumn: "span 2" }}>Al crear la cuenta aceptás los <a href="/terminos" style={{ fontWeight: 700 }}>términos y condiciones</a>.</p>
  </form>;
}
const EST = { nuevo: "Nueva", pagado: "Pagada", en_produccion: "En producción", listo_fabrica: "Lista en fábrica", en_importacion: "En importación", entregado: "Entregada", cancelado: "Cancelada" };
// Ficha del cliente: la usan Mi cuenta y el paso 1 del checkout. Si la cuenta todavía no tiene
// cliente (una cuenta del equipo, o creada antes de que existiera el registro), se crea acá.
function FormDatos({ cliente, setCliente, dq, ses, t, onListo, textoBoton, formId, sinBoton }) {
  const [f, setF] = useState(() => ({ first_name: cliente?.first_name || "", last_name: cliente?.last_name || "", ...partirWa(cliente?.whatsapp), street: cliente?.street || "", floor_apt: cliente?.floor_apt || "", postal_code: cliente?.postal_code || "", city: cliente?.city || "", province: cliente?.province || "", tax_condition: cliente?.tax_condition || "ninguna", company_name: cliente?.company_name || "", cuit: cliente?.cuit || "", dni: cliente?.dni || "" }));
  const [err, setErr] = useState(""); const [lo, setLo] = useState(false);
  // Con condición fiscal y CUIT ya cargados, esos dos campos quedan bloqueados (regla del 22/09/2026;
  // la base también lo impide). Un consumidor final sí puede pasar a monotributista o RI.
  const fiscalBloq = !!(cliente?.id && ["monotributista", "responsable_inscripto"].includes(cliente.tax_condition) && String(cliente.cuit || "").trim());
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const gc = (fn, ln) => (fn.substring(0, 3) + ln.substring(0, 3)).toUpperCase();
  const guardar = async (e) => { e.preventDefault(); setErr(""); if (String(f.wa_num || "").replace(/\D/g, "").length < 8) { setErr("WhatsApp inválido"); return; } setLo(true);
    try {
      const body = { first_name: f.first_name.trim(), last_name: f.last_name.trim(), whatsapp: unirWa(f), dni: f.dni.trim() || null, tax_condition: f.tax_condition, company_name: f.tax_condition === "responsable_inscripto" ? f.company_name.trim() : null, cuit: ["responsable_inscripto", "monotributista"].includes(f.tax_condition) ? f.cuit.trim() : null, street: f.street.trim(), floor_apt: f.floor_apt.trim() || null, postal_code: f.postal_code.trim(), city: f.city.trim(), province: f.province };
      let row = null;
      if (cliente?.id) { const b2 = { ...body }; if (fiscalBloq) { delete b2.tax_condition; delete b2.cuit; } const r = await dq("clients", { method: "PATCH", filters: `?id=eq.${cliente.id}`, body: b2 }); row = Array.isArray(r) ? r[0] : r; }
      else {
        // Las cuentas del equipo (admin / empleado) no son clientes: crearles una ficha duplica a
        // la persona en Argencargo (pasó con BAUART → BAUAR2, 22/09/2026).
        const prof = await dq("profiles", { filters: `?id=eq.${ses.user?.id}&select=role` }).catch(() => []);
        if (["admin", "empleado"].includes(Array.isArray(prof) ? prof[0]?.role : null)) throw new Error("Esta es una cuenta del equipo de Argencargo. Para comprar, ingresá con tu cuenta de cliente.");
        const base = gc(body.first_name || "CLI", body.last_name || "ENT"); let creado = null, ultimo = "";
        for (let i = 0; i < 12 && !creado; i++) { const code = i === 0 ? base : `${base.slice(0, 5)}${i + 1}`; try { const r = await dq("clients", { method: "POST", body: { ...body, auth_user_id: ses.user?.id, email: ses.user?.email || null, client_code: code } }); creado = Array.isArray(r) ? r[0] : r; } catch (er) { ultimo = er.message || ""; if (!/duplicate|unique|23505/i.test(ultimo)) throw er; } }
        if (!creado) throw new Error(ultimo || "No se pudo crear la ficha");
        row = creado;
      }
      const nuevo = { ...(cliente || {}), ...(row || body) }; setCliente(nuevo); onListo?.(nuevo);
    } catch (er) { setErr(er.message || "Error"); } setLo(false); };
  return <form id={formId} onSubmit={guardar} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
    <CampoTxt f={f} set={set} k="first_name" l="Nombre" /><CampoTxt f={f} set={set} k="last_name" l="Apellido" />
    <CampoWa f={f} set={set} />
    <CampoTxt f={f} set={set} k="street" l="Calle y número" /><CampoTxt f={f} set={set} k="floor_apt" l="Piso / depto" req={false} />
    <CampoTxt f={f} set={set} k="city" l="Localidad" /><div><span className="lbl">Provincia</span><Elegir value={f.province} onChange={(v) => set("province", v)} opciones={PROVINCIAS} /></div>
    <CampoTxt f={f} set={set} k="postal_code" l="Código postal" />
    {fiscalBloq
      ? <>
        <div><span className="lbl">Condición fiscal</span><div className="inp" style={{ background: "var(--suave)", color: "var(--gris)" }}>{(COND.find(([v]) => v === f.tax_condition) || [])[1]}</div></div>
        <div><span className="lbl">CUIT</span><div className="inp" style={{ background: "var(--suave)", color: "var(--gris)", fontFamily: MONO }}>{f.cuit}</div></div>
        {f.tax_condition === "responsable_inscripto" && <CampoTxt f={f} set={set} k="company_name" l="Razón social" />}
        <p style={{ gridColumn: "span 2", margin: 0, fontSize: 12.5, color: "var(--gris)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><Ico d={["M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M5 10V8a7 7 0 0 1 14 0v2", "M4 10h16v11H4z"]} size={14} />{t("fiscalBloq")} <a href={WA(`Hola ARGENMAQ, quiero cambiar mis datos fiscales (${cliente?.client_code || ""})`)} target="_blank" rel="noreferrer" style={{ fontWeight: 800 }}>{t("pedirAut")} →</a></p>
      </>
      : <>
        <div><span className="lbl">Condición fiscal</span><Elegir value={f.tax_condition} onChange={(v) => set("tax_condition", v)} opciones={COND.map(([v, l]) => ({ v, l }))} /></div>
        {f.tax_condition === "responsable_inscripto" && <CampoTxt f={f} set={set} k="company_name" l="Razón social" />}
        {["responsable_inscripto", "monotributista"].includes(f.tax_condition) ? <CampoTxt f={f} set={set} k="cuit" l="CUIT" /> : <CampoTxt f={f} set={set} k="dni" l="DNI" />}
      </>}
    {err && <p style={{ color: "#D23B3B", fontSize: 13.5, margin: 0, gridColumn: "span 2" }}>{err}</p>}
    {!sinBoton && <div style={{ display: "flex", gap: 8, gridColumn: "span 2" }}><button className="btn y" disabled={lo}>{lo ? "…" : (textoBoton || t("guardarDatos"))}</button></div>}
  </form>;
}
function MisDatos({ cliente, setCliente, dq, ses, t }) {
  const [abierto, setAbierto] = useState(!cliente); const [ok, setOk] = useState("");
  return <div style={{ padding: "18px 20px", borderRadius: 18, border: "1px solid var(--borde)", background: "var(--card)", marginBottom: 22 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, flex: 1 }}>{t("misDatos")}</h2>
      {cliente && <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--gris)" }}>{cliente.client_code}</span>}
      {cliente && !abierto && <button className="btn s" onClick={() => setAbierto(true)}>Editar</button>}
    </div>
    {!cliente && <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--gris)" }}>{t("completaDatos")}</p>}
    {cliente && !abierto && <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--gris)" }}>{[cliente.first_name, cliente.last_name].filter(Boolean).join(" ")} · {cliente.whatsapp || "—"} · {[cliente.street, cliente.city, cliente.province].filter(Boolean).join(", ") || "—"}</p>}
    {ok && !abierto && <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ok)", fontWeight: 700 }}>{ok}</p>}
    {abierto && <div style={{ marginTop: 16 }}><FormDatos cliente={cliente} setCliente={setCliente} dq={dq} ses={ses} t={t} onListo={() => { setOk(t("datosOk")); setAbierto(false); }} />{cliente && <button className="btn" style={{ marginTop: 8 }} onClick={() => setAbierto(false)}>Cancelar</button>}</div>}
  </div>;
}
function Interruptor({ on, onChange }) { return <button type="button" className={`sw${on ? " on" : ""}`} onClick={() => onChange(!on)} aria-pressed={on}><i /></button>; }
const ICO = {
  caja: ["M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z", "M3.3 7l8.7 5 8.7-5", "M12 22V12"],
  persona: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  corazon: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"],
  campana: ["M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  salir: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  mail: ["M4 4h16v16H4z", "M4 6l8 7 8-7"],
  chat: ["M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12z"],
  lapiz: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
};
// Mi perfil: historial de compras, información, favoritos y notificaciones, como el de B2Box.
function Panel({ cliente, setCliente, dq, salir, t, fmt, ses }) {
  const [sec, setSec] = useState("pedidos");
  useEffect(() => { try { const s = new URLSearchParams(window.location.search).get("s"); if (["pedidos", "info", "favoritos", "notif"].includes(s)) setSec(s); } catch {} }, []);
  const ir = (k) => { setSec(k); try { window.history.replaceState(null, "", `/cuenta?s=${k}`); } catch {} };
  const NAV = [["pedidos", t("historial"), ICO.caja], ["info", t("informacion"), ICO.persona], ["favoritos", t("favoritos"), ICO.corazon], ["notif", t("notif"), ICO.campana]];
  return <div className="wrap" style={{ padding: "26px 24px 70px" }}>
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
      <button className="btn borde" onClick={() => { salir(); window.location.href = "/"; }}><Ico d={ICO.salir} size={16} />{t("cerrarSesion")}</button>
    </div>
    <div className="perfilGrid">
      <nav className="perfilNav">{NAV.map(([k, l, d]) => <a key={k} href={`/cuenta?s=${k}`} className={sec === k ? "on" : ""} onClick={(e) => { e.preventDefault(); ir(k); }}><span className="cir"><Ico d={d} size={18} /></span>{l}</a>)}</nav>
      <div className="perfilCard">
        {sec === "pedidos" && <Pedidos dq={dq} t={t} fmt={fmt} ses={ses} />}
        {sec === "info" && <Informacion cliente={cliente} setCliente={setCliente} dq={dq} ses={ses} t={t} />}
        {sec === "favoritos" && <Favoritos dq={dq} t={t} />}
        {sec === "notif" && <Notificaciones cliente={cliente} dq={dq} t={t} />}
      </div>
    </div>
  </div>;
}
function Pedidos({ dq, t, fmt, ses }) {
  const [ops, setOps] = useState(null); const [seg, setSeg] = useState({}); const [pag, setPag] = useState(0); const POR = 10;
  useEffect(() => { (async () => { try { const r = await dq("cat_pedidos", { filters: "?select=id,numero,estado,items,precio_total,importacion_usd,created_at,operation_id&order=created_at.desc" }); setOps(Array.isArray(r) ? r : []); } catch { setOps([]); } })(); }, [ses?.token]); // eslint-disable-line react-hooks/exhaustive-deps
  const verSeg = async (id) => { try { const r = await dq("rpc/argenmaq_seguimiento", { method: "POST", body: { p_pedido: id }, prefer: "return=representation" }); setSeg((s) => ({ ...s, [id]: Array.isArray(r) && r[0] ? r[0] : { vacio: true } })); } catch { setSeg((s) => ({ ...s, [id]: { vacio: true } })); } };
  const lista = ops || []; const pagina = lista.slice(pag * POR, pag * POR + POR); const n = lista.length;
  return <>
    <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("pedidos")}</h2>
    {ops === null ? <p style={{ color: "var(--gris)" }}>…</p> : n === 0
      ? <div className="vacio"><span className="cir"><Ico d={ICO.caja} size={26} /></span><p style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{t("sinPedidosT")}</p><p style={{ margin: "0 0 22px", color: "var(--gris)", fontSize: 15.5, maxWidth: 360, lineHeight: 1.5 }}>{t("sinPedidosS")}</p><a className="btn y" href="/catalogo">{t("verCatalogo")}</a></div>
      : <div style={{ display: "grid", gap: 10 }}>{pagina.map((o) => <div key={o.id} style={{ padding: "16px 18px", borderRadius: 18, border: "1px solid var(--borde)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><span className="tag">AM-{String(o.numero || 0).padStart(5, "0")}</span><b style={{ flex: 1 }}>{(o.items || []).map((i) => `${i.qty > 1 ? `${i.qty}× ` : ""}${i.nombre}`).join(" · ")}</b><span className="chip" style={{ cursor: "default" }}>{EST[o.estado] || o.estado}</span><span style={{ fontFamily: MONO, fontSize: 12, color: "var(--gris)" }}>{new Date(o.created_at).toLocaleDateString("es-AR")}</span></div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 13.5, color: "var(--gris)" }}><span>{t("anticipo")}: <b style={{ color: "var(--ink)" }}>{fmt(o.precio_total)}</b></span>{o.importacion_usd != null && <span>{t("alRecibir")}: <b style={{ color: "var(--ink)" }}>{fmt(o.importacion_usd)}</b></span>}{o.operation_id && !seg[o.id] && <button className="chip" onClick={() => verSeg(o.id)}>{t("seguimiento")}</button>}</div>
        {o.operation_id && seg[o.id] && <div style={{ marginTop: 10 }}>{seg[o.id].vacio ? <span style={{ fontSize: 13, color: "var(--gris)" }}>Seguimiento no disponible todavía.</span> : <div style={{ fontSize: 13.5, display: "flex", gap: 14, flexWrap: "wrap" }}><span>Operación <b>{seg[o.id].operation_code}</b></span><span>Estado <b>{seg[o.id].status}</b></span>{seg[o.id].eta && <span>ETA <b>{seg[o.id].eta}</b></span>}</div>}</div>}
      </div>)}</div>}
    <div style={{ marginTop: "auto", paddingTop: 22, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontFamily: MONO, fontSize: 11.5, color: "var(--gris)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
      <span>{t("mostrando")} {n ? pag * POR + 1 : 0}–{Math.min(n, (pag + 1) * POR)} {lang2(t)} {n}</span><span style={{ flex: 1 }} />
      <button className="chip" disabled={pag === 0} onClick={() => setPag((p) => Math.max(0, p - 1))} style={{ opacity: pag === 0 ? 0.4 : 1 }}>‹ {t("anterior")}</button><span className="ico" style={{ cursor: "default", fontWeight: 800, color: "var(--ink)", borderColor: "var(--ink)" }}>{pag + 1}</span><button className="chip" disabled={(pag + 1) * POR >= n} onClick={() => setPag((p) => p + 1)} style={{ opacity: (pag + 1) * POR >= n ? 0.4 : 1 }}>{t("proximo")} ›</button>
    </div>
  </>;
}
const lang2 = (t) => (t("dias") === "días" ? "de" : t("dias") === "days" ? "of" : "из");
function Informacion({ cliente, setCliente, dq, ses, t }) {
  const [ok, setOk] = useState("");
  const ini = `${(cliente?.first_name || ses?.user?.email || "?")[0] || ""}${(cliente?.last_name || "")[0] || ""}`.toUpperCase();
  const wa = partirWa(cliente?.whatsapp);
  return <>
    <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 26 }}>
      <span style={{ width: 62, height: 62, borderRadius: "50%", background: "var(--ysuave)", border: "1px solid var(--y)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>{ini}</span>
      <div style={{ minWidth: 0 }}><p style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", textTransform: "uppercase" }}>{[cliente?.first_name, cliente?.last_name].filter(Boolean).join(" ") || t("cuenta")}</p><p style={{ margin: "4px 0 0", fontFamily: MONO, fontSize: 13, color: "var(--gris)" }}>{ses?.user?.email}</p>{cliente?.whatsapp && <p style={{ margin: "4px 0 0", fontFamily: MONO, fontSize: 13, color: "var(--gris)", display: "flex", alignItems: "center", gap: 8 }}><img src={bandera(wa.wa_iso)} alt="" style={{ width: 20, height: 14, borderRadius: 3 }} />{paisDe(wa.wa_iso)[1]} {wa.wa_num}</p>}</div>
    </div>
    <h2 style={{ margin: "0 0 14px", fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("datosEntrega")}</h2>
    {!cliente && <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--gris)" }}>{t("completaDatos")}</p>}
    <FormDatos key={cliente?.id || "nuevo"} cliente={cliente} setCliente={setCliente} dq={dq} ses={ses} t={t} onListo={() => { setOk(t("datosOk")); setTimeout(() => setOk(""), 2500); }} />
    {ok && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--ok)", fontWeight: 700 }}>✓ {ok}</p>}
  </>;
}
function Favoritos({ dq, t }) {
  const [ids, setIds] = useState(null); const [maqs, setMaqs] = useState([]);
  useEffect(() => { let l = []; try { l = JSON.parse(localStorage.getItem("am_fav") || "[]"); } catch {} setIds(l); if (!l.length) return; (async () => { try { const r = await dq("cat_maquinas_publicas", { filters: `?select=id,numero,nombre,categoria,subcategoria,condicion,fotos,dias_produccion,vias&id=in.(${l.map((x) => `"${x}"`).join(",")})` }); setMaqs(Array.isArray(r) ? r : []); } catch { setMaqs([]); } })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const precios = usePrecios(maqs.map((m) => m.id));
  if (ids === null) return null;
  if (!ids.length || (ids.length && !maqs.length)) return <div className="vacio"><span className="cir"><Ico d={ICO.corazon} size={26} /></span><p style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{t("sinFavT")}</p><p style={{ margin: "0 0 22px", color: "var(--gris)", fontSize: 15.5, maxWidth: 360, lineHeight: 1.5 }}>{t("sinFavS")}</p><a className="btn y" href="/catalogo">{t("verCatalogo")}</a></div>;
  return <><h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("favoritos")}</h2><div className="grilla">{maqs.map((m) => <Tarjeta key={m.id} m={m} precios={precios} />)}</div></>;
}
function Notificaciones({ cliente, dq, t }) {
  const CLAVES = [["novedades", t("nNovedades")], ["pedidos", t("nPedidos")], ["promos", t("nPromos")], ["encuestas", t("nEncuestas")]];
  const base = { mail: { novedades: true, pedidos: true, promos: true, encuestas: true }, wa: { novedades: true, pedidos: true, promos: true, encuestas: true } };
  const [prefs, setPrefs] = useState(base); const [ok, setOk] = useState(""); const [lo, setLo] = useState(false);
  useEffect(() => { if (!cliente?.id) return; (async () => { try { const r = await dq("argenmaq_prefs", { filters: `?client_id=eq.${cliente.id}&select=prefs` }); const p = Array.isArray(r) && r[0]?.prefs; if (p) setPrefs({ mail: { ...base.mail, ...(p.mail || {}) }, wa: { ...base.wa, ...(p.wa || {}) } }); } catch {} })(); }, [cliente?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (canal, k, v) => setPrefs((p) => ({ ...p, [canal]: { ...p[canal], [k]: v } }));
  const guardar = async () => { if (!cliente?.id) return; setLo(true); try { await dq("argenmaq_prefs", { method: "POST", body: { client_id: cliente.id, prefs, updated_at: new Date().toISOString() }, prefer: "resolution=merge-duplicates,return=minimal" }); setOk(t("prefsOk")); setTimeout(() => setOk(""), 2500); } catch (e) { setOk(e.message); } setLo(false); };
  const Canal = ({ k, titulo, icono }) => <div className="notifCard"><div style={{ display: "flex", alignItems: "center", gap: 12 }}><span className="ico" style={{ width: 44, height: 44, cursor: "default" }}><Ico d={icono} size={18} /></span><b style={{ fontSize: 16.5 }}>{titulo}</b></div><p style={{ margin: "10px 0 6px", fontSize: 14, color: "var(--gris)" }}>{t("notifS")}</p>{CLAVES.map(([c, l]) => <div key={c} className="notifFila"><span>{l}</span><Interruptor on={!!prefs[k][c]} onChange={(v) => set(k, c, v)} /></div>)}</div>;
  return <>
    <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{t("notifT")}</h2>
    <p style={{ margin: "0 0 18px", color: "var(--gris)", fontSize: 15 }}>{t("notifS")}</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}><Canal k="mail" titulo={t("notifMail")} icono={ICO.mail} /><Canal k="wa" titulo={t("notifWa")} icono={ICO.chat} /></div>
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14, marginTop: 22 }}>{ok && <span style={{ fontSize: 13, color: "var(--ok)", fontWeight: 700 }}>✓ {ok}</span>}<button className="btn y" onClick={guardar} disabled={lo || !cliente}>{lo ? "…" : t("guardarPrefs")}</button></div>
    {!cliente && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--gris)" }}>{t("completaDatos")}</p>}
  </>;
}

// ── Cómo funciona / Quiénes somos ─────────────────────────────────────────────────────────
export function ComoFunciona() {
  const P = [["01", "Elegís la máquina", "Entrás al catálogo, ves fotos, descripción y tiempo estimado. Con tu cuenta ves el precio final, puesto en nuestro depósito de CABA."], ["02", "Confirmás y pagás la máquina", "El anticipo es el precio de la máquina. Con eso la fábrica arranca la producción. Tenés 24 horas para arrepentirte."], ["03", "Producción y control", "La fábrica produce; antes de embarcar te mandamos foto o video de tu máquina funcionando."], ["04", "Argencargo la importa", "Flete, seguro y aduana con el equipo de Argencargo. Te avisamos por mail en cada hito y lo seguís desde tu cuenta."], ["05", "Retirás o te la enviamos", "Cuando llega a Buenos Aires se abona la importación contra entrega. Retirás en nuestro depósito sin cargo o te la enviamos a cualquier punto del país (adicional)."]];
  return <div className="wrap" style={{ padding: "40px 24px 70px", maxWidth: 820 }}>
    <h1 className="h2" style={{ marginBottom: 8 }}>Cómo funciona</h1><p style={{ color: "var(--gris)", fontSize: 17, margin: "0 0 28px" }}>Una sola operación, de la fábrica a tu taller.</p>
    <div style={{ display: "grid", gap: 12 }}>{P.map(([n, tt, d]) => <div key={n} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 14, padding: "18px 20px", borderRadius: 20, border: "1px solid var(--borde)", background: "var(--card)" }}><span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: "var(--y)" }}>{n}</span><div><b style={{ fontSize: 17, display: "block", marginBottom: 4 }}>{tt}</b><p style={{ margin: 0, color: "var(--gris)", lineHeight: 1.5 }}>{d}</p></div></div>)}</div>
    <div style={{ marginTop: 26, padding: "20px 22px", borderRadius: 20, background: "var(--suave)" }}><b>Lo que no incluye</b><p style={{ margin: "6px 0 0", color: "var(--gris)", lineHeight: 1.5 }}>Envío a domicilio, instalación y puesta en marcha (podemos ayudarte con un técnico), obra civil y maniobras especiales de descarga. La garantía es la del fabricante; ante cualquier inconveniente ARGENMAQ está presente y cada caso se evalúa, con un tope máximo reembolsable. Los tiempos son estimados.</p></div>
    <div style={{ marginTop: 22 }}><a className="btn y" href="/catalogo">Ver el catálogo</a></div>
  </div>;
}
export function QuienesSomos({ ops }) {
  return <div className="wrap" style={{ padding: "40px 24px 70px", maxWidth: 820 }}>
    <h1 className="h2" style={{ marginBottom: 8 }}>Quiénes somos</h1>
    <p style={{ color: "var(--gris)", fontSize: 17, lineHeight: 1.55, margin: "0 0 18px" }}>ARGENMAQ es la unidad de maquinaria del grupo Argencargo. Nació de algo que veíamos todos los días: gente de oficio que quería traer una máquina de China y se quedaba en el camino entre proveedores, aduana y flete. Acá eso ya está resuelto: elegís, pagás y la máquina llega.</p>
    <p style={{ color: "var(--gris)", fontSize: 17, lineHeight: 1.55, margin: "0 0 26px" }}>La importación la hace Argencargo{ops ? `, que ya lleva más de ${Math.floor(ops / 10) * 10} operaciones` : ""}. Atendemos por WhatsApp y por llamada, y lo que le pasa a tu máquina lo seguís desde tu cuenta.</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>{[["Oficina", "La misma que Argencargo, en Buenos Aires."], ["Depósito", "Recibimos y entregamos en CABA; enviamos a todo el país."], ["Equipo", "Un responsable de ARGENMAQ te acompaña de punta a punta."]].map(([a, b]) => <div key={a} style={{ padding: "16px 18px", borderRadius: 18, border: "1px solid var(--borde)", background: "var(--card)" }}><b style={{ display: "block", marginBottom: 4 }}>{a}</b><span style={{ color: "var(--gris)", fontSize: 14.5 }}>{b}</span></div>)}</div>
    <div style={{ marginTop: 22, display: "flex", gap: 8 }}><a className="btn y" href="/catalogo">Ver el catálogo</a><a className="btn" href="https://www.argencargo.com.ar" target="_blank" rel="noopener noreferrer">Conocer Argencargo</a></div>
  </div>;
}
