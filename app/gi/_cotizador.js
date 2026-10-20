"use client";
// Cotizador de Gestión Integral. Rediseñado el 13/10/2026 (una pantalla) y el 20/10/2026: origen a nivel
// cotización, bultos propios con asignación de productos, varias fotos, Enter entre campos, autoguardado.
import { useState, useEffect, useRef } from "react";
import { calcOpBudget, applyAntidumpingFloor, tasaODefault, TASA_IVA_ADICIONAL, TASA_IIGG, TASA_IIBB, tablaDesaduanaje } from "../../lib/calc";
import { alertDialog, toast } from "../../lib/ui";
import { dq, ensureFresh, uploadProductPhoto, fmtDate, fmtUSD, usd0, hace, buildQuoteWaMessage, cleanWaNumber, useMovil, C, MONO, inp, Btn, Titulo, Volver, Dato, GOLD, GOLD_LIGHT, GOLD_DEEP, GOLD_GRADIENT } from "./_base";

export const CHANNEL_DEFS=[
  {key:"aereo_blanco",name:"Aéreo Courier Comercial",time:"7 a 10 días hábiles"},
  // maritimo_blanco internamente = LCL/FCL (min 1 m³). maritimo_negro = Integral AC (sin mínimo).
  {key:"maritimo_blanco",name:"Marítimo LCL/FCL",time:"~ 60 días"},
  {key:"maritimo_negro",name:"Marítimo Integral AC",time:"~ 60 días"},
];

