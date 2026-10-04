"use client";
// Secciones finales de la landing (04/10/2026):
// · Dudas: "Lo que otros complican, nosotros lo simplificamos" + las preguntas frecuentes en 6 tarjetas.
// · Cierre: "Contanos qué necesitás importar" con WhatsApp y mail (sin foto: no le gustó).
import { useEffect, useRef, useState } from "react";

export const DUDAS = [
  { t: "No tengo idea cuánto me va a salir", q: "¿Cuánto me va a salir importar?", a: "Cotización detallada antes de mover un dedo. Todos los costos claros desde el inicio: flete, impuestos y gestión. Sin sorpresas." },
  { t: "Me da miedo que se trabe en aduana", q: "¿Qué pasa si mi carga se traba en la aduana?", a: "Nos encargamos de toda la gestión aduanera. Si surge algún tema, lo resolvemos y te mantenemos informado paso a paso." },
  { t: "No soy importador registrado", q: "¿Necesito ser importador registrado?", a: "No hace falta. Para courier no necesitás ningún registro especial. Para carga formal te asesoramos en todo el proceso." },
  { t: "No quiero pagar todo por adelantado", q: "¿Cuándo pago?", a: "Pagás cuando tu mercadería está en Argentina y lista para retirar. No antes." },
  { t: "No sé en qué estado está mi carga", q: "¿Cómo sigo el estado de mi carga?", a: "Tenés un portal donde ves exactamente dónde está tu mercadería, con el seguimiento del envío actualizado automáticamente." },
  { t: "No sé si puedo traer mi producto", q: "¿Puedo traer cualquier producto?", a: "Casi todo. Hay restricciones para alimentos, medicamentos y materiales peligrosos. Consultanos y te confirmamos." },
];

const ICOS = [
  ["M12 2v20", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
  ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M9 12l2 2 4-4"],
  ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M16 11l2 2 4-4"],
  ["M3 7h18v12H3z", "M3 11h18", "M7 15h3"],
  ["M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z", "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  ["M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z", "M3.3 7l8.7 5 8.7-5", "M12 22V12"],
];
const Ico = ({ d, size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.map((x, i) => <path key={i} d={x} />)}</svg>;

const CSS = `
.dudAC{max-width:1180px;margin:0 auto;padding:40px 24px 88px;color:var(--ink)}
.dudAC h2{text-align:center;font-size:clamp(28px,3.4vw,42px);line-height:1.1;font-weight:800;letter-spacing:-0.025em;margin:0 auto 44px;max-width:720px}
.dudAC h2 span{color:var(--cel)}
.dudGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.dudCard{padding:26px 24px;border-radius:20px;background:var(--sup);border:1px solid var(--supB);opacity:0;transform:translateY(16px);transition:opacity .6s,transform .6s}
.dudAC.on .dudCard{opacity:1;transform:none}
.dudCard .ic{width:42px;height:42px;border-radius:12px;background:var(--acsuave);color:#3B7DD8;display:inline-flex;align-items:center;justify-content:center;margin-bottom:18px}
.dudCard h3{margin:0 0 12px;font-size:17px;line-height:1.35;font-weight:800;font-style:italic}
.dudCard .ra{width:32px;height:2px;border-radius:2px;background:#3B7DD8;margin:0 0 12px}
.dudCard p{margin:0;font-size:14.5px;line-height:1.6;color:var(--txt2)}
@media(max-width:900px){.dudGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.dudAC{padding:24px 16px 64px}.dudAC h2{margin-bottom:28px}.dudGrid{grid-template-columns:1fr;gap:12px}.dudCard{padding:20px 18px}}
@media (prefers-reduced-motion: reduce){.dudCard{opacity:1;transform:none;transition:none}}
`;

const CSS_CIERRE = `
.cieAC{padding:24px 24px 72px;text-align:center;color:var(--ink)}
.cieAC .in{max-width:760px;margin:0 auto;padding-top:56px;border-top:1px solid var(--supB)}
.cieAC h2{margin:0 0 14px;font-size:clamp(30px,4.4vw,52px);line-height:1.04;font-weight:900;letter-spacing:-0.01em;text-transform:uppercase}
.cieAC p{margin:0 auto 28px;max-width:540px;font-size:17px;line-height:1.6;color:var(--txt2)}
.cieBtns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.cieBtns a{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:56px;padding:0 30px;border-radius:999px;font-weight:800;font-size:16px;text-decoration:none;transition:transform 120ms}
.cieBtns a:hover{transform:translateY(-2px)}
.cieBtns .wa{background:var(--ink);color:var(--bg)}.cieBtns .ml{border:1.5px solid var(--supB);color:var(--ink)}
@media(max-width:640px){.cieAC{padding:8px 16px 56px}.cieAC .in{padding-top:40px}.cieBtns{flex-direction:column}.cieBtns a{width:100%;height:52px;font-size:15px}}
`;

export function Dudas() {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section ref={ref} className={`dudAC${on ? " on" : ""}`} id="dudas">
      <h2>Lo que otros complican, <span>nosotros lo simplificamos</span></h2>
      <div className="dudGrid">
        {DUDAS.map((d, i) => <article key={d.t} className="dudCard" style={{ transitionDelay: `${i * 0.08}s` }}>
          <span className="ic"><Ico d={ICOS[i]} /></span>
          <h3>"{d.t}"</h3>
          <div className="ra" />
          <p>{d.a}</p>
        </article>)}
      </div>
    </section>
  </>;
}

export function Cierre({ wa, mail }) {
  return <section className="cieAC" aria-label="Contacto">
    <style dangerouslySetInnerHTML={{ __html: CSS_CIERRE }} />
    <div className="in">
      <h2>Contanos qué necesitás importar</h2>
      <p>Escribinos y te armamos la cotización con el costo final. Sin compromiso, sin vueltas.</p>
      <div className="cieBtns">
        <a className="wa" href={wa} target="_blank" rel="noopener noreferrer"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3M12 21.8a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.7-.2-.4A9.9 9.9 0 1 1 12 21.8M20.5 3.5A11.8 11.8 0 0 0 12 0C5.5 0 .2 5.3.2 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7a11.9 11.9 0 0 0 5.7 1.4c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.4-8.4z" /></svg>WhatsApp</a>
        <a className="ml" href={`mailto:${mail}`}>{mail}</a>
      </div>
    </div>
  </section>;
}
