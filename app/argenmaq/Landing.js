"use client";
// Landing de ARGENMAQ (04/10/2026, segunda vuelta). Corta, porque no se lee:
//   1. Hero: qué hacemos en una frase, botón al catálogo y una cinta de máquinas reales.
//   2. Los cinco pasos al estilo Shippar: sección amarilla que ocupa la pantalla mientras se desliza,
//      tarjeta oscura con el paso a la izquierda y un gráfico animado a la derecha, y la línea abajo.
//   3. Catálogo de maquinaria: 10 máquinas y al final "Ver catálogo completo".
//   4. Por qué ARGENMAQ: tarjetas animadas (Argencargo, precio final, dos cuotas, 220 V, seguimiento, respaldo).
//   5. ¿No encontrás la máquina que buscás?
import { useEffect, useRef, useState } from "react";
import { useAM, Marco, MONO, WA, Ico, primeraFoto, precioVidriera, diasVia } from "./kit";
import { Tarjeta, usePrecios } from "./Tienda";

const Y = "#FFD200";
const K = "#15171A";

// ── Gráficos con movimiento de las tarjetas de "Por qué ARGENMAQ" ─────────────────────────
const Barras = () => <svg className="anim" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">{[40, 90, 140, 190, 240, 290, 340].map((x, i) => <rect key={x} x={x} y={30} width="26" height="150" rx="4" fill={i === 5 ? Y : "rgba(255,255,255,0.16)"} style={{ transformOrigin: "50% 180px", transformBox: "fill-box", animation: `subir 1.8s ${i * 0.15}s ease-out infinite alternate` }} />)}<line x1="30" y1="180" x2="380" y2="180" stroke="rgba(255,255,255,0.3)" /></svg>;
const DosCuotas = () => <svg className="anim" viewBox="0 0 400 200" aria-hidden="true"><g transform="translate(40 70)"><rect width="320" height="34" rx="17" fill="rgba(255,255,255,0.12)" /><rect width="320" height="34" rx="17" fill={Y} style={{ transformOrigin: "0 0", transformBox: "fill-box", animation: "llenarDos 4s ease-in-out infinite" }} /><text x="12" y="62" fontFamily={MONO} fontSize="11" letterSpacing="2" fill={Y}>1 · ANTICIPO</text><text x="308" y="62" textAnchor="end" fontFamily={MONO} fontSize="11" letterSpacing="2" fill="rgba(255,255,255,0.6)">2 · AL RECIBIR</text><line x1="190" y1="-8" x2="190" y2="42" stroke="rgba(255,255,255,0.5)" strokeDasharray="3 4" /></g></svg>;
const Enchufe = () => <svg className="anim" viewBox="0 0 400 200" aria-hidden="true"><g transform="translate(200 100)"><circle r="66" fill="none" stroke="rgba(128,128,128,0.18)" strokeWidth="13" /><circle r="66" fill="none" stroke={Y} strokeWidth="13" strokeDasharray="110 310" strokeLinecap="round" style={{ transformBox: "fill-box", transformOrigin: "center", animation: "girar 3s linear infinite" }} /><text textAnchor="middle" y="9" fontFamily={MONO} fontSize="25" fontWeight="600" fill="currentColor">220 V</text></g></svg>;
const Seguimiento = () => <svg className="anim" viewBox="0 0 400 200" aria-hidden="true"><line x1="40" y1="100" x2="360" y2="100" stroke="rgba(255,255,255,0.22)" strokeWidth="2" /><line x1="40" y1="100" x2="360" y2="100" stroke={Y} strokeWidth="2" style={{ strokeDasharray: 320, animation: "trazo 5s ease-in-out infinite" }} />{[40, 120, 200, 280, 360].map((x, i) => <g key={x}><circle cx={x} cy="100" r="9" fill={K} stroke={Y} strokeWidth="2" style={{ animation: `tick 5s ${i * 0.8}s infinite` }} /><circle cx={x} cy="100" r="4" fill={Y} style={{ animation: `tick 5s ${i * 0.8}s infinite` }} /></g>)}</svg>;
const Respaldo = () => <svg className="anim" viewBox="0 0 400 200" aria-hidden="true"><g transform="translate(110 14)"><rect width="180" height="150" rx="14" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.2)" />{[0, 1, 2].map((i) => <g key={i} transform={`translate(22 ${26 + i * 40})`}><rect width="20" height="20" rx="6" fill="none" stroke={Y} /><path d="M5 10l4 4 7-8" fill="none" stroke={Y} strokeWidth="2.2" style={{ animation: `tick 2.4s ${i * 0.5}s infinite` }} /><rect x="34" y="5" width="100" height="10" rx="5" fill="rgba(255,255,255,0.22)" /></g>)}</g></svg>;

const TILDE = ["M5 12l5 5L20 7"];
const FLECHA = ["M5 12h14", "M13 6l6 6-6 6"];

