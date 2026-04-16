"use client";
import { useState, useEffect } from "react";

const LOGO="https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const WA="5491125088580";
const AC="#3B7DD8"; // azul argencargo medio
const NAVY="#152D54"; // navy oscuro
const BG="#0a1223"; // fondo
const sc=(id)=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"});
const waL=(m)=>`https://wa.me/${WA}?text=${encodeURIComponent(m)}`;

export default function Landing(){
  const [scrolled,setScrolled]=useState(false);
  const [form,setForm]=useState({product:"",weight:"",value:"",origin:"china",name:"",email:"",phone:""});
  const [step,setStep]=useState(1);
  const [faq,setFaq]=useState(null);
  useEffect(()=>{const f=()=>setScrolled(window.scrollY>50);window.addEventListener("scroll",f);return()=>window.removeEventListener("scroll",f);},[]);

  return <div style={{fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif",color:"#fff",background:BG}}>

    {/* NAV */}
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"12px 0",background:scrolled?"rgba(10,18,35,0.92)":"transparent",backdropFilter:scrolled?"blur(20px)":"none",borderBottom:scrolled?"1px solid rgba(255,255,255,0.06)":"none",transition:"all 0.3s"}}>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"0 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <img src={LOGO} alt="Argencargo" style={{height:34,cursor:"pointer"}} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}/>
        <div style={{display:"flex",alignItems:"center",gap:24}} className="dn">
          {["servicios","como-funciona","cotizar"].map(x=><a key={x} onClick={()=>sc(x)} style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.6)",cursor:"pointer",textDecoration:"none"}}>{x==="como-funciona"?"Cómo funciona":x.charAt(0).toUpperCase()+x.slice(1)}</a>)}
          <a href="/portal" style={{fontSize:13,fontWeight:600,color:AC,textDecoration:"none"}}>Iniciar sesión</a>
          <a href={waL("Hola, quiero cotizar una importación")} target="_blank" rel="noopener" style={{padding:"8px 20px",fontSize:12,fontWeight:700,borderRadius:8,background:AC,color:"#fff",textDecoration:"none"}}>Cotizar gratis</a>
        </div>
      </div>
    </nav>

    {/* HERO */}
    <section style={{minHeight:"100vh",display:"flex",alignItems:"center",padding:"100px 24px 60px",background:`radial-gradient(ellipse at 20% 50%, ${NAVY}40 0%, transparent 60%)`}}>
      <div style={{maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center"}} className="hero-grid">
        <div>
          <div style={{display:"inline-flex",gap:8,marginBottom:20}}>
            <span style={{padding:"5px 12px",borderRadius:20,background:"rgba(59,125,216,0.1)",border:"1px solid rgba(59,125,216,0.2)",fontSize:12,fontWeight:600,color:AC}}>🇨🇳 China</span>
            <span style={{padding:"5px 12px",borderRadius:20,background:"rgba(59,125,216,0.1)",border:"1px solid rgba(59,125,216,0.2)",fontSize:12,fontWeight:600,color:AC}}>🇺🇸 Estados Unidos</span>
            <span style={{padding:"5px 12px",borderRadius:20,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.5)"}}>→ 🇦🇷 Argentina</span>
          </div>
          <h1 style={{fontSize:"clamp(28px, 4.5vw, 46px)",fontWeight:800,lineHeight:1.15,margin:"0 0 20px"}}>
            Traemos tu mercadería<br/>
            <span style={{color:AC}}>de forma simple y segura</span>
          </h1>
          <p style={{fontSize:17,color:"rgba(255,255,255,0.55)",lineHeight:1.7,margin:"0 0 32px",maxWidth:480}}>
            Importaciones aéreas y marítimas. Tu mercadería llega a nuestro depósito, nosotros nos encargamos del envío, la aduana y la tenés lista para retirar en Buenos Aires.
          </p>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:40}}>
            <button onClick={()=>sc("cotizar")} style={{padding:"14px 28px",fontSize:15,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${AC},${NAVY})`,color:"#fff"}}>Cotizar mi importación →</button>
            <a href={waL("Hola, quiero info para importar")} target="_blank" rel="noopener" style={{padding:"14px 28px",fontSize:15,fontWeight:600,borderRadius:10,border:"1.5px solid rgba(255,255,255,0.12)",background:"transparent",color:"#fff",textDecoration:"none",display:"flex",alignItems:"center",gap:8}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
          </div>
          <div style={{display:"flex",gap:32,flexWrap:"wrap"}}>
            {[{n:"8-12 días",l:"Courier aéreo"},{n:"Todos los canales",l:"Aéreo y marítimo"},{n:"Tracking real",l:"Seguimiento online"}].map(s=>
              <div key={s.l}><p style={{fontSize:18,fontWeight:800,color:"#fff",margin:"0 0 2px"}}>{s.n}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:0}}>{s.l}</p></div>
            )}
          </div>
        </div>
        <div style={{background:"rgba(255,255,255,0.03)",borderRadius:20,border:"1px solid rgba(255,255,255,0.08)",padding:"28px 24px",position:"relative",overflow:"hidden"}} className="hero-dash">
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${AC},#22c55e,transparent)`}}/>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 16px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Tu portal de seguimiento</p>
          {[
            {code:"AC-0047",status:"En tránsito",color:"#60a5fa",info:"Guangzhou → Bs As",via:"DHL"},
            {code:"AC-0045",status:"En aduana",color:"#fbbf24",info:"Shanghai → Bs As",via:"FedEx"},
            {code:"AC-0042",status:"Listo para retirar",color:"#22c55e",info:"Miami → Bs As",via:"Courier"},
          ].map(s=><div key={s.code} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <div><span style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:"#fff"}}>{s.code}</span><span style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginLeft:8}}>{s.info}</span></div>
            <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,color:s.color,background:`${s.color}15`,border:`1px solid ${s.color}30`}}>{s.status}</span>
          </div>)}
          <div style={{marginTop:16,padding:"14px",background:`${NAVY}30`,borderRadius:10,textAlign:"center"}}>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.5)",margin:"0 0 4px"}}>Cada cliente tiene su propio portal</p>
            <p style={{fontSize:11,color:AC,fontWeight:600,margin:0}}>Seguí tu carga en tiempo real →</p>
          </div>
        </div>
      </div>
    </section>

    {/* PROBLEMA → SOLUCIÓN */}
    <section style={{padding:"80px 24px",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
      <div style={{maxWidth:900,margin:"0 auto",textAlign:"center"}}>
        <h2 style={{fontSize:"clamp(22px, 3.5vw, 34px)",fontWeight:800,margin:"0 0 16px"}}>Sabemos lo que te preocupa</h2>
        <p style={{fontSize:15,color:"rgba(255,255,255,0.45)",margin:"0 auto 40px",maxWidth:550}}>Importar puede ser confuso. Por eso hacemos que sea simple.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:20,textAlign:"left"}}>
          {[
            {pain:"\"No tengo idea cuánto me va a salir en total\"",fix:"Te damos una cotización clara con todos los costos antes de que muevas un dedo. Sin sorpresas después."},
            {pain:"\"Me da miedo que se trabe en aduana\"",fix:"Gestionamos el despacho aduanero. Si hay algún tema, lo resolvemos nosotros y te mantenemos al tanto."},
            {pain:"\"Mandé la plata y no sé qué pasó con mi carga\"",fix:"Tenés un portal donde ves exactamente dónde está tu mercadería, con tracking real del courier."},
          ].map(s=><div key={s.pain} style={{padding:24,background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)"}}>
            <p style={{fontSize:14,fontWeight:600,color:"rgba(255,255,255,0.65)",margin:"0 0 12px",fontStyle:"italic"}}>{s.pain}</p>
            <div style={{width:32,height:2,background:AC,borderRadius:2,marginBottom:12}}/>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.6,margin:0}}>{s.fix}</p>
          </div>)}
        </div>
      </div>
    </section>

    {/* SERVICIOS */}
    <section id="servicios" style={{padding:"80px 24px",background:`linear-gradient(180deg,${NAVY}15 0%,transparent 100%)`}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <p style={{fontSize:13,fontWeight:700,color:AC,textAlign:"center",marginBottom:8,letterSpacing:"0.1em"}}>CANALES DE ENVÍO</p>
        <h2 style={{fontSize:"clamp(22px, 3.5vw, 34px)",fontWeight:800,textAlign:"center",margin:"0 0 12px"}}>Elegí cómo traer tu mercadería</h2>
        <p style={{fontSize:15,color:"rgba(255,255,255,0.45)",textAlign:"center",margin:"0 auto 48px",maxWidth:500}}>Cada canal tiene sus ventajas. Te asesoramos para elegir el mejor.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:20}}>
          {[
            {icon:"⚡",title:"Courier Aéreo",time:"8-12 días hábiles",price:"Desde USD 9.5/kg",points:["Hasta 50kg por envío","Despacho simplificado","Ideal para muestras y reposición rápida","Disponible desde China y USA"],color:"#e2a93b"},
            {icon:"✈️",title:"Carga Aérea",time:"12-18 días hábiles",price:"Consultar por volumen",points:["Para envíos de +50kg","Mejor precio/kg que courier","Documentación formal","Ideal para importadores regulares"],color:"#3B7DD8"},
            {icon:"🚢",title:"Marítimo",time:"Consultar tiempos",price:"El más económico",points:["Consolidado (LCL) o contenedor (FCL)","Para grandes volúmenes","La opción con menor costo por unidad","Tiempos variables según destino/origen"],color:"#5BA0D9"},
          ].map(s=><div key={s.title} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"28px 24px",position:"relative"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${s.color},transparent)`}}/>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <span style={{fontSize:28}}>{s.icon}</span>
              <h3 style={{fontSize:20,fontWeight:700,margin:0}}>{s.title}</h3>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:20,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.7)"}}>⏱ {s.time}</span>
              <span style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:20,background:`${s.color}15`,color:s.color}}>{s.price}</span>
            </div>
            {s.points.map(p=><p key={p} style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"0 0 6px",paddingLeft:16,position:"relative"}}><span style={{position:"absolute",left:0,color:s.color}}>•</span>{p}</p>)}
          </div>)}
        </div>
      </div>
    </section>

    {/* PROCESO */}
    <section id="como-funciona" style={{padding:"80px 24px"}}>
      <div style={{maxWidth:800,margin:"0 auto"}}>
        <p style={{fontSize:13,fontWeight:700,color:AC,textAlign:"center",marginBottom:8,letterSpacing:"0.1em"}}>ASÍ FUNCIONA</p>
        <h2 style={{fontSize:"clamp(22px, 3.5vw, 34px)",fontWeight:800,textAlign:"center",margin:"0 0 48px"}}>En 4 pasos tu carga está en Argentina</h2>
        {[
          {n:"01",title:"Cotizás y decidís",desc:"Nos decís qué querés traer y te damos el costo total. Sin compromiso, sin letra chica."},
          {n:"02",title:"Tu proveedor envía a nuestro depósito",desc:"Le pasás la dirección de nuestro depósito en China (o USA). Cuando llega, te avisamos."},
          {n:"03",title:"Nosotros nos encargamos del envío y la aduana",desc:"Documentación, transporte internacional, seguimiento y gestión aduanera. Vos seguís con tu negocio."},
          {n:"04",title:"Retirás en Buenos Aires",desc:"Te avisamos cuando está listo. Pasás por nuestra oficina y te llevás tu mercadería."},
        ].map(s=><div key={s.n} style={{display:"flex",gap:20,marginBottom:36,alignItems:"flex-start"}}>
          <div style={{flexShrink:0,width:44,height:44,borderRadius:10,background:`linear-gradient(135deg,${AC},${NAVY})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800}}>{s.n}</div>
          <div>
            <h3 style={{fontSize:17,fontWeight:700,margin:"0 0 6px"}}>{s.title}</h3>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.6,margin:0}}>{s.desc}</p>
          </div>
        </div>)}
      </div>
    </section>

    {/* COTIZADOR */}
    <section id="cotizar" style={{padding:"80px 24px",background:`linear-gradient(180deg,${NAVY}10 0%,${BG} 100%)`}}>
      <div style={{maxWidth:520,margin:"0 auto"}}>
        <h2 style={{fontSize:"clamp(22px, 3.5vw, 32px)",fontWeight:800,textAlign:"center",margin:"0 0 6px"}}>¿Cuánto me sale?</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.4)",textAlign:"center",margin:"0 0 28px"}}>Completá estos datos y te calculamos el costo.</p>
        {step===1&&<div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"24px"}}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:4}}>¿QUÉ TRAÉS?</label>
            <input value={form.product} onChange={e=>setForm(p=>({...p,product:e.target.value}))} placeholder="Ej: Relojes inteligentes, zapatillas, repuestos..." style={{width:"100%",padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.05)",color:"#fff",outline:"none"}}/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:4}}>ORIGEN</label>
            <div style={{display:"flex",gap:8}}>
              {[{k:"china",l:"🇨🇳 China"},{k:"usa",l:"🇺🇸 Estados Unidos"}].map(o=>
                <button key={o.k} onClick={()=>setForm(p=>({...p,origin:o.k}))} style={{flex:1,padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:form.origin===o.k?`1.5px solid ${AC}`:"1.5px solid rgba(255,255,255,0.1)",background:form.origin===o.k?`${AC}15`:"rgba(255,255,255,0.03)",color:form.origin===o.k?AC:"rgba(255,255,255,0.5)",cursor:"pointer"}}>{o.l}</button>
              )}
            </div>
          </div>
          <div style={{display:"flex",gap:12,marginBottom:14}}>
            <div style={{flex:1}}>
              <label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:4}}>PESO ESTIMADO (KG)</label>
              <input type="number" value={form.weight} onChange={e=>setForm(p=>({...p,weight:e.target.value}))} placeholder="15" style={{width:"100%",padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.05)",color:"#fff",outline:"none"}}/>
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:4}}>VALOR APROX (USD)</label>
              <input type="number" value={form.value} onChange={e=>setForm(p=>({...p,value:e.target.value}))} placeholder="500" style={{width:"100%",padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.05)",color:"#fff",outline:"none"}}/>
            </div>
          </div>
          <button onClick={()=>{if(!form.product||!form.weight||!form.value){alert("Completá los 3 campos");return;}setStep(2);}} style={{width:"100%",padding:"14px",fontSize:15,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${AC},${NAVY})`,color:"#fff"}}>Ver cotización →</button>
        </div>}
        {step===2&&<div style={{background:"rgba(255,255,255,0.03)",border:`1.5px solid ${AC}40`,borderRadius:16,padding:"28px 24px"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:`${AC}15`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26}}>📊</div>
            <h3 style={{fontSize:20,fontWeight:700,margin:"0 0 4px"}}>Tu cotización está lista</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:0}}>Dejá tus datos y te la enviamos</p>
          </div>
          <div style={{display:"grid",gap:12}}>
            <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Tu nombre" style={{width:"100%",padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.05)",color:"#fff",outline:"none"}}/>
            <div style={{display:"flex",gap:12}}>
              <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="tu@email.com" style={{flex:1,padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.05)",color:"#fff",outline:"none"}}/>
              <input type="tel" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="WhatsApp" style={{flex:1,padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.05)",color:"#fff",outline:"none"}}/>
            </div>
            <button onClick={()=>{if(!form.name||!form.email){alert("Completá nombre y email");return;}window.location.href="/portal";}} style={{width:"100%",padding:"14px",fontSize:15,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff"}}>Ver cotización completa →</button>
          </div>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.3)",textAlign:"center",marginTop:10}}>O <a href={waL(`Hola! Quiero cotizar: ${form.product}, ${form.weight}kg, USD${form.value}, desde ${form.origin==="china"?"China":"USA"}`)} target="_blank" style={{color:"#25D366",fontWeight:600,textDecoration:"none"}}>consultá por WhatsApp</a></p>
        </div>}
      </div>
    </section>

    {/* FAQ */}
    <section style={{padding:"60px 24px"}}>
      <div style={{maxWidth:700,margin:"0 auto"}}>
        <h2 style={{fontSize:"clamp(20px, 3vw, 30px)",fontWeight:800,textAlign:"center",margin:"0 0 32px"}}>Preguntas frecuentes</h2>
        {[
          {q:"¿Necesito ser importador registrado?",a:"No para envíos courier (hasta USD 3.000). Para carga formal sí, pero te asesoramos en el proceso."},
          {q:"¿Puedo traer cualquier producto?",a:"Casi todo. Hay restricciones para ciertos productos (alimentos, medicamentos, materiales peligrosos). Consultanos antes y te confirmamos."},
          {q:"¿Cómo hago el seguimiento?",a:"Tenés un portal online donde ves el estado de tu carga en tiempo real con tracking del courier internacional."},
          {q:"¿Hacen entregas a domicilio?",a:"Por el momento, retirás en nuestra oficina de Buenos Aires. Te avisamos apenas tu carga está lista."},
          {q:"¿Puedo importar desde USA también?",a:"Sí. Operamos envíos desde China y Estados Unidos a Argentina, por vía aérea y marítima."},
          {q:"¿La cotización incluye impuestos?",a:"Depende del canal y el régimen. En courier, la cotización incluye todos los costos. En carga formal, te detallamos cada componente por separado."},
        ].map((f,i)=><div key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <button onClick={()=>setFaq(faq===i?null:i)} style={{width:"100%",padding:"16px 0",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",color:"#fff",fontSize:15,fontWeight:600,textAlign:"left"}}>
            {f.q}<span style={{fontSize:18,color:"rgba(255,255,255,0.3)",flexShrink:0,marginLeft:12}}>{faq===i?"−":"+"}</span>
          </button>
          {faq===i&&<p style={{fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.7,margin:"0 0 16px"}}>{f.a}</p>}
        </div>)}
      </div>
    </section>

    {/* CTA FINAL */}
    <section style={{padding:"80px 24px",textAlign:"center",background:`radial-gradient(ellipse at 50% 80%, ${NAVY}20 0%, transparent 60%)`}}>
      <div style={{maxWidth:550,margin:"0 auto"}}>
        <h2 style={{fontSize:"clamp(24px, 4vw, 36px)",fontWeight:800,margin:"0 0 12px"}}>¿Listo para traer tu mercadería?</h2>
        <p style={{fontSize:16,color:"rgba(255,255,255,0.5)",margin:"0 0 32px"}}>Escribinos y en menos de 24hs tenés tu cotización. Sin compromiso.</p>
        <a href={waL("Hola! Quiero cotizar una importación")} target="_blank" rel="noopener" style={{display:"inline-flex",alignItems:"center",gap:10,padding:"16px 36px",fontSize:16,fontWeight:700,borderRadius:12,background:"#25D366",color:"#fff",textDecoration:"none",boxShadow:"0 4px 20px rgba(37,211,102,0.3)"}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Escribinos por WhatsApp
        </a>
      </div>
    </section>

    {/* FOOTER */}
    <footer style={{padding:"40px 24px 28px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:20}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <img src={LOGO} alt="AC" style={{height:28}}/>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>© 2026 Argencargo</span>
        </div>
        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
          <a href="/portal" style={{fontSize:12,color:"rgba(255,255,255,0.4)",textDecoration:"none"}}>Portal clientes</a>
          <a href="/agente" style={{fontSize:12,color:"rgba(255,255,255,0.4)",textDecoration:"none"}}>Portal agentes</a>
          <a href="mailto:info@argencargo.com.ar" style={{fontSize:12,color:"rgba(255,255,255,0.4)",textDecoration:"none"}}>info@argencargo.com.ar</a>
        </div>
      </div>
    </footer>

    {/* WA FLOTANTE */}
    <a href={waL("Hola! Quiero info sobre importaciones")} target="_blank" rel="noopener" style={{position:"fixed",bottom:24,right:24,width:60,height:60,borderRadius:"50%",background:"#25D366",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(37,211,102,0.4)",zIndex:99}}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>

    <style>{`@media(max-width:768px){.dn a:not(:last-child):not(:nth-last-child(2)){display:none!important;}.hero-grid{grid-template-columns:1fr!important;gap:32px!important;}.hero-dash{display:none!important;}}html{scroll-behavior:smooth;}*{box-sizing:border-box;}`}</style>
  </div>;
}
