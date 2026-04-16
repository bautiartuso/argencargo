"use client";
import { useState, useEffect } from "react";

const LOGO="https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const WA="5491161000000"; // TODO: reemplazar
const IC="#4A90D9";
const sc=(id)=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"});
const waLink=(msg)=>`https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;

export default function Landing(){
  const [scrolled,setScrolled]=useState(false);
  const [form,setForm]=useState({product:"",weight:"",value:"",name:"",email:"",phone:""});
  const [step,setStep]=useState(1);
  const [faq,setFaq]=useState(null);
  useEffect(()=>{const f=()=>setScrolled(window.scrollY>50);window.addEventListener("scroll",f);return()=>window.removeEventListener("scroll",f);},[]);

  return <div style={{fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif",color:"#fff",background:"#080d19"}}>

    {/* ─── NAV ─── */}
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"12px 0",background:scrolled?"rgba(8,13,25,0.92)":"transparent",backdropFilter:scrolled?"blur(20px)":"none",borderBottom:scrolled?"1px solid rgba(255,255,255,0.06)":"none",transition:"all 0.3s"}}>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"0 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <img src={LOGO} alt="Argencargo" style={{height:34,cursor:"pointer"}} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}/>
        <div style={{display:"flex",alignItems:"center",gap:24}} className="dn">
          {["servicios","proceso","precios"].map(x=><a key={x} onClick={()=>sc(x)} style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.6)",cursor:"pointer",textDecoration:"none",textTransform:"capitalize"}}>{x}</a>)}
          <a href="/portal" style={{fontSize:13,fontWeight:600,color:IC,textDecoration:"none"}}>Iniciar sesión</a>
          <a href={waLink("Hola! Quiero importar desde China")} target="_blank" rel="noopener" style={{padding:"8px 20px",fontSize:12,fontWeight:700,borderRadius:8,background:IC,color:"#fff",textDecoration:"none"}}>Cotizar gratis</a>
        </div>
      </div>
    </nav>

    {/* ─── HERO ─── */}
    <section style={{minHeight:"100vh",display:"flex",alignItems:"center",padding:"100px 24px 60px",background:"radial-gradient(ellipse at 20% 50%, rgba(74,144,217,0.08) 0%, transparent 60%)"}}>
      <div style={{maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center"}} className="hero-grid">
        <div>
          <div style={{display:"inline-block",padding:"6px 14px",borderRadius:20,background:"rgba(74,144,217,0.1)",border:"1px solid rgba(74,144,217,0.2)",marginBottom:20}}>
            <span style={{fontSize:12,fontWeight:600,color:IC}}>🇨🇳 China → 🇦🇷 Argentina — Aéreo y Marítimo</span>
          </div>
          <h1 style={{fontSize:"clamp(28px, 4.5vw, 48px)",fontWeight:800,lineHeight:1.15,margin:"0 0 20px"}}>
            Importá desde China<br/>
            <span style={{color:IC}}>sin dolores de cabeza</span>
          </h1>
          <p style={{fontSize:17,color:"rgba(255,255,255,0.55)",lineHeight:1.7,margin:"0 0 32px",maxWidth:480}}>
            Nos encargamos de todo: retiramos tu mercadería del proveedor, gestionamos el envío, la aduana y te la entregamos en la puerta de tu negocio.
          </p>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:40}}>
            <button onClick={()=>sc("precios")} style={{padding:"14px 28px",fontSize:15,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:IC,color:"#fff"}}>Cotizar mi importación →</button>
            <a href={waLink("Hola, quiero info para importar desde China")} target="_blank" rel="noopener" style={{padding:"14px 28px",fontSize:15,fontWeight:600,borderRadius:10,border:"1.5px solid rgba(255,255,255,0.12)",background:"transparent",color:"#fff",textDecoration:"none",display:"flex",alignItems:"center",gap:8}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
          </div>
          <div style={{display:"flex",gap:32,flexWrap:"wrap"}}>
            {[{n:"8-12 días",l:"Courier aéreo"},{n:"35-45 días",l:"Marítimo"},{n:"Incluido",l:"Despacho de aduana"}].map(s=>
              <div key={s.l}><p style={{fontSize:20,fontWeight:800,color:"#fff",margin:"0 0 2px"}}>{s.n}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:0}}>{s.l}</p></div>
            )}
          </div>
        </div>
        {/* Right side: mini dashboard */}
        <div style={{background:"rgba(255,255,255,0.03)",borderRadius:20,border:"1px solid rgba(255,255,255,0.08)",padding:"28px 24px",position:"relative",overflow:"hidden"}} className="hero-dash">
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${IC},#22c55e,transparent)`}}/>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 16px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Portal de seguimiento</p>
          {[
            {code:"AC-0047",status:"En tránsito",color:"#60a5fa",eta:"20 Abr",from:"Guangzhou"},
            {code:"AC-0045",status:"En aduana",color:"#fbbf24",eta:"18 Abr",from:"Shanghai"},
            {code:"AC-0042",status:"Entregado",color:"#22c55e",eta:"✓ 12 Abr",from:"Yiwu"},
          ].map(s=><div key={s.code} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <div>
              <span style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:"#fff"}}>{s.code}</span>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginLeft:8}}>{s.from}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,color:s.color,background:`${s.color}15`,border:`1px solid ${s.color}30`}}>{s.status}</span>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{s.eta}</span>
            </div>
          </div>)}
          <div style={{marginTop:16,display:"flex",gap:16}}>
            {[{n:"6",l:"En tránsito"},{n:"23",l:"Entregados este mes"},{n:"142 kg",l:"Este mes"}].map(s=>
              <div key={s.l} style={{flex:1,textAlign:"center",padding:"10px 0",background:"rgba(255,255,255,0.03)",borderRadius:8}}>
                <p style={{fontSize:18,fontWeight:800,color:IC,margin:"0 0 2px"}}>{s.n}</p>
                <p style={{fontSize:9,color:"rgba(255,255,255,0.4)",margin:0}}>{s.l}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>

    {/* ─── DOLOR + SOLUCIÓN ─── */}
    <section style={{padding:"80px 24px",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
      <div style={{maxWidth:900,margin:"0 auto",textAlign:"center"}}>
        <h2 style={{fontSize:"clamp(22px, 3.5vw, 36px)",fontWeight:800,margin:"0 0 16px"}}>¿Importar te parece complicado?</h2>
        <p style={{fontSize:16,color:"rgba(255,255,255,0.5)",lineHeight:1.7,margin:"0 auto 40px",maxWidth:650}}>No saber cuánto vas a pagar, que tu carga se trabe en aduana, no tener idea dónde está tu paquete... Esos problemas no existen con nosotros.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:20,textAlign:"left"}}>
          {[
            {pain:"😰 \"No sé cuánto me va a salir\"",fix:"Cotización detallada antes de que envíes. Sin costos ocultos ni sorpresas en aduana.",icon:"💰"},
            {pain:"😤 \"Mi carga se trabó y no sé por qué\"",fix:"Gestionamos el despacho de aduana completo. Vos no tocás un papel.",icon:"📋"},
            {pain:"😩 \"No sé dónde está mi paquete\"",fix:"Portal con tracking real. Sabés en qué avión o barco viaja tu carga.",icon:"📍"},
          ].map(s=><div key={s.pain} style={{padding:24,background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)"}}>
            <p style={{fontSize:14,fontWeight:600,color:"rgba(255,255,255,0.7)",margin:"0 0 12px"}}>{s.pain}</p>
            <div style={{width:40,height:2,background:IC,borderRadius:2,marginBottom:12}}/>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.6,margin:0}}>{s.fix}</p>
          </div>)}
        </div>
      </div>
    </section>

    {/* ─── SERVICIOS ─── */}
    <section id="servicios" style={{padding:"80px 24px",background:"rgba(74,144,217,0.03)"}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <p style={{fontSize:13,fontWeight:700,color:IC,textAlign:"center",marginBottom:8,letterSpacing:"0.1em"}}>SERVICIOS</p>
        <h2 style={{fontSize:"clamp(22px, 3.5vw, 36px)",fontWeight:800,textAlign:"center",margin:"0 0 48px"}}>Elegí el canal que mejor te sirva</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20}}>
          {[
            {icon:"⚡",title:"Courier Aéreo",time:"8-12 días",price:"Desde USD 9.5/kg",desc:"Para envíos de hasta 50kg. Lo más rápido. Ideal si necesitás muestras, reposición de stock o mercadería urgente. Despacho simplificado.",best:"Urgente / Muestras",color:"#fbbf24"},
            {icon:"✈️",title:"Carga Aérea",time:"12-18 días",price:"Desde USD 6/kg",desc:"Volumen medio por avión. Mejor precio que courier con tiempos similares. Para importadores regulares que mueven +50kg.",best:"Mejor relación precio/tiempo",color:"#22c55e"},
            {icon:"🚢",title:"Marítimo LCL/FCL",time:"35-45 días",price:"Desde USD 200/m³",desc:"Consolidado o contenedor completo. La opción más económica para grandes volúmenes. Perfecto para stock grande.",best:"Grandes volúmenes",color:"#60a5fa"},
          ].map(s=><div key={s.title} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"28px 24px",position:"relative"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${s.color},transparent)`}}/>
            <span style={{fontSize:32}}>{s.icon}</span>
            <h3 style={{fontSize:20,fontWeight:700,margin:"12px 0 4px"}}>{s.title}</h3>
            <div style={{display:"flex",gap:10,marginBottom:14}}>
              <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.7)"}}>⏱ {s.time}</span>
              <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:`${s.color}15`,color:s.color}}>{s.price}</span>
            </div>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.6,margin:"0 0 14px"}}>{s.desc}</p>
            <p style={{fontSize:11,fontWeight:700,color:s.color,margin:0}}>→ {s.best}</p>
          </div>)}
        </div>
      </div>
    </section>

    {/* ─── PROCESO ─── */}
    <section id="proceso" style={{padding:"80px 24px"}}>
      <div style={{maxWidth:900,margin:"0 auto"}}>
        <p style={{fontSize:13,fontWeight:700,color:IC,textAlign:"center",marginBottom:8,letterSpacing:"0.1em"}}>ASÍ DE SIMPLE</p>
        <h2 style={{fontSize:"clamp(22px, 3.5vw, 36px)",fontWeight:800,textAlign:"center",margin:"0 0 48px"}}>4 pasos y tu mercadería está acá</h2>
        {[
          {n:"01",title:"Cotizás online",desc:"Completás qué querés traer, cuánto pesa y cuánto vale. Te damos el precio total al instante — sin letra chica.",side:"right"},
          {n:"02",title:"Tu proveedor envía a nuestro depósito en China",desc:"Le pasás la dirección de nuestro warehouse. Recibimos tu mercadería, la pesamos, la fotografiamos y te avisamos.",side:"left"},
          {n:"03",title:"Nosotros nos encargamos de todo",desc:"Documentación, envío internacional, seguimiento, despacho de aduana. Vos seguís con tu negocio.",side:"right"},
          {n:"04",title:"Te lo entregamos o lo retirás",desc:"Puerta a puerta en Argentina o retiro en nuestra oficina de Buenos Aires. Listo para vender.",side:"left"},
        ].map((s,i)=><div key={s.n} style={{display:"flex",gap:24,marginBottom:40,alignItems:"flex-start"}}>
          <div style={{flexShrink:0,width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,${IC},#1B4F8A)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800}}>{s.n}</div>
          <div>
            <h3 style={{fontSize:18,fontWeight:700,margin:"0 0 6px"}}>{s.title}</h3>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.6,margin:0}}>{s.desc}</p>
          </div>
        </div>)}
      </div>
    </section>

    {/* ─── COTIZADOR TEASER ─── */}
    <section id="precios" style={{padding:"80px 24px",background:"linear-gradient(180deg,rgba(74,144,217,0.06) 0%,rgba(8,13,25,1) 100%)"}}>
      <div style={{maxWidth:520,margin:"0 auto"}}>
        <h2 style={{fontSize:"clamp(22px, 3.5vw, 32px)",fontWeight:800,textAlign:"center",margin:"0 0 6px"}}>¿Cuánto me sale importar?</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.45)",textAlign:"center",margin:"0 0 28px"}}>Completá estos datos y te calculamos el costo total.</p>
        {step===1&&<div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"24px"}}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:4}}>¿QUÉ TRAÉS?</label>
            <input value={form.product} onChange={e=>setForm(p=>({...p,product:e.target.value}))} placeholder="Ej: Relojes inteligentes, zapatillas, repuestos..." style={{width:"100%",padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/>
          </div>
          <div style={{display:"flex",gap:12,marginBottom:14}}>
            <div style={{flex:1}}>
              <label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:4}}>PESO (KG)</label>
              <input type="number" value={form.weight} onChange={e=>setForm(p=>({...p,weight:e.target.value}))} placeholder="15" style={{width:"100%",padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/>
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:4}}>VALOR (USD)</label>
              <input type="number" value={form.value} onChange={e=>setForm(p=>({...p,value:e.target.value}))} placeholder="500" style={{width:"100%",padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/>
            </div>
          </div>
          <button onClick={()=>{if(!form.product||!form.weight||!form.value){alert("Completá los 3 campos");return;}setStep(2);}} style={{width:"100%",padding:"14px",fontSize:15,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:IC,color:"#fff"}}>Ver mi cotización →</button>
        </div>}
        {step===2&&<div style={{background:"rgba(255,255,255,0.04)",border:"1.5px solid rgba(74,144,217,0.3)",borderRadius:16,padding:"28px 24px"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{width:60,height:60,borderRadius:"50%",background:"rgba(74,144,217,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:28}}>📊</div>
            <h3 style={{fontSize:20,fontWeight:700,margin:"0 0 4px"}}>Tu cotización está lista</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.45)",margin:0}}>Dejá tus datos y te la mandamos al instante</p>
          </div>
          <div style={{display:"grid",gap:12}}>
            <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Tu nombre" style={{width:"100%",padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/>
            <div style={{display:"flex",gap:12}}>
              <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="tu@email.com" style={{flex:1,padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/>
              <input type="tel" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="WhatsApp" style={{flex:1,padding:"12px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/>
            </div>
            <button onClick={()=>{if(!form.name||!form.email){alert("Completá nombre y email");return;}window.location.href="/portal";}} style={{width:"100%",padding:"14px",fontSize:15,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff"}}>Ver cotización completa →</button>
          </div>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.35)",textAlign:"center",marginTop:10}}>O <a href={waLink(`Hola! Quiero cotizar: ${form.product}, ${form.weight}kg, USD${form.value}`)} target="_blank" style={{color:"#25D366",fontWeight:600,textDecoration:"none"}}>consultá por WhatsApp</a></p>
        </div>}
      </div>
    </section>

    {/* ─── FAQ ─── */}
    <section style={{padding:"60px 24px"}}>
      <div style={{maxWidth:700,margin:"0 auto"}}>
        <h2 style={{fontSize:"clamp(20px, 3vw, 30px)",fontWeight:800,textAlign:"center",margin:"0 0 32px"}}>Preguntas frecuentes</h2>
        {[
          {q:"¿Necesito ser importador registrado?",a:"No para envíos courier (hasta USD 3.000 por envío). Para carga formal sí, pero te asesoramos en todo el proceso."},
          {q:"¿Qué pasa si mi carga se traba en aduana?",a:"Nosotros gestionamos el despacho completo. Si hay algún inconveniente, lo resolvemos y te mantenemos informado en todo momento."},
          {q:"¿Puedo traer cualquier producto?",a:"Casi todo. Hay restricciones para ciertos productos (alimentos, medicamentos, armas). Consultanos y te decimos si tu producto se puede importar."},
          {q:"¿Cómo hago el seguimiento de mi envío?",a:"Tenés un portal online donde ves el estado de tu carga en tiempo real: dónde está, cuándo llega, eventos de tracking del courier."},
          {q:"¿Cuánto tarda en llegar?",a:"Courier aéreo: 8-12 días. Carga aérea: 12-18 días. Marítimo: 35-45 días. Tiempos puerta a puerta desde China."},
          {q:"¿El precio incluye impuestos de importación?",a:"Sí, la cotización incluye todos los costos: flete, seguro, despacho de aduana e impuestos. Sin sorpresas."},
        ].map((f,i)=><div key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.06)",marginBottom:0}}>
          <button onClick={()=>setFaq(faq===i?null:i)} style={{width:"100%",padding:"16px 0",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",color:"#fff",fontSize:15,fontWeight:600,textAlign:"left"}}>
            {f.q}
            <span style={{fontSize:18,color:"rgba(255,255,255,0.3)",flexShrink:0,marginLeft:12}}>{faq===i?"−":"+"}</span>
          </button>
          {faq===i&&<p style={{fontSize:14,color:"rgba(255,255,255,0.5)",lineHeight:1.7,margin:"0 0 16px",paddingLeft:0}}>{f.a}</p>}
        </div>)}
      </div>
    </section>

    {/* ─── CTA FINAL ─── */}
    <section style={{padding:"80px 24px",textAlign:"center",background:"radial-gradient(ellipse at 50% 80%, rgba(74,144,217,0.08) 0%, transparent 60%)"}}>
      <div style={{maxWidth:550,margin:"0 auto"}}>
        <h2 style={{fontSize:"clamp(24px, 4vw, 38px)",fontWeight:800,margin:"0 0 12px"}}>Empezá a importar hoy</h2>
        <p style={{fontSize:16,color:"rgba(255,255,255,0.5)",margin:"0 0 32px"}}>Escribinos y en 24hs tenés tu cotización lista. Sin compromiso.</p>
        <a href={waLink("Hola! Quiero empezar a importar desde China")} target="_blank" rel="noopener" style={{display:"inline-flex",alignItems:"center",gap:10,padding:"16px 36px",fontSize:16,fontWeight:700,borderRadius:12,background:"#25D366",color:"#fff",textDecoration:"none",boxShadow:"0 4px 20px rgba(37,211,102,0.3)"}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Hablar con un asesor
        </a>
      </div>
    </section>

    {/* ─── FOOTER ─── */}
    <footer style={{padding:"40px 24px 28px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:20}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <img src={LOGO} alt="AC" style={{height:28}}/>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>© 2026 Argencargo</span>
        </div>
        <div style={{display:"flex",gap:20}}>
          <a href="/portal" style={{fontSize:12,color:"rgba(255,255,255,0.4)",textDecoration:"none"}}>Portal clientes</a>
          <a href="/agente" style={{fontSize:12,color:"rgba(255,255,255,0.4)",textDecoration:"none"}}>Portal agentes</a>
          <a href="mailto:info@argencargo.com.ar" style={{fontSize:12,color:"rgba(255,255,255,0.4)",textDecoration:"none"}}>info@argencargo.com.ar</a>
        </div>
      </div>
    </footer>

    {/* ─── WA FLOTANTE ─── */}
    <a href={waLink("Hola! Quiero info sobre importaciones")} target="_blank" rel="noopener" style={{position:"fixed",bottom:24,right:24,width:60,height:60,borderRadius:"50%",background:"#25D366",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(37,211,102,0.4)",zIndex:99}}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>

    <style>{`
      @media(max-width:768px){
        .dn a:not(:last-child):not(:nth-last-child(2)){display:none!important;}
        .hero-grid{grid-template-columns:1fr!important;gap:32px!important;}
        .hero-dash{display:none!important;}
      }
      html{scroll-behavior:smooth;}
      *{box-sizing:border-box;}
    `}</style>
  </div>;
}
