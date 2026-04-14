"use client";
import { useState, useEffect } from "react";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const LOGO=`${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
const B={primary:"#1B4F8A",accent:"#4A90D9"};
const DARK_BG="linear-gradient(160deg,#030810 0%,#071428 40%,#091b34 70%,#040e1c 100%)";
const IC="#60a5fa";
const sf=async(p,o={})=>{const r=await fetch(`${SB_URL}${p}`,{...o,headers:{apikey:SB_KEY,"Content-Type":"application/json",...(o.headers||{})}});return r.json();};
const ac=async(e,b)=>sf(`/auth/v1/${e}`,{method:"POST",body:JSON.stringify(b)});
const dq=async(t,{method="GET",body,token,filters=""})=>sf(`/rest/v1/${t}${filters}`,{method,body:body?JSON.stringify(body):undefined,headers:{Authorization:`Bearer ${token}`,...(method==="POST"?{Prefer:"return=representation"}:{})}});
const saveSession=(d)=>{try{localStorage.setItem("ac_s",JSON.stringify(d));}catch(e){}};
const loadSession=()=>{try{const d=localStorage.getItem("ac_s");return d?JSON.parse(d):null;}catch(e){return null;}};
const clearSession=()=>{try{localStorage.removeItem("ac_s");}catch(e){}};
const PR=["Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"];
const TX=[{value:"responsable_inscripto",label:"Responsable Inscripto"},{value:"monotributista",label:"Monotributista"},{value:"ninguna",label:"Ninguna de las anteriores"}];
const INIT={first_name:"",last_name:"",whatsapp:"",email:"",password:"",confirm_password:"",street:"",floor_apt:"",postal_code:"",city:"",province:"",tax_condition:"ninguna",company_name:"",cuit:""};
const SP={proveedor:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z","M3.27 6.96 12 12.01l8.73-5.05","M12 22.08V12"],warehouse:["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z","M9 22V12h6v10"],documentacion:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"],en_transito_aereo:["M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 3.7 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.5-.6.4-1.1z"],en_transito_maritimo:["M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1","M4 18l-1-5h18l-1 5","M5 13V7h14v6","M9 7V4h6v3"],arribo:["M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z","M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],aduana:["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z","M9 12l2 2 4-4"],liberacion:["M9 11l3 3L22 4","M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],entrega:["M1 3h15v13H1z","M16 8h4l3 3v5h-7V8z","M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z","M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],cerrada:["M22 11.08V12a10 10 0 1 1-5.93-9.14","M22 4 12 14.01l-3-3"]};
const OS=[{k:"proveedor",l:"Proveedor"},{k:"warehouse",l:"Warehouse\nArgencargo"},{k:"documentacion",l:"Documentación"},{k:"en_transito",l:"En tránsito"},{k:"arribo",l:"Arribo\nArgentina"},{k:"aduana",l:"Gestión\naduanera"},{k:"liberacion",l:"Liberación"},{k:"entrega",l:"Entrega\nfinal"},{k:"cerrada",l:"Operación\ncerrada"}];
const S2S={pendiente:0,en_deposito_origen:1,en_preparacion:2,en_transito:3,arribo_argentina:4,en_aduana:5,lista_retiro:6,entregada:7,operacion_cerrada:8,cancelada:-1};
const SM={pendiente:{l:"PROVEEDOR",c:"#94a3b8"},en_deposito_origen:{l:"WAREHOUSE ARGENCARGO",c:"#fbbf24"},en_preparacion:{l:"DOCUMENTACIÓN",c:"#a78bfa"},en_transito:{l:"EN TRÁNSITO",c:"#60a5fa"},arribo_argentina:{l:"ARRIBO ARGENTINA",c:"#818cf8"},en_aduana:{l:"GESTIÓN ADUANERA",c:"#fb923c"},lista_retiro:{l:"LIBERACIÓN",c:"#34d399"},entregada:{l:"ENTREGA FINAL",c:"#22c55e"},operacion_cerrada:{l:"OPERACIÓN CERRADA",c:"#10b981"},cancelada:{l:"CANCELADA",c:"#f87171"}};
const CM={aereo_blanco:"Aéreo Courier Comercial",aereo_negro:"Aéreo Integral AC",maritimo_blanco:"Marítimo Carga LCL/FCL",maritimo_negro:"Marítimo Integral AC"};
const CN=[{key:"imports",label:"IMPORTACIONES",p:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z","M3.27 6.96 12 12.01l8.73-5.05","M12 22.08V12"]},{key:"calculator",label:"CALCULADORA",p:["M4 4h16v16H4z","M4 8h16","M8 4v16"]},{key:"quotes",label:"COTIZACIONES",p:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"]},{key:"services",label:"SERVICIOS",p:["M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"]},{key:"account",label:"ESTADO DE CUENTA",p:["M12 1v22","M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"]},{key:"points",label:"PUNTOS",p:["M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"]},{key:"profile",label:"MI PERFIL",p:["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"]}];
function WorldMap(){const d=[[120,80],[135,85],[150,78],[165,90],[180,85],[200,95],[215,88],[230,92],[250,100],[265,95],[280,105],[300,98],[320,110],[335,105],[350,115],[370,108],[390,120],[410,112],[430,125],[450,118],[470,130],[490,122],[510,135],[530,128],[550,140],[570,132],[590,145],[610,138],[630,150],[140,120],[160,130],[180,125],[200,140],[220,135],[240,145],[260,138],[280,150],[300,142],[320,155],[340,148],[360,158],[380,152],[400,162],[420,155],[440,165],[460,158],[480,170],[500,162],[520,175],[540,168],[560,180],[580,172],[600,185],[620,178]];const l=[[200,95,450,118],[300,98,520,135],[180,125,400,162],[280,150,500,208],[350,115,570,132]];return <svg width="100%" height="100%" viewBox="0 0 750 320" preserveAspectRatio="xMidYMid slice" style={{position:"absolute",inset:0,opacity:0.05,pointerEvents:"none"}}>{l.map((v,i)=><line key={i} x1={v[0]} y1={v[1]} x2={v[2]} y2={v[3]} stroke="#4A90D9" strokeWidth="0.5" opacity="0.4"/>)}{d.map((v,i)=><circle key={i} cx={v[0]} cy={v[1]} r={1.5} fill="#4A90D9" opacity="0.5"/>)}</svg>;}
function Inp({label,type="text",value,onChange,placeholder,req,error}){return <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{req&&<span style={{color:"#ff6b6b"}}> *</span>}</label><input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:`1.5px solid ${error?"#ff6b6b":"rgba(255,255,255,0.12)"}`,borderRadius:10,background:"rgba(255,255,255,0.07)",color:"#fff",outline:"none"}} onFocus={e=>{e.target.style.borderColor=B.accent;}} onBlur={e=>{e.target.style.borderColor=error?"#ff6b6b":"rgba(255,255,255,0.12)";}}/>{error&&<p style={{fontSize:11,color:"#ff6b6b",margin:"4px 0 0"}}>{error}</p>}</div>;}
function Sel({label,value,onChange,options,req,ph}){return <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{req&&<span style={{color:"#ff6b6b"}}> *</span>}</label><select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.07)",color:value?"#fff":"rgba(255,255,255,0.35)",outline:"none"}}>{ph&&<option value="" style={{background:"#0a1428"}}>{ph}</option>}{options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value} style={{background:"#0a1428",color:"#fff"}}>{typeof o==="string"?o:o.label}</option>)}</select></div>;}
function PBtn({children,onClick,disabled}){return <button onClick={onClick} disabled={disabled} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:600,border:"none",borderRadius:10,cursor:disabled?"not-allowed":"pointer",background:disabled?"rgba(255,255,255,0.08)":`linear-gradient(135deg,${B.accent},${B.primary})`,color:disabled?"rgba(255,255,255,0.25)":"#fff"}}>{children}</button>;}
function SBtn({children,onClick}){return <button onClick={onClick} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:500,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.6)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,cursor:"pointer"}}>{children}</button>;}
function ErrBox({msg}){return msg?<div style={{padding:"10px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:10,fontSize:13,color:"#ff6b6b",marginBottom:14}}>{msg}</div>:null;}
function formatDate(d){if(!d)return"—";const s=String(d).slice(0,10);if(s.match(/^\d{4}-\d{2}-\d{2}$/)){const[y,m,day]=s.split("-");return new Date(y,m-1,day).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}
function AuthPage({children}){return <div style={{minHeight:"100vh",display:"flex",position:"relative",overflow:"hidden",fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif"}}><div style={{position:"absolute",inset:0,background:DARK_BG}}/><div style={{position:"absolute",inset:0}}><WorldMap/></div><div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1rem",position:"relative",zIndex:3}}><div style={{maxWidth:420,width:"100%"}}><div style={{textAlign:"center",marginBottom:28}}><img src={LOGO} alt="AC" style={{width:220,height:"auto",filter:"drop-shadow(0 0 20px rgba(74,144,217,0.4))"}}/><p style={{fontSize:13,color:"rgba(255,255,255,0.35)",margin:"10px 0 0"}}>Soluciones integrales de comercio exterior</p></div><div style={{background:"rgba(8,18,35,0.85)",backdropFilter:"blur(24px)",borderRadius:20,padding:"2rem 1.75rem",border:"1px solid rgba(255,255,255,0.06)",boxShadow:"0 30px 60px rgba(0,0,0,0.5)"}}>{children}</div><p style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:16}}>Argencargo © 2026</p></div></div></div>;}
function SI({k,a,cur,isA,sz=22}){let key=k;if(k==="en_transito")key=isA?"en_transito_aereo":"en_transito_maritimo";const ps=SP[key]||[];const co=cur?IC:a?"rgba(96,165,250,0.6)":"rgba(255,255,255,0.15)";return <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={co} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{ps.map((d,i)=><path key={i} d={d}/>)}</svg>;}
function NI({p,a,sz=18}){return <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={a?IC:"rgba(255,255,255,0.3)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p.map((d,i)=><path key={i} d={d}/>)}</svg>;}
function OpProgress({status,isAereo}){const si=S2S[status]??0;return <div className="op-progress" style={{display:"flex",alignItems:"center",padding:"16px 0"}}>{OS.map((s,i)=>{const a=i<=si;const cur=i===si;return <div key={s.k} style={{display:"flex",alignItems:"center",flex:1}}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,width:"100%"}}><div style={{width:42,height:42,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",background:cur?"rgba(74,144,217,0.2)":a?"rgba(74,144,217,0.08)":"rgba(255,255,255,0.03)",border:`1.5px solid ${cur?IC:a?"rgba(74,144,217,0.25)":"rgba(255,255,255,0.06)"}`,boxShadow:cur?"0 0 12px rgba(96,165,250,0.2)":"none"}}><SI k={s.k} a={a} cur={cur} isA={isAereo}/></div><span style={{fontSize:9,color:cur?IC:a?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.18)",textAlign:"center",lineHeight:1.2,fontWeight:cur?700:400,whiteSpace:"pre-line",minHeight:20}}>{s.l}</span></div>{i<OS.length-1&&<div style={{width:24,height:2,background:i<si?IC:"rgba(255,255,255,0.06)",flexShrink:0,marginTop:-20}}/>}</div>})}</div>;}
function OperationsList({ops,onSelect,client}){
  const act=ops.filter(o=>o.status!=="operacion_cerrada"&&o.status!=="cancelada");
  const past=ops.filter(o=>o.status==="operacion_cerrada"||o.status==="cancelada");
  const name=client?`${client.first_name} ${client.last_name}`:"";
  const code=client?.client_code||"";
  const stats=[{l:"TOTAL IMPORTACIONES",v:ops.length,c:"#fff",b:"#3b82f6"},{l:"EN CURSO",v:act.length,c:"#60a5fa",b:"#60a5fa"},{l:"FINALIZADAS",v:past.length,c:"#22c55e",b:"#22c55e"},{l:"REPORTES",v:null,b:"#fff",btn:true}];
  const gd=(o)=>{const d=o.description||"";return d.length>60?"CONSOLIDADO":d.toUpperCase();};
  const renderOp=(op)=>{const st=SM[op.status]||{l:op.status,c:"#999"};const isA=op.channel?.includes("aereo");return <div key={op.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"1.25rem 1.5rem",marginBottom:12}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <span style={{fontSize:13,fontWeight:700,color:"#fff",fontFamily:"monospace",padding:"4px 10px",background:"rgba(255,255,255,0.08)",borderRadius:6,border:"1px solid rgba(255,255,255,0.15)"}}>{op.operation_code}</span>
      <span style={{fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:6,color:st.c,border:`1px solid ${st.c}33`,background:`${st.c}15`}}>● {st.l}</span>
      {op.eta&&op.status!=="entregada"&&<span style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,color:"rgba(255,255,255,0.6)",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)"}}>ETA: {formatDate(op.eta)}</span>}
    </div>
    <p style={{fontSize:15,fontWeight:600,color:"#fff",margin:"0 0 10px",textTransform:"uppercase"}}>{gd(op)}</p>
    <OpProgress status={op.status} isAereo={isA}/>
    <div className="op-info" style={{display:"flex",gap:24,alignItems:"center",borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:12,marginTop:4,flexWrap:"wrap"}}>
      <div><span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",textTransform:"uppercase"}}>Origen</span><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"2px 0 0"}}>{op.origin||"China"}</p></div>
      <div><span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",textTransform:"uppercase"}}>Canal</span><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"2px 0 0"}}>{CM[op.channel]||"—"}</p></div>
      <div><span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",textTransform:"uppercase"}}>Costo importación</span><p style={{fontSize:13,fontWeight:700,color:IC,margin:"2px 0 0"}}>{Number(op.budget_total||0)>0?`USD ${Number(op.budget_total).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"Pendiente"}</p></div>
    </div>
    <div style={{marginTop:14,textAlign:"right"}}><button onClick={()=>onSelect(op)} style={{fontSize:13,fontWeight:600,color:IC,background:"rgba(74,144,217,0.1)",border:"1px solid rgba(74,144,217,0.2)",borderRadius:8,padding:"8px 20px",cursor:"pointer"}}>Ver detalles →</button></div>
  </div>;};
  return <div>
    <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,border:"1px solid rgba(255,255,255,0.07)",padding:"16px 20px",marginBottom:20}}><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:0}}>Mis importaciones</h2><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"2px 0 0"}}>{code} — {name}</p></div>
    <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>{stats.map((s,i)=><div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"14px 16px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:3,background:s.b}}/><p style={{fontSize:10,fontWeight:700,color:"#fff",margin:"4px 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.l}</p>{s.btn?<button style={{fontSize:13,fontWeight:600,color:IC,background:"rgba(74,144,217,0.12)",border:"1px solid rgba(74,144,217,0.25)",borderRadius:6,padding:"4px 12px",cursor:"pointer",marginTop:2}}>Ver reporte</button>:<p style={{fontSize:28,fontWeight:700,color:s.c,margin:0}}>{s.v}</p>}</div>)}</div>
    {act.length>0&&act.map(renderOp)}
    {past.length>0&&<><h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"24px 0 12px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Finalizadas ({past.length})</h3>{past.map(renderOp)}</>}
    {ops.length===0&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.3)",padding:"3rem 0"}}>No tenés operaciones todavía.</p>}
  </div>;
}
function OperationDetail({op,token,onBack}){
  const [items,setItems]=useState([]);const [events,setEvents]=useState([]);const [pkgs,setPkgs]=useState([]);const [pmts,setPmts]=useState([]);const [loading,setLoading]=useState(true);const [expItem,setExpItem]=useState(null);const [openSections,setOpenSections]=useState({});
  const toggleSection=(s)=>setOpenSections(p=>({...p,[s]:!p[s]}));
  const loadAll=async()=>{const [it,ev,pk,pm]=await Promise.all([dq("operation_items",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`}),dq("tracking_events",{token,filters:`?operation_id=eq.${op.id}&select=*&order=occurred_at.desc`}),dq("operation_packages",{token,filters:`?operation_id=eq.${op.id}&select=*&order=package_number.asc`}),dq("payment_management",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`})]);setItems(Array.isArray(it)?it:[]);setEvents(Array.isArray(ev)?ev:[]);setPkgs(Array.isArray(pk)?pk:[]);setPmts(Array.isArray(pm)?pm:[]);setLoading(false);};
  useEffect(()=>{loadAll();let last=Date.now();const onFocus=()=>{if(document.visibilityState==="visible"&&Date.now()-last>5000){last=Date.now();loadAll();}};document.addEventListener("visibilitychange",onFocus);window.addEventListener("focus",onFocus);return()=>{document.removeEventListener("visibilitychange",onFocus);window.removeEventListener("focus",onFocus);};},[op.id,token]);
  const st=SM[op.status]||{l:op.status,c:"#999"};const isA=op.channel?.includes("aereo");
  return <div>
    <button onClick={onBack} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,marginBottom:20,padding:0}}>← VOLVER</button>
    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.5rem",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <span style={{fontSize:14,fontWeight:700,color:"#fff",fontFamily:"monospace",padding:"5px 12px",background:"rgba(255,255,255,0.08)",borderRadius:6,border:"1px solid rgba(255,255,255,0.15)"}}>{op.operation_code}</span>
        <span style={{fontSize:12,fontWeight:700,padding:"5px 14px",borderRadius:6,color:st.c,border:`1px solid ${st.c}33`,background:`${st.c}15`}}>● {st.l}</span>
        {op.eta&&op.status!=="entregada"&&<span style={{fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:6,color:"rgba(255,255,255,0.6)",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)"}}>ETA: {formatDate(op.eta)}</span>}
      </div>
      <h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 12px",textTransform:"uppercase"}}>{op.description}</h2>
      <OpProgress status={op.status} isAereo={isA}/>
      {(()=>{const totGW=pkgs.reduce((s,p)=>s+Number(p.gross_weight_kg||0),0);const totCBM=pkgs.reduce((s,p)=>{const l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);return s+(l&&w&&h?(l*w*h)/1000000:0);},0);let pf=0;pkgs.forEach(p=>{const gw=Number(p.gross_weight_kg||0);const l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);const vw=l&&w&&h?(l*w*h)/5000:0;pf+=Math.max(gw,vw);});
      return <div className="op-info" style={{display:"flex",gap:28,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:14,marginTop:4,flexWrap:"wrap"}}>
        {[{l:"Bultos",v:pkgs.length>0?pkgs.reduce((s,p)=>s+Number(p.quantity||1),0):op.total_quantity||"—"},{l:"Origen",v:op.origin||"China"},{l:"Canal",v:CM[op.channel]||"—"},
          ...(isA?[{l:"Peso Bruto",v:totGW?`${totGW.toFixed(1)} kg`:"—"},{l:"Peso Facturable",v:pf?`${pf.toFixed(1)} kg`:"—",a:true}]:[{l:"CBM",v:totCBM?`${totCBM.toFixed(4)} m³`:"—",a:true}]),
          {l:"Total a abonar",v:Number(op.budget_total||0)>0?`USD ${Number(op.budget_total).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"Pendiente",a:true}
        ].map((x,i)=><div key={i}><span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",textTransform:"uppercase"}}>{x.l}</span><p style={{fontSize:13,fontWeight:600,color:x.a?IC:"#fff",margin:"2px 0 0"}}>{x.v}</p></div>)}
      </div>;})()}
    </div>
    {!loading&&(()=>{const bt=Number(op.budget_total||0);const bTax=Number(op.budget_taxes||0);const bFlete=Number(op.budget_flete||0);const bSeg=Number(op.budget_seguro||0);const shipCost=op.shipping_to_door?Number(op.shipping_cost||0):0;const isB=op.channel?.includes("negro");const hasBudget=bt>0;
      // Pagos pendientes (cliente NO pagó todavía) - se suman al total a abonar
      const pmtsPendientes=pmts.filter(p=>!p.client_paid).reduce((s,p)=>s+Number(p.client_amount_usd||0),0);
      // Pagos ya pagados - se descuentan del total
      const pmtsPagados=pmts.filter(p=>p.client_paid).reduce((s,p)=>s+Number(p.client_amount_usd||0),0);
      const totalAbonar=bt+pmtsPendientes-pmtsPagados;
      const bRow=(l,v,bold,accent,color)=><div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",...(bold?{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:12}:{})}}><span style={{fontSize:13,color:bold?"#fff":"rgba(255,255,255,0.5)",fontWeight:bold?700:400}}>{l}</span><span style={{fontSize:13,fontWeight:bold?700:600,color:color||(accent?IC:bold?"#fff":"rgba(255,255,255,0.8)")}}>{v<0?"-":""}USD {Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>;
      return <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.25rem 1.5rem",marginBottom:16}}>
      <button onClick={()=>toggleSection("budget")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:openSections.budget?14:0}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>PRESUPUESTO</h3><span style={{color:"rgba(255,255,255,0.3)",fontSize:14}}>{openSections.budget?"▲":"▼"}</span></button>
      {openSections.budget&&hasBudget?<div>
        {!isB&&bTax>0&&bRow("Total Impuestos",bTax)}
        {bFlete>0&&bRow(isB?"Servicio Integral ARGENCARGO":"Flete internacional",bFlete)}
        {!isB&&bSeg>0&&bRow("Seguro de carga",bSeg)}
        {shipCost>0&&bRow("Envío a Domicilio",shipCost)}
        {pmtsPendientes>0&&bRow("Gestión de pagos (pendiente)",pmtsPendientes,false,false,"#fb923c")}
        {pmtsPagados>0&&bRow("Anticipado en gestión de pagos",-pmtsPagados,false,false,"#22c55e")}
        {bRow(pmtsPagados>0?"Saldo a abonar":"A abonar a Argencargo",totalAbonar,true,true)}
      </div>:openSections.budget?<p style={{fontSize:13,color:"rgba(255,255,255,0.3)",margin:0}}>Presupuesto pendiente de confirmación</p>:null}
    </div>;})()}
    {!loading&&items.length>0&&<div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.25rem 1.5rem",marginBottom:16}}>
      <button onClick={()=>toggleSection("products")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:openSections.products?14:0}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>PRODUCTOS ({items.length})</h3><span style={{color:"rgba(255,255,255,0.3)",fontSize:14}}>{openSections.products?"▲":"▼"}</span></button>
      {openSections.products&&items.map((it,i)=>{const fob=Number(it.unit_price_usd||0)*Number(it.quantity||1);const exp=expItem===it.id;return <div key={it.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.05)":"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0"}}><div style={{flex:1}}><p style={{fontSize:14,color:"#fff",margin:0,fontWeight:500}}>{it.description}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.3)",margin:"2px 0 0"}}>{it.quantity} unidades</p></div>
          <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{textAlign:"right"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",margin:"0 0 2px"}}>VALOR FOB</p><p style={{fontSize:15,fontWeight:700,color:"#fff",margin:0}}>USD {fob.toLocaleString("en-US")}</p></div>
            <button onClick={()=>setExpItem(exp?null:it.id)} style={{fontSize:11,fontWeight:600,color:IC,background:"rgba(74,144,217,0.1)",border:"1px solid rgba(74,144,217,0.2)",borderRadius:6,padding:"6px 12px",cursor:"pointer",whiteSpace:"nowrap"}}>{exp?"Ocultar ▲":"Desglose ▼"}</button></div></div>
        {exp&&(()=>{const isB=op.channel?.includes("negro");const isAer=op.channel?.includes("aereo");const isMar=op.channel?.includes("maritimo");const dr=(l,rate,amt)=><div style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{l}{rate!=null?` (${rate}%)`:""}</span><span style={{fontSize:12,fontWeight:600,color:amt!=null?"#fff":"rgba(255,255,255,0.5)"}}>{amt!=null?`USD ${amt.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"A confirmar"}</span></div>;const taxRows=[];if(!isB){const rr=(label,rate)=>{const amt=rate!=null?fob*(Number(rate)/100):null;taxRows.push({l:label,r:rate,a:amt});};rr("Derechos de Importación",it.import_duty_rate);rr("Tasa de Estadística",it.statistics_rate);rr("IVA",it.iva_rate);if(isAer&&op.channel==="aereo_blanco"){
  // Calcular gasto documental: desembolso por CIF total, distribuido proporcionalmente
  const totalFob=items.reduce((s,x)=>s+Number(x.unit_price_usd||0)*Number(x.quantity||1),0);
  const pct=totalFob>0?fob/totalFob:1;
  let pf=0;pkgs.forEach(p=>{const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);pf+=Math.max(gw*q,l&&w&&h?((l*w*h)/5000)*q:0);});
  const certFl=pf*3.5;const cif=(totalFob+certFl)*1.01;
  const desemb=((c)=>{const t=[[5,0],[9,36],[20,50],[50,58],[100,65],[400,72],[800,84],[1000,96],[Infinity,120]];for(const[max,amt]of t)if(c<max)return amt;return 120;})(cif);
  const propDesemb=desemb*pct;const ivaD=propDesemb*0.21;
  taxRows.push({l:"Gasto Documental Aduana",r:null,a:propDesemb+ivaD});
}if(isMar&&op.channel==="maritimo_blanco"){rr("IVA Adicional",it.iva_additional_rate);rr("I.I.G.G.",it.iigg_rate);rr("I.I.B.B.",it.iibb_rate);}}const totalItemTax=taxRows.reduce((s,r)=>s+(r.a||0),0);return <div style={{padding:"0 0 12px",marginLeft:16}}><div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"12px 16px",border:"1px solid rgba(255,255,255,0.05)"}}>
          {taxRows.map((r,ri)=><div key={ri}>{dr(r.l,r.r,r.a)}</div>)}
          {!isB&&taxRows.length>0&&<div style={{borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,fontWeight:700,color:"#fff"}}>Total Impuestos</span><span style={{fontSize:12,fontWeight:700,color:IC}}>USD {totalItemTax.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>}
        </div></div>;})()}
      </div>;})}
    </div>}
    {!loading&&pkgs.length>0&&(()=>{const isAer=op.channel?.includes("aereo");const isMar=op.channel?.includes("maritimo");const pkData=pkgs.map(pk=>{const l=Number(pk.length_cm||0),w=Number(pk.width_cm||0),h=Number(pk.height_cm||0),gw=Number(pk.gross_weight_kg||0);const vw=l&&w&&h?(l*w*h)/5000:0;const cbm=l&&w&&h?(l*w*h)/1000000:0;return{...pk,l,w,h,gw,vw,cbm};});const totGW=pkData.reduce((s,p)=>s+p.gw,0);const totVW=pkData.reduce((s,p)=>s+p.vw,0);const totCBM=pkData.reduce((s,p)=>s+p.cbm,0);let pf=0;pkData.forEach(p=>{pf+=Math.max(p.gw,p.vw);});const dd=(label,val)=><div style={{textAlign:"center"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px",textTransform:"uppercase"}}>{label}</p><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}>{val}</p></div>;return <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.25rem 1.5rem",marginBottom:16}}>
      <button onClick={()=>toggleSection("packages")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:openSections.packages?14:0}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>BULTOS ({pkgs.length})</h3><span style={{color:"rgba(255,255,255,0.3)",fontSize:14}}>{openSections.packages?"▲":"▼"}</span></button>
      {openSections.packages&&pkData.map((pk,i)=><div key={pk.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.05)":"none",padding:"14px 0"}}>
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
      </div>)}
      {openSections.packages&&<div style={{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:14,display:"flex",gap:28,flexWrap:"wrap",alignItems:"center"}}>
        {isAer&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px",textTransform:"uppercase"}}>Peso Facturable</p><p style={{fontSize:16,fontWeight:700,color:IC,margin:0}}>{pf.toFixed(2)} kg</p></div>}
        {isMar&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px",textTransform:"uppercase"}}>CBM Total</p><p style={{fontSize:16,fontWeight:700,color:IC,margin:0}}>{totCBM.toFixed(4)} m³</p></div>}
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px",textTransform:"uppercase"}}>Peso Bruto Total</p><p style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.6)",margin:0}}>{totGW.toFixed(2)} kg</p></div>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px",textTransform:"uppercase"}}>Peso Vol. Total</p><p style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.6)",margin:0}}>{totVW.toFixed(2)} kg</p></div>
      </div>}
    </div>})()}
    {!loading&&events.length>0&&<div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.25rem 1.5rem"}}>
      <button onClick={()=>toggleSection("tracking")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:openSections.tracking?14:0}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>SEGUIMIENTO ({events.length})</h3><span style={{color:"rgba(255,255,255,0.3)",fontSize:14}}>{openSections.tracking?"▲":"▼"}</span></button>
      {openSections.tracking&&<div style={{position:"relative",paddingLeft:24}}><div style={{position:"absolute",left:7,top:8,bottom:8,width:2,background:"rgba(255,255,255,0.06)"}}/>
        {events.map((ev,i)=><div key={ev.id} style={{position:"relative",paddingBottom:i<events.length-1?20:0}}><div style={{position:"absolute",left:-19,top:6,width:12,height:12,borderRadius:"50%",background:i===0?IC:"rgba(255,255,255,0.1)",boxShadow:i===0?"0 0 0 4px rgba(96,165,250,0.2)":"none"}}/><div><div style={{display:"flex",justifyContent:"space-between"}}><p style={{fontSize:14,fontWeight:600,color:i===0?"#fff":"rgba(255,255,255,0.4)",margin:0}}>{ev.title}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.2)",margin:0,whiteSpace:"nowrap",marginLeft:12}}>{formatDate(ev.occurred_at)}</p></div>{ev.description&&<p style={{fontSize:13,color:"rgba(255,255,255,0.3)",margin:"3px 0 0"}}>{ev.description}</p>}{ev.location&&<p style={{fontSize:12,color:"rgba(255,255,255,0.2)",margin:"2px 0 0"}}>📍 {ev.location}</p>}</div></div>)}</div>}
    </div>}
    {!loading&&pmts.length>0&&<div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.25rem 1.5rem"}}>
      <button onClick={()=>toggleSection("payments")} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:0,marginBottom:openSections.payments?14:0}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>GESTIÓN DE PAGOS ({pmts.length})</h3><span style={{color:"rgba(255,255,255,0.3)",fontSize:14}}>{openSections.payments?"▲":"▼"}</span></button>
      {openSections.payments&&pmts.map((pm,i)=>{const gs={pendiente:{l:"Pendiente",c:"#fbbf24"},enviado:{l:"Enviado",c:"#60a5fa"},confirmado:{l:"Confirmado",c:"#22c55e"}}[pm.giro_status]||{l:pm.giro_status,c:"#999"};return <div key={pm.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.05)":"none",padding:"14px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:600,color:"#fff"}}>{pm.description||`Pago ${i+1}`}</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:pm.client_paid?"#22c55e":"#fbbf24",background:pm.client_paid?"rgba(34,197,94,0.15)":"rgba(251,191,36,0.15)"}}>{pm.client_paid?"Pagado":"Pago pendiente"}</span>
            <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:gs.c,background:`${gs.c}15`,border:`1px solid ${gs.c}33`}}>Giro: {gs.l}</span>
          </div>
        </div>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>MONTO</p><p style={{fontSize:14,fontWeight:600,color:IC,margin:0}}>USD {Number(pm.client_amount_usd).toLocaleString("en-US",{minimumFractionDigits:2})}</p></div>
          {pm.client_paid_date&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>FECHA PAGO</p><p style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.6)",margin:0}}>{formatDate(pm.client_paid_date)}</p></div>}
          {pm.giro_date&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>FECHA GIRO</p><p style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.6)",margin:0}}>{formatDate(pm.giro_date)}</p></div>}
        </div>
      </div>;})}
    </div>}
    {loading&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.3)",padding:"2rem 0"}}>Cargando...</p>}
  </div>;
}
function ProfilePage({client}){if(!client)return null;const f=[{l:"Nombre",v:`${client.first_name} ${client.last_name}`},{l:"Código",v:client.client_code,m:true},{l:"Email",v:client.email},{l:"WhatsApp",v:client.whatsapp},{l:"Dirección",v:`${client.street}${client.floor_apt?`, ${client.floor_apt}`:""}`},{l:"Localidad",v:`${client.city}, ${client.province}`},{l:"CP",v:client.postal_code},{l:"IVA",v:client.tax_condition==="responsable_inscripto"?"Resp. Inscripto":client.tax_condition==="monotributista"?"Monotributista":"Consumidor final"}];return <div><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 24px"}}>MI PERFIL</h2><div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.5rem"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>{f.map((x,i)=><div key={i}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 4px",textTransform:"uppercase"}}>{x.l}</p><p style={{fontSize:15,color:"#fff",margin:0,fontWeight:500,...(x.m?{fontFamily:"monospace",fontSize:18,color:IC}:{})}}>{x.v}</p></div>)}</div></div><div style={{background:"rgba(74,144,217,0.06)",borderRadius:12,border:"1px solid rgba(74,144,217,0.12)",padding:"16px 20px",marginTop:16}}><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>📦 Tu código es <strong style={{color:IC,fontFamily:"monospace"}}>{client.client_code}</strong>. Incluilo en todos los paquetes.</p></div></div>;}
const SERVICES_C=[{key:"aereo_a_china",label:"Aéreo Courier Comercial — China",info:"Demora 7-10 días hábiles",unit:"kg"},{key:"aereo_b_usa",label:"Aéreo Integral AC — USA",info:"Demora 48-72 hs hábiles",unit:"kg"},{key:"aereo_b_china",label:"Aéreo Integral AC — China",info:"Demora 10-15 días hábiles",unit:"kg"},{key:"maritimo_a_china",label:"Marítimo Carga LCL/FCL — China",unit:"cbm",info:""},{key:"maritimo_b",label:"Marítimo Integral AC",unit:"cbm",info:""}];
function RatesPage({token,client}){
  const [tariffs,setTariffs]=useState([]);const [overrides,setOverrides]=useState([]);const [lo,setLo]=useState(true);
  useEffect(()=>{(async()=>{const [t,ov]=await Promise.all([dq("tariffs",{token,filters:"?select=*&order=service_key.asc,sort_order.asc"}),client?dq("client_tariff_overrides",{token,filters:`?client_id=eq.${client.id}&select=*`}):Promise.resolve([])]);setTariffs(Array.isArray(t)?t:[]);setOverrides(Array.isArray(ov)?ov:[]);setLo(false);})();},[token,client?.id]);
  const getRate=(t)=>{const ov=overrides.find(o=>o.tariff_id===t.id);return ov?{rate:ov.custom_rate,promo:true,base:t.rate}:{rate:t.rate,promo:false,base:t.rate};};
  const hideRanges=svc=>svc==="maritimo_b";
  if(lo)return <p style={{color:"rgba(255,255,255,0.3)",textAlign:"center",padding:"2rem 0"}}>Cargando...</p>;
  return <div><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 24px"}}>TARIFAS</h2>
    {SERVICES_C.map(svc=>{const rates=tariffs.filter(t=>t.service_key===svc.key&&t.type==="rate");const specials=tariffs.filter(t=>t.service_key===svc.key&&t.type==="special");if(!rates.length)return null;
    return <div key={svc.key} style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.25rem 1.5rem",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h3 style={{fontSize:15,fontWeight:700,color:"#fff",margin:0}}>{svc.label}</h3>{svc.info&&<span style={{fontSize:11,color:"rgba(255,255,255,0.35)",padding:"4px 10px",background:"rgba(255,255,255,0.05)",borderRadius:6}}>{svc.info}</span>}</div>
      {hideRanges(svc.key)?<div style={{textAlign:"center",padding:"16px 0"}}><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 8px"}}>Las tarifas de este servicio varían según el volumen.</p><p style={{fontSize:14,fontWeight:600,color:IC,margin:0}}>Consultanos para obtener una cotización personalizada</p></div>:
      <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
        {rates.map(t=>{const{rate,promo,base}=getRate(t);return <tr key={t.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}><td style={{padding:"10px 0",fontSize:13,color:"rgba(255,255,255,0.6)"}}>{t.label}</td><td style={{padding:"10px 0",textAlign:"right",fontSize:14,fontWeight:700,color:promo?IC:"#fff"}}>{promo&&<span style={{fontSize:12,color:"rgba(255,255,255,0.3)",textDecoration:"line-through",marginRight:8}}>${Number(base).toLocaleString("en-US")}</span>}${Number(rate).toLocaleString("en-US")} / {svc.unit}{promo&&<span style={{fontSize:10,marginLeft:8,padding:"2px 6px",borderRadius:4,background:"rgba(96,165,250,0.15)",color:IC}}>PROMO</span>}</td></tr>;})}
      </tbody></table>}
      {specials.length>0&&<div style={{borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:8,paddingTop:10}}>{specials.map(s=><div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{s.label}</span><span style={{fontSize:12,fontWeight:600,color:"#fff"}}>${Number(s.rate).toLocaleString("en-US")} / {svc.unit}{s.notes&&<span style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginLeft:8}}>{s.notes}</span>}</span></div>)}</div>}
    </div>;})}
  </div>;
}
function CalculatorPage({token,client}){
  const [step,setStep]=useState(0);const [origin,setOrigin]=useState("");
  // USA flow
  const [products,setProducts]=useState([{type:"general",description:"",unit_price:"",quantity:"1",ncm:null,ncmLoading:false,ncmError:false}]);
  const [pkgs,setPkgs]=useState([{qty:"1",length:"",width:"",height:"",weight:""}]);const [noDims,setNoDims]=useState(false);const clientAutoZone=(()=>{if(!client)return"oficina";const c=(client.city||"").toLowerCase();const p=(client.province||"").toLowerCase();if(c.includes("capital")||c.includes("caba")||p.includes("capital")||p==="caba")return"caba";if(p.includes("buenos aires")||c.includes("buenos aires"))return"gba";return"oficina";})();const [delivery,setDelivery]=useState(clientAutoZone);
  const [hasBattery,setHasBattery]=useState(false);const [expandedCh,setExpandedCh]=useState(null);
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

    // Aéreo Courier Comercial (A) — peso facturable (max bruto/vol)
    if(facturable>0){const fleteRate=getFleteRate("aereo_a_china",facturable);const flete=facturable*fleteRate;
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

    // Marítimo Carga LCL/FCL (A) — SIEMPRE ficticio
    if(!noDims&&totCBM>0){const cbmFact=Math.max(totCBM,1);const fleteRate=getFleteRate("maritimo_a_china",cbmFact);const flete=cbmFact*fleteRate;
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
    return encodeURIComponent(`Hola Bautista! Acabo de cotizar una importación y quiero avanzar con la operación!\n\nOrigen: *${origin}* ${flag}\nMercadería: *${prodSummary}*\n\nTipo de envío: *${ch.name}*\n\nValor Total: *${usdF(totalFob)}*\n${isAereo?`Peso Total: *${totWeight.toFixed(2)} kg*`:`CBM Total: *${totCBM.toFixed(4)} m³*`}\nEntrega en Destino: *${autoDelivLabel}*\n\nCódigo cliente: *${code}*`);};

  const usd=v=>`USD ${v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const row=(l,v,bold,accent)=><div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",...(bold?{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:8}:{})}}><span style={{fontSize:12,color:bold?"#fff":"rgba(255,255,255,0.45)",fontWeight:bold?700:400}}>{l}</span><span style={{fontSize:12,fontWeight:bold?700:600,color:accent?IC:bold?"#fff":"rgba(255,255,255,0.7)"}}>{usd(v)}</span></div>;

  const steps=origin==="USA"?[{n:1,l:"Productos"},{n:2,l:"Packing List"},{n:3,l:"Entrega"},{n:4,l:"Resultados"}]:[{n:1,l:"Productos"},{n:2,l:"Packing List"},{n:3,l:"Entrega"},{n:4,l:"Resultados"}];

  return <div><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>CALCULADORA DE IMPORTACIÓN</h2><p style={{fontSize:13,color:"rgba(255,255,255,0.35)",margin:"0 0 24px"}}>Calculá el costo total de tu importación</p>
    {step>0&&<div style={{display:"flex",gap:8,marginBottom:20,alignItems:"center"}}><div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:8,marginRight:8}}><span style={{fontSize:14}}>{origin==="China"?"\ud83c\udde8\ud83c\uddf3":"\ud83c\uddfa\ud83c\uddf8"}</span><span style={{fontSize:12,fontWeight:600,color:IC}}>{origin}</span></div>{steps.map(s=><div key={s.n} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,background:step>=s.n?"rgba(96,165,250,0.2)":"rgba(255,255,255,0.05)",color:step>=s.n?IC:"rgba(255,255,255,0.2)",border:`1.5px solid ${step>=s.n?IC:"rgba(255,255,255,0.08)"}`}}>{s.n}</div><span style={{fontSize:12,fontWeight:600,color:step>=s.n?"#fff":"rgba(255,255,255,0.25)"}}>{s.l}</span>{s.n<steps.length&&<span style={{color:"rgba(255,255,255,0.1)",margin:"0 4px"}}>—</span>}</div>)}</div>}

    {step===0&&<div style={{display:"flex",gap:24,justifyContent:"center",padding:"2rem 0"}}>{[{k:"China",flag:"\ud83c\udde8\ud83c\uddf3"},{k:"USA",flag:"\ud83c\uddfa\ud83c\uddf8"}].map(c=><div key={c.k} onClick={()=>{setOrigin(c.k);setStep(1);}} style={{width:200,padding:"2.5rem 1.5rem",background:"rgba(255,255,255,0.03)",border:"1.5px solid rgba(255,255,255,0.08)",borderRadius:16,cursor:"pointer",textAlign:"center"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=IC;e.currentTarget.style.background="rgba(96,165,250,0.08)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.background="rgba(255,255,255,0.03)";}}><p style={{fontSize:52,margin:"0 0 16px"}}>{c.flag}</p><p style={{fontSize:20,fontWeight:700,color:"#fff",margin:0}}>{c.k}</p></div>)}</div>}

    {/* USA FLOW - Step 1: Products */}
    {step===1&&origin==="USA"&&<div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 16px"}}>PRODUCTOS</h3>
      {products.map((p,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Producto {i+1}</span>{products.length>1&&<button onClick={()=>rmProduct(i)} style={{fontSize:11,padding:"4px 10px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>Eliminar</button>}</div>
        <div style={{display:"flex",gap:12,marginBottom:12}}>{[{k:"general",l:"Carga General"},{k:"celulares",l:"Celulares"}].map(t=><div key={t.k} onClick={()=>chProd(i,"type",t.k)} style={{flex:1,padding:"14px",textAlign:"center",borderRadius:10,border:`1.5px solid ${p.type===t.k?IC:"rgba(255,255,255,0.08)"}`,background:p.type===t.k?"rgba(96,165,250,0.1)":"rgba(255,255,255,0.03)",cursor:"pointer"}}><p style={{fontSize:14,fontWeight:600,color:p.type===t.k?IC:"rgba(255,255,255,0.5)",margin:0}}>{t.l}</p></div>)}</div>
        {p.type==="general"&&<Inp label="Descripción de la mercadería" value={p.description} onChange={v=>chProd(i,"description",v)} placeholder="Ej: Fundas de silicona para celular"/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Precio unitario (USD)" type="number" value={p.unit_price} onChange={v=>chProd(i,"unit_price",v)} placeholder="Ej: 3.50"/><Inp label="Cantidad" type="number" value={p.quantity} onChange={v=>chProd(i,"quantity",v)} placeholder="1"/></div>
      </div>)}
      <button onClick={addProduct} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar otro producto</button>
      {totalFob>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:12,marginTop:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Valor total mercadería</span><span style={{fontSize:16,fontWeight:700,color:IC}}>{usd(totalFob)}</span></div>}
      <div style={{display:"flex",gap:12,marginTop:16}}><button onClick={()=>{setStep(0);setOrigin("");}} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Cambiar origen</button><button onClick={()=>setStep(2)} disabled={!products.some(p=>Number(p.unit_price)>0)} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${B.accent},${B.primary})`,color:"#fff",opacity:products.some(p=>Number(p.unit_price)>0)?1:0.4}}>Siguiente →</button></div>
    </div>}

    {/* USA FLOW - Step 2: Packing List */}
    {step===2&&origin==="USA"&&<div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 16px"}}>PACKING LIST</h3>
      {pkgs.map((pk,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Bulto {i+1}</span>{pkgs.length>1&&<button onClick={()=>rmPkg(i)} style={{fontSize:11,padding:"4px 10px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>Eliminar</button>}</div>
        <div className="grid-5" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:"0 10px"}}>
          <Inp label="Cant. bultos" type="number" value={pk.qty} onChange={v=>chPkg(i,"qty",v)} placeholder="1"/>
          {!noDims&&<><Inp label="Largo (cm)" type="number" value={pk.length} onChange={v=>chPkg(i,"length",v)} placeholder="60"/><Inp label="Ancho (cm)" type="number" value={pk.width} onChange={v=>chPkg(i,"width",v)} placeholder="40"/><Inp label="Alto (cm)" type="number" value={pk.height} onChange={v=>chPkg(i,"height",v)} placeholder="35"/></>}
          <Inp label="Peso (kg)" type="number" value={pk.weight} onChange={v=>chPkg(i,"weight",v)} placeholder="12"/>
        </div>
      </div>)}
      <button onClick={addPkg} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar otro bulto</button>
      <div style={{marginTop:16,marginBottom:8}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={noDims} onChange={e=>setNoDims(e.target.checked)}/><span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Desconozco las medidas de las cajas</span></label>{noDims&&<div style={{background:"rgba(251,146,60,0.1)",border:"1px solid rgba(251,146,60,0.25)",borderRadius:8,padding:"10px 14px",marginTop:8}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>Sin las medidas de las cajas no es posible calcular el costo marítimo. Solo se cotizará el envío aéreo.</p></div>}</div>
      {(()=>{const{totWeight,totCBM}=calcTotals();return totWeight>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:12,marginTop:12,display:"flex",gap:20,flexWrap:"wrap"}}><div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:14,fontWeight:700,color:IC,margin:0}}>{totWeight.toFixed(2)} kg</p></div>{!noDims&&totCBM>0&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",margin:"0 0 2px"}}>CBM</p><p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>{totCBM.toFixed(4)} m³</p></div>}</div>;})()}
      <div style={{display:"flex",gap:12,marginTop:16}}><button onClick={()=>setStep(1)} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Atrás</button><button onClick={()=>setStep(3)} disabled={!pkgs.some(p=>Number(p.weight)>0)} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${B.accent},${B.primary})`,color:"#fff",opacity:pkgs.some(p=>Number(p.weight)>0)?1:0.4}}>Siguiente →</button></div>
    </div>}

    {/* USA FLOW - Step 3: Delivery */}
    {step===3&&origin==="USA"&&(()=>{const{totWeight}=calcTotals();const shipOpts=[{k:"oficina",l:"Retiro por Oficina",sub:"Gratis"},{k:"caba",l:"Envío CABA",sub:`USD ${getShipCost("caba",totWeight)}`},{k:"gba",l:"Envío GBA",sub:`USD ${getShipCost("gba",totWeight)}`}];return <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 16px"}}>ENTREGA EN DESTINO</h3>
      {clientZone&&<div style={{background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.12)",borderRadius:10,padding:"10px 14px",marginBottom:14}}><p style={{fontSize:12,color:IC,margin:0,fontWeight:500}}>Tu dirección registrada es de <strong>{clientZone==="caba"?"CABA":"GBA"}</strong> — seleccionamos envío automáticamente</p></div>}
      <div style={{display:"flex",gap:12,marginBottom:20}}>{shipOpts.map(d=><div key={d.k} onClick={()=>setDelivery(d.k)} style={{flex:1,padding:"16px",textAlign:"center",borderRadius:12,border:`1.5px solid ${delivery===d.k?IC:"rgba(255,255,255,0.08)"}`,background:delivery===d.k?"rgba(96,165,250,0.1)":"rgba(255,255,255,0.03)",cursor:"pointer"}}><p style={{fontSize:15,fontWeight:700,color:delivery===d.k?IC:"rgba(255,255,255,0.6)",margin:"0 0 4px"}}>{d.l}</p><p style={{fontSize:13,fontWeight:600,color:delivery===d.k?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.35)",margin:0}}>{d.sub}</p></div>)}</div>
      {delivery==="oficina"&&<div style={{background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.12)",borderRadius:10,padding:"14px 18px",marginBottom:16}}><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>Nuestras Oficinas</p><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"0 0 4px"}}>Av. Callao 1137, CABA — Lunes a Viernes de 9:00 a 19:00 hs</p><p style={{fontSize:14,color:"#22c55e",margin:0,fontWeight:600}}>Se puede abonar al momento de retirar</p></div>}
      {(delivery==="caba"||delivery==="gba")&&<div style={{background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:10,padding:"14px 18px",marginBottom:16}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>Para envíos a domicilio, la carga debe abonarse previamente antes de ser despachada. Sin excepción.</p></div>}
      <div style={{display:"flex",gap:12,marginTop:8}}><button onClick={()=>setStep(2)} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Atrás</button><button onClick={calculateUSA} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${B.accent},${B.primary})`,color:"#fff"}}>Calcular costos →</button></div>
    </div>;})()}

    {/* USA FLOW - Step 4: Results */}
    {step===4&&origin==="USA"&&results&&<div>
      <div style={{display:"flex",gap:12,marginBottom:16}}><button onClick={()=>setStep(3)} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button><span style={{color:"rgba(255,255,255,0.1)"}}>|</span><button onClick={()=>{setStep(0);setResults(null);setOrigin("");setProducts([{type:"general",description:"",unit_price:"",quantity:"1"}]);setPkgs([{qty:"1",length:"",width:"",height:"",weight:""}]);setNoDims(false);setDelivery("oficina");}} style={{fontSize:13,color:"rgba(255,255,255,0.4)",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>Nueva cotización</button></div>
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:14,marginBottom:20,display:"flex",gap:24,flexWrap:"wrap"}}>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>VALOR MERCADERÍA</p><p style={{fontSize:15,fontWeight:700,color:"#fff",margin:0}}>{usd(totalFob)}</p></div>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{results.totWeight.toFixed(2)} kg</p></div>
        {results.totCBM>0&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>CBM</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{results.totCBM.toFixed(4)} m³</p></div>}
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>ENTREGA</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{DELIV[delivery]}</p></div>
      </div>
      <div className="grid-2" style={{display:"grid",gridTemplateColumns:results.channels.length>1?"1fr 1fr":"1fr",gap:20}}>{results.channels.map(ch=>{const isAereo=ch.key?.includes("aereo");const delivCost=getShipCost(delivery,calcTotals().totWeight);const total=ch.noCalc?0:ch.total+delivCost;
      return <div key={ch.key} style={{background:"rgba(255,255,255,0.03)",borderRadius:16,border:`1.5px solid ${ch.key==="aereo_b_usa"?"rgba(251,146,60,0.4)":"rgba(255,255,255,0.07)"}`,padding:"1.5rem",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>{isAereo?"✈️":"🚢"}</span><p style={{fontSize:20,fontWeight:700,color:"#fff",margin:0}}>{ch.name}</p></div>
          {ch.key==="aereo_b_usa"&&<span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:8,background:"rgba(251,146,60,0.15)",color:"#fb923c",border:"1px solid rgba(251,146,60,0.3)"}}>⚡ 48-72 hs</span>}
        </div>
        {ch.noCalc?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem 0"}}><p style={{fontSize:13,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>No se puede calcular sin las medidas de las cajas</p></div>:<>
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"20px",marginBottom:16,textAlign:"center"}}>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",textTransform:"uppercase"}}>Costo de importación</p>
          <p style={{fontSize:32,fontWeight:700,color:"#fff",margin:0}}>{usd(total)}</p>
        </div>
        <button onClick={()=>setExpandedCh(expandedCh===ch.key?null:ch.key)} style={{width:"100%",padding:"12px",fontSize:13,fontWeight:600,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",cursor:"pointer",color:"rgba(255,255,255,0.5)",marginBottom:12}}>Ver desglose detallado ▼</button>
        </>}
        {!ch.noCalc&&<button onClick={()=>saveQuote(ch,true)} style={{width:"100%",padding:"12px",fontSize:13,fontWeight:600,borderRadius:10,border:"1.5px solid rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.08)",color:IC,cursor:"pointer",marginBottom:10}}>{savedMsg===ch.key?"✓ Guardada":"💾 Guardar cotización"}</button>}
        <a href={`https://wa.me/5491125088580?text=${makeWAMsg(ch)}`} onClick={()=>saveQuote(ch)} target="_blank" rel="noopener noreferrer" style={{display:"block",width:"100%",padding:"14px",fontSize:14,fontWeight:700,borderRadius:12,border:"none",cursor:ch.noCalc?"not-allowed":"pointer",background:ch.noCalc?"rgba(255,255,255,0.04)":`linear-gradient(135deg,#25D366,#128C7E)`,color:ch.noCalc?"rgba(255,255,255,0.2)":"#fff",textAlign:"center",textDecoration:"none",boxSizing:"border-box",pointerEvents:ch.noCalc?"none":"auto"}}>Avanzar con esta importación →</a>
      </div>})}</div>
      {/* USA Modal desglose */}
      {expandedCh&&results.channels.find(c=>c.key===expandedCh)&&(()=>{const mc=results.channels.find(c=>c.key===expandedCh);const delivCost=getShipCost(delivery,calcTotals().totWeight);const total=mc.total+delivCost;
      return <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setExpandedCh(null)}>
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}}/>
        <div style={{position:"relative",maxWidth:500,width:"90%",background:"#0a1428",borderRadius:20,border:"1px solid rgba(255,255,255,0.1)",padding:"2rem",boxShadow:"0 30px 60px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <h3 style={{fontSize:20,fontWeight:700,color:"#fff",margin:0}}>{mc.name}</h3>
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
    {step===1&&origin==="China"&&<div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.5rem"}}>
      <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 20px"}}>¿Tu producto contiene batería interna?</h3>
      <div style={{display:"flex",gap:12,marginBottom:12}}>{[{k:true,icon:"⚡",l:"Sí, tiene batería",sub:"Recargable / Litio"},{k:false,icon:"✓",l:"No tiene batería",sub:"Producto estándar"}].map(o=><div key={String(o.k)} onClick={()=>setHasBattery(o.k)} style={{flex:1,padding:"20px",textAlign:"center",borderRadius:12,border:`1.5px solid ${hasBattery===o.k?IC:"rgba(255,255,255,0.08)"}`,background:hasBattery===o.k?"rgba(96,165,250,0.1)":"rgba(255,255,255,0.03)",cursor:"pointer"}}><p style={{fontSize:24,margin:"0 0 8px"}}>{o.icon}</p><p style={{fontSize:14,fontWeight:700,color:hasBattery===o.k?IC:"rgba(255,255,255,0.6)",margin:"0 0 4px"}}>{o.l}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.35)",margin:0}}>{o.sub}</p></div>)}</div>
      {hasBattery&&<div style={{background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:10,padding:"12px 16px",marginBottom:20}}><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>Productos con batería interna (ej: auriculares bluetooth, power banks, smartwatch) son mercadería peligrosa y deben despacharse desde <strong style={{color:IC}}>Hong Kong</strong>. Recargo de <strong style={{color:IC}}>$2/kg</strong>.</p></div>}

      <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"20px 0 16px"}}>PRODUCTOS</h3>
      {products.map((p,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Producto {i+1}</span>{products.length>1&&<button onClick={()=>rmProduct(i)} style={{fontSize:11,padding:"4px 10px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>Eliminar</button>}</div>
        <div style={{marginBottom:14}}><label style={{display:"block",fontSize:13,fontWeight:700,color:"#fff",marginBottom:5}}>Descripción de la mercadería</label><div style={{display:"flex",gap:8}}><input value={p.description||""} onChange={e=>chProd(i,"description",e.target.value)} placeholder="Sé específico. Ej: Auriculares inalámbricos bluetooth" style={{flex:1,padding:"11px 14px",fontSize:14,border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.07)",color:"#fff",outline:"none"}} onFocus={e=>{e.target.style.borderColor=IC;}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";}}/><button onClick={()=>classifyProduct(i)} disabled={p.ncmLoading||!p.description?.trim()} style={{padding:"11px 16px",fontSize:12,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${B.accent},${B.primary})`,color:"#fff",whiteSpace:"nowrap",opacity:p.ncmLoading?0.6:1}}>{p.ncmLoading?"Clasificando...":"Clasificar"}</button></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><div style={{marginBottom:14}}><label style={{display:"block",fontSize:13,fontWeight:700,color:"#fff",marginBottom:5}}>Precio unitario (USD)</label><input type="number" value={p.unit_price||""} onChange={e=>chProd(i,"unit_price",e.target.value)} placeholder="Ej: 3.50" style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.07)",color:"#fff",outline:"none"}} onFocus={e=>{e.target.style.borderColor=IC;}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";}}/></div><div style={{marginBottom:14}}><label style={{display:"block",fontSize:13,fontWeight:700,color:"#fff",marginBottom:5}}>Cantidad</label><input type="number" value={p.quantity||""} onChange={e=>chProd(i,"quantity",e.target.value)} placeholder="1" style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.07)",color:"#fff",outline:"none"}} onFocus={e=>{e.target.style.borderColor=IC;}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";}}/></div></div>
        {p.ncm?.ncm_code&&<div style={{background:"rgba(96,165,250,0.06)",borderRadius:10,padding:"12px 16px",marginBottom:8,border:"1px solid rgba(96,165,250,0.12)",display:"flex",alignItems:"center",gap:12}}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><div><p style={{fontSize:11,fontFamily:"monospace",color:IC,margin:"0 0 4px",fontWeight:600}}>NCM: {p.ncm.ncm_code}</p><p style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Categoría: {p.ncm.ncm_description?.toUpperCase()||"MERCADERÍA GENERAL"}</p><div style={{display:"flex",gap:16}}><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>DERECHOS <strong style={{color:"#fff"}}>{p.ncm.import_duty_rate}%</strong></span><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}> T. ESTADÍSTICA <strong style={{color:"#fff"}}>{p.ncm.statistics_rate}%</strong></span><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}> IVA <strong style={{color:"#fff"}}>{p.ncm.iva_rate}%</strong></span></div></div></div>}
        {p.ncmError&&<div style={{background:"rgba(255,80,80,0.08)",borderRadius:10,padding:"12px 16px",marginBottom:8,border:"1px solid rgba(255,80,80,0.15)"}}><p style={{fontSize:13,color:"#ff6b6b",margin:"0 0 6px",fontWeight:600}}>No pudimos detectar tu mercadería automáticamente</p>
          <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
            <button onClick={()=>chProd(i,"ncm",{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:35,statistics_rate:3,iva_rate:21})} style={{fontSize:12,padding:"6px 14px",borderRadius:8,border:`1px solid ${IC}33`,background:"rgba(96,165,250,0.08)",color:IC,cursor:"pointer",fontWeight:600}}>Usar valores estimados (35% derechos)</button>
            <a href={`https://wa.me/5491125088580?text=${encodeURIComponent("Hola! Necesito ayuda para clasificar: "+p.description)}`} target="_blank" rel="noopener noreferrer" style={{fontSize:12,padding:"6px 14px",borderRadius:8,border:"1px solid rgba(34,197,94,0.3)",background:"rgba(34,197,94,0.08)",color:"#22c55e",cursor:"pointer",fontWeight:600,textDecoration:"none"}}>Consultar por WhatsApp</a>
          </div>
          <div style={{marginTop:10,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 8px"}}><div><label style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>Derechos %</label><input type="number" placeholder="35" onChange={e=>{const v=Number(e.target.value)||35;chProd(i,"ncm",{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:v,statistics_rate:p.ncm?.statistics_rate||3,iva_rate:p.ncm?.iva_rate||21});}} style={{width:"100%",padding:"6px 8px",fontSize:12,border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,background:"rgba(255,255,255,0.05)",color:"#fff",outline:"none",boxSizing:"border-box"}}/></div><div><label style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>TE %</label><input type="number" placeholder="3" onChange={e=>{const v=Number(e.target.value)||3;chProd(i,"ncm",{...p.ncm,ncm_code:"MANUAL",statistics_rate:v});}} style={{width:"100%",padding:"6px 8px",fontSize:12,border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,background:"rgba(255,255,255,0.05)",color:"#fff",outline:"none",boxSizing:"border-box"}}/></div><div><label style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>IVA %</label><input type="number" placeholder="21" onChange={e=>{const v=Number(e.target.value)||21;chProd(i,"ncm",{...p.ncm,ncm_code:"MANUAL",iva_rate:v});}} style={{width:"100%",padding:"6px 8px",fontSize:12,border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,background:"rgba(255,255,255,0.05)",color:"#fff",outline:"none",boxSizing:"border-box"}}/></div></div>
        </div>}
        {!p.ncm&&!p.ncmError&&!p.ncmLoading&&p.description?.trim()&&<div style={{marginBottom:8}}><button onClick={()=>chProd(i,"ncm",{ncm_code:"MANUAL",ncm_description:p.description,import_duty_rate:35,statistics_rate:3,iva_rate:21})} style={{fontSize:11,color:"rgba(255,255,255,0.3)",background:"none",border:"none",cursor:"pointer",padding:0}}>¿No querés clasificar? Usar valores estimados →</button></div>}
      </div>)}
      <button onClick={addProduct} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar otro producto</button>

      {totalFob>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:12,marginTop:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Valor total mercadería</span><span style={{fontSize:16,fontWeight:700,color:IC}}>{usd(totalFob)}</span></div>}
      <div style={{display:"flex",gap:12,marginTop:16}}><button onClick={()=>{setStep(0);setOrigin("");}} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Cambiar origen</button><button onClick={()=>{products.forEach((p,i)=>{if(Number(p.unit_price)>0&&!p.ncm)chProd(i,"ncm",{ncm_code:"DEFAULT",ncm_description:p.description||"Mercadería general",import_duty_rate:35,statistics_rate:3,iva_rate:21});});setStep(2);}} disabled={!products.some(p=>Number(p.unit_price)>0)} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${B.accent},${B.primary})`,color:"#fff",opacity:products.some(p=>Number(p.unit_price)>0)?1:0.4}}>Siguiente →</button></div>
    </div>}

    {/* CHINA FLOW - Step 2: Packing List */}
    {step===2&&origin==="China"&&<div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 16px"}}>PACKING LIST</h3>
      {pkgs.map((pk,i)=>{const q=Number(pk.qty||1),l=Number(pk.length||0),w=Number(pk.width||0),h=Number(pk.height||0),gw=Number(pk.weight||0);const bruto=gw*q;const vol=l&&w&&h?((l*w*h)/5000)*q:0;const isVol=vol>bruto&&!noDims;
      return <div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Bulto {i+1}</span>{pkgs.length>1&&<button onClick={()=>rmPkg(i)} style={{fontSize:11,padding:"4px 10px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>Eliminar</button>}</div>
        <div className="grid-5" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:"0 10px"}}>
          <Inp label="Cant. bultos" type="number" value={pk.qty} onChange={v=>chPkg(i,"qty",v)} placeholder="1"/>
          {!noDims&&<><Inp label="Largo (cm)" type="number" value={pk.length} onChange={v=>chPkg(i,"length",v)} placeholder="60"/><Inp label="Ancho (cm)" type="number" value={pk.width} onChange={v=>chPkg(i,"width",v)} placeholder="40"/><Inp label="Alto (cm)" type="number" value={pk.height} onChange={v=>chPkg(i,"height",v)} placeholder="35"/></>}
          <Inp label="Peso (kg)" type="number" value={pk.weight} onChange={v=>chPkg(i,"weight",v)} placeholder="12"/>
        </div>
        {(bruto>0||vol>0)&&<div style={{display:"flex",gap:16,marginTop:-4,marginBottom:4,fontSize:11,color:"rgba(255,255,255,0.3)"}}><span>Peso bruto total: <strong style={{color:"#fff"}}>{bruto.toFixed(1)} kg</strong></span>{!noDims&&vol>0&&<span>Peso volumétrico total: <strong style={{color:"#fff"}}>{vol.toFixed(1)} kg</strong></span>}</div>}
        {isVol&&<div style={{background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:8,padding:"8px 12px",marginBottom:4}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>Tené en cuenta que el peso volumétrico de este bulto es <strong>{vol.toFixed(1)} kg</strong> (mayor al bruto de {bruto.toFixed(1)} kg)</p></div>}
      </div>;})}
      <button onClick={addPkg} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar otro bulto</button>
      <div style={{marginTop:16,marginBottom:8}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={noDims} onChange={e=>setNoDims(e.target.checked)}/><span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Desconozco las medidas de las cajas</span></label>{noDims&&<div style={{background:"rgba(251,146,60,0.1)",border:"1px solid rgba(251,146,60,0.25)",borderRadius:8,padding:"10px 14px",marginTop:8}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>Sin las medidas no se pueden calcular los costos marítimos.</p></div>}</div>
      {(()=>{const{totWeight,totCBM}=calcTotals();let pf=0;pkgs.forEach(pk=>{const q=Number(pk.qty||1),l=Number(pk.length||0),w=Number(pk.width||0),h=Number(pk.height||0),gw=Number(pk.weight||0);pf+=Math.max(gw*q,l&&w&&h?((l*w*h)/5000)*q:0);});return totWeight>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:12,marginTop:12,display:"flex",gap:20,flexWrap:"wrap"}}><div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>{totWeight.toFixed(2)} kg</p></div>{!noDims&&pf>totWeight&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",margin:"0 0 2px"}}>PESO FACTURABLE</p><p style={{fontSize:14,fontWeight:700,color:IC,margin:0}}>{pf.toFixed(2)} kg</p></div>}{!noDims&&totCBM>0&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",margin:"0 0 2px"}}>CBM</p><p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>{totCBM.toFixed(4)} m³</p></div>}</div>;})()}
      <div style={{display:"flex",gap:12,marginTop:16}}><button onClick={()=>setStep(1)} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Atrás</button><button onClick={()=>setStep(3)} disabled={!pkgs.some(p=>Number(p.weight)>0)} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${B.accent},${B.primary})`,color:"#fff",opacity:pkgs.some(p=>Number(p.weight)>0)?1:0.4}}>Siguiente →</button></div>
    </div>}

    {/* CHINA FLOW - Step 3: Delivery */}
    {step===3&&origin==="China"&&(()=>{const{totWeight}=calcTotals();const shipOpts=[{k:"oficina",l:"Retiro por Oficina",sub:"Gratis"},{k:"caba",l:"Envío CABA",sub:`USD ${getShipCost("caba",totWeight)}`},{k:"gba",l:"Envío GBA",sub:`USD ${getShipCost("gba",totWeight)}`}];return <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 16px"}}>ENTREGA EN DESTINO</h3>
      {clientZone&&<div style={{background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.12)",borderRadius:10,padding:"10px 14px",marginBottom:14}}><p style={{fontSize:12,color:IC,margin:0,fontWeight:500}}>Tu dirección registrada es de <strong>{clientZone==="caba"?"CABA":"GBA"}</strong> — seleccionamos envío automáticamente</p></div>}
      <div style={{display:"flex",gap:12,marginBottom:20}}>{shipOpts.map(d=><div key={d.k} onClick={()=>setDelivery(d.k)} style={{flex:1,padding:"16px",textAlign:"center",borderRadius:12,border:`1.5px solid ${delivery===d.k?IC:"rgba(255,255,255,0.08)"}`,background:delivery===d.k?"rgba(96,165,250,0.1)":"rgba(255,255,255,0.03)",cursor:"pointer"}}><p style={{fontSize:15,fontWeight:700,color:delivery===d.k?IC:"rgba(255,255,255,0.6)",margin:"0 0 4px"}}>{d.l}</p><p style={{fontSize:13,fontWeight:600,color:delivery===d.k?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.35)",margin:0}}>{d.sub}</p></div>)}</div>
      {delivery==="oficina"&&<div style={{background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.12)",borderRadius:10,padding:"14px 18px",marginBottom:16}}><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>Nuestras Oficinas</p><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:"0 0 4px"}}>Av. Callao 1137, CABA — Lunes a Viernes de 9:00 a 19:00 hs</p><p style={{fontSize:14,color:"#22c55e",margin:0,fontWeight:600}}>Se puede abonar al momento de retirar</p></div>}
      {(delivery==="caba"||delivery==="gba")&&<div style={{background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:10,padding:"14px 18px",marginBottom:16}}><p style={{fontSize:12,color:"#fb923c",margin:0,fontWeight:500}}>Para envíos a domicilio, la carga debe abonarse previamente antes de ser despachada. Sin excepción.</p></div>}
      <div style={{display:"flex",gap:12,marginTop:8}}><button onClick={()=>setStep(2)} style={{padding:"12px 20px",fontSize:13,fontWeight:600,borderRadius:10,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",border:"1.5px solid rgba(255,255,255,0.12)",cursor:"pointer"}}>← Atrás</button><button onClick={calculateChina} style={{padding:"12px 24px",fontSize:13,fontWeight:600,borderRadius:10,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${B.accent},${B.primary})`,color:"#fff"}}>Calcular costos →</button></div>
    </div>;})()}

    {/* CHINA FLOW - Step 4: Results */}
    {step===4&&origin==="China"&&results&&<div>
      <div style={{display:"flex",gap:12,marginBottom:16}}><button onClick={()=>setStep(3)} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button><span style={{color:"rgba(255,255,255,0.1)"}}>|</span><button onClick={()=>{setStep(0);setResults(null);setOrigin("");setProducts([{type:"general",description:"",unit_price:"",quantity:"1"}]);setPkgs([{qty:"1",length:"",width:"",height:"",weight:""}]);setNoDims(false);setDelivery("oficina");setHasBattery(false);}} style={{fontSize:13,color:"rgba(255,255,255,0.4)",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>Nueva cotización</button></div>
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:14,marginBottom:20,display:"flex",gap:24,flexWrap:"wrap"}}>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>VALOR MERCADERÍA</p><p style={{fontSize:15,fontWeight:700,color:"#fff",margin:0}}>{usd(totalFob)}</p></div>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{results.totWeight.toFixed(2)} kg</p></div>
        {results.totCBM>0&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>CBM</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{results.totCBM.toFixed(4)} m³</p></div>}
        {ncm?.ncm_code&&<div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>NCM</p><p style={{fontSize:15,fontWeight:600,color:IC,margin:0,fontFamily:"monospace"}}>{ncm.ncm_code}</p></div>}
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>ENTREGA</p><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{DELIV[delivery]}</p></div>
      </div>
      {(()=>{const cheapest=results.channels.reduce((a,b)=>a.total<b.total?a:b);const delivCost=getShipCost(delivery,calcTotals().totWeight);
      const aereos=results.channels.filter(c=>c.key.includes("aereo"));const maritimos=results.channels.filter(c=>c.key.includes("maritimo"));
      const renderCard=(ch)=>{const isCheapest=ch.key===cheapest.key;const isFastest=ch.key==="aereo_a_china";const isAereo=ch.key.includes("aereo");const total=ch.total+delivCost;
      return <div key={ch.key} style={{background:"rgba(255,255,255,0.03)",borderRadius:16,border:`1.5px solid ${isFastest?"rgba(251,146,60,0.4)":isCheapest?"rgba(34,197,94,0.4)":"rgba(255,255,255,0.07)"}`,padding:"1.5rem",marginBottom:16,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>{isAereo?"✈️":"🚢"}</span><p style={{fontSize:20,fontWeight:700,color:"#fff",margin:0}}>{ch.name}</p></div>
          {isFastest&&<span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:8,background:"rgba(251,146,60,0.15)",color:"#fb923c",border:"1px solid rgba(251,146,60,0.3)"}}>⚡ El más Rápido</span>}
          {isCheapest&&!isFastest&&<span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:8,background:"rgba(34,197,94,0.15)",color:"#22c55e",border:"1px solid rgba(34,197,94,0.3)"}}>💵 El más Económico</span>}
        </div>
        {origin==="USA"&&ch.info&&<p style={{fontSize:12,color:"rgba(255,255,255,0.35)",margin:"0 0 12px"}}>{ch.info}</p>}
        <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"20px",marginBottom:16,textAlign:"center"}}>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",textTransform:"uppercase"}}>Costo de importación</p>
          <p style={{fontSize:32,fontWeight:700,color:"#fff",margin:0}}>{usd(total)}</p>
        </div>
        <button onClick={()=>setExpandedCh(expandedCh===ch.key?null:ch.key)} style={{width:"100%",padding:"12px",fontSize:13,fontWeight:600,borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",cursor:"pointer",color:"rgba(255,255,255,0.5)",marginBottom:12}}>Ver desglose detallado ▼</button>
        <button onClick={()=>saveQuote(ch,true)} style={{width:"100%",padding:"12px",fontSize:13,fontWeight:600,borderRadius:10,border:"1.5px solid rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.08)",color:IC,cursor:"pointer",marginBottom:10}}>{savedMsg===ch.key?"✓ Guardada":"💾 Guardar cotización"}</button>
        <a href={`https://wa.me/5491125088580?text=${makeWAMsg(ch)}`} onClick={()=>saveQuote(ch)} target="_blank" rel="noopener noreferrer" style={{display:"block",width:"100%",padding:"14px",fontSize:14,fontWeight:700,borderRadius:12,border:"none",cursor:"pointer",background:`linear-gradient(135deg,#25D366,#128C7E)`,color:"#fff",textAlign:"center",textDecoration:"none",boxSizing:"border-box"}}>Avanzar con esta importación →</a>
      </div>;};

      {/* Modal for desglose */}
      const modalCh=expandedCh?results.channels.find(c=>c.key===expandedCh):null;
      const isAereoModal=expandedCh?.includes("aereo");

      const maxLen=Math.max(aereos.length,maritimos.length);const pairs=[];for(let i=0;i<maxLen;i++)pairs.push([aereos[i],maritimos[i]]);
      return <><div>{pairs.map((pair,pi)=><div key={pi} className="grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"stretch",marginBottom:0}}>{pair.map(ch=>ch?renderCard(ch):<div key={"empty"+pi}/>)}</div>)}</div>
      {modalCh&&<div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setExpandedCh(null)}>
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}}/>
        <div style={{position:"relative",maxWidth:650,width:"90%",maxHeight:"85vh",overflow:"auto",background:"#0a1428",borderRadius:20,border:"1px solid rgba(255,255,255,0.1)",padding:"2rem",boxShadow:"0 30px 60px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>{isAereoModal?"✈️":"🚢"}</span><h3 style={{fontSize:20,fontWeight:700,color:"#fff",margin:0}}>{modalCh.name}</h3></div>
            <button onClick={()=>setExpandedCh(null)} style={{fontSize:20,background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",padding:"4px 8px"}}>✕</button>
          </div>
          {/* Peso/CBM info inside modal */}
          {isAereoModal&&modalCh.pesoFact&&<div style={{display:"flex",gap:20,marginBottom:20,padding:"12px 16px",background:"rgba(255,255,255,0.03)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
            <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>{modalCh.pesoBruto?.toFixed(1)} kg</p></div>
            <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>PESO VOL.</p><p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>{modalCh.pesoVol?.toFixed(1)} kg</p></div>
            <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>FACTURABLE</p><p style={{fontSize:14,fontWeight:700,color:IC,margin:0}}>{modalCh.pesoFact?.toFixed(1)} kg</p></div>
          </div>}
          {!isAereoModal&&modalCh.cbm&&<div style={{marginBottom:20,padding:"12px 16px",background:"rgba(255,255,255,0.03)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>CBM TOTAL</p><p style={{fontSize:14,fontWeight:700,color:IC,margin:0}}>{modalCh.cbm?.toFixed(4)} m³</p>
          </div>}
          {/* Per-item breakdown for canales A */}
          {modalCh.isBlanco&&modalCh.items?<>{modalCh.items.map((it,ii)=><div key={ii} style={{background:"rgba(255,255,255,0.02)",borderRadius:12,border:"1px solid rgba(255,255,255,0.05)",padding:"16px",marginBottom:12}}>
            <p style={{fontSize:14,fontWeight:700,color:IC,margin:"0 0 12px"}}>Item {ii+1}: {it.desc?.toUpperCase()}</p>
            <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 8px"}}>% DESGLOSE DE IMPUESTOS</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
              {[{l:"Der. Importación",v:it.derechos,p:`${it.drPct}%`},{l:"Tasa Estadística",v:it.tasa_e,p:`${it.tePct}%`},{l:"IVA",v:it.iva,p:`${it.ivaPct}%`},
                ...(modalCh.isMar?[{l:"IVA Ad.+IIGG+IIBB",v:(it.ivaAdic||0)+(it.iigg||0)+(it.iibb||0),p:"31%"}]:[{l:"Gasto Documental",v:(it.desembolso||0)+(it.ivaDesemb||0),p:""}])
              ].map((t,ti)=><div key={ti} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{t.l}</span>{t.p&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(96,165,250,0.15)",color:IC,fontWeight:700}}>{t.p}</span>}</div>
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
  if(lo)return <p style={{color:"rgba(255,255,255,0.3)",textAlign:"center",padding:"3rem 0"}}>Cargando...</p>;
  return <div>
    <div style={{marginBottom:24}}>
      <h2 style={{fontSize:22,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Mis Cotizaciones ({quotes.length})</h2>
      <p style={{fontSize:14,color:"rgba(255,255,255,0.4)",margin:0}}>Historial de cotizaciones realizadas</p>
    </div>
    {quotes.length===0?<div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px dashed rgba(255,255,255,0.1)",padding:"3rem 2rem",textAlign:"center"}}>
      <p style={{fontSize:15,color:"rgba(255,255,255,0.5)",margin:"0 0 6px"}}>No tenés cotizaciones guardadas todavía</p>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.3)",margin:0}}>Usá la calculadora y tocá "Guardar cotización" para que aparezcan acá</p>
    </div>:<div style={{display:"grid",gap:12}}>{quotes.map(q=>{const st=ST[q.status]||{l:q.status,c:"#999"};const prods=typeof q.products==="string"?JSON.parse(q.products):q.products||[];const prodDesc=Array.isArray(prods)?prods.map(p=>`${p.description||p.type} x${p.quantity}`).join(", "):"";const isAereo=q.channel_key?.includes("aereo");
      return <div key={q.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"1.25rem 1.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{fmtDate(q.created_at)}</span>
            <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:st.c,background:`${st.c}15`,border:`1px solid ${st.c}33`}}>{st.l}</span>
            <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:4,color:"rgba(255,255,255,0.6)",background:"rgba(255,255,255,0.06)"}}>{q.origin==="USA"?"🇺🇸":"🇨🇳"} {q.channel_name}</span>
          </div>
          <button onClick={()=>delQuote(q.id)} style={{fontSize:10,padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.08)",color:"#ff6b6b",cursor:"pointer",fontWeight:600}}>Eliminar</button>
        </div>
        <p style={{fontSize:14,fontWeight:500,color:"#fff",margin:"0 0 10px",lineHeight:1.4}}>{prodDesc||"Sin descripción"}</p>
        <div style={{display:"flex",gap:20,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)",alignItems:"center"}}>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",margin:"0 0 2px"}}>VALOR FOB</p><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}>{usd(q.total_fob)}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",margin:"0 0 2px"}}>{isAereo?"PESO":"CBM"}</p><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}>{isAereo?`${Number(q.total_weight).toFixed(2)} kg`:`${Number(q.total_cbm).toFixed(4)} m³`}</p></div>
          <div style={{marginLeft:"auto"}}><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",margin:"0 0 2px"}}>TOTAL ESTIMADO</p><p style={{fontSize:18,fontWeight:700,color:IC,margin:0}}>{usd(q.total_cost)}</p></div>
          <button onClick={()=>resendWA(q)} style={{padding:"10px 18px",fontSize:12,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff"}}>Enviar por WhatsApp →</button>
        </div>
      </div>;})}</div>}
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
      <h2 style={{fontSize:22,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Nuestros Servicios</h2>
      <p style={{fontSize:14,color:"rgba(255,255,255,0.4)",margin:0}}>Soluciones integrales para tu comercio exterior</p>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}} className="grid-2">
      {services.map((svc,i)=><div key={i} style={{background:"rgba(255,255,255,0.03)",borderRadius:16,border:"1px solid rgba(255,255,255,0.07)",padding:"1.5rem",display:"flex",flexDirection:"column",justifyContent:"space-between",position:"relative",overflow:"hidden"}}>
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
function DashShell({children,page,setPage,role,client,user,onLogout}){
  const name=client?`${client.first_name} ${client.last_name}`:user?.email||"";const code=client?.client_code||"";const nav=CN;const [mobOpen,setMobOpen]=useState(false);
  const sidebarContent=<>
    <div style={{padding:"20px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><img src={LOGO} alt="AC" style={{height:40,objectFit:"contain"}}/><button className="mob-close" onClick={()=>setMobOpen(false)} style={{display:"none",background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>✕</button></div>
    {code&&<div style={{padding:"16px 16px 8px",textAlign:"center"}}><div style={{display:"inline-block",padding:"6px 16px",borderRadius:8,background:"rgba(74,144,217,0.1)",border:"1px solid rgba(74,144,217,0.2)"}}><p style={{fontSize:9,color:"rgba(255,255,255,0.3)",margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>Tu código</p><p style={{fontSize:18,fontWeight:700,color:IC,margin:0,letterSpacing:"0.12em",fontFamily:"monospace"}}>{code}</p></div></div>}
    <nav style={{flex:1,padding:"12px 8px"}}>{nav.map(item=><button key={item.key} onClick={()=>{setPage(item.key);setMobOpen(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",marginBottom:2,borderRadius:10,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,letterSpacing:"0.04em",background:page===item.key?"rgba(74,144,217,0.15)":"transparent",color:page===item.key?"#fff":"rgba(255,255,255,0.4)",borderLeft:page===item.key?`3px solid ${B.accent}`:"3px solid transparent"}}><NI p={item.p} a={page===item.key}/>{item.label}</button>)}</nav>
    <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.05)"}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><div style={{width:36,height:36,borderRadius:"50%",background:"rgba(74,144,217,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,color:IC}}>{(client?.first_name?.[0]||"U").toUpperCase()}{(client?.last_name?.[0]||"").toUpperCase()}</div><div style={{flex:1,minWidth:0}}><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.25)",margin:0}}>Cliente</p></div></div><button onClick={onLogout} style={{width:"100%",padding:"8px",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.35)",cursor:"pointer",fontWeight:600}}>Cerrar sesión</button></div>
  </>;
  return <div style={{minHeight:"100vh",fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif",background:DARK_BG,position:"relative"}}><div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}><WorldMap/></div>
    <style>{`
      @media(max-width:768px){
        .sidebar-desktop{display:none!important}
        .mob-header{display:flex!important}
        .mob-close{display:block!important}
        .main-content{margin-left:0!important;padding-top:60px!important}
        .main-inner{padding:16px!important}
        .mob-overlay{display:block!important}
        .mob-sidebar{display:flex!important}
        .grid-2{grid-template-columns:1fr!important}
        .grid-4{grid-template-columns:1fr 1fr!important}
        .grid-5{grid-template-columns:1fr 1fr!important}
        .stats-grid{grid-template-columns:1fr 1fr!important}
        .op-progress{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .op-info{flex-wrap:wrap!important;gap:12px!important}
        h2{font-size:18px!important}
      }
      @media(min-width:769px){
        .mob-header{display:none!important}
        .mob-sidebar{display:none!important}
        .mob-overlay{display:none!important}
      }
    `}</style>
    {/* Mobile header */}
    <div className="mob-header" style={{display:"none",position:"fixed",top:0,left:0,right:0,height:56,background:"rgba(3,8,16,0.95)",borderBottom:"1px solid rgba(255,255,255,0.05)",alignItems:"center",justifyContent:"space-between",padding:"0 16px",zIndex:20}}>
      <button onClick={()=>setMobOpen(true)} style={{background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer",padding:4}}>☰</button>
      <img src={LOGO} alt="AC" style={{height:30}}/>
      {code&&<span style={{fontSize:12,fontWeight:700,color:IC,fontFamily:"monospace"}}>{code}</span>}
    </div>
    {/* Mobile overlay */}
    {mobOpen&&<div className="mob-overlay" style={{display:"none",position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:25}} onClick={()=>setMobOpen(false)}/>}
    {/* Mobile sidebar */}
    {mobOpen&&<div className="mob-sidebar" style={{display:"none",position:"fixed",top:0,left:0,bottom:0,width:280,background:"rgba(3,8,16,0.98)",borderRight:"1px solid rgba(255,255,255,0.05)",flexDirection:"column",zIndex:30,overflow:"auto"}}>{sidebarContent}</div>}
    {/* Desktop sidebar */}
    <div className="sidebar-desktop" style={{width:220,position:"fixed",top:0,left:0,bottom:0,background:"rgba(3,8,16,0.95)",borderRight:"1px solid rgba(255,255,255,0.05)",display:"flex",flexDirection:"column",zIndex:10,overflow:"auto"}}>{sidebarContent}</div>
    <div className="main-content" style={{marginLeft:220,minHeight:"100vh",position:"relative",zIndex:1}}><div className="main-inner" style={{maxWidth:1000,margin:"0 auto",padding:"28px 32px"}}>{children}</div></div>
  </div>;
}
function Dashboard({profile,client,user,token,onLogout}){
  const [page,setPage]=useState("imports");const [ops,setOps]=useState([]);const [selOp,setSelOp]=useState(null);const [lo,setLo]=useState(false);
  const loadOps=async()=>{setLo(true);const r=await dq("operations",{token,filters:"?select=*&order=created_at.desc"});setOps(Array.isArray(r)?r:[]);setLo(false);};
  useEffect(()=>{if(page==="imports")loadOps();},[page]);
  useEffect(()=>{let last=Date.now();const onFocus=()=>{if(document.visibilityState==="visible"&&page==="imports"&&!selOp&&Date.now()-last>5000){last=Date.now();loadOps();}};document.addEventListener("visibilitychange",onFocus);window.addEventListener("focus",onFocus);return()=>{document.removeEventListener("visibilitychange",onFocus);window.removeEventListener("focus",onFocus);};},[page,selOp]);
  return <DashShell page={page} setPage={p=>{setPage(p);setSelOp(null);}} role="cliente" client={client} user={user} onLogout={onLogout}>
    {page==="imports"&&!selOp&&<>{lo?<p style={{textAlign:"center",color:"rgba(255,255,255,0.3)",padding:"3rem 0"}}>Cargando...</p>:<OperationsList ops={ops} onSelect={setSelOp} client={client}/>}</>}
    {page==="imports"&&selOp&&<OperationDetail op={selOp} token={token} onBack={()=>setSelOp(null)}/>}
    {page==="profile"&&<ProfilePage client={client}/>}
    {page==="rates"&&<RatesPage token={token} client={client}/>}
    {page==="calculator"&&<CalculatorPage token={token} client={client}/>}
    {page==="services"&&<ServicesPage client={client}/>}
    {page==="quotes"&&<QuotesPage token={token} client={client}/>}
    {!["imports","profile","rates","calculator"].includes(page)&&<div style={{textAlign:"center",padding:"4rem 0"}}><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 8px",textTransform:"uppercase"}}>{page.replace("_"," ")}</h2><p style={{fontSize:14,color:"rgba(255,255,255,0.3)"}}>Sección en desarrollo</p></div>}
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
  const doReg=async()=>{if(!val(2))return;setLoading(true);setGErr("");try{const a=await ac("signup",{email:form.email,password:form.password,data:{role:"cliente",first_name:form.first_name.trim(),last_name:form.last_name.trim(),whatsapp:form.whatsapp.trim(),tax_condition:form.tax_condition,company_name:form.company_name.trim(),cuit:form.cuit.trim(),street:form.street.trim(),floor_apt:form.floor_apt.trim(),postal_code:form.postal_code.trim(),city:form.city.trim(),province:form.province}});if(a.error){setGErr(a.error.message||"Error");setLoading(false);return;}if(!a.access_token){setOkMsg("Te enviamos un email de confirmación. Una vez confirmado, ingresá con tu email y contraseña.");setLoading(false);return;}const c=await createClient(a.access_token,a.user.id);if(c?.error||!c){setGErr("Error guardando datos.");setLoading(false);return;}const ss={token:a.access_token,user:a.user};saveSession(ss);setSession(ss);setClient(Array.isArray(c)?c[0]:c);setProfile({role:"cliente"});}catch{setGErr("Error de conexión.");}setLoading(false);};
  const doLogin=async()=>{setLoading(true);setGErr("");if(!form.email||!form.password){setGErr("Completá email y contraseña");setLoading(false);return;}try{const r=await ac("token?grant_type=password",{email:form.email,password:form.password});if(r.error||r.error_description||r.msg){setGErr("Email o contraseña incorrectos");setLoading(false);return;}const token=r.access_token,uid=r.user.id;const p=await dq("profiles",{token,filters:`?id=eq.${uid}&select=*`});const prof=Array.isArray(p)?p[0]:null;if(prof?.role==="cliente"){let c=await dq("clients",{token,filters:`?auth_user_id=eq.${uid}&select=*`});let cl=Array.isArray(c)?c[0]:null;
      if(!cl&&r.user?.user_metadata){const m=r.user.user_metadata;if(m.first_name){const code=(m.first_name.substring(0,3)+m.last_name.substring(0,3)).toUpperCase();const nc=await dq("clients",{method:"POST",token,body:{auth_user_id:uid,first_name:m.first_name,last_name:m.last_name,whatsapp:m.whatsapp||"",email:r.user.email,tax_condition:m.tax_condition||"ninguna",company_name:m.company_name||null,cuit:m.cuit||null,street:m.street||"",floor_apt:m.floor_apt||null,postal_code:m.postal_code||"",city:m.city||"",province:m.province||"",client_code:code}});cl=Array.isArray(nc)?nc[0]:nc;}}
      setClient(cl);}const ss={token,user:r.user};saveSession(ss);setSession(ss);setProfile(prof);}catch{setGErr("Email o contraseña incorrectos. Verificá tus datos e intentá de nuevo.");}setLoading(false);};
  const logout=()=>{clearSession();setSession(null);setClient(null);setProfile(null);setForm(INIT);setStep(0);setView("login");setGErr("");setOkMsg("");};
  if(restoring)return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:DARK_BG}}><p style={{color:"rgba(255,255,255,0.4)"}}>Cargando...</p></div>;
  if(session&&profile)return <Dashboard profile={profile} client={client} user={session.user} token={session.token} onLogout={logout}/>;
  if(okMsg)return <AuthPage><div style={{textAlign:"center"}}><p style={{fontSize:15,color:"rgba(255,255,255,0.65)",margin:"0 0 24px"}}>{okMsg}</p><PBtn onClick={()=>{setOkMsg("");setView("login");setForm(INIT);setStep(0);}}>Ir a iniciar sesión</PBtn></div></AuthPage>;
  const ST=["Datos personales","Dirección","Condición fiscal"];
  return <AuthPage>
    {view==="login"?<>
      <div style={{textAlign:"center",marginBottom:24}}><h2 style={{fontSize:22,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>Bienvenido</h2><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:0}}>Ingresá con tu cuenta para continuar</p></div><ErrBox msg={gErr}/>
      <Inp label="Email" type="email" value={form.email} onChange={ch("email")} placeholder="tuemail@dominio.com" req/>
      <Inp label="Contraseña" type="password" value={form.password} onChange={ch("password")} placeholder="••••••••" req/>
      <div style={{marginTop:20}}><PBtn onClick={doLogin} disabled={loading}>{loading?"Ingresando...":"Iniciar sesión →"}</PBtn></div>
      <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.4)",marginTop:20,marginBottom:0}}>¿No tenés cuenta? <span onClick={()=>{setView("register");setGErr("");}} style={{color:B.accent,cursor:"pointer",fontWeight:600}}>Registrate</span></p>
    </>:<>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><h2 style={{fontSize:20,fontWeight:600,color:"#fff",margin:0}}>Crear cuenta</h2><span style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>Paso {step+1}/3</span></div>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 16px"}}>{ST[step]}</p><ErrBox msg={gErr}/>
      {step===0&&<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Nombre" value={form.first_name} onChange={ch("first_name")} placeholder="Juan" req error={errors.first_name}/><Inp label="Apellido" value={form.last_name} onChange={ch("last_name")} placeholder="Pérez" req error={errors.last_name}/></div><Inp label="WhatsApp" type="tel" value={form.whatsapp} onChange={ch("whatsapp")} placeholder="+54 9 11 1234-5678" req error={errors.whatsapp}/><Inp label="Email" type="email" value={form.email} onChange={ch("email")} placeholder="tu@email.com" req error={errors.email}/><Inp label="Contraseña" type="password" value={form.password} onChange={ch("password")} placeholder="Mínimo 6 caracteres" req error={errors.password}/><Inp label="Confirmar" type="password" value={form.confirm_password} onChange={ch("confirm_password")} placeholder="Repetí tu contraseña" req error={errors.confirm_password}/></>}
      {step===1&&<><Inp label="Calle y número" value={form.street} onChange={ch("street")} placeholder="Av. Corrientes 1234" req error={errors.street}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Piso/Depto" value={form.floor_apt} onChange={ch("floor_apt")} placeholder="3° B"/><Inp label="CP" value={form.postal_code} onChange={ch("postal_code")} placeholder="1414" req error={errors.postal_code}/></div><Inp label="Localidad" value={form.city} onChange={ch("city")} placeholder="Palermo" req error={errors.city}/><Sel label="Provincia" value={form.province} onChange={ch("province")} options={PR} req ph="Seleccioná"/></>}
      {step===2&&<><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 14px"}}>Condición frente al IVA</p><div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>{TX.map(o=><div key={o.value} onClick={()=>ch("tax_condition")(o.value)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",border:`1.5px solid ${form.tax_condition===o.value?B.accent:"rgba(255,255,255,0.08)"}`,borderRadius:10,cursor:"pointer",background:form.tax_condition===o.value?"rgba(74,144,217,0.1)":"transparent"}}><div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${form.tax_condition===o.value?B.accent:"rgba(255,255,255,0.15)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{form.tax_condition===o.value&&<div style={{width:10,height:10,borderRadius:"50%",background:B.accent}}/>}</div><span style={{fontSize:14,color:"rgba(255,255,255,0.7)"}}>{o.label}</span></div>)}</div>{form.tax_condition==="responsable_inscripto"&&<div style={{padding:14,background:"rgba(255,255,255,0.03)",borderRadius:10,border:"1px solid rgba(255,255,255,0.05)"}}><Inp label="Empresa" value={form.company_name} onChange={ch("company_name")} placeholder="Mi Empresa S.R.L." req error={errors.company_name}/><Inp label="CUIT" value={form.cuit} onChange={ch("cuit")} placeholder="20-12345678-9" req error={errors.cuit}/></div>}</>}
      <div style={{display:"flex",gap:12,marginTop:18}}>{step>0&&<SBtn onClick={()=>setStep(s=>s-1)}>Atrás</SBtn>}<PBtn onClick={step<2?()=>{if(val(step))setStep(s=>s+1);}:doReg} disabled={loading}>{loading?"Creando...":step<2?"Siguiente →":"Crear cuenta"}</PBtn></div>
      <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.4)",marginTop:18,marginBottom:0}}>¿Ya tenés cuenta? <span onClick={()=>{setView("login");setStep(0);setGErr("");}} style={{color:B.accent,cursor:"pointer",fontWeight:600}}>Iniciá sesión</span></p>
    </>}
  </AuthPage>;
}