// ── Gráfico de cada paso (lado derecho de la tarjeta) ─────────────────────────────────────
export function VisualPaso({ i, x, fotos }) {
  const v = x.vis[i];
  const cab = <div className="vpCab"><span className="pill"><i />{v.estado}</span></div>;
  if (i === 0) return <div className="vp">{cab}
    <div className="vpGrilla">{[0, 1, 2].map((k) => <div key={k} className={`vpMaq${k === 1 ? " on" : ""}`}>{fotos[k] ? <img src={fotos[k]} alt="" loading="lazy" /> : <span />}{k === 1 && <b className="vpTilde"><Ico d={TILDE} size={14} /></b>}</div>)}</div>
    <div className="vpFila ok"><Ico d={TILDE} size={15} />{v.filas[0]}</div>
  </div>;
  if (i === 1) return <div className="vp">{cab}
    {v.filas.map((f, k) => <div key={f} className="vpFila ok" style={{ animationDelay: `${k * 0.12}s` }}><Ico d={TILDE} size={15} />{f}<em>{v.incluido}</em></div>)}
    <div className="vpTotal"><span>{v.total}</span><b>{v.unico}</b></div>
  </div>;
  if (i === 2) return <div className="vp">{cab}
    <p className="vpLbl">{v.cuotas}</p>
    <div className="vpBarra"><i /><span>1</span><span>2</span></div>
    <div className="vpEtq"><b>{v.hoy}</b><span>{v.alRecibir}</span></div>
    <div className="vpFila ok"><Ico d={TILDE} size={15} />{v.filas[0]}</div>
    <div className="vpFila curso"><i className="punto" />{v.filas[1]}<em>{v.enCurso}</em></div>
  </div>;
  if (i === 3) return <div className="vp">{cab}
    <div className="vpRuta"><div><span>{v.origen}</span><b>China</b></div><div className="linea"><i /></div><div style={{ textAlign: "right" }}><span>{v.destino}</span><b>Buenos Aires</b></div></div>
    <div className="vpFila ok"><Ico d={TILDE} size={15} />{v.filas[0]}</div>
    <div className="vpFila curso"><i className="punto" />{v.filas[1]}<em>{v.enCurso}</em></div>
    <div className="vpFila"><i className="vacio" />{v.filas[2]}</div>
  </div>;
  return <div className="vp">{cab}
    <div className="vpFila ok"><Ico d={TILDE} size={15} />{v.filas[0]}</div>
    <div className="vpFila ok"><Ico d={TILDE} size={15} />{v.filas[1]}</div>
    <div className="vpFila curso"><i className="punto" />{v.filas[2]}<em>{v.enCurso}</em></div>
    <div className="vp220"><b>220 V</b><span>{v.lista}</span></div>
  </div>;
}

function TextoPaso({ i, x }) {
  const p = x.pasos[i];
  return <div className="hTexto">
    <div className="hNum"><b>0{i + 1}</b><span>{p.etiqueta}</span></div>
    <h3>{p.titulo}</h3>
    <p>{p.texto}</p>
    <ul>{p.items.map((t) => <li key={t}>{t}</li>)}</ul>
  </div>;
}

// Los pasos. En compu la sección queda fija mientras se desliza y la tarjeta cambia de paso;
// en celular se muestran las cinco tarjetas una debajo de la otra.
function Historia({ x, fotos }) {
  const ref = useRef(null);
  const [activo, setActivo] = useState(0);
  useEffect(() => {
    const medir = () => {
      const el = ref.current; if (!el || window.innerWidth <= 900) return;
      const r = el.getBoundingClientRect(); const tramo = r.height - window.innerHeight;
      const p = tramo > 0 ? Math.min(0.999, Math.max(0, -r.top / tramo)) : 0;
      setActivo(Math.floor(p * 5));
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true }); window.addEventListener("resize", medir);
    return () => { window.removeEventListener("scroll", medir); window.removeEventListener("resize", medir); };
  }, []);
  const irA = (i) => { const el = ref.current; if (!el) return; const tramo = el.offsetHeight - window.innerHeight; window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + tramo * ((i + 0.5) / 5), behavior: "smooth" }); };
  return <section className="historia" id="como">
    <div className="hScroll" ref={ref}>
      {[0, 1, 2, 3, 4].map((k) => <span key={k} className="hAncla" aria-hidden="true" style={{ top: `calc(${(k + 0.5) / 5} * 450vh)` }} />)}
      <div className="hSticky"><div className="wrap">
        <div className="hCabeza"><h2>{x.pasosT}</h2></div>
        {/* Compu: una tarjeta que cambia de paso */}
        <div className="hCard hSolo" key={activo}>
          <TextoPaso i={activo} x={x} />
          <div className="hVisual"><VisualPaso i={activo} x={x} fotos={fotos} /></div>
        </div>
        <div className="hLinea" role="tablist">{x.pasos.map((p, i) => <button key={p.etiqueta} role="tab" aria-selected={i === activo} className={i < activo ? "hecho" : i === activo ? "on" : ""} onClick={() => irA(i)}>
          <span className="c">{i < activo ? <Ico d={TILDE} size={16} /> : `0${i + 1}`}</span><span className="t">{p.etiqueta}</span>
        </button>)}</div>
        {/* Celular: las cinco tarjetas */}
        <div className="hLista">{x.pasos.map((p, i) => <div className="hCard" key={p.etiqueta}><TextoPaso i={i} x={x} /><div className="hVisual"><VisualPaso i={i} x={x} fotos={fotos} /></div></div>)}</div>
      </div></div>
    </div>
  </section>;
}

// Lo primero que se ve: una máquina real del catálogo como oferta (foto, precio final puesto en
// Argentina, las dos cuotas y la fecha aproximada de llegada). Rota sola entre varias.
function Oferta({ maquinas, precios, dv, x }) {
  const { fmt, lang } = useAM();
  const lista = maquinas.filter((m) => primeraFoto(m) && precioVidriera(precios?.[m.id])).slice(0, 6);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (lista.length < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((v) => (v + 1) % lista.length), 4800);
    return () => clearInterval(id);
  }, [lista.length]);
  const m = lista[i % (lista.length || 1)];
  if (!m) return <div className="oferta"><div className="ofCard ofVacia" /></div>;
  const pr = precios?.[m.id]; const pv = precioVidriera(pr);
  const tr = pr?.escalera?.maritima?.[0] || pr?.escalera?.aerea?.[0];
  const dias = pv?.via ? diasVia(pv.via, dv) + Number(pr?.dias_produccion ?? m.dias_produccion ?? 0) : null;
  const loc = lang === "en" ? "en-GB" : lang === "ru" ? "ru-RU" : "es-AR";
  const fecha = dias ? new Date(Date.now() + dias * 864e5).toLocaleDateString(loc, { day: "numeric", month: "long" }) : null;
  return <div className="oferta">
    <div className="ofFondo uno" /><div className="ofFondo dos" />
    <a className="ofCard" key={m.id} href={`/m/${m.id}`}>
      <div className="ofFoto"><img src={primeraFoto(m)} alt={m.nombre} /><span className="ofTag">{x.of.tag}</span></div>
      <div className="ofCuerpo">
        <p className="ofNom">{m.nombre}</p>
        <div className="ofPrecio"><b>{fmt(pv.unit)}</b><span>{x.of.puesto}</span></div>
        {tr && <div className="ofCuotas"><div><small>{x.of.c1}</small><b>{fmt(tr.maquina)}</b></div><div><small>{x.of.c2}</small><b>{fmt(tr.argencargo)}</b></div></div>}
        {fecha && <p className="ofLlega"><i />{x.of.llega} {fecha}</p>}
      </div>
    </a>
    {lista.length > 1 && <div className="ofPuntos">{lista.map((mm, k) => <button key={mm.id} className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={mm.nombre} />)}</div>}
  </div>;
}

