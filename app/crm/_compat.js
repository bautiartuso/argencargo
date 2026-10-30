"use client";
// Piezas del admin que usan los paneles que pasaron al CRM (30/10/2026): copiadas VERBATIM de
// app/admin/page.js (mismos nombres) para que StudioPanel, BlogPanel y SeguimientoPanel no cambien
// por dentro. toast / confirmDialog / promptDialog / alertDialog / ToastStack / DialogHost son los
// de lib/ui (el admin también los importa de ahí): se importan, no se copian.
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import DatePicker from "../components/DatePicker";
import { isoAR } from "../../lib/fecha-ar";
import { ensureFresh } from "../gi/_base";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const LOGO=`${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
const B={primary:"#1B4F8A",accent:"#4A90D9"};
// Navy Argencargo SÓLIDO + radiales sutiles (idéntico al mockup que aprobó el usuario)
const DARK_BG="radial-gradient(1200px 600px at 80% -10%, rgba(184,149,106,0.10), transparent 60%), radial-gradient(900px 700px at -10% 100%, rgba(96,165,250,0.06), transparent 50%), #0A1628";
// Dorado secundario (accent metálico)
const GOLD="#B8956A", GOLD_LIGHT="#E8D098", GOLD_DEEP="#A68456";
const IC=GOLD_LIGHT; // Accent color alias al oro claro (unificado)
const GOLD_GRADIENT="linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";
const GOLD_GLOW="0 0 20px rgba(184,149,106,0.25)";
const GOLD_GLOW_STRONG="0 0 28px rgba(184,149,106,0.4)";
const sf=async(p,o={})=>{const r=await fetch(`${SB_URL}${p}`,{...o,headers:{apikey:SB_KEY,"Content-Type":"application/json",...(o.headers||{})}});const txt=await r.text();try{return JSON.parse(txt);}catch{return null;}};
const ac=async(e,b)=>sf(`/auth/v1/${e}`,{method:"POST",body:JSON.stringify(b)});
const saveSession=(d)=>{try{localStorage.setItem("ac_admin",JSON.stringify(d));}catch(e){}};
const loadSession=()=>{try{const d=localStorage.getItem("ac_admin");return d?JSON.parse(d):null;}catch(e){return null;}};
const clearSession=()=>{try{localStorage.removeItem("ac_admin");}catch(e){}};
// JWT exp (ms). 0 si falla.
const jwtExp=(t)=>{try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).exp*1000;}catch{return 0;}};
// Refresh token (una llamada compartida entre requests concurrentes)
let _refreshingPromise=null;
const refreshToken=async()=>{
  if(_refreshingPromise)return _refreshingPromise;
  _refreshingPromise=(async()=>{
    const s=loadSession();if(!s?.refresh_token)return null;
    const r=await ac("token?grant_type=refresh_token",{refresh_token:s.refresh_token});
    if(r?.access_token){const ns={...s,token:r.access_token,refresh_token:r.refresh_token||s.refresh_token,user:r.user||s.user};saveSession(ns);if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("ac_token",{detail:ns.token}));return ns.token;}
    clearSession();if(typeof window!=="undefined")window.location.reload();return null;
  })();
  try{return await _refreshingPromise;}finally{_refreshingPromise=null;}
};
// Si el token que recibe dq está por vencer (<60s) o ya venció, renuévalo proactivamente (o tomá el fresco de localStorage si otro request ya lo renovó).
// En el CRM la sesión puede ser la del admin (ac_admin) o la propia (ac_gi_s): la renueva
// ensureFresh de app/gi/_base.js, que conoce las dos. (La versión del admin solo miraba ac_admin.)
const ensureFreshToken=async(token)=>ensureFresh(token);
// Sanitiza body antes de PATCH/POST: convierte "" a null para que columnas DATE/NUMERIC
// no fallen con 400 cuando un input quedó vacío. Bug observado: AC-0026 no guardaba
// porque algún campo DATE estaba "" y el PATCH 400-eaba silenciosamente.
const _sanitizeBody=(b)=>{
  if(!b||typeof b!=="object"||Array.isArray(b))return b;
  const out={};for(const k in b){const v=b[k];out[k]=v===""?null:v;}return out;
};
const dq=async(t,{method="GET",body,token,filters="",headers:h={}})=>{
  const fresh=await ensureFreshToken(token);
  const cleanBody=(method==="PATCH"||method==="POST")?_sanitizeBody(body):body;
  const doReq=async(tk)=>{
    const r=await fetch(`${SB_URL}/rest/v1/${t}${filters}`,{method,body:cleanBody?JSON.stringify(cleanBody):undefined,headers:{apikey:SB_KEY,"Content-Type":"application/json",Authorization:`Bearer ${tk}`,...(method==="POST"?{Prefer:"return=representation"}:method==="DELETE"?{Prefer:"return=minimal"}:method==="PATCH"?{Prefer:"return=representation"}:{}),...h}});
    const txt=await r.text();let parsed=null;try{parsed=JSON.parse(txt);}catch{}
    if(r.status>=400){console.error(`[dq] ${method} ${t} ${r.status}`,parsed);}
    return {status:r.status,body:parsed};
  };
  let r=await doReq(fresh);
  // 403/42501 = permiso de columna: el token es de antes de pasar al rol "staff" (28/10/2026).
  // Se renueva la sesión (el token nuevo trae el rol) y se reintenta una vez.
  if(r.status===401||(r.status===403&&r.body?.code==="42501")||(r.status===401&&r.body?.code==="42501")){const nt=await refreshToken();if(nt){r=await doReq(nt);}}
  return r.body;
};
// Pide UNA pagina de filas y devuelve ademas cuantas hay en total (lo lee del header
// Content-Range, que PostgREST manda cuando se pide Prefer: count=exact).
// Existe porque PostgREST no devuelve mas de 1000 filas por request y ese tope es del
// servidor: no se puede subir con `limit`. Cualquier lista que crezca tiene que pedir de
// a pedazos en vez de traerse entera y filtrarse en el navegador.
// Trae TODAS las filas paginando de a 1000 — PostgREST corta cada request en 1000 filas y
// las listas de clientes ya superan ese limite (EMISZA/ULIVRA quedaban invisibles en los
// selectores). Requiere order= en filters para que la paginacion sea estable.
const dqTodos=async(t,{token,filters=""})=>{const out=[];for(let desde=0;;desde+=1000){const sep=filters.includes("?")?"&":"?";const r=await dq(t,{token,filters:`${filters}${sep}offset=${desde}&limit=1000`});if(!Array.isArray(r))return out;out.push(...r);if(r.length<1000)return out;}};
const dqPage=async(t,{token,filters="",desde=0,hasta=59})=>{
  const pedir=async(tk)=>fetch(`${SB_URL}/rest/v1/${t}${filters}`,{headers:{apikey:SB_KEY,"Content-Type":"application/json",Authorization:`Bearer ${tk}`,"Range-Unit":"items",Range:`${desde}-${hasta}`,Prefer:"count=exact"}});
  try{
    const fresh=await ensureFreshToken(token);
    let r=await pedir(fresh);
    if(r.status===401){const nt=await refreshToken();if(nt)r=await pedir(nt);}
    let cuerpo=null;try{cuerpo=await r.json();}catch{}
    if(r.status>=400){console.error(`[dqPage] ${t} ${r.status}`,cuerpo);return{rows:[],total:0,error:true};}
    const total=Number(String(r.headers.get("content-range")||"").split("/")[1]);
    return{rows:Array.isArray(cuerpo)?cuerpo:[],total:Number.isFinite(total)?total:0};
  }catch(e){console.error(`[dqPage] ${t}`,e);return{rows:[],total:0,error:true};}
};
// Rol de la sesion actual. Lo setea el login/restore; los paneles lo usan para esconder
// la plata cuando entra un empleado (las ganancias y costos no son de su vista).
let ROL_SESION="admin";
const esEmpleado=()=>ROL_SESION==="empleado";
// Celular (01/10/2026): los paneles se rearman para el teléfono, no se achican.
const useEsCelu=(ancho=760)=>{const [c,setC]=useState(false);useEffect(()=>{const f=()=>setC(window.innerWidth<ancho);f();window.addEventListener("resize",f);return()=>window.removeEventListener("resize",f);},[ancho]);return c;};
const formatDate=(d)=>{if(!d)return"—";const s=String(d).slice(0,10);if(s.match(/^\d{4}-\d{2}-\d{2}$/)){const[y,m,day]=s.split("-");return new Date(y,m-1,day).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});};
// Versión corta para tablas: "14/04/26"
const formatDateShort=(d)=>{if(!d)return"—";const s=String(d).slice(0,10);if(s.match(/^\d{4}-\d{2}-\d{2}$/)){const[y,m,day]=s.split("-");return `${day}/${m}/${y.slice(2)}`;}const dd=new Date(d);return `${String(dd.getDate()).padStart(2,"0")}/${String(dd.getMonth()+1).padStart(2,"0")}/${String(dd.getFullYear()).slice(2)}`;};
const formatDateInput=(d)=>{if(!d)return"";const s=String(d).slice(0,10);if(s.match(/^\d{4}-\d{2}-\d{2}$/))return s;return isoAR(d);};

function Inp({label,type="text",value,onChange,placeholder,small,step,marks}){const isNum=type==="number";const isDate=type==="date";const isMoney=isNum&&step==="0.01";const [focused,setFocused]=useState(false);if(isDate){return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label><DatePicker value={value} onChange={onChange} placeholder={placeholder||"Seleccionar fecha"} small={small} marks={marks}/></div>;}
  // Para inputs monetarios: cuando no está focuseado, mostrar máximo 2 decimales (la data subyacente no cambia hasta blur)
  // Mostrar siempre con coma decimal (es-AR) — internamente se guarda con punto
  const rawDisplay=(isMoney&&!focused&&value!==""&&value!=null&&!isNaN(Number(value)))?(Math.round(Number(value)*100)/100).toString():(value||"");
  const displayVal=isNum?String(rawDisplay).replace(".",","):rawDisplay;
  return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label><input type={isNum?"text":type} inputMode={isNum?"decimal":undefined} value={displayVal} onChange={e=>{if(isNum){let v=e.target.value.replace(",",".");if(v===""||/^-?\d*\.?\d*$/.test(v))onChange(v);}else onChange(e.target.value);}} placeholder={placeholder} style={{width:"100%",padding:small?"8px 10px":"10px 12px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none",transition:"all 180ms"}} onFocus={e=>{setFocused(true);e.target.style.borderColor=GOLD;e.target.style.boxShadow=`0 0 0 3px rgba(184,149,106,0.18)`;e.target.style.background="rgba(255,255,255,0.07)";}} onBlur={e=>{setFocused(false);e.target.style.borderColor="rgba(255,255,255,0.12)";e.target.style.boxShadow="none";e.target.style.background="rgba(255,255,255,0.04)";
    // Persistir el valor redondeado a 2 decimales para no acumular basura aritmética
    if(isMoney&&value!==""&&value!=null&&!isNaN(Number(value))){const rounded=Math.round(Number(value)*100)/100;if(String(rounded)!==String(value))onChange(String(rounded));}
  }}/></div>;}

// Desplegable propio (02/10/2026): reemplaza al <select> del navegador en todo el admin, con la
// misma API. La lista va por portal al body y en posición fija: así no la recorta una tarjeta con
// overflow ni la corre un contenedor con backdrop-filter.
function Sel({label,value,onChange,options,ph}){
  const [abierto,setAbierto]=useState(false);const [pos,setPos]=useState(null);const ref=useRef(null);const listaRef=useRef(null);
  const opts=(options||[]).map(o=>typeof o==="string"?{value:o,label:o}:o);
  const lista=ph?[{value:"",label:ph},...opts]:opts;
  const actual=opts.find(o=>String(o.value)===String(value??""));
  const abrir=()=>{const r=ref.current?.getBoundingClientRect();if(!r)return;const alto=Math.min(300,lista.length*38+8);const abajo=window.innerHeight-r.bottom>alto+8||r.top<alto+8;setPos({left:r.left,width:Math.max(r.width,160),top:abajo?r.bottom+4:r.top-alto-4,maxH:alto});setAbierto(true);};
  useEffect(()=>{if(!abierto)return;const cerrar=(e)=>{if(e&&e.type==="scroll"&&listaRef.current&&(e.target===listaRef.current||listaRef.current.contains(e.target)))return;setAbierto(false);};window.addEventListener("scroll",cerrar,true);window.addEventListener("resize",cerrar);return()=>{window.removeEventListener("scroll",cerrar,true);window.removeEventListener("resize",cerrar);};},[abierto]);
  return <div style={{marginBottom:12}}>
    {label&&<label style={{display:"block",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label>}
    <button ref={ref} type="button" data-campo="" onClick={()=>abierto?setAbierto(false):abrir()} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"10px 12px",fontSize:13,boxSizing:"border-box",border:`1px solid ${abierto?GOLD:"rgba(255,255,255,0.12)"}`,borderRadius:10,background:"rgba(0,0,0,0.24)",boxShadow:"inset 0 1px 3px rgba(0,0,0,0.35)",color:actual&&String(actual.value)!==""?"#fff":"rgba(255,255,255,0.45)",outline:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",boxShadow:abierto?"0 0 0 3px rgba(184,149,106,0.18)":"none",transition:"border-color 160ms, box-shadow 160ms"}}>
      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{actual?actual.label:(ph||"Elegir…")}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" style={{flexShrink:0,transform:abierto?"rotate(180deg)":"none",transition:"transform 160ms",opacity:0.6}}><path d="M2.5 4.5 6 8l3.5-3.5" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    {abierto&&pos&&typeof document!=="undefined"&&createPortal(<>
      <div onClick={()=>setAbierto(false)} style={{position:"fixed",inset:0,zIndex:4999}}/>
      <div ref={listaRef} style={{position:"fixed",left:pos.left,top:pos.top,width:pos.width,maxHeight:pos.maxH,overflowY:"auto",overscrollBehavior:"contain",zIndex:5000,background:"rgba(20,32,56,0.86)",backdropFilter:"blur(22px) saturate(140%)",WebkitBackdropFilter:"blur(22px) saturate(140%)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:12,boxShadow:"inset 0 1px 0 rgba(255,255,255,0.12), 0 20px 50px rgba(0,0,0,0.5)",padding:4,boxSizing:"border-box",fontFamily:"inherit",animation:"ac-in .18s cubic-bezier(.2,.8,.2,1) both"}}>
        {lista.map(o=>{const on=String(o.value)===String(value??"");return <div key={String(o.value)} onClick={()=>{onChange(String(o.value));setAbierto(false);}} style={{padding:"9px 10px",fontSize:13,borderRadius:7,cursor:"pointer",color:on?GOLD_LIGHT:"#fff",background:on?"rgba(184,149,106,0.14)":"transparent",fontWeight:on?700:500}} onMouseEnter={e=>{if(!on)e.currentTarget.style.background="rgba(255,255,255,0.06)";}} onMouseLeave={e=>{if(!on)e.currentTarget.style.background="transparent";}}>{o.label}</div>;})}
      </div>
    </>,document.body)}
  </div>;
}

function Btn({children,onClick,disabled,variant="primary",small,title,fullWidth}){
  const [hover,setHover]=useState(false);
  const styles={
    primary:{background:hover?"#fff":"rgba(255,255,255,0.95)",color:"#0A1628",border:"1px solid rgba(255,255,255,0.95)",boxShadow:hover?"0 6px 18px rgba(0,0,0,0.25)":"0 2px 6px rgba(0,0,0,0.15)"},
    gold:{background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,boxShadow:hover?GOLD_GLOW_STRONG:GOLD_GLOW,backgroundSize:"200% 100%",backgroundPosition:hover?"100% 0":"0 0"},
    secondary:{background:hover?"linear-gradient(160deg,rgba(255,255,255,0.15),rgba(255,255,255,0.06))":"linear-gradient(160deg,rgba(255,255,255,0.09),rgba(255,255,255,0.035))",color:"rgba(255,255,255,0.88)",border:`1px solid ${hover?"rgba(232,208,152,0.45)":"rgba(255,255,255,0.16)"}`,boxShadow:"inset 0 1px 0 rgba(255,255,255,0.1)"},
    ghost:{background:hover?"rgba(255,255,255,0.06)":"transparent",color:"rgba(255,255,255,0.75)",border:"1px solid transparent"},
    danger:{background:hover?"rgba(255,80,80,0.2)":"rgba(255,80,80,0.12)",color:"#ff6b6b",border:"1px solid rgba(255,80,80,0.3)"},
  };
  const s=styles[variant]||styles.primary;
  return <button title={title} onClick={onClick} disabled={disabled}
    onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
    style={{padding:small?"6px 12px":"9px 18px",fontSize:small?11:13,fontWeight:600,borderRadius:10,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transition:"all 180ms cubic-bezier(0.4,0,0.2,1)",letterSpacing:"0.01em",display:fullWidth?"flex":"inline-flex",width:fullWidth?"100%":undefined,alignItems:"center",justifyContent:"center",gap:6,transform:hover&&!disabled?"translateY(-1px)":"none",...s}}>{children}</button>;
}

function Card({children,title,actions,accent,v2,sub}){
  // v2 (02/10/2026): tarjeta de Presupuesto y Finanzas — título en minúscula y más grande, sin
  // overflow (los desplegables no se cortan) y un fondo con algo más de profundidad.
  if(v2)return <section className="ac-glass ac-in" style={{padding:"20px 22px",marginBottom:16,position:"relative"}}>
    {(title||actions)&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:18}}>
      <div style={{minWidth:0}}>{title&&<h3 style={{fontSize:17,fontWeight:800,color:"#fff",margin:0,letterSpacing:"-0.015em"}}>{title}</h3>}{sub&&<p style={{fontSize:12.5,color:"rgba(255,255,255,0.45)",margin:"3px 0 0"}}>{sub}</p>}</div>
      {actions&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{actions}</div>}
    </div>}
    {children}
  </section>;
  return <div className="ac-glass ac-in" style={{padding:"1.25rem 1.5rem",marginBottom:16,position:"relative",overflow:"hidden",...(accent?{borderColor:"rgba(184,149,106,0.4)",boxShadow:`${GOLD_GLOW}, inset 0 1px 0 rgba(255,255,255,0.15)`}:{})}}>
    {accent&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:GOLD_GRADIENT}}/>}
    {(title||actions)&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:12}}>
      {title&&<h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.95)",margin:0,textTransform:"uppercase",letterSpacing:"0.08em"}}>{title}</h3>}
      {actions&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{actions}</div>}
    </div>}
    {children}
  </div>;
}

// Rol de la sesión del CRM: la página lo fija una vez al entrar (en el admin lo hacía AdminPage al
// restaurar la sesión). esEmpleado() lee esta misma variable.
export const setRolCrm=(rol)=>{ROL_SESION=rol==="empleado"?"empleado":"admin";};
export const getRolCrm=()=>ROL_SESION;

export { SB_URL, SB_KEY, LOGO, B, DARK_BG, GOLD, GOLD_LIGHT, GOLD_DEEP, IC, GOLD_GRADIENT, GOLD_GLOW, GOLD_GLOW_STRONG,
  sf, ac, saveSession, loadSession, clearSession, jwtExp, refreshToken, ensureFreshToken, dq, dqTodos, dqPage,
  esEmpleado, useEsCelu, formatDate, formatDateShort, formatDateInput, Inp, Sel, Btn, Card };