export function CotizadorWizard({token,requestId,profileId,onBack,rol}){
  const verGanancia=rol!=="empleado";
  const [lastSentStatus,setLastSentStatus]=useState(null);
  const [step,setStep]=useState(1);
  const [request,setRequest]=useState(null);
  const [client,setClient]=useState(null);
  const [tariffs,setTariffs]=useState([]);
  const [config,setConfig]=useState({});
  const [products,setProducts]=useState([]);
  // Bultos de la cotización (20/10/2026): cada uno sabe qué productos lleva (índices en `prods`).
  // Antes el embalaje iba pegado a cada producto; así no se podía poner dos productos en una caja.
  const [packages,setPackages]=useState([]);
  // Origen de la cotización (China / USA): uno solo para todos los productos.
  const [origin,setOrigin]=useState("china");
  const [paymentPlan,setPaymentPlan]=useState([
    {pct:30,label:"Inicio de producción"},
    {pct:20,label:"Producción terminada"},
    {pct:50,label:"Contra entrega"},
  ]);
  // % del FOB que se paga al proveedor como anticipo (resto al fin de producción).
  const [supplierDepositPct,setSupplierDepositPct]=useState("30");
  const [honorariosPct,setHonorariosPct]=useState("10");
  // Zona del cliente: limita las opciones de envío que ve en /cotizacion/[token].
  const [deliveryZone,setDeliveryZone]=useState("");
  const [lo,setLo]=useState(true);
  const [cargado,setCargado]=useState(false);
  const [generatedQuote,setGeneratedQuote]=useState(null);
  const [saving,setSaving]=useState(false);
  const [savingDraft,setSavingDraft]=useState(false);
  const [draftQuoteId,setDraftQuoteId]=useState(null);
  const [lastSavedAt,setLastSavedAt]=useState(null);
  const [dirty,setDirty]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3500);};

  const emptyProductFrom=(p)=>({
    _id:p?.id,
    description:p?.description||"",
    notes:p?.notes||"",
    quantity:p?.quantity!=null?String(p.quantity):"",
    unit_cost_usd:p?.unit_cost_usd!=null?String(p.unit_cost_usd):"",
    lead_time_days:p?.lead_time_days!=null?String(p.lead_time_days):"",
    photo_urls:Array.isArray(p?.photo_urls)&&p.photo_urls.length?p.photo_urls.filter(Boolean):(p?.photo_url?[p.photo_url]:[]),
    ncm_code:p?.ncm_code||"",
    ncm_description:p?.ncm_description||"",
    import_duty_rate:p?.ncm_di_pct!=null?String(p.ncm_di_pct):"",
    statistics_rate:p?.ncm_estad_pct!=null?String(p.ncm_estad_pct):"",
    iva_rate:p?.ncm_iva_pct!=null?String(p.ncm_iva_pct):"",
    ncm_loading:false,
    ncm_error:false,
    ncm_hint:"",
    supplier_ref:p?.supplier_ref||"",
  });
  const emptyPackage=(k)=>({
    _id:k?.id,
    count:k?.pkg_count!=null?String(k.pkg_count):"1",
    l:k?.length_cm!=null?String(k.length_cm):"",
    w:k?.width_cm!=null?String(k.width_cm):"",
    h:k?.height_cm!=null?String(k.height_cm):"",
    kg:k?.weight_kg!=null?String(k.weight_kg):"",
    prods:Array.isArray(k?.product_idx)?k.product_idx.map(Number):[],
  });
  // Cotizaciones viejas: el embalaje venía en cada producto. Se convierte a bultos (uno por producto).
  const paquetesLegacy=(prods)=>prods.map((p,i)=>Number(p.pkg_count||0)>0&&p.pkg_length_cm?{_id:undefined,count:String(p.pkg_count),l:String(p.pkg_length_cm),w:String(p.pkg_width_cm||""),h:String(p.pkg_height_cm||""),kg:String(p.pkg_weight_kg||""),prods:[i]}:null).filter(Boolean);

  // Cargar todo: si hay un quote draft existente para este request, usarlo (con sus productos parciales).
  // Sino, usar los productos crudos del request (lo que pidió el admin) como base.
  useEffect(()=>{(async()=>{
    setLo(true);
    const [reqRes,tar,cfg,draftRes]=await Promise.all([
      dq("gi_quote_requests",{token,filters:`?id=eq.${requestId}&select=*,clients(*),gi_quote_request_products(*)`}),
      dq("tariffs",{token,filters:"?select=*&type=eq.rate&order=sort_order.asc"}),
      dq("calc_config",{token,filters:"?select=*"}),
      dq("gi_quotes",{token,filters:`?request_id=eq.${requestId}&status=in.(draft,sent,accepted)&select=*,gi_quote_products(*)&order=created_at.desc&limit=1`}),
    ]);
    const r=Array.isArray(reqRes)&&reqRes[0]?reqRes[0]:null;
    if(r){setRequest(r);setClient(r.clients);}
    const draft=Array.isArray(draftRes)&&draftRes[0]?draftRes[0]:null;
    let origen=r?.origin||"";
    if(draft){
      setDraftQuoteId(draft.id);
      setLastSentStatus(draft.status);
      if(draft.payment_plan)setPaymentPlan(typeof draft.payment_plan==="string"?JSON.parse(draft.payment_plan):draft.payment_plan);
      if(draft.honorarios_pct!=null)setHonorariosPct(String(draft.honorarios_pct));
      if(draft.supplier_deposit_pct!=null)setSupplierDepositPct(String(draft.supplier_deposit_pct));
      if(draft.delivery_zone!=null)setDeliveryZone(draft.delivery_zone);
      const draftProds=(draft.gi_quote_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
      if(!origen&&draftProds[0]?.origin)origen=draftProds[0].origin;
      if(draftProds.length>0)setProducts(draftProds.map(emptyProductFrom));
      else if(r){const rawProds=(r.gi_quote_request_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));setProducts(rawProds.map(p=>emptyProductFrom({description:p.description,notes:p.notes,quantity:p.quantity,photo_url:p.photo_url})));}
      const pk=await dq("gi_quote_packages",{token,filters:`?quote_id=eq.${draft.id}&select=*&order=display_order.asc`});
      const pks=Array.isArray(pk)?pk:[];
      setPackages(pks.length?pks.map(emptyPackage):paquetesLegacy(draftProds));
      setLastSavedAt(draft.updated_at||draft.created_at);
    } else if(r){
      const rawProds=(r.gi_quote_request_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
      setProducts(rawProds.length>0?rawProds.map(p=>emptyProductFrom({description:p.description,notes:p.notes,quantity:p.quantity,photo_url:p.photo_url})):[emptyProductFrom({})]);
      setPackages([]);
    }
    setOrigin(origen==="usa"?"usa":"china");
    setTariffs(Array.isArray(tar)?tar:[]);
    const cfgObj={};(Array.isArray(cfg)?cfg:[]).forEach(x=>{cfgObj[x.key]=Number(x.value);});setConfig(cfgObj);
    setLo(false);
    setTimeout(()=>setCargado(true),0);
  })();},[requestId,token]);

  // Persiste el state actual como draft (UPSERT del gi_quote + reemplaza productos y bultos).
  const pendienteRef=useRef(false);
  const saveDraft=async({silent=false}={})=>{
    if(lo)return;
    if(savingDraft){pendienteRef.current=true;return;}
    setSavingDraft(true);
    try{
      let quoteId=draftQuoteId;
      const cab={payment_plan:paymentPlan,honorarios_pct:honorariosPct?Number(honorariosPct):null,supplier_deposit_pct:supplierDepositPct?Number(supplierDepositPct):null,delivery_zone:deliveryZone||null};
      if(!quoteId){
        const inserted=await dq("gi_quotes",{method:"POST",token,body:{request_id:requestId,...cab,status:"draft"}});
        quoteId=Array.isArray(inserted)?inserted[0]?.id:inserted?.id;
        if(!quoteId)throw new Error("No se pudo crear el borrador");
        setDraftQuoteId(quoteId);
      } else {
        await dq("gi_quotes",{method:"PATCH",token,filters:`?id=eq.${quoteId}`,body:cab});
      }
      if(request&&request.origin!==origin){await dq("gi_quote_requests",{method:"PATCH",token,filters:`?id=eq.${requestId}`,body:{origin}});setRequest(r=>r?{...r,origin}:r);}
      if(products.length>0){
        // Estrategia segura: INSERT primero los nuevos, recién DESPUÉS borrar los viejos.
        const oldRows=await dq("gi_quote_products",{token,filters:`?quote_id=eq.${quoteId}&select=id`});
        const oldIds=Array.isArray(oldRows)?oldRows.map(x=>x.id):[];
        const newOrder=oldIds.length+1000;
        const insertedIds=[];
        for(let i=0;i<products.length;i++){
          const inserted=await insertarProducto(productoBody(products[i],origin,newOrder+i));
          const newId=Array.isArray(inserted)?inserted[0]?.id:inserted?.id;
          if(!newId)throw new Error(`Falló guardar el producto ${i+1}. Los productos viejos siguen guardados.`);
          insertedIds.push(newId);
        }
        if(oldIds.length>0)await dq("gi_quote_products",{method:"DELETE",token,filters:`?id=in.(${oldIds.map(id=>`"${id}"`).join(",")})`});
        for(let i=0;i<insertedIds.length;i++)await dq("gi_quote_products",{method:"PATCH",token,filters:`?id=eq.${insertedIds[i]}`,body:{display_order:i}});
      }
      await guardarBultos(quoteId);
      setLastSavedAt(new Date().toISOString());setDirty(false);
      if(!silent)flash(`✓ Guardado (${products.length} producto${products.length!==1?"s":""} · ${packages.length} bulto${packages.length!==1?"s":""})`);
    } catch(e){
      if(!silent)alertDialog("Error al guardar: "+e.message);else console.error("autosave",e);
    } finally {
      setSavingDraft(false);
      if(pendienteRef.current){pendienteRef.current=false;setTimeout(()=>saveRef.current({silent:true}),50);}
    }
  };
  const saveRef=useRef(saveDraft);saveRef.current=saveDraft;
  const productoBody=(p,orig,order)=>({
    description:p.description||null,
    origin:orig||"china",
    quantity:p.quantity?Number(p.quantity):null,
    unit_cost_usd:p.unit_cost_usd?Number(p.unit_cost_usd):null,
    ncm_code:p.ncm_code||null,
    ncm_description:p.ncm_description||null,
    ncm_di_pct:p.import_duty_rate!==""&&p.import_duty_rate!=null?Number(p.import_duty_rate):null,
    ncm_iva_pct:p.iva_rate!==""&&p.iva_rate!=null?Number(p.iva_rate):null,
    ncm_estad_pct:p.statistics_rate!==""&&p.statistics_rate!=null?Number(p.statistics_rate):null,
    lead_time_days:p.lead_time_days?Number(p.lead_time_days):null,
    photo_url:p.photo_urls?.[0]||null,
    photo_urls:p.photo_urls?.length?p.photo_urls:null,
    supplier_ref:p.supplier_ref||null,
    display_order:order,
  });
  // Hasta que se corra el SQL del 20/10 no existe photo_urls: se guarda sin esa columna (queda la primera foto).
  const insertarProducto=async(body)=>{let r=await dq("gi_quote_products",{method:"POST",token,body});if(!Array.isArray(r)&&/photo_urls/.test(String(r?.message||""))){const {photo_urls,...resto}=body;r=await dq("gi_quote_products",{method:"POST",token,body:resto});}return r;};
  const guardarBultos=async(quoteId)=>{
    if(!packages.length)return;
    const old=await dq("gi_quote_packages",{token,filters:`?quote_id=eq.${quoteId}&select=id`});
    const oldIds=Array.isArray(old)?old.map(x=>x.id):[];
    for(let i=0;i<packages.length;i++){
      const k=packages[i];
      const r=await dq("gi_quote_packages",{method:"POST",token,body:{quote_id:quoteId,display_order:i,pkg_count:Number(k.count)||1,length_cm:k.l?Number(k.l):null,width_cm:k.w?Number(k.w):null,height_cm:k.h?Number(k.h):null,weight_kg:k.kg?Number(k.kg):null,product_idx:(k.prods||[]).map(Number)}});
      if(r&&!Array.isArray(r)&&r.code){if(/gi_quote_packages/.test(String(r.message||"")))throw new Error("Falta correr el SQL de bultos (2026_10_20_gi_cotizador_v2.sql)");throw new Error(`No se pudo guardar el bulto ${i+1}`);}
    }
    if(oldIds.length)await dq("gi_quote_packages",{method:"DELETE",token,filters:`?id=in.(${oldIds.map(id=>`"${id}"`).join(",")})`});
  };

  // Autoguardado: cada cambio se guarda solo 1,5 s después de la última tecla.
  useEffect(()=>{
    if(!cargado)return;
    setDirty(true);
    const t=setTimeout(()=>{saveRef.current({silent:true});},1500);
    return()=>clearTimeout(t);
  },[products,packages,paymentPlan,honorariosPct,supplierDepositPct,origin,deliveryZone]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateProduct=(i,field,value)=>setProducts(p=>p.map((x,j)=>j===i?{...x,[field]:value}:x));
  const addProduct=()=>setProducts(p=>[...p,emptyProductFrom({})]);
  const removeProduct=(i)=>{if(products.length<=1)return;setProducts(p=>p.filter((_,j)=>j!==i));setPackages(ks=>ks.map(k=>({...k,prods:k.prods.filter(x=>x!==i).map(x=>x>i?x-1:x)})));};

  const classifyNcm=async(i,hint)=>{
    const p=products[i];
    if(!p.description?.trim()&&!p.photo_urls?.length&&!hint)return;
    updateProduct(i,"ncm_loading",true);updateProduct(i,"ncm_error",false);
    try{
      let body={description:p.description||""};
      if(hint)body.hint=hint;
      const foto=p.photo_urls?.[0];
      if(foto&&!hint){
        try{
          const imgR=await fetch(foto);
          const blob=await imgR.blob();
          const needsRecode=blob.size>1024*1024||!/^image\/(png|jpe?g|gif|webp)$/.test(blob.type);
          let finalBlob=blob;let finalMime=blob.type||"image/jpeg";
          if(needsRecode){
            const bmp=await createImageBitmap(blob).catch(()=>null);
            if(bmp){
              const maxDim=1600;const scale=Math.min(1,maxDim/Math.max(bmp.width,bmp.height));
              const w=Math.round(bmp.width*scale),h=Math.round(bmp.height*scale);
              const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
              canvas.getContext("2d").drawImage(bmp,0,0,w,h);
              finalBlob=await new Promise(res=>canvas.toBlob(res,"image/jpeg",0.85));
              finalMime="image/jpeg";
            }
          }
          const b64=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result.split(",")[1]);fr.onerror=reject;fr.readAsDataURL(finalBlob);});
          body.image=b64;body.image_mime=finalMime;
        } catch(e){console.warn("No pude leer foto para NCM",e);}
      }
      const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json();
      if(d.fallback||d.error){
        setProducts(prods=>prods.map((x,j)=>j===i?{...x,ncm_loading:false,ncm_error:true}:x));
      } else {
        setProducts(prods=>prods.map((x,j)=>j===i?{...x,ncm_loading:false,ncm_error:false,ncm_hint:"",ncm_code:d.ncm_code||"",ncm_description:d.ncm_description||"",import_duty_rate:d.import_duty_rate!=null?String(d.import_duty_rate):"",statistics_rate:d.statistics_rate!=null?String(d.statistics_rate):"",iva_rate:d.iva_rate!=null?String(d.iva_rate):""}:x));
        if(d.hint_note)toast.info(d.hint_note);
      }
    } catch(e){
      setProducts(prods=>prods.map((x,j)=>j===i?{...x,ncm_loading:false,ncm_error:true}:x));
    }
  };

  // Bultos en el formato de lib/calc.js
  const pkgsCalc=()=>packages.filter(k=>Number(k.count)>0&&Number(k.l)>0).map(k=>({quantity:Number(k.count||1),gross_weight_kg:Number(k.kg||0),length_cm:Number(k.l||0),width_cm:Number(k.w||0),height_cm:Number(k.h||0)}));
  // Cálculo por canal: corre calcOpBudget para cada canal disponible
  const computeChannel=(channelKey)=>{
    const items=products.map(p=>({
      unit_price_usd:Number(p.unit_cost_usd||0),
      quantity:Number(p.quantity||0),
      import_duty_rate:p.import_duty_rate?Number(p.import_duty_rate):0,
      statistics_rate:p.statistics_rate?Number(p.statistics_rate):0,
      iva_rate:p.iva_rate?Number(p.iva_rate):21,
      ncm_code:p.ncm_code||null,
    }));
    const op={channel:channelKey,origin:origin==="usa"?"USA":"China",has_battery:false,has_phones:false,shipping_to_door:false,shipping_cost:0,merchandise_value_usd:items.reduce((s,it)=>s+it.unit_price_usd*it.quantity,0)};
    try{return calcOpBudget(op,items,pkgsCalc(),tariffs,config,[],client);}
    catch(e){console.error(`[calc ${channelKey}]`,e);return null;}
  };

  const totalFob=products.reduce((s,p)=>s+Number(p.unit_cost_usd||0)*Number(p.quantity||0),0);
  const honorariosFactor=1+(Number(honorariosPct||0)/100);
  const channelResults=CHANNEL_DEFS.map(ch=>{
    const r=computeChannel(ch.key);
    if(!r)return {...ch,impoOnly:0,total:0,real:0,honorariosUsd:0,gainLogistica:0,gainHonorarios:0,gainTotal:0,error:true};
    const impoOnly=r.totalAbonar+totalFob;
    const total=impoOnly*honorariosFactor;
    const real=totalFob+(r.realCost||0);
    const honorariosUsd=total-impoOnly;
    const gainLogistica=impoOnly-real;
    const gainHonorarios=honorariosUsd;
    const gainTotal=gainLogistica+gainHonorarios;
    return {...ch,impoOnly,total,real,honorariosUsd,gainLogistica,gainHonorarios,gainTotal,calc:r};
  });
  // Desde USA no hay LCL/FCL propio: aéreo (con NCM) y marítimo integral.
  const someUSA=origin==="usa";
  const visibleChannels=someUSA?channelResults.filter(c=>c.key!=="maritimo_blanco"):channelResults;

  const validateStep1=()=>{
    if(products.length===0)return "Agregá al menos un producto";
    for(let i=0;i<products.length;i++){
      const p=products[i];
      if(!p.description?.trim())return `Producto ${i+1}: falta descripción`;
      if(!p.quantity||Number(p.quantity)<=0)return `Producto ${i+1}: falta cantidad`;
      if(!p.unit_cost_usd||Number(p.unit_cost_usd)<=0)return `Producto ${i+1}: falta costo unitario`;
    }
    if(packages.length===0)return "Cargá al menos un bulto";
    for(let i=0;i<packages.length;i++){const k=packages[i];if(!(Number(k.count)>0)||!k.l||!k.w||!k.h||!k.kg)return `Bulto ${i+1}: faltan medidas o peso`;}
    const cubiertos=new Set();packages.forEach(k=>{(k.prods.length?k.prods:products.map((_,i)=>i)).forEach(i=>cubiertos.add(i));});
    const sin=products.findIndex((_,i)=>!cubiertos.has(i));
    if(sin>=0)return `Producto ${sin+1}: decí en qué bulto viaja`;
    return null;
  };

  const generateLink=async()=>{
    setSaving(true);
    try{
      const ch=channelResults.reduce((acc,c)=>{
        if(c.key==="aereo_blanco"){acc.cost_aereo_int_total_usd=Math.round(c.total*100)/100;acc.cost_aereo_int_real_usd=Math.round(c.real*100)/100;}
        else if(c.key==="maritimo_negro"){acc.cost_maritimo_lcl_total_usd=Math.round(c.total*100)/100;acc.cost_maritimo_lcl_real_usd=Math.round(c.real*100)/100;}
        else if(c.key==="maritimo_blanco"){acc.cost_maritimo_int_total_usd=Math.round(c.total*100)/100;acc.cost_maritimo_int_real_usd=Math.round(c.real*100)/100;}
        return acc;
      },{});
      const reqExp=request?.expires_at?String(request.expires_at).slice(0,10):null;
      const expDate=reqExp&&new Date(reqExp)>new Date()?reqExp:new Date(Date.now()+7*86400000).toISOString().slice(0,10);
      const body={request_id:requestId,honorarios_pct:honorariosPct?Number(honorariosPct):0,supplier_deposit_pct:supplierDepositPct?Number(supplierDepositPct):null,delivery_zone:deliveryZone||null,payment_plan:paymentPlan,...ch,status:"sent",sent_at:new Date().toISOString(),expires_at:expDate};
      let quoteId, publicToken;
      if(draftQuoteId){
        const updated=await dq("gi_quotes",{method:"PATCH",token,filters:`?id=eq.${draftQuoteId}`,body});
        quoteId=draftQuoteId;
        publicToken=Array.isArray(updated)?updated[0]?.public_token:updated?.public_token;
        await dq("gi_quote_products",{method:"DELETE",token,filters:`?quote_id=eq.${quoteId}`});
      } else {
        const inserted=await dq("gi_quotes",{method:"POST",token,body});
        quoteId=Array.isArray(inserted)?inserted[0]?.id:inserted?.id;
        publicToken=Array.isArray(inserted)?inserted[0]?.public_token:inserted?.public_token;
      }
      if(!quoteId)throw new Error("No se pudo guardar la cotización");
      if(request&&request.origin!==origin)await dq("gi_quote_requests",{method:"PATCH",token,filters:`?id=eq.${requestId}`,body:{origin}});
      for(let i=0;i<products.length;i++)await insertarProducto({...productoBody(products[i],origin,i),quantity:Number(products[i].quantity)||0,unit_cost_usd:Number(products[i].unit_cost_usd)||0});
      await guardarBultos(quoteId);
      await dq("gi_quote_requests",{method:"PATCH",token,filters:`?id=eq.${requestId}`,body:{status:"quoted"}});
      try{
        await dq("gi_quote_communications",{method:"POST",token,body:{quote_id:quoteId,request_id:requestId,type:draftQuoteId?"link_regenerated":"link_generated",author_id:profileId||null,meta:{public_token:publicToken,honorarios_pct:Number(honorariosPct||0)}}});
      }catch(e){console.warn("comm log failed",e);}
      setGeneratedQuote({id:quoteId,public_token:publicToken});
      setStep(3);
      flash("Cotización generada");
    } catch(e){
      alertDialog("Error: "+e.message);
    } finally {
      setSaving(false);
    }
  };

  if(lo)return <div style={{color:C.mute,padding:20}}>Cargando cotizador…</div>;
  if(!request)return <div style={{color:C.mute,padding:20}}>Solicitud no encontrada</div>;
  if(step===3)return <CotizacionLista generatedQuote={generatedQuote} client={client} request={request} onBack={onBack}/>;
  const cn=client?`${client.first_name||""} ${client.last_name||""}`.trim():"—";
  const faltante=validateStep1();
  const masBarato=visibleChannels.filter(c=>!c.error&&c.total>0).sort((a,b)=>a.total-b.total)[0];
  const generar=()=>{if(faltante){alertDialog(faltante);return;}generateLink();};
  return <CotizadorPantalla
    request={request} cn={cn} lastSavedAt={lastSavedAt} savingDraft={savingDraft} dirty={dirty} onSave={()=>saveDraft({})} onBack={async()=>{await saveDraft({silent:true});onBack();}}
    origin={origin} setOrigin={setOrigin}
    products={products} onUpdate={updateProduct} onAdd={addProduct} onRemove={removeProduct} onClassify={classifyNcm} token={token}
    packages={packages} setPackages={setPackages}
    totalFob={totalFob} visibleChannels={visibleChannels} someUSA={someUSA} honorariosPct={honorariosPct} setHonorariosPct={setHonorariosPct}
    paymentPlan={paymentPlan} setPaymentPlan={setPaymentPlan} supplierDepositPct={supplierDepositPct} setSupplierDepositPct={setSupplierDepositPct}
    desglose={(i)=>desgloseItem({products,packages,origin,productIdx:i,visibleChannels,tariffs,config,client,totalFob})}
    verGanancia={verGanancia} faltante={faltante} masBarato={masBarato} saving={saving} onGenerar={generar} yaEnviada={!!draftQuoteId&&lastSentStatus!=="draft"}/>;
}

