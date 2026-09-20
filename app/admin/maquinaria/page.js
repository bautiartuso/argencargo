"use client";
// Catálogo de maquinaria — carga de productos (20/09/2026).
// Acá el equipo (admin, empleados y socios GI) carga cada máquina con todo el detalle del
// proveedor. Publicar exige la ficha completa: la validación vive en la base (trigger
// cat_productos_validar) y acá se replica para mostrar qué falta antes de intentar.
// Estética aparte del admin: fondo claro, lima como acento, tipografía propia (Bautista quiere
// que esta pata del sistema se vea totalmente distinta a Argencargo).
import { useState, useEffect, useMemo, useRef } from "react";
import { comprimirImagen } from "../../../lib/img";
import { toast, ToastStack, confirmDialog, DialogHost } from "../../../lib/ui";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

// ── Tokens visuales ──────────────────────────────────────────────────────────────────────
const LIMA="#D3F462", LIMA_OSC="#C4EA45", LIMA_SUAVE="#EEFBC0";
const INK="#121212", GRIS="#6B6B6B", BORDE="#E6E6E3", FONDO="#FFFFFF", SUAVE="#F5F5F2";
const FONT="'Manrope',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif";
const MONO="'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
const CSS=`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
.mq *{box-sizing:border-box}.mq input,.mq select,.mq textarea,.mq button{font-family:${FONT}}
.mq input:focus,.mq select:focus,.mq textarea:focus{border-color:${INK}!important;box-shadow:0 0 0 3px ${LIMA_SUAVE};outline:none}
.mq ::placeholder{color:#A8A8A4}.mq .card:hover{border-color:#CFCFCA;box-shadow:0 6px 24px rgba(0,0,0,0.06)}
.mq .btn:hover{filter:brightness(0.97)}.mq .ghost:hover{background:${SUAVE}}
@media(max-width:640px){.mq .grid3{grid-template-columns:1fr!important}.mq .grid3>*{grid-column:auto!important}}`;

// ── Sesión: sirve la del admin (ac_admin) o la del panel GI (ac_gi_s) ─────────────────────
const leer=(k)=>{try{const d=localStorage.getItem(k);return d?JSON.parse(d):null;}catch{return null;}};
const cargarSesion=()=>{
  const a=leer("ac_admin");if(a?.token&&["admin","empleado"].includes(a?.profile?.role))return{token:a.token,refresh:a.refresh_token,user:a.user,rol:a.profile.role,origen:"ac_admin",profile:a.profile};
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
  return <div className="mq" style={{minHeight:"100vh",background:FONDO,fontFamily:FONT,color:INK}}>
    <style>{CSS}</style>
    {cargando?<Centro>Cargando…</Centro>:!ses?<Login onLogin={setSes}/>:<Catalogo ses={ses} setSes={setSes}/>}
  </div>;
}
const Centro=({children})=><div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:GRIS}}>{children}</div>;

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
  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1rem"}}>
    <form onSubmit={entrar} style={{width:"100%",maxWidth:380}}>
      <Logo/>
      <h1 style={{fontSize:26,fontWeight:800,letterSpacing:"-0.02em",margin:"22px 0 4px"}}>Catálogo de máquinas</h1>
      <p style={{color:GRIS,margin:"0 0 22px",fontSize:14}}>Entrá con tu usuario del admin o del panel GI.</p>
      <Inp type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/>
      <Inp type="password" placeholder="Contraseña" value={pw} onChange={e=>setPw(e.target.value)} autoComplete="current-password" style={{marginTop:10}}/>
      {err&&<p style={{color:"#D23B3B",fontSize:13,margin:"10px 0 0"}}>{err}</p>}
      <Btn kind="lima" type="submit" disabled={lo} style={{width:"100%",marginTop:16,padding:"13px"}}>{lo?"Entrando…":"Entrar"}</Btn>
    </form>
  </div>;
}
const Logo=()=><div style={{display:"inline-flex",alignItems:"center",gap:8}}><span style={{fontSize:22,fontWeight:800,letterSpacing:"-0.04em"}}>ARGENCARGO</span><span style={{fontFamily:MONO,fontSize:10,fontWeight:600,letterSpacing:"0.12em",padding:"4px 8px",borderRadius:6,background:LIMA,color:INK}}>MÁQUINAS</span></div>;

