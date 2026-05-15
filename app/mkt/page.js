"use client";
import { useState, useMemo } from "react";

// ──────────────────────────────────────────────────────────────────────
// PREVIEW v2 — Panel Marketing Argencargo
// Estructura: Hoy (rutina) · Plan mensual · Radar aduanero · Reactivos · Brief
// Sin DB, sin auth todavía. Solo UI con data mockeada.
// ──────────────────────────────────────────────────────────────────────

const GOLD = "#B8956A", GOLD_LIGHT = "#E8D098", GOLD_DEEP = "#A68456";
const GOLD_GRADIENT = "linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";
const DARK_BG = "linear-gradient(135deg,#070C1A 0%,#0A1628 50%,#0F1F3A 100%)";

const NETWORKS = {
  instagram: { label: "Instagram", icon: "📷", color: "#E1306C", bg: "rgba(225,48,108,0.12)", bd: "rgba(225,48,108,0.4)", account: "@argencargo", brand: "empresa", line: "Más visual/comercial. Para clientes finales: precios, servicios, casos, behind-the-scenes." },
  linkedin: { label: "LinkedIn", icon: "💼", color: "#0A66C2", bg: "rgba(10,102,194,0.12)", bd: "rgba(10,102,194,0.4)", account: "@Bautista Artuso", brand: "personal + tag empresa", line: "B2B. Novedades del sector, anuncios, opinión profesional, casos de éxito." },
  x: { label: "X / Twitter", icon: "𝕏", color: "#fff", bg: "rgba(255,255,255,0.08)", bd: "rgba(255,255,255,0.3)", account: "@Bautista", brand: "personal", line: "Punzante. Novedades, opinión rápida, hilos técnicos, comercio exterior." },
};

const today = new Date(2026, 4, 14);
const todayStr = today.toISOString().slice(0, 10);
const d = (off) => { const x = new Date(today); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10); };

const MOCK_PIECES = [
  // IG mayo
  { id: "ig1", network: "instagram", scheduledDate: d(-12), status: "publicado", copy: "Carrusel: 5 errores al importar de China por primera vez" },
  { id: "ig2", network: "instagram", scheduledDate: d(-8), status: "publicado", copy: "Reel: día en el depósito de Mr. Shi" },
  { id: "ig3", network: "instagram", scheduledDate: d(-5), status: "publicado", copy: "Promo: Tier Plata = 10% off flete a partir de 5 ops" },
  { id: "ig4", network: "instagram", scheduledDate: d(0), status: "programado", copy: "Carrusel: 5 errores que cometen importadores nuevos" },
  { id: "ig5", network: "instagram", scheduledDate: d(3), status: "revision", copy: "Caso de éxito: Pedevilla SA + 8m³ simuladores" },
  { id: "ig6", network: "instagram", scheduledDate: d(7), status: "diseno", copy: "Reel: cómo cargás un contenedor — paso a paso" },
  { id: "ig7", network: "instagram", scheduledDate: d(10), status: "idea", copy: "Foto producto + precio: $15/kg aéreo USA" },
  { id: "ig8", network: "instagram", scheduledDate: d(14), status: "idea", copy: "Tutorial 1 min: cómo calcular tu volumen CBM" },
  { id: "ig9", network: "instagram", scheduledDate: d(18), status: "idea", copy: "Detrás de escena: el equipo en oficina" },
  { id: "ig10", network: "instagram", scheduledDate: d(22), status: "idea", copy: "Pregunta para historias: ¿qué importás hoy?" },

  // LinkedIn
  { id: "li1", network: "linkedin", scheduledDate: d(-10), status: "publicado", copy: "Nueva ruta directa USA → Argentina, tiempos reducidos 12 días" },
  { id: "li2", network: "linkedin", scheduledDate: d(-6), status: "publicado", copy: "Por qué medimos el CBM en marítimo (y no el peso)" },
  { id: "li3", network: "linkedin", scheduledDate: d(-1), status: "publicado", copy: "Reflexión: lo que nadie te dice de importar desde China" },
  { id: "li4", network: "linkedin", scheduledDate: d(2), status: "guion", copy: "Caso de éxito: importamos 8m³ de simuladores videojuegos" },
  { id: "li5", network: "linkedin", scheduledDate: d(6), status: "idea", copy: "Análisis: ¿qué pasa con la suba del flete marítimo en 2026?" },
  { id: "li6", network: "linkedin", scheduledDate: d(9), status: "idea", copy: "Hilo: 7 pasos del comercio exterior explicados" },
  { id: "li7", network: "linkedin", scheduledDate: d(13), status: "idea", copy: "Anuncio: nueva opción de pago con tarjeta" },
  { id: "li8", network: "linkedin", scheduledDate: d(17), status: "idea", copy: "Opinión: por qué Argentina necesita más despachantes" },
  { id: "li9", network: "linkedin", scheduledDate: d(20), status: "idea", copy: "Recomendación de libro/podcast comercio exterior" },
  { id: "li10", network: "linkedin", scheduledDate: d(25), status: "idea", copy: "Recapitulación: cosas aprendidas este mes" },

  // X
  { id: "x1", network: "x", scheduledDate: d(-11), status: "publicado", copy: "Hilo: cómo levanté Argencargo desde cero 🧵" },
  { id: "x2", network: "x", scheduledDate: d(-7), status: "publicado", copy: "Si pensás importar de China y no sabés por dónde empezar, leé esto 👇" },
  { id: "x3", network: "x", scheduledDate: d(-3), status: "publicado", copy: "Mini hilo: precios actualizados de flete USA→ARG" },
  { id: "x4", network: "x", scheduledDate: d(1), status: "guion", copy: "Hilo: el sistema de tracking en vivo que armamos" },
  { id: "x5", network: "x", scheduledDate: d(4), status: "idea", copy: "Opinión: ¿por qué Mercado Libre no compite con un forwarder?" },
  { id: "x6", network: "x", scheduledDate: d(8), status: "idea", copy: "Dato del día: cuánto pesa un container LCL promedio" },
  { id: "x7", network: "x", scheduledDate: d(12), status: "idea", copy: "Hilo: 5 mitos del comercio exterior argentino" },
  { id: "x8", network: "x", scheduledDate: d(15), status: "idea", copy: "Anuncio: ya recibimos cargas desde Europa" },
  { id: "x9", network: "x", scheduledDate: d(19), status: "idea", copy: "Pregunta abierta a la TL: ¿qué te frena para importar?" },
  { id: "x10", network: "x", scheduledDate: d(23), status: "idea", copy: "Resumen mensual: qué cargamos en mayo" },
];

