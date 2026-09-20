"use client";
// Inicio, Clientes (misma base que Argencargo), Usuarios y Ajustes del sistema.
import { useState, useEffect } from "react";
import { toast } from "../../../lib/ui";
import { INK,GRIS,BORDE,SUAVE,CARD,LIMA,LIMA_SUAVE,OK,OK_BG,WARN,WARN_BG,BAD,BAD_BG,MONO,INP,LBL,TH,TD,GRID,DOS,Campo,Inp,Btn,Sec,Pill,Barra,Vacio,Dato,Barras,n,txtONull,fmtUsd,fmtK,fmtFecha,codigoPed,codigoMaq,ChipPed,ESTADOS_PEDIDO,ACTIVOS,CATEG_MOV,MESES } from "./ui";
import { cobradoDe, pagadoFabricaDe } from "./Pedidos";
import { porMes } from "./Finanzas";

const SB_URL="https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";
const nombreCliente=(c)=>c?(c.company_name||`${c.first_name||""} ${c.last_name||""}`.trim()||c.email||"—"):"—";

// ── Inicio: lo que hay que hacer hoy, más el pulso del negocio ────────────────────────────
export function Inicio({ses,prods,pedidos,movs,ajustes,ir}){
  const hoy=new Date();
  const activos=pedidos.filter(p=>ACTIVOS.includes(p.estado));
  const porCobrar=activos.reduce((s,p)=>s+Math.max(0,n(p.precio_total)-cobradoDe(movs,p.id)),0);
  const mes=movs.filter(m=>{const d=new Date(m.fecha+"T12:00:00");return d.getMonth()===hoy.getMonth()&&d.getFullYear()===hoy.getFullYear();});
  const gananciaMes=mes.reduce((s,m)=>s+(m.tipo==="ingreso"?1:-1)*n(m.monto_usd),0);
  const caja=movs.reduce((s,m)=>s+(m.tipo==="ingreso"?1:-1)*n(m.monto_usd),0);
  const diasVer=n(ajustes?.prefs?.dias_verificar,30);

  // Pendientes concretos, cada uno con adónde ir.
  const tareas=[];
  activos.filter(p=>p.estado==="nuevo").forEach(p=>{const falta=n(p.precio_total)-cobradoDe(movs,p.id);if(falta>0.01)tareas.push({t:"cobrar",titulo:`Cobrar ${fmtUsd(falta)} a ${p.cliente_nombre}`,sub:`${codigoPed(p)} · nuevo, sin cobrar del todo`,k:"pedidos",x:p.id,c:WARN});else tareas.push({t:"avanzar",titulo:`Marcar como pagado: ${codigoPed(p)}`,sub:`${p.cliente_nombre} ya cubrió el precio`,k:"pedidos",x:p.id,c:OK});});
  activos.filter(p=>p.estado==="pagado").forEach(p=>{const falta=n(p.exw_total)-pagadoFabricaDe(movs,p.id);if(falta>0.01)tareas.push({t:"pagar",titulo:`Pagar ${fmtUsd(falta)} a la fábrica`,sub:`${codigoPed(p)} · ${(p.items||[]).map(i=>i.proveedor).filter(Boolean)[0]||p.cliente_nombre}`,k:"pedidos",x:p.id,c:BAD});else tareas.push({t:"avanzar",titulo:`Pasar a producción: ${codigoPed(p)}`,sub:"la fábrica ya cobró",k:"pedidos",x:p.id,c:OK});});
  activos.filter(p=>p.estado==="en_produccion"||p.estado==="prueba_fabrica").forEach(p=>{const dias=Math.max(0,...(p.items||[]).map(i=>n(i.dias_produccion)));const pagoAt=(p.historial||[]).find(h=>h.estado==="pagado")?.at||p.created_at;const listaEl=new Date(new Date(pagoAt).getTime()+dias*864e5);const rest=Math.ceil((listaEl-hoy)/864e5);if(dias>0&&rest<=0)tareas.push({t:"produccion",titulo:`Debería estar lista: ${codigoPed(p)}`,sub:`${p.cliente_nombre} · venció hace ${-rest} día${-rest===1?"":"s"}`,k:"pedidos",x:p.id,c:WARN});else if(dias>0&&rest<=5)tareas.push({t:"produccion",titulo:`Sale en ${rest} día${rest===1?"":"s"}: ${codigoPed(p)}`,sub:`${p.cliente_nombre} · avisale y coordiná con Argencargo`,k:"pedidos",x:p.id,c:GRIS});});
  activos.filter(p=>p.estado==="listo_fabrica"&&!p.operation_ref).forEach(p=>tareas.push({t:"op",titulo:`Abrir la operación en Argencargo: ${codigoPed(p)}`,sub:`${p.cliente_nombre} · la máquina está lista en fábrica`,k:"pedidos",x:p.id,c:WARN}));
  const viejas=prods.filter(p=>p.estado==="publicado"&&p.precio_verificado_at&&(hoy-new Date(p.precio_verificado_at))/864e5>diasVer);
  if(viejas.length)tareas.push({t:"exw",titulo:`${viejas.length} máquina${viejas.length>1?"s":""} con EXW sin verificar hace más de ${diasVer} días`,sub:viejas.slice(0,4).map(p=>codigoMaq(p)).join(", ")+(viejas.length>4?"…":""),k:"maquinas",c:GRIS});
  const borradores=prods.filter(p=>p.estado==="borrador");
  if(borradores.length)tareas.push({t:"borr",titulo:`${borradores.length} máquina${borradores.length>1?"s":""} en borrador`,sub:"sin publicar todavía",k:"maquinas",c:GRIS});

  const serie=porMes(pedidos.filter(p=>p.estado!=="cancelado"),p=>p.created_at,p=>n(p.precio_total)).slice(6);
  const top=Object.values((pedidos.filter(p=>p.estado!=="cancelado").flatMap(p=>p.items||[])).reduce((acc,i)=>{const k=i.producto_id||i.nombre;acc[k]=acc[k]||{nombre:i.nombre,codigo:i.codigo,q:0,usd:0};acc[k].q+=n(i.qty,1);acc[k].usd+=n(i.exw_unit)*n(i.qty,1);return acc;},{})).sort((a,b)=>b.q-a.q).slice(0,5);
  const porEstado=ESTADOS_PEDIDO.filter(e=>ACTIVOS.includes(e.k)).map(e=>({...e,c:pedidos.filter(p=>p.estado===e.k).length})).filter(e=>e.c>0);
  const saludo=hoy.getHours()<12?"Buen día":hoy.getHours()<20?"Buenas tardes":"Buenas noches";
  const nombre=(ses.user?.email||"").split("@")[0];

  return <>
    <div style={{display:"flex",alignItems:"end",gap:14,flexWrap:"wrap",marginBottom:20}}>
      <div style={{flex:1}}><p style={{...LBL,marginBottom:2}}>{hoy.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}</p><h1 style={{margin:0,fontSize:26,fontWeight:800,letterSpacing:"-0.03em"}}>{saludo}, {nombre}.</h1></div>
      <Btn kind="lima" onClick={()=>ir("pedidos")}>Pedidos</Btn><Btn onClick={()=>ir("maquinas")}>Máquinas</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,marginBottom:14}}>
      <Dato l="Pedidos activos" v={String(activos.length)} sub={porEstado.map(e=>`${e.c} ${e.l.toLowerCase()}`).join(" · ")||"ninguno"}/>
      <Dato l="Por cobrar" v={fmtUsd(porCobrar)} sub="de los pedidos activos" color={porCobrar>0?WARN:INK} acento={WARN}/>
      <Dato l={`Ganancia · ${MESES[hoy.getMonth()].toLowerCase()}`} v={fmtUsd(gananciaMes)} sub="ingresos − egresos" color={gananciaMes>=0?OK:BAD} acento={OK}/>
      <Dato l="En caja" v={fmtUsd(caja)} sub="acumulado" acento={GRIS}/>
    </div>
    <div className="dos" style={{...DOS,gridTemplateColumns:"1.3fr 1fr"}}>
      <Sec titulo="Para hacer" extra={<span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>{tareas.length} PENDIENTE{tareas.length===1?"":"S"}</span>}>
        {tareas.length===0?<p style={{margin:0,fontSize:13.5,color:GRIS}}>Nada pendiente. Todo al día.</p>
        :<div style={{display:"grid",gap:6}}>{tareas.map((t,i)=><button key={i} className="fila" onClick={()=>ir(t.k,t.x)} style={{display:"flex",gap:12,alignItems:"center",width:"100%",textAlign:"left",padding:"10px 12px",borderRadius:12,border:"none",background:"transparent",color:INK,cursor:"pointer"}}><span style={{width:8,height:8,borderRadius:"50%",background:t.c,flexShrink:0}}/><span style={{flex:1,minWidth:0}}><span style={{display:"block",fontSize:14,fontWeight:700}}>{t.titulo}</span><span style={{display:"block",fontSize:12.5,color:GRIS}}>{t.sub}</span></span><span style={{color:GRIS}}>→</span></button>)}</div>}
      </Sec>
      <div>
        <Sec titulo="Ventas · últimos 6 meses">
          {pedidos.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Todavía no hay pedidos.</p>:<Barras series={serie} alto={90} fmt={fmtUsd}/>}
        </Sec>
        <Sec titulo="Máquinas más pedidas">
          {top.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Todavía no hay pedidos.</p>
          :<div style={{display:"grid",gap:8}}>{top.map((t,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"center",fontSize:13.5}}><span style={{fontFamily:MONO,fontSize:11,color:GRIS,width:22}}>{i+1}.</span><span style={{flex:1,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.nombre}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>×{t.q}</span></div>)}</div>}
        </Sec>
      </div>
    </div>
    <Sec titulo="Últimos pedidos" extra={<Btn small onClick={()=>ir("pedidos")}>Ver todos</Btn>}>
      {pedidos.length===0?<p style={{margin:0,fontSize:13,color:GRIS}}>Todavía no hay pedidos.</p>
      :<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
        <thead><tr>{["Pedido","Cliente","Máquinas","Estado","Precio","Cobrado"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>{pedidos.slice(0,6).map(p=>{const cob=cobradoDe(movs,p.id);return <tr key={p.id} className="fila" onClick={()=>ir("pedidos",p.id)} style={{cursor:"pointer"}}><td style={{...TD,fontFamily:MONO}}>{codigoPed(p)}</td><td style={{...TD,fontWeight:800}}>{p.cliente_nombre}</td><td style={{...TD,color:GRIS,maxWidth:300}}><span style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(p.items||[]).map(i=>i.nombre).join(" · ")}</span></td><td style={TD}><ChipPed e={p.estado}/></td><td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap"}}>{fmtUsd(p.precio_total)}</td><td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap",color:cob>=n(p.precio_total)-0.01?OK:cob>0?WARN:GRIS}}>{fmtUsd(cob)}</td></tr>;})}</tbody>
      </table></div>}
    </Sec>
  </>;
}

