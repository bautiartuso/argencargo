"use client";
// Panel de maquinaria (20/09/2026): menú lateral fijo y las secciones del panel mayorista.
// Estética propia, distinta al admin de Argencargo: grafito/claro, amarillo, Montserrat + JetBrains Mono.
import { useState, useEffect, useMemo } from "react";
import { leerAjustes, AJUSTES_DEFAULT } from "../../../lib/catalogo-precio";
import { CSS,INK,GRIS,BORDE,CARD,LIMA,LIMA_SUAVE,MONO,LBL,Inp,Btn,Ico,Vacio,Avisos,toast,Logo as LogoImg,BotonTema } from "./ui";
import { Inicio, Clientes, Ajustes } from "./Otros";
import { Maquinas, Proveedores } from "./Catalogo";
import { Pedidos } from "./Pedidos";
import { Resumen, Libro, Tarifas, CCFinanciera } from "./Finanzas";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

// ── Sesión: sirve la del admin (ac_admin) o la del panel GI (ac_gi_s) ─────────────────────
const leer=(k)=>{try{const d=localStorage.getItem(k);return d?JSON.parse(d):null;}catch{return null;}};
const cargarSesion=()=>{
  const a=leer("ac_admin");if(a?.token&&["admin","empleado"].includes(a?.profile?.role))return{token:a.token,refresh:a.refresh_token,user:a.user,rol:a.profile.argenmaq_role||a.profile.role,origen:"ac_admin",profile:a.profile};
  const g=leer("ac_gi_s");if(g?.access_token)return{token:g.access_token,refresh:g.refresh_token,user:g.user,rol:g.argenmaq_role||"socio",origen:"ac_gi_s"};
  return null;
};
const guardarSesion=(s)=>{try{
  if(s.origen==="ac_admin")localStorage.setItem("ac_admin",JSON.stringify({token:s.token,refresh_token:s.refresh,user:s.user,profile:s.profile}));
  else localStorage.setItem("ac_gi_s",JSON.stringify({access_token:s.token,refresh_token:s.refresh,user:s.user,argenmaq_role:s.rol}));
}catch{}};
const sf=async(p,o={})=>{const r=await fetch(`${SB_URL}${p}`,{...o,headers:{apikey:SB_KEY,"Content-Type":"application/json",...(o.headers||{})}});let body=null;try{body=await r.json();}catch{}return{status:r.status,body};};
const jwtExp=(t)=>{try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).exp*1000;}catch{return 0;}};

export default function MaquinariaPage(){
  const [ses,setSes]=useState(null);
  const [cargando,setCargando]=useState(true);
  const [tema,setTemaSt]=useState("cat");
  useEffect(()=>{setSes(cargarSesion());try{setTemaSt(localStorage.getItem("mq_tema")==="claro"?"claro":"cat");}catch{}setCargando(false);},[]);
  const setTema=(t)=>{setTemaSt(t);try{localStorage.setItem("mq_tema",t);}catch{}};
  return <div className="mq" data-tema={tema==="claro"?"claro":undefined} style={{minHeight:"100vh",background:"var(--mq-bg)",fontFamily:"'Montserrat',ui-sans-serif,system-ui,sans-serif",color:INK}}>
    <style dangerouslySetInnerHTML={{__html:CSS}}/>
    {cargando?<Centro>Cargando…</Centro>:!ses?<Login onLogin={setSes} tema={tema}/>:<Shell ses={ses} setSes={setSes} tema={tema} setTema={setTema}/>}
  </div>;
}
const Centro=({children})=><div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:GRIS}}>{children}</div>;

