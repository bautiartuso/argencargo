"use client";
// Planilla compartida con el depósito de China (28/09/2026). Link único por depósito, sin
// contraseña, en castellano y chino. El depósito ve lo que viene en camino, lo que tiene en el
// depósito y los contenedores en viaje; su única tarea es marcar el día que llegó cada carga y
// confirmar si es mercadería blanca o negra (de eso depende lo que cobra).
import { useState, useEffect, useMemo, useCallback } from "react";

const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const NAVY = "#0A1628";
const NAVY_2 = "#142038";
const GOLD = "#B8956A";
const GOLD_B = "#E8D098";
const CREAM = "#f7f5ef";
const CARD = "#ffffff";
const LINE = "#e8e2d4";
const INK = "#1a1d24";
const MUTED = "#7a7362";
const GREEN = "#15803d";
const AMBER = "#b45309";
const BLUE = "#1d4ed8";

const T = {
  es: {
    sub: "Planilla del depósito",
    camino: "En camino al depósito", deposito: "En depósito", contenedores: "Contenedores",
    camino_hint: "Mercadería que el proveedor ya despachó. Cuando llegue, tocá Llegó.",
    deposito_hint: "Mercadería que ya está en el depósito, lista para cargar en un contenedor.",
    cont_hint: "Contenedores que ya salieron hacia Buenos Aires.",
    buscar: "Buscar cliente, tracking o mercadería", todas: "Todas",
    blanca: "Blanca", negra: "Negra",
    rotulo: "Rótulo", tracking: "Tracking", mercaderia: "Mercadería", valor: "Valor", bultos: "Bultos", cbm: "m³", costo: "Costo depósito", tipo: "Tipo", estado: "Estado", foto: "Foto",
    llego: "Llegó", llego_el: "Llegó", deshacer: "Deshacer", deshacer_q: "¿Deshacer la llegada de esta carga?",
    confirmar_llegada: "Confirmar llegada", fecha_llegada: "¿Qué día llegó?", hoy: "Hoy", ayer: "Ayer",
    tipo_q: "¿Qué mercadería es?", tipo_cargado: "Nosotros la cargamos como", tipo_otro: "Si no es correcto, elegí la otra.", tipo_elegi: "Elegí si es blanca o negra.",
    confirmar: "Confirmar", cancelar: "Cancelar", guardar: "Guardar",
    sin_foto: "Sin foto", detalle: "Detalle", medidas: "Medidas de los bultos", productos: "Productos", sin_medidas: "Sin medidas cargadas", sin_productos: "Sin detalle de productos",
    confirmado: "Confirmado", a_confirmar: "Se confirma al llegar", sin_confirmar: "Sin confirmar", confirmar_tipo: "Confirmar tipo", corregido: "Corregido por el depósito",
    desc: "desc.", total: "Total", cargas: "cargas", carga: "carga",
    salio: "Salió", eta: "Llega a Buenos Aires", naviera: "Naviera",
    vacio_camino: "No hay mercadería en camino.", vacio_deposito: "El depósito está vacío.", vacio_cont: "No hay contenedores en viaje.", vacio_busqueda: "Nada coincide con la búsqueda.",
    excel: "Excel", actualizar: "Actualizar", cargando: "Cargando…",
    link_invalido: "Este link no es válido. Pedile uno nuevo a Argencargo.",
    error: "No se pudo guardar. Probá de nuevo.", guardado: "Guardado",
    tarifa: "Tarifa", por_m3: "por m³", desc_regla: (p, m) => `${p}% de descuento si la carga supera ${m} m³`,
    fragil: "Frágil", reenvio: "Reenvío", n_fotos: (n) => `${n} fotos`,
    contenedor: "Contenedor",
  },
  zh: {
    sub: "仓库货物表",
    camino: "运往仓库途中", deposito: "已入仓", contenedores: "集装箱",
    camino_hint: "供应商已发货的货物。到货后请点击「已到货」。",
    deposito_hint: "已在仓库的货物，等待装柜。",
    cont_hint: "已开往布宜诺斯艾利斯的集装箱。",
    buscar: "搜索客户、快递单号或货物", todas: "全部",
    blanca: "正规报关", negra: "包税",
    rotulo: "唛头", tracking: "快递单号", mercaderia: "货物", valor: "货值", bultos: "件数", cbm: "立方", costo: "仓库费用", tipo: "类型", estado: "状态", foto: "照片",
    llego: "已到货", llego_el: "到货", deshacer: "撤销", deshacer_q: "确定撤销这票货的到货记录吗？",
    confirmar_llegada: "确认到货", fecha_llegada: "哪天到的？", hoy: "今天", ayer: "昨天",
    tipo_q: "这是什么货？", tipo_cargado: "我们登记的是", tipo_otro: "如不正确，请选另一种。", tipo_elegi: "请选择正规报关或包税。",
    confirmar: "确认", cancelar: "取消", guardar: "保存",
    sin_foto: "暂无照片", detalle: "详情", medidas: "箱规", productos: "产品", sin_medidas: "未登记尺寸", sin_productos: "未登记产品明细",
    confirmado: "已确认", a_confirmar: "到货时确认", sin_confirmar: "待确认", confirmar_tipo: "确认类型", corregido: "仓库已更正",
    desc: "优惠", total: "合计", cargas: "票", carga: "票",
    salio: "开船", eta: "预计到达布宜诺斯艾利斯", naviera: "船公司",
    vacio_camino: "暂无在途货物。", vacio_deposito: "仓库暂无货物。", vacio_cont: "暂无在途集装箱。", vacio_busqueda: "没有符合搜索条件的货物。",
    excel: "Excel", actualizar: "刷新", cargando: "加载中…",
    link_invalido: "链接无效，请联系 Argencargo 获取新链接。",
    error: "保存失败，请重试。", guardado: "已保存",
    tarifa: "费率", por_m3: "每立方", desc_regla: (p, m) => `单票超过 ${m} 立方优惠 ${p}%`,
    fragil: "易碎", reenvio: "转运", n_fotos: (n) => `${n} 张照片`,
    contenedor: "集装箱",
  },
};

