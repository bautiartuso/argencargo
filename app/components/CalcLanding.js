"use client";
// Sección "Calculadora de importación" de la landing (04/10/2026): texto + botón al portal y, a la
// derecha, una compu con la calculadora del portal en pantalla. La compu flota apenas (como el celu
// de Shippar) y, cuando la sección entra en pantalla, el presupuesto se arma renglón por renglón.
// Los números son un ejemplo ilustrativo; la calculadora real vive en el portal.
import { useEffect, useRef, useState } from "react";

const Ico = ({ d, size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.map((x, i) => <path key={i} d={x} />)}</svg>;
const CALC = ["M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", "M8 6h8v4H8z", "M8 14h.01", "M12 14h.01", "M16 14h.01", "M8 18h.01", "M12 18h.01", "M16 18h.01"];
const RAYO = ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"];
const PESO = ["M12 2v20", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"];

const CSS = `
.calcAC{max-width:1180px;margin:0 auto;padding:72px 24px;display:grid;grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr);gap:56px;align-items:center;color:var(--ink)}
.calcAC .kick{font-size:12.5px;font-weight:800;letter-spacing:0.14em;color:var(--cel);margin:0 0 14px}
.calcAC h2{font-size:clamp(30px,3.6vw,46px);line-height:1.08;font-weight:800;letter-spacing:-0.025em;margin:0 0 18px}
.calcAC .txt{font-size:17px;line-height:1.65;color:var(--txt2);margin:0 0 30px;max-width:470px}
.calcAC .txt p{margin:0 0 14px}.calcAC .txt p:last-child{margin:0}
.calcAC .cta{display:inline-flex;align-items:center;gap:10px;height:54px;padding:0 28px;border-radius:14px;background:#3B7DD8;color:#fff;font-weight:800;font-size:16px;text-decoration:none;box-shadow:0 10px 26px rgba(59,125,216,0.35);transition:transform 120ms}
.calcAC .cta:hover{transform:translateY(-2px)}
.calcAC .escena{position:relative;padding:28px 10px}
.calcAC .compu{animation:caFlota 6s ease-in-out infinite}
.calcAC .pantalla{container-type:inline-size;position:relative;border-radius:14px 14px 4px 4px;padding:2.2%;background:linear-gradient(180deg,#2B3342,#1A202B);box-shadow:0 30px 60px rgba(0,0,0,0.35),inset 0 0 0 1px rgba(255,255,255,0.08)}
.calcAC .ui{aspect-ratio:16/10;border-radius:6px;overflow:hidden;background:#0B1730;font-size:2cqw;color:#fff;display:flex;flex-direction:column;font-family:'Montserrat',system-ui,sans-serif;text-align:left}
.calcAC .base{height:14px;margin:0 -6%;border-radius:0 0 18px 18px;background:linear-gradient(180deg,#3A4352,#232A36);box-shadow:0 18px 30px rgba(0,0,0,0.25)}
.calcAC .base:before{content:"";display:block;width:16%;height:5px;margin:0 auto;border-radius:0 0 8px 8px;background:#1A1F28}
.calcAC .uiTop{display:flex;align-items:center;justify-content:space-between;padding:1.1em 1.6em;border-bottom:1px solid rgba(255,255,255,0.07)}
.calcAC .uiLogo{display:inline-flex;align-items:center;gap:0.5em}.calcAC .uiLogo img:first-child{height:1.5em;width:auto}.calcAC .uiLogo img:last-child{height:0.85em;width:auto}.calcAC .uiTop .uiPill{font-size:0.85em;font-weight:700;padding:0.45em 1em;border-radius:99em;background:rgba(59,125,216,0.2);color:#9CC3F0}
.calcAC .uiCuerpo{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:1.4em;padding:1.4em 1.6em}
.calcAC .campo{margin:0 0 0.85em}.calcAC .campo i{display:block;font-style:normal;font-size:0.72em;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin:0 0 0.35em}
.calcAC .campo div{padding:0.6em 0.8em;border-radius:0.5em;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);font-size:0.95em;font-weight:600}
.calcAC .canales{display:grid;grid-template-columns:1fr 1fr;gap:0.5em}.calcAC .canales div{text-align:center}.calcAC .canales .on{background:#3B7DD8;border-color:#3B7DD8}
.calcAC .res{border-radius:0.8em;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);padding:1.1em 1.2em;display:flex;flex-direction:column}
.calcAC .res p{margin:0 0 0.9em;font-size:0.78em;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.5)}
.calcAC .fila{display:flex;justify-content:space-between;font-size:0.95em;padding:0.55em 0;border-bottom:1px solid rgba(255,255,255,0.07);opacity:0;transform:translateY(0.6em);transition:opacity .5s,transform .5s}
.calcAC .fila span{color:rgba(255,255,255,0.7)}.calcAC .fila b{font-weight:700}
.calcAC .total{margin-top:0.4em;padding-top:0.9em;display:flex;justify-content:space-between;align-items:baseline;opacity:0;transform:scale(0.96);transition:opacity .5s,transform .5s}
.calcAC .total span{font-size:0.9em;font-weight:700}.calcAC .total b{font-size:1.7em;font-weight:800;color:#74ACDF}
.calcAC .unit{text-align:right;font-size:0.85em;color:rgba(255,255,255,0.55);margin-top:0.3em;opacity:0;transition:opacity .5s}
.calcAC.on .fila,.calcAC.on .total,.calcAC.on .unit{opacity:1;transform:none}
.calcAC.on .unit{transition-delay:2.5s}
.calcAC.on .fila:nth-of-type(1){transition-delay:.5s}.calcAC.on .fila:nth-of-type(2){transition-delay:1s}.calcAC.on .fila:nth-of-type(3){transition-delay:1.5s}.calcAC.on .total{transition-delay:2.1s}
.calcAC .chip{position:absolute;display:flex;gap:12px;align-items:flex-start;max-width:250px;padding:14px 16px;border-radius:16px;background:var(--card);border:1px solid var(--borde);box-shadow:0 16px 40px rgba(0,0,0,0.18);color:var(--ink)}
.calcAC .chip .ic{flex-shrink:0;width:34px;height:34px;border-radius:10px;background:var(--acsuave);color:#3B7DD8;display:inline-flex;align-items:center;justify-content:center}
.calcAC .chip b{display:block;font-size:14px;margin:0 0 3px}.calcAC .chip small{font-size:12.5px;color:var(--txt2);line-height:1.4}
.calcAC .chip.a{bottom:4px;left:-40px;animation:caFlota 7s ease-in-out infinite reverse}
.calcAC .chip.b{top:-2px;right:-24px;animation:caFlota 6.5s ease-in-out 1s infinite}
@keyframes caFlota{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@media(max-width:900px){.calcAC{grid-template-columns:1fr;gap:26px;padding:52px 20px;text-align:center}.calcAC .txt{margin:0 auto 24px}.calcAC .cta{width:100%;justify-content:center}.calcAC .escena{padding:22px 4px 30px}.calcAC .chip{max-width:200px;padding:10px 12px;gap:9px;text-align:left}.calcAC .chip .ic{width:28px;height:28px}.calcAC .chip b{font-size:12.5px}.calcAC .chip small{display:none}.calcAC .chip.a{left:-4px;bottom:6px}.calcAC .chip.b{right:-4px;top:-2px}}
@media (prefers-reduced-motion: reduce){.calcAC .compu,.calcAC .chip{animation:none}.calcAC .fila,.calcAC .total,.calcAC .unit{opacity:1;transform:none;transition:none}}
`;

export default function CalcLanding() {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section ref={ref} className={`calcAC${on ? " on" : ""}`} id="calculadora">
      <div>
        <p className="kick">GRATIS · DESDE NUESTRO PORTAL</p>
        <h2>Calculadora de importación</h2>
        <div className="txt"><p>Dentro de nuestro portal tenés una calculadora gratuita para cotizar tus envíos.</p><p>Ingresá los datos del producto y obtené el costo al instante.</p><p>No necesitás ser importador registrado.</p></div>
        <a className="cta" href="/portal"><Ico d={CALC} />Calculadora</a>
      </div>
      <div className="escena" aria-hidden="true">
        <div className="compu">
          <div className="pantalla"><div className="ui">
            <div className="uiTop"><span className="uiLogo"><img src="/argencargo/isotipo-blanco.png" alt="" /><img src="/argencargo/texto-blanco.png" alt="Argencargo" /></span><span className="uiPill">Calculadora</span></div>
            <div className="uiCuerpo">
              <div>
                <div className="campo"><i>Producto</i><div>Auriculares bluetooth</div></div>
                <div className="campo"><i>Cantidad · peso</i><div>200 u · 48 kg</div></div>
                <div className="campo"><i>Valor de la mercadería</i><div>USD 1.600</div></div>
                <div className="campo"><i>Canal</i><div className="canales" style={{ padding: 0, background: "none", border: "none" }}><div className="on">Aéreo</div><div>Marítimo</div></div></div>
              </div>
              <div className="res">
                <p>Costo estimado en Buenos Aires</p>
                <div className="fila"><span>Flete aéreo</span><b>USD 912</b></div>
                <div className="fila"><span>Impuestos</span><b>USD 548</b></div>
                <div className="fila"><span>Despacho y gestión</span><b>USD 120</b></div>
                <div className="total"><span>Total</span><b>USD 1.580</b></div>
                <div className="unit">USD 7,90 por unidad</div>
              </div>
            </div>
          </div></div>
          <div className="base" />
        </div>
        <div className="chip a"><span className="ic"><Ico d={RAYO} size={16} /></span><span><b>Cotizás en segundos</b><small>Cargás el producto y listo.</small></span></div>
        <div className="chip b"><span className="ic"><Ico d={PESO} size={16} /></span><span><b>Sabés el costo antes de comprar</b><small>Flete, impuestos y despacho.</small></span></div>
      </div>
    </section>
  </>;
}