// Desglose impositivo de un producto por canal A, igual que lib/calc.js. El flete certificado se
// reparte según los bultos en que viaja cada producto (si un bulto lleva varios, por FOB entre ellos).
function desgloseItem({products,packages,origin,productIdx,visibleChannels,tariffs,config,client,totalFob}){
    const out={};
    if(!visibleChannels||!tariffs)return out;
    const p=products[productIdx];
    const itemFob=Number(p.unit_cost_usd||0)*Number(p.quantity||0);
    if(itemFob<=0)return out;
    const pct=totalFob>0?itemFob/totalFob:1;
    const fobDe=(i)=>Number(products[i]?.unit_cost_usd||0)*Number(products[i]?.quantity||0);
    let pf=0,totCBM=0,totGW=0;
    packages.forEach(k=>{
      if(!(Number(k.count)>0)||!k.l)return;
      const q=Number(k.count||1),gw=Number(k.kg||0),l=Number(k.l||0),w=Number(k.w||0),h=Number(k.h||0);
      pf+=Math.max(gw*q,l&&w&&h?((l*w*h)/5000)*q:0);
      totGW+=gw*q;
      totCBM+=l&&w&&h?((l*w*h)/1000000)*q:0;
    });
    // Parte del flete que le toca a este producto según sus bultos.
    const shareDe=(isAereo)=>{
      let tot=0,mio=0;
      packages.forEach(k=>{
        const q=Number(k.count||0),gw=Number(k.kg||0),l=Number(k.l||0),w=Number(k.w||0),h=Number(k.h||0);
        const amt=isAereo?Math.max(gw*q,l&&w&&h?((l*w*h)/5000)*q:0):(l&&w&&h?((l*w*h)/1e6)*q:0);
        if(amt<=0)return;
        const idxs=k.prods.length?k.prods:products.map((_,i)=>i);
        const sumF=idxs.reduce((s,i)=>s+fobDe(i),0);
        const peso=idxs.includes(productIdx)?(sumF>0?fobDe(productIdx)/sumF:1/idxs.length):0;
        tot+=amt;mio+=amt*peso;
      });
      return tot>0?mio/tot:pct;
    };
    const floorInputs=products.map(x=>({unit_price:Number(x.unit_cost_usd||0),quantity:Number(x.quantity||0),ncm_code:x.ncm_code}));
    const floored=applyAntidumpingFloor(floorInputs,config);
    const totalFobAllTax=floored.reduce((s,f)=>s+f.unit_price*f.quantity,0);
    const itemFobTax=floored[productIdx].unit_price*Number(p.quantity||0);
    const isRI=client?.tax_condition==="responsable_inscripto";
    visibleChannels.forEach(ch=>{
      const isBlanco=ch.key?.includes("blanco");
      if(!isBlanco){out[ch.key]={fob:itemFob,die:0,te:0,iva:0,desemb:0,ivaAdic:0,iigg:0,iibb:0,total:0,notBlanco:true};return;}
      const isAereo=ch.key?.includes("aereo");
      const isMaritimo=ch.key?.includes("maritimo");
      const certRate=isAereo?(isRI?(config.cert_flete_aereo_real||2.5):(config.cert_flete_aereo_ficticio||3.5)):(config.cert_flete_maritimo_ficticio||100);
      const certFlAmt=isAereo?(isRI?totGW*certRate:pf*certRate):totCBM*certRate;
      const segTotal=(totalFobAllTax+certFlAmt)*0.01;
      const cifTotal=totalFobAllTax+certFlAmt+segTotal;
      const iCert=certFlAmt*shareDe(isAereo);
      const iSeg=(itemFobTax+iCert)*0.01;
      const iCif=itemFobTax+iCert+iSeg;
      const dr=p.import_duty_rate===""||p.import_duty_rate==null?0:Number(p.import_duty_rate)/100;
      const te=p.statistics_rate===""||p.statistics_rate==null?0:Number(p.statistics_rate)/100;
      const ivaR=p.iva_rate===""||p.iva_rate==null?0.21:Number(p.iva_rate)/100;
      const die=iCif*dr;const tasa=iCif*te;const bi=iCif+die+tasa;const iva=bi*ivaR;
      let total=die+tasa+iva;let desemb=0,ivaAdic=0,iigg=0,iibb=0;
      if(isMaritimo){
        const ivaAdR=tasaODefault(p.iva_additional_rate,TASA_IVA_ADICIONAL);
        const iiggR=tasaODefault(p.iigg_rate,TASA_IIGG);
        const iibbR=tasaODefault(p.iibb_rate,TASA_IIBB);
        ivaAdic=bi*ivaAdR;iigg=bi*iiggR;iibb=bi*iibbR;total+=ivaAdic+iigg+iibb;
      } else {
        const tbl=tablaDesaduanaje(Date.now());
        let d=120;for(const [m,a] of tbl){if(cifTotal<m){d=a;break;}}
        desemb=(d*pct)*1.21;total+=desemb;
      }
      out[ch.key]={fob:itemFob,certFl:iCert,seguro:iSeg,cif:iCif,die,te:tasa,iva,desemb,ivaAdic,iigg,iibb,total};
    });
    return out;
  }

