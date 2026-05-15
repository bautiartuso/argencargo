"use client";
import { useState, useMemo } from "react";

// ──────────────────────────────────────────────────────────────────────
// PREVIEW v3 — Panel Marketing Argencargo
// Cambios v3:
// - Hoy: barra de progreso visible
// - Story IG separada de Estado WhatsApp
// - Sacar "Responder DMs" (se hace continuo, no checklist)
// - Botón "+ Nueva tarea" manual
// - Plan del mes: cada 3 días
// - Radar: lista de fuentes ampliada y editable
// - Reactivos: flow explicado bien
// ──────────────────────────────────────────────────────────────────────

const GOLD = "#B8956A", GOLD_LIGHT = "#E8D098", GOLD_DEEP = "#A68456";
const GOLD_GRADIENT = "linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";
const DARK_BG = "linear-gradient(135deg,#070C1A 0%,#0A1628 50%,#0F1F3A 100%)";

const NETWORKS = {
  instagram: { label: "Instagram", icon: "📷", color: "#E1306C", bg: "rgba(225,48,108,0.12)", bd: "rgba(225,48,108,0.4)", account: "@argencargo", brand: "empresa", line: "Más visual / comercial. Para clientes finales: precios, servicios, casos, behind-the-scenes." },
  linkedin: { label: "LinkedIn", icon: "💼", color: "#0A66C2", bg: "rgba(10,102,194,0.12)", bd: "rgba(10,102,194,0.4)", account: "@Bautista Artuso", brand: "personal + tag empresa", line: "B2B. Novedades del sector, anuncios, opinión profesional, casos de éxito." },
  x: { label: "X / Twitter", icon: "𝕏", color: "#fff", bg: "rgba(255,255,255,0.08)", bd: "rgba(255,255,255,0.3)", account: "@Bautista", brand: "personal", line: "Punzante. Novedades, opinión rápida, hilos técnicos, comercio exterior." },
};

const today = new Date(2026, 4, 14);
const todayStr = today.toISOString().slice(0, 10);
const d = (off) => { const x = new Date(today); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10); };

// Plan del mes: 10 piezas cada 3 días arrancando el 1ro → días 1,4,7,10,13,16,19,22,25,28
// Hoy es 14 → ya pasaron 1,4,7,10,13 (5 publicadas/programadas). Sigue 16.
const dayOfMonth = (n) => `2026-05-${String(n).padStart(2, "0")}`;
const PUBLISH_DAYS = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28];

