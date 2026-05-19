"use client";
import { useState } from "react";

// ──────────────────────────────────────────────────────────────────────
// CINABRIO · muestra del palette
// Sin funcionalidad real — solo para validar la estética.
// ──────────────────────────────────────────────────────────────────────

const TOKENS = {
  bgBase: "#0A0606",
  bgSurface: "#1A0E0E",
  bgSurfaceHi: "#241313",
  border: "#2A1818",
  borderHi: "#3D2424",
  red: "#C8102E",
  redDeep: "#8E0820",
  redSoft: "rgba(200,16,46,0.12)",
  gold: "#D4AF37",
  goldSoft: "#8A6B2D",
  goldGlow: "0 0 16px rgba(212,175,55,0.35)",
  textPrimary: "#F4E8D3",
  textSecondary: "rgba(244,232,211,0.62)",
  textMuted: "rgba(244,232,211,0.35)",
  success: "#7FB069",
  danger: "#E8514B",
};

export default function CinabrioPalette() {
  const [done, setDone] = useState({ h1: true, h2: false, h3: true, h4: false, h5: false });
  const pct = (Object.values(done).filter(Boolean).length / Object.keys(done).length) * 100;

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(ellipse at top, ${TOKENS.bgSurface} 0%, ${TOKENS.bgBase} 60%)`, color: TOKENS.textPrimary, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Inter:wght@300;400;500;600;700&display=swap');
        .serif{font-family:'Cormorant Garamond',serif;font-feature-settings:'liga','dlig'}
        .sans{font-family:'Inter',-apple-system,sans-serif}
        body{font-family:'Inter',sans-serif}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .seal-rotate{transition:transform 600ms cubic-bezier(0.4,0,0.2,1)}
        .seal-rotate:hover{transform:rotate(5deg) scale(1.04)}
      ` }} />

      {/* Header con logo placeholder */}
      <header style={{ padding: "32px 36px 0", maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 18 }}>
        <div className="seal-rotate" style={{ width: 64, height: 64, borderRadius: 14, background: `linear-gradient(135deg, ${TOKENS.red}, ${TOKENS.redDeep})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 24px ${TOKENS.red}40, inset 0 1px 0 rgba(255,255,255,0.08)` }}>
          <span style={{ fontSize: 38, fontWeight: 700, color: TOKENS.gold, fontFamily: "serif", lineHeight: 1 }}>馬</span>
        </div>
        <div>
          <p className="serif" style={{ margin: 0, fontSize: 38, fontWeight: 500, color: TOKENS.textPrimary, letterSpacing: "-0.01em", lineHeight: 1 }}>Cinabrio</p>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: TOKENS.textMuted, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 500 }}>Muestra del palette</p>
        </div>
      </header>

      <main style={{ padding: "40px 36px 60px", maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 36 }}>

        {/* Swatches */}
        <section>
          <SectionTitle kicker="01" title="Paleta" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            <Swatch color={TOKENS.bgBase} name="Base" hex="#0A0606" textColor={TOKENS.textPrimary} />
            <Swatch color={TOKENS.bgSurface} name="Surface" hex="#1A0E0E" textColor={TOKENS.textPrimary} />
            <Swatch color={TOKENS.bgSurfaceHi} name="Surface hi" hex="#241313" textColor={TOKENS.textPrimary} />
            <Swatch color={TOKENS.red} name="Rojo" hex="#C8102E" textColor="#fff" />
            <Swatch color={TOKENS.redDeep} name="Rojo profundo" hex="#8E0820" textColor="#fff" />
            <Swatch color={TOKENS.gold} name="Dorado" hex="#D4AF37" textColor="#0A0606" />
            <Swatch color={TOKENS.goldSoft} name="Dorado opaco" hex="#8A6B2D" textColor={TOKENS.textPrimary} />
            <Swatch color={TOKENS.textPrimary} name="Texto" hex="#F4E8D3" textColor="#0A0606" />
          </div>
        </section>

        {/* Tipografía */}
        <section>
          <SectionTitle kicker="02" title="Tipografía" />
          <Card>
            <p className="serif" style={{ margin: 0, fontSize: 48, fontWeight: 500, color: TOKENS.textPrimary, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Disciplina diaria</p>
            <p className="serif" style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 400, fontStyle: "italic", color: TOKENS.gold, letterSpacing: "0.01em" }}>「 trazos del día 」</p>
            <p style={{ margin: "18px 0 0", fontSize: 14, color: TOKENS.textSecondary, lineHeight: 1.65, maxWidth: 620 }}>
              Las cosas más importantes nunca tienen que estar a merced de las menos importantes. Cada mañana se renueva el día — completar un hábito es una victoria pequeña que se acumula.
            </p>
            <p style={{ margin: "16px 0 0", fontSize: 11, color: TOKENS.textMuted, textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>Subtítulo · Inter · 600</p>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
            <Card padded>
              <p style={{ margin: 0, fontSize: 9.5, color: TOKENS.textMuted, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>Heading</p>
              <p className="serif" style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 500, color: TOKENS.textPrimary }}>Cormorant Garamond</p>
            </Card>
            <Card padded>
              <p style={{ margin: 0, fontSize: 9.5, color: TOKENS.textMuted, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>Body</p>
              <p className="sans" style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 500, color: TOKENS.textPrimary }}>Inter / SF Pro · cuerpo del texto</p>
            </Card>
          </div>
        </section>

        {/* Hábitos del día (preview) */}
        <section>
          <SectionTitle kicker="03" title="Hábitos · checklist diaria" />
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 22 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: TOKENS.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>Hoy · Lunes</p>
                <p className="serif" style={{ margin: "6px 0 0", fontSize: 34, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1 }}>{Math.round(pct)}% del día</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: TOKENS.textSecondary }}>{Object.values(done).filter(Boolean).length} de {Object.keys(done).length} completados</p>
              </div>
              <div style={{ width: 260 }}>
                <div style={{ height: 6, background: TOKENS.bgSurfaceHi, borderRadius: 3, overflow: "hidden", border: `1px solid ${TOKENS.border}` }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${TOKENS.redDeep}, ${TOKENS.red}, ${TOKENS.gold})`, transition: "width 600ms ease", boxShadow: `0 0 10px ${TOKENS.gold}55` }} />
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 10, color: TOKENS.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Progreso</p>
              </div>
            </div>

            {/* Lista de hábitos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: TOKENS.border, borderRadius: 10, overflow: "hidden", border: `1px solid ${TOKENS.border}` }}>
              {[
                { id: "h1", time: "06:30", title: "Despertar + agua", cat: "Cuerpo", catColor: "#7FB069" },
                { id: "h2", time: "07:00", title: "Gym · empuje", cat: "Cuerpo", catColor: "#7FB069" },
                { id: "h3", time: "09:00", title: "Email crítico < 20 min", cat: "Trabajo", catColor: TOKENS.gold },
                { id: "h4", time: "12:30", title: "Argencargo · cerrar Op del día", cat: "Trabajo", catColor: TOKENS.gold },
                { id: "h5", time: "21:00", title: "Lectura · 30 min", cat: "Mente", catColor: "#C9A4FF" },
              ].map((h) => {
                const checked = !!done[h.id];
                return (
                  <label key={h.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", background: TOKENS.bgSurface, cursor: "pointer", transition: "background 160ms", opacity: checked ? 0.55 : 1 }}
                    onMouseEnter={(e) => e.currentTarget.style.background = TOKENS.bgSurfaceHi}
                    onMouseLeave={(e) => e.currentTarget.style.background = TOKENS.bgSurface}>
                    <button onClick={() => setDone(p => ({ ...p, [h.id]: !p[h.id] }))} style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: checked ? `1.5px solid ${TOKENS.gold}` : `1.5px solid ${TOKENS.borderHi}`,
                      background: checked ? `linear-gradient(135deg, ${TOKENS.gold}, ${TOKENS.goldSoft})` : "transparent",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                      boxShadow: checked ? TOKENS.goldGlow : "none", transition: "all 200ms",
                    }}>
                      {checked && <svg width="13" height="13" viewBox="0 0 16 16"><path d="M3 8l3.5 3.5L13 5" stroke={TOKENS.bgBase} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                    <span style={{ fontFamily: "ui-monospace, 'SF Mono', monospace", fontSize: 12.5, color: TOKENS.textMuted, minWidth: 48, fontFeatureSettings: '"tnum"', fontWeight: 500 }}>{h.time}</span>
                    <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: TOKENS.textPrimary, textDecoration: checked ? "line-through" : "none", textDecorationColor: TOKENS.gold }}>{h.title}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: `${h.catColor}1A`, color: h.catColor, border: `1px solid ${h.catColor}40`, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h.cat}</span>
                  </label>
                );
              })}
            </div>
          </Card>
        </section>

        {/* Finanzas preview */}
        <section>
          <SectionTitle kicker="04" title="Finanzas · presupuesto mensual" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <StatCard label="Sueldo este mes" value="USD 1.500" sub="≈ ARS 1.875.000 @ 1.250" accent={TOKENS.gold} />
            <StatCard label="Gastado" value="ARS 842.300" sub="44.9% del mes consumido" accent={TOKENS.red} />
            <StatCard label="Disponible" value="ARS 1.032.700" sub="55.1% restante" accent="#7FB069" />
          </div>
          <Card>
            <p style={{ margin: "0 0 14px", fontSize: 11, color: TOKENS.gold, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>Categorías</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { name: "Comida", spent: 280000, budget: 400000, color: "#E8514B" },
                { name: "Transporte", spent: 95000, budget: 150000, color: TOKENS.gold },
                { name: "Suscripciones", spent: 87000, budget: 90000, color: "#C9A4FF" },
                { name: "Salidas", spent: 240000, budget: 300000, color: "#FF9F66" },
                { name: "Imprevistos", spent: 140300, budget: 200000, color: TOKENS.textSecondary },
              ].map((c) => {
                const pctUsed = Math.min(100, (c.spent / c.budget) * 100);
                const overBudget = c.spent > c.budget;
                return (
                  <div key={c.name} style={{ padding: "10px 14px", background: TOKENS.bgSurfaceHi, borderRadius: 8, border: `1px solid ${TOKENS.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: TOKENS.textPrimary, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} /> {c.name}
                      </span>
                      <span style={{ fontSize: 12.5, color: overBudget ? TOKENS.danger : TOKENS.textSecondary, fontVariantNumeric: "tabular-nums" }}>
                        ARS {c.spent.toLocaleString("es-AR")} / {c.budget.toLocaleString("es-AR")}
                      </span>
                    </div>
                    <div style={{ height: 5, background: TOKENS.bgSurface, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pctUsed}%`, height: "100%", background: overBudget ? TOKENS.danger : c.color, transition: "width 300ms" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        {/* Botones */}
        <section>
          <SectionTitle kicker="05" title="Componentes" />
          <Card>
            <p style={{ margin: "0 0 12px", fontSize: 10, color: TOKENS.textMuted, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>Botones</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
              <button style={{ padding: "11px 22px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: `1px solid ${TOKENS.gold}`, background: `linear-gradient(135deg, ${TOKENS.gold}, ${TOKENS.goldSoft})`, color: TOKENS.bgBase, cursor: "pointer", letterSpacing: "0.04em", boxShadow: TOKENS.goldGlow }}>Primario · Dorado</button>
              <button style={{ padding: "11px 22px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: `1px solid ${TOKENS.red}`, background: `linear-gradient(135deg, ${TOKENS.red}, ${TOKENS.redDeep})`, color: "#fff", cursor: "pointer", letterSpacing: "0.04em" }}>Acción · Rojo</button>
              <button style={{ padding: "11px 22px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${TOKENS.borderHi}`, background: "transparent", color: TOKENS.textPrimary, cursor: "pointer", letterSpacing: "0.04em" }}>Secundario</button>
              <button style={{ padding: "11px 22px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", background: "transparent", color: TOKENS.textSecondary, cursor: "pointer", letterSpacing: "0.04em" }}>Ghost</button>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 10, color: TOKENS.textMuted, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>Input</p>
            <input placeholder="ARS 0" style={{ width: 240, padding: "11px 14px", fontSize: 14, fontWeight: 500, border: `1px solid ${TOKENS.border}`, borderRadius: 8, background: TOKENS.bgSurfaceHi, color: TOKENS.textPrimary, outline: "none", fontFamily: "inherit" }} />
            <p style={{ margin: "22px 0 12px", fontSize: 10, color: TOKENS.textMuted, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>Badges</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge color={TOKENS.gold} bg={`${TOKENS.gold}1A`} label="Cuerpo" />
              <Badge color={TOKENS.red} bg={`${TOKENS.red}1A`} label="Importante" />
              <Badge color="#7FB069" bg="rgba(127,176,105,0.15)" label="Completado" />
              <Badge color="#C9A4FF" bg="rgba(201,164,255,0.14)" label="Mente" />
              <Badge color={TOKENS.textSecondary} bg="rgba(244,232,211,0.06)" label="Pendiente" />
            </div>
          </Card>
        </section>

      </main>

      <footer style={{ borderTop: `1px solid ${TOKENS.border}`, padding: "22px 36px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 10, color: TOKENS.textMuted, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600 }}>Cinabrio · solo muestra de palette</p>
      </footer>
    </div>
  );
}

function SectionTitle({ kicker, title }) {
  return (
    <div style={{ marginBottom: 14, display: "flex", alignItems: "baseline", gap: 14 }}>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: TOKENS.gold, letterSpacing: "0.16em", fontWeight: 600 }}>{kicker}</span>
      <span className="serif" style={{ fontSize: 26, fontWeight: 500, color: TOKENS.textPrimary, letterSpacing: "-0.01em" }}>{title}</span>
      <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${TOKENS.gold}66, transparent)`, marginLeft: 8 }} />
    </div>
  );
}

function Card({ children, padded }) {
  return (
    <div style={{ background: TOKENS.bgSurface, border: `1px solid ${TOKENS.border}`, borderRadius: 14, padding: padded ? "16px 18px" : "22px 24px", boxShadow: "0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.02)" }}>
      {children}
    </div>
  );
}

function Swatch({ color, name, hex, textColor }) {
  return (
    <div style={{ background: color, height: 80, padding: "10px 12px", borderRadius: 10, display: "flex", flexDirection: "column", justifyContent: "space-between", border: `1px solid ${TOKENS.border}` }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{name}</span>
      <span style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: textColor, opacity: 0.7 }}>{hex}</span>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ padding: "18px 20px", background: TOKENS.bgSurface, border: `1px solid ${TOKENS.border}`, borderRadius: 12, borderTop: `2px solid ${accent}` }}>
      <p style={{ margin: 0, fontSize: 10, color: TOKENS.textMuted, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600 }}>{label}</p>
      <p className="serif" style={{ margin: "6px 0 4px", fontSize: 26, fontWeight: 500, color: TOKENS.textPrimary, letterSpacing: "-0.01em", lineHeight: 1.1 }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11.5, color: TOKENS.textSecondary }}>{sub}</p>
    </div>
  );
}

function Badge({ color, bg, label }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 11px", borderRadius: 4, background: bg, color, border: `1px solid ${color}40`, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>;
}
