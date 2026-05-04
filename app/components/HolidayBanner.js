"use client";
// Banner preventivo que muestra feriados próximos del país de origen.
// Se carga desde holidays_calendar (acceso público, sin auth necesaria).
// El cliente puede dismissear por sesión.

import { useState, useEffect } from "react";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

const COUNTRY_FLAGS = { china: "🇨🇳", usa: "🇺🇸", spain: "🇪🇸" };

const formatDateRange = (start, end) => {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const monthFmt = (d) => d.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  if (s.getTime() === e.getTime()) return monthFmt(s);
  if (sameMonth) return `${s.getDate()} al ${monthFmt(e)}`;
  return `${monthFmt(s)} al ${monthFmt(e)}`;
};

const daysUntil = (date) => {
  const d = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export default function HolidayBanner() {
  const [holidays, setHolidays] = useState([]);
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    // Cargar dismissed del session storage
    try {
      const d = JSON.parse(sessionStorage.getItem("ac_dismissed_holidays") || "[]");
      setDismissed(Array.isArray(d) ? d : []);
    } catch { }

    // Fetch feriados
    (async () => {
      const todayISO = new Date().toISOString().slice(0, 10);
      try {
        const r = await fetch(`${SB_URL}/rest/v1/holidays_calendar?end_date=gte.${todayISO}&order=start_date.asc`, {
          headers: { apikey: SB_KEY },
        });
        if (!r.ok) return;
        const data = await r.json();
        if (!Array.isArray(data)) return;
        // Filtrar: solo mostrar si estamos dentro del rango de alerta
        const relevant = data.filter(h => {
          const dStart = daysUntil(h.start_date);
          const dEnd = daysUntil(h.end_date);
          // Mostrar si: faltan ≤ alert_days_before O estamos en medio del feriado
          return (dStart <= (h.alert_days_before || 14) && dStart >= 0) || (dStart < 0 && dEnd >= 0);
        });
        setHolidays(relevant);
      } catch { }
    })();
  }, []);

  const dismiss = (id) => {
    const newDismissed = [...dismissed, id];
    setDismissed(newDismissed);
    try { sessionStorage.setItem("ac_dismissed_holidays", JSON.stringify(newDismissed)); } catch { }
  };

  const visible = holidays.filter(h => !dismissed.includes(h.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
      {visible.map(h => {
        const dStart = daysUntil(h.start_date);
        const dEnd = daysUntil(h.end_date);
        const isActive = dStart <= 0 && dEnd >= 0;
        const flag = COUNTRY_FLAGS[h.country] || "🌍";
        const urgent = dStart >= 0 && dStart <= 7;
        const color = isActive ? "#ef4444" : urgent ? "#fb923c" : "#fbbf24";
        const bg = isActive ? "rgba(239,68,68,0.08)" : urgent ? "rgba(251,146,60,0.08)" : "rgba(251,191,36,0.06)";
        const border = isActive ? "rgba(239,68,68,0.4)" : urgent ? "rgba(251,146,60,0.4)" : "rgba(251,191,36,0.3)";
        const headline = isActive
          ? `Feriado en curso: ${h.name}`
          : urgent
            ? `Feriado en ${dStart === 0 ? "hoy" : `${dStart} día${dStart > 1 ? "s" : ""}`}: ${h.name}`
            : `Próximo feriado: ${h.name}`;
        return (
          <div key={h.id} style={{ padding: "12px 16px", background: bg, border: `1.5px solid ${border}`, borderRadius: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{flag}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color, margin: 0, letterSpacing: "-0.01em" }}>{headline}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0, whiteSpace: "nowrap" }}>{formatDateRange(h.start_date, h.end_date)}</p>
              </div>
              {h.description && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.5 }}>{h.description}</p>}
            </div>
            <button onClick={() => dismiss(h.id)} title="Ocultar este aviso" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18, padding: "0 4px", flexShrink: 0 }}>×</button>
          </div>
        );
      })}
    </div>
  );
}
