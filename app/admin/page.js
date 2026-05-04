"use client";
import { useState, useEffect, useRef, Fragment } from "react";
import { calcOpBudget } from "../../lib/calc";
import { ToastStack, toast, Skeleton, SkeletonTable, EmptyState } from "../../lib/ui";
import DatePicker from "../components/DatePicker";
import { printQuotePdf, printReceiptPdf, printClosingPdf, printPackageLabels, printSimplifiedDeclaration } from "../../lib/pdf-templates";
import TrackingDuplicateWarning from "../components/TrackingDuplicateWarning";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const LOGO=`${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
const B={primary:"#1B4F8A",accent:"#4A90D9"};
const DARK_BG="linear-gradient(160deg,#0F1E3D 0%,#152849 50%,#0F1E3D 100%)";
// Dorado secundario (accent metálico)
const GOLD="#B8956A", GOLD_LIGHT="#E8D098", GOLD_DEEP="#A68456";
const IC=GOLD_LIGHT; // Accent color alias al oro claro (unificado)
// Tier system
const TIERS={
  standard:{label:"Standard",min:0,next:100,color:"#94a3b8",light:"rgba(148,163,184,0.9)",gradient:"linear-gradient(135deg,#475569,#64748b,#475569)",glow:"0 0 14px rgba(100,116,139,0.2)",bonus:0,discount:0,icon:"○"},
  silver:{label:"Silver",min:100,next:500,color:"#C0C0C0",light:"#E8E8E8",gradient:"linear-gradient(135deg,#8A8A8A,#E8E8E8,#8A8A8A)",glow:"0 0 14px rgba(192,192,192,0.28)",bonus:2,discount:10,icon:"🥈"},
  gold:{label:"Gold",min:500,next:1000,color:"#B8956A",light:"#E8D098",gradient:"linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)",glow:"0 0 18px rgba(184,149,106,0.25)",bonus:10,discount:25,icon:"🥇"},
  diamond:{label:"Diamond",min:1000,next:null,color:"#B9F2FF",light:"#E0F7FF",gradient:"linear-gradient(135deg,#6BC5E0,#B9F2FF,#6BC5E0)",glow:"0 0 18px rgba(185,242,255,0.3)",bonus:15,discount:50,icon:"💠"},
};
const getTierInfo=(t)=>TIERS[t||"standard"]||TIERS.standard;
const GOLD_GRADIENT="linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";
const GOLD_GLOW="0 0 20px rgba(184,149,106,0.25)";
const GOLD_GLOW_STRONG="0 0 28px rgba(184,149,106,0.4)";
// Keyframes globales (pulsing dots, shimmer)
const AC_KEYFRAMES=`@keyframes ac_pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}@keyframes ac_pulse_gold{0%{box-shadow:0 0 0 0 rgba(184,149,106,.55)}70%{box-shadow:0 0 0 10px rgba(184,149,106,0)}100%{box-shadow:0 0 0 0 rgba(184,149,106,0)}}@keyframes ac_shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes ac_fade_in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}@keyframes acGiPulse{0%,100%{box-shadow:0 0 16px rgba(184,149,106,0.35), inset 0 1px 0 rgba(255,255,255,0.4)}50%{box-shadow:0 0 28px rgba(232,208,152,0.6), inset 0 1px 0 rgba(255,255,255,0.4)}}`;
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
    if(r?.access_token){const ns={...s,token:r.access_token,refresh_token:r.refresh_token||s.refresh_token,user:r.user||s.user};saveSession(ns);return ns.token;}
    clearSession();if(typeof window!=="undefined")window.location.reload();return null;
  })();
  try{return await _refreshingPromise;}finally{_refreshingPromise=null;}
};
// Si el token que recibe dq está por vencer (<60s) o ya venció, renuévalo proactivamente (o tomá el fresco de localStorage si otro request ya lo renovó).
const ensureFreshToken=async(token)=>{
  const exp=jwtExp(token);
  if(exp&&Date.now()>exp-60000){
    const s=loadSession();
    if(s?.token&&jwtExp(s.token)>Date.now()+60000)return s.token;
    const nt=await refreshToken();if(nt)return nt;
  }
  return token;
};
const dq=async(t,{method="GET",body,token,filters="",headers:h={}})=>{
  const fresh=await ensureFreshToken(token);
  const doReq=async(tk)=>{
    const r=await fetch(`${SB_URL}/rest/v1/${t}${filters}`,{method,body:body?JSON.stringify(body):undefined,headers:{apikey:SB_KEY,"Content-Type":"application/json",Authorization:`Bearer ${tk}`,...(method==="POST"?{Prefer:"return=representation"}:method==="DELETE"?{Prefer:"return=minimal"}:method==="PATCH"?{Prefer:"return=representation"}:{}),...h}});
    const txt=await r.text();let parsed=null;try{parsed=JSON.parse(txt);}catch{}
    return {status:r.status,body:parsed};
  };
  let r=await doReq(fresh);
  if(r.status===401){const nt=await refreshToken();if(nt){r=await doReq(nt);}}
  return r.body;
};
const SM={pendiente:{l:"PROVEEDOR",c:"#94a3b8"},en_deposito_origen:{l:"WAREHOUSE ARGENCARGO",c:"#fbbf24"},en_preparacion:{l:"DOCUMENTACIÓN",c:"#a78bfa"},en_transito:{l:"EN TRÁNSITO",c:"#60a5fa"},arribo_argentina:{l:"ARRIBO ARGENTINA",c:"#818cf8"},en_aduana:{l:"GESTIÓN ADUANERA",c:"#fb923c"},entregada:{l:"LISTA PARA RETIRAR",c:"#22c55e"},operacion_cerrada:{l:"OPERACIÓN CERRADA",c:"#10b981"},cancelada:{l:"CANCELADA",c:"#f87171"}};
// calcOpBudget se importa desde lib/calc.js (extraído para testing)
const CM={aereo_blanco:"Aéreo A",aereo_negro:"Aéreo B",maritimo_blanco:"Marítimo A",maritimo_negro:"Marítimo B"};
const STATUSES=Object.keys(SM);
const CHANNELS=Object.keys(CM);
const SERVICES=[{key:"aereo_a_china",label:"Aéreo A — China",unit:"kg",info:"7-10 días hábiles"},{key:"aereo_b_usa",label:"Aéreo B — USA (carga general)",unit:"kg",info:"48-72 hs hábiles"},{key:"aereo_b_usa_celulares",label:"Aéreo B — USA (celulares)",unit:"kg",info:"Tarifa especial celulares"},{key:"aereo_b_china",label:"Aéreo B — China",unit:"kg",info:"10-15 días hábiles"},{key:"maritimo_a_china",label:"Marítimo A — China",unit:"cbm",info:""},{key:"maritimo_b",label:"Marítimo B — China/USA",unit:"cbm",info:""}];
const formatDate=(d)=>{if(!d)return"—";const s=String(d).slice(0,10);if(s.match(/^\d{4}-\d{2}-\d{2}$/)){const[y,m,day]=s.split("-");return new Date(y,m-1,day).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});};
const formatDateInput=(d)=>{if(!d)return"";const s=String(d).slice(0,10);if(s.match(/^\d{4}-\d{2}-\d{2}$/))return s;return new Date(d).toISOString().split("T")[0];};

function Inp({label,type="text",value,onChange,placeholder,small,step}){const isNum=type==="number";const isDate=type==="date";if(isDate){return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label><DatePicker value={value} onChange={onChange} placeholder={placeholder||"Seleccionar fecha"} small={small}/></div>;}return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label><input type={isNum?"text":type} inputMode={isNum?"decimal":undefined} value={value||""} onChange={e=>{if(isNum){const v=e.target.value;if(v===""||/^-?\d*\.?\d*$/.test(v))onChange(v);}else onChange(e.target.value);}} placeholder={placeholder} style={{width:"100%",padding:small?"8px 10px":"10px 12px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none",transition:"all 180ms"}} onFocus={e=>{e.target.style.borderColor=GOLD;e.target.style.boxShadow=`0 0 0 3px rgba(184,149,106,0.18)`;e.target.style.background="rgba(255,255,255,0.07)";}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";e.target.style.boxShadow="none";e.target.style.background="rgba(255,255,255,0.04)";}}/></div>;}

function Sel({label,value,onChange,options,ph}){return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label><select value={value||""} onChange={e=>onChange(e.target.value)} onFocus={e=>{e.target.style.borderColor=GOLD;e.target.style.boxShadow=`0 0 0 3px rgba(184,149,106,0.18)`;}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";e.target.style.boxShadow="none";}} style={{width:"100%",padding:"10px 12px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.04)",color:value?"#fff":"rgba(255,255,255,0.45)",outline:"none",transition:"all 180ms",cursor:"pointer"}}>{ph&&<option value="" style={{background:"#0F1F3A"}}>{ph}</option>}{options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value} style={{background:"#0F1F3A",color:"#fff"}}>{typeof o==="string"?o:o.label}</option>)}</select></div>;}

function Btn({children,onClick,disabled,variant="primary",small,title,fullWidth}){
  const [hover,setHover]=useState(false);
  const styles={
    primary:{background:hover?"#fff":"rgba(255,255,255,0.95)",color:"#0A1628",border:"1px solid rgba(255,255,255,0.95)",boxShadow:hover?"0 6px 18px rgba(0,0,0,0.25)":"0 2px 6px rgba(0,0,0,0.15)"},
    gold:{background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,boxShadow:hover?GOLD_GLOW_STRONG:GOLD_GLOW,backgroundSize:"200% 100%",backgroundPosition:hover?"100% 0":"0 0"},
    secondary:{background:hover?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.85)",border:`1px solid ${hover?"rgba(184,149,106,0.4)":"rgba(255,255,255,0.14)"}`},
    ghost:{background:hover?"rgba(255,255,255,0.06)":"transparent",color:"rgba(255,255,255,0.75)",border:"1px solid transparent"},
    danger:{background:hover?"rgba(255,80,80,0.2)":"rgba(255,80,80,0.12)",color:"#ff6b6b",border:"1px solid rgba(255,80,80,0.3)"},
  };
  const s=styles[variant]||styles.primary;
  return <button title={title} onClick={onClick} disabled={disabled}
    onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
    style={{padding:small?"6px 12px":"9px 18px",fontSize:small?11:13,fontWeight:600,borderRadius:10,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transition:"all 180ms cubic-bezier(0.4,0,0.2,1)",letterSpacing:"0.01em",display:fullWidth?"flex":"inline-flex",width:fullWidth?"100%":undefined,alignItems:"center",justifyContent:"center",gap:6,transform:hover&&!disabled?"translateY(-1px)":"none",...s}}>{children}</button>;
}

function Card({children,title,actions,accent}){
  return <div style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(8px)",borderRadius:14,border:`1px solid ${accent?"rgba(184,149,106,0.35)":"rgba(255,255,255,0.08)"}`,padding:"1.25rem 1.5rem",marginBottom:16,boxShadow:accent?GOLD_GLOW:"0 2px 8px rgba(0,0,0,0.12)",transition:"border-color 180ms, box-shadow 180ms",position:"relative",overflow:"hidden"}}>
    {accent&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:GOLD_GRADIENT}}/>}
    {(title||actions)&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:12}}>
      {title&&<h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.95)",margin:0,textTransform:"uppercase",letterSpacing:"0.08em"}}>{title}</h3>}
      {actions&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{actions}</div>}
    </div>}
    {children}
  </div>;
}

function NotifBell({token}){
  const [open,setOpen]=useState(false);const [notifs,setNotifs]=useState([]);const [unread,setUnread]=useState(0);
  const load=async()=>{const r=await dq("notifications",{token,filters:"?select=*&order=created_at.desc&limit=20"});const list=Array.isArray(r)?r:[];setNotifs(list);setUnread(list.filter(n=>!n.read).length);};
  useEffect(()=>{load();const iv=setInterval(load,60000);return()=>clearInterval(iv);},[token]);
  const markRead=async(id)=>{await dq("notifications",{method:"PATCH",token,filters:`?id=eq.${id}`,body:{read:true}});setNotifs(p=>p.map(n=>n.id===id?{...n,read:true}:n));setUnread(p=>Math.max(0,p-1));};
  return <div style={{position:"relative"}}><button onClick={()=>setOpen(p=>!p)} style={{background:"none",border:"none",cursor:"pointer",padding:4,position:"relative"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>{unread>0&&<span style={{position:"absolute",top:0,right:0,width:16,height:16,borderRadius:"50%",background:"#ef4444",color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{unread}</span>}</button>
  {open&&<><div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setOpen(false)}/><div style={{position:"fixed",right:16,top:60,width:"min(340px, calc(100vw - 32px))",maxHeight:400,overflowY:"auto",background:"#142038",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.5)",zIndex:1000}}><div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,fontWeight:700,color:"#fff"}}>Notificaciones</span>{unread>0&&<span style={{fontSize:11,color:IC}}>{unread} nuevas</span>}</div>{notifs.length===0?<p style={{padding:"20px 16px",fontSize:13,color:"rgba(255,255,255,0.4)",textAlign:"center",margin:0}}>Sin notificaciones</p>:notifs.map(n=><div key={n.id} onClick={()=>!n.read&&markRead(n.id)} style={{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:n.read?"default":"pointer",background:n.read?"transparent":"rgba(184,149,106,0.06)"}}><p style={{fontSize:12,fontWeight:n.read?400:600,color:n.read?"rgba(255,255,255,0.5)":"#fff",margin:0}}>{n.title||"Notificación"}</p>{n.body&&<p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"2px 0 0"}}>{n.body}</p>}<p style={{fontSize:10,color:"rgba(255,255,255,0.25)",margin:"4px 0 0"}}>{formatDate(n.created_at)}</p></div>)}</div></>}
  </div>;
}

function AdminLogin({onLogin}){
  const [email,setEmail]=useState("");const [pw,setPw]=useState("");const [err,setErr]=useState("");const [lo,setLo]=useState(false);
  const doLogin=async()=>{setLo(true);setErr("");try{const r=await ac("token?grant_type=password",{email,password:pw});if(r.error){setErr(r.error_description||"Credenciales inválidas");setLo(false);return;}const p=await dq("profiles",{token:r.access_token,filters:`?id=eq.${r.user.id}&select=*`});const prof=Array.isArray(p)?p[0]:null;if(!prof||prof.role!=="admin"){setErr("Acceso denegado. Solo administradores.");setLo(false);return;}const ss={token:r.access_token,refresh_token:r.refresh_token,user:r.user,profile:prof};saveSession(ss);onLogin(ss);}catch{setErr("Error de conexión.");}setLo(false);};
  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:DARK_BG,fontFamily:"'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif",position:"relative",overflow:"hidden"}}>
    {/* Accent glows decorativos */}
    <div style={{position:"absolute",top:"-20%",right:"-10%",width:480,height:480,background:"radial-gradient(circle, rgba(184,149,106,0.12) 0%, transparent 70%)",pointerEvents:"none"}}/>
    <div style={{position:"absolute",bottom:"-20%",left:"-10%",width:520,height:520,background:"radial-gradient(circle, rgba(184,149,106,0.10) 0%, transparent 70%)",pointerEvents:"none"}}/>
    <div style={{maxWidth:400,width:"100%",padding:"0 1rem",position:"relative",zIndex:1,animation:"ac_fade_in 400ms ease-out"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <img src={LOGO} alt="AC" style={{width:210,height:"auto",filter:"drop-shadow(0 4px 24px rgba(184,149,106,0.28))"}}/>
        <p style={{fontSize:11,color:GOLD_LIGHT,margin:"14px 0 0",letterSpacing:"0.3em",textTransform:"uppercase",fontWeight:600}}>Panel de Administración</p>
      </div>
      <div style={{background:"rgba(10,22,40,0.7)",backdropFilter:"blur(28px)",borderRadius:16,padding:"2rem 1.75rem",border:"1px solid rgba(255,255,255,0.06)",boxShadow:"0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.028)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:GOLD_GRADIENT,opacity:0.85}}/>
        <Inp label="Email" type="email" value={email} onChange={setEmail} placeholder="admin@argencargo.com"/>
        <Inp label="Contraseña" type="password" value={pw} onChange={setPw} placeholder="••••••••"/>
        {err&&<p style={{fontSize:12,color:"#ff6b6b",margin:"0 0 12px",padding:"8px 12px",background:"rgba(255,80,80,0.1)",borderRadius:8,border:"1px solid rgba(255,80,80,0.2)"}}>{err}</p>}
        <div style={{marginTop:6}}>
          <Btn variant="gold" fullWidth onClick={doLogin} disabled={lo}>{lo?"Ingresando...":"Ingresar →"}</Btn>
        </div>
      </div>
    </div>
  </div>;
}

function OperationsList({token,onSelect,onNew}){
  const [ops,setOps]=useState([]);const [pmtsByOp,setPmtsByOp]=useState({});const [cliPmtsByOp,setCliPmtsByOp]=useState({});const [lo,setLo]=useState(true);const [search,setSearch]=useState("");const [fStatuses,setFStatuses]=useState([]);const [fChannel,setFChannel]=useState("");const [sortCol,setSortCol]=useState("smart");const [sortDir,setSortDir]=useState("asc");const [showStatusDrop,setShowStatusDrop]=useState(false);const [pageClosed,setPageClosed]=useState(1);const CLOSED_PER_PAGE=25;
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [bulkAction,setBulkAction]=useState(null); // {action:"setStatus"|"delete"|"markCollected", value?}
  const [bulkRunning,setBulkRunning]=useState(false);
  const toggleSelected=(id)=>setSelectedIds(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const clearSelection=()=>setSelectedIds(new Set());
  const selectAll=(rows)=>setSelectedIds(new Set(rows.map(o=>o.id)));
  const exportCSV=(rows)=>{
    const headers=["Código","Cliente","Descripción","Canal","Estado","ETA","Presupuesto","Cobrado","Cobrada","Ganancia"];
    const csv=[headers.join(",")].concat(rows.map(o=>{const cn=o.clients?`${o.clients.first_name} ${o.clients.last_name}`:"";const gan=calcGan(o);return [o.operation_code,`"${cn.replace(/"/g,'""')}"`,`"${(o.description||"").replace(/"/g,'""')}"`,o.channel||"",o.status||"",o.eta||"",Number(o.budget_total||0).toFixed(2),Number(o.collected_amount||0).toFixed(2),o.is_collected?"Sí":"No",gan.toFixed(2)].join(",");})).join("\n");
    const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`operaciones_${new Date().toISOString().slice(0,10)}.csv`;a.click();
    URL.revokeObjectURL(url);
  };
  const runBulk=async()=>{
    if(!bulkAction||selectedIds.size===0)return;
    setBulkRunning(true);
    const ids=Array.from(selectedIds);
    try{
      if(bulkAction.action==="setStatus"){
        await dq("operations",{method:"PATCH",token,filters:`?id=in.(${ids.join(",")})`,body:{status:bulkAction.value}});
      } else if(bulkAction.action==="markCollected"){
        await dq("operations",{method:"PATCH",token,filters:`?id=in.(${ids.join(",")})`,body:{is_collected:true,collection_date:new Date().toISOString().slice(0,10)}});
      } else if(bulkAction.action==="delete"){
        await dq("operations",{method:"DELETE",token,filters:`?id=in.(${ids.join(",")})`});
      }
      // Recargar
      const o=await dq("operations",{token,filters:"?select=*,clients(first_name,last_name,client_code)&order=created_at.desc"});
      setOps(Array.isArray(o)?o:[]);
      clearSelection();setBulkAction(null);
    }catch(e){alert("Error: "+e.message);}
    setBulkRunning(false);
  };
  // Peso por estado: mayor valor = más cerca de entrega (aparece arriba)
  const STATUS_WEIGHT={entregada:8,en_aduana:7,arribo_argentina:6,en_transito:5,en_preparacion:4,en_deposito_origen:3,pendiente:2,operacion_cerrada:0,cancelada:0};
  useEffect(()=>{(async()=>{const [o,pm,cp]=await Promise.all([dq("operations",{token,filters:"?select=*,clients(first_name,last_name,client_code)&order=created_at.desc"}),dq("payment_management",{token,filters:"?select=operation_id,client_amount_usd,client_paid,client_paid_amount_usd,giro_amount_usd,cost_comision_giro"}),dq("operation_client_payments",{token,filters:"?select=operation_id,amount_usd"})]);setOps(Array.isArray(o)?o:[]);const m={};(Array.isArray(pm)?pm:[]).forEach(p=>{if(!m[p.operation_id])m[p.operation_id]=[];m[p.operation_id].push(p);});setPmtsByOp(m);const cmap={};(Array.isArray(cp)?cp:[]).forEach(p=>{cmap[p.operation_id]=(cmap[p.operation_id]||0)+Number(p.amount_usd||0);});setCliPmtsByOp(cmap);setLo(false);})();},[token]);
  // Saldo pendiente del cliente. Considera:
  // - pagos ya recibidos (collected_amount si la op está cobrada, o operation_client_payments si es GI)
  // - crédito aplicado de CC (credit_applied_usd)
  // - descuento intencional (discount_applied_usd) — cubre parte del budget sin cash
  // - gestión de pagos internacionales (payment_management) si excede los anticipos
  const calcSaldo=(o)=>{
    const bt=Number(o.budget_total||0);
    if(bt<=0)return null;
    if(o.is_collected)return 0; // ya está cobrada, no hay saldo pendiente
    // Cash cobrado — para GI usa operation_client_payments, para ops regulares usa collected_amount
    const cliPaid=o.service_type==="gestion_integral"?Number(cliPmtsByOp[o.id]||0):(()=>{const raw=Number(o.collected_amount||0);const isArs=o.collection_currency==="ARS";const rate=Number(o.collection_exchange_rate||0);return isArs&&rate>0?raw/rate:raw;})();
    const creditApplied=Number(o.credit_applied_usd||0);
    const discountApplied=Number(o.discount_applied_usd||0);
    const pmts=pmtsByOp[o.id]||[];
    const pmtTot=pmts.reduce((s,p)=>s+Number(p.client_amount_usd||0),0);
    const ant=Number(o.total_anticipos||0);
    const saldo=Math.max(0,(bt-cliPaid-creditApplied-discountApplied)+Math.max(0,pmtTot-ant));
    return saldo;
  };
  const toggleStatus=(s)=>setFStatuses(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s]);
  const getOrigin=(op)=>op.origin||"China";
  const filtered=ops.filter(o=>{if(fStatuses.length>0&&!fStatuses.includes(o.status))return false;if(fChannel&&o.channel!==fChannel)return false;if(search){const s=search.toLowerCase();const cn=o.clients?`${o.clients.first_name} ${o.clients.last_name}`.toLowerCase():"";return o.operation_code.toLowerCase().includes(s)||cn.includes(s)||o.description?.toLowerCase().includes(s);}return true;});
  const calcGan=(o)=>{
    // Ingreso: si está cobrada, usar collected_amount + credit_applied + discount_applied
    let ing;
    if(o.is_collected){
      const raw=Number(o.collected_amount||0);
      const isArs=o.collection_currency==="ARS";const rate=Number(o.collection_exchange_rate||0);
      const cash=isArs&&rate>0?raw/rate:raw;
      // Sumar crédito de CC aplicado y descuento intencional (contabilizado como ingreso "virtual")
      // Capear cash al budget_total: si pagó de más, el excedente va a CC, no es ingreso de la op
      const bt=Number(o.budget_total||0);
      const cashForOp=bt>0?Math.min(cash,bt):cash;
      ing=cashForOp+Number(o.credit_applied_usd||0)+Number(o.discount_applied_usd||0);
      // Fallback: si la op está cobrada pero no tiene collected_amount cargado, usar presupuesto
      if(ing<=0)ing=Number(o.budget_total||0);
    } else {
      ing=Number(o.budget_total||0);
    }
    const costProd=o.service_type==="gestion_integral"?Number(o.cost_producto_usd||0):0;
    const cost=Number(o.cost_flete||0)+costProd+Number(o.cost_impuestos_reales||0)+Number(o.cost_gasto_documental||0)+Number(o.cost_seguro||0)+Number(o.cost_flete_local||0)+Number(o.cost_otros||0);
    const pmts=pmtsByOp[o.id]||[];
    const pmtGan=pmts.reduce((s,p)=>{const cli=p.client_paid?Number(p.client_paid_amount_usd??p.client_amount_usd??0):Number(p.client_amount_usd||0);return s+cli-Number(p.giro_amount_usd||0)-Number(p.cost_comision_giro||0);},0);
    return ing-cost+pmtGan;
  };
  const sorted=[...filtered].sort((a,b)=>{
    if(sortCol==="smart"){
      // Orden: más cercano a entrega primero (status_weight desc), luego ETA asc, luego created_at desc
      const wa=STATUS_WEIGHT[a.status]??-1,wb=STATUS_WEIGHT[b.status]??-1;
      if(wa!==wb)return wb-wa;
      const ea=a.eta?String(a.eta).slice(0,10):"9999-12-31";const eb=b.eta?String(b.eta).slice(0,10):"9999-12-31";
      if(ea!==eb)return ea.localeCompare(eb);
      return (b.created_at||"").localeCompare(a.created_at||"");
    }
    let va=a[sortCol],vb=b[sortCol];if(sortCol==="client"){va=a.clients?`${a.clients.first_name} ${a.clients.last_name}`:"";vb=b.clients?`${b.clients.first_name} ${b.clients.last_name}`:"";}if(sortCol==="origin"){va=getOrigin(a);vb=getOrigin(b);}if(sortCol==="ganancia"){va=calcGan(a);vb=calcGan(b);}if(va==null)va="";if(vb==null)vb="";if(typeof va==="string")va=va.toLowerCase();if(typeof vb==="string")vb=vb.toLowerCase();if(va<vb)return sortDir==="asc"?-1:1;if(va>vb)return sortDir==="asc"?1:-1;return 0;
  });
  const toggleSort=(col)=>{if(sortCol===col){setSortDir(d=>d==="asc"?"desc":"asc");}else{setSortCol(col);setSortDir("asc");}};
  const SH=({label,col})=><th onClick={()=>toggleSort(col)} style={{padding:"14px 16px",textAlign:"left",fontSize:10,fontWeight:700,color:sortCol===col?GOLD_LIGHT:"rgba(255,255,255,0.45)",textTransform:"uppercase",cursor:"pointer",userSelect:"none",letterSpacing:"0.08em",transition:"color 150ms"}}>{label}{sortCol===col?<span style={{marginLeft:6,fontSize:9}}>{sortDir==="asc"?"▲":"▼"}</span>:null}</th>;
  // Cards "qué necesita atención": cuenta ops por categoría problemática
  const STALE_DAYS={en_deposito_origen:14,en_preparacion:10,en_transito:30,arribo_argentina:7,en_aduana:14,entregada:30};
  const daysSince=(dateStr)=>dateStr?Math.floor((Date.now()-new Date(dateStr).getTime())/86400000):0;
  const staleOps=ops.filter(o=>{const limit=STALE_DAYS[o.status];if(!limit)return false;const since=daysSince(o.updated_at||o.created_at);return since>=limit;});
  const noBudgetOps=ops.filter(o=>!["operacion_cerrada","cancelada","pendiente"].includes(o.status)&&Number(o.budget_total||0)<=0);
  const unpaidClosedOps=ops.filter(o=>{const s=calcSaldo(o);return s!==null&&s>0&&["entregada","operacion_cerrada"].includes(o.status);});
  const noEtaOps=ops.filter(o=>["en_transito","arribo_argentina"].includes(o.status)&&!o.eta);
  const attentionTotal=staleOps.length+noBudgetOps.length+unpaidClosedOps.length+noEtaOps.length;
  const AttCard=({n,label,color,onClick})=><button onClick={onClick} style={{flex:"1 1 160px",minWidth:140,padding:"14px 16px",background:n>0?`${color}10`:"rgba(255,255,255,0.02)",border:`1px solid ${n>0?color+"50":"rgba(255,255,255,0.05)"}`,borderRadius:12,cursor:n>0?"pointer":"default",textAlign:"left",transition:"all 150ms"}} onMouseEnter={e=>{if(n>0)e.currentTarget.style.background=`${color}20`;}} onMouseLeave={e=>{if(n>0)e.currentTarget.style.background=`${color}10`;}}>
    <p style={{fontSize:24,fontWeight:800,color:n>0?color:"rgba(255,255,255,0.25)",margin:0,fontVariantNumeric:"tabular-nums"}}>{n}</p>
    <p style={{fontSize:11,color:n>0?"#fff":"rgba(255,255,255,0.4)",margin:"2px 0 0",fontWeight:600,letterSpacing:"0.02em"}}>{label}</p>
  </button>;
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:10,flexWrap:"wrap"}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>Operaciones</h2>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn variant="gold" onClick={onNew}>+ Nueva operación</Btn>
      </div>
    </div>
    {selectedIds.size>0&&<div style={{display:"flex",gap:10,marginBottom:14,padding:"12px 16px",background:`linear-gradient(90deg, rgba(184,149,106,0.18), rgba(184,149,106,0.06))`,border:`1.5px solid ${GOLD}`,borderRadius:12,alignItems:"center",flexWrap:"wrap"}}>
      <span style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,letterSpacing:"0.02em"}}>{selectedIds.size} seleccionada{selectedIds.size>1?"s":""}</span>
      <button onClick={clearSelection} style={{fontSize:11,padding:"4px 10px",border:"1px solid rgba(255,255,255,0.15)",background:"transparent",color:"rgba(255,255,255,0.6)",borderRadius:6,cursor:"pointer",fontWeight:600}}>Deseleccionar</button>
      <span style={{flex:1}}/>
      <button onClick={()=>exportCSV(ops.filter(o=>selectedIds.has(o.id)))} style={{padding:"7px 14px",fontSize:11.5,fontWeight:700,borderRadius:7,border:"1px solid rgba(96,165,250,0.4)",background:"rgba(96,165,250,0.1)",color:"#60a5fa",cursor:"pointer"}}>📥 Exportar CSV</button>
      <select onChange={e=>{if(e.target.value){setBulkAction({action:"setStatus",value:e.target.value});e.target.value="";}}} defaultValue="" style={{padding:"7px 12px",fontSize:11.5,fontWeight:600,borderRadius:7,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.06)",color:"#fff",cursor:"pointer"}}>
        <option value="" style={{background:"#142038"}}>↻ Cambiar estado…</option>
        {STATUSES.map(s=><option key={s} value={s} style={{background:"#142038"}}>{SM[s].l}</option>)}
      </select>
      <button onClick={()=>setBulkAction({action:"markCollected"})} style={{padding:"7px 14px",fontSize:11.5,fontWeight:700,borderRadius:7,border:"1px solid rgba(34,197,94,0.4)",background:"rgba(34,197,94,0.1)",color:"#22c55e",cursor:"pointer"}}>💰 Marcar cobradas</button>
      <button onClick={()=>setBulkAction({action:"delete"})} style={{padding:"7px 14px",fontSize:11.5,fontWeight:700,borderRadius:7,border:"1px solid rgba(255,80,80,0.4)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>🗑 Eliminar</button>
    </div>}
    {attentionTotal>0&&<div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
      <AttCard n={staleOps.length} label="Estancadas" color="#f87171" onClick={()=>{if(staleOps[0])onSelect(staleOps[0]);}}/>
      <AttCard n={noBudgetOps.length} label="Sin presupuesto" color="#fbbf24" onClick={()=>{if(noBudgetOps[0])onSelect(noBudgetOps[0]);}}/>
      <AttCard n={noEtaOps.length} label="Sin ETA" color="#60a5fa" onClick={()=>{if(noEtaOps[0])onSelect(noEtaOps[0]);}}/>
      <AttCard n={unpaidClosedOps.length} label="Cobradas con saldo" color="#a78bfa" onClick={()=>{if(unpaidClosedOps[0])onSelect(unpaidClosedOps[0]);}}/>
    </div>}
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{flex:1,minWidth:200}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por código, cliente o descripción..." style={{width:"100%",padding:"10px 14px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/></div>
      <div style={{position:"relative"}}><button onClick={()=>setShowStatusDrop(p=>!p)} style={{padding:"10px 14px",fontSize:12,border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",cursor:"pointer"}}>{fStatuses.length>0?`${fStatuses.length} estados`:"Todos los estados"} ▼</button>
        {showStatusDrop&&<div style={{position:"absolute",top:"100%",left:0,marginTop:4,background:"#142038",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:8,zIndex:10,minWidth:200}}>{STATUSES.map(s=><label key={s} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",cursor:"pointer",borderRadius:4}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}><input type="checkbox" checked={fStatuses.includes(s)} onChange={()=>toggleStatus(s)}/><span style={{fontSize:12,color:SM[s].c,fontWeight:600}}>{SM[s].l}</span></label>)}<div style={{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:4}}><button onClick={()=>{setFStatuses([]);setShowStatusDrop(false);}} style={{fontSize:11,color:IC,background:"none",border:"none",cursor:"pointer",padding:"4px 8px"}}>Limpiar filtros</button></div></div>}
      </div>
      <select value={fChannel} onChange={e=>setFChannel(e.target.value)} style={{padding:"10px 14px",fontSize:12,border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}><option value="" style={{background:"#142038"}}>Todos los canales</option>{CHANNELS.map(c=><option key={c} value={c} style={{background:"#142038"}}>{CM[c]}</option>)}</select>
      {sortCol!=="smart"&&<button onClick={()=>{setSortCol("smart");setSortDir("asc");}} style={{padding:"10px 14px",fontSize:11,fontWeight:600,border:"1.5px solid rgba(251,191,36,0.3)",borderRadius:8,background:"rgba(251,191,36,0.1)",color:"#fbbf24",cursor:"pointer"}}>↻ Restaurar orden</button>}
    </div>
    {lo?<SkeletonTable rows={10} cols={7}/>:(()=>{
    const active=sorted.filter(o=>o.status!=="operacion_cerrada"&&o.status!=="cancelada");
    const closed=sorted.filter(o=>o.status==="operacion_cerrada"||o.status==="cancelada").sort((a,b)=>{const da=String(a.collection_date||a.closed_at||"").slice(0,10);const db=String(b.collection_date||b.closed_at||"").slice(0,10);return db.localeCompare(da);});
    const totalGanancia=closed.reduce((s,o)=>s+calcGan(o),0);
    const renderTable=(rows,showGanancia)=><div style={{background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.25)"}}>
          <th style={{padding:"14px 12px",width:36}}><input type="checkbox" checked={rows.length>0&&rows.every(o=>selectedIds.has(o.id))} onChange={()=>{if(rows.every(o=>selectedIds.has(o.id))){setSelectedIds(p=>{const n=new Set(p);rows.forEach(o=>n.delete(o.id));return n;});}else{setSelectedIds(p=>{const n=new Set(p);rows.forEach(o=>n.add(o.id));return n;});}}} title="Seleccionar todas las visibles" style={{cursor:"pointer",accentColor:GOLD}}/></th>
          <SH label="Código" col="operation_code"/><SH label="Cliente" col="client"/><SH label="Descripción" col="description"/><SH label="Canal" col="channel"/><SH label="Estado" col="status"/>{showGanancia?<SH label="Cobrada" col="collection_date"/>:<><SH label="ETA" col="eta"/><SH label="Saldo" col="saldo"/></>}{showGanancia&&<SH label="Ganancia" col="ganancia"/>}
        </tr></thead>
        <tbody>{rows.map(op=>{const st=SM[op.status]||{l:op.status,c:"#999"};const cn=op.clients?`${op.clients.first_name} ${op.clients.last_name}`:"—";const gan=calcGan(op);const saldo=showGanancia?null:calcSaldo(op);const isSel=selectedIds.has(op.id);
        return <tr key={op.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",transition:"background 120ms",background:isSel?"rgba(184,149,106,0.08)":"transparent"}} onClick={()=>onSelect(op)} onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="rgba(184,149,106,0.05)";}} onMouseLeave={e=>{e.currentTarget.style.background=isSel?"rgba(184,149,106,0.08)":"transparent";}}>
          <td style={{padding:"14px 12px",width:36}} onClick={e=>{e.stopPropagation();toggleSelected(op.id);}}><input type="checkbox" checked={isSel} onChange={()=>{}} style={{cursor:"pointer",accentColor:GOLD}}/></td>
          <td style={{padding:"14px 16px",fontFamily:"'JetBrains Mono','SF Mono',monospace",fontWeight:600,color:"#fff",whiteSpace:"nowrap",fontSize:12.5,letterSpacing:"0.04em"}}>{op.operation_code}{op.service_type==="gestion_integral"&&<span title="Gestión Integral" style={{marginLeft:8,fontSize:9.5,fontWeight:800,padding:"3px 9px",borderRadius:6,background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.12em",textTransform:"uppercase",border:`1.5px solid ${GOLD_DEEP}`,boxShadow:`${GOLD_GLOW}, inset 0 1px 0 rgba(255,255,255,0.4)`,animation:"acGiPulse 2.4s ease-in-out infinite",fontFamily:"'Inter','Segoe UI',sans-serif",verticalAlign:"middle"}}>GI</span>}</td>
          <td style={{padding:"14px 16px",color:"rgba(255,255,255,0.78)",whiteSpace:"nowrap",fontSize:13}}>{cn}</td>
          <td style={{padding:"14px 16px",color:"rgba(255,255,255,0.5)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:12.5}}>{op.description||"—"}</td>
          <td style={{padding:"14px 16px",whiteSpace:"nowrap"}}><span style={{fontSize:10.5,padding:"3px 9px",borderRadius:999,background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.6)",whiteSpace:"nowrap",border:"1px solid rgba(255,255,255,0.06)"}}>{CM[op.channel]||op.channel}</span></td>
          <td style={{padding:"14px 16px",whiteSpace:"nowrap"}}>{(()=>{const isActive=!["operacion_cerrada","cancelada"].includes(op.status);const limit=STALE_DAYS[op.status];const since=daysSince(op.updated_at||op.created_at);const isStale=limit&&since>=limit;return <span style={{display:"inline-flex",alignItems:"center",gap:5}}><span style={{fontSize:10,fontWeight:700,padding:"4px 10px 4px 8px",borderRadius:999,color:st.c,background:`${st.c}14`,border:`1px solid ${st.c}40`,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:6,letterSpacing:"0.05em",textTransform:"uppercase"}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:st.c,boxShadow:isActive?`0 0 8px ${st.c}`:"none"}}/>{st.l}</span>{isStale&&<span title={`Hace ${since} días en este estado`} style={{fontSize:9,fontWeight:700,padding:"3px 6px",borderRadius:4,background:"rgba(248,113,113,0.15)",color:"#f87171",border:"1px solid rgba(248,113,113,0.4)"}}>⚠ {since}d</span>}</span>;})()}</td>
          {showGanancia?<td style={{padding:"14px 16px",color:"rgba(255,255,255,0.5)",whiteSpace:"nowrap",fontSize:12.5}}>{formatDate(op.collection_date||op.closed_at)}</td>:<><td style={{padding:"14px 16px",color:"rgba(255,255,255,0.55)",whiteSpace:"nowrap",fontSize:12.5}}>{formatDate(op.eta)}</td><td style={{padding:"14px 16px",whiteSpace:"nowrap",fontSize:12.5,fontWeight:700,fontVariantNumeric:"tabular-nums",color:saldo===null?"rgba(255,255,255,0.35)":saldo===0?"#22c55e":GOLD_LIGHT}}>{saldo===null?<span style={{fontWeight:500}}>—</span>:saldo===0?"Cobrada":`USD ${saldo.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`}</td></>}
          {showGanancia&&<td style={{padding:"14px 16px",fontWeight:700,color:gan>0?"#22c55e":gan<0?"#ff6b6b":"rgba(255,255,255,0.4)",whiteSpace:"nowrap",fontSize:12.5,fontVariantNumeric:"tabular-nums"}}>{(()=>{
            const realIng=op.is_collected?Number(op.collected_amount||op.budget_total||0):Number(op.budget_total||0);
            const hasData=realIng>0||Number(op.cost_flete||0)+Number(op.cost_impuestos_reales||0)+Number(op.cost_gasto_documental||0)+Number(op.cost_seguro||0)+Number(op.cost_flete_local||0)+Number(op.cost_otros||0)>0;
            if(!hasData)return "—";
            const sign=gan<0?"-":"";
            return `${sign}USD ${Math.abs(gan).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
          })()}</td>}
        </tr>})}</tbody>
      </table>
      {rows.length===0&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.45)",padding:"2rem 0"}}>No hay operaciones</p>}
    </div>;
    // Paginación cerradas
    const totalPagesClosed=Math.max(1,Math.ceil(closed.length/CLOSED_PER_PAGE));
    const safePage=Math.min(pageClosed,totalPagesClosed);
    const closedPaged=closed.slice((safePage-1)*CLOSED_PER_PAGE,safePage*CLOSED_PER_PAGE);
    const renderPagination=()=>{if(totalPagesClosed<=1)return null;const pages=[];const maxVisible=7;let start=Math.max(1,safePage-3);let end=Math.min(totalPagesClosed,start+maxVisible-1);if(end-start<maxVisible-1)start=Math.max(1,end-maxVisible+1);for(let i=start;i<=end;i++)pages.push(i);const btnStyle=(active,disabled)=>({minWidth:32,height:32,padding:"0 10px",fontSize:12,fontWeight:active?700:500,borderRadius:8,border:`1px solid ${active?"rgba(184,149,106,0.55)":"rgba(255,255,255,0.08)"}`,background:active?"rgba(184,149,106,0.14)":"transparent",color:disabled?"rgba(255,255,255,0.2)":active?GOLD_LIGHT:"rgba(255,255,255,0.65)",cursor:disabled?"not-allowed":"pointer",transition:"all 150ms",display:"inline-flex",alignItems:"center",justifyContent:"center"});return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16,gap:12,flexWrap:"wrap"}}><span style={{fontSize:11,color:"rgba(255,255,255,0.45)",letterSpacing:"0.03em"}}>Mostrando {(safePage-1)*CLOSED_PER_PAGE+1}–{Math.min(safePage*CLOSED_PER_PAGE,closed.length)} de {closed.length}</span><div style={{display:"flex",gap:4,alignItems:"center"}}><button disabled={safePage===1} onClick={()=>setPageClosed(safePage-1)} style={btnStyle(false,safePage===1)}>←</button>{start>1&&<><button onClick={()=>setPageClosed(1)} style={btnStyle(false)}>1</button>{start>2&&<span style={{color:"rgba(255,255,255,0.3)",padding:"0 4px"}}>…</span>}</>}{pages.map(p=><button key={p} onClick={()=>setPageClosed(p)} style={btnStyle(p===safePage)}>{p}</button>)}{end<totalPagesClosed&&<>{end<totalPagesClosed-1&&<span style={{color:"rgba(255,255,255,0.3)",padding:"0 4px"}}>…</span>}<button onClick={()=>setPageClosed(totalPagesClosed)} style={btnStyle(false)}>{totalPagesClosed}</button></>}<button disabled={safePage===totalPagesClosed} onClick={()=>setPageClosed(safePage+1)} style={btnStyle(false,safePage===totalPagesClosed)}>→</button></div></div>;};
    return <>{active.length>0&&<><h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Operaciones activas <span style={{color:GOLD_LIGHT,marginLeft:4}}>({active.length})</span></h3>{renderTable(active,false)}</>}
    {closed.length>0&&<><h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"32px 0 14px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Operaciones cerradas <span style={{color:"rgba(255,255,255,0.55)",marginLeft:4}}>({closed.length})</span> {totalGanancia!==0&&<span style={{fontSize:12,fontWeight:700,color:totalGanancia>0?"#22c55e":"#ff6b6b",marginLeft:12,letterSpacing:"0.04em"}}>Ganancia total: USD {totalGanancia.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>}</h3>{renderTable(closedPaged,true)}{renderPagination()}</>}
    {active.length===0&&closed.length===0&&<EmptyState icon="box" title={search||fStatuses.length>0||fChannel?"Sin resultados":"No hay operaciones"} description={search||fStatuses.length>0||fChannel?"Ninguna operación coincide con los filtros activos.":"Creá tu primera operación para comenzar."} cta={search||fStatuses.length>0||fChannel?null:"+ Nueva operación"} ctaOnClick={search||fStatuses.length>0||fChannel?null:onNew}/>}</>;})()}

    {bulkAction&&<div onClick={()=>!bulkRunning&&setBulkAction(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:`1.5px solid ${bulkAction.action==="delete"?"rgba(255,80,80,0.5)":bulkAction.action==="markCollected"?"rgba(34,197,94,0.5)":"rgba(184,149,106,0.5)"}`,borderRadius:14,padding:"22px 24px",maxWidth:480,width:"100%"}}>
        <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 10px"}}>
          {bulkAction.action==="delete"?"⚠️ Eliminar operaciones":bulkAction.action==="markCollected"?"💰 Marcar como cobradas":`↻ Cambiar estado a "${SM[bulkAction.value]?.l||bulkAction.value}"`}
        </h3>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.7)",margin:"0 0 16px",lineHeight:1.5}}>Vas a {bulkAction.action==="delete"?<><strong style={{color:"#ff6b6b"}}>BORRAR</strong> permanentemente</>:bulkAction.action==="markCollected"?"marcar como cobradas con fecha de hoy":"cambiar el estado de"} <strong style={{color:GOLD_LIGHT}}>{selectedIds.size} operación{selectedIds.size>1?"es":""}</strong>.{bulkAction.action==="delete"?<><br/><br/>Esta acción <strong>no se puede deshacer</strong>. ¿Estás seguro?</>:""}</p>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>!bulkRunning&&setBulkAction(null)} disabled={bulkRunning} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:bulkRunning?"not-allowed":"pointer"}}>Cancelar</button>
          <button onClick={runBulk} disabled={bulkRunning} style={{padding:"9px 18px",fontSize:13,fontWeight:700,borderRadius:8,border:"none",background:bulkAction.action==="delete"?"linear-gradient(135deg,#ff6b6b,#ef4444)":bulkAction.action==="markCollected"?"linear-gradient(135deg,#22c55e,#16a34a)":GOLD_GRADIENT,color:bulkAction.action==="delete"||bulkAction.action==="markCollected"?"#fff":"#0A1628",cursor:bulkRunning?"wait":"pointer"}}>{bulkRunning?"Procesando…":"Sí, confirmar"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

function NewOperation({token,clients,onBack,onCreated}){
  const [form,setForm]=useState({client_id:"",channel:"aereo_blanco",origin:"China",service_type:"courier"});const [lo,setLo]=useState(false);const [err,setErr]=useState("");
  const ch=f=>v=>setForm(p=>({...p,[f]:v}));
  const create=async()=>{if(!form.client_id){setErr("Seleccioná un cliente");return;}setLo(true);setErr("");
    const existing=await dq("operations",{token,filters:"?select=operation_code&order=operation_code.asc"});const used=new Set((Array.isArray(existing)?existing:[]).map(e=>parseInt(e.operation_code.replace("AC-",""))));let num=1;while(used.has(num))num++;const code=`AC-${String(num).padStart(4,"0")}`;
    const r=await dq("operations",{method:"POST",token,body:{operation_code:code,client_id:form.client_id,channel:form.channel,origin:form.origin,service_type:form.service_type,status:"pendiente",created_by:null}});
    if(r?.error||r?.message){setErr(r.error||r.message);setLo(false);return;}setLo(false);onCreated(Array.isArray(r)?r[0]:r);};
  return <div>
    <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,0.55)",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontWeight:600,marginBottom:20,padding:"6px 12px",borderRadius:8,letterSpacing:"0.04em",transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.color=GOLD_LIGHT;e.currentTarget.style.borderColor="rgba(184,149,106,0.35)";}} onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,0.55)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}>← Volver</button>
    <h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 20px"}}>Nueva Operación</h2>
    <Card>
      <Sel label="Cliente" value={form.client_id} onChange={ch("client_id")} options={clients.map(c=>({value:c.id,label:`${c.client_code} — ${c.first_name} ${c.last_name}`}))} ph="Seleccionar cliente"/>
      <Sel label="Tipo de servicio" value={form.service_type} onChange={ch("service_type")} options={[{value:"courier",label:"Courier — cliente compra, nosotros despachamos"},{value:"gestion_integral",label:"Gestión Integral — nosotros compramos y vendemos puesto en Argentina"}]}/>
      <Sel label="Origen" value={form.origin} onChange={v=>{ch("origin")(v);if(v==="USA"&&(form.channel==="aereo_blanco"||form.channel==="maritimo_blanco"))ch("channel")("aereo_negro");}} options={[{value:"China",label:"China"},{value:"USA",label:"USA"}]}/>
      <Sel label="Canal" value={form.channel} onChange={ch("channel")} options={form.origin==="USA"?[{value:"aereo_negro",label:"Aéreo B"},{value:"maritimo_negro",label:"Marítimo B"}]:CHANNELS.map(c=>({value:c,label:CM[c]}))}/>
      {form.service_type==="gestion_integral"&&<div style={{background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:8,padding:"10px 12px",margin:"8px 0 12px",fontSize:12,color:"rgba(255,255,255,0.7)"}}>
        <b style={{color:"#c084fc"}}>Gestión Integral:</b> al cliente le cotizás un precio final puesto en Argentina (<code>budget_total</code>). Vos pagás al proveedor (<code>cost_producto_usd</code>) y asumís flete + impuestos. Ganancia = precio cliente − todos los costos. Lo configurás en el detalle de la op.
      </div>}
      {err&&<p style={{fontSize:12,color:"#ff6b6b",margin:"0 0 12px"}}>{err}</p>}
      <div style={{display:"flex",gap:12,marginTop:8}}><Btn onClick={create} disabled={lo}>{lo?"Creando...":"Crear operación"}</Btn><Btn variant="secondary" onClick={onBack}>Cancelar</Btn></div>
    </Card>
  </div>;
}

function OperationEditor({op:initOp,token,onBack,onDelete}){
  const [op,setOp]=useState(initOp);const [items,setItems]=useState([]);const [pkgs,setPkgs]=useState([]);const [events,setEvents]=useState([]);const [tariffs,setTariffs]=useState([]);const [config,setConfig]=useState({});const [opClient,setOpClient]=useState(null);const [clientOverrides,setClientOverrides]=useState([]);const [lo,setLo]=useState(true);const [saving,setSaving]=useState(false);const [msg,setMsg]=useState("");const [tab,setTab]=useState("general");const [ccBalance,setCcBalance]=useState(0);const [payments,setPayments]=useState([]);const [showNewPmt,setShowNewPmt]=useState(false);const [newPmt,setNewPmt]=useState({client_amount_usd:"",giro_amount_usd:"",cost_comision_giro:"",description:"",client_payment_method:"transferencia",giro_status:"pendiente"});  const [supplierPayments,setSupplierPayments]=useState([]);const [newSupPmt,setNewSupPmt]=useState({payment_date:new Date().toISOString().slice(0,10),amount_usd:"",payment_method:"transferencia",is_paid:true,notes:"",reference:"",currency:"USD",card_closing_date:"",type:"payment"});
  const [clientPayments,setClientPayments]=useState([]);const [newCliPmt,setNewCliPmt]=useState({payment_date:new Date().toISOString().slice(0,10),amount_usd:"",amount_ars:"",exchange_rate:"",currency:"USD",payment_method:"transferencia",notes:""});
  const [pendingRedemptions,setPendingRedemptions]=useState([]);
  const [cancelRedemptionTarget,setCancelRedemptionTarget]=useState(null);
  const [cancelingRedemption,setCancelingRedemption]=useState(false);
  const [showAddPayment,setShowAddPayment]=useState(false);
  const [savingAddPayment,setSavingAddPayment]=useState(false);
  const [addPaymentForm,setAddPaymentForm]=useState({amount_usd:"",amount_ars:"",exchange_rate:"",currency:"USD",payment_method:"transferencia",payment_date:new Date().toISOString().slice(0,10),notes:""});
  const submitAddPayment=async()=>{
    const amtUsd=Number(addPaymentForm.amount_usd);
    const amtArs=Number(addPaymentForm.amount_ars);
    const rate=Number(addPaymentForm.exchange_rate);
    let finalAmtUsd=amtUsd;
    if(addPaymentForm.currency==="ARS"){
      if(!amtArs||amtArs<=0||!rate||rate<=0){alert("Para pagos en ARS necesitás monto ARS y tipo de cambio");return;}
      finalAmtUsd=amtArs/rate;
    } else {
      if(!amtUsd||amtUsd<=0){alert("Ingresá el monto USD");return;}
    }
    if(!addPaymentForm.payment_date){alert("Cargá la fecha del cobro");return;}
    const budgetTot=Number(op.budget_total||0);
    setSavingAddPayment(true);
    try{
      const body={operation_id:op.id,payment_date:addPaymentForm.payment_date,amount_usd:finalAmtUsd,currency:addPaymentForm.currency,payment_method:addPaymentForm.payment_method,notes:addPaymentForm.notes||null};
      if(addPaymentForm.currency==="ARS"){body.amount_ars=amtArs;body.exchange_rate=rate;}
      await dq("operation_client_payments",{method:"POST",token,body});
      const prevTotal=clientPayments.reduce((s,p)=>s+Number(p.amount_usd||0),0);
      const newTotal=prevTotal+finalAmtUsd;
      const opUpdate={collected_amount:newTotal};
      if(budgetTot>0&&newTotal>=budgetTot-0.01){
        opUpdate.is_collected=true;
        opUpdate.collection_date=addPaymentForm.payment_date;
        opUpdate.collection_method=addPaymentForm.payment_method;
        opUpdate.collection_currency=addPaymentForm.currency;
        if(addPaymentForm.currency==="ARS")opUpdate.collection_exchange_rate=rate;
      }
      await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:opUpdate});
      setOp(p=>({...p,...opUpdate}));
      await load();
      setMsg(newTotal>=budgetTot?`✓ Cobro registrado · op cobrada (saldo $0)`:`✓ Cobro registrado · saldo USD ${(budgetTot-newTotal).toFixed(2)}`);
      setTimeout(()=>setMsg(""),4000);
      setShowAddPayment(false);
    }catch(e){alert("Error: "+e.message);}
    setSavingAddPayment(false);
  };
  const loadRedemptions=async()=>{if(!op.client_id)return;const r=await dq("client_reward_redemptions",{token,filters:`?client_id=eq.${op.client_id}&status=eq.pending&select=*&order=redeemed_at.asc`});setPendingRedemptions(Array.isArray(r)?r:[]);};
  const applyRedemption=async(red)=>{
    if(!confirm(`Aplicar "${red.reward_name}" a esta operación?\n\nSe va a descontar ${Number(red.value_usd||0).toFixed(2)} USD del flete y el canje quedará marcado como usado.`))return;
    const r=await dq("rpc/apply_redemption_to_op",{method:"POST",token,body:{p_redemption_id:red.id,p_op_id:op.id}});
    if(r?.ok){
      // Restar del budget_flete (y del total) si aplica
      if(red.reward_type==="flete_discount_usd"){
        const newFlete=Math.max(0,Number(op.budget_flete||0)-Number(red.value_usd||0));
        const newTotal=Math.max(0,Number(op.budget_total||0)-Number(red.value_usd||0));
        await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{budget_flete:newFlete,budget_total:newTotal}});
        setOp(p=>({...p,budget_flete:newFlete,budget_total:newTotal}));
      }
      flash(`✓ Canje aplicado: ${red.reward_name}`);
      loadRedemptions();
    } else flash(`❌ ${r?.error||"error"}`);
  };
  const cancelRedemption=(red)=>setCancelRedemptionTarget(red);
  const confirmCancelRedemption=async()=>{
    const red=cancelRedemptionTarget;if(!red)return;
    setCancelingRedemption(true);
    const r=await dq("rpc/cancel_redemption",{method:"POST",token,body:{p_redemption_id:red.id}});
    if(r?.ok){flash(`Canje cancelado — ${red.points_spent} pts devueltos al cliente`);loadRedemptions();}
    else flash(`❌ ${r?.error||"error"}`);
    setCancelingRedemption(false);setCancelRedemptionTarget(null);
  };
  useEffect(()=>{loadRedemptions();},[op.client_id]);
  // --- Reasignar cliente de la operación (caso: agente creó la op para el cliente equivocado) ---
  const [allClients,setAllClients]=useState([]);
  const [showReassign,setShowReassign]=useState(false);
  const [reassignToId,setReassignToId]=useState("");
  const [reassigning,setReassigning]=useState(false);
  const loadAllClients=async()=>{const r=await dq("clients",{token,filters:"?select=id,client_code,first_name,last_name&order=client_code.asc"});setAllClients(Array.isArray(r)?r:[]);};
  const openReassign=async()=>{if(allClients.length===0)await loadAllClients();setReassignToId("");setShowReassign(true);};
  const reassignClient=async()=>{
    if(!reassignToId||reassignToId===op.client_id){setShowReassign(false);return;}
    const newCl=allClients.find(c=>c.id===reassignToId);
    if(!newCl)return;
    const oldCl=opClient?`${opClient.client_code} — ${opClient.first_name} ${opClient.last_name}`:"(sin cliente)";
    const closedish=["en_transito","arribo_argentina","en_aduana","entregada","operacion_cerrada"].includes(op.status);
    const warn=closedish?"\n\n⚠ ATENCIÓN: la op ya está en/después de tránsito. Pueden quedar inconsistencias en cobranzas/cuenta corriente del cliente anterior. Revisá manualmente movimientos de cuenta y pagos.":"";
    if(!confirm(`¿Reasignar ${op.operation_code}?\n\nDe: ${oldCl}\nA: ${newCl.client_code} — ${newCl.first_name} ${newCl.last_name}${warn}`))return;
    setReassigning(true);
    await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{client_id:reassignToId}});
    // Refresh op + opClient
    const fresh=await dq("operations",{token,filters:`?id=eq.${op.id}&select=*,clients(first_name,last_name,client_code)`});
    if(Array.isArray(fresh)&&fresh[0])setOp(fresh[0]);
    const cl=await dq("clients",{token,filters:`?id=eq.${reassignToId}&select=*`});
    setOpClient(Array.isArray(cl)?cl[0]:null);
    setReassigning(false);setShowReassign(false);
    flash(`✓ Operación reasignada a ${newCl.client_code}`);
  };
  // --- Mover bulto a otra operación (caso: bulto cargado en op equivocada) ---
  const movePkgToOp=async(pkg)=>{
    const code=prompt(`Mover bulto #${pkg.package_number} a otra operación.\n\nIngresá el código de la op destino (ej: AC-0123):`);
    if(!code)return;
    const target=await dq("operations",{token,filters:`?operation_code=eq.${code.trim().toUpperCase()}&select=id,operation_code,status,client_id,clients(client_code,first_name,last_name)`});
    const dest=Array.isArray(target)&&target[0];
    if(!dest){flash(`❌ No encontré operación ${code}`);return;}
    if(dest.id===op.id){flash("Esa es la misma operación");return;}
    if(["operacion_cerrada","cancelada"].includes(dest.status)){flash(`❌ Op destino está ${dest.status}`);return;}
    const destName=dest.clients?`${dest.clients.client_code} — ${dest.clients.first_name} ${dest.clients.last_name}`:"(sin cliente)";
    if(!confirm(`Mover bulto #${pkg.package_number} de ${op.operation_code} a ${dest.operation_code}?\n\nCliente destino: ${destName}\n\nEl bulto se renumerará en la op destino. Se recalcula presupuesto en ambas.`))return;
    // Asignar nuevo package_number en destino
    const destPkgs=await dq("operation_packages",{token,filters:`?operation_id=eq.${dest.id}&select=package_number`});
    const maxNum=Array.isArray(destPkgs)&&destPkgs.length>0?Math.max(...destPkgs.map(p=>Number(p.package_number||0))):0;
    await dq("operation_packages",{method:"PATCH",token,filters:`?id=eq.${pkg.id}`,body:{operation_id:dest.id,package_number:maxNum+1}});
    await reloadPkgs();
    flash(`✓ Bulto movido a ${dest.operation_code}`);
    autoSyncBudget();
  };
  const loadCCBalance=async()=>{const mvs=await dq("supplier_account_movements",{token,filters:"?select=type,amount_usd"});if(Array.isArray(mvs)){const bal=mvs.reduce((s,m)=>s+(m.type==="anticipo"?Number(m.amount_usd):(-Number(m.amount_usd))),0);setCcBalance(bal);}};
  // Divisor volumétrico del agente que creó la op (default 5000 si no hay agente o no está set)
  const [agentVolDiv,setAgentVolDiv]=useState(5000);
  useEffect(()=>{(async()=>{if(!op.created_by_agent_id){setAgentVolDiv(5000);return;}const r=await dq("agent_signups",{token,filters:`?auth_user_id=eq.${op.created_by_agent_id}&select=volumetric_divisor`});const d=Array.isArray(r)&&r[0]?Number(r[0].volumetric_divisor):5000;setAgentVolDiv(d||5000);})();},[op.created_by_agent_id,token]);
  const load=async()=>{setLo(true);const [it,pk,ev,tf,cc]=await Promise.all([dq("operation_items",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`}),dq("operation_packages",{token,filters:`?operation_id=eq.${op.id}&select=*&order=package_number.asc`}),dq("tracking_events",{token,filters:`?operation_id=eq.${op.id}&select=*&order=occurred_at.desc`}),dq("tariffs",{token,filters:"?select=*&type=eq.rate&order=sort_order.asc"}),dq("calc_config",{token,filters:"?select=*"})]);setItems(Array.isArray(it)?it:[]);setPkgs(Array.isArray(pk)?pk:[]);setEvents(Array.isArray(ev)?ev:[]);setTariffs(Array.isArray(tf)?tf:[]);const cfg={};(Array.isArray(cc)?cc:[]).forEach(r=>{cfg[r.key]=Number(r.value);});setConfig(cfg);
    if(op.client_id){const cl=await dq("clients",{token,filters:`?id=eq.${op.client_id}&select=*`});setOpClient(Array.isArray(cl)?cl[0]:null);const ov=await dq("client_tariff_overrides",{token,filters:`?client_id=eq.${op.client_id}&select=*`});setClientOverrides(Array.isArray(ov)?ov:[]);}
    const pm=await dq("payment_management",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`});setPayments(Array.isArray(pm)?pm:[]);
    const sp=await dq("operation_supplier_payments",{token,filters:`?operation_id=eq.${op.id}&select=*&order=payment_date.asc`});setSupplierPayments(Array.isArray(sp)?sp:[]);
    const cp=await dq("operation_client_payments",{token,filters:`?operation_id=eq.${op.id}&select=*&order=payment_date.asc`});setClientPayments(Array.isArray(cp)?cp:[]);
    await loadCCBalance();setLo(false);};
  useEffect(()=>{load();let last=Date.now();const onFocus=()=>{if(document.visibilityState==="visible"&&Date.now()-last>5000){last=Date.now();load();}};document.addEventListener("visibilitychange",onFocus);window.addEventListener("focus",onFocus);return()=>{document.removeEventListener("visibilitychange",onFocus);window.removeEventListener("focus",onFocus);};},[op.id]);
  const flash=(m)=>{setMsg(m);setTimeout(()=>setMsg(""),2500);const v=/^[❌✕]|falló|error/i.test(m)?"error":/^⚠/.test(m)?"warn":"success";toast(m.replace(/^[✓✉️❌⚠️✕★📧⭐]\s*/u,""),v);};
  const deleteOp=async()=>{if(!confirm(`¿Eliminar operación ${op.operation_code}? Se borrarán también sus productos, bultos y eventos.`))return;
    await Promise.all([dq("operation_items",{method:"DELETE",token,filters:`?operation_id=eq.${op.id}`}),dq("operation_packages",{method:"DELETE",token,filters:`?operation_id=eq.${op.id}`}),dq("tracking_events",{method:"DELETE",token,filters:`?operation_id=eq.${op.id}`})]);
    await dq("operations",{method:"DELETE",token,filters:`?id=eq.${op.id}`});onDelete();};
  const isBlanco=op.channel?.includes("blanco");const isAereo=op.channel?.includes("aereo");const isMaritimo=op.channel?.includes("maritimo");

  const saveOp=async()=>{setSaving(true);const{id,clients,...rest}=op;delete rest.created_at;delete rest.updated_at;
    // En ops GI el budget_total lo maneja un trigger DB (sync_gi_budget_total = SUM items).
    // Si el state tiene un valor stale, lo sacamos del PATCH para no pisar al trigger.
    if(op.service_type==="gestion_integral"){delete rest.budget_total;}
    if((rest.status==="operacion_cerrada"||rest.status==="entregada")&&!rest.closed_at)rest.closed_at=new Date().toISOString();
    if(rest.status!=="operacion_cerrada"&&rest.status!=="entregada"&&rest.status!=="cancelada")rest.closed_at=null;
    await dq("operations",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});
    // Tier voucher: al pasar a "entregada" aplicamos auto el voucher pending (antes de que cobre el cliente)
    let tierVoucherMsg="";
    if(rest.status!==initOp.status&&rest.status==="entregada"&&!op.tier_discount_applied_usd){
      try{
        const vr=await dq("rpc/apply_tier_voucher_to_op",{method:"POST",token,body:{p_op_id:op.id}});
        if(vr?.applied){
          tierVoucherMsg=` · ★ Descuento ${String(vr.tier).toUpperCase()} aplicado: -USD ${Number(vr.discount_usd).toFixed(2)}`;
          // Refrescamos op en UI
          const fresh=await dq("operations",{token,filters:`?id=eq.${op.id}&select=*,clients(first_name,last_name,client_code)`});
          if(Array.isArray(fresh)&&fresh[0])setOp(fresh[0]);
        }
      }catch(e){console.error("tier voucher error",e);}
    }
    // Notification #6: notify client when operation status changes
    if(rest.status!==initOp.status&&op.client_id){try{const cls=await dq("clients",{token,filters:`?id=eq.${op.client_id}&select=auth_user_id`});const uid=Array.isArray(cls)&&cls[0]?cls[0].auth_user_id:null;if(uid){await dq("notifications",{method:"POST",token,body:{user_id:uid,portal:"cliente",title:`Estado actualizado: ${SM[rest.status]?.l||rest.status}`,body:`Operación ${op.operation_code}`,link:`?op=${op.operation_code}`}});}}catch(e){console.error("notif error",e);}}
    // Email automático según trigger (deposito / arribo / cerrada)
    if(rest.status!==initOp.status){
      const triggerMap={en_deposito_origen:"deposito",arribo_argentina:"arribo",operacion_cerrada:"cerrada"};
      const trigger=triggerMap[rest.status];
      if(trigger){try{const r=await fetch("/api/notify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({op_id:op.id,trigger})});const resp=await r.json();if(resp?.ok)flash(`✉️ Email ${trigger} enviado al cliente`);else if(resp?.skipped==="already_sent"){/* silencioso: el mail ya fue enviado antes */}else if(resp?.skipped)flash(`⚠️ Email ${trigger} NO enviado: ${resp.skipped}`);else{console.error("email error",resp);flash(`❌ Email ${trigger} falló: ${resp?.error||"ver consola"}`);}}catch(e){console.error("email error",e);flash(`❌ Email ${trigger} falló: ${e.message}`);}}
    }
    setOp(p=>({...p,closed_at:rest.closed_at}));flash("Operación guardada"+tierVoucherMsg);setSaving(false);
    // Auto-sync del presupuesto después de cualquier save (por si cambiaron flags que afectan el cálculo: has_phones, has_battery, channel, etc.)
    autoSyncBudget();
  };

  // Auto-sync: refresca items+bultos+tarifas+overrides+cliente de DB y recalcula+guarda presupuesto silenciosamente.
  // Se llama después de cualquier CRUD de items/bultos. Saltea ops cerradas/canceladas.
  const autoSyncBudget=async()=>{
    if(op.status==="operacion_cerrada"||op.status==="cancelada")return;
    try{
      // Refetch TODO fresco para evitar closures stale de tariffs/overrides (puede haber cambiado desde que se cargó la op).
      const[fit,fpk,ft,fov,fcl,fop]=await Promise.all([
        dq("operation_items",{token,filters:`?operation_id=eq.${op.id}&select=*`}),
        dq("operation_packages",{token,filters:`?operation_id=eq.${op.id}&select=*`}),
        dq("tariffs",{token,filters:"?select=*&type=eq.rate"}),
        op.client_id?dq("client_tariff_overrides",{token,filters:`?client_id=eq.${op.client_id}&select=*`}):Promise.resolve([]),
        op.client_id?dq("clients",{token,filters:`?id=eq.${op.client_id}&select=tax_condition`}):Promise.resolve([]),
        dq("operations",{token,filters:`?id=eq.${op.id}&select=channel,origin,has_phones,has_battery,shipping_to_door,shipping_cost,status`})
      ]);
      const its=Array.isArray(fit)?fit:[];const pks=Array.isArray(fpk)?fpk:[];
      const tariffsFresh=Array.isArray(ft)?ft:[];
      const overridesFresh=Array.isArray(fov)?fov:[];
      const clientFresh=Array.isArray(fcl)?fcl[0]:null;
      const opFresh=Array.isArray(fop)?fop[0]:null;
      // Mergeamos la op fresca (campos que afectan cálculo) sobre el op local
      const opForCalc={...op,...(opFresh||{})};
      const isBlanco=opForCalc.channel?.includes("blanco");
      if(isBlanco&&its.length===0)return;
      if(!isBlanco&&pks.length===0)return;
      const{totalTax,flete,seguro,totalAbonar,surcharge}=calcOpBudget(opForCalc,its,pks,tariffsFresh,config,overridesFresh,clientFresh);
      await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{budget_taxes:totalTax,budget_flete:flete,budget_seguro:seguro,budget_surcharge:surcharge||0,budget_total:totalAbonar}});
      setOp(p=>({...p,budget_taxes:totalTax,budget_flete:flete,budget_seguro:seguro,budget_surcharge:surcharge||0,budget_total:totalAbonar}));
    }catch(e){console.error("autoSync budget",e);}
  };
  const saveItem=async(it)=>{const{id,...rest}=it;delete rest.created_at;
    // Auto-clasificar NCM si tiene descripción pero no código
    if(rest.description&&!rest.ncm_code){
      try{const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:rest.description})});const d=await r.json();if(d?.ncm_code){rest.ncm_code=d.ncm_code;if(d.import_duty_rate&&!rest.import_duty_rate)rest.import_duty_rate=d.import_duty_rate;if(d.statistics_rate&&!rest.statistics_rate)rest.statistics_rate=d.statistics_rate;if(d.iva_rate&&!rest.iva_rate)rest.iva_rate=d.iva_rate;}}catch(e){}
    }
    await dq("operation_items",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});flash(rest.ncm_code?`Producto guardado · NCM ${rest.ncm_code}`:"Producto guardado");autoSyncBudget();await reloadItems();};
  const addItem=async()=>{await dq("operation_items",{method:"POST",token,body:{operation_id:op.id,description:"Nuevo producto",quantity:1,unit_price_usd:0}});await reloadItems();flash("Producto agregado");autoSyncBudget();};
  // Clasificar TODOS los items: si no tienen NCM → IA. Si tienen NCM pero no tasas → llenar tasas con IA. Si tienen todo → saltear.
  const [classifyingAll,setClassifyingAll]=useState(false);
  const autoClassifyAll=async()=>{
    // Items que necesitan algo: o no tienen NCM, o no tienen tasas
    const pending=items.filter(it=>it.description&&it.description.trim()&&(
      !it.ncm_code||it.import_duty_rate==null||it.import_duty_rate===""||it.statistics_rate==null||it.statistics_rate===""||it.iva_rate==null||it.iva_rate===""
    ));
    if(pending.length===0){flash("Todos los items ya tienen NCM y tasas");return;}
    setClassifyingAll(true);
    flash(`Clasificando ${pending.length} items con IA…`);
    const interventions=[];let ok=0;
    for(const it of pending){
      try{
        const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:it.description})});
        const d=await r.json();
        if(d?.ncm_code){
          // Si el item ya tiene NCM cargado a mano (no vacío), respetarlo y solo llenar tasas
          const finalNcm=it.ncm_code&&it.ncm_code.trim()?it.ncm_code:d.ncm_code;
          // ⚠ NO usar `||` con valores numéricos: 0 es falsy y se sobrescribiría con 35.
          // Para NCMs como 8517.62.72 (smartwatch), DIE legítimo = 0%.
          const numOr=(...vals)=>{for(const v of vals){if(v!=null&&v!=="")return Number(v);}return 0;};
          await dq("operation_items",{method:"PATCH",token,filters:`?id=eq.${it.id}`,body:{
            ncm_code:finalNcm,
            import_duty_rate:numOr(d.import_duty_rate,it.import_duty_rate),
            statistics_rate:numOr(d.statistics_rate,it.statistics_rate),
            iva_rate:numOr(d.iva_rate,it.iva_rate)||21,
          }});
          ok++;
          if(d.intervention?.required)interventions.push(`${it.description.slice(0,30)}: ${d.intervention.types.join("/")}`);
        }
      }catch(e){console.error("classify error",e);}
    }
    await reloadItems();
    autoSyncBudget();
    setClassifyingAll(false);
    if(interventions.length>0){
      flash(`✨ ${ok}/${pending.length} clasificados · ⚠ ${interventions.length} con intervención: ${interventions.join(" | ")}`);
    } else {
      flash(`✨ ${ok}/${pending.length} clasificados · DIE/TE/IVA + presupuesto rellenados`);
    }
  };
  // Clasificar UN item con preview interactivo (admin ve resultado antes de aplicar)
  const [classifying,setClassifying]=useState(null);   // it.id en curso
  const [ncmPreview,setNcmPreview]=useState({});       // {itemId: {ncm_code,duty,stats,iva,reasoning}}
  const classifyOne=async(it)=>{
    if(!it.description||!it.description.trim()){flash("Cargá descripción primero");return;}
    setClassifying(it.id);
    try{
      const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:it.description})});
      const d=await r.json();
      if(d?.ncm_code){
        // numOr no afecta cuando llega 0 explícito desde la API (DIE legítimo 0%)
        const _n=(v,fb)=>v!=null&&v!==""?Number(v):fb;
        setNcmPreview(p=>({...p,[it.id]:{ncm_code:d.ncm_code,import_duty_rate:_n(d.import_duty_rate,0),statistics_rate:_n(d.statistics_rate,0),iva_rate:_n(d.iva_rate,21),reasoning:d.reasoning||d.ncm_description||"",intervention:d.intervention||{required:false,types:[],reason:null}}}));
      } else flash("❌ La IA no pudo clasificar — cargá manual");
    }catch(e){flash(`❌ ${e.message}`);}
    setClassifying(null);
  };
  const applyClassification=async(it)=>{
    const p=ncmPreview[it.id];if(!p)return;
    await dq("operation_items",{method:"PATCH",token,filters:`?id=eq.${it.id}`,body:{ncm_code:p.ncm_code,import_duty_rate:p.import_duty_rate,statistics_rate:p.statistics_rate,iva_rate:p.iva_rate}});
    setNcmPreview(prev=>{const n={...prev};delete n[it.id];return n;});
    await reloadItems();
    autoSyncBudget();
    flash(`✓ ${p.ncm_code} aplicado · presupuesto sincronizado`);
  };
  const delItem=async(id)=>{await dq("operation_items",{method:"DELETE",token,filters:`?id=eq.${id}`});await reloadItems();flash("Producto eliminado");autoSyncBudget();};

  const reloadPkgs=async()=>{const pk=await dq("operation_packages",{token,filters:`?operation_id=eq.${op.id}&select=*&order=package_number.asc`});setPkgs(Array.isArray(pk)?pk:[]);};
  const reloadItems=async()=>{const it=await dq("operation_items",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`});setItems(Array.isArray(it)?it:[]);};
  const reloadEvents=async()=>{const ev=await dq("tracking_events",{token,filters:`?operation_id=eq.${op.id}&select=*&order=occurred_at.desc`});setEvents(Array.isArray(ev)?ev:[]);};

  const savePkg=async(pk)=>{const{id,...rest}=pk;delete rest.created_at;await dq("operation_packages",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});flash("Bulto guardado");autoSyncBudget();};
  const addPkg=async()=>{const num=pkgs.length+1;await dq("operation_packages",{method:"POST",token,body:{operation_id:op.id,package_number:num,quantity:1}});await reloadPkgs();flash("Bulto agregado");autoSyncBudget();};
  const delPkg=async(id)=>{await dq("operation_packages",{method:"DELETE",token,filters:`?id=eq.${id}`});await reloadPkgs();flash("Bulto eliminado");autoSyncBudget();};

  const saveEvt=async(ev)=>{const{id,...rest}=ev;delete rest.created_at;await dq("tracking_events",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});flash("Evento guardado");};
  const addEvt=async()=>{await dq("tracking_events",{method:"POST",token,body:{operation_id:op.id,title:"Nuevo evento",occurred_at:new Date().toISOString(),is_visible_to_client:true,created_by:null}});await reloadEvents();flash("Evento agregado");};
  const delEvt=async(id)=>{await dq("tracking_events",{method:"DELETE",token,filters:`?id=eq.${id}`});await reloadEvents();flash("Evento eliminado");};

  const isCanalB=op.channel?.includes("negro");
  const isGI=op.service_type==="gestion_integral";
  // Para GI armamos un set de tabs distinto: Productos + Costos (ledger) reemplazan Presupuesto + Pagos.
  // Tracking y Bultos quedan porque siguen teniendo sentido para el seguimiento.
  const tabs=isGI?[
    {k:"general",l:"General"},
    {k:"items",l:"Productos"},
    {k:"gi_costs",l:"Costos"},
    {k:"tracking",l:"Seguimiento"},
    {k:"finance",l:"Finanzas"},
    {k:"comms",l:"Comunicaciones"}
  ]:[
    {k:"general",l:"General"},
    {k:"budget",l:"Presupuesto"},
    ...(isCanalB?[]:[{k:"items",l:"Productos"}]),
    {k:"packages",l:"Bultos"},
    ...(isCanalB?[]:[{k:"tracking",l:"Seguimiento"}]),
    {k:"payments",l:"Pagos"},
    {k:"finance",l:"Finanzas"},
    {k:"comms",l:"Comunicaciones"}
  ];
  const chOp=f=>v=>setOp(p=>({...p,[f]:v}));
  // Checklist de cierre — modal cuando se intenta cerrar la op
  const [showCloseChecklist,setShowCloseChecklist]=useState(false);
  // Reempaque pendiente
  const [repackReq,setRepackReq]=useState(null);
  useEffect(()=>{(async()=>{const r=await dq("repack_requests",{token,filters:`?operation_id=eq.${op.id}&order=requested_at.desc&limit=1`});if(Array.isArray(r)&&r[0])setRepackReq(r[0]);else setRepackReq(null);})();},[op.id,token]);
  const requestRepack=async()=>{
    const reason=prompt("Motivo del pedido de reempaque (opcional):\n\nEj: 'Reempaquetar para reducir volumétrico, intentar bajar de 50kg a 35kg'","");
    if(reason===null)return;
    // Calcular peso facturable actual usando divisor del agente
    const billable=pkgs.reduce((s,p)=>{const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);const b=gw*q;const v=l&&w&&h?((l*w*h)/agentVolDiv)*q:0;return s+Math.max(b,v);},0);
    const r=await dq("repack_requests",{method:"POST",token,body:{operation_id:op.id,status:"pending",reason:reason||null,original_billable_kg:Number(billable.toFixed(2)),original_pkg_count:pkgs.length}});
    setRepackReq(Array.isArray(r)?r[0]:r);
    // Auto-log en comms
    try{await dq("op_communications",{method:"POST",token,body:{operation_id:op.id,type:"note",content:`🔄 Pedido de reempaque al agente.\nPeso facturable actual: ${billable.toFixed(2)} kg (${pkgs.length} bultos)${reason?`\nMotivo: ${reason}`:""}`}});}catch(e){}
    // Push al agente
    if(op.created_by_agent_id){try{fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:op.created_by_agent_id,title:`🔄 Pedido de reempaque ${op.operation_code}`,body:reason||`Reempaquetar para bajar volumétrico (${billable.toFixed(1)} kg)`,url:`/agente?tab=deposit`})});}catch(e){}}
    flash("✅ Pedido de reempaque enviado al agente");
  };
  const cancelRepack=async()=>{if(!repackReq||!confirm("¿Cancelar el pedido de reempaque?"))return;await dq("repack_requests",{method:"PATCH",token,filters:`?id=eq.${repackReq.id}`,body:{status:"cancelled"}});setRepackReq(p=>({...p,status:"cancelled"}));flash("Pedido cancelado");};
  const executeSave=async()=>{
    let desc=op.description;
    if(!desc){const autoDesc=items.map(it=>it.description).filter(Boolean).join(", ");if(autoDesc){desc=autoDesc;setOp(p=>({...p,description:desc}));}}
    setSaving(true);
    const prevStatus=initOp.status;
    const{id,clients,...rest}=({...op,description:desc});
    delete rest.created_at;delete rest.updated_at;
    if((rest.status==="operacion_cerrada"||rest.status==="entregada")&&!rest.closed_at)rest.closed_at=new Date().toISOString();
    if(rest.status!=="operacion_cerrada"&&rest.status!=="entregada"&&rest.status!=="cancelada")rest.closed_at=null;
    await dq("operations",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});
    if(rest.status!==prevStatus){
      const triggerMap={en_deposito_origen:"deposito",arribo_argentina:"arribo",operacion_cerrada:"cerrada"};
      const trigger=triggerMap[rest.status];
      if(trigger){try{const r=await fetch("/api/notify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({op_id:op.id,trigger})});const resp=await r.json();if(resp?.ok)flash(`✉️ Email ${trigger} enviado al cliente`);else if(resp?.skipped==="already_sent"){}else if(resp?.skipped)flash(`⚠️ Email ${trigger} NO enviado: ${resp.skipped}`);else{console.error("email error",resp);flash(`❌ Email ${trigger} falló: ${resp?.error||"ver consola"}`);}}catch(e){console.error("email error",e);flash(`❌ Email ${trigger} falló: ${e.message}`);}}
    }else{flash("Operación guardada");}
    setSaving(false);
  };
  const handleSave=()=>{
    if(op.status==="operacion_cerrada"&&initOp.status!=="operacion_cerrada"){setShowCloseChecklist(true);return;}
    executeSave();
  };
  const chItem=(idx,f,v)=>{setItems(p=>{const n=[...p];n[idx]={...n[idx],[f]:v};return n;});};
  const chPkg=(idx,f,v)=>{setPkgs(p=>{const n=[...p];n[idx]={...n[idx],[f]:v};return n;});};
  const chEvt=(idx,f,v)=>{setEvents(p=>{const n=[...p];n[idx]={...n[idx],[f]:v};return n;});};

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,0.55)",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontWeight:600,padding:"6px 12px",borderRadius:8,letterSpacing:"0.04em",transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.color=GOLD_LIGHT;e.currentTarget.style.borderColor="rgba(184,149,106,0.35)";}} onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,0.55)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}>← Volver</button>
        <span style={{fontSize:18,fontWeight:700,color:"#fff",fontFamily:"'JetBrains Mono','SF Mono',monospace",letterSpacing:"0.04em"}}>{op.operation_code}</span>
        {op.service_type==="gestion_integral"&&<span title="Gestión Integral" style={{fontSize:11,fontWeight:800,padding:"6px 14px",borderRadius:8,background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.14em",textTransform:"uppercase",border:`1.5px solid ${GOLD_DEEP}`,boxShadow:`${GOLD_GLOW}, inset 0 1px 0 rgba(255,255,255,0.4)`,animation:"acGiPulse 2.4s ease-in-out infinite"}}>Gestión Integral</span>}
        {msg&&<span style={{fontSize:12,color:"#22c55e",fontWeight:600,animation:"ac_fade_in 200ms"}}>✓ {msg}</span>}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {!op.channel?.includes("negro")&&items.length>0&&<Btn onClick={()=>printSimplifiedDeclaration({op,items,pkgs,client:opClient})} variant="secondary" small title="Generar PDF visual de la destinación simplificada para mostrar al cliente">📋 DDJJ visual</Btn>}
        <Btn onClick={openReassign} variant="secondary" small>👤 Reasignar cliente</Btn>
        <Btn onClick={deleteOp} variant="danger" small>Eliminar operación</Btn>
      </div>
    </div>

    {/* Asistente "¿qué falta?" — checklist dinámica de bloqueos para que la op avance */}
    {(()=>{
      if(["operacion_cerrada","cancelada"].includes(op.status))return null;
      const issues=[];
      const isB=op.channel?.includes("negro");
      const isAereo=op.channel?.includes("aereo");
      // Items declarados (canal A blanco aéreo: requeridos para avanzar a tránsito)
      if(!isB&&op.channel==="aereo_blanco"&&items.length===0&&op.status==="en_preparacion")issues.push({txt:"Cliente debe declarar productos antes de avanzar",action:"Ir a tab Productos",tab:"items",priority:"high"});
      // Bultos (todas las ops aéreas requieren peso al menos)
      if(isAereo&&pkgs.length===0&&!["pendiente","cancelada"].includes(op.status))issues.push({txt:"Cargar bultos con peso/dimensiones",action:"Ir a tab Bultos",tab:"packages",priority:"high"});
      // Presupuesto sin cargar
      if(Number(op.budget_total||0)<=0&&!["pendiente","cancelada"].includes(op.status))issues.push({txt:"Falta cargar/sincronizar presupuesto",action:"Ir a tab Presupuesto",tab:"budget",priority:"high"});
      // Tracking internacional cuando ya está en tránsito
      if(["en_transito","arribo_argentina"].includes(op.status)&&!op.international_tracking)issues.push({txt:"Falta tracking internacional + carrier",action:"Ir a tab General",tab:"general",priority:"medium"});
      // ETA sin definir
      if(["en_transito","arribo_argentina"].includes(op.status)&&!op.eta)issues.push({txt:"Falta ETA estimada",action:"Ir a tab General",tab:"general",priority:"medium"});
      // Cobranza pendiente cuando ya entregada
      if(op.status==="entregada"&&!op.is_collected)issues.push({txt:"Cobrar al cliente para cerrar la operación",action:"Ir a tab Finanzas",tab:"finance",priority:"high"});
      // Costos reales sin cargar (canal A formal)
      if(!isB&&op.is_collected&&Number(op.cost_flete||0)<=0)issues.push({txt:"Cargar costos reales para calcular ganancia",action:"Ir a tab Finanzas",tab:"finance",priority:"medium"});
      // Cliente no notificó arribo a depósito
      if(op.status==="en_deposito_origen"&&!op.consolidation_confirmed&&op.channel==="aereo_blanco")issues.push({txt:"Esperando que el cliente confirme '¿es el único paquete?'",action:"Esperar al cliente",tab:null,priority:"low"});
      // Documentos faltantes (canal A) — invoice presented
      if(!isB&&op.channel?.includes("aereo")&&op.status==="en_preparacion"&&items.length>0&&Number(op.budget_total||0)>0)issues.push({txt:"Op lista para despachar — armar vuelo desde Agentes",action:"Ir a Agentes y Vuelos",tab:null,priority:"medium"});
      if(issues.length===0)return null;
      const colors={high:{bg:"rgba(239,68,68,0.08)",border:"rgba(239,68,68,0.4)",fg:"#ef4444",icon:"⚠️"},medium:{bg:"rgba(251,191,36,0.08)",border:"rgba(251,191,36,0.4)",fg:"#fbbf24",icon:"📋"},low:{bg:"rgba(96,165,250,0.06)",border:"rgba(96,165,250,0.3)",fg:"#60a5fa",icon:"⏳"}};
      const sortedIssues=[...issues].sort((a,b)=>({high:0,medium:1,low:2})[a.priority]-({high:0,medium:1,low:2})[b.priority]);
      const top=sortedIssues[0];const c=colors[top.priority];
      return <div style={{marginBottom:16,padding:"14px 18px",background:`linear-gradient(90deg, ${c.bg}, ${c.bg.replace("0.08","0.02").replace("0.06","0.02")})`,border:`1.5px solid ${c.border}`,borderRadius:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:issues.length>1?10:0}}>
          <span style={{fontSize:18}}>{c.icon}</span>
          <div style={{flex:1}}>
            <p style={{fontSize:11,fontWeight:800,color:c.fg,margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.06em"}}>¿Qué falta para avanzar?</p>
            <p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}>{top.txt}</p>
          </div>
          {top.tab&&<button onClick={()=>setTab(top.tab)} style={{padding:"7px 14px",fontSize:11,fontWeight:700,borderRadius:7,border:`1px solid ${c.border}`,background:c.bg,color:c.fg,cursor:"pointer",whiteSpace:"nowrap"}}>{top.action}</button>}
        </div>
        {issues.length>1&&<div style={{paddingLeft:28,display:"flex",flexDirection:"column",gap:5,marginTop:6,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          {sortedIssues.slice(1).map((iss,i)=>{const c2=colors[iss.priority];return <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
            <span style={{color:c2.fg,fontSize:10}}>•</span>
            <span style={{color:"rgba(255,255,255,0.7)",flex:1}}>{iss.txt}</span>
            {iss.tab&&<button onClick={()=>setTab(iss.tab)} style={{fontSize:10,fontWeight:600,color:c2.fg,background:"transparent",border:"none",cursor:"pointer",textDecoration:"underline"}}>{iss.action}</button>}
          </div>;})}
        </div>}
      </div>;
    })()}

    {showReassign&&<div style={{marginBottom:16,padding:"14px 16px",background:"rgba(184,149,106,0.06)",border:"1.5px solid rgba(184,149,106,0.25)",borderRadius:10}}>
      <p style={{fontSize:12,fontWeight:700,color:IC,margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Reasignar cliente</p>
      <p style={{fontSize:12,color:"rgba(255,255,255,0.6)",margin:"0 0 10px"}}>Cliente actual: <strong style={{color:"#fff"}}>{opClient?`${opClient.client_code} — ${opClient.first_name} ${opClient.last_name}`:"(sin cliente)"}</strong></p>
      <div style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:240}}>
          <Sel label="Nuevo cliente" value={reassignToId} onChange={setReassignToId} options={allClients.filter(c=>c.id!==op.client_id).map(c=>({value:c.id,label:`${c.client_code} — ${c.first_name} ${c.last_name}`}))} ph="Seleccionar cliente"/>
        </div>
        <Btn small onClick={reassignClient} disabled={!reassignToId||reassigning}>{reassigning?"Reasignando…":"Confirmar"}</Btn>
        <Btn small variant="secondary" onClick={()=>setShowReassign(false)} disabled={reassigning}>Cancelar</Btn>
      </div>
    </div>}
    <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid rgba(255,255,255,0.06)",flexWrap:"wrap"}}>{tabs.map(t=>{const active=tab===t.k;return <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"10px 16px",fontSize:12,fontWeight:active?700:600,border:"none",background:"transparent",color:active?GOLD_LIGHT:"rgba(255,255,255,0.5)",cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase",borderBottom:`2px solid ${active?GOLD:"transparent"}`,marginBottom:-1,transition:"all 150ms"}} onMouseEnter={e=>{if(!active)e.currentTarget.style.color="rgba(255,255,255,0.8)";}} onMouseLeave={e=>{if(!active)e.currentTarget.style.color="rgba(255,255,255,0.5)";}}>{t.l}</button>;})}</div>
    {repackReq&&repackReq.status==="pending"&&<div style={{marginBottom:16,padding:"12px 16px",background:"linear-gradient(135deg,rgba(251,191,36,0.12),rgba(251,191,36,0.04))",border:"1.5px solid rgba(251,191,36,0.4)",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:200}}>
        <p style={{fontSize:12,fontWeight:700,color:"#fbbf24",margin:0}}>⏳ Reempaque pendiente — el agente todavía no completó</p>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.55)",margin:"3px 0 0"}}>Pedido el {new Date(repackReq.requested_at).toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})} · Peso original: {Number(repackReq.original_billable_kg||0).toFixed(2)} kg ({repackReq.original_pkg_count} bultos){repackReq.reason?` · "${repackReq.reason}"`:""}</p>
      </div>
      <Btn small variant="secondary" onClick={cancelRepack}>Cancelar pedido</Btn>
    </div>}
    {repackReq&&repackReq.status==="done"&&(()=>{const before=Number(repackReq.original_billable_kg||0);const after=Number(repackReq.new_billable_kg||0);const delta=before-after;const pct=before>0?(delta/before*100):0;return <div style={{marginBottom:16,padding:"12px 16px",background:"linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.04))",border:"1.5px solid rgba(34,197,94,0.35)",borderRadius:10}}>
      <p style={{fontSize:12,fontWeight:700,color:"#22c55e",margin:0}}>✅ Reempaque completado por el agente</p>
      <p style={{fontSize:11,color:"rgba(255,255,255,0.65)",margin:"3px 0 0"}}>Peso facturable: <strong style={{color:"#fff"}}>{before.toFixed(2)} kg → {after.toFixed(2)} kg</strong>{delta>0&&<span style={{color:"#22c55e",marginLeft:6,fontWeight:700}}>(−{delta.toFixed(2)} kg / −{pct.toFixed(0)}%)</span>}{repackReq.agent_notes?` · ${repackReq.agent_notes}`:""}</p>
    </div>;})()}
    {pendingRedemptions.length>0&&<div style={{marginBottom:16,padding:"12px 16px",background:"linear-gradient(135deg,rgba(251,191,36,0.12),rgba(251,191,36,0.04))",border:"1.5px solid rgba(251,191,36,0.3)",borderRadius:10}}>
      <p style={{fontSize:12,fontWeight:700,color:"#fbbf24",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.05em"}}>⭐ Canje de puntos pendiente{pendingRedemptions.length>1?"s":""}</p>
      {pendingRedemptions.map(r=><div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 0",borderTop:"1px solid rgba(251,191,36,0.15)",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200}}><p style={{fontSize:13,fontWeight:700,color:"#fff",margin:0}}>{r.reward_name}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"2px 0 0"}}>Canjeado {new Date(r.redeemed_at).toLocaleDateString("es-AR",{day:"2-digit",month:"short"})} · {r.points_spent} pts · {Number(r.value_usd).toFixed(2)} USD</p></div>
        <div style={{display:"flex",gap:6}}><Btn small onClick={()=>applyRedemption(r)}>Aplicar a esta op</Btn><Btn small variant="danger" onClick={()=>cancelRedemption(r)}>Cancelar</Btn></div>
      </div>)}
    </div>}
    {lo?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"2rem 0"}}>Cargando...</p>:<>

    {tab==="general"&&<>
      <Card title="Estado" actions={<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{op.created_by_agent_id&&pkgs.length>0&&!["operacion_cerrada","cancelada","en_transito","arribo_argentina","en_aduana","entregada"].includes(op.status)&&(!repackReq||repackReq.status!=="pending")&&<Btn small variant="secondary" onClick={requestRepack}>🔄 Pedir reempaque</Btn>}{["en_preparacion","en_deposito_origen"].includes(op.status)&&items.length>0&&<Btn small variant="secondary" onClick={async()=>{if(!confirm("¿Reabrir la declaración? El cliente podrá modificar/agregar productos."))return;await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{status:"en_deposito_origen",consolidation_confirmed:false}});setOp(p=>({...p,status:"en_deposito_origen",consolidation_confirmed:false}));flash("✅ Declaración reabierta — el cliente puede editar");}}>↻ Reabrir declaración</Btn>}{(()=>{const tMap={en_deposito_origen:"deposito",arribo_argentina:"arribo",operacion_cerrada:"cerrada"};const tr=tMap[op.status];if(!tr)return null;const sent=op.sent_notifications?.[`email_${tr}`];return <Btn small variant="secondary" onClick={async()=>{if(!confirm(`¿Reenviar email "${tr}" al cliente?${sent?`\n\nYa se envió el ${new Date(sent).toLocaleString("es-AR")}.`:""}`))return;try{const r=await fetch("/api/notify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({op_id:op.id,trigger:tr,force:true})});const resp=await r.json();if(resp?.ok)flash(`✉️ Email ${tr} reenviado`);else flash(`❌ ${resp?.error||JSON.stringify(resp)}`);}catch(e){flash(`❌ ${e.message}`);}}}>{sent?"✉️ Reenviar email":"✉️ Enviar email"}</Btn>;})()}<Btn onClick={handleSave} disabled={saving} small>{saving?"Guardando...":"Guardar"}</Btn></div>}>
        <Sel label="Estado de la carga" value={op.status} onChange={chOp("status")} options={STATUSES.filter(s=>!(isGI&&s==="en_preparacion")).map(s=>({value:s,label:SM[s].l}))}/>
        <Inp label="Descripción" value={op.description||items.map(it=>it.description).filter(Boolean).join(", ")} onChange={chOp("description")}/>
        <Inp label="ETA (fecha estimada de arribo)" type="date" value={op.eta?String(op.eta).slice(0,10):""} onChange={chOp("eta")}/>
        <Inp label="Notas admin (interno)" value={op.admin_notes} onChange={chOp("admin_notes")} placeholder="Notas internas..."/>
        <div onClick={()=>chOp("skip_review_request")(!op.skip_review_request)} style={{padding:"12px 16px",background:op.skip_review_request?"rgba(251,146,60,0.08)":"rgba(255,255,255,0.03)",border:`1px solid ${op.skip_review_request?"rgba(251,146,60,0.3)":"rgba(255,255,255,0.06)"}`,borderRadius:10,marginTop:8,cursor:"pointer",display:"flex",alignItems:"center",gap:14,userSelect:"none",transition:"all 180ms"}}>
          <div style={{width:44,height:24,background:op.skip_review_request?"linear-gradient(135deg, #fb923c, #f97316)":"rgba(255,255,255,0.1)",borderRadius:999,position:"relative",transition:"all 200ms",boxShadow:op.skip_review_request?"0 0 10px rgba(251,146,60,0.35)":"",flexShrink:0}}>
            <div style={{position:"absolute",top:2,left:op.skip_review_request?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 220ms cubic-bezier(0.34,1.56,0.64,1)"}}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:13,fontWeight:op.skip_review_request?700:600,color:op.skip_review_request?"#fb923c":"rgba(255,255,255,0.6)",margin:0,letterSpacing:"0.02em"}}>No pedir reseña al cerrar esta op</p>
            {op.skip_review_request&&<p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"3px 0 0",lineHeight:1.4}}>Usar si la experiencia fue mala y no queremos incentivar una reseña pública.</p>}
          </div>
        </div>
        {op.channel==="aereo_blanco"&&!isGI&&<div style={{marginBottom:12}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.05em"}}>¿La carga contiene baterías internas?</p>
          <div style={{display:"flex",gap:10}}>{[{k:true,icon:"⚡",l:"Sí, tiene baterías",sub:"Recargo $2/kg"},{k:false,icon:"✓",l:"No tiene baterías",sub:"Producto estándar"}].map(o=><div key={String(o.k)} onClick={()=>chOp("has_battery")(o.k)} style={{flex:1,padding:"14px",textAlign:"center",borderRadius:12,border:`1.5px solid ${(op.has_battery||false)===o.k?"#fb923c":"rgba(255,255,255,0.08)"}`,background:(op.has_battery||false)===o.k?"rgba(251,146,60,0.1)":"rgba(255,255,255,0.03)",cursor:"pointer",transition:"all 0.15s"}}><p style={{fontSize:22,margin:"0 0 4px"}}>{o.icon}</p><p style={{fontSize:13,fontWeight:700,color:(op.has_battery||false)===o.k?"#fb923c":"rgba(255,255,255,0.55)",margin:"0 0 2px"}}>{o.l}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:0}}>{o.sub}</p></div>)}</div>
        </div>}
        {op.channel==="aereo_negro"&&op.origin==="USA"&&!isGI&&<div style={{marginBottom:12}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.05em"}}>¿La carga es de celulares?</p>
          <div style={{display:"flex",gap:10}}>{[{k:true,icon:"📱",l:"Sí, celulares",sub:"Tarifa $65/kg"},{k:false,icon:"📦",l:"Carga general",sub:"Tarifa estándar"}].map(o=><div key={String(o.k)} onClick={()=>chOp("has_phones")(o.k)} style={{flex:1,padding:"14px",textAlign:"center",borderRadius:12,border:`1.5px solid ${(op.has_phones||false)===o.k?IC:"rgba(255,255,255,0.08)"}`,background:(op.has_phones||false)===o.k?"rgba(184,149,106,0.1)":"rgba(255,255,255,0.03)",cursor:"pointer",transition:"all 0.15s"}}><p style={{fontSize:22,margin:"0 0 4px"}}>{o.icon}</p><p style={{fontSize:13,fontWeight:700,color:(op.has_phones||false)===o.k?IC:"rgba(255,255,255,0.55)",margin:"0 0 2px"}}>{o.l}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:0}}>{o.sub}</p></div>)}</div>
        </div>}
        {op.channel==="aereo_blanco"&&op.status==="en_deposito_origen"&&<div style={{padding:"12px 16px",background:op.consolidation_confirmed?"rgba(34,197,94,0.06)":"rgba(251,191,36,0.08)",border:`1px solid ${op.consolidation_confirmed?"rgba(34,197,94,0.2)":"rgba(251,191,36,0.25)"}`,borderRadius:10,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div><p style={{fontSize:12,fontWeight:700,color:op.consolidation_confirmed?"#22c55e":"#fbbf24",margin:"0 0 2px"}}>{op.consolidation_confirmed?"✓ Consolidación confirmada":"⏳ Esperando confirmación de consolidación"}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:0}}>{op.consolidation_confirmed?"El cliente confirmó que la carga está completa":"El cliente o vos deben confirmar que la carga está lista para enviar"}</p></div>
          {!op.consolidation_confirmed&&<Btn small onClick={async()=>{await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{consolidation_confirmed:true,consolidation_confirmed_at:new Date().toISOString()}});setOp(p=>({...p,consolidation_confirmed:true}));flash("Consolidación confirmada");}}>Marcar lista para enviar</Btn>}
        </div>}
      </Card>
      {!isGI&&<Card title="Resumen">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16}}>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>CANAL</p><p style={{fontSize:14,color:"#fff",margin:0}}>{CM[op.channel]||op.channel}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>ORIGEN</p><p style={{fontSize:14,color:"#fff",margin:0}}>{op.origin||"—"}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>PRODUCTOS</p><p style={{fontSize:14,color:"#fff",margin:0}}>{items.length}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>BULTOS</p><p style={{fontSize:14,color:"#fff",margin:0}}>{pkgs.length}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>VALOR FOB</p><p style={{fontSize:14,color:"#fff",margin:0}}>USD {items.reduce((s,it)=>s+Number(it.unit_price_usd||0)*Number(it.quantity||1),0).toLocaleString("en-US")}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>PESO BRUTO</p><p style={{fontSize:14,color:"#fff",margin:0}}>{pkgs.reduce((s,p)=>s+Number(p.gross_weight_kg||0)*Number(p.quantity||1),0).toFixed(1)} kg</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>CBM</p><p style={{fontSize:14,color:"#fff",margin:0}}>{pkgs.reduce((s,p)=>{const q=Number(p.quantity||1),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);return s+(l&&w&&h?((l*w*h)/1000000)*q:0);},0).toFixed(4)} m³</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>EVENTOS</p><p style={{fontSize:14,color:"#fff",margin:0}}>{events.length}</p></div>
        </div>
      </Card>}
      {(()=>{
        // Timeline enriquecido: status changes + emails enviados + eventos del courier
        const fmtDt=d=>{try{return new Date(d).toLocaleString("es-AR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}catch{return d;}};
        const items=[];
        // 1. Cambios de status (tracking_events con source='internal')
        (events||[]).filter(e=>e.source==="internal"&&e.status_code).forEach(ev=>{
          const c=SM[ev.status_code]?.c||"#666";
          items.push({t:"status",at:ev.occurred_at,color:c,title:SM[ev.status_code]?.l||ev.status_code,kind:"Cambio de estado"});
        });
        // 2. Emails enviados (operations.sent_notifications JSON)
        const sn=op.sent_notifications||{};
        const emailLabels={email_deposito:"Email depósito enviado",email_arribo:"Email arribo enviado",email_cerrada:"Email cierre enviado",email_reminder_consolidation:"Recordatorio consolidación",email_reminder_docs:"Recordatorio documentación"};
        Object.entries(sn).forEach(([k,v])=>{
          if(!v)return;
          items.push({t:"email",at:v,color:"#22c55e",title:emailLabels[k]||k,kind:"Email"});
        });
        // 3. Eventos courier (tracking_events con source != internal)
        (events||[]).filter(e=>e.source&&e.source!=="internal").slice(0,20).forEach(ev=>{
          items.push({t:"tracking",at:ev.occurred_at,color:"#818cf8",title:ev.title||ev.description||ev.status_code||"Evento",kind:(ev.source||"courier").toUpperCase(),extra:ev.location});
        });
        // 4. Creación
        if(op.created_at)items.push({t:"created",at:op.created_at,color:GOLD_LIGHT,title:"Operación creada",kind:"Inicio"});
        // 5. Cobrada
        if(op.is_collected&&op.collection_date)items.push({t:"collected",at:op.collection_date,color:"#22c55e",title:`Cobrada · USD ${Number(op.collected_amount||op.budget_total||0).toFixed(2)}`,kind:"Cobro"});
        // 6. Descuento tier aplicado
        if(op.tier_discount_applied_usd>0)items.push({t:"discount",at:op.closed_at||op.updated_at,color:"#E8D098",title:`Descuento ${String(op.tier_discount_applied||"").toUpperCase()} aplicado · -USD ${Number(op.tier_discount_applied_usd).toFixed(2)}`,kind:"Beneficio"});

        items.sort((a,b)=>new Date(b.at)-new Date(a.at));
        if(items.length===0)return null;

        return <Card title="Historia">
          <div style={{position:"relative",paddingLeft:14}}>
            {/* Línea vertical */}
            <div style={{position:"absolute",left:5,top:6,bottom:6,width:1,background:"linear-gradient(180deg, rgba(184,149,106,0.3) 0%, rgba(255,255,255,0.05) 100%)"}}/>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {items.map((ev,i)=><div key={`${ev.t}-${i}-${ev.at}`} style={{display:"flex",gap:12,position:"relative"}}>
                {/* Dot */}
                <div style={{position:"absolute",left:-14,top:6,width:11,height:11,borderRadius:"50%",background:"#0F1E3D",border:`2px solid ${ev.color}`,boxShadow:`0 0 8px ${ev.color}60`}}/>
                <div style={{flex:1,minWidth:0,padding:"4px 0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:12.5,fontWeight:600,color:"#fff",letterSpacing:"-0.005em"}}>{ev.title}</span>
                    <span style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:"0.02em",whiteSpace:"nowrap"}}>{fmtDt(ev.at)}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2}}>
                    <span style={{fontSize:9.5,fontWeight:700,padding:"2px 7px",borderRadius:999,background:`${ev.color}18`,color:ev.color,border:`1px solid ${ev.color}35`,letterSpacing:"0.06em",textTransform:"uppercase"}}>{ev.kind}</span>
                    {ev.extra&&<span style={{fontSize:10.5,color:"rgba(255,255,255,0.45)"}}>{ev.extra}</span>}
                  </div>
                </div>
              </div>)}
            </div>
          </div>
        </Card>;
      })()}
    </>}

    {tab==="budget"&&(()=>{
      const totalFob=items.reduce((s,it)=>s+Number(it.unit_price_usd||0)*Number(it.quantity||1),0);
      // Peso facturable (per-bulto max)
      let pf=0,totCBM=0,totGW=0;pkgs.forEach(p=>{const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);const b=gw*q;const v=l&&w&&h?((l*w*h)/5000)*q:0;pf+=Math.max(b,v);totGW+=b;totCBM+=l&&w&&h?((l*w*h)/1000000)*q:0;});
      // Solo operaciones cerradas (históricas) usan valores guardados
      // Usar presupuesto guardado si: (a) no hay productos cargados Y hay budget en DB, o (b) operación cerrada con budget
      const hasStoredBudget=Number(op.budget_total||0)>0&&(items.length===0||op.status==="operacion_cerrada");
      const isRI=opClient?.tax_condition==="responsable_inscripto";
      let totalTax,flete,seguro,totalAbonar,surcharge=0,surchargePct=0;
      if(hasStoredBudget){
        totalTax=Number(op.budget_taxes||0);flete=Number(op.budget_flete||0);seguro=Number(op.budget_seguro||0);surcharge=Number(op.budget_surcharge||0);
        const shipCost=op.shipping_to_door?Number(op.shipping_cost||0):0;
        totalAbonar=Number(op.budget_total||0);
      } else {
      // Flete (uses client custom rate if available)
      const isUSA=op.origin==="USA";
      // Si es aéreo B USA + celulares, usa service_key especial (configurable + overrideable por cliente)
      const isPhonesBUsaInline=op.channel==="aereo_negro"&&isUSA&&op.has_phones;
      const svcKey=isPhonesBUsaInline?"aereo_b_usa_celulares":(op.channel==="aereo_blanco"?"aereo_a_china":op.channel==="aereo_negro"?(isUSA?"aereo_b_usa":"aereo_b_china"):op.channel==="maritimo_blanco"?"maritimo_a_china":"maritimo_b");
      // Canal B aéreo (negro): cobra por peso BRUTO (totGW). Canal A aéreo: peso facturable (pf). Marítimo: CBM.
      const fleteAmt=op.channel?.includes("aereo")?(op.channel==="aereo_negro"?Math.max(totGW,1):pf):(op.channel==="maritimo_blanco"?Math.max(totCBM,1):totCBM);
      const getRate=(sk,amt)=>{const rates=tariffs.filter(t=>t.service_key===sk);for(const r of rates){const min=Number(r.min_qty||0),max=r.max_qty!=null?Number(r.max_qty):Infinity;if(amt>=min&&amt<max){const ov=clientOverrides.find(o=>o.tariff_id===r.id);return ov?Number(ov.custom_rate):Number(r.rate);}}return rates.length?Number(rates[rates.length-1].rate):0;};
      // Tarifa: toma del service_key calculado arriba (incluye aereo_b_usa_celulares si aplica).
      const fleteRate=getRate(svcKey,fleteAmt);flete=fleteAmt*fleteRate;
      // Recargo baterías solo en aéreo A (Courier Comercial) - $2 por kg
      if(op.channel==="aereo_blanco"&&op.has_battery)flete+=fleteAmt*2;
      // CIF: RI sees real, others see ficticio. Marítimo always ficticio.
      const isAereoOp=op.channel?.includes("aereo");
      const certFlRate=isAereoOp?(isRI?(config.cert_flete_aereo_real||2.5):(config.cert_flete_aereo_ficticio||3.5)):(config.cert_flete_maritimo_ficticio||100);
      const certFlAmt=isAereoOp?(isRI?totGW*certFlRate:pf*certFlRate):totCBM*certFlRate;
      seguro=(totalFob+certFlAmt)*0.01;const cif=totalFob+certFlAmt+seguro;
      // Impuestos per-item sobre CIF proporcional
      const getDesembolso=(c)=>{const t=[[5,0],[9,36],[20,50],[50,58],[100,65],[400,72],[800,84],[1000,96],[Infinity,120]];for(const[max,amt]of t)if(c<max)return amt;return 120;};
      totalTax=0;
      if(isBlanco){items.forEach(it=>{const itemFob=Number(it.unit_price_usd||0)*Number(it.quantity||1);const pct=totalFob>0?itemFob/totalFob:1;
        const iCert=certFlAmt*pct;const iSeg=(itemFob+iCert)*0.01;const iCif=itemFob+iCert+iSeg;
        const dr=Number(it.import_duty_rate||0)/100;const te=Number(it.statistics_rate||0)/100;const ivaR=Number(it.iva_rate||21)/100;
        const die=iCif*dr;const tasa=iCif*te;const bi=iCif+die+tasa;const iva=bi*ivaR;
        let t=die+tasa+iva;
        if(isMaritimo){const ivaAdicR=Number(it.iva_additional_rate||20)/100;const iiggR=Number(it.iigg_rate||6)/100;const iibbR=Number(it.iibb_rate||5)/100;t+=bi*ivaAdicR+bi*iiggR+bi*iibbR;}
        else{const desemb=getDesembolso(cif)*pct;t+=desemb+desemb*0.21;}
        totalTax+=t;});}
      const shipCost=op.shipping_to_door?Number(op.shipping_cost||0):0;
      // Recargo por valor mercadería (solo canal B)
      if(!isBlanco){
        const merchVal=Number(op.merchandise_value_usd||0)||totalFob;
        const amtForVpu=op.channel?.includes("aereo")?(op.channel==="aereo_negro"?totGW:pf):totCBM;
        if(merchVal>0&&amtForVpu>0){
          const vpu=merchVal/amtForVpu;
          const surchs=tariffs.filter(t=>t.service_key===svcKey&&t.type==="surcharge").sort((a,b)=>Number(b.min_qty||0)-Number(a.min_qty||0));
          for(const s of surchs){if(vpu>=Number(s.min_qty||0)){surchargePct=Number(s.rate||0);surcharge=Math.round(merchVal*(surchargePct/100)*100)/100;break;}}
        }
      }
      totalAbonar=isBlanco?(totalTax+flete+seguro+shipCost):(flete+surcharge+shipCost);
      }
      const shipCost=op.shipping_to_door?Number(op.shipping_cost||0):0;
      const rw=(l,v)=><div style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}><span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>{l}</span><span style={{fontSize:13,fontWeight:600,color:"#fff"}}>USD {v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>;
      return <Card title={`Presupuesto${opClient?` — ${opClient.first_name} ${opClient.last_name} (${isRI?"Resp. Inscripto":"No RI"})`:""}`}>
        {/* Canal B: input para valor de mercadería (base del recargo por valor) */}
        {!isBlanco&&<div style={{marginBottom:14,padding:"12px 14px",background:"rgba(96,165,250,0.05)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"end"}}>
            <Inp label="Valor mercadería (USD) — para cálculo de recargo por valor" type="number" value={op.merchandise_value_usd||""} onChange={v=>chOp("merchandise_value_usd")(v)} step="0.01" placeholder={totalFob>0?`Suma productos: ${totalFob.toFixed(2)}`:"Ej: 15000"} small/>
            <Btn small variant="secondary" onClick={async()=>{setSaving(true);const mv=Number(op.merchandise_value_usd||0)||null;await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{merchandise_value_usd:mv}});setOp(p=>({...p,merchandise_value_usd:mv}));autoSyncBudget();flash("Valor mercadería guardado");setSaving(false);}} disabled={saving}>{saving?"Guardando...":"Guardar y recalcular"}</Btn>
          </div>
          <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"8px 0 0",fontStyle:"italic"}}>
            {(()=>{const amtForVpu=op.channel?.includes("aereo")?(op.channel==="aereo_negro"?totGW:pf):totCBM;const merchVal=Number(op.merchandise_value_usd||0)||totalFob;if(merchVal<=0||amtForVpu<=0)return "Cargá valor mercadería + bultos para calcular el recargo.";const vpu=merchVal/amtForVpu;const u=op.channel?.includes("aereo")?"kg":"CBM";return `Valor por ${u}: USD ${vpu.toFixed(2)}. ${surchargePct>0?`→ Recargo del ${surchargePct}% aplicado.`:"→ No aplica recargo (valor bajo el umbral)."}`;})()}
          </p>
        </div>}
        {isBlanco?<>
          {rw("Total Impuestos",totalTax)}
          {rw("Flete internacional",flete)}
          {rw("Seguro de carga",seguro)}
        </>:<>
          {rw("Servicio Integral ARGENCARGO",flete)}
          {surcharge>0&&rw(`Recargo por valor (${surchargePct}%)`,surcharge)}
        </>}
        {shipCost>0&&rw("Envío a domicilio",shipCost)}
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4}}><span style={{fontSize:16,fontWeight:700,color:"#fff"}}>TOTAL A ABONAR</span><span style={{fontSize:20,fontWeight:700,color:IC}}>USD {totalAbonar.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
        {/* Controles de Envío a domicilio — siempre visibles, auto-save cuando cambian */}
        <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          {(()=>{
            // Auto-save: actualiza shipping_to_door + shipping_cost + recalc budget_total
            const saveShipping=async(newToDoor,newCost)=>{
              const costToUse=Number(newCost??op.shipping_cost??0);
              const toDoorToUse=newToDoor??op.shipping_to_door??false;
              const shipAdd=toDoorToUse?costToUse:0;
              // Recalc budget_total: mantenemos taxes+flete+seguro del estado actual y recalculamos el shipping
              const bt=Number(op.budget_taxes||0)+Number(op.budget_flete||0)+Number(op.budget_seguro||0)+shipAdd;
              await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{shipping_to_door:toDoorToUse,shipping_cost:costToUse,budget_total:bt}});
              setOp(p=>({...p,shipping_to_door:toDoorToUse,shipping_cost:costToUse,budget_total:bt}));
              flash(`Envío a domicilio ${toDoorToUse?"activado":"desactivado"}`);
            };
            return <>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,padding:"12px 16px",background:op.shipping_to_door?"rgba(34,197,94,0.06)":"rgba(255,255,255,0.03)",border:`1px solid ${op.shipping_to_door?"rgba(34,197,94,0.25)":"rgba(255,255,255,0.06)"}`,borderRadius:10,flexWrap:"wrap"}}>
                <div onClick={()=>saveShipping(!op.shipping_to_door,op.shipping_cost)} style={{display:"flex",alignItems:"center",gap:14,cursor:"pointer",userSelect:"none",flex:1,minWidth:220}}>
                  <div style={{width:44,height:24,background:op.shipping_to_door?"linear-gradient(135deg,#22c55e,#10b981)":"rgba(255,255,255,0.1)",borderRadius:999,position:"relative",transition:"all 200ms",boxShadow:op.shipping_to_door?"0 0 10px rgba(34,197,94,0.35)":"",flexShrink:0}}>
                    <div style={{position:"absolute",top:2,left:op.shipping_to_door?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 220ms cubic-bezier(0.34,1.56,0.64,1)"}}/>
                  </div>
                  <div>
                    <p style={{fontSize:13,fontWeight:op.shipping_to_door?700:600,color:op.shipping_to_door?"#22c55e":"rgba(255,255,255,0.6)",margin:0,letterSpacing:"0.02em"}}>Envío a domicilio</p>
                    <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"3px 0 0"}}>{op.shipping_to_door?`Suma USD ${Number(op.shipping_cost||0).toFixed(2)} al total`:"Retiro por oficina"}</p>
                  </div>
                </div>
                {op.shipping_to_door&&<div style={{minWidth:160}}>
                  <Inp label="Costo envío (USD)" type="number" value={op.shipping_cost} onChange={v=>{chOp("shipping_cost")(v);setTimeout(()=>saveShipping(true,v),400);}} step="0.01"/>
                </div>}
              </div>
            </>;
          })()}
        </div>
        {hasStoredBudget&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.06)",gap:12,flexWrap:"wrap"}}>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:0,fontStyle:"italic",flex:1}}>Presupuesto cargado manualmente. Si querés recalcular con productos/bultos, limpialo primero.</p>
          <Btn variant="danger" small onClick={async()=>{if(!confirm("¿Limpiar presupuesto guardado? Se borrarán los valores actuales y podrás recargar productos/bultos para recalcular."))return;setSaving(true);await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{budget_taxes:0,budget_flete:0,budget_seguro:0,budget_total:0}});setOp(p=>({...p,budget_taxes:0,budget_flete:0,budget_seguro:0,budget_total:0}));flash("Presupuesto limpiado");setSaving(false);}} disabled={saving}>Limpiar presupuesto</Btn>
        </div>}
        {!hasStoredBudget&&<div style={{display:"flex",gap:12,marginTop:12}}><Btn onClick={async()=>{setSaving(true);await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{budget_taxes:totalTax,budget_flete:flete,budget_seguro:seguro,budget_total:totalAbonar,shipping_cost:Number(op.shipping_cost||0),shipping_to_door:op.shipping_to_door||false,total_services:0}});setOp(p=>({...p,budget_taxes:totalTax,budget_flete:flete,budget_seguro:seguro,budget_total:totalAbonar}));flash("Presupuesto sincronizado");setSaving(false);}} disabled={saving}>{saving?"Guardando...":"Sincronizar presupuesto"}</Btn></div>}
      </Card>;})()}

    {tab==="items"&&<Card title="Productos" actions={<div style={{display:"flex",gap:6}}>{items.some(it=>it.description&&it.description.trim()&&(!it.ncm_code||it.import_duty_rate==null||it.import_duty_rate===""||it.statistics_rate==null||it.statistics_rate===""||it.iva_rate==null||it.iva_rate===""))&&<button onClick={autoClassifyAll} disabled={classifyingAll} title="Para cada producto: clasifica NCM si falta, y rellena DIE/TE/IVA con la base arancelaria. Sincroniza presupuesto al final." style={{padding:"8px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:"1px solid rgba(167,139,250,0.4)",background:"rgba(167,139,250,0.12)",color:"#a78bfa",cursor:classifyingAll?"wait":"pointer",opacity:classifyingAll?0.6:1}}>{classifyingAll?"⏳ Clasificando…":"✨ Clasificar todos los NCM (IA)"}</button>}<Btn onClick={addItem} small>+ Agregar producto</Btn></div>}>
      {items.map((it,i)=>{const fob=Number(it.unit_price_usd||0)*Number(it.quantity||1);return <div key={it.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:"16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10,gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <p style={{fontSize:13,fontWeight:700,color:IC,margin:0}}>Producto {i+1} — FOB: USD {fob.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
            {it.ncm_code?<span style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:"rgba(34,197,94,0.12)",color:"#22c55e",border:"1px solid rgba(34,197,94,0.25)",fontFamily:"monospace",fontWeight:700}}>NCM {it.ncm_code}</span>:it.description?<span style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:"rgba(251,191,36,0.12)",color:"#fbbf24",border:"1px solid rgba(251,191,36,0.25)",fontWeight:700}}>SIN NCM</span>:null}
          </div>
          <div style={{display:"flex",gap:6}}>
            <Btn onClick={()=>saveItem(it)} small variant="secondary">Guardar</Btn>
            <Btn onClick={()=>delItem(it.id)} small variant="danger">Eliminar</Btn>
          </div>
        </div>
        {ncmPreview[it.id]&&(()=>{const p=ncmPreview[it.id];return <div style={{marginBottom:12,padding:"12px 14px",background:"linear-gradient(135deg,rgba(167,139,250,0.10),rgba(96,165,250,0.05))",border:"1.5px solid rgba(167,139,250,0.35)",borderRadius:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:6}}>
            <span style={{fontSize:11,fontWeight:800,color:"#a78bfa",textTransform:"uppercase",letterSpacing:"0.05em"}}>✨ La IA clasificó este producto</span>
            <button onClick={()=>setNcmPreview(prev=>{const n={...prev};delete n[it.id];return n;})} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:18,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10,marginBottom:8,fontSize:12}}>
            <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 2px",textTransform:"uppercase"}}>NCM</p><p style={{fontSize:14,color:"#fff",fontFamily:"monospace",fontWeight:700,margin:0}}>{p.ncm_code}</p></div>
            <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 2px",textTransform:"uppercase"}}>DIE (Derechos)</p><p style={{fontSize:14,color:"#fff",fontWeight:700,margin:0}}>{Number(p.import_duty_rate??0)}%</p></div>
            <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 2px",textTransform:"uppercase"}}>TE (Estadística)</p><p style={{fontSize:14,color:"#fff",fontWeight:700,margin:0}}>{Number(p.statistics_rate??0)}%</p></div>
            <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 2px",textTransform:"uppercase"}}>IVA</p><p style={{fontSize:14,color:"#fff",fontWeight:700,margin:0}}>{p.iva_rate}%</p></div>
          </div>
          {p.reasoning&&<p style={{fontSize:11,color:"rgba(255,255,255,0.6)",margin:"0 0 8px",fontStyle:"italic"}}>{p.reasoning}</p>}
          {p.intervention?.required&&<div style={{padding:"8px 10px",marginBottom:10,background:"rgba(251,191,36,0.10)",border:"1.5px solid rgba(251,191,36,0.4)",borderRadius:8}}>
            <p style={{fontSize:11,fontWeight:800,color:"#fbbf24",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.05em"}}>⚠ Posible intervención: {p.intervention.types.join(" · ")}</p>
            {p.intervention.reason&&<p style={{fontSize:11,color:"rgba(255,255,255,0.7)",margin:0}}>{p.intervention.reason}</p>}
          </div>}
          <p style={{fontSize:11,color:"#a78bfa",margin:"0 0 10px"}}>💰 Impuestos estimados: <strong style={{color:"#fff"}}>USD {taxes.toFixed(2)}</strong> sobre FOB USD {fobX.toFixed(2)}</p>
          <div style={{display:"flex",gap:8}}>
            <Btn small onClick={()=>applyClassification(it)}>✓ Aplicar y sincronizar presupuesto</Btn>
            <Btn small variant="secondary" onClick={()=>classifyOne(it)}>🔄 Re-clasificar</Btn>
          </div>
        </div>;})()}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"0 12px"}}>
          <Inp label="Descripción" value={it.description} onChange={v=>chItem(i,"description",v)} small/>
          <Inp label="Precio unit. USD" type="number" value={it.unit_price_usd} onChange={v=>chItem(i,"unit_price_usd",v)} step="0.01" small/>
          <Inp label="Cantidad" type="number" value={it.quantity} onChange={v=>chItem(i,"quantity",v?parseInt(v):0)} small/>
        </div>
        {isBlanco&&!isGI&&<div style={{background:"rgba(255,255,255,0.02)",borderRadius:8,padding:"12px",border:"1px solid rgba(255,255,255,0.04)",marginTop:4}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 8px",textTransform:"uppercase"}}>Tasas Impositivas</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0 12px"}}>
            <Inp label="DIE %" type="number" value={it.import_duty_rate??0} onChange={v=>chItem(i,"import_duty_rate",v)} step="0.01" small/>
            <Inp label="TE %" type="number" value={it.statistics_rate??0} onChange={v=>chItem(i,"statistics_rate",v)} step="0.01" small/>
            <Inp label="IVA %" type="number" value={it.iva_rate??21} onChange={v=>chItem(i,"iva_rate",v)} step="0.01" small/>
            {isAereo&&(()=>{const itemFob=Number(it.unit_price_usd||0)*Number(it.quantity||1);const totalFob=items.reduce((s,x)=>s+Number(x.unit_price_usd||0)*Number(x.quantity||1),0);const pct=totalFob>0?itemFob/totalFob:1;let pf=0;pkgs.forEach(p=>{const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);pf+=Math.max(gw*q,l&&w&&h?((l*w*h)/5000)*q:0);});const certFl=pf*(config.cert_flete_aereo_ficticio||3.5);const cif=(totalFob+certFl)*1.01;const desemb=((c)=>{const t=[[5,0],[9,36],[20,50],[50,58],[100,65],[400,72],[800,84],[1000,96],[Infinity,120]];for(const[max,amt]of t)if(c<max)return amt;return 120;})(cif);const propDesemb=desemb*pct;const ivaD=propDesemb*0.21;return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.45)",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>GASTO DOC. (auto)</label><div style={{padding:"8px 10px",fontSize:13,borderRadius:8,background:"rgba(184,149,106,0.08)",border:"1.5px solid rgba(184,149,106,0.2)",color:IC,fontWeight:600}}>USD {(propDesemb+ivaD).toFixed(2)}</div></div>;})()}
            {isMaritimo&&<><Inp label="IVA Adic. %" type="number" value={it.iva_additional_rate} onChange={v=>chItem(i,"iva_additional_rate",v)} step="0.01" small/>
            <Inp label="IIGG %" type="number" value={it.iigg_rate} onChange={v=>chItem(i,"iigg_rate",v)} step="0.01" small/>
            <Inp label="IIBB %" type="number" value={it.iibb_rate} onChange={v=>chItem(i,"iibb_rate",v)} step="0.01" small/></>}
          </div>
        </div>}
      </div>;})}
      {items.length===0&&<p style={{color:"rgba(255,255,255,0.45)",textAlign:"center",padding:"1rem 0"}}>No hay productos.</p>}
    </Card>}

    {tab==="gi_costs"&&isGI&&(()=>{
      // Ledger de costos para ops Gestión Integral.
      // Cada pago del admin al proveedor/intermediario se guarda en operation_supplier_payments.
      // Soporte multi-moneda: USD directo vs ARS (pendiente de dolarización hasta cierre TC).
      // type='payment' suma, type='refund' resta (reembolsos del proveedor).
      const sign=(p)=>p.type==="refund"?-1:1;
      const totalCosto=supplierPayments.reduce((s,p)=>s+sign(p)*Number(p.amount_usd||0),0);
      const totalCostoArs=supplierPayments.reduce((s,p)=>s+sign(p)*Number(p.amount_ars||0),0);
      const totalPagadoCosto=supplierPayments.filter(p=>p.is_paid).reduce((s,p)=>s+sign(p)*Number(p.amount_usd||0),0);
      const totalPendCosto=totalCosto-totalPagadoCosto;
      const totalReembolsos=supplierPayments.filter(p=>p.type==="refund").reduce((s,p)=>s+Number(p.amount_usd||0),0);
      const addCost=async()=>{
        const amt=Number(newSupPmt.amount_usd);
        if(!amt||amt<=0||!newSupPmt.payment_date)return;
        const isTC=newSupPmt.payment_method==="tarjeta_credito";
        const isArs=newSupPmt.currency==="ARS";
        // ARS + TC: amount_usd queda 0 hasta que se dolarice en tab Dolarización.
        //           amount_ars se guarda con el monto real.
        // ARS + no-TC (efectivo/transf): debería llevar un exchange_rate para convertir a USD,
        //           pero por ahora lo dejamos como ARS pendiente también.
        // USD: amount_usd = amt, amount_ars = null.
        const isRefund=newSupPmt.type==="refund";
        const body={
          operation_id:op.id,
          payment_date:newSupPmt.payment_date,
          amount_usd:isArs?0:amt,
          amount_ars:isArs?amt:null,
          payment_method:newSupPmt.payment_method,
          is_paid:newSupPmt.is_paid,
          notes:newSupPmt.notes||null,
          reference:newSupPmt.reference||null,
          currency:newSupPmt.currency||"USD",
          card_closing_date:isTC&&newSupPmt.card_closing_date?newSupPmt.card_closing_date:null,
          paid_at:newSupPmt.is_paid&&!isArs?new Date(newSupPmt.payment_date+"T12:00:00Z").toISOString():null,
          type:newSupPmt.type||"payment"
        };
        // Si ARS: forzar is_paid=false hasta que se dolarice
        // Reembolsos en ARS: también pending dolarizar (cuando recibas pesos de vuelta necesitás saber el TC del día)
        if(isArs){body.is_paid=false;body.paid_at=null;}
        await dq("operation_supplier_payments",{method:"POST",token,body});
        // Sync cost_producto_usd: los reembolsos RESTAN, los pagos SUMAN. ARS queda fuera hasta dolarizar.
        if(!isArs){
          const delta=isRefund?-amt:amt;
          const newTotal=totalCosto+delta;
          await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{cost_producto_usd:newTotal}});
          setOp(p=>({...p,cost_producto_usd:newTotal}));
        }
        setNewSupPmt({payment_date:new Date().toISOString().slice(0,10),amount_usd:"",payment_method:"transferencia",is_paid:true,notes:"",reference:"",currency:"USD",card_closing_date:"",type:"payment"});
        load();
        flash(isRefund?(isArs?"Reembolso ARS registrado":"Reembolso registrado"):(isArs?"Costo ARS registrado — se dolariza al cerrar tarjeta":"Costo registrado"));
      };
      const deleteCost=async(id)=>{
        const target=supplierPayments.find(p=>p.id===id);
        const isRefund=target?.type==="refund";
        if(!confirm(isRefund?"¿Eliminar este reembolso?":"¿Eliminar este costo?"))return;
        await dq("operation_supplier_payments",{method:"DELETE",token,filters:`?id=eq.${id}`});
        const remaining=supplierPayments.filter(p=>p.id!==id);
        // Recomputar cost_producto_usd = sum(payments USD) - sum(refunds USD). Solo USD (los ARS se suman cuando se dolaricen).
        const newTotal=remaining.reduce((s,p)=>{const sgn=p.type==="refund"?-1:1;return s+sgn*Number(p.amount_usd||0);},0);
        await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{cost_producto_usd:newTotal}});
        setOp(p=>({...p,cost_producto_usd:newTotal}));
        load();
      };
      const toggleCostPaid=async(p)=>{
        const newPaid=!p.is_paid;
        await dq("operation_supplier_payments",{method:"PATCH",token,filters:`?id=eq.${p.id}`,body:{is_paid:newPaid,paid_at:newPaid?new Date().toISOString():null}});
        load();
      };
      return <Card title="Costos de la operación">
        {/* Resumen */}
        <div style={{display:"flex",gap:20,marginBottom:16,flexWrap:"wrap",padding:"14px 18px",background:"rgba(0,0,0,0.2)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
          <div>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Total costos</p>
            <p style={{fontSize:20,fontWeight:800,color:"#fff",margin:0,fontVariantNumeric:"tabular-nums"}}>USD {totalCosto.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
            {totalCostoArs>0&&<p style={{fontSize:12,fontWeight:600,color:"#60a5fa",margin:"3px 0 0",fontVariantNumeric:"tabular-nums"}}>+ ARS {totalCostoArs.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}<span style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginLeft:6}}>pendiente dolarizar</span></p>}
          </div>
          <div style={{width:1,background:"rgba(255,255,255,0.08)"}}/>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Ya pagado</p><p style={{fontSize:20,fontWeight:800,color:"#22c55e",margin:0,fontVariantNumeric:"tabular-nums"}}>USD {totalPagadoCosto.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
          {totalPendCosto>0.01&&<>
            <div style={{width:1,background:"rgba(255,255,255,0.08)"}}/>
            <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Pendiente pago</p><p style={{fontSize:20,fontWeight:800,color:"#fb923c",margin:0,fontVariantNumeric:"tabular-nums"}}>USD {totalPendCosto.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
          </>}
        </div>

        {/* Tabla de costos */}
        {supplierPayments.length>0?<div style={{background:"rgba(0,0,0,0.18)",borderRadius:10,overflow:"hidden",marginBottom:16}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.02)"}}>
                <th style={{textAlign:"left",padding:"10px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Fecha</th>
                <th style={{textAlign:"right",padding:"10px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Monto</th>
                <th style={{textAlign:"left",padding:"10px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Descripción</th>
                <th style={{textAlign:"left",padding:"10px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Referencia</th>
                <th style={{textAlign:"left",padding:"10px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Método</th>
                <th style={{textAlign:"left",padding:"10px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Estado</th>
                <th style={{padding:"10px 14px"}}></th>
              </tr>
            </thead>
            <tbody>
              {supplierPayments.map(p=>{const isRefund=p.type==="refund";const rowBg=isRefund?"rgba(34,197,94,0.04)":"transparent";return <tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:rowBg}}>
                <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.85)",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>
                  {new Date(p.payment_date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})}
                  {isRefund&&<span style={{display:"block",fontSize:9,fontWeight:700,color:"#22c55e",marginTop:2,letterSpacing:"0.06em",textTransform:"uppercase"}}>↩ Reembolso</span>}
                </td>
                <td style={{padding:"10px 14px",textAlign:"right",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>
                  {p.currency==="ARS"?<>
                    <span style={{color:isRefund?"#22c55e":"#60a5fa",fontWeight:700}}>{isRefund?"− ":""}ARS {Number(p.amount_ars||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                    {Number(p.amount_usd||0)>0?<span style={{display:"block",fontSize:10,color:"rgba(255,255,255,0.5)",fontWeight:500}}>= USD {Number(p.amount_usd).toFixed(2)} @ {Number(p.exchange_rate||0).toFixed(2)}</span>:<span style={{display:"block",fontSize:10,color:"rgba(251,146,60,0.8)",fontWeight:500}}>pendiente dolarizar</span>}
                  </>:<span style={{color:isRefund?"#22c55e":"#c084fc",fontWeight:700}}>{isRefund?"− ":""}USD {Number(p.amount_usd).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>}
                </td>
                <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.75)"}}>{p.notes||<span style={{color:"rgba(255,255,255,0.3)"}}>—</span>}</td>
                <td style={{padding:"10px 14px",color:GOLD_LIGHT,fontFamily:"'JetBrains Mono','SF Mono',monospace",fontSize:11}}>{p.reference||<span style={{color:"rgba(255,255,255,0.3)"}}>—</span>}</td>
                <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.6)",textTransform:"capitalize"}}>{(p.payment_method||"—").replace("_"," ")}</td>
                <td style={{padding:"10px 14px"}}>{p.is_paid?<span style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:4,background:"rgba(34,197,94,0.15)",color:"#22c55e",letterSpacing:"0.05em"}}>✓ PAGADO</span>:<span style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:4,background:"rgba(251,146,60,0.15)",color:"#fb923c",letterSpacing:"0.05em"}}>PENDIENTE</span>}</td>
                <td style={{padding:"10px 14px",textAlign:"right",whiteSpace:"nowrap"}}>
                  {!p.is_paid&&<button onClick={()=>toggleCostPaid(p)} style={{padding:"4px 9px",fontSize:10,fontWeight:700,background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:4,color:"#22c55e",cursor:"pointer",marginRight:4}}>Marcar pagado</button>}
                  <button title="Editar moneda y monto" onClick={async()=>{
                    const curCur=p.currency||"USD";
                    const newCur=window.prompt(`Moneda actual: ${curCur}\n\nNueva moneda (USD / ARS / EUR / CNY):`,curCur);
                    if(!newCur||!["USD","ARS","EUR","CNY"].includes(newCur.toUpperCase()))return;
                    const cur=newCur.toUpperCase();
                    const isArsNew=cur==="ARS";
                    const curAmt=isArsNew?Number(p.amount_ars||0):Number(p.amount_usd||0);
                    const newAmtStr=window.prompt(`Monto actual: ${curCur} ${curAmt.toLocaleString("es-AR")}\n\nIngresá el nuevo monto en ${cur}:`,String(curAmt));
                    const newAmt=Number(newAmtStr);
                    if(!newAmt||newAmt<=0)return;
                    const body={currency:cur};
                    if(isArsNew){
                      body.amount_ars=newAmt;
                      body.amount_usd=0;
                      body.exchange_rate=null;
                      body.is_paid=false;
                      body.paid_at=null;
                    }else{
                      body.amount_usd=newAmt;
                      body.amount_ars=null;
                      body.exchange_rate=null;
                    }
                    await dq("operation_supplier_payments",{method:"PATCH",token,filters:`?id=eq.${p.id}`,body});
                    load();flash("Costo editado");
                  }} style={{padding:"4px 9px",fontSize:11,background:"transparent",border:"1px solid rgba(96,165,250,0.3)",borderRadius:4,color:"#60a5fa",cursor:"pointer",marginRight:4}}>✎</button>
                  <button onClick={()=>deleteCost(p.id)} style={{padding:"4px 9px",fontSize:11,background:"transparent",border:"1px solid rgba(255,80,80,0.25)",borderRadius:4,color:"rgba(255,100,100,0.7)",cursor:"pointer"}}>✕</button>
                </td>
              </tr>;})}
            </tbody>
          </table>
        </div>:<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"1.5rem 0",fontSize:13}}>Sin costos registrados todavía. Agregá el primero abajo.</p>}

        {/* Form nuevo costo */}
        <div style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${newSupPmt.type==="refund"?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.06)"}`,borderRadius:10,padding:"16px 18px",transition:"border-color 180ms"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
            <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:0,textTransform:"uppercase",letterSpacing:"0.08em"}}>{newSupPmt.type==="refund"?"Registrar reembolso del proveedor":"Registrar nuevo costo"}</p>
            {/* Tabs toggle: Costo vs Reembolso */}
            <div style={{display:"flex",gap:4,padding:3,background:"rgba(0,0,0,0.2)",borderRadius:8}}>
              <button onClick={()=>setNewSupPmt(p=>({...p,type:"payment"}))} style={{padding:"6px 14px",fontSize:11,fontWeight:700,borderRadius:6,border:"none",cursor:"pointer",background:newSupPmt.type!=="refund"?"rgba(192,132,252,0.15)":"transparent",color:newSupPmt.type!=="refund"?"#c084fc":"rgba(255,255,255,0.5)",letterSpacing:"0.04em"}}>Costo</button>
              <button onClick={()=>setNewSupPmt(p=>({...p,type:"refund"}))} style={{padding:"6px 14px",fontSize:11,fontWeight:700,borderRadius:6,border:"none",cursor:"pointer",background:newSupPmt.type==="refund"?"rgba(34,197,94,0.15)":"transparent",color:newSupPmt.type==="refund"?"#22c55e":"rgba(255,255,255,0.5)",letterSpacing:"0.04em"}}>↩ Reembolso</button>
            </div>
          </div>
          {newSupPmt.type==="refund"&&<p style={{fontSize:11,color:"rgba(34,197,94,0.8)",margin:"0 0 12px",padding:"8px 12px",background:"rgba(34,197,94,0.05)",border:"1px solid rgba(34,197,94,0.15)",borderRadius:6}}>💚 Reembolso del proveedor (ej: devolución por fallas de producción, crédito, ajuste). El monto se resta del costo total de la op.</p>}
          {/* Fila 1: fecha + monto + moneda + método */}
          <div style={{display:"grid",gridTemplateColumns:"140px 1fr 100px 1.3fr",gap:10,alignItems:"end",marginBottom:10}}>
            <Inp label="Fecha" type="date" value={newSupPmt.payment_date} onChange={v=>setNewSupPmt(p=>({...p,payment_date:v}))}/>
            <Inp label={`Monto (${newSupPmt.currency||"USD"})`} type="number" value={newSupPmt.amount_usd} onChange={v=>setNewSupPmt(p=>({...p,amount_usd:v}))} step="0.01" placeholder={newSupPmt.currency==="ARS"?"Ej: 500000":"0.00"}/>
            <Sel label="Moneda" value={newSupPmt.currency||"USD"} onChange={v=>setNewSupPmt(p=>({...p,currency:v}))} options={[{value:"USD",label:"USD"},{value:"ARS",label:"ARS"},{value:"EUR",label:"EUR"},{value:"CNY",label:"CNY"}]}/>
            <Sel label="Método" value={newSupPmt.payment_method} onChange={v=>setNewSupPmt(p=>({...p,payment_method:v}))} options={[{value:"transferencia",label:"Transferencia"},{value:"efectivo",label:"Contado"},{value:"tarjeta_credito",label:"Tarjeta de Crédito"},{value:"swift",label:"SWIFT / Wire"},{value:"alibaba",label:"Alibaba"},{value:"otro",label:"Otro"}]}/>
          </div>
          {/* Fila 2: descripción + referencia */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10,alignItems:"end",marginBottom:12}}>
            <Inp label="Descripción" value={newSupPmt.notes} onChange={v=>setNewSupPmt(p=>({...p,notes:v}))} placeholder="Ej: Orden Alibaba (incluye comisión)"/>
            <Inp label="Referencia (opcional)" value={newSupPmt.reference||""} onChange={v=>setNewSupPmt(p=>({...p,reference:v}))} placeholder="Nº orden / comprobante"/>
          </div>
          {/* Fila 3: condicional — si TC, mostrar fecha cierre */}
          {newSupPmt.payment_method==="tarjeta_credito"&&<div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:10,alignItems:"end",marginBottom:12,padding:"10px 14px",background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.18)",borderRadius:8}}>
            <Inp label="Cierre de tarjeta" type="date" value={newSupPmt.card_closing_date||""} onChange={v=>setNewSupPmt(p=>({...p,card_closing_date:v}))}/>
            <p style={{fontSize:11,color:"rgba(167,139,250,0.85)",margin:0,paddingBottom:8,lineHeight:1.5}}>💳 Con tarjeta: el débito ocurre en la fecha de cierre. Hasta entonces, la plata está en el bolsillo pero es deuda TC del dashboard.</p>
          </div>}
          {/* Fila 4: toggle "ya está pagado" + botón agregar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
            <div onClick={()=>setNewSupPmt(p=>({...p,is_paid:!p.is_paid}))} style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",userSelect:"none"}}>
              <div style={{width:46,height:26,background:newSupPmt.is_paid?"linear-gradient(135deg,#22c55e,#10b981)":"rgba(255,255,255,0.1)",borderRadius:999,position:"relative",transition:"all 200ms",boxShadow:newSupPmt.is_paid?"0 0 10px rgba(34,197,94,0.3)":""}}>
                <div style={{position:"absolute",top:2,left:newSupPmt.is_paid?22:2,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left 220ms cubic-bezier(0.34,1.56,0.64,1)",display:"flex",alignItems:"center",justifyContent:"center"}}>{newSupPmt.is_paid&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}</div>
              </div>
              <div>
                <p style={{fontSize:12,fontWeight:700,color:newSupPmt.is_paid?"#22c55e":"rgba(255,255,255,0.55)",margin:0,letterSpacing:"0.02em"}}>{newSupPmt.is_paid?"Ya está pagado":"Pendiente de pago"}</p>
                <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"1px 0 0"}}>Tocá para cambiar</p>
              </div>
            </div>
            <Btn onClick={addCost} disabled={!newSupPmt.amount_usd||Number(newSupPmt.amount_usd)<=0} small>{newSupPmt.type==="refund"?"↩ Registrar reembolso":"+ Agregar costo"}</Btn>
          </div>
        </div>
      </Card>;
    })()}

    {tab==="packages"&&<Card title="Bultos" actions={<div style={{display:"flex",gap:6}}>{pkgs.length>0&&<Btn small variant="secondary" onClick={()=>printPackageLabels({op,packages:pkgs,items,client:opClient})}>🏷️ Imprimir etiquetas</Btn>}<Btn onClick={addPkg} small>+ Agregar bulto</Btn></div>}>
      {pkgs.map((pk,i)=>{const q=Number(pk.quantity||1),l=Number(pk.length_cm||0),w=Number(pk.width_cm||0),h=Number(pk.height_cm||0),gw=Number(pk.gross_weight_kg||0);const bruto=gw*q;const vw=l&&w&&h?((l*w*h)/agentVolDiv)*q:0;const cbm=l&&w&&h?((l*w*h)/1000000)*q:0;return <div key={pk.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:"16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
            <p style={{fontSize:13,fontWeight:700,color:IC,margin:0}}>Bulto {pk.package_number}</p>
            {pk.created_at&&<span style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:500}}>· cargado {new Date(pk.created_at).toLocaleString("es-AR",{day:"2-digit",month:"short",year:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>}
          </div>
          <div style={{display:"flex",gap:6}}><Btn onClick={()=>savePkg(pk)} small variant="secondary">Guardar</Btn><Btn onClick={()=>movePkgToOp(pk)} small variant="secondary" title="Mover este bulto a otra operación (cliente equivocado)">↪ Mover</Btn><Btn onClick={()=>delPkg(pk.id)} small variant="danger">Eliminar</Btn></div>
        </div>
        <Inp label="Seguimiento nacional" value={pk.national_tracking} onChange={v=>chPkg(i,"national_tracking",v)} placeholder="Código de seguimiento nacional" small/>
        <TrackingDuplicateWarning trackingCode={pk.national_tracking} excludeOpId={op.id} token={token}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:"0 12px"}}>
          <Inp label="Cantidad" type="number" value={pk.quantity} onChange={v=>chPkg(i,"quantity",v?parseInt(v):1)} small/>
          <Inp label="Largo cm" type="number" value={pk.length_cm} onChange={v=>chPkg(i,"length_cm",v)} step="0.1" small/>
          <Inp label="Ancho cm" type="number" value={pk.width_cm} onChange={v=>chPkg(i,"width_cm",v)} step="0.1" small/>
          <Inp label="Alto cm" type="number" value={pk.height_cm} onChange={v=>chPkg(i,"height_cm",v)} step="0.1" small/>
          <Inp label="Peso unit. kg" type="number" value={pk.gross_weight_kg} onChange={v=>chPkg(i,"gross_weight_kg",v)} step="0.1" small/>
        </div>
        {/* Foto del bulto cargada por el agente */}
        <div style={{marginTop:12,padding:"10px 12px",background:pk.photo_url?"rgba(34,197,94,0.06)":"rgba(251,191,36,0.06)",border:`1px solid ${pk.photo_url?"rgba(34,197,94,0.18)":"rgba(251,191,36,0.2)"}`,borderRadius:8,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          {pk.photo_url?<>
            <a href={pk.photo_url} target="_blank" rel="noopener noreferrer"><img src={pk.photo_url} alt="" style={{width:60,height:60,objectFit:"cover",borderRadius:6,border:"1px solid rgba(34,197,94,0.4)",cursor:"zoom-in"}}/></a>
            <div style={{flex:1,minWidth:160}}>
              <p style={{fontSize:11,fontWeight:700,color:"#22c55e",margin:0,letterSpacing:"0.04em",textTransform:"uppercase"}}>📷 Foto del agente</p>
              <p style={{fontSize:10,color:"rgba(255,255,255,0.45)",margin:"2px 0 0"}}>Subida {pk.photo_uploaded_at?new Date(pk.photo_uploaded_at).toLocaleDateString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):""}</p>
            </div>
            <a href={pk.photo_url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:GOLD_LIGHT,fontWeight:600,textDecoration:"none"}}>Ver completa →</a>
          </>:<>
            <span style={{fontSize:18}}>📷</span>
            <div style={{flex:1,minWidth:160}}>
              <p style={{fontSize:11,fontWeight:700,color:"#fbbf24",margin:0,letterSpacing:"0.04em",textTransform:"uppercase"}}>Foto pendiente</p>
              <p style={{fontSize:10,color:"rgba(255,255,255,0.45)",margin:"2px 0 0"}}>El agente aún no subió foto de la mercadería</p>
            </div>
          </>}
        </div>
        {(bruto>0||vw>0)&&<div style={{display:"flex",gap:16,marginTop:8,fontSize:11,color:"rgba(255,255,255,0.4)"}}><span>Bruto total: <strong style={{color:"#fff"}}>{bruto.toFixed(1)} kg</strong></span>{vw>0&&<span>Vol: <strong style={{color:"#fff"}}>{vw.toFixed(1)} kg</strong></span>}{cbm>0&&<span>CBM: <strong style={{color:"#fff"}}>{cbm.toFixed(4)} m³</strong></span>}{vw>bruto&&<span style={{color:"#fb923c"}}>Volumétrico mayor</span>}</div>}
      </div>;})}
      {pkgs.length>0&&(()=>{let pf=0,totGW=0,totCBM=0;pkgs.forEach(p=>{const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);const b=gw*q;const v=l&&w&&h?((l*w*h)/agentVolDiv)*q:0;pf+=Math.max(b,v);totGW+=b;totCBM+=l&&w&&h?((l*w*h)/1000000)*q:0;});return <div style={{borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:12,marginTop:8,display:"flex",gap:20,alignItems:"baseline",flexWrap:"wrap"}}><div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>PESO FACTURABLE</p><p style={{fontSize:16,fontWeight:700,color:IC,margin:0}}>{pf.toFixed(2)} kg</p></div><div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:14,color:"#fff",margin:0}}>{totGW.toFixed(2)} kg</p></div><div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>CBM TOTAL</p><p style={{fontSize:14,color:"#fff",margin:0}}>{totCBM.toFixed(4)} m³</p></div>{op.created_by_agent_id&&<div style={{marginLeft:"auto"}}><p style={{fontSize:10,color:"rgba(255,255,255,0.35)",margin:0}}>Divisor agente: <strong style={{color:"#fff"}}>÷{agentVolDiv}</strong></p></div>}</div>;})()}
      {pkgs.length===0&&<p style={{color:"rgba(255,255,255,0.45)",textAlign:"center",padding:"1rem 0"}}>No hay bultos.</p>}
    </Card>}

    {tab==="tracking"&&<><Card title="Carrier & Tracking" actions={<div style={{display:"flex",gap:8}}>
        <Btn small variant="secondary" onClick={async()=>{
          if(!op.international_tracking||!op.international_carrier){alert("Cargá carrier y tracking primero");return;}
          const r=await fetch(`/api/tracking/sync?operation_id=${op.id}`,{headers:{Authorization:`Bearer ${token}`}});const d=await r.json();
          if(d.error){alert("Error: "+d.error);return;}
          const first=d.results?.[0];if(first?.error)alert("Error carrier: "+first.error);
          else if(first?.inserted!==undefined){
            // Refrescar también el state local de la op para que ETA/status actualizados aparezcan
            const fresh=await dq("operations",{token,filters:`?id=eq.${op.id}&select=*,clients(first_name,last_name,client_code)`});
            if(Array.isArray(fresh)&&fresh[0])setOp(fresh[0]);
            flash(`✓ ${first.inserted} eventos sincronizados${first.eta_patch?` · ETA: ${first.eta_patch}`:""}`);
          }
          else if(first?.skipped)alert(first.skipped);
          await reloadEvents();
        }}>↻ Sincronizar tracking</Btn>
        {(()=>{const tMap={en_deposito_origen:"deposito",arribo_argentina:"arribo",operacion_cerrada:"cerrada"};const tr=tMap[op.status];if(!tr)return null;const sent=op.sent_notifications?.[`email_${tr}`];return <Btn small variant="secondary" onClick={async()=>{if(!confirm(`¿Reenviar email "${tr}" al cliente?${sent?`\n\nYa se envió el ${new Date(sent).toLocaleString("es-AR")}.`:""}`))return;try{const r=await fetch("/api/notify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({op_id:op.id,trigger:tr,force:true})});const resp=await r.json();if(resp?.ok)flash(`✉️ Email ${tr} reenviado`);else flash(`❌ ${resp?.error||JSON.stringify(resp)}`);}catch(e){flash(`❌ ${e.message}`);}}}>{sent?"✉️ Reenviar email":"✉️ Enviar email"}</Btn>;})()}
        <Btn onClick={saveOp} disabled={saving} small>{saving?"Guardando...":"Guardar"}</Btn>
      </div>}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
        <Inp label="Carrier Internacional" value={op.international_carrier} onChange={chOp("international_carrier")} placeholder="Ej: DHL, FedEx, UPS"/>
        <Inp label="Tracking Internacional" value={op.international_tracking} onChange={chOp("international_tracking")} placeholder="Número de seguimiento"/>
        <Inp label="ETA" type="date" value={formatDateInput(op.eta)} onChange={chOp("eta")}/>
      </div>
      <TrackingDuplicateWarning trackingCode={op.international_tracking} excludeOpId={op.id} token={token}/>
      <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"4px 0 0"}}>Las actualizaciones de DHL/FedEx/UPS se sincronizan automáticamente cada 6h (cron). Podés forzar ahora con el botón ↻.</p>
    </Card>
    <Card title="Eventos de seguimiento" actions={<Btn onClick={addEvt} small>+ Agregar evento</Btn>}>
      {events.map((ev,i)=><div key={ev.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:"16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <p style={{fontSize:13,fontWeight:700,color:IC,margin:0}}>{ev.title||"Sin título"} — {formatDate(ev.occurred_at)}</p>
          <div style={{display:"flex",gap:6}}><Btn onClick={()=>saveEvt(ev)} small variant="secondary">Guardar</Btn><Btn onClick={()=>delEvt(ev.id)} small variant="danger">Eliminar</Btn></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}>
          <Inp label="Título" value={ev.title} onChange={v=>chEvt(i,"title",v)} small/>
          <Inp label="Descripción" value={ev.description} onChange={v=>chEvt(i,"description",v)} small/>
          <Inp label="Ubicación" value={ev.location} onChange={v=>chEvt(i,"location",v)} small/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Inp label="Fecha" type="datetime-local" value={ev.occurred_at?ev.occurred_at.slice(0,16):""} onChange={v=>chEvt(i,"occurred_at",v?v+":00":null)} small/>
          <div style={{marginBottom:12,paddingTop:22}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={ev.is_visible_to_client!==false} onChange={e=>chEvt(i,"is_visible_to_client",e.target.checked)}/><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Visible para el cliente</span></label></div>
        </div>
      </div>)}
      {events.length===0&&<p style={{color:"rgba(255,255,255,0.45)",textAlign:"center",padding:"1rem 0"}}>No hay eventos de seguimiento.</p>}
    </Card>
    </>}

    {tab==="payments"&&(()=>{
      // Suma cobrado: usa monto real si está pagado, sino el esperado
      const totalAnticipado=payments.filter(p=>p.client_paid).reduce((s,p)=>s+Number(p.client_paid_amount_usd??p.client_amount_usd??0),0);
      const totalGirado=payments.filter(p=>p.giro_status==="confirmado").reduce((s,p)=>s+Number(p.giro_amount_usd||0),0);
      const totalGanPagos=payments.reduce((s,p)=>{const cli=p.client_paid?Number(p.client_paid_amount_usd??p.client_amount_usd??0):Number(p.client_amount_usd||0);return s+cli-Number(p.giro_amount_usd||0)-Number(p.cost_comision_giro||0);},0);
      const savePmt=async()=>{if(!newPmt.client_amount_usd)return;setSaving(true);
        const body={...newPmt,client_amount_usd:Number(newPmt.client_amount_usd),giro_amount_usd:Number(newPmt.giro_amount_usd||0),cost_comision_giro:Number(newPmt.cost_comision_giro||0),operation_id:op.id,client_id:op.client_id,giro_payment_method:newPmt.giro_payment_method||"efectivo",giro_tarjeta_due_date:newPmt.giro_payment_method==="tarjeta_credito"?(newPmt.giro_tarjeta_due_date||null):null};
        await dq("payment_management",{method:"POST",token,body});
        const pm=await dq("payment_management",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`});setPayments(Array.isArray(pm)?pm:[]);
        setShowNewPmt(false);setNewPmt({client_amount_usd:"",giro_amount_usd:"",cost_comision_giro:"",description:"",client_payment_method:"transferencia",giro_status:"pendiente",giro_payment_method:"efectivo",giro_tarjeta_due_date:""});flash("Pago creado");setSaving(false);};
      const updatePmt=async(pmtId,field,value)=>{
        await dq("payment_management",{method:"PATCH",token,filters:`?id=eq.${pmtId}`,body:{[field]:value}});
        // Auto finance entries
        if(field==="client_paid"&&value===true){
          const pmt=payments.find(p=>p.id===pmtId);
          if(pmt?.client_paid)return;
          await dq("payment_management",{method:"PATCH",token,filters:`?id=eq.${pmtId}`,body:{client_paid:true,client_paid_date:new Date().toISOString().slice(0,10)}});
          const newTotal=payments.filter(p=>p.client_paid||(p.id===pmtId)).reduce((s,p)=>s+Number(p.client_amount_usd||0),0);
          await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{total_anticipos:newTotal}});
          setOp(p=>({...p,total_anticipos:newTotal}));
        }
        if(field==="giro_status"&&value==="confirmado"){
          const pmt=payments.find(p=>p.id===pmtId);
          if(pmt?.giro_status==="confirmado")return;
          await dq("payment_management",{method:"PATCH",token,filters:`?id=eq.${pmtId}`,body:{giro_status:"confirmado",giro_date:new Date().toISOString().slice(0,10)}});
        }
        const pm=await dq("payment_management",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`});setPayments(Array.isArray(pm)?pm:[]);flash("Actualizado");
      };
      const delPmt=async(pmtId)=>{
        await dq("payment_management",{method:"DELETE",token,filters:`?id=eq.${pmtId}`});
        // Recalculate total_anticipos
        const remaining=payments.filter(x=>x.id!==pmtId&&x.client_paid);
        const newTotal=remaining.reduce((s,p)=>s+Number(p.client_amount_usd||0),0);
        await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{total_anticipos:newTotal}});
        setOp(p=>({...p,total_anticipos:newTotal}));
        setPayments(p=>p.filter(x=>x.id!==pmtId));flash("Eliminado");
      };
      const usdF=v=>`USD ${Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
      const GST={pendiente:{l:"Pendiente",c:"#fbbf24"},enviado:{l:"Enviado",c:"#60a5fa"},confirmado:{l:"Confirmado",c:"#22c55e"}};
      return <>
      <Card title="Gestión de Pagos" actions={<Btn onClick={()=>setShowNewPmt(true)} small>+ Nuevo pago</Btn>}>
        {payments.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:20}}>
          <div style={{background:"rgba(34,197,94,0.06)",borderRadius:10,padding:14,border:"1px solid rgba(34,197,94,0.12)",textAlign:"center"}}><p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>ANTICIPADO</p><p style={{fontSize:18,fontWeight:700,color:"#22c55e",margin:0}}>{usdF(totalAnticipado)}</p></div>
          <div style={{background:"rgba(184,149,106,0.06)",borderRadius:10,padding:14,border:"1px solid rgba(184,149,106,0.12)",textAlign:"center"}}><p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>GIRADO</p><p style={{fontSize:18,fontWeight:700,color:IC,margin:0}}>{usdF(totalGirado)}</p></div>
          <div style={{background:totalGanPagos>=0?"rgba(34,197,94,0.06)":"rgba(255,80,80,0.06)",borderRadius:10,padding:14,border:`1px solid ${totalGanPagos>=0?"rgba(34,197,94,0.12)":"rgba(255,80,80,0.12)"}`,textAlign:"center"}}><p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>GANANCIA PAGOS</p><p style={{fontSize:18,fontWeight:700,color:totalGanPagos>=0?"#22c55e":"#ff6b6b",margin:0}}>{usdF(totalGanPagos)}</p></div>
        </div>}
        {payments.map((pm,i)=>{
          // Ganancia: usa monto real cobrado si está marcado como pagado, sino el esperado
          const cliRealOrExpected=pm.client_paid?Number(pm.client_paid_amount_usd??pm.client_amount_usd??0):Number(pm.client_amount_usd||0);
          const gan=cliRealOrExpected-Number(pm.giro_amount_usd||0)-Number(pm.cost_comision_giro||0);
          const gs=GST[pm.giro_status]||{l:pm.giro_status,c:"#999"};
          const isTarj=pm.giro_payment_method==="tarjeta_credito";
          const markTarjDeb=async()=>{if(!confirm("¿Marcar la tarjeta como ya debitada? Esto restará del cash real."))return;await dq("payment_management",{method:"PATCH",token,filters:`?id=eq.${pm.id}`,body:{giro_tarjeta_paid:true,giro_tarjeta_paid_at:new Date().toISOString()}});load();};
          const cycleGiro=()=>{const order=["pendiente","enviado","confirmado"];const idx=order.indexOf(pm.giro_status);const next=order[(idx+1)%order.length];updatePmt(pm.id,"giro_status",next);};
          const toggleCliPaid=async()=>{
            if(pm.client_paid){if(confirm("¿Desmarcar cobro del cliente?")){await dq("payment_management",{method:"PATCH",token,filters:`?id=eq.${pm.id}`,body:{client_paid:false,client_paid_date:null,client_paid_amount_usd:null}});load();}return;}
            const expected=Number(pm.client_amount_usd||0);
            const input=prompt(`¿Cuánto pagó el cliente en USD?\n(Esperado: USD ${expected.toFixed(2)})`,expected.toFixed(2));
            if(input===null)return;
            const amt=Number(String(input).replace(",","."));
            if(isNaN(amt)||amt<0){alert("Monto inválido");return;}
            await dq("payment_management",{method:"PATCH",token,filters:`?id=eq.${pm.id}`,body:{client_paid:true,client_paid_date:new Date().toISOString().slice(0,10),client_paid_amount_usd:amt}});load();
          };
          const StatusCard=({label,value,sub,color,bg,border,onClick,icon})=><div onClick={onClick} style={{flex:1,minWidth:160,padding:"12px 14px",borderRadius:10,border:`1px solid ${border}`,background:bg,cursor:onClick?"pointer":"default",transition:"background 0.15s"}} onMouseEnter={e=>{if(onClick)e.currentTarget.style.background=bg.replace(/[\d.]+\)$/,m=>Math.min(Number(m.slice(0,-1))*1.5,0.2)+")");}} onMouseLeave={e=>{if(onClick)e.currentTarget.style.background=bg;}}>
            <p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</p>
            <p style={{fontSize:13,fontWeight:700,color:color,margin:0,display:"flex",alignItems:"center",gap:6}}>{icon&&<span>{icon}</span>}{value}</p>
            {sub&&<p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"3px 0 0"}}>{sub}</p>}
          </div>;
          return <div key={pm.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:"18px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:13,fontWeight:700,color:IC}}>Pago {i+1}</span>
                {pm.description&&<span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>— {pm.description}</span>}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,fontSize:12,marginBottom:14}}>
              <div><p style={{color:"rgba(255,255,255,0.4)",margin:"0 0 2px",fontSize:10,fontWeight:700}}>CLIENTE PAGA</p><p style={{color:"#fff",fontWeight:600,margin:0}}>{usdF(pm.client_amount_usd)}</p></div>
              <div><p style={{color:"rgba(255,255,255,0.4)",margin:"0 0 2px",fontSize:10,fontWeight:700}}>GIRO AL EXTERIOR</p><p style={{color:"#fff",fontWeight:600,margin:0}}>{usdF(pm.giro_amount_usd||0)}</p></div>
              <div><p style={{color:"rgba(255,255,255,0.4)",margin:"0 0 2px",fontSize:10,fontWeight:700}}>COMISIÓN GIRO</p><p style={{color:"#ff6b6b",fontWeight:600,margin:0}}>{usdF(pm.cost_comision_giro||0)}</p></div>
              <div><p style={{color:"rgba(255,255,255,0.4)",margin:"0 0 2px",fontSize:10,fontWeight:700}}>GANANCIA</p><p style={{color:gan>=0?"#22c55e":"#ff6b6b",fontWeight:700,margin:0}}>{usdF(gan)}</p></div>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"stretch"}}>
              {/* Card: Cliente paga / no pagó */}
              {(()=>{const expected=Number(pm.client_amount_usd||0);const real=Number(pm.client_paid_amount_usd??pm.client_amount_usd??0);const diff=real-expected;const hasDiff=pm.client_paid&&Math.abs(diff)>0.01;
                const value=pm.client_paid?`Cobrado USD ${real.toFixed(2)}`:"Pendiente";
                const sub=pm.client_paid?(hasDiff?`${formatDate(pm.client_paid_date)} · Esperado USD ${expected.toFixed(2)} (${diff>0?"+":""}${diff.toFixed(2)})`:`${formatDate(pm.client_paid_date)}`):"Click para marcar cobrado";
                return <StatusCard
                  label="Cobro cliente"
                  value={value}
                  sub={sub}
                  icon={pm.client_paid?"✓":"○"}
                  color={pm.client_paid?(hasDiff&&diff<0?"#fb923c":"#22c55e"):"#fbbf24"}
                  bg={pm.client_paid?(hasDiff&&diff<0?"rgba(251,146,60,0.08)":"rgba(34,197,94,0.08)"):"rgba(251,191,36,0.06)"}
                  border={pm.client_paid?(hasDiff&&diff<0?"rgba(251,146,60,0.25)":"rgba(34,197,94,0.25)"):"rgba(251,191,36,0.25)"}
                  onClick={toggleCliPaid}
                />;})()}
              {/* Card: Giro */}
              <StatusCard
                label="Estado giro"
                value={gs.l}
                sub={pm.giro_status!=="confirmado"?"Click para avanzar":(pm.giro_date?formatDate(pm.giro_date):null)}
                icon={pm.giro_status==="confirmado"?"✓":pm.giro_status==="enviado"?"↗":"○"}
                color={gs.c}
                bg={`${gs.c}10`}
                border={`${gs.c}33`}
                onClick={pm.giro_status!=="confirmado"?cycleGiro:null}
              />
              {/* Card: Tarjeta (solo si aplica) */}
              {isTarj&&<StatusCard
                label="Tarjeta de crédito"
                value={pm.giro_tarjeta_paid?"Debitada":"Pendiente"}
                sub={pm.giro_tarjeta_paid?(pm.giro_tarjeta_paid_at?`Debitada ${formatDate(pm.giro_tarjeta_paid_at)}`:null):(pm.giro_tarjeta_due_date?`Débito estimado ${formatDate(pm.giro_tarjeta_due_date)}`:"Click para marcar debitada")}
                icon={pm.giro_tarjeta_paid?"💳":"💳"}
                color={pm.giro_tarjeta_paid?"#22c55e":"#fbbf24"}
                bg={pm.giro_tarjeta_paid?"rgba(34,197,94,0.08)":"rgba(251,191,36,0.06)"}
                border={pm.giro_tarjeta_paid?"rgba(34,197,94,0.25)":"rgba(251,191,36,0.25)"}
                onClick={pm.giro_tarjeta_paid?null:markTarjDeb}
              />}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
              <button onClick={()=>delPmt(pm.id)} style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,80,80,0.2)",background:"transparent",color:"rgba(255,107,107,0.7)",cursor:"pointer",fontWeight:500}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,80,80,0.1)";e.currentTarget.style.color="#ff6b6b";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,107,107,0.7)";}}>🗑 Eliminar pago</button>
            </div>
          </div>;})}
        {payments.length===0&&!showNewPmt&&<p style={{color:"rgba(255,255,255,0.45)",textAlign:"center",padding:"1rem 0"}}>No hay gestiones de pago.</p>}
      </Card>
      {showNewPmt&&<Card title="Nueva gestión de pago">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
          <Inp label="Monto que paga el cliente (USD)" type="number" value={newPmt.client_amount_usd} onChange={v=>setNewPmt(p=>({...p,client_amount_usd:v}))} step="0.01"/>
          <Inp label="Monto a girar al exterior (USD)" type="number" value={newPmt.giro_amount_usd} onChange={v=>setNewPmt(p=>({...p,giro_amount_usd:v}))} step="0.01"/>
          <Inp label="Comisión del servicio de giro (USD)" type="number" value={newPmt.cost_comision_giro} onChange={v=>setNewPmt(p=>({...p,cost_comision_giro:v}))} step="0.01"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Inp label="Descripción" value={newPmt.description} onChange={v=>setNewPmt(p=>({...p,description:v}))} placeholder="Ej: Pago proveedor Alibaba"/>
          <Sel label="Método de pago del cliente" value={newPmt.client_payment_method} onChange={v=>setNewPmt(p=>({...p,client_payment_method:v}))} options={[{value:"transferencia",label:"Transferencia"},{value:"efectivo",label:"Efectivo"},{value:"cripto",label:"Cripto"}]}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Sel label="Cómo pagaste el giro" value={newPmt.giro_payment_method||"efectivo"} onChange={v=>setNewPmt(p=>({...p,giro_payment_method:v}))} options={[{value:"efectivo",label:"Efectivo"},{value:"transferencia",label:"Transferencia"},{value:"tarjeta_credito",label:"💳 Tarjeta de crédito"}]}/>
          {newPmt.giro_payment_method==="tarjeta_credito"&&<Inp label="Fecha de débito estimada" type="date" value={newPmt.giro_tarjeta_due_date||""} onChange={v=>setNewPmt(p=>({...p,giro_tarjeta_due_date:v}))}/>}
        </div>
        {newPmt.giro_payment_method==="tarjeta_credito"&&Number(newPmt.giro_amount_usd||0)>0&&<div style={{background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:"#fbbf24",fontWeight:600}}>💳 Se debitará de tu tarjeta</span>
          <span style={{fontSize:14,fontWeight:700,color:"#fbbf24"}}>{usdF(newPmt.giro_amount_usd||0)}</span>
        </div>}
        {Number(newPmt.client_amount_usd||0)>0&&Number(newPmt.giro_amount_usd||0)>0&&<div style={{background:"rgba(34,197,94,0.06)",borderRadius:8,padding:12,marginBottom:12,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Ganancia estimada</span><span style={{fontSize:14,fontWeight:700,color:"#22c55e"}}>{usdF(Number(newPmt.client_amount_usd)-Number(newPmt.giro_amount_usd)-Number(newPmt.cost_comision_giro||0))}</span></div>}
        <div style={{display:"flex",gap:8}}><Btn onClick={savePmt} disabled={saving}>{saving?"Guardando...":"Guardar"}</Btn><Btn variant="secondary" onClick={()=>setShowNewPmt(false)}>Cancelar</Btn></div>
      </Card>}
      </>;
    })()}

    {tab==="finance"&&isGI&&(()=>{
      // Finanzas simplificada para Gestión Integral:
      //   Ingreso = total productos (cant × precio unitario) acordado con el cliente
      //   Cobrado = suma operation_client_payments (plata que efectivamente entró)
      //   Costos = suma operation_supplier_payments (plata que salió o sale al proveedor)
      //   Ganancia = Ingreso − Costos
      const totalIngreso=items.reduce((s,it)=>s+Number(it.unit_price_usd||0)*Number(it.quantity||1),0);
      const totalCobrado=clientPayments.reduce((s,p)=>s+Number(p.amount_usd||0),0);
      const saldoCliente=Math.max(0,totalIngreso-totalCobrado);
      // type='refund' resta al total (reembolso del proveedor)
      const signCost=(p)=>p.type==="refund"?-1:1;
      const totalCostos=supplierPayments.reduce((s,p)=>s+signCost(p)*Number(p.amount_usd||0),0);
      const costoPagado=supplierPayments.filter(p=>p.is_paid).reduce((s,p)=>s+signCost(p)*Number(p.amount_usd||0),0);
      const costoPendiente=totalCostos-costoPagado;
      const ganancia=totalIngreso-totalCostos;
      const margen=totalIngreso>0?(ganancia/totalIngreso)*100:0;
      const cashNeto=totalCobrado-costoPagado;
      const usdF=v=>`USD ${Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
      return <div>
        {/* Cards grandes: Ganancia / Ingreso / Costos / Margen */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:14,marginBottom:18}}>
          <div style={{background:ganancia>=0?"linear-gradient(135deg,rgba(34,197,94,0.14),rgba(34,197,94,0.03))":"linear-gradient(135deg,rgba(255,80,80,0.14),rgba(255,80,80,0.03))",border:`1px solid ${ganancia>=0?"rgba(34,197,94,0.3)":"rgba(255,80,80,0.3)"}`,borderRadius:14,padding:"18px 20px"}}>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Ganancia neta</p>
            <p style={{fontSize:24,fontWeight:800,color:ganancia>=0?"#22c55e":"#ff6b6b",margin:0,fontVariantNumeric:"tabular-nums"}}>{ganancia<0?"−":""}{usdF(ganancia)}</p>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"6px 0 0"}}>Ingreso − costos totales</p>
          </div>
          <div style={{background:"rgba(255,255,255,0.028)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"18px 20px"}}>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Ingreso (productos)</p>
            <p style={{fontSize:24,fontWeight:800,color:"#fff",margin:0,fontVariantNumeric:"tabular-nums"}}>{usdF(totalIngreso)}</p>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"6px 0 0"}}>{items.length} producto{items.length===1?"":"s"} acordados con el cliente</p>
          </div>
          <div style={{background:"rgba(255,80,80,0.04)",border:"1px solid rgba(255,80,80,0.15)",borderRadius:14,padding:"18px 20px"}}>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Costos totales</p>
            <p style={{fontSize:24,fontWeight:800,color:"#ff6b6b",margin:0,fontVariantNumeric:"tabular-nums"}}>{usdF(totalCostos)}</p>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"6px 0 0"}}>{supplierPayments.length} costo{supplierPayments.length===1?"":"s"} registrado{supplierPayments.length===1?"":"s"}</p>
          </div>
          <div style={{background:"rgba(255,255,255,0.028)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"18px 20px"}}>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Margen</p>
            <p style={{fontSize:24,fontWeight:800,color:margen>=20?"#22c55e":margen>=0?"#fbbf24":"#ff6b6b",margin:0}}>{margen.toFixed(1)}%</p>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"6px 0 0"}}>{margen>=30?"Excelente":margen>=15?"Saludable":margen>=0?"Ajustado":"En rojo"}</p>
          </div>
        </div>

        {/* Cash flow actual */}
        <Card title="Estado de caja (lo que ya entró vs lo que ya salió)">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:12}}>
            <div style={{padding:"14px 18px",background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.18)",borderRadius:10}}>
              <p style={{fontSize:10,fontWeight:700,color:"#22c55e",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Cobrado al cliente</p>
              <p style={{fontSize:20,fontWeight:800,color:"#fff",margin:"0 0 4px",fontVariantNumeric:"tabular-nums"}}>{usdF(totalCobrado)}</p>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:0}}>{clientPayments.length} pago{clientPayments.length===1?"":"s"} del cliente{saldoCliente>0.01?` · saldo ${usdF(saldoCliente)} pendiente`:" · ✓ saldado"}</p>
            </div>
            <div style={{padding:"14px 18px",background:"rgba(255,80,80,0.05)",border:"1px solid rgba(255,80,80,0.18)",borderRadius:10}}>
              <p style={{fontSize:10,fontWeight:700,color:"#ff6b6b",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Pagado al proveedor</p>
              <p style={{fontSize:20,fontWeight:800,color:"#fff",margin:"0 0 4px",fontVariantNumeric:"tabular-nums"}}>{usdF(costoPagado)}</p>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:0}}>De USD {totalCostos.toFixed(2)} totales{costoPendiente>0.01?` · ${usdF(costoPendiente)} pendiente de pagar`:" · ✓ todo pagado"}</p>
            </div>
          </div>
          <div style={{padding:"14px 18px",background:cashNeto>=0?"rgba(255,255,255,0.03)":"rgba(251,146,60,0.06)",border:`1px solid ${cashNeto>=0?"rgba(255,255,255,0.08)":"rgba(251,146,60,0.2)"}`,borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div>
              <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Cash neto (lo que entró − lo que salió)</p>
              <p style={{fontSize:22,fontWeight:800,color:cashNeto>=0?"#22c55e":"#fb923c",margin:0,fontVariantNumeric:"tabular-nums"}}>{cashNeto<0?"−":""}{usdF(cashNeto)}</p>
            </div>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:0,maxWidth:320,textAlign:"right",lineHeight:1.5}}>
              {cashNeto<0?`Adelantaste ${usdF(cashNeto)}. Cobrá al cliente para recuperar caja.`:cashNeto>=totalCostos-costoPagado?`Estás en verde: cobraste más de lo que adelantaste.`:`Equilibrado, pero quedan ${usdF(totalCostos-costoPagado)} por pagar al proveedor.`}
            </p>
          </div>
        </Card>

        {/* Cobros del cliente (GI) — CRUD para registrar pagos parciales del cliente */}
        {(()=>{
          const addGiCliPayment=async()=>{
            const amt=Number(newCliPmt.amount_usd);
            if(!amt||amt<=0||!newCliPmt.payment_date)return;
            const body={operation_id:op.id,payment_date:newCliPmt.payment_date,amount_usd:amt,currency:newCliPmt.currency||"USD",payment_method:newCliPmt.payment_method,notes:newCliPmt.notes||null};
            if(newCliPmt.currency==="ARS"){body.amount_ars=Number(newCliPmt.amount_ars||0)||null;body.exchange_rate=Number(newCliPmt.exchange_rate||0)||null;}
            await dq("operation_client_payments",{method:"POST",token,body});
            // Si el cliente ya cubrió el total, marcar op cobrada
            const newTotalCli=totalCobrado+amt;
            if(newTotalCli>=totalIngreso&&totalIngreso>0){
              await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{is_collected:true,collected_amount:newTotalCli,collection_date:newCliPmt.payment_date,collection_method:newCliPmt.payment_method,collection_currency:newCliPmt.currency||"USD"}});
              setOp(p=>({...p,is_collected:true,collected_amount:newTotalCli,collection_date:newCliPmt.payment_date}));
            }
            setNewCliPmt({payment_date:new Date().toISOString().slice(0,10),amount_usd:"",amount_ars:"",exchange_rate:"",currency:"USD",payment_method:"transferencia",notes:""});
            load();
            flash(newTotalCli>=totalIngreso?"Pago registrado — op cobrada ✓":"Pago registrado");
          };
          const delGiCliPayment=async(id)=>{
            if(!confirm("¿Eliminar este pago del cliente?"))return;
            await dq("operation_client_payments",{method:"DELETE",token,filters:`?id=eq.${id}`});
            const rest=clientPayments.filter(p=>p.id!==id);
            const newTotal=rest.reduce((s,p)=>s+Number(p.amount_usd||0),0);
            if(newTotal<totalIngreso){
              await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{is_collected:false}});
              setOp(p=>({...p,is_collected:false}));
            }
            load();
          };
          return <Card title="Cobros del cliente">
            {/* Resumen */}
            <div style={{display:"flex",gap:20,marginBottom:16,flexWrap:"wrap",padding:"14px 18px",background:"rgba(0,0,0,0.2)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
              <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Total acordado</p><p style={{fontSize:20,fontWeight:800,color:"#fff",margin:0,fontVariantNumeric:"tabular-nums"}}>USD {totalIngreso.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
              <div style={{width:1,background:"rgba(255,255,255,0.08)"}}/>
              <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Cobrado</p><p style={{fontSize:20,fontWeight:800,color:"#22c55e",margin:0,fontVariantNumeric:"tabular-nums"}}>USD {totalCobrado.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
              {saldoCliente>0.01&&<>
                <div style={{width:1,background:"rgba(255,255,255,0.08)"}}/>
                <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Saldo pendiente</p><p style={{fontSize:20,fontWeight:800,color:"#fb923c",margin:0,fontVariantNumeric:"tabular-nums"}}>USD {saldoCliente.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
              </>}
              {saldoCliente<=0.01&&totalIngreso>0&&totalCobrado>0&&<>
                <div style={{width:1,background:"rgba(255,255,255,0.08)"}}/>
                <div><p style={{fontSize:10,fontWeight:700,color:"#22c55e",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Estado</p><p style={{fontSize:14,fontWeight:700,color:"#22c55e",margin:"4px 0 0"}}>✓ Saldado</p></div>
              </>}
            </div>
            {/* Lista de pagos */}
            {clientPayments.length>0?<div style={{background:"rgba(0,0,0,0.18)",borderRadius:10,overflow:"hidden",marginBottom:16}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.02)"}}>
                  <th style={{textAlign:"left",padding:"10px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Fecha</th>
                  <th style={{textAlign:"right",padding:"10px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Monto</th>
                  <th style={{textAlign:"left",padding:"10px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Método</th>
                  <th style={{textAlign:"left",padding:"10px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Notas</th>
                  <th style={{padding:"10px 14px"}}></th>
                </tr></thead>
                <tbody>
                  {clientPayments.map(p=><tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.85)",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{new Date(p.payment_date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})}</td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:"#22c55e",fontWeight:700,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>USD {Number(p.amount_usd).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}{p.currency==="ARS"&&p.amount_ars?<span style={{display:"block",fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:400}}>ARS {Number(p.amount_ars).toLocaleString("es-AR")} @ {p.exchange_rate}</span>:null}</td>
                    <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.6)",textTransform:"capitalize"}}>{(p.payment_method||"—").replace("_"," ")}</td>
                    <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.55)",fontSize:11}}>{p.notes||"—"}</td>
                    <td style={{padding:"10px 14px",textAlign:"right"}}><button onClick={()=>delGiCliPayment(p.id)} style={{padding:"4px 9px",fontSize:11,background:"transparent",border:"1px solid rgba(255,80,80,0.25)",borderRadius:4,color:"rgba(255,100,100,0.7)",cursor:"pointer"}}>✕</button></td>
                  </tr>)}
                </tbody>
              </table>
            </div>:<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"1rem 0",fontSize:13}}>Sin pagos del cliente registrados todavía.</p>}
            {/* Form nuevo pago */}
            <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"16px 18px"}}>
              <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Registrar cobro del cliente</p>
              <div style={{display:"grid",gridTemplateColumns:"140px 1fr 100px 1.3fr",gap:10,alignItems:"end",marginBottom:10}}>
                <Inp label="Fecha" type="date" value={newCliPmt.payment_date} onChange={v=>setNewCliPmt(p=>({...p,payment_date:v}))}/>
                <Inp label="Monto" type="number" value={newCliPmt.amount_usd} onChange={v=>setNewCliPmt(p=>({...p,amount_usd:v}))} step="0.01" placeholder="0.00"/>
                <Sel label="Moneda" value={newCliPmt.currency||"USD"} onChange={v=>setNewCliPmt(p=>({...p,currency:v}))} options={[{value:"USD",label:"USD"},{value:"ARS",label:"ARS"}]}/>
                <Sel label="Método" value={newCliPmt.payment_method} onChange={v=>setNewCliPmt(p=>({...p,payment_method:v}))} options={[{value:"transferencia",label:"Transferencia"},{value:"efectivo",label:"Contado"},{value:"tarjeta_credito",label:"Tarjeta de Crédito"},{value:"mercado_pago",label:"Mercado Pago"},{value:"otro",label:"Otro"}]}/>
              </div>
              {newCliPmt.currency==="ARS"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10,padding:"10px 14px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.18)",borderRadius:8}}>
                <Inp label="Monto ARS" type="number" value={newCliPmt.amount_ars} onChange={v=>setNewCliPmt(p=>({...p,amount_ars:v}))} step="0.01"/>
                <Inp label="Tipo de cambio" type="number" value={newCliPmt.exchange_rate} onChange={v=>setNewCliPmt(p=>({...p,exchange_rate:v}))} step="0.01" placeholder="Ej: 1410"/>
              </div>}
              <div style={{display:"grid",gridTemplateColumns:"3fr auto",gap:10,alignItems:"end"}}>
                <Inp label="Notas (opcional)" value={newCliPmt.notes} onChange={v=>setNewCliPmt(p=>({...p,notes:v}))} placeholder="Ej: 30% anticipo producción"/>
                <Btn onClick={addGiCliPayment} disabled={!newCliPmt.amount_usd||Number(newCliPmt.amount_usd)<=0} small>+ Registrar cobro</Btn>
              </div>
            </div>
          </Card>;
        })()}
      </div>;
    })()}

    {tab==="finance"&&!isGI&&(()=>{
      const costFlete=Number(op.cost_flete||0);const costImp=Number(op.cost_impuestos_reales||0);const costDoc=Number(op.cost_gasto_documental||0);const costSeg=Number(op.cost_seguro||0);const costLocal=Number(op.cost_flete_local||0);const costOtros=Number(op.cost_otros||0);
      const costProducto=op.service_type==="gestion_integral"?Number(op.cost_producto_usd||0):0;
      const totalCostos=costFlete+costImp+costDoc+costSeg+costLocal+costOtros+costProducto;
      const presupuesto=Number(op.budget_total||0);
      // Si el cobro es en ARS, convertir a USD usando el exchange rate
      const cobroRaw=Number(op.collected_amount||0);
      const isArsCollection=op.collection_currency==="ARS";
      const colRate=Number(op.collection_exchange_rate||0);
      const cobroUsd=isArsCollection&&colRate>0?cobroRaw/colRate:cobroRaw;
      // Crédito aplicado de la cuenta corriente del cliente (parte del cobro no-cash)
      const creditApplied=Number(op.credit_applied_usd||0);
      // Descuento intencional del admin (ese monto no se pierde — es descuento a propósito, no deuda)
      const discountApplied=Number(op.discount_applied_usd||0);
      // Ingreso efectivo: cash recibido + crédito de CC + descuento (el descuento se contabiliza como ingreso "virtual" para no inflar pérdidas)
      const cobro=(cobroUsd+creditApplied+discountApplied)||presupuesto;
      const feePct=Number(op.collection_fee_pct||0);const isTransf=op.collection_method==="transferencia";
      // La comisión solo aplica al cash real que recibiste por transferencia (no al crédito de CC ni descuento)
      const comision=isTransf?cobroUsd*(feePct/100):0;
      const ingresoNeto=cobro-comision;
      // Gestión de pagos: ganancia = cliente paga - giro - comision giro
      const pmtRevenue=payments.reduce((s,p)=>s+Number(p.client_amount_usd||0),0);
      const pmtCosts=payments.reduce((s,p)=>s+Number(p.giro_amount_usd||0)+Number(p.cost_comision_giro||0),0);
      const pmtGanancia=pmtRevenue-pmtCosts;
      const ganancia=(ingresoNeto-totalCostos)+pmtGanancia;
      const ingresoTotal=ingresoNeto+pmtRevenue;
      const margen=ingresoTotal>0?((ganancia/ingresoTotal)*100):0;
      const rw=(l,v,bold,color)=><div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",...(bold?{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:10}:{})}}><span style={{fontSize:13,color:bold?"#fff":"rgba(255,255,255,0.5)",fontWeight:bold?700:400}}>{l}</span><span style={{fontSize:bold?16:13,fontWeight:bold?700:600,color:color||"#fff"}}>USD {v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>;
      return <>
      {op.service_type==="gestion_integral"&&(()=>{
        const totalCli=clientPayments.reduce((s,p)=>s+Number(p.amount_usd||0),0);
        const budgetTot=Number(op.budget_total||0);
        const saldoCli=budgetTot-totalCli;
        const pctCobrado=budgetTot>0?Math.min(100,(totalCli/budgetTot)*100):0;
        const addCliPayment=async()=>{
          const amtUsd=Number(newCliPmt.amount_usd);
          const amtArs=Number(newCliPmt.amount_ars);
          const rate=Number(newCliPmt.exchange_rate);
          // Si moneda=ARS: se requiere rate para convertir a USD
          let finalAmtUsd=amtUsd;
          if(newCliPmt.currency==="ARS"){
            if(!amtArs||amtArs<=0||!rate||rate<=0){alert("Para pagos en ARS necesitás el monto ARS y el tipo de cambio");return;}
            finalAmtUsd=amtArs/rate;
          } else {
            if(!amtUsd||amtUsd<=0){alert("Ingresá el monto USD");return;}
          }
          if(!newCliPmt.payment_date)return;
          const body={operation_id:op.id,payment_date:newCliPmt.payment_date,amount_usd:finalAmtUsd,currency:newCliPmt.currency,payment_method:newCliPmt.payment_method,notes:newCliPmt.notes||null};
          if(newCliPmt.currency==="ARS"){body.amount_ars=amtArs;body.exchange_rate=rate;}
          await dq("operation_client_payments",{method:"POST",token,body});
          // Sync total_anticipos y si se completa, marcar is_collected
          const newTotal=totalCli+finalAmtUsd;
          const opUpdate={total_anticipos:newTotal};
          if(newTotal>=budgetTot&&budgetTot>0){
            opUpdate.is_collected=true;
            opUpdate.collected_amount=newTotal;
            opUpdate.collection_date=newCliPmt.payment_date;
            opUpdate.collection_method=newCliPmt.payment_method;
            opUpdate.collection_currency=newCliPmt.currency;
            if(newCliPmt.currency==="ARS")opUpdate.collection_exchange_rate=rate;
          }
          await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:opUpdate});
          setOp(p=>({...p,...opUpdate}));
          // Detectar overpayment → ofrecer registrarlo como saldo a favor en CC
          const diff=newTotal-budgetTot;
          if(budgetTot>0&&diff>0.01&&op.client_id){
            if(confirm(`El cliente pagó USD ${diff.toFixed(2)} de más.\n\n¿Registrar el excedente como saldo a favor en la cuenta corriente del cliente?`)){
              await dq("client_account_movements",{method:"POST",token,body:{client_id:op.client_id,operation_id:op.id,type:"overpayment",amount_usd:diff,description:`Excedente de ${op.operation_code}`}});
              flash(`Saldo a favor registrado: +USD ${diff.toFixed(2)}`);
            }
          }
          setNewCliPmt({payment_date:new Date().toISOString().slice(0,10),amount_usd:"",amount_ars:"",exchange_rate:"",currency:"USD",payment_method:"transferencia",notes:""});
          load();
          flash(newTotal>=budgetTot?"Pago registrado — op cobrada ✓":"Anticipo registrado");
        };
        const deleteCliPayment=async(id)=>{
          if(!confirm("¿Eliminar este pago del cliente?"))return;
          await dq("operation_client_payments",{method:"DELETE",token,filters:`?id=eq.${id}`});
          const remaining=clientPayments.filter(p=>p.id!==id);
          const newTotal=remaining.reduce((s,p)=>s+Number(p.amount_usd||0),0);
          const opUpdate={total_anticipos:newTotal};
          if(newTotal<budgetTot)opUpdate.is_collected=false;
          await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:opUpdate});
          setOp(p=>({...p,...opUpdate}));
          load();
        };
        const closeWithDiscount=async()=>{
          if(saldoCli<=0.01)return;
          if(!confirm(`Estás por cerrar esta op con un DESCUENTO de USD ${saldoCli.toFixed(2)}.\n\nEl cliente pagó USD ${totalCli.toFixed(2)} sobre un presupuesto de USD ${budgetTot.toFixed(2)}. La diferencia NO queda como deuda — queda como descuento intencional registrado en la op.\n\n¿Confirmás?`))return;
          const opUpdate={is_collected:true,collected_amount:totalCli,collection_date:new Date().toISOString().slice(0,10),discount_applied_usd:saldoCli};
          if(clientPayments.length>0){opUpdate.collection_method=clientPayments[clientPayments.length-1].payment_method;opUpdate.collection_currency=clientPayments[clientPayments.length-1].currency||"USD";}
          await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:opUpdate});
          setOp(p=>({...p,...opUpdate}));
          flash(`Op cerrada con descuento de USD ${saldoCli.toFixed(2)}`);
        };
        const registerDebt=async()=>{
          if(saldoCli<=0.01||!op.client_id)return;
          if(!confirm(`El cliente quedó debiendo USD ${saldoCli.toFixed(2)}.\n\nVamos a registrarlo como deuda en su cuenta corriente (se podrá aplicar a próximas operaciones).\n\n¿Confirmás?`))return;
          const opUpdate={is_collected:true,collected_amount:totalCli,collection_date:new Date().toISOString().slice(0,10)};
          await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:opUpdate});
          await dq("client_account_movements",{method:"POST",token,body:{client_id:op.client_id,operation_id:op.id,type:"debt",amount_usd:-saldoCli,description:`Deuda pendiente de ${op.operation_code}`}});
          setOp(p=>({...p,...opUpdate}));
          flash(`Deuda registrada: -USD ${saldoCli.toFixed(2)}`);
        };
        return <Card title="Anticipos / Pagos del cliente">
          <div style={{display:"flex",gap:16,marginBottom:12,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",gap:20,fontSize:12,color:"rgba(255,255,255,0.7)",flexWrap:"wrap"}}>
              <span><b style={{color:"rgba(255,255,255,0.5)"}}>Presupuesto:</b> USD {budgetTot.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
              <span><b style={{color:"#22c55e"}}>Cobrado:</b> USD {totalCli.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
              {saldoCli>0.01&&<span><b style={{color:"#fb923c"}}>Saldo:</b> USD {saldoCli.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>}
              {saldoCli<=0.01&&totalCli>0&&<span style={{color:"#22c55e",fontWeight:700}}>✓ Op cobrada</span>}
              {Number(op.discount_applied_usd||0)>0&&<span style={{color:GOLD_LIGHT,fontWeight:700}}>🎟 Descuento USD {Number(op.discount_applied_usd).toFixed(2)}</span>}
            </div>
            {saldoCli>0.01&&totalCli>0&&!op.is_collected&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn onClick={closeWithDiscount} variant="secondary" small>🎟 Cerrar con descuento</Btn>
              <Btn onClick={registerDebt} variant="secondary" small>Cerrar y registrar deuda</Btn>
            </div>}
          </div>
          {budgetTot>0&&<div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden",marginBottom:14}}>
            <div style={{width:`${pctCobrado}%`,height:"100%",background:pctCobrado>=100?"#22c55e":pctCobrado>=50?"#60a5fa":"#fb923c",transition:"width 0.3s"}}/>
          </div>}
          {clientPayments.length>0&&<div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,marginBottom:12}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                  <th style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Fecha</th>
                  <th style={{textAlign:"right",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Monto</th>
                  <th style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Método</th>
                  <th style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Notas</th>
                  <th style={{padding:"8px 12px"}}></th>
                </tr>
              </thead>
              <tbody>
                {clientPayments.map(p=><tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <td style={{padding:"8px 12px",color:"rgba(255,255,255,0.85)",fontVariantNumeric:"tabular-nums"}}>{new Date(p.payment_date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})}</td>
                  <td style={{padding:"8px 12px",textAlign:"right",color:"#22c55e",fontWeight:700,fontVariantNumeric:"tabular-nums"}}>USD {Number(p.amount_usd).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}{p.currency==="ARS"&&<span style={{display:"block",fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:400}}>ARS {Number(p.amount_ars).toLocaleString("es-AR")} @ {p.exchange_rate}</span>}</td>
                  <td style={{padding:"8px 12px",color:"rgba(255,255,255,0.6)",textTransform:"capitalize"}}>{p.payment_method}</td>
                  <td style={{padding:"8px 12px",color:"rgba(255,255,255,0.5)",fontSize:11}}>{p.notes||""}</td>
                  <td style={{padding:"8px 12px",textAlign:"right"}}><button onClick={()=>deleteCliPayment(p.id)} style={{padding:"4px 8px",fontSize:11,background:"transparent",border:"1px solid rgba(255,80,80,0.25)",borderRadius:4,color:"rgba(255,100,100,0.7)",cursor:"pointer"}}>✕</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>}
          <div style={{background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.15)",borderRadius:10,padding:"12px 14px"}}>
            <p style={{fontSize:11,fontWeight:700,color:"#22c55e",margin:"0 0 10px",textTransform:"uppercase"}}>Nuevo pago del cliente</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 10px",marginBottom:8}}>
              <Inp label="Fecha" type="date" value={newCliPmt.payment_date} onChange={v=>setNewCliPmt(p=>({...p,payment_date:v}))}/>
              <Sel label="Moneda" value={newCliPmt.currency} onChange={v=>setNewCliPmt(p=>({...p,currency:v}))} options={[{value:"USD",label:"USD"},{value:"ARS",label:"ARS"}]}/>
              <Sel label="Método" value={newCliPmt.payment_method} onChange={v=>setNewCliPmt(p=>({...p,payment_method:v}))} options={[{value:"transferencia",label:"Transferencia"},{value:"efectivo",label:"Efectivo"},{value:"cripto",label:"Cripto"},{value:"otro",label:"Otro"}]}/>
              <Inp label="Notas (opcional)" value={newCliPmt.notes} onChange={v=>setNewCliPmt(p=>({...p,notes:v}))} placeholder="Ej: 30% inicio"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:newCliPmt.currency==="ARS"?"1fr 1fr 1fr auto":"1fr auto",gap:"0 10px",alignItems:"end"}}>
              {newCliPmt.currency==="USD"?<Inp label="Monto USD" type="number" value={newCliPmt.amount_usd} onChange={v=>setNewCliPmt(p=>({...p,amount_usd:v}))} step="0.01" placeholder="0.00"/>:<>
                <Inp label="Monto ARS" type="number" value={newCliPmt.amount_ars} onChange={v=>setNewCliPmt(p=>({...p,amount_ars:v}))} step="0.01" placeholder="0"/>
                <Inp label="Tipo de cambio ARS/USD" type="number" value={newCliPmt.exchange_rate} onChange={v=>setNewCliPmt(p=>({...p,exchange_rate:v}))} step="0.01" placeholder="Ej: 1410"/>
                <div style={{paddingBottom:6}}><p style={{fontSize:10,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>EQUIVALENTE USD</p><p style={{fontSize:14,fontWeight:700,color:"#22c55e",margin:0}}>{Number(newCliPmt.amount_ars||0)>0&&Number(newCliPmt.exchange_rate||0)>0?`USD ${(Number(newCliPmt.amount_ars)/Number(newCliPmt.exchange_rate)).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}</p></div>
              </>}
              <Btn onClick={addCliPayment} small>+ Agregar</Btn>
            </div>
          </div>
          <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"10px 0 0",fontStyle:"italic"}}>Cada anticipo aparece en el libro diario como ingreso en su fecha. Cuando la suma de pagos alcanza el presupuesto total, la op se marca automáticamente como cobrada.</p>
        </Card>;
      })()}
      {(()=>{
        const budgetTot=Number(op.budget_total||0);
        const cobroRaw=Number(op.collected_amount||0);
        const isArsCol=op.collection_currency==="ARS";
        const colRate=Number(op.collection_exchange_rate||0);
        const cobroUsd=isArsCol&&colRate>0?cobroRaw/colRate:cobroRaw;
        const creditBal=Number(opClient?.account_balance_usd||0); // saldo a favor del cliente (puede ser negativo = deuda)
        const creditApplied=Number(op.credit_applied_usd||0); // ya aplicado a esta op
        // Para detectar diff, incluimos crédito aplicado de CC como "pago"
        const cobroEffective=cobroUsd+creditApplied;
        const diff=cobroEffective-budgetTot; // + = pagó de más, - = pagó de menos
        const saveCobro=async()=>{
          if(op.is_collected&&isArsCol&&!colRate){alert("El cobro es en ARS: cargá el tipo de cambio primero");return;}
          if(op.is_collected&&budgetTot>0){
            if(diff>0.01){
              if(confirm(`El cliente pagó USD ${diff.toFixed(2)} de más.\n\n¿Registrar el excedente como saldo a favor en la cuenta corriente?`)){
                // Capear collected_amount al budget: el excedente queda en CC, no infla la ganancia
                setOp(p=>({...p,collected_amount:budgetTot}));
                await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{collected_amount:budgetTot,is_collected:true,collection_date:op.collection_date||new Date().toISOString().slice(0,10),collection_currency:op.collection_currency||"USD",collection_method:op.collection_method||"transferencia",...(op.collection_currency==="ARS"&&colRate?{collection_exchange_rate:colRate}:{})}});
                await dq("client_account_movements",{method:"POST",token,body:{client_id:op.client_id,operation_id:op.id,type:"overpayment",amount_usd:diff,description:`Excedente de ${op.operation_code}`}});
                flash(`Cobrada · saldo a favor +USD ${diff.toFixed(2)}`);
                return;
              }
            } else if(diff<-0.01){
              const choice=window.prompt(`El cliente pagó USD ${Math.abs(diff).toFixed(2)} MENOS que el presupuesto.\n\nEscribí:\n  d = DESCUENTO intencional (no genera deuda)\n  c = queda como DEUDA en CC\n\nSi cancelás, no se guardan cambios.`,"d");
              if(choice===null)return;
              if(choice==="d"||choice==="D"){
                await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{discount_applied_usd:Math.abs(diff)}});
                setOp(p=>({...p,discount_applied_usd:Math.abs(diff)}));
                await saveOp();
                flash(`Cobrada con descuento de USD ${Math.abs(diff).toFixed(2)}`);
                return;
              } else if(choice==="c"||choice==="C"){
                await saveOp();
                await dq("client_account_movements",{method:"POST",token,body:{client_id:op.client_id,operation_id:op.id,type:"debt",amount_usd:diff,description:`Deuda pendiente de ${op.operation_code}`}});
                flash(`Cobrada · deuda registrada -USD ${Math.abs(diff).toFixed(2)}`);
                return;
              } else {alert("Opción inválida. Escribí 'd' o 'c'");return;}
            }
          }
          await saveOp();
        };
        const applySaldo=async()=>{
          if(creditBal<=0)return;
          const maxToApply=Math.min(creditBal,budgetTot-cobroUsd);
          if(maxToApply<=0){alert("No hay saldo pendiente por cubrir en esta op");return;}
          const inpStr=window.prompt(`El cliente tiene USD ${creditBal.toFixed(2)} a favor.\n\n¿Cuánto aplicar a esta operación? (máximo USD ${maxToApply.toFixed(2)})`,maxToApply.toFixed(2));
          if(!inpStr)return;
          const amt=Number(inpStr);
          if(!amt||amt<=0||amt>creditBal+0.01){alert("Monto inválido");return;}
          await dq("client_account_movements",{method:"POST",token,body:{client_id:op.client_id,operation_id:op.id,type:"applied",amount_usd:-amt,description:`Aplicado a ${op.operation_code}`}});
          const newApplied=creditApplied+amt;
          await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{credit_applied_usd:newApplied}});
          setOp(p=>({...p,credit_applied_usd:newApplied}));
          flash(`Aplicado USD ${amt.toFixed(2)} del saldo a favor`);
          // refetch client balance
          const fresh=await dq("clients",{token,filters:`?id=eq.${op.client_id}&select=account_balance_usd`});
          if(Array.isArray(fresh)&&fresh[0])setOpClient(p=>({...p,account_balance_usd:fresh[0].account_balance_usd}));
        };
        const totalParciales=clientPayments.reduce((s,p)=>s+Number(p.amount_usd||0),0);
        const saldoParciales=budgetTot-totalParciales;
        return <Card title="Cobro" actions={<div style={{display:"flex",gap:6}}><Btn small variant="secondary" onClick={()=>{setAddPaymentForm({amount_usd:"",amount_ars:"",exchange_rate:"",currency:"USD",payment_method:"transferencia",payment_date:new Date().toISOString().slice(0,10),notes:""});setShowAddPayment(true);}}>+ Cobro adicional</Btn><Btn onClick={saveCobro} disabled={saving} small>{saving?"Guardando...":"Guardar"}</Btn></div>}>
        {/* Banner: cliente con saldo a favor */}
        {creditBal>0.01&&!op.is_collected&&budgetTot>0&&<div style={{marginBottom:12,padding:"12px 16px",background:"linear-gradient(90deg, rgba(34,197,94,0.1), rgba(34,197,94,0.02))",border:"1px solid rgba(34,197,94,0.3)",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div>
            <p style={{fontSize:12,fontWeight:700,color:"#22c55e",margin:0}}>★ Cliente con saldo a favor: USD {creditBal.toFixed(2)}</p>
            {creditApplied>0&&<p style={{fontSize:11,color:"rgba(255,255,255,0.55)",margin:"3px 0 0"}}>Ya aplicaste USD {creditApplied.toFixed(2)} a esta op.</p>}
          </div>
          <Btn onClick={applySaldo} small>Aplicar a esta op →</Btn>
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
          <Inp label={`Monto cobrado (${op.collection_currency||"USD"})`} type="number" value={op.collected_amount||op.budget_total} onChange={chOp("collected_amount")} step="0.01"/>
          <Sel label="Método de cobro" value={op.collection_method||"transferencia"} onChange={chOp("collection_method")} options={[{value:"efectivo",label:"Efectivo"},{value:"transferencia",label:"Transferencia"},{value:"cripto",label:"Cripto"}]}/>
          <Sel label="Moneda" value={op.collection_currency||"USD"} onChange={chOp("collection_currency")} options={[{value:"USD",label:"USD"},{value:"ARS",label:"ARS"}]}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
          {(op.collection_method==="transferencia")&&<Inp label="Comisión transferencia %" type="number" value={op.collection_fee_pct||""} onChange={chOp("collection_fee_pct")} step="0.1" placeholder="0"/>}
          {op.collection_currency==="ARS"&&<Inp label="Tipo de cambio (ARS/USD)" type="number" value={op.collection_exchange_rate} onChange={chOp("collection_exchange_rate")} step="0.01" placeholder="Ej: 1200"/>}
          <Inp label="Fecha de cobro" type="date" value={op.collection_date||""} onChange={chOp("collection_date")}/>
        </div>
        {/* Aviso de diff (considerando CC aplicado) */}
        {(cobroRaw>0||creditApplied>0)&&budgetTot>0&&(()=>{
          if(Math.abs(diff)<0.01)return <div style={{padding:"9px 14px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:8,fontSize:12,color:"#22c55e",marginBottom:8,fontWeight:500}}>✓ Monto coincide con el presupuesto{creditApplied>0?` (USD ${cobroUsd.toFixed(2)} cash + USD ${creditApplied.toFixed(2)} saldo CC)`:""}</div>;
          if(diff>0)return <div style={{padding:"9px 14px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.22)",borderRadius:8,fontSize:12,color:"#22c55e",marginBottom:8}}>Pagó <strong>USD {diff.toFixed(2)} de más</strong>. Al marcar cobrada se registra como saldo a favor.</div>;
          return <div style={{padding:"9px 14px",background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.22)",borderRadius:8,fontSize:12,color:"#fbbf24",marginBottom:8}}>Faltan <strong>USD {Math.abs(diff).toFixed(2)}</strong>. Al marcar cobrada elegís: descuento o deuda.</div>;
        })()}
        {/* Mini-tabla de cobros parciales — solo si hay >=1 pagos parciales registrados */}
        {clientPayments.length>0&&<div style={{background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.18)",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
            <p style={{fontSize:11,fontWeight:700,color:"#22c55e",margin:0,textTransform:"uppercase",letterSpacing:"0.05em"}}>📋 Cobros parciales registrados ({clientPayments.length})</p>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.6)",margin:0}}>Total: <strong style={{color:"#fff"}}>USD {totalParciales.toFixed(2)}</strong>{budgetTot>0?` · Saldo ${saldoParciales>0.01?`USD ${saldoParciales.toFixed(2)}`:saldoParciales<-0.01?`+USD ${Math.abs(saldoParciales).toFixed(2)} (sobrante)`:`$0 ✓`}`:""}</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {clientPayments.map(p=>{const isArs=p.currency==="ARS";return <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",background:"rgba(0,0,0,0.18)",borderRadius:6,fontSize:12}}>
              <span style={{color:"rgba(255,255,255,0.65)"}}>{formatDate(p.payment_date)} · {p.payment_method||"—"}{p.notes?` · ${p.notes}`:""}</span>
              <span style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontFamily:"monospace",color:"#fff",fontWeight:600}}>USD {Number(p.amount_usd).toFixed(2)}{isArs?` (ARS ${Number(p.amount_ars||0).toLocaleString("es-AR")} @ ${p.exchange_rate})`:""}</span>
                <button onClick={()=>printReceiptPdf({op,payment:p,client:opClient})} title="Generar recibo PDF para enviar al cliente" style={{background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.3)",color:"#60a5fa",cursor:"pointer",fontSize:10,padding:"3px 8px",borderRadius:4,fontWeight:700}}>📄 Recibo</button>
                <button onClick={async()=>{if(!confirm("¿Eliminar este cobro parcial?"))return;await dq("operation_client_payments",{method:"DELETE",token,filters:`?id=eq.${p.id}`});const newTot=clientPayments.filter(x=>x.id!==p.id).reduce((s,x)=>s+Number(x.amount_usd||0),0);const upd={collected_amount:newTot};if(newTot<budgetTot)upd.is_collected=false;await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:upd});setOp(prev=>({...prev,...upd}));await load();flash("Cobro eliminado");}} title="Eliminar este cobro" style={{background:"transparent",border:"none",color:"rgba(255,80,80,0.7)",cursor:"pointer",fontSize:14,padding:"0 4px"}}>×</button>
              </span>
            </div>;})}
          </div>
        </div>}
        {payments.length>0&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.12)",borderRadius:10,padding:"12px 16px",marginBottom:12}}><p style={{fontSize:12,fontWeight:600,color:IC,margin:"0 0 2px"}}>Esta operación tiene gestión de pagos internacionales (servicio aparte)</p><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:0}}>El cobro de esta operación es independiente. Ver detalles en tab "Pagos".</p></div>}
        {/* Toggle switch "cobrada" — estilo moderno */}
        <div style={{marginTop:6,marginBottom:2,padding:"12px 16px",background:op.is_collected?"linear-gradient(90deg, rgba(34,197,94,0.12), rgba(34,197,94,0.02))":"rgba(255,255,255,0.028)",border:`1px solid ${op.is_collected?"rgba(34,197,94,0.35)":"rgba(255,255,255,0.08)"}`,borderRadius:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,transition:"all 180ms"}}>
          <div>
            <p style={{fontSize:13,fontWeight:700,color:op.is_collected?"#22c55e":"#fff",margin:0,letterSpacing:"0.01em"}}>{op.is_collected?"Operación cobrada":"Marcar como cobrada"}</p>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"3px 0 0"}}>{op.is_collected?"La operación está cerrada y figura en el libro de finanzas.":"Activá cuando recibas el pago del cliente."}</p>
          </div>
          {/* Toggle switch */}
          <div onClick={()=>chOp("is_collected")(!op.is_collected)} style={{flexShrink:0,width:52,height:28,background:op.is_collected?"linear-gradient(135deg, #22c55e, #10b981)":"rgba(255,255,255,0.1)",borderRadius:999,position:"relative",cursor:"pointer",transition:"all 200ms",boxShadow:op.is_collected?"0 0 12px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.2)":"inset 0 1px 3px rgba(0,0,0,0.3)"}}>
            <div style={{position:"absolute",top:2,left:op.is_collected?26:2,width:24,height:24,borderRadius:"50%",background:"#fff",boxShadow:"0 2px 6px rgba(0,0,0,0.25)",transition:"left 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {op.is_collected&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
          </div>
        </div>
      </Card>;})()}
      <Card title={op.service_type==="gestion_integral"?"Costos reales (Gestión Integral)":"Costos reales"} actions={<Btn onClick={async()=>{setSaving(true);
        // Save flete
        const fleteMethod=op.cost_flete_method||"cuenta_corriente";
        const fleteAmt=Number(op.cost_flete||0);
        // Save impuestos + gasto doc ARS → auto-create finance_entries
        const impArs=Number(op.cost_impuestos_ars||0);
        const docArs=Number(op.cost_gasto_documental_ars||0);
        // Save operation first
        const{id,clients,...rest}=op;delete rest.created_at;delete rest.updated_at;
        await dq("operations",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});
        // CC deduction for flete if new
        if(fleteMethod==="cuenta_corriente"&&fleteAmt>0){
          const existing=await dq("supplier_account_movements",{token,filters:`?operation_id=eq.${id}&type=eq.deduccion&select=id`});
          if(!Array.isArray(existing)||existing.length===0){
            await dq("supplier_account_movements",{method:"POST",token,body:{type:"deduccion",amount_usd:fleteAmt,description:`Flete ${op.operation_code}`,operation_id:id,date:new Date().toISOString().slice(0,10)}});
            await loadCCBalance();
          }
        }
        // Auto-create finance_entry for impuestos ARS
        const impMethod=op.cost_impuestos_method||"tarjeta_credito";
        if(impArs>0&&op.cost_impuestos_card_closing){
          const existImp=await dq("finance_entries",{token,filters:`?operation_id=eq.${id}&description=like.Impuestos*&auto_generated=eq.true&select=id`});
          if(!Array.isArray(existImp)||existImp.length===0){
            if(impMethod==="efectivo"){
              // Contado: dollarizar de una y registrar como pagado. cost_impuestos_card_closing funciona como tipo de cambio
              const rate=Number(op.cost_impuestos_card_closing||0);
              if(rate>0){const usdAmt=Math.round((impArs/rate)*100)/100;
                await dq("finance_entries",{method:"POST",token,body:{date:new Date().toISOString().slice(0,10),type:"gasto",description:`Impuestos ${op.operation_code} (ARS ${impArs.toLocaleString("es-AR")} @ ${rate})`,amount:usdAmt,amount_ars:impArs,exchange_rate:rate,currency:"USD",payment_method:"efectivo",is_paid:true,auto_generated:true,operation_id:id}});
                await dq("operations",{method:"PATCH",token,filters:`?id=eq.${id}`,body:{cost_impuestos_reales:usdAmt}});setOp(p=>({...p,cost_impuestos_reales:usdAmt}));}
            } else {
              await dq("finance_entries",{method:"POST",token,body:{date:new Date().toISOString().slice(0,10),type:"gasto",description:`Impuestos ${op.operation_code}`,amount_ars:impArs,currency:"ARS",payment_method:"tarjeta_credito",card_closing_date:op.cost_impuestos_card_closing,is_paid:false,auto_generated:true,operation_id:id}});
            }
          }
        }
        // Auto-create finance_entry for gasto documental ARS
        const docMethod=op.cost_gasto_doc_method||"tarjeta_credito";
        if(docArs>0&&op.cost_gasto_doc_card_closing){
          const existDoc=await dq("finance_entries",{token,filters:`?operation_id=eq.${id}&description=like.Gasto doc*&auto_generated=eq.true&select=id`});
          if(!Array.isArray(existDoc)||existDoc.length===0){
            if(docMethod==="efectivo"){
              const rate=Number(op.cost_gasto_doc_card_closing||0);
              if(rate>0){const usdAmt=Math.round((docArs/rate)*100)/100;
                await dq("finance_entries",{method:"POST",token,body:{date:new Date().toISOString().slice(0,10),type:"gasto",description:`Gasto documental ${op.operation_code} (ARS ${docArs.toLocaleString("es-AR")} @ ${rate})`,amount:usdAmt,amount_ars:docArs,exchange_rate:rate,currency:"USD",payment_method:"efectivo",is_paid:true,auto_generated:true,operation_id:id}});
                await dq("operations",{method:"PATCH",token,filters:`?id=eq.${id}`,body:{cost_gasto_documental:usdAmt}});setOp(p=>({...p,cost_gasto_documental:usdAmt}));}
            } else {
              await dq("finance_entries",{method:"POST",token,body:{date:new Date().toISOString().slice(0,10),type:"gasto",description:`Gasto documental ${op.operation_code}`,amount_ars:docArs,currency:"ARS",payment_method:"tarjeta_credito",card_closing_date:op.cost_gasto_doc_card_closing,is_paid:false,auto_generated:true,operation_id:id}});
            }
          }
        }
        // Auto-create/update consolidated "Costos" entry in finanzas (USD costs)
        const totalCostosUSD=Number(op.cost_flete||0)+Number(op.cost_impuestos_reales||0)+Number(op.cost_gasto_documental||0)+Number(op.cost_seguro||0)+Number(op.cost_flete_local||0)+Number(op.cost_otros||0);
        flash("Costos guardados");setSaving(false);
      }} disabled={saving} small>{saving?"Guardando...":"Guardar"}</Btn>}>
        {op.service_type==="gestion_integral"&&(()=>{
          const totalProducto=supplierPayments.reduce((s,p)=>s+Number(p.amount_usd||0),0);
          const totalPagado=supplierPayments.filter(p=>p.is_paid).reduce((s,p)=>s+Number(p.amount_usd||0),0);
          const totalPendiente=totalProducto-totalPagado;
          const addSupPayment=async()=>{
            const amt=Number(newSupPmt.amount_usd);
            if(!amt||amt<=0||!newSupPmt.payment_date)return;
            const body={operation_id:op.id,payment_date:newSupPmt.payment_date,amount_usd:amt,payment_method:newSupPmt.payment_method,is_paid:newSupPmt.is_paid,notes:newSupPmt.notes||null,paid_at:newSupPmt.is_paid?new Date(newSupPmt.payment_date+"T12:00:00Z").toISOString():null};
            await dq("operation_supplier_payments",{method:"POST",token,body});
            // Sync cost_producto_usd and paid_at en la op
            const newTotal=totalProducto+amt;
            const allPayments=[...supplierPayments,{...body,amount_usd:amt}];
            const allPaid=allPayments.every(p=>p.is_paid);
            const lastPaidDate=allPayments.filter(p=>p.is_paid).map(p=>p.paid_at||p.payment_date).sort().pop();
            await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{cost_producto_usd:newTotal,cost_producto_paid:allPaid,cost_producto_paid_at:lastPaidDate||null,cost_producto_method:newSupPmt.payment_method}});
            setOp(p=>({...p,cost_producto_usd:newTotal,cost_producto_paid:allPaid,cost_producto_paid_at:lastPaidDate||null,cost_producto_method:newSupPmt.payment_method}));
            setNewSupPmt({payment_date:new Date().toISOString().slice(0,10),amount_usd:"",payment_method:"transferencia",is_paid:true,notes:""});
            load();
            flash("Pago registrado");
          };
          const deleteSupPayment=async(id)=>{
            if(!confirm("¿Eliminar este pago al proveedor?"))return;
            await dq("operation_supplier_payments",{method:"DELETE",token,filters:`?id=eq.${id}`});
            const remaining=supplierPayments.filter(p=>p.id!==id);
            const newTotal=remaining.reduce((s,p)=>s+Number(p.amount_usd||0),0);
            const allPaid=remaining.length>0&&remaining.every(p=>p.is_paid);
            const lastPaidDate=remaining.filter(p=>p.is_paid).map(p=>p.paid_at||p.payment_date).sort().pop();
            await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{cost_producto_usd:newTotal,cost_producto_paid:allPaid,cost_producto_paid_at:lastPaidDate||null}});
            setOp(p=>({...p,cost_producto_usd:newTotal,cost_producto_paid:allPaid,cost_producto_paid_at:lastPaidDate||null}));
            load();
          };
          const toggleSupPaid=async(p)=>{
            const newPaid=!p.is_paid;
            await dq("operation_supplier_payments",{method:"PATCH",token,filters:`?id=eq.${p.id}`,body:{is_paid:newPaid,paid_at:newPaid?new Date().toISOString():null}});
            load();
          };
          return <div style={{marginBottom:16,background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:10,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <p style={{fontSize:11,fontWeight:700,color:"#c084fc",margin:0,textTransform:"uppercase"}}>Costo del producto — Pagos al proveedor (Gestión Integral)</p>
              <div style={{display:"flex",gap:16,fontSize:11,color:"rgba(255,255,255,0.7)"}}>
                <span><b style={{color:"#fff"}}>Total:</b> USD {totalProducto.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                <span><b style={{color:"#22c55e"}}>Pagado:</b> USD {totalPagado.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                {totalPendiente>0&&<span><b style={{color:"#fb923c"}}>Pendiente:</b> USD {totalPendiente.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>}
              </div>
            </div>
            {supplierPayments.length>0&&<div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"4px 0",marginBottom:10}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                    <th style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Fecha</th>
                    <th style={{textAlign:"right",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Monto</th>
                    <th style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Método</th>
                    <th style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Estado</th>
                    <th style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Notas</th>
                    <th style={{padding:"8px 12px"}}></th>
                  </tr>
                </thead>
                <tbody>
                  {supplierPayments.map(p=><tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <td style={{padding:"8px 12px",color:"rgba(255,255,255,0.85)",fontVariantNumeric:"tabular-nums"}}>{new Date(p.payment_date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})}</td>
                    <td style={{padding:"8px 12px",textAlign:"right",color:"#c084fc",fontWeight:700,fontVariantNumeric:"tabular-nums"}}>USD {Number(p.amount_usd).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                    <td style={{padding:"8px 12px",color:"rgba(255,255,255,0.6)",textTransform:"capitalize"}}>{p.payment_method.replace("_"," ")}</td>
                    <td style={{padding:"8px 12px"}}>{p.is_paid?<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:"rgba(34,197,94,0.15)",color:"#22c55e"}}>✓ Pagado</span>:<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:"rgba(251,146,60,0.15)",color:"#fb923c"}}>Pendiente</span>}</td>
                    <td style={{padding:"8px 12px",color:"rgba(255,255,255,0.5)",fontSize:11}}>{p.notes||""}</td>
                    <td style={{padding:"8px 12px",textAlign:"right",whiteSpace:"nowrap"}}>
                      {!p.is_paid&&<button onClick={()=>toggleSupPaid(p)} style={{padding:"4px 8px",fontSize:10,fontWeight:700,background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:4,color:"#22c55e",cursor:"pointer",marginRight:4}}>Marcar pagado</button>}
                      <button onClick={()=>deleteSupPayment(p.id)} style={{padding:"4px 8px",fontSize:11,background:"transparent",border:"1px solid rgba(255,80,80,0.25)",borderRadius:4,color:"rgba(255,100,100,0.7)",cursor:"pointer"}}>✕</button>
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
            <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr 2fr auto",gap:10,alignItems:"end"}}>
              <Inp label="Fecha" type="date" value={newSupPmt.payment_date} onChange={v=>setNewSupPmt(p=>({...p,payment_date:v}))}/>
              <Inp label="Monto USD" type="number" value={newSupPmt.amount_usd} onChange={v=>setNewSupPmt(p=>({...p,amount_usd:v}))} step="0.01" placeholder="0.00"/>
              <Sel label="Método" value={newSupPmt.payment_method} onChange={v=>setNewSupPmt(p=>({...p,payment_method:v}))} options={[{value:"transferencia",label:"Transferencia"},{value:"efectivo",label:"Contado"},{value:"tarjeta_credito",label:"Tarjeta de Crédito"}]}/>
              <Inp label="Notas (opcional)" value={newSupPmt.notes} onChange={v=>setNewSupPmt(p=>({...p,notes:v}))} placeholder="Ej: 30% adelanto"/>
              <Btn onClick={addSupPayment} disabled={!newSupPmt.amount_usd||Number(newSupPmt.amount_usd)<=0} small>+ Agregar pago</Btn>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:8,fontSize:11,color:"rgba(255,255,255,0.6)",cursor:"pointer",marginTop:10}}>
              <input type="checkbox" checked={newSupPmt.is_paid} onChange={e=>setNewSupPmt(p=>({...p,is_paid:e.target.checked}))}/>
              Ya está pagado (si es tarjeta de crédito no debitada aún, desmarcá)
            </label>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"8px 0 0",fontStyle:"italic"}}>Cada pago parcial aparece en el libro diario con su fecha. El total se sincroniza automáticamente con el costo producto de la operación.</p>
          </div>;
        })()}
        <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 8px",textTransform:"uppercase"}}>Flete</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px",marginBottom:16}}>
          <Inp label="Costo flete (USD)" type="number" value={op.cost_flete} onChange={chOp("cost_flete")} step="0.01"/>
          <Sel label="Método de pago" value={op.cost_flete_method||"cuenta_corriente"} onChange={chOp("cost_flete_method")} options={[{value:"cuenta_corriente",label:"Cuenta Corriente"},{value:"tarjeta_credito",label:"Tarjeta de Crédito"},{value:"efectivo",label:"Contado"},{value:"transferencia",label:"Transferencia Bancaria"}]}/>
          {(op.cost_flete_method||"cuenta_corriente")==="cuenta_corriente"&&<div style={{paddingTop:22}}><p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>SALDO CC</p><p style={{fontSize:16,fontWeight:700,color:ccBalance>0?"#22c55e":"#ff6b6b",margin:0}}>USD {ccBalance.toLocaleString("en-US",{minimumFractionDigits:2})}</p></div>}
        </div>
        {/* Impuestos y Gasto Documental: solo para canal A (blanco). En canal B/negro no aplican. */}
        {!op.channel?.includes("negro")&&<><div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:12,marginBottom:16}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 8px",textTransform:"uppercase"}}>Impuestos (ARS)</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
            <Sel label="Método de pago" value={op.cost_impuestos_method||"tarjeta_credito"} onChange={chOp("cost_impuestos_method")} options={[{value:"tarjeta_credito",label:"Tarjeta de Crédito"},{value:"efectivo",label:"Contado"}]}/>
            <Inp label="Monto ARS" type="number" value={op.cost_impuestos_ars} onChange={chOp("cost_impuestos_ars")} step="0.01"/>
            {(op.cost_impuestos_method||"tarjeta_credito")==="tarjeta_credito"?<Inp label="Cierre de tarjeta" type="date" value={op.cost_impuestos_card_closing||""} onChange={chOp("cost_impuestos_card_closing")}/>:<Inp label="Tipo de cambio ARS/USD" type="number" value={op.cost_impuestos_card_closing&&!isNaN(Number(op.cost_impuestos_card_closing))?op.cost_impuestos_card_closing:""} onChange={chOp("cost_impuestos_card_closing")} step="0.01" placeholder="Ej: 1410"/>}
          </div>
          <p style={{fontSize:11,fontWeight:600,color:Number(op.cost_impuestos_reales||0)>0?IC:"#fbbf24",margin:"8px 0 0"}}>USD equivalente: {Number(op.cost_impuestos_reales||0)>0?`USD ${Number(op.cost_impuestos_reales).toLocaleString("en-US",{minimumFractionDigits:2})}`:(op.cost_impuestos_method==="tarjeta_credito"?"Pendiente de dollarización":"Se calcula al guardar")}</p>
        </div>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:12,marginBottom:16}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 8px",textTransform:"uppercase"}}>Gasto Documental (ARS)</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
            <Sel label="Método de pago" value={op.cost_gasto_doc_method||"tarjeta_credito"} onChange={chOp("cost_gasto_doc_method")} options={[{value:"tarjeta_credito",label:"Tarjeta de Crédito"},{value:"efectivo",label:"Contado"}]}/>
            <Inp label="Monto ARS" type="number" value={op.cost_gasto_documental_ars} onChange={chOp("cost_gasto_documental_ars")} step="0.01"/>
            {(op.cost_gasto_doc_method||"tarjeta_credito")==="tarjeta_credito"?<Inp label="Cierre de tarjeta" type="date" value={op.cost_gasto_doc_card_closing||""} onChange={chOp("cost_gasto_doc_card_closing")}/>:<Inp label="Tipo de cambio ARS/USD" type="number" value={op.cost_gasto_doc_card_closing&&!isNaN(Number(op.cost_gasto_doc_card_closing))?op.cost_gasto_doc_card_closing:""} onChange={chOp("cost_gasto_doc_card_closing")} step="0.01" placeholder="Ej: 1410"/>}
          </div>
          <p style={{fontSize:11,fontWeight:600,color:Number(op.cost_gasto_documental||0)>0?IC:"#fbbf24",margin:"8px 0 0"}}>USD equivalente: {Number(op.cost_gasto_documental||0)>0?`USD ${Number(op.cost_gasto_documental).toLocaleString("en-US",{minimumFractionDigits:2})}`:(op.cost_gasto_doc_method==="tarjeta_credito"?"Pendiente de dollarización":"Se calcula al guardar")}</p>
        </div></>}
        <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:12}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 8px",textTransform:"uppercase"}}>Otros costos (USD)</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Inp label="Flete local" type="number" value={op.cost_flete_local} onChange={chOp("cost_flete_local")} step="0.01"/>
            <Inp label="Otros costos" type="number" value={op.cost_otros} onChange={chOp("cost_otros")} step="0.01"/>
          </div>
          <Inp label="Notas" value={op.cost_notas} onChange={chOp("cost_notas")} placeholder="Ej: Consolidado con AC-0002..."/>
        </div>
      </Card>
      <Card title="Rentabilidad">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
          <div style={{background:"rgba(184,149,106,0.06)",borderRadius:12,padding:14,border:"1px solid rgba(184,149,106,0.12)",textAlign:"center"}}><p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>PRESUPUESTO</p><p style={{fontSize:18,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0}}>USD {presupuesto.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
          <div style={{background:"rgba(34,197,94,0.06)",borderRadius:12,padding:14,border:"1px solid rgba(34,197,94,0.12)",textAlign:"center"}}><p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>COBRO NETO</p><p style={{fontSize:18,fontWeight:700,color:"#22c55e",margin:0}}>USD {ingresoNeto.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
          <div style={{background:"rgba(255,80,80,0.06)",borderRadius:12,padding:14,border:"1px solid rgba(255,80,80,0.12)",textAlign:"center"}}><p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>COSTOS</p><p style={{fontSize:18,fontWeight:700,color:"#ff6b6b",margin:0}}>USD {totalCostos.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
        </div>
        {rw("Cobro bruto",cobro)}{comision>0&&rw(`Comisión transferencia (${feePct}%)`,-comision,false,"#ff6b6b")}{rw("Cobro neto",ingresoNeto)}
        <div style={{height:8}}/>
        {costProducto>0&&rw("Costo producto",costProducto,false,"#c084fc")}{rw("Costo flete",costFlete)}{rw("Impuestos reales",costImp)}{rw("Gasto documental",costDoc)}{costSeg>0&&rw("Seguro",costSeg)}{costLocal>0&&rw("Flete local",costLocal)}{costOtros>0&&rw("Otros",costOtros)}{rw("TOTAL COSTOS",totalCostos,true,"#ff6b6b")}
        {payments.length>0&&<><div style={{height:8}}/>
          <div style={{borderTop:"1px solid rgba(184,149,106,0.2)",paddingTop:10,marginTop:4}}><p style={{fontSize:11,fontWeight:700,color:IC,margin:"0 0 6px",textTransform:"uppercase"}}>Gestión de Pagos</p></div>
          {rw("Cobrado al cliente",pmtRevenue)}
          {rw("Girado al exterior",-(payments.reduce((s,p)=>s+Number(p.giro_amount_usd||0),0)),false,"#ff6b6b")}
          {payments.reduce((s,p)=>s+Number(p.cost_comision_giro||0),0)>0&&rw("Comisión servicio giro",-(payments.reduce((s,p)=>s+Number(p.cost_comision_giro||0),0)),false,"#ff6b6b")}
          {rw("Ganancia gestión de pagos",pmtGanancia,true,pmtGanancia>=0?"#22c55e":"#ff6b6b")}
        </>}
        <div style={{marginTop:20,background:ganancia>0?"rgba(34,197,94,0.08)":"rgba(255,80,80,0.08)",borderRadius:12,padding:20,border:`1px solid ${ganancia>0?"rgba(34,197,94,0.2)":"rgba(255,80,80,0.2)"}`,textAlign:"center"}}>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",textTransform:"uppercase"}}>Ganancia neta total</p>
          <p style={{fontSize:32,fontWeight:700,color:ganancia>0?"#22c55e":"#ff6b6b",margin:"0 0 4px"}}>USD {ganancia.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:0}}>{payments.length>0?`Operación: USD ${(ingresoNeto-totalCostos).toFixed(2)} + Gestión pagos: USD ${pmtGanancia.toFixed(2)}`:`Margen: ${margen.toFixed(1)}%`}</p>
        </div>
      </Card>
      </>;})()}

    </>}

    {tab==="comms"&&<CommsLog opId={op.id} token={token}/>}
    {showCloseChecklist&&<CloseChecklistModal op={op} items={items} payments={payments} clientPayments={clientPayments} supplierPayments={supplierPayments} onCancel={()=>{setShowCloseChecklist(false);setOp(p=>({...p,status:initOp.status}));}} onConfirm={async()=>{setShowCloseChecklist(false);await executeSave();}}/>}

    {showAddPayment&&<div onClick={()=>!savingAddPayment&&setShowAddPayment(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1.5px solid rgba(34,197,94,0.4)",borderRadius:14,padding:"22px 24px",maxWidth:520,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>+ Registrar cobro adicional</h3>
          <button onClick={()=>!savingAddPayment&&setShowAddPayment(false)} disabled={savingAddPayment} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,marginBottom:14}}>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:700}}>Operación</p>
          <p style={{fontSize:13,color:"#fff",margin:0}}><strong style={{color:IC,fontFamily:"monospace"}}>{op.operation_code}</strong> · presupuesto <strong>USD {Number(op.budget_total||0).toFixed(2)}</strong></p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px",marginBottom:8}}>
          <Sel label="Moneda" value={addPaymentForm.currency} onChange={v=>setAddPaymentForm(p=>({...p,currency:v}))} options={[{value:"USD",label:"USD"},{value:"ARS",label:"ARS"}]} small/>
          <Sel label="Método" value={addPaymentForm.payment_method} onChange={v=>setAddPaymentForm(p=>({...p,payment_method:v}))} options={[{value:"transferencia",label:"Transferencia"},{value:"efectivo",label:"Efectivo"},{value:"cripto",label:"Cripto"}]} small/>
        </div>
        {addPaymentForm.currency==="USD"?<div style={{marginBottom:8}}>
          <Inp label="Monto USD *" type="number" value={addPaymentForm.amount_usd} onChange={v=>setAddPaymentForm(p=>({...p,amount_usd:v}))} step="0.01" placeholder="Ej: 100.00" small/>
        </div>:<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px",marginBottom:8}}>
          <Inp label="Monto ARS *" type="number" value={addPaymentForm.amount_ars} onChange={v=>setAddPaymentForm(p=>({...p,amount_ars:v}))} step="0.01" small/>
          <Inp label="TC ARS/USD *" type="number" value={addPaymentForm.exchange_rate} onChange={v=>setAddPaymentForm(p=>({...p,exchange_rate:v}))} step="0.01" placeholder="Ej: 1410" small/>
        </div>}
        <div style={{marginBottom:14}}>
          <Inp label="Fecha del cobro *" type="date" value={addPaymentForm.payment_date} onChange={v=>setAddPaymentForm(p=>({...p,payment_date:v}))} small/>
          <Inp label="Notas (opcional)" value={addPaymentForm.notes} onChange={v=>setAddPaymentForm(p=>({...p,notes:v}))} placeholder='Ej: "Anticipo, falta flete local"' small/>
        </div>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"0 0 12px",fontStyle:"italic"}}>Este cobro se suma al total cobrado de la op. Si después se ajusta el presupuesto y queda saldo, podés registrar otro cobro adicional.</p>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>!savingAddPayment&&setShowAddPayment(false)} disabled={savingAddPayment} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:savingAddPayment?"not-allowed":"pointer"}}>Cancelar</button>
          <button onClick={submitAddPayment} disabled={savingAddPayment} style={{padding:"9px 18px",fontSize:13,fontWeight:700,borderRadius:8,border:"1px solid rgba(34,197,94,0.5)",background:savingAddPayment?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#22c55e,#16a34a)",color:savingAddPayment?"rgba(255,255,255,0.4)":"#fff",cursor:savingAddPayment?"wait":"pointer"}}>{savingAddPayment?"Guardando…":"✓ Registrar cobro"}</button>
        </div>
      </div>
    </div>}

    {cancelRedemptionTarget&&<div onClick={()=>!cancelingRedemption&&setCancelRedemptionTarget(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1.5px solid rgba(255,80,80,0.4)",borderRadius:14,padding:"22px 24px",maxWidth:460,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:14}}>
          <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>↩️ Cancelar canje</h3>
          <button onClick={()=>!cancelingRedemption&&setCancelRedemptionTarget(null)} disabled={cancelingRedemption} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,marginBottom:14}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Canje</p>
          <p style={{fontSize:14,fontWeight:600,color:"#fff",margin:"0 0 4px"}}>{cancelRedemptionTarget.reward_name}</p>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:0}}>Se le devolverán <strong style={{color:IC,fontFamily:"monospace"}}>{cancelRedemptionTarget.points_spent} pts</strong> al cliente.</p>
        </div>
        <p style={{fontSize:12,color:"rgba(255,255,255,0.65)",margin:"0 0 14px",lineHeight:1.5}}>El canje queda anulado y los puntos vuelven al saldo del cliente para que pueda usarlos en otro beneficio.</p>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>!cancelingRedemption&&setCancelRedemptionTarget(null)} disabled={cancelingRedemption} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:cancelingRedemption?"not-allowed":"pointer"}}>Volver</button>
          <button onClick={confirmCancelRedemption} disabled={cancelingRedemption} style={{padding:"9px 18px",fontSize:13,fontWeight:700,borderRadius:8,border:"1px solid rgba(255,80,80,0.5)",background:cancelingRedemption?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#ff6b6b,#ef4444)",color:cancelingRedemption?"rgba(255,255,255,0.4)":"#fff",cursor:cancelingRedemption?"wait":"pointer"}}>{cancelingRedemption?"Cancelando…":"✓ Sí, cancelar y devolver puntos"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

function CloseChecklistModal({op,items,payments,clientPayments,supplierPayments,onCancel,onConfirm}){
  const isGI=op.service_type==="gestion_integral";
  // Cálculos de checks automáticos
  const cliPaidGI=(clientPayments||[]).reduce((s,p)=>s+Number(p.amount_usd||0),0);
  const cliPaidNoGI=(()=>{const raw=Number(op.collected_amount||0);const isArs=op.collection_currency==="ARS";const rate=Number(op.collection_exchange_rate||0);return isArs&&rate>0?raw/rate:raw;})();
  const cliPaid=isGI?cliPaidGI:cliPaidNoGI;
  const credit=Number(op.credit_applied_usd||0);
  const discount=Number(op.discount_applied_usd||0);
  const bt=Number(op.budget_total||0);
  const saldo=Math.max(0,bt-cliPaid-credit-discount);
  const pmtTot=(payments||[]).reduce((s,p)=>s+Number(p.client_amount_usd||0),0);
  const ant=Number(op.total_anticipos||0);
  const exceso=Math.max(0,pmtTot-ant);
  const totalSaldo=saldo+exceso;
  const supPmts=(supplierPayments||[]);
  const supPaid=supPmts.filter(p=>p.is_paid).length;
  const supTotal=supPmts.length;
  const arsSupSinDolarizar=supPmts.filter(p=>p.currency==="ARS"&&p.is_paid&&!p.exchange_rate).length;
  const cliPmtsAll=clientPayments||[];
  const arsCliSinDolarizar=cliPmtsAll.filter(p=>p.currency==="ARS"&&!p.exchange_rate).length;

  // Checks: cada uno con label, status auto (pasa/no), y opcionalmente acción
  const checks=[
    {k:"paid",label:"Cliente pagó completo",pass:totalSaldo<0.01,detail:totalSaldo<0.01?"✓ Pagado":`Falta cobrar USD ${totalSaldo.toFixed(2)}`},
    ...(isGI?[
      {k:"sup_paid",label:"Pagos al proveedor liquidados",pass:supTotal===0||supPaid===supTotal,detail:supTotal===0?"Sin pagos cargados":`${supPaid}/${supTotal} pagados`},
      {k:"sup_ars",label:"Pagos ARS al proveedor dolarizados",pass:arsSupSinDolarizar===0,detail:arsSupSinDolarizar===0?"✓ Todos dolarizados":`${arsSupSinDolarizar} pendientes`},
    ]:[]),
    {k:"cli_ars",label:"Pagos ARS del cliente dolarizados",pass:arsCliSinDolarizar===0,detail:arsCliSinDolarizar===0?"✓ OK":`${arsCliSinDolarizar} sin dolarizar`},
    {k:"items",label:"Productos declarados",pass:items&&items.length>0,detail:`${items?.length||0} productos`},
    {k:"closed_date",label:"Fecha de cierre",pass:true,detail:new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})},
  ];
  const allPass=checks.every(c=>c.pass);
  const failedCount=checks.filter(c=>!c.pass).length;

  return <div onClick={onCancel} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div onClick={e=>e.stopPropagation()} style={{maxWidth:560,width:"100%",background:"#142038",border:`2px solid ${allPass?"rgba(34,197,94,0.5)":"rgba(251,191,36,0.5)"}`,borderRadius:14,padding:"24px 26px",boxShadow:"0 24px 80px rgba(0,0,0,0.8)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <span style={{fontSize:24}}>{allPass?"✅":"⚠️"}</span>
        <h3 style={{fontSize:18,fontWeight:700,color:"#fff",margin:0}}>Cerrar operación {op.operation_code}</h3>
      </div>
      <p style={{fontSize:12,color:"rgba(255,255,255,0.6)",margin:"0 0 18px",lineHeight:1.5}}>{allPass?"Todo en orden — podés cerrar sin pendientes.":`Hay ${failedCount} item${failedCount>1?"s":""} sin completar. Revisá antes de cerrar.`}</p>
      <div style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"4px 0",marginBottom:18}}>
        {checks.map((c,i)=><div key={c.k} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:i<checks.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
          <span style={{fontSize:16,minWidth:20}}>{c.pass?"✅":"⚠️"}</span>
          <div style={{flex:1}}>
            <p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}>{c.label}</p>
            <p style={{fontSize:11,color:c.pass?"rgba(34,197,94,0.8)":"rgba(251,191,36,0.85)",margin:"2px 0 0"}}>{c.detail}</p>
          </div>
        </div>)}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <Btn variant="secondary" onClick={onCancel} small>Cancelar</Btn>
        <Btn onClick={onConfirm} small>{allPass?"✓ Cerrar":"⚠️ Cerrar igual"}</Btn>
      </div>
    </div>
  </div>;
}

function CommsLog({opId,token}){
  const [items,setItems]=useState([]);
  const [type,setType]=useState("whatsapp");
  const [direction,setDirection]=useState("in");
  const [content,setContent]=useState("");
  const [saving,setSaving]=useState(false);
  const TYPES=[
    {k:"whatsapp",l:"WhatsApp",icon:"💬",color:"#25D366"},
    {k:"email",l:"Email",icon:"✉️",color:"#60a5fa"},
    {k:"call",l:"Llamada",icon:"📞",color:"#a78bfa"},
    {k:"meeting",l:"Reunión",icon:"🤝",color:"#fbbf24"},
    {k:"note",l:"Nota",icon:"📝",color:"#94a3b8"},
  ];
  const load=async()=>{const r=await dq("op_communications",{token,filters:`?operation_id=eq.${opId}&select=*&order=occurred_at.desc&limit=100`});setItems(Array.isArray(r)?r:[]);};
  useEffect(()=>{load();},[opId,token]);
  const add=async()=>{
    if(!content.trim())return;
    setSaving(true);
    await dq("op_communications",{method:"POST",token,body:{operation_id:opId,type,direction:type==="note"?null:direction,content:content.trim()}});
    setContent("");setSaving(false);load();
  };
  const del=async(id)=>{if(!confirm("¿Eliminar esta entrada?"))return;await dq("op_communications",{method:"DELETE",token,filters:`?id=eq.${id}`});load();};
  const fmtAgo=(d)=>{const m=Math.floor((Date.now()-new Date(d).getTime())/60000);if(m<1)return"recién";if(m<60)return`hace ${m}min`;const h=Math.floor(m/60);if(h<24)return`hace ${h}h`;const dd=Math.floor(h/24);if(dd<30)return`hace ${dd}d`;return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"2-digit"});};
  return <Card title="Comunicaciones con el cliente">
    <div style={{background:"rgba(255,255,255,0.028)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.05em"}}>+ Nueva entrada</p>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
        {TYPES.map(t=><button key={t.k} onClick={()=>setType(t.k)} style={{padding:"5px 10px",fontSize:11,fontWeight:600,borderRadius:6,border:`1px solid ${type===t.k?t.color:"rgba(255,255,255,0.1)"}`,background:type===t.k?`${t.color}20`:"transparent",color:type===t.k?t.color:"rgba(255,255,255,0.5)",cursor:"pointer"}}>{t.icon} {t.l}</button>)}
      </div>
      {type!=="note"&&<div style={{display:"flex",gap:6,marginBottom:8}}>
        {[{k:"in",l:"Recibido del cliente"},{k:"out",l:"Enviado al cliente"}].map(d=><button key={d.k} onClick={()=>setDirection(d.k)} style={{padding:"4px 10px",fontSize:10,fontWeight:600,borderRadius:5,border:`1px solid ${direction===d.k?GOLD_DEEP:"rgba(255,255,255,0.1)"}`,background:direction===d.k?"rgba(184,149,106,0.12)":"transparent",color:direction===d.k?GOLD_LIGHT:"rgba(255,255,255,0.5)",cursor:"pointer"}}>{d.k==="in"?"← ":"→ "}{d.l}</button>)}
      </div>}
      <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder={type==="note"?"Nota interna sobre esta op...":`Pegá lo que ${direction==="in"?"recibiste del":"enviaste al"} cliente`} rows={3} style={{width:"100%",padding:"10px 12px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,background:"rgba(0,0,0,0.2)",color:"#fff",outline:"none",fontFamily:"inherit",resize:"vertical"}}/>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
        <Btn onClick={add} disabled={!content.trim()||saving} small>{saving?"Guardando...":"+ Agregar"}</Btn>
      </div>
    </div>
    {items.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"2rem 0",fontSize:13}}>Sin comunicaciones registradas todavía.</p>:
    <div>{items.map(it=>{const t=TYPES.find(x=>x.k===it.type)||TYPES[4];return <div key={it.id} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
      <div style={{width:36,height:36,borderRadius:"50%",background:`${t.color}18`,border:`1px solid ${t.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{t.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,marginBottom:4,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:11,fontWeight:700,color:t.color,textTransform:"uppercase",letterSpacing:"0.04em"}}>{t.l}</span>
            {it.direction&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:it.direction==="in"?"rgba(34,197,94,0.12)":"rgba(96,165,250,0.12)",color:it.direction==="in"?"#22c55e":"#60a5fa",fontWeight:600}}>{it.direction==="in"?"← Entrante":"→ Saliente"}</span>}
            <span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>· {fmtAgo(it.occurred_at)}</span>
          </div>
          <button onClick={()=>del(it.id)} title="Eliminar" style={{fontSize:10,padding:"2px 6px",borderRadius:4,border:"1px solid rgba(255,80,80,0.2)",background:"transparent",color:"rgba(255,80,80,0.6)",cursor:"pointer"}}>X</button>
        </div>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.85)",margin:0,whiteSpace:"pre-wrap",lineHeight:1.5}}>{it.content}</p>
      </div>
    </div>;})}</div>}
  </Card>;
}

function ClientsList({token,onSelect}){
  const [clients,setClients]=useState([]);const [lo,setLo]=useState(true);const [search,setSearch]=useState("");
  useEffect(()=>{(async()=>{const c=await dq("clients",{token,filters:"?select=*&order=created_at.desc"});setClients(Array.isArray(c)?c:[]);setLo(false);})();},[token]);
  const filtered=clients.filter(c=>{if(!search)return true;const s=search.toLowerCase();return `${c.first_name} ${c.last_name}`.toLowerCase().includes(s)||c.client_code?.toLowerCase().includes(s)||c.email?.toLowerCase().includes(s);});
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:24,gap:12,flexWrap:"wrap"}}>
      <div><h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>Clientes</h2><p style={{fontSize:13,color:"rgba(255,255,255,0.45)",margin:"4px 0 0"}}>{filtered.length} {filtered.length===1?"cliente":"clientes"}</p></div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre, código o email..." style={{width:360,maxWidth:"100%",padding:"10px 14px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none",transition:"all 180ms"}} onFocus={e=>{e.target.style.borderColor=GOLD;e.target.style.boxShadow="0 0 0 3px rgba(184,149,106,0.18)";}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.08)";e.target.style.boxShadow="none";}}/>
    </div>
    {lo?<SkeletonTable rows={8} cols={5}/>:
    <div style={{background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.25)"}}>
          {["Código","Nombre","Email","WhatsApp","Ciudad"].map(h=><th key={h} style={{padding:"14px 16px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map(c=><tr key={c.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",transition:"background 120ms"}} onClick={()=>onSelect(c)} onMouseEnter={e=>{e.currentTarget.style.background="rgba(184,149,106,0.05)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
          <td style={{padding:"14px 16px",fontFamily:"'JetBrains Mono','SF Mono',monospace",fontWeight:600,color:GOLD_LIGHT,fontSize:12.5,letterSpacing:"0.04em"}}>{c.client_code}</td>
          <td style={{padding:"14px 16px",color:"#fff",fontWeight:500,fontSize:13}}>{c.first_name} {c.last_name}{c.tier&&c.tier!=="standard"&&(()=>{const ti=getTierInfo(c.tier);return <span title={`${ti.label} · ${c.lifetime_points_earned||0} pts ganados`} style={{marginLeft:10,fontSize:9,fontWeight:800,padding:"3px 9px",borderRadius:999,background:ti.gradient,color:"#0A1628",letterSpacing:"0.1em",border:`1px solid ${ti.color}`,display:"inline-flex",alignItems:"center",gap:4,textTransform:"uppercase"}}>{ti.icon} {ti.label}</span>;})()}</td>
          <td style={{padding:"14px 16px",color:"rgba(255,255,255,0.6)",fontSize:12.5}}>{c.email}</td>
          <td style={{padding:"14px 16px",color:"rgba(255,255,255,0.6)",fontSize:12.5}}>{c.whatsapp||<span style={{color:"rgba(255,255,255,0.25)"}}>—</span>}</td>
          <td style={{padding:"14px 16px",color:"rgba(255,255,255,0.5)",fontSize:12.5}}>{c.city}, {c.province}</td>
        </tr>)}</tbody>
      </table>
      {filtered.length===0&&<EmptyState icon="users" title={search?"Sin resultados":"No hay clientes"} description={search?`Nada coincide con "${search}"`:"Aún no se registró ningún cliente en el sistema."}/>}
    </div>}
  </div>;
}

function ClientDetail({client:initClient,token,onBack,onSelectOp,onDelete}){
  const [cl,setCl]=useState(initClient);const [ops,setOps]=useState([]);const [lo,setLo]=useState(true);const [tab,setTab]=useState("info");const [tariffs,setTariffs]=useState([]);const [overrides,setOverrides]=useState([]);const [msg,setMsg]=useState("");const [saving,setSaving]=useState(false);
  // Cuenta corriente
  const [accMovs,setAccMovs]=useState([]);
  const [cliPmtsCC,setCliPmtsCC]=useState([]); // pagos GI (operation_client_payments)
  const [newMov,setNewMov]=useState({type:"adjustment",amount:"",description:""});
  const [savingMov,setSavingMov]=useState(false);
  const [payMgmtCC,setPayMgmtCC]=useState([]); // gestión de pagos internacionales (client_paid=true)
  const loadAccMovs=async()=>{
    const [m,pm,pg]=await Promise.all([
      dq("client_account_movements",{token,filters:`?client_id=eq.${cl.id}&select=*,operations(operation_code)&order=created_at.desc`}),
      dq("operation_client_payments",{token,filters:`?select=*,operations!inner(operation_code,client_id)&operations.client_id=eq.${cl.id}&order=payment_date.desc`}),
      dq("payment_management",{token,filters:`?select=*,operations!inner(operation_code,client_id)&operations.client_id=eq.${cl.id}&client_paid=eq.true&order=client_paid_at.desc`})
    ]);
    setAccMovs(Array.isArray(m)?m:[]);
    setCliPmtsCC(Array.isArray(pm)?pm:[]);
    setPayMgmtCC(Array.isArray(pg)?pg:[]);
  };
  const addMov=async()=>{if(!newMov.amount)return;setSavingMov(true);const amt=Number(newMov.amount);const signed=newMov.type==="overpayment"||newMov.type==="adjustment"?Math.abs(amt):-Math.abs(amt);await dq("client_account_movements",{method:"POST",token,body:{client_id:cl.id,type:newMov.type,amount_usd:signed,description:newMov.description||null}});await loadAccMovs();const fresh=await dq("clients",{token,filters:`?id=eq.${cl.id}&select=account_balance_usd`});if(Array.isArray(fresh)&&fresh[0])setCl(p=>({...p,account_balance_usd:fresh[0].account_balance_usd}));setNewMov({type:"adjustment",amount:"",description:""});setSavingMov(false);flash("Movimiento registrado");};
  const delMov=async(id)=>{if(!confirm("¿Eliminar este movimiento?"))return;await dq("client_account_movements",{method:"DELETE",token,filters:`?id=eq.${id}`});await loadAccMovs();const fresh=await dq("clients",{token,filters:`?id=eq.${cl.id}&select=account_balance_usd`});if(Array.isArray(fresh)&&fresh[0])setCl(p=>({...p,account_balance_usd:fresh[0].account_balance_usd}));flash("Movimiento eliminado");};
  useEffect(()=>{(async()=>{const [o,t,ov]=await Promise.all([dq("operations",{token,filters:`?client_id=eq.${cl.id}&select=*&order=created_at.desc`}),dq("tariffs",{token,filters:"?select=*&type=eq.rate&order=service_key.asc,sort_order.asc"}),dq("client_tariff_overrides",{token,filters:`?client_id=eq.${cl.id}&select=*`})]);setOps(Array.isArray(o)?o:[]);setTariffs(Array.isArray(t)?t:[]);setOverrides(Array.isArray(ov)?ov:[]);setLo(false);loadAccMovs();})();},[cl.id,token]);
  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),2500);const v=/^[❌✕]|falló|error/i.test(m)?"error":/^⚠/.test(m)?"warn":"success";toast(m.replace(/^[✓✉️❌⚠️✕★📧⭐]\s*/u,""),v);};
  const getOverride=(tid)=>overrides.find(o=>o.tariff_id===tid);
  // Recalcula y guarda presupuesto de todas las ops activas del cliente (las cerradas/canceladas se saltean).
  // Se llama cuando cambia algo que afecta los presupuestos: tax_condition del cliente, tarifas custom, etc.
  const syncClientOps=async()=>{
    try{
      const[tfRes,ccRes,opsRes,ovRes,clRes]=await Promise.all([
        dq("tariffs",{token,filters:"?select=*&type=eq.rate&order=sort_order.asc"}),
        dq("calc_config",{token,filters:"?select=*"}),
        dq("operations",{token,filters:`?client_id=eq.${cl.id}&status=not.in.(operacion_cerrada,cancelada)&select=*`}),
        dq("client_tariff_overrides",{token,filters:`?client_id=eq.${cl.id}&select=*`}),
        dq("clients",{token,filters:`?id=eq.${cl.id}&select=tax_condition`})
      ]);
      const tariffsFresh=Array.isArray(tfRes)?tfRes:[];
      const cfg={};(Array.isArray(ccRes)?ccRes:[]).forEach(r=>{cfg[r.key]=Number(r.value);});
      const activeOps=Array.isArray(opsRes)?opsRes:[];
      const overridesFresh=Array.isArray(ovRes)?ovRes:[];
      const clientFresh=Array.isArray(clRes)?clRes[0]:null;
      for(const o of activeOps){
        try{
          const[it,pk]=await Promise.all([
            dq("operation_items",{token,filters:`?operation_id=eq.${o.id}&select=*`}),
            dq("operation_packages",{token,filters:`?operation_id=eq.${o.id}&select=*`})
          ]);
          const items=Array.isArray(it)?it:[];const pkgs=Array.isArray(pk)?pk:[];
          const isBlanco=o.channel?.includes("blanco");
          if(isBlanco&&items.length===0)continue;
          if(!isBlanco&&pkgs.length===0)continue;
          const{totalTax,flete,seguro,totalAbonar}=calcOpBudget(o,items,pkgs,tariffsFresh,cfg,overridesFresh,clientFresh);
          await dq("operations",{method:"PATCH",token,filters:`?id=eq.${o.id}`,body:{budget_taxes:totalTax,budget_flete:flete,budget_seguro:seguro,budget_total:totalAbonar}});
        }catch(e){console.error(`syncClientOps ${o.operation_code}`,e);}
      }
    }catch(e){console.error("syncClientOps",e);}
  };
  const setOverrideRate=async(tid,rate)=>{const existing=getOverride(tid);if(rate===""||rate==null){if(existing){await dq("client_tariff_overrides",{method:"DELETE",token,filters:`?id=eq.${existing.id}`});setOverrides(p=>p.filter(o=>o.id!==existing.id));flash("Tarifa custom eliminada");syncClientOps();}return;}if(existing){await dq("client_tariff_overrides",{method:"PATCH",token,filters:`?id=eq.${existing.id}`,body:{custom_rate:Number(rate)}});setOverrides(p=>p.map(o=>o.id===existing.id?{...o,custom_rate:Number(rate)}:o));} else{const r=await dq("client_tariff_overrides",{method:"POST",token,body:{client_id:cl.id,tariff_id:tid,custom_rate:Number(rate)}});if(Array.isArray(r))setOverrides(p=>[...p,...r]);else if(r?.id)setOverrides(p=>[...p,r]);}flash("Tarifa custom guardada · re-sincronizando ops…");syncClientOps();};
  const chCl=f=>v=>setCl(p=>({...p,[f]:v}));
  const saveClient=async()=>{
    setSaving(true);
    const{id,created_at,updated_at,auth_user_id,...rest}=cl;
    const taxChanged=rest.tax_condition!==initClient.tax_condition;
    await dq("clients",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});
    flash(taxChanged?"Cliente guardado · re-sincronizando ops…":"Cliente guardado");
    if(taxChanged)syncClientOps();
    setSaving(false);
  };
  const deleteClient=async()=>{if(!confirm(`¿Estás seguro de eliminar a ${cl.first_name} ${cl.last_name}? Esta acción no se puede deshacer.`))return;await dq("clients",{method:"DELETE",token,filters:`?id=eq.${cl.id}`});onDelete();};
  const tabs=[{k:"info",l:"Info"},{k:"ops",l:`Operaciones (${ops.length})`},{k:"cc",l:`Cuenta corriente${Number(cl.account_balance_usd||0)!==0?" ·":""}`},{k:"tariffs",l:"Tarifas"}];
  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,0.55)",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontWeight:600,padding:"6px 12px",borderRadius:8,letterSpacing:"0.04em",transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.color=GOLD_LIGHT;e.currentTarget.style.borderColor="rgba(184,149,106,0.35)";}} onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,0.55)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}>← Volver</button>
        <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>{cl.first_name} {cl.last_name}</h2>
        {cl.tier&&cl.tier!=="standard"&&(()=>{const ti=getTierInfo(cl.tier);return <span title={cl.tier_achieved_at?`${ti.label} desde ${new Date(cl.tier_achieved_at).toLocaleDateString("es-AR")} · ${cl.lifetime_points_earned||0} pts ganados`:ti.label} style={{fontSize:10,fontWeight:800,padding:"4px 12px",borderRadius:999,background:ti.gradient,color:"#0A1628",letterSpacing:"0.14em",border:`1px solid ${ti.color}`,boxShadow:ti.glow,display:"inline-flex",alignItems:"center",gap:5,textTransform:"uppercase"}}>{ti.icon} {ti.label}</span>;})()}
        {Number(cl.points_balance||0)>0&&<span title={`Balance actual · ${cl.lifetime_points_earned||0} ganados en total`} style={{fontSize:10,fontWeight:800,padding:"4px 10px",borderRadius:999,background:"rgba(184,149,106,0.12)",color:GOLD_LIGHT,border:"1px solid rgba(184,149,106,0.3)",letterSpacing:"0.08em",fontVariantNumeric:"tabular-nums"}}>★ {cl.points_balance} PTS</span>}
        {Number(cl.account_balance_usd||0)!==0&&(()=>{const bal=Number(cl.account_balance_usd||0);const isCredit=bal>0;return <span title={isCredit?"Saldo a favor en cuenta corriente":"Deuda en cuenta corriente"} onClick={()=>setTab("cc")} style={{fontSize:10,fontWeight:800,padding:"4px 10px",borderRadius:999,background:isCredit?"rgba(34,197,94,0.14)":"rgba(239,68,68,0.14)",color:isCredit?"#22c55e":"#ef4444",border:`1px solid ${isCredit?"rgba(34,197,94,0.35)":"rgba(239,68,68,0.35)"}`,letterSpacing:"0.06em",fontVariantNumeric:"tabular-nums",cursor:"pointer"}}>{isCredit?"+":""}USD {bal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>;})()}
        {msg&&<span style={{fontSize:12,color:"#22c55e",fontWeight:600,animation:"ac_fade_in 200ms"}}>✓ {msg}</span>}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn onClick={()=>{if(typeof window!=="undefined")window.open(`/portal?admin_preview=${cl.id}`,"_blank");}} variant="secondary" small>👁 Ver como cliente</Btn>
        <Btn onClick={deleteClient} variant="danger" small>Eliminar cliente</Btn>
      </div>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid rgba(255,255,255,0.06)",paddingBottom:0}}>{tabs.map(t=>{const active=tab===t.k;return <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"10px 18px",fontSize:12,fontWeight:active?700:600,border:"none",background:"transparent",color:active?GOLD_LIGHT:"rgba(255,255,255,0.5)",cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase",borderBottom:`2px solid ${active?GOLD:"transparent"}`,marginBottom:-1,transition:"all 150ms"}} onMouseEnter={e=>{if(!active)e.currentTarget.style.color="rgba(255,255,255,0.8)";}} onMouseLeave={e=>{if(!active)e.currentTarget.style.color="rgba(255,255,255,0.5)";}}>{t.l}</button>;})}</div>
    {tab==="info"&&<Card title="Datos del Cliente" actions={<Btn onClick={saveClient} disabled={saving} small>{saving?"Guardando...":"Guardar"}</Btn>}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
        <Inp label="Código" value={cl.client_code} onChange={chCl("client_code")}/>
        <Inp label="Nombre" value={cl.first_name} onChange={chCl("first_name")}/>
        <Inp label="Apellido" value={cl.last_name} onChange={chCl("last_name")}/>
        <Inp label="Email" value={cl.email} onChange={chCl("email")}/>
        <Inp label="WhatsApp" value={cl.whatsapp} onChange={chCl("whatsapp")}/>
        <Sel label="Condición IVA" value={cl.tax_condition} onChange={chCl("tax_condition")} options={[{value:"responsable_inscripto",label:"Resp. Inscripto"},{value:"monotributista",label:"Monotributista"},{value:"ninguna",label:"Consumidor Final"}]}/>
        <Inp label="Calle" value={cl.street} onChange={chCl("street")}/>
        <Inp label="Piso/Depto" value={cl.floor_apt} onChange={chCl("floor_apt")}/>
        <Inp label="CP" value={cl.postal_code} onChange={chCl("postal_code")}/>
        <Inp label="Ciudad" value={cl.city} onChange={chCl("city")}/>
        <Inp label="Provincia" value={cl.province} onChange={chCl("province")}/>
        {cl.tax_condition==="responsable_inscripto"&&<><Inp label="Empresa" value={cl.company_name} onChange={chCl("company_name")}/><Inp label="CUIT" value={cl.cuit} onChange={chCl("cuit")}/></>}
        <Inp label="Puntos" type="number" value={cl.points_balance} onChange={v=>chCl("points_balance")(Number(v)||0)}/>
      </div>
    </Card>}
    {tab==="ops"&&<Card title="Operaciones">{lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando...</p>:ops.length>0?ops.map(op=>{const st=SM[op.status]||{l:op.status,c:"#999"};const isActive=!["operacion_cerrada","cancelada"].includes(op.status);return <div key={op.id} onClick={()=>onSelectOp(op)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 4px",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",transition:"background 120ms",borderRadius:6}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(184,149,106,0.05)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}><div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontFamily:"'JetBrains Mono','SF Mono',monospace",fontWeight:600,color:"#fff",fontSize:12.5,letterSpacing:"0.04em"}}>{op.operation_code}</span><span style={{fontSize:10,fontWeight:700,padding:"4px 10px 4px 8px",borderRadius:999,color:st.c,background:`${st.c}14`,border:`1px solid ${st.c}40`,display:"inline-flex",alignItems:"center",gap:6,letterSpacing:"0.05em",textTransform:"uppercase"}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:st.c,boxShadow:isActive?`0 0 8px ${st.c}`:"none"}}/>{st.l}</span></div><div style={{display:"flex",alignItems:"center",gap:14}}><span style={{fontSize:11.5,color:"rgba(255,255,255,0.5)"}}>{CM[op.channel]||op.channel}</span><span style={{color:GOLD_LIGHT,fontSize:12,fontWeight:600}}>→</span></div></div>;}):<p style={{color:"rgba(255,255,255,0.45)"}}>Sin operaciones</p>}</Card>}
    {tab==="cc"&&(()=>{const bal=Number(cl.account_balance_usd||0);const isCredit=bal>0;const isDebt=bal<0;const MOV_LABELS={overpayment:"Pago de más",applied:"Aplicado a op",adjustment:"Ajuste manual",refund:"Reintegro",debt:"Pago de menos",op_cobro:"Cobro de op",op_anticipo:"Anticipo de op",gpi_cobro:"Gestión pagos internacional"};const MOV_COLORS={overpayment:"#22c55e",applied:GOLD_LIGHT,adjustment:"#a78bfa",refund:"#60a5fa",debt:"#ef4444",op_cobro:"#22c55e",op_anticipo:"#60a5fa",gpi_cobro:"#10b981"};
      // Timeline unificado: movements + cobros de ops + anticipos GI + gestión pagos
      const timeline=[
        ...accMovs.map(m=>({id:"m_"+m.id,raw:m,kind:"movement",date:m.created_at,type:m.type,amount:Number(m.amount_usd),op_code:m.operations?.operation_code,description:m.description,deletable:true})),
        ...ops.filter(o=>o.is_collected&&Number(o.collected_amount||0)>0).map(o=>{const raw=Number(o.collected_amount||0);const isArs=o.collection_currency==="ARS";const rate=Number(o.collection_exchange_rate||0);const usd=isArs&&rate>0?raw/rate:raw;return{id:"o_"+o.id,kind:"op_cobro",date:o.collection_date||o.closed_at||o.updated_at,type:"op_cobro",amount:usd,op_code:o.operation_code,description:`Cobro ${isArs?`ARS ${raw.toLocaleString("es-AR")} @ ${rate}`:""}`,deletable:false};}),
        ...cliPmtsCC.map(p=>({id:"p_"+p.id,kind:"op_anticipo",date:p.payment_date,type:"op_anticipo",amount:Number(p.amount_usd||0),op_code:p.operations?.operation_code,description:p.notes||`Anticipo (${p.payment_method||"pago"})`,deletable:false})),
        ...payMgmtCC.map(g=>{const amt=Number(g.client_paid_amount_usd??g.client_amount_usd??0);return{id:"g_"+g.id,kind:"gpi_cobro",date:g.client_paid_at||g.created_at,type:"gpi_cobro",amount:amt,op_code:g.operations?.operation_code,description:`Pago de gestión internacional${g.proveedor_name?` · ${g.proveedor_name}`:""}`,deletable:false};})
      ].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
      return <div>
      {/* Hero balance */}
      <div style={{padding:"24px 28px",background:isCredit?"linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(255,255,255,0.02) 100%)":isDebt?"linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(255,255,255,0.02) 100%)":"rgba(255,255,255,0.025)",border:`1px solid ${isCredit?"rgba(34,197,94,0.4)":isDebt?"rgba(239,68,68,0.4)":"rgba(255,255,255,0.08)"}`,borderRadius:14,marginBottom:18,boxShadow:isCredit?"0 0 24px rgba(34,197,94,0.15)":isDebt?"0 0 24px rgba(239,68,68,0.15)":"none"}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.14em"}}>{isCredit?"★ Saldo a favor del cliente":isDebt?"⚠ Deuda del cliente":"Balance de cuenta"}</p>
        <p style={{fontSize:36,fontWeight:800,color:isCredit?"#22c55e":isDebt?"#ef4444":"#fff",margin:0,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{isCredit?"+":""}USD {bal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
        {isCredit&&<p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:"6px 0 0"}}>Se puede aplicar a cualquier operación pendiente de cobro del cliente.</p>}
        {isDebt&&<p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:"6px 0 0"}}>El cliente debe este importe — podés aplicarlo a su próxima operación.</p>}
      </div>
      {/* Nuevo movimiento */}
      <Card title="Registrar movimiento manual">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr auto",gap:12,alignItems:"end"}}>
          <Sel label="Tipo" value={newMov.type} onChange={v=>setNewMov(p=>({...p,type:v}))} options={[{value:"overpayment",label:"Pago de más (+)"},{value:"adjustment",label:"Ajuste a favor (+)"},{value:"applied",label:"Aplicado a op (−)"},{value:"refund",label:"Reintegro al cliente (−)"},{value:"debt",label:"Deuda del cliente (−)"}]}/>
          <Inp label="Monto USD" type="number" value={newMov.amount} onChange={v=>setNewMov(p=>({...p,amount:v}))} step="0.01"/>
          <Inp label="Descripción" value={newMov.description} onChange={v=>setNewMov(p=>({...p,description:v}))} placeholder="Ej: Excedente transferencia 15/04"/>
          <Btn onClick={addMov} disabled={savingMov||!newMov.amount} small>{savingMov?"…":"Agregar"}</Btn>
        </div>
      </Card>
      {/* Historial */}
      <Card title={`Historial (${timeline.length})`}>
        {timeline.length===0?<p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:0,fontStyle:"italic"}}>Sin movimientos registrados</p>:
        <div style={{display:"flex",flexDirection:"column",gap:2}}>{timeline.map(t=>{const amt=t.amount;const isPos=amt>0;const color=MOV_COLORS[t.type]||"#fff";const label=MOV_LABELS[t.type]||t.type;return <div key={t.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 8px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3,flexWrap:"wrap"}}>
              <span style={{fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:999,background:`${color}14`,color,border:`1px solid ${color}35`,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</span>
              {t.op_code&&<span style={{fontSize:11,fontFamily:"'JetBrains Mono','SF Mono',monospace",color:GOLD_LIGHT,letterSpacing:"0.04em"}}>{t.op_code}</span>}
              <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{t.date?new Date(t.date).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"}):"—"}</span>
            </div>
            {t.description&&<p style={{fontSize:12.5,color:"rgba(255,255,255,0.7)",margin:0}}>{t.description}</p>}
          </div>
          <span style={{fontSize:15,fontWeight:800,color:isPos?"#22c55e":"#ef4444",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em",whiteSpace:"nowrap"}}>{isPos?"+":""}USD {Math.abs(amt).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          {t.deletable&&<button onClick={()=>delMov(t.raw.id)} title="Eliminar movimiento" style={{padding:"4px 8px",fontSize:10,fontWeight:600,borderRadius:6,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.08)",color:"#ff6b6b",cursor:"pointer"}}>✕</button>}
        </div>;})}</div>}
        <p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",margin:"14px 0 0",fontStyle:"italic",lineHeight:1.5}}>El balance sólo considera los movimientos (saldos a favor, deudas, ajustes). Los cobros y anticipos ya quedaron contabilizados en sus respectivas operaciones.</p>
      </Card>
    </div>;})()}
    {tab==="tariffs"&&<div>{SERVICES.map(svc=>{const svcRates=tariffs.filter(t=>t.service_key===svc.key);if(!svcRates.length)return null;return <Card key={svc.key} title={svc.label}><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"-8px 0 12px"}}>Dejá vacío para usar tarifa base. Poné un valor para aplicar tarifa promocional.</p>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}><th style={{padding:"8px 0",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)"}}>RANGO</th><th style={{padding:"8px 0",textAlign:"right",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)"}}>TARIFA BASE</th><th style={{padding:"8px 0",textAlign:"right",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)"}}>TARIFA CUSTOM</th></tr></thead>
      <tbody>{svcRates.map(t=>{const ov=getOverride(t.id);return <tr key={t.id} style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}><td style={{padding:"8px 0",color:"rgba(255,255,255,0.6)"}}>{t.label}</td><td style={{padding:"8px 0",textAlign:"right",color:ov?"rgba(255,255,255,0.4)":"#fff",fontWeight:600,textDecoration:ov?"line-through":"none"}}>${Number(t.rate).toLocaleString("en-US")}/{t.unit}</td><td style={{padding:"8px 0",textAlign:"right",display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6}}><input type="number" value={ov?.custom_rate??""} onChange={e=>setOverrideRate(t.id,e.target.value)} placeholder="—" step="0.01" style={{width:80,padding:"4px 8px",fontSize:13,textAlign:"right",border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,background:ov?"rgba(184,149,106,0.1)":"rgba(255,255,255,0.04)",color:ov?IC:"rgba(255,255,255,0.4)",outline:"none"}}/>{ov&&<button onClick={()=>setOverrideRate(t.id,"")} style={{fontSize:10,padding:"4px 8px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer",fontWeight:600}}>X</button>}</td></tr>;})}</tbody></table></Card>;})}</div>}
  </div>;
}

function TariffsManager({token}){
  const [tariffs,setTariffs]=useState([]);const [lo,setLo]=useState(true);const [selSvc,setSelSvc]=useState(null);const [msg,setMsg]=useState("");const [viewMode,setViewMode]=useState("sell");
  const load=async()=>{const t=await dq("tariffs",{token,filters:"?select=*&order=service_key.asc,sort_order.asc"});setTariffs(Array.isArray(t)?t:[]);setLo(false);};
  useEffect(()=>{load();},[token]);
  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),2500);const v=/^[❌✕]|falló|error/i.test(m)?"error":/^⚠/.test(m)?"warn":"success";toast(m.replace(/^[✓✉️❌⚠️✕★📧⭐]\s*/u,""),v);};
  const svcTariffs=selSvc?tariffs.filter(t=>t.service_key===selSvc):[];
  const rates=svcTariffs.filter(t=>t.type==="rate");const specials=svcTariffs.filter(t=>t.type==="special");const surcharges=svcTariffs.filter(t=>t.type==="surcharge");
  const saveTariff=async(t)=>{const{id,created_at,...rest}=t;await dq("tariffs",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});flash("Guardado");};
  const addTariff=async(type)=>{const svc=SERVICES.find(s=>s.key===selSvc);const r=await dq("tariffs",{method:"POST",token,body:{service_key:selSvc,type,min_qty:0,max_qty:null,rate:0,cost:0,unit:svc?.unit||"kg",label:"Nuevo rango",sort_order:svcTariffs.length+1}});if(Array.isArray(r))setTariffs(p=>[...p,...r]);else if(r?.id)setTariffs(p=>[...p,r]);flash("Agregado");};
  const delTariff=async(id)=>{await dq("tariffs",{method:"DELETE",token,filters:`?id=eq.${id}`});setTariffs(p=>p.filter(t=>t.id!==id));flash("Eliminado");};
  const chT=(id,f,v)=>{setTariffs(p=>p.map(t=>t.id===id?{...t,[f]:v}:t));};
  const isCost=viewMode==="cost";
  const renderRow=(t)=><div key={t.id} style={{display:"flex",gap:8,alignItems:"end",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
    <div style={{flex:2}}><Inp label="Label" value={t.label} onChange={v=>chT(t.id,"label",v)} small/></div>
    <div style={{flex:1}}><Inp label="Min" type="number" value={t.min_qty} onChange={v=>chT(t.id,"min_qty",v)} step="0.01" small/></div>
    <div style={{flex:1}}><Inp label="Max" type="number" value={t.max_qty} onChange={v=>chT(t.id,"max_qty",v===""?null:v)} step="0.01" small/></div>
    <div style={{flex:1}}><Inp label={t.type==="surcharge"?"% Recargo":(isCost?"Costo":"Precio Venta")} type="number" value={isCost?t.cost:t.rate} onChange={v=>chT(t.id,isCost?"cost":"rate",v)} step="0.01" small/></div>
    {!isCost&&t.type==="rate"&&<div style={{flex:1,paddingBottom:12,textAlign:"center"}}><p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.2)",margin:"0 0 2px"}}>GANANCIA</p><p style={{fontSize:13,fontWeight:700,color:Number(t.rate)-Number(t.cost||0)>0?"#22c55e":"#ff6b6b",margin:0}}>${(Number(t.rate)-Number(t.cost||0)).toFixed(2)}</p></div>}
    <div style={{display:"flex",gap:4,paddingBottom:12}}><Btn onClick={()=>saveTariff(t)} small variant="secondary">Guardar</Btn><Btn onClick={()=>delTariff(t.id)} small variant="danger">X</Btn></div>
  </div>;
  // Cert flete config
  const [certConfig,setCertConfig]=useState([]);const [certLoaded,setCertLoaded]=useState(false);
  useEffect(()=>{if(!certLoaded){(async()=>{const r=await dq("calc_config",{token,filters:"?key=like.cert_flete_*&select=*"});setCertConfig(Array.isArray(r)?r:[]);setCertLoaded(true);})();}},[token,certLoaded]);
  const saveCertConfig=async(key,val)=>{await dq("calc_config",{method:"PATCH",token,filters:`?key=eq.${key}`,body:{value:Number(val)}});flash("Guardado");};
  const getCert=(key)=>certConfig.find(c=>c.key===key);

  if(!selSvc)return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>Tarifas</h2>{msg&&<span style={{fontSize:12,color:"#22c55e",fontWeight:600}}>{msg}</span>}</div>
    <div style={{display:"flex",gap:8,marginBottom:20}}>{[{k:"sell",l:"Precios de Venta"},{k:"cost",l:"Costos de Flete"}].map(m=><button key={m.k} onClick={()=>setViewMode(m.k)} style={{padding:"8px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:viewMode===m.k?`1.5px solid ${IC}`:"1.5px solid rgba(255,255,255,0.08)",background:viewMode===m.k?"rgba(184,149,106,0.12)":"rgba(255,255,255,0.028)",color:viewMode===m.k?IC:"rgba(255,255,255,0.4)",cursor:"pointer"}}>{m.l}</button>)}</div>
    {certLoaded&&<Card title="Certificación de Flete (CIF)"><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"-8px 0 12px"}}>Valores para calcular el CIF. Real = lo declarado ante aduana. Ficticio = lo que ve el cliente.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 12px"}}>{[
        {k:"cert_flete_aereo_real",l:"Aéreo REAL (USD/kg bruto)"},
        {k:"cert_flete_aereo_ficticio",l:"Aéreo FICTICIO (USD/kg fact.)"},
        {k:"cert_flete_maritimo_real",l:"Marítimo REAL (USD/CBM)"},
        {k:"cert_flete_maritimo_ficticio",l:"Marítimo FICTICIO (USD/CBM)"}
      ].map(f=>{const c=getCert(f.k);return <div key={f.k} style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.45)",marginBottom:4}}>{f.l}</label><input type="number" value={c?.value||""} onChange={e=>{setCertConfig(p=>p.map(x=>x.key===f.k?{...x,value:e.target.value}:x));}} onBlur={e=>saveCertConfig(f.k,e.target.value)} step="0.1" style={{width:"100%",padding:"8px 10px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/></div>;})}</div></Card>}
    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando...</p>:SERVICES.map(svc=>{const svcRates=tariffs.filter(t=>t.service_key===svc.key&&t.type==="rate");if(!svcRates.length)return null;return <div key={svc.key} onClick={()=>setSelSvc(svc.key)} style={{background:"rgba(255,255,255,0.028)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px 20px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.028)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.028)";}}><div><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{svc.label}</p>{svc.info&&<p style={{fontSize:12,color:"rgba(255,255,255,0.45)",margin:"2px 0 0"}}>{svc.info}</p>}</div><div style={{display:"flex",alignItems:"center",gap:12}}>{svcRates.map(r=><span key={r.id} style={{fontSize:11,color:isCost?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.5)"}}>{r.label}: ${isCost?Number(r.cost||0):Number(r.rate)}</span>)}<span style={{color:IC,fontSize:12,fontWeight:600}}>Editar →</span></div></div>;})}</div>;
  const svcInfo=SERVICES.find(s=>s.key===selSvc);
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{display:"flex",alignItems:"center",gap:12}}><button onClick={()=>setSelSvc(null)} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>← VOLVER</button><h2 style={{fontSize:18,fontWeight:700,color:"#fff",margin:0}}>{svcInfo?.label} — {isCost?"Costos":"Precios de Venta"}</h2>{msg&&<span style={{fontSize:12,color:"#22c55e",fontWeight:600}}>{msg}</span>}</div></div>
    <Card title="Rangos de tarifa" actions={<Btn onClick={()=>addTariff("rate")} small>+ Agregar rango</Btn>}>{rates.length>0?rates.map(renderRow):<p style={{color:"rgba(255,255,255,0.45)"}}>Sin rangos</p>}</Card>
    <Card title="Tarifas especiales" actions={<Btn onClick={()=>addTariff("special")} small>+ Agregar especial</Btn>}>{specials.length>0?specials.map(t=><div key={t.id} style={{display:"flex",gap:8,alignItems:"end",padding:"8px 0"}}><div style={{flex:2}}><Inp label="Label" value={t.label} onChange={v=>chT(t.id,"label",v)} small/></div><div style={{flex:1}}><Inp label={isCost?"Costo/un":"Tarifa/un"} type="number" value={isCost?t.cost:t.rate} onChange={v=>chT(t.id,isCost?"cost":"rate",v)} step="0.01" small/></div><div style={{flex:2}}><Inp label="Notas" value={t.notes} onChange={v=>chT(t.id,"notes",v)} small/></div><div style={{display:"flex",gap:4,paddingBottom:12}}><Btn onClick={()=>saveTariff(t)} small variant="secondary">Guardar</Btn><Btn onClick={()=>delTariff(t.id)} small variant="danger">X</Btn></div></div>):<p style={{color:"rgba(255,255,255,0.45)"}}>Sin tarifas especiales</p>}</Card>
    {!isCost&&<Card title="Recargos por valor" actions={<Btn onClick={()=>addTariff("surcharge")} small>+ Agregar recargo</Btn>}>{surcharges.length>0?surcharges.map(renderRow):<p style={{color:"rgba(255,255,255,0.45)"}}>Sin recargos</p>}</Card>}
  </div>;
}

function Calculator({token,clients}){
  const [step,setStep]=useState(0);const [origin,setOrigin]=useState("");const [selClient,setSelClient]=useState("");
  const [products,setProducts]=useState([{type:"general",description:"",unit_price:"",quantity:"1",ncm:null,ncmLoading:false,ncmError:false}]);
  const [pkgs,setPkgs]=useState([{qty:"1",length:"",width:"",height:"",weight:""}]);const [noDims,setNoDims]=useState(false);const [delivery,setDelivery]=useState("oficina");
  const [tariffs,setTariffs]=useState([]);const [overrides,setOverrides]=useState([]);const [results,setResults]=useState(null);
  const [hasBattery,setHasBattery]=useState(false);const [hasBrand,setHasBrand]=useState(false);const [expandedCh,setExpandedCh]=useState(null);const [config,setConfig]=useState({});
  const client=selClient?clients.find(c=>c.id===selClient):null;
  const ncm=products.find(p=>p.ncm?.ncm_code)?.ncm||null;
  useEffect(()=>{(async()=>{const [t,c]=await Promise.all([dq("tariffs",{token,filters:"?select=*&order=sort_order.asc"}),dq("calc_config",{token,filters:"?select=*"})]);setTariffs(Array.isArray(t)?t:[]);const cfg={};(Array.isArray(c)?c:[]).forEach(r=>{cfg[r.key]=Number(r.value);});setConfig(cfg);})();},[token]);
  useEffect(()=>{if(!selClient){setOverrides([]);return;}(async()=>{const ov=await dq("client_tariff_overrides",{token,filters:`?client_id=eq.${selClient}&select=*`});setOverrides(Array.isArray(ov)?ov:[]);})();},[selClient,token]);

  const addProduct=()=>setProducts(p=>[...p,{type:"general",description:"",unit_price:"",quantity:"1",ncm:null,ncmLoading:false,ncmError:false}]);
  const rmProduct=i=>setProducts(p=>p.filter((_,j)=>j!==i));
  const chProd=(i,f,v)=>setProducts(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));
  const addPkg=()=>setPkgs(p=>[...p,{qty:"1",length:"",width:"",height:"",weight:""}]);
  const rmPkg=i=>setPkgs(p=>p.filter((_,j)=>j!==i));
  const chPkg=(i,f,v)=>setPkgs(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));
  const totalFob=products.reduce((s,p)=>s+(Number(p.unit_price||0)*Number(p.quantity||1)),0);
  const hasPhones=products.some(p=>p.type==="celulares");

  const calcTotals=()=>{let tw=0,tv=0,tc=0;pkgs.forEach(pk=>{const q=Number(pk.qty||1),l=Number(pk.length||0),w=Number(pk.width||0),h=Number(pk.height||0),gw=Number(pk.weight||0);tw+=gw*q;if(l&&w&&h){tv+=((l*w*h)/5000)*q;tc+=((l*w*h)/1000000)*q;}});return{totWeight:tw,totVol:tv,totCBM:tc,billable:Math.max(tw,tv)};};

  const getEffRate=(t)=>{const ov=overrides.find(o=>o.tariff_id===t.id);return ov?Number(ov.custom_rate):Number(t.rate);};
  const getFleteRate=(svcKey,amount)=>{const rates=tariffs.filter(t=>t.service_key===svcKey&&t.type==="rate");for(const r of rates){const min=Number(r.min_qty||0),max=r.max_qty!=null?Number(r.max_qty):Infinity;if(amount>=min&&amount<max)return{rate:getEffRate(r),cost:Number(r.cost||0)};}return rates.length?{rate:getEffRate(rates[rates.length-1]),cost:Number(rates[rates.length-1].cost||0)}:{rate:0,cost:0};};
  const getSurcharge=(svcKey,totalVal,amount)=>{const surcharges=tariffs.filter(t=>t.service_key===svcKey&&t.type==="surcharge").sort((a,b)=>Number(b.min_qty)-Number(a.min_qty));if(amount<=0)return{pct:0,amt:0};const vpu=totalVal/amount;for(const s of surcharges){if(vpu>=Number(s.min_qty))return{pct:Number(s.rate),amt:totalVal*(Number(s.rate)/100)};}return{pct:0,amt:0};};

  const classifyProduct=async(idx)=>{const p=products[idx];if(!p.description?.trim())return;
    setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:true,ncmError:false}:x));
    try{const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:p.description})});const d=await r.json();
      if(d.fallback||d.error){setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:false,ncmError:true,ncm:null}:x));}
      else{setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:false,ncmError:false,ncm:d}:x));}
    }catch{setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:false,ncmError:true,ncm:null}:x));}};

  const calculate=()=>{
    const{totWeight,totCBM}=calcTotals();const channels=[];
    if(origin==="USA"){
      if(totWeight>0){const{rate,cost}=hasPhones?{rate:65,cost:0}:getFleteRate("aereo_b_usa",totWeight);const flete=totWeight*rate;const fCost=totWeight*cost;const sur=getSurcharge("aereo_b_usa",totalFob,totWeight);
        channels.push({key:"aereo_b_usa",name:"Aéreo Integral AC",info:"48-72 hs",isBlanco:false,flete,fCost,surcharge:sur.amt,surchargePct:sur.pct,total:flete+sur.amt,unit:`${totWeight.toFixed(1)} kg`});}
      if(!hasPhones&&!noDims&&totCBM>0){const{rate,cost}=getFleteRate("maritimo_b",totCBM);const flete=totCBM*rate;const fCost=totCBM*cost;const sur=getSurcharge("maritimo_b",totalFob,totCBM);
        channels.push({key:"maritimo_b",name:"Marítimo Integral AC",info:"",isBlanco:false,flete,fCost,surcharge:sur.amt,surchargePct:sur.pct,total:flete+sur.amt,unit:`${totCBM.toFixed(4)} CBM`});}
    }
    if(origin==="China"){
      const certAerReal=config.cert_flete_aereo_real||2.5;const certAerFict=config.cert_flete_aereo_ficticio||3.5;
      const certMarReal=config.cert_flete_maritimo_real||50;const certMarFict=config.cert_flete_maritimo_ficticio||100;
      const getDesembolso=(cif)=>{const t=[[5,0],[9,36],[20,50],[50,58],[100,65],[400,72],[800,84],[1000,96],[Infinity,120]];for(const[max,amt]of t)if(cif<max)return amt;return 120;};

      // Peso facturable per-bulto (same as client)
      let fact=0;pkgs.forEach(pk=>{const q=Number(pk.qty||1),l=Number(pk.length||0),w=Number(pk.width||0),h=Number(pk.height||0),gw=Number(pk.weight||0);fact+=Math.max(gw*q,l&&w&&h?((l*w*h)/5000)*q:0);});

      // Per-item tax helper (returns breakdown)
      const calcItemTax=(p,certFl,isMar,totalCif)=>{const itemFob=Number(p.unit_price||0)*Number(p.quantity||1);const pct=totalFob>0?itemFob/totalFob:1;
        const iCert=certFl*pct;const iSeg=(itemFob+iCert)*0.01;const iCif=itemFob+iCert+iSeg;
        const dr=Number(p.ncm?.import_duty_rate||0)/100;const te_r=Number(p.ncm?.statistics_rate||0)/100;const ivaR=Number(p.ncm?.iva_rate||21)/100;
        const die=iCif*dr;const te=iCif*te_r;const bi=iCif+die+te;const iva=bi*ivaR;let tot=die+te+iva;
        const br={desc:p.description||"Producto",fob:itemFob,cif:iCif,seguro:iSeg,derechos:die,tasa_e:te,iva,drPct:p.ncm?.import_duty_rate||0,tePct:p.ncm?.statistics_rate||0,ivaPct:p.ncm?.iva_rate||21,ivaAdic:0,iigg:0,iibb:0,desembolso:0,ivaDesemb:0};
        if(isMar){const ia=bi*0.20;const ig=bi*0.06;const ib=bi*0.05;tot+=ia+ig+ib;br.ivaAdic=ia;br.iigg=ig;br.iibb=ib;}
        else{const tasa=getDesembolso(totalCif)*pct;tot+=tasa+tasa*0.21;br.desembolso=tasa;br.ivaDesemb=tasa*0.21;}
        br.totalImp=tot;
        return br;};
      const sumItems=(items,k)=>items.reduce((s,it)=>s+(it[k]||0),0);

      // Aéreo Courier Comercial (A) — omitido si hay marca
      if(!hasBrand&&fact>0){const{rate,cost}=getFleteRate("aereo_a_china",fact);const flete=fact*rate;const fCost=fact*cost;
        const certFlFict=fact*certAerFict;const segFict=(totalFob+certFlFict)*0.01;const cifFict=totalFob+certFlFict+segFict;
        const certFlReal=totWeight*certAerReal;const segReal=(totalFob+certFlReal)*0.01;const cifReal=totalFob+certFlReal+segReal;
        const validProds=products.filter(p=>Number(p.unit_price)>0);
        const itemsFict=validProds.map(p=>calcItemTax(p,certFlFict,false,cifFict));
        const itemsReal=validProds.map(p=>calcItemTax(p,certFlReal,false,cifReal));
        const impFict=sumItems(itemsFict,"totalImp");const impReal=sumItems(itemsReal,"totalImp");
        const battExtra=hasBattery?fact*2:0;const gananciaImp=impFict-impReal;
        channels.push({key:"aereo_a_china",name:"Aéreo Courier Comercial",info:"7-10 días",isBlanco:true,
          flete,fCost,seguro:segFict,battExtra,totalImp:impFict,totalSvc:flete+segFict+battExtra,total:impFict+flete+segFict+battExtra,
          derechos:sumItems(itemsFict,"derechos"),tasa_e:sumItems(itemsFict,"tasa_e"),iva:sumItems(itemsFict,"iva"),gastoDoc:sumItems(itemsFict,"desembolso"),ivaDesemb:sumItems(itemsFict,"ivaDesemb"),
          items:itemsFict,cifReal,cifFict,impReal,impFict,gananciaImp,unit:`${fact.toFixed(1)} kg`});}
      // Aéreo Integral AC (B)
      if(totWeight>0){const{rate,cost}=getFleteRate("aereo_b_china",totWeight);const flete=totWeight*rate;const fCost=totWeight*cost;const sur=getSurcharge("aereo_b_china",totalFob,totWeight);
        channels.push({key:"aereo_b_china",name:"Aéreo Integral AC",info:"10-15 días",isBlanco:false,flete,fCost,surcharge:sur.amt,surchargePct:sur.pct,total:flete+sur.amt,unit:`${totWeight.toFixed(1)} kg`});}
      // Marítimo Carga LCL/FCL (A) — omitido si hay marca
      if(!hasBrand&&!noDims&&totCBM>0){const{rate,cost}=getFleteRate("maritimo_a_china",totCBM);const flete=totCBM*rate;const fCost=totCBM*cost;
        const certFlFict=totCBM*certMarFict;const segFict=(totalFob+certFlFict)*0.01;const cifFict=totalFob+certFlFict+segFict;
        const certFlReal=totCBM*certMarReal;const segReal=(totalFob+certFlReal)*0.01;const cifReal=totalFob+certFlReal+segReal;
        const validProds=products.filter(p=>Number(p.unit_price)>0);
        const itemsFict=validProds.map(p=>calcItemTax(p,certFlFict,true,cifFict));
        const itemsReal=validProds.map(p=>calcItemTax(p,certFlReal,true,cifReal));
        const impFict=sumItems(itemsFict,"totalImp");const impReal=sumItems(itemsReal,"totalImp");
        const gananciaImp=impFict-impReal;
        channels.push({key:"maritimo_a_china",name:"Marítimo Carga LCL/FCL",info:"",isBlanco:true,isMar:true,
          flete,fCost,seguro:segFict,totalImp:impFict,totalSvc:flete+segFict,total:impFict+flete+segFict,
          derechos:sumItems(itemsFict,"derechos"),tasa_e:sumItems(itemsFict,"tasa_e"),iva:sumItems(itemsFict,"iva"),ivaAdic:sumItems(itemsFict,"ivaAdic"),iigg:sumItems(itemsFict,"iigg"),iibb:sumItems(itemsFict,"iibb"),
          items:itemsFict,cifReal,cifFict,impReal,impFict,gananciaImp,
          unit:`${totCBM.toFixed(4)} CBM`});}
      // Marítimo Integral AC (B)
      if(!noDims&&totCBM>0){const{rate,cost}=getFleteRate("maritimo_b",totCBM);const flete=totCBM*rate;const fCost=totCBM*cost;const sur=getSurcharge("maritimo_b",totalFob,totCBM);
        channels.push({key:"maritimo_b",name:"Marítimo Integral AC",info:"",isBlanco:false,flete,fCost,surcharge:sur.amt,surchargePct:sur.pct,total:flete+sur.amt,unit:`${totCBM.toFixed(4)} CBM`});}
      channels.sort((a,b)=>a.total-b.total);
    }
    setResults({channels,totWeight,totCBM});setStep(4);
  };

  const usd=v=>`USD ${v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const row=(l,v,bold,accent)=><div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",...(bold?{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:8}:{})}}><span style={{fontSize:12,color:bold?"#fff":"rgba(255,255,255,0.45)",fontWeight:bold?700:400}}>{l}</span><span style={{fontSize:12,fontWeight:bold?700:600,color:accent?IC:bold?"#fff":"rgba(255,255,255,0.7)"}}>{usd(v)}</span></div>;
  const clName=selClient?clients.find(c=>c.id===selClient):null;

  return <div><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 20px"}}>Calculadora de Importación</h2>
    {/* Client selector - always visible */}
    <Card><Sel label="Cliente (para tarifas custom)" value={selClient} onChange={setSelClient} options={clients.map(c=>({value:c.id,label:`${c.client_code} — ${c.first_name} ${c.last_name}`}))} ph="Sin cliente (tarifa base)"/>
    {selClient&&overrides.length>0&&<p style={{fontSize:11,color:IC,margin:"-8px 0 0",fontWeight:600}}>Usando {overrides.length} tarifa(s) custom</p>}</Card>

    {step===0&&<div style={{display:"flex",gap:24,justifyContent:"center",padding:"2rem 0"}}>{[{k:"China",flag:"\ud83c\udde8\ud83c\uddf3"},{k:"USA",flag:"\ud83c\uddfa\ud83c\uddf8"}].map(c=><div key={c.k} onClick={()=>{setOrigin(c.k);setStep(1);}} style={{width:200,padding:"2.5rem 1.5rem",background:"rgba(255,255,255,0.028)",border:"1.5px solid rgba(255,255,255,0.08)",borderRadius:16,cursor:"pointer",textAlign:"center"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=IC;e.currentTarget.style.background="rgba(184,149,106,0.08)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.background="rgba(255,255,255,0.028)";}}><p style={{fontSize:52,margin:"0 0 16px"}}>{c.flag}</p><p style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>{c.k}</p></div>)}</div>}

    {step===1&&origin==="USA"&&<Card title="PRODUCTOS">
      {products.map((p,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Producto {i+1}</span>{products.length>1&&<Btn onClick={()=>rmProduct(i)} small variant="danger">Eliminar</Btn>}</div>
        <div style={{display:"flex",gap:12,marginBottom:12}}>{[{k:"general",l:"Carga General"},{k:"celulares",l:"Celulares"}].map(t=><div key={t.k} onClick={()=>chProd(i,"type",t.k)} style={{flex:1,padding:"12px",textAlign:"center",borderRadius:10,border:`1.5px solid ${p.type===t.k?IC:"rgba(255,255,255,0.08)"}`,background:p.type===t.k?"rgba(184,149,106,0.1)":"transparent",cursor:"pointer"}}><span style={{fontSize:13,fontWeight:600,color:p.type===t.k?IC:"rgba(255,255,255,0.4)"}}>{t.l}</span></div>)}</div>
        {p.type==="general"&&<Inp label="Descripción" value={p.description} onChange={v=>chProd(i,"description",v)} placeholder="Ej: Fundas de silicona"/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Precio unit. (USD)" type="number" value={p.unit_price} onChange={v=>chProd(i,"unit_price",v)} placeholder="3.50"/><Inp label="Cantidad" type="number" value={p.quantity} onChange={v=>chProd(i,"quantity",v)} placeholder="1"/></div>
      </div>)}
      <button onClick={addProduct} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar producto</button>
      {totalFob>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:12,marginTop:16,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Valor total</span><span style={{fontSize:16,fontWeight:700,color:IC}}>{usd(totalFob)}</span></div>}
      <div style={{display:"flex",gap:12,marginTop:16}}><Btn variant="secondary" onClick={()=>{setStep(0);setOrigin("");}}>← Origen</Btn><Btn onClick={()=>setStep(2)} disabled={!products.some(p=>Number(p.unit_price)>0)}>Siguiente →</Btn></div>
    </Card>}

    {step===2&&origin==="USA"&&<Card title="PACKING LIST">
      {pkgs.map((pk,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Bulto {i+1}</span>{pkgs.length>1&&<Btn onClick={()=>rmPkg(i)} small variant="danger">Eliminar</Btn>}</div>
        <div style={{display:"grid",gridTemplateColumns:noDims?"1fr 1fr":"1fr 1fr 1fr 1fr 1fr",gap:"0 10px"}}>
          <Inp label="Cant." type="number" value={pk.qty} onChange={v=>chPkg(i,"qty",v)} placeholder="1"/>
          {!noDims&&<><Inp label="Largo cm" type="number" value={pk.length} onChange={v=>chPkg(i,"length",v)} placeholder="60"/><Inp label="Ancho cm" type="number" value={pk.width} onChange={v=>chPkg(i,"width",v)} placeholder="40"/><Inp label="Alto cm" type="number" value={pk.height} onChange={v=>chPkg(i,"height",v)} placeholder="35"/></>}
          <Inp label="Peso kg" type="number" value={pk.weight} onChange={v=>chPkg(i,"weight",v)} placeholder="12"/>
        </div>
      </div>)}
      <button onClick={addPkg} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar bulto</button>
      <div style={{marginTop:12}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={noDims} onChange={e=>setNoDims(e.target.checked)}/><span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Sin medidas (solo aéreo)</span></label></div>
      <div style={{display:"flex",gap:12,marginTop:16}}><Btn variant="secondary" onClick={()=>setStep(1)}>← Atrás</Btn><Btn onClick={()=>setStep(3)} disabled={!pkgs.some(p=>Number(p.weight)>0)}>Siguiente →</Btn></div>
    </Card>}

    {step===3&&origin==="USA"&&<Card title="ENTREGA EN DESTINO">
      <div style={{display:"flex",gap:12,marginBottom:16}}>{[{k:"oficina",l:"Retiro por Oficina",sub:"Gratis"},{k:"caba",l:"Envío CABA",sub:"$20"},{k:"gba",l:"Envío a todo el país",sub:"A cotizar"}].map(d=><div key={d.k} onClick={()=>setDelivery(d.k)} style={{flex:1,padding:"14px",textAlign:"center",borderRadius:10,border:`1.5px solid ${delivery===d.k?IC:"rgba(255,255,255,0.08)"}`,background:delivery===d.k?"rgba(184,149,106,0.1)":"transparent",cursor:"pointer"}}><p style={{fontSize:14,fontWeight:700,color:delivery===d.k?IC:"rgba(255,255,255,0.5)",margin:"0 0 2px"}}>{d.l}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.45)",margin:0}}>{d.sub}</p></div>)}</div>
      <div style={{display:"flex",gap:12}}><Btn variant="secondary" onClick={()=>setStep(2)}>← Atrás</Btn><Btn onClick={calculate}>Calcular costos →</Btn></div>
    </Card>}

    {step===4&&results&&<div>
      <div style={{display:"flex",gap:12,marginBottom:16}}><button onClick={()=>setStep(3)} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button><span style={{color:"rgba(255,255,255,0.1)"}}>|</span><button onClick={()=>{setStep(0);setResults(null);setOrigin("");setProducts([{type:"general",description:"",unit_price:"",quantity:"1",ncm:null,ncmLoading:false,ncmError:false}]);setPkgs([{qty:"1",length:"",width:"",height:"",weight:""}]);setNoDims(false);setDelivery("oficina");setHasBattery(false);setHasBrand(false);}} style={{fontSize:13,color:"rgba(255,255,255,0.4)",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>Nueva cotización</button></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>{results.channels.map(ch=>{const delivCost=delivery==="caba"?20:0;const clientTotal=ch.total+delivCost;const gananciaFlete=ch.flete-(ch.fCost||0);const gananciaImp=ch.gananciaImp||0;const gananciaTotal=gananciaFlete+gananciaImp;return <div key={ch.key} style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.5rem"}}>
        <p style={{fontSize:17,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>{ch.name}</p>
        {ch.info&&<span style={{fontSize:11,color:"rgba(255,255,255,0.45)",padding:"3px 10px",background:"rgba(255,255,255,0.028)",borderRadius:4}}>{ch.info}</span>}
        <div style={{marginTop:14}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 8px"}}>COTIZACIÓN CLIENTE</p>
          {ch.isBlanco?<>
            {row("Flete",ch.flete)}{ch.battExtra>0&&row("Recargo baterías",ch.battExtra)}{row("Seguro",ch.seguro)}
            {row(`Derechos (${ncm?.import_duty_rate||0}%)`,ch.derechos)}{row(`TE (${ncm?.statistics_rate||0}%)`,ch.tasa_e)}{row(`IVA (${ncm?.iva_rate||21}%)`,ch.iva)}
            {ch.isMar?<>{row("IVA Adic. (20%)",ch.ivaAdic)}{row("IIGG (6%)",ch.iigg)}{row("IIBB (5%)",ch.iibb)}</>:<>{row("Gasto doc.",ch.gastoDoc)}{row("IVA desemb.",ch.ivaDesemb)}</>}
          </>:<>
            {row("Servicio Integral ARGENCARGO",ch.flete)}
            {ch.surcharge>0&&row(`Recargo valor (${ch.surchargePct}%)`,ch.surcharge)}
          </>}
          {delivCost>0&&row("Envío CABA",delivCost)}
          {row("TOTAL CLIENTE",clientTotal,true,true)}
        </div>
        <div style={{marginTop:16,background:"rgba(34,197,94,0.06)",borderRadius:10,border:"1px solid rgba(34,197,94,0.15)",padding:14}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 8px"}}>RENTABILIDAD</p>
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Ganancia flete</span><span style={{fontSize:12,fontWeight:600,color:"#22c55e"}}>{usd(gananciaFlete)}</span></div>
          {ch.isBlanco&&gananciaImp>0&&<>
            <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Ganancia oculta (CIF)</span><span style={{fontSize:12,fontWeight:600,color:"#22c55e"}}>{usd(gananciaImp)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{fontSize:10,color:"rgba(255,255,255,0.45)"}}>CIF real: {usd(ch.cifReal||0)} → Imp real: {usd(ch.impReal||0)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{fontSize:10,color:"rgba(255,255,255,0.45)"}}>CIF ficticio: {usd(ch.cifFict||0)} → Imp ficticio: {usd(ch.impFict||0)}</span></div>
          </>}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4}}><span style={{fontSize:14,fontWeight:700,color:"#fff"}}>GANANCIA TOTAL</span><span style={{fontSize:16,fontWeight:700,color:gananciaTotal>0?"#22c55e":"#ff6b6b"}}>{usd(gananciaTotal)}</span></div>
          {clientTotal>0&&<p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"2px 0 0"}}>Margen: {((gananciaTotal/clientTotal)*100).toFixed(1)}%</p>}
        </div>
      </div>})}</div>
    </div>}

    {/* CHINA FLOW - Step 1: brand + battery cards + per-product NCM */}
    {step===1&&origin==="China"&&<Card>
      <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 12px"}}>¿Los productos tienen marca?</h3>
      <div style={{display:"flex",gap:12,marginBottom:12}}>{[{k:true,icon:"®",l:"Sí, con marca",sub:"Productos branded / licencia"},{k:false,icon:"✓",l:"Sin marca",sub:"Productos genéricos"}].map(o=><div key={String(o.k)} onClick={()=>setHasBrand(o.k)} style={{flex:1,padding:"20px",textAlign:"center",borderRadius:12,border:`1.5px solid ${hasBrand===o.k?IC:"rgba(255,255,255,0.08)"}`,background:hasBrand===o.k?"rgba(184,149,106,0.1)":"rgba(255,255,255,0.028)",cursor:"pointer"}}><p style={{fontSize:24,margin:"0 0 8px"}}>{o.icon}</p><p style={{fontSize:14,fontWeight:700,color:hasBrand===o.k?IC:"rgba(255,255,255,0.6)",margin:"0 0 4px"}}>{o.l}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.45)",margin:0}}>{o.sub}</p></div>)}</div>
      {hasBrand&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.15)",borderRadius:10,padding:"12px 16px",marginBottom:20}}><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>Las importaciones con marca se despachan solo por canal <strong style={{color:IC}}>Integral AC</strong> (courier). No es necesario clasificar NCM.</p></div>}

      <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 12px"}}>¿Tu producto contiene batería interna?</h3>
      <div style={{display:"flex",gap:12,marginBottom:12}}>{[{k:true,icon:"⚡",l:"Sí, tiene batería",sub:"Recargable / Litio"},{k:false,icon:"✓",l:"No tiene batería",sub:"Producto estándar"}].map(o=><div key={String(o.k)} onClick={()=>setHasBattery(o.k)} style={{flex:1,padding:"20px",textAlign:"center",borderRadius:12,border:`1.5px solid ${hasBattery===o.k?IC:"rgba(255,255,255,0.08)"}`,background:hasBattery===o.k?"rgba(184,149,106,0.1)":"rgba(255,255,255,0.028)",cursor:"pointer"}}><p style={{fontSize:24,margin:"0 0 8px"}}>{o.icon}</p><p style={{fontSize:14,fontWeight:700,color:hasBattery===o.k?IC:"rgba(255,255,255,0.6)",margin:"0 0 4px"}}>{o.l}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.45)",margin:0}}>{o.sub}</p></div>)}</div>
      {hasBattery&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.15)",borderRadius:10,padding:"12px 16px",marginBottom:20}}><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>Productos con batería interna (auriculares bluetooth, power banks, smartwatch) son mercadería peligrosa y se despachan desde <strong style={{color:IC}}>Hong Kong</strong>. Recargo de <strong style={{color:IC}}>$2/kg</strong>.</p></div>}

      <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"20px 0 16px"}}>PRODUCTOS</h3>
      {products.map((p,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Producto {i+1}</span>{products.length>1&&<Btn onClick={()=>rmProduct(i)} small variant="danger">Eliminar</Btn>}</div>
        <div style={{marginBottom:14}}><label style={{display:"block",fontSize:13,fontWeight:700,color:"#fff",marginBottom:5}}>Descripción de la mercadería</label><div style={{display:"flex",gap:8}}><input value={p.description||""} onChange={e=>chProd(i,"description",e.target.value)} placeholder="Sé específico. Ej: Auriculares inalámbricos bluetooth" style={{flex:1,padding:"11px 14px",fontSize:14,border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.1)",color:"#fff",outline:"none"}}/>{!hasBrand&&<button onClick={()=>classifyProduct(i)} disabled={p.ncmLoading||!p.description?.trim()} style={{padding:"11px 16px",fontSize:12,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${B.accent},${B.primary})`,color:"#fff",whiteSpace:"nowrap",opacity:p.ncmLoading?0.6:1}}>{p.ncmLoading?"Clasificando...":"Clasificar"}</button>}</div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Precio unit. (USD)" type="number" value={p.unit_price} onChange={v=>chProd(i,"unit_price",v)} placeholder="3.50"/><Inp label="Cantidad" type="number" value={p.quantity} onChange={v=>chProd(i,"quantity",v)} placeholder="1"/></div>
        {!hasBrand&&p.ncm?.ncm_code&&<div style={{background:"rgba(184,149,106,0.06)",borderRadius:10,padding:"12px 16px",marginBottom:8,border:"1px solid rgba(184,149,106,0.12)"}}><div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}><span style={{fontFamily:"monospace",fontWeight:700,color:IC,padding:"4px 10px",background:"rgba(184,149,106,0.15)",borderRadius:6,fontSize:12}}>{p.ncm.ncm_code}</span><span style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>{p.ncm.ncm_description}</span><button onClick={()=>chProd(i,"ncm",null)} style={{fontSize:11,color:"rgba(255,255,255,0.4)",background:"none",border:"none",cursor:"pointer",marginLeft:"auto"}}>Reclasificar</button></div><div style={{display:"flex",gap:16,marginTop:6}}><span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>DIE: <strong style={{color:"#fff"}}>{p.ncm.import_duty_rate}%</strong></span><span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>TE: <strong style={{color:"#fff"}}>{p.ncm.statistics_rate}%</strong></span><span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>IVA: <strong style={{color:"#fff"}}>{p.ncm.iva_rate}%</strong></span></div></div>}
        {!hasBrand&&p.ncmError&&<div style={{background:"rgba(255,80,80,0.08)",borderRadius:10,padding:"12px 16px",marginBottom:8,border:"1px solid rgba(255,80,80,0.15)"}}><p style={{fontSize:13,color:"#ff6b6b",margin:"0 0 6px",fontWeight:600}}>No se pudo detectar el NCM. Cargá manualmente:</p><div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 8px"}}><Inp label="NCM" value={p.ncm?.ncm_code||""} onChange={v=>chProd(i,"ncm",{...(p.ncm||{ncm_description:p.description}),ncm_code:v,import_duty_rate:p.ncm?.import_duty_rate||35,statistics_rate:p.ncm?.statistics_rate||3,iva_rate:p.ncm?.iva_rate||21})} placeholder="3926.90.90"/><Inp label="DIE %" type="number" value={p.ncm?.import_duty_rate||""} onChange={v=>chProd(i,"ncm",{...(p.ncm||{ncm_code:"MANUAL",ncm_description:p.description}),import_duty_rate:Number(v)||35,statistics_rate:p.ncm?.statistics_rate||3,iva_rate:p.ncm?.iva_rate||21})}/><Inp label="TE %" type="number" value={p.ncm?.statistics_rate||""} onChange={v=>chProd(i,"ncm",{...(p.ncm||{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:35,iva_rate:21}),statistics_rate:Number(v)||3})}/><Inp label="IVA %" type="number" value={p.ncm?.iva_rate||""} onChange={v=>chProd(i,"ncm",{...(p.ncm||{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:35,statistics_rate:3}),iva_rate:Number(v)||21})}/></div></div>}
        {!hasBrand&&!p.ncm&&!p.ncmError&&!p.ncmLoading&&p.description?.trim()&&<div style={{marginBottom:8}}><button onClick={()=>chProd(i,"ncm",{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:35,statistics_rate:3,iva_rate:21})} style={{fontSize:11,color:"rgba(255,255,255,0.4)",background:"none",border:"none",cursor:"pointer",padding:0}}>Usar valores estimados (35% derechos) →</button></div>}
      </div>)}
      <button onClick={addProduct} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar producto</button>
      {totalFob>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:12,marginTop:16,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Valor total</span><span style={{fontSize:16,fontWeight:700,color:IC}}>{usd(totalFob)}</span></div>}
      {(()=>{const hasPriced=products.some(p=>Number(p.unit_price)>0);const pendingClass=!hasBrand&&products.some(p=>Number(p.unit_price)>0&&!p.ncm);const blocked=!hasPriced||pendingClass;return <>
        {pendingClass&&<div style={{background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:10,padding:"10px 14px",marginTop:14}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>⚠️ Tenés que clasificar cada producto antes de avanzar.</p></div>}
        <div style={{display:"flex",gap:12,marginTop:16}}><Btn variant="secondary" onClick={()=>{setStep(0);setOrigin("");}}>← Origen</Btn><Btn onClick={()=>setStep(2)} disabled={blocked}>Siguiente →</Btn></div>
      </>;})()}
    </Card>}
    {step===2&&origin==="China"&&<Card title="PACKING LIST">
      {pkgs.map((pk,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Bulto {i+1}</span>{pkgs.length>1&&<Btn onClick={()=>rmPkg(i)} small variant="danger">Eliminar</Btn>}</div>
        <div style={{display:"grid",gridTemplateColumns:noDims?"1fr 1fr":"1fr 1fr 1fr 1fr 1fr",gap:"0 10px"}}>
          <Inp label="Cant." type="number" value={pk.qty} onChange={v=>chPkg(i,"qty",v)} placeholder="1"/>
          {!noDims&&<><Inp label="Largo cm" type="number" value={pk.length} onChange={v=>chPkg(i,"length",v)} placeholder="60"/><Inp label="Ancho cm" type="number" value={pk.width} onChange={v=>chPkg(i,"width",v)} placeholder="40"/><Inp label="Alto cm" type="number" value={pk.height} onChange={v=>chPkg(i,"height",v)} placeholder="35"/></>}
          <Inp label="Peso kg" type="number" value={pk.weight} onChange={v=>chPkg(i,"weight",v)} placeholder="12"/>
        </div>
      </div>)}
      <button onClick={addPkg} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar bulto</button>
      <div style={{marginTop:12}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={noDims} onChange={e=>setNoDims(e.target.checked)}/><span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Sin medidas (solo aéreo)</span></label></div>
      <div style={{display:"flex",gap:12,marginTop:16}}><Btn variant="secondary" onClick={()=>setStep(1)}>← Atrás</Btn><Btn onClick={()=>setStep(3)} disabled={!pkgs.some(p=>Number(p.weight)>0)}>Siguiente →</Btn></div>
    </Card>}
    {step===3&&origin==="China"&&<Card title="ENTREGA EN DESTINO">
      <div style={{display:"flex",gap:12,marginBottom:16}}>{[{k:"oficina",l:"Retiro por Oficina",sub:"Gratis"},{k:"caba",l:"Envío CABA",sub:"$20"},{k:"gba",l:"Envío a todo el país",sub:"A cotizar"}].map(d=><div key={d.k} onClick={()=>setDelivery(d.k)} style={{flex:1,padding:"14px",textAlign:"center",borderRadius:10,border:`1.5px solid ${delivery===d.k?IC:"rgba(255,255,255,0.08)"}`,background:delivery===d.k?"rgba(184,149,106,0.1)":"transparent",cursor:"pointer"}}><p style={{fontSize:14,fontWeight:700,color:delivery===d.k?IC:"rgba(255,255,255,0.5)",margin:"0 0 2px"}}>{d.l}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.45)",margin:0}}>{d.sub}</p></div>)}</div>
      <div style={{display:"flex",gap:12}}><Btn variant="secondary" onClick={()=>setStep(2)}>← Atrás</Btn><Btn onClick={calculate}>Calcular costos →</Btn></div>
    </Card>}
  </div>;
}

// Audit Log: visualizador del histórico de cambios en el sistema
function AuditLogCard({token}){
  const [logs,setLogs]=useState([]);
  const [lo,setLo]=useState(true);
  const [filterEntity,setFilterEntity]=useState("all");
  const [filterAction,setFilterAction]=useState("all");
  const [search,setSearch]=useState("");
  const [expandedId,setExpandedId]=useState(null);
  const [limit,setLimit]=useState(100);
  const load=async()=>{
    setLo(true);
    let filters=`?select=*&order=created_at.desc&limit=${limit}`;
    if(filterEntity!=="all")filters+=`&entity_type=eq.${filterEntity}`;
    if(filterAction!=="all")filters+=`&action=eq.${filterAction}`;
    const r=await dq("audit_log",{token,filters});
    setLogs(Array.isArray(r)?r:[]);
    setLo(false);
  };
  useEffect(()=>{load();},[token,filterEntity,filterAction,limit]);
  const filtered=search?logs.filter(l=>{const q=search.toLowerCase();return l.entity_code?.toLowerCase().includes(q)||l.user_email?.toLowerCase().includes(q)||l.entity_type?.toLowerCase().includes(q);}):logs;
  const entityLabels={operation:"Operación",flight:"Vuelo",payment_management:"Gestión Pago",client_payment:"Cobro Cliente",supplier_payment:"Pago Proveedor",finance_entry:"Asiento Finanzas",client:"Cliente",tariff:"Tarifa"};
  const actionColors={INSERT:{bg:"rgba(34,197,94,0.12)",fg:"#22c55e",label:"CREÓ"},UPDATE:{bg:"rgba(96,165,250,0.12)",fg:"#60a5fa",label:"EDITÓ"},DELETE:{bg:"rgba(239,68,68,0.12)",fg:"#ef4444",label:"BORRÓ"}};
  const renderChange=(key,val)=>{
    if(val&&typeof val==="object"&&val.from!==undefined){
      const fmt=(v)=>v===null?<em style={{color:"rgba(255,255,255,0.3)"}}>vacío</em>:typeof v==="object"?JSON.stringify(v):String(v);
      return <div key={key} style={{display:"flex",gap:8,padding:"4px 0",fontSize:11,fontFamily:"monospace",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
        <span style={{color:IC,fontWeight:600,minWidth:140}}>{key}:</span>
        <span style={{color:"#ff6b6b",textDecoration:"line-through",opacity:0.7}}>{fmt(val.from)}</span>
        <span style={{color:"rgba(255,255,255,0.3)"}}>→</span>
        <span style={{color:"#22c55e"}}>{fmt(val.to)}</span>
      </div>;
    }
    return <div key={key} style={{display:"flex",gap:8,padding:"4px 0",fontSize:11,fontFamily:"monospace"}}>
      <span style={{color:IC,fontWeight:600,minWidth:140}}>{key}:</span>
      <span style={{color:"rgba(255,255,255,0.7)"}}>{val===null?"vacío":typeof val==="object"?JSON.stringify(val):String(val)}</span>
    </div>;
  };
  return <Card title={`📜 Histórico de cambios (${filtered.length})`}>
    <p style={{fontSize:12,color:"rgba(255,255,255,0.6)",margin:"0 0 14px",lineHeight:1.5}}>Registro automático de todos los cambios en operaciones, vuelos, pagos, clientes, tarifas y finanzas. Útil para debugging y rastrear quién hizo qué cuándo.</p>

    <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
      <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>Tipo:</span>
      {[{k:"all",l:"Todo"},{k:"operation",l:"Op"},{k:"flight",l:"Vuelo"},{k:"client_payment",l:"Cobro"},{k:"supplier_payment",l:"Pago Prov"},{k:"client",l:"Cliente"},{k:"tariff",l:"Tarifa"},{k:"finance_entry",l:"Finanzas"}].map(t=><button key={t.k} onClick={()=>setFilterEntity(t.k)} style={{padding:"4px 10px",fontSize:11,fontWeight:600,borderRadius:5,border:`1px solid ${filterEntity===t.k?IC:"rgba(255,255,255,0.08)"}`,background:filterEntity===t.k?"rgba(184,149,106,0.1)":"transparent",color:filterEntity===t.k?IC:"rgba(255,255,255,0.5)",cursor:"pointer"}}>{t.l}</button>)}
    </div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>Acción:</span>
      {[{k:"all",l:"Todas"},{k:"INSERT",l:"Creaciones"},{k:"UPDATE",l:"Ediciones"},{k:"DELETE",l:"Borrados"}].map(t=><button key={t.k} onClick={()=>setFilterAction(t.k)} style={{padding:"4px 10px",fontSize:11,fontWeight:600,borderRadius:5,border:`1px solid ${filterAction===t.k?"#60a5fa":"rgba(255,255,255,0.08)"}`,background:filterAction===t.k?"rgba(96,165,250,0.1)":"transparent",color:filterAction===t.k?"#60a5fa":"rgba(255,255,255,0.5)",cursor:"pointer"}}>{t.l}</button>)}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por código, usuario…" style={{flex:1,minWidth:200,padding:"5px 10px",fontSize:11,border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,background:"rgba(255,255,255,0.03)",color:"#fff",outline:"none"}}/>
    </div>

    {lo?<p style={{textAlign:"center",padding:"2rem 0",color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:filtered.length===0?<p style={{textAlign:"center",padding:"2rem 0",color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>Sin registros que coincidan con los filtros</p>:<div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:600,overflow:"auto"}}>
      {filtered.map(l=>{const ac=actionColors[l.action]||{bg:"rgba(255,255,255,0.05)",fg:"rgba(255,255,255,0.5)",label:l.action};const isExp=expandedId===l.id;const changeKeys=l.changes?Object.keys(l.changes):[];return <div key={l.id} style={{padding:"10px 12px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8}}>
        <div onClick={()=>setExpandedId(isExp?null:l.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,cursor:changeKeys.length>0?"pointer":"default",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",flex:1,minWidth:200}}>
            <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:4,background:ac.bg,color:ac.fg,letterSpacing:"0.04em"}}>{ac.label}</span>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>{entityLabels[l.entity_type]||l.entity_type}</span>
            {l.entity_code&&<span style={{fontSize:11,fontFamily:"monospace",fontWeight:700,color:"#fff"}}>{l.entity_code}</span>}
            <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>· por <strong style={{color:"rgba(255,255,255,0.65)"}}>{l.user_email||"sistema"}</strong></span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{new Date(l.created_at).toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
            {changeKeys.length>0&&<span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{isExp?"▾":"▸"} {changeKeys.length} {l.action==="UPDATE"?"cambio"+(changeKeys.length>1?"s":""):"campos"}</span>}
          </div>
        </div>
        {isExp&&changeKeys.length>0&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.18)",padding:"10px 12px",borderRadius:6}}>
          {changeKeys.map(k=>renderChange(k,l.changes[k]))}
        </div>}
      </div>;})}
      {filtered.length>=limit&&<button onClick={()=>setLimit(p=>p+100)} style={{padding:"8px",fontSize:11,fontWeight:600,borderRadius:6,border:"1px dashed rgba(255,255,255,0.15)",background:"transparent",color:"rgba(255,255,255,0.5)",cursor:"pointer",marginTop:6}}>Cargar 100 más…</button>}
    </div>}
  </Card>;
}

// Gestión de feriados China/USA (calendario preventivo para clientes)
function HolidaysCard({token}){
  const [holidays,setHolidays]=useState([]);
  const [lo,setLo]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({country:"china",name:"",start_date:"",end_date:"",description:"",alert_days_before:14});
  const [saving,setSaving]=useState(false);
  const load=async()=>{setLo(true);const r=await dq("holidays_calendar",{token,filters:"?select=*&order=start_date.asc"});setHolidays(Array.isArray(r)?r:[]);setLo(false);};
  useEffect(()=>{load();},[token]);
  const save=async()=>{
    if(!form.name||!form.start_date||!form.end_date){alert("Completá nombre y fechas");return;}
    setSaving(true);
    await dq("holidays_calendar",{method:"POST",token,body:{country:form.country,name:form.name,start_date:form.start_date,end_date:form.end_date,description:form.description||null,alert_days_before:Number(form.alert_days_before)||14}});
    setShowForm(false);setForm({country:"china",name:"",start_date:"",end_date:"",description:"",alert_days_before:14});
    setSaving(false);load();
  };
  const del=async(id)=>{if(!confirm("¿Eliminar este feriado?"))return;await dq("holidays_calendar",{method:"DELETE",token,filters:`?id=eq.${id}`});load();};
  const todayISO=new Date().toISOString().slice(0,10);
  const upcoming=holidays.filter(h=>h.end_date>=todayISO);
  const past=holidays.filter(h=>h.end_date<todayISO);
  return <Card title="🌍 Calendario de feriados (China / USA / España)" actions={<Btn small onClick={()=>setShowForm(true)}>+ Nuevo feriado</Btn>}>
    <p style={{fontSize:12,color:"rgba(255,255,255,0.6)",margin:"0 0 14px",lineHeight:1.5}}>Banner preventivo en el portal cliente. Le avisa al cliente sobre feriados próximos del país de origen para que planifique sus envíos. La alerta aparece N días antes según configures.</p>
    {showForm&&<div style={{padding:"14px 16px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.25)",borderRadius:10,marginBottom:14}}>
      <h4 style={{fontSize:12,fontWeight:700,color:"#60a5fa",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Nuevo feriado</h4>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <Sel label="País" value={form.country} onChange={v=>setForm(p=>({...p,country:v}))} options={[{value:"china",label:"🇨🇳 China"},{value:"usa",label:"🇺🇸 USA"},{value:"spain",label:"🇪🇸 España"}]} small/>
        <Inp label="Nombre" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Ej: Año Nuevo Chino" small/>
        <Inp label="Fecha inicio" type="date" value={form.start_date} onChange={v=>setForm(p=>({...p,start_date:v}))} small/>
        <Inp label="Fecha fin" type="date" value={form.end_date} onChange={v=>setForm(p=>({...p,end_date:v}))} small/>
        <Inp label="Avisar X días antes" type="number" value={form.alert_days_before} onChange={v=>setForm(p=>({...p,alert_days_before:v}))} small/>
      </div>
      <div style={{marginTop:8}}><Inp label="Descripción (opcional)" value={form.description} onChange={v=>setForm(p=>({...p,description:v}))} placeholder="Las fábricas no operan, planificar envíos..." small/></div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
        <Btn small variant="secondary" onClick={()=>setShowForm(false)}>Cancelar</Btn>
        <Btn small onClick={save} disabled={saving}>{saving?"Guardando...":"Guardar"}</Btn>
      </div>
    </div>}
    {lo?<p style={{color:"rgba(255,255,255,0.4)",margin:"1rem 0"}}>Cargando…</p>:<>
      {upcoming.length>0&&<>
        <p style={{fontSize:11,fontWeight:700,color:IC,margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Próximos / activos ({upcoming.length})</p>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18}}>
          {upcoming.map(h=>{const flag={china:"🇨🇳",usa:"🇺🇸",spain:"🇪🇸"}[h.country]||"🌍";return <div key={h.id} style={{padding:"10px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"0 0 3px"}}>{flag} {h.name}</p>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.55)",margin:0}}>{formatDate(h.start_date)} → {formatDate(h.end_date)} · alerta {h.alert_days_before}d antes</p>
            </div>
            <button onClick={()=>del(h.id)} style={{background:"transparent",border:"1px solid rgba(255,80,80,0.25)",color:"#ff6b6b",cursor:"pointer",fontSize:11,padding:"4px 10px",borderRadius:5,fontWeight:600}}>Eliminar</button>
          </div>;})}
        </div>
      </>}
      {past.length>0&&<details style={{marginTop:8}}>
        <summary style={{cursor:"pointer",fontSize:11,color:"rgba(255,255,255,0.4)",fontWeight:600,letterSpacing:"0.05em"}}>Pasados ({past.length}) ▸</summary>
        <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:8}}>
          {past.map(h=>{const flag={china:"🇨🇳",usa:"🇺🇸",spain:"🇪🇸"}[h.country]||"🌍";return <div key={h.id} style={{padding:"6px 10px",fontSize:11,color:"rgba(255,255,255,0.45)",display:"flex",justifyContent:"space-between"}}>
            <span>{flag} {h.name} · {formatDate(h.start_date)}</span>
            <button onClick={()=>del(h.id)} style={{background:"transparent",border:"none",color:"rgba(255,80,80,0.5)",cursor:"pointer",fontSize:10}}>×</button>
          </div>;})}
        </div>
      </details>}
    </>}
  </Card>;
}

function MarketingCampaignCard({token}){
  const [stats,setStats]=useState(null);
  const [testEmail,setTestEmail]=useState("");
  const [batchLimit,setBatchLimit]=useState("100");
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState(null); // {type:'ok'|'err', text}
  const [confirmSend,setConfirmSend]=useState(false);
  const loadStats=async()=>{
    try{
      const r=await fetch("/api/marketing/announce-purchase-notifs?stats=1",{headers:{Authorization:`Bearer ${token}`}});
      const j=await r.json();
      if(j.ok)setStats(j);
    }catch(e){}
  };
  useEffect(()=>{loadStats();},[token]);
  const sendTest=async()=>{
    if(!testEmail){setMsg({type:"err",text:"Ingresá un email"});return;}
    setBusy(true);setMsg(null);
    try{
      const r=await fetch("/api/marketing/announce-purchase-notifs",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({mode:"test",email:testEmail.trim()})});
      const j=await r.json();
      if(j.ok)setMsg({type:"ok",text:`✓ Test enviado a ${testEmail}`});
      else setMsg({type:"err",text:j.error||"Error"});
    }catch(e){setMsg({type:"err",text:e.message});}
    setBusy(false);
  };
  const sendBatch=async()=>{
    setBusy(true);setMsg(null);setConfirmSend(false);
    try{
      const limit=Math.min(100,Math.max(1,Number(batchLimit)||100));
      const r=await fetch("/api/marketing/announce-purchase-notifs",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({mode:"send",limit})});
      const j=await r.json();
      if(j.ok){
        setMsg({type:"ok",text:`✓ Batch enviado: ${j.sent} OK, ${j.failed} fallaron${j.errors?.length?` — ej: ${j.errors[0]?.error?.slice(0,80)}`:""}`});
        loadStats();
      }else{setMsg({type:"err",text:j.error||"Error"});}
    }catch(e){setMsg({type:"err",text:e.message});}
    setBusy(false);
  };
  return <Card title="📣 Campaña: Anuncio Compras en Camino">
    <p style={{fontSize:12,color:"rgba(255,255,255,0.6)",margin:"0 0 14px",lineHeight:1.5}}>Email marketing a clientes con email registrado, anunciando la nueva sección <strong style={{color:"#fff"}}>Compras en Camino</strong>. Resend free tier permite <strong style={{color:"#fff"}}>100 mails/día</strong> y 3.000/mes.</p>
    {stats&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:0,textTransform:"uppercase"}}>Con email</p>
        <p style={{fontSize:18,fontWeight:700,color:"#fff",margin:"3px 0 0"}}>{stats.total_with_email}</p>
      </div>
      <div style={{padding:"10px 12px",background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:8}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:0,textTransform:"uppercase"}}>Pendientes</p>
        <p style={{fontSize:18,fontWeight:700,color:"#fbbf24",margin:"3px 0 0"}}>{stats.pending}</p>
      </div>
      <div style={{padding:"10px 12px",background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:8}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:0,textTransform:"uppercase"}}>Enviados</p>
        <p style={{fontSize:18,fontWeight:700,color:"#22c55e",margin:"3px 0 0"}}>{stats.sent}</p>
      </div>
      <div style={{padding:"10px 12px",background:"rgba(255,80,80,0.05)",border:"1px solid rgba(255,80,80,0.18)",borderRadius:8}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:0,textTransform:"uppercase"}}>Opt-out</p>
        <p style={{fontSize:18,fontWeight:700,color:"#ff6b6b",margin:"3px 0 0"}}>{stats.opted_out}</p>
      </div>
    </div>}
    <div style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap",marginBottom:14}}>
      <a href="/api/marketing/announce-purchase-notifs?preview=1" target="_blank" rel="noopener" style={{padding:"8px 14px",fontSize:12,fontWeight:600,borderRadius:7,border:"1px solid rgba(96,165,250,0.4)",background:"rgba(96,165,250,0.08)",color:"#60a5fa",textDecoration:"none"}}>👁 Ver preview en navegador</a>
    </div>
    <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,marginBottom:12}}>
      <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.05em"}}>1. Probá primero con tu email</p>
      <div style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:220}}><Inp label="Tu email" value={testEmail} onChange={setTestEmail} placeholder="bautista@argencargo.com.ar" small/></div>
        <Btn small variant="secondary" onClick={sendTest} disabled={busy||!testEmail}>{busy?"Enviando…":"Enviar test"}</Btn>
      </div>
    </div>
    <div style={{padding:"12px 14px",background:"rgba(184,149,106,0.05)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:10}}>
      <p style={{fontSize:11,fontWeight:700,color:IC,margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.05em"}}>2. Enviar batch a clientes pendientes</p>
      <div style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap"}}>
        <div style={{width:130}}><Inp label="Batch size (max 100)" type="number" value={batchLimit} onChange={setBatchLimit} small/></div>
        <Btn small onClick={()=>setConfirmSend(true)} disabled={busy||!stats||stats.pending===0}>{busy?"Enviando…":`Enviar a ${Math.min(Number(batchLimit)||100,stats?.pending||0)} clientes`}</Btn>
      </div>
      <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"8px 0 0",fontStyle:"italic"}}>Si tenés más de 100 pendientes, ejecutá el batch hoy y otro mañana (free tier de Resend = 100/día).</p>
    </div>
    {msg&&<p style={{fontSize:12,color:msg.type==="ok"?"#22c55e":"#ff6b6b",margin:"12px 0 0",padding:"8px 12px",background:msg.type==="ok"?"rgba(34,197,94,0.08)":"rgba(255,80,80,0.08)",borderRadius:6}}>{msg.text}</p>}

    {confirmSend&&<div onClick={()=>!busy&&setConfirmSend(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1.5px solid rgba(184,149,106,0.4)",borderRadius:14,padding:"22px 24px",maxWidth:440,width:"100%"}}>
        <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 12px"}}>¿Confirmar envío?</h3>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.7)",margin:"0 0 16px",lineHeight:1.5}}>Vas a enviar el email a <strong style={{color:IC}}>{Math.min(Number(batchLimit)||100,stats?.pending||0)} clientes</strong>. Esta acción no se puede deshacer.</p>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>setConfirmSend(false)} disabled={busy} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer"}}>Cancelar</button>
          <button onClick={sendBatch} disabled={busy} style={{padding:"9px 18px",fontSize:13,fontWeight:700,borderRadius:8,border:`1px solid ${IC}`,background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer"}}>{busy?"Enviando…":"Sí, enviar"}</button>
        </div>
      </div>
    </div>}
  </Card>;
}

function AdminSettings({token,session}){
  const [curPw,setCurPw]=useState("");const [newPw,setNewPw]=useState("");const [confPw,setConfPw]=useState("");const [msg,setMsg]=useState("");const [err,setErr]=useState("");const [lo,setLo]=useState(false);
  // Retención de fotos
  const [photoDays,setPhotoDays]=useState("");const [photoMsg,setPhotoMsg]=useState("");const [photoSaving,setPhotoSaving]=useState(false);const [cleanupMsg,setCleanupMsg]=useState("");
  useEffect(()=>{(async()=>{const r=await dq("calc_config",{token,filters:"?key=eq.photo_retention_days&select=value"});if(Array.isArray(r)&&r[0])setPhotoDays(String(r[0].value));else setPhotoDays("90");})();},[token]);
  const savePhotoDays=async()=>{const n=parseInt(photoDays);if(isNaN(n)||n<7||n>3650){setPhotoMsg("Ingresá un número entre 7 y 3650 días");return;}setPhotoSaving(true);setPhotoMsg("");
    const exists=await dq("calc_config",{token,filters:"?key=eq.photo_retention_days&select=key"});
    if(Array.isArray(exists)&&exists.length>0){await dq("calc_config",{method:"PATCH",token,filters:"?key=eq.photo_retention_days",body:{value:String(n)}});}
    else{await dq("calc_config",{method:"POST",token,body:{key:"photo_retention_days",value:String(n)}});}
    setPhotoMsg("✅ Guardado");setPhotoSaving(false);setTimeout(()=>setPhotoMsg(""),3000);};
  const runCleanupNow=async()=>{if(!confirm("¿Ejecutar la limpieza ahora? Borra las fotos de bultos de operaciones cerradas hace más del período configurado."))return;setCleanupMsg("Ejecutando...");
    try{const r=await fetch("/api/cleanup/photos");const j=await r.json();if(j.ok){setCleanupMsg(`✅ ${j.deleted} fotos borradas (${j.ops_checked} ops revisadas, retención ${j.retention_days} días)${j.sample_ops?.length?` — ej: ${j.sample_ops.join(", ")}`:""}`);}else{setCleanupMsg(`❌ ${j.error}`);}}catch(e){setCleanupMsg("❌ "+e.message);}};
  const changePw=async()=>{if(!curPw||!newPw){setErr("Completá todos los campos");return;}if(newPw.length<6){setErr("La nueva contraseña debe tener al menos 6 caracteres");return;}if(newPw!==confPw){setErr("Las contraseñas no coinciden");return;}
    setLo(true);setErr("");setMsg("");
    // Verify current password by re-logging
    const check=await sf("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:session.user.email,password:curPw})});
    if(check?.error){setErr("Contraseña actual incorrecta");setLo(false);return;}
    // Update password
    const r=await sf("/auth/v1/user",{method:"PUT",body:JSON.stringify({password:newPw}),headers:{Authorization:`Bearer ${token}`}});
    if(r?.error){setErr(r.error.message||"Error al cambiar contraseña");setLo(false);return;}
    setMsg("Contraseña cambiada exitosamente");setCurPw("");setNewPw("");setConfPw("");setLo(false);};
  return <div><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 20px"}}>Configuración</h2>
    <Card title="Cambiar contraseña">
      <div style={{maxWidth:400}}>
        <Inp label="Contraseña actual" type="password" value={curPw} onChange={setCurPw} placeholder="••••••••"/>
        <Inp label="Nueva contraseña" type="password" value={newPw} onChange={setNewPw} placeholder="Mínimo 6 caracteres"/>
        <Inp label="Confirmar nueva contraseña" type="password" value={confPw} onChange={setConfPw} placeholder="Repetí la nueva contraseña"/>
        {err&&<p style={{fontSize:12,color:"#ff6b6b",margin:"0 0 12px",padding:"8px 12px",background:"rgba(255,80,80,0.1)",borderRadius:8}}>{err}</p>}
        {msg&&<p style={{fontSize:12,color:"#22c55e",margin:"0 0 12px",padding:"8px 12px",background:"rgba(34,197,94,0.1)",borderRadius:8}}>{msg}</p>}
        <Btn onClick={changePw} disabled={lo}>{lo?"Cambiando...":"Cambiar contraseña"}</Btn>
      </div>
    </Card>
    <Card title="Información de la cuenta">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>EMAIL</p><p style={{fontSize:14,color:"#fff",margin:0}}>{session.user.email}</p></div>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px"}}>ROL</p><p style={{fontSize:14,color:IC,margin:0,fontWeight:600}}>Administrador</p></div>
      </div>
    </Card>
    <HolidaysCard token={token}/>
    <MarketingCampaignCard token={token}/>
    <AuditLogCard token={token}/>
    <Card title="Retención de fotos de bultos">
      <p style={{fontSize:12,color:"rgba(255,255,255,0.6)",margin:"0 0 14px",lineHeight:1.5}}>Las fotos cargadas por los agentes ocupan espacio en Storage. Se borran automáticamente <strong style={{color:"#fff"}}>N días después</strong> de cerrarse la operación. La limpieza corre todos los días a las 3am.</p>
      <div style={{display:"flex",gap:10,alignItems:"end",flexWrap:"wrap",maxWidth:520}}>
        <div style={{flex:1,minWidth:180}}><Inp label="Días después del cierre de op" type="number" value={photoDays} onChange={setPhotoDays} small/></div>
        <Btn small onClick={savePhotoDays} disabled={photoSaving}>{photoSaving?"Guardando...":"Guardar"}</Btn>
        <Btn small variant="secondary" onClick={runCleanupNow}>▶ Ejecutar ahora</Btn>
      </div>
      {photoMsg&&<p style={{fontSize:11,color:photoMsg.startsWith("✅")?"#22c55e":"#ff6b6b",margin:"8px 0 0"}}>{photoMsg}</p>}
      {cleanupMsg&&<p style={{fontSize:11,color:cleanupMsg.startsWith("✅")?"#22c55e":cleanupMsg.startsWith("❌")?"#ff6b6b":"rgba(255,255,255,0.6)",margin:"8px 0 0"}}>{cleanupMsg}</p>}
      <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",margin:"10px 0 0",fontStyle:"italic"}}>Sugerencia: 90 días. Mínimo recomendado 30, máximo razonable 365.</p>
    </Card>
  </div>;
}

const FIXED_CATS=[{k:"marketing",l:"Marketing (Meta, Google, etc.)"},{k:"software",l:"Software (Claude, Vercel, etc.)"},{k:"salarios",l:"Salarios"},{k:"oficina",l:"Oficina"},{k:"comisiones",l:"Comisiones (PayPal, spread cambio)"},{k:"otros",l:"Otros (requiere detalle)"}];
const CAT_LBL={marketing:"Marketing",software:"Software",salarios:"Salarios",oficina:"Oficina",comisiones:"Comisiones",otros:"Otros"};
const CAT_COLOR={marketing:"#fb923c",software:"#a78bfa",salarios:"#22c55e",oficina:"#60a5fa",comisiones:"#fbbf24",otros:"#94a3b8"};
function FinancePanel({token}){
  const [entries,setEntries]=useState([]);const [lo,setLo]=useState(true);const [tab,setTab]=useState("fixed");const [showAdd,setShowAdd]=useState(false);const [msg,setMsg]=useState("");
  const [newEntry,setNewEntry]=useState({date:new Date().toISOString().slice(0,10),category:"software",detail:"",amount:"",amount_ars:"",exchange_rate:"",currency:"USD",payment_method:"transferencia",card_closing_date:""});
  const [allOps,setAllOps]=useState([]);const [allPmts,setAllPmts]=useState([]);
  const [dollarPending,setDollarPending]=useState([]);const [dollarRates,setDollarRates]=useState({});
  const [cardDebt,setCardDebt]=useState({usd:[],ars:[],pmts:[]});
  const [agentMvs,setAgentMvs]=useState([]);const [agentSignups,setAgentSignups]=useState([]);
  const [supplierPmts,setSupplierPmts]=useState([]);
  const [clientPmts,setClientPmts]=useState([]);
  const load=async()=>{const [e,o,pm,dp,am,ag,sp,cp,cdUsd,cdArs,cdPmts,supTcArs,supTcUsd]=await Promise.all([
    dq("finance_entries",{token,filters:"?select=*&auto_generated=is.false&order=date.desc,created_at.desc"}),
    dq("operations",{token,filters:"?select=id,operation_code,description,budget_total,is_collected,collection_date,collected_amount,collection_currency,collection_exchange_rate,closed_at,cost_flete,cost_flete_method,cost_impuestos_reales,cost_gasto_documental,cost_seguro,cost_flete_local,cost_otros,service_type,cost_producto_usd,cost_producto_method,cost_producto_paid,cost_producto_paid_at,clients(first_name,last_name,client_code)&order=created_at.desc"}),
    dq("payment_management",{token,filters:"?select=*,operations(operation_code)"}),
    dq("finance_entries",{token,filters:"?select=*&currency=eq.ARS&exchange_rate=is.null&auto_generated=eq.true&order=card_closing_date.asc"}),
    dq("agent_account_movements",{token,filters:"?select=*&order=date.desc"}),
    dq("agent_signups",{token,filters:"?select=auth_user_id,first_name,last_name"}),
    dq("operation_supplier_payments",{token,filters:"?select=*&order=payment_date.asc"}),
    dq("operation_client_payments",{token,filters:"?select=*&order=payment_date.asc"}),
    // Deuda tarjeta USD: finance_entries USD pendientes
    dq("finance_entries",{token,filters:"?select=*,operations(operation_code)&payment_method=eq.tarjeta_credito&is_paid=eq.false&currency=eq.USD&order=card_closing_date.asc"}),
    // Deuda tarjeta ARS: finance_entries ARS pendientes (mostrar resumen, detalle en Dollarización)
    dq("finance_entries",{token,filters:"?select=*,operations(operation_code)&payment_method=eq.tarjeta_credito&is_paid=eq.false&currency=eq.ARS&order=card_closing_date.asc"}),
    // Giros al exterior con TC pendientes (payment_management)
    dq("payment_management",{token,filters:"?select=*,operations(operation_code)&giro_payment_method=eq.tarjeta_credito&giro_tarjeta_paid=eq.false&order=giro_tarjeta_due_date.asc"}),
    // Costos GI con TC + ARS pendientes (dolarización) — NO incluir refunds (no son deuda)
    dq("operation_supplier_payments",{token,filters:"?select=*,operations(operation_code)&payment_method=eq.tarjeta_credito&is_paid=eq.false&currency=eq.ARS&type=neq.refund&order=card_closing_date.asc"}),
    // Costos GI con TC + USD pendientes (deuda tarjeta USD) — NO incluir refunds
    dq("operation_supplier_payments",{token,filters:"?select=*,operations(operation_code)&payment_method=eq.tarjeta_credito&is_paid=eq.false&or=(currency.eq.USD,currency.is.null)&type=neq.refund&order=card_closing_date.asc"})
  ]);setEntries(Array.isArray(e)?e:[]);setAllOps(Array.isArray(o)?o:[]);setAllPmts(Array.isArray(pm)?pm:[]);setDollarPending(Array.isArray(dp)?dp:[]);setAgentMvs(Array.isArray(am)?am:[]);setAgentSignups(Array.isArray(ag)?ag:[]);setSupplierPmts(Array.isArray(sp)?sp:[]);setClientPmts(Array.isArray(cp)?cp:[]);setCardDebt({usd:Array.isArray(cdUsd)?cdUsd:[],ars:Array.isArray(cdArs)?cdArs:[],pmts:Array.isArray(cdPmts)?cdPmts:[],supTcArs:Array.isArray(supTcArs)?supTcArs:[],supTcUsd:Array.isArray(supTcUsd)?supTcUsd:[]});setLo(false);};
  useEffect(()=>{load();},[token]);
  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),2500);const v=/^[❌✕]|falló|error/i.test(m)?"error":/^⚠/.test(m)?"warn":"success";toast(m.replace(/^[✓✉️❌⚠️✕★📧⭐]\s*/u,""),v);};
  const addEntry=async()=>{
    if(!newEntry.category){flash("Faltan datos");return;}
    if(newEntry.category==="otros"&&!newEntry.detail){flash("Categoría 'Otros' requiere detalle");return;}
    const isTC=newEntry.payment_method==="tarjeta_credito";
    if(isTC&&!newEntry.card_closing_date){flash("Falta fecha de cierre de tarjeta");return;}
    const isARS=newEntry.currency==="ARS";
    if(isARS&&!newEntry.amount_ars){flash("Falta monto ARS");return;}
    if(!isARS&&!newEntry.amount){flash("Falta monto USD");return;}
    // ARS + no TC → necesita tipo de cambio para dollarizar ya
    if(isARS&&!isTC&&!newEntry.exchange_rate){flash("Falta tipo de cambio");return;}
    let body={date:newEntry.date,type:"gasto",description:CAT_LBL[newEntry.category]+(newEntry.detail?` — ${newEntry.detail}`:""),detail:newEntry.detail||null,category:newEntry.category,payment_method:newEntry.payment_method,is_paid:!isTC,card_closing_date:isTC?newEntry.card_closing_date:null,auto_generated:false};
    if(isARS){
      const ars=Number(newEntry.amount_ars);
      if(isTC){
        // TC + ARS: pendiente de débito, se dollariza cuando se marca pagado
        body={...body,amount:0,amount_ars:ars,currency:"ARS",exchange_rate:null};
      } else {
        // Efectivo/transferencia + ARS: dollarizar ya al TC provisto
        const rate=Number(newEntry.exchange_rate);
        const usd=Math.round((ars/rate)*100)/100;
        body={...body,amount:usd,amount_ars:ars,exchange_rate:rate,currency:"USD",dollarized_at:new Date().toISOString()};
      }
    } else {
      // USD puro
      body={...body,amount:Number(newEntry.amount),currency:"USD"};
    }
    const r=await dq("finance_entries",{method:"POST",token,body});
    if(r?.id||Array.isArray(r)){load();setShowAdd(false);setNewEntry({date:new Date().toISOString().slice(0,10),category:"software",detail:"",amount:"",amount_ars:"",exchange_rate:"",currency:"USD",payment_method:"transferencia",card_closing_date:""});flash("Gasto agregado");}
  };
  const delEntry=async(id)=>{if(!confirm("¿Eliminar este movimiento?"))return;await dq("finance_entries",{method:"DELETE",token,filters:`?id=eq.${id}`});setEntries(p=>p.filter(e=>e.id!==id));flash("Eliminado");};
  const usd=v=>`USD ${Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  // Totales costos fijos
  const totalFijos=entries.reduce((s,e)=>s+Number(e.amount||0),0);
  const fijosByCategory=entries.reduce((m,e)=>{const k=e.category||"otros";m[k]=(m[k]||0)+Number(e.amount||0);return m;},{});
  // Libro diario unificado: ops cobradas + pmts client_paid (ingresos), costos op + giros confirmados (gastos), entries manuales (gastos fijos)
  const ledger=[];
  // IDs de ops que tienen pagos parciales del cliente (para NO duplicar con is_collected legacy)
  const opsWithClientPmts=new Set(clientPmts.map(p=>p.operation_id));
  allOps.forEach(o=>{
    // Si la op tiene pagos parciales, los agregamos más abajo (evita duplicar)
    if(o.is_collected&&!opsWithClientPmts.has(o.id)){const amt=Number(o.collected_amount||o.budget_total||0);const isArs=o.collection_currency==="ARS";const rate=Number(o.collection_exchange_rate||0);const usdAmt=isArs&&rate?amt/rate:amt;if(usdAmt>0)ledger.push({date:o.collection_date||o.closed_at?.slice(0,10)||"—",type:"ingreso",origen:"op",code:o.operation_code,desc:`Cobro ${o.operation_code} — ${o.clients?.client_code||""}`,amount:usdAmt,detail:isArs?`ARS ${amt.toLocaleString("es-AR")} @ ${rate}`:""});}
    // Cost_flete via cuenta_corriente: NO se incluye en libro diario (la salida de cash ya está en el anticipo al agente)
    const fleteMethod=o.cost_flete_method||"cuenta_corriente";
    const fleteForLedger=fleteMethod==="cuenta_corriente"?0:Number(o.cost_flete||0);
    const cost=fleteForLedger+Number(o.cost_impuestos_reales||0)+Number(o.cost_gasto_documental||0)+Number(o.cost_seguro||0)+Number(o.cost_flete_local||0)+Number(o.cost_otros||0);
    if(cost>0)ledger.push({date:o.closed_at?.slice(0,10)||"—",type:"gasto",origen:"op",code:o.operation_code,desc:`Costos ${o.operation_code} — ${o.clients?.client_code||""}`,amount:cost,detail:fleteMethod==="cuenta_corriente"&&Number(o.cost_flete||0)>0?`(flete CC ${usd(Number(o.cost_flete))} ya cubierto por anticipo)`:""});
  });
  // Gestión Integral: cada pago parcial al proveedor aparece en su fecha (no en closed_at)
  supplierPmts.filter(p=>p.is_paid).forEach(p=>{
    const op=allOps.find(o=>o.id===p.operation_id);
    const code=op?.operation_code||"";
    const cc=op?.clients?.client_code||"";
    const isRefund=p.type==="refund";
    ledger.push({
      date:p.payment_date,
      type:isRefund?"ingreso":"gasto",
      origen:"supplier_pmt",
      code,
      desc:isRefund?`↩ Reembolso ${code} — ${cc}`:`Pago producto ${code} — ${cc}`,
      amount:Number(p.amount_usd||0),
      detail:p.notes||(isRefund?"Reembolso del proveedor (Gestión Integral)":"Pago al proveedor (Gestión Integral)")
    });
  });
  // Pagos parciales del cliente (anticipos) → cada uno es un ingreso en su fecha
  clientPmts.forEach(p=>{
    const op=allOps.find(o=>o.id===p.operation_id);
    const code=op?.operation_code||"";
    const cc=op?.clients?.client_code||"";
    const arsDetail=p.currency==="ARS"&&p.amount_ars?`ARS ${Number(p.amount_ars).toLocaleString("es-AR")} @ ${p.exchange_rate}`:"";
    ledger.push({date:p.payment_date,type:"ingreso",origen:"client_pmt",code,desc:`Anticipo ${code} — ${cc}`,amount:Number(p.amount_usd||0),detail:p.notes?`${p.notes}${arsDetail?` · ${arsDetail}`:""}`:arsDetail});
  });
  allPmts.forEach(p=>{
    const code=p.operations?.operation_code||"";
    const op=allOps.find(o=>o.id===p.operation_id);
    const cc=op?.clients?.client_code||"";
    if(p.client_paid)ledger.push({date:p.client_paid_date||"—",type:"ingreso",origen:"pmt",code,desc:`Pago ${code} — ${cc}`,amount:Number(p.client_paid_amount_usd??p.client_amount_usd??0),detail:p.description||""});
    const tarjetaPendiente=p.giro_payment_method==="tarjeta_credito"&&!p.giro_tarjeta_paid;
    // Comisión de giro: SIEMPRE se cuenta como gasto de contado (no depende del método del giro).
    // Representa el costo financiero que se paga al recibir la transferencia del cliente.
    if(p.giro_status==="confirmado"&&Number(p.cost_comision_giro||0)>0){ledger.push({date:p.giro_date||p.client_paid_date||"—",type:"gasto",origen:"pmt",code,desc:`Comisión financiera ${code} — ${cc}`,amount:Number(p.cost_comision_giro),detail:"Costo por recibir la transferencia"});}
    // Giro al exterior: sólo aparece cuando el giro se pagó realmente (o tarjeta debitada).
    if(p.giro_status==="confirmado"&&!tarjetaPendiente&&Number(p.giro_amount_usd||0)>0){ledger.push({date:(p.giro_tarjeta_paid_at?p.giro_tarjeta_paid_at.slice(0,10):p.giro_date)||"—",type:"gasto",origen:"pmt",code,desc:`Giro exterior ${code} — ${cc}`,amount:Number(p.giro_amount_usd),detail:p.description||""});}
  });
  entries.forEach(e=>{
    // Gastos con tarjeta: solo aparecen cuando is_paid=true
    const tarjetaPendiente=e.payment_method==="tarjeta_credito"&&!e.is_paid;
    if(tarjetaPendiente)return;
    ledger.push({date:e.date,type:e.type,origen:"manual",code:"",desc:e.description,amount:Number(e.amount||0),detail:e.detail||"",cat:e.category,recurring:e.is_recurring,id:e.id});
  });
  agentMvs.filter(m=>m.type==="anticipo").forEach(m=>{const ag=agentSignups.find(a=>a.auth_user_id===m.agent_id);const agName=ag?`${ag.first_name} ${ag.last_name}`:"agente";const recv=Number(m.amount_received_usd||m.amount_usd);ledger.push({date:m.date,type:"gasto",origen:"agente",code:"",desc:`Anticipo a ${agName}`,amount:Number(m.amount_usd||0),detail:m.amount_received_usd&&recv!==Number(m.amount_usd)?`Recibió ${usd(recv)}, comisión ${usd(Number(m.amount_usd)-recv)}`:(m.description||"")});});
  ledger.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const ledgerIngresos=ledger.filter(l=>l.type==="ingreso").reduce((s,l)=>s+l.amount,0);
  const ledgerGastosOp=ledger.filter(l=>l.type==="gasto"&&l.origen!=="manual").reduce((s,l)=>s+l.amount,0);
  const ledgerGastosFijos=ledger.filter(l=>l.type==="gasto"&&l.origen==="manual").reduce((s,l)=>s+l.amount,0);
  const ganancia=ledgerIngresos-ledgerGastosOp-ledgerGastosFijos;
  // Genera PDF de cierre de mes (mes anterior por defecto)
  const generateMonthClosingPDF=(monthOffset=-1)=>{
    const now=new Date();const target=new Date(now.getFullYear(),now.getMonth()+monthOffset,1);
    const year=target.getFullYear(),month=target.getMonth();
    const monthStart=new Date(year,month,1).toISOString().slice(0,10);
    const monthEnd=new Date(year,month+1,0).toISOString().slice(0,10);
    const inMonth=(d)=>d&&d>=monthStart&&d<=monthEnd;
    const monthLedger=ledger.filter(l=>inMonth(l.date));
    const ingresos=monthLedger.filter(l=>l.type==="ingreso");
    const gastosOp=monthLedger.filter(l=>l.type==="gasto"&&l.origen!=="manual");
    const gastosFijos=monthLedger.filter(l=>l.type==="gasto"&&l.origen==="manual");
    const totIng=ingresos.reduce((s,l)=>s+l.amount,0);
    const totGOp=gastosOp.reduce((s,l)=>s+l.amount,0);
    const totGF=gastosFijos.reduce((s,l)=>s+l.amount,0);
    const ganancia=totIng-totGOp-totGF;
    const fmt=(v)=>`USD ${Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const monthName=target.toLocaleDateString("es-AR",{month:"long",year:"numeric"});
    // Comparativa mes anterior
    const prevTarget=new Date(year,month-1,1);
    const prevStart=new Date(prevTarget.getFullYear(),prevTarget.getMonth(),1).toISOString().slice(0,10);
    const prevEnd=new Date(prevTarget.getFullYear(),prevTarget.getMonth()+1,0).toISOString().slice(0,10);
    const prevInMonth=(d)=>d&&d>=prevStart&&d<=prevEnd;
    const prevIng=ledger.filter(l=>prevInMonth(l.date)&&l.type==="ingreso").reduce((s,l)=>s+l.amount,0);
    const prevGanancia=prevIng-ledger.filter(l=>prevInMonth(l.date)&&l.type==="gasto"&&l.origen!=="manual").reduce((s,l)=>s+l.amount,0)-ledger.filter(l=>prevInMonth(l.date)&&l.type==="gasto"&&l.origen==="manual").reduce((s,l)=>s+l.amount,0);
    const deltaPct=prevIng>0?((totIng-prevIng)/prevIng*100).toFixed(1):"—";
    const deltaGan=prevGanancia!==0?((ganancia-prevGanancia)/Math.abs(prevGanancia)*100).toFixed(1):"—";
    // Top clientes
    const byClient={};ingresos.forEach(l=>{const k=l.cliente||"—";if(!byClient[k])byClient[k]={ops:0,total:0};byClient[k].ops++;byClient[k].total+=l.amount;});
    const topClientes=Object.entries(byClient).sort((a,b)=>b[1].total-a[1].total).slice(0,5);
    // Por canal
    const byChannel={};ingresos.forEach(l=>{const k=l.canal||"—";if(!byChannel[k])byChannel[k]={ops:0,total:0};byChannel[k].ops++;byChannel[k].total+=l.amount;});
    const w=window.open("","_blank");if(!w)return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cierre ${monthName}</title><style>
      *{box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;padding:32px;color:#1a1f2e;max-width:900px;margin:0 auto;background:#fff}
      h1{font-size:22px;color:#1f4e8a;margin:0 0 4px;border-bottom:2px solid #1f4e8a;padding-bottom:8px}
      .sub{color:#64748b;font-size:12px;margin:6px 0 24px}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
      .kpi{padding:14px 16px;border-radius:8px;border:1px solid #e2e8f0}
      .kpi .l{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 6px}
      .kpi .v{font-size:18px;font-weight:800;margin:0}
      .kpi.in{background:#f0fdf4;border-color:#86efac}.kpi.in .v{color:#15803d}
      .kpi.op{background:#fef2f2;border-color:#fecaca}.kpi.op .v{color:#b91c1c}
      .kpi.fx{background:#fff7ed;border-color:#fed7aa}.kpi.fx .v{color:#c2410c}
      .kpi.gn{background:${ganancia>=0?"#f0fdf4":"#fef2f2"};border-color:${ganancia>=0?"#86efac":"#fecaca"}}.kpi.gn .v{color:${ganancia>=0?"#15803d":"#b91c1c"}}
      h2{font-size:14px;color:#1f4e8a;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
      th{text-align:left;padding:8px 10px;background:#f1f5f9;color:#475569;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1.5px solid #1f4e8a}
      td{padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#1e293b}
      .r{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
      .delta{font-size:10px;color:#64748b;margin-left:6px}
      .delta.pos{color:#15803d}.delta.neg{color:#b91c1c}
      .footer{margin-top:32px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;text-align:center}
      @media print{body{padding:20px}}
    </style></head><body>
      <h1>Cierre Financiero — ${monthName}</h1>
      <p class="sub">Argencargo · Generado ${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}</p>
      <div class="kpis">
        <div class="kpi in"><p class="l">Ingresos</p><p class="v">${fmt(totIng)}</p>${deltaPct!=="—"?`<span class="delta ${Number(deltaPct)>=0?"pos":"neg"}">${Number(deltaPct)>=0?"▲":"▼"} ${Math.abs(Number(deltaPct))}% vs mes ant.</span>`:""}</div>
        <div class="kpi op"><p class="l">Costos Ops</p><p class="v">${fmt(totGOp)}</p></div>
        <div class="kpi fx"><p class="l">Gastos Negocio</p><p class="v">${fmt(totGF)}</p></div>
        <div class="kpi gn"><p class="l">Ganancia Neta</p><p class="v">${fmt(ganancia)}</p>${deltaGan!=="—"?`<span class="delta ${Number(deltaGan)>=0?"pos":"neg"}">${Number(deltaGan)>=0?"▲":"▼"} ${Math.abs(Number(deltaGan))}%</span>`:""}</div>
      </div>
      <h2>Top 5 clientes (por ingreso)</h2>
      <table><thead><tr><th>Cliente</th><th class="r">Ops</th><th class="r">Total</th><th class="r">% del mes</th></tr></thead><tbody>
        ${topClientes.map(([n,d])=>`<tr><td>${n}</td><td class="r">${d.ops}</td><td class="r">${fmt(d.total)}</td><td class="r">${totIng>0?(d.total/totIng*100).toFixed(1):"0"}%</td></tr>`).join("")||'<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px">Sin ingresos en el mes</td></tr>'}
      </tbody></table>
      <h2>Distribución por canal</h2>
      <table><thead><tr><th>Canal</th><th class="r">Ops</th><th class="r">Ingreso</th><th class="r">% del mes</th></tr></thead><tbody>
        ${Object.entries(byChannel).map(([n,d])=>`<tr><td>${n}</td><td class="r">${d.ops}</td><td class="r">${fmt(d.total)}</td><td class="r">${totIng>0?(d.total/totIng*100).toFixed(1):"0"}%</td></tr>`).join("")||'<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px">—</td></tr>'}
      </tbody></table>
      <h2>Detalle de Gastos del Negocio (${gastosFijos.length})</h2>
      <table><thead><tr><th>Fecha</th><th>Detalle</th><th class="r">Importe</th></tr></thead><tbody>
        ${gastosFijos.slice(0,30).map(l=>`<tr><td>${l.date||"—"}</td><td>${l.detalle||l.cliente||"—"}</td><td class="r">${fmt(l.amount)}</td></tr>`).join("")||'<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:20px">Sin gastos fijos</td></tr>'}
      </tbody></table>
      <div class="footer">Argencargo · www.argencargo.com.ar · Reporte interno — confidencial</div>
      <script>setTimeout(()=>window.print(),300)</script>
    </body></html>`);w.document.close();
  };
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:10,flexWrap:"wrap"}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>Finanzas</h2>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn small variant="secondary" onClick={()=>generateMonthClosingPDF(-1)}>📊 Cierre mes anterior</Btn>
        <Btn small variant="secondary" onClick={()=>generateMonthClosingPDF(0)}>📊 Cierre mes actual</Btn>
        {tab==="fixed"&&<Btn onClick={()=>setShowAdd(true)} small>+ Nuevo gasto</Btn>}
      </div>
    </div>
    {msg&&<p style={{fontSize:12,color:"#22c55e",fontWeight:600,marginBottom:12}}>{msg}</p>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16,marginBottom:20}}>
      <div style={{background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.12)",borderRadius:12,padding:"16px 20px"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px"}}>INGRESOS</p><p style={{fontSize:20,fontWeight:700,color:"#22c55e",margin:0}}>{usd(ledgerIngresos)}</p></div>
      <div style={{background:"rgba(255,80,80,0.04)",border:"1px solid rgba(255,80,80,0.12)",borderRadius:12,padding:"16px 20px"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px"}}>COSTOS OPS</p><p style={{fontSize:20,fontWeight:700,color:"#ff6b6b",margin:0}}>{usd(ledgerGastosOp)}</p></div>
      <div style={{background:"rgba(251,146,60,0.04)",border:"1px solid rgba(251,146,60,0.15)",borderRadius:12,padding:"16px 20px"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px"}}>GASTOS NEGOCIO</p><p style={{fontSize:20,fontWeight:700,color:"#fb923c",margin:0}}>{usd(ledgerGastosFijos)}</p></div>
      <div style={{background:ganancia>=0?"rgba(34,197,94,0.06)":"rgba(255,80,80,0.06)",border:`1px solid ${ganancia>=0?"rgba(34,197,94,0.18)":"rgba(255,80,80,0.18)"}`,borderRadius:12,padding:"16px 20px"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px"}}>GANANCIA NETA</p><p style={{fontSize:20,fontWeight:700,color:ganancia>=0?"#22c55e":"#ff6b6b",margin:0}}>{usd(ganancia)}</p></div>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>{[{k:"fixed",l:"Gastos del Negocio"},{k:"ledger",l:"Libro Diario"},{k:"dollar",l:"Dollarización"},{k:"tcdebt",l:(()=>{const c=cardDebt.usd.length+cardDebt.pmts.length;return c>0?`Deuda Tarjeta (${c})`:"Deuda Tarjeta";})()}].map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"6px 14px",fontSize:11,fontWeight:700,borderRadius:8,border:tab===t.k?`1.5px solid ${IC}`:"1.5px solid rgba(255,255,255,0.08)",background:tab===t.k?"rgba(184,149,106,0.12)":"rgba(255,255,255,0.028)",color:tab===t.k?IC:"rgba(255,255,255,0.4)",cursor:"pointer"}}>{t.l}</button>)}</div>
    {showAdd&&tab==="fixed"&&<Card title="Nuevo gasto">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}>
        <Inp label="Fecha" type="date" value={newEntry.date} onChange={v=>setNewEntry(p=>({...p,date:v}))}/>
        <Sel label="Categoría" value={newEntry.category} onChange={v=>setNewEntry(p=>({...p,category:v}))} options={FIXED_CATS.map(c=>({value:c.k,label:c.l}))}/>
        <Sel label="Método" value={newEntry.payment_method} onChange={v=>setNewEntry(p=>({...p,payment_method:v}))} options={[{value:"transferencia",label:"Transferencia"},{value:"tarjeta_credito",label:"Tarjeta Crédito"},{value:"tarjeta_debito",label:"Tarjeta Débito"},{value:"efectivo",label:"Efectivo"}]}/>
      </div>
      {/* Selector de moneda USD/ARS */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>{[{k:"USD",l:"USD"},{k:"ARS",l:"ARS ($)"}].map(c=><button key={c.k} onClick={()=>setNewEntry(p=>({...p,currency:c.k}))} style={{flex:1,padding:"10px",fontSize:12,fontWeight:700,borderRadius:8,border:newEntry.currency===c.k?`1.5px solid ${IC}`:"1.5px solid rgba(255,255,255,0.08)",background:newEntry.currency===c.k?"rgba(184,149,106,0.12)":"rgba(255,255,255,0.028)",color:newEntry.currency===c.k?IC:"rgba(255,255,255,0.4)",cursor:"pointer"}}>{c.l}</button>)}</div>
      {newEntry.currency==="USD"
        ?<Inp label="Monto USD" type="number" value={newEntry.amount} onChange={v=>setNewEntry(p=>({...p,amount:v}))} step="0.01" placeholder="0.00"/>
        :<div style={{display:"grid",gridTemplateColumns:newEntry.payment_method==="tarjeta_credito"?"1fr":"1fr 1fr",gap:"0 12px"}}>
          <Inp label="Monto ARS" type="number" value={newEntry.amount_ars} onChange={v=>setNewEntry(p=>({...p,amount_ars:v}))} step="0.01" placeholder="0.00"/>
          {newEntry.payment_method!=="tarjeta_credito"&&<Inp label="Tipo de cambio ARS/USD" type="number" value={newEntry.exchange_rate} onChange={v=>setNewEntry(p=>({...p,exchange_rate:v}))} step="0.01" placeholder="Ej: 1410"/>}
          {newEntry.currency==="ARS"&&newEntry.payment_method!=="tarjeta_credito"&&newEntry.amount_ars&&newEntry.exchange_rate&&<p style={{gridColumn:"1/-1",fontSize:11,color:IC,margin:"-6px 0 8px",fontWeight:600}}>= USD {(Number(newEntry.amount_ars)/Number(newEntry.exchange_rate)).toFixed(2)}</p>}
        </div>}
      <Inp label={`Detalle ${newEntry.category==="otros"?"(obligatorio)":"(opcional)"}`} value={newEntry.detail} onChange={v=>setNewEntry(p=>({...p,detail:v}))} placeholder="Ej: Meta ads campaña abril · Vercel Pro · Sueldo Marzo"/>
      {newEntry.payment_method==="tarjeta_credito"&&<>
        <Inp label="Fecha de cierre / débito de tarjeta" type="date" value={newEntry.card_closing_date} onChange={v=>setNewEntry(p=>({...p,card_closing_date:v}))}/>
        <div style={{background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
          <p style={{fontSize:12,color:"#fbbf24",margin:0,fontWeight:500}}>💳 Este gasto queda pendiente de débito y suma a la <strong>Deuda Tarjeta</strong> del dashboard hasta que se debite el día de cierre.{newEntry.currency==="ARS"?" Se dollariza al TC del día del débito (en la tab Dollarización).":""}</p>
        </div>
      </>}
      <div style={{display:"flex",gap:8,marginTop:8}}><Btn onClick={addEntry}>Guardar</Btn><Btn variant="secondary" onClick={()=>setShowAdd(false)}>Cancelar</Btn></div>
    </Card>}
    {tab==="fixed"&&(lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando...</p>:<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:16}}>
        {FIXED_CATS.map(c=><div key={c.k} style={{background:"rgba(255,255,255,0.028)",border:`1px solid ${CAT_COLOR[c.k]}33`,borderRadius:10,padding:"10px 14px"}}><p style={{fontSize:10,fontWeight:700,color:CAT_COLOR[c.k],margin:"0 0 4px"}}>{c.l.split(" ")[0].toUpperCase()}</p><p style={{fontSize:15,fontWeight:700,color:"#fff",margin:0}}>{usd(fijosByCategory[c.k]||0)}</p></div>)}
      </div>
      <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.25)"}}>{["Fecha","Categoría","Detalle","Monto","Pago",""].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>{entries.map(e=><tr key={e.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.5)",fontSize:12}}>{formatDate(e.date)}</td>
            <td style={{padding:"10px 12px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:4,fontWeight:700,background:`${CAT_COLOR[e.category||"otros"]}22`,color:CAT_COLOR[e.category||"otros"]}}>{CAT_LBL[e.category||"otros"]}</span></td>
            <td style={{padding:"10px 12px",color:"#fff"}}>{e.detail||"—"}</td>
            <td style={{padding:"10px 12px",fontWeight:700,color:"#ff6b6b"}}>-{usd(Number(e.amount||0))}</td>
            <td style={{padding:"10px 12px",fontSize:10,color:"rgba(255,255,255,0.4)"}}>{e.payment_method==="tarjeta_credito"?"TC":e.payment_method==="tarjeta_debito"?"TD":e.payment_method==="transferencia"?"TRF":"EF"}</td>
            <td style={{padding:"10px 12px"}}><button onClick={()=>delEntry(e.id)} style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>X</button></td>
          </tr>)}</tbody>
        </table>
        {entries.length===0&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.45)",padding:"2rem 0"}}>Sin gastos cargados. Agregá Meta ads, Vercel, Claude, salarios, etc.</p>}
      </div></>)}
    {tab==="ledger"&&(lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando...</p>:<div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.25)"}}>{["Fecha","Tipo","Origen","Descripción","Detalle","Monto"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
        <tbody>{ledger.map((l,i)=><tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.5)",fontSize:12}}>{l.date==="—"?"—":formatDate(l.date)}</td>
          <td style={{padding:"10px 12px"}}><span style={{fontSize:10,padding:"2px 6px",borderRadius:4,fontWeight:700,background:l.type==="ingreso"?"rgba(34,197,94,0.15)":"rgba(255,80,80,0.15)",color:l.type==="ingreso"?"#22c55e":"#ff6b6b"}}>{l.type==="ingreso"?"INGRESO":"GASTO"}</span></td>
          <td style={{padding:"10px 12px"}}><span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"rgba(255,255,255,0.028)",color:"rgba(255,255,255,0.5)"}}>{l.origen==="op"?"Operación":l.origen==="pmt"?"Gestión de pagos":l.origen==="agente"?"Anticipo agente":"Gasto fijo"}</span></td>
          <td style={{padding:"10px 12px",color:"#fff"}}>{l.desc}</td>
          <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.4)",fontSize:11}}>{l.detail||(l.cat?CAT_LBL[l.cat]:"")}</td>
          <td style={{padding:"10px 12px",fontWeight:700,color:l.type==="ingreso"?"#22c55e":"#ff6b6b"}}>{l.type==="gasto"?"-":""}{usd(l.amount)}</td>
        </tr>)}</tbody>
      </table>
      {ledger.length===0&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.45)",padding:"2rem 0"}}>No hay movimientos</p>}
    </div>)}
    {tab==="dollar"&&(()=>{
      // Dos fuentes: (1) finance_entries (gastos del negocio + impuestos/gasto doc de ops)
      //              (2) operation_supplier_payments (costos de ops GI con TC+ARS)
      // Merge en groups por card_closing_date, cada item carga su source para el dollarize.
      const groups={};
      dollarPending.forEach(e=>{const k=e.card_closing_date||"sin_fecha";if(!groups[k])groups[k]=[];groups[k].push({source:"entry",raw:e,id:e.id,description:e.description,amount_ars:Number(e.amount_ars||0),op_code:e.operations?.operation_code,operation_id:e.operation_id});});
      (cardDebt.supTcArs||[]).forEach(p=>{const k=p.card_closing_date||"sin_fecha";if(!groups[k])groups[k]=[];groups[k].push({source:"supplier",raw:p,id:p.id,description:`Costo op ${p.operations?.operation_code||"—"} — ${p.notes||"Sin descripción"}`,amount_ars:Number(p.amount_ars||0),op_code:p.operations?.operation_code,operation_id:p.operation_id});});
      const dollarize=async(closingDate)=>{const rate=Number(dollarRates[closingDate]||0);if(!rate){alert("Ingresá el tipo de cambio");return;}
        const items=groups[closingDate];
        // Para recomputar cost_producto_usd después, trackeamos ops afectadas
        const affectedGiOps=new Set();
        for(const item of items){
          const usdAmt=Math.round((item.amount_ars/rate)*100)/100;
          if(item.source==="entry"){
            await dq("finance_entries",{method:"PATCH",token,filters:`?id=eq.${item.id}`,body:{amount:usdAmt,exchange_rate:rate,dollarized_at:new Date().toISOString(),is_paid:true}});
            if(item.operation_id){
              const field=item.description?.includes("Impuestos")?"cost_impuestos_reales":"cost_gasto_documental";
              await dq("operations",{method:"PATCH",token,filters:`?id=eq.${item.operation_id}`,body:{[field]:usdAmt}});
            }
          } else if(item.source==="supplier"){
            await dq("operation_supplier_payments",{method:"PATCH",token,filters:`?id=eq.${item.id}`,body:{amount_usd:usdAmt,exchange_rate:rate,is_paid:true,paid_at:new Date().toISOString()}});
            if(item.operation_id)affectedGiOps.add(item.operation_id);
          }
        }
        // Recompute cost_producto_usd: payments suman, refunds restan
        for(const opId of affectedGiOps){
          const fresh=await dq("operation_supplier_payments",{token,filters:`?operation_id=eq.${opId}&select=amount_usd,type`});
          const total=(Array.isArray(fresh)?fresh:[]).reduce((s,p)=>{const sgn=p.type==="refund"?-1:1;return s+sgn*Number(p.amount_usd||0);},0);
          await dq("operations",{method:"PATCH",token,filters:`?id=eq.${opId}`,body:{cost_producto_usd:total}});
        }
        load();flash(`Dollarizados ${items.length} gastos al TC $${rate}`);
      };
      return <>
      {Object.keys(groups).length===0&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.45)",padding:"2rem 0"}}>No hay gastos pendientes de dollarización</p>}
      {Object.entries(groups).map(([closingDate,items])=>{
        const totalArs=items.reduce((s,it)=>s+Number(it.amount_ars||0),0);
        const rate=Number(dollarRates[closingDate]||0);
        return <Card key={closingDate} title={`Cierre: ${formatDate(closingDate)}`}>
          <div style={{marginBottom:12}}>
            {items.map(it=><div key={`${it.source}_${it.id}`} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <span style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>{it.description}</span>
                {it.source==="supplier"&&<span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:3,background:"rgba(184,149,106,0.15)",color:GOLD_LIGHT,marginLeft:8,letterSpacing:"0.05em",textTransform:"uppercase"}}>GI</span>}
              </div>
              <span style={{fontSize:13,fontWeight:600,color:"#fff",whiteSpace:"nowrap"}}>ARS {Number(it.amount_ars).toLocaleString("es-AR",{minimumFractionDigits:2})}</span>
            </div>)}
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",marginTop:4}}><span style={{fontSize:14,fontWeight:700,color:"#fff"}}>Total ARS</span><span style={{fontSize:16,fontWeight:700,color:IC}}>ARS {totalArs.toLocaleString("es-AR",{minimumFractionDigits:2})}</span></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px",alignItems:"end"}}>
            <Inp label="Tipo de cambio (ARS/USD)" type="number" value={dollarRates[closingDate]||""} onChange={v=>setDollarRates(p=>({...p,[closingDate]:v}))} step="0.01" placeholder="Ej: 1250"/>
            <div style={{paddingTop:22}}><p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>EQUIVALENTE USD</p><p style={{fontSize:16,fontWeight:700,color:rate>0?"#22c55e":"rgba(255,255,255,0.2)",margin:0}}>{rate>0?usd(totalArs/rate):"—"}</p></div>
            <Btn onClick={()=>dollarize(closingDate)} disabled={!rate}>Dollarizar</Btn>
          </div>
        </Card>;
      })}
      </>;
    })()}
    {/* TAB: Deuda Tarjeta de Crédito (USD) */}
    {tab==="tcdebt"&&(()=>{
      const usdTotEntries=cardDebt.usd.reduce((s,e)=>s+Number(e.amount||0),0);
      const usdTotPmts=cardDebt.pmts.reduce((s,p)=>s+Number(p.giro_amount_usd||0),0);
      const usdTotSup=(cardDebt.supTcUsd||[]).reduce((s,p)=>s+Number(p.amount_usd||0),0);
      const usdTot=usdTotEntries+usdTotPmts+usdTotSup;
      const arsTot=cardDebt.ars.reduce((s,e)=>s+Number(e.amount_ars||0),0);
      // Agrupar por fecha de cierre mezclando: gastos USD + giros al exterior + costos GI USD
      const groups={};
      cardDebt.usd.forEach(e=>{const k=e.card_closing_date||"sin_fecha";if(!groups[k])groups[k]={date:k,items:[]};groups[k].items.push({source:"finance",id:e.id,desc:e.description||"Gasto",detail:e.detail||"",amt:Number(e.amount||0),dateLoad:e.date,op:e.operations?.operation_code});});
      cardDebt.pmts.forEach(p=>{const k=p.giro_tarjeta_due_date||"sin_fecha";if(!groups[k])groups[k]={date:k,items:[]};groups[k].items.push({source:"pmt",id:p.id,desc:`Giro al exterior${p.operations?.operation_code?` — ${p.operations.operation_code}`:""}`,detail:p.description||"",amt:Number(p.giro_amount_usd||0),dateLoad:p.created_at?String(p.created_at).slice(0,10):null,op:p.operations?.operation_code});});
      (cardDebt.supTcUsd||[]).forEach(p=>{const k=p.card_closing_date||"sin_fecha";if(!groups[k])groups[k]={date:k,items:[]};groups[k].items.push({source:"supplier",id:p.id,desc:`Costo op ${p.operations?.operation_code||"—"} (GI)`,detail:p.notes||p.reference||"",amt:Number(p.amount_usd||0),dateLoad:p.payment_date,op:p.operations?.operation_code,operation_id:p.operation_id});});
      const sortedGroups=Object.values(groups).sort((a,b)=>{if(a.date==="sin_fecha")return 1;if(b.date==="sin_fecha")return -1;return a.date.localeCompare(b.date);});
      const todayStr=new Date().toISOString().slice(0,10);
      const markPaid=async(item)=>{
        if(!confirm(`¿Marcar "${item.desc}" como debitada de la tarjeta? Esto la resta del cash real.`))return;
        if(item.source==="finance"){await dq("finance_entries",{method:"PATCH",token,filters:`?id=eq.${item.id}`,body:{is_paid:true}});}
        else if(item.source==="supplier"){await dq("operation_supplier_payments",{method:"PATCH",token,filters:`?id=eq.${item.id}`,body:{is_paid:true,paid_at:new Date().toISOString()}});}
        else{await dq("payment_management",{method:"PATCH",token,filters:`?id=eq.${item.id}`,body:{giro_tarjeta_paid:true,giro_tarjeta_paid_at:new Date().toISOString()}});}
        load();flash("Marcada como debitada");
      };
      const markGroupPaid=async(g)=>{
        if(!confirm(`¿Marcar las ${g.items.length} deudas de ${g.date==="sin_fecha"?"sin fecha":formatDate(g.date)} como debitadas? Total: USD ${g.items.reduce((s,i)=>s+i.amt,0).toFixed(2)}`))return;
        for(const item of g.items){
          if(item.source==="finance")await dq("finance_entries",{method:"PATCH",token,filters:`?id=eq.${item.id}`,body:{is_paid:true}});
          else if(item.source==="supplier")await dq("operation_supplier_payments",{method:"PATCH",token,filters:`?id=eq.${item.id}`,body:{is_paid:true,paid_at:new Date().toISOString()}});
          else await dq("payment_management",{method:"PATCH",token,filters:`?id=eq.${item.id}`,body:{giro_tarjeta_paid:true,giro_tarjeta_paid_at:new Date().toISOString()}});
        }
        load();flash(`${g.items.length} deudas marcadas como debitadas`);
      };
      return <>
        {/* Resumen arriba */}
        <div style={{display:"grid",gridTemplateColumns:arsTot>0?"1fr 1fr":"1fr",gap:16,marginBottom:20}}>
          <div style={{background:usdTot>0?"rgba(251,146,60,0.06)":"rgba(34,197,94,0.06)",border:`1px solid ${usdTot>0?"rgba(251,146,60,0.2)":"rgba(34,197,94,0.2)"}`,borderRadius:12,padding:"18px 22px"}}>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",letterSpacing:"0.05em"}}>💳 DEUDA TARJETA USD</p>
            <p style={{fontSize:28,fontWeight:700,color:usdTot>0?"#fb923c":"#22c55e",margin:0}}>USD {usdTot.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"8px 0 0"}}>{cardDebt.usd.length} gasto{cardDebt.usd.length!==1?"s":""} del negocio{usdTotEntries>0?` (USD ${usdTotEntries.toFixed(2)})`:""} · {cardDebt.pmts.length} giro{cardDebt.pmts.length!==1?"s":""} al exterior{usdTotPmts>0?` (USD ${usdTotPmts.toFixed(2)})`:""}{(cardDebt.supTcUsd||[]).length>0?` · ${cardDebt.supTcUsd.length} costo${cardDebt.supTcUsd.length!==1?"s":""} GI (USD ${usdTotSup.toFixed(2)})`:""}</p>
          </div>
          {arsTot>0&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:12,padding:"18px 22px"}}>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",letterSpacing:"0.05em"}}>💳 DEUDA TARJETA ARS (sin dollarizar)</p>
            <p style={{fontSize:28,fontWeight:700,color:IC,margin:0}}>ARS {arsTot.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
            <button onClick={()=>setTab("dollar")} style={{marginTop:10,fontSize:11,fontWeight:600,padding:"5px 12px",borderRadius:6,border:"1px solid rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.08)",color:IC,cursor:"pointer"}}>Ir a Dollarización →</button>
          </div>}
        </div>
        {/* Grupos por fecha de cierre */}
        {sortedGroups.length===0&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.5)",padding:"3rem 0",fontSize:14}}>🎉 Sin deuda de tarjeta pendiente</p>}
        {sortedGroups.map(g=>{
          const gTotal=g.items.reduce((s,i)=>s+i.amt,0);
          const overdue=g.date!=="sin_fecha"&&g.date<todayStr;
          const soon=g.date!=="sin_fecha"&&!overdue&&(new Date(g.date)-new Date(todayStr))/86400000<=7;
          const color=overdue?"#ff6b6b":soon?"#fbbf24":IC;
          return <Card key={g.date} title={<div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{color}}>{g.date==="sin_fecha"?"📅 Sin fecha de cierre":`📅 Cierre ${formatDate(g.date)}`}</span>
            {overdue&&<span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:4,background:"rgba(255,80,80,0.15)",color:"#ff6b6b",border:"1px solid rgba(255,80,80,0.3)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Vencido</span>}
            {soon&&<span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:4,background:"rgba(251,191,36,0.15)",color:"#fbbf24",border:"1px solid rgba(251,191,36,0.3)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Próximos 7d</span>}
          </div>} actions={<Btn small variant="secondary" onClick={()=>markGroupPaid(g)}>✓ Marcar grupo debitado</Btn>}>
            <div style={{marginBottom:10}}>
              {g.items.map((it,i)=><div key={it.source+it.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<g.items.length-1?"1px solid rgba(255,255,255,0.04)":"none",flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,background:it.source==="pmt"?"rgba(168,85,247,0.15)":"rgba(184,149,106,0.15)",color:it.source==="pmt"?"#c084fc":IC,textTransform:"uppercase",letterSpacing:"0.05em"}}>{it.source==="pmt"?"Giro":"Gasto"}</span>
                    <p style={{fontSize:13,color:"#fff",margin:0,fontWeight:600}}>{it.desc}</p>
                  </div>
                  {it.detail&&<p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"3px 0 0"}}>{it.detail}</p>}
                  {it.dateLoad&&<p style={{fontSize:10,color:"rgba(255,255,255,0.3)",margin:"2px 0 0"}}>Cargado {formatDate(it.dateLoad)}</p>}
                </div>
                <span style={{fontSize:14,fontWeight:700,color:"#fff",minWidth:120,textAlign:"right"}}>USD {it.amt.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                <button onClick={()=>markPaid(it)} style={{fontSize:10,fontWeight:700,padding:"6px 12px",borderRadius:6,border:"none",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",cursor:"pointer",whiteSpace:"nowrap"}}>✓ Debitada</button>
              </div>)}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
              <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>Total del cierre</span>
              <span style={{fontSize:17,fontWeight:700,color}}>USD {gTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
            </div>
          </Card>;
        })}
      </>;
    })()}
  </div>;
}

function FlightEditor({token,flight,signups,flightOps,depositOps,allOps,invoiceItems,depositPkgs,onReload,onFlash,onBack,usd}){
  const a=signups.find(s=>s.auth_user_id===flight.agent_id);
  // Ops del vuelo: buscar en depositOps/allOps, y si no están (porque cambiaron de status), cargar directo
  const [flightOpsData,setFlightOpsData]=useState([]);
  useEffect(()=>{(async()=>{
    const opIds=flightOps.map(fo=>fo.operation_id).filter(Boolean);
    if(opIds.length===0){setFlightOpsData([]);return;}
    const r=await dq("operations",{token,filters:`?id=in.(${opIds.join(",")})&select=id,operation_code,description,client_id,clients(client_code,first_name,last_name)`});
    setFlightOpsData(Array.isArray(r)?r:[]);
  })();},[flightOps.length,token]);
  const opsUnique=flightOpsData.length>0?flightOpsData:Array.from(new Map([...depositOps,...allOps].filter(o=>flightOps.some(fo=>fo.operation_id===o.id)).map(o=>[o.id,o])).values());
  const stColors={preparando:"#fbbf24",despachado:"#60a5fa",recibido:"#22c55e"};
  // updateFlight: versión completa (con reload). Usar sólo cuando cambia algo estructural (status, ops, etc.)
  const updateFlight=async(body)=>{await dq("flights",{method:"PATCH",token,filters:`?id=eq.${flight.id}`,body});onReload();};
  // updateFlightSilent: sin reload (para inputs debounced — evita que se pisen caracteres mientras tipeás)
  const updateFlightSilent=async(body)=>{await dq("flights",{method:"PATCH",token,filters:`?id=eq.${flight.id}`,body});};
  // Estado LOCAL de los campos del destinatario. onChange actualiza acá (instantáneo, sin red).
  // Un useEffect debounced guarda al DB 800ms después de la última tecla.
  const [dest,setDest]=useState({dest_name:flight.dest_name||"",dest_tax_id:flight.dest_tax_id||"",dest_address:flight.dest_address||"",dest_postal_code:flight.dest_postal_code||"",dest_phone:flight.dest_phone||"",dest_email:flight.dest_email||""});
  // Sync desde flight cuando cambia externamente (ej. applyAddr) — NO pisa si el usuario está tipeando
  const typingRef=useRef(0);
  useEffect(()=>{if(Date.now()-typingRef.current<1500)return;setDest({dest_name:flight.dest_name||"",dest_tax_id:flight.dest_tax_id||"",dest_address:flight.dest_address||"",dest_postal_code:flight.dest_postal_code||"",dest_phone:flight.dest_phone||"",dest_email:flight.dest_email||""});},[flight.dest_name,flight.dest_tax_id,flight.dest_address,flight.dest_postal_code,flight.dest_phone,flight.dest_email]);
  // Debounced save: dispara 800ms después de la última tecla
  useEffect(()=>{const diff={};Object.keys(dest).forEach(k=>{if((flight[k]||"")!==dest[k])diff[k]=dest[k];});if(Object.keys(diff).length===0)return;if(diff.dest_address!==undefined)diff.destination_address=diff.dest_address;const t=setTimeout(()=>{updateFlightSilent(diff);},800);return()=>clearTimeout(t);},[dest.dest_name,dest.dest_tax_id,dest.dest_address,dest.dest_postal_code,dest.dest_phone,dest.dest_email]);
  const chDest=(f,v)=>{typingRef.current=Date.now();setDest(p=>({...p,[f]:v}));};
  const [savedAddrs,setSavedAddrs]=useState([]);const [showNewAddr,setShowNewAddr]=useState(false);const [newAddr,setNewAddr]=useState({label:"",name:"",tax_id:"",address:"",postal_code:"",phone:"",email:""});
  const loadAddrs=async()=>{const r=await dq("shipping_addresses",{token,filters:"?select=*&order=is_default.desc,created_at.desc"});setSavedAddrs(Array.isArray(r)?r:[]);};
  useEffect(()=>{loadAddrs();},[]);
  const applyAddr=(a)=>{const body={dest_name:a.name||"",dest_tax_id:a.tax_id||"",dest_address:a.address||"",dest_postal_code:a.postal_code||"",dest_phone:a.phone||"",dest_email:a.email||"",destination_address:[a.name,a.address,a.postal_code].filter(Boolean).join(", ")};setDest({dest_name:body.dest_name,dest_tax_id:body.dest_tax_id,dest_address:body.dest_address,dest_postal_code:body.dest_postal_code,dest_phone:body.dest_phone,dest_email:body.dest_email});updateFlight(body);};
  const saveNewAddr=async()=>{if(!newAddr.label||!newAddr.address){onFlash("Falta etiqueta o dirección");return;}await dq("shipping_addresses",{method:"POST",token,body:newAddr});setNewAddr({label:"",name:"",tax_id:"",address:"",postal_code:"",phone:"",email:""});setShowNewAddr(false);loadAddrs();onFlash("Dirección guardada");};
  const delAddr=async(id)=>{if(!confirm("¿Eliminar dirección?"))return;await dq("shipping_addresses",{method:"DELETE",token,filters:`?id=eq.${id}`});loadAddrs();};
  const [items,setItems]=useState(invoiceItems);
  useEffect(()=>{setItems(invoiceItems);},[invoiceItems]);
  const chItem=(i,f,v)=>setItems(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));
  const saveItem=async(it)=>{await dq("flight_invoice_items",{method:"PATCH",token,filters:`?id=eq.${it.id}`,body:{description:it.description,quantity:Number(it.quantity||0),unit_price_declared_usd:Number(it.unit_price_declared_usd||0),hs_code:it.hs_code||"",notes:it.notes||""}});};
  const saveAllItems=async()=>{for(const it of items){await saveItem(it);}};
  const addItem=async()=>{const opId=opsUnique[0]?.id;if(!opId)return;const r=await dq("flight_invoice_items",{method:"POST",token,body:{flight_id:flight.id,operation_id:opId,description:"",quantity:1,unit_price_declared_usd:0,hs_code:"",sort_order:items.length+1}});const created=Array.isArray(r)?r[0]:r;if(created?.id)setItems(p=>[...p,created]);onReload();};
  const delItem=async(id)=>{await dq("flight_invoice_items",{method:"DELETE",token,filters:`?id=eq.${id}`});setItems(p=>p.filter(x=>x.id!==id));onReload();};
  // Auto-clasificar HS Code con IA (sólo rellena hs_code, NO toca derechos/IVA/estadística)
  const [classifyingHs,setClassifyingHs]=useState(false);
  // ---- Comprimir items con IA (RG 5608: max 8 items por factura) ----
  const MAX_INVOICE_ITEMS=8;
  const itemsByOp=items.reduce((acc,it)=>{(acc[it.operation_id]=acc[it.operation_id]||[]).push(it);return acc;},{});
  // El límite RG 5608 es por FACTURA TOTAL (no por op). Si la factura total supera el límite,
  // hay que comprimir las ops grandes para que la SUMA total quede ≤ MAX_INVOICE_ITEMS.
  // Cada op tiene un target propio: MAX_INVOICE_ITEMS - items de las OTRAS ops.
  const totalInvoiceItems=items.length;
  const needsCompression=totalInvoiceItems>MAX_INVOICE_ITEMS;
  const opsCompressible=needsCompression?Object.entries(itemsByOp).map(([opId,list])=>{
    const itemsOtherOps=totalInvoiceItems-list.length;
    const targetForThisOp=Math.max(1,MAX_INVOICE_ITEMS-itemsOtherOps);
    return {opId,count:list.length,target:targetForThisOp,opCode:opsUnique.find(o=>o.id===opId)?.operation_code||"?"};
  }).filter(o=>o.count>o.target):[];
  const [compressState,setCompressState]=useState(null);
  const openCompressFor=async(opId,target)=>{
    const opItems=itemsByOp[opId]||[];
    const op=opsUnique.find(o=>o.id===opId);
    const targetMax=target||MAX_INVOICE_ITEMS;
    // Traer operation_items ORIGINALES (precios que declaró el cliente, NO los subfacturados del vuelo).
    // Usados para reconstruir el precio original por grupo al guardar.
    const origRaw=await dq("operation_items",{token,filters:`?operation_id=eq.${opId}&select=id,description,quantity,unit_price_usd,ncm_code`});
    const origItems=Array.isArray(origRaw)?origRaw:[];
    const origMap={};origItems.forEach(o=>{origMap[o.id]=o;});
    setCompressState({opId,opCode:op?.operation_code||"?",target:targetMax,original:opItems,origItems,origMap,proposed:null,loading:true,error:null,applying:false});
    try{
      const r=await fetch("/api/compress-items",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        items:opItems.map(it=>({description:it.description,quantity:Number(it.quantity||0),unit_price_usd:Number(it.unit_price_declared_usd||0),hs_code:it.hs_code||null})),
        maxItems:targetMax,
      })});
      const d=await r.json();
      if(!d.ok){setCompressState(s=>({...s,loading:false,error:d.error||"Error desconocido"}));return;}
      setCompressState(s=>({...s,loading:false,proposed:d}));
    }catch(e){setCompressState(s=>({...s,loading:false,error:e.message}));}
  };
  const applyCompress=async()=>{
    if(!compressState?.proposed)return;
    const {opId,proposed,original,origMap}=compressState;
    setCompressState(s=>({...s,applying:true}));
    try{
      // 1. Backup operation_items originales (precios que declaró el cliente)
      const opItemsFull=await dq("operation_items",{token,filters:`?operation_id=eq.${opId}&select=*`});
      await dq("operations",{method:"PATCH",token,filters:`?id=eq.${opId}`,body:{items_backup_json:Array.isArray(opItemsFull)?opItemsFull:[]}});
      // Para cada grupo, calcular precio ORIGINAL (no subfacturado) basándose en operation_items via source_item_id
      // El cliente tiene que ver SUS precios declarados, no los subfacturados que van a aduana.
      const groupsWithOrig=proposed.groups.map(g=>{
        let origTotal=0,origQty=0;
        for(const idx of g.source_indices){
          const fii=original[idx];
          if(!fii)continue;
          const orig=fii.source_item_id?origMap[fii.source_item_id]:null;
          if(orig){
            origTotal+=Number(orig.quantity||0)*Number(orig.unit_price_usd||0);
            origQty+=Number(orig.quantity||0);
          } else {
            // Item agregado manual al vuelo (sin source) → usar el precio del flight_invoice_item
            origTotal+=Number(fii.quantity||0)*Number(fii.unit_price_declared_usd||0);
            origQty+=Number(fii.quantity||0);
          }
        }
        const origUnitPrice=origQty>0?Number((origTotal/origQty).toFixed(4)):g.unit_price_usd;
        return {...g,orig_unit_price_usd:origUnitPrice};
      });
      // 2. Reemplazar flight_invoice_items con precio SUBFACTURADO (el de la IA = promedio del subfacturado)
      await dq("flight_invoice_items",{method:"DELETE",token,filters:`?flight_id=eq.${flight.id}&operation_id=eq.${opId}`});
      let sortIdx=0;
      for(const g of groupsWithOrig){
        sortIdx++;
        await dq("flight_invoice_items",{method:"POST",token,body:{flight_id:flight.id,operation_id:opId,description:g.description,quantity:g.quantity,unit_price_declared_usd:g.unit_price_usd,hs_code:g.hs_code||"",sort_order:sortIdx}});
      }
      // 3. Reemplazar operation_items con precio ORIGINAL (lo que el cliente declaró)
      await dq("operation_items",{method:"DELETE",token,filters:`?operation_id=eq.${opId}`});
      for(const g of groupsWithOrig){
        await dq("operation_items",{method:"POST",token,body:{operation_id:opId,description:g.description,quantity:g.quantity,unit_price_usd:g.orig_unit_price_usd,ncm_code:g.hs_code||""}});
      }
      setCompressState(null);
      onFlash(`✓ ${proposed.original_count} → ${proposed.compressed_count} items · cliente ve precios originales · backup guardado`);
      onReload();
    }catch(e){
      console.error("compress apply error",e);
      setCompressState(s=>({...s,applying:false,error:e.message}));
    }
  };
  // Banner persistente de intervenciones detectadas por la IA
  const [interventionWarnings,setInterventionWarnings]=useState([]); // [{description, ncm, types, reason}]
  const autoClassifyHs=async()=>{
    const pending=items.filter(it=>it.description&&it.description.trim()&&(!it.hs_code||!it.hs_code.trim()));
    if(pending.length===0){onFlash("Todos los items ya tienen HS code");return;}
    setClassifyingHs(true);onFlash(`Clasificando ${pending.length} items…`);
    let ok=0;
    const detectedInterventions=[];
    for(const it of pending){
      try{
        const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:it.description})});
        const d=await r.json();
        if(d?.ncm_code){
          await dq("flight_invoice_items",{method:"PATCH",token,filters:`?id=eq.${it.id}`,body:{hs_code:d.ncm_code}});
          setItems(p=>p.map(x=>x.id===it.id?{...x,hs_code:d.ncm_code}:x));
          ok++;
          if(d.intervention?.required)detectedInterventions.push({description:it.description,ncm:d.ncm_code,types:d.intervention.types||[],reason:d.intervention.reason||null});
        }
      }catch(e){console.error("ncm error",e);}
    }
    setClassifyingHs(false);
    setInterventionWarnings(detectedInterventions);
    if(detectedInterventions.length>0){
      onFlash(`✨ ${ok}/${pending.length} HS codes · ⚠ ${detectedInterventions.length} con intervención (ver banner abajo)`);
    } else {
      onFlash(`✨ ${ok}/${pending.length} HS codes asignados — sin intervenciones detectadas`);
    }
    onReload();
  };
  // --- Editar datos de despacho (costo, peso, carrier, tracking) y recalcular cost_share por op ---
  const [editCost,setEditCost]=useState(false);
  const [costForm,setCostForm]=useState({total_cost_usd:"",total_weight_kg:"",international_carrier:"",international_tracking:"",payment_method:""});
  const [savingCost,setSavingCost]=useState(false);
  const [confirmCostModal,setConfirmCostModal]=useState(null); // {newCost, newWeight}
  const openEditCost=()=>{setCostForm({total_cost_usd:flight.total_cost_usd||"",total_weight_kg:flight.total_weight_kg||"",international_carrier:flight.international_carrier||"",international_tracking:flight.international_tracking||"",payment_method:flight.payment_method||""});setEditCost(true);};
  const requestSaveCost=()=>{
    const newCost=Number(costForm.total_cost_usd||0);
    const newWeight=Number(costForm.total_weight_kg||0);
    if(!newCost||!newWeight){onFlash("Cargá costo y peso (>0)");return;}
    setConfirmCostModal({newCost,newWeight});
  };
  const saveCost=async()=>{
    const newCost=Number(costForm.total_cost_usd||0);
    const newWeight=Number(costForm.total_weight_kg||0);
    if(!newCost||!newWeight){onFlash("Cargá costo y peso (>0)");return;}
    setSavingCost(true);
    const newPmt=costForm.payment_method||null;
    const newCarrier=costForm.international_carrier||null;
    const newTracking=costForm.international_tracking||null;
    await dq("flights",{method:"PATCH",token,filters:`?id=eq.${flight.id}`,body:{total_cost_usd:newCost,total_weight_kg:newWeight,international_carrier:newCarrier,international_tracking:newTracking,payment_method:newPmt}});
    // PROPAGAR carrier + tracking a TODAS las ops del vuelo. Antes este patch solo
    // tocaba flights.international_tracking, dejando operations.international_tracking
    // con el valor viejo → el sync del cliente seguía usando el tracking incorrecto.
    if(newTracking||newCarrier){
      const opIds=flightOps.map(fo=>fo.operation_id).filter(Boolean);
      if(opIds.length>0){
        const opPatch={};
        if(newTracking)opPatch.international_tracking=newTracking;
        if(newCarrier)opPatch.international_carrier=newCarrier;
        await dq("operations",{method:"PATCH",token,filters:`?id=in.(${opIds.join(",")})`,body:opPatch});
      }
    }
    // Recalcular share por peso ya guardado en flight_operations
    for(const fo of flightOps){
      const opW=Number(fo.weight_kg||0);
      const share=newWeight>0?(opW/newWeight)*newCost:0;
      const cflMethod=newPmt==="cuenta_corriente"?"cuenta_corriente":(newPmt==="transferencia"?"transferencia":"contado");
      await dq("flight_operations",{method:"PATCH",token,filters:`?id=eq.${fo.id}`,body:{cost_share_usd:share}});
      await dq("operations",{method:"PATCH",token,filters:`?id=eq.${fo.operation_id}`,body:{cost_flete:share,cost_flete_method:cflMethod}});
    }
    // Sincronizar movimiento de CC del agente (creado en dispatch si era cuenta_corriente)
    try{
      const existing=await dq("agent_account_movements",{token,filters:`?flight_id=eq.${flight.id}&type=eq.deduccion&select=id`});
      const exId=Array.isArray(existing)&&existing[0]?existing[0].id:null;
      if(newPmt==="cuenta_corriente"){
        if(exId){
          await dq("agent_account_movements",{method:"PATCH",token,filters:`?id=eq.${exId}`,body:{amount_usd:newCost,description:`Costo vuelo ${flight.flight_code}`}});
        } else if(flight.agent_id){
          await dq("agent_account_movements",{method:"POST",token,body:{agent_id:flight.agent_id,type:"deduccion",amount_usd:newCost,description:`Costo vuelo ${flight.flight_code}`,flight_id:flight.id,date:new Date().toISOString().slice(0,10)}});
        }
      } else if(exId){
        // Cambió de cuenta_corriente a otro método → eliminar deducción huérfana
        await dq("agent_account_movements",{method:"DELETE",token,filters:`?id=eq.${exId}`});
      }
    }catch(e){console.error("sync CC mov error",e);}
    setSavingCost(false);setEditCost(false);setConfirmCostModal(null);
    onFlash("Despacho actualizado · cost_flete y CC agente recalculados");onReload();
  };
  // Eliminar vuelo (solo si está "preparando" — las ops vuelven al depósito)
  const [deletingFlight,setDeletingFlight]=useState(false);
  const [showDeleteFlightModal,setShowDeleteFlightModal]=useState(false);
  const requestDeleteFlight=()=>{
    if(flight.status!=="preparando"){onFlash("Solo se pueden eliminar vuelos en estado 'preparando'");return;}
    setShowDeleteFlightModal(true);
  };
  const deleteFlight=async()=>{
    setDeletingFlight(true);
    try{
      // 1. Devolver cada op al depósito (status en_deposito_origen, consolidación se mantiene)
      for(const fo of flightOps){
        await dq("operations",{method:"PATCH",token,filters:`?id=eq.${fo.operation_id}`,body:{status:"en_deposito_origen"}});
      }
      // 2. Borrar items de factura del vuelo
      await dq("flight_invoice_items",{method:"DELETE",token,filters:`?flight_id=eq.${flight.id}`});
      // 3. Borrar flight_operations
      await dq("flight_operations",{method:"DELETE",token,filters:`?flight_id=eq.${flight.id}`});
      // 4. Borrar el vuelo
      await dq("flights",{method:"DELETE",token,filters:`?id=eq.${flight.id}`});
      setShowDeleteFlightModal(false);
      onFlash(`✓ Vuelo ${flight.flight_code} eliminado · ${flightOps.length} ops devueltas al depósito`);
      onReload();
      onBack();
    }catch(e){
      console.error("delete flight error",e);
      onFlash(`❌ Error: ${e.message}`);
      setDeletingFlight(false);
    }
  };
  const markReceived=async()=>{
    if(!confirm(`¿Marcar ${flight.flight_code} como recibido en Bs As? Las ops cambiarán a 'arribo_argentina'.`))return;
    await dq("flights",{method:"PATCH",token,filters:`?id=eq.${flight.id}`,body:{status:"recibido",received_at:new Date().toISOString()}});
    for(const fo of flightOps){await dq("operations",{method:"PATCH",token,filters:`?id=eq.${fo.operation_id}`,body:{status:"arribo_argentina"}});}
    // Notification #3a: notify agent about flight received
    try{await dq("notifications",{method:"POST",token,body:{user_id:flight.agent_id,portal:"agente",title:`Vuelo ${flight.flight_code} recibido en Buenos Aires`,body:null,link:"?tab=history"}});}catch(e){console.error("notif error",e);}
    try{fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:flight.agent_id,title:`Vuelo ${flight.flight_code} recibido en Buenos Aires`,url:"/agente?tab=history"})});}catch(e){}
    // Notification #3b: notify each client whose operation is in this flight
    try{
      const opIds=flightOps.map(fo=>fo.operation_id);
      const opsData=await dq("operations",{token,filters:`?id=in.(${opIds.join(",")})`+`&select=id,operation_code,client_id`});
      if(Array.isArray(opsData)){
        const clientIds=[...new Set(opsData.map(o=>o.client_id).filter(Boolean))];
        if(clientIds.length>0){
          const cls=await dq("clients",{token,filters:`?id=in.(${clientIds.join(",")})&select=id,auth_user_id`});
          const clientMap={};(Array.isArray(cls)?cls:[]).forEach(c=>{if(c.auth_user_id)clientMap[c.id]=c.auth_user_id;});
          for(const o of opsData){
            const uid=clientMap[o.client_id];
            if(uid){await dq("notifications",{method:"POST",token,body:{user_id:uid,portal:"cliente",title:"Tu envío llegó a Argentina",body:`Operación ${o.operation_code}`,link:`?op=${o.operation_code}`}});}
          }
        }
      }
    }catch(e){console.error("client notif error",e);}
    onReload();onFlash("Vuelo recibido");onBack();
  };
  const totalDeclaredUSD=items.reduce((s,it)=>s+Number(it.quantity||0)*Number(it.unit_price_declared_usd||0),0);
  const canDispatch=flight.status==="preparando"&&items.length>0&&items.every(it=>it.hs_code&&it.description&&Number(it.unit_price_declared_usd)>0)&&(flight.dest_address||flight.destination_address);
  const printInvoice=()=>{
    const w=window.open("","_blank");if(!w)return;
    const itemsByOp={};items.forEach(it=>{if(!itemsByOp[it.operation_id])itemsByOp[it.operation_id]=[];itemsByOp[it.operation_id].push(it);});
    const rows=items.map(it=>`<tr><td>${it.description}</td><td>${it.hs_code||"-"}</td><td style="text-align:right">${Number(it.quantity||0).toLocaleString("en-US")}</td><td style="text-align:right">USD ${Number(it.unit_price_declared_usd||0).toFixed(2)}</td><td style="text-align:right"><strong>USD ${(Number(it.quantity||0)*Number(it.unit_price_declared_usd||0)).toFixed(2)}</strong></td></tr>`).join("");
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>${flight.flight_code}</title><style>
      body{font-family:Arial,sans-serif;max-width:800px;margin:30px auto;padding:0 20px;color:#222;}
      h1{text-align:center;margin:0 0 4px;font-size:22px}
      .sub{text-align:center;color:#666;margin:0 0 20px;font-size:13px}
      .info{display:flex;justify-content:space-between;gap:40px;margin:16px 0 24px;padding:14px 18px;background:#f5f5f5;border-radius:6px;font-size:13px}
      table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
      th,td{padding:10px 12px;border-bottom:1px solid #ddd;text-align:left}
      th{background:#eee;font-size:11px;text-transform:uppercase}
      tfoot td{font-weight:700;background:#f9f9f9;border-top:2px solid #333}
      .foot{margin-top:40px;font-size:11px;color:#666;text-align:center}
    </style></head><body>
      <h1>COMMERCIAL INVOICE — ${flight.flight_code}</h1>
      <p class="sub">Argencargo · ${flight.dispatched_at?new Date(flight.dispatched_at).toLocaleDateString("en-US"):new Date().toLocaleDateString("en-US")}</p>
      <div class="info">
        <div><strong>From:</strong> Agent in China<br/><strong>To:</strong> ${[flight.dest_name,flight.dest_address,flight.dest_postal_code].filter(Boolean).join(", ")||flight.destination_address||"—"}${flight.dest_tax_id?`<br/><strong>Tax ID:</strong> ${flight.dest_tax_id}`:""}${flight.dest_phone?`<br/><strong>Phone:</strong> ${flight.dest_phone}`:""}${flight.dest_email?`<br/><strong>Email:</strong> ${flight.dest_email}`:""}</div>
        <div><strong>Carrier:</strong> ${flight.international_carrier||"—"}<br/><strong>Tracking:</strong> ${flight.international_tracking||"—"}</div>
      </div>
      <table>
        <thead><tr><th>Description</th><th>HS Code</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4" style="text-align:right">TOTAL DECLARED VALUE</td><td style="text-align:right">USD ${totalDeclaredUSD.toFixed(2)}</td></tr></tfoot>
      </table>
      <p class="foot">This invoice was auto-generated by Argencargo's system</p>
    </body></html>`;
    w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),400);
  };
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:8,flexWrap:"wrap"}}>
      <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,0.55)",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontWeight:600,padding:"6px 12px",borderRadius:8,letterSpacing:"0.04em",transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.color=GOLD_LIGHT;e.currentTarget.style.borderColor="rgba(184,149,106,0.35)";}} onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,0.55)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}>← Volver a vuelos</button>
      {flight.status==="preparando"&&<button onClick={requestDeleteFlight} disabled={deletingFlight} title="Borra el vuelo y devuelve las ops al depósito" style={{fontSize:12,color:"#ff6b6b",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.3)",cursor:deletingFlight?"wait":"pointer",fontWeight:600,padding:"6px 12px",borderRadius:8,opacity:deletingFlight?0.6:1}}>{deletingFlight?"Eliminando…":"🗑 Eliminar vuelo"}</button>}
    </div>
    <Card title={`${flight.flight_code} — ${a?(a.first_name+" "+(a.last_name||"")):""}`}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
        {(()=>{const ready=flight.status==="preparando"&&flight.invoice_presented_at;const c=ready?"#22c55e":stColors[flight.status];const label=ready?"listo para enviar":flight.status;return <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:c,background:`${c}20`,border:`1px solid ${c}40`,textTransform:"uppercase"}}>{label}</span>;})()}
        <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{flightOps.length} operaciones</span>
      </div>
      <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"12px 0 8px",textTransform:"uppercase"}}>Operaciones en este vuelo</p>
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 14px",marginBottom:16}}>
        {opsUnique.map(o=>{
          const fo=flightOps.find(x=>x.operation_id===o.id);
          const pkgs=depositPkgs.filter(p=>p.operation_id===o.id);
          // Divisor volumétrico del agente que creó la op (no del agente del vuelo)
          const opAgent=signups.find(s=>s.auth_user_id===o.created_by_agent_id);
          const opDiv=Number(opAgent?.volumetric_divisor)||5000;
          let totBruto=0,totFact=0;
          const pkgRows=pkgs.map(p=>{
            const q=Number(p.quantity||1);
            const gw=Number(p.gross_weight_kg||0);
            const l=Number(p.length_cm||0),wd=Number(p.width_cm||0),h=Number(p.height_cm||0);
            const bruto=gw*q;
            const vol=l&&wd&&h?((l*wd*h)/opDiv)*q:0;
            const fact=Math.max(bruto,vol);
            totBruto+=bruto;totFact+=fact;
            return {p,q,bruto,vol,fact};
          });
          return <div key={o.id} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:pkgs.length>0?6:0,flexWrap:"wrap",gap:6}}>
              <span style={{fontSize:13,color:"#fff"}}><strong style={{fontFamily:"monospace"}}>{o.operation_code}</strong> — {o.clients?`${o.clients.first_name||""} ${o.clients.last_name||""}`.trim():"—"}</span>
              <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{pkgs.length} bultos · bruto <strong style={{color:"rgba(255,255,255,0.75)"}}>{totBruto.toFixed(2)} kg</strong> · facturable <strong style={{color:IC}}>{totFact.toFixed(2)} kg</strong>{fo?.cost_share_usd?` · ${usd(fo.cost_share_usd)}`:""}</span>
            </div>
            {pkgs.length>0&&<div style={{marginLeft:16,fontSize:11,color:"rgba(255,255,255,0.4)"}}>
              {pkgRows.map(({p,bruto,vol,fact})=><div key={p.id} style={{display:"flex",gap:12,padding:"2px 0",flexWrap:"wrap"}}>
                <span style={{minWidth:30}}>#{p.package_number}</span>
                <span style={{minWidth:120}}>{p.national_tracking||"—"}</span>
                {p.length_cm&&p.width_cm&&p.height_cm?<span style={{minWidth:90}}>{p.length_cm}×{p.width_cm}×{p.height_cm} cm</span>:<span style={{minWidth:90}}>—</span>}
                <span style={{minWidth:90}}>bruto: {bruto>0?`${bruto.toFixed(2)} kg`:"—"}</span>
                <span style={{minWidth:90}}>vol: {vol>0?`${vol.toFixed(2)} kg`:"—"}</span>
                <span style={{color:fact>0?IC:"rgba(255,255,255,0.3)",fontWeight:600}}>facturable: {fact>0?`${fact.toFixed(2)} kg`:"—"}</span>
              </div>)}
            </div>}
          </div>;
        })}
      </div>
    </Card>
    <Card title="Factura de exportación (destinatario + items)" actions={<div style={{display:"flex",gap:8}}><Btn small variant="secondary" onClick={printInvoice} disabled={items.length===0}>📄 Ver / Imprimir</Btn></div>}>
      <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase"}}>📍 Destinatario — dirección de envío</p>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {savedAddrs.length>0&&<select onChange={e=>{const a=savedAddrs.find(x=>x.id===e.target.value);if(a)applyAddr(a);e.target.value="";}} style={{padding:"6px 10px",fontSize:12,border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,background:"rgba(255,255,255,0.06)",color:"#fff",cursor:"pointer"}}>
              <option value="" style={{background:"#142038"}}>Cargar dirección guardada…</option>
              {savedAddrs.map(a=><option key={a.id} value={a.id} style={{background:"#142038"}}>{a.label}{a.is_default?" ⭐":""}</option>)}
            </select>}
            <button onClick={()=>setShowNewAddr(!showNewAddr)} style={{padding:"6px 10px",fontSize:11,fontWeight:600,border:"1px solid rgba(184,149,106,0.25)",borderRadius:6,background:"rgba(184,149,106,0.1)",color:IC,cursor:"pointer"}}>{showNewAddr?"✕":"+ Guardar como predeterminada"}</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Inp label="Nombre" value={dest.dest_name} onChange={v=>chDest("dest_name",v)} placeholder="Razón social o nombre"/>
          <Inp label="CUIT / Tax ID" value={dest.dest_tax_id} onChange={v=>chDest("dest_tax_id",v)} placeholder="20-12345678-9"/>
        </div>
        <Inp label="Dirección" value={dest.dest_address} onChange={v=>chDest("dest_address",v)} placeholder="Av. Callao 1137, CABA"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:"0 12px"}}>
          <Inp label="Código Postal" value={dest.dest_postal_code} onChange={v=>chDest("dest_postal_code",v)} placeholder="C1024AAQ"/>
          <Inp label="Teléfono" value={dest.dest_phone} onChange={v=>chDest("dest_phone",v)} placeholder="+54 11 ..."/>
          <Inp label="Email" value={dest.dest_email} onChange={v=>chDest("dest_email",v)} placeholder="contacto@ejemplo.com"/>
        </div>
        {showNewAddr&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:8,padding:"12px 14px",marginTop:10}}>
          <p style={{fontSize:11,fontWeight:700,color:IC,margin:"0 0 8px"}}>NUEVA DIRECCIÓN PREDETERMINADA</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
            <Inp label="Etiqueta" value={newAddr.label} onChange={v=>setNewAddr(p=>({...p,label:v}))} placeholder="Ej: Depósito CABA"/>
            <Inp label="Nombre" value={newAddr.name} onChange={v=>setNewAddr(p=>({...p,name:v}))}/>
            <Inp label="CUIT / Tax ID" value={newAddr.tax_id} onChange={v=>setNewAddr(p=>({...p,tax_id:v}))}/>
            <Inp label="Código Postal" value={newAddr.postal_code} onChange={v=>setNewAddr(p=>({...p,postal_code:v}))}/>
          </div>
          <Inp label="Dirección" value={newAddr.address} onChange={v=>setNewAddr(p=>({...p,address:v}))}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
            <Inp label="Teléfono" value={newAddr.phone} onChange={v=>setNewAddr(p=>({...p,phone:v}))}/>
            <Inp label="Email" value={newAddr.email} onChange={v=>setNewAddr(p=>({...p,email:v}))}/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:6}}>
            <Btn small onClick={saveNewAddr}>Guardar</Btn>
            <Btn small variant="secondary" onClick={()=>setShowNewAddr(false)}>Cancelar</Btn>
          </div>
        </div>}
        {savedAddrs.length>0&&<div style={{marginTop:10}}>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 6px",textTransform:"uppercase"}}>Direcciones guardadas</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{savedAddrs.map(a=><div key={a.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",fontSize:11,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,color:"rgba(255,255,255,0.6)"}}>{a.label}{a.is_default?" ⭐":""}<button onClick={()=>delAddr(a.id)} style={{marginLeft:4,fontSize:10,padding:"1px 5px",borderRadius:3,border:"none",background:"rgba(255,80,80,0.15)",color:"#ff6b6b",cursor:"pointer"}}>X</button></div>)}</div>
        </div>}
      </div>
      <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"14px 0 8px",textTransform:"uppercase"}}>📋 Items — HS code + valor declarado</p>
      {items.length===0&&!flight.invoice_presented_at?<div>
        <p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"1rem 0",margin:0}}>No hay items todavía. Agregá manualmente o esperá a que el cliente complete la documentación.</p>
        <div style={{display:"flex",justifyContent:"center",marginTop:10}}><button onClick={addItem} style={{padding:"8px 18px",fontSize:12,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer"}}>+ Agregar ítem manual</button></div>
      </div>:flight.invoice_presented_at?<div>
        {items.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"1rem 0",margin:0}}>No hay items.</p>:
        <div>
          <div style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr 1fr",gap:8,padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>
            <span>Descripción</span><span>HS Code</span><span style={{textAlign:"right"}}>Cant.</span><span style={{textAlign:"right"}}>Unit. USD</span><span style={{textAlign:"right"}}>Subtotal</span>
          </div>
          {items.map((it,i)=>{const op=opsUnique.find(o=>o.id===it.operation_id);return <div key={it.id} style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr 1fr",gap:8,padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:12,color:"rgba(255,255,255,0.85)"}}>
            <span>{it.description}</span>
            <span style={{fontFamily:"monospace"}}>{it.hs_code||"—"}</span>
            <span style={{textAlign:"right"}}>{Number(it.quantity||0)}</span>
            <span style={{textAlign:"right"}}>USD {Number(it.unit_price_declared_usd||0).toFixed(2)}</span>
            <span style={{textAlign:"right",fontWeight:700}}>USD {(Number(it.quantity||0)*Number(it.unit_price_declared_usd||0)).toFixed(2)}</span>
          </div>;})}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"rgba(184,149,106,0.08)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:8,marginTop:6}}>
            <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>TOTAL DECLARADO</span>
            <span style={{fontSize:16,fontWeight:700,color:IC}}>USD {totalDeclaredUSD.toFixed(2)}</span>
          </div>
        </div>}
      </div>:
      <div>
        {items.map((it,i)=>{const op=opsUnique.find(o=>o.id===it.operation_id);return <div key={it.id} style={{background:"rgba(255,255,255,0.028)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:700,color:IC,fontFamily:"monospace"}}>{op?op.operation_code:""} · Item {i+1}</span>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>delItem(it.id)} style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>X</button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr",gap:"0 10px"}}>
            <Inp label="Descripción" value={it.description} onChange={v=>chItem(i,"description",v)} small/>
            <Inp label="HS Code" value={it.hs_code} onChange={v=>chItem(i,"hs_code",v)} placeholder="8517.62" small/>
            <Inp label="Cantidad" type="number" value={it.quantity} onChange={v=>chItem(i,"quantity",v)} small/>
            <Inp label="Precio unit. USD (declarado)" type="number" value={it.unit_price_declared_usd} onChange={v=>chItem(i,"unit_price_declared_usd",v)} step="0.01" small/>
          </div>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"4px 0 0",textAlign:"right"}}>Subtotal: USD {(Number(it.quantity||0)*Number(it.unit_price_declared_usd||0)).toFixed(2)}</p>
        </div>;})}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"rgba(184,149,106,0.08)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:8,marginTop:6}}>
          <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>TOTAL DECLARADO</span>
          <span style={{fontSize:16,fontWeight:700,color:IC}}>USD {totalDeclaredUSD.toFixed(2)}</span>
        </div>
        {needsCompression&&<div style={{padding:"10px 14px",background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.3)",borderRadius:8,marginTop:10}}>
          <p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:600}}>⚠ Esta factura tiene <strong>{totalInvoiceItems} items</strong> y el límite RG 5608 es <strong>{MAX_INVOICE_ITEMS}</strong>. Comprimí los items de cada op (botones naranjas abajo) para llegar al límite.</p>
        </div>}
        {interventionWarnings.length>0&&<div style={{padding:"12px 14px",background:"rgba(251,191,36,0.10)",border:"1.5px solid rgba(251,191,36,0.4)",borderRadius:10,marginTop:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:6}}>
            <span style={{fontSize:12,fontWeight:800,color:"#fbbf24",textTransform:"uppercase",letterSpacing:"0.05em"}}>⚠ {interventionWarnings.length} {interventionWarnings.length===1?"item":"items"} con posible intervención de organismo</span>
            <button onClick={()=>setInterventionWarnings([])} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:18,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
          </div>
          <ul style={{margin:0,paddingLeft:18,listStyle:"disc"}}>
            {interventionWarnings.map((w,i)=><li key={i} style={{fontSize:12,color:"rgba(255,255,255,0.85)",marginBottom:4}}>
              <strong>{w.description.slice(0,60)}{w.description.length>60?"…":""}</strong> ({w.ncm}) → <span style={{color:"#fbbf24",fontWeight:700}}>{w.types.join(" · ")}</span>{w.reason?<span style={{color:"rgba(255,255,255,0.55)",fontStyle:"italic"}}> · {w.reason}</span>:""}
            </li>)}
          </ul>
        </div>}
        <div style={{display:"flex",justifyContent:"center",gap:10,marginTop:10,flexWrap:"wrap"}}>
          <button onClick={addItem} style={{padding:"8px 18px",fontSize:12,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer"}}>+ Agregar ítem manual</button>
          {items.some(it=>it.description&&it.description.trim()&&(!it.hs_code||!it.hs_code.trim()))&&<button onClick={autoClassifyHs} disabled={classifyingHs} style={{padding:"8px 18px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(167,139,250,0.35)",background:"rgba(167,139,250,0.1)",color:"#a78bfa",cursor:classifyingHs?"wait":"pointer",opacity:classifyingHs?0.6:1}}>{classifyingHs?"Clasificando…":"✨ Auto-completar HS Code (IA)"}</button>}
          {needsCompression&&!flight.invoice_presented_at&&opsCompressible.map(({opId,opCode,count,target})=><button key={opId} onClick={()=>openCompressFor(opId,target)} title={`Comprimir los ${count} items de ${opCode} a ${target} (otras ops aportan ${totalInvoiceItems-count} al total). Límite RG 5608: ${MAX_INVOICE_ITEMS} por factura.`} style={{padding:"8px 18px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(251,146,60,0.4)",background:"rgba(251,146,60,0.1)",color:"#fb923c",cursor:"pointer"}}>🗜 Comprimir {opCode} ({count} → ≤{target})</button>)}
          {!flight.invoice_presented_at&&items.length>0&&<button onClick={async()=>{await saveAllItems();onFlash("Cambios guardados");onReload();}} style={{padding:"8px 18px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(34,197,94,0.3)",background:"rgba(34,197,94,0.1)",color:"#22c55e",cursor:"pointer"}}>💾 Guardar cambios</button>}
        </div>
      </div>}
      {flight.status==="preparando"&&<div style={{marginTop:16,padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        {flight.invoice_presented_at?<div><p style={{fontSize:12,fontWeight:700,color:"#22c55e",margin:0}}>✓ Factura presentada {formatDate(flight.invoice_presented_at)}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"2px 0 0"}}>El agente ya puede despacharla</p></div>:<div><p style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",margin:0}}>⏳ La factura todavía no está presentada</p><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"2px 0 0"}}>El agente no puede despachar hasta que la presentes</p></div>}
        {flight.invoice_presented_at?<Btn small variant="secondary" onClick={()=>updateFlight({invoice_presented_at:null})}>Reabrir factura</Btn>:<Btn small onClick={async()=>{if(items.length===0){onFlash("Agregá items primero");return;}if(!flight.dest_address){onFlash("Completá la dirección");return;}if(items.some(it=>!it.hs_code||!it.description||!Number(it.unit_price_declared_usd))){onFlash("Completá HS code, descripción y valor en todos los items");return;}await saveAllItems();await updateFlight({invoice_presented_at:new Date().toISOString()});for(const fo of flightOps){await dq("operations",{method:"PATCH",token,filters:`?id=eq.${fo.operation_id}&status=eq.en_deposito_origen`,body:{status:"en_preparacion"}});}dq("notifications",{method:"POST",token,body:{user_id:flight.agent_id,portal:"agente",title:`Factura lista para vuelo ${flight.flight_code}`,body:"Ya podés despachar",link:"?tab=active_flights"}}).catch(e=>console.error("notif error",e));fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:flight.agent_id,title:`Factura lista para vuelo ${flight.flight_code}`,body:"Ya podés despachar",url:"/agente?tab=active_flights"})}).catch(()=>{});onFlash("Factura presentada · agente notificado");}}>✓ Guardar y presentar factura</Btn>}
      </div>}
    </Card>
    {(flight.status==="despachado"||flight.status==="recibido")&&<Card title="Datos del despacho (cargados por agente)" actions={!editCost?<Btn small variant="secondary" onClick={openEditCost}>✎ Editar</Btn>:null}>
      {!editCost?<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:12}}>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>CARRIER</p><p style={{fontSize:14,color:"#fff",margin:0}}>{flight.international_carrier||"—"}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>TRACKING</p><p style={{fontSize:14,color:"#fff",margin:0,fontFamily:"monospace"}}>{flight.international_tracking||"—"}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>PESO TOTAL</p><p style={{fontSize:14,color:"#fff",margin:0}}>{flight.total_weight_kg?`${flight.total_weight_kg} kg`:"—"}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>COSTO TOTAL</p><p style={{fontSize:14,color:"#fff",margin:0}}>{usd(flight.total_cost_usd||0)}{flight.total_weight_kg?<span style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginLeft:6}}>· {usd((flight.total_cost_usd||0)/flight.total_weight_kg)}/kg</span>:null}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>PAGO</p><p style={{fontSize:14,color:"#fff",margin:0}}>{flight.payment_method||"—"}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>DESPACHADO</p><p style={{fontSize:14,color:"#fff",margin:0}}>{formatDate(flight.dispatched_at)}</p></div>
        </div>
        {flight.status==="despachado"&&<div style={{marginTop:14}}><Btn small onClick={markReceived}>✓ Marcar como recibido en Bs As</Btn></div>}
      </>:<>
        <div style={{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:8,padding:"10px 12px",marginBottom:12}}>
          <p style={{fontSize:11,color:"#fbbf24",margin:0,fontWeight:600}}>⚠ Editar redistribuye el costo entre las {flightOps.length} operaciones del vuelo proporcional al peso de cada una. Se actualiza <code>cost_flete</code> en cada op.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Inp label="Costo total (USD)" type="number" step="0.01" value={costForm.total_cost_usd} onChange={v=>setCostForm(p=>({...p,total_cost_usd:v}))}/>
          <Inp label="Peso total (kg)" type="number" step="0.01" value={costForm.total_weight_kg} onChange={v=>setCostForm(p=>({...p,total_weight_kg:v}))}/>
          <Inp label="Carrier" value={costForm.international_carrier} onChange={v=>setCostForm(p=>({...p,international_carrier:v}))}/>
          <Inp label="Tracking" value={costForm.international_tracking} onChange={v=>setCostForm(p=>({...p,international_tracking:v}))}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>Método de pago</label>
          <select value={costForm.payment_method||""} onChange={e=>setCostForm(p=>({...p,payment_method:e.target.value}))} style={{padding:"6px 10px",fontSize:12,border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,background:"rgba(255,255,255,0.06)",color:"#fff"}}>
            <option value="" style={{background:"#142038"}}>—</option>
            <option value="contado" style={{background:"#142038"}}>contado</option>
            <option value="transferencia" style={{background:"#142038"}}>transferencia</option>
            <option value="cuenta_corriente" style={{background:"#142038"}}>cuenta corriente</option>
          </select>
        </div>
        {Number(costForm.total_cost_usd)>0&&Number(costForm.total_weight_kg)>0&&<p style={{fontSize:11,color:"rgba(255,255,255,0.55)",margin:"0 0 10px"}}>Tarifa resultante: <strong style={{color:IC}}>{usd(Number(costForm.total_cost_usd)/Number(costForm.total_weight_kg))}/kg</strong></p>}
        <div style={{display:"flex",gap:8}}>
          <Btn small onClick={requestSaveCost} disabled={savingCost}>{savingCost?"Guardando…":"💾 Guardar y recalcular"}</Btn>
          <Btn small variant="secondary" onClick={()=>setEditCost(false)} disabled={savingCost}>Cancelar</Btn>
        </div>
      </>}
    </Card>}
    {compressState&&(()=>{const {opCode,original,proposed,loading,error,applying,target}=compressState;const targetMax=target||MAX_INVOICE_ITEMS;return <div onClick={()=>!applying&&setCompressState(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1px solid rgba(251,146,60,0.35)",borderRadius:14,padding:"20px 22px",maxWidth:920,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:14}}>
          <div>
            <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>🗜 Comprimir items de {opCode}</h3>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:"4px 0 0"}}>De {original.length} items → máximo {targetMax} para esta op (factura tiene {totalInvoiceItems} items, límite RG 5608: {MAX_INVOICE_ITEMS}). La IA agrupa variantes (color, talle, etc.) — conservador, no fuerza si los productos son distintos.</p>
          </div>
          <button onClick={()=>!applying&&setCompressState(null)} disabled={applying} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:applying?"not-allowed":"pointer",padding:0,lineHeight:1}}>×</button>
        </div>
        {loading&&<p style={{padding:"30px",textAlign:"center",fontSize:13,color:"#a78bfa"}}>⏳ La IA está agrupando los {original.length} items…</p>}
        {error&&<div style={{padding:"12px 14px",background:"rgba(255,80,80,0.1)",border:"1px solid rgba(255,80,80,0.3)",borderRadius:8,marginBottom:12}}>
          <p style={{fontSize:12,color:"#ff6b6b",margin:0,fontWeight:700}}>❌ {error}</p>
          <button onClick={()=>openCompressFor(compressState.opId,compressState.target)} style={{marginTop:8,fontSize:11,padding:"4px 10px",borderRadius:5,border:"1px solid rgba(167,139,250,0.4)",background:"rgba(167,139,250,0.1)",color:"#a78bfa",cursor:"pointer"}}>🔄 Reintentar</button>
        </div>}
        {proposed&&<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <div>
              <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 8px",textTransform:"uppercase"}}>📋 Original ({proposed.original_count}) · USD {proposed.original_fob.toFixed(2)}</p>
              <div style={{maxHeight:340,overflowY:"auto",background:"rgba(0,0,0,0.2)",borderRadius:6,padding:"6px 8px"}}>
                {original.map((it,i)=><div key={it.id} style={{padding:"4px 0",fontSize:11,color:"rgba(255,255,255,0.7)",borderBottom:i<original.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                  <span style={{color:"rgba(255,255,255,0.4)",marginRight:6}}>[{i}]</span>{it.description} · {it.quantity}u × USD {Number(it.unit_price_declared_usd||0).toFixed(2)}{it.hs_code?` · ${it.hs_code}`:""}
                </div>)}
              </div>
            </div>
            <div>
              <p style={{fontSize:11,fontWeight:700,color:"#22c55e",margin:"0 0 8px",textTransform:"uppercase"}}>✨ Comprimido ({proposed.compressed_count}) · USD {proposed.compressed_fob.toFixed(2)}</p>
              <div style={{maxHeight:340,overflowY:"auto",background:"rgba(34,197,94,0.06)",borderRadius:6,padding:"6px 8px",border:"1px solid rgba(34,197,94,0.2)"}}>
                {proposed.groups.map((g,i)=><div key={i} style={{padding:"6px 0",fontSize:11,color:"#fff",borderBottom:i<proposed.groups.length-1?"1px solid rgba(255,255,255,0.06)":"none"}}>
                  <p style={{margin:"0 0 2px",fontWeight:700}}>{g.description}</p>
                  <p style={{margin:0,color:"rgba(255,255,255,0.55)",fontSize:10}}>{g.quantity}u × USD {g.unit_price_usd.toFixed(2)}{g.hs_code?` · ${g.hs_code}`:""} · merge de [{g.source_indices.join(",")}]</p>
                </div>)}
              </div>
            </div>
          </div>
          {proposed.critical_errors?.length>0&&<div style={{padding:"10px 14px",background:"rgba(255,80,80,0.12)",border:"1.5px solid rgba(255,80,80,0.4)",borderRadius:8,marginBottom:12}}>
            <p style={{fontSize:12,color:"#ff6b6b",margin:"0 0 6px",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em"}}>⛔ La IA falló — no se puede aplicar</p>
            {proposed.critical_errors.map((e,i)=><p key={i} style={{fontSize:11,color:"rgba(255,255,255,0.9)",margin:i>0?"4px 0 0":0}}>{e}</p>)}
            <p style={{fontSize:11,color:"rgba(255,255,255,0.55)",margin:"6px 0 0",fontStyle:"italic"}}>Tocá <strong>Re-comprimir</strong> para que la IA intente de nuevo. Si vuelve a fallar varias veces, ajustá la lista de items a mano (eliminá variantes muy parecidas).</p>
          </div>}
          {proposed.warnings?.length>0&&<div style={{padding:"8px 12px",background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:6,marginBottom:12}}>
            {proposed.warnings.map((w,i)=><p key={i} style={{fontSize:11,color:"#fbbf24",margin:i>0?"4px 0 0":0}}>⚠ {w}</p>)}
          </div>}
          <div style={{padding:"10px 12px",background:"rgba(251,146,60,0.06)",border:"1px solid rgba(251,146,60,0.25)",borderRadius:6,marginBottom:12}}>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.7)",margin:0}}>Al aplicar: se reemplazan los items en la <strong>factura del vuelo</strong> Y en la <strong>operación del cliente</strong>. Los originales se guardan como backup en <code>operations.items_backup_json</code> y el cliente los ve en una sección secundaria "Detalle original".</p>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>!applying&&setCompressState(null)} disabled={applying} style={{padding:"8px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.7)",cursor:applying?"not-allowed":"pointer"}}>Cancelar</button>
            <button onClick={()=>openCompressFor(compressState.opId,compressState.target)} disabled={applying} style={{padding:"8px 14px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(167,139,250,0.35)",background:"rgba(167,139,250,0.1)",color:"#a78bfa",cursor:applying?"not-allowed":"pointer"}}>🔄 Re-comprimir</button>
            <button onClick={applyCompress} disabled={applying||proposed.can_apply===false} title={proposed.can_apply===false?"La IA tuvo errores críticos. Tocá Re-comprimir.":"Aplicar y sincronizar"} style={{padding:"8px 18px",fontSize:12,fontWeight:700,borderRadius:8,border:`1px solid ${proposed.can_apply===false?"rgba(255,255,255,0.1)":IC}`,background:applying||proposed.can_apply===false?"rgba(255,255,255,0.05)":GOLD_GRADIENT,color:applying||proposed.can_apply===false?"rgba(255,255,255,0.4)":"#0A1628",cursor:applying?"wait":(proposed.can_apply===false?"not-allowed":"pointer")}}>{applying?"Aplicando…":(proposed.can_apply===false?"⛔ Bloqueado por errores":"✓ Aplicar y sincronizar")}</button>
          </div>
        </>}
      </div>
    </div>;})()}
    {confirmCostModal&&(()=>{const {newCost,newWeight}=confirmCostModal;const oldCost=Number(flight.total_cost_usd||0);const oldWeight=Number(flight.total_weight_kg||0);const costDelta=newCost-oldCost;const weightDelta=newWeight-oldWeight;return <div onClick={()=>!savingCost&&setConfirmCostModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1.5px solid rgba(184,149,106,0.4)",borderRadius:14,padding:"22px 24px",maxWidth:480,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:14}}>
          <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>💾 Actualizar despacho de {flight.flight_code}</h3>
          <button onClick={()=>!savingCost&&setConfirmCostModal(null)} disabled={savingCost} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:savingCost?"not-allowed":"pointer",padding:0,lineHeight:1}}>×</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8}}>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase"}}>Costo total</p>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",margin:0,textDecoration:"line-through"}}>USD {oldCost.toFixed(2)}</p>
            <p style={{fontSize:18,fontWeight:700,color:IC,margin:"2px 0 0"}}>USD {newCost.toFixed(2)}</p>
            {costDelta!==0&&<p style={{fontSize:11,color:costDelta>0?"#fbbf24":"#22c55e",margin:"2px 0 0",fontWeight:600}}>{costDelta>0?"+":""}{costDelta.toFixed(2)}</p>}
          </div>
          <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8}}>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase"}}>Peso total</p>
            <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",margin:0,textDecoration:"line-through"}}>{oldWeight.toFixed(2)} kg</p>
            <p style={{fontSize:18,fontWeight:700,color:IC,margin:"2px 0 0"}}>{newWeight.toFixed(2)} kg</p>
            {weightDelta!==0&&<p style={{fontSize:11,color:"#fbbf24",margin:"2px 0 0",fontWeight:600}}>{weightDelta>0?"+":""}{weightDelta.toFixed(2)} kg</p>}
          </div>
        </div>
        <div style={{padding:"10px 12px",background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:8,marginBottom:14}}>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.75)",margin:0,lineHeight:1.5}}>Se va a recalcular <code>cost_flete</code> en cada operación del vuelo proporcional al peso de cada una. Si el método de pago es cuenta corriente, también se actualiza el movimiento de la CC del agente.</p>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>!savingCost&&setConfirmCostModal(null)} disabled={savingCost} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.7)",cursor:savingCost?"not-allowed":"pointer"}}>Cancelar</button>
          <button onClick={saveCost} disabled={savingCost} style={{padding:"9px 18px",fontSize:13,fontWeight:700,borderRadius:8,border:`1px solid ${IC}`,background:savingCost?"rgba(255,255,255,0.05)":GOLD_GRADIENT,color:savingCost?"rgba(255,255,255,0.4)":"#0A1628",cursor:savingCost?"wait":"pointer"}}>{savingCost?"Actualizando…":"✓ Sí, actualizar"}</button>
        </div>
      </div>
    </div>;})()}
    {showDeleteFlightModal&&<div onClick={()=>!deletingFlight&&setShowDeleteFlightModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1.5px solid rgba(255,80,80,0.4)",borderRadius:14,padding:"22px 24px",maxWidth:480,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:14}}>
          <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>🗑 Eliminar vuelo {flight.flight_code}</h3>
          <button onClick={()=>!deletingFlight&&setShowDeleteFlightModal(false)} disabled={deletingFlight} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:deletingFlight?"not-allowed":"pointer",padding:0,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:"12px 14px",background:"rgba(255,80,80,0.06)",border:"1px solid rgba(255,80,80,0.2)",borderRadius:10,marginBottom:14}}>
          <p style={{fontSize:12,fontWeight:700,color:"#ff6b6b",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.05em"}}>⚠ Esta acción no se puede deshacer</p>
          <ul style={{margin:0,paddingLeft:18,listStyle:"disc"}}>
            <li style={{fontSize:13,color:"rgba(255,255,255,0.85)",marginBottom:4}}>Las <strong style={{color:"#fff"}}>{flightOps.length} operaciones</strong> vuelven al depósito</li>
            <li style={{fontSize:13,color:"rgba(255,255,255,0.85)",marginBottom:4}}>Se borran los <strong style={{color:"#fff"}}>items de factura</strong> ya cargados</li>
            <li style={{fontSize:13,color:"rgba(255,255,255,0.85)",marginBottom:0}}>Se elimina el vuelo</li>
          </ul>
        </div>
        <p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:"0 0 14px"}}>Los <strong style={{color:"#fff"}}>bultos de cada op no se tocan</strong> — quedan donde están. Solo cambia el status de las ops.</p>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>!deletingFlight&&setShowDeleteFlightModal(false)} disabled={deletingFlight} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.7)",cursor:deletingFlight?"not-allowed":"pointer"}}>Cancelar</button>
          <button onClick={deleteFlight} disabled={deletingFlight} style={{padding:"9px 18px",fontSize:13,fontWeight:700,borderRadius:8,border:"1px solid rgba(255,80,80,0.5)",background:deletingFlight?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#ff6b6b,#ef4444)",color:deletingFlight?"rgba(255,255,255,0.4)":"#fff",cursor:deletingFlight?"wait":"pointer"}}>{deletingFlight?"Eliminando…":"🗑 Sí, eliminar vuelo"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

function AnticipoForm({token,agentId,onSaved}){
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [amount,setAmount]=useState("");
  const [received,setReceived]=useState("");
  const [desc,setDesc]=useState("");
  const [saving,setSaving]=useState(false);
  const paid=Number(amount||0);const recv=Number(received||paid);const comision=Math.max(0,paid-recv);
  const save=async()=>{
    if(!amount)return;setSaving(true);
    const body={agent_id:agentId,date,type:"anticipo",amount_usd:paid,amount_received_usd:received?recv:null,description:desc||"Anticipo"};
    await dq("agent_account_movements",{method:"POST",token,body});
    // Si hay diferencia → auto-crear gasto categoría comisiones
    if(comision>0){
      await dq("finance_entries",{method:"POST",token,body:{date,type:"gasto",category:"comisiones",detail:`Comisión transferencia anticipo agente${desc?` (${desc})`:""}`,description:`Comisiones — Comisión transferencia anticipo agente${desc?` (${desc})`:""}`,amount:comision,currency:"USD",payment_method:"transferencia",is_paid:true,auto_generated:false}});
    }
    setSaving(false);onSaved();
  };
  return <div style={{background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.15)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 2fr 1fr",gap:10,alignItems:"end"}}>
      <Inp label="Fecha" type="date" value={date} onChange={setDate}/>
      <Inp label="Monto que pagué (USD)" type="number" value={amount} onChange={setAmount} step="0.01"/>
      <Inp label="Monto que recibió (USD)" type="number" value={received} onChange={setReceived} step="0.01" placeholder={amount||"= pagado"}/>
      <Inp label="Descripción" value={desc} onChange={setDesc} placeholder="Ej: Pago vuelo FL-0003"/>
      <Btn small onClick={save} disabled={saving||!amount}>{saving?"...":"Guardar"}</Btn>
    </div>
    {comision>0&&<p style={{fontSize:11,color:"#fbbf24",margin:"8px 0 0"}}>↳ Se generará gasto Comisiones por USD {comision.toFixed(2)}</p>}
  </div>;
}

function AgentsPanel({token}){
  const [tab,setTab]=useState("deposito");
  const [signups,setSignups]=useState([]);
  const [profiles,setProfiles]=useState({});
  const [unassigned,setUnassigned]=useState([]);
  const [allOps,setAllOps]=useState([]);
  const [depositOps,setDepositOps]=useState([]);
  const [depositPkgs,setDepositPkgs]=useState([]);
  const [flights,setFlights]=useState([]);
  const [flightOps,setFlightOps]=useState([]);
  const [invoiceItems,setInvoiceItems]=useState([]);
  const [accMovements,setAccMovements]=useState([]);
  const [selectedOps,setSelectedOps]=useState([]);
  const [opsWithDocs,setOpsWithDocs]=useState(new Set());
  const [selFlight,setSelFlight]=useState(null);
  const [showAnticipoForm,setShowAnticipoForm]=useState(null);
  const [expandedOp,setExpandedOp]=useState(null);
  const [depositItems,setDepositItems]=useState([]);
  const [repackReqs,setRepackReqs]=useState([]);
  const [lo,setLo]=useState(true);
  const [msg,setMsg]=useState("");
  const load=async()=>{setLo(true);
    const [r,u,o,depOps,depPkgs,fl,flOps,fii,accM,depItems,rpkReqs]=await Promise.all([
      dq("agent_signups",{token,filters:"?select=*&order=created_at.desc"}),
      dq("unassigned_packages",{token,filters:"?select=*&assigned_to_op_id=is.null&order=created_at.desc"}),
      dq("operations",{token,filters:"?select=id,operation_code,client_id,clients(client_code,first_name,last_name,tax_condition)&channel=eq.aereo_blanco&status=in.(en_deposito_origen,en_preparacion)&consolidation_confirmed=eq.false&order=created_at.desc"}),
      dq("operations",{token,filters:"?select=id,operation_code,description,client_id,created_by_agent_id,status,consolidation_confirmed,origin,deposit_notified,deposit_notified_at,clients(client_code,first_name,last_name,whatsapp,tax_condition)&channel=eq.aereo_blanco&status=in.(en_deposito_origen,en_preparacion)&order=created_at.desc"}),
      dq("operation_packages",{token,filters:"?select=*&order=package_number.asc"}),
      dq("flights",{token,filters:"?select=*&order=created_at.desc"}),
      dq("flight_operations",{token,filters:"?select=*"}),
      dq("flight_invoice_items",{token,filters:"?select=*&order=sort_order.asc"}),
      dq("agent_account_movements",{token,filters:"?select=*&order=date.desc,created_at.desc"}),
      dq("operation_items",{token,filters:"?select=*&order=created_at.asc"}),
      dq("repack_requests",{token,filters:"?select=*&order=requested_at.desc"})
    ]);
    setSignups(Array.isArray(r)?r:[]);setUnassigned(Array.isArray(u)?u:[]);setAllOps(Array.isArray(o)?o:[]);
    setDepositOps(Array.isArray(depOps)?depOps:[]);setDepositPkgs(Array.isArray(depPkgs)?depPkgs:[]);
    setFlights(Array.isArray(fl)?fl:[]);setFlightOps(Array.isArray(flOps)?flOps:[]);setInvoiceItems(Array.isArray(fii)?fii:[]);setAccMovements(Array.isArray(accM)?accM:[]);
    setDepositItems(Array.isArray(depItems)?depItems:[]);
    setRepackReqs(Array.isArray(rpkReqs)?rpkReqs:[]);
    // Set de ops que tienen al menos un item (documentación completa)
    const idsWithItems=new Set((Array.isArray(depItems)?depItems:[]).map(i=>i.operation_id));
    setOpsWithDocs(idsWithItems);
    const ids=(Array.isArray(r)?r:[]).map(s=>s.auth_user_id).filter(Boolean);
    if(ids.length>0){const pr=await dq("profiles",{token,filters:`?id=in.(${ids.join(",")})&select=id,role`});const m={};(Array.isArray(pr)?pr:[]).forEach(p=>{m[p.id]=p;});setProfiles(m);}
    setLo(false);};
  useEffect(()=>{load();},[token]);
  // Helpers
  const approvedAgents=signups.filter(s=>s.status==="approved");
  const opsInFlightIds=new Set(flightOps.map(fo=>fo.operation_id));
  const availableForFlight=depositOps.filter(o=>o.consolidation_confirmed&&!opsInFlightIds.has(o.id)&&opsWithDocs.has(o.id));
  const opPackages=(opId)=>depositPkgs.filter(p=>p.operation_id===opId);
  // Repack request por op (la más reciente, si existe)
  const repackReqOf=(opId)=>repackReqs.find(r=>r.operation_id===opId);
  // ---- Modal moderno para pedir reempaque (reemplaza el prompt() feo) ----
  const [repackModal,setRepackModal]=useState(null); // {op, billable, pkgs, reason, sending}
  const openRepackModal=(op)=>{
    if(!op.created_by_agent_id){flash("Op sin agente asignado");return;}
    const pkgs=opPackages(op.id);
    if(pkgs.length===0){flash("La op no tiene bultos");return;}
    const existing=repackReqOf(op.id);
    if(existing&&existing.status==="pending"){flash("Ya hay un pedido de reempaque pendiente");return;}
    const opAgent=signups.find(s=>s.auth_user_id===op.created_by_agent_id);
    const opVolDiv=Number(opAgent?.volumetric_divisor)||5000;
    const billable=pkgs.reduce((s,p)=>{const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);const b=gw*q;const v=l&&w&&h?((l*w*h)/opVolDiv)*q:0;return s+Math.max(b,v);},0);
    setRepackModal({op,pkgs,billable,reason:"",sending:false});
  };
  const submitRepack=async()=>{
    if(!repackModal)return;
    const {op,pkgs,billable,reason}=repackModal;
    setRepackModal(s=>({...s,sending:true}));
    try{
      await dq("repack_requests",{method:"POST",token,body:{operation_id:op.id,status:"pending",reason:reason.trim()||null,original_billable_kg:Number(billable.toFixed(2)),original_pkg_count:pkgs.length}});
      try{await dq("op_communications",{method:"POST",token,body:{operation_id:op.id,type:"note",content:`🔄 Pedido de reempaque al agente.\nPeso facturable actual: ${billable.toFixed(2)} kg (${pkgs.length} bultos)${reason.trim()?`\nMotivo: ${reason.trim()}`:""}`}});}catch(e){}
      fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:op.created_by_agent_id,title:`🔄 Pedido de reempaque ${op.operation_code}`,body:reason.trim()||`Reempaquetar para bajar volumétrico (${billable.toFixed(1)} kg)`,url:"/agente?tab=deposit"})}).catch(()=>{});
      setRepackModal(null);
      flash(`✅ Pedido de reempaque enviado al agente para ${op.operation_code}`);
      load();
    }catch(e){
      setRepackModal(s=>({...s,sending:false}));
      flash(`❌ ${e.message}`);
    }
  };
  // Backwards-compat: alias para el botón existente
  const requestRepackForOp=openRepackModal;
  // Mover bulto a otro cliente (caso típico: agente lo cargó al cliente equivocado)
  // Modal: pide cliente. Si tiene op abierta en depósito → suma ahí. Si no → crea nueva op (mismo agente/canal/origen).
  const [movePkgState,setMovePkgState]=useState(null); // {pkg, fromOp}
  const [moveClients,setMoveClients]=useState([]);
  const [moveSearch,setMoveSearch]=useState("");
  const [moveSelClient,setMoveSelClient]=useState(null);
  const [moveSaving,setMoveSaving]=useState(false);
  const openMoveModal=async(pkg,fromOp)=>{
    setMovePkgState({pkg,fromOp});setMoveSearch("");setMoveSelClient(null);
    if(moveClients.length===0){
      const r=await dq("clients",{token,filters:"?select=id,client_code,first_name,last_name&order=client_code.asc"});
      setMoveClients(Array.isArray(r)?r:[]);
    }
  };
  const closeMoveModal=()=>{setMovePkgState(null);setMoveSelClient(null);setMoveSearch("");};
  // Para el cliente seleccionado: busca su op abierta más reciente en depósito (en_deposito_origen / en_preparacion)
  // SPLIT (mismo cliente) → SIEMPRE crea op nueva, jamás fusiona.
  // Otro cliente → busca op abierta del cliente destino DEL MISMO AGENTE que la op origen.
  // Si no hay → crea op nueva preservando el agente de la op origen.
  const isSameClient=moveSelClient&&movePkgState&&moveSelClient.id===movePkgState.fromOp.client_id;
  const moveTargetOp=moveSelClient&&movePkgState&&!isSameClient
    ?[...allOps,...depositOps].find(o=>o.client_id===moveSelClient.id&&o.id!==movePkgState.fromOp.id&&o.created_by_agent_id===movePkgState.fromOp.created_by_agent_id)
    :null;
  const executeMove=async()=>{
    if(!moveSelClient||!movePkgState)return;
    const {pkg,fromOp}=movePkgState;
    // Mismo cliente está OK = split. La condición vital es que destino ≠ op origen, lo asegura moveTargetOp.
    setMoveSaving(true);
    let destOpId=moveTargetOp?.id;let destCode=moveTargetOp?.operation_code;
    if(!destOpId){
      // Crear nueva op para el cliente destino, copiando metadata de la op origen
      const rpc=await dq("rpc/next_operation_code",{method:"POST",token,body:{}});
      const newCode=typeof rpc==="string"?rpc:null;
      if(!newCode){flash("❌ No pude generar código");setMoveSaving(false);return;}
      const r=await dq("operations",{method:"POST",token,body:{operation_code:newCode,client_id:moveSelClient.id,channel:fromOp.channel||"aereo_blanco",status:"en_deposito_origen",origin:fromOp.origin||"China",created_by_agent_id:fromOp.created_by_agent_id||null}});
      const created=Array.isArray(r)?r[0]:r;
      if(!created?.id){flash("❌ No pude crear op");setMoveSaving(false);return;}
      destOpId=created.id;destCode=newCode;
    }
    // Renumerar en la op destino
    const destPkgs=await dq("operation_packages",{token,filters:`?operation_id=eq.${destOpId}&select=package_number`});
    const maxNum=Array.isArray(destPkgs)&&destPkgs.length>0?Math.max(...destPkgs.map(p=>Number(p.package_number||0))):0;
    await dq("operation_packages",{method:"PATCH",token,filters:`?id=eq.${pkg.id}`,body:{operation_id:destOpId,package_number:maxNum+1}});
    setMoveSaving(false);closeMoveModal();
    flash(`✓ Bulto movido a ${destCode} (${moveSelClient.client_code})`);
    load();
  };
  // Peso facturable: max(bruto, volumétrico) por bulto, sumado. Usa divisor del agente (default 5000).
  const opWeight=(opId)=>{
    const pkgs=opPackages(opId);
    const op=depositOps.find(o=>o.id===opId)||allOps.find(o=>o.id===opId);
    const agentId=op?.created_by_agent_id;
    const agent=signups.find(s=>s.auth_user_id===agentId);
    const div=Number(agent?.volumetric_divisor)||5000;
    return pkgs.reduce((s,p)=>{
      const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0);
      const l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);
      const bruto=gw*q;
      const vol=l&&w&&h?((l*w*h)/div)*q:0;
      return s+Math.max(bruto,vol);
    },0);
  };
  const opGrossWeight=(opId)=>opPackages(opId).reduce((s,p)=>s+(Number(p.gross_weight_kg||0)*Number(p.quantity||1)),0);
  const agentBalance=(agentId)=>accMovements.filter(m=>m.agent_id===agentId).reduce((s,m)=>s+(m.type==="anticipo"?Number(m.amount_usd):-Number(m.amount_usd)),0);
  const toggleSelOp=(opId)=>setSelectedOps(p=>p.includes(opId)?p.filter(x=>x!==opId):[...p,opId]);
  const createFlight=async()=>{
    if(selectedOps.length===0)return;
    const ops=availableForFlight.filter(o=>selectedOps.includes(o.id));
    const agentIds=[...new Set(ops.map(o=>o.created_by_agent_id))];
    if(agentIds.length>1){alert("Solo podés agrupar ops del MISMO agente. Las que seleccionaste son de varios agentes distintos.");return;}
    const agentId=agentIds[0];
    if(!agentId){alert("Las ops seleccionadas no tienen agente asignado");return;}
    const lastFl=flights[0];
    const lastNum=lastFl?parseInt(lastFl.flight_code.replace(/\D/g,""),10)||0:0;
    const newCode=`FL-${String(lastNum+1).padStart(4,"0")}`;
    const r=await dq("flights",{method:"POST",token,body:{flight_code:newCode,agent_id:agentId,status:"preparando"}});
    const created=Array.isArray(r)?r[0]:r;
    if(!created?.id){alert("Error creando vuelo");return;}
    for(const op of ops){const w=opWeight(op.id);
      await dq("flight_operations",{method:"POST",token,body:{flight_id:created.id,operation_id:op.id,weight_kg:w}});
      // Clonar los operation_items del cliente como items de factura (base editable)
      const items=await dq("operation_items",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`});
      let sort=0;for(const it of (Array.isArray(items)?items:[])){sort++;
        await dq("flight_invoice_items",{method:"POST",token,body:{flight_id:created.id,operation_id:op.id,source_item_id:it.id,description:it.description||"",quantity:Number(it.quantity||1),unit_price_declared_usd:Number(it.unit_price_usd||0),hs_code:it.ncm_code||"",sort_order:sort}});
      }
    }
    // Notification #1: notify agent about new flight
    try{await dq("notifications",{method:"POST",token,body:{user_id:agentId,portal:"agente",title:`Nuevo vuelo ${newCode} creado`,body:`${ops.length} operaciones asignadas`,link:"?tab=active_flights"}});}catch(e){console.error("notif error",e);}
    try{fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:agentId,title:`Nuevo vuelo ${newCode} creado`,body:`${ops.length} operaciones asignadas`,url:"/agente?tab=active_flights"})});}catch(e){}
    // Notification #2: notify each client whose op is in this flight (in-app + push)
    try{
      const opIds=ops.map(o=>o.id);
      const opsWithClients=await dq("operations",{token,filters:`?id=in.(${opIds.join(",")})&select=id,operation_code,client_id,clients(auth_user_id)`});
      for(const op of (Array.isArray(opsWithClients)?opsWithClients:[])){
        const userId=op.clients?.auth_user_id;
        if(!userId)continue;
        const title=`✈️ Tu operación ${op.operation_code} fue asignada al vuelo ${newCode}`;
        const body="Estamos preparando la documentación. Te avisamos cuando despegue.";
        dq("notifications",{method:"POST",token,body:{user_id:userId,portal:"cliente",title,body,link:`?op=${op.operation_code}`}}).catch(e=>console.error("notif client",e));
        fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:userId,title,body,url:`/portal?op=${op.operation_code}`})}).catch(()=>{});
      }
    }catch(e){console.error("notif clients error",e);}
    setSelectedOps([]);load();flash(`Vuelo ${newCode} creado con factura base. Clientes y agente notificados.`);setTab("flights");setSelFlight(created.id);
  };
  const assignToOp=async(pkg,opId)=>{
    if(!opId)return;
    // Fetch op to get next package_number
    const opPkgs=await dq("operation_packages",{token,filters:`?operation_id=eq.${opId}&select=package_number&order=package_number.desc&limit=1`});
    const lastNum=Array.isArray(opPkgs)&&opPkgs[0]?Number(opPkgs[0].package_number)||0:0;
    const body={operation_id:opId,package_number:lastNum+1,quantity:pkg.quantity||1,national_tracking:pkg.national_tracking};
    if(pkg.gross_weight_kg)body.gross_weight_kg=pkg.gross_weight_kg;
    if(pkg.length_cm)body.length_cm=pkg.length_cm;
    if(pkg.width_cm)body.width_cm=pkg.width_cm;
    if(pkg.height_cm)body.height_cm=pkg.height_cm;
    await dq("operation_packages",{method:"POST",token,body});
    await dq("unassigned_packages",{method:"PATCH",token,filters:`?id=eq.${pkg.id}`,body:{assigned_to_op_id:opId,assigned_at:new Date().toISOString()}});
    load();flash("Asignado a operación");
  };
  const delUnassigned=async(id)=>{if(!confirm("¿Eliminar este paquete huérfano?"))return;await dq("unassigned_packages",{method:"DELETE",token,filters:`?id=eq.${id}`});load();flash("Eliminado");};
  const flash=(m)=>{setMsg(m);setTimeout(()=>setMsg(""),2500);const v=/^[❌✕]|falló|error/i.test(m)?"error":/^⚠/.test(m)?"warn":"success";toast(m.replace(/^[✓✉️❌⚠️✕★📧⭐]\s*/u,""),v);};
  const approve=async(s)=>{
    // Update profile role to agente
    const prof=profiles[s.auth_user_id];
    if(prof){await dq("profiles",{method:"PATCH",token,filters:`?id=eq.${s.auth_user_id}`,body:{role:"agente"}});}
    else {await dq("profiles",{method:"POST",token,body:{id:s.auth_user_id,role:"agente"}});}
    await dq("agent_signups",{method:"PATCH",token,filters:`?id=eq.${s.id}`,body:{status:"approved",approved_at:new Date().toISOString()}});
    load();flash("Agente aprobado");
  };
  const reject=async(s)=>{if(!confirm(`¿Rechazar a ${s.email}?`))return;await dq("agent_signups",{method:"PATCH",token,filters:`?id=eq.${s.id}`,body:{status:"rejected"}});load();flash("Agente rechazado");};
  const ST={pending:{l:"Pendiente",c:"#fbbf24"},approved:{l:"Aprobado",c:"#22c55e"},rejected:{l:"Rechazado",c:"#ff6b6b"}};
  const flight=flights.find(f=>f.id===selFlight);
  const flightOpsForSel=flight?flightOps.filter(fo=>fo.flight_id===flight.id):[];
  const usd=(v)=>`USD ${Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div><h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 4px",letterSpacing:"-0.02em"}}>Agentes y Vuelos</h2><p style={{fontSize:13,color:"rgba(255,255,255,0.45)",margin:0}}>Depósito, vuelos consolidados, cuentas corrientes y solicitudes</p></div>
    </div>
    {msg&&<p style={{fontSize:12,color:"#22c55e",fontWeight:600,marginBottom:12,animation:"ac_fade_in 200ms"}}>✓ {msg}</p>}
    <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid rgba(255,255,255,0.06)",flexWrap:"wrap"}}>
      {[{k:"deposito",l:"Depósito",n:depositOps.length},{k:"flights",l:"Vuelos",n:flights.length},{k:"accounts",l:"CC Agentes",n:approvedAgents.length},{k:"signups",l:"Solicitudes"},{k:"orphans",l:"Huérfanos",n:unassigned.length}].map(tb=>{const active=tab===tb.k;return <button key={tb.k} onClick={()=>{setTab(tb.k);setSelFlight(null);}} style={{padding:"10px 16px",fontSize:12,fontWeight:active?700:600,border:"none",background:"transparent",color:active?GOLD_LIGHT:"rgba(255,255,255,0.5)",cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase",borderBottom:`2px solid ${active?GOLD:"transparent"}`,marginBottom:-1,transition:"all 150ms",display:"inline-flex",alignItems:"center",gap:6}} onMouseEnter={e=>{if(!active)e.currentTarget.style.color="rgba(255,255,255,0.8)";}} onMouseLeave={e=>{if(!active)e.currentTarget.style.color="rgba(255,255,255,0.5)";}}>{tb.l}{tb.n!==undefined&&<span style={{fontSize:10,fontWeight:700,color:active?GOLD_LIGHT:"rgba(255,255,255,0.35)",fontVariantNumeric:"tabular-nums"}}>{tb.n}</span>}</button>;})}
    </div>

    {tab==="deposito"&&(()=>{
      // Filtrar: ops que ya están asignadas a un vuelo (despachado o no) NO aparecen acá
      const trulyInDeposit=depositOps.filter(o=>!opsInFlightIds.has(o.id));
      // Score de orden: 0=listo (confirmed+docs), 1=esperando docs (confirmed+sin docs), 2=esperando más (no confirmed)
      const orderScore=(o)=>{
        if(o.consolidation_confirmed&&opsWithDocs.has(o.id))return 0; // listo arriba
        if(o.consolidation_confirmed&&!opsWithDocs.has(o.id))return 1; // documentación medio
        return 2; // esperando más paquetes abajo
      };
      // Agrupar por agente y ordenar dentro
      const byAgent={};trulyInDeposit.forEach(o=>{const k=o.created_by_agent_id||"sin_agente";if(!byAgent[k])byAgent[k]={ops:[],agentName:""};byAgent[k].ops.push(o);});
      Object.keys(byAgent).forEach(k=>{
        const a=approvedAgents.find(s=>s.auth_user_id===k);byAgent[k].agentName=a?(a.first_name+" "+(a.last_name||"")):"(sin agente)";
        byAgent[k].ops.sort((a,b)=>orderScore(a)-orderScore(b)||(b.created_at||"").localeCompare(a.created_at||""));
      });
      return <div>
        {selectedOps.length>0&&(()=>{
          const selObjs=depositOps.filter(o=>selectedOps.includes(o.id));
          const riOps=selObjs.filter(o=>o.clients?.tax_condition==="responsable_inscripto");
          return <div style={{padding:"12px 16px",background:"rgba(184,149,106,0.08)",border:"1px solid rgba(184,149,106,0.25)",borderRadius:10,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <p style={{fontSize:13,color:"#fff",margin:0,fontWeight:600}}>{selectedOps.length} operación(es) seleccionada(s)</p>
                {riOps.length>0&&<span title={"Clientes RI: "+riOps.map(o=>o.clients?.client_code).join(", ")} style={{fontSize:10,fontWeight:800,padding:"4px 10px",borderRadius:6,background:"rgba(96,165,250,0.15)",color:"#60a5fa",border:"1px solid rgba(96,165,250,0.4)",letterSpacing:"0.05em"}}>⚠ {riOps.length} RI · facturar con CUIT</span>}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn variant="secondary" small onClick={()=>setSelectedOps([])}>Limpiar</Btn>
                <Btn small onClick={createFlight}>+ Crear vuelo con seleccionadas</Btn>
              </div>
            </div>
            {riOps.length>0&&<p style={{fontSize:11,color:"rgba(96,165,250,0.85)",margin:"8px 0 0",lineHeight:1.5}}>Hay clientes Responsable Inscripto en este vuelo. Recordá emitir factura A con su CUIT y aplicar el régimen impositivo correspondiente.</p>}
          </div>;
        })()}
        {Object.keys(byAgent).length===0&&<p style={{color:"rgba(255,255,255,0.45)",textAlign:"center",padding:"3rem 0"}}>No hay paquetes en depósito</p>}
        {Object.entries(byAgent).map(([agentId,grp])=>{return <div key={agentId} style={{marginBottom:20}}>
          <h3 style={{fontSize:13,fontWeight:700,color:IC,margin:"0 0 10px",textTransform:"uppercase"}}>{grp.agentName} ({grp.ops.length} ops)</h3>
          <div style={{background:"rgba(255,255,255,0.028)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                {["✓","Op","Cliente","Mercadería","Bultos","Peso","Estado","Consolidación","WA"].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}
              </tr></thead>
              <tbody>{grp.ops.map(o=>{const inFlight=opsInFlightIds.has(o.id);const w=opWeight(o.id);const opPkgs=opPackages(o.id);const pkgsCount=opPkgs.length;const lastPkgAt=opPkgs.reduce((mx,p)=>{const t=p.created_at?new Date(p.created_at).getTime():0;return t>mx?t:mx;},0);const hasDocs=opsWithDocs.has(o.id);const canSelect=o.consolidation_confirmed&&hasDocs&&!inFlight;const isExpanded=expandedOp===o.id;return <Fragment key={o.id}><tr style={{borderBottom:isExpanded?"none":"1px solid rgba(255,255,255,0.04)",opacity:canSelect?1:inFlight?0.5:0.7,cursor:"pointer",background:isExpanded?"rgba(184,149,106,0.06)":"transparent",transition:"background 150ms"}} onClick={(e)=>{if(e.target.tagName==="INPUT"||e.target.tagName==="BUTTON"||e.target.closest("button"))return;setExpandedOp(isExpanded?null:o.id);}} onMouseEnter={e=>{if(!isExpanded)e.currentTarget.style.background="rgba(255,255,255,0.03)";}} onMouseLeave={e=>{if(!isExpanded)e.currentTarget.style.background="transparent";}}>
                <td style={{padding:"10px 12px"}}>{canSelect?(()=>{const isChecked=selectedOps.includes(o.id);return <label onClick={e=>e.stopPropagation()} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative",width:20,height:20}}>
                  <input type="checkbox" checked={isChecked} onChange={()=>toggleSelOp(o.id)} style={{position:"absolute",opacity:0,width:0,height:0,pointerEvents:"none"}}/>
                  <span style={{width:18,height:18,borderRadius:5,border:isChecked?`1.5px solid ${IC}`:"1.5px solid rgba(255,255,255,0.25)",background:isChecked?GOLD_GRADIENT:"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 150ms",boxShadow:isChecked?GOLD_GLOW:"none"}}>
                    {isChecked&&<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="#0A1628" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </span>
                </label>;})():<span style={{color:"rgba(255,255,255,0.3)",fontSize:14}}>{isExpanded?"▾":"▸"}</span>}</td>
                <td style={{padding:"10px 12px",fontFamily:"monospace",fontWeight:600,color:"#fff",fontSize:12}}>{o.operation_code}</td>
                <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.7)"}}>{o.clients?<span style={{display:"inline-flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>{`${o.clients.client_code} - ${o.clients.first_name}`}{o.clients.tax_condition==="responsable_inscripto"&&<span title="Cliente Responsable Inscripto" style={{fontSize:9,fontWeight:800,padding:"2px 6px",borderRadius:4,background:"rgba(96,165,250,0.18)",color:"#60a5fa",border:"1px solid rgba(96,165,250,0.4)",letterSpacing:"0.05em"}}>RI</span>}</span>:"—"}</td>
                <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.5)",maxWidth:240}}>{(()=>{
                  // Si la op tiene description manual, usala. Si no, usar items declarados por el cliente.
                  if(o.description&&o.description.trim())return <span title={o.description} style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.description}</span>;
                  const opItems=depositItems.filter(i=>i.operation_id===o.id);
                  if(opItems.length===0)return <span style={{color:"rgba(255,255,255,0.3)",fontStyle:"italic"}}>Sin productos</span>;
                  const first=opItems[0].description||"Producto";
                  const more=opItems.length-1;
                  const fullList=opItems.map(it=>it.description||"—").join(" · ");
                  return <span title={fullList} style={{display:"block"}}><span style={{display:"inline-block",maxWidth:more>0?160:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",verticalAlign:"middle"}}>{first}</span>{more>0&&<span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"rgba(184,149,106,0.15)",color:IC,marginLeft:6,verticalAlign:"middle"}}>+{more}</span>}</span>;
                })()}</td>
                <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.6)",lineHeight:1.3}}>
                  {pkgsCount}
                  {lastPkgAt>0&&<><br/><span title="Fecha del último bulto cargado en depósito" style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:500}}>{new Date(lastPkgAt).toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span></>}
                </td>
                <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.6)"}}>{w?`${w.toFixed(2)} kg`:"—"}</td>
                <td style={{padding:"10px 12px"}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)"}}>{SM[o.status]?.l||o.status}</span></td>
                <td style={{padding:"10px 12px"}}>
                  {inFlight?<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:"rgba(184,149,106,0.15)",color:IC}}>EN VUELO</span>:
                  o.consolidation_confirmed&&opsWithDocs.has(o.id)?<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:"rgba(34,197,94,0.15)",color:"#22c55e"}}>✓ LISTO</span>:
                  o.consolidation_confirmed&&!opsWithDocs.has(o.id)?<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:"rgba(249,115,22,0.15)",color:"#f97316"}}>📋 DOCS PENDIENTES</span>:
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:"rgba(251,191,36,0.15)",color:"#fbbf24"}}>⏳ ESPERANDO</span>}
                </td>
                <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>{(()=>{
                  const clientWa=o.clients?.whatsapp?String(o.clients.whatsapp).replace(/[^0-9]/g,""):"";
                  const clientName=(o.clients?.first_name||"Cliente").trim().split(/\s+/)[0];
                  if(o.deposit_notified){return <span title={`Notificado ${formatDate(o.deposit_notified_at)}`} style={{fontSize:14,cursor:"default"}}>✅</span>;}
                  const origenTxt=o.origin==="USA"?"Estados Unidos":o.origin==="China"?"China":(o.origin||"origen");
                  const pkgs=opPackages(o.id);
                  const opAgent=signups.find(s=>s.auth_user_id===o.created_by_agent_id);const opVolDiv=Number(opAgent?.volumetric_divisor)||5000;
                  const trackingsDetail=pkgs.filter(p=>p.national_tracking?.trim()).map(p=>{const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);const b=gw*q;const v=l&&w&&h?((l*w*h)/opVolDiv)*q:0;const pf=Math.max(b,v);return `- Bulto ${p.package_number}${pf>0?` (${pf.toFixed(2)} kg facturables)`:""}: ${p.national_tracking}`;}).join("\n");
                  const msg=`Hola ${clientName}!\n\nRecibimos tu mercadería en nuestro depósito en ${origenTxt}.${trackingsDetail?`\n\n*Tracking del paquete:*\n${trackingsDetail}`:""}\n\nPara avanzar con la operación, necesitamos que completes la documentación de la carga (mercadería, cantidad, valor declarado).\n\nIngresá acá:\nhttps://argencargo.com.ar/portal?op=${o.operation_code}\n\nUna vez completado, te confirmamos el presupuesto final y avanzamos con el envío.\n\nCualquier duda escribime y desde ya muchas gracias!\nArgencargo`;
                  const waUrl=clientWa?`https://api.whatsapp.com/send?phone=${clientWa}&text=${encodeURIComponent(msg)}`:"";
                  return <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:14}}>❌</span>
                    <button disabled={!clientWa} title={clientWa?`Enviar WA a ${clientWa}`:"Sin número de WhatsApp"} onClick={async(e)=>{e.stopPropagation();window.open(waUrl,"_blank");await dq("operations",{method:"PATCH",token,filters:`?id=eq.${o.id}`,body:{deposit_notified:true,deposit_notified_at:new Date().toISOString()}});load();}} style={{padding:"3px 8px",fontSize:11,fontWeight:700,borderRadius:6,border:"none",cursor:clientWa?"pointer":"not-allowed",opacity:clientWa?1:0.4,background:"#25D366",color:"#fff",display:"inline-flex",alignItems:"center",gap:4}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.336 0-4.512-.767-6.262-2.063l-.437-.341-2.938.985.985-2.938-.341-.437A9.955 9.955 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                      WA
                    </button>
                  </span>;
                })()}</td>
              </tr>
              {isExpanded&&(()=>{
                const itemsOfOp=depositItems.filter(i=>i.operation_id===o.id);
                const pkgsOfOp=opPackages(o.id);
                const totalFob=itemsOfOp.reduce((s,i)=>s+Number(i.unit_price_usd||0)*Number(i.quantity||1),0);
                const rpk=repackReqOf(o.id);
                const canRepack=o.created_by_agent_id&&pkgsOfOp.length>0&&!["operacion_cerrada","cancelada","en_transito","arribo_argentina","en_aduana","entregada"].includes(o.status)&&(!rpk||rpk.status!=="pending");
                return <tr><td colSpan={9} style={{padding:0,borderBottom:"1px solid rgba(184,149,106,0.2)"}}>
                  <div style={{padding:"16px 18px",background:"rgba(184,149,106,0.04)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Detalle de {o.operation_code}</span>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {rpk?.status==="pending"&&<span style={{fontSize:11,fontWeight:700,padding:"5px 10px",borderRadius:6,background:"rgba(251,191,36,0.12)",color:"#fbbf24",border:"1px solid rgba(251,191,36,0.3)"}}>⏳ Reempaque pedido</span>}
                        {rpk?.status==="done"&&(()=>{const before=Number(rpk.original_billable_kg||0),after=Number(rpk.new_billable_kg||0),delta=before-after;return <span title={`${before.toFixed(2)} kg → ${after.toFixed(2)} kg`} style={{fontSize:11,fontWeight:700,padding:"5px 10px",borderRadius:6,background:"rgba(34,197,94,0.12)",color:"#22c55e",border:"1px solid rgba(34,197,94,0.3)"}}>✅ Reempaque hecho{delta>0?` (−${delta.toFixed(1)} kg)`:""}</span>;})()}
                        {canRepack&&<button onClick={(e)=>{e.stopPropagation();requestRepackForOp(o);}} style={{padding:"6px 12px",fontSize:11,fontWeight:700,borderRadius:6,border:"1px solid rgba(251,146,60,0.4)",background:"rgba(251,146,60,0.1)",color:"#fb923c",cursor:"pointer"}}>🔄 Pedir reempaque</button>}
                      </div>
                    </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                    {/* Productos declarados por el cliente */}
                    <div>
                      <h4 style={{fontSize:10,fontWeight:700,color:IC,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.08em"}}>📋 Productos declarados ({itemsOfOp.length})</h4>
                      {itemsOfOp.length===0?<p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0,fontStyle:"italic"}}>Aún no cargó productos</p>:<>
                        <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
                            <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                              {["Descripción","Cant.","P.U.","Total"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:h==="Descripción"?"left":"right",fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}
                            </tr></thead>
                            <tbody>{itemsOfOp.map(it=><tr key={it.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                              <td style={{padding:"6px 10px",color:"rgba(255,255,255,0.8)"}}>{it.description||"—"}</td>
                              <td style={{padding:"6px 10px",textAlign:"right",color:"rgba(255,255,255,0.65)",fontVariantNumeric:"tabular-nums"}}>{it.quantity||1}</td>
                              <td style={{padding:"6px 10px",textAlign:"right",color:"rgba(255,255,255,0.65)",fontVariantNumeric:"tabular-nums"}}>USD {Number(it.unit_price_usd||0).toFixed(2)}</td>
                              <td style={{padding:"6px 10px",textAlign:"right",color:"#fff",fontWeight:600,fontVariantNumeric:"tabular-nums"}}>USD {(Number(it.unit_price_usd||0)*Number(it.quantity||1)).toFixed(2)}</td>
                            </tr>)}</tbody>
                            <tfoot><tr style={{borderTop:"1px solid rgba(184,149,106,0.3)"}}>
                              <td colSpan={3} style={{padding:"6px 10px",textAlign:"right",fontWeight:700,color:"rgba(255,255,255,0.7)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>Total FOB</td>
                              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:700,color:IC,fontVariantNumeric:"tabular-nums"}}>USD {totalFob.toFixed(2)}</td>
                            </tr></tfoot>
                          </table>
                        </div>
                      </>}
                    </div>
                    {/* Detalle de bultos */}
                    <div>
                      <h4 style={{fontSize:10,fontWeight:700,color:IC,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.08em"}}>📦 Bultos ({pkgsOfOp.length})</h4>
                      {pkgsOfOp.length===0?<p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0,fontStyle:"italic"}}>Sin bultos registrados</p>:<>
                        <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,overflow:"hidden"}}>
                          <table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}>
                            <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                              {["#","Foto","Cant.","Dimensiones (cm)","Peso","Facturable","Tracking",""].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}
                            </tr></thead>
                            <tbody>{pkgsOfOp.map(p=>{const opAg=signups.find(s=>s.auth_user_id===o.created_by_agent_id);const opVD=Number(opAg?.volumetric_divisor)||5000;const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),wi=Number(p.width_cm||0),h=Number(p.height_cm||0);const bruto=gw*q;const vol=l&&wi&&h?((l*wi*h)/opVD)*q:0;const fact=Math.max(bruto,vol);return <tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                              <td style={{padding:"6px 10px",color:"rgba(255,255,255,0.65)",fontWeight:600}}>{p.package_number}</td>
                              <td style={{padding:"6px 10px"}}>{p.photo_url?<a href={p.photo_url} target="_blank" rel="noopener noreferrer"><img src={p.photo_url} alt="" style={{width:36,height:36,objectFit:"cover",borderRadius:5,border:"1px solid rgba(34,197,94,0.4)",cursor:"zoom-in"}}/></a>:<span title="Sin foto" style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"rgba(251,191,36,0.12)",color:"#fbbf24",fontWeight:700}}>📷 Pendiente</span>}</td>
                              <td style={{padding:"6px 10px",color:"rgba(255,255,255,0.65)",fontVariantNumeric:"tabular-nums"}}>{q}</td>
                              <td style={{padding:"6px 10px",color:"rgba(255,255,255,0.65)",fontVariantNumeric:"tabular-nums"}}>{l&&wi&&h?`${l}×${wi}×${h}`:"—"}</td>
                              <td style={{padding:"6px 10px",color:"rgba(255,255,255,0.75)",fontVariantNumeric:"tabular-nums"}}>{bruto?`${bruto.toFixed(2)} kg`:"—"}</td>
                              <td style={{padding:"6px 10px",color:fact>0?IC:"rgba(255,255,255,0.3)",fontVariantNumeric:"tabular-nums",fontWeight:600}}>{fact?`${fact.toFixed(2)} kg`:"—"}</td>
                              <td style={{padding:"6px 10px",color:"rgba(255,255,255,0.5)",fontFamily:"monospace",fontSize:10}}>{p.national_tracking||"—"}</td>
                              <td style={{padding:"6px 10px",textAlign:"right"}}><button onClick={(e)=>{e.stopPropagation();openMoveModal(p,o);}} title="Mover este bulto a otro cliente (el agente lo cargó al equivocado)" style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:"1px solid rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.08)",color:IC,cursor:"pointer",fontWeight:600}}>↪ Mover</button></td>
                            </tr>;})}</tbody>
                          </table>
                        </div>
                      </>}
                    </div>
                  </div>
                  </div>
                </td></tr>;
              })()}</Fragment>;})}</tbody>
            </table>
          </div>
        </div>;})}
      </div>;
    })()}

    {tab==="flights"&&!selFlight&&<div>
      {flights.length===0?<p style={{color:"rgba(255,255,255,0.45)",textAlign:"center",padding:"3rem 0"}}>No hay vuelos creados todavía</p>:
      <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.25)"}}>
            {["Código","Agente","Estado","Ops","Peso","Costo","Tracking","Creado",""].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}
          </tr></thead>
          <tbody>{flights.map(f=>{const ops=flightOps.filter(fo=>fo.flight_id===f.id);const a=signups.find(s=>s.auth_user_id===f.agent_id);const stColors={preparando:"#fbbf24",despachado:"#60a5fa",recibido:"#22c55e"};return <tr key={f.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <td style={{padding:"12px 14px",fontFamily:"monospace",fontWeight:700,color:"#fff"}}>{f.flight_code}</td>
            <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.6)"}}>{a?(a.first_name+" "+(a.last_name||"")):"—"}</td>
            <td style={{padding:"12px 14px"}}>{(()=>{const ready=f.status==="preparando"&&f.invoice_presented_at;const c=ready?"#22c55e":stColors[f.status];const label=ready?"listo para enviar":f.status;return <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:4,color:c,background:`${c}20`,border:`1px solid ${c}40`,textTransform:"uppercase"}}>{label}</span>;})()}</td>
            <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)"}}>{ops.length}</td>
            <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.6)"}}>{f.total_weight_kg?`${Number(f.total_weight_kg).toFixed(2)} kg`:"—"}</td>
            <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.6)"}}>{f.total_cost_usd?usd(f.total_cost_usd):"—"}</td>
            <td style={{padding:"12px 14px",fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.35}}>{f.international_tracking?<><span style={{fontFamily:"monospace"}}>{f.international_tracking}</span>{f.international_carrier&&<><br/><span style={{fontSize:9,fontWeight:700,color:IC,letterSpacing:"0.04em",textTransform:"uppercase"}}>{f.international_carrier}</span></>}</>:"—"}</td>
            <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.4)",fontSize:11}}>{formatDate(f.created_at)}</td>
            <td style={{padding:"12px 14px"}}><button onClick={()=>setSelFlight(f.id)} style={{color:IC,fontSize:11,fontWeight:600,background:"rgba(184,149,106,0.1)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:6,padding:"5px 10px",cursor:"pointer"}}>Ver →</button></td>
          </tr>;})}</tbody>
        </table>
      </div>}
    </div>}

    {tab==="flights"&&selFlight&&flight&&<FlightEditor token={token} flight={flight} signups={signups} flightOps={flightOpsForSel} depositOps={depositOps} allOps={allOps} invoiceItems={invoiceItems.filter(i=>i.flight_id===flight.id)} depositPkgs={depositPkgs} onReload={load} onFlash={flash} onBack={()=>setSelFlight(null)} usd={usd}/>}

    {tab==="accounts"&&<div>
      {approvedAgents.length===0?<p style={{color:"rgba(255,255,255,0.45)",textAlign:"center",padding:"3rem 0"}}>No hay agentes aprobados</p>:
      approvedAgents.map(a=>{const bal=agentBalance(a.auth_user_id);const movs=accMovements.filter(m=>m.agent_id===a.auth_user_id);return <Card key={a.id} title={`${a.first_name} ${a.last_name||""} — ${a.email}`}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:12,flexWrap:"wrap"}}>
          <div style={{background:"rgba(34,197,94,0.06)",borderRadius:10,padding:"14px 18px",border:"1px solid rgba(34,197,94,0.15)"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>SALDO</p><p style={{fontSize:22,fontWeight:700,color:bal>0?"#22c55e":bal<0?"#ff6b6b":"#fff",margin:0}}>{usd(bal)}</p></div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"rgba(255,255,255,0.55)"}} title="Divisor para peso volumétrico (cm³ ÷ divisor). Estándar 5000, algunos couriers usan 6000.">
              <span>Vol ÷</span>
              <select defaultValue={a.volumetric_divisor||5000} onChange={async(e)=>{const v=parseInt(e.target.value);await dq("agent_signups",{method:"PATCH",token,filters:`?id=eq.${a.id}`,body:{volumetric_divisor:v}});load();flash(`Divisor de ${a.first_name} ahora /${v}`);}} style={{padding:"4px 8px",fontSize:11,background:"rgba(255,255,255,0.06)",color:"#fff",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,cursor:"pointer"}}>
                <option value="5000" style={{background:"#142038"}}>5000</option>
                <option value="6000" style={{background:"#142038"}}>6000</option>
              </select>
            </label>
            <Btn small onClick={()=>setShowAnticipoForm(showAnticipoForm===a.auth_user_id?null:a.auth_user_id)}>+ Cargar anticipo</Btn>
          </div>
        </div>
        {showAnticipoForm===a.auth_user_id&&<AnticipoForm token={token} agentId={a.auth_user_id} onSaved={()=>{setShowAnticipoForm(null);load();flash("Anticipo cargado");}}/>}
        {movs.length>0?<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>{["Fecha","Tipo","Monto","Descripción","Vuelo"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>{movs.map(m=>{const fl=flights.find(f=>f.id===m.flight_id);return <tr key={m.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <td style={{padding:"8px 12px",color:"rgba(255,255,255,0.5)"}}>{formatDate(m.date)}</td>
            <td style={{padding:"8px 12px"}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:4,fontWeight:700,background:m.type==="anticipo"?"rgba(34,197,94,0.15)":"rgba(255,80,80,0.15)",color:m.type==="anticipo"?"#22c55e":"#ff6b6b"}}>{m.type==="anticipo"?"ANTICIPO":"DEDUCCIÓN"}</span></td>
            <td style={{padding:"8px 12px",fontWeight:700,color:m.type==="anticipo"?"#22c55e":"#ff6b6b"}}>{m.type==="anticipo"?"+":"-"}{usd(m.amount_usd)}</td>
            <td style={{padding:"8px 12px",color:"rgba(255,255,255,0.5)"}}>{m.description||"—"}</td>
            <td style={{padding:"8px 12px",fontFamily:"monospace",color:IC,fontSize:11}}>{fl?fl.flight_code:"—"}</td>
          </tr>;})}</tbody>
        </table>:<p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0,textAlign:"center",padding:"1rem 0"}}>Sin movimientos</p>}
      </Card>;})}
    </div>}
    {tab==="orphans"&&<>
      {unassigned.length===0?<p style={{color:"rgba(255,255,255,0.45)",textAlign:"center",padding:"3rem 0"}}>No hay paquetes huérfanos</p>:
      <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.25)"}}>
            {["Tracking","Bulto","Peso","Dimensiones","Recibido","Asignar a operación",""].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}
          </tr></thead>
          <tbody>{unassigned.map(p=><tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <td style={{padding:"12px 14px",fontFamily:"monospace",fontSize:12,color:"#fff"}}>{p.national_tracking}</td>
            <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)"}}>#{p.package_number}</td>
            <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)"}}>{p.gross_weight_kg?`${Number(p.gross_weight_kg).toFixed(2)} kg`:"—"}</td>
            <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)",fontSize:11}}>{p.length_cm?`${p.length_cm}×${p.width_cm}×${p.height_cm}`:"—"}</td>
            <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.4)",fontSize:11}}>{formatDate(p.created_at)}</td>
            <td style={{padding:"12px 14px"}}><select onChange={e=>assignToOp(p,e.target.value)} value="" style={{padding:"6px 10px",fontSize:11,border:"1px solid rgba(184,149,106,0.3)",borderRadius:6,background:"rgba(184,149,106,0.08)",color:"#fff",outline:"none",maxWidth:240}}>
              <option value="" style={{background:"#142038"}}>— seleccionar —</option>
              {allOps.map(o=><option key={o.id} value={o.id} style={{background:"#142038"}}>{o.operation_code} - {o.clients?.client_code} ({o.clients?.first_name})</option>)}
            </select></td>
            <td style={{padding:"12px 14px"}}><button onClick={()=>delUnassigned(p.id)} style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>X</button></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </>}
    {tab==="signups"&&(lo?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"2rem"}}>Cargando...</p>:signups.length===0?<p style={{color:"rgba(255,255,255,0.45)",textAlign:"center",padding:"3rem 0"}}>No hay solicitudes de agentes</p>:
    <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.25)"}}>
          {["Nombre","Email","País","Idioma","Estado","Registrado","Acciones"].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}
        </tr></thead>
        <tbody>{signups.map(s=>{const st=ST[s.status]||{l:s.status,c:"#999"};return <tr key={s.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <td style={{padding:"12px 14px",color:"#fff"}}>{s.first_name||"—"} {s.last_name||""}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.6)",fontSize:12}}>{s.email}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)"}}>{s.country==="China"?"🇨🇳":"🇺🇸"} {s.country}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)"}}>{s.language==="zh"?"中文":"ES"}</td>
          <td style={{padding:"12px 14px"}}><span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:st.c,background:`${st.c}15`,border:`1px solid ${st.c}33`}}>{st.l}</span></td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.4)",fontSize:11}}>{formatDate(s.created_at)}</td>
          <td style={{padding:"12px 14px"}}>
            {s.status==="pending"&&<div style={{display:"flex",gap:6}}>
              <button onClick={()=>approve(s)} style={{padding:"5px 12px",fontSize:11,fontWeight:700,borderRadius:6,border:"1px solid rgba(34,197,94,0.25)",background:"rgba(34,197,94,0.1)",color:"#22c55e",cursor:"pointer"}}>✓ Aprobar</button>
              <button onClick={()=>reject(s)} style={{padding:"5px 12px",fontSize:11,fontWeight:700,borderRadius:6,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>✕ Rechazar</button>
            </div>}
            {s.status==="approved"&&<span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>Activo</span>}
            {s.status==="rejected"&&<button onClick={()=>approve(s)} style={{padding:"5px 12px",fontSize:11,fontWeight:700,borderRadius:6,border:"1px solid rgba(34,197,94,0.25)",background:"rgba(34,197,94,0.1)",color:"#22c55e",cursor:"pointer"}}>Reactivar</button>}
          </td>
        </tr>;})}</tbody>
      </table>
    </div>)}
    {movePkgState&&(()=>{const filteredCl=moveClients.filter(c=>{if(!moveSearch)return true;const s=moveSearch.toLowerCase();return c.client_code?.toLowerCase().includes(s)||`${c.first_name||""} ${c.last_name||""}`.toLowerCase().includes(s);}).slice(0,12);const fromCl=movePkgState.fromOp.clients;const fromName=fromCl?`${fromCl.client_code} — ${fromCl.first_name} ${fromCl.last_name}`:"(sin cliente)";return <div onClick={closeMoveModal} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1px solid rgba(184,149,106,0.25)",borderRadius:14,padding:"22px 24px",maxWidth:520,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:14}}>
          <div>
            <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>↪ Mover bulto #{movePkgState.pkg.package_number} a otro cliente</h3>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:"4px 0 0"}}>Origen: <strong style={{color:"#fff"}}>{movePkgState.fromOp.operation_code}</strong> · {fromName}</p>
          </div>
          <button onClick={closeMoveModal} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
        </div>
        <input autoFocus value={moveSearch} onChange={e=>{setMoveSearch(e.target.value);setMoveSelClient(null);}} placeholder="Buscar cliente por código o nombre…" style={{width:"100%",padding:"10px 12px",fontSize:13,border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,background:"rgba(255,255,255,0.04)",color:"#fff",marginBottom:10,outline:"none"}}/>
        {!moveSelClient&&<div style={{maxHeight:260,overflowY:"auto",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,marginBottom:12}}>
          {filteredCl.length===0?<p style={{padding:"14px",fontSize:12,color:"rgba(255,255,255,0.4)",textAlign:"center",margin:0}}>{moveSearch?"Sin coincidencias":"Escribí para buscar…"}</p>:filteredCl.map(c=>{const isFrom=c.id===movePkgState.fromOp.client_id;return <button key={c.id} onClick={()=>setMoveSelClient(c)} style={{width:"100%",padding:"10px 12px",border:"none",borderBottom:"1px solid rgba(255,255,255,0.04)",background:"transparent",color:"#fff",cursor:"pointer",textAlign:"left",fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(184,149,106,0.08)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
            <span><strong style={{fontFamily:"monospace",color:IC}}>{c.client_code}</strong> — {c.first_name} {c.last_name}</span>
            {isFrom&&<span style={{fontSize:10,fontWeight:700,color:"#a78bfa",padding:"2px 6px",borderRadius:4,background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.3)"}}>SPLIT (mismo cliente)</span>}
          </button>;})}
        </div>}
        {moveSelClient&&<div style={{padding:"14px",background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:8,marginBottom:12}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Cliente destino</p>
          <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 10px"}}><span style={{fontFamily:"monospace",color:IC}}>{moveSelClient.client_code}</span> — {moveSelClient.first_name} {moveSelClient.last_name}</p>
          {isSameClient?<p style={{fontSize:12,color:"#a78bfa",margin:0}}>✂️ SPLIT — se crea una NUEVA op para este cliente con este bulto (mismo agente que {movePkgState.fromOp.operation_code}). La op origen sigue con el resto.</p>:moveTargetOp?<p style={{fontSize:12,color:"#22c55e",margin:0}}>✓ Tiene op abierta del MISMO agente <strong style={{fontFamily:"monospace"}}>{moveTargetOp.operation_code}</strong> — el bulto se agrega ahí</p>:<p style={{fontSize:12,color:"#fbbf24",margin:0}}>⚠ Sin op abierta de ese agente — se va a crear una nueva (preservando el agente de {movePkgState.fromOp.operation_code})</p>}
          <button onClick={()=>setMoveSelClient(null)} style={{marginTop:8,fontSize:11,color:"rgba(255,255,255,0.5)",background:"transparent",border:"none",cursor:"pointer",padding:0,textDecoration:"underline"}}>← Cambiar cliente</button>
        </div>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={closeMoveModal} disabled={moveSaving} style={{padding:"8px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.7)",cursor:"pointer"}}>Cancelar</button>
          <button onClick={executeMove} disabled={!moveSelClient||moveSaving} style={{padding:"8px 18px",fontSize:12,fontWeight:700,borderRadius:8,border:`1px solid ${IC}`,background:moveSelClient?GOLD_GRADIENT:"rgba(255,255,255,0.05)",color:moveSelClient?"#0A1628":"rgba(255,255,255,0.3)",cursor:moveSelClient?"pointer":"not-allowed",opacity:moveSaving?0.6:1}}>{moveSaving?"Moviendo…":"✓ Confirmar"}</button>
        </div>
      </div>
    </div>;})()}
    {repackModal&&(()=>{const {op,pkgs,billable,reason,sending}=repackModal;const opAg=signups.find(s=>s.auth_user_id===op.created_by_agent_id);const agentName=opAg?(opAg.first_name||opAg.email||"agente"):"agente";return <div onClick={()=>!sending&&setRepackModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1px solid rgba(251,146,60,0.35)",borderRadius:14,padding:"22px 24px",maxWidth:540,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:14}}>
          <div>
            <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>🔄 Pedir reempaque · {op.operation_code}</h3>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:"4px 0 0"}}>Se le envía push notif a <strong style={{color:"#fff"}}>{agentName}</strong> con el motivo. {agentName} va a poder reempaquetar las cajas físicamente y cargar las nuevas medidas.</p>
          </div>
          <button onClick={()=>!sending&&setRepackModal(null)} disabled={sending} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:sending?"not-allowed":"pointer",padding:0,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,marginBottom:14}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Estado actual</p>
          <p style={{fontSize:13,color:"#fff",margin:0}}>{pkgs.length} bultos · peso facturable <strong style={{color:IC}}>{billable.toFixed(2)} kg</strong></p>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Motivo del pedido (opcional)</label>
          <textarea autoFocus value={reason} onChange={e=>setRepackModal(s=>({...s,reason:e.target.value}))} placeholder="Ej: Reempaquetar para reducir volumétrico, intentar bajar de 50kg a 35kg" rows={3} style={{width:"100%",padding:"10px 12px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,background:"rgba(0,0,0,0.2)",color:"#fff",outline:"none",fontFamily:"inherit",resize:"vertical"}}/>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"6px 0 0"}}>Tip: dejá vacío si solo querés que reempaquete sin instrucciones específicas.</p>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>!sending&&setRepackModal(null)} disabled={sending} style={{padding:"8px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.7)",cursor:sending?"not-allowed":"pointer"}}>Cancelar</button>
          <button onClick={submitRepack} disabled={sending} style={{padding:"8px 18px",fontSize:12,fontWeight:700,borderRadius:8,border:"1px solid rgba(251,146,60,0.4)",background:sending?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#fb923c,#f97316)",color:sending?"rgba(255,255,255,0.4)":"#0A1628",cursor:sending?"wait":"pointer"}}>{sending?"Enviando…":"🔄 Enviar pedido"}</button>
        </div>
      </div>
    </div>;})()}
  </div>;
}

// PurchaseNotificationsAdmin — admin gestiona avisos de compra: confirma → crea op, o rechaza
function PurchaseNotificationsAdmin({token,allClients,onCreateOp}){
  const [items,setItems]=useState([]);
  const [lo,setLo]=useState(true);
  const [filter,setFilter]=useState("open"); // open(pending+partial) | pending | partial | received | cancelled | all
  const [filterChannel,setFilterChannel]=useState("all"); // all | aereo | maritimo
  const [filterOrigin,setFilterOrigin]=useState("all"); // all | china | usa
  const [search,setSearch]=useState("");
  const [confirmAction,setConfirmAction]=useState(null); // {type, notif}
  const [mergeAction,setMergeAction]=useState(null); // {clientId, notifs}
  const [working,setWorking]=useState(false);
  const load=async()=>{setLo(true);const r=await dq("purchase_notifications",{token,filters:"?select=*,trackings:purchase_notification_trackings(id,tracking_code,received_at),clients(client_code,first_name,last_name,whatsapp,auth_user_id),operations(operation_code)&order=created_at.desc"});setItems(Array.isArray(r)?r:[]);setLo(false);};
  useEffect(()=>{load();},[token]);

  // Filtros combinados
  const filteredByStatus=filter==="open"?items.filter(i=>["pending","partial"].includes(i.status)):filter==="all"?items:items.filter(i=>i.status===filter);
  const filteredByChannel=filterChannel==="all"?filteredByStatus:filteredByStatus.filter(i=>i.shipping_method===filterChannel);
  const filteredByOrigin=filterOrigin==="all"?filteredByChannel:filteredByChannel.filter(i=>i.origin===filterOrigin);
  const filtered=search?filteredByOrigin.filter(n=>{const q=search.toLowerCase();const trks=Array.isArray(n.trackings)?n.trackings.map(t=>t.tracking_code).join(" "):"";return trks.toLowerCase().includes(q)||n.tracking_code?.toLowerCase().includes(q)||n.clients?.client_code?.toLowerCase().includes(q)||`${n.clients?.first_name||""} ${n.clients?.last_name||""}`.toLowerCase().includes(q)||n.description?.toLowerCase().includes(q);}):filteredByOrigin;

  const counts={pending:items.filter(i=>i.status==="pending").length,partial:items.filter(i=>i.status==="partial").length,received:items.filter(i=>i.status==="received").length,cancelled:items.filter(i=>i.status==="cancelled").length,all:items.length};
  counts.open=counts.pending+counts.partial;

  // Detectar duplicados sospechosos: mismo cliente + mismo origen + misma modalidad, en estado abierto, < 30 días
  const dupGroups=(()=>{
    const open=items.filter(i=>["pending","partial"].includes(i.status));
    const groups={};
    for(const n of open){
      const d=new Date(n.created_at);
      if((Date.now()-d.getTime())>30*24*60*60*1000)continue;
      const key=`${n.client_id}|${n.origin}|${n.shipping_method}`;
      if(!groups[key])groups[key]=[];
      groups[key].push(n);
    }
    return Object.values(groups).filter(g=>g.length>=2);
  })();
  const dupNotifIds=new Set(dupGroups.flat().map(n=>n.id));

  const confirmReceipt=async(n)=>{
    setWorking(true);
    try{
      const trks=Array.isArray(n.trackings)?n.trackings:[];
      const trkCodes=trks.length>0?trks.map(t=>t.tracking_code):(n.tracking_code?[n.tracking_code]:[]);
      // Crear op nueva con datos del aviso pre-cargados
      const rpc=await dq("rpc/next_operation_code",{method:"POST",token,body:{}});
      const newCode=typeof rpc==="string"?rpc:null;
      if(!newCode){alert("Error generando código de op");setWorking(false);return;}
      const channel=n.shipping_method==="maritimo"?"maritimo_negro":"aereo_negro";
      const origin=n.origin==="usa"?"USA":"China";
      // international_tracking guarda los trackings concatenados (la lógica futura puede leer de la tabla hija)
      const intTrk=trkCodes.join(", ");
      const opBody={operation_code:newCode,client_id:n.client_id,channel,origin,service_type:"courier",status:"en_deposito_origen",description:n.description||null,international_tracking:intTrk};
      const created=await dq("operations",{method:"POST",token,body:opBody});
      const opObj=Array.isArray(created)?created[0]:created;
      if(!opObj?.id){alert("Error creando op");setWorking(false);return;}
      // Marcar TODOS los trackings del aviso como received + linkear aviso con op
      const now=new Date().toISOString();
      for(const t of trks){
        if(!t.received_at){await dq("purchase_notification_trackings",{method:"PATCH",token,filters:`?id=eq.${t.id}`,body:{received_at:now}}).catch(()=>{});}
      }
      await dq("purchase_notifications",{method:"PATCH",token,filters:`?id=eq.${n.id}`,body:{status:"received",operation_id:opObj.id,confirmed_at:now}});
      // Notif al cliente
      try{
        if(n.clients?.auth_user_id){
          dq("notifications",{method:"POST",token,body:{user_id:n.clients.auth_user_id,portal:"cliente",title:`✓ Tu carga llegó al depósito`,body:`${trkCodes.length} tracking${trkCodes.length>1?"s":""} → operación ${newCode} creada`,link:`?op=${newCode}`}}).catch(()=>{});
          fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:n.clients.auth_user_id,title:`✓ Tu carga llegó al depósito`,body:`${trkCodes.length} tracking${trkCodes.length>1?"s":""} → ${newCode}`,url:`/portal?op=${newCode}`})}).catch(()=>{});
        }
      }catch(e){}
      setConfirmAction(null);load();
      if(onCreateOp)onCreateOp(opObj);
    }catch(e){alert("Error: "+e.message);}
    setWorking(false);
  };
  const cancelNotif=async(n)=>{
    setWorking(true);
    await dq("purchase_notifications",{method:"PATCH",token,filters:`?id=eq.${n.id}`,body:{status:"cancelled",cancelled_at:new Date().toISOString()}});
    setConfirmAction(null);load();
    setWorking(false);
  };

  // Mergear avisos sospechosos en uno solo (mueve trackings del 2do/3ro al 1ro y cancela los demás)
  const mergeNotifs=async(notifs)=>{
    if(notifs.length<2)return;
    setWorking(true);
    try{
      const target=notifs[0]; // el más antiguo (orden desc en load → invertimos)
      const sorted=[...notifs].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
      const main=sorted[0];
      const rest=sorted.slice(1);
      // Reasignar trackings de los demás avisos al principal
      for(const n of rest){
        const trks=Array.isArray(n.trackings)?n.trackings:[];
        for(const t of trks){
          await dq("purchase_notification_trackings",{method:"PATCH",token,filters:`?id=eq.${t.id}`,body:{notification_id:main.id}}).catch(()=>{});
        }
        // Cancelar el aviso vacío
        await dq("purchase_notifications",{method:"PATCH",token,filters:`?id=eq.${n.id}`,body:{status:"cancelled",cancelled_at:new Date().toISOString(),notes:`Mergeado en aviso ${main.id}`}}).catch(()=>{});
      }
      setMergeAction(null);load();
    }catch(e){alert("Error mergeando: "+e.message);}
    setWorking(false);
  };
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap"}}>
      <div>
        <h2 style={{fontSize:22,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>📦 Avisos de compra de clientes</h2>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"4px 0 0"}}>Pre-avisos del cliente. Confirmá cuando la carga llegue al depósito y se crea la operación oficial.</p>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {dupGroups.length>0&&<span style={{padding:"6px 12px",fontSize:11,fontWeight:700,borderRadius:8,background:"rgba(251,146,60,0.15)",color:"#fb923c",border:"1px solid rgba(251,146,60,0.4)"}}>⚠️ {dupGroups.length} grupo{dupGroups.length>1?"s":""} duplicado{dupGroups.length>1?"s":""}</span>}
        {counts.open>0&&<span style={{padding:"6px 14px",fontSize:12,fontWeight:700,borderRadius:8,background:"rgba(251,191,36,0.15)",color:"#fbbf24",border:"1px solid rgba(251,191,36,0.3)"}}>⏳ {counts.open} abiertos</span>}
      </div>
    </div>

    {/* Banner de duplicados sospechosos */}
    {dupGroups.length>0&&<div style={{padding:"12px 14px",background:"rgba(251,146,60,0.06)",border:"1.5px solid rgba(251,146,60,0.3)",borderRadius:10,marginBottom:14}}>
      <p style={{fontSize:12,fontWeight:700,color:"#fb923c",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.05em"}}>⚠️ Posibles duplicados detectados</p>
      <p style={{fontSize:12,color:"rgba(255,255,255,0.7)",margin:"0 0 10px"}}>Hay clientes con múltiples avisos abiertos del mismo origen y modalidad. Revisalos y mergealos en uno solo si corresponde.</p>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {dupGroups.map((g,i)=>{const cl=g[0].clients;return <button key={i} onClick={()=>setMergeAction({clientId:g[0].client_id,notifs:g})} style={{padding:"7px 12px",fontSize:11,fontWeight:600,borderRadius:7,border:"1px solid rgba(251,146,60,0.4)",background:"rgba(251,146,60,0.1)",color:"#fb923c",cursor:"pointer"}}>{cl?.client_code} — {g.length} avisos {g[0].origin==="china"?"🇨🇳":"🇺🇸"} {g[0].shipping_method==="aereo"?"✈️":"🚢"} · revisar →</button>;})}
      </div>
    </div>}

    <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
      {[{k:"open",l:"Abiertos",c:counts.open},{k:"pending",l:"Pendientes",c:counts.pending},{k:"partial",l:"Parciales",c:counts.partial},{k:"received",l:"Recibidas",c:counts.received},{k:"cancelled",l:"Canceladas",c:counts.cancelled},{k:"all",l:"Todas",c:counts.all}].map(t=><button key={t.k} onClick={()=>setFilter(t.k)} style={{padding:"6px 12px",fontSize:12,fontWeight:600,borderRadius:7,border:`1px solid ${filter===t.k?IC:"rgba(255,255,255,0.1)"}`,background:filter===t.k?"rgba(184,149,106,0.1)":"transparent",color:filter===t.k?IC:"rgba(255,255,255,0.55)",cursor:"pointer"}}>{t.l} ({t.c})</button>)}
    </div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Modalidad:</span>
      {[{k:"all",l:"Todas"},{k:"aereo",l:"✈️ Aéreo"},{k:"maritimo",l:"🚢 Marítimo"}].map(t=><button key={t.k} onClick={()=>setFilterChannel(t.k)} style={{padding:"4px 10px",fontSize:11,fontWeight:600,borderRadius:5,border:`1px solid ${filterChannel===t.k?"#60a5fa":"rgba(255,255,255,0.08)"}`,background:filterChannel===t.k?"rgba(96,165,250,0.1)":"transparent",color:filterChannel===t.k?"#60a5fa":"rgba(255,255,255,0.5)",cursor:"pointer"}}>{t.l}</button>)}
      <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginLeft:8}}>Origen:</span>
      {[{k:"all",l:"Todos"},{k:"china",l:"🇨🇳 China"},{k:"usa",l:"🇺🇸 USA"}].map(t=><button key={t.k} onClick={()=>setFilterOrigin(t.k)} style={{padding:"4px 10px",fontSize:11,fontWeight:600,borderRadius:5,border:`1px solid ${filterOrigin===t.k?"#60a5fa":"rgba(255,255,255,0.08)"}`,background:filterOrigin===t.k?"rgba(96,165,250,0.1)":"transparent",color:filterOrigin===t.k?"#60a5fa":"rgba(255,255,255,0.5)",cursor:"pointer"}}>{t.l}</button>)}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por tracking, cliente o descripción…" style={{flex:1,minWidth:200,padding:"7px 12px",fontSize:12,border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none"}}/>
    </div>
    {lo?<p style={{textAlign:"center",padding:"3rem 0",color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:filtered.length===0?<div style={{padding:"3rem 1rem",textAlign:"center",background:"rgba(255,255,255,0.02)",border:"1px dashed rgba(255,255,255,0.08)",borderRadius:14}}>
      <p style={{fontSize:14,color:"rgba(255,255,255,0.55)",margin:0}}>Sin avisos {filter!=="all"?filter:""}</p>
    </div>:<div style={{display:"flex",flexDirection:"column",gap:10}}>
      {filtered.map(n=>{
        const cl=n.clients;
        const trks=Array.isArray(n.trackings)&&n.trackings.length>0?n.trackings:(n.tracking_code?[{tracking_code:n.tracking_code,received_at:n.confirmed_at}]:[]);
        const totalTrks=trks.length;
        const recvTrks=trks.filter(t=>t.received_at).length;
        const isDup=dupNotifIds.has(n.id);
        const statusColor=n.status==="pending"?"#fbbf24":n.status==="partial"?"#60a5fa":n.status==="received"?"#22c55e":"#ff6b6b";
        const statusBg=n.status==="pending"?"rgba(251,191,36,0.05)":n.status==="partial"?"rgba(96,165,250,0.05)":n.status==="received"?"rgba(34,197,94,0.04)":"rgba(255,255,255,0.02)";
        const statusBorder=isDup?"rgba(251,146,60,0.5)":n.status==="pending"?"rgba(251,191,36,0.25)":n.status==="partial"?"rgba(96,165,250,0.3)":n.status==="received"?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.06)";
        const statusLabel=n.status==="pending"?"⏳ PENDIENTE":n.status==="partial"?`⏳ PARCIAL (${recvTrks}/${totalTrks})`:n.status==="received"?"✓ RECIBIDA":"✕ CANCELADA";
        const isOpen=["pending","partial"].includes(n.status);
        return <div key={n.id} style={{padding:"14px 16px",background:statusBg,border:`1.5px solid ${statusBorder}`,borderRadius:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:12,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:240}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
              {isDup&&<span style={{fontSize:9,fontWeight:800,padding:"3px 7px",borderRadius:4,background:"rgba(251,146,60,0.18)",color:"#fb923c",border:"1px solid rgba(251,146,60,0.5)"}}>⚠️ DUPLICADO</span>}
              <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,background:n.origin==="china"?"rgba(239,68,68,0.15)":"rgba(59,130,246,0.15)",color:n.origin==="china"?"#fca5a5":"#93c5fd",border:`1px solid ${n.origin==="china"?"rgba(239,68,68,0.3)":"rgba(59,130,246,0.3)"}`}}>{n.origin==="china"?"🇨🇳 CHINA":"🇺🇸 USA"}</span>
              <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.6)"}}>{n.shipping_method==="aereo"?"✈️ Aéreo":"🚢 Marítimo"}</span>
              <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,background:`${statusColor}25`,color:statusColor}}>{statusLabel}</span>
              <span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.5)"}}>📦 {totalTrks} tracking{totalTrks!==1?"s":""}</span>
            </div>
            <p style={{fontSize:13,color:"#fff",margin:"0 0 6px"}}><strong style={{color:IC,fontFamily:"monospace"}}>{cl?.client_code||"?"}</strong> — {cl?.first_name} {cl?.last_name}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:6}}>
              {trks.map((t,i)=><span key={i} style={{fontSize:11,fontFamily:"monospace",padding:"3px 8px",borderRadius:4,background:t.received_at?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.05)",color:t.received_at?"rgba(34,197,94,0.9)":"#fff",border:`1px solid ${t.received_at?"rgba(34,197,94,0.25)":"rgba(255,255,255,0.1)"}`}}>{t.tracking_code}{t.received_at?" ✓":""}</span>)}
            </div>
            {n.description&&<p style={{fontSize:12,color:"rgba(255,255,255,0.7)",margin:"0 0 4px"}}>{n.description}</p>}
            <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:0}}>Avisado {formatDate(n.created_at)}{n.estimated_packages?` · ${n.estimated_packages} bultos`:""}{n.estimated_dispatch_date?` · sale ${formatDate(n.estimated_dispatch_date)}`:""}{(n.status==="received"||n.status==="partial")&&n.operations?.operation_code?` · op `:""}{(n.status==="received"||n.status==="partial")&&n.operations?.operation_code?<strong style={{color:IC,fontFamily:"monospace"}}>{n.operations.operation_code}</strong>:""}</p>
          </div>
          {isOpen&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button onClick={()=>setConfirmAction({type:"confirm",notif:n})} style={{padding:"7px 14px",fontSize:12,fontWeight:700,borderRadius:7,border:"1px solid rgba(34,197,94,0.4)",background:"rgba(34,197,94,0.1)",color:"#22c55e",cursor:"pointer"}}>✓ Confirmar y crear op</button>
            <button onClick={()=>setConfirmAction({type:"cancel",notif:n})} style={{padding:"7px 12px",fontSize:11,fontWeight:600,borderRadius:7,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.06)",color:"#ff6b6b",cursor:"pointer"}}>Rechazar</button>
          </div>}
        </div>
      </div>;})}
    </div>}

    {confirmAction&&(()=>{const {type,notif}=confirmAction;const cl=notif.clients;const trks=Array.isArray(notif.trackings)&&notif.trackings.length>0?notif.trackings:(notif.tracking_code?[{tracking_code:notif.tracking_code}]:[]);return <div onClick={()=>!working&&setConfirmAction(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:`1.5px solid ${type==="confirm"?"rgba(34,197,94,0.4)":"rgba(255,80,80,0.4)"}`,borderRadius:14,padding:"22px 24px",maxWidth:520,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:14}}>
          <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>{type==="confirm"?"✓ Confirmar recepción y crear op":"Rechazar aviso"}</h3>
          <button onClick={()=>!working&&setConfirmAction(null)} disabled={working} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:working?"not-allowed":"pointer",padding:0,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,marginBottom:14}}>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:"0 0 6px"}}>Cliente: <strong style={{color:"#fff"}}>{cl?.client_code} — {cl?.first_name} {cl?.last_name}</strong></p>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:"0 0 4px"}}>Trackings ({trks.length}):</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
            {trks.map((t,i)=><span key={i} style={{fontSize:11,fontFamily:"monospace",padding:"2px 7px",borderRadius:3,background:"rgba(255,255,255,0.06)",color:"#fff"}}>{t.tracking_code}{t.received_at?" ✓":""}</span>)}
          </div>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:0}}>{notif.origin==="china"?"🇨🇳 China":"🇺🇸 USA"} · {notif.shipping_method==="aereo"?"✈️ Aéreo":"🚢 Marítimo"}{notif.description?` · ${notif.description}`:""}</p>
        </div>
        {type==="confirm"?<p style={{fontSize:12,color:"rgba(255,255,255,0.7)",margin:"0 0 14px",lineHeight:1.5}}>Se va a crear una nueva operación (canal <strong>{notif.shipping_method==="maritimo"?"Marítimo Integral AC":"Aéreo Integral AC"}</strong>) con <strong>los {trks.length} tracking{trks.length>1?"s":""}</strong> de este aviso. El cliente recibe notificación.</p>:<p style={{fontSize:12,color:"rgba(255,255,255,0.7)",margin:"0 0 14px"}}>El aviso queda marcado como cancelado. El cliente puede dar otro aviso si vuelve a intentarlo.</p>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>!working&&setConfirmAction(null)} disabled={working} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:working?"not-allowed":"pointer"}}>Volver</button>
          <button onClick={()=>type==="confirm"?confirmReceipt(notif):cancelNotif(notif)} disabled={working} style={{padding:"9px 18px",fontSize:13,fontWeight:700,borderRadius:8,border:`1px solid ${type==="confirm"?"rgba(34,197,94,0.5)":"rgba(255,80,80,0.5)"}`,background:working?"rgba(255,255,255,0.05)":(type==="confirm"?"linear-gradient(135deg,#22c55e,#16a34a)":"linear-gradient(135deg,#ff6b6b,#ef4444)"),color:working?"rgba(255,255,255,0.4)":"#fff",cursor:working?"wait":"pointer"}}>{working?"Procesando…":(type==="confirm"?"✓ Sí, crear op":"Sí, rechazar")}</button>
        </div>
      </div>
    </div>;})()}

    {/* Modal de merge de duplicados */}
    {mergeAction&&(()=>{const sorted=[...mergeAction.notifs].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));const main=sorted[0];const cl=main.clients;return <div onClick={()=>!working&&setMergeAction(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1.5px solid rgba(251,146,60,0.5)",borderRadius:14,padding:"22px 24px",maxWidth:560,width:"100%",maxHeight:"85vh",overflow:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
          <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>⚠️ Mergear avisos del cliente {cl?.client_code}</h3>
          <button onClick={()=>!working&&setMergeAction(null)} disabled={working} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        <p style={{fontSize:12,color:"rgba(255,255,255,0.7)",margin:"0 0 14px",lineHeight:1.5}}>Detectamos {sorted.length} avisos de <strong style={{color:"#fff"}}>{cl?.first_name} {cl?.last_name}</strong> con misma modalidad ({main.shipping_method==="aereo"?"✈️ Aéreo":"🚢 Marítimo"}) y mismo origen ({main.origin==="china"?"🇨🇳 China":"🇺🇸 USA"}). Si son de la misma compra, mergealos en uno solo.</p>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
          {sorted.map((n,i)=>{const trks=Array.isArray(n.trackings)?n.trackings:[];return <div key={n.id} style={{padding:"10px 12px",background:i===0?"rgba(34,197,94,0.06)":"rgba(255,255,255,0.03)",border:`1px solid ${i===0?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.08)"}`,borderRadius:8}}>
            <p style={{fontSize:11,fontWeight:700,color:i===0?"#22c55e":"rgba(255,255,255,0.5)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.05em"}}>{i===0?"✓ Aviso principal (más antiguo)":"Se cancela y sus trackings van al principal"}</p>
            <p style={{fontSize:12,color:"#fff",margin:"0 0 4px"}}>{n.description||"(sin descripción)"} · {formatDate(n.created_at)}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {trks.map((t,j)=><span key={j} style={{fontSize:10,fontFamily:"monospace",padding:"2px 6px",borderRadius:3,background:"rgba(255,255,255,0.06)",color:"#fff"}}>{t.tracking_code}</span>)}
            </div>
          </div>;})}
        </div>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"0 0 14px",fontStyle:"italic"}}>Resultado: 1 aviso con {sorted.reduce((s,n)=>s+(Array.isArray(n.trackings)?n.trackings.length:0),0)} trackings totales.</p>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>!working&&setMergeAction(null)} disabled={working} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer"}}>Cancelar</button>
          <button onClick={()=>mergeNotifs(sorted)} disabled={working} style={{padding:"9px 18px",fontSize:13,fontWeight:700,borderRadius:8,border:"1px solid rgba(251,146,60,0.5)",background:working?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#fb923c,#f97316)",color:"#fff",cursor:working?"wait":"pointer"}}>{working?"Mergeando…":"✓ Sí, mergear todos en uno"}</button>
        </div>
      </div>
    </div>;})()}
  </div>;
}

function ShipmentsTracking({token,onSelectOp}){
  const [ops,setOps]=useState([]);const [pkgs,setPkgs]=useState([]);const [items,setItems]=useState([]);const [lo,setLo]=useState(true);const [fChannel,setFChannel]=useState("");const [search,setSearch]=useState("");const [sortCol,setSortCol]=useState("op");const [sortDir,setSortDir]=useState("desc");
  const toggleSort=(col)=>{if(sortCol===col){setSortDir(d=>d==="asc"?"desc":"asc");}else{setSortCol(col);setSortDir("asc");}};
  useEffect(()=>{(async()=>{
    // Solo operaciones activas (no cerradas, no canceladas, no entregadas)
    const o=await dq("operations",{token,filters:"?select=*,clients(first_name,last_name,client_code)&status=neq.operacion_cerrada&status=neq.cancelada&status=neq.entregada&order=created_at.desc"});
    const opIds=Array.isArray(o)?o.map(x=>x.id):[];
    if(opIds.length===0){setOps([]);setPkgs([]);setItems([]);setLo(false);return;}
    const idsCsv=opIds.join(",");
    const [pk,it]=await Promise.all([
      dq("operation_packages",{token,filters:`?operation_id=in.(${idsCsv})&select=*&order=package_number.asc`}),
      dq("operation_items",{token,filters:`?operation_id=in.(${idsCsv})&select=*`})
    ]);
    setOps(o);setPkgs(Array.isArray(pk)?pk:[]);setItems(Array.isArray(it)?it:[]);setLo(false);
  })();},[token]);

  // Build rows according to channel logic
  const buildRows=()=>{const rows=[];
    ops.forEach(op=>{
      const cn=op.clients?`${op.clients.first_name} ${op.clients.last_name}`:"—";
      const opItems=items.filter(i=>i.operation_id===op.id);
      const opPkgs=pkgs.filter(p=>p.operation_id===op.id);
      const desc=op.description||opItems.map(i=>i.description).filter(Boolean).join(", ")||"—";
      const isCanalB=op.channel?.includes("negro");
      const isAereoA=op.channel==="aereo_blanco";
      const isMaritimoA=op.channel==="maritimo_blanco";
      if(isCanalB){
        // Una línea por bulto que tenga national_tracking
        const withTracking=opPkgs.filter(p=>p.national_tracking?.trim());
        if(withTracking.length===0){
          rows.push({op,client:cn,desc,origin:op.origin||"—",channel:op.channel,tracking:"—",carrier:null,trackingType:"Sin tracking"});
        } else {
          withTracking.forEach(p=>{
            rows.push({op,client:cn,desc,origin:op.origin||"—",channel:op.channel,tracking:p.national_tracking,carrier:null,trackingType:`Bulto ${p.package_number}`});
          });
        }
      } else if(isAereoA){
        // Tracking internacional + carrier
        const tr=op.international_tracking?.trim();
        const car=op.international_carrier?.trim();
        rows.push({op,client:cn,desc,origin:op.origin||"—",channel:op.channel,tracking:tr||"—",carrier:car||null,trackingType:car?car.toUpperCase():"Internacional"});
      } else if(isMaritimoA){
        // Solo info de mercadería, sin código
        rows.push({op,client:cn,desc,origin:op.origin||"—",channel:op.channel,tracking:"—",carrier:null,trackingType:"Marítimo"});
      }
    });
    return rows;
  };

  const allRows=buildRows();
  const filtered=allRows.filter(r=>{
    if(fChannel&&r.channel!==fChannel)return false;
    if(search){const s=search.toLowerCase();return r.client.toLowerCase().includes(s)||r.desc.toLowerCase().includes(s)||r.tracking.toLowerCase().includes(s)||r.op.operation_code.toLowerCase().includes(s);}
    return true;
  }).sort((a,b)=>{
    const getVal=(r)=>{if(sortCol==="op")return r.op.operation_code;if(sortCol==="client")return r.client;if(sortCol==="desc")return r.desc;if(sortCol==="origin")return r.origin;if(sortCol==="channel")return CM[r.channel]||r.channel;if(sortCol==="tracking")return r.tracking;return"";};
    const va=String(getVal(a)).toLowerCase(),vb=String(getVal(b)).toLowerCase();
    return sortDir==="asc"?va.localeCompare(vb):vb.localeCompare(va);
  });

  const carrierColors={DHL:"#fbbf24",FEDEX:"#a78bfa",UPS:"#fb923c"};
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div>
        <h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>Seguimientos en tránsito</h2>
        <p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0}}>{filtered.length} {filtered.length===1?"paquete":"paquetes"} en operaciones activas</p>
      </div>
      <div style={{display:"flex",gap:8}}>
        <input type="text" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{padding:"8px 12px",fontSize:12,border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/>
        <select value={fChannel} onChange={e=>setFChannel(e.target.value)} style={{padding:"8px 12px",fontSize:12,border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}>
          <option value="" style={{background:"#142038"}}>Todos los canales</option>
          {CHANNELS.map(c=><option key={c} value={c} style={{background:"#142038"}}>{CM[c]}</option>)}
        </select>
      </div>
    </div>
    {lo?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"3rem 0"}}>Cargando...</p>:filtered.length===0?<p style={{color:"rgba(255,255,255,0.45)",textAlign:"center",padding:"3rem 0"}}>No hay paquetes en tránsito</p>:
    <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.25)"}}>
          {[{k:"op",l:"Op"},{k:"client",l:"Cliente"},{k:"desc",l:"Mercadería"},{k:"origin",l:"Origen"},{k:"channel",l:"Canal"},{k:"tracking",l:"Tracking"}].map((h,hi)=><th key={hi} onClick={()=>h.k&&toggleSort(h.k)} style={{padding:"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:sortCol===h.k?IC:"rgba(255,255,255,0.4)",textTransform:"uppercase",cursor:h.k?"pointer":"default",userSelect:"none"}}>{h.l}{sortCol===h.k&&h.k&&<span style={{marginLeft:4}}>{sortDir==="asc"?"▲":"▼"}</span>}</th>)}
        </tr></thead>
        <tbody>{filtered.map((r,i)=>{const cc=r.carrier?carrierColors[r.carrier.toUpperCase()]||IC:null;return <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <td style={{padding:"12px 14px",fontFamily:"monospace",fontWeight:600,color:"#fff",fontSize:12,userSelect:"text"}}>{r.op.operation_code}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.7)",userSelect:"text"}}>{r.client}</td>
          <td style={{padding:"12px 14px",color:"#fff",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",userSelect:"text"}}>{r.desc}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)",userSelect:"text"}}>{r.origin==="China"?"🇨🇳":r.origin==="USA"?"🇺🇸":""} {r.origin}</td>
          <td style={{padding:"12px 14px"}}><span style={{fontSize:11,padding:"3px 8px",borderRadius:4,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.6)"}}>{CM[r.channel]||r.channel}</span></td>
          <td style={{padding:"12px 14px",userSelect:"text"}}>
            {r.tracking==="—"?<span style={{color:"rgba(255,255,255,0.4)",fontStyle:"italic",fontSize:12}}>{r.trackingType}</span>:<div>
              {cc&&<span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${cc}20`,color:cc,marginRight:6}}>{r.trackingType}</span>}
              {!cc&&<span style={{fontSize:10,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:2}}>{r.trackingType}</span>}
              <span style={{fontFamily:"monospace",fontSize:12,fontWeight:600,color:"#fff",userSelect:"all"}}>{r.tracking}</span>
            </div>}
          </td>
        </tr>;})}</tbody>
      </table>
    </div>}
  </div>;
}

// "Modo Hoy" — Dashboard ejecutivo con TODAS las tareas pendientes que requieren acción del admin.
// Cards clickeables que navegan a la sección correspondiente.
function TodayDashboard({token,onNav,onSelectOp,onSelectFlight}){
  const [data,setData]=useState(null);
  const [lo,setLo]=useState(true);
  const load=async()=>{
    setLo(true);
    const todayISO=new Date().toISOString().slice(0,10);
    const d3agoISO=new Date(Date.now()-3*24*60*60*1000).toISOString();
    const d5agoISO=new Date(Date.now()-5*24*60*60*1000).toISOString();
    const d1agoISO=new Date(Date.now()-24*60*60*1000).toISOString();
    const d7agoISO=new Date(Date.now()-7*24*60*60*1000).toISOString();
    const in7daysISO=new Date(Date.now()+7*24*60*60*1000).toISOString().slice(0,10);
    const [opsAll,flights,supPmts,purchaseNotifs,repackReqs]=await Promise.all([
      dq("operations",{token,filters:`?select=id,operation_code,status,is_collected,collected_amount,budget_total,delivered_at,client_id,description,created_at,channel,clients(client_code,first_name,last_name,whatsapp)&order=created_at.desc&limit=500`}),
      dq("flights",{token,filters:`?select=id,flight_code,status,invoice_presented_at,created_at,total_cost_usd,total_weight_kg&status=eq.preparando&invoice_presented_at=not.is.null&order=invoice_presented_at.desc`}),
      dq("operation_supplier_payments",{token,filters:`?select=id,operation_id,amount_usd,payment_date,is_paid,reference,operations(operation_code)&is_paid=eq.false&payment_date=lte.${todayISO}&order=payment_date.asc`}),
      dq("purchase_notifications",{token,filters:`?select=id,client_id,description,origin,shipping_method,created_at,clients(client_code,first_name)&status=eq.pending&created_at=lt.${d1agoISO}&order=created_at.asc`}),
      dq("repack_requests",{token,filters:`?select=id,operation_id,requested_at,operations(operation_code,clients(client_code,first_name))&status=eq.pending&order=requested_at.asc`})
    ]);
    const opsArr=Array.isArray(opsAll)?opsAll:[];
    // 1. Cobranzas vencidas (entregada/cerrada >3d sin cobrar)
    const cobranzasVencidas=opsArr.filter(o=>!o.is_collected&&["entregada","operacion_cerrada"].includes(o.status)&&o.delivered_at&&o.delivered_at<d3agoISO);
    // 2. Documentación pendiente cliente +5 días (canal A blanco en preparación sin items)
    // Para esto necesitamos saber qué ops tienen 0 items
    const aBlancoEnPrep=opsArr.filter(o=>o.channel==="aereo_blanco"&&o.status==="en_preparacion"&&o.created_at<d5agoISO);
    const idsToCheck=aBlancoEnPrep.map(o=>o.id);
    let docsPendientes=[];
    if(idsToCheck.length>0){
      const items=await dq("operation_items",{token,filters:`?operation_id=in.(${idsToCheck.join(",")})&select=operation_id`});
      const opsConItems=new Set((Array.isArray(items)?items:[]).map(i=>i.operation_id));
      docsPendientes=aBlancoEnPrep.filter(o=>!opsConItems.has(o.id));
    }
    // 3. Cotizaciones sin avanzar +7 días (saved_quotes sin op asociada o sin actividad)
    const quotes=await dq("saved_quotes",{token,filters:`?select=id,client_id,client_name,channel_name,total_cost,created_at,clients(client_code,first_name,whatsapp)&created_at=lt.${d7agoISO}&order=created_at.desc&limit=50`}).catch(()=>[]);
    // Sólo las que NO matchean con ninguna op del cliente creada DESPUÉS de la cotización
    const quotesArr=Array.isArray(quotes)?quotes:[];
    const cotizacionesPerdidas=quotesArr.filter(q=>{
      if(!q.client_id)return false;
      const opsDelCliente=opsArr.filter(o=>o.client_id===q.client_id&&o.created_at>q.created_at);
      return opsDelCliente.length===0;
    }).slice(0,10);
    setData({
      cobranzasVencidas,
      vuelosListos:Array.isArray(flights)?flights:[],
      pagosProveedor:Array.isArray(supPmts)?supPmts:[],
      avisosPendientes:Array.isArray(purchaseNotifs)?purchaseNotifs:[],
      docsPendientes,
      cotizacionesPerdidas,
      reempaques:Array.isArray(repackReqs)?repackReqs:[],
    });
    setLo(false);
  };
  useEffect(()=>{load();},[token]);
  if(lo||!data)return <p style={{padding:"3rem",textAlign:"center",color:"rgba(255,255,255,0.4)"}}>Cargando tareas pendientes…</p>;

  const totalTareas=data.cobranzasVencidas.length+data.vuelosListos.length+data.pagosProveedor.length+data.avisosPendientes.length+data.docsPendientes.length+data.cotizacionesPerdidas.length+data.reempaques.length;

  const Card=({title,emoji,count,color,items,renderItem,onClickAll,emptyMsg})=>{
    return <div style={{background:"rgba(255,255,255,0.028)",border:`1px solid ${count>0?color+"55":"rgba(255,255,255,0.06)"}`,borderRadius:14,padding:"16px 18px",display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{emoji} {title}</p>
          <p style={{fontSize:28,fontWeight:800,color:count>0?color:"rgba(255,255,255,0.3)",margin:0,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{count}</p>
        </div>
        {count>0&&onClickAll&&<button onClick={onClickAll} style={{padding:"6px 10px",fontSize:10,fontWeight:700,borderRadius:6,border:`1px solid ${color}66`,background:`${color}15`,color:color,cursor:"pointer",whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:"0.04em"}}>Ver todo →</button>}
      </div>
      {count===0?<p style={{fontSize:12,color:"rgba(255,255,255,0.35)",margin:0,fontStyle:"italic"}}>{emptyMsg||"Todo al día ✓"}</p>:<div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:160,overflow:"auto"}}>
        {items.slice(0,4).map((it,i)=>renderItem(it,i))}
        {items.length>4&&<p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"4px 0 0",textAlign:"center",fontStyle:"italic"}}>+{items.length-4} más</p>}
      </div>}
    </div>;
  };

  const itemRowStyle={padding:"6px 8px",background:"rgba(0,0,0,0.18)",borderRadius:5,fontSize:11,color:"rgba(255,255,255,0.75)",cursor:"pointer",transition:"background 120ms",border:"1px solid transparent"};
  const itemHover=e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";};
  const itemLeave=e=>{e.currentTarget.style.background="rgba(0,0,0,0.18)";e.currentTarget.style.borderColor="transparent";};

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:18,gap:12,flexWrap:"wrap"}}>
      <div>
        <h2 style={{fontSize:24,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>👋 Hola Bautista — Lo que tenés que hacer hoy</h2>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"4px 0 0"}}>{totalTareas===0?"🎉 ¡Todo al día! No hay tareas pendientes urgentes.":`${totalTareas} tarea${totalTareas>1?"s":""} pendiente${totalTareas>1?"s":""} en total`}</p>
      </div>
      <button onClick={load} style={{padding:"7px 14px",fontSize:11,fontWeight:600,borderRadius:7,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.6)",cursor:"pointer"}}>↻ Refrescar</button>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14}}>

      <Card title="Cobranzas vencidas" emoji="💰" count={data.cobranzasVencidas.length} color="#ef4444"
        items={data.cobranzasVencidas} onClickAll={()=>onNav&&onNav("operations")}
        emptyMsg="Ningún cliente debe (>3 días)"
        renderItem={(o,i)=><div key={i} onClick={()=>onSelectOp&&onSelectOp(o)} style={itemRowStyle} onMouseEnter={itemHover} onMouseLeave={itemLeave}>
          <strong style={{color:"#fff",fontFamily:"monospace"}}>{o.operation_code}</strong> · {o.clients?.client_code} · USD {Number(o.budget_total||0).toFixed(0)} · {Math.floor((Date.now()-new Date(o.delivered_at).getTime())/86400000)}d
        </div>}/>

      <Card title="Vuelos listos para despachar" emoji="✈️" count={data.vuelosListos.length} color="#22c55e"
        items={data.vuelosListos} onClickAll={()=>onNav&&onNav("agents")}
        emptyMsg="Ningún vuelo esperando despacho"
        renderItem={(f,i)=><div key={i} onClick={()=>onSelectFlight&&onSelectFlight(f)} style={itemRowStyle} onMouseEnter={itemHover} onMouseLeave={itemLeave}>
          <strong style={{color:"#fff",fontFamily:"monospace"}}>{f.flight_code}</strong> · factura presentada {formatDate(f.invoice_presented_at)}
        </div>}/>

      <Card title="Pagos a proveedor pendientes" emoji="💳" count={data.pagosProveedor.length} color="#f97316"
        items={data.pagosProveedor} onClickAll={()=>onNav&&onNav("operations")}
        emptyMsg="Ningún pago vencido"
        renderItem={(p,i)=><div key={i} style={itemRowStyle} onMouseEnter={itemHover} onMouseLeave={itemLeave}>
          <strong style={{color:"#fff",fontFamily:"monospace"}}>{p.operations?.operation_code||"—"}</strong> · USD {Number(p.amount_usd||0).toFixed(2)} · vence {formatDate(p.payment_date)}
        </div>}/>

      <Card title="Avisos compra sin confirmar +24h" emoji="📦" count={data.avisosPendientes.length} color="#fbbf24"
        items={data.avisosPendientes} onClickAll={()=>onNav&&onNav("purchase_notifs")}
        emptyMsg="Todos los avisos atendidos"
        renderItem={(n,i)=><div key={i} onClick={()=>onNav&&onNav("purchase_notifs")} style={itemRowStyle} onMouseEnter={itemHover} onMouseLeave={itemLeave}>
          <strong style={{color:"#fff",fontFamily:"monospace"}}>{n.clients?.client_code}</strong> · {n.description||"sin descripción"} · {n.origin?.toUpperCase()} {n.shipping_method}
        </div>}/>

      <Card title="Documentación pendiente cliente +5d" emoji="📋" count={data.docsPendientes.length} color="#a78bfa"
        items={data.docsPendientes} onClickAll={()=>onNav&&onNav("operations")}
        emptyMsg="Todos los clientes documentaron"
        renderItem={(o,i)=><div key={i} onClick={()=>onSelectOp&&onSelectOp(o)} style={itemRowStyle} onMouseEnter={itemHover} onMouseLeave={itemLeave}>
          <strong style={{color:"#fff",fontFamily:"monospace"}}>{o.operation_code}</strong> · {o.clients?.client_code} · creada hace {Math.floor((Date.now()-new Date(o.created_at).getTime())/86400000)}d
        </div>}/>

      <Card title="Cotizaciones sin respuesta +7d" emoji="💬" count={data.cotizacionesPerdidas.length} color="#60a5fa"
        items={data.cotizacionesPerdidas} onClickAll={()=>onNav&&onNav("quotes")}
        emptyMsg="Todas las cotizaciones convertidas o nuevas"
        renderItem={(q,i)=>{const wa=q.clients?.whatsapp?String(q.clients.whatsapp).replace(/[^0-9]/g,""):"";return <div key={i} style={{...itemRowStyle,display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}} onMouseEnter={itemHover} onMouseLeave={itemLeave}>
          <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><strong style={{color:"#fff",fontFamily:"monospace"}}>{q.clients?.client_code||"—"}</strong> · {q.channel_name||"—"} · USD {Number(q.total_cost||0).toFixed(0)}</span>
          {wa&&<a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{padding:"2px 8px",fontSize:9,fontWeight:700,borderRadius:4,background:"#25D366",color:"#fff",textDecoration:"none",whiteSpace:"nowrap"}}>WA</a>}
        </div>;}}/>

      <Card title="Reempaques pendientes" emoji="🔄" count={data.reempaques.length} color="#fb923c"
        items={data.reempaques} onClickAll={()=>onNav&&onNav("agents")}
        emptyMsg="Sin pedidos de reempaque"
        renderItem={(r,i)=><div key={i} style={itemRowStyle} onMouseEnter={itemHover} onMouseLeave={itemLeave}>
          <strong style={{color:"#fff",fontFamily:"monospace"}}>{r.operations?.operation_code||"—"}</strong> · {r.operations?.clients?.client_code||"—"} · pedido {formatDate(r.requested_at)}
        </div>}/>

    </div>
  </div>;
}

// Análisis de retención + LTV — vista de salud comercial del negocio
function RetentionLTVCard({token}){
  const [data,setData]=useState(null);
  const [lo,setLo]=useState(true);
  useEffect(()=>{(async()=>{
    setLo(true);
    const [clients,ops,payments]=await Promise.all([
      dq("clients",{token,filters:"?select=id,client_code,first_name,last_name,created_at,tier,whatsapp"}),
      dq("operations",{token,filters:"?select=id,client_id,created_at,closed_at,delivered_at,is_collected,collected_amount,budget_total,status&order=created_at.asc"}),
      dq("operation_client_payments",{token,filters:"?select=operation_id,amount_usd,payment_date"}),
    ]);
    const opsArr=Array.isArray(ops)?ops:[];
    const clientsArr=Array.isArray(clients)?clients:[];
    const pmtsArr=Array.isArray(payments)?payments:[];
    // LTV por cliente: suma de cobros reales (operation_client_payments) + collected_amount de ops cerradas sin GI
    const pmtByOp={};pmtsArr.forEach(p=>{pmtByOp[p.operation_id]=(pmtByOp[p.operation_id]||0)+Number(p.amount_usd||0);});
    const ltvByClient={};
    for(const op of opsArr){
      const cli=op.client_id;if(!cli)continue;
      let revenue=pmtByOp[op.id]||0;
      if(revenue===0&&op.is_collected)revenue=Number(op.collected_amount||op.budget_total||0);
      if(!ltvByClient[cli])ltvByClient[cli]={ltv:0,ops:0,firstOp:null,lastOp:null};
      ltvByClient[cli].ltv+=revenue;
      ltvByClient[cli].ops++;
      const created=op.created_at;
      if(!ltvByClient[cli].firstOp||created<ltvByClient[cli].firstOp)ltvByClient[cli].firstOp=created;
      if(!ltvByClient[cli].lastOp||created>ltvByClient[cli].lastOp)ltvByClient[cli].lastOp=created;
    }
    // Top 10 clientes por LTV
    const topClients=clientsArr.map(c=>{const x=ltvByClient[c.id]||{ltv:0,ops:0};return {...c,ltv:x.ltv,ops:x.ops,firstOp:x.firstOp,lastOp:x.lastOp};}).filter(c=>c.ltv>0).sort((a,b)=>b.ltv-a.ltv).slice(0,10);
    // Análisis de retención por cohorte mensual
    const cohorts={};
    for(const c of clientsArr){
      const cm=String(c.created_at||"").slice(0,7);
      if(!cohorts[cm])cohorts[cm]={signed:0,activated:0,returned30:0,returned90:0,returned180:0};
      cohorts[cm].signed++;
      const x=ltvByClient[c.id];
      if(!x||x.ops===0)continue;
      cohorts[cm].activated++;
      const firstMs=new Date(x.firstOp).getTime();
      const lastMs=new Date(x.lastOp).getTime();
      const sinceFirst=(lastMs-firstMs)/86400000;
      if(x.ops>1&&sinceFirst<=30)cohorts[cm].returned30++;
      if(x.ops>1&&sinceFirst<=90)cohorts[cm].returned90++;
      if(x.ops>1&&sinceFirst<=180)cohorts[cm].returned180++;
    }
    // Métricas globales
    const ltvAll=Object.values(ltvByClient).map(x=>x.ltv).filter(v=>v>0);
    const ltvAvg=ltvAll.length>0?ltvAll.reduce((s,v)=>s+v,0)/ltvAll.length:0;
    const ltvMedian=ltvAll.length>0?[...ltvAll].sort((a,b)=>a-b)[Math.floor(ltvAll.length/2)]:0;
    const totalActivated=Object.values(ltvByClient).filter(x=>x.ops>0).length;
    const repeatCustomers=Object.values(ltvByClient).filter(x=>x.ops>=2).length;
    const repeatRate=totalActivated>0?(repeatCustomers/totalActivated)*100:0;
    // Inactivos: clientes activados que hace +60d no operan
    const d60agoMs=Date.now()-60*86400000;
    const inactiveClients=clientsArr.filter(c=>{const x=ltvByClient[c.id];return x&&x.ops>0&&new Date(x.lastOp).getTime()<d60agoMs;}).map(c=>{const x=ltvByClient[c.id];return {...c,ltv:x.ltv,ops:x.ops,lastOp:x.lastOp,daysInactive:Math.floor((Date.now()-new Date(x.lastOp).getTime())/86400000)};}).sort((a,b)=>b.ltv-a.ltv).slice(0,15);

    setData({topClients,cohorts:Object.entries(cohorts).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,8),ltvAvg,ltvMedian,totalActivated,repeatCustomers,repeatRate,inactiveClients});
    setLo(false);
  })();},[token]);
  if(lo||!data)return <div style={{padding:"3rem",textAlign:"center",color:"rgba(255,255,255,0.4)"}}>Calculando análisis…</div>;
  const usdF=v=>`USD ${Number(v||0).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  return <>
    <h2 style={{fontSize:18,fontWeight:700,color:"#fff",margin:"0 0 14px",letterSpacing:"-0.01em"}}>📈 Retención & LTV</h2>

    {/* Métricas globales */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:18}}>
      <div style={{padding:"14px 18px",background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.18)",borderRadius:12}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase"}}>LTV promedio</p>
        <p style={{fontSize:22,fontWeight:800,color:"#22c55e",margin:"4px 0 0",fontVariantNumeric:"tabular-nums"}}>{usdF(data.ltvAvg)}</p>
        <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"3px 0 0"}}>Mediana: {usdF(data.ltvMedian)}</p>
      </div>
      <div style={{padding:"14px 18px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.18)",borderRadius:12}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase"}}>Tasa de recompra</p>
        <p style={{fontSize:22,fontWeight:800,color:"#60a5fa",margin:"4px 0 0",fontVariantNumeric:"tabular-nums"}}>{data.repeatRate.toFixed(0)}%</p>
        <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"3px 0 0"}}>{data.repeatCustomers} de {data.totalActivated} activados</p>
      </div>
      <div style={{padding:"14px 18px",background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:12}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase"}}>Clientes activados</p>
        <p style={{fontSize:22,fontWeight:800,color:GOLD_LIGHT,margin:"4px 0 0",fontVariantNumeric:"tabular-nums"}}>{data.totalActivated}</p>
        <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"3px 0 0"}}>al menos 1 operación</p>
      </div>
      <div style={{padding:"14px 18px",background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase"}}>Inactivos +60d</p>
        <p style={{fontSize:22,fontWeight:800,color:"#ef4444",margin:"4px 0 0",fontVariantNumeric:"tabular-nums"}}>{data.inactiveClients.length}</p>
        <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"3px 0 0"}}>candidatos a reactivar</p>
      </div>
    </div>

    {/* Top 10 clientes por LTV */}
    <Card title="🏆 Top 10 clientes por LTV (lifetime value)">
      {data.topClients.length===0?<p style={{color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>Sin datos suficientes</p>:<div style={{display:"flex",flexDirection:"column",gap:6}}>
        {data.topClients.map((c,i)=><div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:i<3?"rgba(184,149,106,0.06)":"rgba(255,255,255,0.025)",border:`1px solid ${i<3?"rgba(184,149,106,0.2)":"rgba(255,255,255,0.06)"}`,borderRadius:8,gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:200}}>
            <span style={{fontSize:14,fontWeight:800,color:i<3?GOLD_LIGHT:"rgba(255,255,255,0.5)",minWidth:24}}>{i+1}.</span>
            <div>
              <p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}><strong style={{color:GOLD_LIGHT,fontFamily:"monospace",fontSize:11,marginRight:8}}>{c.client_code}</strong>{c.first_name} {c.last_name||""}</p>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"2px 0 0"}}>{c.ops} op{c.ops!==1?"s":""} · ticket prom. {usdF(c.ltv/c.ops)}{c.tier&&c.tier!=="standard"?` · ${c.tier}`:""}</p>
            </div>
          </div>
          <span style={{fontSize:16,fontWeight:800,color:"#22c55e",fontVariantNumeric:"tabular-nums"}}>{usdF(c.ltv)}</span>
        </div>)}
      </div>}
    </Card>

    {/* Cohortes de retención */}
    <Card title="📊 Análisis de cohortes (clientes nuevos por mes)">
      <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"0 0 12px"}}>De los clientes que se registraron cada mes, cuántos hicieron 1+ operación y cuántos volvieron a comprar.</p>
      {data.cohorts.length===0?<p style={{color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>Sin datos</p>:<div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
            {["Mes","Registrados","Activados","%","Volvieron a 30d","Volvieron a 90d","Volvieron a 180d"].map((h,i)=><th key={i} style={{padding:"8px 10px",textAlign:i===0?"left":"center",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>{h}</th>)}
          </tr></thead>
          <tbody>{data.cohorts.map(([month,c])=>{const actPct=c.signed>0?(c.activated/c.signed)*100:0;return <tr key={month} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <td style={{padding:"8px 10px",color:"#fff",fontWeight:600}}>{month}</td>
            <td style={{padding:"8px 10px",textAlign:"center",color:"rgba(255,255,255,0.7)"}}>{c.signed}</td>
            <td style={{padding:"8px 10px",textAlign:"center",color:"rgba(255,255,255,0.85)",fontWeight:600}}>{c.activated}</td>
            <td style={{padding:"8px 10px",textAlign:"center",color:actPct>=50?"#22c55e":actPct>=25?"#fbbf24":"#ef4444",fontWeight:700}}>{actPct.toFixed(0)}%</td>
            <td style={{padding:"8px 10px",textAlign:"center",color:"rgba(255,255,255,0.6)"}}>{c.returned30}</td>
            <td style={{padding:"8px 10px",textAlign:"center",color:"rgba(255,255,255,0.6)"}}>{c.returned90}</td>
            <td style={{padding:"8px 10px",textAlign:"center",color:"rgba(255,255,255,0.6)"}}>{c.returned180}</td>
          </tr>;})}</tbody>
        </table>
      </div>}
    </Card>

    {/* Inactivos a reactivar */}
    <Card title="⚠ Clientes inactivos +60 días — candidatos a reactivar">
      {data.inactiveClients.length===0?<p style={{color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>No hay clientes inactivos 🎉</p>:<div style={{display:"flex",flexDirection:"column",gap:6}}>
        {data.inactiveClients.map(c=>{const wa=c.whatsapp?String(c.whatsapp).replace(/[^0-9]/g,""):"";const msg=encodeURIComponent(`Hola ${c.first_name}! ¿Cómo va? Te escribo para saber si tenés algún proyecto de importación en mente. Hace tiempo que no charlamos. Avisame si necesitás cotizar algo, dale!`);return <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,gap:10,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            <p style={{fontSize:13,color:"#fff",margin:0}}><strong style={{color:GOLD_LIGHT,fontFamily:"monospace",fontSize:11,marginRight:8}}>{c.client_code}</strong>{c.first_name} {c.last_name||""}</p>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"2px 0 0"}}>{c.ops} op{c.ops!==1?"s":""} · LTV {usdF(c.ltv)} · sin operar hace <strong style={{color:"#fb923c"}}>{c.daysInactive} días</strong></p>
          </div>
          {wa&&<a href={`https://wa.me/${wa}?text=${msg}`} target="_blank" rel="noopener noreferrer" style={{padding:"6px 12px",fontSize:11,fontWeight:700,borderRadius:6,background:"#25D366",color:"#fff",textDecoration:"none",whiteSpace:"nowrap"}}>📱 WhatsApp</a>}
        </div>;})}
      </div>}
    </Card>
  </>;
}

function DashboardKPIs({token}){
  const [data,setData]=useState(null);const [lo,setLo]=useState(true);
  useEffect(()=>{(async()=>{
    const now=new Date();const y=now.getFullYear();const m=String(now.getMonth()+1).padStart(2,"0");
    const [ops,flights,unPkgs,signups,cardUsd,cardArs]=await Promise.all([
      dq("operations",{token,filters:"?select=id,operation_code,status,budget_total,total_anticipos,eta,updated_at,created_at,consolidation_confirmed"}),
      dq("flights",{token,filters:"?select=id,status"}),
      dq("unassigned_packages",{token,filters:"?select=id,created_at&assigned_to_op_id=is.null"}),
      dq("agent_signups",{token,filters:"?select=id&status=eq.pending"}),
      dq("payment_management",{token,filters:"?select=giro_amount_usd,giro_tarjeta_due_date&giro_payment_method=eq.tarjeta_credito&giro_tarjeta_paid=eq.false"}),
      dq("finance_entries",{token,filters:"?select=amount,amount_ars,currency,card_closing_date&payment_method=eq.tarjeta_credito&is_paid=eq.false"})
    ]);
    const o=Array.isArray(ops)?ops:[];const fl=Array.isArray(flights)?flights:[];
    const finalStates=["entregada","operacion_cerrada","cancelada"];
    const activeOps=o.filter(x=>!finalStates.includes(x.status));
    const transitOps=o.filter(x=>x.status==="en_transito");
    const activeFlights=fl.filter(x=>x.status==="preparando"||x.status==="despachado");
    const monthOps=o.filter(x=>x.created_at&&x.created_at.slice(0,7)===`${y}-${m}`);
    const ingresosMes=monthOps.reduce((s,x)=>s+Number(x.budget_total||0),0);
    const fiveDaysAgo=new Date(now-5*86400000).toISOString();
    const staleOps=o.filter(x=>!finalStates.includes(x.status)&&x.updated_at&&x.updated_at<fiveDaysAgo);
    const todayStr=now.toISOString().slice(0,10);
    const transitStates=["en_transito","en_aduana","preparando_envio"];
    const etaPassed=o.filter(x=>x.eta&&x.eta<todayStr&&transitStates.includes(x.status));
    // Nuevas alertas
    const threeDaysAgo=new Date(now-3*86400000).toISOString();
    const orphanPkgsArr=(Array.isArray(unPkgs)?unPkgs:[]);
    const orphanPkgsOld=orphanPkgsArr.filter(p=>p.created_at&&p.created_at<threeDaysAgo);
    // Clientes con anticipo > budget (saldo a favor)
    const saldoFavorOps=o.filter(x=>!finalStates.includes(x.status)&&Number(x.total_anticipos||0)>Number(x.budget_total||0)&&Number(x.budget_total||0)>0);
    // Ops activas sin presupuesto calculado
    const sinBudgetOps=o.filter(x=>!finalStates.includes(x.status)&&x.status!=="pendiente"&&x.status!=="en_deposito_origen"&&Number(x.budget_total||0)===0);
    // Deuda tarjeta USD (gestión de pagos pendiente de débito)
    const cardUsdArr=Array.isArray(cardUsd)?cardUsd:[];
    const deudaTarjetaUsd=cardUsdArr.reduce((s,p)=>s+Number(p.giro_amount_usd||0),0);
    const cardArsArr=Array.isArray(cardArs)?cardArs:[];
    const deudaTarjetaArsExtra=cardArsArr.filter(e=>e.currency!=="USD").reduce((s,e)=>s+Number(e.amount_ars||e.amount||0),0);
    const deudaTarjetaUsdExtra=cardArsArr.filter(e=>e.currency==="USD").reduce((s,e)=>s+Number(e.amount||0),0);
    setData({activeOps:activeOps.length,transitOps:transitOps.length,activeFlights:activeFlights.length,ingresosMes,staleOps,etaPassed,orphanPkgsOld,saldoFavorOps,sinBudgetOps,pendingAgents:(Array.isArray(signups)?signups:[]).length,deudaTarjetaUsd:deudaTarjetaUsd+deudaTarjetaUsdExtra,deudaTarjetaArs:deudaTarjetaArsExtra,cardUsdCount:cardUsdArr.length+cardArsArr.filter(e=>e.currency==="USD").length,cardArsCount:cardArsArr.filter(e=>e.currency!=="USD").length});
    setLo(false);
  })();},[token]);
  if(lo)return <p style={{color:"rgba(255,255,255,0.5)",padding:20}}>Cargando dashboard...</p>;
  if(!data)return null;
  const opsAlerts=[
    {label:"Ops Estancadas",desc:"Sin cambios hace +5 días",value:data.staleOps.length,color:"#ef4444",items:data.staleOps.slice(0,10).map(x=>x.operation_code||x.id)},
    {label:"ETA Pasada",desc:"En tránsito con ETA vencida",value:data.etaPassed.length,color:"#ef4444",items:data.etaPassed.slice(0,10).map(x=>x.operation_code||x.id)},
    {label:"Paquetes Huérfanos",desc:"Sin asignar hace +3 días",value:data.orphanPkgsOld.length,color:"#f59e0b"},
    {label:"Sin Presupuesto",desc:"Activa sin budget calculado",value:data.sinBudgetOps.length,color:"#f59e0b",items:data.sinBudgetOps.slice(0,10).map(x=>x.operation_code||x.id)},
    {label:"Saldo a Favor",desc:"Anticipo > presupuesto",value:data.saldoFavorOps.length,color:"#3b82f6",items:data.saldoFavorOps.slice(0,10).map(x=>x.operation_code||x.id)},
    {label:"Agentes Pendientes",desc:"Solicitudes por aprobar",value:data.pendingAgents,color:"#f59e0b"}
  ];
  const hasOpsAlerts=opsAlerts.some(a=>a.value>0);
  return <div style={{marginBottom:28}}>
    {hasOpsAlerts&&<>
      <h2 style={{fontSize:16,fontWeight:700,color:"rgba(255,255,255,0.7)",margin:"20px 0 12px"}}>Alertas operativas</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginBottom:24}}>
        {opsAlerts.filter(a=>a.value>0).map((a,i)=><div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,border:`1px solid ${a.color}33`,padding:"14px 16px",borderLeft:`3px solid ${a.color}`}}>
          <div style={{fontSize:20,fontWeight:800,color:a.color,marginBottom:2}}>{a.value}</div>
          <div style={{fontSize:12,fontWeight:700,color:"#fff",marginBottom:2}}>{a.label}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{a.desc}</div>
          {a.items&&a.items.length>0&&<div style={{marginTop:6,fontSize:10,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>{a.items.map((c,j)=><span key={j} style={{display:"inline-block",background:"rgba(255,255,255,0.08)",borderRadius:4,padding:"2px 6px",marginRight:4,marginBottom:4}}>{c}</span>)}</div>}
        </div>)}
      </div>
    </>}
  </div>;
}

function OperationalAnalytics({token}){
  const [data,setData]=useState(null);
  useEffect(()=>{(async()=>{
    const [ops,fbs,clients,pmsRaw]=await Promise.all([
      dq("operations",{token,filters:"?select=id,operation_code,status,channel,service_type,budget_total,collected_amount,collection_currency,collection_exchange_rate,credit_applied_usd,discount_applied_usd,is_collected,cost_flete,cost_impuestos_reales,cost_gasto_documental,cost_seguro,cost_flete_local,cost_otros,cost_producto_usd,created_at,closed_at,client_id,clients(first_name,last_name,client_code)&order=created_at.desc"}),
      dq("op_feedback",{token,filters:"?select=operation_id,rating"}),
      dq("clients",{token,filters:"?select=id,first_name,last_name,client_code,loyalty_level"}),
      dq("payment_management",{token,filters:"?select=operation_id,client_amount_usd,giro_amount_usd,cost_comision_giro"})
    ]);
    const o=Array.isArray(ops)?ops:[];const fb=Array.isArray(fbs)?fbs:[];const cl=Array.isArray(clients)?clients:[];
    const closed=o.filter(x=>x.status==="operacion_cerrada");
    const active=o.filter(x=>!["operacion_cerrada","cancelada"].includes(x.status));
    // Forecast: suma budget de activas (menos entregada, ya paga en teoría)
    const forecast=active.reduce((s,x)=>s+Number(x.budget_total||0),0);
    // Tasa de review
    const fbSet=new Set(fb.map(f=>f.operation_id));
    const reviewRate=closed.length>0?(closed.filter(c=>fbSet.has(c.id)).length/closed.length)*100:0;
    const avgRating=fb.length>0?fb.reduce((s,f)=>s+Number(f.rating||0),0)/fb.length:0;
    // Tiempo promedio: created → closed_at (días)
    const durations=closed.filter(c=>c.created_at&&c.closed_at).map(c=>{
      const ms=new Date(c.closed_at)-new Date(c.created_at);return ms/(1000*60*60*24);
    });
    const avgCycleDays=durations.length>0?durations.reduce((a,b)=>a+b,0)/durations.length:0;
    // Top clientes por GANANCIA (closed only, 90 días)
    const since=new Date(Date.now()-90*86400000);
    const recent=closed.filter(c=>c.closed_at&&new Date(c.closed_at)>=since);
    const pms=Array.isArray(pmsRaw)?pmsRaw:[];
    const pmByOp={};pms.forEach(p=>{if(!pmByOp[p.operation_id])pmByOp[p.operation_id]=[];pmByOp[p.operation_id].push(p);});
    const calcOpGan=(o)=>{
      let ing;
      if(o.is_collected){
        const raw=Number(o.collected_amount||0);
        const isArs=o.collection_currency==="ARS";const rate=Number(o.collection_exchange_rate||0);
        const cash=isArs&&rate>0?raw/rate:raw;
        const bt=Number(o.budget_total||0);
        const cashForOp=bt>0?Math.min(cash,bt):cash;
        ing=cashForOp+Number(o.credit_applied_usd||0)+Number(o.discount_applied_usd||0);
        if(ing<=0)ing=bt;
      } else ing=Number(o.budget_total||0);
      const costProd=o.service_type==="gestion_integral"?Number(o.cost_producto_usd||0):0;
      const cost=Number(o.cost_flete||0)+costProd+Number(o.cost_impuestos_reales||0)+Number(o.cost_gasto_documental||0)+Number(o.cost_seguro||0)+Number(o.cost_flete_local||0)+Number(o.cost_otros||0);
      const pm=pmByOp[o.id]||[];
      const pmGan=pm.reduce((s,p)=>s+Number(p.client_amount_usd||0)-Number(p.giro_amount_usd||0)-Number(p.cost_comision_giro||0),0);
      return(ing-cost)+pmGan;
    };
    const byCli={};
    for(const c of recent){
      const k=c.client_id;if(!k)continue;
      if(!byCli[k])byCli[k]={name:`${c.clients?.first_name||""} ${c.clients?.last_name||""}`.trim()||c.clients?.client_code||"—",code:c.clients?.client_code||"",count:0,gan:0};
      byCli[k].count+=1;byCli[k].gan+=calcOpGan(c);
    }
    const topClients=Object.values(byCli).sort((a,b)=>b.gan-a.gan).slice(0,10);
    // Distribución por canal (closed)
    const byCh={};for(const c of closed){const k=c.channel||"—";byCh[k]=(byCh[k]||0)+1;}
    const totalClosed=closed.length||1;
    const chDist=Object.entries(byCh).map(([k,v])=>({ch:k,count:v,pct:(v/totalClosed)*100})).sort((a,b)=>b.count-a.count);
    // Loyalty: cuántos clientes plus
    const plusCount=cl.filter(x=>x.loyalty_level==="plus").length;
    setData({closedCount:closed.length,activeCount:active.length,forecast,reviewRate,avgRating,avgCycleDays,topClients,chDist,plusCount,totalClients:cl.length});
  })();},[token]);
  if(!data)return null;
  const NAVY="#152D54",AC="#3B7DD8";
  const card={background:"rgba(255,255,255,0.04)",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",padding:"14px 16px"};
  const chLbl={aereo_blanco:"Aéreo A (courier)",aereo_negro:"Aéreo B (AC)",maritimo_blanco:"Marítimo A",maritimo_negro:"Marítimo B (AC)"};
  return <div style={{marginBottom:28}}>
    <h2 style={{fontSize:16,fontWeight:700,color:"rgba(255,255,255,0.7)",margin:"20px 0 12px"}}>Analytics operacionales</h2>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:14}}>
      <div style={card}><div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>Forecast activas</div><div style={{fontSize:20,fontWeight:800,color:"#22c55e",marginTop:4}}>USD {data.forecast.toLocaleString("en-US",{maximumFractionDigits:0})}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>{data.activeCount} ops en curso</div></div>
      <div style={card}><div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>Ciclo promedio</div><div style={{fontSize:20,fontWeight:800,color:"#fff",marginTop:4}}>{data.avgCycleDays.toFixed(1)} días</div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>creación → cierre</div></div>
      <div style={card}><div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>Tasa de review</div><div style={{fontSize:20,fontWeight:800,color:"#fbbf24",marginTop:4}}>{data.reviewRate.toFixed(0)}%</div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>⭐ {data.avgRating.toFixed(1)} promedio</div></div>
      <div style={card}><div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>Clientes Plus</div><div style={{fontSize:20,fontWeight:800,color:AC,marginTop:4}}>{data.plusCount}<span style={{fontSize:12,color:"rgba(255,255,255,0.4)",fontWeight:500}}>/{data.totalClients}</span></div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>loyalty</div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12}}>
      <div style={card}>
        <h3 style={{fontSize:13,fontWeight:700,color:"#fff",margin:"0 0 10px"}}>Top clientes por ganancia (últimos 90 días)</h3>
        {data.topClients.length===0?<p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0}}>Sin datos</p>:
        <div style={{display:"flex",flexDirection:"column",gap:6}}>{data.topClients.map((c,i)=>{const maxAbs=Math.max(...data.topClients.map(x=>Math.abs(x.gan)),1);const pct=(Math.abs(c.gan)/maxAbs)*100;const ganColor=c.gan>=0?"#22c55e":"#ff6b6b";return <div key={i} style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:10,color:"rgba(255,255,255,0.45)",width:18,fontWeight:700}}>#{i+1}</span><div style={{flex:1,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:3}}><span style={{fontSize:12,color:"#fff",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name} <span style={{color:"rgba(255,255,255,0.35)",fontFamily:"monospace",fontSize:10}}>({c.code})</span></span><span style={{fontSize:12,fontWeight:700,color:ganColor}}>USD {c.gan.toLocaleString("en-US",{maximumFractionDigits:0})}</span></div><div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:c.gan>=0?`linear-gradient(90deg,${NAVY},${AC})`:"#ff6b6b",borderRadius:2}}/></div><div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:2}}>{c.count} op{c.count!==1?"s":""}</div></div></div>;})}</div>}
      </div>
      <div style={card}>
        <h3 style={{fontSize:13,fontWeight:700,color:"#fff",margin:"0 0 10px"}}>Distribución por canal</h3>
        {data.chDist.length===0?<p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0}}>Sin ops cerradas</p>:
        <div style={{display:"flex",flexDirection:"column",gap:8}}>{data.chDist.map((c,i)=><div key={i}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}><span style={{color:"rgba(255,255,255,0.7)"}}>{chLbl[c.ch]||c.ch}</span><span style={{color:"#fff",fontWeight:700}}>{c.count} · {c.pct.toFixed(0)}%</span></div><div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}><div style={{width:`${c.pct}%`,height:"100%",background:AC,borderRadius:3}}/></div></div>)}</div>}
      </div>
    </div>
  </div>;
}

function FinanceDashboard({token}){
  const [ops,setOps]=useState([]);const [clients,setClients]=useState([]);const [quotes,setQuotes]=useState([]);const [finEntries,setFinEntries]=useState([]);const [pmtsByOp,setPmtsByOp]=useState({});const [agentMvs,setAgentMvs]=useState([]);const [supplierPmts,setSupplierPmts]=useState([]);const [clientPmts,setClientPmts]=useState([]);const [lo,setLo]=useState(true);const [period,setPeriod]=useState("month");const [selMonth,setSelMonth]=useState(()=>{const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;});
  useEffect(()=>{(async()=>{const [o,c,q,fe,pm,am,sp,cp]=await Promise.all([dq("operations",{token,filters:"?select=*,clients(first_name,last_name,client_code)&order=created_at.desc"}),dq("clients",{token,filters:"?select=*"}),dq("quotes",{token,filters:"?select=*&order=created_at.desc"}),dq("finance_entries",{token,filters:"?select=*&order=date.desc"}),dq("payment_management",{token,filters:"?select=operation_id,client_amount_usd,giro_amount_usd,cost_comision_giro,client_paid,giro_status,giro_payment_method,giro_tarjeta_paid"}),dq("agent_account_movements",{token,filters:"?select=*&order=date.desc"}),dq("operation_supplier_payments",{token,filters:"?select=*&order=payment_date.asc"}),dq("operation_client_payments",{token,filters:"?select=*&order=payment_date.asc"})]);setOps(Array.isArray(o)?o:[]);setClients(Array.isArray(c)?c:[]);setQuotes(Array.isArray(q)?q:[]);setFinEntries(Array.isArray(fe)?fe:[]);setAgentMvs(Array.isArray(am)?am:[]);setSupplierPmts(Array.isArray(sp)?sp:[]);setClientPmts(Array.isArray(cp)?cp:[]);const m={};(Array.isArray(pm)?pm:[]).forEach(p=>{if(!m[p.operation_id])m[p.operation_id]=[];m[p.operation_id].push(p);});setPmtsByOp(m);setLo(false);})();},[token]);

  const now=new Date();const thisMonth=now.getMonth();const thisYear=now.getFullYear();
  const today=now.toISOString().slice(0,10);const weekAgo=new Date(now-7*86400000).toISOString().slice(0,10);
  const parseLocalDate=(d)=>{const s=String(d).slice(0,10);if(s.match(/^\d{4}-\d{2}-\d{2}$/)){const[y,m,day]=s.split("-");return{y:Number(y),m:Number(m)-1,d:Number(day),ds:s};}return{y:0,m:0,d:0,ds:""};};
  const [selY,selM]=(selMonth||"").split("-").map(Number);
  const filterByPeriod=(items,dateField)=>{if(period==="all")return items;return items.filter(i=>{if(!i[dateField])return false;const p=parseLocalDate(i[dateField]);if(period==="today")return p.ds===today;if(period==="week")return p.ds>=weekAgo;if(period==="month")return p.m===(selM-1)&&p.y===selY;if(period==="year")return p.y===thisYear;return true;});};

  const closedOps=ops.filter(o=>o.status==="operacion_cerrada");
  const activeOps=ops.filter(o=>o.status!=="operacion_cerrada"&&o.status!=="cancelada");
  const periodOps=filterByPeriod(closedOps,"closed_at");

  const calcGan=(o)=>{
    // Ingreso: si está cobrada, usar collected_amount (real); sino budget_total (presupuesto)
    let baseIng;
    if(o.is_collected){
      const raw=Number(o.collected_amount||o.budget_total||0);
      const isArs=o.collection_currency==="ARS";const rate=Number(o.collection_exchange_rate||0);
      const cash=isArs&&rate>0?raw/rate:raw;
      // Cap cash al budget_total: el excedente fue a CC, no es ingreso de op
      const bt=Number(o.budget_total||0);
      const cashForOp=bt>0?Math.min(cash,bt):cash;
      baseIng=cashForOp+Number(o.credit_applied_usd||0)+Number(o.discount_applied_usd||0);
    } else {
      baseIng=Number(o.budget_total||0);
    }
    const costProducto=o.service_type==="gestion_integral"?Number(o.cost_producto_usd||0):0;
    const baseCost=Number(o.cost_flete||0)+costProducto+Number(o.cost_impuestos_reales||0)+Number(o.cost_gasto_documental||0)+Number(o.cost_seguro||0)+Number(o.cost_flete_local||0)+Number(o.cost_otros||0);
    const pmts=pmtsByOp[o.id]||[];
    const pmtIng=pmts.reduce((s,p)=>s+Number(p.client_amount_usd||0),0);
    const pmtCost=pmts.reduce((s,p)=>s+Number(p.giro_amount_usd||0)+Number(p.cost_comision_giro||0),0);
    const ing=baseIng+pmtIng;
    const cost=baseCost+pmtCost;
    return{ing,cost,gan:ing-cost};
  };

  const totalIng=periodOps.reduce((s,o)=>s+calcGan(o).ing,0);
  const totalCostOp=periodOps.reduce((s,o)=>s+calcGan(o).cost,0);
  // Costos fijos del período (manuales)
  const fixedCostsManual=finEntries.filter(e=>e.auto_generated===false&&e.type==="gasto");
  const totalCostFijos=filterByPeriod(fixedCostsManual,"date").reduce((s,e)=>s+Number(e.amount||0),0);
  const totalCost=totalCostOp+totalCostFijos;
  const totalGan=totalIng-totalCost;
  const margen=totalIng>0?((totalGan/totalIng)*100):0;

  // By channel with margin
  const byChannel={};periodOps.forEach(o=>{const ch=o.channel||"unknown";if(!byChannel[ch])byChannel[ch]={count:0,ing:0,cost:0};byChannel[ch].count++;const g=calcGan(o);byChannel[ch].ing+=g.ing;byChannel[ch].cost+=g.cost;});

  // By origin
  const byOrigin={};periodOps.forEach(o=>{const or=o.origin||"China";if(!byOrigin[or])byOrigin[or]={count:0,ing:0};byOrigin[or].count++;byOrigin[or].ing+=calcGan(o).ing;});

  // Top clients sorted by PROFIT
  const byClient={};periodOps.forEach(o=>{const cn=o.clients?`${o.clients.first_name} ${o.clients.last_name}`:"—";if(!byClient[cn])byClient[cn]={count:0,ing:0,gan:0};byClient[cn].count++;const g=calcGan(o);byClient[cn].ing+=g.ing;byClient[cn].gan+=g.gan;});
  const topClients=Object.entries(byClient).sort((a,b)=>b[1].gan-a[1].gan).slice(0,5);
  const maxClientGan=topClients.length>0?Math.max(...topClients.map(([,d])=>Math.abs(d.gan)),1):1;

  // Monthly profit (last 6 months)
  const MN=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const monthly=[];for(let i=5;i>=0;i--){const d=new Date(thisYear,thisMonth-i,1);const m=d.getMonth();const y=d.getFullYear();const mOps=closedOps.filter(o=>{if(!o.closed_at)return false;const p=parseLocalDate(o.closed_at);return p.m===m&&p.y===y;});const ing=mOps.reduce((s,o)=>s+calcGan(o).ing,0);const cost=mOps.reduce((s,o)=>s+calcGan(o).cost,0);monthly.push({label:`${MN[m]} ${y}`,ing,cost,gan:ing-cost,ops:mOps.length});}
  const maxMonthGan=Math.max(...monthly.map(m=>Math.abs(m.gan)),1);
  const maxMonthOps=Math.max(...monthly.map(m=>m.ops),1);

  // Cost breakdown
  const costBreakdown=[
    {label:"Flete",value:periodOps.reduce((s,o)=>s+Number(o.cost_flete||0),0),color:"#60a5fa"},
    {label:"Impuestos",value:periodOps.reduce((s,o)=>s+Number(o.cost_impuestos_reales||0),0),color:"#f97316"},
    {label:"Gasto doc.",value:periodOps.reduce((s,o)=>s+Number(o.cost_gasto_documental||0),0),color:"#a78bfa"},
    {label:"Seguro",value:periodOps.reduce((s,o)=>s+Number(o.cost_seguro||0),0),color:"#fbbf24"},
    {label:"Flete local",value:periodOps.reduce((s,o)=>s+Number(o.cost_flete_local||0),0),color:"#34d399"},
    {label:"Otros",value:periodOps.reduce((s,o)=>s+Number(o.cost_otros||0),0),color:"#fb7185"}
  ].filter(c=>c.value>0);
  const totalCostBreak=costBreakdown.reduce((s,c)=>s+c.value,0);

  const newClients=clients.filter(c=>{const d=new Date(c.created_at);return d.getMonth()===thisMonth&&d.getFullYear()===thisYear;}).length;
  const pendingQuotes=quotes.filter(q=>q.status==="pending").length;

  const usd=v=>`USD ${v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const stat=(l,v,color,big)=><div style={{background:"rgba(255,255,255,0.028)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px 20px"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",textTransform:"uppercase"}}>{l}</p><p style={{fontSize:big?28:20,fontWeight:700,color:color||"#fff",margin:0}}>{v}</p></div>;
  const bar=(pct,color)=><div style={{flex:1,height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden"}}><div style={{width:`${Math.min(Math.max(pct,0),100)}%`,height:"100%",background:color,borderRadius:4,transition:"width 0.3s"}}/></div>;

  if(lo)return <p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"2rem 0"}}>Cargando...</p>;

  // === TERMÓMETRO FINANCIERO: salud líquida estimada a 30 días ===
  // cash actual = saldo agentes (anticipos pendientes) + balance ARS dolarizado
  // por cobrar 30d = saldo de ops entregadas/cerradas no cobradas + payment_management con cliente_paid=false
  // por pagar 30d = supplier payments + finance_entries con due_date próximos 30d no pagados
  const ahora=Date.now();
  const in30=ahora+30*86400000;
  // Por cobrar: ops sin is_collected con saldo > 0
  const porCobrar=ops.filter(o=>!o.is_collected&&o.status!=="cancelada"&&Number(o.budget_total||0)>0).reduce((s,o)=>{
    const bt=Number(o.budget_total||0);
    const cliPaid=o.service_type==="gestion_integral"?clientPmts.filter(p=>p.operation_id===o.id).reduce((a,p)=>a+Number(p.amount_usd||0),0):0;
    const credit=Number(o.credit_applied_usd||0);
    const discount=Number(o.discount_applied_usd||0);
    const saldo=Math.max(0,bt-cliPaid-credit-discount);
    return s+saldo;
  },0);
  // Por pagar: supplier payments no pagados con due ≤ 30d (o sin due) + finance_entries con tarjeta no pagada
  const porPagarSup=supplierPmts.filter(p=>!p.is_paid&&p.type!=="refund").reduce((s,p)=>s+Number(p.amount_usd||0),0);
  const porPagarFE=finEntries.filter(e=>e.payment_method==="tarjeta_credito"&&!e.is_paid).reduce((s,e)=>{
    const c=e.currency==="ARS"&&Number(e.exchange_rate||0)>0?Number(e.amount||0)/Number(e.exchange_rate):Number(e.amount||0);
    return s+c;
  },0);
  const porPagar=porPagarSup+porPagarFE;
  // Cash estimado: usamos saldos agente como proxy de cash bajo gestión (anticipos disponibles - ya gastados)
  const cashAgentes=agentMvs.reduce((s,m)=>s+(m.type==="anticipo"?-Number(m.amount_usd||0):Number(m.amount_usd||0)),0);
  // El termómetro: lo que esperás tener neto en próximos 30d
  const termometro=cashAgentes+porCobrar-porPagar;
  const themeColor=termometro>=5000?"#22c55e":termometro>=0?"#fbbf24":"#ef4444";
  const themeLabel=termometro>=5000?"Saludable":termometro>=0?"Ajustado":"En rojo";

  return <div>
    <div style={{background:`linear-gradient(135deg, ${themeColor}15, ${themeColor}03)`,border:`1.5px solid ${themeColor}50`,borderRadius:16,padding:"22px 26px",marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"center",gap:18,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:240}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:6}}>
          <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Termómetro 30d</span>
          <span style={{fontSize:10,fontWeight:800,padding:"3px 10px",borderRadius:6,background:`${themeColor}25`,color:themeColor,border:`1px solid ${themeColor}50`,letterSpacing:"0.06em",textTransform:"uppercase"}}>{themeLabel}</span>
        </div>
        <p style={{fontSize:36,fontWeight:800,color:themeColor,margin:0,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{termometro>=0?"+":""}{usd(termometro)}</p>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"6px 0 0",lineHeight:1.5}}>Cash agentes ({usd(cashAgentes)}) + por cobrar ({usd(porCobrar)}) − por pagar ({usd(porPagar)})</p>
      </div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        <div style={{padding:"10px 16px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",minWidth:130}}>
          <p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 4px",textTransform:"uppercase"}}>Por cobrar</p>
          <p style={{fontSize:16,fontWeight:700,color:"#22c55e",margin:0,fontVariantNumeric:"tabular-nums"}}>+{usd(porCobrar)}</p>
        </div>
        <div style={{padding:"10px 16px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",minWidth:130}}>
          <p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 4px",textTransform:"uppercase"}}>Por pagar</p>
          <p style={{fontSize:16,fontWeight:700,color:"#ef4444",margin:0,fontVariantNumeric:"tabular-nums"}}>−{usd(porPagar)}</p>
        </div>
      </div>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>Dashboard Financiero</h2>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>{[{k:"week",l:"Semana"},{k:"month",l:"Mes"},{k:"year",l:"Año"},{k:"all",l:"Total"}].map(p=><button key={p.k} onClick={()=>{setPeriod(p.k);if(p.k==="month")setSelMonth(`${thisYear}-${String(thisMonth+1).padStart(2,"0")}`);}} style={{padding:"6px 14px",fontSize:11,fontWeight:700,borderRadius:8,border:period===p.k?`1.5px solid ${IC}`:"1.5px solid rgba(255,255,255,0.08)",background:period===p.k?"rgba(184,149,106,0.12)":"rgba(255,255,255,0.028)",color:period===p.k?IC:"rgba(255,255,255,0.4)",cursor:"pointer"}}>{p.l}</button>)}
        {period==="month"&&<div style={{display:"flex",alignItems:"center",gap:6,marginLeft:8}}>
          <button onClick={()=>{const[y,m]=selMonth.split("-").map(Number);const d=new Date(y,m-2,1);setSelMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);}} style={{padding:"4px 10px",fontSize:14,fontWeight:700,borderRadius:6,border:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.028)",color:"#fff",cursor:"pointer"}}>←</button>
          <span style={{fontSize:13,fontWeight:700,color:"#fff",minWidth:100,textAlign:"center"}}>{(()=>{const MN=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];return `${MN[selM-1]} ${selY}`;})()}</span>
          <button onClick={()=>{const[y,m]=selMonth.split("-").map(Number);const d=new Date(y,m,1);setSelMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);}} style={{padding:"4px 10px",fontSize:14,fontWeight:700,borderRadius:6,border:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.028)",color:"#fff",cursor:"pointer"}}>→</button>
        </div>}
      </div>
    </div>

    {/* ═══ FILA 1: KPIs del período (Ganancia/Ingresos/Costos/Margen) ═══ */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16,marginBottom:20}}>
      <div style={{background:totalGan>=0?"linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.03))":"linear-gradient(135deg,rgba(255,80,80,0.12),rgba(255,80,80,0.03))",border:`1px solid ${totalGan>=0?"rgba(34,197,94,0.25)":"rgba(255,80,80,0.25)"}`,borderRadius:14,padding:"20px 22px"}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Ganancia neta</p>
        <p style={{fontSize:30,fontWeight:700,color:totalGan>=0?"#22c55e":"#ff6b6b",margin:0,lineHeight:1.1}}>{usd(totalGan)}</p>
        <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"8px 0 0"}}>Ingresos − Costos ({periodOps.length} ops cerradas)</p>
      </div>
      {stat("Ingresos",usd(totalIng),"#fff",true)}
      {stat("Costos",usd(totalCost),"#ff6b6b",true)}
      <div style={{background:"rgba(255,255,255,0.028)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px 20px"}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",textTransform:"uppercase"}}>Margen</p>
        <p style={{fontSize:28,fontWeight:700,color:margen>=20?"#22c55e":margen>=0?"#fbbf24":"#ff6b6b",margin:0}}>{margen.toFixed(1)}%</p>
        <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"8px 0 0"}}>{margen>=20?"Saludable":margen>=0?"Ajustado":"En rojo"}</p>
      </div>
    </div>

    {(()=>{
      // Cash flow REAL: solo plata que ya entró/salió
      // Ingresos: pagos parciales del cliente + ops cobradas SIN pagos parciales (legacy) + pmts donde cliente ya pagó
      const opsWithClientPmts=new Set(clientPmts.map(p=>p.operation_id));
      const totCobradoOps=ops.filter(o=>o.is_collected&&!opsWithClientPmts.has(o.id)).reduce((s,o)=>s+Number(o.budget_total||0),0);
      const totCobradoClientPmts=clientPmts.reduce((s,p)=>s+Number(p.amount_usd||0),0);
      const totCobradoPmts=ops.reduce((s,o)=>{const pmts=pmtsByOp[o.id]||[];return s+pmts.filter(p=>p.client_paid).reduce((a,p)=>a+Number(p.client_paid_amount_usd??p.client_amount_usd??0),0);},0);
      const totCobrado=totCobradoOps+totCobradoClientPmts+totCobradoPmts;
      // Costos: todos los costos de ops + giros YA enviados (confirmado)
      // Costos op para cash flow: excluir cost_flete cuando method=cuenta_corriente (ya se contó en el anticipo al agente)
      const totCostosOps=ops.reduce((s,o)=>{const fleteMethod=o.cost_flete_method||"cuenta_corriente";const fleteCash=fleteMethod==="cuenta_corriente"?0:Number(o.cost_flete||0);return s+fleteCash+Number(o.cost_impuestos_reales||0)+Number(o.cost_gasto_documental||0)+Number(o.cost_seguro||0)+Number(o.cost_flete_local||0)+Number(o.cost_otros||0);},0);
      // Pagos al proveedor (Gestión Integral): suma de pagos efectivamente hechos (is_paid=true)
      // Pagos al proveedor: payments suman, refunds restan (cuando el proveedor devuelve plata)
      const totSupplierPmts=supplierPmts.filter(p=>p.is_paid).reduce((s,p)=>{const sgn=p.type==="refund"?-1:1;return s+sgn*Number(p.amount_usd||0);},0);
      // Costos de gestión de pagos para cash flow:
      //  - Comisión financiera: SIEMPRE se cuenta como contado (si giro confirmado), no espera débito TC
      //  - Giro al exterior: sólo se cuenta cuando se pagó de verdad (no TC pendiente)
      const totCostosPmts=ops.reduce((s,o)=>{const pmts=pmtsByOp[o.id]||[];return s+pmts.filter(p=>p.giro_status==="confirmado").reduce((a,p)=>{const com=Number(p.cost_comision_giro||0);const tarjetaPend=p.giro_payment_method==="tarjeta_credito"&&!p.giro_tarjeta_paid;const giro=tarjetaPend?0:Number(p.giro_amount_usd||0);return a+com+giro;},0);},0);
      // Anticipos a agentes (cash real que sale)
      const totAnticiposAgentes=agentMvs.filter(m=>m.type==="anticipo").reduce((s,m)=>s+Number(m.amount_usd||0),0);
      // Costos fijos manuales (Meta ads, Vercel, Claude, salarios, etc.) — históricos en USD
      // EXCLUYE gastos pagados con tarjeta de crédito todavía no debitados (la plata sigue en el bolsillo, es deuda)
      const totCostosFijos=finEntries.filter(e=>e.auto_generated===false&&e.type==="gasto"&&e.currency!=="ARS"&&!(e.payment_method==="tarjeta_credito"&&!e.is_paid)).reduce((s,e)=>s+Number(e.amount||0),0);
      const totCostosTotales=totCostosOps+totCostosPmts+totCostosFijos+totAnticiposAgentes+totSupplierPmts;
      // Colgados: lo que DEBE el cliente (client_amount) − anticipos. Eso es plata real pendiente de cobrar.
      const girosColgadosDetail=[];
      ops.forEach(o=>{const pmts=pmtsByOp[o.id]||[];const colgados=pmts.filter(p=>p.giro_status==="confirmado"&&!p.client_paid);if(colgados.length===0)return;const debe=colgados.reduce((a,p)=>a+Number(p.client_amount_usd||0),0);const ant=Number(o.total_anticipos||0);const real=Math.max(0,debe-ant);if(real>0)girosColgadosDetail.push({code:o.operation_code,client:o.clients?`${o.clients.first_name} ${o.clients.last_name}`:"—",debe,anticipo:ant,real});});
      const girosColgados=girosColgadosDetail.reduce((s,d)=>s+d.real,0);
      // Clientes pagaron pero giro no enviado
      const girosPendientes=ops.reduce((s,o)=>{const pmts=pmtsByOp[o.id]||[];return s+pmts.filter(p=>p.client_paid&&p.giro_status!=="confirmado").reduce((a,p)=>a+Number(p.giro_amount_usd||0),0);},0);
      // Margen operaciones activas (TODAS las no cerradas/canceladas): ingreso (budget+pmts cobrados) - costos
      const margenActivas=ops.filter(o=>o.status!=="operacion_cerrada"&&o.status!=="cancelada").reduce((s,o)=>{const ing=Number(o.budget_total||0);const costProd=o.service_type==="gestion_integral"?Number(o.cost_producto_usd||0):0;const cost=Number(o.cost_flete||0)+costProd+Number(o.cost_impuestos_reales||0)+Number(o.cost_gasto_documental||0)+Number(o.cost_seguro||0)+Number(o.cost_flete_local||0)+Number(o.cost_otros||0);const pmts=pmtsByOp[o.id]||[];const pmtGan=pmts.reduce((a,p)=>a+Number(p.client_amount_usd||0)-Number(p.giro_amount_usd||0)-Number(p.cost_comision_giro||0),0);return s+(ing-cost)+pmtGan;},0);
      // Deuda TC pendiente en ARS (de finance_entries + supplier_payments ARS no pagados)
      const deudaTCArsFinance=finEntries.filter(e=>e.type==="gasto"&&!e.is_paid&&e.currency==="ARS").reduce((s,e)=>s+Number(e.amount_ars||0),0);
      // Solo costos pendientes (no refunds — un refund pendiente es plata viniendo a vos, no deuda TC)
      const deudaTCArsSup=supplierPmts.filter(p=>p.payment_method==="tarjeta_credito"&&!p.is_paid&&p.currency==="ARS"&&p.type!=="refund").reduce((s,p)=>s+Number(p.amount_ars||p.amount_usd||0),0);
      const deudaTCArs=deudaTCArsFinance+deudaTCArsSup;
      // Deuda tarjeta USD: finance_entries USD + payment_management TC pendientes + supplier_payments TC USD pendientes
      const deudaTCUsdFinance=finEntries.filter(e=>e.type==="gasto"&&!e.is_paid&&e.currency==="USD"&&e.payment_method==="tarjeta_credito").reduce((s,e)=>s+Number(e.amount||0),0);
      const deudaTCUsdPmts=Object.values(pmtsByOp).flat().filter(p=>p.giro_payment_method==="tarjeta_credito"&&!p.giro_tarjeta_paid).reduce((s,p)=>s+Number(p.giro_amount_usd||0),0);
      const deudaTCUsdSup=supplierPmts.filter(p=>p.payment_method==="tarjeta_credito"&&!p.is_paid&&(p.currency==="USD"||!p.currency)&&p.type!=="refund").reduce((s,p)=>s+Number(p.amount_usd||0),0);
      const deudaTCUsd=deudaTCUsdFinance+deudaTCUsdPmts+deudaTCUsdSup;
      const cashDisponible=totCobrado-totCostosTotales;
      return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <div style={{background:cashDisponible>=0?"linear-gradient(135deg,rgba(34,197,94,0.1),rgba(34,197,94,0.03))":"linear-gradient(135deg,rgba(255,80,80,0.1),rgba(255,80,80,0.03))",border:`1px solid ${cashDisponible>=0?"rgba(34,197,94,0.2)":"rgba(255,80,80,0.2)"}`,borderRadius:14,padding:"20px 24px",display:"flex",flexDirection:"column"}}>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 6px",textTransform:"uppercase"}}>Cash disponible</p>
          <p style={{fontSize:32,fontWeight:700,color:cashDisponible>=0?"#22c55e":"#ff6b6b",margin:"0 0 4px"}}>{usd(cashDisponible)}</p>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>Cobrado ({usd(totCobrado)}) − Costos ops ({usd(totCostosOps+totCostosPmts)}) − Gastos ({usd(totCostosFijos)}) − Anticipos ({usd(totAnticiposAgentes)})</p>
          <div style={{marginTop:"auto"}}>
            {margenActivas!==0&&<p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"4px 0 0",borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:4}}>↳ {usd(margenActivas)} margen ops activas (aún no ganancia)</p>}
            {deudaTCUsd>0&&<p style={{fontSize:10,color:"#a78bfa",margin:"2px 0 0"}}>💳 {usd(deudaTCUsd)} deuda TC pendiente (no descontada — sigue en el bolsillo hasta el débito)</p>}
            {girosColgados>0&&<p style={{fontSize:10,color:"#fb923c",margin:"2px 0 0",cursor:"help"}} title={girosColgadosDetail.map(d=>`${d.code} ${d.client}: debe ${usd(d.debe)}${d.anticipo>0?` − anticipo ${usd(d.anticipo)}`:""} = ${usd(d.real)} pendiente`).join("\n")}>⚠ {usd(girosColgados)} pendiente de cobrar al cliente ({girosColgadosDetail.length})</p>}
            {girosPendientes>0&&<p style={{fontSize:10,color:"#60a5fa",margin:"2px 0 0"}}>⏳ {usd(girosPendientes)} cobrados, giro pendiente envío</p>}
          </div>
        </div>
        <div style={{background:"rgba(251,146,60,0.06)",border:"1px solid rgba(251,146,60,0.15)",borderRadius:14,padding:"20px 24px",display:"flex",flexDirection:"column"}}>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 6px",textTransform:"uppercase"}}>Deuda tarjeta de crédito</p>
          {deudaTCUsd>0&&<p style={{fontSize:28,fontWeight:700,color:"#fb923c",margin:"0 0 2px",lineHeight:1.15}}>USD {deudaTCUsd.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>}
          {deudaTCArs>0&&<p style={{fontSize:28,fontWeight:700,color:"#fb923c",margin:"0 0 4px",lineHeight:1.15}}>ARS {deudaTCArs.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>}
          {deudaTCArs===0&&deudaTCUsd===0&&<p style={{fontSize:32,fontWeight:700,color:"rgba(255,255,255,0.2)",margin:"0 0 4px"}}>Sin deuda</p>}
          <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"auto 0 0"}}>{deudaTCArs>0||deudaTCUsd>0?"Pendiente de débito":"Todo al día ✓"}</p>
        </div>
      </div>;
    })()}

    {/* ═══ FILA 3: Comparativa ingreso vs costo por concepto ═══ */}
    {(()=>{
      // Cobertura: % del budget_total que viene de cash + credit + discount
      // Usamos eso para escalar los budget_flete/seguro/taxes al ingreso real cobrado
      const sum=(f)=>periodOps.reduce((s,o)=>s+Number(o[f]||0),0);
      const sumIng=(f)=>periodOps.reduce((s,o)=>{
        const bt=Number(o.budget_total||0);if(bt<=0)return s;
        const comp=Number(o[f]||0);
        if(!o.is_collected)return s+comp;
        const raw=Number(o.collected_amount||0);
        const isArs=o.collection_currency==="ARS";const rate=Number(o.collection_exchange_rate||0);
        const cash=isArs&&rate>0?raw/rate:raw;
        const cashForOp=Math.min(cash,bt);
        const ing=cashForOp+Number(o.credit_applied_usd||0)+Number(o.discount_applied_usd||0);
        const ratio=bt>0?ing/bt:0;
        return s+comp*ratio;
      },0);
      // Conceptos con ingreso↔costo directo
      const concepts=[
        {label:"Flete internacional",ingF:"budget_flete",costF:"cost_flete",color:"#60a5fa"},
        {label:"Seguro",ingF:"budget_seguro",costF:"cost_seguro",color:"#fbbf24"},
        {label:"Impuestos",ingF:"budget_taxes",costF:"cost_impuestos_reales",color:"#f97316"}
      ].map(c=>{
        const ing=sumIng(c.ingF);const cost=sum(c.costF);const gan=ing-cost;const mg=ing>0?(gan/ing)*100:0;
        return{...c,ing,cost,gan,mg};
      }).filter(c=>c.ing>0||c.cost>0);
      // Conceptos de costo puro (sin ingreso directo, absorben parte del margen global)
      const pureCosts=[
        {label:"Gasto documental",cost:sum("cost_gasto_documental"),color:"#a78bfa"},
        {label:"Flete local",cost:sum("cost_flete_local"),color:"#34d399"},
        {label:"Otros (op)",cost:sum("cost_otros"),color:"#fb7185"},
        {label:"Giros (gestión pagos)",cost:periodOps.reduce((s,o)=>{const pm=pmtsByOp[o.id]||[];return s+pm.reduce((a,p)=>a+Number(p.giro_amount_usd||0)+Number(p.cost_comision_giro||0),0);},0),color:"#c084fc"}
      ].filter(c=>c.cost>0);
      // Gastos fijos del período por categoría
      const fixedByCat={};filterByPeriod(fixedCostsManual,"date").forEach(e=>{const k=e.category||"otros";if(!fixedByCat[k])fixedByCat[k]=0;fixedByCat[k]+=Number(e.amount||0);});
      const fixedRows=Object.entries(fixedByCat).map(([k,v])=>({label:CAT_LBL[k]||k,cost:v,color:CAT_COLOR[k]||"#888"})).sort((a,b)=>b.cost-a.cost);

      const maxAny=Math.max(...concepts.map(c=>Math.max(c.ing,c.cost)),...pureCosts.map(c=>c.cost),...fixedRows.map(c=>c.cost),1);

      return <div style={{marginBottom:24}}><Card title="📊 Comparativa por concepto — ingreso vs costo">
        <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"0 0 14px"}}>Flete, Seguro, Impuestos se cobran al cliente (lo que facturás) vs lo que realmente pagás. Los costos sin ingreso directo (documental, flete local, giros, gastos fijos) se absorben del margen global.</p>
        <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr 0.8fr",gap:10,paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:8}}>
          {["CONCEPTO","INGRESO","COSTO","GANANCIA","MARGEN"].map(h=><p key={h} style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:0,textAlign:h==="CONCEPTO"?"left":"right"}}>{h}</p>)}
        </div>
        {concepts.map(c=><div key={c.label} style={{padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr 0.8fr",gap:10,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:2,background:c.color}}/><span style={{fontSize:13,fontWeight:600,color:"#fff"}}>{c.label}</span></div>
            <span style={{fontSize:12,fontWeight:600,color:"#22c55e",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{usd(c.ing)}</span>
            <span style={{fontSize:12,fontWeight:600,color:"#ff6b6b",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{usd(c.cost)}</span>
            <span style={{fontSize:12,fontWeight:700,color:c.gan>=0?"#22c55e":"#ff6b6b",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{usd(c.gan)}</span>
            <span style={{fontSize:12,fontWeight:700,color:c.mg>=20?"#22c55e":c.mg>=0?"#fbbf24":"#ff6b6b",textAlign:"right"}}>{c.mg.toFixed(1)}%</span>
          </div>
          {/* Dual bar: ingreso arriba (verde), costo abajo (rojo) */}
          <div style={{display:"flex",gap:6,marginTop:6,alignItems:"center"}}>
            <div style={{flex:1,height:5,background:"rgba(255,255,255,0.04)",borderRadius:3,overflow:"hidden"}}><div style={{width:`${(c.ing/maxAny)*100}%`,height:"100%",background:"#22c55e"}}/></div>
            <div style={{flex:1,height:5,background:"rgba(255,255,255,0.04)",borderRadius:3,overflow:"hidden"}}><div style={{width:`${(c.cost/maxAny)*100}%`,height:"100%",background:"#ff6b6b"}}/></div>
          </div>
        </div>)}
        {pureCosts.length>0&&<>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.35)",margin:"16px 0 6px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Costos sin ingreso directo (ops)</p>
          {pureCosts.map(c=><div key={c.label} style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr 0.8fr",gap:10,alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:2,background:c.color}}/><span style={{fontSize:12,color:"rgba(255,255,255,0.75)"}}>{c.label}</span></div>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"right"}}>—</span>
            <span style={{fontSize:12,fontWeight:600,color:"#ff6b6b",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{usd(c.cost)}</span>
            <span style={{fontSize:12,fontWeight:600,color:"#ff6b6b",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>-{usd(c.cost)}</span>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"right"}}>—</span>
          </div>)}
        </>}
        {fixedRows.length>0&&<>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.35)",margin:"16px 0 6px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Gastos fijos del negocio (período)</p>
          {fixedRows.map(c=><div key={c.label} style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr 0.8fr",gap:10,alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:2,background:c.color}}/><span style={{fontSize:12,color:"rgba(255,255,255,0.75)"}}>{c.label}</span></div>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"right"}}>—</span>
            <span style={{fontSize:12,fontWeight:600,color:"#ff6b6b",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{usd(c.cost)}</span>
            <span style={{fontSize:12,fontWeight:600,color:"#ff6b6b",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>-{usd(c.cost)}</span>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"right"}}>—</span>
          </div>)}
        </>}
      </Card></div>;
    })()}

    {/* ═══ FILA 4: Contadores operativos ═══ */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16,marginBottom:24}}>
      {stat("Operaciones activas",activeOps.length,IC)}
      {stat("Operaciones cerradas",closedOps.length,"#22c55e")}
      {stat("Clientes nuevos (mes)",newClients,"#a78bfa")}
      {stat("Cotizaciones pendientes",pendingQuotes,"#fbbf24")}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
      <Card title="Ganancia mensual (últimos 6 meses)">
        {monthly.map((m,i)=>{const pct=(Math.abs(m.gan)/maxMonthGan)*100;return <div key={i} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",minWidth:70}}>{m.label}</span>
            <span style={{fontSize:12,fontWeight:700,color:m.gan>0?"#22c55e":m.gan<0?"#ff6b6b":"rgba(255,255,255,0.4)"}}>{m.gan!==0?usd(m.gan):"—"}</span>
          </div>
          {bar(pct,m.gan>0?"#22c55e":"#ff6b6b")}
        </div>;})}
      </Card>
      <Card title="Operaciones por mes">
        {monthly.map((m,i)=>{const pct=(m.ops/maxMonthOps)*100;const prev=i>0?monthly[i-1].ops:0;const trend=i>0?(m.ops>prev?"↑":m.ops<prev?"↓":"="):"";const trendColor=m.ops>prev?"#22c55e":m.ops<prev?"#ff6b6b":"rgba(255,255,255,0.4)";return <div key={i} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",minWidth:70}}>{m.label}</span>
            <div><span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{m.ops} ops</span>{trend&&<span style={{fontSize:11,color:trendColor,marginLeft:6}}>{trend}</span>}</div>
          </div>
          {bar(pct,IC)}
        </div>;})}
      </Card>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
      <Card title="Ganancia por canal">
        {(()=>{const entries=Object.entries(byChannel);const maxGan=Math.max(...entries.map(([,d])=>Math.abs(d.ing-d.cost)),1);return entries.map(([ch,d])=>{const gan=d.ing-d.cost;const mg=d.ing>0?((gan/d.ing)*100):0;const pct=(Math.abs(gan)/maxGan)*100;return <div key={ch} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div><span style={{fontSize:13,fontWeight:600,color:"#fff"}}>{CM[ch]||ch}</span><span style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginLeft:8}}>({d.count} ops)</span></div>
            <div><span style={{fontSize:13,fontWeight:700,color:gan>0?"#22c55e":"#ff6b6b"}}>{usd(gan)}</span><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginLeft:8}}>{mg.toFixed(1)}%</span></div>
          </div>
          {bar(pct,gan>0?"#22c55e":"#ff6b6b")}
        </div>;});})()}
        {Object.keys(byChannel).length===0&&<p style={{color:"rgba(255,255,255,0.45)"}}>Sin datos</p>}
      </Card>
      <Card title="Desglose de costos">
        {costBreakdown.length>0?<>
          <div style={{height:12,borderRadius:6,overflow:"hidden",display:"flex",marginBottom:16}}>
            {costBreakdown.map((c,i)=><div key={i} style={{width:`${(c.value/totalCostBreak)*100}%`,background:c.color,height:"100%"}}/>)}
          </div>
          {costBreakdown.map((c,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:c.color}}/><span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>{c.label}</span></div>
            <div><span style={{fontSize:12,fontWeight:600,color:"#fff"}}>{usd(c.value)}</span><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginLeft:8}}>{((c.value/totalCostBreak)*100).toFixed(1)}%</span></div>
          </div>)}
        </>:<p style={{color:"rgba(255,255,255,0.45)"}}>Sin datos</p>}
      </Card>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
      <Card title="Top clientes por rentabilidad">
        {topClients.length>0?topClients.map(([name,d],i)=>{const mg=d.ing>0?((d.gan/d.ing)*100):0;const pct=(Math.abs(d.gan)/maxClientGan)*100;return <div key={name} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div><span style={{fontSize:13,fontWeight:600,color:"#fff"}}>{i+1}. {name}</span><span style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginLeft:8}}>({d.count} ops)</span></div>
            <div><span style={{fontSize:13,fontWeight:700,color:d.gan>0?"#22c55e":"#ff6b6b"}}>{usd(d.gan)}</span><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginLeft:8}}>{mg.toFixed(1)}%</span></div>
          </div>
          {bar(pct,d.gan>0?"#22c55e":"#ff6b6b")}
        </div>;}):<p style={{color:"rgba(255,255,255,0.45)"}}>Sin datos</p>}
      </Card>
      <Card title="Por origen">
        {Object.entries(byOrigin).map(([or,d])=>{const maxOr=Math.max(...Object.values(byOrigin).map(v=>v.ing),1);const pct=(d.ing/maxOr)*100;return <div key={or} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:600,color:"#fff"}}>{or==="China"?"🇨🇳":"🇺🇸"} {or} ({d.count} ops)</span>
            <span style={{fontSize:13,fontWeight:600,color:IC}}>{usd(d.ing)}</span>
          </div>
          {bar(pct,or==="China"?"#f97316":"#60a5fa")}
        </div>;})}
        {Object.keys(byOrigin).length===0&&<p style={{color:"rgba(255,255,255,0.45)"}}>Sin datos</p>}
      </Card>
    </div>

    {/* Cohorts de clientes + Tiempos promedio por ruta */}
    {(()=>{
      // ——— Cohorts: agrupa clientes por el mes de su primera op cerrada. Mide retención. ———
      const clientOps={};closedOps.forEach(o=>{const cid=o.client_id;if(!cid)return;if(!clientOps[cid])clientOps[cid]={name:o.clients?`${o.clients.first_name} ${o.clients.last_name}`:"—",ops:[]};clientOps[cid].ops.push(o);});
      const cohorts={};Object.values(clientOps).forEach(c=>{
        const sorted=c.ops.slice().sort((a,b)=>(a.closed_at||"").localeCompare(b.closed_at||""));
        const firstMonth=sorted[0].closed_at?String(sorted[0].closed_at).slice(0,7):null;
        if(!firstMonth)return;
        if(!cohorts[firstMonth])cohorts[firstMonth]={firstMonth,nuevos:0,repitieron:0,totalOps:0,totalIng:0};
        cohorts[firstMonth].nuevos++;
        cohorts[firstMonth].totalOps+=c.ops.length;
        cohorts[firstMonth].totalIng+=c.ops.reduce((s,o)=>s+calcGan(o).ing,0);
        if(c.ops.length>1)cohorts[firstMonth].repitieron++;
      });
      const cohortRows=Object.values(cohorts).sort((a,b)=>b.firstMonth.localeCompare(a.firstMonth)).slice(0,8);

      // ——— Tiempos promedio por ruta (origin + channel) ———
      const routeStats={};closedOps.forEach(o=>{
        if(!o.dispatched_at||!o.delivered_at)return;
        const route=`${o.origin||"?"} · ${CM[o.channel]||o.channel}`;
        const totalDays=(new Date(o.delivered_at)-new Date(o.dispatched_at))/86400000;
        if(totalDays<0||totalDays>120)return; // outliers
        if(!routeStats[route])routeStats[route]={count:0,totalDays:0,days:[]};
        routeStats[route].count++;
        routeStats[route].totalDays+=totalDays;
        routeStats[route].days.push(totalDays);
      });
      const rutas=Object.entries(routeStats).map(([r,d])=>({ruta:r,count:d.count,avg:d.totalDays/d.count,min:Math.min(...d.days),max:Math.max(...d.days)})).sort((a,b)=>a.avg-b.avg);

      return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
        <Card title="Cohorts — clientes nuevos por mes">
          {cohortRows.length>0?<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:8}}>
              {["MES","NUEVOS","REPITIERON","OPS/CLIENTE"].map(h=><p key={h} style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:0}}>{h}</p>)}
            </div>
            {cohortRows.map(c=>{const retPct=c.nuevos>0?(c.repitieron/c.nuevos)*100:0;const opsPerClient=c.nuevos>0?c.totalOps/c.nuevos:0;return <div key={c.firstMonth} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:12}}>
              <span style={{color:"#fff",fontWeight:600}}>{c.firstMonth}</span>
              <span style={{color:"#fff"}}>{c.nuevos}</span>
              <span style={{color:retPct>=50?"#22c55e":retPct>=25?"#fbbf24":"rgba(255,255,255,0.5)"}}>{c.repitieron} ({retPct.toFixed(0)}%)</span>
              <span style={{color:"rgba(255,255,255,0.7)"}}>{opsPerClient.toFixed(1)}</span>
            </div>;})}
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"10px 0 0",fontStyle:"italic"}}>Clientes agrupados por el mes de su 1ra op cerrada. "Repitieron" = tienen más de una op.</p>
          </>:<p style={{color:"rgba(255,255,255,0.45)"}}>Sin datos de ops cerradas</p>}
        </Card>
        <Card title="Tiempos promedio por ruta">
          {rutas.length>0?<>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10,paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:8}}>
              {["RUTA","OPS","PROM","RANGO"].map(h=><p key={h} style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:0}}>{h}</p>)}
            </div>
            {rutas.map(r=><div key={r.ruta} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:12}}>
              <span style={{color:"#fff",fontWeight:600}}>{r.ruta}</span>
              <span style={{color:"rgba(255,255,255,0.7)"}}>{r.count}</span>
              <span style={{color:IC,fontWeight:700}}>{r.avg.toFixed(0)}d</span>
              <span style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>{r.min.toFixed(0)}-{r.max.toFixed(0)}d</span>
            </div>)}
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"10px 0 0",fontStyle:"italic"}}>Días desde despacho a entrega final. Outliers (&gt;120d o negativos) excluidos.</p>
          </>:<p style={{color:"rgba(255,255,255,0.45)"}}>Faltan datos — ops necesitan dispatched_at + delivered_at</p>}
        </Card>
      </div>;
    })()}

    {(()=>{
      // Gastos del negocio agrupados por categoría (manuales) + ingresos por canal
      const gastosByCat={};fixedCostsManual.forEach(e=>{const k=e.category||"otros";gastosByCat[k]=(gastosByCat[k]||0)+Number(e.amount||0);});
      const totGastosCat=Object.values(gastosByCat).reduce((s,v)=>s+v,0);
      const ingresosByChan={};periodOps.forEach(o=>{const ch=o.channel||"unknown";ingresosByChan[ch]=(ingresosByChan[ch]||0)+calcGan(o).ing;});
      const totIngChan=Object.values(ingresosByChan).reduce((s,v)=>s+v,0);
      return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
        <Card title="Gastos del negocio por categoría">
          {totGastosCat>0?<>
            <div style={{height:12,borderRadius:6,overflow:"hidden",display:"flex",marginBottom:16}}>
              {Object.entries(gastosByCat).map(([k,v])=><div key={k} style={{width:`${(v/totGastosCat)*100}%`,background:CAT_COLOR[k]||"#888",height:"100%"}}/>)}
            </div>
            {Object.entries(gastosByCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:CAT_COLOR[k]||"#888"}}/><span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>{CAT_LBL[k]||k}</span></div>
              <div><span style={{fontSize:12,fontWeight:600,color:"#fff"}}>{usd(v)}</span><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginLeft:8}}>{((v/totGastosCat)*100).toFixed(1)}%</span></div>
            </div>)}
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"10px 0 0",fontStyle:"italic"}}>Total acumulado · cargá en Finanzas → Gastos del Negocio</p>
          </>:<p style={{color:"rgba(255,255,255,0.45)"}}>Sin gastos cargados — agregá Meta ads, Vercel, Claude, salarios, etc. en Finanzas</p>}
        </Card>
        <Card title="Ingresos por canal (período)">
          {totIngChan>0?<>
            <div style={{height:12,borderRadius:6,overflow:"hidden",display:"flex",marginBottom:16}}>
              {Object.entries(ingresosByChan).map(([k,v])=><div key={k} style={{width:`${(v/totIngChan)*100}%`,background:k==="aereo_blanco"?"#22c55e":k==="aereo_negro"?"#60a5fa":k==="maritimo_blanco"?"#a78bfa":"#fb923c",height:"100%"}}/>)}
            </div>
            {Object.entries(ingresosByChan).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:k==="aereo_blanco"?"#22c55e":k==="aereo_negro"?"#60a5fa":k==="maritimo_blanco"?"#a78bfa":"#fb923c"}}/><span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>{CM[k]||k}</span></div>
              <div><span style={{fontSize:12,fontWeight:600,color:"#fff"}}>{usd(v)}</span><span style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginLeft:8}}>{((v/totIngChan)*100).toFixed(1)}%</span></div>
            </div>)}
          </>:<p style={{color:"rgba(255,255,255,0.45)"}}>Sin ops cerradas en el período</p>}
        </Card>
      </div>;
    })()}

    {(()=>{
      // Tabla mensual: P&L Devengado vs Flujo de Caja (últimos 12 meses)
      const MN2=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      const rows=[];
      for(let i=11;i>=0;i--){
        const d=new Date(thisYear,thisMonth-i,1);
        const m=d.getMonth();const y=d.getFullYear();
        const monthStart=`${y}-${String(m+1).padStart(2,"0")}-01`;
        const nextMonth=new Date(y,m+1,1);
        const monthEnd=`${nextMonth.getFullYear()}-${String(nextMonth.getMonth()+1).padStart(2,"0")}-01`;
        const inMonth=(ds)=>{if(!ds)return false;const s=String(ds).slice(0,10);return s>=monthStart&&s<monthEnd;};

        // === DEVENGADO (P&L) ===
        // Ingresos: ops cerradas en el mes + sus pmts (client_amount)
        const opsClosedInMonth=closedOps.filter(o=>inMonth(o.closed_at));
        const devIng=opsClosedInMonth.reduce((s,o)=>s+calcGan(o).ing,0);
        const devCostOp=opsClosedInMonth.reduce((s,o)=>s+calcGan(o).cost,0);
        // Gastos fijos: por fecha del gasto (incluye tarjeta pendiente)
        const devCostFijos=fixedCostsManual.filter(e=>inMonth(e.date)).reduce((s,e)=>s+Number(e.amount||0),0);
        const devGan=devIng-devCostOp-devCostFijos;

        // === CAJA (Cash Flow) ===
        // Cash in: pagos parciales del cliente (operation_client_payments) + ops cobradas SIN pagos parciales (legacy) + pmts client_paid
        const opsWithClientPmts=new Set(clientPmts.map(p=>p.operation_id));
        const cashInOpsLegacy=ops.filter(o=>o.is_collected&&inMonth(o.collection_date)&&!opsWithClientPmts.has(o.id)).reduce((s,o)=>{
          const amt=Number(o.collected_amount||o.budget_total||0);
          const isArs=o.collection_currency==="ARS";const rate=Number(o.collection_exchange_rate||0);
          return s+(isArs&&rate?amt/rate:amt);
        },0);
        const cashInClientPmts=clientPmts.filter(p=>inMonth(p.payment_date)).reduce((s,p)=>s+Number(p.amount_usd||0),0);
        const cashInPmts=Object.values(pmtsByOp).flat().filter(p=>p.client_paid&&inMonth(p.client_paid_date)).reduce((s,p)=>s+Number(p.client_paid_amount_usd??p.client_amount_usd??0),0);
        const cashIn=cashInOpsLegacy+cashInClientPmts+cashInPmts;
        // Cash out: costos ops pagados (no CC, ya que CC es anticipo) en closed_at del mes + gastos is_paid + giros debitados + anticipos
        const cashOutOps=opsClosedInMonth.reduce((s,o)=>{
          const fleteMethod=o.cost_flete_method||"cuenta_corriente";
          const fleteCash=fleteMethod==="cuenta_corriente"?0:Number(o.cost_flete||0);
          return s+fleteCash+Number(o.cost_impuestos_reales||0)+Number(o.cost_gasto_documental||0)+Number(o.cost_seguro||0)+Number(o.cost_flete_local||0)+Number(o.cost_otros||0);
        },0);
        // Gestión Integral: cada pago al proveedor aparece en el mes de payment_date (no closed_at)
        const cashOutSupplierPmts=supplierPmts.filter(p=>p.is_paid&&inMonth(p.payment_date)).reduce((s,p)=>s+Number(p.amount_usd||0),0);
        // Gastos con tarjeta: solo salen de cash cuando is_paid=true (la tarjeta se debitó)
        const cashOutFijos=fixedCostsManual.filter(e=>e.is_paid&&inMonth(e.date)).reduce((s,e)=>s+Number(e.amount||0),0);
        // Giros: salen de cash cuando se confirman y no están pendientes de tarjeta
        const cashOutGiros=Object.values(pmtsByOp).flat().filter(p=>{
          const tarjetaPendiente=p.giro_payment_method==="tarjeta_credito"&&!p.giro_tarjeta_paid;
          if(p.giro_status!=="confirmado"||tarjetaPendiente)return false;
          const giroFecha=p.giro_tarjeta_paid_at?p.giro_tarjeta_paid_at.slice(0,10):p.giro_date;
          return inMonth(giroFecha);
        }).reduce((s,p)=>s+Number(p.giro_amount_usd||0)+Number(p.cost_comision_giro||0),0);
        const cashOutAnticipos=agentMvs.filter(mv=>mv.type==="anticipo"&&inMonth(mv.date)).reduce((s,mv)=>s+Number(mv.amount_usd||0),0);
        const cashOut=cashOutOps+cashOutFijos+cashOutGiros+cashOutAnticipos+cashOutSupplierPmts;
        const cashNeto=cashIn-cashOut;

        rows.push({label:`${MN2[m]} ${y}`,m,y,devIng,devCost:devCostOp+devCostFijos,devGan,cashIn,cashOut,cashNeto,opsCount:opsClosedInMonth.length});
      }
      // Acumulado
      const tot=rows.reduce((a,r)=>({devIng:a.devIng+r.devIng,devCost:a.devCost+r.devCost,devGan:a.devGan+r.devGan,cashIn:a.cashIn+r.cashIn,cashOut:a.cashOut+r.cashOut,cashNeto:a.cashNeto+r.cashNeto}),{devIng:0,devCost:0,devGan:0,cashIn:0,cashOut:0,cashNeto:0});

      return <Card title="Resultados por mes — Devengado vs Caja">
        <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"0 0 14px",lineHeight:1.5}}>
          <b style={{color:"#60a5fa"}}>Devengado (P&L)</b>: imputa ingresos y costos en el mes en que se generó la operación o el gasto (no importa cuándo se cobra o paga). Esto refleja la <b>ganancia real del mes</b>. Gastos con tarjeta de crédito se cuentan en la <b>fecha del gasto</b>, aunque se paguen después.<br/>
          <b style={{color:"#22c55e"}}>Caja (Cash Flow)</b>: solo cuenta la plata que efectivamente entró o salió en el mes. Los gastos con tarjeta pendientes aparecen en el mes del débito.
        </p>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <th rowSpan={2} style={{textAlign:"left",padding:"8px 10px",color:"rgba(255,255,255,0.5)",fontWeight:600,fontSize:10,textTransform:"uppercase",verticalAlign:"bottom"}}>Mes</th>
                <th rowSpan={2} style={{textAlign:"center",padding:"8px 10px",color:"rgba(255,255,255,0.5)",fontWeight:600,fontSize:10,textTransform:"uppercase",verticalAlign:"bottom"}}>Ops cerradas</th>
                <th colSpan={3} style={{textAlign:"center",padding:"4px 10px",color:"#60a5fa",fontWeight:700,fontSize:10,textTransform:"uppercase",borderBottom:"1px solid rgba(184,149,106,0.2)"}}>Devengado (P&L)</th>
                <th colSpan={3} style={{textAlign:"center",padding:"4px 10px",color:"#22c55e",fontWeight:700,fontSize:10,textTransform:"uppercase",borderBottom:"1px solid rgba(34,197,94,0.2)"}}>Caja (Flujo)</th>
              </tr>
              <tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <th style={{textAlign:"right",padding:"6px 10px",color:"rgba(184,149,106,0.7)",fontWeight:600,fontSize:10}}>Ingresos</th>
                <th style={{textAlign:"right",padding:"6px 10px",color:"rgba(184,149,106,0.7)",fontWeight:600,fontSize:10}}>Costos</th>
                <th style={{textAlign:"right",padding:"6px 10px",color:"rgba(184,149,106,0.7)",fontWeight:600,fontSize:10}}>Ganancia</th>
                <th style={{textAlign:"right",padding:"6px 10px",color:"rgba(34,197,94,0.7)",fontWeight:600,fontSize:10}}>Entró</th>
                <th style={{textAlign:"right",padding:"6px 10px",color:"rgba(34,197,94,0.7)",fontWeight:600,fontSize:10}}>Salió</th>
                <th style={{textAlign:"right",padding:"6px 10px",color:"rgba(34,197,94,0.7)",fontWeight:600,fontSize:10}}>Neto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>{
                const isEmpty=r.devIng===0&&r.cashIn===0&&r.cashOut===0&&r.devCost===0;
                return <tr key={r.label} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",opacity:isEmpty?0.3:1}}>
                  <td style={{padding:"8px 10px",fontWeight:600,color:"#fff"}}>{r.label}</td>
                  <td style={{padding:"8px 10px",textAlign:"center",color:"rgba(255,255,255,0.5)"}}>{r.opsCount||"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"right",color:"rgba(255,255,255,0.75)",fontVariantNumeric:"tabular-nums"}}>{r.devIng>0?usd(r.devIng):"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"right",color:"rgba(255,255,255,0.75)",fontVariantNumeric:"tabular-nums"}}>{r.devCost>0?usd(r.devCost):"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,fontVariantNumeric:"tabular-nums",color:r.devGan>0?"#22c55e":r.devGan<0?"#ff6b6b":"rgba(255,255,255,0.4)"}}>{r.devGan!==0?usd(r.devGan):"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"right",color:"rgba(255,255,255,0.75)",fontVariantNumeric:"tabular-nums"}}>{r.cashIn>0?usd(r.cashIn):"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"right",color:"rgba(255,255,255,0.75)",fontVariantNumeric:"tabular-nums"}}>{r.cashOut>0?usd(r.cashOut):"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,fontVariantNumeric:"tabular-nums",color:r.cashNeto>0?"#22c55e":r.cashNeto<0?"#ff6b6b":"rgba(255,255,255,0.4)"}}>{r.cashNeto!==0?usd(r.cashNeto):"—"}</td>
                </tr>;
              })}
              <tr style={{borderTop:"1.5px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.03)"}}>
                <td style={{padding:"10px",fontWeight:700,color:"#fff",textTransform:"uppercase",fontSize:11}}>Total 12m</td>
                <td style={{padding:"10px"}}></td>
                <td style={{padding:"10px",textAlign:"right",fontWeight:700,color:"#fff",fontVariantNumeric:"tabular-nums"}}>{usd(tot.devIng)}</td>
                <td style={{padding:"10px",textAlign:"right",fontWeight:700,color:"#fff",fontVariantNumeric:"tabular-nums"}}>{usd(tot.devCost)}</td>
                <td style={{padding:"10px",textAlign:"right",fontWeight:700,fontVariantNumeric:"tabular-nums",color:tot.devGan>0?"#22c55e":"#ff6b6b"}}>{usd(tot.devGan)}</td>
                <td style={{padding:"10px",textAlign:"right",fontWeight:700,color:"#fff",fontVariantNumeric:"tabular-nums"}}>{usd(tot.cashIn)}</td>
                <td style={{padding:"10px",textAlign:"right",fontWeight:700,color:"#fff",fontVariantNumeric:"tabular-nums"}}>{usd(tot.cashOut)}</td>
                <td style={{padding:"10px",textAlign:"right",fontWeight:700,fontVariantNumeric:"tabular-nums",color:tot.cashNeto>0?"#22c55e":"#ff6b6b"}}>{usd(tot.cashNeto)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{fontSize:10,color:"rgba(255,255,255,0.35)",margin:"12px 0 0",lineHeight:1.5,fontStyle:"italic"}}>
          💡 Si el <b style={{color:"#60a5fa"}}>Devengado</b> es positivo pero el <b style={{color:"#22c55e"}}>Caja</b> es negativo, significa que la ganancia del mes está "atrapada" en cuentas por cobrar o tarjetas pendientes de débito — es ganancia real pero todavía no tenés la plata en la mano.
        </p>
      </Card>;
    })()}
  </div>;
}

// Centro de comunicaciones: muestra ops con estados que requieren WA al cliente
// y no se han enviado todavía. 1 click por cliente = WA abierto con mensaje prellenado.
// También muestra feedback recibido (ratings 1-5 de ops cerradas).
function ComunicacionesPanel({token}){
  const [loading,setLoading]=useState(true);
  const [ops,setOps]=useState([]);
  const [feedbacks,setFeedbacks]=useState([]);
  const [templates,setTemplates]=useState([]);
  const [editingTpl,setEditingTpl]=useState(null);
  const [tplDraft,setTplDraft]=useState({});
  const [savingTpl,setSavingTpl]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),2500);const v=/^[❌✕]|falló|error/i.test(m)?"error":/^⚠/.test(m)?"warn":"success";toast(m.replace(/^[✓✉️❌⚠️✕★📧⭐]\s*/u,""),v);};
  const load=async()=>{
    setLoading(true);
    const statuses=["en_deposito_origen","entregada"];
    const inList=statuses.map(s=>`"${s}"`).join(",");
    const [o,fb,tpl]=await Promise.all([
      dq("operations",{token,filters:`?select=*,clients(first_name,last_name,whatsapp,email,client_code)&status=in.(${inList})&order=updated_at.desc&limit=100`}),
      dq("op_feedback",{token,filters:"?select=*,operations(operation_code,description,clients(first_name,last_name,client_code))&order=submitted_at.desc&limit=50"}),
      dq("message_templates",{token,filters:"?select=*&order=channel.asc,key.asc"})
    ]);
    setOps(Array.isArray(o)?o:[]);
    setFeedbacks(Array.isArray(fb)?fb:[]);
    setTemplates(Array.isArray(tpl)?tpl:[]);
    setLoading(false);
  };
  useEffect(()=>{load();},[token]);

  const inpStyle={width:"100%",padding:"8px 10px",fontSize:13,border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,background:"rgba(0,0,0,0.2)",color:"#fff",outline:"none",boxSizing:"border-box"};
  const openTpl=(t)=>{setEditingTpl(t.id);setTplDraft({subject:t.subject||"",greeting:t.greeting||"",body:t.body||"",cta_text:t.cta_text||""});};
  const sendPreview=async(tpl)=>{
    const to=prompt("¿A qué email mandamos el preview?","bautiartuso21@gmail.com");
    if(!to)return;
    const trigger=tpl.key.replace("email_","");
    try{
      const r=await fetch("/api/notify/preview",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({to,trigger})});
      const resp=await r.json();
      if(resp?.ok)flash(`✉️ Preview de "${tpl.label}" enviado a ${to}`);
      else alert(`Error: ${resp?.error||"desconocido"}\n${JSON.stringify(resp?.detail||{},null,2)}`);
    }catch(e){alert("Error: "+e.message);}
  };
  const cancelTpl=()=>{setEditingTpl(null);setTplDraft({});};
  const saveTpl=async()=>{
    if(!editingTpl)return;
    setSavingTpl(true);
    await dq("message_templates",{method:"PATCH",token,filters:`?id=eq.${editingTpl}`,body:{...tplDraft,updated_at:new Date().toISOString()}});
    await load();
    setEditingTpl(null);
    setTplDraft({});
    setSavingTpl(false);
    flash("Plantilla actualizada");
  };

  const markWaSent=async(opId,triggerKey)=>{
    const op=ops.find(x=>x.id===opId);
    if(!op)return;
    const newSent={...(op.sent_notifications||{}),[triggerKey]:new Date().toISOString()};
    await dq("operations",{method:"PATCH",token,filters:`?id=eq.${opId}`,body:{sent_notifications:newSent}});
    setOps(p=>p.map(x=>x.id===opId?{...x,sent_notifications:newSent}:x));
  };

  const interp=(text,data)=>{if(!text)return "";return String(text).replace(/\{\{(\w+)\}\}/g,(_,k)=>data[k]!=null?String(data[k]):"");};

  const buildWAMsg=(op,trigger)=>{
    const firstName=op.clients?op.clients.first_name:"";
    const opCode=op.operation_code;
    const desc=op.description||"tu mercadería";
    const portalLink=`https://argencargo.com.ar/portal?op=${opCode}`;
    const bt=Number(op.budget_total||0);
    const totAnt=Number(op.total_anticipos||0);
    const saldo=bt-totAnt;
    const saldoTxt=saldo>0?`\n\n*Saldo a abonar: USD ${saldo.toFixed(2)}*`:"";
    const data={firstName,opCode,desc,portalLink,saldoTxt};
    const key=`wa_${trigger}`;
    const tpl=templates.find(t=>t.key===key);
    if(tpl)return interp(tpl.body,data);
    // Fallback si no se cargaron las plantillas todavía
    return trigger==="deposito"
      ? `Hola ${firstName}! Recibimos *${desc}* (${opCode}) en el depósito.\n\n${portalLink}`
      : `Tu carga *${desc}* (${opCode}) está lista para retirar en Callao 1137.${saldoTxt}`;
  };

  const pending=ops.map(op=>{
    const trigger=op.status==="en_deposito_origen"?"deposito":op.status==="entregada"?"retiro":null;
    if(!trigger)return null;
    const sentKey=`wa_${trigger}`;
    const alreadySent=op.sent_notifications?.[sentKey];
    const wa=op.clients?.whatsapp?.replace(/[^0-9]/g,"");
    return{op,trigger,sentKey,alreadySent,wa};
  }).filter(Boolean);

  const pendientes=pending.filter(p=>!p.alreadySent);
  const enviadas=pending.filter(p=>p.alreadySent).slice(0,10);

  const openWA=(p)=>{
    if(!p.wa){alert("El cliente no tiene WhatsApp cargado.");return;}
    const msg=encodeURIComponent(buildWAMsg(p.op,p.trigger));
    window.open(`https://wa.me/${p.wa}?text=${msg}`,"_blank");
    markWaSent(p.op.id,p.sentKey);
    flash(`WA abierto · ${p.op.operation_code}`);
  };

  const openAll=()=>{
    if(pendientes.length===0)return;
    if(!confirm(`Abrir ${pendientes.length} pestaña${pendientes.length!==1?"s":""} de WhatsApp con mensajes prellenados?`))return;
    pendientes.forEach((p,i)=>{setTimeout(()=>openWA(p),i*250);});
  };

  const sendEmail=async(opId,trigger)=>{
    try{
      const r=await fetch("/api/notify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({op_id:opId,trigger,force:true})});
      const resp=await r.json();
      if(resp?.ok){flash("Email enviado ✓");load();}
      else if(resp?.skipped)flash(`Saltado: ${resp.skipped}`);
      else alert(`Error: ${resp?.error||"desconocido"}`);
    }catch(e){alert("Error: "+e.message);}
  };

  const testEmail=async()=>{
    const to=prompt("¿A qué email mandamos el test?","bautistaartuso@gmail.com");
    if(!to)return;
    try{
      const r=await fetch("/api/notify/test",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({to})});
      const resp=await r.json();
      if(resp?.ok)flash(`✉️ Email de prueba enviado a ${to}`);
      else alert(`Error: ${resp?.error||"desconocido"}\n\n${JSON.stringify(resp?.detail||{},null,2)}`);
    }catch(e){alert("Error: "+e.message);}
  };

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:10}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>Comunicaciones</h2>
      <button onClick={testEmail} style={{padding:"7px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:"1.5px solid rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.08)",color:IC,cursor:"pointer"}}>📧 Probar email</button>
    </div>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.45)",margin:"0 0 20px"}}>Notificaciones manuales (WhatsApp) + historial de feedback de clientes.</p>
    {msg&&<p style={{fontSize:12,color:"#22c55e",fontWeight:600,marginBottom:12}}>{msg}</p>}

    {/* WAs pendientes */}
    <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.25rem 1.5rem",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>📱 WhatsApp pendientes ({pendientes.length})</h3>
        {pendientes.length>0&&<button onClick={openAll} style={{padding:"7px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff"}}>Abrir TODOS ({pendientes.length})</button>}
      </div>
      {loading?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"1rem"}}>Cargando...</p>:pendientes.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"1rem"}}>✓ No hay WAs pendientes</p>:<div>
        {pendientes.map(p=>{
          const triggerLbl=p.trigger==="deposito"?"📦 Recepción depósito":"✅ Lista para retiro";
          const triggerColor=p.trigger==="deposito"?"#fbbf24":"#22c55e";
          return <div key={p.op.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:220}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:IC,padding:"2px 8px",background:"rgba(184,149,106,0.1)",borderRadius:4}}>{p.op.operation_code}</span>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,background:`${triggerColor}20`,color:triggerColor,border:`1px solid ${triggerColor}40`,letterSpacing:"0.04em"}}>{triggerLbl}</span>
              </div>
              <p style={{fontSize:13,color:"#fff",margin:0}}>{p.op.clients?`${p.op.clients.first_name} ${p.op.clients.last_name}`:"—"} <span style={{color:"rgba(255,255,255,0.4)"}}>· {p.op.description||""}</span></p>
              {!p.wa&&<p style={{fontSize:11,color:"#fb923c",margin:"2px 0 0"}}>⚠️ Cliente sin WhatsApp cargado</p>}
            </div>
            <button onClick={()=>openWA(p)} disabled={!p.wa} style={{padding:"8px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",cursor:p.wa?"pointer":"not-allowed",background:p.wa?"linear-gradient(135deg,#25D366,#128C7E)":"rgba(255,255,255,0.06)",color:p.wa?"#fff":"rgba(255,255,255,0.3)",whiteSpace:"nowrap"}}>📱 Enviar WA</button>
          </div>;
        })}
      </div>}
    </div>

    {/* Últimos WAs enviados */}
    {enviadas.length>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1rem 1.25rem",marginBottom:20}}>
      <h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Últimos enviados</h3>
      {enviadas.map(p=><div key={p.op.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:12,color:"rgba(255,255,255,0.5)"}}>
        <span><span style={{fontFamily:"monospace",color:IC}}>{p.op.operation_code}</span> — {p.op.clients?`${p.op.clients.first_name} ${p.op.clients.last_name}`:"—"} · {p.trigger}</span>
        <span style={{color:"rgba(255,255,255,0.3)"}}>{new Date(p.alreadySent).toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
      </div>)}
    </div>}

    {/* Plantillas editables */}
    <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.25rem 1.5rem",marginBottom:20}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>✏️ Plantillas de mensajes</h3>
      <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"0 0 14px"}}>Edita los textos que se envían a los clientes. Variables disponibles: {"{{firstName}}, {{opCode}}, {{desc}}, {{portalLink}}, {{saldoTxt}} (solo WA retiro)"}</p>
      {templates.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"1rem"}}>Cargando plantillas...</p>:<div>
        {templates.map(t=>{
          const isEditing=editingTpl===t.id;
          const channelIcon=t.channel==="email"?"✉️":"📱";
          const channelColor=t.channel==="email"?"#60a5fa":"#25D366";
          return <div key={t.id} style={{padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:isEditing?12:0,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:200}}>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,background:`${channelColor}22`,color:channelColor,textTransform:"uppercase",letterSpacing:"0.05em"}}>{channelIcon} {t.channel}</span>
                <p style={{fontSize:13,color:"#fff",margin:0,fontWeight:600}}>{t.label}</p>
              </div>
              {!isEditing&&<div style={{display:"flex",gap:6}}>
                {t.channel==="email"&&<button onClick={()=>sendPreview(t)} style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:6,border:"1.5px solid rgba(34,197,94,0.3)",background:"rgba(34,197,94,0.08)",color:"#22c55e",cursor:"pointer",whiteSpace:"nowrap"}}>📧 Preview</button>}
                <button onClick={()=>openTpl(t)} style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:6,border:"1.5px solid rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.08)",color:IC,cursor:"pointer"}}>✏️ Editar</button>
              </div>}
            </div>
            {isEditing&&<div style={{background:"rgba(0,0,0,0.2)",borderRadius:10,padding:"12px 14px",border:"1px solid rgba(184,149,106,0.2)"}}>
              {t.channel==="email"&&<div style={{marginBottom:10}}>
                <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase"}}>Asunto</p>
                <input value={tplDraft.subject||""} onChange={e=>setTplDraft(p=>({...p,subject:e.target.value}))} style={inpStyle}/>
              </div>}
              {t.channel==="email"&&<div style={{marginBottom:10}}>
                <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase"}}>Saludo (título H2)</p>
                <input value={tplDraft.greeting||""} onChange={e=>setTplDraft(p=>({...p,greeting:e.target.value}))} style={inpStyle}/>
              </div>}
              <div style={{marginBottom:10}}>
                <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase"}}>Cuerpo</p>
                <textarea value={tplDraft.body||""} onChange={e=>setTplDraft(p=>({...p,body:e.target.value}))} rows={6} style={{...inpStyle,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}/>
                {t.channel==="email"&&<p style={{fontSize:10,color:"rgba(255,255,255,0.35)",margin:"4px 0 0"}}>Tip: usá **texto** para negrita y doble salto de línea para nuevo párrafo.</p>}
              </div>
              {t.channel==="email"&&t.key!=="email_cerrada"&&<div style={{marginBottom:10}}>
                <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase"}}>Texto del botón CTA</p>
                <input value={tplDraft.cta_text||""} onChange={e=>setTplDraft(p=>({...p,cta_text:e.target.value}))} style={inpStyle}/>
              </div>}
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={saveTpl} disabled={savingTpl} style={{padding:"8px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",cursor:savingTpl?"not-allowed":"pointer",background:`linear-gradient(135deg,${B.accent},${B.primary})`,color:"#fff",opacity:savingTpl?0.6:1}}>{savingTpl?"Guardando...":"💾 Guardar"}</button>
                <button onClick={cancelTpl} style={{padding:"8px 14px",fontSize:12,fontWeight:600,borderRadius:8,border:"1.5px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.6)",cursor:"pointer"}}>Cancelar</button>
              </div>
            </div>}
          </div>;
        })}
      </div>}
    </div>

    {/* Feedback del cliente */}
    <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.25rem 1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 14px"}}>⭐ Feedback de clientes ({feedbacks.length})</h3>
      {feedbacks.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"1rem"}}>Sin feedback todavía</p>:<div>
        {feedbacks.map(f=>{
          const ratingColor=f.rating>=4?"#22c55e":f.rating>=3?"#fbbf24":"#ff6b6b";
          return <div key={f.id} style={{padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:IC,padding:"2px 8px",background:"rgba(184,149,106,0.1)",borderRadius:4}}>{f.operations?.operation_code||"—"}</span>
                <span style={{fontSize:13,color:"#fff"}}>{f.operations?.clients?`${f.operations.clients.first_name} ${f.operations.clients.last_name}`:"—"}</span>
                {f.clicked_google_review&&<span title="Dejó reseña en Google" style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"rgba(34,197,94,0.15)",color:"#22c55e"}}>📍 Google ✓</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {[1,2,3,4,5].map(n=><span key={n} style={{fontSize:16,color:n<=f.rating?ratingColor:"rgba(255,255,255,0.12)"}}>★</span>)}
                <span style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginLeft:6}}>{new Date(f.submitted_at).toLocaleDateString("es-AR",{day:"2-digit",month:"short"})}</span>
              </div>
            </div>
            {f.comment&&<p style={{fontSize:13,color:"rgba(255,255,255,0.7)",margin:"4px 0 0 0",paddingLeft:8,borderLeft:`2px solid ${ratingColor}`,fontStyle:"italic"}}>"{f.comment}"</p>}
          </div>;
        })}
      </div>}
    </div>
  </div>;
}

function AdminTasks({token}){
  const [tasks,setTasks]=useState([]);
  const [lo,setLo]=useState(true);
  const [newTitle,setNewTitle]=useState("");
  const [newPriority,setNewPriority]=useState("normal");
  const [newDueDate,setNewDueDate]=useState("");
  const [showCompleted,setShowCompleted]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [editText,setEditText]=useState("");

  const load=async()=>{
    const r=await dq("admin_tasks",{token,filters:"?select=*&order=done.asc,created_at.desc"});
    setTasks(Array.isArray(r)?r:[]);
    setLo(false);
  };
  useEffect(()=>{load();},[token]);

  const addTask=async()=>{
    const t=newTitle.trim();
    if(!t)return;
    const body={title:t,priority:newPriority};
    if(newDueDate)body.due_date=newDueDate;
    await dq("admin_tasks",{method:"POST",token,body});
    setNewTitle("");setNewDueDate("");setNewPriority("normal");
    load();
  };

  const toggleDone=async(task)=>{
    const done=!task.done;
    await dq("admin_tasks",{method:"PATCH",token,filters:`?id=eq.${task.id}`,body:{done,done_at:done?new Date().toISOString():null}});
    setTasks(tasks.map(t=>t.id===task.id?{...t,done,done_at:done?new Date().toISOString():null}:t));
  };

  const deleteTask=async(id)=>{
    if(!confirm("¿Eliminar esta tarea?"))return;
    await dq("admin_tasks",{method:"DELETE",token,filters:`?id=eq.${id}`});
    setTasks(tasks.filter(t=>t.id!==id));
  };

  const saveEdit=async(id)=>{
    const t=editText.trim();
    if(!t){setEditingId(null);return;}
    await dq("admin_tasks",{method:"PATCH",token,filters:`?id=eq.${id}`,body:{title:t}});
    setTasks(tasks.map(x=>x.id===id?{...x,title:t}:x));
    setEditingId(null);
  };

  const pending=tasks.filter(t=>!t.done);
  const completed=tasks.filter(t=>t.done);

  const PRIO_COLOR={alta:"#ef4444",normal:"#60a5fa",baja:"#94a3b8"};
  const PRIO_LBL={alta:"Alta",normal:"Normal",baja:"Baja"};

  const formatDue=(d)=>{
    if(!d)return null;
    const s=String(d).slice(0,10);
    const [y,m,day]=s.split("-");
    const date=new Date(Number(y),Number(m)-1,Number(day));
    const today=new Date();today.setHours(0,0,0,0);
    const diff=Math.round((date-today)/86400000);
    if(diff<0)return {text:`Vencida (${Math.abs(diff)}d)`,color:"#ef4444"};
    if(diff===0)return {text:"Hoy",color:"#fb923c"};
    if(diff===1)return {text:"Mañana",color:"#fb923c"};
    if(diff<=7)return {text:`En ${diff}d`,color:"#fbbf24"};
    return {text:date.toLocaleDateString("es-AR",{day:"2-digit",month:"short"}),color:"rgba(255,255,255,0.4)"};
  };

  if(lo)return <p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"2rem 0"}}>Cargando...</p>;

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div>
        <h2 style={{fontSize:22,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>Tareas pendientes</h2>
        <p style={{fontSize:12,color:"rgba(255,255,255,0.45)",margin:0}}>{pending.length} pendiente{pending.length!==1?"s":""}{completed.length>0&&` · ${completed.length} completada${completed.length!==1?"s":""}`}</p>
      </div>
    </div>

    {/* Form para agregar nueva tarea */}
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"16px",marginBottom:20}}>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div style={{flex:"2 1 300px",minWidth:200}}>
          <label style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",display:"block",marginBottom:4}}>Nueva tarea</label>
          <input
            type="text"
            value={newTitle}
            onChange={e=>setNewTitle(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addTask()}
            placeholder="¿Qué tenés que hacer?"
            style={{width:"100%",padding:"10px 12px",fontSize:14,background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,color:"#fff",outline:"none",boxSizing:"border-box"}}
          />
        </div>
        <div style={{flex:"0 0 auto",minWidth:110}}>
          <label style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",display:"block",marginBottom:4}}>Prioridad</label>
          <select value={newPriority} onChange={e=>setNewPriority(e.target.value)} style={{width:"100%",padding:"10px 12px",fontSize:13,background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,color:"#fff",outline:"none",boxSizing:"border-box",cursor:"pointer"}}>
            <option value="baja">Baja</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
          </select>
        </div>
        <div style={{flex:"0 0 auto",minWidth:130}}>
          <label style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",display:"block",marginBottom:4}}>Vencimiento</label>
          <input
            type="date"
            value={newDueDate}
            onChange={e=>setNewDueDate(e.target.value)}
            style={{width:"100%",padding:"10px 12px",fontSize:13,background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,color:"#fff",outline:"none",boxSizing:"border-box"}}
          />
        </div>
        <button
          onClick={addTask}
          disabled={!newTitle.trim()}
          style={{padding:"10px 20px",fontSize:13,fontWeight:700,background:newTitle.trim()?IC:"rgba(255,255,255,0.1)",color:"#fff",border:"none",borderRadius:8,cursor:newTitle.trim()?"pointer":"not-allowed",opacity:newTitle.trim()?1:0.5}}
        >
          + Agregar
        </button>
      </div>
    </div>

    {/* Lista de pendientes */}
    {pending.length===0&&completed.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"rgba(255,255,255,0.35)"}}>
      <div style={{fontSize:40,marginBottom:8}}>✓</div>
      <p style={{margin:0,fontSize:14}}>No tenés tareas pendientes — todo al día</p>
    </div>}

    {pending.length>0&&<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
      {pending.sort((a,b)=>{
        const pr={alta:0,normal:1,baja:2};
        if(pr[a.priority]!==pr[b.priority])return pr[a.priority]-pr[b.priority];
        if(a.due_date&&b.due_date)return a.due_date.localeCompare(b.due_date);
        if(a.due_date)return -1;
        if(b.due_date)return 1;
        return b.created_at.localeCompare(a.created_at);
      }).map(t=>{
        const due=formatDue(t.due_date);
        return <div key={t.id} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${t.priority==="alta"?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.08)"}`,borderLeft:`4px solid ${PRIO_COLOR[t.priority]}`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>toggleDone(t)} style={{width:22,height:22,minWidth:22,borderRadius:6,border:"2px solid rgba(255,255,255,0.3)",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}} title="Marcar como completada" />
          <div style={{flex:1,minWidth:0}}>
            {editingId===t.id?<input
              type="text"
              value={editText}
              onChange={e=>setEditText(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")saveEdit(t.id);if(e.key==="Escape")setEditingId(null);}}
              onBlur={()=>saveEdit(t.id)}
              autoFocus
              style={{width:"100%",padding:"4px 8px",fontSize:14,background:"rgba(0,0,0,0.4)",border:`1px solid ${IC}`,borderRadius:6,color:"#fff",outline:"none",boxSizing:"border-box"}}
            />:<p onClick={()=>{setEditingId(t.id);setEditText(t.title);}} style={{margin:0,fontSize:14,color:"#fff",cursor:"text",lineHeight:1.4}}>{t.title}</p>}
            <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:10,fontWeight:700,color:PRIO_COLOR[t.priority],textTransform:"uppercase",letterSpacing:"0.04em"}}>{PRIO_LBL[t.priority]}</span>
              {due&&<span style={{fontSize:11,color:due.color,fontWeight:600}}>📅 {due.text}</span>}
              <span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>Creada {new Date(t.created_at).toLocaleDateString("es-AR",{day:"2-digit",month:"short"})}</span>
            </div>
          </div>
          <button onClick={()=>deleteTask(t.id)} style={{padding:"6px 10px",fontSize:12,background:"transparent",border:"1px solid rgba(255,80,80,0.25)",borderRadius:6,color:"rgba(255,100,100,0.7)",cursor:"pointer"}} title="Eliminar">✕</button>
        </div>;
      })}
    </div>}

    {/* Sección completadas (colapsable) */}
    {completed.length>0&&<div>
      <button onClick={()=>setShowCompleted(!showCompleted)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.55)",cursor:"pointer",fontSize:12,fontWeight:700,padding:"8px 0",display:"flex",alignItems:"center",gap:6}}>
        <span style={{transform:showCompleted?"rotate(90deg)":"rotate(0)",transition:"transform 0.15s",display:"inline-block"}}>▶</span>
        {showCompleted?"Ocultar":"Ver"} completadas ({completed.length})
      </button>
      {showCompleted&&<div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8,opacity:0.5}}>
        {completed.slice(0,50).map(t=><div key={t.id} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.028)",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>toggleDone(t)} style={{width:22,height:22,minWidth:22,borderRadius:6,border:`2px solid ${IC}`,background:IC,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,padding:0}} title="Marcar como pendiente">✓</button>
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.5)",textDecoration:"line-through"}}>{t.title}</p>
            {t.done_at&&<span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>Completada {new Date(t.done_at).toLocaleDateString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>}
          </div>
          <button onClick={()=>deleteTask(t.id)} style={{padding:"4px 8px",fontSize:11,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,color:"rgba(255,255,255,0.4)",cursor:"pointer"}}>✕</button>
        </div>)}
      </div>}
    </div>}
  </div>;
}

function QuotesList({token}){
  const [quotes,setQuotes]=useState([]);const [lo,setLo]=useState(true);const [fStatus,setFStatus]=useState("");const [selQuote,setSelQuote]=useState(null);const [clientsMap,setClientsMap]=useState({});
  const [editProds,setEditProds]=useState([]);const [editPkgs,setEditPkgs]=useState([]);const [editTotalCost,setEditTotalCost]=useState("");const [dirty,setDirty]=useState(false);const [saving,setSaving]=useState(false);const [savedAt,setSavedAt]=useState(null);
  const [tariffs,setTariffs]=useState([]);const [config,setConfig]=useState({});const [quoteOverrides,setQuoteOverrides]=useState([]);
  useEffect(()=>{(async()=>{const [q,cl,tf,cc]=await Promise.all([
    dq("quotes",{token,filters:"?select=*&order=created_at.desc"}),
    dq("clients",{token,filters:"?select=id,first_name,last_name,whatsapp,client_code,tax_condition"}),
    dq("tariffs",{token,filters:"?select=*&type=eq.rate&order=sort_order.asc"}),
    dq("calc_config",{token,filters:"?select=*"})
  ]);setQuotes(Array.isArray(q)?q:[]);const cm={};(Array.isArray(cl)?cl:[]).forEach(c=>{cm[c.id]=c;});setClientsMap(cm);setTariffs(Array.isArray(tf)?tf:[]);const cfg={};(Array.isArray(cc)?cc:[]).forEach(r=>{cfg[r.key]=Number(r.value);});setConfig(cfg);setLo(false);})();},[token]);
  useEffect(()=>{
    if(!selQuote){setEditProds([]);setEditPkgs([]);setEditTotalCost("");setDirty(false);setSavedAt(null);setQuoteOverrides([]);return;}
    const p=typeof selQuote.products==="string"?JSON.parse(selQuote.products):selQuote.products||[];
    const pk=typeof selQuote.packages==="string"?JSON.parse(selQuote.packages):selQuote.packages||[];
    setEditProds(JSON.parse(JSON.stringify(Array.isArray(p)?p:[])));
    setEditPkgs(JSON.parse(JSON.stringify(Array.isArray(pk)?pk:[])));
    setEditTotalCost(String(selQuote.total_cost||""));
    setDirty(false);setSavedAt(null);
    if(selQuote.client_id)dq("client_tariff_overrides",{token,filters:`?client_id=eq.${selQuote.client_id}&select=*`}).then(ov=>setQuoteOverrides(Array.isArray(ov)?ov:[]));
    else setQuoteOverrides([]);
  },[selQuote?.id,token]);
  const chProd=(i,f,v)=>{setEditProds(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));setDirty(true);};
  const chNcm=(i,f,v)=>{setEditProds(p=>p.map((x,j)=>j===i?{...x,ncm:{...(x.ncm||{}),[f]:v,ncm_code:x.ncm?.ncm_code||"MANUAL"}}:x));setDirty(true);};
  const chPkg=(i,f,v)=>{setEditPkgs(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));setDirty(true);};
  const addPkg=()=>{setEditPkgs(p=>[...p,{qty:"1",length:"",width:"",height:"",weight:""}]);setDirty(true);};
  const rmPkg=(i)=>{setEditPkgs(p=>p.filter((_,j)=>j!==i));setDirty(true);};
  // Breakdown computado desde editProds + editPkgs usando la misma lógica que el calculador
  const CHANNEL_MAP={aereo_a_china:"aereo_blanco",aereo_b_china:"aereo_negro",aereo_b_usa:"aereo_negro",maritimo_a_china:"maritimo_blanco",maritimo_b:"maritimo_negro"};
  // Canales disponibles según origen.
  const channelsForOrigin=(origin)=>{
    if(origin==="USA")return[
      {key:"aereo_b_usa",name:"Aéreo Integral AC — USA",info:"48-72 hs hábiles",type:"aereo_b"},
      {key:"maritimo_b",name:"Marítimo Integral AC",info:"45-55 días",type:"maritimo_b"},
    ];
    // China (default)
    return[
      {key:"aereo_a_china",name:"Aéreo Courier Comercial",info:"7-10 días hábiles",type:"aereo_a"},
      {key:"aereo_b_china",name:"Aéreo Integral AC",info:"10-15 días hábiles",type:"aereo_b"},
      {key:"maritimo_a_china",name:"Marítimo Carga LCL/FCL",info:"45-55 días",type:"maritimo_a"},
      {key:"maritimo_b",name:"Marítimo Integral AC",info:"45-55 días",type:"maritimo_b"},
    ];
  };
  // Calcula shipping si aplica
  const calcShippingCost=(pks)=>{
    if(!selQuote?.delivery||selQuote.delivery==="oficina")return 0;
    const totW=pks.reduce((s,p)=>s+p.gross_weight_kg*p.quantity,0);
    const ranges=[[25,config.envio_caba_0_25||20],[50,config.envio_caba_25_50||30],[100,config.envio_caba_50_100||50],[Infinity,config.envio_caba_100||75]];
    let c=0;
    for(const[max,amt] of ranges){if(totW<max){c=amt;break;}}
    if(selQuote.delivery==="gba")c+=(config.envio_gba_extra||10);
    return c;
  };
  // Calcula desaduanaje para aéreo A (tabla desembolso) — CIF-based
  const desembolsoForCif=(cif)=>{
    const t=[[5,0],[9,36],[20,50],[50,58],[100,65],[400,72],[800,84],[1000,96],[Infinity,120]];
    for(const[max,amt] of t)if(cif<max)return amt;
    return 120;
  };
  // Breakdown del canal actualmente seleccionado (mantiene compat con código existente)
  const computeBreakdown=(channelKey)=>{
    if(!selQuote||tariffs.length===0)return null;
    try{
      const ck=channelKey||selQuote.channel_key;
      const quoteClient=selQuote.client_id?clientsMap[selQuote.client_id]:null;
      const opLike={channel:CHANNEL_MAP[ck]||"aereo_negro",origin:selQuote.origin,shipping_to_door:selQuote.delivery&&selQuote.delivery!=="oficina",shipping_cost:0,has_battery:false};
      const items=editProds.map(p=>({unit_price_usd:p.unit_price,quantity:p.quantity,import_duty_rate:p.ncm?.import_duty_rate||0,statistics_rate:p.ncm?.statistics_rate||0,iva_rate:p.ncm?.iva_rate||21,iva_additional_rate:20,iigg_rate:6,iibb_rate:5}));
      const pks=editPkgs.map(p=>({quantity:Number(p.qty||1),gross_weight_kg:Number(p.weight||0),length_cm:Number(p.length||0),width_cm:Number(p.width||0),height_cm:Number(p.height||0)}));
      const shipC=calcShippingCost(pks);
      opLike.shipping_cost=shipC;
      const r=calcOpBudget(opLike,items,pks,tariffs,config,quoteOverrides,quoteClient);
      return{...r,shipCost:shipC,channelKey:ck};
    }catch(e){console.error("computeBreakdown",e);return null;}
  };
  // Compute para TODOS los canales según origen
  const computeAllChannels=()=>{
    const chs=channelsForOrigin(selQuote?.origin||"China");
    return chs.map(ch=>{const br=computeBreakdown(ch.key);return br?{...ch,...br}:{...ch,error:true};}).filter(x=>!x.error);
  };
  // Totales agregados de bultos
  const computePackagesTotals=()=>{
    let gross=0,cbm=0,billable=0;
    editPkgs.forEach(p=>{
      const q=Number(p.qty||1),w=Number(p.weight||0),l=Number(p.length||0),wd=Number(p.width||0),h=Number(p.height||0);
      gross+=w*q;
      if(l&&wd&&h){
        cbm+=((l*wd*h)/1000000)*q;
        // Volumétrico estándar aéreo: L*W*H / 5000 cm³ per bulto
        const vol=((l*wd*h)/5000)*q;
        billable+=Math.max(w*q,vol);
      }else{
        billable+=w*q;
      }
    });
    const volumetric=editPkgs.reduce((s,p)=>{const q=Number(p.qty||1),l=Number(p.length||0),wd=Number(p.width||0),h=Number(p.height||0);return s+(l&&wd&&h?((l*wd*h)/5000)*q:0);},0);
    return{gross,cbm,billable,volumetric};
  };
  const saveQuoteEdit=async()=>{if(!selQuote)return;setSaving(true);const newFob=editProds.reduce((s,p)=>s+Number(p.unit_price||0)*Number(p.quantity||1),0);
    // Recalc totales derivados de bultos
    let totW=0,totCBM=0;editPkgs.forEach(p=>{const q=Number(p.qty||1);const w=Number(p.weight||0);totW+=w*q;const l=Number(p.length||0),wd=Number(p.width||0),h=Number(p.height||0);if(l&&wd&&h)totCBM+=((l*wd*h)/1000000)*q;});
    const allChannels=computeAllChannels();
    // Alternativas guardadas con info mínima necesaria para que el cliente las vea y elija
    const channelAlternatives=allChannels.map(c=>({key:c.key,name:c.name,info:c.info,type:c.type,totalTax:c.totalTax||0,flete:c.flete||0,seguro:c.seguro||0,shipCost:c.shipCost||0,totalAbonar:c.totalAbonar||0}));
    // El "canal seleccionado" de la quote se mantiene para PDF + UI. Si el admin no tocó, conserva el original.
    const currentBr=computeBreakdown(selQuote.channel_key);
    const body={products:editProds,packages:editPkgs,total_fob:newFob,total_cost:currentBr?.totalAbonar||Number(editTotalCost)||selQuote.total_cost,total_weight:totW,total_cbm:totCBM,tax_breakdown:currentBr?{totalTax:currentBr.totalTax,flete:currentBr.flete,seguro:currentBr.seguro,shipCost:currentBr.shipCost}:null,channel_alternatives:channelAlternatives};
    await dq("quotes",{method:"PATCH",token,filters:`?id=eq.${selQuote.id}`,body});setQuotes(p=>p.map(q=>q.id===selQuote.id?{...q,...body}:q));setSelQuote(p=>({...p,...body}));setDirty(false);setSavedAt(new Date().toISOString());setSaving(false);
  };
  const updateStatus=async(id,status)=>{await dq("quotes",{method:"PATCH",token,filters:`?id=eq.${id}`,body:{status}});setQuotes(p=>p.map(q=>q.id===id?{...q,status}:q));};
  const downloadPdf=(q)=>{
    const prods=editProds.length?editProds:(typeof q.products==="string"?JSON.parse(q.products):q.products||[]);
    const w=window.open("","_blank");if(!w)return;
    const totFob=prods.reduce((s,p)=>s+Number(p.unit_price||0)*Number(p.quantity||1),0);
    const rows=prods.map(p=>{const fob=Number(p.unit_price||0)*Number(p.quantity||1);const nc=p.ncm||{};return `<tr><td>${p.description||p.type||""}</td><td class="c">${p.quantity||1}</td><td class="r">USD ${Number(p.unit_price||0).toFixed(2)}</td><td class="r">USD ${fob.toFixed(2)}</td><td class="c mono">${nc.ncm_code||"—"}</td><td class="c">${nc.import_duty_rate||0}%</td><td class="c">${nc.statistics_rate||0}%</td><td class="c">${nc.iva_rate||21}%</td></tr>`;}).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cotización ${q.client_code||""}</title><style>
      *{box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;padding:32px;color:#111;max-width:900px;margin:0 auto}
      h1{font-size:22px;margin:0 0 4px;color:#1B4F8A}.sub{color:#666;font-size:12px;margin-bottom:24px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;padding:14px;background:#f5f7fa;border-radius:8px}
      .grid div{font-size:11px}.grid b{font-size:13px;color:#111;display:block;margin-top:2px}
      table{width:100%;border-collapse:collapse;margin-top:14px;font-size:11px}
      th,td{padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left}
      th{background:#1B4F8A;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:0.05em}
      td.c{text-align:center}td.r{text-align:right}td.mono{font-family:monospace}
      tr:nth-child(even) td{background:#fafbfc}
      .totals{margin-top:18px;padding:14px;background:#1B4F8A;color:#fff;border-radius:8px;display:flex;justify-content:space-between;align-items:center}
      .totals .lbl{font-size:11px;text-transform:uppercase;letter-spacing:0.05em;opacity:0.8}
      .totals .big{font-size:20px;font-weight:700}
      .foot{margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:10px;color:#666}
    </style></head><body>
      <h1>Cotización Argencargo</h1>
      <div class="sub">Emitida ${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})} · Ref ${q.id?.slice(0,8)||""}</div>
      <div class="grid">
        <div>CLIENTE<b>${q.client_name||""}</b><span style="font-family:monospace;color:#1B4F8A">${q.client_code||""}</span></div>
        <div>ORIGEN<b>${q.origin||""}</b></div>
        <div>CANAL<b>${q.channel_name||""}</b></div>
        <div>ENTREGA<b>${q.delivery||"—"}</b></div>
      </div>
      <h3 style="margin:18px 0 6px;font-size:13px;color:#1B4F8A">Productos y clasificación arancelaria</h3>
      <table><thead><tr><th>Descripción</th><th>Cant</th><th>Unit.</th><th>FOB</th><th>NCM</th><th>Derechos</th><th>TE</th><th>IVA</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals"><div><div class="lbl">Valor FOB</div><div class="big">USD ${totFob.toFixed(2)}</div></div><div style="text-align:right"><div class="lbl">Costo total estimado (DDP)</div><div class="big">USD ${Number(q.total_cost||0).toFixed(2)}</div></div></div>
      <div class="foot">Los valores de NCM, derechos de importación, tasa de estadística e IVA son los aplicables según la normativa vigente al momento de emitir esta cotización. Los costos pueden variar según volumen final, tipo de cambio y gastos documentales. Argencargo — Integral Freight Forwarding.</div>
      <script>setTimeout(()=>window.print(),300)</script>
    </body></html>`);w.document.close();
  };
  const ST={pending:{l:"Pendiente",c:"#fbbf24"},contacted:{l:"Contactado",c:"#60a5fa"},converted:{l:"Convertida",c:"#22c55e"},rejected:{l:"Rechazada",c:"#f87171"}};
  const filtered=fStatus?quotes.filter(q=>q.status===fStatus):quotes;
  const formatDate=(d)=>new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>Cotizaciones ({quotes.length})</h2>
      <div style={{display:"flex",gap:8}}>{[{k:"",l:"Todas"},{k:"pending",l:"Pendientes"},{k:"contacted",l:"Contactados"},{k:"converted",l:"Convertidas"}].map(s=><button key={s.k} onClick={()=>setFStatus(s.k)} style={{padding:"6px 14px",fontSize:11,fontWeight:700,borderRadius:8,border:fStatus===s.k?`1.5px solid ${IC}`:"1.5px solid rgba(255,255,255,0.08)",background:fStatus===s.k?"rgba(184,149,106,0.12)":"rgba(255,255,255,0.028)",color:fStatus===s.k?IC:"rgba(255,255,255,0.4)",cursor:"pointer"}}>{s.l}</button>)}</div>
    </div>
    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando...</p>:filtered.length===0?<p style={{color:"rgba(255,255,255,0.45)",textAlign:"center",padding:"2rem 0"}}>No hay cotizaciones</p>:
    <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.25)"}}>
          {["Fecha","Cliente","Origen","Canal","FOB","Costo","Estado","Acción"].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map(q=>{const st=ST[q.status]||{l:q.status,c:"#999"};const prods=typeof q.products==="string"?JSON.parse(q.products):q.products;const prodDesc=Array.isArray(prods)?prods.map(p=>p.description||p.type).join(", "):"";
        return <tr key={q.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"}} onClick={()=>setSelQuote(q)} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)",fontSize:12}}>{formatDate(q.created_at)}</td>
          <td style={{padding:"12px 14px"}}><span style={{fontFamily:"monospace",fontWeight:700,color:IC,fontSize:12}}>{q.client_code}</span><br/><span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>{q.client_name}</span></td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)"}}>{q.origin}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.6)"}}>{q.channel_name}<br/><span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{prodDesc?.substring(0,40)}</span></td>
          <td style={{padding:"12px 14px",color:"#fff",fontWeight:600}}>USD {Number(q.total_fob||0).toLocaleString("en-US")}</td>
          <td style={{padding:"12px 14px",color:IC,fontWeight:700}}>USD {Number(q.total_cost||0).toLocaleString("en-US")}</td>
          <td style={{padding:"12px 14px"}}>
            {(()=>{const ageH=(Date.now()-new Date(q.created_at))/3600000;const abandoned=q.status==="pending"&&ageH>=48;return <><span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:st.c,background:`${st.c}15`,border:`1px solid ${st.c}33`}}>{st.l}</span>{abandoned&&<span title={`Pendiente hace ${Math.floor(ageH/24)}d ${Math.floor(ageH%24)}h`} style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,color:"#f97316",background:"rgba(249,115,22,0.1)",border:"1px solid rgba(249,115,22,0.3)",marginLeft:6}}>⚠ Abandonada</span>}</>;})()}
          </td>
          <td style={{padding:"12px 14px"}} onClick={e=>e.stopPropagation()}>
            {(()=>{const cl=q.client_id?clientsMap[q.client_id]:null;const wa=cl?.whatsapp?.replace(/[^0-9]/g,"");const ageH=(Date.now()-new Date(q.created_at))/3600000;const abandoned=q.status==="pending"&&ageH>=48;const prodSummary=Array.isArray(prods)?prods.map(p=>p.description||p.type).join(", "):"";const msg=encodeURIComponent(`Hola ${q.client_name}! Hace unos días cotizaste *${prodSummary}* por *${q.channel_name}* (USD ${Number(q.total_cost||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}).\n\n¿Pudiste revisarla? Si querés avanzar esta semana te agilizo el proceso. Cualquier duda me escribís.`);
            return <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {abandoned&&wa&&<a href={`https://wa.me/${wa}?text=${msg}`} target="_blank" rel="noopener noreferrer" style={{padding:"4px 8px",fontSize:10,fontWeight:700,borderRadius:6,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",textDecoration:"none",whiteSpace:"nowrap"}}>📱 Recordar</a>}
              <select value={q.status} onChange={e=>updateStatus(q.id,e.target.value)} style={{padding:"4px 8px",fontSize:11,border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}>{Object.entries(ST).map(([k,v])=><option key={k} value={k} style={{background:"#142038"}}>{v.l}</option>)}</select>
            </div>;})()}
          </td>
        </tr>;})}</tbody>
      </table>
    </div>}
    {/* Quote detail modal */}
    {selQuote&&(()=>{const q=selQuote;const prods=typeof q.products==="string"?JSON.parse(q.products):q.products||[];const pkgs=typeof q.packages==="string"?JSON.parse(q.packages):q.packages||[];const st=ST[q.status]||{l:q.status,c:"#999"};
    return <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setSelQuote(null)}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}}/>
      <div style={{position:"relative",maxWidth:700,width:"90%",maxHeight:"85vh",overflow:"auto",background:"#142038",borderRadius:20,border:"1px solid rgba(255,255,255,0.06)",padding:"2rem",boxShadow:"0 30px 60px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div><h3 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>Cotización</h3><p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0}}>{formatDate(q.created_at)}</p></div>
          <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:6,color:st.c,background:`${st.c}15`,border:`1px solid ${st.c}33`}}>{st.l}</span><button onClick={()=>setSelQuote(null)} style={{fontSize:20,background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer"}}>✕</button></div>
        </div>
        {/* CLIENTE + meta */}
        <div style={{padding:"16px 18px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Cliente</p>
            <p style={{fontSize:17,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.01em"}}>{q.client_name}</p>
            <p style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:IC,margin:"3px 0 0",letterSpacing:"0.04em"}}>{q.client_code}</p>
          </div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
            <div><p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Origen</p><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}>{q.origin}</p></div>
            <div><p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Entrega</p><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0,textTransform:"capitalize"}}>{q.delivery||"oficina"}</p></div>
          </div>
        </div>
        {editProds.length>0&&(()=>{
          // Desaduanaje a nivel operación: se calcula sobre el CIF TOTAL (aprox = FOB total),
          // se le agrega 21% de IVA, y se prorratea a cada producto según su share de FOB.
          const isAereoA=selQuote.channel_key==="aereo_a_china";
          const totalFobAll=editProds.reduce((s,p)=>s+Number(p.unit_price||0)*Number(p.quantity||1),0);
          const desembBase=isAereoA?desembolsoForCif(totalFobAll):0;
          const desembConIVA=desembBase*1.21;
          return <div style={{marginBottom:16}}>
          <h4 style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Productos</h4>
          {editProds.map((p,i)=>{const fobItem=Number(p.unit_price||0)*Number(p.quantity||1);const nc=p.ncm||{};const inpStyle={padding:"7px 10px",fontSize:11.5,border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit"};
            // Prorrateo del desaduanaje total (con IVA) según share de FOB del ítem
            const share=totalFobAll>0?fobItem/totalFobAll:0;
            const desemb=isAereoA?desembConIVA*share:null;
            return <div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"16px 18px",marginBottom:10}}>
            {/* Header: Descripción grande */}
            <p style={{fontSize:15,fontWeight:700,color:"#fff",margin:"0 0 10px",letterSpacing:"-0.01em"}}>{p.description||p.type||"Producto sin descripción"}</p>
            {/* Cantidad + Unitario + Total FOB */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1.2fr",gap:12,marginBottom:14,padding:"12px 14px",background:"rgba(0,0,0,0.2)",borderRadius:8}}>
              <div><p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Cantidad</p><p style={{fontSize:16,fontWeight:700,color:"#fff",margin:0,fontVariantNumeric:"tabular-nums"}}>{p.quantity}</p></div>
              <div><p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Precio unitario</p><p style={{fontSize:16,fontWeight:700,color:"#fff",margin:0,fontVariantNumeric:"tabular-nums"}}>USD {Number(p.unit_price||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
              <div style={{textAlign:"right"}}><p style={{fontSize:9.5,fontWeight:700,color:GOLD_LIGHT,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Total FOB</p><p style={{fontSize:18,fontWeight:800,color:GOLD_LIGHT,margin:0,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em"}}>USD {fobItem.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div>
            </div>
            {/* NCM + impuestos (editables) */}
            <p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Clasificación e impuestos</p>
            <div style={{display:"grid",gridTemplateColumns:"1.1fr 2fr 0.8fr 0.8fr 0.8fr",gap:8,alignItems:"end",fontSize:11}}>
              <div><label style={{fontSize:9.5,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:3}}>NCM</label><input value={nc.ncm_code||""} onChange={e=>chNcm(i,"ncm_code",e.target.value)} style={{...inpStyle,fontFamily:"'JetBrains Mono',monospace",color:GOLD_LIGHT,fontWeight:600,letterSpacing:"0.04em"}} placeholder="8471.30.00"/></div>
              <div><label style={{fontSize:9.5,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:3}}>Descripción NCM</label><input value={nc.ncm_description||""} onChange={e=>chNcm(i,"ncm_description",e.target.value)} style={inpStyle} placeholder="..."/></div>
              <div><label style={{fontSize:9.5,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:3}}>Derechos %</label><input type="number" value={nc.import_duty_rate??""} onChange={e=>chNcm(i,"import_duty_rate",Number(e.target.value)||0)} style={inpStyle} step="0.1"/></div>
              <div><label style={{fontSize:9.5,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:3}}>TE %</label><input type="number" value={nc.statistics_rate??""} onChange={e=>chNcm(i,"statistics_rate",Number(e.target.value)||0)} style={inpStyle} step="0.1"/></div>
              <div><label style={{fontSize:9.5,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:3}}>IVA %</label><input type="number" value={nc.iva_rate??""} onChange={e=>chNcm(i,"iva_rate",Number(e.target.value)||0)} style={inpStyle} step="0.1"/></div>
            </div>
            {/* Desaduanaje prorrateado (sólo aéreo A) */}
            {isAereoA&&<div style={{marginTop:8,padding:"8px 12px",background:"rgba(184,149,106,0.08)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11}}>
              <span style={{color:"rgba(255,255,255,0.6)"}}>Desaduanaje (prorrateado · {(share*100).toFixed(1)}% del total)</span>
              <span style={{color:GOLD_LIGHT,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>USD {desemb.toFixed(2)}</span>
            </div>}
          </div>;})}
          {isAereoA&&editProds.length>1&&<div style={{marginTop:6,padding:"8px 12px",background:"rgba(255,255,255,0.025)",border:"1px dashed rgba(184,149,106,0.25)",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11}}>
            <span style={{color:"rgba(255,255,255,0.45)"}}>Desaduanaje total de la operación (USD {desembBase.toFixed(2)} + 21% IVA)</span>
            <span style={{color:GOLD_LIGHT,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>USD {desembConIVA.toFixed(2)}</span>
          </div>}
        </div>;})()}
        {/* Bultos editables + totales */}
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <h4 style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:0,textTransform:"uppercase",letterSpacing:"0.1em"}}>Bultos</h4>
            <button onClick={addPkg} style={{fontSize:11,fontWeight:600,padding:"5px 12px",borderRadius:8,border:"1px dashed rgba(184,149,106,0.35)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer"}}>+ Bulto</button>
          </div>
          {editPkgs.length===0&&<p style={{fontSize:12,color:"rgba(255,255,255,0.4)",fontStyle:"italic",margin:"4px 0 0"}}>Sin bultos cargados</p>}
          {editPkgs.map((pk,i)=>{const inpStyle={padding:"7px 10px",fontSize:11.5,border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none",width:"100%",boxSizing:"border-box"};return <div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:12,fontWeight:700,color:GOLD_LIGHT,letterSpacing:"0.02em"}}>Bulto {i+1}</span>
              <button onClick={()=>rmPkg(i)} style={{fontSize:10,fontWeight:600,padding:"3px 10px",borderRadius:6,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.08)",color:"#ff6b6b",cursor:"pointer"}}>Eliminar</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:8}}>
              <div><label style={{fontSize:9.5,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:3}}>Cant.</label><input type="number" value={pk.qty||""} onChange={e=>chPkg(i,"qty",e.target.value)} style={inpStyle} placeholder="1"/></div>
              <div><label style={{fontSize:9.5,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:3}}>Largo cm</label><input type="number" value={pk.length||""} onChange={e=>chPkg(i,"length",e.target.value)} style={inpStyle} placeholder="60"/></div>
              <div><label style={{fontSize:9.5,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:3}}>Ancho cm</label><input type="number" value={pk.width||""} onChange={e=>chPkg(i,"width",e.target.value)} style={inpStyle} placeholder="40"/></div>
              <div><label style={{fontSize:9.5,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:3}}>Alto cm</label><input type="number" value={pk.height||""} onChange={e=>chPkg(i,"height",e.target.value)} style={inpStyle} placeholder="35"/></div>
              <div><label style={{fontSize:9.5,color:"rgba(255,255,255,0.45)",display:"block",marginBottom:3}}>Peso kg</label><input type="number" value={pk.weight||""} onChange={e=>chPkg(i,"weight",e.target.value)} style={inpStyle} placeholder="12"/></div>
            </div>
          </div>;})}
          {/* Totales de bultos */}
          {editPkgs.length>0&&(()=>{const t=computePackagesTotals();return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,padding:"12px 14px",background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:10,marginTop:4}}>
            <div><p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.08em"}}>CBM total</p><p style={{fontSize:14,fontWeight:700,color:"#fff",margin:0,fontVariantNumeric:"tabular-nums"}}>{t.cbm.toFixed(4)} m³</p></div>
            <div><p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Kg bruto</p><p style={{fontSize:14,fontWeight:700,color:"#fff",margin:0,fontVariantNumeric:"tabular-nums"}}>{t.gross.toFixed(2)} kg</p></div>
            <div><p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Kg volumétrico</p><p style={{fontSize:14,fontWeight:700,color:"#fff",margin:0,fontVariantNumeric:"tabular-nums"}}>{t.volumetric.toFixed(2)} kg</p></div>
            <div><p style={{fontSize:9.5,fontWeight:700,color:GOLD_LIGHT,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Kg facturable</p><p style={{fontSize:14,fontWeight:800,color:GOLD_LIGHT,margin:0,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em"}}>{t.billable.toFixed(2)} kg</p></div>
          </div>;})()}
        </div>
        {/* COSTOS POR CANAL — las 4 opciones */}
        {(()=>{const channels=computeAllChannels();if(!channels.length)return null;
          const best=channels.reduce((min,ch)=>ch.totalAbonar<(min?.totalAbonar||Infinity)?ch:min,null);
          return <div style={{marginBottom:16}}>
            <h4 style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Costos por canal disponibles</h4>
            <div style={{display:"grid",gridTemplateColumns:channels.length<=2?"1fr 1fr":"1fr 1fr",gap:10}}>
              {channels.map(ch=>{const isB=ch.type==="aereo_b"||ch.type==="maritimo_b";const isBest=best&&ch.key===best.key&&channels.length>1;const row=(l,v)=><div style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:11}}><span style={{color:"rgba(255,255,255,0.5)"}}>{l}</span><span style={{color:"rgba(255,255,255,0.85)",fontVariantNumeric:"tabular-nums"}}>USD {Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>;
              return <div key={ch.key} style={{padding:"14px 16px",background:isBest?"linear-gradient(135deg, rgba(184,149,106,0.12) 0%, rgba(255,255,255,0.02) 100%)":"rgba(255,255,255,0.025)",border:`1px solid ${isBest?"rgba(184,149,106,0.4)":"rgba(255,255,255,0.08)"}`,borderRadius:12,position:"relative",overflow:"hidden",boxShadow:isBest?GOLD_GLOW:"none"}}>
                {isBest&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:GOLD_GRADIENT}}/>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:8}}>
                  <div><p style={{fontSize:12.5,fontWeight:700,color:"#fff",margin:0}}>{ch.name}</p><p style={{fontSize:10,color:"rgba(255,255,255,0.45)",margin:"2px 0 0"}}>{ch.info}</p></div>
                  {isBest&&<span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:999,background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.08em",textTransform:"uppercase"}}>Mejor</span>}
                </div>
                {!isB&&row("Impuestos",ch.totalTax)}
                {row(isB?"Servicio Integral":"Flete internacional",ch.flete)}
                {!isB&&row("Seguro",ch.seguro)}
                {ch.shipCost>0&&row("Envío a domicilio",ch.shipCost)}
                <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0 0",borderTop:`1px solid ${isBest?"rgba(184,149,106,0.3)":"rgba(255,255,255,0.08)"}`,marginTop:6}}>
                  <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Total DDP</span>
                  <span style={{fontSize:16,fontWeight:800,color:isBest?GOLD_LIGHT:"#fff",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em"}}>USD {ch.totalAbonar.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              </div>;})}
            </div>
          </div>;})()}
        {(()=>{const cl=q.client_id?clientsMap[q.client_id]:null;const wa=cl?.whatsapp;const prodDesc=Array.isArray(editProds)?editProds.map(p=>p.description||p.type).join(", "):"";
          const waConsulta=encodeURIComponent(`Hola ${q.client_name}! Vi que cotizaste una importación de *${prodDesc}* por *${q.channel_name}* desde *${q.origin}* el ${formatDate(q.created_at)}.\n\n¿Pudiste avanzar con la operación? ¿Necesitás más información?\n\nQuedo a disposición!`);
          const waUpdate=encodeURIComponent(`Hola ${q.client_name}! Revisamos y ajustamos tu cotización de *${prodDesc}* por *${q.channel_name}* con la clasificación arancelaria precisa.\n\n📄 *Costo total actualizado: USD ${Number(q.total_cost||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}*\n\nEntrá a tu portal para ver el detalle por producto (NCM + derechos + tasa estadística + IVA), o si preferís te paso el PDF.\n\nQuedo a disposición para avanzar!`);
          return <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
            {savedAt&&!dirty&&<p style={{fontSize:11,color:"#22c55e",margin:"0 0 10px",fontWeight:600}}>✓ Guardado. Ahora podés avisar al cliente.</p>}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <button onClick={saveQuoteEdit} disabled={saving} style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:`1px solid ${GOLD_DEEP}`,cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.02em",boxShadow:GOLD_GLOW}}>{saving?"Guardando…":"💾 Guardar cotización"}</button>
              <button onClick={()=>downloadPdf(q)} style={{padding:"10px 16px",fontSize:12,fontWeight:700,borderRadius:10,border:"1.5px solid rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.08)",color:IC,cursor:"pointer"}}>📄 Descargar PDF</button>
              {wa&&<a href={`https://wa.me/${wa.replace(/[^0-9]/g,"")}?text=${waUpdate}`} target="_blank" rel="noopener noreferrer" style={{padding:"10px 16px",fontSize:12,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",textDecoration:"none"}}>Avisar cotización actualizada</a>}
              {wa&&<a href={`https://wa.me/${wa.replace(/[^0-9]/g,"")}?text=${waConsulta}`} target="_blank" rel="noopener noreferrer" style={{padding:"10px 16px",fontSize:12,fontWeight:600,borderRadius:10,border:"1px solid rgba(37,211,102,0.3)",background:"rgba(37,211,102,0.08)",color:"#25D366",textDecoration:"none"}}>Consultar (seguimiento)</a>}
              {!wa&&<p style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>Sin WhatsApp en el cliente</p>}
              <select value={q.status} onChange={e=>{updateStatus(q.id,e.target.value);setSelQuote({...q,status:e.target.value});}} style={{padding:"10px 14px",fontSize:12,fontWeight:600,border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none",marginLeft:"auto"}}>{Object.entries(ST).map(([k,v])=><option key={k} value={k} style={{background:"#142038"}}>{v.l}</option>)}</select>
            </div>
          </div>;})()}
      </div>
    </div>;})()}
  </div>;
}

function CmdK({token,onNavigate,allClients}){
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const [results,setResults]=useState({ops:[],clients:[],flights:[]});
  const [loading,setLoading]=useState(false);
  const inputRef=useRef(null);
  useEffect(()=>{const handler=(e)=>{if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setOpen(o=>!o);}else if(e.key==="Escape")setOpen(false);};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[]);
  useEffect(()=>{if(open)setTimeout(()=>inputRef.current?.focus(),50);else{setQ("");setResults({ops:[],clients:[],flights:[]});}},[open]);
  useEffect(()=>{if(!q||q.length<2){setResults({ops:[],clients:[],flights:[]});return;}
    const tm=setTimeout(async()=>{setLoading(true);
      const ql=q.toLowerCase();
      try{
        const [ops,fls]=await Promise.all([
          dq("operations",{token,filters:`?or=(operation_code.ilike.*${q}*,description.ilike.*${q}*,international_tracking.ilike.*${q}*)&select=id,operation_code,description,status,client_id,clients(client_code,first_name,last_name)&limit=8`}),
          dq("flights",{token,filters:`?or=(flight_code.ilike.*${q}*,international_tracking.ilike.*${q}*)&select=id,flight_code,status,international_tracking&limit=5`}),
        ]);
        const clientsLocal=(allClients||[]).filter(c=>(c.first_name||"").toLowerCase().includes(ql)||(c.last_name||"").toLowerCase().includes(ql)||(c.client_code||"").toLowerCase().includes(ql)).slice(0,8);
        setResults({ops:Array.isArray(ops)?ops:[],clients:clientsLocal,flights:Array.isArray(fls)?fls:[]});
      }catch(e){}
      setLoading(false);
    },200);return()=>clearTimeout(tm);
  },[q,token,allClients]);
  if(!open)return null;
  const total=results.ops.length+results.clients.length+results.flights.length;
  return <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)",zIndex:9999,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"10vh"}}>
    <div onClick={e=>e.stopPropagation()} style={{width:"min(640px, 92vw)",background:"#142038",border:"1.5px solid rgba(184,149,106,0.3)",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,0.7)",overflow:"hidden"}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:10}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar operación, cliente, vuelo o tracking..." style={{flex:1,fontSize:15,background:"transparent",border:"none",outline:"none",color:"#fff",fontFamily:"inherit"}}/>
        <span style={{fontSize:10,color:"rgba(255,255,255,0.3)",border:"1px solid rgba(255,255,255,0.1)",padding:"2px 6px",borderRadius:4,fontFamily:"monospace"}}>ESC</span>
      </div>
      <div style={{maxHeight:"60vh",overflowY:"auto"}}>
        {q.length<2&&<p style={{padding:"24px 18px",fontSize:13,color:"rgba(255,255,255,0.4)",textAlign:"center",margin:0}}>Escribí 2+ letras para buscar...</p>}
        {q.length>=2&&!loading&&total===0&&<p style={{padding:"24px 18px",fontSize:13,color:"rgba(255,255,255,0.4)",textAlign:"center",margin:0}}>Sin resultados para "{q}"</p>}
        {results.ops.length>0&&<div>
          <p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.35)",margin:0,padding:"10px 18px 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Operaciones</p>
          {results.ops.map(o=><button key={o.id} onClick={()=>{onNavigate({type:"operation",op:o});setOpen(false);}} style={{width:"100%",textAlign:"left",padding:"10px 18px",background:"transparent",border:"none",borderTop:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",gap:10}} onMouseEnter={e=>e.currentTarget.style.background="rgba(184,149,106,0.08)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:GOLD_LIGHT,minWidth:80}}>{o.operation_code}</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.7)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.clients?`${o.clients.first_name} ${o.clients.last_name||""} · `:""}{o.description||"—"}</span>
            <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>{(SM[o.status]?.l||o.status||"").slice(0,12)}</span>
          </button>)}
        </div>}
        {results.clients.length>0&&<div>
          <p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.35)",margin:0,padding:"10px 18px 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Clientes</p>
          {results.clients.map(c=><button key={c.id} onClick={()=>{onNavigate({type:"client",client:c});setOpen(false);}} style={{width:"100%",textAlign:"left",padding:"10px 18px",background:"transparent",border:"none",borderTop:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",gap:10}} onMouseEnter={e=>e.currentTarget.style.background="rgba(184,149,106,0.08)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:GOLD_LIGHT,minWidth:80}}>{c.client_code}</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.7)"}}>{c.first_name} {c.last_name||""}</span>
          </button>)}
        </div>}
        {results.flights.length>0&&<div>
          <p style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.35)",margin:0,padding:"10px 18px 4px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Vuelos</p>
          {results.flights.map(f=><button key={f.id} onClick={()=>{onNavigate({type:"flight",flight:f});setOpen(false);}} style={{width:"100%",textAlign:"left",padding:"10px 18px",background:"transparent",border:"none",borderTop:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",gap:10}} onMouseEnter={e=>e.currentTarget.style.background="rgba(184,149,106,0.08)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:GOLD_LIGHT,minWidth:80}}>{f.flight_code}</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.7)",flex:1}}>{f.international_tracking||"—"}</span>
            <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>{f.status}</span>
          </button>)}
        </div>}
      </div>
      <div style={{padding:"8px 18px",borderTop:"1px solid rgba(255,255,255,0.06)",fontSize:10,color:"rgba(255,255,255,0.4)",display:"flex",justifyContent:"space-between"}}>
        <span>↵ para abrir</span>
        <span><kbd style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",padding:"1px 5px",borderRadius:3,fontFamily:"monospace"}}>⌘K</kbd> para buscar</span>
      </div>
    </div>
  </div>;
}

function AdminDashboard({session,onLogout}){
  const [page,setPage]=useState("today");const [selOp,setSelOp]=useState(null);const [selClient,setSelClient]=useState(null);const [newOp,setNewOp]=useState(false);const [allClients,setAllClients]=useState([]);const [mobOpen,setMobOpen]=useState(false);
  const token=session.token;
  useEffect(()=>{(async()=>{const c=await dq("clients",{token,filters:"?select=id,first_name,last_name,client_code&order=first_name.asc"});setAllClients(Array.isArray(c)?c:[]);})();},[token]);
  const nav=[{key:"today",label:"HOY",p:["M12 2L3 7l9 5 9-5-9-5z","M3 17l9 5 9-5","M3 12l9 5 9-5"]},{key:"operations",label:"OPERACIONES",p:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"]},{key:"agents",label:"AGENTES",p:["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z","M22 11l-3-3","M22 8l-3 3"]},{key:"tasks",label:"TAREAS",p:["M9 11l3 3 8-8","M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"]},{key:"dashboard",label:"DASHBOARD",p:["M3 3v18h18","M18 17V9","M13 17V5","M8 17v-3"]},{key:"finance",label:"FINANZAS",p:["M12 1v22","M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"]},{key:"shipments",label:"SEGUIMIENTOS",p:["M16 3h5v5","M21 3l-7 7","M8 21H3v-5","M3 21l7-7","M21 16v5h-5","M21 21l-7-7","M3 8V3h5","M3 3l7 7"]},{key:"purchase_notifs",label:"AVISOS COMPRA",p:["M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1","M21 12H8m0 0 4-4m-4 4 4 4"]},{key:"comms",label:"COMUNICACIONES",p:["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"]},{key:"quotes",label:"COTIZACIONES",p:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8"]},{key:"clients",label:"CLIENTES",p:["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"]},{key:"tariffs",label:"TARIFAS",p:["M18 20V10","M12 20V4","M6 20v-6"]},{key:"settings",label:"CONFIGURACIÓN",p:["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z","M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"]}];
  const [pendingTasks,setPendingTasks]=useState(0);
  useEffect(()=>{let mounted=true;const load=async()=>{const r=await dq("admin_tasks",{token,filters:"?select=id&done=eq.false"});if(mounted&&Array.isArray(r))setPendingTasks(r.length);};load();const iv=setInterval(load,30000);return()=>{mounted=false;clearInterval(iv);};},[token,page]);
  const sidebarContent=<>
    <div style={{padding:"24px 20px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"center",alignItems:"center",position:"relative"}}>
      <img src={LOGO} alt="AC" style={{width:"100%",height:"auto",maxHeight:50,objectFit:"contain"}}/>
      <button className="ac-mob-close" onClick={()=>setMobOpen(false)} style={{display:"none",position:"absolute",right:16,top:16,background:"none",border:"none",color:"rgba(255,255,255,0.6)",fontSize:22,cursor:"pointer",padding:4}}>✕</button>
    </div>
    <div style={{padding:"16px 20px 6px"}}><span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.12em"}}>Administración</span></div>
    <nav style={{flex:1,padding:"4px 10px",overflowY:"auto"}}>{nav.map(item=>{const active=page===item.key;return <button key={item.key} onClick={()=>{setPage(item.key);setSelOp(null);setSelClient(null);setNewOp(false);setMobOpen(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"10px 14px",marginBottom:2,borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:active?700:600,letterSpacing:"0.06em",background:active?"linear-gradient(90deg, rgba(184,149,106,0.12), rgba(184,149,106,0.02))":"transparent",color:active?"#fff":"rgba(255,255,255,0.45)",transition:"all 150ms",position:"relative"}} onMouseEnter={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.color="rgba(255,255,255,0.75)";}}} onMouseLeave={e=>{if(!active){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.45)";}}}>{active&&<span style={{position:"absolute",left:0,top:8,bottom:8,width:3,background:GOLD_GRADIENT,borderRadius:"0 3px 3px 0"}}/>}<svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={active?GOLD_LIGHT:"rgba(255,255,255,0.4)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{item.p.map((d,i)=><path key={i} d={d}/>)}</svg><span style={{flex:1,textAlign:"left"}}>{item.label}</span>{item.key==="tasks"&&pendingTasks>0&&<span style={{background:GOLD_GRADIENT,color:"#0A1628",fontSize:9,fontWeight:800,padding:"2px 6px",borderRadius:8,minWidth:16,textAlign:"center",letterSpacing:0,border:`1px solid ${GOLD_DEEP}`}}>{pendingTasks}</span>}</button>;})}</nav>
    <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.06)"}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg, rgba(184,149,106,0.22), rgba(184,149,106,0.08))",border:"1px solid rgba(184,149,106,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:GOLD_LIGHT,letterSpacing:"0.03em"}}>AD</div><div style={{flex:1,minWidth:0}}><p style={{fontSize:12.5,fontWeight:600,color:"#fff",margin:0}}>Admin</p><p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",margin:"1px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{session.user.email}</p></div></div><button onClick={onLogout} style={{width:"100%",padding:"8px 10px",fontSize:11.5,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:600,letterSpacing:"0.04em",transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.35)";e.currentTarget.style.color=GOLD_LIGHT;}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(255,255,255,0.5)";}}>Cerrar sesión</button></div>
  </>;
  return <div style={{height:"100vh",display:"flex",fontFamily:"'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif",background:DARK_BG,overflow:"hidden",position:"relative"}}>
    <style dangerouslySetInnerHTML={{__html:`
      @media(max-width:900px){
        .ac-admin-sidebar-desktop{display:none!important}
        .ac-admin-mob-header{display:flex!important}
        .ac-mob-close{display:block!important}
        .ac-admin-main{padding-top:58px!important}
        .ac-admin-main-inner{padding:20px 18px!important;max-width:100vw!important;box-sizing:border-box!important}
        .ac-admin-top-notif{display:none!important}
        .ac-mob-overlay{display:block!important}
        .ac-mob-sidebar{display:flex!important}
        h2{font-size:22px!important}
        .stats-grid,.grid-4,.grid-3{grid-template-columns:1fr 1fr!important}
        table{font-size:11.5px!important}
        table td,table th{padding:10px 8px!important}
        .ac-admin-main{overflow-x:hidden!important}
        /* Tablas: convertir a bloque scrolleable horizontalmente */
        table{display:block!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;width:100%!important;white-space:nowrap!important}
        table thead,table tbody{display:table!important;width:100%!important;min-width:max-content!important}
      }
      @media(min-width:901px){
        .ac-admin-mob-header,.ac-mob-sidebar,.ac-mob-overlay{display:none!important}
      }
    `}}/>
    {/* Mobile header */}
    <div className="ac-admin-mob-header" style={{display:"none",position:"fixed",top:0,left:0,right:0,height:58,background:"rgba(10,22,40,0.95)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(255,255,255,0.06)",alignItems:"center",justifyContent:"space-between",padding:"0 16px",zIndex:50}}>
      <button onClick={()=>setMobOpen(true)} aria-label="Abrir menú" style={{background:"transparent",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.85)",cursor:"pointer",padding:"8px 10px",borderRadius:8,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <img src={LOGO} alt="AC" style={{height:30,objectFit:"contain"}}/>
      <NotifBell token={token}/>
    </div>
    {/* Mobile overlay */}
    {mobOpen&&<div className="ac-mob-overlay" onClick={()=>setMobOpen(false)} style={{display:"none",position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:60,animation:"ac_fade_in 180ms"}}/>}
    {/* Mobile sidebar */}
    {mobOpen&&<div className="ac-mob-sidebar" style={{display:"none",position:"fixed",top:0,left:0,bottom:0,width:280,background:"rgba(10,22,40,0.98)",backdropFilter:"blur(14px)",borderRight:"1px solid rgba(255,255,255,0.06)",flexDirection:"column",zIndex:70,overflow:"hidden",boxShadow:"4px 0 30px rgba(0,0,0,0.5)"}}>{sidebarContent}</div>}
    {/* Desktop sidebar */}
    <div className="ac-admin-sidebar-desktop" style={{width:220,flexShrink:0,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(12px)",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0}}>{sidebarContent}</div>
    <div className="ac-admin-main" style={{flex:1,overflow:"auto"}}>
      <CmdK token={token} allClients={allClients} onNavigate={(target)=>{if(target.type==="operation"){setPage("operations");setSelOp(target.op);setSelClient(null);setNewOp(false);}else if(target.type==="client"){setPage("clients");setSelClient(target.client);setSelOp(null);setNewOp(false);}else if(target.type==="flight"){setPage("agents");setSelOp(null);setSelClient(null);setNewOp(false);}}}/>
      <div className="ac-admin-top-notif" style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"12px 32px 0",gap:12}}>
        <button onClick={()=>{const e=new KeyboardEvent("keydown",{key:"k",metaKey:true});window.dispatchEvent(e);}} title="Buscar (⌘K)" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 12px",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.6)",cursor:"pointer"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Buscar<kbd style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",padding:"1px 5px",borderRadius:3,fontSize:10,fontFamily:"monospace"}}>⌘K</kbd></button>
        <NotifBell token={token}/></div>
      <div className="ac-admin-main-inner" style={{maxWidth:1400,margin:"0 auto",padding:"28px 32px"}}>
      {page==="today"&&<TodayDashboard token={token} onNav={setPage} onSelectOp={op=>{setPage("operations");setSelOp(op);}} onSelectFlight={f=>{setPage("agents");}}/>}
      {page==="operations"&&!selOp&&!newOp&&<OperationsList token={token} onSelect={setSelOp} onNew={()=>setNewOp(true)}/>}
      {page==="operations"&&selOp&&<OperationEditor op={selOp} token={token} onBack={()=>setSelOp(null)} onDelete={()=>setSelOp(null)}/>}
      {page==="operations"&&newOp&&<NewOperation token={token} clients={allClients} onBack={()=>setNewOp(false)} onCreated={op=>{setNewOp(false);setSelOp(op);}}/>}
      {page==="clients"&&!selClient&&<ClientsList token={token} onSelect={setSelClient}/>}
      {page==="clients"&&selClient&&<ClientDetail client={selClient} token={token} onBack={()=>setSelClient(null)} onSelectOp={op=>{setPage("operations");setSelClient(null);setSelOp(op);}} onDelete={()=>setSelClient(null)}/>}
      {page==="tasks"&&<AdminTasks token={token}/>}
      {page==="comms"&&<ComunicacionesPanel token={token}/>}
      {page==="dashboard"&&<><FinanceDashboard token={token}/><OperationalAnalytics token={token}/><DashboardKPIs token={token}/><RetentionLTVCard token={token}/></>}
      {page==="shipments"&&<ShipmentsTracking token={token} onSelectOp={op=>{setPage("operations");setSelOp(op);}}/>}
      {page==="agents"&&<AgentsPanel token={token}/>}
      {page==="purchase_notifs"&&<PurchaseNotificationsAdmin token={token} allClients={allClients} onCreateOp={op=>{setPage("operations");setSelOp(op);}}/>}
      {page==="finance"&&<FinancePanel token={token}/>}
      {page==="tariffs"&&<TariffsManager token={token}/>}
      {page==="calculator"&&<Calculator token={token} clients={allClients}/>}
      {page==="quotes"&&<QuotesList token={token}/>}
      {page==="settings"&&<AdminSettings token={token} session={session}/>}
    </div></div>
  </div>;
}

export default function AdminPage(){
  const [session,setSession]=useState(null);const [restoring,setRestoring]=useState(true);
  useEffect(()=>{const s=loadSession();if(s?.token&&s?.profile?.role==="admin"){setSession(s);}setRestoring(false);},[]);
  const logout=()=>{clearSession();setSession(null);};
  if(restoring)return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:DARK_BG}}><p style={{color:"rgba(255,255,255,0.4)"}}>Cargando...</p></div>;
  if(!session)return <><style dangerouslySetInnerHTML={{__html:AC_KEYFRAMES}}/><ToastStack/><AdminLogin onLogin={s=>{setSession(s);}}/></>;
  return <><style dangerouslySetInnerHTML={{__html:AC_KEYFRAMES}}/><ToastStack/><AdminDashboard session={session} onLogout={logout}/></>;
}
