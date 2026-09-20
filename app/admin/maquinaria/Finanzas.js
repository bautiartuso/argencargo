"use client";
// Finanzas: Resumen (cuánto gané, cuánto tengo), Libro diario (todos los movimientos) y Tarifas.
import { useState, useMemo } from "react";
import { toast } from "../../../lib/ui";
import { leerAjustes, precioMaquina } from "../../../lib/catalogo-precio";
import { INK,GRIS,BORDE,SUAVE,CARD,OK,WARN,BAD,MONO,LBL,TH,TD,GRID,Campo,Inp,Sel,Btn,Sec,Pill,Barra,Vacio,Dato,n,fmtUsd,codigoPed,CATEG_MOV } from "./ui";
import { ListaMovs, FormMov, cobradoDe, pagadoFabricaDe } from "./Pedidos";

const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const ACTIVOS=["nuevo","pagado","en_produccion","prueba_fabrica","listo_fabrica","en_importacion"];

// Filtro de período compartido: este mes por defecto, después año, después total.
function usePeriodo(){
  const hoy=new Date();
  const [modo,setModo]=useState("mes");
  const [mes,setMes]=useState(hoy.getMonth());
  const [anio,setAnio]=useState(hoy.getFullYear());
  const entra=(fecha)=>{if(modo==="total")return true;const d=new Date(String(fecha).length===10?fecha+"T12:00:00":fecha);if(modo==="anio")return d.getFullYear()===anio;return d.getFullYear()===anio&&d.getMonth()===mes;};
  const etiqueta=modo==="total"?"Total":modo==="anio"?String(anio):`${MESES[mes]} ${anio}`;
  const ui=<Barra>
    <Pill on={modo==="mes"} onClick={()=>setModo("mes")}>Mes</Pill><Pill on={modo==="anio"} onClick={()=>setModo("anio")}>Año</Pill><Pill on={modo==="total"} onClick={()=>setModo("total")}>Total</Pill>
    {modo==="mes"&&<Sel value={mes} onChange={e=>setMes(Number(e.target.value))} style={{width:"auto",borderRadius:999,padding:"9px 14px"}}>{MESES.map((m,i)=><option key={m} value={i}>{m}</option>)}</Sel>}
    {modo!=="total"&&<Sel value={anio} onChange={e=>setAnio(Number(e.target.value))} style={{width:"auto",borderRadius:999,padding:"9px 14px"}}>{[hoy.getFullYear()+1,hoy.getFullYear(),hoy.getFullYear()-1,hoy.getFullYear()-2].map(a=><option key={a} value={a}>{a}</option>)}</Sel>}
  </Barra>;
  return {entra,etiqueta,ui,modo};
}