// ── Clientes ──────────────────────────────────────────────────────────────────────────────
export function Clientes({dq,pedidos}){
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
    <Barra><input placeholder="Buscar cliente…" value={q} onChange={e=>{setQ(e.target.value);buscar(e.target.value);}} style={{...INP,flex:1,minWidth:200,borderRadius:999,padding:"10px 18px"}}/><span style={{fontFamily:MONO,fontSize:11,color:GRIS}}>MISMA BASE QUE ARGENCARGO</span></Barra>
    {cargando?<p style={{color:GRIS}}>Cargando…</p>:lista.length===0?<Vacio>Nada que coincida.</Vacio>
    :<div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
      <thead><tr>{["Código","Cliente","WhatsApp","Email","CUIT","Ubicación","Pedidos","Comprado"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{lista.map(c=><tr key={c.id}><td style={{...TD,fontFamily:MONO,fontSize:12.5,color:GRIS}}>{c.client_code||"—"}</td><td style={{...TD,fontWeight:800}}>{nombreCliente(c)}{c.company_name&&(c.first_name||c.last_name)&&<span style={{display:"block",fontWeight:500,color:GRIS,fontSize:12.5}}>{`${c.first_name||""} ${c.last_name||""}`.trim()}</span>}</td><td style={{...TD,whiteSpace:"nowrap"}}>{c.whatsapp?<a href={`https://wa.me/${String(c.whatsapp).replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{color:INK,fontWeight:700}}>{c.whatsapp}</a>:"—"}</td><td style={{...TD,color:GRIS}}>{c.email||"—"}</td><td style={{...TD,fontFamily:MONO,fontSize:12.5}}>{c.cuit||"—"}</td><td style={{...TD,color:GRIS}}>{[c.city,c.province].filter(Boolean).join(", ")||"—"}</td><td style={{...TD,fontFamily:MONO}}>{cuenta(c.id)}</td><td style={{...TD,fontFamily:MONO,whiteSpace:"nowrap"}}>{total(c.id)?fmtUsd(total(c.id)):"—"}</td></tr>)}</tbody>
    </table></div></div>}
  </>;
}

// ── Usuarios: quién entra al panel. Los roles se asignan desde el admin de Argencargo. ────
export function Usuarios({dq,ses}){
  const [lista,setLista]=useState(null);
  useEffect(()=>{(async()=>{try{const r=await dq("profiles",{filters:"?select=id,email,role,is_gi_partner,created_at&or=(role.eq.admin,role.eq.empleado,is_gi_partner.eq.true)&order=created_at.asc"});setLista(Array.isArray(r)?r:[]);}catch(e){toast(e.message,"error");setLista([]);}})();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  const rol=(p)=>p.role==="admin"?"Admin":p.role==="empleado"?"Empleado":p.is_gi_partner?"Socio GI":p.role;
  if(lista===null)return <p style={{color:GRIS}}>Cargando…</p>;
  return <>
    <Barra><span style={{fontSize:13.5,color:GRIS}}>Todos los que entran ven todo el panel. Para dar acceso a alguien nuevo, se le asigna el rol desde el admin de Argencargo.</span></Barra>
    <div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
      <thead><tr>{["Usuario","Rol","Desde",""].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{lista.map(p=><tr key={p.id}><td style={{...TD,fontWeight:800}}>{p.email}</td><td style={TD}><span style={{fontFamily:MONO,fontSize:10.5,letterSpacing:"0.08em",padding:"3px 8px",borderRadius:6,background:p.role==="admin"?LIMA_SUAVE:SUAVE}}>{rol(p).toUpperCase()}</span></td><td style={{...TD,color:GRIS,fontFamily:MONO,fontSize:12.5}}>{fmtFecha(p.created_at)}</td><td style={{...TD,textAlign:"right",fontSize:12,color:GRIS}}>{p.id===ses.user?.id?"vos":""}</td></tr>)}</tbody>
    </table></div>
  </>;
}

// ── Ajustes del sistema ───────────────────────────────────────────────────────────────────
export function Ajustes({ses,dq,ajustes,setAjustes,tema,setTema}){
  const [neg,setNeg]=useState({...(ajustes.negocio||{})});
  const [prefs,setPrefs]=useState({...(ajustes.prefs||{})});
  const [notif,setNotif]=useState({...(ajustes.notif||{})});
  const [enviando,setEnviando]=useState(false);
  const [guardando,setGuardando]=useState(false);
  const guardar=async()=>{setGuardando(true);try{
    const filas=[{clave:"negocio",valor:neg},{clave:"prefs",valor:{...prefs,dias_verificar:n(prefs.dias_verificar,30)}},{clave:"notif",valor:notif}];
    await dq("cat_ajustes",{method:"POST",prefer:"resolution=merge-duplicates,return=representation",body:filas.map(f=>({...f,updated_at:new Date().toISOString()}))});
    setAjustes(x=>({...x,...Object.fromEntries(filas.map(f=>[f.clave,f.valor]))}));toast("Ajustes guardados");
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const resetear=async()=>{setEnviando(true);try{const r=await fetch(`${SB_URL}/auth/v1/recover`,{method:"POST",headers:{apikey:SB_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:ses.user?.email})});if(!r.ok)throw new Error("No se pudo enviar el mail");toast(`Mail enviado a ${ses.user?.email}`);}catch(e){toast(e.message,"error");}setEnviando(false);};
  const Tog=({k,l,sub})=><button type="button" onClick={()=>setNotif(x=>({...x,[k]:!x[k]}))} style={{display:"flex",alignItems:"center",gap:12,width:"100%",textAlign:"left",padding:"10px 0",border:"none",borderTop:`1px solid ${BORDE}`,background:"transparent",color:INK,cursor:"pointer"}}><span style={{width:38,height:22,borderRadius:11,background:notif[k]?LIMA:BORDE,position:"relative",flexShrink:0,transition:"background 120ms"}}><span style={{position:"absolute",top:3,left:notif[k]?19:3,width:16,height:16,borderRadius:"50%",background:CARD,transition:"left 120ms",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/></span><span><span style={{display:"block",fontSize:14,fontWeight:700}}>{l}</span>{sub&&<span style={{display:"block",fontSize:12.5,color:GRIS}}>{sub}</span>}</span></button>;
  return <>
    <Barra><span style={{flex:1}}/><Btn kind="lima" onClick={guardar} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn></Barra>
    <div className="dos" style={DOS}>
      <div>
        <Sec titulo="Negocio">
          <div style={{display:"grid",gap:14}}>
            <Campo label="Nombre"><Inp value={neg.nombre||""} onChange={e=>setNeg(x=>({...x,nombre:e.target.value}))}/></Campo>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Campo label="Razón social"><Inp value={neg.razon_social||""} onChange={e=>setNeg(x=>({...x,razon_social:e.target.value}))}/></Campo><Campo label="CUIT"><Inp value={neg.cuit||""} onChange={e=>setNeg(x=>({...x,cuit:e.target.value}))}/></Campo></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Campo label="WhatsApp"><Inp value={neg.whatsapp||""} onChange={e=>setNeg(x=>({...x,whatsapp:e.target.value}))}/></Campo><Campo label="Email"><Inp value={neg.email||""} onChange={e=>setNeg(x=>({...x,email:e.target.value}))}/></Campo></div>
            <Campo label="Dirección"><Inp value={neg.direccion||""} onChange={e=>setNeg(x=>({...x,direccion:e.target.value}))}/></Campo>
          </div>
        </Sec>
        <Sec titulo="Preferencias">
          <div style={{display:"grid",gap:14}}>
            <Campo label="Días para marcar un EXW como “por verificar”"><Inp type="number" value={prefs.dias_verificar??30} onChange={e=>setPrefs(x=>({...x,dias_verificar:e.target.value}))}/></Campo>
            <Campo label="Fotos mínimas para publicar"><p style={{margin:0,fontWeight:700}}>5</p></Campo>
          </div>
        </Sec>
      </div>
      <div>
        <Sec titulo="Apariencia">
          <div style={{display:"flex",gap:8}}><Pill on={tema==="claro"} onClick={()=>setTema("claro")}>Claro</Pill><Pill on={tema==="oscuro"} onClick={()=>setTema("oscuro")}>Oscuro</Pill></div>
        </Sec>
        <Sec titulo="Avisos">
          <p style={{margin:"0 0 6px",fontSize:12.5,color:GRIS}}>Qué avisar por Telegram. La conexión con el bot se hace después; acá queda definido qué se avisa.</p>
          <Tog k="pedido_nuevo" l="Pedido nuevo" sub="cuando un cliente arma un pedido"/>
          <Tog k="cobro" l="Cobro registrado" sub="cada vez que entra plata de un pedido"/>
          <Tog k="produccion_vencida" l="Producción vencida" sub="cuando una máquina debería estar lista y el pedido sigue en producción"/>
          <Tog k="precio_vencido" l="EXW por verificar" sub="máquinas publicadas con el precio viejo"/>
        </Sec>
        <Sec titulo="Cuenta">
          <div style={{display:"grid",gap:14}}>
            <Campo label="Email"><p style={{margin:0,fontWeight:700}}>{ses.user?.email}</p></Campo>
            <Campo label="Rol"><p style={{margin:0,fontWeight:700}}>{ses.rol==="gi"?"Socio GI":ses.rol==="admin"?"Admin":"Empleado"}</p></Campo>
            <Campo label="Contraseña"><Btn small onClick={resetear} disabled={enviando}>{enviando?"Enviando…":"Enviar mail para restablecer"}</Btn></Campo>
          </div>
        </Sec>
      </div>
    </div>
  </>;
}
