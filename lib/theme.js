// Argencargo design tokens
// Base: navy profundo. Secondary accent: dorado metálico (NO amarillo).
// Regla: mantener toda la información y estructura; sólo estética.

export const theme = {
  // ───────── Colores base ─────────
  // Navy scale (el azul marca, no negro)
  navy: {
    950: "#0A1628", // fondo más profundo (hero, footers)
    900: "#0F1F3A", // fondo primario paneles oscuros
    800: "#142849", // cards sobre fondo oscuro
    700: "#1B3560", // borders sobre oscuro, hover
    600: "#254478", // texto secundario sobre claro
    500: "#2E5AA0", // acciones primarias
    100: "#E8EEF7", // bg sutil (chips, hover claro)
    50:  "#F5F8FC", // bg página
  },

  // Gold scale (secondary accent — metálico, warm)
  gold: {
    900: "#8A6D45", // texto sobre oro claro
    700: "#A68456", // borders, separadores
    500: "#B8956A", // BASE oro — accent primario secundario
    300: "#D4B88A", // hover
    200: "#E8D098", // highlight, gradient stop
    100: "#F5E9CF", // bg sutil, badges claros
    50:  "#FBF6EC", // bg muy sutil
    // Gradient preset: oro metálico
    gradient: "linear-gradient(135deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)",
    gradientSubtle: "linear-gradient(135deg, #C9A676 0%, #E8D098 100%)",
    glow: "0 0 20px rgba(184,149,106,0.25)",
    glowStrong: "0 0 28px rgba(184,149,106,0.4)",
  },

  // Neutrals (grises cálidos, no fríos)
  gray: {
    950: "#0E1116",
    900: "#171A21",
    800: "#2A2E37",
    700: "#3D4250",
    600: "#5A6173",
    500: "#7E8596",
    400: "#A8AEBC",
    300: "#CDD2DC",
    200: "#E5E8EF",
    100: "#F1F3F7",
    50:  "#F8F9FB",
    0:   "#FFFFFF",
  },

  // Semantic
  semantic: {
    success:    "#1E9E6A",
    successBg:  "#E6F7EE",
    warning:    "#C68A1F",
    warningBg:  "#FBF2DB",
    danger:     "#C13434",
    dangerBg:   "#FBE7E7",
    info:       "#2E5AA0",
    infoBg:     "#E8EEF7",
  },

  // ───────── Espaciado ─────────
  space: {
    0: "0",
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
    16: "64px",
  },

  // ───────── Radios ─────────
  radius: {
    sm: "6px",
    md: "10px",
    lg: "14px",
    xl: "18px",
    pill: "999px",
  },

  // ───────── Sombras ─────────
  shadow: {
    xs:   "0 1px 2px rgba(10,22,40,0.06)",
    sm:   "0 2px 6px rgba(10,22,40,0.08)",
    md:   "0 4px 14px rgba(10,22,40,0.10)",
    lg:   "0 10px 30px rgba(10,22,40,0.14)",
    xl:   "0 20px 50px rgba(10,22,40,0.18)",
    // para el ring dorado en focus/selected
    ringGold: "0 0 0 3px rgba(184,149,106,0.28)",
    ringNavy: "0 0 0 3px rgba(46,90,160,0.22)",
  },

  // ───────── Tipografía ─────────
  font: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    size: {
      xs: "11px",
      sm: "12px",
      base: "13px",
      md: "14px",
      lg: "16px",
      xl: "18px",
      "2xl": "22px",
      "3xl": "28px",
      "4xl": "36px",
    },
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    tracking: {
      tight: "-0.01em",
      normal: "0",
      wide: "0.04em",
      wider: "0.08em",
    },
  },

  // ───────── Transitions ─────────
  transition: {
    fast:   "120ms cubic-bezier(0.4, 0, 0.2, 1)",
    base:   "180ms cubic-bezier(0.4, 0, 0.2, 1)",
    slow:   "280ms cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "320ms cubic-bezier(0.34, 1.56, 0.64, 1)",
  },

  // ───────── Z-index ─────────
  z: {
    base: 1,
    sticky: 10,
    dropdown: 50,
    modal: 100,
    toast: 200,
  },
};

// Aliases de uso frecuente (para no tener que escribir theme.xxx.yyy siempre)
export const T = theme;
export const NAVY = theme.navy[900];
export const NAVY_DEEP = theme.navy[950];
export const GOLD = theme.gold[500];
export const GOLD_LIGHT = theme.gold[200];
export const GOLD_GRADIENT = theme.gold.gradient;

