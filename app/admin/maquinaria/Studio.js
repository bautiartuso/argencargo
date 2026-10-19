"use client";
// Marketing › Content Studio de ARGENMAQ.
// Cada día arma historias (con precio, duran 24 h) y publicaciones/carruseles (sin precio, quedan en el perfil)
// a partir de datos reales. Se aprueban, se programan en el calendario y las publica el cron en el Instagram
// de ARGENMAQ; o se mandan al celular por Telegram para subirlas a mano con el sticker de link.
import { useState, useEffect, useMemo } from "react";
import { INK, GRIS, BORDE, SUAVE, CARD, LIMA, LIMA_SUAVE, OK, OK_BG, WARN, WARN_BG, BAD, BAD_BG, MONO, Campo, Inp, TA, Btn, Sec, Pill, Chip, Ico, Barra, Vacio, Dato, Solapas, toast, confirmDialog, MESES, MESES_C } from "./ui";

const codificar = (obj) => { const s = unescape(encodeURIComponent(JSON.stringify(obj))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const urlImagen = (slide) => `/api/argenmaq/studio/imagen?d=${codificar(slide)}`;
const PLANT = { maquina_dia: "Máquina del día", nueva: "Nueva en el catálogo", cual_elegis: "¿Cuál elegís?", cuanto_sale: "¿Cuánto sale?", en_viaje: "Salió de China", llego: "Llegó", pedidos: "Nos pidieron", sabias: "Así trabajamos", kit: "Kit por rubro", dolar: "Dónde va cada dólar", opinion: "Opinión", raro: "Pedido de la semana", ficha: "Ficha", carrusel_ficha: "Carrusel de ficha", rubro: "Por rubro", carrusel_rubro: "Carrusel por rubro", reel: "Guion de reel" };
const TIPO = { historia: { l: "Historia", letra: "H", c: "#15171A", bg: LIMA }, post: { l: "Publicación", letra: "P", c: INK, bg: SUAVE }, carrusel: { l: "Carrusel", letra: "C", c: INK, bg: SUAVE }, guion: { l: "Reel", letra: "R", c: "#fff", bg: "#7C3AED" } };
const ESTADO = { aprobada: { l: "Lista", c: INK, bg: SUAVE }, programada: { l: "Programada", c: "#15171A", bg: LIMA }, publicada: { l: "Publicada", c: OK, bg: OK_BG }, descartada: { l: "Descartada", c: GRIS, bg: SUAVE }, error: { l: "Error", c: BAD, bg: BAD_BG } };
const alto = (tipo) => tipo === "historia" ? 1920 : 1350;
const fmtHora = (d) => d ? new Date(d).toLocaleString("es-AR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const soloHora = (d) => new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const claveDia = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
// Horarios sugeridos: historias al mediodía y a la tarde-noche, publicaciones a la tardecita. El primero libre.
const HORAS = { historia: [12, 19.5], post: [18.5], carrusel: [18.5], guion: [10] };
function proximoHueco(tipo, piezas) {
  const ocupados = new Set(piezas.filter((p) => p.estado === "programada").map((p) => `${claveDia(p.programada_at)} ${soloHora(p.programada_at)}`));
  const base = new Date(); base.setSeconds(0, 0);
  for (let d = 0; d < 14; d++) for (const h of HORAS[tipo] || HORAS.post) {
    const x = new Date(base); x.setDate(x.getDate() + d); x.setHours(Math.floor(h), (h % 1) * 60, 0, 0);
    if (x.getTime() < Date.now() + 10 * 60000) continue;
    if (!ocupados.has(`${claveDia(x)} ${soloHora(x)}`)) return x;
  }
  return new Date(Date.now() + 3600e3);
}

export function Studio({ token }) {
  const [tab, setTab] = useState("calendario");
  const [hist, setHist] = useState([]); const [pubs, setPubs] = useState([]); const [guis, setGuis] = useState([]); const [piezas, setPiezas] = useState([]); const [ig, setIg] = useState(null);
  const [cargando, setCargando] = useState(true); const [armando, setArmando] = useState(""); const [ocupado, setOcupado] = useState("");
  const [detalle, setDetalle] = useState(null); // pieza abierta en el panel lateral
  const api = async (method, body, query = "") => { const r = await fetch(`/api/argenmaq/studio${query}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `Error ${r.status}`); return d; };
  const marcar = (l, tipo) => l.map((c, i) => ({ ...c, _k: `${tipo}${i}-${Date.now()}` }));
  const cargar = async () => {
    setCargando(true);
    try { const [e, p] = await Promise.all([api("GET", null, "?accion=estado"), api("GET", null, "?accion=piezas")]); setIg(e.ig || null); setPiezas(p.piezas || []); }
    catch (e) { toast(e.message, "error"); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // El runner: arma N historias o N publicaciones, evitando las máquinas que ya están propuestas en pantalla.
  const crear = async (tipo, n) => {
    setArmando(tipo);
    try {
      const excluir = [...hist, ...pubs, ...guis].map((c) => c.maquina_id).filter(Boolean).join(",");
      const d = await api("GET", null, `?accion=candidatos&${tipo === "historia" ? "h" : tipo === "guion" ? "g" : "p"}=${n}&excluir=${excluir}`);
      const nuevas = marcar(tipo === "historia" ? d.historias || [] : tipo === "guion" ? d.guiones || [] : d.publicaciones || [], tipo[0]);
      if (!nuevas.length) toast("No quedan datos para armar más piezas distintas hoy.", "warn");
      (tipo === "historia" ? setHist : tipo === "guion" ? setGuis : setPubs)((l) => [...nuevas, ...l]);
    } catch (e) { toast(e.message, "error"); }
    setArmando("");
  };
  const setDe = (tipo) => tipo === "historia" ? setHist : tipo === "guion" ? setGuis : setPubs;
  const quitar = (c) => setDe(c.tipo)((l) => l.filter((x) => x._k !== c._k));

  const reemplazar = (p) => { setPiezas((l) => l.some((x) => x.id === p.id) ? l.map((x) => x.id === p.id ? p : x) : [p, ...l]); setDetalle((d) => d && d.id === p.id ? p : d); };
  const guardar = async (c, programada_at = null) => {
    setOcupado(`g${c._k}`);
    try {
      const d = await api("POST", { accion: "guardar", pieza: c, programada_at });
      reemplazar(d.pieza);
      setDe(c.tipo)((l) => l.filter((x) => x._k !== c._k));
      toast(programada_at ? (c.tipo === "guion" ? `Agendado: te llega por Telegram el ${fmtHora(programada_at)}` : `Programada para el ${fmtHora(programada_at)}`) : "Guardada en la cola. Programala cuando quieras.");
    } catch (e) { toast(e.message, "error"); }
    setOcupado("");
  };
  const accion = async (nombre, p, extra = {}, msg) => {
    setOcupado(`${nombre}${p.id}`);
    try { const d = await api("POST", { accion: nombre, id: p.id, ...extra }); if (d.pieza) reemplazar(d.pieza); if (msg) toast(msg); return d; }
    catch (e) { toast(e.message, "error"); }
    finally { setOcupado(""); }
  };
  const publicar = async (p) => { if (!(await confirmDialog(`¿Publicar ahora “${p.titulo}” en @${ig?.username || "argenmaq_"}?`, { ok: "Publicar" }))) return; await accion("publicar", p, {}, "Publicada en Instagram"); };
  const programar = (p, cuando) => accion("programar", p, { programada_at: new Date(cuando).toISOString() }, `Programada para el ${fmtHora(cuando)}`);
  const desprogramar = (p) => accion("desprogramar", p, {}, "Vuelve a la cola");
  const descartar = async (p) => { if (!(await confirmDialog(`¿Descartar “${p.titulo}”?`, { ok: "Descartar" }))) return; accion("descartar", p); };
  const celular = (p) => accion("celular", p, {}, "Te la mandé por Telegram con el link");
  const guardarTexto = (p, caption, hashtags) => accion("texto", p, { caption, hashtags }, "Texto guardado");
  const copiar = async (texto, msg = "Copiado") => { try { await navigator.clipboard.writeText(texto); toast(msg); } catch { toast("No se pudo copiar", "error"); } };

  const activas = piezas.filter((p) => p.estado !== "descartada");
  const programadas = activas.filter((p) => p.estado === "programada");
  const listas = activas.filter((p) => p.estado === "aprobada");
  const hace30 = Date.now() - 30 * 864e5;
  const publicadas30 = activas.filter((p) => p.estado === "publicada" && new Date(p.publicada_at || p.created_at).getTime() > hace30);
  const errores = activas.filter((p) => p.estado === "error");
  const ctx = { ig, ocupado, piezas, publicar, programar, desprogramar, descartar, celular, guardarTexto, copiar, abrir: setDetalle };

  return <>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 18 }}>
      <Dato l="Programadas" v={programadas.length} sub={programadas[0] ? `próxima ${fmtHora(programadas.sort((a, b) => a.programada_at.localeCompare(b.programada_at))[0].programada_at)}` : "nada en agenda"} acento />
      <Dato l="En la cola sin fecha" v={listas.length} sub={hist.length + pubs.length ? `${hist.length} historias y ${pubs.length} publicaciones propuestas, sin guardar` : "armá propuestas desde Historias o Publicaciones"} />
      <Dato l="Publicadas · 30 días" v={publicadas30.length} sub={`${publicadas30.filter((p) => p.tipo === "historia").length} historias · ${publicadas30.filter((p) => p.tipo !== "historia").length} en el perfil`} />
      <Dato l="Instagram" v={ig ? `@${ig.username || "argenmaq_"}` : "Sin conectar"} sub={ig ? (errores.length ? `${errores.length} con error` : "publicación automática activa") : "las piezas se descargan y suben a mano"} color={ig ? OK : WARN} />
    </div>
    <Solapas val={tab} onChange={setTab} items={[["calendario", "Calendario"], ["historias", "Historias", hist.length], ["publicaciones", "Publicaciones y carruseles", pubs.length], ["guiones", "Guiones de reels", guis.length], ["cola", "Cola", activas.filter((p) => p.estado !== "publicada").length], ["ig", ig ? `Instagram · @${ig.username || "argenmaq_"}` : "Instagram · sin conectar"]]} />

    {tab === "calendario" && <Calendario piezas={activas} listas={listas} {...ctx} />}
    {tab === "historias" && <Propuestas lista={hist} tipo="historia" piezas={piezas} ocupado={ocupado} creando={armando === "historia"} onCrear={(n) => crear("historia", n)} onQuitar={quitar} onGuardar={guardar} onCambiar={(k, patch) => setHist((l) => l.map((x) => x._k === k ? { ...x, ...patch } : x))} titulo="historias" sub="Duran 24 horas: llevan precio final y dos cuotas, nunca fecha de llegada. Cada historia con máquina lleva el link de la ficha para el sticker. Se alternan los formatos: máquina del día, ¿cuál elegís?, nueva en el catálogo, ¿cuánto sale?, un dato de cómo trabajamos, pedidos reales." />}
    {tab === "publicaciones" && <Propuestas lista={pubs} tipo="post" piezas={piezas} ocupado={ocupado} creando={armando === "post"} onCrear={(n) => crear("post", n)} onQuitar={quitar} onGuardar={guardar} onCambiar={(k, patch) => setPubs((l) => l.map((x) => x._k === k ? { ...x, ...patch } : x))} titulo="publicaciones y carruseles" sub="Quedan en el perfil: sin precio, invitan a consultar. Se alternan ficha, carrusel de ficha (3 placas), 3 máquinas por rubro y carrusel por rubro (una placa por máquina)." />}
    {tab === "guiones" && <Propuestas lista={guis} tipo="guion" piezas={piezas} ocupado={ocupado} creando={armando === "guion"} onCrear={(n) => crear("guion", n)} onQuitar={quitar} onGuardar={guardar} onCambiar={(k, patch) => setGuis((l) => l.map((x) => x._k === k ? { ...x, ...patch } : x))} titulo="guiones de reels" sub="El plan para filmar con el celular: gancho, escenas con lo que se ve y lo que se dice, textos en pantalla y caption. Salen de una máquina real, de un pedido real o de cómo trabajamos. Si lo agendás, ese día te llega por Telegram." />}
    {tab === "cola" && <Cola piezas={piezas} {...ctx} />}
    {tab === "ig" && <Instagram ig={ig} api={api} onCambio={(v) => setIg(v)} />}

    {detalle && <Detalle p={detalle} onCerrar={() => setDetalle(null)} {...ctx} />}
  </>;
}

// ── Propuestas del día (historias o publicaciones) ───────────────────────────
function Propuestas({ lista, tipo, piezas, ocupado, creando, onCrear, onQuitar, onGuardar, onCambiar, titulo, sub }) {
  const [n, setN] = useState(tipo === "historia" ? 3 : tipo === "guion" ? 3 : 2); const max = tipo === "historia" ? 10 : 6;
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: CARD, border: `1px solid ${BORDE}`, borderRadius: 16, marginBottom: 14, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 240 }}><b style={{ fontSize: 14 }}>Armar {titulo}</b><p style={{ margin: "4px 0 0", fontSize: 12.5, color: GRIS, lineHeight: 1.45 }}>{sub}</p></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Btn small onClick={() => setN((x) => Math.max(1, x - 1))} disabled={creando}>−</Btn>
        <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, minWidth: 34, textAlign: "center" }}>{n}</span>
        <Btn small onClick={() => setN((x) => Math.min(max, x + 1))} disabled={creando}>+</Btn>
        <Btn kind="lima" onClick={() => onCrear(n)} disabled={creando} style={{ marginLeft: 6 }}>{creando ? "Armando…" : `Crear ${n}`}</Btn>
      </div>
    </div>
    {creando && <p style={{ margin: "0 0 14px", fontSize: 13, color: GRIS }}>{tipo === "guion" ? "Escribiendo los guiones a partir de datos reales. Tarda unos 20 segundos." : "Eligiendo máquinas, dibujando las placas y redactando los textos. Tarda unos segundos."}</p>}
    {!lista.length && !creando ? <Vacio>Todavía no armaste {titulo}. Elegí cuántas querés y tocá “Crear”.</Vacio>
      : <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${tipo === "guion" ? 380 : 300}px,1fr))`, gap: 14 }}>
        {lista.map((c) => c.tipo === "guion"
          ? <PropuestaGuion key={c._k} c={c} ocupado={ocupado === `g${c._k}`} sugerido={proximoHueco("guion", piezas)} piezas={piezas} onGuardar={onGuardar} onQuitar={() => onQuitar(c)} onCambiar={(patch) => onCambiar(c._k, patch)} />
          : <Propuesta key={c._k} c={c} ocupado={ocupado === `g${c._k}`} sugerido={proximoHueco(c.tipo, piezas)} piezas={piezas} onGuardar={onGuardar} onQuitar={() => onQuitar(c)} onCambiar={(patch) => onCambiar(c._k, patch)} />)}
      </div>}
  </>;
}
function Propuesta({ c, ocupado, sugerido, piezas, onGuardar, onQuitar, onCambiar }) {
  const slides = c.datos?.slides || []; const [i, setI] = useState(0); const [prog, setProg] = useState(false);
  const t = TIPO[c.tipo] || TIPO.post;
  return <div style={{ background: CARD, border: `1px solid ${BORDE}`, borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
    <Previa slides={slides} tipo={c.tipo} i={i} setI={setI} etiquetas={<><Chip l={PLANT[c.plantilla] || c.plantilla} c="#15171A" bg={LIMA} /><Chip l={t.l} c={INK} bg="rgba(255,255,255,0.9)" /></>} />
    <div style={{ padding: "12px 14px 14px", display: "grid", gap: 8 }}>
      <b style={{ fontSize: 14, lineHeight: 1.3 }}>{c.titulo}</b>
      <TA value={c.caption || ""} onChange={(e) => onCambiar({ caption: e.target.value })} style={{ minHeight: 92, fontSize: 13 }} />
      <Inp value={c.hashtags || ""} onChange={(e) => onCambiar({ hashtags: e.target.value })} style={{ fontSize: 12, fontFamily: MONO }} />
      {prog ? <SelectorFecha tipo={c.tipo} piezas={piezas} inicial={sugerido} ocupado={ocupado} onConfirmar={(d) => onGuardar(c, d.toISOString())} onCancelar={() => setProg(false)} />
        : <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <Btn kind="lima" onClick={() => setProg(true)} disabled={ocupado} style={{ flex: 1 }}>{ocupado ? "Guardando…" : "Programar"}</Btn>
          <a href={urlImagen(slides[i] || slides[0])} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "flex" }}><Btn title="Ver en grande" style={{ height: "100%" }}><Ico d={["M15 3h6v6", "M9 21H3v-6", "M21 3l-7 7", "M3 21l7-7"]} /></Btn></a>
          <Btn kind="danger" onClick={onQuitar} title="Rechazar esta propuesta"><Ico d={["M18 6L6 18", "M6 6l12 12"]} /></Btn>
        </div>}
    </div>
  </div>;
}
// Un guion de reel: gancho, escenas, cierre. Se usa en la propuesta y en el detalle.
function Guion({ d, compacto }) {
  return <div style={{ display: "grid", gap: 8, fontSize: 13, lineHeight: 1.45 }}>
    <div style={{ padding: "10px 12px", borderRadius: 12, background: LIMA, color: "#15171A" }}><span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em" }}>GANCHO · 0-3 s</span><div style={{ fontWeight: 800, fontSize: 14.5, marginTop: 2 }}>{d.gancho}</div></div>
    {(d.escenas || []).map((e, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "54px 1fr", gap: 10, padding: "8px 10px", borderRadius: 10, background: SUAVE }}>
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: GRIS }}>{e.seg}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{e.plano}</div>
        {e.pantalla && <div style={{ marginTop: 3, fontFamily: MONO, fontSize: 11.5, padding: "2px 6px", borderRadius: 5, background: CARD, display: "inline-block" }}>{e.pantalla}</div>}
        {!compacto && e.voz && <div style={{ marginTop: 3, color: GRIS, fontStyle: "italic" }}>“{e.voz}”</div>}
      </div>
    </div>)}
    {d.cierre && <div style={{ padding: "8px 12px", borderRadius: 10, border: `1px dashed ${BORDE}` }}><span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: GRIS }}>CIERRE</span><div style={{ fontWeight: 600 }}>{d.cierre}</div></div>}
  </div>;
}
function PropuestaGuion({ c, ocupado, sugerido, piezas, onGuardar, onQuitar, onCambiar }) {
  const [prog, setProg] = useState(false); const d = c.datos || {};
  return <div style={{ background: CARD, border: `1px solid ${BORDE}`, borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px 0" }}>
      {d.foto && <img src={d.foto} alt="" style={{ width: 54, height: 54, borderRadius: 10, objectFit: "contain", background: "#fff" }} />}
      <div style={{ minWidth: 0, flex: 1 }}><div style={{ display: "flex", gap: 6, marginBottom: 4 }}><Chip l="Reel" c="#fff" bg="#7C3AED" /><Chip l={d.duracion || "30 s"} c={INK} bg={SUAVE} /><Chip l={d.tema === "maquina" ? "Máquina real" : d.tema === "pedido" ? "Pedido real" : "Marca"} c={GRIS} bg={SUAVE} /></div><b style={{ fontSize: 14.5, lineHeight: 1.3 }}>{c.titulo.replace(/^Reel · /, "")}</b></div>
    </div>
    <div style={{ padding: "12px 14px 14px", display: "grid", gap: 10 }}>
      <Guion d={d} />
      <TA value={c.caption || ""} onChange={(e) => onCambiar({ caption: e.target.value })} style={{ minHeight: 72, fontSize: 13 }} />
      <Inp value={c.hashtags || ""} onChange={(e) => onCambiar({ hashtags: e.target.value })} style={{ fontSize: 12, fontFamily: MONO }} />
      {prog ? <SelectorFecha tipo="guion" piezas={piezas} inicial={sugerido} ocupado={ocupado} onConfirmar={(dd) => onGuardar(c, dd.toISOString())} onCancelar={() => setProg(false)} />
        : <div style={{ display: "flex", gap: 8 }}>
          <Btn kind="lima" onClick={() => setProg(true)} disabled={ocupado} style={{ flex: 1 }} title="Elegí el día para filmarlo: ese día te llega por Telegram">{ocupado ? "Guardando…" : "Agendar para filmar"}</Btn>
          <Btn onClick={() => onGuardar(c)} disabled={ocupado} title="Guardarlo sin fecha">Guardar</Btn>
          <Btn kind="danger" onClick={onQuitar} title="Rechazar"><Ico d={["M18 6L6 18", "M6 6l12 12"]} /></Btn>
        </div>}
    </div>
  </div>;
}
function Previa({ slides, tipo, i, setI, etiquetas, imagenes }) {
  const src = imagenes ? imagenes[i] || imagenes[0] : urlImagen(slides[i] || slides[0]); const n = imagenes ? imagenes.length : slides.length;
  const [lista, setLista] = useState(false); useEffect(() => { setLista(false); }, [src]);
  return <div style={{ position: "relative", background: SUAVE }}>
    {!lista && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: GRIS, fontSize: 12, fontFamily: MONO, background: `linear-gradient(110deg, ${SUAVE} 40%, ${CARD} 50%, ${SUAVE} 60%)`, backgroundSize: "200% 100%", animation: "mqShimmer 1.4s linear infinite" }}>Dibujando…</div>}
    <style>{`@keyframes mqShimmer{to{background-position:-200% 0}}`}</style>
    <img src={src} alt="" onLoad={() => setLista(true)} style={{ width: "100%", aspectRatio: `1080/${alto(tipo)}`, objectFit: "cover", display: "block", opacity: lista ? 1 : 0, transition: "opacity .25s" }} loading="lazy" />
    <span style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6 }}>{etiquetas}</span>
    {n > 1 && <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5 }}>{Array.from({ length: n }).map((_, k) => <button key={k} onClick={() => setI(k)} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 999, border: "none", background: k === i ? LIMA : "rgba(255,255,255,0.8)", cursor: "pointer", padding: 0, transition: "width .15s" }} aria-label={`Placa ${k + 1}`} />)}</div>}
  </div>;
}

