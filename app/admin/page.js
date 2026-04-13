"use client";
import { useState, useEffect } from "react";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const LOGO=`${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
const B={primary:"#1B4F8A",accent:"#4A90D9"};
const DARK_BG="linear-gradient(160deg,#030810 0%,#071428 40%,#091b34 70%,#040e1c 100%)";
const IC="#60a5fa";
const sf=async(p,o={})=>{const r=await fetch(`${SB_URL}${p}`,{...o,headers:{apikey:SB_KEY,"Content-Type":"application/json",...(o.headers||{})}});const txt=await r.text();try{return JSON.parse(txt);}catch{return null;}};
const ac=async(e,b)=>sf(`/auth/v1/${e}`,{method:"POST",body:JSON.stringify(b)});
const dq=async(t,{method="GET",body,token,filters="",headers:h={}})=>sf(`/rest/v1/${t}${filters}`,{method,body:body?JSON.stringify(body):undefined,headers:{Authorization:`Bearer ${token}`,...(method==="POST"?{Prefer:"return=representation"}:method==="DELETE"?{Prefer:"return=minimal"}:method==="PATCH"?{Prefer:"return=representation"}:{}),...h}});
const saveSession=(d)=>{try{localStorage.setItem("ac_admin",JSON.stringify(d));}catch(e){}};
const loadSession=()=>{try{const d=localStorage.getItem("ac_admin");return d?JSON.parse(d):null;}catch(e){return null;}};
const clearSession=()=>{try{localStorage.removeItem("ac_admin");}catch(e){}};
const SM={pendiente:{l:"PENDIENTE",c:"#94a3b8"},en_deposito_origen:{l:"EN DEPÓSITO ORIGEN",c:"#fbbf24"},en_preparacion:{l:"DOCUMENTACIÓN",c:"#a78bfa"},en_transito:{l:"EN TRÁNSITO",c:"#60a5fa"},en_aduana:{l:"GESTIÓN ADUANERA",c:"#fb923c"},lista_retiro:{l:"LIBERADO",c:"#34d399"},entregada:{l:"ENTREGADO",c:"#22c55e"},cancelada:{l:"CANCELADA",c:"#f87171"}};
const CM={aereo_blanco:"Aéreo A",aereo_negro:"Aéreo B",maritimo_blanco:"Marítimo A",maritimo_negro:"Marítimo B"};
const STATUSES=Object.keys(SM);
const CHANNELS=Object.keys(CM);
const SERVICES=[{key:"aereo_a_china",label:"Aéreo A — China",unit:"kg",info:"7-10 días hábiles"},{key:"aereo_b_usa",label:"Aéreo B — USA",unit:"kg",info:"48-72 hs hábiles"},{key:"aereo_b_china",label:"Aéreo B — China",unit:"kg",info:"10-15 días hábiles"},{key:"maritimo_a_china",label:"Marítimo A — China",unit:"cbm",info:""},{key:"maritimo_b",label:"Marítimo B — China/USA",unit:"cbm",info:""}];
const formatDate=(d)=>{if(!d)return"—";return new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});};
const formatDateInput=(d)=>{if(!d)return"";return new Date(d).toISOString().split("T")[0];};

function Inp({label,type="text",value,onChange,placeholder,small,step}){return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.45)",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label><input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} step={step} style={{width:"100%",padding:small?"8px 10px":"10px 12px",fontSize:13,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}} onFocus={e=>{e.target.style.borderColor=IC;}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.1)";}}/></div>;}

function Sel({label,value,onChange,options,ph}){return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.45)",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label><select value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"10px 12px",fontSize:13,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:value?"#fff":"rgba(255,255,255,0.35)",outline:"none"}}>{ph&&<option value="" style={{background:"#0a1428"}}>{ph}</option>}{options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value} style={{background:"#0a1428",color:"#fff"}}>{typeof o==="string"?o:o.label}</option>)}</select></div>;}

function Btn({children,onClick,disabled,variant="primary",small}){const styles={primary:{background:`linear-gradient(135deg,${B.accent},${B.primary})`,color:"#fff",border:"none"},secondary:{background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.6)",border:"1.5px solid rgba(255,255,255,0.12)"},danger:{background:"rgba(255,80,80,0.12)",color:"#ff6b6b",border:"1px solid rgba(255,80,80,0.25)"}};const s=styles[variant]||styles.primary;return <button onClick={onClick} disabled={disabled} style={{padding:small?"6px 12px":"10px 18px",fontSize:small?11:13,fontWeight:600,borderRadius:8,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,...s}}>{children}</button>;}

function Card({children,title,actions}){return <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.25rem 1.5rem",marginBottom:16}}>{(title||actions)&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>{title&&<h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>{title}</h3>}{actions&&<div style={{display:"flex",gap:8}}>{actions}</div>}</div>}{children}</div>;}

function AdminLogin({onLogin}){
  const [email,setEmail]=useState("");const [pw,setPw]=useState("");const [err,setErr]=useState("");const [lo,setLo]=useState(false);
  const doLogin=async()=>{setLo(true);setErr("");try{const r=await ac("token?grant_type=password",{email,password:pw});if(r.error){setErr(r.error_description||"Credenciales inválidas");setLo(false);return;}const p=await dq("profiles",{token:r.access_token,filters:`?id=eq.${r.user.id}&select=*`});const prof=Array.isArray(p)?p[0]:null;if(!prof||prof.role!=="admin"){setErr("Acceso denegado. Solo administradores.");setLo(false);return;}const ss={token:r.access_token,user:r.user,profile:prof};saveSession(ss);onLogin(ss);}catch{setErr("Error de conexión.");}setLo(false);};
  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:DARK_BG,fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif"}}><div style={{maxWidth:400,width:"100%",padding:"0 1rem"}}><div style={{textAlign:"center",marginBottom:28}}><img src={LOGO} alt="AC" style={{width:200,height:"auto",filter:"drop-shadow(0 0 20px rgba(74,144,217,0.4))"}}/><p style={{fontSize:13,color:"rgba(255,255,255,0.35)",margin:"10px 0 0"}}>Panel de Administración</p></div><div style={{background:"rgba(8,18,35,0.85)",backdropFilter:"blur(24px)",borderRadius:20,padding:"2rem 1.75rem",border:"1px solid rgba(255,255,255,0.06)"}}><Inp label="Email" type="email" value={email} onChange={setEmail} placeholder="admin@argencargo.com"/><Inp label="Contraseña" type="password" value={pw} onChange={setPw} placeholder="••••••••"/>{err&&<p style={{fontSize:12,color:"#ff6b6b",margin:"0 0 12px",padding:"8px 12px",background:"rgba(255,80,80,0.1)",borderRadius:8}}>{err}</p>}<Btn onClick={doLogin} disabled={lo}>{lo?"Ingresando...":"Ingresar →"}</Btn></div></div></div>;
}

function OperationsList({token,onSelect,onNew}){
  const [ops,setOps]=useState([]);const [lo,setLo]=useState(true);const [search,setSearch]=useState("");const [fStatuses,setFStatuses]=useState([]);const [fChannel,setFChannel]=useState("");const [sortCol,setSortCol]=useState("created_at");const [sortDir,setSortDir]=useState("desc");const [showStatusDrop,setShowStatusDrop]=useState(false);
  useEffect(()=>{(async()=>{const o=await dq("operations",{token,filters:"?select=*,clients(first_name,last_name,client_code)&order=created_at.desc"});setOps(Array.isArray(o)?o:[]);setLo(false);})();},[token]);
  const toggleStatus=(s)=>setFStatuses(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s]);
  const getOrigin=(op)=>op.origin||"China";
  const filtered=ops.filter(o=>{if(fStatuses.length>0&&!fStatuses.includes(o.status))return false;if(fChannel&&o.channel!==fChannel)return false;if(search){const s=search.toLowerCase();const cn=o.clients?`${o.clients.first_name} ${o.clients.last_name}`.toLowerCase():"";return o.operation_code.toLowerCase().includes(s)||cn.includes(s)||o.description?.toLowerCase().includes(s);}return true;});
  const sorted=[...filtered].sort((a,b)=>{let va=a[sortCol],vb=b[sortCol];if(sortCol==="client"){va=a.clients?`${a.clients.first_name} ${a.clients.last_name}`:"";vb=b.clients?`${b.clients.first_name} ${b.clients.last_name}`:"";}if(sortCol==="origin"){va=getOrigin(a);vb=getOrigin(b);}if(va==null)va="";if(vb==null)vb="";if(typeof va==="string")va=va.toLowerCase();if(typeof vb==="string")vb=vb.toLowerCase();if(va<vb)return sortDir==="asc"?-1:1;if(va>vb)return sortDir==="asc"?1:-1;return 0;});
  const toggleSort=(col)=>{if(sortCol===col){setSortDir(d=>d==="asc"?"desc":"asc");}else{setSortCol(col);setSortDir("asc");}};
  const SH=({label,col})=><th onClick={()=>toggleSort(col)} style={{padding:"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:sortCol===col?IC:"rgba(255,255,255,0.3)",textTransform:"uppercase",cursor:"pointer",userSelect:"none"}}>{label} {sortCol===col?(sortDir==="asc"?"▲":"▼"):""}</th>;
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:0}}>Operaciones</h2><Btn onClick={onNew}>+ Nueva operación</Btn></div>
    <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{flex:1,minWidth:200}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por código, cliente o descripción..." style={{width:"100%",padding:"10px 14px",fontSize:13,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/></div>
      <div style={{position:"relative"}}><button onClick={()=>setShowStatusDrop(p=>!p)} style={{padding:"10px 14px",fontSize:12,border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",cursor:"pointer"}}>{fStatuses.length>0?`${fStatuses.length} estados`:"Todos los estados"} ▼</button>
        {showStatusDrop&&<div style={{position:"absolute",top:"100%",left:0,marginTop:4,background:"#0a1428",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:8,zIndex:10,minWidth:200}}>{STATUSES.map(s=><label key={s} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",cursor:"pointer",borderRadius:4}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}><input type="checkbox" checked={fStatuses.includes(s)} onChange={()=>toggleStatus(s)}/><span style={{fontSize:12,color:SM[s].c,fontWeight:600}}>{SM[s].l}</span></label>)}<div style={{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:4}}><button onClick={()=>{setFStatuses([]);setShowStatusDrop(false);}} style={{fontSize:11,color:IC,background:"none",border:"none",cursor:"pointer",padding:"4px 8px"}}>Limpiar filtros</button></div></div>}
      </div>
      <select value={fChannel} onChange={e=>setFChannel(e.target.value)} style={{padding:"10px 14px",fontSize:12,border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}><option value="" style={{background:"#0a1428"}}>Todos los canales</option>{CHANNELS.map(c=><option key={c} value={c} style={{background:"#0a1428"}}>{CM[c]}</option>)}</select>
    </div>
    {lo?<p style={{color:"rgba(255,255,255,0.3)",textAlign:"center",padding:"2rem 0"}}>Cargando...</p>:
    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <SH label="Código" col="operation_code"/><SH label="Cliente" col="client"/><SH label="Descripción" col="description"/><SH label="Origen" col="origin"/><SH label="Canal" col="channel"/><SH label="Estado" col="status"/><SH label="ETA" col="eta"/><th style={{padding:"12px 14px"}}></th>
        </tr></thead>
        <tbody>{sorted.map(op=>{const st=SM[op.status]||{l:op.status,c:"#999"};const cn=op.clients?`${op.clients.first_name} ${op.clients.last_name}`:"—";return <tr key={op.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"}} onClick={()=>onSelect(op)} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
          <td style={{padding:"12px 14px",fontFamily:"monospace",fontWeight:600,color:"#fff"}}>{op.operation_code}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.7)"}}>{cn}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{op.description||"—"}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)"}}>{getOrigin(op)}</td>
          <td style={{padding:"12px 14px"}}><span style={{fontSize:11,padding:"3px 8px",borderRadius:4,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.6)"}}>{CM[op.channel]||op.channel}</span></td>
          <td style={{padding:"12px 14px"}}><span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:st.c,background:`${st.c}15`,border:`1px solid ${st.c}33`}}>● {st.l}</span></td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.4)"}}>{formatDate(op.eta)}</td>
          <td style={{padding:"12px 14px"}}><span style={{color:IC,fontSize:12,fontWeight:600}}>Editar →</span></td>
        </tr>})}</tbody>
      </table>
      {sorted.length===0&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.25)",padding:"2rem 0"}}>No se encontraron operaciones</p>}
    </div>}
  </div>;
}

function NewOperation({token,clients,onBack,onCreated}){
  const [form,setForm]=useState({client_id:"",channel:"aereo_blanco",origin:"China"});const [lo,setLo]=useState(false);const [err,setErr]=useState("");
  const ch=f=>v=>setForm(p=>({...p,[f]:v}));
  const create=async()=>{if(!form.client_id){setErr("Seleccioná un cliente");return;}setLo(true);setErr("");
    const existing=await dq("operations",{token,filters:"?select=operation_code&order=operation_code.desc&limit=1"});const last=Array.isArray(existing)&&existing[0]?parseInt(existing[0].operation_code.replace("AC-",""))||0:0;const code=`AC-${String(last+1).padStart(4,"0")}`;
    const r=await dq("operations",{method:"POST",token,body:{operation_code:code,client_id:form.client_id,channel:form.channel,origin:form.origin,status:"pendiente",created_by:null}});
    if(r?.error||r?.message){setErr(r.error||r.message);setLo(false);return;}setLo(false);onCreated(Array.isArray(r)?r[0]:r);};
  return <div>
    <button onClick={onBack} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,marginBottom:20,padding:0}}>← VOLVER</button>
    <h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 20px"}}>Nueva Operación</h2>
    <Card>
      <Sel label="Cliente" value={form.client_id} onChange={ch("client_id")} options={clients.map(c=>({value:c.id,label:`${c.client_code} — ${c.first_name} ${c.last_name}`}))} ph="Seleccionar cliente"/>
      <Sel label="Canal" value={form.channel} onChange={ch("channel")} options={CHANNELS.map(c=>({value:c,label:CM[c]}))}/>
      <Sel label="Origen" value={form.origin} onChange={ch("origin")} options={[{value:"China",label:"China"},{value:"USA",label:"USA"}]}/>
      {err&&<p style={{fontSize:12,color:"#ff6b6b",margin:"0 0 12px"}}>{err}</p>}
      <div style={{display:"flex",gap:12,marginTop:8}}><Btn onClick={create} disabled={lo}>{lo?"Creando...":"Crear operación"}</Btn><Btn variant="secondary" onClick={onBack}>Cancelar</Btn></div>
    </Card>
  </div>;
}

function OperationEditor({op:initOp,token,onBack,onDelete}){
  const [op,setOp]=useState(initOp);const [items,setItems]=useState([]);const [pkgs,setPkgs]=useState([]);const [events,setEvents]=useState([]);const [tariffs,setTariffs]=useState([]);const [lo,setLo]=useState(true);const [saving,setSaving]=useState(false);const [msg,setMsg]=useState("");const [tab,setTab]=useState("general");
  const load=async()=>{setLo(true);const [it,pk,ev,tf]=await Promise.all([dq("operation_items",{token,filters:`?operation_id=eq.${op.id}&select=*&order=created_at.asc`}),dq("operation_packages",{token,filters:`?operation_id=eq.${op.id}&select=*&order=package_number.asc`}),dq("tracking_events",{token,filters:`?operation_id=eq.${op.id}&select=*&order=occurred_at.desc`}),dq("tariffs",{token,filters:"?select=*&type=eq.rate&order=sort_order.asc"})]);setItems(Array.isArray(it)?it:[]);setPkgs(Array.isArray(pk)?pk:[]);setEvents(Array.isArray(ev)?ev:[]);setTariffs(Array.isArray(tf)?tf:[]);setLo(false);};
  useEffect(()=>{load();},[op.id]);
  const flash=(m)=>{setMsg(m);setTimeout(()=>setMsg(""),2500);};
  const deleteOp=async()=>{if(!confirm(`¿Eliminar operación ${op.operation_code}? Se borrarán también sus productos, bultos y eventos.`))return;
    await Promise.all([dq("operation_items",{method:"DELETE",token,filters:`?operation_id=eq.${op.id}`}),dq("operation_packages",{method:"DELETE",token,filters:`?operation_id=eq.${op.id}`}),dq("tracking_events",{method:"DELETE",token,filters:`?operation_id=eq.${op.id}`})]);
    await dq("operations",{method:"DELETE",token,filters:`?id=eq.${op.id}`});onDelete();};
  const isBlanco=op.channel?.includes("blanco");const isAereo=op.channel?.includes("aereo");const isMaritimo=op.channel?.includes("maritimo");

  const saveOp=async()=>{setSaving(true);const{id,clients,...rest}=op;delete rest.created_at;delete rest.updated_at;await dq("operations",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});flash("Operación guardada");setSaving(false);};

  const saveItem=async(it)=>{const{id,...rest}=it;delete rest.created_at;await dq("operation_items",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});flash("Producto guardado");};
  const addItem=async()=>{const r=await dq("operation_items",{method:"POST",token,body:{operation_id:op.id,description:"Nuevo producto",quantity:1,unit_price_usd:0}});if(Array.isArray(r))setItems(p=>[...p,...r]);else if(r.id)setItems(p=>[...p,r]);flash("Producto agregado");};
  const delItem=async(id)=>{await dq("operation_items",{method:"DELETE",token,filters:`?id=eq.${id}`});setItems(p=>p.filter(x=>x.id!==id));flash("Producto eliminado");};

  const savePkg=async(pk)=>{const{id,...rest}=pk;delete rest.created_at;await dq("operation_packages",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});flash("Bulto guardado");};
  const addPkg=async()=>{const num=pkgs.length+1;const r=await dq("operation_packages",{method:"POST",token,body:{operation_id:op.id,package_number:num,quantity:1}});if(Array.isArray(r))setPkgs(p=>[...p,...r]);else if(r.id)setPkgs(p=>[...p,r]);flash("Bulto agregado");};
  const delPkg=async(id)=>{await dq("operation_packages",{method:"DELETE",token,filters:`?id=eq.${id}`});setPkgs(p=>p.filter(x=>x.id!==id));flash("Bulto eliminado");};

  const saveEvt=async(ev)=>{const{id,...rest}=ev;delete rest.created_at;await dq("tracking_events",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});flash("Evento guardado");};
  const addEvt=async()=>{const r=await dq("tracking_events",{method:"POST",token,body:{operation_id:op.id,title:"Nuevo evento",occurred_at:new Date().toISOString(),is_visible_to_client:true,created_by:null}});if(Array.isArray(r))setEvents(p=>[...r,...p]);else if(r.id)setEvents(p=>[r,...p]);flash("Evento agregado");};
  const delEvt=async(id)=>{await dq("tracking_events",{method:"DELETE",token,filters:`?id=eq.${id}`});setEvents(p=>p.filter(x=>x.id!==id));flash("Evento eliminado");};

  const tabs=[{k:"general",l:"General"},{k:"budget",l:"Presupuesto"},{k:"items",l:"Productos"},{k:"packages",l:"Bultos"},{k:"tracking",l:"Seguimiento"}];
  const chOp=f=>v=>setOp(p=>({...p,[f]:v}));
  const chItem=(idx,f,v)=>{setItems(p=>{const n=[...p];n[idx]={...n[idx],[f]:v};return n;});};
  const chPkg=(idx,f,v)=>{setPkgs(p=>{const n=[...p];n[idx]={...n[idx],[f]:v};return n;});};
  const chEvt=(idx,f,v)=>{setEvents(p=>{const n=[...p];n[idx]={...n[idx],[f]:v};return n;});};

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onBack} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>← VOLVER</button>
        <span style={{fontSize:16,fontWeight:700,color:"#fff",fontFamily:"monospace",padding:"4px 10px",background:"rgba(255,255,255,0.08)",borderRadius:6}}>{op.operation_code}</span>
        {msg&&<span style={{fontSize:12,color:"#22c55e",fontWeight:600}}>{msg}</span>}
      </div>
      <Btn onClick={deleteOp} variant="danger" small>Eliminar operación</Btn>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:16}}>{tabs.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:tab===t.k?`1.5px solid ${IC}`:"1.5px solid rgba(255,255,255,0.08)",background:tab===t.k?"rgba(96,165,250,0.12)":"rgba(255,255,255,0.03)",color:tab===t.k?IC:"rgba(255,255,255,0.4)",cursor:"pointer"}}>{t.l}</button>)}</div>
    {lo?<p style={{color:"rgba(255,255,255,0.3)",textAlign:"center",padding:"2rem 0"}}>Cargando...</p>:<>

    {tab==="general"&&<>
      <Card title="Estado" actions={<Btn onClick={saveOp} disabled={saving} small>{saving?"Guardando...":"Guardar"}</Btn>}>
        <Sel label="Estado de la carga" value={op.status} onChange={chOp("status")} options={STATUSES.map(s=>({value:s,label:SM[s].l}))}/>
        <Inp label="Descripción" value={op.description} onChange={chOp("description")}/>
        <Inp label="Notas admin (interno)" value={op.admin_notes} onChange={chOp("admin_notes")} placeholder="Notas internas..."/>
      </Card>
      <Card title="Resumen">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:16}}>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 4px"}}>CANAL</p><p style={{fontSize:14,color:"#fff",margin:0}}>{CM[op.channel]||op.channel}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 4px"}}>ORIGEN</p><p style={{fontSize:14,color:"#fff",margin:0}}>{op.origin||"—"}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 4px"}}>PRODUCTOS</p><p style={{fontSize:14,color:"#fff",margin:0}}>{items.length}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 4px"}}>BULTOS</p><p style={{fontSize:14,color:"#fff",margin:0}}>{pkgs.length}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 4px"}}>VALOR FOB</p><p style={{fontSize:14,color:"#fff",margin:0}}>USD {items.reduce((s,it)=>s+Number(it.unit_price_usd||0)*Number(it.quantity||1),0).toLocaleString()}</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 4px"}}>PESO BRUTO</p><p style={{fontSize:14,color:"#fff",margin:0}}>{pkgs.reduce((s,p)=>s+Number(p.gross_weight_kg||0),0).toFixed(1)} kg</p></div>
          <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 4px"}}>EVENTOS</p><p style={{fontSize:14,color:"#fff",margin:0}}>{events.length}</p></div>
        </div>
      </Card>
    </>}

    {tab==="budget"&&(()=>{const totalFob=items.reduce((s,it)=>s+Number(it.unit_price_usd||0)*Number(it.quantity||1),0);const totalTax=items.reduce((s,it)=>{const fob=Number(it.unit_price_usd||0)*Number(it.quantity||1);if(!isBlanco)return s;let t=0;if(it.import_duty_rate!=null)t+=fob*(Number(it.import_duty_rate)/100);if(it.statistics_rate!=null)t+=fob*(Number(it.statistics_rate)/100);if(it.iva_rate!=null)t+=fob*(Number(it.iva_rate)/100);if(it.documentary_expense!=null)t+=Number(it.documentary_expense);if(it.iva_additional_rate!=null)t+=fob*(Number(it.iva_additional_rate)/100);if(it.iigg_rate!=null)t+=fob*(Number(it.iigg_rate)/100);if(it.iibb_rate!=null)t+=fob*(Number(it.iibb_rate)/100);return s+t;},0);
      let pf=0;pkgs.forEach(p=>{const gw=Number(p.gross_weight_kg||0);const l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);pf+=Math.max(gw,l&&w&&h?(l*w*h)/5000:0);});
      const fleteRate=tariffs?.length?((r)=>{const rates=tariffs.filter(t=>t.service_key===(op.channel==="aereo_blanco"?"aereo_a_china":"maritimo_a_china")&&t.type==="rate");for(const rt of rates){const min=Number(rt.min_qty||0),max=rt.max_qty!=null?Number(rt.max_qty):Infinity;if(pf>=min&&pf<max)return Number(rt.rate);}return rates.length?Number(rates[rates.length-1].rate):0;})():0;
      const flete=op.channel?.includes("aereo")?pf*fleteRate:pkgs.reduce((s,p)=>{const l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);return s+(l&&w&&h?(l*w*h)/1000000:0);},0)*fleteRate;
      const totalSvc=Number(op.total_services||0);const shipCost=op.shipping_to_door?Number(op.shipping_cost||0):0;
      return <Card title="Presupuesto (auto-calculado)" actions={<Btn onClick={saveOp} disabled={saving} small>{saving?"Guardando...":"Guardar"}</Btn>}>
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0"}}><span style={{color:"rgba(255,255,255,0.5)"}}>Total Impuestos</span><span style={{fontWeight:600,color:"#fff"}}>USD {totalTax.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0"}}><span style={{color:"rgba(255,255,255,0.5)"}}>Flete estimado</span><span style={{fontWeight:600,color:"#fff"}}>USD {flete.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px",marginTop:12}}>
          <Inp label="Total Servicios (USD)" type="number" value={op.total_services} onChange={chOp("total_services")} step="0.01"/>
          <Inp label="Costo Envío a Domicilio (USD)" type="number" value={op.shipping_cost} onChange={chOp("shipping_cost")} step="0.01"/>
        </div>
        <div style={{marginBottom:12}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={op.shipping_to_door||false} onChange={e=>chOp("shipping_to_door")(e.target.checked)}/><span style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>Envío a domicilio</span></label></div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderTop:"1px solid rgba(255,255,255,0.08)"}}><span style={{fontWeight:700,color:"#fff"}}>TOTAL A ABONAR</span><span style={{fontSize:18,fontWeight:700,color:IC}}>USD {(totalTax+totalSvc+shipCost).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
      </Card>;})()}

    {tab==="items"&&<Card title="Productos" actions={<Btn onClick={addItem} small>+ Agregar producto</Btn>}>
      {items.map((it,i)=>{const fob=Number(it.unit_price_usd||0)*Number(it.quantity||1);return <div key={it.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:"16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10}}>
          <p style={{fontSize:13,fontWeight:700,color:IC,margin:0}}>Producto {i+1} — FOB: USD {fob.toLocaleString(undefined,{minimumFractionDigits:2})}</p>
          <div style={{display:"flex",gap:6}}><Btn onClick={()=>saveItem(it)} small variant="secondary">Guardar</Btn><Btn onClick={()=>delItem(it.id)} small variant="danger">Eliminar</Btn></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"0 12px"}}>
          <Inp label="Descripción" value={it.description} onChange={v=>chItem(i,"description",v)} small/>
          <Inp label="Precio unit. USD" type="number" value={it.unit_price_usd} onChange={v=>chItem(i,"unit_price_usd",v)} step="0.01" small/>
          <Inp label="Cantidad" type="number" value={it.quantity} onChange={v=>chItem(i,"quantity",v?parseInt(v):0)} small/>
        </div>
        <div style={{background:"rgba(255,255,255,0.02)",borderRadius:8,padding:"12px",border:"1px solid rgba(255,255,255,0.04)",marginTop:4}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.3)",margin:"0 0 8px",textTransform:"uppercase"}}>Tasas Impositivas</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0 12px"}}>
            <Inp label="DIE %" type="number" value={it.import_duty_rate} onChange={v=>chItem(i,"import_duty_rate",v)} step="0.01" small/>
            <Inp label="TE %" type="number" value={it.statistics_rate} onChange={v=>chItem(i,"statistics_rate",v)} step="0.01" small/>
            <Inp label="IVA %" type="number" value={it.iva_rate} onChange={v=>chItem(i,"iva_rate",v)} step="0.01" small/>
            {isAereo&&<Inp label="Gasto Doc. $" type="number" value={it.documentary_expense} onChange={v=>chItem(i,"documentary_expense",v)} step="0.01" small/>}
            {isMaritimo&&<><Inp label="IVA Adic. %" type="number" value={it.iva_additional_rate} onChange={v=>chItem(i,"iva_additional_rate",v)} step="0.01" small/>
            <Inp label="IIGG %" type="number" value={it.iigg_rate} onChange={v=>chItem(i,"iigg_rate",v)} step="0.01" small/>
            <Inp label="IIBB %" type="number" value={it.iibb_rate} onChange={v=>chItem(i,"iibb_rate",v)} step="0.01" small/></>}
          </div>
        </div>
      </div>;})}
      {items.length===0&&<p style={{color:"rgba(255,255,255,0.25)",textAlign:"center",padding:"1rem 0"}}>No hay productos.</p>}
    </Card>}

    {tab==="packages"&&<Card title="Bultos" actions={<Btn onClick={addPkg} small>+ Agregar bulto</Btn>}>
      {pkgs.map((pk,i)=>{const q=Number(pk.quantity||1),l=Number(pk.length_cm||0),w=Number(pk.width_cm||0),h=Number(pk.height_cm||0),gw=Number(pk.gross_weight_kg||0);const bruto=gw*q;const vw=l&&w&&h?((l*w*h)/5000)*q:0;const cbm=l&&w&&h?((l*w*h)/1000000)*q:0;return <div key={pk.id} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:"16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <p style={{fontSize:13,fontWeight:700,color:IC,margin:0}}>Bulto {pk.package_number}</p>
          <div style={{display:"flex",gap:6}}><Btn onClick={()=>savePkg(pk)} small variant="secondary">Guardar</Btn><Btn onClick={()=>delPkg(pk.id)} small variant="danger">Eliminar</Btn></div>
        </div>
        <Inp label="Seguimiento nacional" value={pk.national_tracking} onChange={v=>chPkg(i,"national_tracking",v)} placeholder="Código de seguimiento nacional" small/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:"0 12px"}}>
          <Inp label="Cantidad" type="number" value={pk.quantity} onChange={v=>chPkg(i,"quantity",v?parseInt(v):1)} small/>
          <Inp label="Largo cm" type="number" value={pk.length_cm} onChange={v=>chPkg(i,"length_cm",v)} step="0.1" small/>
          <Inp label="Ancho cm" type="number" value={pk.width_cm} onChange={v=>chPkg(i,"width_cm",v)} step="0.1" small/>
          <Inp label="Alto cm" type="number" value={pk.height_cm} onChange={v=>chPkg(i,"height_cm",v)} step="0.1" small/>
          <Inp label="Peso unit. kg" type="number" value={pk.gross_weight_kg} onChange={v=>chPkg(i,"gross_weight_kg",v)} step="0.1" small/>
        </div>
        {(bruto>0||vw>0)&&<div style={{display:"flex",gap:16,marginTop:8,fontSize:11,color:"rgba(255,255,255,0.3)"}}><span>Bruto total: <strong style={{color:"#fff"}}>{bruto.toFixed(1)} kg</strong></span>{vw>0&&<span>Vol: <strong style={{color:"#fff"}}>{vw.toFixed(1)} kg</strong></span>}{cbm>0&&<span>CBM: <strong style={{color:"#fff"}}>{cbm.toFixed(4)} m³</strong></span>}{vw>bruto&&<span style={{color:"#fb923c"}}>Volumétrico mayor</span>}</div>}
      </div>;})}
      {pkgs.length>0&&(()=>{let pf=0,totGW=0,totCBM=0;pkgs.forEach(p=>{const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);const b=gw*q;const v=l&&w&&h?((l*w*h)/5000)*q:0;pf+=Math.max(b,v);totGW+=b;totCBM+=l&&w&&h?((l*w*h)/1000000)*q:0;});return <div style={{borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:12,marginTop:8,display:"flex",gap:20}}><div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>PESO FACTURABLE</p><p style={{fontSize:16,fontWeight:700,color:IC,margin:0}}>{pf.toFixed(2)} kg</p></div><div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>PESO BRUTO</p><p style={{fontSize:14,color:"#fff",margin:0}}>{totGW.toFixed(2)} kg</p></div><div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 2px"}}>CBM TOTAL</p><p style={{fontSize:14,color:"#fff",margin:0}}>{totCBM.toFixed(4)} m³</p></div></div>;})()}
      {pkgs.length===0&&<p style={{color:"rgba(255,255,255,0.25)",textAlign:"center",padding:"1rem 0"}}>No hay bultos.</p>}
    </Card>}

    {tab==="tracking"&&<><Card title="Carrier & Tracking" actions={<Btn onClick={saveOp} disabled={saving} small>{saving?"Guardando...":"Guardar"}</Btn>}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 16px"}}>
        <Inp label="Carrier Internacional" value={op.international_carrier} onChange={chOp("international_carrier")} placeholder="Ej: DHL, FedEx, UPS"/>
        <Inp label="Tracking Internacional" value={op.international_tracking} onChange={chOp("international_tracking")} placeholder="Número de seguimiento"/>
        <Inp label="ETA" type="date" value={formatDateInput(op.eta)} onChange={chOp("eta")}/>
      </div>
      <p style={{fontSize:11,color:"rgba(255,255,255,0.25)",margin:"4px 0 0"}}>Integración con APIs de tracking (DHL/FedEx/UPS) próximamente</p>
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
          <Inp label="Fecha" type="datetime-local" value={ev.occurred_at?ev.occurred_at.slice(0,16):""} onChange={v=>chEvt(i,"occurred_at",v?new Date(v).toISOString():null)} small/>
          <div style={{marginBottom:12,paddingTop:22}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={ev.is_visible_to_client!==false} onChange={e=>chEvt(i,"is_visible_to_client",e.target.checked)}/><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Visible para el cliente</span></label></div>
        </div>
      </div>)}
      {events.length===0&&<p style={{color:"rgba(255,255,255,0.25)",textAlign:"center",padding:"1rem 0"}}>No hay eventos de seguimiento.</p>}
    </Card>
    </>}
    </>}
  </div>;
}

function ClientsList({token,onSelect}){
  const [clients,setClients]=useState([]);const [lo,setLo]=useState(true);const [search,setSearch]=useState("");
  useEffect(()=>{(async()=>{const c=await dq("clients",{token,filters:"?select=*&order=created_at.desc"});setClients(Array.isArray(c)?c:[]);setLo(false);})();},[token]);
  const filtered=clients.filter(c=>{if(!search)return true;const s=search.toLowerCase();return `${c.first_name} ${c.last_name}`.toLowerCase().includes(s)||c.client_code?.toLowerCase().includes(s)||c.email?.toLowerCase().includes(s);});
  return <div>
    <h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 20px"}}>Clientes</h2>
    <div style={{marginBottom:16}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre, código o email..." style={{width:"100%",maxWidth:400,padding:"10px 14px",fontSize:13,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/></div>
    {lo?<p style={{color:"rgba(255,255,255,0.3)",textAlign:"center",padding:"2rem 0"}}>Cargando...</p>:
    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          {["Código","Nombre","Email","WhatsApp","Ciudad",""].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",textTransform:"uppercase"}}>{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map(c=><tr key={c.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"}} onClick={()=>onSelect(c)} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
          <td style={{padding:"12px 14px",fontFamily:"monospace",fontWeight:700,color:IC}}>{c.client_code}</td>
          <td style={{padding:"12px 14px",color:"#fff",fontWeight:500}}>{c.first_name} {c.last_name}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)"}}>{c.email}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)"}}>{c.whatsapp}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.4)"}}>{c.city}, {c.province}</td>
          <td style={{padding:"12px 14px"}}><span style={{color:IC,fontSize:12,fontWeight:600}}>Ver →</span></td>
        </tr>)}</tbody>
      </table>
      {filtered.length===0&&<p style={{textAlign:"center",color:"rgba(255,255,255,0.25)",padding:"2rem 0"}}>No se encontraron clientes</p>}
    </div>}
  </div>;
}

function ClientDetail({client:initClient,token,onBack,onSelectOp,onDelete}){
  const [cl,setCl]=useState(initClient);const [ops,setOps]=useState([]);const [lo,setLo]=useState(true);const [tab,setTab]=useState("info");const [tariffs,setTariffs]=useState([]);const [overrides,setOverrides]=useState([]);const [msg,setMsg]=useState("");const [saving,setSaving]=useState(false);
  useEffect(()=>{(async()=>{const [o,t,ov]=await Promise.all([dq("operations",{token,filters:`?client_id=eq.${cl.id}&select=*&order=created_at.desc`}),dq("tariffs",{token,filters:"?select=*&type=eq.rate&order=service_key.asc,sort_order.asc"}),dq("client_tariff_overrides",{token,filters:`?client_id=eq.${cl.id}&select=*`})]);setOps(Array.isArray(o)?o:[]);setTariffs(Array.isArray(t)?t:[]);setOverrides(Array.isArray(ov)?ov:[]);setLo(false);})();},[cl.id,token]);
  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),2500);};
  const getOverride=(tid)=>overrides.find(o=>o.tariff_id===tid);
  const setOverrideRate=async(tid,rate)=>{const existing=getOverride(tid);if(rate===""||rate==null){if(existing){await dq("client_tariff_overrides",{method:"DELETE",token,filters:`?id=eq.${existing.id}`});setOverrides(p=>p.filter(o=>o.id!==existing.id));flash("Tarifa custom eliminada");}return;}if(existing){await dq("client_tariff_overrides",{method:"PATCH",token,filters:`?id=eq.${existing.id}`,body:{custom_rate:Number(rate)}});setOverrides(p=>p.map(o=>o.id===existing.id?{...o,custom_rate:Number(rate)}:o));} else{const r=await dq("client_tariff_overrides",{method:"POST",token,body:{client_id:cl.id,tariff_id:tid,custom_rate:Number(rate)}});if(Array.isArray(r))setOverrides(p=>[...p,...r]);else if(r?.id)setOverrides(p=>[...p,r]);}flash("Tarifa custom guardada");};
  const chCl=f=>v=>setCl(p=>({...p,[f]:v}));
  const saveClient=async()=>{setSaving(true);const{id,created_at,updated_at,auth_user_id,...rest}=cl;await dq("clients",{method:"PATCH",token,filters:`?id=eq.${id}`,body:rest});flash("Cliente guardado");setSaving(false);};
  const deleteClient=async()=>{if(!confirm(`¿Estás seguro de eliminar a ${cl.first_name} ${cl.last_name}? Esta acción no se puede deshacer.`))return;await dq("clients",{method:"DELETE",token,filters:`?id=eq.${cl.id}`});onDelete();};
  const tabs=[{k:"info",l:"Info"},{k:"ops",l:`Operaciones (${ops.length})`},{k:"tariffs",l:"Tarifas"}];
  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}><div style={{display:"flex",alignItems:"center",gap:12}}><button onClick={onBack} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>← VOLVER</button><h2 style={{fontSize:18,fontWeight:700,color:"#fff",margin:0}}>{cl.first_name} {cl.last_name}</h2>{msg&&<span style={{fontSize:12,color:"#22c55e",fontWeight:600}}>{msg}</span>}</div><Btn onClick={deleteClient} variant="danger" small>Eliminar cliente</Btn></div>
    <div style={{display:"flex",gap:8,marginBottom:16}}>{tabs.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{padding:"8px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:tab===t.k?`1.5px solid ${IC}`:"1.5px solid rgba(255,255,255,0.08)",background:tab===t.k?"rgba(96,165,250,0.12)":"rgba(255,255,255,0.03)",color:tab===t.k?IC:"rgba(255,255,255,0.4)",cursor:"pointer"}}>{t.l}</button>)}</div>
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
    {tab==="ops"&&<Card title="Operaciones">{lo?<p style={{color:"rgba(255,255,255,0.3)"}}>Cargando...</p>:ops.length>0?ops.map(op=>{const st=SM[op.status]||{l:op.status,c:"#999"};return <div key={op.id} onClick={()=>onSelectOp(op)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontFamily:"monospace",fontWeight:600,color:"#fff",fontSize:13}}>{op.operation_code}</span><span style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:4,color:st.c,background:`${st.c}15`}}>● {st.l}</span></div><div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{CM[op.channel]||op.channel}</span><span style={{color:IC,fontSize:12,fontWeight:600}}>Editar →</span></div></div>;}):<p style={{color:"rgba(255,255,255,0.25)"}}>Sin operaciones</p>}</Card>}
    {tab==="tariffs"&&<div>{SERVICES.map(svc=>{const svcRates=tariffs.filter(t=>t.service_key===svc.key);if(!svcRates.length)return null;return <Card key={svc.key} title={svc.label}><p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:"-8px 0 12px"}}>Dejá vacío para usar tarifa base. Poné un valor para aplicar tarifa promocional.</p>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}><th style={{padding:"8px 0",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)"}}>RANGO</th><th style={{padding:"8px 0",textAlign:"right",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)"}}>TARIFA BASE</th><th style={{padding:"8px 0",textAlign:"right",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)"}}>TARIFA CUSTOM</th></tr></thead>
      <tbody>{svcRates.map(t=>{const ov=getOverride(t.id);return <tr key={t.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}><td style={{padding:"8px 0",color:"rgba(255,255,255,0.6)"}}>{t.label}</td><td style={{padding:"8px 0",textAlign:"right",color:ov?"rgba(255,255,255,0.3)":"#fff",fontWeight:600,textDecoration:ov?"line-through":"none"}}>${Number(t.rate).toLocaleString()}/{t.unit}</td><td style={{padding:"8px 0",textAlign:"right",display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6}}><input type="number" value={ov?.custom_rate??""} onChange={e=>setOverrideRate(t.id,e.target.value)} placeholder="—" step="0.01" style={{width:80,padding:"4px 8px",fontSize:13,textAlign:"right",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,background:ov?"rgba(96,165,250,0.1)":"rgba(255,255,255,0.04)",color:ov?IC:"rgba(255,255,255,0.4)",outline:"none"}}/>{ov&&<button onClick={()=>setOverrideRate(t.id,"")} style={{fontSize:10,padding:"4px 8px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer",fontWeight:600}}>X</button>}</td></tr>;})}</tbody></table></Card>;})}</div>}
  </div>;
}

function TariffsManager({token}){
  const [tariffs,setTariffs]=useState([]);const [lo,setLo]=useState(true);const [selSvc,setSelSvc]=useState(null);const [msg,setMsg]=useState("");const [viewMode,setViewMode]=useState("sell");
  const load=async()=>{const t=await dq("tariffs",{token,filters:"?select=*&order=service_key.asc,sort_order.asc"});setTariffs(Array.isArray(t)?t:[]);setLo(false);};
  useEffect(()=>{load();},[token]);
  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),2500);};
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
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:0}}>Tarifas</h2>{msg&&<span style={{fontSize:12,color:"#22c55e",fontWeight:600}}>{msg}</span>}</div>
    <div style={{display:"flex",gap:8,marginBottom:20}}>{[{k:"sell",l:"Precios de Venta"},{k:"cost",l:"Costos de Flete"}].map(m=><button key={m.k} onClick={()=>setViewMode(m.k)} style={{padding:"8px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:viewMode===m.k?`1.5px solid ${IC}`:"1.5px solid rgba(255,255,255,0.08)",background:viewMode===m.k?"rgba(96,165,250,0.12)":"rgba(255,255,255,0.03)",color:viewMode===m.k?IC:"rgba(255,255,255,0.4)",cursor:"pointer"}}>{m.l}</button>)}</div>
    {certLoaded&&<Card title="Certificación de Flete (CIF)"><p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:"-8px 0 12px"}}>Valores para calcular el CIF. Real = lo declarado ante aduana. Ficticio = lo que ve el cliente.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 12px"}}>{[
        {k:"cert_flete_aereo_real",l:"Aéreo REAL (USD/kg bruto)"},
        {k:"cert_flete_aereo_ficticio",l:"Aéreo FICTICIO (USD/kg fact.)"},
        {k:"cert_flete_maritimo_real",l:"Marítimo REAL (USD/CBM)"},
        {k:"cert_flete_maritimo_ficticio",l:"Marítimo FICTICIO (USD/CBM)"}
      ].map(f=>{const c=getCert(f.k);return <div key={f.k} style={{marginBottom:12}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.45)",marginBottom:4}}>{f.l}</label><input type="number" value={c?.value||""} onChange={e=>{setCertConfig(p=>p.map(x=>x.key===f.k?{...x,value:e.target.value}:x));}} onBlur={e=>saveCertConfig(f.k,e.target.value)} step="0.1" style={{width:"100%",padding:"8px 10px",fontSize:13,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/></div>;})}</div></Card>}
    {lo?<p style={{color:"rgba(255,255,255,0.3)"}}>Cargando...</p>:SERVICES.map(svc=>{const svcRates=tariffs.filter(t=>t.service_key===svc.key&&t.type==="rate");if(!svcRates.length)return null;return <div key={svc.key} onClick={()=>setSelSvc(svc.key)} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"16px 20px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";}}><div><p style={{fontSize:15,fontWeight:600,color:"#fff",margin:0}}>{svc.label}</p>{svc.info&&<p style={{fontSize:12,color:"rgba(255,255,255,0.35)",margin:"2px 0 0"}}>{svc.info}</p>}</div><div style={{display:"flex",alignItems:"center",gap:12}}>{svcRates.map(r=><span key={r.id} style={{fontSize:11,color:isCost?"rgba(255,255,255,0.4)":"rgba(255,255,255,0.5)"}}>{r.label}: ${isCost?Number(r.cost||0):Number(r.rate)}</span>)}<span style={{color:IC,fontSize:12,fontWeight:600}}>Editar →</span></div></div>;})}</div>;
  const svcInfo=SERVICES.find(s=>s.key===selSvc);
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><div style={{display:"flex",alignItems:"center",gap:12}}><button onClick={()=>setSelSvc(null)} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>← VOLVER</button><h2 style={{fontSize:18,fontWeight:700,color:"#fff",margin:0}}>{svcInfo?.label} — {isCost?"Costos":"Precios de Venta"}</h2>{msg&&<span style={{fontSize:12,color:"#22c55e",fontWeight:600}}>{msg}</span>}</div></div>
    <Card title="Rangos de tarifa" actions={<Btn onClick={()=>addTariff("rate")} small>+ Agregar rango</Btn>}>{rates.length>0?rates.map(renderRow):<p style={{color:"rgba(255,255,255,0.25)"}}>Sin rangos</p>}</Card>
    <Card title="Tarifas especiales" actions={<Btn onClick={()=>addTariff("special")} small>+ Agregar especial</Btn>}>{specials.length>0?specials.map(t=><div key={t.id} style={{display:"flex",gap:8,alignItems:"end",padding:"8px 0"}}><div style={{flex:2}}><Inp label="Label" value={t.label} onChange={v=>chT(t.id,"label",v)} small/></div><div style={{flex:1}}><Inp label={isCost?"Costo/un":"Tarifa/un"} type="number" value={isCost?t.cost:t.rate} onChange={v=>chT(t.id,isCost?"cost":"rate",v)} step="0.01" small/></div><div style={{flex:2}}><Inp label="Notas" value={t.notes} onChange={v=>chT(t.id,"notes",v)} small/></div><div style={{display:"flex",gap:4,paddingBottom:12}}><Btn onClick={()=>saveTariff(t)} small variant="secondary">Guardar</Btn><Btn onClick={()=>delTariff(t.id)} small variant="danger">X</Btn></div></div>):<p style={{color:"rgba(255,255,255,0.25)"}}>Sin tarifas especiales</p>}</Card>
    {!isCost&&<Card title="Recargos por valor" actions={<Btn onClick={()=>addTariff("surcharge")} small>+ Agregar recargo</Btn>}>{surcharges.length>0?surcharges.map(renderRow):<p style={{color:"rgba(255,255,255,0.25)"}}>Sin recargos</p>}</Card>}
  </div>;
}

function Calculator({token,clients}){
  const [step,setStep]=useState(0);const [origin,setOrigin]=useState("");const [selClient,setSelClient]=useState("");
  const [products,setProducts]=useState([{type:"general",description:"",unit_price:"",quantity:"1"}]);
  const [pkgs,setPkgs]=useState([{qty:"1",length:"",width:"",height:"",weight:""}]);const [noDims,setNoDims]=useState(false);const [delivery,setDelivery]=useState("oficina");
  const [tariffs,setTariffs]=useState([]);const [overrides,setOverrides]=useState([]);const [results,setResults]=useState(null);
  const [ncm,setNcm]=useState(null);const [ncmLoading,setNcmLoading]=useState(false);const [ncmManual,setNcmManual]=useState(false);const [hasBattery,setHasBattery]=useState(false);const [config,setConfig]=useState({});
  useEffect(()=>{(async()=>{const [t,c]=await Promise.all([dq("tariffs",{token,filters:"?select=*&order=sort_order.asc"}),dq("calc_config",{token,filters:"?select=*"})]);setTariffs(Array.isArray(t)?t:[]);const cfg={};(Array.isArray(c)?c:[]).forEach(r=>{cfg[r.key]=Number(r.value);});setConfig(cfg);})();},[token]);
  useEffect(()=>{if(!selClient){setOverrides([]);return;}(async()=>{const ov=await dq("client_tariff_overrides",{token,filters:`?client_id=eq.${selClient}&select=*`});setOverrides(Array.isArray(ov)?ov:[]);})();},[selClient,token]);

  const addProduct=()=>setProducts(p=>[...p,{type:"general",description:"",unit_price:"",quantity:"1"}]);
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

  const detectNCM=async()=>{const desc=products.map(p=>p.description||p.type).join(", ");if(!desc.trim())return;setNcmLoading(true);try{const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:desc})});const d=await r.json();if(d.fallback||d.error){setNcmManual(true);setNcm({ncm_code:"",import_duty_rate:"",statistics_rate:"3",iva_rate:"21"});}else{setNcm(d);setNcmManual(false);}}catch{setNcmManual(true);setNcm({ncm_code:"",import_duty_rate:"",statistics_rate:"3",iva_rate:"21"});}setNcmLoading(false);};
  const setManualNCM=(f,v)=>setNcm(p=>({...p,[f]:v}));

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

      // Per-item tax helper (same as client)
      const calcItemTax=(p,certFl,isMar,totalCif)=>{const itemFob=Number(p.unit_price||0)*Number(p.quantity||1);const pct=totalFob>0?itemFob/totalFob:1;
        const iCert=certFl*pct;const iSeg=(itemFob+iCert)*0.01;const iCif=itemFob+iCert+iSeg;
        const dr=Number(p.ncm?.import_duty_rate||0)/100;const te_r=Number(p.ncm?.statistics_rate||0)/100;const ivaR=Number(p.ncm?.iva_rate||21)/100;
        const die=iCif*dr;const te=iCif*te_r;const bi=iCif+die+te;const iva=bi*ivaR;let tot=die+te+iva;
        if(isMar){const ia=bi*0.20;const ig=bi*0.06;const ib=bi*0.05;tot+=ia+ig+ib;}
        else{const tasa=getDesembolso(totalCif)*pct;tot+=tasa+tasa*0.21;}
        return tot;};

      // Aéreo Courier Comercial (A)
      if(fact>0){const{rate,cost}=getFleteRate("aereo_a_china",fact);const flete=fact*rate;const fCost=fact*cost;
        const certFlFict=fact*certAerFict;const segFict=(totalFob+certFlFict)*0.01;const cifFict=totalFob+certFlFict+segFict;
        const certFlReal=totWeight*certAerReal;const segReal=(totalFob+certFlReal)*0.01;const cifReal=totalFob+certFlReal+segReal;
        const validProds=products.filter(p=>Number(p.unit_price)>0);
        const impFict=validProds.reduce((s,p)=>s+calcItemTax(p,certFlFict,false,cifFict),0);
        const impReal=validProds.reduce((s,p)=>s+calcItemTax(p,certFlReal,false,cifReal),0);
        const battExtra=hasBattery?fact*2:0;const gananciaImp=impFict-impReal;
        channels.push({key:"aereo_a_china",name:"Aéreo Courier Comercial",info:"7-10 días",isBlanco:true,
          flete,fCost,seguro:segFict,battExtra,totalImp:impFict,totalSvc:flete+segFict+battExtra,total:impFict+flete+segFict+battExtra,
          cifReal,cifFict,impReal,impFict,gananciaImp,unit:`${fact.toFixed(1)} kg`});}
      // Aéreo Integral AC (B)
      if(totWeight>0){const{rate,cost}=getFleteRate("aereo_b_china",totWeight);const flete=totWeight*rate;const fCost=totWeight*cost;const sur=getSurcharge("aereo_b_china",totalFob,totWeight);
        channels.push({key:"aereo_b_china",name:"Aéreo Integral AC",info:"10-15 días",isBlanco:false,flete,fCost,surcharge:sur.amt,surchargePct:sur.pct,total:flete+sur.amt,unit:`${totWeight.toFixed(1)} kg`});}
      // Marítimo Carga LCL/FCL (A)
      if(!noDims&&totCBM>0){const{rate,cost}=getFleteRate("maritimo_a_china",totCBM);const flete=totCBM*rate;const fCost=totCBM*cost;
        const certFlFict=totCBM*certMarFict;const segFict=(totalFob+certFlFict)*0.01;const cifFict=totalFob+certFlFict+segFict;
        const certFlReal=totCBM*certMarReal;const segReal=(totalFob+certFlReal)*0.01;const cifReal=totalFob+certFlReal+segReal;
        const validProds=products.filter(p=>Number(p.unit_price)>0);
        const impFict=validProds.reduce((s,p)=>s+calcItemTax(p,certFlFict,true,cifFict),0);
        const impReal=validProds.reduce((s,p)=>s+calcItemTax(p,certFlReal,true,cifReal),0);
        const gananciaImp=impFict-impReal;
        channels.push({key:"maritimo_a_china",name:"Marítimo Carga LCL/FCL",info:"",isBlanco:true,isMar:true,
          flete,fCost,seguro:segFict,totalImp:impFict,totalSvc:flete+segFict,total:impFict+flete+segFict,
          cifReal,cifFict,impReal:taxReal.totalImp,impFict:taxFict.totalImp,gananciaImp,
          unit:`${totCBM.toFixed(4)} CBM`});}
      // Marítimo Integral AC (B)
      if(!noDims&&totCBM>0){const{rate,cost}=getFleteRate("maritimo_b",totCBM);const flete=totCBM*rate;const fCost=totCBM*cost;const sur=getSurcharge("maritimo_b",totalFob,totCBM);
        channels.push({key:"maritimo_b",name:"Marítimo Integral AC",info:"",isBlanco:false,flete,fCost,surcharge:sur.amt,surchargePct:sur.pct,total:flete+sur.amt,unit:`${totCBM.toFixed(4)} CBM`});}
      channels.sort((a,b)=>a.total-b.total);
    }
    setResults({channels,totWeight,totCBM});setStep(4);
  };

  const usd=v=>`USD ${v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const row=(l,v,bold,accent)=><div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",...(bold?{borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4,paddingTop:8}:{})}}><span style={{fontSize:12,color:bold?"#fff":"rgba(255,255,255,0.45)",fontWeight:bold?700:400}}>{l}</span><span style={{fontSize:12,fontWeight:bold?700:600,color:accent?IC:bold?"#fff":"rgba(255,255,255,0.7)"}}>{usd(v)}</span></div>;
  const clName=selClient?clients.find(c=>c.id===selClient):null;

  return <div><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:"0 0 20px"}}>Calculadora de Importación</h2>
    {/* Client selector - always visible */}
    <Card><Sel label="Cliente (para tarifas custom)" value={selClient} onChange={setSelClient} options={clients.map(c=>({value:c.id,label:`${c.client_code} — ${c.first_name} ${c.last_name}`}))} ph="Sin cliente (tarifa base)"/>
    {selClient&&overrides.length>0&&<p style={{fontSize:11,color:IC,margin:"-8px 0 0",fontWeight:600}}>Usando {overrides.length} tarifa(s) custom</p>}</Card>

    {step===0&&<div style={{display:"flex",gap:24,justifyContent:"center",padding:"2rem 0"}}>{[{k:"China",flag:"\ud83c\udde8\ud83c\uddf3"},{k:"USA",flag:"\ud83c\uddfa\ud83c\uddf8"}].map(c=><div key={c.k} onClick={()=>{setOrigin(c.k);setStep(1);}} style={{width:200,padding:"2.5rem 1.5rem",background:"rgba(255,255,255,0.03)",border:"1.5px solid rgba(255,255,255,0.08)",borderRadius:16,cursor:"pointer",textAlign:"center"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=IC;e.currentTarget.style.background="rgba(96,165,250,0.08)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.background="rgba(255,255,255,0.03)";}}><p style={{fontSize:52,margin:"0 0 16px"}}>{c.flag}</p><p style={{fontSize:20,fontWeight:700,color:"#fff",margin:0}}>{c.k}</p></div>)}</div>}

    {step===1&&origin==="USA"&&<Card title="PRODUCTOS">
      {products.map((p,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Producto {i+1}</span>{products.length>1&&<Btn onClick={()=>rmProduct(i)} small variant="danger">Eliminar</Btn>}</div>
        <div style={{display:"flex",gap:12,marginBottom:12}}>{[{k:"general",l:"Carga General"},{k:"celulares",l:"Celulares"}].map(t=><div key={t.k} onClick={()=>chProd(i,"type",t.k)} style={{flex:1,padding:"12px",textAlign:"center",borderRadius:10,border:`1.5px solid ${p.type===t.k?IC:"rgba(255,255,255,0.08)"}`,background:p.type===t.k?"rgba(96,165,250,0.1)":"transparent",cursor:"pointer"}}><span style={{fontSize:13,fontWeight:600,color:p.type===t.k?IC:"rgba(255,255,255,0.4)"}}>{t.l}</span></div>)}</div>
        {p.type==="general"&&<Inp label="Descripción" value={p.description} onChange={v=>chProd(i,"description",v)} placeholder="Ej: Fundas de silicona"/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Precio unit. (USD)" type="number" value={p.unit_price} onChange={v=>chProd(i,"unit_price",v)} placeholder="3.50"/><Inp label="Cantidad" type="number" value={p.quantity} onChange={v=>chProd(i,"quantity",v)} placeholder="1"/></div>
      </div>)}
      <button onClick={addProduct} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar producto</button>
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
      <button onClick={addPkg} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar bulto</button>
      <div style={{marginTop:12}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={noDims} onChange={e=>setNoDims(e.target.checked)}/><span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Sin medidas (solo aéreo)</span></label></div>
      <div style={{display:"flex",gap:12,marginTop:16}}><Btn variant="secondary" onClick={()=>setStep(1)}>← Atrás</Btn><Btn onClick={()=>setStep(3)} disabled={!pkgs.some(p=>Number(p.weight)>0)}>Siguiente →</Btn></div>
    </Card>}

    {step===3&&origin==="USA"&&<Card title="ENTREGA EN DESTINO">
      <div style={{display:"flex",gap:12,marginBottom:16}}>{[{k:"oficina",l:"Retiro por Oficina",sub:"Gratis"},{k:"caba",l:"Envío CABA",sub:"$20"},{k:"gba",l:"Envío a todo el país",sub:"A cotizar"}].map(d=><div key={d.k} onClick={()=>setDelivery(d.k)} style={{flex:1,padding:"14px",textAlign:"center",borderRadius:10,border:`1.5px solid ${delivery===d.k?IC:"rgba(255,255,255,0.08)"}`,background:delivery===d.k?"rgba(96,165,250,0.1)":"transparent",cursor:"pointer"}}><p style={{fontSize:14,fontWeight:700,color:delivery===d.k?IC:"rgba(255,255,255,0.5)",margin:"0 0 2px"}}>{d.l}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.35)",margin:0}}>{d.sub}</p></div>)}</div>
      <div style={{display:"flex",gap:12}}><Btn variant="secondary" onClick={()=>setStep(2)}>← Atrás</Btn><Btn onClick={calculate}>Calcular costos →</Btn></div>
    </Card>}

    {step===4&&results&&<div>
      <div style={{display:"flex",gap:12,marginBottom:16}}><button onClick={()=>setStep(3)} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>← Volver</button><span style={{color:"rgba(255,255,255,0.1)"}}>|</span><button onClick={()=>{setStep(0);setResults(null);setOrigin("");setProducts([{type:"general",description:"",unit_price:"",quantity:"1"}]);setPkgs([{qty:"1",length:"",width:"",height:"",weight:""}]);setNoDims(false);setDelivery("oficina");setNcm(null);setNcmManual(false);setHasBattery(false);}} style={{fontSize:13,color:"rgba(255,255,255,0.4)",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>Nueva cotización</button></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>{results.channels.map(ch=>{const delivCost=delivery==="caba"?20:0;const clientTotal=ch.total+delivCost;const gananciaFlete=ch.flete-(ch.fCost||0);const gananciaImp=ch.gananciaImp||0;const gananciaTotal=gananciaFlete+gananciaImp;return <div key={ch.key} style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",padding:"1.5rem"}}>
        <p style={{fontSize:17,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>{ch.name}</p>
        {ch.info&&<span style={{fontSize:11,color:"rgba(255,255,255,0.35)",padding:"3px 10px",background:"rgba(255,255,255,0.05)",borderRadius:4}}>{ch.info}</span>}
        <div style={{marginTop:14}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 8px"}}>COTIZACIÓN CLIENTE</p>
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
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 8px"}}>RENTABILIDAD</p>
          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Ganancia flete</span><span style={{fontSize:12,fontWeight:600,color:"#22c55e"}}>{usd(gananciaFlete)}</span></div>
          {ch.isBlanco&&gananciaImp>0&&<>
            <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Ganancia oculta (CIF)</span><span style={{fontSize:12,fontWeight:600,color:"#22c55e"}}>{usd(gananciaImp)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>CIF real: {usd(ch.cifReal||0)} → Imp real: {usd(ch.impReal||0)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>CIF ficticio: {usd(ch.cifFict||0)} → Imp ficticio: {usd(ch.impFict||0)}</span></div>
          </>}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderTop:"1px solid rgba(255,255,255,0.08)",marginTop:4}}><span style={{fontSize:14,fontWeight:700,color:"#fff"}}>GANANCIA TOTAL</span><span style={{fontSize:16,fontWeight:700,color:gananciaTotal>0?"#22c55e":"#ff6b6b"}}>{usd(gananciaTotal)}</span></div>
          {clientTotal>0&&<p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:"2px 0 0"}}>Margen: {((gananciaTotal/clientTotal)*100).toFixed(1)}%</p>}
        </div>
      </div>})}</div>
    </div>}

    {/* CHINA FLOW */}
    {step===1&&origin==="China"&&<Card title="PRODUCTOS">
      {products.map((p,i)=><div key={i} style={{borderTop:i>0?"1px solid rgba(255,255,255,0.06)":"none",padding:i>0?"16px 0 0":"0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:IC}}>Producto {i+1}</span>{products.length>1&&<Btn onClick={()=>rmProduct(i)} small variant="danger">Eliminar</Btn>}</div>
        <Inp label="Descripción" value={p.description} onChange={v=>chProd(i,"description",v)} placeholder="Ej: Fundas de silicona, auriculares bluetooth..."/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}><Inp label="Precio unit. (USD)" type="number" value={p.unit_price} onChange={v=>chProd(i,"unit_price",v)} placeholder="3.50"/><Inp label="Cantidad" type="number" value={p.quantity} onChange={v=>chProd(i,"quantity",v)} placeholder="1"/></div>
      </div>)}
      <button onClick={addProduct} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar producto</button>
      <div style={{marginTop:16}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={hasBattery} onChange={e=>setHasBattery(e.target.checked)}/><span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Producto con baterías (+$2/kg)</span></label></div>
      {!ncm&&<div style={{marginTop:16}}><Btn onClick={detectNCM} disabled={ncmLoading||!products.some(p=>p.description?.trim())}>{ncmLoading?"Clasificando...":"Clasificar NCM"}</Btn></div>}
      {ncmManual&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:14,marginTop:16,border:"1px solid rgba(255,255,255,0.06)"}}><p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:"0 0 10px"}}>Ingresá NCM manualmente:</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 12px"}}><Inp label="NCM" value={ncm?.ncm_code||""} onChange={v=>setManualNCM("ncm_code",v)} placeholder="3926.90.90"/><Inp label="Derechos %" type="number" value={ncm?.import_duty_rate||""} onChange={v=>setManualNCM("import_duty_rate",v)}/><Inp label="T. Estad. %" type="number" value={ncm?.statistics_rate||""} onChange={v=>setManualNCM("statistics_rate",v)}/><Inp label="IVA %" type="number" value={ncm?.iva_rate||""} onChange={v=>setManualNCM("iva_rate",v)}/></div></div>}
      {ncm&&ncm.ncm_code&&!ncmManual&&<div style={{background:"rgba(96,165,250,0.08)",borderRadius:10,padding:14,marginTop:16,border:"1px solid rgba(96,165,250,0.15)"}}><div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontFamily:"monospace",fontWeight:700,color:IC,padding:"4px 10px",background:"rgba(96,165,250,0.15)",borderRadius:6}}>{ncm.ncm_code}</span><span style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>{ncm.ncm_description}</span><button onClick={()=>{setNcm(null);setNcmManual(false);}} style={{fontSize:11,color:"rgba(255,255,255,0.3)",background:"none",border:"none",cursor:"pointer",marginLeft:"auto"}}>Reclasificar</button></div><div style={{display:"flex",gap:16,marginTop:8}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Derechos: <strong style={{color:"#fff"}}>{ncm.import_duty_rate}%</strong></span><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>TE: <strong style={{color:"#fff"}}>{ncm.statistics_rate}%</strong></span><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>IVA: <strong style={{color:"#fff"}}>{ncm.iva_rate}%</strong></span></div></div>}
      {totalFob>0&&<div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:12,marginTop:16,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Valor total</span><span style={{fontSize:16,fontWeight:700,color:IC}}>{usd(totalFob)}</span></div>}
      <div style={{display:"flex",gap:12,marginTop:16}}><Btn variant="secondary" onClick={()=>{setStep(0);setOrigin("");setNcm(null);setNcmManual(false);}}>← Origen</Btn><Btn onClick={()=>setStep(2)} disabled={!products.some(p=>Number(p.unit_price)>0)||(!ncm?.ncm_code&&!ncmManual)}>Siguiente →</Btn></div>
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
      <button onClick={addPkg} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.05)",color:IC,cursor:"pointer",marginTop:8}}>+ Agregar bulto</button>
      <div style={{marginTop:12}}><label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><input type="checkbox" checked={noDims} onChange={e=>setNoDims(e.target.checked)}/><span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Sin medidas (solo aéreo)</span></label></div>
      <div style={{display:"flex",gap:12,marginTop:16}}><Btn variant="secondary" onClick={()=>setStep(1)}>← Atrás</Btn><Btn onClick={()=>setStep(3)} disabled={!pkgs.some(p=>Number(p.weight)>0)}>Siguiente →</Btn></div>
    </Card>}
    {step===3&&origin==="China"&&<Card title="ENTREGA EN DESTINO">
      <div style={{display:"flex",gap:12,marginBottom:16}}>{[{k:"oficina",l:"Retiro por Oficina",sub:"Gratis"},{k:"caba",l:"Envío CABA",sub:"$20"},{k:"gba",l:"Envío a todo el país",sub:"A cotizar"}].map(d=><div key={d.k} onClick={()=>setDelivery(d.k)} style={{flex:1,padding:"14px",textAlign:"center",borderRadius:10,border:`1.5px solid ${delivery===d.k?IC:"rgba(255,255,255,0.08)"}`,background:delivery===d.k?"rgba(96,165,250,0.1)":"transparent",cursor:"pointer"}}><p style={{fontSize:14,fontWeight:700,color:delivery===d.k?IC:"rgba(255,255,255,0.5)",margin:"0 0 2px"}}>{d.l}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.35)",margin:0}}>{d.sub}</p></div>)}</div>
      <div style={{display:"flex",gap:12}}><Btn variant="secondary" onClick={()=>setStep(2)}>← Atrás</Btn><Btn onClick={calculate}>Calcular costos →</Btn></div>
    </Card>}
  </div>;
}

function AdminSettings({token,session}){
  const [curPw,setCurPw]=useState("");const [newPw,setNewPw]=useState("");const [confPw,setConfPw]=useState("");const [msg,setMsg]=useState("");const [err,setErr]=useState("");const [lo,setLo]=useState(false);
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
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 4px"}}>EMAIL</p><p style={{fontSize:14,color:"#fff",margin:0}}>{session.user.email}</p></div>
        <div><p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",margin:"0 0 4px"}}>ROL</p><p style={{fontSize:14,color:IC,margin:0,fontWeight:600}}>Administrador</p></div>
      </div>
    </Card>
  </div>;
}

function QuotesList({token}){
  const [quotes,setQuotes]=useState([]);const [lo,setLo]=useState(true);const [fStatus,setFStatus]=useState("");
  useEffect(()=>{(async()=>{const q=await dq("quotes",{token,filters:"?select=*&order=created_at.desc"});setQuotes(Array.isArray(q)?q:[]);setLo(false);})();},[token]);
  const updateStatus=async(id,status)=>{await dq("quotes",{method:"PATCH",token,filters:`?id=eq.${id}`,body:{status}});setQuotes(p=>p.map(q=>q.id===id?{...q,status}:q));};
  const ST={pending:{l:"Pendiente",c:"#fbbf24"},contacted:{l:"Contactado",c:"#60a5fa"},converted:{l:"Convertida",c:"#22c55e"},rejected:{l:"Rechazada",c:"#f87171"}};
  const filtered=fStatus?quotes.filter(q=>q.status===fStatus):quotes;
  const formatDate=(d)=>new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{fontSize:20,fontWeight:700,color:"#fff",margin:0}}>Cotizaciones ({quotes.length})</h2>
      <div style={{display:"flex",gap:8}}>{[{k:"",l:"Todas"},{k:"pending",l:"Pendientes"},{k:"contacted",l:"Contactados"},{k:"converted",l:"Convertidas"}].map(s=><button key={s.k} onClick={()=>setFStatus(s.k)} style={{padding:"6px 14px",fontSize:11,fontWeight:700,borderRadius:8,border:fStatus===s.k?`1.5px solid ${IC}`:"1.5px solid rgba(255,255,255,0.08)",background:fStatus===s.k?"rgba(96,165,250,0.12)":"rgba(255,255,255,0.03)",color:fStatus===s.k?IC:"rgba(255,255,255,0.4)",cursor:"pointer"}}>{s.l}</button>)}</div>
    </div>
    {lo?<p style={{color:"rgba(255,255,255,0.3)"}}>Cargando...</p>:filtered.length===0?<p style={{color:"rgba(255,255,255,0.25)",textAlign:"center",padding:"2rem 0"}}>No hay cotizaciones</p>:
    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          {["Fecha","Cliente","Origen","Canal","FOB","Costo","Estado","Acción"].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",textTransform:"uppercase"}}>{h}</th>)}
        </tr></thead>
        <tbody>{filtered.map(q=>{const st=ST[q.status]||{l:q.status,c:"#999"};const prods=typeof q.products==="string"?JSON.parse(q.products):q.products;const prodDesc=Array.isArray(prods)?prods.map(p=>p.description||p.type).join(", "):"";
        return <tr key={q.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)",fontSize:12}}>{formatDate(q.created_at)}</td>
          <td style={{padding:"12px 14px"}}><span style={{fontFamily:"monospace",fontWeight:700,color:IC,fontSize:12}}>{q.client_code}</span><br/><span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>{q.client_name}</span></td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.5)"}}>{q.origin}</td>
          <td style={{padding:"12px 14px",color:"rgba(255,255,255,0.6)"}}>{q.channel_name}<br/><span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{prodDesc?.substring(0,40)}</span></td>
          <td style={{padding:"12px 14px",color:"#fff",fontWeight:600}}>USD {Number(q.total_fob||0).toLocaleString()}</td>
          <td style={{padding:"12px 14px",color:IC,fontWeight:700}}>USD {Number(q.total_cost||0).toLocaleString()}</td>
          <td style={{padding:"12px 14px"}}><span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:st.c,background:`${st.c}15`,border:`1px solid ${st.c}33`}}>{st.l}</span></td>
          <td style={{padding:"12px 14px"}}><select value={q.status} onChange={e=>updateStatus(q.id,e.target.value)} style={{padding:"4px 8px",fontSize:11,border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}>{Object.entries(ST).map(([k,v])=><option key={k} value={k} style={{background:"#0a1428"}}>{v.l}</option>)}</select></td>
        </tr>;})}</tbody>
      </table>
    </div>}
  </div>;
}

function AdminDashboard({session,onLogout}){
  const [page,setPage]=useState("operations");const [selOp,setSelOp]=useState(null);const [selClient,setSelClient]=useState(null);const [newOp,setNewOp]=useState(false);const [allClients,setAllClients]=useState([]);
  const token=session.token;
  useEffect(()=>{(async()=>{const c=await dq("clients",{token,filters:"?select=id,first_name,last_name,client_code&order=first_name.asc"});setAllClients(Array.isArray(c)?c:[]);})();},[token]);
  const nav=[{key:"operations",label:"OPERACIONES",p:["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"]},{key:"clients",label:"CLIENTES",p:["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"]},{key:"tariffs",label:"TARIFAS",p:["M18 20V10","M12 20V4","M6 20v-6"]},{key:"calculator",label:"CALCULADORA",p:["M4 4h16v16H4z","M4 8h16","M8 4v16"]},{key:"quotes",label:"COTIZACIONES",p:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6","M16 13H8","M16 17H8"]},{key:"settings",label:"CONFIGURACIÓN",p:["M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z","M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"]}];
  return <div style={{minHeight:"100vh",display:"flex",fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif",background:DARK_BG}}>
    <div style={{width:220,flexShrink:0,background:"rgba(0,0,0,0.3)",borderRight:"1px solid rgba(255,255,255,0.05)",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"20px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}><img src={LOGO} alt="AC" style={{width:"100%",height:"auto",maxHeight:50,objectFit:"contain"}}/></div>
      <div style={{padding:"12px 16px 4px"}}><span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.2)",textTransform:"uppercase",letterSpacing:"0.1em"}}>Administración</span></div>
      <nav style={{flex:1,padding:"4px 8px"}}>{nav.map(item=><button key={item.key} onClick={()=>{setPage(item.key);setSelOp(null);setSelClient(null);setNewOp(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",marginBottom:2,borderRadius:10,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,letterSpacing:"0.04em",background:page===item.key?"rgba(74,144,217,0.15)":"transparent",color:page===item.key?"#fff":"rgba(255,255,255,0.4)",borderLeft:page===item.key?`3px solid ${B.accent}`:"3px solid transparent"}}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={page===item.key?IC:"rgba(255,255,255,0.3)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{item.p.map((d,i)=><path key={i} d={d}/>)}</svg>{item.label}</button>)}</nav>
      <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.05)"}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><div style={{width:36,height:36,borderRadius:"50%",background:"rgba(74,144,217,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,color:IC}}>AD</div><div><p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0}}>Admin</p><p style={{fontSize:11,color:"rgba(255,255,255,0.25)",margin:0}}>{session.user.email}</p></div></div><button onClick={onLogout} style={{width:"100%",padding:"8px",fontSize:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.35)",cursor:"pointer",fontWeight:600}}>Cerrar sesión</button></div>
    </div>
    <div style={{flex:1,overflow:"auto"}}><div style={{maxWidth:1100,margin:"0 auto",padding:"28px 32px"}}>
      {page==="operations"&&!selOp&&!newOp&&<OperationsList token={token} onSelect={setSelOp} onNew={()=>setNewOp(true)}/>}
      {page==="operations"&&selOp&&<OperationEditor op={selOp} token={token} onBack={()=>setSelOp(null)} onDelete={()=>setSelOp(null)}/>}
      {page==="operations"&&newOp&&<NewOperation token={token} clients={allClients} onBack={()=>setNewOp(false)} onCreated={op=>{setNewOp(false);setSelOp(op);}}/>}
      {page==="clients"&&!selClient&&<ClientsList token={token} onSelect={setSelClient}/>}
      {page==="clients"&&selClient&&<ClientDetail client={selClient} token={token} onBack={()=>setSelClient(null)} onSelectOp={op=>{setPage("operations");setSelClient(null);setSelOp(op);}} onDelete={()=>setSelClient(null)}/>}
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
  if(!session)return <AdminLogin onLogin={s=>{setSession(s);}}/>;
  return <AdminDashboard session={session} onLogout={logout}/>;
}
