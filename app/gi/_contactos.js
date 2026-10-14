"use client";
// Contactos (proveedores, agentes, embarcadores) y Configuración de GI. Movidos desde el panel viejo.
import { useState, useEffect } from "react";
import { alertDialog, confirmDialog } from "../../lib/ui";
import { dq, fmtDate, fmtUSD, GOLD, GOLD_LIGHT, GOLD_DEEP, GOLD_GRADIENT } from "./_base";
import { lblStyle, inpStyle } from "./_cotizador";

export function ContactsPanel({token,type,title,desc,groupBy,rubroOptions,fields}){
  const tableMap={suppliers:"gi_suppliers",purchase_agents:"gi_purchase_agents",forwarders:"gi_forwarders"};
  const tableName=tableMap[type];
  const [items,setItems]=useState([]);
  const [lo,setLo]=useState(true);
  const [search,setSearch]=useState("");
  const [groupFilter,setGroupFilter]=useState("");
  const [editId,setEditId]=useState(null); // id | "new" | null
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3000);};

  const load=async()=>{
    setLo(true);
    const r=await dq(tableName,{token,filters:"?select=*&order=created_at.desc"});
    setItems(Array.isArray(r)?r:[]);
    setLo(false);
  };
  useEffect(()=>{load();},[token,type]);

  const startNew=()=>{
    const f={};fields.forEach(fl=>{f[fl.k]="";});
    setForm(f);setEditId("new");
  };
  const startEdit=(it)=>{
    const f={};fields.forEach(fl=>{
      if(fl.k==="modes_str")f[fl.k]=Array.isArray(it.modes)?it.modes.join(","):"";
      else f[fl.k]=it[fl.k]??"";
    });
    setForm(f);setEditId(it.id);
  };
  const cancel=()=>{setEditId(null);setForm({});};
  const save=async()=>{
    setSaving(true);
    const body={};
    fields.forEach(fl=>{
      if(fl.k==="modes_str"){body.modes=form.modes_str?form.modes_str.split(",").map(s=>s.trim()).filter(Boolean):null;}
      else if(fl.num){body[fl.k]=form[fl.k]!==""?Number(form[fl.k]):null;}
      else body[fl.k]=form[fl.k]||null;
    });
    if(editId==="new"){
      await dq(tableName,{method:"POST",token,body});
    } else {
      body.updated_at=new Date().toISOString();
      await dq(tableName,{method:"PATCH",token,filters:`?id=eq.${editId}`,body});
    }
    flash(editId==="new"?"Creado":"Actualizado");
    cancel();
    setSaving(false);
    load();
  };
  const remove=async(id)=>{
    if(!await confirmDialog("¿Eliminar este contacto?"))return;
    await dq(tableName,{method:"DELETE",token,filters:`?id=eq.${id}`});
    flash("Eliminado");load();
  };

  // Filter
  const filtered=items.filter(it=>{
    if(groupFilter&&it[groupBy]!==groupFilter)return false;
    if(search){
      const s=search.toLowerCase();
      const all=fields.map(fl=>String(it[fl.k]||"")).join(" ").toLowerCase();
      if(!all.includes(s))return false;
    }
    return true;
  });
  // Group
  const groups={};
  filtered.forEach(it=>{const g=it[groupBy]||"Sin clasificar";if(!groups[g])groups[g]=[];groups[g].push(it);});
  const groupKeys=Object.keys(groups).sort();

  return <div>
    {msg&&<div style={{position:"fixed",top:20,right:20,background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",padding:"10px 16px",borderRadius:10,fontSize:13,fontWeight:600,zIndex:9999,boxShadow:"0 12px 30px rgba(0,0,0,0.4)"}}>{msg}</div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:6}}>
      <div><h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>{title}</h1><p style={{fontSize:13,color:"rgba(255,255,255,0.5)",margin:0}}>{desc}</p></div>
      <button onClick={startNew} disabled={editId!==null} style={{padding:"10px 18px",fontSize:13,fontWeight:700,borderRadius:10,border:"none",background:editId!==null?"rgba(184,149,106,0.3)":GOLD_GRADIENT,color:"#0A1628",cursor:editId!==null?"not-allowed":"pointer",fontFamily:"inherit"}}>+ Nuevo</button>
    </div>

    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginTop:18,marginBottom:14}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{...inpStyle(),background:"rgba(255,255,255,0.04)",minWidth:240,flex:1,padding:"9px 12px",fontSize:12}}/>
      <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={{...inpStyle(),background:"rgba(255,255,255,0.04)",padding:"9px 12px",fontSize:12,width:"auto",minWidth:180}}>
        <option value="">Todos los {groupBy==="rubro"?"rubros":"grupos"}</option>
        {rubroOptions.map(r=><option key={r} value={r}>{r}</option>)}
      </select>
    </div>

    {editId==="new"&&<EditCard form={form} setForm={setForm} fields={fields} rubroOptions={rubroOptions} groupBy={groupBy} onSave={save} onCancel={cancel} saving={saving} isNew/>}

    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:groupKeys.length===0&&editId==="new"?null:groupKeys.length===0?<p style={{color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"3rem 0"}}>No hay contactos registrados todavía.</p>:
      groupKeys.map(g=><div key={g} style={{marginBottom:24}}>
        <h3 style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 12px"}}>{g} <span style={{color:"rgba(255,255,255,0.4)",fontWeight:500,textTransform:"none",letterSpacing:0,marginLeft:6}}>· {groups[g].length}</span></h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
          {groups[g].map(it=>editId===it.id?<EditCard key={it.id} form={form} setForm={setForm} fields={fields} rubroOptions={rubroOptions} groupBy={groupBy} onSave={save} onCancel={cancel} saving={saving}/>:<ContactCard key={it.id} item={it} fields={fields} groupBy={groupBy} onEdit={()=>startEdit(it)} onDelete={()=>remove(it.id)}/>)}
        </div>
      </div>)
    }
  </div>;
}