// ── Selector de fecha propio ─────────────────────────────────────────────────
// Calendario del sistema para programar: marca hoy, muestra cuántas historias (amarillo) y cuántas
// publicaciones/carruseles (gris) hay cada día, y al elegir un día lista lo que ya sale. Después la hora.
const esHistoria = (p) => p.tipo === "historia";
function SelectorFecha({ tipo, piezas, inicial, ocupado, onConfirmar, onCancelar }) {
  const hoy = new Date(); const ini = inicial ? new Date(inicial) : hoy;
  const [vista, setVista] = useState({ y: ini.getFullYear(), m: ini.getMonth() });
  const [dia, setDia] = useState(claveDia(ini)); const [hora, setHora] = useState(`${String(ini.getHours()).padStart(2, "0")}:${String(ini.getMinutes()).padStart(2, "0")}`);
  const activas = useMemo(() => piezas.filter((p) => ["programada", "publicada", "error"].includes(p.estado) && (p.programada_at || p.publicada_at)), [piezas]);
  const porDia = useMemo(() => { const r = {}; activas.forEach((p) => { const k = claveDia(p.programada_at || p.publicada_at); (r[k] = r[k] || []).push(p); }); return r; }, [activas]);
  const primero = new Date(vista.y, vista.m, 1); const desde = (primero.getDay() + 6) % 7; const dias = new Date(vista.y, vista.m + 1, 0).getDate();
  const celdas = []; for (let k = 0; k < desde; k++) celdas.push(null); for (let d = 1; d <= dias; d++) celdas.push(new Date(vista.y, vista.m, d)); while (celdas.length % 7) celdas.push(null);
  const hoyK = claveDia(hoy); const mover = (n) => setVista((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const delDia = (porDia[dia] || []).sort((a, b) => String(a.programada_at || a.publicada_at).localeCompare(String(b.programada_at || b.publicada_at)));
  const mismoTipo = tipo === "guion" ? delDia.filter((p) => p.tipo === "guion") : delDia.filter((p) => p.tipo !== "guion" && esHistoria(p) === (tipo === "historia"));
  const presets = tipo === "historia" ? ["12:00", "19:30"] : tipo === "guion" ? ["10:00", "15:00"] : ["18:30", "12:30"];
  const confirmar = () => { const [h, m] = hora.split(":").map(Number); const d = new Date(dia + "T12:00:00"); d.setHours(h || 0, m || 0, 0, 0); if (d.getTime() < Date.now()) { toast("Esa hora ya pasó", "warn"); return; } onConfirmar(d); };
  return <div style={{ display: "grid", gap: 10, padding: 10, borderRadius: 14, border: `1px solid ${LIMA}`, background: SUAVE }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Btn small onClick={() => mover(-1)}>‹</Btn><b style={{ fontSize: 13 }}>{MESES[vista.m]} {vista.y}</b><Btn small onClick={() => mover(1)}>›</Btn>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
      {["L", "M", "M", "J", "V", "S", "D"].map((d, k) => <div key={k} style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, color: GRIS }}>{d}</div>)}
      {celdas.map((d, k) => {
        if (!d) return <div key={k} />;
        const key = claveDia(d); const l = porDia[key] || []; const nR = l.filter((p) => p.tipo === "guion").length, nH = l.filter(esHistoria).length, nP = l.length - nH - nR; const pasado = key < hoyK; const sel = key === dia;
        return <button key={k} type="button" disabled={pasado} onClick={() => setDia(key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 0 3px", borderRadius: 8, border: `1px solid ${sel ? LIMA : key === hoyK ? INK : "transparent"}`, background: sel ? LIMA : CARD, color: sel ? "#15171A" : INK, cursor: pasado ? "default" : "pointer", opacity: pasado ? 0.35 : 1 }}>
          <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: key === hoyK ? 800 : 600 }}>{d.getDate()}</span>
          <span style={{ display: "flex", gap: 2, height: 12 }}>
            {nH > 0 && <span title={`${nH} historia(s)`} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, padding: "0 4px", borderRadius: 4, background: sel ? "#15171A" : LIMA, color: sel ? LIMA : "#15171A" }}>{nH}</span>}
            {nP > 0 && <span title={`${nP} publicación(es)`} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, padding: "0 4px", borderRadius: 4, background: sel ? "rgba(21,23,26,0.25)" : INK, color: sel ? "#15171A" : CARD }}>{nP}</span>}
            {nR > 0 && <span title={`${nR} reel(s) para filmar`} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, padding: "0 4px", borderRadius: 4, background: "#7C3AED", color: "#fff" }}>{nR}</span>}
          </span>
        </button>;
      })}
    </div>
    <div style={{ display: "flex", gap: 10, fontSize: 10.5, color: GRIS, fontFamily: MONO }}><span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: LIMA, marginRight: 4 }} />historias</span><span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: INK, marginRight: 4 }} />publicaciones y carruseles</span><span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "#7C3AED", marginRight: 4 }} />reels para filmar</span></div>
    <div style={{ borderTop: `1px solid ${BORDE}`, paddingTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{new Date(dia + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}{dia === hoyK ? " · hoy" : ""}</div>
      {delDia.length === 0 ? <div style={{ fontSize: 12, color: GRIS }}>Nada programado ese día.</div>
        : <div style={{ display: "grid", gap: 3 }}>{delDia.map((p) => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, minWidth: 0 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: p.tipo === "guion" ? "#7C3AED" : esHistoria(p) ? LIMA : INK, flex: "none" }} /><span style={{ fontFamily: MONO, color: GRIS }}>{soloHora(p.programada_at || p.publicada_at)}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo}</span>{p.estado === "publicada" && <span style={{ width: 6, height: 6, borderRadius: 999, background: OK, flex: "none" }} />}</div>)}</div>}
      {mismoTipo.length > 0 && <div style={{ fontSize: 11.5, color: WARN, marginTop: 4 }}>{tipo === "guion" ? `Ese día ya hay ${mismoTipo.length} reel${mismoTipo.length > 1 ? "s" : ""} para filmar.` : `Ese día ya ${mismoTipo.length === 1 ? "sale una" : `salen ${mismoTipo.length}`} ${tipo === "historia" ? "historia" : "publicación"}${mismoTipo.length > 1 ? (tipo === "historia" ? "s" : "es") : ""}.`}</div>}
    </div>
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {presets.map((h) => <Pill key={h} small on={hora === h} onClick={() => setHora(h)}>{h}</Pill>)}
      <Inp type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ width: 104, padding: "6px 8px", fontSize: 12.5 }} />
    </div>
    <div style={{ display: "flex", gap: 8 }}><Btn kind="lima" onClick={confirmar} disabled={ocupado} style={{ flex: 1 }}>{ocupado ? "Guardando…" : `Programar · ${new Date(dia + "T12:00:00").getDate()} ${MESES_C[new Date(dia + "T12:00:00").getMonth()]} ${hora}`}</Btn><Btn onClick={onCancelar}>Volver</Btn></div>
  </div>;
}

