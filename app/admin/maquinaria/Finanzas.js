"use client";
// Finanzas de Argenmaq: Resumen (cuánto gané, cuánto tengo, qué falta cobrar y pagar),
// Libro diario, cuenta corriente con la financiera y Tarifas.
import { useState } from "react";
import { toast, confirmDialog } from "../../../lib/ui";
import { leerAjustes, precioMaquina, totalesPedido } from "../../../lib/catalogo-precio";
import { INK,GRIS,BORDE,SUAVE,CARD,LIMA,LIMA_SUAVE,OK,WARN,BAD,MONO,LBL,TH,TD,GRID,DOS,Campo,Inp,Sel,Btn,Sec,Pill,Barra,Vacio,Dato,Barras,n,numONull,txtONull,fmtUsd,fmtMon,fmtK,fmtFecha,hoyISO,codigoPed,CATEG_MOV,MESES,MESES_C,ACTIVOS } from "./ui";
import { ListaMovs, FormMov, cobradoDe, pagadoFabricaDe } from "./Pedidos";

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

// Últimos 12 meses de un listado con fecha → [{l, a, b}]
export function porMes(lista,fechaDe,valorA,valorB){
  const hoy=new Date();const out=[];
  for(let i=11;i>=0;i--){const d=new Date(hoy.getFullYear(),hoy.getMonth()-i,1);const m=d.getMonth(),y=d.getFullYear();
    const del=lista.filter(x=>{const f=new Date(String(fechaDe(x)).length===10?fechaDe(x)+"T12:00:00":fechaDe(x));return f.getMonth()===m&&f.getFullYear()===y;});
    out.push({l:MESES_C[m],a:del.reduce((s,x)=>s+valorA(x),0),b:valorB?del.reduce((s,x)=>s+valorB(x),0):null});}
  return out;
}

