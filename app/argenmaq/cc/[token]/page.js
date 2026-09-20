"use client";
// Vista pública de la CC Financiera de Argenmaq para la financiera: solo lectura, con Excel.
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const MONO="'JetBrains Mono',ui-monospace,Menlo,monospace";
const fmt=(v,m)=>`${m} ${Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtFecha=(d)=>{const s=String(d||"").slice(0,10);const [y,m,dd]=s.split("-");return y?`${dd}/${m}/${y}`:"";};
const TIPO={ingreso:"Ingreso",retiro:"Retiro",ajuste:"Ajuste",dolarizacion:"Dolarización"};

export default function CCPublica(){
  const { token } = useParams();
  const [d,setD]=useState(null);const [err,setErr]=useState("");const [filtro,setFiltro]=useState("todo");
  useEffect(()=>{(async()=>{try{const r=await fetch(`/api/argenmaq/cc/${token}`,{cache:"no-store"});const j=await r.json();if(!j.ok)throw new Error(j.error||"Error");setD(j);}catch(e){setErr(e.message);}})();},[token]);
  const movs=d?.movimientos||[];
  const saldo=(m)=>movs.filter(x=>x.moneda===m).reduce((s,x)=>s+(x.tipo==="retiro"?-1:1)*Number(x.acreditado??x.monto),0);
  // saldo corriente por fila (la lista viene de más nueva a más vieja)
  let ars=saldo("ARS"),usd=saldo("USD");
  const filas=movs.map(m=>{const signo=m.tipo==="retiro"?-1:1;const neto=Number(m.acreditado??m.monto)*signo;const fila={...m,saldoArs:ars,saldoUsd:usd};if(m.moneda==="USD")usd-=neto;else ars-=neto;return fila;}).filter(m=>filtro==="todo"||m.moneda===filtro);
  const S={page:{minHeight:"100vh",background:"#141517",color:"#F3F3F1",fontFamily:"'Manrope',ui-sans-serif,system-ui,sans-serif",padding:"24px 20px 60px"},card:{background:"#1C1E21",border:"1px solid #2B2E33",borderRadius:18,padding:"18px 20px"},lbl:{fontFamily:MONO,fontSize:11,letterSpacing:"0.08em",color:"#9DA3A9",textTransform:"uppercase",margin:0},th:{fontFamily:MONO,fontSize:10.5,letterSpacing:"0.08em",color:"#9DA3A9",textAlign:"left",padding:"10px 10px",background:"#23262A",whiteSpace:"nowrap"},td:{padding:"11px 10px",borderTop:"1px solid #2B2E33",fontSize:13.5,verticalAlign:"middle"}};
  return <main style={S.page}>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=JetBrains+Mono:wght@500;600&display=swap"/>
    <div style={{maxWidth:1120,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",marginBottom:20}}>
        <span style={{fontSize:20,fontWeight:800,letterSpacing:"-0.04em"}}>ARGEN<span style={{background:"#FFD200",color:"#141517",padding:"0 5px",borderRadius:5,marginLeft:1}}>MAQ</span></span>
        <div style={{flex:1}}><p style={{margin:0,fontSize:18,fontWeight:800}}>CC Financiera</p><p style={{margin:0,fontSize:12.5,color:"#9DA3A9"}}>Cuenta corriente con la financiera · ARS y USD{d?.share?.label?` · ${d.share.label}`:""}</p></div>
        {d&&<a href={`/api/argenmaq/cc/${token}/xlsx`} style={{padding:"10px 16px",borderRadius:999,background:"#FFD200",color:"#141517",fontWeight:700,fontSize:13.5,textDecoration:"none"}}>Descargar Excel</a>}
      </div>
      {err&&<div style={{...S.card,color:"#F28B8B"}}>{err}</div>}
      {!d&&!err&&<p style={{color:"#9DA3A9"}}>Cargando…</p>}
      {d&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12,marginBottom:14}}>
          {[["ARS",saldo("ARS")],["USD",saldo("USD")]].map(([m,v])=><div key={m} style={S.card}><p style={S.lbl}>Saldo en {m==="ARS"?"pesos":"dólares"} ({m})</p><p style={{margin:"6px 0 4px",fontSize:30,fontWeight:800,letterSpacing:"-0.02em",color:v>=0?"#FFD200":"#F28B8B",fontVariantNumeric:"tabular-nums"}}>{fmt(v,m)}</p><p style={{margin:0,fontSize:12.5,color:"#9DA3A9"}}>{v>=0?"A favor de Argenmaq (la financiera debe)":"Argenmaq debe a la financiera"}</p></div>)}
        </div>
        <div style={{...S.card,padding:0,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 18px"}}><b style={{fontSize:15}}>Movimientos</b><span style={{fontFamily:MONO,fontSize:12,color:"#9DA3A9"}}>{filas.length}</span><span style={{flex:1}}/>{["todo","ARS","USD"].map(k=><button key={k} onClick={()=>setFiltro(k)} style={{padding:"6px 12px",borderRadius:999,border:`1px solid ${filtro===k?"#FFD200":"#2B2E33"}`,background:filtro===k?"#3A3305":"transparent",color:"#F3F3F1",fontSize:12.5,fontWeight:700,cursor:"pointer"}}>{k==="todo"?"Todo":k}</button>)}</div>
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Fecha","Tipo","Moneda","Descripción","Importe","Comisión","Acreditado","Saldo ARS","Saldo USD"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{filas.map(m=>{const ing=m.tipo!=="retiro";return <tr key={m.id}><td style={{...S.td,fontFamily:MONO,fontSize:12.5,whiteSpace:"nowrap"}}>{fmtFecha(m.fecha)}</td><td style={{...S.td,fontWeight:700,color:ing?"#7BD88F":"#F28B8B"}}>{ing?"▲":"▼"} {TIPO[m.tipo]||m.tipo}</td><td style={S.td}>{m.moneda}</td><td style={S.td}>{m.comprobante_url&&<a href={m.comprobante_url} target="_blank" rel="noreferrer" style={{color:"#FFD200",marginRight:8}}>📎</a>}{m.concepto||"—"}</td><td style={{...S.td,fontFamily:MONO,textAlign:"right",color:ing?"#7BD88F":"#F28B8B",whiteSpace:"nowrap"}}>{ing?"+":"−"}{Number(m.monto).toLocaleString("es-AR",{minimumFractionDigits:2})}</td><td style={{...S.td,fontFamily:MONO,textAlign:"right",color:"#F2C94C",whiteSpace:"nowrap"}}>{m.comision_pct!=null?`${String(m.comision_pct).replace(".",",")}% · -${Number(m.comision||0).toLocaleString("es-AR",{minimumFractionDigits:2})}`:"—"}</td><td style={{...S.td,fontFamily:MONO,textAlign:"right",whiteSpace:"nowrap"}}>{Number(m.acreditado??m.monto).toLocaleString("es-AR",{minimumFractionDigits:2})}</td><td style={{...S.td,fontFamily:MONO,textAlign:"right",whiteSpace:"nowrap",fontWeight:m.moneda==="ARS"?800:500,color:m.moneda==="ARS"?"#FFD200":"#9DA3A9"}}>{m.saldoArs.toLocaleString("es-AR",{minimumFractionDigits:2})}</td><td style={{...S.td,fontFamily:MONO,textAlign:"right",whiteSpace:"nowrap",fontWeight:m.moneda==="USD"?800:500,color:m.moneda==="USD"?"#FFD200":"#9DA3A9"}}>{m.saldoUsd.toLocaleString("es-AR",{minimumFractionDigits:2})}</td></tr>;})}</tbody>
          </table></div>
          {filas.length===0&&<p style={{margin:0,padding:"30px 18px",color:"#9DA3A9",fontSize:13.5}}>Sin movimientos.</p>}
        </div>
      </>}
    </div>
  </main>;
}