export function Resumen({pedidos,movs}){
  const per=usePeriodo();
  const enPer=movs.filter(m=>per.entra(m.fecha));
  const ing=enPer.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+n(m.monto_usd),0);
  const egr=enPer.filter(m=>m.tipo==="egreso").reduce((s,m)=>s+n(m.monto_usd),0);
  const caja=movs.reduce((s,m)=>s+(m.tipo==="ingreso"?1:-1)*n(m.monto_usd),0);
  const activos=pedidos.filter(p=>ACTIVOS.includes(p.estado));
  const porCobrar=activos.reduce((s,p)=>s+Math.max(0,n(p.precio_total)-cobradoDe(movs,p.id)),0);
  const porPagar=activos.reduce((s,p)=>s+Math.max(0,n(p.exw_total)-pagadoFabricaDe(movs,p.id)),0);
  const pedPer=pedidos.filter(p=>per.entra(p.created_at)&&p.estado!=="cancelado");
  const gestionPer=pedPer.reduce((s,p)=>s+n(p.gestion)+n(p.prueba_monto),0);
  const porCat=Object.keys(CATEG_MOV).map(k=>({k,l:CATEG_MOV[k],ing:enPer.filter(m=>m.categoria===k&&m.tipo==="ingreso").reduce((s,m)=>s+n(m.monto_usd),0),egr:enPer.filter(m=>m.categoria===k&&m.tipo==="egreso").reduce((s,m)=>s+n(m.monto_usd),0)})).filter(x=>x.ing>0||x.egr>0);
  return <>
    {per.ui}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:14}}>
      <Dato l={`Ganancia · ${per.etiqueta}`} v={fmtUsd(ing-egr)} sub="ingresos − egresos" color={ing-egr>=0?OK:BAD}/>
      <Dato l="Ingresos" v={fmtUsd(ing)} sub={`${enPer.filter(m=>m.tipo==="ingreso").length} movimientos`}/>
      <Dato l="Egresos" v={fmtUsd(egr)} sub={`${enPer.filter(m=>m.tipo==="egreso").length} movimientos`}/>
      <Dato l="En caja" v={fmtUsd(caja)} sub="acumulado de siempre" color={caja>=0?INK:BAD}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:14}}>
      <Dato l="Por cobrar" v={fmtUsd(porCobrar)} sub={`${activos.length} pedidos activos`} color={porCobrar>0?WARN:INK}/>
      <Dato l="Por pagar a fábricas" v={fmtUsd(porPagar)} sub="EXW pendiente" color={porPagar>0?WARN:INK}/>
      <Dato l={`Pedidos · ${per.etiqueta}`} v={String(pedPer.length)} sub={`${fmtUsd(pedPer.reduce((s,p)=>s+n(p.precio_total),0))} vendidos`}/>
      <Dato l={`Gestión vendida · ${per.etiqueta}`} v={fmtUsd(gestionPer)} sub="margen de los pedidos del período" color={OK}/>
    </div>
    <Sec titulo={`Por categoría · ${per.etiqueta}`}>
      {porCat.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Sin movimientos en el período.</p>
      :<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
        <thead><tr>{["Categoría","Ingresos","Egresos","Neto"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>{porCat.map(x=><tr key={x.k}><td style={{...TD,fontWeight:700}}>{x.l}</td><td style={{...TD,fontFamily:MONO,color:OK}}>{x.ing?fmtUsd(x.ing):"—"}</td><td style={{...TD,fontFamily:MONO,color:BAD}}>{x.egr?fmtUsd(x.egr):"—"}</td><td style={{...TD,fontFamily:MONO,fontWeight:700}}>{fmtUsd(x.ing-x.egr)}</td></tr>)}</tbody>
      </table></div>}
    </Sec>
  </>;
}

export function Libro({ses,dq,token,pedidos,movs,recargar}){
  const per=usePeriodo();
  const [nuevo,setNuevo]=useState(false);
  const [tipo,setTipo]=useState("todos");
  const lista=movs.filter(m=>per.entra(m.fecha)&&(tipo==="todos"||m.tipo===tipo));
  const ing=lista.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+n(m.monto_usd),0);
  const egr=lista.filter(m=>m.tipo==="egreso").reduce((s,m)=>s+n(m.monto_usd),0);
  return <>
    {per.ui}
    <Barra>
      <Pill on={tipo==="todos"} onClick={()=>setTipo("todos")}>Todos</Pill><Pill on={tipo==="ingreso"} onClick={()=>setTipo("ingreso")}>Ingresos</Pill><Pill on={tipo==="egreso"} onClick={()=>setTipo("egreso")}>Egresos</Pill>
      <span style={{flex:1}}/>
      <span style={{fontFamily:MONO,fontSize:12,color:GRIS}}><span style={{color:OK}}>+{fmtUsd(ing)}</span> · <span style={{color:BAD}}>−{fmtUsd(egr)}</span> · <b style={{color:INK}}>{fmtUsd(ing-egr)}</b></span>
      <Btn kind="lima" onClick={()=>setNuevo(true)}>+ Movimiento</Btn>
    </Barra>
    {nuevo&&<FormMov token={token} dq={dq} ses={ses} pedidos={pedidos} onCerrar={()=>setNuevo(false)} onHecho={async()=>{setNuevo(false);await recargar();}}/>}
    {lista.length===0?<Vacio>Sin movimientos en {per.etiqueta.toLowerCase()}.</Vacio>
    :<div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><ListaMovs lista={lista} dq={dq} recargar={recargar} admin={ses.rol==="admin"} conPedido pedidos={pedidos}/></div>}
  </>;
}

