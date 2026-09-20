"use client";
// Catálogo: máquinas (listado + ficha), categorías y proveedores.
// Publicar exige la ficha completa: la validación vive en la base (trigger cat_productos_validar)
// y acá se replica para mostrar el checklist antes de intentar.
import { useState, useEffect, useMemo, useRef } from "react";
import { comprimirImagen } from "../../../lib/img";
import { toast, confirmDialog } from "../../../lib/ui";
import { precioMaquina } from "../../../lib/catalogo-precio";
import { INK,GRIS,BORDE,SUAVE,CARD,BG,LIMA,LIMA_SUAVE,OK,OK_BG,WARN,WARN_BG,BAD,BAD_BG,MONO,INP,LBL,TH,TD,GRID,Campo,Inp,TA,Sel,Btn,Sec,Pill,Barra,Vacio,n,numONull,txtONull,fmtUsd,codigoMaq,ChipMaq } from "./ui";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

export function Proveedores({provs,prods}){
  const cuenta=(id)=>prods.filter(p=>p.proveedor_id===id).length;
  if(provs.length===0)return <Vacio>Los proveedores se crean desde la ficha de una máquina.</Vacio>;
  return <div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
    <thead><tr>{["Fábrica","Ciudad","Contacto","WeChat","WhatsApp","Chat","Máquinas"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
    <tbody>{provs.map(p=><tr key={p.id}><td style={{...TD,fontWeight:800}}>{p.fabrica}</td><td style={TD}>{p.ciudad}</td><td style={TD}>{p.contacto}</td><td style={{...TD,fontFamily:MONO,fontSize:12.5}}>{p.wechat||"—"}</td><td style={{...TD,fontFamily:MONO,fontSize:12.5}}>{p.whatsapp||"—"}</td><td style={TD}>{p.chat_plataforma||"—"}</td><td style={{...TD,fontFamily:MONO}}>{cuenta(p.id)}</td></tr>)}</tbody>
  </table></div></div>;
}

export function Categorias({arbol,prods}){
  const cuenta=(slug)=>prods.filter(p=>p.categoria===slug||p.subcategoria===slug).length;
  return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
    {arbol.map(c=><div key={c.slug} style={{border:`1px solid ${BORDE}`,borderRadius:18,padding:"16px 18px",background:CARD}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><p style={{margin:0,fontSize:15,fontWeight:800}}>{c.nombre}</p><span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>{cuenta(c.slug)}</span></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{c.subs.map(s=><span key={s.slug} style={{fontSize:12.5,fontWeight:600,padding:"5px 10px",borderRadius:999,background:SUAVE}}>{s.nombre}</span>)}</div>
    </div>)}
  </div>;
}

export function Maquinas({ses,dq,token,cats,arbol,provs,setProvs,prods,antid,ajustes,listo,recargar}){
  const [sel,setSel]=useState(null);
  const [fEstado,setFEstado]=useState("todos");
  const [busq,setBusq]=useState("");
  const [verCats,setVerCats]=useState(false);
  const nombreCat=(slug)=>cats.find(c=>c.slug===slug)?.nombre||slug||"—";
  const nuevo=async()=>{try{const r=await dq("cat_productos",{method:"POST",body:{estado:"borrador",created_by:ses.user?.id||null}});const p=Array.isArray(r)?r[0]:r;await recargar();setSel(p.id);}catch(e){toast(e.message,"error");}};
  const visibles=prods.filter(p=>(fEstado==="todos"||p.estado===fEstado)&&(!busq.trim()||`${codigoMaq(p)} ${p.nombre||""} ${p.nombre_raw||""} ${p.modelo||""}`.toLowerCase().includes(busq.toLowerCase())));
  const cuenta=(e)=>prods.filter(p=>p.estado===e).length;

  if(sel)return <Editor key={sel} id={sel} dq={dq} token={token} arbol={arbol} provs={provs} antid={antid} ajustes={ajustes} recargar={recargar} onCerrar={()=>setSel(null)} onProvNuevo={(p)=>setProvs(x=>[...x,p].sort((a,b)=>a.fabrica.localeCompare(b.fabrica)))}/>;
  return <>
    <Barra>
      {!verCats&&[["todos","Todas",prods.length],["publicado","Publicadas",cuenta("publicado")],["borrador","Borradores",cuenta("borrador")],["pausado","Pausadas",cuenta("pausado")]].map(([k,l,c])=><Pill key={k} on={fEstado===k} onClick={()=>setFEstado(k)}>{l} <span style={{color:GRIS,fontFamily:MONO,fontSize:11}}>{c}</span></Pill>)}
      {!verCats&&<input placeholder="Buscar…" value={busq} onChange={e=>setBusq(e.target.value)} style={{...INP,flex:1,minWidth:180,borderRadius:999,padding:"10px 18px"}}/>}
      {verCats&&<span style={{flex:1}}/>}
      <Btn onClick={()=>setVerCats(v=>!v)}>{verCats?"← Máquinas":"Categorías"}</Btn>
      <Btn kind="lima" onClick={nuevo}>+ Nueva máquina</Btn>
    </Barra>
    {verCats?<Categorias arbol={arbol} prods={prods}/>
    :!listo?<p style={{color:GRIS}}>Cargando…</p>
    :visibles.length===0?<Vacio>{prods.length===0?"Todavía no hay máquinas cargadas.":"Nada que coincida."}</Vacio>
    :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}}>
      {visibles.map(p=>{const foto=Array.isArray(p.fotos)&&p.fotos[0];return <button key={p.id} className="card" onClick={()=>setSel(p.id)} style={{textAlign:"left",background:CARD,border:`1px solid ${BORDE}`,borderRadius:18,padding:0,overflow:"hidden",cursor:"pointer",color:INK,transition:"all 150ms"}}>
        <div style={{aspectRatio:"4/3",background:SUAVE,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>{foto?<img src={foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:12.5,color:GRIS}}>Sin fotos</span>}</div>
        <div style={{padding:"13px 15px 15px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:7}}><span style={{fontFamily:MONO,fontSize:11,fontWeight:600,color:GRIS,letterSpacing:"0.06em"}}>{codigoMaq(p)}</span><ChipMaq e={p.estado}/></div>
          <p style={{margin:"0 0 5px",fontSize:14.5,fontWeight:800,lineHeight:1.3,letterSpacing:"-0.01em",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{p.nombre||p.nombre_raw||<span style={{color:GRIS,fontWeight:600}}>Sin nombre</span>}</p>
          <p style={{margin:0,fontSize:12.5,color:GRIS}}>{p.categoria?`${nombreCat(p.categoria)} · ${nombreCat(p.subcategoria)}`:"Sin categoría"}{p.exw_usd?` · EXW ${fmtUsd(p.exw_usd)}`:""}</p>
        </div>
      </button>;})}
    </div>}
  </>;
}

// ── Ficha de una máquina ──────────────────────────────────────────────────────────────────
const BULTO=()=>({cantidad:"1",largo_cm:"",ancho_cm:"",alto_cm:"",peso_kg:""});
const VACIO={nombre_raw:"",modelo:"",specs_raw:"",descripcion_raw:"",nombre:"",descripcion:"",categoria:"",subcategoria:"",condicion:"nueva",anio:"",horas_uso:"",garantia_meses:"",fotos:[],video_url:"",exw_usd:"",moq:"1",dias_produccion:"",markup_pct:"",packing:[BULTO()],ncm_code:"",ncm_descripcion:"",die:"",te:"",iva:"",intervencion:null,proveedor_id:"",link_producto:"",notas_internas:""};

function Editor({id,dq,token,arbol,provs,antid,ajustes,recargar,onCerrar,onProvNuevo}){
  const [p,setP]=useState(null);
  const [f,setF]=useState(VACIO);
  const [dirty,setDirty]=useState(false);
  const [guardando,setGuardando]=useState(false);
  const [ia,setIa]=useState(false);
  const [ncmIa,setNcmIa]=useState(false);
  const [subiendo,setSubiendo]=useState(0);
  const [arrastrando,setArrastrando]=useState(false);
  const [provForm,setProvForm]=useState(null);
  const fileRef=useRef(null);const videoRef=useRef(null);
  const fRef=useRef(f);fRef.current=f;

  useEffect(()=>{(async()=>{try{
    const r=await dq("cat_productos",{filters:`?id=eq.${id}&select=*`});const row=Array.isArray(r)?r[0]:null;if(!row){toast("No se encontró la máquina","error");onCerrar();return;}
    setP(row);
    const s=(v)=>v==null?"":String(v);
    const pk=Array.isArray(row.packing)&&row.packing.length?row.packing.map(b=>({cantidad:s(b.cantidad||1),largo_cm:s(b.largo_cm),ancho_cm:s(b.ancho_cm),alto_cm:s(b.alto_cm),peso_kg:s(b.peso_kg)})):[BULTO()];
    setF({...VACIO,nombre_raw:s(row.nombre_raw),modelo:s(row.modelo),specs_raw:s(row.specs_raw),descripcion_raw:s(row.descripcion_raw),nombre:s(row.nombre),descripcion:s(row.descripcion),categoria:s(row.categoria),subcategoria:s(row.subcategoria),condicion:row.condicion||"nueva",anio:s(row.anio),horas_uso:s(row.horas_uso),garantia_meses:s(row.garantia_meses),fotos:Array.isArray(row.fotos)?row.fotos:[],video_url:s(row.video_url),exw_usd:s(row.exw_usd),moq:row.moq?String(row.moq):"1",dias_produccion:s(row.dias_produccion),markup_pct:s(row.markup_pct),packing:pk,ncm_code:s(row.ncm_code),ncm_descripcion:s(row.ncm_descripcion),die:s(row.die),te:s(row.te),iva:s(row.iva),intervencion:row.intervencion||null,proveedor_id:s(row.proveedor_id),link_producto:s(row.link_producto),notas_internas:s(row.notas_internas)});
  }catch(e){toast(e.message,"error");}})();},[id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set=(k,v)=>{setF(x=>({...x,[k]:v}));setDirty(true);};
  const subs=useMemo(()=>arbol.find(c=>c.slug===f.categoria)?.subs||[],[arbol,f.categoria]);
  const prov=provs.find(x=>x.id===f.proveedor_id);
  const ad=useMemo(()=>{const c=String(f.ncm_code||"").replace(/\./g,"");if(!c)return null;return antid.find(a=>c.startsWith(String(a.ncm_prefix||"").replace(/\./g,"")))||null;},[antid,f.ncm_code]);

  const reqs=useMemo(()=>{const m=f.modelo.trim();return [
    {l:"Modelo / código",ok:!!m},
    {l:m?`Nombre comercial completo, con el código ${m}`:"Nombre comercial completo",ok:f.nombre.trim().length>=12&&(!m||f.nombre.toLowerCase().includes(m.toLowerCase()))},
    {l:"Descripción",ok:!!f.descripcion.trim()},
    {l:"Categoría y subcategoría",ok:!!f.categoria&&!!f.subcategoria},
    ...(f.condicion==="usada"?[{l:"Año de la máquina usada",ok:!!f.anio.trim()}]:[]),
    {l:`Mínimo 5 fotos (hay ${f.fotos.length})`,ok:f.fotos.length>=5},
    {l:"Valor EXW",ok:n(f.exw_usd)>0},
    {l:"Días de producción",ok:n(f.dias_produccion)>0},
    {l:"Packing: cantidad, medidas y peso de cada bulto",ok:f.packing.length>0&&!f.packing.some(b=>n(b.cantidad)<=0||n(b.largo_cm)<=0||n(b.ancho_cm)<=0||n(b.alto_cm)<=0||n(b.peso_kg)<=0)},
    {l:"Posición NCM",ok:!!f.ncm_code.trim()},
    {l:"Proveedor",ok:!!f.proveedor_id},
    {l:"Link del producto",ok:!!f.link_producto.trim()},
  ];},[f]);
  const faltan=reqs.filter(r=>!r.ok);

  const cuerpo=(estado)=>({
    estado:estado||p.estado,
    nombre_raw:txtONull(f.nombre_raw),modelo:txtONull(f.modelo),specs_raw:txtONull(f.specs_raw),descripcion_raw:txtONull(f.descripcion_raw),
    nombre:txtONull(f.nombre),descripcion:txtONull(f.descripcion),categoria:txtONull(f.categoria),subcategoria:txtONull(f.subcategoria),
    condicion:f.condicion,anio:numONull(f.anio),horas_uso:numONull(f.horas_uso),garantia_meses:numONull(f.garantia_meses),fotos:f.fotos,video_url:txtONull(f.video_url),
    exw_usd:numONull(f.exw_usd),moq:numONull(f.moq)||1,dias_produccion:numONull(f.dias_produccion),markup_pct:numONull(f.markup_pct),
    packing:f.packing.map(b=>({cantidad:n(b.cantidad),largo_cm:n(b.largo_cm),ancho_cm:n(b.ancho_cm),alto_cm:n(b.alto_cm),peso_kg:n(b.peso_kg)})),
    ncm_code:txtONull(f.ncm_code),ncm_descripcion:txtONull(f.ncm_descripcion),die:numONull(f.die),te:numONull(f.te),iva:numONull(f.iva),intervencion:f.intervencion||null,antidumping:ad?{prefix:ad.ncm_prefix,producto:ad.producto,medida_tipo:ad.medida_tipo,valor:ad.valor,unidad:ad.unidad,resolucion:ad.resolucion}:null,
    proveedor_id:f.proveedor_id||null,link_producto:txtONull(f.link_producto),notas_internas:txtONull(f.notas_internas),
  });
  const guardar=async(estado)=>{setGuardando(true);try{
    const r=await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:cuerpo(estado)});
    const row=Array.isArray(r)?r[0]:null;if(row)setP(row);setDirty(false);await recargar();
    toast(estado==="publicado"?"Publicada en el catálogo":estado==="pausado"?"Pausada":"Guardado");
  }catch(e){toast(e.message.replace(/^.*?No se puede publicar/,"No se puede publicar"),"error",{duration:7000});}setGuardando(false);};
  const eliminar=async()=>{if(!(await confirmDialog(`¿Eliminar ${codigoMaq(p)}? Se borra la ficha y sus fotos. No se puede deshacer.`)))return;try{
    for(const u of [...f.fotos,f.video_url].filter(Boolean))borrarArchivo(u);
    await dq("cat_productos",{method:"DELETE",filters:`?id=eq.${id}`,prefer:"return=minimal"});await recargar();toast("Eliminada");onCerrar();
  }catch(e){toast(e.message,"error");}};

  const completarIA=async()=>{if(!f.nombre_raw.trim()&&!f.specs_raw.trim()&&!f.descripcion_raw.trim()){toast("Cargá primero el nombre, las especificaciones o la descripción","error");return;}setIa(true);try{
    const r=await fetch("/api/catalogo/ia",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({nombre_raw:f.nombre_raw,modelo:f.modelo,specs_raw:f.specs_raw,descripcion_raw:f.descripcion_raw,condicion:f.condicion,categorias:arbol.map(c=>({slug:c.slug,nombre:c.nombre,subs:c.subs.map(s=>({slug:s.slug,nombre:s.nombre}))}))})});
    const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||"Falló la IA");
    setF(x=>({...x,nombre:d.nombre||x.nombre,descripcion:d.descripcion||x.descripcion,categoria:d.categoria||x.categoria,subcategoria:d.subcategoria||x.subcategoria}));setDirty(true);toast("Listo");
  }catch(e){toast(e.message,"error");}setIa(false);};

  const aplicarNcm=(d)=>{setF(x=>({...x,ncm_code:d.ncm_code||x.ncm_code,ncm_descripcion:d.ncm_description||d.description||x.ncm_descripcion,die:d.import_duty_rate!=null?String(d.import_duty_rate):d.die!=null?String(d.die):x.die,te:d.statistics_rate!=null?String(d.statistics_rate):d.te!=null?String(Math.min(Number(d.te),3)):x.te,iva:d.iva_rate!=null?String(d.iva_rate):d.iva!=null?String(d.iva):x.iva,intervencion:d.intervention!==undefined?d.intervention:x.intervencion}));setDirty(true);};
  const clasificar=async()=>{const desc=[f.nombre||f.nombre_raw,f.specs_raw].filter(Boolean).join(". ").slice(0,1500);if(!desc.trim()){toast("Primero cargá el nombre o las especificaciones","error");return;}setNcmIa(true);try{
    const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:desc})});const d=await r.json();if(!d?.ncm_code)throw new Error(d?.error||"No se pudo clasificar");aplicarNcm(d);toast(`NCM ${d.ncm_code}`);
  }catch(e){toast(e.message,"error");}setNcmIa(false);};
  const buscarCodigo=async(c)=>{if(!/^\d{4}\.\d{2}\.\d{2}$/.test(c))return;try{
    const r=await dq("ncm_database",{filters:`?ncm_code=eq.${c}&select=ncm_code,description,die,te,iva&limit=1`});const d=Array.isArray(r)?r[0]:null;if(!d){toast("Esa posición no está en la base","error");return;}aplicarNcm({...d,intervention:fRef.current.intervencion});
  }catch(e){toast(e.message,"error");}};

  const subir=async(files)=>{const lista=Array.from(files||[]).filter(x=>x.type?.startsWith("image/")||x.type?.startsWith("video/"));if(!lista.length)return;setSubiendo(lista.length);const fotosNuevas=[];let video=null;
    for(let i=0;i<lista.length;i++){let file=lista[i];const esVideo=file.type.startsWith("video/");try{
      if(!esVideo)file=await comprimirImagen(file,{maxLado:2000,calidad:0.86});
      const ext=esVideo?(file.name.split(".").pop()||"mp4").toLowerCase():"jpg";
      const path=`productos/${id}/${Date.now()}-${i}.${ext}`;
      const r=await fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"POST",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},body:file});
      if(!r.ok)throw new Error(`No se pudo subir (${r.status})`);
      const url=`${SB_URL}/storage/v1/object/public/catalogo/${path}`;if(esVideo)video=url;else fotosNuevas.push(url);
    }catch(e){toast(e.message,"error");}setSubiendo(lista.length-i-1);}
    const cambios={};
    if(fotosNuevas.length)cambios.fotos=[...fRef.current.fotos,...fotosNuevas];
    if(video)cambios.video_url=video;
    if(!Object.keys(cambios).length)return;
    setF(x=>({...x,...cambios}));
    await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:cambios}).catch(e=>toast(e.message,"error"));
  };
  useEffect(()=>{const onPaste=(e)=>{const files=Array.from(e.clipboardData?.files||[]);if(files.length){e.preventDefault();subir(files);}};window.addEventListener("paste",onPaste);return()=>window.removeEventListener("paste",onPaste);},[id,token]); // eslint-disable-line react-hooks/exhaustive-deps
  const onDrop=(e)=>{e.preventDefault();setArrastrando(false);subir(e.dataTransfer?.files);};
  const onDragOver=(e)=>{e.preventDefault();if(!arrastrando)setArrastrando(true);};
  const borrarArchivo=(u)=>{const path=u.split("/object/public/catalogo/")[1];if(path)fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"DELETE",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`}}).catch(()=>{});};
  const quitarFoto=async(u)=>{const fotos=f.fotos.filter(x=>x!==u);setF(x=>({...x,fotos}));borrarArchivo(u);await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{fotos}}).catch(e=>toast(e.message,"error"));};
  const principal=async(u)=>{const fotos=[u,...f.fotos.filter(x=>x!==u)];setF(x=>({...x,fotos}));await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{fotos}}).catch(e=>toast(e.message,"error"));};
  const quitarVideo=async()=>{const u=f.video_url;setF(x=>({...x,video_url:""}));if(u)borrarArchivo(u);await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{video_url:null}}).catch(e=>toast(e.message,"error"));};

  const guardarProv=async()=>{const q=provForm;if(!q.fabrica.trim()||!q.ciudad.trim()||!q.contacto.trim()){toast("Fábrica, ciudad y contacto son obligatorios","error");return;}if(!q.wechat.trim()&&!q.whatsapp.trim()&&!q.chat_plataforma.trim()){toast("Cargá al menos una vía de contacto: WeChat, WhatsApp o chat de plataforma","error");return;}try{
    const body={fabrica:q.fabrica.trim(),ciudad:q.ciudad.trim(),contacto:q.contacto.trim(),wechat:txtONull(q.wechat),whatsapp:txtONull(q.whatsapp),chat_plataforma:txtONull(q.chat_plataforma),notas:txtONull(q.notas)};
    if(q.id){await dq("cat_proveedores",{method:"PATCH",filters:`?id=eq.${q.id}`,body});await recargar();toast("Proveedor actualizado");}
    else{const r=await dq("cat_proveedores",{method:"POST",body:{...body,created_by:p.created_by||null}});const row=Array.isArray(r)?r[0]:r;onProvNuevo(row);set("proveedor_id",row.id);toast("Proveedor creado");}
    setProvForm(null);
  }catch(e){toast(e.message,"error");}};

  if(!p)return <p style={{color:GRIS}}>Cargando…</p>;
  const totKg=f.packing.reduce((s,b)=>s+n(b.peso_kg)*(n(b.cantidad)||1),0);
  const totM3=f.packing.reduce((s,b)=>s+(n(b.largo_cm)*n(b.ancho_cm)*n(b.alto_cm)/1e6)*(n(b.cantidad)||1),0);
  const verificado=p.precio_verificado_at?Math.floor((Date.now()-new Date(p.precio_verificado_at))/864e5):null;
  const pv=(x)=>x==null?null:String(x).replace(".",",");
  const pm=precioMaquina({exwUnit:n(f.exw_usd),qty:1,ajustes,gestionPct:f.markup_pct.trim()===""?null:f.markup_pct});

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"0 0 22px"}}>
      <Btn small onClick={onCerrar}>← Máquinas</Btn>
      <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,letterSpacing:"0.08em"}}>{codigoMaq(p)}</span>
      <ChipMaq e={p.estado}/>
      {dirty&&<span style={{fontSize:12.5,color:WARN,fontWeight:700}}>● Sin guardar</span>}
      <span style={{flex:1}}/>
      <Btn kind="danger" small onClick={eliminar}>Eliminar</Btn>
    </div>

    <Sec titulo="La máquina">
      <div className="grid3" style={GRID}>
        <Campo label="Nombre de la máquina" ob span={2}><Inp value={f.nombre_raw} onChange={e=>set("nombre_raw",e.target.value)}/></Campo>
        <Campo label="Modelo / código" ob><Inp value={f.modelo} onChange={e=>set("modelo",e.target.value)}/></Campo>
        <Campo label="Especificaciones" span={3}><TA value={f.specs_raw} onChange={e=>set("specs_raw",e.target.value)} style={{minHeight:120}}/></Campo>
        <Campo label="Descripción de la máquina" ob span={3}><TA value={f.descripcion_raw} onChange={e=>set("descripcion_raw",e.target.value)}/></Campo>
      </div>
      <div style={{marginTop:16}}><Btn kind="negro" onClick={completarIA} disabled={ia}>{ia?"Redactando…":"✦ Completar con IA"}</Btn></div>
      <div className="grid3" style={{...GRID,marginTop:22,paddingTop:22,borderTop:`1px solid ${BORDE}`}}>
        <Campo label="Nombre comercial" ob span={3}><Inp value={f.nombre} onChange={e=>set("nombre",e.target.value)} style={{fontSize:16,fontWeight:800}}/></Campo>
        <Campo label="Descripción" ob span={3}><TA value={f.descripcion} onChange={e=>set("descripcion",e.target.value)} style={{minHeight:180}}/></Campo>
        <Campo label="Categoría" ob><Sel value={f.categoria} onChange={e=>{set("categoria",e.target.value);set("subcategoria","");}}><option value="">Elegir…</option>{arbol.map(c=><option key={c.slug} value={c.slug}>{c.nombre}</option>)}</Sel></Campo>
        <Campo label="Subcategoría" ob><Sel value={f.subcategoria} onChange={e=>set("subcategoria",e.target.value)} disabled={!f.categoria}><option value="">Elegir…</option>{subs.map(s=><option key={s.slug} value={s.slug}>{s.nombre}</option>)}</Sel></Campo>
        <Campo label="Garantía de fábrica (meses)"><Inp type="number" value={f.garantia_meses} onChange={e=>set("garantia_meses",e.target.value)}/></Campo>
        <Campo label="Condición" ob><div style={{display:"flex",gap:8}}><Pill on={f.condicion==="nueva"} onClick={()=>set("condicion","nueva")}>Nueva</Pill><Pill on={f.condicion==="usada"} onClick={()=>set("condicion","usada")}>Usada</Pill></div></Campo>
        {f.condicion==="usada"&&<><Campo label="Año" ob><Inp type="number" value={f.anio} onChange={e=>set("anio",e.target.value)}/></Campo><Campo label="Horas de uso"><Inp type="number" value={f.horas_uso} onChange={e=>set("horas_uso",e.target.value)}/></Campo></>}
      </div>
    </Sec>

    <Sec titulo="Fotos y video" onDrop={onDrop} onDragOver={onDragOver} extra={<span style={{fontFamily:MONO,fontSize:11,color:f.fotos.length>=5?OK:GRIS}}>{f.fotos.length}/5 FOTOS{f.fotos.length>=5?" ✓":""}</span>}>
      <div style={{border:`2px dashed ${arrastrando?INK:BORDE}`,borderRadius:16,padding:14,background:arrastrando?LIMA_SUAVE:SUAVE,transition:"all 120ms"}} onDragLeave={()=>setArrastrando(false)}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
          {f.fotos.map((u,i)=><div key={u} style={{position:"relative",aspectRatio:"1",borderRadius:12,overflow:"hidden",border:`2px solid ${i===0?LIMA:"transparent"}`,background:CARD}}>
            <img src={u} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            {i===0&&<span style={{position:"absolute",top:7,left:7,fontFamily:MONO,fontSize:9,fontWeight:600,letterSpacing:"0.08em",padding:"3px 7px",borderRadius:5,background:LIMA,color:"var(--mq-lima-ink)"}}>PRINCIPAL</span>}
            <div style={{position:"absolute",bottom:0,left:0,right:0,display:"flex",gap:4,padding:6,background:"linear-gradient(transparent,rgba(0,0,0,0.55))"}}>
              {i>0&&<button type="button" onClick={()=>principal(u)} title="Hacer principal" style={{flex:1,fontSize:11,fontWeight:700,padding:"5px 0",borderRadius:6,border:"none",background:"rgba(255,255,255,0.9)",color:"#121212",cursor:"pointer"}}>★</button>}
              <button type="button" onClick={()=>quitarFoto(u)} title="Quitar" style={{flex:1,fontSize:11,fontWeight:700,padding:"5px 0",borderRadius:6,border:"none",background:"rgba(255,255,255,0.9)",color:"#C22F2F",cursor:"pointer"}}>✕</button>
            </div>
          </div>)}
          <button type="button" onClick={()=>fileRef.current?.click()} disabled={subiendo>0} style={{aspectRatio:"1",borderRadius:12,border:`1px solid ${BORDE}`,background:CARD,color:INK,cursor:"pointer",fontSize:13,fontWeight:700}}>{subiendo>0?`Subiendo ${subiendo}…`:"+ Fotos"}</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e=>{subir(e.target.files);e.target.value="";}}/>
        </div>
      </div>
      <div style={{marginTop:14}}>
        <label style={LBL}>Video</label>
        {f.video_url?<div style={{display:"flex",gap:14,alignItems:"start",flexWrap:"wrap"}}><video src={f.video_url} controls style={{width:280,maxWidth:"100%",borderRadius:12,background:"#000"}}/><Btn small kind="danger" onClick={quitarVideo}>Quitar video</Btn></div>
        :<Btn onClick={()=>videoRef.current?.click()} disabled={subiendo>0}>Subir video</Btn>}
        <input ref={videoRef} type="file" accept="video/*" hidden onChange={e=>{subir(e.target.files);e.target.value="";}}/>
      </div>
    </Sec>

    <Sec titulo="Precio y plazo">
      <div className="grid3" style={GRID}>
        <Campo label="Valor EXW (USD)" ob hint={verificado!=null?`Verificado hace ${verificado} día${verificado===1?"":"s"}`:null}><Inp type="number" step="0.01" value={f.exw_usd} onChange={e=>set("exw_usd",e.target.value)}/></Campo>
        <Campo label="Días de producción" ob><Inp type="number" value={f.dias_produccion} onChange={e=>set("dias_produccion",e.target.value)}/></Campo>
        <Campo label="Cantidad mínima (MOQ)"><Inp type="number" value={f.moq} onChange={e=>set("moq",e.target.value)}/></Campo>
        <Campo label="Gestión (%)" hint={f.markup_pct.trim()===""?`Vacío: usa el ${String(ajustes.gestion_pct).replace(".",",")} % general`:null}><Inp type="number" step="0.5" value={f.markup_pct} onChange={e=>set("markup_pct",e.target.value)} placeholder={String(ajustes.gestion_pct)}/></Campo>
      </div>
      {n(f.exw_usd)>0&&<div style={{marginTop:18,background:SUAVE,borderRadius:16,padding:"16px 18px"}}>
        <p style={{...LBL,marginBottom:10}}>Precio de la máquina para el cliente · por unidad</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"6px 18px",fontSize:13.5,maxWidth:460}}>
          <span style={{color:GRIS}}>EXW fábrica</span><span style={{fontFamily:MONO,textAlign:"right"}}>{fmtUsd(pm.exw)}</span>
          <span style={{color:GRIS}}>Costo financiero del pago ({String(ajustes.fin_pct).replace(".",",")} % + USD {ajustes.fin_fijo_usd})</span><span style={{fontFamily:MONO,textAlign:"right"}}>{fmtUsd(pm.financiero)}</span>
          <span style={{color:GRIS}}>Gestión ({String(pm.pct).replace(".",",")} %{pm.gestion>pm.exw*pm.pct/100+0.005?", piso":""})</span><span style={{fontFamily:MONO,textAlign:"right"}}>{fmtUsd(pm.gestion)}</span>
          <span style={{fontWeight:800,borderTop:`1px solid ${BORDE}`,paddingTop:8}}>Precio de la máquina</span><span style={{fontFamily:MONO,fontWeight:800,textAlign:"right",borderTop:`1px solid ${BORDE}`,paddingTop:8}}>{fmtUsd(pm.precio)}</span>
        </div>
        <p style={{margin:"10px 0 0",fontSize:12.5,color:pm.cubreAdelanto?OK:BAD}}>{pm.cubreAdelanto?`Cubre el adelanto mínimo (EXW + ${ajustes.adelanto_extra_pct} % = ${fmtUsd(pm.adelantoMinimo)}).`:`No cubre el adelanto mínimo (EXW + ${ajustes.adelanto_extra_pct} % = ${fmtUsd(pm.adelantoMinimo)}): subí la gestión.`} La importación de Argencargo va aparte.</p>
      </div>}
    </Sec>

    <Sec titulo="Packing" extra={<span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>{totM3.toFixed(3).replace(".",",")} M³ · {totKg.toLocaleString("es-AR")} KG</span>}>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 6px"}}>
        <thead><tr>{["Bulto","Cantidad","Largo (cm)","Ancho (cm)","Alto (cm)","Peso bruto (kg)",""].map(h=><th key={h} style={{...LBL,display:"table-cell",textAlign:"left",padding:"0 6px 2px",marginBottom:0,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{f.packing.map((b,i)=>{const up=(k,v)=>set("packing",f.packing.map((x,j)=>j===i?{...x,[k]:v}:x));return <tr key={i}>
          <td style={{padding:"0 6px",fontFamily:MONO,fontSize:12,color:GRIS,whiteSpace:"nowrap"}}>#{i+1}</td>
          {["cantidad","largo_cm","ancho_cm","alto_cm","peso_kg"].map(k=><td key={k} style={{padding:"0 4px",minWidth:96}}><Inp type="number" step="0.01" value={b[k]} onChange={e=>up(k,e.target.value)}/></td>)}
          <td style={{padding:"0 4px"}}>{f.packing.length>1&&<Btn small kind="danger" onClick={()=>set("packing",f.packing.filter((_,j)=>j!==i))}>✕</Btn>}</td>
        </tr>;})}</tbody>
      </table></div>
      <div style={{marginTop:8}}><Btn small onClick={()=>set("packing",[...f.packing,BULTO()])}>+ Agregar bulto</Btn></div>
    </Sec>

    <Sec titulo="Posición arancelaria (NCM)">
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"end"}}>
        <div style={{width:180}}><Campo label="NCM" ob><Inp value={f.ncm_code} onChange={e=>set("ncm_code",e.target.value)} onBlur={e=>buscarCodigo(e.target.value.trim())} placeholder="0000.00.00" style={{fontFamily:MONO}}/></Campo></div>
        <Btn kind="negro" onClick={clasificar} disabled={ncmIa}>{ncmIa?"Clasificando…":"✦ Clasificar con IA"}</Btn>
      </div>
      {f.ncm_code&&<div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        {[["Derechos (DIE)",f.die],["Tasa estadística",f.te],["IVA",f.iva]].map(([l,v])=><div key={l} style={{background:SUAVE,borderRadius:14,padding:"12px 14px"}}><p style={{...LBL,marginBottom:4}}>{l}</p><p style={{margin:0,fontSize:22,fontWeight:800,letterSpacing:"-0.02em"}}>{v!==""&&v!=null?`${pv(v)} %`:"—"}</p></div>)}
        {f.ncm_descripcion&&<p style={{gridColumn:"1 / -1",margin:0,fontSize:13,color:GRIS}}>{f.ncm_descripcion}</p>}
        {ad&&<div style={{gridColumn:"1 / -1",background:BAD_BG,borderRadius:14,padding:"12px 14px"}}><p style={{margin:0,fontFamily:MONO,fontSize:11,fontWeight:600,color:BAD,letterSpacing:"0.08em"}}>⚠ ANTIDUMPING · {String(ad.producto||"").toUpperCase()}</p><p style={{margin:"4px 0 0",fontSize:13.5}}>{ad.medida_tipo==="valor_minimo"?`Valor mínimo de exportación ${fmtUsd(ad.valor)}${ad.unidad?` por ${ad.unidad}`:""}`:ad.valor!=null?`${ad.medida_tipo||"Derecho"}: ${pv(ad.valor)}${ad.unidad?` ${ad.unidad}`:" %"}`:ad.medida_tipo||""}{ad.resolucion?` · ${ad.resolucion}`:""}{ad.vigencia_hasta?` · vigente hasta ${new Date(ad.vigencia_hasta).toLocaleDateString("es-AR")}`:""}{ad.nota?` · ${ad.nota}`:""}</p></div>}
        {f.intervencion?.required&&<div style={{gridColumn:"1 / -1",background:WARN_BG,borderRadius:14,padding:"12px 14px"}}><p style={{margin:0,fontFamily:MONO,fontSize:11,fontWeight:600,color:WARN,letterSpacing:"0.08em"}}>⚠ INTERVENCIÓN · {(f.intervencion.types||[]).join(" · ")||"ORGANISMO"}</p>{f.intervencion.reason&&<p style={{margin:"4px 0 0",fontSize:13.5}}>{f.intervencion.reason}</p>}</div>}
        {f.intervencion&&!f.intervencion.required&&!ad&&<p style={{gridColumn:"1 / -1",margin:0,fontSize:13,fontWeight:700,color:OK}}>Sin intervención de organismos ni antidumping.</p>}
      </div>}
    </Sec>

    <Sec titulo="Proveedor">
      <div className="grid3" style={GRID}>
        <Campo label="Fábrica" ob span={2}><Sel value={f.proveedor_id} onChange={e=>set("proveedor_id",e.target.value)}><option value="">Elegir proveedor…</option>{provs.map(x=><option key={x.id} value={x.id}>{x.fabrica} · {x.ciudad}</option>)}</Sel></Campo>
        <div style={{display:"flex",gap:8,alignItems:"end"}}><Btn onClick={()=>setProvForm({fabrica:"",ciudad:"",contacto:"",wechat:"",whatsapp:"",chat_plataforma:"",notas:""})}>+ Nuevo proveedor</Btn>{prov&&<Btn onClick={()=>setProvForm({id:prov.id,fabrica:prov.fabrica||"",ciudad:prov.ciudad||"",contacto:prov.contacto||"",wechat:prov.wechat||"",whatsapp:prov.whatsapp||"",chat_plataforma:prov.chat_plataforma||"",notas:prov.notas||""})}>Editar</Btn>}</div>
        {prov&&!provForm&&<div style={{gridColumn:"1 / -1",fontSize:13.5,display:"flex",gap:16,flexWrap:"wrap",background:SUAVE,borderRadius:14,padding:"12px 14px"}}><span>📍 {prov.ciudad}</span><span>👤 {prov.contacto}</span>{prov.wechat&&<span>WeChat <b>{prov.wechat}</b></span>}{prov.whatsapp&&<span>WhatsApp <b>{prov.whatsapp}</b></span>}{prov.chat_plataforma&&<span>Chat <b>{prov.chat_plataforma}</b></span>}{prov.notas&&<span style={{color:GRIS}}>{prov.notas}</span>}</div>}
        {provForm&&<div style={{gridColumn:"1 / -1",background:SUAVE,borderRadius:16,padding:18}}>
          <p style={{margin:"0 0 14px",fontSize:15,fontWeight:800}}>{provForm.id?"Editar proveedor":"Nuevo proveedor"}</p>
          <div className="grid3" style={GRID}>
            <Campo label="Nombre de la fábrica" ob><Inp value={provForm.fabrica} onChange={e=>setProvForm(x=>({...x,fabrica:e.target.value}))}/></Campo>
            <Campo label="Ciudad" ob><Inp value={provForm.ciudad} onChange={e=>setProvForm(x=>({...x,ciudad:e.target.value}))}/></Campo>
            <Campo label="Persona de contacto" ob><Inp value={provForm.contacto} onChange={e=>setProvForm(x=>({...x,contacto:e.target.value}))}/></Campo>
            <Campo label="WeChat ID"><Inp value={provForm.wechat} onChange={e=>setProvForm(x=>({...x,wechat:e.target.value}))}/></Campo>
            <Campo label="WhatsApp"><Inp value={provForm.whatsapp} onChange={e=>setProvForm(x=>({...x,whatsapp:e.target.value}))}/></Campo>
            <Campo label="Chat de plataforma"><Inp value={provForm.chat_plataforma} onChange={e=>setProvForm(x=>({...x,chat_plataforma:e.target.value}))}/></Campo>
            <Campo label="Notas" span={3}><Inp value={provForm.notas} onChange={e=>setProvForm(x=>({...x,notas:e.target.value}))}/></Campo>
          </div>
          <div style={{display:"flex",gap:8,marginTop:14}}><Btn kind="lima" onClick={guardarProv}>{provForm.id?"Guardar cambios":"Crear proveedor"}</Btn><Btn onClick={()=>setProvForm(null)}>Cancelar</Btn></div>
        </div>}
        <Campo label="Link del producto" ob span={3}><Inp value={f.link_producto} onChange={e=>set("link_producto",e.target.value)}/></Campo>
        <Campo label="Notas internas" span={3}><TA value={f.notas_internas} onChange={e=>set("notas_internas",e.target.value)} style={{minHeight:72}}/></Campo>
      </div>
    </Sec>

    {p.estado!=="publicado"&&<section style={{background:faltan.length?WARN_BG:OK_BG,borderRadius:18,padding:"20px 22px",marginBottom:14}}>
      <p style={{margin:0,fontFamily:MONO,fontSize:11,letterSpacing:"0.1em",color:faltan.length?WARN:OK}}>{faltan.length?`FALTAN ${faltan.length} DE ${reqs.length} PARA PUBLICAR`:"LISTA PARA PUBLICAR"}</p>
      <h3 style={{margin:"4px 0 14px",fontSize:17,fontWeight:800}}>{faltan.length?"Para publicar esta máquina falta:":"La ficha está completa."}</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"6px 18px"}}>
        {reqs.map(r=><div key={r.l} style={{display:"flex",alignItems:"center",gap:9,fontSize:13.5,fontWeight:r.ok?500:700,color:r.ok?GRIS:INK,textDecoration:r.ok?"line-through":"none"}}><span style={{width:20,height:20,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0,background:r.ok?OK_BG:BAD_BG,color:r.ok?OK:BAD}}>{r.ok?"✓":"✕"}</span>{r.l}</div>)}
      </div>
    </section>}

    <div style={{position:"sticky",bottom:0,background:BG,borderTop:`1px solid ${BORDE}`,margin:"0 -28px",padding:"14px 28px",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
      <Btn onClick={()=>guardar()} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn>
      {p.estado!=="publicado"&&<Btn kind="lima" onClick={()=>guardar("publicado")} disabled={guardando||faltan.length>0}>Publicar</Btn>}
      {p.estado==="publicado"&&<Btn onClick={()=>guardar("pausado")} disabled={guardando}>Pausar</Btn>}
      {faltan.length>0&&p.estado!=="publicado"&&<span style={{fontSize:12.5,color:GRIS}}>Faltan {faltan.length} puntos para publicar</span>}
    </div>
  </div>;
}