// ────────────────────────────────────────────
// PANTALLA DEL COTIZADOR (20/10/2026): origen arriba, productos y bultos a la izquierda, resumen a la derecha.
// ────────────────────────────────────────────
const n2=(v)=>Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
const soloNum=(v,dec)=>dec?v.replace(/[^0-9.]/g,""):v.replace(/[^0-9]/g,"");
// Enter pasa al siguiente campo marcado con data-nav (en el orden en que están en pantalla).
const navEnter=(e)=>{if(e.key!=="Enter")return;e.preventDefault();const all=[...document.querySelectorAll('input[data-nav="1"]')];const i=all.indexOf(e.currentTarget);const nx=all[i+1];if(nx){nx.focus();try{nx.select();}catch{}}};

function CotizadorPantalla(p){
  const movil=useMovil(980);
  const totalBultos=p.packages.reduce((s,k)=>s+Number(k.count||0),0);
  let cbm=0,kg=0;p.packages.forEach(k=>{const c=Number(k.count||0);cbm+=(Number(k.l||0)*Number(k.w||0)*Number(k.h||0)*c)/1e6;kg+=Number(k.kg||0)*c;});
  const estado=p.savingDraft?["Guardando…",C.mute]:p.dirty?["Cambios sin guardar",C.amber]:p.lastSavedAt?[`Guardado ${hace(p.lastSavedAt)}`,C.green]:["Sin guardar",C.mute];
  return <div style={{paddingBottom:movil?90:0}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
      <Volver onClick={p.onBack}/>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,color:estado[1]}}><span style={{width:7,height:7,borderRadius:"50%",background:estado[1],display:"inline-block"}}/>{estado[0]}</span>
        <Btn v="gold" small onClick={p.onSave} disabled={p.savingDraft}>Guardar</Btn>
      </div>
    </div>
    <Titulo eyebrow={`Cotización ${p.request.request_code}`} sub="Elegí el origen, cargá los productos y los bultos en que viajan. A la derecha ves el precio por canal, ajustás los honorarios y el plan de pagos, y generás el link. Se guarda solo.">{p.cn}</Titulo>
    <div style={{display:"grid",gridTemplateColumns:movil?"1fr":"minmax(0,1fr) 380px",gap:16,alignItems:"start"}}>
      <div>
        <OrigenCard origin={p.origin} setOrigin={p.setOrigin}/>
        {p.products.map((x,i)=><ProductoCard key={i} i={i} p={x} total={p.products.length} origin={p.origin} onUpdate={p.onUpdate} onRemove={p.onRemove} onClassify={p.onClassify} token={p.token} desglose={p.desglose}/>)}
        <button onClick={p.onAdd} style={{width:"100%",padding:"14px",borderRadius:14,border:`1.5px dashed ${C.lineHi}`,background:"transparent",color:C.sub,fontSize:13.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:12}}>+ Agregar producto</button>
        <BultosCard packages={p.packages} setPackages={p.setPackages} products={p.products}/>
      </div>
      <div style={{position:movil?"static":"sticky",top:20}}>
        <Resumen {...p} movil={movil} totalBultos={totalBultos} cbm={cbm} kg={kg}/>
      </div>
    </div>
    {movil&&<div style={{position:"fixed",left:0,right:0,bottom:0,zIndex:30,padding:"10px 16px calc(10px + env(safe-area-inset-bottom))",background:"rgba(10,22,40,0.97)",borderTop:`1px solid ${C.line}`,display:"flex",alignItems:"center",gap:12}}>
      <div style={{flex:1,minWidth:0}}>
        <p style={{margin:0,fontSize:10.5,color:C.mute,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Desde</p>
        <p style={{margin:0,fontSize:17,fontWeight:800,color:C.goldHi,fontVariantNumeric:"tabular-nums"}}>{p.masBarato?fmtUSD(p.masBarato.total):"—"}</p>
      </div>
      <Btn v="gold" onClick={p.onGenerar} disabled={p.saving}>{p.saving?"Generando…":p.yaEnviada?"Actualizar link":"Generar link"}</Btn>
    </div>}
  </div>;
}

function OrigenCard({origin,setOrigin}){
  const ops=[["china","🇨🇳","China","Aéreo, marítimo LCL/FCL e integral"],["usa","🇺🇸","Estados Unidos","Aéreo (con NCM) y marítimo integral"]];
  return <section style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:14,marginBottom:12}}>
    <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:C.mute,textTransform:"uppercase",letterSpacing:"0.1em"}}>Origen de la cotización</p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      {ops.map(([k,ico,l,d])=>{const on=origin===k;return <button key={k} type="button" onClick={()=>setOrigin(k)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,cursor:"pointer",fontFamily:"inherit",textAlign:"left",border:`2px solid ${on?C.gold:C.line}`,background:on?C.goldBg:"rgba(0,0,0,0.15)",transition:"all 120ms"}}>
        <span style={{fontSize:30,lineHeight:1}}>{ico}</span>
        <span style={{minWidth:0}}><span style={{display:"block",fontSize:15,fontWeight:800,color:on?C.goldHi:C.txt}}>{l}</span><span style={{display:"block",fontSize:11.5,color:C.mute,marginTop:2}}>{d}</span></span>
        {on&&<span style={{marginLeft:"auto",fontSize:18,color:C.goldHi}}>✓</span>}
      </button>;})}
    </div>
  </section>;
}

