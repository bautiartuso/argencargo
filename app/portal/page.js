"use client";
import { useState, useEffect, useRef } from "react";
import { ToastStack, toast, Skeleton, SkeletonTable, EmptyState, WhatsAppFab, confirmDialog, DialogHost } from "../../lib/ui";
import DatePicker from "../components/DatePicker";
import { printQuotePdf, printClosingPdf } from "../../lib/pdf-templates";
import { applyAntidumpingFloor, calcOpBudget } from "../../lib/calc";
import HolidayBanner from "../components/HolidayBanner";
import { useT, LANGS } from "../../lib/i18n-portal";
import SupportPage from "./components/SupportPage";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const LOGO=`${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
const B={primary:"#1B4F8A",accent:"#4A90D9"};
// Navy Argencargo SÓLIDO + radiales sutiles (idéntico al mockup)
const DARK_BG="radial-gradient(1200px 600px at 80% -10%, rgba(184,149,106,0.10), transparent 60%), radial-gradient(900px 700px at -10% 100%, rgba(96,165,250,0.06), transparent 50%), #0A1628";
const GOLD="#B8956A", GOLD_LIGHT="#E8D098", GOLD_DEEP="#A68456";
const GOLD_GRADIENT="linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";
const GOLD_GLOW="0 0 20px rgba(184,149,106,0.25)";
const GOLD_GLOW_STRONG="0 0 28px rgba(184,149,106,0.4)";
const IC=GOLD_LIGHT; // IC (accent) alias al oro claro
// Aviso único al cliente (se muestra una sola vez; se recuerda en clients.announcement_seen).
// Para un aviso futuro, cambiar la KEY y el contenido → vuelve a aparecer una vez por cliente.
// La clave es un identificador (se guarda en clients.announcement_seen), no texto: va aparte.
const ANUNCIO_KEY="courier_price_drop_2026_06";
// Funcion, no constante: los textos se traducen y una constante de modulo se evalua al
// cargar el archivo, cuando todavia no hay traductor.
const anuncio=(t)=>({
  key:ANUNCIO_KEY,
  emoji:"✈️",
  title:t("promo.title"),
  intro:t("promo.body"),
  rows:[["0 – 60 kg","USD 14 / kg"],["60 – 100 kg","USD 13 / kg"],[t("promo.over100"),"USD 12 / kg"]],
  foot:t("promo.footer"),
});
// Tier system: Silver / Gold / Diamond
const TIERS={
  standard:{label:"Standard",min:0,next:100,color:"#94a3b8",light:"rgba(148,163,184,0.9)",gradient:"linear-gradient(135deg,#475569,#64748b,#475569)",glow:"0 0 18px rgba(100,116,139,0.2)",bonus:0,discount:0,icon:"○"},
  silver:{label:"Silver",min:100,next:500,color:"#C0C0C0",light:"#E8E8E8",gradient:"linear-gradient(135deg,#8A8A8A,#E8E8E8,#8A8A8A)",glow:"0 0 18px rgba(192,192,192,0.28)",bonus:2,discount:10,icon:"🥈"},
  gold:{label:"Gold",min:500,next:1000,color:GOLD,light:GOLD_LIGHT,gradient:GOLD_GRADIENT,glow:GOLD_GLOW,bonus:10,discount:25,icon:"🥇"},
  diamond:{label:"Diamond",min:1000,next:null,color:"#B9F2FF",light:"#E0F7FF",gradient:"linear-gradient(135deg,#6BC5E0,#B9F2FF,#6BC5E0)",glow:"0 0 22px rgba(185,242,255,0.35)",bonus:15,discount:50,icon:"💠"},
};
const getTierInfo=(t)=>TIERS[t||"standard"]||TIERS.standard;
const AC_KEYFRAMES=`@keyframes ac_pulse_gold{0%{box-shadow:0 0 0 0 rgba(184,149,106,.55)}70%{box-shadow:0 0 0 10px rgba(184,149,106,0)}100%{box-shadow:0 0 0 0 rgba(184,149,106,0)}}@keyframes ac_shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes ac_fade_in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}@keyframes acGiPulse{0%,100%{box-shadow:0 0 16px rgba(184,149,106,0.35), inset 0 1px 0 rgba(255,255,255,0.4)}50%{box-shadow:0 0 28px rgba(232,208,152,0.65), inset 0 1px 0 rgba(255,255,255,0.4)}}.ac-gi-pulse{animation:acGiPulse 2.4s ease-in-out infinite}`;
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
// Avisa al admin de un evento del cliente: deja la notificacion in-app (la campanita del panel)
// y dispara el push. Antes ninguno de estos eventos notificaba nada, asi que el admin se enteraba
// solo si entraba a mirar. Es best-effort: si falla el aviso, la accion del cliente ya se guardo.
const avisarAdmin=async(token,{title,body,url="/admin"})=>{
  try{
    const adm=await dq("profiles",{token,filters:"?role=eq.admin&select=id"});
    const ids=(Array.isArray(adm)?adm:[]).map(a=>a.id).filter(Boolean);
    await Promise.all(ids.flatMap(id=>[
      dq("notifications",{method:"POST",token,body:{user_id:id,portal:"admin",title,body,link:url}}).catch(()=>{}),
      fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:id,portal:"admin",title,body,url})}).catch(()=>{}),
    ]));
  }catch(e){console.error("avisar admin",e);}
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
// El valor "ninguna" es el del enum tax_condition en la DB. La etiqueta visible es "Consumidor final"
// (resuelta por i18n via tax.ninguna). Mantenemos el valor interno para no romper la columna enum.
const TX=[{value:"responsable_inscripto",tk:"tax.responsable_inscripto"},{value:"monotributista",tk:"tax.monotributista"},{value:"ninguna",tk:"tax.ninguna"}];
const INIT={first_name:"",last_name:"",whatsapp:"",dni:"",email:"",password:"",confirm_password:"",street:"",floor_apt:"",postal_code:"",city:"",province:"",tax_condition:"ninguna",company_name:"",cuit:""};
const SP={proveedor:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z","M3.27 6.96 12 12.01l8.73-5.05","M12 22.08V12"],warehouse:["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z","M9 22V12h6v10"],documentacion:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"],en_transito_aereo:["M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 3.7 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.5-.6.4-1.1z"],en_transito_maritimo:["M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1","M4 18l-1-5h18l-1 5","M5 13V7h14v6","M9 7V4h6v3"],arribo:["M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z","M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],aduana:["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z","M9 12l2 2 4-4"],liberacion:["M9 11l3 3L22 4","M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],entrega:["M1 3h15v13H1z","M16 8h4l3 3v5h-7V8z","M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z","M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],cerrada:["M22 11.08V12a10 10 0 1 1-5.93-9.14","M22 4 12 14.01l-3-3"]};
const OS=[{k:"proveedor",tk:"stage.proveedor"},{k:"warehouse",tk:"stage.warehouse"},{k:"documentacion",tk:"stage.documentacion"},{k:"preparacion",tk:"stage.preparacion"},{k:"en_transito",tk:"stage.transito"},{k:"arribo",tk:"stage.arribo"},{k:"aduana",tk:"stage.aduana"},{k:"entrega",tk:"stage.entrega"},{k:"cerrada",tk:"stage.cerrada"}];
// Etapas visibles según la vía: el courier aéreo pasa por Mercadería (el cliente la carga) y Preparación
// (la confirmó, Argencargo presupuesta y arma el vuelo); el resto no tiene esos dos pasos.
const stageSteps=(showDoc)=>showDoc?OS:OS.filter(s=>s.k!=="documentacion"&&s.k!=="preparacion");
const stageKeyOf=(status,showDoc,docsConfirmed,lost)=>{if(lost)return "aduana";const m={pendiente:"proveedor",en_deposito_origen:"warehouse",en_preparacion:showDoc?(docsConfirmed?"preparacion":"documentacion"):"warehouse",en_transito:"en_transito",arribo_argentina:"arribo",en_aduana:"aduana",entregada:"entrega",operacion_cerrada:"cerrada"};return m[status]||"proveedor";};
const stLabelOf=(op,t)=>op.status==="en_preparacion"&&op.docs_confirmed_at?t("opStatus.prep_confirmed"):(SM[op.status]?t(SM[op.status].tk):op.status);
const S2S={pendiente:0,en_deposito_origen:1,en_preparacion:2,en_transito:3,arribo_argentina:4,en_aduana:5,entregada:6,operacion_cerrada:7,cancelada:-1};
const SM={pendiente:{tk:"opStatus.pendiente",c:"#94a3b8"},en_deposito_origen:{tk:"opStatus.warehouse_ac",c:"#fbbf24"},en_preparacion:{tk:"opStatus.en_preparacion",c:"#a78bfa"},en_transito:{tk:"opStatus.en_transito",c:"#60a5fa"},arribo_argentina:{tk:"opStatus.arribo_argentina",c:"#818cf8"},en_aduana:{tk:"opStatus.en_aduana",c:"#fb923c"},entregada:{tk:"opStatus.entregada",c:"#22c55e"},operacion_cerrada:{tk:"opStatus.operacion_cerrada",c:"#10b981"},cancelada:{tk:"opStatus.cancelada",c:"#f87171"}};
const CM={aereo_blanco:"channel.aereo_blanco",maritimo_blanco:"channel.maritimo_blanco",maritimo_negro:"channel.maritimo_negro"};
// Nav portal cliente — estructura definida por el usuario, sentence case
const CN_SECTIONS=[
  {section:"Operaciones",skey:"nav.sec.operations",items:[
    {key:"imports",tkey:"nav.imports",label:"Importaciones",p:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z","M3.27 6.96 12 12.01l8.73-5.05","M12 22.08V12"]},
    {key:"deposito",tkey:"nav.deposito",label:"Depósito",p:["M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z","M9 21V12h6v9","M3 9h18"]},
  ]},
  {section:"Herramientas",skey:"nav.sec.tools",items:[
    {key:"calculator",tkey:"nav.calculator",label:"Calculadora",p:["M4 4h16v16H4z","M4 8h16","M8 4v16"]},
    {key:"quotes",tkey:"nav.quotes",label:"Cotizaciones",p:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"]},
  ]},
  {section:"Servicios",skey:"nav.sec.services",items:[
    {key:"payments",tkey:"nav.payments",label:"Pagos internacionales",p:["M12 1v22","M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"]},
    {key:"services",tkey:"nav.services",label:"Soluciones",p:["M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"]},
  ]},
  {section:"Mi cuenta",skey:"nav.sec.account",items:[
    {key:"account",tkey:"nav.account",label:"Cuenta corriente",p:["M3 3h18v18H3z","M3 9h18","M9 21V9"]},
    // Puntos y Referidos removidos del nav (11/06/2026): sistema de puntos/recompensas/referidos desactivado.
    {key:"profile",tkey:"nav.profile",label:"Mi perfil",p:["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"]},
  ]},
];
// Backward-compat: lista plana del nav (usada en bottom-nav mobile y otras refs)
const CN=CN_SECTIONS.flatMap(s=>s.items);
function WorldMap(){const d=[[120,80],[135,85],[150,78],[165,90],[180,85],[200,95],[215,88],[230,92],[250,100],[265,95],[280,105],[300,98],[320,110],[335,105],[350,115],[370,108],[390,120],[410,112],[430,125],[450,118],[470,130],[490,122],[510,135],[530,128],[550,140],[570,132],[590,145],[610,138],[630,150],[140,120],[160,130],[180,125],[200,140],[220,135],[240,145],[260,138],[280,150],[300,142],[320,155],[340,148],[360,158],[380,152],[400,162],[420,155],[440,165],[460,158],[480,170],[500,162],[520,175],[540,168],[560,180],[580,172],[600,185],[620,178]];const l=[[200,95,450,118],[300,98,520,135],[180,125,400,162],[280,150,500,208],[350,115,570,132]];return <svg width="100%" height="100%" viewBox="0 0 750 320" preserveAspectRatio="xMidYMid slice" style={{position:"absolute",inset:0,opacity:0.05,pointerEvents:"none"}}>{l.map((v,i)=><line key={i} x1={v[0]} y1={v[1]} x2={v[2]} y2={v[3]} stroke="#4A90D9" strokeWidth="0.5" opacity="0.4"/>)}{d.map((v,i)=><circle key={i} cx={v[0]} cy={v[1]} r={1.5} fill="#4A90D9" opacity="0.5"/>)}</svg>;}
// Cuando type="decimal", usamos type=text + inputMode=decimal: muestra el keyboard numérico en mobile
// y permite tipear tanto coma como punto como separador (con type=number puro, iOS rechaza la coma).
function Inp({label,type="text",value,onChange,placeholder,req,error}){
  const isDecimal=type==="decimal";
  const inputType=isDecimal?"text":type;
  const inputMode=isDecimal?"decimal":undefined;
  return <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{req&&<span style={{color:"#ff6b6b"}}> *</span>}</label><input type={inputType} inputMode={inputMode} value={value||""} onChange={e=>{
    // Si es decimal: aceptar solo dígitos + máximo un separador (. o ,). Guardamos lo que tipeó (preserva la coma visible).
    if(isDecimal){const v=e.target.value;if(v!==""&&!/^\d*[.,]?\d*$/.test(v))return;onChange(v);}
    else onChange(e.target.value);
  }} placeholder={placeholder} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:`1px solid ${error?"#ff6b6b":"rgba(255,255,255,0.12)"}`,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none",transition:"all 180ms"}} onFocus={e=>{if(!error){e.target.style.borderColor=GOLD;e.target.style.boxShadow="0 0 0 3px rgba(184,149,106,0.18)";e.target.style.background="rgba(255,255,255,0.09)";}}} onBlur={e=>{e.target.style.borderColor=error?"#ff6b6b":"rgba(255,255,255,0.12)";e.target.style.boxShadow="none";e.target.style.background="rgba(255,255,255,0.06)";}}/>{error&&<p style={{fontSize:11,color:"#ff6b6b",margin:"4px 0 0"}}>{error}</p>}</div>;
}
// Helper: parsea string (con coma o punto) a number, tolerante a vacío/NaN. Usar en toda la calc.
const toN=(v)=>{if(v===""||v==null)return 0;const n=Number(String(v).replace(",","."));return isNaN(n)?0:n;};
function Sel({label,value,onChange,options,req,ph}){return <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{req&&<span style={{color:"#ff6b6b"}}> *</span>}</label><select value={value} onChange={e=>onChange(e.target.value)} onFocus={e=>{e.target.style.borderColor=GOLD;e.target.style.boxShadow="0 0 0 3px rgba(184,149,106,0.18)";}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";e.target.style.boxShadow="none";}} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:value?"#fff":"rgba(255,255,255,0.45)",outline:"none",transition:"all 180ms",cursor:"pointer"}}>{ph&&<option value="" style={{background:"#0F1F3A"}}>{ph}</option>}{options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value} style={{background:"#0F1F3A",color:"#fff"}}>{typeof o==="string"?o:o.label}</option>)}</select></div>;}
function PBtn({children,onClick,disabled,variant="gold"}){
  const [h,setH]=useState(false);
  const isGold=variant==="gold"&&!disabled;
  return <button onClick={onClick} disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:700,border:isGold?`1px solid ${GOLD_DEEP}`:"none",borderRadius:10,cursor:disabled?"not-allowed":"pointer",background:disabled?"rgba(255,255,255,0.08)":(isGold?GOLD_GRADIENT:`linear-gradient(135deg,${B.accent},${B.primary})`),color:disabled?"rgba(255,255,255,0.45)":(isGold?"#0A1628":"#fff"),letterSpacing:"0.02em",transition:"all 180ms cubic-bezier(0.4,0,0.2,1)",boxShadow:disabled?"none":(isGold?(h?GOLD_GLOW_STRONG:GOLD_GLOW):"0 4px 14px rgba(184,149,106,0.25)"),transform:h&&!disabled?"translateY(-1px)":"none",backgroundSize:isGold?"200% 100%":undefined,backgroundPosition:isGold?(h?"100% 0":"0 0"):undefined}}>{children}</button>;
}
function SBtn({children,onClick}){return <button onClick={onClick} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:500,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.6)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,cursor:"pointer"}}>{children}</button>;}
function ErrBox({msg}){return msg?<div style={{padding:"10px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:10,fontSize:13,color:"#ff6b6b",marginBottom:14}}>{msg}</div>:null;}
function formatDate(d){if(!d)return"—";const s=String(d).slice(0,10);if(s.match(/^\d{4}-\d{2}-\d{2}$/)){const[y,m,day]=s.split("-");return new Date(y,m-1,day).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}
function AuthPage({children}){
  const {t,lang,setLang}=useT();
  return <div style={{minHeight:"100vh",display:"flex",position:"relative",overflow:"hidden",fontFamily:"'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif"}}>
  <style dangerouslySetInnerHTML={{__html:AC_KEYFRAMES}}/>
  <div style={{position:"absolute",inset:0,background:DARK_BG}}/>
  <div style={{position:"absolute",inset:0}}><WorldMap/></div>
  {/* Selector de idioma flotante — desktop top-right, mobile bottom centered */}
  <div className="ac-lang-switcher" style={{position:"absolute",top:18,right:18,zIndex:10,display:"flex",gap:6,background:"rgba(10,22,40,0.75)",backdropFilter:"blur(14px)",padding:"6px 8px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)"}}>
    {LANGS.map(L=><button key={L.code} onClick={()=>setLang(L.code)} title={L.label} style={{padding:"4px 8px",fontSize:14,background:lang===L.code?"rgba(184,149,106,0.25)":"transparent",border:"none",borderRadius:6,cursor:"pointer"}}>{L.flag}</button>)}
  </div>
  {/* Glows decorativos */}
  <div style={{position:"absolute",top:"-15%",right:"-8%",width:500,height:500,background:"radial-gradient(circle, rgba(184,149,106,0.14) 0%, transparent 70%)",pointerEvents:"none",zIndex:1}}/>
  <div style={{position:"absolute",bottom:"-15%",left:"-8%",width:540,height:540,background:"radial-gradient(circle, rgba(184,149,106,0.10) 0%, transparent 70%)",pointerEvents:"none",zIndex:1}}/>
  <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1rem",position:"relative",zIndex:3}}>
    <div style={{maxWidth:420,width:"100%",animation:"ac_fade_in 400ms ease-out"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <img src={LOGO} alt="AC" style={{width:230,height:"auto",filter:"drop-shadow(0 4px 24px rgba(184,149,106,0.28))"}}/>
        <p style={{fontSize:11,color:GOLD_LIGHT,margin:"14px 0 0",letterSpacing:"0.25em",textTransform:"uppercase",fontWeight:600}}>{t("home.tagline")}</p>
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
// Progress steps estilo mockup: dots limpios (sin íconos), líneas conectoras gold cuando done,
// dot relleno gold para done, dot pulsante gold gradient para current, dot vacío para pending.
function OpProgress({status,isAereo,onActionClick,isGI,channel,hasItems,lostInCustoms,docsConfirmed}){
  const {t}=useT();
  const showDoc=!isGI&&channel==="aereo_blanco";
  const STEPS=stageSteps(showDoc);
  const key=stageKeyOf(status,showDoc,!!docsConfirmed,!!lostInCustoms);
  const si=STEPS.findIndex(s=>s.k===key);
  const isDoc=status==="en_preparacion"&&showDoc&&!docsConfirmed;
  const n=STEPS.length;
  const pct=n>1?(si/(n-1))*100:0;
  const cur=STEPS[si]||STEPS[0];
  const next=STEPS[si+1]||null;
  const done=si>=n-1;
  const curLabel=isDoc?(hasItems?t("op.confirmGoodsBtn"):t("op.loadGoodsBtn")):t(cur.tk);
  return <div style={{padding:"16px 0 12px",borderTop:"1px solid rgba(255,255,255,0.06)",borderBottom:"1px solid rgba(255,255,255,0.06)",margin:"12px 0 14px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,flexWrap:"wrap",marginBottom:12}}>
      <span onClick={isDoc&&onActionClick?(e)=>{e.stopPropagation();onActionClick();}:undefined} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"5px 13px",borderRadius:999,background:isDoc?"rgba(251,191,36,0.12)":"rgba(184,149,106,0.10)",border:`1px solid ${isDoc?"rgba(251,191,36,0.4)":"rgba(184,149,106,0.35)"}`,cursor:isDoc&&onActionClick?"pointer":"default"}}>
        <span className={done?"":"ac-live-dot"} style={{width:7,height:7,borderRadius:"50%",background:isDoc?"#fbbf24":GOLD_LIGHT,display:"inline-block"}}/>
        <span style={{fontSize:12.5,fontWeight:700,color:isDoc?"#fbbf24":GOLD_LIGHT,letterSpacing:"0.02em"}}>{curLabel}</span>
      </span>
      <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontVariantNumeric:"tabular-nums"}}>
        Etapa {si+1} de {n}{next?<span> {t("op.then")} <b style={{color:"rgba(255,255,255,0.6)",fontWeight:600}}>{t(next.tk)}</b></span>:null}
      </span>
    </div>
    <div style={{position:"relative",height:26}}>
      <div style={{position:"absolute",left:0,right:0,top:11,height:4,borderRadius:999,background:"rgba(255,255,255,0.07)"}}/>
      <div style={{position:"absolute",left:0,top:11,height:4,borderRadius:999,width:`${pct}%`,background:`linear-gradient(90deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,boxShadow:"0 0 10px rgba(232,208,152,0.35)",transition:"width 400ms ease"}}/>
      {STEPS.map((st,i2)=>{
        const x=n>1?(i2/(n-1))*100:0;
        const d=i2<si,c=i2===si;
        return <div key={st.k} title={t(st.tk)} style={{position:"absolute",left:`${x}%`,top:13,transform:"translate(-50%,-50%)",width:c?13:d?9:8,height:c?13:d?9:8,borderRadius:"50%",background:d?GOLD:c?GOLD_LIGHT:"#0E1B30",border:d?"none":c?"none":"1.5px solid rgba(255,255,255,0.2)",boxShadow:c?"0 0 0 4px rgba(232,208,152,0.18), 0 0 12px rgba(232,208,152,0.4)":"none",zIndex:1,transition:"all 200ms"}}/>;
      })}
    </div>
    <div className="op-progress" style={{display:"flex",marginTop:6}}>
      {STEPS.map((st,i2)=>{
        const d=i2<si,c=i2===si;
        return <span key={st.k} style={{flex:1,fontSize:10.5,fontWeight:c?700:500,color:c?GOLD_LIGHT:d?"rgba(255,255,255,0.6)":"rgba(255,255,255,0.28)",textAlign:i2===0?"left":i2===n-1?"right":"center",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t(st.tk)}</span>;
      })}
    </div>
  </div>;
}
// ═══ DEPÓSITO (13/09/2026) ═══
// Los bultos llegan al depósito sin operación. El cliente ve lo que le llegó, elige cuáles
// viajan juntos y crea la importación; puede armar varias. El agente no interviene.
function DepositoView({pkgs,token,client,onCreated}){
  const {t}=useT();
  const [sel,setSel]=useState([]);const [open,setOpen]=useState(null);const [creating,setCreating]=useState(false);
  const HAIR="1px solid rgba(255,255,255,0.13)";const SKY="#8CC8F5";
  const PANEL={background:"linear-gradient(180deg, rgba(13,24,45,0.96), rgba(8,16,32,0.96))",border:HAIR,borderRadius:18,padding:"24px 26px",boxShadow:"0 16px 40px rgba(0,0,0,0.3)"};
  const LBL={fontSize:10.5,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:SKY,margin:0};
  const f2=n=>Number(n||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const fd=d=>{const x=new Date(d);return `${String(x.getDate()).padStart(2,"0")}/${String(x.getMonth()+1).padStart(2,"0")}/${String(x.getFullYear()).slice(2)}`;};
  const m=(p)=>{const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);const bruto=gw*q;const vol=l&&w&&h?((l*w*h)/5000)*q:0;const m3=l&&w&&h?((l*w*h)/1e6)*q:0;return{bruto,vol,m3,fact:Math.max(bruto,vol),dims:l&&w&&h?`${l}×${w}×${h} cm`:"—"};};
  const chosen=pkgs.filter(p=>sel.includes(p.id));
  const tot=chosen.reduce((a,p)=>{const x=m(p);a.bruto+=x.bruto;a.vol+=x.vol;a.m3+=x.m3;a.fact+=x.fact;return a;},{bruto:0,vol:0,m3:0,fact:0});
  const toggle=id=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const allSel=pkgs.length>0&&sel.length===pkgs.length;
  const crear=async()=>{if(!sel.length||creating)return;
    if(!await confirmDialog(`¿Creamos una importación con ${sel.length===1?t("dep.onePackage"):`estos ${sel.length} bultos`}? El paso siguiente es cargar la mercadería.`,{confirmText:t("dep.createImport")}))return;
    setCreating(true);
    try{const r=await fetch("/api/portal/crear-importacion",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({package_ids:sel,client_id:client?.id})});const d=await r.json().catch(()=>null);
      if(!r.ok||!d?.op){toast(d?.error==="bultos_invalidos"?t("dep.errGone"):t("dep.errCreate"),"error");setCreating(false);return;}
      toast(`Importación ${d.op.operation_code} creada`,"success");setSel([]);onCreated?.(d.op);
    }catch(e){toast(t("dep.errCreate"),"error");}
    setCreating(false);};
  if(pkgs.length===0)return <div style={{...PANEL,textAlign:"center",padding:"46px 24px"}}>
    <p style={{fontSize:30,margin:"0 0 10px"}}>📦</p>
    <p style={{fontSize:15.5,fontWeight:800,color:"#fff",margin:"0 0 8px",letterSpacing:"0.04em"}}>{t("dep.empty")}</p>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.65)",margin:"0 auto",lineHeight:1.6,maxWidth:540}}>{t("dep.emptyDesc")}</p>
  </div>;
  const COLS="30px 96px minmax(0,1fr) 84px 130px 104px 104px 112px";
  return <div style={PANEL}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:16}}>
      <div>
        <h3 style={{fontSize:13,fontWeight:800,color:"#fff",margin:0,letterSpacing:"0.1em",textTransform:"uppercase"}}>{t("dep.title")} <span style={{color:SKY,marginLeft:6}}>{pkgs.length}</span></h3>
        <p style={{fontSize:12.5,color:"rgba(255,255,255,0.62)",margin:"4px 0 0"}}>{t("dep.subtitle")}</p>
      </div>
      <button onClick={()=>setSel(allSel?[]:pkgs.map(p=>p.id))} style={{padding:"8px 14px",fontSize:12,fontWeight:700,borderRadius:9,border:HAIR,background:"rgba(255,255,255,0.06)",color:"#fff",cursor:"pointer"}}>{allSel?t("dep.deselectAll"):t("dep.selectAll")}</button>
    </div>
    <div className="dep-head" style={{display:"grid",gridTemplateColumns:COLS,gap:10,padding:"0 12px 8px"}}>{["",t("imports.packages"),"Tracking",t("dep.arrived"),t("calc.dimensions"),t("imports.grossWeight"),t("dep.volumetric"),t("dep.scanTitle")].map((h,i)=><p key={i} style={{...LBL,textAlign:i>=3?"center":"left"}}>{h}</p>)}</div>
    {pkgs.map((p,i)=>{const on=sel.includes(p.id);const x=m(p);const hot=x.vol>x.bruto;
      return <div key={p.id} style={{marginBottom:8,borderRadius:12,border:`1px solid ${on?"rgba(232,208,152,0.6)":"rgba(255,255,255,0.12)"}`,background:on?"rgba(184,149,106,0.1)":"rgba(255,255,255,0.04)",transition:"border-color 150ms, background 150ms"}}>
        <div className="dep-row" onClick={()=>toggle(p.id)} style={{display:"grid",gridTemplateColumns:COLS,gap:10,alignItems:"center",padding:"12px",cursor:"pointer"}}>
          <span style={{width:20,height:20,borderRadius:6,border:`2px solid ${on?GOLD_LIGHT:"rgba(255,255,255,0.35)"}`,background:on?GOLD_GRADIENT:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#0A1628",flexShrink:0}}>{on?"✓":""}</span>
          <span style={{fontSize:13,fontWeight:800,color:"#fff",whiteSpace:"nowrap"}}>{p.origin==="USA"?"🇺🇸":"🇨🇳"} Bulto {i+1}</span>
          <span className="dep-track" style={{fontFamily:"'JetBrains Mono','SF Mono',monospace",fontSize:12,color:"rgba(255,255,255,0.8)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={p.national_tracking||""}>{p.national_tracking||"—"}</span>
          <span style={{fontSize:12.5,color:SKY,fontWeight:600,textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{fd(p.created_at)}</span>
          <span style={{fontSize:12.5,color:"#fff",textAlign:"center",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{x.dims}</span>
          <span style={{fontSize:13,fontWeight:700,color:!hot&&x.bruto>0?GOLD_LIGHT:"#fff",textAlign:"center",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{x.bruto>0?`${f2(x.bruto)} kg`:"—"}</span>
          <span style={{fontSize:13,fontWeight:700,color:hot?GOLD_LIGHT:"#fff",textAlign:"center",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{x.vol>0?`${f2(x.vol)} kg`:"—"}</span>
          <span style={{textAlign:"center"}}>{p.photo_url
            ?<button onClick={e=>{e.stopPropagation();setOpen(p.id);}} style={{padding:"6px 12px",fontSize:11.5,fontWeight:700,borderRadius:8,border:"1px solid rgba(140,200,245,0.6)",background:"rgba(140,200,245,0.14)",color:SKY,cursor:"pointer",whiteSpace:"nowrap"}}>{t("dep.viewScan")}</button>
            :<span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{t("dep.noPhoto")}</span>}</span>
        </div>
      </div>;})}
    {open&&(()=>{const p=pkgs.find(x=>x.id===open);if(!p?.photo_url)return null;const idx=pkgs.indexOf(p);
      return <div onClick={()=>setOpen(null)} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(4,9,20,0.82)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg, #16243E, #101B31)",border:"1px solid rgba(255,255,255,0.14)",borderRadius:16,padding:14,maxWidth:"min(560px, 92vw)",boxShadow:"0 30px 70px rgba(0,0,0,0.6)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:"#fff"}}>Escaneo · Bulto {idx+1}<span style={{marginLeft:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:SKY,textTransform:"none",letterSpacing:0}}>{p.national_tracking||""}</span></span>
            <button onClick={()=>setOpen(null)} style={{height:30,padding:"0 12px",fontSize:12,fontWeight:700,borderRadius:8,border:HAIR,background:"rgba(255,255,255,0.07)",color:"#fff",cursor:"pointer"}}>Cerrar</button>
          </div>
          <img src={p.photo_url} alt={t("dep.scanTitle")} style={{display:"block",maxWidth:"100%",maxHeight:"62vh",borderRadius:10,border:HAIR,objectFit:"contain"}}/>
        </div>
      </div>;})()}
    <div style={{display:"flex",alignItems:"stretch",gap:10,flexWrap:"wrap",marginTop:16,paddingTop:16,borderTop:HAIR}}>
      {[["Bultos",String(sel.length),false],["Peso bruto",`${f2(tot.bruto)} kg`,false],[t("dep.volumetric"),`${f2(tot.vol)} kg`,false],["Facturable",`${f2(tot.fact)} kg`,true],["Volumen",`${tot.m3.toFixed(3)} m³`,false]].map(([l,v,hot])=>
        <div key={l} style={{flex:"1 1 110px",padding:"9px 12px",borderRadius:10,border:`1px solid ${hot?"rgba(232,208,152,0.45)":"rgba(255,255,255,0.14)"}`,background:hot?"rgba(184,149,106,0.12)":"rgba(255,255,255,0.04)"}}><p style={{...LBL,color:hot?GOLD_LIGHT:SKY}}>{l}</p><p style={{margin:"3px 0 0",fontSize:15,fontWeight:800,color:hot?GOLD_LIGHT:"#fff",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{v}</p></div>)}
      <button onClick={crear} disabled={!sel.length||creating} style={{flex:"1 1 240px",minHeight:54,fontSize:13,fontWeight:900,letterSpacing:"0.07em",textTransform:"uppercase",borderRadius:12,border:`1px solid ${GOLD_DEEP}`,cursor:!sel.length||creating?"not-allowed":"pointer",opacity:!sel.length?0.45:1,background:GOLD_GRADIENT,color:"#0A1628",boxShadow:sel.length?GOLD_GLOW:"none"}}>{creating?"Creando…":`Crear importación${sel.length?` · ${sel.length} bulto${sel.length!==1?"s":""}`:""} →`}</button>
    </div>
  </div>;
}

function OperationsList({ops,onSelect,client,token,onReload,itemsByOp={},pmtsByOp={},cliPmtsByOp={},mCargo=[]}){
  const {t}=useT();
  // Orden: más cerca de la entrega primero. ETA asc como desempate (antes = más urgente).
  const STATUS_WEIGHT={entregada:8,en_aduana:7,arribo_argentina:6,en_transito:5,en_preparacion:4,en_deposito_origen:3,pendiente:2,operacion_cerrada:0,cancelada:0};
  const sortByProximity=(a,b)=>{const wa=STATUS_WEIGHT[a.status]??-1,wb=STATUS_WEIGHT[b.status]??-1;if(wa!==wb)return wb-wa;const ea=a.eta?String(a.eta).slice(0,10):"9999-12-31";const eb=b.eta?String(b.eta).slice(0,10):"9999-12-31";if(ea!==eb)return ea.localeCompare(eb);return String(b.created_at||"").localeCompare(String(a.created_at||""));};
  const act=ops.filter(o=>o.status!=="operacion_cerrada"&&o.status!=="cancelada").sort(sortByProximity);
  const past=ops.filter(o=>o.status==="operacion_cerrada"||o.status==="cancelada").sort((a,b)=>String(b.closed_at||b.updated_at||b.created_at||"").localeCompare(String(a.closed_at||a.updated_at||a.created_at||"")));
  const name=client?`${client.first_name} ${client.last_name}`:"";
  const code=client?.client_code||"";
  const stats=[{l:t("home.totalImports"),v:ops.length,c:"#fff"},{l:t("home.inProgress"),v:act.length,c:GOLD_LIGHT},{l:t("home.completed"),v:past.length,c:"#22c55e"},{l:t("home.reports"),v:null,btn:true}];
  const gd=(o)=>{const d=(o.description||"").trim();if(!d)return o.channel?.includes("maritimo")?t("ol.seaCargo"):o.channel?.includes("aereo")?t("ol.airCargo"):t("ol.import");return d.length>60?(t("imports.consolidated")||"Consolidado"):d;};
  // renderOp con clases .ac-cli-* del mockup (cards alargadas, espaciosas)
  // ── Lista de importaciones (rediseño 13/09/2026): una línea por importación, sin tarjetas ──
  const HAIR="1px solid rgba(255,255,255,0.13)";const SKY="#8CC8F5";
  const LBL={fontSize:10.5,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:SKY,margin:0};
  const usd=v=>`USD ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fShort=d=>{if(!d)return "—";const x=new Date(String(d).length<=10?d+"T12:00:00":d);return `${String(x.getDate()).padStart(2,"0")}/${String(x.getMonth()+1).padStart(2,"0")}/${String(x.getFullYear()).slice(2)}`;};
  const saldoDe=(op)=>{const bt=Number(op.budget_total||0);
    if(op.lost_in_customs_at)return{txt:"USD 0,00",tone:"ok",l:t("ol.noBalance")};
    if(op.is_collected||op.status==="operacion_cerrada")return{txt:bt>0?usd(bt):"—",tone:"ok",l:"Abonado"};
    if(bt<=0)return{txt:"Pendiente",tone:"muted",l:"A abonar"};
    const pmtTot=Number(pmtsByOp[op.id]||0);const ant=Number(op.total_anticipos||0);const cliPaid=Number(cliPmtsByOp[op.id]||0);
    const saldo=Math.max(0,bt-cliPaid+Math.max(0,pmtTot-ant));
    if(saldo<0.01)return{txt:usd(bt),tone:"ok",l:"Abonado"};
    return{txt:usd(saldo),tone:"due",l:"Falta abonar"};};
  const accionDe=(op)=>{const isGI=op.service_type==="gestion_integral";const hasItems=(itemsByOp[op.id]||0)>0;
    if(op.lost_in_customs_at)return{c:"#f87171",t:t("ol.heldCustoms")};
    if(!isGI&&op.channel==="aereo_blanco"&&["en_deposito_origen","en_preparacion"].includes(op.status)&&!op.docs_confirmed_at)return{c:GOLD_LIGHT,t:hasItems?t("opq.confirmGoodsShort"):t("opq.loadGoodsShort"),strong:true};
    if(op.status==="en_preparacion"&&Number(op.budget_total||0)<=0)return{c:SKY,t:t("ol.inPreparation")};
    if(op.status==="entregada")return{c:"#4ade80",t:t("ol.readyPickup")};
    // Mientras la carga viaja el chip dice DONDE esta, no "saldo pendiente" (16/09/2026): estos
    // tres estados no tenian caso propio y caian al fallback del saldo, asi que una op que recien
    // habia despegado aparecia como si el cliente estuviera atrasado con un pago. El saldo se sigue
    // viendo en la columna A ABONAR; el chip queda para el estado operativo.
    if(SM[op.status]&&["en_transito","arribo_argentina","en_aduana"].includes(op.status))return{c:SM[op.status].c,t:t(SM[op.status].tk)};
    const s=saldoDe(op);if(s.tone==="due"&&!["operacion_cerrada","cancelada"].includes(op.status))return{c:GOLD_LIGHT,t:"Saldo pendiente"};
    return null;};
  const COLS="150px minmax(0,1.5fr) 200px 88px 150px 34px";
  const head=<div className="ol-head" style={{display:"grid",gridTemplateColumns:COLS,gap:12,padding:"0 16px 8px"}}>{[t("ol.import"),t("ol.colGoods"),t("ol.colStage"),"ETA",t("ol.colDue"),""].map((h,i)=><p key={i} style={{...LBL,textAlign:i>=2?"center":"left"}}>{h}</p>)}</div>;
  const renderRow=(op)=>{const isGI=op.service_type==="gestion_integral";const showDoc=!isGI&&op.channel==="aereo_blanco";const steps=stageSteps(showDoc);const key=stageKeyOf(op.status,showDoc,!!op.docs_confirmed_at,!!op.lost_in_customs_at);const si=Math.max(0,steps.findIndex(s=>s.k===key));const cur=steps[si]||steps[0];
    const done=["operacion_cerrada","cancelada"].includes(op.status);const s=saldoDe(op);const ac=accionDe(op);
    return <div key={op.id} onClick={()=>onSelect(op)} className="ol-row" style={{display:"grid",gridTemplateColumns:COLS,gap:12,alignItems:"center",padding:"14px 16px",marginBottom:8,borderRadius:13,border:ac?.strong?"1px solid rgba(232,208,152,0.5)":HAIR,background:"linear-gradient(180deg, rgba(13,24,45,0.96), rgba(8,16,32,0.96))",boxShadow:"0 10px 26px rgba(0,0,0,0.25)",cursor:"pointer",opacity:done?0.75:1,transition:"border-color 150ms"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(140,200,245,0.55)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=ac?.strong?"rgba(232,208,152,0.5)":"rgba(255,255,255,0.13)";}}>
      <div style={{minWidth:0}}>
        <p style={{margin:0,fontSize:14,fontWeight:800,color:"#fff",fontFamily:"'JetBrains Mono','SF Mono',monospace",letterSpacing:"0.04em"}}>{op.operation_code}</p>
        <p style={{margin:"4px 0 0",fontSize:11,color:"rgba(255,255,255,0.55)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{op.origin==="USA"?"🇺🇸":"🇨🇳"} {op.channel?t("channel."+op.channel).replace(" Comercial","").replace(" Carga LCL/FCL",""):"—"}{isGI?" · GI":""}</p>
      </div>
      <div className="ol-desc" style={{minWidth:0}}>
        <p style={{margin:0,fontSize:14,fontWeight:700,color:op.description?"#fff":"rgba(255,255,255,0.45)",fontStyle:op.description?"normal":"italic",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{gd(op)}</p>
        {ac&&<span style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:5,fontSize:10.5,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",padding:"3px 9px",borderRadius:999,color:ac.c,background:`${ac.c}1c`,border:`1px solid ${ac.c}66`}}>{ac.strong&&<span className="ac-live-dot" style={{width:6,height:6,borderRadius:"50%",background:ac.c,display:"inline-block"}}/>}{ac.t}{ac.strong?" →":""}</span>}
      </div>
      <div className="ol-stage" style={{textAlign:"center"}}>
        <div style={{display:"flex",justifyContent:"center",gap:4,marginBottom:5}}>{steps.map((st,i)=><span key={st.k} title={t(st.tk)} style={{width:i===si?18:9,height:5,borderRadius:999,background:i<si?GOLD:i===si?GOLD_LIGHT:"rgba(255,255,255,0.14)",boxShadow:i===si?"0 0 8px rgba(232,208,152,0.55)":"none",transition:"width 200ms"}}/>)}</div>
        <p style={{margin:0,fontSize:11.5,fontWeight:700,color:op.lost_in_customs_at?"#f87171":GOLD_LIGHT,whiteSpace:"nowrap"}}>{op.lost_in_customs_at?t("ol.heldCustoms"):t(cur.tk)}<span style={{color:"rgba(255,255,255,0.4)",fontWeight:600}}> · {si+1}/{steps.length}</span></p>
      </div>
      <p className="ol-eta" style={{margin:0,textAlign:"center",fontSize:12.5,fontWeight:700,color:op.eta?SKY:"rgba(255,255,255,0.35)",fontVariantNumeric:"tabular-nums"}}>{fShort(op.eta)}</p>
      <div className="ol-saldo" style={{textAlign:"center"}}>
        <p style={{margin:0,fontSize:14,fontWeight:800,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap",color:s.tone==="ok"?"#4ade80":s.tone==="due"?GOLD_LIGHT:"rgba(255,255,255,0.5)"}}>{s.txt}</p>
        <p style={{margin:"2px 0 0",fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:"rgba(255,255,255,0.45)"}}>{s.l}</p>
      </div>
      <span className="ol-arrow" style={{textAlign:"right",color:SKY,fontSize:18,fontWeight:700}}>→</span>
    </div>;};
  const secTitle=(l,n,muted)=><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,margin:"6px 0 12px"}}><h2 style={{fontSize:14,fontWeight:800,color:muted?"rgba(255,255,255,0.7)":"#fff",margin:0,letterSpacing:"0.14em",textTransform:"uppercase"}}>{l}</h2><span style={{fontSize:12,fontWeight:800,padding:"2px 9px",borderRadius:999,color:muted?"rgba(255,255,255,0.55)":SKY,background:muted?"rgba(255,255,255,0.06)":"rgba(140,200,245,0.14)"}}>{n}</span></div>;
  return <div>
    <MaritimeCargoSection cargo={mCargo}/>
    {secTitle(t("ol.inProgress"),act.length)}
    {act.length>0?<>{head}{act.map(renderRow)}</>:<p style={{textAlign:"center",color:"rgba(255,255,255,0.5)",padding:"1.6rem 0",fontSize:13}}>{t("ol.emptyActive")}</p>}
    {past.length>0&&<div style={{marginTop:30}}>{secTitle(t("ol.finished"),past.length,true)}{head}{past.map(renderRow)}</div>}
    {ops.length===0&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.5)",padding:"2rem 0",fontSize:13}}>{t("ol.emptyActiveDesc")}</p>}
  </div>;
}

// === PDF INVOICE READER === (compartido entre cotización y declaración)
// Carga pdf.js desde CDN (no agrega al bundle), renderiza páginas a imagen,
// llama /api/parse-invoice-pdf, devuelve items detectados para confirmar.
let _pdfjsPromise=null;
function loadPdfJs(){
  if(_pdfjsPromise)return _pdfjsPromise;
  _pdfjsPromise=new Promise((resolve,reject)=>{
    if(typeof window==="undefined")return reject(new Error("ssr"));
    if(window.pdfjsLib)return resolve(window.pdfjsLib);
    // UMD build (no ESM) — expone window.pdfjsLib
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>{
      if(!window.pdfjsLib)return reject(new Error("pdfjsLib not on window"));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    s.onerror=()=>reject(new Error("pdf.js failed to load"));
    document.head.appendChild(s);
  });
  return _pdfjsPromise;
}

function PdfInvoiceReader({onItemsConfirmed,onCancel,labels={}}){
  const {t}=useT();
  const L={
    upload_pdf:labels.upload_pdf||"Subir PDF",
    drop_or_pick:labels.drop_or_pick||t("pdf.drop"),
    processing:labels.processing||t("pdf.reading"),
    rendering:labels.rendering||t("pdf.processing"),
    extracting:labels.extracting||t("pdf.detecting"),
    no_items:labels.no_items||t("pdf.none"),
    confirm_items:labels.confirm_items||t("pdf.review"),
    confirm:labels.confirm||"Confirmar e importar",
    cancel:labels.cancel||"Cancelar",
    select_all:labels.select_all||t("dep.selectAll"),
    deselect_all:labels.deselect_all||"Deseleccionar",
  };
  const [stage,setStage]=useState("idle"); // idle | rendering | extracting | review | error
  const [error,setError]=useState("");
  const [items,setItems]=useState([]);
  const [selected,setSelected]=useState({});
  const fileRef=useRef(null);
  const [pasteHint,setPasteHint]=useState(false);

  // Soporte para pegar archivo desde portapapeles (Cmd/Ctrl+V) cuando la zona de drop está visible.
  useEffect(()=>{
    if(stage!=="idle")return;
    const onPaste=(e)=>{
      const items=e.clipboardData?.items;
      if(!items||items.length===0)return;
      for(const it of items){
        if(it.kind==="file"){
          const f=it.getAsFile();
          if(f){
            e.preventDefault();
            setPasteHint(true);
            setTimeout(()=>setPasteHint(false),900);
            handleFile(f);
            return;
          }
        }
      }
    };
    window.addEventListener("paste",onPaste);
    return ()=>window.removeEventListener("paste",onPaste);
  },[stage]);

  // Convierte un File de imagen (jpg/png/heic/webp) a dataURL JPEG con un cap de tamaño
  // razonable. La API de OCR espera images como dataURL (mismo formato que PDF rendered).
  const imageFileToDataUrl=(file)=>new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        // Reescalar si es muy grande (max 2400px del lado más largo) — OCR mejora con menos ruido
        const MAX=2400;const w=img.naturalWidth,h=img.naturalHeight;
        const scale=Math.min(1,MAX/Math.max(w,h));
        const cw=Math.round(w*scale),ch=Math.round(h*scale);
        const canvas=document.createElement("canvas");canvas.width=cw;canvas.height=ch;
        const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,cw,ch);
        resolve(canvas.toDataURL("image/jpeg",0.88));
      };
      img.onerror=reject;img.src=reader.result;
    };
    reader.onerror=reject;reader.readAsDataURL(file);
  });

  const handleFile=async(file)=>{
    if(!file)return;
    const name=file.name.toLowerCase();
    const isPdf=name.endsWith(".pdf")||file.type==="application/pdf";
    const isImage=file.type.startsWith("image/")||/\.(jpe?g|png|webp|heic|heif)$/i.test(name);
    if(!isPdf&&!isImage){setError(t("pdf.uploadOne"));return;}
    setError("");setStage("rendering");
    try{
      let images=[];
      if(isImage){
        // Imagen suelta: una sola "página"
        const dataUrl=await imageFileToDataUrl(file);
        images=[dataUrl];
      } else {
        const pdfjs=await loadPdfJs();
        const arrayBuffer=await file.arrayBuffer();
        const pdf=await pdfjs.getDocument({data:arrayBuffer}).promise;
        const pages=Math.min(pdf.numPages,10);
        for(let i=1;i<=pages;i++){
          const page=await pdf.getPage(i);
          const vp=page.getViewport({scale:2}); // 2x for better OCR
          const canvas=document.createElement("canvas");
          canvas.width=vp.width;canvas.height=vp.height;
          const ctx=canvas.getContext("2d");
          await page.render({canvasContext:ctx,viewport:vp}).promise;
          images.push(canvas.toDataURL("image/jpeg",0.85));
        }
      }
      setStage("extracting");
      const r=await fetch("/api/parse-invoice-pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({images})});
      const j=await r.json();
      if(!j.ok){setError(j.error||t("pdf.readError"));setStage("error");return;}
      const its=Array.isArray(j.items)?j.items:[];
      if(its.length===0){setError(L.no_items);setStage("error");return;}
      setItems(its);
      const sel={};its.forEach((_,i)=>sel[i]=true);
      setSelected(sel);
      setStage("review");
    }catch(e){console.error(e);setError(e.message||t("pdf.procError"));setStage("error");}
  };

  const updateItem=(i,f,v)=>setItems(p=>p.map((it,j)=>j===i?{...it,[f]:v}:it));
  const toggleAll=(checked)=>{const sel={};items.forEach((_,i)=>sel[i]=checked);setSelected(sel);};
  const confirm=()=>{
    const final=items.filter((_,i)=>selected[i]).map(it=>({description:it.description,quantity:Number(it.quantity)||1,unit_price_usd:Number(String(it.unit_price_usd).replace(",","."))||0,hs_code:it.hs_code?String(it.hs_code).trim():null}));
    if(final.length===0){setError(t("pdf.pickOne"));return;}
    onItemsConfirmed(final);
  };

  if(stage==="rendering"||stage==="extracting"){
    return <div style={{padding:"40px 20px",textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:12}}>📄</div>
      <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>{L.processing}</p>
      <p style={{fontSize:12,color:"rgba(255,255,255,0.5)",margin:0}}>{stage==="rendering"?L.rendering:L.extracting}...</p>
      <div style={{width:120,height:3,background:"rgba(255,255,255,0.08)",borderRadius:2,margin:"16px auto 0",overflow:"hidden"}}>
        <div style={{width:"40%",height:"100%",background:GOLD_GRADIENT,borderRadius:2,animation:"pdfBar 1.2s ease-in-out infinite"}}/>
      </div>
      <style dangerouslySetInnerHTML={{__html:`@keyframes pdfBar{0%{margin-left:-40%}100%{margin-left:100%}}`}}/>
    </div>;
  }

  if(stage==="review"){
    return <div>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.7)",margin:"0 0 12px",lineHeight:1.5}}>✅ {L.confirm_items}</p>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>{Object.values(selected).filter(Boolean).length}/{items.length}</span>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>toggleAll(true)} style={{fontSize:10,padding:"4px 8px",borderRadius:5,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer"}}>{L.select_all}</button>
          <button onClick={()=>toggleAll(false)} style={{fontSize:10,padding:"4px 8px",borderRadius:5,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer"}}>{L.deselect_all}</button>
        </div>
      </div>
      <div style={{maxHeight:"50vh",overflowY:"auto",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,marginBottom:12}}>
        {items.map((it,i)=><div key={i} style={{padding:"10px 12px",borderBottom:i<items.length-1?"1px solid rgba(255,255,255,0.04)":"none",background:selected[i]?"transparent":"rgba(0,0,0,0.2)",opacity:selected[i]?1:0.5}}>
          <div style={{display:"flex",gap:8}}>
            <input type="checkbox" checked={!!selected[i]} onChange={e=>setSelected(p=>({...p,[i]:e.target.checked}))} style={{cursor:"pointer",marginTop:6}}/>
            <div style={{flex:1,display:"grid",gridTemplateColumns:"3fr 1fr 1.2fr",gap:6}}>
              <input value={it.description} onChange={e=>updateItem(i,"description",e.target.value)} placeholder={t("common.description")} style={{padding:"6px 8px",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,color:"#fff",outline:"none"}}/>
              <input type="number" value={it.quantity} onChange={e=>updateItem(i,"quantity",e.target.value)} placeholder="Cant" style={{padding:"6px 8px",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,color:"#fff",outline:"none"}}/>
              <input type="text" inputMode="decimal" value={it.unit_price_usd} onChange={e=>updateItem(i,"unit_price_usd",e.target.value.replace(/[^0-9.,]/g,""))} placeholder="USD c/u" style={{padding:"6px 8px",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,color:"#fff",outline:"none"}}/>
            </div>
          </div>
          {it.hs_code&&<div style={{marginLeft:24,marginTop:6,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"rgba(34,197,94,0.12)",color:"#22c55e",border:"1px solid rgba(34,197,94,0.3)",textTransform:"uppercase"}}>HS detectado</span>
            <input value={it.hs_code} onChange={e=>updateItem(i,"hs_code",e.target.value)} placeholder="HS Code" style={{padding:"4px 8px",fontSize:11,fontFamily:"monospace",background:"rgba(34,197,94,0.05)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:5,color:"#fff",outline:"none",width:140}}/>
          </div>}
        </div>)}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <button onClick={onCancel} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer"}}>{L.cancel}</button>
        <button onClick={confirm} style={{padding:"9px 18px",fontSize:13,fontWeight:700,borderRadius:8,border:`1px solid ${GOLD_DEEP}`,background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer"}}>✓ {L.confirm}</button>
      </div>
    </div>;
  }

  // idle / error
  return <div>
    <input ref={fileRef} type="file" accept=".pdf,application/pdf,image/*,.jpg,.jpeg,.png,.webp,.heic" onChange={e=>handleFile(e.target.files?.[0])} style={{display:"none"}}/>
    <div onClick={()=>fileRef.current?.click()} onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.background="rgba(184,149,106,0.08)";}} onDragLeave={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.3)";e.currentTarget.style.background="rgba(184,149,106,0.04)";}} onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="rgba(184,149,106,0.3)";handleFile(e.dataTransfer.files?.[0]);}} style={{border:`2px dashed ${pasteHint?GOLD:"rgba(184,149,106,0.3)"}`,background:pasteHint?"rgba(184,149,106,0.15)":"rgba(184,149,106,0.04)",borderRadius:12,padding:"32px 20px",textAlign:"center",cursor:"pointer",transition:"all 200ms"}}>
      <div style={{fontSize:42,marginBottom:8}}>{pasteHint?"📥":"📄"}</div>
      <p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"0 0 4px"}}>{pasteHint?t("pdf.pasted"):L.drop_or_pick}</p>
      <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:0}}>{t("pdf.hint")}  <strong style={{color:GOLD_LIGHT}}>pegar (Cmd/Ctrl+V)</strong> directamente</p>
    </div>
    {error&&<p style={{fontSize:12,color:"#ff6b6b",margin:"10px 0 0",textAlign:"center"}}>{error}</p>}
    {onCancel&&<div style={{display:"flex",justifyContent:"center",marginTop:10}}>
      <button onClick={onCancel} style={{fontSize:11,color:"rgba(255,255,255,0.5)",background:"transparent",border:"none",cursor:"pointer"}}>{t("pdf.manualInstead")}</button>
    </div>}
  </div>;
}

// Selector grande arriba: PDF vs manual. Modo exclusivo.
function InputModeSelector({mode,onChange,labels={}}){
  const {t}=useT();
  const L={pdf_title:labels.pdf_title||"📄 Subir PDF",pdf_desc:labels.pdf_desc||t("merc.modeInvoice"),manual_title:labels.manual_title||"✍️ Cargar a mano",manual_desc:labels.manual_desc||t("merc.modeManual")};
  if(mode)return null;
  const Card=({k,title,desc,color})=><button onClick={()=>onChange(k)} style={{flex:"1 1 240px",minWidth:200,padding:"22px 20px",background:"rgba(255,255,255,0.028)",border:`2px solid ${color}30`,borderRadius:14,cursor:"pointer",textAlign:"center",transition:"all 200ms"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.background=`${color}10`;e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=`${color}30`;e.currentTarget.style.background="rgba(255,255,255,0.028)";e.currentTarget.style.transform="none";}}>
    <p style={{fontSize:18,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>{title}</p>
    <p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:0,lineHeight:1.4}}>{desc}</p>
  </button>;
  return <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:18}}>
    <Card k="pdf" title={L.pdf_title} desc={L.pdf_desc} color="#5b9bd5"/>
    <Card k="manual" title={L.manual_title} desc={L.manual_desc} color="#B8956A"/>
  </div>;
}

// Fila editable inline para items declarados (cliente)
function EditableItemRow({item,editable,token,onChange}){
  const [desc,setDesc]=useState(item.description||"");
  const [qty,setQty]=useState(String(item.quantity||""));
  const [price,setPrice]=useState(String(item.unit_price_usd||""));
  const [hs,setHs]=useState(item.ncm_code||"");
  const [saving,setSaving]=useState(false);
  const tRef=useRef(null);
  useEffect(()=>{setDesc(item.description||"");setQty(String(item.quantity||""));setPrice(String(item.unit_price_usd||""));setHs(item.ncm_code||"");},[item.id]);
  const persist=async(patch)=>{
    setSaving(true);
    try{await dq("operation_items",{method:"PATCH",token,filters:`?id=eq.${item.id}`,body:patch});}
    catch(e){console.error(e);}
    setSaving(false);
  };
  const debouncedSave=(patch)=>{
    if(tRef.current)clearTimeout(tRef.current);
    tRef.current=setTimeout(async()=>{await persist(patch);if(onChange)await onChange();},700);
  };
  const onDel=async()=>{if(!confirm(`¿Eliminar "${item.description}"?`))return;await dq("operation_items",{method:"DELETE",token,filters:`?id=eq.${item.id}`});if(onChange)await onChange();};
  const subtotal=(Number(qty)||0)*(Number(price)||0);
  if(!editable){
    return <div style={{display:"grid",gridTemplateColumns:"3fr 0.9fr 0.7fr 1fr 1fr",gap:8,padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:13,color:"rgba(255,255,255,0.85)",alignItems:"center"}}>
      <span>{item.description}</span>
      <span style={{fontFamily:"monospace",fontSize:12,color:item.ncm_code?"#22c55e":"rgba(255,255,255,0.3)"}}>{item.ncm_code||"—"}</span>
      <span style={{textAlign:"right"}}>{Number(item.quantity||0)}</span>
      <span style={{textAlign:"right"}}>USD {Number(item.unit_price_usd||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      <span style={{textAlign:"right",fontWeight:700}}>USD {subtotal.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
    </div>;
  }
  const inputStyle={width:"100%",padding:"6px 8px",fontSize:12,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.1)",borderRadius:5,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none"};
  return <div style={{display:"grid",gridTemplateColumns:"3fr 0.9fr 0.7fr 1fr 1fr 36px",gap:8,padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:13,color:"rgba(255,255,255,0.85)",alignItems:"center"}}>
    <input value={desc} onChange={e=>{setDesc(e.target.value);debouncedSave({description:e.target.value});}} style={inputStyle}/>
    <input value={hs} onChange={e=>{setHs(e.target.value);debouncedSave({ncm_code:e.target.value||null});}} placeholder="HS Code" style={{...inputStyle,fontFamily:"monospace"}}/>
    <input type="number" value={qty} onChange={e=>{const v=e.target.value;setQty(v);debouncedSave({quantity:Number(v)||0});}} style={{...inputStyle,textAlign:"right"}}/>
    <input type="text" inputMode="decimal" value={price} onChange={e=>{const v=e.target.value.replace(/[^0-9.,]/g,"");setPrice(v);debouncedSave({unit_price_usd:Number(String(v).replace(",","."))||0});}} style={{...inputStyle,textAlign:"right"}}/>
    <span style={{textAlign:"right",fontWeight:700,opacity:saving?0.5:1}}>USD {subtotal.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
    <button onClick={onDel} title="Eliminar" style={{padding:"4px 6px",fontSize:11,borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.08)",color:"#ff6b6b",cursor:"pointer"}}>✕</button>
  </div>;
}

// ═══ MERCADERÍA DE LA IMPORTACIÓN (13/09/2026) ═══
// La misma tabla que la calculadora: descripción, USD c/u, cantidad, NCM sugerida (opcional) y
// NCM Argencargo con clasificación por IA; debajo las alícuotas. Se puede cargar a mano o
// leyendo la factura (PDF / foto / pegar imagen). Cada producto puede decir en qué bulto viaja,
// para que el costo puesto en Argentina se prorratee por bulto; si no, se prorratea por FOB.
function MercaderiaEditor({op,pkgs,items,token,client,onSaved}){
  const {t}=useT();
  const HAIR="1px solid rgba(255,255,255,0.13)";const SKY="#8CC8F5";const SUB="rgba(255,255,255,0.8)";
  const LBL={fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#fff",margin:0};
  const INP={width:"100%",boxSizing:"border-box",height:40,padding:"0 12px",fontSize:14,border:"1px solid rgba(255,255,255,0.2)",borderRadius:9,background:"rgba(255,255,255,0.07)",color:"#fff",outline:"none",textAlign:"center",fontFamily:"inherit"};
  const onF=e=>{e.currentTarget.style.borderColor="rgba(232,208,152,0.7)";};const onB=e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.2)";};
  const SMALL_GHOST={height:32,padding:"0 12px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.24)",background:"rgba(255,255,255,0.06)",color:"#fff",cursor:"pointer",textDecoration:"none",display:"inline-flex",alignItems:"center",whiteSpace:"nowrap"};
  const SMALL_GOLD={...SMALL_GHOST,border:"1px solid rgba(232,208,152,0.55)",background:"rgba(184,149,106,0.16)",color:GOLD_LIGHT};
  const usd=v=>`USD ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const numIn=({value,onChange,placeholder})=><input type="text" inputMode="decimal" value={value??""} onChange={e=>{const v=e.target.value;if(v===""||/^\d*[.,]?\d*$/.test(v))onChange(v);}} placeholder={placeholder} style={INP} onFocus={onF} onBlur={onB}/>;
  const fromItem=it=>({id:it.id,description:it.description||"",unit_price:it.unit_price_usd!=null?String(it.unit_price_usd).replace(".",","):"",quantity:it.quantity!=null?String(it.quantity):"1",ncm_hint:"",ncm:it.ncm_code||it.import_duty_rate!=null?{ncm_code:it.ncm_code||"MANUAL",import_duty_rate:Number(it.import_duty_rate??0),statistics_rate:Number(it.statistics_rate??0),iva_rate:Number(it.iva_rate??21),
    // Reconstruir el aviso de antidumping desde lo guardado: si no, el ⚠ y el texto
    // solo se veían en la sesión en la que se clasificó el producto y desaparecían al recargar.
    ...(it.antidumping_note?{antidumping:{producto:String(it.antidumping_note).split(" · ")[0],medidaTexto:String(it.antidumping_note).split(" · ").slice(1).join(" · ")||""}}:{})}:null,ncmLoading:false,ncmError:false,package_ids:Array.isArray(it.package_ids)?it.package_ids:[]});
  const empty=()=>({description:"",unit_price:"",quantity:"1",ncm_hint:"",ncm:null,ncmLoading:false,ncmError:false,package_ids:[]});
  const [rows,setRows]=useState(()=>items.length?items.map(fromItem):[empty()]);
  const [mode,setMode]=useState(items.length?"manual":null);
  const [batt,setBatt]=useState(!!op.has_battery);
  const [classifyingAll,setClassifyingAll]=useState(false);const [saving,setSaving]=useState(false);const [savedAt,setSavedAt]=useState(null);
  const dirtyRef=useRef(false);const timerRef=useRef(null);const lastSavedRef=useRef(null);
  const ch=(i,f,v)=>{dirtyRef.current=true;setRows(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));};
  const add=()=>setRows(p=>[...p,empty()]);const rm=i=>{dirtyRef.current=true;setRows(p=>p.filter((_,j)=>j!==i));};
  const classifyOne=async(i)=>{const p=rows[i];if(!p?.description?.trim())return;
    setRows(pr=>pr.map((x,j)=>j===i?{...x,ncmLoading:true,ncmError:false}:x));
    try{const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:p.description,hint:p.ncm_hint||undefined})});const d=await r.json();
      if(d.fallback||d.error)setRows(pr=>pr.map((x,j)=>j===i?{...x,ncmLoading:false,ncmError:true,ncm:null}:x));
      else{dirtyRef.current=true;setRows(pr=>pr.map((x,j)=>j===i?{...x,ncmLoading:false,ncmError:false,ncm:d}:x));}
    }catch{setRows(pr=>pr.map((x,j)=>j===i?{...x,ncmLoading:false,ncmError:true,ncm:null}:x));}};
  const classifyAll=async()=>{const idxs=rows.map((p,i)=>(!p.ncm&&p.description?.trim())?i:-1).filter(i=>i>=0);if(!idxs.length)return;setClassifyingAll(true);try{await Promise.all(idxs.map(classifyOne));}finally{setClassifyingAll(false);}};
  const valid=rows.filter(r=>r.description.trim()&&toN(r.unit_price)>0&&toN(r.quantity)>0);
  const totalFob=valid.reduce((s,r)=>s+toN(r.unit_price)*toN(r.quantity),0);
  const sinNcm=rows.filter(p=>p.description?.trim()&&!p.ncm&&!p.ncmLoading);
  const pendingClass=valid.some(r=>!r.ncm);
  // Filas a medias (con descripción pero sin precio o cantidad) frenan la confirmación, no el borrador.
  const aMedias=rows.filter(r=>r.description.trim()&&!(toN(r.unit_price)>0&&toN(r.quantity)>0));
  const payload=()=>({op_id:op.id,client_id:client?.id,has_battery:batt,items:valid.map(x=>({description:x.description.trim(),quantity:toN(x.quantity),unit_price_usd:toN(x.unit_price),ncm_code:x.ncm?.ncm_code||null,import_duty_rate:x.ncm?.import_duty_rate??0,statistics_rate:x.ncm?.statistics_rate??0,iva_rate:x.ncm?.iva_rate??21,package_ids:x.package_ids?.length?x.package_ids:null,antidumping_note:x.ncm?.antidumping?`${x.ncm.antidumping.producto} · ${x.ncm.antidumping.medidaTexto||t("merc.noAmountLoaded")}`:null}))});
  const persist=async(confirm)=>{const body=payload();const ser=JSON.stringify(body);
    if(!confirm&&ser===lastSavedRef.current)return true;
    setSaving(true);
    try{const r=await fetch("/api/portal/guardar-mercaderia",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({...body,confirm:!!confirm})});
      const d=await r.json().catch(()=>null);
      if(!r.ok){toast(d?.error==="ya_en_vuelo"?t("merc.frozenFlight"):d?.error==="mercaderia_confirmada"?t("merc.alreadyConfirmed"):t("merc.saveError"),"error");setSaving(false);return false;}
      lastSavedRef.current=ser;dirtyRef.current=false;setSavedAt(new Date());
      if(d?.quote_error)toast(t("quotes.saveFailed"),"error");
      if(confirm)toast(t("merc.confirmedOk"),"success");
      onSaved?.();setSaving(false);return true;
    }catch(e){toast(t("merc.saveError"),"error");setSaving(false);return false;}};
  // Borrador automático: en cuanto hay productos válidos y clasificados, se guarda solo (sin botón).
  useEffect(()=>{if(!dirtyRef.current)return;if(!(valid.length>0&&!pendingClass))return;clearTimeout(timerRef.current);timerRef.current=setTimeout(()=>{persist(false);},900);return()=>clearTimeout(timerRef.current);},[rows,batt]); // eslint-disable-line react-hooks/exhaustive-deps
  const canConfirm=valid.length>0&&!pendingClass&&aMedias.length===0&&!saving&&!classifyingAll;
  const confirmar=async()=>{if(!canConfirm)return;
    if(!await confirmDialog(`¿Confirmamos la mercadería? ${valid.length} ${valid.length!==1?t("merc.confirmProductsPl"):t("merc.confirmProducts")} ${t("merc.confirmHead")} ${usd(totalFob)} FOB. ${t("merc.confirmTail")}`,{confirmText:"Sí, está completa"}))return;
    clearTimeout(timerRef.current);await persist(true);};
  const PROD_COLS="1fr 110px 90px 150px 170px";
  const ncmCell=(p)=>p.ncmLoading?<span style={{fontSize:11.5,color:GOLD_LIGHT,fontWeight:600,whiteSpace:"nowrap"}}>Clasificando…</span>
    :p.ncm?.ncm_code?<span style={{height:40,display:"inline-flex",alignItems:"center",padding:"0 12px",borderRadius:9,background:"rgba(184,149,106,0.16)",border:"1px solid rgba(232,208,152,0.5)",color:GOLD_LIGHT,fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>{p.ncm.ncm_code==="MANUAL"?"Estimado":p.ncm.ncm_code}{p.ncm.antidumping&&<span title="Antidumping" style={{marginLeft:6,color:"#f87171"}}>⚠</span>}</span>
    :<span style={{height:40,display:"inline-flex",alignItems:"center",padding:"0 12px",borderRadius:9,border:"1px dashed rgba(255,255,255,0.35)",color:"rgba(255,255,255,0.7)",fontSize:11,fontWeight:700,letterSpacing:"0.05em",whiteSpace:"nowrap"}}>PENDIENTE</span>;
  const delBtn=(onClick,disabled)=><button onClick={onClick} disabled={disabled} title="Quitar" style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.7)",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.35:1,fontSize:13,flexShrink:0}}>✕</button>;
  return <div>
    {mode==="manual"&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:12}}>
      <p style={{...LBL,fontSize:12}}>Productos</p>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {saving?<span style={{fontSize:11.5,color:SKY,fontWeight:600}}>Guardando…</span>:savedAt?<span style={{fontSize:11.5,color:"rgba(255,255,255,0.5)"}}>Borrador guardado {savedAt.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</span>:null}
        <button onClick={add} style={SMALL_GOLD}>+ Producto</button>
      </div>
    </div>}
    {mode===null&&<InputModeSelector mode={mode} onChange={setMode} labels={{pdf_title:t("merc.readInvoice"),pdf_desc:t("merc.readInvoiceSub"),manual_title:"✍️ Cargar a mano",manual_desc:t("merc.manualSub")}}/>}
    {mode==="pdf"&&<PdfInvoiceReader onCancel={()=>setMode("manual")} onItemsConfirmed={(detected)=>{setRows(detected.map(it=>({...empty(),description:it.description||"",quantity:String(it.quantity||"1"),unit_price:String(it.unit_price_usd||"").replace(".",","),ncm_hint:String(it.hs_code||"").replace(/[^\d.]/g,"")})));setMode("manual");}}/>}
    {mode==="manual"&&<>
      <div className="pc-head" style={{display:"grid",gridTemplateColumns:PROD_COLS,gap:8,padding:"0 4px 6px"}}>{[t("common.description"),"USD c/u","Cantidad","NCM / HS sugerida","NCM Argencargo"].map((h,i)=><span key={i} style={{...LBL,fontSize:10,color:SKY,textAlign:i>0?"center":"left",paddingRight:i===4?40:0}}>{h}</span>)}</div>
      {rows.map((p,i)=><div key={i}>
        <div className="pc-row" style={{display:"grid",gridTemplateColumns:PROD_COLS,gap:8,alignItems:"center",padding:"6px 4px",borderTop:i>0?HAIR:"none"}}>
          <input className="pc-desc" value={p.description||""} onChange={e=>ch(i,"description",e.target.value)} placeholder="Sé específico. Ej: Auriculares inalámbricos bluetooth" style={{...INP,textAlign:"left"}} onFocus={onF} onBlur={onB}/>
          {numIn({value:p.unit_price,onChange:v=>ch(i,"unit_price",v),placeholder:"USD c/u"})}
          {numIn({value:p.quantity,onChange:v=>ch(i,"quantity",v),placeholder:"Cant."})}
          <input className="pc-hint" value={p.ncm_hint||""} onChange={e=>{const v=e.target.value;if(/^[\d.]*$/.test(v))ch(i,"ncm_hint",v);}} placeholder="(OPCIONAL)" title={t("merc.hsHint")} style={{...INP,fontFamily:"'JetBrains Mono',monospace",fontSize:13}} onFocus={onF} onBlur={onB}/>
          <div className="pc-tail" style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",minWidth:0}}>{ncmCell(p)}{delBtn(()=>rm(i),rows.length<=1)}</div>
        </div>
        {(()=>{const est=()=>ch(i,"ncm",{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:35,statistics_rate:3,iva_rate:21});const n=p.ncm;
          return <div style={{padding:"0 4px 8px"}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6,alignItems:"center"}}>
              {n?.ncm_code&&[[t("quotes.duties"),n.import_duty_rate],[t("merc.statRate"),n.statistics_rate],["IVA",n.iva_rate]].map(([l,v])=><span key={l} style={{display:"inline-flex",alignItems:"center",gap:8,height:30,padding:"0 12px",borderRadius:8,border:HAIR,background:"rgba(255,255,255,0.07)"}}><span style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:SKY}}>{l}</span><span style={{fontSize:13,fontWeight:800,color:"#fff",fontVariantNumeric:"tabular-nums"}}>{v}%</span></span>)}
            </div>
            {n?.hint_verdict==="diff"&&<p style={{fontSize:12,color:"#fbbf24",margin:"6px 0 0",lineHeight:1.5}}>Tu posición sugerida ({n.hint_code}) no corresponde para esta mercadería{n.hint_note?`: ${n.hint_note}`:"."}</p>}
            {n?.hint_verdict==="ok"&&<p style={{fontSize:12,color:"#4ade80",margin:"6px 0 0"}}>{t("merc.hsMatch")}</p>}
            {n?.antidumping&&<p style={{fontSize:12,color:"#f87171",margin:"6px 0 0",lineHeight:1.5}}>⚠ Este producto tiene medidas antidumping para origen China ({n.antidumping.producto}{n.antidumping.medidaTexto?` · ${n.antidumping.medidaTexto}`:""}). El costo es estimativo: el equipo lo revisa antes de confirmar.</p>}
            {p.ncmError&&<div style={{marginTop:8,padding:"10px 12px",borderRadius:10,border:"1px solid rgba(255,107,107,0.35)",background:"rgba(255,107,107,0.08)"}}>
              <p style={{fontSize:12.5,color:"#ff8a8a",margin:"0 0 8px",fontWeight:600}}>No pudimos clasificar “{p.description}” automáticamente</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <button onClick={est} style={SMALL_GOLD}>Usar valores estimados (35 % derechos)</button>
                <a href={`https://wa.me/5491125088580?text=${encodeURIComponent("Hola! Necesito ayuda para clasificar: "+p.description)}`} target="_blank" rel="noopener noreferrer" style={{...SMALL_GHOST,color:"#4ade80"}}>{t("merc.askWA")}</a>
              </div>
            </div>}
          </div>;})()}
      </div>)}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginTop:10,paddingTop:14,borderTop:HAIR}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:14,padding:"8px 16px",borderRadius:10,border:"1px solid rgba(232,208,152,0.35)",background:"rgba(184,149,106,0.1)"}}><span style={{fontSize:13,fontWeight:800,color:"#fff",letterSpacing:"0.08em",textTransform:"uppercase",lineHeight:1}}>{t("merc.fobGoods")}</span><span style={{fontSize:22,fontWeight:800,color:totalFob>0?GOLD_LIGHT:"rgba(255,255,255,0.4)",fontVariantNumeric:"tabular-nums",lineHeight:1}}>{totalFob>0?usd(totalFob):"—"}</span></div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          {pendingClass&&!classifyingAll&&sinNcm.length>0&&<span style={{fontSize:12,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",color:"#f87171"}}>{t("merc.tapClassify")}</span>}
          {sinNcm.length>0&&<button onClick={classifyAll} disabled={classifyingAll} style={{height:40,padding:"0 20px",fontSize:12.5,fontWeight:800,letterSpacing:"0.06em",borderRadius:9,cursor:classifyingAll?"wait":"pointer",background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,opacity:classifyingAll?0.6:1,boxShadow:GOLD_GLOW}}>{classifyingAll?"CLASIFICANDO…":`CLASIFICAR NCM${sinNcm.length>1?` (${sinNcm.length})`:""}`}</button>}
        </div>
      </div>
      {/* Baterías + confirmación final */}
      <div style={{marginTop:18,paddingTop:16,borderTop:HAIR,display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          <span style={{...LBL,fontSize:12}}>{t("calc.goodsQ")}</span>
          {[[true,t("calc.batteryYesShort")],[false,"✓ "+t("common.no")]].map(([v,l])=><button key={l} onClick={()=>{dirtyRef.current=true;setBatt(v);}} style={{height:36,padding:"0 18px",fontSize:12.5,fontWeight:800,borderRadius:9,cursor:"pointer",border:`1px solid ${batt===v?(v?"rgba(251,146,60,0.65)":"rgba(74,222,128,0.55)"):"rgba(255,255,255,0.2)"}`,background:batt===v?(v?"rgba(251,146,60,0.16)":"rgba(74,222,128,0.14)"):"transparent",color:batt===v?(v?"#fdba74":"#4ade80"):"rgba(255,255,255,0.6)"}}>{l}</button>)}
        </div>
        {aMedias.length>0&&<span style={{fontSize:12,fontWeight:700,color:"#fbbf24",textAlign:"center"}}>Hay {aMedias.length===1?t("merc.oneProduct"):`${aMedias.length} productos`} sin precio o cantidad: completalo o quitalo para confirmar.</span>}
        <button onClick={confirmar} disabled={!canConfirm} style={{minHeight:52,padding:"0 30px",fontSize:13,fontWeight:900,letterSpacing:"0.08em",textTransform:"uppercase",borderRadius:12,border:`1px solid ${GOLD_DEEP}`,cursor:canConfirm?"pointer":"not-allowed",background:GOLD_GRADIENT,color:"#0A1628",opacity:canConfirm?1:0.45,boxShadow:canConfirm?GOLD_GLOW:"none"}}>{t("merc.docsDone")}</button>
      </div>
    </>}
  </div>;
}

function OperationDetail({op:opProp,token,client,onBack}){
  const {t}=useT();
  // La op se refresca sola después de cada guardado (descripción, baterías, confirmación).
  const [opFresh,setOpFresh]=useState(null);const op=opFresh||opProp;
  const [tabDet,setTabDet]=useState(null);const [pkOpenDet,setPkOpenDet]=useState(null);
  // Desglose de impuestos abierto/cerrado en el Resumen: el cliente quiere ver que paga por cada
  // producto (derechos, tasa estadistica, IVA) y el desaduanaje, no solo el total.
  const [impOpen,setImpOpen]=useState(false);
  const [items,setItems]=useState([]);const [events,setEvents]=useState([]);const [pkgs,setPkgs]=useState([]);const [pmts,setPmts]=useState([]);const [cliPmts,setCliPmts]=useState([]);const [loading,setLoading]=useState(true);const [expItem,setExpItem]=useState(null);const [openSections,setOpenSections]=useState({budget:true,products:true,packages:true,tracking:true,payments:true});const [showDocPanel,setShowDocPanel]=useState(false);const [docItems,setDocItems]=useState([]);const [savingDocs,setSavingDocs]=useState(false);const [lightboxPhoto,setLightboxPhoto]=useState(null);const [repackInfo,setRepackInfo]=useState(null);const [showRepackDetail,setShowRepackDetail]=useState(false);const [declaredItems,setDeclaredItems]=useState([]);
  // Cliente tocó t("op.waitingPackages"): ack visual, sigue en depósito hasta confirmar consolidación.
  const [waitingMore,setWaitingMore]=useState(false);
  // Tarifas/config/overrides para recomputar el desglose de impuestos (misma cuenta que el admin)
  const [calcCtx,setCalcCtx]=useState(null);
  const [docInputMode,setDocInputMode]=useState(null); // 'pdf' | 'manual'
  const [localConfirmed,setLocalConfirmed]=useState(false);
  const [inFlight,setInFlight]=useState(false);
  // El panel de documentación se desbloquea recién cuando el cliente confirma que llegaron TODOS los bultos
  // (consolidation_confirmed) o cuando lo hizo en esta sesión (localConfirmed). Antes de eso no se puede
  // cargar la factura para evitar declaraciones por partes.
  const canDocument=op.consolidation_confirmed||localConfirmed;
  const addDocItem=()=>setDocItems(p=>[...p,{description:"",quantity:"1",unit_price_usd:""}]);
  const rmDocItem=(i)=>setDocItems(p=>p.filter((_,j)=>j!==i));
  const chDocItem=(i,f,v)=>setDocItems(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));
  const saveDocs=async()=>{const nP=(v)=>Number(String(v??"").replace(",","."))||0;const valid=docItems.filter(d=>d.description?.trim()&&Number(d.quantity)>0&&nP(d.unit_price_usd)>0);if(valid.length===0){alert("Completá al menos un producto");return;}setSavingDocs(true);
    for(const d of valid){const body={operation_id:op.id,description:d.description,quantity:Number(d.quantity),unit_price_usd:nP(d.unit_price_usd)};if(d.hs_code)body.ncm_code=d.hs_code;await dq("operation_items",{method:"POST",token,body});}
    setShowDocPanel(false);setDocItems([]);await loadAll();setSavingDocs(false);
  };
  const toggleSection=(s)=>setOpenSections(p=>({...p,[s]:!p[s]}));
  const downloadPdf=()=>printQuotePdf({op,items,pkgs,payments:pmts,cliPmts});
  const downloadClosingPdf=()=>printClosingPdf({op,items,pkgs,cliPmts,events});
  const loadAll=async()=>{dq("operations",{token,filters:`?id=eq.${op.id}&select=*`}).then(r=>{if(Array.isArray(r)&&r[0])setOpFresh(r[0]);}).catch(()=>{});const [it,ev,pk,pm,cp,rk,fl,fii,tf,cf,ov]=await Promise.all([dq("operation_items",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`}),dq("tracking_events",{token,filters:`?operation_id=eq.${op.id}&select=*&order=occurred_at.desc`}),dq("operation_packages",{token,filters:`?operation_id=eq.${op.id}&select=*&order=package_number.asc`}),dq("payment_management",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`}),dq("operation_client_payments",{token,filters:`?operation_id=eq.${op.id}&select=*&order=payment_date.asc`}),dq("repack_requests",{token,filters:`?operation_id=eq.${op.id}&status=eq.done&order=completed_at.desc&limit=1`}),dq("flight_operations",{token,filters:`?operation_id=eq.${op.id}&select=flight_id&limit=1`}),dq("flight_invoice_items",{token,filters:`?operation_id=eq.${op.id}&select=description,hs_code,quantity,unit_price_declared_usd,sort_order&order=sort_order.asc`}),dq("tariffs",{token,filters:"?select=*"}),dq("calc_config",{token,filters:"?select=*"}),client?.id?dq("client_tariff_overrides",{token,filters:`?client_id=eq.${client.id}&select=*`}):Promise.resolve([])]);
  {const cfg={};(Array.isArray(cf)?cf:[]).forEach(r=>{cfg[r.key]=Number(r.value);});setCalcCtx({tariffs:Array.isArray(tf)?tf:[],config:cfg,overrides:Array.isArray(ov)?ov:[]});}
  setDeclaredItems(Array.isArray(fii)?fii:[]);

  setInFlight(Array.isArray(fl)&&fl.length>0);
  setRepackInfo(Array.isArray(rk)&&rk[0]?rk[0]:null);setItems(Array.isArray(it)?it:[]);setEvents((Array.isArray(ev)?ev:[]).filter(e=>{
  // Filtrar eventos internos auto-generados por cambio de status (ya están en la barra de progreso)
  if(e.source==="internal"&&String(e.title||"").startsWith("Estado actualizado"))return false;
  // Filtrar eventos de pre-clearance aduanero de DHL: marcan location ARGENTINA aunque la carga esté en origen
  if(e.source==="dhl"&&String(e.description||"").toLowerCase().includes("customs clearance status updated"))return false;
  // Filtrar eventos DHL con title "SD" (Shipment Data — meta-evento sin valor real)
  if(e.source==="dhl"&&String(e.title||"").trim()==="SD")return false;
  return true;
}));setPkgs(Array.isArray(pk)?pk:[]);setPmts(Array.isArray(pm)?pm:[]);setCliPmts(Array.isArray(cp)?cp:[]);setLoading(false);};
  useEffect(()=>{loadAll();let last=Date.now();const onFocus=()=>{if(document.visibilityState==="visible"&&Date.now()-last>5000){last=Date.now();loadAll();}};document.addEventListener("visibilitychange",onFocus);window.addEventListener("focus",onFocus);return()=>{document.removeEventListener("visibilitychange",onFocus);window.removeEventListener("focus",onFocus);};},[op.id,token]);
  const st=SM[op.status]||{l:op.status,c:"#999"};const isA=op.channel?.includes("aereo");
  const isGI=op.service_type==="gestion_integral";
  // Al cliente RI le mostramos la declaración del despacho, salvo que en esta op se le cobre
  // sobre el valor que declaró él: ahí ve su propia mercadería y no dos totales distintos.
  const muestraAduana=client?.tax_condition==="responsable_inscripto"&&op.status!=="operacion_cerrada"&&!isGI&&!op.hide_customs_declaration&&declaredItems.length>0;
  // ── Rediseño 13/09/2026: tres zonas (cabecera + qué hacer ahora · mercadería y costos · bultos y seguimiento) ──
  const HAIR="1px solid rgba(255,255,255,0.13)";const SKY="#8CC8F5";
  const PANEL={background:"linear-gradient(180deg, rgba(13,24,45,0.96), rgba(8,16,32,0.96))",border:HAIR,borderRadius:18,padding:"22px 26px",marginBottom:16,boxShadow:"0 16px 40px rgba(0,0,0,0.3)"};
  const LBL={fontSize:10.5,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:SKY,margin:0};
  const H3={fontSize:12.5,fontWeight:800,color:"#fff",margin:0,letterSpacing:"0.1em",textTransform:"uppercase"};
  const usd=v=>`USD ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const f2=v=>Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const fd=d=>d?formatDate(d):"—";
  const isAer=!!op.channel?.includes("aereo");const isMar=!!op.channel?.includes("maritimo");const isB=!!op.channel?.includes("negro");
  const pkData=pkgs.map(pk=>{const q=Number(pk.quantity||1);const l=Number(pk.length_cm||0),w=Number(pk.width_cm||0),h=Number(pk.height_cm||0),gw=Number(pk.gross_weight_kg||0)*q;const vw=l&&w&&h?((l*w*h)/5000)*q:0;const cbm=l&&w&&h?((l*w*h)/1e6)*q:0;return{...pk,l,w,h,gw,vw,cbm};});
  const totGW=pkData.reduce((s,p)=>s+p.gw,0),totVW=pkData.reduce((s,p)=>s+p.vw,0),totCBM=pkData.reduce((s,p)=>s+p.cbm,0),pf=pkData.reduce((s,p)=>s+Math.max(p.gw,p.vw),0);
  const nBultos=pkgs.length>0?pkgs.reduce((s,p)=>s+Number(p.quantity||1),0):(op.total_quantity||0);
  const isEditable=!isGI&&op.channel==="aereo_blanco"&&["en_deposito_origen","en_preparacion"].includes(op.status)&&(op.consolidation_confirmed||localConfirmed)&&!inFlight&&!op.docs_confirmed_at;
  const bt=Number(op.budget_total||0);const bTax=Number(op.budget_taxes||0);const bFlete=Number(op.budget_flete||0);const bSeg=Number(op.budget_seguro||0);const shipCost=op.shipping_to_door?Number(op.shipping_cost||0):0;
  const riPagaImpuestosDirecto=op.channel==="aereo_blanco"&&client?.tax_condition==="responsable_inscripto"&&!op.ri_argencargo_collects_taxes;
  const pmtTotal=pmts.reduce((s,p)=>s+Number(p.client_amount_usd||0),0);const pmtAnticipado=Number(op.total_anticipos||0);const pmtPendiente=Math.max(0,pmtTotal-pmtAnticipado);
  const giTotalItems=items.reduce((s,it)=>s+Number(it.unit_price_usd||0)*Number(it.quantity||1),0);
  const totalAbonar=isGI?giTotalItems:(bt+pmtPendiente);const hasBudget=isGI?giTotalItems>0:bt>0;
  const totalCli=cliPmts.reduce((s,p)=>s+Number(p.amount_usd||0),0);const saldoReal=Math.max(0,totalAbonar-totalCli);
  const fobItems=giTotalItems;
  let est=null;try{if(!isGI&&op.channel==="aereo_blanco"&&items.length>0&&calcCtx)est=calcOpBudget(op,items,pkgs,calcCtx.tariffs,calcCtx.config,calcCtx.overrides,client,declaredItems);}catch(e){est=null;}
  // Lo que el cliente paga por fuera de Argencargo. Para el RI de aereo blanco son los impuestos
  // Y el desaduanaje: los abona directo al despachante, asi que no entran en el total de
  // Argencargo. Se muestra aparte para que el "estimado total de la importacion" cierre.
  const fueraDeAC=riPagaImpuestosDirecto&&est?Number(est.totalTax||0):0;
  const showEstimate=!!est&&!hasBudget;
  const costoPorProducto=(()=>{const r=est;if(!r||!items.length)return[];
    const fobOf=it=>Number(it.unit_price_usd||0)*Number(it.quantity||1);const fobTot=items.reduce((s,it)=>s+fobOf(it),0)||1;
    const assigned={};let unassigned=0,wTot=0;
    pkData.forEach(p=>{const w=Math.max(p.gw,p.vw);wTot+=w;const owners=items.filter(it=>Array.isArray(it.package_ids)&&it.package_ids.includes(p.id));if(!owners.length){unassigned+=w;return;}const subFob=owners.reduce((s,it)=>s+fobOf(it),0)||1;owners.forEach(it=>{assigned[it.id]=(assigned[it.id]||0)+w*(fobOf(it)/subFob);});});
    const td=r.taxDetail||{};const service=Number(r.flete||0)+Number(r.seguro||0)+Number(r.overweightSurcharge||0)+Number(td.desembolso||0)+Number(td.ivaDesembolso||0)+Number(r.shipCost||0)+Number(op.delivery_cost_usd||0);
    const scale=hasBudget&&r.totalAbonar>0&&Math.abs(r.totalAbonar-bt)>1?bt/r.totalAbonar:1;
    return items.map((it,k)=>{const fob=fobOf(it);const fobShare=fob/fobTot;const share=wTot>0?((assigned[it.id]||0)+unassigned*fobShare)/wTot:fobShare;const ti=td.items?.[k];const tax=(ti?ti.derechos+ti.tasaE+ti.iva:0)*scale;const svc=service*share*scale;const imp=tax+svc;const qty=Number(it.quantity||1);return{it,qty,fob,fobUnit:fob/qty,tax,taxUnit:tax/qty,svc,svcUnit:svc/qty,imp,impUnit:imp/qty,total:fob+imp,totalUnit:(fob+imp)/qty};});})();
  const accion=(()=>{
    if(op.lost_in_customs_at||["operacion_cerrada","cancelada"].includes(op.status))return null;
    if(isEditable&&items.length===0)return{c:GOLD_LIGHT,t:t("opq.loadTitle"),s:t("opq.loadDesc")};
    if(isEditable&&items.length>0)return{c:GOLD_LIGHT,t:t("opq.confirmTitle"),s:t("opq.confirmDesc")};
    if(op.docs_confirmed_at&&op.status==="en_preparacion"&&!hasBudget)return{c:SKY,t:t("opq.quotingTitle"),s:t("opq.quotingDesc")};
    if(hasBudget&&saldoReal>0.01&&op.status!=="entregada")return{c:GOLD_LIGHT,t:`${t("opq.balanceDue")}: ${usd(saldoReal)}`,s:t("opq.payDesc")};
    if(op.status==="entregada")return{c:"#4ade80",t:t("opq.readyTitle"),s:t("opq.readyDesc")};
    if(op.status==="en_transito")return{c:SKY,t:t("opq.transitTitle"),s:op.eta?`${t("opq.eta")}: ${fd(op.eta)}.`:t("opq.transitDesc")};
    if(op.status==="arribo_argentina"||op.status==="en_aduana")return{c:SKY,t:t("opq.customsTitle"),s:t("opq.customsDesc")};
    return null;})();
  const fila=(l,v,opts={})=><div style={{display:"flex",justifyContent:"space-between",gap:12,padding:"8px 0",borderBottom:opts.last?"none":"1px solid rgba(255,255,255,0.08)"}}><span style={{fontSize:13,color:opts.muted?"rgba(255,255,255,0.55)":"#fff",opacity:0.94}}>{l}</span><span style={{fontSize:13.5,fontWeight:opts.bold?800:600,color:opts.color||"#fff",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{v}</span></div>;
  const kpi=(l,v,hot)=><div style={{flex:"1 1 120px",padding:"10px 14px",borderRadius:10,border:`1px solid ${hot?"rgba(232,208,152,0.45)":"rgba(255,255,255,0.14)"}`,background:hot?"rgba(184,149,106,0.12)":"rgba(255,255,255,0.04)"}}><p style={{...LBL,color:hot?GOLD_LIGHT:SKY}}>{l}</p><p style={{margin:"4px 0 0",fontSize:15,fontWeight:800,color:hot?GOLD_LIGHT:"#fff",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{v}</p></div>;
  const saldoKpi=(()=>{if(op.lost_in_customs_at)return "USD 0,00";if(!hasBudget)return "Pendiente";return usd(saldoReal);})();
  return <div>
    <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,0.6)",background:"rgba(255,255,255,0.05)",border:HAIR,cursor:"pointer",fontWeight:700,marginBottom:16,padding:"7px 13px",borderRadius:9,letterSpacing:"0.04em"}}>← Volver</button>

    {/* Cabecera: código, estado, nombre, progreso y qué hacer ahora */}
    <div style={PANEL}>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <span style={{fontSize:20,fontWeight:800,color:"#fff",fontFamily:"'JetBrains Mono','SF Mono',monospace",letterSpacing:"0.05em"}}>{op.operation_code}</span>
        {isGI&&<span className="ac-gi-pulse" style={{fontSize:10.5,fontWeight:800,padding:"5px 12px",borderRadius:8,background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.12em",textTransform:"uppercase",border:`1px solid ${GOLD_DEEP}`}}>{t("op.gi")}</span>}
        {(()=>{const active=!["operacion_cerrada","cancelada"].includes(op.status)&&!op.lost_in_customs_at;const color=op.lost_in_customs_at?"#f87171":st.c;return <span style={{fontSize:10.5,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"5px 12px",borderRadius:999,color,border:`1px solid ${color}66`,background:`${color}1f`,display:"inline-flex",alignItems:"center",gap:7}}>{active&&<span className="ac-live-dot" style={{width:6,height:6,borderRadius:"50%",background:color,display:"inline-block"}}/>}{op.lost_in_customs_at?t("ol.heldCustoms"):stLabelOf(op,t)}</span>;})()}
        <span style={{marginLeft:"auto",fontSize:12,color:"rgba(255,255,255,0.6)",fontWeight:600}}>{op.origin==="USA"?"🇺🇸":"🇨🇳"} {t("origin."+(op.origin||"china").toLowerCase())||op.origin||"China"}{op.channel?<> · {t("channel."+op.channel)}</>:null}{op.eta?<> · <span style={{color:SKY}}>{["entregada","operacion_cerrada"].includes(op.status)?t("op.arrived"):"ETA"} {fd(op.eta)}</span></>:null}</span>
      </div>
      <h2 style={{fontSize:19,fontWeight:700,color:op.description?"#fff":"rgba(255,255,255,0.4)",margin:"12px 0 4px",fontStyle:op.description?"normal":"italic"}}>{op.description||(items.length?items.map(i=>i.description).filter(Boolean).slice(0,3).join(", "):t("op.noGoods"))}</h2>
      <OpProgress status={op.status} isAereo={isAer} isGI={isGI} channel={op.channel} hasItems={items.length>0} lostInCustoms={!!op.lost_in_customs_at} docsConfirmed={!!op.docs_confirmed_at}/>
      {op.lost_in_customs_at&&<div style={{marginBottom:6,padding:"12px 16px",background:"rgba(248,113,113,0.08)",border:"1.5px solid rgba(248,113,113,0.4)",borderRadius:12}}>
        <p style={{fontSize:12,fontWeight:800,color:"#fca5a5",margin:0,letterSpacing:"0.05em",textTransform:"uppercase"}}>{t("op.heldTitle")}</p>
        <p style={{fontSize:12.5,color:"rgba(255,255,255,0.75)",margin:"4px 0 0",lineHeight:1.5}}>{t("op.heldDesc")}</p>
      </div>}
      {accion&&<div style={{padding:"14px 18px",borderRadius:12,border:`1px solid ${accion.c}66`,background:`${accion.c}14`,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <span style={{width:10,height:10,borderRadius:"50%",background:accion.c,boxShadow:`0 0 12px ${accion.c}`,flexShrink:0}}/>
        <div style={{flex:1,minWidth:220}}><p style={{margin:0,fontSize:14.5,fontWeight:800,color:accion.c}}>{accion.t}</p><p style={{margin:"3px 0 0",fontSize:12.5,color:"rgba(255,255,255,0.75)",lineHeight:1.5}}>{accion.s}</p></div>
      </div>}
    </div>

    {/* Solapas */}
    {!loading&&(()=>{const def=isEditable?"merc":"resumen";const tabCur=tabDet||def;
      const tabs=[["resumen",t("op.tabResumen")],["merc",t("imports.product")],["bultos",`${t("op.tabBultos")}${pkgs.length?` · ${pkgs.length}`:""}`],["seg",t("op.tabSeg")],...(!isGI&&items.length>0?[["costos",t("op.costPerProduct")]]:[])];
      // Asignar mercadería a bultos se puede en cualquier etapa: no cambia valores, solo el reparto del costo.
      const canAsig=!isGI&&op.channel==="aereo_blanco"&&items.length>1&&pkgs.length>0;
      const toggleAsig=async(it,pkId)=>{const cur=Array.isArray(it.package_ids)?it.package_ids:[];const next=cur.includes(pkId)?cur.filter(x=>x!==pkId):[...cur,pkId];
        setItems(p=>p.map(x=>x.id===it.id?{...x,package_ids:next.length?next:null}:x));
        try{const r=await fetch("/api/portal/asignar-bulto",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({item_id:it.id,package_ids:next,client_id:client?.id})});if(!r.ok)throw new Error("x");}
        catch(e){toast(t("op.assignError"),"error");setItems(p=>p.map(x=>x.id===it.id?{...x,package_ids:cur.length?cur:null}:x));}};
      return <>
      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><div style={{display:"flex",gap:6,padding:5,borderRadius:13,background:"rgba(0,0,0,0.32)",border:"1px solid rgba(255,255,255,0.1)",flexWrap:"wrap",justifyContent:"center"}}>
        {tabs.map(([k,l])=><button key={k} onClick={()=>setTabDet(k)} style={{padding:"10px 18px",fontSize:12,fontWeight:900,letterSpacing:"0.09em",textTransform:"uppercase",borderRadius:10,cursor:"pointer",border:"none",background:tabCur===k?"rgba(255,255,255,0.1)":"transparent",color:tabCur===k?"#fff":"rgba(255,255,255,0.5)",boxShadow:tabCur===k?"inset 0 0 0 1px rgba(255,255,255,0.14)":"none"}}>{l}</button>)}
      </div></div>

      {/* RESUMEN */}
      {tabCur==="resumen"&&<div style={PANEL}>
        <h3 style={{...H3,marginBottom:14}}>Resumen</h3>
        <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
          {kpi(t("ol.import"),op.operation_code)}
          {isGI?<>{kpi("Productos",String(items.length))}{kpi(t("op.totalLanded"),usd(giTotalItems),true)}</>
          :<>{kpi("Bultos",String(nBultos||"—"))}{isAer?<>{kpi("Peso bruto",totGW?`${f2(totGW)} kg`:"—")}{kpi("Peso facturable",pf?`${f2(pf)} kg`:"—",true)}</>:kpi("Volumen",totCBM?`${totCBM.toFixed(3)} m³`:"—",true)}{kpi(t("merc.fobGoods"),fobItems>0?usd(fobItems):"—")}</>}
        </div>
        {(hasBudget||showEstimate)?<div style={{marginTop:22,paddingTop:18,borderTop:HAIR}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}>
            <p style={LBL}>{hasBudget?(isGI?t("op.priceLanded"):"Presupuesto"):"Costo estimado"}</p>
            {showEstimate&&<span title={t("imp.estimateTitle")} style={{fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"3px 9px",borderRadius:999,color:"#fbbf24",background:"rgba(251,191,36,0.14)",border:"1px solid rgba(251,191,36,0.45)"}}>Estimado · lo confirma Argencargo</span>}{hasBudget&&!isGI&&<span title={t("imp.confirmedTitle")} style={{fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"3px 9px",borderRadius:999,color:"#4ade80",background:"rgba(74,222,128,0.12)",border:"1px solid rgba(74,222,128,0.45)"}}>{t("imp.confirmed")}</span>}
            <span style={{flex:1}}/>
            {hasBudget&&!isGI&&<button onClick={downloadPdf} style={{height:30,padding:"0 12px",fontSize:11.5,fontWeight:700,borderRadius:8,border:"1px solid rgba(232,208,152,0.45)",background:"rgba(184,149,106,0.12)",color:GOLD_LIGHT,cursor:"pointer"}}>Presupuesto PDF</button>}
            {!isGI&&["entregada","operacion_cerrada"].includes(op.status)&&<button onClick={downloadClosingPdf} style={{height:30,padding:"0 12px",fontSize:11.5,fontWeight:700,borderRadius:8,border:"1px solid rgba(74,222,128,0.45)",background:"rgba(74,222,128,0.1)",color:"#4ade80",cursor:"pointer"}}>Resumen final PDF</button>}
          </div>
          {isGI&&hasBudget&&<div>{items.map((it,i)=>{const qty=Number(it.quantity||0);const unit=Number(it.unit_price_usd||0);return <div key={it.id||i}>{fila(<>{it.description} <span style={{color:"rgba(255,255,255,0.5)"}}>× {qty} · {usd(unit)} c/u</span></>,usd(qty*unit),{last:i===items.length-1})}</div>;})}</div>}
          {!isGI&&hasBudget&&<div>
            {!isB&&bTax>0&&fila(riPagaImpuestosDirecto?t("op.taxesToAirline"):t("imports.taxes"),usd(bTax),{muted:riPagaImpuestosDirecto})}
            {(isB?(bt-shipCost):bFlete)>0&&fila(isB?t("op.integralService"):t("imports.freight"),usd(isB?(bt-shipCost):bFlete))}
            {!isB&&bSeg>0&&fila(t("op.cargoInsurance"),usd(bSeg))}
            {!isB&&isAer&&Number(op.budget_surcharge||0)>0&&fila(t("op.overweight"),usd(op.budget_surcharge))}
            {shipCost>0&&fila(t("op.homeDelivery"),usd(shipCost))}
            {pmtTotal>0&&fila(`Gestión de pagos${pmtAnticipado>0?` (cobrado ${usd(pmtAnticipado)} de ${usd(pmtTotal)})`:""}`,usd(pmtPendiente),{color:pmtPendiente>0?"#fb923c":"#4ade80"})}
          </div>}
                    {showEstimate&&(()=>{const td=est.taxDetail||{};const bat=Number(est.battExtra||0);
            const impTot=Number(td.derechos||0)+Number(td.tasaE||0)+Number(td.iva||0);
            const gastos=Number(td.desembolso||0)+Number(td.ivaDesembolso||0);
            // Una sola fila: impuestos + gasto documental, y adentro el desglose por producto con
            // el gasto documental ya prorrateado. Antes el desaduanaje iba en una fila aparte
            // debajo y se repetia adentro del desglose: confundia.
            const impYGastos=impTot+gastos;
            const subDe=(x)=>Number(x.derechos||0)+Number(x.tasaE||0)+Number(x.iva||0)+Number(x.gastoDoc||0);
            const detItems=Array.isArray(td.items)?td.items.filter(x=>subDe(x)>0.005):[];
            const pctTxt=(n)=>`${Number(n||0).toLocaleString("es-AR",{maximumFractionDigits:1})}%`;
            const COLS_IMP="minmax(130px,1fr) 88px 88px 88px 104px 96px";
            const cel={fontSize:11.5,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap",textAlign:"right"};
            const rows=[
              [t("op.airFreight"),Number(est.flete||0)-bat,{}],
              [t("op.batterySurcharge"),bat,{}],
              [t("op.overweight"),Number(est.overweightSurcharge||0),{}],
              [t("op.cargoInsurance"),Number(est.seguro||0),{}],
              [riPagaImpuestosDirecto?t("op.taxesAndFeesDirect"):t("op.taxesAndFees"),impYGastos,{imp:true,muted:riPagaImpuestosDirecto}],
            ].filter(([l,v,o])=>o.imp||Number(v||0)>0.005);
            return <div>{rows.map(([l,v,o],k)=><div key={k}>
              {o.imp&&detItems.length>0
                ? <div style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                    <button onClick={()=>setImpOpen(x=>!x)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,width:"100%",padding:"8px 0",background:"none",border:"none",cursor:"pointer",textAlign:"left",font:"inherit"}}>
                      <span style={{fontSize:13,color:o.muted?"rgba(255,255,255,0.55)":"#fff",opacity:0.94,display:"inline-flex",alignItems:"center",gap:7}}>
                        {l}<span style={{fontSize:9,color:GOLD_LIGHT}}>{impOpen?"▲":"▼"}</span>
                      </span>
                      <span style={{fontSize:13.5,fontWeight:600,color:"#fff",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{usd(v)}</span>
                    </button>
                    {impOpen&&<div style={{margin:"0 0 12px",padding:"10px 12px",borderRadius:10,background:"rgba(0,0,0,0.22)",border:HAIR,overflowX:"auto"}}>
                      <div style={{display:"grid",gridTemplateColumns:COLS_IMP,gap:8,padding:"0 0 6px",borderBottom:"1px solid rgba(255,255,255,0.09)"}}>
                        <span style={{...LBL,fontSize:9}}>{t("imp.colProduct")}</span>
                        <span style={{...LBL,fontSize:9,textAlign:"right"}}>{t("imp.colDuties")}</span>
                        <span style={{...LBL,fontSize:9,textAlign:"right"}}>{t("imp.colStat")}</span>
                        <span style={{...LBL,fontSize:9,textAlign:"right"}}>{t("imp.colIva")}</span>
                        <span style={{...LBL,fontSize:9,textAlign:"right"}}>{t("imp.colDoc")}</span>
                        <span style={{...LBL,fontSize:9,textAlign:"right"}}>{t("imp.colSubtotal")}</span>
                      </div>
                      {detItems.map((x,j)=>{
                        const celda=(monto,pct)=><span style={{...cel,color:"rgba(255,255,255,0.75)"}}>{usd(monto)}{pct!=null&&<span style={{display:"block",fontSize:9.5,color:"rgba(255,255,255,0.35)"}}>{pctTxt(pct)}</span>}</span>;
                        return <div key={j} style={{display:"grid",gridTemplateColumns:COLS_IMP,gap:8,alignItems:"baseline",padding:"7px 0",borderBottom:j<detItems.length-1?"1px solid rgba(255,255,255,0.045)":"none"}}>
                          <span style={{fontSize:12,color:"rgba(255,255,255,0.8)",overflow:"hidden",textOverflow:"ellipsis"}}>{x.description||`${t("imp.colProduct")} ${j+1}`}</span>
                          {celda(x.derechos,x.drPct)}
                          {celda(x.tasaE,x.tePct)}
                          {celda(x.iva,x.ivaPct)}
                          {celda(x.gastoDoc,null)}
                          <span style={{...cel,fontWeight:700,color:"#fff"}}>{usd(subDe(x))}</span>
                        </div>;})}
                      <div style={{display:"grid",gridTemplateColumns:COLS_IMP,gap:8,marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.14)"}}>
                        <span style={{fontSize:11.5,fontWeight:800,color:"#fff"}}>{t("common.total")}</span>
                        <span style={{...cel,color:"rgba(255,255,255,0.6)"}}>{usd(td.derechos)}</span>
                        <span style={{...cel,color:"rgba(255,255,255,0.6)"}}>{usd(td.tasaE)}</span>
                        <span style={{...cel,color:"rgba(255,255,255,0.6)"}}>{usd(td.iva)}</span>
                        <span style={{...cel,color:"rgba(255,255,255,0.6)"}}>{usd(gastos)}</span>
                        <span style={{...cel,fontWeight:800,color:GOLD_LIGHT}}>{usd(impYGastos)}</span>
                      </div>
                    </div>}
                  </div>
                : fila(l,usd(v),{muted:o.muted})}
            </div>)}</div>;})()}
          {(()=>{const tot=hasBudget?totalAbonar:Number(est?.totalAbonar||0);
            const label=hasBudget?(cliPmts.length===0?(pmtAnticipado>0?"Saldo a abonar":"A abonar a Argencargo"):"Total a abonar"):"Estimado a abonar a Argencargo";
            // Cuando el cliente paga impuestos por fuera (RI), el total de Argencargo NO es lo
            // que le cuesta la importacion: se muestran los dos numeros separados.
            // El dorado va en el TOTAL DE LA IMPORTACION, no en lo que se le paga a Argencargo:
            // al cliente le importa cuanto le sale la importacion completa. Cuando no hay nada
            // por fuera los dos numeros son el mismo y queda una sola barra dorada.
            const totalImpo=tot+fueraDeAC;
            const aparte=fueraDeAC>0.005;
            const barraDorada=(etiqueta,monto,nota)=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:aparte?8:12,padding:"14px 18px",borderRadius:12,background:GOLD_GRADIENT,boxShadow:GOLD_GLOW}}>
              <span style={{minWidth:0}}>
                <span style={{display:"block",fontSize:11.5,fontWeight:900,color:"#0A1628",textTransform:"uppercase",letterSpacing:"0.1em"}}>{etiqueta}</span>
                {nota&&<span style={{display:"block",fontSize:11,color:"rgba(10,22,40,0.66)",marginTop:3,lineHeight:1.45,fontWeight:600}}>{nota}</span>}
              </span>
              <span style={{fontSize:24,fontWeight:900,color:"#0A1628",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{usd(monto)}</span>
            </div>;
            if(!aparte)return barraDorada(label,tot,null);
            return <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:12,padding:"13px 18px",borderRadius:12,background:"rgba(140,200,245,0.09)",border:"1px solid rgba(140,200,245,0.32)"}}>
                <span style={{fontSize:11.5,fontWeight:900,color:SKY,textTransform:"uppercase",letterSpacing:"0.1em"}}>{label}</span>
                <span style={{fontSize:21,fontWeight:900,color:SKY,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{usd(tot)}</span>
              </div>
              {barraDorada(t(hasBudget?"imp.totalImport":"imp.totalImportEst"),totalImpo,t("imp.totalImportNote"))}
            </>;})()}
          {hasBudget&&cliPmts.length>0&&<div style={{marginTop:12}}>
            {fila("Pagado",usd(totalCli),{color:"#4ade80"})}
            {fila(saldoReal>0.01?"Saldo pendiente":t("op.fullyPaid"),usd(saldoReal),{bold:true,color:saldoReal<=0.01?"#4ade80":GOLD_LIGHT,last:true})}
            <div style={{height:7,background:"rgba(255,255,255,0.08)",borderRadius:999,overflow:"hidden",margin:"8px 0 12px"}}><div style={{width:`${totalAbonar>0?Math.min(100,(totalCli/totalAbonar)*100):0}%`,height:"100%",background:saldoReal<=0.01?"#4ade80":GOLD_LIGHT}}/></div>
            <p style={{...LBL,marginBottom:6}}>Pagos realizados</p>
            {cliPmts.map((p,i)=><div key={p.id} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"7px 0",borderTop:i?"1px solid rgba(255,255,255,0.08)":"none",fontSize:12.5,flexWrap:"wrap"}}><span style={{color:"#fff"}}>{new Date(p.payment_date+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"})} · <span style={{textTransform:"capitalize",color:"rgba(255,255,255,0.7)"}}>{p.payment_method}</span>{p.notes?<span style={{color:"rgba(255,255,255,0.5)"}}> · {p.notes}</span>:null}</span><span style={{fontWeight:700,color:"#4ade80",fontVariantNumeric:"tabular-nums"}}>{usd(p.amount_usd)}{p.currency==="ARS"&&<span style={{display:"block",fontSize:10.5,color:"rgba(255,255,255,0.5)",fontWeight:400,textAlign:"right"}}>ARS {Number(p.amount_ars).toLocaleString("es-AR")} @ {p.exchange_rate}</span>}</span></div>)}
          </div>}
        </div>:<p style={{marginTop:18,fontSize:13,color:"rgba(255,255,255,0.55)",lineHeight:1.5}}>{items.length===0?t("op.estWhenLoaded"):t("op.budgetPending")}</p>}
      </div>}

      {/* MERCADERÍA */}
      {tabCur==="merc"&&<div style={PANEL}>
        <h3 style={{...H3,marginBottom:14}}>{t("imports.product")}</h3>
        {isEditable
          ?<MercaderiaEditor key={op.id} op={op} pkgs={pkgs} items={items} token={token} client={client} onSaved={loadAll}/>
          :<>{op.docs_confirmed_at&&!isGI&&op.channel==="aereo_blanco"&&["en_deposito_origen","en_preparacion"].includes(op.status)&&<p style={{margin:"0 0 12px",padding:"10px 14px",borderRadius:10,border:"1px solid rgba(74,222,128,0.4)",background:"rgba(74,222,128,0.08)",fontSize:12.5,color:"#fff",lineHeight:1.5}}><b style={{color:"#4ade80"}}>{t("op.goodsConfirmed")}</b> el {formatDate(op.docs_confirmed_at)}. Si necesitás cambiar algo, escribinos por WhatsApp y la destrabamos.</p>}
          {items.length===0&&<p style={{fontSize:13,color:"rgba(255,255,255,0.55)",margin:0}}>{t("op.noGoodsYet")}</p>}
          {items.length>0&&!muestraAduana&&<div style={{overflowX:"auto",borderRadius:12,border:HAIR,background:"rgba(255,255,255,0.04)"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,minWidth:520}}>
            <thead><tr>{["Producto","Cant.","USD c/u","FOB","NCM",...(isGI?[]:["Derechos","Tasa est.","IVA"])].map((h,i)=><th key={i} style={{textAlign:i?"right":"left",padding:"8px 10px",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:SKY,borderBottom:"1px solid rgba(255,255,255,0.18)",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>{items.map((it,i)=>{const qty=Number(it.quantity||1);const fob=Number(it.unit_price_usd||0)*qty;const last=i===items.length-1;const td=(c,ci,hot)=><td key={ci} style={{textAlign:ci?"right":"left",padding:"9px 10px",color:hot?GOLD_LIGHT:"#fff",fontWeight:hot?800:ci?500:600,borderBottom:last?"none":"1px solid rgba(255,255,255,0.1)",fontVariantNumeric:"tabular-nums",whiteSpace:ci?"nowrap":"normal"}}>{c}</td>;
              return <tr key={it.id||i}>{[it.description||"—",String(qty),usd(it.unit_price_usd),usd(fob),it.ncm_code&&it.ncm_code!=="MANUAL"?it.ncm_code:(it.import_duty_rate!=null?"Estimado":"—"),...(isGI?[]:[`${it.import_duty_rate??0}%`,`${it.statistics_rate??0}%`,`${it.iva_rate??21}%`])].map((c,ci)=>td(c,ci,ci===4&&it.ncm_code))}</tr>;})}</tbody>
          </table></div>}
          {items.length>0&&!muestraAduana&&<div style={{display:"inline-flex",alignItems:"center",gap:14,marginTop:12,padding:"8px 16px",borderRadius:10,border:"1px solid rgba(232,208,152,0.35)",background:"rgba(184,149,106,0.1)"}}><span style={{fontSize:12,fontWeight:800,color:"#fff",letterSpacing:"0.08em",textTransform:"uppercase"}}>{t("merc.fobGoods")}</span><span style={{fontSize:20,fontWeight:800,color:GOLD_LIGHT,fontVariantNumeric:"tabular-nums"}}>{usd(fobItems)}</span></div>}
          </>}
        {muestraAduana&&(()=>{const declTotal=declaredItems.reduce((s,d)=>s+Number(d.quantity||0)*Number(d.unit_price_declared_usd||0),0);
          return <div style={{marginTop:isEditable?18:0}}>
            <p style={{...LBL,marginBottom:8}}>{t("op.customsDecl")}</p>
            <div style={{overflowX:"auto",borderRadius:12,border:HAIR,background:"rgba(255,255,255,0.04)"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,minWidth:480}}>
              <thead><tr>{["Producto","HS","Cant.","Unit.","Subtotal"].map((h,i)=><th key={i} style={{textAlign:i>1?"right":"left",padding:"8px 10px",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:SKY,borderBottom:"1px solid rgba(255,255,255,0.18)",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>{declaredItems.map((d,i)=>{const sub=Number(d.quantity||0)*Number(d.unit_price_declared_usd||0);const bb="1px solid rgba(255,255,255,0.1)";return <tr key={i}><td style={{padding:"9px 10px",color:"#fff",borderBottom:bb}}>{d.description||"—"}</td><td style={{padding:"9px 10px",fontFamily:"monospace",color:GOLD_LIGHT,borderBottom:bb}}>{d.hs_code||"—"}</td><td style={{padding:"9px 10px",textAlign:"right",color:"#fff",borderBottom:bb}}>{Number(d.quantity||0)}</td><td style={{padding:"9px 10px",textAlign:"right",color:"#fff",borderBottom:bb}}>{usd(d.unit_price_declared_usd)}</td><td style={{padding:"9px 10px",textAlign:"right",fontWeight:700,color:"#fff",borderBottom:bb}}>{usd(sub)}</td></tr>;})}
                <tr><td colSpan={4} style={{padding:"10px",fontSize:11.5,fontWeight:800,color:"#fff",letterSpacing:"0.06em"}}>TOTAL DECLARADO</td><td style={{padding:"10px",textAlign:"right",fontWeight:800,color:GOLD_LIGHT}}>{usd(declTotal)}</td></tr>
              </tbody></table></div>
          </div>;})()}
        {Array.isArray(op.items_backup_json)&&op.items_backup_json.length>0&&!isGI&&op.channel!=="aereo_blanco"&&<details style={{marginTop:12,padding:"8px 12px",borderRadius:10,border:HAIR,background:"rgba(255,255,255,0.03)"}}>
          <summary style={{cursor:"pointer",fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>Ver detalle original ({op.items_backup_json.length} productos antes de agrupar)</summary>
          <p style={{fontSize:11.5,color:"rgba(255,255,255,0.6)",margin:"8px 0 8px",lineHeight:1.5}}>{t("op.customsDeclDesc")}</p>
          {op.items_backup_json.map((it,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"5px 0",fontSize:12,color:"rgba(255,255,255,0.8)",borderTop:"1px solid rgba(255,255,255,0.06)"}}><span>{it.description} <span style={{color:"rgba(255,255,255,0.45)"}}>× {Number(it.quantity||0)}</span></span><span style={{fontVariantNumeric:"tabular-nums"}}>{usd(Number(it.quantity||0)*Number(it.unit_price_usd||0))}</span></div>)}
        </details>}
      </div>}

      {/* BULTOS */}
      {tabCur==="bultos"&&<div style={PANEL}>
        <h3 style={{...H3,marginBottom:6}}>Bultos</h3>
        {canAsig&&<p style={{fontSize:12.5,color:"rgba(255,255,255,0.62)",margin:"0 0 14px",lineHeight:1.5}}>{t("op.pkgAssignDesc")}</p>}
        {!canAsig&&<div style={{marginBottom:12}}/>}
        {pkgs.length===0&&<p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>{t("op.noPkgsYet")}</p>}
        {repackInfo&&(()=>{const before=Number(repackInfo.original_billable_kg||0);const after=Number(repackInfo.new_billable_kg||0);const delta=before-after;const pct=before>0?(delta/before*100):0;
          return <div style={{marginBottom:12,padding:"10px 14px",borderRadius:10,border:"1px solid rgba(74,222,128,0.4)",background:"rgba(74,222,128,0.08)",fontSize:12.5,color:"#fff"}}><b style={{color:"#4ade80"}}>{t("op.repackDone")}</b> Peso facturable {f2(before)} kg → <b>{f2(after)} kg</b>{delta>0&&<span style={{color:"#4ade80",marginLeft:6}}>(−{pct.toFixed(0)}%)</span>}</div>;})()}
        {pkgs.length>0&&<>
          <div className="op-pk-head" style={{display:"grid",gridTemplateColumns:"96px minmax(0,1fr) 130px 104px 104px 90px 112px",gap:10,padding:"0 12px 8px"}}>{["Bulto","Tracking","Medidas","Peso bruto",t("dep.volumetric"),"m³","Escaneo"].map((h,i)=><p key={i} style={{...LBL,textAlign:i>=2?"center":"left"}}>{h}</p>)}</div>
          {pkData.map((p,i)=>{const hot=p.vw>p.gw;const enEste=items.filter(it=>Array.isArray(it.package_ids)&&it.package_ids.includes(p.id));
            return <div key={p.id} style={{marginBottom:8,borderRadius:11,border:HAIR,background:"rgba(255,255,255,0.04)"}}>
              <div className="op-pk-row" style={{display:"grid",gridTemplateColumns:"96px minmax(0,1fr) 130px 104px 104px 90px 112px",gap:10,alignItems:"center",padding:"11px 12px"}}>
                <span style={{fontSize:13,fontWeight:800,color:"#fff",whiteSpace:"nowrap"}}>Bulto {i+1}{Number(p.quantity)>1?<span style={{color:"rgba(255,255,255,0.5)",fontWeight:600}}> ×{p.quantity}</span>:null}</span>
                <span className="op-pk-track" style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}><span style={{fontFamily:"'JetBrains Mono','SF Mono',monospace",fontSize:12,color:"rgba(255,255,255,0.8)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={p.national_tracking||""}>{p.national_tracking||"—"}</span>{p.national_tracking&&<button onClick={()=>{navigator.clipboard?.writeText(p.national_tracking);toast("Tracking copiado","success");}} title="Copiar" style={{height:22,padding:"0 7px",fontSize:10,fontWeight:700,borderRadius:5,border:HAIR,background:"rgba(255,255,255,0.06)",color:SKY,cursor:"pointer",flexShrink:0}}>copiar</button>}</span>
                <span style={{fontSize:12.5,color:"#fff",textAlign:"center",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{p.l&&p.w&&p.h?`${p.l}×${p.w}×${p.h} cm`:"—"}</span>
                <span style={{fontSize:13,fontWeight:700,color:!hot&&p.gw>0?GOLD_LIGHT:"#fff",textAlign:"center",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{p.gw>0?`${f2(p.gw)} kg`:"—"}</span>
                <span style={{fontSize:13,fontWeight:700,color:hot?GOLD_LIGHT:"#fff",textAlign:"center",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{p.vw>0?`${f2(p.vw)} kg`:"—"}</span>
                <span style={{fontSize:12.5,color:"#fff",textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{p.cbm>0?p.cbm.toFixed(3):"—"}</span>
                <span style={{textAlign:"center"}}>{p.photo_url?<button onClick={()=>setLightboxPhoto({url:p.photo_url,n:i+1,trk:p.national_tracking})} style={{padding:"6px 12px",fontSize:11.5,fontWeight:700,borderRadius:8,border:"1px solid rgba(140,200,245,0.6)",background:"rgba(140,200,245,0.14)",color:SKY,cursor:"pointer",whiteSpace:"nowrap"}}>{t("dep.viewScan")}</button>:<span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{t("dep.noPhoto")}</span>}</span>
              </div>
              {canAsig&&(()=>{const open=pkOpenDet===p.id;const label=enEste.length===0?t("op.variousUnassigned"):enEste.map(it=>it.description||t("calc.product")).join(", ");
                return <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 12px 11px",flexWrap:"wrap"}}>
                  <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:SKY}}>{t("imports.product")}</span>
                  <div style={{position:"relative",flex:"1 1 260px",maxWidth:460,minWidth:0}}>
                    <button onClick={()=>setPkOpenDet(open?null:p.id)} style={{width:"100%",boxSizing:"border-box",height:38,padding:"0 12px",fontSize:13,borderRadius:9,background:"rgba(255,255,255,0.07)",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,cursor:"pointer",color:enEste.length?GOLD_LIGHT:"rgba(255,255,255,0.65)",fontWeight:enEste.length?700:500,border:`1px solid ${open?"rgba(232,208,152,0.85)":"rgba(255,255,255,0.2)"}`}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span><span style={{fontSize:10,color:SKY,flexShrink:0}}>{open?"▲":"▼"}</span></button>
                    {open&&<><div onClick={()=>setPkOpenDet(null)} style={{position:"fixed",inset:0,zIndex:40}}/><div style={{position:"absolute",left:0,top:42,zIndex:41,minWidth:"100%",width:"max-content",maxWidth:420,maxHeight:320,overflowY:"auto",padding:6,borderRadius:12,background:"#0E1B30",border:"1px solid rgba(232,208,152,0.5)",boxShadow:"0 16px 40px rgba(0,0,0,0.55)"}}>
                      {items.map(it=>{const on=Array.isArray(it.package_ids)&&it.package_ids.includes(p.id);return <button key={it.id} onClick={()=>toggleAsig(it,p.id)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 10px",borderRadius:8,border:"none",background:on?"rgba(184,149,106,0.16)":"transparent",color:on?GOLD_LIGHT:"#fff",fontSize:13,fontWeight:on?700:500,cursor:"pointer",textAlign:"left"}}><span style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${on?GOLD_LIGHT:"rgba(255,255,255,0.45)"}`,background:on?GOLD_GRADIENT:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,color:"#0A1628",fontWeight:900}}>{on?"✓":""}</span><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.description||"Producto"}</span></button>;})}
                    </div></>}
                  </div>
                </div>;})()}
            </div>;})}
          <div style={{display:"flex",gap:9,flexWrap:"wrap",marginTop:10}}>
            {isAer?<>{kpi("Peso bruto total",`${f2(totGW)} kg`,totGW>=totVW&&totGW>0)}{kpi(t("op.volTotal"),`${f2(totVW)} kg`,totVW>totGW)}{kpi("Facturable",`${f2(pf)} kg`,true)}{kpi("Volumen",`${totCBM.toFixed(3)} m³`)}</>:<>{kpi("Volumen total",`${totCBM.toFixed(3)} m³`,true)}{kpi("Peso bruto",`${f2(totGW)} kg`)}</>}
          </div>
        </>}
      </div>}

      {/* SEGUIMIENTO */}
      {tabCur==="seg"&&<div style={PANEL}>
        <h3 style={{...H3,marginBottom:14}}>Seguimiento</h3>
        {events.length===0&&pmts.length===0&&<p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>{t("op.noNews")}</p>}
        {pmts.length>0&&<div>
          <p style={{...LBL,marginBottom:8}}>{t("op.supplierPayments")}</p>
          {pmts.map((pm,i)=>{const gs={pendiente:["Pendiente","#fbbf24"],enviado:["Enviado",SKY],confirmado:["Confirmado","#4ade80"]}[pm.giro_status]||[pm.giro_status,"#fff"];return <div key={pm.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",padding:"8px 0",borderTop:i?"1px solid rgba(255,255,255,0.08)":"none"}}>
            <span style={{fontSize:13,color:"#fff",fontWeight:600}}>{pm.description||`Pago ${i+1}`}{pm.client_paid_date?<span style={{color:"rgba(255,255,255,0.5)",fontWeight:500}}> · pagado el {fd(pm.client_paid_date)}</span>:null}</span>
            <span style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:10,fontWeight:800,letterSpacing:"0.05em",textTransform:"uppercase",padding:"3px 9px",borderRadius:999,color:pm.client_paid?"#4ade80":"#fbbf24",background:pm.client_paid?"rgba(74,222,128,0.12)":"rgba(251,191,36,0.12)"}}>{pm.client_paid?"Pagado":t("op.paymentPending")}</span><span style={{fontSize:10,fontWeight:800,letterSpacing:"0.05em",textTransform:"uppercase",padding:"3px 9px",borderRadius:999,color:gs[1],background:`${gs[1]}1f`}}>Giro {gs[0]}</span><span style={{fontSize:14,fontWeight:800,color:GOLD_LIGHT,fontVariantNumeric:"tabular-nums"}}>{usd(pm.client_amount_usd)}</span></span>
          </div>;})}
        </div>}
        {events.length>0&&<div style={{marginTop:pmts.length?20:0,paddingTop:pmts.length?16:0,borderTop:pmts.length?HAIR:"none"}}>
          <p style={{...LBL,marginBottom:12}}>Novedades</p>
          <div style={{position:"relative",paddingLeft:22}}><div style={{position:"absolute",left:6,top:8,bottom:8,width:2,background:"rgba(255,255,255,0.1)"}}/>
            {events.map((ev,i)=><div key={ev.id} style={{position:"relative",paddingBottom:i<events.length-1?16:0}}><div style={{position:"absolute",left:-21,top:5,width:12,height:12,borderRadius:"50%",background:i===0?GOLD_LIGHT:"rgba(255,255,255,0.18)",boxShadow:i===0?"0 0 0 4px rgba(232,208,152,0.2)":"none"}}/>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><p style={{fontSize:13.5,fontWeight:700,color:i===0?"#fff":"rgba(255,255,255,0.65)",margin:0}}>{ev.title}</p><p style={{fontSize:11.5,color:SKY,margin:0,fontWeight:600,whiteSpace:"nowrap"}}>{ev.occurred_at?new Date(ev.occurred_at).toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):""}</p></div>
              {ev.description&&<p style={{fontSize:12,color:"rgba(255,255,255,0.6)",margin:"2px 0 0",lineHeight:1.45}}>{ev.description}{ev.location?` · ${ev.location}`:""}</p>}
            </div>)}
          </div>
        </div>}
      </div>}

      {/* COSTO POR PRODUCTO */}
      {tabCur==="costos"&&<div style={PANEL}>
        <h3 style={{...H3,marginBottom:6}}>{t("op.costPerProductLanded")}</h3>
        <p style={{fontSize:12.5,color:"rgba(255,255,255,0.62)",margin:"0 0 14px",lineHeight:1.5}}>{items.some(it=>Array.isArray(it.package_ids)&&it.package_ids.length)?t("op.costByPkg"):t("op.costByFob")}{showEstimate?" "+t("op.costEstNote"):""}</p>
        {costoPorProducto.length===0?<p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>{items.length===0?t("op.loadToSeeCost"):t("op.cantCalcCost")}</p>
        :<div style={{overflowX:"auto",borderRadius:12,border:HAIR,background:"rgba(255,255,255,0.04)"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,minWidth:680}}>
          <thead><tr>{["Producto","Cant.","FOB c/u","Impuestos c/u","Flete y gastos c/u",t("op.landedEach"),"Total"].map((h,i)=><th key={i} style={{textAlign:i?"right":"left",padding:"8px 10px",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:i===5?GOLD_LIGHT:SKY,borderBottom:"1px solid rgba(255,255,255,0.18)",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>{costoPorProducto.map((r,i)=>{const last=i===costoPorProducto.length-1;const td=(c,ci,hot)=><td key={ci} style={{textAlign:ci?"right":"left",padding:"9px 10px",color:hot?GOLD_LIGHT:"#fff",fontWeight:hot?800:ci?500:600,borderBottom:last?"none":"1px solid rgba(255,255,255,0.1)",fontVariantNumeric:"tabular-nums",whiteSpace:ci?"nowrap":"normal"}}>{c}</td>;
            const bultos=pkData.map((p,k)=>Array.isArray(r.it.package_ids)&&r.it.package_ids.includes(p.id)?k+1:null).filter(Boolean);
            return <tr key={r.it.id||i}>{[<>{r.it.description||"—"}{bultos.length>0&&<span style={{display:"block",fontSize:10.5,color:SKY,fontWeight:600}}>Bulto {bultos.join(", ")}</span>}</>,String(r.qty),usd(r.fobUnit),usd(r.taxUnit),usd(r.svcUnit),usd(r.totalUnit),usd(r.total)].map((c,ci)=>td(c,ci,ci===5))}</tr>;})}
            <tr><td colSpan={6} style={{padding:"11px 10px",fontSize:11.5,fontWeight:800,color:"#fff",letterSpacing:"0.06em",textTransform:"uppercase",borderTop:"1px solid rgba(232,208,152,0.4)"}}>{t("op.totalLanded")}</td><td style={{padding:"11px 10px",textAlign:"right",fontWeight:900,fontSize:14,color:GOLD_LIGHT,fontVariantNumeric:"tabular-nums",borderTop:"1px solid rgba(232,208,152,0.4)",whiteSpace:"nowrap"}}>{usd(costoPorProducto.reduce((s,r)=>s+r.total,0))}</td></tr>
          </tbody>
        </table></div>}
      </div>}
      </>;})()}
    {loading&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.5)",padding:"2rem 0"}}>Cargando…</p>}

    {/* Visor de escaneo */}
    {lightboxPhoto&&<div onClick={()=>setLightboxPhoto(null)} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(4,9,20,0.82)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg, #16243E, #101B31)",border:"1px solid rgba(255,255,255,0.14)",borderRadius:16,padding:14,maxWidth:"min(560px, 92vw)",boxShadow:"0 30px 70px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:10}}>
          <span style={{fontSize:12,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:"#fff"}}>Escaneo{lightboxPhoto.n?` · Bulto ${lightboxPhoto.n}`:""}{lightboxPhoto.trk&&<span style={{marginLeft:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:SKY,textTransform:"none",letterSpacing:0}}>{lightboxPhoto.trk}</span>}</span>
          <button onClick={()=>setLightboxPhoto(null)} style={{height:30,padding:"0 12px",fontSize:12,fontWeight:700,borderRadius:8,border:HAIR,background:"rgba(255,255,255,0.07)",color:"#fff",cursor:"pointer"}}>Cerrar</button>
        </div>
        <img src={lightboxPhoto.url||lightboxPhoto} alt={t("dep.scanTitle")} style={{display:"block",maxWidth:"100%",maxHeight:"62vh",borderRadius:10,border:HAIR,objectFit:"contain"}}/>
      </div>
    </div>}
  </div>;
}

function ProfilePage({client,token}){
  const {t}=useT();
  if(!client)return null;
  const f=[{l:t("auth.firstName"),v:`${client.first_name} ${client.last_name}`},{l:t("profile.code"),v:client.client_code,m:true},{l:t("auth.email"),v:client.email},{l:t("auth.whatsapp"),v:client.whatsapp},{l:"DNI",v:client.dni||"—"},{l:t("profile.address"),v:`${client.street}${client.floor_apt?`, ${client.floor_apt}`:""}`},{l:t("profile.locality"),v:`${client.city}, ${client.province}`},{l:t("profile.zip"),v:client.postal_code},{l:t("profile.vat"),v:t("tax."+(client.tax_condition||"consumidor_final"))}];
  const [exporting,setExporting]=useState(false);
  const [pwd1,setPwd1]=useState("");const [pwd2,setPwd2]=useState("");const [pwdMsg,setPwdMsg]=useState("");const [pwdErr,setPwdErr]=useState("");const [pwdSaving,setPwdSaving]=useState(false);
  const changePwd=async()=>{
    setPwdMsg("");setPwdErr("");
    if(!pwd1||pwd1.length<6){setPwdErr(t("profile.min6"));return;}
    if(pwd1!==pwd2){setPwdErr(t("auth.reset.passwordsDontMatch"));return;}
    setPwdSaving(true);
    try{
      const r=await fetch(`${SB_URL}/auth/v1/user`,{method:"PUT",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({password:pwd1})}).then(x=>x.json());
      if(r?.error||r?.msg||r?.error_description){setPwdErr(r.msg||r.error_description||t("profile.pwdError"));}
      else{setPwdMsg(t("profile.changed"));setPwd1("");setPwd2("");setTimeout(()=>setPwdMsg(""),3000);}
    }catch(e){setPwdErr(t("common.connError"));}
    setPwdSaving(false);
  };
  const exportHistory=async(format)=>{
    setExporting(true);
    try{
      const ops=await dq("operations",{token,filters:`?client_id=eq.${client.id}&select=operation_code,description,channel,origin,status,budget_total,collected_amount,is_collected,created_at,closed_at,delivered_at,eta&order=created_at.desc`});
      const opsArr=Array.isArray(ops)?ops:[];
      if(opsArr.length===0){alert("No tenés importaciones para exportar todavía.");setExporting(false);return;}
      const chLbl={aereo_blanco:t("channel.aereo_blanco"),maritimo_blanco:t("hist.seaLcl"),maritimo_negro:t("channel.maritimo_negro")};
      const stLbl={pendiente:t("hist.pending"),en_deposito_origen:t("hist.inWarehouse"),en_preparacion:t("ol.inPreparation"),en_transito:t("stage.transito"),arribo_argentina:t("op.arrived"),en_aduana:t("hist.inCustoms"),entregada:"Entregada",operacion_cerrada:"Cerrada",cancelada:"Cancelada"};
      if(format==="csv"){
        const headers=[t("hist.code"),t("common.description"),"Origen","Canal","Estado",t("hist.created"),"Fecha entrega","Presupuesto USD","Cobrado USD","Cobrada"];
        const rows=opsArr.map(o=>[o.operation_code,`"${(o.description||"").replace(/"/g,'""')}"`,o.origin||"",chLbl[o.channel]||o.channel||"",stLbl[o.status]||o.status||"",o.created_at?o.created_at.slice(0,10):"",o.delivered_at?o.delivered_at.slice(0,10):"",Number(o.budget_total||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}),Number(o.collected_amount||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}),o.is_collected?"Sí":"No"].join(","));
        const csv=[headers.join(","),...rows].join("\n");
        const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
        const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`mis-importaciones-${client.client_code}-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
      } else {
        // PDF: imprimir HTML simple
        const total=opsArr.reduce((s,o)=>s+Number(o.budget_total||0),0);
        const cobrado=opsArr.reduce((s,o)=>s+Number(o.collected_amount||0),0);
        const w=window.open("","_blank");if(!w){alert("Permití pop-ups para descargar el PDF");setExporting(false);return;}
        const tbl=opsArr.map(o=>`<tr><td><strong>${o.operation_code}</strong></td><td>${o.description||"—"}</td><td>${o.origin||""}</td><td>${chLbl[o.channel]||""}</td><td><span class="badge">${stLbl[o.status]||""}</span></td><td>${o.created_at?o.created_at.slice(0,10):""}</td><td class="r">USD ${Number(o.budget_total||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td class="c">${o.is_collected?"✓":"—"}</td></tr>`).join("");
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Histórico ${client.client_code}</title><style>
          *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact}
          @page{size:A4;margin:1.5cm}
          body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;font-size:11px;line-height:1.5;padding:20px}
          .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1B4F8A;padding-bottom:14px;margin-bottom:20px}
          .header img{max-width:160px;height:auto}
          .header .meta{text-align:right;font-size:10px;color:#666}
          .header .meta .code{color:#1B4F8A;font-size:13px;font-weight:700;font-family:monospace;display:block;margin-bottom:4px}
          h1{font-size:20px;color:#1B4F8A;margin:0 0 6px}
          .sub{color:#666;margin-bottom:18px}
          .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
          .stats div{padding:12px;background:#f5f7fa;border-radius:6px}
          .stats b{display:block;color:#1B4F8A;font-size:16px;margin-top:2px}
          .stats span{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.05em;font-weight:700}
          table{width:100%;border-collapse:collapse;font-size:10px}
          th,td{padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left}
          th{background:#1B4F8A;color:#fff;font-size:9px;text-transform:uppercase;letter-spacing:0.05em}
          td.c{text-align:center}td.r{text-align:right}
          .badge{display:inline-block;padding:2px 8px;background:#e0e7ff;color:#1e40af;border-radius:4px;font-size:9px;font-weight:600}
          tr:nth-child(even) td{background:#fafbfc}
          .footer{margin-top:24px;padding:14px;background:#152D54;color:#fff;border-radius:8px;text-align:center;font-size:10px}
        </style></head><body>
          <div class="header"><img src="https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png" alt="Argencargo"/><div class="meta"><span class="code">${client.client_code}</span>${client.first_name} ${client.last_name}<br/>Generado ${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}</div></div>
          <h1>${t("hist.title")}</h1>
          <p class="sub">${t("hist.subtitle")}</p>
          <div class="stats">
            <div><span>Total ops</span><b>${opsArr.length}</b></div>
            <div><span>Cerradas</span><b>${opsArr.filter(o=>o.is_collected).length}</b></div>
            <div><span>USD facturado</span><b>USD ${total.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div>
            <div><span>USD pagado</span><b>USD ${cobrado.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</b></div>
          </div>
          <table><thead><tr><th>{t("hist.code")}</th><th>{t("imports.product")}</th><th>Origen</th><th>Canal</th><th>Estado</th><th>Fecha</th><th class="r">Monto</th><th class="c">Pagada</th></tr></thead><tbody>${tbl}</tbody></table>
          <div class="footer"><strong>ARGENCARGO</strong> · +54 9 11 2508-8580 · info@argencargo.com.ar · Virrey Loreto 2428, Belgrano CABA</div>
          <script>setTimeout(()=>window.print(),400)</script>
        </body></html>`);w.document.close();
      }
    }catch(e){alert("Error: "+e.message);}
    setExporting(false);
  };
  const ti=getTierInfo(client.tier);
  return <div><h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 24px",letterSpacing:"-0.02em"}}>{t("profile.title")}</h2>
  {/* Badge de categoría — solo etiqueta visual, sin beneficios (sistema de puntos desactivado 11/06/2026). */}
  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,padding:"16px 20px",background:`linear-gradient(135deg, ${ti.color}1a, rgba(255,255,255,0.02))`,border:`1px solid ${ti.color}55`,borderRadius:14}}>
    <span style={{fontSize:30,lineHeight:1}}>{ti.icon}</span>
    <div>
      <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.1em"}}>{t("profile.yourTier")}</p>
      <p style={{fontSize:20,fontWeight:800,margin:0,letterSpacing:"-0.01em",background:ti.gradient,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{ti.label}</p>
    </div>
  </div>
  <div style={{background:"rgba(255,255,255,0.025)",borderRadius:16,border:"1px solid rgba(255,255,255,0.06)",padding:"1.75rem 2rem"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px 28px"}}>{f.map((x,i)=><div key={i}><p style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.45)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.08em"}}>{x.l}</p><p style={{fontSize:15,color:"#fff",margin:0,fontWeight:500,...(x.m?{fontFamily:"'JetBrains Mono','SF Mono',monospace",fontSize:18,color:GOLD_LIGHT,letterSpacing:"0.04em"}:{})}}>{x.v||<span style={{color:"rgba(255,255,255,0.3)"}}>—</span>}</p></div>)}</div></div>
    <div style={{background:"rgba(184,149,106,0.06)",borderRadius:12,border:"1px solid rgba(184,149,106,0.18)",padding:"14px 20px",marginTop:16,display:"flex",alignItems:"center",gap:12}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD_LIGHT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg><p style={{fontSize:13,color:"rgba(255,255,255,0.65)",margin:0,lineHeight:1.5}}>{t("profile.codeNote",{code:client.client_code})}</p></div>
    {/* Cambiar contraseña */}
    <div style={{background:"rgba(255,255,255,0.025)",borderRadius:16,border:"1px solid rgba(255,255,255,0.06)",padding:"1.5rem 2rem",marginTop:16}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>🔒 {t("profile.changePassword")}</h3>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.55)",margin:"0 0 14px",lineHeight:1.5}}>{t("profile.min6Session")}</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div><p style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.45)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.08em"}}>{t("profile.newPassword")}</p><input type="password" value={pwd1} onChange={e=>setPwd1(e.target.value)} autoComplete="new-password" style={{width:"100%",padding:"10px 12px",fontSize:14,background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"#fff",outline:"none"}}/></div>
        <div><p style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.45)",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.08em"}}>{t("auth.passwordConfirm")}</p><input type="password" value={pwd2} onChange={e=>setPwd2(e.target.value)} autoComplete="new-password" style={{width:"100%",padding:"10px 12px",fontSize:14,background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"#fff",outline:"none"}}/></div>
      </div>
      {pwdErr&&<p style={{fontSize:12,color:"#f87171",margin:"0 0 10px"}}>{pwdErr}</p>}
      {pwdMsg&&<p style={{fontSize:12,color:"#22c55e",margin:"0 0 10px"}}>✓ {pwdMsg}</p>}
      <button onClick={changePwd} disabled={pwdSaving} style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:`1px solid ${GOLD_DEEP}`,background:GOLD_GRADIENT,color:"#0A1628",cursor:pwdSaving?"wait":"pointer",opacity:pwdSaving?0.5:1}}>{pwdSaving?"Guardando...":t("profile.changePassword")}</button>
    </div>
    {/* Exportar histórico */}
    <div style={{background:"rgba(255,255,255,0.025)",borderRadius:16,border:"1px solid rgba(255,255,255,0.06)",padding:"1.5rem 2rem",marginTop:16}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>📥 {t("profile.exportTitle")}</h3>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.55)",margin:"0 0 14px",lineHeight:1.5}}>{t("profile.exportDesc")}</p>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>exportHistory("pdf")} disabled={exporting} style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:`1px solid ${GOLD_DEEP}`,background:GOLD_GRADIENT,color:"#0A1628",cursor:exporting?"wait":"pointer",opacity:exporting?0.5:1}}>📄 {t("profile.downloadPdf")}</button>
        <button onClick={()=>exportHistory("csv")} disabled={exporting} style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:"1px solid rgba(34,197,94,0.4)",background:"rgba(34,197,94,0.08)",color:"#22c55e",cursor:exporting?"wait":"pointer",opacity:exporting?0.5:1}}>📊 {t("profile.downloadCsv")}</button>
      </div>
    </div>
  </div>;
}
// Funcion y no constante: las etiquetas se traducen, y una constante de modulo se evalua
// al cargar el archivo, cuando todavia no existe ningun traductor.
const serviciosC=(tr)=>[{key:"aereo_a_china",label:tr("rates.airTitle"),info:tr("rates.airSub"),unit:"kg"},{key:"maritimo_a_china",label:"Marítimo Carga LCL/FCL — China",unit:"cbm",info:""},{key:"maritimo_b",label:"Marítimo Integral AC",unit:"cbm",info:""}];
function RatesPage({token,client}){
  const {t:tr}=useT();
  const [tariffs,setTariffs]=useState([]);const [overrides,setOverrides]=useState([]);const [lo,setLo]=useState(true);
  useEffect(()=>{(async()=>{const [t,ov]=await Promise.all([dq("tariffs",{token,filters:"?select=*&order=service_key.asc,sort_order.asc"}),client?dq("client_tariff_overrides",{token,filters:`?client_id=eq.${client.id}&select=*`}):Promise.resolve([])]);setTariffs(Array.isArray(t)?t:[]);setOverrides(Array.isArray(ov)?ov:[]);setLo(false);})();},[token,client?.id]);
  const getRate=(t)=>{const ov=overrides.find(o=>o.tariff_id===t.id);return ov?{rate:ov.custom_rate,promo:true,base:t.rate}:{rate:t.rate,promo:false,base:t.rate};};
  const hideRanges=svc=>svc==="maritimo_b";
  // Solo la versión vigente HOY de cada tarifa (oculta versiones históricas).
  const _tnow=Date.now();const tariffsNow=tariffs.filter(t=>(t.effective_from==null||Date.parse(t.effective_from)<=_tnow)&&(t.effective_to==null||_tnow<Date.parse(t.effective_to)));
  if(lo)return <p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"2rem 0"}}>{tr("common.loading")}</p>;
  return <div><h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 24px",letterSpacing:"-0.02em"}}>{tr("rates.title")}</h2>
    {serviciosC(tr).map(svc=>{const rates=tariffsNow.filter(t=>t.service_key===svc.key&&t.type==="rate");const specials=tariffsNow.filter(t=>t.service_key===svc.key&&t.type==="special");if(!rates.length)return null;
    return <div key={svc.key} style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.25rem 1.5rem",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h3 style={{fontSize:15,fontWeight:700,color:"#fff",margin:0}}>{svc.label}</h3>{svc.info&&<span style={{fontSize:11,color:"rgba(255,255,255,0.45)",padding:"4px 10px",background:"rgba(255,255,255,0.028)",borderRadius:6}}>{svc.info}</span>}</div>
      {hideRanges(svc.key)?<div style={{textAlign:"center",padding:"16px 0"}}><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 8px"}}>{tr("rates.varies")}</p><p style={{fontSize:14,fontWeight:600,color:IC,margin:0}}>{tr("rates.askForQuote")}</p></div>:
      <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
        {rates.map(t=>{const{rate,promo,base}=getRate(t);return <tr key={t.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}><td style={{padding:"10px 0",fontSize:13,color:"rgba(255,255,255,0.6)"}}>{t.label}</td><td style={{padding:"10px 0",textAlign:"right",fontSize:14,fontWeight:700,color:promo?IC:"#fff"}}>{promo&&<span style={{fontSize:12,color:"rgba(255,255,255,0.4)",textDecoration:"line-through",marginRight:8}}>${Number(base).toLocaleString("es-AR")}</span>}${Number(rate).toLocaleString("es-AR")} / {svc.unit}{promo&&<span style={{fontSize:10,marginLeft:8,padding:"2px 6px",borderRadius:4,background:"rgba(184,149,106,0.15)",color:IC}}>{tr("rates.promo")}</span>}</td></tr>;})}
      </tbody></table>}
      {specials.length>0&&<div style={{borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:8,paddingTop:10}}>{specials.map(s=><div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{s.label}</span><span style={{fontSize:12,fontWeight:600,color:"#fff"}}>${Number(s.rate).toLocaleString("es-AR")} / {svc.unit}{s.notes&&<span style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginLeft:8}}>{s.notes}</span>}</span></div>)}</div>}
    </div>;})}
  </div>;
}
// Genera la hoja A4 imprimible de la cotización desde la calculadora del portal cliente.
// Misma estética y layout que el printPdf del admin — el cliente puede descargar el
// mismo PDF que se le envía manualmente. Recibe el canal expandido + contexto.
// NOTA: el nombre "printPortalCalcPdf" evita colisión con el printQuotePdf de
// lib/pdf-templates.js (que es para PDF de cotizaciones cerradas con op).
function printPortalCalcPdf({ch,products,totalFob,origin,clientName,delivCost=0,t}){
  if(typeof window==="undefined")return;
  const w=window.open("","_blank");if(!w)return;
  const fmt=(n)=>Number(n||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const isAereo=ch.key?.includes("aereo");
  const isBlanco=Boolean(ch.isBlanco);
  const isMaritimo=ch.key?.includes("maritimo");
  const fleteAmt=isAereo?(ch.pesoFact||ch.pesoBruto||0):(ch.cbm||0);
  const fleteAmtLbl=isAereo?`${fmt(fleteAmt)} kg`:`${Number(fleteAmt||0).toFixed(4)} m³`;
  // Productos
  // toN: el precio puede venir con coma ("2,9") desde el input — Number() lo tiraba a NaN y la fila desaparecía.
  const rows=(products||[]).filter(p=>toN(p.unit_price_usd||p.unit_price)>0).map(p=>{
    const up=toN(p.unit_price_usd||p.unit_price);
    const fob=up*(toN(p.quantity)||1);
    return `<tr><td>${(p.description||"—").replace(/</g,"&lt;")}</td><td class="c">${p.quantity||1}</td><td class="r">USD ${fmt(up)}</td><td class="r">USD ${fmt(fob)}</td><td class="c mono">${p.ncm?.ncm_code||p.ncm_code||"—"}</td></tr>`;
  }).join("");
  // Aduana (solo canales A — isBlanco). Si el portal trae los items pre-agregados los uso directamente.
  let derechos=0,tasaE=0,iva=0,ivaAdic=0,iigg=0,iibb=0,desemb=0,ivaDesemb=0;
  if(isBlanco&&Array.isArray(ch.items)){
    ch.items.forEach(it=>{
      derechos+=Number(it.derechos||0);tasaE+=Number(it.tasa_e||0);iva+=Number(it.iva||0);
      ivaAdic+=Number(it.ivaAdic||0);iigg+=Number(it.iigg||0);iibb+=Number(it.iibb||0);
      desemb+=Number(it.desembolso||0);ivaDesemb+=Number(it.ivaDesemb||0);
    });
  }
  const rowsServicios=[];
  if((Number(ch.flete||0)+Number(ch.surcharge||0))>0)rowsServicios.push(`<div class="row"><span>${ch.key==="maritimo_a_china"?t("pq.seaService"):(Number(ch.surcharge||0)>0?t("pq.integralService"):t("pq.freight"))}</span><span>USD ${fmt(Number(ch.flete||0)+Number(ch.surcharge||0))}</span></div>`);
  if(Number(ch.battExtra||0)>0)rowsServicios.push(`<div class="row"><span>${t("op.batterySurcharge")}</span><span>USD ${fmt(ch.battExtra)}</span></div>`);
  if(Number(ch.overweightSurcharge||0)>0)rowsServicios.push(`<div class="row"><span>${t("op.overweight")}</span><span>USD ${fmt(ch.overweightSurcharge)}</span></div>`);
  if(Number(ch.seguro||0)>0)rowsServicios.push(`<div class="row"><span>Seguro</span><span>USD ${fmt(ch.seguro)}</span></div>`);
  if(delivCost>0)rowsServicios.push(`<div class="row"><span>${t("pq.shipCaba")}</span><span>USD ${fmt(delivCost)}</span></div>`);
  const rowsAduana=[];
  if(isBlanco){
    if(derechos>0)rowsAduana.push(`<div class="row"><span>${t("pq.duties")}</span><span>USD ${fmt(derechos)}</span></div>`);
    if(tasaE>0)rowsAduana.push(`<div class="row"><span>${t("merc.statRate")}</span><span>USD ${fmt(tasaE)}</span></div>`);
    if(iva>0)rowsAduana.push(`<div class="row"><span>${t("pq.ivaImport")}</span><span>USD ${fmt(iva)}</span></div>`);
    if(isMaritimo){
      if(ivaAdic>0)rowsAduana.push(`<div class="row"><span>IVA adicional</span><span>USD ${fmt(ivaAdic)}</span></div>`);
      if(iigg>0)rowsAduana.push(`<div class="row"><span>Ganancias (IIGG)</span><span>USD ${fmt(iigg)}</span></div>`);
      if(iibb>0)rowsAduana.push(`<div class="row"><span>Ingresos brutos (IIBB)</span><span>USD ${fmt(iibb)}</span></div>`);
    }
    if(isAereo&&desemb>0)rowsAduana.push(`<div class="row"><span>Desaduanaje (gastos documentales)</span><span>USD ${fmt(desemb)}</span></div>`);
    if(isAereo&&ivaDesemb>0)rowsAduana.push(`<div class="row"><span>IVA 21% sobre desaduanaje</span><span>USD ${fmt(ivaDesemb)}</span></div>`);
  }
  const effTotal=Number(ch.total||0)+Number(delivCost||0);
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${t("pq.quoteTitle")}</title><style>
    @page{size:A4;margin:0}
    *,*:before,*:after{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
    html,body{margin:0;padding:0}
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;margin:0;padding:12mm 14mm 8mm}
    h1{font-size:20px;margin:0 0 2px;color:#1A3D6E;letter-spacing:-0.01em}
    .sub{color:#666;font-size:11px;margin-bottom:12px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-bottom:12px;padding:10px 14px;background:#f4f6fa;border-radius:8px}
    .grid div{font-size:10px;color:#555;letter-spacing:0.05em;text-transform:uppercase;font-weight:700}
    .grid b{font-size:13px;color:#111;display:block;margin-top:2px;font-weight:700;text-transform:none;letter-spacing:normal}
    h3{margin:12px 0 4px;font-size:12px;color:#1A3D6E;letter-spacing:0.02em}
    table{width:100%;border-collapse:collapse;margin-top:6px;font-size:10.5px}
    th,td{padding:5px 9px;border-bottom:1px solid #e5e7eb;text-align:left}
    th{background:#1A3D6E !important;color:#fff !important;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
    td.c{text-align:center}td.r{text-align:right}td.mono{font-family:'SFMono-Regular',Consolas,monospace;font-size:10px}
    tr:nth-child(even) td{background:#fafbfc}
    .section{margin-top:10px}
    .section-title{font-size:9.5px;font-weight:700;color:#1A3D6E;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px;padding:0 4px}
    .breakdown{padding:8px 12px;background:#f4f6fa;border-radius:8px;font-size:11.5px}
    .breakdown .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb}
    .breakdown .row:last-child{border-bottom:none}
    .breakdown .row span:last-child{font-weight:600;color:#111}
    .totals{margin-top:12px;padding:16px 20px;background:#1A3D6E !important;color:#fff !important;border-radius:8px;display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:18px;align-items:end}
    .totals .col{display:flex;flex-direction:column;gap:2px}
    .totals .col.hero{padding-left:18px;border-left:1px solid rgba(255,255,255,0.22)}
    .totals .lbl{font-size:9.5px;text-transform:uppercase;letter-spacing:0.08em;opacity:.85;font-weight:700}
    .totals .big{font-size:16px;font-weight:700;letter-spacing:-0.01em;margin-top:3px}
    .totals .col.hero .lbl{opacity:1;color:#E8D098 !important}
    .totals .col.hero .big{font-size:22px;color:#fff}
    .totals .hint{font-size:9px;color:rgba(255,255,255,0.55);font-weight:500;letter-spacing:0;margin-top:2px}
    .note{margin-top:8px;padding:9px 12px;background:#FFF8E1;border-left:3px solid #E8D098;border-radius:4px;font-size:9.5px;color:#5C4A1F;line-height:1.45}
    .note b{color:#1A3D6E}
    .foot{margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:9.5px;color:#666;line-height:1.45}
    .brand{margin-top:8px;text-align:center;padding:4px 0 0}
    .brand img{max-width:260px;width:100%;height:auto;display:block;margin:0 auto}
    @media print{html,body{height:auto} body{padding:10mm 14mm 6mm !important} .totals,.brand{page-break-inside:avoid;break-inside:avoid}}
  </style></head><body>
    <h1>${t("pq.quoteTitle")}</h1>
    <div class="sub">Emitida ${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}</div>
    <div class="grid">
      <div>Cliente<b>${(clientName||"—").replace(/</g,"&lt;")}</b></div>
      <div>Servicio<b>${ch.name||"—"}</b></div>
      <div>Origen<b>${origin||"—"}</b></div>
      <div>${isAereo?"Peso facturable":"CBM facturable"}<b>${fleteAmtLbl}</b></div>
    </div>
    <h3>Productos</h3>
    <table><thead><tr><th>${t("common.description")}</th><th>Cant</th><th>Unit.</th><th>FOB</th><th>NCM</th></tr></thead><tbody>${rows}</tbody></table>
    ${rowsServicios.length?`<div class="section"><p class="section-title">Servicios — Flete y seguro</p><div class="breakdown">${rowsServicios.join("")}</div></div>`:""}
    ${rowsAduana.length?`<div class="section"><p class="section-title">Aduana — Impuestos y gastos</p><div class="breakdown">${rowsAduana.join("")}</div></div>`:""}
    <div class="totals">
      <div class="col"><div class="lbl">Valor FOB</div><div class="big">USD ${fmt(totalFob)}</div><div class="hint">${t("pq.goodsAtOrigin")}</div></div>
      <div class="col"><div class="lbl">${t("pq.importCost")}</div><div class="big">USD ${fmt(effTotal)}</div><div class="hint">a abonar a Argencargo</div></div>
      <div class="col hero"><div class="lbl">${t("pq.landedCost")}</div><div class="big">USD ${fmt(Number(totalFob||0)+Number(effTotal||0))}</div><div class="hint">${t("pq.fobPlusImport")}</div></div>
    </div>
    <div class="note"><b>${t("pq.noteLabel")}</b> ${t("pq.notePart1")} <b>${t("pq.importCost")}</b>. ${t("pq.landedCost")} ${t("pq.notePart2")}</div>
    <div class="foot">${t("pq.disclaimer")}</div>
    <div class="brand"><img src="https://www.argencargo.com.ar/logo_cotizaciones.png" alt="Argencargo"/></div>
    <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
  </body></html>`);
  w.document.close();
}

function CalculatorPage({token,client,preset}){
  const {t}=useT();
  const [step,setStep]=useState(0);const [origin,setOrigin]=useState("");
  // USA flow
  const [products,setProducts]=useState([{type:"general",description:"",unit_price:"",quantity:"1",ncm:null,ncmLoading:false,ncmError:false,ncm_hint:""}]);
  const [pkgs,setPkgs]=useState([{qty:"1",length:"",width:"",height:"",weight:""}]);const [noDims,setNoDims]=useState(false);const clientAutoZone=(()=>{if(!client)return"oficina";const c=(client.city||"").toLowerCase();const p=(client.province||"").toLowerCase();const isCABA=c.includes("capital")||c.includes("caba")||p.includes("capital")||p==="caba";if(isCABA)return"caba";return"oficina";})();const [delivery,setDelivery]=useState(clientAutoZone);
  const [hasBattery,setHasBattery]=useState(null);const hasBrand=false;const [expandedCh,setExpandedCh]=useState(null);
  // Sub-paso dentro del paso 1 (China): 1=batería, 2=productos. Aparece una pregunta a la vez.
  // (la pregunta de "marca" se sacó del flujo — hasBrand queda fijo en false, ver arriba)
  const [step1Sub,setStep1Sub]=useState(1);
  const [calcInputMode,setCalcInputMode]=useState(null); // 'pdf' | 'manual'
  // Keep global ncm for backward compat in calculations (use first product's NCM)
  const ncm=products.find(p=>p.ncm?.ncm_code)?.ncm||null;const ncmManual=false;
  const [tariffs,setTariffs]=useState([]);const [overrides,setOverrides]=useState([]);const [config,setConfig]=useState({});const [results,setResults]=useState(null);
  useEffect(()=>{(async()=>{const [t,c,ov]=await Promise.all([dq("tariffs",{token,filters:"?select=*&order=sort_order.asc"}),dq("calc_config",{token,filters:"?select=*"}),client?.id?dq("client_tariff_overrides",{token,filters:`?client_id=eq.${client.id}&select=*`}):Promise.resolve([])]);setTariffs(Array.isArray(t)?t:[]);setOverrides(Array.isArray(ov)?ov:[]);const cfg={};(Array.isArray(c)?c:[]).forEach(r=>{cfg[r.key]=Number(r.value);});setConfig(cfg);})();},[token,client?.id]);
  // Historial de productos del cliente: para sugerir "repetir" en nueva cotización
  const [productHistory,setProductHistory]=useState([]);
  useEffect(()=>{if(!client?.id)return;(async()=>{
    const ops=await dq("operations",{token,filters:`?client_id=eq.${client.id}&select=id,operation_code,description,created_at&order=created_at.desc&limit=10`});
    if(!Array.isArray(ops)||ops.length===0)return;
    const opIds=ops.map(o=>o.id).join(",");
    const items=await dq("operation_items",{token,filters:`?operation_id=in.(${opIds})&select=description,unit_price_usd,quantity,ncm_code,import_duty_rate,statistics_rate,iva_rate,operation_id&order=created_at.desc`});
    if(!Array.isArray(items))return;
    // Dedup por descripción, último uso primero
    const seen={};const dedup=[];
    items.forEach(it=>{const k=(it.description||"").trim().toLowerCase();if(!k||seen[k])return;seen[k]=true;dedup.push(it);});
    setProductHistory(dedup.slice(0,8));
  })();},[client?.id,token]);
  const addFromHistorical=(it)=>{
    setProducts(p=>[...p,{type:"general",description:it.description||"",unit_price:String(it.unit_price_usd||""),quantity:String(it.quantity||"1"),ncm:it.ncm_code?{ncm_code:it.ncm_code,ncm_description:it.description,import_duty_rate:it.import_duty_rate??35,statistics_rate:it.statistics_rate??3,iva_rate:it.iva_rate??21}:null,ncmLoading:false,ncmError:false}]);
  };

  const addProduct=()=>setProducts(p=>[...p,{type:"general",description:"",unit_price:"",quantity:"1",ncm:null,ncmLoading:false,ncmError:false,ncm_hint:""}]);
  const rmProduct=i=>setProducts(p=>p.filter((_,j)=>j!==i));
  const chProd=(i,f,v)=>setProducts(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));
  const addPkg=()=>setPkgs(p=>[...p,{qty:"1",length:"",width:"",height:"",weight:"",product_ids:null}]);
  const rmPkg=i=>setPkgs(p=>p.filter((_,j)=>j!==i));
  const chPkg=(i,f,v)=>setPkgs(p=>p.map((x,j)=>j===i?{...x,[f]:v}:x));

  const totalFob=products.reduce((s,p)=>s+(toN(p.unit_price)*(toN(p.quantity)||1)),0);
  const hasPhones=products.some(p=>p.type==="celulares");
  const prodSummary=products.map(p=>`${p.description||p.type} x${p.quantity}`).join(", ");
  const mercType=products.every(p=>p.type==="celulares")?"Celulares":"Carga General";

  const calcTotals=()=>{
    let totWeight=0,totVol=0,totCBM=0;
    pkgs.forEach(pk=>{const q=toN(pk.qty)||1,l=toN(pk.length),w=toN(pk.width),h=toN(pk.height),gw=toN(pk.weight);totWeight+=gw*q;if(l&&w&&h){totVol+=((l*w*h)/5000)*q;totCBM+=((l*w*h)/1000000)*q;}});
    return{totWeight,totVol,totCBM,billable:Math.max(totWeight,totVol)};
  };
  // Detección de ropa/textiles + calzado. Por NCM (caps 50-63 textiles, 64 calzado) o keywords.
  // Si entra en esta categoría Y CBM < MIN_CBM_RESTRICTED → marítimo LCL/FCL NO se ofrece (restricción aduanera).
  const MIN_CBM_RESTRICTED=5;
  // Capítulos NCM textiles, calzado y tocados (sombreros/gorras): 50-65.
  // Agregado capítulo 65 (Sombreros y demás tocados) que estaba faltando.
  const RESTRICTED_CHAPTERS=new Set(["50","51","52","53","54","55","56","57","58","59","60","61","62","63","64","65"]);
  // Keywords ampliadas: incluye gorras, sombreros, boinas, vinchas, tocados.
  const RESTRICTED_KEYWORDS=/\b(ropa|remer[ao]s?|camiset[ao]s?|pantal[oó]n(es)?|vestido?s?|buzo?s?|camper[ao]s?|blus[ao]s?|poller[ao]s?|sweater|sueter|cardigan|jean(s)?|short(s)?|legging(s)?|hoodie|jacket|t-?shirt|polo|bermudas?|trajes?|abrigos?|tapado|blazer|chaleco|cinturones?|underwear|ropa interior|calzon(es|cillos?)?|bombach(as?|ones?)|sost[eé]n(es)?|brassiere|panties|boxers?|medias?|socks|joggings?|conjunto[s]? deportivo|deportiva|calzados?|zapat(o|illa)s?|zapatill?as?|botas?|botines?|bot[ií]n(es)?|sandalias?|ojotas?|chinelas?|pantuflas?|mocasines?|sneakers?|tenis|trainers?|running\s*shoes?|footwear|alpargatas?|crocs?|gorr(a|o)s?|gorrit[ao]s?|sombrer[ao]s?|boin[ao]s?|vinch[ao]s?|tocados?|caps?|hats?|beanie|bandanas?|panuelos?|bufand[ao]s?|guantes?|mitones?)\b/i;
  // Umbral mínimo FOB para ofrecer Marítimo LCL/FCL: 250 USD por m³ (mínimo 0,5 m³ facturable).
  // Por debajo de esa densidad de valor no conviene marítimo (costos fijos de despacho + tránsito
  // comen el ahorro vs aéreo/courier). Ej: 0,5 m³ → mín. USD 125; 3 m³ → mín. USD 750.
  // Peso facturable mínimo para aéreo desde China (canal A Courier y canal B Integral): 5 kg.
  const MIN_KG_AEREO_CHINA=5;
  // Courier comercial desde USA (habilitado 12/09/2026): misma tarifa que China, mínimo 25 kg.
  const MIN_KG_AEREO_USA=25;
  const isRestricted=products.some(p=>{
    const ncm=(p.ncm?.ncm_code||"").replace(/[^0-9]/g,"");
    const chapter=ncm.slice(0,2);
    if(RESTRICTED_CHAPTERS.has(chapter))return true;
    const d=(p.description||"").toLowerCase();
    return RESTRICTED_KEYWORDS.test(d);
  });

  const getEffRate=(t)=>{const ov=overrides.find(o=>o.tariff_id===t.id);return ov?Number(ov.custom_rate):Number(t.rate);};
  // Cotización nueva → tarifa vigente HOY (ignora versiones históricas).
  const tariffNowOk=t=>{const n=Date.now();return (t.effective_from==null||Date.parse(t.effective_from)<=n)&&(t.effective_to==null||n<Date.parse(t.effective_to));};
  const getFleteRate=(svcKey,amount)=>{const rates=tariffs.filter(t=>t.service_key===svcKey&&t.type==="rate"&&tariffNowOk(t));for(const r of rates){const min=Number(r.min_qty||0),max=r.max_qty!=null?Number(r.max_qty):Infinity;if(amount>=min&&amount<max)return getEffRate(r);}return rates.length?getEffRate(rates[rates.length-1]):0;};
  const getSurcharge=(svcKey,totalVal,amount)=>{const surcharges=tariffs.filter(t=>t.service_key===svcKey&&t.type==="surcharge").sort((a,b)=>Number(b.min_qty)-Number(a.min_qty));if(amount<=0)return{pct:0,amt:0};const vpu=totalVal/amount;for(const s of surcharges){if(vpu>=Number(s.min_qty))return{pct:Number(s.rate),amt:totalVal*(Number(s.rate)/100)};}return{pct:0,amt:0};};

  const calculateSpain=()=>{
    const{totWeight,totVol,totCBM,billable}=calcTotals();const channels=[];
    // España: solo Aéreo Integral AC, USD 55/kg, ÚNICO canal B donde se cobra
    // peso facturable = max(bruto, volumétrico) por bulto. Divisor 5000.
    const RATE_SPAIN=55;
    let facturable=0;let volWeightTotal=0;
    pkgs.forEach(pk=>{
      const q=(toN(pk.qty)||1),l=toN(pk.length),w=toN(pk.width),h=toN(pk.height),gw=toN(pk.weight);
      const bruto=gw*q;const vol=l&&w&&h?((l*w*h)/5000)*q:0;
      facturable+=Math.max(bruto,vol);volWeightTotal+=vol;
    });
    if(facturable>0){const bw=Math.max(facturable,1);const flete=bw*RATE_SPAIN;
      channels.push({key:"aereo_b_spain",name:"Aéreo Integral AC",info:"5-7 días hábiles",flete,surcharge:0,surchargePct:0,total:flete,pesoBruto:totWeight,pesoVol:volWeightTotal,pesoFact:facturable,unit:`${facturable.toFixed(1)} kg`});}
    setResults({channels,totWeight,totVol,totCBM,billable:facturable,isRestricted});setStep(4);
  };

  const classifyProduct=async(idx)=>{const p=products[idx];if(!p.description?.trim())return;
    setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:true,ncmError:false}:x));
    try{const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:p.description,hint:p.ncm_hint||undefined})});const d=await r.json();
      if(d.fallback||d.error){setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:false,ncmError:true,ncm:null}:x));}
      else{setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:false,ncmError:false,ncm:d}:x));}
    }catch{setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:false,ncmError:true,ncm:null}:x));}};

  // Un solo botón "Clasificar NCM" al pie (pedido 08/09/2026): clasifica en paralelo todos los
  // productos con descripción que todavía no tienen NCM (los ya clasificados no se tocan).
  const [classifyingAll,setClassifyingAll]=useState(false);
  const classifyAll=async()=>{
    const idxs=products.map((p,i)=>(!p.ncm&&p.description?.trim())?i:-1).filter(i=>i>=0);
    if(!idxs.length)return;
    setClassifyingAll(true);
    try{await Promise.all(idxs.map(i=>classifyProduct(i)));}finally{setClassifyingAll(false);}
  };

  // Clasificación por foto: convierte file a base64 y manda a /api/ncm con {image, description}
  // No persistimos la imagen — solo se usa en memoria del request.
  const classifyByPhoto=async(idx,file)=>{
    if(!file)return;
    if(file.size>5*1024*1024){alert("La imagen es muy grande. Máximo 5 MB.");return;}
    setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:true,ncmError:false}:x));
    try{
      // Re-encodear a JPEG max 1600px si el formato no es soportado por Claude o pesa mucho.
      const needsRecode=file.size>1024*1024||!/^image\/(png|jpe?g|gif|webp)$/.test(file.type);
      let finalBlob=file;let finalMime=file.type||"image/jpeg";
      if(needsRecode){
        const bmp=await createImageBitmap(file).catch(()=>null);
        if(bmp){
          const maxDim=1600;const scale=Math.min(1,maxDim/Math.max(bmp.width,bmp.height));
          const w=Math.round(bmp.width*scale),h=Math.round(bmp.height*scale);
          const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
          canvas.getContext("2d").drawImage(bmp,0,0,w,h);
          finalBlob=await new Promise(res=>canvas.toBlob(res,"image/jpeg",0.85));
          finalMime="image/jpeg";
        }
      }
      const reader=new FileReader();
      const base64=await new Promise((res,rej)=>{reader.onload=ev=>res(ev.target.result);reader.onerror=rej;reader.readAsDataURL(finalBlob);});
      const currentDesc=products[idx]?.description||"";
      const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:base64,description:currentDesc,image_mime:finalMime})});
      const d=await r.json();
      if(d.fallback||d.error){setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:false,ncmError:true,ncm:null}:x));return;}
      // Si vino guess_description y no había descripción, rellenamos
      setProducts(pr=>pr.map((x,j)=>{
        if(j!==idx)return x;
        const newDesc=(!x.description||!x.description.trim())&&d.guess_description?d.guess_description:x.description;
        return {...x,description:newDesc,ncmLoading:false,ncmError:false,ncm:d};
      }));
    }catch(e){setProducts(pr=>pr.map((x,j)=>j===idx?{...x,ncmLoading:false,ncmError:true,ncm:null}:x));}
  };

  // China y USA comparten flujo y tarifas. Unica diferencia: USA no tiene Maritimo LCL/FCL
  // y su minimo facturable aereo es de 25 kg.
  const calculateChina=()=>{
    const{totWeight,totCBM}=calcTotals();const channels=[];
    const conLcl=origin==="China";
    const minKgAereo=origin==="USA"?MIN_KG_AEREO_USA:MIN_KG_AEREO_CHINA;
    const transitoAereo=origin==="USA"?"3-5 días hábiles":"7-10 días hábiles";
    // Peso facturable = suma del max(bruto, vol) POR BULTO, no global
    let facturable=0;let volWeightTotal=0;
    const pkgDetails=pkgs.map(pk=>{const q=(toN(pk.qty)||1),l=toN(pk.length),w=toN(pk.width),h=toN(pk.height),gw=toN(pk.weight);
      const bruto=gw*q;const vol=l&&w&&h?((l*w*h)/5000)*q:0;const fact=Math.max(bruto,vol);volWeightTotal+=vol;
      return{bruto,vol,fact,isVolumetric:vol>bruto};});
    facturable=pkgDetails.reduce((s,p)=>s+p.fact,0);
    const getDesembolso=(cif)=>{const t=[[5,0],[9,36],[20,50],[50,58],[100,65],[400,72],[800,84],[1000,96],[Infinity,120]];for(const[max,amt]of t)if(cif<max)return amt;return 120;};
    const isRI=client?.tax_condition==="responsable_inscripto";
    const certAerReal=config.cert_flete_aereo_real||2.5;const certAerFict=config.cert_flete_aereo_ficticio||3.5;
    const certMarFict=config.cert_flete_maritimo_ficticio||100;

    // Antidumping calzado (NCM cap. 64): la base imponible para DIE/TE/IVA usa el piso
    // aunque el precio real cargado sea menor — el FOB real ("fob" acá abajo) no se toca.
    const floorTaxUnitPrice=(prods)=>{
      const inputs=prods.map(p=>({unit_price:toN(p.unit_price),quantity:toN(p.quantity)||1,ncm_code:p.ncm?.ncm_code}));
      const floored=applyAntidumpingFloor(inputs,config);
      return prods.map((_,i)=>floored[i].unit_price);
    };
    // Per-item tax calculation helper. taxUnitPrice (si viene) reemplaza p.unit_price SOLO
    // para calcular la base imponible — el fob devuelto sigue siendo el real.
    const calcItemTaxes=(p,certFleteTotal,isMaritimo,totalCif,taxUnitPrice)=>{
      const qty=toN(p.quantity)||1;
      const itemFob=toN(p.unit_price)*qty;
      const itemFobTax=(taxUnitPrice!=null?taxUnitPrice:toN(p.unit_price))*qty;
      const pct=totalFob>0?itemFob/totalFob:1;
      const itemCertFl=certFleteTotal*pct;const itemSeg=(itemFobTax+itemCertFl)*0.01;const itemCif=itemFobTax+itemCertFl+itemSeg;
      const dr=Number(p.ncm?.import_duty_rate||0)/100;const te=Number(p.ncm?.statistics_rate||0)/100;const ivaR=Number(p.ncm?.iva_rate??21)/100;
      const derechos=itemCif*dr;const tasa_e=itemCif*te;const baseImp=itemCif+derechos+tasa_e;const iva=baseImp*ivaR;
      let totalImp=derechos+tasa_e+iva;let extras={};
      if(isMaritimo){const ivaAdic=baseImp*0.20;const iigg=baseImp*0.06;const iibb=baseImp*0.05;totalImp+=ivaAdic+iigg+iibb;extras={ivaAdic,iigg,iibb};}
      else{const fullTasa=getDesembolso(totalCif);const propTasa=fullTasa*pct;const ivaD=propTasa*0.21;totalImp+=propTasa+ivaD;extras={desembolso:propTasa,ivaDesemb:ivaD};}
      return{desc:p.description||"Producto",fob:itemFob,cif:itemCif,seguro:itemSeg,derechos,tasa_e,iva,totalImp,drPct:p.ncm?.import_duty_rate||0,tePct:p.ncm?.statistics_rate||0,ivaPct:p.ncm?.iva_rate??21,...extras};
    };

    // Aéreo Courier Comercial (canal A) — peso facturable (max bruto/vol).
    // Omitido si: hay marca registrada, o algún bulto unitario supera los 45 kg
    // (límite operativo del canal courier — no importa el total, sino el peso por bulto)
    const overweightPkg=pkgs.find(pk=>toN(pk.weight)>=46);
    if(!hasBrand&&!overweightPkg&&facturable>0){const facturableBill=Math.max(facturable,minKgAereo);const fleteRate=getFleteRate("aereo_a_china",facturableBill);const flete=facturableBill*fleteRate;
      const certFlete=isRI?(totWeight*certAerReal):(facturableBill*certAerFict);
      const seguro=(totalFob+certFlete)*0.01;const battExtra=hasBattery?facturableBill*(isRI?2:1):0; // 11/09/2026: USD 2/kg RI, USD 1/kg monotributista o consumidor final
      const validProds=products.filter(p=>toN(p.unit_price)>0);
      const taxUnitPrices=floorTaxUnitPrice(validProds);
      const taxFob=validProds.reduce((s,p,i)=>s+taxUnitPrices[i]*(toN(p.quantity)||1),0);
      const totalCif=taxFob+certFlete+(taxFob+certFlete)*0.01;
      const items=validProds.map((p,i)=>calcItemTaxes(p,certFlete,false,totalCif,taxUnitPrices[i]));
      const totalImp=items.reduce((s,it)=>s+it.totalImp,0);
      // Recargo por sobrepeso del courier: USD 35 por pieza si el bulto pesa más de 24 kg o su
      // girth (largo + 2×ancho + 2×alto) supera 260 cm. Ítem separado, no dentro del flete.
      const owPieces=pkgs.reduce((n,pk)=>{const q=(toN(pk.qty)||1);const gw=toN(pk.weight);const l=toN(pk.length),w=toN(pk.width),h=toN(pk.height);const girth=l&&w&&h?l+2*(w+h):0;return n+((gw>24||girth>260)?q:0);},0);
      const overweightSurcharge=owPieces*35;
      const totalSvc=flete+seguro+battExtra+overweightSurcharge;
      channels.push({key:"aereo_a_china",name:"Aéreo Courier Comercial",info:transitoAereo,isBlanco:true,
        flete,seguro,battExtra,overweightSurcharge,owPieces,totalImp,totalSvc,total:totalImp+totalSvc,items,
        pesoBruto:totWeight,pesoVol:volWeightTotal,pesoFact:facturableBill,pkgDetails,unit:`${facturableBill.toFixed(1)} kg`});}

    // Aéreo Integral AC (B) China: OCULTO para clientes (pedido 11/06/2026). El canal
    // sigue existiendo en la calculadora del admin — acá no se ofrece más.

    // Restricción ropa/calzado: a partir del 01/05/2026, marítimo LCL/FCL solo si >= 5 CBM.
    // Marítimo Integral AC sigue siempre disponible (excepción del régimen).
    const blockMaritimoLclRestricted=isRestricted&&totCBM>0&&totCBM<MIN_CBM_RESTRICTED;
    // La regla de FOB minimo por m³ (USD 250/m³) se elimino el 03/08/2026 a pedido del usuario:
    // hacia desaparecer el LCL sin explicacion al agregar un bulto (la cotizacion de mochilas
    // caia justo en el borde). El LCL se ofrece por volumen, no por densidad de valor.
    const requiredFobMaritimo=0;
    const blockMaritimoLclLowFob=false;
    // Marítimo LCL/FCL solo a partir de 0,50 m³ (bajó de 0,90 el 10/08/2026) — por debajo,
    // únicamente Marítimo Integral AC. El LCL factura mínimo 1 m³ (USD 600 a tarifa estándar).
    const blockMaritimoLclMinCbm=totCBM>0&&totCBM<0.5;

    // Marítimo Carga LCL/FCL (A) — SIEMPRE ficticio. Omitido si hay marca o si es ropa/calzado <5 CBM.
    // Si totCBM>0 hay dimensiones cargadas (noDims puede haber quedado true del UX previo, lo ignoramos).
    if(conLcl&&!hasBrand&&!blockMaritimoLclRestricted&&!blockMaritimoLclLowFob&&!blockMaritimoLclMinCbm&&totCBM>0){const cbmFact=Math.max(totCBM,1);const fleteRate=getFleteRate("maritimo_a_china",cbmFact);const flete=cbmFact*fleteRate;
      const certFlete=totCBM*certMarFict;
      const seguro=(totalFob+certFlete)*0.01;
      const validProdsMar=products.filter(p=>toN(p.unit_price)>0);
      const taxUnitPricesMar=floorTaxUnitPrice(validProdsMar);
      const items=validProdsMar.map((p,i)=>calcItemTaxes(p,certFlete,true,0,taxUnitPricesMar[i]));
      const totalImp=items.reduce((s,it)=>s+it.totalImp,0);const totalSvc=flete+seguro;
      channels.push({key:"maritimo_a_china",name:"Marítimo Carga LCL/FCL",info:"",isBlanco:true,isMar:true,
        flete,seguro,totalImp,totalSvc,total:totalImp+totalSvc,items,cbm:totCBM,unit:`${totCBM.toFixed(4)} CBM`});}

    // Marítimo Integral AC (B) — siempre disponible (incluso para ropa/calzado <5 CBM).
    // Si totCBM>0 hay dimensiones cargadas. No chequeamos noDims porque puede estar en true por edge UX.
    if(totCBM>0){const fleteRate=getFleteRate("maritimo_b",totCBM);let flete=totCBM*fleteRate;const sur=getSurcharge("maritimo_b",totalFob,totCBM);
      // Mínimo de servicio del Integral: USD 100 (10/08/2026). Se ajusta el flete para que
      // las líneas sumen el total.
      let negroTotal=flete+sur.amt;
      if(negroTotal>0&&negroTotal<100){flete+=100-negroTotal;negroTotal=100;}
      // Reglas de visibilidad (10/08/2026):
      //  - RI desde China: el Integral solo se ofrece con carga < 0,5 m³. Con 0,5+ va por LCL/FCL.
      //  - No-RI con 0,5+ m³: se muestra UNA sola opción marítima, la más barata (Integral o
      //    LCL/FCL con su mínimo de 1 m³). Con menos de 0,5 solo existe el Integral.
      //  (Con marca o ropa/calzado <5 m³ el LCL no se ofrece y el Integral queda solo.)
      const mBlanco=channels.find(c=>c.key==="maritimo_a_china");
      let hideNegro=false;
      if(conLcl&&isRI){
        hideNegro=totCBM>=0.5;
      }else if(conLcl&&totCBM>=0.5&&mBlanco){
        if(mBlanco.total<negroTotal)hideNegro=true;
        else channels.splice(channels.indexOf(mBlanco),1); // gana el Integral: fuera el LCL
      }
      if(!hideNegro)channels.push({key:"maritimo_b",name:"Marítimo Integral AC",info:"",isBlanco:false,
        flete,surcharge:sur.amt,surchargePct:sur.pct,total:negroTotal,cbm:totCBM,unit:`${totCBM.toFixed(4)} CBM`});}
    setResults({channels,totWeight,totCBM,blockMaritimoLclRestricted,blockMaritimoLclLowFob,blockMaritimoLclMinCbm,requiredFobMaritimo,isRestricted,totalFob});setStep(4);
  };

  // Política de envíos:
  // - Cliente de CABA: ofrece "Retiro por Oficina" + "Envío CABA" (precio fijo según peso).
  // - Cliente fuera de CABA (GBA, provincia BA, interior): ofrece "Retiro por Oficina" + "Envío a coordinar"
  //   (sin precio, se cotiza por separado vía Andreani / OCA / acordado con el cliente).
  const getShipCost=(zone,weight)=>{if(zone==="oficina"||zone==="coordinar")return 0;const ranges=[[25,config.envio_caba_0_25||20],[50,config.envio_caba_25_50||30],[100,config.envio_caba_50_100||50],[Infinity,config.envio_caba_100||75]];let cost=0;for(const[max,amt]of ranges){if(weight<max){cost=amt;break;}}return cost;};
  const clientIsCABA=(()=>{if(!client)return false;const c=(client.city||"").toLowerCase();const p=(client.province||"").toLowerCase();return c.includes("capital")||c.includes("caba")||p.includes("capital")||p==="caba";})();
  // Mantengo clientZone para retrocompat (otros lados del código pueden usarlo).
  const clientZone=clientIsCABA?"caba":(client?"interior":null);
  const autoDelivLabel=(()=>{if(delivery==="oficina")return t("calc.pickupOfficeFree");if(delivery==="coordinar")return t("calc.deliveryTBD");const{totWeight}=calcTotals();const cost=getShipCost(delivery,totWeight);return `Envío CABA (USD ${cost})`;})();
  const DELIV={oficina:t("calc.pickupOfficeFree"),caba:t("calc.shipCaba"),coordinar:t("calc.deliveryTBD")};
  const [savedMsg,setSavedMsg]=useState("");
  // Tiempo de tránsito por canal (para la lista de resultados y la cotización guardada).
  const transitOf=ch=>ch?.info||({aereo_a_china:origin==="USA"?"3-5 días hábiles":"7-10 días hábiles",maritimo_a_china:"60-70 días",maritimo_b:"60-70 días",aereo_b_usa:"48-72 hs",aereo_b_spain:"5-7 días hábiles"})[ch?.key]||"";
  // Guardado automático (11/09/2026): al llegar a Resultados se guarda UNA cotización con todas las
  // alternativas (channel_alternatives). Si el cliente vuelve atrás y recalcula, se actualiza la misma
  // fila. "Nueva cotización" resetea el id y la próxima crea otra fila.
  const savedQuoteIdRef=useRef(null);
  const saveChainRef=useRef(Promise.resolve());
  // Desglose línea por línea de cada vía (se guarda en channel_alternatives.detail: lo lee Mis cotizaciones y el link público).
  const detailOf=(ch)=>{const its=ch.items||[];const sm=f=>its.reduce((a,it)=>a+Number(f(it)||0),0);const d=[];
    if(ch.isBlanco){d.push(["Flete internacional",Number(ch.flete||0)]);if(Number(ch.battExtra)>0)d.push(["Recargo por baterías",Number(ch.battExtra)]);if(Number(ch.overweightSurcharge)>0)d.push(["Recargo por sobrepeso",Number(ch.overweightSurcharge)]);d.push(["Seguro (1%)",Number(ch.seguro||0)]);d.push(["Derechos de importación",sm(it=>it.derechos)]);d.push(["Tasa estadística",sm(it=>it.tasa_e)]);d.push(["IVA",sm(it=>it.iva)]);if(ch.isMar)d.push(["IVA adicional + IIGG + IIBB",sm(it=>(it.ivaAdic||0)+(it.iigg||0)+(it.iibb||0))]);else{d.push(["Gasto documental",sm(it=>it.desembolso)]);if(sm(it=>it.ivaDesemb)>0)d.push(["IVA sobre gasto documental",sm(it=>it.ivaDesemb)]);}}
    else{d.push([ch.key==="maritimo_a_china"?"Servicio marítimo de importación":"Servicio integral de importación",Number(ch.flete||0)+Number(ch.surcharge||0)]);if(Number(ch.battExtra)>0)d.push(["Recargo por baterías",Number(ch.battExtra)]);if(Number(ch.overweightSurcharge)>0)d.push(["Recargo por sobrepeso",Number(ch.overweightSurcharge)]);}
    return d.map(([l,v])=>[l,Math.round(v*100)/100]);};
  const buildQuoteBody=(channels,chosen)=>{
    const{totWeight,totCBM}=calcTotals();const delivCost=getShipCost(delivery,totWeight);
    const productsToSave=products.map(p=>({...p,unit_price:toN(p.unit_price),quantity:toN(p.quantity)||1}));
    const calc=channels.filter(c=>!c.noCalc);
    const alts=calc.map(ch=>({key:ch.key,name:ch.name,info:transitOf(ch),totalAbonar:ch.total+delivCost,flete:Number(ch.flete||0)+Number(ch.surcharge||0),seguro:Number(ch.seguro||0),totalTax:Number(ch.totalImp||0),shipCost:delivCost,overweight:Number(ch.overweightSurcharge||0),detail:detailOf(ch),isBlanco:!!ch.isBlanco}));
    const main=chosen||(calc.length?calc.reduce((a,b)=>a.total<b.total?a:b):null);
    return{client_id:client?.id||null,client_name:client?`${client.first_name} ${client.last_name}`:"Anónimo",client_code:client?.client_code||"—",origin,channel_key:main?.key||null,channel_name:main?.name||null,products:productsToSave,packages:pkgs,delivery,total_fob:totalFob,total_weight:totWeight,total_cbm:totCBM,total_cost:main?main.total+delivCost:0,channel_alternatives:alts,has_battery:!!hasBattery,expires_at:new Date(Date.now()+15*864e5).toISOString(),...(chosen?{client_selected_channel:chosen.key}:{})};
  };
  // dq() NO lanza en error HTTP: devuelve el cuerpo de la respuesta. PostgREST contesta
  // {code, message, details} y eso no es un array, asi que el `id` quedaba null, el catch
  // nunca corria y el fallo era invisible. Entre el 12 y el 14/09/2026 se perdieron todas
  // las cotizaciones del portal asi (el trigger de numeracion chocaba contra el indice
  // unico) sin un solo log. De aca en adelante un guardado que falla se ve y se avisa.
  const errorDeApi=(r)=>{
    if(Array.isArray(r))return null;
    if(r&&typeof r==="object"&&(r.message||r.code))return `${r.code||""} ${r.message||""}`.trim();
    return null;
  };
  const persistQuote=(body)=>{
    saveChainRef.current=saveChainRef.current.then(async()=>{
      try{
        if(savedQuoteIdRef.current){
          const r=await dq("quotes",{method:"PATCH",token,filters:`?id=eq.${savedQuoteIdRef.current}`,body});
          const err=errorDeApi(r);if(err)throw new Error(err);
        }else{
          const r=await dq("quotes",{method:"POST",token,body,headers:{Prefer:"return=representation"}});
          const err=errorDeApi(r);if(err)throw new Error(err);
          const id=Array.isArray(r)&&r[0]?r[0].id:null;
          if(!id)throw new Error("la base no devolvio la cotizacion creada");
          savedQuoteIdRef.current=id;
        }
      }catch(e){
        console.error("[cotizaciones] no se pudo guardar:",e?.message||e);
        toast(t("quotes.saveFailed"),"error");
        avisarAdmin(token,{title:"⚠️ No se pudo guardar una cotización del portal",body:`${client?.client_code||"?"} (${client?.first_name||""}): ${e?.message||"error desconocido"}`,url:"/admin"});
      }
    });
    return saveChainRef.current;
  };
  useEffect(()=>{if(step===4&&results?.channels?.some(c=>!c.noCalc))persistQuote(buildQuoteBody(results.channels));},[results]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveQuote=(ch)=>{if(!results?.channels||ch?.noCalc)return;persistQuote(buildQuoteBody(results.channels,ch));};
  // Editar una cotización guardada: carga productos, bultos y origen; el recálculo actualiza la misma fila.
  useEffect(()=>{if(!preset)return;
    const prods=(typeof preset.products==="string"?JSON.parse(preset.products):preset.products)||[];
    const pk=(typeof preset.packages==="string"?JSON.parse(preset.packages):preset.packages)||[];
    setResults(null);setExpandedCh(null);setOrigin(preset.origin||"China");setHasBattery(preset.has_battery??false);setStep(1);
    setProducts(prods.length?prods.map(p=>({type:p.type||"general",description:p.description||"",unit_price:p.unit_price!=null?String(p.unit_price).replace(".",","):"",quantity:p.quantity!=null?String(p.quantity):"1",ncm:p.ncm||null,ncmLoading:false,ncmError:false,ncm_hint:p.ncm_hint||""})):[{type:"general",description:"",unit_price:"",quantity:"1",ncm:null,ncmLoading:false,ncmError:false,ncm_hint:""}]);
    setPkgs(pk.length?pk.map(x=>({qty:x.qty!=null?String(x.qty):"1",length:x.length!=null?String(x.length):"",width:x.width!=null?String(x.width):"",height:x.height!=null?String(x.height):"",weight:x.weight!=null?String(x.weight):"",product_ids:Array.isArray(x.product_ids)?x.product_ids:null})):[{qty:"1",length:"",width:"",height:"",weight:"",product_ids:null}]);
    setNoDims(!pk.some(x=>Number(x.length)>0&&Number(x.width)>0&&Number(x.height)>0)&&pk.some(x=>Number(x.weight)>0));
    savedQuoteIdRef.current=preset.id||null;
    if(typeof window!=="undefined")window.scrollTo({top:0,behavior:"smooth"});
  },[preset]); // eslint-disable-line react-hooks/exhaustive-deps
  // Una sola pantalla (11/09/2026): si el cliente toca cualquier dato después de calcular, los
  // resultados se ocultan hasta que vuelva a calcular; al calcular, se scrollea a Resultados.
  const resultsRef=useRef(null);
  useEffect(()=>{if(results){setResults(null);setExpandedCh(null);}},[products,pkgs,delivery,hasBattery,noDims,origin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(results&&resultsRef.current)resultsRef.current.scrollIntoView({behavior:"smooth",block:"start"});},[results]);
  const makeWAMsg=(ch)=>{const{totWeight,totCBM}=calcTotals();const name=client?`${client.first_name} ${client.last_name}`:"Cliente";const code=client?.client_code||"—";const flag=origin==="USA"?"\ud83c\uddfa\ud83c\uddf8":origin==="Espa\u00f1a"?"\ud83c\uddea\ud83c\uddf8":"\ud83c\udde8\ud83c\uddf3";const isAereo=ch.key?.includes("aereo");const delivCost=getShipCost(delivery,calcTotals().totWeight);const total=ch.total+delivCost;
    const usdF=v=>`USD ${v.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    if(ch.isBlanco){return encodeURIComponent(`Hola Bautista! Acabo de cotizar una importación y quiero avanzar con la operación!\n\nOrigen: *${origin}* ${flag}\nMercadería: *${prodSummary}*\n\nTipo de envío: *${ch.name}*\n\nValor Total: *${usdF(totalFob)}*\n${isAereo?`Peso Total: *${totWeight.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg*`:`CBM Total: *${totCBM.toFixed(4)} m³*`}\n\nImpuestos estimados: *${usdF(ch.totalImp||0)}*\n${ch.key==="maritimo_a_china"?"Servicio marítimo de importación":"Flete Internacional"}: *${usdF(ch.flete||0)}*\nSeguro: *${usdF(ch.seguro||0)}*\nEntrega en Destino: *${autoDelivLabel}*\nTotal estimado: *${usdF(total)}*\n\nCódigo cliente: *${code}*`);}
    return encodeURIComponent(`Hola Bautista! Acabo de cotizar una importación y quiero avanzar con la operación!\n\nOrigen: *${origin}* ${flag}\nMercadería: *${prodSummary}*\n\nTipo de envío: *${ch.name}*\n\nValor Total: *${usdF(totalFob)}*\n${isAereo?`Peso Total: *${totWeight.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg*`:`CBM Total: *${totCBM.toFixed(4)} m³*`}\nEntrega en Destino: *${autoDelivLabel}*\nCosto de importación: *${usdF(total)}*\n\nCódigo cliente: *${code}*`);};

  const usd=v=>`USD ${v.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const row=(l,v,bold,accent)=><div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",...(bold?{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:8}:{})}}><span style={{fontSize:12,color:bold?"#fff":"rgba(255,255,255,0.45)",fontWeight:bold?700:400}}>{l}</span><span style={{fontSize:12,fontWeight:bold?700:600,color:accent?IC:bold?"#fff":"rgba(255,255,255,0.7)"}}>{usd(v)}</span></div>;

  // ───────────────────────── UI (rediseño 11/09/2026 v4: una sola pantalla progresiva, resultados en vista aparte, rentabilidad separada) ─────────────────────────
  const HAIR="1px solid rgba(255,255,255,0.13)";
  const PANEL={background:"linear-gradient(180deg, rgba(13,24,45,0.96), rgba(8,16,32,0.96))",border:HAIR,borderRadius:16,padding:"22px 24px",marginBottom:14,boxShadow:"0 14px 34px rgba(0,0,0,0.28)"};
  const LBL={fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#fff",margin:0};
  const SUB="rgba(255,255,255,0.8)";
  const SKY="#8CC8F5";
  const INP={width:"100%",boxSizing:"border-box",height:40,padding:"0 12px",fontSize:14,border:"1px solid rgba(255,255,255,0.2)",borderRadius:9,background:"rgba(255,255,255,0.07)",color:"#fff",outline:"none",fontVariantNumeric:"tabular-nums",transition:"border-color 150ms, background 150ms",textAlign:"center"};
  const onF=e=>{e.target.style.borderColor="rgba(232,208,152,0.85)";e.target.style.background="rgba(255,255,255,0.1)";};
  const onB=e=>{e.target.style.borderColor="rgba(255,255,255,0.2)";e.target.style.background="rgba(255,255,255,0.07)";};
  const decOk=v=>v===""||/^\d*[.,]?\d*$/.test(v);
  const numIn=({value,onChange,placeholder,disabled,style,className})=><input className={className} type="text" inputMode="decimal" disabled={disabled} value={value||""} onChange={e=>{if(decOk(e.target.value))onChange(e.target.value);}} placeholder={placeholder} style={{...INP,...(disabled?{opacity:0.35,cursor:"not-allowed"}:{}),...style}} onFocus={onF} onBlur={onB}/>;
  const fmt2=v=>Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const SMALL_GHOST={height:32,padding:"0 12px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.24)",background:"rgba(255,255,255,0.1)",color:"#fff",cursor:"pointer",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:6,textDecoration:"none"};
  const SMALL_GOLD={...SMALL_GHOST,border:"1px solid rgba(232,208,152,0.55)",background:"rgba(184,149,106,0.16)",color:GOLD_LIGHT};
  const btnGhost=(label,onClick)=><button onClick={onClick} style={{padding:"11px 18px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.09)",color:"#fff",border:"1px solid rgba(255,255,255,0.22)",cursor:"pointer"}}>{label}</button>;
  const btnGold=(label,onClick,disabled)=><button onClick={onClick} disabled={disabled} style={{padding:"12px 26px",fontSize:13.5,fontWeight:800,borderRadius:10,border:`1px solid ${GOLD_DEEP}`,cursor:disabled?"not-allowed":"pointer",background:GOLD_GRADIENT,color:"#0A1628",opacity:disabled?0.4:1,boxShadow:disabled?"none":GOLD_GLOW_STRONG}}>{label}</button>;
  const delBtn=(onClick,disabled)=><button onClick={onClick} disabled={disabled} title="Quitar" style={{width:32,height:32,borderRadius:8,border:HAIR,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.8)",cursor:disabled?"default":"pointer",fontSize:16,lineHeight:1,opacity:disabled?0.25:1,flexShrink:0}}>×</button>;
  const lockedRow=(label)=><div style={{...PANEL,padding:"14px 24px",opacity:0.5,boxShadow:"none"}}><p style={{...LBL,color:"rgba(255,255,255,0.6)"}}>{label}</p></div>;
  // China y USA comparten todo el flujo: NCM, pregunta de baterias y Courier comercial.
  const isChina=origin==="China"||origin==="USA";
  const isRI=client?.tax_condition==="responsable_inscripto";
  const battRate=isRI?2:1;
  const flagOf=o=>o==="China"?"🇨🇳":o==="España"?"🇪🇸":"🇺🇸";
  const chTitle=ch=>({aereo_a_china:[t("calc.air"),"Courier comercial"],maritimo_a_china:[t("calc.sea"),"Carga FCL/LCL"],maritimo_b:[t("calc.sea"),"Integral AC"],aereo_b_spain:[t("calc.air"),"Integral AC"],aereo_b_usa:[t("calc.air"),"Integral AC"]})[ch.key]||[ch.key?.includes("aereo")?t("calc.air"):t("calc.sea"),ch.name];
  const resetAll=()=>{setResults(null);setOrigin("");setStep(0);setProducts([{type:"general",description:"",unit_price:"",quantity:"1",ncm:null,ncmLoading:false,ncmError:false,ncm_hint:""}]);setPkgs([{qty:"1",length:"",width:"",height:"",weight:"",product_ids:null}]);setNoDims(false);setDelivery("oficina");setHasBattery(null);setExpandedCh(null);savedQuoteIdRef.current=null;if(typeof window!=="undefined")window.scrollTo({top:0,behavior:"smooth"});};
  const pickOrigin=k=>{if(k===origin)return;setOrigin(k);setHasBattery(null);setResults(null);setExpandedCh(null);setStep(1);};
  const PROD_COLS=isChina?"1fr 110px 90px 150px 170px":"1fr 110px 90px 230px";
  const validIdx=products.map((p,i)=>toN(p.unit_price)>0?i:-1).filter(i=>i>=0);
  const multi=validIdx.length>1;
  const PK_COLS=multi?"minmax(240px,1.2fr) 72px 1fr 1fr 1fr 1fr 34px 330px":"72px 1fr 1fr 1fr 1fr 34px 330px";
  const [pkOpen,setPkOpen]=useState(null); // índice del bulto con el desplegable de mercaderías abierto
  const [helpOpen,setHelpOpen]=useState(false);
  const helpShownRef=useRef(false);const helpThenOpenRef=useRef(null);
  const openPkDropdown=(i)=>{if(!helpShownRef.current){helpShownRef.current=true;try{const k=`ac_calc_help_${client?.id||"anon"}`;const n=Number(localStorage.getItem(k)||0);if(n<3){localStorage.setItem(k,String(n+1));helpThenOpenRef.current=i;setHelpOpen(true);return;}}catch{}}setPkOpen(i);};
  const closeHelp=()=>{setHelpOpen(false);if(helpThenOpenRef.current!=null){setPkOpen(helpThenOpenRef.current);helpThenOpenRef.current=null;}};
  useEffect(()=>{if(delivery!=="oficina")setDelivery("oficina");},[delivery]); // sin bloque de entrega: el envío a domicilio se habla cuando llega la carga
  const pkIds=pk=>Array.isArray(pk.product_ids)?pk.product_ids.filter(i=>validIdx.includes(i)):[];
  const pkChosen=pk=>Array.isArray(pk.product_ids); // null/undefined = todavía no eligió; [] = t("op.variousUnassigned") explícito
  const togglePkProd=(i,idx)=>setPkgs(p=>p.map((x,j)=>{if(j!==i)return x;const cur=pkIds(x);return{...x,product_ids:cur.includes(idx)?cur.filter(k=>k!==idx):[...cur,idx]};}));
  const clearPkProd=(i)=>setPkgs(p=>p.map((x,j)=>j===i?{...x,product_ids:[]}:x));

  // Desbloqueo progresivo
  const hasPriced=validIdx.length>0;
  const sinNcm=isChina?products.filter(p=>p.description?.trim()&&!p.ncm&&!p.ncmLoading):[];
  const pendingClass=isChina&&products.some(p=>toN(p.unit_price)>0&&!p.ncm);
  const pkgOk=pkgs.some(p=>toN(p.weight)>0||(toN(p.length)>0&&toN(p.width)>0&&toN(p.height)>0));
  const anyAssigned=multi&&pkgs.some(pk=>pkIds(pk).length>0);
  const unassignedProds=anyAssigned?validIdx.filter(idx=>!pkgs.some(pk=>pkIds(pk).includes(idx))):[];
  const pkgsSinElegir=multi&&pkgs.some(pk=>!pkChosen(pk));
  const unlockProducts=!!origin&&(!isChina||hasBattery!==null);
  const canCalc=unlockProducts&&hasPriced&&!pendingClass&&pkgOk&&unassignedProds.length===0&&!pkgsSinElegir;
  const tot=calcTotals();
  const volWins=!noDims&&tot.totVol>tot.totWeight;
  const owPk=pkgs.find(pk=>toN(pk.weight)>=46);
  const doCalc=()=>origin==="España"?calculateSpain():calculateChina();

  // ── Costo por producto puesto en Argentina ──
  // Impuestos: por producto (items del canal). Servicio (flete, seguro, recargos): prorrateado por el
  // peso facturable (aéreo) o m³ (marítimo) de los bultos asignados a cada mercadería (si un bulto tiene
  // varias, se reparte entre ellas por FOB). Sin asignación → todo se reparte por valor FOB.
  const costPerProduct=(ch)=>{
    const valid=validIdx.map(i=>({p:products[i],i}));
    if(!valid.length)return[];
    const isAereo=ch.key.includes("aereo");
    const fobOf=({p})=>toN(p.unit_price)*(toN(p.quantity)||1);
    const fobTot=valid.reduce((s,v)=>s+fobOf(v),0)||1;
    const wOf=pk=>{const q=toN(pk.qty)||1,l=toN(pk.length),w=toN(pk.width),h=toN(pk.height),gw=toN(pk.weight);const dims=!noDims&&l&&w&&h;return isAereo?Math.max(gw*q,dims?((l*w*h)/5000)*q:0):(dims?((l*w*h)/1e6)*q:0);};
    const assigned={};let unassigned=0,wTot=0;
    pkgs.forEach(pk=>{const w=wOf(pk);wTot+=w;const ids=multi?pkIds(pk):[];if(!ids.length){unassigned+=w;return;}const sub=valid.filter(v=>ids.includes(v.i));const subFob=sub.reduce((s,v)=>s+fobOf(v),0)||1;sub.forEach(v=>{assigned[v.i]=(assigned[v.i]||0)+w*(fobOf(v)/subFob);});});
    const items=ch.items||[];
    const impOf=(k)=>ch.isBlanco?Number(items[k]?.totalImp||0):0;
    const service=Number(ch.total||0)-(ch.isBlanco?items.reduce((s,it)=>s+Number(it.totalImp||0),0):0);
    return valid.map((v,k)=>{const fobShare=fobOf(v)/fobTot;const share=wTot>0?((assigned[v.i]||0)+unassigned*fobShare)/wTot:fobShare;const qty=toN(v.p.quantity)||1;const imp=service*share+impOf(k);const fob=fobOf(v);
      return{desc:v.p.description||`Producto ${v.i+1}`,qty,fob,fobUnit:fob/qty,imp,impUnit:imp/qty,total:fob+imp,totalUnit:(fob+imp)/qty};});
  };

  // ══════════ VISTA RESULTADOS ══════════
  if(results){
    const delivCost=getShipCost(delivery,tot.totWeight);
    const chans=results.channels||[];const calc=chans.filter(c=>!c.noCalc);
    const cheapest=calc.length?calc.reduce((a,b)=>a.total<b.total?a:b):null;
    const facturable=Math.max(tot.totWeight,noDims?0:tot.totVol);
    // Vías no disponibles: se muestran igual, con el motivo (solo dos motivos posibles).
    const hasAereo=calc.some(c=>c.key.includes("aereo")),hasMar=calc.some(c=>c.key.includes("maritimo"));
    const noDimsReason=noDims||tot.totCBM===0;
    const unavailable=[];
    if(isChina&&!hasAereo)unavailable.push({key:"aereo_a_china",name:"Aéreo Courier Comercial",motivo:owPk?<>Uno de los bultos de tu envío ({fmt2(toN(owPk.weight))} kg) supera los 50 kg por pieza.<br/>{t("calc.courierMax50")}<br/>{t("calc.courierSplit")}</>:t("calc.noWeightDims")});
    if(!hasMar)unavailable.push({key:"maritimo_b",name:"Marítimo Integral AC",motivo:noDimsReason?t("calc.noDimsSea"):t("calc.noSeaForCargo")});
    const ordered=[...calc.filter(c=>c.key.includes("aereo")),...calc.filter(c=>!c.key.includes("aereo"))];
    const RES_PANEL={...PANEL,padding:"24px"};
    const line=(l,v,opts={})=><div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,padding:opts.total?"12px 0 0":"7px 0",borderTop:opts.total?"1px solid rgba(255,255,255,0.22)":"none",marginTop:opts.total?8:0}}><span style={{fontSize:opts.total?14:13,color:"#fff",fontWeight:opts.total?700:500,opacity:opts.total?1:0.92}}>{l}</span><span style={{fontSize:opts.total?18:13.5,fontWeight:opts.total?800:600,color:opts.total?GOLD_LIGHT:"#fff",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{usd(v)}</span></div>;
    const sum=(items,f)=>items.reduce((s,it)=>s+Number(f(it)||0),0);
    const BOX={padding:"6px 16px 12px",borderRadius:12,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.14)"};
    const TH=(h,i)=><th key={i} style={{textAlign:i?"right":"left",padding:"8px 8px",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:SKY,borderBottom:"1px solid rgba(255,255,255,0.18)",whiteSpace:"nowrap"}}>{h}</th>;
    const TD=(c,ci,hot,last)=><td key={ci} style={{textAlign:ci?"right":"left",padding:"9px 8px",color:hot?GOLD_LIGHT:"#fff",fontWeight:hot?800:ci?500:600,borderBottom:last?"none":"1px solid rgba(255,255,255,0.1)",fontVariantNumeric:"tabular-nums",whiteSpace:ci?"nowrap":"normal"}}>{c}</td>;
    const breakdown=(ch,total)=>{const its=ch.items||[];return <div style={BOX}>
      {ch.isBlanco?<>
        {line("Flete internacional",ch.flete)}
        {ch.battExtra>0&&line("Recargo por baterías",ch.battExtra)}
        {Number(ch.overweightSurcharge||0)>0&&line(t("op.overweight"),ch.overweightSurcharge)}
        {line("Seguro (1%)",ch.seguro)}
        {line(its.length===1?`Derechos de importación (${its[0].drPct}%)`:"Derechos de importación",sum(its,it=>it.derechos))}
        {line(its.length===1?`${t("merc.statRate")} (${its[0].tePct}%)`:t("merc.statRate"),sum(its,it=>it.tasa_e))}
        {line(its.length===1?`IVA (${its[0].ivaPct}%)`:"IVA",sum(its,it=>it.iva))}
        {ch.isMar?line("IVA adicional + IIGG + IIBB",sum(its,it=>(it.ivaAdic||0)+(it.iigg||0)+(it.iibb||0))):<>{line("Gasto documental",sum(its,it=>it.desembolso))}{sum(its,it=>it.ivaDesemb)>0&&line("IVA sobre gasto documental",sum(its,it=>it.ivaDesemb))}</>}
        {delivCost>0&&line(t("op.homeDelivery"),delivCost)}
      </>:<>
        {line(ch.key==="maritimo_a_china"?t("quotes.seaService"):t("op.integralService"),Number(ch.flete||0)+Number(ch.surcharge||0))}
        {ch.battExtra>0&&line("Recargo por baterías",ch.battExtra)}
        {Number(ch.overweightSurcharge||0)>0&&line(t("op.overweight"),ch.overweightSurcharge)}
        {delivCost>0&&line(t("op.homeDelivery"),delivCost)}
      </>}
      {line("Total",total,{total:true})}
      {!ch.isBlanco&&<p style={{fontSize:12,color:SUB,margin:"10px 0 0",lineHeight:1.5}}>{t("calc.allInNote")}</p>}
    </div>;};
    const waMedidaMsg=(()=>{const prodLines=products.filter(p=>(p.description||"").trim()||toN(p.unit_price)>0).map((p,i)=>`🏷️ *Mercadería ${i+1}*\nDescripción: ${p.description||"—"}\nCantidad: ${p.quantity||1}\nValor unitario: USD ${fmt2(toN(p.unit_price))}`).join("\n\n");
      const pkgLines=pkgs.filter(p=>toN(p.weight)>0||toN(p.length)>0).map((p,i)=>{const dims=(toN(p.length)&&toN(p.width)&&toN(p.height))?`${p.length}×${p.width}×${p.height} cm`:t("calc.noDimsShort");return `📦 *Bulto ${i+1}*\nDimensiones: ${dims}\nPeso unitario: ${toN(p.weight)||0} kg\nCantidad: ${p.qty||1}`;}).join("\n\n");
      return encodeURIComponent(`Hola! Coticé en el portal pero mi carga necesita cotización a medida.${prodLines?`\n\n${prodLines}`:""}${pkgLines?`\n\n${pkgLines}`:""}`);})();
    const chHead=(ch,extraRight,sub,dim)=>{const isAereo=ch.key.includes("aereo");const [big,small]=chTitle(ch);return <>
      <span style={{width:44,height:44,borderRadius:12,border:HAIR,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,opacity:dim?0.5:1}}>{isAereo?"✈️":"🚢"}</span>
      <span style={{flex:1,minWidth:0}}>
        <span style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><span style={{fontSize:16,color:"#fff",letterSpacing:"-0.01em",opacity:dim?0.7:1}}><b style={{fontWeight:800,letterSpacing:"0.02em"}}>{big}</b><span style={{color:"rgba(255,255,255,0.45)",margin:"0 8px"}}>—</span><span style={{fontWeight:500}}>{small}</span></span>{extraRight}</span>
        <span style={{display:"block",fontSize:12.5,color:dim?"#fca5a5":SKY,marginTop:4,lineHeight:1.5}}>{sub}</span>
      </span>
    </>;};
    const unavailRow=(list)=>list.map(u=><div key={u.key} className="rs-head" style={{display:"flex",alignItems:"center",gap:16,padding:"18px 20px",border:"1px dashed rgba(248,113,113,0.5)",borderRadius:14,marginTop:10,background:"rgba(248,113,113,0.06)"}}>
      {chHead(u,null,<><strong style={{color:"#f87171"}}>Motivo:</strong> {u.motivo}</>,true)}
      <span style={{fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"6px 10px",borderRadius:999,background:"rgba(248,113,113,0.16)",color:"#f87171",border:"1px solid rgba(248,113,113,0.5)",whiteSpace:"nowrap"}}>{t("calc.wayUnavailable")}</span>
    </div>);
    const tagPill=(tag)=>{const barata=tag==="cheapest";return <span style={{fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"4px 9px",borderRadius:999,background:barata?"rgba(34,197,94,0.2)":"rgba(184,149,106,0.24)",color:barata?"#4ade80":GOLD_LIGHT,border:`1px solid ${barata?"rgba(34,197,94,0.5)":"rgba(232,208,152,0.55)"}`}}>{t(barata?"calc.cheapestTag":"calc.fastestTag")}</span>;};
    return <div ref={resultsRef}>
      <div style={{marginBottom:16}}>{btnGhost("← Volver a editar",()=>{setResults(null);setExpandedCh(null);})}</div>
      <div style={RES_PANEL}>
        <div className="rs-stats" style={{display:"flex",justifyContent:"center",flexWrap:"wrap",marginBottom:20,padding:"14px 0",borderRadius:12,background:"rgba(255,255,255,0.05)",border:HAIR}}>
          {[["Total FOB",usd(totalFob)],["Peso facturable",facturable>0?`${fmt2(facturable)} kg`:"—"],["Volumen",!noDims&&tot.totCBM>0?`${tot.totCBM.toFixed(3)} m³`:"—"],[t("calc.validUntil"),new Date(Date.now()+15*864e5).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"})]].map(([l,v],i)=><div key={i} style={{flex:"1 1 140px",textAlign:"center",padding:"4px 16px",borderLeft:i?"1px solid rgba(255,255,255,0.16)":"none"}}><p style={{...LBL,fontSize:10,color:SKY}}>{l}</p><p style={{margin:"5px 0 0",fontSize:19,fontWeight:800,color:"#fff",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em"}}>{v}</p></div>)}
        </div>
        {ordered.map((ch,i)=>{const open=expandedCh===ch.key;const total=ch.total+delivCost;const tag=calc.length>1&&cheapest&&ch.key===cheapest.key?"cheapest":calc.length>1&&ch.key==="aereo_a_china"?"fastest":null;
          const its=ch.items||[];const svc=Number(ch.flete||0)+Number(ch.surcharge||0)+Number(ch.seguro||0)+Number(ch.battExtra||0)+Number(ch.overweightSurcharge||0);const imp=ch.isBlanco?sum(its,it=>it.totalImp):0;
          const half=(l,v,extra)=><div style={{flex:"1 1 260px",padding:"14px 18px",borderRadius:12,border:"1px solid rgba(255,255,255,0.14)",background:"#0B1628",textAlign:"center"}}><p style={{...LBL,fontSize:10.5,color:SKY}}>{l}</p>{v!=null&&<p style={{margin:"6px 0 0",fontSize:18,fontWeight:800,color:"#fff",fontVariantNumeric:"tabular-nums"}}>{usd(v)}</p>}{extra}</div>;
          return <div key={ch.key} style={{border:`1px solid ${open?"rgba(232,208,152,0.65)":"rgba(140,200,245,0.25)"}`,borderRadius:16,marginTop:i?14:0,background:open?"linear-gradient(180deg, rgba(184,149,106,0.14), rgba(184,149,106,0.06))":"linear-gradient(180deg, rgba(140,200,245,0.1), rgba(140,200,245,0.04))",transition:"border-color 150ms",boxShadow:"0 10px 26px rgba(0,0,0,0.28)"}}>
            <div className="rs-head" style={{display:"flex",alignItems:"center",gap:18,padding:"20px 22px 14px"}}>
              {chHead(ch,tag&&tagPill(tag),`Llega en ${transitOf(ch)}`,false)}
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",padding:"0 22px 12px"}}>
              {ch.isBlanco?<>{half(t("quotes.freightIns"),svc)}{half(t("imports.taxes"),imp)}</>:<>{half(ch.key==="maritimo_a_china"?t("quotes.seaService"):t("op.integralService"),svc)}{half("Tarifa ALL IN",null,<p style={{margin:"6px 0 0",fontSize:12.5,color:"#fff",lineHeight:1.5,fontWeight:500}}>{t("calc.closedCost")}</p>)}</>}
            </div>
            <div style={{margin:"0 22px 12px",padding:"14px 20px",borderRadius:12,border:"1px solid rgba(232,208,152,0.55)",background:"rgba(184,149,106,0.16)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><span style={{fontSize:13,fontWeight:800,color:"#fff",letterSpacing:"0.14em",textTransform:"uppercase"}}>Total</span><span className="rs-price" style={{fontSize:30,fontWeight:900,color:GOLD_LIGHT,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",whiteSpace:"nowrap",lineHeight:1}}><span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.8)",marginRight:8,letterSpacing:"0.06em"}}>USD</span>{fmt2(total)}</span></div>
            {ch.isBlanco&&<div style={{padding:"0 22px 18px"}}><button onClick={()=>setExpandedCh(open?null:ch.key)} style={{width:"100%",height:44,borderRadius:10,fontSize:13.5,fontWeight:800,letterSpacing:"0.04em",cursor:"pointer",border:"1px solid rgba(140,200,245,0.7)",background:open?SKY:"rgba(140,200,245,0.16)",color:open?"#0A1628":SKY}}>{open?"Ocultar desglose ▲":t("calc.viewBreakdown")+" ▼"}</button></div>}
            {(open||!ch.isBlanco)&&<div style={{padding:"0 22px 20px"}}>
              {ch.isBlanco&&breakdown(ch,total)}
              <div style={{display:"flex",gap:10,marginTop:ch.isBlanco?14:0,flexWrap:"wrap"}}>
                <a href={`https://wa.me/5491125088580?text=${makeWAMsg(ch)}`} onClick={()=>saveQuote(ch)} target="_blank" rel="noopener noreferrer" style={{flex:"1 1 240px",padding:"14px 18px",fontSize:14.5,fontWeight:800,borderRadius:10,background:"#22c55e",color:"#062012",textAlign:"center",textDecoration:"none",letterSpacing:"0.01em",boxShadow:"0 6px 22px rgba(34,197,94,0.35)"}}>{t("calc.goWithThis")}</a>
                <button onClick={()=>printPortalCalcPdf({t,ch,products,totalFob:results.totalFob??totalFob,origin:origin||results.origin,clientName:client?(`${client.first_name||""} ${client.last_name||""}`.trim()):"",delivCost})} style={{padding:"13px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:"1px solid rgba(255,255,255,0.32)",background:"rgba(255,255,255,0.14)",color:"#fff",cursor:"pointer"}}>📄 Exportar PDF</button>
              </div>
            </div>}
          </div>;})}
        {unavailRow(unavailable)}
      </div>

      {calc.length===0&&<div style={{...RES_PANEL,textAlign:"center",padding:"32px 24px"}}>
        <p style={{fontSize:14,fontWeight:800,color:"#fff",margin:"0 0 8px",letterSpacing:"0.14em",textTransform:"uppercase"}}>{t("calc.customQuote")}</p>
        <p style={{fontSize:13.5,color:SUB,margin:"0 auto 18px",maxWidth:560,lineHeight:1.6}}>{t("calc.customQuoteDesc")}</p>
        <a href={`https://wa.me/5491125088580?text=${waMedidaMsg}`} target="_blank" rel="noreferrer" style={{display:"inline-block",padding:"13px 28px",fontSize:14.5,fontWeight:800,borderRadius:10,background:"#22c55e",color:"#062012",textDecoration:"none",boxShadow:"0 6px 22px rgba(34,197,94,0.35)"}}>{t("calc.customQuoteCta")}</a>
      </div>}

      {/* Cálculo de costos: separado de la cotización */}
      {calc.length>0&&validIdx.length>0&&<div style={RES_PANEL}>
        <p style={{fontSize:16,fontWeight:800,color:"#fff",margin:"0 0 6px",letterSpacing:"0.14em",textTransform:"uppercase",textAlign:"center"}}>{t("calc.unitCosts")}</p>
        <p style={{fontSize:13,color:SUB,margin:"0 auto 18px",lineHeight:1.5,textAlign:"center",maxWidth:760}}>Cuánto te cuesta cada producto puesto en Argentina según la vía de importación. Costo unitario = lo que le pagás al proveedor (FOB) · Importación = flete, seguro, impuestos y gastos{multi?(anyAssigned?t("calc.proratedByPkg"):t("calc.proratedByFob")):""}.</p>
        {ordered.map((ch,i)=>{const cpp=costPerProduct(ch);const [big,small]=chTitle(ch);return <div key={ch.key} style={{marginTop:i?16:0}}>
          <p style={{margin:"0 0 8px",fontSize:13.5,color:"#fff"}}><span style={{marginRight:8}}>{ch.key.includes("aereo")?"✈️":"🚢"}</span><b style={{fontWeight:800,letterSpacing:"0.02em"}}>{big}</b><span style={{color:"rgba(255,255,255,0.45)",margin:"0 8px"}}>—</span>{small}</p>
          <div style={{...BOX,padding:"4px 8px",overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,minWidth:640}}>
            <thead><tr>{["Producto","Cantidad","Costo unitario",t("calc.unitImport"),t("calc.unitLanded"),"Total"].map(TH)}</tr></thead>
            <tbody>{cpp.map((r,ri)=><tr key={ri}>{[r.desc,String(r.qty),usd(r.fobUnit),usd(r.impUnit),usd(r.totalUnit),usd(r.total)].map((c,ci)=>TD(c,ci,ci===4,ri===cpp.length-1))}</tr>)}</tbody>
          </table></div>
        </div>;})}
      </div>}
    </div>;
  }

  // ══════════ VISTA CARGA ══════════
  const flagBg=(k)=>k==="China"
    ?<div aria-hidden style={{position:"absolute",inset:0,background:"#C8102E",opacity:0.55}}><span style={{position:"absolute",left:14,top:2,fontSize:42,color:"#FFDE00",lineHeight:1}}>★</span>{[[62,6],[72,16],[72,30],[62,40]].map(([x,y],i)=><span key={i} style={{position:"absolute",left:x,top:y,fontSize:12,color:"#FFDE00",lineHeight:1}}>★</span>)}</div>
    :<div aria-hidden style={{position:"absolute",inset:0,background:"repeating-linear-gradient(180deg,#B22234 0 7.69%,#FFFFFF 7.69% 15.38%)",opacity:0.55}}><div style={{position:"absolute",left:0,top:0,width:"40%",height:"53.8%",background:"#3C3B6E",backgroundImage:"radial-gradient(circle,#fff 1.1px,transparent 1.6px)",backgroundSize:"10px 10px",backgroundPosition:"5px 5px"}}/></div>;
  return <div><h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 22px",letterSpacing:"0.14em",textTransform:"uppercase",textAlign:"center"}}>{t("calc.title")}</h2>

    {/* País de origen */}
    <div style={PANEL}>
      <p style={{fontSize:14,fontWeight:800,color:"#fff",margin:"0 0 14px",textAlign:"center",letterSpacing:"0.14em",textTransform:"uppercase"}}>{t("calc.originCountry")}</p>
      <div className="origin-picker" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,maxWidth:680,margin:"0 auto"}}>{["China","USA"].map(k=>{const on=origin===k;const dim=!!origin&&!on;return <button key={k} onClick={()=>pickOrigin(k)} style={{position:"relative",overflow:"hidden",height:96,borderRadius:14,border:`2px solid ${on?GOLD_LIGHT:"rgba(255,255,255,0.22)"}`,background:"#0B1628",cursor:"pointer",padding:0,opacity:dim?0.5:1,boxShadow:on?"0 0 0 3px rgba(232,208,152,0.25), 0 12px 28px rgba(0,0,0,0.35)":"0 8px 20px rgba(0,0,0,0.25)",transition:"all 160ms"}}>
        {flagBg(k)}
        <span aria-hidden style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(6,12,24,0.25), rgba(6,12,24,0.7))"}}/>
        <span style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",gap:16,height:"100%"}}>
          <span style={{fontSize:32,fontWeight:900,color:"#fff",letterSpacing:"0.22em",textTransform:"uppercase",textShadow:"0 2px 6px rgba(0,0,0,0.95), 0 4px 18px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,1)"}}>{k}</span>
        </span>
      </button>;})}</div>
    </div>

    {/* Batería (solo China) */}
    {isChina&&<div style={PANEL}>
      <p style={{fontSize:14,fontWeight:800,color:"#fff",margin:"0 0 14px",textAlign:"center",letterSpacing:"0.14em",textTransform:"uppercase"}}>{t("calc.batteryQ")}</p>
      <div className="batt-picker" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,maxWidth:680,margin:"0 auto"}}>{[[true,"⚡",t("calc.batteryYes"),t("calc.batteryYesSub")],[false,"✓",t("calc.batteryNo"),t("calc.batteryNoSub")]].map(([v,ic,l,sub])=>{const on=hasBattery===v;return <button key={String(v)} onClick={()=>setHasBattery(v)} style={{position:"relative",overflow:"hidden",padding:"18px 74px",borderRadius:14,border:`2px solid ${on?GOLD_LIGHT:"rgba(255,255,255,0.22)"}`,background:v?"radial-gradient(220px 120px at 8% 50%, rgba(251,191,36,0.28), rgba(11,22,40,0) 70%), #0B1628":"radial-gradient(220px 120px at 8% 50%, rgba(140,200,245,0.22), rgba(11,22,40,0) 70%), #0B1628",cursor:"pointer",textAlign:"center",boxShadow:on?"0 0 0 3px rgba(232,208,152,0.25), 0 12px 28px rgba(0,0,0,0.35)":"0 8px 20px rgba(0,0,0,0.25)",transition:"all 160ms"}}>
        <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",width:44,height:44,borderRadius:"50%",border:`1px solid ${on?"rgba(232,208,152,0.7)":"rgba(255,255,255,0.25)"}`,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:v?21:19,color:on?GOLD_LIGHT:"#fff",boxShadow:on&&v?"0 0 18px rgba(232,208,152,0.45)":"none"}}>{ic}</span>
        <span style={{display:"block",fontSize:14,fontWeight:800,color:"#fff",letterSpacing:"0.1em",textTransform:"uppercase"}}>{l}</span><span style={{display:"block",fontSize:12.5,color:SKY,marginTop:3}}>{sub}</span>
      </button>;})}</div>
      {hasBattery===true&&<p style={{fontSize:13,color:"#fff",margin:"20px 0 4px",lineHeight:1.5,textAlign:"center",opacity:0.92}}>{t("calc.batterySurchargeNote")} <strong style={{color:GOLD_LIGHT}}>USD {battRate} por kg</strong> facturable.</p>}
    </div>}

    {/* Productos + bultos */}
    {!unlockProducts?lockedRow(t("calc.productsAndPackages")):(()=>{
      const chip=(l,v,hot)=><div style={{flex:"1 1 120px",padding:"10px 14px",borderRadius:10,border:`1px solid ${hot?"rgba(232,208,152,0.55)":"rgba(255,255,255,0.16)"}`,background:hot?"rgba(184,149,106,0.14)":"rgba(255,255,255,0.05)"}}><p style={{...LBL,fontSize:10,color:hot?GOLD_LIGHT:SKY}}>{l}</p><p style={{margin:"4px 0 0",fontSize:16,fontWeight:700,color:hot?GOLD_LIGHT:"#fff",fontVariantNumeric:"tabular-nums"}}>{v}</p></div>;
      const ncmCell=(p)=>p.ncmLoading?<span style={{fontSize:11.5,color:GOLD_LIGHT,fontWeight:600,whiteSpace:"nowrap"}}>Clasificando…</span>
        :p.ncm?.ncm_code?<span style={{height:40,display:"inline-flex",alignItems:"center",padding:"0 12px",borderRadius:9,background:"rgba(184,149,106,0.16)",border:"1px solid rgba(232,208,152,0.5)",color:GOLD_LIGHT,fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>{p.ncm.ncm_code==="MANUAL"?"Estimado":p.ncm.ncm_code}{p.ncm.antidumping&&<span title="Antidumping" style={{marginLeft:6,color:"#f87171"}}>⚠</span>}</span>
        :<span style={{height:40,display:"inline-flex",alignItems:"center",padding:"0 12px",borderRadius:9,border:"1px dashed rgba(255,255,255,0.35)",color:"rgba(255,255,255,0.7)",fontSize:11,fontWeight:700,letterSpacing:"0.05em",whiteSpace:"nowrap"}}>PENDIENTE</span>;
      const typeCell=(p,i)=><div style={{display:"inline-flex",background:"rgba(255,255,255,0.06)",border:HAIR,borderRadius:9,padding:2,flex:1,justifyContent:"center"}}>{[["general","Carga general"]].map(([k,l])=><button key={k} onClick={()=>chProd(i,"type",k)} style={{padding:"7px 10px",fontSize:11.5,fontWeight:600,borderRadius:7,border:"none",cursor:"pointer",background:p.type===k?"rgba(184,149,106,0.24)":"transparent",color:p.type===k?GOLD_LIGHT:"rgba(255,255,255,0.75)",whiteSpace:"nowrap"}}>{l}</button>)}</div>;
      return <div style={PANEL}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <p style={{...LBL,fontSize:13}}>Productos</p>
          <button onClick={addProduct} style={SMALL_GOLD}>+ Producto</button>
        </div>
        <div className="pc-head" style={{display:"grid",gridTemplateColumns:PROD_COLS,gap:8,padding:"0 4px 6px"}}>{(isChina?[t("common.description"),"USD c/u","Cantidad","NCM / HS sugerida","NCM Argencargo"]:[t("common.description"),"USD c/u","Cantidad","Tipo"]).map((h,i)=><span key={i} style={{...LBL,fontSize:10,color:SKY,textAlign:i>0?"center":"left",paddingRight:i===(isChina?4:3)?40:0}}>{h}</span>)}</div>
        {products.map((p,i)=><div key={i}>
          <div className="pc-row" style={{display:"grid",gridTemplateColumns:PROD_COLS,gap:8,alignItems:"center",padding:"6px 4px",borderTop:i>0?HAIR:"none"}}>
            <input className="pc-desc" value={p.description||""} onChange={e=>chProd(i,"description",e.target.value)} placeholder={isChina?"Sé específico. Ej: Auriculares inalámbricos bluetooth":t("calc.productPlaceholder")} style={{...INP,textAlign:"left"}} onFocus={onF} onBlur={onB}/>
            {numIn({value:p.unit_price,onChange:v=>chProd(i,"unit_price",v),placeholder:"USD c/u"})}
            {numIn({value:p.quantity,onChange:v=>chProd(i,"quantity",v),placeholder:"Cant."})}
            {isChina&&<input className="pc-hint" value={p.ncm_hint||""} onChange={e=>{const v=e.target.value;if(/^[\d.]*$/.test(v))chProd(i,"ncm_hint",v);}} placeholder="(OPCIONAL)" title={t("merc.hsHint")} style={{...INP,fontFamily:"'JetBrains Mono',monospace",fontSize:13}} onFocus={onF} onBlur={onB}/>}
            <div className={isChina?"pc-tail":"pc-tail pc-tail-full"} style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",minWidth:0}}>
              {isChina?ncmCell(p):typeCell(p,i)}
              {delBtn(()=>rmProduct(i),products.length<=1)}
            </div>
          </div>
          {isChina&&(()=>{const est=()=>chProd(i,"ncm",{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:35,statistics_rate:3,iva_rate:21});const n=p.ncm;
            return <div style={{padding:"0 4px 8px"}}>
              {n?.ncm_code&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>{[[t("quotes.duties"),n.import_duty_rate],[t("merc.statRate"),n.statistics_rate],["IVA",n.iva_rate]].map(([l,v])=><span key={l} style={{display:"inline-flex",alignItems:"center",gap:8,height:30,padding:"0 12px",borderRadius:8,border:HAIR,background:"rgba(255,255,255,0.07)"}}><span style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:SKY}}>{l}</span><span style={{fontSize:13,fontWeight:800,color:"#fff",fontVariantNumeric:"tabular-nums"}}>{v}%</span></span>)}</div>}
              {n?.hint_verdict==="diff"&&<p style={{fontSize:12,color:"#fbbf24",margin:"6px 0 0",lineHeight:1.5}}>Tu posición sugerida ({n.hint_code}) no corresponde para esta mercadería{n.hint_note?`: ${n.hint_note}`:"."}</p>}
              {n?.hint_verdict==="ok"&&<p style={{fontSize:12,color:"#4ade80",margin:"6px 0 0"}}>{t("merc.hsMatch")}</p>}
              {n?.antidumping&&<p style={{fontSize:12,color:"#f87171",margin:"6px 0 0",lineHeight:1.5}}>⚠ Este producto tiene medidas antidumping para origen China ({n.antidumping.producto}{n.antidumping.medidaTexto?` · ${n.antidumping.medidaTexto}`:""}). La cotización es estimativa: el equipo la revisa antes de confirmar.</p>}
              {p.ncmError&&<div style={{marginTop:8,padding:"10px 12px",borderRadius:10,border:"1px solid rgba(255,107,107,0.35)",background:"rgba(255,107,107,0.08)"}}>
                <p style={{fontSize:12.5,color:"#ff8a8a",margin:"0 0 8px",fontWeight:600}}>No pudimos clasificar “{p.description}” automáticamente</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <button onClick={est} style={SMALL_GOLD}>Usar valores estimados (35 % derechos)</button>
                  <a href={`https://wa.me/5491125088580?text=${encodeURIComponent("Hola! Necesito ayuda para clasificar: "+p.description)}`} target="_blank" rel="noopener noreferrer" style={{...SMALL_GHOST,color:"#4ade80"}}>{t("merc.askWA")}</a>
                  <span style={{fontSize:11,color:SUB}}>{t("calc.orLoadRates")}</span>
                  {[["Derechos %","import_duty_rate",35],["TE %","statistics_rate",3],["IVA %","iva_rate",21]].map(([l,f,def])=><input key={f} type="text" inputMode="decimal" placeholder={l} onChange={e=>{const v=e.target.value===""?def:toN(e.target.value);chProd(i,"ncm",{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:p.ncm?.import_duty_rate??35,statistics_rate:p.ncm?.statistics_rate??3,iva_rate:p.ncm?.iva_rate??21,[f]:v});}} style={{...INP,width:96,height:32,fontSize:12}} onFocus={onF} onBlur={onB}/>)}
                </div>
              </div>}
            </div>;})()}
        </div>)}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginTop:10,paddingTop:14,borderTop:HAIR}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:14,padding:"8px 16px",borderRadius:10,border:"1px solid rgba(232,208,152,0.35)",background:"rgba(184,149,106,0.1)"}}><span style={{fontSize:13,fontWeight:800,color:"#fff",letterSpacing:"0.08em",textTransform:"uppercase",lineHeight:1}}>{t("merc.fobGoods")}</span><span style={{fontSize:22,fontWeight:800,color:totalFob>0?GOLD_LIGHT:"rgba(255,255,255,0.4)",fontVariantNumeric:"tabular-nums",lineHeight:1}}>{totalFob>0?usd(totalFob):"—"}</span></div>
          {pendingClass&&!classifyingAll&&<span style={{flex:"1 1 200px",fontSize:12,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",color:"#f87171",textAlign:"right"}}>{t("calc.classifyFirst")}</span>}
          {isChina&&sinNcm.length>0&&<button onClick={classifyAll} disabled={classifyingAll} style={{height:40,padding:"0 20px",fontSize:12.5,fontWeight:800,letterSpacing:"0.06em",borderRadius:9,cursor:classifyingAll?"wait":"pointer",background:GOLD_GRADIENT,color:"#0A1628",border:`1px solid ${GOLD_DEEP}`,opacity:classifyingAll?0.6:1,boxShadow:GOLD_GLOW}}>{classifyingAll?"CLASIFICANDO…":`CLASIFICAR NCM${sinNcm.length>1?` (${sinNcm.length})`:""}`}</button>}
        </div>

        {/* Bultos */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:22,paddingTop:20,borderTop:HAIR,marginBottom:12}}>
          <p style={{...LBL,fontSize:13}}>Bultos <span style={{color:SKY,letterSpacing:0,textTransform:"none",fontWeight:500}}>· cm / kg</span></p>
          <button onClick={addPkg} style={SMALL_GOLD}>+ Bulto</button>
        </div>
        <div className="pk-head" style={{display:"grid",gridTemplateColumns:PK_COLS,gap:8,padding:"0 4px 6px"}}>{[...(multi?[t("imports.product")]:[]),t("imports.colQty"),t("calc.length"),t("calc.width"),t("calc.height"),t("calc.weight"),"",""].map((h,i)=><span key={i} style={{...LBL,fontSize:10,color:SKY,textAlign:"center",position:"relative"}}>{h}{multi&&i===0&&<span style={{position:"relative",display:"inline-block",marginLeft:8,verticalAlign:"middle"}}>
          <button onClick={()=>setHelpOpen(v=>!v)} title={t("calc.whatFor")} style={{width:18,height:18,borderRadius:"50%",border:`1px solid ${helpOpen?GOLD_LIGHT:"rgba(140,200,245,0.7)"}`,background:helpOpen?"rgba(184,149,106,0.25)":"rgba(140,200,245,0.15)",color:helpOpen?GOLD_LIGHT:SKY,fontSize:11,fontWeight:800,cursor:"pointer",lineHeight:1,padding:0}}>?</button>
          {helpOpen&&<div onClick={closeHelp} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(4,10,22,0.78)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,textTransform:"none",letterSpacing:0,textAlign:"left"}}>
            <div onClick={e=>e.stopPropagation()} style={{width:"min(560px, 100%)",padding:"28px 30px",borderRadius:18,background:"linear-gradient(180deg,#132340,#0B1628)",border:"1px solid rgba(232,208,152,0.55)",boxShadow:"0 30px 70px rgba(0,0,0,0.6)"}}>
              <p style={{fontSize:13,fontWeight:800,color:GOLD_LIGHT,margin:"0 0 14px",letterSpacing:"0.14em",textTransform:"uppercase",textAlign:"center"}}>{t("calc.unitCostTitle")}</p>
              <p style={{fontSize:14,color:"#fff",margin:"0 0 12px",lineHeight:1.65,fontWeight:500}}>{t("calc.unitCostP1")}</p>
              <p style={{fontSize:14,color:"#fff",margin:"0 0 12px",lineHeight:1.65,fontWeight:500}}>{t("calc.unitCostP2")}</p>
              <p style={{fontSize:14,color:"#fff",margin:"0 0 12px",lineHeight:1.65,fontWeight:500}}><strong style={{color:GOLD_LIGHT}}>{t("calc.whatFor")}</strong> {t("calc.unitCostP3")}</p>
              <p style={{fontSize:12.5,color:SKY,margin:"0 0 20px",lineHeight:1.6}}>{t("calc.unitCostP4")}</p>
              <div style={{display:"flex",justifyContent:"center"}}>{btnGold("Entendido",closeHelp)}</div>
            </div>
          </div>}
        </span>}</span>)}</div>
        {pkgs.map((pk,i)=>{const q=toN(pk.qty)||1,l=toN(pk.length),w=toN(pk.width),h=toN(pk.height),gw=toN(pk.weight);const bruto=gw*q;const vol=!noDims&&l&&w&&h?((l*w*h)/5000)*q:0;const m3=!noDims&&l&&w&&h?((l*w*h)/1e6)*q:0;const ids=pkIds(pk);
          return <div key={i} className="pk-row" style={{display:"grid",gridTemplateColumns:PK_COLS,gap:8,alignItems:"center",padding:"6px 4px",borderTop:i>0?HAIR:"none"}}>
          {multi&&(()=>{const open=pkOpen===i;const chosen=pkChosen(pk);const label=!chosen?t("calc.pickGoods"):ids.length===0?t("op.variousUnassigned"):ids.map(idx=>products[idx].description||`Producto ${idx+1}`).join(", ");
            return <div className="pk-prod" style={{position:"relative",minWidth:0}}>
              <button onClick={()=>open?setPkOpen(null):openPkDropdown(i)} style={{...INP,textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,cursor:"pointer",color:!chosen?"rgba(255,255,255,0.5)":ids.length?GOLD_LIGHT:"#fff",fontWeight:ids.length?700:500,borderColor:open?"rgba(232,208,152,0.85)":!chosen?"rgba(140,200,245,0.5)":"rgba(255,255,255,0.2)"}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span><span style={{fontSize:10,color:SKY,flexShrink:0}}>{open?"▲":"▼"}</span></button>
              {open&&<><div onClick={()=>setPkOpen(null)} style={{position:"fixed",inset:0,zIndex:40}}/><div style={{position:"absolute",left:0,top:44,zIndex:41,minWidth:"100%",width:"max-content",maxWidth:360,padding:6,borderRadius:12,background:"#0E1B30",border:"1px solid rgba(232,208,152,0.5)",boxShadow:"0 16px 40px rgba(0,0,0,0.55)"}}>
                <button onClick={()=>{clearPkProd(i);setPkOpen(null);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 10px",borderRadius:8,border:"none",background:chosen&&ids.length===0?"rgba(140,200,245,0.14)":"transparent",color:chosen&&ids.length===0?SKY:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",textAlign:"left"}}><span style={{width:16,height:16,borderRadius:"50%",border:`1.5px solid ${chosen&&ids.length===0?SKY:"rgba(255,255,255,0.4)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{chosen&&ids.length===0&&<span style={{width:8,height:8,borderRadius:"50%",background:SKY}}/>}</span>{t("op.variousUnassigned")}</button>
                <div style={{height:1,background:"rgba(255,255,255,0.12)",margin:"4px 6px"}}/>
                {validIdx.map(idx=>{const on=ids.includes(idx);const d=products[idx].description||`Producto ${idx+1}`;return <button key={idx} onClick={()=>togglePkProd(i,idx)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 10px",borderRadius:8,border:"none",background:on?"rgba(184,149,106,0.16)":"transparent",color:on?GOLD_LIGHT:"#fff",fontSize:13,fontWeight:on?700:500,cursor:"pointer",textAlign:"left"}}><span style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${on?GOLD_LIGHT:"rgba(255,255,255,0.45)"}`,background:on?GOLD_GRADIENT:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,color:"#0A1628",fontWeight:900}}>{on?"✓":""}</span><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d}</span></button>;})}
              </div></>}
            </div>;})()}
          {numIn({value:pk.qty,onChange:v=>chPkg(i,"qty",v),placeholder:"1"})}
          {numIn({value:pk.length,onChange:v=>chPkg(i,"length",v),placeholder:noDims?"—":"cm",disabled:noDims})}
          {numIn({value:pk.width,onChange:v=>chPkg(i,"width",v),placeholder:noDims?"—":"cm",disabled:noDims})}
          {numIn({value:pk.height,onChange:v=>chPkg(i,"height",v),placeholder:noDims?"—":"cm",disabled:noDims})}
          {numIn({value:pk.weight,onChange:v=>chPkg(i,"weight",v),placeholder:"kg"})}
          {delBtn(()=>rmPkg(i),pkgs.length<=1)}
          <div className="pk-info" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,minWidth:0}}>{[["Peso bruto",bruto>0?`${fmt2(bruto)} kg`:"—",bruto>0&&bruto>=vol],["Peso volumétrico",vol>0?`${fmt2(vol)} kg`:"—",vol>bruto],["m³",m3>0?`${m3.toFixed(3)}`:"—",false]].map(([l,v,hot])=><span key={l} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:40,padding:"0 6px",borderRadius:8,border:`1px solid ${hot?"rgba(232,208,152,0.6)":"rgba(255,255,255,0.18)"}`,background:hot?"rgba(184,149,106,0.16)":"rgba(255,255,255,0.07)",minWidth:0}}><span style={{fontSize:8.5,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:hot?GOLD_LIGHT:SKY,whiteSpace:"nowrap"}}>{l}</span><span style={{fontSize:12,fontWeight:700,color:hot?GOLD_LIGHT:"#fff",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{v}</span></span>)}</div>
        </div>;})}
        <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap",alignItems:"stretch"}}>
          {chip("Peso bruto total",tot.totWeight>0?`${fmt2(tot.totWeight)} kg`:"—",tot.totWeight>0&&!volWins)}
          {chip(t("calc.volWeightTotal"),!noDims&&tot.totVol>0?`${fmt2(tot.totVol)} kg`:"—",volWins)}
          {chip("Volumen total",!noDims&&tot.totCBM>0?`${tot.totCBM.toFixed(3)} m³`:"—",false)}
          <div onClick={()=>setNoDims(!noDims)} style={{flex:"1 1 200px",display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:`1px solid ${noDims?"rgba(251,146,60,0.5)":"rgba(255,255,255,0.16)"}`,cursor:"pointer",background:noDims?"rgba(251,146,60,0.12)":"rgba(255,255,255,0.05)",userSelect:"none"}}>
            <span style={{width:30,height:17,borderRadius:999,background:noDims?"#fb923c":"rgba(255,255,255,0.22)",position:"relative",flexShrink:0,transition:"background 180ms"}}><span style={{position:"absolute",top:2,left:noDims?15:2,width:13,height:13,borderRadius:"50%",background:"#fff",transition:"left 180ms"}}/></span>
            <span style={{fontSize:12.5,color:noDims?"#fdba74":"#fff",lineHeight:1.35}}>Desconozco las medidas{noDims&&<span style={{display:"block",fontSize:11,opacity:0.85}}>{t("calc.noDimsNoSea")}</span>}</span>
          </div>
        </div>
        {owPk&&isChina&&<div style={{margin:"14px 0 0",padding:"12px 16px",borderRadius:10,border:"1px solid rgba(251,146,60,0.55)",background:"rgba(251,146,60,0.12)"}}><p style={{fontSize:13.5,fontWeight:700,color:"#fdba74",margin:0,lineHeight:1.55}}>⚠ Uno de los bultos de tu envío ({fmt2(toN(owPk.weight))} kg) supera los 50 kg por pieza. {t("calc.courierMax50Long")}</p></div>}
        <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:12,marginTop:22,paddingTop:18,borderTop:HAIR,flexWrap:"wrap"}}>
          {!canCalc&&hasPriced&&<span style={{fontSize:12,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",color:"#f87171",textAlign:"right"}}>{pendingClass?t("calc.classifyToCalc"):!pkgOk?t("calc.needWeightOrDims"):unassignedProds.length?`Falta asignar a un bulto: ${unassignedProds.map(idx=>products[idx].description||`Producto ${idx+1}`).join(", ")}`:pkgsSinElegir?"Elegí la mercadería de cada bulto":""}</span>}
          {btnGold("Calcular costos →",doCalc,!canCalc)}
        </div>
      </div>;})()}
  </div>;
}
function QuotesPage({token,client,onEdit,onOpenOp}){
  const {t}=useT();
  const [quotes,setQuotes]=useState([]);const [lo,setLo]=useState(true);const [openId,setOpenId]=useState(null);const [openAlt,setOpenAlt]=useState(null);
  // Ops de las cotizaciones armadas desde el depósito (operation_id): se muestran con el código de la op y la abren.
  const [opsById,setOpsById]=useState({});
  const numOf=q=>q.quote_number?`AGC-${String(q.quote_number).padStart(5,"0")}`:null;
  useEffect(()=>{if(!client?.id){setLo(false);return;}(async()=>{const q=await dq("quotes",{token,filters:`?client_id=eq.${client.id}&select=*&order=created_at.desc`});const list=Array.isArray(q)?q:[];setQuotes(list);
    const ids=[...new Set(list.map(x=>x.operation_id).filter(Boolean))];
    if(ids.length){const o=await dq("operations",{token,filters:`?id=in.(${ids.join(",")})&select=*`});const m={};(Array.isArray(o)?o:[]).forEach(x=>{m[x.id]=x;});setOpsById(m);}
    setLo(false);})();},[token,client?.id]);
  const HAIR="1px solid rgba(255,255,255,0.13)";
  const PANEL={background:"linear-gradient(180deg, rgba(13,24,45,0.96), rgba(8,16,32,0.96))",border:HAIR,borderRadius:16,padding:"20px 24px",marginBottom:14,boxShadow:"0 14px 34px rgba(0,0,0,0.28)"};
  const LBL={fontSize:10.5,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#8CC8F5",margin:0};
  const SKY="#8CC8F5";
  const usd=v=>`USD ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmt2=v=>Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtDate=d=>d?new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}):"—";
  const expiryOf=q=>q.expires_at?new Date(q.expires_at):new Date(new Date(q.created_at).getTime()+15*864e5);
  const isExpired=q=>expiryOf(q).getTime()<Date.now();
  const chTitle=a=>({aereo_a_china:[t("calc.air"),"Courier comercial"],maritimo_a_china:[t("calc.sea"),"Carga FCL/LCL"],maritimo_b:[t("calc.sea"),"Integral AC"],aereo_b_spain:[t("calc.air"),"Integral AC"],aereo_b_usa:[t("calc.air"),"Integral AC"]})[a.key]||[a.key?.includes("aereo")?t("calc.air"):t("calc.sea"),a.name];
  const flagOf=o=>o==="USA"?"🇺🇸":o==="España"?"🇪🇸":"🇨🇳";
  const altsOf=q=>{const a=Array.isArray(q.channel_alternatives)?q.channel_alternatives:[];if(a.length)return a;return q.channel_key?[{key:q.channel_key,name:q.channel_name,info:"",totalAbonar:q.total_cost}]:[];};
  const prodsOf=q=>{const p=typeof q.products==="string"?JSON.parse(q.products):q.products;return Array.isArray(p)?p:[];};
  const pkgsOf=q=>{const p=typeof q.packages==="string"?JSON.parse(q.packages):q.packages;return Array.isArray(p)?p:[];};
  const chosenOf=q=>q.client_selected_channel?altsOf(q).find(a=>a.key===q.client_selected_channel)||null:null;
  const cheapestOf=q=>{const a=altsOf(q);return a.length?a.reduce((x,y)=>Number(x.totalAbonar||0)<=Number(y.totalAbonar||0)?x:y):null;};
  const pill=(l,c)=><span style={{fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"4px 10px",borderRadius:999,color:c,background:`${c}22`,border:`1px solid ${c}66`,whiteSpace:"nowrap"}}>{l}</span>;
  const btn=(label,onClick,kind="ghost",disabled)=><button onClick={onClick} disabled={disabled} style={{height:40,padding:"0 18px",fontSize:13,fontWeight:800,borderRadius:10,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,whiteSpace:"nowrap",
    ...(kind==="gold"?{border:`1px solid ${GOLD_DEEP}`,background:GOLD_GRADIENT,color:"#0A1628",boxShadow:GOLD_GLOW}:kind==="green"?{border:"none",background:"#22c55e",color:"#062012",boxShadow:"0 6px 22px rgba(34,197,94,0.35)"}:kind==="red"?{border:"1px solid rgba(248,113,113,0.45)",background:"rgba(248,113,113,0.1)",color:"#f87171"}:kind==="sky"?{border:"1px solid rgba(140,200,245,0.7)",background:"rgba(140,200,245,0.16)",color:SKY}:{border:"1px solid rgba(255,255,255,0.22)",background:"rgba(255,255,255,0.09)",color:"#fff"})}}>{label}</button>;
  const choose=async(q,a)=>{try{await dq("quotes",{method:"PATCH",token,filters:`?id=eq.${q.id}`,body:{client_selected_channel:a.key,channel_key:a.key,channel_name:a.name,total_cost:a.totalAbonar}});setQuotes(p=>p.map(x=>x.id===q.id?{...x,client_selected_channel:a.key,channel_key:a.key,channel_name:a.name,total_cost:a.totalAbonar}:x));toast(`Elegiste ${a.name}`,"success");}catch(e){toast(t("quotes.saveChoiceError"),"error");}};
  const delQuote=async(q)=>{if(!await confirmDialog(t("quotes.confirmDelete"),{confirmText:"Eliminar",danger:true}))return;await dq("quotes",{method:"DELETE",token,filters:`?id=eq.${q.id}`});setQuotes(p=>p.filter(x=>x.id!==q.id));toast(t("quotes.deleted"),"success");};
  const sendWA=(q)=>{const a=chosenOf(q)||cheapestOf(q);const prods=prodsOf(q);const summary=prods.map(p=>`${p.description||p.type} x${p.quantity}`).join(", ");const isAereo=(a?.key||"").includes("aereo");
    const msg=encodeURIComponent(`Hola Bautista! Quiero avanzar con la cotización ${numOf(q)||fmtDate(q.created_at)} que tengo guardada en el portal.\n\nOrigen: *${q.origin}* ${flagOf(q.origin)}\nMercadería: *${summary}*\nVía: *${a?.name||"—"}*\nValor FOB: *${usd(q.total_fob)}*\n${isAereo?`Peso: *${fmt2(q.total_weight)} kg*`:`Volumen: *${Number(q.total_cbm||0).toFixed(3)} m³*`}\nCosto de importación: *${usd(a?.totalAbonar??q.total_cost)}*\nCotizada el ${fmtDate(q.created_at)} · válida hasta ${fmtDate(expiryOf(q))}\n\nCódigo cliente: *${q.client_code}*`);
    window.open(`https://wa.me/5491125088580?text=${msg}`,"_blank");};
  if(lo)return <p style={{color:"rgba(255,255,255,0.6)",textAlign:"center",padding:"3rem 0"}}>Cargando…</p>;
  return <div>
    <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 22px",letterSpacing:"0.14em",textTransform:"uppercase",textAlign:"center"}}>Mis cotizaciones</h2>
    {quotes.length===0?<div style={{...PANEL,textAlign:"center",padding:"40px 24px"}}>
      <p style={{fontSize:15,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>{t("quotes.emptyTitle")}</p>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.7)",margin:0}}>{t("quotes.emptyDesc2")}</p>
    </div>:quotes.map(q=>{const open=openId===q.id;const prods=prodsOf(q);const pkgs=pkgsOf(q);const alts=altsOf(q);const chosen=chosenOf(q);const cheapest=cheapestOf(q);const esImpo=!!q.operation_id;const opQ=esImpo?opsById[q.operation_id]:null;const expired=!esImpo&&isExpired(q);
      const summary=prods.length>3?"Consolidado":(prods.map(p=>p.description||p.type).filter(Boolean).join(" · ")||t("quotes.noProducts"));
      const nPk=pkgs.reduce((s,p)=>s+(Number(String(p.qty??"1").replace(",","."))||1),0);
      return <div key={q.id} style={{...PANEL,border:open?"1px solid rgba(232,208,152,0.5)":HAIR}}>
        <div className="rs-head" style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <span style={{width:44,height:44,borderRadius:12,border:HAIR,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{flagOf(q.origin)}</span>
          <div style={{flex:1,minWidth:220}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><span style={{fontSize:19,fontWeight:900,color:"#fff",letterSpacing:"0.07em",fontVariantNumeric:"tabular-nums"}}>{numOf(q)||"AGC-—"}</span>{esImpo?pill(t("quotes.importPill"),SKY):pill(expired?"Vencida":t("quotes.readyToImport"),expired?"#f87171":"#4ade80")}</div>
            <p style={{margin:"8px 0 0",fontSize:14.5,color:"#fff",fontWeight:700,lineHeight:1.4}}>{summary}</p>
            {esImpo?<p style={{margin:"7px 0 0",fontSize:12,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",color:SKY}}>{t("quotes.importOf")} {opQ?.operation_code||""}</p>
              :<p style={{margin:"7px 0 0",fontSize:12,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",color:"#f87171"}}>{expired?t("quotes.expiredOn"):t("quotes.validUntil")} {fmtDate(expiryOf(q))}</p>}
            <p style={{margin:"5px 0 0",fontSize:12,color:SKY,fontWeight:600}}>Cotizada el {fmtDate(q.created_at)} · FOB {usd(q.total_fob)} · {nPk} {nPk===1?"bulto":"bultos"}</p>
          </div>
          {btn(open?"Ocultar ▲":t("quotes.viewDetail")+" ▼",()=>setOpenId(open?null:q.id),"sky")}
        </div>
        {open&&<div style={{marginTop:18,paddingTop:18,borderTop:HAIR}}>
          {expired&&<p style={{margin:"0 0 14px",padding:"10px 14px",borderRadius:10,border:"1px solid rgba(248,113,113,0.5)",background:"rgba(248,113,113,0.08)",fontSize:13,fontWeight:600,color:"#fca5a5",lineHeight:1.5}}>{t("quotes.expiredNote")}</p>}
          <p style={{...LBL,marginBottom:8}}>Productos</p>
          <div style={{overflowX:"auto",borderRadius:12,border:HAIR,background:"rgba(255,255,255,0.04)"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,minWidth:560}}>
            <thead><tr>{["Producto","Cant.","USD c/u","FOB","NCM","Derechos","Tasa est.","IVA"].map((h,i)=><th key={i} style={{textAlign:i?"right":"left",padding:"8px 10px",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:SKY,borderBottom:"1px solid rgba(255,255,255,0.18)",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>{prods.map((p,i)=>{const nc=p.ncm||{};const qty=Number(p.quantity||1);const fob=Number(p.unit_price||0)*qty;const last=i===prods.length-1;const td=(c,ci,hot)=><td key={ci} style={{textAlign:ci?"right":"left",padding:"9px 10px",color:hot?GOLD_LIGHT:"#fff",fontWeight:hot?800:ci?500:600,borderBottom:last?"none":"1px solid rgba(255,255,255,0.1)",fontVariantNumeric:"tabular-nums",whiteSpace:ci?"nowrap":"normal"}}>{c}</td>;
              return <tr key={i}>{[p.description||p.type||"—",String(qty),usd(p.unit_price),usd(fob),nc.ncm_code?(nc.ncm_code==="MANUAL"?"Estimado":nc.ncm_code):"—",nc.ncm_code?`${nc.import_duty_rate??0}%`:"—",nc.ncm_code?`${nc.statistics_rate??0}%`:"—",nc.ncm_code?`${nc.iva_rate??21}%`:"—"].map((c,ci)=>td(c,ci,ci===4&&nc.ncm_code))}</tr>;})}</tbody>
          </table></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:12}}>{[[t("merc.fobGoods"),usd(q.total_fob)],["Bultos",String(nPk)],["Peso bruto",Number(q.total_weight)>0?`${fmt2(q.total_weight)} kg`:"—"],["Volumen",Number(q.total_cbm)>0?`${Number(q.total_cbm).toFixed(3)} m³`:"—"]].map(([l,v])=><div key={l} style={{flex:"1 1 140px",padding:"10px 14px",borderRadius:10,border:HAIR,background:"rgba(255,255,255,0.05)"}}><p style={{...LBL,fontSize:10}}>{l}</p><p style={{margin:"4px 0 0",fontSize:15,fontWeight:800,color:"#fff",fontVariantNumeric:"tabular-nums"}}>{v}</p></div>)}</div>

          <p style={{...LBL,margin:"18px 0 8px"}}>{t("quotes.ways")}</p>
          {alts.length===0&&<p style={{fontSize:13,color:"rgba(255,255,255,0.7)",margin:0}}>{t("quotes.noWays")}</p>}
          {alts.map((a,i)=>{const on=chosen?.key===a.key;const [big,small]=chTitle(a);const isAereo=(a.key||"").includes("aereo");const isCheap=alts.length>1&&cheapest&&a.key===cheapest.key;const dk=`${q.id}:${a.key}`;const dOpen=openAlt===dk;
            const detail=Array.isArray(a.detail)&&a.detail.length?a.detail:[Number(a.flete)>0&&["Flete + servicio",a.flete],Number(a.seguro)>0&&["Seguro",a.seguro],Number(a.overweight)>0&&["Recargo por sobrepeso",a.overweight],Number(a.totalTax)>0&&[t("quotes.taxesCustoms"),a.totalTax],Number(a.shipCost)>0&&[t("op.homeDelivery"),a.shipCost]].filter(Boolean);
            return <div key={a.key||i} style={{borderRadius:12,marginTop:i?8:0,border:`1px solid ${on?"rgba(232,208,152,0.65)":"rgba(140,200,245,0.25)"}`,background:on?"rgba(184,149,106,0.12)":"rgba(140,200,245,0.06)"}}>
              <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",padding:"14px 16px"}}>
                <span style={{fontSize:20,width:36,textAlign:"center"}}>{isAereo?"✈️":"🚢"}</span>
                <div style={{flex:1,minWidth:200}}><p style={{margin:0,fontSize:15,color:"#fff"}}><b style={{fontWeight:800,letterSpacing:"0.02em"}}>{big}</b><span style={{color:"rgba(255,255,255,0.45)",margin:"0 8px"}}>—</span>{small}{isCheap&&<span style={{marginLeft:10,fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"3px 8px",borderRadius:999,background:"rgba(34,197,94,0.2)",color:"#4ade80",border:"1px solid rgba(34,197,94,0.5)"}}>{t("calc.cheapestTag")}</span>}</p>{a.info&&<p style={{margin:"3px 0 0",fontSize:12,color:SKY}}>Llega en {a.info}</p>}</div>
                <span style={{fontSize:22,fontWeight:900,color:on?GOLD_LIGHT:"#fff",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}><span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.7)",marginRight:6}}>USD</span>{fmt2(a.totalAbonar)}</span>
                {detail.length>0&&btn(dOpen?"Ocultar ▲":"Desglose ▼",()=>setOpenAlt(dOpen?null:dk),"sky")}
                {on?pill("Elegida",GOLD_LIGHT):btn(t("quotes.pickThisWay"),()=>choose(q,a),"ghost",expired)}
              </div>
              {dOpen&&<div style={{margin:"0 16px 14px",padding:"6px 16px 10px",borderRadius:10,background:"rgba(11,22,40,0.85)",border:HAIR}}>
                {detail.map(([l,v],k)=><div key={k} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.08)"}}><span style={{fontSize:13,color:"#fff",opacity:0.92}}>{l}</span><span style={{fontSize:13.5,fontWeight:600,color:"#fff",fontVariantNumeric:"tabular-nums"}}>{usd(v)}</span></div>)}
                <div style={{display:"flex",justifyContent:"space-between",gap:12,padding:"12px 0 2px"}}><span style={{fontSize:14,fontWeight:700,color:"#fff"}}>Total</span><span style={{fontSize:18,fontWeight:800,color:GOLD_LIGHT,fontVariantNumeric:"tabular-nums"}}>{usd(a.totalAbonar)}</span></div>
                {a.isBlanco===false&&<p style={{fontSize:12,color:SKY,margin:"8px 0 0"}}>{t("quotes.allInShort")}</p>}
              </div>}
            </div>;})}

          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18,paddingTop:16,borderTop:HAIR,alignItems:"center"}}>
            {esImpo?<>{btn(`${t("quotes.viewImport")} →`,()=>opQ&&onOpenOp?.(opQ),"gold",!opQ)}<span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>{t("quotes.importUpdates")}</span></>
              :expired?btn(t("quotes.requote"),()=>onEdit?.(q),"gold"):<>{btn(chosen?`Avanzar por WhatsApp con ${chosen.name} →`:t("quotes.goWA"),()=>sendWA(q),"green")}{btn(t("quotes.editInCalc"),()=>onEdit?.(q),"ghost")}</>}
            <span style={{flex:1}}/>
            {!esImpo&&btn("Eliminar",()=>delQuote(q),"red")}
          </div>
        </div>}
      </div>;})}
  </div>;
}
function PointsPage({token,client}){
  const {t}=useT();
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
    else if(res?.error==="insufficient_points")flash(t("points.notEnoughToast"));
    else flash(t("points.redeemError"));
    setBusy(null);
  };
  const fmtDate=d=>{if(!d)return"—";try{return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}catch{return d;}};
  const fmtDateTime=d=>{if(!d)return"—";try{return new Date(d).toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});}catch{return d;}};
  const expiringSoon=txs.filter(t=>t.type==="earn"&&t.expires_at&&new Date(t.expires_at)<new Date(Date.now()+30*86400000)&&new Date(t.expires_at)>new Date());
  const txLabel={earn:t("points.txEarn"),redeem:t("points.txRedeem"),expire:t("points.txExpire"),refund:t("points.txRefund"),adjust:t("points.txAdjust")};
  const txColor={earn:"#22c55e",redeem:"#60a5fa",expire:"#ef4444",refund:"#a78bfa",adjust:"#fbbf24"};
  const ti=getTierInfo(tier);
  const nextTier=ti.next?Object.values(TIERS).find(t=>t.min===ti.next):null;
  const ptsToNext=nextTier?Math.max(0,nextTier.min-lifetime):0;
  const progressPct=nextTier?Math.min(100,Math.max(0,((lifetime-ti.min)/(nextTier.min-ti.min))*100)):100;
  const pendingVouchers=tierVouchers.filter(v=>v.status==="pending");
  return <div>
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>{t("points.title")}</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"4px 0 0",lineHeight:1.5}}>{t("points.subtitle")}</p>
    </div>
    {msg&&<p style={{fontSize:13,color:"#22c55e",fontWeight:600,marginBottom:16,padding:"10px 14px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:8,animation:"ac_fade_in 200ms"}}>{msg}</p>}

    {/* Tier hero + progress */}
    <div style={{background:`linear-gradient(135deg, ${ti.color}22 0%, rgba(255,255,255,0.02) 100%)`,border:`1px solid ${tier==="standard"?"rgba(255,255,255,0.08)":ti.color+"55"}`,borderRadius:18,padding:"24px 28px",marginBottom:18,position:"relative",overflow:"hidden",boxShadow:tier==="standard"?"none":ti.glow}}>
      <div style={{position:"absolute",top:-50,right:-50,width:220,height:220,background:`radial-gradient(circle, ${ti.color}22 0%, transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap",position:"relative"}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase",letterSpacing:"0.14em"}}>{t("points.yourTier")}</p>
          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:6}}>
            <span style={{fontSize:34}}>{ti.icon}</span>
            <div>
              <p style={{fontSize:32,fontWeight:800,color:"#fff",margin:0,lineHeight:1,letterSpacing:"-0.02em",textShadow:tier!=="standard"?`0 0 20px ${ti.color}55`:"none"}}>{ti.label}</p>
              {tier!=="standard"&&<p style={{fontSize:11,color:ti.light,margin:"4px 0 0",fontWeight:600,letterSpacing:"0.04em"}}>{t("points.bonus",{n:ti.bonus})}</p>}
            </div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase",letterSpacing:"0.1em"}}>{t("points.lifetimeEarned")}</p>
          <p style={{fontSize:24,fontWeight:700,color:"#fff",margin:"4px 0 0",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em"}}>{lifetime.toLocaleString("es-AR")} <span style={{fontSize:12,color:ti.light,fontWeight:600}}>pts</span></p>
        </div>
      </div>
      {nextTier&&<div style={{marginTop:18,position:"relative"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:500}}>{t("points.toReachTier",{pts:ptsToNext,tier:nextTier.label})} {Object.values(TIERS).find(t=>t.min===ti.next)?.icon}</span>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontVariantNumeric:"tabular-nums"}}>{Math.round(progressPct)}%</span>
        </div>
        <div style={{height:8,background:"rgba(255,255,255,0.06)",borderRadius:999,overflow:"hidden",border:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{width:`${progressPct}%`,height:"100%",background:ti.gradient,borderRadius:999,boxShadow:ti.glow,transition:"width 400ms ease-out"}}/>
        </div>
      </div>}
      {!nextTier&&<p style={{marginTop:16,fontSize:12,color:ti.light,fontWeight:600,letterSpacing:"0.04em"}}>{t("points.maxTier")}</p>}
    </div>

    {/* Vouchers de tier pendientes */}
    {pendingVouchers.length>0&&<div style={{marginBottom:24,padding:"16px 20px",background:"rgba(184,149,106,0.05)",border:"1px solid rgba(184,149,106,0.22)",borderRadius:14}}>
      <p style={{fontSize:11,fontWeight:700,color:GOLD_LIGHT,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.1em"}}>★ {t("points.tierVouchers")}</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>{pendingVouchers.map(v=>{const vti=getTierInfo(v.tier);return <div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"10px 12px",background:"rgba(255,255,255,0.02)",borderRadius:10,border:`1px solid ${vti.color}40`}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>{vti.icon}</span><div><p style={{fontSize:13,fontWeight:700,color:"#fff",margin:0}}>{t("points.tierDiscount",{tier:vti.label})}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"2px 0 0"}}>{t("points.autoApplied")}</p></div></div><span style={{fontSize:16,fontWeight:800,color:vti.light,fontVariantNumeric:"tabular-nums"}}>USD {Number(v.discount_usd).toFixed(0)}</span></div>;})}</div>
    </div>}

    {/* Balance hero + secundarios */}
    <div style={{display:"grid",gridTemplateColumns:expiringSoon.length>0?"2fr 1fr 1fr":"2fr 1fr",gap:14,marginBottom:28}}>
      <div style={{background:"linear-gradient(135deg, rgba(184,149,106,0.14) 0%, rgba(232,208,152,0.05) 100%)",border:`1px solid ${GOLD_DEEP}`,borderRadius:16,padding:"24px 28px",position:"relative",overflow:"hidden",boxShadow:GOLD_GLOW}}>
        <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,background:"radial-gradient(circle, rgba(232,208,152,0.22) 0%, transparent 70%)",pointerEvents:"none"}}/>
        <p style={{fontSize:10,fontWeight:700,color:GOLD_LIGHT,margin:0,textTransform:"uppercase",letterSpacing:"0.14em",position:"relative"}}>★ {t("points.balanceCurrent")}</p>
        <p style={{fontSize:48,fontWeight:800,color:"#fff",margin:"8px 0 0",lineHeight:1,letterSpacing:"-0.03em",fontVariantNumeric:"tabular-nums",position:"relative"}}>{balance.toLocaleString("es-AR")} <span style={{fontSize:16,fontWeight:600,color:GOLD_LIGHT,letterSpacing:"0.04em"}}>pts</span></p>
      </div>
      <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"24px 22px"}}>
        <p style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.5)",margin:0,textTransform:"uppercase",letterSpacing:"0.1em"}}>{t("points.pendingRedeems")}</p>
        <p style={{fontSize:32,fontWeight:700,color:"#fff",margin:"8px 0 0",lineHeight:1,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{pending.length}</p>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"6px 0 0"}}>{pending.length===0?"—":t("points.appliesNextOp")}</p>
      </div>
      {expiringSoon.length>0&&<div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.22)",borderRadius:16,padding:"24px 22px"}}>
        <p style={{fontSize:10,fontWeight:600,color:"rgba(239,68,68,0.85)",margin:0,textTransform:"uppercase",letterSpacing:"0.1em"}}>{t("points.expireIn30")}</p>
        <p style={{fontSize:32,fontWeight:700,color:"#ef4444",margin:"8px 0 0",lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{expiringSoon.reduce((s,e)=>s+e.amount,0)}</p>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"6px 0 0"}}>{t("points.redeemBefore")}</p>
      </div>}
    </div>

    {/* Canjes pendientes */}
    {pending.length>0&&<div style={{marginBottom:28}}>
      <h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.1em"}}>{t("points.yourPending")}</h3>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>{pending.map(p=><div key={p.id} style={{background:"rgba(184,149,106,0.05)",border:"1px solid rgba(184,149,106,0.18)",borderRadius:12,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div><p style={{fontSize:13.5,fontWeight:700,color:"#fff",margin:0}}>{p.reward_name}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"3px 0 0"}}>Canjeado {fmtDate(p.redeemed_at)} · {p.points_spent} pts · Expira {fmtDate(p.expires_at)}</p></div>
        <span style={{fontSize:9.5,fontWeight:700,padding:"4px 10px",borderRadius:999,background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.1em",border:`1px solid ${GOLD_DEEP}`,textTransform:"uppercase"}}>Pendiente</span>
      </div>)}</div>
    </div>}

    {/* Catálogo */}
    <h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.1em"}}>{t("points.catalog")}</h3>
    {loading?<p style={{color:"rgba(255,255,255,0.4)",padding:"2rem 0",textAlign:"center"}}>{t("common.loading")}</p>:
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14,marginBottom:28}}>{catalog.map(r=>{
      const canRedeem=balance>=r.points_cost;
      return <div key={r.id} style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${canRedeem?"rgba(184,149,106,0.28)":"rgba(255,255,255,0.06)"}`,borderRadius:16,padding:"20px 22px",display:"flex",flexDirection:"column",gap:12,opacity:canRedeem?1:0.55,transition:"all 180ms",position:"relative",overflow:"hidden"}} onMouseEnter={e=>{if(canRedeem){e.currentTarget.style.borderColor="rgba(184,149,106,0.5)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=GOLD_GLOW;}}} onMouseLeave={e=>{if(canRedeem){e.currentTarget.style.borderColor="rgba(184,149,106,0.28)";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}><span style={{fontSize:32,lineHeight:1}}>{r.icon||"🎁"}</span><span style={{fontSize:11,fontWeight:800,color:GOLD_LIGHT,padding:"4px 10px",background:"rgba(184,149,106,0.1)",border:"1px solid rgba(184,149,106,0.25)",borderRadius:999,letterSpacing:"0.04em",fontVariantNumeric:"tabular-nums"}}>{r.points_cost} pts</span></div>
        <div><p style={{fontSize:15,fontWeight:700,color:"#fff",margin:"0 0 4px",letterSpacing:"-0.01em"}}>{r.name}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:0,lineHeight:1.5}}>{r.description}</p></div>
        <button disabled={!canRedeem||busy===r.id} onClick={()=>redeem(r)} style={{marginTop:"auto",padding:"10px 16px",fontSize:12,fontWeight:700,borderRadius:10,cursor:canRedeem?"pointer":"not-allowed",background:canRedeem?GOLD_GRADIENT:"rgba(255,255,255,0.04)",color:canRedeem?"#0A1628":"rgba(255,255,255,0.4)",border:canRedeem?`1px solid ${GOLD_DEEP}`:"1px solid rgba(255,255,255,0.06)",boxShadow:canRedeem?GOLD_GLOW:"none",letterSpacing:"0.02em",transition:"all 150ms"}}>{busy===r.id?t("points.redeeming"):canRedeem?`${t("points.redeemBtn")} →`:t("points.notEnough",{n:r.points_cost-balance})}</button>
      </div>;})}</div>}

    {/* Historial */}
    <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"24px 0 10px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{t("points.history")}</h3>
    {txs.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"2rem 0"}}>{t("points.noTx")}</p>:
    <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden"}}>{txs.map((tr,i)=><div key={tr.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:i<txs.length-1?"1px solid rgba(255,255,255,0.04)":"none",gap:12,flexWrap:"wrap"}}>
      <div><p style={{fontSize:12,fontWeight:700,color:txColor[tr.type]||"#fff",margin:0}}>{txLabel[tr.type]||tr.type}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"2px 0 0"}}>{tr.description||"—"}{tr.expires_at&&tr.type==="earn"?` · ${t("points.expiresOn",{date:fmtDate(tr.expires_at)})}`:""}</p></div>
      <div style={{textAlign:"right"}}><p style={{fontSize:14,fontWeight:800,color:tr.amount>0?"#22c55e":"#ef4444",margin:0}}>{tr.amount>0?"+":""}{tr.amount} pts</p><p style={{fontSize:10,color:"rgba(255,255,255,0.35)",margin:"2px 0 0"}}>{fmtDateTime(tr.created_at)}</p></div>
    </div>)}</div>}

    <p style={{fontSize:11,color:"rgba(255,255,255,0.35)",margin:"16px 0 0",textAlign:"center",fontStyle:"italic"}}>{t("points.howEarn")}</p>
  </div>;
}

function ServicesPage({client}){
  const {t}=useT();
  const code=client?.client_code||"";const name=client?`${client.first_name}`:"";
  const services=[
    {icon:["M12 1v22","M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],title:t("svc.payments.t"),desc:t("svc.payments.d"),cta:t("svc.payments.cta"),color:"#22c55e",tag:t("svc.popular")},
    {icon:["M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"],title:t("svc.suppliers.t"),desc:t("svc.suppliers.d"),cta:t("svc.suppliers.cta"),color:"#60a5fa",tag:null},
    {icon:["M9 11l3 3L22 4","M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],title:t("svc.inspect.t"),desc:t("svc.inspect.d"),cta:t("svc.inspect.cta"),color:"#a78bfa",tag:null},
    {icon:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"],title:t("svc.consol.t"),desc:t("svc.consol.d"),cta:t("svc.consol.cta"),color:"#fb923c",tag:null},
    {icon:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"],title:t("svc.advice.t"),desc:t("svc.advice.d"),cta:t("svc.advice.cta"),color:"#f97316",tag:null},
    {icon:["M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z","M7 7h.01"],title:t("svc.insurance.t"),desc:t("svc.insurance.d"),cta:t("svc.insurance.cta"),color:"#ef4444",tag:null}
  ];
  const makeWA=(svc)=>encodeURIComponent(`Hola Bautista! Soy ${name} (${code}).\n\n${svc.cta}.\n\n${svc.title}\n\nGracias!`);
  return <div>
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 6px",letterSpacing:"-0.02em"}}>{t("svc.title")}</h2>
      <p style={{fontSize:14,color:"rgba(255,255,255,0.4)",margin:0}}>{t("svc.subtitle")}</p>
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
function AccountPage({token,client,onRestartTutorial}){
  const {t}=useT();
  const [timeline,setTimeline]=useState([]);
  const [balance,setBalance]=useState(Number(client?.account_balance_usd||0));
  const [pendingOps,setPendingOps]=useState([]);
  const [loading,setLoading]=useState(true);
  const MOV_LABELS={overpayment:t("acc.movOverpayment"),applied:t("acc.movApplied"),adjustment:t("acc.movAdjustment"),refund:t("acc.movRefund"),debt:t("acc.movDebt"),op_cobro:t("acc.movOpCobro"),op_anticipo:t("acc.movOpAnticipo"),gpi_cobro:t("acc.movGpiCobro")};
  const MOV_COLORS={overpayment:"#22c55e",applied:GOLD_LIGHT,adjustment:"#a78bfa",refund:"#60a5fa",debt:"#ef4444",op_cobro:"#22c55e",op_anticipo:"#60a5fa",gpi_cobro:"#10b981"};
  useEffect(()=>{if(!client?.id){setLoading(false);return;}(async()=>{
    const[m,cl,ops,pm,pg,giOps,giItems,giCliPmts,entregadaOps,entregadaCliPmts,entregadaPmtMgmt]=await Promise.all([
      dq("client_account_movements",{token,filters:`?client_id=eq.${client.id}&select=*,operations(operation_code)&order=created_at.desc`}),
      dq("clients",{token,filters:`?id=eq.${client.id}&select=account_balance_usd`}),
      dq("operations",{token,filters:`?client_id=eq.${client.id}&is_collected=eq.true&select=id,operation_code,collected_amount,collection_currency,collection_exchange_rate,collection_date,closed_at`}),
      dq("operation_client_payments",{token,filters:`?select=*,operations!inner(operation_code,client_id)&operations.client_id=eq.${client.id}&order=payment_date.desc`}),
      dq("payment_management",{token,filters:`?select=*,operations!inner(operation_code,client_id)&operations.client_id=eq.${client.id}&client_paid=eq.true&order=client_paid_at.desc`}),
      // Ops GI activas (no cerradas/canceladas) del cliente
      dq("operations",{token,filters:`?client_id=eq.${client.id}&service_type=eq.gestion_integral&status=not.in.(operacion_cerrada,cancelada)&select=id,operation_code,description,eta,status,is_collected,channel,service_type&order=created_at.desc`}),
      dq("operation_items",{token,filters:`?select=operation_id,quantity,unit_price_usd,operations!inner(client_id,service_type,status)&operations.client_id=eq.${client.id}&operations.service_type=eq.gestion_integral&operations.status=not.in.(operacion_cerrada,cancelada)`}),
      dq("operation_client_payments",{token,filters:`?select=operation_id,amount_usd,operations!inner(client_id,service_type,status)&operations.client_id=eq.${client.id}&operations.service_type=eq.gestion_integral&operations.status=not.in.(operacion_cerrada,cancelada)`}),
      // Ops NO-GI con status="entregada" (lista para retirar) y aún no marcadas como cobradas → saldo pendiente
      dq("operations",{token,filters:`?client_id=eq.${client.id}&status=eq.entregada&service_type=neq.gestion_integral&is_collected=eq.false&select=id,operation_code,description,eta,status,channel,service_type,budget_total,total_anticipos,collected_amount,collection_currency,collection_exchange_rate&order=created_at.desc`}),
      // Cobros del cliente para esas ops entregada
      dq("operation_client_payments",{token,filters:`?select=operation_id,amount_usd,operations!inner(client_id,status,service_type,is_collected)&operations.client_id=eq.${client.id}&operations.status=eq.entregada&operations.service_type=neq.gestion_integral&operations.is_collected=eq.false`}),
      // Gestión de pagos (client_amount_usd) para esas ops entregada — se suma al total a abonar
      dq("payment_management",{token,filters:`?select=operation_id,client_amount_usd,operations!inner(client_id,status,service_type,is_collected)&operations.client_id=eq.${client.id}&operations.status=eq.entregada&operations.service_type=neq.gestion_integral&operations.is_collected=eq.false`})
    ]);
    const movs=Array.isArray(m)?m:[];
    const opsList=Array.isArray(ops)?ops:[];
    const pmts=Array.isArray(pm)?pm:[];
    const gpi=Array.isArray(pg)?pg:[];
    const giOpsList=Array.isArray(giOps)?giOps:[];
    const giItemsList=Array.isArray(giItems)?giItems:[];
    const giCliPmtsList=Array.isArray(giCliPmts)?giCliPmts:[];
    const entregadaOpsList=Array.isArray(entregadaOps)?entregadaOps:[];
    const entregadaCliPmtsList=Array.isArray(entregadaCliPmts)?entregadaCliPmts:[];
    const entregadaPmtMgmtList=Array.isArray(entregadaPmtMgmt)?entregadaPmtMgmt:[];
    // Pendientes GI: total acordado = sum(items×qty), cobrado = sum(cli_payments), saldo = diff
    const pendingGi=giOpsList.map(o=>{
      const it=giItemsList.filter(i=>i.operation_id===o.id);
      const total=it.reduce((s,i)=>s+Number(i.unit_price_usd||0)*Number(i.quantity||1),0);
      const cp=giCliPmtsList.filter(p=>p.operation_id===o.id);
      const cobrado=cp.reduce((s,p)=>s+Number(p.amount_usd||0),0);
      const saldo=Math.max(0,total-cobrado);
      return {id:o.id,code:o.operation_code,desc:o.description||"",eta:o.eta,status:o.status,channel:o.channel,isGI:true,total,cobrado,saldo,pct:total>0?Math.min(100,(cobrado/total)*100):0};
    }).filter(x=>x.saldo>0.01);
    // Pendientes entregada (no-GI): total = budget + pmtMgmt pendiente − anticipos, cobrado = operation_client_payments
    const pendingEntregada=entregadaOpsList.map(o=>{
      const bt=Number(o.budget_total||0);
      const cp=entregadaCliPmtsList.filter(p=>p.operation_id===o.id);
      const cobrado=cp.reduce((s,p)=>s+Number(p.amount_usd||0),0);
      const pms=entregadaPmtMgmtList.filter(p=>p.operation_id===o.id);
      const pmtTot=pms.reduce((s,p)=>s+Number(p.client_amount_usd||0),0);
      const ant=Number(o.total_anticipos||0);
      const total=bt+Math.max(0,pmtTot-ant);
      const saldo=Math.max(0,total-cobrado);
      return {id:o.id,code:o.operation_code,desc:o.description||"",eta:o.eta,status:o.status,channel:o.channel,isGI:false,total,cobrado,saldo,pct:total>0?Math.min(100,(cobrado/total)*100):0};
    }).filter(x=>x.saldo>0.01);
    // Merge: GI primero, después entregada no-GI
    setPendingOps([...pendingGi,...pendingEntregada]);
    const merged=[
      ...movs.map(x=>({id:"m_"+x.id,date:x.created_at,type:x.type,amount:Number(x.amount_usd),op_code:x.operations?.operation_code,description:x.description})),
      ...opsList.filter(o=>Number(o.collected_amount||0)>0).map(o=>{const raw=Number(o.collected_amount||0);const isArs=o.collection_currency==="ARS";const rate=Number(o.collection_exchange_rate||0);const usd=isArs&&rate>0?raw/rate:raw;return{id:"o_"+o.id,date:o.collection_date||o.closed_at,type:"op_cobro",amount:usd,op_code:o.operation_code,description:isArs?`Pago ARS ${raw.toLocaleString("es-AR")} @ ${rate}`:"Pago recibido"};}),
      ...pmts.map(p=>({id:"p_"+p.id,date:p.payment_date,type:"op_anticipo",amount:Number(p.amount_usd||0),op_code:p.operations?.operation_code,description:p.notes||`Anticipo (${p.payment_method||"pago"})`})),
      ...gpi.map(g=>{const amt=Number(g.client_paid_amount_usd??g.client_amount_usd??0);return{id:"g_"+g.id,date:g.client_paid_at||g.created_at,type:"gpi_cobro",amount:amt,op_code:g.operations?.operation_code,description:`Pago de gestión internacional${g.proveedor_name?` · ${g.proveedor_name}`:""}`};})
    ].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
    setTimeline(merged);
    if(Array.isArray(cl)&&cl[0])setBalance(Number(cl[0].account_balance_usd||0));
    setLoading(false);
  })();},[client?.id,token]);
  const fmtDate=d=>{try{return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}catch{return d;}};
  const isCredit=balance>0;const isDebt=balance<0;
  return <div>
    <div style={{marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
      <div>
        <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:0,letterSpacing:"-0.02em"}}>{t("acc.title")}</h2>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"4px 0 0",lineHeight:1.5}}>{t("acc.subtitle")}</p>
      </div>
      {onRestartTutorial&&<button onClick={onRestartTutorial} style={{padding:"8px 14px",fontSize:12,fontWeight:600,borderRadius:10,border:"1px solid rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.08)",color:GOLD_LIGHT,cursor:"pointer",letterSpacing:"0.03em",display:"inline-flex",alignItems:"center",gap:6}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(184,149,106,0.15)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(184,149,106,0.08)";}}>🎓 {t("acc.tutorialAgain")}</button>}
    </div>
    {/* Hero balance */}
    <div style={{padding:"26px 30px",background:isCredit?"linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(255,255,255,0.02) 100%)":isDebt?"linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(255,255,255,0.02) 100%)":"rgba(255,255,255,0.025)",border:`1px solid ${isCredit?"rgba(34,197,94,0.4)":isDebt?"rgba(239,68,68,0.4)":"rgba(255,255,255,0.08)"}`,borderRadius:16,marginBottom:22,boxShadow:isCredit?"0 0 28px rgba(34,197,94,0.15)":isDebt?"0 0 28px rgba(239,68,68,0.15)":"none",position:"relative",overflow:"hidden"}}>
      {(isCredit||isDebt)&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:isCredit?"linear-gradient(90deg, #22c55e, #10b981)":"linear-gradient(90deg, #ef4444, #dc2626)"}}/>}
      <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.14em"}}>{isCredit?t("acc.creditBal"):isDebt?t("acc.pendingBal"):t("acc.balanceLbl")}</p>
      <p style={{fontSize:44,fontWeight:800,color:isCredit?"#22c55e":isDebt?"#ef4444":"#fff",margin:0,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.03em",lineHeight:1}}>{isCredit?"+":""}USD {balance.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
      {isCredit&&<p style={{fontSize:13,color:"rgba(255,255,255,0.6)",margin:"10px 0 0",lineHeight:1.5}}>{t("acc.creditNote")}</p>}
      {isDebt&&<p style={{fontSize:13,color:"rgba(255,255,255,0.6)",margin:"10px 0 0",lineHeight:1.5}}>{t("acc.debtNote")}</p>}
      {!isCredit&&!isDebt&&<p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"10px 0 0"}}>{t("acc.noPending")}</p>}
    </div>
    {/* Pendientes de pago (ops GI activas + ops entregadas con saldo) */}
    {pendingOps.length>0&&<div style={{marginBottom:24}}>
      <h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.1em"}}>{t("acc.pendingPayments")}</h3>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {pendingOps.map(p=>{const isEntregada=p.status==="entregada";return <div key={p.id} style={{background:"linear-gradient(135deg, rgba(251,146,60,0.08) 0%, rgba(255,255,255,0.02) 100%)",border:"1px solid rgba(251,146,60,0.25)",borderRadius:14,padding:"18px 22px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap",marginBottom:14}}>
            <div style={{flex:1,minWidth:220}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
                <span style={{fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:999,background:"rgba(251,146,60,0.15)",color:"#fb923c",border:"1px solid rgba(251,146,60,0.4)",letterSpacing:"0.08em",textTransform:"uppercase"}}>{isEntregada?t("acc.readyForPickup"):t("acc.pendingPay")}</span>
                {p.isGI&&<span style={{fontSize:9.5,fontWeight:800,padding:"3px 9px",borderRadius:6,background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.08em",textTransform:"uppercase",border:`1px solid ${GOLD_DEEP}`}}>{t("acc.gi")}</span>}
                <span style={{fontSize:12,fontFamily:"'JetBrains Mono','SF Mono',monospace",fontWeight:700,color:GOLD_LIGHT,letterSpacing:"0.04em"}}>{p.code}</span>
              </div>
              {p.desc&&<p style={{fontSize:14,fontWeight:600,color:"#fff",margin:"0 0 4px",letterSpacing:"-0.01em"}}>{p.desc}</p>}
              {isEntregada?<p style={{fontSize:11,color:"#22c55e",margin:0,fontWeight:600}}>✓ {t("acc.availableForPickup")}</p>:p.eta?<p style={{fontSize:11,color:"rgba(255,255,255,0.55)",margin:0}}>{t("acc.estDelivery")} · <span style={{color:"#fff",fontWeight:600}}>{fmtDate(p.eta)}</span></p>:null}
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.08em"}}>{t("acc.balanceDue")}</p>
              <p style={{fontSize:22,fontWeight:800,color:"#fb923c",margin:0,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>USD {p.saldo.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{marginBottom:8}}>
            <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
              <div style={{width:`${p.pct}%`,height:"100%",background:p.pct>=50?"#60a5fa":"#fb923c",transition:"width 0.3s"}}/>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(255,255,255,0.55)"}}>
            <span dangerouslySetInnerHTML={{__html:t("acc.youPaid",{paid:`<b style="color:#22c55e">USD ${p.cobrado.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</b>`,total:`USD ${p.total.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`})}}/>
            <span style={{fontWeight:700}}>{p.pct.toFixed(0)}%</span>
          </div>
        </div>;})}
      </div>
      <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"12px 0 0",fontStyle:"italic"}}>{t("acc.balanceUpdates")}</p>
    </div>}

    {/* Historial */}
    <h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.55)",margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.1em"}}>{t("acc.history")}</h3>
    {loading?<SkeletonTable rows={4} cols={3} hideHeader/>:timeline.length===0?
      <EmptyState icon="document" title={t("acc.emptyTitle")} description={t("acc.emptyDesc")}/>
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
        <span style={{fontSize:16,fontWeight:800,color:isPos?"#22c55e":"#ef4444",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em",whiteSpace:"nowrap"}}>{isPos?"+":""}USD {Math.abs(amt).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>;})}
    </div>}
  </div>;
}
function InternationalPaymentsPage({client,token}){
  // Gestiones de pago del cliente (AGP). La calculadora sigue siendo lo primero, pero abajo ve el
  // historial de los giros que le gestionamos, con lo que pago y el estado de cada uno.
  const [misAgp,setMisAgp]=useState([]);
  useEffect(()=>{(async()=>{
    if(!token||!client?.id)return;
    const r=await dq("payment_management",{token,filters:`?client_id=eq.${client.id}&select=agp_code,date,description,client_amount_usd,client_paid,client_paid_amount_usd,client_paid_date,giro_status,operations(operation_code)&order=date.desc,created_at.desc`}).catch(()=>[]);
    setMisAgp(Array.isArray(r)?r:[]);
  })();},[token,client?.id]);
  const {t}=useT();
  // WhatsApp de Argencargo para derivar pagos internacionales
  const WA_PHONE="5491125088580";
  const [origin,setOrigin]=useState("");      // "china" | "usa"
  const [amountStr,setAmountStr]=useState("");
  const [method,setMethod]=useState("");      // "cash" | "transfer"
  const bankInfo="";   // el paso de datos bancarios se sacó: el cliente los manda por WhatsApp
  const onAmount=v=>{if(v===""||/^\d*\.?\d*$/.test(v))setAmountStr(v);};
  const amount=Number(amountStr)||0;
  // Tarifas
  const pctArgencargo=0.0225;                  // 2,25% (bajó de 3,25% el 12/09/2026)
  const FIXED_USD=100;                         // cargo fijo por operación, igual para China y USA
  const fixedUsd=origin?FIXED_USD:0;
  const commission=amount*pctArgencargo;
  const pctTransfer=method==="transfer"?0.025:0; // recargo 2.5% si paga por transferencia
  const transferSurcharge=(amount+commission+fixedUsd)*pctTransfer;
  const total=amount+commission+fixedUsd+transferSurcharge;
  const canAdvance=origin&&amount>0&&method;
  const resetAll=()=>{setOrigin("");setAmountStr("");setMethod("");};

  const canSend=canAdvance; // Datos bancarios son opcionales — el cliente puede mandar la foto por WA

  const originLabel=origin==="usa"?"Estados Unidos 🇺🇸":origin==="china"?"China 🇨🇳":"";
  const methodLabel=method==="cash"?t("pay.cashNoFee"):method==="transfer"?"Transferencia (+2,5%)":"";
  const wireLabel=origin==="usa"?"Transferencia WIRE":origin==="china"?"Transferencia SWIFT":"";

  const buildWAMessage=()=>{
    const fmt=n=>n.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
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
      `• ${wireLabel} (${(pctArgencargo*100).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}%): USD ${fmt(commission)}`,
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

  // Paleta local del rediseño (12/09/2026): celeste para etiquetas, dorado solo para importes.
  const SKYP="#8CC8F5";
  const HAIRP="1px solid rgba(255,255,255,0.13)";
  const PANELP={background:"linear-gradient(180deg, rgba(13,24,45,0.96), rgba(8,16,32,0.96))",border:HAIRP,borderRadius:18,padding:"24px 26px",boxShadow:"0 16px 40px rgba(0,0,0,0.3)"};
  const LBLP={fontSize:13,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:SKYP,margin:0,textAlign:"center",lineHeight:1.35};
  const usdP=n=>n.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const CARD_H=74;
  const waHref=`https://wa.me/${WA_PHONE}?text=${buildWAMessage()}`;

  return <div>
    <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 22px",letterSpacing:"0.14em",textTransform:"uppercase",textAlign:"center"}}>{t("pay.title")}</h2>

    <div style={PANELP}>
      {/* Pasos 1 y 2, uno al lado del otro */}
      <div className="pay-top" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
        <div>
          <p style={LBLP}>{t("pay.step1")}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:11}}>
            {[{k:"china",flag:"🇨🇳",label:t("origin.china"),via:"SWIFT"},{k:"usa",flag:"🇺🇸",label:t("origin.usa"),via:"WIRE"}].map(o=>{const active=origin===o.k;
              return <div key={o.k} onClick={()=>setOrigin(o.k)} style={{height:CARD_H,boxSizing:"border-box",padding:"0 12px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,borderRadius:13,cursor:"pointer",border:`1px solid ${active?"rgba(232,208,152,0.7)":"rgba(255,255,255,0.16)"}`,background:active?"rgba(184,149,106,0.14)":"rgba(255,255,255,0.05)",boxShadow:active?GOLD_GLOW:"none",transition:"border-color 160ms"}}>
                <span style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                  <span style={{fontSize:19,lineHeight:1,flexShrink:0}}>{o.flag}</span>
                  <span style={{fontSize:13,fontWeight:900,color:"#fff",letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.label}</span>
                </span>
                <span style={{fontSize:10.5,fontWeight:700,color:active?GOLD_LIGHT:SKYP,whiteSpace:"nowrap"}}>{o.via} · {(pctArgencargo*100).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}% + USD {FIXED_USD}</span>
              </div>;})}
          </div>
        </div>
        <div>
          <p style={LBLP}>{t("pay.step2")}</p>
          <div style={{height:CARD_H,boxSizing:"border-box",marginTop:11,display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"0 18px",background:"rgba(255,255,255,0.05)",border:HAIRP,borderRadius:13}}>
            <span style={{fontSize:12.5,fontWeight:800,color:GOLD_LIGHT,letterSpacing:"0.1em",flexShrink:0}}>USD</span>
            <input type="text" inputMode="decimal" value={amountStr} onChange={e=>onAmount(e.target.value)} placeholder="0,00" style={{width:"100%",minWidth:0,background:"transparent",border:"none",outline:"none",color:"#fff",fontSize:26,fontWeight:900,fontVariantNumeric:"tabular-nums",padding:0,letterSpacing:"-0.02em",textAlign:"center"}}/>
          </div>
        </div>
      </div>

      {/* Paso 3 · a lo largo, no alto */}
      <p style={{...LBLP,marginTop:22}}>{t("pay.step3")}</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:11}}>
        {[{k:"cash",label:t("pay.cash"),sub:t("pay.cashSub"),icon:"💵"},{k:"transfer",label:t("pay.transfer"),sub:t("pay.transferSub"),icon:"🏦"}].map(o=>{const active=method===o.k;
          return <div key={o.k} onClick={()=>setMethod(o.k)} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"14px 16px",borderRadius:13,cursor:"pointer",border:`1px solid ${active?"rgba(232,208,152,0.7)":"rgba(255,255,255,0.16)"}`,background:active?"rgba(184,149,106,0.14)":"rgba(255,255,255,0.05)",boxShadow:active?GOLD_GLOW:"none"}}>
            <span style={{fontSize:18,lineHeight:1}}>{o.icon}</span>
            <span style={{fontSize:13.5,fontWeight:900,color:"#fff",letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{o.label}</span>
            <span style={{fontSize:11.5,fontWeight:700,color:active?GOLD_LIGHT:SKYP,whiteSpace:"nowrap"}}>· {o.sub}</span>
          </div>;})}
      </div>

      {/* Total + salida directa a WhatsApp */}
      {canAdvance
        ?<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:22,padding:"16px 22px",borderRadius:13,background:GOLD_GRADIENT,boxShadow:GOLD_GLOW}}>
            <span style={{fontSize:12,fontWeight:900,color:"#0A1628",textTransform:"uppercase",letterSpacing:"0.11em"}}>{t("pay.totalToArgencargo")}</span>
            <span style={{fontSize:29,fontWeight:900,color:"#0A1628",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em",whiteSpace:"nowrap"}}>USD {usdP(total)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:10,marginTop:16,flexWrap:"wrap"}}>
            <a href={waHref} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:9,padding:"14px 30px",fontSize:13.5,fontWeight:900,letterSpacing:"0.06em",textTransform:"uppercase",borderRadius:12,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",textDecoration:"none",boxShadow:"0 8px 26px rgba(37,211,102,0.3)"}}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 2.5 1 3 .8 3.6.8.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>
              {t("pay.advance")} →
            </a>
            <button onClick={resetAll} style={{padding:"14px 20px",fontSize:12.5,fontWeight:700,borderRadius:12,border:HAIRP,background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.6)",cursor:"pointer"}}>{t("pay.startOver")}</button>
          </div>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.5)",margin:"12px 0 0",textAlign:"center",lineHeight:1.5}}>{t("pay.waNote")}</p>
        </>
        :<p style={{fontSize:12.5,color:"rgba(255,255,255,0.45)",margin:"22px 0 0",textAlign:"center"}}>{!origin?t("pay.step1Sub"):amount<=0?t("pay.step2Sub"):t("pay.step3Sub")}</p>}
    </div>

    {/* Historial de gestiones de pago del cliente. La calculadora de arriba es para estimar; esto es
        lo que ya se le gestionó, con su código AGP. */}
    {misAgp.length>0&&<div style={{marginTop:36}}>
      <h3 style={{fontSize:17,fontWeight:800,color:"#fff",margin:"0 0 16px",letterSpacing:"0.12em",textTransform:"uppercase",textAlign:"center"}}>{t("pay.yourRequests")}</h3>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {misAgp.map((g,i)=>{
          const monto=Number(g.client_paid_amount_usd??g.client_amount_usd??0);
          const pagado=!!g.client_paid;
          const enviado=g.giro_status==="confirmado";
          const chipG=(txt,c,on)=><span style={{fontSize:10,fontWeight:800,letterSpacing:"0.05em",textTransform:"uppercase",padding:"4px 10px",borderRadius:999,whiteSpace:"nowrap",color:on?c:"rgba(255,255,255,0.45)",background:on?`${c}1f`:"rgba(255,255,255,0.06)",border:`1px solid ${on?`${c}59`:"rgba(255,255,255,0.12)"}`}}>{txt}</span>;
          return <div key={g.agp_code||i} style={{padding:"15px 18px",background:"linear-gradient(180deg, rgba(13,24,45,0.9), rgba(8,16,32,0.9))",border:HAIRP,borderRadius:14,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",boxShadow:"0 8px 22px rgba(0,0,0,0.2)"}}>
            <div style={{flex:1,minWidth:200}}>
              <p style={{fontSize:14,fontWeight:800,color:"#fff",margin:0,letterSpacing:"0.03em"}}>
                <span style={{fontFamily:"'JetBrains Mono','SF Mono',monospace",color:GOLD_LIGHT}}>{g.agp_code||"—"}</span>
                {g.description?<span style={{fontWeight:600,color:"rgba(255,255,255,0.8)"}}> · {g.description}</span>:null}
              </p>
              <p style={{fontSize:12,color:SKYP,margin:"5px 0 0",fontWeight:600}}>
                {g.date?formatDate(g.date):""}{g.operations?.operation_code?` · ${t("pay.forOp")} ${g.operations.operation_code}`:""}
              </p>
            </div>
            <span style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {chipG(pagado?"Pagado":t("op.paymentPending"),pagado?"#4ade80":"#fbbf24",true)}
              {chipG(enviado?"Girado":t("pay.inProgress"),"#4ade80",enviado)}
            </span>
            <span style={{fontSize:19,fontWeight:900,color:"#fff",whiteSpace:"nowrap",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.01em"}}><span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.6)",marginRight:5}}>USD</span>{monto.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>;
        })}
      </div>
    </div>}
  </div>;
}

function NotifBell({token}){
  const {t}=useT();
  const [open,setOpen]=useState(false);const [notifs,setNotifs]=useState([]);const [unread,setUnread]=useState(0);
  const load=async()=>{const r=await dq("notifications",{token,filters:"?select=*&order=created_at.desc&limit=20"});const list=Array.isArray(r)?r:[];setNotifs(list);setUnread(list.filter(n=>!n.read).length);};
  useEffect(()=>{load();const iv=setInterval(load,60000);return()=>clearInterval(iv);},[token]);
  const markRead=async(id)=>{await dq("notifications",{method:"PATCH",token,filters:`?id=eq.${id}`,body:{read:true}});setNotifs(p=>p.map(n=>n.id===id?{...n,read:true}:n));setUnread(p=>Math.max(0,p-1));};
  const markAllRead=async()=>{const ids=notifs.filter(n=>!n.read).map(n=>n.id);if(ids.length===0)return;await dq("notifications",{method:"PATCH",token,filters:`?id=in.(${ids.join(",")})`,body:{read:true}});setNotifs(p=>p.map(n=>({...n,read:true})));setUnread(0);};
  return <div style={{position:"relative"}}><button onClick={()=>setOpen(p=>!p)} style={{background:"none",border:"none",cursor:"pointer",padding:4,position:"relative"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>{unread>0&&<span style={{position:"absolute",top:0,right:0,width:16,height:16,borderRadius:"50%",background:"#ef4444",color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{unread}</span>}</button>
  {open&&<><div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setOpen(false)}/><div style={{position:"fixed",right:16,top:60,width:"min(340px, calc(100vw - 32px))",maxHeight:400,overflowY:"auto",background:"#142038",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.5)",zIndex:1000}}><div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:700,color:"#fff"}}>Notificaciones</span>{unread>0&&<button onClick={markAllRead} style={{fontSize:10,color:IC,background:"rgba(184,149,106,0.1)",border:"1px solid rgba(184,149,106,0.3)",borderRadius:5,padding:"3px 8px",cursor:"pointer",fontWeight:700}}>{t("notif.markAll")}</button>}</div>{notifs.length===0?<p style={{padding:"20px 16px",fontSize:13,color:"rgba(255,255,255,0.4)",textAlign:"center",margin:0}}>{t("notif.empty")}</p>:notifs.map(n=><div key={n.id} onClick={()=>!n.read&&markRead(n.id)} style={{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:n.read?"default":"pointer",background:n.read?"transparent":"rgba(184,149,106,0.06)"}}><p style={{fontSize:12,fontWeight:n.read?400:600,color:n.read?"rgba(255,255,255,0.5)":"#fff",margin:0}}>{n.title||t("notif.one")}</p>{n.body&&<p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"2px 0 0"}}>{n.body}</p>}<p style={{fontSize:10,color:"rgba(255,255,255,0.25)",margin:"4px 0 0"}}>{formatDate(n.created_at)}</p></div>)}</div></>}
  </div>;
}

function DashShell({children,page,setPage,role,client,user,onLogout,token}){
  const name=client?`${client.first_name} ${client.last_name}`:user?.email||"";const code=client?.client_code||"";const nav=CN;const [mobOpen,setMobOpen]=useState(false);
  const {t,lang,setLang}=useT();
  const sidebarContent=<>
    <div style={{padding:"24px 20px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"center",alignItems:"center",position:"relative"}}>
      <img src={LOGO} alt="AC" style={{width:"100%",height:"auto",maxHeight:50,objectFit:"contain"}}/>
      <button className="mob-close" onClick={()=>setMobOpen(false)} style={{display:"none",position:"absolute",right:16,top:16,background:"none",border:"none",color:"rgba(255,255,255,0.6)",fontSize:20,cursor:"pointer"}}>✕</button>
    </div>
    {code&&<div style={{padding:"16px 20px 4px"}}><span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.12em"}}>{t("common.client")}</span><p style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,margin:"3px 0 0",fontFamily:"'JetBrains Mono','SF Mono',monospace",letterSpacing:"0.06em"}}>{code}</p></div>}
    <nav style={{flex:1,padding:"6px 10px 14px",overflowY:"auto"}}>{CN_SECTIONS.map(sec=><div key={sec.section} style={{marginTop:14}}>
      <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.32)",margin:"0 0 6px",padding:"0 14px",textTransform:"uppercase",letterSpacing:"0.14em"}}>{t(sec.skey)}</p>
      {sec.items.map(item=>{const active=page===item.key;return <button key={item.key} onClick={()=>{setPage(item.key);setMobOpen(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:11,padding:"8px 14px",marginBottom:1,borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:active?700:500,letterSpacing:"-0.005em",background:active?"linear-gradient(90deg, rgba(184,149,106,0.10), rgba(184,149,106,0.02))":"transparent",color:active?"#fff":"rgba(255,255,255,0.55)",transition:"all 150ms",position:"relative"}} onMouseEnter={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.color="rgba(255,255,255,0.9)";}}} onMouseLeave={e=>{if(!active){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.55)";}}}>{active&&<span style={{position:"absolute",left:-10,top:6,bottom:6,width:3,background:GOLD_GRADIENT,borderRadius:"0 3px 3px 0"}}/>}<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={active?GOLD_LIGHT:"rgba(255,255,255,0.5)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,opacity:active?1:0.9}}>{item.p.map((d,i)=><path key={i} d={d}/>)}</svg><span style={{flex:1,textAlign:"left",lineHeight:1.25}}>{item.tkey?t(item.tkey):item.label}</span></button>;})}
    </div>)}</nav>
    <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.06)"}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg, rgba(184,149,106,0.2), rgba(184,149,106,0.08))",border:"1px solid rgba(184,149,106,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:GOLD_LIGHT,letterSpacing:"0.03em"}}>{(client?.first_name?.[0]||"U").toUpperCase()}{(client?.last_name?.[0]||"").toUpperCase()}</div><div style={{flex:1,minWidth:0}}><p style={{fontSize:12.5,fontWeight:600,color:"#fff",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</p><p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",margin:"1px 0 0",letterSpacing:"0.04em"}}>{t("common.client")}</p></div>{token&&<div className="desktop-notif-bell"><NotifBell token={token}/></div>}</div>
    <div style={{display:"flex",gap:4,marginBottom:10}}>{LANGS.map(L=><button key={L.code} onClick={()=>setLang(L.code)} title={L.label} style={{flex:1,padding:"5px 0",fontSize:14,background:lang===L.code?"rgba(184,149,106,0.18)":"rgba(255,255,255,0.03)",border:`1px solid ${lang===L.code?"rgba(184,149,106,0.35)":"rgba(255,255,255,0.06)"}`,borderRadius:6,cursor:"pointer",color:"#fff"}}>{L.flag}</button>)}</div>
    <button onClick={onLogout} style={{width:"100%",padding:"8px 10px",fontSize:11.5,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:600,letterSpacing:"0.04em",transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.35)";e.currentTarget.style.color=GOLD_LIGHT;}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(255,255,255,0.5)";}}>{t("common.logout")}</button>
    <a href="/terminos" target="_blank" rel="noopener" style={{display:"block",marginTop:8,fontSize:10,color:"rgba(255,255,255,0.3)",textDecoration:"none",textAlign:"center"}}>{t("common.terms")}</a></div>
  </>;
  return <div style={{minHeight:"100vh",fontFamily:"'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif",background:DARK_BG,position:"relative"}}><div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}><WorldMap/></div>
    <style>{`
      @keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.85;transform:scale(1.05);}}
      .pc-hint::placeholder{color:rgba(232,208,152,0.85);font-weight:700;letter-spacing:0.08em;font-family:Inter,sans-serif;font-size:11px}
      @media(max-width:768px){
        .sidebar-desktop{display:none!important}
        .mob-header{display:flex!important}
        .mob-close{display:block!important}
        .desktop-notif-bar{display:none!important}
        .main-content{margin-left:0!important;padding-top:60px!important;padding-bottom:74px!important;overflow-x:hidden!important}
        .main-inner{padding:16px!important;max-width:100vw!important;box-sizing:border-box!important}
        .ac-mob-bottom-nav{display:flex!important}
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
        .origin-picker{grid-template-columns:1fr!important}
        .pay-top{grid-template-columns:1fr!important;gap:18px!important}
        .dep-head{display:none!important}
        .dep-row{grid-template-columns:30px 1fr 1fr!important}
        .dep-track{grid-column:2/-1}
        .op-pk-head{display:none!important}
        .ol-head{display:none!important}
        .ol-row{grid-template-columns:1fr 1fr!important}
        .ol-desc{grid-column:1/-1}
        .ol-stage{grid-column:1/-1;text-align:left!important}
        .ol-stage>div{justify-content:flex-start!important}
        .ol-arrow{display:none}
        .op-pk-row{grid-template-columns:1fr 1fr!important}
        .op-pk-track{grid-column:1/-1}
        .pc-head,.pk-head{display:none!important}
        .pc-row{grid-template-columns:1fr 1fr!important}
        .pc-desc,.pc-tail-full{grid-column:1/-1!important}
        .pk-row{grid-template-columns:1fr 1fr 1fr!important}
        .pk-info,.pk-prod{grid-column:1/-1!important}
        .rs-head{flex-wrap:wrap!important}
        .batt-picker{grid-template-columns:1fr!important}
        .rs-head{flex-wrap:wrap!important;gap:10px!important}
        .rs-price{flex-basis:100%!important;order:3;padding-left:60px!important;font-size:20px!important}
        .rs-stats>div{flex-basis:100%!important;border-left:none!important;padding:6px 0!important}
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
    <div className="sidebar-desktop" style={{width:240,position:"fixed",top:0,left:0,bottom:0,background:"rgba(0,0,0,0.35)",backdropFilter:"blur(12px)",borderRight:"1px solid rgba(255,255,255,0.07)",display:"flex",flexDirection:"column",zIndex:10,overflow:"auto"}}>{sidebarContent}</div>
    <div className="main-content" style={{marginLeft:240,minHeight:"100vh",position:"relative",zIndex:1}}>
      {/* Bell flotante en lugar de sticky bar — alineado con el saludo del cabezal de cada página. */}
      <div className="main-inner" style={{maxWidth:1200,margin:"0 auto",padding:"30px 32px"}}>{children}</div></div>
    <WhatsAppFab message={`Hola Argencargo! 👋 Soy ${client?.first_name||""} ${client?.last_name||""}${client?.client_code?` (${client.client_code})`:""}, tengo una consulta.`}/>
    {/* Bottom nav mobile (≤768px) — 5 acciones más usadas. El resto via "más" → sidebar */}
    <nav className="ac-mob-bottom-nav" style={{display:"none",position:"fixed",bottom:0,left:0,right:0,zIndex:25,background:"rgba(10,22,40,0.95)",backdropFilter:"blur(18px)",borderTop:"1px solid rgba(255,255,255,0.08)",padding:"6px 8px 10px",justifyContent:"space-around"}}>
      {[
        {key:"imports",ic:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z","M3.27 6.96 12 12.01l8.73-5.05","M12 22.08V12"],l:t("nav.imports")},
        {key:"calculator",ic:["M4 4h16v16H4z","M4 8h16","M8 4v16"],l:t("nav.calculator")},
        {key:"quotes",ic:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8"],l:t("nav.quotes")},
        {key:"_more",ic:["M5 12h.01M12 12h.01M19 12h.01"],l:t("common.more"),isMore:true},
      ].map(it=>{const active=page===it.key;return <button key={it.key} onClick={()=>{if(it.isMore){setMobOpen(true);}else{setPage(it.key);}}} style={{flex:1,maxWidth:90,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 4px",background:"transparent",border:"none",color:active?GOLD_LIGHT:"rgba(255,255,255,0.55)",cursor:"pointer",borderRadius:8,transition:"color 150ms"}}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{it.ic.map((d,i)=><path key={i} d={d}/>)}</svg>
        <span style={{fontSize:10,fontWeight:active?700:500,letterSpacing:"0.02em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>{it.l}</span>
        {active&&<span style={{position:"absolute",top:0,width:24,height:2,background:GOLD_GRADIENT,borderRadius:"0 0 2px 2px"}}/>}
      </button>;})}
    </nav>
  </div>;
}
function ReferralsPage({token,client}){
  const {t}=useT();
  const [referrals,setReferrals]=useState([]);
  const [lo,setLo]=useState(true);
  const [copied,setCopied]=useState(false);
  const [movements,setMovements]=useState([]);
  useEffect(()=>{(async()=>{
    if(!client?.id){setLo(false);return;}
    const [refs,movs]=await Promise.all([
      dq("clients",{token,filters:`?referred_by_client_id=eq.${client.id}&select=client_code,first_name,last_name,referral_credited_at,created_at&order=created_at.desc`}),
      dq("client_account_movements",{token,filters:`?client_id=eq.${client.id}&description=ilike.*referido*&select=*&order=created_at.desc`}),
    ]);
    setReferrals(Array.isArray(refs)?refs:[]);
    setMovements(Array.isArray(movs)?movs:[]);
    setLo(false);
  })();},[client?.id,token]);
  const refLink=typeof window!=="undefined"?`${window.location.origin}/portal?ref=${client?.client_code||""}`:"";
  const totalGanado=movements.filter(m=>Number(m.amount_usd)>0).reduce((s,m)=>s+Number(m.amount_usd),0);
  const acreditados=referrals.filter(r=>r.referral_credited_at).length;
  const pendientes=referrals.length-acreditados;
  const copy=async()=>{try{await navigator.clipboard.writeText(refLink);setCopied(true);setTimeout(()=>setCopied(false),2500);}catch{prompt(t("ref.copyLink"),refLink);}};
  const shareWA=()=>{const msg=encodeURIComponent(`Hola! Te recomiendo Argencargo para importar desde China/USA/España. Si te registrás con mi link recibís USD 50 de descuento en tu primera importación 🚀\n\n${refLink}`);window.open(`https://wa.me/?text=${msg}`,"_blank");};
  return <div>
    <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 8px",letterSpacing:"-0.02em"}}>{t("ref.title")}</h2>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.55)",margin:"0 0 24px"}}>{t("ref.headerSub")}</p>

    {/* Cards de stats */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:24}}>
      <div style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:14,padding:"16px 20px"}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{t("ref.earned")}</p>
        <p style={{fontSize:24,fontWeight:800,color:"#22c55e",margin:0,fontVariantNumeric:"tabular-nums"}}>USD {totalGanado.toFixed(0)}</p>
      </div>
      <div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.25)",borderRadius:14,padding:"16px 20px"}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{t("ref.credited")}</p>
        <p style={{fontSize:24,fontWeight:800,color:GOLD_LIGHT,margin:0,fontVariantNumeric:"tabular-nums"}}>{acreditados}</p>
      </div>
      <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"16px 20px"}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{t("ref.pending")}</p>
        <p style={{fontSize:24,fontWeight:800,color:"rgba(255,255,255,0.7)",margin:0,fontVariantNumeric:"tabular-nums"}}>{pendientes}</p>
      </div>
    </div>

    {/* Link a compartir */}
    <div style={{background:"linear-gradient(135deg, rgba(184,149,106,0.12), rgba(212,177,122,0.06))",border:`1.5px solid rgba(184,149,106,0.4)`,borderRadius:16,padding:"22px 26px",marginBottom:24}}>
      <p style={{fontSize:11,fontWeight:700,color:GOLD_LIGHT,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:"0.08em"}}>🔗 {t("ref.yourLink")}</p>
      <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 12px"}}>{t("ref.shareIt")}</h3>
      <div style={{display:"flex",gap:8,alignItems:"center",padding:"10px 14px",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,marginBottom:14,flexWrap:"wrap"}}>
        <code style={{flex:1,minWidth:200,fontSize:12.5,color:"#fff",fontFamily:"'JetBrains Mono','SF Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{refLink}</code>
        <button onClick={copy} style={{padding:"7px 14px",fontSize:11,fontWeight:700,borderRadius:7,border:"none",cursor:"pointer",background:copied?"#22c55e":"linear-gradient(135deg,#B8956A,#D4B17A)",color:copied?"#fff":"#0A1628",whiteSpace:"nowrap",transition:"all 200ms"}}>{copied?`✓ ${t("ref.copied")}`:`📋 ${t("ref.copy")}`}</button>
      </div>
      <button onClick={shareWA} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:"#25D366",color:"#fff"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z"/></svg>
        {t("ref.shareWA")}
      </button>
    </div>

    {/* Cómo funciona */}
    <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"20px 24px",marginBottom:24}}>
      <h3 style={{fontSize:13,fontWeight:700,color:"#fff",margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{t("ref.howSteps")}</h3>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {[
          {n:1,t:t("ref.step1.t"),d:t("ref.step1.d")},
          {n:2,t:t("ref.step2.t"),d:t("ref.step2.d")},
          {n:3,t:t("ref.step3.t"),d:t("ref.step3.d")},
          {n:4,t:t("ref.step4.t"),d:t("ref.step4.d")},
        ].map(s=><div key={s.n} style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{flexShrink:0,width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#0A1628",fontSize:13}}>{s.n}</div>
          <div><p style={{fontSize:13,fontWeight:700,color:"#fff",margin:"0 0 2px"}}>{s.t}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.55)",margin:0,lineHeight:1.5}}>{s.d}</p></div>
        </div>)}
      </div>
    </div>

    {/* Lista de referidos */}
    <h3 style={{fontSize:13,fontWeight:700,color:"#fff",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{t("ref.myReferrals")} ({referrals.length})</h3>
    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>{t("common.loading")}</p>:referrals.length===0?<div style={{padding:"2rem",background:"rgba(255,255,255,0.02)",border:"1px dashed rgba(255,255,255,0.08)",borderRadius:12,textAlign:"center"}}><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>{t("ref.emptyShareNow")}</p></div>:<div style={{display:"flex",flexDirection:"column",gap:8}}>
      {referrals.map(r=>{const credited=!!r.referral_credited_at;return <div key={r.client_code} style={{padding:"12px 16px",background:credited?"rgba(34,197,94,0.06)":"rgba(255,255,255,0.025)",border:`1px solid ${credited?"rgba(34,197,94,0.25)":"rgba(255,255,255,0.06)"}`,borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:180}}>
          <p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"0 0 2px"}}>{r.first_name} {r.last_name||""} <span style={{color:GOLD_LIGHT,fontFamily:"monospace",fontSize:11,marginLeft:6}}>{r.client_code}</span></p>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:0}}>{t("ref.signedUp",{date:formatDate(r.created_at)})}{credited?` · ${t("ref.creditedOn",{date:formatDate(r.referral_credited_at)})}`:""}</p>
        </div>
        <span style={{fontSize:10,fontWeight:800,padding:"4px 10px",borderRadius:5,background:credited?"rgba(34,197,94,0.18)":"rgba(255,255,255,0.06)",color:credited?"#22c55e":"rgba(255,255,255,0.55)",letterSpacing:"0.05em"}}>{credited?"✓ +USD 50":`⏳ ${t("ref.firstOpPending")}`}</span>
      </div>;})}
    </div>}
  </div>;
}

// Sección t("mar.title"): cargas que ya están en un contenedor pero
// todavía no son operación. Solo lectura, sin precio. No muestra naviera ni N° de contenedor.
function MaritimeCargoSection({cargo}){
  const {t}=useT();
  const [openId,setOpenId]=useState(null); // card con el detalle de bultos desplegado
  if(!cargo||cargo.length===0)return null;
  const fmtD=(d)=>d?new Date(d+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}):"—";
  const statusChip=(c)=>c.container_status==="arribado"
    ?{l:t("mar.arrivedPort"),bg:"rgba(34,197,94,0.12)",fg:"#4ade80"}
    :{l:t("mar.inTransit"),bg:"rgba(96,165,250,0.12)",fg:"#60a5fa"};
  const cell=(label,val,col)=><div><p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</p><p style={{fontSize:14,fontWeight:700,color:col,margin:0,fontVariantNumeric:"tabular-nums"}}>{val}</p></div>;
  return <div style={{marginBottom:24}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
      <h2 style={{fontSize:15,fontWeight:800,color:"#fff",margin:0,letterSpacing:"-0.01em"}}>{t("mar.titleEmoji")}</h2>
      <span style={{fontSize:11,fontWeight:700,color:"#60a5fa",background:"rgba(96,165,250,0.12)",padding:"2px 9px",borderRadius:999}}>{cargo.length}</span>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {cargo.map(c=>{const st=statusChip(c);const descs=Array.isArray(c.descriptions)?c.descriptions:(c.description?[c.description]:[]);const multi=descs.length>1;return <div key={c.id} style={{background:"linear-gradient(135deg,rgba(96,165,250,0.06),rgba(255,255,255,0.02))",border:"1px solid rgba(96,165,250,0.18)",borderRadius:14,padding:"16px 18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:multi?10:12}}>
          <p style={{fontSize:14.5,fontWeight:700,color:"#fff",margin:0,flex:1,minWidth:0}}>{multi?`${descs.length} productos`:(descs[0]||t("ol.seaCargo"))}</p>
          <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:6,background:st.bg,color:st.fg,whiteSpace:"nowrap"}}>{st.l}</span>
        </div>
        {multi&&<ul style={{margin:"0 0 12px",padding:"0 0 0 2px",listStyle:"none",display:"flex",flexDirection:"column",gap:3}}>
          {descs.map((d,i)=><li key={i} style={{fontSize:12.5,color:"rgba(255,255,255,0.6)",display:"flex",gap:7}}><span style={{color:"#60a5fa"}}>·</span>{d}</li>)}
        </ul>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
          {cell("⚓ ETA Pto. Buenos Aires",fmtD(c.eta_puerto),c.transbordo?"#fb923c":"#93c5fd")}
          {cell("📦 Entrega estimada",fmtD(c.entrega_estimada),"#4ade80")}
          {cell("Bultos",String(c.bultos||0),"#fff")}
        </div>
        {c.total_estimado!=null&&<div style={{marginTop:12,padding:"11px 14px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.22)",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div>
            <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.6)",margin:0,textTransform:"uppercase",letterSpacing:"0.05em"}}>💵 Total a abonar (estimado)</p>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"2px 0 0"}}>{t("mar.subjectToConfirm")}</p>
          </div>
          <span style={{fontSize:19,fontWeight:800,color:"#4ade80",fontVariantNumeric:"tabular-nums"}}>USD {Number(c.total_estimado).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>}
        {Array.isArray(c.bultos_detalle)&&c.bultos_detalle.length>0&&<div style={{marginTop:12}}>
          <button onClick={()=>setOpenId(openId===c.id?null:c.id)} style={{width:"100%",padding:"9px 12px",fontSize:12,fontWeight:700,borderRadius:9,border:"1px solid rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.06)",color:"#93c5fd",cursor:"pointer",fontFamily:"inherit"}}>
            📦 {openId===c.id?t("mar.hidePkgs")+" ▲":t("mar.showPkgs")+" ▼"}
          </button>
          {openId===c.id&&<div style={{marginTop:8,background:"rgba(0,0,0,0.18)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"4px 12px"}}>
            {c.bultos_detalle.map((b,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"8px 0",borderBottom:i<c.bultos_detalle.length-1?"1px solid rgba(255,255,255,0.05)":"none",flexWrap:"wrap"}}>
              <div style={{minWidth:0}}>
                <p style={{fontSize:12.5,fontWeight:700,color:"#fff",margin:0}}>Bulto {b.n||i+1}{b.qty>1?` · ×${b.qty}`:""}{b.label?<span style={{fontWeight:500,color:"rgba(255,255,255,0.5)"}}> · {b.label}</span>:""}</p>
                {b.carga&&c.descriptions?.length>1&&<p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",margin:"1px 0 0"}}>{b.carga}</p>}
              </div>
              <div style={{textAlign:"right",whiteSpace:"nowrap"}}>
                <p style={{fontSize:12.5,fontWeight:700,color:"#93c5fd",margin:0,fontVariantNumeric:"tabular-nums"}}>{b.dims||"—"}</p>
                {b.cbm>0&&<p style={{fontSize:10.5,color:"rgba(255,255,255,0.45)",margin:"1px 0 0",fontVariantNumeric:"tabular-nums"}}>{b.cbm.toFixed(4)} m³</p>}
              </div>
            </div>)}
          </div>}
        </div>}
        {c.transbordo&&<div style={{marginTop:12,padding:"9px 12px",background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.25)",borderRadius:9,display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:16}}>🔄</span>
          <p style={{fontSize:12,color:"#fdba74",margin:0,lineHeight:1.45}}>{t("mar.transship1")} <b>transbordo en {c.transbordo.lugar}</b>{t("mar.transship2")} <b>{c.transbordo.dias} días</b>{t("mar.transship3")}</p>
        </div>}
      </div>;})}
    </div>
  </div>;
}

function Dashboard({profile,client,user,token,onLogout,onRestartTutorial}){
  const {t}=useT();
  const [page,setPage]=useState("imports");const [calcPreset,setCalcPreset]=useState(null);const [ops,setOps]=useState([]);const [itemsByOp,setItemsByOp]=useState({});const [pmtsByOp,setPmtsByOp]=useState({});const [cliPmtsByOp,setCliPmtsByOp]=useState({});const [selOp,setSelOp]=useState(null);const [lo,setLo]=useState(false);const [depPkgs,setDepPkgs]=useState([]);const [pendingVouchersCount,setPendingVouchersCount]=useState(0);const [mCargo,setMCargo]=useState([]);
  const loadOps=async()=>{setLo(true);
    // Filtro explícito por client_id: normalmente RLS lo hace solo para clientes logueados,
    // pero en admin preview mode el token es de admin (ve TODO) y necesitamos filtrar acá.
    const cId=client?.id;
    if(!cId){setLo(false);return;}
    // Cargas marítimas en camino (en contenedor, todavía sin operación) — vía endpoint con whitelist.
    fetch(`/api/portal/maritime-cargo?client_id=${cId}`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>setMCargo(Array.isArray(d?.cargo)?d.cargo:[])).catch(()=>setMCargo([]));
    dq("operation_packages",{token,filters:`?client_id=eq.${cId}&operation_id=is.null&select=*&order=created_at.asc`}).then(d=>setDepPkgs(Array.isArray(d)?d:[])).catch(()=>setDepPkgs([]));
    const [r,it,pm,cp,tv]=await Promise.all([
      dq("operations",{token,filters:`?client_id=eq.${cId}&select=*&order=created_at.desc`}),
      dq("operation_items",{token,filters:`?select=operation_id,operations!inner(client_id)&operations.client_id=eq.${cId}`}),
      dq("payment_management",{token,filters:`?select=operation_id,client_amount_usd,client_paid,operations!inner(client_id)&operations.client_id=eq.${cId}`}),
      dq("operation_client_payments",{token,filters:`?select=operation_id,amount_usd,operations!inner(client_id)&operations.client_id=eq.${cId}`}),
      dq("tier_rewards",{token,filters:`?client_id=eq.${cId}&status=eq.pending&select=id`})
    ]);
    const list=Array.isArray(r)?r:[];setOps(list);const m={};(Array.isArray(it)?it:[]).forEach(x=>{m[x.operation_id]=(m[x.operation_id]||0)+1;});setItemsByOp(m);const pmap={};(Array.isArray(pm)?pm:[]).forEach(p=>{if(p.client_paid)return;pmap[p.operation_id]=(pmap[p.operation_id]||0)+Number(p.client_amount_usd||0);});setPmtsByOp(pmap);const cmap={};(Array.isArray(cp)?cp:[]).forEach(p=>{cmap[p.operation_id]=(cmap[p.operation_id]||0)+Number(p.amount_usd||0);});setCliPmtsByOp(cmap);setPendingVouchersCount(Array.isArray(tv)?tv.length:0);setLo(false);
    // Deep-link: ?op=AC-XXXX → auto-open that operation
    if(typeof window!=="undefined"){const params=new URLSearchParams(window.location.search);const opCode=params.get("op");if(opCode){const found=list.find(o=>o.operation_code===opCode);if(found){setSelOp(found);setPage("imports");window.history.replaceState({},"",window.location.pathname);}}}
  };
  useEffect(()=>{if(page==="imports"||page==="deposito")loadOps();},[page]);
  useEffect(()=>{let last=Date.now();const onFocus=()=>{if(document.visibilityState==="visible"&&page==="imports"&&!selOp&&Date.now()-last>5000){last=Date.now();loadOps();}};document.addEventListener("visibilitychange",onFocus);window.addEventListener("focus",onFocus);return()=>{document.removeEventListener("visibilitychange",onFocus);window.removeEventListener("focus",onFocus);};},[page,selOp]);
  // Navegación inter-widget (ej. hero widget -> points)
  useEffect(()=>{const h=(e)=>{if(e?.detail){setPage(e.detail);setSelOp(null);}};if(typeof window!=="undefined")window.addEventListener("ac_nav",h);return()=>{if(typeof window!=="undefined")window.removeEventListener("ac_nav",h);};},[]);
  const clientWithCount={...client,_pending_vouchers_count:pendingVouchersCount};
  return <DashShell page={page} setPage={p=>{setPage(p);setSelOp(null);}} role="cliente" client={client} user={user} onLogout={onLogout} token={token}>
    {page==="imports"&&!selOp&&<><HolidayBanner/>{lo?<div style={{padding:"1rem 0"}}><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>{[0,1,2,3].map(i=><div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"20px 22px"}}><Skeleton w={80} h={10} style={{marginBottom:12}}/><Skeleton w={60} h={28}/></div>)}</div>{[0,1,2].map(i=><div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"1.5rem 1.75rem",marginBottom:14}}><div style={{display:"flex",gap:10,marginBottom:14}}><Skeleton w={100} h={14}/><Skeleton w={130} h={20} br={999}/></div><Skeleton w="50%" h={20} style={{marginBottom:16}}/><div style={{display:"flex",gap:12,marginBottom:14}}>{[0,1,2,3,4,5,6,7].map(j=><Skeleton key={j} w={38} h={38} br={999}/>)}</div><div style={{display:"flex",gap:28}}><Skeleton w={70} h={30}/><Skeleton w={80} h={30}/><Skeleton w={120} h={30}/></div></div>)}</div>:<OperationsList ops={ops} onSelect={setSelOp} client={clientWithCount} token={token} onReload={loadOps} itemsByOp={itemsByOp} pmtsByOp={pmtsByOp} cliPmtsByOp={cliPmtsByOp} mCargo={mCargo}/>}</>}
    {page==="imports"&&selOp&&<OperationDetail op={selOp} token={token} client={client} onBack={()=>{setSelOp(null);loadOps();}}/>}
    {page==="deposito"&&<>
      <h2 style={{fontSize:22,fontWeight:800,color:"#fff",margin:"0 0 22px",letterSpacing:"0.14em",textTransform:"uppercase",textAlign:"center"}}>{t("nav.deposito")}</h2>
      <DepositoView pkgs={depPkgs} token={token} client={client} onCreated={op=>{setOps(p=>[op,...p]);setDepPkgs([]);setPage("imports");setSelOp(op);loadOps();}}/>
    </>}
    {page==="profile"&&<ProfilePage client={client} token={token}/>}
    {page==="rates"&&<RatesPage token={token} client={client}/>}
    {page==="calculator"&&<CalculatorPage token={token} client={client} preset={calcPreset}/>}
    {page==="services"&&<ServicesPage client={client}/>}
    {page==="quotes"&&<QuotesPage token={token} client={client} onEdit={q=>{setCalcPreset({...q,_t:Date.now()});setPage("calculator");setSelOp(null);}} onOpenOp={op=>{setSelOp(op);setPage("imports");}}/>}
    {/* Puntos y Referidos desactivados (11/06/2026) — rutas removidas, componentes quedan como código muerto para reactivar. */}
    {page==="payments"&&<InternationalPaymentsPage client={client} token={token}/>}
    {page==="account"&&<AccountPage token={token} client={client} onRestartTutorial={onRestartTutorial}/>}
    {page==="support"&&<SupportPage token={token} client={client}/>}
    {!["imports","deposito","profile","rates","calculator","services","quotes","points","payments","account","support","referrals"].includes(page)&&<div style={{textAlign:"center",padding:"4rem 0"}}><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 8px",textTransform:"uppercase"}}>{page.replace("_"," ")}</h2><p style={{fontSize:14,color:"rgba(255,255,255,0.4)"}}>{t("common.inDevelopment")}</p></div>}
  </DashShell>;
}
// ═══════════════════════════════════════════════════════════════
// TUTORIAL ONBOARDING — se muestra la primera vez que entra un cliente
// nuevo (clients.tutorial_completed=false). Al terminar/skip, marca
// el flag en la DB para no volver a aparecer. Puede re-lanzarse desde
// la página "Mi Cuenta" con el botón "Ver tutorial de nuevo".
// ═══════════════════════════════════════════════════════════════
function AnnouncementModal({client,token,onClose}){
  const {t}=useT();
  const A=anuncio(t);
  const [closing,setClosing]=useState(false);
  const dismiss=async()=>{
    if(closing)return;
    setClosing(true);
    try{await dq("clients",{method:"PATCH",token,filters:`?id=eq.${client.id}`,body:{announcement_seen:A.key}});}catch(e){console.error("announcement dismiss",e);}
    onClose();
  };
  return <div onClick={dismiss} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(5,12,24,0.78)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div onClick={e=>e.stopPropagation()} style={{maxWidth:460,width:"100%",background:"linear-gradient(180deg, rgba(20,30,48,0.98), rgba(12,20,36,0.98))",border:"1px solid rgba(184,149,106,0.35)",borderRadius:18,padding:"30px 28px",boxShadow:"0 24px 70px rgba(0,0,0,0.5)",textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:8}}>{A.emoji}</div>
      <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 10px",background:GOLD_GRADIENT,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{A.title}</h2>
      <p style={{fontSize:13.5,color:"rgba(255,255,255,0.7)",margin:"0 0 18px",lineHeight:1.5}}>{A.intro}</p>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
        {A.rows.map(([k,v],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:"rgba(184,149,106,0.08)",border:"1px solid rgba(184,149,106,0.18)",borderRadius:10}}>
          <span style={{fontSize:13,color:"rgba(255,255,255,0.75)"}}>{k}</span>
          <span style={{fontSize:15,fontWeight:800,color:GOLD_LIGHT,fontFeatureSettings:'"tnum"'}}>{v}</span>
        </div>)}
      </div>
      <p style={{fontSize:11.5,color:"rgba(255,255,255,0.45)",margin:"0 0 18px",fontStyle:"italic"}}>{A.foot}</p>
      <button onClick={dismiss} disabled={closing} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:GOLD_GRADIENT,color:"#1a1206",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{closing?"...":t("tut.gotIt")}</button>
    </div>
  </div>;
}
function TutorialOverlay({client,token,onClose,onComplete}){
  const {t}=useT();
  const [i,setI]=useState(0);
  const [closing,setClosing]=useState(false);
  const fn=client?.first_name||"";
  const code=client?.client_code||"";
  const steps=[
    {
      icon:"🪪",
      title:t("tut.codeTitle"),
      subtitle:"Importante — anotalo",
      body:t("tut.codeBody1")+"ARGENCARGO "+(code||"XXXXXX")+t("tut.codeBody2"),
      cta:"Continuar",
      nav:null,
      highlightCode:true
    },
    {
      icon:"👋",
      title:`¡Hola ${fn}!`,
      subtitle:"Bienvenido a Argencargo",
      body:t("tut.intro"),
      cta:"Empezar",
      nav:null
    },
    {
      icon:"🧮",
      title:t("tut.calcTitle"),
      subtitle:t("tut.calcSub"),
      body:t("tut.calcBody"),
      cta:"Siguiente",
      nav:"calculator"
    },
    {
      icon:"📦",
      title:"Mis Importaciones",
      subtitle:t("tut.trackTitle"),
      body:t("tut.trackBody"),
      cta:"Siguiente",
      nav:"imports"
    },
    {
      icon:"💸",
      title:"Pagos Internacionales",
      subtitle:"SWIFT / WIRE a proveedores",
      body:t("tut.payBody"),
      cta:"Siguiente",
      nav:"payments"
    },
    {
      icon:"⭐",
      title:"Mi Cuenta",
      subtitle:"Nivel, puntos y saldo",
      body:t("tut.accountBody"),
      cta:"Siguiente",
      nav:"account"
    },
    {
      icon:"✅",
      title:t("tut.done"),
      subtitle:"Cualquier duda, escribinos",
      body:t("tut.doneDesc"),
      cta:"Finalizar",
      nav:"imports"
    }
  ];
  const cur=steps[i];
  const last=i===steps.length-1;
  const next=()=>{
    if(last){finish();return;}
    const nx=steps[i+1];
    if(nx.nav&&typeof window!=="undefined")window.dispatchEvent(new CustomEvent("ac_nav",{detail:nx.nav}));
    setI(i+1);
  };
  const finish=async()=>{
    setClosing(true);
    try{
      if(client?.id&&token){
        await fetch(`${SB_URL}/rest/v1/clients?id=eq.${client.id}`,{method:"PATCH",headers:{"Content-Type":"application/json",apikey:SB_KEY,Authorization:`Bearer ${token}`,Prefer:"return=minimal"},body:JSON.stringify({tutorial_completed:true})});
      }
    }catch(e){console.error("tutorial save",e);}
    onComplete?.();
    onClose?.();
  };
  const skip=()=>finish();

  return <div style={{position:"fixed",inset:0,zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",background:"rgba(10,22,40,0.78)",backdropFilter:"blur(8px)",animation:"acFadeIn 220ms ease-out"}}>
    <style dangerouslySetInnerHTML={{__html:`
      @keyframes acFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes acSlideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      .ac-tut-card{animation:acSlideIn 260ms cubic-bezier(0.34,1.56,0.64,1)}
    `}}/>
    <div className="ac-tut-card" key={i} style={{maxWidth:520,width:"100%",background:"linear-gradient(160deg, #152849 0%, #0F1E3D 100%)",border:"1px solid rgba(184,149,106,0.22)",borderRadius:20,padding:"36px 32px 28px",boxShadow:"0 30px 60px rgba(0,0,0,0.45), 0 0 80px rgba(184,149,106,0.08)",position:"relative"}}>
      {/* Skip button top-right */}
      <button onClick={skip} disabled={closing} style={{position:"absolute",top:14,right:14,background:"transparent",border:"none",color:"rgba(255,255,255,0.4)",fontSize:12,fontWeight:600,cursor:"pointer",padding:"6px 10px",borderRadius:6}} onMouseEnter={e=>{e.currentTarget.style.color="rgba(255,255,255,0.75)";}} onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,0.4)";}}>Saltar tutorial ✕</button>
      {/* Progress pills */}
      <div style={{display:"flex",gap:6,marginBottom:22,marginTop:4}}>{steps.map((_,idx)=><div key={idx} style={{flex:1,height:4,borderRadius:2,background:idx<=i?GOLD_GRADIENT:"rgba(255,255,255,0.08)",transition:"background 220ms"}}/>)}</div>
      {/* Icon */}
      <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(135deg, rgba(184,149,106,0.18), rgba(232,208,152,0.06))",border:"1px solid rgba(184,149,106,0.28)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,marginBottom:18,boxShadow:"0 0 30px rgba(184,149,106,0.2)"}}>{cur.icon}</div>
      {/* Subtitle */}
      <p style={{fontSize:11,fontWeight:700,color:GOLD_LIGHT,textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 6px"}}>{cur.subtitle}</p>
      {/* Title */}
      <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 12px",letterSpacing:"-0.02em",lineHeight:1.15}}>{cur.title}</h2>
      {/* Código de cliente destacado (primer step si highlightCode) */}
      {cur.highlightCode&&code&&<div style={{margin:"4px 0 22px",padding:"22px 24px",background:"linear-gradient(135deg, rgba(184,149,106,0.22), rgba(232,208,152,0.06))",border:"1.5px solid rgba(184,149,106,0.45)",borderRadius:14,textAlign:"center",boxShadow:"0 0 40px rgba(184,149,106,0.18)"}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(232,208,152,0.85)",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.18em"}}>{t("tut.yourCodeIs")}</p>
        <p style={{fontSize:38,fontWeight:800,color:GOLD_LIGHT,fontFamily:"monospace",margin:0,letterSpacing:"0.1em",textShadow:"0 0 20px rgba(184,149,106,0.4)"}}>{code}</p>
      </div>}
      {/* Body */}
      <p style={{fontSize:14,color:"rgba(255,255,255,0.7)",lineHeight:1.55,margin:"0 0 28px"}}>{cur.body}</p>
      {/* Footer */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontWeight:600,letterSpacing:"0.05em"}}>{i+1} / {steps.length}</span>
        <div style={{display:"flex",gap:8}}>
          {i>0&&<button onClick={()=>setI(i-1)} disabled={closing} style={{padding:"11px 20px",fontSize:13,fontWeight:600,borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer"}}>{t("common.previous")}</button>}
          <button onClick={next} disabled={closing} style={{padding:"11px 24px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",letterSpacing:"0.04em",boxShadow:GOLD_GLOW}}>{closing?"Guardando...":cur.cta} {!last&&"→"}</button>
        </div>
      </div>
    </div>
  </div>;
}

export default function Page(){
  const {t}=useT();
  const [view,setView]=useState("login");const [step,setStep]=useState(0);const [form,setForm]=useState(INIT);const [errors,setErrors]=useState({});const [loading,setLoading]=useState(false);const [gErr,setGErr]=useState("");const [okMsg,setOkMsg]=useState("");
  const [session,setSession]=useState(null);const [client,setClient]=useState(null);const [profile,setProfile]=useState(null);const [restoring,setRestoring]=useState(true);
  const [adminPreview,setAdminPreview]=useState(false); // flag para mostrar banner "modo preview"
  const [showTutorial,setShowTutorial]=useState(false);
  useEffect(()=>{const r=async()=>{
    // Capturar referral code (?ref=ABCDEF) y guardarlo para el momento del registro
    if(typeof window!=="undefined"){
      const params0=new URLSearchParams(window.location.search);
      const refCode=params0.get("ref");
      if(refCode&&/^[A-Z0-9]{3,12}$/i.test(refCode.trim())){
        try{localStorage.setItem("ac_ref_code",refCode.trim().toUpperCase());}catch{}
        // Si vino con ?ref → forzar vista de registro
        setView("register");
      }
    }
    // Admin preview mode: /portal?admin_preview=<client_id>
    // Usa la session del admin (ac_admin localStorage) para cargar el portal
    // como si fuera ese cliente — solo lectura, no se puede operar.
    if(typeof window!=="undefined"){
      const params=new URLSearchParams(window.location.search);
      const previewId=params.get("admin_preview");
      if(previewId){
        try{
          const raw=localStorage.getItem("ac_admin");
          const adminSess=raw?JSON.parse(raw):null;
          if(adminSess?.token&&adminSess?.profile?.role==="admin"){
            const c=await dq("clients",{token:adminSess.token,filters:`?id=eq.${previewId}&select=*`});
            const cl=Array.isArray(c)&&c[0]?c[0]:null;
            if(cl){
              setSession({token:adminSess.token,refresh_token:adminSess.refresh_token,user:adminSess.user});
              setProfile({role:"cliente"}); // simular perfil cliente para que renderice Dashboard
              setClient(cl);
              setAdminPreview(true);
              setRestoring(false);
              return;
            }
          }
        }catch{}
        // Fallback: si no se pudo preview, limpiar el param y seguir flujo normal
        window.history.replaceState({},"",window.location.pathname);
      }
    }
    const s=loadSession();if(!s?.token||!s?.user){setRestoring(false);return;}try{const uid=s.user.id;const p=await dq("profiles",{token:s.token,filters:`?id=eq.${uid}&select=*`});const prof=Array.isArray(p)?p[0]:null;if(!prof){clearSession();setRestoring(false);return;}if(prof.role==="cliente"){const c=await dq("clients",{token:s.token,filters:`?auth_user_id=eq.${uid}&select=*`});setClient(Array.isArray(c)?c[0]:null);}setSession(s);setProfile(prof);}catch{clearSession();}setRestoring(false);
  };r();},[]);
  const ch=f=>v=>{setForm(p=>({...p,[f]:v}));setErrors(p=>({...p,[f]:undefined}));setGErr("");};
  const val=s=>{const e={};if(s===0){if(!form.first_name.trim())e.first_name="Requerido";if(!form.last_name.trim())e.last_name="Requerido";if(!form.whatsapp.trim())e.whatsapp="Requerido";else if(form.whatsapp.replace(/\D/g,"").length<10)e.whatsapp="Número inválido (mínimo 10 dígitos)";if(!form.email.trim())e.email="Requerido";else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))e.email=t("auth.emailInvalid");if(!form.password)e.password="Requerido";else if(form.password.length<6)e.password=t("profile.min6");if(form.password!==form.confirm_password)e.confirm_password="No coinciden";}if(s===1){if(!form.street.trim())e.street="Requerido";if(!form.postal_code.trim())e.postal_code="Requerido";if(!form.city.trim())e.city="Requerido";if(!form.province)e.province="Requerido";}if(s===2&&form.tax_condition==="responsable_inscripto"){if(!form.company_name.trim())e.company_name="Requerido";}if(s===2&&(form.tax_condition==="responsable_inscripto"||form.tax_condition==="monotributista")){if(!form.cuit.trim())e.cuit="Requerido";else if(form.cuit.replace(/\D/g,"").length!==11)e.cuit="CUIT inválido (debe tener 11 dígitos)";}if(s===2&&form.tax_condition!=="responsable_inscripto"&&form.tax_condition!=="monotributista"){if(!form.dni.trim())e.dni="Requerido";else if(form.dni.replace(/\D/g,"").length<7)e.dni="DNI inválido";}setErrors(e);return !Object.keys(e).length;};
  const gc=(fn,ln)=>(fn.substring(0,3)+ln.substring(0,3)).toUpperCase();
  // Inserta el cliente reintentando con sufijo numérico si el client_code ya existe.
  // Dos personas con iniciales iguales generan el mismo código (ej. "Martin Briones" y
  // "Martin Briet" → MARBRI). Por RLS el cliente no puede leer códigos ajenos para chequear
  // antes, así que se reintenta ante el conflicto de unicidad (MARBRI → MARBR2 → MARBR3 …).
  const insertClientUnique=async(token,body)=>{
    const base=(body.client_code||"").toUpperCase();
    for(let i=0;i<12;i++){
      const code=i===0?base:`${base.slice(0,5)}${i+1}`;
      const r=await dq("clients",{method:"POST",token,body:{...body,client_code:code}});
      if(Array.isArray(r)&&r[0]?.id)return r;
      const isDup=r&&(r.code==="23505"||/client_code|duplicate|unique/i.test(`${r.message||""} ${r.details||""}`));
      if(!isDup)return r; // otro error (no de unicidad) → no tiene sentido reintentar
    }
    return null;
  };
  const createClient=async(token,uid)=>{
    const code=gc(form.first_name.trim(),form.last_name.trim());
    // Si vino con ?ref=CODE en la URL, buscar el referidor por client_code
    let referredById=null;
    try{
      const refCode=(typeof window!=="undefined")?(localStorage.getItem("ac_ref_code")||""):"";
      if(refCode){
        const r=await dq("clients",{token,filters:`?client_code=eq.${encodeURIComponent(refCode.toUpperCase())}&select=id&limit=1`});
        if(Array.isArray(r)&&r[0])referredById=r[0].id;
      }
    }catch{}
    // terms_accepted_at: el alta implica aceptar los T&C (/terminos) — queda fecha y hora como constancia.
    const body={auth_user_id:uid,first_name:form.first_name.trim(),last_name:form.last_name.trim(),whatsapp:form.whatsapp.trim(),dni:form.dni.trim()||null,email:form.email.trim(),tax_condition:form.tax_condition,company_name:form.tax_condition==="responsable_inscripto"?form.company_name.trim():null,cuit:(form.tax_condition==="responsable_inscripto"||form.tax_condition==="monotributista")?form.cuit.trim():null,street:form.street.trim(),floor_apt:form.floor_apt.trim()||null,postal_code:form.postal_code.trim(),city:form.city.trim(),province:form.province,client_code:code,terms_accepted_at:new Date().toISOString()};
    if(referredById)body.referred_by_client_id=referredById;
    const result=await insertClientUnique(token,body);
    // Limpiar el ref code del localStorage post-registro
    if(referredById){try{localStorage.removeItem("ac_ref_code");}catch{}}
    return result;
  };
  const doReg=async()=>{if(!val(2))return;setLoading(true);setGErr("");try{const a=await ac("signup",{email:form.email,password:form.password,data:{role:"cliente",first_name:form.first_name.trim(),last_name:form.last_name.trim(),whatsapp:form.whatsapp.trim(),dni:form.dni.trim()||null,tax_condition:form.tax_condition,company_name:form.company_name.trim(),cuit:form.cuit.trim(),street:form.street.trim(),floor_apt:form.floor_apt.trim(),postal_code:form.postal_code.trim(),city:form.city.trim(),province:form.province}});if(a.error){setGErr(a.error.message||"Error");setLoading(false);return;}if(!a.access_token){setOkMsg("Te enviamos un email de confirmación. Una vez confirmado, ingresá con tu email y contraseña.");setLoading(false);return;}const c=await createClient(a.access_token,a.user.id);if(c?.error||!c){setGErr("Error guardando datos.");setLoading(false);return;}const ss={token:a.access_token,refresh_token:a.refresh_token,user:a.user};saveSession(ss);setSession(ss);const cliente=Array.isArray(c)?c[0]:c;setClient(cliente);setProfile({role:"cliente"});
    // Welcome email (fire-and-forget, no bloqueamos si falla)
    try{if(cliente?.id){fetch("/api/notify/welcome",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${a.access_token}`},body:JSON.stringify({client_id:cliente.id})}).catch(()=>{});}}catch{}
  }catch{setGErr(t("common.connError"));}setLoading(false);};
  const doLogin=async()=>{setLoading(true);setGErr("");if(!form.email||!form.password){setGErr("Completá email y contraseña");setLoading(false);return;}try{const r=await ac("token?grant_type=password",{email:form.email,password:form.password});if(r.error||r.error_description||r.msg){setGErr("Email o contraseña incorrectos");setLoading(false);return;}const token=r.access_token,uid=r.user.id;const p=await dq("profiles",{token,filters:`?id=eq.${uid}&select=*`});const prof=Array.isArray(p)?p[0]:null;if(prof?.role==="cliente"){let c=await dq("clients",{token,filters:`?auth_user_id=eq.${uid}&select=*`});let cl=Array.isArray(c)?c[0]:null;
      if(!cl&&r.user?.user_metadata){const m=r.user.user_metadata;if(m.first_name){const code=(m.first_name.substring(0,3)+m.last_name.substring(0,3)).toUpperCase();const nc=await insertClientUnique(token,{auth_user_id:uid,first_name:m.first_name,last_name:m.last_name,whatsapp:m.whatsapp||"",dni:m.dni||null,email:r.user.email,tax_condition:m.tax_condition||"ninguna",company_name:m.company_name||null,cuit:m.cuit||null,street:m.street||"",floor_apt:m.floor_apt||null,postal_code:m.postal_code||"",city:m.city||"",province:m.province||"",client_code:code});cl=Array.isArray(nc)?nc[0]:nc;}}
      setClient(cl);}const ss={token,refresh_token:r.refresh_token,user:r.user};saveSession(ss);setSession(ss);setProfile(prof);}catch{setGErr(t("auth.badCredentials"));}setLoading(false);};
  const logout=()=>{clearSession();setSession(null);setClient(null);setProfile(null);setForm(INIT);setStep(0);setView("login");setGErr("");setOkMsg("");};

  // Forgot password — envía email con link de recuperación a través de Supabase
  const [forgotEmail,setForgotEmail]=useState("");
  const [forgotSent,setForgotSent]=useState(false);
  const doForgot=async()=>{
    const email=(forgotEmail||form.email||"").trim();
    if(!email||!email.includes("@")){setGErr(t("auth.email"));return;}
    setLoading(true);setGErr("");
    try{
      // Supabase requiere redirect_to como QUERY PARAM, no en body.data (estaba mal antes).
      const redirectTo=(typeof window!=="undefined"?window.location.origin:"https://www.argencargo.com.ar")+"/portal";
      const r=await fetch(`${SB_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,{
        method:"POST",
        headers:{apikey:SB_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({email,gotrue_meta_security:{}}),
      }).then(x=>x.json());
      // Supabase devuelve {} en éxito; si hay error trae error_code o msg
      if(r?.error||r?.msg||r?.error_description){setGErr(r.msg||r.error_description||"Error");setLoading(false);return;}
      setForgotSent(true);
    }catch(e){setGErr(t("common.connError"));}
    setLoading(false);
  };

  // Reset password — al volver del email, supabase pone access_token en hash (#access_token=...&type=recovery)
  const [resetPwd,setResetPwd]=useState("");
  const [resetPwd2,setResetPwd2]=useState("");
  const [resetToken,setResetToken]=useState(null);
  const [resetDone,setResetDone]=useState(false);
  useEffect(()=>{
    if(typeof window==="undefined")return;
    const h=window.location.hash||"";
    const qs=window.location.search||"";
    // Caso A: error de Supabase en query params (ej. ?error=access_denied&error_description=...).
    // Pasa cuando el link de recovery expiró o el redirect_to no está whitelisted.
    if(qs.includes("error=")){
      const sp=new URLSearchParams(qs);
      const err=sp.get("error_description")||sp.get("error_code")||sp.get("error")||t("auth.linkInvalid");
      setOkMsg("");setGErr(`Recuperación falló: ${decodeURIComponent(err).replace(/\+/g," ")}. Pedí un link nuevo.`);
      setView("forgot");
      try{history.replaceState(null,"",window.location.pathname);}catch(e){}
      return;
    }
    // Caso B: hash con tipo recovery → setView reset
    if(h.includes("type=recovery")||h.includes("error=")){
      const params=new URLSearchParams(h.slice(1));
      // Hash también puede traer error
      if(params.get("error")){
        const errH=params.get("error_description")||params.get("error_code")||params.get("error");
        setGErr(`Recuperación falló: ${decodeURIComponent(errH).replace(/\+/g," ")}. Pedí un link nuevo.`);
        setView("forgot");
        try{history.replaceState(null,"",window.location.pathname);}catch(e){}
        return;
      }
      const tok=params.get("access_token");
      if(tok){setResetToken(tok);setView("reset");
        // limpiar hash para que no quede expuesto
        try{history.replaceState(null,"",window.location.pathname+window.location.search);}catch(e){}
      } else {
        setGErr(t("auth.linkNoToken"));
        setView("forgot");
      }
    }
  },[]);
  const doReset=async()=>{
    if(!resetPwd||resetPwd.length<6){setGErr(t("profile.min6"));return;}
    if(resetPwd!==resetPwd2){setGErr(t("auth.reset.passwordsDontMatch"));return;}
    setLoading(true);setGErr("");
    try{
      // Usamos el token de recovery para hacer PATCH /auth/v1/user con la nueva contraseña
      const r=await fetch(`${SB_URL}/auth/v1/user`,{
        method:"PUT",
        headers:{apikey:SB_KEY,Authorization:`Bearer ${resetToken}`,"Content-Type":"application/json"},
        body:JSON.stringify({password:resetPwd}),
      }).then(x=>x.json());
      if(r?.error||r?.msg||r?.error_description){setGErr(r.msg||r.error_description||t("auth.reset.invalid"));setLoading(false);return;}
      setResetDone(true);
      // Auto-login con el token recibido (ya es access_token válido)
      // Pero mejor: hacemos login limpio con email+pwd para tener refresh_token fresco.
      // Más simple: avisamos y mandamos a login manualmente
      setTimeout(()=>{setView("login");setResetToken(null);setResetDone(false);setResetPwd("");setResetPwd2("");setOkMsg("Contraseña actualizada. Ingresá con tu nueva contraseña.");},1500);
    }catch(e){setGErr(t("common.connError"));}
    setLoading(false);
  };
  if(restoring)return <><ToastStack/><div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:DARK_BG}}><p style={{color:"rgba(255,255,255,0.4)"}}>Cargando...</p></div></>;
  if(session&&profile)return <><ToastStack/><DialogHost/>
    {adminPreview&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,background:"linear-gradient(90deg, rgba(184,149,106,0.95), rgba(232,208,152,0.95))",color:"#0A1628",padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:12,fontWeight:700,letterSpacing:"0.04em",boxShadow:"0 2px 12px rgba(0,0,0,0.3)"}}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      <span>{t("auth.previewMode")} <strong>{client?.first_name} {client?.last_name} ({client?.client_code})</strong></span>
      <button onClick={()=>{if(typeof window!=="undefined")window.close();}} style={{marginLeft:8,padding:"4px 12px",fontSize:11,fontWeight:700,background:"rgba(10,22,40,0.85)",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",letterSpacing:"0.04em"}}>Cerrar</button>
    </div>}
    <div style={{paddingTop:adminPreview?38:0}}><Dashboard profile={profile} client={client} user={session.user} token={session.token} onLogout={logout} onRestartTutorial={()=>setShowTutorial(true)}/></div>
    {(showTutorial||(client&&!adminPreview&&!client.tutorial_completed))&&<TutorialOverlay client={client} token={session.token} onClose={()=>setShowTutorial(false)} onComplete={()=>setClient(c=>c?{...c,tutorial_completed:true}:c)}/>}
    {client&&!adminPreview&&client.tutorial_completed&&client.announcement_seen!==ANUNCIO_KEY&&<AnnouncementModal client={client} token={session.token} onClose={()=>setClient(c=>c?{...c,announcement_seen:ANNOUNCEMENT.key}:c)}/>}
  </>;
  if(okMsg)return <><ToastStack/><AuthPage><div style={{textAlign:"center"}}><p style={{fontSize:15,color:"rgba(255,255,255,0.65)",margin:"0 0 24px"}}>{okMsg}</p><PBtn onClick={()=>{setOkMsg("");setView("login");setForm(INIT);setStep(0);}}>{t("auth.login.cta")} →</PBtn></div></AuthPage></>;
  const ST=[t("profile.personalData"),t("profile.shippingData"),t("auth.taxCondition")];
  return <><ToastStack/><AuthPage>
    {view==="forgot"?<>
      <div style={{textAlign:"center",marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>{t("auth.forgot.title")}</h2>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0,lineHeight:1.5}}>{t("auth.forgot.subtitle")}</p>
      </div>
      <ErrBox msg={gErr}/>
      {forgotSent?<div style={{padding:18,background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:12,textAlign:"center"}}>
        <p style={{fontSize:32,margin:"0 0 8px"}}>📧</p>
        <p style={{fontSize:13,color:"#22c55e",margin:0,lineHeight:1.5,fontWeight:600}}>{t("auth.forgot.sent")}</p>
      </div>:<>
        <Inp label={t("auth.email")} type="email" value={forgotEmail} onChange={setForgotEmail} placeholder="tuemail@dominio.com" req/>
        <div style={{marginTop:16}}><PBtn onClick={doForgot} disabled={loading}>{loading?t("auth.forgot.sending"):`${t("auth.forgot.send")} →`}</PBtn></div>
      </>}
      <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.4)",marginTop:18,marginBottom:0}}>
        <span onClick={()=>{setView("login");setGErr("");setForgotSent(false);setForgotEmail("");}} style={{color:B.accent,cursor:"pointer",fontWeight:600}}>← {t("auth.forgot.back")}</span>
      </p>
    </>:view==="reset"?<>
      <div style={{textAlign:"center",marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>{t("auth.reset.title")}</h2>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0,lineHeight:1.5}}>{t("auth.reset.subtitle")}</p>
      </div>
      <ErrBox msg={gErr}/>
      {resetDone?<div style={{padding:18,background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:12,textAlign:"center"}}>
        <p style={{fontSize:32,margin:"0 0 8px"}}>✓</p>
        <p style={{fontSize:13,color:"#22c55e",margin:0,fontWeight:600}}>{t("auth.reset.success")}</p>
      </div>:<>
        <Inp label={t("auth.password")} type="password" value={resetPwd} onChange={setResetPwd} placeholder={t("profile.min6")} req/>
        <Inp label={t("auth.passwordConfirm")} type="password" value={resetPwd2} onChange={setResetPwd2} placeholder="••••••••" req/>
        <div style={{marginTop:16}}><PBtn onClick={doReset} disabled={loading}>{loading?t("common.saving"):`${t("auth.reset.save")} →`}</PBtn></div>
      </>}
    </>:view==="login"?<>
      <div style={{textAlign:"center",marginBottom:24}}><h2 style={{fontSize:22,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>{t("auth.login.subtitle")}</h2><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:0}}>{t("auth.login.title")}</p></div><ErrBox msg={gErr}/>
      <Inp label={t("auth.email")} type="email" value={form.email} onChange={ch("email")} placeholder="tuemail@dominio.com" req/>
      <Inp label={t("auth.password")} type="password" value={form.password} onChange={ch("password")} placeholder="••••••••" req/>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:6,marginBottom:14}}>
        <span onClick={()=>{setView("forgot");setGErr("");setForgotEmail(form.email||"");}} style={{fontSize:12,color:B.accent,cursor:"pointer",fontWeight:500}}>{t("auth.forgotPassword")}</span>
      </div>
      <PBtn onClick={doLogin} disabled={loading}>{loading?t("auth.login.loading"):`${t("auth.login.button")} →`}</PBtn>
      <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.4)",marginTop:20,marginBottom:0}}>{t("auth.noAccount")} <span onClick={()=>{setView("register");setGErr("");}} style={{color:B.accent,cursor:"pointer",fontWeight:600}}>{t("auth.register.cta")}</span></p>
    </>:<>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><h2 style={{fontSize:20,fontWeight:600,color:"#fff",margin:0}}>{t("auth.register.title")}</h2><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{step+1}/3</span></div>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 16px"}}>{ST[step]}</p><ErrBox msg={gErr}/>
      {step===0&&<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label={t("auth.firstName")} value={form.first_name} onChange={ch("first_name")} placeholder="Juan" req error={errors.first_name}/><Inp label={t("auth.lastName")} value={form.last_name} onChange={ch("last_name")} placeholder="Pérez" req error={errors.last_name}/></div><Inp label={t("auth.whatsapp")} type="tel" value={form.whatsapp} onChange={ch("whatsapp")} placeholder="+54 9 11 1234-5678" req error={errors.whatsapp}/><Inp label={t("auth.email")} type="email" value={form.email} onChange={ch("email")} placeholder="tu@email.com" req error={errors.email}/><Inp label={t("auth.password")} type="password" value={form.password} onChange={ch("password")} placeholder={t("profile.min6")} req error={errors.password}/><Inp label={t("auth.passwordConfirm")} type="password" value={form.confirm_password} onChange={ch("confirm_password")} placeholder="••••••••" req error={errors.confirm_password}/></>}
      {step===1&&<><Inp label={t("auth.address")} value={form.street} onChange={ch("street")} placeholder="Av. Corrientes 1234" req error={errors.street}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Piso/Depto" value={form.floor_apt} onChange={ch("floor_apt")} placeholder="3° B"/><Inp label="CP" value={form.postal_code} onChange={ch("postal_code")} placeholder="1414" req error={errors.postal_code}/></div><Inp label={t("auth.city")} value={form.city} onChange={ch("city")} placeholder="Palermo" req error={errors.city}/><Sel label={t("auth.province")} value={form.province} onChange={ch("province")} options={PR} req ph="—"/></>}
      {step===2&&<><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 14px"}}>{t("auth.taxCondition")}</p><div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>{TX.map(o=><div key={o.value} onClick={()=>ch("tax_condition")(o.value)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",border:`1.5px solid ${form.tax_condition===o.value?B.accent:"rgba(255,255,255,0.08)"}`,borderRadius:10,cursor:"pointer",background:form.tax_condition===o.value?"rgba(184,149,106,0.1)":"transparent"}}><div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${form.tax_condition===o.value?B.accent:"rgba(255,255,255,0.15)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{form.tax_condition===o.value&&<div style={{width:10,height:10,borderRadius:"50%",background:B.accent}}/>}</div><span style={{fontSize:14,color:"rgba(255,255,255,0.7)"}}>{t(`tax.${o.value}`)}</span></div>)}</div>{form.tax_condition==="responsable_inscripto"&&<div style={{padding:14,background:"rgba(255,255,255,0.028)",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)"}}><Inp label={t("auth.company")} value={form.company_name} onChange={ch("company_name")} placeholder="Mi Empresa S.R.L." req error={errors.company_name}/><Inp label={t("auth.cuit")} value={form.cuit} onChange={ch("cuit")} placeholder="20-12345678-9" req error={errors.cuit}/></div>}{form.tax_condition==="monotributista"&&<div style={{padding:14,background:"rgba(255,255,255,0.028)",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)"}}><Inp label={t("auth.cuit")} value={form.cuit} onChange={ch("cuit")} placeholder="20-12345678-9" req error={errors.cuit}/></div>}{form.tax_condition!=="responsable_inscripto"&&form.tax_condition!=="monotributista"&&<div style={{padding:14,background:"rgba(255,255,255,0.028)",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)"}}><Inp label={t("auth.dni")} value={form.dni} onChange={ch("dni")} placeholder="30123456" req error={errors.dni}/></div>}</>}
      <div style={{display:"flex",gap:12,marginTop:18}}>{step>0&&<SBtn onClick={()=>setStep(s=>s-1)}>{t("common.back")}</SBtn>}<PBtn onClick={step<2?()=>{if(val(step))setStep(s=>s+1);}:doReg} disabled={loading}>{loading?t("common.saving"):step<2?`${t("common.next")} →`:t("auth.register.title")}</PBtn></div>
      {step===2&&<p style={{fontSize:11,color:"rgba(255,255,255,0.42)",margin:"12px 0 0",textAlign:"center",lineHeight:1.5}}>{t("auth.acceptTerms")} <a href="/terminos" target="_blank" rel="noopener" style={{color:"#E8C99B",fontWeight:600}}>{t("auth.termsName")}</a> {t("auth.ofService")}</p>}
      <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.4)",marginTop:18,marginBottom:0}}>{t("auth.haveAccount")} <span onClick={()=>{setView("login");setStep(0);setGErr("");}} style={{color:B.accent,cursor:"pointer",fontWeight:600}}>{t("auth.login.cta")}</span></p>
    </>}
  </AuthPage></>;
}
