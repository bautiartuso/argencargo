"use client";
// Piezas visuales de Argenmaq. Los colores son variables CSS para que el tema cambie de una.
// Regla de Bautista (20/09/2026): NADA nativo del navegador — ni selects, ni alerts, ni el botón
// de "Seleccionar archivo", ni calendarios. Todo desplegable/aviso/búsqueda es del sistema.
import { useState, useRef, useEffect } from "react";
import DatePicker from "../../components/DatePicker";

export const FONT="'Manrope',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif";
export const MONO="'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
export const INK="var(--mq-ink)", GRIS="var(--mq-gris)", BORDE="var(--mq-borde)", SUAVE="var(--mq-suave)", CARD="var(--mq-card)", BG="var(--mq-bg)";
export const LIMA="var(--mq-lima)", LIMA_SUAVE="var(--mq-lima-suave)";   // "lima" por historia: es el amarillo
export const OK="var(--mq-ok)", OK_BG="var(--mq-ok-bg)", WARN="var(--mq-warn)", WARN_BG="var(--mq-warn-bg)", BAD="var(--mq-bad)", BAD_BG="var(--mq-bad-bg)";
export const ANCHO_MENU=248;

// Tema por defecto "cat": grafito y amarillo, como la maquinaria. "claro" queda como opción.
export const CSS=`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
.mq{--mq-bg:#141517;--mq-card:#1C1E21;--mq-ink:#F3F3F1;--mq-gris:#9DA3A9;--mq-borde:#2B2E33;--mq-suave:#23262A;--mq-lima:#FFD200;--mq-lima-suave:#3A3305;--mq-lima-ink:#141517;--mq-ok:#7BD88F;--mq-ok-bg:#1B3322;--mq-warn:#F2C94C;--mq-warn-bg:#3A2F10;--mq-bad:#F28B8B;--mq-bad-bg:#3D1A1A}
.mq[data-tema="claro"]{--mq-bg:#F7F7F5;--mq-card:#FFFFFF;--mq-ink:#15171A;--mq-gris:#6B7075;--mq-borde:#E3E5E8;--mq-suave:#F0F1F3;--mq-lima:#FFD200;--mq-lima-suave:#FFF3B0;--mq-lima-ink:#15171A;--mq-ok:#1F7A2E;--mq-ok-bg:#E3F6E6;--mq-warn:#8A5B00;--mq-warn-bg:#FFF1CC;--mq-bad:#B42323;--mq-bad-bg:#FDECEC}
.mq *{box-sizing:border-box}.mq input,.mq select,.mq textarea,.mq button{font-family:${FONT}}
.mq input:focus,.mq textarea:focus{border-color:var(--mq-lima)!important;box-shadow:0 0 0 3px var(--mq-lima-suave);outline:none}
.mq ::placeholder{color:var(--mq-gris);opacity:0.7}.mq .card:hover{border-color:var(--mq-gris);box-shadow:0 6px 24px rgba(0,0,0,0.18)}
.mq .btn:hover{filter:brightness(0.97)}.mq .ghost:hover{background:var(--mq-suave)}.mq .navi:hover{background:var(--mq-suave)}.mq .fila:hover{background:var(--mq-suave)}
.mq input[type=number]{-moz-appearance:textfield}.mq input::-webkit-outer-spin-button,.mq input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.mq .side{width:${ANCHO_MENU}px;border-right:1px solid var(--mq-borde);background:var(--mq-card);position:fixed;left:0;top:0;bottom:0;overflow-y:auto;display:flex;flex-direction:column;z-index:20}
.mq .cont{margin-left:${ANCHO_MENU}px;min-height:100vh}
.mq .topmovil{display:none}
.mq .carril{display:flex;gap:12px;overflow-x:auto;padding:4px 2px 12px;scroll-snap-type:x proximity;scrollbar-width:thin}
.mq .carril>*{flex:0 0 220px;scroll-snap-align:start}
@media(max-width:900px){.mq .side{transform:translateX(-100%);transition:transform 160ms;box-shadow:0 0 40px rgba(0,0,0,0.3)}.mq .side.open{transform:none}.mq .cont{margin-left:0}.mq .topmovil{display:flex}.mq .velo{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:19}}
@media(max-width:640px){.mq .grid3{grid-template-columns:1fr!important}.mq .grid3>*{grid-column:auto!important}.mq .cont main{padding:16px 14px 90px!important}.mq .dos{grid-template-columns:1fr!important}}`;

