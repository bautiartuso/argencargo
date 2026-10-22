"use client";
import { useState } from "react";
import { useT } from "../../../lib/i18n-portal";
import { navieraDe } from "../../../lib/navieras";

// Cargas marítimas que todavía no son operación (28/09/2026, rediseño 29/09): tarjetas flotantes
// dentro de "En curso", sin número de operación. Paleta de la marca (navy, blanco y dorado): nada
// de verdes ni rojos. Cerrada: foto, mercadería, contenedor (solo Luna 1), arribo, bultos y el
// total al pie. "Ver detalle" desglosa cada pedido con sus fotos, tracking y medidas.
// En depósito nunca se dice "depósito": la carga "ya fue cargada y ya salió de China".
export default function MaritimeCargoCards({cargo,cargando=false}){
  const {t,lang}=useT();
  const [abiertas,setAbiertas]=useState(()=>new Set());
  const [foto,setFoto]=useState(null); // {fotos:[{u,k}],i}
  const [copiado,setCopiado]=useState(null);
  // Mientras la API responde (sin caché todavía), un esqueleto del mismo tamaño: la tarjeta aparece
  // "ya puesta" en vez de saltar un segundo después (21/10/2026).
  if((!cargo||cargo.length===0)&&cargando)return <div style={{marginBottom:16,borderRadius:20,border:"1px solid rgba(255,255,255,0.1)",background:"linear-gradient(160deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))",padding:"18px 20px"}}>
    <style>{`@keyframes mcSk{0%{opacity:.45}50%{opacity:.9}100%{opacity:.45}}.mc-sk{background:rgba(255,255,255,0.08);border-radius:10px;animation:mcSk 1.3s ease-in-out infinite}`}</style>
    <div style={{display:"flex",gap:16,alignItems:"center"}}><div className="mc-sk" style={{width:76,height:76,borderRadius:16}}/><div style={{flex:1}}><div className="mc-sk" style={{width:160,height:12,marginBottom:10}}/><div className="mc-sk" style={{width:"70%",height:18}}/></div></div>
    <div className="mc-sk" style={{height:92,marginTop:16,borderRadius:14}}/>
    <div className="mc-sk" style={{height:64,marginTop:12,borderRadius:14}}/>
  </div>;
  if(!cargo||cargo.length===0)return null;
  const ORO="#E8D098";const TX="#fff";const SUB="rgba(255,255,255,0.62)";const LINEA="rgba(255,255,255,0.1)";
  const loc=lang==="zh"?"zh-CN":lang==="en"?"en-US":lang==="ru"?"ru-RU":"es-AR";
  const fD=(d)=>d?new Date(d+"T12:00:00").toLocaleDateString(loc,{day:"2-digit",month:"2-digit",year:"numeric"}):null;
  const usd=(v)=>`USD ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const m3=(v)=>`${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:3,maximumFractionDigits:3})} m³`;
  const copiar=async(txt)=>{try{await navigator.clipboard.writeText(txt);setCopiado(txt);setTimeout(()=>setCopiado(null),1600);}catch{}};
  // La foto del bulto va primero (pedido de Bautista, 21/10/2026): es la que importa para reconocer la carga.
  const fotosDe=(c)=>[...(c.fotos||[]).map(u=>({u,k:t("mar2.photoPkg")})),...(c.fotos_merc||[]).map(u=>({u,k:t("mar2.photoGoods")}))];
  const fDc=(d)=>d?new Date(d+"T12:00:00").toLocaleDateString(loc,{day:"2-digit",month:"short"}):null;
  const DIA=86400000;
  // Ruta del viaje (21/10/2026): cinco etapas con fechas reales. En viaje, la barra avanza con
  // zarpe → ETA y dice cuántos días faltan.
  const rutaDe=(g,dep,usa,cargando,cargas)=>{
    const hoy=new Date();hoy.setHours(12,0,0,0);
    const llegadas=cargas.map(c=>c.llego).filter(Boolean).sort();
    const recibida=llegadas.length?llegadas[llegadas.length-1]:null;
    const zarpo=g.zarpo||null,eta=g.eta_puerto||null,entrega=g.entrega_estimada||null,puerto=!dep&&g.en_puerto?g.en_puerto:null;
    const dEta=eta?Math.ceil((new Date(eta+"T12:00:00")-hoy)/DIA):null;
    let pct=null;
    if(!dep&&zarpo&&eta){const a=new Date(zarpo+"T12:00:00"),b=new Date(eta+"T12:00:00");pct=b>a?Math.max(0,Math.min(1,(hoy-a)/(b-a))):null;}
    if(puerto)pct=1;
    const llegada=!!puerto||(!dep&&dEta!=null&&dEta<=0);
    const st=(i,cur)=>i<cur?"done":i===cur?"current":"todo";
    let cur=dep?(cargando||usa?1:2):(llegada?3:2);
    const faltan=dEta==null?null:dEta<=0?t("mar2.arrivingNow"):dEta===1?t("mar2.daysLeft1"):t("mar2.daysLeft",{dias:dEta});
    const totalDias=zarpo&&eta?Math.max(1,Math.round((new Date(eta+"T12:00:00")-new Date(zarpo+"T12:00:00"))/DIA)):null;
    const diaX=totalDias&&zarpo?Math.max(1,Math.min(totalDias,Math.round((hoy-new Date(zarpo+"T12:00:00"))/DIA)+1)):null;
    // Solo fechas reales: nada de "se actualiza en estos días" en la ruta (pedido 21/10/2026).
    const pasos=[
      {l:t("mar2.stReceived"),s:null},
      {l:dep&&usa?t("mar2.stConsolidating"):dep&&cargando?t("mar2.stLoading"):t("mar2.stLoaded"),s:null}, // sin la fecha de zarpe (pedido 21/10/2026)
      {l:t("mar2.stSea"),s:puerto?null:!dep?(pct!=null?`${t("mar2.tripPct",{pct:Math.round(pct*100)})}${faltan?` · ${faltan}`:""}`:faltan):null},
      puerto?{l:t("mar2.stCustoms"),s:t("mar2.arrivedOn",{fecha:fDc(puerto)})}:{l:t("mar2.stPort"),s:eta?fDc(eta):null},
      {l:t("mar2.stDeliver"),s:entrega?fDc(entrega):null},
    ].map((x,i)=>({...x,st:st(i,cur)}));
    const siguiente=dep?t("mar2.nextLoading"):puerto?t("mar2.nextCustoms"):llegada?t("mar2.nextPort"):eta?t("mar2.nextSea",{fecha:fD(eta)}):null;
    const navegacion=!dep&&!llegada&&diaX&&totalDias?t("mar2.dayOf",{x:diaX,y:totalDias}):null;
    return {pasos,pct,cur,siguiente,navegacion,recibida,aduana:!!puerto};
  };
  const Ruta=({r})=>{
    const n=r.pasos.length;
    // Avance de cada tramo (i → i+1): lleno si ya se pasó, parcial en el tramo actual.
    const tramo=(i)=>i<r.cur?1:i===r.cur?(r.pct!=null?r.pct:0.5):0;
    const Seg=({v,lado})=><span className="mc-tramo" style={{visibility:lado==="l"&&v==null?"hidden":"visible"}}><span style={{display:"block",height:"100%",width:`${Math.round((v||0)*100)}%`,"--h":`${Math.round((v||0)*100)}%`,background:ORO,borderRadius:999,marginLeft:lado==="l"?"auto":0,transition:"width .4s"}}/></span>;
    return <div className="mc-ruta">
      {r.pasos.map((p,i)=>{const done=p.st==="done",cur=p.st==="current";
        // Mitad izquierda = segunda mitad del tramo anterior; mitad derecha = primera mitad del tramo propio.
        const izq=i===0?null:Math.max(0,Math.min(1,(tramo(i-1)-0.5)*2));
        const der=i===n-1?null:Math.max(0,Math.min(1,tramo(i)*2));
        return <div key={i} className="mc-paso" style={{opacity:p.st==="todo"?0.55:1}}>
          <div className="mc-paso-linea">
            {i===0?<span className="mc-tramo" style={{visibility:"hidden"}}/>:<span className="mc-tramo"><span style={{display:"block",height:"100%",width:`${Math.round(izq*100)}%`,"--h":`${Math.round(izq*100)}%`,background:ORO,borderRadius:999,transition:"width .4s"}}/></span>}
            <span className="mc-nodo" style={{background:done?ORO:cur?"rgba(232,208,152,0.18)":"rgba(255,255,255,0.08)",border:`2px solid ${done||cur?ORO:"rgba(255,255,255,0.25)"}`,color:done?"#0A1628":ORO,boxShadow:cur?"0 0 0 5px rgba(232,208,152,0.14)":"none"}}>{done?<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>:cur?<span style={{width:8,height:8,borderRadius:999,background:ORO,display:"block"}}/>:null}</span>
            {i===n-1?<span className="mc-tramo" style={{visibility:"hidden"}}/>:<span className="mc-tramo"><span style={{display:"block",height:"100%",width:`${Math.round(der*100)}%`,"--h":`${Math.round(der*100)}%`,background:ORO,borderRadius:999,transition:"width .4s"}}/></span>}
          </div>
          <p className="mc-paso-l" style={{color:cur?ORO:TX,fontWeight:cur?800:700}}>{p.l}</p>
          {p.s&&<p className="mc-paso-s" style={{color:cur?TX:SUB}}>{p.s}</p>}
        </div>;})}
    </div>;
  };
  const lbl={margin:0,fontSize:10,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:SUB};
  const celda=(l,v,extra)=><div className="mc-celda" style={extra}><p style={lbl}>{l}</p><div style={{marginTop:5,fontSize:15,fontWeight:800,color:TX,fontVariantNumeric:"tabular-nums"}}>{v}</div></div>;
  return <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:16}}>
    <style>{`.mc-card{transition:box-shadow .2s ease,border-color .2s ease}.mc-card:hover{border-color:rgba(232,208,152,0.35)!important;box-shadow:0 20px 44px rgba(0,0,0,0.38)}.mc-strip{display:flex;flex-wrap:wrap}.mc-celda{flex:1 1 150px;padding:12px 16px;border-left:1px solid ${LINEA}}.mc-celda:first-child{border-left:none}.mc-det{display:grid;grid-template-columns:220px minmax(0,1fr);gap:22px}.mc-fila{display:grid;grid-template-columns:130px minmax(0,1fr);gap:12px;padding:10px 0;border-top:1px solid ${LINEA}}.mc-fila:first-child{border-top:none}.mc-ruta{display:flex;margin:0 20px 14px;padding:16px 10px 12px;border-radius:14px;border:1px solid ${LINEA};background:rgba(0,0,0,0.16)}.mc-paso{flex:1 1 0;min-width:0;text-align:center}.mc-paso-linea{display:flex;align-items:center;margin-bottom:9px}.mc-nodo{width:26px;height:26px;flex-shrink:0;border-radius:999px;display:flex;align-items:center;justify-content:center;margin:0 4px}.mc-tramo{flex:1;height:3px;border-radius:999px;background:rgba(255,255,255,0.1);overflow:hidden}.mc-paso-l{margin:0 6px;font-size:12.5px;line-height:1.25}.mc-paso-s{margin:3px 6px 0;font-size:11.5px;line-height:1.3}@media(max-width:700px){.mc-ruta{flex-direction:column;gap:0;padding:14px 16px}.mc-paso{display:grid;grid-template-columns:26px minmax(0,1fr);column-gap:12px;padding:0;text-align:left}.mc-paso-linea{flex-direction:column;align-items:center;gap:0;margin:0;grid-row:1/span 2;align-self:stretch}.mc-nodo{margin:0}.mc-tramo{width:3px;height:auto;flex:1;min-height:9px}.mc-tramo>span{width:100%!important;height:var(--h,0%);margin-left:0!important}.mc-paso-l{padding-top:4px;margin:0}.mc-paso-s{padding-bottom:12px;margin:3px 0 0}.mc-galeria{max-width:280px}.mc-celda{flex:1 1 45%;border-left:none;border-top:1px solid ${LINEA}}.mc-det{grid-template-columns:1fr}.mc-fila{grid-template-columns:1fr;gap:4px}.mc-pie{flex-direction:column;align-items:stretch!important}.mc-pie-total{text-align:left!important}}`}</style>
    {cargo.map(g=>{
      const abierta=abiertas.has(g.id);
      const toggle=()=>setAbiertas(p=>{const n=new Set(p);n.has(g.id)?n.delete(g.id):n.add(g.id);return n;});
      const dep=g.etapa==="deposito";
      // Estados Unidos (07/10/2026): en depósito la carga espera consolidar (no "salió"); recién en
      // el contenedor se dice que salió de Estados Unidos. China mantiene el mensaje de siempre.
      const usa=g.origen==="usa";
      const cargas=Array.isArray(g.cargas)?g.cargas:[];
      // China, en depósito hace menos de 20 días (13/10/2026): todavía "se está cargando en un
      // contenedor"; recién después pasa a "ya fue cargada y ya salió de China".
      const llegadas=cargas.map(c=>c.llego).filter(Boolean).sort();
      const diasDep=llegadas.length?Math.floor((Date.now()-new Date(llegadas[llegadas.length-1]).getTime())/86400000):999;
      const cargando=dep&&!usa&&diasDep<20;
      const msg=usa?(dep?[t("mar2.usaDepotTitle"),t("mar2.usaDepotMsg")]:[t("mar2.usaShippedTitle"),null]):(dep?(cargando?[t("mar2.loadingTitle"),t("mar2.loadingMsg")]:[t("mar2.depotTitle"),t("mar2.depotMsg")]):null);
      const todas=cargas.flatMap(fotosDe);
      const portada=todas[0];
      const descs=cargas.map(c=>c.descripcion).filter(Boolean);
      const titulo=descs.length>1?descs.join(" · "):(descs[0]||t("mar2.seaCargo"));
      // Naviera (21/10/2026): logo real y la tarjeta con el color de la naviera.
      const nav=!dep?navieraDe(g.naviera):null;const nc=nav?.c||null;
      const logoNav=(h)=>!nav?null:nav.sq?<img src={nav.logo} alt={nav.n} style={{width:h,height:h,borderRadius:h*0.24,objectFit:"cover",display:"block",flexShrink:0}}/>:<span style={{width:h*2.1,height:h,borderRadius:h*0.24,background:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:`0 ${Math.round(h*0.18)}px`,boxSizing:"border-box",flexShrink:0}}><img src={nav.logo} alt={nav.n} style={{maxWidth:"100%",maxHeight:h*0.62,objectFit:"contain",display:"block"}}/></span>;
      return <div key={g.id} className="mc-card" style={{borderRadius:20,border:`1px solid ${nc?nc+"8c":"rgba(255,255,255,0.12)"}`,borderTop:nc?`4px solid ${nc}`:undefined,background:nc?`linear-gradient(160deg,${nc}55 0%,${nc}1f 38%,${nc}08 70%,rgba(255,255,255,0.02) 100%)`:"linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))",boxShadow:"0 14px 34px rgba(0,0,0,0.3)",overflow:"hidden"}}>
        {/* Encabezado */}
        <div onClick={toggle} style={{display:"flex",gap:16,alignItems:"center",padding:"18px 20px",cursor:"pointer"}}>
          <div onClick={e=>{if(portada){e.stopPropagation();setFoto({fotos:todas,i:0});}}} style={{width:76,height:76,flexShrink:0,borderRadius:16,overflow:"hidden",background:portada?`url(${portada.u}) center/cover`:nav&&!nav.sq?"#fff":"rgba(255,255,255,0.06)",border:`1px solid ${nc&&!portada?nc+"aa":"rgba(255,255,255,0.14)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,cursor:portada?"zoom-in":"pointer"}}>{portada?"":nav?(nav.sq?<img src={nav.logo} alt={nav.n} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>:<img src={nav.logo} alt={nav.n} style={{maxWidth:"84%",maxHeight:"60%",objectFit:"contain",display:"block"}}/>):"🚢"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:10.5,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:ORO}}>{t("mar2.eyebrow")}</span>
              <span style={{fontSize:10.5,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",padding:"3px 10px",borderRadius:999,color:TX,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.16)"}}>{dep&&usa?`● ${t("mar2.stageDepotUsa")}`:dep?`● ${t(cargando?"mar2.stageLoading":"mar2.stageShipped")}`:g.en_puerto?`🛃 ${t("mar2.stageCustoms")}`:`🚢 ${t("mar2.stageSea")}`}</span>
            </div>
            <p style={{margin:"7px 0 0",fontSize:17,fontWeight:800,color:TX,lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{titulo}</p>
          </div>
          <span style={{width:36,height:36,flexShrink:0,borderRadius:999,border:"1px solid rgba(255,255,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",color:TX,transform:abierta?"rotate(180deg)":"none",transition:"transform .2s"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
        </div>

        {/* Resumen: pedidos, productos, unidades, fotos */}
        {(()=>{const prods=cargas.flatMap(c=>c.productos||[]);const unidades=prods.reduce((a,p)=>a+(Number(p.q)||0),0);const nombres=new Set(prods.map(p=>String(p.d||"").trim().toLowerCase()).filter(Boolean));const chips=[cargas.length===1?t("mar2.order1"):t("mar2.ordersN",{n:cargas.length}),nombres.size?t("mar2.productsN",{n:nombres.size}):null,unidades?t("mar2.unitsN",{n:unidades.toLocaleString(loc)}):null,todas.length?t("mar2.photosN",{n:todas.length}):null].filter(Boolean);
          return <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"-6px 20px 14px"}}>{chips.map(c=><span key={c} style={{fontSize:11.5,fontWeight:700,padding:"4px 10px",borderRadius:999,background:"rgba(255,255,255,0.06)",border:`1px solid ${LINEA}`,color:"rgba(255,255,255,0.8)"}}>{c}</span>)}</div>;})()}

        {/* Ruta del viaje */}
        {(()=>{const r=rutaDe(g,dep,usa,cargando,cargas);return <>
          <Ruta r={r}/>
          <div style={{margin:"0 20px 14px",padding:"13px 16px",borderRadius:14,background:"rgba(232,208,152,0.07)",border:"1px solid rgba(232,208,152,0.28)"}}>
            <p style={{margin:0,fontSize:14,fontWeight:800,color:TX}}>{msg?msg[0]:r.aduana?t("mar2.stageCustoms"):r.navegacion||t("mar2.stageSea")}</p>
            {r.siguiente&&<p style={{margin:"4px 0 0",fontSize:13,color:SUB,lineHeight:1.5}}><span style={{color:ORO,fontWeight:800}}>{t("mar2.nextStep")}:</span> {r.siguiente}</p>}
          </div>
        </>;})()}

        {/* Datos del viaje */}
        <div className="mc-strip" style={{margin:"0 20px",borderRadius:14,border:`1px solid ${LINEA}`,background:"rgba(0,0,0,0.16)",overflow:"hidden"}}>
          {nav&&celda(t("mar2.carrier"),<span style={{display:"inline-flex",alignItems:"center",gap:10}}>{logoNav(30)}<span>{nav.n}</span></span>,{flex:"1.2 1 180px"})}
          {g.contenedor&&celda(t("mar2.container"),<span style={{fontFamily:"'JetBrains Mono','SF Mono',monospace",fontSize:17,letterSpacing:"0.04em",color:ORO}}>{g.contenedor}</span>,{flex:"1.3 1 190px"})}
          {celda(t("mar2.origin"),usa?t("origin.usa"):t("origin.china"),{flex:"0.8 1 130px"})}
          {g.en_puerto&&!dep?celda(t("mar2.arrivalConfirmed"),fD(g.en_puerto)):celda(t("mar2.arrival"),dep||!g.eta_puerto?<span style={{fontSize:13.5,color:SUB,fontWeight:700}}>{t("mar2.etaSoon")}</span>:fD(g.eta_puerto))}
          {!dep&&celda(t("mar2.delivery"),fD(g.entrega_estimada)||<span style={{fontSize:13.5,color:SUB,fontWeight:700}}>{t("mar2.etaSoon")}</span>)}
          {/* En depósito (todavía sin contenedor) bultos, volumen y total se muestran recién cuando la
              carga sube al contenedor (pedido 02/10/2026). */}
          {celda(`${t("mar2.pkgs")} · ${t("mar2.volume")}`,dep?<span style={{fontSize:13.5,color:SUB,fontWeight:700}}>{t("mar2.etaSoon")}</span>:<>{g.bultos||0} <span style={{color:SUB,fontWeight:700}}>·</span> {m3(g.cbm)}</>)}
        </div>
        {g.transbordo&&!g.en_puerto&&<div style={{margin:"12px 20px 0",padding:"13px 16px",borderRadius:14,background:"linear-gradient(135deg,rgba(232,208,152,0.14),rgba(232,208,152,0.04))",border:"1px solid rgba(232,208,152,0.45)",display:"flex",gap:14,alignItems:"center"}}>
          <span style={{width:42,height:42,flexShrink:0,borderRadius:12,background:"rgba(232,208,152,0.16)",border:"1px solid rgba(232,208,152,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🔄</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:0,fontSize:14.5,fontWeight:800,color:ORO}}>{t("mar2.tsTitle",{lugar:g.transbordo.lugar})} <span style={{marginLeft:6,fontSize:12,fontWeight:800,padding:"2px 9px",borderRadius:999,background:"rgba(232,208,152,0.2)",color:ORO,whiteSpace:"nowrap"}}>{t("mar2.plusDays",{dias:g.transbordo.dias})}</span></p>
            <p style={{margin:"4px 0 0",fontSize:13,color:"rgba(255,255,255,0.8)",lineHeight:1.45}}>{t("mar2.tsMsg",{dias:g.transbordo.dias})}</p>
          </div>
        </div>}

        {/* Detalle desglosado por pedido */}
        {abierta&&<div style={{margin:"16px 20px 0",display:"flex",flexDirection:"column",gap:12}}>
          {cargas.map((c,ci)=>{const fts=fotosDe(c);return <div key={c.id} className="mc-det" style={{padding:16,borderRadius:16,background:"rgba(0,0,0,0.18)",border:`1px solid ${LINEA}`}}>
            <div className="mc-galeria">
              {fts.length?<>
                <div onClick={()=>setFoto({fotos:fts,i:0})} style={{position:"relative",width:"100%",aspectRatio:"1",borderRadius:14,background:`url(${fts[0].u}) center/cover`,border:"1px solid rgba(255,255,255,0.14)",cursor:"zoom-in"}}>
                  <span style={{position:"absolute",left:8,bottom:8,fontSize:10.5,fontWeight:800,padding:"3px 9px",borderRadius:999,background:"rgba(10,22,40,0.85)",color:TX}}>{fts[0].k}</span>
                </div>
                {fts.length>1&&<div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>{fts.slice(1).map((f,i)=><div key={f.u} onClick={()=>setFoto({fotos:fts,i:i+1})} title={f.k} style={{width:52,height:52,borderRadius:10,background:`url(${f.u}) center/cover`,border:"1px solid rgba(255,255,255,0.14)",cursor:"zoom-in"}}/>)}</div>}
              </>:<div style={{width:"100%",aspectRatio:"1",borderRadius:14,border:"1px dashed rgba(255,255,255,0.2)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,color:SUB,fontSize:12}}><span style={{fontSize:28}}>📦</span>{t("mar2.noPhoto")}</div>}
            </div>
            <div style={{minWidth:0}}>
              {(cargas.length>1||c.llego)&&<p style={{...lbl,color:ORO,marginBottom:6}}>{cargas.length>1?`${t("mar2.order")} ${ci+1}`:""}{cargas.length>1&&c.llego?" · ":""}{c.llego?<span style={{color:SUB}}>{t("mar2.receivedOn",{fecha:fD(c.llego)})}</span>:null}</p>}
              <div className="mc-fila"><p style={lbl}>{t("mar2.goods")}</p><div style={{fontSize:14.5,fontWeight:700,color:TX}}>{(()=>{
                // Mismo producto en varias líneas → una sola con la suma (pedido 21/10/2026).
                const m=new Map();(c.productos||[]).forEach(p=>{const k=String(p.d||"").trim();if(!k)return;const e=m.get(k.toLowerCase())||{d:k,q:0};e.q+=Number(p.q)||0;m.set(k.toLowerCase(),e);});
                const lista=[...m.values()];const unidades=lista.reduce((a,p)=>a+p.q,0);
                if(lista.length<=1)return <div>{lista[0]?.d||c.descripcion||t("mar2.seaCargo")}{lista[0]?.q?<span style={{color:SUB,fontWeight:600}}> × {lista[0].q}</span>:null}</div>;
                return <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:"6px 14px"}}>{lista.map((p,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"5px 0",borderBottom:`1px solid ${LINEA}`,fontSize:13.5}}><span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.d}</span><span style={{color:ORO,fontWeight:800,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>× {p.q}</span></div>)}</div>
                  <p style={{margin:"8px 0 0",fontSize:12,color:SUB,fontWeight:600}}>{t("mar2.summary",{p:lista.length,u:unidades.toLocaleString(loc)})}</p>
                </>;})()}</div></div>
              {c.tracking&&<div className="mc-fila"><p style={lbl}>{t("mar2.tracking")}</p><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span style={{fontSize:14.5,fontWeight:700,color:TX,fontFamily:"'JetBrains Mono','SF Mono',monospace",letterSpacing:"0.03em",wordBreak:"break-all"}}>{c.tracking}</span>
                <button onClick={()=>copiar(c.tracking)} style={{padding:"4px 11px",fontSize:11.5,fontWeight:700,borderRadius:8,border:"1px solid rgba(232,208,152,0.4)",background:"transparent",color:ORO,cursor:"pointer",fontFamily:"inherit"}}>{copiado===c.tracking?`✓ ${t("mar2.copied")}`:t("mar2.copy")}</button>
              </div></div>}
              <div className="mc-fila"><p style={lbl}>{t("mar2.pkgs")}</p><div style={{display:"flex",flexDirection:"column",gap:4}}>
                {dep?<span style={{fontSize:14,color:SUB}}>{t("mar2.dimsTbc")}</span>:(c.bultos_detalle||[]).length?c.bultos_detalle.map((b,i)=><div key={i} style={{fontSize:14,fontWeight:700,color:TX,fontVariantNumeric:"tabular-nums"}}>{b.qty} × {b.dims||t("mar2.noDims")}</div>):<span style={{fontSize:14,color:SUB}}>{t("mar2.noDims")}</span>}
              </div></div>
              <div className="mc-fila"><p style={lbl}>{t("mar2.volume")}</p><div style={{fontSize:14,fontWeight:700,color:dep?SUB:TX,fontVariantNumeric:"tabular-nums"}}>{dep?t("mar2.dimsTbc"):m3(c.cbm)}</div></div>
            </div>
          </div>;})}
        </div>}

        {/* Pie: detalle y total */}
        <div className="mc-pie" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,margin:"16px 0 0",padding:"14px 20px",borderTop:`1px solid ${LINEA}`,background:"rgba(0,0,0,0.14)"}}>
          <button onClick={toggle} style={{padding:"9px 16px",fontSize:13,fontWeight:700,borderRadius:10,border:"1px solid rgba(255,255,255,0.18)",background:"transparent",color:TX,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{abierta?`▴ ${t("mar2.showLess")}`:`▾ ${t("mar2.showMore")}`}</button>
          <div className="mc-pie-total" style={{textAlign:"right"}}>
            <p style={lbl}>{t("mar2.totalEst")}</p>
            {dep
              ?<p style={{margin:"5px 0 0",fontSize:14.5,fontWeight:800,color:SUB}}>{t("mar2.etaSoon")}</p>
              :<><p style={{margin:"3px 0 0",fontSize:22,fontWeight:900,color:ORO,fontVariantNumeric:"tabular-nums",lineHeight:1.1}}>{g.total_estimado?usd(g.total_estimado):t("mar2.toConfirm")}</p>
              <p style={{margin:"3px 0 0",fontSize:11,color:SUB}}>{t("mar2.totalNote")}</p></>}
          </div>
        </div>
      </div>;})}

    {foto&&<div onClick={()=>setFoto(null)} style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(5,10,20,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <img src={foto.fotos[foto.i].u} alt="" onClick={e=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"82vh",borderRadius:14}}/>
      <span style={{position:"absolute",top:20,left:"50%",transform:"translateX(-50%)",padding:"6px 14px",borderRadius:999,background:"#fff",color:"#0A1628",fontSize:13.5,fontWeight:800}}>{foto.fotos[foto.i].k}</span>
      <button onClick={()=>setFoto(null)} aria-label="✕" style={{position:"absolute",top:16,right:16,width:40,height:40,borderRadius:999,border:"none",background:"rgba(255,255,255,0.14)",color:"#fff",fontSize:18,cursor:"pointer"}}>✕</button>
      {foto.fotos.length>1&&<>
        <button onClick={e=>{e.stopPropagation();setFoto(f=>({...f,i:(f.i-1+f.fotos.length)%f.fotos.length}));}} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",width:46,height:46,borderRadius:999,border:"none",background:"rgba(255,255,255,0.14)",color:"#fff",fontSize:26,cursor:"pointer"}}>‹</button>
        <button onClick={e=>{e.stopPropagation();setFoto(f=>({...f,i:(f.i+1)%f.fotos.length}));}} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",width:46,height:46,borderRadius:999,border:"none",background:"rgba(255,255,255,0.14)",color:"#fff",fontSize:26,cursor:"pointer"}}>›</button>
      </>}
    </div>}
  </div>;
}