// ── Calendario mensual ───────────────────────────────────────────────────────
function Calendario({ piezas, listas, ig, ocupado, programar, abrir }) {
  const hoy = new Date(); const [vista, setVista] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() }); const [diaSel, setDiaSel] = useState(claveDia(hoy));
  const porDia = useMemo(() => { const r = {}; piezas.forEach((p) => { const f = p.estado === "publicada" ? p.publicada_at : p.programada_at; if (!f) return; (r[claveDia(f)] = r[claveDia(f)] || []).push(p); }); Object.values(r).forEach((l) => l.sort((a, b) => String(a.programada_at || a.publicada_at).localeCompare(String(b.programada_at || b.publicada_at)))); return r; }, [piezas]);
  const primero = new Date(vista.y, vista.m, 1); const desde = (primero.getDay() + 6) % 7; const dias = new Date(vista.y, vista.m + 1, 0).getDate();
  const celdas = []; for (let k = 0; k < desde; k++) celdas.push(null); for (let d = 1; d <= dias; d++) celdas.push(new Date(vista.y, vista.m, d)); while (celdas.length % 7) celdas.push(null);
  const mover = (n) => setVista((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const hoyK = claveDia(hoy);
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
    <Sec titulo={`${MESES[vista.m]} ${vista.y}`} extra={<div style={{ display: "flex", gap: 6 }}><Btn small onClick={() => mover(-1)}>‹</Btn><Btn small onClick={() => { setVista({ y: hoy.getFullYear(), m: hoy.getMonth() }); setDiaSel(hoyK); }}>Hoy</Btn><Btn small onClick={() => mover(1)}>›</Btn></div>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6 }}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: GRIS, padding: "2px 6px" }}>{d}</div>)}
        {celdas.map((d, k) => {
          if (!d) return <div key={k} />;
          const key = claveDia(d); const l = porDia[key] || []; const pasado = key < hoyK; const sel = key === diaSel;
          return <button key={k} type="button" onClick={() => setDiaSel(key)} style={{ textAlign: "left", minHeight: 118, padding: 7, borderRadius: 12, border: `1px solid ${sel ? LIMA : BORDE}`, background: sel ? LIMA_SUAVE : key === hoyK ? SUAVE : CARD, cursor: "pointer", opacity: pasado && !l.length ? 0.5 : 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: key === hoyK ? 800 : 600, color: key === hoyK ? INK : GRIS }}>{d.getDate()}</span>
            {l.slice(0, 2).map((p) => <Ficha key={p.id} p={p} />)}
            {l.length > 2 && <span style={{ fontSize: 11, color: GRIS }}>+{l.length - 2} más</span>}
          </button>;
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 12, color: GRIS, flexWrap: "wrap", alignItems: "center" }}><Leyenda c={LIMA} l="Historia" /><Leyenda c={SUAVE} l="Publicación" borde /><Leyenda c={SUAVE} l="Carrusel (doble borde)" borde doble /><Leyenda c="#7C3AED" l="Reel para filmar" /><span style={{ width: 1, height: 14, background: BORDE }} /><Leyenda c={OK} l="punto verde: publicada" punto /><Leyenda c={BAD} l="punto rojo: error" punto /></div>
    </Sec>
    <Dia key={diaSel} dia={diaSel} lista={porDia[diaSel] || []} listas={listas} ig={ig} ocupado={ocupado} programar={programar} abrir={abrir} />
  </div>;
}
const Leyenda = ({ c, l, borde, doble, punto }) => <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: punto ? 8 : 14, height: punto ? 8 : 12, borderRadius: punto ? 999 : 3, background: c, display: "inline-block", border: borde ? `1px solid ${BORDE}` : "none", boxShadow: doble ? `2px 2px 0 ${BORDE}` : "none" }} />{l}</span>;
// Cada pieza en el calendario: color por formato (historia amarilla, publicación gris, carrusel gris con doble borde),
// y el estado con un punto (verde publicada, rojo error).
const Ficha = ({ p }) => {
  const esH = p.tipo === "historia", esC = p.tipo === "carrusel", esR = p.tipo === "guion";
  const estado = p.estado === "publicada" ? OK : p.estado === "error" ? BAD : null;
  return <span title={`${TIPO[p.tipo]?.l || ""} · ${p.titulo}`} style={{ display: "flex", flexDirection: "column", gap: 1, padding: "4px 7px", borderRadius: 7, background: esR ? "#7C3AED" : esH ? LIMA : SUAVE, color: esR ? "#fff" : esH ? "#15171A" : INK, border: `1px solid ${esR ? "#7C3AED" : esH ? LIMA : BORDE}`, boxShadow: esC ? `2px 2px 0 ${BORDE}` : "none", minWidth: 0, opacity: p.estado === "publicada" ? 0.85 : 1 }}>
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>{estado && <span style={{ width: 7, height: 7, borderRadius: 999, background: estado, flex: "none" }} />}{soloHora(p.programada_at || p.publicada_at)} · {esR ? "Reel" : esH ? "Historia" : esC ? "Carrusel" : "Post"}</span>
    <span style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo.replace(/^[^·]+·\s*/, "")}</span>
  </span>;
};

