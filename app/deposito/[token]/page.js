"use client";
// Planilla compartida con el depósito de China (28/09/2026). Link único por depósito, sin
// contraseña, en castellano y chino. El depósito ve lo que viene en camino, lo que tiene en el
// depósito y los contenedores en viaje. Marca el día que llegó cada carga y puede indicar si es
// mercadería blanca o negra en cualquier etapa (de eso depende lo que cobra).
// Regla visual de Bautista: fondo blanco con textos negros; nada de amarillo ni gris sobre blanco.
import { useState, useEffect, useMemo, useCallback } from "react";

const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const NAVY = "#0A1628";
const NAVY_2 = "#142038";
const GOLD = "#B8956A";
const GOLD_B = "#E8D098";
const CREAM = "#f5f3ee";
const CARD = "#ffffff";
const LINE = "#e5e1d8";
const INK = "#0f1115";
const SUB = "#2a2d33"; // textos secundarios: casi negro, nunca gris claro
const GREEN_TX = "#14532d";
const GREEN_BG = "#dcfce7";
const AMBER_TX = "#7c2d12";
const AMBER_BG = "#ffedd5";

const T = {
  es: {
    sub: "Planilla del depósito",
    camino: "En camino al depósito", deposito: "En depósito", contenedores: "Contenedores",
    camino_hint: "Mercadería que el proveedor ya despachó. Cuando llegue, tocá Llegó.",
    deposito_hint: "Mercadería que ya está en el depósito, lista para cargar en un contenedor.",
    cont_hint: "Contenedores que ya salieron hacia Buenos Aires. Tocá uno para ver su detalle.",
    buscar: "Buscar cliente, tracking o mercadería", todas: "Todas",
    blanca: "Blanca", negra: "Negra", blanca_l: "Mercadería blanca", negra_l: "Mercadería negra", sin_tipo: "Sin tipo",
    rotulo: "Rótulo", tracking: "Tracking", mercaderia: "Mercadería", valor: "Valor", bultos: "Bultos", cbm: "m³", costo: "Costo importación", tipo: "Tipo", estado: "Estado", foto: "Foto",
    llego: "Llegó", llego_el: "Llegó el", deshacer: "Deshacer", deshacer_q: "¿Deshacer la llegada de esta carga?",
    en_cont: "En el contenedor", ingreso: "Ingresó al depósito",
    confirmar_llegada: "Confirmar llegada", fecha_llegada: "¿Qué día llegó?", hoy: "Hoy", ayer: "Ayer",
    tipo_q: "¿Qué mercadería es?", tipo_cargado: "Nosotros la cargamos como", tipo_otro: "Si no es correcto, elegí la otra.", tipo_elegi: "Elegí si es blanca o negra.",
    confirmar: "Confirmar", cancelar: "Cancelar",
    sin_foto: "Sin foto", detalle: "Ver detalle", ocultar: "Ocultar", medidas: "Medidas de los bultos", productos: "Productos", sin_medidas: "Sin medidas cargadas", sin_productos: "Sin detalle de productos",
    confirmado: "Confirmado", tocar_confirmar: "Tocá para confirmar", corregido: "Corregido",
    desc: "desc.", cargas: "cargas", carga: "carga",
    salio: "Salió", eta: "Llega a Buenos Aires", naviera: "Naviera", costo_cont: "Costo del contenedor",
    vacio_camino: "No hay mercadería en camino.", vacio_deposito: "El depósito está vacío.", vacio_cont: "No hay contenedores en viaje.", vacio_busqueda: "Nada coincide con la búsqueda.",
    excel: "Descargar Excel", cargando: "Cargando…",
    link_invalido: "Este link no es válido. Pedile uno nuevo a Argencargo.",
    error: "No se pudo guardar. Probá de nuevo.", guardado: "Guardado",
    tarifas: "Tarifas", por_m3: "por m³", desc_regla: (p, m) => `${p}% de descuento si la carga supera ${m} m³`,
    fragil: "Frágil", reenvio: "Reenvío", contenedor: "Contenedor", idioma: "Idioma",
  },
  zh: {
    sub: "仓库货物表",
    camino: "运往仓库途中", deposito: "已入仓", contenedores: "集装箱",
    camino_hint: "供应商已发货的货物。到货后请点击「已到货」。",
    deposito_hint: "已在仓库的货物，等待装柜。",
    cont_hint: "已开往布宜诺斯艾利斯的集装箱。点击查看明细。",
    buscar: "搜索客户、快递单号或货物", todas: "全部",
    blanca: "正规报关", negra: "包税", blanca_l: "正规报关货物", negra_l: "包税货物", sin_tipo: "未选类型",
    rotulo: "唛头", tracking: "快递单号", mercaderia: "货物", valor: "货值", bultos: "件数", cbm: "立方", costo: "进口费用", tipo: "类型", estado: "状态", foto: "照片",
    llego: "已到货", llego_el: "到货", deshacer: "撤销", deshacer_q: "确定撤销这票货的到货记录吗？",
    en_cont: "已装柜", ingreso: "入仓日期",
    confirmar_llegada: "确认到货", fecha_llegada: "哪天到的？", hoy: "今天", ayer: "昨天",
    tipo_q: "这是什么货？", tipo_cargado: "我们登记的是", tipo_otro: "如不正确，请选另一种。", tipo_elegi: "请选择正规报关或包税。",
    confirmar: "确认", cancelar: "取消",
    sin_foto: "暂无照片", detalle: "查看详情", ocultar: "收起", medidas: "箱规", productos: "产品", sin_medidas: "未登记尺寸", sin_productos: "未登记产品明细",
    confirmado: "已确认", tocar_confirmar: "点击确认", corregido: "已更正",
    desc: "优惠", cargas: "票", carga: "票",
    salio: "开船", eta: "预计到达布宜诺斯艾利斯", naviera: "船公司", costo_cont: "整柜费用",
    vacio_camino: "暂无在途货物。", vacio_deposito: "仓库暂无货物。", vacio_cont: "暂无在途集装箱。", vacio_busqueda: "没有符合搜索条件的货物。",
    excel: "下载 Excel", cargando: "加载中…",
    link_invalido: "链接无效，请联系 Argencargo 获取新链接。",
    error: "保存失败，请重试。", guardado: "已保存",
    tarifas: "费率", por_m3: "每立方", desc_regla: (p, m) => `单票超过 ${m} 立方优惠 ${p}%`,
    fragil: "易碎", reenvio: "转运", contenedor: "集装箱", idioma: "语言",
  },
};

