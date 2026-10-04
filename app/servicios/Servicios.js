"use client";
import MarcoLanding from "../components/MarcoLanding";

const WA = "5491125088580";
const waL = (m) => `https://wa.me/${WA}?text=${encodeURIComponent(m)}`;

const SERVICIOS = [
  {
    k: "aereo",
    titulo: "Flete aéreo",
    bajada: "La forma más rápida de traer tu mercadería. Ideal para reposición de stock, muestras y envíos que no pueden esperar.",
    puntos: [
      "Si le comprás a varios proveedores, juntamos todo en un solo envío.",
      "Nos ocupamos de la aduana: vos no hacés ningún trámite.",
      "Lo seguís desde tu portal y lo retirás en nuestra oficina o te lo llevamos a domicilio.",
    ],
    ico: ["M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"],
    wa: "Hola! Quiero consultar por flete aéreo",
  },
  {
    k: "maritimo",
    titulo: "Flete marítimo",
    bajada: "Para cargas grandes, el menor costo por unidad. Pensado para quienes planifican sus compras con anticipación.",
    puntos: [
      "Carga consolidada (compartís el contenedor) o contenedor completo.",
      "Despacho de aduana y entrega en destino a cargo nuestro.",
      "Seguís cada etapa desde tu portal, del depósito hasta que llega.",
    ],
    ico: ["M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1", "M19.4 18L21 12l-9-4-9 4 1.6 6", "M12 2v6", "M8 5h8"],
    wa: "Hola! Quiero consultar por flete marítimo",
  },
  {
    k: "pagos",
    titulo: "Gestión de pagos internacionales",
    bajada: "Te ayudamos a pagarle a tu proveedor del exterior, sin que tengas que resolverlo por tu cuenta.",
    puntos: [
      "Pagos a proveedores de China y de otros países.",
      "Te confirmamos cada pago con su comprobante.",
      "Un solo equipo para pagar, traer y entregar.",
    ],
    ico: ["M3 7h18v12H3z", "M3 11h18", "M7 15h3", "M16 15h2"],
    wa: "Hola! Quiero consultar por pagos a proveedores del exterior",
  },
  {
    k: "retenidos",
    titulo: "Liberación de envíos retenidos",
    bajada: "¿Se te quedó un envío courier trabado en la aduana? Te ayudamos a liberarlo.",
    puntos: [
      "Revisamos por qué quedó retenido y qué te están pidiendo.",
      "Preparamos la documentación que necesita la aduana.",
      "Hacemos el trámite hasta que el envío queda liberado.",
      "Te mantenemos al tanto en cada paso, sin vueltas.",
    ],
    ico: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M9 12l2 2 4-4"],
    wa: "Hola! Tengo un envío retenido en la aduana y quiero liberarlo",
  },
];

const Ico = ({ d, size = 26 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.map((x, i) => <path key={i} d={x} />)}</svg>;
const CHECK = ["M20 6L9 17l-5-5"];

const CSS = `
.srvAC{max-width:1100px;margin:0 auto;padding:56px 24px 88px;color:var(--ink)}
.srvAC .cab{text-align:center;margin:0 auto 48px;max-width:720px}
.srvAC .cab p{margin:0 0 12px;font-size:12.5px;font-weight:800;letter-spacing:0.14em;color:var(--cel)}
.srvAC .cab h1{margin:0;font-size:clamp(36px,5vw,60px);line-height:1.04;font-weight:800;letter-spacing:-0.03em}
.srvLista{display:flex;flex-direction:column;gap:20px}
.srvCard{display:grid;grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr);gap:40px;padding:40px;border-radius:24px;background:var(--sup);border:1px solid var(--supB);scroll-margin-top:110px}
.srvCard .ic{width:56px;height:56px;border-radius:16px;background:var(--acsuave);color:#3B7DD8;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px}
.srvCard h2{margin:0 0 14px;font-size:clamp(24px,2.6vw,32px);line-height:1.12;font-weight:800;letter-spacing:-0.02em}
.srvCard .bajada{margin:0 0 24px;font-size:16.5px;line-height:1.6;color:var(--txt2)}
.srvCard .wa{display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 20px;border-radius:12px;background:#3B7DD8;color:#fff;font-weight:800;font-size:14.5px;text-decoration:none}
.srvCard ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px;align-self:center}
.srvCard li{display:flex;gap:12px;font-size:15.5px;line-height:1.5;color:var(--txt)}
.srvCard li span{flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--acsuave);color:#3B7DD8;display:inline-flex;align-items:center;justify-content:center;margin-top:1px}
@media(max-width:820px){.srvAC{padding:28px 16px 64px}.srvAC .cab{margin-bottom:28px}.acl .srvAC .cab h1{font-size:40px!important;line-height:1.05!important}.srvCard{grid-template-columns:1fr;gap:22px;padding:26px 20px}.srvCard .wa{width:100%;justify-content:center}.srvCard ul{order:2}.srvCard .izq{display:contents}.srvCard .izq .wa{order:3}}
`;

export default function Servicios() {
  return <div style={{ fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}><MarcoLanding>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <main className="srvAC">
      <div className="cab"><h1>Servicios</h1></div>
      <div className="srvLista">
        {SERVICIOS.map((s) => <section key={s.k} id={s.k} className="srvCard">
          <div className="izq">
            <div>
              <span className="ic"><Ico d={s.ico} /></span>
              <h2>{s.titulo}</h2>
              <p className="bajada">{s.bajada}</p>
            </div>
            <a className="wa" href={waL(s.wa)} target="_blank" rel="noopener noreferrer">Consultar por WhatsApp →</a>
          </div>
          <ul>{s.puntos.map((p) => <li key={p}><span><Ico d={CHECK} size={14} /></span>{p}</li>)}</ul>
        </section>)}
      </div>
    </main>
  </MarcoLanding></div>;
}
