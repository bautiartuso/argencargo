"use client";
// Operaciones de ARGENMAQ (AM-00001): un cliente de la base de Argencargo pide una o más máquinas
// del catálogo; la operación congela precios y % de gestión y avanza por estados.
// Por dentro: Resumen · Finanzas · Seguimiento · Entrega.
// Finanzas sigue la metodología de las ops de Argencargo: presupuesto (anticipo = precio de la
// máquina, contra entrega = importación), cobros con método/comisión/tipo de cambio y destino
// (financiera → movimiento automático en la CC), costos (fábrica, Argencargo, otros) y rentabilidad.
import { useState, useEffect } from "react";
import { totalesPedido } from "../../../lib/catalogo-precio";
import { INK,GRIS,BORDE,SUAVE,CARD,BG,LIMA,LIMA_SUAVE,OK,OK_BG,WARN,WARN_BG,BAD,BAD_BG,MONO,INP,LBL,TH,TD,GRID,DOS,Campo,Inp,TA,Btn,Sec,Pill,Barra,Vacio,Dato,Desplegable,Fecha,Archivo,Solapas,n,numONull,txtONull,fmtUsd,fmtMon,fmtNum,fmtFecha,hoyISO,codigoMaq,codigoOp,ESTADOS_PEDIDO,ACTIVOS,estadoPed,ChipPed,CATEG_MOV,nombreCliente,toast,confirmDialog } from "./ui";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
export const cobradoDe=(movs,pid)=>movs.filter(m=>m.pedido_id===pid&&m.tipo==="ingreso").reduce((s,m)=>s+n(m.monto_usd),0);
export const pagadoFabricaDe=(movs,pid)=>movs.filter(m=>m.pedido_id===pid&&m.tipo==="egreso"&&m.categoria==="pago_fabrica").reduce((s,m)=>s+n(m.monto_usd),0);
const OP_ESTADO={pendiente:"Pendiente",en_transito:"En tránsito",en_aduana:"En aduana",lista_retiro:"Lista para retirar",entregada:"Entregada"};
const METODO={transferencia:"Transferencia",efectivo:"Efectivo",cripto:"Cripto (USDT)",financiera:"SOLFIN · Cable Financiera",tarjeta:"Tarjeta",contado:"Contado",otro:"Otro"};

async function subirComprobante(token,file,carpeta){
  const ext=(file.name.split(".").pop()||"bin").toLowerCase();const path=`comprobantes/${carpeta}/${Date.now()}.${ext}`;
  const r=await fetch(`${SB_URL}/storage/v1/object/catalogo/${path}`,{method:"POST",headers:{apikey:SB_KEY,Authorization:`Bearer ${token}`,"Content-Type":file.type||"application/octet-stream"},body:file});
  if(!r.ok)throw new Error(`No se pudo subir el comprobante (${r.status})`);
  return `${SB_URL}/storage/v1/object/public/catalogo/${path}`;
}

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
      <thead><tr>{["Operación","Fecha","Cliente","Máquinas","Estado","Presupuesto","Cobrado","Días"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{visibles.map(p=>{const cob=cobradoDe(movs,p.id);const pres=n(p.precio_total)+n(p.importacion_usd);const dias=Math.floor((Date.now()-new Date(p.updated_at))/864e5);return <tr key={p.id} className="fila" onClick={()=>setSel(p.id)} style={{cursor:"pointer"}}>
        <td style={{...TD,fontFamily:MONO,fontWeight:600}}>{codigoOp(p)}</td>
        <td style={{...TD,color:GRIS,whiteSpace:"nowrap"}}>{fmtFecha(p.created_at)}</td>
        <td style={{...TD,fontWeight:800}}>{p.cliente_nombre||"—"}</td>
        <td style={{...TD,maxWidth:340}}><span style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(p.items||[]).map(i=>`${i.qty>1?`${i.qty}× `:""}${i.nombre}`).join(" · ")||"—"}</span></td>
        <td style={TD}><ChipPed e={p.estado}/></td>
        <td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap"}}>{fmtUsd(pres)}</td>
        <td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap",color:cob>=pres-0.01?OK:cob>0?WARN:GRIS}}>{fmtUsd(cob)}</td>
        <td style={{...TD,fontFamily:MONO,color:GRIS}}>{dias}</td>
      </tr>;})}</tbody>
    </table></div></div>}
  </>;
}