export function Resumen({pedidos,movs,ccs,ir}){
  const per=usePeriodo();
  const enPer=movs.filter(m=>per.entra(m.fecha));
  const ing=enPer.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+n(m.monto_usd),0);
  const egr=enPer.filter(m=>m.tipo==="egreso").reduce((s,m)=>s+n(m.monto_usd),0);
  const gan=ing-egr;
  const caja=movs.reduce((s,m)=>s+(m.tipo==="ingreso"?1:-1)*n(m.monto_usd),0);
  const ccUsd=(ccs||[]).filter(c=>c.moneda==="USD").reduce((s,c)=>s+(c.tipo==="retiro"?-1:1)*n(c.monto),0);
  const activos=pedidos.filter(p=>ACTIVOS.includes(p.estado));
  const conSaldo=activos.map(p=>({p,cob:cobradoDe(movs,p.id),falta:Math.max(0,n(p.precio_total)-cobradoDe(movs,p.id))})).filter(x=>x.falta>0.01);
  const porPagar=activos.map(p=>({p,pag:pagadoFabricaDe(movs,p.id),falta:Math.max(0,n(p.exw_total)-pagadoFabricaDe(movs,p.id))})).filter(x=>x.falta>0.01);
  const pedPer=pedidos.filter(p=>per.entra(p.created_at)&&p.estado!=="cancelado");
  const vendido=pedPer.reduce((s,p)=>s+n(p.precio_total),0);
  const margen=pedPer.reduce((s,p)=>s+n(p.gestion)+n(p.prueba_monto),0);
  const porCat=Object.keys(CATEG_MOV).map(k=>({k,l:CATEG_MOV[k],ing:enPer.filter(m=>m.categoria===k&&m.tipo==="ingreso").reduce((s,m)=>s+n(m.monto_usd),0),egr:enPer.filter(m=>m.categoria===k&&m.tipo==="egreso").reduce((s,m)=>s+n(m.monto_usd),0)})).filter(x=>x.ing>0||x.egr>0);
  const serie=porMes(movs,m=>m.fecha,m=>m.tipo==="ingreso"?n(m.monto_usd):0,m=>m.tipo==="egreso"?n(m.monto_usd):0);
  const pct=ing>0?Math.min(100,egr/ing*100):0;
  return <>
    {per.ui}
    <div className="dos" style={{...DOS,gridTemplateColumns:"1.4fr 1fr",marginBottom:14}}>
      <Sec titulo={`Ganancia · ${per.etiqueta}`} style={{marginBottom:0}}>
        <p style={{margin:0,fontSize:40,fontWeight:800,letterSpacing:"-0.03em",color:gan>=0?INK:BAD,fontVariantNumeric:"tabular-nums"}}>{fmtUsd(gan)}</p>
        <div style={{height:10,borderRadius:5,background:SUAVE,overflow:"hidden",margin:"14px 0 10px",display:"flex"}}><div style={{width:`${100-pct}%`,background:LIMA}}/><div style={{width:`${pct}%`,background:GRIS,opacity:0.5}}/></div>
        <div style={{display:"flex",gap:18,flexWrap:"wrap",fontSize:13.5}}><span><b style={{color:OK}}>+ {fmtUsd(ing)}</b> <span style={{color:GRIS}}>ingresos</span></span><span><b style={{color:BAD}}>− {fmtUsd(egr)}</b> <span style={{color:GRIS}}>egresos</span></span><span style={{color:GRIS}}>{enPer.length} movimientos</span></div>
        <div style={{marginTop:18,paddingTop:16,borderTop:`1px solid ${BORDE}`,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,fontSize:13}}>
          <div><p style={{...LBL,marginBottom:2}}>Vendido</p><b style={{fontSize:16}}>{fmtUsd(vendido)}</b><span style={{color:GRIS}}> · {pedPer.length} pedidos</span></div>
          <div><p style={{...LBL,marginBottom:2}}>Margen de gestión</p><b style={{fontSize:16,color:OK}}>{fmtUsd(margen)}</b><span style={{color:GRIS}}> · de esos pedidos</span></div>
          <div><p style={{...LBL,marginBottom:2}}>Ticket promedio</p><b style={{fontSize:16}}>{pedPer.length?fmtUsd(vendido/pedPer.length):"—"}</b></div>
        </div>
      </Sec>
      <div style={{display:"grid",gap:12,alignContent:"start"}}>
        <Dato l="En caja" v={fmtUsd(caja)} sub="acumulado del libro diario" color={caja>=0?INK:BAD}/>
        <Dato l="En la financiera" v={fmtUsd(ccUsd)} sub="cuenta corriente · USD" acento={GRIS}/>
        <Dato l="Por cobrar" v={fmtUsd(conSaldo.reduce((s,x)=>s+x.falta,0))} sub={`${conSaldo.length} pedidos con saldo`} color={conSaldo.length?WARN:INK} acento={WARN}/>
        <Dato l="Por pagar a fábricas" v={fmtUsd(porPagar.reduce((s,x)=>s+x.falta,0))} sub={`${porPagar.length} pedidos`} color={porPagar.length?WARN:INK} acento={BAD}/>
      </div>
    </div>
    <Sec titulo="Últimos 12 meses" extra={<span style={{fontFamily:MONO,fontSize:11,color:GRIS}}><span style={{display:"inline-block",width:10,height:10,background:LIMA,borderRadius:2,verticalAlign:"middle",marginRight:5}}/>INGRESOS <span style={{display:"inline-block",width:10,height:10,background:GRIS,opacity:0.5,borderRadius:2,verticalAlign:"middle",margin:"0 5px 0 12px"}}/>EGRESOS</span>}>
      {movs.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Sin movimientos todavía.</p>:<Barras series={serie} fmt={(v)=>fmtUsd(v)}/>}
    </Sec>
    <div className="dos" style={DOS}>
      <Sec titulo="Pedidos con saldo a cobrar">
        {conSaldo.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Nada pendiente.</p>
        :<div style={{display:"grid",gap:8}}>{conSaldo.map(({p,cob,falta})=><button key={p.id} className="fila" onClick={()=>ir("pedidos",p.id)} style={{display:"flex",gap:12,alignItems:"center",width:"100%",textAlign:"left",padding:"9px 10px",borderRadius:10,border:"none",background:"transparent",color:INK,cursor:"pointer",fontSize:13.5}}><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS}}>{codigoPed(p)}</span><span style={{flex:1,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.cliente_nombre}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{fmtK(cob)} / {fmtK(p.precio_total)}</span><b style={{fontFamily:MONO,color:WARN,whiteSpace:"nowrap"}}>{fmtUsd(falta)}</b></button>)}</div>}
      </Sec>
      <Sec titulo="Fábricas por pagar">
        {porPagar.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Nada pendiente.</p>
        :<div style={{display:"grid",gap:8}}>{porPagar.map(({p,pag,falta})=><button key={p.id} className="fila" onClick={()=>ir("pedidos",p.id)} style={{display:"flex",gap:12,alignItems:"center",width:"100%",textAlign:"left",padding:"9px 10px",borderRadius:10,border:"none",background:"transparent",color:INK,cursor:"pointer",fontSize:13.5}}><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS}}>{codigoPed(p)}</span><span style={{flex:1,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(p.items||[]).map(i=>i.proveedor).filter(Boolean)[0]||p.cliente_nombre}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{fmtK(pag)} / {fmtK(p.exw_total)}</span><b style={{fontFamily:MONO,color:BAD,whiteSpace:"nowrap"}}>{fmtUsd(falta)}</b></button>)}</div>}
      </Sec>
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
    :<div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><ListaMovs lista={lista} dq={dq} recargar={recargar} admin conPedido pedidos={pedidos}/></div>}
  </>;
}

