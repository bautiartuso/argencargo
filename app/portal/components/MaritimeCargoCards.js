"use client";
import { useState } from "react";
import { useT } from "../../../lib/i18n-portal";

// Cargas marítimas que todavía no son operación (28/09/2026, rediseño 29/09): tarjetas flotantes
// dentro de "En curso", sin número de operación. Paleta de la marca (navy, blanco y dorado): nada
// de verdes ni rojos. Cerrada: foto, mercadería, contenedor (solo Luna 1), arribo, bultos y el
// total al pie. "Ver detalle" desglosa cada pedido con sus fotos, tracking y medidas.
// En depósito nunca se dice "depósito": la carga "ya fue cargada y ya salió de China".
export default function MaritimeCargoCards({cargo}){
  const {t,lang}=useT();
  const [abiertas,setAbiertas]=useState(()=>new Set());
  const [foto,setFoto]=useState(null); // {fotos:[{u,k}],i}
  const [copiado,setCopiado]=useState(null);
  if(!cargo||cargo.length===0)return null;
  const ORO="#E8D098";const TX="#fff";const SUB="rgba(255,255,255,0.62)";const LINEA="rgba(255,255,255,0.1)";
  const loc=lang==="zh"?"zh-CN":lang==="en"?"en-US":lang==="ru"?"ru-RU":"es-AR";
  const fD=(d)=>d?new Date(d+"T12:00:00").toLocaleDateString(loc,{day:"2-digit",month:"2-digit",year:"numeric"}):null;
  const usd=(v)=>`USD ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const m3=(v)=>`${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:3,maximumFractionDigits:3})} m³`;
  const copiar=async(txt)=>{try{await navigator.clipboard.writeText(txt);setCopiado(txt);setTimeout(()=>setCopiado(null),1600);}catch{}};
  const fotosDe=(c)=>[...(c.fotos_merc||[]).map(u=>({u,k:t("mar2.photoGoods")})),...(c.fotos||[]).map(u=>({u,k:t("mar2.photoPkg")}))];
  const lbl={margin:0,fontSize:10,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:SUB};
  const celda=(l,v,extra)=><div className="mc-celda" style={extra}><p style={lbl}>{l}</p><div style={{marginTop:5,fontSize:15,fontWeight:800,color:TX,fontVariantNumeric:"tabular-nums"}}>{v}</div></div>;
  return <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:16}}>
    <style>{`.mc-card{transition:box-shadow .2s ease,border-color .2s ease}.mc-card:hover{border-color:rgba(232,208,152,0.35)!important;box-shadow:0 20px 44px rgba(0,0,0,0.38)}.mc-strip{display:flex;flex-wrap:wrap}.mc-celda{flex:1 1 150px;padding:12px 16px;border-left:1px solid ${LINEA}}.mc-celda:first-child{border-left:none}.mc-det{display:grid;grid-template-columns:220px minmax(0,1fr);gap:22px}.mc-fila{display:grid;grid-template-columns:130px minmax(0,1fr);gap:12px;padding:10px 0;border-top:1px solid ${LINEA}}.mc-fila:first-child{border-top:none}@media(max-width:700px){.mc-galeria{max-width:280px}.mc-celda{flex:1 1 45%;border-left:none;border-top:1px solid ${LINEA}}.mc-det{grid-template-columns:1fr}.mc-fila{grid-template-columns:1fr;gap:4px}.mc-pie{flex-direction:column;align-items:stretch!important}.mc-pie-total{text-align:left!important}}`}</style>
    {cargo.map(g=>{
      const abierta=abiertas.has(g.id);
      const toggle=()=>setAbiertas(p=>{const n=new Set(p);n.has(g.id)?n.delete(g.id):n.add(g.id);return n;});
      const dep=g.etapa==="deposito";
      const cargas=Array.isArray(g.cargas)?g.cargas:[];
      const todas=cargas.flatMap(fotosDe);
      const portada=todas[0];
      const descs=cargas.map(c=>c.descripcion).filter(Boolean);
      const titulo=descs.length>1?descs.join(" · "):(descs[0]||t("mar2.seaCargo"));
      return <div key={g.id} className="mc-card" style={{borderRadius:20,border:"1px solid rgba(255,255,255,0.12)",background:"linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))",boxShadow:"0 14px 34px rgba(0,0,0,0.3)",overflow:"hidden"}}>
        {/* Encabezado */}
        <div onClick={toggle} style={{display:"flex",gap:16,alignItems:"center",padding:"18px 20px",cursor:"pointer"}}>
          <div onClick={e=>{if(portada){e.stopPropagation();setFoto({fotos:todas,i:0});}}} style={{width:76,height:76,flexShrink:0,borderRadius:16,background:portada?`url(${portada.u}) center/cover`:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.14)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,cursor:portada?"zoom-in":"pointer"}}>{portada?"":"🚢"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:10.5,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:ORO}}>{t("mar2.eyebrow")}</span>
              <span style={{fontSize:10.5,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",padding:"3px 10px",borderRadius:999,color:TX,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.16)"}}>{dep?`● ${t("mar2.stageShipped")}`:`🚢 ${t("mar2.stageSea")}`}</span>
            </div>
            <p style={{margin:"7px 0 0",fontSize:17,fontWeight:800,color:TX,lineHeight:1.3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{titulo}</p>
          </div>
          <span style={{width:36,height:36,flexShrink:0,borderRadius:999,border:"1px solid rgba(255,255,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",color:TX,transform:abierta?"rotate(180deg)":"none",transition:"transform .2s"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
        </div>

        {/* Mensaje de la carga ya embarcada */}
        {dep&&<div style={{margin:"0 20px 14px",padding:"13px 16px",borderRadius:14,background:"rgba(232,208,152,0.07)",border:"1px solid rgba(232,208,152,0.28)"}}>
          <p style={{margin:0,fontSize:14,fontWeight:800,color:TX}}>{t("mar2.depotTitle")}</p>
          <p style={{margin:"4px 0 0",fontSize:13,color:SUB,lineHeight:1.5}}>{t("mar2.depotMsg")}</p>
        </div>}

        {/* Datos del viaje */}
        <div className="mc-strip" style={{margin:"0 20px",borderRadius:14,border:`1px solid ${LINEA}`,background:"rgba(0,0,0,0.16)",overflow:"hidden"}}>
          {g.contenedor&&celda(t("mar2.container"),<span style={{fontFamily:"'JetBrains Mono','SF Mono',monospace",fontSize:17,letterSpacing:"0.04em",color:ORO}}>{g.contenedor}</span>,{flex:"1.3 1 190px"})}
          {celda(t("mar2.arrival"),dep||!g.eta_puerto?<span style={{fontSize:13.5,color:SUB,fontWeight:700}}>{t("mar2.etaSoon")}</span>:fD(g.eta_puerto))}
          {!dep&&celda(t("mar2.delivery"),fD(g.entrega_estimada)||<span style={{fontSize:13.5,color:SUB,fontWeight:700}}>{t("mar2.etaSoon")}</span>)}
          {/* En depósito (todavía sin contenedor) bultos, volumen y total se muestran recién cuando la
              carga sube al contenedor (pedido 02/10/2026). */}
          {celda(`${t("mar2.pkgs")} · ${t("mar2.volume")}`,dep?<span style={{fontSize:13.5,color:SUB,fontWeight:700}}>{t("mar2.etaSoon")}</span>:<>{g.bultos||0} <span style={{color:SUB,fontWeight:700}}>·</span> {m3(g.cbm)}</>)}
        </div>
        {g.transbordo&&<div style={{margin:"12px 20px 0",padding:"13px 16px",borderRadius:14,background:"linear-gradient(135deg,rgba(232,208,152,0.14),rgba(232,208,152,0.04))",border:"1px solid rgba(232,208,152,0.45)",display:"flex",gap:14,alignItems:"center"}}>
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
              {cargas.length>1&&<p style={{...lbl,color:ORO,marginBottom:6}}>{t("mar2.order")} {ci+1}</p>}
              <div className="mc-fila"><p style={lbl}>{t("mar2.goods")}</p><div style={{fontSize:14.5,fontWeight:700,color:TX}}>{(c.productos||[]).length>1?c.productos.map((p,i)=><div key={i}>{p.d}{p.q?<span style={{color:SUB,fontWeight:600}}> × {p.q}</span>:null}</div>):(c.descripcion||t("mar2.seaCargo"))}</div></div>
              {c.tracking&&<div className="mc-fila"><p style={lbl}>{t("mar2.tracking")}</p><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span style={{fontSize:14.5,fontWeight:700,color:TX,fontFamily:"'JetBrains Mono','SF Mono',monospace",letterSpacing:"0.03em",wordBreak:"break-all"}}>{c.tracking}</span>
                <button onClick={()=>copiar(c.tracking)} style={{padding:"4px 11px",fontSize:11.5,fontWeight:700,borderRadius:8,border:"1px solid rgba(232,208,152,0.4)",background:"transparent",color:ORO,cursor:"pointer",fontFamily:"inherit"}}>{copiado===c.tracking?`✓ ${t("mar2.copied")}`:t("mar2.copy")}</button>
              </div></div>}
              <div className="mc-fila"><p style={lbl}>{t("mar2.pkgs")}</p><div style={{display:"flex",flexDirection:"column",gap:4}}>
                {(c.bultos_detalle||[]).length?c.bultos_detalle.map((b,i)=><div key={i} style={{fontSize:14,fontWeight:700,color:TX,fontVariantNumeric:"tabular-nums"}}>{b.qty} × {b.dims||t("mar2.noDims")}</div>):<span style={{fontSize:14,color:SUB}}>{t("mar2.noDims")}</span>}
              </div></div>
              <div className="mc-fila"><p style={lbl}>{t("mar2.volume")}</p><div style={{fontSize:14,fontWeight:700,color:TX,fontVariantNumeric:"tabular-nums"}}>{m3(c.cbm)}</div></div>
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