function Dia({ dia, lista, listas, ig, ocupado, programar, abrir }) {
  const [sel, setSel] = useState(listas[0]?.id || ""); const [hora, setHora] = useState("12:00");
  const fecha = new Date(dia + "T12:00:00"); const pasado = dia < claveDia(new Date());
  const elegida = listas.find((p) => p.id === sel);
  const confirmar = () => { if (!elegida) return; const [h, m] = hora.split(":").map(Number); const d = new Date(fecha); d.setHours(h, m, 0, 0); if (d.getTime() < Date.now()) { toast("Esa hora ya pasó", "warn"); return; } programar(elegida, d); };
  return <Sec titulo={fecha.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}>
    {lista.length === 0 ? <p style={{ margin: "0 0 14px", fontSize: 13, color: GRIS }}>Nada {pasado ? "publicado" : "programado"} este día.</p>
      : <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>{lista.map((p) => <button key={p.id} type="button" onClick={() => abrir(p)} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 10, alignItems: "center", textAlign: "left", padding: 8, borderRadius: 12, border: `1px solid ${BORDE}`, background: CARD, cursor: "pointer" }}>
        <img src={p.imagenes?.[0]} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, background: SUAVE }} />
        <span style={{ minWidth: 0 }}><span style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}><Chip {...(ESTADO[p.estado] || ESTADO.aprobada)} /><span style={{ fontFamily: MONO, fontSize: 11.5, color: GRIS }}>{soloHora(p.programada_at || p.publicada_at)}</span></span><span style={{ fontSize: 13, fontWeight: 700, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo}</span></span>
      </button>)}</div>}
    {!pasado && <div style={{ borderTop: `1px solid ${BORDE}`, paddingTop: 14, display: "grid", gap: 10 }}>
      <b style={{ fontSize: 13 }}>Programar este día</b>
      {listas.length === 0 ? <p style={{ margin: 0, fontSize: 12.5, color: GRIS }}>No hay piezas sin fecha. Las que quitás del calendario quedan acá para reprogramar.</p> : <>
        <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 11, border: `1px solid ${BORDE}`, background: CARD, color: INK, fontSize: 13, fontWeight: 600 }}>{listas.map((p) => <option key={p.id} value={p.id}>{TIPO[p.tipo]?.l} · {p.titulo}</option>)}</select>
        <div style={{ display: "flex", gap: 8 }}><Inp type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ width: 130 }} /><Btn kind="lima" onClick={confirmar} disabled={!elegida || ocupado.startsWith("programar")} style={{ flex: 1 }}>Programar</Btn></div>
        {!ig && <p style={{ margin: 0, fontSize: 12, color: WARN }}>Instagram no está conectado: lo programado no va a salir solo hasta que lo conectes.</p>}
      </>}
    </div>}
  </Sec>;
}

