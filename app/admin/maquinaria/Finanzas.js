"use client";
// Finanzas de Argenmaq: Resumen, Libro diario, cuenta corriente con la financiera y Tarifas.
import { useState, useEffect } from "react";
import { leerAjustes, precioMaquina, totalesPedido } from "../../../lib/catalogo-precio";
import { INK,GRIS,BORDE,SUAVE,CARD,LIMA,LIMA_SUAVE,OK,WARN,BAD,MONO,LBL,TH,TD,GRID,DOS,Campo,Inp,Btn,Sec,Pill,Barra,Vacio,Dato,Barras,Desplegable,Fecha,Archivo,n,numONull,txtONull,fmtUsd,fmtMon,fmtK,fmtFecha,hoyISO,codigoOp,CATEG_MOV,MESES,MESES_C,ACTIVOS,toast,confirmDialog } from "./ui";
import { ListaMovs, FormMov, cobradoDe, pagadoFabricaDe } from "./Pedidos";

// Filtro de período del resumen: este mes por defecto, después año, después total.
function usePeriodo(){
  const hoy=new Date();
  const [modo,setModo]=useState("mes");
  const [mes,setMes]=useState(hoy.getMonth());
  const [anio,setAnio]=useState(hoy.getFullYear());
  const entra=(fecha)=>{if(modo==="total")return true;const d=new Date(String(fecha).length===10?fecha+"T12:00:00":fecha);if(modo==="anio")return d.getFullYear()===anio;return d.getFullYear()===anio&&d.getMonth()===mes;};
  const etiqueta=modo==="total"?"Total":modo==="anio"?String(anio):`${MESES[mes]} ${anio}`;
  const anios=[hoy.getFullYear()+1,hoy.getFullYear(),hoy.getFullYear()-1,hoy.getFullYear()-2];
  const ui=<Barra>
    <Pill on={modo==="mes"} onClick={()=>setModo("mes")}>Mes</Pill><Pill on={modo==="anio"} onClick={()=>setModo("anio")}>Año</Pill><Pill on={modo==="total"} onClick={()=>setModo("total")}>Total</Pill>
    {modo==="mes"&&<div style={{width:170}}><Desplegable value={mes} onChange={v=>setMes(Number(v))} opciones={MESES.map((m,i)=>({v:i,l:m}))} buscar={false}/></div>}
    {modo!=="total"&&<div style={{width:120}}><Desplegable value={anio} onChange={v=>setAnio(Number(v))} opciones={anios.map(a=>({v:a,l:String(a)}))} buscar={false}/></div>}
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
  const ccUsd=(ccs||[]).filter(c=>c.moneda==="USD").reduce((s,c)=>s+(c.tipo==="retiro"?-1:1)*n(c.acreditado??c.monto),0);
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
          <div><p style={{...LBL,marginBottom:2}}>Vendido</p><b style={{fontSize:16}}>{fmtUsd(vendido)}</b><span style={{color:GRIS}}> · {pedPer.length} op.</span></div>
          <div><p style={{...LBL,marginBottom:2}}>Margen de gestión</p><b style={{fontSize:16,color:OK}}>{fmtUsd(margen)}</b></div>
          <div><p style={{...LBL,marginBottom:2}}>Ticket promedio</p><b style={{fontSize:16}}>{pedPer.length?fmtUsd(vendido/pedPer.length):"—"}</b></div>
        </div>
      </Sec>
      <div style={{display:"grid",gap:12,alignContent:"start"}}>
        <Dato l="En caja" v={fmtUsd(caja)} sub="acumulado del libro diario" color={caja>=0?INK:BAD}/>
        <Dato l="En la financiera" v={fmtUsd(ccUsd)} sub="cuenta corriente · USD" acento={GRIS}/>
        <Dato l="Por cobrar" v={fmtUsd(conSaldo.reduce((s,x)=>s+x.falta,0))} sub={`${conSaldo.length} operaciones con saldo`} color={conSaldo.length?WARN:INK} acento={WARN}/>
        <Dato l="Por pagar a fábricas" v={fmtUsd(porPagar.reduce((s,x)=>s+x.falta,0))} sub={`${porPagar.length} operaciones`} color={porPagar.length?WARN:INK} acento={BAD}/>
      </div>
    </div>
    <Sec titulo="Últimos 12 meses" extra={<span style={{fontFamily:MONO,fontSize:11,color:GRIS}}><span style={{display:"inline-block",width:10,height:10,background:LIMA,borderRadius:2,verticalAlign:"middle",marginRight:5}}/>INGRESOS <span style={{display:"inline-block",width:10,height:10,background:GRIS,opacity:0.5,borderRadius:2,verticalAlign:"middle",margin:"0 5px 0 12px"}}/>EGRESOS</span>}>
      {movs.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Sin movimientos todavía.</p>:<Barras series={serie} fmt={(v)=>fmtUsd(v)}/>}
    </Sec>
    <div className="dos" style={DOS}>
      <Sec titulo="Operaciones con saldo a cobrar">
        {conSaldo.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Nada pendiente.</p>
        :<div style={{display:"grid",gap:8}}>{conSaldo.map(({p,cob,falta})=><button key={p.id} className="fila" onClick={()=>ir("pedidos",p.id)} style={{display:"flex",gap:12,alignItems:"center",width:"100%",textAlign:"left",padding:"9px 10px",borderRadius:10,border:"none",background:"transparent",color:INK,cursor:"pointer",fontSize:13.5}}><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS}}>{codigoOp(p)}</span><span style={{flex:1,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.cliente_nombre}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{fmtK(cob)} / {fmtK(p.precio_total)}</span><b style={{fontFamily:MONO,color:WARN,whiteSpace:"nowrap"}}>{fmtUsd(falta)}</b></button>)}</div>}
      </Sec>
      <Sec titulo="Fábricas por pagar">
        {porPagar.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Nada pendiente.</p>
        :<div style={{display:"grid",gap:8}}>{porPagar.map(({p,pag,falta})=><button key={p.id} className="fila" onClick={()=>ir("pedidos",p.id)} style={{display:"flex",gap:12,alignItems:"center",width:"100%",textAlign:"left",padding:"9px 10px",borderRadius:10,border:"none",background:"transparent",color:INK,cursor:"pointer",fontSize:13.5}}><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS}}>{codigoOp(p)}</span><span style={{flex:1,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(p.items||[]).map(i=>i.proveedor).filter(Boolean)[0]||p.cliente_nombre}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{fmtK(pag)} / {fmtK(p.exw_total)}</span><b style={{fontFamily:MONO,color:BAD,whiteSpace:"nowrap"}}>{fmtUsd(falta)}</b></button>)}</div>}
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

