"use client";
// Operaciones de Argenmaq (AM-00001): un cliente de la base de Argencargo pide una o más máquinas
// del catálogo; la operación congela precios y % de gestión, avanza por estados y lleva colgados
// los cobros, los pagos a fábrica y los gastos, que también se anotan solos en el libro diario.
// Por dentro se ve en tres solapas: Resumen · Finanzas · Seguimiento (la op de Argencargo).
import { useState, useEffect } from "react";
import { toast, confirmDialog } from "../../../lib/ui";
import { totalesPedido } from "../../../lib/catalogo-precio";
import { INK,GRIS,BORDE,SUAVE,CARD,BG,LIMA,LIMA_SUAVE,OK,OK_BG,WARN,WARN_BG,BAD,BAD_BG,MONO,INP,LBL,TH,TD,GRID,DOS,Campo,Inp,TA,Btn,Sec,Pill,Barra,Vacio,Dato,Desplegable,Fecha,Archivo,Solapas,n,numONull,txtONull,fmtUsd,fmtMon,fmtFecha,hoyISO,codigoMaq,codigoOp,ESTADOS_PEDIDO,ACTIVOS,estadoPed,ChipPed,CATEG_MOV,nombreCliente } from "./ui";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
export const cobradoDe=(movs,pid)=>movs.filter(m=>m.pedido_id===pid&&m.tipo==="ingreso").reduce((s,m)=>s+n(m.monto_usd),0);
export const pagadoFabricaDe=(movs,pid)=>movs.filter(m=>m.pedido_id===pid&&m.tipo==="egreso"&&m.categoria==="pago_fabrica").reduce((s,m)=>s+n(m.monto_usd),0);
const OP_ESTADO={pendiente:"Pendiente",en_transito:"En tránsito",en_aduana:"En aduana",lista_retiro:"Lista para retirar",entregada:"Entregada"};

