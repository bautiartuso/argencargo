"use client";
import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════════
// Toast system — pubsub module-level + <ToastStack/> component
// ═══════════════════════════════════════════════════════════════════
let nextId = 0;
const listeners = new Set();

export function toast(msg, variant = "success", opts = {}) {
  const t = {
    id: ++nextId,
    msg,
    variant,
    duration: opts.duration ?? (variant === "error" ? 5000 : 3500),
  };
  listeners.forEach((l) => l(t));
  return t.id;
}
toast.success = (m, o) => toast(m, "success", o);
toast.error = (m, o) => toast(m, "error", o);
toast.info = (m, o) => toast(m, "info", o);
toast.warn = (m, o) => toast(m, "warn", o);

export function ToastStack() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const cb = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration);
    };
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  const variants = {
    success: { border: "rgba(34,197,94,0.45)", bar: "#22c55e", bg: "rgba(34,197,94,0.12)", icon: "✓" },
    error:   { border: "rgba(239,68,68,0.45)", bar: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: "✕" },
    warn:    { border: "rgba(251,191,36,0.45)", bar: "#fbbf24", bg: "rgba(251,191,36,0.14)", icon: "!" },
    info:    { border: "rgba(184,149,106,0.45)", bar: "#E8D098", bg: "rgba(184,149,106,0.12)", icon: "●" },
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ac_toast_in {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      ` }} />
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
          maxWidth: "calc(100vw - 40px)",
        }}
      >
        {toasts.map((t) => {
          const v = variants[t.variant] || variants.success;
          return (
            <div
              key={t.id}
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              style={{
                pointerEvents: "auto",
                cursor: "pointer",
                background: "rgba(10,22,40,0.95)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: `1px solid ${v.border}`,
                borderLeft: `3px solid ${v.bar}`,
                borderRadius: 10,
                padding: "13px 18px 13px 14px",
                color: "#fff",
                fontSize: 13,
                fontWeight: 500,
                minWidth: 280,
                maxWidth: 420,
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                animation: "ac_toast_in 260ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                letterSpacing: "0.005em",
                lineHeight: 1.4,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: v.bar,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: v.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {v.icon}
              </span>
              <span style={{ flex: 1 }}>{t.msg}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Skeleton (shimmer animation)
// ═══════════════════════════════════════════════════════════════════
export function Skeleton({ w = "100%", h = 14, br = 6, style = {} }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: typeof w === "number" ? `${w}px` : w,
        height: typeof h === "number" ? `${h}px` : h,
        borderRadius: br,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(184,149,106,0.08) 50%, rgba(255,255,255,0.03) 100%)",
        backgroundSize: "200% 100%",
        animation: "ac_shimmer 1.4s infinite linear",
        ...style,
      }}
    />
  );
}

export function SkeletonTable({ rows = 6, cols = 5, hideHeader = false }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      {!hideHeader && (
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,0,0,0.25)",
          }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} style={{ flex: 1 }}>
              <Skeleton w={`${40 + (i * 13) % 30}%`} h={10} br={4} />
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: "flex",
            gap: 16,
            padding: "14px 16px",
            borderBottom: r < rows - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            alignItems: "center",
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} style={{ flex: 1 }}>
              <Skeleton w={`${55 + ((r * 7 + c * 11) % 35)}%`} h={13} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ h = 120 }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "1.5rem 1.75rem",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <Skeleton w={100} h={14} />
        <Skeleton w={120} h={18} br={999} />
      </div>
      <Skeleton w="60%" h={20} style={{ marginBottom: 18 }} />
      <div style={{ display: "flex", gap: 24 }}>
        <Skeleton w={80} h={34} />
        <Skeleton w={80} h={34} />
        <Skeleton w={120} h={34} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WhatsApp floating widget
// ═══════════════════════════════════════════════════════════════════
export function WhatsAppFab({ phone = "5491125088580", message = "Hola Argencargo! 👋 Tengo una consulta." }) {
  const [hover, setHover] = useState(false);
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ac_wa_pulse {
          0%   { box-shadow: 0 0 0 0 rgba(37,211,102,0.5), 0 8px 24px rgba(0,0,0,0.3); }
          70%  { box-shadow: 0 0 0 14px rgba(37,211,102,0), 0 8px 24px rgba(0,0,0,0.3); }
          100% { box-shadow: 0 0 0 0 rgba(37,211,102,0), 0 8px 24px rgba(0,0,0,0.3); }
        }
      `}} />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          zIndex: 9998,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          textDecoration: "none",
          animation: "ac_wa_pulse 2.2s infinite",
          transform: hover ? "scale(1.08)" : "scale(1)",
          transition: "transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          cursor: "pointer",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
      </a>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Empty states
// ═══════════════════════════════════════════════════════════════════
const emptyIcons = {
  box: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  inbox: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  document: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  ),
};

export function EmptyState({ icon = "box", title, description, cta, ctaOnClick }) {
  const paths = emptyIcons[icon] || emptyIcons.box;
  return (
    <div
      style={{
        padding: "3rem 1.5rem",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, rgba(184,149,106,0.1) 0%, rgba(184,149,106,0.02) 100%)",
          border: "1px solid rgba(184,149,106,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#E8D098"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {paths}
        </svg>
      </div>
      <p
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "rgba(255,255,255,0.85)",
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </p>
      {description && (
        <p
          style={{
            fontSize: 12.5,
            color: "rgba(255,255,255,0.45)",
            margin: "4px 0 0",
            maxWidth: 380,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {cta && ctaOnClick && (
        <button
          onClick={ctaOnClick}
          style={{
            marginTop: 18,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            cursor: "pointer",
            background: "linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)",
            color: "#0A1628",
            border: "1px solid #A68456",
            boxShadow: "0 0 20px rgba(184,149,106,0.25)",
            letterSpacing: "0.02em",
            transition: "transform 150ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
          }}
        >
          {cta}
        </button>
      )}
    </div>
  );
}
