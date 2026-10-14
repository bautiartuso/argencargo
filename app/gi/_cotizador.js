"use client";
// Cotizador de Gestión Integral (3 pasos). Movido tal cual desde el panel viejo (13/10/2026).
import { useState, useEffect } from "react";
import { calcOpBudget, applyAntidumpingFloor, tasaODefault, TASA_IVA_ADICIONAL, TASA_IIGG, TASA_IIBB, tablaDesaduanaje } from "../../lib/calc";
import { alertDialog } from "../../lib/ui";
import { dq, ensureFresh, uploadProductPhoto, fmtDate, fmtUSD, buildQuoteWaMessage, cleanWaNumber, GOLD, GOLD_LIGHT, GOLD_DEEP, GOLD_GRADIENT } from "./_base";

export const CHANNEL_DEFS=[
  {key:"aereo_blanco",name:"Aéreo Courier Comercial",time:"7 a 10 días hábiles"},
  // maritimo_blanco internamente = LCL/FCL (min 1 m³). maritimo_negro = Integral AC (sin mínimo).
  {key:"maritimo_blanco",name:"Marítimo LCL/FCL",time:"~ 60 días"},
  {key:"maritimo_negro",name:"Marítimo Integral AC",time:"~ 60 días"},
];

export function CotizadorWizard({token,requestId,profileId,onBack}){
  const [step,setStep]=useState(1);
  const [request,setRequest]=useState(null);
  const [client,setClient]=useState(null);
  const [tariffs,setTariffs]=useState([]);
  const [config,setConfig]=useState({});
  const [products,setProducts]=useState([]);
  const [paymentPlan,setPaymentPlan]=useState([
    {pct:30,label:"Inicio de producción"},
    {pct:20,label:"Producción terminada"},
    {pct:50,label:"Contra entrega"},
  ]);
  // % del FOB que se paga al proveedor como anticipo (resto al fin de producción).
  const [supplierDepositPct,setSupplierDepositPct]=useState("30");
  const [honorariosPct,setHonorariosPct]=useState("10");
  // Zona del cliente: limita las opciones de envío que ve en /cotizacion/[token].
  // "" = sin definir; "Interior" = a coordinar; cualquier otro valor = filtra a esa zona puntual.
  const [deliveryZone,setDeliveryZone]=useState("");
  const [lo,setLo]=useState(true);
  const [generatedQuote,setGeneratedQuote]=useState(null);
  const [saving,setSaving]=useState(false);
  const [savingDraft,setSavingDraft]=useState(false);
  const [draftQuoteId,setDraftQuoteId]=useState(null);
  const [lastSavedAt,setLastSavedAt]=useState(null);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3500);};

  const emptyProductFrom=(p,i)=>({
    _id:p?.id,
    description:p?.description||"",
    notes:p?.notes||"",
    origin:p?.origin||"china",
    quantity:p?.quantity!=null?String(p.quantity):"",
    unit_cost_usd:p?.unit_cost_usd!=null?String(p.unit_cost_usd):"",
    lead_time_days:p?.lead_time_days!=null?String(p.lead_time_days):"",
    photo_url:p?.photo_url||"",
    ncm_code:p?.ncm_code||"",
    ncm_description:p?.ncm_description||"",
    import_duty_rate:p?.ncm_di_pct!=null?String(p.ncm_di_pct):"",
    statistics_rate:p?.ncm_estad_pct!=null?String(p.ncm_estad_pct):"",
    iva_rate:p?.ncm_iva_pct!=null?String(p.ncm_iva_pct):"",
    ncm_loading:false,
    ncm_error:false,
    pkg_count:p?.pkg_count!=null?String(p.pkg_count):"1",
    pkg_length_cm:p?.pkg_length_cm!=null?String(p.pkg_length_cm):"",
    pkg_width_cm:p?.pkg_width_cm!=null?String(p.pkg_width_cm):"",
    pkg_height_cm:p?.pkg_height_cm!=null?String(p.pkg_height_cm):"",
    pkg_weight_kg:p?.pkg_weight_kg!=null?String(p.pkg_weight_kg):"",
    supplier_ref:p?.supplier_ref||"",
  });

  // Cargar todo: si hay un quote draft existente para este request, usarlo (con sus productos parciales).
  // Sino, usar los productos crudos del request (lo que pidió el admin) como base.
  useEffect(()=>{(async()=>{
    setLo(true);
    const [reqRes,tar,cfg,draftRes]=await Promise.all([
      dq("gi_quote_requests",{token,filters:`?id=eq.${requestId}&select=*,clients(*),gi_quote_request_products(*)`}),
      dq("tariffs",{token,filters:"?select=*&type=eq.rate&order=sort_order.asc"}),
      dq("calc_config",{token,filters:"?select=*"}),
      // Cargar la cotización más reciente para este request. Incluye 'accepted' (el cliente aceptó, todavía se puede modificar
       // antes de convertir a op). 'converted' queda excluida — una vez creada la op, la quote es solo histórica.
      dq("gi_quotes",{token,filters:`?request_id=eq.${requestId}&status=in.(draft,sent,accepted)&select=*,gi_quote_products(*)&order=created_at.desc&limit=1`}),
    ]);
    if(Array.isArray(reqRes)&&reqRes[0]){
      const r=reqRes[0];
      setRequest(r);
      setClient(r.clients);
    }
    // Si hay draft, usarlo
    const draft=Array.isArray(draftRes)&&draftRes[0]?draftRes[0]:null;
    if(draft){
      setDraftQuoteId(draft.id);
      if(draft.payment_plan)setPaymentPlan(typeof draft.payment_plan==="string"?JSON.parse(draft.payment_plan):draft.payment_plan);
      if(draft.honorarios_pct!=null)setHonorariosPct(String(draft.honorarios_pct));
      if(draft.supplier_deposit_pct!=null)setSupplierDepositPct(String(draft.supplier_deposit_pct));
      if(draft.delivery_zone!=null)setDeliveryZone(draft.delivery_zone);
      const draftProds=(draft.gi_quote_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
      if(draftProds.length>0){
        setProducts(draftProds.map(emptyProductFrom));
      } else if(Array.isArray(reqRes)&&reqRes[0]){
        const rawProds=(reqRes[0].gi_quote_request_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
        setProducts(rawProds.map(p=>emptyProductFrom({description:p.description,notes:p.notes,quantity:p.quantity,photo_url:p.photo_url})));
      }
      setLastSavedAt(draft.updated_at||draft.created_at);
    } else if(Array.isArray(reqRes)&&reqRes[0]){
      const rawProds=(reqRes[0].gi_quote_request_products||[]).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
      if(rawProds.length>0){
        setProducts(rawProds.map(p=>emptyProductFrom({description:p.description,notes:p.notes,quantity:p.quantity,photo_url:p.photo_url})));
      } else {
        // Cotización directa sin productos pre-cargados — arrancamos con uno vacío
        setProducts([emptyProductFrom({})]);
      }
    }
    setTariffs(Array.isArray(tar)?tar:[]);
    const cfgObj={};(Array.isArray(cfg)?cfg:[]).forEach(r=>{cfgObj[r.key]=Number(r.value);});setConfig(cfgObj);
    setLo(false);
  })();},[requestId,token]);

  // Persiste el state actual como draft (UPSERT del gi_quote + reemplaza productos).
  const saveDraft=async({silent=false}={})=>{
    if(savingDraft||lo)return;
    setSavingDraft(true);
    try{
      let quoteId=draftQuoteId;
      if(!quoteId){
        // Crear quote en draft
        const inserted=await dq("gi_quotes",{method:"POST",token,body:{
          request_id:requestId,
          payment_plan:paymentPlan,
          honorarios_pct:honorariosPct?Number(honorariosPct):null,
          supplier_deposit_pct:supplierDepositPct?Number(supplierDepositPct):null,
          delivery_zone:deliveryZone||null,
          status:"draft",
        }});
        quoteId=Array.isArray(inserted)?inserted[0]?.id:inserted?.id;
        if(!quoteId)throw new Error("No se pudo crear el draft");
        setDraftQuoteId(quoteId);
      } else {
        await dq("gi_quotes",{method:"PATCH",token,filters:`?id=eq.${quoteId}`,body:{payment_plan:paymentPlan,honorarios_pct:honorariosPct?Number(honorariosPct):null,supplier_deposit_pct:supplierDepositPct?Number(supplierDepositPct):null,delivery_zone:deliveryZone||null}});
      }
      // Si no hay productos en el state, no tocamos los existentes (evitamos perder data por error de UI).
      if(products.length===0){
        setLastSavedAt(new Date().toISOString());
        if(!silent)flash("✓ Borrador guardado (sin productos)");
        return;
      }
      // Estrategia segura: INSERT primero los nuevos, recién DESPUÉS borrar los viejos.
      // Si el INSERT falla, los viejos siguen vivos. Display_order alto reservado para nuevos.
      const oldRows=await dq("gi_quote_products",{token,filters:`?quote_id=eq.${quoteId}&select=id`});
      const oldIds=Array.isArray(oldRows)?oldRows.map(r=>r.id):[];
      const newOrder=oldIds.length+1000; // garantiza que los nuevos queden ordenados después de los viejos temporalmente
      const insertedIds=[];
      for(let i=0;i<products.length;i++){
        const p=products[i];
        const inserted=await dq("gi_quote_products",{method:"POST",token,body:{
          quote_id:quoteId,
          description:p.description||null,
          origin:p.origin||"china",
          quantity:p.quantity?Number(p.quantity):null,
          unit_cost_usd:p.unit_cost_usd?Number(p.unit_cost_usd):null,
          ncm_code:p.ncm_code||null,
          ncm_description:p.ncm_description||null,
          ncm_di_pct:p.import_duty_rate?Number(p.import_duty_rate):null,
          ncm_iva_pct:p.iva_rate?Number(p.iva_rate):null,
          ncm_estad_pct:p.statistics_rate?Number(p.statistics_rate):null,
          lead_time_days:p.lead_time_days?Number(p.lead_time_days):null,
          photo_url:p.photo_url||null,
          pkg_count:p.pkg_count?Number(p.pkg_count):null,
          pkg_length_cm:p.pkg_length_cm?Number(p.pkg_length_cm):null,
          pkg_width_cm:p.pkg_width_cm?Number(p.pkg_width_cm):null,
          pkg_height_cm:p.pkg_height_cm?Number(p.pkg_height_cm):null,
          pkg_weight_kg:p.pkg_weight_kg?Number(p.pkg_weight_kg):null,
          supplier_ref:p.supplier_ref||null,
          display_order:newOrder+i,
        }});
        const newId=Array.isArray(inserted)?inserted[0]?.id:inserted?.id;
        if(!newId){
          // Algo falló — dejamos los nuevos creados (si los hubo) y los viejos. Mostramos error claro.
          throw new Error(`Falló insertar producto ${i+1}. Revisá la consola. Los productos viejos siguen guardados.`);
        }
        insertedIds.push(newId);
      }
      // Ahora sí, borrar los viejos
      if(oldIds.length>0){
        const inFilter=oldIds.map(id=>`"${id}"`).join(",");
        await dq("gi_quote_products",{method:"DELETE",token,filters:`?id=in.(${inFilter})`});
      }
      // Reordenar los nuevos a 0..N-1
      for(let i=0;i<insertedIds.length;i++){
        await dq("gi_quote_products",{method:"PATCH",token,filters:`?id=eq.${insertedIds[i]}`,body:{display_order:i}});
      }
      setLastSavedAt(new Date().toISOString());
      if(!silent)flash(`✓ Borrador guardado (${products.length} productos)`);
    } catch(e){
      alertDialog("Error al guardar borrador: "+e.message);
    } finally {
      setSavingDraft(false);
    }
  };

  const updateProduct=(i,field,value)=>setProducts(p=>p.map((x,j)=>j===i?{...x,[field]:value}:x));
  const addProduct=()=>setProducts(p=>[...p,{description:"",notes:"",origin:"china",quantity:"",unit_cost_usd:"",lead_time_days:"",photo_url:"",ncm_code:"",ncm_description:"",import_duty_rate:"",statistics_rate:"",iva_rate:"",ncm_loading:false,ncm_error:false,pkg_count:"1",pkg_length_cm:"",pkg_width_cm:"",pkg_height_cm:"",pkg_weight_kg:"",supplier_ref:""}]);
  const removeProduct=(i)=>setProducts(p=>p.length>1?p.filter((_,j)=>j!==i):p);

  const classifyNcm=async(i)=>{
    const p=products[i];
    if(!p.description?.trim()&&!p.photo_url)return;
    updateProduct(i,"ncm_loading",true);updateProduct(i,"ncm_error",false);
    try{
      // Si hay foto, convertirla a base64 + comprimirla si es muy grande, y mandar el mime explícito.
      let body={description:p.description||""};
      if(p.photo_url){
        try{
          const imgR=await fetch(p.photo_url);
          const blob=await imgR.blob();
          // Comprimir / re-encodear a JPEG si la imagen es >1MB o tiene formato no soportado (heic, webp viejo, etc).
          // Claude acepta PNG/JPEG/GIF/WEBP, pero JPEG max 1600px da el mejor balance tamaño/precisión.
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
          body.image=b64;
          body.image_mime=finalMime;
        } catch(e){console.warn("No pude leer foto para NCM",e);}
      }
      const r=await fetch("/api/ncm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json();
      if(d.fallback||d.error){
        setProducts(prods=>prods.map((x,j)=>j===i?{...x,ncm_loading:false,ncm_error:true}:x));
      } else {
        setProducts(prods=>prods.map((x,j)=>j===i?{...x,ncm_loading:false,ncm_error:false,ncm_code:d.ncm_code||"",ncm_description:d.ncm_description||"",import_duty_rate:d.import_duty_rate!=null?String(d.import_duty_rate):"",statistics_rate:d.statistics_rate!=null?String(d.statistics_rate):"",iva_rate:d.iva_rate!=null?String(d.iva_rate):""}:x));
      }
    } catch(e){
      setProducts(prods=>prods.map((x,j)=>j===i?{...x,ncm_loading:false,ncm_error:true}:x));
    }
  };

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
    // Convertir packing por producto a array global (multiplicando cada uno por su pkg_count y quantity)
    const pkgs=products.flatMap(p=>{
      if(!p.pkg_count||!p.pkg_length_cm)return [];
      return [{
        quantity:Number(p.pkg_count||1),
        gross_weight_kg:Number(p.pkg_weight_kg||0),
        length_cm:Number(p.pkg_length_cm||0),
        width_cm:Number(p.pkg_width_cm||0),
        height_cm:Number(p.pkg_height_cm||0),
      }];
    });
    const op={
      channel:channelKey,
      origin:products.some(p=>p.origin==="usa")?"USA":"China",
      has_battery:false,
      has_phones:false,
      shipping_to_door:false,
      shipping_cost:0,
      merchandise_value_usd:items.reduce((s,it)=>s+it.unit_price_usd*it.quantity,0),
    };
    try{
      return calcOpBudget(op,items,pkgs,tariffs,config,[],client);
    } catch(e){
      console.error(`[calc ${channelKey}]`,e);
      return null;
    }
  };

  const totalFob=products.reduce((s,p)=>s+Number(p.unit_cost_usd||0)*Number(p.quantity||0),0);
  const honorariosFactor=1+(Number(honorariosPct||0)/100);
  const channelResults=CHANNEL_DEFS.map(ch=>{
    const r=computeChannel(ch.key);
    if(!r)return {...ch,impoOnly:0,total:0,real:0,honorariosUsd:0,gainLogistica:0,gainHonorarios:0,gainTotal:0,error:true};
    // impoOnly = precio al cliente si SOLO hace la impo con nosotros (sin GI).
    //            Ya incluye nuestra ganancia logística (spread vs. costo real).
    // total    = precio al cliente con Gestión Integral = impoOnly × (1 + honorarios%).
    // real     = costo real para Argencargo (lo que efectivamente pagamos):
    //              totalFob (al proveedor) + realCost (flete cost + impuestos + seguro + ship pass-through).
    //              Margen logístico = (flete - fleteCost) + surcharge (canal B).
    // gainLogistica = impoOnly − real (ganancia ya capturada en la impo regular)
    // gainHonorarios = total − impoOnly (markup adicional por la gestión integral)
    // gainTotal = gainLogistica + gainHonorarios = ganancia neta de la empresa por canal.
    const impoOnly=r.totalAbonar+totalFob;
    const total=impoOnly*honorariosFactor;
    const real=totalFob+(r.realCost||0);
    const honorariosUsd=total-impoOnly;
    const gainLogistica=impoOnly-real;
    const gainHonorarios=honorariosUsd;
    const gainTotal=gainLogistica+gainHonorarios;
    return {...ch,impoOnly,total,real,honorariosUsd,gainLogistica,gainHonorarios,gainTotal,calc:r};
  });

  // Filtrar canales por origen
  const someUSA=products.some(p=>p.origin==="usa");
  const visibleChannels=someUSA
    ?channelResults.filter(c=>c.key.includes("negro")||c.key==="maritimo_blanco")
    :channelResults;

  // (profitFor eliminado: la "estimación de ganancia / comisión socio" ya no se muestra en el wizard;
  //  los honorarios al cliente se calculan directo en channelResults y la comisión socio se resuelve aparte)

  const validateStep1=()=>{
    if(products.length===0)return "Agregá al menos un producto";
    for(let i=0;i<products.length;i++){
      const p=products[i];
      if(!p.description?.trim())return `Producto ${i+1}: falta descripción`;
      if(!p.quantity||Number(p.quantity)<=0)return `Producto ${i+1}: falta cantidad`;
      if(!p.unit_cost_usd||Number(p.unit_cost_usd)<=0)return `Producto ${i+1}: falta costo unitario`;
      if(!p.pkg_length_cm||!p.pkg_width_cm||!p.pkg_height_cm||!p.pkg_weight_kg)return `Producto ${i+1}: faltan datos de embalaje`;
    }
    return null;
  };

  const goStep=(n)=>{
    if(n>1){const e=validateStep1();if(e){alertDialog(e);return;}}
    setStep(n);
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
      // Validez: la que se eligió al crear la cotización (si sigue vigente); si no, 7 días.
      const reqExp=request?.expires_at?String(request.expires_at).slice(0,10):null;
      const expDate=reqExp&&new Date(reqExp)>new Date()?reqExp:new Date(Date.now()+7*86400000).toISOString().slice(0,10);
      const body={
        request_id:requestId,
        honorarios_pct:honorariosPct?Number(honorariosPct):0,
        supplier_deposit_pct:supplierDepositPct?Number(supplierDepositPct):null,
        delivery_zone:deliveryZone||null,
        payment_plan:paymentPlan,
        ...ch,
        status:"sent",
        sent_at:new Date().toISOString(),
        expires_at:expDate,
      };
      let quoteId, publicToken;
      if(draftQuoteId){
        // Update existing draft quote → finalizar
        const updated=await dq("gi_quotes",{method:"PATCH",token,filters:`?id=eq.${draftQuoteId}`,body});
        quoteId=draftQuoteId;
        publicToken=Array.isArray(updated)?updated[0]?.public_token:updated?.public_token;
        // Borrar productos viejos del draft, vamos a reinsertarlos con todos los datos completos
        await dq("gi_quote_products",{method:"DELETE",token,filters:`?quote_id=eq.${quoteId}`});
      } else {
        const inserted=await dq("gi_quotes",{method:"POST",token,body});
        quoteId=Array.isArray(inserted)?inserted[0]?.id:inserted?.id;
        publicToken=Array.isArray(inserted)?inserted[0]?.public_token:inserted?.public_token;
      }
      if(!quoteId)throw new Error("No se pudo guardar la cotización");
      // Insert productos finales
      for(let i=0;i<products.length;i++){
        const p=products[i];
        await dq("gi_quote_products",{method:"POST",token,body:{
          quote_id:quoteId,
          description:p.description,
          origin:p.origin,
          quantity:Number(p.quantity)||0,
          unit_cost_usd:Number(p.unit_cost_usd)||0,
          ncm_code:p.ncm_code||null,
          ncm_description:p.ncm_description||null,
          ncm_di_pct:p.import_duty_rate?Number(p.import_duty_rate):null,
          ncm_iva_pct:p.iva_rate?Number(p.iva_rate):null,
          ncm_estad_pct:p.statistics_rate?Number(p.statistics_rate):null,
          lead_time_days:p.lead_time_days?Number(p.lead_time_days):null,
          photo_url:p.photo_url||null,
          pkg_count:Number(p.pkg_count)||1,
          pkg_length_cm:Number(p.pkg_length_cm)||null,
          pkg_width_cm:Number(p.pkg_width_cm)||null,
          pkg_height_cm:Number(p.pkg_height_cm)||null,
          pkg_weight_kg:Number(p.pkg_weight_kg)||null,
          supplier_ref:p.supplier_ref||null,
          display_order:i,
        }});
      }
      // Update request status
      await dq("gi_quote_requests",{method:"PATCH",token,filters:`?id=eq.${requestId}`,body:{status:"quoted"}});
      // Log evento (link generado o regenerado)
      try{
        await dq("gi_quote_communications",{method:"POST",token,body:{
          quote_id:quoteId,
          request_id:requestId,
          type:draftQuoteId?"link_regenerated":"link_generated",
          author_id:profileId||null,
          meta:{public_token:publicToken,honorarios_pct:Number(honorariosPct||0)},
        }});
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

  if(lo)return <p style={{color:"rgba(255,255,255,0.4)"}}>Cargando cotizador…</p>;
  if(!request)return <p style={{color:"rgba(255,255,255,0.4)"}}>Solicitud no encontrada</p>;
  const cn=client?`${client.first_name||""} ${client.last_name||""}`.trim():"—";

  const Step=({n,label,active,done})=><div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
    <span style={{width:26,height:26,borderRadius:"50%",background:done?"#22c55e":(active?GOLD_GRADIENT:"rgba(255,255,255,0.06)"),color:done?"#fff":(active?"#0A1628":"rgba(255,255,255,0.5)"),fontSize:12,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{done?"✓":n}</span>
    <p style={{fontSize:12,fontWeight:600,color:active?"#fff":(done?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.5)"),margin:0,textTransform:"uppercase",letterSpacing:0}}>{label}</p>
  </div>;

  return <div>
    {msg&&<div style={{position:"fixed",top:20,right:20,background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",padding:"10px 16px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"0 12px 30px rgba(0,0,0,0.4)"}}>{msg}</div>}
    <button onClick={onBack} style={{fontSize:12,color:"rgba(255,255,255,0.55)",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontWeight:600,marginBottom:18,padding:"6px 12px",borderRadius:8,letterSpacing:"0.04em",fontFamily:"inherit"}}>← Volver</button>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14,marginBottom:6}}>
      <div>
        <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px",color:"#fff"}}>Cotizador <span style={{color:GOLD_LIGHT,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.04em"}}>{request.request_code}</span></h1>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>Cliente: <strong style={{color:"#fff"}}>{cn}</strong>{lastSavedAt&&<span style={{marginLeft:10,fontSize:11,color:"rgba(255,255,255,0.4)"}}>· Borrador guardado {fmtDate(lastSavedAt)}</span>}</p>
      </div>
      <button onClick={()=>saveDraft({})} disabled={savingDraft||lo} style={{padding:"9px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:"1px solid rgba(96,165,250,0.4)",background:savingDraft?"rgba(96,165,250,0.2)":"rgba(96,165,250,0.10)",color:"#60a5fa",cursor:savingDraft?"wait":"pointer",fontFamily:"inherit",letterSpacing:"0.02em"}}>{savingDraft?"Guardando…":"💾 Guardar borrador"}</button>
    </div>

    <div style={{display:"flex",alignItems:"center",gap:12,marginTop:18,marginBottom:24,padding:"14px 18px",background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12}}>
      <Step n={1} label="Productos & embalaje" active={step===1} done={step>1}/>
      <div style={{flex:"0 0 24px",height:1,background:step>1?"#22c55e":"rgba(255,255,255,0.1)"}}/>
      <Step n={2} label="Costos & honorarios" active={step===2} done={step>2}/>
      <div style={{flex:"0 0 24px",height:1,background:step>2?"#22c55e":"rgba(255,255,255,0.1)"}}/>
      <Step n={3} label="Link al cliente" active={step===3} done={false}/>
    </div>

    {step===1&&<WizStep1 token={token} products={products} onUpdate={updateProduct} onAdd={addProduct} onRemove={removeProduct} onClassify={classifyNcm} onNext={()=>goStep(2)} totalFob={totalFob} visibleChannels={visibleChannels} tariffs={tariffs} config={config} client={client}/>}
    {step===2&&<WizStep2 token={token} visibleChannels={visibleChannels} someUSA={someUSA} honorariosPct={honorariosPct} setHonorariosPct={setHonorariosPct} paymentPlan={paymentPlan} setPaymentPlan={setPaymentPlan} totalFob={totalFob} supplierDepositPct={supplierDepositPct} setSupplierDepositPct={setSupplierDepositPct} deliveryZone={deliveryZone} setDeliveryZone={setDeliveryZone} client={client} onBack={()=>setStep(1)} onNext={generateLink} saving={saving}/>}
    {step===3&&<WizStep3 generatedQuote={generatedQuote} client={client} request={request} onBack={onBack}/>}
  </div>;
}

function WizStep1({token,products,onUpdate,onAdd,onRemove,onClassify,onNext,totalFob,visibleChannels,tariffs,config,client}){
  // Desglose impositivo per-item per-canal: replica la lógica de lib/calc.js prorrateando por FOB del item.
  // Para cada producto devuelve { byChannel: { [channelKey]: { fob, die, te, iva, desemb, ivaAdic, iigg, iibb, total } } }.
  const computeItemBreakdown=(productIdx)=>{
    const out={};
    if(!visibleChannels||!tariffs)return out;
    const p=products[productIdx];
    const itemFob=Number(p.unit_cost_usd||0)*Number(p.quantity||0);
    if(itemFob<=0)return out;
    const pct=totalFob>0?itemFob/totalFob:1;
    // Sumar pkgs globales (igual que computeChannel)
    let pf=0,totCBM=0,totGW=0;
    products.forEach(x=>{
      if(!x.pkg_count||!x.pkg_length_cm)return;
      const q=Number(x.pkg_count||1),gw=Number(x.pkg_weight_kg||0),l=Number(x.pkg_length_cm||0),w=Number(x.pkg_width_cm||0),h=Number(x.pkg_height_cm||0);
      pf+=Math.max(gw*q,l&&w&&h?((l*w*h)/5000)*q:0);
      totGW+=gw*q;
      totCBM+=l&&w&&h?((l*w*h)/1000000)*q:0;
    });
    // Antidumping calzado: solo afecta la base imponible (die/te/iva/desemb) — el fob real
    // devuelto en el breakdown no cambia.
    const floorInputs=products.map(x=>({unit_price:Number(x.unit_cost_usd||0),quantity:Number(x.quantity||0),ncm_code:x.ncm_code}));
    const floored=applyAntidumpingFloor(floorInputs,config);
    const totalFobAllTax=floored.reduce((s,f)=>s+f.unit_price*f.quantity,0);
    const itemFobTax=floored[productIdx].unit_price*Number(p.quantity||0);
    const totalFobAll=products.reduce((s,x)=>s+Number(x.unit_cost_usd||0)*Number(x.quantity||0),0);
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
      const iCert=certFlAmt*pct;
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
  };
  return <div>
    <div style={{padding:"12px 16px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:10,fontSize:12.5,color:"rgba(255,255,255,0.85)",lineHeight:1.5,marginBottom:18}}>
      <strong style={{color:"#60a5fa"}}>Step 1:</strong> cargá cada producto con su packing. Si origen es <strong>China</strong> apretá "Clasificar NCM" para que el sistema busque el código y los aranceles. Si es <strong>USA</strong>, va canal B automáticamente.
    </div>
    {products.map((p,i)=><div key={i} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:18,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <h4 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>Producto {i+1}</h4>
        <button onClick={()=>onRemove(i)} disabled={products.length<=1} style={{padding:"5px 10px",fontSize:10.5,fontWeight:600,borderRadius:6,border:"1px solid rgba(248,113,113,0.3)",background:"transparent",color:products.length<=1?"rgba(255,255,255,0.2)":"#f87171",cursor:products.length<=1?"not-allowed":"pointer",fontFamily:"inherit"}}>✕ Quitar</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:14,marginBottom:12}}>
        <PhotoUpload value={p.photo_url} onChange={url=>onUpdate(i,"photo_url",url)} token={token}/>
        <div>
          <div style={{marginBottom:12}}>
            <label style={lblStyle()}>Descripción del producto</label>
            <input value={p.description} onChange={e=>onUpdate(i,"description",e.target.value)} style={inpStyle()}/>
          </div>
          <div>
            <label style={lblStyle()}>Referencia del proveedor (opcional)</label>
            <input value={p.supplier_ref||""} onChange={e=>onUpdate(i,"supplier_ref",e.target.value)} placeholder="Link Alibaba, nombre, WeChat, email..." style={inpStyle()}/>
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
        <div><label style={lblStyle()}>Origen</label>
          <select value={p.origin} onChange={e=>onUpdate(i,"origin",e.target.value)} style={inpStyle()}>
            <option value="china">China</option>
            <option value="usa">USA</option>
          </select>
        </div>
        <div><label style={lblStyle()}>Lead prod. (días)</label><input type="text" inputMode="numeric" value={p.lead_time_days} onChange={e=>onUpdate(i,"lead_time_days",e.target.value.replace(/[^0-9]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Cantidad</label><input type="text" inputMode="numeric" value={p.quantity} onChange={e=>onUpdate(i,"quantity",e.target.value.replace(/[^0-9]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Precio venta unit. USD</label><input type="text" inputMode="decimal" value={p.unit_cost_usd} onChange={e=>onUpdate(i,"unit_cost_usd",e.target.value.replace(/[^0-9.]/g,""))} style={inpStyle()}/></div>
      </div>

      {p.origin==="china"&&<div style={{padding:"12px 14px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:8,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            {p.ncm_code?<>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginBottom:3}}>Clasificación NCM</p>
              <p style={{fontSize:13,fontWeight:700,color:"#fff"}}><span style={{fontFamily:"'JetBrains Mono',monospace",color:"#60a5fa"}}>{p.ncm_code}</span> · {p.ncm_description}</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                <Tag>DI {p.import_duty_rate===""||p.import_duty_rate==null?0:p.import_duty_rate}%</Tag>
                <Tag>IVA {p.iva_rate===""||p.iva_rate==null?0:p.iva_rate}%</Tag>
                <Tag>Tasa Estad. {p.statistics_rate===""||p.statistics_rate==null?0:p.statistics_rate}%</Tag>
              </div>
            </>:<p style={{fontSize:12,color:"rgba(255,255,255,0.55)"}}>{p.ncm_error?<span style={{color:"#fbbf24"}}>⚠ No se pudo clasificar. Cargá los aranceles a mano abajo.</span>:"Apretá clasificar para que el sistema busque NCM y aranceles."}</p>}
          </div>
          {(()=>{const can=(p.description?.trim()||p.photo_url);const hasPhoto=!!p.photo_url;return <button onClick={()=>onClassify(i)} disabled={!can||p.ncm_loading} style={{padding:"7px 14px",fontSize:11.5,fontWeight:700,borderRadius:8,border:"1px solid rgba(96,165,250,0.4)",background:"rgba(96,165,250,0.1)",color:"#60a5fa",cursor:can?"pointer":"not-allowed",fontFamily:"inherit",opacity:can?1:0.4,whiteSpace:"nowrap"}}>{p.ncm_loading?"Clasificando…":(p.ncm_code?(hasPhoto?"🤖 Reclasificar (con foto)":"Reclasificar"):(hasPhoto?"🤖 Clasificar NCM (con foto)":"Clasificar NCM"))}</button>;})()}
        </div>
        {p.ncm_error&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
          <div><label style={lblStyle()}>DI %</label><input type="text" inputMode="decimal" value={p.import_duty_rate} onChange={e=>onUpdate(i,"import_duty_rate",e.target.value)} style={inpStyle()}/></div>
          <div><label style={lblStyle()}>IVA %</label><input type="text" inputMode="decimal" value={p.iva_rate} onChange={e=>onUpdate(i,"iva_rate",e.target.value)} style={inpStyle()}/></div>
          <div><label style={lblStyle()}>Tasa Estad. %</label><input type="text" inputMode="decimal" value={p.statistics_rate} onChange={e=>onUpdate(i,"statistics_rate",e.target.value)} style={inpStyle()}/></div>
        </div>}
      </div>}

      <p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,marginTop:14}}>Embalaje</p>
      <div style={{display:"grid",gridTemplateColumns:"0.6fr 1fr 1fr 1fr 1fr",gap:8}}>
        <div><label style={lblStyle()}>Cant. bultos</label><input type="text" inputMode="numeric" value={p.pkg_count} onChange={e=>onUpdate(i,"pkg_count",e.target.value.replace(/[^0-9]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Largo (cm)</label><input type="text" inputMode="decimal" value={p.pkg_length_cm} onChange={e=>onUpdate(i,"pkg_length_cm",e.target.value.replace(/[^0-9.]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Ancho (cm)</label><input type="text" inputMode="decimal" value={p.pkg_width_cm} onChange={e=>onUpdate(i,"pkg_width_cm",e.target.value.replace(/[^0-9.]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Alto (cm)</label><input type="text" inputMode="decimal" value={p.pkg_height_cm} onChange={e=>onUpdate(i,"pkg_height_cm",e.target.value.replace(/[^0-9.]/g,""))} style={inpStyle()}/></div>
        <div><label style={lblStyle()}>Peso bulto (kg)</label><input type="text" inputMode="decimal" value={p.pkg_weight_kg} onChange={e=>onUpdate(i,"pkg_weight_kg",e.target.value.replace(/[^0-9.]/g,""))} style={inpStyle()}/></div>
      </div>
      {/* Preview en vivo: CBM total y peso facturable (aéreo y marítimo) calculados desde los inputs de embalaje. */}
      {(()=>{
        const cnt=Number(p.pkg_count||0);const L=Number(p.pkg_length_cm||0);const W=Number(p.pkg_width_cm||0);const H=Number(p.pkg_height_cm||0);const kg=Number(p.pkg_weight_kg||0);
        if(!cnt||!L||!W||!H||!kg)return null;
        const cbm=(L*W*H*cnt)/1000000;
        const pesoReal=kg*cnt;
        const pesoVolAereo=(L*W*H*cnt)/5000;
        const pesoFactAereo=Math.max(pesoReal,pesoVolAereo);
        const pesoFactMar=Math.max(pesoReal,cbm*1000); // marítimo: 1 m³ = 1.000 kg facturables
        return <div style={{display:"flex",flexWrap:"wrap",gap:14,padding:"10px 12px",marginTop:8,background:"rgba(184,149,106,0.05)",border:"1px solid rgba(184,149,106,0.15)",borderRadius:8,fontSize:11,color:"rgba(255,255,255,0.65)",fontFeatureSettings:'"tnum"'}}>
          <span>CBM total: <strong style={{color:"#fff"}}>{cbm.toFixed(4)} m³</strong></span>
          <span>Peso real: <strong style={{color:"#fff"}}>{pesoReal.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg</strong></span>
          <span>Peso vol. aéreo (÷5000): <strong style={{color:"#fff"}}>{pesoVolAereo.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg</strong></span>
          <span>Facturable aéreo: <strong style={{color:"#22c55e"}}>{pesoFactAereo.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg</strong></span>
          <span>Facturable marítimo: <strong style={{color:"#60a5fa"}}>{pesoFactMar.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg</strong></span>
        </div>;
      })()}
      {/* Desglose impositivo por producto y por canal (solo canal A blanco — el B negro es tarifa plana sin impuestos prorrateados) */}
      {(()=>{
        const bd=computeItemBreakdown(i);
        const blancos=Object.entries(bd).filter(([,v])=>!v.notBlanco);
        if(blancos.length===0)return null;
        const fmt=n=>Number(n||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
        return <div style={{marginTop:10,padding:"10px 12px",background:"rgba(96,165,250,0.04)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:8}}>
          <p style={{fontSize:9.5,fontWeight:700,color:"rgba(96,165,250,0.85)",textTransform:"uppercase",letterSpacing:"0.08em",margin:"0 0 8px"}}>Desglose impositivo del producto (canal A · prorrateado por FOB)</p>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${blancos.length},1fr)`,gap:10}}>
            {blancos.map(([k,v])=>{
              const lbl=k==="aereo_blanco"?"Aéreo A":k==="maritimo_blanco"?"Marítimo A (LCL/FCL)":k;
              return <div key={k} style={{background:"rgba(0,0,0,0.18)",borderRadius:6,padding:"8px 10px",fontSize:11,color:"rgba(255,255,255,0.7)",fontFeatureSettings:'"tnum"'}}>
                <p style={{fontSize:10.5,fontWeight:700,color:"#60a5fa",margin:"0 0 6px"}}>{lbl}</p>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>FOB</span><span>USD {fmt(v.fob)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>+ Cert. flete</span><span>USD {fmt(v.certFl)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>+ Seguro (1%)</span><span>USD {fmt(v.seguro)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:3,paddingTop:5}}><span style={{color:"rgba(255,255,255,0.5)"}}>CIF item</span><span style={{color:"#fff",fontWeight:600}}>USD {fmt(v.cif)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0",marginTop:5}}><span>DIE</span><span>USD {fmt(v.die)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>Tasa estad.</span><span>USD {fmt(v.te)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>IVA</span><span>USD {fmt(v.iva)}</span></div>
                {v.desemb>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>Desemb.×1.21</span><span>USD {fmt(v.desemb)}</span></div>}
                {v.ivaAdic>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>IVA Adic.</span><span>USD {fmt(v.ivaAdic)}</span></div>}
                {v.iigg>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>IIGG</span><span>USD {fmt(v.iigg)}</span></div>}
                {v.iibb>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span>IIBB</span><span>USD {fmt(v.iibb)}</span></div>}
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0 0",borderTop:"1px solid rgba(96,165,250,0.25)",marginTop:5,fontWeight:700}}><span style={{color:"#fff"}}>Total impuestos</span><span style={{color:"#22c55e"}}>USD {fmt(v.total)}</span></div>
              </div>;
            })}
          </div>
        </div>;
      })()}
    </div>)}
    <button onClick={onAdd} style={{padding:"7px 14px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",fontFamily:"inherit",marginBottom:18}}>+ Agregar producto</button>
    {(()=>{
      // Totales globales para el subtotal
      let totCBM=0,pesoRealAll=0,pfAll=0;
      products.forEach(x=>{
        const cnt=Number(x.pkg_count||0),L=Number(x.pkg_length_cm||0),W=Number(x.pkg_width_cm||0),H=Number(x.pkg_height_cm||0),kg=Number(x.pkg_weight_kg||0);
        if(!cnt||!L||!W||!H||!kg)return;
        totCBM+=(L*W*H*cnt)/1000000;
        pesoRealAll+=kg*cnt;
        pfAll+=Math.max(kg*cnt,(L*W*H*cnt)/5000);
      });
      const pesoFactMarAll=Math.max(pesoRealAll,totCBM*1000);
      const cbmCharge=Math.max(totCBM,1); // marítimo blanco mínimo 1 m³
      return <div style={{padding:"14px 18px",background:"rgba(184,149,106,0.06)",border:"1px solid rgba(184,149,106,0.2)",borderRadius:10,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <p style={{fontSize:12.5,color:"rgba(255,255,255,0.85)",margin:0}}>Subtotal venta: <strong style={{color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalFob)}</strong></p>
          <button onClick={onNext} style={{padding:"10px 20px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit"}}>Continuar a costos →</button>
        </div>
        {pesoRealAll>0&&<div style={{display:"flex",flexWrap:"wrap",gap:14,fontSize:11,color:"rgba(255,255,255,0.65)",fontFeatureSettings:'"tnum"',paddingTop:8,borderTop:"1px solid rgba(184,149,106,0.18)"}}>
          <span>CBM total: <strong style={{color:"#fff"}}>{totCBM.toFixed(4)} m³</strong>{totCBM<1?<span style={{color:"#fbbf24",marginLeft:4,fontSize:10}}>(min 1 m³ marítimo LCL/FCL → cobra {cbmCharge.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} m³)</span>:""}</span>
          <span>Peso real total: <strong style={{color:"#fff"}}>{pesoRealAll.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg</strong></span>
          <span>Facturable aéreo total: <strong style={{color:"#22c55e"}}>{pfAll.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg</strong></span>
          <span>Facturable marítimo total: <strong style={{color:"#60a5fa"}}>{pesoFactMarAll.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})} kg</strong></span>
        </div>}
      </div>;
    })()}
  </div>;
}

function WizStep2({token,visibleChannels,someUSA,honorariosPct,setHonorariosPct,paymentPlan,setPaymentPlan,totalFob,supplierDepositPct,setSupplierDepositPct,deliveryZone,setDeliveryZone,client,onBack,onNext,saving}){
  // Zonas de envío disponibles (de gi_shipping_rates) para el dropdown.
  const [zones,setZones]=useState([]);
  useEffect(()=>{(async()=>{
    const r=await dq("gi_shipping_rates",{token,filters:"?select=zone&order=display_order.asc"});
    if(Array.isArray(r)){const set=new Set();r.forEach(x=>x.zone&&set.add(x.zone));setZones(Array.from(set));}
  })();},[token]);
  // Auto-detección por province del cliente (sólo sugerencia, no bloquea):
  const clientProvince=String(client?.province||"").toLowerCase();
  const autoSuggest=clientProvince.includes("ciudad")||clientProvince==="caba"?"CABA":(clientProvince.includes("buenos aires")?"":"Interior");
  // Cobertura por etapa para no quedar en descubierto:
  //  Stage 1 cliente debe cubrir el ANTICIPO a proveedor (FOB × deposit%).
  //  Stage 1 + Stage 2 cliente deben cubrir el FOB TOTAL (al fin de producción ya pagaste todo al proveedor).
  // Worst case = canal con MAYOR ratio FOB/precio.
  const validChannels=(visibleChannels||[]).filter(c=>!c.error&&c.total>0);
  const supDepFrac=Math.max(0,Math.min(100,Number(supplierDepositPct||0)))/100;
  const fobRatios=validChannels.map(c=>totalFob/c.total*100); // % del precio que es FOB
  const fobRatioMax=fobRatios.length>0?Math.max(...fobRatios):0; // worst case
  const minStage1=Math.ceil(fobRatioMax*supDepFrac);     // cubrir anticipo
  const minStage12=Math.ceil(fobRatioMax);                // cubrir FOB total al fin de producción

  const stage1Pct=Number(paymentPlan?.[0]?.pct||0);
  const stage12Pct=stage1Pct+Number(paymentPlan?.[1]?.pct||0);
  const isStage1Covered=stage1Pct>=minStage1;
  const isStage12Covered=stage12Pct>=minStage12;

  const adjustToMinSafe=()=>{
    if(minStage12<=0||minStage12>=100)return;
    const stage1Target=minStage1;
    const stage2Target=Math.max(0,minStage12-stage1Target);
    const stage3Target=100-stage1Target-stage2Target;
    setPaymentPlan(p=>{
      const base=Array.isArray(p)&&p.length>=3?p:[
        {pct:30,label:"Inicio de producción"},
        {pct:20,label:"Producción terminada"},
        {pct:50,label:"Contra entrega"},
      ];
      const next=[...base];
      next[0]={...next[0],pct:stage1Target};
      next[1]={...next[1],pct:stage2Target};
      next[2]={...next[2],pct:stage3Target};
      // si hay más etapas, las pone en 0 (caso edge)
      for(let i=3;i<next.length;i++)next[i]={...next[i],pct:0};
      return next;
    });
  };

  return <div>
    <div style={{padding:"12px 16px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:10,fontSize:12.5,color:"rgba(255,255,255,0.85)",lineHeight:1.5,marginBottom:18}}>
      <strong style={{color:"#60a5fa"}}>Step 2:</strong> el sistema calcula el costo operativo por canal{someUSA?". Hay algún producto USA, así que solo se muestran canales B.":"."} Sumá los honorarios que cobrás al cliente por la gestión y el sistema arma el precio final que ve el cliente. Tu comisión como socio se define por separado al cerrar la op.
    </div>

    <div style={{padding:"14px 18px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:12,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:240}}>
          <p style={{fontSize:13,fontWeight:700,color:"#60a5fa",margin:0}}>Zona de entrega del cliente</p>
          <p style={{fontSize:11.5,color:"rgba(255,255,255,0.6)",margin:"3px 0 0",lineHeight:1.4}}>El cliente verá <strong style={{color:"#fff"}}>solo</strong> esta opción de envío más "Retiro por oficina". Si elegís Interior, el costo queda "a coordinar".{autoSuggest&&!deliveryZone?<><br/>Sugerencia según ficha del cliente: <strong style={{color:GOLD_LIGHT}}>{autoSuggest}</strong>.</>:""}</p>
        </div>
        <select value={deliveryZone} onChange={e=>setDeliveryZone(e.target.value)} style={{padding:"8px 12px",fontSize:13,fontWeight:600,border:"1px solid rgba(96,165,250,0.4)",borderRadius:8,background:"rgba(0,0,0,0.25)",color:"#fff",outline:"none",fontFamily:"inherit",minWidth:200}}>
          <option value="">— Sin definir (mostrar todas) —</option>
          {zones.filter(z=>z!=="Interior").map(z=><option key={z} value={z}>{z}</option>)}
          <option value="Interior">Interior · a coordinar</option>
        </select>
      </div>
    </div>

    <div style={{padding:"14px 18px",background:"rgba(184,149,106,0.06)",border:"1.5px solid rgba(184,149,106,0.32)",borderRadius:12,marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:240}}>
          <p style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,margin:0}}>Honorarios al cliente</p>
          <p style={{fontSize:11.5,color:"rgba(255,255,255,0.6)",margin:"3px 0 0",lineHeight:1.4}}>% que se le cobra al cliente sobre el costo del canal. Es el ingreso por la gestión integral. <strong style={{color:"#fff"}}>Precio al cliente = costo del canal × (1 + honorarios %).</strong></p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <input type="text" inputMode="decimal" value={honorariosPct} onChange={e=>{const v=e.target.value;if(v===""||/^\d*\.?\d*$/.test(v))setHonorariosPct(v);}} placeholder="0" style={{width:90,padding:"10px 12px",fontSize:18,fontWeight:800,textAlign:"center",border:"1px solid rgba(184,149,106,0.4)",borderRadius:10,background:"rgba(0,0,0,0.25)",color:GOLD_LIGHT,outline:"none",fontFamily:"inherit"}}/>
          <span style={{fontSize:18,fontWeight:700,color:GOLD_LIGHT}}>%</span>
        </div>
      </div>
    </div>

    <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Precio al cliente por canal</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:18}}>
      {visibleChannels.map(c=><div key={c.key} style={{background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:16}}>
        <p style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:3}}>{c.name}</p>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:14}}>{c.time}</p>
        {c.error?<p style={{fontSize:11,color:"#f87171"}}>Sin tarifa configurada</p>:<>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,color:"rgba(255,255,255,0.7)",marginBottom:5}}>
            <span title="Lo que se le cobraría si solo hace la impo con nosotros (sin GI)">Total impo solo</span>
            <span style={{fontFeatureSettings:'"tnum"',fontWeight:600}}>{fmtUSD(c.impoOnly||0)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,color:"#22c55e",marginBottom:10}}>
            <span>+ Honorarios GI ({Number(honorariosPct||0)}%)</span>
            <span style={{fontFeatureSettings:'"tnum"',fontWeight:600}}>{fmtUSD(c.honorariosUsd||0)}</span>
          </div>
          <div style={{paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.08)",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Precio al cliente</span>
            <span style={{fontSize:20,fontWeight:800,color:GOLD_LIGHT,fontFeatureSettings:'"tnum"'}}>{fmtUSD(c.total)}</span>
          </div>
        </>}
      </div>)}
    </div>

    <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Ganancia estimada para Argencargo (por canal)</h3>
    <p style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5,fontStyle:"italic"}}>Ganancia logística usa un spread mock del 8% sobre el total impo. La ganancia real se calcula al cerrar la op con los costos verdaderos (pagos a embarcadores, aduana, etc.).</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:18}}>
      {visibleChannels.map(c=><div key={c.key} style={{background:"linear-gradient(135deg,rgba(34,197,94,0.06),rgba(34,197,94,0.01))",border:"1px solid rgba(34,197,94,0.25)",borderRadius:12,padding:16}}>
        <p style={{fontSize:13,fontWeight:700,color:"#22c55e",marginBottom:10}}>{c.name}</p>
        {c.error?<p style={{fontSize:11,color:"#f87171"}}>—</p>:<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            <div style={{padding:"10px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8}}>
              <p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Logística est.</p>
              <p style={{fontSize:13,fontWeight:700,fontFeatureSettings:'"tnum"',color:"#fff"}}>{fmtUSD(c.gainLogistica||0)}</p>
            </div>
            <div style={{padding:"10px 12px",background:"rgba(184,149,106,0.06)",borderRadius:8}}>
              <p style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Honorarios</p>
              <p style={{fontSize:13,fontWeight:700,fontFeatureSettings:'"tnum"',color:GOLD_LIGHT}}>{fmtUSD(c.gainHonorarios||0)}</p>
            </div>
          </div>
          <div style={{paddingTop:10,borderTop:"1px solid rgba(34,197,94,0.18)",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
            <span style={{fontSize:11,fontWeight:700,color:"rgba(34,197,94,0.85)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Ganancia total est.</span>
            <span style={{fontSize:18,fontWeight:800,color:"#22c55e",fontFeatureSettings:'"tnum"'}}>{fmtUSD(c.gainTotal||0)}</span>
          </div>
        </>}
      </div>)}
    </div>

    <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:240}}>
          <h3 style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.1em",margin:0}}>Plan de pagos del cliente</h3>
          <p style={{fontSize:11.5,color:"rgba(255,255,255,0.55)",margin:"4px 0 0",lineHeight:1.5}}>FOB <strong style={{color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalFob)}</strong>. Stage 1 del cliente debe cubrir el anticipo al proveedor (al iniciar producción). Stage 1+2 debe cubrir el FOB completo (al fin de producción). Stage 3 cubre logística + aduana al arribo.</p>
        </div>
        {minStage12>0&&minStage12<100&&<button onClick={adjustToMinSafe} style={{padding:"7px 12px",fontSize:11,fontWeight:700,borderRadius:7,border:"1px solid rgba(96,165,250,0.4)",background:"rgba(96,165,250,0.08)",color:"#60a5fa",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Ajustar al mínimo seguro</button>}
      </div>

      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.22)",borderRadius:10,marginBottom:14,flexWrap:"wrap"}}>
        <span style={{fontSize:11.5,color:"rgba(255,255,255,0.85)",fontWeight:600}}>Anticipo al proveedor:</span>
        <input type="text" inputMode="decimal" value={supplierDepositPct} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");if(v===""||(Number(v)>=0&&Number(v)<=100))setSupplierDepositPct(v);}} style={{width:60,padding:"4px 8px",fontSize:13,fontWeight:700,textAlign:"center",border:"1px solid rgba(168,85,247,0.35)",borderRadius:6,background:"rgba(0,0,0,0.25)",color:"#a78bfa",outline:"none",fontFamily:"inherit"}}/>
        <span style={{fontSize:13,fontWeight:700,color:"#a78bfa"}}>% del FOB</span>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginLeft:6}}>· Anticipo USD <strong style={{color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalFob*supDepFrac)}</strong> · Saldo USD <strong style={{color:"#fff",fontFeatureSettings:'"tnum"'}}>{fmtUSD(totalFob*(1-supDepFrac))}</strong></span>
      </div>

      {validChannels.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{padding:"10px 14px",background:isStage1Covered?"rgba(34,197,94,0.06)":"rgba(248,113,113,0.06)",border:`1px solid ${isStage1Covered?"rgba(34,197,94,0.25)":"rgba(248,113,113,0.3)"}`,borderRadius:10}}>
          <p style={{fontSize:10.5,fontWeight:700,color:isStage1Covered?"#22c55e":"#f87171",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>{isStage1Covered?"✓ Stage 1 cubre anticipo":"⚠ Stage 1 no cubre anticipo"}</p>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.65)",margin:"3px 0 0",lineHeight:1.4}}>Necesitás <strong style={{color:"#fff"}}>{minStage1}%</strong>, plan cobra <strong style={{color:isStage1Covered?"#22c55e":"#f87171"}}>{stage1Pct}%</strong></p>
        </div>
        <div style={{padding:"10px 14px",background:isStage12Covered?"rgba(34,197,94,0.06)":"rgba(248,113,113,0.06)",border:`1px solid ${isStage12Covered?"rgba(34,197,94,0.25)":"rgba(248,113,113,0.3)"}`,borderRadius:10}}>
          <p style={{fontSize:10.5,fontWeight:700,color:isStage12Covered?"#22c55e":"#f87171",textTransform:"uppercase",letterSpacing:"0.06em",margin:0}}>{isStage12Covered?"✓ Stage 1+2 cubre FOB":"⚠ Stage 1+2 no cubre FOB"}</p>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.65)",margin:"3px 0 0",lineHeight:1.4}}>Necesitás <strong style={{color:"#fff"}}>{minStage12}%</strong>, plan cobra <strong style={{color:isStage12Covered?"#22c55e":"#f87171"}}>{stage12Pct}%</strong></p>
        </div>
      </div>}

      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {paymentPlan.map((stage,i)=>{
          const stageBadge=i===0?{l:"ANTICIPO",c:"#60a5fa",b:"rgba(96,165,250,0.12)"}:i===1?{l:"PRODUCCIÓN",c:"#a78bfa",b:"rgba(168,85,247,0.12)"}:i===2?{l:"ARRIBO",c:"#f59e0b",b:"rgba(245,158,11,0.12)"}:null;
          const errBorder=(i===0&&!isStage1Covered)||(i===1&&!isStage12Covered);
          return <div key={i} style={{flex:"1 1 200px",padding:"12px 14px",background:"rgba(0,0,0,0.18)",borderRadius:10,border:`1px solid ${errBorder?"rgba(248,113,113,0.35)":"rgba(255,255,255,0.06)"}`}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <input type="text" inputMode="numeric" value={stage.pct} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");const n=Number(v)||0;setPaymentPlan(p=>{const others=p.reduce((s,x,j)=>s+(j===i?0:Number(x.pct||0)),0);const capped=Math.min(n,Math.max(0,100-others));return p.map((s,j)=>j===i?{...s,pct:capped}:s);});}} style={{width:50,padding:"4px 6px",fontSize:14,fontWeight:700,background:"transparent",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"#fff",textAlign:"center",outline:"none"}}/>
              <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>%</span>
              {stageBadge&&<span style={{fontSize:9.5,fontWeight:700,padding:"2px 6px",borderRadius:4,background:stageBadge.b,color:stageBadge.c,letterSpacing:"0.04em",marginLeft:"auto"}}>{stageBadge.l}</span>}
            </div>
            <input value={stage.label} onChange={e=>setPaymentPlan(p=>p.map((s,j)=>j===i?{...s,label:e.target.value}:s))} style={{width:"100%",padding:"5px 8px",fontSize:11,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,color:"rgba(255,255,255,0.8)",outline:"none",fontFamily:"inherit"}}/>
          </div>;
        })}
      </div>
      <p style={{fontSize:10.5,color:"rgba(255,255,255,0.45)",marginTop:8}}>Total: <strong style={{color:paymentPlan.reduce((s,p)=>s+p.pct,0)===100?"#22c55e":"#fbbf24"}}>{paymentPlan.reduce((s,p)=>s+p.pct,0)}%</strong> {paymentPlan.reduce((s,p)=>s+p.pct,0)!==100&&<span style={{color:"#fbbf24"}}>(debe sumar 100%)</span>}</p>
    </div>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14}}>
      <button onClick={onBack} style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",fontFamily:"inherit"}}>← Volver</button>
      <button onClick={onNext} disabled={saving} style={{padding:"10px 20px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:saving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Generando…":"Generar link al cliente →"}</button>
    </div>
  </div>;
}

function WizStep3({generatedQuote,client,request,onBack}){
  const [copied,setCopied]=useState(false);
  if(!generatedQuote)return <p style={{color:"rgba(255,255,255,0.5)"}}>Sin cotización generada</p>;
  const url=`${typeof window!=="undefined"?window.location.origin:"https://argencargo.com.ar"}/cotizacion/${generatedQuote.public_token}`;
  const copy=()=>{navigator.clipboard?.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  // WhatsApp: número AR limpio + mensaje preset (mismo template que en CommunicationsTab).
  const waNumber=cleanWaNumber(client?.whatsapp||client?.phone||"");
  const firstName=client?.first_name||"";
  const code=request?.request_code||"";
  const waMsg=encodeURIComponent(buildQuoteWaMessage({firstName,code,url,expiresAt:request?.expires_at}));
  const waUrl=waNumber?`https://wa.me/${waNumber}?text=${waMsg}`:`https://wa.me/?text=${waMsg}`;
  return <div>
    <div style={{textAlign:"center",padding:"40px 30px",background:"linear-gradient(135deg,rgba(34,197,94,0.10),rgba(34,197,94,0.02))",border:"1px solid rgba(34,197,94,0.3)",borderRadius:14,marginBottom:18}}>
      <div style={{fontSize:48,marginBottom:8}}>🔗</div>
      <h2 style={{fontSize:20,fontWeight:800,marginBottom:8}}>Cotización lista</h2>
      <p style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginBottom:20}}>Compartile este link al cliente. Puede elegir servicio + entrega y aceptar online.</p>
      <div style={{display:"flex",alignItems:"center",gap:10,maxWidth:600,margin:"0 auto 14px",padding:"12px 16px",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(184,149,106,0.3)",borderRadius:10}}>
        <span style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:GOLD_LIGHT,textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</span>
        <button onClick={copy} style={{padding:"6px 12px",fontSize:11.5,fontWeight:700,borderRadius:7,border:"none",background:copied?"#22c55e":GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{copied?"✓ Copiado":"📋 Copiar"}</button>
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap",maxWidth:600,margin:"0 auto"}}>
        <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"11px 20px",fontSize:13,fontWeight:700,borderRadius:10,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",textDecoration:"none",fontFamily:"inherit",boxShadow:"0 4px 14px rgba(37,211,102,0.3)"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
          Enviar por WhatsApp{client?.whatsapp&&waNumber?` a ${firstName||"cliente"}`:""}
        </a>
      </div>
      {!waNumber&&<p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)",marginTop:10,fontStyle:"italic"}}>El cliente no tiene WhatsApp cargado — el botón te abre WhatsApp sin destinatario para que elijas a quién mandárselo.</p>}
    </div>
    <div style={{padding:"12px 16px",background:"rgba(96,165,250,0.06)",border:"1px solid rgba(96,165,250,0.22)",borderRadius:10,fontSize:12.5,color:"rgba(255,255,255,0.85)",lineHeight:1.5,marginBottom:18}}>
      <strong style={{color:"#60a5fa"}}>Próximo paso:</strong> el cliente abre el link, elige servicio + entrega y acepta. Cuando acepta, se convierte automáticamente en una operación AC-XXXX en el panel admin.
    </div>
    <div style={{display:"flex",justifyContent:"flex-end"}}>
      <button onClick={onBack} style={{padding:"9px 16px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",fontFamily:"inherit"}}>Volver al listado</button>
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
    {open&&<PhotoUploadModal token={token} onCancel={()=>setOpen(false)} onUploaded={url=>{onChange(url);setOpen(false);}}/>}
  </div>;
}

function PhotoUploadModal({token,onCancel,onUploaded}){
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
  const handleFile=async(file)=>{
    if(!file||!file.type?.startsWith("image/")){alertDialog("Solo imágenes (JPG/PNG/WebP)");return;}
    if(file.size>10*1024*1024){alertDialog("Máximo 10 MB");return;}
    // Preview inmediato
    const reader=new FileReader();reader.onload=e=>setPreview(e.target.result);reader.readAsDataURL(file);
    setUploading(true);
    try{
      const url=await uploadProductPhoto(file,token);
      if(url)onUploaded(url);
      else{alertDialog("No se pudo subir la imagen");setUploading(false);setPreview(null);}
    } catch(e){alertDialog("Error: "+e.message);setUploading(false);setPreview(null);}
  };
  const onDrop=(e)=>{e.preventDefault();e.stopPropagation();setDrag(false);const f=e.dataTransfer?.files?.[0];if(f)handleFile(f);};
  const onDragOver=(e)=>{e.preventDefault();e.stopPropagation();if(!drag)setDrag(true);};
  const onDragEnter=(e)=>{e.preventDefault();e.stopPropagation();setDrag(true);};
  const onDragLeave=(e)=>{e.preventDefault();e.stopPropagation();if(e.target===e.currentTarget)setDrag(false);};

  return <div onClick={()=>!uploading&&onCancel()} onDragOver={onDragOver} onDrop={onDrop} style={{position:"fixed",inset:0,background:"rgba(8,12,20,0.85)",backdropFilter:"blur(8px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div onClick={e=>e.stopPropagation()} onDrop={onDrop} onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave} style={{maxWidth:560,width:"100%",background:"linear-gradient(180deg,#142038,#0f1a2e)",border:`2px solid ${drag?"rgba(184,149,106,0.6)":"rgba(255,255,255,0.1)"}`,borderRadius:16,padding:"24px",boxShadow:"0 32px 80px rgba(0,0,0,0.65)",transition:"border-color 150ms"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,paddingBottom:14,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div>
          <h3 style={{fontSize:17,fontWeight:700,color:"#fff",margin:"0 0 3px"}}>Subir foto del producto</h3>
          <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",margin:0}}>Arrastrá una imagen, pegala con Cmd+V, o elegí un archivo</p>
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
                <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value="";}} style={{display:"none"}}/>
              </label>
              <span style={{padding:"9px 16px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:"rgba(255,255,255,0.6)"}}>⌘V Pegar</span>
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

