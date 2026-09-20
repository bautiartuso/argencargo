"use client";
// Catálogo de maquinaria — carga de productos (20/09/2026).
// Acá el equipo (admin, empleados y socios GI) carga cada máquina con todo el detalle del
// proveedor. Publicar exige la ficha completa: la validación vive en la base (trigger
// cat_productos_validar) y acá se replica para mostrar qué falta antes de intentar.
import { useState, useEffect, useMemo, useRef } from "react";
import { comprimirImagen } from "../../../lib/img";
import { toast, ToastStack, confirmDialog, DialogHost } from "../../../lib/ui";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const BG="radial-gradient(1200px 600px at 80% -10%, rgba(184,149,106,0.10), transparent 60%), radial-gradient(900px 700px at -10% 100%, rgba(96,165,250,0.06), transparent 50%), #0A1628";
const GOLD="#B8956A", GOLD_LIGHT="#E8D098";
const GOLD_GRADIENT="linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";
const FONT="'Inter','Segoe UI',sans-serif";

// ── Sesión: sirve la del admin (ac_admin) o la del panel GI (ac_gi_s) ─────────────────────
const leer=(k)=>{try{const d=localStorage.getItem(k);return d?JSON.parse(d):null;}catch{return null;}};
const cargarSesion=()=>{
  const a=leer("ac_admin");if(a?.token&&["admin","empleado"].includes(a?.profile?.role))return{token:a.token,refresh:a.refresh_token,user:a.user,rol:a.profile.role,origen:"ac_admin"};
  const g=leer("ac_gi_s");if(g?.access_token)return{token:g.access_token,refresh:g.refresh_token,user:g.user,rol:"gi",origen:"ac_gi_s"};
  return null;
};
const guardarSesion=(s)=>{try{
  if(s.origen==="ac_admin")localStorage.setItem("ac_admin",JSON.stringify({token:s.token,refresh_token:s.refresh,user:s.user,profile:s.profile}));
  else localStorage.setItem("ac_gi_s",JSON.stringify({access_token:s.token,refresh_token:s.refresh,user:s.user}));
}catch{}};
const sf=async(p,o={})=>{const r=await fetch(`${SB_URL}${p}`,{...o,headers:{apikey:SB_KEY,"Content-Type":"application/json",...(o.headers||{})}});let body=null;try{body=await r.json();}catch{}return{status:r.status,body};};
const jwtExp=(t)=>{try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).exp*1000;}catch{return 0;}};

export default function MaquinariaPage(){
  const [ses,setSes]=useState(null);
  const [cargando,setCargando]=useState(true);
  useEffect(()=>{setSes(cargarSesion());setCargando(false);},[]);
  if(cargando)return <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.4)",fontFamily:FONT}}>Cargando…</div>;
  if(!ses)return <Login onLogin={setSes}/>;
  return <Catalogo ses={ses} setSes={setSes}/>;
}