// Estilos de los gráficos de cada paso: los usan la landing y Cómo funciona.
export const CSS_VP = `
.amq .vp{width:100%;display:grid;gap:10px}
.amq .vpCab{display:flex;justify-content:flex-end;margin-bottom:4px}
.amq .vp .pill{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid #3A3D42;font-size:13px;font-weight:700;color:var(--y)}
.amq .vp .pill i{width:7px;height:7px;border-radius:50%;background:var(--y);animation:pulso 1.6s infinite}
.amq .vpFila{display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:14px;background:#24272B;border:1px solid #2F3237;font-size:14.5px;font-weight:600;color:#E4E6E8;animation:hFila 500ms both}
.amq .vpFila svg{color:#7BD88F;flex-shrink:0}
.amq .vpFila em{margin-left:auto;font-style:normal;font-family:${MONO};font-size:11px;letter-spacing:0.1em;color:var(--y)}
.amq .vpFila.curso{border-color:rgba(255,210,0,0.45)}
.amq .vpFila .punto{width:9px;height:9px;border-radius:50%;background:var(--y);flex-shrink:0;animation:pulso 1.6s infinite}
.amq .vpFila .vacio{width:9px;height:9px;border-radius:50%;border:1.5px solid #5B6066;flex-shrink:0}
.amq .vpFila:not(.ok):not(.curso){color:#7E848A}
.amq .vpGrilla{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.amq .vpMaq{position:relative;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#2B2E33;border:2px solid transparent;opacity:0.55}
.amq .vpMaq img{width:100%;height:100%;object-fit:cover;display:block}
.amq .vpMaq.on{border-color:var(--y);opacity:1;animation:hElige 600ms 200ms both}
.amq .vpTilde{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:var(--y);color:#15171A;display:flex;align-items:center;justify-content:center}
.amq .vpTotal{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-radius:14px;background:var(--y);color:#15171A;margin-top:4px}
.amq .vpTotal span{font-family:${MONO};font-size:11.5px;letter-spacing:0.1em;font-weight:600}
.amq .vpTotal b{font-size:18px;letter-spacing:-0.01em}
.amq .vpLbl{margin:0;font-family:${MONO};font-size:11px;letter-spacing:0.12em;color:#9DA3A9}
.amq .vpBarra{position:relative;height:40px;border-radius:999px;background:#2B2E33;overflow:hidden;display:grid;grid-template-columns:57% 43%}
.amq .vpBarra i{position:absolute;inset:0 43% 0 0;background:var(--y);border-radius:999px;transform-origin:left;animation:hLlena 900ms 200ms both}
.amq .vpBarra span{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;font-family:${MONO};font-weight:700;font-size:13px}
.amq .vpBarra span:first-of-type{color:#15171A}.amq .vpBarra span:last-of-type{color:#9DA3A9}
.amq .vpEtq{display:grid;grid-template-columns:57% 43%;font-size:13px;margin-bottom:4px}
.amq .vpEtq b{color:var(--y)}.amq .vpEtq span{color:#9DA3A9;text-align:center}
.amq .vpRuta{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;padding:16px 18px;border-radius:14px;background:#24272B;border:1px solid #2F3237}
.amq .vpRuta span{display:block;font-family:${MONO};font-size:10.5px;letter-spacing:0.12em;color:#9DA3A9}
.amq .vpRuta b{font-size:16px}
.amq .vpRuta .linea{position:relative;height:2px;background:repeating-linear-gradient(90deg,#5B6066 0 6px,transparent 6px 12px)}
.amq .vpRuta .linea i{position:absolute;top:-5px;left:0;width:12px;height:12px;border-radius:50%;background:var(--y);box-shadow:0 0 0 5px rgba(255,210,0,0.2);animation:hBarco 3.2s ease-in-out infinite alternate}
.amq .vp220{display:flex;align-items:center;justify-content:space-between;padding:18px;border-radius:14px;border:1px dashed rgba(255,210,0,0.5)}
.amq .vp220 b{font-family:${MONO};font-size:28px;color:var(--y)}
.amq .vp220 span{font-size:14px;color:#E4E6E8;font-weight:700}
@keyframes hFila{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
@keyframes hLlena{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes hElige{0%{transform:scale(0.94)}60%{transform:scale(1.04)}100%{transform:scale(1)}}
@keyframes hBarco{from{left:0}to{left:calc(100% - 12px)}}
`;