export const INP={width:"100%",padding:"11px 13px",borderRadius:11,border:`1px solid ${BORDE}`,background:CARD,color:INK,fontSize:14,fontWeight:600,outline:"none",transition:"border-color 120ms, box-shadow 120ms"};
export const LBL={display:"block",fontFamily:MONO,fontSize:11,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:GRIS,marginBottom:7};
export const TH={...LBL,display:"table-cell",textAlign:"left",padding:"10px 12px",marginBottom:0,whiteSpace:"nowrap",background:SUAVE};
export const TD={padding:"11px 12px",borderTop:`1px solid ${BORDE}`,verticalAlign:"middle"};
export const GRID={display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14};
export const DOS={display:"grid",gridTemplateColumns:"1fr 1fr",gap:14};

export function Campo({label,ob,hint,children,span}){return <div style={{gridColumn:span?`span ${span}`:undefined,minWidth:0}}>{label&&<label style={LBL}>{label}{ob&&<span style={{color:LIMA,marginLeft:3}}>*</span>}</label>}{children}{hint&&<p style={{fontSize:12,color:GRIS,margin:"6px 0 0",lineHeight:1.4}}>{hint}</p>}</div>;}
export const Inp=({style,...p})=><input {...p} style={{...INP,...(style||{})}}/>;
export const TA=({style,...p})=><textarea {...p} style={{...INP,minHeight:96,resize:"vertical",lineHeight:1.5,fontWeight:500,...(style||{})}}/>;
export function Btn({children,onClick,kind="ghost",disabled,small,title,type="button",style}){
  const base={padding:small?"7px 13px":"11px 18px",borderRadius:999,fontSize:small?12.5:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,border:`1px solid ${BORDE}`,background:CARD,color:INK,transition:"all 120ms",whiteSpace:"nowrap"};
  const k=kind==="lima"?{background:LIMA,borderColor:LIMA,color:"var(--mq-lima-ink)"}:kind==="negro"?{background:INK,borderColor:INK,color:BG}:kind==="danger"?{color:BAD,borderColor:BAD_BG}:{};
  return <button type={type} title={title} disabled={disabled} onClick={onClick} className={kind==="ghost"?"ghost":"btn"} style={{...base,...k,...(style||{})}}>{children}</button>;
}
export function Sec({titulo,children,onDrop,onDragOver,extra,style}){return <section onDrop={onDrop} onDragOver={onDragOver} style={{background:CARD,border:`1px solid ${BORDE}`,borderRadius:18,padding:"22px 22px 24px",marginBottom:14,...(style||{})}}>{(titulo||extra)&&<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}><h3 style={{margin:0,fontSize:17,fontWeight:800,letterSpacing:"-0.01em",flex:1}}>{titulo}</h3>{extra}</div>}{children}</section>;}
export const Pill=({on,children,onClick,small})=><button type="button" onClick={onClick} style={{padding:small?"6px 11px":"8px 14px",borderRadius:999,border:`1px solid ${on?LIMA:BORDE}`,background:on?LIMA_SUAVE:CARD,color:INK,fontSize:small?12.5:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{children}</button>;
export const Chip=({l,c,bg})=><span style={{fontFamily:MONO,fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:6,background:bg,color:c,letterSpacing:"0.08em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{l}</span>;
export const Ico=({d,size=17,color="currentColor"})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>{d.map((x,i)=><path key={i} d={x}/>)}</svg>;
export const Barra=({children})=><div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8,marginBottom:18}}>{children}</div>;
export const Vacio=({children})=><div style={{border:`1px dashed ${BORDE}`,borderRadius:18,padding:"60px 20px",textAlign:"center",color:GRIS,fontSize:14}}>{children||<span style={{fontFamily:MONO,fontSize:11,letterSpacing:"0.12em",padding:"6px 12px",borderRadius:8,background:SUAVE}}>PRÓXIMAMENTE</span>}</div>;
export function Dato({l,v,sub,color,acento}){return <div style={{background:SUAVE,borderRadius:14,padding:"14px 16px 14px 18px",minWidth:0,position:"relative",overflow:"hidden"}}><span style={{position:"absolute",left:0,top:12,bottom:12,width:4,borderRadius:"0 4px 4px 0",background:acento||LIMA}}/><p style={{...LBL,marginBottom:4}}>{l}</p><p style={{margin:0,fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:color||INK,fontVariantNumeric:"tabular-nums",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</p>{sub&&<p style={{margin:"3px 0 0",fontSize:12,color:GRIS}}>{sub}</p>}</div>;}
export function Barras({series,colorA=LIMA,colorB="var(--mq-gris)",alto=120,fmt=(v)=>String(v)}){
  const max=Math.max(1,...series.flatMap(s=>[Number(s.a||0),Number(s.b||0)]));
  return <div style={{display:"grid",gridTemplateColumns:`repeat(${series.length},1fr)`,gap:6,alignItems:"end",height:alto+34}}>
    {series.map((s,i)=><div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0}}>
      <div style={{display:"flex",gap:2,alignItems:"end",height:alto,width:"100%",justifyContent:"center"}} title={`${s.l}: ${fmt(s.a||0)}${s.b!=null?` / ${fmt(s.b||0)}`:""}`}>
        <div style={{width:s.b!=null?"40%":"60%",height:`${Math.max(2,Number(s.a||0)/max*100)}%`,background:colorA,borderRadius:"4px 4px 0 0"}}/>
        {s.b!=null&&<div style={{width:"40%",height:`${Math.max(2,Number(s.b||0)/max*100)}%`,background:colorB,borderRadius:"4px 4px 0 0",opacity:0.55}}/>}
      </div>
      <span style={{fontFamily:MONO,fontSize:10,color:GRIS,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{s.l}</span>
    </div>)}
  </div>;
}
// Solapas internas de una pantalla.
export const Solapas=({items,val,onChange})=><div style={{display:"flex",gap:4,borderBottom:`1px solid ${BORDE}`,marginBottom:18,overflowX:"auto"}}>{items.map(([k,l,extra])=><button key={k} type="button" onClick={()=>onChange(k)} style={{padding:"10px 14px",border:"none",borderBottom:`2px solid ${val===k?LIMA:"transparent"}`,marginBottom:-1,background:"transparent",color:val===k?INK:GRIS,fontSize:13.5,fontWeight:val===k?800:600,cursor:"pointer",whiteSpace:"nowrap",display:"inline-flex",gap:6,alignItems:"center"}}>{l}{extra!=null&&<span style={{fontFamily:MONO,fontSize:10.5,color:GRIS}}>{extra}</span>}</button>)}</div>;

// ── Desplegable del sistema: buscable, con teclado, nunca el <select> del navegador ────────
export function Desplegable({value,onChange,opciones,placeholder="Elegir…",buscar=true,vacio="Sin resultados",disabled,style}){
  const [abierto,setAbierto]=useState(false);const [q,setQ]=useState("");const [idx,setIdx]=useState(0);const ref=useRef(null);const inRef=useRef(null);
  const sel=opciones.find(o=>String(o.v)===String(value));
  const lista=q.trim()?opciones.filter(o=>`${o.l} ${o.sub||""}`.toLowerCase().includes(q.toLowerCase())):opciones;
  useEffect(()=>{if(!abierto)return;const cerrar=(e)=>{if(ref.current&&!ref.current.contains(e.target))setAbierto(false);};document.addEventListener("mousedown",cerrar);return()=>document.removeEventListener("mousedown",cerrar);},[abierto]);
  useEffect(()=>{if(abierto){setQ("");setIdx(0);setTimeout(()=>inRef.current?.focus(),0);}},[abierto]);
  const elegir=(o)=>{onChange(o?o.v:"");setAbierto(false);};
  const tecla=(e)=>{if(e.key==="ArrowDown"){e.preventDefault();setIdx(i=>Math.min(lista.length-1,i+1));}else if(e.key==="ArrowUp"){e.preventDefault();setIdx(i=>Math.max(0,i-1));}else if(e.key==="Enter"){e.preventDefault();if(lista[idx])elegir(lista[idx]);}else if(e.key==="Escape")setAbierto(false);};
  return <div ref={ref} style={{position:"relative",...(style||{})}}>
    <button type="button" disabled={disabled} onClick={()=>setAbierto(v=>!v)} style={{...INP,display:"flex",alignItems:"center",gap:8,textAlign:"left",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,borderColor:abierto?LIMA:BORDE}}>
      <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:sel?INK:GRIS,fontWeight:sel?600:500}}>{sel?sel.l:placeholder}</span>
      {sel&&!disabled&&<span onClick={(e)=>{e.stopPropagation();elegir(null);}} title="Quitar" style={{color:GRIS,fontSize:12,padding:"0 4px"}}>✕</span>}
      <Ico d={["M6 9l6 6 6-6"]} size={15} color="var(--mq-gris)"/>
    </button>
    {abierto&&<div style={{position:"absolute",left:0,right:0,top:"100%",zIndex:30,marginTop:6,background:CARD,border:`1px solid ${BORDE}`,borderRadius:14,boxShadow:"0 14px 40px rgba(0,0,0,0.25)",overflow:"hidden"}}>
      {buscar&&<div style={{padding:8,borderBottom:`1px solid ${BORDE}`}}><input ref={inRef} value={q} onChange={e=>{setQ(e.target.value);setIdx(0);}} onKeyDown={tecla} placeholder="Buscar…" style={{...INP,padding:"9px 11px",borderRadius:9}}/></div>}
      <div style={{maxHeight:260,overflowY:"auto"}}>
        {lista.length===0&&<p style={{margin:0,padding:"12px 14px",fontSize:13,color:GRIS}}>{vacio}</p>}
        {lista.map((o,i)=><button key={String(o.v)} type="button" onClick={()=>elegir(o)} onMouseEnter={()=>setIdx(i)} style={{display:"flex",gap:10,alignItems:"center",width:"100%",textAlign:"left",padding:"10px 14px",border:"none",background:i===idx?SUAVE:"transparent",color:INK,cursor:"pointer",fontSize:13.5}}>
          <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:String(o.v)===String(value)?800:600}}>{o.l}</span>
          {o.sub&&<span style={{fontFamily:MONO,fontSize:11,color:GRIS,whiteSpace:"nowrap"}}>{o.sub}</span>}
        </button>)}
      </div>
    </div>}
  </div>;
}
// Fecha: el DatePicker del proyecto (nunca el calendario del navegador).
export const Fecha=({value,onChange,small})=><div className="mq-fecha"><DatePicker value={value||""} onChange={onChange} small={small}/></div>;
// Archivo: botón propio + arrastrar + pegar. `onFiles(File[])`.
export function Archivo({onFiles,accept="image/*,application/pdf",multiple=false,label="Adjuntar",hint="Arrastrá, pegá con Ctrl+V o elegí",pegar=true,style}){
  const ref=useRef(null);const [sobre,setSobre]=useState(false);
  useEffect(()=>{if(!pegar)return;const h=(e)=>{const fs=Array.from(e.clipboardData?.files||[]);if(fs.length){e.preventDefault();onFiles(multiple?fs:[fs[0]]);}};window.addEventListener("paste",h);return()=>window.removeEventListener("paste",h);},[onFiles,multiple,pegar]);
  return <div onDragOver={e=>{e.preventDefault();setSobre(true);}} onDragLeave={()=>setSobre(false)} onDrop={e=>{e.preventDefault();setSobre(false);const fs=Array.from(e.dataTransfer?.files||[]);if(fs.length)onFiles(multiple?fs:[fs[0]]);}} onClick={()=>ref.current?.click()} style={{border:`1px dashed ${sobre?LIMA:BORDE}`,background:sobre?LIMA_SUAVE:SUAVE,borderRadius:12,padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,...(style||{})}}>
    <span style={{padding:"6px 12px",borderRadius:999,background:CARD,border:`1px solid ${BORDE}`,fontSize:12.5,fontWeight:700}}>{label}</span><span style={{fontSize:12.5,color:GRIS}}>{hint}</span>
    <input ref={ref} type="file" accept={accept} multiple={multiple} hidden onChange={e=>{const fs=Array.from(e.target.files||[]);if(fs.length)onFiles(fs);e.target.value="";}}/>
  </div>;
}
export const Toggle=({on,onChange,l,sub})=><button type="button" onClick={()=>onChange(!on)} style={{display:"flex",alignItems:"center",gap:12,width:"100%",textAlign:"left",padding:"10px 0",border:"none",borderTop:`1px solid ${BORDE}`,background:"transparent",color:INK,cursor:"pointer"}}><span style={{width:38,height:22,borderRadius:11,background:on?LIMA:BORDE,position:"relative",flexShrink:0,transition:"background 120ms"}}><span style={{position:"absolute",top:3,left:on?19:3,width:16,height:16,borderRadius:"50%",background:on?"var(--mq-lima-ink)":CARD,transition:"left 120ms"}}/></span><span><span style={{display:"block",fontSize:14,fontWeight:700}}>{l}</span>{sub&&<span style={{display:"block",fontSize:12.5,color:GRIS}}>{sub}</span>}</span></button>;

