"use client";
import { useState, useEffect } from "react";
import { LD_ORGANIZATION, LD_WEBSITE } from "../lib/ld-argencargo";
import MarcoLanding from "./components/MarcoLanding";
import MapaRutas from "./components/MapaRutas";

const WA="5491125088580";
const AC="#3B7DD8";
const NAVY="#152D54";
const BG="#0a1223";
const waL=(m)=>`https://wa.me/${WA}?text=${encodeURIComponent(m)}`;

const FAQ=[
          {q:"¿Necesito ser importador registrado?",a:"No. Para courier no necesitás ningún registro especial. Para carga formal te asesoramos en todo el proceso."},
          {q:"¿Cuándo pago?",a:"Pagás cuando tu mercadería está en Argentina y lista para retirar. No antes."},
          {q:"¿Puedo importar desde Estados Unidos?",a:"Sí. Operamos envíos desde China y USA, por vía aérea y marítima."},
          {q:"¿Cómo sigo el estado de mi carga?",a:"Tenés un portal online con tracking real. Ves dónde está tu mercadería en todo momento."},
          {q:"¿Puedo traer cualquier producto?",a:"Casi todo. Hay restricciones para alimentos, medicamentos y materiales peligrosos. Consultanos y te confirmamos."},
          {q:"¿Hacen entregas a domicilio?",a:"Sí. Podés retirar en nuestra oficina de Buenos Aires o coordinar envío a domicilio si lo necesitás."},
];

const LD_FAQ={"@context":"https://schema.org","@type":"FAQPage",mainEntity:FAQ.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))};