function ContactCard({item,fields,groupBy,onEdit,onDelete}){
  const tagField=fields.find(f=>f.k===groupBy);
  const tagVal=item[groupBy];
  return <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"14px 16px",display:"flex",flexDirection:"column",gap:8,transition:"all 150ms"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(184,149,106,0.3)";e.currentTarget.style.background="rgba(184,149,106,0.04)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";e.currentTarget.style.background="rgba(255,255,255,0.025)";}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
      <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>{item.name||"—"}</span>
      {tagVal&&<span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:5,background:"rgba(184,149,106,0.1)",color:GOLD_LIGHT,letterSpacing:"0.03em"}}>{tagVal}</span>}
    </div>
    {fields.filter(f=>f.k!=="name"&&f.k!==groupBy&&!f.textarea).map(f=>{
      const v=item[f.k];
      if(!v||v==="")return null;
      const display=Array.isArray(v)?v.join(", "):v;
      return <p key={f.k} style={{fontSize:11.5,color:"rgba(255,255,255,0.6)",margin:0}}>{f.l}: <span style={{color:"#fff"}}>{display}</span></p>;
    })}
    {item.notes&&<p style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontStyle:"italic",lineHeight:1.5}}>{item.notes}</p>}
    <div style={{display:"flex",gap:6,marginTop:6,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
      <button onClick={onEdit} style={{flex:1,padding:"5px 10px",fontSize:11,fontWeight:600,borderRadius:6,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",fontFamily:"inherit"}}>Editar</button>
      <button onClick={onDelete} style={{padding:"5px 10px",fontSize:11,fontWeight:600,borderRadius:6,border:"1px solid rgba(248,113,113,0.25)",background:"transparent",color:"#f87171",cursor:"pointer",fontFamily:"inherit"}}>✕</button>
    </div>
  </div>;
}

function EditCard({form,setForm,fields,rubroOptions,groupBy,onSave,onCancel,saving,isNew}){
  return <div style={{background:"rgba(184,149,106,0.06)",border:"1.5px solid rgba(184,149,106,0.3)",borderRadius:12,padding:"16px 18px",gridColumn:"span 2",marginBottom:18}}>
    <h4 style={{fontSize:13,fontWeight:700,color:GOLD_LIGHT,textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 14px"}}>{isNew?"Nuevo contacto":"Editar contacto"}</h4>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
      {fields.map(f=><div key={f.k} style={f.textarea?{gridColumn:"span 2"}:{}}>
        <label style={lblStyle()}>{f.l}{f.req?" *":""}</label>
        {f.textarea?
          <textarea value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} rows={3} style={{...inpStyle(),resize:"vertical"}}/>:
          (f.options||(f.select&&rubroOptions))?
            <select value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={inpStyle()}>
              <option value="">— elegir —</option>
              {(f.options||rubroOptions).map(o=><option key={o} value={o}>{o}</option>)}
            </select>:
            <input value={form[f.k]||""} onChange={e=>{const v=e.target.value;if(f.num){if(v===""||/^-?\d*\.?\d*$/.test(v))setForm(p=>({...p,[f.k]:v}));}else setForm(p=>({...p,[f.k]:v}));}} placeholder={f.placeholder||""} inputMode={f.num?"decimal":undefined} style={inpStyle()}/>}
      </div>)}
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14,paddingTop:14,borderTop:"1px solid rgba(184,149,106,0.2)"}}>
      <button onClick={onCancel} style={{padding:"8px 14px",fontSize:12,fontWeight:600,borderRadius:7,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
      <button onClick={onSave} disabled={saving} style={{padding:"8px 16px",fontSize:12,fontWeight:700,borderRadius:7,border:"none",background:saving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Guardando…":"Guardar"}</button>
    </div>
  </div>;
}

// ────────────────────────────────────────────
// PANE: SETTINGS (Tarifas + Oficina + T&C)
// ────────────────────────────────────────────
export function PaneSettings({token}){
  return <div>
    <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",margin:"0 0 4px"}}>Configuración</h1>
    <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:22}}>Tarifas de envío, tipo de cambio estimado, datos de oficina y términos &amp; condiciones.</p>
    <SettingsRates token={token}/>
    <SettingsFx token={token}/>
    <SettingsOffice token={token}/>
    <SettingsTerms token={token}/>
  </div>;
}

function SettingsFx({token}){
  const [data,setData]=useState(null);
  const [val,setVal]=useState("");
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3000);};
  useEffect(()=>{(async()=>{
    try{
      const r=await dq("gi_settings",{token,filters:"?select=*&limit=1"});
      if(Array.isArray(r)&&r[0]){setData(r[0]);setVal(r[0].default_fx_rate?String(r[0].default_fx_rate):"");}
    }catch(e){console.error("SettingsFx load",e);}
  })();},[token]);
  const save=async()=>{
    setSaving(true);
    try{
      let row=data;
      if(!row?.id){
        const r=await dq("gi_settings",{token,filters:"?select=*&limit=1"});
        if(Array.isArray(r)&&r[0])row=r[0];
      }
      if(!row?.id){flash("No hay registro de gi_settings");setSaving(false);return;}
      await dq("gi_settings",{method:"PATCH",token,filters:`?id=eq.${row.id}`,body:{default_fx_rate:val?Number(val):null,updated_at:new Date().toISOString()}});
      setData({...row,default_fx_rate:val?Number(val):null});
      flash("Guardado");
    }catch(e){console.error(e);flash("Error al guardar");}
    setSaving(false);
  };
  return <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18,position:"relative"}}>
    {msg&&<div style={{position:"absolute",top:14,right:14,background:"rgba(34,197,94,0.18)",border:"1px solid rgba(34,197,94,0.4)",color:"#22c55e",padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600}}>{msg}</div>}
    <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Tipo de cambio estimado (ARS → USD)</h3>
    <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5}}>Se usa para estimar costos en pesos pendientes de dolarizar (ej. tarjeta de crédito) cuando se cierra una operación. Cuando dolarices el pago real, la comisión se recalcula automáticamente. Si lo dejás vacío, se toma el último FX cargado en la base.</p>
    <div style={{display:"flex",alignItems:"end",gap:12}}>
      <div style={{flex:1,maxWidth:240}}>
        <Field2 label="ARS por 1 USD" v={val} on={setVal}/>
      </div>
      <button onClick={save} disabled={saving} style={{padding:"8px 18px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",background:saving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Guardando…":"Guardar"}</button>
    </div>
  </div>;
}

function SettingsRates({token}){
  const [rates,setRates]=useState([]);
  const [lo,setLo]=useState(true);
  const [editId,setEditId]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3000);};

  const load=async()=>{
    setLo(true);
    const r=await dq("gi_shipping_rates",{token,filters:"?select=*&order=display_order.asc"});
    setRates(Array.isArray(r)?r:[]);
    setLo(false);
  };
  useEffect(()=>{load();},[token]);

  const startEdit=(r)=>{
    setEditId(r.id);
    setEditForm({zone:r.zone||"",max_kg:r.max_kg||"",max_cbm:r.max_cbm||"",cost_usd:r.cost_usd||"",cost_ars:r.cost_ars||"",notes:r.notes||""});
  };
  const cancelEdit=()=>{setEditId(null);setEditForm({});};
  const saveEdit=async()=>{
    setSaving(true);
    const body={
      zone:editForm.zone,
      max_kg:editForm.max_kg!==""?Number(editForm.max_kg):null,
      max_cbm:editForm.max_cbm!==""?Number(editForm.max_cbm):null,
      cost_usd:editForm.cost_usd!==""?Number(editForm.cost_usd):null,
      cost_ars:editForm.cost_ars!==""?Number(editForm.cost_ars):null,
      notes:editForm.notes||null,
    };
    if(editId==="new"){
      body.display_order=rates.length+1;
      await dq("gi_shipping_rates",{method:"POST",token,body});
      flash("Tarifa creada");
    } else {
      await dq("gi_shipping_rates",{method:"PATCH",token,filters:`?id=eq.${editId}`,body});
      flash("Tarifa actualizada");
    }
    cancelEdit();
    setSaving(false);
    load();
  };
  const removeRate=async(id)=>{
    if(!await confirmDialog("¿Borrar esta tarifa?"))return;
    await dq("gi_shipping_rates",{method:"DELETE",token,filters:`?id=eq.${id}`});
    flash("Tarifa eliminada");
    load();
  };
  const addNew=()=>{
    setEditId("new");
    setEditForm({zone:"",max_kg:"",max_cbm:"",cost_usd:"",cost_ars:"",notes:""});
  };

  return <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18,position:"relative"}}>
    {msg&&<div style={{position:"absolute",top:14,right:14,background:"rgba(34,197,94,0.18)",border:"1px solid rgba(34,197,94,0.4)",color:"#22c55e",padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600}}>{msg}</div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>Tarifas de envío a domicilio</h3>
      <button onClick={addNew} disabled={editId!==null} style={{padding:"6px 12px",fontSize:11.5,fontWeight:700,borderRadius:8,border:"none",background:editId!==null?"rgba(184,149,106,0.3)":GOLD_GRADIENT,color:"#0A1628",cursor:editId!==null?"not-allowed":"pointer",fontFamily:"inherit"}}>+ Nueva tarifa</button>
    </div>
    <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5}}>Aplican cuando el cliente elige &quot;envío a domicilio&quot; en la cotización. El sistema toma el peso facturable y le suma el costo según la zona.</p>
    {lo?<p style={{color:"rgba(255,255,255,0.4)"}}>Cargando…</p>:
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
        <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Zona</th>
          <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Hasta kg</th>
          <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Hasta CBM</th>
          <th style={{textAlign:"right",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>USD</th>
          <th style={{textAlign:"right",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>ARS</th>
          <th style={{textAlign:"left",padding:"10px 12px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Notas</th>
          <th></th>
        </tr></thead>
        <tbody>
          {rates.map(r=>editId===r.id?
            <tr key={r.id}>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.zone} on={v=>setEditForm(f=>({...f,zone:v}))}/></td>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.max_kg} on={v=>setEditForm(f=>({...f,max_kg:v}))} num/></td>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.max_cbm} on={v=>setEditForm(f=>({...f,max_cbm:v}))} num/></td>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.cost_usd} on={v=>setEditForm(f=>({...f,cost_usd:v}))} num/></td>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.cost_ars} on={v=>setEditForm(f=>({...f,cost_ars:v}))} num/></td>
              <td style={{padding:"8px 10px"}}><EditInp v={editForm.notes} on={v=>setEditForm(f=>({...f,notes:v}))}/></td>
              <td style={{padding:"8px 10px",textAlign:"right",whiteSpace:"nowrap"}}>
                <button onClick={saveEdit} disabled={saving} style={{padding:"4px 9px",fontSize:10.5,fontWeight:700,borderRadius:5,border:"none",background:GOLD_GRADIENT,color:"#0A1628",cursor:"pointer",marginRight:4}}>✓</button>
                <button onClick={cancelEdit} style={{padding:"4px 9px",fontSize:10.5,borderRadius:5,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer"}}>✕</button>
              </td>
            </tr>:
            <tr key={r.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <td style={{padding:"11px 12px",fontWeight:600,color:"#fff"}}>{r.zone}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.7)",fontFeatureSettings:'"tnum"'}}>{r.max_kg?(r.max_kg>=9999?"+":r.max_kg+" kg"):"—"}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.7)",fontFeatureSettings:'"tnum"'}}>{r.max_cbm?(r.max_cbm>=9999?"+":r.max_cbm+" m³"):"—"}</td>
              <td style={{padding:"11px 12px",color:GOLD_LIGHT,fontWeight:600,textAlign:"right",fontFeatureSettings:'"tnum"'}}>{r.cost_usd?fmtUSD(r.cost_usd):"—"}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.7)",textAlign:"right",fontFeatureSettings:'"tnum"'}}>{r.cost_ars?"ARS "+Number(r.cost_ars).toLocaleString("es-AR"):"—"}</td>
              <td style={{padding:"11px 12px",color:"rgba(255,255,255,0.5)",fontStyle:r.notes?"italic":"normal"}}>{r.notes||"—"}</td>
              <td style={{padding:"11px 12px",textAlign:"right",whiteSpace:"nowrap"}}>
                <button onClick={()=>startEdit(r)} style={{padding:"4px 9px",fontSize:10.5,borderRadius:5,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.65)",cursor:"pointer",marginRight:4,fontFamily:"inherit"}}>✎</button>
                <button onClick={()=>removeRate(r.id)} style={{padding:"4px 9px",fontSize:10.5,borderRadius:5,border:"1px solid rgba(248,113,113,0.25)",background:"transparent",color:"#f87171",cursor:"pointer",fontFamily:"inherit"}}>✕</button>
              </td>
            </tr>
          )}
          {editId==="new"&&<tr style={{background:"rgba(184,149,106,0.04)"}}>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.zone} on={v=>setEditForm(f=>({...f,zone:v}))} ph="Zona"/></td>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.max_kg} on={v=>setEditForm(f=>({...f,max_kg:v}))} num ph="50"/></td>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.max_cbm} on={v=>setEditForm(f=>({...f,max_cbm:v}))} num ph="0.3"/></td>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.cost_usd} on={v=>setEditForm(f=>({...f,cost_usd:v}))} num ph="35"/></td>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.cost_ars} on={v=>setEditForm(f=>({...f,cost_ars:v}))} num ph="38500"/></td>
            <td style={{padding:"8px 10px"}}><EditInp v={editForm.notes} on={v=>setEditForm(f=>({...f,notes:v}))} ph="Opcional"/></td>
            <td style={{padding:"8px 10px",textAlign:"right",whiteSpace:"nowrap"}}>
              <button onClick={saveEdit} disabled={saving||!editForm.zone} style={{padding:"4px 9px",fontSize:10.5,fontWeight:700,borderRadius:5,border:"none",background:!editForm.zone?"rgba(184,149,106,0.3)":GOLD_GRADIENT,color:"#0A1628",cursor:!editForm.zone?"not-allowed":"pointer",marginRight:4}}>✓</button>
              <button onClick={cancelEdit} style={{padding:"4px 9px",fontSize:10.5,borderRadius:5,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.6)",cursor:"pointer"}}>✕</button>
            </td>
          </tr>}
        </tbody>
      </table>
    }
  </div>;
}