const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const menosDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ddmm = (iso) => { if (!iso) return "—"; const s = String(iso).slice(0, 10).split("-"); return `${s[2]}/${s[1]}`; };

export default function DepositoPage({ params }) {
  const token = params.token;
  const [lang, setLang] = useState("es");
  const t = T[lang];
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("camino");
  const [q, setQ] = useState("");
  const [tipoF, setTipoF] = useState("todas");
  const [abiertos, setAbiertos] = useState(new Set());
  const [llegada, setLlegada] = useState(null); // carga a la que se le marca la llegada
  const [tipoModal, setTipoModal] = useState(null); // carga a la que se le confirma el tipo
  const [deshacerQ, setDeshacerQ] = useState(null);
  const [foto, setFoto] = useState(null); // {fotos, i}
  const [aviso, setAviso] = useState(null); // {txt, ok}

  useEffect(() => {
    let l = null;
    try { l = localStorage.getItem("dep_lang"); } catch {}
    if (l === "es" || l === "zh") setLang(l);
    else if (typeof navigator !== "undefined" && /^zh/i.test(navigator.language || "")) setLang("zh");
  }, []);
  const cambiarLang = (l) => { setLang(l); try { localStorage.setItem("dep_lang", l); } catch {} };

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/deposito/${token}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) { setErr(j?.error || "error"); return; }
      setErr(""); setData(j);
    } catch { setErr("red"); }
  }, [token]);
  useEffect(() => { cargar(); const iv = setInterval(cargar, 60000); return () => clearInterval(iv); }, [cargar]);

  const avisar = (txt, ok = true) => { setAviso({ txt, ok }); setTimeout(() => setAviso(null), 2600); };
  const accion = async (body) => {
    try {
      const r = await fetch(`/api/deposito/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      avisar(t.guardado); await cargar(); return true;
    } catch { avisar(t.error, false); return false; }
  };

  const fmtUsd = (v) => {
    const n = Number(v || 0);
    return lang === "zh"
      ? `US$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `USD ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const fmtM3 = (v) => Number(v || 0).toLocaleString(lang === "zh" ? "en-US" : "es-AR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmtN = (v) => Number(v || 0).toLocaleString(lang === "zh" ? "en-US" : "es-AR");

  const cargas = data?.cargas || [];
  const filtrar = (lista) => {
    const s = q.trim().toLowerCase();
    return lista.filter((c) => (tipoF === "todas" || c.tipo === tipoF) && (!s || `${c.cliente || ""} ${c.tracking || ""} ${c.mercaderia || ""} ${c.numero || ""}`.toLowerCase().includes(s)));
  };
  const porEtapa = useMemo(() => ({
    camino: cargas.filter((c) => c.etapa === "camino"),
    deposito: cargas.filter((c) => c.etapa === "deposito").sort((a, b) => String(a.llego || "").localeCompare(String(b.llego || ""))),
    contenedor: cargas.filter((c) => c.etapa === "contenedor"),
  }), [cargas]);
  const totales = (lista) => ({
    n: lista.length,
    bultos: lista.reduce((a, c) => a + c.bultos, 0),
    cbm: lista.reduce((a, c) => a + c.cbm, 0),
    valor: lista.reduce((a, c) => a + c.valor, 0),
    costo: lista.reduce((a, c) => a + (c.costo?.total || 0), 0),
  });

  const rotuloDe = (c) => (data?.deposito?.rotulo || "").toUpperCase();
  const tipoTxt = (tp) => (tp === "blanca" ? t.blanca : tp === "negra" ? t.negra : "—");

  const exportar = () => {
    const conts = Object.fromEntries((data?.contenedores || []).map((c) => [c.id, c.codigo]));
    const lista = tab === "contenedores" ? filtrar(porEtapa.contenedor) : filtrar(porEtapa[tab] || []);
    const cols = [
      ...(tab === "contenedores" ? [t.contenedor] : []),
      t.rotulo, t.tracking, t.mercaderia, `${t.valor} (USD)`, t.bultos, t.cbm, t.tipo, `${t.costo} (USD)`, ...(tab === "camino" ? [] : [t.llego_el]),
    ];
    const esc = (v) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const filas = lista.map((c) => [
      ...(tab === "contenedores" ? [conts[c.contenedor] || ""] : []),
      `${rotuloDe(c)} ${c.cliente || ""}`.trim(), c.tracking || "", c.mercaderia || "", c.valor.toFixed(2), c.bultos, c.cbm.toFixed(3), tipoTxt(c.tipo), (c.costo?.total || 0).toFixed(2), ...(tab === "camino" ? [] : [c.llego || ""]),
    ]);
    const csv = "﻿" + [cols, ...filas].map((f) => f.map(esc).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${(data?.deposito?.nombre || "deposito").replace(/[^\w-]+/g, "_")}_${tab}_${hoyLocal()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  if (err === "link_invalido") return <Centro><p style={{ fontSize: 15, color: INK, margin: 0 }}>{T.es.link_invalido}</p><p style={{ fontSize: 15, color: INK, margin: "8px 0 0" }}>{T.zh.link_invalido}</p></Centro>;
  if (!data) return <Centro><p style={{ color: MUTED, fontSize: 14, margin: 0 }}>{err ? t.error : t.cargando}</p></Centro>;

  const dep = data.deposito;
  const tabs = [
    { k: "camino", l: t.camino, ic: "🚚", lista: porEtapa.camino },
    { k: "deposito", l: t.deposito, ic: "📦", lista: porEtapa.deposito },
    { k: "contenedores", l: t.contenedores, ic: "🚢", lista: porEtapa.contenedor, n: (data.contenedores || []).length },
  ];

  const Tipo = ({ c }) => {
    if (!c.tipo) return <span className="dp-tipo dp-tipo-x">—</span>;
    const b = c.tipo === "blanca";
    return <span className={`dp-tipo ${b ? "dp-tipo-b" : "dp-tipo-n"}`}>{b ? "◻" : "◼"} {tipoTxt(c.tipo)}</span>;
  };

  const Fila = ({ c, etapa }) => {
    const abierto = abiertos.has(c.id);
    const toggle = () => setAbiertos((p) => { const n = new Set(p); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; });
    const costo = c.costo || {};
    return <div className={`dp-fila${abierto ? " dp-abierta" : ""}`}>
      <div className="dp-grid" onClick={toggle}>
        <div className="dp-c-foto" onClick={(e) => { e.stopPropagation(); if (c.fotos.length) setFoto({ fotos: c.fotos, i: 0 }); }}>
          {c.fotos.length
            ? <div className="dp-foto" style={{ backgroundImage: `url(${c.fotos[0]})` }}>{c.fotos.length > 1 && <span className="dp-foto-n">+{c.fotos.length - 1}</span>}</div>
            : <div className="dp-foto dp-foto-vacia"><span style={{ fontSize: 22 }}>📦</span><span style={{ fontSize: 10.5 }}>{t.sin_foto}</span></div>}
        </div>
        <div className="dp-c-info">
          <div className="dp-rotulo">
            {dep.rotulo && <span className="dp-rot-pre">{rotuloDe(c)}</span>}
            <span className="dp-rot-cli">{c.cliente || "—"}</span>
            {c.fragil && <span className="dp-flag" style={{ color: AMBER, borderColor: "#f3d9a8", background: "#fdf6e8" }}>{t.fragil}</span>}
            {c.reenvio && <span className="dp-flag" style={{ color: "#9a3412", borderColor: "#f5c9a8", background: "#fdf0e6" }}>{t.reenvio}</span>}
          </div>
          <div className="dp-track">{c.tracking || "—"}</div>
          <div className="dp-merc">{c.mercaderia || "—"}</div>
        </div>
        <div className="dp-c-num" data-l={t.valor}><b>{c.valor > 0 ? fmtUsd(c.valor) : "—"}</b></div>
        <div className="dp-c-num" data-l={t.bultos}><b>{c.bultos || "—"}</b></div>
        <div className="dp-c-num" data-l={t.cbm}><b>{c.cbm > 0 ? fmtM3(c.cbm) : "—"}</b></div>
        <div className="dp-c-num" data-l={t.costo}>
          <b style={{ color: NAVY }}>{costo.total > 0 ? fmtUsd(costo.total) : "—"}</b>
          {costo.total > 0 && <small>{fmtN(costo.rate)} {t.por_m3}{costo.descuento > 0 ? ` · −${dep.descuento_pct}%` : ""}</small>}
        </div>
        <div className="dp-c-tipo" data-l={t.tipo} onClick={(e) => e.stopPropagation()}>
          <Tipo c={c} />
          {etapa === "camino"
            ? <small style={{ color: MUTED }}>{t.a_confirmar}</small>
            : c.tipo_confirmado
              ? <small style={{ color: c.tipo_corregido ? AMBER : GREEN }}>{c.tipo_corregido ? `✎ ${t.corregido}` : `✓ ${t.confirmado}`}</small>
              : etapa === "deposito" && <button className="dp-link" onClick={() => setTipoModal(c)}>{t.confirmar_tipo}</button>}
        </div>
        <div className="dp-c-acc" onClick={(e) => e.stopPropagation()}>
          {etapa === "camino" && <button className="dp-btn-llego" onClick={() => setLlegada(c)}>✓ {t.llego}</button>}
          {etapa !== "camino" && <div className="dp-llego-ok">
            <span>✓ {t.llego_el} <b>{ddmm(c.llego)}</b></span>
            {etapa === "deposito" && c.llego_por_deposito && <button className="dp-link" style={{ color: MUTED }} onClick={() => setDeshacerQ(c)}>{t.deshacer}</button>}
          </div>}
          <button className="dp-link dp-det" onClick={toggle}>{abierto ? "▴" : "▾"} {t.detalle}</button>
        </div>
      </div>
      {abierto && <div className="dp-detalle">
        <div>
          <p className="dp-det-t">{t.medidas}</p>
          {c.medidas.length === 0 ? <p className="dp-det-v">{t.sin_medidas}</p> : <table className="dp-det-tb"><tbody>
            {c.medidas.map((m, i) => <tr key={i}><td>×{m.q}</td><td>{m.l} × {m.w} × {m.h} cm</td><td style={{ textAlign: "right" }}>{fmtM3(m.cbm)} {t.cbm}</td></tr>)}
          </tbody></table>}
        </div>
        <div>
          <p className="dp-det-t">{t.productos}</p>
          {c.productos.length === 0 ? <p className="dp-det-v">{t.sin_productos}</p> : <table className="dp-det-tb"><tbody>
            {c.productos.map((p, i) => <tr key={i}><td>{p.d}</td><td style={{ whiteSpace: "nowrap" }}>{fmtN(p.q)} × {fmtUsd(p.u)}</td><td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmtUsd(p.q * p.u)}</td></tr>)}
          </tbody></table>}
          {costo.total > 0 && <p className="dp-det-v" style={{ marginTop: 10 }}>{t.costo}: {fmtM3(c.cbm)} {t.cbm} × {fmtUsd(costo.rate)} = {fmtUsd(costo.bruto)}{costo.descuento > 0 ? ` − ${dep.descuento_pct}% ${t.desc} (${fmtUsd(costo.descuento)}) = ${fmtUsd(costo.total)}` : ""}</p>}
        </div>
      </div>}
    </div>;
  };

  const Encabezado = ({ etapa }) => <div className="dp-grid dp-head">
    <div>{t.foto}</div><div>{t.rotulo} · {t.tracking} · {t.mercaderia}</div><div>{t.valor}</div><div>{t.bultos}</div><div>{t.cbm}</div><div>{t.costo}</div><div>{t.tipo}</div><div>{etapa === "camino" ? "" : t.llego_el}</div>
  </div>;

  const Totales = ({ lista }) => { const s = totales(lista); if (!s.n) return null; return <div className="dp-totales">
    <span><b>{s.n}</b> {s.n === 1 ? t.carga : t.cargas}</span>
    <span><b>{fmtN(s.bultos)}</b> {t.bultos.toLowerCase()}</span>
    <span><b>{fmtM3(s.cbm)}</b> {t.cbm}</span>
    <span>{t.valor} <b>{fmtUsd(s.valor)}</b></span>
    <span className="dp-tot-costo">{t.costo} <b>{fmtUsd(s.costo)}</b></span>
  </div>; };

  const Vacio = ({ txt }) => <div className="dp-vacio">{txt}</div>;

  const listaTab = tab === "contenedores" ? null : filtrar(porEtapa[tab]);

  return <div style={{ minHeight: "100vh", background: CREAM, color: INK, fontFamily: "'Inter','PingFang SC','Microsoft YaHei',system-ui,-apple-system,sans-serif" }}>
    <style>{CSS}</style>

    {/* Encabezado */}
    <header style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_2} 100%)`, color: "#fff" }}>
      <div className="dp-wrap" style={{ paddingTop: 18, paddingBottom: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <img src={LOGO} alt="Argencargo" style={{ height: 30, width: "auto" }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "0.01em" }}>{dep.nombre}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>
            {t.sub}{dep.rotulo ? <> · {t.rotulo} <b style={{ color: GOLD_B }}>{dep.rotulo.toUpperCase()}</b></> : null}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: 3, border: "1px solid rgba(255,255,255,0.12)" }}>
            {[["es", "ES"], ["zh", "中文"]].map(([k, l]) => <button key={k} onClick={() => cambiarLang(k)} style={{ padding: "6px 14px", fontSize: 12.5, fontWeight: 700, border: "none", borderRadius: 999, cursor: "pointer", background: lang === k ? `linear-gradient(135deg, ${GOLD}, ${GOLD_B})` : "transparent", color: lang === k ? NAVY : "rgba(255,255,255,0.75)", fontFamily: "inherit" }}>{l}</button>)}
          </div>
          <button onClick={exportar} style={{ padding: "8px 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 10, border: "1px solid rgba(232,208,152,0.45)", background: "rgba(232,208,152,0.1)", color: GOLD_B, cursor: "pointer", fontFamily: "inherit" }}>⬇ {t.excel}</button>
        </div>
      </div>
      <div className="dp-wrap" style={{ paddingBottom: 14, display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: "rgba(255,255,255,0.72)" }}>
        <span>{t.tarifa}: <span className="dp-tipo dp-tipo-n" style={{ fontSize: 11 }}>◼ {t.negra}</span> <b style={{ color: "#fff" }}>{fmtUsd(dep.tarifa_negra)}</b> {t.por_m3}</span>
        <span><span className="dp-tipo dp-tipo-b" style={{ fontSize: 11 }}>◻ {t.blanca}</span> <b style={{ color: "#fff" }}>{fmtUsd(dep.tarifa_blanca)}</b> {t.por_m3}</span>
        {dep.descuento_pct > 0 && <span style={{ color: GOLD_B }}>★ {t.desc_regla(dep.descuento_pct, fmtN(dep.descuento_min_cbm))}</span>}
      </div>
    </header>

    <main className="dp-wrap" style={{ paddingTop: 20, paddingBottom: 60 }}>
      {/* Secciones */}
      <div className="dp-tabs">
        {tabs.map((x) => { const on = tab === x.k; const s = totales(x.lista); return <button key={x.k} onClick={() => setTab(x.k)} className={`dp-tab${on ? " on" : ""}`}>
          <span className="dp-tab-ic">{x.ic}</span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
            <span className="dp-tab-l">{x.l}</span>
            <span className="dp-tab-s">{x.k === "contenedores" ? `${x.n} · ${s.n} ${t.cargas}` : `${s.n} ${t.cargas} · ${fmtM3(s.cbm)} ${t.cbm}`}</span>
          </span>
        </button>; })}
      </div>

      <p style={{ fontSize: 13, color: MUTED, margin: "14px 2px 12px" }}>{tab === "camino" ? t.camino_hint : tab === "deposito" ? t.deposito_hint : t.cont_hint}</p>

      {/* Buscador + filtro de tipo */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 14 }}>⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.buscar} style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px 11px 34px", fontSize: 14, borderRadius: 12, border: `1px solid ${LINE}`, background: CARD, color: INK, outline: "none", fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 3 }}>
          {[["todas", t.todas], ["negra", t.negra], ["blanca", t.blanca]].map(([k, l]) => <button key={k} onClick={() => setTipoF(k)} style={{ padding: "8px 14px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", background: tipoF === k ? NAVY : "transparent", color: tipoF === k ? "#fff" : MUTED }}>{l}</button>)}
        </div>
      </div>

      {tab !== "contenedores" && <div className="dp-card">
        {listaTab.length > 0 && <Encabezado etapa={tab} />}
        {listaTab.length === 0
          ? <Vacio txt={porEtapa[tab].length ? t.vacio_busqueda : tab === "camino" ? t.vacio_camino : t.vacio_deposito} />
          : listaTab.map((c) => <Fila key={c.id} c={c} etapa={tab} />)}
        <Totales lista={listaTab} />
      </div>}

      {tab === "contenedores" && ((data.contenedores || []).length === 0
        ? <div className="dp-card"><Vacio txt={t.vacio_cont} /></div>
        : (data.contenedores || []).map((ct) => {
          const todas = porEtapa.contenedor.filter((c) => c.contenedor === ct.id);
          const lista = filtrar(todas);
          const s = totales(todas);
          return <div key={ct.id} className="dp-card" style={{ marginBottom: 18 }}>
            <div className="dp-cont-h">
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 22 }}>🚢</span>
                <div>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: NAVY, fontFamily: "'JetBrains Mono','SF Mono',monospace", letterSpacing: "0.02em" }}>{ct.codigo}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: MUTED }}>{[ct.naviera && `${t.naviera} ${ct.naviera}`, ct.salio && `${t.salio} ${ddmm(ct.salio)}`, ct.eta && `${t.eta} ${ddmm(ct.eta)}`].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className="dp-cont-stats">
                <span><b>{s.n}</b> {t.cargas}</span>
                <span><b>{fmtN(s.bultos)}</b> {t.bultos.toLowerCase()}</span>
                <span><b>{fmtM3(s.cbm)}</b> {t.cbm}</span>
                <span className="dp-tot-costo">{t.costo} <b>{fmtUsd(s.costo)}</b></span>
              </div>
            </div>
            {lista.length > 0 && <Encabezado etapa="contenedor" />}
            {lista.length === 0 ? <Vacio txt={todas.length ? t.vacio_busqueda : "—"} /> : lista.map((c) => <Fila key={c.id} c={c} etapa="contenedor" />)}
          </div>;
        }))}
    </main>

    {/* Modal: confirmar llegada */}
    {llegada && <ModalLlegada c={llegada} t={t} dep={dep} fmtUsd={fmtUsd} fmtM3={fmtM3} tipoTxt={tipoTxt} rotulo={rotuloDe(llegada)} onCancel={() => setLlegada(null)}
      onOk={async (fecha, tipo) => { const ok = await accion({ accion: "llego", id: llegada.id, fecha, tipo }); if (ok) setLlegada(null); return ok; }} />}

    {/* Modal: confirmar / corregir tipo */}
    {tipoModal && <ModalTipo c={tipoModal} t={t} tipoTxt={tipoTxt} onCancel={() => setTipoModal(null)}
      onOk={async (tipo) => { const ok = await accion({ accion: "tipo", id: tipoModal.id, tipo }); if (ok) setTipoModal(null); return ok; }} />}

    {/* Confirmación de deshacer */}
    {deshacerQ && <Capa onClose={() => setDeshacerQ(null)}>
      <div style={{ padding: "22px 22px 18px" }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: INK }}>{t.deshacer_q}</p>
        <p style={{ margin: "8px 0 0", fontSize: 13.5, color: MUTED }}>{deshacerQ.cliente} · {deshacerQ.tracking}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button className="dp-btn-sec" onClick={() => setDeshacerQ(null)}>{t.cancelar}</button>
          <button className="dp-btn-pri" onClick={async () => { const ok = await accion({ accion: "deshacer", id: deshacerQ.id }); if (ok) setDeshacerQ(null); }}>{t.deshacer}</button>
        </div>
      </div>
    </Capa>}

    {/* Fotos en grande */}
    {foto && <div onClick={() => setFoto(null)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,22,40,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <img src={foto.fotos[foto.i]} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "86vh", borderRadius: 12, boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }} />
      <button onClick={() => setFoto(null)} aria-label="cerrar" style={{ position: "absolute", top: 18, right: 18, width: 42, height: 42, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
      {foto.fotos.length > 1 && <>
        <button onClick={(e) => { e.stopPropagation(); setFoto((f) => ({ ...f, i: (f.i - 1 + f.fotos.length) % f.fotos.length })); }} style={flecha("left")}>‹</button>
        <button onClick={(e) => { e.stopPropagation(); setFoto((f) => ({ ...f, i: (f.i + 1) % f.fotos.length })); }} style={flecha("right")}>›</button>
        <span style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.8)", fontSize: 13 }}>{foto.i + 1} / {foto.fotos.length}</span>
      </>}
    </div>}

    {aviso && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 90, padding: "11px 20px", borderRadius: 12, background: aviso.ok ? NAVY : "#991b1b", color: "#fff", fontSize: 14, fontWeight: 600, boxShadow: "0 12px 30px rgba(10,22,40,0.3)" }}>{aviso.ok ? "✓ " : "✕ "}{aviso.txt}</div>}
  </div>;
}

