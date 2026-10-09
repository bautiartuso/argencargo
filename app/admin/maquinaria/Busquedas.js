"use client";
// Comercial › A pedido: máquinas que alguien pide y no están en el catálogo. Se carga el cliente,
// cómo contactarlo y qué busca; después se sigue cómo viene la búsqueda, el proveedor con el que
// se está hablando y un historial de notas.
import { useState, useEffect } from "react";
import { INK,GRIS,BORDE,SUAVE,CARD,LIMA,LIMA_SUAVE,OK,OK_BG,WARN,WARN_BG,BAD,BAD_BG,MONO,INP,LBL,TH,TD,Campo,Inp,TA,Btn,Sec,Pill,Chip,Barra,Vacio,Desplegable,txtONull,fmtFecha,toast,confirmDialog } from "./ui";

// Cómo viene la búsqueda: lo marca quien la lleva adelante.
export const AVANCES=[
  {k:"pendiente",l:"Pendiente de búsqueda",c:BAD,bg:BAD_BG,d:"Todavía no la buscamos"},
  {k:"averiguando",l:"Averiguando",c:WARN,bg:WARN_BG,d:"Consultando fábricas y proveedores"},
  {k:"cotizado",l:"Cotizado",c:OK,bg:OK_BG,d:"El cliente ya tiene nuestro precio"},
];
const avanceDe=(k)=>AVANCES.find(e=>e.k===k)||AVANCES[0];
const ChipAv=({a})=>{const x=avanceDe(a);return <Chip l={x.l} c={x.c} bg={x.bg}/>;};
// Situación del cliente: quiere que nos ocupemos de todo, o ya tiene un proveedor en vista.
export const SITUACIONES=[
  {k:"gestion_integral",l:"Gestión integral",c:INK,bg:SUAVE,d:"Quiere que nos ocupemos de todo",tip:"Buscá la máquina en fábricas y ofrecé el precio final puesto en CABA, en dos cuotas y con fecha estimada de llegada. Nadie le mostró nada todavía."},
  {k:"ya_busco_proveedor",l:"Ya buscó un proveedor",c:"#15171A",bg:LIMA,d:"Ya tiene una publicación o un proveedor en vista",tip:"Pedile el link o el nombre del proveedor y qué precio le pasaron. Cotizá esa misma máquina con el precio final puesto y la importación pagada al recibir: le sacás el riesgo de girar a China a ciegas."},
];
const situacionDe=(k)=>SITUACIONES.find(e=>e.k===k)||SITUACIONES[0];
const ChipSit=({s})=>{const x=situacionDe(s);return <Chip l={x.l} c={x.c} bg={x.bg}/>;};
// Estado del pedido (queda como control general; se revisa más adelante).
export const ESTADOS_BUSQ=[
  {k:"nueva",l:"Nueva",c:"#15171A",bg:LIMA},
  {k:"esperando",l:"Esperando",c:INK,bg:SUAVE},   // esperamos algo del cliente antes de buscar
  {k:"buscando",l:"Buscando",c:WARN,bg:WARN_BG},
  {k:"cotizada",l:"Cotizada",c:INK,bg:SUAVE},
  {k:"ganada",l:"Ganada",c:OK,bg:OK_BG},
  {k:"perdida",l:"Perdida",c:BAD,bg:BAD_BG},
];
const estadoDe=(k)=>ESTADOS_BUSQ.find(e=>e.k===k)||ESTADOS_BUSQ[0];
const ChipEst=({e})=>{const s=estadoDe(e);return <Chip l={s.l} c={s.c} bg={s.bg}/>;};
// Agrupación de la lista: nuevas → esperando → en curso → cotizadas → finalizadas
const GRUPOS=[
  {k:"nuevas",l:"Nuevas",f:(b)=>b.estado==="nueva"},
  {k:"esperando",l:"Esperando",f:(b)=>b.estado==="esperando"},
  {k:"curso",l:"En curso",f:(b)=>b.estado==="buscando"},
  {k:"cotizadas",l:"Cotizadas",f:(b)=>b.estado==="cotizada"},   // enviamos la cotización y esperamos respuesta
  {k:"fin",l:"Finalizadas",f:(b)=>["ganada","perdida"].includes(b.estado)},
  {k:"todas",l:"Todas",f:()=>true},
];
export const codigoBusq=(b)=>`BQ-${String(b.numero||0).padStart(5,"0")}`;
// Los pedidos que llegan del formulario público de repuestos traen una primera línea "[Repuesto] · Email: … · Zona: …".
const esRepuesto=(b)=>String(b?.descripcion||"").startsWith("[Repuesto]");
const datosRepuesto=(b)=>{const [cab,...resto]=String(b?.descripcion||"").split("\n");const m=(k)=>(cab.match(new RegExp(k+": ([^·]+)"))||[])[1]?.trim()||"";return {email:m("Email"),zona:m("Zona"),texto:resto.join("\n").trim()};};
const textoDe=(b)=>esRepuesto(b)?datosRepuesto(b).texto:b.descripcion;
const ChipRep=()=><Chip l="Repuesto" c="#15171A" bg={LIMA}/>;
const wa=(t)=>{const d=String(t||"").replace(/\D/g,"");return d.length>=8?`https://wa.me/${d.startsWith("54")||d.length>10?d:"54"+d}`:null;};
const fmtHora=(d)=>d?new Date(d).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}):"—";
const VACIO={cliente:"",contacto:"",descripcion:"",situacion:"gestion_integral",proveedores:"",precio_referencia:""};

