"use client";
// Marketing › Content Studio de ARGENMAQ. Cada día propone piezas armadas con datos reales (catálogo,
// pedidos, A pedido). Se aprueban, se descargan o se publican en el Instagram de ARGENMAQ.
import { useState, useEffect } from "react";
import { INK,GRIS,BORDE,SUAVE,CARD,LIMA,LIMA_SUAVE,OK,OK_BG,WARN,WARN_BG,BAD,BAD_BG,MONO,INP,LBL,Campo,Inp,TA,Btn,Sec,Pill,Chip,Barra,Vacio,toast,confirmDialog } from "./ui";

const codificar = (obj) => { const s = unescape(encodeURIComponent(JSON.stringify(obj))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const urlImagen = (slide) => `/api/argenmaq/studio/imagen?d=${codificar(slide)}`;
const PLANT = { maquina_dia: "Máquina del día", cuanto_sale: "¿Cuánto sale?", en_viaje: "Salió de China", llego: "Llegó", pedidos: "Nos pidieron", ficha: "Ficha", rubro: "Por rubro" };
const ESTADO = { aprobada: { l: "Aprobada", c: INK, bg: SUAVE }, publicada: { l: "Publicada", c: OK, bg: OK_BG }, descartada: { l: "Descartada", c: GRIS, bg: SUAVE } };
const fmtHora = (d) => d ? new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export function Studio({ token }) {
  const [tab, setTab] = useState("hoy");
  const [cands, setCands] = useState([]); const [guardadas, setGuardadas] = useState([]); const [ig, setIg] = useState(null);
  const [cargando, setCargando] = useState(true); const [ocupado, setOcupado] = useState("");
  const api = async (method, body, query = "") => { const r = await fetch(`/api/argenmaq/studio${query}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `Error ${r.status}`); return d; };
  const cargar = async () => { setCargando(true); try { const d = await api("GET", null, "?accion=candidatos"); setCands((d.candidatos || []).map((c, i) => ({ ...c, _k: i }))); setGuardadas(d.guardadas || []); setIg(d.ig || null); } catch (e) { toast(e.message, "error"); } setCargando(false); };
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async (c) => { setOcupado(`g${c._k}`); try { const d = await api("POST", { accion: "guardar", pieza: c }); setGuardadas((l) => [d.pieza, ...l]); setCands((l) => l.filter((x) => x._k !== c._k)); toast("Pieza guardada. Ya la podés descargar o publicar."); setTab("guardadas"); } catch (e) { toast(e.message, "error"); } setOcupado(""); };
  const publicar = async (p) => { if (!(await confirmDialog(`¿Publicar “${p.titulo}” en el Instagram de ARGENMAQ${ig?.username ? ` (@${ig.username})` : ""}?`, { ok: "Publicar" }))) return; setOcupado(`p${p.id}`); try { const d = await api("POST", { accion: "publicar", id: p.id }); setGuardadas((l) => l.map((x) => x.id === p.id ? d.pieza : x)); toast("Publicada en Instagram"); } catch (e) { toast(e.message, "error"); } setOcupado(""); };
  const descartar = async (p) => { try { const d = await api("POST", { accion: "descartar", id: p.id }); setGuardadas((l) => l.map((x) => x.id === p.id ? d.pieza : x)); } catch (e) { toast(e.message, "error"); } };
  const copiar = async (p) => { try { await navigator.clipboard.writeText(`${p.caption || ""}\n\n${p.hashtags || ""}`.trim()); toast("Texto copiado"); } catch { toast("No se pudo copiar", "error"); } };
  const setCand = (k, patch) => setCands((l) => l.map((x) => x._k === k ? { ...x, ...patch } : x));

  const historias = cands.filter((c) => c.tipo === "historia"), posts = cands.filter((c) => c.tipo === "post");
  const activas = guardadas.filter((p) => p.estado !== "descartada");

  return <>
    <Barra>
      <div style={{ display: "flex", gap: 4, flex: 1 }}>{[["hoy", `Para hoy · ${cands.length}`], ["guardadas", `Guardadas · ${activas.length}`], ["ig", ig ? `Instagram · @${ig.username || "conectado"}` : "Instagram · sin conectar"]].map(([k, l]) => <Pill key={k} on={tab === k} onClick={() => setTab(k)}>{l}</Pill>)}</div>
      <Btn onClick={cargar} disabled={cargando}>{cargando ? "Armando…" : "Volver a armar"}</Btn>
    </Barra>
    <p style={{ margin: "-6px 0 18px", fontSize: 13, color: GRIS }}>Todo sale de datos reales: máquinas del catálogo con su precio y fecha de llegada, pedidos que viajaron o llegaron, y lo que pidieron en A pedido. Las historias llevan precio; las publicaciones no.</p>

    {tab === "hoy" && (cargando ? <p style={{ color: GRIS }}>Armando las piezas de hoy…</p> : cands.length === 0 ? <Vacio>No hay nada para armar hoy. Cargá máquinas con foto y precio en el catálogo.</Vacio> : <>
      <Grupo titulo="Historias" sub="Duran 24 horas: van con precio y fecha de llegada.">{historias.map((c) => <Candidata key={c._k} c={c} ocupado={ocupado === `g${c._k}`} onGuardar={() => guardar(c)} onCambiar={(patch) => setCand(c._k, patch)} />)}</Grupo>
      <Grupo titulo="Publicaciones" sub="Quedan en el perfil: sin precio, invitan a consultar.">{posts.map((c) => <Candidata key={c._k} c={c} ocupado={ocupado === `g${c._k}`} onGuardar={() => guardar(c)} onCambiar={(patch) => setCand(c._k, patch)} />)}</Grupo>
    </>)}

    {tab === "guardadas" && (guardadas.length === 0 ? <Vacio>Todavía no guardaste ninguna pieza. Armalas desde “Para hoy”.</Vacio>
      : <div style={{ display: "grid", gap: 12 }}>{guardadas.map((p) => <Guardada key={p.id} p={p} ig={ig} ocupado={ocupado === `p${p.id}`} onPublicar={() => publicar(p)} onDescartar={() => descartar(p)} onCopiar={() => copiar(p)} />)}</div>)}

    {tab === "ig" && <Instagram ig={ig} api={api} onCambio={(v) => setIg(v)} />}
  </>;
}

const Grupo = ({ titulo, sub, children }) => <div style={{ marginBottom: 26 }}>
  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}><h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{titulo}</h3><span style={{ fontSize: 12.5, color: GRIS }}>{sub}</span></div>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12 }}>{children}</div>
</div>;

function Candidata({ c, ocupado, onGuardar, onCambiar }) {
  const slides = c.datos?.slides || []; const [i, setI] = useState(0);
  const alto = c.tipo === "historia" ? 1920 / 1080 : 1350 / 1080;
  return <div style={{ background: CARD, border: `1px solid ${BORDE}`, borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
    <div style={{ position: "relative", background: SUAVE }}>
      <img src={urlImagen(slides[i] || slides[0])} alt="" style={{ width: "100%", aspectRatio: `1080/${c.tipo === "historia" ? 1920 : 1350}`, objectFit: "cover", display: "block" }} loading="lazy" />
      <span style={{ position: "absolute", top: 10, left: 10 }}><Chip l={PLANT[c.plantilla] || c.plantilla} c="#15171A" bg={LIMA} /></span>
      {slides.length > 1 && <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", gap: 4 }}>{slides.map((_, k) => <button key={k} onClick={() => setI(k)} style={{ width: 26, height: 26, borderRadius: 999, border: "none", background: k === i ? LIMA : "rgba(255,255,255,0.85)", fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{k + 1}</button>)}</div>}
    </div>
    <div style={{ padding: "12px 14px 14px", display: "grid", gap: 8 }}>
      <b style={{ fontSize: 14, lineHeight: 1.3 }}>{c.titulo}</b>
      <TA value={c.caption || ""} onChange={(e) => onCambiar({ caption: e.target.value })} style={{ minHeight: 96, fontSize: 13 }} />
      <Inp value={c.hashtags || ""} onChange={(e) => onCambiar({ hashtags: e.target.value })} style={{ fontSize: 12, fontFamily: MONO }} />
      <div style={{ display: "flex", gap: 8 }}>
        <Btn kind="lima" onClick={onGuardar} disabled={ocupado} style={{ flex: 1 }}>{ocupado ? "Guardando…" : "Aprobar y guardar"}</Btn>
        <a href={urlImagen(slides[i] || slides[0])} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn>Ver grande</Btn></a>
      </div>
    </div>
  </div>;
}

function Guardada({ p, ig, ocupado, onPublicar, onDescartar, onCopiar }) {
  const e = ESTADO[p.estado] || ESTADO.aprobada; const imgs = p.imagenes || [];
  return <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 16, padding: 14, background: CARD, border: `1px solid ${BORDE}`, borderRadius: 18, alignItems: "start", opacity: p.estado === "descartada" ? 0.55 : 1 }}>
    <div style={{ display: "flex", gap: 6 }}>{imgs.slice(0, 2).map((u, k) => <a key={k} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={{ width: imgs.length > 1 ? 57 : 120, borderRadius: 10, display: "block", background: SUAVE }} /></a>)}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}><b style={{ fontSize: 14.5 }}>{p.titulo}</b><Chip l={p.tipo === "historia" ? "Historia" : "Publicación"} c={INK} bg={SUAVE} /><Chip l={e.l} c={e.c} bg={e.bg} /><span style={{ fontFamily: MONO, fontSize: 11.5, color: GRIS }}>{p.estado === "publicada" ? `publicada ${fmtHora(p.publicada_at)}` : fmtHora(p.created_at)}</span></div>
      <p style={{ margin: 0, fontSize: 13, color: GRIS, whiteSpace: "pre-wrap", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.caption}</p>
    </div>
    <div style={{ display: "grid", gap: 6, minWidth: 150 }}>
      {p.estado === "aprobada" && <Btn kind="lima" small onClick={onPublicar} disabled={ocupado || !ig} title={ig ? "" : "Conectá Instagram primero"}>{ocupado ? "Publicando…" : "Publicar en IG"}</Btn>}
      {imgs.map((u, k) => <a key={k} href={u} download target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn small style={{ width: "100%" }}>Descargar{imgs.length > 1 ? ` ${k + 1}` : ""}</Btn></a>)}
      <Btn small onClick={onCopiar}>Copiar texto</Btn>
      {p.estado === "aprobada" && <Btn small kind="danger" onClick={onDescartar}>Descartar</Btn>}
    </div>
  </div>;
}

function Instagram({ ig, api, onCambio }) {
  const [token, setToken] = useState(""); const [lo, setLo] = useState(false);
  const conectar = async () => { if (!token.trim()) return; setLo(true); try { const d = await api("POST", { accion: "ig_conectar", token }); onCambio(d.ig); setToken(""); toast(`Conectado @${d.ig?.username || ""}`); } catch (e) { toast(e.message, "error"); } setLo(false); };
  const desconectar = async () => { if (!(await confirmDialog("¿Desconectar el Instagram de ARGENMAQ?", { ok: "Desconectar" }))) return; try { await api("POST", { accion: "ig_desconectar" }); onCambio(null); } catch (e) { toast(e.message, "error"); } };
  return <Sec titulo="Instagram de ARGENMAQ">
    {ig ? <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><Chip l="Conectado" c={OK} bg={OK_BG} /><b>@{ig.username || "argenmac_"}</b><span style={{ fontSize: 12.5, color: GRIS }}>desde {fmtHora(ig.connected_at)}</span><span style={{ flex: 1 }} /><Btn small kind="danger" onClick={desconectar}>Desconectar</Btn></div>
      : <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
        <p style={{ margin: 0, fontSize: 14, color: GRIS, lineHeight: 1.5 }}>Es una cuenta aparte de la de Argencargo. Pegá un token de acceso de la cuenta profesional @argenmac_ (inicio de sesión de Instagram, o un token de Facebook de la página vinculada). Hasta entonces, las piezas se descargan y se suben a mano.</p>
        <Campo label="Token de acceso"><TA value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAG… o IGQ…" style={{ minHeight: 90, fontFamily: MONO, fontSize: 12 }} /></Campo>
        <div><Btn kind="lima" onClick={conectar} disabled={lo || !token.trim()}>{lo ? "Conectando…" : "Conectar"}</Btn></div>
      </div>}
  </Sec>;
}