const flecha = (lado) => ({ position: "absolute", [lado]: 18, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 28, cursor: "pointer" });

function Centro({ children }) {
  return <div style={{ minHeight: "100vh", background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "'Inter','PingFang SC',system-ui,sans-serif" }}>
    <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: "28px 26px", maxWidth: 420 }}>
      <img src={LOGO} alt="Argencargo" style={{ height: 28, marginBottom: 16, filter: "invert(1) brightness(0.2)" }} />
      {children}
    </div>
  </div>;
}

function Capa({ children, onClose }) {
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(10,22,40,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: CARD, borderRadius: 18, boxShadow: "0 30px 80px rgba(10,22,40,0.35)", overflow: "hidden", maxHeight: "92vh", overflowY: "auto" }}>{children}</div>
  </div>;
}

function EleccionTipo({ t, valor, onChange }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    {[["negra", "◼"], ["blanca", "◻"]].map(([k, ic]) => { const on = valor === k; const negra = k === "negra"; return <button key={k} onClick={() => onChange(k)} style={{
      padding: "16px 12px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "center",
      border: on ? `2px solid ${GOLD}` : `1px solid ${LINE}`,
      background: negra ? (on ? "#111827" : "#1f2937") : (on ? "#fffdf7" : "#fff"),
      color: negra ? "#fff" : INK, boxShadow: on ? "0 0 0 4px rgba(184,149,106,0.18)" : "none",
    }}>
      <span style={{ display: "block", fontSize: 22, lineHeight: 1 }}>{ic}</span>
      <span style={{ display: "block", fontSize: 15, fontWeight: 800, marginTop: 6 }}>{negra ? t.negra : t.blanca}</span>
      {on && <span style={{ display: "block", fontSize: 11.5, marginTop: 4, color: negra ? GOLD_B : GOLD }}>✓</span>}
    </button>; })}
  </div>;
}