const MOCK_RADAR = [
  { id: "r1", source: "CDA", title: "Modificación al régimen de importación de muestras sin valor comercial", date: d(0), link: "#", isHot: true },
  { id: "r2", source: "AFIP", title: "Resolución 5670/2026 — Nuevo régimen de antidumping para textiles", date: d(0), link: "#", isHot: true },
  { id: "r3", source: "Boletín Oficial", title: "Decreto 282/2026 — Reducción aranceles bienes de capital", date: d(-1), link: "#", isHot: false },
  { id: "r4", source: "CDA", title: "Curso sobre la nueva DJAI", date: d(-1), link: "#", isHot: false },
  { id: "r5", source: "AFIP", title: "Aviso: cambio en el sistema MARÍA — actualización requerida", date: d(-2), link: "#", isHot: false },
];

const MOCK_REACTIVES = [
  { id: "rx1", source: "AFIP Res 5670/2026", title: "Antidumping textiles", note: "Aprovechar para explicar qué es antidumping y a quién afecta", status: "guion", createdAt: d(0) },
  { id: "rx2", source: "Decreto 282/2026", title: "Reducción aranceles bienes de capital", note: "Posible alegría para importadores de maquinaria. Reel o hilo X.", status: "idea", createdAt: d(-1) },
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
    <div style={{ minHeight: "100vh", background: DARK_BG, color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "0.04em" }}>ARGENCARGO · <span style={{ color: GOLD_LIGHT }}>Marketing</span></h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Preview v2 · sin backend · {today.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD_GRADIENT, color: "#0A1628", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>BA</div>
          <span style={{ color: "rgba(255,255,255,0.75)" }}>Bauti</span>
        </div>
      </header>

      <nav style={{ display: "flex", gap: 4, padding: "12px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
        {[
          { k: "hoy", l: "🌅 Hoy" },
          { k: "plan", l: "🗓️ Plan del mes" },
          { k: "radar", l: "📡 Radar aduanero" },
          { k: "reactivos", l: "🔥 Reactivos" },
          { k: "brief", l: "✍️ Brief copy" },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{ padding: "9px 16px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 8, cursor: "pointer", background: tab === t.k ? GOLD_GRADIENT : "transparent", color: tab === t.k ? "#0A1628" : "rgba(255,255,255,0.6)", whiteSpace: "nowrap", transition: "all 150ms" }}>
            {t.l}
          </button>
        ))}
      </nav>

      <main style={{ padding: "24px 28px", maxWidth: 1280, margin: "0 auto" }}>
        {tab === "hoy" && <Hoy posts={MOCK_PIECES} radar={MOCK_RADAR} reactives={MOCK_REACTIVES} />}
        {tab === "plan" && <Plan posts={MOCK_PIECES} />}
        {tab === "radar" && <Radar items={MOCK_RADAR} />}
        {tab === "reactivos" && <Reactivos items={MOCK_REACTIVES} />}
        {tab === "brief" && <Brief data={briefData} setData={setBriefData} />}
      </main>
    </div>
  );
}

// ─────── HOY ───────
function Hoy({ posts, radar, reactives }) {
  const [checked, setChecked] = useState({});
  const togg = (k) => setChecked(p => ({ ...p, [k]: !p[k] }));

  const todayPosts = posts.filter(p => p.scheduledDate === todayStr && p.status !== "publicado");
  const newRadar = radar.filter(r => r.date === todayStr);
  const pendingReactives = reactives.filter(r => r.status !== "publicado");

  const tasks = [
    { id: "t1", icon: "📰", title: "Revisar portales aduaneros", sub: `CDA · AFIP · Boletín Oficial · ${newRadar.length} novedades nuevas hoy`, action: "Ir al radar →", actionTab: "radar" },
    { id: "t2", icon: "📸", title: "Story IG / Estado WhatsApp del día", sub: "Tema libre — algo del día a día, una pregunta, un dato corto", action: null },
    { id: "t3", icon: "💬", title: "Responder DMs y comentarios", sub: "IG · LinkedIn · WhatsApp — revisar y responder lo del día", action: null },
    ...todayPosts.map(p => ({
      id: "post-" + p.id, icon: NETWORKS[p.network].icon, title: `Publicar ${NETWORKS[p.network].label}`, sub: p.copy, action: "Ver pieza →",
    })),
    ...(newRadar.filter(r => r.isHot).length > 0 ? [{ id: "t4", icon: "🔥", title: "Producir contenido reactivo", sub: `Hay ${newRadar.filter(r => r.isHot).length} novedad${newRadar.filter(r => r.isHot).length > 1 ? "es" : ""} importante${newRadar.filter(r => r.isHot).length > 1 ? "s" : ""} sin convertir`, action: "Ver novedades →" }] : []),
  ];

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Hoy</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{today.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/^./, c => c.toUpperCase())} · {tasks.filter(t => checked[t.id]).length}/{tasks.length} completadas</p>
      </div>

      {/* Resumen rápido */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 22 }}>
        <Stat label="A publicar hoy" value={todayPosts.length} color={GOLD_LIGHT} />
        <Stat label="Novedades nuevas" value={newRadar.length} color="#60a5fa" />
        <Stat label="Reactivos pendientes" value={pendingReactives.length} color="#fb923c" />
        <Stat label="Piezas mes restantes" value={posts.filter(p => p.status === "idea").length} color="rgba(255,255,255,0.55)" />
      </div>

      {/* Checklist */}
      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(184,149,106,0.04)" }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: GOLD_LIGHT, textTransform: "uppercase", letterSpacing: "0.08em" }}>Rutina del día</p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>Marcá lo que vayas haciendo. Lo que no aplica, skipealo.</p>
        </div>
        {tasks.map((t) => (
          <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 120ms", opacity: checked[t.id] ? 0.5 : 1 }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <input type="checkbox" checked={!!checked[t.id]} onChange={() => togg(t.id)} style={{ width: 18, height: 18, accentColor: GOLD }} />
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#fff", textDecoration: checked[t.id] ? "line-through" : "none" }}>{t.title}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{t.sub}</p>
            </div>
            {t.action && <button style={btnSec}>{t.action}</button>}
          </label>
        ))}
      </div>

      <p style={{ marginTop: 16, fontSize: 11, color: "rgba(255,255,255,0.4)", fontStyle: "italic", textAlign: "center" }}>
        Al día siguiente la lista arranca de nuevo. Lo no hecho queda en la pieza/novedad correspondiente.
      </p>
    </div>
  );
}

