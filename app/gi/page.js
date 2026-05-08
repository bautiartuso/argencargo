"use client";
import { useState, useEffect } from "react";
import { calcOpBudget } from "../../lib/calc";

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
    const p=await dq("profiles",{token:s.access_token,filters:`?id=eq.${s.user.id}&select=id,role,is_gi_partner,email`});
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
    const p=await dq("profiles",{token:r.access_token,filters:`?id=eq.${r.user.id}&select=id,role,is_gi_partner,email`});
    if(!Array.isArray(p)||!p[0]){setErr("Perfil no encontrado");setLo(false);return;}
    const prof=p[0];
    if(prof.is_gi_partner!==true&&prof.role!=="admin"){
      setErr("Tu cuenta no tiene acceso al panel de Gestión Integral. Pedile al admin que te active.");
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
        <h2 style={{fontSize:20,fontWeight:700,color:"#fff",textAlign:"center",margin:"0 0 6px"}}>Iniciar sesión</h2>
        <p style={{fontSize:11.5,color:"rgba(255,255,255,0.4)",textAlign:"center",margin:"0 0 18px"}}>Acceso restringido al socio GI</p>
        {err&&<div style={{padding:"10px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:10,fontSize:12.5,color:"#ff6b6b",marginBottom:14}}>{err}</div>}
        <Field label="Email" value={email} onChange={setEmail} type="email"/>
        <Field label="Contraseña" value={pass} onChange={setPass} type="password"/>
        <button type="submit" disabled={lo} style={{width:"100%",padding:"11px 16px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:lo?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:lo?"wait":"pointer",letterSpacing:"0.04em",marginTop:6,fontFamily:"inherit"}}>{lo?"Ingresando…":"Ingresar"}</button>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",textAlign:"center",marginTop:14,lineHeight:1.5}}>¿No tenés cuenta? El admin la crea por vos y te pasa las credenciales.</p>
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
  const displayName=profile?.email||"Socio GI";
  const initials=(profile?.email||"GI").slice(0,2).toUpperCase();

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
            <p style={{fontSize:12.5,fontWeight:600,color:"#fff",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName}</p>
            <p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",margin:"1px 0 0"}}>{profile?.role==="admin"?"Admin":"Socio · GI"}</p>
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
        {pane==="operations"&&<PaneOps token={token}/>}
        {pane==="dashboard"&&<PaneDashboard token={token}/>}
        {pane==="ledger"&&<PaneLedger token={token}/>}
        {pane==="suppliers"&&<ContactsPanel token={token} type="suppliers" title="Proveedores" desc="Listado de proveedores agrupados por rubro." groupBy="rubro" rubroOptions={["Indumentaria","Electrónica","Calzado","Hogar","Cosmética","Juguetería","Deportes","Otros"]} fields={[{k:"name",l:"Nombre",req:true},{k:"rubro",l:"Rubro",select:true},{k:"country",l:"País",options:["China","USA"]},{k:"city",l:"Ciudad"},{k:"email",l:"Email"},{k:"phone",l:"Teléfono"},{k:"wechat",l:"WeChat"},{k:"moq",l:"MOQ",num:true},{k:"lead_time_days",l:"Lead time (días)",num:true},{k:"notes",l:"Notas",textarea:true}]}/>}
        {pane==="agents"&&<ContactsPanel token={token} type="purchase_agents" title="Agentes de compra" desc="Sourcing agents en China/USA." groupBy="rubro" rubroOptions={["Indumentaria","Electrónica","Calzado","General","Otros"]} fields={[{k:"name",l:"Nombre",req:true},{k:"rubro",l:"Rubro",select:true},{k:"base_city",l:"Ciudad base"},{k:"email",l:"Email"},{k:"phone",l:"Teléfono"},{k:"wechat",l:"WeChat"},{k:"commission_pct",l:"Comisión %",num:true},{k:"commission_fixed_usd",l:"Comisión fija USD",num:true},{k:"notes",l:"Notas",textarea:true}]}/>}
        {pane==="forwarders"&&<ContactsPanel token={token} type="forwarders" title="Embarcadores" desc="Forwarders agrupados por ciudad." groupBy="city" rubroOptions={["Shanghái","Guangzhou","Shenzhen","Yiwu","Ningbo","Miami","Los Ángeles","Otros"]} fields={[{k:"name",l:"Nombre",req:true},{k:"city",l:"Ciudad",select:true},{k:"email",l:"Email"},{k:"phone",l:"Teléfono"},{k:"modes_str",l:"Modos (coma separado)",placeholder:"aereo,maritimo"},{k:"notes",l:"Notas",textarea:true}]}/>}
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
  const [clients,setClients]=useState([]);
  const [lo,setLo]=useState(true);
  const [tab,setTab]=useState("pending");
  const [selDetail,setSelDetail]=useState(null);
  const [wizardId,setWizardId]=useState(null);
  const [creatingNew,setCreatingNew]=useState(false);
  const [newClientId,setNewClientId]=useState("");
  const [newClientSearch,setNewClientSearch]=useState("");
  const [showClientList,setShowClientList]=useState(false);
  const [newSaving,setNewSaving]=useState(false);

  const load=async()=>{
    setLo(true);
    const [r,cl]=await Promise.all([
      dq("gi_quote_requests",{token,filters:"?select=*,clients(first_name,last_name,client_code),gi_quote_request_products(*)&order=created_at.desc"}),
      dq("clients",{token,filters:"?select=id,first_name,last_name,client_code&order=first_name.asc"}),
    ]);
    setReqs(Array.isArray(r)?r:[]);
    setClients(Array.isArray(cl)?cl:[]);
    setLo(false);
  };
  useEffect(()=>{load();},[token]);

  if(wizardId){
    return <CotizadorWizard token={token} requestId={wizardId} onBack={()=>{setWizardId(null);setSelDetail(null);load();}}/>;
  }

  const startDirectQuote=async()=>{
    if(!newClientId){alert("Seleccioná un cliente");return;}
    setNewSaving(true);
    try{
      const code=await dq("rpc/gi_next_request_code",{method:"POST",token,body:{}});
      if(typeof code!=="string"||!code.startsWith("GI-"))throw new Error("No se pudo generar código");
      const inserted=await dq("gi_quote_requests",{method:"POST",token,body:{
        request_code:code,
        client_id:newClientId,
        notes:"Cotización iniciada directamente desde panel GI",
        status:"quoting",
        expires_at:new Date(Date.now()+7*86400000).toISOString().slice(0,10),
      }});
      const reqId=Array.isArray(inserted)?inserted[0]?.id:inserted?.id;
      if(!reqId)throw new Error("No se pudo crear la solicitud");
      setCreatingNew(false);
      setWizardId(reqId);
    } catch(e){
      alert("Error: "+e.message);
    } finally {
      setNewSaving(false);
    }
  };

  const filteredClients=clients.filter(c=>{
    const q=(newClientSearch||"").toLowerCase().trim();
    if(!q)return clients.length<=15;
    const name=`${c.first_name||""} ${c.last_name||""}`.toLowerCase();
    return name.includes(q)||(c.client_code||"").toLowerCase().includes(q);
  }).slice(0,8);

  const selectClient=(c)=>{
    setNewClientId(c.id);
    setNewClientSearch(`${c.first_name||""} ${c.last_name||""}`.trim()+(c.client_code?` (${c.client_code})`:""));
    setShowClientList(false);
  };

  const tabs=[
    {k:"pending",l:"Pendientes",f:r=>["pending","quoting"].includes(r.status)},
    {k:"quoted",l:"Cotizadas",f:r=>r.status==="quoted"},
    {k:"sent",l:"Enviadas a cliente",f:r=>r.status==="sent"},
    {k:"accepted",l:"Aceptadas",f:r=>r.status==="accepted"||r.status==="converted"},
    {k:"rejected",l:"Rechazadas/Expiradas",f:r=>["rejected","expired"].includes(r.status)},
  ];
  const filtered=reqs.filter(tabs.find(t=>t.k===tab).f);

  if(selDetail){
    return <RequestDetail token={token} requestId={selDetail} onBack={()=>{setSelDetail(null);load();}} onStartWizard={()=>setWizardId(selDetail)}/>;
  }

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:6}}>
      <div>
        <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>Cotizaciones</h1>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>Solicitudes del admin + las que armás directamente.</p>
      </div>
      <button onClick={()=>{setCreatingNew(true);setNewClientId("");setNewClientSearch("");}} style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit"}}>+ Nueva cotización</button>
    </div>

    {creatingNew&&<div style={{marginTop:18,marginBottom:18,padding:18,background:"rgba(184,149,106,0.06)",border:"1.5px solid rgba(184,149,106,0.3)",borderRadius:12}}>
      <h3 style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 12px"}}>Nueva cotización directa</h3>
      <p style={{fontSize:11.5,color:"rgba(255,255,255,0.6)",marginBottom:14}}>Empezás directo sin esperar al admin. Elegí el cliente (debe estar registrado en Argencargo) y arrancás el wizard.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 200px",gap:10,alignItems:"end"}}>
        <div style={{position:"relative"}}>
          <label style={lblStyle()}>Cliente</label>
          <input value={newClientSearch} onChange={e=>{setNewClientSearch(e.target.value);setNewClientId("");setShowClientList(true);}} onFocus={()=>setShowClientList(true)} placeholder="Buscar por nombre o código..." style={{...inpStyle(),padding:"9px 12px",fontSize:13,border:`1px solid ${newClientId?"rgba(34,197,94,0.4)":"rgba(255,255,255,0.12)"}`}}/>
          {showClientList&&filteredClients.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,background:"#142038",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,maxHeight:240,overflowY:"auto",zIndex:50,boxShadow:"0 12px 30px rgba(0,0,0,0.5)"}}>
            {filteredClients.map(c=><button key={c.id} onClick={()=>selectClient(c)} style={{width:"100%",textAlign:"left",padding:"9px 12px",fontSize:12.5,background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(184,149,106,0.08)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <strong>{`${c.first_name||""} ${c.last_name||""}`.trim()}</strong>
              <span style={{fontFamily:"monospace",fontSize:10.5,color:GOLD_LIGHT}}>{c.client_code||""}</span>
            </button>)}
          </div>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"end",height:"100%"}}>
          <button onClick={()=>setCreatingNew(false)} style={{flex:1,padding:"9px 14px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
          <button onClick={startDirectQuote} disabled={!newClientId||newSaving} style={{flex:1.5,padding:"9px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",background:!newClientId||newSaving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:!newClientId||newSaving?"not-allowed":"pointer",fontFamily:"inherit"}}>{newSaving?"Creando…":"Iniciar →"}</button>
        </div>
      </div>
    </div>}

    <div style={{display:"flex",gap:4,borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:18,marginTop:18,flexWrap:"wrap"}}>
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

function RequestDetail({token,requestId,onBack,onStartWizard}){
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
      <button onClick={onStartWizard} style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit"}}>Armar cotización →</button>
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

  </div>;
}

// ────────────────────────────────────────────
// COTIZADOR WIZARD (3 steps)
// ────────────────────────────────────────────
const CHANNEL_DEFS=[
  {key:"aereo_negro",name:"Aéreo Courier Comercial",time:"7 a 10 días hábiles"},
  {key:"aereo_blanco",name:"Aéreo Integral AC",time:"10 a 15 días hábiles"},
  {key:"maritimo_negro",name:"Marítimo LCL/FCL",time:"~ 60 días"},
  {key:"maritimo_blanco",name:"Marítimo Integral AC",time:"~ 60 días"},
];

function CotizadorWizard({token,requestId,onBack}){
  const [step,setStep]=useState(1);
  const [request,setRequest]=useState(null);
  const [client,setClient]=useState(null);
  const [tariffs,setTariffs]=useState([]);
  const [config,setConfig]=useState({});
  const [products,setProducts]=useState([]);
  const [paymentPlan,setPaymentPlan]=useState([
    {pct:30,label:"Inicio de producción"},
    {pct:20,label:"Producción terminada"},
    {pct:50,label:"Contra entrega"},
  ]);
  const [lo,setLo]=useState(true);
  const [generatedQuote,setGeneratedQuote]=useState(null);
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3500);};

  // Cargar todo
  useEffect(()=>{(async()=>{
    setLo(true);
    const [reqRes,tar,cfg]=await Promise.all([
      dq("gi_quote_requests",{token,filters:`?id=eq.${requestId}&select=*,clients(*),gi_quote_request_products(*)`}),
      dq("tariffs",{token,filters:"?select=*&type=eq.rate&order=sort_order.asc"}),
      dq("calc_config",{token,filters:"?select=*"})
    ]);
    if(Array.isArray(reqRes)&&reqRes[0]){
      const r=reqRes[0];
      setRequest(r);
      setClient(r.clients);
      const rawProds=(r.gi_quote_request_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
      setProducts(rawProds.map((p,i)=>({
        _id:p.id,
        description:p.description||"",
        notes:p.notes||"",
        origin:"china",
        quantity:String(p.quantity||""),
        unit_cost_usd:"",
        lead_time_days:"",
        photo_url:p.photo_url||"",
        ncm_code:"",
        ncm_description:"",
        import_duty_rate:"",
        statistics_rate:"",
        iva_rate:"",
        ncm_loading:false,
        ncm_error:false,
        pkg_count:"1",
        pkg_length_cm:"",
        pkg_width_cm:"",
        pkg_height_cm:"",
        pkg_weight_kg:"",
      })));
    }
    setTariffs(Array.isArray(tar)?tar:[]);
    const cfgObj={};(Array.isArray(cfg)?cfg:[]).forEach(r=>{cfgObj[r.key]=Number(r.value);});setConfig(cfgObj);
    setLo(false);
  })();},[requestId,token]);

  const updateProduct=(i,field,value)=>setProducts(p=>p.map((x,j)=>j===i?{...x,[field]:value}:x));
  const addProduct=()=>setProducts(p=>[...p,{description:"",notes:"",origin:"china",quantity:"",unit_cost_usd:"",lead_time_days:"",photo_url:"",ncm_code:"",ncm_description:"",import_duty_rate:"",statistics_rate:"",iva_rate:"",ncm_loading:false,ncm_error:false,pkg_count:"1",pkg_length_cm:"",pkg_width_cm:"",pkg_height_cm:"",pkg_weight_kg:""}]);
  const removeProduct=(i)=>setProducts(p=>p.length>1?p.filter((_,j)=>j!==i):p);

  const classifyNcm=async(i)=>{
    const p=products[i];
    if(!p.description?.trim())return;
    updateProduct(i,"ncm_loading",true);updateProduct(i,"ncm_error",false);
    try{
      const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:p.description})});
      const d=await r.json();
      if(d.fallback||d.error){
        setProducts(prods=>prods.map((x,j)=>j===i?{...x,ncm_loading:false,ncm_error:true}:x));
      } else {
        setProducts(prods=>prods.map((x,j)=>j===i?{...x,ncm_loading:false,ncm_error:false,ncm_code:d.ncm_code||"",ncm_description:d.ncm_description||"",import_duty_rate:String(d.import_duty_rate||""),statistics_rate:String(d.statistics_rate||""),iva_rate:String(d.iva_rate||"")}:x));
      }
    } catch(e){
      setProducts(prods=>prods.map((x,j)=>j===i?{...x,ncm_loading:false,ncm_error:true}:x));
    }
  };

  // Cálculo por canal: corre calcOpBudget para cada canal disponible
  const computeChannel=(channelKey)=>{
    const items=products.map(p=>({
      unit_price_usd:Number(p.unit_cost_usd||0),
      quantity:Number(p.quantity||0),
      import_duty_rate:p.import_duty_rate?Number(p.import_duty_rate):0,
      statistics_rate:p.statistics_rate?Number(p.statistics_rate):0,
      iva_rate:p.iva_rate?Number(p.iva_rate):21,
    }));
    // Convertir packing por producto a array global (multiplicando cada uno por su pkg_count y quantity)
    const pkgs=products.flatMap(p=>{
      if(!p.pkg_count||!p.pkg_length_cm)return [];
      return [{
        quantity:Number(p.pkg_count||1),
        gross_weight_kg:Number(p.pkg_weight_kg||0),
        length_cm:Number(p.pkg_length_cm||0),
        width_cm:Number(p.pkg_width_cm||0),
        height_cm:Number(p.pkg_height_cm||0),
      }];
    });
    const op={
      channel:channelKey,
      origin:products.some(p=>p.origin==="usa")?"USA":"China",
      has_battery:false,
      has_phones:false,
      shipping_to_door:false,
      shipping_cost:0,
      merchandise_value_usd:items.reduce((s,it)=>s+it.unit_price_usd*it.quantity,0),
    };
    try{
      return calcOpBudget(op,items,pkgs,tariffs,config,[],client);
    } catch(e){
      console.error(`[calc ${channelKey}]`,e);
      return null;
    }
  };

  const totalFob=products.reduce((s,p)=>s+Number(p.unit_cost_usd||0)*Number(p.quantity||0),0);
  const channelResults=CHANNEL_DEFS.map(ch=>{
    const r=computeChannel(ch.key);
    if(!r)return {...ch,total:0,real:0,error:true};
    // total al cliente (incluye margen de tarifa) y "real" (lo que pagamos a embarcadores) son iguales para ahora porque no tenemos costo real separado todavía
    // En MVP usamos totalAbonar como "total al cliente" y un % menor como "costo real" mock para mostrar spread
    const total=r.totalAbonar+totalFob;
    const real=total*0.92; // mock: 8% spread logístico (ajustable después en config)
    return {...ch,total,real,calc:r};
  });

  // Filtrar canales por origen
  const someUSA=products.some(p=>p.origin==="usa");
  const visibleChannels=someUSA
    ?channelResults.filter(c=>c.key.includes("negro")||c.key==="maritimo_blanco")
    :channelResults;

  // % comisión del cliente (sobre ganancia neta cuando cierra)
  const clientCommissionPct=Number(client?.gi_commission_pct||0);
  // Estimación de ganancia neta al cerrar = total al cliente - costo real (mock 92%)
  const profitFor=(c)=>{
    const totalAlCliente=c.total;
    const realCost=c.real; // mock 92% del total
    const netProfitEst=Math.max(0,totalAlCliente-realCost);
    const commissionEst=netProfitEst*clientCommissionPct/100;
    return {totalAlCliente,netProfitEst,commissionEst};
  };

  const validateStep1=()=>{
    if(products.length===0)return "Agregá al menos un producto";
    for(let i=0;i<products.length;i++){
      const p=products[i];
      if(!p.description?.trim())return `Producto ${i+1}: falta descripción`;
      if(!p.quantity||Number(p.quantity)<=0)return `Producto ${i+1}: falta cantidad`;
      if(!p.unit_cost_usd||Number(p.unit_cost_usd)<=0)return `Producto ${i+1}: falta costo unitario`;
      if(!p.pkg_length_cm||!p.pkg_width_cm||!p.pkg_height_cm||!p.pkg_weight_kg)return `Producto ${i+1}: faltan datos de embalaje`;
    }
    return null;
  };

  const goStep=(n)=>{
    if(n>1){const e=validateStep1();if(e){alert(e);return;}}
    setStep(n);
  };

  const generateLink=async()=>{
    setSaving(true);
    try{
      const ch=channelResults.reduce((acc,c)=>{
        if(c.key==="aereo_negro"){acc.cost_courier_total_usd=Math.round(c.total*100)/100;acc.cost_courier_real_usd=Math.round(c.real*100)/100;}
        else if(c.key==="aereo_blanco"){acc.cost_aereo_int_total_usd=Math.round(c.total*100)/100;acc.cost_aereo_int_real_usd=Math.round(c.real*100)/100;}
        else if(c.key==="maritimo_negro"){acc.cost_maritimo_lcl_total_usd=Math.round(c.total*100)/100;acc.cost_maritimo_lcl_real_usd=Math.round(c.real*100)/100;}
        else if(c.key==="maritimo_blanco"){acc.cost_maritimo_int_total_usd=Math.round(c.total*100)/100;acc.cost_maritimo_int_real_usd=Math.round(c.real*100)/100;}
        return acc;
      },{});
      const expDate=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
      const inserted=await dq("gi_quotes",{method:"POST",token,body:{
        request_id:requestId,
        honorarios_pct:clientCommissionPct, // snapshot del % del cliente al cotizar
        payment_plan:paymentPlan,
        ...ch,
        status:"draft",
        expires_at:expDate,
      }});
      const quoteId=Array.isArray(inserted)?inserted[0]?.id:inserted?.id;
      const publicToken=Array.isArray(inserted)?inserted[0]?.public_token:inserted?.public_token;
      if(!quoteId)throw new Error("No se pudo crear la cotización");
      // Insert productos
      for(let i=0;i<products.length;i++){
        const p=products[i];
        await dq("gi_quote_products",{method:"POST",token,body:{
          quote_id:quoteId,
          description:p.description,
          origin:p.origin,
          quantity:Number(p.quantity)||0,
          unit_cost_usd:Number(p.unit_cost_usd)||0,
          ncm_code:p.ncm_code||null,
          ncm_description:p.ncm_description||null,
          ncm_di_pct:p.import_duty_rate?Number(p.import_duty_rate):null,
          ncm_iva_pct:p.iva_rate?Number(p.iva_rate):null,
          ncm_estad_pct:p.statistics_rate?Number(p.statistics_rate):null,
          lead_time_days:p.lead_time_days?Number(p.lead_time_days):null,
          photo_url:p.photo_url||null,
          pkg_count:Number(p.pkg_count)||1,
          pkg_length_cm:Number(p.pkg_length_cm)||null,
          pkg_width_cm:Number(p.pkg_width_cm)||null,
          pkg_height_cm:Number(p.pkg_height_cm)||null,
          pkg_weight_kg:Number(p.pkg_weight_kg)||null,
          display_order:i,
        }});
      }
      // Update request status
      await dq("gi_quote_requests",{method:"PATCH",token,filters:`?id=eq.${requestId}`,body:{status:"quoted"}});
      setGeneratedQuote({id:quoteId,public_token:publicToken});
      setStep(3);
      flash("Cotización generada");
    } catch(e){
      alert("Error: "+e.message);
    } finally {
      setSaving(false);
    }
  };

  if(lo)return <p style={{color:"rgba(255,255,255,0.4)"}}>Cargando cotizador…</p>;
  if(!request)return <p style={{color:"rgba(255,255,255,0.4)"}}>Solicitud no encontrada</p>;
  const cn=client?`${client.first_name||""} ${client.last_name||""}`.trim():"—";

  const Step=({n,label,active,done})=><div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
    <span style={{width:26,height:26,borderRadius:"50%",background:done?"#22c55e":(active?GOLD_GRADIENT:"rgba(255,255,255,0.06)"),color:done?"#fff":(active?"#0A1628":"rgba(255,255,255,0.5)"),fontSize:12,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done?"✓":n}</span>
    <p style={{fontSize:12,fontWeight:600,color:active?"#fff":(done?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.5)"),margin:0,textTransform:"uppercase",letterSpacing:0}}>{label}</p>
  </div>;

  return <div>
    {msg&&<div style={{position:"fixed",top:20,right:20,background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",padding:"10px 16px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"0 12px 30px rgba(0,0,0,0.4)"}}>{msg}</div>}
    <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,0.55)",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontWeight:600,marginBottom:18,padding:"6px 12px",borderRadius:8,letterSpacing:"0.04em",fontFamily:"inherit"}}>← Volver</button>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14,marginBottom:6}}>
      <div>
        <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>Cotizador <span style={{color:GOLD_LIGHT,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.04em"}}>{request.request_code}</span></h1>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>Cliente: <strong style={{color:"#fff"}}>{cn}</strong></p>
      </div>
    </div>

    <div style={{display:"flex",alignItems:"center",gap:12,marginTop:18,marginBottom:24,padding:"14px 18px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12}}>
      <Step n={1} label="Productos & embalaje" active={step===1} done={step>1}/>
      <div style={{flex:"0 0 24px",height:1,background:step>1?"#22c55e":"rgba(255,255,255,0.1)"}}/>
      <Step n={2} label="Costos & honorarios" active={step===2} done={step>2}/>
      <div style={{flex:"0 0 24px",height:1,background:step>2?"#22c55e":"rgba(255,255,255,0.1)"}}/>
      <Step n={3} label="Link al cliente" active={step===3} done={false}/>
    </div>

    {step===1&&<WizStep1 products={products} onUpdate={updateProduct} onAdd={addProduct} onRemove={removeProduct} onClassify={classifyNcm} onNext={()=>goStep(2)} totalFob={totalFob}/>}
    {step===2&&<WizStep2 visibleChannels={visibleChannels} someUSA={someUSA} clientCommissionPct={clientCommissionPct} client={client} paymentPlan={paymentPlan} setPaymentPlan={setPaymentPlan} profitFor={profitFor} onBack={()=>setStep(1)} onNext={generateLink} saving={saving}/>}
    {step===3&&<WizStep3 generatedQuote={generatedQuote} onBack={onBack}/>}
  </div>;
}

function WizStep1({products,onUpdate,onAdd,onRemove,onClassify,onNext,totalFob}){
  return <div>
    <div style={{padding:"12px 16px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:10,fontSize:12.5,color:"rgba(255,255,255,0.85)",lineHeight:1.5,marginBottom:18}}>
      <strong style={{color:"#60a5fa"}}>Step 1:</strong> cargá cada producto con su packing. Si origen es <strong>China</strong> apretá "Clasificar NCM" para que el sistema busque el código y los aranceles. Si es <strong>USA</strong>, va canal B automáticamente.
    </div>
    {products.map((p,i)=><div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:18,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <h4 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>Producto {i+1}</h4>
        <button onClick={()=>onRemove(i)} disabled={products.length<=1} style={{padding:"5px 10px",fontSize:10.5,fontWeight:600,borderRadius:6,border:"1px solid rgba(248,113,113,0.3)",background:"transparent",color:products.length<=1?"rgba(255,255,255,0.2)":"#f87171",cursor:products.length<=1?"not-allowed":"pointer",fontFamily:"inherit"}}>✕ Quitar</button>
      </div>
      <div style={{marginBottom:12}}>
        <label style={lblStyle()}>Descripción del producto</label>
        <input value={p.description} onChange={e=>onUpdate(i,"description",e.target.value)} style={inpStyle()}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
        <div><label style={lblStyle()}>Origen</label>
          <select value={p.origin} onChange={e=>onUpdate(i,"origin",e.target.value)} style={inpStyle()}>
            <option value="china">China</option>
            <option value="usa">USA</option>
          </select>
        </div>
        <div><label style={lblStyle()}>Lead prod. (días)</label><input type="text" inputMode="numeric" value={p.lead_time_days} onChange={e=>onUpdate(i,"lead_time_days",e.target.value.replace(/[^0-9]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Cantidad</label><input type="text" inputMode="numeric" value={p.quantity} onChange={e=>onUpdate(i,"quantity",e.target.value.replace(/[^0-9]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Costo unit. USD FOB</label><input type="text" inputMode="decimal" value={p.unit_cost_usd} onChange={e=>onUpdate(i,"unit_cost_usd",e.target.value.replace(/[^0-9.]/g,""))} style={inpStyle()}/></div>
      </div>

      {p.origin==="china"&&<div style={{padding:"12px 14px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:8,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            {p.ncm_code?<>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:3}}>Clasificación NCM</p>
              <p style={{fontSize:13,fontWeight:700,color:"#fff"}}><span style={{fontFamily:"'JetBrains Mono',monospace",color:"#60a5fa"}}>{p.ncm_code}</span> · {p.ncm_description}</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                <Tag>DI {p.import_duty_rate}%</Tag>
                <Tag>IVA {p.iva_rate}%</Tag>
                <Tag>Tasa Estad. {p.statistics_rate}%</Tag>
              </div>
            </>:<p style={{fontSize:12,color:"rgba(255,255,255,0.55)"}}>{p.ncm_error?<span style={{color:"#fbbf24"}}>⚠ No se pudo clasificar. Cargá los aranceles a mano abajo.</span>:"Apretá clasificar para que el sistema busque NCM y aranceles."}</p>}
          </div>
          <button onClick={()=>onClassify(i)} disabled={!p.description?.trim()||p.ncm_loading} style={{padding:"7px 14px",fontSize:11.5,fontWeight:700,borderRadius:8,border:"1px solid rgba(96,165,250,0.4)",background:"rgba(96,165,250,0.1)",color:"#60a5fa",cursor:p.description?.trim()?"pointer":"not-allowed",fontFamily:"inherit",opacity:p.description?.trim()?1:0.4}}>{p.ncm_loading?"Clasificando…":(p.ncm_code?"Reclasificar":"Clasificar NCM")}</button>
        </div>
        {p.ncm_error&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
          <div><label style={lblStyle()}>DI %</label><input type="text" inputMode="decimal" value={p.import_duty_rate} onChange={e=>onUpdate(i,"import_duty_rate",e.target.value)} style={inpStyle()}/></div>
          <div><label style={lblStyle()}>IVA %</label><input type="text" inputMode="decimal" value={p.iva_rate} onChange={e=>onUpdate(i,"iva_rate",e.target.value)} style={inpStyle()}/></div>
          <div><label style={lblStyle()}>Tasa Estad. %</label><input type="text" inputMode="decimal" value={p.statistics_rate} onChange={e=>onUpdate(i,"statistics_rate",e.target.value)} style={inpStyle()}/></div>
        </div>}
      </div>}

      <p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,marginTop:14}}>Embalaje</p>
      <div style={{display:"grid",gridTemplateColumns:"0.6fr 1fr 1fr 1fr 1fr",gap:8}}>
        <div><label style={lblStyle()}>Cant. bultos</label><input type="text" inputMode="numeric" value={p.pkg_count} onChange={e=>onUpdate(i,"pkg_count",e.target.value.replace(/[^0-9]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Largo (cm)</label><input type="text" inputMode="decimal" value={p.pkg_length_cm} onChange={e=>onUpdate(i,"pkg_length_cm",e.target.value.replace(/[^0-9.]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Ancho (cm)</label><input type="text" inputMode="decimal" value={p.pkg_width_cm} onChange={e=>onUpdate(i,"pkg_width_cm",e.target.value.replace(/[^0-9.]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Alto (cm)</label><input type="text" inputMode="decimal" value={p.pkg_height_cm} onChange={e=>onUpdate(i,"pkg_height_cm",e.target.value.replace(/[^0-9.]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Peso bulto (kg)</label><input type="text" inputMode="decimal" value={p.pkg_weight_kg} onChange={e=>onUpdate(i,"pkg_weight_kg",e.target.value.replace(/[^0-9.]/g,""))} style={inpStyle()}/></div>
      </div>
    </div>)}
    <button onClick={onAdd} style={{padding:"7px 14px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",fontFamily:"inherit",marginBottom:18}}>+ Agregar producto</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:10}}>
      <p style={{fontSize:12.5,color:"rgba(255,255,255,0.85)",margin:0}}>Subtotal FOB: <strong style={{color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalFob)}</strong></p>
      <button onClick={onNext} style={{padding:"10px 20px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit"}}>Continuar a costos →</button>
    </div>
  </div>;
}

function WizStep2({visibleChannels,someUSA,clientCommissionPct,client,paymentPlan,setPaymentPlan,profitFor,onBack,onNext,saving}){
  const cn=client?`${client.first_name||""} ${client.last_name||""}`.trim():"—";
  return <div>
    <div style={{padding:"12px 16px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:10,fontSize:12.5,color:"rgba(255,255,255,0.85)",lineHeight:1.5,marginBottom:18}}>
      <strong style={{color:"#60a5fa"}}>Step 2:</strong> el sistema calcula el costo final por canal usando la calculadora del portal{someUSA?". Hay algún producto USA, así que solo se muestran canales B.":"."} Tu comisión sale del % asignado al cliente y se paga sobre la ganancia neta real al cerrar la op.
    </div>

    <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Costo por canal (al cliente)</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:18}}>
      {visibleChannels.map(c=><div key={c.key} style={{background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:16}}>
        <p style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:3}}>{c.name}</p>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:14}}>{c.time}</p>
        {c.error?<p style={{fontSize:11,color:"#f87171"}}>Sin tarifa configurada</p>:<>
          <div style={{paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Total</span>
            <span style={{fontSize:20,fontWeight:800,color:GOLD_LIGHT,fontFeatureSettings:'"tnum"'}}>{fmtUSD(c.total)}</span>
          </div>
        </>}
      </div>)}
    </div>

    {clientCommissionPct>0?
      <div style={{padding:"12px 16px",background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:10,marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <p style={{fontSize:12.5,fontWeight:700,color:"#22c55e",margin:0}}>Comisión del cliente · <strong>{clientCommissionPct}%</strong> sobre ganancia neta</p>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.55)",margin:"3px 0 0"}}>{cn} tiene asignado este porcentaje. Se calcula y se paga al cerrar la op.</p>
        </div>
      </div>:
      <div style={{padding:"12px 16px",background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.25)",borderRadius:10,marginBottom:18}}>
        <p style={{fontSize:12.5,fontWeight:700,color:"#fbbf24",margin:0}}>⚠ Cliente sin comisión asignada</p>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.65)",margin:"3px 0 0"}}>{cn} no tiene un % de comisión configurado. Pedile al admin que lo asigne desde la ficha del cliente, sino no vas a cobrar comisión cuando cierre la op.</p>
      </div>
    }

    <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Estimación de ganancia (por canal)</h3>
    <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5,fontStyle:"italic"}}>Estimaciones aproximadas usando un costo real estimado del 92% del total al cliente. La ganancia y comisión real se calculan al cerrar la op con los costos verdaderos.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:18}}>
      {visibleChannels.map(c=>{const p=profitFor(c);return <div key={c.key} style={{background:"linear-gradient(135deg,rgba(34,197,94,0.06),rgba(34,197,94,0.01))",border:"1px solid rgba(34,197,94,0.25)",borderRadius:12,padding:16}}>
        <p style={{fontSize:13,fontWeight:700,color:"#22c55e",marginBottom:10}}>{c.name}</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8}}>
            <p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Ganancia neta est.</p>
            <p style={{fontSize:13,fontWeight:700,fontFeatureSettings:'"tnum"',color:"#fff"}}>{fmtUSD(p.netProfitEst)}</p>
          </div>
          <div style={{padding:"10px 12px",background:"rgba(184,149,106,0.06)",borderRadius:8}}>
            <p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Tu comisión {clientCommissionPct}%</p>
            <p style={{fontSize:13,fontWeight:700,fontFeatureSettings:'"tnum"',color:GOLD_LIGHT}}>{fmtUSD(p.commissionEst)}</p>
          </div>
        </div>
      </div>;})}
    </div>

    <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18}}>
      <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 12px"}}>Plan de pagos</h3>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {paymentPlan.map((stage,i)=><div key={i} style={{flex:"1 1 200px",padding:"12px 14px",background:"rgba(0,0,0,0.18)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <input type="text" inputMode="numeric" value={stage.pct} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");setPaymentPlan(p=>p.map((s,j)=>j===i?{...s,pct:Number(v)||0}:s));}} style={{width:50,padding:"4px 6px",fontSize:14,fontWeight:700,background:"transparent",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"#fff",textAlign:"center",outline:"none"}}/>
            <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>%</span>
          </div>
          <input value={stage.label} onChange={e=>setPaymentPlan(p=>p.map((s,j)=>j===i?{...s,label:e.target.value}:s))} style={{width:"100%",padding:"5px 8px",fontSize:11,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,color:"rgba(255,255,255,0.8)",outline:"none",fontFamily:"inherit"}}/>
        </div>)}
      </div>
      <p style={{fontSize:10.5,color:"rgba(255,255,255,0.45)",marginTop:8}}>Total: <strong style={{color:paymentPlan.reduce((s,p)=>s+p.pct,0)===100?"#22c55e":"#fbbf24"}}>{paymentPlan.reduce((s,p)=>s+p.pct,0)}%</strong> {paymentPlan.reduce((s,p)=>s+p.pct,0)!==100&&<span style={{color:"#fbbf24"}}>(debe sumar 100%)</span>}</p>
    </div>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14}}>
      <button onClick={onBack} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",fontFamily:"inherit"}}>← Volver</button>
      <button onClick={onNext} disabled={saving} style={{padding:"10px 20px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:saving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Generando…":"Generar link al cliente →"}</button>
    </div>
  </div>;
}

function WizStep3({generatedQuote,onBack}){
  const [copied,setCopied]=useState(false);
  if(!generatedQuote)return <p style={{color:"rgba(255,255,255,0.5)"}}>Sin cotización generada</p>;
  const url=`${typeof window!=="undefined"?window.location.origin:"https://argencargo.com.ar"}/cotizacion/${generatedQuote.public_token}`;
  const copy=()=>{navigator.clipboard?.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  return <div>
    <div style={{textAlign:"center",padding:"40px 30px",background:"linear-gradient(135deg,rgba(34,197,94,0.10),rgba(34,197,94,0.02))",border:"1px solid rgba(34,197,94,0.3)",borderRadius:14,marginBottom:18}}>
      <div style={{fontSize:48,marginBottom:8}}>🔗</div>
      <h2 style={{fontSize:20,fontWeight:800,marginBottom:8}}>Cotización lista</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginBottom:20}}>Compartile este link al cliente. Puede elegir servicio + entrega y aceptar online.</p>
      <div style={{display:"flex",alignItems:"center",gap:10,maxWidth:600,margin:"0 auto",padding:"12px 16px",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(184,149,106,0.3)",borderRadius:10}}>
        <span style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:GOLD_LIGHT,textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</span>
        <button onClick={copy} style={{padding:"6px 12px",fontSize:11.5,fontWeight:700,borderRadius:7,border:"none",background:copied?"#22c55e":GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{copied?"✓ Copiado":"📋 Copiar"}</button>
      </div>
    </div>
    <div style={{padding:"12px 16px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:10,fontSize:12.5,color:"rgba(255,255,255,0.85)",lineHeight:1.5,marginBottom:18}}>
      <strong style={{color:"#60a5fa"}}>Próximo paso:</strong> el cliente abre el link, elige servicio + entrega y acepta. Cuando acepta, se convierte automáticamente en una operación AC-XXXX en el panel admin.
    </div>
    <div style={{display:"flex",justifyContent:"flex-end"}}>
      <button onClick={onBack} style={{padding:"9px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit"}}>Volver al listado</button>
    </div>
  </div>;
}

function lblStyle(){return {fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:5};}
function inpStyle(){return {width:"100%",padding:"8px 10px",fontSize:12.5,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,background:"rgba(0,0,0,0.25)",color:"#fff",outline:"none",fontFamily:"inherit"};}
function Tag({children}){return <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:5,background:"rgba(96,165,250,0.12)",color:"#60a5fa",letterSpacing:"0.04em"}}>{children}</span>;}

// ────────────────────────────────────────────
// PANE: OPERACIONES GI
// ────────────────────────────────────────────
const STATUS_MAP={
  pendiente:{l:"Pendiente",c:"#94a3b8"},
  en_deposito_origen:{l:"En depósito",c:"#fbbf24"},
  en_preparacion:{l:"Preparación",c:"#a78bfa"},
  en_transito:{l:"En tránsito",c:"#22d3ee"},
  arribo_argentina:{l:"Arribo AR",c:"#818cf8"},
  en_aduana:{l:"Aduana",c:"#fb923c"},
  entregada:{l:"Lista entrega",c:"#22c55e"},
  operacion_cerrada:{l:"Cerrada",c:"#10b981"},
  cancelada:{l:"Cancelada",c:"#f87171"},
};

function PaneOps({token}){
  const [ops,setOps]=useState([]);
  const [earnings,setEarnings]=useState([]);
  const [lo,setLo]=useState(true);
  const [tab,setTab]=useState("active");
  const [search,setSearch]=useState("");

  useEffect(()=>{(async()=>{
    setLo(true);
    // RLS hace el filtro: el socio solo ve ops GI de sus clientes asignados.
    // Admin ve todas las GI.
    const [opsRes,earnRes]=await Promise.all([
      dq("operations",{token,filters:"?service_type=eq.gestion_integral&select=*,clients(first_name,last_name,client_code,gi_partner_id,gi_commission_pct)&order=created_at.desc"}),
      dq("gi_partner_earnings",{token,filters:"?select=*&order=closed_at.desc"}),
    ]);
    setOps(Array.isArray(opsRes)?opsRes:[]);
    setEarnings(Array.isArray(earnRes)?earnRes:[]);
    setLo(false);
  })();},[token]);

  const earningByOpId=earnings.reduce((m,e)=>{m[e.operation_id]=e;return m;},{});

  const tabs=[
    {k:"active",l:"Activas",f:o=>!["operacion_cerrada","cancelada"].includes(o.status)},
    {k:"closed",l:"Cerradas",f:o=>["operacion_cerrada","cancelada"].includes(o.status)},
  ];

  const filtered=ops.filter(op=>{
    const t=tabs.find(x=>x.k===tab);
    if(!t.f(op))return false;
    if(search){
      const s=search.toLowerCase();
      const cn=op.clients?`${op.clients.first_name||""} ${op.clients.last_name||""}`.toLowerCase():"";
      if(!op.operation_code.toLowerCase().includes(s)&&!cn.includes(s)&&!String(op.description||"").toLowerCase().includes(s))return false;
    }
    return true;
  });

  // Comisión:
  //   - Si la op está cerrada: leer de gi_partner_earnings (real)
  //   - Si está activa: estimar usando gi_commission_pct del cliente sobre el budget
  const calcComision=(op)=>{
    const earn=earningByOpId[op.id];
    if(earn)return {amount:Number(earn.commission_usd||0),real:true,pct:Number(earn.commission_pct||0)};
    const pct=Number(op.clients?.gi_commission_pct||0);
    const total=Number(op.budget_total||0);
    // Estimación: net mock 8% del total → comisión = pct * net
    const netEst=total*0.08;
    const est=netEst*pct/100;
    return {amount:est,real:false,pct};
  };

  const totalActiveCommission=filtered.filter(op=>!["operacion_cerrada","cancelada"].includes(op.status)).reduce((s,op)=>s+calcComision(op).amount,0);
  const totalClosedCommission=filtered.filter(op=>op.status==="operacion_cerrada").reduce((s,op)=>s+calcComision(op).amount,0);

  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>Operaciones GI</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:22}}>Operaciones de Gestión Integral de tus clientes asignados. Las comisiones se calculan al cerrar cada op sobre la ganancia neta real.</p>

    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por código, cliente o descripción..." style={{padding:"9px 12px",fontSize:12.5,border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none",fontFamily:"inherit",minWidth:280,flex:1}}/>
    </div>

    <div style={{display:"flex",gap:4,borderBottom:"1px solid rgba(255,255,255,0.08)",marginBottom:18,alignItems:"flex-end"}}>
      {tabs.map(t=>{const n=ops.filter(t.f).length;return <button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"9px 14px",fontSize:12,fontWeight:600,color:tab===t.k?GOLD_LIGHT:"rgba(255,255,255,0.5)",background:"transparent",border:"none",borderBottom:`2px solid ${tab===t.k?GOLD_LIGHT:"transparent"}`,cursor:"pointer",fontFamily:"inherit"}}>{t.l} <span style={{marginLeft:5,fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:8,background:tab===t.k?"rgba(184,149,106,0.15)":"rgba(255,255,255,0.06)",color:tab===t.k?GOLD_LIGHT:"rgba(255,255,255,0.5)"}}>{n}</span></button>;})}
      {filtered.length>0&&<span style={{marginLeft:"auto",alignSelf:"center",fontSize:12,color:"rgba(255,255,255,0.6)",paddingBottom:8}}>{tab==="active"?<>Comisión est. activa: <strong style={{color:GOLD_LIGHT}}>{fmtUSD(totalActiveCommission)}</strong></>:<>Comisión real cerrada: <strong style={{color:"#22c55e"}}>{fmtUSD(totalClosedCommission)}</strong></>}</span>}
    </div>

    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:filtered.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"3rem 0"}}>{tab==="active"?"No tenés operaciones GI activas. Cuando un cliente asignado a vos acepte una cotización aparecen acá.":"No tenés operaciones cerradas todavía."}</p>:
      <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.22)"}}>
            <th style={thStyle()}>Op</th>
            <th style={thStyle()}>Cliente</th>
            <th style={thStyle()}>Descripción</th>
            <th style={thStyle()}>Canal</th>
            <th style={thStyle()}>Estado</th>
            <th style={thStyle()}>ETA</th>
            <th style={{...thStyle(),textAlign:"right"}}>Total</th>
            <th style={{...thStyle(),textAlign:"right"}}>Tu comisión</th>
          </tr></thead>
          <tbody>
            {filtered.map(op=>{const st=STATUS_MAP[op.status]||{l:op.status,c:"#999"};const cn=op.clients?`${op.clients.first_name||""} ${op.clients.last_name||""}`.trim():"—";const com=calcComision(op);const chLabel=CHANNEL_DEFS.find(c=>c.key===op.channel)?.name||op.channel;return <tr key={op.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <td style={{padding:"13px 14px",fontFamily:"'JetBrains Mono','SF Mono',monospace",fontWeight:600,color:GOLD_LIGHT,fontSize:12.5,letterSpacing:"0.04em"}}>{op.operation_code}</td>
              <td style={{padding:"13px 14px",color:"#fff",fontWeight:600}}>{cn}</td>
              <td style={{padding:"13px 14px",color:"rgba(255,255,255,0.6)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{op.description||"—"}</td>
              <td style={{padding:"13px 14px"}}><span style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(184,149,106,0.10)",color:GOLD_LIGHT,fontWeight:600,letterSpacing:"0.03em"}}>{chLabel}</span></td>
              <td style={{padding:"13px 14px"}}><span style={{fontSize:10,fontWeight:700,padding:"4px 10px 4px 8px",borderRadius:999,color:st.c,background:`${st.c}14`,border:`1px solid ${st.c}40`,letterSpacing:"0.05em",textTransform:"uppercase",display:"inline-flex",alignItems:"center",gap:5}}><span style={{display:"inline-block",width:5,height:5,borderRadius:"50%",background:st.c}}/>{st.l}</span></td>
              <td style={{padding:"13px 14px",color:"rgba(255,255,255,0.5)"}}>{op.eta?fmtDate(op.eta):"—"}</td>
              <td style={{padding:"13px 14px",textAlign:"right",color:"#fff",fontWeight:600,fontFeatureSettings:'"tnum"'}}>{fmtUSD(op.budget_total)}</td>
              <td style={{padding:"13px 14px",textAlign:"right",color:com.real?"#22c55e":"rgba(255,255,255,0.5)",fontWeight:700,fontFeatureSettings:'"tnum"'}} title={com.real?`Comisión real: ${com.pct}% sobre ganancia neta`:`Estimación con ${com.pct}% del cliente`}>{com.pct>0?fmtUSD(com.amount):"—"}{!com.real&&com.pct>0&&<span style={{fontSize:9,marginLeft:4,opacity:0.6}}>est.</span>}</td>
            </tr>;})}
          </tbody>
        </table>
      </div>
    }
  </div>;
}

function thStyle(){return {textAlign:"left",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"};}

// ────────────────────────────────────────────
// PANE: DASHBOARD (financiero)
// ────────────────────────────────────────────
function PaneDashboard({token}){
  const [data,setData]=useState(null);
  useEffect(()=>{(async()=>{
    const r=await dq("gi_quotes",{token,filters:"?status=eq.converted&select=*,operations(id,operation_code,status,budget_total,closed_at,is_collected,collected_amount)&order=accepted_at.desc"});
    setData(Array.isArray(r)?r.filter(q=>q.operations):[]);
  })();},[token]);

  if(!data)return <p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>;

  const calcGan=(q)=>{
    const op=q.operations;if(!op)return 0;
    const total=Number(op.budget_total||0);
    const honoraires=total*Number(q.honorarios_pct||0)/100;
    const realKey={aereo_negro:"cost_courier_real_usd",aereo_blanco:"cost_aereo_int_real_usd",maritimo_negro:"cost_maritimo_lcl_real_usd",maritimo_blanco:"cost_maritimo_int_real_usd"}[q.selected_channel];
    const real=realKey?Number(q[realKey]||0):total*0.92;
    const spread=Math.max(0,total-real-honoraires);
    return honoraires+spread;
  };

  const closed=data.filter(q=>q.operations?.status==="operacion_cerrada");
  const active=data.filter(q=>!["operacion_cerrada","cancelada"].includes(q.operations?.status));

  // Mes actual
  const now=new Date();
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString();
  const thisMonth=closed.filter(q=>q.operations?.closed_at&&q.operations.closed_at>=monthStart);
  const lastMonth=closed.filter(q=>{const c=q.operations?.closed_at;if(!c)return false;const d=new Date(c);return d.getMonth()===(now.getMonth()===0?11:now.getMonth()-1)&&d.getFullYear()===(now.getMonth()===0?now.getFullYear()-1:now.getFullYear());});

  const ganMes=thisMonth.reduce((s,q)=>s+calcGan(q),0);
  const ganLastMes=lastMonth.reduce((s,q)=>s+calcGan(q),0);
  const ganAcum=closed.reduce((s,q)=>s+calcGan(q),0);
  const pendingCobro=active.reduce((s,q)=>{
    const op=q.operations;
    if(!op)return s;
    const t=Number(op.budget_total||0)-Number(op.collected_amount||0);
    return s+Math.max(0,t);
  },0);
  const trend=ganLastMes>0?((ganMes-ganLastMes)/ganLastMes*100):(ganMes>0?100:0);
  const ticketAvg=closed.length>0?ganAcum/closed.length:0;

  // Chart mensual (últimos 8 meses)
  const months=[];
  for(let i=7;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const start=d.toISOString();
    const end=new Date(d.getFullYear(),d.getMonth()+1,1).toISOString();
    const monthClosed=closed.filter(q=>q.operations?.closed_at&&q.operations.closed_at>=start&&q.operations.closed_at<end);
    const total=monthClosed.reduce((s,q)=>s+calcGan(q),0);
    months.push({label:d.toLocaleDateString("es-AR",{month:"short"}),val:total});
  }
  const maxBar=Math.max(...months.map(m=>m.val),100);

  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>Dashboard</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:22}}>Tus ganancias y métricas como socio GI.</p>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
      <Kpi label="Ganancia este mes" val={fmtUSD(ganMes)} sub={isFinite(trend)?`${trend>0?"+":""}${trend.toFixed(0)}% vs mes anterior`:"—"} color="#22c55e"/>
      <Kpi label="Acumulado total" val={fmtUSD(ganAcum)} sub={`${closed.length} ops cerradas`} color={GOLD_LIGHT}/>
      <Kpi label="Pendiente de cobro" val={fmtUSD(pendingCobro)} sub={`${active.length} ops activas`}/>
      <Kpi label="Ticket promedio" val={fmtUSD(ticketAvg)} sub="Ganancia / op cerrada"/>
    </div>

    <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18}}>
      <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 14px"}}>Ganancia mensual</h3>
      <div style={{display:"flex",alignItems:"flex-end",gap:14,height:200,padding:"10px 0"}}>
        {months.map((m,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%",justifyContent:"flex-end"}}>
          <div style={{width:"100%",height:`${(m.val/maxBar)*100}%`,minHeight:m.val>0?6:0,background:"linear-gradient(180deg,rgba(184,149,106,0.6),rgba(184,149,106,0.2))",borderRadius:"6px 6px 0 0",border:"1px solid rgba(184,149,106,0.3)",borderBottom:"none",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:6}}>
            {m.val>0&&<span style={{fontSize:10,fontWeight:700,color:GOLD_LIGHT,fontFeatureSettings:'"tnum"'}}>{m.val>=1000?(m.val/1000).toFixed(1)+"k":m.val.toFixed(0)}</span>}
          </div>
        </div>)}
      </div>
      <div style={{display:"flex",gap:14,marginTop:6}}>{months.map((m,i)=><span key={i} style={{flex:1,textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{m.label}</span>)}</div>
    </div>

    {closed.length>0&&<div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18}}>
      <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 14px"}}>Ops cerradas — ganancia detallada</h3>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <th style={thStyle()}>Op</th>
          <th style={thStyle()}>Cerrada</th>
          <th style={{...thStyle(),textAlign:"right"}}>Total op</th>
          <th style={{...thStyle(),textAlign:"right"}}>Honorarios %</th>
          <th style={{...thStyle(),textAlign:"right"}}>Tu ganancia</th>
        </tr></thead>
        <tbody>
          {closed.slice(0,10).map(q=>{const op=q.operations;const gan=calcGan(q);return <tr key={q.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <td style={{padding:"11px 12px",fontFamily:"'JetBrains Mono',monospace",color:GOLD_LIGHT,fontWeight:600}}>{op.operation_code}</td>
            <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.55)"}}>{fmtDate(op.closed_at)}</td>
            <td style={{padding:"11px 12px",textAlign:"right",fontFeatureSettings:'"tnum"'}}>{fmtUSD(op.budget_total)}</td>
            <td style={{padding:"11px 12px",textAlign:"right",fontFeatureSettings:'"tnum"',color:"rgba(255,255,255,0.6)"}}>{q.honorarios_pct||0}%</td>
            <td style={{padding:"11px 12px",textAlign:"right",color:"#22c55e",fontWeight:700,fontFeatureSettings:'"tnum"'}}>{fmtUSD(gan)}</td>
          </tr>;})}
        </tbody>
      </table>
    </div>}
  </div>;
}

// ────────────────────────────────────────────
// PANE: LIBRO DIARIO
// ────────────────────────────────────────────
function PaneLedger({token}){
  const [movements,setMovements]=useState([]);
  const [lo,setLo]=useState(true);
  const [fFrom,setFFrom]=useState("");
  const [fTo,setFTo]=useState("");
  const [fSearch,setFSearch]=useState("");
  const [fType,setFType]=useState("");

  useEffect(()=>{(async()=>{
    setLo(true);
    // Cargar finance_entries relacionados con ops GI
    const ops=await dq("gi_quotes",{token,filters:"?status=eq.converted&select=operation_id,gi_quote_requests(client_id,clients(first_name,last_name))"});
    const opIds=(Array.isArray(ops)?ops:[]).filter(q=>q.operation_id).map(q=>q.operation_id);
    if(opIds.length===0){setMovements([]);setLo(false);return;}
    const inFilter=opIds.map(id=>`"${id}"`).join(",");
    const m=await dq("finance_entries",{token,filters:`?operation_id=in.(${inFilter})&select=*,operations(operation_code)&order=date.desc&limit=200`});
    setMovements(Array.isArray(m)?m:[]);
    setLo(false);
  })();},[token]);

  const filtered=movements.filter(m=>{
    if(fFrom&&m.date<fFrom)return false;
    if(fTo&&m.date>fTo)return false;
    if(fType&&m.type!==fType)return false;
    if(fSearch){
      const s=fSearch.toLowerCase();
      const c=String(m.description||"").toLowerCase();
      const op=String(m.operations?.operation_code||"").toLowerCase();
      if(!c.includes(s)&&!op.includes(s))return false;
    }
    return true;
  });

  const totalIn=filtered.filter(m=>Number(m.amount||0)>0).reduce((s,m)=>s+Number(m.amount||0),0);
  const totalOut=filtered.filter(m=>Number(m.amount||0)<0).reduce((s,m)=>s+Math.abs(Number(m.amount||0)),0);

  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>Libro diario</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:22}}>Movimientos financieros de tus operaciones GI. Filtrá por fecha, op o tipo.</p>

    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
      <input value={fSearch} onChange={e=>setFSearch(e.target.value)} placeholder="Buscar por op o concepto..." style={{...inpStyle(),background:"rgba(255,255,255,0.04)",minWidth:240,flex:1,padding:"9px 12px",fontSize:12}}/>
      <input type="date" value={fFrom} onChange={e=>setFFrom(e.target.value)} style={{...inpStyle(),background:"rgba(255,255,255,0.04)",padding:"9px 12px",fontSize:12,minWidth:140,width:"auto"}}/>
      <span style={{color:"rgba(255,255,255,0.4)",fontSize:12}}>→</span>
      <input type="date" value={fTo} onChange={e=>setFTo(e.target.value)} style={{...inpStyle(),background:"rgba(255,255,255,0.04)",padding:"9px 12px",fontSize:12,minWidth:140,width:"auto"}}/>
      <select value={fType} onChange={e=>setFType(e.target.value)} style={{...inpStyle(),background:"rgba(255,255,255,0.04)",padding:"9px 12px",fontSize:12,width:"auto",minWidth:160}}>
        <option value="">Todos los tipos</option>
        <option value="cobro">Cobros</option>
        <option value="pago_proveedor">Pagos proveedor</option>
        <option value="pago_flete">Pagos flete</option>
        <option value="pago_aduana">Pagos aduana</option>
        <option value="comision">Comisión</option>
      </select>
      <button onClick={()=>{setFFrom("");setFTo("");setFSearch("");setFType("");}} style={{padding:"7px 12px",fontSize:11,fontWeight:600,borderRadius:7,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontFamily:"inherit"}}>Limpiar</button>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:18}}>
      <Kpi label="Ingresos del filtro" val={fmtUSD(totalIn)} color="#22c55e"/>
      <Kpi label="Egresos del filtro" val={fmtUSD(totalOut)} color="#f87171"/>
      <Kpi label="Movimientos" val={String(filtered.length)}/>
    </div>

    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:filtered.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"3rem 0"}}>No hay movimientos en este filtro. {movements.length===0&&"Cuando empieces a registrar cobros y pagos, aparecen acá."}</p>:
      <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.22)"}}>
            <th style={thStyle()}>Fecha</th>
            <th style={thStyle()}>Op</th>
            <th style={thStyle()}>Concepto</th>
            <th style={thStyle()}>Tipo</th>
            <th style={{...thStyle(),textAlign:"right"}}>Monto</th>
          </tr></thead>
          <tbody>
            {filtered.map(m=>{const amt=Number(m.amount||0);return <tr key={m.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.55)",fontFamily:"'JetBrains Mono',monospace"}}>{fmtDate(m.date)}</td>
              <td style={{padding:"11px 12px",fontFamily:"'JetBrains Mono',monospace",color:GOLD_LIGHT,fontWeight:600}}>{m.operations?.operation_code||"—"}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.85)"}}>{m.description||"—"}</td>
              <td style={{padding:"11px 12px"}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:amt>0?"rgba(34,197,94,0.10)":"rgba(248,113,113,0.10)",color:amt>0?"#22c55e":"#f87171",fontWeight:600,textTransform:"capitalize"}}>{(m.type||"").replace(/_/g," ")}</span></td>
              <td style={{padding:"11px 12px",textAlign:"right",fontWeight:700,fontFeatureSettings:'"tnum"',color:amt>0?"#22c55e":"#f87171"}}>{amt>0?"+":""}{fmtUSD(amt)}</td>
            </tr>;})}
          </tbody>
        </table>
      </div>
    }
    {movements.length===0&&!lo&&<div style={{padding:"14px 18px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:10,fontSize:12,color:"rgba(255,255,255,0.8)",lineHeight:1.5,marginTop:12}}>
      <strong style={{color:"#60a5fa"}}>Sin movimientos todavía.</strong> Cuando se registren cobros y pagos en las ops convertidas (desde el panel admin), van a aparecer acá filtrados solo por las tuyas.
    </div>}
  </div>;
}

// ────────────────────────────────────────────
// PANE: CONTACTOS (suppliers / agents / forwarders)
// ────────────────────────────────────────────
function ContactsPanel({token,type,title,desc,groupBy,rubroOptions,fields}){
  const tableMap={suppliers:"gi_suppliers",purchase_agents:"gi_purchase_agents",forwarders:"gi_forwarders"};
  const tableName=tableMap[type];
  const [items,setItems]=useState([]);
  const [lo,setLo]=useState(true);
  const [search,setSearch]=useState("");
  const [groupFilter,setGroupFilter]=useState("");
  const [editId,setEditId]=useState(null); // id | "new" | null
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3000);};

  const load=async()=>{
    setLo(true);
    const r=await dq(tableName,{token,filters:"?select=*&order=created_at.desc"});
    setItems(Array.isArray(r)?r:[]);
    setLo(false);
  };
  useEffect(()=>{load();},[token,type]);

  const startNew=()=>{
    const f={};fields.forEach(fl=>{f[fl.k]="";});
    setForm(f);setEditId("new");
  };
  const startEdit=(it)=>{
    const f={};fields.forEach(fl=>{
      if(fl.k==="modes_str")f[fl.k]=Array.isArray(it.modes)?it.modes.join(","):"";
      else f[fl.k]=it[fl.k]??"";
    });
    setForm(f);setEditId(it.id);
  };
  const cancel=()=>{setEditId(null);setForm({});};
  const save=async()=>{
    setSaving(true);
    const body={};
    fields.forEach(fl=>{
      if(fl.k==="modes_str"){body.modes=form.modes_str?form.modes_str.split(",").map(s=>s.trim()).filter(Boolean):null;}
      else if(fl.num){body[fl.k]=form[fl.k]!==""?Number(form[fl.k]):null;}
      else body[fl.k]=form[fl.k]||null;
    });
    if(editId==="new"){
      await dq(tableName,{method:"POST",token,body});
    } else {
      body.updated_at=new Date().toISOString();
      await dq(tableName,{method:"PATCH",token,filters:`?id=eq.${editId}`,body});
    }
    flash(editId==="new"?"Creado":"Actualizado");
    cancel();
    setSaving(false);
    load();
  };
  const remove=async(id)=>{
    if(!confirm("¿Eliminar este contacto?"))return;
    await dq(tableName,{method:"DELETE",token,filters:`?id=eq.${id}`});
    flash("Eliminado");load();
  };

  // Filter
  const filtered=items.filter(it=>{
    if(groupFilter&&it[groupBy]!==groupFilter)return false;
    if(search){
      const s=search.toLowerCase();
      const all=fields.map(fl=>String(it[fl.k]||"")).join(" ").toLowerCase();
      if(!all.includes(s))return false;
    }
    return true;
  });
  // Group
  const groups={};
  filtered.forEach(it=>{const g=it[groupBy]||"Sin clasificar";if(!groups[g])groups[g]=[];groups[g].push(it);});
  const groupKeys=Object.keys(groups).sort();

  return <div>
    {msg&&<div style={{position:"fixed",top:20,right:20,background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",padding:"10px 16px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"0 12px 30px rgba(0,0,0,0.4)"}}>{msg}</div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:6}}>
      <div><h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>{title}</h1><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>{desc}</p></div>
      <button onClick={startNew} disabled={editId!==null} style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:editId!==null?"rgba(184,149,106,0.3)":GOLD_GRADIENT,color:"#0A1628",cursor:editId!==null?"not-allowed":"pointer",fontFamily:"inherit"}}>+ Nuevo</button>
    </div>

    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginTop:18,marginBottom:14}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{...inpStyle(),background:"rgba(255,255,255,0.04)",minWidth:240,flex:1,padding:"9px 12px",fontSize:12}}/>
      <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={{...inpStyle(),background:"rgba(255,255,255,0.04)",padding:"9px 12px",fontSize:12,width:"auto",minWidth:180}}>
        <option value="">Todos los {groupBy==="rubro"?"rubros":"grupos"}</option>
        {rubroOptions.map(r=><option key={r} value={r}>{r}</option>)}
      </select>
    </div>

    {editId==="new"&&<EditCard form={form} setForm={setForm} fields={fields} rubroOptions={rubroOptions} groupBy={groupBy} onSave={save} onCancel={cancel} saving={saving} isNew/>}

    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:groupKeys.length===0&&editId==="new"?null:groupKeys.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"3rem 0"}}>No hay contactos registrados todavía.</p>:
      groupKeys.map(g=><div key={g} style={{marginBottom:24}}>
        <h3 style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 12px"}}>{g} <span style={{color:"rgba(255,255,255,0.4)",fontWeight:500,textTransform:"none",letterSpacing:0,marginLeft:6}}>· {groups[g].length}</span></h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
          {groups[g].map(it=>editId===it.id?<EditCard key={it.id} form={form} setForm={setForm} fields={fields} rubroOptions={rubroOptions} groupBy={groupBy} onSave={save} onCancel={cancel} saving={saving}/>:<ContactCard key={it.id} item={it} fields={fields} groupBy={groupBy} onEdit={()=>startEdit(it)} onDelete={()=>remove(it.id)}/>)}
        </div>
      </div>)
    }
  </div>;
}

