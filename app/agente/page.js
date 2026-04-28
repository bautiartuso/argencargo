"use client";
import { useState, useEffect, useRef } from "react";
import { ToastStack, toast, SkeletonTable, EmptyState } from "../../lib/ui";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const LOGO=`${SB_URL}/storage/v1/object/public/assets/logo_argencargo.png`;
const BG="linear-gradient(160deg,#0F1E3D 0%,#152849 50%,#0F1E3D 100%)";
const GOLD="#B8956A", GOLD_LIGHT="#E8D098", GOLD_DEEP="#A68456";
const IC=GOLD_LIGHT; // Accent alias oro claro
const GOLD_GRADIENT="linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";
const GOLD_GLOW="0 0 20px rgba(184,149,106,0.25)";
const GOLD_GLOW_STRONG="0 0 28px rgba(184,149,106,0.4)";
const AC_KEYFRAMES=`@keyframes ac_fade_in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`;
const sf=async(p,o={})=>{const r=await fetch(`${SB_URL}${p}`,{...o,headers:{apikey:SB_KEY,"Content-Type":"application/json",...(o.headers||{})}});return {status:r.status,body:await r.json().catch(()=>null)};};
const sfJson=async(p,o={})=>{const r=await sf(p,o);return r.body;};
const ac=async(e,b)=>sfJson(`/auth/v1/${e}`,{method:"POST",body:JSON.stringify(b)});
// JWT exp (ms). 0 si falla.
const jwtExp=(t)=>{try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).exp*1000;}catch{return 0;}};
// Token refresh: intenta renovar con refresh_token si la request falla 401 (o proactivamente si vence pronto).
let _refreshingPromise=null;
const refreshToken=async()=>{
  if(_refreshingPromise)return _refreshingPromise;
  _refreshingPromise=(async()=>{
    const s=loadSession();if(!s?.refresh_token)return null;
    const r=await ac("token?grant_type=refresh_token",{refresh_token:s.refresh_token});
    if(r?.access_token){const ns={access_token:r.access_token,refresh_token:r.refresh_token||s.refresh_token,user:r.user||s.user};saveSession(ns);return ns.access_token;}
    clearSession();if(typeof window!=="undefined")window.location.reload();return null;
  })();
  try{return await _refreshingPromise;}finally{_refreshingPromise=null;}
};
const ensureFreshToken=async(token)=>{
  const exp=jwtExp(token);
  if(exp&&Date.now()>exp-60000){
    const s=loadSession();
    if(s?.access_token&&jwtExp(s.access_token)>Date.now()+60000)return s.access_token;
    const nt=await refreshToken();if(nt)return nt;
  }
  return token;
};
const dq=async(t,{method="GET",body,token,filters=""})=>{
  const fresh=await ensureFreshToken(token);
  const doReq=(tk)=>sf(`/rest/v1/${t}${filters}`,{method,body:body?JSON.stringify(body):undefined,headers:{Authorization:`Bearer ${tk}`,...(method==="POST"?{Prefer:"return=representation"}:{})}});
  let r=await doReq(fresh);
  // Si JWT expirado (401) → refresh y retry
  if(r.status===401){const newToken=await refreshToken();if(newToken){r=await doReq(newToken);}}
  return r.body;
};
const saveSession=(d)=>{try{localStorage.setItem("ac_agent_s",JSON.stringify(d));}catch(e){}};
const loadSession=()=>{try{const d=localStorage.getItem("ac_agent_s");return d?JSON.parse(d):null;}catch(e){return null;}};

// Upload a photo (File) to the package-photos storage bucket. Returns public URL or null on failure.
const uploadPackagePhoto=async(file,token)=>{
  if(!file)return null;
  const ext=(file.name?.split(".").pop()||"jpg").toLowerCase();
  const path=`${Date.now()}_${Math.random().toString(36).slice(2,9)}.${ext}`;
  const fresh=await ensureFreshToken(token);
  const r=await fetch(`${SB_URL}/storage/v1/object/package-photos/${path}`,{
    method:"POST",
    headers:{Authorization:`Bearer ${fresh}`,apikey:SB_KEY,"Content-Type":file.type||"image/jpeg"},
    body:file
  });
  if(!r.ok){console.error("upload failed",await r.text());return null;}
  return `${SB_URL}/storage/v1/object/public/package-photos/${path}`;
};
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
    remove:"Quitar",
    tab_deposit:"Depósito",
    tab_active_flights:"Vuelos activos",
    tab_history:"Histórico",
    tab_stats:"Estadísticas",
    tab_account:"Mi cuenta",
    flight:"Vuelo",
    flight_status_preparando:"Preparando",
    flight_status_listo:"Listo para enviar",
    flight_status_despachado:"Despachado",
    flight_status_recibido:"Recibido",
    no_flights:"Aún no tenés vuelos asignados",
    invoice:"Factura de exportación",
    no_invoice_yet:"El admin todavía no subió la factura",
    ready_to_ship:"🚀 LISTO PARA ENVIAR — completá los datos",
    waiting_invoice:"⏳ Esperando factura de Argencargo",
    weight_from_packages:"Peso total (calculado desde los bultos)",
    download_invoice:"Descargar factura",
    destination:"Dirección de destino",
    no_destination_yet:"El admin todavía no cargó la dirección",
    dest_name:"Nombre",
    dest_taxid:"CUIT/DNI",
    dest_address:"Dirección",
    dest_postal:"Código Postal",
    dest_phone:"Teléfono",
    dest_email:"Email",
    push_title:"Notificaciones en este dispositivo",
    push_subtitle_on:"Recibís avisos directo al celular cuando admin crea/despacha vuelos.",
    push_subtitle_off:"Activá las notificaciones para recibir avisos al instante. Sin apps externas.",
    push_enable:"Activar",
    push_test:"Probar",
    push_test_title:"Test Argencargo",
    push_test_body:"Notificaciones funcionando ✅",
    push_test_ok:"Enviada — revisá tu celular",
    push_no_subs:"No hay dispositivos suscritos",
    push_enabled:"Notificaciones activadas",
    push_denied:"Permiso denegado. Habilitalo en ajustes del navegador.",
    push_unsupported:"Tu navegador no soporta notificaciones. Usá Chrome o Edge en Android, o Safari en iOS 16.4+.",
    push_nag_title:"Activá las notificaciones",
    push_nag_msg:"Necesarias para recibir avisos cuando admin crea o despacha vuelos.",
    push_nag_denied_title:"Notificaciones bloqueadas",
    push_nag_denied_msg:"Activalas desde los ajustes del navegador para recibir avisos de nuevos vuelos.",
    push_activate_now:"Activar ahora",
    push_ios_install_title:"Instalá la app en tu pantalla de inicio",
    push_ios_install_msg:"En iPhone, las notificaciones solo funcionan después de instalar la app desde el menú compartir de Safari.",
    push_ios_step1:"Tocá el botón de compartir en la barra inferior de Safari",
    push_ios_step2:"Buscá y tocá «Agregar a inicio» (Add to Home Screen)",
    push_ios_step3:"Abrí Argencargo desde el ícono que apareció en tu home — NO desde Safari",
    push_ios_step4:"Volvé acá y aparecerá el botón para activar notificaciones",
    push_android_install_title:"Instalá la app en tu pantalla de inicio",
    push_android_install_msg:"Para recibir notificaciones, primero instalá la app desde Chrome.",
    push_android_install_btn:"📥 Instalar app",
    push_android_step1:"Tocá los 3 puntos arriba a la derecha en Chrome",
    push_android_step2:"Tocá «Instalar app» o «Agregar a pantalla principal»",
    push_android_step3:"Abrí Argencargo desde el ícono que apareció — NO desde Chrome",
    push_android_step4:"Volvé acá y se activarán las notificaciones automáticamente",
    save:"Guardar",
    scan:"Escanear",
    scan_tracking:"Sacar foto al sticker para detectar tracking",
    scan_detected:"Detectado",
    scan_not_found:"No se detectó tracking. Cargalo a mano.",
    operations_in_flight:"Operaciones del vuelo",
    dispatch_form:"Despachar vuelo",
    total_weight:"Peso total (kg)",
    total_cost:"Costo total (USD)",
    intl_tracking:"Tracking internacional",
    courier:"Courier",
    payment_method_label:"Método de pago",
    method_cc:"Cuenta corriente",
    method_cash:"Contado",
    method_transfer:"Transferencia",
    confirm_dispatch:"Confirmar despacho",
    dispatch_warning:"Una vez confirmado, no podrás editar el vuelo. Las ops cambiarán a 'En tránsito'.",
    balance:"Saldo",
    no_movements:"Sin movimientos",
    movement_anticipo:"Anticipo",
    movement_deduccion:"Deducción",
    stats_current_deposit:"En depósito ahora",
    stats_total_pkgs:"Paquetes totales recibidos",
    stats_flights_completed:"Vuelos completados",
    stats_total_kg:"Kg despachados",
    stats_total_usd:"Total facturado",
    cc_type:"Tipo",
    cc_amount:"Monto",
    cc_description:"Descripción",
    search_deposit:"Buscar en depósito...",
    confirm:"Confirmar",
    photo:"Foto",
    photo_required:"Foto de la mercadería",
    upload_photo:"Subir foto",
    take_photo:"Tomar foto",
    skip_photo:"Sin foto (cargar después)",
    photo_pending:"Foto pendiente",
    photo_pending_msg:"Recordá subir la foto cuando puedas. Se mostrará al admin y al cliente.",
    photos_pending_count:"paquete(s) pendiente(s) de foto",
    add_photo:"Agregar foto",
    photo_help:"Sacá una foto clara o subí una desde la galería (JPG/PNG, máx 5MB).",
    weight_gross_short:"Bruto",
    weight_vol_short:"Volumétrico",
    weight_billable_short:"Facturable",
    period:"Período",
    period_week:"Semana",
    period_month:"Mes",
    period_year:"Año",
    period_all:"Total",
    delete:"Eliminar",
    delete_success:"Paquete eliminado",
    confirm_delete_pkg:"¿Eliminar el paquete de la operación",
    flight_waiting_msg:"Cuando el admin presente la factura de exportación, vas a poder despachar este vuelo.",
    dispatch_data:"Datos del despacho",
    mark_all_read:"Marcar todas leídas",
    no_notifs:"Sin notificaciones",
    upload_failed:"Error al subir foto. Intentá de nuevo.",
    photo_uploaded:"Foto subida ✓",
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
    remove:"删除",
    tab_deposit:"仓库",
    tab_active_flights:"活跃航班",
    tab_history:"历史",
    tab_stats:"统计",
    tab_account:"我的账户",
    flight:"航班",
    flight_status_preparando:"准备中",
    flight_status_listo:"可以发送",
    flight_status_despachado:"已发送",
    flight_status_recibido:"已接收",
    no_flights:"您还没有指定的航班",
    invoice:"出口发票",
    no_invoice_yet:"管理员尚未上传发票",
    ready_to_ship:"🚀 可以发送 — 请填写信息",
    waiting_invoice:"⏳ 等待Argencargo的发票",
    weight_from_packages:"总重量（根据包裹计算）",
    download_invoice:"下载发票",
    destination:"目的地地址",
    no_destination_yet:"管理员尚未填写地址",
    dest_name:"姓名",
    dest_taxid:"CUIT/DNI",
    dest_address:"地址",
    dest_postal:"邮编",
    dest_phone:"电话",
    dest_email:"电子邮件",
    push_title:"本设备通知",
    push_subtitle_on:"管理员创建/发出航班时，您会直接在手机上收到通知。",
    push_subtitle_off:"开启通知，即时接收提醒。无需第三方应用。",
    push_enable:"开启",
    push_test:"测试",
    push_test_title:"Argencargo 测试",
    push_test_body:"通知功能正常 ✅",
    push_test_ok:"已发送 — 请查看手机",
    push_no_subs:"没有已订阅的设备",
    push_enabled:"通知已开启",
    push_denied:"权限被拒绝。请在浏览器设置中开启。",
    push_unsupported:"您的浏览器不支持通知。请使用安卓 Chrome/Edge 或 iOS 16.4+ 的 Safari。",
    push_nag_title:"请开启通知",
    push_nag_msg:"管理员创建或发出航班时，需要通知您。",
    push_nag_denied_title:"通知已被拒绝",
    push_nag_denied_msg:"请在浏览器设置中开启通知，以便接收新航班提醒。",
    push_activate_now:"立即开启",
    push_ios_install_title:"请把应用添加到主屏幕",
    push_ios_install_msg:"iPhone 用户必须先通过 Safari 分享菜单安装应用，才能开启通知功能。",
    push_ios_step1:"在 Safari 底部点击「分享」按钮",
    push_ios_step2:"找到并点击「添加到主屏幕」",
    push_ios_step3:"从主屏幕图标打开 Argencargo（不要从 Safari 打开）",
    push_ios_step4:"回到这里，会出现开启通知的按钮",
    push_android_install_title:"请把应用添加到主屏幕",
    push_android_install_msg:"开启通知前，请先从 Chrome 安装应用。",
    push_android_install_btn:"📥 安装应用",
    push_android_step1:"点击 Chrome 右上角的三个点",
    push_android_step2:"点击「安装应用」或「添加到主屏幕」",
    push_android_step3:"从主屏幕图标打开 Argencargo（不要从 Chrome 打开）",
    push_android_step4:"回到这里，通知会自动开启",
    save:"保存",
    scan:"扫描",
    scan_tracking:"拍照自动识别快递单号",
    scan_detected:"已识别",
    scan_not_found:"未识别到单号，请手动输入",
    operations_in_flight:"航班操作",
    dispatch_form:"发送航班",
    total_weight:"总重量 (公斤)",
    total_cost:"总费用 (美元)",
    intl_tracking:"国际物流单号",
    courier:"快递",
    payment_method_label:"付款方式",
    method_cc:"往来账户",
    method_cash:"现金",
    method_transfer:"转账",
    confirm_dispatch:"确认发送",
    dispatch_warning:"确认后，您将无法编辑航班。操作将更改为'运输中'。",
    balance:"余额",
    no_movements:"无动向",
    movement_anticipo:"预付款",
    movement_deduccion:"扣除",
    stats_current_deposit:"当前在仓库",
    stats_total_pkgs:"总收到包裹",
    stats_flights_completed:"完成的航班",
    stats_total_kg:"已发货公斤数",
    stats_total_usd:"总计费",
    cc_type:"类型",
    cc_amount:"金额",
    cc_description:"描述",
    search_deposit:"搜索仓库...",
    confirm:"确认",
    photo:"照片",
    photo_required:"货物照片",
    upload_photo:"上传照片",
    take_photo:"拍照",
    skip_photo:"无照片（稍后上传）",
    photo_pending:"照片待上传",
    photo_pending_msg:"请尽快上传照片。管理员和客户都会看到。",
    photos_pending_count:"个包裹待上传照片",
    add_photo:"添加照片",
    photo_help:"拍照或从相册选择清晰的货物照片（JPG/PNG，最大 5MB）。",
    weight_gross_short:"毛重",
    weight_vol_short:"体积重",
    weight_billable_short:"计费重",
    period:"时期",
    period_week:"周",
    period_month:"月",
    period_year:"年",
    period_all:"全部",
    delete:"删除",
    delete_success:"包裹已删除",
    confirm_delete_pkg:"确定删除该操作的包裹",
    flight_waiting_msg:"管理员上传出口发票后，您可以发送此航班。",
    dispatch_data:"发送数据",
    mark_all_read:"全部标记为已读",
    no_notifs:"无通知",
    upload_failed:"上传失败，请重试。",
    photo_uploaded:"照片已上传 ✓",
  }
};