const MOCK_PIECES = [
  // IG
  { id: "ig1", network: "instagram", scheduledDate: dayOfMonth(1), status: "publicado", copy: "Carrusel: 5 errores al importar de China por primera vez" },
  { id: "ig2", network: "instagram", scheduledDate: dayOfMonth(4), status: "publicado", copy: "Reel: día en el depósito de Mr. Shi" },
  { id: "ig3", network: "instagram", scheduledDate: dayOfMonth(7), status: "publicado", copy: "Promo: Tier Plata = 10% off flete a partir de 5 ops" },
  { id: "ig4", network: "instagram", scheduledDate: dayOfMonth(10), status: "publicado", copy: "Reel: cómo cargás un contenedor paso a paso" },
  { id: "ig5", network: "instagram", scheduledDate: dayOfMonth(13), status: "publicado", copy: "Tutorial 1 min: cómo calcular CBM" },
  { id: "ig6", network: "instagram", scheduledDate: dayOfMonth(16), status: "revision", copy: "Caso de éxito: Pedevilla SA + 8m³ simuladores" },
  { id: "ig7", network: "instagram", scheduledDate: dayOfMonth(19), status: "diseno", copy: "Foto producto + precio: USD 15/kg aéreo USA" },
  { id: "ig8", network: "instagram", scheduledDate: dayOfMonth(22), status: "guion", copy: "Detrás de escena: el equipo en oficina" },
  { id: "ig9", network: "instagram", scheduledDate: dayOfMonth(25), status: "idea", copy: "Pregunta para historias: ¿qué importás hoy?" },
  { id: "ig10", network: "instagram", scheduledDate: dayOfMonth(28), status: "idea", copy: "Cierre del mes: top 3 cargas mayo" },

  // LinkedIn
  { id: "li1", network: "linkedin", scheduledDate: dayOfMonth(1), status: "publicado", copy: "Nueva ruta directa USA → Argentina, tiempos reducidos 12 días" },
  { id: "li2", network: "linkedin", scheduledDate: dayOfMonth(4), status: "publicado", copy: "Por qué medimos el CBM en marítimo (y no el peso)" },
  { id: "li3", network: "linkedin", scheduledDate: dayOfMonth(7), status: "publicado", copy: "Reflexión: lo que nadie te dice de importar desde China" },
  { id: "li4", network: "linkedin", scheduledDate: dayOfMonth(10), status: "publicado", copy: "Hilo: 7 pasos del comercio exterior explicados" },
  { id: "li5", network: "linkedin", scheduledDate: dayOfMonth(13), status: "publicado", copy: "Anuncio: nueva opción de pago con tarjeta" },
  { id: "li6", network: "linkedin", scheduledDate: dayOfMonth(16), status: "guion", copy: "Caso de éxito: importamos 8m³ de simuladores" },
  { id: "li7", network: "linkedin", scheduledDate: dayOfMonth(19), status: "idea", copy: "Análisis: ¿qué pasa con la suba del flete marítimo en 2026?" },
  { id: "li8", network: "linkedin", scheduledDate: dayOfMonth(22), status: "idea", copy: "Opinión: por qué Argentina necesita más despachantes" },
  { id: "li9", network: "linkedin", scheduledDate: dayOfMonth(25), status: "idea", copy: "Recomendación de libro/podcast comercio exterior" },
  { id: "li10", network: "linkedin", scheduledDate: dayOfMonth(28), status: "idea", copy: "Recapitulación: cosas aprendidas este mes" },

  // X
  { id: "x1", network: "x", scheduledDate: dayOfMonth(1), status: "publicado", copy: "Hilo: cómo levanté Argencargo desde cero 🧵" },
  { id: "x2", network: "x", scheduledDate: dayOfMonth(4), status: "publicado", copy: "Si pensás importar de China leé esto 👇" },
  { id: "x3", network: "x", scheduledDate: dayOfMonth(7), status: "publicado", copy: "Mini hilo: precios flete USA→ARG" },
  { id: "x4", network: "x", scheduledDate: dayOfMonth(10), status: "publicado", copy: "Opinión: ¿por qué Mercado Libre no compite con un forwarder?" },
  { id: "x5", network: "x", scheduledDate: dayOfMonth(13), status: "publicado", copy: "Dato del día: cuánto pesa un container LCL promedio" },
  { id: "x6", network: "x", scheduledDate: dayOfMonth(16), status: "guion", copy: "Hilo: el sistema de tracking en vivo que armamos" },
  { id: "x7", network: "x", scheduledDate: dayOfMonth(19), status: "idea", copy: "Hilo: 5 mitos del comercio exterior argentino" },
  { id: "x8", network: "x", scheduledDate: dayOfMonth(22), status: "idea", copy: "Anuncio: ya recibimos cargas desde Europa" },
  { id: "x9", network: "x", scheduledDate: dayOfMonth(25), status: "idea", copy: "Pregunta abierta a la TL: ¿qué te frena para importar?" },
  { id: "x10", network: "x", scheduledDate: dayOfMonth(28), status: "idea", copy: "Resumen mensual: qué cargamos en mayo" },
];

const MOCK_SOURCES = [
  { id: "s1", name: "CDA — Centro Despachantes Aduana", url: "https://www.cda.org.ar/" },
  { id: "s2", name: "AFIP / Aduana", url: "https://www.afip.gob.ar/" },
  { id: "s3", name: "Boletín Oficial — Comercio Exterior", url: "https://www.boletinoficial.gob.ar/" },
  { id: "s4", name: "CERA — Cámara de Exportadores", url: "https://www.cera.org.ar/" },
  { id: "s5", name: "CIRA — Cámara Importadores Rep. Argentina", url: "https://www.cira.org.ar/" },
  { id: "s6", name: "Comex Online", url: "https://comexonline.com.ar/" },
  { id: "s7", name: "Trade News", url: "https://tradenews.com.ar/" },
  { id: "s8", name: "CACE — Cámara Argentina Comercio Electrónico", url: "https://www.cace.org.ar/" },
  { id: "s9", name: "Ministerio de Economía — Comercio", url: "https://www.argentina.gob.ar/economia/comercio" },
  { id: "s10", name: "Ámbito Financiero — Comex", url: "https://www.ambito.com/contenidos/comercio-exterior.html" },
  { id: "s11", name: "El Cronista — Comex", url: "https://www.cronista.com/seccion/comercio-exterior/" },
];

