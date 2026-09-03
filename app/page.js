"use client";
// Landing pública de Argencargo — hero 3D real (Three.js: cielo HDRI fotografiado + 747 real
// recortado + nubes volumétricas, cámara que vuela con el scroll) y secciones oscuras con
// fotografía real. La escena vive en landing-scene.js y se carga solo en cliente.
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const HeroScene = dynamic(() => import("./landing-scene"), { ssr: false });
const SceneLoader = dynamic(() => import("./landing-scene").then((m) => m.SceneLoader), { ssr: false });

const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const WA = "5491125088580";
const waL = (m) => `https://wa.me/${WA}?text=${encodeURIComponent(m)}`;
const BLUE = "#3B7DD8";
const BG = "#070d1a";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const FALLBACK = { vuelos_en_transito: 13, kg_en_el_aire: 938.39, contenedores_navegando: 5, ops_en_aduana: 9, importadores: 1397 };

const fmt = (n, dec) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/* Count-up al entrar en viewport. Renderiza el valor final en SSR (sin flash). */
function CountUp({ value, decimals = 0, duration = 1800 }) {
  const ref = useRef(null);
  const target = Number(value) || 0;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") { el.textContent = fmt(target, decimals); return; }
    let raf = 0, started = false;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && !started) {
        started = true; io.disconnect();
        const t0 = performance.now();
        const tick = (t) => { const p = Math.min(1, (t - t0) / duration); const ease = 1 - Math.pow(1 - p, 3); el.textContent = fmt(target * ease, decimals); if (p < 1) raf = requestAnimationFrame(tick); };
        el.textContent = fmt(0, decimals); raf = requestAnimationFrame(tick);
      }
    }), { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [target, decimals, duration]);
  return <span ref={ref}>{fmt(target, decimals)}</span>;
}

const WaIcon = ({ s = 18, c = "#fff" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c} aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
);

const MODALS = {
  calc: { emoji: "🧮", title: "Calculadora de importación", body: "La calculadora pública está en camino. Por ahora vive adentro del portal: creá tu cuenta gratis y usala hoy. Tarda menos que cebar un mate.", cta: { label: "Crear cuenta", href: "/portal" } },
  academy: { emoji: "🎓", title: "Argencargo Academy", body: "Estamos armando algo grande: todo lo que aprendimos importando desde China, explicado sin humo. Cursos, guías y casos reales. Cuando esté, vas a ser el primero en enterarte.", cta: { label: "Avisame por WhatsApp", href: waL("Hola! Quiero que me avisen cuando salga la Academy") } },
  full: { emoji: "📦", title: "Full Mercado Libre", body: "Tu mercadería directo desde China al depósito de Mercado Libre, lista para vender. Próximamente. Si ya vendés en ML y querés adelantarte, escribinos.", cta: { label: "Quiero saber más", href: waL("Hola! Me interesa Full Mercado Libre") } },
};

const FAQ = [
  { q: "¿Necesito ser importador registrado?", a: "No. Para courier no necesitás ningún registro especial. Para carga formal te asesoramos en todo el proceso." },
  { q: "¿Cuándo pago?", a: "Pagás cuando tu mercadería está en Argentina y lista para retirar. No antes." },
  { q: "¿Puedo importar desde Estados Unidos?", a: "Sí. Operamos envíos desde China y USA, por vía aérea y marítima." },
  { q: "¿Cómo sigo el estado de mi carga?", a: "Tenés un portal online con tracking real. Ves dónde está tu mercadería en todo momento." },
  { q: "¿Puedo traer cualquier producto?", a: "Casi todo. Hay restricciones para alimentos, medicamentos y materiales peligrosos. Consultanos y te confirmamos." },
  { q: "¿Hacen entregas a domicilio?", a: "Sí. Podés retirar en nuestra oficina de Buenos Aires o coordinar envío a domicilio si lo necesitás." },
];

