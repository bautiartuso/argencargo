"use client";
// Piezas visuales del panel de máquinas. Los colores son variables CSS para que el tema
// claro/oscuro (Ajustes) cambie todo de una.

export const FONT="'Manrope',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif";
export const MONO="'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
export const INK="var(--mq-ink)", GRIS="var(--mq-gris)", BORDE="var(--mq-borde)", SUAVE="var(--mq-suave)", CARD="var(--mq-card)", BG="var(--mq-bg)";
export const LIMA="var(--mq-lima)", LIMA_SUAVE="var(--mq-lima-suave)";
export const OK="var(--mq-ok)", OK_BG="var(--mq-ok-bg)", WARN="var(--mq-warn)", WARN_BG="var(--mq-warn-bg)", BAD="var(--mq-bad)", BAD_BG="var(--mq-bad-bg)";
export const ANCHO_MENU=248;

export const CSS=`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
.mq{--mq-bg:#FFFFFF;--mq-card:#FFFFFF;--mq-ink:#121212;--mq-gris:#6B6B6B;--mq-borde:#E6E6E3;--mq-suave:#F5F5F2;--mq-lima:#D3F462;--mq-lima-suave:#EEFBC0;--mq-ok:#1F7A2E;--mq-ok-bg:#E3F6E6;--mq-warn:#8A5B00;--mq-warn-bg:#FFF1CC;--mq-bad:#B42323;--mq-bad-bg:#FDECEC;--mq-lima-ink:#121212}
.mq[data-tema="oscuro"]{--mq-bg:#0E0E0E;--mq-card:#161616;--mq-ink:#F2F2F0;--mq-gris:#9C9C98;--mq-borde:#2A2A28;--mq-suave:#1E1E1C;--mq-lima:#CFF25A;--mq-lima-suave:#2C3612;--mq-ok:#7BD88F;--mq-ok-bg:#16301B;--mq-warn:#E9C46A;--mq-warn-bg:#3A2E0E;--mq-bad:#F28B8B;--mq-bad-bg:#3A1616}
.mq *{box-sizing:border-box}.mq input,.mq select,.mq textarea,.mq button{font-family:${FONT}}
.mq input:focus,.mq select:focus,.mq textarea:focus{border-color:var(--mq-ink)!important;box-shadow:0 0 0 3px var(--mq-lima-suave);outline:none}
.mq ::placeholder{color:var(--mq-gris);opacity:0.7}.mq .card:hover{border-color:var(--mq-gris);box-shadow:0 6px 24px rgba(0,0,0,0.06)}
.mq .btn:hover{filter:brightness(0.97)}.mq .ghost:hover{background:var(--mq-suave)}.mq .navi:hover{background:var(--mq-suave)}.mq .fila:hover{background:var(--mq-suave)}
.mq input[type=number]{-moz-appearance:textfield}.mq input::-webkit-outer-spin-button,.mq input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.mq .side{width:${ANCHO_MENU}px;border-right:1px solid var(--mq-borde);background:var(--mq-card);position:fixed;left:0;top:0;bottom:0;overflow-y:auto;display:flex;flex-direction:column;z-index:20}
.mq .cont{margin-left:${ANCHO_MENU}px;min-height:100vh}
.mq .topmovil{display:none}
@media(max-width:900px){.mq .side{transform:translateX(-100%);transition:transform 160ms;box-shadow:0 0 40px rgba(0,0,0,0.12)}.mq .side.open{transform:none}.mq .cont{margin-left:0}.mq .topmovil{display:flex}.mq .velo{position:fixed;inset:0;background:rgba(0,0,0,0.25);z-index:19}}
@media(max-width:640px){.mq .grid3{grid-template-columns:1fr!important}.mq .grid3>*{grid-column:auto!important}.mq .cont main{padding:16px 14px 90px!important}}`;

export const INP={width:"100%",padding:"11px 13px",borderRadius:11,border:`1px solid ${BORDE}`,background:CARD,color:INK,fontSize:14,fontWeight:600,outline:"none",transition:"border-color 120ms, box-shadow 120ms"};
export const LBL={display:"block",fontFamily:MONO,fontSize:11,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:GRIS,marginBottom:7};
export const TH={...LBL,display:"table-cell",textAlign:"left",padding:"10px 12px",marginBottom:0,whiteSpace:"nowrap",background:SUAVE};
export const TD={padding:"11px 12px",borderTop:`1px solid ${BORDE}`,verticalAlign:"middle"};
export const GRID={display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14};