const CSS = `
/* Hero */
.amq .hero{padding:56px 0 20px}
.amq .heroGrid{display:grid;grid-template-columns:1.08fr 0.92fr;gap:56px;align-items:center}
.amq .hero h1{font-size:clamp(40px,5.4vw,80px);line-height:0.98;letter-spacing:-0.05em;font-weight:800;margin:0}
.amq .hero p.sub{font-size:19px;color:var(--gris);max-width:540px;margin:24px 0 32px;line-height:1.55}
.amq .ctaCat{display:inline-flex;align-items:center;gap:18px;height:64px;padding:0 9px 0 30px;border-radius:999px;background:var(--y);color:#15171A;font-weight:800;font-size:17.5px;box-shadow:0 14px 34px rgba(255,210,0,0.35);transition:transform 140ms,box-shadow 140ms}
.amq .ctaCat:hover{transform:translateY(-2px);box-shadow:0 18px 40px rgba(255,210,0,0.45)}
.amq .ctaCat .flechaC{width:46px;height:46px;border-radius:50%;background:#15171A;color:var(--y);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.amq .oferta{position:relative;max-width:440px;margin-left:auto;width:100%;padding:14px 0 30px}
.amq .ofFondo{position:absolute;inset:14px 0 30px;border-radius:28px;background:var(--suave);border:1px solid var(--borde)}
.amq .ofFondo.uno{transform:rotate(-5deg) translate(-16px,8px)}.amq .ofFondo.dos{transform:rotate(3deg) translate(14px,4px);background:var(--ysuave);border-color:var(--y)}
.amq .ofCard{position:relative;display:block;border-radius:28px;overflow:hidden;background:var(--card);border:1px solid var(--borde);box-shadow:0 30px 60px rgba(0,0,0,0.14);animation:ofEntra 520ms cubic-bezier(.2,.8,.2,1)}
.amq .ofVacia{height:520px}
.amq .ofFoto{position:relative;aspect-ratio:4/3;background:#fff}
.amq .ofFoto img{width:100%;height:100%;object-fit:contain;display:block}
.amq .ofTag{position:absolute;top:14px;left:14px;font-family:${MONO};font-size:10.5px;letter-spacing:0.1em;padding:6px 10px;border-radius:999px;background:#15171A;color:var(--y);font-weight:600}
.amq .ofCuerpo{padding:18px 22px 22px;border-top:1px solid var(--borde)}
.amq .ofNom{margin:0;font-size:15px;font-weight:700;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.amq .ofPrecio{display:flex;align-items:baseline;gap:10px;margin-top:10px}
.amq .ofPrecio b{font-size:32px;letter-spacing:-0.03em}
.amq .ofPrecio span{font-size:12.5px;color:var(--gris);font-weight:600}
.amq .ofCuotas{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.amq .ofCuotas div{padding:10px 12px;border-radius:14px;background:var(--suave)}
.amq .ofCuotas div:first-child{background:var(--ysuave);box-shadow:inset 0 0 0 1px var(--y)}
.amq .ofCuotas small{display:block;font-family:${MONO};font-size:10px;letter-spacing:0.08em;color:var(--gris);text-transform:uppercase}
.amq .ofCuotas b{display:block;font-size:16px;margin-top:3px}
.amq .ofLlega{display:flex;align-items:center;gap:8px;margin:14px 0 0;font-size:13.5px;font-weight:700}
.amq .ofLlega i{width:8px;height:8px;border-radius:50%;background:#1F7A2E;box-shadow:0 0 0 4px rgba(31,122,46,0.15)}
.amq .ofPuntos{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:center;gap:7px}
.amq .ofPuntos button{width:8px;height:8px;border-radius:999px;border:none;padding:0;background:var(--borde);cursor:pointer;transition:width 240ms,background 240ms}
.amq .ofPuntos button.on{width:24px;background:var(--ink)}
@keyframes ofEntra{from{opacity:0;transform:translateY(12px) scale(0.98)}to{opacity:1;transform:none}}

/* Pasos al estilo Shippar */
.amq .historia{background:var(--y);color:#15171A;margin-top:64px}
.amq .hScroll{position:relative;height:calc(100vh + 5 * 90vh)}
.amq .hAncla{position:absolute;left:0;width:1px;height:1px;scroll-snap-align:start;pointer-events:none}
@media(min-width:901px){html:has(.hScroll){scroll-snap-type:y proximity}}
.amq .hSticky{position:sticky;top:0;height:100vh;display:flex;align-items:center;padding:92px 0 22px}
.amq .hSticky>.wrap{width:100%}
.amq .hCabeza{text-align:center;margin-bottom:22px}
.amq .hCabeza h2{font-size:clamp(28px,3.4vw,46px);letter-spacing:-0.04em;line-height:1.02;margin:0}
.amq .hCabeza p{margin:10px 0 0;font-size:16.5px;color:rgba(21,23,26,0.72)}
.amq .hCard{display:grid;grid-template-columns:1fr 1fr;background:#15171A;color:#fff;border-radius:28px;overflow:hidden;min-height:clamp(330px,46vh,440px);box-shadow:0 30px 60px rgba(21,23,26,0.25)}
.amq .hSolo{height:clamp(380px,calc(100vh - 380px),470px);min-height:0;animation:hEntra 420ms cubic-bezier(.2,.8,.2,1)}
.amq .hTexto{padding:clamp(26px,3.4vw,46px);display:flex;flex-direction:column;justify-content:center}
.amq .hNum{display:flex;align-items:baseline;gap:14px;margin-bottom:16px}
.amq .hNum b{font-size:clamp(40px,4vw,56px);line-height:1;color:var(--y);letter-spacing:-0.04em}
.amq .hNum span{font-family:${MONO};font-size:12.5px;letter-spacing:0.14em;text-transform:uppercase;color:var(--y);font-weight:600}
.amq .hTexto h3{margin:0;font-size:clamp(22px,2.2vw,30px);letter-spacing:-0.025em;line-height:1.15}
.amq .hTexto p{margin:14px 0 0;color:#B9BEC4;font-size:16px;line-height:1.6;max-width:500px}
.amq .hTexto ul{list-style:none;padding:0;margin:20px 0 0;display:grid;gap:10px}
.amq .hTexto li{display:flex;align-items:center;gap:12px;font-size:15px;color:#E4E6E8}
.amq .hTexto li:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--y);flex-shrink:0}
.amq .hVisual{background:#1C1E21;border-left:1px solid #2B2E33;padding:clamp(22px,2.6vw,34px);display:flex;align-items:center}
${CSS_VP}
.amq .hLinea{display:grid;grid-template-columns:repeat(5,1fr);margin-top:24px;position:relative}
.amq .hLinea button{position:relative;background:none;border:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;color:#15171A;font-family:inherit}
.amq .hLinea button:not(:last-child):after{content:"";position:absolute;top:20px;left:calc(50% + 28px);right:calc(-50% + 28px);height:2px;background:rgba(21,23,26,0.2)}
.amq .hLinea button.hecho:after{background:#15171A}
.amq .hLinea .c{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:${MONO};font-size:13px;font-weight:700;border:2px solid rgba(21,23,26,0.25);color:rgba(21,23,26,0.5);transition:all 240ms}
.amq .hLinea .hecho .c{background:#15171A;border-color:#15171A;color:var(--y)}
.amq .hLinea .on .c{background:#fff;border-color:#15171A;color:#15171A;transform:scale(1.1)}
.amq .hLinea .t{font-size:13.5px;font-weight:700;opacity:0.5;transition:opacity 240ms}
.amq .hLinea .on .t,.amq .hLinea .hecho .t{opacity:1}
.amq .hLista{display:none}

/* Catálogo */
.amq .catHome{padding:64px 0 10px}
.amq .catHome .cab{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:18px}
.amq .verTodo{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:12px;border-radius:20px;background:#15171A;color:#fff;text-align:center;padding:20px;min-height:100%;font-weight:800;font-size:17px;transition:transform 140ms}
.amq .verTodo:hover{transform:translateY(-2px)}
.amq .verTodo .flechaC{width:54px;height:54px;border-radius:50%;background:var(--y);color:#15171A;display:flex;align-items:center;justify-content:center}
.amq .verTodo small{font-family:${MONO};font-size:12px;color:#9DA3A9;font-weight:600}

/* Por qué ARGENMAQ */
.amq .bento{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:260px;gap:14px}
.amq .bc{position:relative;border-radius:24px;overflow:hidden;background:#15171A;color:#fff;padding:22px 24px;display:flex;flex-direction:column;justify-content:flex-end;isolation:isolate}
.amq .bc.ancha{grid-column:span 2}.amq .bc.clara{background:var(--suave);color:var(--ink);border:1px solid var(--borde)}
.amq .bc .tag2{position:absolute;top:20px;left:24px;font-size:15px;font-weight:700;border-bottom:2px solid var(--y);padding-bottom:3px}
.amq .bc .lug{font-family:${MONO};font-size:11px;letter-spacing:0.12em;opacity:0.6;margin-bottom:6px}
.amq .bc h3{margin:0;font-size:23px;letter-spacing:-0.02em;line-height:1.15}
.amq .bc p{margin:8px 0 0;font-size:14.5px;opacity:0.75;line-height:1.5;max-width:420px}
.amq .bc .anim{position:absolute;left:0;right:0;top:44px;height:56%;width:100%;z-index:-1;opacity:0.6}
.amq .bc .grilla{position:absolute;inset:0;z-index:-1;background-image:linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px);background-size:34px 34px}

/* Parte del grupo Argencargo */
.amq .argBanda{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:40px;align-items:center;padding:32px 40px;border-radius:26px;border:1px solid var(--borde);background:var(--suave)}
.amq .argBanda .logo{display:flex;align-items:center;justify-content:center;padding-right:40px;border-right:1px solid var(--borde)}
.amq .argBanda .logo img{width:170px;height:auto;display:block}
.amq .argBanda .logo img.oscuro{display:none}.amq[data-tema="oscuro"] .argBanda .logo img.oscuro{display:block}.amq[data-tema="oscuro"] .argBanda .logo img.claro{display:none}
.amq .argBanda .lbl{margin-bottom:6px}
.amq .argBanda h3{margin:0 0 8px;font-size:22px;letter-spacing:-0.02em}
.amq .argBanda p{margin:0;font-size:15.5px;line-height:1.55;color:var(--gris);max-width:640px}
.amq .argBanda .acc{display:grid;gap:8px}
/* ¿No encontrás tu máquina? */
.amq .busca{display:grid;grid-template-columns:1.3fr 1fr;gap:28px;align-items:center;background:#15171A;color:#fff;border-radius:30px;padding:46px 44px}
.amq .busca h2{font-size:clamp(28px,3.8vw,46px);letter-spacing:-0.04em;line-height:1.02;margin:0}
.amq .busca h2 span{color:var(--y)}
.amq .busca p{color:#B9BEC4;font-size:17px;line-height:1.5;margin:14px 0 0;max-width:480px}
.amq .busca .acc{display:grid;gap:10px}
.amq .busca .acc .btn{height:54px;font-size:15.5px}
.amq .busca .rep{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;border-radius:16px;border:1px solid #2B2E33;color:#fff;font-weight:700;font-size:14.5px}
.amq .busca .rep:hover{border-color:var(--y)}
.amq .finLanding~footer{margin-top:0}

@keyframes llenarDos{0%{transform:scaleX(0)}45%,100%{transform:scaleX(0.59)}}
@keyframes trazo{0%{stroke-dashoffset:320}70%,100%{stroke-dashoffset:0}}
@keyframes hEntra{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

@media(max-width:1100px){.amq .hTexto p{font-size:15px}.amq .hTexto ul{gap:7px}}
@media(max-width:900px){
  .amq .hero{padding:26px 0 0}.amq .heroGrid{grid-template-columns:1fr;gap:30px}.amq .hero p.sub{font-size:16.5px;margin:16px 0 22px}
  .amq .ctaCat{height:58px;font-size:16px;padding:0 8px 0 24px;gap:12px}.amq .ctaCat .flechaC{width:42px;height:42px}
  .amq .oferta{margin:0 auto;max-width:400px}.amq .ofPrecio b{font-size:28px}
  .amq .historia{margin-top:40px;padding:36px 0 30px}
  .amq .hScroll{height:auto}.amq .hSticky{position:static;height:auto;padding:0}
  .amq .hSolo,.amq .hLinea{display:none}
  .amq .hLista{display:grid;gap:14px}
  .amq .hCard{grid-template-columns:1fr;min-height:0;border-radius:22px}
  .amq .hVisual{border-left:none;border-top:1px solid #2B2E33}
  .amq .hCabeza{text-align:left}
  .amq .bento{grid-template-columns:1fr 1fr;grid-auto-rows:230px}
  .amq .busca{grid-template-columns:1fr;padding:32px 24px}
  .amq .argBanda{grid-template-columns:minmax(0,1fr);gap:20px;padding:26px 22px;text-align:center}
  .amq .argBanda .logo{padding:0 0 20px;border-right:none;border-bottom:1px solid var(--borde)}.amq .argBanda .logo img{width:150px}
  .amq .argBanda p{max-width:none}.amq .argBanda .acc{grid-template-columns:minmax(0,1fr)}.amq .argBanda .acc .btn{white-space:normal}
}
@media(max-width:600px){
  .amq .bento{grid-template-columns:1fr;grid-auto-rows:220px;gap:10px}
  .amq .bento .bc.ancha{grid-column:span 1}.amq .bc{padding:20px}.amq .bc h3{font-size:21px}
  .amq .vpGrilla{gap:8px}
}
@media(prefers-reduced-motion:reduce){.amq .bc .anim *,.amq .hSolo,.amq .vpFila,.amq .vpBarra i,.amq .vpMaq.on,.amq .vpRuta .linea i{animation:none!important}}
`;

