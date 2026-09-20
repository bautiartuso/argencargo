"use client";
// Pedidos: el hilo del negocio. Un cliente (de la base de Argencargo) pide una o más máquinas
// del catálogo; el pedido congela precios y % de gestión, avanza por estados y lleva colgados
// los cobros del cliente y los pagos a fábrica, que también se anotan solos en el libro diario.
import { useState, useMemo } from "react";
import { toast, confirmDialog } from "../../../lib/ui";
import { totalesPedido } from "../../../lib/catalogo-precio";
import { INK,GRIS,BORDE,SUAVE,CARD,BG,LIMA_SUAVE,OK,OK_BG,WARN,WARN_BG,BAD,BAD_BG,MONO,INP,LBL,TH,TD,GRID,Campo,Inp,TA,Sel,Btn,Sec,Pill,Barra,Vacio,Dato,n,numONull,txtONull,fmtUsd,fmtFecha,hoyISO,codigoMaq,codigoPed,ESTADOS_PEDIDO,estadoPed,ChipPed,CATEG_MOV } from "./ui";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const nombreCliente=(c)=>c?(c.company_name||`${c.first_name||""} ${c.last_name||""}`.trim()||c.email||"—"):"—";
export const cobradoDe=(movs,pid)=>movs.filter(m=>m.pedido_id===pid&&m.tipo==="ingreso").reduce((s,m)=>s+n(m.monto_usd),0);
export const pagadoFabricaDe=(movs,pid)=>movs.filter(m=>m.pedido_id===pid&&m.tipo==="egreso"&&m.categoria==="pago_fabrica").reduce((s,m)=>s+n(m.monto_usd),0);
const ACTIVOS=["nuevo","pagado","en_produccion","prueba_fabrica","listo_fabrica","en_importacion"];