export function Pedidos({ses,dq,token,prods,provs,ajustes,pedidos,movs,ops,gastoCats,recargar,inicialSel}){
  const [sel,setSel]=useState(inicialSel||null);
  const [nuevo,setNuevo]=useState(false);
  const [fEstado,setFEstado]=useState("activos");
  const [busq,setBusq]=useState("");
  const visibles=pedidos.filter(p=>(fEstado==="todos"||(fEstado==="activos"?ACTIVOS.includes(p.estado):p.estado===fEstado))&&(!busq.trim()||`${codigoOp(p)} ${p.cliente_nombre||""} ${(p.items||[]).map(i=>i.nombre).join(" ")}`.toLowerCase().includes(busq.toLowerCase())));
  const cuenta=(k)=>k==="activos"?pedidos.filter(p=>ACTIVOS.includes(p.estado)).length:pedidos.filter(p=>p.estado===k).length;

  if(nuevo)return <NuevaOperacion ses={ses} dq={dq} prods={prods} provs={provs} ajustes={ajustes} onCerrar={()=>setNuevo(false)} onCreado={async(id)=>{await recargar();setNuevo(false);setSel(id);}}/>;
  if(sel){const p=pedidos.find(x=>x.id===sel);if(p)return <DetalleOperacion p={p} ses={ses} dq={dq} token={token} ajustes={ajustes} movs={movs} ops={ops||[]} gastoCats={gastoCats||[]} recargar={recargar} onCerrar={()=>setSel(null)}/>;}
  return <>
    <Barra>
      {[["activos","Activas"],["todos","Todas"],["entregado","Entregadas"],["cancelado","Canceladas"]].map(([k,l])=><Pill key={k} on={fEstado===k} onClick={()=>setFEstado(k)}>{l} <span style={{color:GRIS,fontFamily:MONO,fontSize:11}}>{k==="todos"?pedidos.length:cuenta(k)}</span></Pill>)}
      <input placeholder="Buscar…" value={busq} onChange={e=>setBusq(e.target.value)} style={{...INP,flex:1,minWidth:180,borderRadius:999,padding:"10px 18px"}}/>
      <Btn kind="lima" onClick={()=>setNuevo(true)}>+ Nueva operación</Btn>
    </Barra>
    {visibles.length===0?<Vacio>{pedidos.length===0?"Todavía no hay operaciones.":"Nada que coincida."}</Vacio>
    :<div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
      <thead><tr>{["Operación","Fecha","Cliente","Máquinas","Estado","Precio","Cobrado","Días"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{visibles.map(p=>{const cob=cobradoDe(movs,p.id);const dias=Math.floor((Date.now()-new Date(p.updated_at))/864e5);return <tr key={p.id} className="fila" onClick={()=>setSel(p.id)} style={{cursor:"pointer"}}>
        <td style={{...TD,fontFamily:MONO,fontWeight:600}}>{codigoOp(p)}</td>
        <td style={{...TD,color:GRIS,whiteSpace:"nowrap"}}>{fmtFecha(p.created_at)}</td>
        <td style={{...TD,fontWeight:800}}>{p.cliente_nombre||"—"}</td>
        <td style={{...TD,maxWidth:340}}><span style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(p.items||[]).map(i=>`${i.qty>1?`${i.qty}× `:""}${i.nombre}`).join(" · ")||"—"}</span></td>
        <td style={TD}><ChipPed e={p.estado}/></td>
        <td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap"}}>{fmtUsd(p.precio_total)}</td>
        <td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap",color:cob>=n(p.precio_total)-0.01?OK:cob>0?WARN:GRIS}}>{fmtUsd(cob)}</td>
        <td style={{...TD,fontFamily:MONO,color:GRIS}}>{dias}</td>
      </tr>;})}</tbody>
    </table></div></div>}
  </>;
}

// ── Alta ──────────────────────────────────────────────────────────────────────────────────
function NuevaOperacion({ses,dq,prods,provs,ajustes,onCerrar,onCreado}){
  const [q,setQ]=useState("");const [res,setRes]=useState([]);const [cli,setCli]=useState(null);const [buscando,setBuscando]=useState(false);
  const [items,setItems]=useState([]);
  const [prueba,setPrueba]=useState(false);
  const [importacion,setImportacion]=useState("");
  const [notas,setNotas]=useState("");
  const [guardando,setGuardando]=useState(false);
  const publicadas=prods.filter(p=>p.estado!=="borrador"&&n(p.exw_usd)>0);

  const buscar=async(t)=>{setQ(t);if(t.trim().length<2){setRes([]);return;}setBuscando(true);try{
    const s=t.trim().replace(/[%,()]/g,"");
    const r=await dq("clients",{filters:`?select=id,client_code,first_name,last_name,company_name,email,whatsapp,cuit,tax_condition&or=(first_name.ilike.*${s}*,last_name.ilike.*${s}*,company_name.ilike.*${s}*,email.ilike.*${s}*,client_code.ilike.*${s}*,whatsapp.ilike.*${s}*)&limit=8`});
    setRes(Array.isArray(r)?r:[]);
  }catch(e){toast(e.message,"error");}setBuscando(false);};
  const agregar=(id)=>{const p=publicadas.find(x=>x.id===id);if(!p||items.some(i=>i.producto_id===p.id))return;const prov=provs.find(x=>x.id===p.proveedor_id);setItems(x=>[...x,{producto_id:p.id,codigo:codigoMaq(p),nombre:p.nombre||p.nombre_raw,qty:"1",exw_unit:String(p.exw_usd),gestion_pct:p.markup_pct!=null?String(p.markup_pct):String(ajustes.gestion_pct),proveedor:prov?`${prov.fabrica} · ${prov.ciudad}`:null,dias_produccion:p.dias_produccion||null}]);};
  const up=(i,k,v)=>setItems(x=>x.map((it,j)=>j===i?{...it,[k]:v}:it));
  const tot=totalesPedido(items,ajustes,prueba);
  const crear=async()=>{if(!cli){toast("Elegí el cliente","error");return;}if(!items.length){toast("Agregá al menos una máquina","error");return;}setGuardando(true);try{
    const body={estado:"nuevo",client_id:cli.id,cliente_nombre:nombreCliente(cli),cliente_contacto:[cli.whatsapp,cli.email].filter(Boolean).join(" · ")||null,
      items:items.map(it=>({...it,qty:Math.max(1,n(it.qty,1)),exw_unit:n(it.exw_unit),gestion_pct:n(it.gestion_pct)})),
      prueba_fabrica:prueba,exw_total:tot.exw_total,financiero:tot.financiero,gestion:tot.gestion,prueba_monto:tot.prueba_monto,precio_total:tot.precio_total,
      importacion_usd:numONull(importacion),notas:txtONull(notas),historial:[{estado:"nuevo",at:new Date().toISOString(),by:ses.user?.email||null}],created_by:ses.user?.id||null};
    const r=await dq("cat_pedidos",{method:"POST",body});const row=Array.isArray(r)?r[0]:r;toast(`Operación ${codigoOp(row)} creada`);onCreado(row.id);
  }catch(e){toast(e.message,"error");}setGuardando(false);};

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,margin:"0 0 22px"}}><Btn small onClick={onCerrar}>← Operaciones</Btn><span style={{fontWeight:800,fontSize:15}}>Nueva operación</span></div>
    <Sec titulo="Cliente">
      {cli?<div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",background:SUAVE,borderRadius:14,padding:"12px 14px"}}><span style={{fontWeight:800}}>{nombreCliente(cli)}</span>{cli.client_code&&<span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{cli.client_code}</span>}{cli.whatsapp&&<span style={{fontSize:13}}>{cli.whatsapp}</span>}{cli.email&&<span style={{fontSize:13,color:GRIS}}>{cli.email}</span>}{cli.cuit&&<span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>CUIT {cli.cuit}</span>}<span style={{flex:1}}/><Btn small onClick={()=>setCli(null)}>Cambiar</Btn></div>
      :<div><Inp placeholder="Buscar en los clientes de Argencargo: nombre, empresa, email, WhatsApp o código…" value={q} onChange={e=>buscar(e.target.value)}/>
        {(res.length>0||buscando)&&<div style={{marginTop:8,border:`1px solid ${BORDE}`,borderRadius:14,overflow:"hidden"}}>{buscando&&res.length===0&&<p style={{margin:0,padding:"10px 14px",color:GRIS,fontSize:13}}>Buscando…</p>}{res.map(c=><button key={c.id} className="fila" onClick={()=>{setCli(c);setRes([]);setQ("");}} style={{display:"flex",gap:12,alignItems:"center",width:"100%",textAlign:"left",padding:"10px 14px",border:"none",borderTop:`1px solid ${BORDE}`,background:CARD,color:INK,cursor:"pointer",fontSize:13.5}}><span style={{fontWeight:800}}>{nombreCliente(c)}</span><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS}}>{c.client_code}</span><span style={{color:GRIS}}>{c.whatsapp||c.email}</span></button>)}</div>}
      </div>}
    </Sec>
    <Sec titulo="Máquinas">
      {items.length>0&&<div style={{overflowX:"auto",marginBottom:12}}><table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 6px"}}>
        <thead><tr>{["Máquina","Cantidad","EXW unitario","Gestión (%)","Precio línea",""].map(h=><th key={h} style={{...LBL,display:"table-cell",textAlign:"left",padding:"0 6px 2px",marginBottom:0,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{items.map((it,i)=>{const l=totalesPedido([it],{...ajustes,fin_fijo_usd:0,fin_pct:0},false);return <tr key={it.producto_id}>
          <td style={{padding:"0 6px"}}><span style={{fontWeight:800}}>{it.nombre}</span><br/><span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>{it.codigo}{it.proveedor?` · ${it.proveedor}`:""}</span></td>
          <td style={{padding:"0 4px",width:90}}><Inp type="number" value={it.qty} onChange={e=>up(i,"qty",e.target.value)}/></td>
          <td style={{padding:"0 4px",width:130}}><Inp type="number" step="0.01" value={it.exw_unit} onChange={e=>up(i,"exw_unit",e.target.value)}/></td>
          <td style={{padding:"0 4px",width:100}}><Inp type="number" step="0.5" value={it.gestion_pct} onChange={e=>up(i,"gestion_pct",e.target.value)}/></td>
          <td style={{padding:"0 6px",fontFamily:MONO,whiteSpace:"nowrap"}}>{fmtUsd(l.exw_total+l.gestion)}</td>
          <td style={{padding:"0 4px"}}><Btn small kind="danger" onClick={()=>setItems(x=>x.filter((_,j)=>j!==i))}>✕</Btn></td>
        </tr>;})}</tbody>
      </table></div>}
      <Desplegable value="" onChange={agregar} opciones={publicadas.filter(p=>!items.some(i=>i.producto_id===p.id)).map(p=>({v:p.id,l:p.nombre||p.nombre_raw,sub:`${codigoMaq(p)} · EXW ${fmtUsd(p.exw_usd)}`}))} placeholder="+ Agregar máquina del catálogo…" vacio="No hay máquinas publicadas con EXW"/>
    </Sec>
    <Sec titulo="Condiciones">
      <div className="grid3" style={GRID}>
        <Campo label="Prueba en fábrica (adicional)"><div style={{display:"flex",gap:8}}><Pill on={!prueba} onClick={()=>setPrueba(false)}>No</Pill><Pill on={prueba} onClick={()=>setPrueba(true)}>Sí · {fmtUsd(ajustes.prueba_fabrica_precio)}</Pill></div></Campo>
        <Campo label="Importación cotizada por Argencargo (USD)"><Inp type="number" step="0.01" value={importacion} onChange={e=>setImportacion(e.target.value)}/></Campo>
        <Campo label="Notas" span={3}><TA value={notas} onChange={e=>setNotas(e.target.value)} style={{minHeight:70}}/></Campo>
      </div>
    </Sec>
    <Totales tot={tot} importacion={numONull(importacion)} ajustes={ajustes}/>
    <div style={{position:"sticky",bottom:0,background:BG,borderTop:`1px solid ${BORDE}`,margin:"0 -28px",padding:"14px 28px",display:"flex",gap:10,alignItems:"center"}}>
      <Btn kind="lima" onClick={crear} disabled={guardando||!cli||!items.length}>{guardando?"Creando…":"Crear operación"}</Btn>
      <Btn onClick={onCerrar}>Cancelar</Btn>
    </div>
  </div>;
}

function Totales({tot,importacion,ajustes}){
  const fila=(l,v,b)=><><span style={{color:b?INK:GRIS,fontWeight:b?800:500,borderTop:b?`1px solid ${BORDE}`:"none",paddingTop:b?8:0}}>{l}</span><span style={{fontFamily:MONO,textAlign:"right",fontWeight:b?800:500,borderTop:b?`1px solid ${BORDE}`:"none",paddingTop:b?8:0}}>{fmtUsd(v)}</span></>;
  return <Sec titulo="Totales">
    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"6px 18px",fontSize:13.5,maxWidth:520}}>
      {fila("EXW fábrica",tot.exw_total)}
      {fila(`Costo financiero del pago (${String(ajustes.fin_pct).replace(".",",")} % + USD ${ajustes.fin_fijo_usd})`,tot.financiero)}
      {fila("Gestión",tot.gestion)}
      {tot.prueba_monto>0&&fila("Prueba en fábrica",tot.prueba_monto)}
      {fila("Precio de la máquina · lo cobra Argenmaq",tot.precio_total,true)}
      {importacion!=null&&fila("Importación · la cobra Argencargo",importacion)}
      {importacion!=null&&fila("Total para el cliente",tot.precio_total+importacion,true)}
    </div>
    <p style={{margin:"10px 0 0",fontSize:12.5,color:tot.cubreAdelanto?OK:BAD}}>{tot.cubreAdelanto?`El precio cubre el adelanto mínimo (EXW + ${ajustes.adelanto_extra_pct} % = ${fmtUsd(tot.adelantoMinimo)}).`:`El precio no cubre el adelanto mínimo (EXW + ${ajustes.adelanto_extra_pct} % = ${fmtUsd(tot.adelantoMinimo)}): subí la gestión.`}</p>
  </Sec>;
}

// ── Detalle con solapas ───────────────────────────────────────────────────────────────────
function DetalleOperacion({p,ses,dq,token,ajustes,movs,ops,gastoCats,recargar,onCerrar}){
  const [tab,setTab]=useState("resumen");
  const [mov,setMov]=useState(null);
  const [edit,setEdit]=useState(false);
  const [imp,setImp]=useState(p.importacion_usd==null?"":String(p.importacion_usd));
  const [opId,setOpId]=useState(p.operation_id||"");
  const [notas,setNotas]=useState(p.notas||"");
  const [guardando,setGuardando]=useState(false);
  const cob=cobradoDe(movs,p.id), pag=pagadoFabricaDe(movs,p.id);
  const misMovs=movs.filter(m=>m.pedido_id===p.id);
  const otrosGastos=misMovs.filter(m=>m.tipo==="egreso"&&m.categoria!=="pago_fabrica");
  const egresos=misMovs.filter(m=>m.tipo==="egreso").reduce((s,m)=>s+n(m.monto_usd),0);
  const op=ops.find(o=>o.id===p.operation_id)||null;
  const idx=ESTADOS_PEDIDO.findIndex(e=>e.k===p.estado);
  const siguiente=p.estado==="entregado"||p.estado==="cancelado"?null:ESTADOS_PEDIDO[(p.estado==="en_produccion"&&!p.prueba_fabrica)?idx+2:idx+1];
  const tot={exw_total:n(p.exw_total),financiero:n(p.financiero),gestion:n(p.gestion),prueba_monto:n(p.prueba_monto),precio_total:n(p.precio_total),adelantoMinimo:n(p.exw_total)*(1+n(ajustes.adelanto_extra_pct)/100),cubreAdelanto:n(p.precio_total)>=n(p.exw_total)*(1+n(ajustes.adelanto_extra_pct)/100)};

  const cambiarEstado=async(k)=>{if(k==="cancelado"&&!(await confirmDialog(`¿Cancelar ${codigoOp(p)}?`)))return;try{
    await dq("cat_pedidos",{method:"PATCH",filters:`?id=eq.${p.id}`,body:{estado:k,historial:[...(p.historial||[]),{estado:k,at:new Date().toISOString(),by:ses.user?.email||null}]}});await recargar();toast(estadoPed(k).l);
  }catch(e){toast(e.message,"error");}};
  const guardarDatos=async()=>{setGuardando(true);try{const o=ops.find(x=>x.id===opId);await dq("cat_pedidos",{method:"PATCH",filters:`?id=eq.${p.id}`,body:{importacion_usd:numONull(imp),operation_id:opId||null,operation_ref:o?o.operation_code:null,notas:txtONull(notas)}});await recargar();setEdit(false);toast("Guardado");}catch(e){toast(e.message,"error");}setGuardando(false);};
  const eliminar=async()=>{if(!(await confirmDialog(`¿Eliminar ${codigoOp(p)} y sus movimientos? No se puede deshacer.`)))return;try{await dq("cat_movimientos",{method:"DELETE",filters:`?pedido_id=eq.${p.id}`,prefer:"return=minimal"});await dq("cat_pedidos",{method:"DELETE",filters:`?id=eq.${p.id}`,prefer:"return=minimal"});await recargar();toast("Eliminada");onCerrar();}catch(e){toast(e.message,"error");}};

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"0 0 14px"}}>
      <Btn small onClick={onCerrar}>← Operaciones</Btn>
      <span style={{fontFamily:MONO,fontSize:14,fontWeight:600,letterSpacing:"0.08em"}}>{codigoOp(p)}</span>
      <ChipPed e={p.estado}/>
      <span style={{fontWeight:800}}>{p.cliente_nombre}</span>
      <span style={{fontSize:13,color:GRIS}}>{fmtFecha(p.created_at)}</span>
      <span style={{flex:1}}/>
      {siguiente&&<Btn kind="lima" onClick={()=>cambiarEstado(siguiente.k)}>→ {siguiente.l}</Btn>}
      {p.estado!=="cancelado"&&p.estado!=="entregado"&&<Btn small kind="danger" onClick={()=>cambiarEstado("cancelado")}>Cancelar</Btn>}
      <Btn small kind="danger" onClick={eliminar}>Eliminar</Btn>
    </div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
      {ESTADOS_PEDIDO.filter(e=>e.k!=="cancelado"&&(e.k!=="prueba_fabrica"||p.prueba_fabrica)).map((e,i,arr)=>{const pos=arr.findIndex(x=>x.k===p.estado);const hecho=i<=pos&&p.estado!=="cancelado";return <span key={e.k} style={{fontFamily:MONO,fontSize:10.5,letterSpacing:"0.06em",padding:"5px 10px",borderRadius:999,background:hecho?(i===pos?LIMA:OK_BG):SUAVE,color:hecho?(i===pos?"var(--mq-lima-ink)":INK):GRIS,fontWeight:i===pos?700:500}}>{e.l.toUpperCase()}</span>;})}
    </div>
    <Solapas val={tab} onChange={setTab} items={[["resumen","Resumen"],["finanzas","Finanzas",misMovs.length||null],["seguimiento","Seguimiento",op?op.operation_code:null]]}/>

    {tab==="resumen"&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:14}}>
        <Dato l="Cliente" v={p.cliente_nombre||"—"} sub={p.cliente_contacto}/>
        <Dato l="Precio de la máquina" v={fmtUsd(p.precio_total)} sub="lo cobra Argenmaq"/>
        <Dato l="Cobrado" v={fmtUsd(cob)} sub={cob>=n(p.precio_total)-0.01?"completo":`faltan ${fmtUsd(n(p.precio_total)-cob)}`} color={cob>=n(p.precio_total)-0.01?OK:cob>0?WARN:INK} acento={cob>=n(p.precio_total)-0.01?OK:WARN}/>
        <Dato l="Importación" v={p.importacion_usd==null?"—":fmtUsd(p.importacion_usd)} sub="la cobra Argencargo" acento={GRIS}/>
      </div>
      <Sec titulo="Máquinas">
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
          <thead><tr>{["Máquina","Proveedor","Cant.","EXW unit.","Gestión","Producción"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody>{(p.items||[]).map((it,i)=><tr key={i}><td style={{...TD,fontWeight:800}}>{it.nombre}<br/><span style={{fontFamily:MONO,fontSize:11,color:GRIS,fontWeight:500}}>{it.codigo}</span></td><td style={{...TD,color:GRIS}}>{it.proveedor||"—"}</td><td style={{...TD,fontFamily:MONO}}>{it.qty}</td><td style={{...TD,fontFamily:MONO}}>{fmtUsd(it.exw_unit)}</td><td style={{...TD,fontFamily:MONO}}>{String(it.gestion_pct).replace(".",",")} %</td><td style={{...TD,color:GRIS}}>{it.dias_produccion?`${it.dias_produccion} días`:"—"}</td></tr>)}</tbody>
        </table></div>
      </Sec>
      <Totales tot={tot} importacion={p.importacion_usd==null?null:n(p.importacion_usd)} ajustes={ajustes}/>
      <Sec titulo="Datos" extra={edit?<div style={{display:"flex",gap:8}}><Btn small kind="lima" onClick={guardarDatos} disabled={guardando}>Guardar</Btn><Btn small onClick={()=>setEdit(false)}>Cancelar</Btn></div>:<Btn small onClick={()=>setEdit(true)}>Editar</Btn>}>
        <div className="grid3" style={GRID}>
          <Campo label="Importación cotizada (USD)">{edit?<Inp type="number" step="0.01" value={imp} onChange={e=>setImp(e.target.value)}/>:<p style={{margin:0,fontFamily:MONO,fontWeight:700}}>{p.importacion_usd==null?"—":fmtUsd(p.importacion_usd)}</p>}</Campo>
          <Campo label="Operación de Argencargo" span={2}>{edit?<Desplegable value={opId} onChange={setOpId} opciones={ops.map(o=>({v:o.id,l:`${o.operation_code}${o.description?` · ${o.description.slice(0,50)}`:""}`,sub:OP_ESTADO[o.status]||o.status}))} placeholder="Sin vincular" vacio="No hay operaciones a nombre de Argenmaq en Argencargo"/>:<p style={{margin:0,fontFamily:MONO,fontWeight:700}}>{op?op.operation_code:p.operation_ref||"—"}</p>}</Campo>
          <Campo label="Notas" span={3}>{edit?<TA value={notas} onChange={e=>setNotas(e.target.value)} style={{minHeight:70}}/>:<p style={{margin:0,fontSize:13.5,whiteSpace:"pre-wrap",color:p.notas?INK:GRIS}}>{p.notas||"—"}</p>}</Campo>
        </div>
      </Sec>
      {Array.isArray(p.historial)&&p.historial.length>0&&<Sec titulo="Historial"><div style={{display:"grid",gap:6}}>{[...p.historial].reverse().map((h,i)=><div key={i} style={{display:"flex",gap:12,fontSize:13,alignItems:"center"}}><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS,whiteSpace:"nowrap"}}>{new Date(h.at).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><ChipPed e={h.estado}/><span style={{color:GRIS}}>{h.by||""}</span></div>)}</div></Sec>}
    </>}

    {tab==="finanzas"&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:14}}>
        <Dato l="Cobrado" v={fmtUsd(cob)} sub={`de ${fmtUsd(p.precio_total)}`} color={cob>=n(p.precio_total)-0.01?OK:cob>0?WARN:INK} acento={OK}/>
        <Dato l="Pagado a fábrica" v={fmtUsd(pag)} sub={`de ${fmtUsd(p.exw_total)} EXW`} color={pag>=n(p.exw_total)-0.01?OK:pag>0?WARN:INK} acento={BAD}/>
        <Dato l="Otros gastos" v={fmtUsd(egresos-pag)} acento={GRIS}/>
        <Dato l="Ganancia real" v={fmtUsd(cob-egresos)} sub={`prevista ${fmtUsd(n(p.gestion)+(p.prueba_fabrica?n(p.prueba_monto)-n(ajustes.prueba_fabrica_costo):0))}`} color={cob-egresos>=0?OK:BAD}/>
      </div>
      {mov&&<FormMov token={token} dq={dq} ses={ses} pedido={p} fijo={mov} gastoCats={gastoCats} onCerrar={()=>setMov(null)} onHecho={async()=>{setMov(null);await recargar();}}/>}
      <Sec titulo="Cobros del cliente" extra={<Btn small kind="lima" onClick={()=>setMov({tipo:"ingreso",categoria:"cobro_cliente"})}>+ Cobro</Btn>}>
        <ListaMovs lista={misMovs.filter(m=>m.tipo==="ingreso")} dq={dq} recargar={recargar} admin/>
      </Sec>
      <Sec titulo="Pagos a fábrica" extra={<Btn small kind="lima" onClick={()=>setMov({tipo:"egreso",categoria:"pago_fabrica"})}>+ Pago</Btn>}>
        <ListaMovs lista={misMovs.filter(m=>m.tipo==="egreso"&&m.categoria==="pago_fabrica")} dq={dq} recargar={recargar} admin/>
      </Sec>
      <Sec titulo="Otros gastos" extra={<Btn small kind="lima" onClick={()=>setMov({tipo:"egreso"})}>+ Gasto</Btn>}>
        <ListaMovs lista={otrosGastos} dq={dq} recargar={recargar} admin/>
      </Sec>
    </>}

    {tab==="seguimiento"&&<Seguimiento op={op} p={p} dq={dq} onEditar={()=>{setTab("resumen");setEdit(true);}}/>}
  </div>;
}