const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const menosDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ddmm = (iso) => { if (!iso) return "—"; const s = String(iso).slice(0, 10).split("-"); return `${s[2]}/${s[1]}`; };

// "LUNA - DEPOSITO 1 - Wu Kangli" → título "LUNA · DEPOSITO 1" y abajo "Wu Kangli".
const partirNombre = (n) => { const p = String(n || "").split(/\s+-\s+/).filter(Boolean); return p.length > 2 ? { titulo: p.slice(0, 2).join(" · "), resto: p.slice(2).join(" · ") } : { titulo: p.join(" · "), resto: "" }; };

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
  const [contAbiertos, setContAbiertos] = useState(new Set());
  const [llegada, setLlegada] = useState(null);
  const [tipoModal, setTipoModal] = useState(null);
  const [deshacerQ, setDeshacerQ] = useState(null);
  const [foto, setFoto] = useState(null);
  const [aviso, setAviso] = useState(null);

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

  const loc = lang === "zh" ? "en-US" : "es-AR";
  const fmtUsd = (v) => {
    const n = Number(v || 0);
    return lang === "zh" ? `US$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `USD ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const fmtUsd0 = (v) => { const n = Number(v || 0); return lang === "zh" ? `US$${n.toLocaleString("en-US")}` : `USD ${n.toLocaleString("es-AR")}`; };
  const fmtM3 = (v) => Number(v || 0).toLocaleString(loc, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmtN = (v) => Number(v || 0).toLocaleString(loc);

  const cargas = data?.cargas || [];
  const filtrar = (lista, conTipo = true) => {
    const s = q.trim().toLowerCase();
    return lista.filter((c) => (!conTipo || tipoF === "todas" || c.tipo === tipoF) && (!s || `${c.cliente || ""} ${c.tracking || ""} ${c.mercaderia || ""} ${c.numero || ""}`.toLowerCase().includes(s)));
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

  const rotuloPre = (data?.deposito?.rotulo || "").toUpperCase();
  const tipoTxt = (tp) => (tp === "blanca" ? t.blanca_l : tp === "negra" ? t.negra_l : t.sin_tipo);

  const exportar = () => {
    const conts = Object.fromEntries((data?.contenedores || []).map((c) => [c.id, c.codigo]));
    const lista = tab === "contenedores" ? filtrar(porEtapa.contenedor, false) : filtrar(porEtapa[tab] || []);
    const cols = [...(tab === "contenedores" ? [t.contenedor] : []), t.rotulo, t.mercaderia, t.tracking, t.bultos, t.cbm, `${t.valor} (USD)`, `${t.costo} (USD)`, t.tipo, ...(tab === "camino" ? [] : [t.ingreso])];
    const esc = (v) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const filas = lista.map((c) => [...(tab === "contenedores" ? [conts[c.contenedor] || ""] : []), `${rotuloPre} ${c.cliente || ""}`.trim(), c.mercaderia || "", c.tracking || "", c.bultos, c.cbm.toFixed(3), c.valor.toFixed(2), (c.costo?.total || 0).toFixed(2), tipoTxt(c.tipo), ...(tab === "camino" ? [] : [c.llego || ""])]);
    const csv = "﻿" + [cols, ...filas].map((f) => f.map(esc).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${(data?.deposito?.nombre || "deposito").replace(/[^\w-]+/g, "_")}_${tab}_${hoyLocal()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  if (err === "link_invalido") return <Centro><p style={{ fontSize: 15, color: INK, margin: 0 }}>{T.es.link_invalido}</p><p style={{ fontSize: 15, color: INK, margin: "8px 0 0" }}>{T.zh.link_invalido}</p></Centro>;
  if (!data) return <Centro><p style={{ color: INK, fontSize: 14, margin: 0 }}>{err ? t.error : t.cargando}</p></Centro>;

  const dep = data.deposito;
  const nom = partirNombre(dep.nombre);
  const tabs = [
    { k: "camino", l: t.camino, ic: "🚚", lista: porEtapa.camino },
    { k: "deposito", l: t.deposito, ic: "📦", lista: porEtapa.deposito },
    { k: "contenedores", l: t.contenedores, ic: "🚢", lista: porEtapa.contenedor, n: (data.contenedores || []).length },
  ];

  const tipoChip = (c) => {
    const cls = c.tipo === "blanca" ? "dp-tipo-b" : c.tipo === "negra" ? "dp-tipo-n" : "dp-tipo-x";
    return <button className={`dp-tipo ${cls}`} onClick={() => setTipoModal(c)}>{c.tipo === "blanca" ? "◻" : c.tipo === "negra" ? "◼" : "＋"} {tipoTxt(c.tipo)}</button>;
  };

  const fila = (c, etapa) => {
    const abierto = abiertos.has(c.id);
    const toggle = () => setAbiertos((p) => { const n = new Set(p); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; });
    const costo = c.costo || {};
    return <div key={c.id} className={`dp-fila${abierto ? " dp-abierta" : ""}`}>
      <div className="dp-grid">
        <div className="dp-c-foto" onClick={() => { if (c.fotos.length) setFoto({ fotos: c.fotos, i: 0 }); }}>
          {c.fotos.length
            ? <div className="dp-foto" style={{ backgroundImage: `url(${c.fotos[0]})` }}>{c.fotos.length > 1 && <span className="dp-foto-n">+{c.fotos.length - 1}</span>}</div>
            : <div className="dp-foto dp-foto-vacia"><span style={{ fontSize: 20 }}>📦</span><span style={{ fontSize: 10.5 }}>{t.sin_foto}</span></div>}
        </div>
        <div className="dp-c-rot">
          {rotuloPre && <span className="dp-rot-pre">{rotuloPre}</span>}
          <span className="dp-rot-cli">{c.cliente || "—"}</span>
          {(c.fragil || c.reenvio) && <span style={{ display: "flex", gap: 5, marginTop: 4 }}>
            {c.fragil && <span className="dp-flag" style={{ color: AMBER_TX, background: AMBER_BG }}>{t.fragil}</span>}
            {c.reenvio && <span className="dp-flag" style={{ color: AMBER_TX, background: AMBER_BG }}>{t.reenvio}</span>}
          </span>}
        </div>
        <div className="dp-c-merc" data-l={t.mercaderia}>{c.mercaderia || "—"}</div>
        <div className="dp-c-track" data-l={t.tracking}>{c.tracking || "—"}</div>
        <div className="dp-c-num dp-c-bul" data-l={t.bultos}><b>{c.bultos || "—"}</b></div>
        <div className="dp-c-num dp-c-cbm" data-l={t.cbm}><b>{c.cbm > 0 ? fmtM3(c.cbm) : "—"}</b></div>
        <div className="dp-c-num dp-c-val" data-l={t.valor}><b>{c.valor > 0 ? fmtUsd(c.valor) : "—"}</b></div>
        <div className="dp-c-num dp-c-cost" data-l={t.costo}>
          <b>{costo.total > 0 ? fmtUsd(costo.total) : "—"}</b>
          {costo.total > 0 && <small>{fmtN(costo.rate)} {t.por_m3}{costo.descuento > 0 ? ` · −${dep.descuento_pct}%` : ""}</small>}
        </div>
        <div className="dp-c-tipo" data-l={t.tipo}>
          {tipoChip(c)}
          {c.tipo && (c.tipo_confirmado
            ? <small style={{ color: c.tipo_corregido ? AMBER_TX : GREEN_TX }}>{c.tipo_corregido ? `✎ ${t.corregido}` : `✓ ${t.confirmado}`}</small>
            : <small style={{ color: SUB }}>{t.tocar_confirmar}</small>)}
        </div>
        <div className="dp-c-acc">
          {etapa === "camino" && <button className="dp-btn-llego" onClick={() => setLlegada(c)}>✓ {t.llego}</button>}
          {etapa === "deposito" && <div className="dp-llego-ok">
            <span className="dp-est" style={{ color: GREEN_TX, background: GREEN_BG }}>✓ {t.llego_el} {ddmm(c.llego)}</span>
            {c.llego_por_deposito && <button className="dp-link" onClick={() => setDeshacerQ(c)}>{t.deshacer}</button>}
          </div>}
          {etapa === "contenedor" && <div className="dp-llego-ok">
            <span className="dp-est" style={{ color: "#fff", background: NAVY }}>🚢 {t.en_cont}</span>
            {c.llego && <small style={{ fontSize: 11.5, color: SUB }}>{t.ingreso} {ddmm(c.llego)}</small>}
          </div>}
          <button className="dp-link" onClick={toggle}>{abierto ? `▴ ${t.ocultar}` : `▾ ${t.detalle}`}</button>
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

  const encabezado = (etapa) => <div className="dp-grid dp-head">
    <div>{t.foto}</div><div>{t.rotulo}</div><div>{t.mercaderia}</div><div>{t.tracking}</div><div>{t.bultos}</div><div>{t.cbm}</div><div>{t.valor}</div><div>{t.costo}</div><div>{t.tipo}</div><div style={{ textAlign: "right" }}>{etapa === "camino" ? "" : t.estado}</div>
  </div>;

  const totalesBar = (lista) => { const s = totales(lista); if (!s.n) return null; return <div className="dp-totales">
    <span><b>{s.n}</b> {s.n === 1 ? t.carga : t.cargas}</span>
    <span><b>{fmtN(s.bultos)}</b> {t.bultos.toLowerCase()}</span>
    <span><b>{fmtM3(s.cbm)}</b> {t.cbm}</span>
    <span>{t.valor} <b>{fmtUsd(s.valor)}</b></span>
    <span className="dp-tot-costo">{t.costo} <b>{fmtUsd(s.costo)}</b></span>
  </div>; };

  const vacio = (txt) => <div className="dp-vacio">{txt}</div>;
  const listaTab = tab === "contenedores" ? null : filtrar(porEtapa[tab]);

  return <div style={{ minHeight: "100vh", background: CREAM, color: INK, fontFamily: "'Inter','PingFang SC','Microsoft YaHei',system-ui,-apple-system,sans-serif" }}>
    <style>{CSS}</style>

    {/* Encabezado */}
    <header style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_2} 100%)`, color: "#fff" }}>
      <div className="dp-wrap dp-head-top">
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 320px" }}>
          <img src={LOGO} alt="Argencargo" className="dp-logo" />
          <span className="dp-sep" />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: GOLD_B, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.sub}</p>
            <p className="dp-dep-t">{nom.titulo}</p>
            {nom.resto && <p style={{ margin: "1px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.85)" }}>{nom.resto}{dep.rotulo ? <> · {t.rotulo} <b style={{ color: "#fff" }}>{dep.rotulo.toUpperCase()}</b></> : null}</p>}
          </div>
        </div>
        <div className="dp-head-acc">
          <div className="dp-lang" role="group" aria-label={t.idioma}>
            {[["es", "Español"], ["zh", "中文"]].map(([k, l]) => <button key={k} onClick={() => cambiarLang(k)} className={lang === k ? "on" : ""}>{l}</button>)}
          </div>
          <button onClick={exportar} className="dp-excel">⬇ {t.excel}</button>
        </div>
      </div>
      <div className="dp-wrap" style={{ paddingBottom: 16 }}>
        <div className="dp-tarifas">
          <span className="dp-tar-t">{t.tarifas}</span>
          <span className="dp-tar-i"><span className="dp-tipo dp-tipo-n dp-tipo-s">◼ {t.negra}</span><b>{fmtUsd0(dep.tarifa_negra)}</b> {t.por_m3}</span>
          <span className="dp-tar-i"><span className="dp-tipo dp-tipo-b dp-tipo-s">◻ {t.blanca}</span><b>{fmtUsd0(dep.tarifa_blanca)}</b> {t.por_m3}</span>
          {dep.descuento_pct > 0 && <span className="dp-tar-i dp-tar-desc">★ {t.desc_regla(dep.descuento_pct, fmtN(dep.descuento_min_cbm))}</span>}
        </div>
      </div>
    </header>

    <main className="dp-wrap" style={{ paddingTop: 20, paddingBottom: 60 }}>
      <div className="dp-tabs">
        {tabs.map((x) => { const on = tab === x.k; const s = totales(x.lista); return <button key={x.k} onClick={() => setTab(x.k)} className={`dp-tab${on ? " on" : ""}`}>
          <span className="dp-tab-ic">{x.ic}</span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
            <span className="dp-tab-l">{x.l}</span>
            <span className="dp-tab-s">{x.k === "contenedores" ? `${x.n} · ${fmtM3(s.cbm)} ${t.cbm}` : `${s.n} ${s.n === 1 ? t.carga : t.cargas} · ${fmtM3(s.cbm)} ${t.cbm}`}</span>
          </span>
        </button>; })}
      </div>

      <p style={{ fontSize: 14, color: INK, margin: "14px 2px 12px" }}>{tab === "camino" ? t.camino_hint : tab === "deposito" ? t.deposito_hint : t.cont_hint}</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div className="dp-buscar" style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: INK, fontSize: 14 }}>⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.buscar} style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px 11px 34px", fontSize: 14, borderRadius: 12, border: `1px solid ${LINE}`, background: CARD, color: INK, outline: "none", fontFamily: "inherit" }} />
        </div>
        {tab !== "contenedores" && <div style={{ display: "flex", background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: 3 }}>
          {[["todas", t.todas], ["negra", t.negra], ["blanca", t.blanca]].map(([k, l]) => <button key={k} onClick={() => setTipoF(k)} style={{ padding: "8px 14px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", background: tipoF === k ? NAVY : "transparent", color: tipoF === k ? "#fff" : INK }}>{l}</button>)}
        </div>}
      </div>

      {tab !== "contenedores" && <div className="dp-card">
        {listaTab.length > 0 && encabezado(tab)}
        {listaTab.length === 0 ? vacio(porEtapa[tab].length ? t.vacio_busqueda : tab === "camino" ? t.vacio_camino : t.vacio_deposito) : listaTab.map((c) => fila(c, tab))}
        {totalesBar(listaTab)}
      </div>}

      {tab === "contenedores" && ((data.contenedores || []).length === 0
        ? <div className="dp-card">{vacio(t.vacio_cont)}</div>
        : (data.contenedores || []).map((ct) => {
          const todas = porEtapa.contenedor.filter((c) => c.contenedor === ct.id);
          const lista = filtrar(todas, false);
          const s = totales(todas);
          const abierto = contAbiertos.has(ct.id) || (q.trim() && lista.length > 0);
          const toggle = () => setContAbiertos((p) => { const n = new Set(p); n.has(ct.id) ? n.delete(ct.id) : n.add(ct.id); return n; });
          const porTipo = ["negra", "blanca", null].map((tp) => { const l = todas.filter((c) => (c.tipo || null) === tp); return { tp, ...totales(l) }; }).filter((x) => x.n > 0);
          return <div key={ct.id} className="dp-card" style={{ marginBottom: 14 }}>
            <div role="button" tabIndex={0} className="dp-cont-h" onClick={toggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
              <div className="dp-cont-id">
                <span className="dp-cont-ic">🚢</span>
                <div style={{ minWidth: 0, textAlign: "left" }}>
                  <p className="dp-cont-code">{ct.codigo}</p>
                  <p className="dp-cont-sub">{[ct.naviera && `${t.naviera} ${ct.naviera}`, ct.salio && `${t.salio} ${ddmm(ct.salio)}`, ct.eta && `${t.eta} ${ddmm(ct.eta)}`].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              <div className="dp-cont-stats">
                <span className="dp-cont-dato"><small>{t.bultos}</small><b>{fmtN(s.bultos)}</b></span>
                <span className="dp-cont-dato"><small>{t.cbm}</small><b>{fmtM3(s.cbm)}</b></span>
                <span className="dp-cont-costo"><small>{t.costo_cont}</small><b>{fmtUsd(s.costo)}</b></span>
                <span className="dp-chev">{abierto ? "▴" : "▾"}</span>
              </div>
            </div>
            <div className="dp-cont-tipos">
              {porTipo.map((x) => <span key={x.tp || "x"} className="dp-cont-tipo">
                <span className={`dp-tipo dp-tipo-s ${x.tp === "blanca" ? "dp-tipo-b" : x.tp === "negra" ? "dp-tipo-n" : "dp-tipo-x"}`}>{x.tp === "blanca" ? "◻" : x.tp === "negra" ? "◼" : "?"} {tipoTxt(x.tp)}</span>
                <span>{x.n} {x.n === 1 ? t.carga : t.cargas} · {fmtN(x.bultos)} {t.bultos.toLowerCase()} · <b>{fmtM3(x.cbm)} {t.cbm}</b> · <b>{fmtUsd(x.costo)}</b></span>
              </span>)}
            </div>
            {abierto && <>
              {lista.length > 0 && encabezado("contenedor")}
              {lista.length === 0 ? vacio(todas.length ? t.vacio_busqueda : "—") : lista.map((c) => fila(c, "contenedor"))}
            </>}
          </div>;
        }))}
    </main>

    {llegada && <ModalLlegada c={llegada} t={t} lang={lang} dep={dep} fmtUsd={fmtUsd} fmtM3={fmtM3} tipoTxt={tipoTxt} rotulo={rotuloPre} onCancel={() => setLlegada(null)}
      onOk={async (fecha, tipo) => { const ok = await accion({ accion: "llego", id: llegada.id, fecha, tipo }); if (ok) setLlegada(null); return ok; }} />}

    {tipoModal && <ModalTipo c={tipoModal} t={t} tipoTxt={tipoTxt} onCancel={() => setTipoModal(null)}
      onOk={async (tipo) => { const ok = await accion({ accion: "tipo", id: tipoModal.id, tipo }); if (ok) setTipoModal(null); return ok; }} />}

    {deshacerQ && <Capa onClose={() => setDeshacerQ(null)}>
      <div style={{ padding: "22px 22px 18px" }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: INK }}>{t.deshacer_q}</p>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: INK }}>{deshacerQ.cliente} · {deshacerQ.tracking}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button className="dp-btn-sec" onClick={() => setDeshacerQ(null)}>{t.cancelar}</button>
          <button className="dp-btn-pri" onClick={async () => { const ok = await accion({ accion: "deshacer", id: deshacerQ.id }); if (ok) setDeshacerQ(null); }}>{t.deshacer}</button>
        </div>
      </div>
    </Capa>}

    {foto && <div onClick={() => setFoto(null)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,22,40,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <img src={foto.fotos[foto.i]} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "86vh", borderRadius: 12, boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }} />
      <button onClick={() => setFoto(null)} aria-label="cerrar" style={{ position: "absolute", top: 18, right: 18, width: 42, height: 42, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
      {foto.fotos.length > 1 && <>
        <button onClick={(e) => { e.stopPropagation(); setFoto((f) => ({ ...f, i: (f.i - 1 + f.fotos.length) % f.fotos.length })); }} style={flecha("left")}>‹</button>
        <button onClick={(e) => { e.stopPropagation(); setFoto((f) => ({ ...f, i: (f.i + 1) % f.fotos.length })); }} style={flecha("right")}>›</button>
        <span style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", color: "#fff", fontSize: 13 }}>{foto.i + 1} / {foto.fotos.length}</span>
      </>}
    </div>}

    {aviso && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 90, padding: "11px 20px", borderRadius: 12, background: aviso.ok ? NAVY : "#991b1b", color: "#fff", fontSize: 14, fontWeight: 600, boxShadow: "0 12px 30px rgba(10,22,40,0.3)" }}>{aviso.ok ? "✓ " : "✕ "}{aviso.txt}</div>}
  </div>;
}

const flecha = (lado) => ({ position: "absolute", [lado]: 18, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", fontSize: 28, cursor: "pointer" });

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
      border: on ? `3px solid ${negra ? GOLD : NAVY}` : `1px solid #c9c4b8`,
      background: negra ? "#111827" : "#fff", color: negra ? "#fff" : INK,
    }}>
      <span style={{ display: "block", fontSize: 22, lineHeight: 1 }}>{ic}</span>
      <span style={{ display: "block", fontSize: 15, fontWeight: 800, marginTop: 6 }}>{negra ? t.negra_l : t.blanca_l}</span>
      <span style={{ display: "block", fontSize: 13, marginTop: 4, fontWeight: 800, visibility: on ? "visible" : "hidden" }}>✓</span>
    </button>; })}
  </div>;
}

