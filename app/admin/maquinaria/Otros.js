"use client";
// Inicio, Clientes (misma base que Argencargo) y Ajustes del sistema.
import { useState, useEffect } from "react";
import { toast } from "../../../lib/ui";
import { INK,GRIS,BORDE,SUAVE,CARD,OK,WARN,BAD,MONO,INP,LBL,TH,TD,GRID,Campo,Inp,Btn,Sec,Pill,Barra,Vacio,Dato,n,fmtUsd,fmtFecha,codigoPed,codigoMaq,ChipPed,ChipMaq,ESTADOS_PEDIDO,CATEG_MOV } from "./ui";
import { cobradoDe } from "./Pedidos";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const ACTIVOS=["nuevo","pagado","en_produccion","prueba_fabrica","listo_fabrica","en_importacion"];
const nombreCliente=(c)=>c?(c.company_name||`${c.first_name||""} ${c.last_name||""}`.trim()||c.email||"—"):"—";

export function Inicio({ses,prods,pedidos,movs,ir}){
  const activos=pedidos.filter(p=>ACTIVOS.includes(p.estado));
  const porCobrar=activos.reduce((s,p)=>s+Math.max(0,n(p.precio_total)-cobradoDe(movs,p.id)),0);
  const hoy=new Date();const mesMovs=movs.filter(m=>{const d=new Date(m.fecha+"T12:00:00");return d.getMonth()===hoy.getMonth()&&d.getFullYear()===hoy.getFullYear();});
  const gananciaMes=mesMovs.reduce((s,m)=>s+(m.tipo==="ingreso"?1:-1)*n(m.monto_usd),0);
  const publicadas=prods.filter(p=>p.estado==="publicado").length, borradores=prods.filter(p=>p.estado==="borrador").length;
  const viejas=prods.filter(p=>p.estado==="publicado"&&p.precio_verificado_at&&(Date.now()-new Date(p.precio_verificado_at))/864e5>30);
  const porEstado=ESTADOS_PEDIDO.filter(e=>ACTIVOS.includes(e.k)).map(e=>({...e,c:pedidos.filter(p=>p.estado===e.k).length})).filter(e=>e.c>0);
  const ultimos=pedidos.slice(0,6);
  return <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:14}}>
      <Dato l="Pedidos activos" v={String(activos.length)} sub={porEstado.map(e=>`${e.c} ${e.l.toLowerCase()}`).join(" · ")||"ninguno"}/>
      <Dato l="Por cobrar" v={fmtUsd(porCobrar)} sub="de los pedidos activos" color={porCobrar>0?WARN:INK}/>
      {ses.rol==="admin"&&<Dato l="Ganancia del mes" v={fmtUsd(gananciaMes)} sub="ingresos − egresos" color={gananciaMes>=0?OK:BAD}/>}
      <Dato l="Catálogo" v={`${publicadas} publicadas`} sub={`${borradores} en borrador`}/>
    </div>
    {viejas.length>0&&<div style={{background:"var(--mq-warn-bg)",borderRadius:16,padding:"12px 16px",marginBottom:14,fontSize:13.5,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><span style={{fontFamily:MONO,fontSize:11,color:WARN,letterSpacing:"0.08em"}}>PRECIOS POR VERIFICAR</span><span>{viejas.length} máquina{viejas.length>1?"s":""} con el EXW sin verificar hace más de 30 días: {viejas.slice(0,4).map(p=>codigoMaq(p)).join(", ")}{viejas.length>4?"…":""}</span><span style={{flex:1}}/><Btn small onClick={()=>ir("maquinas")}>Ver máquinas</Btn></div>}
    <Sec titulo="Últimos pedidos" extra={<Btn small onClick={()=>ir("pedidos")}>Ver todos</Btn>}>
      {ultimos.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Todavía no hay pedidos.</p>
      :<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
        <thead><tr>{["Pedido","Cliente","Máquinas","Estado","Precio","Cobrado"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>{ultimos.map(p=>{const cob=cobradoDe(movs,p.id);return <tr key={p.id} className="fila" onClick={()=>ir("pedidos",p.id)} style={{cursor:"pointer"}}><td style={{...TD,fontFamily:MONO}}>{codigoPed(p)}</td><td style={{...TD,fontWeight:800}}>{p.cliente_nombre}</td><td style={{...TD,color:GRIS,maxWidth:300}}><span style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(p.items||[]).map(i=>i.nombre).join(" · ")}</span></td><td style={TD}><ChipPed e={p.estado}/></td><td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap"}}>{fmtUsd(p.precio_total)}</td><td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap",color:cob>=n(p.precio_total)-0.01?OK:cob>0?WARN:GRIS}}>{fmtUsd(cob)}</td></tr>;})}</tbody>
      </table></div>}
    </Sec>
    {ses.rol==="admin"&&<Sec titulo="Últimos movimientos" extra={<Btn small onClick={()=>ir("libro")}>Libro diario</Btn>}>
      {movs.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Sin movimientos.</p>
      :<div style={{display:"grid",gap:6}}>{movs.slice(0,6).map(m=><div key={m.id} style={{display:"flex",gap:12,alignItems:"center",fontSize:13.5}}><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS,whiteSpace:"nowrap"}}>{fmtFecha(m.fecha)}</span><span style={{flex:1,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.concepto||CATEG_MOV[m.categoria]}</span><span style={{fontFamily:MONO,fontWeight:700,color:m.tipo==="ingreso"?OK:BAD,whiteSpace:"nowrap"}}>{m.tipo==="ingreso"?"+":"−"} {fmtUsd(m.monto_usd)}</span></div>)}</div>}
    </Sec>}
  </>;
}