function ContactCard({item,fields,groupBy,onEdit,onDelete}){
  const tagField=fields.find(f=>f.k===groupBy);
  const tagVal=item[groupBy];
  return <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 16px",display:"flex",flexDirection:"column",gap:8,transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.3)";e.currentTarget.style.background="rgba(184,149,106,0.04)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";e.currentTarget.style.background="rgba(255,255,255,0.025)";}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
      <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>{item.name||"—"}</span>
      {tagVal&&<span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:5,background:"rgba(184,149,106,0.1)",color:GOLD_LIGHT,letterSpacing:"0.03em"}}>{tagVal}</span>}
    </div>
    {fields.filter(f=>f.k!=="name"&&f.k!==groupBy&&!f.textarea).map(f=>{
      const v=item[f.k];
      if(!v||v==="")return null;
      const display=Array.isArray(v)?v.join(", "):v;
      return <p key={f.k} style={{fontSize:11.5,color:"rgba(255,255,255,0.6)",margin:0}}>{f.l}: <span style={{color:"#fff"}}>{display}</span></p>;
    })}
    {item.notes&&<p style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontStyle:"italic",lineHeight:1.5}}>{item.notes}</p>}
    <div style={{display:"flex",gap:6,marginTop:6,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
      <button onClick={onEdit} style={{flex:1,padding:"5px 10px",fontSize:11,fontWeight:600,borderRadius:6,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",fontFamily:"inherit"}}>Editar</button>
      <button onClick={onDelete} style={{padding:"5px 10px",fontSize:11,fontWeight:600,borderRadius:6,border:"1px solid rgba(248,113,113,0.25)",background:"transparent",color:"#f87171",cursor:"pointer",fontFamily:"inherit"}}>✕</button>
    </div>
  </div>;
}

function EditCard({form,setForm,fields,rubroOptions,groupBy,onSave,onCancel,saving,isNew}){
  return <div style={{background:"rgba(184,149,106,0.06)",border:"1.5px solid rgba(184,149,106,0.3)",borderRadius:12,padding:"16px 18px",gridColumn:"span 2",marginBottom:18}}>
    <h4 style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 14px"}}>{isNew?"Nuevo contacto":"Editar contacto"}</h4>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
      {fields.map(f=><div key={f.k} style={f.textarea?{gridColumn:"span 2"}:{}}>
        <label style={lblStyle()}>{f.l}{f.req?" *":""}</label>
        {f.textarea?
          <textarea value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} rows={3} style={{...inpStyle(),resize:"vertical"}}/>:
          (f.options||(f.select&&rubroOptions))?
            <select value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={inpStyle()}>
              <option value="">— elegir —</option>
              {(f.options||rubroOptions).map(o=><option key={o} value={o}>{o}</option>)}
            </select>:
            <input value={form[f.k]||""} onChange={e=>{const v=e.target.value;if(f.num){if(v===""||/^-?\d*\.?\d*$/.test(v))setForm(p=>({...p,[f.k]:v}));}else setForm(p=>({...p,[f.k]:v}));}} placeholder={f.placeholder||""} inputMode={f.num?"decimal":undefined} style={inpStyle()}/>}
      </div>)}
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14,paddingTop:14,borderTop:"1px solid rgba(184,149,106,0.2)"}}>
      <button onClick={onCancel} style={{padding:"8px 14px",fontSize:12,fontWeight:600,borderRadius:7,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
      <button onClick={onSave} disabled={saving} style={{padding:"8px 16px",fontSize:12,fontWeight:700,borderRadius:7,border:"none",background:saving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Guardando…":"Guardar"}</button>
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