function Inp({label,type="text",value,onChange,placeholder,req}){return <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",marginBottom:5}}>{label}{req&&<span style={{color:"#ff6b6b"}}> *</span>}</label><input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none",transition:"all 180ms"}} onFocus={e=>{e.target.style.borderColor=GOLD;e.target.style.boxShadow="0 0 0 3px rgba(184,149,106,0.18)";e.target.style.background="rgba(255,255,255,0.07)";}} onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.12)";e.target.style.boxShadow="none";e.target.style.background="rgba(255,255,255,0.04)";}}/></div>;}

function Btn({children,onClick,disabled,variant="primary",type="button"}){
  const [h,setH]=useState(false);
  const isGold=variant==="primary"&&!disabled;
  const isSec=variant==="secondary";
  const bg=disabled?"rgba(255,255,255,0.06)":(isSec?(h?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)"):(isGold?GOLD_GRADIENT:`linear-gradient(135deg,${B_ACCENT},${B_PRIMARY})`));
  return <button type={type} onClick={onClick} disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{width:"100%",padding:"13px",fontSize:14,fontWeight:700,border:isSec?`1px solid ${h?"rgba(184,149,106,0.4)":"rgba(255,255,255,0.14)"}`:(isGold?`1px solid ${GOLD_DEEP}`:"none"),borderRadius:10,cursor:disabled?"not-allowed":"pointer",background:bg,color:disabled?"rgba(255,255,255,0.4)":(isSec?"rgba(255,255,255,0.85)":(isGold?"#0A1628":"#fff")),opacity:disabled?0.6:1,letterSpacing:"0.02em",transition:"all 180ms cubic-bezier(0.4,0,0.2,1)",boxShadow:disabled?"none":(isGold?(h?GOLD_GLOW_STRONG:GOLD_GLOW):"none"),transform:h&&!disabled?"translateY(-1px)":"none",backgroundSize:isGold?"200% 100%":undefined,backgroundPosition:isGold?(h?"100% 0":"0 0"):undefined}}>{children}</button>;
}
function Card({title,children,accent}){return <div style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(8px)",borderRadius:14,border:`1px solid ${accent?"rgba(184,149,106,0.35)":"rgba(255,255,255,0.08)"}`,padding:"1.25rem 1.5rem",marginBottom:14,boxShadow:accent?GOLD_GLOW:"0 2px 8px rgba(0,0,0,0.12)",position:"relative",overflow:"hidden"}}>{accent&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:GOLD_GRADIENT}}/>}<h3 style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.95)",margin:"0 0 14px",textTransform:"uppercase",letterSpacing:"0.08em"}}>{title}</h3>{children}</div>;}

const B_PRIMARY="#1B4F8A",B_ACCENT="#4A90D9";

function LangToggle({lang,setLang}){return <div style={{display:"inline-flex",gap:4,background:"rgba(255,255,255,0.04)",borderRadius:8,padding:3,border:"1px solid rgba(255,255,255,0.08)"}}>{["es","zh"].map(l=><button key={l} onClick={()=>setLang(l)} style={{padding:"5px 12px",fontSize:12,fontWeight:700,border:"none",borderRadius:6,cursor:"pointer",background:lang===l?GOLD_GRADIENT:"transparent",color:lang===l?"#0A1628":"rgba(255,255,255,0.55)",transition:"all 180ms",boxShadow:lang===l?GOLD_GLOW:"none"}}>{l==="es"?"🇦🇷 ES":"🇨🇳 中文"}</button>)}</div>;}