// ── Cuenta corriente con la financiera ────────────────────────────────────────────────────
export function CCFinanciera({ses,dq,pedidos,ccs,recargar}){
  const [nuevo,setNuevo]=useState(false);
  const [f,setF]=useState({fecha:hoyISO(),tipo:"deposito",moneda:"USD",monto:"",concepto:"",pedido_id:""});
  const [guardando,setGuardando]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const saldo=(m)=>(ccs||[]).filter(c=>c.moneda===m).reduce((s,c)=>s+(c.tipo==="retiro"?-1:1)*n(c.monto),0);
  const guardar=async()=>{if(n(f.monto)<=0){toast("Cargá el monto","error");return;}setGuardando(true);try{
    await dq("cat_cc_financiera",{method:"POST",body:{fecha:f.fecha,tipo:f.tipo,moneda:f.moneda,monto:n(f.monto),concepto:txtONull(f.concepto),pedido_id:f.pedido_id||null,created_by:ses.user?.id||null}});
    setNuevo(false);setF({fecha:hoyISO(),tipo:"deposito",moneda:"USD",monto:"",concepto:"",pedido_id:""});await recargar();toast("Registrado");
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const borrar=async(c)=>{if(!(await confirmDialog(`¿Eliminar el movimiento de ${fmtMon(c.monto,c.moneda)}?`)))return;try{await dq("cat_cc_financiera",{method:"DELETE",filters:`?id=eq.${c.id}`,prefer:"return=minimal"});await recargar();}catch(e){toast(e.message,"error");}};
  const TIPO={deposito:"Depósito",retiro:"Retiro",ajuste:"Ajuste"};
  let acumUsd=saldo("USD"),acumArs=saldo("ARS");
  return <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:14}}>
      <Dato l="Saldo USD" v={fmtMon(saldo("USD"),"USD")} color={saldo("USD")>=0?INK:BAD}/>
      <Dato l="Saldo ARS" v={fmtMon(saldo("ARS"),"ARS")} color={saldo("ARS")>=0?INK:BAD} acento={GRIS}/>
      <Dato l="Movimientos" v={String((ccs||[]).length)} acento={GRIS}/>
    </div>
    <Barra><span style={{flex:1}}/><Btn kind="lima" onClick={()=>setNuevo(v=>!v)}>+ Movimiento</Btn></Barra>
    {nuevo&&<Sec titulo="Nuevo movimiento" style={{borderColor:INK}}>
      <div className="grid3" style={GRID}>
        <Campo label="Fecha"><Inp type="date" value={f.fecha} onChange={e=>set("fecha",e.target.value)}/></Campo>
        <Campo label="Tipo"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(TIPO).map(([k,l])=><Pill key={k} on={f.tipo===k} onClick={()=>set("tipo",k)}>{l}</Pill>)}</div></Campo>
        <Campo label="Moneda"><div style={{display:"flex",gap:6}}><Pill on={f.moneda==="USD"} onClick={()=>set("moneda","USD")}>USD</Pill><Pill on={f.moneda==="ARS"} onClick={()=>set("moneda","ARS")}>ARS</Pill></div></Campo>
        <Campo label="Monto" ob><Inp type="number" step="0.01" value={f.monto} onChange={e=>set("monto",e.target.value)}/></Campo>
        <Campo label="Concepto"><Inp value={f.concepto} onChange={e=>set("concepto",e.target.value)}/></Campo>
        <Campo label="Pedido"><Sel value={f.pedido_id} onChange={e=>set("pedido_id",e.target.value)}><option value="">Sin pedido</option>{pedidos.map(p=><option key={p.id} value={p.id}>{codigoPed(p)} · {p.cliente_nombre}</option>)}</Sel></Campo>
      </div>
      <div style={{display:"flex",gap:8,marginTop:14}}><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn><Btn onClick={()=>setNuevo(false)}>Cancelar</Btn></div>
    </Sec>}
    {(ccs||[]).length===0?<Vacio>Sin movimientos con la financiera.</Vacio>
    :<div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
      <thead><tr>{["Fecha","Tipo","Concepto","Pedido","Monto","Saldo",""].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{ccs.map(c=>{const signo=c.tipo==="retiro"?-1:1;const fila=<tr key={c.id}>
        <td style={{...TD,fontFamily:MONO,fontSize:12.5,whiteSpace:"nowrap"}}>{fmtFecha(c.fecha)}</td>
        <td style={TD}>{TIPO[c.tipo]}</td>
        <td style={{...TD,fontWeight:700}}>{c.concepto||"—"}</td>
        <td style={{...TD,fontFamily:MONO,fontSize:12.5}}>{c.pedido_id?codigoPed(pedidos.find(p=>p.id===c.pedido_id)||{}):"—"}</td>
        <td style={{...TD,fontFamily:MONO,fontWeight:700,whiteSpace:"nowrap",color:signo>0?OK:BAD}}>{signo>0?"+":"−"} {fmtMon(c.monto,c.moneda)}</td>
        <td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap"}}>{fmtMon(c.moneda==="USD"?acumUsd:acumArs,c.moneda)}</td>
        <td style={{...TD,textAlign:"right"}}><Btn small kind="danger" onClick={()=>borrar(c)}>✕</Btn></td>
      </tr>;if(c.moneda==="USD")acumUsd-=signo*n(c.monto);else acumArs-=signo*n(c.monto);return fila;})}</tbody>
    </table></div></div>}
  </>;
}