// ── Cola: todo lo guardado ───────────────────────────────────────────────────
function Cola({ piezas, abrir, ...ctx }) {
  const [f, setF] = useState("pendientes");
  const filtros = [["pendientes", "Pendientes", (p) => ["aprobada", "programada", "error"].includes(p.estado)], ["programadas", "Programadas", (p) => p.estado === "programada"], ["listas", "Sin fecha", (p) => p.estado === "aprobada"], ["publicadas", "Publicadas", (p) => p.estado === "publicada"], ["descartadas", "Descartadas", (p) => p.estado === "descartada"]];
  const activo = filtros.find((x) => x[0] === f) || filtros[0];
  const lista = piezas.filter(activo[2]).sort((a, b) => String(a.programada_at || a.publicada_at || a.created_at).localeCompare(String(b.programada_at || b.publicada_at || b.created_at)) * (f === "publicadas" || f === "descartadas" ? -1 : 1));
  return <>
    <Barra>{filtros.map(([k, l, fn]) => <Pill key={k} small on={f === k} onClick={() => setF(k)}>{l} · {piezas.filter(fn).length}</Pill>)}</Barra>
    {lista.length === 0 ? <Vacio>Nada por acá.</Vacio> : <div style={{ display: "grid", gap: 10 }}>{lista.map((p) => <FilaPieza key={p.id} p={p} onAbrir={() => abrir(p)} {...ctx} />)}</div>}
  </>;
}
function FilaPieza({ p, onAbrir, ig, ocupado, publicar, desprogramar, descartar, celular, copiar }) {
  const e = ESTADO[p.estado] || ESTADO.aprobada; const t = TIPO[p.tipo] || TIPO.post; const imgs = p.imagenes || [];
  const fecha = p.estado === "publicada" ? `${p.tipo === "guion" ? "enviada al celular" : "publicada"} ${fmtHora(p.publicada_at)}` : p.estado === "programada" ? `${p.tipo === "guion" ? "para filmar" : "sale"} ${fmtHora(p.programada_at)}` : `guardada ${fmtHora(p.created_at)}`;
  return <div style={{ display: "grid", gridTemplateColumns: "72px 1fr auto", gap: 14, padding: 12, background: CARD, border: `1px solid ${p.estado === "error" ? BAD : BORDE}`, borderRadius: 16, alignItems: "center", opacity: p.estado === "descartada" ? 0.55 : 1 }}>
    <button type="button" onClick={onAbrir} style={{ border: "none", padding: 0, background: "transparent", cursor: "pointer" }}>{p.tipo === "guion" ? <span style={{ width: 72, height: 72, borderRadius: 10, background: "#7C3AED", color: "#fff", display: "grid", placeItems: "center", fontSize: 26 }}>🎬</span> : <img src={imgs[0]} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, background: SUAVE, display: "block" }} />}</button>
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}><b style={{ fontSize: 14 }}>{p.titulo}</b><Chip l={t.l} c={t.c} bg={t.bg} /><Chip l={e.l} c={e.c} bg={e.bg} />{imgs.length > 1 && <span style={{ fontFamily: MONO, fontSize: 11, color: GRIS }}>{imgs.length} placas</span>}</div>
      <div style={{ fontFamily: MONO, fontSize: 11.5, color: GRIS }}>{fecha}{p.estado === "error" && p.error ? ` · ${p.error}` : ""}</div>
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {p.tipo !== "guion" && p.estado !== "publicada" && p.estado !== "descartada" && <Btn small kind="lima" onClick={() => publicar(p)} disabled={ocupado === `publicar${p.id}` || !ig} title={ig ? "" : "Conectá Instagram primero"}>{ocupado === `publicar${p.id}` ? "Publicando…" : "Publicar ahora"}</Btn>}
      {p.estado === "programada" && <Btn small onClick={() => desprogramar(p)}>Quitar fecha</Btn>}
      {(p.tipo === "historia" || p.tipo === "guion") && p.estado !== "descartada" && <Btn small onClick={() => celular(p)} disabled={ocupado === `celular${p.id}`} title={p.tipo === "guion" ? "Te manda el guion completo por Telegram" : "Te la manda por Telegram con el link, para subirla con el sticker"}>Al celular</Btn>}
      <Btn small onClick={onAbrir}>Abrir</Btn>
      {["aprobada", "error"].includes(p.estado) && <Btn small kind="danger" onClick={() => descartar(p)}>Descartar</Btn>}
    </div>
  </div>;
}