export default function AgentePortal(){
  const [session,setSession]=useState(null);
  const [loading,setLoading]=useState(true);
  const [lang,setLang]=useState("es");
  const t=I18N[lang];
  useEffect(()=>{const s=loadSession();if(s?.access_token){setSession(s);}setLoading(false);const savedLang=typeof window!=="undefined"?localStorage.getItem("ac_agent_lang"):null;if(savedLang==="zh"||savedLang==="es")setLang(savedLang);
    // Registrar service worker (PWA)
    if(typeof window!=="undefined"&&"serviceWorker"in navigator){navigator.serviceWorker.register("/sw-agente.js",{scope:"/agente"}).catch(()=>{});}
  },[]);
  useEffect(()=>{try{localStorage.setItem("ac_agent_lang",lang);}catch(e){}},[lang]);
  if(loading)return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,color:"rgba(255,255,255,0.4)"}}>Cargando...</div>;
  if(!session)return <><ToastStack/><AuthScreen onLogin={setSession} lang={lang} setLang={setLang} t={t}/></>;
  return <><ToastStack/><Dashboard session={session} onLogout={()=>{clearSession();setSession(null);}} lang={lang} setLang={setLang} t={t}/></>;
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
    // Notification #7: notify admin about new agent signup
    try{const adm=await dq("profiles",{token,filters:"?role=eq.admin&select=id&limit=1"});const adminId=Array.isArray(adm)&&adm[0]?adm[0].id:null;if(adminId){await dq("notifications",{method:"POST",token,body:{user_id:adminId,portal:"admin",title:"Nueva solicitud de agente",body:`${fName||""} ${lName||""}`.trim(),link:null}});}}catch(e){console.error("notif error",e);}
  };
  const login=async()=>{if(!email||!pass){setErr(t.err_generic);return;}setLo(true);setErr("");
    const r=await ac("token?grant_type=password",{email,password:pass});
    if(r.access_token){const sess={access_token:r.access_token,refresh_token:r.refresh_token,user:r.user};saveSession(sess);onLogin(sess);}
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
        const sess={access_token:l.access_token,refresh_token:l.refresh_token,user:l.user};saveSession(sess);onLogin(sess);
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
        const sess={access_token:l.access_token,refresh_token:l.refresh_token,user:l.user};saveSession(sess);onLogin(sess);
      } else {
        // Email confirmation activado en Supabase
        setErr("Cuenta creada. Confirmá el email para poder ingresar (revisá tu casilla).");
      }
    } else {
      setErr(r.error_description||r.msg||r.message||t.err_generic);
    }
    setLo(false);};
  return <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1rem",fontFamily:"'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif",position:"relative",overflow:"hidden"}}>
    <style dangerouslySetInnerHTML={{__html:AC_KEYFRAMES}}/>
    <div style={{position:"absolute",top:"-15%",right:"-8%",width:500,height:500,background:"radial-gradient(circle, rgba(184,149,106,0.14) 0%, transparent 70%)",pointerEvents:"none"}}/>
    <div style={{position:"absolute",bottom:"-15%",left:"-8%",width:540,height:540,background:"radial-gradient(circle, rgba(184,149,106,0.10) 0%, transparent 70%)",pointerEvents:"none"}}/>
    <div style={{maxWidth:420,width:"100%",position:"relative",zIndex:1,animation:"ac_fade_in 400ms ease-out"}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <img src={LOGO} alt="AC" style={{width:210,height:"auto",filter:"drop-shadow(0 4px 24px rgba(184,149,106,0.28))"}}/>
      </div>
      <div style={{textAlign:"center",marginBottom:18}}><LangToggle lang={lang} setLang={setLang}/></div>
      <div style={{background:"rgba(10,22,40,0.72)",backdropFilter:"blur(28px)",borderRadius:16,padding:"2rem 1.75rem",border:"1px solid rgba(255,255,255,0.06)",boxShadow:"0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.028)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:GOLD_GRADIENT,opacity:0.85}}/>
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
  const [flights,setFlights]=useState([]);
  const [flightOps,setFlightOps]=useState([]);
  const [account,setAccount]=useState([]);
  const [showForm,setShowForm]=useState(false);
  const [flashMsg,setFlashMsg]=useState("");
  const [tab,setTab]=useState("deposit");
  const [selFlight,setSelFlight]=useState(null);
  const [depositSearch,setDepositSearch]=useState("");
  const [statsPeriod,setStatsPeriod]=useState("month");

  const reloadAll=async()=>{
    const [pk,fl,fo,acc]=await Promise.all([
      dq("operation_packages",{token,filters:"?select=*,operations!inner(operation_code,client_id,channel,created_by_agent_id,clients(client_code,first_name))&operations.channel=eq.aereo_blanco&operations.created_by_agent_id=not.is.null&order=created_at.desc&limit=100"}),
      dq("flights",{token,filters:"?select=*&order=created_at.desc"}),
      dq("flight_operations",{token,filters:"?select=*"}),
      dq("agent_account_movements",{token,filters:"?select=*&order=date.desc,created_at.desc"})
    ]);
    setPackages(Array.isArray(pk)?pk:[]);setFlights(Array.isArray(fl)?fl:[]);setFlightOps(Array.isArray(fo)?fo:[]);setAccount(Array.isArray(acc)?acc:[]);
  };

  useEffect(()=>{(async()=>{
    // Chequeo role + signup en paralelo para evitar flash de "pending"
    const [prof,sgn]=await Promise.all([
      dq("profiles",{token,filters:`?id=eq.${userId}&select=role&limit=1`}),
      dq("agent_signups",{token,filters:`?auth_user_id=eq.${userId}&select=*&limit=1`})
    ]);
    const role=Array.isArray(prof)&&prof[0]?prof[0].role:null;
    if(role==="admin"){
      setSignup({status:"approved",first_name:"Admin",email:session.user?.email,country:"Argentina"});
      await reloadAll();
      setLoading(false);
      return;
    }
    const s=Array.isArray(sgn)&&sgn[0]?sgn[0]:null;
    setSignup(s);
    if(s?.status==="approved")await reloadAll();
    setLoading(false);
  })();},[token,userId]);

  const reloadPackages=reloadAll;
  const flash=(m)=>{setFlashMsg(m);setTimeout(()=>setFlashMsg(""),3000);const v=/error|fail/i.test(m)?"error":"success";toast(m,v);};
  const balance=account.reduce((s,m)=>s+(m.type==="anticipo"?Number(m.amount_usd):-Number(m.amount_usd)),0);
  const usdF=(v)=>`USD ${Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  if(loading)return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:BG,color:"rgba(255,255,255,0.4)"}}>...</div>;

  if(!signup||signup.status==="pending"){
    return <SimpleShell lang={lang} setLang={setLang} t={t} onLogout={onLogout} token={token}>
      <div style={{maxWidth:600,margin:"3rem auto",background:"rgba(251,191,36,0.08)",border:"1.5px solid rgba(251,191,36,0.3)",borderRadius:16,padding:"2rem",textAlign:"center"}}>
        <p style={{fontSize:48,margin:"0 0 12px"}}>⏳</p>
        <h2 style={{fontSize:20,fontWeight:700,color:"#fbbf24",margin:"0 0 10px"}}>{t.pending_title}</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",margin:0}}>{t.pending_msg}</p>
      </div>
    </SimpleShell>;
  }

  if(signup.status==="rejected"){
    return <SimpleShell lang={lang} setLang={setLang} t={t} onLogout={onLogout} token={token}>
      <div style={{maxWidth:600,margin:"3rem auto",background:"rgba(255,80,80,0.08)",border:"1.5px solid rgba(255,80,80,0.3)",borderRadius:16,padding:"2rem",textAlign:"center"}}>
        <p style={{fontSize:48,margin:"0 0 12px"}}>✕</p>
        <h2 style={{fontSize:20,fontWeight:700,color:"#ff6b6b",margin:"0 0 10px"}}>Rejected</h2>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.5)",margin:0}}>{t.rejected_msg}</p>
      </div>
    </SimpleShell>;
  }

  const stColors={preparando:"#fbbf24",despachado:"#60a5fa",recibido:"#22c55e"};

  // Computed: paquetes en depósito (op no asignada a ningún vuelo)
  const flightOpIds=new Set(flightOps.map(fo=>fo.operation_id));
  const depositPkgsAll=packages.filter(p=>!flightOpIds.has(p.operation_id));
  const depositPkgs=depositPkgsAll.filter(p=>!depositSearch||[p.operations?.operation_code,p.operations?.clients?.client_code,p.national_tracking].some(v=>(v||"").toLowerCase().includes(depositSearch.toLowerCase())));
  const depositTotalKg=depositPkgsAll.reduce((s,p)=>s+Number(p.gross_weight_kg||0),0).toFixed(2);
  const activeFlights=flights.filter(f=>f.status==="preparando");
  const historyFlights=flights.filter(f=>f.status==="despachado"||f.status==="recibido");

  // Stats con filtro de período (week / month / year / all)
  const periodCutoff=()=>{const now=Date.now();const day=86400000;if(statsPeriod==="week")return new Date(now-7*day).toISOString();if(statsPeriod==="month")return new Date(now-30*day).toISOString();if(statsPeriod==="year")return new Date(now-365*day).toISOString();return null;};
  const cutoff=periodCutoff();
  const inPeriod=(dateStr)=>!cutoff||(dateStr&&new Date(dateStr).toISOString()>=cutoff);
  const periodPackages=packages.filter(p=>inPeriod(p.created_at));
  const periodFlights=flights.filter(f=>inPeriod(f.dispatched_at||f.updated_at||f.created_at));
  const periodHistory=periodFlights.filter(f=>f.status==="despachado"||f.status==="recibido");
  const statFlightsCompleted=periodHistory.length;
  const statTotalKg=periodFlights.filter(f=>f.total_weight_kg).reduce((s,f)=>s+Number(f.total_weight_kg||0),0);
  const statTotalUsd=periodFlights.filter(f=>f.total_cost_usd).reduce((s,f)=>s+Number(f.total_cost_usd||0),0);
  const statTotalPkgs=periodPackages.length;

  const FlightCard=({f})=>{const ops=flightOps.filter(fo=>fo.flight_id===f.id);
    const isReady=f.status==="preparando"&&f.invoice_presented_at;
    const isWaiting=f.status==="preparando"&&!f.invoice_presented_at;
    const cardBg=isReady?"rgba(34,197,94,0.08)":isWaiting?"rgba(251,191,36,0.06)":"rgba(255,255,255,0.028)";
    const cardBorder=isReady?"1.5px solid rgba(34,197,94,0.35)":isWaiting?"1.5px solid rgba(251,191,36,0.25)":"1px solid rgba(255,255,255,0.06)";
    return <div onClick={()=>setSelFlight(f.id)} style={{cursor:"pointer",background:cardBg,border:cardBorder,borderRadius:14,padding:"1rem 1.25rem"}}>
    {isReady&&<p style={{fontSize:13,fontWeight:700,color:"#22c55e",margin:"0 0 8px"}}>{t.ready_to_ship}</p>}
    {isWaiting&&<p style={{fontSize:13,fontWeight:700,color:"#fbbf24",margin:"0 0 8px"}}>{t.waiting_invoice}</p>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:14,fontWeight:700,color:"#fff",fontFamily:"monospace"}}>{f.flight_code}</span>
        <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:4,color:isReady?"#22c55e":stColors[f.status],background:isReady?"rgba(34,197,94,0.2)":`${stColors[f.status]}20`,border:`1px solid ${isReady?"rgba(34,197,94,0.4)":stColors[f.status]+"40"}`,textTransform:"uppercase"}}>{isReady?t.flight_status_listo:t["flight_status_"+f.status]}</span>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{ops.length} ops</span>
      </div>
      <span style={{color:IC,fontSize:12,fontWeight:600}}>{t.flight} →</span>
    </div>
    {!isReady&&!isWaiting&&f.invoice_presented_at?<p style={{fontSize:11,color:"#22c55e",margin:0}}>📄 {t.invoice} ✓</p>:null}
    {!isReady&&!isWaiting&&!f.invoice_presented_at?<p style={{fontSize:11,color:"#fbbf24",margin:0}}>⏳ {t.no_invoice_yet}</p>:null}
    {f.destination_address&&<p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"4px 0 0"}}>📍 {f.destination_address}</p>}
  </div>;};

  return <SimpleShell lang={lang} setLang={setLang} t={t} onLogout={onLogout} token={token}>
    <div style={{marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
      <div>
        <h2 style={{fontSize:26,fontWeight:700,color:"#fff",margin:"0 0 4px",letterSpacing:"-0.02em"}}>{t.hello}, {signup.first_name||signup.email}</h2>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0,display:"inline-flex",alignItems:"center",gap:6}}><span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px rgba(34,197,94,0.6)"}}/>{t.active_in} <span style={{color:GOLD_LIGHT,fontWeight:600}}>{signup.country||"China"}</span></p>
      </div>
      {!showForm&&<Btn onClick={()=>{setTab("deposit");setShowForm(true);}}>+ {t.register_pkg}</Btn>}
    </div>
    <PushNagBanner token={token} t={t}/>
    {flashMsg&&<div style={{padding:"10px 14px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.22)",borderRadius:10,fontSize:13,color:"#22c55e",marginBottom:16,animation:"ac_fade_in 200ms",fontWeight:600}}>✓ {flashMsg}</div>}
    <div className="ac-agente-tabs" style={{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid rgba(255,255,255,0.06)",flexWrap:"wrap"}}>
      {[
        {k:"deposit",l:t.tab_deposit,n:depositPkgsAll.length,extra:`${depositTotalKg} kg`},
        {k:"active_flights",l:t.tab_active_flights,n:activeFlights.length},
        {k:"history",l:t.tab_history,n:historyFlights.length},
        {k:"stats",l:t.tab_stats},
        {k:"account",l:t.tab_account,extra:usdF(balance)}
      ].map(tb=>{const active=tab===tb.k;return <button key={tb.k} onClick={()=>{setTab(tb.k);setSelFlight(null);}} style={{padding:"10px 16px",fontSize:12,fontWeight:active?700:600,border:"none",background:"transparent",color:active?GOLD_LIGHT:"rgba(255,255,255,0.5)",cursor:"pointer",letterSpacing:"0.06em",textTransform:"uppercase",borderBottom:`2px solid ${active?GOLD:"transparent"}`,marginBottom:-1,transition:"all 150ms",display:"inline-flex",alignItems:"center",gap:6}} onMouseEnter={e=>{if(!active)e.currentTarget.style.color="rgba(255,255,255,0.8)";}} onMouseLeave={e=>{if(!active)e.currentTarget.style.color="rgba(255,255,255,0.5)";}}>{tb.l}{tb.n!==undefined&&<span style={{fontSize:10,fontWeight:700,color:active?GOLD_LIGHT:"rgba(255,255,255,0.35)",fontVariantNumeric:"tabular-nums"}}>{tb.n}</span>}{tb.extra&&<span style={{fontSize:10,fontWeight:500,color:"rgba(255,255,255,0.4)",marginLeft:2,textTransform:"none",letterSpacing:0}}>· {tb.extra}</span>}</button>;})}
    </div>

    {/* TAB 1: Depósito — paquetes sin vuelo */}
    {tab==="deposit"&&<>
      {showForm&&<NewPackageForm token={token} lang={lang} t={t} agentId={userId} onCancel={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);reloadPackages();flash(t.success);}}/>}
      {/* Banner: paquetes pendientes de foto */}
      {(()=>{const pendientes=depositPkgsAll.filter(p=>!p.photo_url);if(pendientes.length===0)return null;
        return <div style={{padding:"12px 16px",background:"linear-gradient(135deg,rgba(251,191,36,0.1),rgba(251,191,36,0.02))",border:"1.5px solid rgba(251,191,36,0.3)",borderRadius:10,margin:"16px 0 0",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontSize:18}}>📷</span>
          <div style={{flex:1,minWidth:200}}>
            <p style={{fontSize:13,fontWeight:700,color:"#fbbf24",margin:0}}>{pendientes.length} {t.photos_pending_count}</p>
            <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"2px 0 0"}}>{t.photo_pending_msg}</p>
          </div>
        </div>;})()}
      <input value={depositSearch} onChange={e=>setDepositSearch(e.target.value)} placeholder={t.search_deposit} style={{width:"100%",padding:"10px 14px",fontSize:13,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none",marginTop:16,marginBottom:0}}/>
      <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden",marginTop:10}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}><h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>{t.tab_deposit} ({depositPkgs.length}) {"\u00b7"} {depositTotalKg} kg</h3></div>
        {depositPkgs.length===0?<p style={{padding:"2rem",textAlign:"center",color:"rgba(255,255,255,0.4)",margin:0}}>{t.no_pkgs}</p>:
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:880,whiteSpace:"nowrap"}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            {[t.op,t.client,t.tracking,t.weight_gross_short||t.weight,t.weight_vol_short||"Vol.",t.weight_billable_short||"Fact.",t.photo,t.date,""].map((h,i)=><th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}
          </tr></thead>
          <tbody>{depositPkgs.map(p=>{
            const q=Number(p.quantity||1),gw=Number(p.gross_weight_kg||0),l=Number(p.length_cm||0),w=Number(p.width_cm||0),h=Number(p.height_cm||0);
            const volDiv=Number(signup?.volumetric_divisor)||5000;const bruto=gw*q;const vol=l&&w&&h?((l*w*h)/volDiv)*q:0;const fact=Math.max(bruto,vol);const isVolBigger=vol>bruto;
            return <tr key={p.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <td style={{padding:"10px 14px",fontFamily:"monospace",fontWeight:600,color:"#fff"}}>{p.operations?.operation_code||"—"}</td>
            <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.7)"}}>{p.operations?.clients?.client_code||"—"}</td>
            <td style={{padding:"10px 14px",fontFamily:"monospace",fontSize:12,color:"rgba(255,255,255,0.6)"}}>{p.national_tracking||"—"}</td>
            <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.7)",fontVariantNumeric:"tabular-nums"}}>{bruto?`${bruto.toFixed(2)} kg`:"—"}</td>
            <td style={{padding:"10px 14px",color:isVolBigger?"#fb923c":"rgba(255,255,255,0.5)",fontVariantNumeric:"tabular-nums"}}>{vol?`${vol.toFixed(2)} kg`:"—"}</td>
            <td style={{padding:"10px 14px",color:fact>0?IC:"rgba(255,255,255,0.3)",fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{fact?`${fact.toFixed(2)} kg`:"—"}</td>
            <td style={{padding:"10px 14px"}}><PackagePhotoCell pkg={p} token={token} t={t} onUpdated={reloadAll}/></td>
            <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.4)",fontSize:11}}>{new Date(p.created_at).toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</td>
            <td style={{padding:"10px 14px",textAlign:"right"}}>
              <button onClick={async()=>{if(!confirm(`${t.confirm_delete_pkg} ${p.operations?.operation_code}?`))return;await dq("operation_packages",{method:"DELETE",token,filters:`?id=eq.${p.id}`});reloadAll();flash(t.delete_success);}} style={{padding:"4px 10px",fontSize:11,fontWeight:600,borderRadius:6,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.1)",color:"#ff6b6b",cursor:"pointer"}}>{t.delete}</button>
            </td>
          </tr>;})}</tbody>
        </table></div>}
      </div>
    </>}

    {/* TAB 2: Vuelos activos (preparando / despachado) */}
    {tab==="active_flights"&&!selFlight&&<>
      {activeFlights.length===0?<p style={{textAlign:"center",color:"rgba(255,255,255,0.4)",padding:"3rem 0"}}>{t.no_flights}</p>:
      <div style={{display:"grid",gap:12}}>{activeFlights.map(f=><FlightCard key={f.id} f={f}/>)}</div>}
    </>}

    {/* TAB 3: Histórico (recibido) */}
    {tab==="history"&&!selFlight&&<>
      {historyFlights.length===0?<p style={{textAlign:"center",color:"rgba(255,255,255,0.4)",padding:"3rem 0"}}>{t.no_flights}</p>:
      <div style={{display:"grid",gap:12}}>{historyFlights.map(f=><FlightCard key={f.id} f={f}/>)}</div>}
    </>}

    {/* Flight detail (shared by active_flights + history) */}
    {(tab==="active_flights"||tab==="history")&&selFlight&&(()=>{const f=flights.find(x=>x.id===selFlight);if(!f)return null;const ops=flightOps.filter(fo=>fo.flight_id===f.id);return <FlightDetail token={token} flight={f} flightOps={ops} packages={packages} t={t} onBack={()=>setSelFlight(null)} onDispatched={()=>{reloadAll();setSelFlight(null);flash(t.success);}}/>;})()}

    {/* TAB 4: Estadísticas */}
    {tab==="stats"&&<>
      <div style={{display:"flex",gap:8,marginBottom:18,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em"}}>{t.period||"Período"}:</span>
        {[{k:"week",l:t.period_week||"Semana"},{k:"month",l:t.period_month||"Mes"},{k:"year",l:t.period_year||"Año"},{k:"all",l:t.period_all||"Total"}].map(p=><button key={p.k} onClick={()=>setStatsPeriod(p.k)} style={{padding:"6px 14px",fontSize:11,fontWeight:700,borderRadius:8,border:statsPeriod===p.k?`1.5px solid ${GOLD}`:"1.5px solid rgba(255,255,255,0.08)",background:statsPeriod===p.k?"rgba(184,149,106,0.12)":"rgba(255,255,255,0.028)",color:statsPeriod===p.k?GOLD_LIGHT:"rgba(255,255,255,0.4)",cursor:"pointer",letterSpacing:"0.04em",textTransform:"uppercase"}}>{p.l}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
      {[
        {label:t.stats_current_deposit,value:depositPkgs.length,icon:"📦",color:"#60a5fa"},
        {label:t.stats_total_pkgs,value:statTotalPkgs,icon:"📬",color:"#a78bfa"},
        {label:t.stats_flights_completed,value:statFlightsCompleted,icon:"✈️",color:"#22c55e"},
        {label:t.stats_total_kg,value:`${statTotalKg.toFixed(1)} kg`,icon:"⚖️",color:"#fbbf24"},
        {label:t.stats_total_usd,value:usdF(statTotalUsd),icon:"💵",color:"#34d399"}
      ].map(s=><div key={s.label} style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"20px 24px"}}>
        <p style={{fontSize:28,margin:"0 0 4px"}}>{s.icon}</p>
        <p style={{fontSize:28,fontWeight:700,color:s.color,margin:"0 0 6px"}}>{s.value}</p>
        <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:0,textTransform:"uppercase"}}>{s.label}</p>
      </div>)}
      </div>
    </>}

    {/* TAB 5: Cuenta corriente */}
    {tab==="account"&&<div>
      <PushSetup token={token} signup={signup} t={t}/>
      <div style={{display:"flex",gap:16,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200,background:bal=>(bal>=0?"rgba(34,197,94,0.06)":"rgba(255,80,80,0.06)"),borderRadius:14,padding:"20px 24px",border:`1px solid ${balance>=0?"rgba(34,197,94,0.15)":"rgba(255,80,80,0.15)"}`,backgroundColor:balance>=0?"rgba(34,197,94,0.06)":"rgba(255,80,80,0.06)"}}>
          <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",textTransform:"uppercase"}}>{t.balance}</p>
          <p style={{fontSize:32,fontWeight:700,color:balance>=0?"#22c55e":"#ff6b6b",margin:0}}>{usdF(balance)}</p>
        </div>
      </div>
      <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
        {account.length===0?<p style={{padding:"2rem",textAlign:"center",color:"rgba(255,255,255,0.4)",margin:0}}>{t.no_movements}</p>:
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>{[t.date,t.cc_type,t.cc_amount,t.cc_description,t.flight].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>{account.map(m=>{const fl=flights.find(f=>f.id===m.flight_id);return <tr key={m.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.5)",fontSize:12}}>{new Date(m.date).toLocaleDateString("es-AR")}</td>
            <td style={{padding:"10px 14px"}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:4,fontWeight:700,background:m.type==="anticipo"?"rgba(34,197,94,0.15)":"rgba(255,80,80,0.15)",color:m.type==="anticipo"?"#22c55e":"#ff6b6b",textTransform:"uppercase"}}>{m.type==="anticipo"?t.movement_anticipo:t.movement_deduccion}</span></td>
            <td style={{padding:"10px 14px",fontWeight:700,color:m.type==="anticipo"?"#22c55e":"#ff6b6b"}}>{m.type==="anticipo"?"+":"-"}{usdF(m.amount_usd)}</td>
            <td style={{padding:"10px 14px",color:"rgba(255,255,255,0.5)",fontSize:12}}>{m.description||"—"}</td>
            <td style={{padding:"10px 14px",fontFamily:"monospace",color:IC,fontSize:11}}>{fl?fl.flight_code:"—"}</td>
          </tr>;})}</tbody>
        </table>}
      </div>
    </div>}
  </SimpleShell>;
}

function FlightDetail({token,flight,flightOps,packages,t,onBack,onDispatched}){
  const [invoiceItems,setInvoiceItems]=useState([]);
  // Peso total calculado automáticamente desde los bultos
  const autoWeight=flightOps.reduce((s,fo)=>{const opPkgs=packages.filter(p=>p.operation_id===fo.operation_id);return s+opPkgs.reduce((a,p)=>a+Number(p.gross_weight_kg||0)*Number(p.quantity||1),0);},0);
  const [totalCost,setTotalCost]=useState(flight.total_cost_usd||"");
  const [tracking,setTracking]=useState(flight.international_tracking||"");
  const [carrier,setCarrier]=useState(flight.international_carrier||"DHL");
  const [pmtMethod,setPmtMethod]=useState(flight.payment_method||"cuenta_corriente");
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const [confirmDispatch,setConfirmDispatch]=useState(false);
  const stColors={preparando:"#fbbf24",despachado:"#60a5fa",recibido:"#22c55e"};
  const usdF=(v)=>`USD ${Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  useEffect(()=>{(async()=>{const r=await dq("flight_invoice_items",{token,filters:`?flight_id=eq.${flight.id}&select=*&order=sort_order.asc`});setInvoiceItems(Array.isArray(r)?r:[]);})();},[flight.id,token]);
  // Generar factura PDF con info comercial de la mercadería: descripción, cantidad, valor, NCM, dirección destino
  const downloadInvoicePdf=async()=>{
    // Cargar items factura editables (con HS code) y datos de op/cliente
    const opIds=flightOps.map(fo=>fo.operation_id);
    if(opIds.length===0)return;
    const fiData=await dq("flight_invoice_items",{token,filters:`?flight_id=eq.${flight.id}&select=*,operations(operation_code,ncm_code,clients(client_code,first_name,last_name))&order=sort_order.asc`});
    let items=Array.isArray(fiData)?fiData:[];
    // Fallback: si no hay flight_invoice_items, usar operation_items
    if(items.length===0){
      const opData=await dq("operation_items",{token,filters:`?operation_id=in.(${opIds.join(",")})&select=*,operations(operation_code,ncm_code,clients(client_code,first_name,last_name))&order=created_at.asc`});
      items=(Array.isArray(opData)?opData:[]).map(it=>({...it,unit_price_declared_usd:it.unit_price_usd,hs_code:it.ncm_code}));
    }
    const fmt=v=>`USD ${Number(v||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const today=new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"});
    const priceOf=it=>Number(it.unit_price_declared_usd??it.unit_price_usd??0);
    const hsOf=it=>it.hs_code||it.ncm_code||it.operations?.ncm_code||"—";
    const totalQty=items.reduce((s,it)=>s+Number(it.quantity||0),0);
    const totalValue=items.reduce((s,it)=>s+priceOf(it)*Number(it.quantity||1),0);
    const rows=items.length>0?items.map(it=>{const op=it.operations;const cli=op?.clients;const up=priceOf(it);const total=up*Number(it.quantity||1);return `<tr><td>${op?.operation_code||"—"}</td><td>${cli?cli.client_code:"—"}</td><td>${it.description||"—"}</td><td class="c mono">${hsOf(it)}</td><td class="c">${it.quantity||1}</td><td class="r">${fmt(up)}</td><td class="r"><b>${fmt(total)}</b></td></tr>`;}).join(""):'<tr><td colspan="7" style="text-align:center;color:#666;padding:20px">Sin items declarados.</td></tr>';
    const destRow=(lbl,val)=>val?`<div class="dest-row"><span>${lbl}</span><b>${val}</b></div>`:"";
    const LOGO="https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png";
    const htmlContent=`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${flight.flight_code}</title><style>
      *{box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;padding:32px;color:#111;max-width:920px;margin:0 auto}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1B4F8A;padding-bottom:16px;margin-bottom:20px}
      .header img{max-width:170px;height:auto}
      .header .meta{text-align:right;font-size:10px;color:#666;line-height:1.5}
      .header .meta b{color:#1B4F8A;font-size:13px;display:block;margin-bottom:2px;font-family:monospace}
      h1{font-size:22px;margin:0 0 4px;color:#1B4F8A}.sub{color:#666;font-size:12px;margin-bottom:24px}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-bottom:18px}
      .box{padding:14px 16px;background:#f5f7fa;border-radius:8px}
      .box h3{font-size:11px;color:#1B4F8A;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.05em}
      .dest-row{display:flex;justify-content:space-between;padding:4px 0;font-size:11px;color:#444}.dest-row span{color:#888;font-weight:600}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px}
      th,td{padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
      th{background:#1B4F8A;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:0.05em}
      td.c{text-align:center}td.r{text-align:right}td.mono{font-family:monospace;font-size:10px}
      tr:nth-child(even) td{background:#fafbfc}
      .totals{margin-top:18px;padding:16px;background:linear-gradient(135deg,#152D54,#3B7DD8);color:#fff;border-radius:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
      .totals .lbl{font-size:11px;text-transform:uppercase;letter-spacing:0.05em;opacity:0.85}
      .totals .big{font-size:20px;font-weight:700}
      .foot{margin-top:24px;padding:18px 20px;background:#152D54;color:#fff;border-radius:8px;display:flex;align-items:center;gap:16px}
      .foot img{max-width:80px;height:auto}
      .foot .info{font-size:11px;line-height:1.7;flex:1}.foot .info b{display:block;font-size:13px;letter-spacing:0.03em;margin-bottom:3px}
      .foot .lbl{color:#8ea3c4;margin-right:4px}
      .disclaimer{margin-top:14px;font-size:9px;color:#999;line-height:1.5;text-align:center;font-style:italic}
    </style></head><body>
      <div class="header"><img src="${LOGO}" alt="Argencargo"/><div class="meta"><b>FLIGHT ${flight.flight_code}</b><div>Issued ${today}</div><div>Commercial Invoice / Packing List</div></div></div>
      <div class="grid">
        <div class="box"><h3>Shipper / Exporter</h3>
          <div class="dest-row"><span>Company</span><b>ARGENCARGO</b></div>
          <div class="dest-row"><span>Address</span><b>Av. Callao 1137, CABA, Argentina</b></div>
          <div class="dest-row"><span>Origin</span><b>China</b></div>
          <div class="dest-row"><span>Carrier</span><b>${flight.international_carrier||carrier||"—"}</b></div>
        </div>
        <div class="box"><h3>Consignee / Destination</h3>
          ${destRow("Name",flight.dest_name)}
          ${destRow("CUIT/DNI",flight.dest_tax_id)}
          ${destRow("Address",flight.dest_address||flight.destination_address)}
          ${destRow("Postal Code",flight.dest_postal_code)}
          ${destRow("Phone",flight.dest_phone)}
          ${destRow("Email",flight.dest_email)}
          ${destRow("Country","Argentina")}
        </div>
      </div>
      <h3 style="margin:18px 0 0;font-size:13px;color:#1B4F8A;text-transform:uppercase;letter-spacing:0.05em">Items / Goods Description</h3>
      <table><thead><tr><th>Op</th><th>Client</th><th>Description</th><th>HS Code</th><th>Qty</th><th class="r">Unit Value</th><th class="r">Total Value</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals"><div><div class="lbl">Total Quantity</div><div class="big">${totalQty}</div></div><div><div class="lbl">Total Weight</div><div class="big">${(autoWeight||0).toFixed(2)} kg</div></div><div><div class="lbl">Total Commercial Value</div><div class="big">${fmt(totalValue)}</div></div></div>
      <div class="foot"><img src="${LOGO}" alt="Argencargo"/><div class="info"><b>ARGENCARGO</b><div><span class="lbl">Tel:</span>+54 9 11 2508-8580</div><div><span class="lbl">Email:</span>info@argencargo.com.ar</div><div>Av Callao 1137 — Recoleta, CABA, Argentina</div></div></div>
      <div class="disclaimer">This document is generated for customs and freight forwarding purposes only. Final commercial invoice may differ subject to actual shipment data.</div>
      <script>setTimeout(()=>{try{window.print();}catch(e){}},400)</script>
    </body></html>`;
    // Estrategia universal: intenta abrir nueva tab; si falla (PWA standalone iOS), descarga HTML
    const w=window.open("","_blank");
    if(w&&w.document){
      w.document.write(htmlContent);
      w.document.close();
    } else {
      // Fallback: descargar como archivo .html (se abre en cualquier navegador, se puede imprimir desde ahí)
      const blob=new Blob([htmlContent],{type:"text/html;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download=`invoice-${flight.flight_code}.html`;
      document.body.appendChild(a);a.click();
      setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},100);
    }
  };
  const dispatch=async()=>{
    if(!totalCost||!tracking){setErr(t.err_generic);return;}
    if(autoWeight<=0){setErr("El peso total es 0 - cargá peso en los bultos primero");return;}
    setSaving(true);setErr("");
    const w=autoWeight,c=Number(totalCost);
    await dq("flights",{method:"PATCH",token,filters:`?id=eq.${flight.id}`,body:{total_weight_kg:w,total_cost_usd:c,international_tracking:tracking,international_carrier:carrier,payment_method:pmtMethod,status:"despachado",dispatched_at:new Date().toISOString()}});
    // 2. Distribute cost by weight + update each operation
    for(const fo of flightOps){
      const opPkgs=packages.filter(p=>p.operation_id===fo.operation_id);
      const opW=opPkgs.reduce((s,p)=>s+(Number(p.gross_weight_kg||0)*Number(p.quantity||1)),0);
      const share=w>0?(opW/w)*c:0;
      await dq("flight_operations",{method:"PATCH",token,filters:`?id=eq.${fo.id}`,body:{weight_kg:opW,cost_share_usd:share}});
      await dq("operations",{method:"PATCH",token,filters:`?id=eq.${fo.operation_id}`,body:{status:"en_transito",international_tracking:tracking,international_carrier:carrier,cost_flete:share,cost_flete_method:pmtMethod==="cuenta_corriente"?"cuenta_corriente":pmtMethod==="transferencia"?"transferencia":"contado"}});
    }
    // 3. Registrar pago según método
    if(pmtMethod==="cuenta_corriente"){
      // CC: descontar del saldo del agente (anticipo ya dado)
      await dq("agent_account_movements",{method:"POST",token,body:{agent_id:flight.agent_id,type:"deduccion",amount_usd:c,description:`Costo vuelo ${flight.flight_code}`,flight_id:flight.id,date:new Date().toISOString().slice(0,10)}});
    } else {
      // Contado/transferencia: es un gasto real → registrar en finanzas
      try{await dq("finance_entries",{method:"POST",token,body:{category_id:"427a9ecc-b2d2-4008-a54b-8901e427e0a1",type:"gasto",amount_usd:c,description:`Flete vuelo ${flight.flight_code} (${pmtMethod})`,date:new Date().toISOString().slice(0,10)}});}catch(e){console.error("finance entry error",e);}
    }
    // Notification #4: notify admin about flight dispatched
    try{const adm=await dq("profiles",{token,filters:"?role=eq.admin&select=id&limit=1"});const adminId=Array.isArray(adm)&&adm[0]?adm[0].id:null;if(adminId){await dq("notifications",{method:"POST",token,body:{user_id:adminId,portal:"admin",title:`Vuelo ${flight.flight_code} despachado`,body:`${carrier} - ${tracking}`,link:null}});}}catch(e){console.error("notif error",e);}
    setSaving(false);
    onDispatched();
  };
  return <div>
    <button onClick={onBack} style={{fontSize:13,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600,marginBottom:14,padding:0}}>← {t.tab_active_flights}</button>
    <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",padding:"1.5rem",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,flexWrap:"wrap"}}>
        <h3 style={{fontSize:18,fontWeight:700,color:"#fff",margin:0,fontFamily:"monospace"}}>{flight.flight_code}</h3>
        {(()=>{const ready=flight.status==="preparando"&&flight.invoice_presented_at;const c=ready?"#22c55e":stColors[flight.status];return <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:4,color:c,background:`${c}20`,border:`1px solid ${c}40`,textTransform:"uppercase"}}>{ready?t.flight_status_listo:t["flight_status_"+flight.status]}</span>;})()}
      </div>
      <div style={{marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
        <div>
          <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 6px",textTransform:"uppercase"}}>{t.invoice}</p>
          {flight.invoice_presented_at?<p style={{fontSize:13,color:"#22c55e",fontWeight:600,margin:0}}>✅ Factura presentada</p>:<p style={{fontSize:13,color:"#fbbf24",margin:0}}>⏳ {t.no_invoice_yet}</p>}
        </div>
        <button onClick={downloadInvoicePdf} style={{padding:"8px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:`1px solid ${GOLD_DEEP}`,background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",letterSpacing:"0.04em",boxShadow:GOLD_GLOW,whiteSpace:"nowrap"}}>📄 {t.download_invoice}</button>
      </div>
      {/* Datos de destino completos — lo que el agente necesita para despachar */}
      <div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.18)",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
        <p style={{fontSize:10,fontWeight:700,color:IC,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:"0.05em"}}>📦 {t.destination}</p>
        {(()=>{const any=flight.dest_name||flight.dest_address||flight.destination_address||flight.dest_phone||flight.dest_email||flight.dest_tax_id||flight.dest_postal_code;if(!any)return <p style={{fontSize:13,color:"#fbbf24",margin:0}}>⏳ {t.no_destination_yet}</p>;
        const row=(lbl,val,copyable)=>val?<div style={{display:"flex",gap:10,padding:"4px 0",fontSize:12,alignItems:"baseline"}}>
          <span style={{minWidth:80,color:"rgba(255,255,255,0.4)",fontWeight:700,fontSize:10,textTransform:"uppercase"}}>{lbl}</span>
          <span style={{color:"#fff",flex:1,wordBreak:"break-word",fontFamily:copyable?"monospace":"inherit"}}>{val}</span>
        </div>:null;
        return <>
          {row(t.dest_name,flight.dest_name)}
          {row(t.dest_taxid,flight.dest_tax_id,true)}
          {row(t.dest_address,flight.dest_address||flight.destination_address)}
          {row(t.dest_postal,flight.dest_postal_code,true)}
          {row(t.dest_phone,flight.dest_phone,true)}
          {row(t.dest_email,flight.dest_email,true)}
        </>;})()}
      </div>
      <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"12px 0 8px",textTransform:"uppercase"}}>{t.operations_in_flight} ({flightOps.length})</p>
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 14px"}}>
        {flightOps.map(fo=>{const opPkgs=packages.filter(p=>p.operation_id===fo.operation_id);const w=opPkgs.reduce((s,p)=>s+(Number(p.gross_weight_kg||0)*Number(p.quantity||1)),0);const opCode=opPkgs[0]?.operations?.operation_code||"OP";const clientCode=opPkgs[0]?.operations?.clients?.client_code||"";return <div key={fo.id} style={{padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:opPkgs.length>0?8:0}}>
            <span style={{fontSize:13,fontWeight:600,color:"#fff"}}>{opCode} — {clientCode}</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{w.toFixed(2)} kg{fo.cost_share_usd?` · ${usdF(fo.cost_share_usd)}`:""}</span>
          </div>
          {opPkgs.length>0&&<div style={{paddingLeft:12,borderLeft:"2px solid rgba(184,149,106,0.2)",marginLeft:4}}>
            {opPkgs.map((p,i)=>{const q=Number(p.quantity||1);const gw=Number(p.gross_weight_kg||0);const l=Number(p.length_cm||0),wd=Number(p.width_cm||0),h=Number(p.height_cm||0);const hasDims=l&&wd&&h;const nt=p.national_tracking||"";return <div key={p.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",fontSize:11,color:"rgba(255,255,255,0.7)",gap:10,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{minWidth:22,color:IC,fontWeight:700}}>#{p.package_number||i+1}</span>
                {nt&&<span style={{fontFamily:"monospace",background:"rgba(184,149,106,0.1)",padding:"2px 7px",borderRadius:4,color:IC,fontSize:10,border:"1px solid rgba(184,149,106,0.2)"}}>{nt}</span>}
              </div>
              <span style={{color:"rgba(255,255,255,0.55)",textAlign:"right"}}>{q>1?`${q}× `:""}{hasDims?`${l}×${wd}×${h} cm`:"— cm"}{gw>0?` · ${gw.toFixed(2)} kg`:""}</span>
            </div>;})}
          </div>}
        </div>;})}
      </div>
    </div>
    {invoiceItems.length>0&&<Card title={t.invoice}>
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 14px"}}>
        <div style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr 1fr",gap:8,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.08)",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>
          <span>Descripción</span><span>HS Code</span><span style={{textAlign:"right"}}>Cant.</span><span style={{textAlign:"right"}}>Unit. USD</span><span style={{textAlign:"right"}}>Total</span>
        </div>
        {invoiceItems.map(it=><div key={it.id} style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr 1fr 1fr",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:12,color:"rgba(255,255,255,0.85)"}}>
          <span>{it.description}</span>
          <span style={{fontFamily:"monospace"}}>{it.hs_code||"—"}</span>
          <span style={{textAlign:"right"}}>{Number(it.quantity||0)}</span>
          <span style={{textAlign:"right"}}>USD {Number(it.unit_price_declared_usd||0).toFixed(2)}</span>
          <span style={{textAlign:"right",fontWeight:700}}>USD {(Number(it.quantity||0)*Number(it.unit_price_declared_usd||0)).toFixed(2)}</span>
        </div>)}
        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 4px",marginTop:4,borderTop:"1px solid rgba(184,149,106,0.3)"}}>
          <span style={{fontSize:12,fontWeight:700,color:"#fff"}}>TOTAL</span>
          <span style={{fontSize:14,fontWeight:700,color:IC}}>USD {invoiceItems.reduce((s,it)=>s+Number(it.quantity||0)*Number(it.unit_price_declared_usd||0),0).toFixed(2)}</span>
        </div>
      </div>
    </Card>}
    {flight.status==="preparando"&&!flight.invoice_presented_at&&<div style={{padding:"14px 18px",background:"rgba(251,191,36,0.08)",border:"1.5px solid rgba(251,191,36,0.25)",borderRadius:10,marginBottom:14}}>
      <p style={{fontSize:13,fontWeight:700,color:"#fbbf24",margin:0}}>⏳ Esperando factura de Argencargo</p>
      <p style={{fontSize:12,color:"rgba(255,255,255,0.5)",margin:"4px 0 0"}}>{t.flight_waiting_msg}</p>
    </div>}
    {flight.status==="preparando"&&flight.invoice_presented_at&&<Card title={t.dispatch_form}>
      {err&&<div style={{padding:"10px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:10,fontSize:13,color:"#ff6b6b",marginBottom:14}}>{err}</div>}
      <div style={{background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.15)",borderRadius:8,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{t.weight_from_packages}</span>
        <span style={{fontSize:16,fontWeight:700,color:IC}}>{autoWeight.toFixed(2)} kg</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
        <Inp label={t.total_cost} type="number" value={totalCost} onChange={setTotalCost} req placeholder="500"/>
        <Inp label={t.intl_tracking} value={tracking} onChange={setTracking} req placeholder="1Z999AA10123456784"/>
        <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",marginBottom:5}}>{t.courier}</label>
          <select value={carrier} onChange={e=>setCarrier(e.target.value)} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}>
            {["DHL","FedEx","UPS"].map(c=><option key={c} value={c} style={{background:"#142038"}}>{c}</option>)}
          </select>
        </div>
        <div style={{marginBottom:14}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",marginBottom:5}}>{t.payment_method_label}</label>
          <select value={pmtMethod} onChange={e=>setPmtMethod(e.target.value)} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}>
            <option value="cuenta_corriente" style={{background:"#142038"}}>{t.method_cc}</option>
            <option value="efectivo" style={{background:"#142038"}}>{t.method_cash}</option>
            <option value="transferencia" style={{background:"#142038"}}>{t.method_transfer}</option>
          </select>
        </div>
      </div>
      {!confirmDispatch?<Btn onClick={()=>setConfirmDispatch(true)} disabled={saving||!totalCost||!tracking||autoWeight<=0}>{t.confirm_dispatch}</Btn>:
      <div style={{padding:"14px 18px",background:"rgba(251,191,36,0.1)",border:"1.5px solid rgba(251,191,36,0.35)",borderRadius:10}}>
        <p style={{fontSize:13,color:"#fbbf24",margin:"0 0 12px",fontWeight:600}}>{t.dispatch_warning}</p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={dispatch} disabled={saving} style={{flex:1,padding:"10px",fontSize:13,fontWeight:700,border:"none",borderRadius:8,cursor:saving?"not-allowed":"pointer",background:"rgba(251,191,36,0.25)",color:"#fbbf24"}}>{saving?t.saving:t.confirm}</button>
          <button onClick={()=>setConfirmDispatch(false)} disabled={saving} style={{flex:1,padding:"10px",fontSize:13,fontWeight:700,border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:8,cursor:"pointer",background:"transparent",color:"rgba(255,255,255,0.5)"}}>{t.cancel}</button>
        </div>
      </div>}
    </Card>}
    {flight.status!=="preparando"&&<div style={{padding:"14px 18px",background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:10}}>
      <p style={{fontSize:11,fontWeight:700,color:IC,margin:"0 0 8px",textTransform:"uppercase"}}>{t.dispatch_data}</p>
      <div style={{display:"flex",gap:24,flexWrap:"wrap",fontSize:12,color:"rgba(255,255,255,0.6)"}}>
        <span><strong style={{color:"#fff"}}>{t.total_weight}:</strong> {flight.total_weight_kg} kg</span>
        <span><strong style={{color:"#fff"}}>{t.total_cost}:</strong> {usdF(flight.total_cost_usd)}</span>
        <span><strong style={{color:"#fff"}}>{t.courier}:</strong> {flight.international_carrier}</span>
        <span><strong style={{color:"#fff"}}>{t.intl_tracking}:</strong> {flight.international_tracking}</span>
      </div>
    </div>}
  </div>;
}

function NotifBell({token,t}){
  const [open,setOpen]=useState(false);
  const [notifs,setNotifs]=useState([]);
  const [unread,setUnread]=useState(0);
  const load=async()=>{
    const r=await dq("notifications",{token,filters:"?select=*&order=created_at.desc&limit=20"});
    const arr=Array.isArray(r)?r:[];setNotifs(arr);setUnread(arr.filter(n=>!n.read).length);
  };
  useEffect(()=>{load();const iv=setInterval(load,60000);return()=>clearInterval(iv);},[token]);
  const markRead=async(id)=>{await dq("notifications",{method:"PATCH",token,filters:`?id=eq.${id}`,body:{read:true}});load();};
  const markAllRead=async()=>{const ids=notifs.filter(n=>!n.read).map(n=>n.id);for(const id of ids)await dq("notifications",{method:"PATCH",token,filters:`?id=eq.${id}`,body:{read:true}});load();};
  return <div style={{position:"relative"}}>
    <button onClick={()=>setOpen(!open)} style={{background:"none",border:"none",cursor:"pointer",padding:6,position:"relative"}}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      {unread>0&&<span style={{position:"absolute",top:2,right:2,background:"#ff4444",color:"#fff",fontSize:9,fontWeight:700,borderRadius:10,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{unread}</span>}
    </button>
    {open&&<div style={{position:"fixed",right:16,top:70,width:"min(340px, calc(100vw - 32px))",maxHeight:400,overflow:"auto",background:"#142038",border:"1.5px solid rgba(184,149,106,0.3)",borderRadius:12,boxShadow:"0 10px 40px rgba(0,0,0,0.5)",zIndex:1000}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <span style={{fontSize:12,fontWeight:700,color:"#fff"}}>Notificaciones</span>
        {unread>0&&<button onClick={markAllRead} style={{fontSize:10,color:IC,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>{t?.mark_all_read||"Marcar todas leídas"}</button>}
      </div>
      {notifs.length===0?<p style={{padding:"2rem",textAlign:"center",color:"rgba(255,255,255,0.4)",fontSize:12,margin:0}}>{t?.no_notifs||"Sin notificaciones"}</p>:
      notifs.map(n=><div key={n.id} onClick={()=>{markRead(n.id);setOpen(false);if(n.link)window.location.search=n.link;}} style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:n.link?"pointer":"default",background:n.read?"transparent":"rgba(184,149,106,0.06)"}}>
        <p style={{fontSize:12,fontWeight:n.read?400:700,color:n.read?"rgba(255,255,255,0.5)":"#fff",margin:"0 0 2px"}}>{n.title}</p>
        {n.body&&<p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"0 0 2px"}}>{n.body}</p>}
        <p style={{fontSize:10,color:"rgba(255,255,255,0.3)",margin:0}}>{new Date(n.created_at).toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</p>
      </div>)}
    </div>}
  </div>;
}

function SimpleShell({children,lang,setLang,t,onLogout,token}){
  return <div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif"}}>
    <style dangerouslySetInnerHTML={{__html:`
      @media(max-width:768px){
        .ac-agente-header{padding:14px 16px!important;gap:8px!important}
        .ac-agente-header img{height:30px!important}
        .ac-agente-header button{padding:6px 10px!important;font-size:11px!important}
        .ac-agente-main{padding:20px 16px!important;max-width:100vw!important;box-sizing:border-box!important}
        h2{font-size:20px!important}
        h3{font-size:13px!important}
        table{font-size:11.5px!important}
        table td,table th{padding:9px 8px!important;white-space:nowrap!important}
        .ac-agente-tabs{overflow-x:auto!important;-webkit-overflow-scrolling:touch;flex-wrap:nowrap!important;scrollbar-width:none}
        .ac-agente-tabs::-webkit-scrollbar{display:none}
        .ac-agente-tabs button{flex-shrink:0!important}
      }
    `}}/>
    <div className="ac-agente-header" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 28px",background:"rgba(0,0,0,0.35)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(255,255,255,0.06)",flexWrap:"wrap",gap:12,position:"sticky",top:0,zIndex:10}}>
      <img src={LOGO} alt="AC" style={{height:36,objectFit:"contain",filter:"drop-shadow(0 2px 12px rgba(184,149,106,0.22))"}}/>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        {token&&<NotifBell token={token} t={t}/>}
        <LangToggle lang={lang} setLang={setLang}/>
        <button onClick={onLogout} style={{padding:"7px 14px",fontSize:11.5,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:600,letterSpacing:"0.04em",transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.35)";e.currentTarget.style.color=GOLD_LIGHT;}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(255,255,255,0.5)";}}>{t.logout}</button>
      </div>
    </div>
    <div className="ac-agente-main" style={{maxWidth:1200,margin:"0 auto",padding:"32px 28px"}}>{children}</div>
  </div>;
}

// Botón "📷 Escanear" — saca foto al sticker, OCR via OpenAI Vision, autocompleta tracking
function TrackingScanButton({onDetected,t}){
  const [scanning,setScanning]=useState(false);
  const ref=useRef(null);
  const handleFile=async(file)=>{
    if(!file)return;setScanning(true);
    try{
      const reader=new FileReader();
      const dataUrl=await new Promise((res,rej)=>{reader.onload=()=>res(reader.result);reader.onerror=rej;reader.readAsDataURL(file);});
      const r=await fetch("/api/ocr-tracking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image_base64:dataUrl})});
      const j=await r.json();
      if(j?.tracking){onDetected(j.tracking);toast(`✅ ${t.scan_detected||"Detectado"}: ${j.tracking}`,"success");}
      else{toast(`⚠️ ${t.scan_not_found||"No se detectó tracking. Cargalo a mano."}`,"error");}
    }catch(e){toast("❌ "+e.message,"error");}
    setScanning(false);
    if(ref.current)ref.current.value="";
  };
  return <>
    <input ref={ref} type="file" accept="image/*" capture="environment" onChange={e=>handleFile(e.target.files?.[0])} style={{display:"none"}}/>
    <button type="button" onClick={()=>ref.current?.click()} disabled={scanning} title={t.scan_tracking||"Escanear tracking con foto"} style={{padding:"10px 14px",fontSize:12,fontWeight:600,borderRadius:10,border:`1px solid ${scanning?"rgba(255,255,255,0.1)":"rgba(91,155,213,0.4)"}`,background:scanning?"rgba(255,255,255,0.04)":"rgba(91,155,213,0.1)",color:scanning?"rgba(255,255,255,0.4)":"#5b9bd5",cursor:scanning?"wait":"pointer",whiteSpace:"nowrap",height:42,boxSizing:"border-box"}}>{scanning?"…":"📷 "+(t.scan||"Escanear")}</button>
  </>;
}

// Configuración de Web Push notifications del agente (sin terceros, gratis, funciona en China)
// Hook reutilizable: estado de notificaciones + auto-subscribe si permission ya está granted
function usePushStatus(token){
  const [supported,setSupported]=useState(false);
  const [permission,setPermission]=useState("default");
  const [subscribed,setSubscribed]=useState(false);
  const VAPID_PUB=typeof process!=="undefined"?(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||""):"";
  useEffect(()=>{
    if(typeof window==="undefined")return;
    const ok="serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window;
    setSupported(ok);
    if(!ok)return;
    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then(reg=>reg.pushManager.getSubscription()).then(async sub=>{
      setSubscribed(!!sub);
      // Auto-subscribe si permission ya está granted pero no hay subscription (re-instaló app, limpió datos, etc.)
      if(!sub&&Notification.permission==="granted"&&VAPID_PUB&&token){
        try{
          const urlBase64ToUint8Array=(b64)=>{const pad="=".repeat((4-b64.length%4)%4);const s=(b64+pad).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(s);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;};
          const reg2=await navigator.serviceWorker.ready;
          const newSub=await reg2.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUB)});
          await fetch("/api/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({subscription:newSub.toJSON(),portal:"agente"})});
          setSubscribed(true);
        }catch(e){}
      }
    }).catch(()=>{});
  },[token]);
  return {supported,permission,subscribed,setSubscribed,setPermission,VAPID_PUB};
}

// Banner persistente arriba del Dashboard cuando notifs no están activas
function PushNagBanner({token,t}){
  const {supported,permission,subscribed,setSubscribed,setPermission,VAPID_PUB}=usePushStatus(token);
  const [busy,setBusy]=useState(false);
  // Detectar plataforma y standalone (PWA instalada vs navegador)
  const ua=typeof navigator!=="undefined"?navigator.userAgent:"";
  const isIOS=typeof window!=="undefined"&&/iPad|iPhone|iPod/.test(ua)&&!window.MSStream;
  const isAndroid=/Android/i.test(ua);
  const isStandalone=typeof window!=="undefined"&&(window.matchMedia?.("(display-mode: standalone)").matches||window.navigator.standalone===true);
  const iosNeedsInstall=isIOS&&!isStandalone;
  // Android: detectar si se puede instalar (beforeinstallprompt event de Chrome)
  const [installPromptEvent,setInstallPromptEvent]=useState(null);
  useEffect(()=>{
    if(typeof window==="undefined")return;
    const handler=(e)=>{e.preventDefault();setInstallPromptEvent(e);};
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);
  const androidNeedsInstall=isAndroid&&!isStandalone;
  const triggerInstall=async()=>{
    if(!installPromptEvent)return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  };
  // Auto-mostrar prompt 2s después de cargar (solo si permission===default Y no es iOS sin instalar)
  useEffect(()=>{
    if(!supported||subscribed||permission!=="default"||!VAPID_PUB||!token||iosNeedsInstall||androidNeedsInstall)return;
    const tm=setTimeout(()=>activate(),2000);
    return()=>clearTimeout(tm);
  },[supported,subscribed,permission,VAPID_PUB,token,iosNeedsInstall,androidNeedsInstall]);
  const activate=async()=>{
    if(!VAPID_PUB){return;}
    setBusy(true);
    try{
      let perm=Notification.permission;
      if(perm==="default"){perm=await Notification.requestPermission();setPermission(perm);}
      if(perm!=="granted"){setBusy(false);return;}
      const urlBase64ToUint8Array=(b64)=>{const pad="=".repeat((4-b64.length%4)%4);const s=(b64+pad).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(s);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;};
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUB)});
      await fetch("/api/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({subscription:sub.toJSON(),portal:"agente"})});
      setSubscribed(true);
    }catch(e){}
    setBusy(false);
  };
  if(subscribed)return null;
  // Caso especial Android: si no está instalada, mostrar instrucciones / botón nativo
  if(androidNeedsInstall){
    return <div style={{background:"linear-gradient(135deg,rgba(91,155,213,0.18),rgba(91,155,213,0.05))",border:"1.5px solid rgba(91,155,213,0.5)",borderRadius:12,padding:"14px 18px",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:installPromptEvent?12:8}}>
        <span style={{fontSize:24}}>📲</span>
        <div style={{flex:1}}>
          <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>{t.push_android_install_title||"Instalá la app en tu pantalla de inicio"}</p>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.75)",margin:"3px 0 0",lineHeight:1.5}}>{t.push_android_install_msg||"Para recibir notificaciones, primero instalá la app desde Chrome."}</p>
        </div>
      </div>
      {installPromptEvent?<button onClick={triggerInstall} style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:8,border:`1px solid ${GOLD_DEEP}`,background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer"}}>{t.push_android_install_btn||"📥 Instalar app"}</button>:<ol style={{margin:"8px 0 0",paddingLeft:24,fontSize:12,color:"rgba(255,255,255,0.85)",lineHeight:1.7}}>
        <li>{t.push_android_step1||"Tocá los 3 puntos arriba a la derecha en Chrome"} <strong style={{display:"inline-block",padding:"0 6px",border:"1px solid rgba(255,255,255,0.4)",borderRadius:3,fontSize:10,marginLeft:4,verticalAlign:"middle"}}>⋮</strong></li>
        <li>{t.push_android_step2||"Tocá «Instalar app» o «Agregar a pantalla principal»"}</li>
        <li>{t.push_android_step3||"Abrí Argencargo desde el ícono que apareció — NO desde Chrome"}</li>
        <li>{t.push_android_step4||"Volvé acá y se activarán las notificaciones automáticamente"}</li>
      </ol>}
    </div>;
  }
  // Caso especial iOS: necesita instalar PWA primero antes de poder activar push
  if(iosNeedsInstall){
    return <div style={{background:"linear-gradient(135deg,rgba(91,155,213,0.18),rgba(91,155,213,0.05))",border:"1.5px solid rgba(91,155,213,0.5)",borderRadius:12,padding:"14px 18px",marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
        <span style={{fontSize:24}}>📲</span>
        <div style={{flex:1}}>
          <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>{t.push_ios_install_title||"Instalá la app en tu pantalla de inicio"}</p>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.75)",margin:"3px 0 0",lineHeight:1.5}}>{t.push_ios_install_msg||"En iPhone, las notificaciones solo funcionan después de instalar la app desde el menú compartir."}</p>
        </div>
      </div>
      <ol style={{margin:"8px 0 0",paddingLeft:24,fontSize:12,color:"rgba(255,255,255,0.85)",lineHeight:1.7}}>
        <li>{t.push_ios_step1||"Tocá el botón de compartir en la barra inferior de Safari"} <strong style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,border:"1px solid rgba(255,255,255,0.4)",borderRadius:4,fontSize:10,marginLeft:4,verticalAlign:"middle"}}>⬆️</strong></li>
        <li>{t.push_ios_step2||"Buscá y tocá «Agregar a inicio» (Add to Home Screen)"}</li>
        <li>{t.push_ios_step3||"Abrí Argencargo desde el ícono que apareció en tu home — NO desde Safari"}</li>
        <li>{t.push_ios_step4||"Volvé acá y aparecerá el botón para activar notificaciones"}</li>
      </ol>
    </div>;
  }
  if(!supported)return null;
  const isDenied=permission==="denied";
  return <div style={{background:isDenied?"linear-gradient(135deg,rgba(248,113,113,0.18),rgba(248,113,113,0.05))":"linear-gradient(135deg,rgba(251,191,36,0.18),rgba(251,191,36,0.05))",border:`1.5px solid ${isDenied?"rgba(248,113,113,0.5)":"rgba(251,191,36,0.5)"}`,borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
    <div style={{flex:1,minWidth:200,display:"flex",alignItems:"center",gap:12}}>
      <span style={{fontSize:24}}>🔔</span>
      <div>
        <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>{isDenied?(t.push_nag_denied_title||"Notificaciones bloqueadas"):(t.push_nag_title||"Activá las notificaciones")}</p>
        <p style={{fontSize:12,color:"rgba(255,255,255,0.7)",margin:"3px 0 0",lineHeight:1.4}}>{isDenied?(t.push_nag_denied_msg||"Activalas desde los ajustes del navegador para recibir avisos de nuevos vuelos."):(t.push_nag_msg||"Necesarias para recibir avisos cuando admin crea o despacha vuelos.")}</p>
      </div>
    </div>
    {!isDenied&&<button onClick={activate} disabled={busy} style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:8,border:`1px solid ${GOLD_DEEP}`,background:GOLD_GRADIENT,color:"#0A1628",cursor:busy?"wait":"pointer",whiteSpace:"nowrap"}}>{busy?"...":(t.push_activate_now||"Activar ahora")}</button>}
  </div>;
}

function PushSetup({token,signup,t}){
  const {supported,permission,subscribed,setSubscribed,setPermission,VAPID_PUB}=usePushStatus(token);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState("");
  const urlBase64ToUint8Array=(b64)=>{const pad="=".repeat((4-b64.length%4)%4);const s=(b64+pad).replace(/-/g,"+").replace(/_/g,"/");const raw=atob(s);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;};
  const subscribe=async()=>{
    if(!VAPID_PUB){setMsg("❌ Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en variables de entorno");return;}
    setBusy(true);setMsg("");
    try{
      let perm=Notification.permission;
      if(perm==="default"){perm=await Notification.requestPermission();setPermission(perm);}
      if(perm!=="granted"){setMsg("❌ "+(t.push_denied||"Permiso denegado. Habilitalo en ajustes del navegador."));setBusy(false);return;}
      const reg=await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUB)});
      const r=await fetch("/api/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({subscription:sub.toJSON(),portal:"agente"})});
      const j=await r.json();
      if(j.ok){setSubscribed(true);setMsg("✅ "+(t.push_enabled||"Notificaciones activadas"));}
      else{setMsg("❌ "+(j.error||"error"));}
    }catch(e){setMsg("❌ "+e.message);}
    setBusy(false);
  };
  const test=async()=>{setBusy(true);setMsg("");
    try{const r=await fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:signup.auth_user_id,title:t.push_test_title||"Test Argencargo",body:t.push_test_body||"Notificaciones funcionando ✅",url:"/agente"})});const j=await r.json();setMsg(j.ok&&j.sent>0?"✅ "+(t.push_test_ok||"Enviada — revisá tu celular"):j.skipped==="no_subscriptions"?"⚠️ "+(t.push_no_subs||"No hay dispositivos suscritos"):"❌ "+(j.error||"error"));}catch(e){setMsg("❌ "+e.message);}
    setBusy(false);};
  if(!supported)return <div style={{background:"rgba(251,191,36,0.05)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:12,padding:"12px 14px",marginBottom:16}}>
    <p style={{fontSize:12,color:"#fbbf24",margin:0}}>⚠️ {t.push_unsupported||"Tu navegador no soporta notificaciones. Usá Chrome o Edge en Android, o Safari en iOS 16.4+."}</p>
  </div>;
  return <div style={{background:subscribed?"rgba(34,197,94,0.05)":"rgba(91,155,213,0.06)",border:`1px solid ${subscribed?"rgba(34,197,94,0.2)":"rgba(91,155,213,0.25)"}`,borderRadius:12,padding:"14px 16px",marginBottom:16}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:200}}>
        <p style={{fontSize:13,fontWeight:700,color:"#fff",margin:0,display:"flex",alignItems:"center",gap:8}}>🔔 {t.push_title||"Notificaciones en este dispositivo"} {subscribed&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(34,197,94,0.2)",color:"#22c55e",border:"1px solid rgba(34,197,94,0.4)",fontWeight:700}}>ON</span>}</p>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:"3px 0 0",lineHeight:1.5}}>{subscribed?(t.push_subtitle_on||"Recibís avisos cuando admin crea/despacha vuelos. Sin apps externas, sin chats.") :(t.push_subtitle_off||"Activá las notificaciones para recibir avisos directo al celular cuando admin asigne un nuevo vuelo o cambie algo.")}</p>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {!subscribed&&<button onClick={subscribe} disabled={busy} style={{padding:"8px 14px",fontSize:12,fontWeight:700,borderRadius:8,border:`1px solid ${GOLD_DEEP}`,background:GOLD_GRADIENT,color:"#0A1628",cursor:busy?"wait":"pointer"}}>{busy?"...":(t.push_enable||"Activar")}</button>}
        {subscribed&&<button onClick={test} disabled={busy} style={{padding:"8px 14px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(91,155,213,0.4)",background:"rgba(91,155,213,0.1)",color:"#5b9bd5",cursor:busy?"wait":"pointer"}}>{busy?"...":(t.push_test||"Probar 🧪")}</button>}
      </div>
    </div>
    {msg&&<p style={{fontSize:11,color:msg.startsWith("✅")?"#22c55e":msg.startsWith("⚠️")?"#fbbf24":"#ff6b6b",margin:"8px 0 0"}}>{msg}</p>}
  </div>;
}

// Celda de foto de paquete: muestra thumbnail si hay, o badge "pendiente" con upload si no.
// Click en thumbnail abre lightbox. Click en upload selecciona file y sube + actualiza package.
function PackagePhotoCell({pkg,token,t,onUpdated}){
  const [uploading,setUploading]=useState(false);
  const [lightbox,setLightbox]=useState(false);
  const upload=async(file)=>{
    if(!file)return;
    setUploading(true);
    const url=await uploadPackagePhoto(file,token);
    if(url){
      // Determinar tabla: operation_packages u unassigned_packages
      const table=pkg.operation_id?"operation_packages":"unassigned_packages";
      await dq(table,{method:"PATCH",token,filters:`?id=eq.${pkg.id}`,body:{photo_url:url,photo_uploaded_at:new Date().toISOString()}});
      onUpdated&&onUpdated();
    }else{
      alert(t.upload_failed);
    }
    setUploading(false);
  };
  if(pkg.photo_url){
    return <>
      <img src={pkg.photo_url} alt="" onClick={()=>setLightbox(true)} style={{width:42,height:42,objectFit:"cover",borderRadius:6,border:"1px solid rgba(34,197,94,0.4)",cursor:"pointer"}}/>
      {lightbox&&<div onClick={()=>setLightbox(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,cursor:"zoom-out"}}>
        <img src={pkg.photo_url} alt="" style={{maxWidth:"95vw",maxHeight:"95vh",objectFit:"contain",borderRadius:8}}/>
      </div>}
    </>;
  }
  return <>
    <input id={`reup-${pkg.id}`} type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);}} style={{display:"none"}} disabled={uploading}/>
    <label htmlFor={`reup-${pkg.id}`} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 9px",fontSize:10,fontWeight:700,borderRadius:6,border:"1px solid rgba(251,191,36,0.4)",background:"rgba(251,191,36,0.1)",color:"#fbbf24",cursor:uploading?"wait":"pointer",letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap",opacity:uploading?0.5:1}}>{uploading?"…":`📷 ${t.photo_pending}`}</label>
  </>;
}

function NewPackageForm({token,lang,t,agentId,onCancel,onSaved}){
  const [allClients,setAllClients]=useState([]);
  const [clientSearch,setClientSearch]=useState("");
  const [clientId,setClientId]=useState("");// "" = no seleccionado, "unregistered" = no registrado, uuid = cliente
  const [showDrop,setShowDrop]=useState(false);
  const [existingOp,setExistingOp]=useState(null);
  const [tracking,setTracking]=useState("");
  const [bultos,setBultos]=useState([{weight:"",length:"",width:"",height:"",photo:null,photoPreview:null}]);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");

  // Cargar todos los clientes
  useEffect(()=>{if(!token)return;(async()=>{const cl=await dq("clients",{token,filters:"?select=id,first_name,last_name,client_code&order=client_code.asc"});if(!Array.isArray(cl)){console.error("[agente] error cargando clientes:",cl);setAllClients([]);return;}setAllClients(cl);})();},[token]);

  const selectedClient=allClients.find(c=>c.id===clientId);

  // Filtro de búsqueda
  const filtered=clientSearch.trim()?allClients.filter(c=>{const s=clientSearch.toLowerCase();return c.client_code?.toLowerCase().includes(s)||c.first_name?.toLowerCase().includes(s)||c.last_name?.toLowerCase().includes(s);}).slice(0,50):allClients.slice(0,50);

  // Buscar op abierta cuando se selecciona cliente.
  // Regla: si hay una op del mismo cliente en estado pre-vuelo (depósito o preparación),
  // se reutiliza — los nuevos bultos se agregan a ella aunque ya esté consolidada
  // (mientras no haya despachado, podemos seguir sumando paquetes).
  useEffect(()=>{if(!clientId||clientId==="unregistered"){setExistingOp(null);return;}(async()=>{
    const ops=await dq("operations",{token,filters:`?client_id=eq.${clientId}&channel=eq.aereo_blanco&status=in.(en_deposito_origen,en_preparacion)&select=id,operation_code,status&order=created_at.desc&limit=1`});
    setExistingOp(Array.isArray(ops)&&ops[0]?ops[0]:null);
  })();},[clientId,token]);

  const addBulto=()=>setBultos(p=>[...p,{weight:"",length:"",width:"",height:"",photo:null,photoPreview:null}]);
  const rmBulto=(i)=>setBultos(p=>p.filter((_,j)=>j!==i));
  const chBulto=(i,f,v)=>setBultos(p=>p.map((b,j)=>j===i?{...b,[f]:v}:b));
  const setPhoto=(i,file)=>{
    if(!file){setBultos(p=>p.map((b,j)=>j===i?{...b,photo:null,photoPreview:null}:b));return;}
    const reader=new FileReader();
    reader.onload=ev=>setBultos(p=>p.map((b,j)=>j===i?{...b,photo:file,photoPreview:ev.target.result}:b));
    reader.readAsDataURL(file);
  };

  const save=async()=>{
    if(!clientId){setErr(t.err_client);return;}
    if(!tracking?.trim()){setErr(t.err_tracking);return;}
    setErr("");setSaving(true);
    try {
      const validBultos=bultos.filter(b=>b.weight||b.length||b.width||b.height||true); // todos cuentan, opcional
      if(clientId==="unregistered"){
        // Insertar en unassigned_packages, una entry por bulto. Subir foto antes (si hay).
        for(let i=0;i<validBultos.length;i++){const b=validBultos[i];const body={national_tracking:tracking.trim(),package_number:i+1,quantity:1,registered_by_agent_id:agentId};
          if(b.weight)body.gross_weight_kg=Number(b.weight);if(b.length)body.length_cm=Number(b.length);if(b.width)body.width_cm=Number(b.width);if(b.height)body.height_cm=Number(b.height);
          if(b.photo){const url=await uploadPackagePhoto(b.photo,token);if(url){body.photo_url=url;body.photo_uploaded_at=new Date().toISOString();}}
          await dq("unassigned_packages",{method:"POST",token,body});
        }
        // Notificar al admin: paquete huérfano recibido
        try{
          const adm=await dq("profiles",{token,filters:"?role=eq.admin&select=id&limit=1"});
          const adminId=Array.isArray(adm)&&adm[0]?adm[0].id:null;
          if(adminId){
            await dq("notifications",{method:"POST",token,body:{user_id:adminId,portal:"admin",title:`📦 Paquete huérfano recibido`,body:`Sin cliente asignado · Tracking: ${tracking.trim()} · ${validBultos.length} bulto${validBultos.length>1?"s":""}`,link:null}});
          }
        }catch(e){console.error("notif error",e);}
        onSaved();return;
      }
      // Cliente registrado
      let opId;
      if(existingOp){opId=existingOp.id;}
      else {
        // Usar función SECURITY DEFINER para obtener próximo código (agente no puede ver todas las ops por RLS)
        const rpc=await dq("rpc/next_operation_code",{method:"POST",token,body:{}});
        const newCode=typeof rpc==="string"?rpc:null;
        if(!newCode){setErr(t.err_generic);setSaving(false);return;}
        const r=await dq("operations",{method:"POST",token,body:{operation_code:newCode,client_id:clientId,channel:"aereo_blanco",status:"en_deposito_origen",origin:"China",created_by_agent_id:agentId}});
        const created=Array.isArray(r)?r[0]:r;
        if(!created?.id){setErr(t.err_generic);setSaving(false);return;}
        opId=created.id;
      }
      const pkgs=await dq("operation_packages",{token,filters:`?operation_id=eq.${opId}&select=package_number&order=package_number.desc&limit=1`});
      const lastNum=Array.isArray(pkgs)&&pkgs[0]?Number(pkgs[0].package_number)||0:0;
      for(let i=0;i<validBultos.length;i++){const b=validBultos[i];const body={operation_id:opId,package_number:lastNum+i+1,quantity:1,national_tracking:tracking.trim()};
        if(b.weight)body.gross_weight_kg=Number(b.weight);if(b.length)body.length_cm=Number(b.length);if(b.width)body.width_cm=Number(b.width);if(b.height)body.height_cm=Number(b.height);
        if(b.photo){const url=await uploadPackagePhoto(b.photo,token);if(url){body.photo_url=url;body.photo_uploaded_at=new Date().toISOString();}}
        await dq("operation_packages",{method:"POST",token,body});
      }
      // Notificar al admin: paquete recibido en depósito
      try{
        const sel=allClients.find(c=>c.id===clientId);
        const clName=sel?`${sel.client_code} - ${(sel.first_name||"").trim()}`:"cliente";
        const adm=await dq("profiles",{token,filters:"?role=eq.admin&select=id&limit=1"});
        const adminId=Array.isArray(adm)&&adm[0]?adm[0].id:null;
        if(adminId){
          await dq("notifications",{method:"POST",token,body:{user_id:adminId,portal:"admin",title:`📦 Paquete recibido en depósito`,body:`${clName} · Tracking: ${tracking.trim()} · ${validBultos.length} bulto${validBultos.length>1?"s":""}`,link:null}});
        }
      }catch(e){console.error("notif error",e);}
      onSaved();
    } catch(e){console.error(e);setErr(t.err_generic);}
    setSaving(false);
  };

  return <div style={{background:"rgba(255,255,255,0.028)",borderRadius:14,border:"1.5px solid rgba(184,149,106,0.25)",padding:"1.5rem"}}>
    <h3 style={{fontSize:16,fontWeight:700,color:"#fff",margin:"0 0 18px"}}>{t.new_package}</h3>
    {err&&<div style={{padding:"10px 14px",background:"rgba(255,80,80,0.12)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:10,fontSize:13,color:"#ff6b6b",marginBottom:14}}>{err}</div>}

    <div style={{marginBottom:14,position:"relative"}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",marginBottom:5}}>{t.select_client}<span style={{color:"#ff6b6b"}}> *</span></label>
      <button type="button" onClick={()=>setShowDrop(!showDrop)} style={{width:"100%",padding:"11px 14px",fontSize:14,boxSizing:"border-box",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(255,255,255,0.06)",color:selectedClient||clientId==="unregistered"?"#fff":"rgba(255,255,255,0.4)",outline:"none",textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>{clientId==="unregistered"?`📦 ${t.unregistered_client}`:selectedClient?`${selectedClient.client_code} - ${selectedClient.first_name||""} ${selectedClient.last_name||""}`:t.select_client}</span>
        <span>{showDrop?"▲":"▼"}</span>
      </button>
      {showDrop&&<div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,background:"#142038",border:"1.5px solid rgba(184,149,106,0.3)",borderRadius:10,maxHeight:300,overflow:"auto",zIndex:10,boxShadow:"0 10px 30px rgba(0,0,0,0.5)"}}>
        <div style={{padding:8,borderBottom:"1px solid rgba(255,255,255,0.06)"}}><input value={clientSearch} onChange={e=>setClientSearch(e.target.value)} placeholder={t.search_client} autoFocus style={{width:"100%",padding:"8px 10px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,background:"rgba(255,255,255,0.06)",color:"#fff",outline:"none"}}/></div>
        <button type="button" onClick={()=>{setClientId("unregistered");setShowDrop(false);setClientSearch("");}} style={{display:"block",width:"100%",padding:"10px 14px",fontSize:13,fontWeight:600,border:"none",background:clientId==="unregistered"?"rgba(184,149,106,0.15)":"transparent",color:"#fbbf24",cursor:"pointer",textAlign:"left",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>📦 {t.unregistered_client}</button>
        {filtered.map(c=><button key={c.id} type="button" onClick={()=>{setClientId(c.id);setShowDrop(false);setClientSearch("");}} style={{display:"block",width:"100%",padding:"10px 14px",fontSize:13,border:"none",background:clientId===c.id?"rgba(184,149,106,0.15)":"transparent",color:"#fff",cursor:"pointer",textAlign:"left"}}>
          <span style={{fontFamily:"monospace",fontWeight:700,color:IC}}>{c.client_code}</span>
          <span style={{color:"rgba(255,255,255,0.5)",marginLeft:8}}>{c.first_name||""} {c.last_name||""}</span>
        </button>)}
        {filtered.length===0&&<p style={{padding:"10px 14px",fontSize:12,color:"rgba(255,255,255,0.4)",margin:0}}>{t.client_not_found}</p>}
      </div>}
    </div>

    {clientId==="unregistered"&&<div style={{padding:"10px 14px",background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:10,marginBottom:14}}>
      <p style={{fontSize:12,color:"#fbbf24",margin:0,fontWeight:600}}>⚠ {t.unregistered_info}</p>
    </div>}
    {selectedClient&&existingOp&&<div style={{padding:"10px 14px",background:"rgba(184,149,106,0.08)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:10,marginBottom:14}}>
      <p style={{fontSize:12,color:IC,margin:0,fontWeight:600}}>ℹ {t.consolidation_info} <strong>{existingOp.operation_code}</strong></p>
    </div>}
    {selectedClient&&!existingOp&&<div style={{padding:"10px 14px",background:"rgba(184,149,106,0.08)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:10,marginBottom:14}}>
      <p style={{fontSize:12,color:IC,margin:0,fontWeight:600}}>ℹ {t.new_op_info}</p>
    </div>}

    <div style={{display:"flex",gap:8,alignItems:"end",marginBottom:12}}>
      <div style={{flex:1}}><Inp label={t.tracking} value={tracking} onChange={setTracking} placeholder={t.tracking_ph} req/></div>
      <TrackingScanButton onDetected={setTracking} t={t}/>
    </div>

    <div style={{marginTop:8,marginBottom:14}}>
      <p style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.4)",margin:"0 0 10px",textTransform:"uppercase"}}>{t.bultos} ({bultos.length})</p>
      {bultos.map((b,i)=><div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1px solid rgba(255,255,255,0.08)"}}>
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
        {/* Foto del bulto */}
        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>📷 {t.photo_required}</label>
          {b.photoPreview?<div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <img src={b.photoPreview} alt="preview" style={{width:80,height:80,objectFit:"cover",borderRadius:8,border:"2px solid rgba(34,197,94,0.4)"}}/>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
              <p style={{fontSize:12,fontWeight:700,color:"#22c55e",margin:0}}>{t.photo_uploaded}</p>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",margin:0,wordBreak:"break-all"}}>{b.photo?.name||""}</p>
              <button type="button" onClick={()=>setPhoto(i,null)} style={{alignSelf:"flex-start",fontSize:10,padding:"4px 9px",borderRadius:4,border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,80,80,0.08)",color:"#ff6b6b",cursor:"pointer",fontWeight:600,marginTop:4}}>{t.remove}</button>
            </div>
          </div>:<div>
            <input id={`photo-${i}`} type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setPhoto(i,f);}} style={{display:"none"}}/>
            <label htmlFor={`photo-${i}`} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.4)",background:"rgba(184,149,106,0.06)",color:IC,cursor:"pointer"}}>📷 {t.add_photo}</label>
            <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",margin:"6px 0 0",fontStyle:"italic"}}>{t.photo_help}</p>
          </div>}
        </div>
      </div>)}
      <button type="button" onClick={addBulto} style={{width:"100%",padding:"10px",fontSize:12,fontWeight:600,borderRadius:8,border:"1.5px dashed rgba(184,149,106,0.3)",background:"rgba(184,149,106,0.05)",color:IC,cursor:"pointer"}}>{t.add_bulto}</button>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12,marginTop:10}}>
      <Btn variant="secondary" onClick={onCancel}>{t.cancel}</Btn>
      <Btn onClick={save} disabled={saving||!clientId||!tracking}>{saving?t.saving:t.save}</Btn>
    </div>
  </div>;
}
