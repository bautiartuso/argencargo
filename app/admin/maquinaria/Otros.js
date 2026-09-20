"use client";
// Inicio, Clientes (misma base que Argencargo) y Ajustes (con Usuarios adentro).
import { useState, useEffect } from "react";
import { INK,GRIS,BORDE,SUAVE,CARD,LIMA,LIMA_SUAVE,OK,OK_BG,WARN,WARN_BG,BAD,BAD_BG,MONO,INP,LBL,TH,TD,GRID,DOS,Campo,Inp,Btn,Sec,Pill,Barra,Vacio,Dato,Barras,Solapas,Toggle,Desplegable,n,txtONull,fmtUsd,fmtK,fmtFecha,codigoOp,codigoMaq,ChipPed,ESTADOS_PEDIDO,ACTIVOS,CATEG_MOV,MESES,nombreCliente,toast,confirmDialog } from "./ui";
import { cobradoDe, pagadoFabricaDe } from "./Pedidos";
import { porMes } from "./Finanzas";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

// ── Inicio: lo que hay que hacer hoy, más el pulso del negocio ────────────────────────────
export function Inicio({ses,prods,pedidos,movs,ajustes,ir}){
  const hoy=new Date();
  const activos=pedidos.filter(p=>ACTIVOS.includes(p.estado));
  const porCobrar=activos.reduce((s,p)=>s+Math.max(0,n(p.precio_total)-cobradoDe(movs,p.id)),0);
  const mes=movs.filter(m=>{const d=new Date(m.fecha+"T12:00:00");return d.getMonth()===hoy.getMonth()&&d.getFullYear()===hoy.getFullYear();});
  const gananciaMes=mes.reduce((s,m)=>s+(m.tipo==="ingreso"?1:-1)*n(m.monto_usd),0);
  const caja=movs.reduce((s,m)=>s+(m.tipo==="ingreso"?1:-1)*n(m.monto_usd),0);
  const tareas=[];
  activos.filter(p=>p.estado==="nuevo").forEach(p=>{const falta=n(p.precio_total)-cobradoDe(movs,p.id);if(falta>0.01)tareas.push({titulo:`Cobrar ${fmtUsd(falta)} a ${p.cliente_nombre}`,sub:`${codigoOp(p)} · nueva, sin cobrar del todo`,k:"pedidos",x:p.id,c:WARN});else tareas.push({titulo:`Marcar como pagada: ${codigoOp(p)}`,sub:`${p.cliente_nombre} ya cubrió el precio`,k:"pedidos",x:p.id,c:OK});});
  activos.filter(p=>p.estado==="pagado").forEach(p=>{const falta=n(p.exw_total)-pagadoFabricaDe(movs,p.id);if(falta>0.01)tareas.push({titulo:`Pagar ${fmtUsd(falta)} a la fábrica`,sub:`${codigoOp(p)} · ${(p.items||[]).map(i=>i.proveedor).filter(Boolean)[0]||p.cliente_nombre}`,k:"pedidos",x:p.id,c:BAD});else tareas.push({titulo:`Pasar a producción: ${codigoOp(p)}`,sub:"la fábrica ya cobró",k:"pedidos",x:p.id,c:OK});});
  activos.filter(p=>p.estado==="en_produccion").forEach(p=>{const dias=Math.max(0,...(p.items||[]).map(i=>n(i.dias_produccion)));const pagoAt=(p.historial||[]).find(h=>h.estado==="pagado")?.at||p.created_at;const listaEl=new Date(new Date(pagoAt).getTime()+dias*864e5);const rest=Math.ceil((listaEl-hoy)/864e5);if(dias>0&&rest<=0)tareas.push({titulo:`Debería estar lista: ${codigoOp(p)}`,sub:`${p.cliente_nombre} · venció hace ${-rest} día${-rest===1?"":"s"}`,k:"pedidos",x:p.id,c:WARN});else if(dias>0&&rest<=5)tareas.push({titulo:`Sale en ${rest} día${rest===1?"":"s"}: ${codigoOp(p)}`,sub:`${p.cliente_nombre} · avisale y coordiná con Argencargo`,k:"pedidos",x:p.id,c:GRIS});});
  activos.filter(p=>p.estado==="listo_fabrica"&&!p.operation_id).forEach(p=>tareas.push({titulo:`Abrir la operación en Argencargo: ${codigoOp(p)}`,sub:`${p.cliente_nombre} · la máquina está lista en fábrica`,k:"pedidos",x:p.id,c:WARN}));
  const viejas=prods.filter(p=>p.estado==="publicado"&&p.precio_verificado_at&&(hoy-new Date(p.precio_verificado_at))/864e5>30);
  if(viejas.length)tareas.push({titulo:`${viejas.length} máquina${viejas.length>1?"s":""} con el EXW sin revisar hace más de 30 días`,sub:viejas.slice(0,4).map(p=>codigoMaq(p)).join(", ")+(viejas.length>4?"…":""),k:"maquinas",c:GRIS});
  const borradores=prods.filter(p=>p.estado==="borrador");
  if(borradores.length)tareas.push({titulo:`${borradores.length} máquina${borradores.length>1?"s":""} en borrador`,sub:"sin publicar todavía",k:"maquinas",c:GRIS});
  const serie=porMes(pedidos.filter(p=>p.estado!=="cancelado"),p=>p.created_at,p=>n(p.precio_total)).slice(6);
  const top=Object.values((pedidos.filter(p=>p.estado!=="cancelado").flatMap(p=>p.items||[])).reduce((acc,i)=>{const k=i.producto_id||i.nombre;acc[k]=acc[k]||{nombre:i.nombre,q:0};acc[k].q+=n(i.qty,1);return acc;},{})).sort((a,b)=>b.q-a.q).slice(0,5);
  const porEstado=ESTADOS_PEDIDO.filter(e=>ACTIVOS.includes(e.k)).map(e=>({...e,c:pedidos.filter(p=>p.estado===e.k).length})).filter(e=>e.c>0);
  const saludo=hoy.getHours()<12?"Buen día":hoy.getHours()<20?"Buenas tardes":"Buenas noches";
  const nombre=(ses.user?.email||"").split("@")[0];
  return <>
    <div style={{display:"flex",alignItems:"end",gap:14,flexWrap:"wrap",marginBottom:20}}>
      <div style={{flex:1}}><p style={{...LBL,marginBottom:2}}>{hoy.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}</p><h1 style={{margin:0,fontSize:26,fontWeight:800,letterSpacing:"-0.03em"}}>{saludo}, {nombre}.</h1></div>
      <Btn kind="lima" onClick={()=>ir("pedidos")}>Operaciones</Btn><Btn onClick={()=>ir("maquinas")}>Máquinas</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,marginBottom:14}}>
      <Dato l="Operaciones activas" v={String(activos.length)} sub={porEstado.map(e=>`${e.c} ${e.l.toLowerCase()}`).join(" · ")||"ninguna"}/>
      <Dato l="Por cobrar" v={fmtUsd(porCobrar)} sub="de las operaciones activas" color={porCobrar>0?WARN:INK} acento={WARN}/>
      <Dato l={`Ganancia · ${MESES[hoy.getMonth()].toLowerCase()}`} v={fmtUsd(gananciaMes)} sub="ingresos − egresos" color={gananciaMes>=0?OK:BAD} acento={OK}/>
      <Dato l="En caja" v={fmtUsd(caja)} sub="acumulado" acento={GRIS}/>
    </div>
    <div className="dos" style={{...DOS,gridTemplateColumns:"1.3fr 1fr"}}>
      <Sec titulo="Para hacer" extra={<span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>{tareas.length} PENDIENTE{tareas.length===1?"":"S"}</span>}>
        {tareas.length===0?<p style={{margin:0,fontSize:13.5,color:GRIS}}>Nada pendiente. Todo al día.</p>
        :<div style={{display:"grid",gap:6}}>{tareas.map((t,i)=><button key={i} className="fila" onClick={()=>ir(t.k,t.x)} style={{display:"flex",gap:12,alignItems:"center",width:"100%",textAlign:"left",padding:"10px 12px",borderRadius:12,border:"none",background:"transparent",color:INK,cursor:"pointer"}}><span style={{width:8,height:8,borderRadius:"50%",background:t.c,flexShrink:0}}/><span style={{flex:1,minWidth:0}}><span style={{display:"block",fontSize:14,fontWeight:700}}>{t.titulo}</span><span style={{display:"block",fontSize:12.5,color:GRIS}}>{t.sub}</span></span><span style={{color:GRIS}}>→</span></button>)}</div>}
      </Sec>
      <div>
        <Sec titulo="Ventas · últimos 6 meses">{pedidos.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Todavía no hay operaciones.</p>:<Barras series={serie} alto={90} fmt={fmtUsd}/>}</Sec>
        <Sec titulo="Máquinas más pedidas">{top.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Todavía no hay operaciones.</p>:<div style={{display:"grid",gap:8}}>{top.map((t,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"center",fontSize:13.5}}><span style={{fontFamily:MONO,fontSize:11,color:GRIS,width:22}}>{i+1}.</span><span style={{flex:1,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.nombre}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>×{t.q}</span></div>)}</div>}</Sec>
      </div>
    </div>
    <Sec titulo="Últimas operaciones" extra={<Btn small onClick={()=>ir("pedidos")}>Ver todas</Btn>}>
      {pedidos.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Todavía no hay operaciones.</p>
      :<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
        <thead><tr>{["Operación","Cliente","Máquinas","Estado","Precio","Cobrado"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>{pedidos.slice(0,6).map(p=>{const cob=cobradoDe(movs,p.id);return <tr key={p.id} className="fila" onClick={()=>ir("pedidos",p.id)} style={{cursor:"pointer"}}><td style={{...TD,fontFamily:MONO}}>{codigoOp(p)}</td><td style={{...TD,fontWeight:800}}>{p.cliente_nombre}</td><td style={{...TD,color:GRIS,maxWidth:300}}><span style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(p.items||[]).map(i=>i.nombre).join(" · ")}</span></td><td style={TD}><ChipPed e={p.estado}/></td><td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap"}}>{fmtUsd(p.precio_total)}</td><td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap",color:cob>=n(p.precio_total)-0.01?OK:cob>0?WARN:GRIS}}>{fmtUsd(cob)}</td></tr>;})}</tbody>
      </table></div>}
    </Sec>
  </>;
}

