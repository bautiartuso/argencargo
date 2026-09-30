"use client";
// Comercial › A pedido: máquinas que alguien pide y no están en el catálogo. Se carga el cliente,
// cómo contactarlo y qué busca; después se sigue el estado hasta que se cotiza y se gana o se pierde.
import { useState, useEffect } from "react";
import { INK,GRIS,BORDE,SUAVE,CARD,LIMA,LIMA_SUAVE,OK,OK_BG,WARN,WARN_BG,BAD,BAD_BG,MONO,INP,LBL,TH,TD,Campo,Inp,TA,Btn,Sec,Pill,Chip,Barra,Vacio,Dato,Desplegable,txtONull,fmtFecha,toast,confirmDialog } from "./ui";

export const ESTADOS_BUSQ=[
  {k:"nueva",l:"Nueva",c:"#15171A",bg:LIMA},
  {k:"buscando",l:"Buscando",c:WARN,bg:WARN_BG},
  {k:"cotizada",l:"Cotizada",c:INK,bg:SUAVE},
  {k:"ganada",l:"Ganada",c:OK,bg:OK_BG},
  {k:"perdida",l:"Perdida",c:BAD,bg:BAD_BG},
];
const estadoDe=(k)=>ESTADOS_BUSQ.find(e=>e.k===k)||ESTADOS_BUSQ[0];
// En qué punto está el cliente antes de que le escribamos: define cómo encararlo.
export const SITUACIONES=[
  {k:"sin_contacto",l:"En cero",c:OK,bg:OK_BG,d:"Todavía no habló con nadie",tip:"Campo libre: ofrecé la máquina del catálogo con el precio final puesto y el video antes de embarcar. Nadie le mostró nada todavía."},
  {k:"averiguando",l:"Averiguando",c:INK,bg:SUAVE,d:"Está mirando, sin cotización en mano",tip:"Está comparando. Mandale una opción concreta con precio puesto en CABA y fecha aproximada: cerrás vos la comparación antes de que la haga él."},
  {k:"con_cotizacion",l:"Con cotización",c:WARN,bg:WARN_BG,d:"Ya le pasaron precio otros",tip:"Pedile qué proveedor y qué precio le pasaron. Competí con el precio final (flete, aduana y depósito incluidos) y con que la importación la pagás al recibir."},
  {k:"por_cerrar",l:"Por cerrar",c:BAD,bg:BAD_BG,d:"Casi cerrado con otro",tip:"Poco margen. Preguntá qué le falta para decidir y ofrecé el respaldo: una sola cara, video funcionando, garantía. Si no cierra, dejalo perdido y seguí."},
];
const situacionDe=(k)=>SITUACIONES.find(e=>e.k===k)||SITUACIONES[0];
const ChipSit=({s})=>{const x=situacionDe(s);return <Chip l={x.l} c={x.c} bg={x.bg}/>;};
export const URGENCIAS=[{v:"ya",l:"La necesita ya"},{v:"un_mes",l:"Dentro de un mes"},{v:"tres_meses",l:"Dentro de tres meses"},{v:"sin_apuro",l:"Sin apuro"},{v:"sin_definir",l:"Sin definir"}];
const urgenciaL=(k)=>URGENCIAS.find(u=>u.v===k)?.l||"Sin definir";
export const ORIGENES=[{v:"whatsapp",l:"WhatsApp"},{v:"instagram",l:"Instagram"},{v:"referido",l:"Referido"},{v:"web",l:"Web"},{v:"llamada",l:"Llamada"},{v:"otro",l:"Otro"}];
const origenL=(k)=>ORIGENES.find(o=>o.v===k)?.l||"";
const ChipBusq=({e})=>{const s=estadoDe(e);return <Chip l={s.l} c={s.c} bg={s.bg}/>;};
export const codigoBusq=(b)=>`BQ-${String(b.numero||0).padStart(5,"0")}`;
const wa=(t)=>{const d=String(t||"").replace(/\D/g,"");return d.length>=8?`https://wa.me/${d.startsWith("54")||d.length>10?d:"54"+d}`:null;};
const VACIO={cliente:"",contacto:"",email:"",descripcion:"",situacion:"sin_contacto",proveedores:"",precio_referencia:"",urgencia:"sin_definir",origen:""};

