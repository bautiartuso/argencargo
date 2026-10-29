"use client";
import MarcoLanding from "../components/MarcoLanding";
import { CARRIER_LOGOS } from "../../lib/carrier-logos";
import { WA, WA_MSG, CAUSAS, PASOS, NECESITAMOS, FAQ } from "./contenido";

const waL = (m) => `https://wa.me/${WA}?text=${encodeURIComponent(m)}`;
const Ico = ({ d, size = 22 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.map((x, i) => <path key={i} d={x} />)}</svg>;
const CHECK = ["M20 6L9 17l-5-5"];
const ALERTA = ["M12 9v4", "M12 17h.01", "M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"];
const WA_ICO = "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3Z";

const CSS = `
.libAC{max-width:1100px;margin:0 auto;padding:56px 24px 96px;color:var(--ink)}
.libAC .eyebrow{margin:0 0 14px;font-size:12.5px;font-weight:800;letter-spacing:0.14em;color:var(--cel);text-transform:uppercase}
.libAC .hero{max-width:780px;margin:0 auto 18px;text-align:center}
.libAC h1{margin:0;font-size:clamp(34px,5vw,58px);line-height:1.05;font-weight:800;letter-spacing:-0.03em}
.libAC .lead{margin:20px auto 0;max-width:640px;font-size:18px;line-height:1.6;color:var(--txt2)}
.libAC .ctas{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:28px}
.libAC .btnWa{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 24px;border-radius:14px;background:#25D366;color:#fff;font-weight:800;font-size:15.5px;text-decoration:none;box-shadow:0 10px 26px rgba(37,211,102,0.28)}
.libAC .btnSec{display:inline-flex;align-items:center;height:52px;padding:0 22px;border-radius:14px;border:1px solid var(--supB);background:var(--sup);color:var(--ink);font-weight:700;font-size:15px;text-decoration:none}
.libAC .couriers{display:flex;gap:10px;justify-content:center;margin:34px 0 64px;flex-wrap:wrap}
.libAC .couriers span{height:44px;width:120px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center}
.libAC section{margin-top:72px;scroll-margin-top:110px}
.libAC h2{margin:0 0 10px;font-size:clamp(26px,3vw,38px);line-height:1.12;font-weight:800;letter-spacing:-0.02em}
.libAC .sub{margin:0 0 28px;font-size:16.5px;line-height:1.6;color:var(--txt2);max-width:700px}
.libAC .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.libAC .card{padding:24px;border-radius:20px;background:var(--sup);border:1px solid var(--supB)}
.libAC .card h3{margin:0 0 8px;font-size:17px;line-height:1.3;font-weight:800}
.libAC .card p{margin:0;font-size:15px;line-height:1.6;color:var(--txt2)}
.libAC .card .ic{width:40px;height:40px;border-radius:12px;background:var(--acsuave);color:#3B7DD8;display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px}
.libAC .pasos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;counter-reset:p}
.libAC .paso .n{display:inline-flex;width:36px;height:36px;border-radius:50%;align-items:center;justify-content:center;background:#3B7DD8;color:#fff;font-weight:800;font-size:15px;margin-bottom:14px}
.libAC .dos{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr);gap:16px;align-items:stretch}
.libAC ul.chk{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:13px}
.libAC ul.chk li{display:flex;gap:12px;font-size:15.5px;line-height:1.5}
.libAC ul.chk li span{flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--acsuave);color:#3B7DD8;display:inline-flex;align-items:center;justify-content:center;margin-top:1px}
.libAC .aviso{padding:26px;border-radius:20px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3)}
.libAC .aviso .ic{color:#f59e0b;background:rgba(245,158,11,0.14)}
.libAC .faq{display:flex;flex-direction:column;gap:10px}
.libAC details{border-radius:16px;background:var(--sup);border:1px solid var(--supB);padding:0 22px}
.libAC summary{list-style:none;cursor:pointer;padding:20px 0;font-size:16.5px;font-weight:700;display:flex;justify-content:space-between;gap:14px;align-items:center}
.libAC summary::-webkit-details-marker{display:none}
.libAC summary .mas{flex-shrink:0;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--acsuave);color:#3B7DD8;font-size:18px;transition:transform .2s}
.libAC details[open] summary .mas{transform:rotate(45deg)}
.libAC details p{margin:0 0 20px;font-size:15.5px;line-height:1.65;color:var(--txt2)}
.libAC .final{margin-top:80px;padding:44px 32px;border-radius:24px;text-align:center;background:linear-gradient(135deg,#0A3D91,#1E6FD9);color:#fff}
.libAC .final h2{color:#fff}
.libAC .final p{margin:0 auto 26px;max-width:560px;font-size:16.5px;line-height:1.6;color:rgba(255,255,255,0.85)}
@media(max-width:900px){.libAC .grid{grid-template-columns:repeat(2,minmax(0,1fr))}.libAC .pasos{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.libAC{padding:28px 16px 64px}.libAC .lead{font-size:16.5px}.libAC .grid,.libAC .pasos,.libAC .dos{grid-template-columns:1fr}.libAC section{margin-top:52px}.libAC .btnWa,.libAC .btnSec{width:100%;justify-content:center}.libAC .couriers{margin:26px 0 44px}.libAC .couriers span{width:96px;height:38px}.libAC .final{padding:32px 20px}}
`;

export default function Liberacion() {
  return <div style={{ fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}><MarcoLanding>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <main className="libAC">
      <div className="hero">
        <p className="eyebrow">Aduana · Envíos courier</p>
        <h1>Liberación de envíos courier retenidos en la Aduana</h1>
        <p className="lead">¿Tu paquete de DHL, FedEx o UPS quedó retenido? Vemos por qué se frenó, te decimos cuánto cuesta y hacemos todo el trámite hasta que lo tenés en tus manos.</p>
        <div className="ctas">
          <a className="btnWa" href={waL(WA_MSG)} target="_blank" rel="noopener noreferrer"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d={WA_ICO} /></svg>Consultar por WhatsApp</a>
          <a className="btnSec" href="#que-necesitamos">Qué necesitamos</a>
        </div>
      </div>
      <div className="couriers" aria-label="Couriers">
        {["dhl", "fedex", "ups"].map((k) => { const l = CARRIER_LOGOS[k]; return <span key={k} style={{ background: l.bg }}><svg viewBox={l.vb} style={{ height: k === "ups" ? 30 : k === "fedex" ? 20 : 14, width: "auto" }} role="img" aria-label={k.toUpperCase()}><path d={l.d} fill={l.fill} /></svg></span>; })}
      </div>

      <section id="por-que">
        <p className="eyebrow">Los motivos más comunes</p>
        <h2>¿Por qué la Aduana retiene un envío courier?</h2>
        <p className="sub">Casi siempre es por uno de estos motivos. Saber cuál es el tuyo es lo primero para liberarlo rápido.</p>
        <div className="grid">
          {CAUSAS.map((c) => <div key={c.t} className="card"><span className="ic"><Ico d={ALERTA} size={20} /></span><h3>{c.t}</h3><p>{c.d}</p></div>)}
        </div>
      </section>

      <section id="como-lo-liberamos">
        <p className="eyebrow">Cómo trabajamos</p>
        <h2>Cómo liberamos tu envío</h2>
        <p className="sub">Vos nos pasás los datos y nosotros nos ocupamos del resto. Sin que tengas que ir a la Aduana ni hablar con el courier.</p>
        <div className="pasos">
          {PASOS.map((p, i) => <div key={p.t} className="card paso"><span className="n">{i + 1}</span><h3>{p.t}</h3><p>{p.d}</p></div>)}
        </div>
      </section>

      <section id="que-necesitamos">
        <p className="eyebrow">Para empezar</p>
        <h2>Qué necesitamos</h2>
        <div className="dos">
          <div className="card"><ul className="chk">{NECESITAMOS.map((n) => <li key={n}><span><Ico d={CHECK} size={14} /></span>{n}</li>)}</ul></div>
          <div className="aviso">
            <span className="card ic" style={{ padding: 0, border: "none", width: 40, height: 40, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Ico d={ALERTA} size={20} /></span>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Cuanto antes, mejor</h3>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "var(--txt2)" }}>Mientras el envío está retenido, el courier y el depósito cobran almacenaje por día. Y si pasa mucho tiempo, la mercadería puede quedar en rezago. Si no tenés todos los papeles, escribinos igual: arrancamos con lo que haya.</p>
          </div>
        </div>
      </section>

      <section id="preguntas-frecuentes">
        <p className="eyebrow">Preguntas frecuentes</p>
        <h2>Lo que más nos preguntan</h2>
        <div className="faq">
          {FAQ.map((f, i) => <details key={f.q} open={i === 0}><summary>{f.q}<span className="mas">+</span></summary><p>{f.a}</p></details>)}
        </div>
      </section>

      <div className="final">
        <h2>¿Tenés un envío retenido?</h2>
        <p>Mandanos el tracking por WhatsApp y te decimos qué pasó, qué hay que hacer y cuánto cuesta. Sin compromiso.</p>
        <a className="btnWa" href={waL(WA_MSG)} target="_blank" rel="noopener noreferrer"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d={WA_ICO} /></svg>Escribinos por WhatsApp</a>
      </div>
    </main>
  </MarcoLanding></div>;
}
