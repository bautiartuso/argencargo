"use client";
// Catálogo: máquinas (carriles por categoría + ficha + canales y precios), proveedores y categorías.
// Publicar exige la ficha completa: la validación vive en la base (trigger cat_productos_validar)
// y acá se replica para mostrar el checklist antes de intentar.
import { useState, useEffect, useMemo, useRef } from "react";
import { comprimirImagen } from "../../../lib/img";
import { precioMaquina } from "../../../lib/catalogo-precio";
import { calcOpBudget } from "../../../lib/calc";
import { INK,GRIS,BORDE,SUAVE,CARD,BG,LIMA,LIMA_SUAVE,OK,OK_BG,WARN,WARN_BG,BAD,BAD_BG,MONO,INP,LBL,TH,TD,GRID,DOS,Campo,Inp,TA,Btn,Sec,Pill,Barra,Vacio,Desplegable,Archivo,Toggle,Solapas,n,numONull,txtONull,fmtUsd,fmtNum,codigoMaq,ChipMaq,toast,confirmDialog } from "./ui";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

// ── Tarjeta de máquina (carriles y grilla) ────────────────────────────────────────────────
function TarjetaMaq({p,nombreCat,onClick}){
  const foto=Array.isArray(p.fotos)&&p.fotos[0];
  return <button className="card" onClick={onClick} style={{textAlign:"left",background:CARD,border:`1px solid ${BORDE}`,borderRadius:16,padding:0,overflow:"hidden",cursor:"pointer",color:INK,transition:"all 150ms",width:"100%"}}>
    <div style={{aspectRatio:"4/3",background:SUAVE,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>{foto?<img src={foto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:12.5,color:GRIS}}>Sin fotos</span>}</div>
    <div style={{padding:"11px 13px 13px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontFamily:MONO,fontSize:11,fontWeight:600,color:GRIS,letterSpacing:"0.06em"}}>{codigoMaq(p)}</span><ChipMaq e={p.estado}/></div>
      <p style={{margin:"0 0 4px",fontSize:13.5,fontWeight:800,lineHeight:1.3,letterSpacing:"-0.01em",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",minHeight:35}}>{p.nombre||p.nombre_raw||<span style={{color:GRIS,fontWeight:600}}>Sin nombre</span>}</p>
      <p style={{margin:0,fontSize:12,color:GRIS}}>{p.exw_usd?`EXW ${fmtUsd(p.exw_usd)}`:nombreCat?nombreCat(p.subcategoria)||"Sin categoría":""}</p>
    </div>
  </button>;
}

export function Maquinas({ses,dq,token,cats,arbol,provs,setProvs,prods,antid,ajustes,tarifas,recargar}){
  const [sel,setSel]=useState(null);
  const [fEstado,setFEstado]=useState("todos");
  const [busq,setBusq]=useState("");
  const [verCats,setVerCats]=useState(false);
  const nombreCat=(slug)=>cats.find(c=>c.slug===slug)?.nombre||slug||"";
  const nuevo=async()=>{try{const r=await dq("cat_productos",{method:"POST",body:{estado:"borrador",created_by:ses.user?.id||null}});const p=Array.isArray(r)?r[0]:r;await recargar();setSel(p.id);}catch(e){toast(e.message,"error");}};
  const filtradas=prods.filter(p=>(fEstado==="todos"||p.estado===fEstado)&&(!busq.trim()||`${codigoMaq(p)} ${p.nombre||""} ${p.nombre_raw||""} ${p.modelo||""}`.toLowerCase().includes(busq.toLowerCase())));
  const cuenta=(e)=>prods.filter(p=>p.estado===e).length;
  const plano=busq.trim().length>0;
  const sinCat=filtradas.filter(p=>!p.categoria);

  if(sel)return <Editor key={sel} id={sel} dq={dq} token={token} cats={cats} arbol={arbol} provs={provs} antid={antid} ajustes={ajustes} tarifas={tarifas} recargar={recargar} onCerrar={()=>setSel(null)} onProvNuevo={(p)=>setProvs(x=>[...x,p].sort((a,b)=>a.fabrica.localeCompare(b.fabrica)))}/>;
  return <>
    <Barra>
      {!verCats&&[["todos","Todas",prods.length],["publicado","Publicadas",cuenta("publicado")],["borrador","Borradores",cuenta("borrador")],["pausado","Pausadas",cuenta("pausado")]].map(([k,l,c])=><Pill key={k} on={fEstado===k} onClick={()=>setFEstado(k)}>{l} <span style={{color:GRIS,fontFamily:MONO,fontSize:11}}>{c}</span></Pill>)}
      {!verCats&&<input placeholder="Buscar…" value={busq} onChange={e=>setBusq(e.target.value)} style={{...INP,flex:1,minWidth:180,borderRadius:999,padding:"10px 18px"}}/>}
      {verCats&&<span style={{flex:1}}/>}
      <Btn onClick={()=>setVerCats(v=>!v)}>{verCats?"← Máquinas":"Categorías"}</Btn>
      <Btn kind="lima" onClick={nuevo}>+ Nueva máquina</Btn>
    </Barra>
    {verCats?<Categorias arbol={arbol} prods={prods}/>
    :plano?(filtradas.length===0?<Vacio>Nada que coincida.</Vacio>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>{filtradas.map(p=><TarjetaMaq key={p.id} p={p} nombreCat={nombreCat} onClick={()=>setSel(p.id)}/>)}</div>)
    :<>
      {sinCat.length>0&&<Carril titulo="Sin categoría" sub={`${sinCat.length}`} lista={sinCat} nombreCat={nombreCat} onSel={setSel}/>}
      {arbol.map(c=>{const lista=filtradas.filter(p=>p.categoria===c.slug);return <Carril key={c.slug} titulo={c.nombre} sub={lista.length?String(lista.length):"sin máquinas"} lista={lista} nombreCat={nombreCat} onSel={setSel} subs={c.subs}/>;})}
    </>}
  </>;
}
function Carril({titulo,sub,lista,nombreCat,onSel,subs}){
  return <div style={{marginBottom:18}}>
    <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:8}}><h3 style={{margin:0,fontSize:16,fontWeight:800,letterSpacing:"-0.01em"}}>{titulo}</h3><span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>{sub}</span></div>
    {lista.length===0?<div style={{border:`1px dashed ${BORDE}`,borderRadius:14,padding:"18px 16px",fontSize:12.5,color:GRIS,display:"flex",gap:6,flexWrap:"wrap"}}>{(subs||[]).map(s=><span key={s.slug} style={{padding:"3px 9px",borderRadius:999,background:SUAVE}}>{s.nombre}</span>)}</div>
    :<div className="carril">{lista.map(p=><TarjetaMaq key={p.id} p={p} nombreCat={nombreCat} onClick={()=>onSel(p.id)}/>)}</div>}
  </div>;
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

// ── Proveedores: tarjetas + ficha con categorías y máquinas ───────────────────────────────
const PROV_VACIO={fabrica:"",ciudad:"",contacto:"",wechat:"",whatsapp:"",chat_plataforma:"",notas:"",categorias:[]};
export function ProveedorForm({q,setQ,arbol,onGuardar,onCancelar,guardando}){
  return <div>
    <div className="grid3" style={GRID}>
      <Campo label="Nombre de la fábrica" ob><Inp value={q.fabrica} onChange={e=>setQ(x=>({...x,fabrica:e.target.value}))}/></Campo>
      <Campo label="Ciudad" ob><Inp value={q.ciudad} onChange={e=>setQ(x=>({...x,ciudad:e.target.value}))}/></Campo>
      <Campo label="Persona de contacto" ob><Inp value={q.contacto} onChange={e=>setQ(x=>({...x,contacto:e.target.value}))}/></Campo>
      <Campo label="WeChat ID"><Inp value={q.wechat} onChange={e=>setQ(x=>({...x,wechat:e.target.value}))}/></Campo>
      <Campo label="WhatsApp"><Inp value={q.whatsapp} onChange={e=>setQ(x=>({...x,whatsapp:e.target.value}))}/></Campo>
      <Campo label="Chat de plataforma"><Inp value={q.chat_plataforma} onChange={e=>setQ(x=>({...x,chat_plataforma:e.target.value}))}/></Campo>
      <Campo label="Qué fabrica" span={3}><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{arbol.map(c=><Pill key={c.slug} small on={(q.categorias||[]).includes(c.slug)} onClick={()=>setQ(x=>({...x,categorias:(x.categorias||[]).includes(c.slug)?x.categorias.filter(s=>s!==c.slug):[...(x.categorias||[]),c.slug]}))}>{c.nombre}</Pill>)}</div></Campo>
      <Campo label="Notas" span={3}><Inp value={q.notas} onChange={e=>setQ(x=>({...x,notas:e.target.value}))}/></Campo>
    </div>
    <p style={{fontSize:12.5,color:GRIS,margin:"12px 0 14px"}}>Al menos uno entre WeChat, WhatsApp o chat de plataforma.</p>
    <div style={{display:"flex",gap:8}}><Btn kind="lima" onClick={onGuardar} disabled={guardando}>{q.id?"Guardar cambios":"Crear proveedor"}</Btn><Btn onClick={onCancelar}>Cancelar</Btn></div>
  </div>;
}
export async function guardarProveedor(dq,q,ses){
  if(!q.fabrica.trim()||!q.ciudad.trim()||!q.contacto.trim())throw new Error("Fábrica, ciudad y contacto son obligatorios");
  if(!q.wechat.trim()&&!q.whatsapp.trim()&&!q.chat_plataforma.trim())throw new Error("Cargá al menos una vía de contacto: WeChat, WhatsApp o chat de plataforma");
  const body={fabrica:q.fabrica.trim(),ciudad:q.ciudad.trim(),contacto:q.contacto.trim(),wechat:txtONull(q.wechat),whatsapp:txtONull(q.whatsapp),chat_plataforma:txtONull(q.chat_plataforma),notas:txtONull(q.notas),categorias:q.categorias||[]};
  if(q.id){const r=await dq("cat_proveedores",{method:"PATCH",filters:`?id=eq.${q.id}`,body});return Array.isArray(r)?r[0]:r;}
  const r=await dq("cat_proveedores",{method:"POST",body:{...body,created_by:ses?.user?.id||null}});return Array.isArray(r)?r[0]:r;
}
export function Proveedores({ses,dq,provs,prods,arbol,cats,recargar}){
  const [sel,setSel]=useState(null);
  const [form,setForm]=useState(null);
  const [busq,setBusq]=useState("");
  const [guardando,setGuardando]=useState(false);
  const nombreCat=(slug)=>cats.find(c=>c.slug===slug)?.nombre||slug;
  const maqs=(id)=>prods.filter(p=>p.proveedor_id===id);
  const guardar=async()=>{setGuardando(true);try{await guardarProveedor(dq,form,ses);await recargar();toast(form.id?"Proveedor actualizado":"Proveedor creado");setForm(null);}catch(e){toast(e.message,"error");}setGuardando(false);};
  const eliminar=async(p)=>{if(maqs(p.id).length){toast("Tiene máquinas asignadas: reasignalas antes","error");return;}if(!(await confirmDialog(`¿Eliminar ${p.fabrica}?`)))return;try{await dq("cat_proveedores",{method:"DELETE",filters:`?id=eq.${p.id}`,prefer:"return=minimal"});await recargar();setSel(null);toast("Eliminado");}catch(e){toast(e.message,"error");}};
  const lista=provs.filter(p=>!busq.trim()||`${p.fabrica} ${p.ciudad} ${p.contacto} ${(p.categorias||[]).map(nombreCat).join(" ")}`.toLowerCase().includes(busq.toLowerCase()));

  if(form)return <><div style={{display:"flex",alignItems:"center",gap:12,margin:"0 0 22px"}}><Btn small onClick={()=>setForm(null)}>← Proveedores</Btn><span style={{fontWeight:800,fontSize:15}}>{form.id?"Editar proveedor":"Nuevo proveedor"}</span></div><Sec><ProveedorForm q={form} setQ={setForm} arbol={arbol} onGuardar={guardar} onCancelar={()=>setForm(null)} guardando={guardando}/></Sec></>;
  const p=sel?provs.find(x=>x.id===sel):null;
  if(p)return <>
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"0 0 22px"}}><Btn small onClick={()=>setSel(null)}>← Proveedores</Btn><span style={{fontWeight:800,fontSize:18}}>{p.fabrica}</span><span style={{color:GRIS,fontSize:13.5}}>{p.ciudad}</span><span style={{flex:1}}/><Btn small onClick={()=>setForm({...PROV_VACIO,...p,wechat:p.wechat||"",whatsapp:p.whatsapp||"",chat_plataforma:p.chat_plataforma||"",notas:p.notas||"",categorias:p.categorias||[]})}>Editar</Btn><Btn small kind="danger" onClick={()=>eliminar(p)}>Eliminar</Btn></div>
    <div className="dos" style={DOS}>
      <Sec titulo="Contacto">
        <div style={{display:"grid",gap:10,fontSize:14}}>
          <div><p style={{...LBL,marginBottom:2}}>Persona</p><b>{p.contacto}</b></div>
          <div><p style={{...LBL,marginBottom:2}}>WeChat</p>{p.wechat?<b style={{fontFamily:MONO}}>{p.wechat}</b>:<span style={{color:GRIS}}>—</span>}</div>
          <div><p style={{...LBL,marginBottom:2}}>WhatsApp</p>{p.whatsapp?<a href={`https://wa.me/${String(p.whatsapp).replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{color:INK,fontWeight:700,fontFamily:MONO}}>{p.whatsapp}</a>:<span style={{color:GRIS}}>—</span>}</div>
          <div><p style={{...LBL,marginBottom:2}}>Chat de plataforma</p>{p.chat_plataforma?<b>{p.chat_plataforma}</b>:<span style={{color:GRIS}}>—</span>}</div>
          {p.notas&&<div><p style={{...LBL,marginBottom:2}}>Notas</p><span>{p.notas}</span></div>}
        </div>
      </Sec>
      <Sec titulo="Qué fabrica">
        {(p.categorias||[]).length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Sin categorías asignadas.</p>:<div style={{display:"flex",flexWrap:"wrap",gap:6}}>{(p.categorias||[]).map(s=><span key={s} style={{fontSize:12.5,fontWeight:700,padding:"5px 11px",borderRadius:999,background:LIMA_SUAVE}}>{nombreCat(s)}</span>)}</div>}
      </Sec>
    </div>
    <Sec titulo="Máquinas de este proveedor" extra={<span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>{maqs(p.id).length}</span>}>
      {maqs(p.id).length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Todavía no tiene máquinas cargadas.</p>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>{maqs(p.id).map(m=><TarjetaMaq key={m.id} p={m} nombreCat={nombreCat}/>)}</div>}
    </Sec>
  </>;
  const Tarjeta=({p})=><button className="card" onClick={()=>setSel(p.id)} style={{textAlign:"left",background:CARD,border:`1px solid ${BORDE}`,borderRadius:16,padding:"14px 16px",cursor:"pointer",color:INK,transition:"all 150ms",width:"100%",height:"100%"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:8}}><p style={{margin:0,fontSize:14.5,fontWeight:800,letterSpacing:"-0.01em",lineHeight:1.25}}>{p.fabrica}</p><span style={{fontFamily:MONO,fontSize:11,color:GRIS,whiteSpace:"nowrap"}}>{maqs(p.id).length} máq.</span></div>
    <p style={{margin:"3px 0 8px",fontSize:12.5,color:GRIS}}>{p.ciudad} · {p.contacto}</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{(p.categorias||[]).slice(0,3).map(s=><span key={s} style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:999,background:LIMA_SUAVE}}>{nombreCat(s)}</span>)}{(p.categorias||[]).length>3&&<span style={{fontSize:11,color:GRIS}}>+{(p.categorias||[]).length-3}</span>}</div>
  </button>;
  const plano=busq.trim().length>0;
  const sinRubro=lista.filter(p=>!(p.categorias||[]).length);
  return <>
    <Barra><input placeholder="Buscar fábrica, ciudad, contacto o rubro…" value={busq} onChange={e=>setBusq(e.target.value)} style={{...INP,flex:1,minWidth:200,borderRadius:999,padding:"10px 18px"}}/><Btn kind="lima" onClick={()=>setForm({...PROV_VACIO})}>+ Nuevo proveedor</Btn></Barra>
    {provs.length===0?<Vacio>Todavía no hay proveedores.</Vacio>
    :plano?(lista.length===0?<Vacio>Nada que coincida.</Vacio>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>{lista.map(p=><Tarjeta key={p.id} p={p}/>)}</div>)
    :<>
      {sinRubro.length>0&&<div style={{marginBottom:18}}><div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:8}}><h3 style={{margin:0,fontSize:16,fontWeight:800}}>Sin rubro</h3><span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>{sinRubro.length}</span></div><div className="carril">{sinRubro.map(p=><Tarjeta key={p.id} p={p}/>)}</div></div>}
      {arbol.map(c=>{const del=lista.filter(p=>(p.categorias||[]).includes(c.slug));return <div key={c.slug} style={{marginBottom:18}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:8}}><h3 style={{margin:0,fontSize:16,fontWeight:800}}>{c.nombre}</h3><span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>{del.length?del.length:"sin proveedores"}</span></div>
        {del.length===0?<div style={{border:`1px dashed ${BORDE}`,borderRadius:14,padding:"14px 16px",fontSize:12.5,color:GRIS}}>Todavía no hay fábricas de este rubro.</div>:<div className="carril">{del.map(p=><Tarjeta key={p.id} p={p}/>)}</div>}
      </div>;})}
    </>}
  </>;
}

// ── Ficha de una máquina ──────────────────────────────────────────────────────────────────
const BULTO=()=>({cantidad:"1",largo_cm:"",ancho_cm:"",alto_cm:"",peso_kg:""});
const VACIO={nombre_raw:"",modelo:"",specs_raw:"",descripcion_raw:"",nombre:"",descripcion:"",categoria:"",subcategoria:"",condicion:"nueva",anio:"",horas_uso:"",garantia_meses:"",fotos:[],video_url:"",exw_usd:"",moq:"1",dias_produccion:"",packing:[BULTO()],ncm_code:"",ncm_descripcion:"",die:"",te:"",iva:"",intervencion:null,proveedor_id:"",link_producto:"",notas_internas:""};

function Editor({id,dq,token,cats,arbol,provs,antid,ajustes,tarifas,recargar,onCerrar,onProvNuevo}){
  const [p,setP]=useState(null);
  const [f,setF]=useState(VACIO);
  const [dirty,setDirty]=useState(false);
  const [guardando,setGuardando]=useState(false);
  const [ia,setIa]=useState(false);
  const [ncmIa,setNcmIa]=useState(false);
  const [subiendo,setSubiendo]=useState(0);
  const [provForm,setProvForm]=useState(null);
  const [paso,setPaso]=useState("ficha"); // ficha | canales
  const fRef=useRef(f);fRef.current=f;

  const cargarP=async()=>{try{
    const r=await dq("cat_productos",{filters:`?id=eq.${id}&select=*`});const row=Array.isArray(r)?r[0]:null;if(!row){toast("No se encontró la máquina","error");onCerrar();return;}
    setP(row);
    const s=(v)=>v==null?"":String(v);
    const pk=Array.isArray(row.packing)&&row.packing.length?row.packing.map(b=>({cantidad:s(b.cantidad||1),largo_cm:s(b.largo_cm),ancho_cm:s(b.ancho_cm),alto_cm:s(b.alto_cm),peso_kg:s(b.peso_kg)})):[BULTO()];
    setF({...VACIO,nombre_raw:s(row.nombre_raw),modelo:s(row.modelo),specs_raw:s(row.specs_raw),descripcion_raw:s(row.descripcion_raw),nombre:s(row.nombre),descripcion:s(row.descripcion),categoria:s(row.categoria),subcategoria:s(row.subcategoria),condicion:row.condicion||"nueva",anio:s(row.anio),horas_uso:s(row.horas_uso),garantia_meses:s(row.garantia_meses),fotos:Array.isArray(row.fotos)?row.fotos:[],video_url:s(row.video_url),exw_usd:s(row.exw_usd),moq:row.moq?String(row.moq):"1",dias_produccion:s(row.dias_produccion),packing:pk,ncm_code:s(row.ncm_code),ncm_descripcion:s(row.ncm_descripcion),die:s(row.die),te:s(row.te),iva:s(row.iva),intervencion:row.intervencion||null,proveedor_id:s(row.proveedor_id),link_producto:s(row.link_producto),notas_internas:s(row.notas_internas)});
  }catch(e){toast(e.message,"error");}};
  useEffect(()=>{cargarP();},[id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    {l:"Canales y precios definidos",ok:!!(p?.canales&&Object.values(p.canales).some(c=>c?.mostrar))},
  ];},[f,p]);
  const faltan=reqs.filter(r=>!r.ok);
  const listaParaCanales=n(f.exw_usd)>0&&f.packing.length>0&&!f.packing.some(b=>n(b.largo_cm)<=0||n(b.ancho_cm)<=0||n(b.alto_cm)<=0||n(b.peso_kg)<=0)&&!!f.ncm_code.trim();

  const cuerpo=(estado)=>({
    estado:estado||p.estado,
    nombre_raw:txtONull(f.nombre_raw),modelo:txtONull(f.modelo),specs_raw:txtONull(f.specs_raw),descripcion_raw:txtONull(f.descripcion_raw),
    nombre:txtONull(f.nombre),descripcion:txtONull(f.descripcion),categoria:txtONull(f.categoria),subcategoria:txtONull(f.subcategoria),
    condicion:f.condicion,anio:numONull(f.anio),horas_uso:numONull(f.horas_uso),garantia_meses:numONull(f.garantia_meses),fotos:f.fotos,video_url:txtONull(f.video_url),
    exw_usd:numONull(f.exw_usd),moq:numONull(f.moq)||1,dias_produccion:numONull(f.dias_produccion),
    packing:f.packing.map(b=>({cantidad:n(b.cantidad),largo_cm:n(b.largo_cm),ancho_cm:n(b.ancho_cm),alto_cm:n(b.alto_cm),peso_kg:n(b.peso_kg)})),
    ncm_code:txtONull(f.ncm_code),ncm_descripcion:txtONull(f.ncm_descripcion),die:numONull(f.die),te:numONull(f.te),iva:numONull(f.iva),intervencion:f.intervencion||null,antidumping:ad?{prefix:ad.ncm_prefix,producto:ad.producto,medida_tipo:ad.medida_tipo,valor:ad.valor,unidad:ad.unidad,resolucion:ad.resolucion}:null,
    proveedor_id:f.proveedor_id||null,link_producto:txtONull(f.link_producto),notas_internas:txtONull(f.notas_internas),
  });
  const guardar=async(estado,irCanales)=>{setGuardando(true);try{
    const r=await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:cuerpo(estado)});
    const row=Array.isArray(r)?r[0]:null;if(row)setP(row);setDirty(false);await recargar();
    toast(estado==="publicado"?"Publicada en el catálogo":estado==="pausado"?"Pausada":"Guardado");
    if(irCanales)setPaso("canales");
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
  const borrarArchivo=(u)=>{const path=u.split("/object/public/catalogo/")[1];if(path)fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"DELETE",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`}}).catch(()=>{});};
  const quitarFoto=async(u)=>{const fotos=f.fotos.filter(x=>x!==u);setF(x=>({...x,fotos}));borrarArchivo(u);await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{fotos}}).catch(e=>toast(e.message,"error"));};
  const principal=async(u)=>{const fotos=[u,...f.fotos.filter(x=>x!==u)];setF(x=>({...x,fotos}));await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{fotos}}).catch(e=>toast(e.message,"error"));};
  const quitarVideo=async()=>{const u=f.video_url;setF(x=>({...x,video_url:""}));if(u)borrarArchivo(u);await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${id}`,body:{video_url:null}}).catch(e=>toast(e.message,"error"));};
  const [guardandoProv,setGuardandoProv]=useState(false);
  const guardarProv=async()=>{setGuardandoProv(true);try{const row=await guardarProveedor(dq,provForm,{user:{id:p?.created_by}});if(provForm.id){await recargar();toast("Proveedor actualizado");}else{onProvNuevo(row);set("proveedor_id",row.id);toast("Proveedor creado");}setProvForm(null);}catch(e){toast(e.message,"error");}setGuardandoProv(false);};

  if(!p)return <p style={{color:GRIS}}>Cargando…</p>;
  if(paso==="canales")return <Canales p={p} f={f} dq={dq} ajustes={ajustes} tarifas={tarifas} onVolver={async()=>{await cargarP();await recargar();setPaso("ficha");}}/>;
  const totKg=f.packing.reduce((s,b)=>s+n(b.peso_kg)*(n(b.cantidad)||1),0);
  const totM3=f.packing.reduce((s,b)=>s+(n(b.largo_cm)*n(b.ancho_cm)*n(b.alto_cm)/1e6)*(n(b.cantidad)||1),0);
  const verificado=p.precio_verificado_at?Math.floor((Date.now()-new Date(p.precio_verificado_at))/864e5):null;
  const pv=(x)=>x==null?null:String(x).replace(".",",");
  const canalesOk=!!(p.canales&&Object.values(p.canales).some(c=>c?.mostrar));

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
      <div style={{marginTop:16}}><Btn kind="lima" onClick={completarIA} disabled={ia}>{ia?"Redactando…":"✦ Completar con IA"}</Btn></div>
      <div className="grid3" style={{...GRID,marginTop:22,paddingTop:22,borderTop:`1px solid ${BORDE}`}}>
        <Campo label="Nombre comercial" ob span={3}><Inp value={f.nombre} onChange={e=>set("nombre",e.target.value)} style={{fontSize:16,fontWeight:800}}/></Campo>
        <Campo label="Descripción" ob span={3}><TA value={f.descripcion} onChange={e=>set("descripcion",e.target.value)} style={{minHeight:180}}/></Campo>
        <Campo label="Categoría" ob><Desplegable value={f.categoria} onChange={v=>{set("categoria",v);set("subcategoria","");}} opciones={arbol.map(c=>({v:c.slug,l:c.nombre}))}/></Campo>
        <Campo label="Subcategoría" ob><Desplegable value={f.subcategoria} onChange={v=>set("subcategoria",v)} opciones={subs.map(s=>({v:s.slug,l:s.nombre}))} disabled={!f.categoria}/></Campo>
        <Campo label="Garantía de fábrica (meses)"><Inp type="number" value={f.garantia_meses} onChange={e=>set("garantia_meses",e.target.value)}/></Campo>
        <Campo label="Condición" ob><div style={{display:"flex",gap:8}}><Pill on={f.condicion==="nueva"} onClick={()=>set("condicion","nueva")}>Nueva</Pill><Pill on={f.condicion==="usada"} onClick={()=>set("condicion","usada")}>Usada</Pill></div></Campo>
        {f.condicion==="usada"&&<><Campo label="Año" ob><Inp type="number" value={f.anio} onChange={e=>set("anio",e.target.value)}/></Campo><Campo label="Horas de uso"><Inp type="number" value={f.horas_uso} onChange={e=>set("horas_uso",e.target.value)}/></Campo></>}
      </div>
    </Sec>

    <Sec titulo="Fotos y video" extra={<span style={{fontFamily:MONO,fontSize:11,color:f.fotos.length>=5?OK:GRIS}}>{f.fotos.length}/5 FOTOS{f.fotos.length>=5?" ✓":""}</span>}>
      {f.fotos.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:12}}>
        {f.fotos.map((u,i)=><div key={u} style={{position:"relative",aspectRatio:"1",borderRadius:12,overflow:"hidden",border:`2px solid ${i===0?LIMA:"transparent"}`,background:SUAVE}}>
          <img src={u} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          {i===0&&<span style={{position:"absolute",top:7,left:7,fontFamily:MONO,fontSize:9,fontWeight:600,letterSpacing:"0.08em",padding:"3px 7px",borderRadius:5,background:LIMA,color:"var(--mq-lima-ink)"}}>PRINCIPAL</span>}
          <div style={{position:"absolute",bottom:0,left:0,right:0,display:"flex",gap:4,padding:6,background:"linear-gradient(transparent,rgba(0,0,0,0.65))"}}>
            {i>0&&<button type="button" onClick={()=>principal(u)} title="Hacer principal" style={{flex:1,fontSize:11,fontWeight:700,padding:"5px 0",borderRadius:6,border:"none",background:"rgba(255,255,255,0.9)",color:"#121212",cursor:"pointer"}}>★</button>}
            <button type="button" onClick={()=>quitarFoto(u)} title="Quitar" style={{flex:1,fontSize:11,fontWeight:700,padding:"5px 0",borderRadius:6,border:"none",background:"rgba(255,255,255,0.9)",color:"#C22F2F",cursor:"pointer"}}>✕</button>
          </div>
        </div>)}
      </div>}
      <Archivo onFiles={subir} accept="image/*,video/*" multiple label={subiendo>0?`Subiendo ${subiendo}…`:"+ Fotos o video"} hint="Arrastrá acá, pegá con Ctrl+V o elegí del equipo"/>
      {f.video_url&&<div style={{marginTop:14,display:"flex",gap:14,alignItems:"start",flexWrap:"wrap"}}><video src={f.video_url} controls style={{width:280,maxWidth:"100%",borderRadius:12,background:"#000"}}/><Btn small kind="danger" onClick={quitarVideo}>Quitar video</Btn></div>}
    </Sec>

    <Sec titulo="Precio y plazo">
      <div className="grid3" style={GRID}>
        <Campo label="Valor EXW (USD)" ob hint={verificado!=null?`Verificado hace ${verificado} día${verificado===1?"":"s"}`:null}><Inp type="number" step="0.01" value={f.exw_usd} onChange={e=>set("exw_usd",e.target.value)}/></Campo>
        <Campo label="Días de producción" ob><Inp type="number" value={f.dias_produccion} onChange={e=>set("dias_produccion",e.target.value)}/></Campo>
        <Campo label="Cantidad mínima (MOQ)"><Inp type="number" value={f.moq} onChange={e=>set("moq",e.target.value)}/></Campo>
      </div>
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
        <Btn kind="lima" onClick={clasificar} disabled={ncmIa}>{ncmIa?"Clasificando…":"✦ Clasificar con IA"}</Btn>
      </div>
      {f.ncm_code&&<div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        {[["Derechos (DIE)",f.die],["Tasa estadística",f.te],["IVA",f.iva]].map(([l,v])=><div key={l} style={{background:SUAVE,borderRadius:14,padding:"12px 14px"}}><p style={{...LBL,marginBottom:4}}>{l}</p><p style={{margin:0,fontSize:22,fontWeight:800,letterSpacing:"-0.02em"}}>{v!==""&&v!=null?`${pv(v)} %`:"—"}</p></div>)}
        {f.ncm_descripcion&&<p style={{gridColumn:"1 / -1",margin:0,fontSize:13,color:GRIS}}>{f.ncm_descripcion}</p>}
        {ad&&<div style={{gridColumn:"1 / -1",background:BAD_BG,borderRadius:14,padding:"12px 14px"}}><p style={{margin:0,fontFamily:MONO,fontSize:11,fontWeight:600,color:BAD,letterSpacing:"0.08em"}}>⚠ ANTIDUMPING · {String(ad.producto||"").toUpperCase()}</p><p style={{margin:"4px 0 0",fontSize:13.5}}>{ad.medida_tipo==="valor_minimo"?`Valor mínimo de exportación ${fmtUsd(ad.valor)}${ad.unidad?` por ${ad.unidad}`:""}`:ad.valor!=null?`${ad.medida_tipo||"Derecho"}: ${pv(ad.valor)}${ad.unidad?` ${ad.unidad}`:" %"}`:ad.medida_tipo||""}{ad.resolucion?` · ${ad.resolucion}`:""}{ad.nota?` · ${ad.nota}`:""}</p></div>}
        {f.intervencion?.required&&<div style={{gridColumn:"1 / -1",background:WARN_BG,borderRadius:14,padding:"12px 14px"}}><p style={{margin:0,fontFamily:MONO,fontSize:11,fontWeight:600,color:WARN,letterSpacing:"0.08em"}}>⚠ INTERVENCIÓN · {(f.intervencion.types||[]).join(" · ")||"ORGANISMO"}</p>{f.intervencion.reason&&<p style={{margin:"4px 0 0",fontSize:13.5}}>{f.intervencion.reason}</p>}</div>}
        {f.intervencion&&!f.intervencion.required&&!ad&&<p style={{gridColumn:"1 / -1",margin:0,fontSize:13,fontWeight:700,color:OK}}>Sin intervención de organismos ni antidumping.</p>}
      </div>}
    </Sec>

    <Sec titulo="Proveedor">
      <div className="grid3" style={GRID}>
        <Campo label="Fábrica" ob span={2}><Desplegable value={f.proveedor_id} onChange={v=>set("proveedor_id",v)} opciones={provs.map(x=>({v:x.id,l:x.fabrica,sub:x.ciudad}))} placeholder="Elegir proveedor…"/></Campo>
        <div style={{display:"flex",gap:8,alignItems:"end"}}><Btn onClick={()=>setProvForm({...PROV_VACIO})}>+ Nuevo proveedor</Btn>{prov&&<Btn onClick={()=>setProvForm({...PROV_VACIO,...prov,wechat:prov.wechat||"",whatsapp:prov.whatsapp||"",chat_plataforma:prov.chat_plataforma||"",notas:prov.notas||"",categorias:prov.categorias||[]})}>Editar</Btn>}</div>
        {prov&&!provForm&&<div style={{gridColumn:"1 / -1",fontSize:13.5,display:"flex",gap:16,flexWrap:"wrap",background:SUAVE,borderRadius:14,padding:"12px 14px"}}><span>📍 {prov.ciudad}</span><span>👤 {prov.contacto}</span>{prov.wechat&&<span>WeChat <b>{prov.wechat}</b></span>}{prov.whatsapp&&<span>WhatsApp <b>{prov.whatsapp}</b></span>}{prov.chat_plataforma&&<span>Chat <b>{prov.chat_plataforma}</b></span>}{prov.notas&&<span style={{color:GRIS}}>{prov.notas}</span>}</div>}
        {provForm&&<div style={{gridColumn:"1 / -1",background:SUAVE,borderRadius:16,padding:18}}><p style={{margin:"0 0 14px",fontSize:15,fontWeight:800}}>{provForm.id?"Editar proveedor":"Nuevo proveedor"}</p><ProveedorForm q={provForm} setQ={setProvForm} arbol={arbol} onGuardar={guardarProv} onCancelar={()=>setProvForm(null)} guardando={guardandoProv}/></div>}
        <Campo label="Link del producto" ob span={3}><Inp value={f.link_producto} onChange={e=>set("link_producto",e.target.value)}/></Campo>
        <Campo label="Notas internas" span={3}><TA value={f.notas_internas} onChange={e=>set("notas_internas",e.target.value)} style={{minHeight:72}}/></Campo>
      </div>
    </Sec>

    <Sec titulo="Canales y precios" extra={canalesOk?<span style={{fontFamily:MONO,fontSize:11,color:OK}}>DEFINIDOS ✓</span>:<span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>PENDIENTE</span>}>
      <p style={{margin:"0 0 12px",fontSize:13.5,color:GRIS}}>El paso siguiente: con el EXW, el packing y la NCM se calculan los costos de Argencargo por cada vía y se le asigna la gestión a cada una.</p>
      <Btn kind={listaParaCanales?"lima":"ghost"} disabled={!listaParaCanales||guardando} onClick={()=>guardar(undefined,true)}>{canalesOk?"Ver / editar canales →":"Calcular canales →"}</Btn>
      {!listaParaCanales&&<span style={{marginLeft:10,fontSize:12.5,color:GRIS}}>Faltan EXW, packing completo o NCM.</span>}
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

// ── Canales y precios: costos de Argencargo por vía + gestión por vía ─────────────────────
// Regla de Bautista (20/09/2026): se muestran SIEMPRE las tres vías con sus números; si una no se
// puede ofrecer, se explica por qué, pero no se esconde. Quien carga decide cuáles ve el cliente.
// El cliente nunca ve "LCL/FCL" ni "Integral": ve "vía aérea" y "vía marítima", así que como
// mucho una de las dos marítimas puede estar visible.
const VIAS=[
  {k:"aereo",l:"Aéreo Courier Comercial",sub:"7-10 días",channel:"aereo_blanco"},
  {k:"maritimo_lcl",l:"Marítimo Carga LCL/FCL",sub:"60-70 días",channel:"maritimo_blanco"},
  {k:"maritimo_integral",l:"Marítimo Integral",sub:"60-70 días · impuestos incluidos",channel:"maritimo_negro"},
];
function Canales({p,f,dq,ajustes,tarifas,onVolver}){
  const inicial=()=>{const c=p.canales||{};return Object.fromEntries(VIAS.map(v=>[v.k,{mostrar:!!c[v.k]?.mostrar,gestion_pct:c[v.k]?.gestion_pct!=null?String(c[v.k].gestion_pct):"",gestion_usd:c[v.k]?.gestion_usd!=null?String(c[v.k].gestion_usd):""}]));};
  const [cfg,setCfg]=useState(inicial);
  const [guardando,setGuardando]=useState(false);
  const items=[{description:f.nombre||f.nombre_raw||"Máquina",unit_price_usd:n(f.exw_usd),quantity:1,import_duty_rate:n(f.die),statistics_rate:n(f.te),iva_rate:f.iva!==""?n(f.iva):21,iva_additional_rate:20,iigg_rate:6,iibb_rate:5,ncm_code:f.ncm_code||null,package_ids:f.packing.map((_,i)=>i)}];
  const pks=f.packing.map((b,i)=>({id:i,quantity:n(b.cantidad,1),gross_weight_kg:n(b.peso_kg),length_cm:n(b.largo_cm),width_cm:n(b.ancho_cm),height_cm:n(b.alto_cm)}));
  const totCBM=pks.reduce((s,b)=>s+(b.length_cm*b.width_cm*b.height_cm/1e6)*b.quantity,0);
  const pesado=pks.some(b=>b.gross_weight_kg>45);
  const cliente=tarifas?.cliente||{tax_condition:"responsable_inscripto"};
  const calc=useMemo(()=>VIAS.map(v=>{
    let r=null,err=null;
    try{r=calcOpBudget({channel:v.channel,origin:"China",shipping_to_door:false,shipping_cost:0,has_battery:false,has_phones:false},items,pks,tarifas?.tariffs||[],tarifas?.config||{},tarifas?.overrides||[],cliente);}catch(e){err=e.message;}
    const motivos=[];
    if(v.k==="aereo"&&pesado)motivos.push({t:"Hay bultos de más de 45 kg: el courier comercial no los acepta.",bloquea:true});
    if(v.k==="maritimo_lcl"&&totCBM<0.5)motivos.push({t:`Cubica ${totCBM.toFixed(3).replace(".",",")} m³, menos de 0,5 m³: LCL/FCL no se ofrece para una sola máquina (factura mínimo 1 m³).`,bloquea:true});
    if(v.k==="maritimo_lcl"&&totCBM>=0.5&&totCBM<1)motivos.push({t:"Factura mínimo 1 m³.",bloquea:false});
    if(!tarifas?.tariffs?.length)motivos.push({t:"Sin tarifas cargadas de Argencargo.",bloquea:true});
    const bloqueada=!r||!!err||motivos.some(m=>m.bloquea);
    return {...v,r,err,motivos,bloqueada};
  }),[f.exw_usd,f.packing,f.die,f.te,f.iva,tarifas]); // eslint-disable-line react-hooks/exhaustive-deps
  // Precio en pesos: mismo dólar que ve el cliente en la web (blue venta + 5).
  const [tc,setTc]=useState(null);
  useEffect(()=>{let vivo=true;fetch("/api/argenmaq/dolar").then(r=>r.json()).then(d=>{if(vivo&&d?.tc)setTc(Number(d.tc));}).catch(()=>{});return()=>{vivo=false;};},[]);
  const setC=(k,campo,v)=>setCfg(x=>{const nx={...x,[k]:{...x[k],[campo]:v}};if(campo==="mostrar"&&v&&k!=="aereo"){const otra=k==="maritimo_lcl"?"maritimo_integral":"maritimo_lcl";nx[otra]={...nx[otra],mostrar:false};}return nx;});
  // El interruptor no puede quedar prendido en una vía que no se puede ofrecer (courier con
  // bultos de más de 45 kg, LCL que no llega al mínimo, sin tarifas): se apaga solo.
  useEffect(()=>{const bloq=calc.filter(v=>v.bloqueada).map(v=>v.k);if(!bloq.length)return;
    setCfg(x=>{let cambio=false;const nx={...x};for(const k of bloq){if(nx[k]?.mostrar){nx[k]={...nx[k],mostrar:false};cambio=true;}}return cambio?nx:x;});
  },[calc]);
  const precioDe=(v)=>{const c=cfg[v.k];const arg=v.r?n(v.r.totalAbonar):0;const r=precioMaquina({exwUnit:n(f.exw_usd),qty:1,ajustes,gestionPct:c.gestion_pct.trim()!==""?c.gestion_pct:(p.markup_pct??null),gestionUsd:c.gestion_usd.trim()!==""?c.gestion_usd:null,importacion:arg});return {exw:r.exw,financiero:r.financiero,gestion:r.gestion,base:r.base,maquina:r.precio,argencargo:arg,total:r.total};};
  const guardar=async()=>{setGuardando(true);try{
    const canales=Object.fromEntries(calc.map(v=>{const c=cfg[v.k];const pr=precioDe(v);return [v.k,{mostrar:!!c.mostrar,gestion_pct:c.gestion_pct.trim()===""?null:n(c.gestion_pct),gestion_usd:c.gestion_usd.trim()===""?null:n(c.gestion_usd),argencargo:v.r?{flete:n(v.r.flete),seguro:n(v.r.seguro),sobrepeso:n(v.r.overweightSurcharge),impuestos:n(v.r.totalTax),recargo:n(v.r.surcharge),total:n(v.r.totalAbonar),unidad:v.r.fleteAmt}:null,precio:pr,motivos:v.motivos,calculado_at:new Date().toISOString()}];}));
    await dq("cat_productos",{method:"PATCH",filters:`?id=eq.${p.id}`,body:{canales}});toast("Canales guardados");await onVolver();
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const pv=(x)=>String(x).replace(".",",");
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"0 0 18px"}}><Btn small onClick={onVolver}>← Ficha</Btn><span style={{fontFamily:MONO,fontSize:13,fontWeight:600,letterSpacing:"0.08em"}}>{codigoMaq(p)}</span><span style={{fontWeight:800}}>{f.nombre||f.nombre_raw}</span><span style={{flex:1}}/><span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>EXW {fmtUsd(f.exw_usd)} · {totCBM.toFixed(3).replace(".",",")} M³ · {pks.reduce((s,b)=>s+b.gross_weight_kg*b.quantity,0)} KG</span></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14,marginBottom:14}}>
      {calc.map(v=>{const c=cfg[v.k];const pr=precioDe(v);const r=v.r;
        const fila=(l,val,st={})=><><span style={{color:GRIS,...(st.l||{})}}>{l}</span><span style={{fontFamily:MONO,textAlign:"right",...(st.v||{})}}>{val}</span></>;
        return <Sec key={v.k} style={{marginBottom:0,borderColor:c.mostrar?LIMA:BORDE,display:"flex",flexDirection:"column"}}>
        {/* Título centrado, con alto fijo para que las tres tarjetas arranquen parejas */}
        <div style={{textAlign:"center",minHeight:58,borderBottom:`1px solid ${BORDE}`,paddingBottom:12,marginBottom:12}}>
          <p style={{margin:0,fontSize:16,fontWeight:800}}>{v.l}</p>
          <p style={{margin:"2px 0 0",fontSize:12.5,color:GRIS}}>{v.sub}</p>
        </div>
        {v.err&&<p style={{color:BAD,fontSize:12.5,margin:"0 0 12px"}}>No se pudo calcular: {v.err}</p>}
        {/* Costo de Argencargo: un solo número, sin desglose */}
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"5px 12px",fontSize:13.5,marginBottom:12}}>
          {fila("Costo de importación",fmtUsd(pr.argencargo),{l:{fontWeight:700,color:INK},v:{fontWeight:800}})}
        </div>
        {/* Qué compone el costo de la operación (la base sobre la que se cobra la gestión) */}
        <div style={{background:SUAVE,borderRadius:12,padding:"10px 12px",display:"grid",gridTemplateColumns:"1fr auto",gap:"4px 12px",fontSize:12.5,marginBottom:12}}>
          {fila("Máquina (EXW)",fmtUsd(pr.exw))}
          {fila("Costo financiero",fmtUsd(pr.financiero))}
          {fila("Importación",fmtUsd(pr.argencargo))}
          {fila("Costo de operación",fmtUsd(pr.base),{l:{fontWeight:800,color:INK,borderTop:`1px solid ${BORDE}`,paddingTop:6},v:{fontWeight:800,borderTop:`1px solid ${BORDE}`,paddingTop:6}})}
        </div>
        {/* Gestión: porcentaje o monto fijo, con la "o" entre las dos */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 20px 1fr",gap:8,alignItems:"end",marginBottom:10}}>
          <div style={{minWidth:0}}>
            <label style={{display:"block",textAlign:"center",fontFamily:MONO,fontSize:10.5,letterSpacing:"0.08em",textTransform:"uppercase",color:GRIS,marginBottom:5}}>Gestión (%)</label>
            <Inp type="number" step="0.5" value={c.gestion_pct} onChange={e=>setC(v.k,"gestion_pct",e.target.value)} placeholder={String(p.markup_pct??ajustes.gestion_pct)} style={{textAlign:"center"}}/>
          </div>
          <span style={{textAlign:"center",fontSize:12,color:GRIS,paddingBottom:12}}>o</span>
          <div style={{minWidth:0}}>
            <label style={{display:"block",textAlign:"center",fontFamily:MONO,fontSize:10.5,letterSpacing:"0.08em",textTransform:"uppercase",color:GRIS,marginBottom:5}}>Costo fijo (USD)</label>
            <Inp type="number" value={c.gestion_usd} onChange={e=>setC(v.k,"gestion_usd",e.target.value)} placeholder="—" style={{textAlign:"center"}}/>
          </div>
        </div>
        {/* Precio final al cliente, en dólares y en pesos al blue + 5 */}
        <div style={{background:SUAVE,borderRadius:12,padding:"12px",marginBottom:12,textAlign:"center"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"4px 12px",fontSize:12.5,textAlign:"left",marginBottom:10}}>
            {fila("Gestión",fmtUsd(pr.gestion))}
          </div>
          <p style={{margin:0,fontFamily:MONO,fontSize:10.5,letterSpacing:"0.08em",textTransform:"uppercase",color:GRIS}}>Precio de venta al cliente</p>
          <p style={{margin:"4px 0 0",fontFamily:MONO,fontSize:22,fontWeight:800,lineHeight:1.1}}>{fmtUsd(pr.total)}</p>
          <p style={{margin:"3px 0 0",fontFamily:MONO,fontSize:13,color:GRIS}}>{tc?`≈ ARS ${Math.round(pr.total*tc).toLocaleString("es-AR")}`:"≈ ARS —"}</p>
        </div>
        <div style={{flex:1}}/>
        <Toggle on={c.mostrar} disabled={v.bloqueada} onChange={val=>setC(v.k,"mostrar",val)} l={v.bloqueada?"No se puede ofrecer":(c.mostrar?"Se muestra al cliente":"Oculta para el cliente")} sub={v.k==="aereo"?"El cliente la ve como “vía aérea”":"El cliente la ve como “vía marítima” (solo una de las dos)"}/>
        {/* Las advertencias van al final: primero el número, después por qué no se puede ofrecer */}
        {v.motivos.length>0&&<div style={{background:WARN_BG,borderRadius:12,padding:"10px 12px",marginTop:10,fontSize:12.5}}>{v.motivos.map((m,i)=><p key={i} style={{margin:i?"4px 0 0":0,color:WARN}}>⚠ {m.t}</p>)}</div>}
      </Sec>;})}
    </div>
    <div style={{position:"sticky",bottom:0,background:BG,borderTop:`1px solid ${BORDE}`,margin:"0 -28px",padding:"14px 28px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar canales"}</Btn>
      <Btn onClick={onVolver}>Volver a la ficha</Btn>
      <span style={{fontSize:12.5,color:GRIS}}>Tarifas de Argencargo del cliente ARGENMAQ{tarifas?.cliente?.tax_condition?` · ${tarifas.cliente.tax_condition.replace("_"," ")}`:""}.</span>
    </div>
  </div>;
}