export const TXT_LANDING = {
  es: {
    h1a: "Maquinaria de China,", h1b: "puesta en tu negocio.",
    sub: "Importación llave en mano: elegís la máquina, ves el precio final y nosotros nos encargamos de la fábrica, la aduana y la entrega.",
    cta: "Ver catálogo", maquinas: "máquinas",
    of: { tag: "PRECIO FINAL EN ARGENTINA", puesto: "puesta en CABA", c1: "1ª cuota · hoy", c2: "2ª cuota · al recibir", llega: "Llega aprox." },
    pasosT: "Una sola operación, de la fábrica en China a tu negocio.",
    pasos: [
      { etiqueta: "Elegís tu máquina", titulo: "Encontrás la máquina para tu oficio", texto: "Recorrés el catálogo con fotos, ficha técnica y video. Si no está, nos decís cuál buscás y la conseguimos.", items: ["Fotos, video y ficha técnica", "Más de 15 rubros", "Máquinas a pedido"] },
      { etiqueta: "Ves el precio final", titulo: "Un solo número, puesto en Argentina", texto: "El precio incluye la máquina, el flete, la aduana y la entrega en nuestro depósito de CABA. Sin costos escondidos.", items: ["Máquina, flete y aduana", "En dólares o en pesos", "Mejor precio por cantidad"] },
      { etiqueta: "Confirmás con el anticipo", titulo: "Con la primera cuota, la fábrica arranca", texto: "Pagás el anticipo, que es el precio de la máquina, y la fábrica la produce. Desde ese momento ves la fecha estimada de llegada en tu cuenta.", items: ["Primera cuota al confirmar", "24 horas para arrepentirte", "Fecha estimada de llegada"] },
      { etiqueta: "Viaja a Argentina", titulo: "Nos ocupamos de toda la importación", texto: "Flete, seguro y aduana corren por nuestra cuenta. Seguís cada paso desde tu cuenta y te avisamos en cada etapa.", items: ["Seguimiento online", "Aviso en cada etapa", "Despacho de aduana incluido"] },
      { etiqueta: "La recibís lista", titulo: "Pagás el saldo y la ponés a trabajar", texto: "Cuando llega a Buenos Aires pagás la segunda cuota. La retirás sin cargo o te la enviamos a todo el país.", items: ["Segunda cuota al recibir", "Retiro sin cargo en CABA", "Envío a todo el país"] },
    ],
    vis: [
      { estado: "Máquina elegida", filas: ["Agregada al carrito"] },
      { estado: "Precio final", filas: ["Máquina en fábrica", "Flete internacional", "Aduana e impuestos", "Entrega en CABA"], incluido: "INCLUIDO", total: "PRECIO FINAL", unico: "Un solo número" },
      { estado: "En producción", cuotas: "DOS CUOTAS", hoy: "Anticipo · hoy", alRecibir: "Saldo · al recibir", filas: ["Anticipo acreditado", "Producción en fábrica"], enCurso: "EN CURSO" },
      { estado: "En viaje", origen: "ORIGEN", destino: "DESTINO", filas: ["Embarcada en China", "En tránsito", "Aduana y entrega"], enCurso: "EN CURSO" },
      { estado: "Entregada", filas: ["Llegó a Buenos Aires", "Saldo pagado", "Retiro o envío a tu taller"], enCurso: "HOY", lista: "Lista para trabajar" },
    ],
    catT: "Catálogo de productos", catS: "Precio final puesto en nuestro depósito de CABA.", verTodo: "Ver catálogo completo",
    porQue: "Por qué ARGENMAQ",
    arg: { k: "PARTE DEL GRUPO ARGENCARGO", t: "Detrás de ARGENMAQ está Argencargo.", p: "Argencargo es una empresa de logística internacional y despacho de aduana con base en Buenos Aires: coordina el flete, el seguro y la aduana de cada importación. ARGENMAQ es su división de maquinaria, así que tu máquina viaja con un equipo que se dedica a esto.", ops: "Ya son más de {n} operaciones.", b1: "Conocer Argencargo", b2: "Quiénes somos" },
    b: { precio: ["Precio final", "PUESTO EN CABA", "Máquina, flete y aduana en un solo número."], dos: ["Pagás en dos cuotas", "ANTICIPO + SALDO", "La segunda cuota, cuando llega."], v220: ["Lista para usar", "220 V · 50 HZ", "Todas se importan a 220 V. Llegan listas para usar."], seg: ["Seguimiento", "PRODUCCIÓN → EMBARQUE → ADUANA → ENTREGA", "Sabés dónde está tu máquina."], resp: ["Respaldo", "ARGENMAQ SIEMPRE PRESENTE", "Si algo pasa, hablás con nosotros, no con la fábrica."] },
    buscaT: ["¿No encontrás la máquina", "que buscás?"], buscaP: "Te la conseguimos. Contanos qué necesitás y te pasamos el precio final puesta en Argentina.",
    buscaB: "Pedila por WhatsApp", buscaWa: "Hola ARGENMAQ, estoy buscando una máquina que no está en el catálogo", rep: "¿Buscás un repuesto?",
  },
  en: {
    h1a: "Machinery from China,", h1b: "delivered to your business.",
    sub: "Turnkey import: you pick the machine, see the final price, and we handle the factory, customs and delivery.",
    cta: "See catalog", maquinas: "machines",
    of: { tag: "FINAL PRICE IN ARGENTINA", puesto: "landed in Buenos Aires", c1: "1st instalment · today", c2: "2nd · on delivery", llega: "Arrives approx." },
    pasosT: "One operation, from the factory in China to your business.",
    pasos: [
      { etiqueta: "Pick your machine", titulo: "Find the machine for your trade", texto: "Browse the catalog with photos, specs and video. If it's not there, tell us what you need and we'll source it.", items: ["Photos, video and specs", "Over 15 trades", "Machines on request"] },
      { etiqueta: "See the final price", titulo: "One number, landed in Argentina", texto: "The price includes the machine, freight, customs and delivery to our Buenos Aires warehouse. No hidden costs.", items: ["Machine, freight and customs", "In dollars or pesos", "Better price by quantity"] },
      { etiqueta: "Confirm with a deposit", titulo: "The first instalment starts the factory", texto: "You pay the deposit, which is the machine price, and the factory builds it. From then on you see the estimated arrival date in your account.", items: ["First instalment on confirmation", "24 hours to change your mind", "Estimated arrival date"] },
      { etiqueta: "It ships to Argentina", titulo: "We handle the whole import", texto: "Freight, insurance and customs are on us. Follow every step from your account; we notify you at each stage.", items: ["Online tracking", "Updates at every stage", "Customs clearance included"] },
      { etiqueta: "You get it ready", titulo: "Pay the balance and put it to work", texto: "When it reaches Buenos Aires you pay the second instalment. Pick it up free of charge or we ship nationwide.", items: ["Second instalment on delivery", "Free pickup in Buenos Aires", "Nationwide shipping"] },
    ],
    vis: [
      { estado: "Machine selected", filas: ["Added to cart"] },
      { estado: "Final price", filas: ["Machine at factory", "International freight", "Customs and taxes", "Delivery in Buenos Aires"], incluido: "INCLUDED", total: "FINAL PRICE", unico: "One number" },
      { estado: "In production", cuotas: "TWO INSTALMENTS", hoy: "Deposit · today", alRecibir: "Balance · on delivery", filas: ["Deposit received", "Factory production"], enCurso: "IN PROGRESS" },
      { estado: "In transit", origen: "ORIGIN", destino: "DESTINATION", filas: ["Shipped from China", "In transit", "Customs and delivery"], enCurso: "IN PROGRESS" },
      { estado: "Delivered", filas: ["Arrived in Buenos Aires", "Balance paid", "Pickup or delivery"], enCurso: "TODAY", lista: "Ready to work" },
    ],
    catT: "Product catalog", catS: "Final price delivered to our Buenos Aires warehouse.", verTodo: "See full catalog",
    porQue: "Why ARGENMAQ",
    arg: { k: "PART OF THE ARGENCARGO GROUP", t: "Argencargo is behind ARGENMAQ.", p: "Argencargo is an international freight forwarding and customs brokerage company based in Buenos Aires: it handles freight, insurance and customs for every import. ARGENMAQ is its machinery division, so your machine travels with a team that does this for a living.", ops: "Over {n} operations so far.", b1: "About Argencargo", b2: "About us" },
    b: { precio: ["Final price", "LANDED IN BUENOS AIRES", "Machine, freight and customs in one number."], dos: ["Two instalments", "DEPOSIT + BALANCE", "The second one, when it arrives."], v220: ["Ready to use", "220 V · 50 HZ", "Every machine is imported at 220 V. Ready to use."], seg: ["Tracking", "PRODUCTION → SHIPPING → CUSTOMS → DELIVERY", "You know where your machine is."], resp: ["Backing", "ARGENMAQ ALWAYS THERE", "If anything happens, you talk to us, not the factory."] },
    buscaT: ["Can't find the machine", "you need?"], buscaP: "We'll source it. Tell us what you need and we'll send you the final landed price in Argentina.",
    buscaB: "Ask on WhatsApp", buscaWa: "Hi ARGENMAQ, I'm looking for a machine that isn't in the catalog", rep: "Looking for a spare part?",
  },
  ru: {
    h1a: "Оборудование из Китая —", h1b: "прямо в ваш бизнес.",
    sub: "Импорт под ключ: вы выбираете машину, видите итоговую цену, а завод, таможню и доставку берём на себя.",
    cta: "Каталог", maquinas: "машин",
    of: { tag: "ИТОГОВАЯ ЦЕНА В АРГЕНТИНЕ", puesto: "в Буэнос-Айресе", c1: "1-й платёж · сегодня", c2: "2-й · при получении", llega: "Прибытие ≈" },
    pasosT: "Одна операция: с завода в Китае в ваш бизнес.",
    pasos: [
      { etiqueta: "Выбираете машину", titulo: "Найдите машину для вашего дела", texto: "Каталог с фото, характеристиками и видео. Если нужной нет — скажите, и мы её найдём.", items: ["Фото, видео и характеристики", "Более 15 отраслей", "Машины под заказ"] },
      { etiqueta: "Видите итоговую цену", titulo: "Одна цифра с доставкой в Аргентину", texto: "В цену входят машина, фрахт, таможня и доставка на наш склад в Буэнос-Айресе. Без скрытых расходов.", items: ["Машина, фрахт и таможня", "В долларах или песо", "Дешевле при объёме"] },
      { etiqueta: "Вносите аванс", titulo: "Первый платёж — и завод начинает", texto: "Вы платите аванс — это цена машины, — и завод её производит. С этого момента в аккаунте видна ориентировочная дата прибытия.", items: ["Первый платёж при подтверждении", "24 часа на отказ", "Ориентировочная дата прибытия"] },
      { etiqueta: "Едет в Аргентину", titulo: "Весь импорт — на нас", texto: "Фрахт, страховка и таможня — наша забота. Следите за каждым этапом в аккаунте.", items: ["Онлайн-отслеживание", "Уведомления на каждом этапе", "Таможня включена"] },
      { etiqueta: "Получаете готовой", titulo: "Платите остаток и запускаете", texto: "По прибытии в Буэнос-Айрес вносите второй платёж. Самовывоз бесплатно или доставка по стране.", items: ["Второй платёж при получении", "Бесплатный самовывоз", "Доставка по стране"] },
    ],
    vis: [
      { estado: "Машина выбрана", filas: ["Добавлена в корзину"] },
      { estado: "Итоговая цена", filas: ["Машина на заводе", "Международный фрахт", "Таможня и налоги", "Доставка в Буэнос-Айрес"], incluido: "ВКЛЮЧЕНО", total: "ИТОГО", unico: "Одна цифра" },
      { estado: "В производстве", cuotas: "ДВА ПЛАТЕЖА", hoy: "Аванс · сегодня", alRecibir: "Остаток · при получении", filas: ["Аванс получен", "Производство"], enCurso: "ИДЁТ" },
      { estado: "В пути", origen: "ОТКУДА", destino: "КУДА", filas: ["Отгружено из Китая", "В пути", "Таможня и доставка"], enCurso: "ИДЁТ" },
      { estado: "Доставлено", filas: ["Прибыла в Буэнос-Айрес", "Остаток оплачен", "Самовывоз или доставка"], enCurso: "СЕГОДНЯ", lista: "Готова к работе" },
    ],
    catT: "Каталог товаров", catS: "Итоговая цена с доставкой на наш склад в Буэнос-Айресе.", verTodo: "Весь каталог",
    porQue: "Почему ARGENMAQ",
    arg: { k: "ЧАСТЬ ГРУППЫ ARGENCARGO", t: "За ARGENMAQ стоит Argencargo.", p: "Argencargo — компания международной логистики и таможенного оформления из Буэнос-Айреса: фрахт, страховка и таможня для каждого импорта. ARGENMAQ — её подразделение по оборудованию.", ops: "Уже более {n} операций.", b1: "Об Argencargo", b2: "О нас" },
    b: { precio: ["Итоговая цена", "НА СКЛАДЕ В БУЭНОС-АЙРЕСЕ", "Машина, фрахт и таможня — одна цифра."], dos: ["Два платежа", "АВАНС + ОСТАТОК", "Второй — по прибытии."], v220: ["Готова к работе", "220 В · 50 ГЦ", "Все машины — на 220 В."], seg: ["Отслеживание", "ПРОИЗВОДСТВО → ОТГРУЗКА → ТАМОЖНЯ → ДОСТАВКА", "Вы знаете, где ваша машина."], resp: ["Поддержка", "ARGENMAQ ВСЕГДА РЯДОМ", "Если что-то случится, вы говорите с нами, а не с заводом."] },
    buscaT: ["Не нашли нужную", "машину?"], buscaP: "Найдём. Расскажите, что нужно, и мы назовём итоговую цену с доставкой в Аргентину.",
    buscaB: "Написать в WhatsApp", buscaWa: "Здравствуйте, ARGENMAQ! Ищу машину, которой нет в каталоге", rep: "Ищете запчасть?",
  },
};

