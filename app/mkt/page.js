"use client";
import { useState, useMemo } from "react";

// ──────────────────────────────────────────────────────────────────────
// PREVIEW estático del panel Marketing — sin DB, sin auth. Solo UI.
// Para validar layout/flujo antes de meterle backend.
// ──────────────────────────────────────────────────────────────────────

const GOLD = "#B8956A", GOLD_LIGHT = "#E8D098", GOLD_DEEP = "#A68456";
const GOLD_GRADIENT = "linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)";
const DARK_BG = "linear-gradient(135deg,#070C1A 0%,#0A1628 50%,#0F1F3A 100%)";

const NETWORKS = {
  instagram: { label: "Instagram", icon: "📷", color: "#E1306C", bg: "rgba(225,48,108,0.12)", bd: "rgba(225,48,108,0.4)" },
  linkedin: { label: "LinkedIn", icon: "💼", color: "#0A66C2", bg: "rgba(10,102,194,0.12)", bd: "rgba(10,102,194,0.4)" },
  tiktok: { label: "TikTok", icon: "🎵", color: "#fff", bg: "rgba(255,255,255,0.08)", bd: "rgba(255,255,255,0.3)" },
  x: { label: "X / Twitter", icon: "𝕏", color: "#fff", bg: "rgba(255,255,255,0.08)", bd: "rgba(255,255,255,0.3)" },
};
const STATUS = {
  idea: { l: "Idea", c: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  guion: { l: "Guión", c: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  diseno: { l: "Diseño", c: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  revision: { l: "Revisión", c: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  programado: { l: "Programado", c: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  publicado: { l: "Publicado", c: "#22c55e", bg: "rgba(34,197,94,0.12)" },
};
const FORMATS = ["reel", "carrusel", "story", "feed", "short", "post-text"];

// Mock data
const MOCK_CAMPAIGNS = [
  { id: "c1", name: "Lanzamiento Marítimo USA", objective: "Difundir nueva ruta USA→AR", start: "2026-05-10", end: "2026-05-31", color: "#60a5fa" },
  { id: "c2", name: "Tier rewards Q2", objective: "Promocionar descuentos por volumen", start: "2026-05-01", end: "2026-06-30", color: "#E8D098" },
  { id: "c3", name: "Casos de éxito Mayo", objective: "Testimonios reales de clientes", start: "2026-05-15", end: "2026-05-30", color: "#22c55e" },
];

const today = new Date(2026, 4, 14); // 14 mayo 2026
const d = (off) => { const x = new Date(today); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10); };

const MOCK_POSTS = [
  { id: "p1", network: "instagram", format: "reel", scheduledAt: d(-2) + "T18:00", status: "publicado", copy: "🚢 Así llega tu mercadería desde China hasta tu casa. Marítimo Integral AC paso a paso 👇", hashtags: "#importarchina #argencargo #logistica", campaign: "c3", asset: "🎬" },
  { id: "p2", network: "linkedin", format: "post-text", scheduledAt: d(-1) + "T10:00", status: "publicado", copy: "Nueva ruta directa USA → Argentina. Tiempos de tránsito reducidos en 12 días. ¿Qué necesitás importar?", hashtags: "#comercioexterior #importaciones", campaign: "c1", asset: "📊" },
  { id: "p3", network: "instagram", format: "carrusel", scheduledAt: d(0) + "T19:30", status: "programado", copy: "5 errores que cometen los importadores nuevos (y cómo evitarlos)", hashtags: "#importarchina #emprendedores", campaign: null, asset: "🎯" },
  { id: "p4", network: "tiktok", format: "short", scheduledAt: d(0) + "T20:00", status: "revision", copy: "POV: te llega el contenedor y todo entra perfecto 📦✨", hashtags: "#fyp #importadores", campaign: "c1", asset: "🎬" },
  { id: "p5", network: "instagram", format: "story", scheduledAt: d(1) + "T09:00", status: "diseno", copy: "Encuesta: ¿De qué país importás más? 🌎", hashtags: "", campaign: null, asset: "📷" },
  { id: "p6", network: "x", format: "post-text", scheduledAt: d(1) + "T15:00", status: "guion", copy: "Hilo: cómo armamos el sistema de tracking en vivo de Argencargo 🧵", hashtags: "", campaign: null, asset: null },
  { id: "p7", network: "linkedin", format: "carrusel", scheduledAt: d(3) + "T11:00", status: "guion", copy: "Caso de éxito: importamos 8m³ de simuladores de videojuegos para Pedevilla SA", hashtags: "", campaign: "c3", asset: null },
  { id: "p8", network: "instagram", format: "reel", scheduledAt: d(5) + "T20:00", status: "idea", copy: "Reel detrás de escena: día en el depósito de Mr. Shi (China)", hashtags: "", campaign: "c1", asset: null },
  { id: "p9", network: "tiktok", format: "short", scheduledAt: d(6) + "T19:00", status: "idea", copy: "Mostrar el unboxing de un cliente al recibir su mercadería", hashtags: "", campaign: "c3", asset: null },
  { id: "p10", network: "instagram", format: "feed", scheduledAt: d(7) + "T18:00", status: "idea", copy: "Promo Tier Plata: 10% off sobre flete a clientes con +5 ops", hashtags: "", campaign: "c2", asset: null },
];

const MOCK_ASSETS = [
  { id: "a1", thumb: "🎬", name: "Reel-llegada-contenedor.mp4", tags: ["maritimo", "china", "proceso"], usedIn: 3 },
  { id: "a2", thumb: "📊", name: "Infografia-ruta-usa.png", tags: ["usa", "infografia"], usedIn: 1 },
  { id: "a3", thumb: "🎯", name: "Carrusel-5-errores.psd", tags: ["consejos", "carrusel"], usedIn: 1 },
  { id: "a4", thumb: "📷", name: "Foto-deposito-china.jpg", tags: ["china", "deposito"], usedIn: 5 },
  { id: "a5", thumb: "📹", name: "Testimonio-pedevilla.mp4", tags: ["testimonio", "cliente"], usedIn: 2 },
  { id: "a6", thumb: "🎨", name: "Logo-argencargo-claro.png", tags: ["branding", "logo"], usedIn: 18 },
  { id: "a7", thumb: "📸", name: "Foto-equipo-2026.jpg", tags: ["equipo", "branding"], usedIn: 4 },
  { id: "a8", thumb: "🎞️", name: "B-roll-puerto-buenos-aires.mp4", tags: ["broll", "argentina"], usedIn: 2 },
];

export default function MktPreview() {
  const [tab, setTab] = useState("calendario");
  const [briefData, setBriefData] = useState({ objetivo: "", publico: "", tono: "casual", red: "instagram", formato: "reel", cta: "", datos: "" });

  return (
    <div style={{ minHeight: "100vh", background: DARK_BG, color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "0.04em" }}>ARGENCARGO · <span style={{ color: GOLD_LIGHT }}>Marketing</span></h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Preview · sin datos reales · sin auth</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD_GRADIENT, color: "#0A1628", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>BA</div>
            <span style={{ color: "rgba(255,255,255,0.75)" }}>Bauti</span>
          </div>
        </div>
      </header>

      {/* Sub-tabs */}
      <nav style={{ display: "flex", gap: 4, padding: "12px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
        {[
          { k: "calendario", l: "📅 Calendario" },
          { k: "kanban", l: "📋 Kanban" },
          { k: "campanas", l: "🚀 Campañas" },
          { k: "biblioteca", l: "🖼️ Biblioteca" },
          { k: "brief", l: "✍️ Brief copy" },
          { k: "recordatorios", l: "🔔 Recordatorios" },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{ padding: "9px 16px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 8, cursor: "pointer", background: tab === t.k ? GOLD_GRADIENT : "transparent", color: tab === t.k ? "#0A1628" : "rgba(255,255,255,0.6)", whiteSpace: "nowrap", transition: "all 150ms" }}>
            {t.l}
          </button>
        ))}
      </nav>

      <main style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>
        {/* Banner recordatorio sticky */}
        {tab !== "recordatorios" && (
          <div style={{ marginBottom: 18, padding: "10px 16px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ fontSize: 16 }}>🔔</span>
            <span style={{ color: "#60a5fa", fontWeight: 600 }}>2 posts</span>
            <span style={{ color: "rgba(255,255,255,0.7)" }}>se publican hoy · Carrusel IG a las 19:30 y short TikTok a las 20:00</span>
          </div>
        )}

        {tab === "calendario" && <Calendario posts={MOCK_POSTS} />}
        {tab === "kanban" && <Kanban posts={MOCK_POSTS} />}
        {tab === "campanas" && <Campanas campaigns={MOCK_CAMPAIGNS} posts={MOCK_POSTS} />}
        {tab === "biblioteca" && <Biblioteca assets={MOCK_ASSETS} />}
        {tab === "brief" && <BriefCopy data={briefData} setData={setBriefData} />}
        {tab === "recordatorios" && <Recordatorios posts={MOCK_POSTS} />}
      </main>

      <footer style={{ padding: "20px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
        Preview · click en cualquier sub-tab para recorrer la UI propuesta
      </footer>
    </div>
  );
}

// ─────── Calendario ───────
function Calendario({ posts }) {
  const month = today.getMonth(), year = today.getFullYear();
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // lunes=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  const postsByDate = useMemo(() => {
    const m = {};
    posts.forEach(p => { const d = p.scheduledAt.slice(0, 10); m[d] = m[d] || []; m[d].push(p); });
    return m;
  }, [posts]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {today.toLocaleDateString("es-AR", { month: "long", year: "numeric" }).replace(/^./, c => c.toUpperCase())}
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{posts.length} posts en el mes · click un día para agregar</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={btnSec}>‹ Mes anterior</button>
          <button style={btnSec}>Hoy</button>
          <button style={btnSec}>Mes siguiente ›</button>
          <button style={btnPrimary}>+ Nuevo post</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, background: "rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
          <div key={d} style={{ padding: "9px 10px", background: "rgba(0,0,0,0.35)", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{d}</div>
        ))}
        {cells.map((c, i) => {
          const ds = c ? `${year}-${String(month + 1).padStart(2, "0")}-${String(c).padStart(2, "0")}` : null;
          const dayPosts = ds ? postsByDate[ds] || [] : [];
          const isToday = c === today.getDate();
          return (
            <div key={i} style={{ minHeight: 110, background: c ? (isToday ? "rgba(184,149,106,0.06)" : "rgba(255,255,255,0.015)") : "rgba(0,0,0,0.2)", padding: 6, cursor: c ? "pointer" : "default", borderTop: isToday ? `2px solid ${GOLD}` : "none" }}>
              {c && <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? GOLD_LIGHT : "rgba(255,255,255,0.55)", marginBottom: 4 }}>{c}</div>}
              {dayPosts.slice(0, 3).map(p => {
                const net = NETWORKS[p.network], st = STATUS[p.status];
                return (
                  <div key={p.id} title={p.copy} style={{ fontSize: 10, padding: "3px 6px", marginBottom: 3, borderRadius: 4, background: net.bg, border: `1px solid ${net.bd}`, color: "#fff", fontWeight: 500, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {net.icon} <span style={{ color: st.c, fontSize: 8, fontWeight: 800 }}>●</span> {p.copy.slice(0, 22)}…
                  </div>
                );
              })}
              {dayPosts.length > 3 && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>+{dayPosts.length - 3} más</div>}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(255,255,255,0.025)", borderRadius: 10, fontSize: 11, color: "rgba(255,255,255,0.5)", display: "flex", gap: 18, flexWrap: "wrap" }}>
        <span><b style={{ color: "#fff" }}>Leyenda:</b></span>
        {Object.entries(NETWORKS).map(([k, n]) => <span key={k}>{n.icon} {n.label}</span>)}
        <span style={{ marginLeft: "auto" }}>● Estado del post</span>
      </div>
    </div>
  );
}

// ─────── Kanban ───────
function Kanban({ posts }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Producción</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Arrastrá entre columnas para cambiar el estado</p>
        </div>
        <button style={btnPrimary}>+ Nuevo post</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10 }}>
        {Object.entries(STATUS).map(([sk, sv]) => {
          const colPosts = posts.filter(p => p.status === sk);
          return (
            <div key={sk} style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${sv.bg}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 12px", background: sv.bg, borderBottom: `1px solid ${sv.bg}` }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: sv.c, textTransform: "uppercase", letterSpacing: "0.06em" }}>{sv.l} · {colPosts.length}</p>
              </div>
              <div style={{ padding: 8, minHeight: 400, display: "flex", flexDirection: "column", gap: 6 }}>
                {colPosts.map(p => {
                  const net = NETWORKS[p.network];
                  return (
                    <div key={p.id} style={{ padding: "8px 10px", background: "rgba(0,0,0,0.25)", border: `1px solid ${net.bd}`, borderRadius: 6, cursor: "grab" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: net.color === "#fff" ? "#fff" : net.color }}>{net.icon} {net.label}</span>
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>{p.format}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>{p.copy.slice(0, 70)}{p.copy.length > 70 ? "…" : ""}</p>
                      <p style={{ margin: "5px 0 0", fontSize: 9.5, color: "rgba(255,255,255,0.4)" }}>📅 {p.scheduledAt.slice(0, 10)} · {p.scheduledAt.slice(11, 16)}</p>
                    </div>
                  );
                })}
                {colPosts.length === 0 && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontStyle: "italic", textAlign: "center", marginTop: 14 }}>Vacío</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────── Campañas ───────
function Campanas({ campaigns, posts }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Campañas</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{campaigns.length} campañas activas</p>
        </div>
        <button style={btnPrimary}>+ Nueva campaña</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 14 }}>
        {campaigns.map(c => {
          const cp = posts.filter(p => p.campaign === c.id);
          const pub = cp.filter(p => p.status === "publicado").length;
          return (
            <div key={c.id} style={{ padding: "16px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, borderLeft: `3px solid ${c.color}` }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>{c.name}</h3>
              <p style={{ margin: "4px 0 10px", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{c.objective}</p>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>
                <span>📅 {c.start} → {c.end}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{pub}/{cp.length} publicados</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: c.color }}>{cp.length > 0 ? Math.round(pub / cp.length * 100) : 0}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${cp.length > 0 ? pub / cp.length * 100 : 0}%`, height: "100%", background: c.color }} />
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {cp.slice(0, 5).map(p => <span key={p.id} title={p.copy} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: NETWORKS[p.network].bg, border: `1px solid ${NETWORKS[p.network].bd}` }}>{NETWORKS[p.network].icon}</span>)}
                {cp.length > 5 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", padding: "2px 4px" }}>+{cp.length - 5}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────── Biblioteca ───────
function Biblioteca({ assets }) {
  const [q, setQ] = useState("");
  const filtered = assets.filter(a => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.tags.some(t => t.includes(q.toLowerCase())));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Biblioteca de assets</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{assets.length} archivos · fotos, videos, GIFs, plantillas</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o tag..." style={{ padding: "8px 12px", fontSize: 13, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "#fff", outline: "none", minWidth: 240 }} />
          <button style={btnPrimary}>⬆ Subir asset</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
        {filtered.map(a => (
          <div key={a.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "border-color 150ms" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(184,149,106,0.4)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}>
            <div style={{ height: 130, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56 }}>{a.thumb}</div>
            <div style={{ padding: "8px 10px" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</p>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 5 }}>
                {a.tags.map(t => <span key={t} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "rgba(184,149,106,0.12)", color: GOLD_LIGHT }}>{t}</span>)}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Usado en {a.usedIn} post{a.usedIn !== 1 ? "s" : ""}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────── Brief copy ───────
function BriefCopy({ data, setData }) {
  const prompt = `Necesito 3 variantes de copy para una publicación en **${NETWORKS[data.red]?.label || "(red)"}**, formato **${data.formato}**.

**Objetivo:** ${data.objetivo || "(falta)"}
**Público objetivo:** ${data.publico || "(falta)"}
**Tono:** ${data.tono}
**CTA:** ${data.cta || "(falta)"}
**Datos clave:** ${data.datos || "(falta)"}

Dame 3 variantes claramente diferenciadas en estilo. Para cada una incluí:
- Copy principal (con saltos de línea bien marcados)
- Lista de 5-8 hashtags relevantes
- Sugerencia de visual/asset

Tono Argencargo: claro, directo, profesional pero cercano. Argencargo es una empresa argentina de importaciones desde China y USA.`;

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Brief para Claude (vía chat)</h2>
      <p style={{ margin: "2px 0 18px", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Completá los campos → copiá el brief → pegámelo en el chat y te devuelvo 3 variantes de copy. <b style={{ color: GOLD_LIGHT }}>Sin costo de API.</b></p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Objetivo del post" value={data.objetivo} onChange={v => setData(p => ({ ...p, objetivo: v }))} placeholder="Ej: dar a conocer la ruta marítima USA" />
          <Field label="Público objetivo" value={data.publico} onChange={v => setData(p => ({ ...p, publico: v }))} placeholder="Ej: emprendedores que importan de USA, 25-40 años" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Select label="Red" value={data.red} onChange={v => setData(p => ({ ...p, red: v }))} options={Object.entries(NETWORKS).map(([k, n]) => ({ v: k, l: `${n.icon} ${n.label}` }))} />
            <Select label="Formato" value={data.formato} onChange={v => setData(p => ({ ...p, formato: v }))} options={FORMATS.map(f => ({ v: f, l: f }))} />
          </div>
          <Select label="Tono" value={data.tono} onChange={v => setData(p => ({ ...p, tono: v }))} options={[{ v: "casual", l: "Casual" }, { v: "formal", l: "Formal" }, { v: "tecnico", l: "Técnico" }, { v: "divertido", l: "Divertido" }]} />
          <Field label="Call to action" value={data.cta} onChange={v => setData(p => ({ ...p, cta: v }))} placeholder="Ej: escribinos para cotizar tu importación" />
          <Field label="Datos clave" value={data.datos} onChange={v => setData(p => ({ ...p, datos: v }))} placeholder="Ej: USD 4500/CBM, 30-40 días, salidas semanales" multi />
        </div>

        <div>
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Brief generado</p>
          <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 16px", fontSize: 12, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap", fontFamily: "ui-monospace, 'SF Mono', monospace", lineHeight: 1.6, maxHeight: 420, overflow: "auto" }}>{prompt}</pre>
          <button style={{ ...btnPrimary, marginTop: 10, width: "100%" }} onClick={() => { navigator.clipboard?.writeText(prompt); }}>📋 Copiar brief al portapapeles</button>
        </div>
      </div>
    </div>
  );
}

// ─────── Recordatorios ───────
function Recordatorios({ posts }) {
  const upcoming = posts.filter(p => p.status !== "publicado").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const today_s = today.toISOString().slice(0, 10);
  const tomorrow_s = d(1);
  const groups = { hoy: [], manana: [], proximos: [] };
  upcoming.forEach(p => {
    const ds = p.scheduledAt.slice(0, 10);
    if (ds === today_s) groups.hoy.push(p);
    else if (ds === tomorrow_s) groups.manana.push(p);
    else if (ds > today_s) groups.proximos.push(p);
  });

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Recordatorios</h2>
      <p style={{ margin: "2px 0 18px", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Próximos posts a publicar / revisar</p>

      {[{ k: "hoy", l: "📌 Hoy", c: "#fbbf24" }, { k: "manana", l: "📅 Mañana", c: "#60a5fa" }, { k: "proximos", l: "🗓️ Próximos días", c: "rgba(255,255,255,0.6)" }].map(g => (
        <div key={g.k} style={{ marginBottom: 18 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: g.c, textTransform: "uppercase", letterSpacing: "0.08em" }}>{g.l} · {groups[g.k].length}</h3>
          {groups[g.k].length === 0 ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>Nada pendiente.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groups[g.k].map(p => {
                const net = NETWORKS[p.network], st = STATUS[p.status];
                return (
                  <div key={p.id} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14 }}>{net.icon}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.c, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{st.l}</span>
                    <span style={{ fontSize: 12, color: "#fff", fontWeight: 500, flex: 1, minWidth: 200 }}>{p.copy.slice(0, 80)}{p.copy.length > 80 ? "…" : ""}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>📅 {p.scheduledAt.slice(5, 10)} · {p.scheduledAt.slice(11, 16)}</span>
                    <button style={btnSec}>Abrir</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────── Helpers UI ───────
function Field({ label, value, onChange, placeholder, multi }) {
  const Comp = multi ? "textarea" : "input";
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      <Comp value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={multi ? 3 : undefined}
        style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "#fff", outline: "none", fontFamily: "inherit", resize: multi ? "vertical" : "none" }} />
    </div>
  );
}
function Select({ label, value, onChange, options }) {
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
const btnSec = { padding: "8px 14px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.8)", cursor: "pointer" };