// ── Detalle (panel lateral) ──────────────────────────────────────────────────
function Detalle({ p, onCerrar, ig, ocupado, piezas, publicar, programar, desprogramar, descartar, celular, guardarTexto, copiar }) {
  const [i, setI] = useState(0); const [caption, setCaption] = useState(p.caption || ""); const [tags, setTags] = useState(p.hashtags || ""); const [eligiendo, setEligiendo] = useState(false);
  useEffect(() => { setCaption(p.caption || ""); setTags(p.hashtags || ""); }, [p.id, p.caption, p.hashtags]);
  const e = ESTADO[p.estado] || ESTADO.aprobada; const t = TIPO[p.tipo] || TIPO.post; const imgs = p.imagenes || []; const editable = p.estado !== "publicada";
  const cambio = caption !== (p.caption || "") || tags !== (p.hashtags || "");
  return <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
    <div onClick={onCerrar} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
    <aside style={{ position: "relative", width: "min(520px,100%)", height: "100%", background: CARD, borderLeft: `1px solid ${BORDE}`, overflowY: "auto", padding: 18, display: "grid", gap: 14, alignContent: "start" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Chip l={t.l} c={t.c} bg={t.bg} /><Chip l={e.l} c={e.c} bg={e.bg} /><span style={{ flex: 1 }} /><Btn small onClick={onCerrar}>Cerrar</Btn></div>
      <b style={{ fontSize: 16, lineHeight: 1.3 }}>{p.titulo}</b>
      {p.tipo === "guion" ? <Guion d={p.datos || {}} /> : <div style={{ borderRadius: 14, overflow: "hidden", maxWidth: 300, justifySelf: "center" }}><Previa imagenes={imgs} tipo={p.tipo} i={i} setI={setI} /></div>}
      <div style={{ fontFamily: MONO, fontSize: 11.5, color: GRIS }}>{p.estado === "publicada" ? `Publicada ${fmtHora(p.publicada_at)}` : p.estado === "programada" ? `Sale ${fmtHora(p.programada_at)}` : `Guardada ${fmtHora(p.created_at)}`}{p.estado === "error" && p.error ? ` · ${p.error}` : ""}</div>
      <Campo label="Texto"><TA value={caption} onChange={(e) => setCaption(e.target.value)} disabled={!editable} style={{ minHeight: 120, fontSize: 13 }} /></Campo>
      <Campo label="Hashtags"><Inp value={tags} onChange={(e) => setTags(e.target.value)} disabled={!editable} style={{ fontSize: 12, fontFamily: MONO }} /></Campo>
      {editable && cambio && <Btn kind="lima" small onClick={() => guardarTexto(p, caption, tags)} disabled={ocupado === `texto${p.id}`}>Guardar texto</Btn>}
      {p.link && <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: 12, background: SUAVE, fontSize: 12.5 }}><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: MONO }}>{p.link}</span><Btn small onClick={() => copiar(p.link, "Link copiado")}>Copiar link</Btn></div>}
      {editable && (eligiendo
        ? <SelectorFecha tipo={p.tipo} piezas={piezas.filter((x) => x.id !== p.id)} inicial={p.programada_at || proximoHueco(p.tipo, piezas)} ocupado={ocupado === `programar${p.id}`} onConfirmar={async (d) => { await programar(p, d); setEligiendo(false); }} onCancelar={() => setEligiendo(false)} />
        : <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Btn kind="lima" onClick={() => setEligiendo(true)}>{p.estado === "programada" ? "Cambiar la fecha" : p.tipo === "guion" ? "Agendar para filmar" : "Programar"}</Btn>
          {p.estado === "programada" && <Btn small onClick={() => desprogramar(p)}>Quitar fecha</Btn>}
          {!ig && p.tipo !== "guion" && <span style={{ fontSize: 12, color: WARN }}>Sin Instagram conectado no sale sola.</span>}
        </div>)}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {editable && p.tipo !== "guion" && <Btn kind="lima" onClick={() => publicar(p)} disabled={ocupado === `publicar${p.id}` || !ig}>{ocupado === `publicar${p.id}` ? "Publicando…" : "Publicar ahora"}</Btn>}
        {(p.tipo === "historia" || p.tipo === "guion") && <Btn kind={p.tipo === "guion" ? "lima" : "ghost"} onClick={() => celular(p)} disabled={ocupado === `celular${p.id}`}>Mandar al celular</Btn>}
        <Btn onClick={() => copiar(`${caption}\n\n${tags}`.trim(), "Texto copiado")}>Copiar texto</Btn>
        {imgs.map((u, k) => <a key={k} href={u} download target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn>Descargar{imgs.length > 1 ? ` ${k + 1}` : ""}</Btn></a>)}
        {["aprobada", "error"].includes(p.estado) && <Btn kind="danger" onClick={() => descartar(p)}>Descartar</Btn>}
      </div>
      {p.tipo === "historia" && <p style={{ margin: 0, fontSize: 12, color: GRIS, lineHeight: 1.5 }}>Instagram no deja poner el sticker de link por API. Si querés el link tocable, mandala al celular y subila desde la app: la imagen ya trae la dirección impresa igual.</p>}
    </aside>
  </div>;
}