// ── Helpers de UI ─────────────────────────────────────────────────────────────────────────
const INP={width:"100%",padding:"11px 13px",borderRadius:11,border:`1px solid ${BORDE}`,background:"#fff",color:INK,fontSize:14,fontWeight:600,outline:"none",transition:"border-color 120ms, box-shadow 120ms"};
const LBL={display:"block",fontFamily:MONO,fontSize:11,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:GRIS,marginBottom:7};
function Campo({label,ob,hint,children,span}){return <div style={{gridColumn:span?`span ${span}`:undefined,minWidth:0}}><label style={LBL}>{label}{ob&&<span style={{color:INK,marginLeft:3}}>*</span>}</label>{children}{hint&&<p style={{fontSize:12,color:GRIS,margin:"6px 0 0",lineHeight:1.4}}>{hint}</p>}</div>;}
const Inp=({style,...p})=><input {...p} style={{...INP,...(style||{})}}/>;
const TA=({style,...p})=><textarea {...p} style={{...INP,minHeight:96,resize:"vertical",lineHeight:1.5,fontWeight:500,...(style||{})}}/>;
const Sel=({children,style,...p})=><select {...p} style={{...INP,appearance:"auto",...(style||{})}}>{children}</select>;
function Btn({children,onClick,kind="ghost",disabled,small,title,type="button",style}){
  const base={padding:small?"7px 13px":"11px 18px",borderRadius:999,fontSize:small?12.5:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,border:`1px solid ${BORDE}`,background:"#fff",color:INK,transition:"all 120ms",whiteSpace:"nowrap"};
  const k=kind==="lima"?{background:LIMA,borderColor:LIMA,color:INK}:kind==="negro"?{background:INK,borderColor:INK,color:"#fff"}:kind==="danger"?{color:"#C22F2F",borderColor:"#F0C9C9"}:{};
  return <button type={type} title={title} disabled={disabled} onClick={onClick} className={kind==="ghost"?"ghost":"btn"} style={{...base,...k,...(style||{})}}>{children}</button>;
}
function Sec({titulo,sub,children,onDrop,onDragOver}){return <section onDrop={onDrop} onDragOver={onDragOver} style={{background:"#fff",border:`1px solid ${BORDE}`,borderRadius:18,padding:"22px 22px 24px",marginBottom:14}}><h3 style={{margin:0,fontSize:17,fontWeight:800,letterSpacing:"-0.01em"}}>{titulo}</h3>{sub&&<p style={{margin:"4px 0 0",fontSize:13.5,color:GRIS,lineHeight:1.45}}>{sub}</p>}<div style={{height:16}}/>{children}</section>;}
const GRID={display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14};
const Pill=({on,children,onClick})=><button type="button" onClick={onClick} style={{padding:"8px 14px",borderRadius:999,border:`1px solid ${on?LIMA:BORDE}`,background:on?LIMA_SUAVE:"#fff",color:INK,fontSize:13,fontWeight:700,cursor:"pointer"}}>{children}</button>;
const n=(v)=>{const x=Number(String(v??"").replace(",","."));return Number.isFinite(x)?x:0;};
const numONull=(v)=>String(v??"").trim()===""?null:n(v);
const txtONull=(v)=>String(v??"").trim()===""?null:String(v).trim();
const fmtUsd=(v)=>`USD ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const codigo=(p)=>`MAQ-${String(p.numero||0).padStart(5,"0")}`;
const ESTADO={borrador:{l:"Borrador",c:GRIS,bg:SUAVE},publicado:{l:"Publicado",c:"#1F7A2E",bg:"#E3F6E6"},pausado:{l:"Pausado",c:"#8A5B00",bg:"#FFF1CC"}};
const Chip=({e})=>{const s=ESTADO[e]||ESTADO.borrador;return <span style={{fontFamily:MONO,fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:6,background:s.bg,color:s.c,letterSpacing:"0.08em",textTransform:"uppercase"}}>{s.l}</span>;};

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
  const [sel,setSel]=useState(null);
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
  const nuevo=async()=>{try{const r=await dq("cat_productos",{method:"POST",body:{estado:"borrador",created_by:ses.user?.id||null}});const p=Array.isArray(r)?r[0]:r;await cargar();setSel(p.id);}catch(e){toast(e.message,"error");}};
  const visibles=prods.filter(p=>(fEstado==="todos"||p.estado===fEstado)&&(!busq.trim()||`${codigo(p)} ${p.nombre||""} ${p.nombre_raw||""} ${p.modelo||""}`.toLowerCase().includes(busq.toLowerCase())));
  const cuenta=(e)=>prods.filter(p=>p.estado===e).length;

  return <>
    <ToastStack/><DialogHost/>
    <header style={{display:"flex",alignItems:"center",gap:16,padding:"16px 28px",borderBottom:`1px solid ${BORDE}`,position:"sticky",top:0,background:"rgba(255,255,255,0.9)",backdropFilter:"blur(12px)",zIndex:5}}>
      <Logo/>
      <span style={{flex:1}}/>
      {sel&&<Btn small onClick={()=>setSel(null)}>← Listado</Btn>}
      <span style={{fontSize:13,color:GRIS,display:"none"}}/>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{width:34,height:34,borderRadius:"50%",background:LIMA_SUAVE,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800}}>{(ses.user?.email||"?").slice(0,2).toUpperCase()}</span>
        <Btn small onClick={salir}>Salir</Btn>
      </div>
    </header>
    <main style={{maxWidth:1120,margin:"0 auto",padding:"28px 28px 90px"}}>
      {sel
        ?<Editor key={sel} id={sel} dq={dq} token={token} arbol={arbol} provs={provs} antid={antid} recargar={cargar} onCerrar={()=>setSel(null)} onProvNuevo={(p)=>setProvs(x=>[...x,p].sort((a,b)=>a.fabrica.localeCompare(b.fabrica)))}/>
        :<>
          <p style={{fontFamily:MONO,fontSize:11,letterSpacing:"0.12em",color:GRIS,margin:0}}>CATÁLOGO</p>
          <div style={{display:"flex",alignItems:"end",justifyContent:"space-between",gap:16,flexWrap:"wrap",margin:"4px 0 22px"}}>
            <div><h1 style={{fontSize:34,fontWeight:800,letterSpacing:"-0.03em",margin:0}}>Máquinas</h1><p style={{margin:"4px 0 0",color:GRIS,fontSize:14.5}}>Cargá cada máquina con todo el detalle del proveedor. Se publica cuando la ficha está completa.</p></div>
            <Btn kind="lima" onClick={nuevo}>+ Nueva máquina</Btn>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8,marginBottom:18}}>
            {[["todos","Todas",prods.length],["publicado","Publicadas",cuenta("publicado")],["borrador","Borradores",cuenta("borrador")],["pausado","Pausadas",cuenta("pausado")]].map(([k,l,c])=><Pill key={k} on={fEstado===k} onClick={()=>setFEstado(k)}>{l} <span style={{color:GRIS,fontFamily:MONO,fontSize:11}}>{c}</span></Pill>)}
            <input placeholder="Buscar por nombre, modelo o código…" value={busq} onChange={e=>setBusq(e.target.value)} style={{...INP,flex:1,minWidth:220,borderRadius:999,padding:"10px 18px"}}/>
          </div>
          {!listo?<p style={{color:GRIS}}>Cargando…</p>
          :visibles.length===0?<div style={{textAlign:"center",padding:"70px 20px",border:`1px dashed ${BORDE}`,borderRadius:18}}><p style={{fontSize:16,fontWeight:800,margin:"0 0 6px"}}>{prods.length===0?"Todavía no hay máquinas cargadas":"Nada que coincida"}</p><p style={{margin:0,fontSize:14,color:GRIS}}>{prods.length===0?"Arrancá con “Nueva máquina”: se crea como borrador y la completás de a poco.":"Probá con otro filtro o búsqueda."}</p></div>
          :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}}>
            {visibles.map(p=>{const foto=Array.isArray(p.fotos)&&p.fotos[0];return <button key={p.id} className="card" onClick={()=>setSel(p.id)} style={{textAlign:"left",background:"#fff",border:`1px solid ${BORDE}`,borderRadius:18,padding:0,overflow:"hidden",cursor:"pointer",color:INK,transition:"all 150ms"}}>
              <div style={{aspectRatio:"4/3",background:SUAVE,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>{foto?<img src={foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:12.5,color:"#A8A8A4"}}>Sin fotos</span>}</div>
              <div style={{padding:"13px 15px 15px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:7}}><span style={{fontFamily:MONO,fontSize:11,fontWeight:600,color:GRIS,letterSpacing:"0.06em"}}>{codigo(p)}</span><Chip e={p.estado}/></div>
                <p style={{margin:"0 0 5px",fontSize:14.5,fontWeight:800,lineHeight:1.3,letterSpacing:"-0.01em",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{p.nombre||p.nombre_raw||<span style={{color:GRIS,fontWeight:600}}>Sin nombre todavía</span>}</p>
                <p style={{margin:0,fontSize:12.5,color:GRIS}}>{p.categoria?`${nombreCat(p.categoria)} · ${nombreCat(p.subcategoria)}`:"Sin categoría"}{p.exw_usd?` · EXW ${fmtUsd(p.exw_usd)}`:""}</p>
              </div>
            </button>;})}
          </div>}
        </>}
    </main>
  </>;
}

// ── Editor de un producto ─────────────────────────────────────────────────────────────────
const BULTO=()=>({cantidad:"1",largo_cm:"",ancho_cm:"",alto_cm:"",peso_kg:""});
const VACIO={nombre_raw:"",modelo:"",specs_raw:"",descripcion_raw:"",nombre:"",descripcion:"",categoria:"",subcategoria:"",condicion:"nueva",anio:"",horas_uso:"",garantia_meses:"",fotos:[],video_url:"",exw_usd:"",moq:"1",dias_produccion:"",packing:[BULTO()],ncm_code:"",ncm_descripcion:"",die:"",te:"",iva:"",intervencion:null,proveedor_id:"",link_producto:"",notas_internas:""};

function Editor({id,dq,token,arbol,provs,antid,recargar,onCerrar,onProvNuevo}){
  const [p,setP]=useState(null);
  const [f,setF]=useState(VACIO);
  const [dirty,setDirty]=useState(false);
  const [guardando,setGuardando]=useState(false);
  const [ia,setIa]=useState(false);
  const [ncmIa,setNcmIa]=useState(false);
  const [subiendo,setSubiendo]=useState(0);
  const [arrastrando,setArrastrando]=useState(false);
  const [provForm,setProvForm]=useState(null);
  const fileRef=useRef(null);const videoRef=useRef(null);
  const fRef=useRef(f);fRef.current=f;

  useEffect(()=>{(async()=>{try{
    const r=await dq("cat_productos",{filters:`?id=eq.${id}&select=*`});const row=Array.isArray(r)?r[0]:null;if(!row){toast("No se encontró el producto","error");onCerrar();return;}
    setP(row);
    const s=(v)=>v==null?"":String(v);
    const pk=Array.isArray(row.packing)&&row.packing.length?row.packing.map(b=>({cantidad:s(b.cantidad||1),largo_cm:s(b.largo_cm),ancho_cm:s(b.ancho_cm),alto_cm:s(b.alto_cm),peso_kg:s(b.peso_kg)})):[BULTO()];
    setF({...VACIO,nombre_raw:s(row.nombre_raw),modelo:s(row.modelo),specs_raw:s(row.specs_raw),descripcion_raw:s(row.descripcion_raw),nombre:s(row.nombre),descripcion:s(row.descripcion),categoria:s(row.categoria),subcategoria:s(row.subcategoria),condicion:row.condicion||"nueva",anio:s(row.anio),horas_uso:s(row.horas_uso),garantia_meses:s(row.garantia_meses),fotos:Array.isArray(row.fotos)?row.fotos:[],video_url:s(row.video_url),exw_usd:s(row.exw_usd),moq:row.moq?String(row.moq):"1",dias_produccion:s(row.dias_produccion),packing:pk,ncm_code:s(row.ncm_code),ncm_descripcion:s(row.ncm_descripcion),die:s(row.die),te:s(row.te),iva:s(row.iva),intervencion:row.intervencion||null,proveedor_id:s(row.proveedor_id),link_producto:s(row.link_producto),notas_internas:s(row.notas_internas)});
  }catch(e){toast(e.message,"error");}})();},[id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set=(k,v)=>{setF(x=>({...x,[k]:v}));setDirty(true);};
  const subs=useMemo(()=>arbol.find(c=>c.slug===f.categoria)?.subs||[],[arbol,f.categoria]);
  const prov=provs.find(x=>x.id===f.proveedor_id);
  const ad=useMemo(()=>{const c=String(f.ncm_code||"").replace(/\./g,"");if(!c)return null;return antid.find(a=>c.startsWith(String(a.ncm_prefix||"").replace(/\./g,"")))||null;},[antid,f.ncm_code]);

  // Lo mismo que exige el trigger, para mostrarlo antes de intentar publicar.
  const faltan=useMemo(()=>{const out=[];
    if(!f.modelo.trim())out.push("modelo / código");
    if(f.nombre.trim().length<12)out.push("nombre completo");else if(f.modelo.trim()&&!f.nombre.toLowerCase().includes(f.modelo.trim().toLowerCase()))out.push(`el nombre tiene que incluir el código ${f.modelo.trim()}`);
    if(!f.descripcion.trim())out.push("descripción");
    if(!f.categoria||!f.subcategoria)out.push("categoría y subcategoría");
    if(f.condicion==="usada"&&!f.anio.trim())out.push("año (máquina usada)");
    if(f.fotos.length<5)out.push(`mínimo 5 fotos (hay ${f.fotos.length})`);
    if(n(f.exw_usd)<=0)out.push("valor EXW");
    if(n(f.dias_produccion)<=0)out.push("días de producción");
    if(f.packing.some(b=>n(b.cantidad)<=0||n(b.largo_cm)<=0||n(b.ancho_cm)<=0||n(b.alto_cm)<=0||n(b.peso_kg)<=0))out.push("packing (cantidad, medidas y peso de cada bulto)");
    if(!f.ncm_code.trim())out.push("posición NCM");
    if(!f.proveedor_id)out.push("proveedor");
    if(!f.link_producto.trim())out.push("link del producto");
    return out;},[f]);

  const cuerpo=(estado)=>({
    estado:estado||p.estado,
    nombre_raw:txtONull(f.nombre_raw),modelo:txtONull(f.modelo),specs_raw:txtONull(f.specs_raw),descripcion_raw:txtONull(f.descripcion_raw),
    nombre:txtONull(f.nombre),descripcion:txtONull(f.descripcion),categoria:txtONull(f.categoria),subcategoria:txtONull(f.subcategoria),
    condicion:f.condicion,anio:numONull(f.anio),horas_uso:numONull(f.horas_uso),garantia_meses:numONull(f.garantia_meses),fotos:f.fotos,video_url:txtONull(f.video_url),
    exw_usd:numONull(f.exw_usd),moq:numONull(f.moq)||1,dias_produccion:numONull(f.dias_produccion),
    packing:f.packing.map(b=>({cantidad:n(b.cantidad),largo_cm:n(b.largo_cm),ancho_cm:n(b.ancho_cm),alto_cm:n(b.alto_cm),peso_kg:n(b.peso_kg)})),
    ncm_code:txtONull(f.ncm_code),ncm_descripcion:txtONull(f.ncm_descripcion),die:numONull(f.die),te:numONull(f.te),iva:numONull(f.iva),intervencion:f.intervencion||null,antidumping:ad?{prefix:ad.ncm_prefix,producto:ad.producto,medida_tipo:ad.medida_tipo,valor:ad.valor,unidad:ad.unidad,resolucion:ad.resolucion}:null,
    proveedor_id:f.proveedor_id||null,link_producto:txtONull(f.link_producto),notas_internas:txtONull(f.notas_internas),
  });
  const guardar=async(estado)=>{setGuardando(true);try{
    const r=await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:cuerpo(estado)});
    const row=Array.isArray(r)?r[0]:null;if(row)setP(row);setDirty(false);await recargar();
    toast(estado==="publicado"?"Publicada en el catálogo":estado==="pausado"?"Pausada":"Guardado");
  }catch(e){toast(e.message.replace(/^.*?No se puede publicar/,"No se puede publicar"),"error",{duration:7000});}setGuardando(false);};
  const eliminar=async()=>{if(!(await confirmDialog(`¿Eliminar ${codigo(p)}? Se borra la ficha y sus fotos. No se puede deshacer.`)))return;try{
    for(const u of [...f.fotos,f.video_url].filter(Boolean)){const path=u.split("/object/public/catalogo/")[1];if(path)fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"DELETE",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`}}).catch(()=>{});}
    await dq("cat_productos",{method:"DELETE",filters:`?id=eq.${id}`,prefer:"return=minimal"});await recargar();toast("Eliminada");onCerrar();
  }catch(e){toast(e.message,"error");}};

  // ── IA: nombre, categoría, descripción ──
  const completarIA=async()=>{if(!f.nombre_raw.trim()&&!f.specs_raw.trim()&&!f.descripcion_raw.trim()){toast("Pegá primero lo que te pasó el proveedor","error");return;}setIa(true);try{
    const r=await fetch("/api/catalogo/ia",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({nombre_raw:f.nombre_raw,modelo:f.modelo,specs_raw:f.specs_raw,descripcion_raw:f.descripcion_raw,condicion:f.condicion,categorias:arbol.map(c=>({slug:c.slug,nombre:c.nombre,subs:c.subs.map(s=>({slug:s.slug,nombre:s.nombre}))}))})});
    const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||"Falló la IA");
    setF(x=>({...x,nombre:d.nombre||x.nombre,descripcion:d.descripcion||x.descripcion,categoria:d.categoria||x.categoria,subcategoria:d.subcategoria||x.subcategoria}));setDirty(true);
    toast("Ficha redactada · revisá nombre y descripción");
  }catch(e){toast(e.message,"error");}setIa(false);};

  // ── NCM: clasificar trae código + alícuotas + intervención; tipear el código busca en la base ──
  const aplicarNcm=(d)=>{setF(x=>({...x,ncm_code:d.ncm_code||x.ncm_code,ncm_descripcion:d.ncm_description||d.description||x.ncm_descripcion,die:d.import_duty_rate!=null?String(d.import_duty_rate):d.die!=null?String(d.die):x.die,te:d.statistics_rate!=null?String(d.statistics_rate):d.te!=null?String(Math.min(Number(d.te),3)):x.te,iva:d.iva_rate!=null?String(d.iva_rate):d.iva!=null?String(d.iva):x.iva,intervencion:d.intervention!==undefined?d.intervention:x.intervencion}));setDirty(true);};
  const clasificar=async()=>{const desc=[f.nombre||f.nombre_raw,f.specs_raw].filter(Boolean).join(". ").slice(0,1500);if(!desc.trim()){toast("Primero cargá el nombre o las specs","error");return;}setNcmIa(true);try{
    const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:desc})});const d=await r.json();if(!d?.ncm_code)throw new Error(d?.error||"No se pudo clasificar");aplicarNcm(d);toast(`NCM ${d.ncm_code}`);
  }catch(e){toast(e.message,"error");}setNcmIa(false);};
  const buscarCodigo=async(c)=>{if(!/^\d{4}\.\d{2}\.\d{2}$/.test(c))return;try{
    const r=await dq("ncm_database",{filters:`?ncm_code=eq.${c}&select=ncm_code,description,die,te,iva&limit=1`});const d=Array.isArray(r)?r[0]:null;if(!d){toast("Esa posición no está en la base","error");return;}aplicarNcm({...d,intervention:fRef.current.intervencion});
  }catch(e){toast(e.message,"error");}};

  // ── Fotos y video: botón, arrastrar y soltar, o pegar (Ctrl/Cmd+V) ──
  const subir=async(files)=>{const lista=Array.from(files||[]).filter(x=>x.type?.startsWith("image/")||x.type?.startsWith("video/"));if(!lista.length)return;setSubiendo(lista.length);const fotosNuevas=[];let video=null;
    for(let i=0;i<lista.length;i++){let file=lista[i];const esVideo=file.type.startsWith("video/");try{
      if(!esVideo)file=await comprimirImagen(file,{maxLado:2000,calidad:0.86});
      const ext=esVideo?(file.name.split(".").pop()||"mp4").toLowerCase():"jpg";
      const path=`productos/${id}/${Date.now()}-${i}.${ext}`;
      const r=await fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"POST",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},body:file});
      if(!r.ok)throw new Error(`No se pudo subir (${r.status})`);
      const url=`${SB_URL}/storage/v1/object/public/catalogo/${path}`;if(esVideo)video=url;else fotosNuevas.push(url);
    }catch(e){toast(e.message,"error");}setSubiendo(lista.length-i-1);}
    const cambios={};
    if(fotosNuevas.length)cambios.fotos=[...fRef.current.fotos,...fotosNuevas];
    if(video)cambios.video_url=video;
    if(!Object.keys(cambios).length)return;
    setF(x=>({...x,...cambios}));
    await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:cambios}).catch(e=>toast(e.message,"error"));
    toast(fotosNuevas.length&&video?`${fotosNuevas.length} foto${fotosNuevas.length>1?"s":""} y el video subidos`:video?"Video subido":`${fotosNuevas.length} foto${fotosNuevas.length>1?"s":""} subida${fotosNuevas.length>1?"s":""}`);
  };
  useEffect(()=>{const onPaste=(e)=>{const files=Array.from(e.clipboardData?.files||[]);if(files.length){e.preventDefault();subir(files);}};window.addEventListener("paste",onPaste);return()=>window.removeEventListener("paste",onPaste);},[id,token]); // eslint-disable-line react-hooks/exhaustive-deps
  const onDrop=(e)=>{e.preventDefault();setArrastrando(false);subir(e.dataTransfer?.files);};
  const onDragOver=(e)=>{e.preventDefault();if(!arrastrando)setArrastrando(true);};
  const borrarArchivo=(u)=>{const path=u.split("/object/public/catalogo/")[1];if(path)fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"DELETE",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`}}).catch(()=>{});};
  const quitarFoto=async(u)=>{const fotos=f.fotos.filter(x=>x!==u);setF(x=>({...x,fotos}));borrarArchivo(u);await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{fotos}}).catch(e=>toast(e.message,"error"));};
  const principal=async(u)=>{const fotos=[u,...f.fotos.filter(x=>x!==u)];setF(x=>({...x,fotos}));await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{fotos}}).catch(e=>toast(e.message,"error"));};
  const quitarVideo=async()=>{const u=f.video_url;setF(x=>({...x,video_url:""}));if(u)borrarArchivo(u);await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{video_url:null}}).catch(e=>toast(e.message,"error"));};

  // ── Proveedor nuevo / edición ──
  const guardarProv=async()=>{const q=provForm;if(!q.fabrica.trim()||!q.ciudad.trim()||!q.contacto.trim()){toast("Fábrica, ciudad y contacto son obligatorios","error");return;}if(!q.wechat.trim()&&!q.whatsapp.trim()&&!q.chat_plataforma.trim()){toast("Cargá al menos una vía de contacto: WeChat, WhatsApp o el chat de la plataforma","error");return;}try{
    const body={fabrica:q.fabrica.trim(),ciudad:q.ciudad.trim(),contacto:q.contacto.trim(),wechat:txtONull(q.wechat),whatsapp:txtONull(q.whatsapp),chat_plataforma:txtONull(q.chat_plataforma),notas:txtONull(q.notas)};
    if(q.id){await dq("cat_proveedores",{method:"PATCH",filters:`?id=eq.${q.id}`,body});await recargar();toast("Proveedor actualizado");}
    else{const r=await dq("cat_proveedores",{method:"POST",body:{...body,created_by:p.created_by||null}});const row=Array.isArray(r)?r[0]:r;onProvNuevo(row);set("proveedor_id",row.id);toast("Proveedor creado");}
    setProvForm(null);
  }catch(e){toast(e.message,"error");}};

  if(!p)return <p style={{color:GRIS}}>Cargando…</p>;
  const totKg=f.packing.reduce((s,b)=>s+n(b.peso_kg)*(n(b.cantidad)||1),0);
  const totM3=f.packing.reduce((s,b)=>s+(n(b.largo_cm)*n(b.ancho_cm)*n(b.alto_cm)/1e6)*(n(b.cantidad)||1),0);
  const verificado=p.precio_verificado_at?Math.floor((Date.now()-new Date(p.precio_verificado_at))/864e5):null;
  const pv=(x)=>x==null?null:String(x).replace(".",",");

  return <div>
    <p style={{fontFamily:MONO,fontSize:11,letterSpacing:"0.12em",color:GRIS,margin:0}}>{codigo(p)}</p>
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"4px 0 22px"}}>
      <h1 style={{fontSize:28,fontWeight:800,letterSpacing:"-0.03em",margin:0,flex:"1 1 300px",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nombre||f.nombre_raw||"Máquina nueva"}</h1>
      <Chip e={p.estado}/>
      {dirty&&<span style={{fontSize:12.5,color:"#8A5B00",fontWeight:700}}>● Sin guardar</span>}
      <Btn kind="danger" small onClick={eliminar}>Eliminar</Btn>
    </div>

    <Sec titulo="La máquina" sub="Pegá lo que te pasó el proveedor tal cual. Con eso la IA arma el nombre, la categoría y la descripción; después corregís lo que haga falta. Todas se entregan en 220 V.">
      <div className="grid3" style={GRID}>
        <Campo label="Nombre crudo del proveedor" ob span={2}><Inp value={f.nombre_raw} onChange={e=>set("nombre_raw",e.target.value)} placeholder="Sliding table saw MJ6132TD 3200mm with scoring blade"/></Campo>
        <Campo label="Modelo / código" ob hint="Tal como lo escribe la fábrica. Tiene que aparecer en el nombre."><Inp value={f.modelo} onChange={e=>set("modelo",e.target.value)} placeholder="MJ6132TD"/></Campo>
        <Campo label="Especificaciones copiadas" span={3}><TA value={f.specs_raw} onChange={e=>set("specs_raw",e.target.value)} placeholder="La tabla de especificaciones de Alibaba / 1688 o lo que te mandó por chat: potencia, medidas, capacidad, qué incluye…" style={{minHeight:120}}/></Campo>
        <Campo label="Tu texto sobre la máquina" ob span={3} hint="Para quién es, qué hace bien, qué te contó el proveedor, qué viene incluido. La IA redacta la descripción a partir de esto."><TA value={f.descripcion_raw} onChange={e=>set("descripcion_raw",e.target.value)} placeholder="Escuadradora para carpinterías medianas, corta melamina sin astillar gracias al incisor, viene con dos hojas y manual…"/></Campo>
      </div>
      <div style={{marginTop:16,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
        <Btn kind="negro" onClick={completarIA} disabled={ia}>{ia?"Redactando…":"✦ Completar con IA"}</Btn>
        <span style={{fontSize:13,color:GRIS}}>Genera nombre, categoría y descripción. Podés pisarlos.</span>
      </div>
      <div className="grid3" style={{...GRID,marginTop:22}}>
        <Campo label="Nombre comercial" ob span={3} hint="Tipo de máquina + lo que la define + código. Nunca solo “Escuadradora”."><Inp value={f.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Escuadradora de 3.200 mm con incisor · MJ6132TD" style={{fontSize:16,fontWeight:800}}/></Campo>
        <Campo label="Descripción" ob span={3} hint="Incluye capacidad o producción y qué viene con la máquina."><TA value={f.descripcion} onChange={e=>set("descripcion",e.target.value)} style={{minHeight:180}}/></Campo>
        <Campo label="Categoría" ob><Sel value={f.categoria} onChange={e=>{set("categoria",e.target.value);set("subcategoria","");}}><option value="">Elegir…</option>{arbol.map(c=><option key={c.slug} value={c.slug}>{c.nombre}</option>)}</Sel></Campo>
        <Campo label="Subcategoría" ob><Sel value={f.subcategoria} onChange={e=>set("subcategoria",e.target.value)} disabled={!f.categoria}><option value="">Elegir…</option>{subs.map(s=><option key={s.slug} value={s.slug}>{s.nombre}</option>)}</Sel></Campo>
        <Campo label="Garantía de fábrica (meses)"><Inp type="number" value={f.garantia_meses} onChange={e=>set("garantia_meses",e.target.value)} placeholder="12"/></Campo>
        <Campo label="Condición" ob><div style={{display:"flex",gap:8}}><Pill on={f.condicion==="nueva"} onClick={()=>set("condicion","nueva")}>Nueva</Pill><Pill on={f.condicion==="usada"} onClick={()=>set("condicion","usada")}>Usada</Pill></div></Campo>
        {f.condicion==="usada"&&<><Campo label="Año" ob><Inp type="number" value={f.anio} onChange={e=>set("anio",e.target.value)} placeholder="2019"/></Campo><Campo label="Horas de uso"><Inp type="number" value={f.horas_uso} onChange={e=>set("horas_uso",e.target.value)}/></Campo></>}
      </div>
    </Sec>

    <Sec titulo="Fotos y video" sub="Mínimo 5 fotos para publicar. Podés elegirlas, arrastrarlas acá o pegarlas con Ctrl+V. El video se sube como archivo." onDrop={onDrop} onDragOver={onDragOver}>
      <div style={{border:`2px dashed ${arrastrando?INK:BORDE}`,borderRadius:16,padding:14,background:arrastrando?LIMA_SUAVE:SUAVE,transition:"all 120ms"}} onDragLeave={()=>setArrastrando(false)}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
          {f.fotos.map((u,i)=><div key={u} style={{position:"relative",aspectRatio:"1",borderRadius:12,overflow:"hidden",border:`2px solid ${i===0?LIMA:"transparent"}`,background:"#fff"}}>
            <img src={u} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            {i===0&&<span style={{position:"absolute",top:7,left:7,fontFamily:MONO,fontSize:9,fontWeight:600,letterSpacing:"0.08em",padding:"3px 7px",borderRadius:5,background:LIMA,color:INK}}>PRINCIPAL</span>}
            <div style={{position:"absolute",bottom:0,left:0,right:0,display:"flex",gap:4,padding:6,background:"linear-gradient(transparent,rgba(0,0,0,0.55))"}}>
              {i>0&&<button type="button" onClick={()=>principal(u)} title="Hacer principal" style={{flex:1,fontSize:11,fontWeight:700,padding:"5px 0",borderRadius:6,border:"none",background:"rgba(255,255,255,0.9)",color:INK,cursor:"pointer"}}>★</button>}
              <button type="button" onClick={()=>quitarFoto(u)} title="Quitar" style={{flex:1,fontSize:11,fontWeight:700,padding:"5px 0",borderRadius:6,border:"none",background:"rgba(255,255,255,0.9)",color:"#C22F2F",cursor:"pointer"}}>✕</button>
            </div>
          </div>)}
          <button type="button" onClick={()=>fileRef.current?.click()} disabled={subiendo>0} style={{aspectRatio:"1",borderRadius:12,border:`1px solid ${BORDE}`,background:"#fff",color:INK,cursor:"pointer",fontSize:13,fontWeight:700}}>{subiendo>0?`Subiendo ${subiendo}…`:"+ Fotos"}</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e=>{subir(e.target.files);e.target.value="";}}/>
        </div>
      </div>
      <p style={{fontSize:13,fontWeight:700,color:f.fotos.length>=5?"#1F7A2E":GRIS,margin:"10px 0 18px"}}>{f.fotos.length} de 5 fotos mínimas{f.fotos.length>=5?" ✓":""}</p>
      <label style={LBL}>Video</label>
      {f.video_url?<div style={{display:"flex",gap:14,alignItems:"start",flexWrap:"wrap"}}><video src={f.video_url} controls style={{width:280,maxWidth:"100%",borderRadius:12,background:"#000"}}/><Btn small kind="danger" onClick={quitarVideo}>Quitar video</Btn></div>
      :<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><Btn onClick={()=>videoRef.current?.click()} disabled={subiendo>0}>Subir video</Btn><span style={{fontSize:13,color:GRIS}}>Opcional. También podés arrastrarlo o pegarlo.</span></div>}
      <input ref={videoRef} type="file" accept="video/*" hidden onChange={e=>{subir(e.target.files);e.target.value="";}}/>
    </Sec>

    <Sec titulo="Precio y plazo" sub="Condición de venta siempre EXW. El flete interno en China se suma después, en la cotización.">
      <div className="grid3" style={GRID}>
        <Campo label="Valor EXW unitario (USD)" ob hint={verificado!=null?`Verificado hace ${verificado} día${verificado===1?"":"s"}`:"Se marca como verificado al guardar"}><Inp type="number" step="0.01" value={f.exw_usd} onChange={e=>set("exw_usd",e.target.value)} placeholder="8500"/></Campo>
        <Campo label="Días de producción" ob hint="Desde que la fábrica recibe el pago hasta que la máquina está lista."><Inp type="number" value={f.dias_produccion} onChange={e=>set("dias_produccion",e.target.value)} placeholder="25"/></Campo>
        <Campo label="Cantidad mínima (MOQ)"><Inp type="number" value={f.moq} onChange={e=>set("moq",e.target.value)}/></Campo>
      </div>
    </Sec>

    <Sec titulo="Packing" sub="Medidas y peso embalado (huacal o caja), no de la máquina desnuda. Si viaja en varios bultos, agregá uno por cada uno.">
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 6px"}}>
        <thead><tr>{["Bulto","Cantidad","Largo cm","Ancho cm","Alto cm","Peso bruto kg",""].map(h=><th key={h} style={{...LBL,textAlign:"left",padding:"0 6px 2px",marginBottom:0}}>{h}</th>)}</tr></thead>
        <tbody>{f.packing.map((b,i)=>{const up=(k,v)=>set("packing",f.packing.map((x,j)=>j===i?{...x,[k]:v}:x));return <tr key={i}>
          <td style={{padding:"0 6px",fontFamily:MONO,fontSize:12,color:GRIS,whiteSpace:"nowrap"}}>#{i+1}</td>
          {["cantidad","largo_cm","ancho_cm","alto_cm","peso_kg"].map(k=><td key={k} style={{padding:"0 4px",minWidth:96}}><Inp type="number" step="0.01" value={b[k]} onChange={e=>up(k,e.target.value)}/></td>)}
          <td style={{padding:"0 4px"}}>{f.packing.length>1&&<Btn small kind="danger" onClick={()=>set("packing",f.packing.filter((_,j)=>j!==i))}>✕</Btn>}</td>
        </tr>;})}</tbody>
      </table></div>
      <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",marginTop:8}}>
        <Btn small onClick={()=>set("packing",[...f.packing,BULTO()])}>+ Agregar bulto</Btn>
        <span style={{fontSize:13,color:GRIS}}>Total: <b style={{color:INK}}>{totM3.toFixed(3).replace(".",",")} m³</b> · <b style={{color:INK}}>{totKg.toLocaleString("es-AR")} kg</b> brutos</span>
      </div>
    </Sec>

    <Sec titulo="Posición arancelaria (NCM)" sub="Clasificar trae el código, las alícuotas, el antidumping y las intervenciones. Si ya sabés el código, escribilo y se completa solo.">
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"end"}}>
        <div style={{width:180}}><Campo label="NCM" ob><Inp value={f.ncm_code} onChange={e=>set("ncm_code",e.target.value)} onBlur={e=>buscarCodigo(e.target.value.trim())} placeholder="8465.91.10" style={{fontFamily:MONO}}/></Campo></div>
        <Btn kind="negro" onClick={clasificar} disabled={ncmIa}>{ncmIa?"Clasificando…":"✦ Clasificar con IA"}</Btn>
      </div>
      {f.ncm_code&&<div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        {[["Derechos (DIE)",f.die],["Tasa estadística",f.te],["IVA",f.iva]].map(([l,v])=><div key={l} style={{background:SUAVE,borderRadius:14,padding:"12px 14px"}}><p style={{...LBL,marginBottom:4}}>{l}</p><p style={{margin:0,fontSize:22,fontWeight:800,letterSpacing:"-0.02em"}}>{v!==""&&v!=null?`${pv(v)} %`:"—"}</p></div>)}
        {f.ncm_descripcion&&<p style={{gridColumn:"1 / -1",margin:0,fontSize:13,color:GRIS}}>{f.ncm_descripcion}</p>}
        {ad&&<div style={{gridColumn:"1 / -1",background:"#FDECEC",border:"1px solid #F3C2C2",borderRadius:14,padding:"12px 14px"}}><p style={{margin:0,fontFamily:MONO,fontSize:11,fontWeight:600,color:"#B42323",letterSpacing:"0.08em"}}>⚠ ANTIDUMPING · {String(ad.producto||"").toUpperCase()}</p><p style={{margin:"4px 0 0",fontSize:13.5}}>{ad.medida_tipo==="valor_minimo"?`Valor mínimo de exportación ${fmtUsd(ad.valor)}${ad.unidad?` por ${ad.unidad}`:""}`:ad.valor!=null?`${ad.medida_tipo||"Derecho"}: ${pv(ad.valor)}${ad.unidad?` ${ad.unidad}`:" %"}`:ad.medida_tipo||""}{ad.resolucion?` · ${ad.resolucion}`:""}{ad.vigencia_hasta?` · vigente hasta ${new Date(ad.vigencia_hasta).toLocaleDateString("es-AR")}`:""}{ad.nota?` · ${ad.nota}`:""}</p></div>}
        {f.intervencion?.required&&<div style={{gridColumn:"1 / -1",background:"#FFF6DB",border:"1px solid #F2DFA0",borderRadius:14,padding:"12px 14px"}}><p style={{margin:0,fontFamily:MONO,fontSize:11,fontWeight:600,color:"#8A5B00",letterSpacing:"0.08em"}}>⚠ INTERVENCIÓN · {(f.intervencion.types||[]).join(" · ")||"ORGANISMO"}</p>{f.intervencion.reason&&<p style={{margin:"4px 0 0",fontSize:13.5}}>{f.intervencion.reason}</p>}</div>}
        {f.intervencion&&!f.intervencion.required&&!ad&&<p style={{gridColumn:"1 / -1",margin:0,fontSize:13,fontWeight:700,color:"#1F7A2E"}}>Sin intervención de organismos ni antidumping.</p>}
      </div>}
    </Sec>

    <Sec titulo="Proveedor" sub="Ficha reutilizable: si la fábrica ya está cargada, elegila. Tiene que quedar al menos una vía de contacto.">
      <div className="grid3" style={GRID}>
        <Campo label="Fábrica" ob span={2}><Sel value={f.proveedor_id} onChange={e=>set("proveedor_id",e.target.value)}><option value="">Elegir proveedor…</option>{provs.map(x=><option key={x.id} value={x.id}>{x.fabrica} · {x.ciudad}</option>)}</Sel></Campo>
        <div style={{display:"flex",gap:8,alignItems:"end"}}><Btn onClick={()=>setProvForm({fabrica:"",ciudad:"",contacto:"",wechat:"",whatsapp:"",chat_plataforma:"",notas:""})}>+ Nuevo proveedor</Btn>{prov&&<Btn onClick={()=>setProvForm({id:prov.id,fabrica:prov.fabrica||"",ciudad:prov.ciudad||"",contacto:prov.contacto||"",wechat:prov.wechat||"",whatsapp:prov.whatsapp||"",chat_plataforma:prov.chat_plataforma||"",notas:prov.notas||""})}>Editar</Btn>}</div>
        {prov&&!provForm&&<div style={{gridColumn:"1 / -1",fontSize:13.5,display:"flex",gap:16,flexWrap:"wrap",background:SUAVE,borderRadius:14,padding:"12px 14px"}}><span>📍 {prov.ciudad}</span><span>👤 {prov.contacto}</span>{prov.wechat&&<span>WeChat <b>{prov.wechat}</b></span>}{prov.whatsapp&&<span>WhatsApp <b>{prov.whatsapp}</b></span>}{prov.chat_plataforma&&<span>Chat <b>{prov.chat_plataforma}</b></span>}{prov.notas&&<span style={{color:GRIS}}>{prov.notas}</span>}</div>}
        {provForm&&<div style={{gridColumn:"1 / -1",background:SUAVE,borderRadius:16,padding:18}}>
          <p style={{margin:"0 0 14px",fontSize:15,fontWeight:800}}>{provForm.id?"Editar proveedor":"Nuevo proveedor"}</p>
          <div className="grid3" style={GRID}>
            <Campo label="Nombre de la fábrica" ob><Inp value={provForm.fabrica} onChange={e=>setProvForm(x=>({...x,fabrica:e.target.value}))}/></Campo>
            <Campo label="Ciudad" ob><Inp value={provForm.ciudad} onChange={e=>setProvForm(x=>({...x,ciudad:e.target.value}))} placeholder="Foshan, Guangdong"/></Campo>
            <Campo label="Persona de contacto" ob><Inp value={provForm.contacto} onChange={e=>setProvForm(x=>({...x,contacto:e.target.value}))}/></Campo>
            <Campo label="WeChat ID"><Inp value={provForm.wechat} onChange={e=>setProvForm(x=>({...x,wechat:e.target.value}))}/></Campo>
            <Campo label="WhatsApp"><Inp value={provForm.whatsapp} onChange={e=>setProvForm(x=>({...x,whatsapp:e.target.value}))} placeholder="+86 …"/></Campo>
            <Campo label="Chat de plataforma" hint="Si solo se habla por Alibaba / 1688: qué plataforma y usuario."><Inp value={provForm.chat_plataforma} onChange={e=>setProvForm(x=>({...x,chat_plataforma:e.target.value}))} placeholder="Alibaba · Lily Chen"/></Campo>
            <Campo label="Notas" span={3}><Inp value={provForm.notas} onChange={e=>setProvForm(x=>({...x,notas:e.target.value}))} placeholder="Responde de noche · pide 30 % de anticipo · habla inglés"/></Campo>
          </div>
          <p style={{fontSize:12.5,color:GRIS,margin:"12px 0 14px"}}>Al menos uno entre WeChat, WhatsApp o chat de plataforma.</p>
          <div style={{display:"flex",gap:8}}><Btn kind="lima" onClick={guardarProv}>{provForm.id?"Guardar cambios":"Crear proveedor"}</Btn><Btn onClick={()=>setProvForm(null)}>Cancelar</Btn></div>
        </div>}
        <Campo label="Link del producto" ob span={3} hint="La página exacta de esta máquina en Alibaba, 1688 o Made-in-China."><Inp value={f.link_producto} onChange={e=>set("link_producto",e.target.value)} placeholder="https://www.alibaba.com/product-detail/…"/></Campo>
        <Campo label="Notas internas" span={3} hint="No se muestran al cliente."><TA value={f.notas_internas} onChange={e=>set("notas_internas",e.target.value)} style={{minHeight:72}}/></Campo>
      </div>
    </Sec>

    <div style={{position:"sticky",bottom:0,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(12px)",borderTop:`1px solid ${BORDE}`,margin:"0 -28px",padding:"14px 28px"}}>
      {faltan.length>0&&<p style={{margin:"0 0 10px",fontSize:13,color:"#8A5B00"}}><b>Para publicar falta:</b> {faltan.join(" · ")}</p>}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <Btn onClick={()=>guardar()} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn>
        {p.estado!=="publicado"&&<Btn kind="lima" onClick={()=>guardar("publicado")} disabled={guardando||faltan.length>0} title={faltan.length?"Completá lo que falta":""}>Publicar</Btn>}
        {p.estado==="publicado"&&<Btn onClick={()=>guardar("pausado")} disabled={guardando}>Pausar</Btn>}
        {p.estado==="pausado"&&<span style={{fontSize:13,color:GRIS}}>Pausada: no se ve en el catálogo. “Publicar” la vuelve a mostrar.</span>}
      </div>
    </div>
  </div>;
}
