"use client";
import { useState, useEffect } from "react";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const LOGO=`${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
const IC="#60a5fa";
const BG="linear-gradient(160deg,#030810 0%,#071428 40%,#091b34 70%,#040e1c 100%)";
const sf=async(p,o={})=>{const r=await fetch(`${SB_URL}${p}`,{...o,headers:{apikey:SB_KEY,"Content-Type":"application/json",...(o.headers||{})}});return r.json();};
const ac=async(e,b)=>sf(`/auth/v1/${e}`,{method:"POST",body:JSON.stringify(b)});
const dq=async(t,{method="GET",body,token,filters=""})=>sf(`/rest/v1/${t}${filters}`,{method,body:body?JSON.stringify(body):undefined,headers:{Authorization:`Bearer ${token}`,...(method==="POST"?{Prefer:"return=representation"}:{})}});
const saveSession=(d)=>{try{localStorage.setItem("ac_agent_s",JSON.stringify(d));}catch(e){}};
const loadSession=()=>{try{const d=localStorage.getItem("ac_agent_s");return d?JSON.parse(d):null;}catch(e){return null;}};
const clearSession=()=>{try{localStorage.removeItem("ac_agent_s");}catch(e){}};

// i18n
const I18N={
  es:{
    login_title:"Portal Agente",
    login_subtitle:"Iniciá sesión para registrar paquetes",
    email:"Email",
    password:"Contraseña",
    first_name:"Nombre",
    last_name:"Apellido",
    country:"País",
    login:"Iniciar sesión",
    signup:"Registrarse",
    to_signup:"¿No tenés cuenta? Registrate",
    to_login:"¿Ya tenés cuenta? Iniciá sesión",
    pending_title:"Cuenta pendiente de aprobación",
    pending_msg:"Tu registro fue enviado al administrador. Te avisaremos cuando esté aprobado.",
    rejected_msg:"Tu solicitud fue rechazada. Contactá al administrador.",
    logout:"Cerrar sesión",
    register_pkg:"Registrar paquete",
    new_package:"Nuevo paquete",
    client_code:"Código de cliente",
    client_code_ph:"Ej: FAIVOR",
    client_found:"Cliente encontrado",
    client_not_found:"Código no encontrado",
    consolidation_info:"Tiene op abierta. El bulto se agregará a ella:",
    new_op_info:"Se creará una operación nueva para este cliente",
    tracking:"Tracking",
    tracking_ph:"Ej: ECZEN31902219401",
    weight:"Peso (kg)",
    length:"Largo (cm)",
    width:"Ancho (cm)",
    height:"Alto (cm)",
    save:"Guardar bulto",
    saving:"Guardando...",
    cancel:"Cancelar",
    recent_pkgs:"Paquetes registrados",
    no_pkgs:"Aún no registraste paquetes",
    op:"Operación",
    client:"Cliente",
    date:"Fecha",
    err_generic:"Error, intentá de nuevo",
    err_client:"Seleccioná un cliente",
    err_tracking:"Ingresá un tracking",
    success:"Paquete registrado correctamente",
    hello:"Hola",
    active_in:"Activo en",
    select_client:"Seleccioná un cliente",
    search_client:"Buscar por código o nombre...",
    unregistered_client:"Cliente no registrado",
    unregistered_info:"El paquete quedará sin asignar. Argencargo lo asignará después.",
    bultos:"Bultos",
    add_bulto:"+ Agregar otro bulto",
    bulto_n:"Bulto",
    remove:"Quitar"
  },
  zh:{
    login_title:"代理门户",
    login_subtitle:"登录以注册包裹",
    email:"电子邮件",
    password:"密码",
    first_name:"名字",
    last_name:"姓氏",
    country:"国家",
    login:"登录",
    signup:"注册",
    to_signup:"没有账户？注册",
    to_login:"已有账户？登录",
    pending_title:"账户待批准",
    pending_msg:"您的注册已发送给管理员。批准后我们会通知您。",
    rejected_msg:"您的申请已被拒绝。请联系管理员。",
    logout:"退出登录",
    register_pkg:"注册包裹",
    new_package:"新包裹",
    client_code:"客户代码",
    client_code_ph:"例如：FAIVOR",
    client_found:"客户已找到",
    client_not_found:"未找到代码",
    consolidation_info:"该客户有开放的操作。此包裹将添加到:",
    new_op_info:"将为该客户创建新操作",
    tracking:"物流单号",
    tracking_ph:"例如：ECZEN31902219401",
    weight:"重量 (公斤)",
    length:"长 (厘米)",
    width:"宽 (厘米)",
    height:"高 (厘米)",
    save:"保存包裹",
    saving:"保存中...",
    cancel:"取消",
    recent_pkgs:"已注册的包裹",
    no_pkgs:"还没有注册包裹",
    op:"操作",
    client:"客户",
    date:"日期",
    err_generic:"错误，请重试",
    err_client:"选择客户",
    err_tracking:"输入物流单号",
    success:"包裹注册成功",
    hello:"你好",
    active_in:"活跃于",
    select_client:"选择客户",
    search_client:"按代码或姓名搜索...",
    unregistered_client:"未注册的客户",
    unregistered_info:"包裹将保持未分配状态。Argencargo稍后将分配它。",
    bultos:"包裹",
    add_bulto:"+ 添加另一个包裹",
    bulto_n:"包裹",
    remove:"删除"
  }
};

function Inp({label,type="text",value,onChange,placeholder,req}){return <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",marginBottom:5}}>{label}{req&&<span style={{color:"#ff6b6b"}}> *</span>}</label><input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}} onFocus={e=>{e.target.style.borderColor=IC;}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";}}/></div>;}

function Btn({children,onClick,disabled,variant="primary",type="button"}){const bg=variant==="secondary"?"rgba(255,255,255,0.06)":`linear-gradient(135deg,${B_ACCENT},${B_PRIMARY})`;return <button type={type} onClick={onClick} disabled={disabled} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:700,border:variant==="secondary"?"1.5px solid rgba(255,255,255,0.12)":"none",borderRadius:10,cursor:disabled?"not-allowed":"pointer",background:disabled?"rgba(255,255,255,0.06)":bg,color:disabled?"rgba(255,255,255,0.3)":"#fff",opacity:disabled?0.6:1}}>{children}</button>;}

const B_PRIMARY="#1B4F8A",B_ACCENT="#4A90D9";

function LangToggle({lang,setLang}){return <div style={{display:"inline-flex",gap:4,background:"rgba(255,255,255,0.06)",borderRadius:8,padding:3}}>{["es","zh"].map(l=><button key={l} onClick={()=>setLang(l)} style={{padding:"5px 12px",fontSize:12,fontWeight:700,border:"none",borderRadius:6,cursor:"pointer",background:lang===l?IC:"transparent",color:lang===l?"#fff":"rgba(255,255,255,0.5)"}}>{l==="es"?"🇦🇷 ES":"🇨🇳 中文"}</button>)}</div>;}

export default function AgentePortal(){
  const [session,setSession]=useState(null);
  const [loading,setLoading]=useState(true);
  const [lang,setLang]=useState("es");
  const t=I18N[lang];
  useEffect(()=>{const s=loadSession();if(s?.access_token){setSession(s);}setLoading(false);const savedLang=typeof window!=="undefined"?localStorage.getItem("ac_agent_lang"):null;if(savedLang==="zh"||savedLang==="es")setLang(savedLang);},[]);
  useEffect(()=>{try{localStorage.setItem("ac_agent_lang",lang);}catch(e){}},[lang]);
  if(loading)return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,color:"rgba(255,255,255,0.4)"}}>Cargando...</div>;
  if(!session)return <AuthScreen onLogin={setSession} lang={lang} setLang={setLang} t={t}/>;
  return <Dashboard session={session} onLogout={()=>{clearSession();setSession(null);}} lang={lang} setLang={setLang} t={t}/>;
}

function AuthScreen({onLogin,lang,setLang,t}){
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [fName,setFName]=useState("");const [lName,setLName]=useState("");
  const [err,setErr]=useState("");const [lo,setLo]=useState(false);
  const ensureSignup=async(token,userId)=>{
    // Si ya existe agent_signup, no crear duplicado
    const existing=await dq("agent_signups",{token,filters:`?auth_user_id=eq.${userId}&select=id&limit=1`});
    if(Array.isArray(existing)&&existing.length>0)return;
    await dq("agent_signups",{method:"POST",token,body:{auth_user_id:userId,email,first_name:fName||"",last_name:lName||"",language:lang,status:"pending"}});
  };
  const login=async()=>{if(!email||!pass){setErr(t.err_generic);return;}setLo(true);setErr("");
    const r=await ac("token?grant_type=password",{email,password:pass});
    if(r.access_token){const sess={access_token:r.access_token,user:r.user};saveSession(sess);onLogin(sess);}
    else setErr(r.error_description||r.msg||r.message||t.err_generic);
    setLo(false);};
  const signup=async()=>{if(!email||!pass||!fName){setErr(t.err_generic);return;}setLo(true);setErr("");
    // Importante: no mandar role inválido, el trigger castea a user_role enum (admin/agente/cliente). Default: cliente. Después al aprobar se cambia a agente.
    const r=await ac("signup",{email,password:pass,data:{first_name:fName,last_name:lName}});
    // Si error pero el mail ya existe → intentar login con esas credenciales
    const errMsg=(r.error_description||r.msg||r.message||r.error||"").toString().toLowerCase();
    if(errMsg.includes("already")||errMsg.includes("registered")||errMsg.includes("user already")){
      // Intentar login: si la pass es correcta, lo dejamos pasar y creamos el agent_signup
      const l=await ac("token?grant_type=password",{email,password:pass});
      if(l.access_token){
        await ensureSignup(l.access_token,l.user.id);
        const sess={access_token:l.access_token,user:l.user};saveSession(sess);onLogin(sess);
      } else {
        setErr("Ya existe una cuenta con ese email. Probá iniciar sesión o usar otro email.");
      }
      setLo(false);return;
    }
    if(r.access_token||r.user){
      const userId=r.user?.id;
      const token=r.access_token;
      if(token&&userId){await ensureSignup(token,userId);}
      // Intentar login inmediato (por si signup no devolvió token)
      const l=await ac("token?grant_type=password",{email,password:pass});
      if(l.access_token){
        if(!token)await ensureSignup(l.access_token,l.user.id);
        const sess={access_token:l.access_token,user:l.user};saveSession(sess);onLogin(sess);
      } else {
        // Email confirmation activado en Supabase
        setErr("Cuenta creada. Confirmá el email para poder ingresar (revisá tu casilla).");
      }
    } else {
      setErr(r.error_description||r.msg||r.message||t.err_generic);
    }
    setLo(false);};
  return <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1rem",fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif"}}>
    <div style={{maxWidth:420,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <img src={LOGO} alt="AC" style={{width:200,height:"auto"}}/>
      </div>
      <div style={{textAlign:"center",marginBottom:18}}><LangToggle lang={lang} setLang={setLang}/></div>
      <div style={{background:"rgba(8,18,35,0.85)",backdropFilter:"blur(24px)",borderRadius:20,padding:"2rem 1.75rem",border:"1px solid rgba(255,255,255,0.06)",boxShadow:"0 30px 60px rgba(0,0,0,0.5)"}}>
        <h2 style={{fontSize:22,fontWeight:700,color:"#fff",margin:"0 0 6px",textAlign:"center"}}>{t.login_title}</h2>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:"0 0 22px",textAlign:"center"}}>{t.login_subtitle}</p>
        {err&&<div style={{padding:"10px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:10,fontSize:13,color:"#ff6b6b",marginBottom:14}}>{err}</div>}
        {mode==="signup"&&<>
          <Inp label={t.first_name} value={fName} onChange={setFName} req/>
          <Inp label={t.last_name} value={lName} onChange={setLName}/>
        </>}
        <Inp label={t.email} type="email" value={email} onChange={setEmail} req/>
        <Inp label={t.password} type="password" value={pass} onChange={setPass} req/>
        <div style={{marginTop:8}}><Btn onClick={mode==="login"?login:signup} disabled={lo}>{lo?"...":(mode==="login"?t.login:t.signup)}</Btn></div>
        <p onClick={()=>{setMode(mode==="login"?"signup":"login");setErr("");}} style={{fontSize:12,color:IC,textAlign:"center",margin:"14px 0 0",cursor:"pointer",fontWeight:600}}>{mode==="login"?t.to_signup:t.to_login}</p>
      </div>
    </div>
  </div>;
}

function Dashboard({session,onLogout,lang,setLang,t}){
  const token=session.access_token;
  const userId=session.user?.id;
  const [signup,setSignup]=useState(null);
  const [loading,setLoading]=useState(true);
  const [packages,setPackages]=useState([]);
  const [showForm,setShowForm]=useState(false);
  const [flashMsg,setFlashMsg]=useState("");

  useEffect(()=>{(async()=>{
    // Check signup status
    const sgn=await dq("agent_signups",{token,filters:`?auth_user_id=eq.${userId}&select=*&limit=1`});
    const s=Array.isArray(sgn)&&sgn[0]?sgn[0]:null;
    setSignup(s);
    if(s?.status==="approved"){
      const pk=await dq("operation_packages",{token,filters:"?select=*,operations!inner(operation_code,client_id,clients(client_code,first_name))&order=created_at.desc&limit=20"});
      setPackages(Array.isArray(pk)?pk:[]);
    }
    setLoading(false);
  })();},[token,userId]);

  const reloadPackages=async()=>{
    const pk=await dq("operation_packages",{token,filters:"?select=*,operations!inner(operation_code,client_id,clients(client_code,first_name))&order=created_at.desc&limit=20"});
    setPackages(Array.isArray(pk)?pk:[]);
  };

  const flash=(m)=>{setFlashMsg(m);setTimeout(()=>setFlashMsg(""),3000);};

  if(loading)return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,color:"rgba(255,255,255,0.4)"}}>...</div>;

  if(!signup||signup.status==="pending"){
    return <SimpleShell lang={lang} setLang={setLang} t={t} onLogout={onLogout}>
      <div style={{maxWidth:600,margin:"3rem auto",background:"rgba(251,191,36,0.08)",border:"1.5px solid rgba(251,191,36,0.3)",borderRadius:16,padding:"2rem",textAlign:"center"}}>
        <p style={{fontSize:48,margin:"0 0 12px"}}>⏳</p>
        <h2 style={{fontSize:20,fontWeight:700,color:"#fbbf24",margin:"0 0 10px"}}>{t.pending_title}</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",margin:0}}>{t.pending_msg}</p>
      </div>
    </SimpleShell>;
  }

  if(signup.status==="rejected"){
    return <SimpleShell lang={lang} setLang={setLang} t={t} onLogout={onLogout}>
      <div style={{maxWidth:600,margin:"3rem auto",background:"rgba(255,80,80,0.08)",border:"1.5px solid rgba(255,80,80,0.3)",borderRadius:16,padding:"2rem",textAlign:"center"}}>
        <p style={{fontSize:48,margin:"0 0 12px"}}>✕</p>
        <h2 style={{fontSize:20,fontWeight:700,color:"#ff6b6b",margin:"0 0 10px"}}>Rejected</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",margin:0}}>{t.rejected_msg}</p>
      </div>
    </SimpleShell>;
  }

  return <SimpleShell lang={lang} setLang={setLang} t={t} onLogout={onLogout}>
    <div style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
      <div>
        <h2 style={{fontSize:22,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>{t.hello}, {signup.first_name||signup.email}</h2>
        <p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0}}>🟢 {t.active_in} {signup.country||"China"}</p>
      </div>
      {!showForm&&<Btn onClick={()=>setShowForm(true)}>+ {t.register_pkg}</Btn>}
    </div>
    {flashMsg&&<div style={{padding:"10px 14px",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:10,fontSize:13,color:"#22c55e",marginBottom:16}}>{flashMsg}</div>}
    {showForm&&<NewPackageForm token={token} lang={lang} t={t} agentId={userId} onCancel={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);reloadPackages();flash(t.success);}}/>}
    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",overflow:"hidden",marginTop:16}}>
      <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>{t.recent_pkgs} ({packages.length})</h3></div>
      {packages.length===0?<p style={{padding:"2rem",textAlign:"center",color:"rgba(255,255,255,0.3)",margin:0}}>{t.no_pkgs}</p>:
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          {[t.op,t.client,t.tracking,t.weight,t.date].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",textTransform:"uppercase"}}>{h}</th>)}
        </tr></thead>
        <tbody>{packages.map(p=><tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <td style={{padding:"10px 14px",fontFamily:"monospace",fontWeight:600,color:"#fff"}}>{p.operations?.operation_code||"—"}</td>
          <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.7)"}}>{p.operations?.clients?.client_code||"—"}</td>
          <td style={{padding:"10px 14px",fontFamily:"monospace",fontSize:12,color:"rgba(255,255,255,0.6)"}}>{p.national_tracking||"—"}</td>
          <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.5)"}}>{p.gross_weight_kg?`${Number(p.gross_weight_kg).toFixed(2)} kg`:"—"}</td>
          <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.4)",fontSize:11}}>{new Date(p.created_at).toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</td>
        </tr>)}</tbody>
      </table>}
    </div>
  </SimpleShell>;
}

function SimpleShell({children,lang,setLang,t,onLogout}){
  return <div style={{minHeight:"100vh",background:BG,fontFamily:"'Segoe UI','Helvetica Neue',Arial,sans-serif"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 24px",background:"rgba(0,0,0,0.25)",borderBottom:"1px solid rgba(255,255,255,0.05)",flexWrap:"wrap",gap:12}}>
      <img src={LOGO} alt="AC" style={{height:36,objectFit:"contain"}}/>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <LangToggle lang={lang} setLang={setLang}/>
        <button onClick={onLogout} style={{padding:"7px 14px",fontSize:12,background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:8,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:600}}>{t.logout}</button>
      </div>
    </div>
    <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 24px"}}>{children}</div>
  </div>;
}

function NewPackageForm({token,lang,t,agentId,onCancel,onSaved}){
  const [allClients,setAllClients]=useState([]);
  const [clientSearch,setClientSearch]=useState("");
  const [clientId,setClientId]=useState("");// "" = no seleccionado, "unregistered" = no registrado, uuid = cliente
  const [showDrop,setShowDrop]=useState(false);
  const [existingOp,setExistingOp]=useState(null);
  const [tracking,setTracking]=useState("");
  const [bultos,setBultos]=useState([{weight:"",length:"",width:"",height:""}]);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");

  // Cargar todos los clientes
  useEffect(()=>{(async()=>{const cl=await dq("clients",{token,filters:"?select=id,first_name,last_name,client_code&order=client_code.asc"});setAllClients(Array.isArray(cl)?cl:[]);})();},[token]);

  const selectedClient=allClients.find(c=>c.id===clientId);

  // Filtro de búsqueda
  const filtered=clientSearch.trim()?allClients.filter(c=>{const s=clientSearch.toLowerCase();return c.client_code?.toLowerCase().includes(s)||c.first_name?.toLowerCase().includes(s)||c.last_name?.toLowerCase().includes(s);}).slice(0,50):allClients.slice(0,50);

  // Buscar op abierta cuando se selecciona cliente
  useEffect(()=>{if(!clientId||clientId==="unregistered"){setExistingOp(null);return;}(async()=>{
    const ops=await dq("operations",{token,filters:`?client_id=eq.${clientId}&channel=eq.aereo_blanco&status=in.(en_deposito_origen,en_preparacion)&consolidation_confirmed=eq.false&select=id,operation_code,status&order=created_at.desc&limit=1`});
    setExistingOp(Array.isArray(ops)&&ops[0]?ops[0]:null);
  })();},[clientId,token]);

  const addBulto=()=>setBultos(p=>[...p,{weight:"",length:"",width:"",height:""}]);
  const rmBulto=(i)=>setBultos(p=>p.filter((_,j)=>j!==i));
  const chBulto=(i,f,v)=>setBultos(p=>p.map((b,j)=>j===i?{...b,[f]:v}:b));

  const save=async()=>{
    if(!clientId){setErr(t.err_client);return;}
    if(!tracking?.trim()){setErr(t.err_tracking);return;}
    setErr("");setSaving(true);
    try {
      const validBultos=bultos.filter(b=>b.weight||b.length||b.width||b.height||true); // todos cuentan, opcional
      if(clientId==="unregistered"){
        // Insertar en unassigned_packages, una entry por bulto
        for(let i=0;i<validBultos.length;i++){const b=validBultos[i];const body={national_tracking:tracking.trim(),package_number:i+1,quantity:1,registered_by_agent_id:agentId};
          if(b.weight)body.gross_weight_kg=Number(b.weight);if(b.length)body.length_cm=Number(b.length);if(b.width)body.width_cm=Number(b.width);if(b.height)body.height_cm=Number(b.height);
          await dq("unassigned_packages",{method:"POST",token,body});
        }
        onSaved();return;
      }
      // Cliente registrado
      let opId;
      if(existingOp){opId=existingOp.id;}
      else {
        const lastOps=await dq("operations",{token,filters:"?select=operation_code&order=operation_code.desc&limit=1"});
        const lastCode=Array.isArray(lastOps)&&lastOps[0]?lastOps[0].operation_code:"AC-0000";
        const n=parseInt(lastCode.replace(/\D/g,""),10)||0;
        const newCode=`AC-${String(n+1).padStart(4,"0")}`;
        const r=await dq("operations",{method:"POST",token,body:{operation_code:newCode,client_id:clientId,channel:"aereo_blanco",status:"en_deposito_origen",origin:"China",created_by_agent_id:agentId}});
        const created=Array.isArray(r)?r[0]:r;
        if(!created?.id){setErr(t.err_generic);setSaving(false);return;}
        opId=created.id;
      }
      const pkgs=await dq("operation_packages",{token,filters:`?operation_id=eq.${opId}&select=package_number&order=package_number.desc&limit=1`});
      const lastNum=Array.isArray(pkgs)&&pkgs[0]?Number(pkgs[0].package_number)||0:0;
      for(let i=0;i<validBultos.length;i++){const b=validBultos[i];const body={operation_id:opId,package_number:lastNum+i+1,quantity:1,national_tracking:tracking.trim()};
        if(b.weight)body.gross_weight_kg=Number(b.weight);if(b.length)body.length_cm=Number(b.length);if(b.width)body.width_cm=Number(b.width);if(b.height)body.height_cm=Number(b.height);
        await dq("operation_packages",{method:"POST",token,body});
      }
      onSaved();
    } catch(e){console.error(e);setErr(t.err_generic);}
    setSaving(false);
  };

  return <div style={{background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1.5px solid rgba(96,165,250,0.25)",padding:"1.5rem"}}>
    <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 18px"}}>{t.new_package}</h3>
    {err&&<div style={{padding:"10px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:10,fontSize:13,color:"#ff6b6b",marginBottom:14}}>{err}</div>}

    <div style={{marginBottom:14,position:"relative"}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",marginBottom:5}}>{t.select_client}<span style={{color:"#ff6b6b"}}> *</span></label>
      <button type="button" onClick={()=>setShowDrop(!showDrop)} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:selectedClient||clientId==="unregistered"?"#fff":"rgba(255,255,255,0.4)",outline:"none",textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>{clientId==="unregistered"?`📦 ${t.unregistered_client}`:selectedClient?`${selectedClient.client_code} - ${selectedClient.first_name||""} ${selectedClient.last_name||""}`:t.select_client}</span>
        <span>{showDrop?"▲":"▼"}</span>
      </button>
      {showDrop&&<div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,background:"#0a1428",border:"1.5px solid rgba(96,165,250,0.3)",borderRadius:10,maxHeight:300,overflow:"auto",zIndex:10,boxShadow:"0 10px 30px rgba(0,0,0,0.5)"}}>
        <div style={{padding:8,borderBottom:"1px solid rgba(255,255,255,0.06)"}}><input value={clientSearch} onChange={e=>setClientSearch(e.target.value)} placeholder={t.search_client} autoFocus style={{width:"100%",padding:"8px 10px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/></div>
        <button type="button" onClick={()=>{setClientId("unregistered");setShowDrop(false);setClientSearch("");}} style={{display:"block",width:"100%",padding:"10px 14px",fontSize:13,fontWeight:600,border:"none",background:clientId==="unregistered"?"rgba(96,165,250,0.15)":"transparent",color:"#fbbf24",cursor:"pointer",textAlign:"left",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>📦 {t.unregistered_client}</button>
        {filtered.map(c=><button key={c.id} type="button" onClick={()=>{setClientId(c.id);setShowDrop(false);setClientSearch("");}} style={{display:"block",width:"100%",padding:"10px 14px",fontSize:13,border:"none",background:clientId===c.id?"rgba(96,165,250,0.15)":"transparent",color:"#fff",cursor:"pointer",textAlign:"left"}}>
          <span style={{fontFamily:"monospace",fontWeight:700,color:IC}}>{c.client_code}</span>
          <span style={{color:"rgba(255,255,255,0.5)",marginLeft:8}}>{c.first_name||""} {c.last_name||""}</span>
        </button>)}
        {filtered.length===0&&<p style={{padding:"10px 14px",fontSize:12,color:"rgba(255,255,255,0.3)",margin:0}}>{t.client_not_found}</p>}
      </div>}
    </div>

    {clientId==="unregistered"&&<div style={{padding:"10px 14px",background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:10,marginBottom:14}}>
      <p style={{fontSize:12,color:"#fbbf24",margin:0,fontWeight:600}}>⚠ {t.unregistered_info}</p>
    </div>}
    {selectedClient&&existingOp&&<div style={{padding:"10px 14px",background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:10,marginBottom:14}}>
      <p style={{fontSize:12,color:IC,margin:0,fontWeight:600}}>ℹ {t.consolidation_info} <strong>{existingOp.operation_code}</strong></p>
    </div>}
    {selectedClient&&!existingOp&&<div style={{padding:"10px 14px",background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:10,marginBottom:14}}>
      <p style={{fontSize:12,color:IC,margin:0,fontWeight:600}}>ℹ {t.new_op_info}</p>
    </div>}

    <Inp label={t.tracking} value={tracking} onChange={setTracking} placeholder={t.tracking_ph} req/>

    <div style={{marginTop:8,marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 10px",textTransform:"uppercase"}}>{t.bultos} ({bultos.length})</p>
      {bultos.map((b,i)=><div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:11,fontWeight:700,color:IC}}>{t.bulto_n} {i+1}</span>
          {bultos.length>1&&<button type="button" onClick={()=>rmBulto(i)} style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer",fontWeight:600}}>{t.remove}</button>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 10px"}}>
          <Inp label={t.weight} type="number" value={b.weight} onChange={v=>chBulto(i,"weight",v)} placeholder="12.5"/>
          <Inp label={t.length} type="number" value={b.length} onChange={v=>chBulto(i,"length",v)} placeholder="45"/>
          <Inp label={t.width} type="number" value={b.width} onChange={v=>chBulto(i,"width",v)} placeholder="30"/>
          <Inp label={t.height} type="number" value={b.height} onChange={v=>chBulto(i,"height",v)} placeholder="25"/>
        </div>
      </div>)}
      <button type="button" onClick={addBulto} style={{width:"100%",padding:"10px",fontSize:12,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(96,165,250,0.3)",background:"rgba(96,165,250,0.05)",color:IC,cursor:"pointer"}}>{t.add_bulto}</button>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12,marginTop:10}}>
      <Btn variant="secondary" onClick={onCancel}>{t.cancel}</Btn>
      <Btn onClick={save} disabled={saving||!clientId||!tracking}>{saving?t.saving:t.save}</Btn>
    </div>
  </div>;
}