export function Clientes({dq,pedidos,ir}){
  const [q,setQ]=useState("");const [lista,setLista]=useState([]);const [cargando,setCargando]=useState(true);
  const buscar=async(t)=>{setCargando(true);try{
    const s=t.trim().replace(/[%,()]/g,"");
    const f=s.length>=2?`&or=(first_name.ilike.*${s}*,last_name.ilike.*${s}*,company_name.ilike.*${s}*,email.ilike.*${s}*,client_code.ilike.*${s}*,whatsapp.ilike.*${s}*,cuit.ilike.*${s}*)`:"";
    const r=await dq("clients",{filters:`?select=id,client_code,first_name,last_name,company_name,email,whatsapp,cuit,tax_condition,city,province,created_at&order=created_at.desc&limit=60${f}`});
    setLista(Array.isArray(r)?r:[]);
  }catch(e){toast(e.message,"error");}setCargando(false);};
  useEffect(()=>{buscar("");},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const cuenta=(id)=>pedidos.filter(p=>p.client_id===id).length;
  const total=(id)=>pedidos.filter(p=>p.client_id===id&&p.estado!=="cancelado").reduce((s,p)=>s+n(p.precio_total),0);
  return <>
    <Barra><input placeholder="Buscar cliente de Argencargo…" value={q} onChange={e=>{setQ(e.target.value);buscar(e.target.value);}} style={{...INP,flex:1,minWidth:200,borderRadius:999,padding:"10px 18px"}}/><span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>MISMA BASE QUE ARGENCARGO</span></Barra>
    {cargando?<p style={{color:GRIS}}>Cargando…</p>:lista.length===0?<Vacio>Nada que coincida.</Vacio>
    :<div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
      <thead><tr>{["Código","Cliente","WhatsApp","Email","CUIT","Ubicación","Pedidos","Comprado"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{lista.map(c=><tr key={c.id}><td style={{...TD,fontFamily:MONO,fontSize:12.5,color:GRIS}}>{c.client_code||"—"}</td><td style={{...TD,fontWeight:800}}>{nombreCliente(c)}{c.company_name&&(c.first_name||c.last_name)&&<span style={{display:"block",fontWeight:500,color:GRIS,fontSize:12.5}}>{`${c.first_name||""} ${c.last_name||""}`.trim()}</span>}</td><td style={{...TD,whiteSpace:"nowrap"}}>{c.whatsapp?<a href={`https://wa.me/${String(c.whatsapp).replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{color:INK,fontWeight:700}}>{c.whatsapp}</a>:"—"}</td><td style={{...TD,color:GRIS}}>{c.email||"—"}</td><td style={{...TD,fontFamily:MONO,fontSize:12.5}}>{c.cuit||"—"}</td><td style={{...TD,color:GRIS}}>{[c.city,c.province].filter(Boolean).join(", ")||"—"}</td><td style={{...TD,fontFamily:MONO}}>{cuenta(c.id)}</td><td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap"}}>{total(c.id)?fmtUsd(total(c.id)):"—"}</td></tr>)}</tbody>
    </table></div></div>}
  </>;
}

export function Ajustes({ses,tema,setTema}){
  const [enviando,setEnviando]=useState(false);
  const resetear=async()=>{setEnviando(true);try{const r=await fetch(`${SB_URL}/auth/v1/recover`,{method:"POST",headers:{apikey:SB_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:ses.user?.email})});if(!r.ok)throw new Error("No se pudo enviar el mail");toast(`Mail enviado a ${ses.user?.email}`);}catch(e){toast(e.message,"error");}setEnviando(false);};
  return <>
    <Sec titulo="Apariencia">
      <div style={{display:"flex",gap:8}}><Pill on={tema==="claro"} onClick={()=>setTema("claro")}>Claro</Pill><Pill on={tema==="oscuro"} onClick={()=>setTema("oscuro")}>Oscuro</Pill></div>
    </Sec>
    <Sec titulo="Cuenta">
      <div className="grid3" style={GRID}>
        <Campo label="Email"><p style={{margin:0,fontWeight:700}}>{ses.user?.email}</p></Campo>
        <Campo label="Rol"><p style={{margin:0,fontWeight:700,textTransform:"capitalize"}}>{ses.rol==="gi"?"Socio GI":ses.rol}</p></Campo>
        <Campo label="Contraseña"><Btn small onClick={resetear} disabled={enviando}>{enviando?"Enviando…":"Enviar mail para restablecer"}</Btn></Campo>
      </div>
    </Sec>
  </>;
}