// ── Clientes: misma tabla que Argencargo, con ficha editable ──────────────────────────────
const COND={responsable_inscripto:"Responsable inscripto",monotributista:"Monotributista",ninguna:"Consumidor final"};
export function Clientes({dq,pedidos,movs,ir}){
  const [q,setQ]=useState("");const [lista,setLista]=useState([]);const [cargando,setCargando]=useState(true);const [sel,setSel]=useState(null);
  const [edit,setEdit]=useState(null);const [guardando,setGuardando]=useState(false);
  const buscar=async(t)=>{setCargando(true);try{
    const s=t.trim().replace(/[%,()]/g,"");
    const f=s.length>=2?`&or=(first_name.ilike.*${s}*,last_name.ilike.*${s}*,company_name.ilike.*${s}*,email.ilike.*${s}*,client_code.ilike.*${s}*,whatsapp.ilike.*${s}*,cuit.ilike.*${s}*)`:"";
    const r=await dq("clients",{filters:`?select=id,client_code,first_name,last_name,company_name,email,whatsapp,cuit,dni,tax_condition,street,floor_apt,city,province,postal_code,created_at,account_balance_usd,is_active&order=created_at.desc&limit=60${f}`});
    setLista(Array.isArray(r)?r:[]);
  }catch(e){toast(e.message,"error");}setCargando(false);};
  useEffect(()=>{buscar("");},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const opsDe=(id)=>pedidos.filter(p=>p.client_id===id);
  const total=(id)=>opsDe(id).filter(p=>p.estado!=="cancelado").reduce((s,p)=>s+n(p.precio_total)+n(p.importacion_usd),0);
  const c=sel?lista.find(x=>x.id===sel):null;
  const guardar=async()=>{setGuardando(true);try{
    const body={first_name:edit.first_name.trim(),last_name:edit.last_name.trim(),company_name:txtONull(edit.company_name),email:edit.email.trim(),whatsapp:edit.whatsapp.trim(),cuit:txtONull(edit.cuit),dni:txtONull(edit.dni),tax_condition:edit.tax_condition||null,street:edit.street.trim(),floor_apt:txtONull(edit.floor_apt),city:edit.city.trim(),province:edit.province.trim(),postal_code:edit.postal_code.trim()};
    await dq("clients",{method:"PATCH",filters:`?id=eq.${c.id}`,body});setLista(l=>l.map(x=>x.id===c.id?{...x,...body}:x));setEdit(null);toast("Cliente actualizado");
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  if(c)return <>
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"0 0 22px"}}><Btn small onClick={()=>{setSel(null);setEdit(null);}}>← Clientes</Btn><span style={{fontWeight:800,fontSize:18}}>{nombreCliente(c)}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{c.client_code}</span><span style={{flex:1}}/>{c.whatsapp&&<a href={`https://wa.me/${String(c.whatsapp).replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn small kind="lima">WhatsApp</Btn></a>}{!edit&&<Btn small onClick={()=>setEdit({first_name:c.first_name||"",last_name:c.last_name||"",company_name:c.company_name||"",email:c.email||"",whatsapp:c.whatsapp||"",cuit:c.cuit||"",dni:c.dni||"",tax_condition:c.tax_condition||"",street:c.street||"",floor_apt:c.floor_apt||"",city:c.city||"",province:c.province||"",postal_code:c.postal_code||""})}>Editar</Btn>}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:14}}>
      <Dato l="Código" v={c.client_code||"—"} acento={GRIS}/>
      <Dato l="Operaciones" v={String(opsDe(c.id).length)} sub={`${opsDe(c.id).filter(p=>ACTIVOS.includes(p.estado)).length} activas`}/>
      <Dato l="Comprado" v={fmtUsd(total(c.id))} acento={OK}/>
      <Dato l="Condición" v={COND[c.tax_condition]||"—"} acento={GRIS}/>
      <Dato l="Saldo en Argencargo" v={fmtUsd(c.account_balance_usd||0)} color={n(c.account_balance_usd)<0?BAD:INK} acento={GRIS}/>
      <Dato l="Cliente desde" v={fmtFecha(c.created_at)} acento={GRIS}/>
    </div>
    <div className="dos" style={DOS}>
      <Sec titulo="Datos" extra={edit?<div style={{display:"flex",gap:8}}><Btn small kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn><Btn small onClick={()=>setEdit(null)}>Cancelar</Btn></div>:null}>
        {edit?<div style={{display:"grid",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Campo label="Nombre"><Inp value={edit.first_name} onChange={e=>setEdit(x=>({...x,first_name:e.target.value}))}/></Campo><Campo label="Apellido"><Inp value={edit.last_name} onChange={e=>setEdit(x=>({...x,last_name:e.target.value}))}/></Campo></div>
          <Campo label="Empresa"><Inp value={edit.company_name} onChange={e=>setEdit(x=>({...x,company_name:e.target.value}))}/></Campo>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Campo label="Email"><Inp value={edit.email} onChange={e=>setEdit(x=>({...x,email:e.target.value}))}/></Campo><Campo label="WhatsApp"><Inp value={edit.whatsapp} onChange={e=>setEdit(x=>({...x,whatsapp:e.target.value}))}/></Campo></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}><Campo label="Condición"><Desplegable value={edit.tax_condition} onChange={v=>setEdit(x=>({...x,tax_condition:v}))} opciones={Object.entries(COND).map(([v,l])=>({v,l}))} buscar={false}/></Campo><Campo label="CUIT"><Inp value={edit.cuit} onChange={e=>setEdit(x=>({...x,cuit:e.target.value}))}/></Campo><Campo label="DNI"><Inp value={edit.dni} onChange={e=>setEdit(x=>({...x,dni:e.target.value}))}/></Campo></div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}><Campo label="Calle y número"><Inp value={edit.street} onChange={e=>setEdit(x=>({...x,street:e.target.value}))}/></Campo><Campo label="Piso / depto"><Inp value={edit.floor_apt} onChange={e=>setEdit(x=>({...x,floor_apt:e.target.value}))}/></Campo></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}><Campo label="Ciudad"><Inp value={edit.city} onChange={e=>setEdit(x=>({...x,city:e.target.value}))}/></Campo><Campo label="Provincia"><Inp value={edit.province} onChange={e=>setEdit(x=>({...x,province:e.target.value}))}/></Campo><Campo label="Código postal"><Inp value={edit.postal_code} onChange={e=>setEdit(x=>({...x,postal_code:e.target.value}))}/></Campo></div>
        </div>
        :<div style={{display:"grid",gap:10,fontSize:14}}>
          <div><p style={{...LBL,marginBottom:2}}>Persona</p><b>{`${c.first_name||""} ${c.last_name||""}`.trim()||"—"}</b></div>
          {c.company_name&&<div><p style={{...LBL,marginBottom:2}}>Empresa</p><b>{c.company_name}</b></div>}
          <div><p style={{...LBL,marginBottom:2}}>Email</p><span>{c.email||"—"}</span></div>
          <div><p style={{...LBL,marginBottom:2}}>WhatsApp</p><span style={{fontFamily:MONO}}>{c.whatsapp||"—"}</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><p style={{...LBL,marginBottom:2}}>CUIT</p><span style={{fontFamily:MONO}}>{c.cuit||"—"}</span></div><div><p style={{...LBL,marginBottom:2}}>DNI</p><span style={{fontFamily:MONO}}>{c.dni||"—"}</span></div></div>
          <div><p style={{...LBL,marginBottom:2}}>Dirección</p><span>{[c.street,c.floor_apt,c.city,c.province,c.postal_code].filter(Boolean).join(", ")||"—"}</span></div>
        </div>}
      </Sec>
      <Sec titulo="Operaciones">
        {opsDe(c.id).length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Todavía no compró.</p>
        :<div style={{display:"grid",gap:8}}>{opsDe(c.id).map(p=><button key={p.id} className="fila" onClick={()=>ir("pedidos",p.id)} style={{display:"flex",gap:12,alignItems:"center",width:"100%",textAlign:"left",padding:"9px 10px",borderRadius:10,border:"none",background:"transparent",color:INK,cursor:"pointer",fontSize:13.5}}><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS}}>{codigoOp(p)}</span><span style={{flex:1,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(p.items||[]).map(i=>i.nombre).join(" · ")}</span><ChipPed e={p.estado}/><b style={{fontFamily:MONO,whiteSpace:"nowrap"}}>{fmtUsd(n(p.precio_total)+n(p.importacion_usd))}</b></button>)}</div>}
      </Sec>
    </div>
  </>;
  return <>
    <Barra><input placeholder="Buscar cliente…" value={q} onChange={e=>{setQ(e.target.value);buscar(e.target.value);}} style={{...INP,flex:1,minWidth:200,borderRadius:999,padding:"10px 18px"}}/><span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>MISMA BASE QUE ARGENCARGO</span></Barra>
    {cargando?<p style={{color:GRIS}}>Cargando…</p>:lista.length===0?<Vacio>Nada que coincida.</Vacio>
    :<div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
      <thead><tr>{["Código","Cliente","WhatsApp","Email","CUIT","Ubicación","Operaciones","Comprado"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{lista.map(c=><tr key={c.id} className="fila" onClick={()=>setSel(c.id)} style={{cursor:"pointer"}}><td style={{...TD,fontFamily:MONO,fontSize:12.5,color:GRIS}}>{c.client_code||"—"}</td><td style={{...TD,fontWeight:800}}>{nombreCliente(c)}{c.company_name&&(c.first_name||c.last_name)&&<span style={{display:"block",fontWeight:500,color:GRIS,fontSize:12.5}}>{`${c.first_name||""} ${c.last_name||""}`.trim()}</span>}</td><td style={{...TD,whiteSpace:"nowrap",fontFamily:MONO,fontSize:12.5}}>{c.whatsapp||"—"}</td><td style={{...TD,color:GRIS}}>{c.email||"—"}</td><td style={{...TD,fontFamily:MONO,fontSize:12.5}}>{c.cuit||"—"}</td><td style={{...TD,color:GRIS}}>{[c.city,c.province].filter(Boolean).join(", ")||"—"}</td><td style={{...TD,fontFamily:MONO}}>{opsDe(c.id).length}</td><td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap"}}>{total(c.id)?fmtUsd(total(c.id)):"—"}</td></tr>)}</tbody>
    </table></div></div>}
  </>;
}

// ── Ajustes: general (apariencia, avisos), usuarios y categorías de gastos ───────────────
export function Ajustes({ses,dq,token,ajustes,setAjustes,tema,setTema,gastoCats,recargar}){
  const [tab,setTab]=useState("general");
  return <div style={{maxWidth:760}}>
    <div style={{display:"inline-flex",gap:4,padding:4,borderRadius:999,background:SUAVE,marginBottom:22}}>{[["general","General"],["usuarios","Usuarios"],["gastos","Categorías de gastos"]].map(([k,l])=><button key={k} type="button" onClick={()=>setTab(k)} style={{padding:"8px 16px",borderRadius:999,border:"none",background:tab===k?LIMA:"transparent",color:tab===k?"var(--mq-lima-ink)":GRIS,fontSize:13.5,fontWeight:700,cursor:"pointer"}}>{l}</button>)}</div>
    {tab==="general"&&<General ses={ses} dq={dq} ajustes={ajustes} setAjustes={setAjustes} tema={tema} setTema={setTema}/>}
    {tab==="usuarios"&&<Usuarios ses={ses} token={token}/>}
    {tab==="gastos"&&<GastoCats dq={dq} gastoCats={gastoCats} recargar={recargar}/>}
  </div>;
}
function General({ses,dq,ajustes,setAjustes,tema,setTema}){
  const [notif,setNotif]=useState({...(ajustes.notif||{})});
  const [guardando,setGuardando]=useState(false);
  const guardar=async()=>{setGuardando(true);try{
    await dq("cat_ajustes",{method:"POST",prefer:"resolution=merge-duplicates,return=representation",body:[{clave:"notif",valor:notif,updated_at:new Date().toISOString()}]});
    setAjustes(x=>({...x,notif}));toast("Ajustes guardados");
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const AV=[["pedido_nuevo","Operación nueva","cuando un cliente arma una operación"],["cobro","Cobro registrado","cada vez que entra plata de una operación"],["produccion_vencida","Producción vencida","cuando una máquina debería estar lista y sigue en producción"],["precio_vencido","EXW sin revisar","máquinas publicadas con el precio viejo, más de 30 días"]];
  return <>
    <Sec titulo="Apariencia">
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{[["cat","Grafito y amarillo"],["claro","Claro"]].map(([k,l])=><button key={k} type="button" onClick={()=>setTema(k)} style={{flex:"1 1 200px",textAlign:"left",padding:"14px 16px",borderRadius:14,cursor:"pointer",border:`1.5px solid ${(tema==="claro")===(k==="claro")?LIMA:BORDE}`,background:(tema==="claro")===(k==="claro")?LIMA_SUAVE:"transparent",color:INK}}><span style={{display:"inline-block",width:34,height:20,borderRadius:6,marginBottom:8,background:k==="claro"?"#F7F7F5":"#141517",border:"1px solid var(--mq-borde)",verticalAlign:"middle"}}/><span style={{display:"inline-block",width:14,height:14,borderRadius:4,background:"#FFD200",marginLeft:6,verticalAlign:"middle",position:"relative",top:-4}}/><p style={{margin:0,fontSize:14,fontWeight:800}}>{l}</p></button>)}</div>
    </Sec>
    <Sec titulo="Avisos por Telegram">
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:10}}>{AV.map(([k,l,sub])=><button key={k} type="button" onClick={()=>setNotif(x=>({...x,[k]:!x[k]}))} style={{display:"flex",gap:12,alignItems:"center",textAlign:"left",padding:"12px 14px",borderRadius:14,cursor:"pointer",border:`1.5px solid ${notif[k]?LIMA:BORDE}`,background:notif[k]?LIMA_SUAVE:"transparent",color:INK}}><span style={{width:38,height:22,borderRadius:11,background:notif[k]?LIMA:BORDE,position:"relative",flexShrink:0,transition:"background 120ms"}}><span style={{position:"absolute",top:3,left:notif[k]?19:3,width:16,height:16,borderRadius:"50%",background:notif[k]?"var(--mq-lima-ink)":CARD,transition:"left 120ms"}}/></span><span><span style={{display:"block",fontSize:14,fontWeight:800}}>{l}</span><span style={{display:"block",fontSize:12.5,color:GRIS}}>{sub}</span></span></button>)}</div>
      <p style={{margin:"12px 0 0",fontSize:12.5,color:GRIS}}>La conexión con el bot se hace después; acá queda definido qué se avisa.</p>
    </Sec>
    <div style={{display:"flex",justifyContent:"flex-end"}}><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn></div>
  </>;
}
function Usuarios({ses,token}){
  const [lista,setLista]=useState(null);
  const [edit,setEdit]=useState(null); // {id,email,password}
  const [guardando,setGuardando]=useState(false);
  const cargar=async()=>{try{const r=await fetch("/api/catalogo/usuarios",{headers:{Authorization:`Bearer ${token}`}});const d=await r.json();if(!r.ok)throw new Error(d.error||"Error");setLista(d.usuarios||[]);}catch(e){toast(e.message,"error");setLista([]);}};
  useEffect(()=>{cargar();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const rol=(p)=>p.role==="admin"?"Admin":p.role==="empleado"?"Empleado":p.is_gi_partner?"Socio GI":p.role;
  const guardar=async()=>{if(!edit.password&&!edit.email){toast("Cargá un mail o una contraseña nueva","error");return;}if(edit.password&&edit.password.length<8){toast("La contraseña tiene que tener al menos 8 caracteres","error");return;}setGuardando(true);try{
    const r=await fetch("/api/catalogo/usuarios",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({id:edit.id,email:edit.email!==edit.emailOriginal?edit.email:undefined,password:edit.password||undefined})});
    const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo");toast("Usuario actualizado");setEdit(null);await cargar();
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  if(lista===null)return <p style={{color:GRIS}}>Cargando…</p>;
  return <div>
    <p style={{margin:"0 0 14px",fontSize:13.5,color:GRIS}}>Todos los que entran ven todo el panel. Para dar acceso a alguien nuevo se le asigna el rol desde el admin de Argencargo; acá se le cambia el mail o la contraseña.</p>
    {edit&&<Sec titulo={`Editar ${edit.emailOriginal}`} style={{borderColor:LIMA}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Campo label="Email"><Inp type="email" value={edit.email} onChange={e=>setEdit(x=>({...x,email:e.target.value}))}/></Campo>
        <Campo label="Contraseña nueva" hint="Dejala vacía para no cambiarla."><Inp type="text" value={edit.password} onChange={e=>setEdit(x=>({...x,password:e.target.value}))} placeholder="mínimo 8 caracteres"/></Campo>
      </div>
      <div style={{display:"flex",gap:8,marginTop:14}}><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn><Btn onClick={()=>setEdit(null)}>Cancelar</Btn></div>
    </Sec>}
    <div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
      <thead><tr>{["Usuario","Rol","Desde",""].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{lista.map(p=><tr key={p.id}><td style={{...TD,fontWeight:800}}>{p.email}{p.id===ses.user?.id&&<span style={{fontFamily:MONO,fontSize:10,color:GRIS,marginLeft:8}}>VOS</span>}</td><td style={TD}><span style={{fontFamily:MONO,fontSize:10.5,letterSpacing:"0.08em",padding:"3px 8px",borderRadius:6,background:p.role==="admin"?LIMA_SUAVE:SUAVE}}>{rol(p).toUpperCase()}</span></td><td style={{...TD,color:GRIS,fontFamily:MONO,fontSize:12.5}}>{fmtFecha(p.created_at)}</td><td style={{...TD,textAlign:"right"}}><Btn small onClick={()=>setEdit({id:p.id,email:p.email||"",emailOriginal:p.email||"",password:""})}>Editar</Btn></td></tr>)}</tbody>
    </table></div>
  </div>;
}
function GastoCats({dq,gastoCats,recargar}){
  const [nuevo,setNuevo]=useState("");
  const agregar=async()=>{if(!nuevo.trim())return;try{await dq("cat_gasto_categorias",{method:"POST",body:{nombre:nuevo.trim(),orden:(gastoCats?.length||0)+1}});setNuevo("");await recargar();toast("Categoría agregada");}catch(e){toast(e.message,"error");}};
  const borrar=async(c)=>{if(!(await confirmDialog(`¿Eliminar la categoría “${c.nombre}”?`)))return;try{await dq("cat_gasto_categorias",{method:"DELETE",filters:`?id=eq.${c.id}`,prefer:"return=minimal"});await recargar();}catch(e){toast(e.message,"error");}};
  return <div>
    <Sec titulo="Categorías de gastos">
      <div style={{display:"flex",gap:8,marginBottom:14}}><Inp value={nuevo} onChange={e=>setNuevo(e.target.value)} placeholder="Nueva categoría…" onKeyDown={e=>{if(e.key==="Enter")agregar();}}/><Btn kind="lima" onClick={agregar}>Agregar</Btn></div>
      <div style={{display:"grid",gap:4}}>{(gastoCats||[]).map(c=><div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:`1px solid ${BORDE}`,fontSize:14}}><span style={{flex:1,fontWeight:700}}>{c.nombre}</span><Btn small kind="danger" onClick={()=>borrar(c)}>✕</Btn></div>)}</div>
    </Sec>
  </div>;
}
