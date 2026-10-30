"use client";
// Seguimiento comercial del CRM (30/10/2026): SeguimientoPanel movido VERBATIM desde
// app/admin/page.js. En el admin vivía adentro de ComunicacionesPanel (solapa "Clientes"), que le
// pasaba las plantillas de message_templates y el flash; esa capa de afuera está al final del archivo.
import { useState, useRef, useEffect, useMemo } from "react";
import { apodoDe } from "../../lib/apodos";
import { toast, alertDialog, SkeletonTable, EmptyState } from "../../lib/ui";
import DatePicker from "../components/DatePicker";
import { hoyAR } from "../../lib/fecha-ar";
import { GOLD_LIGHT, GOLD_GRADIENT, dq, dqPage, useEsCelu } from "./_compat";

const SEG_POR_PAGINA=40;
// Seguimiento comercial: a quien hay que escribirle. Dos grupos, con su propio mensaje.
// La consulta la resuelve clientes_seguimiento() en la base y se pide de a paginas: son
// ~950 clientes y traerlos todos al navegador para filtrarlos aca no escala.
function SeguimientoPanelBase({token,templates,flash}){
  // Seguimiento v3 (27/10/2026). Reglas:
  //  - Quien tiene algo en curso (op abierta, marítimo en tránsito o en depósito, bultos sin
  //    importación, reclamo pendiente) NO se contacta: ya tiene seguimiento operativo.
  //  - "Importó" se mide por la fecha de entrega/cierre y cuenta también lo marítimo entregado.
  //  - Un cliente que importó alguna vez es "importó" aunque haya cotizado después (eso se dice en
  //    la frase); "cotizó" es solo el que nunca trajo nada.
  //  - Para hoy: los 15 mejores por prioridad (valor histórico, cadencia propia, recencia de la
  //    cotización) respetando descansos: 21 días desde el último mensaje, 2 intentos sin respuesta
  //    → 90 días, "no le interesa" → 120 días.
  //  - No contactar: un botón a la vista, inline, con fecha y nota; se vuelve a habilitar desde su solapa.
  const celu=useEsCelu();
  const [rows,setRows]=useState([]);const [lo,setLo]=useState(true);const [err,setErr]=useState("");const [legacy,setLegacy]=useState(false);
  const [seg,setSeg]=useState("importaron");const [pag,setPag]=useState(0);
  const [abierto,setAbierto]=useState(null);const [hist,setHist]=useState({});
  const [reg,setReg]=useState(null); // {id,outcome,note,next}
  const [confNc,setConfNc]=useState(null); // id del cliente con el "¿seguro?" de No contactar abierto
  const ctxRef=useRef({}); // contexto extra por cliente para el mensaje (qué trajo, qué cotizó)
  useEffect(()=>{setPag(0);},[seg]);

  const cargar=async()=>{
    setLo(true);setErr("");
    const leer=async(fn)=>{let todo=[];let desde=0;while(true){const r=await dqPage(`rpc/${fn}`,{token,filters:"?select=*",desde,hasta:desde+999});if(r.error)return null;todo=todo.concat(r.rows);if(r.rows.length<1000)break;desde+=1000;}return todo;};
    let todo=await leer("seguimiento_clientes_v3");
    if(!todo){todo=await leer("seguimiento_clientes_v2");setLegacy(true);if(!todo){setErr("No pudimos cargar el seguimiento. Falta correr el SQL 2026_10_19_seguimiento_v2.");todo=[];}}
    else setLegacy(false);
    setRows(todo);setLo(false);
  };
  useEffect(()=>{cargar();},[token]);

  const hoy=hoyAR();
  const dias=(iso)=>iso?Math.floor((Date.now()-new Date(iso).getTime())/86400000):null;
  const diasTxt=(d)=>d==null?"":d<=0?"hoy":d===1?"ayer":d<30?`hace ${d} días`:d<60?"hace un mes":d<365?`hace ${Math.round(d/30)} meses`:`hace ${Math.round(d/365*10)/10} años`;
  const fechaCorta=(iso)=>{if(!iso)return "";const s=String(iso).slice(0,10);const [y,m,d]=s.split("-");return `${d}/${m}`;};
  const fmtUsd=v=>Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:0});
  const waNum=(c)=>(c.whatsapp||"").replace(/[^0-9]/g,"");
  const canalTxt=(c)=>/mar/i.test(String(c||""))?"por marítimo":/a[ée]r|courier/i.test(String(c||""))?"por aéreo":"";
  const n=(v)=>Number(v||0);
  const maxF=(a,b)=>!a?b:!b?a:(new Date(a)>new Date(b)?a:b);

  // Qué tiene en curso (si tiene algo, no se lo contacta).
  const enCurso=(c)=>{const l=[];
    if(n(c.ops_activas)>0)l.push(`${c.ops_activas} operaci${n(c.ops_activas)===1?"ón":"ones"} abierta${n(c.ops_activas)===1?"":"s"}${c.ultima_op_code?` (${c.ultima_op_code})`:""}`);
    if(n(c.mar_activos)>0)l.push(`${c.mar_activos} marítimo${n(c.mar_activos)===1?"":"s"} en curso`);
    if(n(c.bultos_sin_op)>0)l.push(`${c.bultos_sin_op} bulto${n(c.bultos_sin_op)===1?"":"s"} en depósito`);
    if(n(c.claims_pendientes)>0)l.push(`reclamo de depósito pendiente`);
    return l;};
  // Con el SQL viejo (v2) no vienen ops_cerradas ni lo marítimo: se aproxima con total − activas.
  const importaciones=(c)=>(c.ops_cerradas!=null?n(c.ops_cerradas):Math.max(0,n(c.ops_total)-n(c.ops_activas)))+(c.mar_ultima_fecha?Math.max(0,n(c.mar_total)-n(c.mar_activos)):0);
  const ultimaImp=(c)=>maxF(c.ultima_op_cierre,c.mar_ultima_fecha)||(n(c.ops_cerradas)>0?c.ultima_op_fecha:null);
  const cotizoDespues=(c)=>!!c.ultima_quote_fecha&&(!ultimaImp(c)||new Date(c.ultima_quote_fecha)>new Date(ultimaImp(c)));

  // Un grupo por cliente, del más urgente al menos.
  const clasificar=(c)=>{
    if(c.followup_status==="no_contactar"||c.marketing_opt_out)return "no_contactar";
    if(enCurso(c).length)return "en_curso";
    if(importaciones(c)>0){const d=dias(ultimaImp(c));return d!=null&&d<30?"reciente":"importaron";}
    if(n(c.quotes_total)>0)return "cotizaron";
    return "nunca";
  };
  // ¿Conviene escribirle hoy? si · espera · no, con el motivo en una frase.
  const semaforo=(c,s)=>{
    const dc=dias(maxF(c.last_followup_at,c.ultimo_contacto_at));
    const dq=dias(c.ultima_quote_fecha),dImp=dias(ultimaImp(c)),imps=importaciones(c);
    const sinResp=n(c.intentos_sin_respuesta);
    if(s==="no_contactar")return {k:"no",t:c.marketing_opt_out?"Se dio de baja de los mensajes":`No contactar${c.no_contactar_at?` desde el ${fechaCorta(c.no_contactar_at)}`:""}${c.no_contactar_nota?` · ${c.no_contactar_nota}`:""}`};
    if(s==="en_curso")return {k:"no",t:`Tiene algo en curso: ${enCurso(c).join(" · ")}`};
    if(s==="reciente")return {k:"no",t:`Importó ${diasTxt(dImp)} · dejalo tranquilo hasta el mes`};
    if(!waNum(c))return {k:"no",t:"Sin WhatsApp cargado"};
    if(c.followup_next_at&&c.followup_next_at>hoy)return {k:"espera",t:`Agendado para el ${fechaCorta(c.followup_next_at)}`};
    if(c.followup_status==="no_interesado"&&dc!=null&&dc<120)return {k:"espera",t:`Dijo que no le interesa ${diasTxt(dc)} · se retoma a los 4 meses`};
    if(sinResp>=2&&dc!=null&&dc<90)return {k:"espera",t:`Ya le escribiste ${sinResp} veces sin respuesta · se retoma en ${90-dc} días`};
    if(dc!=null&&dc<21)return {k:"espera",t:`Le escribiste ${diasTxt(dc)}${c.ultimo_outcome==="sin_respuesta"||c.ultimo_outcome==="enviado"?" · esperando respuesta":c.ultimo_outcome==="respondio"?" y te respondió":""}`};
    if(c.followup_next_at&&c.followup_next_at<=hoy)return {k:"si",t:`Quedaste en volver a escribirle el ${fechaCorta(c.followup_next_at)}`};
    if(s==="importaron"){
      const cad=n(c.cadencia_dias);const rec=imps>=2&&cad>=7?` · suele volver cada ~${Math.round(cad)} días${dImp>cad*1.3?", ya se pasó":""}`:"";
      const cot=cotizoDespues(c)&&dq<=180?` · cotizó de nuevo ${diasTxt(dq)} (USD ${fmtUsd(c.ultima_quote_total)}) y no la trajo`:"";
      if(dImp!=null&&dImp<45&&!cot)return {k:"espera",t:`Importó ${diasTxt(dImp)} · todavía es pronto`};
      return {k:"si",t:`${imps} importaci${imps===1?"ón":"ones"}, la última entregada ${diasTxt(dImp)}${rec}${cot}`};
    }
    if(s==="cotizaron")return {k:dq>365?"espera":"si",t:`Cotizó ${canalTxt(c.ultima_quote_canal)} ${diasTxt(dq)} (USD ${fmtUsd(c.ultima_quote_total)}) y nunca importó${n(c.quotes_total)>1?` · ${c.quotes_total} cotizaciones`:""}${dq>365?" · muy viejo":""}`};
    if(dc!=null&&dc<45)return {k:"espera",t:`Contactado ${diasTxt(dc)}, sin novedades`};
    return {k:"si",t:`Registrado ${diasTxt(dias(c.created_at))}, nunca cotizó`};
  };
  // Prioridad (0-100) para armar el plan del día.
  const prioridad=(c,s,sem)=>{
    if(sem.k!=="si")return -1;
    if(c.followup_next_at&&c.followup_next_at<=hoy)return 100;
    const castigo=Math.min(25,n(c.intentos_sin_respuesta)*10);
    if(s==="importaron"){const imps=importaciones(c);const dImp=dias(ultimaImp(c))||0;const cad=n(c.cadencia_dias);
      const valor=Math.min(20,Math.log10(1+n(c.facturado_usd))*4);const rep=imps>=3?10:imps===2?6:0;
      const atraso=cad>=7?Math.min(15,Math.max(0,(dImp-cad)/cad)*10):Math.min(10,dImp/30);
      const cot=cotizoDespues(c)&&(dias(c.ultima_quote_fecha)||999)<=60?12:0;
      return 50+valor+rep+atraso+cot-castigo;}
    if(s==="cotizaron"){const dq=dias(c.ultima_quote_fecha)||0;const rec=dq<=14?25:dq<=45?15:dq<=90?8:dq<=180?3:0;const valor=Math.min(8,Math.log10(1+n(c.ultima_quote_total))*2);return 40+rec+valor-castigo;}
    const dr=dias(c.created_at)||0;return 10+(dr<=30?10:dr<=90?4:0)-castigo;
  };

  const enriquecidas=useMemo(()=>rows.map(c=>{const s=clasificar(c);const sem=semaforo(c,s);return {...c,seg:s,sem,prio:prioridad(c,s,sem)};}),[rows]);
  const cuenta=(k)=>enriquecidas.filter(c=>c.seg===k).length;
  // Cuatro solapas (27/10/2026). Dentro de cada una, primero los que conviene escribir (verde),
  // después los que esperan, al final los rojos; y dentro de eso, por prioridad.
  const SEGS=[
    {k:"importaron",l:"Importaron y no volvieron",c:"#8CC8F5"},
    {k:"cotizaron",l:"Cotizaron y no importaron",c:"#E8D098"},
    {k:"nunca",l:"Nunca cotizaron",c:"#c4b5fd"},
    {k:"no_contactar",l:"No contactar",c:"#f87171"},
  ];
  const semOrd={si:0,espera:1,no:2};
  const lista=useMemo(()=>{
    const l=enriquecidas.filter(c=>c.seg===seg);
    const ord={importaron:(a,b)=>b.prio-a.prio||n(b.facturado_usd)-n(a.facturado_usd),cotizaron:(a,b)=>new Date(b.ultima_quote_fecha||0)-new Date(a.ultima_quote_fecha||0),nunca:(a,b)=>new Date(b.created_at)-new Date(a.created_at),no_contactar:(a,b)=>new Date(b.no_contactar_at||b.ultimo_contacto_at||0)-new Date(a.no_contactar_at||a.ultimo_contacto_at||0)};
    const f=ord[seg]||(()=>0);
    return l.sort((a,b)=>(semOrd[a.sem.k]-semOrd[b.sem.k])||f(a,b));
  },[enriquecidas,seg]);
  const porPag=40;const paginas=Math.max(1,Math.ceil(lista.length/porPag));const visibles=lista.slice(pag*porPag,pag*porPag+porPag);

  const interpTpl=(text,data)=>String(text||"").replace(/\{\{(\w+)\}\}/g,(_,k)=>data[k]!=null?String(data[k]):"");
  // Qué trajo la última vez y qué cotizó: se busca al armar el mensaje (una vez por cliente).
  const generico=(s)=>!s||/^(consolidado|varios|mercader[ií]a|productos varios|-+|\.+)$/i.test(String(s).trim());
  // "Pin De Carga De Peso Para Gimnasio" → "pin de carga de peso para gimnasio" (las siglas quedan).
  const minus=(s)=>String(s||"").trim().split(/\s+/).map(w=>/^[A-ZÁÉÍÓÚÑ0-9]{2,}$/.test(w)?w:w.toLowerCase()).join(" ");
  const contextoDe=async(c)=>{
    if(ctxRef.current[c.id])return ctxRef.current[c.id];
    const ctx={opDesc:"",quoteDesc:""};
    try{
      const [o,q]=await Promise.all([
        importaciones(c)>0?dq("operations",{token,filters:`?client_id=eq.${c.id}&status=eq.operacion_cerrada&select=description&order=closed_at.desc.nullslast&limit=1`}):Promise.resolve([]),
        c.ultima_quote_num?dq("quotes",{token,filters:`?quote_number=eq.${c.ultima_quote_num}&select=products&limit=1`}):Promise.resolve([]),
      ]);
      const d=Array.isArray(o)&&o[0]?.description;if(!generico(d))ctx.opDesc=String(d).trim().slice(0,80);
      const prods=Array.isArray(q)&&Array.isArray(q[0]?.products)?q[0].products.map(p=>String(p.description||"").trim()).filter(x=>x&&!generico(x)):[];
      if(prods.length)ctx.quoteDesc=prods.length===1?minus(prods[0]):`${minus(prods[0])} y ${minus(prods[1])}${prods.length>2?" (entre otras cosas)":""}`;
    }catch(e){console.error("contexto seguimiento",e);}
    ctxRef.current[c.id]=ctx;return ctx;
  };
  const mensajeDe=async(c)=>{
    const key=c.seg==="cotizaron"||(c.seg==="importaron"&&cotizoDespues(c)&&(dias(c.ultima_quote_fecha)||999)<=180)?"wa_seguimiento_cotizo":importaciones(c)>0?"wa_seguimiento_inactivo":"wa_seguimiento_sin_ops";
    const tpl=templates.find(t=>t.key===key);
    const ctx=await contextoDe(c);
    const canal=canalTxt(c.ultima_quote_canal);
    const nb=n(c.bultos_sin_op);
    const data={firstName:apodoDe(c.first_name),clientCode:c.client_code||"",opCode:c.ultima_op_code||"",opDesc:ctx.opDesc,opQue:ctx.opDesc?minus(ctx.opDesc):"tu importación",
      quoteNum:c.ultima_quote_num||"",quoteCanal:canal,quoteTotal:fmtUsd(c.ultima_quote_total),quoteDias:diasTxt(dias(c.ultima_quote_fecha)).replace(/^hace /,""),quoteCuando:diasTxt(dias(c.ultima_quote_fecha)),quoteDesc:ctx.quoteDesc,
      quoteQue:ctx.quoteDesc?`para traer ${ctx.quoteDesc}`:canal?`${canal}`:"con nosotros",bultos:`${nb} bulto${nb!==1?"s":""}`};
    return interpTpl(tpl?.body||"Hola {{firstName}}!",data).replace(/Hola\s*!/,"Hola!").replace(/  +/g," ").replace(/ ([,.:;!?])/g,"$1");
  };

  const ESTADO={enviado:"contactado",sin_respuesta:"contactado",respondio:"respondio",va_a_importar:"va_a_importar",mas_adelante:"mas_adelante",no_interesado:"no_interesado",no_contactar:"no_contactar",reactivar:"sin_contacto"};
  const registrar=async(c,outcome,{note="",next=null,channel="nota"}={})=>{
    const now=new Date().toISOString();
    const r=await dq("client_followups",{method:"POST",token,body:{client_id:c.id,channel,outcome:outcome==="reactivar"?"nota":outcome,note:outcome==="reactivar"?(note||"Vuelve a seguimiento"):(note||null),next_at:next||null}});
    if(r&&!Array.isArray(r)&&r.code){toast(`No se pudo guardar: ${r.message||r.code}`,"error");return false;}
    const patch={followup_status:ESTADO[outcome]||c.followup_status||"sin_contacto",followup_next_at:next||null};
    if(channel!=="nota")patch.last_followup_at=now;
    if(outcome==="reactivar")patch.marketing_opt_out=false;
    await dq("clients",{method:"PATCH",token,filters:`?id=eq.${c.id}`,body:patch});
    setRows(p=>p.map(x=>x.id===c.id?{...x,...patch,contactos:n(x.contactos)+1,ultimo_contacto_at:now,ultimo_outcome:outcome==="reactivar"?"nota":outcome,ultimo_note:note||x.ultimo_note,
      ...(outcome==="enviado"||outcome==="sin_respuesta"?{intentos_sin_respuesta:n(x.intentos_sin_respuesta)+1}:["respondio","va_a_importar","mas_adelante","no_interesado"].includes(outcome)?{intentos_sin_respuesta:0}:{}),
      ...(outcome==="no_contactar"?{no_contactar_at:now,no_contactar_nota:note||null}:outcome==="reactivar"?{no_contactar_at:null,no_contactar_nota:null,marketing_opt_out:false}:{})}:x));
    setHist(h=>h[c.id]?{...h,[c.id]:[{id:"tmp"+now,created_at:now,channel,outcome:outcome==="reactivar"?"nota":outcome,note:outcome==="reactivar"?(note||"Vuelve a seguimiento"):note,next_at:next},...h[c.id]]}:h);
    return true;
  };
  const abrirWA=async(c)=>{
    const num=waNum(c);if(!num){alertDialog("Este cliente no tiene WhatsApp cargado.");return;}
    const texto=await mensajeDe(c);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(texto)}`,"_blank");
    await registrar(c,"enviado",{channel:"whatsapp"});
    flash(`WhatsApp abierto · ${c.client_code}. Cuando te conteste, registralo acá.`);
  };
  const noContactar=async(c)=>{
    setConfNc(null);
    const ok=await registrar(c,"no_contactar",{note:""});
    if(ok)toast(`${c.first_name} ${c.last_name}: no se le escribe más. Lo ves en la solapa No contactar.`,"success");
  };
  const reactivar=async(c)=>{const ok=await registrar(c,"reactivar",{});if(ok)toast(`${c.first_name} ${c.last_name} vuelve al seguimiento`,"success");};
  const cargarHist=async(c)=>{if(hist[c.id])return;const r=await dq("client_followups",{token,filters:`?client_id=eq.${c.id}&select=*&order=created_at.desc&limit=30`});setHist(h=>({...h,[c.id]:Array.isArray(r)?r:[]}));};
  const toggle=(c)=>{const nx=abierto===c.id?null:c.id;setAbierto(nx);if(nx)cargarHist(c);};
  const guardarReg=async(c)=>{
    if(!reg||reg.id!==c.id||!reg.outcome){toast("Elegí qué pasó","warn");return;}
    if(reg.outcome==="mas_adelante"&&!reg.next){toast("Poné la fecha para volver a escribirle","warn");return;}
    const ok=await registrar(c,reg.outcome,{note:reg.note,next:reg.next||null,channel:reg.outcome==="respondio"||reg.outcome==="sin_respuesta"?"whatsapp":"nota"});
    if(ok){setReg(null);toast("Registrado","success");}
  };

  const OUTCOMES=[["respondio","Respondió","#4ade80"],["sin_respuesta","Sin respuesta","#fbbf24"],["va_a_importar","Va a importar","#8CC8F5"],["mas_adelante","Más adelante","#c4b5fd"],["no_interesado","No le interesa","rgba(255,255,255,0.6)"]];
  const OUT_LBL={respondio:"Respondió",sin_respuesta:"Sin respuesta",va_a_importar:"Va a importar",mas_adelante:"Más adelante",no_interesado:"No le interesa",no_contactar:"No contactar",enviado:"Mensaje enviado",nota:"Nota"};
  const COND={responsable_inscripto:"RI",monotributo:"Mono",consumidor_final:"CF"};
  const semColor={si:"#4ade80",espera:"#fbbf24",no:"#f87171"};
  const pill=(txt,color,extra={})=><span style={{fontSize:10,fontWeight:800,letterSpacing:"0.05em",textTransform:"uppercase",padding:"2px 7px",borderRadius:999,color,background:`${color}1f`,border:`1px solid ${color}55`,whiteSpace:"nowrap",...extra}}>{txt}</span>;
  const btn=(txt,on,{color="rgba(255,255,255,0.75)",bg="rgba(255,255,255,0.04)",border="rgba(255,255,255,0.12)",strong,title}={})=><button type="button" title={title} onClick={on} style={{height:34,padding:"0 12px",fontSize:12,fontWeight:700,borderRadius:9,border:`1px solid ${border}`,background:bg,color,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",...(strong?{boxShadow:"0 6px 16px rgba(37,211,102,0.25)"}:{})}}>{txt}</button>;

  return <div>
    {legacy&&<div style={{padding:"10px 14px",marginBottom:12,borderRadius:10,background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.3)",fontSize:12.5,color:"#fbbf24"}}>Falta correr <b>migrations/2026_10_27_seguimiento_v3.sql</b>: mientras tanto no se ven los marítimos en curso ni la fecha real de entrega, y las reglas nuevas quedan a medias.</div>}
    {/* Las cuatro solapas, como las etapas de Operaciones */}
    <div style={{display:"grid",gridTemplateColumns:celu?"1fr 1fr":"repeat(4,minmax(0,1fr))",gap:4,padding:5,marginBottom:16,borderRadius:18,background:"rgba(0,0,0,0.28)",border:"1px solid rgba(255,255,255,0.07)"}}>
      {SEGS.map(o=>{const on=seg===o.k;const nn=cuenta(o.k);return <button key={o.k} type="button" onClick={()=>setSeg(o.k)} style={{display:"flex",flexDirection:celu?"column":"row",alignItems:"center",justifyContent:"center",gap:celu?4:10,padding:celu?"10px 4px":"13px 12px",borderRadius:14,border:"none",background:on?`linear-gradient(180deg,${o.c}33,${o.c}14)`:"transparent",boxShadow:on?`inset 0 0 0 1.5px ${o.c}88, 0 6px 22px ${o.c}26`:"none",color:on?"#fff":"rgba(255,255,255,0.55)",cursor:"pointer",fontFamily:"inherit",transition:"all 160ms"}}>
        <span style={{fontSize:celu?12.5:14,fontWeight:800,letterSpacing:"-0.01em",whiteSpace:"nowrap"}}>{o.k==="no_contactar"?"🚫 ":""}{o.l}</span>
        <span style={{minWidth:24,height:22,padding:"0 7px",borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,fontVariantNumeric:"tabular-nums",background:on?o.c:"rgba(255,255,255,0.08)",color:on?"#0A1628":"rgba(255,255,255,0.6)"}}>{lo?"…":nn}</span>
      </button>;})}
    </div>
    {err&&<div style={{padding:"12px 16px",marginBottom:14,borderRadius:10,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",color:"#f87171",fontSize:13}}>{err}</div>}

    {lo?<SkeletonTable rows={8} cols={3}/>:visibles.length===0
      ?<EmptyState icon="users" title="Nada por acá" description="No hay clientes en este grupo."/>
      :<div style={{display:"flex",flexDirection:"column",gap:8}}>
        {visibles.map(c=>{const dc=dias(maxF(c.ultimo_contacto_at,c.last_followup_at));const open=abierto===c.id;const r=reg&&reg.id===c.id?reg:null;const col=semColor[c.sem.k];const nc=c.seg==="no_contactar";const imps=importaciones(c);
          return <div key={c.id} style={{borderRadius:14,border:`1px solid ${nc?"rgba(248,113,113,0.35)":open?"rgba(184,149,106,0.4)":"rgba(255,255,255,0.08)"}`,background:nc?"linear-gradient(180deg,rgba(60,16,22,0.55),rgba(8,16,32,0.9))":"linear-gradient(180deg,rgba(13,24,45,0.9),rgba(8,16,32,0.9))"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:celu?"12px 12px":"12px 16px",flexWrap:"wrap"}}>
              <span title={c.sem.k==="si"?"Conviene escribirle":c.sem.k==="espera"?"Mejor esperar":"No escribirle"} style={{width:10,height:10,borderRadius:"50%",background:col,boxShadow:`0 0 0 4px ${col}22`,flexShrink:0}}/>
              <div style={{flex:"1 1 240px",minWidth:0,cursor:"pointer"}} onClick={()=>toggle(c)}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:14,fontWeight:800,color:"#fff"}}>{c.first_name} {c.last_name}</span>
                  {c.company_name&&<span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>{c.company_name}</span>}
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:GOLD_LIGHT}}>{c.client_code}</span>
                  {nc&&pill("🚫 No contactar","#f87171")}
                  {COND[c.tax_condition]&&pill(COND[c.tax_condition],"rgba(255,255,255,0.5)")}
                  {imps>0&&pill(`${n(c.facturado_usd)>0?`USD ${fmtUsd(c.facturado_usd)} · `:""}${imps} importaci${imps!==1?"ones":"ón"}`,"#8CC8F5")}
                  {n(c.mar_total)>0&&pill("marítimo","#60a5fa")}
                </div>
                <p style={{margin:"4px 0 0",fontSize:12.5,color:c.sem.k==="si"?"#fff":nc?"#fca5a5":"rgba(255,255,255,0.65)",lineHeight:1.4}}>{c.sem.t}</p>
                {(c.ultimo_contacto_at||c.last_followup_at)&&!nc&&<p style={{margin:"3px 0 0",fontSize:11.5,color:"rgba(255,255,255,0.42)",lineHeight:1.4}}>Último contacto {diasTxt(dc)}{c.ultimo_outcome?` · ${OUT_LBL[c.ultimo_outcome]||c.ultimo_outcome}`:""}{n(c.intentos_sin_respuesta)>0?` · ${c.intentos_sin_respuesta} sin respuesta`:""}{c.ultimo_note?` · “${String(c.ultimo_note).slice(0,80)}”`:""}{c.followup_next_at?` · próximo ${fechaCorta(c.followup_next_at)}`:""}</p>}
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginLeft:celu?22:0}}>
                {nc?btn("↩ Volver a contactar",()=>reactivar(c),{color:"#fff",bg:"rgba(255,255,255,0.08)",border:"rgba(255,255,255,0.2)"})
                :<>
                  {btn("Mensaje",async()=>alertDialog(await mensajeDe(c),{title:`Mensaje para ${apodoDe(c.first_name)||c.first_name}`}),{title:"Ver el WhatsApp que se le mandaría"})}
                  {btn(r?"✕":"Registrar",()=>setReg(r?null:{id:c.id,outcome:"",note:"",next:""}),{color:r?"rgba(255,255,255,0.6)":GOLD_LIGHT,border:r?"rgba(255,255,255,0.12)":"rgba(184,149,106,0.45)",bg:r?"transparent":"rgba(184,149,106,0.1)"})}
                  {btn("WhatsApp",()=>abrirWA(c),{color:"#fff",bg:"linear-gradient(135deg,#25D366,#128C7E)",border:"transparent",strong:c.sem.k==="si"})}
                  {confNc===c.id
                    ?<span style={{display:"inline-flex",gap:6,alignItems:"center"}}>{btn("Sí, no contactar más",()=>noContactar(c),{color:"#fff",bg:"linear-gradient(135deg,#ef4444,#b91c1c)",border:"transparent"})}{btn("Cancelar",()=>setConfNc(null),{color:"rgba(255,255,255,0.6)"})}</span>
                    :btn("🚫 No contactar",()=>setConfNc(c.id),{color:"#f87171",bg:"rgba(248,113,113,0.08)",border:"rgba(248,113,113,0.45)",title:"Marcar que a este cliente no se le escribe más"})}
                </>}
                {btn(open?"▲":"▼",()=>toggle(c),{color:"rgba(255,255,255,0.45)"})}
              </div>
            </div>
            {r&&<div style={{padding:"0 16px 14px",marginLeft:celu?0:22}}>
              <div style={{padding:"12px 14px",borderRadius:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{OUTCOMES.map(([k,l,color])=><button key={k} type="button" onClick={()=>setReg(p=>({...p,outcome:k}))} style={{height:32,padding:"0 12px",borderRadius:999,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:`1px solid ${r.outcome===k?color:"rgba(255,255,255,0.12)"}`,background:r.outcome===k?`${color}22`:"transparent",color:r.outcome===k?color:"rgba(255,255,255,0.7)"}}>{l}</button>)}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-start"}}>
                  <input value={r.note} onChange={e=>setReg(p=>({...p,note:e.target.value}))} placeholder="Nota (qué te dijo, qué quedó pendiente)…" style={{flex:"1 1 240px",height:36,padding:"0 12px",fontSize:13,border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,background:"rgba(0,0,0,0.22)",color:"#fff",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                  <div style={{flex:"0 0 170px"}}><DatePicker value={r.next||""} onChange={v=>setReg(p=>({...p,next:v}))} placeholder="Volver a escribir el…" small/></div>
                  {btn("Guardar",()=>guardarReg(c),{color:"#0A1628",bg:GOLD_GRADIENT,border:"transparent"})}
                </div>
              </div>
            </div>}
            {open&&<div style={{padding:"0 16px 14px",marginLeft:celu?0:22,display:"grid",gridTemplateColumns:celu?"1fr":"1fr 1fr",gap:10}}>
              <div style={{padding:"12px 14px",borderRadius:12,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)"}}>
                <p style={{margin:"0 0 8px",fontSize:10.5,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,255,255,0.45)"}}>Quién es</p>
                <p style={{margin:0,fontSize:12.5,color:"rgba(255,255,255,0.8)",lineHeight:1.6}}>
                  {c.whatsapp||"sin WhatsApp"} · {c.email||"sin email"}<br/>
                  Registrado {diasTxt(dias(c.created_at))}{c.tax_condition?` · ${COND[c.tax_condition]||c.tax_condition}`:""}<br/>
                  {imps>0?<>{imps} importaci{imps===1?"ón":"ones"}{n(c.ops_cerradas)>0&&c.ultima_op_code?` · última ${c.ultima_op_code}`:""}{ultimaImp(c)?` entregada ${diasTxt(dias(ultimaImp(c)))}`:""}{n(c.facturado_usd)>0?` · facturó USD ${fmtUsd(c.facturado_usd)}`:""}{n(c.cadencia_dias)>=7&&imps>=2?` · cada ~${Math.round(c.cadencia_dias)} días`:""}</>:"Nunca importó"}<br/>
                  {n(c.quotes_total)>0?<>{c.quotes_total} cotizaci{n(c.quotes_total)===1?"ón":"ones"} · última {c.ultima_quote_num} {diasTxt(dias(c.ultima_quote_fecha))} {canalTxt(c.ultima_quote_canal)} por USD {fmtUsd(c.ultima_quote_total)}</>:"Nunca cotizó"}
                  {enCurso(c).length>0&&<><br/><b style={{color:"#fbbf24"}}>En curso: {enCurso(c).join(" · ")}</b></>}
                </p>
              </div>
              <div style={{padding:"12px 14px",borderRadius:12,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)"}}>
                <p style={{margin:"0 0 8px",fontSize:10.5,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:"rgba(255,255,255,0.45)"}}>Contactos{hist[c.id]?` · ${hist[c.id].length}`:""}</p>
                {!hist[c.id]?<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Cargando…</p>
                :hist[c.id].length===0?<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>{c.last_followup_at?`Contactado ${diasTxt(dias(c.last_followup_at))} (antes del historial).`:"Nunca se lo contactó."}</p>
                :<div style={{display:"flex",flexDirection:"column",gap:6}}>{hist[c.id].slice(0,8).map(h=><div key={h.id} style={{fontSize:12,color:"rgba(255,255,255,0.75)",lineHeight:1.45}}><span style={{color:"rgba(255,255,255,0.4)",fontVariantNumeric:"tabular-nums"}}>{new Date(h.created_at).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit"})}</span> · {h.channel==="whatsapp"?"WhatsApp":h.channel==="email"?"Email":h.channel==="llamada"?"Llamada":"Nota"} · <b style={{color:h.outcome==="no_contactar"?"#f87171":"inherit"}}>{OUT_LBL[h.outcome]||h.outcome||""}</b>{h.note?` · ${h.note}`:""}{h.next_at?` · volver el ${fechaCorta(h.next_at)}`:""}</div>)}</div>}
              </div>
            </div>}
          </div>;})}
      </div>}

    {paginas>1&&<div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:12,marginTop:18}}>
      {btn("← Anterior",()=>setPag(p=>Math.max(0,p-1)),{color:pag>0?"rgba(255,255,255,0.75)":"rgba(255,255,255,0.25)"})}
      <span style={{fontSize:12,color:"rgba(255,255,255,0.45)",fontVariantNumeric:"tabular-nums"}}>Página {pag+1} de {paginas} · {lista.length} clientes</span>
      {btn("Siguiente →",()=>setPag(p=>Math.min(paginas-1,p+1)),{color:pag<paginas-1?"rgba(255,255,255,0.75)":"rgba(255,255,255,0.25)"})}
    </div>}
  </div>;
}

// Capa de afuera (lo que hacía ComunicacionesPanel en el admin): carga las plantillas y arma el
// flash (texto verde arriba + toast). rol y movil llegan de la página del CRM; el panel se rearma
// solo para el celu con useEsCelu y no esconde nada al empleado.
export function SeguimientoPanel({token,rol,movil}){
  const [templates,setTemplates]=useState([]);
  const [msg,setMsg]=useState("");
  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),2500);const v=/^[❌✕]|falló|error/i.test(m)?"error":/^⚠/.test(m)?"warn":"success";toast(m.replace(/^[✓✉️❌⚠️✕★📧⭐]\s*/u,""),v);};
  useEffect(()=>{let vivo=true;(async()=>{const tpl=await dq("message_templates",{token,filters:"?select=*&order=channel.asc,key.asc"});if(vivo)setTemplates(Array.isArray(tpl)?tpl:[]);})();return()=>{vivo=false;};},[token]);
  return <>
    {msg&&<p style={{fontSize:12,color:"#22c55e",fontWeight:600,marginBottom:12}}>{msg}</p>}
    <SeguimientoPanelBase token={token} templates={templates} flash={flash}/>
  </>;
}
