"use client";
import { useEffect } from "react";
import { LD_ORGANIZATION, LD_WEBSITE } from "../lib/ld-argencargo";
import MarcoLanding from "./components/MarcoLanding";
import MapaRutas from "./components/MapaRutas";
import CalcLanding from "./components/CalcLanding";
import { Dudas, Cierre, DUDAS } from "./components/SeccionesLanding";

const WA="5491125088580";
const waL=(m)=>`https://wa.me/${WA}?text=${encodeURIComponent(m)}`;

const FAQ=DUDAS.map(d=>({q:d.q,a:d.a}));

// Reseñas de Google copiadas a mano (04/10/2026, ordenadas por "Valoración más alta"; 4,8 ★ con 53 opiniones).
// Cuando estén GOOGLE_PLACES_API_KEY y GOOGLE_PLACE_ID en Vercel, /api/reviews las puede traer solas.
const RESENAS=[
  {n:"Ana Laura Fernandez",t:"Excelente todo!! Bautista me asesoró con mucha paciencia ya que era mi primera importación, cumplió con todo lo pactado e incluso recibí mi mercadería antes de lo esperado. Super recomendable!"},
  {n:"Gabriel Romero",t:"Excelente servicio, Bautista siempre estuvo en contacto informando todo el movimiento, el envío salió el Lunes de China el Jueves de la misma semana estaba en Buenos Aires 👏👏👏"},
  {n:"stephanie lich",t:"El mejor servicio, la verdad, rapidísimo. Y Bautista por lejos es el mejor asesor. Trabaje con muchos couriers, pero ninguno supo brindarme un servicio tan bueno como este!"},
  {n:"Matias Mussi",t:"Muy buen servicio, venimos trabajando ya hace un año y siempre cumplen. Tienen buena atencion tambien"},
  {n:"Fernando Ruscitti",t:"Compré repuestos para la moto, y muy buena experiencia, llegaron muy rápido, más rápido que otros couriers y en perfecto estado. Muy recomendable."},
  {n:"Pablo Rios",t:"Excelente experiencia por la personalizada atencion y seguimiento, la seriedad de la empresa y la velocidad en la recepcion de los envios."},
  {n:"Natalia Dubovitsky",t:"Cumplieron en todo. Traje de china un scooter electrico y llegó perfecto"},
  {n:"Pablo Avalos",t:"Todo perfecto, muy buena atención, mi pedido desde Miami llegó en tiempo y forma."},
  {n:"Delfina Maioli",t:"Excelente servicio, pedi unos repuestos para el auto y llegó como esperaba en tiempo y forma!"},
  {n:"Clara Font",t:"Todo excelente! Muy buen servicio! Súper recomendable. Bautista muy atento en todo!"},
];
const GOOGLE_G=<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>;

const LD_FAQ={"@context":"https://schema.org","@type":"FAQPage",mainEntity:FAQ.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))};