function Login({onLogin}){
  const [email,setEmail]=useState("");const [pw,setPw]=useState("");const [err,setErr]=useState("");const [lo,setLo]=useState(false);
  const entrar=async(e)=>{e.preventDefault();if(!email||!pw)return;setLo(true);setErr("");
    const r=(await sf("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password:pw})})).body;
    if(!r?.access_token){setErr(r?.error_description||"Credenciales inválidas");setLo(false);return;}
    const p=(await sf(`/rest/v1/profiles?id=eq.${r.user.id}&select=id,role,is_gi_partner,email`,{headers:{Authorization:`Bearer ${r.access_token}`}})).body;
    const prof=Array.isArray(p)?p[0]:null;
    if(!prof||!(["admin","empleado"].includes(prof.role)||prof.is_gi_partner===true)){setErr("Tu cuenta no tiene acceso al catálogo.");setLo(false);return;}
    const esAdmin=["admin","empleado"].includes(prof.role);
    const s={token:r.access_token,refresh:r.refresh_token,user:r.user,rol:esAdmin?prof.role:"gi",origen:esAdmin?"ac_admin":"ac_gi_s",profile:prof};
    guardarSesion(s);onLogin(s);setLo(false);};
  const inp={width:"100%",padding:"11px 13px",borderRadius:9,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.05)",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box"};
  return <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1rem",fontFamily:FONT}}>
    <form onSubmit={entrar} style={{width:"100%",maxWidth:380}}>
      <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.22em",color:GOLD_LIGHT,textTransform:"uppercase",textAlign:"center",margin:"0 0 6px"}}>Argencargo</p>
      <h1 style={{fontSize:22,fontWeight:800,color:"#fff",textAlign:"center",margin:"0 0 22px"}}>Catálogo de máquinas</h1>
      <input style={inp} type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/>
      <input style={{...inp,marginTop:10}} type="password" placeholder="Contraseña" value={pw} onChange={e=>setPw(e.target.value)} autoComplete="current-password"/>
      {err&&<p style={{color:"#f87171",fontSize:12.5,margin:"10px 0 0"}}>{err}</p>}
      <button disabled={lo} style={{width:"100%",marginTop:16,padding:"12px",borderRadius:9,border:"none",background:GOLD_GRADIENT,color:"#0A1628",fontWeight:800,fontSize:14,cursor:"pointer",opacity:lo?0.6:1}}>{lo?"Entrando…":"Entrar"}</button>
    </form>
  </div>;
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────────────────
const INP={width:"100%",padding:"9px 11px",borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.05)",color:"#fff",fontSize:13.5,outline:"none",boxSizing:"border-box",fontFamily:FONT};
const LBL={display:"block",fontSize:11,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",marginBottom:5};
function Campo({label,ob,hint,children,span}){return <div style={{gridColumn:span?`span ${span}`:undefined,minWidth:0}}><label style={LBL}>{label}{ob&&<span style={{color:GOLD_LIGHT,marginLeft:4}}>●</span>}</label>{children}{hint&&<p style={{fontSize:11.5,color:"rgba(255,255,255,0.4)",margin:"4px 0 0"}}>{hint}</p>}</div>;}
const Inp=(p)=><input {...p} style={{...INP,...(p.style||{})}}/>;
const TA=(p)=><textarea {...p} style={{...INP,minHeight:p.rows?undefined:90,resize:"vertical",lineHeight:1.45,...(p.style||{})}}/>;
const Sel=({children,...p})=><select {...p} style={{...INP,appearance:"auto",...(p.style||{})}}>{children}</select>;
function Btn({children,onClick,kind="ghost",disabled,small,title,type="button"}){
  const base={padding:small?"6px 11px":"9px 16px",borderRadius:8,fontSize:small?12:13,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,fontFamily:FONT,border:"1px solid transparent",transition:"all 120ms"};
  const k=kind==="gold"?{background:GOLD_GRADIENT,color:"#0A1628"}:kind==="danger"?{background:"rgba(248,113,113,0.12)",color:"#f87171",borderColor:"rgba(248,113,113,0.3)"}:kind==="blue"?{background:"rgba(96,165,250,0.12)",color:"#93c5fd",borderColor:"rgba(96,165,250,0.3)"}:{background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.85)",borderColor:"rgba(255,255,255,0.12)"};
  return <button type={type} title={title} disabled={disabled} onClick={onClick} style={{...base,...k}}>{children}</button>;
}
function Sec({titulo,sub,children}){return <section style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"18px 18px 20px",marginBottom:14}}><h3 style={{margin:"0 0 2px",fontSize:15,fontWeight:800,color:"#fff"}}>{titulo}</h3>{sub&&<p style={{margin:"0 0 14px",fontSize:12.5,color:"rgba(255,255,255,0.45)"}}>{sub}</p>}{!sub&&<div style={{height:12}}/>}{children}</section>;}
const GRID={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12};
const n=(v)=>{const x=Number(String(v??"").replace(",","."));return Number.isFinite(x)?x:0;};
const numONull=(v)=>String(v??"").trim()===""?null:n(v);
const txtONull=(v)=>String(v??"").trim()===""?null:String(v).trim();
const fmtUsd=(v)=>`USD ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const codigo=(p)=>`MAQ-${String(p.numero||0).padStart(5,"0")}`;
const ESTADO={borrador:{l:"Borrador",c:"rgba(255,255,255,0.5)",bg:"rgba(255,255,255,0.08)"},publicado:{l:"Publicado",c:"#4ade80",bg:"rgba(74,222,128,0.14)"},pausado:{l:"Pausado",c:"#fbbf24",bg:"rgba(251,191,36,0.14)"}};

// ── Catálogo ──────────────────────────────────────────────────────────────────────────────
function Catalogo({ses,setSes}){
  const [token,setToken]=useState(ses.token);
  const refrescar=async()=>{const r=(await sf("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:ses.refresh})})).body;if(r?.access_token){const s2={...ses,token:r.access_token,refresh:r.refresh_token||ses.refresh};guardarSesion(s2);setToken(r.access_token);return r.access_token;}return null;};
  const dq=async(t,{method="GET",body,filters="",prefer}={})=>{
    let tk=token;if(jwtExp(tk)&&Date.now()>jwtExp(tk)-60000){tk=(await refrescar())||tk;}
    const pedir=(k)=>sf(`/rest/v1/${t}${filters}`,{method,body:body?JSON.stringify(body):undefined,headers:{Authorization:`Bearer ${k}`,...(prefer||method==="POST"||method==="PATCH"?{Prefer:prefer||"return=representation"}:{})}});
    let r=await pedir(tk);if(r.status===401){const nt=await refrescar();if(nt)r=await pedir(nt);}
    if(r.status>=400){const msg=r.body?.message||r.body?.error||`Error ${r.status}`;throw new Error(msg);}
    return r.body;
  };
  const salir=()=>{try{localStorage.removeItem(ses.origen);}catch{}setSes(null);};

  const [cats,setCats]=useState([]);
  const [provs,setProvs]=useState([]);
  const [prods,setProds]=useState([]);
  const [antid,setAntid]=useState([]);
  const [sel,setSel]=useState(null);      // producto abierto en el editor
  const [fEstado,setFEstado]=useState("todos");
  const [busq,setBusq]=useState("");
  const [listo,setListo]=useState(false);

  const cargar=async()=>{try{
    const [c,p,pr,a]=await Promise.all([
      dq("cat_categorias",{filters:"?select=*&order=orden.asc,nombre.asc"}),
      dq("cat_proveedores",{filters:"?select=*&order=fabrica.asc"}),
      dq("cat_productos",{filters:"?select=id,numero,estado,nombre,nombre_raw,modelo,categoria,subcategoria,exw_usd,fotos,updated_at,proveedor_id&order=updated_at.desc"}),
      dq("antidumping_ncm",{filters:"?select=ncm_prefix,producto,nota,medida_tipo,valor,unidad,resolucion,vigencia_hasta&activo=eq.true"}),
    ]);
    setCats(Array.isArray(c)?c:[]);setProvs(Array.isArray(p)?p:[]);setProds(Array.isArray(pr)?pr:[]);setAntid(Array.isArray(a)?a:[]);
  }catch(e){toast(e.message,"error");}setListo(true);};
  useEffect(()=>{cargar();},[]); // eslint-disable-line react-hooks/exhaustive-deps

  const arbol=useMemo(()=>cats.filter(c=>!c.padre_slug).map(c=>({...c,subs:cats.filter(s=>s.padre_slug===c.slug)})),[cats]);
  const nombreCat=(slug)=>cats.find(c=>c.slug===slug)?.nombre||slug||"—";

  const nuevo=async()=>{try{
    const r=await dq("cat_productos",{method:"POST",body:{estado:"borrador",created_by:ses.user?.id||null}});
    const p=Array.isArray(r)?r[0]:r;await cargar();setSel(p.id);
  }catch(e){toast(e.message,"error");}};

  const visibles=prods.filter(p=>(fEstado==="todos"||p.estado===fEstado)&&(!busq.trim()||`${codigo(p)} ${p.nombre||""} ${p.nombre_raw||""} ${p.modelo||""}`.toLowerCase().includes(busq.toLowerCase())));
  const cuenta=(e)=>prods.filter(p=>p.estado===e).length;

  return <div style={{minHeight:"100vh",background:BG,fontFamily:FONT,color:"#fff"}}>
    <ToastStack/><DialogHost/>
    <header style={{display:"flex",alignItems:"center",gap:14,padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)",position:"sticky",top:0,background:"rgba(10,22,40,0.92)",backdropFilter:"blur(10px)",zIndex:5}}>
      <span style={{fontSize:9,fontWeight:800,padding:"3px 8px",borderRadius:5,background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.16em"}}>AC</span>
      <div style={{flex:1,minWidth:0}}><p style={{margin:0,fontSize:15,fontWeight:800}}>Catálogo de máquinas</p><p style={{margin:0,fontSize:11.5,color:"rgba(255,255,255,0.4)"}}>{ses.user?.email}{ses.rol==="gi"?" · GI":""}</p></div>
      {sel&&<Btn onClick={()=>setSel(null)}>← Volver al listado</Btn>}
      <Btn small onClick={salir}>Salir</Btn>
    </header>
    <main style={{maxWidth:1080,margin:"0 auto",padding:"22px 16px 80px"}}>
      {sel
        ?<Editor key={sel} id={sel} dq={dq} token={token} arbol={arbol} cats={cats} provs={provs} antid={antid} recargar={cargar} onCerrar={()=>setSel(null)} onProvNuevo={(p)=>setProvs(x=>[...x,p].sort((a,b)=>a.fabrica.localeCompare(b.fabrica)))}/>
        :<>
          <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{display:"flex",gap:4,background:"rgba(255,255,255,0.04)",borderRadius:9,padding:3}}>
              {[["todos","Todos",prods.length],["publicado","Publicados",cuenta("publicado")],["borrador","Borradores",cuenta("borrador")],["pausado","Pausados",cuenta("pausado")]].map(([k,l,c])=><button key={k} onClick={()=>setFEstado(k)} style={{padding:"7px 12px",borderRadius:7,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:700,background:fEstado===k?"rgba(184,149,106,0.18)":"transparent",color:fEstado===k?GOLD_LIGHT:"rgba(255,255,255,0.55)",fontFamily:FONT}}>{l} <span style={{opacity:0.6,fontVariantNumeric:"tabular-nums"}}>{c}</span></button>)}
            </div>
            <input placeholder="Buscar por nombre, modelo o código…" value={busq} onChange={e=>setBusq(e.target.value)} style={{...INP,flex:1,minWidth:200}}/>
            <Btn kind="gold" onClick={nuevo}>+ Nueva máquina</Btn>
          </div>
          {!listo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>
          :visibles.length===0?<div style={{textAlign:"center",padding:"60px 20px",color:"rgba(255,255,255,0.45)"}}><p style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.7)",margin:"0 0 6px"}}>{prods.length===0?"Todavía no hay máquinas cargadas":"Nada que coincida"}</p><p style={{margin:0,fontSize:13}}>{prods.length===0?"Arrancá con “Nueva máquina”: se crea como borrador y podés completarla de a poco.":"Probá con otro filtro o búsqueda."}</p></div>
          :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:12}}>
            {visibles.map(p=>{const es=ESTADO[p.estado]||ESTADO.borrador;const foto=Array.isArray(p.fotos)&&p.fotos[0];return <button key={p.id} onClick={()=>setSel(p.id)} style={{textAlign:"left",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:0,overflow:"hidden",cursor:"pointer",color:"#fff",fontFamily:FONT}}>
              <div style={{aspectRatio:"4/3",background:"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>{foto?<img src={foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>Sin fotos</span>}</div>
              <div style={{padding:"11px 13px 13px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:5}}><span style={{fontSize:11,fontWeight:700,color:GOLD_LIGHT,letterSpacing:"0.04em"}}>{codigo(p)}</span><span style={{fontSize:10.5,fontWeight:800,padding:"2px 8px",borderRadius:6,background:es.bg,color:es.c,letterSpacing:"0.04em",textTransform:"uppercase"}}>{es.l}</span></div>
                <p style={{margin:"0 0 4px",fontSize:13.5,fontWeight:700,lineHeight:1.3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{p.nombre||p.nombre_raw||<span style={{color:"rgba(255,255,255,0.4)",fontWeight:500}}>Sin nombre todavía</span>}</p>
                <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.45)"}}>{p.categoria?`${nombreCat(p.categoria)} · ${nombreCat(p.subcategoria)}`:"Sin categoría"}{p.exw_usd?` · EXW ${fmtUsd(p.exw_usd)}`:""}</p>
              </div>
            </button>;})}
          </div>}
        </>}
    </main>
  </div>;
}

// ── Editor de un producto ─────────────────────────────────────────────────────────────────
const VACIO={nombre_raw:"",modelo:"",specs_raw:"",descripcion_raw:"",nombre:"",descripcion:"",categoria:"",subcategoria:"",condicion:"nueva",anio:"",horas_uso:"",voltaje:"",fase:"",frecuencia_hz:"50",capacidad:"",incluye:"",garantia_meses:"",fotos:[],video_url:"",exw_usd:"",moq:"1",dias_produccion:"",packing:[],ncm_code:"",ncm_descripcion:"",die:"",te:"",iva:"",intervencion:null,antidumping:null,proveedor_id:"",link_producto:"",notas_internas:""};
const BULTO=()=>({cantidad:"1",largo_cm:"",ancho_cm:"",alto_cm:"",peso_kg:"",contenido:""});

function Editor({id,dq,token,arbol,cats,provs,antid,recargar,onCerrar,onProvNuevo}){
  const [p,setP]=useState(null);
  const [f,setF]=useState(VACIO);
  const [dirty,setDirty]=useState(false);
  const [guardando,setGuardando]=useState(false);
  const [ia,setIa]=useState(false);
  const [ncmIa,setNcmIa]=useState(false);
  const [subiendo,setSubiendo]=useState(0);
  const [provForm,setProvForm]=useState(null);
  const fileRef=useRef(null);const videoRef=useRef(null);

  useEffect(()=>{(async()=>{try{
    const r=await dq("cat_productos",{filters:`?id=eq.${id}&select=*`});const row=Array.isArray(r)?r[0]:null;if(!row){toast("No se encontró el producto","error");onCerrar();return;}
    setP(row);
    const s=(v)=>v==null?"":String(v);
    setF({...VACIO,...Object.fromEntries(Object.keys(VACIO).map(k=>[k,k==="fotos"||k==="packing"?(Array.isArray(row[k])?row[k].map(x=>k==="packing"?Object.fromEntries(Object.entries(x).map(([a,b])=>[a,s(b)])):x):[]):k==="intervencion"||k==="antidumping"?row[k]:s(row[k])])),frecuencia_hz:row.frecuencia_hz?String(row.frecuencia_hz):"50",moq:row.moq?String(row.moq):"1",condicion:row.condicion||"nueva"});
  }catch(e){toast(e.message,"error");}})();},[id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set=(k,v)=>{setF(x=>({...x,[k]:v}));setDirty(true);};
  const subs=useMemo(()=>arbol.find(c=>c.slug===f.categoria)?.subs||[],[arbol,f.categoria]);
  const prov=provs.find(x=>x.id===f.proveedor_id);

  // Antidumping por prefijo, sobre la tabla que ya usa la calculadora.
  const ad=useMemo(()=>{const c=String(f.ncm_code||"").replace(/\./g,"");if(!c)return null;return antid.find(a=>c.startsWith(String(a.ncm_prefix||"").replace(/\./g,"")))||null;},[antid,f.ncm_code]);

  // Lo mismo que exige el trigger, para mostrarlo antes de intentar publicar.
  const faltan=useMemo(()=>{const out=[];
    if(!f.modelo.trim())out.push("modelo / código");
    if(f.nombre.trim().length<12)out.push("nombre completo");else if(f.modelo.trim()&&!f.nombre.toLowerCase().includes(f.modelo.trim().toLowerCase()))out.push(`el nombre tiene que incluir el código ${f.modelo.trim()}`);
    if(!f.descripcion.trim())out.push("descripción");
    if(!f.categoria||!f.subcategoria)out.push("categoría y subcategoría");
    if(!f.voltaje.trim())out.push("voltaje");
    if(f.condicion==="usada"&&!f.anio.trim())out.push("año (máquina usada)");
    if(f.fotos.length<5)out.push(`mínimo 5 fotos (hay ${f.fotos.length})`);
    if(n(f.exw_usd)<=0)out.push("valor EXW");
    if(n(f.dias_produccion)<=0)out.push("días de producción");
    if(f.packing.length<1)out.push("packing (al menos un bulto)");else if(f.packing.some(b=>n(b.cantidad)<=0||n(b.largo_cm)<=0||n(b.ancho_cm)<=0||n(b.alto_cm)<=0||n(b.peso_kg)<=0))out.push("packing incompleto (cantidad, medidas y peso de cada bulto)");
    if(!f.ncm_code.trim())out.push("posición NCM");
    if(!f.proveedor_id)out.push("proveedor");
    if(!f.link_producto.trim())out.push("link del producto");
    return out;},[f]);

  const cuerpo=(estado)=>({
    estado:estado||p.estado,
    nombre_raw:txtONull(f.nombre_raw),modelo:txtONull(f.modelo),specs_raw:txtONull(f.specs_raw),descripcion_raw:txtONull(f.descripcion_raw),
    nombre:txtONull(f.nombre),descripcion:txtONull(f.descripcion),categoria:txtONull(f.categoria),subcategoria:txtONull(f.subcategoria),
    condicion:f.condicion,anio:numONull(f.anio),horas_uso:numONull(f.horas_uso),voltaje:txtONull(f.voltaje),fase:txtONull(f.fase),frecuencia_hz:numONull(f.frecuencia_hz),
    capacidad:txtONull(f.capacidad),incluye:txtONull(f.incluye),garantia_meses:numONull(f.garantia_meses),fotos:f.fotos,video_url:txtONull(f.video_url),
    exw_usd:numONull(f.exw_usd),moq:numONull(f.moq)||1,dias_produccion:numONull(f.dias_produccion),
    packing:f.packing.map(b=>({cantidad:n(b.cantidad),largo_cm:n(b.largo_cm),ancho_cm:n(b.ancho_cm),alto_cm:n(b.alto_cm),peso_kg:n(b.peso_kg),contenido:txtONull(b.contenido)})),
    ncm_code:txtONull(f.ncm_code),ncm_descripcion:txtONull(f.ncm_descripcion),die:numONull(f.die),te:numONull(f.te),iva:numONull(f.iva),intervencion:f.intervencion||null,antidumping:ad?{prefix:ad.ncm_prefix,producto:ad.producto,medida_tipo:ad.medida_tipo,valor:ad.valor,unidad:ad.unidad,resolucion:ad.resolucion}:null,
    proveedor_id:f.proveedor_id||null,link_producto:txtONull(f.link_producto),notas_internas:txtONull(f.notas_internas),
  });
  const guardar=async(estado)=>{setGuardando(true);try{
    const r=await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:cuerpo(estado)});
    const row=Array.isArray(r)?r[0]:null;if(row)setP(row);setDirty(false);await recargar();
    toast(estado==="publicado"?"Publicado en el catálogo":estado==="pausado"?"Pausado":"Guardado");
  }catch(e){toast(e.message.replace(/^.*?No se puede publicar/,"No se puede publicar"),"error",{duration:7000});}setGuardando(false);};
  const eliminar=async()=>{if(!(await confirmDialog(`¿Eliminar ${codigo(p)}? Se borra la ficha y sus fotos. No se puede deshacer.`)))return;try{
    for(const u of f.fotos){const path=u.split("/object/public/catalogo/")[1];if(path)fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"DELETE",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`}}).catch(()=>{});}
    await dq("cat_productos",{method:"DELETE",filters:`?id=eq.${id}`,prefer:"return=minimal"});await recargar();toast("Eliminado");onCerrar();
  }catch(e){toast(e.message,"error");}};

  // ── IA: nombre, categoría, descripción ──
  const completarIA=async()=>{if(!f.nombre_raw.trim()&&!f.specs_raw.trim()&&!f.descripcion_raw.trim()){toast("Pegá primero lo que te pasó el proveedor","error");return;}setIa(true);try{
    const r=await fetch("/api/catalogo/ia",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({nombre_raw:f.nombre_raw,modelo:f.modelo,specs_raw:f.specs_raw,descripcion_raw:f.descripcion_raw,condicion:f.condicion,categorias:arbol.map(c=>({slug:c.slug,nombre:c.nombre,subs:c.subs.map(s=>({slug:s.slug,nombre:s.nombre}))}))})});
    const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||"Falló la IA");
    setF(x=>({...x,nombre:d.nombre||x.nombre,descripcion:d.descripcion||x.descripcion,categoria:d.categoria||x.categoria,subcategoria:d.subcategoria||x.subcategoria,voltaje:x.voltaje||d.voltaje||"",fase:x.fase||d.fase||"",capacidad:x.capacidad||d.capacidad||"",incluye:x.incluye||d.incluye||""}));setDirty(true);
    toast("Ficha completada · revisá el nombre y la descripción");
  }catch(e){toast(e.message,"error");}setIa(false);};

  // ── NCM: clasificar con IA o buscar el código tipeado en la base ──
  const aplicarNcm=(d)=>{setF(x=>({...x,ncm_code:d.ncm_code||x.ncm_code,ncm_descripcion:d.ncm_description||d.description||x.ncm_descripcion,die:d.import_duty_rate!=null?String(d.import_duty_rate):d.die!=null?String(d.die):x.die,te:d.statistics_rate!=null?String(d.statistics_rate):d.te!=null?String(Math.min(Number(d.te),3)):x.te,iva:d.iva_rate!=null?String(d.iva_rate):d.iva!=null?String(d.iva):x.iva,intervencion:d.intervention!==undefined?d.intervention:x.intervencion}));setDirty(true);};
  const clasificar=async()=>{const desc=[f.nombre||f.nombre_raw,f.specs_raw].filter(Boolean).join(". ").slice(0,1500);if(!desc.trim()){toast("Primero cargá el nombre o las specs","error");return;}setNcmIa(true);try{
    const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:desc})});const d=await r.json();if(!d?.ncm_code)throw new Error(d?.error||"No se pudo clasificar");aplicarNcm(d);toast(`NCM ${d.ncm_code}`);
  }catch(e){toast(e.message,"error");}setNcmIa(false);};
  const buscarCodigo=async()=>{const c=f.ncm_code.trim();if(!/^\d{4}\.\d{2}\.\d{2}$/.test(c)){toast("El formato es XXXX.XX.XX","error");return;}try{
    const r=await dq("ncm_database",{filters:`?ncm_code=eq.${c}&select=ncm_code,description,die,te,iva&limit=1`});const d=Array.isArray(r)?r[0]:null;if(!d){toast("Esa posición no está en la base","error");return;}aplicarNcm({...d,intervention:f.intervencion});toast("Alícuotas cargadas de la base");
  }catch(e){toast(e.message,"error");}};

  // ── Fotos y video ──
  const subir=async(files,tipo)=>{const lista=Array.from(files||[]);if(!lista.length)return;setSubiendo(lista.length);const nuevas=[];
    for(let i=0;i<lista.length;i++){let file=lista[i];try{
      if(tipo==="foto")file=await comprimirImagen(file,{maxLado:2000,calidad:0.86});
      const ext=tipo==="foto"?"jpg":(file.name.split(".").pop()||"mp4").toLowerCase();
      const path=`productos/${id}/${Date.now()}-${i}.${ext}`;
      const r=await fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"POST",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},body:file});
      if(!r.ok)throw new Error(`No se pudo subir (${r.status})`);
      nuevas.push(`${SB_URL}/storage/v1/object/public/catalogo/${path}`);
    }catch(e){toast(e.message,"error");}setSubiendo(lista.length-i-1);}
    if(!nuevas.length)return;
    if(tipo==="foto"){const fotos=[...f.fotos,...nuevas];setF(x=>({...x,fotos}));await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{fotos}}).catch(e=>toast(e.message,"error"));toast(`${nuevas.length} foto${nuevas.length>1?"s":""} subida${nuevas.length>1?"s":""}`);}
    else{set("video_url",nuevas[0]);toast("Video subido · guardá la ficha");}
  };
  const quitarFoto=async(u)=>{const fotos=f.fotos.filter(x=>x!==u);setF(x=>({...x,fotos}));const path=u.split("/object/public/catalogo/")[1];if(path)fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"DELETE",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`}}).catch(()=>{});await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{fotos}}).catch(e=>toast(e.message,"error"));};
  const principal=async(u)=>{const fotos=[u,...f.fotos.filter(x=>x!==u)];setF(x=>({...x,fotos}));await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{fotos}}).catch(e=>toast(e.message,"error"));};

  // ── Proveedor nuevo / edición ──
  const guardarProv=async()=>{const q=provForm;if(!q.fabrica.trim()||!q.ciudad.trim()||!q.contacto.trim()){toast("Fábrica, ciudad y contacto son obligatorios","error");return;}if(!q.wechat.trim()&&!q.whatsapp.trim()&&!q.chat_plataforma.trim()){toast("Cargá al menos una vía de contacto: WeChat, WhatsApp o el chat de la plataforma","error");return;}try{
    const body={fabrica:q.fabrica.trim(),ciudad:q.ciudad.trim(),contacto:q.contacto.trim(),wechat:txtONull(q.wechat),whatsapp:txtONull(q.whatsapp),chat_plataforma:txtONull(q.chat_plataforma),notas:txtONull(q.notas)};
    if(q.id){const r=await dq("cat_proveedores",{method:"PATCH",filters:`?id=eq.${q.id}`,body});const row=Array.isArray(r)?r[0]:null;await recargar();if(row)toast("Proveedor actualizado");}
    else{const r=await dq("cat_proveedores",{method:"POST",body:{...body,created_by:p.created_by||null}});const row=Array.isArray(r)?r[0]:r;onProvNuevo(row);set("proveedor_id",row.id);toast("Proveedor creado");}
    setProvForm(null);
  }catch(e){toast(e.message,"error");}};

  if(!p)return <p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>;
  const es=ESTADO[p.estado]||ESTADO.borrador;
  const totKg=f.packing.reduce((s,b)=>s+n(b.peso_kg)*(n(b.cantidad)||1),0);
  const totM3=f.packing.reduce((s,b)=>s+(n(b.largo_cm)*n(b.ancho_cm)*n(b.alto_cm)/1e6)*(n(b.cantidad)||1),0);
  const verificado=p.precio_verificado_at?Math.floor((Date.now()-new Date(p.precio_verificado_at))/864e5):null;
  const pv=(x)=>x==null?null:String(x).replace(".",",");

  return <div>
    <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:10,marginBottom:16}}>
      <span style={{fontSize:12,fontWeight:800,color:GOLD_LIGHT,letterSpacing:"0.06em"}}>{codigo(p)}</span>
      <span style={{fontSize:10.5,fontWeight:800,padding:"3px 9px",borderRadius:6,background:es.bg,color:es.c,letterSpacing:"0.04em",textTransform:"uppercase"}}>{es.l}</span>
      {dirty&&<span style={{fontSize:11.5,color:"#fbbf24"}}>● Cambios sin guardar</span>}
      <span style={{flex:1}}/>
      <Btn kind="danger" small onClick={eliminar}>Eliminar</Btn>
    </div>

    <Sec titulo="La máquina" sub="Pegá lo que te pasó el proveedor tal cual; con eso la IA arma el nombre, la categoría y la descripción. Después corregís lo que haga falta.">
      <div style={GRID}>
        <Campo label="Nombre crudo del proveedor" ob span={2}><Inp value={f.nombre_raw} onChange={e=>set("nombre_raw",e.target.value)} placeholder="Ej: Sliding table saw MJ6132TD 3200mm with scoring blade"/></Campo>
        <Campo label="Modelo / código" ob hint="Tal como lo escribe la fábrica. Tiene que aparecer en el nombre."><Inp value={f.modelo} onChange={e=>set("modelo",e.target.value)} placeholder="MJ6132TD"/></Campo>
        <Campo label="Especificaciones copiadas" span={3}><TA value={f.specs_raw} onChange={e=>set("specs_raw",e.target.value)} placeholder="Copiá la tabla de especificaciones de Alibaba / 1688 o lo que te mandó por chat: potencia, medidas, capacidad, voltaje…" style={{minHeight:110}}/></Campo>
        <Campo label="Tu texto sobre la máquina" ob span={3} hint="Para quién es, qué hace bien, qué te contó el proveedor. La IA redacta la descripción a partir de esto."><TA value={f.descripcion_raw} onChange={e=>set("descripcion_raw",e.target.value)} placeholder="Ej: escuadradora para carpinterías medianas, corta melamina sin astillar gracias al incisor, viene con dos hojas y manual…"/></Campo>
      </div>
      <div style={{marginTop:14,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <Btn kind="blue" onClick={completarIA} disabled={ia}>{ia?"Redactando…":"✨ Completar con IA"}</Btn>
        <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Genera nombre, categoría y descripción. Podés pisarlos.</span>
      </div>
      <div style={{...GRID,marginTop:18}}>
        <Campo label="Nombre comercial" ob span={3} hint="Tipo de máquina + lo que la define + código. Nunca solo “Escuadradora”."><Inp value={f.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Escuadradora de 3.200 mm con incisor · MJ6132TD" style={{fontSize:15,fontWeight:700}}/></Campo>
        <Campo label="Descripción" ob span={3}><TA value={f.descripcion} onChange={e=>set("descripcion",e.target.value)} style={{minHeight:150}}/></Campo>
        <Campo label="Categoría" ob><Sel value={f.categoria} onChange={e=>{set("categoria",e.target.value);set("subcategoria","");}}><option value="">Elegir…</option>{arbol.map(c=><option key={c.slug} value={c.slug}>{c.nombre}</option>)}</Sel></Campo>
        <Campo label="Subcategoría" ob><Sel value={f.subcategoria} onChange={e=>set("subcategoria",e.target.value)} disabled={!f.categoria}><option value="">Elegir…</option>{subs.map(s=><option key={s.slug} value={s.slug}>{s.nombre}</option>)}</Sel></Campo>
        <Campo label="Condición" ob><Sel value={f.condicion} onChange={e=>set("condicion",e.target.value)}><option value="nueva">Nueva</option><option value="usada">Usada</option></Sel></Campo>
        {f.condicion==="usada"&&<><Campo label="Año" ob><Inp type="number" value={f.anio} onChange={e=>set("anio",e.target.value)} placeholder="2019"/></Campo><Campo label="Horas de uso"><Inp type="number" value={f.horas_uso} onChange={e=>set("horas_uso",e.target.value)}/></Campo></>}
        <Campo label="Voltaje" ob hint="China cotiza mucho para 110 V / 60 Hz. Confirmalo por escrito."><Sel value={f.voltaje} onChange={e=>set("voltaje",e.target.value)}><option value="">Elegir…</option><option>220 V</option><option>380 V</option><option>220 V / 380 V</option><option>110 V</option><option>12 V / 24 V</option><option>Sin conexión eléctrica</option></Sel></Campo>
        <Campo label="Fase"><Sel value={f.fase} onChange={e=>set("fase",e.target.value)}><option value="">—</option><option value="monofasica">Monofásica</option><option value="trifasica">Trifásica</option></Sel></Campo>
        <Campo label="Frecuencia"><Sel value={f.frecuencia_hz} onChange={e=>set("frecuencia_hz",e.target.value)}><option value="50">50 Hz</option><option value="60">60 Hz</option><option value="">—</option></Sel></Campo>
        <Campo label="Capacidad / producción"><Inp value={f.capacidad} onChange={e=>set("capacidad",e.target.value)} placeholder="25 L/h · 1.200 piezas/h"/></Campo>
        <Campo label="Garantía de fábrica (meses)"><Inp type="number" value={f.garantia_meses} onChange={e=>set("garantia_meses",e.target.value)} placeholder="12"/></Campo>
        <Campo label="Qué incluye" span={3}><Inp value={f.incluye} onChange={e=>set("incluye",e.target.value)} placeholder="Accesorios, repuestos de desgaste, manual, herramientas…"/></Campo>
      </div>
    </Sec>

    <Sec titulo="Fotos y video" sub="Mínimo 5 fotos para publicar. La primera es la principal. Video opcional: archivo o link de YouTube.">
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10,marginBottom:12}}>
        {f.fotos.map((u,i)=><div key={u} style={{position:"relative",aspectRatio:"1",borderRadius:10,overflow:"hidden",border:`1px solid ${i===0?GOLD:"rgba(255,255,255,0.1)"}`,background:"rgba(255,255,255,0.04)"}}>
          <img src={u} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          {i===0&&<span style={{position:"absolute",top:6,left:6,fontSize:9.5,fontWeight:800,padding:"2px 6px",borderRadius:5,background:GOLD_GRADIENT,color:"#0A1628"}}>PRINCIPAL</span>}
          <div style={{position:"absolute",bottom:0,left:0,right:0,display:"flex",gap:4,padding:5,background:"linear-gradient(transparent,rgba(0,0,0,0.75))"}}>
            {i>0&&<button type="button" onClick={()=>principal(u)} title="Hacer principal" style={{flex:1,fontSize:10.5,fontWeight:700,padding:"4px 0",borderRadius:5,border:"none",background:"rgba(255,255,255,0.18)",color:"#fff",cursor:"pointer"}}>★</button>}
            <button type="button" onClick={()=>quitarFoto(u)} title="Quitar" style={{flex:1,fontSize:10.5,fontWeight:700,padding:"4px 0",borderRadius:5,border:"none",background:"rgba(248,113,113,0.5)",color:"#fff",cursor:"pointer"}}>✕</button>
          </div>
        </div>)}
        <button type="button" onClick={()=>fileRef.current?.click()} disabled={subiendo>0} style={{aspectRatio:"1",borderRadius:10,border:"1px dashed rgba(255,255,255,0.25)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:12.5,fontWeight:700,fontFamily:FONT}}>{subiendo>0?`Subiendo ${subiendo}…`:"+ Fotos"}</button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e=>{subir(e.target.files,"foto");e.target.value="";}}/>
      </div>
      <p style={{fontSize:12,color:f.fotos.length>=5?"#4ade80":"rgba(255,255,255,0.45)",margin:"0 0 14px"}}>{f.fotos.length} de 5 fotos mínimas{f.fotos.length>=5?" ✓":""}</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"end"}}>
        <div style={{flex:1,minWidth:220}}><Campo label="Video (link o archivo)"><Inp value={f.video_url} onChange={e=>set("video_url",e.target.value)} placeholder="https://youtube.com/…"/></Campo></div>
        <Btn onClick={()=>videoRef.current?.click()} disabled={subiendo>0}>Subir archivo</Btn>
        <input ref={videoRef} type="file" accept="video/*" hidden onChange={e=>{subir(e.target.files,"video");e.target.value="";}}/>
      </div>
    </Sec>

    <Sec titulo="Precio y plazo" sub="Condición de venta siempre EXW. El flete interno en China se suma después, en la cotización.">
      <div style={GRID}>
        <Campo label="Valor EXW unitario (USD)" ob hint={verificado!=null?`Verificado hace ${verificado} día${verificado===1?"":"s"}`:"Se marca como verificado al guardar"}><Inp type="number" step="0.01" value={f.exw_usd} onChange={e=>set("exw_usd",e.target.value)} placeholder="8500"/></Campo>
        <Campo label="Días de producción" ob hint="Desde que la fábrica recibe el pago hasta que la máquina está lista."><Inp type="number" value={f.dias_produccion} onChange={e=>set("dias_produccion",e.target.value)} placeholder="25"/></Campo>
        <Campo label="Cantidad mínima (MOQ)"><Inp type="number" value={f.moq} onChange={e=>set("moq",e.target.value)}/></Campo>
      </div>
    </Sec>

    <Sec titulo="Packing" sub="Medidas y peso embalado (huacal o caja), no de la máquina desnuda. Una máquina puede viajar en varios bultos distintos.">
      {f.packing.length>0&&<div style={{overflowX:"auto",marginBottom:10}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{color:"rgba(255,255,255,0.45)",fontSize:10.5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{["Cant.","Largo cm","Ancho cm","Alto cm","Peso bruto kg","Qué va adentro",""].map(h=><th key={h} style={{textAlign:"left",padding:"4px 6px",fontWeight:700}}>{h}</th>)}</tr></thead>
        <tbody>{f.packing.map((b,i)=>{const up=(k,v)=>{const pk=f.packing.map((x,j)=>j===i?{...x,[k]:v}:x);set("packing",pk);};return <tr key={i}>
          {["cantidad","largo_cm","ancho_cm","alto_cm","peso_kg"].map(k=><td key={k} style={{padding:"3px 4px",minWidth:80}}><Inp type="number" step="0.01" value={b[k]} onChange={e=>up(k,e.target.value)}/></td>)}
          <td style={{padding:"3px 4px",minWidth:150}}><Inp value={b.contenido} onChange={e=>up("contenido",e.target.value)} placeholder="Bancada / cabezal / accesorios"/></td>
          <td style={{padding:"3px 4px"}}><Btn small kind="danger" onClick={()=>set("packing",f.packing.filter((_,j)=>j!==i))}>✕</Btn></td>
        </tr>;})}</tbody>
      </table></div>}
      <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <Btn onClick={()=>set("packing",[...f.packing,BULTO()])}>+ Agregar bulto</Btn>
        {f.packing.length>0&&<span style={{fontSize:12.5,color:"rgba(255,255,255,0.55)"}}>Total: <b style={{color:"#fff"}}>{totM3.toFixed(3).replace(".",",")} m³</b> · <b style={{color:"#fff"}}>{totKg.toLocaleString("es-AR")} kg</b> brutos</span>}
      </div>
    </Sec>

    <Sec titulo="Posición arancelaria (NCM)" sub="Clasificá con la IA o escribí el código y traé las alícuotas de la base. El antidumping y las intervenciones salen solos.">
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"end"}}>
        <div style={{width:170}}><Campo label="NCM" ob><Inp value={f.ncm_code} onChange={e=>set("ncm_code",e.target.value)} placeholder="8465.91.10" onBlur={()=>{if(/^\d{4}\.\d{2}\.\d{2}$/.test(f.ncm_code.trim())&&!f.die)buscarCodigo();}}/></Campo></div>
        <Btn kind="blue" onClick={clasificar} disabled={ncmIa}>{ncmIa?"Clasificando…":"✨ Clasificar con IA"}</Btn>
        <Btn onClick={buscarCodigo}>Traer alícuotas del código</Btn>
      </div>
      {f.ncm_code&&<div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        {[["Derechos (DIE)",f.die],["Tasa estadística",f.te],["IVA",f.iva]].map(([l,v])=><div key={l} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 12px"}}><p style={{margin:0,fontSize:10.5,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:700}}>{l}</p><p style={{margin:"3px 0 0",fontSize:18,fontWeight:800,color:"#fff"}}>{v!==""&&v!=null?`${pv(v)} %`:"—"}</p></div>)}
        <div style={{gridColumn:"1 / -1",fontSize:12.5,color:"rgba(255,255,255,0.55)"}}>{f.ncm_descripcion||""}</div>
        {ad&&<div style={{gridColumn:"1 / -1",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.35)",borderRadius:10,padding:"10px 13px"}}><p style={{margin:0,fontSize:12,fontWeight:800,color:"#f87171",textTransform:"uppercase",letterSpacing:"0.05em"}}>⚠ Antidumping · {ad.producto}</p><p style={{margin:"3px 0 0",fontSize:12.5,color:"rgba(255,255,255,0.75)"}}>{ad.medida_tipo==="valor_minimo"?`Valor mínimo de exportación ${fmtUsd(ad.valor)}${ad.unidad?` por ${ad.unidad}`:""}`:ad.valor!=null?`${ad.medida_tipo||"Derecho"}: ${pv(ad.valor)}${ad.unidad?` ${ad.unidad}`:" %"}`:ad.medida_tipo||""}{ad.resolucion?` · ${ad.resolucion}`:""}{ad.vigencia_hasta?` · vigente hasta ${new Date(ad.vigencia_hasta).toLocaleDateString("es-AR")}`:""}{ad.nota?` · ${ad.nota}`:""}</p></div>}
        {f.intervencion?.required&&<div style={{gridColumn:"1 / -1",background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.35)",borderRadius:10,padding:"10px 13px"}}><p style={{margin:0,fontSize:12,fontWeight:800,color:"#fbbf24",textTransform:"uppercase",letterSpacing:"0.05em"}}>⚠ Intervención · {(f.intervencion.types||[]).join(" · ")||"organismo"}</p>{f.intervencion.reason&&<p style={{margin:"3px 0 0",fontSize:12.5,color:"rgba(255,255,255,0.75)"}}>{f.intervencion.reason}</p>}</div>}
        {f.intervencion&&!f.intervencion.required&&!ad&&<p style={{gridColumn:"1 / -1",margin:0,fontSize:12.5,color:"#4ade80"}}>Sin intervención de organismos ni antidumping.</p>}
      </div>}
    </Sec>

    <Sec titulo="Proveedor" sub="Ficha reutilizable: si la fábrica ya está cargada, elegila. Tiene que quedar al menos una vía de contacto.">
      <div style={GRID}>
        <Campo label="Fábrica" ob span={2}><Sel value={f.proveedor_id} onChange={e=>set("proveedor_id",e.target.value)}><option value="">Elegir proveedor…</option>{provs.map(x=><option key={x.id} value={x.id}>{x.fabrica} · {x.ciudad}</option>)}</Sel></Campo>
        <div style={{display:"flex",gap:8,alignItems:"end"}}><Btn onClick={()=>setProvForm({fabrica:"",ciudad:"",contacto:"",wechat:"",whatsapp:"",chat_plataforma:"",notas:""})}>+ Nuevo proveedor</Btn>{prov&&<Btn onClick={()=>setProvForm({id:prov.id,fabrica:prov.fabrica||"",ciudad:prov.ciudad||"",contacto:prov.contacto||"",wechat:prov.wechat||"",whatsapp:prov.whatsapp||"",chat_plataforma:prov.chat_plataforma||"",notas:prov.notas||""})}>Editar</Btn>}</div>
        {prov&&!provForm&&<div style={{gridColumn:"1 / -1",fontSize:12.5,color:"rgba(255,255,255,0.65)",display:"flex",gap:14,flexWrap:"wrap"}}><span>📍 {prov.ciudad}</span><span>👤 {prov.contacto}</span>{prov.wechat&&<span>WeChat: <b style={{color:"#fff"}}>{prov.wechat}</b></span>}{prov.whatsapp&&<span>WhatsApp: <b style={{color:"#fff"}}>{prov.whatsapp}</b></span>}{prov.chat_plataforma&&<span>Chat: <b style={{color:"#fff"}}>{prov.chat_plataforma}</b></span>}{prov.notas&&<span style={{color:"rgba(255,255,255,0.45)"}}>{prov.notas}</span>}</div>}
        {provForm&&<div style={{gridColumn:"1 / -1",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(184,149,106,0.3)",borderRadius:12,padding:14}}>
          <p style={{margin:"0 0 12px",fontSize:13,fontWeight:800,color:GOLD_LIGHT}}>{provForm.id?"Editar proveedor":"Nuevo proveedor"}</p>
          <div style={GRID}>
            <Campo label="Nombre de la fábrica" ob><Inp value={provForm.fabrica} onChange={e=>setProvForm(x=>({...x,fabrica:e.target.value}))}/></Campo>
            <Campo label="Ciudad" ob><Inp value={provForm.ciudad} onChange={e=>setProvForm(x=>({...x,ciudad:e.target.value}))} placeholder="Foshan, Guangdong"/></Campo>
            <Campo label="Persona de contacto" ob><Inp value={provForm.contacto} onChange={e=>setProvForm(x=>({...x,contacto:e.target.value}))}/></Campo>
            <Campo label="WeChat ID"><Inp value={provForm.wechat} onChange={e=>setProvForm(x=>({...x,wechat:e.target.value}))}/></Campo>
            <Campo label="WhatsApp"><Inp value={provForm.whatsapp} onChange={e=>setProvForm(x=>({...x,whatsapp:e.target.value}))} placeholder="+86 …"/></Campo>
            <Campo label="Chat de plataforma" hint="Si solo se habla por Alibaba / 1688: qué plataforma y usuario."><Inp value={provForm.chat_plataforma} onChange={e=>setProvForm(x=>({...x,chat_plataforma:e.target.value}))} placeholder="Alibaba · Lily Chen"/></Campo>
            <Campo label="Notas" span={3}><Inp value={provForm.notas} onChange={e=>setProvForm(x=>({...x,notas:e.target.value}))} placeholder="Responde de noche · pide 30 % de anticipo · habla inglés"/></Campo>
          </div>
          <p style={{fontSize:11.5,color:"rgba(255,255,255,0.45)",margin:"10px 0 12px"}}>Al menos uno entre WeChat, WhatsApp o chat de plataforma.</p>
          <div style={{display:"flex",gap:8}}><Btn kind="gold" onClick={guardarProv}>{provForm.id?"Guardar cambios":"Crear proveedor"}</Btn><Btn onClick={()=>setProvForm(null)}>Cancelar</Btn></div>
        </div>}
        <Campo label="Link del producto" ob span={3} hint="La página exacta de esta máquina en Alibaba, 1688 o Made-in-China."><Inp value={f.link_producto} onChange={e=>set("link_producto",e.target.value)} placeholder="https://www.alibaba.com/product-detail/…"/></Campo>
        <Campo label="Notas internas" span={3} hint="No se muestran al cliente."><TA value={f.notas_internas} onChange={e=>set("notas_internas",e.target.value)} style={{minHeight:70}}/></Campo>
      </div>
    </Sec>

    <div style={{position:"sticky",bottom:0,background:"rgba(10,22,40,0.94)",backdropFilter:"blur(10px)",borderTop:"1px solid rgba(255,255,255,0.08)",margin:"0 -16px",padding:"12px 16px"}}>
      {faltan.length>0&&<p style={{margin:"0 0 10px",fontSize:12.5,color:"#fbbf24"}}><b>Para publicar falta:</b> {faltan.join(" · ")}</p>}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <Btn onClick={()=>guardar()} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn>
        {p.estado!=="publicado"&&<Btn kind="gold" onClick={()=>guardar("publicado")} disabled={guardando||faltan.length>0} title={faltan.length?"Completá lo que falta":""}>Publicar</Btn>}
        {p.estado==="publicado"&&<Btn onClick={()=>guardar("pausado")} disabled={guardando}>Pausar</Btn>}
        {p.estado==="pausado"&&<span style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>Pausado: no se ve en el catálogo. “Publicar” lo vuelve a mostrar.</span>}
      </div>
    </div>
  </div>;
}
