"use client";
import { useState, useEffect } from "react";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const LOGO = `${SB_URL}/storage/v1/object/public/assets/argencargo_logo.png`;
const B = {primary:"#1B4F8A",light:"#2A6CB8",dark:"#0D3A6B",accent:"#4A90D9",bg:"#E8F0FA"};

const sf = async(p,o={})=>{const r=await fetch(`${SB_URL}${p}`,{...o,headers:{apikey:SB_KEY,"Content-Type":"application/json",...(o.headers||{})}});return r.json();};
const ac = async(e,b)=>sf(`/auth/v1/${e}`,{method:"POST",body:JSON.stringify(b)});
const dq = async(t,{method="GET",body,token,filters=""})=>sf(`/rest/v1/${t}${filters}`,{method,body:body?JSON.stringify(body):undefined,headers:{Authorization:`Bearer ${token}`,...(method==="POST"?{Prefer:"return=representation"}:{})}});

const PR=["Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"];
const TX=[{value:"responsable_inscripto",label:"Responsable Inscripto"},{value:"monotributista",label:"Monotributista"},{value:"ninguna",label:"Ninguna de las anteriores"}];
const INIT={first_name:"",last_name:"",whatsapp:"",email:"",password:"",confirm_password:"",street:"",floor_apt:"",postal_code:"",city:"",province:"",tax_condition:"ninguna",company_name:"",cuit:""};

const STATUS_MAP={pendiente:{label:"Pendiente",color:"#94a3b8",bg:"#f1f5f9"},en_deposito_origen:{label:"En depósito origen",color:"#854d0e",bg:"#fef3cd"},en_preparacion:{label:"En preparación",color:"#9333ea",bg:"#f3e8ff"},en_transito:{label:"En tránsito",color:B.dark,bg:B.bg},en_aduana:{label:"En aduana",color:"#c2410c",bg:"#fff7ed"},lista_retiro:{label:"Lista para retiro",color:"#15803d",bg:"#dcfce7"},entregada:{label:"Entregada",color:"#166534",bg:"#bbf7d0"},cancelada:{label:"Cancelada",color:"#991b1b",bg:"#fecaca"}};
const CHANNEL_MAP={aereo_blanco:"Aéreo blanco",aereo_negro:"Aéreo negro",maritimo_blanco:"Marítimo blanco",maritimo_negro:"Marítimo negro"};