export default function Landing({ destacadas, total, diasVia, ops }) {
  const { lang } = useAM();
  const x = TXT_LANDING[lang] || TXT_LANDING.es;
  const precios = usePrecios(destacadas.map((m) => m.id));
  const fotos = destacadas.map(primeraFoto).filter(Boolean);
  const b = x.b;
  return <Marco actual="inicio" conGrupo>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="hero"><div className="wrap heroGrid">
      <div>
        <h1>{x.h1a}<br /><span className="ac">{x.h1b}</span></h1>
        <p className="sub">{x.sub}</p>
        <a className="ctaCat" href="/catalogo"><span>{x.cta}</span><span className="flechaC"><Ico d={FLECHA} size={20} /></span></a>
      </div>
      <Oferta maquinas={destacadas} precios={precios} dv={diasVia} x={x} />
    </div></section>

    <Historia x={x} fotos={fotos} />

    <section className="catHome"><div className="wrap">
      <div className="cab"><div><h2 className="h2">{x.catT}</h2><p style={{ color: "var(--gris)", fontSize: 15, margin: "8px 0 0" }}>{x.catS}</p></div></div>
      {destacadas.length > 0 && <div className="carril">
        {destacadas.map((m) => <Tarjeta key={m.id} m={m} precios={precios} diasVia={diasVia} />)}
        <a className="verTodo" href="/catalogo"><span className="flechaC"><Ico d={FLECHA} size={22} /></span>{x.verTodo}{total > 0 && <small>{total} {x.maquinas}</small>}</a>
      </div>}
    </div></section>

    <section style={{ padding: "54px 0 46px" }}><div className="wrap">
      <h2 className="h2" style={{ marginBottom: 20 }}>{x.porQue}</h2>
      <div className="bento">
        <div className="bc ancha"><Barras /><span className="tag2">{b.precio[0]}</span><div className="lug">{b.precio[1]}</div><h3>{b.precio[2]}</h3></div>
        <div className="bc"><DosCuotas /><span className="tag2">{b.dos[0]}</span><div className="lug">{b.dos[1]}</div><h3>{b.dos[2]}</h3></div>
        <div className="bc clara"><Enchufe /><span className="tag2">{b.v220[0]}</span><div className="lug" style={{ opacity: 0.7 }}>{b.v220[1]}</div><h3>{b.v220[2]}</h3></div>
        <div className="bc"><Seguimiento /><span className="tag2">{b.seg[0]}</span><div className="lug">{b.seg[1]}</div><h3>{b.seg[2]}</h3></div>
        <div className="bc"><Respaldo /><span className="tag2">{b.resp[0]}</span><div className="lug">{b.resp[1]}</div><h3>{b.resp[2]}</h3></div>
      </div>
    </div></section>

    <section style={{ padding: "0 0 40px" }}><div className="wrap"><div className="argBanda">
      <a className="logo" href="https://www.argencargo.com.ar" target="_blank" rel="noopener noreferrer" aria-label="Argencargo">
        <img className="claro" src="/argencargo/logo-apilado.png" alt="Argencargo" />
        <img className="oscuro" src="/argencargo/logo-apilado-blanco.png" alt="Argencargo" />
      </a>
      <div className="txt">
        <p className="lbl">{x.arg.k}</p>
        <h3>{x.arg.t}</h3>
        <p>{x.arg.p}{ops ? ` ${x.arg.ops.replace("{n}", ops.toLocaleString("es-AR"))}` : ""}</p>
      </div>
      <div className="acc">
        <a className="btn k" href="https://www.argencargo.com.ar" target="_blank" rel="noopener noreferrer">{x.arg.b1} ↗</a>
        <a className="btn" href="/quienes-somos">{x.arg.b2}</a>
      </div>
    </div></div></section>

    <section className="finLanding" style={{ padding: "0 0 30px" }}><div className="wrap"><div className="busca">
      <div><h2>{x.buscaT[0]} <span>{x.buscaT[1]}</span></h2><p>{x.buscaP}</p></div>
      <div className="acc">
        <a className="btn y" href={WA(x.buscaWa)} target="_blank" rel="noreferrer">{x.buscaB}</a>
        <a className="rep" href="/repuestos"><span>{x.rep}</span><span aria-hidden="true">→</span></a>
      </div>
    </div></div></section>
  </Marco>;
}