export function Campo({label,ob,hint,children,span}){return <div style={{gridColumn:span?`span ${span}`:undefined,minWidth:0}}><label style={LBL}>{label}{ob&&<span style={{color:INK,marginLeft:3}}>*</span>}</label>{children}{hint&&<p style={{fontSize:12,color:GRIS,margin:"6px 0 0",lineHeight:1.4}}>{hint}</p>}</div>;}
export const Inp=({style,...p})=><input {...p} style={{...INP,...(style||{})}}/>;
export const TA=({style,...p})=><textarea {...p} style={{...INP,minHeight:96,resize:"vertical",lineHeight:1.5,fontWeight:500,...(style||{})}}/>;
export const Sel=({children,style,...p})=><select {...p} style={{...INP,appearance:"auto",...(style||{})}}>{children}</select>;
export function Btn({children,onClick,kind="ghost",disabled,small,title,type="button",style}){
  const base={padding:small?"7px 13px":"11px 18px",borderRadius:999,fontSize:small?12.5:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,border:`1px solid ${BORDE}`,background:CARD,color:INK,transition:"all 120ms",whiteSpace:"nowrap"};
  const k=kind==="lima"?{background:LIMA,borderColor:LIMA,color:"var(--mq-lima-ink)"}:kind==="negro"?{background:INK,borderColor:INK,color:BG}:kind==="danger"?{color:BAD,borderColor:BAD_BG}:{};
  return <button type={type} title={title} disabled={disabled} onClick={onClick} className={kind==="ghost"?"ghost":"btn"} style={{...base,...k,...(style||{})}}>{children}</button>;
}
export function Sec({titulo,children,onDrop,onDragOver,extra,style}){return <section onDrop={onDrop} onDragOver={onDragOver} style={{background:CARD,border:`1px solid ${BORDE}`,borderRadius:18,padding:"22px 22px 24px",marginBottom:14,...(style||{})}}>{(titulo||extra)&&<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}><h3 style={{margin:0,fontSize:17,fontWeight:800,letterSpacing:"-0.01em",flex:1}}>{titulo}</h3>{extra}</div>}{children}</section>;}
export const Pill=({on,children,onClick})=><button type="button" onClick={onClick} style={{padding:"8px 14px",borderRadius:999,border:`1px solid ${on?LIMA:BORDE}`,background:on?LIMA_SUAVE:CARD,color:INK,fontSize:13,fontWeight:700,cursor:"pointer"}}>{children}</button>;
export const Chip=({l,c,bg})=><span style={{fontFamily:MONO,fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:6,background:bg,color:c,letterSpacing:"0.08em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{l}</span>;
export const Ico=({d,size=17,color="currentColor"})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>{d.map((x,i)=><path key={i} d={x}/>)}</svg>;
export const Barra=({children})=><div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8,marginBottom:18}}>{children}</div>;
export const Vacio=({children})=><div style={{border:`1px dashed ${BORDE}`,borderRadius:18,padding:"60px 20px",textAlign:"center",color:GRIS,fontSize:14}}>{children||<span style={{fontFamily:MONO,fontSize:11,letterSpacing:"0.12em",padding:"6px 12px",borderRadius:8,background:SUAVE}}>PRÓXIMAMENTE</span>}</div>;
export function Dato({l,v,sub,color}){return <div style={{background:CARD,border:`1px solid ${BORDE}`,borderRadius:16,padding:"14px 16px",minWidth:0}}><p style={{...LBL,marginBottom:4}}>{l}</p><p style={{margin:0,fontSize:22,fontWeight:800,letterSpacing:"-0.02em",color:color||INK,fontVariantNumeric:"tabular-nums",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</p>{sub&&<p style={{margin:"3px 0 0",fontSize:12,color:GRIS}}>{sub}</p>}</div>;}

export const n=(v,d=0)=>{const x=Number(String(v??"").replace(",","."));return Number.isFinite(x)?x:d;};
export const numONull=(v)=>String(v??"").trim()===""?null:n(v);
export const txtONull=(v)=>String(v??"").trim()===""?null:String(v).trim();
export const fmtUsd=(v)=>`USD ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const fmtNum=(v,d=2)=>Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:d,maximumFractionDigits:d});
export const fmtFecha=(d)=>{if(!d)return "—";const x=new Date(d.length===10?d+"T12:00:00":d);return x.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit"});};
export const hoyISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
export const codigoMaq=(p)=>`MAQ-${String(p.numero||0).padStart(5,"0")}`;
export const codigoPed=(p)=>`PED-${String(p.numero||0).padStart(5,"0")}`;

export const ESTADO_MAQ={borrador:{l:"Borrador",c:GRIS,bg:SUAVE},publicado:{l:"Publicado",c:OK,bg:OK_BG},pausado:{l:"Pausado",c:WARN,bg:WARN_BG}};
export const ChipMaq=({e})=>{const s=ESTADO_MAQ[e]||ESTADO_MAQ.borrador;return <Chip {...s}/>;};

// Estados del pedido en el orden real de la vida de una máquina.
export const ESTADOS_PEDIDO=[
  {k:"nuevo",l:"Nuevo",c:GRIS,bg:SUAVE},
  {k:"pagado",l:"Pagado",c:OK,bg:OK_BG},
  {k:"en_produccion",l:"En producción",c:WARN,bg:WARN_BG},
  {k:"prueba_fabrica",l:"Prueba en fábrica",c:WARN,bg:WARN_BG},
  {k:"listo_fabrica",l:"Listo en fábrica",c:OK,bg:OK_BG},
  {k:"en_importacion",l:"En importación",c:"#1D4ED8",bg:"#DBE7FF"},
  {k:"entregado",l:"Entregado",c:OK,bg:OK_BG},
  {k:"cancelado",l:"Cancelado",c:BAD,bg:BAD_BG},
];
export const estadoPed=(k)=>ESTADOS_PEDIDO.find(e=>e.k===k)||ESTADOS_PEDIDO[0];
export const ChipPed=({e})=>{const s=estadoPed(e);return <Chip {...s}/>;};
export const CATEG_MOV={cobro_cliente:"Cobro del cliente",pago_fabrica:"Pago a fábrica",prueba_fabrica:"Prueba en fábrica",argencargo:"Pago a Argencargo",gasto:"Gasto",otro:"Otro"};
