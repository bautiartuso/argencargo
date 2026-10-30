"use client";
// Marketing del CRM (30/10/2026): Content Studio, Hist. de reseña y Blog, movidos VERBATIM desde
// app/admin/page.js. Se montan como <X token={accessToken} rol="admin"|"empleado" movil={bool}/>:
// los tres usan solo token; rol y movil llegan de la página y acá no hacen nada (ninguno esconde
// nada por dentro al empleado: en el admin, Hist. de reseña directamente no estaba en EMP_PAGES).
// Hist. de reseña ya vivía en su propio archivo (app/admin/components/HistoriasPanel.js): se reexporta.
import { useState, useEffect } from "react";
import { toast, confirmDialog } from "../../lib/ui";
import { isoAR } from "../../lib/fecha-ar";
import { Inp, Btn } from "./_compat";
export { default as HistoriasPanel } from "../admin/components/HistoriasPanel";

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT STUDIO v2 · calcado del sistema de Minificando: Generar, Aprobación, Calendario,
// Runner, Chatbot, Marca, Conexión, Knowledge. El diseño lo hace la Mac (runner local con
// Claude Code); la web es la cola, la aprobación, el calendario y el vigilante de Instagram.
// ═══════════════════════════════════════════════════════════════════════════
export function StudioPanel({token}){
  // Estética 28/10/2026: un solo acento de marca para todo el estudio.
  const ACC="#E8C99B";
  const [tab,setTab]=useState("analisis");
  const [an,setAn]=useState(null);const [anLo,setAnLo]=useState(false); // Análisis de Instagram
  const [chatKind,setChatKind]=useState("auto"); // formato pedido en el chatbot: auto | feed | carousel | story
  const [slideIdx,setSlideIdx]=useState(0);      // imagen visible en la vista grande (carruseles / secuencias)
  const [runMix,setRunMix]=useState({feed:1,carousel:1,story:3,linkedin:0}); // cuántas piezas de cada formato pide el runner
  const [calMes,setCalMes]=useState(()=>{const d=new Date();return {feed:{y:d.getFullYear(),m:d.getMonth()},story:{y:d.getFullYear(),m:d.getMonth()}};}); // un mes por calendario
  const [calSel,setCalSel]=useState(null);   // pieza abierta desde el calendario
  const [cambio,setCambio]=useState(null);   // {p, texto}: modal de "pedir cambio" con la imagen a la vista
  const [pieces,setPieces]=useState([]);const [lo,setLo]=useState(true);
  const [meta,setMeta]=useState({memory:[],assets:[],runs:[],instagram:{},discovery:{},competitors:[],estado:null,telegram:{},linkedin:{}});
  const [igDisc,setIgDisc]=useState("");              // token de Facebook para el radar de competencia
  const [budgets,setBudgets]=useState(null);           // topes mensuales de gasto (Claude API / fal) para las alertas
  const [liCfg,setLiCfg]=useState(null);               // ajustes de LinkedIn en edición (posts por semana, modo, página)
  const [liPagina,setLiPagina]=useState(false);        // pedir permisos de la página al conectar LinkedIn
  const [comp,setComp]=useState({posts:[],lo:false});  // posts de la competencia con análisis
  const [compUser,setCompUser]=useState("");
  const [busy,setBusy]=useState("");
  const [filtro,setFiltro]=useState("todos"); // todos | feed | story
  const [preview,setPreview]=useState(null);
  const [brief,setBrief]=useState("");const [kind,setKind]=useState("auto");const [count,setCount]=useState(1);
  const [chat,setChat]=useState([]);const [chatTxt,setChatTxt]=useState("");const [chatImgs,setChatImgs]=useState([]);const [chatListo,setChatListo]=useState(null);
  const [memEdit,setMemEdit]=useState({});
  const [ig,setIg]=useState({ig_user_id:"",access_token:""});
  const [sched,setSched]=useState(null); // {p, date, hour}
  const [dictando,setDictando]=useState("");
  const isMobile=typeof window!=="undefined"&&window.innerWidth<760;
  const api=async(qs="",opts={})=>{const r=await fetch(`/api/admin/studio${qs}`,{...opts,headers:{...(opts.body instanceof FormData?{}:{"Content-Type":"application/json"}),Authorization:`Bearer ${token}`,...(opts.headers||{})}});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error||`HTTP ${r.status}`);return b;};
  const load=async()=>{try{const b=await api("?view=pieces");setPieces(b.pieces||[]);}catch(e){console.error(e);}finally{setLo(false);}};
  const loadMeta=async()=>{try{const b=await api("?view=memory");setMeta({memory:b.memory||[],assets:b.assets||[],runs:b.runs||[],instagram:b.instagram||{},discovery:b.discovery||{},competitors:b.competitors||[],estado:b.estado||null,telegram:b.telegram||{},linkedin:b.linkedin||{}});}catch(e){toast(e.message,"error");}};
  const loadAn=async()=>{setAnLo(true);try{const b=await api("?view=analisis");setAn(b);}catch(e){toast(e.message,"error");}finally{setAnLo(false);}};
  const loadComp=async()=>{setComp(c=>({...c,lo:true}));try{const b=await api("?view=competencia");setComp({posts:b.posts||[],lo:false});}catch(e){setComp(c=>({...c,lo:false}));}};
  useEffect(()=>{load();loadMeta();},[token]);
  // Vuelta del OAuth de LinkedIn (/admin?page=studio&li=ok|error&msg=…): abre Conexión y avisa.
  useEffect(()=>{try{const q=new URLSearchParams(window.location.search);const li=q.get("li");if(!li)return;setTab("conexion");toast(li==="ok"?`LinkedIn conectado${q.get("msg")?` · ${q.get("msg")}`:""}`:`LinkedIn: ${q.get("msg")||"no se pudo conectar"}`,li==="ok"?"success":"error");window.history.replaceState({},"","/admin");}catch{}},[]);
  useEffect(()=>{if(tab==="marca")loadComp();if(tab==="analisis"&&!an)loadAn();},[tab]);
  const generando=pieces.filter(p=>p.status==="generating").length;
  useEffect(()=>{if(!generando)return;const id=setInterval(load,20000);return()=>clearInterval(id);},[generando>0]);
  const act=async(action,extra={},msg)=>{
    setBusy(action+(extra.id||""));
    try{const b=await api("",{method:"POST",body:JSON.stringify({action,...extra})});if(msg)toast(typeof msg==="function"?msg(b):msg,"success");await load();return b;}
    catch(e){toast(e.message,"error");}
    finally{setBusy("");}
  };
  // Dictado por voz (reconocimiento del navegador: gratis, funciona en Chrome y Safari).
  const dictar=(setter,key)=>{
    const SR=typeof window!=="undefined"&&(window.SpeechRecognition||window.webkitSpeechRecognition);
    if(!SR){toast("Tu navegador no tiene dictado. Probá con Chrome.","error");return;}
    if(dictando){setDictando("");window.__acgRec?.stop();return;}
    const rec=new SR();rec.lang="es-AR";rec.continuous=true;rec.interimResults=true;
    // El reconocimiento manda en cada evento TODO lo dicho desde que arrancó (final + provisorio):
    // se guarda el texto que había antes de dictar y se reemplaza el resto, sin acumular.
    let base=null;rec.onstart=()=>setDictando(key);
    rec.onresult=e=>{let txt="";for(let i=0;i<e.results.length;i++)txt+=e.results[i][0].transcript;txt=txt.replace(/\s+/g," ").trim();setter(prev=>{if(base===null)base=String(prev||"").trim();return base?`${base} ${txt}`:txt;});};
    rec.onerror=()=>setDictando("");rec.onend=()=>setDictando("");
    window.__acgRec=rec;rec.start();
  };
  const fmt=(d)=>d?new Date(d).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
  const fmtDia=(d)=>d?new Date(d).toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"}):"";
  const slidesOf=(p)=>Array.isArray(p?.images)&&p.images.length?p.images.map(x=>typeof x==="string"?x:x?.url).filter(Boolean):(p?.image_url?[p.image_url]:[]);
  const nSlides=(p)=>Math.max(slidesOf(p).length,Number(p?.slides)||1);
  const kindLabel=(p)=>p.kind==="linkedin"?"LinkedIn":p.kind==="blog"?"Nota de blog":p.kind==="carousel"?`Carrusel · ${nSlides(p)}`:p.kind==="story"?(nSlides(p)>1?`Historias · ${nSlides(p)}`:"Historia"):"Posteo";
  const conFoto=(p)=>!!(p?.photo_prompt);
  const IcoDescarga=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>;
  const IcoInstagram=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>;
  const IcoCalendario=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>;
  const IcoLinkedin=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45z"/></svg>;
  useEffect(()=>{setSlideIdx(0);},[preview?.id,cambio?.p?.id]);
  // Vista de una pieza con sus imágenes (carrusel o secuencia): flechas, contador y miniaturas.
  const slidesView=(p,{maxW,maxH}={})=>{const urls=slidesOf(p);const i=Math.min(slideIdx,Math.max(0,urls.length-1));const nav=(side)=>({position:"absolute",top:"50%",[side]:8,transform:"translateY(-50%)",width:36,height:36,borderRadius:99,border:"none",background:"rgba(0,0,0,0.55)",color:"#fff",fontSize:22,cursor:"pointer",lineHeight:"36px",padding:0});return <div onClick={e=>e.stopPropagation()} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,maxWidth:maxW||"100%"}}>
    <div style={{position:"relative"}}>
      {urls[i]&&<img src={urls[i]} alt="" style={{maxWidth:"100%",maxHeight:maxH||(urls.length>1?"76vh":"92vh"),borderRadius:10,boxShadow:"0 20px 60px rgba(0,0,0,0.6)",display:"block"}}/>}
      {urls.length>1&&<><button onClick={()=>setSlideIdx(x=>(x-1+urls.length)%urls.length)} style={nav("left")}>‹</button><button onClick={()=>setSlideIdx(x=>(x+1)%urls.length)} style={nav("right")}>›</button><span style={{position:"absolute",top:10,right:10,fontSize:11,fontWeight:800,padding:"3px 8px",borderRadius:99,background:"rgba(0,0,0,0.6)",color:"#fff"}}>{i+1}/{urls.length}</span></>}
    </div>
    {urls.length>1&&<div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>{urls.map((u,j)=><img key={j} src={u} alt="" onClick={()=>setSlideIdx(j)} style={{height:p.kind==="story"?64:52,borderRadius:5,cursor:"pointer",border:`2px solid ${j===i?"#E8C99B":"transparent"}`,opacity:j===i?1:0.55}}/>)}</div>}
  </div>;};
  const chip=(txt,col)=><span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:10.5,fontWeight:700,padding:"3px 8px 3px 7px",borderRadius:99,background:"rgba(6,11,22,0.72)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",color:"#fff",border:"1px solid rgba(255,255,255,0.12)",letterSpacing:"0.01em",whiteSpace:"nowrap"}}><span style={{width:6,height:6,borderRadius:99,background:col,flexShrink:0}}/>{txt}</span>;
  const pedirCambio=(p)=>setCambio({p,texto:"",modo:"cambio"});
  const pedirDescarte=(p)=>setCambio({p,texto:"",modo:"descartar"});
  const enviarDescarte=async()=>{const p=cambio.p;const note=(cambio.texto||"").trim();setCambio(null);await act("reject",{id:p.id,note},note?"Descartada · el motivo quedó anotado en Aprendizajes":"Descartada");};
  const enviarCambio=async()=>{const fb=(cambio?.texto||"").trim();if(!fb)return;const p=cambio.p;const nueva=!!cambio.foto;setCambio(null);await act("feedback",{id:p.id,feedback:fb,new_photo:nueva},nueva?"Se rehace con foto nueva y diseño nuevo (tu Mac, 5 a 8 min)":"Se rehace el diseño con tu cambio (tu Mac, 5 a 8 min)");};
  const copiar=async(p)=>{try{await navigator.clipboard.writeText(`${p.caption||""}\n\n${p.hashtags||""}`.trim());toast("Texto copiado","success");}catch{toast("No se pudo copiar","error");}};
  const Card=({p,children,compact})=><div className="cs-card" style={{background:"linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))",border:"1px solid rgba(255,255,255,0.09)",borderRadius:18,overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 12px 32px rgba(0,0,0,0.28)",transition:"transform .18s, border-color .18s"}}>
    <div onClick={()=>(p.image_url||(p.kind==="linkedin"&&p.caption))&&setPreview(p)} style={{position:"relative",background:"radial-gradient(120% 90% at 50% 0%,#111c30,#070d18)",aspectRatio:p.kind==="linkedin"&&!p.image_url?"auto":p.kind==="blog"?"1200/630":p.kind==="linkedin"?"1/1":p.kind==="story"?"9/16":"4/5",cursor:(p.image_url||(p.kind==="linkedin"&&p.caption))?"zoom-in":"default",display:"flex",alignItems:"center",justifyContent:"center"}}>
      {p.image_url?<img src={p.image_url} alt={p.title||""} style={{width:"100%",height:"100%",objectFit:"contain"}}/>:p.status==="generating"?<div style={{textAlign:"center",color:"rgba(255,255,255,0.5)",fontSize:12,padding:20}}><div style={{fontSize:26,marginBottom:6}}>{p.kind==="linkedin"||p.kind==="blog"?"✍️":"🎨"}</div>{p.locked_at?(p.kind==="linkedin"?"Escribiendo el post en tu Mac…":p.kind==="blog"?"Escribiendo la nota en tu Mac…":conFoto(p)&&!p.photo_url?"Generando la foto y diseñando en tu Mac…":"Diseñando en tu Mac…"):"En la cola (espera a tu Mac)"}<div style={{fontSize:10.5,marginTop:4,color:"rgba(255,255,255,0.35)"}}>{p.title}</div></div>:p.kind==="linkedin"&&p.caption?<div style={{width:"100%",boxSizing:"border-box",padding:"36px 14px 14px",fontSize:12,lineHeight:1.5,color:"rgba(255,255,255,0.85)",whiteSpace:"pre-wrap",maxHeight:300,overflow:"hidden",maskImage:"linear-gradient(180deg,#000 75%,transparent)",WebkitMaskImage:"linear-gradient(180deg,#000 75%,transparent)"}}>{p.caption}</div>:<div style={{color:"#f87171",fontSize:12,padding:16,textAlign:"center"}}>⚠ {p.error||"Sin imagen"}</div>}
      <div style={{position:"absolute",top:8,left:8,display:"flex",gap:5,flexWrap:"wrap"}}>{chip(kindLabel(p),"#60a5fa")}{conFoto(p)&&chip("📷 foto","#f472b6")}{p.pillar&&chip(p.pillar,"#E8C99B")}{p.source==="runner"&&chip("runner","#a78bfa")}{p.source==="chatbot"&&chip("chatbot","#34d399")}{p.source==="radar"&&chip("radar","#fb923c")}</div>
      {slidesOf(p).length>1&&<div style={{position:"absolute",bottom:8,left:0,right:0,display:"flex",justifyContent:"center",gap:4}}>{slidesOf(p).map((_,j)=><span key={j} style={{width:6,height:6,borderRadius:99,background:j===0?"#fff":"rgba(255,255,255,0.45)"}}/>)}</div>}
    </div>
    <div style={{padding:"12px 14px 14px",display:"flex",flexDirection:"column",gap:7,flex:1}}>
      <p style={{margin:0,fontSize:14,fontWeight:800,color:"#fff",lineHeight:1.3,letterSpacing:"-0.01em"}}>{p.headline||p.title||"—"}</p>
      {!compact&&p.subheadline&&<p style={{margin:0,fontSize:11.5,color:"rgba(255,255,255,0.6)"}}>{p.subheadline}</p>}
      {!compact&&p.caption&&<p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.5)",whiteSpace:"pre-wrap",maxHeight:96,overflow:"hidden"}}>{p.caption}</p>}
      {p.feedback&&p.status==="generating"&&<p style={{margin:0,fontSize:10.5,color:"#fbbf24"}}>✎ {p.locked_at?"Tu Mac está rehaciendo el diseño con tu cambio (5 a 8 min)":"En cola: tu Mac va a rehacer el diseño con tu cambio"}{conFoto(p)&&p.photo_url?" · misma foto":""}: {p.feedback}</p>}
      {p.publish_error&&<p style={{margin:0,fontSize:10.5,color:"#f87171"}}>{p.kind==="linkedin"?"LinkedIn":"Instagram"}: {p.publish_error}</p>}
      <div style={{marginTop:"auto",paddingTop:4,display:"flex",gap:6,flexWrap:"wrap"}}>{children}</div>
    </div>
  </div>;
  const porFiltro=(l)=>l.filter(p=>filtro==="todos"||p.kind===filtro);
  const review=porFiltro(pieces.filter(p=>["review","generating","error"].includes(p.status)));
  const cal=pieces.filter(p=>["approved","scheduled","published"].includes(p.status)).sort((a,b)=>new Date(a.scheduled_at||a.approved_at||a.created_at)-new Date(b.scheduled_at||b.approved_at||b.created_at));
  const grid={display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(260px,1fr))",gap:16,alignItems:"start"};
  const igOk=!!meta.instagram?.connected;
  const liOk=!!meta.linkedin?.connected&&!meta.linkedin?.vencido;
  const tabs=[{k:"analisis",l:"Análisis"},{k:"calendario",l:"Calendario",n:pieces.filter(p=>p.status==="approved").length},{k:"contenido",l:"Contenido",n:pieces.filter(p=>p.status==="review").length},{k:"runner",l:"Runner"},{k:"chatbot",l:"Chatbot"},{k:"marca",l:"Marca"},{k:"knowledge",l:"Knowledge"},{k:"conexion",l:"Conexión",dot:true}];
  const inp={width:"100%",boxSizing:"border-box",padding:"11px 13px",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.045)",color:"#fff",fontSize:13,outline:"none",fontFamily:"inherit"};
  const sel={padding:"9px 10px",borderRadius:11,border:"1px solid rgba(255,255,255,0.12)",background:"#142038",color:"#fff",fontSize:12.5};
  const box={background:"linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.012))",border:"1px solid rgba(255,255,255,0.09)",borderRadius:18,padding:18,boxShadow:"0 10px 30px rgba(0,0,0,0.22)"};
  const micBtn=(setter,key)=><button onClick={()=>dictar(setter,key)} title="Dictar por voz" style={{width:40,height:40,borderRadius:10,border:`1px solid ${dictando===key?"#ef4444":"rgba(255,255,255,0.12)"}`,background:dictando===key?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.05)",color:"#fff",fontSize:18,cursor:"pointer",flexShrink:0}}>{dictando===key?"■":"🎤"}</button>;
  const subirAsset=async(kindA,file)=>{if(!file)return;const fd=new FormData();fd.append("kind",kindA);fd.append("file",file,file.name);setBusy("asset");try{await api("",{method:"POST",body:fd});toast("Subido","success");await loadMeta();}catch(e){toast(e.message,"error");}finally{setBusy("");}};
  const enviarChat=async()=>{
    const txt=chatTxt.trim();if(!txt&&chatImgs.length===0)return;
    const msgs=[...chat,{role:"user",content:txt||"(imagen adjunta)"}];setChat(msgs);setChatTxt("");setBusy("chat");
    try{const b=await api("",{method:"POST",body:JSON.stringify({action:"chat",messages:msgs,images:chatImgs,kind_pref:chatKind})});setChat([...msgs,{role:"assistant",content:b.reply}]);setChatListo(b.listo?b:null);setChatImgs([]);}
    catch(e){toast(e.message,"error");}finally{setBusy("");}
  };
  const adjuntarChat=(file)=>{if(!file)return;const rd=new FileReader();rd.onload=()=>{const s=String(rd.result||"");const m=s.match(/^data:([^;]+);base64,(.*)$/);if(m)setChatImgs(x=>[...x,{mime:m[1],b64:m[2],name:file.name}].slice(0,4));};rd.readAsDataURL(file);};
  // Programación automática (28/10/2026). Tres categorías con calendario propio: posteos y carruseles,
  // historias y LinkedIn. "Día libre" = día sin nada programado ni publicado de esa categoría.
  const catDe=(k)=>k==="story"?"story":k==="linkedin"?"linkedin":"feed";
  const diaAR=(t)=>new Date(new Date(t).getTime()-3*3600000).toISOString().slice(0,10);
  const ocupadosDe=(cat)=>{const s=new Set();pieces.forEach(p=>{const t=p.scheduled_at||p.published_at;if(t&&["scheduled","published"].includes(p.status)&&p.kind!=="blog"&&catDe(p.kind)===cat)s.add(diaAR(t));});return s;};
  const diasLibres=(cat,n)=>{const occ=ocupadosDe(cat);const out=[];let t=Date.now()+86400000;for(let g=0;out.length<n&&g<1000;g++,t+=86400000){const d=diaAR(t);if(!occ.has(d))out.push(d);}return out;};
  const proximoLibre=(p)=>diasLibres(catDe(p.kind),1)[0];
  const diaCorto=(d)=>{if(!d)return "";const x=new Date(d+"T12:00:00");return `${["dom","lun","mar","mié","jue","vie","sáb"][x.getDay()]} ${x.getDate()}/${x.getMonth()+1}`;};
  const HORA_CAT={feed:10,story:10,linkedin:9};
  // Reparte al azar las aprobadas sin fecha de una categoría: una por día, en los próximos días libres.
  const repartir=async(cat,lista)=>{
    if(!lista.length)return;
    const dias=diasLibres(cat,lista.length);
    const mezcla=[...lista];for(let i=mezcla.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[mezcla[i],mezcla[j]]=[mezcla[j],mezcla[i]];}
    if(!await confirmDialog(`¿Repartir ${lista.length} pieza${lista.length===1?"":"s"} al azar, una por día, entre el ${diaCorto(dias[0])} y el ${diaCorto(dias[dias.length-1])}? Solo en los días que todavía no tienen nada.`))return;
    const items=mezcla.map((p,i)=>({id:p.id,scheduled_at:new Date(`${dias[i]}T${String(HORA_CAT[cat]).padStart(2,"0")}:00:00-03:00`).toISOString()}));
    await act("schedule_many",{items},x=>`${x.programadas} programadas · del ${diaCorto(dias[0])} al ${diaCorto(dias[dias.length-1])}`);
  };
  const programar=async()=>{if(!sched?.date)return;const iso=new Date(`${sched.date}T${String(sched.hour).padStart(2,"0")}:${String(sched.min).padStart(2,"0")}:00-03:00`);if(isNaN(iso)){toast("Fecha inválida","error");return;}await act("schedule",{id:sched.p.id,scheduled_at:iso.toISOString()},(sched.p.kind==="linkedin"?liOk:igOk)?"Programada: el vigilante la publica a esa hora":sched.p.kind==="linkedin"?"Programada (sin LinkedIn conectado: la publicás vos)":"Programada (sin Instagram conectado: la subís vos)");setSched(null);};

  const ICO_TAB={analisis:["M4 19V5","M4 19h16","M8 15l3-4 3 2 4-6"],calendario:["M4 6h16v14H4z","M4 10h16","M9 3v4","M15 3v4"],contenido:["M4 4h7v7H4z","M13 4h7v7h-7z","M4 13h7v7H4z","M13 13h7v7h-7z"],runner:["M12 3v3","M12 18v3","M3 12h3","M18 12h3","M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],chatbot:["M4 5h16v11H8l-4 4z"],marca:["M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"],knowledge:["M5 4h10l4 4v12H5z","M9 12h6","M9 16h6"],conexion:["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1","M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"]};
  const macVivo=!!(meta.estado?.mac?.last_seen_at&&Date.now()-new Date(meta.estado.mac.last_seen_at).getTime()<10*60000);
  // Conexión en verde solo si está todo (Instagram, radar, Telegram, la Mac y LinkedIn si se conectó); en rojo si falta algo.
  const conexiones=[["Instagram",igOk],["Radar",!!meta.discovery?.connected],["Telegram",!!meta.telegram?.connected],["Mac",macVivo],["LinkedIn",(!meta.linkedin?.connected||!meta.linkedin?.vencido)]];
  const conexOk=conexiones.every(([,ok])=>ok);
  const estadoPill=(ok,txt)=><span style={{display:"inline-flex",alignItems:"center",gap:7,padding:"6px 11px",borderRadius:99,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",fontSize:11.5,fontWeight:700,color:"rgba(255,255,255,0.75)",whiteSpace:"nowrap"}}><span style={{width:7,height:7,borderRadius:99,background:ok?"#4ade80":"#f87171",boxShadow:`0 0 0 3px ${ok?"rgba(74,222,128,0.18)":"rgba(248,113,113,0.18)"}`}}/>{txt}</span>;

  return <div>
    <style>{`.cs-card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,0.16)!important} .cs-tabs::-webkit-scrollbar{display:none}`}</style>
    <div className="cs-tabs" style={{display:"flex",gap:4,padding:5,marginBottom:18,borderRadius:16,background:"rgba(255,255,255,0.035)",border:"1px solid rgba(255,255,255,0.08)",overflowX:"auto",scrollbarWidth:"none"}}>
      {tabs.map(x=>{const on=tab===x.k;return <button key={x.k} onClick={()=>setTab(x.k)} style={{flex:isMobile?"0 0 auto":1,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,padding:"9px 13px",fontSize:12.5,fontWeight:800,borderRadius:12,cursor:"pointer",border:"none",whiteSpace:"nowrap",fontFamily:"inherit",background:on?`linear-gradient(135deg,${ACC}2e,${ACC}14)`:"transparent",boxShadow:on?`inset 0 0 0 1px ${ACC}66`:"none",color:on?ACC:"rgba(255,255,255,0.55)",transition:"all .15s"}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{(ICO_TAB[x.k]||[]).map((d,k)=><path key={k} d={d}/>)}</svg>
        {x.l}
        {x.n>0&&<span style={{minWidth:18,height:18,padding:"0 5px",borderRadius:99,background:"#ef4444",color:"#fff",fontSize:10,fontWeight:900,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{x.n}</span>}
        {x.dot&&<span style={{width:7,height:7,borderRadius:99,background:conexOk?"#4ade80":"#f87171",boxShadow:`0 0 0 3px ${conexOk?"rgba(74,222,128,0.18)":"rgba(248,113,113,0.18)"}`}}/>}
      </button>;})}
    </div>

    {tab==="analisis"&&(()=>{
      const n=(v)=>v==null?"—":Number(v).toLocaleString("es-AR");
      const hace=(d)=>{if(!d)return "nunca";const m=Math.round((Date.now()-new Date(d).getTime())/60000);return m<1?"recién":m<60?`hace ${m} min`:m<1440?`hace ${Math.round(m/60)} h`:`hace ${Math.round(m/1440)} d`;};
      const daily=an?.diario||[];
      // Serie de seguidores: donde no hay foto del total, se reconstruye hacia atrás con los nuevos por día.
      const serie=(()=>{const arr=daily.map(r=>({day:r.day,f:r.followers,nf:Number(r.new_followers||0),reach:Number(r.reach||0)}));let f=an?.seguidores;for(let i=arr.length-1;i>=0;i--){if(arr[i].f!=null)f=arr[i].f;else arr[i].f=f;if(f!=null)f=f-arr[i].nf;}return arr;})();
      const Chart=({data,k,color,alto=120,barras})=>{const W=600,H=alto,P=6;const vals=data.map(d=>Number(d[k]||0));const min=barras?0:Math.min(...vals),max=Math.max(...vals,min+1);const x=(i)=>P+(i*(W-2*P))/Math.max(1,data.length-1);const y=(v)=>H-P-((v-min)*(H-2*P))/(max-min);return <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:alto,display:"block"}}>
        {barras?data.map((d,i)=><rect key={i} x={P+i*((W-2*P)/data.length)} y={y(Number(d[k]||0))} width={Math.max(2,(W-2*P)/data.length-2)} height={H-P-y(Number(d[k]||0))} fill={color} opacity={0.75} rx={2}/>)
        :<><path d={data.map((d,i)=>`${i?"L":"M"}${x(i)},${y(Number(d[k]||0))}`).join(" ")} fill="none" stroke={color} strokeWidth={2.5}/><path d={`${data.map((d,i)=>`${i?"L":"M"}${x(i)},${y(Number(d[k]||0))}`).join(" ")} L${x(data.length-1)},${H-P} L${x(0)},${H-P} Z`} fill={color} opacity={0.12}/></>}
        <text x={P} y={12} fontSize={11} fill="rgba(255,255,255,0.5)">{n(min)}</text><text x={P} y={H-P-2} fontSize={11} fill="rgba(255,255,255,0.5)">{data[0]?.day?.slice(5)}</text><text x={W-P} y={H-P-2} fontSize={11} fill="rgba(255,255,255,0.5)" textAnchor="end">{data[data.length-1]?.day?.slice(5)}</text><text x={W-P} y={12} fontSize={11} fill="rgba(255,255,255,0.5)" textAnchor="end">{n(max)}</text>
      </svg>;};
      const Stat=({l,v,sub,c})=><div style={{...box,padding:"12px 14px"}}><p style={{margin:0,fontSize:10.5,fontWeight:800,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</p><p style={{margin:"4px 0 0",fontSize:24,fontWeight:900,color:c||"#fff",fontVariantNumeric:"tabular-nums"}}>{v}</p>{sub&&<p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.5)"}}>{sub}</p>}</div>;
      const Post=({x})=>{const img=x.media_url||x.thumbnail_url;const tipo=x.media_type==="CAROUSEL_ALBUM"?"Carrusel":x.product_type==="REELS"?"Reel":"Posteo";return <a href={x.permalink||"#"} target="_blank" rel="noreferrer" style={{textDecoration:"none",color:"inherit",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{background:"#0b1220",aspectRatio:"1/1"}}>{img&&<img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>{e.currentTarget.style.display="none";}}/>}</div>
        <div style={{padding:"8px 10px"}}>
          <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:4}}>{chip(tipo,"#60a5fa")}{x.piece_id&&chip("del estudio","#a78bfa")}<span style={{marginLeft:"auto",fontSize:10.5,color:"rgba(255,255,255,0.45)"}}>{x.posted_at?new Date(x.posted_at).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"}):""}</span></div>
          <p style={{margin:"0 0 6px",fontSize:11.5,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{String(x.caption||"").split("\n")[0]||"(sin texto)"}</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:11,color:"rgba(255,255,255,0.65)"}}><span title="Visualizaciones">👁 {n(x.views)}</span><span title="Alcance">📡 {n(x.reach)}</span><span title="Me gusta">♥ {n(x.like_count)}</span><span title="Guardados">🔖 {n(x.saved)}</span><span title="Compartidos">↗ {n(x.shares)}</span></div>
        </div>
      </a>;};
      return <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Instagram @{meta.instagram?.username||"argencargo_"} · datos {hace(an?.actualizado)} · se actualizan dos veces por día</span>
          <span style={{marginLeft:"auto",display:"flex",gap:6}}><Btn small variant="secondary" onClick={loadAn} disabled={anLo}>↻</Btn><Btn small onClick={async()=>{await act("ig_refresh",{},x=>`Actualizado: ${x.media??0} publicaciones, ${x.historias??0} historias`);loadAn();}} disabled={!!busy}>{busy==="ig_refresh"?"Consultando a Meta…":"Actualizar ahora"}</Btn></span>
        </div>
        {!an&&<p style={{color:"rgba(255,255,255,0.4)"}}>{anLo?"Cargando…":"Sin datos todavía."}</p>}
        {an&&!an.seguidores&&<p style={{fontSize:12,color:"#fbbf24"}}>Todavía no hay datos: tocá "Actualizar ahora". Hace falta el token de Facebook del radar (Conexión).</p>}
        {an&&<>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:14}}>
            <Stat l="Seguidores" v={n(an.seguidores)} sub={`${an.nuevos_7d>=0?"+":""}${n(an.nuevos_7d)} en 7 días · ${an.nuevos_30d>=0?"+":""}${n(an.nuevos_30d)} en 30`} c="#E8C99B"/>
            <Stat l="Alcance 30 días" v={n(an.alcance_30d)} sub={`${n(an.alcance_7d)} en los últimos 7`}/>
            <Stat l="Visitas al perfil 30 d" v={n(an.visitas_perfil_30d)} sub={`${n(an.clics_web_30d)} clics a la web`}/>
            <Stat l="Interacciones 30 d" v={n(an.interacciones_30d)} sub="me gusta, comentarios, guardados, compartidos"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:14}}>
            <div style={box}><p style={{margin:"0 0 6px",fontSize:12.5,fontWeight:800,color:"#fff"}}>Crecimiento de seguidores</p>{serie.length>1?<Chart data={serie} k="f" color="#E8C99B"/>:<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Se va armando día a día.</p>}</div>
            <div style={box}><p style={{margin:"0 0 6px",fontSize:12.5,fontWeight:800,color:"#fff"}}>Alcance por día</p>{serie.length>1?<Chart data={serie} k="reach" color="#60a5fa" barras/>:<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Se va armando día a día.</p>}</div>
          </div>
          {Object.keys(an.por_formato||{}).length>0&&<div style={{...box,marginBottom:14}}>
            <p style={{margin:"0 0 8px",fontSize:12.5,fontWeight:800,color:"#fff"}}>Promedio por formato <span style={{fontWeight:600,color:"rgba(255,255,255,0.45)"}}>· últimos 60 días</span></p>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":`repeat(${Object.keys(an.por_formato).length+1},1fr)`,gap:8}}>
              {Object.entries(an.por_formato).map(([k,v])=><div key={k} style={{padding:"8px 10px",borderRadius:9,background:"rgba(255,255,255,0.03)"}}><p style={{margin:"0 0 4px",fontSize:11,fontWeight:800,color:"#60a5fa",textTransform:"capitalize"}}>{k} <span style={{color:"rgba(255,255,255,0.4)",fontWeight:600}}>· {v.n}</span></p><p style={{margin:0,fontSize:11.5,color:"rgba(255,255,255,0.75)"}}>👁 {n(v.views)} · 📡 {n(v.reach)} · ♥ {n(v.likes)} · 🔖 {n(v.saved)} · ↗ {n(v.shares)}</p></div>)}
              <div style={{padding:"8px 10px",borderRadius:9,background:"rgba(255,255,255,0.03)"}}><p style={{margin:"0 0 4px",fontSize:11,fontWeight:800,color:"#f472b6"}}>Historias <span style={{color:"rgba(255,255,255,0.4)",fontWeight:600}}>· {an.historias_prom.n}</span></p><p style={{margin:0,fontSize:11.5,color:"rgba(255,255,255,0.75)"}}>📡 {n(an.historias_prom.reach)} · 👁 {n(an.historias_prom.views)} · 💬 {n(an.historias_prom.replies)} respuestas</p></div>
            </div>
          </div>}
          <p style={{margin:"0 0 8px",fontSize:12.5,fontWeight:800,color:"#4ade80"}}>Las que más rindieron <span style={{fontWeight:600,color:"rgba(255,255,255,0.45)"}}>· por visualizaciones, últimos 60 días</span></p>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(6,1fr)",gap:10,marginBottom:16}}>{an.mejores.map(x=><Post key={x.ig_media_id} x={x}/>)}{an.mejores.length===0&&<p style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Sin publicaciones con métricas todavía.</p>}</div>
          <p style={{margin:"0 0 8px",fontSize:12.5,fontWeight:800,color:"#f87171"}}>Las que menos rindieron</p>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(6,1fr)",gap:10,marginBottom:16}}>{an.peores.map(x=><Post key={x.ig_media_id} x={x}/>)}</div>
          {an.historias.length>0&&<div style={box}>
            <p style={{margin:"0 0 8px",fontSize:12.5,fontWeight:800,color:"#fff"}}>Historias <span style={{fontWeight:600,color:"rgba(255,255,255,0.45)"}}>· Meta solo mide mientras están activas; el sistema las captura dos veces por día</span></p>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(8,1fr)",gap:8}}>
              {an.historias.slice(0,16).map(x=><div key={x.ig_media_id} style={{borderRadius:8,overflow:"hidden",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.08)"}}><div style={{aspectRatio:"9/16",background:"#0b1220"}}>{(x.media_url||x.thumbnail_url)&&<img src={x.media_url||x.thumbnail_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>{e.currentTarget.style.display="none";}}/>}</div><div style={{padding:"5px 7px",fontSize:10.5,color:"rgba(255,255,255,0.7)"}}>{x.posted_at?new Date(x.posted_at).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"}):""} · 📡 {n(x.reach)} · 👁 {n(x.views)}{x.replies?` · 💬 ${n(x.replies)}`:""}</div></div>)}
            </div>
          </div>}
        </>}
      </div>;})()}

    {tab==="contenido"&&<div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
        {(()=>{const rev=pieces.filter(p=>p.status==="review");const cnt=(k)=>k==="todos"?rev.length:rev.filter(p=>p.kind===k).length;return [["todos","Todos"],["feed","Posteos"],["carousel","Carruseles"],["story","Historias"],["linkedin","LinkedIn"],["blog","Blog"]].map(([k,l])=><button key={k} onClick={()=>setFiltro(k)} style={{padding:"7px 13px",fontSize:12,fontWeight:800,borderRadius:99,cursor:"pointer",fontFamily:"inherit",border:`1px solid ${filtro===k?`${ACC}77`:"rgba(255,255,255,0.1)"}`,background:filtro===k?`${ACC}1f`:"rgba(255,255,255,0.03)",color:filtro===k?ACC:"rgba(255,255,255,0.6)",display:"inline-flex",alignItems:"center",gap:7,transition:"all .15s"}}>{l}{cnt(k)>0&&<span style={{fontSize:10,fontWeight:800,padding:"1px 6px",borderRadius:99,background:filtro===k?`${ACC}44`:"rgba(255,255,255,0.1)",color:"#fff"}}>{cnt(k)}</span>}</button>);})()}
        {generando>0&&<span style={{fontSize:11.5,color:"rgba(255,255,255,0.5)"}}>🎨 {generando} en la cola · tu Mac las diseña de a una (5 a 8 min cada una) mientras esté prendida.</span>}
        <span style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          {review.filter(p=>p.status==="review").length>1&&<button onClick={async()=>{const ids=review.filter(p=>p.status==="review").map(p=>p.id);if(await confirmDialog(`¿Descartar las ${ids.length} piezas que quedan sin aprobar? Se borran sus imágenes; los temas quedan anotados para no repetirlos.`))act("reject_all",{ids},x=>`${x.rechazadas} descartadas`);}} disabled={!!busy} style={{padding:"5px 10px",fontSize:11,fontWeight:700,borderRadius:8,cursor:"pointer",border:"1px solid rgba(239,68,68,0.4)",background:"rgba(239,68,68,0.1)",color:"#f87171"}}>✕ Descartar las restantes</button>}
          <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>Tocá la imagen para verla grande</span>
        </span>
      </div>
      {lo&&<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>}
      {!lo&&review.length===0&&<div style={{padding:30,textAlign:"center",color:"rgba(255,255,255,0.45)",border:"1px dashed rgba(255,255,255,0.12)",borderRadius:14}}>Nada para aprobar. Pedile ideas al Runner o charlá con el Chatbot.</div>}
      <div style={grid}>
        {review.map(p=><Card key={p.id} p={p} compact>
          {p.status==="review"&&<div style={{display:"flex",gap:6,width:"100%"}}>
            {[
              {ic:"✓",col:"#22c55e",tit:p.kind==="blog"?"Publicar en el blog":"Aprobar",fn:()=>act("approve",{id:p.id},p.kind==="blog"?"Publicada en argencargo.com.ar/blog":"Aprobada ✅ · guardada como referencia")},
              {ic:"✎",col:"#fbbf24",tit:"Pedir cambio",fn:()=>pedirCambio(p)},
              {ic:"✕",col:"#ef4444",tit:"Descartar",fn:()=>pedirDescarte(p)},
            ].map(b=><button key={b.tit} title={b.tit} onClick={b.fn} disabled={!!busy} style={{flex:b.ic==="✓"?1.4:1,height:40,borderRadius:12,border:b.ic==="✓"?"none":`1px solid ${b.col}44`,background:b.ic==="✓"?`linear-gradient(135deg,${b.col},${b.col}cc)`:`${b.col}14`,color:b.ic==="✓"?"#052e14":b.col,fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:b.ic==="✓"?`0 6px 16px ${b.col}40`:"none"}}><span style={{fontSize:14}}>{b.ic}</span>{b.ic==="✓"?(b.tit==="Aprobar"?"Aprobar":"Publicar"):b.ic==="✎"?"Cambio":"Descartar"}</button>)}
          </div>}
          {p.status==="error"&&<Btn small variant="secondary" onClick={()=>act("regenerate",{id:p.id},"Reintentando")} disabled={!!busy}>↻ Reintentar</Btn>}
        </Card>)}
      </div>
    </div>}

    {tab==="calendario"&&(()=>{
      const sinFecha=pieces.filter(p=>p.status==="approved"&&p.kind!=="blog");
      const key=(dt)=>{const x=new Date(dt);return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;};
      const hoyK=key(new Date());
      const hora=(p)=>new Date(p.scheduled_at||p.published_at).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
      const Mini=({p})=><button onClick={()=>setCalSel(p)} title={`${hora(p)} · ${p.headline||p.title||""}`} style={{border:"none",padding:0,background:"transparent",cursor:"pointer",width:"100%",textAlign:"left"}}>
        <div style={{display:"flex",gap:6,alignItems:"center",padding:"3px 4px",borderRadius:7,background:p.status==="published"?"rgba(74,222,128,0.1)":"rgba(96,165,250,0.12)",border:`1px solid ${p.status==="published"?"rgba(74,222,128,0.35)":"rgba(96,165,250,0.35)"}`}}>
          <div style={{width:26,height:p.kind==="story"?40:32,borderRadius:4,overflow:"hidden",background:"#0b1220",flexShrink:0}}>{p.image_url?<img src={p.image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>:p.kind==="linkedin"?<span style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontSize:11,fontWeight:900,color:"#38bdf8"}}>in</span>:null}</div>
          <div style={{minWidth:0,overflow:"hidden"}}><div style={{fontSize:10,fontWeight:800,color:p.status==="published"?"#4ade80":"#60a5fa",whiteSpace:"nowrap"}}>{hora(p)}{nSlides(p)>1?` ×${nSlides(p)}`:""} {p.status==="published"?"✓":""}{p.publish_error?" ⚠":""}</div><div style={{fontSize:9.5,color:"rgba(255,255,255,0.6)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{String(p.headline||p.title||"").slice(0,18)}{String(p.headline||p.title||"").length>18?"…":""}</div></div>
        </div>
      </button>;
      // Un calendario mensual por formato (posteos e historias), cada uno con su navegación de mes.
      const Calendario=({kind,titulo})=>{
        const {y,m}=calMes[kind];
        const setMes=(f)=>setCalMes(c=>({...c,[kind]:f(c[kind])}));
        const prog=pieces.filter(p=>["scheduled","published"].includes(p.status)&&p.kind!=="blog"&&(kind==="story"?p.kind==="story":p.kind!=="story"));
        const first=new Date(y,m,1);const dow=(first.getDay()+6)%7;
        const dias=new Date(y,m+1,0).getDate();
        const celdas=[];for(let i=0;i<dow;i++)celdas.push(null);for(let d=1;d<=dias;d++)celdas.push(d);while(celdas.length%7)celdas.push(null);
        const porDia={};prog.forEach(p=>{const k=key(p.scheduled_at||p.published_at);(porDia[k]=porDia[k]||[]).push(p);});
        Object.values(porDia).forEach(l=>l.sort((a,b)=>new Date(a.scheduled_at||a.published_at)-new Date(b.scheduled_at||b.published_at)));
        const enMes=prog.filter(p=>{const x=new Date(p.scheduled_at||p.published_at);return x.getFullYear()===y&&x.getMonth()===m;}).length;
        const mesLabel=new Date(y,m,1).toLocaleDateString("es-AR",{month:"long",year:"numeric"});
        return <div style={{marginBottom:22}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
            <span style={{fontSize:15,fontWeight:900,color:"#fff",letterSpacing:"-0.01em"}}>{titulo}</span>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>· {enMes} este mes</span>
            <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
              <button onClick={()=>setMes(c=>({y:c.m===0?c.y-1:c.y,m:c.m===0?11:c.m-1}))} style={{width:32,height:32,borderRadius:99,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.04)",color:"#fff",fontSize:16,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0}}>‹</button>
              <span style={{fontSize:12.5,fontWeight:800,color:"#fff",textTransform:"capitalize",minWidth:140,textAlign:"center"}}>{mesLabel}</span>
              <button onClick={()=>setMes(c=>({y:c.m===11?c.y+1:c.y,m:c.m===11?0:c.m+1}))} style={{width:32,height:32,borderRadius:99,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.04)",color:"#fff",fontSize:16,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0}}>›</button>
            </div>
          </div>
          {isMobile
            ?<div style={{display:"grid",gap:8}}>
              {celdas.filter(Boolean).map(d=>{const k=`${y}-${m}-${d}`;const l=porDia[k]||[];if(!l.length)return null;return <div key={d} style={{...box,padding:10}}><p style={{margin:"0 0 6px",fontSize:12,fontWeight:800,color:k===hoyK?"#E8C99B":"#fff"}}>{new Date(y,m,d).toLocaleDateString("es-AR",{weekday:"long",day:"numeric"})}</p><div style={{display:"grid",gap:4}}>{l.map(p=><Mini key={p.id} p={p}/>)}</div></div>;})}
              {enMes===0&&<p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0}}>Nada programado este mes.</p>}
            </div>
            :<div style={{border:"1px solid rgba(255,255,255,0.09)",borderRadius:18,overflow:"hidden",background:"rgba(255,255,255,0.015)",boxShadow:"0 10px 30px rgba(0,0,0,0.22)"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"rgba(255,255,255,0.03)"}}>{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d=><div key={d} style={{padding:"6px 8px",fontSize:10.5,fontWeight:800,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.05em",textAlign:"center"}}>{d}</div>)}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))"}}>
                {celdas.map((d,i)=>{const k=d?`${y}-${m}-${d}`:null;const l=k?(porDia[k]||[]):[];const esHoy=k===hoyK;return <div key={i} style={{minHeight:kind==="story"?96:88,minWidth:0,overflow:"hidden",padding:6,borderTop:"1px solid rgba(255,255,255,0.06)",borderLeft:i%7?"1px solid rgba(255,255,255,0.06)":"none",background:esHoy?"rgba(184,149,106,0.07)":d?"transparent":"rgba(0,0,0,0.15)"}}>
                  {d&&<div style={{width:22,height:22,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,marginBottom:4,background:esHoy?ACC:"transparent",color:esHoy?"#0b1220":"rgba(255,255,255,0.55)"}}>{d}</div>}
                  <div style={{display:"grid",gap:3}}>{l.map(p=><Mini key={p.id} p={p}/>)}</div>
                </div>;})}
              </div>
            </div>}
        </div>;
      };
      return <div>
        {!igOk&&<p style={{fontSize:11.5,color:"#fbbf24",margin:"0 0 10px"}}>Instagram no está conectado: lo programado no se publica solo.</p>}
        <div style={{...box,marginBottom:22}}>
          <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
            <p style={{margin:0,fontSize:15,fontWeight:900,color:"#fff",letterSpacing:"-0.01em"}}>Sin programar</p>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.45)"}}>Aprobadas que todavía no tienen día. Programá cada una o repartilas al azar en los días libres.</span>
          </div>
          {sinFecha.length===0&&<p style={{margin:"12px 0 0",fontSize:12.5,color:"rgba(255,255,255,0.4)"}}>Nada pendiente. Lo que aprobás en Contenido aparece acá.</p>}
          {[["feed","Posteos y carruseles"],["story","Historias"],["linkedin","LinkedIn"]].map(([cat,tit])=>{
            const ls=sinFecha.filter(p=>catDe(p.kind)===cat);if(!ls.length)return null;
            const libres=diasLibres(cat,ls.length);
            return <div key={cat} style={{marginTop:16,paddingTop:16,borderTop:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
                <span style={{fontSize:13.5,fontWeight:800,color:"#fff"}}>{tit}</span>
                <span style={{minWidth:22,height:22,padding:"0 7px",borderRadius:99,background:`${ACC}22`,color:ACC,fontSize:11.5,fontWeight:900,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{ls.length}</span>
                <span style={{fontSize:11.5,color:"rgba(255,255,255,0.45)"}}>{ls.length>1?`Días libres: ${diaCorto(libres[0])} → ${diaCorto(libres[libres.length-1])}`:`Próximo día libre: ${diaCorto(libres[0])}`}</span>
                <button onClick={()=>repartir(cat,ls)} disabled={!!busy} style={{marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:8,height:36,padding:"0 15px",borderRadius:11,border:"none",background:`linear-gradient(135deg,${ACC},${ACC}bb)`,color:"#0b1220",fontSize:12.5,fontWeight:900,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 6px 18px ${ACC}40`}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/></svg>
                  {busy==="schedule_many"?"Repartiendo…":"Repartir al azar"}
                </button>
              </div>
              <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:6}}>
                {ls.map(p=><div key={p.id} style={{flex:"0 0 auto",width:164,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:8}}>
                  <div onClick={()=>setPreview(p)} style={{height:cat==="story"?190:150,borderRadius:10,overflow:"hidden",background:"#070d18",cursor:"zoom-in",marginBottom:8,display:"flex",justifyContent:"center",position:"relative"}}>{p.image_url?<img src={p.image_url} alt="" style={{height:"100%",objectFit:"contain"}}/>:p.kind==="linkedin"?<div style={{padding:"8px 10px",fontSize:10.5,lineHeight:1.4,color:"rgba(255,255,255,0.75)",whiteSpace:"pre-wrap",overflow:"hidden",width:"100%"}}>{String(p.caption||"").slice(0,220)}</div>:null}<span style={{position:"absolute",left:6,top:6}}>{chip(kindLabel(p),"#60a5fa")}</span></div>
                  <p style={{margin:"0 2px 8px",fontSize:11.5,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={p.headline||p.title||""}>{p.headline||p.title||"—"}</p>
                  <div style={{display:"flex",gap:5}}>
                    {[
                      {t:"Programar: día y hora",ic:<IcoCalendario/>,col:ACC,fn:()=>setSched({p,date:proximoLibre(p),hour:HORA_CAT[catDe(p.kind)],min:0}),show:true},
                      {t:"Subir ahora a Instagram",ic:<IcoInstagram/>,col:"#f472b6",fn:async()=>{if(await confirmDialog("¿Publicar ahora en Instagram?"))act("publish_now",{id:p.id},"Publicada en Instagram");},show:igOk&&p.kind!=="linkedin"},
                      ...(typeof liOk!=="undefined"?[{t:"Publicar ahora en LinkedIn",ic:<IcoLinkedin/>,col:"#38bdf8",fn:async()=>{if(await confirmDialog(`¿Publicar ahora en LinkedIn como ${p.li_author==="pagina"?"la página":"vos"}?`))act("publish_now",{id:p.id},"Publicada en LinkedIn");},show:liOk&&p.kind==="linkedin"}]:[]),
                      {t:"Descargar la imagen",ic:<IcoDescarga/>,col:"#60a5fa",fn:()=>{const a=document.createElement("a");a.href=p.image_url;a.download="";a.target="_blank";a.rel="noreferrer";a.click();},show:!!p.image_url},
                    ].filter(b=>b.show).map((b,bi)=><button key={b.t} title={b.t} onClick={b.fn} disabled={!!busy} style={{flex:bi===0?1.6:1,height:36,borderRadius:10,border:bi===0?"none":`1px solid ${b.col}44`,background:bi===0?`${ACC}26`:`${b.col}14`,color:b.col,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontSize:11.5,fontWeight:800,fontFamily:"inherit"}}>{b.ic}{bi===0&&!isMobile?"Programar":""}</button>)}
                  </div>
                </div>)}
              </div>
            </div>;
          })}
        </div>
        <Calendario kind="feed" titulo="Posteos, carruseles y LinkedIn"/>
        <Calendario kind="story" titulo="Historias"/>
        {calSel&&<div onClick={()=>setCalSel(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1px solid rgba(184,149,106,0.4)",borderRadius:14,padding:16,width:"100%",maxWidth:420,maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8}}>{chip(kindLabel(calSel),"#60a5fa")}<span style={{fontSize:12,fontWeight:700,color:calSel.status==="published"?"#4ade80":"#60a5fa"}}>{calSel.status==="published"?`✓ Publicada ${fmt(calSel.published_at)}${calSel.ig_media_id?" · en Instagram":calSel.li_post_urn?" · en LinkedIn":""}`:`📅 ${fmt(calSel.scheduled_at)}`}</span>{calSel.li_post_urn&&<a href={`https://www.linkedin.com/feed/update/${calSel.li_post_urn}/`} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#38bdf8"}}>ver post ↗</a>}<button onClick={()=>setCalSel(null)} style={{marginLeft:"auto",background:"none",border:"none",color:"rgba(255,255,255,0.5)",fontSize:20,cursor:"pointer"}}>×</button></div>
            {calSel.image_url&&<img src={calSel.image_url} alt="" onClick={()=>setPreview(calSel)} style={{width:"100%",maxHeight:380,objectFit:"contain",borderRadius:8,background:"#0b1220",cursor:"zoom-in"}}/>}
            <p style={{margin:"8px 0 2px",fontSize:13,fontWeight:800,color:"#fff"}}>{calSel.headline||calSel.title}</p>
            {calSel.caption&&<p style={{margin:"0 0 8px",fontSize:11.5,color:"rgba(255,255,255,0.55)",whiteSpace:"pre-wrap",maxHeight:120,overflow:"auto"}}>{calSel.caption}</p>}
            {calSel.publish_error&&<p style={{margin:"0 0 8px",fontSize:11,color:"#f87171"}}>{calSel.kind==="linkedin"?"LinkedIn":"Instagram"}: {calSel.publish_error}</p>}
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {calSel.status!=="published"&&<Btn small onClick={()=>{setSched({p:calSel,date:isoAR(calSel.scheduled_at),hour:new Date(calSel.scheduled_at).getHours(),min:Math.round(new Date(calSel.scheduled_at).getMinutes()/15)*15%60});setCalSel(null);}} disabled={!!busy}>📅 Cambiar fecha</Btn>}
              {calSel.status!=="published"&&igOk&&calSel.kind!=="linkedin"&&<Btn small variant="secondary" onClick={async()=>{if(await confirmDialog("¿Publicar ahora en Instagram?")){await act("publish_now",{id:calSel.id},"Publicada en Instagram");setCalSel(null);}}} disabled={!!busy}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><IcoInstagram/> Subir ahora</span></Btn>}
              {calSel.status!=="published"&&liOk&&calSel.kind==="linkedin"&&<Btn small variant="secondary" onClick={async()=>{if(await confirmDialog("¿Publicar ahora en LinkedIn?")){await act("publish_now",{id:calSel.id},"Publicada en LinkedIn");setCalSel(null);}}} disabled={!!busy}><span style={{display:"inline-flex",alignItems:"center",gap:6}}><IcoLinkedin/> Publicar ahora</span></Btn>}
              {calSel.status!=="published"&&<Btn small variant="secondary" onClick={async()=>{await act("unschedule",{id:calSel.id},"Vuelve a Sin programar");setCalSel(null);}} disabled={!!busy}>Quitar del calendario</Btn>}
              {calSel.image_url&&<a href={calSel.image_url} download target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn small variant="secondary" title="Descargar la imagen"><IcoDescarga/></Btn></a>}
              {calSel.status!=="published"&&<Btn small variant="secondary" onClick={async()=>{await act("published",{id:calSel.id},"Marcada como publicada");setCalSel(null);}} disabled={!!busy} title="La subí a mano">✓</Btn>}
            </div>
          </div>
        </div>}
      </div>;})()}

    {tab==="runner"&&(()=>{const es=meta.estado;const tot=runMix.feed+runMix.carousel+runMix.story+(runMix.linkedin||0);
      const hace=(d)=>{if(!d)return "nunca";const m=Math.round((Date.now()-new Date(d).getTime())/60000);return m<1?"recién":m<60?`hace ${m} min`:m<1440?`hace ${Math.round(m/60)} h`:`hace ${Math.round(m/1440)} d`;};
      const macOk=!!(es?.mac?.last_seen_at&&Date.now()-new Date(es.mac.last_seen_at).getTime()<10*60000);
      const usd=(v)=>`USD ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
      const Stat=({l,v,c})=><div style={{display:"flex",justifyContent:"space-between",gap:8,padding:"5px 0",borderTop:"1px solid rgba(255,255,255,0.05)",fontSize:12}}><span style={{color:"rgba(255,255,255,0.55)"}}>{l}</span><span style={{fontWeight:800,color:c||"#fff",fontVariantNumeric:"tabular-nums"}}>{v}</span></div>;
      const numInp=(k)=><input type="number" min={0} max={30} value={runMix[k]} onChange={e=>setRunMix(m=>({...m,[k]:Math.max(0,Math.min(30,Math.round(Number(e.target.value)||0)))}))} onFocus={e=>e.target.select()} style={{...inp,width:96,textAlign:"center",fontSize:18,fontWeight:800,padding:"8px 6px"}}/>;
      return <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"minmax(0,1fr) 300px",gap:14,alignItems:"start"}}>
      <div style={{display:"grid",gap:12}}>
        <div style={box}>
          <p style={{margin:"0 0 6px",fontSize:13,fontWeight:800,color:"#fff"}}>El analista</p>
          <p style={{margin:"0 0 12px",fontSize:12,color:"rgba(255,255,255,0.55)"}}>Lee la marca (knowledge, aprendizajes e historial), el radar de noticias (lee los artículos), lo que publicó la competencia y los datos reales del sistema, y propone piezas en el formato que le corresponde a cada idea, con o sin foto real. Caen en Contenido: nunca publica solo. Los posts de LinkedIn no pasan por el analista: el tema sale de datos reales (la semana, el blog, el radar) y tu Mac los escribe.</p>
          <div style={{display:"flex",gap:16,alignItems:"flex-end",flexWrap:"wrap"}}>
            {[["feed","Posteos","una imagen, una idea que cierra sola"],["carousel","Carruseles","2 a 6 imágenes, lo educativo en partes"],["story","Historias","sueltas o secuencias de 2 a 4; lo decide el analista"],["linkedin","LinkedIn","texto en primera persona (a veces con imagen); lo escribe tu Mac, sin costo"]].map(([k,l,h])=><div key={k}>
              <p style={{margin:"0 0 4px",fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</p>
              {numInp(k)}
              <p style={{margin:"4px 0 0",fontSize:10.5,color:"rgba(255,255,255,0.4)",maxWidth:170}}>{h}</p>
            </div>)}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <span style={{fontSize:11,color:tot>30?"#f87171":"rgba(255,255,255,0.5)"}}>Total: {tot} pieza{tot===1?"":"s"}{tot>30?" (máximo 30 por corrida)":""}</span>
              <Btn onClick={async()=>{const b=await act("runner",{mix:runMix},x=>`${x.created} ideas propuestas`);if(b){loadMeta();setTab("contenido");}}} disabled={!!busy||!tot||tot>30}>{busy==="runner"?"Pensando…":"Proponer"}</Btn>
            </div>
          </div>
        </div>
        <div style={box}>
          <p style={{margin:"0 0 8px",fontSize:13,fontWeight:800,color:"#fff"}}>Corridas</p>
          {meta.runs.length===0&&<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Todavía no corrió.</p>}
          {meta.runs.map(r=>{const s=r.resumen;return <div key={r.id} style={{padding:"9px 0",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:"#fff",fontWeight:700}}>{fmt(r.started_at)}</span>
              <span style={{fontSize:11.5,color:"rgba(255,255,255,0.5)"}}>{r.kind==="runner"?"analista":r.kind} · {r.created} de {r.requested} propuestas</span>
              {s&&<span style={{marginLeft:"auto",display:"flex",gap:6,flexWrap:"wrap"}}>
                {chip(`✓ ${s.aprobadas} aprobadas`,"#22c55e")}{s.descartadas>0&&chip(`✕ ${s.descartadas}`,"#ef4444")}
                {chip(s.fotos?`📷 ${s.fotos} foto${s.fotos===1?"":"s"} · ${usd(s.costo)}`:"sin fotos · USD 0,00","#f472b6")}
              </span>}
            </div>
            {r.log&&<pre style={{margin:"5px 0 0",fontSize:11,color:"rgba(255,255,255,0.5)",whiteSpace:"pre-wrap",fontFamily:"inherit"}}>{r.log}</pre>}
          </div>;})}
        </div>
      </div>
      <div style={{display:"grid",gap:12}}>
        <div style={box}>
          <p style={{margin:"0 0 6px",fontSize:13,fontWeight:800,color:"#fff"}}>Tu Mac</p>
          <p style={{margin:0,fontSize:12,color:macOk?"#4ade80":"#f87171"}}>{macOk?"● Conectada":"● Sin señal"} <span style={{color:"rgba(255,255,255,0.45)"}}>· último contacto {hace(es?.mac?.last_seen_at)}</span></p>
          <p style={{margin:"4px 0 0",fontSize:11,color:"rgba(255,255,255,0.45)"}}>Pide trabajo cada 2 minutos mientras está prendida.</p>
          <Stat l="En la cola" v={es?.cola?.total??"—"}/>
          <Stat l="Diseñando ahora" v={es?.cola?.en_curso??"—"}/>
        </div>
        <div style={box}>
          <p style={{margin:"0 0 4px",fontSize:13,fontWeight:800,color:"#fff"}}>Este mes</p>
          <Stat l="Propuestas" v={es?.mes?.propuestas??"—"}/>
          <Stat l="Aprobadas" v={es?.mes?.aprobadas??"—"} c="#4ade80"/>
          <Stat l="Publicadas" v={es?.mes?.publicadas??"—"} c="#60a5fa"/>
          <Stat l="Descartadas" v={es?.mes?.descartadas??"—"} c="rgba(255,255,255,0.6)"/>
          <Stat l="Esperando tu visto" v={es?.mes?.en_revision??"—"} c="#fbbf24"/>
          <Stat l="Posteos / carruseles / historias" v={es?`${es.mes.posteos} / ${es.mes.carruseles} / ${es.mes.historias}`:"—"}/>
          <Stat l="Posts de LinkedIn" v={es?.mes?.linkedin??"—"} c="#38bdf8"/>
        </div>
        <div style={box}>
          <p style={{margin:"0 0 4px",fontSize:13,fontWeight:800,color:"#fff"}}>Fotos reales (fal.ai)</p>
          <Stat l="Fotos este mes" v={es?.mes?.fotos??"—"}/>
          <Stat l="Costo este mes" v={es?usd(es.mes.costo_fotos_usd):"—"} c="#f472b6"/>
          <Stat l="Promedio por foto" v={es?.mes?.fotos?usd(es.mes.costo_fotos_usd/es.mes.fotos):"—"}/>
          <p style={{margin:"6px 0 0",fontSize:10.5,color:"rgba(255,255,255,0.4)"}}>Estimado por tarifa: escena (Flux 2) ≈ USD 0,045 · con marca (Nano Banana Pro) ≈ USD 0,15. El diseño en tu Mac no tiene costo.</p>
        </div>
        <div style={box}>
          <p style={{margin:"0 0 4px",fontSize:13,fontWeight:800,color:"#fff"}}>Radar de competencia</p>
          <Stat l="Estado" v={es?.radar?.conectado?"conectado":"sin conectar"} c={es?.radar?.conectado?"#4ade80":"#fbbf24"}/>
          <Stat l="Cuentas" v={es?.radar?.cuentas??"—"}/>
          <Stat l="Último escaneo" v={hace(es?.radar?.ultimo)}/>
          <Stat l="Próximo" v="domingo 22:00"/>
        </div>
      </div>
    </div>;})()}

    {tab==="chatbot"&&<div style={{maxWidth:760}}>
      <div style={{...box,minHeight:300,display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.45)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Formato</span>
          {[["auto","Que decida"],["feed","Posteo"],["carousel","Carrusel"],["story","Historia"]].map(([k,l])=><button key={k} onClick={()=>setChatKind(k)} style={{padding:"5px 10px",fontSize:11.5,fontWeight:700,borderRadius:8,cursor:"pointer",border:`1px solid ${chatKind===k?"rgba(96,165,250,0.5)":"rgba(255,255,255,0.1)"}`,background:chatKind===k?"rgba(96,165,250,0.15)":"transparent",color:chatKind===k?"#60a5fa":"rgba(255,255,255,0.55)"}}>{l}</button>)}
        </div>
        {chat.length===0&&<p style={{margin:0,fontSize:12.5,color:"rgba(255,255,255,0.5)"}}>Contale una idea suelta, adjuntá una captura o dictá un audio. El estratega la va armando con vos y, cuando está lista, la manda a diseñar.</p>}
        {chat.map((m,i)=><div key={i} style={{alignSelf:m.role==="assistant"?"flex-start":"flex-end",maxWidth:"85%",background:m.role==="assistant"?"rgba(96,165,250,0.12)":"rgba(255,255,255,0.07)",border:`1px solid ${m.role==="assistant"?"rgba(96,165,250,0.3)":"rgba(255,255,255,0.1)"}`,borderRadius:12,padding:"8px 11px",fontSize:13,color:"#fff",whiteSpace:"pre-wrap"}}>{m.content}</div>)}
        {chatListo&&<div style={{alignSelf:"flex-start",background:"rgba(52,211,153,0.12)",border:"1px solid rgba(52,211,153,0.35)",borderRadius:12,padding:"10px 12px"}}>
          <p style={{margin:"0 0 4px",fontSize:12,fontWeight:800,color:"#34d399"}}>Idea lista · {({feed:"posteo",carousel:"carrusel",story:"historia"})[chatKind!=="auto"?chatKind:chatListo.kind]||"posteo"}{Number(chatListo.slides)>1?` ×${chatListo.slides}`:""}{chatListo.photo?" · 📷 con foto real":""} · {chatListo.title}</p>
          <p style={{margin:"0 0 8px",fontSize:11.5,color:"rgba(255,255,255,0.7)",whiteSpace:"pre-wrap"}}>{chatListo.brief}</p>
          {Array.isArray(chatListo.slides_plan)&&chatListo.slides_plan.length>0&&<ol style={{margin:"0 0 8px",paddingLeft:18,fontSize:11.5,color:"rgba(255,255,255,0.65)"}}>{chatListo.slides_plan.map((s,i)=><li key={i}>{s}</li>)}</ol>}
          <Btn small onClick={async()=>{const b=await act("generate",{brief:chatListo.brief,kind:chatKind!=="auto"?chatKind:chatListo.kind,slides:chatListo.slides,slides_plan:chatListo.slides_plan,photo:!!chatListo.photo,photo_brand:!!chatListo.photo_brand,photo_prompt:chatListo.photo_prompt||"",title:chatListo.title,pillar:chatListo.pillar,direct:true},"A la cola: tu Mac la diseña");if(b){setChat([]);setChatListo(null);setTab("contenido");}}} disabled={!!busy}>🎨 Generar esta pieza</Btn>
        </div>}
      </div>
      {chatImgs.length>0&&<div style={{display:"flex",gap:6,marginTop:8}}>{chatImgs.map((im,i)=><span key={i} style={{fontSize:10.5,padding:"3px 8px",borderRadius:6,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.7)"}}>📎 {im.name} <button onClick={()=>setChatImgs(x=>x.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#f87171",cursor:"pointer"}}>×</button></span>)}</div>}
      <div style={{display:"flex",gap:8,alignItems:"flex-end",marginTop:8}}>
        <input type="file" accept="image/*" id="cs-chat-file" style={{display:"none"}} onChange={e=>{adjuntarChat(e.target.files?.[0]);e.target.value="";}}/>
        <button onClick={()=>document.getElementById("cs-chat-file")?.click()} title="Adjuntar imagen" style={{width:40,height:40,borderRadius:10,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.05)",color:"#fff",fontSize:20,cursor:"pointer",flexShrink:0}}>+</button>
        {micBtn(setChatTxt,"chat")}
        <textarea value={chatTxt} onChange={e=>setChatTxt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();enviarChat();}}} rows={2} placeholder="Escribí o dictá tu idea…" style={{...inp,resize:"none"}}/>
        <Btn onClick={enviarChat} disabled={busy==="chat"||(!chatTxt.trim()&&chatImgs.length===0)}>{busy==="chat"?"…":"Enviar"}</Btn>
      </div>
    </div>}

    {tab==="marca"&&<div style={{display:"grid",gap:14}}>
      <div style={box}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><p style={{margin:0,fontSize:13,fontWeight:800,color:"#fff"}}>Brand kit</p><span style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>Logos que el diseñador puede usar en el HTML</span><label style={{marginLeft:"auto"}}><input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{subirAsset("logo",e.target.files?.[0]);e.target.value="";}}/><span style={{fontSize:12,fontWeight:700,padding:"6px 11px",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",color:"#fff"}}>Subir logo</span></label></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10}}>
          {meta.assets.filter(a=>a.kind==="logo").map(a=><div key={a.id} style={{background:"#fff",borderRadius:10,padding:8,textAlign:"center"}}><img src={a.url} alt={a.name||""} style={{width:"100%",height:70,objectFit:"contain"}}/><p style={{margin:"4px 0 0",fontSize:10,color:"#334155",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name||"logo"}</p><button onClick={async()=>{if(await confirmDialog("¿Quitar este logo?"))act("asset_delete",{id:a.id},"Quitado").then(loadMeta);}} style={{background:"none",border:"none",color:"#ef4444",fontSize:10.5,cursor:"pointer"}}>quitar</button></div>)}
        </div>
      </div>
      <div style={box}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><p style={{margin:0,fontSize:13,fontWeight:800,color:"#fff"}}>Posteos de referencia</p><span style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>Capturas de posts que te gustan (tuyos o ajenos): el diseñador los estudia para mantener el estilo</span><label style={{marginLeft:"auto"}}><input type="file" accept="image/*" multiple style={{display:"none"}} onChange={async e=>{for(const f of Array.from(e.target.files||[]))await subirAsset("reference",f);e.target.value="";}}/><span style={{fontSize:12,fontWeight:700,padding:"6px 11px",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",color:"#fff"}}>Subir capturas</span></label></div>
        {meta.assets.filter(a=>a.kind==="reference").length===0&&<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Todavía no hay referencias. Subí 10 a 20 capturas de posts que te gusten (las de Magforce, por ejemplo).</p>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
          {meta.assets.filter(a=>a.kind==="reference").map(a=><div key={a.id} style={{position:"relative",borderRadius:10,overflow:"hidden",background:"#0b1220"}}><img src={a.url} alt="" style={{width:"100%",aspectRatio:"4/5",objectFit:"cover",display:"block"}}/><button onClick={async()=>{if(await confirmDialog("¿Quitar esta referencia?"))act("asset_delete",{id:a.id},"Quitada").then(loadMeta);}} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",borderRadius:6,cursor:"pointer",fontSize:12,padding:"2px 6px"}}>×</button></div>)}
        </div>
      </div>
      <div style={box}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
          <p style={{margin:0,fontSize:13,fontWeight:800,color:"#fff"}}>Radar de competencia</p>
          {meta.discovery?.connected?<span style={{fontSize:11,color:"#4ade80"}}>· mira {meta.competitors.filter(c=>c.active!==false).length} cuentas los domingos a la noche (corre en la nube, no en tu Mac)</span>:<span style={{fontSize:11,color:"#fbbf24"}}>· sin conectar: cargá el token de Facebook en Conexión</span>}
          {(()=>{const ok=comp.posts.filter(p=>p.analysis&&!p.analysis.error).length;const pend=comp.posts.filter(p=>!p.analysis&&p.media_type!=="VIDEO").length;if(!comp.posts.length)return null;return <span style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:8,background:pend?"rgba(251,191,36,0.12)":"rgba(74,222,128,0.12)",color:pend?"#fbbf24":"#4ade80",border:`1px solid ${pend?"rgba(251,191,36,0.4)":"rgba(74,222,128,0.4)"}`}}>{pend?`⏳ ${ok} analizados · ${pend} en cola (~${Math.ceil(pend/3)} min)`:`✓ ${ok} posts analizados, todo al día`}</span>;})()}
          <span style={{marginLeft:"auto",display:"flex",gap:6}}>
            <Btn small variant="secondary" onClick={loadComp} disabled={comp.lo}>↻</Btn>
            {meta.discovery?.connected&&<Btn small onClick={async()=>{await act("competencia_scan",{},x=>`${x.cuentas} cuentas · ${x.nuevos} posts nuevos · ${x.analizados} analizados${x.pendientes?` · ${x.pendientes} se analizan solos en la próxima hora`:""}${x.errores?.length?` · ${x.errores.length} con error`:""}`);loadMeta();loadComp();}} disabled={!!busy}>{busy==="competencia_scan"?"Escaneando…":"Escanear ahora"}</Btn>}
          </span>
        </div>
        <p style={{margin:"0 0 10px",fontSize:12,color:"rgba(255,255,255,0.55)"}}>Baja las publicaciones de cada cuenta (imágenes y carruseles completos, sin reels) y Claude mira cada imagen: formato, gancho, concepto visual y una idea propia para Argencargo. El analista del Runner lo lee al proponer. Las historias de otras cuentas no se pueden leer por API: esas las mirás vos y, si te gustan, las subís como referencia arriba.</p>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
          {meta.competitors.map(c=><span key={c.id} title={c.error?`Error: ${c.error}`:c.last_checked_at?`Revisada ${fmt(c.last_checked_at)}`:"Todavía no revisada"} style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11.5,padding:"4px 8px",borderRadius:8,border:`1px solid ${c.error?"rgba(248,113,113,0.5)":c.active===false?"rgba(255,255,255,0.1)":"rgba(96,165,250,0.4)"}`,background:c.active===false?"transparent":"rgba(96,165,250,0.1)",color:c.active===false?"rgba(255,255,255,0.4)":"#fff",textDecoration:c.active===false?"line-through":"none"}}>
            <span onClick={()=>act("competitor_toggle",{id:c.id,active:c.active===false}).then(loadMeta)} style={{cursor:"pointer"}} title="Tocá para pausar / reanudar">@{c.username}{c.followers_count?<span style={{color:"rgba(255,255,255,0.45)"}}> · {c.followers_count.toLocaleString("es-AR")}</span>:null}{c.error?" ⚠":""}</span>
            <button onClick={async()=>{if(await confirmDialog(`¿Quitar @${c.username} del radar?`))act("competitor_delete",{id:c.id},"Quitada").then(loadMeta);}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",padding:0,fontSize:13}}>×</button>
          </span>)}
          <input value={compUser} onChange={e=>setCompUser(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&compUser.trim()){act("competitor_add",{username:compUser},"Agregada").then(()=>{setCompUser("");loadMeta();});}}} placeholder="@cuenta o link" style={{...inp,width:180,padding:"6px 10px",fontSize:12}}/>
          <Btn small variant="secondary" onClick={()=>act("competitor_add",{username:compUser},"Agregada").then(()=>{setCompUser("");loadMeta();})} disabled={!!busy||!compUser.trim()}>+ Agregar</Btn>
        </div>
        {comp.lo&&<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Cargando…</p>}
        {!comp.lo&&comp.posts.length===0&&<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Todavía no hay posts bajados.{meta.discovery?.connected?" Tocá Escanear ahora.":""}</p>}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(230px,1fr))",gap:10}}>
          {comp.posts.map(p=>{const a=p.analysis&&!p.analysis.error?p.analysis:null;const img=(p.media_type==="CAROUSEL_ALBUM"&&Array.isArray(p.children)&&p.children.find(c=>c.media_url&&c.media_type!=="VIDEO")?.media_url)||(p.media_type==="VIDEO"?p.thumbnail_url:p.media_url);return <div key={p.id} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <a href={p.permalink||"#"} target="_blank" rel="noreferrer" style={{display:"block",background:"#0b1220",aspectRatio:"4/5"}}>{img&&<img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>{e.currentTarget.style.display="none";}}/>}</a>
            <div style={{padding:"8px 10px",display:"flex",flexDirection:"column",gap:4,flex:1}}>
              <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:11.5,fontWeight:800,color:"#60a5fa"}}>@{p.username}</span>{chip(a?.formato||(p.media_type==="CAROUSEL_ALBUM"?"carrusel":p.media_type==="VIDEO"?"reel":"posteo"),"#a78bfa")}<span style={{fontSize:10.5,color:"rgba(255,255,255,0.45)",marginLeft:"auto"}}>♥ {p.like_count??"?"} · {p.posted_at?new Date(p.posted_at).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"}):""}</span></div>
              {a?<>
                <p style={{margin:0,fontSize:12,fontWeight:700,color:"#fff"}}>{a.gancho||a.tema}</p>
                <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.55)"}}>{a.concepto_visual}</p>
                <p style={{margin:0,fontSize:11.5,color:"#E8C99B"}}><b>Idea propia:</b> {a.idea_argencargo}</p>
                <div style={{marginTop:"auto",paddingTop:6}}><Btn small onClick={async()=>{const b=await act("generate",{brief:`${a.idea_argencargo}\n\nÁngulo inspirado en algo que funcionó en el rubro: hacé NUESTRA versión con otro texto y otro diseño. Jamás nombrar ni aludir a otras empresas.`,kind:a.formato_sugerido||"feed",title:(a.tema||"Idea del radar").slice(0,60),pillar:"educativo",direct:true,source:"radar"},"A la cola: tu Mac la diseña");if(b)setTab("contenido");}} disabled={!!busy}>🎨 Adaptar</Btn></div>
              </>:<p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.4)"}}>{p.analysis?.error?`Sin análisis: ${p.analysis.error}`:"Todavía sin analizar"}</p>}
            </div>
          </div>;})}
        </div>
      </div>
      {(()=>{const bk=meta.memory.find(m=>m.key==="brand-kit");const rs=meta.memory.find(m=>m.key==="referencias-estilo");return [bk,rs].filter(Boolean).map(m=><div key={m.key} style={box}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:13,fontWeight:800,color:"#fff"}}>{m.title}</span><span style={{marginLeft:"auto"}}><Btn small onClick={async()=>{await act("memory",{key:m.key,title:m.title,content:memEdit[m.key]??m.content},"Guardado");loadMeta();}} disabled={!!busy||memEdit[m.key]===undefined||memEdit[m.key]===m.content}>Guardar</Btn></span></div>
        <textarea value={memEdit[m.key]??m.content} onChange={e=>setMemEdit(x=>({...x,[m.key]:e.target.value}))} rows={12} style={{...inp,fontSize:12,lineHeight:1.5,fontFamily:"ui-monospace,Menlo,monospace",background:"rgba(0,0,0,0.25)",resize:"vertical"}}/>
      </div>);})()}
    </div>}

    {tab==="conexion"&&<div style={{maxWidth:720}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>{conexiones.map(([n,ok])=><span key={n}>{estadoPill(ok,ok?n:`${n} · falta`)}</span>)}</div>
      <div style={box}>
        <p style={{margin:"0 0 4px",fontSize:13,fontWeight:800,color:"#fff"}}>Instagram {igOk?<span style={{color:"#4ade80"}}>· conectado{meta.instagram.username?` (@${meta.instagram.username})`:""}</span>:<span style={{color:"#f87171"}}>· sin conectar</span>}</p>
        <p style={{margin:"0 0 12px",fontSize:12,color:"rgba(255,255,255,0.55)"}}>Con la conexión, el vigilante revisa el calendario cada minuto y publica solo lo programado (posteos e historias). Sin conexión, descargás y subís a mano.</p>
        {igOk?<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn small variant="secondary" onClick={()=>act("instagram_test",{},b=>`OK: @${b.info?.username} · ${b.info?.followers_count} seguidores`)} disabled={!!busy}>Probar conexión</Btn>
          <Btn small variant="secondary" onClick={async()=>{if(await confirmDialog("¿Desconectar Instagram?")){await act("instagram_disconnect",{},"Desconectado");loadMeta();}}} disabled={!!busy}>Desconectar</Btn>
        </div>:<div style={{display:"grid",gap:8}}>
          <input value={ig.access_token} onChange={e=>setIg(x=>({...x,access_token:e.target.value}))} placeholder="Pegá acá el token (empieza con EAA…)" style={inp} type="password"/>
          <div><Btn onClick={async()=>{const b=await act("instagram",{access_token:ig.access_token},x=>`Conectado: @${x.info?.username}${x.info?.page_name?` (página ${x.info.page_name})`:""}`);if(b){setIg({ig_user_id:"",access_token:""});loadMeta();}}} disabled={!!busy||!ig.access_token}>Conectar</Btn></div>
        </div>}
      </div>
      <div style={{...box,marginTop:12}}>
        <p style={{margin:"0 0 6px",fontSize:12.5,fontWeight:800,color:"#fff"}}>Paso a paso para conseguir el token (API de Instagram con inicio de sesión de Instagram)</p>
        <ol style={{margin:0,paddingLeft:18,fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.8}}>
          <li><b>Instagram profesional.</b> En la app: perfil → ☰ → Configuración y privacidad → Tipo de cuenta y herramientas → Cambiar a cuenta profesional → Empresa (o Creador).</li>
          <li><b>Caso de uso en la app de Meta.</b> En <a href="https://developers.facebook.com/apps/1090204430113984/use_cases/" target="_blank" rel="noreferrer" style={{color:"#60a5fa"}}>Casos de uso</a> tiene que estar "Administrar mensajes y contenido en Instagram". Entrá con <b>Personalizar</b>.</li>
          <li><b>Permisos.</b> Dentro del caso de uso, sección Permisos: tocá <b>Agregar</b> en <code>instagram_business_basic</code> y <code>instagram_business_content_publish</code>.</li>
          <li><b>Generar el token.</b> En la misma pantalla, sección <b>Generar tokens de acceso</b> (o "Generador de tokens"): <b>Agregar cuenta</b> → se abre Instagram → entrá con la cuenta de Argencargo y aceptá. Después tocá <b>Generar token</b> al lado de la cuenta y copialo (empieza con IGAA…, dura 60 días y el sistema lo renueva solo).</li>
          <li><b>Pegalo arriba y tocá Conectar.</b></li>
        </ol>
        <p style={{margin:"8px 0 0",fontSize:11,color:"rgba(255,255,255,0.45)"}}>También sirve un token de usuario de Facebook con página vinculada (Graph API Explorer): el sistema detecta solo cuál es.</p>
      </div>
      <div style={{...box,marginTop:12}}>
        <p style={{margin:"0 0 4px",fontSize:13,fontWeight:800,color:"#fff"}}>Radar de competencia {meta.discovery?.connected?<span style={{color:"#4ade80"}}>· conectado{meta.discovery.page_name?` (página ${meta.discovery.page_name})`:""}</span>:<span style={{color:"#fbbf24"}}>· sin conectar</span>}</p>
        <p style={{margin:"0 0 12px",fontSize:12,color:"rgba(255,255,255,0.55)"}}>Para mirar otras cuentas, Meta exige un token de <b>Facebook</b> con una página vinculada a tu Instagram (la conexión de arriba no alcanza: lo probé y esa API no lo permite). Es un segundo token: no toca la publicación.</p>
        {meta.discovery?.connected?<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn small variant="secondary" onClick={async()=>{if(await confirmDialog("¿Desconectar el radar de competencia?")){await act("discovery_disconnect",{},"Desconectado");loadMeta();}}} disabled={!!busy}>Desconectar</Btn>
        </div>:<div style={{display:"grid",gap:8}}>
          <input value={igDisc} onChange={e=>setIgDisc(e.target.value)} placeholder="Pegá acá el token de Facebook (empieza con EAA…)" style={inp} type="password"/>
          <div><Btn onClick={async()=>{const b=await act("discovery_connect",{access_token:igDisc},x=>`Radar conectado (página ${x.info?.page_name||"?"})`);if(b){setIgDisc("");loadMeta();}}} disabled={!!busy||!igDisc}>Conectar radar</Btn></div>
        </div>}
        <ol style={{margin:"12px 0 0",paddingLeft:18,fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.8}}>
          <li><b>Página de Facebook vinculada.</b> Si no tenés una, creala en <a href="https://www.facebook.com/pages/create" target="_blank" rel="noreferrer" style={{color:"#60a5fa"}}>facebook.com/pages/create</a> (nombre Argencargo, 2 minutos). Después, en la app de Instagram: perfil → ☰ → Configuración → Centro de cuentas → Cuentas → Agregar cuentas → Facebook, y vinculá esa página.</li>
          <li><b>Caso de uso en la app de Meta.</b> En <a href="https://developers.facebook.com/apps/1090204430113984/use_cases/" target="_blank" rel="noreferrer" style={{color:"#60a5fa"}}>Casos de uso</a> la app tiene que tener los productos "Inicio de sesión con Facebook" e "Instagram" (configuración con inicio de sesión con Facebook).</li>
          <li><b>Generar el token.</b> En el <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" style={{color:"#60a5fa"}}>Explorador de la API Graph</a>: elegí la app Argencargo Radar, dejá "Token de usuario", agregá los permisos <code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>ads_read</code> (Meta los exige todos para mirar otras cuentas) y <code>pages_manage_posts</code> (para publicar también en la página de Facebook) y tocá <b>Generar token de acceso</b>. En la ventana, marcá la página Argencargo y la cuenta @argencargo_.</li>
          <li><b>Pegalo arriba y tocá Conectar radar.</b> El sistema lo convierte en un token de página (no vence) y prueba leyendo una cuenta.</li>
        </ol>
      </div>
      <div style={{...box,marginTop:12}}>
        <p style={{margin:"0 0 4px",fontSize:13,fontWeight:800,color:"#fff"}}>Facebook {meta.discovery?.facebook_publish?<span style={{color:"#4ade80"}}>· publicando en la página{meta.discovery.page_name?` ${meta.discovery.page_name}`:""}</span>:<span style={{color:"rgba(255,255,255,0.5)"}}>· apagado</span>}</p>
        <p style={{margin:"0 0 12px",fontSize:12,color:"rgba(255,255,255,0.55)"}}>Todo lo que sale a Instagram (posteos, carruseles e historias) sale también en la página de Facebook, con el mismo texto. Usa el token del radar de competencia, que además necesita el permiso <code>pages_manage_posts</code>.</p>
        {meta.discovery?.connected
          ?<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            {meta.discovery.puede_publicar
              ?<Btn small variant={meta.discovery.facebook_publish?"secondary":"primary"} onClick={async()=>{await act("facebook_toggle",{enabled:!meta.discovery.facebook_publish},meta.discovery.facebook_publish?"Facebook apagado":"Facebook activado: lo próximo que publiques sale en las dos redes");loadMeta();}} disabled={!!busy}>{meta.discovery.facebook_publish?"Apagar Facebook":"Activar Facebook"}</Btn>
              :<span style={{fontSize:12,color:"#fbbf24"}}>El token actual no tiene <code>pages_manage_posts</code>. En el explorador (app Argencargo Radar) generá un token con ese permiso sumado a los cinco anteriores, extendelo, desconectá el radar y pegalo de nuevo.</span>}
          </div>
          :<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.5)"}}>Primero conectá el radar de competencia (token de Facebook).</p>}
      </div>
      <div style={{...box,marginTop:12}}>
        <p style={{margin:"0 0 4px",fontSize:13,fontWeight:800,color:"#fff"}}>Telegram {meta.telegram?.connected?<span style={{color:"#4ade80"}}>· conectado{meta.telegram.username?` (@${meta.telegram.username})`:meta.telegram.first_name?` (${meta.telegram.first_name})`:""}</span>:meta.telegram?.configured?<span style={{color:"#fbbf24"}}>· falta tu /start</span>:<span style={{color:"#f87171"}}>· sin token</span>}</p>
        <p style={{margin:"0 0 8px",fontSize:12,color:"rgba(255,255,255,0.55)"}}>Avisos gratis a tu celular. Te llega:</p>
        <ul style={{margin:"0 0 12px",paddingLeft:18,fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.7}}>
          <li>Cada <b>historia publicada</b> en Instagram, con las imágenes, para compartirla como estado de WhatsApp en dos toques.</li>
          <li><b>Tu Mac sin señal</b> con piezas en cola (más de 20 min, de 9 a 23).</li>
          <li><b>Sin crédito o clave rechazada</b> en Claude API o en fal.ai, apenas pasa.</li>
          <li><b>Gasto del mes</b> de Claude API y de fal.ai: al 80 % y al 100 % de los topes de abajo.</li>
          <li><b>Fallas</b>: piezas con error en tu Mac, publicaciones rechazadas por Instagram, tracking sin sincronizar hace más de 3 h, mensajes de WhatsApp rechazados por Meta.</li>
        </ul>
        {meta.telegram?.connected&&(()=>{const b=budgets||meta.telegram.budgets||{claude:40,fal:40};return <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap",marginBottom:12}}>
          {[["claude","Tope Claude API (USD/mes)"],["fal","Tope fal.ai fotos (USD/mes)"]].map(([k,l])=><div key={k}><p style={{margin:"0 0 4px",fontSize:10.5,fontWeight:800,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</p><input type="number" min={1} value={b[k]} onChange={e=>setBudgets({...b,[k]:Number(e.target.value)||0})} style={{...inp,width:120,textAlign:"center",fontWeight:800}}/></div>)}
          <Btn small onClick={async()=>{await act("telegram_budgets",{claude:b.claude,fal:b.fal},"Topes guardados");setBudgets(null);loadMeta();}} disabled={!!busy||!budgets}>Guardar topes</Btn>
        </div>;})()}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {!meta.telegram?.connected&&<Btn small onClick={async()=>{const b=await act("telegram_connect",{},x=>`Conectado con ${x.info?.first_name||x.info?.username||"tu chat"}`);if(b)loadMeta();}} disabled={!!busy||!meta.telegram?.configured}>Conectar</Btn>}
          {meta.telegram?.connected&&<Btn small variant="secondary" onClick={()=>act("telegram_test",{},"Enviado: mirá Telegram")} disabled={!!busy}>Enviar prueba</Btn>}
          {meta.telegram?.connected&&<Btn small variant="secondary" onClick={async()=>{if(await confirmDialog("¿Desconectar Telegram?")){await act("telegram_disconnect",{},"Desconectado");loadMeta();}}} disabled={!!busy}>Desconectar</Btn>}
        </div>
        {!meta.telegram?.configured&&<p style={{margin:"10px 0 0",fontSize:11.5,color:"rgba(255,255,255,0.5)"}}>Creá el bot en @BotFather (/newbot), cargá el token en Vercel como TELEGRAM_BOT_TOKEN y mandale /start al bot.</p>}
      </div>
      {(()=>{const li=meta.linkedin||{};const c=liCfg||{por_semana:li.por_semana??2,modo:li.modo||"manual",org_id:li.org_id||""};const dias=li.dias_restantes;const lab={margin:"0 0 4px",fontSize:10.5,fontWeight:800,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.05em"};return <div style={{...box,marginTop:12}}>
        <p style={{margin:"0 0 4px",fontSize:13,fontWeight:800,color:"#fff"}}>LinkedIn {li.connected?(li.vencido?<span style={{color:"#f87171"}}>· token vencido</span>:<span style={{color:"#4ade80"}}>· conectado{li.name?` (${li.name})`:""}</span>):li.configured?<span style={{color:"#fbbf24"}}>· sin conectar</span>:<span style={{color:"#f87171"}}>· falta crear la app</span>}</p>
        <p style={{margin:"0 0 10px",fontSize:12,color:"rgba(255,255,255,0.55)"}}>Posts en tu perfil personal, escritos por tu Mac en primera persona (sin costo): el resumen real de la semana, las notas del blog, noticias explicadas, educativo y cómo trabajamos. Caen en Contenido y, al aprobarlos, van al calendario. La página Argencargo queda mencionada en cada post; publicar <i>como</i> la página requiere que LinkedIn apruebe la Community Management API (se pide desde la app).</p>
        {li.connected&&<div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:10,fontSize:12}}>
          {li.picture&&<img src={li.picture} alt="" style={{width:34,height:34,borderRadius:99}}/>}
          <span style={{color:dias!=null&&dias<=7?"#fbbf24":"rgba(255,255,255,0.65)"}}>{li.vencido?"El token venció: tocá Reconectar.":dias!=null?`El token vence en ${dias} día${dias===1?"":"s"} (LinkedIn no lo renueva solo; te aviso por Telegram una semana antes).`:""}</span>
          <span style={{color:li.puede_pagina?"#4ade80":"rgba(255,255,255,0.45)"}}>{li.puede_pagina?`Página: ${li.org_name||li.org_id} · puede publicar como la página`:li.org_id?`Página ${li.org_name||li.org_id}: se menciona con link (sin permiso para publicar como página)`:"Sin página cargada: se menciona “Argencargo” como texto"}</span>
        </div>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {li.configured&&<Btn small onClick={async()=>{const b=await act("linkedin_auth_url",{pagina:liPagina});if(b?.url)window.location.href=b.url;}} disabled={!!busy}>{li.connected?"Reconectar":"Conectar LinkedIn"}</Btn>}
          {li.configured&&<label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11.5,color:"rgba(255,255,255,0.65)",cursor:"pointer"}}><input type="checkbox" checked={liPagina} onChange={e=>setLiPagina(e.target.checked)}/> pedir también los permisos de la página (solo si LinkedIn ya aprobó la Community Management API)</label>}
          {li.connected&&<Btn small variant="secondary" onClick={()=>act("linkedin_test",{},b=>`OK: ${b.info?.name||"conectado"}`)} disabled={!!busy}>Probar</Btn>}
          {li.connected&&<Btn small variant="secondary" onClick={async()=>{if(await confirmDialog("¿Desconectar LinkedIn?")){await act("linkedin_disconnect",{},"Desconectado");loadMeta();}}} disabled={!!busy}>Desconectar</Btn>}
          {!li.configured&&<span style={{fontSize:12,color:"#fbbf24"}}>Faltan LINKEDIN_CLIENT_ID y LINKEDIN_CLIENT_SECRET en Vercel (pasos de abajo).</span>}
        </div>
        <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap",marginTop:12}}>
          <div><p style={lab}>Posts por semana</p><input type="number" min={0} max={5} value={c.por_semana} onChange={e=>setLiCfg({...c,por_semana:Math.max(0,Math.min(5,Math.round(Number(e.target.value)||0)))})} style={{...inp,width:90,textAlign:"center",fontWeight:800}}/></div>
          <div><p style={lab}>Modo</p><select value={c.modo} onChange={e=>setLiCfg({...c,modo:e.target.value})} style={sel}><option value="manual">Esperan tu ✓ en Contenido</option><option value="auto">Se programan solos (lun a vie 9:30)</option></select></div>
          <div><p style={lab}>ID de la página</p><input value={c.org_id} onChange={e=>setLiCfg({...c,org_id:e.target.value})} placeholder="ej. 12345678" style={{...inp,width:140}}/></div>
          <Btn small onClick={async()=>{await act("linkedin_settings",{por_semana:c.por_semana,modo:c.modo,org_id:c.org_id,org_name:"Argencargo"},"Guardado");setLiCfg(null);loadMeta();}} disabled={!!busy||!liCfg}>Guardar</Btn>
        </div>
        <p style={{margin:"6px 0 0",fontSize:10.5,color:"rgba(255,255,255,0.4)"}}>Los lunes a las 8:45 se encolan los posts de la semana (también podés pedirlos desde Runner). El ID de la página está en la URL de su panel de administración: linkedin.com/company/<b>12345678</b>/admin/. Con él, cada post menciona a la página con link.</p>
        <ol style={{margin:"12px 0 0",paddingLeft:18,fontSize:12,color:"rgba(255,255,255,0.7)",lineHeight:1.8}}>
          <li><b>Crear la app.</b> En <a href="https://www.linkedin.com/developers/apps/new" target="_blank" rel="noreferrer" style={{color:"#60a5fa"}}>linkedin.com/developers/apps/new</a>: nombre "Argencargo Studio", LinkedIn Page: Argencargo, un logo, y aceptá los términos. Después, en la solapa <b>Settings</b> de la app, tocá <b>Verify</b>: genera un link que abrís como administrador de la página para confirmarla.</li>
          <li><b>Productos.</b> Solapa <b>Products</b>: pedí <b>Share on LinkedIn</b> y <b>Sign In with LinkedIn using OpenID Connect</b> (se aprueban al instante). Para publicar como la página, pedí además <b>Community Management API</b> (LinkedIn lo revisa: días o semanas; mientras tanto todo sale desde tu perfil con la página mencionada).</li>
          <li><b>Redirect.</b> Solapa <b>Auth</b> → OAuth 2.0 settings → Authorized redirect URLs → agregá exactamente: <code>{li.redirect||"https://www.argencargo.com.ar/api/linkedin/callback"}</code></li>
          <li><b>Claves en Vercel.</b> En la misma solapa Auth copiá <b>Client ID</b> y <b>Primary Client Secret</b> y cargalos en Vercel (Settings → Environment Variables → Production) como <code>LINKEDIN_CLIENT_ID</code> y <code>LINKEDIN_CLIENT_SECRET</code>. Redeploy.</li>
          <li><b>Conectar.</b> Volvé acá y tocá <b>Conectar LinkedIn</b>: entrás con tu cuenta, aceptás y listo. Cada 60 días se repite solo este último paso (te aviso por Telegram).</li>
        </ol>
      </div>;})()}
    </div>}

    {tab==="knowledge"&&<div style={{display:"grid",gap:14}}>
      <p style={{fontSize:12.5,color:"rgba(255,255,255,0.6)",margin:0}}>La memoria que lee el analista, el chatbot y el diseñador. Editá y guardá; aplica desde la próxima pieza. El historial se escribe solo con cada aprobación.</p>
      {meta.memory.filter(m=>!["brand-kit","referencias-estilo"].includes(m.key)).map(m=><div key={m.key} style={box}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:13,fontWeight:800,color:"#fff"}}>{m.title}</span><span style={{fontSize:10.5,color:"rgba(255,255,255,0.35)",fontFamily:"monospace"}}>{m.key}.md</span><span style={{marginLeft:"auto"}}><Btn small onClick={async()=>{await act("memory",{key:m.key,title:m.title,content:memEdit[m.key]??m.content},"Guardado");loadMeta();}} disabled={!!busy||memEdit[m.key]===undefined||memEdit[m.key]===m.content}>Guardar</Btn></span></div>
        <textarea value={memEdit[m.key]??m.content} onChange={e=>setMemEdit(x=>({...x,[m.key]:e.target.value}))} rows={m.key==="historial"?8:12} style={{...inp,fontSize:12,lineHeight:1.5,fontFamily:"ui-monospace,Menlo,monospace",background:"rgba(0,0,0,0.25)",resize:"vertical"}}/>
      </div>)}
    </div>}

    {sched&&<div onClick={()=>setSched(null)} style={{position:"fixed",inset:0,background:"rgba(3,7,15,0.78)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",zIndex:1300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#152238,#0c1626)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:22,padding:22,width:"100%",maxWidth:420,boxShadow:"0 30px 80px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16}}>
          {sched.p.image_url&&<img src={sched.p.image_url} alt="" style={{width:46,height:sched.p.kind==="story"?72:56,objectFit:"cover",borderRadius:10,flexShrink:0}}/>}
          <div style={{minWidth:0}}>
            <p style={{margin:0,fontSize:11,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:ACC}}>Programar</p>
            <p style={{margin:"3px 0 0",fontSize:14.5,fontWeight:800,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sched.p.headline||sched.p.title}</p>
          </div>
        </div>
        {(()=>{const libre=proximoLibre(sched.p);return sched.date!==libre?<button onClick={()=>setSched(s=>({...s,date:libre}))} style={{width:"100%",marginBottom:12,padding:"9px 12px",borderRadius:11,border:`1px dashed ${ACC}66`,background:`${ACC}10`,color:ACC,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>↺ Volver al próximo día libre · {diaCorto(libre)}</button>:<p style={{margin:"0 0 12px",fontSize:12,color:"#4ade80",fontWeight:700}}>✓ Es el próximo día libre de {sched.p.kind==="story"?"historias":sched.p.kind==="linkedin"?"LinkedIn":"posteos"}</p>;})()}
        <Inp label="Día" type="date" value={sched.date} onChange={v=>setSched(s=>({...s,date:v}))} marks={[...ocupadosDe(catDe(sched.p.kind))]}/>
        <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Hora</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:5,marginBottom:8}}>
          {[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map(h=><button key={h} onClick={()=>setSched(s=>({...s,hour:h}))} style={{height:34,borderRadius:9,border:`1px solid ${sched.hour===h?ACC:"rgba(255,255,255,0.1)"}`,background:sched.hour===h?`${ACC}26`:"rgba(255,255,255,0.03)",color:sched.hour===h?ACC:"rgba(255,255,255,0.75)",fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{String(h).padStart(2,"0")}</button>)}
        </div>
        <div style={{display:"flex",gap:5,marginBottom:18}}>
          {[0,15,30,45].map(m=><button key={m} onClick={()=>setSched(s=>({...s,min:m}))} style={{flex:1,height:32,borderRadius:9,border:`1px solid ${sched.min===m?ACC:"rgba(255,255,255,0.1)"}`,background:sched.min===m?`${ACC}26`:"rgba(255,255,255,0.03)",color:sched.min===m?ACC:"rgba(255,255,255,0.7)",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>:{String(m).padStart(2,"0")}</button>)}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setSched(null)} style={{flex:1,height:44,borderRadius:12,border:"1px solid rgba(255,255,255,0.14)",background:"transparent",color:"rgba(255,255,255,0.75)",fontSize:13.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
          <button onClick={programar} disabled={!!busy} style={{flex:2,height:44,borderRadius:12,border:"none",background:`linear-gradient(135deg,${ACC},${ACC}bb)`,color:"#0b1220",fontSize:13.5,fontWeight:900,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 8px 22px ${ACC}40`}}>Programar · {diaCorto(sched.date)} {String(sched.hour).padStart(2,"0")}:{String(sched.min).padStart(2,"0")}</button>
        </div>
      </div>
    </div>}

    {cambio&&<div onClick={()=>setCambio(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1300,display:"flex",alignItems:"center",justifyContent:"center",padding:16,gap:16,flexWrap:isMobile?"wrap":"nowrap",overflowY:"auto"}}>
      {slidesView(cambio.p,{maxW:isMobile?"100%":"55%",maxH:isMobile?"42vh":(slidesOf(cambio.p).length>1?"74vh":"92vh")})}
      <div onClick={e=>e.stopPropagation()} style={{width:isMobile?"100%":380,background:"linear-gradient(180deg,#142038,#0F1A2D)",border:`1px solid ${cambio.modo==="descartar"?"rgba(239,68,68,0.45)":"rgba(251,191,36,0.4)"}`,borderRadius:12,padding:16}}>
        <p style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:"#fff"}}>{cambio.modo==="descartar"?"✕ ¿Por qué la descartás?":"✎ ¿Qué cambiamos?"}</p>
        <p style={{margin:"0 0 10px",fontSize:11.5,color:"rgba(255,255,255,0.5)"}}>{cambio.modo==="descartar"?"Opcional, pero vale oro: lo que escribas queda en Aprendizajes y el sistema no repite ese error. Si ya conseguiste lo que buscabas y no hay nada mal, descartá sin comentario.":"Escribilo o dictalo. Tu Mac (Claude) rehace el diseño con estos cambios, conservando la foto; tarda 5 a 8 minutos."}</p>
        <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
          <textarea autoFocus value={cambio.texto} onChange={e=>setCambio(c=>({...c,texto:e.target.value}))} rows={6} placeholder="Ej: fondo claro, titular más corto, sacá el bloque de abajo, logo más chico arriba a la derecha" style={{...inp,resize:"vertical"}}/>
          {micBtn((fn)=>setCambio(c=>({...c,texto:typeof fn==="function"?fn(c.texto):fn})),"cambio")}
        </div>
        {cambio.modo!=="descartar"&&conFoto(cambio.p)&&<label style={{display:"flex",alignItems:"center",gap:8,marginTop:10,fontSize:12,color:"rgba(255,255,255,0.75)",cursor:"pointer"}}><input type="checkbox" checked={!!cambio.foto} onChange={e=>setCambio(c=>({...c,foto:e.target.checked}))}/> Generar una foto nueva con este cambio (si el problema es la foto, no el diseño)</label>}
        {cambio.modo==="descartar"
          ?<div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10,flexWrap:"wrap"}}><Btn variant="secondary" onClick={()=>setCambio(null)}>Cancelar</Btn><Btn variant="secondary" onClick={()=>{setCambio(c=>({...c,texto:""}));enviarDescarte();}} disabled={!!busy}>Descartar sin comentario</Btn><Btn onClick={enviarDescarte} disabled={!!busy||!(cambio.texto||"").trim()}>Descartar y anotar</Btn></div>
          :<div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}><Btn variant="secondary" onClick={()=>setCambio(null)}>Cancelar</Btn><Btn onClick={enviarCambio} disabled={!!busy||!(cambio.texto||"").trim()}>Enviar al diseñador</Btn></div>}
      </div>
    </div>}
    {preview&&<div onClick={()=>setPreview(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1300,display:"flex",alignItems:"center",justifyContent:"center",padding:16,gap:16,flexWrap:isMobile?"wrap":"nowrap",overflowY:"auto"}}>
      {slidesView(preview,{maxW:isMobile?"100%":"60%"})}
      {preview.kind==="blog"&&<div onClick={e=>e.stopPropagation()} style={{width:isMobile?"100%":340,maxHeight:"92vh",overflowY:"auto",background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:14}}>
        <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Nota de blog</p>
        <p style={{margin:"0 0 6px",fontSize:14,fontWeight:800,color:"#fff"}}>{preview.headline||preview.title}</p>
        <p style={{margin:"0 0 10px",fontSize:12.5,color:"rgba(255,255,255,0.7)",lineHeight:1.45}}>{preview.subheadline||""}</p>
        <p style={{margin:0,fontSize:11.5,color:"rgba(255,255,255,0.5)"}}>La nota completa se lee y se administra en la solapa <b>Blog</b> del menú. Con ✓ se publica en argencargo.com.ar/blog.</p>
      </div>}
      {preview.kind==="linkedin"&&<div onClick={e=>e.stopPropagation()} style={{width:isMobile?"100%":420,maxHeight:"92vh",overflowY:"auto",background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}><span style={{color:"#38bdf8",display:"inline-flex"}}><IcoLinkedin/></span><p style={{margin:0,fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Post de LinkedIn</p>
          <span style={{marginLeft:"auto",display:"inline-flex",gap:4}}>{[["persona",meta.linkedin?.name?meta.linkedin.name.split(" ")[0]:"Vos"],["pagina","Página"]].map(([k,l])=><button key={k} onClick={async()=>{if(k==="pagina"&&!meta.linkedin?.puede_pagina){toast("Publicar como la página requiere la Community Management API aprobada por LinkedIn (ver Conexión)","error");return;}await act("linkedin_author",{id:preview.id,author:k});setPreview(x=>({...x,li_author:k}));}} style={{padding:"4px 9px",fontSize:11,fontWeight:700,borderRadius:7,cursor:"pointer",border:`1px solid ${(preview.li_author||"persona")===k?"rgba(56,189,248,0.6)":"rgba(255,255,255,0.12)"}`,background:(preview.li_author||"persona")===k?"rgba(56,189,248,0.18)":"transparent",color:(preview.li_author||"persona")===k?"#38bdf8":"rgba(255,255,255,0.5)"}}>{l}</button>)}</span></div>
        <p style={{margin:"0 0 10px",fontSize:13,color:"#fff",whiteSpace:"pre-wrap",lineHeight:1.5}}>{preview.caption||"(sin texto)"}</p>
        {preview.li_link&&<p style={{margin:"0 0 10px",fontSize:11.5,color:"#60a5fa",overflowWrap:"anywhere"}}>🔗 Va con la nota como tarjeta: {preview.li_link}</p>}
        {preview.li_post_urn&&<p style={{margin:"0 0 10px",fontSize:11.5}}><a href={`https://www.linkedin.com/feed/update/${preview.li_post_urn}/`} target="_blank" rel="noreferrer" style={{color:"#38bdf8"}}>Ver el post publicado ↗</a></p>}
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn small variant="secondary" onClick={()=>{navigator.clipboard?.writeText(preview.caption||"");toast("Texto copiado","success");}}>📋 Copiar texto</Btn>{liOk&&["approved","scheduled"].includes(preview.status)&&<Btn small onClick={async()=>{if(await confirmDialog("¿Publicar ahora en LinkedIn?")){await act("publish_now",{id:preview.id},"Publicada en LinkedIn");setPreview(null);}}} disabled={!!busy}>Publicar ahora</Btn>}</div>
        <p style={{margin:"10px 0 0",fontSize:10.5,color:"rgba(255,255,255,0.4)"}}>{"{{PAGINA}}"} se convierte en la mención a la página Argencargo al publicar.</p>
      </div>}
      {preview.kind!=="story"&&preview.kind!=="blog"&&preview.kind!=="linkedin"&&<div onClick={e=>e.stopPropagation()} style={{width:isMobile?"100%":340,maxHeight:"92vh",overflowY:"auto",background:"linear-gradient(180deg,#142038,#0F1A2D)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:14}}>
        <p style={{margin:"0 0 6px",fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Texto del posteo</p>
        <p style={{margin:"0 0 10px",fontSize:13,color:"#fff",whiteSpace:"pre-wrap",lineHeight:1.45}}>{preview.caption||"(sin texto)"}</p>
        <p style={{margin:"0 0 10px",fontSize:12,color:"#60a5fa",whiteSpace:"pre-wrap"}}>{preview.hashtags||""}</p>
        <Btn small variant="secondary" onClick={()=>copiar(preview)}>📋 Copiar texto</Btn>
      </div>}
    </div>}
  </div>;
}

// Blog · argencargo.com.ar/blog: el radar elige noticias, tu Mac escribe la nota (claude -p), acá se administra.
export function BlogPanel({token}){
  const [data,setData]=useState({settings:{modo:"relevantes",por_dia:1},notas:[],candidatos:null});
  const [lo,setLo]=useState(true);const [busy,setBusy]=useState("");const [tema,setTema]=useState("");const [cfg,setCfg]=useState(null);
  const api=async(qs="",opts={})=>{const r=await fetch(`/api/admin/studio${qs}`,{...opts,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error||`HTTP ${r.status}`);return b;};
  const load=async(cands)=>{setLo(true);try{const b=await api(`?view=blog${cands?"&candidatos=1":""}`);setData(d=>({...b,candidatos:b.candidatos??d.candidatos}));}catch(e){toast(e.message,"error");}finally{setLo(false);}};
  useEffect(()=>{load(false);},[token]);
  const act=async(action,extra={},msg)=>{setBusy(action);try{const b=await api("",{method:"POST",body:JSON.stringify({action,...extra})});if(msg)toast(msg,"success");await load(false);return b;}catch(e){toast(e.message,"error");}finally{setBusy("");}};
  const s=cfg||data.settings;
  const box={background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:14};
  const inp={width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.04)",color:"#fff",fontSize:13,outline:"none",fontFamily:"inherit"};
  const chip=(txt,col)=><span style={{fontSize:9.5,fontWeight:800,padding:"2px 7px",borderRadius:6,background:`${col}22`,color:col,border:`1px solid ${col}55`,letterSpacing:"0.04em",textTransform:"uppercase"}}>{txt}</span>;
  const fmt=(d)=>d?new Date(d).toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit"}):"";
  return <div style={{display:"grid",gap:14,maxWidth:1000}}>
    <div style={box}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:8}}>
        <p style={{margin:0,fontSize:13,fontWeight:800,color:"#fff"}}>Blog de novedades</p>
        <a href="/blog" target="_blank" rel="noreferrer" style={{fontSize:12,color:"#60a5fa"}}>argencargo.com.ar/blog ↗</a>
      </div>
      <p style={{margin:"0 0 12px",fontSize:12,color:"rgba(255,255,255,0.55)"}}>Todos los días el radar elige noticias con sustancia (CDA y 14 fuentes) y tu Mac escribe una nota propia con Claude (sin costo), con portada y una nota de relevancia de 1 a 5. Las relevantes (4 o 5: un cambio concreto que afecta a quien importa) salen publicadas solas; las demás esperan tu visto acá o en Contenido.</p>
      <div style={{display:"flex",gap:14,alignItems:"flex-end",flexWrap:"wrap"}}>
        <div><p style={{margin:"0 0 4px",fontSize:10.5,fontWeight:800,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Notas por día</p><select value={s.por_dia} onChange={e=>setCfg({...s,por_dia:Number(e.target.value)})} style={{...inp,width:110}}>{[0,1,2,3].map(n=><option key={n} value={n}>{n===0?"Apagado":n}</option>)}</select></div>
        <div><p style={{margin:"0 0 4px",fontSize:10.5,fontWeight:800,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.05em"}}>Publicación</p><select value={s.modo} onChange={e=>setCfg({...s,modo:e.target.value})} style={{...inp,width:300}}><option value="relevantes">Las relevantes solas, el resto con mi visto</option><option value="todas">Todas solas</option><option value="manual">Todas con mi visto</option></select></div>
        <Btn small onClick={async()=>{await act("blog_settings",{modo:s.modo,por_dia:s.por_dia},"Guardado");setCfg(null);}} disabled={!!busy||!cfg}>Guardar</Btn>
      </div>
    </div>
    <div style={box}>
      <p style={{margin:"0 0 8px",fontSize:13,fontWeight:800,color:"#fff"}}>Escribir una nota sobre un tema</p>
      <div style={{display:"flex",gap:8}}>
        <input value={tema} onChange={e=>setTema(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&tema.trim()){act("blog_tema",{tema},"En cola: tu Mac la escribe en 5 a 10 minutos").then(()=>setTema(""));}}} placeholder="Ej: qué cambia con la nueva franquicia del régimen courier" style={inp}/>
        <Btn onClick={()=>act("blog_tema",{tema},"En cola: tu Mac la escribe en 5 a 10 minutos").then(()=>setTema(""))} disabled={!!busy||!tema.trim()}>Escribir</Btn>
      </div>
    </div>
    <div style={box}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><p style={{margin:0,fontSize:13,fontWeight:800,color:"#fff"}}>Noticias del radar</p><span style={{fontSize:11,color:"rgba(255,255,255,0.45)"}}>últimos 7 días, con el artículo leído y sin nota todavía</span><span style={{marginLeft:"auto"}}><Btn small variant="secondary" onClick={()=>load(true)} disabled={lo}>{data.candidatos?"↻ Actualizar":"Ver candidatas"}</Btn></span></div>
      {data.candidatos&&data.candidatos.length===0&&<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>No hay noticias nuevas con artículo legible.</p>}
      {data.candidatos&&data.candidatos.map(c=><div key={c.url} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{minWidth:0,flex:1}}><p style={{margin:0,fontSize:12.5,color:"#fff"}}>{c.title}</p><p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.45)"}}>{c.source_name} · {Math.round(c.chars/1000)} k caracteres · <a href={c.url} target="_blank" rel="noreferrer" style={{color:"#60a5fa"}}>ver fuente</a></p></div>
        <Btn small onClick={()=>act("blog_escribir",{url:c.url},"En cola: tu Mac la escribe en 5 a 10 minutos").then(()=>load(true))} disabled={!!busy}>Escribir nota</Btn>
      </div>)}
    </div>
    <div style={box}>
      <p style={{margin:"0 0 8px",fontSize:13,fontWeight:800,color:"#fff"}}>Notas <span style={{fontWeight:600,color:"rgba(255,255,255,0.45)"}}>· {data.notas.filter(n=>n.status==="published").length} publicadas</span></p>
      {lo&&data.notas.length===0&&<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Cargando…</p>}
      {!lo&&data.notas.length===0&&<p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.4)"}}>Todavía no hay notas. Pedí una arriba o esperá la corrida diaria.</p>}
      {data.notas.map(n=><div key={n.id} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{width:64,height:34,borderRadius:6,overflow:"hidden",background:"#0b1220",flexShrink:0}}>{n.cover_url&&<img src={n.cover_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}</div>
        <div style={{minWidth:0,flex:1}}>
          <p style={{margin:0,fontSize:12.5,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.status==="published"?<a href={`/blog/${n.slug}`} target="_blank" rel="noreferrer" style={{color:"#fff",textDecoration:"none"}}>{n.title}</a>:n.title}</p>
          <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.45)"}}>{chip(n.status==="published"?"Publicada":"Esperando tu visto",n.status==="published"?"#22c55e":"#fbbf24")}{n.relevance?<span title={n.relevance_reason||""} style={{marginLeft:6,color:n.relevance>=4?"#4ade80":"rgba(255,255,255,0.55)"}}>relevancia {n.relevance}/5</span>:null} · {fmt(n.published_at||n.created_at)}{n.source_name?` · ${n.source_name}`:""}{n.status==="published"?` · ${n.views||0} vistas`:""}</p>
        </div>
        {n.status!=="published"&&n.piece_id&&<Btn small onClick={()=>act("blog_publicar",{piece_id:n.piece_id},"Publicada")} disabled={!!busy}>Publicar</Btn>}
        {n.status==="published"&&<Btn small variant="secondary" onClick={async()=>{if(await confirmDialog("¿Despublicar esta nota?"))act("blog_despublicar",{id:n.id},"Despublicada");}} disabled={!!busy}>Despublicar</Btn>}
      </div>)}
    </div>
  </div>;
}