function ModalLlegada({ c, t, lang, dep, fmtUsd, fmtM3, tipoTxt, rotulo, onCancel, onOk }) {
  const hoy = hoyLocal();
  const dias = Array.from({ length: 7 }, (_, i) => menosDias(hoy, i));
  const [fecha, setFecha] = useState(hoy);
  const [tipo, setTipo] = useState(c.tipo || null);
  const [falta, setFalta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const rate = tipo === "blanca" ? dep.tarifa_blanca : tipo === "negra" ? dep.tarifa_negra : 0;
  const bruto = c.cbm * rate;
  const desc = tipo && dep.descuento_pct > 0 && c.cbm > dep.descuento_min_cbm ? bruto * dep.descuento_pct / 100 : 0;
  const nombreDia = (iso, i) => i === 0 ? t.hoy : i === 1 ? t.ayer : new Date(iso + "T12:00:00").toLocaleDateString(lang === "zh" ? "zh-CN" : "es-AR", { weekday: "short" });
  const confirmar = async () => { if (!tipo) { setFalta(true); return; } setEnviando(true); await onOk(fecha, tipo); setEnviando(false); };
  return <Capa onClose={onCancel}>
    <div style={{ padding: "18px 20px", background: `linear-gradient(135deg, ${NAVY}, ${NAVY_2})`, color: "#fff", display: "flex", gap: 14, alignItems: "center" }}>
      {c.fotos[0] ? <div style={{ width: 64, height: 64, borderRadius: 12, backgroundImage: `url(${c.fotos[0]})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0, border: "1px solid rgba(255,255,255,0.2)" }} /> : <div style={{ width: 64, height: 64, borderRadius: 12, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>📦</div>}
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: GOLD_B, fontWeight: 700, letterSpacing: "0.04em" }}>{t.confirmar_llegada}</p>
        <p style={{ margin: "3px 0 0", fontSize: 17, fontWeight: 800 }}>{rotulo ? <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginRight: 6 }}>{rotulo}</span> : null}{c.cliente || "—"}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.mercaderia}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.85)", fontFamily: "'JetBrains Mono',monospace" }}>{c.tracking} · {c.bultos} {t.bultos.toLowerCase()} · {fmtM3(c.cbm)} {t.cbm}</p>
      </div>
    </div>
    <div style={{ padding: "18px 20px 20px" }}>
      <p className="dp-m-t">{t.fecha_llegada}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {dias.map((d, i) => { const on = fecha === d; return <button key={d} onClick={() => setFecha(d)} style={{ padding: "8px 12px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", minWidth: 62, border: on ? `2px solid ${NAVY}` : "1px solid #c9c4b8", background: on ? NAVY : "#fff", color: on ? "#fff" : INK }}>
          <span style={{ display: "block", fontSize: 11.5, textTransform: "capitalize" }}>{nombreDia(d, i)}</span>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 800 }}>{ddmm(d)}</span>
        </button>; })}
      </div>
      <p className="dp-m-t" style={{ marginTop: 18 }}>{t.tipo_q}</p>
      {c.tipo && <p style={{ margin: "-2px 0 10px", fontSize: 13.5, color: INK }}>{t.tipo_cargado} <b>{tipoTxt(c.tipo)}</b>. {t.tipo_otro}</p>}
      <EleccionTipo t={t} valor={tipo} onChange={(v) => { setTipo(v); setFalta(false); }} />
      {falta && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#991b1b", fontWeight: 700 }}>{t.tipo_elegi}</p>}
      {rate > 0 && c.cbm > 0 && <div style={{ marginTop: 16, padding: "11px 14px", borderRadius: 12, background: GREEN_BG, fontSize: 13.5, color: GREEN_TX, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span>{t.costo}: {fmtM3(c.cbm)} × {fmtUsd(rate)}{desc > 0 ? ` − ${dep.descuento_pct}%` : ""}</span>
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
      <p style={{ margin: "4px 0 2px", fontSize: 14, color: INK }}><b>{c.cliente}</b> · {c.mercaderia}</p>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: INK, fontFamily: "'JetBrains Mono',monospace" }}>{c.tracking}{c.tipo ? <span style={{ fontFamily: "inherit" }}> · {t.tipo_cargado} <b>{tipoTxt(c.tipo)}</b></span> : null}</p>
      <EleccionTipo t={t} valor={tipo} onChange={(v) => { setTipo(v); setFalta(false); }} />
      {falta && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#991b1b", fontWeight: 700 }}>{t.tipo_elegi}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button className="dp-btn-sec" style={{ flex: 1 }} onClick={onCancel}>{t.cancelar}</button>
        <button className="dp-btn-pri" style={{ flex: 2 }} onClick={() => { if (!tipo) { setFalta(true); return; } onOk(tipo); }}>✓ {t.confirmar}</button>
      </div>
    </div>
  </Capa>;
}

const CSS = `
.dp-wrap{max-width:1360px;margin:0 auto;padding-left:20px;padding-right:20px}
.dp-head-top{padding-top:18px;padding-bottom:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.dp-logo{height:32px;width:auto;flex-shrink:0}
.dp-sep{width:1px;height:42px;background:rgba(255,255,255,0.18);flex-shrink:0}
.dp-dep-t{margin:2px 0 0;font-size:22px;font-weight:900;letter-spacing:.01em;line-height:1.15}
.dp-head-acc{display:flex;gap:10px;align-items:center}
.dp-lang{display:flex;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);border-radius:12px;padding:4px}
.dp-lang button{padding:8px 16px;font-size:14px;font-weight:700;border:none;border-radius:9px;cursor:pointer;font-family:inherit;background:transparent;color:#fff}
.dp-lang button.on{background:#fff;color:${NAVY}}
.dp-excel{padding:10px 16px;font-size:14px;font-weight:700;border-radius:12px;border:none;cursor:pointer;font-family:inherit;color:${NAVY};background:linear-gradient(135deg,${GOLD},${GOLD_B});white-space:nowrap}
.dp-tarifas{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;padding:12px 16px;border-radius:14px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);font-size:14px;color:#fff}
.dp-tar-t{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${GOLD_B}}
.dp-tar-i{display:inline-flex;align-items:center;gap:8px}
.dp-tar-i b{font-size:15px}
.dp-tar-desc{color:${GOLD_B};font-weight:700}
.dp-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.dp-tab{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:16px;border:1px solid ${LINE};background:${CARD};cursor:pointer;font-family:inherit;text-align:left;color:${INK}}
.dp-tab:hover{border-color:${NAVY}}
.dp-tab.on{background:${NAVY};border-color:${NAVY};color:#fff;box-shadow:0 10px 26px rgba(10,22,40,.18)}
.dp-tab-ic{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:19px;background:#efeae0;flex-shrink:0}
.dp-tab.on .dp-tab-ic{background:rgba(255,255,255,.12)}
.dp-tab-l{font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.dp-tab-s{font-size:12.5px;color:${SUB};margin-top:2px}
.dp-tab.on .dp-tab-s{color:#fff}
.dp-card{background:${CARD};border:1px solid ${LINE};border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(10,22,40,.04)}
.dp-grid{display:grid;grid-template-columns:88px minmax(110px,.9fr) minmax(150px,1.4fr) minmax(130px,1fr) 56px 74px 108px 124px 158px 138px;gap:12px;align-items:center;padding:12px 18px}
.dp-head{padding:10px 18px;background:#f3f0e8;border-bottom:1px solid ${LINE};font-size:11px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.06em}
.dp-fila{border-bottom:1px solid ${LINE}}
.dp-fila:last-of-type{border-bottom:none}
.dp-abierta{background:#fbfaf6}
.dp-foto{width:88px;height:88px;border-radius:12px;background-size:cover;background-position:center;background-color:#efeae0;position:relative;border:1px solid ${LINE};cursor:zoom-in}
.dp-foto-vacia{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:${INK};cursor:default}
.dp-foto-n{position:absolute;right:5px;bottom:5px;background:rgba(10,22,40,.85);color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px}
.dp-c-rot{display:flex;flex-direction:column;min-width:0}
.dp-rot-pre{font-size:10.5px;font-weight:800;color:${INK};letter-spacing:.05em}
.dp-rot-cli{font-size:18px;font-weight:900;color:${INK};font-family:'JetBrains Mono','SF Mono',monospace;letter-spacing:.02em;margin-top:1px}
.dp-flag{font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:6px}
.dp-c-merc{font-size:14px;font-weight:600;color:${INK};line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.dp-c-track{font-family:'JetBrains Mono','SF Mono',monospace;font-size:13.5px;font-weight:600;color:${INK};word-break:break-all;letter-spacing:.02em}
.dp-c-num{display:flex;flex-direction:column;gap:2px;font-variant-numeric:tabular-nums}
.dp-c-num b{font-size:14px;color:${INK}}
.dp-c-num small{font-size:11.5px;color:${SUB}}
.dp-c-tipo{display:flex;flex-direction:column;gap:5px;align-items:flex-start}
.dp-c-tipo small{font-size:11.5px;font-weight:700}
.dp-tipo{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:999px;font-size:12.5px;font-weight:800;white-space:nowrap;font-family:inherit;cursor:pointer}
.dp-tipo-s{padding:3px 9px;font-size:11.5px;cursor:default}
.dp-tipo-b{background:#fff;color:${INK};border:1.5px solid ${INK}}
.dp-tipo-n{background:#111827;color:#fff;border:1.5px solid #111827}
.dp-tipo-x{background:${AMBER_BG};color:${AMBER_TX};border:1.5px dashed ${AMBER_TX}}
.dp-c-acc{display:flex;flex-direction:column;gap:7px;align-items:flex-end}
.dp-btn-llego{padding:10px 18px;font-size:14px;font-weight:800;border-radius:12px;border:none;cursor:pointer;font-family:inherit;color:#fff;background:#15803d;box-shadow:0 6px 16px rgba(21,128,61,.25);white-space:nowrap}
.dp-llego-ok{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.dp-est{font-size:12.5px;font-weight:800;padding:5px 10px;border-radius:8px;white-space:nowrap}
.dp-link{background:none;border:none;padding:0;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:700;color:${INK};text-decoration:underline;text-underline-offset:2px}
.dp-detalle{display:grid;grid-template-columns:1fr 1.4fr;gap:22px;padding:4px 18px 18px 124px}
.dp-det-t{margin:0 0 6px;font-size:11.5px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.06em}
.dp-det-v{margin:0;font-size:13px;color:${INK}}
.dp-det-tb{width:100%;border-collapse:collapse;font-size:13.5px}
.dp-det-tb td{padding:5px 0;border-bottom:1px dashed ${LINE};color:${INK}}
.dp-totales{display:flex;flex-wrap:wrap;gap:8px 22px;padding:14px 18px;background:#f3f0e8;border-top:1px solid ${LINE};font-size:13.5px;color:${INK}}
.dp-tot-costo{margin-left:auto}
.dp-tot-costo b{color:${GREEN_TX};background:${GREEN_BG};padding:3px 9px;border-radius:8px;font-size:15px}
.dp-cont-h{width:100%;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 18px;border:none;background:#fff;cursor:pointer;font-family:inherit;color:${INK}}
.dp-cont-id{display:flex;align-items:center;gap:12px;min-width:0}
.dp-cont-ic{width:46px;height:46px;border-radius:13px;background:${NAVY};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.dp-cont-code{margin:0;font-size:19px;font-weight:900;color:${INK};font-family:'JetBrains Mono','SF Mono',monospace;letter-spacing:.02em}
.dp-cont-sub{margin:2px 0 0;font-size:13px;color:${INK}}
.dp-cont-stats{display:flex;gap:20px;flex-wrap:wrap;align-items:center}
.dp-cont-dato{display:flex;flex-direction:column;align-items:flex-start;gap:1px}
.dp-cont-dato small,.dp-cont-costo small{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:${INK}}
.dp-cont-dato b{font-size:17px;font-variant-numeric:tabular-nums}
.dp-cont-costo{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:7px 12px;border-radius:12px;background:${GREEN_BG}}
.dp-cont-costo small{color:${GREEN_TX}}
.dp-cont-costo b{font-size:18px;color:${GREEN_TX};font-variant-numeric:tabular-nums}
.dp-chev{font-size:16px;font-weight:900;width:30px;height:30px;border-radius:999px;border:1px solid ${LINE};display:flex;align-items:center;justify-content:center}
.dp-cont-tipos{display:flex;flex-wrap:wrap;gap:8px 20px;padding:10px 18px 14px;border-bottom:1px solid ${LINE};font-size:13px;color:${INK}}
.dp-cont-tipo{display:inline-flex;align-items:center;gap:8px}
.dp-vacio{padding:44px 20px;text-align:center;color:${INK};font-size:14px}
.dp-btn-pri{padding:13px 16px;font-size:15px;font-weight:800;border-radius:12px;border:none;cursor:pointer;font-family:inherit;color:#fff;background:${NAVY}}
.dp-btn-sec{padding:13px 16px;font-size:15px;font-weight:700;border-radius:12px;border:1px solid #c9c4b8;cursor:pointer;font-family:inherit;color:${INK};background:#fff}
.dp-m-t{margin:0 0 10px;font-size:14px;font-weight:800;color:${INK}}
@media(max-width:1180px){
  .dp-head{display:none}
  .dp-grid{grid-template-columns:88px repeat(4,minmax(0,1fr));grid-template-areas:"f r r a a" "f m m m m" "f k k k k" "b c v o t";row-gap:10px}
  .dp-c-foto{grid-area:f;align-self:start}.dp-c-rot{grid-area:r}.dp-c-acc{grid-area:a;align-self:start}.dp-c-merc{grid-area:m}.dp-c-track{grid-area:k}
  .dp-c-bul{grid-area:b}.dp-c-cbm{grid-area:c}.dp-c-val{grid-area:v}.dp-c-cost{grid-area:o}.dp-c-tipo{grid-area:t}
  .dp-c-num::before,.dp-c-tipo::before,.dp-c-track::before{content:attr(data-l);display:block;font-family:'Inter','PingFang SC',system-ui,sans-serif;font-size:10.5px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
  .dp-detalle{padding-left:18px}
}
@media(max-width:680px){
  .dp-wrap{padding-left:12px;padding-right:12px}
  .dp-sep{display:none}
  .dp-logo{height:24px}
  .dp-dep-t{font-size:18px}
  .dp-head-acc{width:100%}
  .dp-lang{flex:1}
  .dp-lang button{flex:1;padding:9px 10px}
  .dp-excel{padding:10px 12px;font-size:13px}
  .dp-tarifas{flex-direction:column;align-items:flex-start;gap:8px;font-size:13.5px}
  .dp-tabs{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
  .dp-tab{flex-direction:column;align-items:flex-start;gap:7px;padding:10px}
  .dp-tab-ic{width:30px;height:30px;font-size:15px;border-radius:9px}
  .dp-tab-l{font-size:12.5px;white-space:normal;line-height:1.2}
  .dp-tab-s{font-size:10.5px}
  .dp-buscar{flex:1 1 100% !important}
  .dp-grid{grid-template-columns:72px repeat(3,minmax(0,1fr));grid-template-areas:"f r r r" "f m m m" "k k k k" "b c v v" "o o t t" "a a a a";gap:10px 12px;padding:14px}
  .dp-foto{width:72px;height:72px}
  .dp-c-acc{flex-direction:row;justify-content:space-between;align-items:center}
  .dp-btn-llego{flex:1}
  .dp-llego-ok{flex-direction:row;gap:10px;align-items:center;flex-wrap:wrap}
  .dp-detalle{grid-template-columns:1fr;padding:4px 14px 16px}
  .dp-tot-costo{margin-left:0}
  .dp-cont-stats{width:100%;gap:14px}
}
`;