export default function Landing(){
  const [faq,setFaq]=useState(null);
  const [reviews,setReviews]=useState(null);
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
  useEffect(()=>{fetch("/api/reviews").then(r=>r.json()).then(d=>{if(d&&!d.fallback&&Array.isArray(d.reviews)&&d.reviews.length>0)setReviews(d);}).catch(()=>{});},[]);

  return <div style={{fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif",color:"#fff",background:BG}}><MarcoLanding>

    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(LD_ORGANIZATION)}}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(LD_WEBSITE)}}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(LD_FAQ)}}/>

    {/* HERO (04/10/2026): el título y el mapa de rutas hacia Argentina. */}
    <section className="heroAC">
      <div className="heroTxt">
        <h1>Logística internacional para <span>negocios argentinos</span>.</h1>
        <p>Traemos tu mercadería desde China, Estados Unidos y Europa. Flete aéreo y marítimo, despacho de aduana y seguimiento en tiempo real.</p>
        <div className="heroBtns">
          <a className="b1" href="/portal">Cotizá gratis</a>
          <a className="b2" href={waL("Hola, quiero info para importar")} target="_blank" rel="noopener">Hablar con un asesor</a>
        </div>
      </div>
      <div className="heroMapa"><MapaRutas /></div>
    </section>

    {/* DOLOR → SOLUCIÓN */}
    <section style={{padding:"80px 24px",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
      <div style={{maxWidth:900,margin:"0 auto",textAlign:"center"}}>
        <h2 style={{fontSize:"clamp(22px, 3.5vw, 34px)",fontWeight:800,margin:"0 0 40px"}}>Lo que otros complican, nosotros lo simplificamos</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:20,textAlign:"left"}}>
          {[
            {pain:"\"No tengo idea cuánto me va a salir\"",fix:"Cotización detallada antes de mover un dedo. Todos los costos claros desde el inicio — flete, impuestos, gestión. Sin sorpresas."},
            {pain:"\"Me da miedo que se trabe en aduana\"",fix:"Nos encargamos de toda la gestión aduanera. Si surge algún tema, lo resolvemos y te mantenemos informado paso a paso."},
            {pain:"\"No sé en qué estado está mi carga\"",fix:"Tenés un portal donde ves exactamente dónde está tu mercadería. Tracking real del courier internacional, actualizado automáticamente."},
          ].map(s=><div key={s.pain} style={{padding:24,background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)"}}>
            <p style={{fontSize:14,fontWeight:600,color:"rgba(255,255,255,0.65)",margin:"0 0 12px",fontStyle:"italic"}}>{s.pain}</p>
            <div style={{width:32,height:2,background:AC,borderRadius:2,marginBottom:12}}/>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.6,margin:0}}>{s.fix}</p>
          </div>)}
        </div>
      </div>
    </section>

    {/* SERVICIOS */}
    <section id="servicios" style={{padding:"80px 24px",scrollMarginTop:100,background:`linear-gradient(180deg,${NAVY}15 0%,transparent 100%)`}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <p style={{fontSize:13,fontWeight:700,color:AC,textAlign:"center",marginBottom:8,letterSpacing:"0.1em"}}>CANALES DE ENVÍO</p>
        <h2 style={{fontSize:"clamp(22px, 3.5vw, 34px)",fontWeight:800,textAlign:"center",margin:"0 0 12px"}}>El canal que mejor se adapte a tu negocio</h2>
        <p style={{fontSize:15,color:"rgba(255,255,255,0.4)",textAlign:"center",margin:"0 auto 48px",maxWidth:500}}>Te asesoramos para que elijas la opción que más te conviene.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:20}}>
          {[
            {icon:"⚡",title:"Courier Aéreo",tag:"Rápido",points:["El canal más ágil","Régimen simplificado — sin tramiterío extra","Ideal para reposición de stock y muestras","Disponible desde China y USA"],color:"#e2a93b"},
            {icon:"🚢",title:"Marítimo",tag:"Gran volumen",points:["Consolidado (LCL) o contenedor completo (FCL)","El menor costo por unidad para grandes cargas","Tiempos y costos según consulta","Para quienes planifican con anticipación"],color:"#5BA0D9"},
          ].map(s=><div key={s.title} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"28px 24px",position:"relative"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${s.color},transparent)`}}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:28}}>{s.icon}</span>
                <h3 style={{fontSize:20,fontWeight:700,margin:0}}>{s.title}</h3>
              </div>
              <span style={{fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:20,background:`${s.color}15`,color:s.color,border:`1px solid ${s.color}30`}}>{s.tag}</span>
            </div>
            {s.points.map(p=><p key={p} style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"0 0 8px",paddingLeft:16,position:"relative"}}><span style={{position:"absolute",left:0,color:s.color}}>•</span>{p}</p>)}
            <div style={{marginTop:16}}><a href={waL(`Hola, quiero info sobre ${s.title}`)} target="_blank" style={{fontSize:12,fontWeight:600,color:s.color,textDecoration:"none"}}>Consultar sobre {s.title} →</a></div>
          </div>)}
        </div>
      </div>
    </section>

    {/* PROCESO */}
    <section id="como-funciona" style={{padding:"80px 24px"}}>
      <div style={{maxWidth:800,margin:"0 auto"}}>
        <p style={{fontSize:13,fontWeight:700,color:AC,textAlign:"center",marginBottom:8,letterSpacing:"0.1em"}}>CÓMO FUNCIONA</p>
        <h2 style={{fontSize:"clamp(22px, 3.5vw, 34px)",fontWeight:800,textAlign:"center",margin:"0 0 48px"}}>Importar con nosotros es así de simple</h2>
        {[
          {n:"01",title:"Nos contactás y cotizamos",desc:"Nos decís qué querés traer. Te armamos una cotización con todos los costos desglosados. Sin compromiso."},
          {n:"02",title:"Tu proveedor envía al depósito",desc:"Le pasás la dirección de nuestro depósito en China (o USA). Cuando la mercadería llega, te confirmamos."},
          {n:"03",title:"Nos encargamos de todo el envío",desc:"Transporte internacional, documentación, seguimiento y gestión de aduana. Vos te enfocás en tu negocio."},
          {n:"04",title:"Tu mercadería está lista",desc:"Te avisamos cuando llegó. Retirás en nuestra oficina o te la enviamos a domicilio. Vos elegís."},
        ].map(s=><div key={s.n} style={{display:"flex",gap:20,marginBottom:36,alignItems:"flex-start"}}>
          <div style={{flexShrink:0,width:44,height:44,borderRadius:10,background:`linear-gradient(135deg,${AC},${NAVY})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800}}>{s.n}</div>
          <div>
            <h3 style={{fontSize:17,fontWeight:700,margin:"0 0 6px"}}>{s.title}</h3>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.6,margin:0}}>{s.desc}</p>
          </div>
        </div>)}
      </div>
    </section>

    {/* CALCULADORA BANNER */}
    <section style={{padding:"60px 24px",background:`linear-gradient(135deg,${NAVY}40,${AC}15)`}}>
      <div style={{maxWidth:700,margin:"0 auto",textAlign:"center"}}>
        <p style={{fontSize:40,margin:"0 0 16px"}}>🧮</p>
        <h2 style={{fontSize:"clamp(20px, 3vw, 28px)",fontWeight:800,margin:"0 0 10px"}}>Calculadora de importación</h2>
        <p style={{fontSize:15,color:"rgba(255,255,255,0.55)",margin:"0 0 24px",lineHeight:1.6}}>Dentro de nuestro portal tenés una calculadora para cotizar tus cargas de forma gratuita. Ingresá los datos de tu producto y obtené el costo estimado al instante.</p>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 24px"}}>No necesitás ser importador registrado. Creá tu cuenta gratis y empezá a cotizar.</p>
        <a href="/portal" style={{display:"inline-block",padding:"14px 32px",fontSize:15,fontWeight:700,borderRadius:10,background:`linear-gradient(135deg,${AC},${NAVY})`,color:"#fff",textDecoration:"none"}}>Ir a la calculadora →</a>
      </div>
    </section>

    {/* DIFERENCIADORES */}
    <section id="quienes-somos" style={{padding:"60px 24px",scrollMarginTop:100}}>
      <div style={{maxWidth:1000,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16}}>
          {[
            {icon:"🇦🇷",title:"Empresa argentina",desc:"Oficina en Buenos Aires. Atención directa, sin intermediarios."},
            {icon:"🇨🇳",title:"Depósito en China y USA",desc:"Recibimos tu mercadería directo del proveedor en origen."},
            {icon:"📱",title:"Tu propio portal",desc:"Seguimiento online, documentación y estado de cada operación."},
            {icon:"🤝",title:"Te acompañamos",desc:"Desde la primera consulta hasta que tenés tu carga. Siempre."},
          ].map(f=><div key={f.title} style={{padding:20,background:"rgba(255,255,255,0.02)",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)"}}>
            <p style={{fontSize:28,margin:"0 0 10px"}}>{f.icon}</p>
            <h4 style={{fontSize:14,fontWeight:700,margin:"0 0 4px"}}>{f.title}</h4>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.45)",margin:0,lineHeight:1.5}}>{f.desc}</p>
          </div>)}
        </div>
      </div>
    </section>

    {/* RESEÑAS GOOGLE (sólo aparece si la API devuelve datos) */}
    {reviews&&<section style={{padding:"70px 24px",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:12,padding:"10px 20px",borderRadius:40,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.6)",letterSpacing:"0.05em"}}>RESEÑAS DE GOOGLE</span>
          </div>
          <h2 style={{fontSize:"clamp(22px, 3.5vw, 34px)",fontWeight:800,margin:"20px 0 8px"}}>Lo que dicen nuestros clientes</h2>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginTop:4}}>
            <span style={{fontSize:28,fontWeight:800,color:"#fbbf24"}}>{reviews.rating?.toFixed(1)}</span>
            <div style={{display:"flex",gap:2}}>{[1,2,3,4,5].map(n=><span key={n} style={{fontSize:20,color:n<=Math.round(reviews.rating||0)?"#fbbf24":"rgba(255,255,255,0.15)"}}>★</span>)}</div>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.45)"}}>· {reviews.total} reseñas</span>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
          {reviews.reviews.slice(0,4).map((rv,i)=><div key={i} style={{padding:22,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",gap:2,marginBottom:10}}>{[1,2,3,4,5].map(n=><span key={n} style={{fontSize:14,color:n<=rv.rating?"#fbbf24":"rgba(255,255,255,0.12)"}}>★</span>)}</div>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.72)",lineHeight:1.6,margin:"0 0 16px",flex:1,fontStyle:"italic"}}>"{rv.text?.length>220?rv.text.slice(0,217)+"...":rv.text}"</p>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {rv.photo&&<img src={rv.photo} alt="" style={{width:32,height:32,borderRadius:"50%"}} referrerPolicy="no-referrer"/>}
              <div><p style={{fontSize:13,fontWeight:700,color:"#fff",margin:0}}>{rv.author}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"2px 0 0"}}>{rv.relativeTime}</p></div>
            </div>
          </div>)}
        </div>
        <div style={{textAlign:"center",marginTop:28}}>
          <a href="https://g.page/r/argencargo/review" target="_blank" rel="noopener noreferrer" style={{fontSize:13,fontWeight:600,color:AC,textDecoration:"none"}}>Ver todas en Google →</a>
        </div>
      </div>
    </section>}

    {/* FAQ */}
    <section style={{padding:"60px 24px",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
      <div style={{maxWidth:700,margin:"0 auto"}}>
        <h2 style={{fontSize:"clamp(20px, 3vw, 28px)",fontWeight:800,textAlign:"center",margin:"0 0 32px"}}>Preguntas frecuentes</h2>
        {FAQ.map((f,i)=><div key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <button onClick={()=>setFaq(faq===i?null:i)} aria-expanded={faq===i} style={{width:"100%",padding:"16px 0",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",color:"#fff",fontSize:15,fontWeight:600,textAlign:"left"}}>
            {f.q}<span style={{fontSize:18,color:"rgba(255,255,255,0.3)",flexShrink:0,marginLeft:12}}>{faq===i?"−":"+"}</span>
          </button>
          {faq===i&&<p style={{fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.7,margin:"0 0 16px"}}>{f.a}</p>}
        </div>)}
      </div>
    </section>

    {/* CTA FINAL */}
    <section style={{padding:"80px 24px",textAlign:"center",background:`radial-gradient(ellipse at 50% 80%, ${NAVY}20 0%, transparent 60%)`}}>
      <div style={{maxWidth:550,margin:"0 auto"}}>
        <h2 style={{fontSize:"clamp(24px, 4vw, 36px)",fontWeight:800,margin:"0 0 12px"}}>¿Querés empezar?</h2>
        <p style={{fontSize:16,color:"rgba(255,255,255,0.5)",margin:"0 0 32px"}}>Escribinos y armamos tu cotización. Sin compromiso, sin requisitos.</p>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
          <a href={waL("Hola! Quiero cotizar una importación")} target="_blank" rel="noopener" style={{display:"inline-flex",alignItems:"center",gap:10,padding:"16px 32px",fontSize:16,fontWeight:700,borderRadius:12,background:"#25D366",color:"#0a1223",textDecoration:"none",boxShadow:"0 4px 20px rgba(37,211,102,0.3)"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#0a1223" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
          <a href="/portal" style={{padding:"16px 32px",fontSize:16,fontWeight:700,borderRadius:12,border:`1.5px solid ${AC}40`,background:`${AC}10`,color:AC,textDecoration:"none"}}>Crear cuenta gratis</a>
        </div>
      </div>
    </section>

    {/* WA FLOTANTE */}
    <a href={waL("Hola! Quiero info sobre importaciones")} target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp" title="Escribinos por WhatsApp" style={{position:"fixed",bottom:24,right:24,width:60,height:60,borderRadius:"50%",background:"#25D366",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(37,211,102,0.4)",zIndex:99}}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="#0a1223" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>

    <style>{`.heroAC{max-width:1180px;margin:0 auto;padding:56px 24px 40px;display:grid;grid-template-columns:minmax(0,0.85fr) minmax(0,1.15fr);gap:28px;align-items:center}.heroAC h1{font-size:clamp(34px,4.6vw,58px);line-height:1.04;font-weight:800;letter-spacing:-0.025em;margin:0 0 20px}.heroAC h1 span{color:#74ACDF}.heroAC p{font-size:17px;line-height:1.6;color:rgba(255,255,255,0.62);margin:0 0 28px;max-width:470px}.heroBtns{display:flex;gap:12px;flex-wrap:wrap}.heroBtns a{display:inline-flex;align-items:center;justify-content:center;height:52px;padding:0 26px;border-radius:14px;font-weight:800;font-size:15.5px;text-decoration:none}.heroBtns .b1{background:#fff;color:#0a1223}.heroBtns .b2{border:1.5px solid rgba(255,255,255,0.16);color:#fff}@media(max-width:900px){.heroAC{grid-template-columns:1fr;padding:22px 20px 28px;gap:6px}.heroMapa{order:-1;margin:0 -12px}.heroAC h1{font-size:34px;margin-bottom:14px}.heroAC p{font-size:15.5px;margin-bottom:22px}.heroBtns{flex-direction:column}.heroBtns a{height:50px}}@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important;gap:32px!important;}.hero-dash{display:none!important;}}html{scroll-behavior:smooth;}*{box-sizing:border-box;}`}</style>
  </MarcoLanding></div>;
}
