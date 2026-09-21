// Cálculo de canales y precios de una máquina de ARGENMAQ. Vive fuera del panel porque lo usan
// tres lugares: la pantalla de canales, el guardado de la ficha y el recálculo automático que
// corre en el servidor cuando cambian las tarifas de Argencargo (21/09/2026).
import { calcOpBudget } from "./calc";
import { precioMaquina } from "./catalogo-precio";

const n = (v, d = 0) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : d; };

// Regla de Bautista (20/09/2026): se muestran SIEMPRE las tres vías con sus números; si una no se
// puede ofrecer, se explica por qué, pero no se esconde. Quien carga decide cuáles ve el cliente.
// El cliente nunca ve "LCL/FCL" ni "Integral": ve "vía aérea" y "vía marítima", así que como
// mucho una de las dos marítimas puede estar visible.
export const VIAS=[
  {k:"aereo",l:"Aéreo Courier Comercial",sub:"7-10 días",channel:"aereo_blanco"},
  {k:"maritimo_lcl",l:"Marítimo Carga LCL/FCL",sub:"60-70 días",channel:"maritimo_blanco"},
  {k:"maritimo_integral",l:"Marítimo Integral",sub:"60-70 días · impuestos incluidos",channel:"maritimo_negro"},
];
// Costos de Argencargo por vía para una máquina (1 unidad) y los motivos por los que una vía no
// se puede ofrecer. No depende de la gestión configurada: lo usan la pantalla de canales y el
// recálculo masivo de precios (cuando cambian las tarifas de Argencargo o la preferencial del cliente).
export function analizarVias(m,tarifas){
  const packing=Array.isArray(m.packing)?m.packing:[];
  const cliente=tarifas?.cliente||{tax_condition:"responsable_inscripto"};
  const armar=(q)=>({
    items:[{description:m.nombre||"Máquina",unit_price_usd:n(m.exw_usd),quantity:q,import_duty_rate:n(m.die),statistics_rate:n(m.te),iva_rate:(m.iva===""||m.iva==null)?21:n(m.iva),iva_additional_rate:20,iigg_rate:6,iibb_rate:5,ncm_code:m.ncm_code||null,package_ids:packing.map((_,i)=>i)}],
    pks:packing.map((b,i)=>({id:i,quantity:n(b.cantidad,1)*q,gross_weight_kg:n(b.peso_kg),length_cm:n(b.largo_cm),width_cm:n(b.ancho_cm),height_cm:n(b.alto_cm)})),
  });
  const base=armar(1);
  const totCBM=base.pks.reduce((x,b)=>x+(b.length_cm*b.width_cm*b.height_cm/1e6)*b.quantity,0);
  const pesado=base.pks.some(b=>b.gross_weight_kg>45);
  // Intervención de organismos (ANMAT, INAL, etc.): esa máquina no puede ir por LCL/FCL.
  const intervenida=!!(m.intervencion?.required||(m.intervencion?.types||[]).length);
  // LCL/FCL factura mínimo 1 m³: si una unidad no llega, la vía se habilita desde N unidades y
  // sus números se calculan para esa cantidad (por unidad), que es como la va a comprar el cliente.
  const qtyMinLcl=totCBM>0?Math.max(1,Math.ceil(1/totCBM)):1;
  return VIAS.map(v=>{
    const q=v.k==="maritimo_lcl"?qtyMinLcl:1;
    const {items,pks}=q===1?base:armar(q);
    let r=null,err=null;
    try{r=calcOpBudget({channel:v.channel,origin:"China",shipping_to_door:false,shipping_cost:0,has_battery:false,has_phones:false},items,pks,tarifas?.tariffs||[],tarifas?.config||{},tarifas?.overrides||[],cliente);}catch(e){err=e.message;}
    const motivos=[];
    if(v.k==="aereo"&&pesado)motivos.push({t:"Hay bultos de más de 45 kg: el courier comercial no los acepta.",bloquea:true});
    if(v.k==="maritimo_lcl"&&intervenida)motivos.push({t:"La máquina tiene intervención de organismo: no puede ir por LCL/FCL.",bloquea:true});
    if(v.k==="maritimo_lcl"&&q>1)motivos.push({t:`Una unidad cubica ${totCBM.toFixed(3).replace(".",",")} m³ y LCL/FCL factura mínimo 1 m³: se habilita desde ${q} unidades y los números de esta tarjeta son por unidad comprando ${q}.`,bloquea:false});
    if(!tarifas?.tariffs?.length)motivos.push({t:"Sin tarifas cargadas de Argencargo.",bloquea:true});
    return {...v,r,err,qty:q,motivos,bloqueada:!r||!!err||motivos.some(x=>x.bloquea),totCBM};
  });
}
// Precio de venta de una vía con la gestión configurada (porcentaje o monto fijo).
export function precioDeVia(via,cfgVia,m,ajustes){
  const q=Math.max(1,n(via.qty,1));
  const arg=via.r?n(via.r.totalAbonar):0;
  const gp=String(cfgVia?.gestion_pct??"").trim()!==""?cfgVia.gestion_pct:(m.markup_pct??null);
  const gu=String(cfgVia?.gestion_usd??"").trim()!==""?cfgVia.gestion_usd:null;
  const r=precioMaquina({exwUnit:n(m.exw_usd),qty:q,ajustes,gestionPct:gp,gestionUsd:gu,importacion:arg});
  // Siempre por unidad: así las tres vías se comparan con el mismo criterio.
  return {qty:q,exw:r.exw/q,financiero:r.financiero/q,gestion:r.gestion/q,base:r.base/q,maquina:r.precio/q,argencargo:arg/q,total:r.total/q};
}
// El objeto `canales` tal cual se guarda en cat_productos.
export function armarCanales(analisis,cfg,m,ajustes){
  return Object.fromEntries(analisis.map(v=>{
    const c=cfg?.[v.k]||{};const pr=precioDeVia(v,c,m,ajustes);
    return [v.k,{mostrar:!!c.mostrar&&!v.bloqueada,
      gestion_pct:String(c.gestion_pct??"").trim()===""?null:n(c.gestion_pct),
      gestion_usd:String(c.gestion_usd??"").trim()===""?null:n(c.gestion_usd),
      argencargo:v.r?{flete:n(v.r.flete),seguro:n(v.r.seguro),sobrepeso:n(v.r.overweightSurcharge),impuestos:n(v.r.totalTax),recargo:n(v.r.surcharge),total:n(v.r.totalAbonar),unidad:v.r.fleteAmt}:null,
      precio:pr,qty_min:v.qty||1,motivos:v.motivos,calculado_at:new Date().toISOString()}];
  }));
}
