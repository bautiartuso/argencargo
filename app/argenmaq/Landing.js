"use client";

const Y = "#FFD200", INK = "#15171A", GRIS = "#6B7075", BORDE = "#E6E7EA", SUAVE = "#F4F5F7";
const MONO = "'JetBrains Mono',ui-monospace,Menlo,monospace";
const WA = "https://wa.me/5491125088580?text=Hola%20ARGENMAQ%2C%20quiero%20cotizar%20una%20m%C3%A1quina";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
.am{font-family:'Manrope',ui-sans-serif,system-ui,sans-serif;color:${INK};background:#fff;-webkit-font-smoothing:antialiased}
.am *{box-sizing:border-box}
.am a{color:inherit;text-decoration:none}
.am .wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.am .grupoWrap{display:flex;justify-content:center;padding:14px 16px 12px}
.am .grupo{display:inline-flex;gap:4px;padding:5px;border-radius:999px;background:${INK};box-shadow:0 10px 40px rgba(0,0,0,0.25)}
.am .grupo a,.am .grupo span{padding:9px 22px;border-radius:999px;font-family:${MONO};font-size:11px;letter-spacing:0.12em;color:#9DA3A9;font-weight:600;white-space:nowrap}
.am .grupo a.on{background:#fff;color:${INK}}
.am .grupo a b,.am .grupo span b{color:${Y}}.am .grupo a.on b{color:${INK};background:${Y};padding:0 4px;border-radius:3px}
.am .nav{position:sticky;top:0;z-index:30;background:rgba(255,255,255,0.86);backdrop-filter:blur(14px);border-bottom:1px solid ${BORDE}}
.am .nav .wrap{display:flex;align-items:center;gap:26px;height:74px}
.am .nav .links{display:flex;gap:22px;font-size:14.5px;font-weight:600;color:#3d4147;flex:1;justify-content:center}
.am .btn{display:inline-flex;align-items:center;gap:8px;padding:13px 22px;border-radius:999px;font-weight:800;font-size:14.5px;border:1px solid ${BORDE};background:#fff;transition:transform 120ms}
.am .btn:hover{transform:translateY(-1px)}
.am .btn.y{background:${Y};border-color:${Y};color:${INK}}
.am .btn.k{background:${INK};border-color:${INK};color:#fff}
.am .hero{padding:56px 0 40px;text-align:center;position:relative;overflow:hidden}
.am .hero .kicker{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid ${BORDE};font-family:${MONO};font-size:12px;letter-spacing:0.06em;color:#3d4147;background:#fff}
.am .hero .kicker i{width:8px;height:8px;border-radius:50%;background:${Y};display:inline-block;animation:pulso 1.6s infinite}
.am .hero h1{font-size:clamp(46px,9vw,124px);line-height:0.92;letter-spacing:-0.05em;font-weight:800;margin:28px 0 22px}
.am .hero h1 .ac{background:${Y};padding:0 0.12em;border-radius:0.12em;display:inline-block;transform:rotate(-1.2deg)}
.am .hero p{font-size:19px;color:${GRIS};max-width:640px;margin:0 auto 26px;line-height:1.5}
.am .pasos{background:${SUAVE};border:1px solid ${BORDE};border-radius:28px;padding:42px 34px;margin:34px auto 0;max-width:1080px}
.am .pasos h2{font-size:clamp(24px,3.4vw,36px);letter-spacing:-0.03em;margin:0 0 30px;text-align:center}
.am .pasos .fila{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.am .paso{text-align:center;position:relative}
.am .paso .ico{width:78px;height:78px;margin:0 auto 14px;border-radius:22px;background:#fff;border:1px solid ${BORDE};display:flex;align-items:center;justify-content:center}
.am .paso .n{font-family:${MONO};font-size:11px;color:${GRIS};letter-spacing:0.1em}
.am .paso b{display:block;font-size:16px;margin-top:4px}
.am .paso:not(:last-child):after{content:"+";position:absolute;right:-9px;top:30px;color:#B7BBC1;font-size:18px}
.am section.b{padding:80px 0}
.am .bento{display:grid;grid-template-columns:1.25fr 1fr 1fr;grid-auto-rows:240px;gap:14px}
.am .card{position:relative;border-radius:22px;overflow:hidden;background:${INK};color:#fff;padding:22px;display:flex;flex-direction:column;justify-content:flex-end;isolation:isolate}
.am .card.alta{grid-row:span 2}
.am .card.clara{background:${SUAVE};color:${INK};border:1px solid ${BORDE}}
.am .card .tag{position:absolute;top:18px;left:22px;font-size:15px;font-weight:700;border-bottom:2px solid ${Y};padding-bottom:3px}
.am .card .lug{font-family:${MONO};font-size:11px;letter-spacing:0.12em;opacity:0.6;margin-bottom:6px}
.am .card h3{margin:0;font-size:22px;letter-spacing:-0.02em;line-height:1.15}
.am .card.alta h3{font-size:34px}
.am .card p{margin:8px 0 0;font-size:14px;opacity:0.75;line-height:1.45;max-width:420px}
.am .anim{position:absolute;inset:0;z-index:-1;opacity:0.55}
.am .grilla{background-image:linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px);background-size:34px 34px}
.am .rubros{padding:20px 0 80px}
.am .rubros h2{font-size:clamp(28px,4vw,44px);letter-spacing:-0.04em;margin:0 0 8px}
.am .rubros .sub{color:${GRIS};font-size:17px;margin:0 0 26px}
.am .carril{display:flex;gap:12px;overflow-x:auto;padding:4px 2px 16px;scroll-snap-type:x proximity;scrollbar-width:thin}
.am .rubro{flex:0 0 250px;scroll-snap-align:start;border:1px solid ${BORDE};border-radius:20px;padding:20px;background:#fff;transition:transform 140ms,box-shadow 140ms}
.am .rubro:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(0,0,0,0.08)}
.am .rubro b{display:block;font-size:17px;letter-spacing:-0.01em;margin-bottom:8px}
.am .rubro span{display:inline-block;font-size:12px;color:${GRIS};background:${SUAVE};padding:3px 9px;border-radius:999px;margin:0 4px 4px 0}
.am .pago{background:${INK};color:#fff;border-radius:28px;padding:56px 40px;display:grid;grid-template-columns:1.1fr 1fr;gap:40px;align-items:center}
.am .pago h2{font-size:clamp(30px,4vw,48px);letter-spacing:-0.04em;margin:0 0 14px;line-height:1.02}
.am .pago p{color:#9DA3A9;font-size:17px;line-height:1.5;margin:0}
.am .pago .caja{background:#1C1E21;border:1px solid #2B2E33;border-radius:20px;padding:22px}
.am .pago .lin{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid #2B2E33;font-size:15px}
.am .pago .lin:last-child{border:none}
.am .pago .lin i{font-family:${MONO};font-style:normal;font-size:11px;letter-spacing:0.1em;padding:4px 8px;border-radius:6px;background:#3A3305;color:${Y}}
.am .cta{text-align:center;padding:90px 0}
.am .cta h2{font-size:clamp(34px,6vw,76px);letter-spacing:-0.05em;line-height:0.95;margin:0 0 22px}
.am footer{border-top:1px solid ${BORDE};padding:34px 0;font-size:13.5px;color:${GRIS}}
.am footer .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center}
@keyframes pulso{0%,100%{box-shadow:0 0 0 0 rgba(255,210,0,0.6)}70%{box-shadow:0 0 0 9px rgba(255,210,0,0)}}
@keyframes correr{to{stroke-dashoffset:-400}}
@keyframes viajar{0%{offset-distance:0%}100%{offset-distance:100%}}
@keyframes subir{0%{transform:scaleY(0.2)}100%{transform:scaleY(1)}}
@keyframes girar{to{transform:rotate(360deg)}}
@keyframes tick{0%,100%{opacity:0.2}50%{opacity:1}}
@keyframes flotar{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@media(max-width:900px){.am .nav .links{display:none}.am .bento{grid-template-columns:1fr 1fr;grid-auto-rows:220px}.am .card.alta{grid-row:span 1;grid-column:span 2}.am .pago{grid-template-columns:1fr;padding:34px 24px}.am .pasos .fila{grid-template-columns:repeat(2,1fr);gap:22px}.am .paso:after{display:none}.am .grupo a{padding:8px 14px}}
@media(max-width:560px){.am .bento{grid-template-columns:1fr}.am .card.alta{grid-column:span 1}.am .hero{padding-top:84px}}
`;

function Logo({ inv }) { return <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: inv ? "#fff" : INK }}>ARGEN<span style={{ background: Y, color: INK, padding: "0 6px", borderRadius: 6, marginLeft: 1 }}>MAQ</span></span>; }

// ── Mini animaciones de las tarjetas (SVG + CSS, sin video) ────────────────────────────────
const Ruta = () => <svg className="anim" viewBox="0 0 400 240" preserveAspectRatio="none"><defs><path id="r" d="M40 200 C 120 60, 260 60, 360 40" /></defs><path d="M40 200 C 120 60, 260 60, 360 40" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeDasharray="8 10" style={{ animation: "correr 6s linear infinite" }} /><circle r="6" fill={Y} style={{ offsetPath: "path('M40 200 C 120 60, 260 60, 360 40')", animation: "viajar 5s ease-in-out infinite" }} /><circle cx="40" cy="200" r="10" fill="none" stroke="rgba(255,255,255,0.5)" /><circle cx="360" cy="40" r="10" fill="none" stroke={Y} /><text x="52" y="222" fill="rgba(255,255,255,0.6)" fontFamily={MONO} fontSize="10" letterSpacing="2">YIWU · NINGBO</text><text x="262" y="30" fill="rgba(255,255,255,0.6)" fontFamily={MONO} fontSize="10" letterSpacing="2">BUENOS AIRES</text></svg>;
const Barras = () => <svg className="anim" viewBox="0 0 400 240" preserveAspectRatio="none">{[40, 90, 140, 190, 240, 290, 340].map((x, i) => <rect key={x} x={x} y={60} width="26" height="150" rx="4" fill={i === 5 ? Y : "rgba(255,255,255,0.18)"} style={{ transformOrigin: "50% 210px", transformBox: "fill-box", animation: `subir 1.8s ${i * 0.15}s ease-out infinite alternate` }} />)}<line x1="30" y1="210" x2="380" y2="210" stroke="rgba(255,255,255,0.35)" /></svg>;
const Check = () => <svg className="anim" viewBox="0 0 400 240"><g transform="translate(120 34)"><rect width="160" height="180" rx="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" />{[0, 1, 2, 3].map((i) => <g key={i} transform={`translate(20 ${28 + i * 36})`}><rect width="18" height="18" rx="5" fill="none" stroke={Y} /><path d="M4 9l4 4 7-8" fill="none" stroke={Y} strokeWidth="2.2" style={{ animation: `tick 2.4s ${i * 0.5}s infinite` }} /><rect x="30" y="4" width="86" height="10" rx="5" fill="rgba(255,255,255,0.25)" /></g>)}</g></svg>;
const Enchufe = () => <svg className="anim" viewBox="0 0 400 240"><g transform="translate(200 120)"><circle r="70" fill="none" stroke="rgba(21,23,26,0.12)" strokeWidth="14" /><circle r="70" fill="none" stroke={Y} strokeWidth="14" strokeDasharray="120 320" strokeLinecap="round" style={{ transformOrigin: "center", animation: "girar 3s linear infinite" }} /><text textAnchor="middle" y="10" fontFamily={MONO} fontSize="26" fontWeight="600" fill={INK}>220 V</text></g></svg>;
const Pasos = () => <svg className="anim" viewBox="0 0 400 240"><line x1="40" y1="120" x2="360" y2="120" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />{[40, 120, 200, 280, 360].map((x, i) => <g key={x}><circle cx={x} cy="120" r="9" fill={INK} stroke={Y} strokeWidth="2" style={{ animation: `tick 3s ${i * 0.6}s infinite` }} /><circle cx={x} cy="120" r="4" fill={Y} style={{ animation: `tick 3s ${i * 0.6}s infinite` }} /></g>)}</svg>;
const Fabrica = () => <svg className="anim" viewBox="0 0 400 240" preserveAspectRatio="none"><path d="M30 200 V120 l60 -40 v40 l60 -40 v40 l60 -40 V200 Z" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.35)" /><rect x="60" y="150" width="28" height="30" fill={Y} opacity="0.85" style={{ animation: "tick 2.2s infinite" }} /><rect x="120" y="150" width="28" height="30" fill="rgba(255,255,255,0.35)" /><rect x="180" y="150" width="28" height="30" fill={Y} opacity="0.85" style={{ animation: "tick 2.2s 0.8s infinite" }} /><g style={{ animation: "flotar 3s ease-in-out infinite" }}><rect x="270" y="90" width="90" height="70" rx="10" fill="rgba(255,255,255,0.12)" stroke={Y} /><text x="315" y="132" textAnchor="middle" fontFamily={MONO} fontSize="12" fill={Y} letterSpacing="2">QC OK</text></g></svg>;

export default function Landing({ rubros }) {
  return <div className="am">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="grupoWrap"><div className="grupo">
      <a className="on" href="/">ARGEN<b>MAQ</b></a>
      <a href="https://www.argencargo.com.ar">ARGEN<b>CARGO</b></a>
      <span title="Próximamente" aria-disabled="true" style={{ opacity: 0.55, cursor: "default" }}>ARGEN<b>BRANDS</b></span>
    </div></div>
    <header className="nav">
      <div className="wrap">
        <a href="/"><Logo /></a>
        <nav className="links"><a href="#como">Cómo funciona</a><a href="#rubros">Catálogo</a><a href="#pago">Cómo se paga</a><a href="#empresa">Empresa</a></nav>
        <a className="btn y" href={WA}>Hablá con un experto</a>
      </div>
    </header>

    <section className="hero">
      <div className="wrap">
        <span className="kicker"><i /> MAQUINARIA · DE LA FÁBRICA EN CHINA A TU TALLER</span>
        <h1>Tu próxima máquina,<br /><span className="ac">puesta en tu puerta.</span></h1>
        <p>Elegís la máquina, ves el precio final con flete e impuestos en Argentina, y nosotros hacemos todo lo demás: fábrica, control, importación y entrega. Vos la enchufás.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}><a className="btn k" href="#rubros">Ver el catálogo</a><a className="btn" href={WA}>Cotizar una máquina</a></div>
        <div className="pasos" id="como">
          <h2>Una sola operación, de la fábrica a tu taller.</h2>
          <div className="fila">
            {[["01", "Elegís", "M4 6h16M4 12h10M4 18h7"], ["02", "Precio final", "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"], ["03", "Pagás la máquina", "M2 7h20v10H2zM6 12h.01M18 12h.01"], ["04", "Producción y control", "M3 20V9l6-4v4l6-4v4l6-4v15zM7 15h2M11 15h2M15 15h2"], ["05", "Importación y entrega", "M3 9l9-6 9 6-9 6-9-6zM3 9v6l9 6 9-6V9"]].map(([n, t, d]) => <div className="paso" key={n}><div className="ico"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg></div><span className="n">{n}</span><b>{t}</b></div>)}
          </div>
        </div>
      </div>
    </section>

    <section className="b">
      <div className="wrap">
        <div className="bento">
          <div className="card alta"><div className="anim grilla" /><Ruta /><span className="tag">Argencargo</span><div className="lug">CHINA → ARGENTINA</div><h3>La importación la hace Argencargo.</h3><p>Flete, seguro, aduana y entrega con el mismo equipo que opera cientos de importaciones. Vos ves cada paso, sin hablar con nadie en China.</p></div>
          <div className="card"><Barras /><span className="tag">Precio final</span><div className="lug">FLETE + IMPUESTOS INCLUIDOS</div><h3>Sin sorpresas en la puerta.</h3></div>
          <div className="card"><Fabrica /><span className="tag">Fábricas</span><div className="lug">ZHEJIANG · GUANGDONG</div><h3>Fábricas que ya conocemos.</h3></div>
          <div className="card clara"><Enchufe /><span className="tag">Lista para usar</span><div className="lug" style={{ opacity: 0.7 }}>220 V · 50 HZ</div><h3>Llega para enchufar.</h3></div>
          <div className="card"><Pasos /><span className="tag">Seguimiento</span><div className="lug">PRODUCCIÓN → EMBARQUE → ADUANA → ENTREGA</div><h3>Sabés dónde está tu máquina.</h3></div>
          <div className="card" style={{ gridColumn: "span 2" }}><Check /><span className="tag">Respaldo</span><div className="lug">GARANTÍA GESTIONADA ACÁ</div><h3>Si algo pasa, hablás con nosotros, no con la fábrica.</h3></div>
        </div>
      </div>
    </section>

    <section className="rubros" id="rubros">
      <div className="wrap">
        <h2>Todo tipo de maquinaria.</h2>
        <p className="sub">Carpintería, gastronomía, metalúrgica, impresión, textil, construcción y más. Si no está, la buscamos.</p>
        <div className="carril">{rubros.map((r) => <a className="rubro" key={r.slug} href={WA}><b>{r.nombre}</b>{r.subs.slice(0, 4).map((s) => <span key={s}>{s}</span>)}{r.subs.length > 4 && <span>+{r.subs.length - 4}</span>}</a>)}</div>
      </div>
    </section>

    <section id="pago" style={{ padding: "0 0 80px" }}>
      <div className="wrap">
        <div className="pago">
          <div><h2>Pagás la máquina.<br />La importación, contra entrega.</h2><p>El precio de la máquina se abona al confirmar, y con eso la fábrica arranca la producción. La importación se paga cuando la máquina llega a Argentina. Todo en dólares, con comprobante y seguimiento desde tu cuenta.</p></div>
          <div className="caja">
            <div className="lin"><span>Anticipo · máquina</span><i>AL CONFIRMAR</i></div>
            <div className="lin"><span>Producción en fábrica</span><i>15 A 40 DÍAS</i></div>
            <div className="lin"><span>Contra entrega · importación</span><i>AL LLEGAR</i></div>
            <div className="lin"><span>Entrega en tu puerta</span><i>ARGENCARGO</i></div>
          </div>
        </div>
      </div>
    </section>

    <section className="cta" id="empresa">
      <div className="wrap">
        <h2>Contanos qué máquina necesitás.</h2>
        <p style={{ color: GRIS, fontSize: 18, margin: "0 auto 24px", maxWidth: 560 }}>Te pasamos el precio puesto en tu puerta y, si te cierra, arrancamos. ARGENMAQ es una empresa del grupo Argencargo.</p>
        <a className="btn y" href={WA}>Hablar por WhatsApp</a>
      </div>
    </section>

    <footer>
      <div className="wrap">
        <div><Logo /><div style={{ marginTop: 6 }}>Maquinaria de China, puesta en Argentina. Una empresa del grupo Argencargo.</div></div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}><a href="/terminos">Términos y condiciones</a><a href="/privacidad">Privacidad</a><a href="/legal">Aviso legal</a><a href="https://www.argencargo.com.ar">Argencargo</a><a href="/admin">Panel</a><a href={WA}>Contacto</a></div>
      </div>
    </footer>
  </div>;
}