function Login({onLogin,tema}){
  const [email,setEmail]=useState("");const [pw,setPw]=useState("");const [err,setErr]=useState("");const [lo,setLo]=useState(false);
  const entrar=async(e)=>{e.preventDefault();if(!email||!pw)return;setLo(true);setErr("");
    const r=(await sf("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password:pw})})).body;
    if(!r?.access_token){setErr(r?.error_description||"Credenciales inválidas");setLo(false);return;}
    const p=(await sf(`/rest/v1/profiles?id=eq.${r.user.id}&select=id,role,is_gi_partner,argenmaq_role,email`,{headers:{Authorization:`Bearer ${r.access_token}`}})).body;
    const prof=Array.isArray(p)?p[0]:null;
    if(!prof||!(["admin","empleado"].includes(prof.role)||prof.is_gi_partner===true||prof.argenmaq_role)){setErr("Tu cuenta no tiene acceso a ARGENMAQ.");setLo(false);return;}
    const esAdmin=["admin","empleado"].includes(prof.role);
    const s={token:r.access_token,refresh:r.refresh_token,user:r.user,rol:prof.argenmaq_role||(esAdmin?prof.role:"socio"),origen:esAdmin?"ac_admin":"ac_gi_s",profile:prof};
    guardarSesion(s);onLogin(s);setLo(false);};
  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1rem"}}>
    <form onSubmit={entrar} style={{width:"100%",maxWidth:380}}>
      <img src={tema==="claro"?"/argenmaq/completo.png":"/argenmaq/completo-blanco.png"} alt="ARGENMAQ" style={{height:96,width:"auto",display:"block",margin:"0 auto"}}/>
      <h1 style={{fontSize:22,fontWeight:800,letterSpacing:"-0.02em",margin:"22px 0 18px",textAlign:"center"}}>Panel de ARGENMAQ</h1>
      <Inp type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/>
      <Inp type="password" placeholder="Contraseña" value={pw} onChange={e=>setPw(e.target.value)} autoComplete="current-password" style={{marginTop:10}}/>
      {err&&<p style={{color:"var(--mq-bad)",fontSize:13,margin:"10px 0 0"}}>{err}</p>}
      <Btn kind="lima" type="submit" disabled={lo} style={{width:"100%",marginTop:16,padding:"13px"}}>{lo?"Entrando…":"Entrar"}</Btn>
    </form>
  </div>;
}

// ── Menú ──────────────────────────────────────────────────────────────────────────────────
const MENU=[
  {sec:"General",items:[
    {k:"inicio",l:"Inicio",i:["M3 12L12 3l9 9","M5 10v10h14V10"]},
    {k:"pedidos",l:"Operaciones",i:["M6 2h12l2 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z","M4 7h16","M9 11a3 3 0 0 0 6 0"]},
  ]},
  {sec:"Catálogo",items:[
    {k:"maquinas",l:"Máquinas",i:["M3 8h18v12H3z","M8 8V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3","M3 13h18"]},
    {k:"proveedores",l:"Proveedores",i:["M3 21h18","M5 21V7l7-4 7 4v14","M9 21v-6h6v6"]},
  ]},
  {sec:"Comercial",items:[
    {k:"clientes",l:"Clientes",i:["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z","M23 21v-2a4 4 0 0 0-3-3.9","M16 3.1a4 4 0 0 1 0 7.8"]},
    {k:"comunicaciones",l:"Comunicaciones",i:["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"]},
  ]},
  {sec:"Marketing",items:[
    {k:"studio",l:"Content Studio",i:["M4 4h16v12H4z","M8 20h8","M12 16v4","M8 8l3 3 2-2 3 3"]},
  ]},
  {sec:"Finanzas",items:[
    {k:"resumen",l:"Resumen",i:["M3 3v18h18","M7 15l4-4 3 3 6-6"]},
    {k:"libro",l:"Libro diario",i:["M4 19.5A2.5 2.5 0 0 1 6.5 17H20","M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"]},
    {k:"cc",l:"CC Financiera",i:["M3 10h18","M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z","M7 15h2","M11 15h2"]},
    {k:"tarifas",l:"Tarifas",i:["M18 20V10","M12 20V4","M6 20v-6"]},
  ]},
  {sec:"Configuración",items:[
    {k:"ajustes",l:"Ajustes",i:["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z","M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"]},
  ]},
];
const TITULOS=Object.fromEntries(MENU.flatMap(s=>s.items.map(i=>[i.k,i.l])));

function Shell({ses,setSes,tema,setTema}){
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

  const esAdmin=ses.rol==="admin";
  const menu=MENU;
  const [pag,setPag]=useState(()=>{try{return localStorage.getItem("mq_nav")||"inicio";}catch{return "inicio";}});
  const [pedidoSel,setPedidoSel]=useState(null);
  const [abierto,setAbierto]=useState(false);
  const ir=(k,extra)=>{if(k==="pedidos")setPedidoSel(extra||null);setPag(k);setAbierto(false);try{localStorage.setItem("mq_nav",k);}catch{}};

  const [cats,setCats]=useState([]);
  const [provs,setProvs]=useState([]);
  const [prods,setProds]=useState([]);
  const [antid,setAntid]=useState([]);
  const [ajustes,setAjustes]=useState(AJUSTES_DEFAULT);
  const [pedidos,setPedidos]=useState([]);
  const [movs,setMovs]=useState([]);
  const [ccs,setCcs]=useState([]);
  const [ops,setOps]=useState([]);
  const [tarifas,setTarifas]=useState(null);
  const [gastoCats,setGastoCats]=useState([]);
  const [listo,setListo]=useState(false);
  const cargar=async()=>{try{
    const [c,p,pr,a,aj,pe,mo,cc,gc,tf,cfg]=await Promise.all([
      dq("cat_categorias",{filters:"?select=*&order=orden.asc,nombre.asc"}),
      dq("cat_proveedores",{filters:"?select=*&order=fabrica.asc"}),
      dq("cat_productos",{filters:"?select=id,numero,estado,nombre,nombre_raw,modelo,categoria,subcategoria,exw_usd,markup_pct,dias_produccion,fotos,updated_at,proveedor_id,precio_verificado_at&order=updated_at.desc"}),
      dq("antidumping_ncm",{filters:"?select=ncm_prefix,producto,nota,medida_tipo,valor,unidad,resolucion,vigencia_hasta&activo=eq.true"}),
      dq("cat_ajustes",{filters:"?select=clave,valor"}),
      dq("cat_pedidos",{filters:"?select=*&order=created_at.desc"}),
      dq("cat_movimientos",{filters:"?select=*&order=fecha.desc,created_at.desc"}),
      dq("cat_cc_financiera",{filters:"?select=*&order=fecha.desc,created_at.desc"}),
      dq("cat_gasto_categorias",{filters:"?select=*&order=orden.asc,nombre.asc"}),
      dq("tariffs",{filters:"?select=*&order=sort_order.asc"}).catch(()=>[]),
      dq("calc_config",{filters:"?select=*"}).catch(()=>[]),
    ]);
    setCats(Array.isArray(c)?c:[]);setProvs(Array.isArray(p)?p:[]);setProds(Array.isArray(pr)?pr:[]);setAntid(Array.isArray(a)?a:[]);setAjustes(leerAjustes(Array.isArray(aj)?aj:[]));setPedidos(Array.isArray(pe)?pe:[]);setMovs(Array.isArray(mo)?mo:[]);setCcs(Array.isArray(cc)?cc:[]);setGastoCats(Array.isArray(gc)?gc:[]);
    const ajs=leerAjustes(Array.isArray(aj)?aj:[]);
    const config={};(Array.isArray(cfg)?cfg:[]).forEach(r=>{config[r.key]=Number(r.value);});
    let cliente=null,overrides=[];
    if(ajs.argencargo_client_id){
      const [o,cl,ov]=await Promise.all([
        dq("operations",{filters:`?select=id,operation_code,status,eta,channel,description,created_at,dispatched_at,arrived_in_argentina_at,cleared_customs_at,delivered_at,international_tracking&client_id=eq.${ajs.argencargo_client_id}&order=created_at.desc&limit=200`}).catch(()=>[]),
        dq("clients",{filters:`?id=eq.${ajs.argencargo_client_id}&select=id,tax_condition,client_code`}).catch(()=>[]),
        dq("client_tariff_overrides",{filters:`?client_id=eq.${ajs.argencargo_client_id}&select=*`}).catch(()=>[]),
      ]);
      setOps(Array.isArray(o)?o:[]);cliente=Array.isArray(cl)?cl[0]:null;overrides=Array.isArray(ov)?ov:[];
    }
    setTarifas({tariffs:Array.isArray(tf)?tf:[],config,overrides,cliente:cliente||{tax_condition:"responsable_inscripto"}});
  }catch(e){toast(e.message,"error");}setListo(true);};
  useEffect(()=>{cargar();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const arbol=useMemo(()=>cats.filter(c=>!c.padre_slug).map(c=>({...c,subs:cats.filter(s=>s.padre_slug===c.slug)})),[cats]);
  const ctx={ses,dq,token,cats,arbol,provs,setProvs,prods,antid,ajustes,setAjustes,pedidos,movs,ccs,ops,tarifas,gastoCats,listo,recargar:cargar,ir};

  const inicial=(ses.user?.email||"?").slice(0,2).toUpperCase();
  return <div>
    <Avisos/>
    {abierto&&<div className="velo" onClick={()=>setAbierto(false)}/>}
    <aside className={`side${abierto?" open":""}`}>
      <div style={{padding:"20px 18px 14px"}}><LogoImg alto={34} claro={tema==="claro"}/></div>
      <nav style={{padding:"0 10px",flex:1}}>
        {menu.map(s=><div key={s.sec} style={{marginBottom:14}}>
          <p style={{...LBL,padding:"0 10px",marginBottom:4,fontSize:10}}>{s.sec}</p>
          {s.items.map(it=>{const on=pag===it.k;return <button key={it.k} className="navi" onClick={()=>ir(it.k)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:10,border:"none",background:on?LIMA_SUAVE:"transparent",color:INK,fontSize:13.5,fontWeight:on?800:600,cursor:"pointer",textAlign:"left",marginBottom:1}}><Ico d={it.i} color={on?INK:GRIS}/>{it.l}</button>;})}
        </div>)}
      </nav>
      <div style={{padding:14,borderTop:`1px solid ${BORDE}`,display:"flex",alignItems:"center",gap:10}}>
        <span style={{width:34,height:34,borderRadius:"50%",background:LIMA_SUAVE,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0}}>{inicial}</span>
        <span style={{flex:1,minWidth:0,fontSize:12,color:GRIS,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ses.user?.email}</span>
        <BotonTema tema={tema} setTema={setTema}/>
        <Btn small onClick={salir}>Salir</Btn>
      </div>
    </aside>
    <div className="cont">
      <div className="topmovil" style={{alignItems:"center",gap:12,padding:"12px 16px",borderBottom:`1px solid ${BORDE}`}}><button onClick={()=>setAbierto(true)} style={{border:`1px solid ${BORDE}`,background:CARD,color:INK,borderRadius:10,padding:8,cursor:"pointer",display:"inline-flex"}}><Ico d={["M4 6h16","M4 12h16","M4 18h16"]}/></button><LogoImg alto={24} solo/><span style={{fontWeight:800,flex:1}}>{TITULOS[pag]}</span><BotonTema tema={tema} setTema={setTema}/></div>
      <main style={{maxWidth:1120,margin:"0 auto",padding:"28px 28px 90px"}}>
        {!listo?<p style={{color:GRIS}}>Cargando…</p>
        :pag==="inicio"?<Inicio {...ctx}/>
        :pag==="pedidos"?<Pedidos key={pedidoSel||"lista"} {...ctx} inicialSel={pedidoSel}/>
        :pag==="maquinas"?<Maquinas {...ctx}/>
        :pag==="proveedores"?<Proveedores {...ctx}/>
        :pag==="clientes"?<Clientes {...ctx}/>
        :pag==="resumen"?<Resumen {...ctx}/>
        :pag==="libro"?<Libro {...ctx}/>
        :pag==="cc"?<CCFinanciera {...ctx}/>
        :pag==="tarifas"?<Tarifas {...ctx}/>
        :pag==="ajustes"?<Ajustes {...ctx} tema={tema} setTema={setTema}/>
        :<Vacio/>}
      </main>
    </div>
  </div>;
}