export function Tarifas({dq,ajustes,setAjustes}){
  const [a,setA]=useState(()=>Object.fromEntries(Object.entries(ajustes).map(([k,v])=>[k,String(v)])));
  const [guardando,setGuardando]=useState(false);
  const set=(k,v)=>setA(x=>({...x,[k]:v}));
  const claves=["gestion_pct","markup_minimo_usd","fin_pct","fin_fijo_usd","prueba_fabrica_precio","prueba_fabrica_costo","adelanto_extra_pct"];
  const filas=()=>claves.map(k=>({clave:k,valor:n(a[k])})).concat([{clave:"fin_pagos",valor:1}]);
  const guardar=async()=>{setGuardando(true);try{
    await dq("cat_ajustes",{method:"POST",prefer:"resolution=merge-duplicates,return=representation",body:filas().map(f=>({...f,updated_at:new Date().toISOString()}))});
    setAjustes(leerAjustes(filas()));toast("Tarifas guardadas");
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const aj=leerAjustes(filas());
  const ej=[800,5000,20000].map(v=>({v,r:precioMaquina({exwUnit:v,ajustes:aj})}));
  return <>
    <Barra><span style={{flex:1}}/><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn></Barra>
    <Sec titulo="Gestión">
      <div className="grid3" style={GRID}>
        <Campo label="Gestión por defecto (%)" hint="Se puede cambiar máquina por máquina y pedido por pedido."><Inp type="number" step="0.5" value={a.gestion_pct} onChange={e=>set("gestion_pct",e.target.value)}/></Campo>
        <Campo label="Piso por máquina (USD)"><Inp type="number" value={a.markup_minimo_usd} onChange={e=>set("markup_minimo_usd",e.target.value)}/></Campo>
        <Campo label="Adelanto mínimo: EXW + (%)"><Inp type="number" value={a.adelanto_extra_pct} onChange={e=>set("adelanto_extra_pct",e.target.value)}/></Campo>
      </div>
    </Sec>
    <Sec titulo="Costo financiero del pago a fábrica">
      <div className="grid3" style={GRID}>
        <Campo label="Porcentaje (%)"><Inp type="number" step="0.01" value={a.fin_pct} onChange={e=>set("fin_pct",e.target.value)}/></Campo>
        <Campo label="Fijo por transferencia (USD)"><Inp type="number" value={a.fin_fijo_usd} onChange={e=>set("fin_fijo_usd",e.target.value)}/></Campo>
      </div>
    </Sec>
    <Sec titulo="Prueba en fábrica">
      <div className="grid3" style={GRID}>
        <Campo label="Precio al cliente (USD)"><Inp type="number" value={a.prueba_fabrica_precio} onChange={e=>set("prueba_fabrica_precio",e.target.value)}/></Campo>
        <Campo label="Costo (USD)"><Inp type="number" value={a.prueba_fabrica_costo} onChange={e=>set("prueba_fabrica_costo",e.target.value)}/></Campo>
      </div>
    </Sec>
    <Sec titulo="Cómo queda">
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
        <thead><tr>{["EXW","Financiero","Gestión","Precio de la máquina","Adelanto mínimo"].map(h=><th key={h} style={{...TH,textAlign:"right"}}>{h}</th>)}</tr></thead>
        <tbody>{ej.map(({v,r})=><tr key={v}>{[r.exw,r.financiero,`${fmtUsd(r.gestion)}${r.gestion>r.exw*r.pct/100+0.005?" (piso)":""}`,r.precio,r.adelantoMinimo].map((x,i)=><td key={i} style={{...TD,textAlign:"right",fontFamily:MONO,fontWeight:i===3?800:500,color:i===4?(r.cubreAdelanto?OK:BAD):INK}}>{typeof x==="number"?fmtUsd(x):x}</td>)}</tr>)}</tbody>
      </table></div>
    </Sec>
  </>;
}
