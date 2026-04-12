"use client";
import { useState, useEffect } from "react";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const LOGO=`${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
const B={primary:"#1B4F8A",light:"#2A6CB8",dark:"#0D3A6B",accent:"#4A90D9",bg:"#E8F0FA"};

const sf=async(p,o={})=>{const r=await fetch(`${SB_URL}${p}`,{...o,headers:{apikey:SB_KEY,"Content-Type":"application/json",...(o.headers||{})}});return r.json();};
const ac=async(e,b)=>sf(`/auth/v1/${e}`,{method:"POST",body:JSON.stringify(b)});
const dq=async(t,{method="GET",body,token,filters=""})=>sf(`/rest/v1/${t}${filters}`,{method,body:body?JSON.stringify(body):undefined,headers:{Authorization:`Bearer ${token}`,...(method==="POST"?{Prefer:"return=representation"}:{})}});

const PR=["Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"];
const TX=[{value:"responsable_inscripto",label:"Responsable Inscripto"},{value:"monotributista",label:"Monotributista"},{value:"ninguna",label:"Ninguna de las anteriores"}];
const INIT={first_name:"",last_name:"",whatsapp:"",email:"",password:"",confirm_password:"",street:"",floor_apt:"",postal_code:"",city:"",province:"",tax_condition:"ninguna",company_name:"",cuit:""};

const STATUS_MAP={pendiente:{label:"Pendiente",color:"#94a3b8",bg:"rgba(148,163,184,0.15)"},en_deposito_origen:{label:"En depósito origen",color:"#fbbf24",bg:"rgba(251,191,36,0.15)"},en_preparacion:{label:"En preparación",color:"#a78bfa",bg:"rgba(167,139,250,0.15)"},en_transito:{label:"En tránsito",color:"#60a5fa",bg:"rgba(96,165,250,0.15)"},en_aduana:{label:"En aduana",color:"#fb923c",bg:"rgba(251,146,60,0.15)"},lista_retiro:{label:"Lista para retiro",color:"#34d399",bg:"rgba(52,211,153,0.15)"},entregada:{label:"Entregada",color:"#22c55e",bg:"rgba(34,197,94,0.15)"},cancelada:{label:"Cancelada",color:"#f87171",bg:"rgba(248,113,113,0.15)"}};
const CHANNEL_MAP={aereo_blanco:"Aéreo blanco",aereo_negro:"Aéreo negro",maritimo_blanco:"Marítimo blanco",maritimo_negro:"Marítimo negro"};

const CLIENT_NAV=[
  {key:"imports",label:"Importaciones",icon:"📦"},
  {key:"calculator",label:"Calculadora",icon:"🧮"},
  {key:"account",label:"Estado de cuenta",icon:"💲"},
  {key:"points",label:"Puntos",icon:"⭐"},
  {key:"rates",label:"Tarifas",icon:"📊"},
  {key:"profile",label:"Mi perfil",icon:"👤"},
];
const ADMIN_NAV=[
  {key:"operations",label:"Operaciones",icon:"📦"},
  {key:"clients",label:"Clientes",icon:"👥"},
  {key:"finance",label:"Finanzas",icon:"💰"},
  {key:"warehouse",label:"Depósito",icon:"🏭"},
];
const AGENT_NAV=[
  {key:"packages",label:"Cargar paquetes",icon:"📥"},
  {key:"orders",label:"Órdenes",icon:"📋"},
];

function WorldMap(){
  const dots=[[120,80],[135,85],[150,78],[165,90],[180,85],[200,95],[215,88],[230,92],[250,100],[265,95],[280,105],[300,98],[320,110],[335,105],[350,115],[370,108],[390,120],[410,112],[430,125],[450,118],[470,130],[490,122],[510,135],[530,128],[550,140],[570,132],[590,145],[610,138],[630,150],[140,120],[160,130],[180,125],[200,140],[220,135],[240,145],[260,138],[280,150],[300,142],[320,155],[340,148],[360,158],[380,152],[400,162],[420,155],[440,165],[460,158],[480,170],[500,162],[520,175],[540,168],[560,180],[580,172],[600,185],[620,178],[180,170],[200,180],[220,175],[240,185],[260,178],[280,190],[300,185],[320,195],[340,188],[360,200],[380,192],[400,205],[420,198],[440,210],[460,202],[480,215],[500,208],[520,220],[540,212],[250,230],[270,240],[290,235],[310,245],[330,238],[350,250],[370,242],[390,255],[410,248],[430,258],[450,252],[470,262],[490,255],[160,65],[180,60],[200,55],[220,62],[240,58],[260,65],[280,60],[300,55],[320,62],[340,58],[360,65],[380,58],[400,62],[420,55],[440,60],[460,55],[480,62],[500,58],[520,52],[540,58]];
  const lines=[[200,95,450,118],[300,98,520,135],[180,125,400,162],[280,150,500,208],[350,115,570,132],[220,175,440,210],[160,65,390,120],[320,62,550,140],[250,230,470,262],[140,120,360,158]];
  return <svg width="100%" height="100%" viewBox="0 0 750 320" preserveAspectRatio="xMidYMid slice" style={{position:"absolute",inset:0,opacity:0.06,pointerEvents:"none"}}>
    {lines.map((l,i)=><line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#4A90D9" strokeWidth="0.5" opacity="0.4"/>)}
    {dots.map((d,i)=><circle key={i} cx={d[0]} cy={d[1]} r={1.5} fill="#4A90D9" opacity="0.5"/>)}
  </svg>;
}

// ========= AUTH COMPONENTS =========
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
      {ph&&<option value="" style={{background:"#0c1930"}}>{ph}</option>}
      {options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value} style={{background:"#0c1930",color:"#fff"}}>{typeof o==="string"?o:o.label}</option>)}
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
function StatusBadge({status}){const s=STATUS_MAP[status]||{label:status,color:"#999",bg:"rgba(255,255,255,0.1)"};return <span style={{display:"inline-block",fontSize:11,fontWeight:600,padding:"4px 12px",borderRadius:8,background:s.bg,color:s.color}}>{s.label}</span>;}
function formatDate(d){if(!d)return"—";return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});}
const ST=["Datos personales","Dirección","Condición fiscal"];

function AuthPage({children}){
  return <div style={{minHeight:"100vh",display:"flex",position:"relative",overflow:"hidden",fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif"}}>
    <div style={{position:"absolute",inset:0,background:`linear-gradient(160deg,#060d18 0%,${B.dark} 40%,#0a1e3d 70%,#061224 100%)`}}/>
    <div style={{position:"absolute",inset:0}}><WorldMap/></div>
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1rem",position:"relative",zIndex:3}}>
      <div style={{maxWidth:420,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <img src={LOGO} alt="Argencargo" style={{width:220,height:"auto",filter:"drop-shadow(0 0 20px rgba(74,144,217,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.3))"}}/>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"10px 0 0",letterSpacing:"0.04em"}}>Soluciones integrales de comercio exterior</p>
        </div>
        <div style={{background:"rgba(12,25,45,0.8)",backdropFilter:"blur(24px)",borderRadius:20,padding:"2rem 1.75rem",border:"1px solid rgba(255,255,255,0.06)",boxShadow:"0 30px 60px rgba(0,0,0,0.5)"}}>{children}</div>
        <p style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:16}}>Argencargo © 2026</p>
      </div>
    </div>
  </div>;
}

