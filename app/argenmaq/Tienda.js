"use client";
// Vistas del sitio público de ARGENMAQ: catálogo (carriles por rubro), ficha, cuenta, carrito,
// cómo funciona y quiénes somos. Sin cuenta no se ve ningún número.
import { useEffect, useMemo, useState } from "react";
import { useAM, Ico, MONO, WA, viaLabel, diasVia, primeraFoto } from "./kit";

const PR = ["Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"];
const COND = [["ninguna", "Consumidor final"], ["monotributista", "Monotributista"], ["responsable_inscripto", "Responsable inscripto"]];

// ── Tarjeta de máquina ────────────────────────────────────────────────────────────────────
export function Tarjeta({ m, precios, diasVia: dv }) {
  const { t, fmt, ses } = useAM();
  const foto = primeraFoto(m);
  const p = precios?.[m.id]?.precios;
  const vias = Array.isArray(m.vias) ? m.vias : [];
  const menor = p ? Math.min(...vias.map((v) => Number(p[v]?.total || Infinity)).filter(Number.isFinite)) : null;
  const viaMenor = p && menor != null ? vias.find((v) => Number(p[v]?.total) === menor) : null;
  return <a className="card" href={`/m/${m.id}`}>
    <div style={{ aspectRatio: "4/3", background: "var(--suave)", overflow: "hidden", position: "relative" }}>
      {foto ? <img src={foto} alt={m.nombre} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gris)", fontSize: 13 }}>Sin foto</div>}
      {m.condicion === "usada" && <span className="tag" style={{ position: "absolute", top: 10, left: 10 }}>{t("usada").toUpperCase()}</span>}
    </div>
    <div style={{ padding: "14px 16px 16px" }}>
      <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, lineHeight: 1.3, letterSpacing: "-0.01em", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", minHeight: 39 }}>{m.nombre}</p>
      {ses && p && menor != null && Number.isFinite(menor)
        ? <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{fmt(menor)} <span style={{ fontSize: 12, color: "var(--gris)", fontWeight: 600 }}>· {viaLabel(viaMenor, t).toLowerCase()}</span></p>
        : <p style={{ margin: 0, fontSize: 13, color: "var(--gris)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}><Ico d={["M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M5 10V8a7 7 0 0 1 14 0v2", "M4 10h16v11H4z"]} size={14} />{t("verPrecio")}</p>}
      {dv && vias.length > 0 && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--gris)", fontFamily: MONO }}>{t("tiempo")}: {Math.min(...vias.map((v) => diasVia(v, dv))) + Number(m.dias_produccion || 0)} {t("dias")}</p>}
    </div>
  </a>;
}

// Los precios se leen solo con sesión (vista cat_maquinas_precios, RLS: authenticated).
export function usePrecios(ids) {
  const { ses, dq } = useAM();
  const [precios, setPrecios] = useState(null);
  const clave = (ids || []).join(",");
  useEffect(() => { if (!ses?.token || !clave) { setPrecios(null); return; } (async () => { try { const r = await dq("cat_maquinas_precios", { filters: `?select=id,precios&id=in.(${clave})` }); const o = {}; (Array.isArray(r) ? r : []).forEach((x) => { o[x.id] = x; }); setPrecios(o); } catch { setPrecios(null); } })(); }, [ses?.token, clave]); // eslint-disable-line react-hooks/exhaustive-deps
  return precios;
}

// ── Catálogo: carriles por rubro, filtros por subcategoría, búsqueda ──────────────────────
export function CatalogoVista({ arbol, lista, diasVia: dv, rubro }) {
  const { t } = useAM();
  const [q, setQ] = useState("");
  const [sub, setSub] = useState("");
  const precios = usePrecios(lista.map((m) => m.id));
  const cat = rubro ? arbol.find((c) => c.slug === rubro) : null;
  const filtradas = lista.filter((m) => (!sub || m.subcategoria === sub) && (!q.trim() || `${m.nombre} ${m.descripcion || ""}`.toLowerCase().includes(q.toLowerCase())));
  const nombreSub = (slug) => { for (const c of arbol) { const s = c.subs.find((x) => x.slug === slug); if (s) return s.nombre; } return ""; };
  return <div className="wrap" style={{ padding: "26px 24px 70px" }}>
    <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
      <div>{cat && <a href="/catalogo" style={{ fontSize: 13, color: "var(--gris)", fontWeight: 700 }}>← {t("catalogo")}</a>}<h1 className="h2" style={{ marginTop: cat ? 6 : 0 }}>{cat ? cat.nombre : t("catalogo")}</h1></div>
      <input className="inp" placeholder={t("buscar")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320, borderRadius: 999 }} />
    </div>
    {!cat && !q.trim() && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>{arbol.map((c) => <a key={c.slug} className="chip" href={`/catalogo/${c.slug}`}>{c.nombre} <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--gris)" }}>{lista.filter((m) => m.categoria === c.slug).length || ""}</span></a>)}</div>}
    {cat && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}><button className={`chip${!sub ? " on" : ""}`} onClick={() => setSub("")}>{t("verTodo")}</button>{cat.subs.map((s) => <button key={s.slug} className={`chip${sub === s.slug ? " on" : ""}`} onClick={() => setSub(sub === s.slug ? "" : s.slug)}>{s.nombre}</button>)}</div>}
    {(cat || q.trim())
      ? (filtradas.length === 0 ? <p style={{ color: "var(--gris)" }}>{t("sinMaquinas")}</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>{filtradas.map((m) => <Tarjeta key={m.id} m={m} precios={precios} diasVia={dv} />)}</div>)
      : arbol.map((c) => { const del = lista.filter((m) => m.categoria === c.slug); if (!del.length) return null; return <section key={c.slug} style={{ marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}><h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{c.nombre}</h2><span style={{ fontFamily: MONO, fontSize: 11, color: "var(--gris)" }}>{del.length}</span><span style={{ flex: 1 }} /><a href={`/catalogo/${c.slug}`} style={{ fontSize: 13.5, fontWeight: 700 }}>{t("verTodo")} →</a></div>
        <div className="carril">{del.slice(0, 10).map((m) => <Tarjeta key={m.id} m={m} precios={precios} diasVia={dv} />)}</div>
      </section>; })}
    <div style={{ marginTop: 30, padding: "22px 24px", borderRadius: 20, background: "var(--suave)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}><div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t("noEsta")}</p><p style={{ margin: "2px 0 0", color: "var(--gris)", fontSize: 14 }}>{t("noEstaSub")}</p></div><a className="btn y" href={WA("Hola ARGENMAQ, busco una máquina que no está en el catálogo: ")} target="_blank" rel="noreferrer">{t("consultar")}</a></div>
    {lista.length > 0 && !cat && <p style={{ margin: "18px 0 0", fontSize: 12.5, color: "var(--gris)" }}>{t("precioPuesto")}. {t("envioAdicional")}.</p>}
  </div>;
}

// ── Ficha ─────────────────────────────────────────────────────────────────────────────────
export function FichaVista({ m, cats, diasVia: dv, relacionadas }) {
  const { t, fmt, ses, carrito, setCarrito, lang } = useAM();
  const precios = usePrecios(m ? [m.id] : []);
  const [foto, setFoto] = useState(0);
  const [via, setVia] = useState(null);
  const [qty, setQty] = useState(1);
  if (!m) return <div className="wrap" style={{ padding: "60px 24px" }}><h1 className="h2">Esta máquina ya no está publicada.</h1><a className="btn y" href="/catalogo" style={{ marginTop: 18 }}>{t("catalogo")}</a></div>;
  const fotos = Array.isArray(m.fotos) ? m.fotos : [];
  const vias = Array.isArray(m.vias) ? m.vias : [];
  const p = precios?.[m.id]?.precios || null;
  const viaSel = via || vias[0] || null;
  const enCarrito = carrito.some((i) => i.id === m.id);
  const nombreCat = (slug) => cats.find((c) => c.slug === slug)?.nombre || "";
  const agregar = () => { if (!viaSel) return; setCarrito((c) => enCarrito ? c : [...c, { id: m.id, nombre: m.nombre, foto: fotos[0] || null, qty: Math.max(1, qty), via: viaSel }]); };
  return <div className="wrap" style={{ padding: "26px 24px 70px" }}>
    <p style={{ fontSize: 13, color: "var(--gris)", fontWeight: 700, margin: "0 0 14px" }}><a href="/catalogo">{t("catalogo")}</a> › <a href={`/catalogo/${m.categoria}`}>{nombreCat(m.categoria)}</a> › {nombreCat(m.subcategoria)}</p>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 28 }} className="fichaGrid">
      <style dangerouslySetInnerHTML={{ __html: "@media(max-width:820px){.amq .fichaGrid{grid-template-columns:1fr!important}}" }} />
      <div>
        <div style={{ aspectRatio: "4/3", borderRadius: 20, overflow: "hidden", background: "var(--suave)" }}>{fotos[foto] ? <img src={fotos[foto]} alt={m.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}</div>
        {fotos.length > 1 && <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto" }}>{fotos.map((f, i) => <button key={f} onClick={() => setFoto(i)} style={{ flex: "0 0 72px", height: 56, borderRadius: 10, overflow: "hidden", border: `2px solid ${i === foto ? "var(--y)" : "transparent"}`, padding: 0, background: "var(--suave)", cursor: "pointer" }}><img src={f} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></button>)}</div>}
        {m.video_url && <video src={m.video_url} controls style={{ width: "100%", borderRadius: 16, marginTop: 14, background: "#000" }} />}
      </div>
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}><span className="tag">{(m.condicion === "usada" ? t("usada") : t("nueva")).toUpperCase()}</span><span className="tag" style={{ background: "var(--suave)", color: "var(--gris)" }}>MAQ-{String(m.numero || 0).padStart(5, "0")}</span></div>
        <h1 style={{ fontSize: "clamp(24px,3vw,34px)", letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 16px" }}>{m.nombre}</h1>
        <div style={{ border: "1px solid var(--borde)", borderRadius: 20, padding: "18px 20px", background: "var(--card)" }}>
          {!ses && <>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Ico d={["M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M5 10V8a7 7 0 0 1 14 0v2", "M4 10h16v11H4z"]} size={16} />{t("verPrecio")}</p>
            <p style={{ margin: "6px 0 14px", fontSize: 13.5, color: "var(--gris)" }}>{t("precioPuesto")}. {t("envioAdicional")}.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="btn y" href={`/cuenta?volver=/m/${m.id}`}>{t("ingresar")}</a><a className="btn" href={`/cuenta?registro=1&volver=/m/${m.id}`}>{t("crear")}</a></div>
          </>}
          {ses && <>
            <p className="lbl">{t("precioPuesto")}</p>
            {vias.length === 0 && <p style={{ margin: 0, color: "var(--gris)" }}>Precio a confirmar. Consultanos.</p>}
            <div style={{ display: "grid", gap: 8 }}>{vias.map((v) => { const tot = p?.[v]?.total; const dias = diasVia(v, dv) + Number(m.dias_produccion || 0); return <button key={v} onClick={() => setVia(v)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, cursor: "pointer", border: `1.5px solid ${viaSel === v ? "var(--y)" : "var(--borde)"}`, background: viaSel === v ? "var(--ysuave)" : "transparent", color: "var(--ink)", display: "flex", alignItems: "center", gap: 12 }}><span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>{viaLabel(v, t)}</span><span style={{ display: "block", fontSize: 12, color: "var(--gris)", fontFamily: MONO }}>{t("tiempo")} {dias} {t("dias")} ({m.dias_produccion || 0} {t("produccion")} + {diasVia(v, dv)})</span></span><b style={{ fontSize: 20, letterSpacing: "-0.02em" }}>{tot != null ? fmt(tot) : "—"}</b></button>; })}</div>
            <p style={{ margin: "10px 0 14px", fontSize: 12.5, color: "var(--gris)" }}>{t("envioAdicional")}. {lang === "es" ? "Tiempos estimados, no comprometidos." : lang === "en" ? "Estimated times, not guaranteed." : "Сроки ориентировочные."}</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input className="inp" type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} style={{ width: 84, textAlign: "center" }} />
              {enCarrito ? <a className="btn k" href="/carrito">{t("agregado")} · {t("verCarrito")}</a> : <button className="btn y" onClick={agregar} disabled={!viaSel}>{t("agregar")}</button>}
              <a className="btn" href={WA(`Hola ARGENMAQ, consulto por ${m.nombre} (MAQ-${String(m.numero || 0).padStart(5, "0")})`)} target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </>}
        </div>
        {m.garantia_meses > 0 && <p style={{ margin: "14px 0 0", fontSize: 13.5, color: "var(--gris)" }}>✓ {t("garantia")}: {m.garantia_meses} {t("meses")}</p>}
      </div>
    </div>
    <section style={{ marginTop: 34, maxWidth: 780 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 10px" }}>{lang === "en" ? "About this machine" : lang === "ru" ? "О машине" : "Sobre esta máquina"}</h2>
      {(m.descripcion || "").split(/\n{2,}/).map((par, i) => <p key={i} style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--gris)", margin: "0 0 12px" }}>{par}</p>)}
    </section>
    {relacionadas?.length > 0 && <section style={{ marginTop: 34 }}><h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 12px" }}>{nombreCat(m.categoria)}</h2><div className="carril">{relacionadas.map((r) => <Tarjeta key={r.id} m={r} diasVia={dv} />)}</div></section>}
  </div>;
}

// ── Carrito ───────────────────────────────────────────────────────────────────────────────
export function CarritoVista({ diasVia: dv }) {
  const { t, fmt, ses, carrito, setCarrito, cliente } = useAM();
  const precios = usePrecios(carrito.map((i) => i.id));
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(null);
  const total = carrito.reduce((s, i) => s + Number(precios?.[i.id]?.precios?.[i.via]?.total || 0) * (i.qty || 1), 0);
  const confirmar = async () => { setEnviando(true); try { const r = await fetch("/api/argenmaq/pedido", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ses.token}` }, body: JSON.stringify({ items: carrito.map((i) => ({ id: i.id, qty: i.qty || 1, via: i.via })), notas }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "No se pudo confirmar"); setHecho(d); setCarrito([]); } catch (e) { alert(e.message); } setEnviando(false); };
  if (hecho) return <div className="wrap" style={{ padding: "60px 24px", textAlign: "center", maxWidth: 640 }}><span className="tag">{hecho.codigo}</span><h1 className="h2" style={{ margin: "14px 0 10px" }}>¡Pedido recibido!</h1><p style={{ color: "var(--gris)", fontSize: 16, lineHeight: 1.5 }}>Te contactamos por WhatsApp para coordinar el anticipo de la máquina ({fmt(hecho.precio_total)}). La importación se abona contra entrega.</p><div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18 }}><a className="btn y" href="/cuenta">{t("misOps")}</a><a className="btn" href="/catalogo">{t("catalogo")}</a></div></div>;
  return <div className="wrap" style={{ padding: "26px 24px 70px", maxWidth: 900 }}>
    <h1 className="h2" style={{ marginBottom: 18 }}>{t("carrito")}</h1>
    {carrito.length === 0 ? <p style={{ color: "var(--gris)" }}>{t("vacio")} <a href="/catalogo" style={{ fontWeight: 800 }}>{t("catalogo")} →</a></p> : <>
      <div style={{ display: "grid", gap: 10 }}>{carrito.map((i) => { const tot = precios?.[i.id]?.precios?.[i.via]?.total; return <div key={i.id} style={{ display: "flex", gap: 14, alignItems: "center", padding: 12, borderRadius: 16, border: "1px solid var(--borde)", background: "var(--card)", flexWrap: "wrap" }}>
        <a href={`/m/${i.id}`} style={{ width: 84, height: 64, borderRadius: 10, overflow: "hidden", background: "var(--suave)", flexShrink: 0 }}>{i.foto && <img src={i.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</a>
        <div style={{ flex: 1, minWidth: 180 }}><a href={`/m/${i.id}`} style={{ fontWeight: 800, fontSize: 15 }}>{i.nombre}</a><p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--gris)" }}>{viaLabel(i.via, t)}</p></div>
        <input className="inp" type="number" min="1" value={i.qty || 1} onChange={(e) => setCarrito((c) => c.map((x) => x.id === i.id ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))} style={{ width: 74, textAlign: "center" }} />
        <b style={{ fontSize: 17, minWidth: 110, textAlign: "right" }}>{ses ? fmt(Number(tot || 0) * (i.qty || 1)) : "—"}</b>
        <button className="chip" onClick={() => setCarrito((c) => c.filter((x) => x.id !== i.id))}>✕</button>
      </div>; })}</div>
      <div style={{ marginTop: 18, padding: "18px 20px", borderRadius: 20, background: "var(--suave)" }}>
        {!ses ? <><p style={{ margin: "0 0 10px", fontWeight: 800 }}>{t("verPrecio")}</p><div style={{ display: "flex", gap: 8 }}><a className="btn y" href="/cuenta?volver=/carrito">{t("ingresar")}</a><a className="btn" href="/cuenta?registro=1&volver=/carrito">{t("crear")}</a></div></>
          : <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}><span style={{ fontWeight: 800, fontSize: 16 }}>{t("total")}</span><b style={{ fontSize: 26, letterSpacing: "-0.02em" }}>{fmt(total)}</b></div>
            <p style={{ margin: "6px 0 14px", fontSize: 12.5, color: "var(--gris)" }}>{t("precioPuesto")}. {t("envioAdicional")}. El anticipo es el precio de la máquina; la importación se abona contra entrega.</p>
            <textarea className="inp" placeholder="Notas para el equipo (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} style={{ minHeight: 70, resize: "vertical", marginBottom: 12 }} />
            <button className="btn y" onClick={confirmar} disabled={enviando || !cliente}>{enviando ? "Enviando…" : t("pedir")}</button>
            {!cliente && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--gris)" }}>Completá tus datos en <a href="/cuenta" style={{ fontWeight: 800 }}>Mi cuenta</a> para poder pedir.</p>}
          </>}
      </div>
    </>}
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
  const [f, setF] = useState({ first_name: "", last_name: "", whatsapp: "", email: "", password: "", street: "", floor_apt: "", postal_code: "", city: "", province: "", tax_condition: "ninguna", company_name: "", cuit: "", dni: "" });
  const [err, setErr] = useState(""); const [lo, setLo] = useState(false); const [ok, setOk] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const I = ({ k, l, type = "text", req = true, span }) => <label className="lbl" style={{ gridColumn: span ? "span 2" : undefined }}>{l}<input className="inp" type={type} value={f[k]} onChange={(e) => set(k, e.target.value)} required={req} style={{ marginTop: 6 }} /></label>;
  const gc = (fn, ln) => (fn.substring(0, 3) + ln.substring(0, 3)).toUpperCase();
  const registrar = async (e) => { e.preventDefault(); setErr(""); if (f.password.length < 6) { setErr("La contraseña tiene que tener al menos 6 caracteres"); return; } if (f.whatsapp.replace(/\D/g, "").length < 10) { setErr("WhatsApp inválido (mínimo 10 dígitos)"); return; } if (["responsable_inscripto", "monotributista"].includes(f.tax_condition) && f.cuit.replace(/\D/g, "").length !== 11) { setErr("CUIT inválido (11 dígitos)"); return; } if (f.tax_condition === "ninguna" && f.dni.replace(/\D/g, "").length < 7) { setErr("DNI inválido"); return; } setLo(true); try {
    const data = { role: "cliente", first_name: f.first_name.trim(), last_name: f.last_name.trim(), whatsapp: f.whatsapp.trim(), dni: f.dni.trim() || null, tax_condition: f.tax_condition, company_name: f.company_name.trim(), cuit: f.cuit.trim(), street: f.street.trim(), floor_apt: f.floor_apt.trim(), postal_code: f.postal_code.trim(), city: f.city.trim(), province: f.province, origen: "argenmaq" };
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
    <I k="first_name" l="Nombre" /><I k="last_name" l="Apellido" />
    <I k="email" l={t("email")} type="email" /><I k="whatsapp" l="WhatsApp" />
    <I k="password" l={t("pass")} type="password" span />
    <I k="street" l="Calle y número" /><I k="floor_apt" l="Piso / depto" req={false} />
    <I k="city" l="Localidad" /><label className="lbl">Provincia<select className="inp" value={f.province} onChange={(e) => set("province", e.target.value)} required style={{ marginTop: 6 }}><option value="">Elegir…</option>{PR.map((p) => <option key={p}>{p}</option>)}</select></label>
    <I k="postal_code" l="Código postal" />
    <label className="lbl">Condición fiscal<select className="inp" value={f.tax_condition} onChange={(e) => set("tax_condition", e.target.value)} style={{ marginTop: 6 }}>{COND.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    {f.tax_condition === "responsable_inscripto" && <I k="company_name" l="Razón social" />}
    {["responsable_inscripto", "monotributista"].includes(f.tax_condition) ? <I k="cuit" l="CUIT" /> : <I k="dni" l="DNI" />}
    {err && <p style={{ color: "#D23B3B", fontSize: 13.5, margin: 0, gridColumn: "span 2" }}>{err}</p>}
    <button className="btn y" disabled={lo} style={{ gridColumn: "span 2" }}>{lo ? "…" : t("registrarse")}</button>
    <p style={{ margin: 0, fontSize: 12, color: "var(--gris)", gridColumn: "span 2" }}>Al crear la cuenta aceptás los <a href="/terminos" style={{ fontWeight: 700 }}>términos y condiciones</a>.</p>
  </form>;
}
const EST = { nuevo: "Nueva", pagado: "Pagada", en_produccion: "En producción", listo_fabrica: "Lista en fábrica", en_importacion: "En importación", entregado: "Entregada", cancelado: "Cancelada" };
function Panel({ cliente, dq, salir, t, fmt, ses }) {
  const [ops, setOps] = useState(null); const [seg, setSeg] = useState({});
  useEffect(() => { (async () => { try { const r = await dq("cat_pedidos", { filters: "?select=id,numero,estado,items,precio_total,importacion_usd,created_at,operation_id&order=created_at.desc" }); setOps(Array.isArray(r) ? r : []); } catch { setOps([]); } })(); }, [ses?.token]); // eslint-disable-line react-hooks/exhaustive-deps
  const verSeg = async (id) => { try { const r = await dq("rpc/argenmaq_seguimiento", { method: "POST", body: { p_pedido: id }, prefer: "return=representation" }); setSeg((s) => ({ ...s, [id]: Array.isArray(r) && r[0] ? r[0] : { vacio: true } })); } catch { setSeg((s) => ({ ...s, [id]: { vacio: true } })); } };
  return <div className="wrap" style={{ padding: "26px 24px 70px", maxWidth: 900 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}><h1 className="h2" style={{ fontSize: 30, flex: 1 }}>{cliente ? `Hola, ${cliente.first_name || cliente.company_name || ""}` : t("cuenta")}</h1><button className="btn s" onClick={salir}>{t("salir")}</button></div>
    {cliente && <div style={{ padding: "14px 18px", borderRadius: 16, background: "var(--suave)", marginBottom: 20, fontSize: 14, display: "flex", gap: 16, flexWrap: "wrap" }}><span><b>{cliente.first_name} {cliente.last_name}</b></span><span style={{ fontFamily: MONO, fontSize: 12, color: "var(--gris)" }}>{cliente.client_code}</span><span style={{ color: "var(--gris)" }}>{cliente.email}</span><span style={{ color: "var(--gris)" }}>{cliente.whatsapp}</span></div>}
    <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 12px" }}>{t("misOps")}</h2>
    {ops === null ? <p style={{ color: "var(--gris)" }}>…</p> : ops.length === 0 ? <p style={{ color: "var(--gris)" }}>Todavía no tenés operaciones. <a href="/catalogo" style={{ fontWeight: 800 }}>{t("catalogo")} →</a></p>
      : <div style={{ display: "grid", gap: 10 }}>{ops.map((o) => <div key={o.id} style={{ padding: "16px 18px", borderRadius: 18, border: "1px solid var(--borde)", background: "var(--card)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><span className="tag">AM-{String(o.numero || 0).padStart(5, "0")}</span><b style={{ flex: 1 }}>{(o.items || []).map((i) => `${i.qty > 1 ? `${i.qty}× ` : ""}${i.nombre}`).join(" · ")}</b><span className="chip" style={{ cursor: "default" }}>{EST[o.estado] || o.estado}</span></div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 13.5, color: "var(--gris)" }}><span>Máquina: <b style={{ color: "var(--ink)" }}>{fmt(o.precio_total)}</b></span>{o.importacion_usd != null && <span>Importación (contra entrega): <b style={{ color: "var(--ink)" }}>{fmt(o.importacion_usd)}</b></span>}<span>{new Date(o.created_at).toLocaleDateString("es-AR")}</span></div>
        {o.operation_id && <div style={{ marginTop: 10 }}>{seg[o.id] ? (seg[o.id].vacio ? <span style={{ fontSize: 13, color: "var(--gris)" }}>Seguimiento no disponible todavía.</span> : <div style={{ fontSize: 13.5, display: "flex", gap: 14, flexWrap: "wrap" }}><span>Operación <b>{seg[o.id].operation_code}</b></span><span>Estado: <b>{seg[o.id].status}</b></span>{seg[o.id].eta && <span>ETA <b>{new Date(seg[o.id].eta + "T12:00:00").toLocaleDateString("es-AR")}</b></span>}</div>) : <button className="chip" onClick={() => verSeg(o.id)}>{t("seguimiento")} →</button>}</div>}
      </div>)}</div>}
  </div>;
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
    <div style={{ marginTop: 22, display: "flex", gap: 8 }}><a className="btn y" href="/catalogo">Ver el catálogo</a><a className="btn" href="https://www.argencargo.com.ar">Conocer Argencargo</a></div>
  </div>;
}