function ProductoCard({i,p,total,origin,onUpdate,onRemove,onClassify,token,desglose}){
  const [verImp,setVerImp]=useState(false);
  const [editNcm,setEditNcm]=useState(false);
  const [foto,setFoto]=useState(null); // null | "nueva" | índice de foto a reemplazar/quitar
  const u=(k)=>(v)=>onUpdate(i,k,v);
  const sub=Number(p.unit_cost_usd||0)*Number(p.quantity||0);
  const bd=verImp?desglose(i):{};
  const blancos=Object.entries(bd).filter(([,v])=>!v.notBlanco);
  const lbl={fontSize:10.5,fontWeight:800,color:C.mute,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:5};
  const box={...inp,padding:"9px 11px",fontSize:13.5};
  const fotos=p.photo_urls||[];
  return <section style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:16,marginBottom:12}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <span style={{fontSize:11,fontWeight:800,color:C.gold,letterSpacing:"0.08em"}}>PRODUCTO {i+1}</span>
      {sub>0&&<span style={{fontSize:12,fontWeight:800,color:C.sub,fontVariantNumeric:"tabular-nums"}}>· FOB {fmtUSD(sub)}</span>}
      {total>1&&<button type="button" onClick={()=>onRemove(i)} aria-label="Quitar producto" style={{marginLeft:"auto",width:28,height:28,borderRadius:8,border:`1px solid ${C.line}`,background:"transparent",color:C.mute,cursor:"pointer"}}>✕</button>}
    </div>
    <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,width:fotos.length?Math.min(fotos.length+1,3)*60:84,flexShrink:0}}>
        {fotos.map((url,k)=><button key={k} type="button" onClick={()=>setFoto(k)} title="Cambiar o quitar" style={{width:54,height:54,borderRadius:10,border:`1px solid ${C.line}`,background:"#000",cursor:"pointer",overflow:"hidden",padding:0}}><img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></button>)}
        <button type="button" onClick={()=>setFoto("nueva")} style={{width:fotos.length?54:84,height:fotos.length?54:84,borderRadius:10,border:`1.5px dashed ${C.lineHi}`,background:"rgba(0,0,0,0.2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}><span style={{fontSize:fotos.length?18:11,color:C.mute,fontWeight:700,lineHeight:1.3,textAlign:"center"}}>{fotos.length?"+":<>📷<br/>Fotos</>}</span></button>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <input data-nav="1" onKeyDown={navEnter} value={p.description} onChange={e=>u("description")(e.target.value)} placeholder="Qué es (ej: perfil de aluminio anodizado 6 m)" style={{...box,fontSize:15,fontWeight:700}}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginTop:10}}>
          <label><span style={lbl}>Cantidad</span><input data-nav="1" onKeyDown={navEnter} inputMode="numeric" value={p.quantity} onChange={e=>u("quantity")(soloNum(e.target.value))} style={box}/></label>
          <label><span style={lbl}>Costo unit. USD</span><input data-nav="1" onKeyDown={navEnter} inputMode="decimal" value={p.unit_cost_usd} onChange={e=>u("unit_cost_usd")(soloNum(e.target.value,true))} style={box}/></label>
          <label><span style={lbl}>Producción (días)</span><input data-nav="1" onKeyDown={navEnter} inputMode="numeric" value={p.lead_time_days} onChange={e=>u("lead_time_days")(soloNum(e.target.value))} style={box}/></label>
        </div>
        <label style={{display:"block",marginTop:10}}><span style={lbl}>Proveedor (link, nombre o WeChat)</span><input data-nav="1" onKeyDown={navEnter} value={p.supplier_ref||""} onChange={e=>u("supplier_ref")(e.target.value)} placeholder="https://…alibaba.com/…" style={box}/></label>
      </div>
    </div>

    {/* Posición arancelaria: siempre (desde USA el aéreo también la necesita). Editable a mano y con sugerencia. */}
    <div style={{marginTop:12,padding:"11px 12px",borderRadius:12,background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.2)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:180}}>
          {p.ncm_code?<>
            <p style={{margin:0,fontSize:13,fontWeight:700}}><span style={{fontFamily:MONO,color:C.blue}}>{p.ncm_code}</span>{p.ncm_description?<span style={{color:C.sub,fontWeight:500}}> · {p.ncm_description}</span>:null}</p>
            <p style={{margin:"4px 0 0",fontSize:12,color:C.sub}}>DI {p.import_duty_rate||0}% · Tasa {p.statistics_rate||0}% · IVA {p.iva_rate||0}%</p>
          </>:<p style={{margin:0,fontSize:12.5,color:p.ncm_error?C.amber:C.sub}}>{p.ncm_error?"No se pudo clasificar: cargá la posición y los aranceles a mano.":"Sin posición arancelaria todavía."}</p>}
        </div>
        <Btn small onClick={()=>onClassify(i)} disabled={(!p.description?.trim()&&!fotos.length)||p.ncm_loading}>{p.ncm_loading?"Clasificando…":p.ncm_code?"Reclasificar":"Clasificar con IA"}</Btn>
        <Btn small v="ghost" onClick={()=>setEditNcm(v=>!v)}>{editNcm?"Listo":"Editar"}</Btn>
      </div>
      {(editNcm||p.ncm_error)&&<>
        <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr",gap:8,marginTop:10}}>
          <label><span style={lbl}>NCM</span><input value={p.ncm_code} onChange={e=>u("ncm_code")(e.target.value)} placeholder="0000.00.00" style={{...box,fontFamily:MONO}}/></label>
          <label><span style={lbl}>DI %</span><input inputMode="decimal" value={p.import_duty_rate} onChange={e=>u("import_duty_rate")(soloNum(e.target.value,true))} style={box}/></label>
          <label><span style={lbl}>Tasa %</span><input inputMode="decimal" value={p.statistics_rate} onChange={e=>u("statistics_rate")(soloNum(e.target.value,true))} style={box}/></label>
          <label><span style={lbl}>IVA %</span><input inputMode="decimal" value={p.iva_rate} onChange={e=>u("iva_rate")(soloNum(e.target.value,true))} style={box}/></label>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"flex-end",marginTop:8,flexWrap:"wrap"}}>
          <label style={{flex:"1 1 200px"}}><span style={lbl}>Sugerir posición (la IA completa las alícuotas)</span><input value={p.ncm_hint||""} onChange={e=>u("ncm_hint")(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&p.ncm_hint)onClassify(i,p.ncm_hint);}} placeholder="Ej: 7604.21 o 760421" style={{...box,fontFamily:MONO}}/></label>
          <Btn small onClick={()=>onClassify(i,p.ncm_hint)} disabled={!p.ncm_hint||p.ncm_loading}>Usar esta posición</Btn>
        </div>
      </>}
    </div>

    {sub>0&&<div style={{marginTop:12}}>
      <button type="button" onClick={()=>setVerImp(v=>!v)} style={{background:"none",border:"none",color:C.blue,fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:"inherit",padding:0}}>{verImp?"Ocultar impuestos":"Ver impuestos de este producto"}</button>
      {verImp&&blancos.length>0&&<div style={{display:"grid",gridTemplateColumns:`repeat(${blancos.length},minmax(0,1fr))`,gap:8,marginTop:8}}>
        {blancos.map(([k,v])=><div key={k} style={{padding:"10px 12px",borderRadius:10,background:"rgba(0,0,0,0.2)",fontSize:12,fontVariantNumeric:"tabular-nums"}}>
          <p style={{margin:"0 0 6px",fontWeight:800,color:C.blue,fontSize:11.5}}>{k==="aereo_blanco"?"Aéreo":"Marítimo LCL/FCL"}</p>
          {[["CIF",v.cif],["Derechos",v.die],["Tasa",v.te],["IVA",v.iva],["Desaduanaje",v.desemb],["IVA adic.",v.ivaAdic],["Ganancias",v.iigg],["IIBB",v.iibb]].filter(([,x])=>x>0).map(([l,x])=><div key={l} style={{display:"flex",justifyContent:"space-between",color:C.sub}}><span>{l}</span><span>{n2(x)}</span></div>)}
          <div style={{display:"flex",justifyContent:"space-between",marginTop:5,paddingTop:5,borderTop:`1px solid ${C.line}`,fontWeight:800}}><span>Impuestos</span><span>USD {n2(v.total)}</span></div>
        </div>)}
      </div>}
      {verImp&&blancos.length===0&&<p style={{margin:"6px 0 0",fontSize:12,color:C.mute}}>Los impuestos se ven una vez cargados los bultos.</p>}
    </div>}
    {foto!==null&&<PhotoUploadModal token={token} multiple onCancel={()=>setFoto(null)} onUploaded={urls=>{const nuevas=Array.isArray(urls)?urls:[urls];u("photo_urls")(foto==="nueva"?[...fotos,...nuevas]:fotos.map((x,k)=>k===foto?nuevas[0]:x).concat(nuevas.slice(1)));setFoto(null);}} onQuitar={foto!=="nueva"?()=>{u("photo_urls")(fotos.filter((_,k)=>k!==foto));setFoto(null);}:null}/>}
  </section>;
}