// ── Tarifas ───────────────────────────────────────────────────────────────────────────────
export function Tarifas({dq,ajustes,setAjustes}){
  const claves=["gestion_pct","markup_minimo_usd","fin_pct","fin_fijo_usd","prueba_fabrica_precio","prueba_fabrica_costo","adelanto_extra_pct"];
  const [a,setA]=useState(()=>Object.fromEntries(claves.map(k=>[k,String(ajustes[k])])));
  const [sim,setSim]=useState({exw:"5000",qty:"1",pct:"",prueba:false});
  const [guardando,setGuardando]=useState(false);
  const set=(k,v)=>setA(x=>({...x,[k]:v}));
  const filas=()=>claves.map(k=>({clave:k,valor:n(a[k])})).concat([{clave:"fin_pagos",valor:1}]);
  const guardar=async()=>{setGuardando(true);try{
    await dq("cat_ajustes",{method:"POST",prefer:"resolution=merge-duplicates,return=representation",body:filas().map(f=>({...f,updated_at:new Date().toISOString()}))});
    setAjustes(x=>({...x,...Object.fromEntries(filas().map(f=>[f.clave,f.valor]))}));toast("Tarifas guardadas");
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const aj={...ajustes,...Object.fromEntries(filas().map(f=>[f.clave,f.valor]))};
  const r=totalesPedido([{exw_unit:n(sim.exw),qty:n(sim.qty,1),gestion_pct:sim.pct.trim()===""?null:n(sim.pct)}],aj,sim.prueba);
  const pctSim=sim.pct.trim()===""?n(aj.gestion_pct):n(sim.pct);
  const piso=n(sim.exw)*pctSim/100<n(aj.markup_minimo_usd);
  const ej=[600,2500,12000].map(v=>({v,r:precioMaquina({exwUnit:v,ajustes:aj})}));
  return <>
    <Barra><span style={{flex:1}}/><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn></Barra>
    <div className="dos" style={DOS}>
      <div>
        <Sec titulo="Gestión">
          <div style={{display:"grid",gap:14}}>
            <Campo label="Gestión por defecto (%)" hint="Se cambia máquina por máquina y pedido por pedido."><Inp type="number" step="0.5" value={a.gestion_pct} onChange={e=>set("gestion_pct",e.target.value)}/></Campo>
            <Campo label="Piso por máquina (USD)" hint="Si el % da menos que esto, se cobra esto."><Inp type="number" value={a.markup_minimo_usd} onChange={e=>set("markup_minimo_usd",e.target.value)}/></Campo>
            <Campo label="Adelanto mínimo: EXW + (%)" hint="El precio de la máquina tiene que cubrir el EXW más este porcentaje."><Inp type="number" value={a.adelanto_extra_pct} onChange={e=>set("adelanto_extra_pct",e.target.value)}/></Campo>
          </div>
        </Sec>
        <Sec titulo="Costo financiero del pago a fábrica">
          <div style={{display:"grid",gap:14}}>
            <Campo label="Porcentaje (%)"><Inp type="number" step="0.01" value={a.fin_pct} onChange={e=>set("fin_pct",e.target.value)}/></Campo>
            <Campo label="Fijo por transferencia (USD)" hint="Una transferencia por pedido."><Inp type="number" value={a.fin_fijo_usd} onChange={e=>set("fin_fijo_usd",e.target.value)}/></Campo>
          </div>
        </Sec>
        <Sec titulo="Prueba en fábrica">
          <div style={{display:"grid",gap:14}}>
            <Campo label="Precio al cliente (USD)"><Inp type="number" value={a.prueba_fabrica_precio} onChange={e=>set("prueba_fabrica_precio",e.target.value)}/></Campo>
            <Campo label="Costo (USD)"><Inp type="number" value={a.prueba_fabrica_costo} onChange={e=>set("prueba_fabrica_costo",e.target.value)}/></Campo>
          </div>
        </Sec>
      </div>
      <div>
        <Sec titulo="Probá con una máquina" style={{position:"sticky",top:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Campo label="EXW (USD)"><Inp type="number" value={sim.exw} onChange={e=>setSim(x=>({...x,exw:e.target.value}))}/></Campo>
            <Campo label="Cantidad"><Inp type="number" value={sim.qty} onChange={e=>setSim(x=>({...x,qty:e.target.value}))}/></Campo>
            <Campo label="Gestión (%)"><Inp type="number" step="0.5" value={sim.pct} onChange={e=>setSim(x=>({...x,pct:e.target.value}))} placeholder={String(aj.gestion_pct)}/></Campo>
            <Campo label="Prueba en fábrica"><div style={{display:"flex",gap:6}}><Pill on={!sim.prueba} onClick={()=>setSim(x=>({...x,prueba:false}))}>No</Pill><Pill on={sim.prueba} onClick={()=>setSim(x=>({...x,prueba:true}))}>Sí</Pill></div></Campo>
          </div>
          <div style={{marginTop:18,background:SUAVE,borderRadius:14,padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr auto",gap:"6px 18px",fontSize:13.5}}>
            <span style={{color:GRIS}}>EXW</span><span style={{fontFamily:MONO,textAlign:"right"}}>{fmtUsd(r.exw_total)}</span>
            <span style={{color:GRIS}}>Financiero</span><span style={{fontFamily:MONO,textAlign:"right"}}>{fmtUsd(r.financiero)}</span>
            <span style={{color:GRIS}}>Gestión ({String(pctSim).replace(".",",")} %{piso?" → piso":""})</span><span style={{fontFamily:MONO,textAlign:"right"}}>{fmtUsd(r.gestion)}</span>
            {r.prueba_monto>0&&<><span style={{color:GRIS}}>Prueba en fábrica</span><span style={{fontFamily:MONO,textAlign:"right"}}>{fmtUsd(r.prueba_monto)}</span></>}
            <span style={{fontWeight:800,borderTop:`1px solid ${BORDE}`,paddingTop:8}}>Precio de la máquina</span><span style={{fontFamily:MONO,fontWeight:800,textAlign:"right",borderTop:`1px solid ${BORDE}`,paddingTop:8,fontSize:16}}>{fmtUsd(r.precio_total)}</span>
            <span style={{color:GRIS}}>Ganancia neta (gestión{sim.prueba?" + prueba − costo":""})</span><span style={{fontFamily:MONO,textAlign:"right",color:OK,fontWeight:700}}>{fmtUsd(r.gestion+(sim.prueba?n(aj.prueba_fabrica_precio)-n(aj.prueba_fabrica_costo):0))}</span>
          </div>
          <p style={{margin:"10px 0 0",fontSize:12.5,color:r.cubreAdelanto?OK:BAD}}>{r.cubreAdelanto?`Cubre el adelanto mínimo (${fmtUsd(r.adelantoMinimo)}).`:`No cubre el adelanto mínimo (${fmtUsd(r.adelantoMinimo)}): subí la gestión.`}</p>
          <div style={{marginTop:16,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
            <thead><tr>{["EXW","Gestión","Precio"].map(h=><th key={h} style={{...TH,textAlign:"right",padding:"8px 10px"}}>{h}</th>)}</tr></thead>
            <tbody>{ej.map(({v,r})=><tr key={v}><td style={{...TD,padding:"8px 10px",textAlign:"right",fontFamily:MONO}}>{fmtUsd(r.exw)}</td><td style={{...TD,padding:"8px 10px",textAlign:"right",fontFamily:MONO}}>{fmtUsd(r.gestion)}{r.gestion>r.exw*r.pct/100+0.005?<span style={{color:GRIS}}> piso</span>:<span style={{color:GRIS}}> {String(r.pct).replace(".",",")} %</span>}</td><td style={{...TD,padding:"8px 10px",textAlign:"right",fontFamily:MONO,fontWeight:800}}>{fmtUsd(r.precio)}</td></tr>)}</tbody>
          </table></div>
        </Sec>
      </div>
    </div>
  </>;
}