const MOCK_RADAR = [
  { id: "r1", source: "CDA", title: "Modificación al régimen de importación de muestras sin valor comercial", date: dayOfMonth(14), link: "#", isHot: true },
  { id: "r2", source: "AFIP", title: "Resolución 5670/2026 — Nuevo régimen de antidumping para textiles", date: dayOfMonth(14), link: "#", isHot: true },
  { id: "r3", source: "Boletín Oficial", title: "Decreto 282/2026 — Reducción aranceles bienes de capital", date: dayOfMonth(13), link: "#", isHot: false },
  { id: "r4", source: "CDA", title: "Curso sobre la nueva DJAI", date: dayOfMonth(13), link: "#", isHot: false },
  { id: "r5", source: "CIRA", title: "Comunicado: posición sobre la nueva ley de comex", date: dayOfMonth(13), link: "#", isHot: false },
  { id: "r6", source: "AFIP", title: "Aviso: cambio en el sistema MARÍA — actualización requerida", date: dayOfMonth(12), link: "#", isHot: false },
  { id: "r7", source: "Comex Online", title: "Sube el flete marítimo desde China un 8% en mayo", date: dayOfMonth(12), link: "#", isHot: false },
];

const MOCK_REACTIVES = [
  { id: "rx1", source: "AFIP Res 5670/2026", title: "Antidumping textiles", note: "Aprovechar para explicar qué es antidumping y a quién afecta", targetNetwork: "linkedin", status: "guion", createdAt: dayOfMonth(14) },
  { id: "rx2", source: "Decreto 282/2026", title: "Reducción aranceles bienes de capital", note: "Posible alegría para importadores de maquinaria. Reel o hilo X.", targetNetwork: "x", status: "idea", createdAt: dayOfMonth(13) },
];

const STATUS = {
  idea: { l: "Idea", c: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  guion: { l: "Guión", c: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  diseno: { l: "Diseño", c: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  revision: { l: "Revisión", c: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  programado: { l: "Programado", c: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  publicado: { l: "Publicado", c: "#22c55e", bg: "rgba(34,197,94,0.12)" },
};

export default function MktPreview() {
  const [tab, setTab] = useState("hoy");
  const [briefData, setBriefData] = useState({ red: "instagram", objetivo: "", publico: "", tono: "casual", formato: "feed", cta: "", datos: "" });

  return (
    <div style={{ minHeight: "100vh", background: DARK_BG, color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <Header />
      <Tabs tab={tab} setTab={setTab} />

      <main style={{ padding: "28px", maxWidth: 1320, margin: "0 auto" }}>
        {tab === "hoy" && <Hoy posts={MOCK_PIECES} radar={MOCK_RADAR} reactives={MOCK_REACTIVES} />}
        {tab === "plan" && <Plan posts={MOCK_PIECES} />}
        {tab === "radar" && <Radar items={MOCK_RADAR} sources={MOCK_SOURCES} />}
        {tab === "reactivos" && <Reactivos items={MOCK_REACTIVES} />}
        {tab === "brief" && <Brief data={briefData} setData={setBriefData} />}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header style={{ padding: "22px 28px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(7,12,26,0.55)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: GOLD_GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1628", fontWeight: 900, fontSize: 14, letterSpacing: "0.02em" }}>AC</div>
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: 14 }}>
          <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, color: GOLD_LIGHT, letterSpacing: "0.18em", textTransform: "uppercase" }}>Marketing</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            {today.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, c => c.toUpperCase())}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 14px 5px 5px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, fontSize: 12 }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: GOLD_GRADIENT, color: "#0A1628", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 10.5 }}>BA</div>
        <span style={{ color: "rgba(255,255,255,0.85)" }}>Bauti</span>
      </div>
    </header>
  );
}