// ── Alta ──────────────────────────────────────────────────────────────────────────────────
function NuevaOperacion({ses,dq,prods,provs,ajustes,onCerrar,onCreado}){
  const [q,setQ]=useState("");const [res,setRes]=useState([]);const [cli,setCli]=useState(null);const [buscando,setBuscando]=useState(false);
  const [items,setItems]=useState([]);
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
  const tot=totalesPedido(items,ajustes,numONull(importacion)||0);
  const crear=async()=>{if(!cli){toast("Elegí el cliente","error");return;}if(!items.length){toast("Agregá al menos una máquina","error");return;}setGuardando(true);try{
    const body={estado:"nuevo",client_id:cli.id,cliente_nombre:nombreCliente(cli),cliente_contacto:[cli.whatsapp,cli.email].filter(Boolean).join(" · ")||null,
      items:items.map(it=>({...it,qty:Math.max(1,n(it.qty,1)),exw_unit:n(it.exw_unit),gestion_pct:n(it.gestion_pct)})),
      prueba_fabrica:false,exw_total:tot.exw_total,financiero:tot.financiero,gestion:tot.gestion,prueba_monto:0,precio_total:tot.precio_total,
      importacion_usd:numONull(importacion),notas:txtONull(notas),historial:[{estado:"nuevo",at:new Date().toISOString(),by:ses.user?.email||null}],created_by:ses.user?.id||null};
    const r=await dq("cat_pedidos",{method:"POST",body});const row=Array.isArray(r)?r[0]:r;toast(`Operación ${codigoOp(row)} creada`);onCreado(row.id);
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,margin:"0 0 22px"}}><Btn small onClick={onCerrar}>← Operaciones</Btn><span style={{fontWeight:800,fontSize:15}}>Nueva operación</span></div>
    <Sec titulo="Cliente">
      {cli?<div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",background:SUAVE,borderRadius:14,padding:"12px 14px"}}><span style={{fontWeight:800}}>{nombreCliente(cli)}</span>{cli.client_code&&<span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{cli.client_code}</span>}{cli.whatsapp&&<span style={{fontSize:13}}>{cli.whatsapp}</span>}{cli.email&&<span style={{fontSize:13,color:GRIS}}>{cli.email}</span>}<span style={{flex:1}}/><Btn small onClick={()=>setCli(null)}>Cambiar</Btn></div>
      :<div><Inp placeholder="Buscar en los clientes de Argencargo: nombre, empresa, email, WhatsApp o código…" value={q} onChange={e=>buscar(e.target.value)}/>
        {(res.length>0||buscando)&&<div style={{marginTop:8,border:`1px solid ${BORDE}`,borderRadius:14,overflow:"hidden"}}>{buscando&&res.length===0&&<p style={{margin:0,padding:"10px 14px",color:GRIS,fontSize:13}}>Buscando…</p>}{res.map(c=><button key={c.id} className="fila" onClick={()=>{setCli(c);setRes([]);setQ("");}} style={{display:"flex",gap:12,alignItems:"center",width:"100%",textAlign:"left",padding:"10px 14px",border:"none",borderTop:`1px solid ${BORDE}`,background:CARD,color:INK,cursor:"pointer",fontSize:13.5}}><span style={{fontWeight:800}}>{nombreCliente(c)}</span><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS}}>{c.client_code}</span><span style={{color:GRIS}}>{c.whatsapp||c.email}</span></button>)}</div>}
      </div>}
    </Sec>
    <Sec titulo="Máquinas">
      {items.length>0&&<div style={{overflowX:"auto",marginBottom:12}}><table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 6px"}}>
        <thead><tr>{["Máquina","Cantidad","EXW unitario","Gestión (%)","Precio línea",""].map(h=><th key={h} style={{...LBL,display:"table-cell",textAlign:"left",padding:"0 6px 2px",marginBottom:0,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{items.map((it,i)=>{const l=totalesPedido([it],{...ajustes,fin_fijo_usd:0,fin_pct:0},0);return <tr key={it.producto_id}>
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
    <Sec titulo="Importación y notas">
      <div className="grid3" style={GRID}>
        <Campo label="Importación cotizada por Argencargo (USD)"><Inp type="number" step="0.01" value={importacion} onChange={e=>setImportacion(e.target.value)}/></Campo>
        <Campo label="Notas" span={2}><TA value={notas} onChange={e=>setNotas(e.target.value)} style={{minHeight:46}}/></Campo>
      </div>
    </Sec>
    <Presupuesto tot={tot} importacion={numONull(importacion)} ajustes={ajustes}/>
    <div style={{position:"sticky",bottom:0,background:BG,borderTop:`1px solid ${BORDE}`,margin:"0 -28px",padding:"14px 28px",display:"flex",gap:10,alignItems:"center"}}>
      <Btn kind="lima" onClick={crear} disabled={guardando||!cli||!items.length}>{guardando?"Creando…":"Crear operación"}</Btn>
      <Btn onClick={onCerrar}>Cancelar</Btn>
    </div>
  </div>;
}

// Presupuesto: cómo se arma el precio y cómo se cobra (anticipo = máquina, contra entrega = importación).
function Presupuesto({tot,importacion,ajustes,cobrado,onRecalcular}){
  const anticipo=tot.precio_total, contra=importacion||0, total=anticipo+contra;
  // Lo cobrado se aplica primero al anticipo y después a la contra entrega.
  const cobA=cobrado==null?null:Math.min(cobrado,anticipo), cobC=cobrado==null?null:Math.max(0,Math.min(cobrado-anticipo,contra));
  const chip=(monto,cob)=>{if(cob==null)return null;const s=cob>=monto-0.01?{l:"COBRADO",c:OK,bg:OK_BG}:cob>0.01?{l:"PARCIAL",c:WARN,bg:WARN_BG}:{l:"PENDIENTE",c:GRIS,bg:SUAVE};return <span style={{fontFamily:MONO,fontSize:10,padding:"3px 8px",borderRadius:6,background:s.bg,color:s.c,whiteSpace:"nowrap"}}>{s.l}</span>;};
  const Fila=({l,monto,cob,b})=><div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"4px 16px",alignItems:"center",padding:"10px 0",borderTop:b?`1px solid ${BORDE}`:"none"}}>
    <span style={{fontSize:b?15:14,fontWeight:b?800:700}}>{l}</span><b style={{fontFamily:MONO,fontSize:b?18:15,textAlign:"right"}}>{fmtUsd(monto)}</b>{cob!=null?chip(monto,cob):<span/>}
    {cob!=null&&monto>0&&<span style={{gridColumn:"1 / -1",fontSize:12,color:GRIS,fontFamily:MONO}}>cobrado {fmtUsd(cob)} · pendiente {fmtUsd(Math.max(0,monto-cob))}</span>}
  </div>;
  return <Sec titulo="Presupuesto" extra={<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>EXW {fmtUsd(tot.exw_total)} · FINANCIERO {fmtUsd(tot.financiero)} · GESTIÓN {fmtUsd(tot.gestion)}{contra>0?` · IMPORTACIÓN ${fmtUsd(contra)}`:""}</span>{onRecalcular&&<Btn small onClick={onRecalcular} title="Vuelve a calcular financiero y gestión con las tarifas de hoy">Recalcular</Btn>}</div>}>
    <Fila l="Anticipo · máquina" monto={anticipo} cob={cobA}/>
    {contra>0&&<Fila l="Contra entrega · importación" monto={contra} cob={cobC}/>}
    <Fila l="Total" monto={total} cob={cobrado} b/>
    <p style={{margin:"8px 0 0",fontSize:12,color:tot.cubreAdelanto?OK:BAD}}>{tot.cubreAdelanto?`El anticipo cubre el EXW + ${ajustes.adelanto_extra_pct} %.`:`El anticipo no cubre el EXW + ${ajustes.adelanto_extra_pct} % (${fmtUsd(tot.adelantoMinimo)}).`}</p>
  </Sec>;
}

// ── Detalle con solapas ───────────────────────────────────────────────────────────────────
function DetalleOperacion({p,ses,dq,token,ajustes,movs,ops,gastoCats,recargar,onCerrar}){
  const [tab,setTab]=useState("resumen");
  const misMovs=movs.filter(m=>m.pedido_id===p.id);
  const cobros=misMovs.filter(m=>m.tipo==="ingreso");
  const cob=cobros.reduce((s,m)=>s+n(m.monto_usd),0);
  const cobNeto=cobros.reduce((s,m)=>s+n(m.neto_usd??m.monto_usd),0);
  const pagosFab=misMovs.filter(m=>m.tipo==="egreso"&&m.categoria==="pago_fabrica");
  const pagosArg=misMovs.filter(m=>m.tipo==="egreso"&&m.categoria==="argencargo");
  const otros=misMovs.filter(m=>m.tipo==="egreso"&&!["pago_fabrica","argencargo"].includes(m.categoria));
  const costoDe=(l)=>l.reduce((s,m)=>s+n(m.neto_usd??m.monto_usd),0);
  const pagFab=pagosFab.reduce((s,m)=>s+n(m.monto_usd),0), pagArg=pagosArg.reduce((s,m)=>s+n(m.monto_usd),0);
  const costos=costoDe(pagosFab)+costoDe(pagosArg)+costoDe(otros);
  const presupuesto=n(p.precio_total)+n(p.importacion_usd);
  const op=ops.find(o=>o.id===p.operation_id)||null;
  const tot={exw_total:n(p.exw_total),financiero:n(p.financiero),gestion:n(p.gestion),prueba_monto:0,precio_total:n(p.precio_total),adelantoMinimo:n(p.exw_total)*(1+n(ajustes.adelanto_extra_pct)/100),cubreAdelanto:n(p.precio_total)>=n(p.exw_total)*(1+n(ajustes.adelanto_extra_pct)/100)};

  const cambiarEstado=async(k)=>{if(k===p.estado)return;if(k==="cancelado"&&!(await confirmDialog(`¿Cancelar ${codigoOp(p)}?`)))return;try{
    await dq("cat_pedidos",{method:"PATCH",filters:`?id=eq.${p.id}`,body:{estado:k,historial:[...(p.historial||[]),{estado:k,at:new Date().toISOString(),by:ses.user?.email||null}]}});await recargar();toast(estadoPed(k).l);
  }catch(e){toast(e.message,"error");}};
  const eliminar=async()=>{if(!(await confirmDialog(`¿Eliminar ${codigoOp(p)} con sus cobros y pagos? No se puede deshacer.`)))return;try{await dq("cat_movimientos",{method:"DELETE",filters:`?pedido_id=eq.${p.id}`,prefer:"return=minimal"});await dq("cat_pedidos",{method:"DELETE",filters:`?id=eq.${p.id}`,prefer:"return=minimal"});await recargar();toast("Eliminada");onCerrar();}catch(e){toast(e.message,"error");}};
  const idx=ESTADOS_PEDIDO.findIndex(e=>e.k===p.estado);
  const siguiente=p.estado==="entregado"||p.estado==="cancelado"?null:ESTADOS_PEDIDO[idx+1];

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"0 0 14px"}}>
      <Btn small onClick={onCerrar}>← Operaciones</Btn>
      <span style={{fontFamily:MONO,fontSize:14,fontWeight:600,letterSpacing:"0.08em"}}>{codigoOp(p)}</span>
      <ChipPed e={p.estado}/>
      <span style={{fontWeight:800}}>{p.cliente_nombre}</span>
      <span style={{fontSize:13,color:GRIS}}>{fmtFecha(p.created_at)}</span>
      <span style={{flex:1}}/>
      {siguiente&&siguiente.k!=="cancelado"&&<Btn kind="lima" small onClick={()=>cambiarEstado(siguiente.k)}>→ {siguiente.l}</Btn>}
      <Btn small kind="danger" onClick={eliminar}>Eliminar</Btn>
    </div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
      {ESTADOS_PEDIDO.filter(e=>e.k!=="cancelado").map((e,i,arr)=>{const pos=arr.findIndex(x=>x.k===p.estado);const hecho=i<=pos&&p.estado!=="cancelado";return <button key={e.k} type="button" onClick={()=>cambiarEstado(e.k)} title="Cambiar estado" style={{fontFamily:MONO,fontSize:10.5,letterSpacing:"0.06em",padding:"5px 10px",borderRadius:999,border:"none",cursor:"pointer",background:hecho?(i===pos?LIMA:OK_BG):SUAVE,color:hecho?(i===pos?"var(--mq-lima-ink)":INK):GRIS,fontWeight:i===pos?700:500}}>{e.l.toUpperCase()}</button>;})}
    </div>
    <Solapas val={tab} onChange={setTab} items={[["resumen","Resumen"],["finanzas","Finanzas",misMovs.length||null],["seguimiento","Seguimiento",op?op.operation_code:null],["entrega","Entrega"]]}/>

    {tab==="resumen"&&<ResumenOp p={p} dq={dq} ses={ses} cob={cob} presupuesto={presupuesto} recargar={recargar} cambiarEstado={cambiarEstado}/>}

    {tab==="finanzas"&&<>
      <Presupuesto tot={tot} importacion={p.importacion_usd==null?null:n(p.importacion_usd)} ajustes={ajustes} cobrado={cob} onRecalcular={async()=>{try{const t=totalesPedido(p.items||[],ajustes,n(p.importacion_usd));await dq("cat_pedidos",{method:"PATCH",filters:`?id=eq.${p.id}`,body:{exw_total:t.exw_total,financiero:t.financiero,gestion:t.gestion,precio_total:t.precio_total}});await recargar();toast("Presupuesto recalculado");}catch(e){toast(e.message,"error");}}}/>
      <Cobros p={p} cobros={cobros} cob={cob} presupuesto={presupuesto} dq={dq} token={token} ses={ses} recargar={recargar}/>
      <Costos p={p} pagosFab={pagosFab} pagosArg={pagosArg} otros={otros} pagFab={pagFab} pagArg={pagArg} dq={dq} token={token} ses={ses} ajustes={ajustes} gastoCats={gastoCats} recargar={recargar}/>
      <Rentabilidad presupuesto={presupuesto} cob={cob} cobNeto={cobNeto} fab={costoDe(pagosFab)} arg={costoDe(pagosArg)} otros={costoDe(otros)} costos={costos} prevista={n(p.gestion)}/>
    </>}

    {tab==="seguimiento"&&<Seguimiento op={op} ops={ops} p={p} dq={dq} recargar={recargar}/>}
    {tab==="entrega"&&<Vacio>Entrega: se arma en el paso siguiente.</Vacio>}
  </div>;
}

function ResumenOp({p,dq,ses,cob,presupuesto,recargar,cambiarEstado}){
  const [notas,setNotas]=useState(p.notas||"");const [editNotas,setEditNotas]=useState(false);
  const guardarNotas=async()=>{try{await dq("cat_pedidos",{method:"PATCH",filters:`?id=eq.${p.id}`,body:{notas:txtONull(notas)}});await recargar();setEditNotas(false);toast("Guardado");}catch(e){toast(e.message,"error");}};
  const [cont1,cont2]=String(p.cliente_contacto||"").split(" · ");
  return <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:14}}>
      <Dato l="Cliente" v={p.cliente_nombre||"—"} sub={[cont1,cont2].filter(Boolean).join(" · ")}/>
      <Dato l="Presupuesto" v={fmtUsd(presupuesto)}/>
      <Dato l="Cobrado" v={fmtUsd(cob)} color={cob>=presupuesto-0.01?OK:cob>0?WARN:INK} acento={cob>=presupuesto-0.01?OK:WARN}/>
      <div style={{background:SUAVE,borderRadius:14,padding:"14px 16px 14px 18px",position:"relative"}}><span style={{position:"absolute",left:0,top:12,bottom:12,width:4,borderRadius:"0 4px 4px 0",background:GRIS}}/><p style={{...LBL,marginBottom:6}}>Estado</p><Desplegable value={p.estado} onChange={cambiarEstado} opciones={ESTADOS_PEDIDO.map(e=>({v:e.k,l:e.l}))} buscar={false}/></div>
    </div>
    <Sec titulo="Máquinas">
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
        <thead><tr>{["Máquina","Proveedor","Cantidad","EXW unitario","EXW total"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>{(p.items||[]).map((it,i)=><tr key={i}><td style={{...TD,fontWeight:800}}>{it.nombre}<br/><span style={{fontFamily:MONO,fontSize:11,color:GRIS,fontWeight:500}}>{it.codigo}</span></td><td style={{...TD,color:GRIS}}>{it.proveedor||"—"}</td><td style={{...TD,fontFamily:MONO}}>{it.qty}</td><td style={{...TD,fontFamily:MONO}}>{fmtUsd(it.exw_unit)}</td><td style={{...TD,fontFamily:MONO,fontWeight:700}}>{fmtUsd(n(it.exw_unit)*n(it.qty,1))}</td></tr>)}</tbody>
      </table></div>
    </Sec>
    <Sec titulo="Notas" extra={editNotas?<div style={{display:"flex",gap:8}}><Btn small kind="lima" onClick={guardarNotas}>Guardar</Btn><Btn small onClick={()=>{setEditNotas(false);setNotas(p.notas||"");}}>Cancelar</Btn></div>:<Btn small onClick={()=>setEditNotas(true)}>Editar</Btn>}>
      {editNotas?<TA value={notas} onChange={e=>setNotas(e.target.value)} style={{minHeight:80}}/>:<p style={{margin:0,fontSize:13.5,whiteSpace:"pre-wrap",color:p.notas?INK:GRIS}}>{p.notas||"Sin notas."}</p>}
    </Sec>
  </>;
}

// ── Cobros al cliente (metodología Argencargo) ────────────────────────────────────────────
function Cobros({p,cobros,cob,presupuesto,dq,token,ses,recargar}){
  const [f,setF]=useState({monto:"",metodo:"transferencia",moneda:"USD",comision:"2,5",tc:"",fecha:hoyISO(),destino:"financiera",archivo:null});
  const [guardando,setGuardando]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const moneda=f.metodo==="cripto"?"USD":f.metodo==="transferencia"?"ARS":f.moneda;
  const esArs=moneda==="ARS";
  const monto=n(f.monto), tc=n(f.tc), com=f.metodo==="transferencia"?n(f.comision):0;
  const usd=esArs?(tc>0?monto/tc:0):monto;
  const comOrig=Math.round(monto*com/100*100)/100;
  const netoUsd=esArs?(tc>0?(monto-comOrig)/tc:0):monto-comOrig;
  const saldo=Math.round((presupuesto-cob)*100)/100;
  const registrar=async()=>{if(monto<=0){toast("Cargá el monto cobrado","error");return;}if(esArs&&tc<=0){toast("Cargá el tipo de cambio","error");return;}setGuardando(true);try{
    const url=f.archivo?await subirComprobante(token,f.archivo,p.id):null;
    const r=await dq("cat_movimientos",{method:"POST",body:{fecha:f.fecha,tipo:"ingreso",categoria:"cobro_cliente",concepto:`Cobro ${codigoOp(p)} · ${METODO[f.metodo]}`,monto_usd:Math.round(usd*100)/100,neto_usd:Math.round(netoUsd*100)/100,moneda,monto_original:esArs?monto:null,tipo_cambio:esArs?tc:null,metodo:f.metodo,destino:f.metodo==="transferencia"?f.destino:null,comision_pct:com||null,comision:comOrig,pedido_id:p.id,comprobante_url:url,created_by:ses.user?.id||null}});
    const mov=Array.isArray(r)?r[0]:r;
    if(f.metodo==="transferencia"&&f.destino==="financiera"){
      await dq("cat_cc_financiera",{method:"POST",body:{fecha:f.fecha,tipo:"ingreso",moneda,monto,comision_pct:com||null,comision:comOrig,acreditado:Math.round((monto-comOrig)*100)/100,tipo_cambio:esArs?tc:null,concepto:`Cobro ${codigoOp(p)} · ${p.cliente_nombre}`,pedido_id:p.id,mov_id:mov.id,comprobante_url:url,created_by:ses.user?.id||null}});
    }
    setF(x=>({...x,monto:"",tc:"",archivo:null}));await recargar();
    const rest=Math.round((presupuesto-cob-usd)*100)/100;
    toast(rest>0.01?`Cobro registrado · saldo ${fmtUsd(rest)}`:rest<-0.01?`Cobro registrado · pagó ${fmtUsd(-rest)} de más`:"Cobro registrado · saldo cero");
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const borrar=async(m)=>{if(!(await confirmDialog("¿Eliminar este cobro? Si generó movimiento en la CC de la financiera, también se elimina.")))return;try{await dq("cat_movimientos",{method:"DELETE",filters:`?id=eq.${m.id}`,prefer:"return=minimal"});await recargar();}catch(e){toast(e.message,"error");}};
  return <Sec titulo={`Cobros · ${cobros.length}`} extra={<span style={{fontFamily:MONO,fontSize:11,color:saldo<=0.01?OK:WARN}}>{saldo>0.01?`SALDO ${fmtUsd(saldo)}`:saldo<-0.01?`PAGÓ ${fmtUsd(-saldo)} DE MÁS`:"SALDADO"}</span>}>
    {cobros.length>0&&<div style={{display:"grid",gap:6,marginBottom:16}}>{cobros.map(m=><div key={m.id} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 12px",borderRadius:12,background:SUAVE,fontSize:13.5,flexWrap:"wrap"}}><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{fmtFecha(m.fecha)}</span><span style={{flex:1,fontWeight:700,minWidth:160}}>{METODO[m.metodo]||m.concepto}{m.destino==="financiera"&&<span style={{fontFamily:MONO,fontSize:10,color:GRIS,marginLeft:8}}>→ CC FINANCIERA</span>}</span>{m.moneda==="ARS"&&<span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{fmtMon(m.monto_original,"ARS")} @ {fmtNum(m.tipo_cambio)}{n(m.comision)>0?` · comisión ${fmtMon(m.comision,"ARS")}`:""}</span>}<b style={{fontFamily:MONO,color:OK,whiteSpace:"nowrap"}}>{fmtUsd(m.monto_usd)}</b>{m.comprobante_url&&<a href={m.comprobante_url} target="_blank" rel="noreferrer" style={{fontSize:12.5,fontWeight:700,color:INK}}>Comprobante</a>}<Btn small kind="danger" onClick={()=>borrar(m)}>✕</Btn></div>)}</div>}
    <p style={{...LBL,marginBottom:10}}>Registrar cobro</p>
    <div className="grid3" style={{...GRID,gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))"}}>
      <Campo label={`Monto cobrado (${f.metodo==="cripto"?"USDT":moneda})`}><Inp type="number" step="0.01" value={f.monto} onChange={e=>set("monto",e.target.value)} placeholder="0"/></Campo>
      <Campo label="Método"><Desplegable value={f.metodo} onChange={v=>set("metodo",v)} opciones={[["transferencia","Transferencia"],["efectivo","Efectivo"],["cripto","Cripto (USDT)"]].map(([v,l])=>({v,l}))} buscar={false}/></Campo>
      {f.metodo==="efectivo"&&<Campo label="Moneda"><div style={{display:"flex",gap:6}}><Pill on={f.moneda==="USD"} onClick={()=>set("moneda","USD")}>USD</Pill><Pill on={f.moneda==="ARS"} onClick={()=>set("moneda","ARS")}>ARS</Pill></div></Campo>}
      {f.metodo==="transferencia"&&<Campo label="Comisión transferencia %"><Inp type="number" step="0.01" value={f.comision} onChange={e=>set("comision",e.target.value)} placeholder="2,5"/></Campo>}
      {esArs&&<Campo label="Tipo de cambio (ARS/USD)"><Inp type="number" step="0.01" value={f.tc} onChange={e=>set("tc",e.target.value)} placeholder="Ej: 1450"/></Campo>}
      <Campo label="Fecha de cobro"><Fecha value={f.fecha} onChange={v=>set("fecha",v)}/></Campo>
    </div>
    {monto>0&&<p style={{margin:"10px 0 0",fontSize:12.5,color:GRIS,fontFamily:MONO}}>= {fmtUsd(usd)}{com>0?` · comisión ${fmtMon(comOrig,moneda)} · neto ${fmtUsd(netoUsd)}`:""}</p>}
    {f.metodo==="transferencia"&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:12}}>
      {[["financiera","Financiera","Genera el movimiento en la CC"],["propia","Cuenta propia","No toca la CC de la financiera"]].map(([v,l,h])=><button key={v} type="button" onClick={()=>set("destino",v)} style={{flex:"1 1 200px",textAlign:"left",padding:"10px 14px",borderRadius:12,cursor:"pointer",border:`1.5px solid ${f.destino===v?LIMA:BORDE}`,background:f.destino===v?LIMA_SUAVE:"transparent",color:INK}}><p style={{margin:"0 0 2px",fontSize:13.5,fontWeight:800}}>{f.destino===v?"● ":"○ "}{l}</p><p style={{margin:0,fontSize:12,color:GRIS}}>{h}</p></button>)}
    </div>}
    <div style={{marginTop:12}}><Archivo onFiles={(fs)=>set("archivo",fs[0])} label={f.archivo?f.archivo.name.slice(0,30):"Comprobante"} hint={f.archivo?"listo · podés cambiarlo":"Pegá con Ctrl+V, arrastrá o elegí"}/></div>
    <div style={{marginTop:14}}><Btn kind="lima" onClick={registrar} disabled={guardando||monto<=0}>{guardando?"Guardando…":"+ Registrar cobro"}</Btn></div>
  </Sec>;
}

// ── Costos: fábrica, Argencargo y otros ───────────────────────────────────────────────────
function Costos({p,pagosFab,pagosArg,otros,pagFab,pagArg,dq,token,ses,ajustes,gastoCats,recargar}){
  const [abierto,setAbierto]=useState(null); // fabrica | argencargo | otro
  const borrar=async(m)=>{if(!(await confirmDialog("¿Eliminar este pago? Si descontó de la CC de la financiera, también se revierte.")))return;try{await dq("cat_movimientos",{method:"DELETE",filters:`?id=eq.${m.id}`,prefer:"return=minimal"});await recargar();}catch(e){toast(e.message,"error");}};
  const Lista=({lista})=>lista.length===0?<p style={{margin:"0 0 12px",fontSize:13,color:GRIS}}>Sin pagos registrados.</p>:<div style={{display:"grid",gap:6,marginBottom:14}}>{lista.map(m=><div key={m.id} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 12px",borderRadius:12,background:SUAVE,fontSize:13.5,flexWrap:"wrap"}}><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{fmtFecha(m.fecha)}</span><span style={{flex:1,fontWeight:700,minWidth:160}}>{m.concepto||METODO[m.metodo]||CATEG_MOV[m.categoria]}{m.gasto_categoria&&<span style={{fontFamily:MONO,fontSize:10,color:GRIS,marginLeft:8}}>{m.gasto_categoria.toUpperCase()}</span>}{m.destino==="financiera"&&<span style={{fontFamily:MONO,fontSize:10,color:GRIS,marginLeft:8}}>→ CC FINANCIERA</span>}</span>{n(m.comision)>0&&<span style={{fontFamily:MONO,fontSize:12,color:WARN}}>+ comisión {fmtUsd(m.comision)}</span>}<b style={{fontFamily:MONO,color:BAD,whiteSpace:"nowrap"}}>{fmtUsd(m.monto_usd)}</b>{m.comprobante_url&&<a href={m.comprobante_url} target="_blank" rel="noreferrer" style={{fontSize:12.5,fontWeight:700,color:INK}}>Comprobante</a>}<Btn small kind="danger" onClick={()=>borrar(m)}>✕</Btn></div>)}</div>;
  const Bloque=({k,titulo,objetivo,pagado,lista,form})=>{const falta=objetivo!=null?Math.max(0,objetivo-pagado):null;return <Sec titulo={titulo} extra={<div style={{display:"flex",gap:10,alignItems:"center"}}>{objetivo!=null&&<span style={{fontFamily:MONO,fontSize:11,color:falta<=0.01?OK:WARN}}>{falta<=0.01?"PAGADO":`FALTA ${fmtUsd(falta)} DE ${fmtUsd(objetivo)}`}</span>}<Btn small kind={abierto===k?"ghost":"lima"} onClick={()=>setAbierto(abierto===k?null:k)}>{abierto===k?"Cerrar":"+ Registrar"}</Btn></div>}><Lista lista={lista}/>{abierto===k&&form}</Sec>;};
  return <>
    <p style={{...LBL,margin:"6px 0 10px"}}>Costos</p>
    <Bloque k="fabrica" titulo="Pago a fábrica" objetivo={n(p.exw_total)} pagado={pagFab} lista={pagosFab} form={<FormPagoFabrica p={p} dq={dq} token={token} ses={ses} ajustes={ajustes} falta={Math.max(0,n(p.exw_total)-pagFab)} onHecho={async()=>{setAbierto(null);await recargar();}}/>}/>
    <Bloque k="argencargo" titulo="ARGENCARGO · Importación" objetivo={p.importacion_usd==null?null:n(p.importacion_usd)} pagado={pagArg} lista={pagosArg} form={<FormPagoSimple p={p} dq={dq} token={token} ses={ses} categoria="argencargo" concepto={`Pago a Argencargo ${codigoOp(p)}`} falta={p.importacion_usd==null?0:Math.max(0,n(p.importacion_usd)-pagArg)} onHecho={async()=>{setAbierto(null);await recargar();}}/>}/>
    <Bloque k="otro" titulo="Otros costos" lista={otros} form={<FormPagoSimple p={p} dq={dq} token={token} ses={ses} categoria="gasto" gastoCats={gastoCats} onHecho={async()=>{setAbierto(null);await recargar();}}/>}/>
  </>;
}
function FormPagoFabrica({p,dq,token,ses,ajustes,falta,onHecho}){
  const [f,setF]=useState({monto:falta>0?String(Math.round(falta*100)/100):"",metodo:"financiera",moneda:"USD",tc:"",fecha:hoyISO(),archivo:null});
  const [guardando,setGuardando]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const esArs=f.metodo==="contado"&&f.moneda==="ARS";
  const monto=n(f.monto), tc=n(f.tc);
  const usd=esArs?(tc>0?monto/tc:0):monto;
  const comision=f.metodo==="financiera"?Math.round((usd*n(ajustes.fin_pct)/100+n(ajustes.fin_fijo_usd))*100)/100:0;
  const registrar=async()=>{if(monto<=0){toast("Cargá el monto","error");return;}if(esArs&&tc<=0){toast("Cargá el tipo de cambio","error");return;}setGuardando(true);try{
    const url=f.archivo?await subirComprobante(token,f.archivo,p.id):null;
    const r=await dq("cat_movimientos",{method:"POST",body:{fecha:f.fecha,tipo:"egreso",categoria:"pago_fabrica",concepto:`Pago a fábrica ${codigoOp(p)} · ${METODO[f.metodo]}`,monto_usd:Math.round(usd*100)/100,neto_usd:Math.round((usd+comision)*100)/100,moneda:esArs?"ARS":"USD",monto_original:esArs?monto:null,tipo_cambio:esArs?tc:null,metodo:f.metodo,destino:f.metodo==="financiera"?"financiera":null,comision_pct:f.metodo==="financiera"?n(ajustes.fin_pct):null,comision,pedido_id:p.id,comprobante_url:url,created_by:ses.user?.id||null}});
    const mov=Array.isArray(r)?r[0]:r;
    if(f.metodo==="financiera")await dq("cat_cc_financiera",{method:"POST",body:{fecha:f.fecha,tipo:"retiro",moneda:"USD",monto:Math.round((usd+comision)*100)/100,comision_pct:n(ajustes.fin_pct),comision,acreditado:Math.round((usd+comision)*100)/100,concepto:`Cable a fábrica ${codigoOp(p)} (${fmtUsd(usd)} + comisión ${fmtUsd(comision)})`,pedido_id:p.id,mov_id:mov.id,comprobante_url:url,created_by:ses.user?.id||null}});
    toast("Pago registrado");onHecho();
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  return <div style={{borderTop:`1px solid ${BORDE}`,paddingTop:14}}>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
      {[["financiera","SOLFIN · Cable Financiera",`Comisión ${String(ajustes.fin_pct).replace(".",",")} % + USD ${ajustes.fin_fijo_usd} · se descuenta de la CC financiera`],["contado","Contado","Sin comisión · no toca la CC"]].map(([v,l,h])=><button key={v} type="button" onClick={()=>set("metodo",v)} style={{flex:"1 1 220px",textAlign:"left",padding:"10px 14px",borderRadius:12,cursor:"pointer",border:`1.5px solid ${f.metodo===v?LIMA:BORDE}`,background:f.metodo===v?LIMA_SUAVE:"transparent",color:INK}}><p style={{margin:"0 0 2px",fontSize:13.5,fontWeight:800}}>{f.metodo===v?"● ":"○ "}{l}</p><p style={{margin:0,fontSize:12,color:GRIS}}>{h}</p></button>)}
    </div>
    <div className="grid3" style={GRID}>
      {f.metodo==="contado"&&<Campo label="Moneda"><div style={{display:"flex",gap:6}}><Pill on={f.moneda==="USD"} onClick={()=>set("moneda","USD")}>USD</Pill><Pill on={f.moneda==="ARS"} onClick={()=>set("moneda","ARS")}>ARS</Pill></div></Campo>}
      <Campo label={`Monto (${esArs?"ARS":"USD"})`}><Inp type="number" step="0.01" value={f.monto} onChange={e=>set("monto",e.target.value)}/></Campo>
      {esArs&&<Campo label="Tipo de cambio (ARS/USD)" hint={usd>0?`= ${fmtUsd(usd)}`:null}><Inp type="number" step="0.01" value={f.tc} onChange={e=>set("tc",e.target.value)}/></Campo>}
      <Campo label="Fecha"><Fecha value={f.fecha} onChange={v=>set("fecha",v)}/></Campo>
    </div>
    {usd>0&&<p style={{margin:"10px 0 0",fontSize:12.5,color:GRIS,fontFamily:MONO}}>{f.metodo==="financiera"?`Comisión ${fmtUsd(comision)} · se descuentan ${fmtUsd(usd+comision)} de la CC financiera`:`Costo total ${fmtUsd(usd)}`}</p>}
    <div style={{marginTop:12}}><Archivo onFiles={(fs)=>set("archivo",fs[0])} label={f.archivo?f.archivo.name.slice(0,30):"Comprobante"} hint={f.archivo?"listo":"Pegá con Ctrl+V, arrastrá o elegí"}/></div>
    <div style={{marginTop:14}}><Btn kind="lima" onClick={registrar} disabled={guardando||monto<=0}>{guardando?"Guardando…":"Registrar pago"}</Btn></div>
  </div>;
}
function FormPagoSimple({p,dq,token,ses,categoria,concepto,gastoCats,falta,onHecho}){
  const [f,setF]=useState({monto:falta>0?String(Math.round(falta*100)/100):"",moneda:"USD",tc:"",concepto:concepto||"",gasto_categoria:"",fecha:hoyISO(),archivo:null});
  const [guardando,setGuardando]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const monto=n(f.monto), tc=n(f.tc);const usd=f.moneda==="ARS"?(tc>0?monto/tc:0):monto;
  const registrar=async()=>{if(monto<=0){toast("Cargá el monto","error");return;}if(f.moneda==="ARS"&&tc<=0){toast("Cargá el tipo de cambio","error");return;}setGuardando(true);try{
    const url=f.archivo?await subirComprobante(token,f.archivo,p.id):null;
    await dq("cat_movimientos",{method:"POST",body:{fecha:f.fecha,tipo:"egreso",categoria,gasto_categoria:categoria==="gasto"?txtONull(f.gasto_categoria):null,concepto:txtONull(f.concepto),monto_usd:Math.round(usd*100)/100,neto_usd:Math.round(usd*100)/100,moneda:f.moneda,monto_original:f.moneda==="ARS"?monto:null,tipo_cambio:f.moneda==="ARS"?tc:null,metodo:"otro",pedido_id:p.id,comprobante_url:url,created_by:ses.user?.id||null}});
    toast("Registrado");onHecho();
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  return <div style={{borderTop:`1px solid ${BORDE}`,paddingTop:14}}>
    <div className="grid3" style={GRID}>
      <Campo label="Moneda"><div style={{display:"flex",gap:6}}><Pill on={f.moneda==="USD"} onClick={()=>set("moneda","USD")}>USD</Pill><Pill on={f.moneda==="ARS"} onClick={()=>set("moneda","ARS")}>ARS</Pill></div></Campo>
      <Campo label={`Monto (${f.moneda})`}><Inp type="number" step="0.01" value={f.monto} onChange={e=>set("monto",e.target.value)}/></Campo>
      {f.moneda==="ARS"?<Campo label="Tipo de cambio" hint={usd>0?`= ${fmtUsd(usd)}`:null}><Inp type="number" step="0.01" value={f.tc} onChange={e=>set("tc",e.target.value)}/></Campo>:<Campo label="Fecha"><Fecha value={f.fecha} onChange={v=>set("fecha",v)}/></Campo>}
      {f.moneda==="ARS"&&<Campo label="Fecha"><Fecha value={f.fecha} onChange={v=>set("fecha",v)}/></Campo>}
      {categoria==="gasto"&&<Campo label="Categoría"><Desplegable value={f.gasto_categoria} onChange={v=>set("gasto_categoria",v)} opciones={(gastoCats||[]).map(c=>({v:c.nombre,l:c.nombre}))} placeholder="Elegir…" vacio="Se cargan en Ajustes"/></Campo>}
      <Campo label="Concepto" span={categoria==="gasto"?2:3}><Inp value={f.concepto} onChange={e=>set("concepto",e.target.value)} placeholder={categoria==="gasto"?"Flete local, despachante, viáticos…":""}/></Campo>
    </div>
    <div style={{marginTop:12}}><Archivo onFiles={(fs)=>set("archivo",fs[0])} label={f.archivo?f.archivo.name.slice(0,30):"Comprobante"} hint={f.archivo?"listo":"Pegá con Ctrl+V, arrastrá o elegí"}/></div>
    <div style={{marginTop:14}}><Btn kind="lima" onClick={registrar} disabled={guardando||monto<=0}>{guardando?"Guardando…":"Registrar"}</Btn></div>
  </div>;
}
function Rentabilidad({presupuesto,cob,cobNeto,fab,arg,otros,costos,prevista}){
  const gan=cobNeto-costos;const margen=cobNeto>0?gan/cobNeto*100:0;
  const fila=(l,v,c,b)=><div style={{display:"flex",justifyContent:"space-between",gap:12,padding:"7px 0",borderTop:b?`1px solid ${BORDE}`:"none",fontSize:b?15:13.5,fontWeight:b?800:500}}><span style={{color:b?INK:GRIS}}>{l}</span><span style={{fontFamily:MONO,color:c||INK}}>{fmtUsd(v)}</span></div>;
  return <Sec titulo="Rentabilidad" style={{borderColor:gan>=0?OK:BAD}}>
    <div className="dos" style={DOS}>
      <div>
        {fila("Presupuesto",presupuesto)}
        {fila("Cobrado",cob)}
        {fila("Cobro neto (después de comisiones)",cobNeto,OK)}
      </div>
      <div>
        {fila("Fábrica (con comisiones de giro)",fab,BAD)}
        {fila("Argencargo",arg,BAD)}
        {fila("Otros costos",otros,BAD)}
        {fila("Costos",costos,BAD,true)}
      </div>
    </div>
    <div style={{marginTop:14,padding:"14px 16px",borderRadius:14,background:SUAVE,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}><span style={{fontSize:15,fontWeight:800,flex:1}}>Ganancia neta</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>prevista {fmtUsd(prevista)}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{fmtNum(margen,1)} %</span><b style={{fontFamily:MONO,fontSize:22,color:gan>=0?OK:BAD}}>{fmtUsd(gan)}</b></div>
  </Sec>;
}

function Seguimiento({op,ops,p,dq,recargar}){
  const [eventos,setEventos]=useState(null);
  useEffect(()=>{if(!op){setEventos([]);return;}(async()=>{try{const r=await dq("tracking_events",{filters:`?operation_id=eq.${op.id}&select=*&order=created_at.desc&limit=50`});setEventos(Array.isArray(r)?r:[]);}catch{setEventos([]);}})();},[op?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const vincular=async(id)=>{try{const o=ops.find(x=>x.id===id);await dq("cat_pedidos",{method:"PATCH",filters:`?id=eq.${p.id}`,body:{operation_id:id||null,operation_ref:o?o.operation_code:null}});await recargar();toast(id?"Vinculada":"Desvinculada");}catch(e){toast(e.message,"error");}};
  const selector=<div style={{maxWidth:520}}><Campo label="Operación de Argencargo"><Desplegable value={p.operation_id||""} onChange={vincular} opciones={ops.map(o=>({v:o.id,l:`${o.operation_code}${o.description?` · ${o.description.slice(0,50)}`:""}`,sub:OP_ESTADO[o.status]||o.status}))} placeholder="Sin vincular" vacio="No hay operaciones a nombre de ARGENMAQ en Argencargo"/></Campo></div>;
  if(!op)return <Sec titulo="Seguimiento">{selector}<p style={{margin:"12px 0 0",fontSize:13,color:GRIS}}>Cuando Argencargo abra la operación a nombre de ARGENMAQ, vinculala acá y el seguimiento aparece solo.</p></Sec>;
  const hitos=[["Creada",op.created_at],["Despachada",op.dispatched_at],["Llegó a Argentina",op.arrived_in_argentina_at],["Despacho aduanero",op.cleared_customs_at],["Entregada",op.delivered_at]];
  return <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:14}}>
      <Dato l="Operación Argencargo" v={op.operation_code} sub={op.description||""}/>
      <Dato l="Estado" v={OP_ESTADO[op.status]||op.status} acento={op.status==="entregada"?OK:WARN}/>
      <Dato l="ETA" v={op.eta?fmtFecha(op.eta):"—"} acento={GRIS}/>
      <Dato l="Vía" v={op.channel?String(op.channel).includes("aereo")?"Aérea":"Marítima":"—"} sub={op.international_tracking?`Tracking ${op.international_tracking}`:null} acento={GRIS}/>
    </div>
    <Sec titulo="Hitos" extra={<div style={{display:"flex",gap:8,alignItems:"center"}}><a href={`/track/${op.operation_code}`} target="_blank" rel="noreferrer" style={{fontSize:12.5,fontWeight:700,color:INK}}>Tracking público ↗</a><Btn small onClick={()=>vincular("")}>Desvincular</Btn></div>}>
      <div style={{display:"grid",gap:8}}>{hitos.map(([l,d])=><div key={l} style={{display:"flex",gap:12,alignItems:"center",fontSize:13.5}}><span style={{width:10,height:10,borderRadius:"50%",background:d?OK:BORDE,flexShrink:0}}/><span style={{flex:1,fontWeight:d?700:500,color:d?INK:GRIS}}>{l}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{d?fmtFecha(d):"—"}</span></div>)}</div>
    </Sec>
    <Sec titulo="Eventos">
      {eventos===null?<p style={{margin:0,color:GRIS,fontSize:13}}>Cargando…</p>:eventos.length===0?<p style={{margin:0,color:GRIS,fontSize:13}}>Sin eventos todavía.</p>
      :<div style={{display:"grid",gap:8}}>{eventos.map(e=><div key={e.id} style={{display:"flex",gap:12,alignItems:"start",fontSize:13.5}}><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS,whiteSpace:"nowrap",paddingTop:2}}>{new Date(e.created_at).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span><span>{e.description||e.status||e.event||""}</span></div>)}</div>}
    </Sec>
  </>;
}

// ── Libro diario: lista y alta libre ──────────────────────────────────────────────────────
export function ListaMovs({lista,dq,recargar,admin,conPedido,pedidos}){
  const borrar=async(m)=>{if(!(await confirmDialog(`¿Eliminar el movimiento de ${fmtUsd(m.monto_usd)}?${m.destino==="financiera"?" También se elimina su movimiento en la CC de la financiera.":""}`)))return;try{await dq("cat_movimientos",{method:"DELETE",filters:`?id=eq.${m.id}`,prefer:"return=minimal"});await recargar();toast("Eliminado");}catch(e){toast(e.message,"error");}};
  if(!lista.length)return <p style={{margin:0,fontSize:13,color:GRIS}}>Sin movimientos.</p>;
  return <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
    <thead><tr>{["Fecha","Concepto",...(conPedido?["Operación"]:[]),"Categoría","Monto","Comprobante",""].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
    <tbody>{lista.map(m=>{const ped=conPedido&&m.pedido_id?pedidos?.find(x=>x.id===m.pedido_id):null;return <tr key={m.id}>
      <td style={{...TD,fontFamily:MONO,fontSize:12.5,whiteSpace:"nowrap"}}>{fmtFecha(m.fecha)}</td>
      <td style={{...TD,fontWeight:700}}>{m.concepto||CATEG_MOV[m.categoria]}{m.moneda==="ARS"&&m.monto_original&&<span style={{display:"block",fontSize:11.5,color:GRIS,fontWeight:500,fontFamily:MONO}}>{fmtMon(m.monto_original,"ARS")} @ {fmtNum(m.tipo_cambio)}</span>}{n(m.comision)>0&&<span style={{display:"block",fontSize:11.5,color:WARN,fontWeight:500,fontFamily:MONO}}>comisión {fmtMon(m.comision,m.moneda||"USD")}</span>}</td>
      {conPedido&&<td style={{...TD,fontFamily:MONO,fontSize:12.5}}>{ped?codigoOp(ped):"—"}</td>}
      <td style={{...TD,color:GRIS,fontSize:12.5}}>{m.categoria==="gasto"&&m.gasto_categoria?m.gasto_categoria:CATEG_MOV[m.categoria]||m.categoria}</td>
      <td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap",fontWeight:700,color:m.tipo==="ingreso"?OK:BAD}}>{m.tipo==="ingreso"?"+":"−"} {fmtUsd(m.monto_usd)}</td>
      <td style={TD}>{m.comprobante_url?<a href={m.comprobante_url} target="_blank" rel="noreferrer" style={{color:INK,fontWeight:700,fontSize:12.5}}>Ver</a>:<span style={{color:GRIS}}>—</span>}</td>
      <td style={{...TD,textAlign:"right"}}>{admin&&<Btn small kind="danger" onClick={()=>borrar(m)}>✕</Btn>}</td>
    </tr>;})}</tbody>
  </table></div>;
}
export function FormMov({token,dq,ses,pedidos,gastoCats,onCerrar,onHecho}){
  const [f,setF]=useState({fecha:hoyISO(),tipo:"egreso",categoria:"gasto",gasto_categoria:"",moneda:"USD",monto:"",tc:"",concepto:"",pedido_id:"",archivo:null});
  const [guardando,setGuardando]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const montoUsd=f.moneda==="ARS"?(n(f.tc)>0?n(f.monto)/n(f.tc):0):n(f.monto);
  const guardar=async()=>{if(n(f.monto)<=0){toast("Cargá el monto","error");return;}if(f.moneda==="ARS"&&n(f.tc)<=0){toast("Cargá el tipo de cambio","error");return;}setGuardando(true);try{
    const url=f.archivo?await subirComprobante(token,f.archivo,"libro"):null;
    await dq("cat_movimientos",{method:"POST",body:{fecha:f.fecha,tipo:f.tipo,categoria:f.categoria,gasto_categoria:f.categoria==="gasto"?txtONull(f.gasto_categoria):null,concepto:txtONull(f.concepto),monto_usd:Math.round(montoUsd*100)/100,neto_usd:Math.round(montoUsd*100)/100,moneda:f.moneda,monto_original:f.moneda==="ARS"?n(f.monto):null,tipo_cambio:f.moneda==="ARS"?n(f.tc):null,metodo:"otro",pedido_id:f.pedido_id||null,comprobante_url:url,created_by:ses.user?.id||null}});
    toast("Registrado");onHecho();
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const cats=f.tipo==="ingreso"?["cobro_cliente","otro"]:["pago_fabrica","argencargo","gasto","otro"];
  return <Sec titulo="Nuevo movimiento" style={{borderColor:LIMA}}>
    <div className="grid3" style={GRID}>
      <Campo label="Fecha"><Fecha value={f.fecha} onChange={v=>set("fecha",v)}/></Campo>
      <Campo label="Tipo"><div style={{display:"flex",gap:8}}><Pill on={f.tipo==="ingreso"} onClick={()=>{set("tipo","ingreso");set("categoria","otro");}}>Ingreso</Pill><Pill on={f.tipo==="egreso"} onClick={()=>{set("tipo","egreso");set("categoria","gasto");}}>Egreso</Pill></div></Campo>
      <Campo label={f.tipo==="egreso"?"Tipo de egreso":"Tipo de ingreso"}><Desplegable value={f.categoria} onChange={v=>set("categoria",v)} opciones={cats.map(c=>({v:c,l:CATEG_MOV[c]}))} buscar={false}/></Campo>
      {f.tipo==="egreso"&&f.categoria==="gasto"&&<Campo label="Categoría del gasto"><Desplegable value={f.gasto_categoria} onChange={v=>set("gasto_categoria",v)} opciones={(gastoCats||[]).map(c=>({v:c.nombre,l:c.nombre}))} placeholder="Elegir…" vacio="Se cargan en Ajustes"/></Campo>}
      <Campo label="Moneda"><div style={{display:"flex",gap:8}}><Pill on={f.moneda==="USD"} onClick={()=>set("moneda","USD")}>USD</Pill><Pill on={f.moneda==="ARS"} onClick={()=>set("moneda","ARS")}>ARS</Pill></div></Campo>
      <Campo label={`Monto (${f.moneda})`} ob><Inp type="number" step="0.01" value={f.monto} onChange={e=>set("monto",e.target.value)}/></Campo>
      {f.moneda==="ARS"&&<Campo label="Tipo de cambio (ARS por USD)" ob hint={montoUsd>0?`= ${fmtUsd(montoUsd)}`:null}><Inp type="number" step="0.01" value={f.tc} onChange={e=>set("tc",e.target.value)}/></Campo>}
      <Campo label="Concepto" span={3}><Inp value={f.concepto} onChange={e=>set("concepto",e.target.value)}/></Campo>
      <Campo label="Operación (opcional)"><Desplegable value={f.pedido_id} onChange={v=>set("pedido_id",v)} opciones={(pedidos||[]).map(p=>({v:p.id,l:`${codigoOp(p)} · ${p.cliente_nombre}`,sub:estadoPed(p.estado).l}))} placeholder="Sin operación"/></Campo>
      <Campo label="Comprobante" span={2}><Archivo onFiles={(fs)=>set("archivo",fs[0])} label={f.archivo?f.archivo.name.slice(0,28):"Adjuntar"} hint={f.archivo?"listo · podés cambiarlo":"Arrastrá, pegá con Ctrl+V o elegí"}/></Campo>
    </div>
    <div style={{display:"flex",gap:8,marginTop:14}}><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn><Btn onClick={onCerrar}>Cancelar</Btn></div>
  </Sec>;
}