function ModalLlegada({ c, t, dep, fmtUsd, fmtM3, tipoTxt, rotulo, onCancel, onOk }) {
  const hoy = hoyLocal();
  const dias = Array.from({ length: 7 }, (_, i) => menosDias(hoy, i));
  const [fecha, setFecha] = useState(hoy);
  const [tipo, setTipo] = useState(c.tipo || null);
  const [falta, setFalta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const rate = tipo === "blanca" ? dep.tarifa_blanca : tipo === "negra" ? dep.tarifa_negra : 0;
  const bruto = c.cbm * rate;
  const desc = tipo && dep.descuento_pct > 0 && c.cbm > dep.descuento_min_cbm ? bruto * dep.descuento_pct / 100 : 0;
  const nombreDia = (iso, i) => i === 0 ? t.hoy : i === 1 ? t.ayer : new Date(iso + "T12:00:00").toLocaleDateString(t === T.zh ? "zh-CN" : "es-AR", { weekday: "short" });
  const confirmar = async () => {
    if (!tipo) { setFalta(true); return; }
    setEnviando(true); await onOk(fecha, tipo); setEnviando(false);
  };
  return <Capa onClose={onCancel}>
    <div style={{ padding: "18px 20px", background: `linear-gradient(135deg, ${NAVY}, ${NAVY_2})`, color: "#fff", display: "flex", gap: 14, alignItems: "center" }}>
      {c.fotos[0] ? <div style={{ width: 64, height: 64, borderRadius: 12, backgroundImage: `url(${c.fotos[0]})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0, border: "1px solid rgba(255,255,255,0.2)" }} /> : <div style={{ width: 64, height: 64, borderRadius: 12, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>📦</div>}
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11.5, color: GOLD_B, fontWeight: 700, letterSpacing: "0.04em" }}>{t.confirmar_llegada}</p>
        <p style={{ margin: "3px 0 0", fontSize: 17, fontWeight: 800 }}>{rotulo ? <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginRight: 6 }}>{rotulo}</span> : null}{c.cliente || "—"}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.65)", fontFamily: "'JetBrains Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.tracking} · {c.bultos} {t.bultos.toLowerCase()} · {fmtM3(c.cbm)} {t.cbm}</p>
      </div>
    </div>
    <div style={{ padding: "18px 20px 20px" }}>
      <p className="dp-m-t">{t.fecha_llegada}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {dias.map((d, i) => { const on = fecha === d; return <button key={d} onClick={() => setFecha(d)} style={{ padding: "8px 12px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", minWidth: 62, border: on ? `2px solid ${NAVY}` : `1px solid ${LINE}`, background: on ? NAVY : "#fff", color: on ? "#fff" : INK }}>
          <span style={{ display: "block", fontSize: 11.5, opacity: 0.75, textTransform: "capitalize" }}>{nombreDia(d, i)}</span>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 800 }}>{ddmm(d)}</span>
        </button>; })}
      </div>

      <p className="dp-m-t" style={{ marginTop: 18 }}>{t.tipo_q}</p>
      {c.tipo && <p style={{ margin: "-2px 0 10px", fontSize: 13, color: MUTED }}>{t.tipo_cargado} <b style={{ color: INK }}>{tipoTxt(c.tipo)}</b>. {t.tipo_otro}</p>}
      <EleccionTipo t={t} valor={tipo} onChange={(v) => { setTipo(v); setFalta(false); }} />
      {falta && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b91c1c" }}>{t.tipo_elegi}</p>}

      {rate > 0 && c.cbm > 0 && <div style={{ marginTop: 16, padding: "11px 14px", borderRadius: 12, background: "#faf7ee", border: `1px solid ${LINE}`, fontSize: 13, color: INK, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ color: MUTED }}>{t.costo}: {fmtM3(c.cbm)} × {fmtUsd(rate)}{desc > 0 ? ` − ${dep.descuento_pct}%` : ""}</span>
        <b>{fmtUsd(bruto - desc)}</b>
      </div>}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="dp-btn-sec" style={{ flex: 1 }} onClick={onCancel}>{t.cancelar}</button>
        <button className="dp-btn-pri" style={{ flex: 2 }} onClick={confirmar}>{enviando ? "…" : `✓ ${t.confirmar}`}</button>
      </div>
    </div>
  </Capa>;
}

function ModalTipo({ c, t, tipoTxt, onCancel, onOk }) {
  const [tipo, setTipo] = useState(c.tipo || null);
  const [falta, setFalta] = useState(false);
  return <Capa onClose={onCancel}>
    <div style={{ padding: "20px 20px 18px" }}>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: INK }}>{t.tipo_q}</p>
      <p style={{ margin: "4px 0 14px", fontSize: 13, color: MUTED }}>{c.cliente} · {c.tracking}{c.tipo ? <> · {t.tipo_cargado} <b style={{ color: INK }}>{tipoTxt(c.tipo)}</b></> : null}</p>
      <EleccionTipo t={t} valor={tipo} onChange={(v) => { setTipo(v); setFalta(false); }} />
      {falta && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b91c1c" }}>{t.tipo_elegi}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button className="dp-btn-sec" style={{ flex: 1 }} onClick={onCancel}>{t.cancelar}</button>
        <button className="dp-btn-pri" style={{ flex: 2 }} onClick={() => { if (!tipo) { setFalta(true); return; } onOk(tipo); }}>✓ {t.confirmar}</button>
      </div>
    </div>
  </Capa>;
}

const CSS = `
.dp-wrap{max-width:1320px;margin:0 auto;padding-left:20px;padding-right:20px}
.dp-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.dp-tab{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:16px;border:1px solid ${LINE};background:${CARD};cursor:pointer;font-family:inherit;text-align:left;transition:all .15s;color:${INK}}
.dp-tab:hover{border-color:${GOLD}}
.dp-tab.on{background:${NAVY};border-color:${NAVY};color:#fff;box-shadow:0 10px 26px rgba(10,22,40,.18)}
.dp-tab-ic{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:19px;background:#f3efe4;flex-shrink:0}
.dp-tab.on .dp-tab-ic{background:rgba(232,208,152,.16)}
.dp-tab-l{font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.dp-tab-s{font-size:12px;color:${MUTED};margin-top:2px}
.dp-tab.on .dp-tab-s{color:${GOLD_B}}
.dp-card{background:${CARD};border:1px solid ${LINE};border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(10,22,40,.04)}
.dp-grid{display:grid;grid-template-columns:118px minmax(220px,2.2fr) 110px 64px 84px 128px 150px 150px;gap:14px;align-items:center;padding:14px 18px}
.dp-head{padding:10px 18px;background:#faf8f2;border-bottom:1px solid ${LINE};font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.06em}
.dp-fila{border-bottom:1px solid ${LINE}}
.dp-fila:last-of-type{border-bottom:none}
.dp-fila .dp-grid{cursor:pointer;transition:background .12s}
.dp-fila .dp-grid:hover{background:#fcfaf5}
.dp-abierta .dp-grid{background:#fcfaf5}
.dp-foto{width:118px;height:118px;border-radius:14px;background-size:cover;background-position:center;background-color:#f3efe4;position:relative;border:1px solid ${LINE};cursor:zoom-in}
.dp-foto-vacia{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:${MUTED};cursor:default}
.dp-foto-n{position:absolute;right:6px;bottom:6px;background:rgba(10,22,40,.8);color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px}
.dp-rotulo{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}
.dp-rot-pre{font-size:11px;font-weight:700;color:${GOLD};letter-spacing:.05em}
.dp-rot-cli{font-size:19px;font-weight:900;color:${NAVY};font-family:'JetBrains Mono','SF Mono',monospace;letter-spacing:.02em}
.dp-flag{font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:6px;border:1px solid;align-self:center}
.dp-track{font-family:'JetBrains Mono','SF Mono',monospace;font-size:12.5px;color:#475569;margin-top:4px;word-break:break-all}
.dp-merc{font-size:13.5px;color:${INK};margin-top:6px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dp-c-num{display:flex;flex-direction:column;gap:2px;font-variant-numeric:tabular-nums}
.dp-c-num b{font-size:14px;color:${INK}}
.dp-c-num small{font-size:11px;color:${MUTED}}
.dp-c-tipo{display:flex;flex-direction:column;gap:5px;align-items:flex-start}
.dp-c-tipo small{font-size:11.5px;font-weight:600}
.dp-tipo{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:12.5px;font-weight:800;white-space:nowrap}
.dp-tipo-b{background:#fff;color:${INK};border:1.5px solid #cbd5e1}
.dp-tipo-n{background:#111827;color:#fff;border:1.5px solid #111827}
.dp-tipo-x{background:#f1f5f9;color:#94a3b8;border:1px dashed #cbd5e1}
.dp-c-acc{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
.dp-btn-llego{padding:10px 18px;font-size:14px;font-weight:800;border-radius:12px;border:none;cursor:pointer;font-family:inherit;color:#fff;background:linear-gradient(135deg,#16a34a,#15803d);box-shadow:0 6px 16px rgba(21,128,61,.25);white-space:nowrap}
.dp-btn-llego:hover{filter:brightness(1.06)}
.dp-llego-ok{display:flex;flex-direction:column;align-items:flex-end;gap:3px;font-size:13px;color:${GREEN}}
.dp-link{background:none;border:none;padding:0;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;color:${BLUE};text-decoration:underline;text-underline-offset:2px}
.dp-det{color:${MUTED};text-decoration:none}
.dp-detalle{display:grid;grid-template-columns:1fr 1.4fr;gap:22px;padding:4px 18px 18px 150px;background:#fcfaf5}
.dp-det-t{margin:0 0 6px;font-size:11px;font-weight:800;color:${MUTED};text-transform:uppercase;letter-spacing:.06em}
.dp-det-v{margin:0;font-size:12.5px;color:${MUTED}}
.dp-det-tb{width:100%;border-collapse:collapse;font-size:13px}
.dp-det-tb td{padding:5px 0;border-bottom:1px dashed ${LINE};color:${INK}}
.dp-totales{display:flex;flex-wrap:wrap;gap:8px 22px;padding:14px 18px;background:#faf8f2;border-top:1px solid ${LINE};font-size:13px;color:${MUTED}}
.dp-totales b{color:${INK}}
.dp-tot-costo{margin-left:auto;color:${NAVY}}
.dp-tot-costo b{color:${NAVY};font-size:15px}
.dp-cont-h{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 18px;border-bottom:1px solid ${LINE};background:linear-gradient(180deg,#fbf8ef,#fff)}
.dp-cont-stats{display:flex;gap:8px 18px;flex-wrap:wrap;font-size:13px;color:${MUTED};align-items:center}
.dp-cont-stats b{color:${INK}}
.dp-vacio{padding:44px 20px;text-align:center;color:${MUTED};font-size:14px}
.dp-btn-pri{padding:13px 16px;font-size:15px;font-weight:800;border-radius:12px;border:none;cursor:pointer;font-family:inherit;color:${NAVY};background:linear-gradient(135deg,${GOLD},${GOLD_B})}
.dp-btn-sec{padding:13px 16px;font-size:15px;font-weight:700;border-radius:12px;border:1px solid ${LINE};cursor:pointer;font-family:inherit;color:${INK};background:#fff}
.dp-m-t{margin:0 0 10px;font-size:13px;font-weight:800;color:${INK}}
@media(max-width:1100px){
  .dp-grid{grid-template-columns:96px minmax(0,1fr) 100px 110px;grid-template-areas:"f i i i" "f n1 n2 n3" "f n4 t a"}
  .dp-head{display:none}
  .dp-foto{width:96px;height:96px}
  .dp-c-foto{grid-area:f;align-self:start}
  .dp-c-info{grid-area:i}
  .dp-c-num:nth-of-type(3){grid-area:n1}.dp-c-num:nth-of-type(4){grid-area:n2}.dp-c-num:nth-of-type(5){grid-area:n3}.dp-c-num:nth-of-type(6){grid-area:n4}
  .dp-c-tipo{grid-area:t}.dp-c-acc{grid-area:a}
  .dp-c-num::before,.dp-c-tipo::before{content:attr(data-l);font-size:10.5px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.05em}
  .dp-detalle{padding-left:18px}
}
@media(max-width:680px){
  .dp-wrap{padding-left:12px;padding-right:12px}
  .dp-tabs{grid-template-columns:1fr}
  .dp-tab{padding:11px 14px}
  .dp-grid{grid-template-columns:84px 1fr 1fr;grid-template-areas:"f i i" "n1 n2 n3" "n4 t t" "a a a";gap:10px 12px;padding:14px}
  .dp-foto{width:84px;height:84px}
  .dp-c-acc{flex-direction:row;justify-content:space-between;align-items:center}
  .dp-btn-llego{flex:1}
  .dp-llego-ok{flex-direction:row;gap:12px;align-items:center}
  .dp-detalle{grid-template-columns:1fr;padding:4px 14px 16px}
  .dp-tot-costo{margin-left:0}
}
`;