function WorldMap(){
  const dots=[[120,80],[135,85],[150,78],[165,90],[180,85],[200,95],[215,88],[230,92],[250,100],[265,95],[280,105],[300,98],[320,110],[335,105],[350,115],[370,108],[390,120],[410,112],[430,125],[450,118],[470,130],[490,122],[510,135],[530,128],[550,140],[570,132],[590,145],[610,138],[630,150],[140,120],[160,130],[180,125],[200,140],[220,135],[240,145],[260,138],[280,150],[300,142],[320,155],[340,148],[360,158],[380,152],[400,162],[420,155],[440,165],[460,158],[480,170],[500,162],[520,175],[540,168],[560,180],[580,172],[600,185],[620,178],[180,170],[200,180],[220,175],[240,185],[260,178],[280,190],[300,185],[320,195],[340,188],[360,200],[380,192],[400,205],[420,198],[440,210],[460,202],[480,215],[500,208],[520,220],[540,212],[250,230],[270,240],[290,235],[310,245],[330,238],[350,250],[370,242],[390,255],[410,248],[430,258],[450,252],[470,262],[490,255],[160,65],[180,60],[200,55],[220,62],[240,58],[260,65],[280,60],[300,55],[320,62],[340,58],[360,65],[380,58],[400,62],[420,55],[440,60],[460,55],[480,62],[500,58],[520,52],[540,58]];
  const lines=[[200,95,450,118],[300,98,520,135],[180,125,400,162],[280,150,500,208],[350,115,570,132],[220,175,440,210],[160,65,390,120],[320,62,550,140],[250,230,470,262],[140,120,360,158]];
  return <svg width="100%" height="100%" viewBox="0 0 750 320" preserveAspectRatio="xMidYMid slice" style={{position:"absolute",inset:0,opacity:0.12}}>
    {lines.map((l,i)=><line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#4A90D9" strokeWidth="0.5" opacity="0.4"/>)}
    {dots.map((d,i)=><circle key={i} cx={d[0]} cy={d[1]} r={1.5} fill="#4A90D9" opacity="0.5"/>)}
  </svg>;
}

function Inp({label,type="text",value,onChange,placeholder,req,error}){
  return <div style={{marginBottom:14}}>
    <label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{req&&<span style={{color:"#ff6b6b"}}> *</span>}</label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:`1.5px solid ${error?"#ff6b6b":"rgba(255,255,255,0.12)"}`,borderRadius:10,background:"rgba(255,255,255,0.07)",color:"#fff",outline:"none",transition:"all 0.2s"}}
      onFocus={e=>{e.target.style.borderColor=B.accent;e.target.style.boxShadow=`0 0 0 3px ${B.accent}33`;}}
      onBlur={e=>{e.target.style.borderColor=error?"#ff6b6b":"rgba(255,255,255,0.12)";e.target.style.boxShadow="none";}}/>
    {error&&<p style={{fontSize:11,color:"#ff6b6b",margin:"4px 0 0"}}>{error}</p>}
  </div>;
}
function Sel({label,value,onChange,options,req,ph}){
  return <div style={{marginBottom:14}}>
    <label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.55)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}{req&&<span style={{color:"#ff6b6b"}}> *</span>}</label>
    <select value={value} onChange={onChange} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.07)",color:value?"#fff":"rgba(255,255,255,0.35)",outline:"none",cursor:"pointer"}}>
      {ph&&<option value="" style={{background:"#1a2332"}}>{ph}</option>}
      {options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value} style={{background:"#1a2332",color:"#fff"}}>{typeof o==="string"?o:o.label}</option>)}
    </select>
  </div>;
}
function Steps({cur,tot}){
  return <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:20}}>
    {Array.from({length:tot},(_,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,flex:i<tot-1?1:"none"}}>
      <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,flexShrink:0,background:i<=cur?`linear-gradient(135deg,${B.accent},${B.primary})`:"rgba(255,255,255,0.08)",color:i<=cur?"#fff":"rgba(255,255,255,0.25)"}}>{i<cur?"✓":i+1}</div>
      {i<tot-1&&<div style={{flex:1,height:2,background:i<cur?B.accent:"rgba(255,255,255,0.08)"}}/>}
    </div>)}
  </div>;
}
function PBtn({children,onClick,disabled}){return <button onClick={onClick} disabled={disabled} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:600,border:"none",borderRadius:10,cursor:disabled?"not-allowed":"pointer",background:disabled?"rgba(255,255,255,0.08)":`linear-gradient(135deg,${B.accent},${B.primary})`,color:disabled?"rgba(255,255,255,0.25)":"#fff",boxShadow:disabled?"none":`0 4px 20px ${B.primary}66`}}>{children}</button>;}
function SBtn({children,onClick}){return <button onClick={onClick} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:500,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.6)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,cursor:"pointer"}}>{children}</button>;}
function ErrBox({msg}){return msg?<div style={{padding:"10px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:10,fontSize:13,color:"#ff6b6b",marginBottom:14}}>{msg}</div>:null;}
function StatusBadge({status}){const s=STATUS_MAP[status]||{label:status,color:"#666",bg:"#eee"};return <span style={{display:"inline-block",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:6,background:s.bg,color:s.color}}>{s.label}</span>;}
function formatDate(d){if(!d)return"—";return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}

const ST=["Datos personales","Dirección","Condición fiscal"];

function AuthPage({children}){
  return <div style={{minHeight:"100vh",display:"flex",position:"relative",overflow:"hidden",fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif"}}>
    <div style={{position:"absolute",inset:0,background:`linear-gradient(160deg,#060d18 0%,${B.dark} 40%,#0a1e3d 70%,#061224 100%)`}}/>
    <div style={{position:"absolute",inset:0}}><WorldMap/></div>
    <div style={{position:"absolute",bottom:-100,left:-100,width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(74,144,217,0.12) 0%,transparent 70%)"}}/>
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1rem",position:"relative",zIndex:3}}>
      <div style={{maxWidth:420,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <img src={LOGO} alt="Argencargo" style={{width:160,height:"auto",filter:"drop-shadow(0 4px 12px rgba(0,0,0,0.3))"}}/>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"10px 0 0",letterSpacing:"0.04em"}}>Soluciones integrales de comercio exterior</p>
        </div>
        <div style={{background:"rgba(12,25,45,0.8)",backdropFilter:"blur(24px)",borderRadius:20,padding:"2rem 1.75rem",border:"1px solid rgba(255,255,255,0.06)",boxShadow:"0 30px 60px rgba(0,0,0,0.5)"}}>{children}</div>
        <p style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:16}}>Argencargo © 2026</p>
      </div>
    </div>
  </div>;
}

function OperationsList({ops,onSelect}){
  const active=ops.filter(o=>o.status!=="entregada"&&o.status!=="cancelada");
  const past=ops.filter(o=>o.status==="entregada"||o.status==="cancelada");
  const renderOp=(op)=>(
    <div key={op.id} onClick={()=>onSelect(op)} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"1rem 1.25rem",cursor:"pointer",transition:"all 0.2s",position:"relative",overflow:"hidden"}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=B.accent;e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.06)";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${B.primary},${B.accent})`,borderRadius:"12px 12px 0 0"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginTop:4}}>
        <div><p style={{fontSize:13,fontWeight:600,color:B.dark,margin:"0 0 2px"}}>{op.operation_code}</p><p style={{fontSize:14,fontWeight:500,color:"#1a202c",margin:"0 0 6px"}}>{op.description}</p><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><StatusBadge status={op.status}/><span style={{fontSize:11,color:"#94a3b8"}}>{CHANNEL_MAP[op.channel]}</span></div></div>
        <div style={{textAlign:"right"}}><p style={{fontSize:12,color:"#94a3b8",margin:"0 0 2px"}}>Valor declarado</p><p style={{fontSize:15,fontWeight:600,color:"#1a202c",margin:0}}>USD {Number(op.declared_value_usd).toLocaleString()}</p>{op.eta&&<p style={{fontSize:11,color:"#94a3b8",margin:"4px 0 0"}}>ETA: {formatDate(op.eta)}</p>}</div>
      </div>
    </div>
  );
  return <div>
    {active.length>0&&<><h3 style={{fontSize:14,fontWeight:600,color:"#64748b",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.05em"}}>En curso ({active.length})</h3><div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>{active.map(renderOp)}</div></>}
    {past.length>0&&<><h3 style={{fontSize:14,fontWeight:600,color:"#94a3b8",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Finalizadas ({past.length})</h3><div style={{display:"flex",flexDirection:"column",gap:10}}>{past.map(renderOp)}</div></>}
    {ops.length===0&&<p style={{textAlign:"center",color:"#94a3b8",fontSize:14,padding:"3rem 0"}}>No tenés operaciones todavía.</p>}
  </div>;
}

function OperationDetail({op,token,onBack}){
  const [items,setItems]=useState([]);const [events,setEvents]=useState([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{const [it,ev]=await Promise.all([dq("operation_items",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`}),dq("tracking_events",{token,filters:`?operation_id=eq.${op.id}&select=*&order=occurred_at.desc`})]);setItems(Array.isArray(it)?it:[]);setEvents(Array.isArray(ev)?ev:[]);setLoading(false);})();},[op.id,token]);
  const steps=["pendiente","en_deposito_origen","en_preparacion","en_transito","en_aduana","lista_retiro","entregada"];
  const currentIdx=steps.indexOf(op.status);
  return <div>
    <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:B.accent,background:"none",border:"none",cursor:"pointer",fontWeight:500,marginBottom:16,padding:0}}>← Volver a operaciones</button>
    <div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",padding:"1.5rem",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div><p style={{fontSize:13,fontWeight:600,color:B.dark,margin:"0 0 2px"}}>{op.operation_code}</p><h2 style={{fontSize:18,fontWeight:600,color:"#1a202c",margin:"0 0 8px"}}>{op.description}</h2><div style={{display:"flex",gap:8,alignItems:"center"}}><StatusBadge status={op.status}/><span style={{fontSize:12,color:"#94a3b8"}}>{CHANNEL_MAP[op.channel]}</span></div></div>
        <div style={{textAlign:"right"}}><p style={{fontSize:12,color:"#94a3b8",margin:"0 0 2px"}}>Valor declarado</p><p style={{fontSize:20,fontWeight:600,color:"#1a202c",margin:0}}>USD {Number(op.declared_value_usd).toLocaleString()}</p></div>
      </div>
      {op.status!=="cancelada"&&<div style={{marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:0}}>{steps.map((s,i)=>{const active=i<=currentIdx;const isCurrent=i===currentIdx;return <div key={s} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"none"}}><div style={{width:isCurrent?12:8,height:isCurrent?12:8,borderRadius:"50%",background:active?B.primary:"#e2e8f0",border:isCurrent?`3px solid ${B.bg}`:"none",boxShadow:isCurrent?`0 0 0 2px ${B.primary}`:"none",flexShrink:0}}/>
        {i<steps.length-1&&<div style={{flex:1,height:2,background:i<currentIdx?B.primary:"#e2e8f0"}}/>}</div>;})}</div><div style={{display:"flex",justifyContent:"space-between",marginTop:6}}><span style={{fontSize:9,color:"#94a3b8"}}>Pendiente</span><span style={{fontSize:9,color:"#94a3b8"}}>Entregada</span></div></div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,borderTop:"1px solid #f1f5f9",paddingTop:14}}>
        {[{l:"NCM",v:op.ncm_code||"—"},{l:"Cantidad",v:op.total_quantity?`${op.total_quantity} uds`:"—"},{l:"ETA",v:formatDate(op.eta)},{l:"Tracking proveedor",v:op.supplier_tracking||"—"},{l:"Tracking internacional",v:op.international_tracking||"—"},{l:"Carrier",v:op.international_carrier||"—"}].map((x,i)=><div key={i}><p style={{fontSize:11,fontWeight:600,color:"#94a3b8",margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.04em"}}>{x.l}</p><p style={{fontSize:13,color:"#334155",margin:0,fontWeight:500,wordBreak:"break-all"}}>{x.v}</p></div>)}
      </div>
    </div>
    {!loading&&items.length>0&&<div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",padding:"1.25rem 1.5rem",marginBottom:16}}>
      <h3 style={{fontSize:14,fontWeight:600,color:"#1a202c",margin:"0 0 14px"}}>Productos</h3>
      {items.map((it,i)=><div key={it.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderTop:i>0?"1px solid #f1f5f9":"none"}}><div><p style={{fontSize:14,color:"#334155",margin:0,fontWeight:500}}>{it.description}</p><p style={{fontSize:12,color:"#94a3b8",margin:"2px 0 0"}}>NCM: {it.ncm_code||"—"} · {it.quantity} uds</p></div><p style={{fontSize:14,fontWeight:600,color:"#1a202c",margin:0}}>USD {(Number(it.unit_price_usd)*it.quantity).toLocaleString()}</p></div>)}
    </div>}
    {!loading&&events.length>0&&<div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",padding:"1.25rem 1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:600,color:"#1a202c",margin:"0 0 14px"}}>Seguimiento</h3>
      <div style={{position:"relative",paddingLeft:20}}>
        <div style={{position:"absolute",left:5,top:8,bottom:8,width:2,background:"#e2e8f0"}}/>
        {events.map((ev,i)=><div key={ev.id} style={{position:"relative",paddingBottom:i<events.length-1?20:0}}>
          <div style={{position:"absolute",left:-17,top:6,width:10,height:10,borderRadius:"50%",background:i===0?B.primary:"#e2e8f0",border:i===0?`2px solid ${B.bg}`:"none",boxShadow:i===0?`0 0 0 2px ${B.primary}`:"none"}}/>
          <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><p style={{fontSize:14,fontWeight:600,color:i===0?"#1a202c":"#64748b",margin:0}}>{ev.title}</p><p style={{fontSize:11,color:"#94a3b8",margin:0,whiteSpace:"nowrap",marginLeft:12}}>{formatDate(ev.occurred_at)}</p></div>
            {ev.description&&<p style={{fontSize:13,color:"#94a3b8",margin:"2px 0 0"}}>{ev.description}</p>}
            {ev.location&&<p style={{fontSize:12,color:"#b0bec5",margin:"2px 0 0"}}>📍 {ev.location}</p>}</div>
        </div>)}
      </div>
    </div>}
    {loading&&<p style={{textAlign:"center",color:"#94a3b8",padding:"2rem 0"}}>Cargando detalles...</p>}
  </div>;
}

function Dashboard({profile,client,user,token,onLogout}){
  const role=profile?.role||"cliente";const name=client?`${client.first_name} ${client.last_name}`:user?.email||"Usuario";
  const [page,setPage]=useState("home");const [ops,setOps]=useState([]);const [selectedOp,setSelectedOp]=useState(null);const [loadingOps,setLoadingOps]=useState(false);
  const loadOps=async()=>{setLoadingOps(true);const r=await dq("operations",{token,filters:"?select=*&order=created_at.desc"});setOps(Array.isArray(r)?r:[]);setLoadingOps(false);};
  useEffect(()=>{if(page==="operations")loadOps();},[page]);
  const clientSections=[{t:"Mis operaciones",d:"En curso y pasadas",ic:"📦",key:"operations"},{t:"Calculadora",d:"Calculá tus costos",ic:"🧮",key:"calculator"},{t:"Cuenta corriente",d:"Pagos y saldos",ic:"💰",key:"account"},{t:"Puntos",d:"Próximamente",ic:"⭐",key:"points",off:true,badge:"En desarrollo"}];
  const adminSections=[{t:"Operaciones",d:"Gestionar carpetas",ic:"📦",key:"operations"},{t:"Clientes",d:"Ver y administrar",ic:"👥",key:"clients"},{t:"Finanzas",d:"Facturación y pagos",ic:"💰",key:"finance"},{t:"Depósito",d:"Agente de cargas",ic:"🏭",key:"warehouse"}];
  const agentSections=[{t:"Cargar paquetes",d:"Registrar llegadas",ic:"📥",key:"packages"},{t:"Órdenes",d:"Instrucciones pendientes",ic:"📋",key:"orders"}];
  const sections=role==="admin"?adminSections:role==="agente"?agentSections:clientSections;

  return <div style={{minHeight:"100vh",background:"#f0f4f8",fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif"}}>
    <div style={{background:`linear-gradient(135deg,${B.dark},${B.primary})`,padding:"0 24px"}}>
      <div style={{maxWidth:900,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",height:60}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <img src={LOGO} alt="AC" style={{height:32,cursor:"pointer"}} onClick={()=>{setPage("home");setSelectedOp(null);}}/>
          {page!=="home"&&<button onClick={()=>{setPage("home");setSelectedOp(null);}} style={{fontSize:13,color:"rgba(255,255,255,0.6)",background:"none",border:"none",cursor:"pointer"}}>← Inicio</button>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:13,color:"#fff"}}>{(client?.first_name?.[0]||user?.email?.[0]||"U").toUpperCase()}{(client?.last_name?.[0]||"").toUpperCase()}</div>
            <span style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.85)"}}>{name}</span>
          </div>
          <button onClick={onLogout} style={{padding:"6px 14px",fontSize:12,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,color:"rgba(255,255,255,0.7)",cursor:"pointer",fontWeight:500}}>Salir</button>
        </div>
      </div>
    </div>
    <div style={{maxWidth:900,margin:"0 auto",padding:"32px 24px"}}>
      {page==="home"&&<>
        <div style={{marginBottom:28}}>
          <span style={{display:"inline-block",marginBottom:8,fontSize:11,padding:"3px 10px",borderRadius:6,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",background:role==="admin"?"#FCEBEB":role==="agente"?"#FAEEDA":B.bg,color:role==="admin"?"#791F1F":role==="agente"?"#633806":B.dark}}>{role==="admin"?"Administrador":role==="agente"?"Agente de cargas":"Cliente"}</span>
          <h1 style={{fontSize:24,fontWeight:600,color:"#1a202c",margin:"0 0 4px"}}>{role==="admin"?"Panel de administración":role==="agente"?"Portal agente de cargas":"Mi portal"}</h1>
          <p style={{fontSize:14,color:"#94a3b8",margin:0}}>{role==="admin"?"Gestión completa de operaciones y clientes":role==="agente"?"Carga de paquetes y seguimiento":"Tus operaciones, costos y seguimiento"}</p>
        </div>
        {role==="cliente"&&client&&<div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",padding:"1.25rem 1.5rem",marginBottom:20}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {[{l:"Email",v:client.email},{l:"WhatsApp",v:client.whatsapp},{l:"Dirección",v:`${client.street}${client.floor_apt?`, ${client.floor_apt}`:""}, ${client.city}`},{l:"Provincia",v:client.province},{l:"Condición IVA",v:client.tax_condition==="responsable_inscripto"?"Resp. Inscripto":client.tax_condition==="monotributista"?"Monotributista":"Consumidor final"},{l:"Puntos",v:client.points_balance||0}].map((x,i)=><div key={i}><p style={{fontSize:11,fontWeight:600,color:"#94a3b8",margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.05em"}}>{x.l}</p><p style={{fontSize:14,color:"#334155",margin:0,fontWeight:500}}>{x.v}</p></div>)}
          </div>
        </div>}
        <div style={{display:"grid",gridTemplateColumns:role==="agente"?"1fr 1fr":"repeat(auto-fill,minmax(195px,1fr))",gap:14}}>
          {sections.map((s,i)=><div key={i} onClick={()=>{if(!s.off)setPage(s.key);}} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"1.25rem 1.5rem",cursor:s.off?"default":"pointer",opacity:s.off?0.5:1,transition:"all 0.2s",position:"relative",overflow:"hidden"}}
            onMouseEnter={e=>{if(!s.off){e.currentTarget.style.borderColor=B.accent;e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)";}}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:s.off?"#e2e8f0":`linear-gradient(90deg,${B.primary},${B.accent})`,borderRadius:"12px 12px 0 0"}}/>
            <div style={{fontSize:24,marginBottom:10,marginTop:4}}>{s.ic}</div>
            <p style={{fontSize:15,fontWeight:600,margin:"0 0 4px",color:"#1a202c"}}>{s.t}</p>
            <p style={{fontSize:13,color:"#94a3b8",margin:0}}>{s.d}</p>
            {s.badge&&<span style={{display:"inline-block",marginTop:10,fontSize:11,padding:"3px 10px",background:"#f1f5f9",borderRadius:6,color:"#94a3b8",fontWeight:500}}>{s.badge}</span>}
          </div>)}
        </div>
      </>}
      {page==="operations"&&!selectedOp&&<><div style={{marginBottom:20}}><h2 style={{fontSize:20,fontWeight:600,color:"#1a202c",margin:"0 0 4px"}}>Mis operaciones</h2><p style={{fontSize:14,color:"#94a3b8",margin:0}}>Seguimiento de tus importaciones</p></div>{loadingOps?<p style={{textAlign:"center",color:"#94a3b8",padding:"3rem 0"}}>Cargando...</p>:<OperationsList ops={ops} onSelect={setSelectedOp}/>}</>}
      {page==="operations"&&selectedOp&&<OperationDetail op={selectedOp} token={token} onBack={()=>setSelectedOp(null)}/>}
      {page!=="home"&&page!=="operations"&&<div style={{textAlign:"center",padding:"4rem 0"}}><p style={{fontSize:16,color:"#94a3b8"}}>Sección en desarrollo</p><button onClick={()=>setPage("home")} style={{marginTop:12,padding:"10px 24px",fontSize:14,fontWeight:500,background:B.primary,color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>Volver al inicio</button></div>}
    </div>
  </div>;
}

export default function Page(){
  const [view,setView]=useState("login");const [step,setStep]=useState(0);const [form,setForm]=useState(INIT);const [errors,setErrors]=useState({});const [loading,setLoading]=useState(false);const [gErr,setGErr]=useState("");const [okMsg,setOkMsg]=useState("");const [session,setSession]=useState(null);const [client,setClient]=useState(null);const [profile,setProfile]=useState(null);
  const ch=f=>e=>{setForm(p=>({...p,[f]:e.target.value}));setErrors(p=>({...p,[f]:undefined}));setGErr("");};
  const val=s=>{const e={};if(s===0){if(!form.first_name.trim())e.first_name="Requerido";if(!form.last_name.trim())e.last_name="Requerido";if(!form.whatsapp.trim())e.whatsapp="Requerido";if(!form.email.trim())e.email="Requerido";else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))e.email="Email inválido";if(!form.password)e.password="Requerido";else if(form.password.length<6)e.password="Mínimo 6 caracteres";if(form.password!==form.confirm_password)e.confirm_password="No coinciden";}if(s===1){if(!form.street.trim())e.street="Requerido";if(!form.postal_code.trim())e.postal_code="Requerido";if(!form.city.trim())e.city="Requerido";if(!form.province)e.province="Requerido";}if(s===2&&form.tax_condition==="responsable_inscripto"){if(!form.company_name.trim())e.company_name="Requerido";if(!form.cuit.trim())e.cuit="Requerido";}setErrors(e);return !Object.keys(e).length;};
  const doRegister=async()=>{if(!val(2))return;setLoading(true);setGErr("");try{const a=await ac("signup",{email:form.email,password:form.password,data:{role:"cliente"}});if(a.error){setGErr(a.error.message||"Error");setLoading(false);return;}if(!a.access_token){setOkMsg("Te enviamos un email de confirmación. Revisá tu bandeja de entrada.");setLoading(false);return;}const c=await dq("clients",{method:"POST",token:a.access_token,body:{auth_user_id:a.user.id,first_name:form.first_name.trim(),last_name:form.last_name.trim(),whatsapp:form.whatsapp.trim(),email:form.email.trim(),tax_condition:form.tax_condition,company_name:form.tax_condition==="responsable_inscripto"?form.company_name.trim():null,cuit:form.tax_condition==="responsable_inscripto"?form.cuit.trim():null,street:form.street.trim(),floor_apt:form.floor_apt.trim()||null,postal_code:form.postal_code.trim(),city:form.city.trim(),province:form.province}});if(c.error){setGErr("Cuenta creada pero error guardando datos.");setLoading(false);return;}setSession({token:a.access_token,user:a.user});setClient(Array.isArray(c)?c[0]:c);setProfile({role:"cliente"});}catch{setGErr("Error de conexión.");}setLoading(false);};
  const doLogin=async()=>{setLoading(true);setGErr("");if(!form.email||!form.password){setGErr("Completá email y contraseña");setLoading(false);return;}try{const r=await ac("token?grant_type=password",{email:form.email,password:form.password});if(r.error){setGErr(r.error_description||r.error?.message||"Credenciales inválidas");setLoading(false);return;}const token=r.access_token,uid=r.user.id;const p=await dq("profiles",{token,filters:`?id=eq.${uid}&select=*`});const prof=Array.isArray(p)?p[0]:null;if(prof?.role==="cliente"){const c=await dq("clients",{token,filters:`?auth_user_id=eq.${uid}&select=*`});setClient(Array.isArray(c)?c[0]:null);}setSession({token,user:r.user});setProfile(prof);}catch{setGErr("Error de conexión.");}setLoading(false);};
  const logout=()=>{setSession(null);setClient(null);setProfile(null);setForm(INIT);setStep(0);setView("login");setGErr("");setOkMsg("");};

  if(session&&profile) return <Dashboard profile={profile} client={client} user={session.user} token={session.token} onLogout={logout}/>;
  if(okMsg) return <AuthPage><div style={{textAlign:"center"}}><div style={{width:60,height:60,borderRadius:"50%",background:"rgba(74,144,217,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4A90D9" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div><p style={{fontSize:15,color:"rgba(255,255,255,0.8)",lineHeight:1.7,margin:"0 0 24px"}}>{okMsg}</p><PBtn onClick={()=>{setOkMsg("");setView("login");setForm(INIT);setStep(0);}}>Ir a iniciar sesión</PBtn></div></AuthPage>;

  return <AuthPage>
    {view==="login"?<>
      <div style={{textAlign:"center",marginBottom:24}}><h2 style={{fontSize:22,fontWeight:600,color:"#fff",margin:"0 0 6px"}}>Bienvenido</h2><p style={{fontSize:13,color:"rgba(255,255,255,0.45)",margin:0}}>Ingresá con tu cuenta para continuar</p></div>
      <ErrBox msg={gErr}/>
      <Inp label="Email" type="email" value={form.email} onChange={ch("email")} placeholder="tuemail@dominio.com" req/>
      <Inp label="Contraseña" type="password" value={form.password} onChange={ch("password")} placeholder="••••••••" req/>
      <div style={{marginTop:20}}><PBtn onClick={doLogin} disabled={loading}>{loading?"Ingresando...":"Iniciar sesión →"}</PBtn></div>
      <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:20,marginBottom:0}}>¿No tenés cuenta? <span onClick={()=>{setView("register");setGErr("");}} style={{color:B.accent,cursor:"pointer",fontWeight:600}}>Registrate</span></p>
    </>:<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><h2 style={{fontSize:20,fontWeight:600,color:"#fff",margin:0}}>Crear cuenta</h2><span style={{fontSize:12,color:"rgba(255,255,255,0.35)",fontWeight:500}}>Paso {step+1}/3</span></div>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.45)",margin:"0 0 16px"}}>{ST[step]}</p>
      <Steps cur={step} tot={3}/><ErrBox msg={gErr}/>
      {step===0&&<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Nombre" value={form.first_name} onChange={ch("first_name")} placeholder="Juan" req error={errors.first_name}/><Inp label="Apellido" value={form.last_name} onChange={ch("last_name")} placeholder="Pérez" req error={errors.last_name}/></div><Inp label="WhatsApp" type="tel" value={form.whatsapp} onChange={ch("whatsapp")} placeholder="+54 9 11 1234-5678" req error={errors.whatsapp}/><Inp label="Email" type="email" value={form.email} onChange={ch("email")} placeholder="tu@email.com" req error={errors.email}/><Inp label="Contraseña" type="password" value={form.password} onChange={ch("password")} placeholder="Mínimo 6 caracteres" req error={errors.password}/><Inp label="Confirmar contraseña" type="password" value={form.confirm_password} onChange={ch("confirm_password")} placeholder="Repetí tu contraseña" req error={errors.confirm_password}/></>}
      {step===1&&<><Inp label="Calle y número" value={form.street} onChange={ch("street")} placeholder="Av. Corrientes 1234" req error={errors.street}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Piso / Depto" value={form.floor_apt} onChange={ch("floor_apt")} placeholder="3° B (opcional)"/><Inp label="Código postal" value={form.postal_code} onChange={ch("postal_code")} placeholder="1414" req error={errors.postal_code}/></div><Inp label="Localidad" value={form.city} onChange={ch("city")} placeholder="Palermo" req error={errors.city}/><Sel label="Provincia" value={form.province} onChange={ch("province")} options={PR} req ph="Seleccioná una provincia"/></>}
      {step===2&&<><p style={{fontSize:13,color:"rgba(255,255,255,0.45)",margin:"0 0 14px"}}>Seleccioná tu condición frente al IVA.</p><div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>{TX.map(o=><label key={o.value} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",border:`1.5px solid ${form.tax_condition===o.value?B.accent:"rgba(255,255,255,0.1)"}`,borderRadius:10,cursor:"pointer",background:form.tax_condition===o.value?"rgba(74,144,217,0.12)":"rgba(255,255,255,0.03)"}}><div style={{width:18,height:18,borderRadius:"50%",flexShrink:0,border:`2px solid ${form.tax_condition===o.value?B.accent:"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{form.tax_condition===o.value&&<div style={{width:10,height:10,borderRadius:"50%",background:B.accent}}/>}</div><span style={{fontSize:14,color:"rgba(255,255,255,0.8)"}}>{o.label}</span></label>)}</div>{form.tax_condition==="responsable_inscripto"&&<div style={{padding:14,background:"rgba(255,255,255,0.04)",borderRadius:10,marginBottom:8,border:"1px solid rgba(255,255,255,0.06)"}}><Inp label="Nombre de la empresa" value={form.company_name} onChange={ch("company_name")} placeholder="Mi Empresa S.R.L." req error={errors.company_name}/><Inp label="CUIT" value={form.cuit} onChange={ch("cuit")} placeholder="20-12345678-9" req error={errors.cuit}/></div>}</>}
      <div style={{display:"flex",gap:12,marginTop:18}}>{step>0&&<SBtn onClick={()=>setStep(s=>s-1)}>Atrás</SBtn>}<PBtn onClick={step<2?()=>{if(val(step))setStep(s=>s+1);}:doRegister} disabled={loading}>{loading?"Creando...":step<2?"Siguiente →":"Crear cuenta"}</PBtn></div>
      <p style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:18,marginBottom:0}}>¿Ya tenés cuenta? <span onClick={()=>{setView("login");setStep(0);setGErr("");}} style={{color:B.accent,cursor:"pointer",fontWeight:600}}>Iniciá sesión</span></p>
    </>}
  </AuthPage>;
}
