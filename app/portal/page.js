"use client";
import { useState, useEffect } from "react";
import { ToastStack, toast, Skeleton, SkeletonTable, EmptyState, WhatsAppFab } from "../../lib/ui";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const LOGO=`${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
const B={primary:"#1B4F8A",accent:"#4A90D9"};
const DARK_BG="linear-gradient(160deg,#0F1E3D 0%,#152849 50%,#0F1E3D 100%)";
const GOLD="#B8956A", GOLD_LIGHT="#E8D098", GOLD_DEEP="#A68456";
const GOLD_GRADIENT="linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";
const GOLD_GLOW="0 0 20px rgba(184,149,106,0.25)";
const GOLD_GLOW_STRONG="0 0 28px rgba(184,149,106,0.4)";
const IC=GOLD_LIGHT; // IC (accent) alias al oro claro
// Tier system: Silver / Gold / Diamond
const TIERS={
  standard:{label:"Standard",min:0,next:100,color:"#94a3b8",light:"rgba(148,163,184,0.9)",gradient:"linear-gradient(135deg,#475569,#64748b,#475569)",glow:"0 0 18px rgba(100,116,139,0.2)",bonus:0,discount:0,icon:"○"},
  silver:{label:"Silver",min:100,next:500,color:"#C0C0C0",light:"#E8E8E8",gradient:"linear-gradient(135deg,#8A8A8A,#E8E8E8,#8A8A8A)",glow:"0 0 18px rgba(192,192,192,0.28)",bonus:2,discount:10,icon:"🥈"},
  gold:{label:"Gold",min:500,next:1000,color:GOLD,light:GOLD_LIGHT,gradient:GOLD_GRADIENT,glow:GOLD_GLOW,bonus:10,discount:25,icon:"🥇"},
  diamond:{label:"Diamond",min:1000,next:null,color:"#B9F2FF",light:"#E0F7FF",gradient:"linear-gradient(135deg,#6BC5E0,#B9F2FF,#6BC5E0)",glow:"0 0 22px rgba(185,242,255,0.35)",bonus:15,discount:50,icon:"💠"},
};
const getTierInfo=(t)=>TIERS[t||"standard"]||TIERS.standard;
const AC_KEYFRAMES=`@keyframes ac_pulse_gold{0%{box-shadow:0 0 0 0 rgba(184,149,106,.55)}70%{box-shadow:0 0 0 10px rgba(184,149,106,0)}100%{box-shadow:0 0 0 0 rgba(184,149,106,0)}}@keyframes ac_shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes ac_fade_in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`;
const sf=async(p,o={})=>{const r=await fetch(`${SB_URL}${p}`,{...o,headers:{apikey:SB_KEY,"Content-Type":"application/json",...(o.headers||{})}});return r.json();};
const ac=async(e,b)=>sf(`/auth/v1/${e}`,{method:"POST",body:JSON.stringify(b)});
const saveSession=(d)=>{try{localStorage.setItem("ac_s",JSON.stringify(d));}catch(e){}};
const loadSession=()=>{try{const d=localStorage.getItem("ac_s");return d?JSON.parse(d):null;}catch(e){return null;}};
const clearSession=()=>{try{localStorage.removeItem("ac_s");}catch(e){}};
// JWT exp (ms). 0 si falla.
const jwtExp=(t)=>{try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).exp*1000;}catch{return 0;}};
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
const ensureFreshToken=async(token)=>{
  const exp=jwtExp(token);
  if(exp&&Date.now()>exp-60000){
    const s=loadSession();
    if(s?.token&&jwtExp(s.token)>Date.now()+60000)return s.token;
    const nt=await refreshToken();if(nt)return nt;
  }
  return token;
};
const dq=async(t,{method="GET",body,token,filters=""})=>{
  const fresh=await ensureFreshToken(token);
  const doReq=async(tk)=>{
    const r=await fetch(`${SB_URL}/rest/v1/${t}${filters}`,{method,body:body?JSON.stringify(body):undefined,headers:{apikey:SB_KEY,"Content-Type":"application/json",Authorization:`Bearer ${tk}`,...(method==="POST"?{Prefer:"return=representation"}:{})}});
    const body2=await r.json().catch(()=>null);
    return {status:r.status,body:body2};
  };
  let r=await doReq(fresh);
  if(r.status===401){const nt=await refreshToken();if(nt){r=await doReq(nt);}}
  return r.body;
};
const PR=["Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"];
const TX=[{value:"responsable_inscripto",label:"Responsable Inscripto"},{value:"monotributista",label:"Monotributista"},{value:"ninguna",label:"Ninguna de las anteriores"}];
const INIT={first_name:"",last_name:"",whatsapp:"",email:"",password:"",confirm_password:"",street:"",floor_apt:"",postal_code:"",city:"",province:"",tax_condition:"ninguna",company_name:"",cuit:""};
const SP={proveedor:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z","M3.27 6.96 12 12.01l8.73-5.05","M12 22.08V12"],warehouse:["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z","M9 22V12h6v10"],documentacion:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"],en_transito_aereo:["M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 3.7 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.5-.6.4-1.1z"],en_transito_maritimo:["M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1","M4 18l-1-5h18l-1 5","M5 13V7h14v6","M9 7V4h6v3"],arribo:["M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z","M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],aduana:["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z","M9 12l2 2 4-4"],liberacion:["M9 11l3 3L22 4","M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],entrega:["M1 3h15v13H1z","M16 8h4l3 3v5h-7V8z","M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z","M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],cerrada:["M22 11.08V12a10 10 0 1 1-5.93-9.14","M22 4 12 14.01l-3-3"]};
const OS=[{k:"proveedor",l:"Proveedor"},{k:"warehouse",l:"Warehouse\nArgencargo"},{k:"documentacion",l:"Documentación"},{k:"en_transito",l:"En tránsito"},{k:"arribo",l:"Arribo\nArgentina"},{k:"aduana",l:"Gestión\naduanera"},{k:"entrega",l:"Lista para\nretirar"},{k:"cerrada",l:"Operación\ncerrada"}];
const S2S={pendiente:0,en_deposito_origen:1,en_preparacion:2,en_transito:3,arribo_argentina:4,en_aduana:5,entregada:6,operacion_cerrada:7,cancelada:-1};
const SM={pendiente:{l:"PROVEEDOR",c:"#94a3b8"},en_deposito_origen:{l:"WAREHOUSE ARGENCARGO",c:"#fbbf24"},en_preparacion:{l:"DOCUMENTACIÓN",c:"#a78bfa"},en_transito:{l:"EN TRÁNSITO",c:"#60a5fa"},arribo_argentina:{l:"ARRIBO ARGENTINA",c:"#818cf8"},en_aduana:{l:"GESTIÓN ADUANERA",c:"#fb923c"},entregada:{l:"LISTA PARA RETIRAR",c:"#22c55e"},operacion_cerrada:{l:"OPERACIÓN CERRADA",c:"#10b981"},cancelada:{l:"CANCELADA",c:"#f87171"}};
const CM={aereo_blanco:"Aéreo Courier Comercial",aereo_negro:"Aéreo Integral AC",maritimo_blanco:"Marítimo Carga LCL/FCL",maritimo_negro:"Marítimo Integral AC"};
const CN=[{key:"imports",label:"IMPORTACIONES",p:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z","M3.27 6.96 12 12.01l8.73-5.05","M12 22.08V12"]},{key:"calculator",label:"CALCULADORA",p:["M4 4h16v16H4z","M4 8h16","M8 4v16"]},{key:"quotes",label:"COTIZACIONES",p:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"]},{key:"payments",label:"PAGOS INTERNACIONALES",p:["M12 1v22","M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"]},{key:"account",label:"CUENTA CORRIENTE",p:["M3 3h18v18H3z","M3 9h18","M9 21V9"]},{key:"points",label:"PUNTOS",p:["M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"]},{key:"services",label:"SERVICIOS",p:["M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"]},{key:"profile",label:"MI PERFIL",p:["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"]}];
function WorldMap(){const d=[[120,80],[135,85],[150,78],[165,90],[180,85],[200,95],[215,88],[230,92],[250,100],[265,95],[280,105],[300,98],[320,110],[335,105],[350,115],[370,108],[390,120],[410,112],[430,125],[450,118],[470,130],[490,122],[510,135],[530,128],[550,140],[570,132],[590,145],[610,138],[630,150],[140,120],[160,130],[180,125],[200,140],[220,135],[240,145],[260,138],[280,150],[300,142],[320,155],[340,148],[360,158],[380,152],[400,162],[420,155],[440,165],[460,158],[480,170],[500,162],[520,175],[540,168],[560,180],[580,172],[600,185],[620,178]];const l=[[200,95,450,118],[300,98,520,135],[180,125,400,162],[280,150,500,208],[350,115,570,132]];return <svg width="100%" height="100%" viewBox="0 0 750 320" preserveAspectRatio="xMidYMid slice" style={{position:"absolute",inset:0,opacity:0.05,pointerEvents:"none"}}>{l.map((v,i)=><line key={i} x1={v[0]} y1={v[1]} x2={v[2]} y2={v[3]} stroke="#4A90D9" strokeWidth="0.5" opacity="0.4"/>)}{d.map((v,i)=><circle key={i} cx={v[0]} cy={v[1]} r={1.5} fill="#4A90D9" opacity="0.5"/>)}</svg>;}
function Inp({label,type="text",value,onChange,placeholder,req,error}){return <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{req&&<span style={{color:"#ff6b6b"}}> *</span>}</label><input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:`1px solid ${error?"#ff6b6b":"rgba(255,255,255,0.12)"}`,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none",transition:"all 180ms"}} onFocus={e=>{if(!error){e.target.style.borderColor=GOLD;e.target.style.boxShadow="0 0 0 3px rgba(184,149,106,0.18)";e.target.style.background="rgba(255,255,255,0.09)";}}} onBlur={e=>{e.target.style.borderColor=error?"#ff6b6b":"rgba(255,255,255,0.12)";e.target.style.boxShadow="none";e.target.style.background="rgba(255,255,255,0.06)";}}/>{error&&<p style={{fontSize:11,color:"#ff6b6b",margin:"4px 0 0"}}>{error}</p>}</div>;}
function Sel({label,value,onChange,options,req,ph}){return <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{req&&<span style={{color:"#ff6b6b"}}> *</span>}</label><select value={value} onChange={e=>onChange(e.target.value)} onFocus={e=>{e.target.style.borderColor=GOLD;e.target.style.boxShadow="0 0 0 3px rgba(184,149,106,0.18)";}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";e.target.style.boxShadow="none";}} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:value?"#fff":"rgba(255,255,255,0.45)",outline:"none",transition:"all 180ms",cursor:"pointer"}}>{ph&&<option value="" style={{background:"#0F1F3A"}}>{ph}</option>}{options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value} style={{background:"#0F1F3A",color:"#fff"}}>{typeof o==="string"?o:o.label}</option>)}</select></div>;}
function PBtn({children,onClick,disabled,variant="gold"}){
  const [h,setH]=useState(false);
  const isGold=variant==="gold"&&!disabled;
  return <button onClick={onClick} disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:700,border:isGold?`1px solid ${GOLD_DEEP}`:"none",borderRadius:10,cursor:disabled?"not-allowed":"pointer",background:disabled?"rgba(255,255,255,0.08)":(isGold?GOLD_GRADIENT:`linear-gradient(135deg,${B.accent},${B.primary})`),color:disabled?"rgba(255,255,255,0.45)":(isGold?"#0A1628":"#fff"),letterSpacing:"0.02em",transition:"all 180ms cubic-bezier(0.4,0,0.2,1)",boxShadow:disabled?"none":(isGold?(h?GOLD_GLOW_STRONG:GOLD_GLOW):"0 4px 14px rgba(184,149,106,0.25)"),transform:h&&!disabled?"translateY(-1px)":"none",backgroundSize:isGold?"200% 100%":undefined,backgroundPosition:isGold?(h?"100% 0":"0 0"):undefined}}>{children}</button>;
}
function SBtn({children,onClick}){return <button onClick={onClick} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:500,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.6)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,cursor:"pointer"}}>{children}</button>;}
function ErrBox({msg}){return msg?<div style={{padding:"10px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:10,fontSize:13,color:"#ff6b6b",marginBottom:14}}>{msg}</div>:null;}
function formatDate(d){if(!d)return"—";const s=String(d).slice(0,10);if(s.match(/^\d{4}-\d{2}-\d{2}$/)){const[y,m,day]=s.split("-");return new Date(y,m-1,day).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}
function AuthPage({children}){return <div style={{minHeight:"100vh",display:"flex",position:"relative",overflow:"hidden",fontFamily:"'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif"}}>
  <style dangerouslySetInnerHTML={{__html:AC_KEYFRAMES}}/>
  <div style={{position:"absolute",inset:0,background:DARK_BG}}/>
  <div style={{position:"absolute",inset:0}}><WorldMap/></div>
  {/* Glows decorativos */}
  <div style={{position:"absolute",top:"-15%",right:"-8%",width:500,height:500,background:"radial-gradient(circle, rgba(184,149,106,0.14) 0%, transparent 70%)",pointerEvents:"none",zIndex:1}}/>
  <div style={{position:"absolute",bottom:"-15%",left:"-8%",width:540,height:540,background:"radial-gradient(circle, rgba(184,149,106,0.10) 0%, transparent 70%)",pointerEvents:"none",zIndex:1}}/>
  <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1rem",position:"relative",zIndex:3}}>
    <div style={{maxWidth:420,width:"100%",animation:"ac_fade_in 400ms ease-out"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <img src={LOGO} alt="AC" style={{width:230,height:"auto",filter:"drop-shadow(0 4px 24px rgba(184,149,106,0.28))"}}/>
        <p style={{fontSize:11,color:GOLD_LIGHT,margin:"14px 0 0",letterSpacing:"0.25em",textTransform:"uppercase",fontWeight:600}}>Soluciones de comercio exterior</p>
      </div>
      <div style={{background:"rgba(10,22,40,0.72)",backdropFilter:"blur(28px)",borderRadius:16,padding:"2rem 1.75rem",border:"1px solid rgba(255,255,255,0.06)",boxShadow:"0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.028)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:GOLD_GRADIENT,opacity:0.85}}/>
        {children}
      </div>
      <p style={{textAlign:"center",fontSize:11,color:"rgba(232,208,152,0.35)",marginTop:18,letterSpacing:"0.15em"}}>ARGENCARGO © 2026</p>
    </div>
  </div>
</div>;}
function SI({k,a,cur,isA,sz=20,alert}){let key=k;if(k==="en_transito")key=isA?"en_transito_aereo":"en_transito_maritimo";const ps=SP[key]||[];const co=alert?"#fbbf24":cur?GOLD_LIGHT:a?"rgba(232,208,152,0.55)":"rgba(255,255,255,0.18)";return <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={co} strokeWidth={alert?2:1.6} strokeLinecap="round" strokeLinejoin="round">{ps.map((d,i)=><path key={i} d={d}/>)}</svg>;}
function NI({p,a,sz=17}){return <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={a?GOLD_LIGHT:"rgba(255,255,255,0.4)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p.map((d,i)=><path key={i} d={d}/>)}</svg>;}
function OpProgress({status,isAereo,onActionClick}){const si=S2S[status]??0;const isDoc=status==="en_preparacion";return <div className="op-progress" style={{display:"flex",alignItems:"center",padding:"18px 0 6px"}}>{OS.map((s,i)=>{const a=i<=si;const cur=i===si;const isAlert=cur&&s.k==="documentacion"&&isDoc;const handleClick=isAlert&&onActionClick?(e)=>{e.stopPropagation();onActionClick();}:null;return <div key={s.k} style={{display:"flex",alignItems:"center",flex:1}}><div onClick={handleClick} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7,width:"100%",cursor:handleClick?"pointer":"default"}}><div style={{width:38,height:38,borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",background:isAlert?"rgba(251,191,36,0.18)":cur?"rgba(184,149,106,0.15)":a?"rgba(184,149,106,0.06)":"rgba(255,255,255,0.02)",border:`1px solid ${isAlert?"rgba(251,191,36,0.6)":cur?"rgba(184,149,106,0.55)":a?"rgba(184,149,106,0.2)":"rgba(255,255,255,0.028)"}`,boxShadow:isAlert?"0 0 18px rgba(251,191,36,0.4)":cur?"0 0 16px rgba(184,149,106,0.25)":"none",animation:isAlert?"pulse 1.5s ease-in-out infinite":"none",transition:"all 200ms"}}><SI k={s.k} a={a} cur={cur} isA={isAereo} alert={isAlert}/></div><span style={{fontSize:9,color:isAlert?"#fbbf24":cur?GOLD_LIGHT:a?"rgba(255,255,255,0.55)":"rgba(255,255,255,0.22)",textAlign:"center",lineHeight:1.25,fontWeight:isAlert||cur?700:500,whiteSpace:"pre-line",minHeight:22,letterSpacing:"0.03em"}}>{isAlert?"COMPLETAR":s.l}</span></div>{i<OS.length-1&&<div style={{width:18,height:1,background:i<si?"rgba(184,149,106,0.5)":"rgba(255,255,255,0.06)",flexShrink:0,marginTop:-20}}/>}</div>})}</div>;}
function OperationsList({ops,onSelect,client,token,onReload,itemsByOp={},pmtsByOp={},cliPmtsByOp={}}){
  // Orden: más cerca de la entrega primero. ETA asc como desempate (antes = más urgente).
  const STATUS_WEIGHT={entregada:8,en_aduana:7,arribo_argentina:6,en_transito:5,en_preparacion:4,en_deposito_origen:3,pendiente:2,operacion_cerrada:0,cancelada:0};
  const sortByProximity=(a,b)=>{const wa=STATUS_WEIGHT[a.status]??-1,wb=STATUS_WEIGHT[b.status]??-1;if(wa!==wb)return wb-wa;const ea=a.eta?String(a.eta).slice(0,10):"9999-12-31";const eb=b.eta?String(b.eta).slice(0,10):"9999-12-31";if(ea!==eb)return ea.localeCompare(eb);return String(b.created_at||"").localeCompare(String(a.created_at||""));};
  const act=ops.filter(o=>o.status!=="operacion_cerrada"&&o.status!=="cancelada").sort(sortByProximity);
  const past=ops.filter(o=>o.status==="operacion_cerrada"||o.status==="cancelada").sort((a,b)=>String(b.closed_at||b.updated_at||b.created_at||"").localeCompare(String(a.closed_at||a.updated_at||a.created_at||"")));
  const name=client?`${client.first_name} ${client.last_name}`:"";
  const code=client?.client_code||"";
  const stats=[{l:"Total importaciones",v:ops.length,c:"#fff"},{l:"En curso",v:act.length,c:GOLD_LIGHT},{l:"Finalizadas",v:past.length,c:"#22c55e"},{l:"Reportes",v:null,btn:true}];
  const gd=(o)=>{const d=o.description||"";return d.length>60?"CONSOLIDADO":d.toUpperCase();};
  const renderOp=(op)=>{const st=SM[op.status]||{l:op.status,c:"#999"};const isA=op.channel?.includes("aereo");const isActive=!["operacion_cerrada","cancelada"].includes(op.status);return <div key={op.id} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"1.5rem 1.75rem",marginBottom:14,transition:"all 180ms"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.22)";e.currentTarget.style.background="rgba(255,255,255,0.035)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";e.currentTarget.style.background="rgba(255,255,255,0.025)";}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:10,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:12.5,fontWeight:700,color:"rgba(255,255,255,0.95)",fontFamily:"'JetBrains Mono','SF Mono',monospace",letterSpacing:"0.04em"}}>{op.operation_code}</span>
        <span style={{width:1,height:14,background:"rgba(255,255,255,0.12)"}}/>
        <span style={{fontSize:10,fontWeight:700,padding:"4px 10px 4px 8px",borderRadius:999,color:st.c,border:`1px solid ${st.c}40`,background:`${st.c}14`,display:"inline-flex",alignItems:"center",gap:6,letterSpacing:"0.05em",textTransform:"uppercase"}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:st.c,boxShadow:isActive?`0 0 8px ${st.c}`:"none"}}/>{st.l}</span>
      </div>
      {op.eta&&op.status!=="entregada"&&<span style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.55)",letterSpacing:"0.02em"}}>ETA · <span style={{color:"#fff",fontWeight:600}}>{formatDate(op.eta)}</span></span>}
    </div>
    <p style={{fontSize:16,fontWeight:600,color:"#fff",margin:"0 0 4px",letterSpacing:"-0.01em"}}>{gd(op)}</p>
    {op.tier_discount_applied_usd>0&&(()=>{const ti=getTierInfo(op.tier_discount_applied);return <div style={{marginTop:10,marginBottom:4,padding:"10px 14px",background:`linear-gradient(90deg, ${ti.color}22, transparent)`,border:`1px solid ${ti.color}55`,borderRadius:10,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><span style={{fontSize:16}}>{ti.icon}</span><div style={{flex:1,minWidth:200}}><p style={{fontSize:11,fontWeight:700,color:ti.light,margin:0,textTransform:"uppercase",letterSpacing:"0.1em"}}>Descuento {ti.label} aplicado</p><p style={{fontSize:12,color:"rgba(255,255,255,0.75)",margin:"2px 0 0"}}>Se te aplicó automáticamente tu beneficio de tier</p></div><span style={{fontSize:14,fontWeight:800,color:ti.light,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em"}}>−USD {Number(op.tier_discount_applied_usd).toFixed(2)}</span></div>;})()}
    <OpProgress status={op.status} isAereo={isA} onActionClick={()=>onSelect(op)}/>
    <div className="op-info" style={{display:"flex",gap:32,alignItems:"center",borderTop:"1px solid rgba(255,255,255,0.028)",paddingTop:14,marginTop:8,flexWrap:"wrap"}}>
      <div><span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Origen</span><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"3px 0 0"}}>{op.origin||"China"}</p></div>
      <div><span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Canal</span><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"3px 0 0"}}>{CM[op.channel]||"—"}</p></div>
      <div style={{flex:1}}><span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Total a abonar</span><p style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,margin:"3px 0 0",letterSpacing:"-0.01em"}}>{(()=>{const bt=Number(op.budget_total||0);if(bt<=0)return<span style={{color:"rgba(255,255,255,0.5)",fontWeight:500}}>Pendiente</span>;const pmtTot=Number(pmtsByOp[op.id]||0);const ant=Number(op.total_anticipos||0);const cliPaid=Number(cliPmtsByOp[op.id]||0);const saldo=Math.max(0,bt-cliPaid+Math.max(0,pmtTot-ant));return `USD ${saldo.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;})()}</p></div>
      <button onClick={()=>onSelect(op)} style={{fontSize:12,fontWeight:600,color:GOLD_LIGHT,background:"transparent",border:"1px solid rgba(184,149,106,0.25)",borderRadius:8,padding:"8px 16px",cursor:"pointer",letterSpacing:"0.02em",transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(184,149,106,0.1)";e.currentTarget.style.borderColor="rgba(184,149,106,0.45)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="rgba(184,149,106,0.25)";}}>Ver detalles →</button>
    </div>
    {op.channel==="aereo_blanco"&&op.status==="en_deposito_origen"&&!op.consolidation_confirmed&&<div style={{marginTop:14,background:"rgba(251,191,36,0.07)",border:"1px solid rgba(251,191,36,0.22)",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span style={{fontSize:12.5,fontWeight:500,color:"#fbbf24"}}>Tu paquete llegó a nuestro depósito. ¿Vas a enviar más paquetes o es el único?</span>
      <button onClick={async(e)=>{e.stopPropagation();const btn=e.currentTarget;btn.disabled=true;btn.textContent="Confirmando...";try{await dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{consolidation_confirmed:true,consolidation_confirmed_at:new Date().toISOString(),status:"en_preparacion"}});onReload&&await onReload();}catch(err){btn.disabled=false;btn.textContent="Es el único, pueden enviarlo";}}} style={{padding:"7px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:`1px solid ${GOLD_DEEP}`,cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.02em"}}>Es el único, pueden enviarlo</button>
    </div>}
    {(op.status==="en_preparacion"||(op.status==="en_deposito_origen"&&op.consolidation_confirmed))&&(itemsByOp[op.id]||0)===0&&<div style={{marginTop:14,background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.22)",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span style={{fontSize:12.5,fontWeight:500,color:GOLD_LIGHT}}>Completá la documentación de tu carga para avanzar</span>
      <button onClick={(e)=>{e.stopPropagation();onSelect(op);}} style={{padding:"7px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:`1px solid ${GOLD_DEEP}`,cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628"}}>+ Agregar productos</button>
    </div>}
  </div>;};
  return <div>
    {/* Hero card — Welcome + Tier + Progress + Quick stats */}
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 2px",letterSpacing:"-0.02em"}}>Hola, {client?.first_name||"cliente"}</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.45)",margin:"0 0 18px"}}>Tu panel de importaciones en tiempo real</p>
      {(()=>{
        const tier=client?.tier||"standard";
        const ti=getTierInfo(tier);
        const lifetime=Number(client?.lifetime_points_earned||0);
        const balance=Number(client?.points_balance||0);
        const pendingVouchers=Number(client?._pending_vouchers_count||0);
        const nextTier=ti.next?Object.values(TIERS).find(t=>t.min===ti.next):null;
        const ptsToNext=nextTier?Math.max(0,nextTier.min-lifetime):0;
        const progressPct=nextTier?Math.min(100,Math.max(0,((lifetime-ti.min)/(nextTier.min-ti.min))*100)):100;
        const nextOp=act.filter(o=>o.eta&&o.status!=="entregada").sort((a,b)=>String(a.eta||"").localeCompare(String(b.eta||"")))[0];
        const isStandard=tier==="standard";
        return <div className="ac-hero-grid" style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:12}}>
          {/* Tier card (principal) */}
          <div style={{background:isStandard?"rgba(255,255,255,0.025)":`linear-gradient(135deg, ${ti.color}22 0%, rgba(255,255,255,0.02) 100%)`,border:`1px solid ${isStandard?"rgba(255,255,255,0.06)":ti.color+"55"}`,borderRadius:16,padding:"18px 22px",position:"relative",overflow:"hidden",boxShadow:isStandard?"none":ti.glow}}>
            {!isStandard&&<div style={{position:"absolute",top:-30,right:-30,width:150,height:150,background:`radial-gradient(circle, ${ti.color}30 0%, transparent 70%)`,pointerEvents:"none"}}/>}
            <div style={{position:"relative"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                <p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase",letterSpacing:"0.14em"}}>Tu categoría</p>
                {/* Balance pts + vouchers como mini pills a la derecha */}
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  {pendingVouchers>0&&<span onClick={()=>typeof window!=="undefined"&&window.dispatchEvent(new CustomEvent("ac_nav",{detail:"points"}))} title={`${pendingVouchers} descuento${pendingVouchers>1?"s":""} por categoría pendiente${pendingVouchers>1?"s":""}`} style={{fontSize:9.5,fontWeight:700,padding:"3px 8px",borderRadius:999,background:"rgba(184,149,106,0.14)",color:GOLD_LIGHT,border:"1px solid rgba(184,149,106,0.35)",letterSpacing:"0.04em",cursor:"pointer",textTransform:"uppercase"}}>★ {pendingVouchers} dcto{pendingVouchers>1?"s":""}</span>}
                  {balance>0&&<span onClick={()=>typeof window!=="undefined"&&window.dispatchEvent(new CustomEvent("ac_nav",{detail:"points"}))} title="Balance de puntos — click para ver catálogo" style={{fontSize:9.5,fontWeight:700,padding:"3px 8px",borderRadius:999,background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.75)",border:"1px solid rgba(255,255,255,0.1)",letterSpacing:"0.04em",cursor:"pointer",fontVariantNumeric:"tabular-nums"}}>{balance.toLocaleString("es-AR")} pts</span>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8}}>
                <span style={{fontSize:26,lineHeight:1}}>{ti.icon}</span>
                <div>
                  <p style={{fontSize:22,fontWeight:800,color:"#fff",margin:0,lineHeight:1,letterSpacing:"-0.02em"}}>{ti.label}</p>
                  {!isStandard&&<p style={{fontSize:10,color:ti.light,margin:"3px 0 0",fontWeight:600,letterSpacing:"0.04em"}}>+{ti.bonus}% bonus puntos</p>}
                </div>
              </div>
              {nextTier&&<div style={{marginTop:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.55)"}}><strong style={{color:ti.light,fontVariantNumeric:"tabular-nums"}}>{ptsToNext}</strong> para {nextTier.label}</span>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontVariantNumeric:"tabular-nums"}}>{Math.round(progressPct)}%</span>
                </div>
                <div style={{height:5,background:"rgba(255,255,255,0.06)",borderRadius:999,overflow:"hidden"}}>
                  <div style={{width:`${progressPct}%`,height:"100%",background:ti.gradient,borderRadius:999,transition:"width 400ms"}}/>
                </div>
              </div>}
              {!nextTier&&<p style={{marginTop:12,fontSize:10,color:ti.light,fontWeight:600,letterSpacing:"0.04em"}}>★ Nivel máximo alcanzado</p>}
            </div>
          </div>
          {/* Próxima ETA */}
          <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"18px 22px"}}>
            <p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase",letterSpacing:"0.14em"}}>Próxima llegada</p>
            {nextOp?<><p style={{fontSize:22,fontWeight:800,color:"#fff",margin:"8px 0 3px",lineHeight:1,letterSpacing:"-0.02em"}}>{formatDate(nextOp.eta).split(" ").slice(0,2).join(" ")}</p><p style={{fontSize:11,color:GOLD_LIGHT,margin:0,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.04em"}}>{nextOp.operation_code}</p></>:<><p style={{fontSize:18,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"8px 0 3px",lineHeight:1}}>—</p><p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",margin:0}}>Sin ETA pendiente</p></>}
          </div>
        </div>;
      })()}
    </div>

    <h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Mis importaciones</h3>
    <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>{stats.map((s,i)=><div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"20px 22px",transition:"all 180ms",cursor:s.btn?"pointer":"default"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.25)";e.currentTarget.style.background="rgba(255,255,255,0.04)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";e.currentTarget.style.background="rgba(255,255,255,0.025)";}}><p style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.5)",margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.1em"}}>{s.l}</p>{s.btn?<p style={{fontSize:13,fontWeight:600,color:GOLD_LIGHT,margin:0,display:"inline-flex",alignItems:"center",gap:4}}>Ver reporte <span style={{fontSize:14}}>→</span></p>:<p style={{fontSize:32,fontWeight:700,color:s.c,margin:0,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{s.v}</p>}</div>)}</div>
    {act.length>0&&act.map(renderOp)}
    {past.length>0&&<><h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"24px 0 12px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Finalizadas ({past.length})</h3>{past.map(renderOp)}</>}
    {ops.length===0&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.4)",padding:"3rem 0"}}>No tenés operaciones todavía.</p>}
  </div>;
}
function OperationDetail({op,token,onBack}){
  const [items,setItems]=useState([]);const [events,setEvents]=useState([]);const [pkgs,setPkgs]=useState([]);const [pmts,setPmts]=useState([]);const [cliPmts,setCliPmts]=useState([]);const [loading,setLoading]=useState(true);const [expItem,setExpItem]=useState(null);const [openSections,setOpenSections]=useState({budget:true,products:true,packages:true,tracking:true,payments:true});const [showDocPanel,setShowDocPanel]=useState(false);const [docItems,setDocItems]=useState([]);const [savingDocs,setSavingDocs]=useState(false);
  const [localConfirmed,setLocalConfirmed]=useState(false);
  const canDocument=op.status==="en_preparacion"||op.status==="en_deposito_origen"||localConfirmed;
  const addDocItem=()=>setDocItems(p=>[...p,{description:"",quantity:"1",unit_price_usd:""}]);
  const rmDocItem=(i)=>setDocItems(p=>p.filter((_,j)=>j!==i));
  const chDocItem=(i,f,v)=>setDocItems(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));
  const saveDocs=async()=>{const valid=docItems.filter(d=>d.description?.trim()&&Number(d.quantity)>0&&Number(d.unit_price_usd)>0);if(valid.length===0){alert("Completá al menos un producto");return;}setSavingDocs(true);
    for(const d of valid){await dq("operation_items",{method:"POST",token,body:{operation_id:op.id,description:d.description,quantity:Number(d.quantity),unit_price_usd:Number(d.unit_price_usd)}});}
    setShowDocPanel(false);setDocItems([]);await loadAll();setSavingDocs(false);
  };
  const toggleSection=(s)=>setOpenSections(p=>({...p,[s]:!p[s]}));
  const downloadPdf=()=>{
    const w=window.open("","_blank");if(!w)return;
    const bt=Number(op.budget_total||0);const bTax=Number(op.budget_taxes||0);const bFlete=Number(op.budget_flete||0);const bSeg=Number(op.budget_seguro||0);const shipC=op.shipping_to_door?Number(op.shipping_cost||0):0;
    const isB=op.channel?.includes("negro");
    const chLbl=({aereo_blanco:"Aéreo Courier Comercial",aereo_negro:"Aéreo Integral AC",maritimo_blanco:"Marítimo Carga LCL/FCL",maritimo_negro:"Marítimo Integral AC"})[op.channel]||op.channel;
    const totFob=items.reduce((s,it)=>s+Number(it.unit_price_usd||0)*Number(it.quantity||1),0);
    const prodRows=items.map(it=>{const fob=Number(it.unit_price_usd||0)*Number(it.quantity||1);return `<tr><td>${it.description||""}</td><td class="c">${it.quantity||1}</td><td class="r">USD ${Number(it.unit_price_usd||0).toFixed(2)}</td><td class="r">USD ${fob.toFixed(2)}</td>${!isB?`<td class="c mono">${it.ncm_code||"—"}</td><td class="c">${it.import_duty_rate||0}%</td><td class="c">${it.statistics_rate||0}%</td><td class="c">${it.iva_rate||21}%</td>`:""}</tr>`;}).join("");
    const pkgRows=pkgs.map((p,i)=>{const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),wd=Number(p.width_cm||0),h=Number(p.height_cm||0);const cbm=l&&wd&&h?((l*wd*h)/1000000)*q:0;return `<tr><td class="c">${i+1}</td><td class="c">${q}</td><td class="c">${l?`${l}×${wd}×${h} cm`:"—"}</td><td class="r">${gw?`${gw.toFixed(2)} kg`:"—"}</td><td class="r">${cbm?cbm.toFixed(4)+" m³":"—"}</td></tr>`;}).join("");
    const pmtTotal=pmts.reduce((s,p)=>s+Number(p.client_amount_usd||0),0);
    const pmtAnt=Number(op.total_anticipos||0);
    const pmtPend=Math.max(0,pmtTotal-pmtAnt);
    const totalAbonar=bt+pmtPend;
    const cliPaid=cliPmts.reduce((s,p)=>s+Number(p.amount_usd||0),0);
    const saldoReal=Math.max(0,totalAbonar-cliPaid);
    const pagosRows=cliPmts.map(p=>`<tr><td>${new Date(p.payment_date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})}</td><td class="r">USD ${Number(p.amount_usd).toFixed(2)}${p.currency==="ARS"?`<br/><span class="sm">ARS ${Number(p.amount_ars).toLocaleString("es-AR")} @ ${p.exchange_rate}</span>`:""}</td><td>${p.payment_method||"—"}</td><td>${p.notes||"—"}</td></tr>`).join("");
    const statusLbl={pendiente:"Pendiente",en_deposito_origen:"En depósito origen",en_preparacion:"En preparación",en_transito:"En tránsito",arribo_argentina:"Arribó a Argentina",en_aduana:"En aduana",entregada:"Lista para retirar",operacion_cerrada:"Operación cerrada",cancelada:"Cancelada"}[op.status]||op.status;
    const LOGO_COLOR="https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png";
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Presupuesto ${op.operation_code}</title><style>
      *{box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;padding:32px;color:#111;max-width:900px;margin:0 auto}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1B4F8A;padding-bottom:16px;margin-bottom:20px}
      .header img{max-width:180px;height:auto}
      .header .meta{text-align:right;font-size:10px;color:#666;line-height:1.5}
      .header .meta b{color:#1B4F8A;font-size:13px;display:block;margin-bottom:2px;font-family:monospace}
      h1{font-size:22px;margin:0 0 4px;color:#1B4F8A}.sub{color:#666;font-size:12px;margin-bottom:24px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;padding:14px;background:#f5f7fa;border-radius:8px}
      .grid div{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em}.grid b{font-size:13px;color:#111;display:block;margin-top:2px;text-transform:none;letter-spacing:0}
      h3{margin:22px 0 6px;font-size:13px;color:#1B4F8A;text-transform:uppercase;letter-spacing:0.08em}
      table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px}
      th,td{padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left}
      th{background:#1B4F8A;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:0.05em}
      td.c{text-align:center}td.r{text-align:right}td.mono{font-family:monospace;font-size:10px}.sm{font-size:9px;color:#666}
      tr:nth-child(even) td{background:#fafbfc}
      .totals{margin-top:18px;padding:16px;background:linear-gradient(135deg,#152D54,#3B7DD8);color:#fff;border-radius:8px}
      .totals .row{display:flex;justify-content:space-between;padding:4px 0}
      .totals .row.big{border-top:1px solid rgba(255,255,255,0.25);margin-top:6px;padding-top:10px;font-size:15px;font-weight:700}
      .totals .lbl{opacity:0.8}
      .foot{margin-top:28px;padding:18px 20px;background:#152D54;color:#fff;border-radius:8px;display:flex;align-items:center;gap:18px}
      .foot img{max-width:80px;height:auto}
      .foot .info{font-size:11px;line-height:1.7;flex:1}
      .foot .info b{display:block;font-size:13px;letter-spacing:0.03em;margin-bottom:3px}
      .foot .lbl{color:#8ea3c4;margin-right:4px}
      .foot a{color:#8fb8ff;text-decoration:none}
      .disclaimer{margin-top:14px;font-size:9px;color:#999;line-height:1.5;text-align:center}
      .badge{display:inline-block;padding:3px 10px;border-radius:4px;background:#3B7DD8;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em}
    </style></head><body>
      <div class="header">
        <img src="${LOGO_COLOR}" alt="Argencargo"/>
        <div class="meta">
          <b>${op.operation_code}</b>
          <div>Emitido ${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}</div>
          <div>Presupuesto de importación</div>
        </div>
      </div>
      <div class="grid">
        <div>Mercadería<b>${op.description||"—"}</b></div>
        <div>Canal<b>${chLbl}</b></div>
        <div>Origen<b>${op.origin||"—"}</b></div>
        <div>Estado<b>${statusLbl}</b></div>
      </div>
      ${items.length>0?`<h3>Productos</h3><table><thead><tr><th>Descripción</th><th>Cant</th><th>Unit.</th><th>FOB</th>${!isB?"<th>NCM</th><th>Derechos</th><th>TE</th><th>IVA</th>":""}</tr></thead><tbody>${prodRows}</tbody></table><div style="text-align:right;font-size:11px;color:#666;margin-top:6px">Valor FOB total: <b style="color:#111;font-size:13px">USD ${totFob.toFixed(2)}</b></div>`:""}
      ${pkgs.length>0?`<h3>Bultos</h3><table><thead><tr><th class="c">#</th><th class="c">Cant</th><th class="c">Dimensiones</th><th class="r">Peso</th><th class="r">CBM</th></tr></thead><tbody>${pkgRows}</tbody></table>`:""}
      <h3>Costos</h3>
      <div class="totals">
        ${!isB&&bTax>0?`<div class="row"><span class="lbl">Total Impuestos</span><span>USD ${bTax.toFixed(2)}</span></div>`:""}
        ${bFlete>0?`<div class="row"><span class="lbl">${isB?"Servicio Integral ARGENCARGO":"Flete internacional"}</span><span>USD ${bFlete.toFixed(2)}</span></div>`:""}
        ${!isB&&bSeg>0?`<div class="row"><span class="lbl">Seguro de carga</span><span>USD ${bSeg.toFixed(2)}</span></div>`:""}
        ${shipC>0?`<div class="row"><span class="lbl">Envío a domicilio</span><span>USD ${shipC.toFixed(2)}</span></div>`:""}
        ${pmtTotal>0?`<div class="row"><span class="lbl">Gestión de pagos (saldo pendiente)</span><span>USD ${pmtPend.toFixed(2)}</span></div>`:""}
        <div class="row big"><span>TOTAL A ABONAR</span><span>USD ${totalAbonar.toFixed(2)}</span></div>
        ${cliPaid>0?`<div class="row" style="margin-top:8px"><span class="lbl">Ya pagado</span><span>USD ${cliPaid.toFixed(2)}</span></div><div class="row" style="font-weight:700"><span>Saldo</span><span>${saldoReal>0.01?`USD ${saldoReal.toFixed(2)}`:"PAGADO EN SU TOTALIDAD ✓"}</span></div>`:""}
      </div>
      ${cliPmts.length>0?`<h3>Pagos realizados</h3><table><thead><tr><th>Fecha</th><th class="r">Monto</th><th>Método</th><th>Detalle</th></tr></thead><tbody>${pagosRows}</tbody></table>`:""}
      <div class="foot">
        <img src="${LOGO_COLOR}" alt="Argencargo"/>
        <div class="info">
          <b>ARGENCARGO</b>
          <div><span class="lbl">T.</span>+54 9 11 2508-8580</div>
          <div><span class="lbl">E-mail:</span><a href="mailto:info@argencargo.com.ar">info@argencargo.com.ar</a></div>
          <div>Av Callao 1137 — Recoleta, CABA</div>
        </div>
      </div>
      <div class="disclaimer">Este presupuesto incluye flete internacional, seguro y gestión aduanera${shipC>0?", más envío a domicilio":""}. Los valores pueden variar según tipo de cambio, volumen final despachado y gastos documentales reales al momento del cierre de la operación.</div>
      <script>setTimeout(()=>window.print(),300)</script>
    </body></html>`);w.document.close();
  };
  const loadAll=async()=>{const [it,ev,pk,pm,cp]=await Promise.all([dq("operation_items",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`}),dq("tracking_events",{token,filters:`?operation_id=eq.${op.id}&select=*&order=occurred_at.desc`}),dq("operation_packages",{token,filters:`?operation_id=eq.${op.id}&select=*&order=package_number.asc`}),dq("payment_management",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`}),dq("operation_client_payments",{token,filters:`?operation_id=eq.${op.id}&select=*&order=payment_date.asc`})]);setItems(Array.isArray(it)?it:[]);setEvents(Array.isArray(ev)?ev:[]);setPkgs(Array.isArray(pk)?pk:[]);setPmts(Array.isArray(pm)?pm:[]);setCliPmts(Array.isArray(cp)?cp:[]);setLoading(false);};
  useEffect(()=>{loadAll();let last=Date.now();const onFocus=()=>{if(document.visibilityState==="visible"&&Date.now()-last>5000){last=Date.now();loadAll();}};document.addEventListener("visibilitychange",onFocus);window.addEventListener("focus",onFocus);return()=>{document.removeEventListener("visibilitychange",onFocus);window.removeEventListener("focus",onFocus);};},[op.id,token]);
  const st=SM[op.status]||{l:op.status,c:"#999"};const isA=op.channel?.includes("aereo");
  return <div>
    <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,0.55)",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontWeight:600,marginBottom:20,padding:"6px 12px",borderRadius:8,letterSpacing:"0.04em",transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.color=GOLD_LIGHT;e.currentTarget.style.borderColor="rgba(184,149,106,0.35)";}} onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,0.55)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}>← Volver</button>
    <div style={{background:"rgba(255,255,255,0.025)",borderRadius:16,border:"1px solid rgba(255,255,255,0.06)",padding:"1.75rem 2rem",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <span style={{fontSize:18,fontWeight:700,color:"#fff",fontFamily:"'JetBrains Mono','SF Mono',monospace",letterSpacing:"0.04em"}}>{op.operation_code}</span>
        <span style={{width:1,height:16,background:"rgba(255,255,255,0.12)"}}/>
        {(()=>{const isActive=!["operacion_cerrada","cancelada"].includes(op.status);return <span style={{fontSize:10,fontWeight:700,padding:"4px 10px 4px 8px",borderRadius:999,color:st.c,border:`1px solid ${st.c}40`,background:`${st.c}14`,display:"inline-flex",alignItems:"center",gap:6,letterSpacing:"0.05em",textTransform:"uppercase"}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:st.c,boxShadow:isActive?`0 0 8px ${st.c}`:"none"}}/>{st.l}</span>;})()}
        {op.eta&&op.status!=="entregada"&&<span style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.55)",letterSpacing:"0.02em",marginLeft:"auto"}}>ETA · <span style={{color:"#fff",fontWeight:600}}>{formatDate(op.eta)}</span></span>}
      </div>
      <h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 12px",textTransform:"uppercase"}}>{op.description}</h2>
      <OpProgress status={op.status} isAereo={isA}/>
      {(()=>{const totGW=pkgs.reduce((s,p)=>s+Number(p.gross_weight_kg||0),0);const totCBM=pkgs.reduce((s,p)=>{const l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);return s+(l&&w&&h?(l*w*h)/1000000:0);},0);let pf=0;pkgs.forEach(p=>{const gw=Number(p.gross_weight_kg||0);const l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);const vw=l&&w&&h?(l*w*h)/5000:0;pf+=Math.max(gw,vw);});
      return <div className="op-info" style={{display:"flex",gap:28,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:14,marginTop:4,flexWrap:"wrap"}}>
        {[{l:"Bultos",v:pkgs.length>0?pkgs.reduce((s,p)=>s+Number(p.quantity||1),0):op.total_quantity||"—"},{l:"Origen",v:op.origin||"China"},{l:"Canal",v:CM[op.channel]||"—"},
          ...(isA?[{l:"Peso Bruto",v:totGW?`${totGW.toFixed(1)} kg`:"—"},{l:"Peso Facturable",v:pf?`${pf.toFixed(1)} kg`:"—",a:true}]:[{l:"CBM",v:totCBM?`${totCBM.toFixed(4)} m³`:"—",a:true}]),
          {l:"Total a abonar",v:(()=>{const bt=Number(op.budget_total||0);if(bt<=0)return"Pendiente";const pmtTotal=pmts.reduce((s,p)=>s+Number(p.client_amount_usd||0),0);const pmtAnt=Number(op.total_anticipos||0);const cliPaid=cliPmts.reduce((s,p)=>s+Number(p.amount_usd||0),0);const saldo=Math.max(0,bt-cliPaid+Math.max(0,pmtTotal-pmtAnt));return `USD ${saldo.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;})(),a:true}
        ].map((x,i)=><div key={i}><span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{x.l}</span><p style={{fontSize:13,fontWeight:600,color:x.a?IC:"#fff",margin:"2px 0 0"}}>{x.v}</p></div>)}
      </div>;})()}
    </div>
    {!loading&&op.channel==="aereo_blanco"&&op.status==="en_deposito_origen"&&!op.consolidation_confirmed&&!localConfirmed&&<div style={{background:"linear-gradient(135deg,rgba(251,191,36,0.12),rgba(251,191,36,0.04))",border:"1.5px solid rgba(251,191,36,0.3)",borderRadius:14,padding:"1.25rem 1.5rem",marginBottom:16}}>
      <h3 style={{fontSize:15,fontWeight:700,color:"#fbbf24",margin:"0 0 6px"}}>📦 Tu paquete ya está en nuestro depósito</h3>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.6)",margin:"0 0 14px",lineHeight:1.5}}>¿Este es el único paquete que vas a enviar, o tenés más paquetes por llegar al depósito? Si es el único, confirmalo y empezamos a preparar tu envío.</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button onClick={()=>{setLocalConfirmed(true);setShowDocPanel(true);setDocItems([{description:"",quantity:"1",unit_price_usd:""}]);dq("operations",{method:"PATCH",token,filters:`?id=eq.${op.id}`,body:{consolidation_confirmed:true,consolidation_confirmed_at:new Date().toISOString(),status:"en_preparacion"}}).then(()=>loadAll());}} style={{flex:1,minWidth:200,padding:"12px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,boxShadow:GOLD_GLOW}}>✅ Es el único, pueden enviarlo</button>
        <button style={{flex:1,minWidth:200,padding:"12px 18px",fontSize:13,fontWeight:600,borderRadius:10,border:"1.5px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.6)",cursor:"default"}}>⏳ Tengo más paquetes por llegar</button>
      </div>
    </div>}
    {!loading&&items.length>0&&<div style={{background:"linear-gradient(135deg,rgba(184,149,106,0.12),rgba(184,149,106,0.04))",border:"1.5px solid rgba(184,149,106,0.3)",borderRadius:14,padding:"1.25rem 1.5rem",marginBottom:16}}>
      <h3 style={{fontSize:15,fontWeight:700,color:"#fff",margin:"0 0 10px"}}>📋 Productos declarados</h3>
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr",gap:8,padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>
          <span>Descripción</span><span style={{textAlign:"right"}}>Cant.</span><span style={{textAlign:"right"}}>Precio unit.</span><span style={{textAlign:"right"}}>Subtotal</span>
        </div>
        {items.map(it=><div key={it.id} style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr",gap:8,padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:13,color:"rgba(255,255,255,0.85)"}}>
          <span>{it.description}</span>
          <span style={{textAlign:"right"}}>{Number(it.quantity||0)}</span>
          <span style={{textAlign:"right"}}>USD {Number(it.unit_price_usd||0).toFixed(2)}</span>
          <span style={{textAlign:"right",fontWeight:700}}>USD {(Number(it.quantity||0)*Number(it.unit_price_usd||0)).toFixed(2)}</span>
        </div>)}
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 12px",borderTop:"1px solid rgba(184,149,106,0.3)"}}>
          <span style={{fontSize:12,fontWeight:700,color:"#fff"}}>TOTAL</span>
          <span style={{fontSize:14,fontWeight:700,color:IC}}>USD {items.reduce((s,it)=>s+Number(it.quantity||0)*Number(it.unit_price_usd||0),0).toFixed(2)}</span>
        </div>
      </div>
      <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"10px 0 0",fontStyle:"italic"}}>¿Necesitás modificar algo? Contactá a tu asesor de Argencargo.</p>
    </div>}
    {canDocument&&!loading&&items.length===0&&<div style={{background:"linear-gradient(135deg,rgba(184,149,106,0.12),rgba(184,149,106,0.04))",border:"1.5px solid rgba(184,149,106,0.3)",borderRadius:14,padding:"1.25rem 1.5rem",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:showDocPanel?16:0}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>📋 Completá la documentación de tu carga</h3>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.5)",margin:0}}>Necesitamos los datos de la mercadería para avanzar con el envío</p>
        </div>
        <button onClick={()=>{setShowDocPanel(!showDocPanel);if(!showDocPanel&&docItems.length===0)setDocItems([{description:"",quantity:"1",unit_price_usd:""}]);}} style={{padding:"10px 20px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,boxShadow:GOLD_GLOW}}>{showDocPanel?"Cerrar":"+ Agregar productos"}</button>
      </div>
      {showDocPanel&&<div style={{borderTop:"1px solid rgba(184,149,106,0.2)",paddingTop:14}}>
        <div style={{padding:"10px 14px",background:"rgba(251,191,36,0.1)",border:"1.5px solid rgba(251,191,36,0.3)",borderRadius:10,marginBottom:14}}>
          <p style={{fontSize:12,fontWeight:700,color:"#fbbf24",margin:"0 0 4px"}}>⚠️ Importante: describí cada producto con el mayor detalle posible</p>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:0,lineHeight:1.5}}>Necesitamos saber exactamente qué contiene tu paquete para la documentación aduanera. En vez de "electrónica", poné "smartwatch Xiaomi Band 8 Pro". Cuanto más específico, mejor.</p>
        </div>
        {docItems.map((it,i)=><div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:11,fontWeight:700,color:IC}}>Producto {i+1}</span>
            {docItems.length>1&&<button onClick={()=>rmDocItem(i)} style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.08)",color:"#ff6b6b",cursor:"pointer"}}>Eliminar</button>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8}}>
            <div><label style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:3}}>DESCRIPCIÓN</label><input type="text" value={it.description} onChange={e=>chDocItem(i,"description",e.target.value)} placeholder="Ej: Smartwatches" style={{width:"100%",padding:"8px 10px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/></div>
            <div><label style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:3}}>CANTIDAD</label><input type="text" inputMode="decimal" value={it.quantity} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))chDocItem(i,"quantity",v);}} placeholder="1" style={{width:"100%",padding:"8px 10px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/></div>
            <div><label style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.4)",display:"block",marginBottom:3}}>PRECIO UNIT. USD</label><input type="text" inputMode="decimal" value={it.unit_price_usd} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))chDocItem(i,"unit_price_usd",v);}} placeholder="0.00" style={{width:"100%",padding:"8px 10px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/></div>
          </div>
          {Number(it.quantity)>0&&Number(it.unit_price_usd)>0&&<p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"6px 0 0"}}>Subtotal: USD {(Number(it.quantity)*Number(it.unit_price_usd)).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>}
        </div>)}
        <button onClick={addDocItem} style={{width:"100%",padding:"10px",fontSize:12,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer",marginBottom:12}}>+ Agregar otro producto</button>
        <div style={{display:"flex",gap:8}}>
          <button onClick={saveDocs} disabled={savingDocs} style={{flex:1,padding:"12px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",cursor:savingDocs?"not-allowed":"pointer",background:savingDocs?"rgba(255,255,255,0.08)":`linear-gradient(135deg,${B.accent},${B.primary})`,color:"#fff"}}>{savingDocs?"Guardando...":"Guardar productos"}</button>
        </div>
      </div>}
    </div>}
    {!loading&&(()=>{const bt=Number(op.budget_total||0);const bTax=Number(op.budget_taxes||0);const bFlete=Number(op.budget_flete||0);const bSeg=Number(op.budget_seguro||0);const shipCost=op.shipping_to_door?Number(op.shipping_cost||0):0;const isB=op.channel?.includes("negro");const hasBudget=bt>0;
      // Gestión de pagos: total acordado vs lo ya cobrado
      const pmtTotal=pmts.reduce((s,p)=>s+Number(p.client_amount_usd||0),0);
      const pmtAnticipado=Number(op.total_anticipos||0);
      const pmtPendiente=Math.max(0,pmtTotal-pmtAnticipado);
      const totalAbonar=bt+pmtPendiente;
      const bRow=(l,v,bold,accent,color)=><div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",...(bold?{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:12}:{})}}><span style={{fontSize:13,color:bold?"#fff":"rgba(255,255,255,0.5)",fontWeight:bold?700:400}}>{l}</span><span style={{fontSize:13,fontWeight:bold?700:600,color:color||(accent?IC:bold?"#fff":"rgba(255,255,255,0.8)")}}>{v<0?"-":""}USD {Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>;
      return <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.25rem 1.5rem",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:openSections.budget?14:0,gap:10,flexWrap:"wrap"}}>
        <button onClick={()=>toggleSection("budget")} style={{flex:1,minWidth:200,display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>PRESUPUESTO</h3><span style={{color:"rgba(255,255,255,0.4)",fontSize:14}}>{openSections.budget?"▲":"▼"}</span></button>
        {hasBudget&&<button onClick={downloadPdf} style={{fontSize:11,fontWeight:700,padding:"6px 12px",borderRadius:8,border:"1.5px solid rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.08)",color:IC,cursor:"pointer",whiteSpace:"nowrap"}}>📄 Descargar PDF</button>}
      </div>
      {openSections.budget&&hasBudget?<div>
        {!isB&&bTax>0&&bRow("Total Impuestos",bTax)}
        {bFlete>0&&bRow(isB?"Servicio Integral ARGENCARGO":"Flete internacional",bFlete)}
        {!isB&&bSeg>0&&bRow("Seguro de carga",bSeg)}
        {shipCost>0&&bRow("Envío a Domicilio",shipCost)}
        {pmtTotal>0&&bRow(`Gestión de pagos${pmtAnticipado>0?` (cobrado USD ${pmtAnticipado.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} de USD ${pmtTotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})})`:""}`,pmtPendiente,false,false,pmtPendiente>0?"#fb923c":"#22c55e")}
        {(()=>{
          const totalCli=cliPmts.reduce((s,p)=>s+Number(p.amount_usd||0),0);
          const saldoReal=Math.max(0,totalAbonar-totalCli);
          const pct=totalAbonar>0?Math.min(100,(totalCli/totalAbonar)*100):0;
          if(cliPmts.length===0)return bRow(pmtAnticipado>0?"Saldo a abonar":"A abonar a Argencargo",totalAbonar,true,true);
          return <>
            {bRow("Total a abonar",totalAbonar,false,false,"rgba(255,255,255,0.6)")}
            {bRow("Pagado",totalCli,false,false,"#22c55e")}
            {bRow(saldoReal>0.01?"Saldo a abonar":"Pagado en su totalidad",saldoReal,true,true,saldoReal<=0.01?"#22c55e":undefined)}
            <div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:4,overflow:"hidden",margin:"10px 0 14px"}}>
              <div style={{width:`${pct}%`,height:"100%",background:pct>=100?"#22c55e":pct>=50?"#60a5fa":"#fb923c",transition:"width 0.3s"}}/>
            </div>
            <p style={{fontSize:11,fontWeight:700,color:"#22c55e",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.04em"}}>Detalle de pagos realizados</p>
            <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                    <th style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>Fecha</th>
                    <th style={{textAlign:"right",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>Monto</th>
                    <th style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>Método</th>
                    <th style={{textAlign:"left",padding:"8px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {cliPmts.map(p=><tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <td style={{padding:"8px 12px",color:"rgba(255,255,255,0.8)",whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums"}}>{new Date(p.payment_date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})}</td>
                    <td style={{padding:"8px 12px",textAlign:"right",color:"#22c55e",fontWeight:700,whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums"}}>USD {Number(p.amount_usd).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}{p.currency==="ARS"&&<span style={{display:"block",fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:400}}>ARS {Number(p.amount_ars).toLocaleString("es-AR")} @ {p.exchange_rate}</span>}</td>
                    <td style={{padding:"8px 12px",color:"rgba(255,255,255,0.6)",textTransform:"capitalize",whiteSpace:"nowrap"}}>{p.payment_method}</td>
                    <td style={{padding:"8px 12px",color:"rgba(255,255,255,0.5)",fontSize:11}}>{p.notes||"—"}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </>;
        })()}
      </div>:openSections.budget?<p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:0}}>Presupuesto pendiente de confirmación</p>:null}
    </div>;})()}
    {!loading&&items.length>0&&<div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.25rem 1.5rem",marginBottom:16}}>
      <button onClick={()=>toggleSection("products")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:openSections.products?14:0}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>PRODUCTOS ({items.length})</h3><span style={{color:"rgba(255,255,255,0.4)",fontSize:14}}>{openSections.products?"▲":"▼"}</span></button>
      {openSections.products&&items.map((it,i)=>{const fob=Number(it.unit_price_usd||0)*Number(it.quantity||1);const exp=expItem===it.id;return <div key={it.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.08)":"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0"}}><div style={{flex:1}}><p style={{fontSize:14,color:"#fff",margin:0,fontWeight:500}}>{it.description}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:"2px 0 0"}}>{it.quantity} unidades</p></div>
          <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{textAlign:"right"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>VALOR FOB</p><p style={{fontSize:15,fontWeight:700,color:"#fff",margin:0}}>USD {fob.toLocaleString("en-US")}</p></div>
            <button onClick={()=>setExpItem(exp?null:it.id)} style={{fontSize:11,fontWeight:600,color:IC,background:"rgba(184,149,106,0.08)",border:"1px solid rgba(184,149,106,0.22)",borderRadius:6,padding:"6px 12px",cursor:"pointer",whiteSpace:"nowrap"}}>{exp?"Ocultar ▲":"Desglose ▼"}</button></div></div>
        {exp&&(()=>{const isB=op.channel?.includes("negro");const isAer=op.channel?.includes("aereo");const isMar=op.channel?.includes("maritimo");const dr=(l,rate,amt)=><div style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{l}{rate!=null?` (${rate}%)`:""}</span><span style={{fontSize:12,fontWeight:600,color:amt!=null?"#fff":"rgba(255,255,255,0.5)"}}>{amt!=null?`USD ${amt.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"A confirmar"}</span></div>;const taxRows=[];if(!isB){const rr=(label,rate)=>{const amt=rate!=null?fob*(Number(rate)/100):null;taxRows.push({l:label,r:rate,a:amt});};rr("Derechos de Importación",it.import_duty_rate);rr("Tasa de Estadística",it.statistics_rate);rr("IVA",it.iva_rate);if(isAer&&op.channel==="aereo_blanco"){
  // Calcular gasto documental: desembolso por CIF total, distribuido proporcionalmente
  const totalFob=items.reduce((s,x)=>s+Number(x.unit_price_usd||0)*Number(x.quantity||1),0);
  const pct=totalFob>0?fob/totalFob:1;
  let pf=0;pkgs.forEach(p=>{const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);pf+=Math.max(gw*q,l&&w&&h?((l*w*h)/5000)*q:0);});
  const certFl=pf*3.5;const cif=(totalFob+certFl)*1.01;
  const desemb=((c)=>{const t=[[5,0],[9,36],[20,50],[50,58],[100,65],[400,72],[800,84],[1000,96],[Infinity,120]];for(const[max,amt]of t)if(c<max)return amt;return 120;})(cif);
  const propDesemb=desemb*pct;const ivaD=propDesemb*0.21;
  taxRows.push({l:"Gasto Documental Aduana",r:null,a:propDesemb+ivaD});
}if(isMar&&op.channel==="maritimo_blanco"){rr("IVA Adicional",it.iva_additional_rate);rr("I.I.G.G.",it.iigg_rate);rr("I.I.B.B.",it.iibb_rate);}}const totalItemTax=taxRows.reduce((s,r)=>s+(r.a||0),0);return <div style={{padding:"0 0 12px",marginLeft:16}}><div style={{background:"rgba(255,255,255,0.028)",borderRadius:8,padding:"12px 16px",border:"1px solid rgba(255,255,255,0.08)"}}>
          {taxRows.map((r,ri)=><div key={ri}>{dr(r.l,r.r,r.a)}</div>)}
          {!isB&&taxRows.length>0&&<div style={{borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,fontWeight:700,color:"#fff"}}>Total Impuestos</span><span style={{fontSize:12,fontWeight:700,color:IC}}>USD {totalItemTax.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>}
        </div></div>;})()}
      </div>;})}
    </div>}
    {!loading&&pkgs.length>0&&(()=>{const isAer=op.channel?.includes("aereo");const isMar=op.channel?.includes("maritimo");const pkData=pkgs.map(pk=>{const l=Number(pk.length_cm||0),w=Number(pk.width_cm||0),h=Number(pk.height_cm||0),gw=Number(pk.gross_weight_kg||0);const vw=l&&w&&h?(l*w*h)/5000:0;const cbm=l&&w&&h?(l*w*h)/1000000:0;return{...pk,l,w,h,gw,vw,cbm};});const totGW=pkData.reduce((s,p)=>s+p.gw,0);const totVW=pkData.reduce((s,p)=>s+p.vw,0);const totCBM=pkData.reduce((s,p)=>s+p.cbm,0);let pf=0;pkData.forEach(p=>{pf+=Math.max(p.gw,p.vw);});const dd=(label,val)=><div style={{textAlign:"center"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px",textTransform:"uppercase"}}>{label}</p><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}>{val}</p></div>;return <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.25rem 1.5rem",marginBottom:16}}>
      <button onClick={()=>toggleSection("packages")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:openSections.packages?14:0}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>BULTOS ({pkgs.length})</h3><span style={{color:"rgba(255,255,255,0.4)",fontSize:14}}>{openSections.packages?"▲":"▼"}</span></button>
      {openSections.packages&&pkData.map((pk,i)=><div key={pk.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.08)":"none",padding:"14px 0"}}>
        <p style={{fontSize:13,fontWeight:700,color:IC,margin:"0 0 10px"}}>Bulto {pk.package_number}</p>
        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
          {dd("Cantidad",pk.quantity||"—")}
          {dd("Largo",pk.l?`${pk.l} cm`:"—")}
          {dd("Alto",pk.h?`${pk.h} cm`:"—")}
          {dd("Ancho",pk.w?`${pk.w} cm`:"—")}
          {dd("Peso Bruto",pk.gw?`${pk.gw} kg`:"—")}
          {dd("Peso Vol.",pk.vw?`${pk.vw.toFixed(2)} kg`:"—")}
          {dd("CBM",pk.cbm?`${pk.cbm.toFixed(4)} m³`:"—")}
        </div>
        {pk.l&&pk.w&&pk.h&&pk.vw>pk.gw&&<p style={{fontSize:11,fontWeight:600,color:"#f59e0b",margin:"8px 0 0",lineHeight:1.4,background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:6,padding:"6px 10px"}}>⚠️ El peso volumétrico ({pk.vw.toFixed(1)} kg) supera al peso bruto ({pk.gw.toFixed(1)} kg). Se facturará por peso volumétrico.</p>}
      </div>)}
      {openSections.packages&&<div style={{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:14,display:"flex",gap:28,flexWrap:"wrap",alignItems:"center"}}>
        {isAer&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px",textTransform:"uppercase"}}>Peso Facturable</p><p style={{fontSize:16,fontWeight:700,color:IC,margin:0}}>{pf.toFixed(2)} kg</p></div>}
        {isMar&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px",textTransform:"uppercase"}}>CBM Total</p><p style={{fontSize:16,fontWeight:700,color:IC,margin:0}}>{totCBM.toFixed(4)} m³</p></div>}
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px",textTransform:"uppercase"}}>Peso Bruto Total</p><p style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.6)",margin:0}}>{totGW.toFixed(2)} kg</p></div>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px",textTransform:"uppercase"}}>Peso Vol. Total</p><p style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.6)",margin:0}}>{totVW.toFixed(2)} kg</p></div>
      </div>}
    </div>})()}
    {!loading&&events.length>0&&<div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.25rem 1.5rem"}}>
      <button onClick={()=>toggleSection("tracking")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:openSections.tracking?14:0}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>SEGUIMIENTO ({events.length})</h3><span style={{color:"rgba(255,255,255,0.4)",fontSize:14}}>{openSections.tracking?"▲":"▼"}</span></button>
      {openSections.tracking&&<div style={{position:"relative",paddingLeft:24}}><div style={{position:"absolute",left:7,top:8,bottom:8,width:2,background:"rgba(255,255,255,0.06)"}}/>
        {events.map((ev,i)=><div key={ev.id} style={{position:"relative",paddingBottom:i<events.length-1?20:0}}><div style={{position:"absolute",left:-19,top:6,width:12,height:12,borderRadius:"50%",background:i===0?IC:"rgba(255,255,255,0.1)",boxShadow:i===0?"0 0 0 4px rgba(184,149,106,0.2)":"none"}}/><div><div style={{display:"flex",justifyContent:"space-between"}}><p style={{fontSize:14,fontWeight:600,color:i===0?"#fff":"rgba(255,255,255,0.4)",margin:0}}>{ev.title}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.2)",margin:0,whiteSpace:"nowrap",marginLeft:12}}>{formatDate(ev.occurred_at)}</p></div>{ev.description&&<p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"3px 0 0"}}>{ev.description}</p>}{ev.location&&<p style={{fontSize:12,color:"rgba(255,255,255,0.2)",margin:"2px 0 0"}}>📍 {ev.location}</p>}</div></div>)}</div>}
    </div>}
    {!loading&&pmts.length>0&&<div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.25rem 1.5rem"}}>
      <button onClick={()=>toggleSection("payments")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:openSections.payments?14:0}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>GESTIÓN DE PAGOS ({pmts.length})</h3><span style={{color:"rgba(255,255,255,0.4)",fontSize:14}}>{openSections.payments?"▲":"▼"}</span></button>
      {openSections.payments&&pmts.map((pm,i)=>{const gs={pendiente:{l:"Pendiente",c:"#fbbf24"},enviado:{l:"Enviado",c:"#60a5fa"},confirmado:{l:"Confirmado",c:"#22c55e"}}[pm.giro_status]||{l:pm.giro_status,c:"#999"};return <div key={pm.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.08)":"none",padding:"14px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:600,color:"#fff"}}>{pm.description||`Pago ${i+1}`}</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:pm.client_paid?"#22c55e":"#fbbf24",background:pm.client_paid?"rgba(34,197,94,0.15)":"rgba(251,191,36,0.15)"}}>{pm.client_paid?"Pagado":"Pago pendiente"}</span>
            <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:gs.c,background:`${gs.c}15`,border:`1px solid ${gs.c}33`}}>Giro: {gs.l}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>MONTO</p><p style={{fontSize:14,fontWeight:600,color:IC,margin:0}}>USD {Number(pm.client_amount_usd).toLocaleString("en-US",{minimumFractionDigits:2})}</p></div>
          {pm.client_paid_date&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>FECHA PAGO</p><p style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.6)",margin:0}}>{formatDate(pm.client_paid_date)}</p></div>}
          {pm.giro_date&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>FECHA GIRO</p><p style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.6)",margin:0}}>{formatDate(pm.giro_date)}</p></div>}
        </div>
      </div>;})}
    </div>}
    {loading&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.4)",padding:"2rem 0"}}>Cargando...</p>}
  </div>;
}
function ProfilePage({client}){if(!client)return null;const f=[{l:"Nombre",v:`${client.first_name} ${client.last_name}`},{l:"Código",v:client.client_code,m:true},{l:"Email",v:client.email},{l:"WhatsApp",v:client.whatsapp},{l:"Dirección",v:`${client.street}${client.floor_apt?`, ${client.floor_apt}`:""}`},{l:"Localidad",v:`${client.city}, ${client.province}`},{l:"CP",v:client.postal_code},{l:"IVA",v:client.tax_condition==="responsable_inscripto"?"Resp. Inscripto":client.tax_condition==="monotributista"?"Monotributista":"Consumidor final"}];return <div><h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 24px",letterSpacing:"-0.02em"}}>Mi perfil</h2><div style={{background:"rgba(255,255,255,0.025)",borderRadius:16,border:"1px solid rgba(255,255,255,0.06)",padding:"1.75rem 2rem"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px 28px"}}>{f.map((x,i)=><div key={i}><p style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.45)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.08em"}}>{x.l}</p><p style={{fontSize:15,color:"#fff",margin:0,fontWeight:500,...(x.m?{fontFamily:"'JetBrains Mono','SF Mono',monospace",fontSize:18,color:GOLD_LIGHT,letterSpacing:"0.04em"}:{})}}>{x.v||<span style={{color:"rgba(255,255,255,0.3)"}}>—</span>}</p></div>)}</div></div><div style={{background:"rgba(184,149,106,0.06)",borderRadius:12,border:"1px solid rgba(184,149,106,0.18)",padding:"14px 20px",marginTop:16,display:"flex",alignItems:"center",gap:12}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD_LIGHT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg><p style={{fontSize:13,color:"rgba(255,255,255,0.65)",margin:0,lineHeight:1.5}}>Tu código es <strong style={{color:GOLD_LIGHT,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.04em"}}>{client.client_code}</strong>. Incluilo en todos los paquetes que envíes.</p></div></div>;}
const SERVICES_C=[{key:"aereo_a_china",label:"Aéreo Courier Comercial — China",info:"Demora 7-10 días hábiles",unit:"kg"},{key:"aereo_b_usa",label:"Aéreo Integral AC — USA",info:"Demora 48-72 hs hábiles",unit:"kg"},{key:"aereo_b_china",label:"Aéreo Integral AC — China",info:"Demora 10-15 días hábiles",unit:"kg"},{key:"maritimo_a_china",label:"Marítimo Carga LCL/FCL — China",unit:"cbm",info:""},{key:"maritimo_b",label:"Marítimo Integral AC",unit:"cbm",info:""}];
function RatesPage({token,client}){
  const [tariffs,setTariffs]=useState([]);const [overrides,setOverrides]=useState([]);const [lo,setLo]=useState(true);
  useEffect(()=>{(async()=>{const [t,ov]=await Promise.all([dq("tariffs",{token,filters:"?select=*&order=service_key.asc,sort_order.asc"}),client?dq("client_tariff_overrides",{token,filters:`?client_id=eq.${client.id}&select=*`}):Promise.resolve([])]);setTariffs(Array.isArray(t)?t:[]);setOverrides(Array.isArray(ov)?ov:[]);setLo(false);})();},[token,client?.id]);
  const getRate=(t)=>{const ov=overrides.find(o=>o.tariff_id===t.id);return ov?{rate:ov.custom_rate,promo:true,base:t.rate}:{rate:t.rate,promo:false,base:t.rate};};
  const hideRanges=svc=>svc==="maritimo_b";
  if(lo)return <p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"2rem 0"}}>Cargando...</p>;
  return <div><h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 24px",letterSpacing:"-0.02em"}}>Tarifas</h2>
    {SERVICES_C.map(svc=>{const rates=tariffs.filter(t=>t.service_key===svc.key&&t.type==="rate");const specials=tariffs.filter(t=>t.service_key===svc.key&&t.type==="special");if(!rates.length)return null;
    return <div key={svc.key} style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.25rem 1.5rem",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h3 style={{fontSize:15,fontWeight:700,color:"#fff",margin:0}}>{svc.label}</h3>{svc.info&&<span style={{fontSize:11,color:"rgba(255,255,255,0.45)",padding:"4px 10px",background:"rgba(255,255,255,0.028)",borderRadius:6}}>{svc.info}</span>}</div>
      {hideRanges(svc.key)?<div style={{textAlign:"center",padding:"16px 0"}}><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 8px"}}>Las tarifas de este servicio varían según el volumen.</p><p style={{fontSize:14,fontWeight:600,color:IC,margin:0}}>Consultanos para obtener una cotización personalizada</p></div>:
      <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
        {rates.map(t=>{const{rate,promo,base}=getRate(t);return <tr key={t.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}><td style={{padding:"10px 0",fontSize:13,color:"rgba(255,255,255,0.6)"}}>{t.label}</td><td style={{padding:"10px 0",textAlign:"right",fontSize:14,fontWeight:700,color:promo?IC:"#fff"}}>{promo&&<span style={{fontSize:12,color:"rgba(255,255,255,0.4)",textDecoration:"line-through",marginRight:8}}>${Number(base).toLocaleString("en-US")}</span>}${Number(rate).toLocaleString("en-US")} / {svc.unit}{promo&&<span style={{fontSize:10,marginLeft:8,padding:"2px 6px",borderRadius:4,background:"rgba(184,149,106,0.15)",color:IC}}>PROMO</span>}</td></tr>;})}
      </tbody></table>}
      {specials.length>0&&<div style={{borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:8,paddingTop:10}}>{specials.map(s=><div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{s.label}</span><span style={{fontSize:12,fontWeight:600,color:"#fff"}}>${Number(s.rate).toLocaleString("en-US")} / {svc.unit}{s.notes&&<span style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginLeft:8}}>{s.notes}</span>}</span></div>)}</div>}
    </div>;})}
  </div>;
}
function CalculatorPage({token,client}){
  const [step,setStep]=useState(0);const [origin,setOrigin]=useState("");
  // USA flow
  const [products,setProducts]=useState([{type:"general",description:"",unit_price:"",quantity:"1",ncm:null,ncmLoading:false,ncmError:false}]);
  const [pkgs,setPkgs]=useState([{qty:"1",length:"",width:"",height:"",weight:""}]);const [noDims,setNoDims]=useState(false);const clientAutoZone=(()=>{if(!client)return"oficina";const c=(client.city||"").toLowerCase();const p=(client.province||"").toLowerCase();if(c.includes("capital")||c.includes("caba")||p.includes("capital")||p==="caba")return"caba";if(p.includes("buenos aires")||c.includes("buenos aires"))return"gba";return"oficina";})();const [delivery,setDelivery]=useState(clientAutoZone);
  const [hasBattery,setHasBattery]=useState(false);const [hasBrand,setHasBrand]=useState(false);const [expandedCh,setExpandedCh]=useState(null);
  // Keep global ncm for backward compat in calculations (use first product's NCM)
  const ncm=products.find(p=>p.ncm?.ncm_code)?.ncm||null;const ncmManual=false;
  const [tariffs,setTariffs]=useState([]);const [overrides,setOverrides]=useState([]);const [config,setConfig]=useState({});const [results,setResults]=useState(null);
  useEffect(()=>{(async()=>{const [t,c,ov]=await Promise.all([dq("tariffs",{token,filters:"?select=*&order=sort_order.asc"}),dq("calc_config",{token,filters:"?select=*"}),client?.id?dq("client_tariff_overrides",{token,filters:`?client_id=eq.${client.id}&select=*`}):Promise.resolve([])]);setTariffs(Array.isArray(t)?t:[]);setOverrides(Array.isArray(ov)?ov:[]);const cfg={};(Array.isArray(c)?c:[]).forEach(r=>{cfg[r.key]=Number(r.value);});setConfig(cfg);})();},[token,client?.id]);

  const addProduct=()=>setProducts(p=>[...p,{type:"general",description:"",unit_price:"",quantity:"1",ncm:null,ncmLoading:false,ncmError:false}]);
  const rmProduct=i=>setProducts(p=>p.filter((_,j)=>j!==i));
  const chProd=(i,f,v)=>setProducts(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));
  const addPkg=()=>setPkgs(p=>[...p,{qty:"1",length:"",width:"",height:"",weight:""}]);
  const rmPkg=i=>setPkgs(p=>p.filter((_,j)=>j!==i));
  const chPkg=(i,f,v)=>setPkgs(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));

  const totalFob=products.reduce((s,p)=>s+(Number(p.unit_price||0)*Number(p.quantity||1)),0);
  const hasPhones=products.some(p=>p.type==="celulares");
  const prodSummary=products.map(p=>`${p.description||p.type} x${p.quantity}`).join(", ");
  const mercType=products.every(p=>p.type==="celulares")?"Celulares":"Carga General";

  const calcTotals=()=>{
    let totWeight=0,totVol=0,totCBM=0;
    pkgs.forEach(pk=>{const q=Number(pk.qty||1),l=Number(pk.length||0),w=Number(pk.width||0),h=Number(pk.height||0),gw=Number(pk.weight||0);totWeight+=gw*q;if(l&&w&&h){totVol+=((l*w*h)/5000)*q;totCBM+=((l*w*h)/1000000)*q;}});
    return{totWeight,totVol,totCBM,billable:Math.max(totWeight,totVol)};
  };

  const getEffRate=(t)=>{const ov=overrides.find(o=>o.tariff_id===t.id);return ov?Number(ov.custom_rate):Number(t.rate);};
  const getFleteRate=(svcKey,amount)=>{const rates=tariffs.filter(t=>t.service_key===svcKey&&t.type==="rate");for(const r of rates){const min=Number(r.min_qty||0),max=r.max_qty!=null?Number(r.max_qty):Infinity;if(amount>=min&&amount<max)return getEffRate(r);}return rates.length?getEffRate(rates[rates.length-1]):0;};
  const getSurcharge=(svcKey,totalVal,amount)=>{const surcharges=tariffs.filter(t=>t.service_key===svcKey&&t.type==="surcharge").sort((a,b)=>Number(b.min_qty)-Number(a.min_qty));if(amount<=0)return{pct:0,amt:0};const vpu=totalVal/amount;for(const s of surcharges){if(vpu>=Number(s.min_qty))return{pct:Number(s.rate),amt:totalVal*(Number(s.rate)/100)};}return{pct:0,amt:0};};

  const calculateUSA=()=>{
    const{totWeight,totVol,totCBM,billable}=calcTotals();const channels=[];
    // Aéreo Integral AC (USA) — usa peso BRUTO, no volumétrico
    if(totWeight>0){const bw=Math.max(totWeight,1);const fleteRate=hasPhones?65:getFleteRate("aereo_b_usa",bw);const flete=bw*fleteRate;const sur=getSurcharge("aereo_b_usa",totalFob,bw);
      channels.push({key:"aereo_b_usa",name:"Aéreo Integral AC",info:"48-72 hs hábiles",flete,surcharge:sur.amt,surchargePct:sur.pct,total:flete+sur.amt,unit:`${totWeight.toFixed(1)} kg`});}
    // Marítimo Integral AC — solo si NO es celulares
    if(!hasPhones&&!noDims&&totCBM>0){const fleteRate=getFleteRate("maritimo_b",totCBM);const flete=totCBM*fleteRate;const sur=getSurcharge("maritimo_b",totalFob,totCBM);
      channels.push({key:"maritimo_b",name:"Marítimo Integral AC",info:"",flete,surcharge:sur.amt,surchargePct:sur.pct,total:flete+sur.amt,unit:`${totCBM.toFixed(4)} CBM`});}
    else if(!hasPhones&&noDims){channels.push({key:"maritimo_b",name:"Marítimo Integral AC",info:"",noCalc:true,total:0,unit:"—"});}
    setResults({channels,totWeight,totVol,totCBM,billable});setStep(4);
  };

  const classifyProduct=async(idx)=>{const p=products[idx];if(!p.description?.trim())return;
    setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:true,ncmError:false}:x));
    try{const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:p.description})});const d=await r.json();
      if(d.fallback||d.error){setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:false,ncmError:true,ncm:null}:x));}
      else{setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:false,ncmError:false,ncm:d}:x));}
    }catch{setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:false,ncmError:true,ncm:null}:x));}};

  const calculateChina=()=>{
    const{totWeight,totCBM}=calcTotals();const channels=[];
    // Peso facturable = suma del max(bruto, vol) POR BULTO, no global
    let facturable=0;let volWeightTotal=0;
    const pkgDetails=pkgs.map(pk=>{const q=Number(pk.qty||1),l=Number(pk.length||0),w=Number(pk.width||0),h=Number(pk.height||0),gw=Number(pk.weight||0);
      const bruto=gw*q;const vol=l&&w&&h?((l*w*h)/5000)*q:0;const fact=Math.max(bruto,vol);volWeightTotal+=vol;
      return{bruto,vol,fact,isVolumetric:vol>bruto};});
    facturable=pkgDetails.reduce((s,p)=>s+p.fact,0);
    const getDesembolso=(cif)=>{const t=[[5,0],[9,36],[20,50],[50,58],[100,65],[400,72],[800,84],[1000,96],[Infinity,120]];for(const[max,amt]of t)if(cif<max)return amt;return 120;};
    const isRI=client?.tax_condition==="responsable_inscripto";
    const certAerReal=config.cert_flete_aereo_real||2.5;const certAerFict=config.cert_flete_aereo_ficticio||3.5;
    const certMarFict=config.cert_flete_maritimo_ficticio||100;

    // Per-item tax calculation helper
    const calcItemTaxes=(p,certFleteTotal,isMaritimo,totalCif)=>{
      const itemFob=Number(p.unit_price||0)*Number(p.quantity||1);const pct=totalFob>0?itemFob/totalFob:1;
      const itemCertFl=certFleteTotal*pct;const itemSeg=(itemFob+itemCertFl)*0.01;const itemCif=itemFob+itemCertFl+itemSeg;
      const dr=Number(p.ncm?.import_duty_rate||0)/100;const te=Number(p.ncm?.statistics_rate||0)/100;const ivaR=Number(p.ncm?.iva_rate||21)/100;
      const derechos=itemCif*dr;const tasa_e=itemCif*te;const baseImp=itemCif+derechos+tasa_e;const iva=baseImp*ivaR;
      let totalImp=derechos+tasa_e+iva;let extras={};
      if(isMaritimo){const ivaAdic=baseImp*0.20;const iigg=baseImp*0.06;const iibb=baseImp*0.05;totalImp+=ivaAdic+iigg+iibb;extras={ivaAdic,iigg,iibb};}
      else{const fullTasa=getDesembolso(totalCif);const propTasa=fullTasa*pct;const ivaD=propTasa*0.21;totalImp+=propTasa+ivaD;extras={desembolso:propTasa,ivaDesemb:ivaD};}
      return{desc:p.description||"Producto",fob:itemFob,cif:itemCif,seguro:itemSeg,derechos,tasa_e,iva,totalImp,drPct:p.ncm?.import_duty_rate||0,tePct:p.ncm?.statistics_rate||0,ivaPct:p.ncm?.iva_rate||21,...extras};
    };

    // Aéreo Courier Comercial (A) — peso facturable (max bruto/vol). Omitido si hay marca.
    if(!hasBrand&&facturable>0){const fleteRate=getFleteRate("aereo_a_china",facturable);const flete=facturable*fleteRate;
      const certFlete=isRI?(totWeight*certAerReal):(facturable*certAerFict);
      const seguro=(totalFob+certFlete)*0.01;const totalCif=totalFob+certFlete+seguro;const battExtra=hasBattery?facturable*2:0;
      const items=products.filter(p=>Number(p.unit_price)>0).map(p=>calcItemTaxes(p,certFlete,false,totalCif));
      const totalImp=items.reduce((s,it)=>s+it.totalImp,0);const totalSvc=flete+seguro+battExtra;
      channels.push({key:"aereo_a_china",name:"Aéreo Courier Comercial",info:"7-10 días hábiles",isBlanco:true,
        flete,seguro,battExtra,totalImp,totalSvc,total:totalImp+totalSvc,items,
        pesoBruto:totWeight,pesoVol:volWeightTotal,pesoFact:facturable,pkgDetails,unit:`${facturable.toFixed(1)} kg`});}

    // Aéreo Integral AC (B) — peso bruto
    if(totWeight>0){const bw=Math.max(totWeight,1);const fleteRate=getFleteRate("aereo_b_china",bw);const flete=bw*fleteRate;const sur=getSurcharge("aereo_b_china",totalFob,bw);
      channels.push({key:"aereo_b_china",name:"Aéreo Integral AC",info:"10-15 días hábiles",isBlanco:false,
        flete,surcharge:sur.amt,surchargePct:sur.pct,total:flete+sur.amt,pesoBruto:totWeight,unit:`${totWeight.toFixed(1)} kg`});}

    // Marítimo Carga LCL/FCL (A) — SIEMPRE ficticio. Omitido si hay marca.
    if(!hasBrand&&!noDims&&totCBM>0){const cbmFact=Math.max(totCBM,1);const fleteRate=getFleteRate("maritimo_a_china",cbmFact);const flete=cbmFact*fleteRate;
      const certFlete=totCBM*certMarFict;
      const seguro=(totalFob+certFlete)*0.01;
      const totalCifMar=totalFob+certFlete+seguro;
      const items=products.filter(p=>Number(p.unit_price)>0).map(p=>calcItemTaxes(p,certFlete,true,totalCifMar));
      const totalImp=items.reduce((s,it)=>s+it.totalImp,0);const totalSvc=flete+seguro;
      channels.push({key:"maritimo_a_china",name:"Marítimo Carga LCL/FCL",info:"",isBlanco:true,isMar:true,
        flete,seguro,totalImp,totalSvc,total:totalImp+totalSvc,items,cbm:totCBM,unit:`${totCBM.toFixed(4)} CBM`});}

    // Marítimo Integral AC (B)
    if(!noDims&&totCBM>0){const fleteRate=getFleteRate("maritimo_b",totCBM);const flete=totCBM*fleteRate;const sur=getSurcharge("maritimo_b",totalFob,totCBM);
      channels.push({key:"maritimo_b",name:"Marítimo Integral AC",info:"",isBlanco:false,
        flete,surcharge:sur.amt,surchargePct:sur.pct,total:flete+sur.amt,cbm:totCBM,unit:`${totCBM.toFixed(4)} CBM`});}
    setResults({channels,totWeight,totCBM});setStep(4);
  };

  const getShipCost=(zone,weight)=>{if(zone==="oficina")return 0;const ranges=[[25,config.envio_caba_0_25||20],[50,config.envio_caba_25_50||30],[100,config.envio_caba_50_100||50],[Infinity,config.envio_caba_100||75]];let cost=0;for(const[max,amt]of ranges){if(weight<max){cost=amt;break;}}if(zone==="gba")cost+=(config.envio_gba_extra||10);return cost;};
  const clientZone=(()=>{if(!client)return null;const c=(client.city||"").toLowerCase();const p=(client.province||"").toLowerCase();if(c.includes("capital")||c.includes("caba")||p.includes("capital")||p==="caba")return"caba";if(p.includes("buenos aires")||c.includes("buenos aires"))return"gba";return null;})();
  const autoDelivLabel=(()=>{if(delivery==="oficina")return"Retiro por Oficina (Gratis)";const{totWeight}=calcTotals();const cost=getShipCost(delivery,totWeight);return delivery==="caba"?`Envío CABA (USD ${cost})`:`Envío GBA (USD ${cost})`;})();
  const DELIV={oficina:"Retiro por Oficina (Gratis)",caba:"Envío CABA",gba:"Envío GBA"};
  const [savedMsg,setSavedMsg]=useState("");
  const saveQuote=async(ch,showMsg)=>{const{totWeight,totCBM}=calcTotals();try{await dq("quotes",{method:"POST",token,body:{client_id:client?.id||null,client_name:client?`${client.first_name} ${client.last_name}`:"Anónimo",client_code:client?.client_code||"—",origin,channel_key:ch.key,channel_name:ch.name,products:products,packages:pkgs,delivery,total_fob:totalFob,total_weight:totWeight,total_cbm:totCBM,total_cost:ch.total+(getShipCost(delivery,calcTotals().totWeight))}});if(showMsg){setSavedMsg(ch.key);setTimeout(()=>setSavedMsg(""),2500);}}catch(e){console.error("Error saving quote:",e);}};
  const makeWAMsg=(ch)=>{const{totWeight,totCBM}=calcTotals();const name=client?`${client.first_name} ${client.last_name}`:"Cliente";const code=client?.client_code||"—";const flag=origin==="USA"?"\ud83c\uddfa\ud83c\uddf8":"\ud83c\udde8\ud83c\uddf3";const isAereo=ch.key?.includes("aereo");const delivCost=getShipCost(delivery,calcTotals().totWeight);const total=ch.total+delivCost;
    const usdF=v=>`USD ${v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    if(ch.isBlanco){return encodeURIComponent(`Hola Bautista! Acabo de cotizar una importación y quiero avanzar con la operación!\n\nOrigen: *${origin}* ${flag}\nMercadería: *${prodSummary}*\nValor Total: *${usdF(totalFob)}*\n${isAereo?`Peso Total: *${totWeight.toFixed(2)} kg*`:`CBM Total: *${totCBM.toFixed(4)} m³*`}\n\nImpuestos estimados: *${usdF(ch.totalImp||0)}*\nFlete Internacional: *${usdF(ch.flete||0)}*\nSeguro: *${usdF(ch.seguro||0)}*\nEntrega en Destino: *${autoDelivLabel}*\nTotal estimado: *${usdF(total)}*\n\nCódigo cliente: *${code}*`);}
    return encodeURIComponent(`Hola Bautista! Acabo de cotizar una importación y quiero avanzar con la operación!\n\nOrigen: *${origin}* ${flag}\nMercadería: *${prodSummary}*\n\nTipo de envío: *${ch.name}*\n\nValor Total: *${usdF(totalFob)}*\n${isAereo?`Peso Total: *${totWeight.toFixed(2)} kg*`:`CBM Total: *${totCBM.toFixed(4)} m³*`}\nEntrega en Destino: *${autoDelivLabel}*\nCosto de importación: *${usdF(total)}*\n\nCódigo cliente: *${code}*`);};

  const usd=v=>`USD ${v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const row=(l,v,bold,accent)=><div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",...(bold?{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:8}:{})}}><span style={{fontSize:12,color:bold?"#fff":"rgba(255,255,255,0.45)",fontWeight:bold?700:400}}>{l}</span><span style={{fontSize:12,fontWeight:bold?700:600,color:accent?IC:bold?"#fff":"rgba(255,255,255,0.7)"}}>{usd(v)}</span></div>;

  const steps=origin==="USA"?[{n:1,l:"Productos"},{n:2,l:"Packing List"},{n:3,l:"Entrega"},{n:4,l:"Resultados"}]:[{n:1,l:"Productos"},{n:2,l:"Packing List"},{n:3,l:"Entrega"},{n:4,l:"Resultados"}];

  return <div><h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 6px",letterSpacing:"-0.02em"}}>Calculadora de importación</h2><p style={{fontSize:13,color:"rgba(255,255,255,0.45)",margin:"0 0 28px"}}>Calculá el costo total de tu importación paso a paso</p>
    {step>0&&<div className="calc-steps" style={{display:"flex",gap:10,marginBottom:24,alignItems:"center",flexWrap:"wrap"}}>
      <div className="calc-origin-flag" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"7px 14px",background:"rgba(184,149,106,0.1)",border:"1px solid rgba(184,149,106,0.3)",borderRadius:999,marginRight:4,flexShrink:0}}><span style={{fontSize:14}}>{origin==="China"?"\ud83c\udde8\ud83c\uddf3":"\ud83c\uddfa\ud83c\uddf8"}</span><span style={{fontSize:11,fontWeight:700,color:GOLD_LIGHT,letterSpacing:"0.08em",textTransform:"uppercase"}}>{origin}</span></div>
      {steps.map(s=>{const done=step>s.n,cur=step===s.n,reachable=step>=s.n;return <div key={s.n} style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}><div className="step-circle" style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,minWidth:24,background:cur?GOLD_GRADIENT:done?"rgba(184,149,106,0.2)":"rgba(255,255,255,0.028)",color:cur?"#0A1628":done?GOLD_LIGHT:"rgba(255,255,255,0.3)",border:`1px solid ${reachable?"rgba(184,149,106,0.4)":"rgba(255,255,255,0.08)"}`,boxShadow:cur?GOLD_GLOW:"none",transition:"all 180ms"}}>{done?"✓":s.n}</div><span className="step-label" style={{fontSize:12,fontWeight:cur?700:500,color:cur?"#fff":reachable?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.4)",whiteSpace:"nowrap",letterSpacing:"0.02em"}}>{s.l}</span>{s.n<steps.length&&<span style={{width:20,height:1,background:done?"rgba(184,149,106,0.35)":"rgba(255,255,255,0.08)",margin:"0 2px"}}/>}</div>;})}
    </div>}

    {step===0&&<><p style={{fontSize:11,color:"rgba(255,255,255,0.5)",textAlign:"center",marginBottom:16,letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:600}}>Seleccioná tu origen</p><div className="origin-picker" style={{display:"flex",gap:24,justifyContent:"center",padding:"1rem 0 2rem"}}>{[{k:"China",flag:"\ud83c\udde8\ud83c\uddf3"},{k:"USA",flag:"\ud83c\uddfa\ud83c\uddf8"}].map(c=><div key={c.k} onClick={()=>{setOrigin(c.k);setStep(1);}} style={{width:240,padding:"2.5rem 1.5rem",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:18,cursor:"pointer",textAlign:"center",transition:"all 200ms",position:"relative",overflow:"hidden"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.4)";e.currentTarget.style.background="rgba(184,149,106,0.06)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=GOLD_GLOW;}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";e.currentTarget.style.background="rgba(255,255,255,0.025)";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}><p style={{fontSize:56,margin:"0 0 14px",lineHeight:1}}>{c.flag}</p><p style={{fontSize:28,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>{c.k}</p></div>)}</div></>}

    {/* USA FLOW - Step 1: Products */}
    {step===1&&origin==="USA"&&<div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 16px"}}>PRODUCTOS</h3>
      {products.map((p,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Producto {i+1}</span>{products.length>1&&<button onClick={()=>rmProduct(i)} style={{fontSize:11,padding:"4px 10px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>Eliminar</button>}</div>
        <div style={{display:"flex",gap:12,marginBottom:12}}>{[{k:"general",l:"Carga General"},{k:"celulares",l:"Celulares"}].map(t=><div key={t.k} onClick={()=>chProd(i,"type",t.k)} style={{flex:1,padding:"14px",textAlign:"center",borderRadius:10,border:`1.5px solid ${p.type===t.k?IC:"rgba(255,255,255,0.08)"}`,background:p.type===t.k?"rgba(184,149,106,0.1)":"rgba(255,255,255,0.028)",cursor:"pointer"}}><p style={{fontSize:14,fontWeight:600,color:p.type===t.k?IC:"rgba(255,255,255,0.5)",margin:0}}>{t.l}</p></div>)}</div>
        {p.type==="general"&&<Inp label="Descripción de la mercadería" value={p.description} onChange={v=>chProd(i,"description",v)} placeholder="Ej: Fundas de silicona para celular"/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Precio unitario (USD)" type="number" value={p.unit_price} onChange={v=>chProd(i,"unit_price",v)} placeholder="Ej: 3.50"/><Inp label="Cantidad" type="number" value={p.quantity} onChange={v=>chProd(i,"quantity",v)} placeholder="1"/></div>
      </div>)}
      <button onClick={addProduct} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar otro producto</button>
      {totalFob>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:12,marginTop:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Valor total mercadería</span><span style={{fontSize:16,fontWeight:700,color:IC}}>{usd(totalFob)}</span></div>}
      <div style={{display:"flex",gap:12,marginTop:16}}><button onClick={()=>{setStep(0);setOrigin("");}} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Cambiar origen</button><button onClick={()=>setStep(2)} disabled={!products.some(p=>Number(p.unit_price)>0)} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,boxShadow:GOLD_GLOW,opacity:products.some(p=>Number(p.unit_price)>0)?1:0.4}}>Siguiente →</button></div>
    </div>}

    {/* USA FLOW - Step 2: Packing List */}
    {step===2&&origin==="USA"&&<div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 16px"}}>PACKING LIST</h3>
      {pkgs.map((pk,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Bulto {i+1}</span>{pkgs.length>1&&<button onClick={()=>rmPkg(i)} style={{fontSize:11,padding:"4px 10px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>Eliminar</button>}</div>
        <div className="grid-5" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:"0 10px"}}>
          <Inp label="Cant. bultos" type="number" value={pk.qty} onChange={v=>chPkg(i,"qty",v)} placeholder="1"/>
          {!noDims&&<><Inp label="Largo (cm)" type="number" value={pk.length} onChange={v=>chPkg(i,"length",v)} placeholder="60"/><Inp label="Ancho (cm)" type="number" value={pk.width} onChange={v=>chPkg(i,"width",v)} placeholder="40"/><Inp label="Alto (cm)" type="number" value={pk.height} onChange={v=>chPkg(i,"height",v)} placeholder="35"/></>}
          <Inp label="Peso (kg)" type="number" value={pk.weight} onChange={v=>chPkg(i,"weight",v)} placeholder="12"/>
        </div>
      </div>)}
      <button onClick={addPkg} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar otro bulto</button>
      <div style={{marginTop:16,marginBottom:8}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={noDims} onChange={e=>setNoDims(e.target.checked)}/><span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Desconozco las medidas de las cajas</span></label>{noDims&&<div style={{background:"rgba(251,146,60,0.1)",border:"1px solid rgba(251,146,60,0.25)",borderRadius:8,padding:"10px 14px",marginTop:8}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>Sin las medidas de las cajas no es posible calcular el costo marítimo. Solo se cotizará el envío aéreo.</p></div>}</div>
      {(()=>{const{totWeight,totCBM}=calcTotals();return totWeight>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:12,marginTop:12,display:"flex",gap:20,flexWrap:"wrap"}}><div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:14,fontWeight:700,color:IC,margin:0}}>{totWeight.toFixed(2)} kg</p></div>{!noDims&&totCBM>0&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>CBM</p><p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>{totCBM.toFixed(4)} m³</p></div>}</div>;})()}
      <div style={{display:"flex",gap:12,marginTop:16}}><button onClick={()=>setStep(1)} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Atrás</button><button onClick={()=>setStep(3)} disabled={!pkgs.some(p=>Number(p.weight)>0)} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,boxShadow:GOLD_GLOW,opacity:pkgs.some(p=>Number(p.weight)>0)?1:0.4}}>Siguiente →</button></div>
    </div>}

    {/* USA FLOW - Step 3: Delivery */}
    {step===3&&origin==="USA"&&(()=>{const{totWeight}=calcTotals();const shipOpts=[{k:"oficina",l:"Retiro por Oficina",sub:"Gratis"},{k:"caba",l:"Envío CABA",sub:`USD ${getShipCost("caba",totWeight)}`},{k:"gba",l:"Envío GBA",sub:`USD ${getShipCost("gba",totWeight)}`}];return <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 16px"}}>ENTREGA EN DESTINO</h3>
      {clientZone&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.12)",borderRadius:10,padding:"10px 14px",marginBottom:14}}><p style={{fontSize:12,color:IC,margin:0,fontWeight:500}}>Tu dirección registrada es de <strong>{clientZone==="caba"?"CABA":"GBA"}</strong> — seleccionamos envío automáticamente</p></div>}
      <div className="delivery-opts" style={{display:"flex",gap:12,marginBottom:20}}>{shipOpts.map(d=><div key={d.k} onClick={()=>setDelivery(d.k)} style={{flex:1,padding:"16px",textAlign:"center",borderRadius:12,border:`1.5px solid ${delivery===d.k?IC:"rgba(255,255,255,0.08)"}`,background:delivery===d.k?"rgba(184,149,106,0.1)":"rgba(255,255,255,0.028)",cursor:"pointer"}}><p style={{fontSize:15,fontWeight:700,color:delivery===d.k?IC:"rgba(255,255,255,0.6)",margin:"0 0 4px"}}>{d.l}</p><p style={{fontSize:13,fontWeight:600,color:delivery===d.k?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.45)",margin:0}}>{d.sub}</p></div>)}</div>
      {delivery==="oficina"&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.12)",borderRadius:10,padding:"14px 18px",marginBottom:16}}><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>Nuestras Oficinas</p><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"0 0 4px"}}>Av. Callao 1137, CABA — Lunes a Viernes de 9:00 a 19:00 hs</p><p style={{fontSize:14,color:"#22c55e",margin:0,fontWeight:600}}>Se puede abonar al momento de retirar</p></div>}
      {(delivery==="caba"||delivery==="gba")&&<div style={{background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:10,padding:"14px 18px",marginBottom:16}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>Para envíos a domicilio, la carga debe abonarse previamente antes de ser despachada. Sin excepción.</p></div>}
      <div style={{display:"flex",gap:12,marginTop:8}}><button onClick={()=>setStep(2)} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Atrás</button><button onClick={calculateUSA} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,boxShadow:GOLD_GLOW}}>Calcular costos →</button></div>
    </div>;})()}

    {/* USA FLOW - Step 4: Results */}
    {step===4&&origin==="USA"&&results&&<div>
      <div style={{display:"flex",gap:12,marginBottom:16}}><button onClick={()=>setStep(3)} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button><span style={{color:"rgba(255,255,255,0.1)"}}>|</span><button onClick={()=>{setStep(0);setResults(null);setOrigin("");setProducts([{type:"general",description:"",unit_price:"",quantity:"1"}]);setPkgs([{qty:"1",length:"",width:"",height:"",weight:""}]);setNoDims(false);setDelivery("oficina");}} style={{fontSize:13,color:"rgba(255,255,255,0.4)",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>Nueva cotización</button></div>
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:14,marginBottom:20,display:"flex",gap:24,flexWrap:"wrap"}}>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>VALOR MERCADERÍA</p><p style={{fontSize:15,fontWeight:700,color:"#fff",margin:0}}>{usd(totalFob)}</p></div>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{results.totWeight.toFixed(2)} kg</p></div>
        {results.totCBM>0&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>CBM</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{results.totCBM.toFixed(4)} m³</p></div>}
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>ENTREGA</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{DELIV[delivery]}</p></div>
      </div>
      <div className="grid-2" style={{display:"grid",gridTemplateColumns:results.channels.length>1?"1fr 1fr":"1fr",gap:20}}>{results.channels.map(ch=>{const isAereo=ch.key?.includes("aereo");const delivCost=getShipCost(delivery,calcTotals().totWeight);const total=ch.noCalc?0:ch.total+delivCost;
      return <div key={ch.key} style={{background:"rgba(255,255,255,0.028)",borderRadius:16,border:`1.5px solid ${ch.key==="aereo_b_usa"?"rgba(251,146,60,0.4)":"rgba(255,255,255,0.1)"}`,padding:"1.5rem",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>{isAereo?"✈️":"🚢"}</span><p className="result-card-title" style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>{ch.name}</p></div>
          {ch.key==="aereo_b_usa"&&<span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:8,background:"rgba(251,146,60,0.15)",color:"#fb923c",border:"1px solid rgba(251,146,60,0.3)"}}>⚡ 48-72 hs</span>}
        </div>
        {ch.noCalc?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem 0"}}><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",textAlign:"center"}}>No se puede calcular sin las medidas de las cajas</p></div>:<>
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"20px",marginBottom:16,textAlign:"center"}}>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",textTransform:"uppercase"}}>Costo de importación</p>
          <p style={{fontSize:32,fontWeight:700,color:"#fff",margin:0}}>{usd(total)}</p>
        </div>
        <button onClick={()=>setExpandedCh(expandedCh===ch.key?null:ch.key)} style={{width:"100%",padding:"12px",fontSize:13,fontWeight:600,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.028)",cursor:"pointer",color:"rgba(255,255,255,0.5)",marginBottom:12}}>Ver desglose detallado ▼</button>
        </>}
        {!ch.noCalc&&<button onClick={()=>saveQuote(ch,true)} style={{width:"100%",padding:"12px",fontSize:13,fontWeight:600,borderRadius:10,border:"1.5px solid rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.08)",color:IC,cursor:"pointer",marginBottom:10}}>{savedMsg===ch.key?"✓ Guardada":"💾 Guardar cotización"}</button>}
        <a href={`https://wa.me/5491125088580?text=${makeWAMsg(ch)}`} onClick={()=>saveQuote(ch)} target="_blank" rel="noopener noreferrer" style={{display:"block",width:"100%",padding:"14px",fontSize:14,fontWeight:700,borderRadius:12,border:"none",cursor:ch.noCalc?"not-allowed":"pointer",background:ch.noCalc?"rgba(255,255,255,0.04)":`linear-gradient(135deg,#25D366,#128C7E)`,color:ch.noCalc?"rgba(255,255,255,0.2)":"#fff",textAlign:"center",textDecoration:"none",boxSizing:"border-box",pointerEvents:ch.noCalc?"none":"auto"}}>Avanzar con esta importación →</a>
      </div>})}</div>
      {/* USA Modal desglose */}
      {expandedCh&&results.channels.find(c=>c.key===expandedCh)&&(()=>{const mc=results.channels.find(c=>c.key===expandedCh);const delivCost=getShipCost(delivery,calcTotals().totWeight);const total=mc.total+delivCost;
      return <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setExpandedCh(null)}>
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}}/>
        <div style={{position:"relative",maxWidth:500,width:"90%",background:"#142038",borderRadius:20,border:"1px solid rgba(255,255,255,0.06)",padding:"2rem",boxShadow:"0 30px 60px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <h3 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>{mc.name}</h3>
            <button onClick={()=>setExpandedCh(null)} style={{fontSize:20,background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer"}}>✕</button>
          </div>
          {row("Servicio Integral ARGENCARGO",mc.flete)}
          {mc.surcharge>0&&row(`Recargo valor (${mc.surchargePct}%)`,mc.surcharge)}
          {delivCost>0&&row(delivery==="gba"?"Envío GBA":"Envío CABA",delivCost)}
          {row("TOTAL",total,true,true)}
        </div>
      </div>;})()}
    </div>}

    {/* CHINA FLOW - Step 1: Products + NCM per product */}
    {step===1&&origin==="China"&&<div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.5rem"}}>
      <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 12px"}}>¿Los productos tienen marca?</h3>
      <div style={{display:"flex",gap:12,marginBottom:12}}>{[{k:true,icon:"®",l:"Sí, con marca",sub:"Productos branded / licencia"},{k:false,icon:"✓",l:"Sin marca",sub:"Productos genéricos"}].map(o=><div key={String(o.k)} onClick={()=>setHasBrand(o.k)} style={{flex:1,padding:"20px",textAlign:"center",borderRadius:12,border:`1.5px solid ${hasBrand===o.k?IC:"rgba(255,255,255,0.08)"}`,background:hasBrand===o.k?"rgba(184,149,106,0.1)":"rgba(255,255,255,0.028)",cursor:"pointer"}}><p style={{fontSize:24,margin:"0 0 8px"}}>{o.icon}</p><p style={{fontSize:14,fontWeight:700,color:hasBrand===o.k?IC:"rgba(255,255,255,0.6)",margin:"0 0 4px"}}>{o.l}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.45)",margin:0}}>{o.sub}</p></div>)}</div>
      {hasBrand&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.15)",borderRadius:10,padding:"12px 16px",marginBottom:20}}><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>Las importaciones con marca se despachan solo por canal <strong style={{color:IC}}>Integral AC</strong> (courier). No es necesario clasificar NCM.</p></div>}

      <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 12px"}}>¿Tu producto contiene batería interna?</h3>
      <div style={{display:"flex",gap:12,marginBottom:12}}>{[{k:true,icon:"⚡",l:"Sí, tiene batería",sub:"Recargable / Litio"},{k:false,icon:"✓",l:"No tiene batería",sub:"Producto estándar"}].map(o=><div key={String(o.k)} onClick={()=>setHasBattery(o.k)} style={{flex:1,padding:"20px",textAlign:"center",borderRadius:12,border:`1.5px solid ${hasBattery===o.k?IC:"rgba(255,255,255,0.08)"}`,background:hasBattery===o.k?"rgba(184,149,106,0.1)":"rgba(255,255,255,0.028)",cursor:"pointer"}}><p style={{fontSize:24,margin:"0 0 8px"}}>{o.icon}</p><p style={{fontSize:14,fontWeight:700,color:hasBattery===o.k?IC:"rgba(255,255,255,0.6)",margin:"0 0 4px"}}>{o.l}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.45)",margin:0}}>{o.sub}</p></div>)}</div>
      {hasBattery&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.15)",borderRadius:10,padding:"12px 16px",marginBottom:20}}><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>Productos con batería interna (ej: auriculares bluetooth, power banks, smartwatch) son mercadería peligrosa y deben despacharse desde <strong style={{color:IC}}>Hong Kong</strong>. Recargo de <strong style={{color:IC}}>$2/kg</strong>.</p></div>}

      <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"20px 0 16px"}}>PRODUCTOS</h3>
      {products.map((p,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Producto {i+1}</span>{products.length>1&&<button onClick={()=>rmProduct(i)} style={{fontSize:11,padding:"4px 10px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>Eliminar</button>}</div>
        <div style={{marginBottom:14}}><label style={{display:"block",fontSize:13,fontWeight:700,color:"#fff",marginBottom:5}}>Descripción de la mercadería</label><div style={{display:"flex",gap:8}}><input value={p.description||""} onChange={e=>chProd(i,"description",e.target.value)} placeholder="Sé específico. Ej: Auriculares inalámbricos bluetooth" style={{flex:1,padding:"11px 14px",fontSize:14,border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.1)",color:"#fff",outline:"none"}} onFocus={e=>{e.target.style.borderColor=IC;}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";}}/>{!hasBrand&&<button onClick={()=>classifyProduct(i)} disabled={p.ncmLoading||!p.description?.trim()} style={{padding:"11px 16px",fontSize:12,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,boxShadow:GOLD_GLOW,whiteSpace:"nowrap",opacity:p.ncmLoading?0.6:1}}>{p.ncmLoading?"Clasificando...":"Clasificar"}</button>}</div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><div style={{marginBottom:14}}><label style={{display:"block",fontSize:13,fontWeight:700,color:"#fff",marginBottom:5}}>Precio unitario (USD)</label><input type="number" value={p.unit_price||""} onChange={e=>chProd(i,"unit_price",e.target.value)} placeholder="Ej: 3.50" style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.1)",color:"#fff",outline:"none"}} onFocus={e=>{e.target.style.borderColor=IC;}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";}}/></div><div style={{marginBottom:14}}><label style={{display:"block",fontSize:13,fontWeight:700,color:"#fff",marginBottom:5}}>Cantidad</label><input type="number" value={p.quantity||""} onChange={e=>chProd(i,"quantity",e.target.value)} placeholder="1" style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.1)",color:"#fff",outline:"none"}} onFocus={e=>{e.target.style.borderColor=IC;}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";}}/></div></div>
        {!hasBrand&&p.ncm?.ncm_code&&<div style={{background:"rgba(184,149,106,0.06)",borderRadius:10,padding:"12px 16px",marginBottom:8,border:"1px solid rgba(184,149,106,0.12)",display:"flex",alignItems:"center",gap:12}}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><div><p style={{fontSize:11,fontFamily:"monospace",color:IC,margin:"0 0 4px",fontWeight:600}}>NCM: {p.ncm.ncm_code}</p><p style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Categoría: {p.ncm.ncm_description?.toUpperCase()||"MERCADERÍA GENERAL"}</p><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>DERECHOS <strong style={{color:"#fff"}}>{p.ncm.import_duty_rate}%</strong></span><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}> T. ESTADÍSTICA <strong style={{color:"#fff"}}>{p.ncm.statistics_rate}%</strong></span><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}> IVA <strong style={{color:"#fff"}}>{p.ncm.iva_rate}%</strong></span></div></div></div>}
        {!hasBrand&&p.ncmError&&<div style={{background:"rgba(255,80,80,0.08)",borderRadius:10,padding:"12px 16px",marginBottom:8,border:"1px solid rgba(255,80,80,0.15)"}}><p style={{fontSize:13,color:"#ff6b6b",margin:"0 0 6px",fontWeight:600}}>No pudimos detectar tu mercadería automáticamente</p>
          <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
            <button onClick={()=>chProd(i,"ncm",{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:35,statistics_rate:3,iva_rate:21})} style={{fontSize:12,padding:"6px 14px",borderRadius:8,border:`1px solid ${IC}33`,background:"rgba(184,149,106,0.08)",color:IC,cursor:"pointer",fontWeight:600}}>Usar valores estimados (35% derechos)</button>
            <a href={`https://wa.me/5491125088580?text=${encodeURIComponent("Hola! Necesito ayuda para clasificar: "+p.description)}`} target="_blank" rel="noopener noreferrer" style={{fontSize:12,padding:"6px 14px",borderRadius:8,border:"1px solid rgba(34,197,94,0.3)",background:"rgba(34,197,94,0.08)",color:"#22c55e",cursor:"pointer",fontWeight:600,textDecoration:"none"}}>Consultar por WhatsApp</a>
          </div>
          <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 8px"}}><div><label style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Derechos %</label><input type="number" placeholder="35" onChange={e=>{const v=Number(e.target.value)||35;chProd(i,"ncm",{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:v,statistics_rate:p.ncm?.statistics_rate||3,iva_rate:p.ncm?.iva_rate||21});}} style={{width:"100%",padding:"6px 8px",fontSize:12,border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,background:"rgba(255,255,255,0.028)",color:"#fff",outline:"none",boxSizing:"border-box"}}/></div><div><label style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>TE %</label><input type="number" placeholder="3" onChange={e=>{const v=Number(e.target.value)||3;chProd(i,"ncm",{...p.ncm,ncm_code:"MANUAL",statistics_rate:v});}} style={{width:"100%",padding:"6px 8px",fontSize:12,border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,background:"rgba(255,255,255,0.028)",color:"#fff",outline:"none",boxSizing:"border-box"}}/></div><div><label style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>IVA %</label><input type="number" placeholder="21" onChange={e=>{const v=Number(e.target.value)||21;chProd(i,"ncm",{...p.ncm,ncm_code:"MANUAL",iva_rate:v});}} style={{width:"100%",padding:"6px 8px",fontSize:12,border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,background:"rgba(255,255,255,0.028)",color:"#fff",outline:"none",boxSizing:"border-box"}}/></div></div>
        </div>}
        {!hasBrand&&!p.ncm&&!p.ncmError&&!p.ncmLoading&&p.description?.trim()&&<div style={{marginBottom:8}}><button onClick={()=>chProd(i,"ncm",{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:35,statistics_rate:3,iva_rate:21})} style={{fontSize:11,color:"rgba(255,255,255,0.4)",background:"none",border:"none",cursor:"pointer",padding:0}}>¿No querés clasificar? Usar valores estimados →</button></div>}
      </div>)}
      <button onClick={addProduct} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar otro producto</button>

      {totalFob>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:12,marginTop:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Valor total mercadería</span><span style={{fontSize:16,fontWeight:700,color:IC}}>{usd(totalFob)}</span></div>}
      {(()=>{const hasPriced=products.some(p=>Number(p.unit_price)>0);const pendingClass=!hasBrand&&products.some(p=>Number(p.unit_price)>0&&!p.ncm);const blocked=!hasPriced||pendingClass;return <>
        {pendingClass&&<div style={{background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:10,padding:"10px 14px",marginTop:14}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>⚠️ Tenés que clasificar cada producto antes de avanzar. Usá el botón <strong>Clasificar</strong> o elegí <strong>"Usar valores estimados"</strong> si no podemos detectar el NCM.</p></div>}
        <div style={{display:"flex",gap:12,marginTop:16}}><button onClick={()=>{setStep(0);setOrigin("");}} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Cambiar origen</button><button onClick={()=>setStep(2)} disabled={blocked} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:blocked?"not-allowed":"pointer",background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,boxShadow:GOLD_GLOW,opacity:blocked?0.4:1}}>Siguiente →</button></div>
      </>;})()}
    </div>}

    {/* CHINA FLOW - Step 2: Packing List */}
    {step===2&&origin==="China"&&<div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 16px"}}>PACKING LIST</h3>
      {pkgs.map((pk,i)=>{const q=Number(pk.qty||1),l=Number(pk.length||0),w=Number(pk.width||0),h=Number(pk.height||0),gw=Number(pk.weight||0);const bruto=gw*q;const vol=l&&w&&h?((l*w*h)/5000)*q:0;const isVol=vol>bruto&&!noDims;
      return <div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Bulto {i+1}</span>{pkgs.length>1&&<button onClick={()=>rmPkg(i)} style={{fontSize:11,padding:"4px 10px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>Eliminar</button>}</div>
        <div className="grid-5" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:"0 10px"}}>
          <Inp label="Cant. bultos" type="number" value={pk.qty} onChange={v=>chPkg(i,"qty",v)} placeholder="1"/>
          {!noDims&&<><Inp label="Largo (cm)" type="number" value={pk.length} onChange={v=>chPkg(i,"length",v)} placeholder="60"/><Inp label="Ancho (cm)" type="number" value={pk.width} onChange={v=>chPkg(i,"width",v)} placeholder="40"/><Inp label="Alto (cm)" type="number" value={pk.height} onChange={v=>chPkg(i,"height",v)} placeholder="35"/></>}
          <Inp label="Peso (kg)" type="number" value={pk.weight} onChange={v=>chPkg(i,"weight",v)} placeholder="12"/>
        </div>
        {(bruto>0||vol>0)&&<div style={{display:"flex",gap:16,marginTop:-4,marginBottom:4,fontSize:11,color:"rgba(255,255,255,0.4)"}}><span>Peso bruto total: <strong style={{color:"#fff"}}>{bruto.toFixed(1)} kg</strong></span>{!noDims&&vol>0&&<span>Peso volumétrico total: <strong style={{color:"#fff"}}>{vol.toFixed(1)} kg</strong></span>}</div>}
        {isVol&&<div style={{background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:8,padding:"8px 12px",marginBottom:4}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>Tené en cuenta que el peso volumétrico de este bulto es <strong>{vol.toFixed(1)} kg</strong> (mayor al bruto de {bruto.toFixed(1)} kg)</p></div>}
      </div>;})}
      <button onClick={addPkg} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar otro bulto</button>
      <div style={{marginTop:16,marginBottom:8}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={noDims} onChange={e=>setNoDims(e.target.checked)}/><span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Desconozco las medidas de las cajas</span></label>{noDims&&<div style={{background:"rgba(251,146,60,0.1)",border:"1px solid rgba(251,146,60,0.25)",borderRadius:8,padding:"10px 14px",marginTop:8}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>Sin las medidas no se pueden calcular los costos marítimos.</p></div>}</div>
      {(()=>{const{totWeight,totCBM}=calcTotals();let pf=0;pkgs.forEach(pk=>{const q=Number(pk.qty||1),l=Number(pk.length||0),w=Number(pk.width||0),h=Number(pk.height||0),gw=Number(pk.weight||0);pf+=Math.max(gw*q,l&&w&&h?((l*w*h)/5000)*q:0);});return totWeight>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:12,marginTop:12,display:"flex",gap:20,flexWrap:"wrap"}}><div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>{totWeight.toFixed(2)} kg</p></div>{!noDims&&pf>totWeight&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>PESO FACTURABLE</p><p style={{fontSize:14,fontWeight:700,color:IC,margin:0}}>{pf.toFixed(2)} kg</p></div>}{!noDims&&totCBM>0&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>CBM</p><p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>{totCBM.toFixed(4)} m³</p></div>}</div>;})()}
      <div style={{display:"flex",gap:12,marginTop:16}}><button onClick={()=>setStep(1)} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Atrás</button><button onClick={()=>setStep(3)} disabled={!pkgs.some(p=>Number(p.weight)>0)} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,boxShadow:GOLD_GLOW,opacity:pkgs.some(p=>Number(p.weight)>0)?1:0.4}}>Siguiente →</button></div>
    </div>}

    {/* CHINA FLOW - Step 3: Delivery */}
    {step===3&&origin==="China"&&(()=>{const{totWeight}=calcTotals();const shipOpts=[{k:"oficina",l:"Retiro por Oficina",sub:"Gratis"},{k:"caba",l:"Envío CABA",sub:`USD ${getShipCost("caba",totWeight)}`},{k:"gba",l:"Envío GBA",sub:`USD ${getShipCost("gba",totWeight)}`}];return <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 16px"}}>ENTREGA EN DESTINO</h3>
      {clientZone&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.12)",borderRadius:10,padding:"10px 14px",marginBottom:14}}><p style={{fontSize:12,color:IC,margin:0,fontWeight:500}}>Tu dirección registrada es de <strong>{clientZone==="caba"?"CABA":"GBA"}</strong> — seleccionamos envío automáticamente</p></div>}
      <div className="delivery-opts" style={{display:"flex",gap:12,marginBottom:20}}>{shipOpts.map(d=><div key={d.k} onClick={()=>setDelivery(d.k)} style={{flex:1,padding:"16px",textAlign:"center",borderRadius:12,border:`1.5px solid ${delivery===d.k?IC:"rgba(255,255,255,0.08)"}`,background:delivery===d.k?"rgba(184,149,106,0.1)":"rgba(255,255,255,0.028)",cursor:"pointer"}}><p style={{fontSize:15,fontWeight:700,color:delivery===d.k?IC:"rgba(255,255,255,0.6)",margin:"0 0 4px"}}>{d.l}</p><p style={{fontSize:13,fontWeight:600,color:delivery===d.k?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.45)",margin:0}}>{d.sub}</p></div>)}</div>
      {delivery==="oficina"&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.12)",borderRadius:10,padding:"14px 18px",marginBottom:16}}><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>Nuestras Oficinas</p><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"0 0 4px"}}>Av. Callao 1137, CABA — Lunes a Viernes de 9:00 a 19:00 hs</p><p style={{fontSize:14,color:"#22c55e",margin:0,fontWeight:600}}>Se puede abonar al momento de retirar</p></div>}
      {(delivery==="caba"||delivery==="gba")&&<div style={{background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:10,padding:"14px 18px",marginBottom:16}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>Para envíos a domicilio, la carga debe abonarse previamente antes de ser despachada. Sin excepción.</p></div>}
      <div style={{display:"flex",gap:12,marginTop:8}}><button onClick={()=>setStep(2)} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Atrás</button><button onClick={calculateChina} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,boxShadow:GOLD_GLOW}}>Calcular costos →</button></div>
    </div>;})()}

    {/* CHINA FLOW - Step 4: Results */}
    {step===4&&origin==="China"&&results&&<div>
      <div style={{display:"flex",gap:12,marginBottom:16}}><button onClick={()=>setStep(3)} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button><span style={{color:"rgba(255,255,255,0.1)"}}>|</span><button onClick={()=>{setStep(0);setResults(null);setOrigin("");setProducts([{type:"general",description:"",unit_price:"",quantity:"1"}]);setPkgs([{qty:"1",length:"",width:"",height:"",weight:""}]);setNoDims(false);setDelivery("oficina");setHasBattery(false);setHasBrand(false);}} style={{fontSize:13,color:"rgba(255,255,255,0.4)",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>Nueva cotización</button></div>
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:14,marginBottom:20,display:"flex",gap:24,flexWrap:"wrap"}}>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>VALOR MERCADERÍA</p><p style={{fontSize:15,fontWeight:700,color:"#fff",margin:0}}>{usd(totalFob)}</p></div>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{results.totWeight.toFixed(2)} kg</p></div>
        {results.totCBM>0&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>CBM</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{results.totCBM.toFixed(4)} m³</p></div>}
        {ncm?.ncm_code&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>NCM</p><p style={{fontSize:15,fontWeight:600,color:IC,margin:0,fontFamily:"monospace"}}>{ncm.ncm_code}</p></div>}
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>ENTREGA</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{DELIV[delivery]}</p></div>
      </div>
      {(()=>{const cheapest=results.channels.reduce((a,b)=>a.total<b.total?a:b);const delivCost=getShipCost(delivery,calcTotals().totWeight);
      const aereos=results.channels.filter(c=>c.key.includes("aereo"));const maritimos=results.channels.filter(c=>c.key.includes("maritimo"));
      const renderCard=(ch)=>{const isCheapest=ch.key===cheapest.key;const isFastest=ch.key==="aereo_a_china";const isAereo=ch.key.includes("aereo");const total=ch.total+delivCost;
      return <div key={ch.key} style={{background:"rgba(255,255,255,0.028)",borderRadius:16,border:`1.5px solid ${isFastest?"rgba(251,146,60,0.4)":isCheapest?"rgba(34,197,94,0.4)":"rgba(255,255,255,0.1)"}`,padding:"1.5rem",marginBottom:16,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>{isAereo?"✈️":"🚢"}</span><p className="result-card-title" style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>{ch.name}</p></div>
          {isFastest&&<span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:8,background:"rgba(251,146,60,0.15)",color:"#fb923c",border:"1px solid rgba(251,146,60,0.3)"}}>⚡ El más Rápido</span>}
          {isCheapest&&!isFastest&&<span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:8,background:"rgba(34,197,94,0.15)",color:"#22c55e",border:"1px solid rgba(34,197,94,0.3)"}}>💵 El más Económico</span>}
        </div>
        {origin==="USA"&&ch.info&&<p style={{fontSize:12,color:"rgba(255,255,255,0.45)",margin:"0 0 12px"}}>{ch.info}</p>}
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"20px",marginBottom:16,textAlign:"center"}}>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",textTransform:"uppercase"}}>Costo de importación</p>
          <p style={{fontSize:32,fontWeight:700,color:"#fff",margin:0}}>{usd(total)}</p>
        </div>
        <button onClick={()=>setExpandedCh(expandedCh===ch.key?null:ch.key)} style={{width:"100%",padding:"12px",fontSize:13,fontWeight:600,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.028)",cursor:"pointer",color:"rgba(255,255,255,0.5)",marginBottom:12}}>Ver desglose detallado ▼</button>
        <button onClick={()=>saveQuote(ch,true)} style={{width:"100%",padding:"12px",fontSize:13,fontWeight:600,borderRadius:10,border:"1.5px solid rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.08)",color:IC,cursor:"pointer",marginBottom:10}}>{savedMsg===ch.key?"✓ Guardada":"💾 Guardar cotización"}</button>
        <a href={`https://wa.me/5491125088580?text=${makeWAMsg(ch)}`} onClick={()=>saveQuote(ch)} target="_blank" rel="noopener noreferrer" style={{display:"block",width:"100%",padding:"14px",fontSize:14,fontWeight:700,borderRadius:12,border:"none",cursor:"pointer",background:`linear-gradient(135deg,#25D366,#128C7E)`,color:"#fff",textAlign:"center",textDecoration:"none",boxSizing:"border-box"}}>Avanzar con esta importación →</a>
      </div>;};

      {/* Modal for desglose */}
      const modalCh=expandedCh?results.channels.find(c=>c.key===expandedCh):null;
      const isAereoModal=expandedCh?.includes("aereo");

      const maxLen=Math.max(aereos.length,maritimos.length);const pairs=[];for(let i=0;i<maxLen;i++)pairs.push([aereos[i],maritimos[i]]);
      return <><div>{pairs.map((pair,pi)=><div key={pi} className="grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"stretch",marginBottom:0}}>{pair.map(ch=>ch?renderCard(ch):<div key={"empty"+pi}/>)}</div>)}</div>
      {modalCh&&<div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setExpandedCh(null)}>
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}}/>
        <div style={{position:"relative",maxWidth:650,width:"90%",maxHeight:"85vh",overflow:"auto",background:"#142038",borderRadius:20,border:"1px solid rgba(255,255,255,0.06)",padding:"2rem",boxShadow:"0 30px 60px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>{isAereoModal?"✈️":"🚢"}</span><h3 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>{modalCh.name}</h3></div>
            <button onClick={()=>setExpandedCh(null)} style={{fontSize:20,background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",padding:"4px 8px"}}>✕</button>
          </div>
          {/* Peso/CBM info inside modal */}
          {isAereoModal&&modalCh.pesoFact&&<div style={{display:"flex",gap:20,marginBottom:20,padding:"12px 16px",background:"rgba(255,255,255,0.028)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
            <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>{modalCh.pesoBruto?.toFixed(1)} kg</p></div>
            <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>PESO VOL.</p><p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>{modalCh.pesoVol?.toFixed(1)} kg</p></div>
            <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>FACTURABLE</p><p style={{fontSize:14,fontWeight:700,color:IC,margin:0}}>{modalCh.pesoFact?.toFixed(1)} kg</p></div>
          </div>}
          {!isAereoModal&&modalCh.cbm&&<div style={{marginBottom:20,padding:"12px 16px",background:"rgba(255,255,255,0.028)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 2px"}}>CBM TOTAL</p><p style={{fontSize:14,fontWeight:700,color:IC,margin:0}}>{modalCh.cbm?.toFixed(4)} m³</p>
          </div>}
          {/* Per-item breakdown for canales A */}
          {modalCh.isBlanco&&modalCh.items?<>{modalCh.items.map((it,ii)=><div key={ii} style={{background:"rgba(255,255,255,0.02)",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",padding:"16px",marginBottom:12}}>
            <p style={{fontSize:14,fontWeight:700,color:IC,margin:"0 0 12px"}}>Item {ii+1}: {it.desc?.toUpperCase()}</p>
            <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 8px"}}>% DESGLOSE DE IMPUESTOS</p>
            <div className="grid-tax" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
              {[{l:"Der. Importación",v:it.derechos,p:`${it.drPct}%`},{l:"Tasa Estadística",v:it.tasa_e,p:`${it.tePct}%`},{l:"IVA",v:it.iva,p:`${it.ivaPct}%`},
                ...(modalCh.isMar?[{l:"IVA Ad.+IIGG+IIBB",v:(it.ivaAdic||0)+(it.iigg||0)+(it.iibb||0),p:"31%"}]:[{l:"Gasto Documental",v:(it.desembolso||0)+(it.ivaDesemb||0),p:""}])
              ].map((t,ti)=><div key={ti} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{t.l}</span>{t.p&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(184,149,106,0.15)",color:IC,fontWeight:700}}>{t.p}</span>}</div>
                <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>{usd(t.v)}</p>
              </div>)}
            </div>
            {row("Total Impuestos",it.totalImp)}
          </div>)}
          <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:12}}>
            {row("Costo de envío",modalCh.flete)}
            {modalCh.battExtra>0&&row("Recargo baterías",modalCh.battExtra)}
            {row("Seguro",modalCh.seguro)}
            {delivCost>0&&row(delivery==="gba"?"Envío GBA":"Envío CABA",delivCost)}
            {row("TOTAL",modalCh.total+delivCost,true,true)}
          </div>
          </>:<div>
            {row("Servicio Integral ARGENCARGO",modalCh.flete)}
            {modalCh.surcharge>0&&row(`Recargo valor (${modalCh.surchargePct}%)`,modalCh.surcharge)}
            {delivCost>0&&row(delivery==="gba"?"Envío GBA":"Envío CABA",delivCost)}
            {row("TOTAL",modalCh.total+delivCost,true,true)}
          </div>}
        </div>
      </div>}
      </>;})()}
    </div>}
  </div>;
}
function QuotesPage({token,client}){
  const [quotes,setQuotes]=useState([]);const [lo,setLo]=useState(true);const [sel,setSel]=useState(null);
  useEffect(()=>{if(!client?.id){setLo(false);return;}(async()=>{const q=await dq("quotes",{token,filters:`?client_id=eq.${client.id}&select=*&order=created_at.desc`});setQuotes(Array.isArray(q)?q:[]);setLo(false);})();},[token,client?.id]);
  const delQuote=async(id)=>{if(!confirm("¿Eliminar esta cotización?"))return;await dq("quotes",{method:"DELETE",token,filters:`?id=eq.${id}`});setQuotes(p=>p.filter(q=>q.id!==id));};
  const fmtDate=(d)=>{const s=String(d).slice(0,10);if(s.match(/^\d{4}-\d{2}-\d{2}$/)){const[y,m,day]=s.split("-");return new Date(y,m-1,day).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});};
  const usd=v=>`USD ${Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const ST={pending:{l:"Pendiente",c:"#fbbf24"},contacted:{l:"Contactado",c:"#60a5fa"},converted:{l:"Convertida",c:"#22c55e"},rejected:{l:"Rechazada",c:"#f87171"}};
  const resendWA=(q)=>{const prods=typeof q.products==="string"?JSON.parse(q.products):q.products||[];const prodSummary=Array.isArray(prods)?prods.map(p=>`${p.description||p.type} x${p.quantity}`).join(", "):"";const flag=q.origin==="USA"?"🇺🇸":"🇨🇳";const isAereo=q.channel_key?.includes("aereo");const msg=encodeURIComponent(`Hola Bautista! Te paso una cotización que tengo guardada.\n\nOrigen: *${q.origin}* ${flag}\nMercadería: *${prodSummary}*\nCanal: *${q.channel_name}*\nValor total: *${usd(q.total_fob)}*\n${isAereo?`Peso: *${Number(q.total_weight).toFixed(2)} kg*`:`CBM: *${Number(q.total_cbm).toFixed(4)} m³*`}\nTotal estimado: *${usd(q.total_cost)}*\n\nCódigo cliente: *${q.client_code}*`);window.open(`https://wa.me/5491125088580?text=${msg}`,"_blank");};
  if(lo)return <p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"3rem 0"}}>Cargando...</p>;
  return <div>
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 6px",letterSpacing:"-0.02em"}}>Mis cotizaciones <span style={{color:GOLD_LIGHT,fontWeight:600}}>({quotes.length})</span></h2>
      <p style={{fontSize:14,color:"rgba(255,255,255,0.4)",margin:0}}>Historial de cotizaciones realizadas</p>
    </div>
    {quotes.length===0?<div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px dashed rgba(255,255,255,0.1)",padding:"3rem 2rem",textAlign:"center"}}>
      <p style={{fontSize:15,color:"rgba(255,255,255,0.5)",margin:"0 0 6px"}}>No tenés cotizaciones guardadas todavía</p>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:0}}>Usá la calculadora y tocá "Guardar cotización" para que aparezcan acá</p>
    </div>:<div style={{display:"grid",gap:12}}>{quotes.map(q=>{const st=ST[q.status]||{l:q.status,c:"#999"};const prods=typeof q.products==="string"?JSON.parse(q.products):q.products||[];const prodDesc=Array.isArray(prods)?prods.map(p=>`${p.description||p.type} x${p.quantity}`).join(", "):"";const isAereo=q.channel_key?.includes("aereo");
      return <div key={q.id} style={{background:"rgba(255,255,255,0.028)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"1.25rem 1.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{fmtDate(q.created_at)}</span>
            <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:st.c,background:`${st.c}15`,border:`1px solid ${st.c}33`}}>{st.l}</span>
            <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:4,color:"rgba(255,255,255,0.6)",background:"rgba(255,255,255,0.06)"}}>{q.origin==="USA"?"🇺🇸":"🇨🇳"} {q.channel_name}</span>
          </div>
          <button onClick={()=>delQuote(q.id)} style={{fontSize:10,padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.08)",color:"#ff6b6b",cursor:"pointer",fontWeight:600}}>Eliminar</button>
        </div>
        {Array.isArray(prods)&&prods.length>0?<div style={{marginBottom:12}}>{prods.map((p,i)=>{const fobItem=Number(p.unit_price||0)*Number(p.quantity||1);const nc=p.ncm||{};return <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 12px",marginBottom:6}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:nc.ncm_code?6:0,flexWrap:"wrap",gap:8}}>
            <div><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}>{p.description||p.type}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"2px 0 0"}}>Cant. {p.quantity} · Unit. {usd(p.unit_price)}</p></div>
            <p style={{fontSize:13,fontWeight:700,color:IC,margin:0}}>FOB {usd(fobItem)}</p>
          </div>
          {nc.ncm_code&&<div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.15)",borderRadius:6,padding:"6px 10px",display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",fontSize:10.5}}>
            <span style={{fontFamily:"monospace",fontWeight:700,color:IC}}>NCM {nc.ncm_code}</span>
            {nc.ncm_description&&<span style={{color:"rgba(255,255,255,0.5)"}}>{nc.ncm_description}</span>}
            <span style={{color:"rgba(255,255,255,0.5)",marginLeft:"auto"}}>Derechos <strong style={{color:"#fff"}}>{nc.import_duty_rate||0}%</strong></span>
            <span style={{color:"rgba(255,255,255,0.5)"}}>TE <strong style={{color:"#fff"}}>{nc.statistics_rate||0}%</strong></span>
            <span style={{color:"rgba(255,255,255,0.5)"}}>IVA <strong style={{color:"#fff"}}>{nc.iva_rate||21}%</strong></span>
          </div>}
        </div>;})}</div>:<p style={{fontSize:14,fontWeight:500,color:"#fff",margin:"0 0 10px",lineHeight:1.4}}>{prodDesc||"Sin descripción"}</p>}
        {/* Selector de canales disponibles (si la cotización tiene alternativas guardadas) */}
        {(()=>{const alts=q.channel_alternatives;if(!Array.isArray(alts)||alts.length<=1)return null;const selected=q.client_selected_channel||q.channel_key;return <div style={{marginBottom:14}}>
          <p style={{fontSize:10.5,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Elegí tu canal preferido</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
            {alts.map(a=>{const active=selected===a.key;return <div key={a.key} onClick={async()=>{try{await dq("quotes",{method:"PATCH",token,filters:`?id=eq.${q.id}`,body:{client_selected_channel:a.key}});setQuotes(p=>p.map(x=>x.id===q.id?{...x,client_selected_channel:a.key}:x));toast(`Elegiste ${a.name}`,"success");}catch(e){toast("Error al guardar","error");}}} style={{padding:"12px 14px",borderRadius:12,border:`1px solid ${active?"rgba(184,149,106,0.5)":"rgba(255,255,255,0.08)"}`,background:active?"linear-gradient(135deg, rgba(184,149,106,0.12) 0%, rgba(255,255,255,0.02) 100%)":"rgba(255,255,255,0.025)",cursor:"pointer",transition:"all 150ms",position:"relative",overflow:"hidden",boxShadow:active?GOLD_GLOW:"none"}}>
              {active&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:GOLD_GRADIENT}}/>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,gap:6}}>
                <div><p style={{fontSize:12,fontWeight:700,color:"#fff",margin:0}}>{a.name}</p><p style={{fontSize:10,color:"rgba(255,255,255,0.45)",margin:"2px 0 0"}}>{a.info}</p></div>
                {active&&<span style={{fontSize:8.5,fontWeight:800,padding:"2px 6px",borderRadius:999,background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.08em",textTransform:"uppercase"}}>Elegido</span>}
              </div>
              <p style={{fontSize:15,fontWeight:800,color:active?GOLD_LIGHT:"#fff",margin:"8px 0 0",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em"}}>USD {Number(a.totalAbonar||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
            </div>;})}
          </div>
        </div>;})()}
        <div style={{display:"flex",gap:20,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)",alignItems:"center"}}>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>VALOR FOB</p><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}>{usd(q.total_fob)}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>{isAereo?"PESO":"CBM"}</p><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}>{isAereo?`${Number(q.total_weight).toFixed(2)} kg`:`${Number(q.total_cbm).toFixed(4)} m³`}</p></div>
          <div style={{marginLeft:"auto"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>{q.client_selected_channel?"CANAL ELEGIDO":"TOTAL ESTIMADO"}</p><p style={{fontSize:18,fontWeight:700,color:IC,margin:0}}>{(()=>{if(q.client_selected_channel&&Array.isArray(q.channel_alternatives)){const a=q.channel_alternatives.find(x=>x.key===q.client_selected_channel);if(a)return usd(a.totalAbonar);}return usd(q.total_cost);})()}</p></div>
          <button onClick={()=>resendWA(q)} style={{padding:"10px 18px",fontSize:12,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff"}}>Enviar por WhatsApp →</button>
        </div>
      </div>;})}</div>}
  </div>;
}
function PointsPage({token,client}){
  const [catalog,setCatalog]=useState([]);
  const [txs,setTxs]=useState([]);
  const [pending,setPending]=useState([]);
  const [tierVouchers,setTierVouchers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [balance,setBalance]=useState(Number(client?.points_balance||0));
  const [tier,setTier]=useState(client?.tier||"standard");
  const [lifetime,setLifetime]=useState(Number(client?.lifetime_points_earned||0));
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(null);
  const load=async()=>{
    setLoading(true);
    const [cat,tx,pd,cl,tr]=await Promise.all([
      dq("rewards_catalog",{token,filters:"?active=eq.true&select=*&order=sort_order.asc"}),
      dq("points_transactions",{token,filters:`?client_id=eq.${client.id}&select=*&order=created_at.desc&limit=30`}),
      dq("client_reward_redemptions",{token,filters:`?client_id=eq.${client.id}&status=eq.pending&select=*&order=redeemed_at.desc`}),
      dq("clients",{token,filters:`?id=eq.${client.id}&select=points_balance,tier,lifetime_points_earned`}),
      dq("tier_rewards",{token,filters:`?client_id=eq.${client.id}&select=*&order=reached_at.desc`})
    ]);
    setCatalog(Array.isArray(cat)?cat:[]);
    setTxs(Array.isArray(tx)?tx:[]);
    setPending(Array.isArray(pd)?pd:[]);
    setTierVouchers(Array.isArray(tr)?tr:[]);
    if(Array.isArray(cl)&&cl[0]){setBalance(Number(cl[0].points_balance||0));setTier(cl[0].tier||"standard");setLifetime(Number(cl[0].lifetime_points_earned||0));}
    setLoading(false);
  };
  useEffect(()=>{load();},[client?.id]);
  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),3500);const v=/^[❌✕]|error|no te alcanzan/i.test(m)?"error":"success";toast(m.replace(/^[✓❌✕]\s*/u,""),v);};
  const redeem=async(r)=>{
    if(!confirm(`¿Canjear "${r.name}" por ${r.points_cost} puntos?\n\nBalance actual: ${balance} pts\nNuevo balance: ${balance-r.points_cost} pts\n\nEl canje queda pendiente hasta que Argencargo lo aplique a una de tus próximas operaciones.`))return;
    setBusy(r.id);
    const res=await dq("rpc/redeem_reward",{method:"POST",token,body:{p_reward_id:r.id,p_client_id:client.id}});
    if(res?.ok){flash(`✓ Canjeaste "${r.name}". Te lo aplicamos en tu próxima operación.`);await load();}
    else if(res?.error==="insufficient_points")flash("❌ No te alcanzan los puntos.");
    else flash("❌ Error al canjear.");
    setBusy(null);
  };
  const fmtDate=d=>{if(!d)return"—";try{return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}catch{return d;}};
  const fmtDateTime=d=>{if(!d)return"—";try{return new Date(d).toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});}catch{return d;}};
  const expiringSoon=txs.filter(t=>t.type==="earn"&&t.expires_at&&new Date(t.expires_at)<new Date(Date.now()+30*86400000)&&new Date(t.expires_at)>new Date());
  const txLabel={earn:"Ganados",redeem:"Canje",expire:"Expiraron",refund:"Devolución",adjust:"Ajuste"};
  const txColor={earn:"#22c55e",redeem:"#60a5fa",expire:"#ef4444",refund:"#a78bfa",adjust:"#fbbf24"};
  const ti=getTierInfo(tier);
  const nextTier=ti.next?Object.values(TIERS).find(t=>t.min===ti.next):null;
  const ptsToNext=nextTier?Math.max(0,nextTier.min-lifetime):0;
  const progressPct=nextTier?Math.min(100,Math.max(0,((lifetime-ti.min)/(nextTier.min-ti.min))*100)):100;
  const pendingVouchers=tierVouchers.filter(v=>v.status==="pending");
  return <div>
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>Mis puntos</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"4px 0 0",lineHeight:1.5}}>Ganás puntos por cada kg aéreo y CBM marítimo que importes.</p>
    </div>
    {msg&&<p style={{fontSize:13,color:"#22c55e",fontWeight:600,marginBottom:16,padding:"10px 14px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:8,animation:"ac_fade_in 200ms"}}>{msg}</p>}

    {/* Tier hero + progress */}
    <div style={{background:`linear-gradient(135deg, ${ti.color}22 0%, rgba(255,255,255,0.02) 100%)`,border:`1px solid ${tier==="standard"?"rgba(255,255,255,0.08)":ti.color+"55"}`,borderRadius:18,padding:"24px 28px",marginBottom:18,position:"relative",overflow:"hidden",boxShadow:tier==="standard"?"none":ti.glow}}>
      <div style={{position:"absolute",top:-50,right:-50,width:220,height:220,background:`radial-gradient(circle, ${ti.color}22 0%, transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap",position:"relative"}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase",letterSpacing:"0.14em"}}>Tu categoría</p>
          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:6}}>
            <span style={{fontSize:34}}>{ti.icon}</span>
            <div>
              <p style={{fontSize:32,fontWeight:800,color:"#fff",margin:0,lineHeight:1,letterSpacing:"-0.02em",textShadow:tier!=="standard"?`0 0 20px ${ti.color}55`:"none"}}>{ti.label}</p>
              {tier!=="standard"&&<p style={{fontSize:11,color:ti.light,margin:"4px 0 0",fontWeight:600,letterSpacing:"0.04em"}}>+{ti.bonus}% bonus en puntos</p>}
            </div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase",letterSpacing:"0.1em"}}>Ganados en total</p>
          <p style={{fontSize:24,fontWeight:700,color:"#fff",margin:"4px 0 0",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em"}}>{lifetime.toLocaleString("es-AR")} <span style={{fontSize:12,color:ti.light,fontWeight:600}}>pts</span></p>
        </div>
      </div>
      {nextTier&&<div style={{marginTop:18,position:"relative"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:500}}>En <strong style={{color:ti.light,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{ptsToNext}</strong> pts llegás a <strong style={{color:getTierInfo(Object.keys(TIERS).find(k=>TIERS[k].min===ti.next)).light,fontWeight:700}}>{nextTier.label}</strong> {Object.values(TIERS).find(t=>t.min===ti.next)?.icon}</span>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontVariantNumeric:"tabular-nums"}}>{Math.round(progressPct)}%</span>
        </div>
        <div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:999,overflow:"hidden",border:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{width:`${progressPct}%`,height:"100%",background:ti.gradient,borderRadius:999,boxShadow:ti.glow,transition:"width 400ms ease-out"}}/>
        </div>
      </div>}
      {!nextTier&&<p style={{marginTop:16,fontSize:12,color:ti.light,fontWeight:600,letterSpacing:"0.04em"}}>★ Alcanzaste el nivel máximo. ¡Gracias por importar con nosotros!</p>}
    </div>

    {/* Vouchers de tier pendientes */}
    {pendingVouchers.length>0&&<div style={{marginBottom:24,padding:"16px 20px",background:"rgba(184,149,106,0.05)",border:"1px solid rgba(184,149,106,0.22)",borderRadius:14}}>
      <p style={{fontSize:11,fontWeight:700,color:GOLD_LIGHT,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.1em"}}>★ Descuentos por categoría disponibles</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>{pendingVouchers.map(v=>{const vti=getTierInfo(v.tier);return <div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"10px 12px",background:"rgba(255,255,255,0.02)",borderRadius:10,border:`1px solid ${vti.color}40`}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>{vti.icon}</span><div><p style={{fontSize:13,fontWeight:700,color:"#fff",margin:0}}>Descuento {vti.label}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"2px 0 0"}}>Se aplica automáticamente en tu próxima operación</p></div></div><span style={{fontSize:16,fontWeight:800,color:vti.light,fontVariantNumeric:"tabular-nums"}}>USD {Number(v.discount_usd).toFixed(0)}</span></div>;})}</div>
    </div>}

    {/* Balance hero + secundarios */}
    <div style={{display:"grid",gridTemplateColumns:expiringSoon.length>0?"2fr 1fr 1fr":"2fr 1fr",gap:14,marginBottom:28}}>
      <div style={{background:"linear-gradient(135deg, rgba(184,149,106,0.14) 0%, rgba(232,208,152,0.05) 100%)",border:`1px solid ${GOLD_DEEP}`,borderRadius:16,padding:"24px 28px",position:"relative",overflow:"hidden",boxShadow:GOLD_GLOW}}>
        <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,background:"radial-gradient(circle, rgba(232,208,152,0.22) 0%, transparent 70%)",pointerEvents:"none"}}/>
        <p style={{fontSize:10,fontWeight:700,color:GOLD_LIGHT,margin:0,textTransform:"uppercase",letterSpacing:"0.14em",position:"relative"}}>★ Balance actual</p>
        <p style={{fontSize:48,fontWeight:800,color:"#fff",margin:"8px 0 0",lineHeight:1,letterSpacing:"-0.03em",fontVariantNumeric:"tabular-nums",position:"relative"}}>{balance.toLocaleString("es-AR")} <span style={{fontSize:16,fontWeight:600,color:GOLD_LIGHT,letterSpacing:"0.04em"}}>pts</span></p>
      </div>
      <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"24px 22px"}}>
        <p style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase",letterSpacing:"0.1em"}}>Canjes pendientes</p>
        <p style={{fontSize:32,fontWeight:700,color:"#fff",margin:"8px 0 0",lineHeight:1,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{pending.length}</p>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"6px 0 0"}}>{pending.length===0?"Ninguno":"se aplican en tu próxima op"}</p>
      </div>
      {expiringSoon.length>0&&<div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:16,padding:"24px 22px"}}>
        <p style={{fontSize:10,fontWeight:600,color:"rgba(239,68,68,0.85)",margin:0,textTransform:"uppercase",letterSpacing:"0.1em"}}>Expiran en 30d</p>
        <p style={{fontSize:32,fontWeight:700,color:"#ef4444",margin:"8px 0 0",lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{expiringSoon.reduce((s,e)=>s+e.amount,0)}</p>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"6px 0 0"}}>Canjealos antes</p>
      </div>}
    </div>

    {/* Canjes pendientes */}
    {pending.length>0&&<div style={{marginBottom:28}}>
      <h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Tus canjes pendientes</h3>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>{pending.map(p=><div key={p.id} style={{background:"rgba(184,149,106,0.05)",border:"1px solid rgba(184,149,106,0.18)",borderRadius:12,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div><p style={{fontSize:13.5,fontWeight:700,color:"#fff",margin:0}}>{p.reward_name}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"3px 0 0"}}>Canjeado {fmtDate(p.redeemed_at)} · {p.points_spent} pts · Expira {fmtDate(p.expires_at)}</p></div>
        <span style={{fontSize:9.5,fontWeight:700,padding:"4px 10px",borderRadius:999,background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.1em",border:`1px solid ${GOLD_DEEP}`,textTransform:"uppercase"}}>Pendiente</span>
      </div>)}</div>
    </div>}

    {/* Catálogo */}
    <h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Catálogo de premios</h3>
    {loading?<p style={{color:"rgba(255,255,255,0.4)",padding:"2rem 0",textAlign:"center"}}>Cargando...</p>:
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14,marginBottom:28}}>{catalog.map(r=>{
      const canRedeem=balance>=r.points_cost;
      return <div key={r.id} style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${canRedeem?"rgba(184,149,106,0.28)":"rgba(255,255,255,0.06)"}`,borderRadius:16,padding:"20px 22px",display:"flex",flexDirection:"column",gap:12,opacity:canRedeem?1:0.55,transition:"all 180ms",position:"relative",overflow:"hidden"}} onMouseEnter={e=>{if(canRedeem){e.currentTarget.style.borderColor="rgba(184,149,106,0.5)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=GOLD_GLOW;}}} onMouseLeave={e=>{if(canRedeem){e.currentTarget.style.borderColor="rgba(184,149,106,0.28)";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}><span style={{fontSize:32,lineHeight:1}}>{r.icon||"🎁"}</span><span style={{fontSize:11,fontWeight:800,color:GOLD_LIGHT,padding:"4px 10px",background:"rgba(184,149,106,0.1)",border:"1px solid rgba(184,149,106,0.25)",borderRadius:999,letterSpacing:"0.04em",fontVariantNumeric:"tabular-nums"}}>{r.points_cost} pts</span></div>
        <div><p style={{fontSize:15,fontWeight:700,color:"#fff",margin:"0 0 4px",letterSpacing:"-0.01em"}}>{r.name}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:0,lineHeight:1.5}}>{r.description}</p></div>
        <button disabled={!canRedeem||busy===r.id} onClick={()=>redeem(r)} style={{marginTop:"auto",padding:"10px 16px",fontSize:12,fontWeight:700,borderRadius:10,cursor:canRedeem?"pointer":"not-allowed",background:canRedeem?GOLD_GRADIENT:"rgba(255,255,255,0.04)",color:canRedeem?"#0A1628":"rgba(255,255,255,0.4)",border:canRedeem?`1px solid ${GOLD_DEEP}`:"1px solid rgba(255,255,255,0.06)",boxShadow:canRedeem?GOLD_GLOW:"none",letterSpacing:"0.02em",transition:"all 150ms"}}>{busy===r.id?"Canjeando…":canRedeem?"Canjear →":`Faltan ${r.points_cost-balance} pts`}</button>
      </div>;})}</div>}

    {/* Historial */}
    <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"24px 0 10px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Historial</h3>
    {txs.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"2rem 0"}}>Aún no tenés movimientos. Se acumulan al cerrar cada operación.</p>:
    <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden"}}>{txs.map((t,i)=><div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:i<txs.length-1?"1px solid rgba(255,255,255,0.04)":"none",gap:12,flexWrap:"wrap"}}>
      <div><p style={{fontSize:12,fontWeight:700,color:txColor[t.type]||"#fff",margin:0}}>{txLabel[t.type]||t.type}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"2px 0 0"}}>{t.description||"—"}{t.expires_at&&t.type==="earn"?` · Expira ${fmtDate(t.expires_at)}`:""}</p></div>
      <div style={{textAlign:"right"}}><p style={{fontSize:14,fontWeight:800,color:t.amount>0?"#22c55e":"#ef4444",margin:0}}>{t.amount>0?"+":""}{t.amount} pts</p><p style={{fontSize:10,color:"rgba(255,255,255,0.35)",margin:"2px 0 0"}}>{fmtDateTime(t.created_at)}</p></div>
    </div>)}</div>}

    <p style={{fontSize:11,color:"rgba(255,255,255,0.35)",margin:"16px 0 0",textAlign:"center",fontStyle:"italic"}}>Ganás 1 pt por cada kg aéreo facturable · 50 pts por CBM marítimo · Expiran a 12 meses · 10 pts = USD 1 de descuento en flete</p>
  </div>;
}