export default function Landing(){
  // Si el cliente llega al root con hash de Supabase (recovery / signup confirm) o con error en
  // query string (ej. ?error=access_denied), reenviar a /portal preservando todo. Pasa cuando
  // Supabase Site URL apunta a "/" en vez de "/portal", o cuando el redirect_to no está whitelisted.
  useEffect(()=>{
    if(typeof window==="undefined")return;
    const h=window.location.hash||"";
    const qs=window.location.search||"";
    const isRecoveryHash=h.includes("type=recovery")||h.includes("type=signup")||h.includes("access_token=")||h.includes("error=");
    const isErrorQs=qs.includes("error=")||qs.includes("error_code=");
    if(isRecoveryHash||isErrorQs){
      window.location.replace("/portal"+qs+h);
    }
  },[]);

  return <div style={{fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif"}}><MarcoLanding>

    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(LD_ORGANIZATION)}}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(LD_WEBSITE)}}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(LD_FAQ)}}/>

    {/* HERO (04/10/2026): el título y el mapa de rutas hacia Argentina. */}
    <section className="heroAC">
      <h1>Logística internacional para <span>negocios argentinos</span>.</h1>
      <div className="heroMapa"><MapaRutas /></div>
    </section>

    {/* RESEÑAS DE GOOGLE (04/10/2026): cinta que se mueve sola, justo debajo del título. */}
    <section className="resAC" aria-label="Opiniones en Google">
      <a className="resCab" href="https://www.google.com/search?q=ARGENCARGO+Virrey+Loreto+2428+opiniones" target="_blank" rel="noopener noreferrer">
        {GOOGLE_G}<b>4,8</b><span className="est">★★★★★</span><span className="cnt">53 opiniones en Google</span>
      </a>
      <div className="resCinta"><div className="resPista">
        {[...RESENAS,...RESENAS].map((r,i)=><figure key={i} className="resCard" aria-hidden={i>=RESENAS.length}>
          <span className="est">★★★★★</span>
          <blockquote>{r.t}</blockquote>
          <figcaption><span className="ini">{r.n.trim()[0].toUpperCase()}</span>{r.n}</figcaption>
        </figure>)}
      </div></div>
    </section>


    {/* CALCULADORA (04/10/2026): texto + compu con la calculadora del portal. */}
    <CalcLanding />

    {/* DUDAS (04/10/2026): lo que otros complican + preguntas frecuentes, en 6 tarjetas. */}
    <Dudas />

    {/* CIERRE (04/10/2026): a todo el ancho con foto, WhatsApp y mail. */}
    <Cierre wa={waL("Hola! Quiero cotizar una importación")} mail="info@argencargo.com.ar" />

    {/* WA FLOTANTE */}
    <a href={waL("Hola! Quiero info sobre importaciones")} target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp" title="Escribinos por WhatsApp" style={{position:"fixed",bottom:24,right:24,width:60,height:60,borderRadius:"50%",background:"#25D366",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(37,211,102,0.4)",zIndex:99}}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="#0a1223" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>

    <style>{`.resAC{padding:8px 0 64px}.resCab{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 auto 26px;width:max-content;max-width:calc(100% - 32px);padding:10px 18px;border-radius:999px;background:var(--sup);border:1px solid var(--supB);color:var(--ink);text-decoration:none;font-weight:700;font-size:15px}.resCab b{font-size:20px}.resCab .est,.resCard .est{color:#FBBC04;letter-spacing:2px}.resCab .cnt{color:var(--txt2);font-weight:600}.resCinta{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}.resPista{display:flex;gap:16px;width:max-content;animation:resDesfile 70s linear infinite;padding:4px 0}.resCinta:hover .resPista{animation-play-state:paused}@keyframes resDesfile{to{transform:translateX(calc(-50% - 8px))}}.resCard{margin:0;width:340px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;padding:22px;border-radius:18px;background:var(--sup);border:1px solid var(--supB)}.resCard blockquote{margin:0;flex:1;font-size:15px;line-height:1.55;color:var(--txt)}.resCard figcaption{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700;color:var(--ink);text-transform:capitalize}.resCard .ini{width:32px;height:32px;border-radius:50%;background:#3B7DD8;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px}@media(max-width:640px){.resCard{width:280px;padding:18px}.resCard blockquote{font-size:14px}.resCab{font-size:13.5px;gap:8px;padding:9px 14px}.resCab b{font-size:17px}.resPista{animation-duration:55s}}@media (prefers-reduced-motion: reduce){.resPista{animation:none}.resCinta{overflow-x:auto}}.heroAC{max-width:1100px;margin:0 auto;padding:56px 24px 48px;text-align:center;color:var(--ink)}.heroAC h1{font-size:clamp(40px,5.6vw,72px);line-height:1.04;font-weight:800;letter-spacing:-0.03em;margin:0 auto 28px;max-width:900px}.heroAC h1 span{color:var(--cel)}.heroMapa{max-width:980px;margin:0 auto}@media(max-width:900px){.heroAC{padding:26px 16px 30px}.acl .heroAC h1{font-size:44px!important;line-height:1.02!important;margin-bottom:10px}.heroMapa{margin:0 -8px}}@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important;gap:32px!important;}.hero-dash{display:none!important;}}html{scroll-behavior:smooth;}*{box-sizing:border-box;}`}</style>
  </MarcoLanding></div>;
}