// ── Instagram ────────────────────────────────────────────────────────────────
function Instagram({ ig, api, onCambio }) {
  const [token, setToken] = useState(""); const [lo, setLo] = useState(false);
  const conectar = async () => { if (!token.trim()) return; setLo(true); try { const d = await api("POST", { accion: "ig_conectar", token }); onCambio(d.ig); setToken(""); toast(`Conectado @${d.ig?.username || ""}`); } catch (e) { toast(e.message, "error"); } setLo(false); };
  const desconectar = async () => { if (!(await confirmDialog("¿Desconectar el Instagram de ARGENMAQ?", { ok: "Desconectar" }))) return; try { await api("POST", { accion: "ig_desconectar" }); onCambio(null); } catch (e) { toast(e.message, "error"); } };
  return <div style={{ display: "grid", gap: 14, maxWidth: 720 }}>
    <Sec titulo="Cuenta de ARGENMAQ">
      {ig ? <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><Chip l="Conectado" c={OK} bg={OK_BG} /><b>@{ig.username || "argenmaq_"}</b><span style={{ fontSize: 12.5, color: GRIS }}>desde {fmtHora(ig.connected_at)}</span><span style={{ flex: 1 }} /><Btn small kind="danger" onClick={desconectar}>Desconectar</Btn></div>
        : <div style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, color: GRIS, lineHeight: 1.5 }}>Es una cuenta aparte de la de Argencargo. Pegá un token de acceso de la cuenta profesional @argenmaq_ (inicio de sesión de Instagram, o un token de Facebook de la página vinculada). Hasta entonces, las piezas se descargan y se suben a mano.</p>
          <Campo label="Token de acceso"><TA value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAG… o IGQ…" style={{ minHeight: 90, fontFamily: MONO, fontSize: 12 }} /></Campo>
          <div><Btn kind="lima" onClick={conectar} disabled={lo || !token.trim()}>{lo ? "Conectando…" : "Conectar"}</Btn></div>
        </div>}
    </Sec>
    <Sec titulo="Cómo publica">
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: GRIS, lineHeight: 1.7 }}>
        <li>Lo <b style={{ color: INK }}>programado</b> sale solo a la hora marcada (el servidor revisa cada minuto). Si Instagram rechaza algo, la pieza queda en rojo con el motivo.</li>
        <li>Las <b style={{ color: INK }}>historias</b> salen con la dirección del sitio impresa. El sticker de link no se puede poner por API: para eso, “Mandar al celular” te la envía por Telegram con el link y la subís desde la app.</li>
        <li>Los <b style={{ color: INK }}>carruseles</b> salen como una sola publicación con varias placas; las publicaciones, con una imagen.</li>
        <li>Nada lleva fecha de llegada. Las historias llevan precio; lo que queda en el perfil, no.</li>
      </ul>
    </Sec>
  </div>;
}