function Seguimiento({op,p,dq,onEditar}){
  const [eventos,setEventos]=useState(null);
  useEffect(()=>{if(!op){setEventos([]);return;}(async()=>{try{const r=await dq("tracking_events",{filters:`?operation_id=eq.${op.id}&select=*&order=created_at.desc&limit=50`});setEventos(Array.isArray(r)?r:[]);}catch{setEventos([]);}})();},[op?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if(!op)return <Vacio><p style={{margin:"0 0 12px"}}>Esta operación todavía no está vinculada a una operación de Argencargo.</p><Btn small onClick={onEditar}>Vincular</Btn></Vacio>;
  const hitos=[["Creada",op.created_at],["Despachada",op.dispatched_at],["Llegó a Argentina",op.arrived_in_argentina_at],["Despacho aduanero",op.cleared_customs_at],["Entregada",op.delivered_at]];
  return <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:14}}>
      <Dato l="Operación Argencargo" v={op.operation_code} sub={op.description||""}/>
      <Dato l="Estado" v={OP_ESTADO[op.status]||op.status} acento={op.status==="entregada"?OK:WARN}/>
      <Dato l="ETA" v={op.eta?fmtFecha(op.eta):"—"} acento={GRIS}/>
      <Dato l="Vía" v={op.channel?String(op.channel).includes("aereo")?"Aérea":"Marítima":"—"} sub={op.international_tracking?`Tracking ${op.international_tracking}`:null} acento={GRIS}/>
    </div>
    <Sec titulo="Hitos" extra={<a href={`/track/${op.operation_code}`} target="_blank" rel="noreferrer" style={{fontSize:12.5,fontWeight:700,color:INK}}>Tracking público ↗</a>}>
      <div style={{display:"grid",gap:8}}>{hitos.map(([l,d])=><div key={l} style={{display:"flex",gap:12,alignItems:"center",fontSize:13.5}}><span style={{width:10,height:10,borderRadius:"50%",background:d?OK:BORDE,flexShrink:0}}/><span style={{flex:1,fontWeight:d?700:500,color:d?INK:GRIS}}>{l}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{d?fmtFecha(d):"—"}</span></div>)}</div>
    </Sec>
    <Sec titulo="Eventos">
      {eventos===null?<p style={{margin:0,color:GRIS,fontSize:13}}>Cargando…</p>:eventos.length===0?<p style={{margin:0,color:GRIS,fontSize:13}}>Sin eventos todavía.</p>
      :<div style={{display:"grid",gap:8}}>{eventos.map(e=><div key={e.id} style={{display:"flex",gap:12,alignItems:"start",fontSize:13.5}}><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS,whiteSpace:"nowrap",paddingTop:2}}>{new Date(e.created_at).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><span>{e.description||e.status||e.event||JSON.stringify(e).slice(0,80)}</span></div>)}</div>}
    </Sec>
  </>;
}