function EditInp({v,on,num,ph}){
  return <input value={v||""} onChange={e=>{const val=e.target.value;if(num){if(val===""||/^-?\d*\.?\d*$/.test(val))on(val);}else on(val);}} placeholder={ph||""} style={{width:"100%",padding:"6px 8px",fontSize:11.5,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:5,background:"rgba(0,0,0,0.25)",color:"#fff",outline:"none",fontFamily:"inherit"}}/>;
}

function SettingsOffice({token}){
  const [data,setData]=useState(null);
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3000);};

  useEffect(()=>{(async()=>{
    const r=await dq("gi_settings",{token,filters:"?select=*&limit=1"});
    if(Array.isArray(r)&&r[0]){setData(r[0]);setForm({office_address:r[0].office_address||"",office_locality:r[0].office_locality||"",office_hours:r[0].office_hours||"",office_phone:r[0].office_phone||""});}
  })();},[token]);

  const save=async()=>{
    if(!data?.id)return;
    setSaving(true);
    await dq("gi_settings",{method:"PATCH",token,filters:`?id=eq.${data.id}`,body:{...form,updated_at:new Date().toISOString()}});
    flash("Guardado");
    setSaving(false);
  };

  if(!data)return null;
  return <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18,position:"relative"}}>
    {msg&&<div style={{position:"absolute",top:14,right:14,background:"rgba(34,197,94,0.18)",border:"1px solid rgba(34,197,94,0.4)",color:"#22c55e",padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600}}>{msg}</div>}
    <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Datos de retiro por oficina</h3>
    <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5}}>Aparecen en la cotización al cliente cuando elige &quot;retiro por oficina&quot;.</p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <Field2 label="Dirección" v={form.office_address} on={v=>setForm(f=>({...f,office_address:v}))}/>
      <Field2 label="Localidad" v={form.office_locality} on={v=>setForm(f=>({...f,office_locality:v}))}/>
      <Field2 label="Horario" v={form.office_hours} on={v=>setForm(f=>({...f,office_hours:v}))}/>
      <Field2 label="Teléfono / WhatsApp" v={form.office_phone} on={v=>setForm(f=>({...f,office_phone:v}))}/>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}>
      <button onClick={save} disabled={saving} style={{padding:"8px 18px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",background:saving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Guardando…":"Guardar cambios"}</button>
    </div>
  </div>;
}

function SettingsTerms({token}){
  const [data,setData]=useState(null);
  const [text,setText]=useState("");
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const flash=(t)=>{setMsg(t);setTimeout(()=>setMsg(""),3000);};
  useEffect(()=>{(async()=>{
    const r=await dq("gi_settings",{token,filters:"?select=*&limit=1"});
    if(Array.isArray(r)&&r[0]){setData(r[0]);setText(r[0].terms_and_conditions||"");}
  })();},[token]);

  const save=async()=>{
    if(!data?.id)return;
    setSaving(true);
    await dq("gi_settings",{method:"PATCH",token,filters:`?id=eq.${data.id}`,body:{terms_and_conditions:text,updated_at:new Date().toISOString()}});
    flash("Guardado");
    setSaving(false);
  };

  if(!data)return null;
  return <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,marginBottom:18,position:"relative"}}>
    {msg&&<div style={{position:"absolute",top:14,right:14,background:"rgba(34,197,94,0.18)",border:"1px solid rgba(34,197,94,0.4)",color:"#22c55e",padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600}}>{msg}</div>}
    <h3 style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 6px"}}>Términos y condiciones</h3>
    <p style={{fontSize:11.5,color:"rgba(255,255,255,0.5)",marginBottom:14,lineHeight:1.5}}>Aparecen en la cotización del cliente, en el desplegable de T&amp;C. Acepta saltos de línea.</p>
    <textarea value={text} onChange={e=>setText(e.target.value)} rows={14} style={{width:"100%",padding:"12px 14px",fontSize:12.5,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,background:"rgba(0,0,0,0.25)",color:"#fff",outline:"none",fontFamily:"'JetBrains Mono','SF Mono',monospace",lineHeight:1.6,resize:"vertical"}}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,flexWrap:"wrap",gap:10}}>
      <p style={{fontSize:10.5,color:"rgba(255,255,255,0.4)"}}>Última edición: {fmtDate(data.updated_at)}</p>
      <button onClick={save} disabled={saving} style={{padding:"8px 18px",fontSize:12,fontWeight:700,borderRadius:8,border:"none",background:saving?"rgba(184,149,106,0.4)":GOLD_GRADIENT,color:"#0A1628",cursor:saving?"wait":"pointer",fontFamily:"inherit"}}>{saving?"Guardando…":"Guardar"}</button>
    </div>
  </div>;
}

function Field2({label,v,on}){
  return <div>
    <label style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:5}}>{label}</label>
    <input value={v||""} onChange={e=>on(e.target.value)} style={{width:"100%",padding:"9px 12px",fontSize:13,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,background:"rgba(255,255,255,0.04)",color:"#fff",outline:"none",fontFamily:"inherit"}}/>
  </div>;
}