// ─────── PLAN DEL MES ───────
function Plan({ posts }) {
  const [redSel, setRedSel] = useState("instagram");
  const piezasRed = posts.filter(p => p.network === redSel).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const net = NETWORKS[redSel];

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Plan mayo 2026</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>10 piezas por red · cada red tiene su propia línea editorial</p>
      </div>

      {/* Tabs de red */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {Object.entries(NETWORKS).map(([k, n]) => {
          const pp = posts.filter(p => p.network === k);
          const pub = pp.filter(p => p.status === "publicado").length;
          return (
            <button key={k} onClick={() => setRedSel(k)} style={{ padding: "10px 16px", fontSize: 12.5, fontWeight: 700, border: `1px solid ${redSel === k ? n.bd : "rgba(255,255,255,0.12)"}`, borderRadius: 10, cursor: "pointer", background: redSel === k ? n.bg : "rgba(255,255,255,0.025)", color: redSel === k ? (n.color === "#fff" ? "#fff" : n.color) : "rgba(255,255,255,0.65)", display: "flex", alignItems: "center", gap: 8 }}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>· {pub}/{pp.length}</span>
            </button>
          );
        })}
      </div>

      {/* Header de la red elegida */}
      <div style={{ padding: "14px 18px", background: net.bg, border: `1px solid ${net.bd}`, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{net.icon} {net.label} · <span style={{ color: net.color === "#fff" ? "rgba(255,255,255,0.7)" : net.color }}>{net.account}</span></span>
          <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(0,0,0,0.3)", borderRadius: 4, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{net.brand}</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.65)", fontStyle: "italic" }}>{net.line}</p>
      </div>

      {/* Lista de 10 piezas */}
      <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
        {piezasRed.map((p, i) => {
          const st = STATUS[p.status];
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "40px 90px 1fr 110px 110px", gap: 12, alignItems: "center", padding: "11px 16px", borderBottom: i < piezasRed.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: "pointer", transition: "background 120ms" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.4)" }}>#{i + 1}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "ui-monospace, monospace" }}>{p.scheduledDate.slice(5)}</span>
              <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{p.copy}</span>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: st.bg, color: st.c, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center" }}>{st.l}</span>
              <button style={btnSecMini}>Abrir →</button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          El 1ro de cada mes el panel te crea automáticamente los 10 slots de cada red.
        </p>
        <button style={btnPrimary}>+ Pieza extra</button>
      </div>
    </div>
  );
}

// ─────── RADAR ADUANERO ───────
function Radar({ items }) {
  const [filt, setFilt] = useState("all");
  const filtered = items.filter(i => filt === "all" || i.source === filt);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Radar aduanero</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          Headlines de portales relevantes · scrappeo diario automático <span style={{ color: GOLD_LIGHT, fontWeight: 600 }}>(0 costo de API)</span>
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[{ k: "all", l: "Todos" }, { k: "CDA", l: "CDA" }, { k: "AFIP", l: "AFIP" }, { k: "Boletín Oficial", l: "Boletín Oficial" }].map(o => (
          <button key={o.k} onClick={() => setFilt(o.k)} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, border: `1px solid ${filt === o.k ? GOLD_DEEP : "rgba(255,255,255,0.12)"}`, borderRadius: 8, cursor: "pointer", background: filt === o.k ? "rgba(184,149,106,0.12)" : "rgba(255,255,255,0.025)", color: filt === o.k ? GOLD_LIGHT : "rgba(255,255,255,0.65)" }}>{o.l}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(item => (
          <div key={item.id} style={{ padding: "14px 18px", background: item.isHot ? "rgba(251,146,60,0.06)" : "rgba(255,255,255,0.025)", border: `1px solid ${item.isHot ? "rgba(251,146,60,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "rgba(96,165,250,0.15)", color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.source}</span>
                {item.isHot && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "rgba(251,146,60,0.18)", color: "#fb923c" }}>🔥 IMPORTANTE</span>}
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.date}</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "#fff", fontWeight: 500 }}>{item.title}</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={btnSecMini}>🔗 Abrir</button>
              <button style={{ ...btnSecMini, color: GOLD_LIGHT, borderColor: "rgba(184,149,106,0.4)" }}>→ Convertir en post</button>
              <button style={btnSecMini}>✓ Leído</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, padding: "12px 16px", background: "rgba(255,255,255,0.025)", borderRadius: 10, fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
        <b style={{ color: GOLD_LIGHT }}>💡 ¿Cómo funciona?</b> Un cron diario a las 8am scrapea los headlines de los portales registrados (sin IA, solo HTML parsing). Cada novedad se muestra acá para que la revises y decidas si se convierte en post reactivo, o solo "leída".<br/>
        <b style={{ color: GOLD_LIGHT }}>📝 Portales registrados:</b> CDA, AFIP, Boletín Oficial. Editable desde Configuración (más adelante).
      </div>
    </div>
  );
}

// ─────── REACTIVOS ───────
function Reactivos({ items }) {
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Bandeja de reactivos</h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Ideas que surgieron del radar y se convierten en publicación</p>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 12 }}>
          Sin reactivos pendientes. Cuando convertís una novedad del Radar, aparece acá.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(it => {
            const st = STATUS[it.status];
            return (
              <div key={it.id} style={{ padding: "14px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{it.title}</span>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.c, fontWeight: 700, textTransform: "uppercase" }}>{st.l}</span>
                </div>
                <p style={{ margin: "0 0 6px", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Origen: <b>{it.source}</b> · creado {it.createdAt}</p>
                <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.75)", fontStyle: "italic" }}>"{it.note}"</p>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button style={btnSecMini}>Editar</button>
                  <button style={btnSecMini}>→ Mandar a plan del mes</button>
                  <button style={btnSecMini}>Descartar</button>
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
      <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Brief copy</h2>
      <p style={{ margin: "4px 0 18px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Completá → copiá → pegámelo en el chat y te tiro 3 variantes. <b style={{ color: GOLD_LIGHT }}>0 costo API.</b></p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <Sel label="Red" value={data.red} onChange={v => setData(p => ({ ...p, red: v }))} options={Object.entries(NETWORKS).map(([k, n]) => ({ v: k, l: `${n.icon} ${n.label}` }))} />
          <Fld label="Objetivo del post" value={data.objetivo} onChange={v => setData(p => ({ ...p, objetivo: v }))} placeholder="Ej: anunciar la nueva ruta USA" />
          <Fld label="Público objetivo" value={data.publico} onChange={v => setData(p => ({ ...p, publico: v }))} placeholder="Ej: emprendedores que importan, 25-40 años" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Sel label="Tono" value={data.tono} onChange={v => setData(p => ({ ...p, tono: v }))} options={[{ v: "casual", l: "Casual" }, { v: "formal", l: "Formal" }, { v: "tecnico", l: "Técnico" }, { v: "divertido", l: "Divertido" }]} />
            <Sel label="Formato" value={data.formato} onChange={v => setData(p => ({ ...p, formato: v }))} options={["feed", "reel", "carrusel", "story", "hilo", "post-text"].map(f => ({ v: f, l: f }))} />
          </div>
          <Fld label="Call to action" value={data.cta} onChange={v => setData(p => ({ ...p, cta: v }))} placeholder="Ej: escribinos para cotizar" />
          <Fld label="Datos clave" value={data.datos} onChange={v => setData(p => ({ ...p, datos: v }))} placeholder="Ej: USD 4500/CBM, 30-40 días, salidas semanales" multi />
        </div>

        <div>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Brief armado</p>
          <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 16px", fontSize: 12, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", lineHeight: 1.6, maxHeight: 420, overflow: "auto" }}>{prompt}</pre>
          <button style={{ ...btnPrimary, marginTop: 10, width: "100%" }} onClick={() => { navigator.clipboard?.writeText(prompt); }}>📋 Copiar brief al portapapeles</button>
        </div>
      </div>
    </div>
  );
}

// ─────── Helpers UI ───────
function Stat({ label, value, color }) {
  return (
    <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      <p style={{ margin: "5px 0 0", fontSize: 24, fontWeight: 800, color, fontFeatureSettings: '"tnum"' }}>{value}</p>
    </div>
  );
}
function Fld({ label, value, onChange, placeholder, multi }) {
  const Comp = multi ? "textarea" : "input";
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      <Comp value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={multi ? 3 : undefined}
        style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "#fff", outline: "none", fontFamily: "inherit", resize: multi ? "vertical" : "none" }} />
    </div>
  );
}
function Sel({ label, value, onChange, options }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "#fff", outline: "none" }}>
        {options.map(o => <option key={o.v} value={o.v} style={{ background: "#0F1F3A" }}>{o.l}</option>)}
      </select>
    </div>
  );
}
const btnPrimary = { padding: "8px 16px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: `1px solid ${GOLD_DEEP}`, background: GOLD_GRADIENT, color: "#0A1628", cursor: "pointer", letterSpacing: "0.02em" };
const btnSec = { padding: "6px 12px", fontSize: 11.5, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.8)", cursor: "pointer", whiteSpace: "nowrap" };
const btnSecMini = { padding: "5px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.75)", cursor: "pointer", whiteSpace: "nowrap" };