export function ListaMovs({lista,dq,recargar,admin,conPedido,pedidos}){
  const borrar=async(m)=>{if(!(await confirmDialog(`¿Eliminar el movimiento de ${fmtUsd(m.monto_usd)}?`)))return;try{await dq("cat_movimientos",{method:"DELETE",filters:`?id=eq.${m.id}`,prefer:"return=minimal"});await recargar();toast("Eliminado");}catch(e){toast(e.message,"error");}};
  if(!lista.length)return <p style={{margin:0,fontSize:13,color:GRIS}}>Sin movimientos.</p>;
  return <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
    <thead><tr>{["Fecha","Concepto",...(conPedido?["Operación"]:[]),"Categoría","Monto","Comprobante",""].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
    <tbody>{lista.map(m=>{const ped=conPedido&&m.pedido_id?pedidos?.find(x=>x.id===m.pedido_id):null;return <tr key={m.id}>
      <td style={{...TD,fontFamily:MONO,fontSize:12.5,whiteSpace:"nowrap"}}>{fmtFecha(m.fecha)}</td>
      <td style={{...TD,fontWeight:700}}>{m.concepto||CATEG_MOV[m.categoria]}{m.moneda==="ARS"&&m.monto_original&&<span style={{display:"block",fontSize:11.5,color:GRIS,fontWeight:500,fontFamily:MONO}}>{fmtMon(m.monto_original,"ARS")} @ {m.tipo_cambio}</span>}</td>
      {conPedido&&<td style={{...TD,fontFamily:MONO,fontSize:12.5}}>{ped?codigoOp(ped):"—"}</td>}
      <td style={{...TD,color:GRIS,fontSize:12.5}}>{m.categoria==="gasto"&&m.gasto_categoria?m.gasto_categoria:CATEG_MOV[m.categoria]||m.categoria}</td>
      <td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap",fontWeight:700,color:m.tipo==="ingreso"?OK:BAD}}>{m.tipo==="ingreso"?"+":"−"} {fmtUsd(m.monto_usd)}</td>
      <td style={TD}>{m.comprobante_url?<a href={m.comprobante_url} target="_blank" rel="noreferrer" style={{color:INK,fontWeight:700,fontSize:12.5}}>Ver</a>:<span style={{color:GRIS}}>—</span>}</td>
      <td style={{...TD,textAlign:"right"}}>{admin&&<Btn small kind="danger" onClick={()=>borrar(m)}>✕</Btn>}</td>
    </tr>;})}</tbody>
  </table></div>;
}

// Alta de un movimiento: desde una operación (tipo y/o categoría fijos) o desde el libro (libres).
// Los egresos pueden ir en pesos: se guarda el original y el tipo de cambio, y el libro lleva USD.
export function FormMov({token,dq,ses,pedido,fijo,pedidos,gastoCats,onCerrar,onHecho}){
  const [f,setF]=useState({fecha:hoyISO(),tipo:fijo?.tipo||"egreso",categoria:fijo?.categoria||"gasto",gasto_categoria:"",moneda:"USD",monto:"",tc:"",concepto:"",pedido_id:pedido?.id||"",archivo:null});
  const [guardando,setGuardando]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const montoUsd=f.moneda==="ARS"?(n(f.tc)>0?n(f.monto)/n(f.tc):0):n(f.monto);
  const guardar=async()=>{if(n(f.monto)<=0){toast("Cargá el monto","error");return;}if(f.moneda==="ARS"&&n(f.tc)<=0){toast("Cargá el tipo de cambio","error");return;}setGuardando(true);try{
    let url=null;
    if(f.archivo){const ext=(f.archivo.name.split(".").pop()||"bin").toLowerCase();const path=`comprobantes/${pedido?.id||"libro"}/${Date.now()}.${ext}`;const r=await fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"POST",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`,"Content-Type":f.archivo.type||"application/octet-stream"},body:f.archivo});if(!r.ok)throw new Error(`No se pudo subir el comprobante (${r.status})`);url=`${SB_URL}/storage/v1/object/public/catalogo/${path}`;}
    await dq("cat_movimientos",{method:"POST",body:{fecha:f.fecha,tipo:f.tipo,categoria:f.categoria,gasto_categoria:f.categoria==="gasto"?txtONull(f.gasto_categoria):null,concepto:txtONull(f.concepto),monto_usd:Math.round(montoUsd*100)/100,moneda:f.moneda,monto_original:f.moneda==="ARS"?n(f.monto):null,tipo_cambio:f.moneda==="ARS"?n(f.tc):null,pedido_id:f.pedido_id||null,comprobante_url:url,created_by:ses.user?.id||null}});
    toast("Registrado");onHecho();
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const cats=f.tipo==="ingreso"?["cobro_cliente","otro"]:["pago_fabrica","prueba_fabrica","argencargo","gasto","otro"];
  const titulo=fijo?(fijo.tipo==="ingreso"?"Registrar cobro":fijo.categoria?"Registrar pago a fábrica":"Registrar gasto"):"Nuevo movimiento";
  return <Sec titulo={titulo} style={{borderColor:LIMA}}>
    <div className="grid3" style={GRID}>
      <Campo label="Fecha"><Fecha value={f.fecha} onChange={v=>set("fecha",v)}/></Campo>
      {!fijo&&<Campo label="Tipo"><div style={{display:"flex",gap:8}}><Pill on={f.tipo==="ingreso"} onClick={()=>{set("tipo","ingreso");set("categoria","otro");}}>Ingreso</Pill><Pill on={f.tipo==="egreso"} onClick={()=>{set("tipo","egreso");set("categoria","gasto");}}>Egreso</Pill></div></Campo>}
      {(!fijo||!fijo.categoria)&&<Campo label={f.tipo==="egreso"?"Tipo de egreso":"Tipo de ingreso"}><Desplegable value={f.categoria} onChange={v=>set("categoria",v)} opciones={cats.filter(c=>!fijo||c!=="pago_fabrica").map(c=>({v:c,l:CATEG_MOV[c]}))} buscar={false}/></Campo>}
      {f.tipo==="egreso"&&f.categoria==="gasto"&&<Campo label="Categoría del gasto"><Desplegable value={f.gasto_categoria} onChange={v=>set("gasto_categoria",v)} opciones={(gastoCats||[]).map(c=>({v:c.nombre,l:c.nombre}))} placeholder="Elegir…" vacio="Se cargan en Ajustes"/></Campo>}
      <Campo label="Moneda"><div style={{display:"flex",gap:8}}><Pill on={f.moneda==="USD"} onClick={()=>set("moneda","USD")}>USD</Pill><Pill on={f.moneda==="ARS"} onClick={()=>set("moneda","ARS")}>ARS</Pill></div></Campo>
      <Campo label={`Monto (${f.moneda})`} ob><Inp type="number" step="0.01" value={f.monto} onChange={e=>set("monto",e.target.value)}/></Campo>
      {f.moneda==="ARS"&&<Campo label="Tipo de cambio (ARS por USD)" ob hint={montoUsd>0?`= ${fmtUsd(montoUsd)}`:null}><Inp type="number" step="0.01" value={f.tc} onChange={e=>set("tc",e.target.value)}/></Campo>}
      <Campo label="Concepto" span={3}><Inp value={f.concepto} onChange={e=>set("concepto",e.target.value)}/></Campo>
      {!fijo&&pedidos&&<Campo label="Operación (opcional)"><Desplegable value={f.pedido_id} onChange={v=>set("pedido_id",v)} opciones={pedidos.map(p=>({v:p.id,l:`${codigoOp(p)} · ${p.cliente_nombre}`,sub:estadoPed(p.estado).l}))} placeholder="Sin operación"/></Campo>}
      <Campo label="Comprobante" span={2}><Archivo onFiles={(fs)=>set("archivo",fs[0])} label={f.archivo?f.archivo.name.slice(0,28):"Adjuntar"} hint={f.archivo?"listo · podés cambiarlo":"Arrastrá, pegá con Ctrl+V o elegí"}/></Campo>
    </div>
    <div style={{display:"flex",gap:8,marginTop:14}}><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn><Btn onClick={onCerrar}>Cancelar</Btn></div>
  </Sec>;
}