// Bultos de la cotización: cuántas cajas, medidas, peso y qué productos van adentro.
function BultosCard({packages,setPackages,products}){
  const lbl={fontSize:9.5,fontWeight:800,color:C.mute,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:5};
  const box={...inp,padding:"9px 11px",fontSize:13.5};
  const up=(i,k,v)=>setPackages(ks=>ks.map((x,j)=>j===i?{...x,[k]:v}:x));
  const add=()=>setPackages(ks=>[...ks,{count:"1",l:"",w:"",h:"",kg:"",prods:products.length===1?[0]:[]}]);
  const del=(i)=>setPackages(ks=>ks.filter((_,j)=>j!==i));
  const toggleProd=(i,idx)=>setPackages(ks=>ks.map((x,j)=>j===i?{...x,prods:x.prods.includes(idx)?x.prods.filter(y=>y!==idx):[...x.prods,idx].sort((a,b)=>a-b)}:x));
  const nombre=(idx)=>{const d=(products[idx]?.description||"").trim();return d?(d.length>26?d.slice(0,24)+"…":d):`Producto ${idx+1}`;};
  let cbm=0,kg=0,volAer=0,n=0;packages.forEach(k=>{const c=Number(k.count||0),L=Number(k.l||0),W=Number(k.w||0),H=Number(k.h||0),g=Number(k.kg||0);n+=c;cbm+=(L*W*H*c)/1e6;kg+=g*c;volAer+=(L*W*H*c)/5000;});
  const sinBulto=products.map((_,i)=>i).filter(i=>!packages.some(k=>(k.prods.length?k.prods:products.map((_,j)=>j)).includes(i)));
  return <section style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:16,marginBottom:12}}>
    <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:10,flexWrap:"wrap"}}>
      <span style={{fontSize:11,fontWeight:800,color:C.gold,letterSpacing:"0.08em"}}>BULTOS</span>
      <span style={{fontSize:12,color:C.sub}}>Cómo viaja la mercadería: cada caja, sus medidas y qué productos lleva.</span>
    </div>
    {packages.length===0&&<p style={{margin:"0 0 10px",fontSize:12.5,color:C.amber}}>Todavía no cargaste ningún bulto.</p>}
    {packages.map((k,i)=><div key={i} style={{padding:"12px 12px 10px",borderRadius:12,border:`1px solid ${C.line}`,background:"rgba(0,0,0,0.15)",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <span style={{fontSize:11,fontWeight:800,color:C.sub,letterSpacing:"0.06em"}}>BULTO {i+1}</span>
        <button type="button" onClick={()=>del(i)} aria-label="Quitar bulto" style={{marginLeft:"auto",width:26,height:26,borderRadius:7,border:`1px solid ${C.line}`,background:"transparent",color:C.mute,cursor:"pointer"}}>✕</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"0.8fr 1fr 1fr 1fr 1fr",gap:8}}>
        <label><span style={lbl}>Cant.</span><input data-nav="1" onKeyDown={navEnter} inputMode="numeric" value={k.count} onChange={e=>up(i,"count",soloNum(e.target.value))} style={box}/></label>
        <label><span style={lbl}>Largo cm</span><input data-nav="1" onKeyDown={navEnter} inputMode="decimal" value={k.l} onChange={e=>up(i,"l",soloNum(e.target.value,true))} style={box}/></label>
        <label><span style={lbl}>Ancho cm</span><input data-nav="1" onKeyDown={navEnter} inputMode="decimal" value={k.w} onChange={e=>up(i,"w",soloNum(e.target.value,true))} style={box}/></label>
        <label><span style={lbl}>Alto cm</span><input data-nav="1" onKeyDown={navEnter} inputMode="decimal" value={k.h} onChange={e=>up(i,"h",soloNum(e.target.value,true))} style={box}/></label>
        <label><span style={lbl}>Kg c/u</span><input data-nav="1" onKeyDown={navEnter} inputMode="decimal" value={k.kg} onChange={e=>up(i,"kg",soloNum(e.target.value,true))} style={box}/></label>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:8}}>
        <span style={{...lbl,marginBottom:0,marginRight:4}}>Lleva</span>
        {products.map((_,idx)=>{const on=k.prods.includes(idx);return <button key={idx} type="button" onClick={()=>toggleProd(i,idx)} style={{padding:"5px 10px",borderRadius:999,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",border:`1px solid ${on?C.gold:C.line}`,background:on?C.goldBg:"transparent",color:on?C.goldHi:C.sub}}>{on?"✓ ":""}{nombre(idx)}</button>;})}
        {k.prods.length===0&&products.length>1&&<span style={{fontSize:11.5,color:C.amber}}>Marcá qué productos van en este bulto</span>}
      </div>
    </div>)}
    <button type="button" onClick={add} style={{width:"100%",padding:"11px",borderRadius:12,border:`1.5px dashed ${C.lineHi}`,background:"transparent",color:C.sub,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar bulto</button>
    {n>0&&<div style={{display:"flex",flexWrap:"wrap",gap:"4px 14px",marginTop:10,fontSize:12,color:C.sub,fontVariantNumeric:"tabular-nums"}}>
      <span><strong style={{color:C.txt}}>{n}</strong> bulto{n!==1?"s":""}</span>
      <span><strong style={{color:C.txt}}>{cbm.toFixed(3)}</strong> m³</span>
      <span><strong style={{color:C.txt}}>{n2(kg)}</strong> kg reales</span>
      <span>aéreo factura <strong style={{color:C.green}}>{n2(Math.max(kg,volAer))}</strong> kg</span>
      {sinBulto.length>0&&<span style={{color:C.amber}}>Sin bulto: {sinBulto.map(i=>nombre(i)).join(", ")}</span>}
    </div>}
  </section>;
}

function Resumen(p){
  const canales=p.visibleChannels;
  const validos=canales.filter(c=>!c.error&&c.total>0);
  const menor=validos.length?Math.min(...validos.map(c=>c.total)):0;
  const sec={background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:16,marginBottom:12};
  const tit={margin:"0 0 10px",fontSize:11,fontWeight:800,color:C.mute,textTransform:"uppercase",letterSpacing:"0.1em"};
  return <div>
    <section style={sec}>
      <p style={tit}>Carga</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <Dato label="FOB" val={usd0(p.totalFob)}/>
        <Dato label="Bultos" val={String(p.totalBultos||0)} sub={`${p.cbm.toFixed(2)} m³`}/>
        <Dato label="Peso" val={`${Math.round(p.kg)} kg`}/>
      </div>
    </section>
    <section style={sec}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <p style={{...tit,margin:0}}>Honorarios GI</p>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input inputMode="decimal" value={p.honorariosPct} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))p.setHonorariosPct(v);}} style={{...inp,width:64,padding:"7px 8px",textAlign:"center",fontSize:16,fontWeight:800,color:C.goldHi}}/>
          <span style={{fontWeight:800,color:C.goldHi}}>%</span>
        </div>
      </div>
      <div style={{display:"flex",gap:6}}>{[5,10,15,20,25].map(v=><button key={v} type="button" onClick={()=>p.setHonorariosPct(String(v))} style={{flex:1,padding:"6px 0",borderRadius:8,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",border:`1px solid ${Number(p.honorariosPct)===v?C.gold:C.line}`,background:Number(p.honorariosPct)===v?C.goldBg:"transparent",color:Number(p.honorariosPct)===v?C.goldHi:C.sub}}>{v}%</button>)}</div>
    </section>
    <section style={sec}>
      <p style={tit}>Precio final al cliente{p.someUSA?" · origen USA":""}</p>
      {canales.length===0||p.totalFob<=0?<p style={{margin:0,color:C.mute,fontSize:13}}>Cargá cantidad y costo para ver precios.</p>:canales.map(c=><div key={c.key} style={{padding:"11px 12px",borderRadius:12,border:`1px solid ${c.total===menor&&!c.error?"rgba(52,211,153,0.35)":C.line}`,background:c.total===menor&&!c.error?"rgba(52,211,153,0.06)":"rgba(0,0,0,0.15)",marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
          <div style={{minWidth:0}}><p style={{margin:0,fontWeight:800,fontSize:13.5}}>{c.name}</p><p style={{margin:"2px 0 0",fontSize:11.5,color:C.mute}}>{c.time}</p></div>
          <p style={{margin:0,fontSize:19,fontWeight:900,color:c.error?C.red:C.goldHi,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{c.error?"sin tarifa":usd0(c.total)}</p>
        </div>
        {!c.error&&<div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:6,fontSize:11.5,color:C.mute,fontVariantNumeric:"tabular-nums",flexWrap:"wrap"}}>
          <span>impo {usd0(c.impoOnly)} + honorarios {usd0(c.honorariosUsd)}</span>
          {p.verGanancia&&<span style={{color:C.green,fontWeight:700}}>gana {usd0(c.gainTotal)}</span>}
        </div>}
      </div>)}
    </section>
    <PlanPagos {...p} validos={validos}/>
    {!p.movil&&<>
      {p.faltante&&<p style={{margin:"0 0 10px",fontSize:12.5,color:C.amber}}>{p.faltante}</p>}
      <Btn v="gold" full onClick={p.onGenerar} disabled={p.saving} style={{padding:"13px 16px",fontSize:14}}>{p.saving?"Generando…":p.yaEnviada?"Actualizar link de la cotización":"Generar link para el cliente"}</Btn>
    </>}
  </div>;
}

function PlanPagos({paymentPlan,setPaymentPlan,supplierDepositPct,setSupplierDepositPct,totalFob,validos}){
  const supDep=Math.max(0,Math.min(100,Number(supplierDepositPct||0)))/100;
  const ratio=validos.length?Math.max(...validos.map(c=>totalFob/c.total*100)):0;
  const min1=Math.ceil(ratio*supDep),min12=Math.ceil(ratio);
  const s1=Number(paymentPlan?.[0]?.pct||0),s12=s1+Number(paymentPlan?.[1]?.pct||0);
  const suma=paymentPlan.reduce((s,x)=>s+Number(x.pct||0),0);
  const ajustar=()=>{if(min12<=0||min12>=100)return;setPaymentPlan(pl=>{const b=pl.length>=3?pl:[{pct:30,label:"Inicio de producción"},{pct:20,label:"Producción terminada"},{pct:50,label:"Contra entrega"}];const nx=[...b];nx[0]={...nx[0],pct:min1};nx[1]={...nx[1],pct:Math.max(0,min12-min1)};nx[2]={...nx[2],pct:100-min1-Math.max(0,min12-min1)};for(let i=3;i<nx.length;i++)nx[i]={...nx[i],pct:0};return nx;});};
  const cubre1=s1>=min1,cubre12=s12>=min12;
  return <section style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,padding:16,marginBottom:12}}>
    <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:C.mute,textTransform:"uppercase",letterSpacing:"0.1em"}}>Plan de pagos del cliente</p>
    {paymentPlan.map((st,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
      <input inputMode="numeric" value={st.pct} onChange={e=>{const nv=Number(e.target.value.replace(/[^0-9]/g,""))||0;setPaymentPlan(pl=>pl.map((x,j)=>j===i?{...x,pct:Math.min(100,nv)}:x));}} style={{...inp,width:56,padding:"7px 6px",textAlign:"center",fontWeight:800,borderColor:(i===0&&!cubre1)||(i===1&&!cubre12)?"rgba(248,113,113,0.5)":C.lineHi}}/>
      <span style={{fontWeight:800,color:C.sub}}>%</span>
      <input value={st.label} onChange={e=>setPaymentPlan(pl=>pl.map((x,j)=>j===i?{...x,label:e.target.value}:x))} style={{...inp,padding:"7px 10px",fontSize:13}}/>
    </div>)}
    <p style={{margin:"6px 0 0",fontSize:12,color:suma===100?C.mute:C.amber}}>Suma {suma}%{suma!==100?" · tiene que dar 100%":""}</p>
    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:12,paddingTop:12,borderTop:`1px solid ${C.line}`}}>
      <span style={{fontSize:12.5,color:C.sub,flex:1}}>Anticipo al proveedor</span>
      <input inputMode="numeric" value={supplierDepositPct} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");if(v===""||Number(v)<=100)setSupplierDepositPct(v);}} style={{...inp,width:56,padding:"6px",textAlign:"center",fontWeight:800}}/>
      <span style={{fontWeight:800,color:C.sub}}>%</span>
    </div>
    {validos.length>0&&<div style={{marginTop:10,fontSize:12,lineHeight:1.6}}>
      <p style={{margin:0,color:cubre1?C.green:C.red}}>{cubre1?"✓":"✕"} El 1.º pago cubre el anticipo al proveedor ({fmtUSD(totalFob*supDep)}) · mínimo {min1}%</p>
      <p style={{margin:0,color:cubre12?C.green:C.red}}>{cubre12?"✓":"✕"} 1.º + 2.º cubren todo el FOB · mínimo {min12}%</p>
      {(!cubre1||!cubre12)&&min12<100&&<button type="button" onClick={ajustar} style={{marginTop:6,background:"none",border:"none",color:C.blue,fontWeight:800,cursor:"pointer",fontFamily:"inherit",padding:0,fontSize:12.5}}>Ajustar al mínimo seguro</button>}
    </div>}
  </section>;
}

function CotizacionLista({generatedQuote,client,request,onBack}){
  if(!generatedQuote)return null;
  const url=`${window.location.origin}/cotizacion/${generatedQuote.public_token}`;
  const num=cleanWaNumber(client?.whatsapp&&client.whatsapp!=="—"?client.whatsapp:"");
  const msg=encodeURIComponent(buildQuoteWaMessage({firstName:client?.first_name||"",code:request?.request_code||"",url,expiresAt:request?.expires_at}));
  const copiar=async()=>{try{await navigator.clipboard.writeText(url);toast.success("Link copiado");}catch{toast.info(url);}};
  return <div style={{maxWidth:560,margin:"30px auto",textAlign:"center",padding:"30px 22px",background:C.card,border:"1px solid rgba(52,211,153,0.3)",borderRadius:18}}>
    <div style={{width:56,height:56,borderRadius:"50%",margin:"0 auto 12px",background:"linear-gradient(135deg,#22c55e,#16a34a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,color:"#fff"}}>✓</div>
    <h2 style={{margin:"0 0 6px",fontSize:21,fontWeight:800}}>Cotización lista</h2>
    <p style={{margin:"0 0 18px",color:C.sub,fontSize:13.5}}>{request?.request_code} · {client?`${client.first_name||""} ${client.last_name||""}`.trim():""}</p>
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"rgba(0,0,0,0.3)",border:`1px solid ${C.line}`,borderRadius:10,marginBottom:14}}>
      <span style={{flex:1,fontFamily:MONO,fontSize:12,color:C.goldHi,textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</span>
      <Btn small onClick={copiar}>Copiar</Btn>
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
      <Btn v="wa" onClick={()=>window.open(num?`https://wa.me/${num}?text=${msg}`:`https://wa.me/?text=${msg}`,"_blank","noopener")}>💬 Mandar por WhatsApp</Btn>
      <Btn onClick={onBack}>Ir a la cotización</Btn>
    </div>
  </div>;
}

export function lblStyle(){return {fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:5};}
export function inpStyle(){return {width:"100%",padding:"8px 10px",fontSize:12.5,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,background:"rgba(0,0,0,0.25)",color:"#fff",outline:"none",fontFamily:"inherit"};}
export function Tag({children}){return <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:5,background:"rgba(96,165,250,0.12)",color:"#60a5fa",letterSpacing:"0.04em"}}>{children}</span>;}

// PhotoUpload: thumb + botón cambiar/quitar. Click abre modal con drag/drop/paste/file picker.
export function PhotoUpload({value,onChange,token}){
  const [open,setOpen]=useState(false);
  return <div>
    <label style={lblStyle()}>Foto del producto</label>
    {value?
      <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.12)",background:"#000",height:140,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}} onClick={()=>setOpen(true)} title="Click para cambiar">
        <img src={value} alt="Producto" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>
        <button onClick={e=>{e.stopPropagation();onChange("");}} title="Quitar foto" style={{position:"absolute",top:6,right:6,padding:"5px 8px",fontSize:11,fontWeight:700,borderRadius:6,border:"1px solid rgba(248,113,113,0.5)",background:"rgba(0,0,0,0.7)",color:"#f87171",cursor:"pointer",fontFamily:"inherit"}}>✕</button>
      </div>:
      <button onClick={()=>setOpen(true)} type="button" style={{width:"100%",height:140,border:"2px dashed rgba(255,255,255,0.18)",borderRadius:10,background:"rgba(0,0,0,0.18)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,transition:"all 150ms",fontFamily:"inherit"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.4)";e.currentTarget.style.background="rgba(184,149,106,0.04)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.18)";e.currentTarget.style.background="rgba(0,0,0,0.18)";}}>
        <div style={{fontSize:28,opacity:0.6}}>📷</div>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.65)",fontWeight:600,margin:0,textAlign:"center"}}>Subir foto del producto</p>
      </button>
    }
    {open&&<PhotoUploadModal token={token} onCancel={()=>setOpen(false)} onUploaded={url=>{onChange(Array.isArray(url)?url[0]:url);setOpen(false);}}/>}
  </div>;
}

