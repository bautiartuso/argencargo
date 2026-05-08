"use client";
import { useState, useEffect } from "react";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const LOGO=`${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
const BG="radial-gradient(1200px 600px at 80% -10%, rgba(184,149,106,0.10), transparent 60%), radial-gradient(900px 700px at -10% 100%, rgba(96,165,250,0.06), transparent 50%), #0A1628";
const GOLD="#B8956A", GOLD_LIGHT="#E8D098", GOLD_DEEP="#A68456";
const GOLD_GRADIENT="linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";

const sf=async(p,o={})=>{const r=await fetch(`${SB_URL}${p}`,{...o,headers:{apikey:SB_KEY,"Content-Type":"application/json",...(o.headers||{})}});return {status:r.status,body:await r.json().catch(()=>null)};};
const ac=async(e,b)=>{const r=await sf(`/auth/v1/${e}`,{method:"POST",body:JSON.stringify(b)});return r.body;};
const jwtExp=(t)=>{try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).exp*1000;}catch{return 0;}};
let _refresh=null;
const refreshToken=async()=>{
  if(_refresh)return _refresh;
  _refresh=(async()=>{
    const s=loadSession();if(!s?.refresh_token)return null;
    const r=await ac("token?grant_type=refresh_token",{refresh_token:s.refresh_token});
    if(r?.access_token){const ns={access_token:r.access_token,refresh_token:r.refresh_token||s.refresh_token,user:r.user||s.user};saveSession(ns);return ns.access_token;}
    clearSession();if(typeof window!=="undefined")window.location.reload();return null;
  })();
  try{return await _refresh;}finally{_refresh=null;}
};
const ensureFresh=async(t)=>{const e=jwtExp(t);if(e&&Date.now()>e-60000){const s=loadSession();if(s?.access_token&&jwtExp(s.access_token)>Date.now()+60000)return s.access_token;const nt=await refreshToken();if(nt)return nt;}return t;};
const _sanitize=(b)=>{if(!b||typeof b!=="object")return b;const o={};for(const k in b){o[k]=b[k]===""?null:b[k];}return o;};
const dq=async(t,{method="GET",body,token,filters=""})=>{
  const fresh=await ensureFresh(token);
  const cb=(method==="PATCH"||method==="POST")?_sanitize(body):body;
  const doReq=(tk)=>sf(`/rest/v1/${t}${filters}`,{method,body:cb?JSON.stringify(cb):undefined,headers:{Authorization:`Bearer ${tk}`,...(method==="POST"?{Prefer:"return=representation"}:method==="PATCH"?{Prefer:"return=representation"}:{})}});
  let r=await doReq(fresh);
  if(r.status===401){const nt=await refreshToken();if(nt)r=await doReq(nt);}
  if(r.status>=400)console.error(`[dq] ${method} ${t} ${r.status}`,r.body);
  return r.body;
};
const saveSession=(d)=>{try{localStorage.setItem("ac_gi_s",JSON.stringify(d));}catch(e){}};
const loadSession=()=>{try{const d=localStorage.getItem("ac_gi_s");return d?JSON.parse(d):null;}catch(e){return null;}};
const clearSession=()=>{try{localStorage.removeItem("ac_gi_s");}catch(e){}};
const fmtDate=(d)=>{if(!d)return"—";const s=String(d).slice(0,10);const[y,m,day]=s.split("-");return new Date(y,m-1,day).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});};
const fmtUSD=(n)=>"USD "+Number(n||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});

// ────────────────────────────────────────────
// PAGE ENTRY
// ────────────────────────────────────────────
export default function GIPage(){
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");

  useEffect(()=>{(async()=>{
    const s=loadSession();
    if(!s?.access_token){setLoading(false);return;}
    // Verificar perfil tiene is_gi_partner=true OR role=admin
    const p=await dq("profiles",{token:s.access_token,filters:`?id=eq.${s.user.id}&select=id,role,is_gi_partner,first_name,last_name,email`});
    if(Array.isArray(p)&&p[0]){
      const prof=p[0];
      if(prof.is_gi_partner===true||prof.role==="admin"){
        setSession(s);setProfile(prof);
      } else {
        setErr("Tu cuenta no tiene acceso al panel de Gestión Integral. Contactá al administrador.");
        clearSession();
      }
    } else {
      setErr("No se pudo cargar tu perfil.");
      clearSession();
    }
    setLoading(false);
  })();},[]);

  if(loading)return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,color:"rgba(255,255,255,0.4)",fontFamily:"'Inter','Segoe UI',sans-serif"}}>Cargando…</div>;
  if(!session)return <Login onLogin={(s,p)=>{setSession(s);setProfile(p);setErr("");}} initialErr={err}/>;
  return <Shell session={session} profile={profile} onLogout={()=>{clearSession();setSession(null);setProfile(null);}}/>;
}

// ────────────────────────────────────────────
// LOGIN
// ────────────────────────────────────────────
function Login({onLogin,initialErr}){
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState(initialErr||"");
  const [lo,setLo]=useState(false);
  const submit=async(e)=>{e?.preventDefault?.();
    if(!email||!pass)return;
    setLo(true);setErr("");
    const r=await ac("token?grant_type=password",{email,password:pass});
    if(!r.access_token){setErr(r.error_description||r.msg||"Credenciales inválidas");setLo(false);return;}
    // Verificar acceso GI
    const p=await dq("profiles",{token:r.access_token,filters:`?id=eq.${r.user.id}&select=id,role,is_gi_partner,first_name,last_name,email`});
    if(!Array.isArray(p)||!p[0]){setErr("Perfil no encontrado");setLo(false);return;}
    const prof=p[0];
    if(prof.is_gi_partner!==true&&prof.role!=="admin"){
      setErr("Tu cuenta no tiene acceso al panel de Gestión Integral.");
      setLo(false);return;
    }
    const sess={access_token:r.access_token,refresh_token:r.refresh_token,user:r.user};
    saveSession(sess);
    onLogin(sess,prof);
    setLo(false);
  };
  return <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1rem",fontFamily:"'Inter','Segoe UI',sans-serif"}}>
    <div style={{maxWidth:400,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:22}}>
        <img src={LOGO} alt="Argencargo" style={{width:200,height:"auto",filter:"drop-shadow(0 4px 24px rgba(184,149,106,0.28))"}}/>
        <p style={{fontSize:11,fontWeight:700,letterSpacing:"0.22em",color:GOLD_LIGHT,textTransform:"uppercase",marginTop:10}}>Gestión Integral</p>
      </div>
      <form onSubmit={submit} style={{background:"rgba(10,22,40,0.72)",backdropFilter:"blur(28px)",borderRadius:16,padding:"2rem 1.75rem",border:"1px solid rgba(255,255,255,0.06)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:GOLD_GRADIENT,opacity:0.85}}/>
        <h2 style={{fontSize:20,fontWeight:700,color:"#fff",textAlign:"center",margin:"0 0 22px"}}>Iniciar sesión</h2>
        {err&&<div style={{padding:"10px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:10,fontSize:12.5,color:"#ff6b6b",marginBottom:14}}>{err}</div>}
        <Field label="Email" value={email} onChange={setEmail} type="email"/>
        <Field label="Contraseña" value={pass} onChange={setPass} type="password"/>
        <button type="submit" disabled={lo} style={{width:"100%",padding:"11px 16px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:lo?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:lo?"wait":"pointer",letterSpacing:"0.04em",marginTop:6,fontFamily:"inherit"}}>{lo?"Ingresando…":"Ingresar"}</button>
      </form>
    </div>
  </div>;
}

function Field({label,value,onChange,type="text"}){
  return <div style={{marginBottom:12}}>
    <label style={{fontSize:10.5,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:5}}>{label}</label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"10px 12px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none",fontFamily:"inherit"}}/>
  </div>;
}

// ────────────────────────────────────────────
// SHELL
// ────────────────────────────────────────────
function Shell({session,profile,onLogout}){
  const [pane,setPane]=useState("resumen");
  const token=session.access_token;
  const initials=(profile?.first_name?.[0]||"")+(profile?.last_name?.[0]||"");

  // Counts para badges
  const [pendingQuotes,setPendingQuotes]=useState(0);
  const reloadCounts=async()=>{
    const r=await dq("gi_quote_requests",{token,filters:"?status=in.(pending,quoting)&select=id"});
    setPendingQuotes(Array.isArray(r)?r.length:0);
  };
  useEffect(()=>{reloadCounts();const iv=setInterval(reloadCounts,30000);return()=>clearInterval(iv);},[token]);

  const NAV=[
    {sec:"Inicio",items:[
      {k:"resumen",l:"Resumen",p:["M3 12l2-2 4 4 6-6 6 6","M3 20h18"]},
    ]},
    {sec:"Operativa",items:[
      {k:"operations",l:"Operaciones",p:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"]},
      {k:"quotes",l:"Cotizaciones",p:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8"],badge:pendingQuotes},
    ]},
    {sec:"Finanzas",items:[
      {k:"dashboard",l:"Dashboard",p:["M3 3v18h18","M18 17V9","M13 17V5","M8 17v-3"]},
      {k:"ledger",l:"Libro diario",p:["M4 19.5A2.5 2.5 0 0 1 6.5 17H20","M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"]},
    ]},
    {sec:"Contactos",items:[
      {k:"suppliers",l:"Proveedores",p:["M3 7h18l-2 12H5L3 7z","M8 7V5a4 4 0 0 1 8 0v2"]},
      {k:"agents",l:"Agentes de compra",p:["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"]},
      {k:"forwarders",l:"Embarcadores",p:["M3 17l3-3 4 4 8-8 3 3","M21 6V3h-3"]},
    ]},
    {sec:"Configuración",items:[
      {k:"settings",l:"Tarifas y T&C",p:["M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z","M7 7h.01"]},
    ]},
  ];

  return <div style={{minHeight:"100vh",display:"flex",fontFamily:"'Inter','Segoe UI',sans-serif",background:"#0A1628",color:"#fff",overflow:"hidden"}}>
    {/* Sidebar */}
    <aside style={{width:240,background:"rgba(0,0,0,0.28)",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",flexShrink:0,position:"fixed",left:0,top:0,bottom:0,zIndex:5}}>
      <div style={{padding:"22px 20px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <img src={LOGO} alt="Argencargo" style={{height:32,width:"auto"}}/>
          <span style={{fontSize:9,fontWeight:800,padding:"3px 8px",borderRadius:5,background:GOLD_GRADIENT,color:"#0A1628",letterSpacing:"0.16em"}}>GI</span>
        </div>
      </div>
      <nav style={{flex:1,padding:"10px 10px 14px",overflowY:"auto"}}>
        {NAV.map(s=><div key={s.sec} style={{marginTop:14}}>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.32)",margin:"0 0 6px",padding:"0 14px",textTransform:"uppercase",letterSpacing:"0.14em"}}>{s.sec}</p>
          {s.items.map(it=>{const active=pane===it.k;return <button key={it.k} onClick={()=>setPane(it.k)} style={{width:"100%",display:"flex",alignItems:"center",gap:11,padding:"8px 14px",marginBottom:1,borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:active?700:500,background:active?"linear-gradient(90deg,rgba(184,149,106,0.10),rgba(184,149,106,0.02))":"transparent",color:active?"#fff":"rgba(255,255,255,0.55)",position:"relative",fontFamily:"inherit",transition:"all 150ms"}} onMouseEnter={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.color="rgba(255,255,255,0.9)";}}} onMouseLeave={e=>{if(!active){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.55)";}}}>
            {active&&<span style={{position:"absolute",left:-10,top:6,bottom:6,width:3,background:GOLD_GRADIENT,borderRadius:"0 3px 3px 0"}}/>}
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={active?GOLD_LIGHT:"rgba(255,255,255,0.5)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,opacity:0.95}}>{it.p.map((d,i)=><path key={i} d={d}/>)}</svg>
            <span style={{flex:1,textAlign:"left"}}>{it.l}</span>
            {it.badge>0&&<span style={{background:GOLD_GRADIENT,color:"#0A1628",fontSize:9.5,fontWeight:800,padding:"2px 7px",borderRadius:8,minWidth:18,textAlign:"center",border:`1px solid ${GOLD_DEEP}`}}>{it.badge}</span>}
          </button>;})}
        </div>)}
      </nav>
      <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,rgba(184,149,106,0.22),rgba(184,149,106,0.08))",border:"1px solid rgba(184,149,106,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:GOLD_LIGHT}}>{initials||"GI"}</div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:12.5,fontWeight:600,color:"#fff",margin:0}}>{[profile?.first_name,profile?.last_name].filter(Boolean).join(" ")||"Socio GI"}</p>
            <p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",margin:"1px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{profile?.role==="admin"?"Admin":"Socio · GI"}</p>
          </div>
        </div>
        <button onClick={onLogout} style={{width:"100%",padding:"7px 10px",fontSize:11.5,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:600,letterSpacing:"0.04em",fontFamily:"inherit"}}>Cerrar sesión</button>
      </div>
    </aside>

    {/* Main */}
    <main style={{flex:1,marginLeft:240,padding:"32px 36px",overflowY:"auto",minHeight:"100vh"}}>
      <div style={{maxWidth:1280,margin:"0 auto"}}>
        {pane==="resumen"&&<PaneResumen token={token} onNav={setPane}/>}
        {pane==="quotes"&&<PaneQuotes token={token}/>}
        {pane==="settings"&&<PaneSettings token={token}/>}
        {pane==="operations"&&<Stub title="Operaciones GI" desc="Las cotizaciones aceptadas convertidas en ops aparecen acá."/>}
        {pane==="dashboard"&&<Stub title="Dashboard" desc="Resumen financiero (ganancias mensuales, ticket promedio, etc)."/>}
        {pane==="ledger"&&<Stub title="Libro diario" desc="Movimientos de finanzas GI con filtros por fecha y op."/>}
        {pane==="suppliers"&&<Stub title="Proveedores" desc="Listado de proveedores agrupados por rubro."/>}
        {pane==="agents"&&<Stub title="Agentes de compra" desc="Sourcing agents en China/USA."/>}
        {pane==="forwarders"&&<Stub title="Embarcadores" desc="Forwarders agrupados por ciudad."/>}
      </div>
    </main>
  </div>;
}

function Stub({title,desc}){
  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>{title}</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:22}}>{desc}</p>
    <div style={{padding:"40px 30px",textAlign:"center",background:"rgba(255,255,255,0.025)",border:"1px dashed rgba(255,255,255,0.12)",borderRadius:14,color:"rgba(255,255,255,0.4)",fontSize:13}}>
      Próximamente. Estamos construyendo esta sección.
    </div>
  </div>;
}

// ────────────────────────────────────────────
// PANE: RESUMEN
// ────────────────────────────────────────────
function PaneResumen({token,onNav}){
  const [reqs,setReqs]=useState([]);
  const [lo,setLo]=useState(true);
  useEffect(()=>{(async()=>{
    const r=await dq("gi_quote_requests",{token,filters:"?select=*,clients(first_name,last_name,client_code),gi_quote_request_products(id,quantity)&order=created_at.desc&limit=20"});
    setReqs(Array.isArray(r)?r:[]);
    setLo(false);
  })();},[token]);
  const pending=reqs.filter(r=>["pending","quoting"].includes(r.status));
  const sent=reqs.filter(r=>r.status==="sent");
  const accepted=reqs.filter(r=>r.status==="accepted"||r.status==="converted");

  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>Resumen</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:24}}>Estado general de tu actividad en Gestión Integral.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>
      <Kpi label="Pendientes de cotizar" val={pending.length} sub={pending.length>0?`Más reciente: ${fmtDate(pending[0]?.created_at)}`:"Al día"} color="#fbbf24"/>
      <Kpi label="Enviadas a clientes" val={sent.length} sub="Esperando respuesta"/>
      <Kpi label="Aceptadas" val={accepted.length} sub="Esta semana" color="#22c55e"/>
      <Kpi label="Total cotizaciones" val={reqs.length} sub="Últimos 20"/>
    </div>

    <Card title="Cotizaciones pendientes" actionLabel="Ver todas →" onAction={()=>onNav("quotes")}>
      {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:pending.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"1.5rem 0"}}>No hay cotizaciones pendientes 🎉</p>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Código</th>
            <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Cliente</th>
            <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Productos</th>
            <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Recibida</th>
          </tr></thead>
          <tbody>
            {pending.slice(0,5).map(r=>{const cn=r.clients?`${r.clients.first_name||""} ${r.clients.last_name||""}`.trim():"—";const pcount=r.gi_quote_request_products?.length||0;return <tr key={r.id} onClick={()=>onNav("quotes")} style={{cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <td style={{padding:"11px 12px",fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:GOLD_LIGHT,letterSpacing:"0.04em"}}>{r.request_code}</td>
              <td style={{padding:"11px 12px",fontWeight:600}}>{cn}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.55)"}}>{pcount} {pcount===1?"producto":"productos"}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.5)"}}>{fmtDate(r.created_at)}</td>
            </tr>;})}
          </tbody>
        </table>
      }
    </Card>
  </div>;
}

function Kpi({label,val,sub,color}){
  return <div style={{background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"18px 20px"}}>
    <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{label}</p>
    <p style={{fontSize:26,fontWeight:800,letterSpacing:"-0.02em",color:color||"#fff",fontFeatureSettings:'"tnum"'}}>{val}</p>
    {sub&&<p style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:6}}>{sub}</p>}
  </div>;
}

function Card({title,children,actionLabel,onAction}){
  return <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",margin:0}}>{title}</h3>
      {actionLabel&&<button onClick={onAction} style={{padding:"5px 10px",fontSize:11,fontWeight:600,borderRadius:6,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontFamily:"inherit"}}>{actionLabel}</button>}
    </div>
    {children}
  </div>;
}

// ────────────────────────────────────────────
// PANE: COTIZACIONES (lista de gi_quote_requests + detalle)
// ────────────────────────────────────────────
function PaneQuotes({token}){
  const [reqs,setReqs]=useState([]);
  const [lo,setLo]=useState(true);
  const [tab,setTab]=useState("pending");
  const [selDetail,setSelDetail]=useState(null);
  const load=async()=>{
    setLo(true);
    const r=await dq("gi_quote_requests",{token,filters:"?select=*,clients(first_name,last_name,client_code),gi_quote_request_products(*)&order=created_at.desc"});
    setReqs(Array.isArray(r)?r:[]);
    setLo(false);
  };
  useEffect(()=>{load();},[token]);

  const tabs=[
    {k:"pending",l:"Pendientes",f:r=>["pending","quoting"].includes(r.status)},
    {k:"quoted",l:"Cotizadas",f:r=>r.status==="quoted"},
    {k:"sent",l:"Enviadas a cliente",f:r=>r.status==="sent"},
    {k:"accepted",l:"Aceptadas",f:r=>r.status==="accepted"||r.status==="converted"},
    {k:"rejected",l:"Rechazadas/Expiradas",f:r=>["rejected","expired"].includes(r.status)},
  ];
  const filtered=reqs.filter(tabs.find(t=>t.k===tab).f);

  if(selDetail){
    return <RequestDetail token={token} requestId={selDetail} onBack={()=>{setSelDetail(null);load();}}/>;
  }

  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>Cotizaciones</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:22}}>Solicitudes pedidas por el admin para que armes la cotización.</p>

    <div style={{display:"flex",gap:4,borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:18,flexWrap:"wrap"}}>
      {tabs.map(t=>{const n=reqs.filter(t.f).length;return <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"9px 14px",fontSize:12,fontWeight:600,color:tab===t.k?GOLD_LIGHT:"rgba(255,255,255,0.5)",background:"transparent",border:"none",borderBottom:`2px solid ${tab===t.k?GOLD_LIGHT:"transparent"}`,cursor:"pointer",fontFamily:"inherit"}}>{t.l} <span style={{marginLeft:5,fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:tab===t.k?"rgba(184,149,106,0.15)":"rgba(255,255,255,0.06)",color:tab===t.k?GOLD_LIGHT:"rgba(255,255,255,0.5)"}}>{n}</span></button>;})}
    </div>

    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:filtered.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"3rem 0"}}>No hay cotizaciones en esta vista.</p>:
      <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.22)"}}>
            <th style={{textAlign:"left",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Código</th>
            <th style={{textAlign:"left",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Cliente</th>
            <th style={{textAlign:"left",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Productos</th>
            <th style={{textAlign:"left",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Cantidad</th>
            <th style={{textAlign:"left",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Recibida</th>
            <th style={{textAlign:"left",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Vence</th>
            <th></th>
          </tr></thead>
          <tbody>
            {filtered.map(r=>{const cn=r.clients?`${r.clients.first_name||""} ${r.clients.last_name||""}`.trim():"—";const pcount=r.gi_quote_request_products?.length||0;const totalQty=(r.gi_quote_request_products||[]).reduce((s,p)=>s+Number(p.quantity||0),0);
              return <tr key={r.id} onClick={()=>setSelDetail(r.id)} style={{cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.04)",transition:"background 120ms"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(184,149,106,0.05)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"13px 14px",fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:GOLD_LIGHT,letterSpacing:"0.04em"}}>{r.request_code}</td>
                <td style={{padding:"13px 14px",fontWeight:600,color:"#fff"}}>{cn}{r.clients?.client_code&&<span style={{marginLeft:6,fontSize:10,color:"rgba(255,255,255,0.4)"}}>· {r.clients.client_code}</span>}</td>
                <td style={{padding:"13px 14px",color:"rgba(255,255,255,0.65)"}}>{pcount} {pcount===1?"producto":"productos"}</td>
                <td style={{padding:"13px 14px",color:"rgba(255,255,255,0.65)",fontFeatureSettings:'"tnum"'}}>{totalQty>0?`${totalQty} u.`:"—"}</td>
                <td style={{padding:"13px 14px",color:"rgba(255,255,255,0.5)"}}>{fmtDate(r.created_at)}</td>
                <td style={{padding:"13px 14px",color:"rgba(255,255,255,0.5)"}}>{r.expires_at?fmtDate(r.expires_at):"—"}</td>
                <td style={{padding:"13px 14px",textAlign:"right"}}><button style={{padding:"5px 10px",fontSize:10.5,fontWeight:700,borderRadius:6,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit"}}>Ver →</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    }
  </div>;
}

function RequestDetail({token,requestId,onBack}){
  const [req,setReq]=useState(null);
  const [lo,setLo]=useState(true);
  useEffect(()=>{(async()=>{
    const r=await dq("gi_quote_requests",{token,filters:`?id=eq.${requestId}&select=*,clients(*),gi_quote_request_products(*)`});
    setReq(Array.isArray(r)?r[0]:null);
    setLo(false);
  })();},[requestId,token]);

  if(lo)return <p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>;
  if(!req)return <p style={{color:"rgba(255,255,255,0.4)"}}>Solicitud no encontrada</p>;
  const cn=req.clients?`${req.clients.first_name||""} ${req.clients.last_name||""}`.trim():"—";
  const products=(req.gi_quote_request_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));

  return <div>
    <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,0.55)",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontWeight:600,marginBottom:18,padding:"6px 12px",borderRadius:8,letterSpacing:"0.04em",fontFamily:"inherit"}}>← Volver</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14,marginBottom:6}}>
      <div>
        <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}><span style={{color:GOLD_LIGHT,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.04em"}}>{req.request_code}</span> · {cn}</h1>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>Pedida {fmtDate(req.created_at)}{req.expires_at?` · Vence ${fmtDate(req.expires_at)}`:""}</p>
      </div>
      <button style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit"}}>Armar cotización →</button>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:18}}>
      <Card title="Cliente">
        <p style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:4}}>{cn}</p>
        {req.clients?.client_code&&<p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)"}}>Código: <span style={{fontFamily:"monospace",color:GOLD_LIGHT}}>{req.clients.client_code}</span></p>}
        {req.clients?.email&&<p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",marginTop:3}}>Email: {req.clients.email}</p>}
        {req.clients?.whatsapp&&<p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",marginTop:3}}>WhatsApp: {req.clients.whatsapp}</p>}
        {req.clients?.city&&<p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",marginTop:3}}>Ciudad: {req.clients.city}{req.clients.province?`, ${req.clients.province}`:""}</p>}
      </Card>
      {req.notes&&<Card title="Notas del admin">
        <p style={{fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{req.notes}</p>
      </Card>}
    </div>

    <Card title={`Productos (${products.length})`}>
      {products.length===0?<p style={{color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>Sin productos cargados</p>:
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {products.map((p,i)=><div key={p.id} style={{display:"flex",gap:14,alignItems:"center",padding:"12px 14px",background:"rgba(0,0,0,0.18)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"rgba(184,149,106,0.15)",color:GOLD_LIGHT,fontWeight:800,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:13.5,fontWeight:700,color:"#fff",margin:0}}>{p.description||"—"}</p>
              {p.notes&&<p style={{fontSize:11.5,color:"rgba(255,255,255,0.55)",margin:"3px 0 0"}}>{p.notes}</p>}
            </div>
            {p.quantity>0&&<div style={{textAlign:"right",flexShrink:0}}><p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Cant.</p><p style={{fontSize:15,fontWeight:700,color:GOLD_LIGHT,fontFeatureSettings:'"tnum"'}}>{p.quantity}</p></div>}
          </div>)}
        </div>
      }
    </Card>

    <div style={{padding:"12px 16px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:10,fontSize:12,color:"rgba(255,255,255,0.8)",lineHeight:1.5,marginTop:10}}>
      <strong style={{color:"#60a5fa"}}>Próximo paso:</strong> el cotizador está en construcción. Cuando esté listo vas a poder armar la cotización completa con NCM automático, costos por canal y % honorarios.
    </div>
  </div>;
}

// ────────────────────────────────────────────
// PANE: SETTINGS (Tarifas + Oficina + T&C)
// ────────────────────────────────────────────
function PaneSettings({token}){
  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>Configuración</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:22}}>Tarifas de envío, datos de oficina y términos &amp; condiciones que aparecen en la cotización al cliente.</p>
    <SettingsRates token={token}/>
    <SettingsOffice token={token}/>
    <SettingsTerms token={token}/>
  </div>;
}

function SettingsRates({token}){
  const [rates,setRates]=useState([]);
  const [lo,setLo]=useState(true);
  const [editId,setEditId]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3000);};

  const load=async()=>{
    setLo(true);
    const r=await dq("gi_shipping_rates",{token,filters:"?select=*&order=display_order.asc"});
    setRates(Array.isArray(r)?r:[]);
    setLo(false);
  };
  useEffect(()=>{load();},[token]);

  const startEdit=(r)=>{
    setEditId(r.id);
    setEditForm({zone:r.zone||"",max_kg:r.max_kg||"",max_cbm:r.max_cbm||"",cost_usd:r.cost_usd||"",cost_ars:r.cost_ars||"",notes:r.notes||""});
  };
  const cancelEdit=()=>{setEditId(null);setEditForm({});};
  const saveEdit=async()=>{
    setSaving(true);
    const body={
      zone:editForm.zone,
      max_kg:editForm.max_kg!==""?Number(editForm.max_kg):null,
      max_cbm:editForm.max_cbm!==""?Number(editForm.max_cbm):null,
      cost_usd:editForm.cost_usd!==""?Number(editForm.cost_usd):null,
      cost_ars:editForm.cost_ars!==""?Number(editForm.cost_ars):null,
      notes:editForm.notes||null,
    };
    if(editId==="new"){
      body.display_order=rates.length+1;
      await dq("gi_shipping_rates",{method:"POST",token,body});
      flash("Tarifa creada");
    } else {
      await dq("gi_shipping_rates",{method:"PATCH",token,filters:`?id=eq.${editId}`,body});
      flash("Tarifa actualizada");
    }
    cancelEdit();
    setSaving(false);
    load();
  };
  const removeRate=async(id)=>{
    if(!confirm("¿Borrar esta tarifa?"))return;
    await dq("gi_shipping_rates",{method:"DELETE",token,filters:`?id=eq.${id}`});
    flash("Tarifa eliminada");
    load();
  };
  const addNew=()=>{
    setEditId("new");
    setEditForm({zone:"",max_kg:"",max_cbm:"",cost_usd:"",cost_ars:"",notes:""});
  };

  return <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18,position:"relative"}}>
    {msg&&<div style={{position:"absolute",top:14,right:14,background:"rgba(34,197,94,0.18)",border:"1px solid rgba(34,197,94,0.4)",color:"#22c55e",padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600}}>{msg}</div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>Tarifas de envío a domicilio</h3>
      <button onClick={addNew} disabled={editId!==null} style={{padding:"6px 12px",fontSize:11.5,fontWeight:700,borderRadius:8,border:"none",background:editId!==null?"rgba(184,149,106,0.3)":GOLD_GRADIENT,color:"#0A1628",cursor:editId!==null?"not-allowed":"pointer",fontFamily:"inherit"}}>+ Nueva tarifa</button>
    </div>
    <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5}}>Aplican cuando el cliente elige &quot;envío a domicilio&quot; en la cotización. El sistema toma el peso facturable y le suma el costo según la zona.</p>
    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Zona</th>
          <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Hasta kg</th>
          <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Hasta CBM</th>
          <th style={{textAlign:"right",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>USD</th>
          <th style={{textAlign:"right",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>ARS</th>
          <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Notas</th>
          <th></th>
        </tr></thead>
        <tbody>
          {rates.map(r=>editId===r.id?
            <tr key={r.id}>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.zone} on={v=>setEditForm(f=>({...f,zone:v}))}/></td>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.max_kg} on={v=>setEditForm(f=>({...f,max_kg:v}))} num/></td>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.max_cbm} on={v=>setEditForm(f=>({...f,max_cbm:v}))} num/></td>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.cost_usd} on={v=>setEditForm(f=>({...f,cost_usd:v}))} num/></td>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.cost_ars} on={v=>setEditForm(f=>({...f,cost_ars:v}))} num/></td>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.notes} on={v=>setEditForm(f=>({...f,notes:v}))}/></td>
              <td style={{padding:"8px 10px",textAlign:"right",whiteSpace:"nowrap"}}>
                <button onClick={saveEdit} disabled={saving} style={{padding:"4px 9px",fontSize:10.5,fontWeight:700,borderRadius:5,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",marginRight:4}}>✓</button>
                <button onClick={cancelEdit} style={{padding:"4px 9px",fontSize:10.5,borderRadius:5,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer"}}>✕</button>
              </td>
            </tr>:
            <tr key={r.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <td style={{padding:"11px 12px",fontWeight:600,color:"#fff"}}>{r.zone}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.7)",fontFeatureSettings:'"tnum"'}}>{r.max_kg?(r.max_kg>=9999?"+":r.max_kg+" kg"):"—"}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.7)",fontFeatureSettings:'"tnum"'}}>{r.max_cbm?(r.max_cbm>=9999?"+":r.max_cbm+" m³"):"—"}</td>
              <td style={{padding:"11px 12px",color:GOLD_LIGHT,fontWeight:600,textAlign:"right",fontFeatureSettings:'"tnum"'}}>{r.cost_usd?fmtUSD(r.cost_usd):"—"}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.7)",textAlign:"right",fontFeatureSettings:'"tnum"'}}>{r.cost_ars?"ARS "+Number(r.cost_ars).toLocaleString("es-AR"):"—"}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.5)",fontStyle:r.notes?"italic":"normal"}}>{r.notes||"—"}</td>
              <td style={{padding:"11px 12px",textAlign:"right",whiteSpace:"nowrap"}}>
                <button onClick={()=>startEdit(r)} style={{padding:"4px 9px",fontSize:10.5,borderRadius:5,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>✎</button>
                <button onClick={()=>removeRate(r.id)} style={{padding:"4px 9px",fontSize:10.5,borderRadius:5,border:"1px solid rgba(248,113,113,0.25)",background:"transparent",color:"#f87171",cursor:"pointer",fontFamily:"inherit"}}>✕</button>
              </td>
            </tr>
          )}
          {editId==="new"&&<tr style={{background:"rgba(184,149,106,0.04)"}}>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.zone} on={v=>setEditForm(f=>({...f,zone:v}))} ph="Zona"/></td>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.max_kg} on={v=>setEditForm(f=>({...f,max_kg:v}))} num ph="50"/></td>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.max_cbm} on={v=>setEditForm(f=>({...f,max_cbm:v}))} num ph="0.3"/></td>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.cost_usd} on={v=>setEditForm(f=>({...f,cost_usd:v}))} num ph="35"/></td>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.cost_ars} on={v=>setEditForm(f=>({...f,cost_ars:v}))} num ph="38500"/></td>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.notes} on={v=>setEditForm(f=>({...f,notes:v}))} ph="Opcional"/></td>
            <td style={{padding:"8px 10px",textAlign:"right",whiteSpace:"nowrap"}}>
              <button onClick={saveEdit} disabled={saving||!editForm.zone} style={{padding:"4px 9px",fontSize:10.5,fontWeight:700,borderRadius:5,border:"none",background:!editForm.zone?"rgba(184,149,106,0.3)":GOLD_GRADIENT,color:"#0A1628",cursor:!editForm.zone?"not-allowed":"pointer",marginRight:4}}>✓</button>
              <button onClick={cancelEdit} style={{padding:"4px 9px",fontSize:10.5,borderRadius:5,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer"}}>✕</button>
            </td>
          </tr>}
        </tbody>
      </table>
    }
  </div>;
}

function EditInp({v,on,num,ph}){
  return <input value={v||""} onChange={e=>{const val=e.target.value;if(num){if(val===""||/^-?\d*\.?\d*$/.test(val))on(val);}else on(val);}} placeholder={ph||""} style={{width:"100%",padding:"6px 8px",fontSize:11.5,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:5,background:"rgba(0,0,0,0.25)",color:"#fff",outline:"none",fontFamily:"inherit"}}/>;
}

function SettingsOffice({token}){
  const [data,setData]=useState(null);
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3000);};

  useEffect(()=>{(async()=>{
    const r=await dq("gi_settings",{token,filters:"?select=*&limit=1"});
    if(Array.isArray(r)&&r[0]){setData(r[0]);setForm({office_address:r[0].office_address||"",office_locality:r[0].office_locality||"",office_hours:r[0].office_hours||"",office_phone:r[0].office_phone||""});}
  })();},[token]);

  const save=async()=>{
    if(!data?.id)return;
    setSaving(true);
    await dq("gi_settings",{method:"PATCH",token,filters:`?id=eq.${data.id}`,body:{...form,updated_at:new Date().toISOString()}});
    flash("Guardado");
    setSaving(false);
  };

  if(!data)return null;
  return <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18,position:"relative"}}>
    {msg&&<div style={{position:"absolute",top:14,right:14,background:"rgba(34,197,94,0.18)",border:"1px solid rgba(34,197,94,0.4)",color:"#22c55e",padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600}}>{msg}</div>}
    <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Datos de retiro por oficina</h3>
    <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5}}>Aparecen en la cotización al cliente cuando elige &quot;retiro por oficina&quot;.</p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <Field2 label="Dirección" v={form.office_address} on={v=>setForm(f=>({...f,office_address:v}))}/>
      <Field2 label="Localidad" v={form.office_locality} on={v=>setForm(f=>({...f,office_locality:v}))}/>
      <Field2 label="Horario" v={form.office_hours} on={v=>setForm(f=>({...f,office_hours:v}))}/>
      <Field2 label="Teléfono / WhatsApp" v={form.office_phone} on={v=>setForm(f=>({...f,office_phone:v}))}/>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}>
      <button onClick={save} disabled={saving} style={{padding:"8px 18px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",background:saving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Guardando…":"Guardar cambios"}</button>
    </div>
  </div>;
}

function SettingsTerms({token}){
  const [data,setData]=useState(null);
  const [text,setText]=useState("");
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3000);};
  useEffect(()=>{(async()=>{
    const r=await dq("gi_settings",{token,filters:"?select=*&limit=1"});
    if(Array.isArray(r)&&r[0]){setData(r[0]);setText(r[0].terms_and_conditions||"");}
  })();},[token]);

  const save=async()=>{
    if(!data?.id)return;
    setSaving(true);
    await dq("gi_settings",{method:"PATCH",token,filters:`?id=eq.${data.id}`,body:{terms_and_conditions:text,updated_at:new Date().toISOString()}});
    flash("Guardado");
    setSaving(false);
  };

  if(!data)return null;
  return <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18,position:"relative"}}>
    {msg&&<div style={{position:"absolute",top:14,right:14,background:"rgba(34,197,94,0.18)",border:"1px solid rgba(34,197,94,0.4)",color:"#22c55e",padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600}}>{msg}</div>}
    <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Términos y condiciones</h3>
    <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5}}>Aparecen en la cotización del cliente, en el desplegable de T&amp;C. Acepta saltos de línea.</p>
    <textarea value={text} onChange={e=>setText(e.target.value)} rows={14} style={{width:"100%",padding:"12px 14px",fontSize:12.5,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(0,0,0,0.25)",color:"#fff",outline:"none",fontFamily:"'JetBrains Mono','SF Mono',monospace",lineHeight:1.6,resize:"vertical"}}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,flexWrap:"wrap",gap:10}}>
      <p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)"}}>Última edición: {fmtDate(data.updated_at)}</p>
      <button onClick={save} disabled={saving} style={{padding:"8px 18px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",background:saving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Guardando…":"Guardar"}</button>
    </div>
  </div>;
}

function Field2({label,v,on}){
  return <div>
    <label style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:5}}>{label}</label>
    <input value={v||""} onChange={e=>on(e.target.value)} style={{width:"100%",padding:"9px 12px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none",fontFamily:"inherit"}}/>
  </div>;
}