export default function Landing() {
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState(null);
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [stats, setStats] = useState(FALLBACK);
  const [scrolled, setScrolled] = useState(false);
  const [stage, setStage] = useState(0);
  const progressRef = useRef(0);
  const heroRef = useRef(null);
  const overlayRef = useRef(null);

  // Redirect de auth de Supabase (recovery/signup/error) que aterriza en "/"
  useEffect(() => { if (typeof window === "undefined") return; const h = window.location.hash || ""; const qs = window.location.search || ""; const isRecoveryHash = h.includes("type=recovery") || h.includes("type=signup") || h.includes("access_token=") || h.includes("error="); const isErrorQs = qs.includes("error=") || qs.includes("error_code="); if (isRecoveryHash || isErrorQs) { window.location.replace("/portal" + qs + h); } }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const set = () => setMobile(mq.matches);
    set(); mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  useEffect(() => {
    fetch("/api/landing-stats").then((r) => r.json()).then((j) => { if (j && typeof j === "object") setStats({ ...FALLBACK, ...j }); }).catch(() => {});
    fetch("/api/reviews").then((r) => r.json()).then((d) => { if (d && !d.fallback && Array.isArray(d.reviews) && d.reviews.length > 0) setReviews(d); }).catch(() => {});
  }, []);

  // Progreso del hero (0→1) para la escena 3D + etapas de texto. Sin re-render por frame.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, lastStage = -1, lastScrolled = false;
    const update = () => {
      raf = 0;
      const y = window.scrollY || 0;
      const el = heroRef.current;
      const span = el ? el.offsetHeight - window.innerHeight : 1;
      const p = reduce ? 0.32 : Math.min(1, Math.max(0, y / Math.max(1, span)));
      progressRef.current = p;
      const st = p < 0.3 ? 0 : p < 0.64 ? 1 : 2;
      if (st !== lastStage) { lastStage = st; setStage(st); }
      const sc = y > 30;
      if (sc !== lastScrolled) { lastScrolled = sc; setScrolled(sc); }
      if (overlayRef.current) overlayRef.current.style.opacity = String(0.82 * Math.min(1, Math.max(0, (p - 0.9) / 0.1)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    if (modal || menu) document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") { setModal(null); setMenu(false); } };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [modal, menu]);

  const openModal = (k) => { setMenu(false); setModal(k); };
  const stageStyle = (i) => ({ opacity: stage === i ? 1 : 0, transform: stage === i ? "translateY(0)" : "translateY(18px)", pointerEvents: stage === i ? "auto" : "none", transition: "opacity .55s ease, transform .55s ease" });

  return (
    <div className="lp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <SceneLoader logo={LOGO} />

      {/* NAV */}
      <nav className={"lp-nav" + (scrolled ? " on" : "")}>
        <a href="/" className="lp-logo"><img src={LOGO} alt="Argencargo" /></a>
        <div className="lp-links">
          <button onClick={() => openModal("calc")}>Calculadora</button>
          <button onClick={() => openModal("academy")}>Academy</button>
          <button onClick={() => openModal("full")}>Full Mercado Libre</button>
          <a href="/portal" className="lp-btn lp-btn-blue small">Iniciar sesión</a>
        </div>
        <button className={"lp-burger" + (menu ? " open" : "")} aria-label={menu ? "Cerrar menú" : "Abrir menú"} onClick={() => setMenu((v) => !v)}><span /><span /><span /></button>
      </nav>
      {menu && (
        <div className="lp-menu">
          <button onClick={() => openModal("calc")}>Calculadora</button>
          <button onClick={() => openModal("academy")}>Academy</button>
          <button onClick={() => openModal("full")}>Full Mercado Libre</button>
          <a href="/portal" className="lp-btn lp-btn-blue">Iniciar sesión</a>
        </div>
      )}

      {/* HERO 3D — 320vh de scroll; la escena queda fija y vuela */}
      <section ref={heroRef} className="lp-hero">
        <div className="lp-sticky">
          <HeroScene progressRef={progressRef} mobile={mobile} />
          <div className="lp-hero-vig" />
          <div className="lp-hero-shade" />
          <div ref={overlayRef} className="lp-hero-dark" />

          <div className="lp-stage" style={stageStyle(0)}>
            <div className="lp-kicker"><span className="lp-dot" /> ESPECIALISTAS EN CHINA · SUR ASIÁTICO</div>
            <h1>De China<br />a tu puerta.</h1>
            <p>Vos comprás en China. Nosotros la traemos a Argentina, puerta a puerta. Aéreo o marítimo, con seguimiento real.</p>
            <div className="lp-ctas">
              <a href="/portal" className="lp-btn lp-btn-blue">Crear cuenta gratis</a>
              <a href={waL("Hola! Quiero info para importar desde China")} target="_blank" rel="noreferrer" className="lp-btn lp-btn-ghost"><WaIcon /> Hablar con un asesor</a>
            </div>
            <div className="lp-hint">↓ Scrolleá</div>
          </div>

          <div className="lp-stage" style={stageStyle(1)}>
            <div className="lp-kicker">AÉREO · MARÍTIMO</div>
            <h2>Recibimos tu carga en China.<br />Te la entregamos en Argentina.</h2>
            <p>Depósito propio en origen, consolidación, vuelo o barco, aduana y entrega. Todo en un solo lugar, y lo seguís desde tu portal.</p>
          </div>

          <div className="lp-stage" style={stageStyle(2)}>
            <div className="lp-kicker"><span className="lp-dot live" /> AHORA MISMO</div>
            <h2 className="lp-live-h"><span className="lp-num">{fmt(stats.kg_en_el_aire, 2)} kg</span> en el aire<br /><span className="lp-num">{stats.vuelos_en_transito}</span> vuelos en tránsito</h2>
            <p>Números reales de nuestro sistema, sin redondear. Así se ve un día normal en Argencargo.</p>
          </div>
        </div>
      </section>

      {/* EN VIVO */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <div className="lp-kicker"><span className="lp-dot live" /> EN VIVO · DIRECTO DE NUESTRO SISTEMA</div>
          <div className="lp-live">
            {[
              { v: stats.kg_en_el_aire, d: 2, u: "kg", l: "en el aire ahora mismo" },
              { v: stats.vuelos_en_transito, d: 0, u: "", l: "vuelos en tránsito" },
              { v: stats.contenedores_navegando, d: 0, u: "", l: "contenedores navegando hacia acá" },
              { v: stats.ops_en_aduana, d: 0, u: "", l: "despachos en aduana" },
            ].map((s, i) => (
              <div key={i} className="lp-live-card">
                <div className="lp-live-n"><CountUp value={s.v} decimals={s.d} />{s.u && <span className="lp-live-u"> {s.u}</span>}</div>
                <div className="lp-live-l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
      <section className="lp-sec" id="servicios">
        <div className="lp-wrap">
          <div className="lp-kicker">CANALES DE ENVÍO</div>
          <h2 className="lp-h2">El canal que mejor se adapta a tu negocio</h2>
          <div className="lp-serv">
            {[
              { img: "/landing/plane_bg.jpg", pos: "center 40%", tag: "RÁPIDO", title: "Courier aéreo", points: ["El canal más ágil desde China", "Régimen simplificado, sin tramiterío extra", "Ideal para reposición de stock y muestras", "También disponible desde USA"] },
              { img: "/landing/ship_sunset.jpg", pos: "center", tag: "GRAN VOLUMEN", title: "Marítimo LCL / FCL", points: ["Consolidado (LCL) o contenedor completo (FCL)", "El menor costo por unidad para grandes cargas", "Tiempos y costos según consulta", "Para quienes planifican con anticipación"] },
            ].map((s) => (
              <div key={s.title} className="lp-serv-card" style={{ backgroundImage: `url(${s.img})`, backgroundPosition: s.pos }}>
                <div className="lp-serv-in">
                  <span className="lp-tag">{s.tag}</span>
                  <h3>{s.title}</h3>
                  <ul>{s.points.map((p) => <li key={p}>{p}</li>)}</ul>
                  <a href={waL(`Hola, quiero info sobre ${s.title}`)} target="_blank" rel="noreferrer" className="lp-link">Consultar por {s.title} →</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="lp-sec" id="como-funciona">
        <div className="lp-wrap narrow">
          <div className="lp-kicker">CÓMO FUNCIONA</div>
          <h2 className="lp-h2">Importar con nosotros es así de simple</h2>
          <div className="lp-steps">
            {[
              { n: "01", t: "Nos contactás y cotizamos", d: "Nos decís qué querés traer. Te armamos una cotización con todos los costos desglosados. Sin compromiso." },
              { n: "02", t: "Tu proveedor envía a nuestro depósito", d: "Le pasás la dirección de nuestro depósito en China (o USA). Cuando la mercadería llega, te confirmamos." },
              { n: "03", t: "Nos encargamos de todo el envío", d: "Transporte internacional, documentación, seguimiento y gestión de aduana. Vos te enfocás en tu negocio." },
              { n: "04", t: "Tu mercadería está lista", d: "Te avisamos cuando llegó. Retirás en nuestra oficina o te la enviamos a domicilio. Vos elegís." },
            ].map((s) => (
              <div key={s.n} className="lp-step"><div className="lp-step-n">{s.n}</div><div><h3>{s.t}</h3><p>{s.d}</p></div></div>
            ))}
          </div>
        </div>
      </section>

      {/* ESPECIALISTAS EN CHINA */}
      <section className="lp-sec lp-china" style={{ backgroundImage: "url(/landing/port_cosco.jpg)" }}>
        <div className="lp-wrap">
          <div className="lp-kicker">🇨🇳 ESPECIALISTAS EN CHINA Y EL SUR ASIÁTICO</div>
          <h2 className="lp-h2">Depósito propio en China.<br />Equipo propio en Buenos Aires.</h2>
          <p className="lp-lead">Recibimos tu mercadería directo del proveedor en origen y la acompañamos hasta tu puerta. <strong><CountUp value={stats.importadores} /></strong> importadores ya confían en nosotros.</p>
          <div className="lp-feats">
            {[
              { t: "Empresa argentina", d: "Oficina en Buenos Aires. Atención directa, sin intermediarios." },
              { t: "Depósito en China y USA", d: "Tu proveedor entrega ahí. Nosotros hacemos el resto." },
              { t: "Tu propio portal", d: "Seguimiento online, documentación y estado de cada operación." },
              { t: "Te acompañamos", d: "Desde la primera consulta hasta que tenés tu carga. Siempre." },
            ].map((f) => <div key={f.t} className="lp-feat"><h4>{f.t}</h4><p>{f.d}</p></div>)}
          </div>
        </div>
      </section>

      {/* RESEÑAS */}
      {reviews && (
        <section className="lp-sec">
          <div className="lp-wrap">
            <div className="lp-kicker">RESEÑAS DE GOOGLE</div>
            <h2 className="lp-h2">Lo que dicen nuestros clientes</h2>
            <div className="lp-rating"><span className="lp-rating-n">{reviews.rating?.toFixed(1)}</span><span className="lp-stars">{[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ color: n <= Math.round(reviews.rating || 0) ? "#fbbf24" : "rgba(255,255,255,.15)" }}>★</span>)}</span><span className="lp-muted">· {reviews.total} reseñas</span></div>
            <div className="lp-reviews">
              {reviews.reviews.slice(0, 4).map((rv, i) => (
                <div key={i} className="lp-review">
                  <div className="lp-stars small">{[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ color: n <= rv.rating ? "#fbbf24" : "rgba(255,255,255,.12)" }}>★</span>)}</div>
                  <p>"{rv.text?.length > 220 ? rv.text.slice(0, 217) + "…" : rv.text}"</p>
                  <div className="lp-review-a">{rv.photo && <img src={rv.photo} alt="" referrerPolicy="no-referrer" />}<div><b>{rv.author}</b><span>{rv.relativeTime}</span></div></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="lp-sec">
        <div className="lp-wrap narrow">
          <div className="lp-kicker">PREGUNTAS FRECUENTES</div>
          <h2 className="lp-h2">Lo que todos preguntan antes de empezar</h2>
          <div className="lp-faq">
            {FAQ.map((f, i) => (
              <div key={i} className={"lp-faq-i" + (faq === i ? " open" : "")}>
                <button onClick={() => setFaq(faq === i ? null : i)}>{f.q}<span>{faq === i ? "−" : "+"}</span></button>
                {faq === i && <p>{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="lp-sec lp-cta">
        <div className="lp-wrap narrow center">
          <h2 className="lp-h2">Tu próxima importación arranca acá.</h2>
          <p className="lp-lead">Crear tu cuenta es gratis y tardás dos minutos. Después, el viaje lo hacemos nosotros.</p>
          <div className="lp-ctas center">
            <a href="/portal" className="lp-btn lp-btn-blue">Crear cuenta gratis</a>
            <a href={waL("Hola! Quiero cotizar una importación")} target="_blank" rel="noreferrer" className="lp-btn lp-btn-wa"><WaIcon /> WhatsApp</a>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap row">
          <div className="row"><img src={LOGO} alt="Argencargo" style={{ height: 34 }} /><span className="lp-muted">© {new Date().getFullYear()} Argencargo · China → Argentina</span></div>
          <div className="row links">
            <a href="/portal">Portal clientes</a><a href="/agente">Portal agentes</a><a href="/terminos">Términos y condiciones</a><a href="mailto:info@argencargo.com.ar">info@argencargo.com.ar</a>
          </div>
        </div>
      </footer>

      <a href={waL("Hola! Quiero info sobre importaciones")} target="_blank" rel="noreferrer" className="lp-wa-float" aria-label="WhatsApp"><WaIcon s={30} /></a>

      {modal && (
        <div className="lp-modal-bg" onClick={() => setModal(null)}>
          <div className="lp-modal" onClick={(e) => e.stopPropagation()}>
            <button className="lp-modal-x" onClick={() => setModal(null)} aria-label="Cerrar">×</button>
            <div className="lp-modal-emoji">{MODALS[modal].emoji}</div>
            <span className="lp-tag gold">PRÓXIMAMENTE</span>
            <h3>{MODALS[modal].title}</h3>
            <p>{MODALS[modal].body}</p>
            <div className="lp-ctas">
              <a href={MODALS[modal].cta.href} className="lp-btn lp-btn-blue" target={MODALS[modal].cta.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{MODALS[modal].cta.label}</a>
              <button className="lp-btn lp-btn-ghost" onClick={() => setModal(null)}>Ahora no</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.lp{font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;color:#fff;background:${BG};overflow-x:hidden;-webkit-font-smoothing:antialiased}
.lp *{box-sizing:border-box}
.lp a{text-decoration:none;color:inherit}
.lp button{font-family:inherit}
.lp-wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.lp-wrap.narrow{max-width:820px}
.lp-wrap.center{text-align:center}
.lp-sec{position:relative;padding:96px 0;border-top:1px solid rgba(255,255,255,.05);background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:64px 64px}
.lp-kicker{display:inline-flex;align-items:center;gap:10px;font-family:${MONO};font-size:11.5px;letter-spacing:.2em;color:rgba(255,255,255,.62);margin-bottom:18px}
.lp-dot{width:8px;height:8px;border-radius:99px;background:${BLUE};box-shadow:0 0 0 0 rgba(59,125,216,.6);animation:lpPulse 1.8s infinite}
.lp-dot.live{background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.6)}
@keyframes lpPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 10px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
.lp-h2{font-size:clamp(30px,4.4vw,52px);font-weight:800;letter-spacing:-.025em;line-height:1.05;margin:0 0 18px}
.lp-lead{font-size:clamp(16px,1.6vw,19px);color:rgba(255,255,255,.66);line-height:1.65;max-width:720px;margin:0 0 34px}
.lp-lead strong{color:#fff;font-weight:800}
.lp-note{font-family:${MONO};font-size:12px;color:rgba(255,255,255,.42);margin:18px 0 0;letter-spacing:.04em}
.lp-muted{color:rgba(255,255,255,.4);font-size:13px}
/* nav */
.lp-nav{position:fixed;top:0;left:0;right:0;z-index:300;display:flex;align-items:center;justify-content:space-between;padding:14px 28px;transition:background .3s,backdrop-filter .3s}
.lp-nav.on{background:rgba(7,13,26,.7);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.06)}
.lp-logo img{height:46px;display:block;filter:drop-shadow(0 2px 10px rgba(0,0,0,.45))}
.lp-links{display:flex;align-items:center;gap:6px}
.lp-links>button{background:transparent;border:none;color:rgba(255,255,255,.85);font-size:15px;font-weight:600;padding:10px 14px;cursor:pointer;border-radius:10px;text-shadow:0 1px 8px rgba(0,0,0,.5)}
.lp-links>button:hover{background:rgba(255,255,255,.08)}
.lp-burger{display:none;width:46px;height:46px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(7,13,26,.55);backdrop-filter:blur(10px);cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:5px}
.lp-burger span{display:block;width:20px;height:2px;background:#fff;transition:transform .25s,opacity .25s}
.lp-burger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}.lp-burger.open span:nth-child(2){opacity:0}.lp-burger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
.lp-menu{position:fixed;top:74px;left:14px;right:14px;z-index:290;background:rgba(7,13,26,.96);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:12px;display:flex;flex-direction:column;gap:4px;backdrop-filter:blur(20px)}
.lp-menu>button{background:transparent;border:none;color:#fff;font-size:17px;font-weight:600;text-align:left;padding:14px 16px;border-radius:12px;cursor:pointer}
.lp-menu>button:active{background:rgba(255,255,255,.08)}
.lp-menu>.lp-btn{margin-top:6px;justify-content:center}
/* buttons */
.lp-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;border-radius:999px;font-weight:700;font-size:16px;padding:15px 30px;min-height:52px;border:none;cursor:pointer;transition:transform .18s,box-shadow .18s,background .18s;white-space:nowrap}
.lp-btn.small{padding:10px 22px;min-height:42px;font-size:15px}
.lp .lp-btn-blue{background:${BLUE};color:#fff;box-shadow:0 10px 30px rgba(59,125,216,.38)}
.lp .lp-btn-ghost{background:rgba(255,255,255,.08);color:#fff;border:1.5px solid rgba(255,255,255,.35);backdrop-filter:blur(8px)}
.lp .lp-btn-wa{background:#25D366;color:#fff;box-shadow:0 10px 30px rgba(37,211,102,.3)}
@media(hover:hover){.lp-btn:hover{transform:translateY(-2px)}}
.lp-ctas{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
.lp-ctas.center{justify-content:center}
.lp-link{display:inline-block;margin-top:16px;font-weight:700;color:#9cc3f2;font-size:14px}
.lp-tag{display:inline-block;font-family:${MONO};font-size:11px;letter-spacing:.18em;padding:6px 12px;border-radius:99px;background:rgba(59,125,216,.18);color:#9cc3f2;border:1px solid rgba(59,125,216,.35);margin-bottom:14px}
.lp-tag.gold{background:rgba(184,149,106,.16);color:#e8c99b;border-color:rgba(184,149,106,.4)}
/* hero */
.lp-hero{position:relative;height:270vh;background:#070d1a}
.lp-sticky{position:sticky;top:0;height:100vh;overflow:hidden}
.lp-hero-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(7,13,26,.55) 0%,rgba(7,13,26,0) 26%,rgba(7,13,26,0) 48%,rgba(7,13,26,.55) 78%,rgba(7,13,26,.94) 100%)}
.lp-hero-dark{position:absolute;inset:0;pointer-events:none;background:#070d1a;opacity:0}
.lp-hero-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.45) 100%)}
.lp-stage{position:absolute;left:0;right:0;bottom:0;padding:0 28px 11vh;max-width:820px;margin:0 auto;text-align:center;z-index:5;background:radial-gradient(ellipse 70% 60% at 50% 85%,rgba(7,13,26,.55),rgba(7,13,26,0) 70%)}
.lp-stage h1{font-size:clamp(46px,8.4vw,108px);font-weight:900;letter-spacing:-.035em;line-height:.98;margin:0 0 18px;text-shadow:0 6px 30px rgba(0,0,0,.55)}
.lp-stage h2{font-size:clamp(30px,5vw,60px);font-weight:800;letter-spacing:-.03em;line-height:1.05;margin:0 0 16px;text-shadow:0 6px 30px rgba(0,0,0,.55)}
.lp-stage p{font-size:clamp(16px,1.7vw,20px);line-height:1.55;color:rgba(255,255,255,.9);text-shadow:0 2px 14px rgba(0,0,0,.7);margin:0 auto;max-width:640px}
.lp-stage .lp-kicker{color:rgba(255,255,255,.85);text-shadow:0 2px 10px rgba(0,0,0,.7)}
.lp-stage .lp-ctas{justify-content:center}
.lp-live-h .lp-num{color:#9cc3f2;font-variant-numeric:tabular-nums}
.lp-hint{margin-top:34px;font-family:${MONO};font-size:12px;letter-spacing:.2em;color:rgba(255,255,255,.65);animation:lpHint 2s infinite}
@keyframes lpHint{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
/* live */
.lp-live{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:8px}
.lp-live-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:26px 22px}
.lp-live-n{font-size:clamp(34px,3.6vw,50px);font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1}
.lp-live-u{font-size:.5em;color:#9cc3f2;font-weight:700}
.lp-live-l{margin-top:10px;font-size:14px;color:rgba(255,255,255,.6)}
/* servicios */
.lp-serv{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:8px}
.lp-serv-card{position:relative;min-height:460px;border-radius:22px;overflow:hidden;background-size:cover;border:1px solid rgba(255,255,255,.1);display:flex;align-items:flex-end}
.lp-serv-in{position:relative;padding:30px 30px 28px;width:100%;background:linear-gradient(180deg,rgba(7,13,26,0) 0%,rgba(7,13,26,.82) 32%,rgba(7,13,26,.96) 100%);padding-top:120px}
.lp-serv-in h3{font-size:30px;font-weight:800;letter-spacing:-.02em;margin:0 0 12px}
.lp-serv-in ul{list-style:none;padding:0;margin:0}
.lp-serv-in li{position:relative;padding-left:18px;margin:0 0 8px;color:rgba(255,255,255,.78);font-size:15px;line-height:1.45}
.lp-serv-in li:before{content:"";position:absolute;left:0;top:9px;width:7px;height:7px;border-radius:99px;background:${BLUE}}
/* pasos */
.lp-steps{margin-top:10px}
.lp-step{display:flex;gap:22px;padding:24px 0;border-top:1px solid rgba(255,255,255,.07)}
.lp-step-n{flex-shrink:0;font-family:${MONO};font-size:13px;color:#9cc3f2;letter-spacing:.1em;padding-top:6px;width:44px}
.lp-step h3{font-size:21px;font-weight:800;margin:0 0 6px;letter-spacing:-.01em}
.lp-step p{margin:0;color:rgba(255,255,255,.62);line-height:1.6;font-size:15.5px}
/* china */
.lp-china{background-size:cover;background-position:center}
.lp-china:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,13,26,.96) 0%,rgba(7,13,26,.86) 55%,rgba(7,13,26,.6) 100%)}
.lp-china .lp-wrap{position:relative}
.lp-feats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.lp-feat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:20px;backdrop-filter:blur(6px)}
.lp-feat h4{margin:0 0 6px;font-size:15px;font-weight:800}
.lp-feat p{margin:0;font-size:13.5px;color:rgba(255,255,255,.62);line-height:1.5}
/* reviews */
.lp-rating{display:flex;align-items:center;gap:10px;margin-bottom:26px}
.lp-rating-n{font-size:30px;font-weight:800;color:#fbbf24}
.lp-stars{font-size:20px;letter-spacing:2px}.lp-stars.small{font-size:14px}
.lp-reviews{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.lp-review{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:22px;display:flex;flex-direction:column}
.lp-review p{flex:1;font-size:14.5px;color:rgba(255,255,255,.78);line-height:1.6;margin:10px 0 16px;font-style:italic}
.lp-review-a{display:flex;align-items:center;gap:10px}.lp-review-a img{width:34px;height:34px;border-radius:50%}
.lp-review-a b{display:block;font-size:13.5px}.lp-review-a span{font-size:11.5px;color:rgba(255,255,255,.4)}
/* faq */
.lp-faq-i{border-top:1px solid rgba(255,255,255,.08)}
.lp-faq-i button{width:100%;background:none;border:none;color:#fff;font-size:17px;font-weight:700;text-align:left;padding:20px 0;display:flex;justify-content:space-between;align-items:center;cursor:pointer;gap:14px}
.lp-faq-i button span{color:rgba(255,255,255,.4);font-size:22px;font-weight:400}
.lp-faq-i p{margin:0 0 20px;color:rgba(255,255,255,.65);line-height:1.7;font-size:15.5px}
/* cta + footer */
.lp-cta{background:radial-gradient(ellipse at 50% 100%,rgba(59,125,216,.28) 0%,rgba(7,13,26,0) 60%),${BG}}
.lp-footer{padding:36px 0 30px;border-top:1px solid rgba(255,255,255,.07)}
.lp-footer .row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:space-between}
.lp-footer .row.links{gap:22px}
.lp-footer .links a{font-size:13px;color:rgba(255,255,255,.5)}
.lp-wa-float{position:fixed;right:22px;bottom:22px;width:62px;height:62px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(37,211,102,.45);z-index:250}
/* modal */
.lp-modal-bg{position:fixed;inset:0;z-index:350;background:rgba(3,7,16,.72);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px}
.lp-modal{position:relative;width:100%;max-width:480px;background:#0d1730;border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:34px 30px 28px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.lp-modal-x{position:absolute;top:14px;right:14px;width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:#fff;font-size:22px;cursor:pointer}
.lp-modal-emoji{font-size:44px;margin-bottom:14px}
.lp-modal h3{font-size:24px;font-weight:800;margin:6px 0 10px;letter-spacing:-.02em}
.lp-modal p{color:rgba(255,255,255,.7);line-height:1.6;font-size:16px;margin:0}
/* mobile */
@media(max-width:900px){.lp-live{grid-template-columns:1fr 1fr}.lp-feats{grid-template-columns:1fr 1fr}.lp-serv{grid-template-columns:1fr}.lp-serv-card{min-height:380px}}
@media(max-width:768px){
  .lp-links{display:none}.lp-burger{display:flex}.lp-nav{padding:12px 16px}.lp-logo img{height:38px}
  .lp-sec{padding:64px 0}.lp-stage{padding:0 20px 9vh}.lp-stage .lp-kicker{font-size:10.5px;letter-spacing:.14em}.lp-stage h1{font-size:clamp(44px,13vw,64px)}
  .lp-ctas{flex-direction:column}.lp-stage .lp-ctas .lp-btn,.lp-cta .lp-btn{width:100%}
  .lp-live{grid-template-columns:1fr 1fr;gap:10px}.lp-live-card{padding:18px 14px;border-radius:14px}.lp-live-n{font-size:30px}.lp-live-l{font-size:12.5px}
  .lp-feats{grid-template-columns:1fr}.lp-step{gap:14px}
  .lp-footer .row{justify-content:flex-start}
}
@media(prefers-reduced-motion:reduce){.lp-dot,.lp-hint{animation:none}.lp-stage{transition:none!important}}
`;