function Tabs({ tab, setTab }) {
  const items = [
    { k: "hoy", l: "Hoy", e: "◐" },
    { k: "plan", l: "Plan del mes", e: "▦" },
    { k: "radar", l: "Radar aduanero", e: "◎" },
    { k: "reactivos", l: "Reactivos", e: "◆" },
    { k: "brief", l: "Brief copy", e: "✎" },
  ];
  return (
    <nav style={{ display: "flex", justifyContent: "center", gap: 0, padding: "0 28px", borderBottom: "1px solid rgba(255,255,255,0.05)", maxWidth: 1320, margin: "0 auto", overflowX: "auto" }}>
      {items.map(t => (
        <button key={t.k} onClick={() => setTab(t.k)} style={{
          padding: "16px 26px", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
          background: "transparent",
          color: tab === t.k ? "#fff" : "rgba(255,255,255,0.45)",
          borderBottom: tab === t.k ? `2px solid ${GOLD_LIGHT}` : "2px solid transparent",
          marginBottom: -1, whiteSpace: "nowrap",
          transition: "color 180ms",
          display: "flex", alignItems: "center", gap: 10,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          fontFamily: "-apple-system, system-ui, sans-serif",
        }}
          onMouseEnter={e => { if (tab !== t.k) e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
          onMouseLeave={e => { if (tab !== t.k) e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}>
          <span style={{ fontSize: 13, color: tab === t.k ? GOLD_LIGHT : "inherit", letterSpacing: 0 }}>{t.e}</span>
          <span>{t.l}</span>
        </button>
      ))}
    </nav>
  );
}

// ─────── HOY ───────
function Hoy({ posts, radar, reactives }) {
  const [checked, setChecked] = useState({});
  const [extraTasks, setExtraTasks] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const todayPosts = posts.filter(p => p.scheduledDate === todayStr && p.status !== "publicado");
  const newRadar = radar.filter(r => r.date === todayStr);
  const hotRadar = newRadar.filter(r => r.isHot);
  const pendingReactives = reactives.filter(r => r.status !== "publicado");

  const baseTasks = useMemo(() => [
    { id: "t-radar", icon: "📰", title: "Revisar portales aduaneros", sub: `${newRadar.length} novedad${newRadar.length !== 1 ? "es" : ""} nueva${newRadar.length !== 1 ? "s" : ""} hoy · CDA · AFIP · Boletín Oficial · CIRA · ...`, group: "Diario" },
    { id: "t-story-ig", icon: "📸", title: "Story en Instagram", sub: "1 historia diaria @argencargo — pregunta, dato corto, behind-the-scenes", group: "Diario" },
    { id: "t-status-wa", icon: "💚", title: "Estado en WhatsApp", sub: "Actualizar estado (Argencargo o personal) — algo del día", group: "Diario" },
    ...(hotRadar.length > 0 ? [{ id: "t-reactivo", icon: "🔥", title: "Producir contenido reactivo", sub: `Hay ${hotRadar.length} novedad${hotRadar.length !== 1 ? "es" : ""} importante${hotRadar.length !== 1 ? "s" : ""} en el radar — evaluar si conviene postearlo`, group: "Diario" }] : []),
    ...todayPosts.map(p => ({
      id: "post-" + p.id, icon: NETWORKS[p.network].icon, title: `Publicar ${NETWORKS[p.network].label}`, sub: p.copy, group: "Publicaciones del día", autoGenerated: true,
    })),
  ], [todayPosts.length, newRadar.length, hotRadar.length]);

  const allTasks = [...baseTasks, ...extraTasks];
  const done = allTasks.filter(t => checked[t.id]).length;
  const pct = allTasks.length > 0 ? Math.round(done / allTasks.length * 100) : 0;

  const addTask = () => {
    if (!newTitle.trim()) return;
    setExtraTasks(p => [...p, { id: "u-" + Date.now(), icon: "✏️", title: newTitle.trim(), sub: "Tarea agregada manualmente", group: "Personalizadas" }]);
    setNewTitle("");
    setShowAdd(false);
  };

  // Agrupar
  const byGroup = {};
  allTasks.forEach(t => { byGroup[t.group] = byGroup[t.group] || []; byGroup[t.group].push(t); });
  const groupOrder = ["Diario", "Publicaciones del día", "Personalizadas"];

  return (
    <div>
      {/* Header con progreso */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.12em" }}>Rutina del día</p>
            <h2 style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>{today.toLocaleDateString("es-AR", { weekday: "long" }).replace(/^./, c => c.toUpperCase())}, {today.getDate()}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{done} de {allTasks.length} tareas completadas</p>
          </div>
          {(() => {
            // Color dinámico según %: rojo (0) → naranja (33) → amarillo verdoso (66) → verde (100)
            // HSL hue: 0 (rojo) a 142 (verde esmeralda)
            const hue = Math.round(pct * 1.42);
            const progColor = `hsl(${hue}, 72%, 55%)`;
            const progColorDark = `hsl(${hue}, 72%, 48%)`;
            return (
              <div style={{ minWidth: 260, flex: "0 0 auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Progreso</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: progColor, fontFeatureSettings: '"tnum"', transition: "color 400ms" }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${progColorDark}, ${progColor})`, transition: "width 400ms, background 400ms", borderRadius: 4, boxShadow: pct > 0 ? `0 0 12px ${progColor}55` : "none" }} />
                </div>
              </div>
            );
          })()}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 18 }}>
          <Stat label="A publicar hoy" value={todayPosts.length} color={GOLD_LIGHT} />
          <Stat label="Novedades hoy" value={newRadar.length} color="#60a5fa" />
          <Stat label="Reactivos" value={pendingReactives.length} color="#fb923c" />
          <Stat label="Piezas pendientes" value={posts.filter(p => p.status !== "publicado").length} color="rgba(255,255,255,0.55)" />
        </div>
      </Card>

      {/* Tareas agrupadas */}
      {groupOrder.filter(g => byGroup[g]).map(g => (
        <div key={g} style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", paddingLeft: 4 }}>{g}</p>
          <Card padded={false}>
            {byGroup[g].map((t, idx) => (
              <label key={t.id} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                borderBottom: idx < byGroup[g].length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                cursor: "pointer", opacity: checked[t.id] ? 0.45 : 1,
                transition: "opacity 200ms, background 150ms",
              }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <input type="checkbox" checked={!!checked[t.id]} onChange={() => setChecked(p => ({ ...p, [t.id]: !p[t.id] }))} style={{ width: 18, height: 18, accentColor: GOLD, cursor: "pointer" }} />
                <span style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#fff", textDecoration: checked[t.id] ? "line-through" : "none", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {t.title}
                    {t.autoGenerated && <span style={{ fontSize: 8.5, fontWeight: 800, padding: "1.5px 6px", borderRadius: 3, background: "rgba(96,165,250,0.15)", color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em" }}>AUTO</span>}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t.sub}</p>
                </div>
              </label>
            ))}
          </Card>
        </div>
      ))}

      {/* Agregar tarea manual */}
      <div style={{ marginTop: 16 }}>
        {showAdd ? (
          <Card>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Nueva tarea</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="¿Qué hay que hacer hoy?" style={{ flex: 1, padding: "10px 14px", fontSize: 13.5, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, background: "rgba(0,0,0,0.3)", color: "#fff", outline: "none" }} />
              <button onClick={addTask} style={btnPrimary}>Agregar</button>
              <button onClick={() => { setShowAdd(false); setNewTitle(""); }} style={btnSec}>Cancelar</button>
            </div>
          </Card>
        ) : (
          <button onClick={() => setShowAdd(true)} style={{ width: "100%", padding: "14px 18px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.02)", border: "1.5px dashed rgba(255,255,255,0.12)", borderRadius: 12, cursor: "pointer", transition: "all 150ms" }}
            onMouseEnter={e => { e.currentTarget.style.color = GOLD_LIGHT; e.currentTarget.style.borderColor = "rgba(184,149,106,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}>
            + Agregar tarea
          </button>
        )}
      </div>
    </div>
  );
}

// ─────── PLAN DEL MES ───────
function Plan({ posts }) {
  const [redSel, setRedSel] = useState("instagram");
  const piezasRed = posts.filter(p => p.network === redSel).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const net = NETWORKS[redSel];
  const totalPub = posts.filter(p => p.network === redSel && p.status === "publicado").length;
  const pct = Math.round(totalPub / 10 * 100);

  return (
    <div>
      <PageHeader title="Plan mayo 2026" sub="10 piezas por red — cada 3 días — línea editorial propia por red" right={<button style={btnSec}>‹ Abril</button>} rightExtra={<button style={btnSec}>Junio ›</button>} />

      {/* Tabs de red */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        {Object.entries(NETWORKS).map(([k, n]) => {
          const pp = posts.filter(p => p.network === k);
          const pub = pp.filter(p => p.status === "publicado").length;
          const isSel = redSel === k;
          return (
            <button key={k} onClick={() => setRedSel(k)} style={{
              padding: "14px 16px", textAlign: "left",
              border: `1.5px solid ${isSel ? n.bd : "rgba(255,255,255,0.08)"}`,
              borderRadius: 12, cursor: "pointer",
              background: isSel ? n.bg : "rgba(255,255,255,0.025)",
              transition: "all 150ms",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{n.icon}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: isSel ? (n.color === "#fff" ? "#fff" : n.color) : "#fff" }}>{n.label}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{n.account}</div>
              <div style={{ marginTop: 8, height: 4, background: "rgba(0,0,0,0.3)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${pub / 10 * 100}%`, height: "100%", background: n.color === "#fff" ? "#fff" : n.color, transition: "width 300ms" }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.55)", display: "flex", justifyContent: "space-between" }}>
                <span>{pub}/10 publicadas</span>
                <span style={{ fontWeight: 700, color: isSel ? (n.color === "#fff" ? "#fff" : n.color) : "rgba(255,255,255,0.65)" }}>{pub * 10}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Línea editorial */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.1em" }}>Línea editorial · {net.label}</p>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{net.brand}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.55 }}>{net.line}</p>
      </Card>

      {/* Piezas */}
      <div style={{ marginTop: 16 }}>
        <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", paddingLeft: 4 }}>10 piezas del mes</p>
        <Card padded={false}>
          {piezasRed.map((p, i) => {
            const st = STATUS[p.status];
            return (
              <div key={p.id} style={{
                display: "grid", gridTemplateColumns: "44px 90px 1fr 110px 80px",
                gap: 14, alignItems: "center",
                padding: "13px 18px",
                borderBottom: i < piezasRed.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                cursor: "pointer", transition: "background 120ms",
              }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.35)" }}>#{i + 1}</span>
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", fontFamily: "ui-monospace, monospace", fontFeatureSettings: '"tnum"' }}>
                  {p.scheduledDate.slice(8)}/{p.scheduledDate.slice(5, 7)}
                </span>
                <span style={{ fontSize: 13.5, color: "#fff", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.copy}</span>
                <Badge color={st.c} bg={st.bg}>{st.l}</Badge>
                <button style={btnSecMini}>Abrir →</button>
              </div>
            );
          })}
        </Card>
      </div>

      <p style={{ marginTop: 14, fontSize: 11.5, color: "rgba(255,255,255,0.4)", textAlign: "center", fontStyle: "italic" }}>
        El 1ro de cada mes el sistema crea automáticamente los 10 slots con fecha programada cada 3 días.
      </p>
    </div>
  );
}

// ─────── RADAR ───────
function Radar({ items, sources }) {
  const [filt, setFilt] = useState("all");
  const [showSources, setShowSources] = useState(false);
  const filtered = items.filter(i => filt === "all" || i.source === filt);
  const uniqSources = Array.from(new Set(items.map(i => i.source)));

  return (
    <div>
      <PageHeader
        title="Radar aduanero"
        sub={<>Headlines de portales relevantes · scrappeo diario automático <span style={{ color: GOLD_LIGHT, fontWeight: 600 }}>(sin IA, 0 costo API)</span></>}
        right={<button onClick={() => setShowSources(s => !s)} style={btnSec}>⚙ Fuentes ({sources.length})</button>}
      />

      {showSources && (
        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.08em" }}>Portales registrados</p>
          {sources.map(s => (
            <div key={s.id} style={{ padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{s.url}</p>
              </div>
              <button style={btnSecMini}>Editar</button>
            </div>
          ))}
          <button style={{ ...btnSec, marginTop: 10, width: "100%" }}>+ Agregar fuente</button>
        </Card>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, marginTop: 16, marginBottom: 14, flexWrap: "wrap" }}>
        <FilterPill active={filt === "all"} onClick={() => setFilt("all")}>Todos · {items.length}</FilterPill>
        {uniqSources.map(s => <FilterPill key={s} active={filt === s} onClick={() => setFilt(s)}>{s} · {items.filter(i => i.source === s).length}</FilterPill>)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(item => (
          <div key={item.id} style={{
            padding: "14px 18px",
            background: item.isHot ? "linear-gradient(135deg, rgba(251,146,60,0.08), rgba(251,146,60,0.03))" : "rgba(255,255,255,0.025)",
            border: `1px solid ${item.isHot ? "rgba(251,146,60,0.35)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap",
            transition: "transform 150ms",
          }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                <Badge color="#60a5fa" bg="rgba(96,165,250,0.15)">{item.source}</Badge>
                {item.isHot && <Badge color="#fb923c" bg="rgba(251,146,60,0.18)">🔥 Importante</Badge>}
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.date}</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "#fff", fontWeight: 500, lineHeight: 1.4 }}>{item.title}</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={btnSecMini}>🔗 Abrir</button>
              <button style={{ ...btnSecMini, borderColor: "rgba(184,149,106,0.5)", color: GOLD_LIGHT, background: "rgba(184,149,106,0.08)" }}>→ Crear reactivo</button>
              <button style={btnSecMini}>✓ Leído</button>
            </div>
          </div>
        ))}
      </div>

      <InfoBox>
        <b style={{ color: GOLD_LIGHT }}>💡 ¿Cómo funciona?</b> Un cron diario a las 8am descarga los headlines de cada portal registrado (sin IA, solo fetch HTML).
        Las novedades aparecen acá. Apretás <b>"Crear reactivo"</b> para mandar una idea a la bandeja de reactivos donde la trabajás.
      </InfoBox>
    </div>
  );
}

// ─────── REACTIVOS ───────
function Reactivos({ items }) {
  return (
    <div>
      <PageHeader title="Bandeja de reactivos" sub="Ideas pendientes de producir que vienen del radar. Cuando están listas se mandan al Plan del mes." />

      <InfoBox>
        <b style={{ color: GOLD_LIGHT }}>📌 Cómo funciona el flow:</b>
        <ol style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
          <li>Una novedad aparece en el <b>Radar aduanero</b>.</li>
          <li>Apretás <b>"Crear reactivo"</b> → cae acá como idea.</li>
          <li>La trabajás: redactás copy, elegís red, formato, asset.</li>
          <li>Cuando está lista, click <b>"→ Al plan del mes"</b> → se convierte en pieza programada como cualquier otra.</li>
          <li>El día programado aparece en <b>Hoy</b> como tarea de publicación.</li>
        </ol>
      </InfoBox>

      {items.length === 0 ? (
        <div style={{ marginTop: 16, padding: "60px 20px", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13, background: "rgba(255,255,255,0.02)", border: "1.5px dashed rgba(255,255,255,0.1)", borderRadius: 12 }}>
          Sin reactivos pendientes. Cuando convertís una novedad del Radar, aparece acá.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 12, marginTop: 16 }}>
          {items.map(it => {
            const st = STATUS[it.status];
            const net = NETWORKS[it.targetNetwork];
            return (
              <div key={it.id} style={{
                padding: "16px 18px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                borderLeft: `3px solid ${net.color === "#fff" ? "rgba(255,255,255,0.7)" : net.color}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>📡 {it.source}</span>
                  <Badge color={st.c} bg={st.bg}>{st.l}</Badge>
                </div>
                <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#fff" }}>{it.title}</h3>
                <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, fontStyle: "italic" }}>"{it.note}"</p>
                <p style={{ margin: "10px 0 0", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Red sugerida: <b style={{ color: net.color === "#fff" ? "#fff" : net.color }}>{net.icon} {net.label}</b></p>
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <button style={btnSecMini}>✎ Editar</button>
                  <button style={{ ...btnSecMini, borderColor: "rgba(184,149,106,0.5)", color: GOLD_LIGHT, background: "rgba(184,149,106,0.08)" }}>→ Al plan del mes</button>
                  <button style={btnSecMini}>🗑 Descartar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────── BRIEF COPY ───────
function Brief({ data, setData }) {
  const net = NETWORKS[data.red];
  const prompt = `Necesito una idea de copy para **${net.label}** (${net.account}, línea editorial: ${net.line}).

**Objetivo del post:** ${data.objetivo || "(falta)"}
**Público:** ${data.publico || "(falta)"}
**Tono:** ${data.tono}
**Formato:** ${data.formato}
**CTA:** ${data.cta || "(falta)"}
**Datos clave:** ${data.datos || "(falta)"}

Dame 3 variantes claramente diferenciadas en estilo. Para cada una:
- Copy principal con saltos de línea bien marcados
- 5-8 hashtags relevantes (si aplica a la red)
- Sugerencia visual / asset

Tono Argencargo: claro, directo, profesional pero cercano. Empresa argentina de importaciones desde China y USA.`;

  return (
    <div>
      <PageHeader title="Brief copy" sub={<>Completá → copiá → pegámelo en el chat y te tiro 3 variantes. <b style={{ color: GOLD_LIGHT }}>0 costo de API.</b></>} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <Sel label="Red" value={data.red} onChange={v => setData(p => ({ ...p, red: v }))} options={Object.entries(NETWORKS).map(([k, n]) => ({ v: k, l: `${n.icon} ${n.label}` }))} />
            <Fld label="Objetivo del post" value={data.objetivo} onChange={v => setData(p => ({ ...p, objetivo: v }))} placeholder="Ej: anunciar la nueva ruta USA" />
            <Fld label="Público objetivo" value={data.publico} onChange={v => setData(p => ({ ...p, publico: v }))} placeholder="Ej: emprendedores que importan, 25-40" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Sel label="Tono" value={data.tono} onChange={v => setData(p => ({ ...p, tono: v }))} options={[{ v: "casual", l: "Casual" }, { v: "formal", l: "Formal" }, { v: "tecnico", l: "Técnico" }, { v: "divertido", l: "Divertido" }]} />
              <Sel label="Formato" value={data.formato} onChange={v => setData(p => ({ ...p, formato: v }))} options={["feed", "reel", "carrusel", "story", "hilo", "post-text"].map(f => ({ v: f, l: f }))} />
            </div>
            <Fld label="Call to action" value={data.cta} onChange={v => setData(p => ({ ...p, cta: v }))} placeholder="Ej: escribinos para cotizar" />
            <Fld label="Datos clave" value={data.datos} onChange={v => setData(p => ({ ...p, datos: v }))} placeholder="Ej: USD 4500/CBM, 30-40 días" multi />
          </div>
        </Card>

        <Card>
          <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.08em" }}>Brief armado</p>
          <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px", fontSize: 12, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", lineHeight: 1.6, maxHeight: 360, overflow: "auto", margin: 0 }}>{prompt}</pre>
          <button style={{ ...btnPrimary, marginTop: 12, width: "100%" }} onClick={() => { navigator.clipboard?.writeText(prompt); }}>📋 Copiar brief</button>
        </Card>
      </div>
    </div>
  );
}

// ─────── Helpers UI ───────
function Card({ children, padded = true }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14,
      padding: padded ? "18px 20px" : 0,
      boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    }}>{children}</div>
  );
}

function PageHeader({ title, sub, right, rightExtra }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h2>
        <p style={{ margin: "5px 0 0", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{sub}</p>
      </div>
      {(right || rightExtra) && <div style={{ display: "flex", gap: 6 }}>{right}{rightExtra}</div>}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ padding: "12px 14px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
      <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</p>
      <p style={{ margin: "5px 0 0", fontSize: 26, fontWeight: 800, color, fontFeatureSettings: '"tnum"', lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function Badge({ children, color, bg }) {
  return <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 4, background: bg, color, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{children}</span>;
}

function FilterPill({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", fontSize: 12, fontWeight: 600,
      border: `1px solid ${active ? GOLD_DEEP : "rgba(255,255,255,0.1)"}`,
      borderRadius: 999, cursor: "pointer",
      background: active ? "rgba(184,149,106,0.12)" : "rgba(255,255,255,0.025)",
      color: active ? GOLD_LIGHT : "rgba(255,255,255,0.65)",
      transition: "all 150ms",
    }}>{children}</button>
  );
}

function InfoBox({ children }) {
  return (
    <div style={{ marginTop: 18, padding: "14px 18px", background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.18)", borderRadius: 10, fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function Fld({ label, value, onChange, placeholder, multi }) {
  const Comp = multi ? "textarea" : "input";
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      <Comp value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={multi ? 3 : undefined}
        style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, background: "rgba(0,0,0,0.3)", color: "#fff", outline: "none", fontFamily: "inherit", resize: multi ? "vertical" : "none" }} />
    </div>
  );
}

function Sel({ label, value, onChange, options }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, background: "rgba(0,0,0,0.3)", color: "#fff", outline: "none" }}>
        {options.map(o => <option key={o.v} value={o.v} style={{ background: "#0F1F3A" }}>{o.l}</option>)}
      </select>
    </div>
  );
}

const btnPrimary = { padding: "9px 18px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: `1px solid ${GOLD_DEEP}`, background: GOLD_GRADIENT, color: "#0A1628", cursor: "pointer", letterSpacing: "0.02em", whiteSpace: "nowrap" };
const btnSec = { padding: "7px 14px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.8)", cursor: "pointer", whiteSpace: "nowrap" };
const btnSecMini = { padding: "5.5px 11px", fontSize: 11.5, fontWeight: 600, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.78)", cursor: "pointer", whiteSpace: "nowrap", transition: "all 150ms" };
