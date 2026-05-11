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
// Upload de fotos de producto al bucket package-photos (es público + multi-uso)
const uploadProductPhoto=async(file,token)=>{
  if(!file)return null;
  const ext=(file.name?.split(".").pop()||"jpg").toLowerCase();
  const path=`gi-prod/${Date.now()}_${Math.random().toString(36).slice(2,9)}.${ext}`;
  const fresh=await ensureFresh(token);
  const r=await fetch(`${SB_URL}/storage/v1/object/package-photos/${path}`,{method:"POST",headers:{Authorization:`Bearer ${fresh}`,apikey:SB_KEY,"Content-Type":file.type||"image/jpeg"},body:file});
  if(!r.ok){console.error("upload failed",await r.text());return null;}
  return `${SB_URL}/storage/v1/object/public/package-photos/${path}`;
};
const fmtDateShort=(d)=>{if(!d)return"—";const s=String(d).slice(0,10);if(s.match(/^\d{4}-\d{2}-\d{2}$/)){const[y,m,day]=s.split("-");return `${day}/${m}/${y.slice(2)}`;}const dd=new Date(d);return `${String(dd.getDate()).padStart(2,"0")}/${String(dd.getMonth()+1).padStart(2,"0")}/${String(dd.getFullYear()).slice(2)}`;};
const fmtDateTime=(d)=>{if(!d)return"—";const dd=new Date(d);if(isNaN(dd.getTime()))return"—";return `${String(dd.getDate()).padStart(2,"0")}/${String(dd.getMonth()+1).padStart(2,"0")}/${String(dd.getFullYear()).slice(2)} ${String(dd.getHours()).padStart(2,"0")}:${String(dd.getMinutes()).padStart(2,"0")}`;};
// Fecha "16 de mayo de 2026"
const fmtDateLong=(d)=>{if(!d)return"";const s=String(d).slice(0,10);const[y,m,day]=s.split("-");if(!y||!m||!day)return"";const meses=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];return `${Number(day)} de ${meses[Number(m)-1]} de ${y}`;};
// Construye el mensaje de WhatsApp para mandar la cotización al cliente
const buildQuoteWaMessage=({firstName,code,url,expiresAt})=>{
  const greeting=firstName?`Hola ${firstName}, ¿cómo estás?`:"Hola, ¿cómo estás?";
  const codePart=code?` ${code}`:"";
  const validez=expiresAt?`\n\nVálida hasta el ${fmtDateLong(expiresAt)}.`:"";
  return `${greeting}\n\nTe enviamos la cotización${codePart} para tu importación 🚢\n\n${url}${validez}\n\n_💡 Tip: abrila desde la computadora para verla mucho mejor._\n\nCualquier duda estamos a disposición ✨\n\n*ARGENCARGO*`;
};
// Limpia un nro AR a formato wa.me (54911...)
const cleanWaNumber=(raw)=>{if(!raw)return "";let s=String(raw).replace(/[^0-9]/g,"");if(s.startsWith("0"))s=s.slice(1);if(s.startsWith("15"))s="54911"+s.slice(2);if(!s.startsWith("54"))s="54"+s;return s;};
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
      {k:"commissions",l:"Comisiones",p:["M12 1v22","M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"]},
      {k:"ledger",l:"Libro diario",p:["M4 19.5A2.5 2.5 0 0 1 6.5 17H20","M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"]},
    ]},
    {sec:"Contactos",items:[
      {k:"suppliers",l:"Proveedores",p:["M3 7h18l-2 12H5L3 7z","M8 7V5a4 4 0 0 1 8 0v2"]},
      {k:"agents",l:"Agentes de compra",p:["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"]},
      {k:"forwarders",l:"Embarcadores",p:["M3 17l3-3 4 4 8-8 3 3","M21 6V3h-3"]},
    ]},
    {sec:"Configuración",items:[
      {k:"settings",l:"Configuración",p:["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z","M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"]},
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
        {pane==="quotes"&&<PaneQuotes token={token} profileId={profile?.id}/>}
        {pane==="settings"&&<PaneSettings token={token}/>}
        {pane==="operations"&&<PaneOps token={token}/>}
        {pane==="dashboard"&&<PaneDashboard token={token} profileId={profile?.id} isAdmin={profile?.role==="admin"}/>}
        {pane==="commissions"&&<PaneCommissions token={token}/>}
        {pane==="ledger"&&<PaneLedger token={token} profileId={profile?.id} isAdmin={profile?.role==="admin"}/>}
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
function PaneQuotes({token,profileId}){
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
      dq("gi_quote_requests",{token,filters:"?select=*,clients(first_name,last_name,client_code),gi_quote_request_products(*),gi_quotes(id,status,cost_courier_total_usd,cost_aereo_int_total_usd,cost_maritimo_lcl_total_usd,cost_maritimo_int_total_usd,honorarios_pct,gi_quote_products(quantity,unit_cost_usd))&order=created_at.desc"}),
      dq("clients",{token,filters:"?select=id,first_name,last_name,client_code&order=first_name.asc"}),
    ]);
    setReqs(Array.isArray(r)?r:[]);
    setClients(Array.isArray(cl)?cl:[]);
    setLo(false);
  };
  useEffect(()=>{load();},[token]);

  if(wizardId){
    return <CotizadorWizard token={token} requestId={wizardId} profileId={profileId} onBack={()=>{setWizardId(null);setSelDetail(null);load();}}/>;
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
        assigned_partner_id:profileId,
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

  // Las pestañas miran el estado de la quote (no del request). El draft del wizard puede estar en
  // distintas etapas (draft = sin enviar, sent = link al cliente, accepted/converted = aceptada).
  const qStatusOf=(r)=>{const q=Array.isArray(r.gi_quotes)?r.gi_quotes[0]:null;return q?.status||null;};
  const tabs=[
    {k:"pending",l:"Pendientes",f:r=>!qStatusOf(r)&&["pending","quoting"].includes(r.status)},
    {k:"draft",l:"Borradores",f:r=>qStatusOf(r)==="draft"},
    {k:"sent",l:"Enviadas a cliente",f:r=>qStatusOf(r)==="sent"},
    {k:"accepted",l:"Aceptadas",f:r=>["accepted","converted"].includes(qStatusOf(r))||["accepted","converted"].includes(r.status)},
    {k:"rejected",l:"Rechazadas/Expiradas",f:r=>["rejected","expired"].includes(r.status)},
  ];
  const filtered=reqs.filter(tabs.find(t=>t.k===tab).f);

  if(selDetail){
    return <RequestDetail token={token} requestId={selDetail} profileId={profileId} onBack={()=>{setSelDetail(null);load();}} onStartWizard={()=>setWizardId(selDetail)}/>;
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
            <th style={{textAlign:"right",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>FOB</th>
            <th style={{textAlign:"right",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Pot. ganancia</th>
            <th style={{textAlign:"left",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Recibida</th>
            <th style={{textAlign:"left",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Vence</th>
            <th></th>
          </tr></thead>
          <tbody>
            {filtered.map(r=>{
              const cn=r.clients?`${r.clients.first_name||""} ${r.clients.last_name||""}`.trim():"—";
              // Para mostrar productos/FOB/ganancia: priorizamos los del draft (gi_quote_products) si existe; sino los del request.
              const draft=Array.isArray(r.gi_quotes)?r.gi_quotes[0]:null;
              const draftProds=draft?.gi_quote_products||[];
              const reqProds=r.gi_quote_request_products||[];
              const useDraft=draftProds.length>0;
              const products=useDraft?draftProds:reqProds;
              const pcount=products.length;
              const totalFob=useDraft?draftProds.reduce((s,p)=>s+Number(p.unit_cost_usd||0)*Number(p.quantity||0),0):0;
              // Potencial ganancia ~ honorarios_pct sobre el canal más barato (proxy)
              let potGain=0;
              if(draft&&Number(draft.honorarios_pct||0)>0){
                const totals=[draft.cost_courier_total_usd,draft.cost_aereo_int_total_usd,draft.cost_maritimo_lcl_total_usd,draft.cost_maritimo_int_total_usd].map(v=>Number(v||0)).filter(v=>v>0);
                const minTotal=totals.length>0?Math.min(...totals):0;
                potGain=minTotal*(Number(draft.honorarios_pct)/100);
              }
              return <tr key={r.id} onClick={()=>setSelDetail(r.id)} style={{cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.04)",transition:"background 120ms"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(184,149,106,0.05)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"13px 14px",fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:GOLD_LIGHT,letterSpacing:"0.04em"}}>{r.request_code}</td>
                <td style={{padding:"13px 14px",fontWeight:600,color:"#fff"}}>{cn}{r.clients?.client_code&&<span style={{marginLeft:6,fontSize:10,color:"rgba(255,255,255,0.4)"}}>· {r.clients.client_code}</span>}</td>
                <td style={{padding:"13px 14px",color:"rgba(255,255,255,0.65)"}}>{pcount} {pcount===1?"producto":"productos"}{useDraft&&pcount>0&&<span style={{marginLeft:6,fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3,background:"rgba(96,165,250,0.12)",color:"#60a5fa"}}>BORRADOR</span>}</td>
                <td style={{padding:"13px 14px",textAlign:"right",color:totalFob>0?"#fff":"rgba(255,255,255,0.4)",fontFeatureSettings:'"tnum"',fontWeight:600}}>{totalFob>0?fmtUSD(totalFob):"—"}</td>
                <td style={{padding:"13px 14px",textAlign:"right",color:potGain>0?"#22c55e":"rgba(255,255,255,0.4)",fontFeatureSettings:'"tnum"',fontWeight:600}}>{potGain>0?fmtUSD(potGain):"—"}</td>
                <td style={{padding:"13px 14px",color:"rgba(255,255,255,0.5)"}}>{fmtDate(r.created_at)}</td>
                <td style={{padding:"13px 14px",color:"rgba(255,255,255,0.5)"}}>{r.expires_at?fmtDate(r.expires_at):"—"}</td>
                <td style={{padding:"13px 14px",textAlign:"right",whiteSpace:"nowrap"}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>setSelDetail(r.id)} style={{padding:"5px 10px",fontSize:10.5,fontWeight:700,borderRadius:6,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit",marginRight:4}}>Ver →</button>
                  <button onClick={async()=>{if(!confirm(`¿Eliminar la cotización ${r.request_code}? Esta acción no se puede deshacer.`))return;await dq("gi_quote_requests",{method:"DELETE",token,filters:`?id=eq.${r.id}`});load();}} title="Eliminar cotización" style={{padding:"5px 8px",fontSize:11,borderRadius:6,border:"1px solid rgba(248,113,113,0.3)",background:"transparent",color:"#f87171",cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    }
  </div>;
}

function RequestDetail({token,requestId,profileId,onBack,onStartWizard}){
  const [req,setReq]=useState(null);
  const [draftProducts,setDraftProducts]=useState([]);
  const [quoteRow,setQuoteRow]=useState(null);
  const [subTab,setSubTab]=useState("detail");
  const [lo,setLo]=useState(true);
  useEffect(()=>{(async()=>{
    const [r,q]=await Promise.all([
      dq("gi_quote_requests",{token,filters:`?id=eq.${requestId}&select=*,clients(*),gi_quote_request_products(*)`}),
      dq("gi_quotes",{token,filters:`?request_id=eq.${requestId}&select=id,status,public_token,gi_quote_products(*)&order=created_at.desc&limit=1`}),
    ]);
    setReq(Array.isArray(r)?r[0]:null);
    if(Array.isArray(q)&&q[0]){setQuoteRow(q[0]);if(q[0].gi_quote_products)setDraftProducts(q[0].gi_quote_products);}
    setLo(false);
  })();},[requestId,token]);

  if(lo)return <p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>;
  if(!req)return <p style={{color:"rgba(255,255,255,0.4)"}}>Solicitud no encontrada</p>;
  const cn=req.clients?`${req.clients.first_name||""} ${req.clients.last_name||""}`.trim():"—";
  const reqProducts=(req.gi_quote_request_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
  // Si no hay productos pedidos por el cliente pero hay productos en el draft, mostrar esos.
  const usingDraft=reqProducts.length===0 && draftProducts.length>0;
  const products=usingDraft
    ? [...draftProducts].sort((a,b)=>(a.display_order||0)-(b.display_order||0))
    : reqProducts;

  return <div>
    <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,0.55)",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontWeight:600,marginBottom:18,padding:"6px 12px",borderRadius:8,letterSpacing:"0.04em",fontFamily:"inherit"}}>← Volver</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14,marginBottom:6}}>
      <div>
        <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}><span style={{color:GOLD_LIGHT,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.04em"}}>{req.request_code}</span> · {cn}</h1>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>Pedida {fmtDate(req.created_at)}{req.expires_at?` · Vence ${fmtDate(req.expires_at)}`:""}</p>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {quoteRow?.public_token&&quoteRow.status==="sent"&&<button onClick={()=>{const url=`${window.location.origin}/cotizacion/${quoteRow.public_token}`;navigator.clipboard?.writeText(url);alert("Link copiado:\n"+url);}} title="Copiar link al cliente" style={{padding:"10px 14px",fontSize:12,fontWeight:700,borderRadius:10,border:"1px solid rgba(96,165,250,0.4)",background:"rgba(96,165,250,0.08)",color:"#60a5fa",cursor:"pointer",fontFamily:"inherit"}}>📋 Copiar link</button>}
        <button onClick={onStartWizard} style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit"}}>{quoteRow?.status==="sent"?"Editar cotización →":quoteRow?.status==="draft"?"Continuar borrador →":"Armar cotización →"}</button>
      </div>
    </div>

    {/* Sub-tabs */}
    <div style={{display:"flex",gap:0,borderBottom:"1px solid rgba(255,255,255,0.06)",marginTop:18,marginBottom:18}}>
      {[{k:"detail",l:"Detalle"},{k:"communications",l:"Comunicaciones"}].map(t=><button key={t.k} onClick={()=>setSubTab(t.k)} style={{padding:"9px 16px",fontSize:12,fontWeight:600,color:subTab===t.k?GOLD_LIGHT:"rgba(255,255,255,0.5)",background:"transparent",border:"none",borderBottom:`2px solid ${subTab===t.k?GOLD_LIGHT:"transparent"}`,cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>)}
    </div>

    {subTab==="detail"&&<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
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

      <Card title={`Productos (${products.length})${usingDraft?" · borrador en armado":""}`}>
        {usingDraft&&<p style={{fontSize:11,color:"rgba(96,165,250,0.85)",margin:"-4px 0 10px",fontStyle:"italic"}}>Estos productos provienen del borrador del cotizador (no había pedido del cliente).</p>}
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
    </>}

    {subTab==="communications"&&<CommunicationsTab token={token} quoteId={quoteRow?.id} requestId={requestId} profileId={profileId} clientName={cn} clientWhatsapp={req.clients?.whatsapp} publicToken={quoteRow?.public_token} requestCode={req.request_code} expiresAt={req.expires_at}/>}

  </div>;
}

function CommunicationsTab({token,quoteId,requestId,profileId,clientName,clientWhatsapp,publicToken,requestCode,expiresAt}){
  const [comms,setComms]=useState([]);
  const [lo,setLo]=useState(true);
  const [newNote,setNewNote]=useState("");
  const [posting,setPosting]=useState(false);
  const load=async()=>{
    setLo(true);
    const filter=quoteId?`?quote_id=eq.${quoteId}`:`?request_id=eq.${requestId}`;
    const r=await dq("gi_quote_communications",{token,filters:`${filter}&select=*&order=created_at.desc&limit=200`});
    setComms(Array.isArray(r)?r:[]);
    setLo(false);
  };
  useEffect(()=>{load();},[quoteId,requestId,token]);

  const addNote=async()=>{
    const txt=newNote.trim();if(!txt)return;
    setPosting(true);
    try{
      await dq("gi_quote_communications",{method:"POST",token,body:{
        quote_id:quoteId||null,
        request_id:requestId,
        type:"note",
        content:txt,
        author_id:profileId||null,
      }});
      setNewNote("");
      load();
    }catch(e){alert("Error al guardar la nota: "+e.message);}
    setPosting(false);
  };
  const delNote=async(id)=>{
    if(!confirm("¿Borrar esta nota?"))return;
    try{await dq("gi_quote_communications",{method:"DELETE",token,filters:`?id=eq.${id}`});load();}catch(e){alert("No se pudo borrar");}
  };

  // Acciones rápidas: registrar wpp_sent + abrir wpp con mensaje preset
  const sendWaWithLog=async(msgType="wpp_sent")=>{
    const num=cleanWaNumber(clientWhatsapp||"");
    const url=publicToken?`${window.location.origin}/cotizacion/${publicToken}`:"";
    const txt=encodeURIComponent(buildQuoteWaMessage({firstName:clientName?clientName.split(" ")[0]:"",code:requestCode||"",url,expiresAt:expiresAt||null}));
    const wa=num?`https://wa.me/${num}?text=${txt}`:`https://wa.me/?text=${txt}`;
    try{await dq("gi_quote_communications",{method:"POST",token,body:{quote_id:quoteId||null,request_id:requestId,type:msgType,author_id:profileId||null,meta:{public_token:publicToken||null}}});load();}catch{}
    window.open(wa,"_blank","noopener");
  };

  const TYPE_META={
    link_generated:{i:"🔗",l:"Link generado",c:"#60a5fa"},
    link_regenerated:{i:"🔄",l:"Link regenerado / cotización editada",c:"#60a5fa"},
    link_viewed:{i:"👁",l:"Cliente abrió el link",c:"#fbbf24"},
    link_copied:{i:"📋",l:"Link copiado",c:"rgba(255,255,255,0.6)"},
    wpp_sent:{i:"💬",l:"Enviado por WhatsApp",c:"#22c55e"},
    accepted:{i:"✓",l:"Cliente aceptó la cotización",c:"#22c55e"},
    note:{i:"📝",l:"Nota interna",c:GOLD_LIGHT},
  };

  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
      <Kpi label="Total eventos" val={String(comms.length)} sub={lo?"Cargando…":""}/>
      <Kpi label="Veces que abrió el link" val={String(comms.filter(c=>c.type==="link_viewed").length)} sub={comms.find(c=>c.type==="link_viewed")?`Última: ${fmtDateShort(comms.find(c=>c.type==="link_viewed").created_at)}`:"Sin vistas"} color={comms.some(c=>c.type==="link_viewed")?"#fbbf24":"rgba(255,255,255,0.4)"}/>
      <Kpi label="Estado" val={comms.some(c=>c.type==="accepted")?"Aceptada":(publicToken?"Esperando":"Sin enviar")} color={comms.some(c=>c.type==="accepted")?"#22c55e":"rgba(255,255,255,0.6)"}/>
    </div>

    {publicToken&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
      <button onClick={()=>sendWaWithLog("wpp_sent")} style={{padding:"8px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>💬 Enviar por WhatsApp</button>
      <button onClick={async()=>{const url=`${window.location.origin}/cotizacion/${publicToken}`;await navigator.clipboard?.writeText(url);try{await dq("gi_quote_communications",{method:"POST",token,body:{quote_id:quoteId||null,request_id:requestId,type:"link_copied",author_id:profileId||null}});load();}catch{}alert("Link copiado:\n"+url);}} style={{padding:"8px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:"1px solid rgba(96,165,250,0.4)",background:"rgba(96,165,250,0.08)",color:"#60a5fa",cursor:"pointer",fontFamily:"inherit"}}>📋 Copiar link</button>
    </div>}

    <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:14,marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 8px"}}>Agregar nota interna</p>
      <textarea value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Le mandé wpp el lunes, dijo que confirma esta semana..." rows={2} style={{width:"100%",padding:"9px 11px",fontSize:13,border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,background:"rgba(0,0,0,0.25)",color:"#fff",outline:"none",fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
        <button onClick={addNote} disabled={!newNote.trim()||posting} style={{padding:"7px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",background:!newNote.trim()||posting?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:!newNote.trim()||posting?"not-allowed":"pointer",fontFamily:"inherit"}}>{posting?"Guardando…":"Agregar nota"}</button>
      </div>
    </div>

    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:comms.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"2.5rem 0"}}>Sin eventos todavía. Cuando generes el link, lo mandes por WhatsApp o el cliente lo abra, va a aparecer acá.</p>:
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {comms.map(c=>{const m=TYPE_META[c.type]||{i:"·",l:c.type,c:"rgba(255,255,255,0.5)"};return <div key={c.id} style={{display:"flex",gap:12,padding:"12px 14px",background:"rgba(0,0,0,0.18)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,alignItems:"flex-start"}}>
          <div style={{width:30,height:30,borderRadius:"50%",background:`${m.c}1a`,color:m.c,fontSize:14,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${m.c}40`}}>{m.i}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
              <p style={{fontSize:13,fontWeight:700,color:m.c,margin:0}}>{m.l}</p>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontFeatureSettings:'"tnum"',margin:0,whiteSpace:"nowrap"}}>{fmtDateTime(c.created_at)}</p>
            </div>
            {c.content&&<p style={{fontSize:12.5,color:"rgba(255,255,255,0.85)",margin:"5px 0 0",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{c.content}</p>}
            {c.type==="accepted"&&c.meta?.operation_code&&<p style={{fontSize:11,color:"rgba(255,255,255,0.6)",margin:"4px 0 0"}}>Operación: <strong style={{color:GOLD_LIGHT,fontFamily:"'JetBrains Mono',monospace"}}>{c.meta.operation_code}</strong> · Canal: {c.meta.channel} · Total USD {c.meta.total}</p>}
            {c.type==="accepted"&&c.meta?.delivery_zone&&<p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"2px 0 0"}}>Entrega: {c.meta.delivery_zone}</p>}
          </div>
          {c.type==="note"&&<button onClick={()=>delNote(c.id)} title="Borrar nota" style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid rgba(248,113,113,0.25)",background:"transparent",color:"#f87171",cursor:"pointer",fontFamily:"inherit"}}>✕</button>}
        </div>;})}
      </div>
    }
  </div>;
}

// ────────────────────────────────────────────
// COTIZADOR WIZARD (3 steps)
// ────────────────────────────────────────────
const CHANNEL_DEFS=[
  {key:"aereo_negro",name:"Aéreo Courier Comercial",time:"7 a 10 días hábiles"},
  {key:"aereo_blanco",name:"Aéreo Integral AC",time:"10 a 15 días hábiles"},
  // maritimo_blanco internamente = LCL/FCL (min 1 m³). maritimo_negro = Integral AC (sin mínimo).
  {key:"maritimo_blanco",name:"Marítimo LCL/FCL",time:"~ 60 días"},
  {key:"maritimo_negro",name:"Marítimo Integral AC",time:"~ 60 días"},
];

function CotizadorWizard({token,requestId,profileId,onBack}){
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
  // % del FOB que se paga al proveedor como anticipo (resto al fin de producción).
  const [supplierDepositPct,setSupplierDepositPct]=useState("30");
  const [honorariosPct,setHonorariosPct]=useState("10");
  // Zona del cliente: limita las opciones de envío que ve en /cotizacion/[token].
  // "" = sin definir; "Interior" = a coordinar; cualquier otro valor = filtra a esa zona puntual.
  const [deliveryZone,setDeliveryZone]=useState("");
  const [lo,setLo]=useState(true);
  const [generatedQuote,setGeneratedQuote]=useState(null);
  const [saving,setSaving]=useState(false);
  const [savingDraft,setSavingDraft]=useState(false);
  const [draftQuoteId,setDraftQuoteId]=useState(null);
  const [lastSavedAt,setLastSavedAt]=useState(null);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3500);};

  const emptyProductFrom=(p,i)=>({
    _id:p?.id,
    description:p?.description||"",
    notes:p?.notes||"",
    origin:p?.origin||"china",
    quantity:p?.quantity!=null?String(p.quantity):"",
    unit_cost_usd:p?.unit_cost_usd!=null?String(p.unit_cost_usd):"",
    lead_time_days:p?.lead_time_days!=null?String(p.lead_time_days):"",
    photo_url:p?.photo_url||"",
    ncm_code:p?.ncm_code||"",
    ncm_description:p?.ncm_description||"",
    import_duty_rate:p?.ncm_di_pct!=null?String(p.ncm_di_pct):"",
    statistics_rate:p?.ncm_estad_pct!=null?String(p.ncm_estad_pct):"",
    iva_rate:p?.ncm_iva_pct!=null?String(p.ncm_iva_pct):"",
    ncm_loading:false,
    ncm_error:false,
    pkg_count:p?.pkg_count!=null?String(p.pkg_count):"1",
    pkg_length_cm:p?.pkg_length_cm!=null?String(p.pkg_length_cm):"",
    pkg_width_cm:p?.pkg_width_cm!=null?String(p.pkg_width_cm):"",
    pkg_height_cm:p?.pkg_height_cm!=null?String(p.pkg_height_cm):"",
    pkg_weight_kg:p?.pkg_weight_kg!=null?String(p.pkg_weight_kg):"",
    supplier_ref:p?.supplier_ref||"",
  });

  // Cargar todo: si hay un quote draft existente para este request, usarlo (con sus productos parciales).
  // Sino, usar los productos crudos del request (lo que pidió el admin) como base.
  useEffect(()=>{(async()=>{
    setLo(true);
    const [reqRes,tar,cfg,draftRes]=await Promise.all([
      dq("gi_quote_requests",{token,filters:`?id=eq.${requestId}&select=*,clients(*),gi_quote_request_products(*)`}),
      dq("tariffs",{token,filters:"?select=*&type=eq.rate&order=sort_order.asc"}),
      dq("calc_config",{token,filters:"?select=*"}),
      // Cargar la cotización más reciente para este request, esté en draft o sent. Si está accepted/converted, no se reedita.
      dq("gi_quotes",{token,filters:`?request_id=eq.${requestId}&status=in.(draft,sent)&select=*,gi_quote_products(*)&order=created_at.desc&limit=1`}),
    ]);
    if(Array.isArray(reqRes)&&reqRes[0]){
      const r=reqRes[0];
      setRequest(r);
      setClient(r.clients);
    }
    // Si hay draft, usarlo
    const draft=Array.isArray(draftRes)&&draftRes[0]?draftRes[0]:null;
    if(draft){
      setDraftQuoteId(draft.id);
      if(draft.payment_plan)setPaymentPlan(typeof draft.payment_plan==="string"?JSON.parse(draft.payment_plan):draft.payment_plan);
      if(draft.honorarios_pct!=null)setHonorariosPct(String(draft.honorarios_pct));
      if(draft.supplier_deposit_pct!=null)setSupplierDepositPct(String(draft.supplier_deposit_pct));
      if(draft.delivery_zone!=null)setDeliveryZone(draft.delivery_zone);
      const draftProds=(draft.gi_quote_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
      if(draftProds.length>0){
        setProducts(draftProds.map(emptyProductFrom));
      } else if(Array.isArray(reqRes)&&reqRes[0]){
        const rawProds=(reqRes[0].gi_quote_request_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
        setProducts(rawProds.map(p=>emptyProductFrom({description:p.description,notes:p.notes,quantity:p.quantity,photo_url:p.photo_url})));
      }
      setLastSavedAt(draft.updated_at||draft.created_at);
    } else if(Array.isArray(reqRes)&&reqRes[0]){
      const rawProds=(reqRes[0].gi_quote_request_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
      if(rawProds.length>0){
        setProducts(rawProds.map(p=>emptyProductFrom({description:p.description,notes:p.notes,quantity:p.quantity,photo_url:p.photo_url})));
      } else {
        // Cotización directa sin productos pre-cargados — arrancamos con uno vacío
        setProducts([emptyProductFrom({})]);
      }
    }
    setTariffs(Array.isArray(tar)?tar:[]);
    const cfgObj={};(Array.isArray(cfg)?cfg:[]).forEach(r=>{cfgObj[r.key]=Number(r.value);});setConfig(cfgObj);
    setLo(false);
  })();},[requestId,token]);

  // Persiste el state actual como draft (UPSERT del gi_quote + reemplaza productos).
  const saveDraft=async({silent=false}={})=>{
    if(savingDraft||lo)return;
    setSavingDraft(true);
    try{
      let quoteId=draftQuoteId;
      if(!quoteId){
        // Crear quote en draft
        const inserted=await dq("gi_quotes",{method:"POST",token,body:{
          request_id:requestId,
          payment_plan:paymentPlan,
          honorarios_pct:honorariosPct?Number(honorariosPct):null,
          supplier_deposit_pct:supplierDepositPct?Number(supplierDepositPct):null,
          delivery_zone:deliveryZone||null,
          status:"draft",
        }});
        quoteId=Array.isArray(inserted)?inserted[0]?.id:inserted?.id;
        if(!quoteId)throw new Error("No se pudo crear el draft");
        setDraftQuoteId(quoteId);
      } else {
        await dq("gi_quotes",{method:"PATCH",token,filters:`?id=eq.${quoteId}`,body:{payment_plan:paymentPlan,honorarios_pct:honorariosPct?Number(honorariosPct):null,supplier_deposit_pct:supplierDepositPct?Number(supplierDepositPct):null,delivery_zone:deliveryZone||null}});
      }
      // Si no hay productos en el state, no tocamos los existentes (evitamos perder data por error de UI).
      if(products.length===0){
        setLastSavedAt(new Date().toISOString());
        if(!silent)flash("✓ Borrador guardado (sin productos)");
        return;
      }
      // Estrategia segura: INSERT primero los nuevos, recién DESPUÉS borrar los viejos.
      // Si el INSERT falla, los viejos siguen vivos. Display_order alto reservado para nuevos.
      const oldRows=await dq("gi_quote_products",{token,filters:`?quote_id=eq.${quoteId}&select=id`});
      const oldIds=Array.isArray(oldRows)?oldRows.map(r=>r.id):[];
      const newOrder=oldIds.length+1000; // garantiza que los nuevos queden ordenados después de los viejos temporalmente
      const insertedIds=[];
      for(let i=0;i<products.length;i++){
        const p=products[i];
        const inserted=await dq("gi_quote_products",{method:"POST",token,body:{
          quote_id:quoteId,
          description:p.description||null,
          origin:p.origin||"china",
          quantity:p.quantity?Number(p.quantity):null,
          unit_cost_usd:p.unit_cost_usd?Number(p.unit_cost_usd):null,
          ncm_code:p.ncm_code||null,
          ncm_description:p.ncm_description||null,
          ncm_di_pct:p.import_duty_rate?Number(p.import_duty_rate):null,
          ncm_iva_pct:p.iva_rate?Number(p.iva_rate):null,
          ncm_estad_pct:p.statistics_rate?Number(p.statistics_rate):null,
          lead_time_days:p.lead_time_days?Number(p.lead_time_days):null,
          photo_url:p.photo_url||null,
          pkg_count:p.pkg_count?Number(p.pkg_count):null,
          pkg_length_cm:p.pkg_length_cm?Number(p.pkg_length_cm):null,
          pkg_width_cm:p.pkg_width_cm?Number(p.pkg_width_cm):null,
          pkg_height_cm:p.pkg_height_cm?Number(p.pkg_height_cm):null,
          pkg_weight_kg:p.pkg_weight_kg?Number(p.pkg_weight_kg):null,
          supplier_ref:p.supplier_ref||null,
          display_order:newOrder+i,
        }});
        const newId=Array.isArray(inserted)?inserted[0]?.id:inserted?.id;
        if(!newId){
          // Algo falló — dejamos los nuevos creados (si los hubo) y los viejos. Mostramos error claro.
          throw new Error(`Falló insertar producto ${i+1}. Revisá la consola. Los productos viejos siguen guardados.`);
        }
        insertedIds.push(newId);
      }
      // Ahora sí, borrar los viejos
      if(oldIds.length>0){
        const inFilter=oldIds.map(id=>`"${id}"`).join(",");
        await dq("gi_quote_products",{method:"DELETE",token,filters:`?id=in.(${inFilter})`});
      }
      // Reordenar los nuevos a 0..N-1
      for(let i=0;i<insertedIds.length;i++){
        await dq("gi_quote_products",{method:"PATCH",token,filters:`?id=eq.${insertedIds[i]}`,body:{display_order:i}});
      }
      setLastSavedAt(new Date().toISOString());
      if(!silent)flash(`✓ Borrador guardado (${products.length} productos)`);
    } catch(e){
      alert("Error al guardar borrador: "+e.message);
    } finally {
      setSavingDraft(false);
    }
  };

  const updateProduct=(i,field,value)=>setProducts(p=>p.map((x,j)=>j===i?{...x,[field]:value}:x));
  const addProduct=()=>setProducts(p=>[...p,{description:"",notes:"",origin:"china",quantity:"",unit_cost_usd:"",lead_time_days:"",photo_url:"",ncm_code:"",ncm_description:"",import_duty_rate:"",statistics_rate:"",iva_rate:"",ncm_loading:false,ncm_error:false,pkg_count:"1",pkg_length_cm:"",pkg_width_cm:"",pkg_height_cm:"",pkg_weight_kg:"",supplier_ref:""}]);
  const removeProduct=(i)=>setProducts(p=>p.length>1?p.filter((_,j)=>j!==i):p);

  const classifyNcm=async(i)=>{
    const p=products[i];
    if(!p.description?.trim()&&!p.photo_url)return;
    updateProduct(i,"ncm_loading",true);updateProduct(i,"ncm_error",false);
    try{
      // Si hay foto, convertirla a base64 + comprimirla si es muy grande, y mandar el mime explícito.
      let body={description:p.description||""};
      if(p.photo_url){
        try{
          const imgR=await fetch(p.photo_url);
          const blob=await imgR.blob();
          // Comprimir / re-encodear a JPEG si la imagen es >1MB o tiene formato no soportado (heic, webp viejo, etc).
          // Claude acepta PNG/JPEG/GIF/WEBP, pero JPEG max 1600px da el mejor balance tamaño/precisión.
          const needsRecode=blob.size>1024*1024||!/^image\/(png|jpe?g|gif|webp)$/.test(blob.type);
          let finalBlob=blob;let finalMime=blob.type||"image/jpeg";
          if(needsRecode){
            const bmp=await createImageBitmap(blob).catch(()=>null);
            if(bmp){
              const maxDim=1600;const scale=Math.min(1,maxDim/Math.max(bmp.width,bmp.height));
              const w=Math.round(bmp.width*scale),h=Math.round(bmp.height*scale);
              const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
              canvas.getContext("2d").drawImage(bmp,0,0,w,h);
              finalBlob=await new Promise(res=>canvas.toBlob(res,"image/jpeg",0.85));
              finalMime="image/jpeg";
            }
          }
          const b64=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result.split(",")[1]);fr.onerror=reject;fr.readAsDataURL(finalBlob);});
          body.image=b64;
          body.image_mime=finalMime;
        } catch(e){console.warn("No pude leer foto para NCM",e);}
      }
      const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json();
      if(d.fallback||d.error){
        setProducts(prods=>prods.map((x,j)=>j===i?{...x,ncm_loading:false,ncm_error:true}:x));
      } else {
        setProducts(prods=>prods.map((x,j)=>j===i?{...x,ncm_loading:false,ncm_error:false,ncm_code:d.ncm_code||"",ncm_description:d.ncm_description||"",import_duty_rate:d.import_duty_rate!=null?String(d.import_duty_rate):"",statistics_rate:d.statistics_rate!=null?String(d.statistics_rate):"",iva_rate:d.iva_rate!=null?String(d.iva_rate):""}:x));
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
  const honorariosFactor=1+(Number(honorariosPct||0)/100);
  const channelResults=CHANNEL_DEFS.map(ch=>{
    const r=computeChannel(ch.key);
    if(!r)return {...ch,impoOnly:0,total:0,real:0,honorariosUsd:0,gainLogistica:0,gainHonorarios:0,gainTotal:0,error:true};
    // impoOnly = precio al cliente si SOLO hace la impo con nosotros (sin GI).
    //            Ya incluye nuestra ganancia logística (spread vs. costo real).
    // total    = precio al cliente con Gestión Integral = impoOnly × (1 + honorarios%).
    // real     = costo real para Argencargo (lo que efectivamente pagamos):
    //              totalFob (al proveedor) + realCost (flete cost + impuestos + seguro + ship pass-through).
    //              Margen logístico = (flete - fleteCost) + surcharge (canal B).
    // gainLogistica = impoOnly − real (ganancia ya capturada en la impo regular)
    // gainHonorarios = total − impoOnly (markup adicional por la gestión integral)
    // gainTotal = gainLogistica + gainHonorarios = ganancia neta de la empresa por canal.
    const impoOnly=r.totalAbonar+totalFob;
    const total=impoOnly*honorariosFactor;
    const real=totalFob+(r.realCost||0);
    const honorariosUsd=total-impoOnly;
    const gainLogistica=impoOnly-real;
    const gainHonorarios=honorariosUsd;
    const gainTotal=gainLogistica+gainHonorarios;
    return {...ch,impoOnly,total,real,honorariosUsd,gainLogistica,gainHonorarios,gainTotal,calc:r};
  });

  // Filtrar canales por origen
  const someUSA=products.some(p=>p.origin==="usa");
  const visibleChannels=someUSA
    ?channelResults.filter(c=>c.key.includes("negro")||c.key==="maritimo_blanco")
    :channelResults;

  // (profitFor eliminado: la "estimación de ganancia / comisión socio" ya no se muestra en el wizard;
  //  los honorarios al cliente se calculan directo en channelResults y la comisión socio se resuelve aparte)

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
      const body={
        request_id:requestId,
        honorarios_pct:honorariosPct?Number(honorariosPct):0,
        supplier_deposit_pct:supplierDepositPct?Number(supplierDepositPct):null,
        delivery_zone:deliveryZone||null,
        payment_plan:paymentPlan,
        ...ch,
        status:"sent",
        expires_at:expDate,
      };
      let quoteId, publicToken;
      if(draftQuoteId){
        // Update existing draft quote → finalizar
        const updated=await dq("gi_quotes",{method:"PATCH",token,filters:`?id=eq.${draftQuoteId}`,body});
        quoteId=draftQuoteId;
        publicToken=Array.isArray(updated)?updated[0]?.public_token:updated?.public_token;
        // Borrar productos viejos del draft, vamos a reinsertarlos con todos los datos completos
        await dq("gi_quote_products",{method:"DELETE",token,filters:`?quote_id=eq.${quoteId}`});
      } else {
        const inserted=await dq("gi_quotes",{method:"POST",token,body});
        quoteId=Array.isArray(inserted)?inserted[0]?.id:inserted?.id;
        publicToken=Array.isArray(inserted)?inserted[0]?.public_token:inserted?.public_token;
      }
      if(!quoteId)throw new Error("No se pudo guardar la cotización");
      // Insert productos finales
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
          supplier_ref:p.supplier_ref||null,
          display_order:i,
        }});
      }
      // Update request status
      await dq("gi_quote_requests",{method:"PATCH",token,filters:`?id=eq.${requestId}`,body:{status:"quoted"}});
      // Log evento (link generado o regenerado)
      try{
        await dq("gi_quote_communications",{method:"POST",token,body:{
          quote_id:quoteId,
          request_id:requestId,
          type:draftQuoteId?"link_regenerated":"link_generated",
          author_id:profileId||null,
          meta:{public_token:publicToken,honorarios_pct:Number(honorariosPct||0)},
        }});
      }catch(e){console.warn("comm log failed",e);}
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
        <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px",color:"#fff"}}>Cotizador <span style={{color:GOLD_LIGHT,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.04em"}}>{request.request_code}</span></h1>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>Cliente: <strong style={{color:"#fff"}}>{cn}</strong>{lastSavedAt&&<span style={{marginLeft:10,fontSize:11,color:"rgba(255,255,255,0.4)"}}>· Borrador guardado {fmtDate(lastSavedAt)}</span>}</p>
      </div>
      <button onClick={()=>saveDraft({})} disabled={savingDraft||lo} style={{padding:"9px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:"1px solid rgba(96,165,250,0.4)",background:savingDraft?"rgba(96,165,250,0.2)":"rgba(96,165,250,0.10)",color:"#60a5fa",cursor:savingDraft?"wait":"pointer",fontFamily:"inherit",letterSpacing:"0.02em"}}>{savingDraft?"Guardando…":"💾 Guardar borrador"}</button>
    </div>

    <div style={{display:"flex",alignItems:"center",gap:12,marginTop:18,marginBottom:24,padding:"14px 18px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12}}>
      <Step n={1} label="Productos & embalaje" active={step===1} done={step>1}/>
      <div style={{flex:"0 0 24px",height:1,background:step>1?"#22c55e":"rgba(255,255,255,0.1)"}}/>
      <Step n={2} label="Costos & honorarios" active={step===2} done={step>2}/>
      <div style={{flex:"0 0 24px",height:1,background:step>2?"#22c55e":"rgba(255,255,255,0.1)"}}/>
      <Step n={3} label="Link al cliente" active={step===3} done={false}/>
    </div>

    {step===1&&<WizStep1 token={token} products={products} onUpdate={updateProduct} onAdd={addProduct} onRemove={removeProduct} onClassify={classifyNcm} onNext={()=>goStep(2)} totalFob={totalFob} visibleChannels={visibleChannels} tariffs={tariffs} config={config} client={client}/>}
    {step===2&&<WizStep2 token={token} visibleChannels={visibleChannels} someUSA={someUSA} honorariosPct={honorariosPct} setHonorariosPct={setHonorariosPct} paymentPlan={paymentPlan} setPaymentPlan={setPaymentPlan} totalFob={totalFob} supplierDepositPct={supplierDepositPct} setSupplierDepositPct={setSupplierDepositPct} deliveryZone={deliveryZone} setDeliveryZone={setDeliveryZone} client={client} onBack={()=>setStep(1)} onNext={generateLink} saving={saving}/>}
    {step===3&&<WizStep3 generatedQuote={generatedQuote} client={client} request={request} onBack={onBack}/>}
  </div>;
}

function WizStep1({token,products,onUpdate,onAdd,onRemove,onClassify,onNext,totalFob,visibleChannels,tariffs,config,client}){
  // Desglose impositivo per-item per-canal: replica la lógica de lib/calc.js prorrateando por FOB del item.
  // Para cada producto devuelve { byChannel: { [channelKey]: { fob, die, te, iva, desemb, ivaAdic, iigg, iibb, total } } }.
  const computeItemBreakdown=(productIdx)=>{
    const out={};
    if(!visibleChannels||!tariffs)return out;
    const p=products[productIdx];
    const itemFob=Number(p.unit_cost_usd||0)*Number(p.quantity||0);
    if(itemFob<=0)return out;
    const pct=totalFob>0?itemFob/totalFob:1;
    // Sumar pkgs globales (igual que computeChannel)
    let pf=0,totCBM=0,totGW=0;
    products.forEach(x=>{
      if(!x.pkg_count||!x.pkg_length_cm)return;
      const q=Number(x.pkg_count||1),gw=Number(x.pkg_weight_kg||0),l=Number(x.pkg_length_cm||0),w=Number(x.pkg_width_cm||0),h=Number(x.pkg_height_cm||0);
      pf+=Math.max(gw*q,l&&w&&h?((l*w*h)/5000)*q:0);
      totGW+=gw*q;
      totCBM+=l&&w&&h?((l*w*h)/1000000)*q:0;
    });
    const totalFobAll=products.reduce((s,x)=>s+Number(x.unit_cost_usd||0)*Number(x.quantity||0),0);
    const isRI=client?.tax_condition==="responsable_inscripto";
    visibleChannels.forEach(ch=>{
      const isBlanco=ch.key?.includes("blanco");
      if(!isBlanco){out[ch.key]={fob:itemFob,die:0,te:0,iva:0,desemb:0,ivaAdic:0,iigg:0,iibb:0,total:0,notBlanco:true};return;}
      const isAereo=ch.key?.includes("aereo");
      const isMaritimo=ch.key?.includes("maritimo");
      const certRate=isAereo?(isRI?(config.cert_flete_aereo_real||2.5):(config.cert_flete_aereo_ficticio||3.5)):(config.cert_flete_maritimo_ficticio||100);
      const certFlAmt=isAereo?(isRI?totGW*certRate:pf*certRate):totCBM*certRate;
      const segTotal=(totalFobAll+certFlAmt)*0.01;
      const cifTotal=totalFobAll+certFlAmt+segTotal;
      const iCert=certFlAmt*pct;
      const iSeg=(itemFob+iCert)*0.01;
      const iCif=itemFob+iCert+iSeg;
      const dr=p.import_duty_rate===""||p.import_duty_rate==null?0:Number(p.import_duty_rate)/100;
      const te=p.statistics_rate===""||p.statistics_rate==null?0:Number(p.statistics_rate)/100;
      const ivaR=p.iva_rate===""||p.iva_rate==null?0.21:Number(p.iva_rate)/100;
      const die=iCif*dr;const tasa=iCif*te;const bi=iCif+die+tasa;const iva=bi*ivaR;
      let total=die+tasa+iva;let desemb=0,ivaAdic=0,iigg=0,iibb=0;
      if(isMaritimo){
        const ivaAdR=p.iva_additional_rate===""||p.iva_additional_rate==null?0.20:Number(p.iva_additional_rate)/100;
        const iiggR=p.iigg_rate===""||p.iigg_rate==null?0.06:Number(p.iigg_rate)/100;
        const iibbR=p.iibb_rate===""||p.iibb_rate==null?0.05:Number(p.iibb_rate)/100;
        ivaAdic=bi*ivaAdR;iigg=bi*iiggR;iibb=bi*iibbR;total+=ivaAdic+iigg+iibb;
      } else {
        const tbl=[[5,0],[9,36],[20,50],[50,58],[100,65],[400,72],[800,84],[1000,96],[Infinity,120]];
        let d=120;for(const [m,a] of tbl){if(cifTotal<m){d=a;break;}}
        desemb=(d*pct)*1.21;total+=desemb;
      }
      out[ch.key]={fob:itemFob,certFl:iCert,seguro:iSeg,cif:iCif,die,te:tasa,iva,desemb,ivaAdic,iigg,iibb,total};
    });
    return out;
  };
  return <div>
    <div style={{padding:"12px 16px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:10,fontSize:12.5,color:"rgba(255,255,255,0.85)",lineHeight:1.5,marginBottom:18}}>
      <strong style={{color:"#60a5fa"}}>Step 1:</strong> cargá cada producto con su packing. Si origen es <strong>China</strong> apretá "Clasificar NCM" para que el sistema busque el código y los aranceles. Si es <strong>USA</strong>, va canal B automáticamente.
    </div>
    {products.map((p,i)=><div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:18,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <h4 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>Producto {i+1}</h4>
        <button onClick={()=>onRemove(i)} disabled={products.length<=1} style={{padding:"5px 10px",fontSize:10.5,fontWeight:600,borderRadius:6,border:"1px solid rgba(248,113,113,0.3)",background:"transparent",color:products.length<=1?"rgba(255,255,255,0.2)":"#f87171",cursor:products.length<=1?"not-allowed":"pointer",fontFamily:"inherit"}}>✕ Quitar</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:14,marginBottom:12}}>
        <PhotoUpload value={p.photo_url} onChange={url=>onUpdate(i,"photo_url",url)} token={token}/>
        <div>
          <div style={{marginBottom:12}}>
            <label style={lblStyle()}>Descripción del producto</label>
            <input value={p.description} onChange={e=>onUpdate(i,"description",e.target.value)} style={inpStyle()}/>
          </div>
          <div>
            <label style={lblStyle()}>Referencia del proveedor (opcional)</label>
            <input value={p.supplier_ref||""} onChange={e=>onUpdate(i,"supplier_ref",e.target.value)} placeholder="Link Alibaba, nombre, WeChat, email..." style={inpStyle()}/>
          </div>
        </div>
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
                <Tag>DI {p.import_duty_rate===""||p.import_duty_rate==null?0:p.import_duty_rate}%</Tag>
                <Tag>IVA {p.iva_rate===""||p.iva_rate==null?0:p.iva_rate}%</Tag>
                <Tag>Tasa Estad. {p.statistics_rate===""||p.statistics_rate==null?0:p.statistics_rate}%</Tag>
              </div>
            </>:<p style={{fontSize:12,color:"rgba(255,255,255,0.55)"}}>{p.ncm_error?<span style={{color:"#fbbf24"}}>⚠ No se pudo clasificar. Cargá los aranceles a mano abajo.</span>:"Apretá clasificar para que el sistema busque NCM y aranceles."}</p>}
          </div>
          {(()=>{const can=(p.description?.trim()||p.photo_url);const hasPhoto=!!p.photo_url;return <button onClick={()=>onClassify(i)} disabled={!can||p.ncm_loading} style={{padding:"7px 14px",fontSize:11.5,fontWeight:700,borderRadius:8,border:"1px solid rgba(96,165,250,0.4)",background:"rgba(96,165,250,0.1)",color:"#60a5fa",cursor:can?"pointer":"not-allowed",fontFamily:"inherit",opacity:can?1:0.4,whiteSpace:"nowrap"}}>{p.ncm_loading?"Clasificando…":(p.ncm_code?(hasPhoto?"🤖 Reclasificar (con foto)":"Reclasificar"):(hasPhoto?"🤖 Clasificar NCM (con foto)":"Clasificar NCM"))}</button>;})()}
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
      {/* Preview en vivo: CBM total y peso facturable (aéreo y marítimo) calculados desde los inputs de embalaje. */}
      {(()=>{
        const cnt=Number(p.pkg_count||0);const L=Number(p.pkg_length_cm||0);const W=Number(p.pkg_width_cm||0);const H=Number(p.pkg_height_cm||0);const kg=Number(p.pkg_weight_kg||0);
        if(!cnt||!L||!W||!H||!kg)return null;
        const cbm=(L*W*H*cnt)/1000000;
        const pesoReal=kg*cnt;
        const pesoVolAereo=(L*W*H*cnt)/5000;
        const pesoFactAereo=Math.max(pesoReal,pesoVolAereo);
        const pesoFactMar=Math.max(pesoReal,cbm*1000); // marítimo: 1 m³ = 1.000 kg facturables
        return <div style={{display:"flex",flexWrap:"wrap",gap:14,padding:"10px 12px",marginTop:8,background:"rgba(184,149,106,0.05)",border:"1px solid rgba(184,149,106,0.15)",borderRadius:8,fontSize:11,color:"rgba(255,255,255,0.65)",fontFeatureSettings:'"tnum"'}}>
          <span>CBM total: <strong style={{color:"#fff"}}>{cbm.toFixed(4)} m³</strong></span>
          <span>Peso real: <strong style={{color:"#fff"}}>{pesoReal.toFixed(2)} kg</strong></span>
          <span>Peso vol. aéreo (÷5000): <strong style={{color:"#fff"}}>{pesoVolAereo.toFixed(2)} kg</strong></span>
          <span>Facturable aéreo: <strong style={{color:"#22c55e"}}>{pesoFactAereo.toFixed(2)} kg</strong></span>
          <span>Facturable marítimo: <strong style={{color:"#60a5fa"}}>{pesoFactMar.toFixed(2)} kg</strong></span>
        </div>;
      })()}
      {/* Desglose impositivo por producto y por canal (solo canal A blanco — el B negro es tarifa plana sin impuestos prorrateados) */}
      {(()=>{
        const bd=computeItemBreakdown(i);
        const blancos=Object.entries(bd).filter(([,v])=>!v.notBlanco);
        if(blancos.length===0)return null;
        const fmt=n=>Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
        return <div style={{marginTop:10,padding:"10px 12px",background:"rgba(96,165,250,0.04)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:8}}>
          <p style={{fontSize:9.5,fontWeight:700,color:"rgba(96,165,250,0.85)",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 8px"}}>Desglose impositivo del producto (canal A · prorrateado por FOB)</p>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${blancos.length},1fr)`,gap:10}}>
            {blancos.map(([k,v])=>{
              const lbl=k==="aereo_blanco"?"Aéreo A":k==="maritimo_blanco"?"Marítimo A (LCL/FCL)":k;
              return <div key={k} style={{background:"rgba(0,0,0,0.18)",borderRadius:6,padding:"8px 10px",fontSize:11,color:"rgba(255,255,255,0.7)",fontFeatureSettings:'"tnum"'}}>
                <p style={{fontSize:10.5,fontWeight:700,color:"#60a5fa",margin:"0 0 6px"}}>{lbl}</p>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>FOB</span><span>USD {fmt(v.fob)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>+ Cert. flete</span><span>USD {fmt(v.certFl)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>+ Seguro (1%)</span><span>USD {fmt(v.seguro)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:3,paddingTop:5}}><span style={{color:"rgba(255,255,255,0.5)"}}>CIF item</span><span style={{color:"#fff",fontWeight:600}}>USD {fmt(v.cif)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0",marginTop:5}}><span>DIE</span><span>USD {fmt(v.die)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>Tasa estad.</span><span>USD {fmt(v.te)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>IVA</span><span>USD {fmt(v.iva)}</span></div>
                {v.desemb>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>Desemb.×1.21</span><span>USD {fmt(v.desemb)}</span></div>}
                {v.ivaAdic>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>IVA Adic.</span><span>USD {fmt(v.ivaAdic)}</span></div>}
                {v.iigg>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>IIGG</span><span>USD {fmt(v.iigg)}</span></div>}
                {v.iibb>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>IIBB</span><span>USD {fmt(v.iibb)}</span></div>}
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0 0",borderTop:"1px solid rgba(96,165,250,0.25)",marginTop:5,fontWeight:700}}><span style={{color:"#fff"}}>Total impuestos</span><span style={{color:"#22c55e"}}>USD {fmt(v.total)}</span></div>
              </div>;
            })}
          </div>
        </div>;
      })()}
    </div>)}
    <button onClick={onAdd} style={{padding:"7px 14px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",fontFamily:"inherit",marginBottom:18}}>+ Agregar producto</button>
    {(()=>{
      // Totales globales para el subtotal
      let totCBM=0,pesoRealAll=0,pfAll=0;
      products.forEach(x=>{
        const cnt=Number(x.pkg_count||0),L=Number(x.pkg_length_cm||0),W=Number(x.pkg_width_cm||0),H=Number(x.pkg_height_cm||0),kg=Number(x.pkg_weight_kg||0);
        if(!cnt||!L||!W||!H||!kg)return;
        totCBM+=(L*W*H*cnt)/1000000;
        pesoRealAll+=kg*cnt;
        pfAll+=Math.max(kg*cnt,(L*W*H*cnt)/5000);
      });
      const pesoFactMarAll=Math.max(pesoRealAll,totCBM*1000);
      const cbmCharge=Math.max(totCBM,1); // marítimo blanco mínimo 1 m³
      return <div style={{padding:"14px 18px",background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:10,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <p style={{fontSize:12.5,color:"rgba(255,255,255,0.85)",margin:0}}>Subtotal FOB: <strong style={{color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalFob)}</strong></p>
          <button onClick={onNext} style={{padding:"10px 20px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit"}}>Continuar a costos →</button>
        </div>
        {pesoRealAll>0&&<div style={{display:"flex",flexWrap:"wrap",gap:14,fontSize:11,color:"rgba(255,255,255,0.65)",fontFeatureSettings:'"tnum"',paddingTop:8,borderTop:"1px solid rgba(184,149,106,0.18)"}}>
          <span>CBM total: <strong style={{color:"#fff"}}>{totCBM.toFixed(4)} m³</strong>{totCBM<1?<span style={{color:"#fbbf24",marginLeft:4,fontSize:10}}>(min 1 m³ marítimo LCL/FCL → cobra {cbmCharge.toFixed(2)} m³)</span>:""}</span>
          <span>Peso real total: <strong style={{color:"#fff"}}>{pesoRealAll.toFixed(2)} kg</strong></span>
          <span>Facturable aéreo total: <strong style={{color:"#22c55e"}}>{pfAll.toFixed(2)} kg</strong></span>
          <span>Facturable marítimo total: <strong style={{color:"#60a5fa"}}>{pesoFactMarAll.toFixed(2)} kg</strong></span>
        </div>}
      </div>;
    })()}
  </div>;
}

function WizStep2({token,visibleChannels,someUSA,honorariosPct,setHonorariosPct,paymentPlan,setPaymentPlan,totalFob,supplierDepositPct,setSupplierDepositPct,deliveryZone,setDeliveryZone,client,onBack,onNext,saving}){
  // Zonas de envío disponibles (de gi_shipping_rates) para el dropdown.
  const [zones,setZones]=useState([]);
  useEffect(()=>{(async()=>{
    const r=await dq("gi_shipping_rates",{token,filters:"?select=zone&order=display_order.asc"});
    if(Array.isArray(r)){const set=new Set();r.forEach(x=>x.zone&&set.add(x.zone));setZones(Array.from(set));}
  })();},[token]);
  // Auto-detección por province del cliente (sólo sugerencia, no bloquea):
  const clientProvince=String(client?.province||"").toLowerCase();
  const autoSuggest=clientProvince.includes("ciudad")||clientProvince==="caba"?"CABA":(clientProvince.includes("buenos aires")?"":"Interior");
  // Cobertura por etapa para no quedar en descubierto:
  //  Stage 1 cliente debe cubrir el ANTICIPO a proveedor (FOB × deposit%).
  //  Stage 1 + Stage 2 cliente deben cubrir el FOB TOTAL (al fin de producción ya pagaste todo al proveedor).
  // Worst case = canal con MAYOR ratio FOB/precio.
  const validChannels=(visibleChannels||[]).filter(c=>!c.error&&c.total>0);
  const supDepFrac=Math.max(0,Math.min(100,Number(supplierDepositPct||0)))/100;
  const fobRatios=validChannels.map(c=>totalFob/c.total*100); // % del precio que es FOB
  const fobRatioMax=fobRatios.length>0?Math.max(...fobRatios):0; // worst case
  const minStage1=Math.ceil(fobRatioMax*supDepFrac);     // cubrir anticipo
  const minStage12=Math.ceil(fobRatioMax);                // cubrir FOB total al fin de producción

  const stage1Pct=Number(paymentPlan?.[0]?.pct||0);
  const stage12Pct=stage1Pct+Number(paymentPlan?.[1]?.pct||0);
  const isStage1Covered=stage1Pct>=minStage1;
  const isStage12Covered=stage12Pct>=minStage12;

  const adjustToMinSafe=()=>{
    if(minStage12<=0||minStage12>=100)return;
    const stage1Target=minStage1;
    const stage2Target=Math.max(0,minStage12-stage1Target);
    const stage3Target=100-stage1Target-stage2Target;
    setPaymentPlan(p=>{
      const base=Array.isArray(p)&&p.length>=3?p:[
        {pct:30,label:"Inicio de producción"},
        {pct:20,label:"Producción terminada"},
        {pct:50,label:"Contra entrega"},
      ];
      const next=[...base];
      next[0]={...next[0],pct:stage1Target};
      next[1]={...next[1],pct:stage2Target};
      next[2]={...next[2],pct:stage3Target};
      // si hay más etapas, las pone en 0 (caso edge)
      for(let i=3;i<next.length;i++)next[i]={...next[i],pct:0};
      return next;
    });
  };

  return <div>
    <div style={{padding:"12px 16px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:10,fontSize:12.5,color:"rgba(255,255,255,0.85)",lineHeight:1.5,marginBottom:18}}>
      <strong style={{color:"#60a5fa"}}>Step 2:</strong> el sistema calcula el costo operativo por canal{someUSA?". Hay algún producto USA, así que solo se muestran canales B.":"."} Sumá los honorarios que cobrás al cliente por la gestión y el sistema arma el precio final que ve el cliente. Tu comisión como socio se define por separado al cerrar la op.
    </div>

    <div style={{padding:"14px 18px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:12,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:240}}>
          <p style={{fontSize:13,fontWeight:700,color:"#60a5fa",margin:0}}>Zona de entrega del cliente</p>
          <p style={{fontSize:11.5,color:"rgba(255,255,255,0.6)",margin:"3px 0 0",lineHeight:1.4}}>El cliente verá <strong style={{color:"#fff"}}>solo</strong> esta opción de envío más "Retiro por oficina". Si elegís Interior, el costo queda "a coordinar".{autoSuggest&&!deliveryZone?<><br/>Sugerencia según ficha del cliente: <strong style={{color:GOLD_LIGHT}}>{autoSuggest}</strong>.</>:""}</p>
        </div>
        <select value={deliveryZone} onChange={e=>setDeliveryZone(e.target.value)} style={{padding:"8px 12px",fontSize:13,fontWeight:600,border:"1px solid rgba(96,165,250,0.4)",borderRadius:8,background:"rgba(0,0,0,0.25)",color:"#fff",outline:"none",fontFamily:"inherit",minWidth:200}}>
          <option value="">— Sin definir (mostrar todas) —</option>
          {zones.filter(z=>z!=="Interior").map(z=><option key={z} value={z}>{z}</option>)}
          <option value="Interior">Interior · a coordinar</option>
        </select>
      </div>
    </div>

    <div style={{padding:"14px 18px",background:"rgba(184,149,106,0.06)",border:"1.5px solid rgba(184,149,106,0.32)",borderRadius:12,marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:240}}>
          <p style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,margin:0}}>Honorarios al cliente</p>
          <p style={{fontSize:11.5,color:"rgba(255,255,255,0.6)",margin:"3px 0 0",lineHeight:1.4}}>% que se le cobra al cliente sobre el costo del canal. Es el ingreso por la gestión integral. <strong style={{color:"#fff"}}>Precio al cliente = costo del canal × (1 + honorarios %).</strong></p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <input type="text" inputMode="decimal" value={honorariosPct} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))setHonorariosPct(v);}} placeholder="0" style={{width:90,padding:"10px 12px",fontSize:18,fontWeight:800,textAlign:"center",border:"1px solid rgba(184,149,106,0.4)",borderRadius:10,background:"rgba(0,0,0,0.25)",color:GOLD_LIGHT,outline:"none",fontFamily:"inherit"}}/>
          <span style={{fontSize:18,fontWeight:700,color:GOLD_LIGHT}}>%</span>
        </div>
      </div>
    </div>

    <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Precio al cliente por canal</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:18}}>
      {visibleChannels.map(c=><div key={c.key} style={{background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:16}}>
        <p style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:3}}>{c.name}</p>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:14}}>{c.time}</p>
        {c.error?<p style={{fontSize:11,color:"#f87171"}}>Sin tarifa configurada</p>:<>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,color:"rgba(255,255,255,0.7)",marginBottom:5}}>
            <span title="Lo que se le cobraría si solo hace la impo con nosotros (sin GI)">Total impo solo</span>
            <span style={{fontFeatureSettings:'"tnum"',fontWeight:600}}>{fmtUSD(c.impoOnly||0)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,color:"#22c55e",marginBottom:10}}>
            <span>+ Honorarios GI ({Number(honorariosPct||0)}%)</span>
            <span style={{fontFeatureSettings:'"tnum"',fontWeight:600}}>{fmtUSD(c.honorariosUsd||0)}</span>
          </div>
          <div style={{paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Precio al cliente</span>
            <span style={{fontSize:20,fontWeight:800,color:GOLD_LIGHT,fontFeatureSettings:'"tnum"'}}>{fmtUSD(c.total)}</span>
          </div>
        </>}
      </div>)}
    </div>

    <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Ganancia estimada para Argencargo (por canal)</h3>
    <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5,fontStyle:"italic"}}>Ganancia logística usa un spread mock del 8% sobre el total impo. La ganancia real se calcula al cerrar la op con los costos verdaderos (pagos a embarcadores, aduana, etc.).</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:18}}>
      {visibleChannels.map(c=><div key={c.key} style={{background:"linear-gradient(135deg,rgba(34,197,94,0.06),rgba(34,197,94,0.01))",border:"1px solid rgba(34,197,94,0.25)",borderRadius:12,padding:16}}>
        <p style={{fontSize:13,fontWeight:700,color:"#22c55e",marginBottom:10}}>{c.name}</p>
        {c.error?<p style={{fontSize:11,color:"#f87171"}}>—</p>:<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8}}>
              <p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Logística est.</p>
              <p style={{fontSize:13,fontWeight:700,fontFeatureSettings:'"tnum"',color:"#fff"}}>{fmtUSD(c.gainLogistica||0)}</p>
            </div>
            <div style={{padding:"10px 12px",background:"rgba(184,149,106,0.06)",borderRadius:8}}>
              <p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Honorarios</p>
              <p style={{fontSize:13,fontWeight:700,fontFeatureSettings:'"tnum"',color:GOLD_LIGHT}}>{fmtUSD(c.gainHonorarios||0)}</p>
            </div>
          </div>
          <div style={{paddingTop:10,borderTop:"1px solid rgba(34,197,94,0.18)",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <span style={{fontSize:11,fontWeight:700,color:"rgba(34,197,94,0.85)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Ganancia total est.</span>
            <span style={{fontSize:18,fontWeight:800,color:"#22c55e",fontFeatureSettings:'"tnum"'}}>{fmtUSD(c.gainTotal||0)}</span>
          </div>
        </>}
      </div>)}
    </div>

    <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:240}}>
          <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",margin:0}}>Plan de pagos del cliente</h3>
          <p style={{fontSize:11.5,color:"rgba(255,255,255,0.55)",margin:"4px 0 0",lineHeight:1.5}}>FOB <strong style={{color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalFob)}</strong>. Stage 1 del cliente debe cubrir el anticipo al proveedor (al iniciar producción). Stage 1+2 debe cubrir el FOB completo (al fin de producción). Stage 3 cubre logística + aduana al arribo.</p>
        </div>
        {minStage12>0&&minStage12<100&&<button onClick={adjustToMinSafe} style={{padding:"7px 12px",fontSize:11,fontWeight:700,borderRadius:7,border:"1px solid rgba(96,165,250,0.4)",background:"rgba(96,165,250,0.08)",color:"#60a5fa",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Ajustar al mínimo seguro</button>}
      </div>

      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.22)",borderRadius:10,marginBottom:14,flexWrap:"wrap"}}>
        <span style={{fontSize:11.5,color:"rgba(255,255,255,0.85)",fontWeight:600}}>Anticipo al proveedor:</span>
        <input type="text" inputMode="decimal" value={supplierDepositPct} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");if(v===""||(Number(v)>=0&&Number(v)<=100))setSupplierDepositPct(v);}} style={{width:60,padding:"4px 8px",fontSize:13,fontWeight:700,textAlign:"center",border:"1px solid rgba(168,85,247,0.35)",borderRadius:6,background:"rgba(0,0,0,0.25)",color:"#a78bfa",outline:"none",fontFamily:"inherit"}}/>
        <span style={{fontSize:13,fontWeight:700,color:"#a78bfa"}}>% del FOB</span>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginLeft:6}}>· Anticipo USD <strong style={{color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalFob*supDepFrac)}</strong> · Saldo USD <strong style={{color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalFob*(1-supDepFrac))}</strong></span>
      </div>

      {validChannels.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{padding:"10px 14px",background:isStage1Covered?"rgba(34,197,94,0.06)":"rgba(248,113,113,0.06)",border:`1px solid ${isStage1Covered?"rgba(34,197,94,0.25)":"rgba(248,113,113,0.3)"}`,borderRadius:10}}>
          <p style={{fontSize:10.5,fontWeight:700,color:isStage1Covered?"#22c55e":"#f87171",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>{isStage1Covered?"✓ Stage 1 cubre anticipo":"⚠ Stage 1 no cubre anticipo"}</p>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.65)",margin:"3px 0 0",lineHeight:1.4}}>Necesitás <strong style={{color:"#fff"}}>{minStage1}%</strong>, plan cobra <strong style={{color:isStage1Covered?"#22c55e":"#f87171"}}>{stage1Pct}%</strong></p>
        </div>
        <div style={{padding:"10px 14px",background:isStage12Covered?"rgba(34,197,94,0.06)":"rgba(248,113,113,0.06)",border:`1px solid ${isStage12Covered?"rgba(34,197,94,0.25)":"rgba(248,113,113,0.3)"}`,borderRadius:10}}>
          <p style={{fontSize:10.5,fontWeight:700,color:isStage12Covered?"#22c55e":"#f87171",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>{isStage12Covered?"✓ Stage 1+2 cubre FOB":"⚠ Stage 1+2 no cubre FOB"}</p>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.65)",margin:"3px 0 0",lineHeight:1.4}}>Necesitás <strong style={{color:"#fff"}}>{minStage12}%</strong>, plan cobra <strong style={{color:isStage12Covered?"#22c55e":"#f87171"}}>{stage12Pct}%</strong></p>
        </div>
      </div>}

      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {paymentPlan.map((stage,i)=>{
          const stageBadge=i===0?{l:"ANTICIPO",c:"#60a5fa",b:"rgba(96,165,250,0.12)"}:i===1?{l:"PRODUCCIÓN",c:"#a78bfa",b:"rgba(168,85,247,0.12)"}:i===2?{l:"ARRIBO",c:"#f59e0b",b:"rgba(245,158,11,0.12)"}:null;
          const errBorder=(i===0&&!isStage1Covered)||(i===1&&!isStage12Covered);
          return <div key={i} style={{flex:"1 1 200px",padding:"12px 14px",background:"rgba(0,0,0,0.18)",borderRadius:10,border:`1px solid ${errBorder?"rgba(248,113,113,0.35)":"rgba(255,255,255,0.06)"}`}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <input type="text" inputMode="numeric" value={stage.pct} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");const n=Number(v)||0;setPaymentPlan(p=>{const others=p.reduce((s,x,j)=>s+(j===i?0:Number(x.pct||0)),0);const capped=Math.min(n,Math.max(0,100-others));return p.map((s,j)=>j===i?{...s,pct:capped}:s);});}} style={{width:50,padding:"4px 6px",fontSize:14,fontWeight:700,background:"transparent",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"#fff",textAlign:"center",outline:"none"}}/>
              <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>%</span>
              {stageBadge&&<span style={{fontSize:9.5,fontWeight:700,padding:"2px 6px",borderRadius:4,background:stageBadge.b,color:stageBadge.c,letterSpacing:"0.04em",marginLeft:"auto"}}>{stageBadge.l}</span>}
            </div>
            <input value={stage.label} onChange={e=>setPaymentPlan(p=>p.map((s,j)=>j===i?{...s,label:e.target.value}:s))} style={{width:"100%",padding:"5px 8px",fontSize:11,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,color:"rgba(255,255,255,0.8)",outline:"none",fontFamily:"inherit"}}/>
          </div>;
        })}
      </div>
      <p style={{fontSize:10.5,color:"rgba(255,255,255,0.45)",marginTop:8}}>Total: <strong style={{color:paymentPlan.reduce((s,p)=>s+p.pct,0)===100?"#22c55e":"#fbbf24"}}>{paymentPlan.reduce((s,p)=>s+p.pct,0)}%</strong> {paymentPlan.reduce((s,p)=>s+p.pct,0)!==100&&<span style={{color:"#fbbf24"}}>(debe sumar 100%)</span>}</p>
    </div>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14}}>
      <button onClick={onBack} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",fontFamily:"inherit"}}>← Volver</button>
      <button onClick={onNext} disabled={saving} style={{padding:"10px 20px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:saving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Generando…":"Generar link al cliente →"}</button>
    </div>
  </div>;
}

function WizStep3({generatedQuote,client,request,onBack}){
  const [copied,setCopied]=useState(false);
  if(!generatedQuote)return <p style={{color:"rgba(255,255,255,0.5)"}}>Sin cotización generada</p>;
  const url=`${typeof window!=="undefined"?window.location.origin:"https://argencargo.com.ar"}/cotizacion/${generatedQuote.public_token}`;
  const copy=()=>{navigator.clipboard?.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  // WhatsApp: número AR limpio + mensaje preset (mismo template que en CommunicationsTab).
  const waNumber=cleanWaNumber(client?.whatsapp||client?.phone||"");
  const firstName=client?.first_name||"";
  const code=request?.request_code||"";
  const waMsg=encodeURIComponent(buildQuoteWaMessage({firstName,code,url,expiresAt:request?.expires_at}));
  const waUrl=waNumber?`https://wa.me/${waNumber}?text=${waMsg}`:`https://wa.me/?text=${waMsg}`;
  return <div>
    <div style={{textAlign:"center",padding:"40px 30px",background:"linear-gradient(135deg,rgba(34,197,94,0.10),rgba(34,197,94,0.02))",border:"1px solid rgba(34,197,94,0.3)",borderRadius:14,marginBottom:18}}>
      <div style={{fontSize:48,marginBottom:8}}>🔗</div>
      <h2 style={{fontSize:20,fontWeight:800,marginBottom:8}}>Cotización lista</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginBottom:20}}>Compartile este link al cliente. Puede elegir servicio + entrega y aceptar online.</p>
      <div style={{display:"flex",alignItems:"center",gap:10,maxWidth:600,margin:"0 auto 14px",padding:"12px 16px",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(184,149,106,0.3)",borderRadius:10}}>
        <span style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:GOLD_LIGHT,textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</span>
        <button onClick={copy} style={{padding:"6px 12px",fontSize:11.5,fontWeight:700,borderRadius:7,border:"none",background:copied?"#22c55e":GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{copied?"✓ Copiado":"📋 Copiar"}</button>
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap",maxWidth:600,margin:"0 auto"}}>
        <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"11px 20px",fontSize:13,fontWeight:700,borderRadius:10,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",textDecoration:"none",fontFamily:"inherit",boxShadow:"0 4px 14px rgba(37,211,102,0.3)"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
          Enviar por WhatsApp{client?.whatsapp&&waNumber?` a ${firstName||"cliente"}`:""}
        </a>
      </div>
      {!waNumber&&<p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",marginTop:10,fontStyle:"italic"}}>El cliente no tiene WhatsApp cargado — el botón te abre WhatsApp sin destinatario para que elijas a quién mandárselo.</p>}
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

// PhotoUpload: thumb + botón cambiar/quitar. Click abre modal con drag/drop/paste/file picker.
function PhotoUpload({value,onChange,token}){
  const [open,setOpen]=useState(false);
  return <div>
    <label style={lblStyle()}>Foto del producto</label>
    {value?
      <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.12)",background:"#000",height:140,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}} onClick={()=>setOpen(true)} title="Click para cambiar">
        <img src={value} alt="Producto" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>
        <button onClick={e=>{e.stopPropagation();onChange("");}} title="Quitar foto" style={{position:"absolute",top:6,right:6,padding:"5px 8px",fontSize:11,fontWeight:700,borderRadius:6,border:"1px solid rgba(248,113,113,0.5)",background:"rgba(0,0,0,0.7)",color:"#f87171",cursor:"pointer",fontFamily:"inherit"}}>✕</button>
      </div>:
      <button onClick={()=>setOpen(true)} type="button" style={{width:"100%",height:140,border:"2px dashed rgba(255,255,255,0.18)",borderRadius:10,background:"rgba(0,0,0,0.18)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,transition:"all 150ms",fontFamily:"inherit"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.4)";e.currentTarget.style.background="rgba(184,149,106,0.04)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.18)";e.currentTarget.style.background="rgba(0,0,0,0.18)";}}>
        <div style={{fontSize:28,opacity:0.6}}>📷</div>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.65)",fontWeight:600,margin:0,textAlign:"center"}}>Subir foto del producto</p>
      </button>
    }
    {open&&<PhotoUploadModal token={token} onCancel={()=>setOpen(false)} onUploaded={url=>{onChange(url);setOpen(false);}}/>}
  </div>;
}

function PhotoUploadModal({token,onCancel,onUploaded}){
  const [drag,setDrag]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [preview,setPreview]=useState(null);
  // Capturar paste en cualquier parte del modal (document level)
  useEffect(()=>{
    const handler=(e)=>{
      const items=e.clipboardData?.items||[];
      for(const it of items){
        if(it.type.startsWith("image/")){const f=it.getAsFile();if(f){handleFile(f);return;}}
      }
    };
    document.addEventListener("paste",handler);
    return()=>document.removeEventListener("paste",handler);
  },[]);
  const handleFile=async(file)=>{
    if(!file||!file.type?.startsWith("image/")){alert("Solo imágenes (JPG/PNG/WebP)");return;}
    if(file.size>10*1024*1024){alert("Máximo 10 MB");return;}
    // Preview inmediato
    const reader=new FileReader();reader.onload=e=>setPreview(e.target.result);reader.readAsDataURL(file);
    setUploading(true);
    try{
      const url=await uploadProductPhoto(file,token);
      if(url)onUploaded(url);
      else{alert("No se pudo subir la imagen");setUploading(false);setPreview(null);}
    } catch(e){alert("Error: "+e.message);setUploading(false);setPreview(null);}
  };
  const onDrop=(e)=>{e.preventDefault();e.stopPropagation();setDrag(false);const f=e.dataTransfer?.files?.[0];if(f)handleFile(f);};
  const onDragOver=(e)=>{e.preventDefault();e.stopPropagation();if(!drag)setDrag(true);};
  const onDragEnter=(e)=>{e.preventDefault();e.stopPropagation();setDrag(true);};
  const onDragLeave=(e)=>{e.preventDefault();e.stopPropagation();if(e.target===e.currentTarget)setDrag(false);};

  return <div onClick={()=>!uploading&&onCancel()} onDragOver={onDragOver} onDrop={onDrop} style={{position:"fixed",inset:0,background:"rgba(8,12,20,0.85)",backdropFilter:"blur(8px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div onClick={e=>e.stopPropagation()} onDrop={onDrop} onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave} style={{maxWidth:560,width:"100%",background:"linear-gradient(180deg,#142038,#0f1a2e)",border:`2px solid ${drag?"rgba(184,149,106,0.6)":"rgba(255,255,255,0.1)"}`,borderRadius:16,padding:"24px",boxShadow:"0 32px 80px rgba(0,0,0,0.65)",transition:"border-color 150ms"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,paddingBottom:14,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div>
          <h3 style={{fontSize:17,fontWeight:700,color:"#fff",margin:"0 0 3px"}}>Subir foto del producto</h3>
          <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",margin:0}}>Arrastrá una imagen, pegala con Cmd+V, o elegí un archivo</p>
        </div>
        <button onClick={()=>!uploading&&onCancel()} disabled={uploading} style={{fontSize:22,background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",cursor:uploading?"not-allowed":"pointer",padding:"0 4px"}}>✕</button>
      </div>

      <div style={{height:300,border:`2px dashed ${drag?"rgba(184,149,106,0.7)":"rgba(255,255,255,0.18)"}`,borderRadius:12,background:drag?"rgba(184,149,106,0.10)":"rgba(0,0,0,0.25)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,transition:"all 150ms",position:"relative",overflow:"hidden"}}>
        {preview?<img src={preview} alt="Preview" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>:
          uploading?<>
            <div style={{fontSize:48}}>⏳</div>
            <p style={{fontSize:13,color:GOLD_LIGHT,fontWeight:600,margin:0}}>Subiendo imagen…</p>
          </>:<>
            <div style={{fontSize:48,opacity:drag?1:0.5}}>{drag?"⬇️":"📷"}</div>
            <p style={{fontSize:14,color:"#fff",fontWeight:700,margin:0,textAlign:"center"}}>{drag?"Soltá la imagen aquí":"Arrastrá una imagen"}</p>
            <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",margin:0,textAlign:"center"}}>O usá uno de los siguientes:</p>
            <div style={{display:"flex",gap:10,marginTop:6}}>
              <label style={{padding:"9px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:"1px solid rgba(184,149,106,0.4)",background:"rgba(184,149,106,0.08)",color:GOLD_LIGHT,cursor:"pointer",fontFamily:"inherit"}}>
                📁 Elegir archivo
                <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value="";}} style={{display:"none"}}/>
              </label>
              <span style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.6)"}}>⌘V Pegar</span>
            </div>
          </>}
      </div>
    </div>
  </div>;
}

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
  const [search,setSearch]=useState("");
  const [selOpId,setSelOpId]=useState(null);

  useEffect(()=>{(async()=>{
    setLo(true);
    const [opsRes,earnRes]=await Promise.all([
      dq("operations",{token,filters:"?service_type=eq.gestion_integral&select=*,clients(first_name,last_name,client_code,gi_partner_id,gi_commission_pct)&order=created_at.desc"}),
      dq("gi_partner_earnings",{token,filters:"?select=*&order=closed_at.desc"}),
    ]);
    setOps(Array.isArray(opsRes)?opsRes:[]);
    setEarnings(Array.isArray(earnRes)?earnRes:[]);
    setLo(false);
  })();},[token]);

  const earningByOpId=earnings.reduce((m,e)=>{m[e.operation_id]=e;return m;},{});

  const calcComision=(op)=>{
    const earn=earningByOpId[op.id];
    if(earn)return {amount:Number(earn.commission_usd||0),real:true,pct:Number(earn.commission_pct||0)};
    // Prioridad: override por op > % del cliente
    const pct=Number(op.gi_commission_pct!=null?op.gi_commission_pct:(op.clients?.gi_commission_pct||0));
    const total=Number(op.budget_total||0);
    const netEst=total*0.08;
    const est=netEst*pct/100;
    return {amount:est,real:false,pct};
  };

  const matchSearch=(op)=>{
    if(!search)return true;
    const s=search.toLowerCase();
    const cn=op.clients?`${op.clients.first_name||""} ${op.clients.last_name||""}`.toLowerCase():"";
    return op.operation_code.toLowerCase().includes(s)||cn.includes(s)||String(op.description||"").toLowerCase().includes(s);
  };
  const isClosed=(o)=>["operacion_cerrada","cancelada"].includes(o.status);
  const activas=ops.filter(o=>!isClosed(o)&&matchSearch(o));
  const cerradas=ops.filter(o=>isClosed(o)&&matchSearch(o));

  const totalActiveCommission=activas.reduce((s,op)=>s+calcComision(op).amount,0);
  const totalClosedCommission=cerradas.filter(o=>o.status==="operacion_cerrada").reduce((s,op)=>s+calcComision(op).amount,0);

  if(selOpId){
    return <OpDetail token={token} opId={selOpId} onBack={()=>setSelOpId(null)} calcComision={calcComision}/>;
  }

  const renderTable=(rows)=>rows.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"2rem 0"}}>Sin operaciones en esta vista.</p>:
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
          <th style={thStyle()}>Comisión</th>
        </tr></thead>
        <tbody>
          {rows.map(op=>{const st=STATUS_MAP[op.status]||{l:op.status,c:"#999"};const cn=op.clients?`${op.clients.first_name||""} ${op.clients.last_name||""}`.trim():"—";const com=calcComision(op);const chLabel=CHANNEL_DEFS.find(c=>c.key===op.channel)?.name||op.channel;return <tr key={op.id} onClick={()=>setSelOpId(op.id)} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",transition:"background 120ms"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(184,149,106,0.06)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <td style={{padding:"13px 14px",fontFamily:"'JetBrains Mono','SF Mono',monospace",fontWeight:600,color:GOLD_LIGHT,fontSize:12.5,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>{op.operation_code}</td>
            <td style={{padding:"13px 14px",color:"#fff",fontWeight:600,whiteSpace:"nowrap"}}>{cn}</td>
            <td style={{padding:"13px 14px",color:"rgba(255,255,255,0.6)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{op.description||"—"}</td>
            <td style={{padding:"13px 14px",whiteSpace:"nowrap"}}><span style={{display:"inline-block",fontSize:10,padding:"3px 9px",borderRadius:6,background:"rgba(184,149,106,0.10)",color:GOLD_LIGHT,fontWeight:600,letterSpacing:"0.03em",whiteSpace:"nowrap"}}>{chLabel}</span></td>
            <td style={{padding:"13px 14px",whiteSpace:"nowrap"}}><span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:10,fontWeight:700,padding:"4px 10px 4px 8px",borderRadius:999,color:st.c,background:`${st.c}14`,border:`1px solid ${st.c}40`,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}><span style={{display:"inline-block",width:5,height:5,borderRadius:"50%",background:st.c,flexShrink:0}}/>{st.l}</span></td>
            <td style={{padding:"13px 14px",color:"rgba(255,255,255,0.55)",fontFeatureSettings:'"tnum"',textAlign:"center",whiteSpace:"nowrap"}}>{op.eta?fmtDateShort(op.eta):"—"}</td>
            <td style={{padding:"13px 14px",textAlign:"right",color:"#fff",fontWeight:600,fontFeatureSettings:'"tnum"',whiteSpace:"nowrap"}}>{fmtUSD(op.budget_total)}</td>
            <td style={{padding:"13px 14px",textAlign:"right",color:com.real?(Number(com.amount)<0?"#f87171":"#22c55e"):"rgba(255,255,255,0.5)",fontWeight:700,fontFeatureSettings:'"tnum"',whiteSpace:"nowrap"}} title={com.real?(Number(com.amount)<0?`Op a pérdida — ${com.pct}% absorbido por el socio`:`Comisión real: ${com.pct}% sobre ganancia neta`):`Estimación con ${com.pct}% del cliente`}>{com.pct>0?fmtUSD(com.amount):"—"}{!com.real&&com.pct>0&&<span style={{fontSize:9,marginLeft:4,opacity:0.6}}>est.</span>}</td>
          </tr>;})}
        </tbody>
      </table>
    </div>;

  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px",color:"#fff"}}>Operaciones GI</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:22}}>Operaciones de Gestión Integral de tus clientes asignados. Las comisiones se calculan al cerrar cada op sobre la ganancia neta real.</p>

    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:20}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por código, cliente o descripción..." style={{padding:"9px 12px",fontSize:12.5,border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none",fontFamily:"inherit",minWidth:280,flex:1}}/>
    </div>

    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10,flexWrap:"wrap",gap:10}}>
        <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",margin:0}}>Activas <span style={{color:GOLD_LIGHT,marginLeft:4}}>({activas.length})</span></h3>
        {activas.length>0&&<span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>Comisión est. activa: <strong style={{color:GOLD_LIGHT}}>{fmtUSD(totalActiveCommission)}</strong></span>}
      </div>
      {renderTable(activas)}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginTop:30,marginBottom:10,flexWrap:"wrap",gap:10}}>
        <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.1em",margin:0}}>Cerradas <span style={{color:"rgba(255,255,255,0.55)",marginLeft:4}}>({cerradas.length})</span></h3>
        {cerradas.length>0&&<span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Comisión real cerrada: <strong style={{color:Number(totalClosedCommission)<0?"#f87171":"#22c55e"}}>{fmtUSD(totalClosedCommission)}</strong></span>}
      </div>
      {renderTable(cerradas)}
    </>}
  </div>;
}

// ─── DETALLE DE OPERACIÓN GI (read-only para el socio) ───
function OpDetail({token,opId,onBack,calcComision}){
  const [op,setOp]=useState(null);
  const [items,setItems]=useState([]);
  const [pkgs,setPkgs]=useState([]);
  const [cliPmts,setCliPmts]=useState([]);
  const [supPmts,setSupPmts]=useState([]);
  const [finEntries,setFinEntries]=useState([]);
  const [earning,setEarning]=useState(null);
  const [lo,setLo]=useState(true);
  useEffect(()=>{(async()=>{
    setLo(true);
    const [opR,it,pk,cp,sp,fe,ea]=await Promise.all([
      dq("operations",{token,filters:`?id=eq.${opId}&select=*,clients(*)`}),
      dq("operation_items",{token,filters:`?operation_id=eq.${opId}&select=*&order=created_at.asc`}),
      dq("operation_packages",{token,filters:`?operation_id=eq.${opId}&select=*&order=package_number.asc`}),
      dq("operation_client_payments",{token,filters:`?operation_id=eq.${opId}&select=*&order=payment_date.asc`}),
      dq("operation_supplier_payments",{token,filters:`?operation_id=eq.${opId}&select=*&order=payment_date.asc`}),
      dq("finance_entries",{token,filters:`?operation_id=eq.${opId}&select=*&order=date.asc`}),
      dq("gi_partner_earnings",{token,filters:`?operation_id=eq.${opId}&select=*&limit=1`}),
    ]);
    setOp(Array.isArray(opR)?opR[0]:null);
    setItems(Array.isArray(it)?it:[]);
    setPkgs(Array.isArray(pk)?pk:[]);
    setCliPmts(Array.isArray(cp)?cp:[]);
    setSupPmts(Array.isArray(sp)?sp:[]);
    setFinEntries(Array.isArray(fe)?fe:[]);
    setEarning(Array.isArray(ea)&&ea[0]?ea[0]:null);
    setLo(false);
  })();},[opId,token]);

  if(lo)return <div><button onClick={onBack} style={backBtn()}>← Volver</button><p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p></div>;
  if(!op)return <div><button onClick={onBack} style={backBtn()}>← Volver</button><p style={{color:"rgba(255,255,255,0.4)"}}>Operación no encontrada</p></div>;

  const cn=op.clients?`${op.clients.first_name||""} ${op.clients.last_name||""}`.trim():"—";
  const st=STATUS_MAP[op.status]||{l:op.status,c:"#999"};
  const chLabel=CHANNEL_DEFS.find(c=>c.key===op.channel)?.name||op.channel;
  const totalPaid=cliPmts.reduce((s,p)=>s+Number(p.amount_usd||0),0);
  // Costos reales de la op (mismo cálculo que el KPI de ganancia neta)
  const _cFix=Number(op.cost_flete||0)+Number(op.cost_seguro||0)+Number(op.cost_flete_local||0)+Number(op.cost_otros||0)+Number(op.cost_impuestos_reales||0)+Number(op.cost_gasto_documental||0);
  const _cSupplier=supPmts.filter(p=>p.is_paid).reduce((s,p)=>{const sgn=p.type==="refund"?-1:1;return s+sgn*Number(p.amount_usd||0);},0);
  const _cFin=finEntries.filter(e=>e.type==="gasto"&&e.category!=="comisiones_socio").reduce((s,e)=>{const c=e.currency==="ARS"&&Number(e.exchange_rate||0)>0?Number(e.amount||0)/Number(e.exchange_rate):Number(e.amount||0);return s+c;},0);
  const _totalCost=_cFix+_cSupplier+_cFin;
  const _netProfit=totalPaid-_totalCost;
  // Comisión: si hay earning real, usarlo. Sino estimar con netProfit real (no mock 8%).
  const com=(()=>{
    if(earning)return {amount:Number(earning.commission_usd||0),real:true,pct:Number(earning.commission_pct||0)};
    const pct=Number(op.gi_commission_pct!=null?op.gi_commission_pct:(op.clients?.gi_commission_pct||0));
    if(pct<=0)return{amount:0,real:false,pct:0};
    const net=Math.max(0,_netProfit);
    return {amount:net*pct/100,real:false,pct};
  })();
  const totalProducts=items.reduce((s,i)=>s+Number(i.unit_price_usd||0)*Number(i.quantity||0),0);
  const totalKg=pkgs.reduce((s,p)=>s+(Number(p.gross_weight_kg||0)*Number(p.quantity||1)),0);
  const totalCBM=pkgs.reduce((s,p)=>{const l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0),q=Number(p.quantity||1);return s+(l&&w&&h?(l*w*h/1000000)*q:0);},0);

  return <div>
    <button onClick={onBack} style={backBtn()}>← Volver</button>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14,marginBottom:6,marginTop:8}}>
      <div>
        <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px",color:"#fff"}}><span style={{color:GOLD_LIGHT,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.04em"}}>{op.operation_code}</span> · {cn}</h1>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.55)",margin:0}}>{op.description||"—"}</p>
      </div>
      <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:999,color:st.c,background:`${st.c}14`,border:`1px solid ${st.c}40`,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:st.c}}/>{st.l}</span>
    </div>

    {(()=>{
      const pendienteCobro=Math.max(0,Number(op.budget_total||0)-totalPaid);
      return <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginTop:18,marginBottom:24}}>
        <Kpi label="Canal" val={chLabel} sub={op.origin?`Origen ${op.origin}`:""}/>
        <Kpi label="Total cliente" val={fmtUSD(op.budget_total)} sub={pendienteCobro>0.01?`Pendiente: ${fmtUSD(pendienteCobro)}`:`Cobrado completo`} color={GOLD_LIGHT}/>
        <Kpi label="Ganancia neta op" val={fmtUSD(_netProfit)} sub={`Ingresos ${fmtUSD(totalPaid)} − costos ${fmtUSD(_totalCost)}`} color={_netProfit>=0?"#22c55e":"#f87171"}/>
        <Kpi label={com.real?(Number(com.amount)<0?"Pérdida absorbida":"Tu comisión"):"Comisión est."} val={com.pct>0?fmtUSD(com.amount):"—"} sub={com.pct>0?`${com.pct}%${com.real?(Number(com.amount)<0?" sobre la pérdida":" sobre neto real"):" estimada"}`:"Cliente sin %"} color={com.real?(Number(com.amount)<0?"#f87171":"#22c55e"):GOLD_LIGHT}/>
        <Kpi label="ETA" val={op.eta?fmtDate(op.eta):"—"} sub={op.closed_at?`Cerrada: ${fmtDate(op.closed_at)}`:""}/>
      </div>;
    })()}

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:18}}>
      <Card title={`Productos (${items.length})`}>
        {items.length===0?<p style={{color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>Sin productos cargados</p>:
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {items.map((it,i)=>{const sub=Number(it.unit_price_usd||0)*Number(it.quantity||0);return <div key={it.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"rgba(0,0,0,0.18)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:12.5,fontWeight:600,color:"#fff",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.description||"—"}</p>
                <p style={{fontSize:10.5,color:"rgba(255,255,255,0.5)",marginTop:2,fontFeatureSettings:'"tnum"'}}>{it.quantity||0} u. × {fmtUSD(it.unit_price_usd)}{it.ncm_code?` · NCM ${it.ncm_code}`:""}</p>
              </div>
              <p style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,fontFeatureSettings:'"tnum"',marginLeft:10}}>{fmtUSD(sub)}</p>
            </div>;})}
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 4px",borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:4}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Subtotal FOB</span>
              <span style={{fontSize:14,fontWeight:700,color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalProducts)}</span>
            </div>
          </div>
        }
      </Card>

      <Card title={`Bultos (${pkgs.length})`}>
        {pkgs.length===0?<p style={{color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>Sin bultos cargados todavía</p>:
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {pkgs.map((p,i)=>{const dim=p.length_cm&&p.width_cm&&p.height_cm?`${p.length_cm}×${p.width_cm}×${p.height_cm} cm`:"—";const w=Number(p.gross_weight_kg||0);return <div key={p.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"rgba(0,0,0,0.18)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:12.5,fontWeight:600,color:"#fff",margin:0}}>Bulto #{p.package_number||i+1}{p.quantity>1?` ×${p.quantity}`:""}</p>
                <p style={{fontSize:10.5,color:"rgba(255,255,255,0.5)",marginTop:2}}>{dim}{p.national_tracking?` · ${p.national_tracking}`:""}</p>
              </div>
              <p style={{fontSize:13,fontWeight:700,color:"#fff",fontFeatureSettings:'"tnum"',marginLeft:10}}>{w>0?`${w.toFixed(1)} kg`:"—"}</p>
            </div>;})}
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 4px",borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:4,gap:14}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Total</span>
              <span style={{fontSize:13,fontWeight:700,color:"#fff",fontFeatureSettings:'"tnum"'}}>{totalKg.toFixed(1)} kg · {totalCBM.toFixed(3)} m³</span>
            </div>
          </div>
        }
      </Card>
    </div>

    <Card title={`Pagos del cliente (${cliPmts.length})`}>
      {cliPmts.length===0?<p style={{color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>Sin pagos registrados todavía</p>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <th style={thStyle()}>Fecha</th>
            <th style={thStyle()}>Método</th>
            <th style={thStyle()}>Notas</th>
            <th style={{...thStyle(),textAlign:"right"}}>Monto</th>
          </tr></thead>
          <tbody>
            {cliPmts.map(p=><tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.65)",textAlign:"center",fontFeatureSettings:'"tnum"'}}>{fmtDateShort(p.payment_date)}</td>
              <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.65)",textAlign:"center",textTransform:"capitalize"}}>{p.payment_method||"—"}</td>
              <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.55)"}}>{p.notes||"—"}</td>
              <td style={{padding:"10px 12px",textAlign:"right",color:"#22c55e",fontWeight:700,fontFeatureSettings:'"tnum"'}}>{fmtUSD(p.amount_usd)}</td>
            </tr>)}
            <tr style={{borderTop:"1.5px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.02)"}}>
              <td colSpan={3} style={{padding:"11px 12px",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Total cobrado</td>
              <td style={{padding:"11px 12px",textAlign:"right",color:"#22c55e",fontWeight:800,fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalPaid)}</td>
            </tr>
          </tbody>
        </table>
      }
    </Card>

    {(()=>{
      // Construir lista de gastos: costos op + pagos a proveedor (GI) + finance_entries (impuestos auto, gasto doc, etc)
      const gastos=[];
      // Costos directos de la op (cost_*)
      const cFlete=Number(op.cost_flete||0);if(cFlete>0)gastos.push({date:op.cost_flete_paid_at?.slice(0,10)||null,label:"Flete internacional",amount:cFlete,paid:!!op.cost_flete_paid_at,method:op.cost_flete_method||"—"});
      const cSeguro=Number(op.cost_seguro||0);if(cSeguro>0)gastos.push({date:op.cost_seguro_paid_at?.slice(0,10)||null,label:"Seguro",amount:cSeguro,paid:!!op.cost_seguro_paid_at});
      const cFleteLocal=Number(op.cost_flete_local||0);if(cFleteLocal>0)gastos.push({date:op.cost_flete_local_paid_at?.slice(0,10)||null,label:"Flete local AR",amount:cFleteLocal,paid:!!op.cost_flete_local_paid_at});
      const cOtros=Number(op.cost_otros||0);if(cOtros>0)gastos.push({date:op.cost_otros_paid_at?.slice(0,10)||null,label:"Otros",amount:cOtros,paid:!!op.cost_otros_paid_at});
      const cImp=Number(op.cost_impuestos_reales||0);if(cImp>0)gastos.push({date:null,label:"Impuestos reales",amount:cImp,paid:false});
      const cGastoDoc=Number(op.cost_gasto_documental||0);if(cGastoDoc>0)gastos.push({date:null,label:"Gasto documental",amount:cGastoDoc,paid:false});
      // GI: NO sumar cost_producto_usd como gasto separado — los pagos al proveedor (supplier_payments) lo cubren detalladamente.
      // Pagos a proveedor (GI)
      supPmts.forEach(p=>{const isRefund=p.type==="refund";gastos.push({date:p.payment_date,label:isRefund?`↩ Reembolso proveedor`:`Pago a proveedor${p.notes?` · ${p.notes}`:""}`,amount:isRefund?-Number(p.amount_usd||0):Number(p.amount_usd||0),paid:!!p.is_paid,method:p.payment_method||"—"});});
      // Finance entries (impuestos/gasto doc auto-generadas + manuales linkeadas a la op)
      finEntries.filter(e=>e.type==="gasto").forEach(e=>{const amt=e.currency==="ARS"&&Number(e.exchange_rate||0)>0?Number(e.amount||0)/Number(e.exchange_rate):Number(e.amount||0);gastos.push({date:e.date,label:e.description||e.detail||"Gasto",amount:amt,paid:!!e.is_paid,method:e.payment_method||"—",auto:e.auto_generated});});
      const totalGastos=gastos.reduce((s,g)=>s+g.amount,0);
      const totalPagados=gastos.filter(g=>g.paid).reduce((s,g)=>s+g.amount,0);
      gastos.sort((a,b)=>{if(!a.date&&!b.date)return 0;if(!a.date)return 1;if(!b.date)return -1;return a.date.localeCompare(b.date);});

      if(gastos.length===0)return null;
      return <Card title={`Gastos / Costos de la operación (${gastos.length})`}>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",margin:"-4px 0 12px",lineHeight:1.5}}>Costos directos de la op + pagos a proveedor (Gestión Integral) + impuestos y gastos documentales auto-generados.</p>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <th style={thStyle()}>Fecha</th>
            <th style={thStyle()}>Concepto</th>
            <th style={thStyle()}>Método</th>
            <th style={thStyle()}>Estado</th>
            <th style={{...thStyle(),textAlign:"right"}}>Monto</th>
          </tr></thead>
          <tbody>
            {gastos.map((g,i)=><tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.6)",textAlign:"center",fontFeatureSettings:'"tnum"',whiteSpace:"nowrap"}}>{g.date?fmtDateShort(g.date):"—"}</td>
              <td style={{padding:"10px 12px",color:"#fff"}}>{g.label}{g.auto&&<span style={{marginLeft:6,fontSize:9,padding:"1px 5px",borderRadius:4,background:"rgba(96,165,250,0.12)",color:"#60a5fa"}}>auto</span>}</td>
              <td style={{padding:"10px 12px",color:"rgba(255,255,255,0.55)",textAlign:"center",textTransform:"capitalize",whiteSpace:"nowrap"}}>{(g.method||"—").replace(/_/g," ")}</td>
              <td style={{padding:"10px 12px",textAlign:"center"}}>{g.paid?<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,background:"rgba(34,197,94,0.10)",color:"#22c55e",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>Pagado</span>:<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,background:"rgba(251,191,36,0.10)",color:"#fbbf24",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>Pendiente</span>}</td>
              <td style={{padding:"10px 12px",textAlign:"right",color:g.amount<0?"#22c55e":"#f87171",fontWeight:700,fontFeatureSettings:'"tnum"'}}>{g.amount<0?"+":"−"}{fmtUSD(Math.abs(g.amount))}</td>
            </tr>)}
            <tr style={{borderTop:"1.5px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.02)"}}>
              <td colSpan={4} style={{padding:"11px 12px",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Total gastos (pagado: {fmtUSD(totalPagados)})</td>
              <td style={{padding:"11px 12px",textAlign:"right",color:"#f87171",fontWeight:800,fontFeatureSettings:'"tnum"'}}>−{fmtUSD(totalGastos)}</td>
            </tr>
          </tbody>
        </table>
        <p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",marginTop:10,fontStyle:"italic",lineHeight:1.5}}>El admin va cargando los costos reales a medida que la op avanza. La comisión del socio se calcula al cerrar la op sobre la ganancia neta real (ingresos − todos los costos).</p>
      </Card>;
    })()}

    {earning&&<Card title="Liquidación de comisión">
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Ingresos</p><p style={{fontSize:14,fontWeight:700,color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(earning.revenue_usd)}</p></div>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Costos</p><p style={{fontSize:14,fontWeight:700,color:"#f87171",fontFeatureSettings:'"tnum"'}}>{fmtUSD(earning.total_costs_usd)}</p></div>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Ganancia neta</p><p style={{fontSize:14,fontWeight:700,color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(earning.net_profit_usd)}</p></div>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{Number(earning.commission_usd||0)<0?"Pérdida absorbida":"Tu comisión"} {earning.commission_pct}%</p><p style={{fontSize:18,fontWeight:800,color:Number(earning.commission_usd||0)<0?"#f87171":"#22c55e",fontFeatureSettings:'"tnum"'}}>{fmtUSD(earning.commission_usd)}</p></div>
      </div>
      <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:12}}>{earning.paid_to_partner?`✓ Pagada el ${fmtDate(earning.paid_at)}`:"⏳ Pendiente de pago al socio"}</p>
    </Card>}
  </div>;
}
function backBtn(){return {fontSize:12,color:"rgba(255,255,255,0.55)",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontWeight:600,padding:"6px 12px",borderRadius:8,letterSpacing:"0.04em",fontFamily:"inherit"};}

function thStyle(){return {textAlign:"center",padding:"12px 14px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap"};}

// ────────────────────────────────────────────
// PANE: DASHBOARD (financiero)
// ────────────────────────────────────────────
function PaneDashboard({token,profileId,isAdmin}){
  // Dashboard del SOCIO: solo sus comisiones (devengado/cobrado/pendiente).
  // Los costos de la empresa, deudas TC, etc. quedan en el panel admin.
  const [earnings,setEarnings]=useState([]);
  const [lo,setLo]=useState(true);
  useEffect(()=>{(async()=>{
    setLo(true);
    const filt=isAdmin||!profileId?"":`partner_id=eq.${profileId}&`;
    const r=await dq("gi_partner_earnings",{token,filters:`?${filt}select=*,operations(operation_code,clients(first_name,last_name,client_code))&order=closed_at.desc`});
    setEarnings(Array.isArray(r)?r:[]);
    setLo(false);
  })();},[token,profileId,isAdmin]);

  if(lo)return <p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>;

  const now=new Date();
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString();
  const lastMonthStart=new Date(now.getFullYear(),now.getMonth()-1,1).toISOString();
  const lastMonthEnd=monthStart;

  // Comisiones (gi_partner_earnings)
  const earnThisMonth=earnings.filter(e=>e.closed_at&&e.closed_at>=monthStart).reduce((s,e)=>s+Number(e.commission_usd||0),0);
  const earnLastMonth=earnings.filter(e=>e.closed_at&&e.closed_at>=lastMonthStart&&e.closed_at<lastMonthEnd).reduce((s,e)=>s+Number(e.commission_usd||0),0);
  const earnTotal=earnings.reduce((s,e)=>s+Number(e.commission_usd||0),0);
  const earnPending=earnings.filter(e=>!e.paid_to_partner).reduce((s,e)=>s+Number(e.commission_usd||0),0);
  const earnPaid=earnings.filter(e=>e.paid_to_partner).reduce((s,e)=>s+Number(e.paid_amount_usd||e.commission_usd||0),0);
  const trend=earnLastMonth!==0?((earnThisMonth-earnLastMonth)/Math.abs(earnLastMonth)*100):(earnThisMonth!==0?100:0);
  const ticketAvg=earnings.length>0?earnTotal/earnings.length:0;

  // Ops con comisión estimada (TC pendiente de dolarizar)
  const estimadas=earnings.filter(e=>e.is_estimated);

  // Top 5 clientes por comisión generada
  const byClient={};
  for(const e of earnings){
    const cn=e.operations?.clients?`${e.operations.clients.first_name||""} ${e.operations.clients.last_name||""}`.trim():"—";
    if(!byClient[cn])byClient[cn]={name:cn,com:0,ops:0};
    byClient[cn].com+=Number(e.commission_usd||0);
    byClient[cn].ops+=1;
  }
  const topClients=Object.values(byClient).sort((a,b)=>b.com-a.com).slice(0,5);

  // Chart mensual: comisiones últimos 8 meses
  const months=[];
  for(let i=7;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const start=d.toISOString();
    const end=new Date(d.getFullYear(),d.getMonth()+1,1).toISOString();
    const monthEarn=earnings.filter(e=>e.closed_at&&e.closed_at>=start&&e.closed_at<end);
    const total=monthEarn.reduce((s,e)=>s+Number(e.commission_usd||0),0);
    months.push({label:d.toLocaleDateString("es-AR",{month:"short"}),val:total});
  }
  const maxAbsBar=Math.max(...months.map(m=>Math.abs(m.val)),100);

  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px",color:"#fff"}}>Dashboard</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:22}}>{isAdmin?"Comisiones GI consolidadas de todos los socios.":"Tu actividad y métricas como socio GI. Las comisiones se calculan al cerrar cada op."}</p>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
      <Kpi label="Comisión este mes" val={fmtUSD(earnThisMonth)} sub={isFinite(trend)&&earnLastMonth!==0?`${trend>0?"+":""}${trend.toFixed(0)}% vs mes ant.`:"—"} color={earnThisMonth>=0?"#22c55e":"#f87171"}/>
      <Kpi label="Pendiente de cobro" val={fmtUSD(earnPending)} sub={`${earnings.filter(e=>!e.paid_to_partner).length} ops sin liquidar`} color={earnPending>=0?GOLD_LIGHT:"#f87171"}/>
      <Kpi label="Acumulado pagado" val={fmtUSD(earnPaid)} sub={`${earnings.filter(e=>e.paid_to_partner).length} ops liquidadas`}/>
      <Kpi label="Promedio por op" val={fmtUSD(ticketAvg)} sub={`${earnings.length} ops`}/>
    </div>

    {estimadas.length>0&&<div style={{background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.25)",borderRadius:12,padding:"14px 18px",marginBottom:18}}>
      <p style={{fontSize:11,fontWeight:700,color:"#fb923c",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 6px"}}>⚠ {estimadas.length} {estimadas.length===1?"comisión estimada":"comisiones estimadas"}</p>
      <p style={{fontSize:12,color:"rgba(255,255,255,0.75)",margin:0,lineHeight:1.5}}>Hay ops con costos en pesos pendientes de dolarizar (típicamente tarjeta de crédito). El monto se confirma automáticamente cuando esos pagos se debiten. Hasta entonces el admin no puede liquidar esas comisiones.</p>
    </div>}

    <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18}}>
      <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 14px"}}>Comisión mensual (últimos 8 meses)</h3>
      <div style={{display:"flex",alignItems:"flex-end",gap:14,height:200,padding:"10px 0",position:"relative"}}>
        <div style={{position:"absolute",left:0,right:0,top:"50%",borderTop:"1px dashed rgba(255,255,255,0.08)",transform:"translateY(-0.5px)",pointerEvents:"none"}}/>
        {months.map((m,i)=>{const isPos=m.val>=0;const h=maxAbsBar>0?(Math.abs(m.val)/maxAbsBar)*45:0;return <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%",justifyContent:"center"}}>
          <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            {isPos?<>
              <div style={{flex:1,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
                <div style={{width:"100%",height:`${h}%`,minHeight:m.val>0?6:0,background:"linear-gradient(180deg,rgba(34,197,94,0.6),rgba(34,197,94,0.2))",borderRadius:"6px 6px 0 0",border:"1px solid rgba(34,197,94,0.3)",borderBottom:"none",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:6}}>
                  {m.val>0&&<span style={{fontSize:10,fontWeight:700,color:"#22c55e",fontFeatureSettings:'"tnum"'}}>{m.val>=1000?(m.val/1000).toFixed(1)+"k":m.val.toFixed(0)}</span>}
                </div>
              </div>
              <div style={{flex:1}}/>
            </>:<>
              <div style={{flex:1}}/>
              <div style={{flex:1,display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
                <div style={{width:"100%",height:`${h}%`,minHeight:6,background:"linear-gradient(0deg,rgba(248,113,113,0.6),rgba(248,113,113,0.2))",borderRadius:"0 0 6px 6px",border:"1px solid rgba(248,113,113,0.3)",borderTop:"none",display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:4}}>
                  <span style={{fontSize:10,fontWeight:700,color:"#f87171",fontFeatureSettings:'"tnum"'}}>{Math.abs(m.val)>=1000?(Math.abs(m.val)/1000).toFixed(1)+"k":Math.abs(m.val).toFixed(0)}</span>
                </div>
              </div>
            </>}
          </div>
        </div>;})}
      </div>
      <div style={{display:"flex",gap:14,marginTop:6}}>{months.map((m,i)=><span key={i} style={{flex:1,textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{m.label}</span>)}</div>
    </div>

    {topClients.length>0&&<div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18}}>
      <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 14px"}}>Top clientes por comisión generada</h3>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {topClients.map((c,i)=>{const maxC=topClients[0].com||1;const w=Math.abs(c.com)/Math.abs(maxC)*100;return <div key={i} style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:24,height:24,borderRadius:"50%",background:i===0?GOLD_GRADIENT:"rgba(255,255,255,0.06)",color:i===0?"#0A1628":"rgba(255,255,255,0.6)",fontWeight:800,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:600,color:"#fff"}}>{c.name}</span>
              <span style={{fontSize:13,fontWeight:700,color:c.com>=0?"#22c55e":"#f87171",fontFeatureSettings:'"tnum"'}}>{c.com>=0?"+":"−"}{fmtUSD(Math.abs(c.com))} <span style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:500}}>· {c.ops} {c.ops===1?"op":"ops"}</span></span>
            </div>
            <div style={{height:5,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${w}%`,background:c.com>=0?"linear-gradient(90deg,rgba(34,197,94,0.6),rgba(34,197,94,0.3))":"linear-gradient(90deg,rgba(248,113,113,0.6),rgba(248,113,113,0.3))",borderRadius:3}}/></div>
          </div>
        </div>;})}
      </div>
    </div>}

    {earnings.length>0&&<div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18}}>
      <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 14px"}}>Historial completo de comisiones ({earnings.length})</h3>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <th style={thStyle()}>Op</th>
          <th style={thStyle()}>Cliente</th>
          <th style={thStyle()}>Cerrada</th>
          <th style={{...thStyle(),textAlign:"right"}}>Ingresos</th>
          <th style={{...thStyle(),textAlign:"right"}}>Costos</th>
          <th style={{...thStyle(),textAlign:"right"}}>Neto</th>
          <th style={thStyle()}>%</th>
          <th style={{...thStyle(),textAlign:"right"}}>Comisión</th>
          <th style={thStyle()}>Estado</th>
        </tr></thead>
        <tbody>
          {earnings.map(e=>{const cn=e.operations?.clients?`${e.operations.clients.first_name||""} ${e.operations.clients.last_name||""}`.trim():"—";const com=Number(e.commission_usd||0);return <tr key={e.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <td style={{padding:"11px 12px",fontFamily:"'JetBrains Mono',monospace",color:GOLD_LIGHT,fontWeight:600,whiteSpace:"nowrap"}}>{e.operations?.operation_code||"—"}{e.is_estimated&&<span style={{marginLeft:6,fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"rgba(251,146,60,0.15)",color:"#fb923c",letterSpacing:"0.05em"}}>EST</span>}</td>
            <td style={{padding:"11px 12px",color:"#fff",fontWeight:600,whiteSpace:"nowrap"}}>{cn}</td>
            <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.55)",fontFeatureSettings:'"tnum"',textAlign:"center",whiteSpace:"nowrap"}}>{fmtDateShort(e.closed_at)}</td>
            <td style={{padding:"11px 12px",textAlign:"right",color:"#22c55e",fontFeatureSettings:'"tnum"'}}>{fmtUSD(e.revenue_usd)}</td>
            <td style={{padding:"11px 12px",textAlign:"right",color:"#f87171",fontFeatureSettings:'"tnum"'}}>{fmtUSD(e.total_costs_usd)}</td>
            <td style={{padding:"11px 12px",textAlign:"right",color:Number(e.net_profit_usd||0)>=0?"#fff":"#f87171",fontWeight:600,fontFeatureSettings:'"tnum"'}}>{fmtUSD(e.net_profit_usd)}</td>
            <td style={{padding:"11px 12px",textAlign:"center",color:"rgba(255,255,255,0.7)"}}>{e.commission_pct}%</td>
            <td style={{padding:"11px 12px",textAlign:"right",color:com>=0?"#22c55e":"#f87171",fontWeight:700,fontFeatureSettings:'"tnum"'}}>{com>=0?"+":"−"}{fmtUSD(Math.abs(com))}</td>
            <td style={{padding:"11px 12px",textAlign:"center"}}>{e.paid_to_partner?<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,background:"rgba(34,197,94,0.10)",color:"#22c55e"}}>Pagada</span>:<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,background:"rgba(251,191,36,0.10)",color:"#fbbf24"}}>Pendiente</span>}</td>
          </tr>;})}
        </tbody>
      </table>
    </div>}

    {earnings.length===0&&<div style={{padding:"30px",textAlign:"center",background:"rgba(255,255,255,0.025)",border:"1px dashed rgba(255,255,255,0.12)",borderRadius:14,color:"rgba(255,255,255,0.4)",fontSize:13}}>
      Cuando se cierre tu primera op, las métricas aparecen acá.
    </div>}
  </div>;
}

// ────────────────────────────────────────────
// PANE: LIBRO DIARIO
// ────────────────────────────────────────────
// ────────────────────────────────────────────
// PANE: COMISIONES (read-only para el socio)
// ────────────────────────────────────────────
function PaneCommissions({token}){
  const [earnings,setEarnings]=useState([]);
  const [lo,setLo]=useState(true);
  useEffect(()=>{(async()=>{
    setLo(true);
    const r=await dq("gi_partner_earnings",{token,filters:"?select=*,operations(operation_code,description,clients(first_name,last_name,client_code))&order=closed_at.desc"});
    setEarnings(Array.isArray(r)?r:[]);
    setLo(false);
  })();},[token]);

  const pending=earnings.filter(e=>!e.paid_to_partner);
  const paid=earnings.filter(e=>e.paid_to_partner);
  const totalPending=pending.reduce((s,e)=>s+Number(e.commission_usd||0),0);
  const totalPaid=paid.reduce((s,e)=>s+Number(e.paid_amount_usd||e.commission_usd||0),0);
  const positivos=pending.filter(e=>Number(e.commission_usd||0)>0).reduce((s,e)=>s+Number(e.commission_usd),0);
  const perdidas=pending.filter(e=>Number(e.commission_usd||0)<0).reduce((s,e)=>s+Number(e.commission_usd),0);

  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px",color:"#fff"}}>Comisiones</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:24}}>Tus comisiones por op cerrada. Si una op resulta a pérdida, asumís tu parte (% sobre la pérdida) y se descuenta del saldo total.</p>

    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
      <Kpi label="Saldo a cobrar (neto)" val={fmtUSD(totalPending)} color={totalPending>=0?"#22c55e":"#f87171"} sub={`${pending.length} ${pending.length===1?"op pendiente":"ops pendientes"}`}/>
      <Kpi label="Ganancias acumuladas" val={fmtUSD(positivos)} color="#22c55e" sub={`${pending.filter(e=>Number(e.commission_usd||0)>0).length} ops con ganancia`}/>
      <Kpi label="Pérdidas absorbidas" val={fmtUSD(Math.abs(perdidas))} color={perdidas<0?"#f87171":"rgba(255,255,255,0.4)"} sub={`${pending.filter(e=>Number(e.commission_usd||0)<0).length} ops con pérdida`}/>
    </div>

    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:<>
      {pending.some(e=>e.is_estimated)&&<div style={{background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.25)",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#fb923c"}}>⚠ Las ops marcadas <strong style={{padding:"1px 5px",borderRadius:3,background:"rgba(251,146,60,0.2)",fontSize:10,letterSpacing:"0.05em"}}>EST</strong> tienen costos en pesos pendientes de dolarizar. La comisión es estimada y se confirma automáticamente cuando se debiten los pagos pendientes. Hasta entonces, el admin no podrá liquidártela.</div>}
      {pending.length>0&&<>
        <h3 style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,textTransform:"uppercase",letterSpacing:"0.1em",margin:"6px 0 12px"}}>Pendientes de pago ({pending.length})</h3>
        <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,overflow:"hidden",marginBottom:24}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
            <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.22)"}}>
              <th style={thStyle()}>Op</th>
              <th style={thStyle()}>Cliente</th>
              <th style={thStyle()}>Cerrada</th>
              <th style={{...thStyle(),textAlign:"right"}}>Ingresos</th>
              <th style={{...thStyle(),textAlign:"right"}}>Costos</th>
              <th style={{...thStyle(),textAlign:"right"}}>Neto</th>
              <th style={thStyle()}>%</th>
              <th style={{...thStyle(),textAlign:"right"}}>Comisión</th>
            </tr></thead>
            <tbody>
              {pending.map(e=>{const cn=e.operations?.clients?`${e.operations.clients.first_name||""} ${e.operations.clients.last_name||""}`.trim():"—";const com=Number(e.commission_usd||0);return <tr key={e.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                <td style={{padding:"11px 14px",fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:GOLD_LIGHT,whiteSpace:"nowrap"}}>{e.operations?.operation_code||"—"}{e.is_estimated&&<span title={`Estimada con FX ${e.estimated_fx_rate||"?"}. Se confirma cuando dolarices los pagos pendientes.`} style={{marginLeft:6,fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"rgba(251,146,60,0.15)",color:"#fb923c",letterSpacing:"0.05em",fontFamily:"inherit",cursor:"help"}}>EST</span>}</td>
                <td style={{padding:"11px 14px",color:"#fff",fontWeight:600,whiteSpace:"nowrap"}}>{cn}</td>
                <td style={{padding:"11px 14px",color:"rgba(255,255,255,0.55)",whiteSpace:"nowrap",fontFeatureSettings:'"tnum"',textAlign:"center"}}>{fmtDateShort(e.closed_at)}</td>
                <td style={{padding:"11px 14px",textAlign:"right",color:"#22c55e",fontFeatureSettings:'"tnum"'}}>{fmtUSD(e.revenue_usd)}</td>
                <td style={{padding:"11px 14px",textAlign:"right",color:"#f87171",fontFeatureSettings:'"tnum"'}}>{fmtUSD(e.total_costs_usd)}</td>
                <td style={{padding:"11px 14px",textAlign:"right",color:Number(e.net_profit_usd||0)>=0?"#fff":"#f87171",fontWeight:600,fontFeatureSettings:'"tnum"'}}>{fmtUSD(e.net_profit_usd)}</td>
                <td style={{padding:"11px 14px",textAlign:"center",color:"rgba(255,255,255,0.7)"}}>{e.commission_pct}%</td>
                <td style={{padding:"11px 14px",textAlign:"right",fontWeight:700,color:com>=0?"#22c55e":"#f87171",fontFeatureSettings:'"tnum"'}}>{com>=0?"+":"−"}{fmtUSD(Math.abs(com))}</td>
              </tr>;})}
              <tr style={{borderTop:"1.5px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.02)"}}>
                <td colSpan={7} style={{padding:"12px 14px",fontWeight:700,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.06em",fontSize:11}}>Saldo neto a cobrar</td>
                <td style={{padding:"12px 14px",textAlign:"right",fontWeight:800,color:totalPending>=0?"#22c55e":"#f87171",fontFeatureSettings:'"tnum"'}}>{totalPending>=0?"+":"−"}{fmtUSD(Math.abs(totalPending))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>}

      {paid.length>0&&<>
        <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.1em",margin:"6px 0 12px"}}>Ya pagadas ({paid.length})</h3>
        <div style={{background:"rgba(255,255,255,0.018)",border:"1px solid rgba(255,255,255,0.04)",borderRadius:14,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,opacity:0.7}}>
            <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.18)"}}>
              <th style={thStyle()}>Op</th>
              <th style={thStyle()}>Cliente</th>
              <th style={thStyle()}>Pagada</th>
              <th style={{...thStyle(),textAlign:"right"}}>Monto</th>
            </tr></thead>
            <tbody>
              {paid.map(e=>{const cn=e.operations?.clients?`${e.operations.clients.first_name||""} ${e.operations.clients.last_name||""}`.trim():"—";return <tr key={e.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                <td style={{padding:"11px 14px",fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:GOLD_LIGHT,whiteSpace:"nowrap"}}>{e.operations?.operation_code||"—"}</td>
                <td style={{padding:"11px 14px",color:"#fff",fontWeight:600,whiteSpace:"nowrap"}}>{cn}</td>
                <td style={{padding:"11px 14px",color:"rgba(255,255,255,0.55)",whiteSpace:"nowrap",fontFeatureSettings:'"tnum"',textAlign:"center"}}>{fmtDateShort(e.paid_at)}</td>
                <td style={{padding:"11px 14px",textAlign:"right",fontWeight:700,color:Number(e.paid_amount_usd||e.commission_usd)>=0?"#22c55e":"#f87171",fontFeatureSettings:'"tnum"'}}>{fmtUSD(e.paid_amount_usd||e.commission_usd)}</td>
              </tr>;})}
              <tr style={{borderTop:"1.5px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.02)"}}>
                <td colSpan={3} style={{padding:"12px 14px",fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.06em",fontSize:11}}>Total cobrado</td>
                <td style={{padding:"12px 14px",textAlign:"right",fontWeight:800,color:"#22c55e",fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalPaid)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>}

      {pending.length===0&&paid.length===0&&<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"3rem 0"}}>Cuando se cierre tu primera op aparece tu comisión acá.</p>}
    </>}
  </div>;
}

function PaneLedger({token,profileId,isAdmin}){
  // Extracto del socio: solo movimientos de comisiones (devengado + cobrado).
  // Cada earning genera 1 entry "Comisión devengada" en closed_at, y opcionalmente
  // una entry "Comisión cobrada" en paid_at si paid_to_partner=true.
  const [earnings,setEarnings]=useState([]);
  const [lo,setLo]=useState(true);
  const [fFrom,setFFrom]=useState("");
  const [fTo,setFTo]=useState("");
  const [fSearch,setFSearch]=useState("");
  const [fType,setFType]=useState("");

  useEffect(()=>{(async()=>{
    setLo(true);
    const filt=isAdmin||!profileId?"":`partner_id=eq.${profileId}&`;
    const r=await dq("gi_partner_earnings",{token,filters:`?${filt}select=*,operations(operation_code,clients(first_name,last_name))&order=closed_at.desc`});
    setEarnings(Array.isArray(r)?r:[]);
    setLo(false);
  })();},[token,profileId,isAdmin]);

  // Construir movimientos a partir de earnings
  const movements=[];
  for(const e of earnings){
    const cn=e.operations?.clients?`${e.operations.clients.first_name||""} ${e.operations.clients.last_name||""}`.trim():"—";
    const opCode=e.operations?.operation_code||"—";
    const com=Number(e.commission_usd||0);
    if(e.closed_at){
      movements.push({
        id:`d-${e.id}`,
        date:e.closed_at.slice(0,10),
        op:opCode,
        client:cn,
        type:com>=0?"devengado":"perdida_absorbida",
        description:com>=0?`Comisión devengada · ${e.is_estimated?"ESTIMADA · ":""}${e.commission_pct||0}% sobre USD ${Number(e.net_profit_usd||0).toFixed(2)}`:`Absorción de pérdida · ${Math.abs(e.commission_pct||0)}% sobre USD ${Number(e.net_profit_usd||0).toFixed(2)}`,
        amount:com,
        is_estimated:e.is_estimated,
      });
    }
    if(e.paid_to_partner&&e.paid_at){
      const paidAmt=Number(e.paid_amount_usd||e.commission_usd||0);
      movements.push({
        id:`p-${e.id}`,
        date:e.paid_at.slice(0,10),
        op:opCode,
        client:cn,
        type:"cobrado",
        description:`Comisión cobrada del admin`,
        amount:-paidAmt, // egreso del "saldo a cobrar" del socio
        is_estimated:false,
      });
    }
  }
  // Ordenar por fecha desc
  movements.sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const filtered=movements.filter(m=>{
    if(fFrom&&m.date<fFrom)return false;
    if(fTo&&m.date>fTo)return false;
    if(fType&&m.type!==fType)return false;
    if(fSearch){
      const s=fSearch.toLowerCase();
      if(!String(m.description||"").toLowerCase().includes(s)&&!String(m.op||"").toLowerCase().includes(s)&&!String(m.client||"").toLowerCase().includes(s))return false;
    }
    return true;
  });

  const totalDevengado=movements.filter(m=>m.type==="devengado").reduce((s,m)=>s+m.amount,0);
  const totalAbsorbido=movements.filter(m=>m.type==="perdida_absorbida").reduce((s,m)=>s+m.amount,0); // negativo
  const totalCobrado=movements.filter(m=>m.type==="cobrado").reduce((s,m)=>s+Math.abs(m.amount),0);
  const saldoActual=totalDevengado+totalAbsorbido-totalCobrado;

  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>Libro diario</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:22}}>{isAdmin?"Extracto consolidado de comisiones de todos los socios.":"Tus comisiones devengadas, cobradas y saldo pendiente. Cada op cerrada genera un movimiento."}</p>

    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>
      <Kpi label="Comisiones devengadas" val={fmtUSD(totalDevengado)} color="#22c55e" sub={`${movements.filter(m=>m.type==="devengado").length} ops`}/>
      <Kpi label="Pérdidas absorbidas" val={fmtUSD(Math.abs(totalAbsorbido))} color={totalAbsorbido<0?"#f87171":"rgba(255,255,255,0.4)"} sub={`${movements.filter(m=>m.type==="perdida_absorbida").length} ops`}/>
      <Kpi label="Cobrado del admin" val={fmtUSD(totalCobrado)} color="#60a5fa" sub={`${movements.filter(m=>m.type==="cobrado").length} liquidaciones`}/>
      <Kpi label="Saldo a cobrar" val={fmtUSD(saldoActual)} color={saldoActual>=0?GOLD_LIGHT:"#f87171"}/>
    </div>

    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
      <input value={fSearch} onChange={e=>setFSearch(e.target.value)} placeholder="Buscar por op, cliente o concepto..." style={{...inpStyle(),background:"rgba(255,255,255,0.04)",minWidth:240,flex:1,padding:"9px 12px",fontSize:12}}/>
      <input type="date" value={fFrom} onChange={e=>setFFrom(e.target.value)} style={{...inpStyle(),background:"rgba(255,255,255,0.04)",padding:"9px 12px",fontSize:12,minWidth:140,width:"auto"}}/>
      <span style={{color:"rgba(255,255,255,0.4)",fontSize:12}}>→</span>
      <input type="date" value={fTo} onChange={e=>setFTo(e.target.value)} style={{...inpStyle(),background:"rgba(255,255,255,0.04)",padding:"9px 12px",fontSize:12,minWidth:140,width:"auto"}}/>
      <select value={fType} onChange={e=>setFType(e.target.value)} style={{...inpStyle(),background:"rgba(255,255,255,0.04)",padding:"9px 12px",fontSize:12,width:"auto",minWidth:160}}>
        <option value="">Todos los tipos</option>
        <option value="devengado">Devengadas</option>
        <option value="perdida_absorbida">Pérdidas absorbidas</option>
        <option value="cobrado">Cobradas</option>
      </select>
      <button onClick={()=>{setFFrom("");setFTo("");setFSearch("");setFType("");}} style={{padding:"7px 12px",fontSize:11,fontWeight:600,borderRadius:7,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontFamily:"inherit"}}>Limpiar</button>
    </div>

    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:filtered.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"3rem 0"}}>{movements.length===0?"Cuando se cierre tu primera op cotizada, aparece tu primera comisión acá.":"No hay movimientos con este filtro."}</p>:
      <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.22)"}}>
            <th style={{...thStyle(),textAlign:"left"}}>Fecha</th>
            <th style={{...thStyle(),textAlign:"left"}}>Op</th>
            <th style={{...thStyle(),textAlign:"left"}}>Cliente</th>
            <th style={{...thStyle(),textAlign:"left"}}>Concepto</th>
            <th style={{...thStyle(),textAlign:"right"}}>Monto</th>
          </tr></thead>
          <tbody>
            {filtered.map(m=>{const amt=Number(m.amount||0);const isCobro=m.type==="cobrado";return <tr key={m.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.55)",fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap"}}>{fmtDate(m.date)}</td>
              <td style={{padding:"11px 12px",fontFamily:"'JetBrains Mono',monospace",color:GOLD_LIGHT,fontWeight:600,whiteSpace:"nowrap"}}>{m.op}{m.is_estimated&&<span style={{marginLeft:6,fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"rgba(251,146,60,0.15)",color:"#fb923c",letterSpacing:"0.05em"}}>EST</span>}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.85)",fontWeight:600}}>{m.client}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.7)"}}>{m.description}</td>
              <td style={{padding:"11px 12px",textAlign:"right",fontWeight:700,fontFeatureSettings:'"tnum"',color:isCobro?"#60a5fa":(amt>=0?"#22c55e":"#f87171"),whiteSpace:"nowrap"}}>{amt>=0?"+":"−"}{fmtUSD(Math.abs(amt))}</td>
            </tr>;})}
          </tbody>
        </table>
      </div>
    }
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
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:22}}>Tarifas de envío, tipo de cambio estimado, datos de oficina y términos &amp; condiciones.</p>
    <SettingsRates token={token}/>
    <SettingsFx token={token}/>
    <SettingsOffice token={token}/>
    <SettingsTerms token={token}/>
  </div>;
}

function SettingsFx({token}){
  const [data,setData]=useState(null);
  const [val,setVal]=useState("");
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3000);};
  useEffect(()=>{(async()=>{
    try{
      const r=await dq("gi_settings",{token,filters:"?select=*&limit=1"});
      if(Array.isArray(r)&&r[0]){setData(r[0]);setVal(r[0].default_fx_rate?String(r[0].default_fx_rate):"");}
    }catch(e){console.error("SettingsFx load",e);}
  })();},[token]);
  const save=async()=>{
    setSaving(true);
    try{
      let row=data;
      if(!row?.id){
        const r=await dq("gi_settings",{token,filters:"?select=*&limit=1"});
        if(Array.isArray(r)&&r[0])row=r[0];
      }
      if(!row?.id){flash("No hay registro de gi_settings");setSaving(false);return;}
      await dq("gi_settings",{method:"PATCH",token,filters:`?id=eq.${row.id}`,body:{default_fx_rate:val?Number(val):null,updated_at:new Date().toISOString()}});
      setData({...row,default_fx_rate:val?Number(val):null});
      flash("Guardado");
    }catch(e){console.error(e);flash("Error al guardar");}
    setSaving(false);
  };
  return <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18,position:"relative"}}>
    {msg&&<div style={{position:"absolute",top:14,right:14,background:"rgba(34,197,94,0.18)",border:"1px solid rgba(34,197,94,0.4)",color:"#22c55e",padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600}}>{msg}</div>}
    <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Tipo de cambio estimado (ARS → USD)</h3>
    <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5}}>Se usa para estimar costos en pesos pendientes de dolarizar (ej. tarjeta de crédito) cuando se cierra una operación. Cuando dolarices el pago real, la comisión se recalcula automáticamente. Si lo dejás vacío, se toma el último FX cargado en la base.</p>
    <div style={{display:"flex",alignItems:"end",gap:12}}>
      <div style={{flex:1,maxWidth:240}}>
        <Field2 label="ARS por 1 USD" v={val} on={setVal}/>
      </div>
      <button onClick={save} disabled={saving} style={{padding:"8px 18px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",background:saving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Guardando…":"Guardar"}</button>
    </div>
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