export const n=(v,d=0)=>{const x=Number(String(v??"").replace(",","."));return Number.isFinite(x)?x:d;};
export const numONull=(v)=>String(v??"").trim()===""?null:n(v);
export const txtONull=(v)=>String(v??"").trim()===""?null:String(v).trim();
export const fmtUsd=(v)=>`USD ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const fmtMon=(v,m="USD")=>`${m} ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const fmtNum=(v,d=2)=>Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:d,maximumFractionDigits:d});
export const fmtK=(v)=>{const x=Number(v||0);return Math.abs(x)>=1000?`${(x/1000).toFixed(1).replace(".",",")}k`:fmtNum(x,0);};
export const fmtFecha=(d)=>{if(!d)return "—";const x=new Date(String(d).length===10?d+"T12:00:00":d);return x.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit"});};
export const hoyISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
export const codigoMaq=(p)=>`MAQ-${String(p.numero||0).padStart(5,"0")}`;
export const codigoOp=(p)=>`AM-${String(p.numero||0).padStart(5,"0")}`;
export const codigoPed=codigoOp;
export const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export const MESES_C=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export const ESTADO_MAQ={borrador:{l:"Borrador",c:GRIS,bg:SUAVE},publicado:{l:"Publicado",c:OK,bg:OK_BG},pausado:{l:"Pausado",c:WARN,bg:WARN_BG}};
export const ChipMaq=({e})=>{const s=ESTADO_MAQ[e]||ESTADO_MAQ.borrador;return <Chip {...s}/>;};
export const ESTADOS_PEDIDO=[
  {k:"nuevo",l:"Nueva",c:GRIS,bg:SUAVE},
  {k:"pagado",l:"Pagada",c:OK,bg:OK_BG},
  {k:"en_produccion",l:"En producción",c:WARN,bg:WARN_BG},
  {k:"prueba_fabrica",l:"Prueba en fábrica",c:WARN,bg:WARN_BG},
  {k:"listo_fabrica",l:"Lista en fábrica",c:OK,bg:OK_BG},
  {k:"en_importacion",l:"En importación",c:"#8AB4FF",bg:"#1C2A44"},
  {k:"entregado",l:"Entregada",c:OK,bg:OK_BG},
  {k:"cancelado",l:"Cancelada",c:BAD,bg:BAD_BG},
];
export const ACTIVOS=["nuevo","pagado","en_produccion","prueba_fabrica","listo_fabrica","en_importacion"];
export const estadoPed=(k)=>ESTADOS_PEDIDO.find(e=>e.k===k)||ESTADOS_PEDIDO[0];
export const ChipPed=({e})=>{const s=estadoPed(e);return <Chip {...s}/>;};
export const CATEG_MOV={cobro_cliente:"Cobro del cliente",pago_fabrica:"Pago a fábrica",prueba_fabrica:"Prueba en fábrica",argencargo:"Pago a Argencargo",gasto:"Gasto",otro:"Otro"};
export const nombreCliente=(c)=>c?(c.company_name||`${c.first_name||""} ${c.last_name||""}`.trim()||c.email||"—"):"—";
