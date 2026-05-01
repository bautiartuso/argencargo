"use client";
// Wrapper de react-day-picker estilizado con la paleta navy/gold del sistema.
// Uso: <DatePicker value="2026-04-21" onChange={iso => ...} />
// El value es un string ISO YYYY-MM-DD (compatible con <input type="date">).
// Usa createPortal para escapar de overflow:hidden de cualquier parent (Cards, modals, etc).
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";
import "react-day-picker/dist/style.css";

const GOLD = "#B8956A";
const GOLD_LIGHT = "#D4B17A";
const NAVY = "#142038";

function formatDisplay(date) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date + "T12:00:00") : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toIso(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromIso(iso) {
  if (!iso) return undefined;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export default function DatePicker({ value, onChange, placeholder = "Seleccionar fecha", small = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(fromIso(value));
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, openUp: false });
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => { setSelected(fromIso(value)); }, [value]);

  // Calcular posición del popup (arriba o abajo del trigger según espacio)
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popupHeight = 360; // alto estimado del calendario
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < popupHeight && rect.top > popupHeight;
    setPopupPos({
      top: openUp ? rect.top - popupHeight - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 320)),
      openUp,
    });
  }, [open]);

  // Cerrar al hacer click afuera (también del popup montado en portal)
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (popupRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    // Cerrar también si el usuario scrollea
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const handleSelect = (date) => {
    setSelected(date);
    onChange?.(date ? toIso(date) : "");
    setOpen(false);
  };

  const triggerStyle = {
    width: "100%",
    padding: small ? "8px 12px" : "11px 14px",
    fontSize: small ? 12 : 14,
    boxSizing: "border-box",
    border: `1.5px solid ${open ? GOLD : "rgba(255,255,255,0.12)"}`,
    borderRadius: 10,
    background: disabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
    color: selected ? "#fff" : "rgba(255,255,255,0.4)",
    outline: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    textAlign: "left",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    transition: "border-color 150ms",
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <button ref={triggerRef} type="button" onClick={() => !disabled && setOpen((o) => !o)} disabled={disabled} style={triggerStyle}>
        <span>{selected ? formatDisplay(selected) : placeholder}</span>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={open ? GOLD_LIGHT : "rgba(255,255,255,0.5)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div ref={popupRef} style={{ position: "fixed", top: popupPos.top, left: popupPos.left, zIndex: 9999, background: NAVY, border: `1.5px solid ${GOLD}55`, borderRadius: 12, padding: 10, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            locale={es}
            weekStartsOn={1}
            showOutsideDays
            fixedWeeks
            footer={
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${GOLD}22` }}>
                <button type="button" onClick={() => handleSelect(undefined)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  Borrar
                </button>
                <button type="button" onClick={() => handleSelect(new Date())} style={{ background: "none", border: "none", color: GOLD_LIGHT, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                  Hoy
                </button>
              </div>
            }
          />
          <style>{`
            .rdp-root {
              --rdp-accent-color: ${GOLD};
              --rdp-accent-background-color: ${GOLD};
              --rdp-background-color: ${NAVY};
              --rdp-day-height: 34px;
              --rdp-day-width: 34px;
              --rdp-day-font-size: 12.5px;
              --rdp-weekday-font-size: 10px;
              --rdp-nav-button-size: 28px;
              --rdp-month-caption-font-size: 13px;
              --rdp-day_button-border-radius: 6px;
              color: rgba(255,255,255,0.85);
              font-family: 'Inter', sans-serif;
            }
            .rdp-month_caption {
              color: #fff;
              font-weight: 700;
              text-transform: capitalize;
              padding: 4px 6px;
            }
            .rdp-weekday {
              color: rgba(255,255,255,0.4);
              font-weight: 700;
              text-transform: uppercase;
              font-size: 9.5px;
              letter-spacing: 0.05em;
            }
            .rdp-day {
              color: rgba(255,255,255,0.75);
            }
            .rdp-day_button:hover:not([disabled]) {
              background: rgba(184,149,106,0.18);
              color: #fff;
            }
            .rdp-day_button {
              border: 1px solid transparent;
              transition: background 120ms;
            }
            .rdp-today .rdp-day_button {
              border-color: rgba(184,149,106,0.5);
              color: ${GOLD_LIGHT};
              font-weight: 700;
            }
            .rdp-selected .rdp-day_button {
              background: linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT}) !important;
              color: ${NAVY} !important;
              font-weight: 800;
              border: none;
              box-shadow: 0 2px 8px rgba(184,149,106,0.35);
            }
            .rdp-outside .rdp-day_button {
              color: rgba(255,255,255,0.2);
            }
            .rdp-disabled .rdp-day_button {
              opacity: 0.3;
              cursor: not-allowed;
            }
            .rdp-button_previous, .rdp-button_next {
              color: rgba(255,255,255,0.65);
              border-radius: 6px;
            }
            .rdp-button_previous:hover, .rdp-button_next:hover {
              background: rgba(184,149,106,0.15);
              color: ${GOLD_LIGHT};
            }
            .rdp-dropdown {
              background: ${NAVY};
              color: #fff;
              border: 1px solid rgba(255,255,255,0.1);
              border-radius: 6px;
              padding: 4px 8px;
            }
          `}</style>
        </div>,
        document.body
      )}
    </div>
  );
}