// ───────── Helpers ─────────
// Chip de status con colores cálidos (para reemplazar los saturados actuales)
export function statusChipStyle(variant = "neutral") {
  const map = {
    neutral:  { bg: theme.gray[100],       fg: theme.gray[700],   bd: theme.gray[200] },
    info:     { bg: theme.semantic.infoBg, fg: theme.semantic.info, bd: "#D1DEF0" },
    success:  { bg: theme.semantic.successBg, fg: theme.semantic.success, bd: "#BFE6D1" },
    warning:  { bg: theme.semantic.warningBg, fg: theme.semantic.warning, bd: "#EFD79F" },
    danger:   { bg: theme.semantic.dangerBg, fg: theme.semantic.danger, bd: "#EFC2C2" },
    gold:     { bg: theme.gold[100],       fg: theme.gold[900],   bd: theme.gold[200] },
    navy:     { bg: theme.navy[100],       fg: theme.navy[900],   bd: "#CED9EB" },
  };
  const c = map[variant] || map.neutral;
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: theme.radius.pill,
    background: c.bg,
    color: c.fg,
    border: `1px solid ${c.bd}`,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: theme.font.tracking.wide,
    textTransform: "uppercase",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
  };
}

// Card base unificada — reemplaza los `panel` inline que aparecen en los 3 portales
export function cardStyle({ padded = true, subtle = false } = {}) {
  return {
    background: theme.gray[0],
    border: `1px solid ${theme.gray[200]}`,
    borderRadius: theme.radius.lg,
    padding: padded ? theme.space[5] : 0,
    boxShadow: subtle ? theme.shadow.xs : theme.shadow.sm,
    transition: `box-shadow ${theme.transition.base}, border-color ${theme.transition.base}`,
  };
}

// Botón primary (navy con hover sutil). Secondary = contorno dorado.
export function btnStyle(variant = "primary", size = "md") {
  const sizes = {
    sm: { padding: "6px 12px", fontSize: theme.font.size.sm, h: 30 },
    md: { padding: "8px 16px", fontSize: theme.font.size.md, h: 36 },
    lg: { padding: "10px 20px", fontSize: theme.font.size.lg, h: 42 },
  }[size] || {};
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: sizes.padding,
    height: sizes.h,
    fontSize: sizes.fontSize,
    fontWeight: theme.font.weight.semibold,
    borderRadius: theme.radius.md,
    border: "1px solid transparent",
    cursor: "pointer",
    transition: `all ${theme.transition.base}`,
    letterSpacing: theme.font.tracking.normal,
    whiteSpace: "nowrap",
  };
  const variants = {
    primary: {
      background: theme.navy[900],
      color: theme.gray[0],
      borderColor: theme.navy[900],
    },
    secondary: {
      background: theme.gray[0],
      color: theme.navy[900],
      borderColor: theme.gray[300],
    },
    gold: {
      background: theme.gold.gradient,
      color: theme.navy[950],
      borderColor: theme.gold[700],
      boxShadow: theme.gold.glow,
    },
    ghost: {
      background: "transparent",
      color: theme.navy[900],
      borderColor: "transparent",
    },
    danger: {
      background: theme.semantic.danger,
      color: theme.gray[0],
      borderColor: theme.semantic.danger,
    },
  };
  return { ...base, ...(variants[variant] || variants.primary) };
}

// Input base
export function inputStyle() {
  return {
    width: "100%",
    padding: "8px 12px",
    fontSize: theme.font.size.md,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.gray[300]}`,
    background: theme.gray[0],
    color: theme.gray[900],
    transition: `border-color ${theme.transition.base}, box-shadow ${theme.transition.base}`,
    outline: "none",
  };
}

// Pulsing dot (para status activos "live")
export const pulseDotKeyframes = `
@keyframes ac_pulse {
  0%   { box-shadow: 0 0 0 0 rgba(30,158,106,0.45); }
  70%  { box-shadow: 0 0 0 8px rgba(30,158,106,0); }
  100% { box-shadow: 0 0 0 0 rgba(30,158,106,0); }
}
@keyframes ac_pulse_gold {
  0%   { box-shadow: 0 0 0 0 rgba(184,149,106,0.5); }
  70%  { box-shadow: 0 0 0 10px rgba(184,149,106,0); }
  100% { box-shadow: 0 0 0 0 rgba(184,149,106,0); }
}
@keyframes ac_shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

export function pulseDot(color = theme.semantic.success) {
  return {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: color,
    animation: "ac_pulse 1.8s infinite",
  };
}

export default theme;