export function Busquedas({ses,dq}){
  const [lista,setLista]=useState([]);const [cargando,setCargando]=useState(true);
  const [q,setQ]=useState("");const [filtro,setFiltro]=useState("abiertas");const [fSit,setFSit]=useState("");
  const [nuevo,setNuevo]=useState(null);const [sel,setSel]=useState(null);const [guardando,setGuardando]=useState(false);
  const cargar=async()=>{setCargando(true);try{const r=await dq("cat_busquedas",{filters:"?select=*&order=created_at.desc"});setLista(Array.isArray(r)?r:[]);}catch(e){toast(e.message,"error");}setCargando(false);};
  useEffect(()=>{cargar();},[]); // eslint-disable-line react-hooks/exhaustive-deps

  const crear=async()=>{if(!nuevo.cliente.trim()||!nuevo.descripcion.trim()){toast("Falta el cliente o qué busca","warn");return;}setGuardando(true);try{
    const body={cliente:nuevo.cliente.trim(),contacto:txtONull(nuevo.contacto),email:txtONull(nuevo.email),descripcion:nuevo.descripcion.trim(),situacion:nuevo.situacion||"sin_contacto",proveedores:txtONull(nuevo.proveedores),precio_referencia:txtONull(nuevo.precio_referencia),urgencia:nuevo.urgencia||"sin_definir",origen:txtONull(nuevo.origen),creado_por:ses?.user?.id||null};
    const r=await dq("cat_busquedas",{method:"POST",body});const b=Array.isArray(r)?r[0]:null;
    if(b)setLista(l=>[b,...l]);setNuevo(null);toast("Búsqueda cargada");
  }catch(e){toast(e.message,"error");}setGuardando(false);};
  const guardar=async(id,patch)=>{try{const r=await dq("cat_busquedas",{method:"PATCH",filters:`?id=eq.${id}`,body:patch});const b=Array.isArray(r)?r[0]:null;setLista(l=>l.map(x=>x.id===id?{...x,...(b||patch)}:x));return true;}catch(e){toast(e.message,"error");return false;}};
  const borrar=async(b)=>{if(!(await confirmDialog(`¿Eliminar la búsqueda ${codigoBusq(b)} de ${b.cliente}?`,{ok:"Eliminar"})))return;try{await dq("cat_busquedas",{method:"DELETE",filters:`?id=eq.${b.id}`,prefer:"return=minimal"});setLista(l=>l.filter(x=>x.id!==b.id));setSel(null);toast("Búsqueda eliminada");}catch(e){toast(e.message,"error");}};

  const s=q.trim().toLowerCase();
  const visibles=lista.filter(b=>filtro==="todas"||(filtro==="abiertas"?!["ganada","perdida"].includes(b.estado):b.estado===filtro))
    .filter(b=>!fSit||(b.situacion||"sin_contacto")===fSit)
    .filter(b=>!s||[b.cliente,b.contacto,b.email,b.descripcion,b.proveedores,b.notas,codigoBusq(b)].some(v=>String(v||"").toLowerCase().includes(s)));
  const abiertas=lista.filter(b=>!["ganada","perdida"].includes(b.estado)).length;
  const b=sel?lista.find(x=>x.id===sel):null;
  if(b)return <Detalle b={b} onVolver={()=>setSel(null)} guardar={guardar} borrar={borrar}/>;

  return <>
    <Barra>
      <input placeholder="Buscar por cliente, contacto o máquina…" value={q} onChange={e=>setQ(e.target.value)} style={{...INP,flex:1,minWidth:220,borderRadius:999,padding:"10px 18px"}}/>
      <Btn kind="lima" onClick={()=>setNuevo(nuevo?null:{...VACIO})}>{nuevo?"Cerrar":"+ Nueva búsqueda"}</Btn>
    </Barra>
    {nuevo&&<Sec titulo="Nueva búsqueda a pedido" style={{marginBottom:18}}>
      <div style={{display:"grid",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr",gap:10}}>
          <Campo label="Cliente" ob><Inp autoFocus value={nuevo.cliente} onChange={e=>setNuevo(x=>({...x,cliente:e.target.value}))} placeholder="Nombre o empresa"/></Campo>
          <Campo label="Teléfono / WhatsApp"><Inp value={nuevo.contacto} onChange={e=>setNuevo(x=>({...x,contacto:e.target.value}))} placeholder="11 2345 6789"/></Campo>
          <Campo label="Email"><Inp value={nuevo.email} onChange={e=>setNuevo(x=>({...x,email:e.target.value}))} placeholder="opcional"/></Campo>
        </div>
        <Campo label="Qué busca" ob hint="Tipo de máquina, capacidad, uso, presupuesto: todo lo que dijo."><TA value={nuevo.descripcion} onChange={e=>setNuevo(x=>({...x,descripcion:e.target.value}))} placeholder="Ej.: amasadora de 50 kg para panadería, quiere una usada o nueva…"/></Campo>
        <Campo label="En qué punto está" hint={situacionDe(nuevo.situacion).d}><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{SITUACIONES.map(x=><Pill key={x.k} small on={nuevo.situacion===x.k} onClick={()=>setNuevo(n=>({...n,situacion:x.k}))}>{x.l}</Pill>)}</div></Campo>
        {nuevo.situacion!=="sin_contacto"&&<div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:10}}>
          <Campo label="Con quién ya habló" hint="Marca, proveedor, país, link de lo que vio."><TA value={nuevo.proveedores} onChange={e=>setNuevo(x=>({...x,proveedores:e.target.value}))} placeholder="Ej.: vio una en MercadoLibre a nombre de X; le cotizó un importador de Rosario…" style={{minHeight:70}}/></Campo>
          <Campo label="Precio que le pasaron" hint="Si lo dijo, con moneda."><Inp value={nuevo.precio_referencia} onChange={e=>setNuevo(x=>({...x,precio_referencia:e.target.value}))} placeholder="Ej.: USD 4.200 puesta"/></Campo>
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Campo label="Urgencia"><Desplegable value={nuevo.urgencia} onChange={v=>setNuevo(x=>({...x,urgencia:v}))} opciones={URGENCIAS} buscar={false}/></Campo>
          <Campo label="Por dónde llegó"><Desplegable value={nuevo.origen} onChange={v=>setNuevo(x=>({...x,origen:v}))} opciones={ORIGENES} buscar={false} placeholder="Elegir…"/></Campo>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn onClick={()=>setNuevo(null)}>Cancelar</Btn><Btn kind="lima" onClick={crear} disabled={guardando}>{guardando?"Guardando…":"Guardar búsqueda"}</Btn></div>
      </div>
    </Sec>}
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
      <Pill small on={filtro==="abiertas"} onClick={()=>setFiltro("abiertas")}>Abiertas · {abiertas}</Pill>
      {ESTADOS_BUSQ.map(e=><Pill key={e.k} small on={filtro===e.k} onClick={()=>setFiltro(e.k)}>{e.l} · {lista.filter(x=>x.estado===e.k).length}</Pill>)}
      <Pill small on={filtro==="todas"} onClick={()=>setFiltro("todas")}>Todas · {lista.length}</Pill>
    </div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
      <span style={{...LBL,marginBottom:0,marginRight:4}}>Situación</span>
      <Pill small on={!fSit} onClick={()=>setFSit("")}>Todas</Pill>
      {SITUACIONES.map(x=><Pill key={x.k} small on={fSit===x.k} onClick={()=>setFSit(fSit===x.k?"":x.k)}>{x.l} · {lista.filter(b=>(b.situacion||"sin_contacto")===x.k).length}</Pill>)}
    </div>
    {cargando?<p style={{color:GRIS}}>Cargando…</p>
    :visibles.length===0?<Vacio>{lista.length===0?"Todavía no hay búsquedas a pedido. Cargá la primera con “+ Nueva búsqueda”.":"Nada que coincida."}</Vacio>
    :<div style={{border:`1px solid ${BORDE}`,borderRadius:18,overflow:"hidden",background:CARD}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13.5}}>
      <thead><tr>{["Código","Fecha","Cliente","Contacto","Qué busca","Situación","Estado"].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{visibles.map(x=><tr key={x.id} className="fila" onClick={()=>setSel(x.id)} style={{cursor:"pointer"}}>
        <td style={{...TD,fontFamily:MONO,fontSize:12.5,color:GRIS,whiteSpace:"nowrap"}}>{codigoBusq(x)}</td>
        <td style={{...TD,whiteSpace:"nowrap",color:GRIS}}>{fmtFecha(x.created_at)}</td>
        <td style={{...TD,fontWeight:800}}>{x.cliente}{x.email&&<span style={{display:"block",fontWeight:500,color:GRIS,fontSize:12.5}}>{x.email}</span>}</td>
        <td style={{...TD,fontFamily:MONO,fontSize:12.5,whiteSpace:"nowrap"}}>{x.contacto||"—"}</td>
        <td style={{...TD,maxWidth:420}}><span style={{display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",lineHeight:1.4}}>{x.descripcion}</span></td>
        <td style={TD}><ChipSit s={x.situacion}/>{x.urgencia&&x.urgencia!=="sin_definir"&&<span style={{display:"block",marginTop:4,fontSize:11.5,color:x.urgencia==="ya"?BAD:GRIS,fontWeight:600}}>{urgenciaL(x.urgencia)}</span>}</td>
        <td style={TD}><ChipBusq e={x.estado}/></td>
      </tr>)}</tbody>
    </table></div></div>}
  </>;
}

function Detalle({b,onVolver,guardar,borrar}){
  const [edit,setEdit]=useState(null);const [notas,setNotas]=useState(b.notas||"");const [guardando,setGuardando]=useState(false);
  useEffect(()=>{setNotas(b.notas||"");},[b.id,b.notas]);
  const link=wa(b.contacto);
  const guardarDatos=async()=>{setGuardando(true);const ok=await guardar(b.id,{cliente:edit.cliente.trim(),contacto:txtONull(edit.contacto),email:txtONull(edit.email),descripcion:edit.descripcion.trim(),proveedores:txtONull(edit.proveedores),precio_referencia:txtONull(edit.precio_referencia),urgencia:edit.urgencia||"sin_definir",origen:txtONull(edit.origen)});if(ok){setEdit(null);toast("Datos guardados");}setGuardando(false);};
  const guardarNotas=async()=>{setGuardando(true);if(await guardar(b.id,{notas:txtONull(notas)}))toast("Notas guardadas");setGuardando(false);};
  return <>
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",margin:"0 0 22px"}}>
      <Btn small onClick={onVolver}>← A pedido</Btn><span style={{fontWeight:800,fontSize:18}}>{b.cliente}</span><span style={{fontFamily:MONO,fontSize:12,color:GRIS}}>{codigoBusq(b)}</span><ChipBusq e={b.estado}/><span style={{flex:1}}/>
      {link&&<a href={link} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn small kind="lima">WhatsApp</Btn></a>}
      <Btn small kind="danger" onClick={()=>borrar(b)}>Eliminar</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:14}}>
      <Dato l="Cargada" v={fmtFecha(b.created_at)} acento={GRIS}/>
      <Dato l="Última novedad" v={fmtFecha(b.updated_at)} acento={GRIS}/>
      <Dato l="Contacto" v={b.contacto||"—"} sub={b.email||undefined} acento={GRIS}/>
      <Dato l="Urgencia" v={urgenciaL(b.urgencia)} sub={b.origen?`Llegó por ${origenL(b.origen)}`:undefined} color={b.urgencia==="ya"?BAD:INK} acento={b.urgencia==="ya"?BAD:GRIS}/>
    </div>
    <Sec titulo="En qué punto está" style={{marginBottom:14}} extra={<ChipSit s={b.situacion}/>}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>{SITUACIONES.map(x=><Pill key={x.k} small on={(b.situacion||"sin_contacto")===x.k} onClick={async()=>{if(b.situacion!==x.k&&await guardar(b.id,{situacion:x.k}))toast(`Situación: ${x.l.toLowerCase()}`);}}>{x.l}</Pill>)}</div>
      <div style={{background:LIMA_SUAVE,borderLeft:`3px solid ${LIMA}`,borderRadius:12,padding:"12px 14px",fontSize:13.5,lineHeight:1.5}}><b style={{display:"block",fontFamily:MONO,fontSize:10.5,letterSpacing:"0.08em",textTransform:"uppercase",color:GRIS,marginBottom:4}}>Cómo encararlo</b>{situacionDe(b.situacion).tip}</div>
      {(b.proveedores||b.precio_referencia)&&<div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:12,marginTop:12,fontSize:14}}>
        <div><p style={{...LBL,marginBottom:2}}>Con quién ya habló</p><p style={{margin:0,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{b.proveedores||"—"}</p></div>
        <div><p style={{...LBL,marginBottom:2}}>Precio que le pasaron</p><b style={{fontFamily:MONO}}>{b.precio_referencia||"—"}</b></div>
      </div>}
    </Sec>
    <Sec titulo="Estado" style={{marginBottom:14}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{ESTADOS_BUSQ.map(e=><Pill key={e.k} on={b.estado===e.k} onClick={async()=>{if(b.estado!==e.k&&await guardar(b.id,{estado:e.k}))toast(`Pasó a ${e.l.toLowerCase()}`);}}>{e.l}</Pill>)}</div>
      <p style={{margin:"10px 0 0",fontSize:12.5,color:GRIS}}>Nueva → buscando en fábricas → cotizada al cliente → ganada (se carga como operación) o perdida.</p>
    </Sec>
    <div className="dos" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Sec titulo="Pedido" extra={edit?<div style={{display:"flex",gap:8}}><Btn small kind="lima" onClick={guardarDatos} disabled={guardando}>{guardando?"Guardando…":"Guardar"}</Btn><Btn small onClick={()=>setEdit(null)}>Cancelar</Btn></div>:<Btn small onClick={()=>setEdit({cliente:b.cliente||"",contacto:b.contacto||"",email:b.email||"",descripcion:b.descripcion||"",proveedores:b.proveedores||"",precio_referencia:b.precio_referencia||"",urgencia:b.urgencia||"sin_definir",origen:b.origen||""})}>Editar</Btn>}>
        {edit?<div style={{display:"grid",gap:10}}>
          <Campo label="Cliente" ob><Inp value={edit.cliente} onChange={e=>setEdit(x=>({...x,cliente:e.target.value}))}/></Campo>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Campo label="Teléfono / WhatsApp"><Inp value={edit.contacto} onChange={e=>setEdit(x=>({...x,contacto:e.target.value}))}/></Campo><Campo label="Email"><Inp value={edit.email} onChange={e=>setEdit(x=>({...x,email:e.target.value}))}/></Campo></div>
          <Campo label="Qué busca" ob><TA value={edit.descripcion} onChange={e=>setEdit(x=>({...x,descripcion:e.target.value}))}/></Campo>
          <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:10}}><Campo label="Con quién ya habló"><TA value={edit.proveedores} onChange={e=>setEdit(x=>({...x,proveedores:e.target.value}))} style={{minHeight:70}}/></Campo><Campo label="Precio que le pasaron"><Inp value={edit.precio_referencia} onChange={e=>setEdit(x=>({...x,precio_referencia:e.target.value}))}/></Campo></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Campo label="Urgencia"><Desplegable value={edit.urgencia} onChange={v=>setEdit(x=>({...x,urgencia:v}))} opciones={URGENCIAS} buscar={false}/></Campo><Campo label="Por dónde llegó"><Desplegable value={edit.origen} onChange={v=>setEdit(x=>({...x,origen:v}))} opciones={ORIGENES} buscar={false} placeholder="Elegir…"/></Campo></div>
        </div>
        :<div style={{display:"grid",gap:10,fontSize:14}}>
          <div><p style={{...LBL,marginBottom:2}}>Cliente</p><b>{b.cliente}</b></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><p style={{...LBL,marginBottom:2}}>Teléfono / WhatsApp</p><span style={{fontFamily:MONO}}>{b.contacto||"—"}</span></div><div><p style={{...LBL,marginBottom:2}}>Email</p><span>{b.email||"—"}</span></div></div>
          <div><p style={{...LBL,marginBottom:2}}>Qué busca</p><p style={{margin:0,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{b.descripcion}</p></div>
        </div>}
      </Sec>
      <Sec titulo="Seguimiento" extra={<Btn small kind="lima" onClick={guardarNotas} disabled={guardando||notas===(b.notas||"")}>Guardar notas</Btn>}>
        <TA value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Fábricas consultadas, precios que fueron llegando, qué dijo el cliente…" style={{minHeight:180}}/>
      </Sec>
    </div>
  </>;
}
