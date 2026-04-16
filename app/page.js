"use client";
import { useState, useEffect } from "react";

const LOGO="https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const WA_NUMBER="5491161000000"; // TODO: reemplazar con número real
const IC="#4A90D9";
const DARK="#0f1b30";

const scrollTo=(id)=>{document.getElementById(id)?.scrollIntoView({behavior:"smooth"});};

export default function Landing(){
  const [scrolled,setScrolled]=useState(false);
  const [calcForm,setCalcForm]=useState({product:"",weight:"",value:"",name:"",email:"",phone:""});
  const [calcStep,setCalcStep]=useState(1);

  useEffect(()=>{
    const onScroll=()=>setScrolled(window.scrollY>50);
    window.addEventListener("scroll",onScroll);
    return()=>window.removeEventListener("scroll",onScroll);
  },[]);

  const Inp=({label,value,onChange,placeholder,type="text",half})=><div style={{flex:half?"1":"auto"}}>
    <label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",display:"block",marginBottom:4}}>{label}</label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/>
  </div>;

  return <div style={{fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif",color:"#fff",background:DARK}}>

    {/* NAV */}
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"14px 0",background:scrolled?"rgba(15,27,48,0.95)":"transparent",backdropFilter:scrolled?"blur(20px)":"none",borderBottom:scrolled?"1px solid rgba(255,255,255,0.06)":"none",transition:"all 0.3s"}}>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"0 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <img src={LOGO} alt="Argencargo" style={{height:36,cursor:"pointer"}} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}/>
        <div style={{display:"flex",alignItems:"center",gap:20}} className="desktop-nav">
          {[{l:"Servicios",id:"servicios"},{l:"Cómo funciona",id:"proceso"},{l:"Cotizar",id:"cotizar"}].map(x=>
            <a key={x.id} onClick={()=>scrollTo(x.id)} style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.7)",cursor:"pointer",textDecoration:"none"}}>{x.l}</a>
          )}
          <a href="/portal" style={{fontSize:13,fontWeight:700,color:IC,textDecoration:"none"}}>Mi portal →</a>
          <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener" style={{padding:"8px 18px",fontSize:12,fontWeight:700,borderRadius:8,background:"linear-gradient(135deg,#1B4F8A,#4A90D9)",color:"#fff",textDecoration:"none"}}>Contactar</a>
        </div>
      </div>
    </nav>

    {/* HERO */}
    <section style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"120px 24px 80px",background:"radial-gradient(ellipse at 30% 20%, rgba(74,144,217,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(27,79,138,0.1) 0%, transparent 50%)"}}>
      <div style={{maxWidth:800}}>
        <p style={{fontSize:14,fontWeight:700,color:IC,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:16}}>Importaciones desde China y el mundo</p>
        <h1 style={{fontSize:"clamp(32px, 5vw, 56px)",fontWeight:800,lineHeight:1.1,margin:"0 0 20px",background:"linear-gradient(135deg, #fff 0%, #94b8db 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Logística internacional para negocios que crecen
        </h1>
        <p style={{fontSize:"clamp(16px, 2.5vw, 20px)",color:"rgba(255,255,255,0.6)",lineHeight:1.6,margin:"0 0 36px",maxWidth:600,marginLeft:"auto",marginRight:"auto"}}>
          Aéreo courier, carga aérea y marítimo. Seguimiento en tiempo real, despacho de aduana y entrega puerta a puerta en Argentina.
        </p>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={()=>scrollTo("cotizar")} style={{padding:"14px 32px",fontSize:15,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#1B4F8A,#4A90D9)",color:"#fff",boxShadow:"0 4px 20px rgba(74,144,217,0.3)"}}>Cotizar envío →</button>
          <a href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Hola! Quiero información sobre importaciones desde China")}`} target="_blank" rel="noopener" style={{padding:"14px 32px",fontSize:15,fontWeight:700,borderRadius:10,border:"1.5px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:"#fff",textDecoration:"none",display:"flex",alignItems:"center",gap:8}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Hablar con un asesor
          </a>
        </div>
        <div style={{marginTop:40,display:"flex",gap:40,justifyContent:"center",flexWrap:"wrap"}}>
          {[{n:"500+",l:"Envíos realizados"},{n:"4.9★",l:"Calificación Google"},{n:"8-12",l:"Días courier aéreo"}].map(s=>
            <div key={s.l}><p style={{fontSize:28,fontWeight:800,color:"#fff",margin:"0 0 2px"}}>{s.n}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0}}>{s.l}</p></div>
          )}
        </div>
      </div>
    </section>

    {/* SERVICIOS */}
    <section id="servicios" style={{padding:"80px 24px",background:"rgba(255,255,255,0.02)"}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <p style={{fontSize:13,fontWeight:700,color:IC,letterSpacing:"0.15em",textTransform:"uppercase",textAlign:"center",marginBottom:8}}>Nuestros servicios</p>
        <h2 style={{fontSize:"clamp(24px, 4vw, 40px)",fontWeight:800,textAlign:"center",margin:"0 0 12px"}}>Courier y carga internacional</h2>
        <p style={{fontSize:16,color:"rgba(255,255,255,0.5)",textAlign:"center",margin:"0 auto 48px",maxWidth:600}}>Tu importación merece claridad, control y rapidez. Operamos todos los canales.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:20}}>
          {[
            {icon:"✈️",title:"Aéreo Courier",desc:"Envíos express de China a Argentina en 8-12 días. Despacho de aduana incluido. Ideal para muestras y envíos urgentes hasta 50kg.",tag:"El más rápido",tagColor:"#fbbf24"},
            {icon:"📦",title:"Carga Aérea Comercial",desc:"Para envíos de mayor volumen por vía aérea. Tiempos de 10-15 días con mejor precio por kg que courier.",tag:"Mejor relación",tagColor:"#22c55e"},
            {icon:"🚢",title:"Marítimo LCL / FCL",desc:"Carga consolidada o contenedor completo. El canal más económico para grandes volúmenes. 35-45 días.",tag:"Más económico",tagColor:"#60a5fa"},
          ].map(s=><div key={s.title} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"28px 24px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${s.tagColor},transparent)`}}/>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <span style={{fontSize:28}}>{s.icon}</span>
              <div><h3 style={{fontSize:18,fontWeight:700,margin:"0 0 4px"}}>{s.title}</h3>
              <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:`${s.tagColor}20`,color:s.tagColor,border:`1px solid ${s.tagColor}40`}}>{s.tag}</span></div>
            </div>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.6)",lineHeight:1.6,margin:0}}>{s.desc}</p>
          </div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,marginTop:32}}>
          {[
            {icon:"📍",title:"Seguimiento en tiempo real",desc:"Rastreá tu envío desde China hasta tu puerta"},
            {icon:"📋",title:"Despacho de aduana",desc:"Nos encargamos de toda la gestión aduanera"},
            {icon:"🔒",title:"Seguro de carga",desc:"Tu mercadería protegida durante todo el trayecto"},
            {icon:"💬",title:"Asesoramiento personalizado",desc:"Un equipo dedicado para cada importación"},
          ].map(f=><div key={f.title} style={{padding:20,background:"rgba(255,255,255,0.03)",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)"}}>
            <p style={{fontSize:24,margin:"0 0 8px"}}>{f.icon}</p>
            <h4 style={{fontSize:14,fontWeight:700,margin:"0 0 4px"}}>{f.title}</h4>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.5)",margin:0,lineHeight:1.5}}>{f.desc}</p>
          </div>)}
        </div>
      </div>
    </section>

    {/* PROCESO */}
    <section id="proceso" style={{padding:"80px 24px"}}>
      <div style={{maxWidth:1000,margin:"0 auto"}}>
        <p style={{fontSize:13,fontWeight:700,color:IC,letterSpacing:"0.15em",textTransform:"uppercase",textAlign:"center",marginBottom:8}}>Proceso</p>
        <h2 style={{fontSize:"clamp(24px, 4vw, 40px)",fontWeight:800,textAlign:"center",margin:"0 0 48px"}}>Cómo funciona tu importación</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:24}}>
          {[
            {n:"1",title:"Cotizá",desc:"Completá el formulario con los datos de tu producto. Te damos el precio al instante.",icon:"💰"},
            {n:"2",title:"Enviá al depósito",desc:"Tu proveedor envía la mercadería a nuestro warehouse en China. Nosotros la recibimos.",icon:"📦"},
            {n:"3",title:"Gestionamos todo",desc:"Transporte internacional, documentación y despacho de aduana. Vos no hacés nada.",icon:"✈️"},
            {n:"4",title:"Recibí en tu puerta",desc:"Te entregamos en tu domicilio o retirás en nuestra oficina en Buenos Aires.",icon:"🏠"},
          ].map(s=><div key={s.n} style={{textAlign:"center",padding:"24px 16px"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#1B4F8A,#4A90D9)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:24}}>{s.icon}</div>
            <div style={{fontSize:11,fontWeight:700,color:IC,marginBottom:6}}>PASO {s.n}</div>
            <h3 style={{fontSize:18,fontWeight:700,margin:"0 0 8px"}}>{s.title}</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.6,margin:0}}>{s.desc}</p>
          </div>)}
        </div>
      </div>
    </section>

    {/* COTIZADOR */}
    <section id="cotizar" style={{padding:"80px 24px",background:"rgba(74,144,217,0.04)"}}>
      <div style={{maxWidth:560,margin:"0 auto"}}>
        <p style={{fontSize:13,fontWeight:700,color:IC,letterSpacing:"0.15em",textTransform:"uppercase",textAlign:"center",marginBottom:8}}>Cotizador</p>
        <h2 style={{fontSize:"clamp(24px, 4vw, 36px)",fontWeight:800,textAlign:"center",margin:"0 0 8px"}}>Calculá el costo de tu importación</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",textAlign:"center",margin:"0 0 32px"}}>Sin compromiso. Completá los datos y te mostramos el precio.</p>
        {calcStep===1&&<div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"28px 24px"}}>
          <div style={{display:"grid",gap:14}}>
            <Inp label="¿QUÉ PRODUCTO IMPORTÁS?" value={calcForm.product} onChange={v=>setCalcForm(p=>({...p,product:v}))} placeholder="Ej: Smartwatches, ropa, electrónica..."/>
            <div style={{display:"flex",gap:14}}>
              <Inp label="PESO ESTIMADO (KG)" type="number" value={calcForm.weight} onChange={v=>setCalcForm(p=>({...p,weight:v}))} placeholder="15" half/>
              <Inp label="VALOR MERCADERÍA (USD)" type="number" value={calcForm.value} onChange={v=>setCalcForm(p=>({...p,value:v}))} placeholder="500" half/>
            </div>
            <button onClick={()=>{if(!calcForm.product||!calcForm.weight||!calcForm.value){alert("Completá todos los campos");return;}setCalcStep(2);}} style={{width:"100%",padding:"14px",fontSize:15,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#1B4F8A,#4A90D9)",color:"#fff",marginTop:4}}>Calcular costo →</button>
          </div>
        </div>}
        {calcStep===2&&<div style={{background:"rgba(255,255,255,0.04)",border:"1.5px solid rgba(74,144,217,0.3)",borderRadius:16,padding:"28px 24px",textAlign:"center"}}>
          <p style={{fontSize:48,margin:"0 0 12px"}}>📊</p>
          <h3 style={{fontSize:22,fontWeight:700,margin:"0 0 8px"}}>Tu cotización está lista</h3>
          <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",margin:"0 0 24px"}}>Dejá tus datos para ver el desglose completo.</p>
          <div style={{display:"grid",gap:12,textAlign:"left"}}>
            <Inp label="NOMBRE" value={calcForm.name} onChange={v=>setCalcForm(p=>({...p,name:v}))} placeholder="Tu nombre"/>
            <div style={{display:"flex",gap:12}}>
              <Inp label="EMAIL" type="email" value={calcForm.email} onChange={v=>setCalcForm(p=>({...p,email:v}))} placeholder="tu@email.com" half/>
              <Inp label="WHATSAPP" type="tel" value={calcForm.phone} onChange={v=>setCalcForm(p=>({...p,phone:v}))} placeholder="+54 9 11..." half/>
            </div>
            <button onClick={()=>{if(!calcForm.name||!calcForm.email){alert("Completá nombre y email");return;}window.location.href="/portal";}} style={{width:"100%",padding:"14px",fontSize:15,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",marginTop:4}}>Ver mi cotización →</button>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.4)",textAlign:"center",margin:"4px 0 0"}}>También podés <a href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hola! Quiero cotizar: ${calcForm.product}, ${calcForm.weight}kg, USD ${calcForm.value}`)}`} target="_blank" rel="noopener" style={{color:"#25D366",fontWeight:600}}>consultar por WhatsApp</a></p>
          </div>
        </div>}
      </div>
    </section>

    {/* POR QUÉ ELEGIRNOS */}
    <section style={{padding:"60px 24px"}}>
      <div style={{maxWidth:1000,margin:"0 auto",textAlign:"center"}}>
        <h2 style={{fontSize:"clamp(20px, 3vw, 32px)",fontWeight:800,margin:"0 0 32px"}}>¿Por qué elegirnos?</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:20}}>
          {[
            {n:"🇦🇷",title:"Empresa argentina",desc:"Oficina en Buenos Aires. Atención en español."},
            {n:"🇨🇳",title:"Depósito en China",desc:"Recibimos tu mercadería directo del proveedor."},
            {n:"📱",title:"Portal de seguimiento",desc:"Seguí tu envío paso a paso desde tu celular."},
            {n:"💰",title:"Sin sorpresas",desc:"Cotización transparente. Sabés el costo total antes."},
          ].map(f=><div key={f.title} style={{padding:24,background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)"}}>
            <p style={{fontSize:36,margin:"0 0 12px"}}>{f.n}</p>
            <h3 style={{fontSize:16,fontWeight:700,margin:"0 0 6px"}}>{f.title}</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0,lineHeight:1.5}}>{f.desc}</p>
          </div>)}
        </div>
      </div>
    </section>

    {/* CTA FINAL */}
    <section style={{padding:"80px 24px",background:"linear-gradient(135deg,rgba(27,79,138,0.3),rgba(74,144,217,0.1))",textAlign:"center"}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        <h2 style={{fontSize:"clamp(24px, 4vw, 36px)",fontWeight:800,margin:"0 0 12px"}}>¿Listo para importar?</h2>
        <p style={{fontSize:16,color:"rgba(255,255,255,0.6)",margin:"0 0 32px"}}>Hablá con un asesor y empezá a traer tu mercadería.</p>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
          <a href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Hola! Quiero información sobre importar desde China")}`} target="_blank" rel="noopener" style={{padding:"14px 32px",fontSize:15,fontWeight:700,borderRadius:10,background:"#25D366",color:"#fff",textDecoration:"none",display:"flex",alignItems:"center",gap:8}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Escribinos por WhatsApp
          </a>
          <button onClick={()=>scrollTo("cotizar")} style={{padding:"14px 32px",fontSize:15,fontWeight:700,borderRadius:10,border:"1.5px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:"#fff",cursor:"pointer"}}>Cotizar envío</button>
        </div>
      </div>
    </section>

    {/* FOOTER */}
    <footer style={{padding:"48px 24px 32px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:32}}>
        <div>
          <img src={LOGO} alt="Argencargo" style={{height:32,marginBottom:12}}/>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:0}}>Comercio sin fronteras</p>
        </div>
        <div>
          <h4 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 12px",textTransform:"uppercase"}}>Contacto</h4>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.6)",margin:"0 0 6px"}}>info@argencargo.com.ar</p>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.6)",margin:"0 0 6px"}}>Argentina: Lun-Vie 9-17hs</p>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.6)",margin:0}}>China: 24/7</p>
        </div>
        <div>
          <h4 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 12px",textTransform:"uppercase"}}>Links</h4>
          <a href="/portal" style={{display:"block",fontSize:13,color:"rgba(255,255,255,0.6)",textDecoration:"none",marginBottom:6}}>Portal clientes</a>
          <a href="/agente" style={{display:"block",fontSize:13,color:"rgba(255,255,255,0.6)",textDecoration:"none",marginBottom:6}}>Portal agentes</a>
        </div>
        <div>
          <h4 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 12px",textTransform:"uppercase"}}>Legal</h4>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:"0 0 6px"}}>ARGENCARGO</p>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0}}>© 2026 Todos los derechos reservados</p>
        </div>
      </div>
    </footer>

    {/* WHATSAPP FLOTANTE */}
    <a href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Hola! Quiero info sobre importaciones")}`} target="_blank" rel="noopener" style={{position:"fixed",bottom:24,right:24,width:60,height:60,borderRadius:"50%",background:"#25D366",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(37,211,102,0.4)",zIndex:99}}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>

    <style>{`
      @media(max-width:768px){
        .desktop-nav a:not(:last-child):not(:nth-last-child(2)){display:none!important;}
      }
      html{scroll-behavior:smooth;}
    `}</style>
  </div>;
}