// ========= DASHBOARD SHELL (dark theme with sidebar) =========
function DashShell({children,page,setPage,role,client,user,onLogout}){
  const name=client?`${client.first_name} ${client.last_name}`:user?.email||"Usuario";
  const code=client?.client_code||"";
  const nav=role==="admin"?ADMIN_NAV:role==="agente"?AGENT_NAV:CLIENT_NAV;

  return <div style={{minHeight:"100vh",display:"flex",fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif",background:`linear-gradient(160deg,#060d18 0%,${B.dark} 50%,#0a1e3d 100%)`,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,pointerEvents:"none"}}><WorldMap/></div>

    {/* Sidebar */}
    <div style={{width:220,flexShrink:0,background:"rgba(0,0,0,0.25)",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",position:"relative",zIndex:2}}>
      {/* Logo */}
      <div style={{padding:"20px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <img src={LOGO} alt="Argencargo" style={{width:"100%",height:"auto",maxHeight:50,objectFit:"contain"}}/>
      </div>

      {/* Client code badge */}
      {code&&<div style={{padding:"16px 16px 8px",textAlign:"center"}}>
        <div style={{display:"inline-block",padding:"6px 16px",borderRadius:8,background:"rgba(74,144,217,0.15)",border:"1px solid rgba(74,144,217,0.25)"}}>
          <p style={{fontSize:10,color:"rgba(255,255,255,0.45)",margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Tu código</p>
          <p style={{fontSize:18,fontWeight:700,color:"#60a5fa",margin:0,letterSpacing:"0.12em",fontFamily:"monospace"}}>{code}</p>
        </div>
      </div>}

      {/* Nav items */}
      <nav style={{flex:1,padding:"12px 8px"}}>
        {nav.map(item=>(
          <button key={item.key} onClick={()=>setPage(item.key)} style={{
            width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",marginBottom:4,
            borderRadius:10,border:"none",cursor:"pointer",transition:"all 0.15s",fontSize:13,fontWeight:500,
            background:page===item.key?"rgba(74,144,217,0.2)":"transparent",
            color:page===item.key?"#60a5fa":"rgba(255,255,255,0.55)",
            borderLeft:page===item.key?`3px solid ${B.accent}`:"3px solid transparent",
          }}>
            <span style={{fontSize:18}}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* User info at bottom */}
      <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(74,144,217,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:13,color:"#60a5fa"}}>
            {(client?.first_name?.[0]||user?.email?.[0]||"U").toUpperCase()}{(client?.last_name?.[0]||"").toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,0.85)",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</p>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.35)",margin:0}}>{role==="admin"?"Admin":role==="agente"?"Agente":"Cliente"}</p>
          </div>
        </div>
        <button onClick={onLogout} style={{width:"100%",padding:"8px",fontSize:12,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:500}}>Cerrar sesión</button>
      </div>
    </div>

    {/* Main content */}
    <div style={{flex:1,overflow:"auto",position:"relative",zIndex:2}}>
      <div style={{maxWidth:960,margin:"0 auto",padding:"32px 32px"}}>
        {children}
      </div>
    </div>
  </div>;
}

// ========= OPERATIONS LIST =========
function OperationsList({ops,onSelect}){
  const active=ops.filter(o=>o.status!=="entregada"&&o.status!=="cancelada");
  const past=ops.filter(o=>o.status==="entregada"||o.status==="cancelada");

  const stats=[
    {label:"Total envíos",value:ops.length,color:"#60a5fa"},
    {label:"En curso",value:active.length,color:"#fbbf24"},
    {label:"Entregados",value:past.filter(o=>o.status==="entregada").length,color:"#22c55e"},
  ];

  const renderOp=(op)=>(
    <div key={op.id} onClick={()=>onSelect(op)} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"1rem 1.25rem",cursor:"pointer",transition:"all 0.2s"}}
      onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.07)";e.currentTarget.style.borderColor="rgba(74,144,217,0.3)";}}
      onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><span style={{fontSize:12,fontWeight:700,color:B.accent,fontFamily:"monospace"}}>{op.operation_code}</span><p style={{fontSize:15,fontWeight:500,color:"#fff",margin:"4px 0 6px"}}>{op.description}</p><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><StatusBadge status={op.status}/><span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{CHANNEL_MAP[op.channel]}</span></div></div>
        <div style={{textAlign:"right",flexShrink:0,marginLeft:16}}><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>Valor declarado</p><p style={{fontSize:16,fontWeight:600,color:"#fff",margin:0}}>USD {Number(op.declared_value_usd).toLocaleString()}</p>{op.eta&&<p style={{fontSize:11,color:"rgba(255,255,255,0.35)",margin:"4px 0 0"}}>ETA: {formatDate(op.eta)}</p>}</div>
      </div>
    </div>
  );

  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:28}}>
      {stats.map((s,i)=><div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"16px 20px"}}>
        <p style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.4)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</p>
        <p style={{fontSize:28,fontWeight:700,color:s.color,margin:0}}>{s.value}</p>
      </div>)}
    </div>
    {active.length>0&&<><h3 style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.5)",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.06em"}}>En curso ({active.length})</h3><div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>{active.map(renderOp)}</div></>}
    {past.length>0&&<><h3 style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.35)",margin:"0 0 12px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Finalizadas ({past.length})</h3><div style={{display:"flex",flexDirection:"column",gap:10}}>{past.map(renderOp)}</div></>}
    {ops.length===0&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.4)",fontSize:14,padding:"3rem 0"}}>No tenés operaciones todavía.</p>}
  </div>;
}