export function Pedidos({ses,dq,token,prods,provs,ajustes,pedidos,movs,ops,recargar,inicialSel}){
  const [sel,setSel]=useState(inicialSel||null);
  const [nuevo,setNuevo]=useState(false);
  const [fEstado,setFEstado]=useState("activos");
  const [busq,setBusq]=useState("");
  const visibles=pedidos.filter(p=>(fEstado==="todos"||(fEstado==="activos"?ACTIVOS.includes(p.estado):p.estado===fEstado))&&(!busq.trim()||`${codigoPed(p)} ${p.cliente_nombre||""} ${(p.items||[]).map(i=>i.nombre).join(" ")}`.toLowerCase().includes(busq.toLowerCase())));
  const cuenta=(k)=>k==="activos"?pedidos.filter(p=>ACTIVOS.includes(p.estado)).length:pedidos.filter(p=>p.estado===k).length;

  if(nuevo)return <NuevoPedido ses={ses} dq={dq} prods={prods} provs={provs} ajustes={ajustes} onCerrar={()=>setNuevo(false)} onCreado={async(id)=>{await recargar();setNuevo(false);setSel(id);}}/>;
  if(sel){const p=pedidos.find(x=>x.id===sel);if(p)return <DetallePedido p={p} ses={ses} dq={dq} token={token} ajustes={ajustes} movs={movs} ops={ops||[]} recargar={recargar} onCerrar={()=>setSel(null)}/>;}
  return <>
    <Barra>
      {[["activos","Activos"],["todos","Todos"],["entregado","Entregados"],["cancelado","Cancelados"]].map(([k,l])=><Pill key={k} on={fEstado===k} onClick={()=>setFEstado(k)}>{l} <span style={{color:GRIS,fontFamily:MONO,fontSize:11}}>{k==="todos"?pedidos.length:cuenta(k)}</span></Pill>)}
      <input placeholder="Buscar…" value={busq} onChange={e=>setBusq(e.target.value)} style={{...INP,flex:1,minWidth:180,borderRadius:999,padding:"10px 18px"}}/>
      <Btn kind="lima" onClick={()=>setNuevo(true)}>+ Nuevo pedido</Btn>
    </Barra>
    {visibles.length===0?<Vacio>{pedidos.length===0?"Todavía no hay pedidos.":"Nada que coincida."}</Vacio>
    :<div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
      <thead><tr>{["Pedido","Fecha","Cliente","Máquinas","Estado","Precio","Cobrado","Días"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{visibles.map(p=>{const cob=cobradoDe(movs,p.id);const dias=Math.floor((Date.now()-new Date(p.updated_at))/864e5);return <tr key={p.id} className="fila" onClick={()=>setSel(p.id)} style={{cursor:"pointer"}}>
        <td style={{...TD,fontFamily:MONO,fontWeight:600}}>{codigoPed(p)}</td>
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
function NuevoPedido({ses,dq,prods,provs,ajustes,onCerrar,onCreado}){
  const [q,setQ]=useState("");const [res,setRes]=useState([]);const [cli,setCli]=useState(null);const [buscando,setBuscando]=useState(false);
  const [items,setItems]=useState([]);
  const [prueba,setPrueba]=useState(false);
  const [importacion,setImportacion]=useState("");
  const [notas,setNotas]=useState("");
  const [guardando,setGuardando]=useState(false);
  const [busqMaq,setBusqMaq]=useState("");
  const publicadas=prods.filter(p=>p.estado!=="borrador"&&n(p.exw_usd)>0);
  const candidatas=busqMaq.trim()?publicadas.filter(p=>`${codigoMaq(p)} ${p.nombre||""} ${p.modelo||""}`.toLowerCase().includes(busqMaq.toLowerCase())).slice(0,8):[];

  const buscar=async(t)=>{setQ(t);if(t.trim().length<2){setRes([]);return;}setBuscando(true);try{
    const s=t.trim().replace(/[%,()]/g,"");
    const r=await dq("clients",{filters:`?select=id,client_code,first_name,last_name,company_name,email,whatsapp,cuit,tax_condition&or=(first_name.ilike.*${s}*,last_name.ilike.*${s}*,company_name.ilike.*${s}*,email.ilike.*${s}*,client_code.ilike.*${s}*,whatsapp.ilike.*${s}*)&limit=8`});
    setRes(Array.isArray(r)?r:[]);
  }catch(e){toast(e.message,"error");}setBuscando(false);};
  const agregar=(p)=>{if(items.some(i=>i.producto_id===p.id))return;const prov=provs.find(x=>x.id===p.proveedor_id);setItems(x=>[...x,{producto_id:p.id,codigo:codigoMaq(p),nombre:p.nombre||p.nombre_raw,qty:"1",exw_unit:String(p.exw_usd),gestion_pct:p.markup_pct!=null?String(p.markup_pct):String(ajustes.gestion_pct),proveedor:prov?`${prov.fabrica} · ${prov.ciudad}`:null,dias_produccion:p.dias_produccion||null}]);setBusqMaq("");};
  const up=(i,k,v)=>setItems(x=>x.map((it,j)=>j===i?{...it,[k]:v}:it));
  const tot=totalesPedido(items,ajustes,prueba);
  const crear=async()=>{if(!cli){toast("Elegí el cliente","error");return;}if(!items.length){toast("Agregá al menos una máquina","error");return;}setGuardando(true);try{
    const body={estado:"nuevo",client_id:cli.id,cliente_nombre:nombreCliente(cli),cliente_contacto:[cli.whatsapp,cli.email].filter(Boolean).join(" · ")||null,
      items:items.map(it=>({...it,qty:Math.max(1,n(it.qty,1)),exw_unit:n(it.exw_unit),gestion_pct:n(it.gestion_pct)})),
      prueba_fabrica:prueba,exw_total:tot.exw_total,financiero:tot.financiero,gestion:tot.gestion,prueba_monto:tot.prueba_monto,precio_total:tot.precio_total,
      importacion_usd:numONull(importacion),notas:txtONull(notas),historial:[{estado:"nuevo",at:new Date().toISOString(),by:ses.user?.email||null}],created_by:ses.user?.id||null};
    const r=await dq("cat_pedidos",{method:"POST",body});const row=Array.isArray(r)?r[0]:r;toast(`Pedido ${codigoPed(row)} creado`);onCreado(row.id);
  }catch(e){toast(e.message,"error");}setGuardando(false);};

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,margin:"0 0 22px"}}><Btn small onClick={onCerrar}>← Pedidos</Btn><span style={{fontWeight:800,fontSize:15}}>Nuevo pedido</span></div>
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
      <div style={{position:"relative"}}><Inp placeholder="Agregar máquina del catálogo…" value={busqMaq} onChange={e=>setBusqMaq(e.target.value)}/>
        {candidatas.length>0&&<div style={{position:"absolute",left:0,right:0,top:"100%",zIndex:5,marginTop:6,border:`1px solid ${BORDE}`,borderRadius:14,overflow:"hidden",background:CARD,boxShadow:"0 10px 30px rgba(0,0,0,0.08)"}}>{candidatas.map(p=><button key={p.id} className="fila" onClick={()=>agregar(p)} style={{display:"flex",gap:12,alignItems:"center",width:"100%",textAlign:"left",padding:"10px 14px",border:"none",background:CARD,color:INK,cursor:"pointer",fontSize:13.5}}><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS}}>{codigoMaq(p)}</span><span style={{fontWeight:800,flex:1}}>{p.nombre||p.nombre_raw}</span><span style={{fontFamily:MONO,fontSize:12}}>EXW {fmtUsd(p.exw_usd)}</span></button>)}</div>}
      </div>
      {publicadas.length===0&&<p style={{margin:"10px 0 0",fontSize:13,color:GRIS}}>No hay máquinas publicadas con EXW cargado.</p>}
    </Sec>
    <Sec titulo="Condiciones">
      <div className="grid3" style={GRID}>
        <Campo label="Prueba en fábrica"><div style={{display:"flex",gap:8}}><Pill on={!prueba} onClick={()=>setPrueba(false)}>No</Pill><Pill on={prueba} onClick={()=>setPrueba(true)}>Sí · {fmtUsd(ajustes.prueba_fabrica_precio)}</Pill></div></Campo>
        <Campo label="Importación cotizada por Argencargo (USD)"><Inp type="number" step="0.01" value={importacion} onChange={e=>setImportacion(e.target.value)}/></Campo>
        <Campo label="Notas" span={3}><TA value={notas} onChange={e=>setNotas(e.target.value)} style={{minHeight:70}}/></Campo>
      </div>
    </Sec>
    <Totales tot={tot} importacion={numONull(importacion)} ajustes={ajustes}/>
    <div style={{position:"sticky",bottom:0,background:BG,borderTop:`1px solid ${BORDE}`,margin:"0 -28px",padding:"14px 28px",display:"flex",gap:10,alignItems:"center"}}>
      <Btn kind="lima" onClick={crear} disabled={guardando||!cli||!items.length}>{guardando?"Creando…":"Crear pedido"}</Btn>
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
      {fila("Precio de la máquina · lo cobra la unidad",tot.precio_total,true)}
      {importacion!=null&&fila("Importación · la cobra Argencargo",importacion)}
      {importacion!=null&&fila("Total para el cliente",tot.precio_total+importacion,true)}
    </div>
    <p style={{margin:"10px 0 0",fontSize:12.5,color:tot.cubreAdelanto?OK:BAD}}>{tot.cubreAdelanto?`El precio cubre el adelanto mínimo (EXW + ${ajustes.adelanto_extra_pct} % = ${fmtUsd(tot.adelantoMinimo)}).`:`El precio no cubre el adelanto mínimo (EXW + ${ajustes.adelanto_extra_pct} % = ${fmtUsd(tot.adelantoMinimo)}): subí la gestión.`}</p>
  </Sec>;
}

// ── Detalle ───────────────────────────────────────────────────────────────────────────────
function DetallePedido({p,ses,dq,token,ajustes,movs,ops,recargar,onCerrar}){
  const [mov,setMov]=useState(null); // {tipo,categoria}
  const [edit,setEdit]=useState(false);
  const [imp,setImp]=useState(p.importacion_usd==null?"":String(p.importacion_usd));
  const [opId,setOpId]=useState(p.operation_id||"");
  const [notas,setNotas]=useState(p.notas||"");
  const [guardando,setGuardando]=useState(false);
  const cob=cobradoDe(movs,p.id), pag=pagadoFabricaDe(movs,p.id);
  const misMovs=movs.filter(m=>m.pedido_id===p.id);
  const otrosGastos=misMovs.filter(m=>m.tipo==="egreso"&&m.categoria!=="pago_fabrica");
  const egresos=misMovs.filter(m=>m.tipo==="egreso").reduce((s,m)=>s+n(m.monto_usd),0);
  const op=ops.find(o=>o.id===(p.operation_id||opId))||null;
  const OP_ESTADO={pendiente:"Pendiente",en_transito:"En tránsito",en_aduana:"En aduana",lista_retiro:"Lista para retirar",entregada:"Entregada"};
  const idx=ESTADOS_PEDIDO.findIndex(e=>e.k===p.estado);
  const siguiente=p.estado==="entregado"||p.estado==="cancelado"?null:ESTADOS_PEDIDO[(p.estado==="en_produccion"&&!p.prueba_fabrica)?idx+2:idx+1];
  const tot={exw_total:n(p.exw_total),financiero:n(p.financiero),gestion:n(p.gestion),prueba_monto:n(p.prueba_monto),precio_total:n(p.precio_total),adelantoMinimo:n(p.exw_total)*(1+n(ajustes.adelanto_extra_pct)/100),cubreAdelanto:n(p.precio_total)>=n(p.exw_total)*(1+n(ajustes.adelanto_extra_pct)/100)};

  const cambiarEstado=async(k)=>{if(k==="cancelado"&&!(await confirmDialog(`¿Cancelar ${codigoPed(p)}?`)))return;try{
    await dq("cat_pedidos",{method:"PATCH",filters:`?id=eq.${p.id}`,body:{estado:k,historial:[...(p.historial||[]),{estado:k,at:new Date().toISOString(),by:ses.user?.email||null}]}});await recargar();toast(estadoPed(k).l);
  }catch(e){toast(e.message,"error");}};
  const guardarDatos=async()=>{setGuardando(true);try{const o=ops.find(x=>x.id===opId);await dq("cat_pedidos",{method:"PATCH",filters:`?id=eq.${p.id}`,body:{importacion_usd:numONull(imp),operation_id:opId||null,operation_ref:o?o.operation_code:null,notas:txtONull(notas)}});await recargar();setEdit(false);toast("Guardado");}catch(e){toast(e.message,"error");}setGuardando(false);};
  const eliminar=async()=>{if(!(await confirmDialog(`¿Eliminar ${codigoPed(p)} y sus movimientos? No se puede deshacer.`)))return;try{await dq("cat_movimientos",{method:"DELETE",filters:`?pedido_id=eq.${p.id}`,prefer:"return=minimal"});await dq("cat_pedidos",{method:"DELETE",filters:`?id=eq.${p.id}`,prefer:"return=minimal"});await recargar();toast("Eliminado");onCerrar();}catch(e){toast(e.message,"error");}};

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"0 0 22px"}}>
      <Btn small onClick={onCerrar}>← Pedidos</Btn>
      <span style={{fontFamily:MONO,fontSize:13,fontWeight:600,letterSpacing:"0.08em"}}>{codigoPed(p)}</span>
      <ChipPed e={p.estado}/>
      <span style={{fontSize:13,color:GRIS}}>{fmtFecha(p.created_at)}</span>
      <span style={{flex:1}}/>
      {siguiente&&<Btn kind="lima" onClick={()=>cambiarEstado(siguiente.k)}>→ {siguiente.l}</Btn>}
      {p.estado!=="cancelado"&&p.estado!=="entregado"&&<Btn small kind="danger" onClick={()=>cambiarEstado("cancelado")}>Cancelar pedido</Btn>}
      {ses.rol==="admin"&&<Btn small kind="danger" onClick={eliminar}>Eliminar</Btn>}
    </div>

    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
      {ESTADOS_PEDIDO.filter(e=>e.k!=="cancelado"&&(e.k!=="prueba_fabrica"||p.prueba_fabrica)).map((e,i,arr)=>{const pos=arr.findIndex(x=>x.k===p.estado);const hecho=i<=pos&&p.estado!=="cancelado";return <span key={e.k} style={{fontFamily:MONO,fontSize:10.5,letterSpacing:"0.06em",padding:"5px 10px",borderRadius:999,background:hecho?(i===pos?LIMA_SUAVE:OK_BG):SUAVE,color:hecho?INK:GRIS,fontWeight:i===pos?700:500}}>{e.l.toUpperCase()}</span>;})}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:14}}>
      <Dato l="Cliente" v={p.cliente_nombre||"—"} sub={p.cliente_contacto}/>
      <Dato l="Precio de la máquina" v={fmtUsd(p.precio_total)} sub="lo cobra la unidad"/>
      <Dato l="Cobrado" v={fmtUsd(cob)} sub={cob>=n(p.precio_total)-0.01?"completo":`faltan ${fmtUsd(n(p.precio_total)-cob)}`} color={cob>=n(p.precio_total)-0.01?OK:cob>0?WARN:INK}/>
      <Dato l="Pagado a fábrica" v={fmtUsd(pag)} sub={pag>=n(p.exw_total)-0.01?"EXW completo":`faltan ${fmtUsd(n(p.exw_total)-pag)} de EXW`} color={pag>=n(p.exw_total)-0.01?OK:pag>0?WARN:INK}/>
    </div>

    <Sec titulo="Máquinas">
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
        <thead><tr>{["Máquina","Proveedor","Cant.","EXW unit.","Gestión","Producción"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>{(p.items||[]).map((it,i)=><tr key={i}><td style={{...TD,fontWeight:800}}>{it.nombre}<br/><span style={{fontFamily:MONO,fontSize:11,color:GRIS,fontWeight:500}}>{it.codigo}</span></td><td style={{...TD,color:GRIS}}>{it.proveedor||"—"}</td><td style={{...TD,fontFamily:MONO}}>{it.qty}</td><td style={{...TD,fontFamily:MONO}}>{fmtUsd(it.exw_unit)}</td><td style={{...TD,fontFamily:MONO}}>{String(it.gestion_pct).replace(".",",")} %</td><td style={{...TD,color:GRIS}}>{it.dias_produccion?`${it.dias_produccion} días`:"—"}</td></tr>)}</tbody>
      </table></div>
    </Sec>

    <Totales tot={tot} importacion={p.importacion_usd==null?null:n(p.importacion_usd)} ajustes={ajustes}/>

    <Sec titulo="Cobros del cliente" extra={<Btn small onClick={()=>setMov({tipo:"ingreso",categoria:"cobro_cliente"})}>+ Registrar cobro</Btn>}>
      <ListaMovs lista={misMovs.filter(m=>m.tipo==="ingreso")} dq={dq} recargar={recargar} admin={ses.rol==="admin"}/>
    </Sec>
    <Sec titulo="Pagos a fábrica" extra={<Btn small onClick={()=>setMov({tipo:"egreso",categoria:"pago_fabrica"})}>+ Registrar pago</Btn>}>
      <ListaMovs lista={misMovs.filter(m=>m.tipo==="egreso"&&m.categoria==="pago_fabrica")} dq={dq} recargar={recargar} admin={ses.rol==="admin"}/>
    </Sec>
    <Sec titulo="Otros gastos del pedido" extra={<Btn small onClick={()=>setMov({tipo:"egreso"})}>+ Registrar gasto</Btn>}>
      <ListaMovs lista={otrosGastos} dq={dq} recargar={recargar} admin={ses.rol==="admin"}/>
    </Sec>
    <section style={{background:SUAVE,borderRadius:18,padding:"20px 22px",marginBottom:14}}>
      <p style={{...LBL,marginBottom:12}}>Resultado del pedido</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14}}>
        <div><p style={{...LBL,marginBottom:2}}>Cobrado</p><b style={{fontSize:18,color:OK}}>{fmtUsd(cob)}</b></div>
        <div><p style={{...LBL,marginBottom:2}}>Pagado a fábrica</p><b style={{fontSize:18}}>{fmtUsd(pag)}</b></div>
        <div><p style={{...LBL,marginBottom:2}}>Otros gastos</p><b style={{fontSize:18}}>{fmtUsd(egresos-pag)}</b></div>
        <div><p style={{...LBL,marginBottom:2}}>Ganancia real</p><b style={{fontSize:22,color:cob-egresos>=0?OK:BAD}}>{fmtUsd(cob-egresos)}</b><span style={{display:"block",fontSize:12,color:GRIS}}>prevista {fmtUsd(n(p.gestion)+(p.prueba_fabrica?n(p.prueba_monto)-n(ajustes.prueba_fabrica_costo):0))}</span></div>
      </div>
    </section>
    {mov&&<FormMov token={token} dq={dq} ses={ses} pedido={p} fijo={mov} onCerrar={()=>setMov(null)} onHecho={async()=>{setMov(null);await recargar();}}/>}

    <Sec titulo="Argencargo y notas" extra={edit?<div style={{display:"flex",gap:8}}><Btn small kind="lima" onClick={guardarDatos} disabled={guardando}>Guardar</Btn><Btn small onClick={()=>setEdit(false)}>Cancelar</Btn></div>:<Btn small onClick={()=>setEdit(true)}>Editar</Btn>}>
      <div className="grid3" style={GRID}>
        <Campo label="Importación cotizada (USD)">{edit?<Inp type="number" step="0.01" value={imp} onChange={e=>setImp(e.target.value)}/>:<p style={{margin:0,fontFamily:MONO,fontWeight:700}}>{p.importacion_usd==null?"—":fmtUsd(p.importacion_usd)}</p>}</Campo>
        <Campo label="Operación de Argencargo" hint={!edit&&op?`${OP_ESTADO[op.status]||op.status}${op.eta?` · ETA ${fmtFecha(op.eta)}`:""}${op.description?` · ${op.description}`:""}`:null}>{edit?<Sel value={opId} onChange={e=>setOpId(e.target.value)}><option value="">Sin vincular</option>{ops.map(o=><option key={o.id} value={o.id}>{o.operation_code} · {OP_ESTADO[o.status]||o.status}{o.description?` · ${o.description.slice(0,40)}`:""}</option>)}</Sel>:<p style={{margin:0,fontFamily:MONO,fontWeight:700}}>{op?<a href={`/track/${op.operation_code}`} target="_blank" rel="noreferrer" style={{color:INK}}>{op.operation_code} ↗</a>:p.operation_ref||"—"}</p>}</Campo>
        <Campo label="Notas" span={3}>{edit?<TA value={notas} onChange={e=>setNotas(e.target.value)} style={{minHeight:70}}/>:<p style={{margin:0,fontSize:13.5,whiteSpace:"pre-wrap",color:p.notas?INK:GRIS}}>{p.notas||"—"}</p>}</Campo>
      </div>
    </Sec>

    {Array.isArray(p.historial)&&p.historial.length>0&&<Sec titulo="Historial"><div style={{display:"grid",gap:6}}>{[...p.historial].reverse().map((h,i)=><div key={i} style={{display:"flex",gap:12,fontSize:13,alignItems:"center"}}><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS,whiteSpace:"nowrap"}}>{new Date(h.at).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><ChipPed e={h.estado}/><span style={{color:GRIS}}>{h.by||""}</span></div>)}</div></Sec>}
  </div>;
}