function PhotoUploadModal({token,onCancel,onUploaded,onQuitar,multiple=false}){
  const [drag,setDrag]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [preview,setPreview]=useState(null);
  // Capturar paste en cualquier parte del modal (document level)
  useEffect(()=>{
    const handler=(e)=>{
      const items=e.clipboardData?.items||[];
      for(const it of items){
        if(it.type.startsWith("image/")){const f=it.getAsFile();if(f){handleFile(f);return;}}
      }
    };
    document.addEventListener("paste",handler);
    return()=>document.removeEventListener("paste",handler);
  },[]);
  // Varias imágenes a la vez (20/10/2026): se suben una por una y se devuelven todas juntas.
  const handleFiles=async(lista)=>{
    const files=Array.from(lista||[]).filter(Boolean).slice(0,multiple?10:1);
    if(!files.length)return;
    for(const f of files){if(!f.type?.startsWith("image/")){alertDialog("Solo imágenes (JPG/PNG/WebP)");return;}if(f.size>10*1024*1024){alertDialog("Máximo 10 MB por imagen");return;}}
    const reader=new FileReader();reader.onload=e=>setPreview(e.target.result);reader.readAsDataURL(files[0]);
    setUploading(true);
    try{
      const urls=[];
      for(const f of files){const url=await uploadProductPhoto(f,token);if(url)urls.push(url);}
      if(urls.length)onUploaded(multiple?urls:urls[0]);
      else{alertDialog("No se pudo subir la imagen");setUploading(false);setPreview(null);}
    } catch(e){alertDialog("Error: "+e.message);setUploading(false);setPreview(null);}
  };
  const handleFile=(f)=>handleFiles(f?[f]:[]);
  const onDrop=(e)=>{e.preventDefault();e.stopPropagation();setDrag(false);handleFiles(e.dataTransfer?.files);};
  const onDragOver=(e)=>{e.preventDefault();e.stopPropagation();if(!drag)setDrag(true);};
  const onDragEnter=(e)=>{e.preventDefault();e.stopPropagation();setDrag(true);};
  const onDragLeave=(e)=>{e.preventDefault();e.stopPropagation();if(e.target===e.currentTarget)setDrag(false);};

  return <div onClick={()=>!uploading&&onCancel()} onDragOver={onDragOver} onDrop={onDrop} style={{position:"fixed",inset:0,background:"rgba(8,12,20,0.85)",backdropFilter:"blur(8px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div onClick={e=>e.stopPropagation()} onDrop={onDrop} onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave} style={{maxWidth:560,width:"100%",background:"linear-gradient(180deg,#142038,#0f1a2e)",border:`2px solid ${drag?"rgba(184,149,106,0.6)":"rgba(255,255,255,0.1)"}`,borderRadius:16,padding:"24px",boxShadow:"0 32px 80px rgba(0,0,0,0.65)",transition:"border-color 150ms"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,paddingBottom:14,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div>
          <h3 style={{fontSize:17,fontWeight:700,color:"#fff",margin:"0 0 3px"}}>{multiple?"Subir fotos del producto":"Subir foto del producto"}</h3>
          <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",margin:0}}>{multiple?"Arrastrá una o varias imágenes, pegá con Cmd+V, o elegí archivos":"Arrastrá una imagen, pegala con Cmd+V, o elegí un archivo"}</p>
        </div>
        <button onClick={()=>!uploading&&onCancel()} disabled={uploading} style={{fontSize:22,background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",cursor:uploading?"not-allowed":"pointer",padding:"0 4px"}}>✕</button>
      </div>

      <div style={{height:300,border:`2px dashed ${drag?"rgba(184,149,106,0.7)":"rgba(255,255,255,0.18)"}`,borderRadius:12,background:drag?"rgba(184,149,106,0.10)":"rgba(0,0,0,0.25)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,transition:"all 150ms",position:"relative",overflow:"hidden"}}>
        {preview?<img src={preview} alt="Preview" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>:
          uploading?<>
            <div style={{fontSize:48}}>⏳</div>
            <p style={{fontSize:13,color:GOLD_LIGHT,fontWeight:600,margin:0}}>Subiendo imagen…</p>
          </>:<>
            <div style={{fontSize:48,opacity:drag?1:0.5}}>{drag?"⬇️":"📷"}</div>
            <p style={{fontSize:14,color:"#fff",fontWeight:700,margin:0,textAlign:"center"}}>{drag?"Soltá la imagen aquí":"Arrastrá una imagen"}</p>
            <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",margin:0,textAlign:"center"}}>O usá uno de los siguientes:</p>
            <div style={{display:"flex",gap:10,marginTop:6}}>
              <label style={{padding:"9px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:"1px solid rgba(184,149,106,0.4)",background:"rgba(184,149,106,0.08)",color:GOLD_LIGHT,cursor:"pointer",fontFamily:"inherit"}}>
                📁 Elegir archivo
                <input type="file" accept="image/*" multiple={multiple} onChange={e=>{handleFiles(e.target.files);e.target.value="";}} style={{display:"none"}}/>
              </label>
              <span style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.6)"}}>⌘V Pegar</span>
              {onQuitar&&<button type="button" onClick={onQuitar} style={{padding:"9px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:"1px solid rgba(248,113,113,0.4)",background:"transparent",color:"#f87171",cursor:"pointer",fontFamily:"inherit"}}>Quitar foto</button>}
            </div>
          </>}
      </div>
    </div>
  </div>;
}

// ────────────────────────────────────────────
// PANE: OPERACIONES GI
// ────────────────────────────────────────────
export const STATUS_MAP={
  pendiente:{l:"Pendiente",c:"#94a3b8"},
  en_deposito_origen:{l:"En depósito",c:"#fbbf24"},
  en_preparacion:{l:"Preparación",c:"#a78bfa"},
  en_transito:{l:"En tránsito",c:"#22d3ee"},
  arribo_argentina:{l:"Arribo AR",c:"#818cf8"},
  en_aduana:{l:"Aduana",c:"#fb923c"},
  entregada:{l:"Lista entrega",c:"#22c55e"},
  operacion_cerrada:{l:"Cerrada",c:"#10b981"},
  cancelada:{l:"Cancelada",c:"#f87171"},
};