// ========= OPERATION DETAIL =========
function OperationDetail({op,token,onBack}){
  const [items,setItems]=useState([]);const [events,setEvents]=useState([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{const [it,ev]=await Promise.all([dq("operation_items",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`}),dq("tracking_events",{token,filters:`?operation_id=eq.${op.id}&select=*&order=occurred_at.desc`})]);setItems(Array.isArray(it)?it:[]);setEvents(Array.isArray(ev)?ev:[]);setLoading(false);})();},[op.id,token]);
  const steps=["pendiente","en_deposito_origen","en_preparacion","en_transito","en_aduana","lista_retiro","entregada"];
  const currentIdx=steps.indexOf(op.status);

  return <div>
    <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:B.accent,background:"none",border:"none",cursor:"pointer",fontWeight:500,marginBottom:20,padding:0}}>← Volver</button>

    <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,border:"1px solid rgba(255,255,255,0.08)",padding:"1.5rem",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><span style={{fontSize:12,fontWeight:700,color:B.accent,fontFamily:"monospace"}}>{op.operation_code}</span><h2 style={{fontSize:20,fontWeight:600,color:"#fff",margin:"4px 0 8px"}}>{op.description}</h2><div style={{display:"flex",gap:8}}><StatusBadge status={op.status}/><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{CHANNEL_MAP[op.channel]}</span></div></div>
        <div style={{textAlign:"right",flexShrink:0,marginLeft:16}}><p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>Valor declarado</p><p style={{fontSize:24,fontWeight:700,color:"#fff",margin:0}}>USD {Number(op.declared_value_usd).toLocaleString()}</p></div>
      </div>

      {op.status!=="cancelada"&&<div style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center"}}>{steps.map((s,i)=>{const active=i<=currentIdx;const isCurrent=i===currentIdx;return <div key={s} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"none"}}><div style={{width:isCurrent?14:8,height:isCurrent?14:8,borderRadius:"50%",background:active?"#60a5fa":"rgba(255,255,255,0.15)",boxShadow:isCurrent?"0 0 0 4px rgba(96,165,250,0.25)":"none",flexShrink:0,transition:"all 0.3s"}}/>{i<steps.length-1&&<div style={{flex:1,height:2,background:i<currentIdx?"#60a5fa":"rgba(255,255,255,0.08)"}}/>}</div>;})}</div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}><span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>Pendiente</span><span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>Entregada</span></div>
      </div>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:16}}>
        {[{l:"NCM",v:op.ncm_code||"—"},{l:"Cantidad",v:op.total_quantity?`${op.total_quantity} uds`:"—"},{l:"ETA",v:formatDate(op.eta)},{l:"Tracking proveedor",v:op.supplier_tracking||"—"},{l:"Tracking internacional",v:op.international_tracking||"—"},{l:"Carrier",v:op.international_carrier||"—"}].map((x,i)=><div key={i}><p style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.35)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{x.l}</p><p style={{fontSize:13,color:"rgba(255,255,255,0.85)",margin:0,fontWeight:500,wordBreak:"break-all"}}>{x.v}</p></div>)}
      </div>
    </div>

    {!loading&&items.length>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,border:"1px solid rgba(255,255,255,0.08)",padding:"1.25rem 1.5rem",marginBottom:16}}>
      <h3 style={{fontSize:14,fontWeight:600,color:"#fff",margin:"0 0 14px"}}>Productos</h3>
      {items.map((it,i)=><div key={it.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none"}}><div><p style={{fontSize:14,color:"rgba(255,255,255,0.85)",margin:0,fontWeight:500}}>{it.description}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:"2px 0 0"}}>NCM: {it.ncm_code||"—"} · {it.quantity} uds</p></div><p style={{fontSize:14,fontWeight:600,color:"#fff",margin:0}}>USD {(Number(it.unit_price_usd)*it.quantity).toLocaleString()}</p></div>)}
    </div>}

    {!loading&&events.length>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,border:"1px solid rgba(255,255,255,0.08)",padding:"1.25rem 1.5rem"}}>
      <h3 style={{fontSize:14,fontWeight:600,color:"#fff",margin:"0 0 14px"}}>Seguimiento</h3>
      <div style={{position:"relative",paddingLeft:24}}>
        <div style={{position:"absolute",left:7,top:8,bottom:8,width:2,background:"rgba(255,255,255,0.08)"}}/>
        {events.map((ev,i)=><div key={ev.id} style={{position:"relative",paddingBottom:i<events.length-1?20:0}}>
          <div style={{position:"absolute",left:-19,top:6,width:12,height:12,borderRadius:"50%",background:i===0?"#60a5fa":"rgba(255,255,255,0.15)",boxShadow:i===0?"0 0 0 4px rgba(96,165,250,0.2)":"none"}}/>
          <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><p style={{fontSize:14,fontWeight:600,color:i===0?"#fff":"rgba(255,255,255,0.5)",margin:0}}>{ev.title}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:0,whiteSpace:"nowrap",marginLeft:12}}>{formatDate(ev.occurred_at)}</p></div>
            {ev.description&&<p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"3px 0 0"}}>{ev.description}</p>}
            {ev.location&&<p style={{fontSize:12,color:"rgba(255,255,255,0.3)",margin:"2px 0 0"}}>📍 {ev.location}</p>}</div>
        </div>)}
      </div>
    </div>}
    {loading&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.4)",padding:"2rem 0"}}>Cargando...</p>}
  </div>;
}

// ========= PROFILE PAGE =========
function ProfilePage({client}){
  if(!client) return null;
  const fields=[{l:"Nombre",v:`${client.first_name} ${client.last_name}`},{l:"Código de cliente",v:client.client_code,mono:true},{l:"Email",v:client.email},{l:"WhatsApp",v:client.whatsapp},{l:"Dirección",v:`${client.street}${client.floor_apt?`, ${client.floor_apt}`:""}`},{l:"Localidad",v:`${client.city}, ${client.province}`},{l:"Código postal",v:client.postal_code},{l:"Condición IVA",v:client.tax_condition==="responsable_inscripto"?"Resp. Inscripto":client.tax_condition==="monotributista"?"Monotributista":"Consumidor final"}];
  if(client.tax_condition==="responsable_inscripto"){fields.push({l:"Empresa",v:client.company_name||"—"},{l:"CUIT",v:client.cuit||"—"});}

  return <div>
    <h2 style={{fontSize:20,fontWeight:600,color:"#fff",margin:"0 0 4px"}}>Mi perfil</h2>
    <p style={{fontSize:14,color:"rgba(255,255,255,0.4)",margin:"0 0 24px"}}>Tus datos personales y de facturación</p>
    <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,border:"1px solid rgba(255,255,255,0.08)",padding:"1.5rem"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        {fields.map((f,i)=><div key={i}>
          <p style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.35)",margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{f.l}</p>
          <p style={{fontSize:15,color:"rgba(255,255,255,0.9)",margin:0,fontWeight:500,...(f.mono?{fontFamily:"monospace",fontSize:18,color:"#60a5fa",letterSpacing:"0.1em"}:{})}}>{f.v}</p>
        </div>)}
      </div>
    </div>
    <div style={{background:"rgba(74,144,217,0.1)",borderRadius:12,border:"1px solid rgba(74,144,217,0.2)",padding:"16px 20px",marginTop:16}}>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.7)",margin:0,lineHeight:1.6}}>📦 Tu código de cliente es <strong style={{color:"#60a5fa",fontFamily:"monospace",letterSpacing:"0.1em"}}>{client.client_code}</strong>. Incluilo en todos los paquetes que envíes a nuestro depósito para que podamos identificarlos.</p>
    </div>
  </div>;
}

// ========= DASHBOARD =========
function Dashboard({profile,client,user,token,onLogout}){
  const role=profile?.role||"cliente";
  const [page,setPage]=useState(role==="cliente"?"imports":role==="admin"?"operations":"packages");
  const [ops,setOps]=useState([]);const [selectedOp,setSelectedOp]=useState(null);const [loadingOps,setLoadingOps]=useState(false);

  const loadOps=async()=>{setLoadingOps(true);const r=await dq("operations",{token,filters:"?select=*&order=created_at.desc"});setOps(Array.isArray(r)?r:[]);setLoadingOps(false);};
  useEffect(()=>{if(page==="imports"||page==="operations")loadOps();},[page]);

  const pageTitle={imports:"Mis importaciones",calculator:"Calculadora",account:"Estado de cuenta",points:"Puntos",rates:"Tarifas",profile:"Mi perfil",operations:"Operaciones",clients:"Clientes",finance:"Finanzas",warehouse:"Depósito",packages:"Cargar paquetes",orders:"Órdenes"};

  return <DashShell page={page} setPage={(p)=>{setPage(p);setSelectedOp(null);}} role={role} client={client} user={user} onLogout={onLogout}>
    {(page==="imports"||page==="operations")&&!selectedOp&&<>
      <h2 style={{fontSize:20,fontWeight:600,color:"#fff",margin:"0 0 4px"}}>{pageTitle[page]}</h2>
      <p style={{fontSize:14,color:"rgba(255,255,255,0.4)",margin:"0 0 24px"}}>Seguimiento de tus envíos e importaciones</p>
      {loadingOps?<p style={{textAlign:"center",color:"rgba(255,255,255,0.4)",padding:"3rem 0"}}>Cargando...</p>:<OperationsList ops={ops} onSelect={setSelectedOp}/>}
    </>}
    {(page==="imports"||page==="operations")&&selectedOp&&<OperationDetail op={selectedOp} token={token} onBack={()=>setSelectedOp(null)}/>}
    {page==="profile"&&<ProfilePage client={client}/>}
    {!["imports","operations","profile"].includes(page)&&<div style={{textAlign:"center",padding:"4rem 0"}}>
      <h2 style={{fontSize:20,fontWeight:600,color:"#fff",margin:"0 0 8px"}}>{pageTitle[page]}</h2>
      <p style={{fontSize:14,color:"rgba(255,255,255,0.4)",margin:"0 0 24px"}}>Sección en desarrollo</p>
      <div style={{display:"inline-block",padding:"12px 24px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.5)",fontSize:13}}>Próximamente disponible</div>
    </div>}
  </DashShell>;
}

// ========= APP =========
export default function Page(){
  const [view,setView]=useState("login");const [step,setStep]=useState(0);const [form,setForm]=useState(INIT);const [errors,setErrors]=useState({});const [loading,setLoading]=useState(false);const [gErr,setGErr]=useState("");const [okMsg,setOkMsg]=useState("");const [session,setSession]=useState(null);const [client,setClient]=useState(null);const [profile,setProfile]=useState(null);
  const ch=f=>e=>{setForm(p=>({...p,[f]:e.target.value}));setErrors(p=>({...p,[f]:undefined}));setGErr("");};
  const val=s=>{const e={};if(s===0){if(!form.first_name.trim())e.first_name="Requerido";if(!form.last_name.trim())e.last_name="Requerido";if(!form.whatsapp.trim())e.whatsapp="Requerido";if(!form.email.trim())e.email="Requerido";else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))e.email="Email inválido";if(!form.password)e.password="Requerido";else if(form.password.length<6)e.password="Mínimo 6 caracteres";if(form.password!==form.confirm_password)e.confirm_password="No coinciden";}if(s===1){if(!form.street.trim())e.street="Requerido";if(!form.postal_code.trim())e.postal_code="Requerido";if(!form.city.trim())e.city="Requerido";if(!form.province)e.province="Requerido";}if(s===2&&form.tax_condition==="responsable_inscripto"){if(!form.company_name.trim())e.company_name="Requerido";if(!form.cuit.trim())e.cuit="Requerido";}setErrors(e);return !Object.keys(e).length;};
  const genCode=(fn,ln)=>(fn.substring(0,3)+ln.substring(0,3)).toUpperCase();
  const doRegister=async()=>{if(!val(2))return;setLoading(true);setGErr("");try{const a=await ac("signup",{email:form.email,password:form.password,data:{role:"cliente"}});if(a.error){setGErr(a.error.message||"Error");setLoading(false);return;}if(!a.access_token){setOkMsg("Te enviamos un email de confirmación. Revisá tu bandeja de entrada.");setLoading(false);return;}const code=genCode(form.first_name.trim(),form.last_name.trim());const c=await dq("clients",{method:"POST",token:a.access_token,body:{auth_user_id:a.user.id,first_name:form.first_name.trim(),last_name:form.last_name.trim(),whatsapp:form.whatsapp.trim(),email:form.email.trim(),tax_condition:form.tax_condition,company_name:form.tax_condition==="responsable_inscripto"?form.company_name.trim():null,cuit:form.tax_condition==="responsable_inscripto"?form.cuit.trim():null,street:form.street.trim(),floor_apt:form.floor_apt.trim()||null,postal_code:form.postal_code.trim(),city:form.city.trim(),province:form.province,client_code:code}});if(c.error){setGErr("Cuenta creada pero error guardando datos.");setLoading(false);return;}setSession({token:a.access_token,user:a.user});setClient(Array.isArray(c)?c[0]:c);setProfile({role:"cliente"});}catch{setGErr("Error de conexión.");}setLoading(false);};
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