// ── Libro diario: todos los movimientos, filtrados por tipo y entre fechas ────────────────
export function Libro({ses,dq,token,pedidos,movs,gastoCats,recargar}){
  const [nuevo,setNuevo]=useState(false);
  const [tipo,setTipo]=useState("todos");
  const [desde,setDesde]=useState("");const [hasta,setHasta]=useState("");
  const [busq,setBusq]=useState("");
  const lista=movs.filter(m=>(tipo==="todos"||m.tipo===tipo)&&(!desde||m.fecha>=desde)&&(!hasta||m.fecha<=hasta)&&(!busq.trim()||`${m.concepto||""} ${CATEG_MOV[m.categoria]||""} ${m.gasto_categoria||""}`.toLowerCase().includes(busq.toLowerCase())));
  const ing=lista.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+n(m.monto_usd),0);
  const egr=lista.filter(m=>m.tipo==="egreso").reduce((s,m)=>s+n(m.monto_usd),0);
  return <>
    <Barra>
      <Pill on={tipo==="todos"} onClick={()=>setTipo("todos")}>Todos</Pill><Pill on={tipo==="ingreso"} onClick={()=>setTipo("ingreso")}>Ingresos</Pill><Pill on={tipo==="egreso"} onClick={()=>setTipo("egreso")}>Egresos</Pill>
      <span style={{fontFamily:MONO,fontSize:11,color:GRIS,marginLeft:6}}>DESDE</span><Fecha value={desde} onChange={setDesde} small/><span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>HASTA</span><Fecha value={hasta} onChange={setHasta} small/>
      {(desde||hasta)&&<Btn small onClick={()=>{setDesde("");setHasta("");}}>✕</Btn>}
      <input placeholder="Buscar…" value={busq} onChange={e=>setBusq(e.target.value)} style={{...LBLINP,flex:1,minWidth:140}}/>
      <Btn kind="lima" onClick={()=>setNuevo(v=>!v)}>+ Movimiento</Btn>
    </Barra>
    <div style={{display:"flex",gap:16,flexWrap:"wrap",fontFamily:MONO,fontSize:12,color:GRIS,margin:"-8px 0 14px"}}><span style={{color:OK}}>+{fmtUsd(ing)}</span><span style={{color:BAD}}>−{fmtUsd(egr)}</span><b style={{color:INK}}>{fmtUsd(ing-egr)}</b><span>{lista.length} movimientos</span></div>
    {nuevo&&<FormMov token={token} dq={dq} ses={ses} pedidos={pedidos} gastoCats={gastoCats} onCerrar={()=>setNuevo(false)} onHecho={async()=>{setNuevo(false);await recargar();}}/>}
    {lista.length===0?<Vacio>Sin movimientos.</Vacio>
    :<div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><ListaMovs lista={lista} dq={dq} recargar={recargar} admin conPedido pedidos={pedidos}/></div>}
  </>;
}
const LBLINP={padding:"9px 16px",borderRadius:999,border:`1px solid ${BORDE}`,background:CARD,color:INK,fontSize:13.5,fontWeight:600,outline:"none"};