export function ListaMovs({lista,dq,recargar,admin,conPedido,pedidos}){
  const borrar=async(m)=>{if(!(await confirmDialog(`¿Eliminar el movimiento de ${fmtUsd(m.monto_usd)}?`)))return;try{await dq("cat_movimientos",{method:"DELETE",filters:`?id=eq.${m.id}`,prefer:"return=minimal"});await recargar();toast("Eliminado");}catch(e){toast(e.message,"error");}};
  if(!lista.length)return <p style={{margin:0,fontSize:13,color:GRIS}}>Sin movimientos.</p>;
  return <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
    <thead><tr>{["Fecha","Concepto",...(conPedido?["Pedido"]:[]),"Categoría","Monto","Comprobante",""].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
    <tbody>{lista.map(m=>{const ped=conPedido&&m.pedido_id?pedidos?.find(x=>x.id===m.pedido_id):null;return <tr key={m.id}>
      <td style={{...TD,fontFamily:MONO,fontSize:12.5,whiteSpace:"nowrap"}}>{fmtFecha(m.fecha)}</td>
      <td style={{...TD,fontWeight:700}}>{m.concepto||CATEG_MOV[m.categoria]}</td>
      {conPedido&&<td style={{...TD,fontFamily:MONO,fontSize:12.5}}>{ped?codigoPed(ped):"—"}</td>}
      <td style={{...TD,color:GRIS,fontSize:12.5}}>{CATEG_MOV[m.categoria]||m.categoria}</td>
      <td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap",fontWeight:700,color:m.tipo==="ingreso"?OK:BAD}}>{m.tipo==="ingreso"?"+":"−"} {fmtUsd(m.monto_usd)}</td>
      <td style={TD}>{m.comprobante_url?<a href={m.comprobante_url} target="_blank" rel="noreferrer" style={{color:INK,fontWeight:700,fontSize:12.5}}>Ver</a>:<span style={{color:GRIS}}>—</span>}</td>
      <td style={{...TD,textAlign:"right"}}>{admin&&<Btn small kind="danger" onClick={()=>borrar(m)}>✕</Btn>}</td>
    </tr>;})}</tbody>
  </table></div>;
}

// Alta de un movimiento: desde un pedido (tipo y categoría fijos) o desde el libro diario (libres).
export function FormMov({token,dq,ses,pedido,fijo,pedidos,onCerrar,onHecho}){
  const [f,setF]=useState({fecha:hoyISO(),tipo:fijo?.tipo||"egreso",categoria:fijo?.categoria||"gasto",concepto:"",monto:"",pedido_id:pedido?.id||"",archivo:null});
  const [guardando,setGuardando]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const guardar=async()=>{if(n(f.monto)<=0){toast("Cargá el monto","error");return;}setGuardando(true);try{
    let url=null;
    if(f.archivo){const ext=(f.archivo.name.split(".").pop()||"bin").toLowerCase();const path=`comprobantes/${pedido?.id||"libro"}/${Date.now()}.${ext}`;const r=await fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"POST",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`,"Content-Type":f.archivo.type||"application/octet-stream"},body:f.archivo});if(!r.ok)throw new Error(`No se pudo subir el comprobante (${r.status})`);url=`${SB_URL}/storage/v1/object/public/catalogo/${path}`;}
    await dq("cat_movimientos",{method:"POST",body:{fecha:f.fecha,tipo:f.tipo,categoria:f.categoria,concepto:txtONull(f.concepto),monto_usd:n(f.monto),pedido_id:f.pedido_id||null,comprobante_url:url,created_by:ses.user?.id||null}});
    toast("Registrado");onHecho();
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const cats=f.tipo==="ingreso"?["cobro_cliente","otro"]:["pago_fabrica","prueba_fabrica","argencargo","gasto","otro"];
  return <Sec titulo={fijo?(fijo.tipo==="ingreso"?"Registrar cobro":fijo.categoria?"Registrar pago":"Registrar gasto"):"Nuevo movimiento"} style={{borderColor:INK}}>
    <div className="grid3" style={GRID}>
      <Campo label="Fecha"><Inp type="date" value={f.fecha} onChange={e=>set("fecha",e.target.value)}/></Campo>
      {!fijo&&<Campo label="Tipo"><div style={{display:"flex",gap:8}}><Pill on={f.tipo==="ingreso"} onClick={()=>{set("tipo","ingreso");set("categoria","otro");}}>Ingreso</Pill><Pill on={f.tipo==="egreso"} onClick={()=>{set("tipo","egreso");set("categoria","gasto");}}>Egreso</Pill></div></Campo>}
      {(!fijo||!fijo.categoria)&&<Campo label="Categoría"><Sel value={f.categoria} onChange={e=>set("categoria",e.target.value)}>{cats.filter(c=>!fijo||c!=="pago_fabrica").map(c=><option key={c} value={c}>{CATEG_MOV[c]}</option>)}</Sel></Campo>}
      <Campo label="Monto (USD)" ob><Inp type="number" step="0.01" value={f.monto} onChange={e=>set("monto",e.target.value)}/></Campo>
      <Campo label="Concepto" span={fijo&&fijo.categoria?2:3}><Inp value={f.concepto} onChange={e=>set("concepto",e.target.value)}/></Campo>
      {!fijo&&pedidos&&<Campo label="Pedido"><Sel value={f.pedido_id} onChange={e=>set("pedido_id",e.target.value)}><option value="">Sin pedido</option>{pedidos.map(p=><option key={p.id} value={p.id}>{codigoPed(p)} · {p.cliente_nombre}</option>)}</Sel></Campo>}
      <Campo label="Comprobante"><input type="file" accept="image/*,application/pdf" onChange={e=>set("archivo",e.target.files?.[0]||null)} style={{fontSize:13}}/></Campo>
    </div>
    <div style={{display:"flex",gap:8,marginTop:14}}><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn><Btn onClick={onCerrar}>Cancelar</Btn></div>
  </Sec>;
}