function ServicesPage({client}){
  const code=client?.client_code||"";const name=client?`${client.first_name}`:"";
  const services=[
    {icon:["M12 1v22","M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],title:"Gestión de Pagos Internacionales",desc:"Realizamos el giro al exterior para que puedas pagar a tu proveedor de forma segura y rápida. Nos encargamos de toda la operatoria cambiaria.",cta:"Necesito hacer un pago internacional",color:"#22c55e",tag:"Popular"},
    {icon:["M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"],title:"Búsqueda de Proveedores",desc:"¿No sabés dónde comprar? Buscamos proveedores verificados en China y USA para tu producto. Negociamos precios y condiciones por vos.",cta:"Quiero que me busquen un proveedor",color:"#60a5fa",tag:null},
    {icon:["M9 11l3 3L22 4","M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],title:"Inspección de Mercadería",desc:"Verificamos la calidad de tu mercadería en origen antes de que se envíe. Fotos, videos y reportes detallados para que compres con tranquilidad.",cta:"Quiero inspeccionar mi mercadería",color:"#a78bfa",tag:null},
    {icon:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"],title:"Consolidación de Carga",desc:"Juntamos mercadería de varios proveedores en un solo envío para optimizar costos de flete. Ideal si comprás en múltiples fábricas.",cta:"Quiero consolidar mi carga",color:"#fb923c",tag:null},
    {icon:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"],title:"Asesoramiento Aduanero",desc:"Te orientamos sobre clasificación arancelaria, requisitos de importación, documentación necesaria y régimen impositivo de tu mercadería.",cta:"Necesito asesoramiento",color:"#f97316",tag:null},
    {icon:["M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z","M7 7h.01"],title:"Seguro de Carga",desc:"Protegé tu inversión con cobertura integral durante todo el trayecto. Cubrimos pérdida total, daños parciales y extravíos.",cta:"Quiero asegurar mi carga",color:"#ef4444",tag:null}
  ];
  const makeWA=(svc)=>encodeURIComponent(`Hola Bautista! Soy ${name} (${code}).\n\n${svc.cta}.\n\n¿Me podrías dar más información sobre el servicio de *${svc.title}*?\n\nGracias!`);
  return <div>
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 6px",letterSpacing:"-0.02em"}}>Nuestros servicios</h2>
      <p style={{fontSize:14,color:"rgba(255,255,255,0.4)",margin:0}}>Soluciones integrales para tu comercio exterior</p>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}} className="grid-2">
      {services.map((svc,i)=><div key={i} style={{background:"rgba(255,255,255,0.028)",borderRadius:16,border:"1px solid rgba(255,255,255,0.06)",padding:"1.5rem",display:"flex",flexDirection:"column",justifyContent:"space-between",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:svc.color}}/>
        {svc.tag&&<span style={{position:"absolute",top:14,right:14,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:6,background:`${svc.color}20`,color:svc.color,border:`1px solid ${svc.color}33`}}>{svc.tag}</span>}
        <div>
          <div style={{width:44,height:44,borderRadius:12,background:`${svc.color}15`,border:`1px solid ${svc.color}25`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={svc.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{svc.icon.map((d,j)=><path key={j} d={d}/>)}</svg>
          </div>
          <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 8px"}}>{svc.title}</h3>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.45)",margin:"0 0 20px",lineHeight:1.5}}>{svc.desc}</p>
        </div>
        <a href={`https://wa.me/5491125088580?text=${makeWA(svc)}`} target="_blank" rel="noopener noreferrer" style={{display:"block",width:"100%",padding:"12px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(135deg,#25D366,#128C7E)`,color:"#fff",textAlign:"center",textDecoration:"none",boxSizing:"border-box"}}>{svc.cta} →</a>
      </div>)}
    </div>
  </div>;
}
function AccountPage({token,client}){
  const [timeline,setTimeline]=useState([]);
  const [balance,setBalance]=useState(Number(client?.account_balance_usd||0));
  const [loading,setLoading]=useState(true);
  const MOV_LABELS={overpayment:"Pago de más",applied:"Aplicado a op",adjustment:"Ajuste",refund:"Reintegro",debt:"Pago de menos",op_cobro:"Cobro de op",op_anticipo:"Anticipo de op"};
  const MOV_COLORS={overpayment:"#22c55e",applied:GOLD_LIGHT,adjustment:"#a78bfa",refund:"#60a5fa",debt:"#ef4444",op_cobro:"#22c55e",op_anticipo:"#60a5fa"};
  useEffect(()=>{if(!client?.id){setLoading(false);return;}(async()=>{
    const[m,cl,ops,pm]=await Promise.all([
      dq("client_account_movements",{token,filters:`?client_id=eq.${client.id}&select=*,operations(operation_code)&order=created_at.desc`}),
      dq("clients",{token,filters:`?id=eq.${client.id}&select=account_balance_usd`}),
      dq("operations",{token,filters:`?client_id=eq.${client.id}&is_collected=eq.true&select=id,operation_code,collected_amount,collection_currency,collection_exchange_rate,collection_date,closed_at`}),
      dq("operation_client_payments",{token,filters:`?select=*,operations!inner(operation_code,client_id)&operations.client_id=eq.${client.id}&order=payment_date.desc`})
    ]);
    const movs=Array.isArray(m)?m:[];
    const opsList=Array.isArray(ops)?ops:[];
    const pmts=Array.isArray(pm)?pm:[];
    const merged=[
      ...movs.map(x=>({id:"m_"+x.id,date:x.created_at,type:x.type,amount:Number(x.amount_usd),op_code:x.operations?.operation_code,description:x.description})),
      ...opsList.filter(o=>Number(o.collected_amount||0)>0).map(o=>{const raw=Number(o.collected_amount||0);const isArs=o.collection_currency==="ARS";const rate=Number(o.collection_exchange_rate||0);const usd=isArs&&rate>0?raw/rate:raw;return{id:"o_"+o.id,date:o.collection_date||o.closed_at,type:"op_cobro",amount:usd,op_code:o.operation_code,description:isArs?`Pago ARS ${raw.toLocaleString("es-AR")} @ ${rate}`:"Pago recibido"};}),
      ...pmts.map(p=>({id:"p_"+p.id,date:p.payment_date,type:"op_anticipo",amount:Number(p.amount_usd||0),op_code:p.operations?.operation_code,description:p.notes||`Anticipo (${p.payment_method||"pago"})`}))
    ].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
    setTimeline(merged);
    if(Array.isArray(cl)&&cl[0])setBalance(Number(cl[0].account_balance_usd||0));
    setLoading(false);
  })();},[client?.id,token]);
  const fmtDate=d=>{try{return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}catch{return d;}};
  const isCredit=balance>0;const isDebt=balance<0;
  return <div>
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>Mi cuenta corriente</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"4px 0 0",lineHeight:1.5}}>Registro de saldos a favor, descuentos y aplicaciones en tus operaciones.</p>
    </div>
    {/* Hero balance */}
    <div style={{padding:"26px 30px",background:isCredit?"linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(255,255,255,0.02) 100%)":isDebt?"linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(255,255,255,0.02) 100%)":"rgba(255,255,255,0.025)",border:`1px solid ${isCredit?"rgba(34,197,94,0.4)":isDebt?"rgba(239,68,68,0.4)":"rgba(255,255,255,0.08)"}`,borderRadius:16,marginBottom:22,boxShadow:isCredit?"0 0 28px rgba(34,197,94,0.15)":isDebt?"0 0 28px rgba(239,68,68,0.15)":"none",position:"relative",overflow:"hidden"}}>
      {(isCredit||isDebt)&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:isCredit?"linear-gradient(90deg, #22c55e, #10b981)":"linear-gradient(90deg, #ef4444, #dc2626)"}}/>}
      <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.14em"}}>{isCredit?"Saldo a favor":isDebt?"Saldo pendiente":"Balance de cuenta"}</p>
      <p style={{fontSize:44,fontWeight:800,color:isCredit?"#22c55e":isDebt?"#ef4444":"#fff",margin:0,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.03em",lineHeight:1}}>{isCredit?"+":""}USD {balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
      {isCredit&&<p style={{fontSize:13,color:"rgba(255,255,255,0.6)",margin:"10px 0 0",lineHeight:1.5}}>Se aplicará automáticamente a tu próxima operación pendiente de cobro.</p>}
      {isDebt&&<p style={{fontSize:13,color:"rgba(255,255,255,0.6)",margin:"10px 0 0",lineHeight:1.5}}>Este saldo se saldará en tu próxima operación.</p>}
      {!isCredit&&!isDebt&&<p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"10px 0 0"}}>Sin movimientos pendientes.</p>}
    </div>
    {/* Historial */}
    <h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.1em"}}>Historial de movimientos</h3>
    {loading?<SkeletonTable rows={4} cols={3} hideHeader/>:timeline.length===0?
      <EmptyState icon="document" title="Sin movimientos todavía" description="Cuando haya pagos, saldos a favor, descuentos o ajustes en tu cuenta los vas a ver acá."/>
      :<div style={{display:"flex",flexDirection:"column",gap:2,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,overflow:"hidden"}}>
      {timeline.map(t=>{const amt=t.amount;const isPos=amt>0;const color=MOV_COLORS[t.type]||"#fff";const label=MOV_LABELS[t.type]||t.type;return <div key={t.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3,flexWrap:"wrap"}}>
            <span style={{fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:999,background:`${color}14`,color,border:`1px solid ${color}35`,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</span>
            {t.op_code&&<span style={{fontSize:11,fontFamily:"'JetBrains Mono','SF Mono',monospace",color:GOLD_LIGHT,letterSpacing:"0.04em"}}>{t.op_code}</span>}
            <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{t.date?fmtDate(t.date):"—"}</span>
          </div>
          {t.description&&<p style={{fontSize:12.5,color:"rgba(255,255,255,0.7)",margin:0}}>{t.description}</p>}
        </div>
        <span style={{fontSize:16,fontWeight:800,color:isPos?"#22c55e":"#ef4444",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em",whiteSpace:"nowrap"}}>{isPos?"+":""}USD {Math.abs(amt).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>;})}
    </div>}
  </div>;
}
function InternationalPaymentsPage({client}){
  // WhatsApp de Argencargo para derivar pagos internacionales
  const WA_PHONE="5491125088580";
  const [origin,setOrigin]=useState("");      // "china" | "usa"
  const [amountStr,setAmountStr]=useState("");
  const [method,setMethod]=useState("");      // "cash" | "transfer"
  const [showForm,setShowForm]=useState(false);
  const [bankInfo,setBankInfo]=useState("");
  const onAmount=v=>{if(v===""||/^\d*\.?\d*$/.test(v))setAmountStr(v);};
  const amount=Number(amountStr)||0;
  // Tarifas
  const pctArgencargo=0.0325;                  // 3.25%
  const fixedUsd=origin==="usa"?100:origin==="china"?125:0;
  const commission=amount*pctArgencargo;
  const pctTransfer=method==="transfer"?0.025:0; // recargo 2.5% si paga por transferencia
  const transferSurcharge=(amount+commission+fixedUsd)*pctTransfer;
  const total=amount+commission+fixedUsd+transferSurcharge;
  const canAdvance=origin&&amount>0&&method;
  const resetAll=()=>{setOrigin("");setAmountStr("");setMethod("");setShowForm(false);setBankInfo("");};

  const canSend=canAdvance; // Datos bancarios son opcionales — el cliente puede mandar la foto por WA

  const originLabel=origin==="usa"?"Estados Unidos 🇺🇸":origin==="china"?"China 🇨🇳":"";
  const methodLabel=method==="cash"?"Efectivo (sin recargo)":method==="transfer"?"Transferencia (+2,5%)":"";
  const wireLabel=origin==="usa"?"Transferencia WIRE":origin==="china"?"Transferencia SWIFT":"";

  const buildWAMessage=()=>{
    const fmt=n=>n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
    const hasBankInfo=bankInfo.trim().length>0;
    const lines=[
      "Hola Argencargo 👋, quiero gestionar un *pago internacional*.",
      "",
      `*Cliente:* ${client?.first_name||""} ${client?.last_name||""} (${client?.client_code||"—"})`,
      `*Destino:* ${originLabel}`,
      `*Importe al proveedor:* USD ${fmt(amount)}`,
      `*Método de pago a Argencargo:* ${methodLabel}`,
      "",
      "*Detalle del cálculo:*",
      `• Importe al proveedor: USD ${fmt(amount)}`,
      `• ${wireLabel} (${(pctArgencargo*100).toFixed(2)}%): USD ${fmt(commission)}`,
      `• Cargo fijo: USD ${fmt(fixedUsd)}`,
      ...(pctTransfer>0?[`• Recargo transferencia (2,5%): USD ${fmt(transferSurcharge)}`]:[]),
      `*TOTAL A ABONAR A ARGENCARGO: USD ${fmt(total)}*`,
      "",
      "*Datos del beneficiario:*",
      ...(hasBankInfo?[bankInfo.trim(),"","Te paso también la foto / captura original por acá 👇 para doble chequeo."]:["Te mando la foto / captura con los datos del proveedor por acá 👇"]),
      "",
      "Quedo a la espera de la confirmación para coordinar el pago. ¡Gracias!",
    ];
    return encodeURIComponent(lines.join("\n"));
  };

  return <div>
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>Pagos internacionales</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"4px 0 0",lineHeight:1.5}}>Calculamos la tarifa y te pagamos al proveedor en el exterior por vos.</p>
    </div>

    {/* STEP 1: Origen */}
    <div style={{marginBottom:22}}>
      <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.12em"}}>1 · ¿Dónde está la cuenta del proveedor?</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[
          {k:"china",flag:"🇨🇳",label:"China",sub:"Transferencia SWIFT · 3,25% + USD 125 fijo"},
          {k:"usa",flag:"🇺🇸",label:"Estados Unidos",sub:"Transferencia WIRE · 3,25% + USD 100 fijo"},
        ].map(o=>{const active=origin===o.k;return <div key={o.k} onClick={()=>setOrigin(o.k)} style={{padding:"18px 20px",border:`1px solid ${active?GOLD_DEEP:"rgba(255,255,255,0.08)"}`,borderRadius:14,cursor:"pointer",background:active?"rgba(184,149,106,0.08)":"rgba(255,255,255,0.025)",transition:"all 150ms",position:"relative",overflow:"hidden",boxShadow:active?GOLD_GLOW:"none"}}>
          {active&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:GOLD_GRADIENT}}/>}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:28,lineHeight:1}}>{o.flag}</span>
            <div>
              <p style={{fontSize:15,fontWeight:700,color:"#fff",margin:0}}>{o.label}</p>
              <p style={{fontSize:11,color:active?GOLD_LIGHT:"rgba(255,255,255,0.5)",margin:"3px 0 0",fontWeight:500}}>{o.sub}</p>
            </div>
          </div>
        </div>;})}
      </div>
    </div>

    {/* STEP 2: Monto */}
    {origin&&<div style={{marginBottom:22}}>
      <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.12em"}}>2 · Importe a transferir al proveedor</p>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14}}>
        <span style={{fontSize:14,fontWeight:700,color:GOLD_LIGHT,letterSpacing:"0.04em"}}>USD</span>
        <input type="text" inputMode="decimal" value={amountStr} onChange={e=>onAmount(e.target.value)} placeholder="0.00" style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:24,fontWeight:700,fontVariantNumeric:"tabular-nums",padding:0,letterSpacing:"-0.01em"}}/>
      </div>
    </div>}

    {/* STEP 3: Método de pago */}
    {origin&&amount>0&&<div style={{marginBottom:22}}>
      <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.12em"}}>3 · ¿Cómo vas a abonarle a Argencargo?</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[
          {k:"cash",label:"Efectivo",sub:"Sin recargo",icon:"💵"},
          {k:"transfer",label:"Transferencia",sub:"+2,5% recargo",icon:"🏦"},
        ].map(o=>{const active=method===o.k;return <div key={o.k} onClick={()=>setMethod(o.k)} style={{padding:"16px 20px",border:`1px solid ${active?GOLD_DEEP:"rgba(255,255,255,0.08)"}`,borderRadius:14,cursor:"pointer",background:active?"rgba(184,149,106,0.08)":"rgba(255,255,255,0.025)",transition:"all 150ms",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:22,lineHeight:1}}>{o.icon}</span>
          <div>
            <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>{o.label}</p>
            <p style={{fontSize:11,color:active?GOLD_LIGHT:"rgba(255,255,255,0.5)",margin:"2px 0 0",fontWeight:500}}>{o.sub}</p>
          </div>
        </div>;})}
      </div>
    </div>}

    {/* Resumen + total */}
    {canAdvance&&<div style={{marginBottom:22,padding:"20px 24px",background:"linear-gradient(135deg, rgba(184,149,106,0.1) 0%, rgba(255,255,255,0.02) 100%)",border:`1px solid ${GOLD_DEEP}`,borderRadius:16,boxShadow:GOLD_GLOW,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:GOLD_GRADIENT}}/>
      <p style={{fontSize:10,fontWeight:700,color:GOLD_LIGHT,margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.14em"}}>Resumen</p>
      {[
        {l:"Importe al proveedor",v:amount},
        {l:`${wireLabel} (${(pctArgencargo*100).toFixed(2)}%)`,v:commission},
        {l:"Cargo fijo",v:fixedUsd},
        ...(pctTransfer>0?[{l:"Recargo transferencia (2,5%)",v:transferSurcharge}]:[]),
      ].map((r,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13,color:"rgba(255,255,255,0.75)"}}>
        <span>{r.l}</span>
        <span style={{fontVariantNumeric:"tabular-nums"}}>USD {r.v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>)}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0 2px",borderTop:"1px solid rgba(184,149,106,0.3)",marginTop:8}}>
        <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:"0.1em"}}>Total a abonar a Argencargo</span>
        <span style={{fontSize:24,fontWeight:800,color:GOLD_LIGHT,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>USD {total.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>
    </div>}

    {/* CTA Avanzar */}
    {canAdvance&&!showForm&&<button onClick={()=>setShowForm(true)} style={{padding:"14px 28px",fontSize:14,fontWeight:700,borderRadius:12,border:`1px solid ${GOLD_DEEP}`,cursor:"pointer",background:GOLD_GRADIENT,color:"#0A1628",boxShadow:GOLD_GLOW,letterSpacing:"0.02em"}}>Avanzar →</button>}

    {/* STEP 4: Datos del proveedor (libre) */}
    {showForm&&<div style={{marginTop:20,padding:"24px 26px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16}}>
      <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.12em"}}>4 · Datos del proveedor</p>
      <p style={{fontSize:12,color:"rgba(255,255,255,0.5)",margin:"0 0 14px",lineHeight:1.5}}>Pegá la info que tengas (email del proveedor, datos sueltos, lo que sea). Si preferís, dejalo vacío y nos mandás la foto o captura directamente por WhatsApp — te la vamos a pedir ahí.</p>
      <textarea value={bankInfo} onChange={e=>setBankInfo(e.target.value)} placeholder={"Beneficiario:\nBanco:\nNº cuenta / IBAN:\nSWIFT / ABA:\nDirección del banco:\n\n(O pegá el email completo, como venga)"} rows={7} style={{width:"100%",padding:"14px 16px",fontSize:13.5,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none",transition:"all 180ms",fontFamily:"inherit",lineHeight:1.55,resize:"vertical"}} onFocus={e=>{e.target.style.borderColor=GOLD;e.target.style.boxShadow="0 0 0 3px rgba(184,149,106,0.18)";e.target.style.background="rgba(255,255,255,0.07)";}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";e.target.style.boxShadow="none";e.target.style.background="rgba(255,255,255,0.04)";}}/>
      <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
        <a href={`https://wa.me/${WA_PHONE}?text=${buildWAMessage()}`} target="_blank" rel="noopener noreferrer" style={{padding:"13px 24px",fontSize:14,fontWeight:700,borderRadius:10,cursor:"pointer",background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:10,boxShadow:"0 4px 14px rgba(37,211,102,0.25)",letterSpacing:"0.02em"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>Enviar por WhatsApp</a>
        <button onClick={resetAll} style={{padding:"13px 20px",fontSize:13,fontWeight:600,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"rgba(255,255,255,0.55)",cursor:"pointer",letterSpacing:"0.02em"}}>Empezar de nuevo</button>
      </div>
    </div>}
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

function DashShell({children,page,setPage,role,client,user,onLogout,token}){
  const name=client?`${client.first_name} ${client.last_name}`:user?.email||"";const code=client?.client_code||"";const nav=CN;const [mobOpen,setMobOpen]=useState(false);
  const sidebarContent=<>
    <div style={{padding:"24px 20px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"center",alignItems:"center",position:"relative"}}>
      <img src={LOGO} alt="AC" style={{width:"100%",height:"auto",maxHeight:50,objectFit:"contain"}}/>
      <button className="mob-close" onClick={()=>setMobOpen(false)} style={{display:"none",position:"absolute",right:16,top:16,background:"none",border:"none",color:"rgba(255,255,255,0.6)",fontSize:20,cursor:"pointer"}}>✕</button>
    </div>
    {code&&<div style={{padding:"16px 20px 4px"}}><span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.12em"}}>Cliente</span><p style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,margin:"3px 0 0",fontFamily:"'JetBrains Mono','SF Mono',monospace",letterSpacing:"0.06em"}}>{code}</p></div>}
    <nav style={{flex:1,padding:"12px 10px"}}>{nav.map(item=>{const active=page===item.key;return <button key={item.key} onClick={()=>{setPage(item.key);setMobOpen(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"10px 14px",marginBottom:2,borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:active?700:600,letterSpacing:"0.06em",background:active?"linear-gradient(90deg, rgba(184,149,106,0.12), rgba(184,149,106,0.02))":"transparent",color:active?"#fff":"rgba(255,255,255,0.45)",transition:"all 150ms",position:"relative"}} onMouseEnter={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.color="rgba(255,255,255,0.75)";}}} onMouseLeave={e=>{if(!active){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.45)";}}}>{active&&<span style={{position:"absolute",left:0,top:8,bottom:8,width:3,background:GOLD_GRADIENT,borderRadius:"0 3px 3px 0"}}/>}<svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={active?GOLD_LIGHT:"rgba(255,255,255,0.4)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>{item.p.map((d,i)=><path key={i} d={d}/>)}</svg><span style={{flex:1,textAlign:"left",lineHeight:1.25}}>{item.label}</span></button>;})}</nav>
    <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.06)"}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg, rgba(184,149,106,0.2), rgba(184,149,106,0.08))",border:"1px solid rgba(184,149,106,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:GOLD_LIGHT,letterSpacing:"0.03em"}}>{(client?.first_name?.[0]||"U").toUpperCase()}{(client?.last_name?.[0]||"").toUpperCase()}</div><div style={{flex:1,minWidth:0}}><p style={{fontSize:12.5,fontWeight:600,color:"#fff",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</p><p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",margin:"1px 0 0",letterSpacing:"0.04em"}}>Cliente</p></div></div><button onClick={onLogout} style={{width:"100%",padding:"8px 10px",fontSize:11.5,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:600,letterSpacing:"0.04em",transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.35)";e.currentTarget.style.color=GOLD_LIGHT;}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(255,255,255,0.5)";}}>Cerrar sesión</button></div>
  </>;
  return <div style={{minHeight:"100vh",fontFamily:"'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif",background:DARK_BG,position:"relative"}}><div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}><WorldMap/></div>
    <style>{`
      @keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.85;transform:scale(1.05);}}
      @media(max-width:768px){
        .sidebar-desktop{display:none!important}
        .mob-header{display:flex!important}
        .mob-close{display:block!important}
        .desktop-notif-bar{display:none!important}
        .main-content{margin-left:0!important;padding-top:60px!important;overflow-x:hidden!important}
        .main-inner{padding:16px!important;max-width:100vw!important;box-sizing:border-box!important}
        .mob-overlay{display:block!important}
        .mob-sidebar{display:flex!important}
        .grid-2{grid-template-columns:1fr!important}
        .grid-4{grid-template-columns:1fr 1fr!important}
        .grid-5{grid-template-columns:1fr 1fr!important}
        .stats-grid{grid-template-columns:1fr 1fr!important}
        .ac-hero-grid{grid-template-columns:1fr!important;gap:10px!important}
        .ac-hero-grid>div{padding:14px 16px!important}
        .ac-hero-grid>div:first-child{padding:16px 18px!important}
        h3{font-size:12px!important}
        .op-progress{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .op-info{flex-wrap:wrap!important;gap:12px!important}
        h2{font-size:18px!important}
        .calc-steps{overflow-x:auto!important;-webkit-overflow-scrolling:touch;gap:4px!important;padding-bottom:6px!important;flex-wrap:nowrap!important;scrollbar-width:none}
        .calc-steps::-webkit-scrollbar{display:none}
        .calc-steps .step-label{font-size:10px!important}
        .calc-steps .step-circle{width:22px!important;height:22px!important;font-size:10px!important;min-width:22px!important}
        .calc-origin-flag{margin-right:4px!important;padding:4px 8px!important}
        .calc-origin-flag span:last-child{font-size:10px!important}
        .delivery-opts{flex-wrap:wrap!important}
        .delivery-opts>div{flex:none!important;width:100%!important}
        .result-card-title{font-size:16px!important}
        .grid-tax{grid-template-columns:1fr 1fr!important}
        .origin-picker{gap:12px!important}
        .origin-picker>div{width:auto!important;flex:1!important;min-width:0!important;padding:1.5rem 1rem!important}
        .origin-picker p:first-child{font-size:40px!important}
      }
      @media(min-width:769px){
        .mob-header{display:none!important}
        .mob-sidebar{display:none!important}
        .mob-overlay{display:none!important}
        .desktop-notif-bar{display:flex!important}
      }
    `}</style>
    {/* Mobile header */}
    <div className="mob-header" style={{display:"none",position:"fixed",top:0,left:0,right:0,height:56,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(255,255,255,0.08)",alignItems:"center",justifyContent:"space-between",padding:"0 16px",zIndex:20}}>
      <button onClick={()=>setMobOpen(true)} style={{background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer",padding:4}}>☰</button>
      <img src={LOGO} alt="AC" style={{height:30}}/>
      <div style={{display:"flex",alignItems:"center",gap:8}}>{token&&<NotifBell token={token}/>}{code&&<span style={{fontSize:12,fontWeight:700,color:IC,fontFamily:"monospace"}}>{code}</span>}</div>
    </div>
    {/* Mobile overlay */}
    {mobOpen&&<div className="mob-overlay" style={{display:"none",position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:25}} onClick={()=>setMobOpen(false)}/>}
    {/* Mobile sidebar */}
    {mobOpen&&<div className="mob-sidebar" style={{display:"none",position:"fixed",top:0,left:0,bottom:0,width:280,background:"rgba(10,22,40,0.98)",borderRight:"1px solid rgba(255,255,255,0.08)",flexDirection:"column",zIndex:30,overflow:"auto"}}>{sidebarContent}</div>}
    {/* Desktop sidebar */}
    <div className="sidebar-desktop" style={{width:220,position:"fixed",top:0,left:0,bottom:0,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(12px)",borderRight:"1px solid rgba(255,255,255,0.08)",display:"flex",flexDirection:"column",zIndex:10,overflow:"auto"}}>{sidebarContent}</div>
    <div className="main-content" style={{marginLeft:220,minHeight:"100vh",position:"relative",zIndex:1}}>
      <div className="desktop-notif-bar" style={{display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"12px 32px 0",gap:12}}>{token&&<NotifBell token={token}/>}</div>
      <div className="main-inner" style={{maxWidth:1000,margin:"0 auto",padding:"28px 32px"}}>{children}</div></div>
    <WhatsAppFab message={`Hola Argencargo! 👋 Soy ${client?.first_name||""} ${client?.last_name||""}${client?.client_code?` (${client.client_code})`:""}, tengo una consulta.`}/>
  </div>;
}
function Dashboard({profile,client,user,token,onLogout}){
  const [page,setPage]=useState("imports");const [ops,setOps]=useState([]);const [itemsByOp,setItemsByOp]=useState({});const [pmtsByOp,setPmtsByOp]=useState({});const [cliPmtsByOp,setCliPmtsByOp]=useState({});const [selOp,setSelOp]=useState(null);const [lo,setLo]=useState(false);const [pendingVouchersCount,setPendingVouchersCount]=useState(0);
  const loadOps=async()=>{setLo(true);const [r,it,pm,cp,tv]=await Promise.all([dq("operations",{token,filters:"?select=*&order=created_at.desc"}),dq("operation_items",{token,filters:"?select=operation_id"}),dq("payment_management",{token,filters:"?select=operation_id,client_amount_usd"}),dq("operation_client_payments",{token,filters:"?select=operation_id,amount_usd"}),client?.id?dq("tier_rewards",{token,filters:`?client_id=eq.${client.id}&status=eq.pending&select=id`}):Promise.resolve([])]);const list=Array.isArray(r)?r:[];setOps(list);const m={};(Array.isArray(it)?it:[]).forEach(x=>{m[x.operation_id]=(m[x.operation_id]||0)+1;});setItemsByOp(m);const pmap={};(Array.isArray(pm)?pm:[]).forEach(p=>{pmap[p.operation_id]=(pmap[p.operation_id]||0)+Number(p.client_amount_usd||0);});setPmtsByOp(pmap);const cmap={};(Array.isArray(cp)?cp:[]).forEach(p=>{cmap[p.operation_id]=(cmap[p.operation_id]||0)+Number(p.amount_usd||0);});setCliPmtsByOp(cmap);setPendingVouchersCount(Array.isArray(tv)?tv.length:0);setLo(false);
    // Deep-link: ?op=AC-XXXX → auto-open that operation
    if(typeof window!=="undefined"){const params=new URLSearchParams(window.location.search);const opCode=params.get("op");if(opCode){const found=list.find(o=>o.operation_code===opCode);if(found){setSelOp(found);setPage("imports");window.history.replaceState({},"",window.location.pathname);}}}
  };
  useEffect(()=>{if(page==="imports")loadOps();},[page]);
  useEffect(()=>{let last=Date.now();const onFocus=()=>{if(document.visibilityState==="visible"&&page==="imports"&&!selOp&&Date.now()-last>5000){last=Date.now();loadOps();}};document.addEventListener("visibilitychange",onFocus);window.addEventListener("focus",onFocus);return()=>{document.removeEventListener("visibilitychange",onFocus);window.removeEventListener("focus",onFocus);};},[page,selOp]);
  // Navegación inter-widget (ej. hero widget -> points)
  useEffect(()=>{const h=(e)=>{if(e?.detail){setPage(e.detail);setSelOp(null);}};if(typeof window!=="undefined")window.addEventListener("ac_nav",h);return()=>{if(typeof window!=="undefined")window.removeEventListener("ac_nav",h);};},[]);
  const clientWithCount={...client,_pending_vouchers_count:pendingVouchersCount};
  return <DashShell page={page} setPage={p=>{setPage(p);setSelOp(null);}} role="cliente" client={client} user={user} onLogout={onLogout} token={token}>
    {page==="imports"&&!selOp&&<>{lo?<div style={{padding:"1rem 0"}}><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>{[0,1,2,3].map(i=><div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"20px 22px"}}><Skeleton w={80} h={10} style={{marginBottom:12}}/><Skeleton w={60} h={28}/></div>)}</div>{[0,1,2].map(i=><div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"1.5rem 1.75rem",marginBottom:14}}><div style={{display:"flex",gap:10,marginBottom:14}}><Skeleton w={100} h={14}/><Skeleton w={130} h={20} br={999}/></div><Skeleton w="50%" h={20} style={{marginBottom:16}}/><div style={{display:"flex",gap:12,marginBottom:14}}>{[0,1,2,3,4,5,6,7].map(j=><Skeleton key={j} w={38} h={38} br={999}/>)}</div><div style={{display:"flex",gap:28}}><Skeleton w={70} h={30}/><Skeleton w={80} h={30}/><Skeleton w={120} h={30}/></div></div>)}</div>:<OperationsList ops={ops} onSelect={setSelOp} client={clientWithCount} token={token} onReload={loadOps} itemsByOp={itemsByOp} pmtsByOp={pmtsByOp} cliPmtsByOp={cliPmtsByOp}/>}</>}
    {page==="imports"&&selOp&&<OperationDetail op={selOp} token={token} onBack={()=>setSelOp(null)}/>}
    {page==="profile"&&<ProfilePage client={client}/>}
    {page==="rates"&&<RatesPage token={token} client={client}/>}
    {page==="calculator"&&<CalculatorPage token={token} client={client}/>}
    {page==="services"&&<ServicesPage client={client}/>}
    {page==="quotes"&&<QuotesPage token={token} client={client}/>}
    {page==="points"&&<PointsPage token={token} client={client}/>}
    {page==="payments"&&<InternationalPaymentsPage client={client}/>}
    {page==="account"&&<AccountPage token={token} client={client}/>}
    {!["imports","profile","rates","calculator","services","quotes","points","payments","account"].includes(page)&&<div style={{textAlign:"center",padding:"4rem 0"}}><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 8px",textTransform:"uppercase"}}>{page.replace("_"," ")}</h2><p style={{fontSize:14,color:"rgba(255,255,255,0.4)"}}>Sección en desarrollo</p></div>}
  </DashShell>;
}
export default function Page(){
  const [view,setView]=useState("login");const [step,setStep]=useState(0);const [form,setForm]=useState(INIT);const [errors,setErrors]=useState({});const [loading,setLoading]=useState(false);const [gErr,setGErr]=useState("");const [okMsg,setOkMsg]=useState("");
  const [session,setSession]=useState(null);const [client,setClient]=useState(null);const [profile,setProfile]=useState(null);const [restoring,setRestoring]=useState(true);
  useEffect(()=>{const r=async()=>{const s=loadSession();if(!s?.token||!s?.user){setRestoring(false);return;}try{const uid=s.user.id;const p=await dq("profiles",{token:s.token,filters:`?id=eq.${uid}&select=*`});const prof=Array.isArray(p)?p[0]:null;if(!prof){clearSession();setRestoring(false);return;}if(prof.role==="cliente"){const c=await dq("clients",{token:s.token,filters:`?auth_user_id=eq.${uid}&select=*`});setClient(Array.isArray(c)?c[0]:null);}setSession(s);setProfile(prof);}catch{clearSession();}setRestoring(false);};r();},[]);
  const ch=f=>v=>{setForm(p=>({...p,[f]:v}));setErrors(p=>({...p,[f]:undefined}));setGErr("");};
  const val=s=>{const e={};if(s===0){if(!form.first_name.trim())e.first_name="Requerido";if(!form.last_name.trim())e.last_name="Requerido";if(!form.whatsapp.trim())e.whatsapp="Requerido";else if(form.whatsapp.replace(/\D/g,"").length<10)e.whatsapp="Número inválido (mínimo 10 dígitos)";if(!form.email.trim())e.email="Requerido";else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))e.email="Email inválido";if(!form.password)e.password="Requerido";else if(form.password.length<6)e.password="Mínimo 6 caracteres";if(form.password!==form.confirm_password)e.confirm_password="No coinciden";}if(s===1){if(!form.street.trim())e.street="Requerido";if(!form.postal_code.trim())e.postal_code="Requerido";if(!form.city.trim())e.city="Requerido";if(!form.province)e.province="Requerido";}if(s===2&&form.tax_condition==="responsable_inscripto"){if(!form.company_name.trim())e.company_name="Requerido";if(!form.cuit.trim())e.cuit="Requerido";else if(form.cuit.replace(/\D/g,"").length!==11)e.cuit="CUIT inválido (debe tener 11 dígitos)";}setErrors(e);return !Object.keys(e).length;};
  const gc=(fn,ln)=>(fn.substring(0,3)+ln.substring(0,3)).toUpperCase();
  const createClient=async(token,uid)=>{const code=gc(form.first_name.trim(),form.last_name.trim());return dq("clients",{method:"POST",token,body:{auth_user_id:uid,first_name:form.first_name.trim(),last_name:form.last_name.trim(),whatsapp:form.whatsapp.trim(),email:form.email.trim(),tax_condition:form.tax_condition,company_name:form.tax_condition==="responsable_inscripto"?form.company_name.trim():null,cuit:form.tax_condition==="responsable_inscripto"?form.cuit.trim():null,street:form.street.trim(),floor_apt:form.floor_apt.trim()||null,postal_code:form.postal_code.trim(),city:form.city.trim(),province:form.province,client_code:code}});};
  const doReg=async()=>{if(!val(2))return;setLoading(true);setGErr("");try{const a=await ac("signup",{email:form.email,password:form.password,data:{role:"cliente",first_name:form.first_name.trim(),last_name:form.last_name.trim(),whatsapp:form.whatsapp.trim(),tax_condition:form.tax_condition,company_name:form.company_name.trim(),cuit:form.cuit.trim(),street:form.street.trim(),floor_apt:form.floor_apt.trim(),postal_code:form.postal_code.trim(),city:form.city.trim(),province:form.province}});if(a.error){setGErr(a.error.message||"Error");setLoading(false);return;}if(!a.access_token){setOkMsg("Te enviamos un email de confirmación. Una vez confirmado, ingresá con tu email y contraseña.");setLoading(false);return;}const c=await createClient(a.access_token,a.user.id);if(c?.error||!c){setGErr("Error guardando datos.");setLoading(false);return;}const ss={token:a.access_token,refresh_token:a.refresh_token,user:a.user};saveSession(ss);setSession(ss);const cliente=Array.isArray(c)?c[0]:c;setClient(cliente);setProfile({role:"cliente"});
    // Welcome email (fire-and-forget, no bloqueamos si falla)
    try{if(cliente?.id){fetch("/api/notify/welcome",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${a.access_token}`},body:JSON.stringify({client_id:cliente.id})}).catch(()=>{});}}catch{}
  }catch{setGErr("Error de conexión.");}setLoading(false);};
  const doLogin=async()=>{setLoading(true);setGErr("");if(!form.email||!form.password){setGErr("Completá email y contraseña");setLoading(false);return;}try{const r=await ac("token?grant_type=password",{email:form.email,password:form.password});if(r.error||r.error_description||r.msg){setGErr("Email o contraseña incorrectos");setLoading(false);return;}const token=r.access_token,uid=r.user.id;const p=await dq("profiles",{token,filters:`?id=eq.${uid}&select=*`});const prof=Array.isArray(p)?p[0]:null;if(prof?.role==="cliente"){let c=await dq("clients",{token,filters:`?auth_user_id=eq.${uid}&select=*`});let cl=Array.isArray(c)?c[0]:null;
      if(!cl&&r.user?.user_metadata){const m=r.user.user_metadata;if(m.first_name){const code=(m.first_name.substring(0,3)+m.last_name.substring(0,3)).toUpperCase();const nc=await dq("clients",{method:"POST",token,body:{auth_user_id:uid,first_name:m.first_name,last_name:m.last_name,whatsapp:m.whatsapp||"",email:r.user.email,tax_condition:m.tax_condition||"ninguna",company_name:m.company_name||null,cuit:m.cuit||null,street:m.street||"",floor_apt:m.floor_apt||null,postal_code:m.postal_code||"",city:m.city||"",province:m.province||"",client_code:code}});cl=Array.isArray(nc)?nc[0]:nc;}}
      setClient(cl);}const ss={token,refresh_token:r.refresh_token,user:r.user};saveSession(ss);setSession(ss);setProfile(prof);}catch{setGErr("Email o contraseña incorrectos. Verificá tus datos e intentá de nuevo.");}setLoading(false);};
  const logout=()=>{clearSession();setSession(null);setClient(null);setProfile(null);setForm(INIT);setStep(0);setView("login");setGErr("");setOkMsg("");};
  if(restoring)return <><ToastStack/><div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:DARK_BG}}><p style={{color:"rgba(255,255,255,0.4)"}}>Cargando...</p></div></>;
  if(session&&profile)return <><ToastStack/><Dashboard profile={profile} client={client} user={session.user} token={session.token} onLogout={logout}/></>;
  if(okMsg)return <><ToastStack/><AuthPage><div style={{textAlign:"center"}}><p style={{fontSize:15,color:"rgba(255,255,255,0.65)",margin:"0 0 24px"}}>{okMsg}</p><PBtn onClick={()=>{setOkMsg("");setView("login");setForm(INIT);setStep(0);}}>Ir a iniciar sesión</PBtn></div></AuthPage></>;
  const ST=["Datos personales","Dirección","Condición fiscal"];
  return <><ToastStack/><AuthPage>
    {view==="login"?<>
      <div style={{textAlign:"center",marginBottom:24}}><h2 style={{fontSize:22,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>Bienvenido</h2><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:0}}>Ingresá con tu cuenta para continuar</p></div><ErrBox msg={gErr}/>
      <Inp label="Email" type="email" value={form.email} onChange={ch("email")} placeholder="tuemail@dominio.com" req/>
      <Inp label="Contraseña" type="password" value={form.password} onChange={ch("password")} placeholder="••••••••" req/>
      <div style={{marginTop:20}}><PBtn onClick={doLogin} disabled={loading}>{loading?"Ingresando...":"Iniciar sesión →"}</PBtn></div>
      <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.4)",marginTop:20,marginBottom:0}}>¿No tenés cuenta? <span onClick={()=>{setView("register");setGErr("");}} style={{color:B.accent,cursor:"pointer",fontWeight:600}}>Registrate</span></p>
    </>:<>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><h2 style={{fontSize:20,fontWeight:600,color:"#fff",margin:0}}>Crear cuenta</h2><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Paso {step+1}/3</span></div>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 16px"}}>{ST[step]}</p><ErrBox msg={gErr}/>
      {step===0&&<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Nombre" value={form.first_name} onChange={ch("first_name")} placeholder="Juan" req error={errors.first_name}/><Inp label="Apellido" value={form.last_name} onChange={ch("last_name")} placeholder="Pérez" req error={errors.last_name}/></div><Inp label="WhatsApp" type="tel" value={form.whatsapp} onChange={ch("whatsapp")} placeholder="+54 9 11 1234-5678" req error={errors.whatsapp}/><Inp label="Email" type="email" value={form.email} onChange={ch("email")} placeholder="tu@email.com" req error={errors.email}/><Inp label="Contraseña" type="password" value={form.password} onChange={ch("password")} placeholder="Mínimo 6 caracteres" req error={errors.password}/><Inp label="Confirmar" type="password" value={form.confirm_password} onChange={ch("confirm_password")} placeholder="Repetí tu contraseña" req error={errors.confirm_password}/></>}
      {step===1&&<><Inp label="Calle y número" value={form.street} onChange={ch("street")} placeholder="Av. Corrientes 1234" req error={errors.street}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Piso/Depto" value={form.floor_apt} onChange={ch("floor_apt")} placeholder="3° B"/><Inp label="CP" value={form.postal_code} onChange={ch("postal_code")} placeholder="1414" req error={errors.postal_code}/></div><Inp label="Localidad" value={form.city} onChange={ch("city")} placeholder="Palermo" req error={errors.city}/><Sel label="Provincia" value={form.province} onChange={ch("province")} options={PR} req ph="Seleccioná"/></>}
      {step===2&&<><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 14px"}}>Condición frente al IVA</p><div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>{TX.map(o=><div key={o.value} onClick={()=>ch("tax_condition")(o.value)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",border:`1.5px solid ${form.tax_condition===o.value?B.accent:"rgba(255,255,255,0.08)"}`,borderRadius:10,cursor:"pointer",background:form.tax_condition===o.value?"rgba(184,149,106,0.1)":"transparent"}}><div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${form.tax_condition===o.value?B.accent:"rgba(255,255,255,0.15)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{form.tax_condition===o.value&&<div style={{width:10,height:10,borderRadius:"50%",background:B.accent}}/>}</div><span style={{fontSize:14,color:"rgba(255,255,255,0.7)"}}>{o.label}</span></div>)}</div>{form.tax_condition==="responsable_inscripto"&&<div style={{padding:14,background:"rgba(255,255,255,0.028)",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)"}}><Inp label="Empresa" value={form.company_name} onChange={ch("company_name")} placeholder="Mi Empresa S.R.L." req error={errors.company_name}/><Inp label="CUIT" value={form.cuit} onChange={ch("cuit")} placeholder="20-12345678-9" req error={errors.cuit}/></div>}</>}
      <div style={{display:"flex",gap:12,marginTop:18}}>{step>0&&<SBtn onClick={()=>setStep(s=>s-1)}>Atrás</SBtn>}<PBtn onClick={step<2?()=>{if(val(step))setStep(s=>s+1);}:doReg} disabled={loading}>{loading?"Creando...":step<2?"Siguiente →":"Crear cuenta"}</PBtn></div>
      <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.4)",marginTop:18,marginBottom:0}}>¿Ya tenés cuenta? <span onClick={()=>{setView("login");setStep(0);setGErr("");}} style={{color:B.accent,cursor:"pointer",fontWeight:600}}>Iniciá sesión</span></p>
    </>}
  </AuthPage></>;
}