export function Busquedas({ses,dq,setNBusq}){
  const [lista,setLista]=useState([]);const [cargando,setCargando]=useState(true);
  const [q,setQ]=useState("");const [grupo,setGrupo]=useState("nuevas");const [fSit,setFSit]=useState("");
  const [nuevo,setNuevo]=useState(null);const [sel,setSel]=useState(null);const [guardando,setGuardando]=useState(false);
  const cargar=async()=>{setCargando(true);try{const r=await dq("cat_busquedas",{filters:"?select=*&order=created_at.desc"});setLista(Array.isArray(r)?r:[]);}catch(e){toast(e.message,"error");}setCargando(false);};
  useEffect(()=>{cargar();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  // El contador del menú sigue a la lista: al cargar una nueva o cambiar un estado se actualiza solo.
  useEffect(()=>{if(!cargando&&setNBusq)setNBusq(lista.filter(b=>b.estado==="nueva").length);},[lista,cargando]); // eslint-disable-line react-hooks/exhaustive-deps

  const crear=async()=>{if(!nuevo.cliente.trim()||!nuevo.descripcion.trim()){toast("Falta el cliente o qué busca","warn");return;}setGuardando(true);try{
    const body={cliente:nuevo.cliente.trim(),contacto:txtONull(nuevo.contacto),descripcion:nuevo.descripcion.trim(),situacion:nuevo.situacion||"gestion_integral",proveedores:nuevo.situacion==="ya_busco_proveedor"?txtONull(nuevo.proveedores):null,precio_referencia:nuevo.situacion==="ya_busco_proveedor"?txtONull(nuevo.precio_referencia):null,creado_por:ses?.user?.id||null};
    const r=await dq("cat_busquedas",{method:"POST",body});const b=Array.isArray(r)?r[0]:null;
    if(b)setLista(l=>[b,...l]);setNuevo(null);setGrupo("nuevas");toast("Búsqueda cargada");
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const guardar=async(id,patch)=>{try{const r=await dq("cat_busquedas",{method:"PATCH",filters:`?id=eq.${id}`,body:patch});const b=Array.isArray(r)?r[0]:null;setLista(l=>l.map(x=>x.id===id?{...x,...(b||patch)}:x));return true;}catch(e){toast(e.message,"error");return false;}};
  const borrar=async(b)=>{if(!(await confirmDialog(`¿Eliminar la búsqueda ${codigoBusq(b)} de ${b.cliente}?`,{ok:"Eliminar"})))return;try{await dq("cat_busquedas",{method:"DELETE",filters:`?id=eq.${b.id}`,prefer:"return=minimal"});setLista(l=>l.filter(x=>x.id!==b.id));setSel(null);toast("Búsqueda eliminada");}catch(e){toast(e.message,"error");}};

  const s=q.trim().toLowerCase();
  const g=GRUPOS.find(x=>x.k===grupo)||GRUPOS[0];
  const visibles=lista.filter(g.f).filter(b=>!fSit||(b.situacion||"gestion_integral")===fSit)
    .filter(b=>!s||[b.cliente,b.contacto,b.descripcion,b.proveedores,b.proveedor_nombre,codigoBusq(b)].some(v=>String(v||"").toLowerCase().includes(s)));
  const b=sel?lista.find(x=>x.id===sel):null;
  if(b)return <Detalle b={b} ses={ses} dq={dq} onVolver={()=>setSel(null)} guardar={guardar} borrar={borrar}/>;

  return <>
    <Barra>
      <input placeholder="Buscar por cliente, contacto, máquina o proveedor…" value={q} onChange={e=>setQ(e.target.value)} style={{...INP,flex:1,minWidth:220,borderRadius:999,padding:"10px 18px"}}/>
      <Desplegable value={fSit} onChange={v=>setFSit(v||"")} opciones={[{v:"",l:"Todas las situaciones"},...SITUACIONES.map(x=>({v:x.k,l:x.l}))]} buscar={false} style={{width:230}}/>
      <Btn kind="lima" onClick={()=>setNuevo(nuevo?null:{...VACIO})}>{nuevo?"Cerrar":"+ Nueva búsqueda"}</Btn>
    </Barra>
    {nuevo&&<Sec titulo="Nueva búsqueda a pedido" style={{marginBottom:18}}>
      <div style={{display:"grid",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:10}}>
          <Campo label="Cliente" ob><Inp autoFocus value={nuevo.cliente} onChange={e=>setNuevo(x=>({...x,cliente:e.target.value}))} placeholder="Nombre o empresa"/></Campo>
          <Campo label="Teléfono / WhatsApp"><Inp value={nuevo.contacto} onChange={e=>setNuevo(x=>({...x,contacto:e.target.value}))} placeholder="11 2345 6789"/></Campo>
        </div>
        <Campo label="Qué busca" ob hint="Tipo de máquina, capacidad, uso, presupuesto: todo lo que dijo."><TA value={nuevo.descripcion} onChange={e=>setNuevo(x=>({...x,descripcion:e.target.value}))} placeholder="Ej.: amasadora de 50 kg para panadería, quiere una usada o nueva…"/></Campo>
        <Campo label="Situación del cliente" hint={situacionDe(nuevo.situacion).d}><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{SITUACIONES.map(x=><Pill key={x.k} on={nuevo.situacion===x.k} onClick={()=>setNuevo(n=>({...n,situacion:x.k}))}>{x.l}</Pill>)}</div></Campo>
        {nuevo.situacion==="ya_busco_proveedor"&&<div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:10}}>
          <Campo label="Proveedor que encontró" hint="Link de la publicación, nombre del vendedor, país."><TA value={nuevo.proveedores} onChange={e=>setNuevo(x=>({...x,proveedores:e.target.value}))} placeholder="Ej.: https://www.alibaba.com/product-detail/… o “un importador de Rosario”" style={{minHeight:70}}/></Campo>
          <Campo label="Precio que le pasaron" hint="Si lo dijo, con moneda."><Inp value={nuevo.precio_referencia} onChange={e=>setNuevo(x=>({...x,precio_referencia:e.target.value}))} placeholder="Ej.: USD 4.200 puesta"/></Campo>
        </div>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn onClick={()=>setNuevo(null)}>Cancelar</Btn><Btn kind="lima" onClick={crear} disabled={guardando}>{guardando?"Guardando…":"Guardar búsqueda"}</Btn></div>
      </div>
    </Sec>}
    <div style={{display:"flex",gap:4,borderBottom:`1px solid ${BORDE}`,marginBottom:16,overflowX:"auto"}}>
      {GRUPOS.map(x=>{const on=grupo===x.k;const n=lista.filter(x.f).length;return <button key={x.k} type="button" onClick={()=>setGrupo(x.k)} style={{padding:"10px 14px",border:"none",borderBottom:`2px solid ${on?LIMA:"transparent"}`,marginBottom:-1,background:"transparent",color:on?INK:GRIS,fontSize:13.5,fontWeight:on?800:600,cursor:"pointer",whiteSpace:"nowrap",display:"inline-flex",gap:8,alignItems:"center"}}>{x.l}<span style={{fontFamily:MONO,fontSize:10.5,fontWeight:600,padding:"2px 7px",borderRadius:999,background:on?LIMA_SUAVE:SUAVE,color:on?INK:GRIS}}>{n}</span></button>;})}
    </div>
    {cargando?<p style={{color:GRIS}}>Cargando…</p>
    :visibles.length===0?<Vacio>{lista.length===0?"Todavía no hay búsquedas a pedido. Cargá la primera con “+ Nueva búsqueda”.":"Nada en este grupo."}</Vacio>
    :<div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
      <thead><tr>{["Código","Cliente","Contacto","Qué busca","Situación","Búsqueda","Estado"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{visibles.map(x=><tr key={x.id} className="fila" onClick={()=>setSel(x.id)} style={{cursor:"pointer"}}>
        <td style={{...TD,whiteSpace:"nowrap"}}><span style={{fontFamily:MONO,fontSize:12.5,color:GRIS}}>{codigoBusq(x)}</span><span style={{display:"block",fontSize:11.5,color:GRIS,marginTop:2}}>{fmtFecha(x.created_at)}</span></td>
        <td style={{...TD,fontWeight:800}}>{x.cliente}{esRepuesto(x)&&<span style={{display:"block",marginTop:4}}><ChipRep/></span>}</td>
        <td style={{...TD,fontFamily:MONO,fontSize:12.5,whiteSpace:"nowrap"}}>{x.contacto||"—"}</td>
        <td style={{...TD,maxWidth:380}}><span style={{display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",lineHeight:1.4}}>{textoDe(x)}</span></td>
        <td style={TD}><ChipSit s={x.situacion}/></td>
        <td style={TD}><ChipAv a={x.avance}/></td>
        <td style={TD}><ChipEst e={x.estado}/></td>
      </tr>)}</tbody>
    </table></div></div>}
  </>;
}

function Detalle({b,ses,dq,onVolver,guardar,borrar}){
  const [edit,setEdit]=useState(null);const [prov,setProv]=useState(null);const [guardando,setGuardando]=useState(false);
  const [notas,setNotas]=useState([]);const [nota,setNota]=useState("");const [cargandoN,setCargandoN]=useState(true);
  const cargarNotas=async()=>{setCargandoN(true);try{const r=await dq("cat_busquedas_notas",{filters:`?busqueda_id=eq.${b.id}&select=*&order=created_at.desc`});setNotas(Array.isArray(r)?r:[]);}catch(e){toast(e.message,"error");}setCargandoN(false);};
  useEffect(()=>{cargarNotas();},[b.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const link=wa(b.contacto);
  const av=avanceDe(b.avance);
  const guardarDatos=async()=>{setGuardando(true);const ok=await guardar(b.id,{cliente:edit.cliente.trim(),contacto:txtONull(edit.contacto),descripcion:edit.descripcion.trim(),proveedores:txtONull(edit.proveedores),precio_referencia:txtONull(edit.precio_referencia)});if(ok){setEdit(null);toast("Datos guardados");}setGuardando(false);};
  const guardarProv=async()=>{setGuardando(true);const ok=await guardar(b.id,{proveedor_nombre:txtONull(prov.proveedor_nombre),proveedor_link:txtONull(prov.proveedor_link),proveedor_info:txtONull(prov.proveedor_info)});if(ok){setProv(null);toast("Proveedor guardado");}setGuardando(false);};
  const agregarNota=async()=>{if(!nota.trim())return;setGuardando(true);try{
    const r=await dq("cat_busquedas_notas",{method:"POST",body:{busqueda_id:b.id,texto:nota.trim(),autor:ses?.user?.id||null,autor_email:ses?.user?.email||null}});const x=Array.isArray(r)?r[0]:null;
    if(x)setNotas(l=>[x,...l]);setNota("");await guardar(b.id,{updated_at:new Date().toISOString()});
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const borrarNota=async(x)=>{if(!(await confirmDialog("¿Borrar esta nota?",{ok:"Borrar"})))return;try{await dq("cat_busquedas_notas",{method:"DELETE",filters:`?id=eq.${x.id}`,prefer:"return=minimal"});setNotas(l=>l.filter(y=>y.id!==x.id));}catch(e){toast(e.message,"error");}};
  const quien=(x)=>x.autor_email?x.autor_email.split("@")[0]:"equipo";
  const esUrl=(t)=>/^https?:\/\//i.test(String(t||"").trim());
  return <>
    {/* Cabecera: quién, código, cuándo, y el contacto a mano */}
    <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap",margin:"0 0 18px"}}>
      <Btn small onClick={onVolver}>← A pedido</Btn>
      <div style={{flex:1,minWidth:240}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><span style={{fontWeight:800,fontSize:22,letterSpacing:"-0.02em"}}>{b.cliente}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{codigoBusq(b)}</span>{esRepuesto(b)&&<ChipRep/>}<ChipSit s={b.situacion}/><ChipEst e={b.estado}/></div>
        <p style={{margin:"4px 0 0",fontFamily:MONO,fontSize:11.5,color:GRIS,letterSpacing:"0.02em"}}>Cargada {fmtFecha(b.created_at)} · Última novedad {fmtFecha(b.updated_at)}</p>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {b.contacto&&<span style={{fontFamily:MONO,fontSize:15,fontWeight:700}}>{b.contacto}</span>}
        {link&&<a href={link} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn small kind="lima">WhatsApp</Btn></a>}
        <Btn small kind="danger" onClick={()=>borrar(b)}>Eliminar</Btn>
      </div>
    </div>

    {/* Cómo viene la búsqueda: el semáforo de quien la lleva */}
    <Sec titulo="Cómo viene la búsqueda" style={{marginBottom:14,borderLeft:`4px solid ${av.c}`}} extra={<ChipAv a={b.avance}/>}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{AVANCES.map(x=>{const on=(b.avance||"pendiente")===x.k;return <button key={x.k} type="button" onClick={async()=>{if(!on&&await guardar(b.id,{avance:x.k}))toast(x.l);}} style={{padding:"9px 14px",borderRadius:999,border:`1.5px solid ${on?x.c:BORDE}`,background:on?x.bg:CARD,color:on?x.c:GRIS,fontSize:13,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}><span style={{width:8,height:8,borderRadius:"50%",background:x.c,opacity:on?1:0.5}}/>{x.l}</button>;})}</div>
      <p style={{margin:"10px 0 0",fontSize:12.5,color:GRIS}}>{av.d}.</p>
    </Sec>

    <div className="dos" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      {/* Pedido: datos del cliente y qué busca */}
      <Sec titulo="Pedido" extra={edit?<div style={{display:"flex",gap:8}}><Btn small kind="lima" onClick={guardarDatos} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn><Btn small onClick={()=>setEdit(null)}>Cancelar</Btn></div>:<Btn small onClick={()=>setEdit({cliente:b.cliente||"",contacto:b.contacto||"",descripcion:b.descripcion||"",proveedores:b.proveedores||"",precio_referencia:b.precio_referencia||""})}>Editar</Btn>}>
        {edit?<div style={{display:"grid",gap:10}}>
          <Campo label="Cliente" ob><Inp value={edit.cliente} onChange={e=>setEdit(x=>({...x,cliente:e.target.value}))}/></Campo>
          <Campo label="Teléfono / WhatsApp"><Inp value={edit.contacto} onChange={e=>setEdit(x=>({...x,contacto:e.target.value}))}/></Campo>
          <Campo label="Qué busca" ob><TA value={edit.descripcion} onChange={e=>setEdit(x=>({...x,descripcion:e.target.value}))}/></Campo>
          {b.situacion==="ya_busco_proveedor"&&<><Campo label="Proveedor que encontró"><TA value={edit.proveedores} onChange={e=>setEdit(x=>({...x,proveedores:e.target.value}))} style={{minHeight:70}}/></Campo><Campo label="Precio que le pasaron"><Inp value={edit.precio_referencia} onChange={e=>setEdit(x=>({...x,precio_referencia:e.target.value}))}/></Campo></>}
        </div>
        :<div style={{display:"grid",gap:12,fontSize:14}}>
          <div><p style={{...LBL,marginBottom:2}}>Cliente</p><b style={{fontSize:15}}>{b.cliente}</b></div>
          <div><p style={{...LBL,marginBottom:2}}>Teléfono / WhatsApp</p>{b.contacto?<a href={link||undefined} target="_blank" rel="noreferrer" style={{fontFamily:MONO,fontSize:15,fontWeight:700,color:INK,textDecoration:"none"}}>{b.contacto}</a>:<span>—</span>}</div>
          {esRepuesto(b)&&(datosRepuesto(b).email||datosRepuesto(b).zona)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><p style={{...LBL,marginBottom:2}}>Email</p><span>{datosRepuesto(b).email||"—"}</span></div><div><p style={{...LBL,marginBottom:2}}>Zona</p><span>{datosRepuesto(b).zona||"—"}</span></div></div>}
          <div><p style={{...LBL,marginBottom:2}}>{esRepuesto(b)?"Qué repuesto busca":"Qué busca"}</p><p style={{margin:0,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{textoDe(b)}</p></div>
          <div style={{borderTop:`1px solid ${BORDE}`,paddingTop:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}><p style={{...LBL,marginBottom:0}}>Situación</p>{SITUACIONES.map(x=><Pill key={x.k} small on={(b.situacion||"gestion_integral")===x.k} onClick={async()=>{if(b.situacion!==x.k&&await guardar(b.id,{situacion:x.k}))toast(x.l);}}>{x.l}</Pill>)}</div>
            {b.situacion==="ya_busco_proveedor"&&<div style={{display:"grid",gap:8,marginBottom:10}}>
              <div><p style={{...LBL,marginBottom:2}}>Proveedor que encontró</p>{esUrl(b.proveedores)?<a href={b.proveedores.trim()} target="_blank" rel="noreferrer" style={{color:INK,wordBreak:"break-all"}}>{b.proveedores.trim()}</a>:<p style={{margin:0,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{b.proveedores||"—"}</p>}</div>
              <div><p style={{...LBL,marginBottom:2}}>Precio que le pasaron</p><b style={{fontFamily:MONO}}>{b.precio_referencia||"—"}</b></div>
            </div>}
            <div style={{background:LIMA_SUAVE,borderLeft:`3px solid ${LIMA}`,borderRadius:12,padding:"10px 14px",fontSize:13,lineHeight:1.5}}><b style={{display:"block",fontFamily:MONO,fontSize:10.5,letterSpacing:"0.08em",textTransform:"uppercase",color:GRIS,marginBottom:3}}>Cómo encararlo</b>{situacionDe(b.situacion).tip}</div>
          </div>
        </div>}
      </Sec>

      {/* Proveedor con el que estamos hablando */}
      <Sec titulo="Proveedor" extra={prov?<div style={{display:"flex",gap:8}}><Btn small kind="lima" onClick={guardarProv} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn><Btn small onClick={()=>setProv(null)}>Cancelar</Btn></div>:<Btn small onClick={()=>setProv({proveedor_nombre:b.proveedor_nombre||"",proveedor_link:b.proveedor_link||"",proveedor_info:b.proveedor_info||""})}>{b.proveedor_nombre||b.proveedor_link||b.proveedor_info?"Editar":"Cargar"}</Btn>}>
        {prov?<div style={{display:"grid",gap:10}}>
          <Campo label="Fábrica o vendedor"><Inp value={prov.proveedor_nombre} onChange={e=>setProv(x=>({...x,proveedor_nombre:e.target.value}))} placeholder="Ej.: Guangzhou Tianhe Machinery"/></Campo>
          <Campo label="Publicación" hint="Link de Alibaba, 1688, Made-in-China o donde esté."><Inp value={prov.proveedor_link} onChange={e=>setProv(x=>({...x,proveedor_link:e.target.value}))} placeholder="https://www.alibaba.com/product-detail/…"/></Campo>
          <Campo label="Datos" hint="Precio EXW/FOB, MOQ, tiempos, contacto, lo que haga falta tener a mano."><TA value={prov.proveedor_info} onChange={e=>setProv(x=>({...x,proveedor_info:e.target.value}))} style={{minHeight:110}}/></Campo>
        </div>
        :(!b.proveedor_nombre&&!b.proveedor_link&&!b.proveedor_info)?<p style={{margin:0,fontSize:13.5,color:GRIS,lineHeight:1.5}}>Todavía no hay proveedor cargado. Cuando empieces a hablar con una fábrica, guardá acá el nombre, la publicación y los datos.</p>
        :<div style={{display:"grid",gap:12,fontSize:14}}>
          <div><p style={{...LBL,marginBottom:2}}>Fábrica o vendedor</p><b style={{fontSize:15}}>{b.proveedor_nombre||"—"}</b></div>
          <div><p style={{...LBL,marginBottom:2}}>Publicación</p>{b.proveedor_link?<a href={esUrl(b.proveedor_link)?b.proveedor_link.trim():`https://${b.proveedor_link.trim()}`} target="_blank" rel="noreferrer" style={{color:INK,wordBreak:"break-all",fontSize:13.5}}>{b.proveedor_link.trim()} ↗</a>:<span>—</span>}</div>
          <div><p style={{...LBL,marginBottom:2}}>Datos</p><p style={{margin:0,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{b.proveedor_info||"—"}</p></div>
        </div>}
      </Sec>
    </div>

    {/* Historial de notas: una entrada por vez, con quién y cuándo */}
    <Sec titulo="Seguimiento" style={{marginTop:0}}>
      <div style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:notas.length?16:0}}>
        <TA value={nota} onChange={e=>setNota(e.target.value)} placeholder="Qué pasó hoy: fábrica consultada, precio que llegó, qué dijo el cliente…" style={{minHeight:64,flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))agregarNota();}}/>
        <Btn kind="lima" onClick={agregarNota} disabled={guardando||!nota.trim()} style={{whiteSpace:"nowrap",alignSelf:"stretch"}}>Agregar nota</Btn>
      </div>
      {cargandoN?<p style={{margin:0,color:GRIS,fontSize:13}}>Cargando…</p>
      :notas.length===0?null
      :<div style={{display:"grid",gap:0}}>{notas.map((x,i)=><div key={x.id} style={{display:"grid",gridTemplateColumns:"150px 1fr auto",gap:14,padding:"12px 0",borderTop:i===0?`1px solid ${BORDE}`:`1px solid ${BORDE}`,alignItems:"start"}}>
        <div><span style={{fontFamily:MONO,fontSize:11.5,color:GRIS,display:"block"}}>{fmtHora(x.created_at)}</span><span style={{fontSize:12,fontWeight:700,color:GRIS}}>{quien(x)}</span></div>
        <p style={{margin:0,fontSize:14,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{x.texto}</p>
        <button type="button" onClick={()=>borrarNota(x)} title="Borrar nota" style={{border:"none",background:"transparent",color:GRIS,cursor:"pointer",fontSize:14,padding:"0 4px"}}>✕</button>
      </div>)}</div>}
    </Sec>

    {/* Estado general del pedido: queda como control, se revisa más adelante */}
    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"14px 18px",border:`1px dashed ${BORDE}`,borderRadius:14,marginTop:14}}>
      <span style={{...LBL,marginBottom:0}}>Estado del pedido</span>
      {ESTADOS_BUSQ.map(e=><Pill key={e.k} small on={b.estado===e.k} onClick={async()=>{if(b.estado!==e.k&&await guardar(b.id,{estado:e.k}))toast(`Pasó a ${e.l.toLowerCase()}`);}}>{e.l}</Pill>)}
      <span style={{fontSize:12,color:GRIS,marginLeft:"auto"}}>Nueva → esperando (algo del cliente) → en curso (buscando) → cotizada (esperando respuesta) → finalizada (ganada o perdida).</span>
    </div>
  </>;
}