// ── Cuenta corriente con la financiera (estilo MyBox) ─────────────────────────────────────
// Ingresos con comisión de la financiera (acreditado = importe − comisión), retiros, dolarización
// (retiro ARS + ingreso USD al tipo de cambio) y link público de solo lectura + Excel para
// el chico de la financiera (/cc/<token> en argenmaq.vercel.app).
const CC_TIPO={ingreso:"Ingreso",retiro:"Retiro",ajuste:"Ajuste",dolarizacion:"Dolarización"};
const SB_URL_CC="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY_CC="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
export function CCFinanciera({ses,dq,token,pedidos,ccs,recargar}){
  const [panel,setPanel]=useState(null); // ingreso | retiro | dolarizar | compartir
  const [filtro,setFiltro]=useState("todo");
  const movs=ccs||[];
  const saldo=(m)=>movs.filter(c=>c.moneda===m).reduce((s,c)=>s+(c.tipo==="retiro"?-1:1)*n(c.acreditado??c.monto),0);
  let ars=saldo("ARS"),usd=saldo("USD");
  const filas=movs.map(m=>{const signo=m.tipo==="retiro"?-1:1;const neto=n(m.acreditado??m.monto)*signo;const fila={...m,saldoArs:ars,saldoUsd:usd};if(m.moneda==="USD")usd-=neto;else ars-=neto;return fila;}).filter(m=>filtro==="todo"||m.moneda===filtro);
  const borrar=async(c)=>{if(!(await confirmDialog(`¿Eliminar el movimiento de ${fmtMon(c.monto,c.moneda)}?`)))return;try{await dq("cat_cc_financiera",{method:"DELETE",filters:`?id=eq.${c.id}`,prefer:"return=minimal"});await recargar();}catch(e){toast(e.message,"error");}};
  const excel=async()=>{try{const XLSX=await import("xlsx");let a=0,u=0;const cron=movs.slice().reverse().map(m=>{const signo=m.tipo==="retiro"?-1:1;const neto=n(m.acreditado??m.monto)*signo;if(m.moneda==="USD")u+=neto;else a+=neto;return {Fecha:fmtFecha(m.fecha),Tipo:CC_TIPO[m.tipo]||m.tipo,Moneda:m.moneda,"Descripción":m.concepto||"",Importe:n(m.monto),"Comisión %":m.comision_pct??"","Comisión":n(m.comision),Acreditado:n(m.acreditado??m.monto),"Saldo ARS":Math.round(a*100)/100,"Saldo USD":Math.round(u*100)/100};}).reverse();
    const ws=XLSX.utils.json_to_sheet(cron);ws["!cols"]=[{wch:11},{wch:13},{wch:8},{wch:40},{wch:14},{wch:10},{wch:12},{wch:14},{wch:16},{wch:14}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"CC Financiera");XLSX.writeFile(wb,`argenmaq-cc-financiera-${hoyISO()}.xlsx`);}catch(e){toast(e.message,"error");}};
  return <>
    <Barra>
      <span style={{flex:1}}/>
      <Btn onClick={()=>setPanel(panel==="compartir"?null:"compartir")}>🔗 Compartir</Btn>
      <Btn onClick={excel}>Excel</Btn>
      <Btn onClick={()=>setPanel(panel==="dolarizar"?null:"dolarizar")}>💱 Dolarizar</Btn>
      <Btn onClick={()=>setPanel(panel==="retiro"?null:"retiro")}>Retirar (egreso)</Btn>
      <Btn kind="lima" onClick={()=>setPanel(panel==="ingreso"?null:"ingreso")}>+ Ingreso</Btn>
    </Barra>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:14}}>
      {[["ARS","pesos"],["USD","dólares"]].map(([m,l])=>{const v=saldo(m);return <Sec key={m} style={{marginBottom:0,borderTop:`3px solid ${LIMA}`}}><p style={{...LBL,marginBottom:6}}>Saldo en {l} ({m})</p><p style={{margin:0,fontSize:32,fontWeight:800,letterSpacing:"-0.02em",color:v>=0?LIMA:BAD,fontVariantNumeric:"tabular-nums"}}>{fmtMon(v,m)}</p><p style={{margin:"4px 0 0",fontSize:12.5,color:GRIS}}>{v>=0?"A favor de Argenmaq (la financiera debe)":"Argenmaq le debe a la financiera"}</p></Sec>;})}
    </div>
    {panel==="ingreso"&&<CCMov tipo="ingreso" token={token} dq={dq} ses={ses} pedidos={pedidos} onCerrar={()=>setPanel(null)} onHecho={async()=>{setPanel(null);await recargar();}}/>}
    {panel==="retiro"&&<CCMov tipo="retiro" token={token} dq={dq} ses={ses} pedidos={pedidos} onCerrar={()=>setPanel(null)} onHecho={async()=>{setPanel(null);await recargar();}}/>}
    {panel==="dolarizar"&&<CCDolarizar dq={dq} ses={ses} disponible={saldo("ARS")} onCerrar={()=>setPanel(null)} onHecho={async()=>{setPanel(null);await recargar();}}/>}
    {panel==="compartir"&&<CCCompartir dq={dq} onCerrar={()=>setPanel(null)}/>}
    <div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 18px"}}><b style={{fontSize:15}}>Movimientos</b><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{filas.length}</span><span style={{flex:1}}/>{["todo","ARS","USD"].map(k=><Pill key={k} small on={filtro===k} onClick={()=>setFiltro(k)}>{k==="todo"?"Todo":k}</Pill>)}</div>
      {filas.length===0?<p style={{margin:0,padding:"30px 18px",color:GRIS,fontSize:13.5}}>Sin movimientos con la financiera.</p>
      :<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
        <thead><tr>{["Fecha","Tipo","Moneda","Descripción","Importe","Comisión","Acreditado","Saldo ARS","Saldo USD",""].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>{filas.map(m=>{const ing=m.tipo!=="retiro";return <tr key={m.id}>
          <td style={{...TD,fontFamily:MONO,fontSize:12.5,whiteSpace:"nowrap"}}>{fmtFecha(m.fecha)}</td>
          <td style={{...TD,fontWeight:700,color:ing?OK:BAD,whiteSpace:"nowrap"}}>{ing?"▲":"▼"} {CC_TIPO[m.tipo]||m.tipo}</td>
          <td style={TD}>{m.moneda}</td>
          <td style={TD}>{m.comprobante_url&&<a href={m.comprobante_url} target="_blank" rel="noreferrer" style={{marginRight:8,textDecoration:"none"}}>📎</a>}{m.concepto||"—"}</td>
          <td style={{...TD,fontFamily:MONO,textAlign:"right",whiteSpace:"nowrap",color:ing?OK:BAD}}>{ing?"+":"−"}{fmtNum(m.monto)}</td>
          <td style={{...TD,fontFamily:MONO,textAlign:"right",whiteSpace:"nowrap",color:WARN}}>{m.comision_pct!=null?`${String(m.comision_pct).replace(".",",")}% · −${fmtNum(m.comision)}`:"—"}</td>
          <td style={{...TD,fontFamily:MONO,textAlign:"right",whiteSpace:"nowrap"}}>{fmtNum(m.acreditado??m.monto)}</td>
          <td style={{...TD,fontFamily:MONO,textAlign:"right",whiteSpace:"nowrap",fontWeight:m.moneda==="ARS"?800:500,color:m.moneda==="ARS"?LIMA:GRIS}}>{fmtNum(m.saldoArs)}</td>
          <td style={{...TD,fontFamily:MONO,textAlign:"right",whiteSpace:"nowrap",fontWeight:m.moneda==="USD"?800:500,color:m.moneda==="USD"?LIMA:GRIS}}>{fmtNum(m.saldoUsd)}</td>
          <td style={{...TD,textAlign:"right"}}><Btn small kind="danger" onClick={()=>borrar(m)}>✕</Btn></td>
        </tr>;})}</tbody>
      </table></div>}
    </div>
  </>;
}
function CCMov({tipo,token,dq,ses,pedidos,onCerrar,onHecho}){
  const [f,setF]=useState({fecha:hoyISO(),moneda:"ARS",monto:"",comision_pct:"2,5",concepto:"",pedido_id:"",archivo:null});
  const [guardando,setGuardando]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const com=tipo==="ingreso"?n(f.monto)*n(f.comision_pct)/100:0;
  const guardar=async()=>{if(n(f.monto)<=0){toast("Cargá el importe","error");return;}setGuardando(true);try{
    let url=null;
    if(f.archivo){const ext=(f.archivo.name.split(".").pop()||"bin").toLowerCase();const path=`cc/${Date.now()}.${ext}`;const r=await fetch(`${SB_URL_CC}/storage/v1/object/catalogo/${path}`,{method:"POST",headers:{apikey:SB_KEY_CC,Authorization:`Bearer ${token}`,"Content-Type":f.archivo.type||"application/octet-stream"},body:f.archivo});if(!r.ok)throw new Error(`No se pudo subir el comprobante (${r.status})`);url=`${SB_URL_CC}/storage/v1/object/public/catalogo/${path}`;}
    await dq("cat_cc_financiera",{method:"POST",body:{fecha:f.fecha,tipo,moneda:f.moneda,monto:n(f.monto),comision_pct:tipo==="ingreso"?n(f.comision_pct):null,comision:Math.round(com*100)/100,acreditado:Math.round((n(f.monto)-com)*100)/100,concepto:txtONull(f.concepto),pedido_id:f.pedido_id||null,comprobante_url:url,created_by:ses.user?.id||null}});
    toast("Registrado");onHecho();
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  return <Sec titulo={tipo==="ingreso"?"Nuevo ingreso":"Retiro (egreso)"} style={{borderColor:LIMA}}>
    <div className="grid3" style={GRID}>
      <Campo label="Fecha"><Fecha value={f.fecha} onChange={v=>set("fecha",v)}/></Campo>
      <Campo label="Moneda"><div style={{display:"flex",gap:6}}><Pill on={f.moneda==="ARS"} onClick={()=>set("moneda","ARS")}>ARS</Pill><Pill on={f.moneda==="USD"} onClick={()=>set("moneda","USD")}>USD</Pill></div></Campo>
      <Campo label={`Importe (${f.moneda})`} ob><Inp type="number" step="0.01" value={f.monto} onChange={e=>set("monto",e.target.value)}/></Campo>
      {tipo==="ingreso"&&<Campo label="Comisión de la financiera (%)" hint={n(f.monto)>0?`−${fmtMon(com,f.moneda)} · acreditado ${fmtMon(n(f.monto)-com,f.moneda)}`:null}><Inp type="number" step="0.01" value={f.comision_pct} onChange={e=>set("comision_pct",e.target.value)}/></Campo>}
      <Campo label="Descripción" span={tipo==="ingreso"?2:3}><Inp value={f.concepto} onChange={e=>set("concepto",e.target.value)} placeholder={tipo==="ingreso"?"Cobro AM-00001 · cliente":"Retiro"}/></Campo>
      <Campo label="Operación (opcional)"><Desplegable value={f.pedido_id} onChange={v=>set("pedido_id",v)} opciones={pedidos.map(p=>({v:p.id,l:`${codigoOp(p)} · ${p.cliente_nombre}`}))} placeholder="Sin operación"/></Campo>
      <Campo label="Comprobante" span={2}><Archivo onFiles={(fs)=>set("archivo",fs[0])} label={f.archivo?f.archivo.name.slice(0,28):"Adjuntar"} hint={f.archivo?"listo · podés cambiarlo":"Arrastrá, pegá con Ctrl+V o elegí"}/></Campo>
    </div>
    <div style={{display:"flex",gap:8,marginTop:14}}><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn><Btn onClick={onCerrar}>Cancelar</Btn></div>
  </Sec>;
}
function CCDolarizar({dq,ses,disponible,onCerrar,onHecho}){
  const [f,setF]=useState({fecha:hoyISO(),ars:"",tc:""});
  const [guardando,setGuardando]=useState(false);
  const usd=n(f.tc)>0?n(f.ars)/n(f.tc):0;
  const guardar=async()=>{if(n(f.ars)<=0||n(f.tc)<=0){toast("Cargá el importe en pesos y el tipo de cambio","error");return;}setGuardando(true);try{
    const concepto=`💱 Dolarización de ${fmtMon(n(f.ars),"ARS")} @ TC ${fmtNum(n(f.tc))}`;
    await dq("cat_cc_financiera",{method:"POST",body:[
      {fecha:f.fecha,tipo:"retiro",moneda:"ARS",monto:n(f.ars),comision:0,acreditado:n(f.ars),tipo_cambio:n(f.tc),concepto,created_by:ses.user?.id||null},
      {fecha:f.fecha,tipo:"dolarizacion",moneda:"USD",monto:Math.round(usd*100)/100,comision:0,acreditado:Math.round(usd*100)/100,tipo_cambio:n(f.tc),concepto,created_by:ses.user?.id||null},
    ]});
    toast("Dolarizado");onHecho();
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  return <Sec titulo="Dolarizar pesos" style={{borderColor:LIMA}}>
    <div className="grid3" style={GRID}>
      <Campo label="Fecha"><Fecha value={f.fecha} onChange={v=>setF(x=>({...x,fecha:v}))}/></Campo>
      <Campo label="Importe en pesos" ob hint={`Disponible: ${fmtMon(disponible,"ARS")}`}><Inp type="number" step="0.01" value={f.ars} onChange={e=>setF(x=>({...x,ars:e.target.value}))}/></Campo>
      <Campo label="Tipo de cambio (ARS por USD)" ob hint={usd>0?`= ${fmtMon(usd,"USD")}`:null}><Inp type="number" step="0.01" value={f.tc} onChange={e=>setF(x=>({...x,tc:e.target.value}))}/></Campo>
    </div>
    <div style={{display:"flex",gap:8,marginTop:14}}><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Dolarizar"}</Btn><Btn onClick={onCerrar}>Cancelar</Btn></div>
  </Sec>;
}
function CCCompartir({dq,onCerrar}){
  const [tokens,setTokens]=useState(null);const [label,setLabel]=useState("");
  const cargar=async()=>{try{const r=await dq("cat_cc_tokens",{filters:"?select=*&order=created_at.desc"});setTokens(Array.isArray(r)?r:[]);}catch(e){toast(e.message,"error");setTokens([]);}};
  useEffect(()=>{cargar();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const crear=async()=>{try{const t=Array.from(crypto.getRandomValues(new Uint8Array(18))).map(b=>b.toString(16).padStart(2,"0")).join("");await dq("cat_cc_tokens",{method:"POST",body:{token:t,label:txtONull(label)}});setLabel("");await cargar();toast("Link creado");}catch(e){toast(e.message,"error");}};
  const alternar=async(t)=>{try{await dq("cat_cc_tokens",{method:"PATCH",filters:`?id=eq.${t.id}`,body:{active:!t.active}});await cargar();}catch(e){toast(e.message,"error");}};
  const borrar=async(t)=>{if(!(await confirmDialog("¿Eliminar este link? Quien lo tenga deja de ver la cuenta.")))return;try{await dq("cat_cc_tokens",{method:"DELETE",filters:`?id=eq.${t.id}`,prefer:"return=minimal"});await cargar();}catch(e){toast(e.message,"error");}};
  const url=(t)=>`${typeof window!=="undefined"?window.location.origin:""}${typeof window!=="undefined"&&/argenmaq\./i.test(window.location.host)?"":"/argenmaq"}/cc/${t.token}`;
  const copiar=async(t)=>{try{await navigator.clipboard.writeText(url(t));toast("Link copiado");}catch{toast(url(t),"info",{duration:8000});}};
  return <Sec titulo="Compartir con la financiera" style={{borderColor:LIMA}}>
    <p style={{margin:"0 0 12px",fontSize:13,color:GRIS}}>Quien tenga el link ve la cuenta de solo lectura y puede bajar el Excel. Se puede pausar o eliminar cuando quieras.</p>
    <div style={{display:"flex",gap:8,marginBottom:14}}><Inp value={label} onChange={e=>setLabel(e.target.value)} placeholder="Para quién (opcional)"/><Btn kind="lima" onClick={crear}>Crear link</Btn><Btn onClick={onCerrar}>Cerrar</Btn></div>
    {tokens===null?<p style={{margin:0,color:GRIS,fontSize:13}}>Cargando…</p>:tokens.length===0?<p style={{margin:0,color:GRIS,fontSize:13}}>Todavía no hay links.</p>
    :<div style={{display:"grid",gap:8}}>{tokens.map(t=><div key={t.id} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:12,background:SUAVE,fontSize:13.5,flexWrap:"wrap"}}><span style={{fontWeight:700}}>{t.label||"Sin nombre"}</span><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS,flex:1,minWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url(t)}</span><span style={{fontFamily:MONO,fontSize:10.5,color:t.active?OK:GRIS}}>{t.active?"ACTIVO":"PAUSADO"}</span><Btn small onClick={()=>copiar(t)}>Copiar</Btn><Btn small onClick={()=>alternar(t)}>{t.active?"Pausar":"Activar"}</Btn><Btn small kind="danger" onClick={()=>borrar(t)}>✕</Btn></div>)}</div>}
  </Sec>;
}

// ── Tarifas: parámetros a la izquierda, simulador a la derecha ────────────────────────────
export function Tarifas({dq,ajustes,setAjustes}){
  const claves=["gestion_pct","markup_minimo_usd","fin_pct","fin_fijo_usd","adelanto_extra_pct"];
  const [a,setA]=useState(()=>Object.fromEntries(claves.map(k=>[k,String(ajustes[k])])));
  const [sim,setSim]=useState({exw:"5000",qty:"1",pct:"",arg:"1500"});
  const [guardando,setGuardando]=useState(false);
  const set=(k,v)=>setA(x=>({...x,[k]:v}));
  const filas=()=>claves.map(k=>({clave:k,valor:n(a[k])})).concat([{clave:"fin_pagos",valor:1}]);
  const guardar=async()=>{setGuardando(true);try{
    await dq("cat_ajustes",{method:"POST",prefer:"resolution=merge-duplicates,return=representation",body:filas().map(f=>({...f,updated_at:new Date().toISOString()}))});
    setAjustes(x=>({...x,...Object.fromEntries(filas().map(f=>[f.clave,f.valor]))}));toast("Tarifas guardadas");
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const aj={...ajustes,...Object.fromEntries(filas().map(f=>[f.clave,f.valor]))};
  const r=totalesPedido([{exw_unit:n(sim.exw),qty:n(sim.qty,1),gestion_pct:sim.pct.trim()===""?null:n(sim.pct)}],aj,n(sim.arg));
  const pctSim=sim.pct.trim()===""?n(aj.gestion_pct):n(sim.pct);
  const piso=(r.exw_total+r.financiero+n(sim.arg))*pctSim/100<n(aj.markup_minimo_usd)*n(sim.qty,1);
  const Fila=({l,hint,k,step})=><div style={{display:"grid",gridTemplateColumns:"1fr 150px",gap:14,alignItems:"center",padding:"12px 0",borderTop:`1px solid ${BORDE}`}}><div><p style={{margin:0,fontSize:14,fontWeight:700}}>{l}</p>{hint&&<p style={{margin:"2px 0 0",fontSize:12.5,color:GRIS}}>{hint}</p>}</div><Inp type="number" step={step||"1"} value={a[k]} onChange={e=>set(k,e.target.value)} style={{textAlign:"right",fontFamily:MONO}}/></div>;
  return <>
    <Barra><span style={{flex:1}}/><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn></Barra>
    <div className="dos" style={{...DOS,gridTemplateColumns:"1.2fr 1fr"}}>
      <div>
        <Sec titulo="Gestión">
          <Fila l="Gestión por defecto (%)" hint="Se define máquina por máquina y vía por vía; esto es el punto de partida." k="gestion_pct" step="0.5"/>
          <Fila l="Piso por máquina (USD)" hint="Si el porcentaje da menos que esto, se cobra esto." k="markup_minimo_usd"/>
          <Fila l="Adelanto mínimo: EXW + (%)" hint="El precio de la máquina tiene que cubrir el EXW más este porcentaje." k="adelanto_extra_pct"/>
        </Sec>
        <Sec titulo="Costo financiero del pago a fábrica">
          <Fila l="Porcentaje por transferencia (%)" k="fin_pct" step="0.01"/>
          <Fila l="Fijo por transferencia (USD)" hint="Una transferencia por operación." k="fin_fijo_usd"/>
        </Sec>
      </div>
      <Sec titulo="Probá con una máquina" style={{position:"sticky",top:14,alignSelf:"start"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Campo label="EXW (USD)"><Inp type="number" value={sim.exw} onChange={e=>setSim(x=>({...x,exw:e.target.value}))}/></Campo>
          <Campo label="Cantidad"><Inp type="number" value={sim.qty} onChange={e=>setSim(x=>({...x,qty:e.target.value}))}/></Campo>
          <Campo label="Gestión (%)"><Inp type="number" step="0.5" value={sim.pct} onChange={e=>setSim(x=>({...x,pct:e.target.value}))} placeholder={String(aj.gestion_pct)}/></Campo>
          <Campo label="Importación Argencargo (USD)"><Inp type="number" value={sim.arg} onChange={e=>setSim(x=>({...x,arg:e.target.value}))}/></Campo>
        </div>
        <div style={{marginTop:18,background:SUAVE,borderRadius:14,padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr auto",gap:"6px 18px",fontSize:13.5}}>
          <span style={{color:GRIS}}>EXW</span><span style={{fontFamily:MONO,textAlign:"right"}}>{fmtUsd(r.exw_total)}</span>
          <span style={{color:GRIS}}>Financiero</span><span style={{fontFamily:MONO,textAlign:"right"}}>{fmtUsd(r.financiero)}</span>
          <span style={{color:GRIS}}>Importación · Argencargo</span><span style={{fontFamily:MONO,textAlign:"right"}}>{fmtUsd(n(sim.arg))}</span>
          <span style={{color:GRIS}}>Gestión ({String(pctSim).replace(".",",")} % sobre todos los costos{piso?" → piso":""})</span><span style={{fontFamily:MONO,textAlign:"right"}}>{fmtUsd(r.gestion)}</span>
          <span style={{fontWeight:800,borderTop:`1px solid ${BORDE}`,paddingTop:8}}>Precio de la máquina · anticipo</span><span style={{fontFamily:MONO,fontWeight:800,textAlign:"right",borderTop:`1px solid ${BORDE}`,paddingTop:8,fontSize:16}}>{fmtUsd(r.precio_total)}</span>
          <span style={{fontWeight:800}}>Total para el cliente</span><span style={{fontFamily:MONO,fontWeight:800,textAlign:"right",fontSize:16}}>{fmtUsd(r.total)}</span>
          <span style={{color:GRIS}}>Ganancia neta</span><span style={{fontFamily:MONO,textAlign:"right",color:OK,fontWeight:700}}>{fmtUsd(r.gestion)}</span>
        </div>
        <p style={{margin:"10px 0 0",fontSize:12.5,color:r.cubreAdelanto?OK:BAD}}>{r.cubreAdelanto?`Cubre el adelanto mínimo (${fmtUsd(r.adelantoMinimo)}).`:`No cubre el adelanto mínimo (${fmtUsd(r.adelantoMinimo)}): subí la gestión.`}</p>
      </Sec>
    </div>
  </>;
}
