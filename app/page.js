"use client";
import { useState, useEffect, useRef } from "react";

/* ============================================================
   ARGENCARGO — Landing "El viaje de tu carga"
   La página entera ES el recorrido China → Argentina.
   ============================================================ */

const LOGO_WHITE =
  "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const LOGO_COLOR =
  "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png";

const WA_URL =
  "https://wa.me/5491125088580?text=" +
  encodeURIComponent("Hola! Quiero hacer una consulta sobre importar desde China");

const FALLBACK = {
  vuelos_en_transito: 13,
  kg_en_el_aire: 938.39,
  m3_en_el_mar: 10.28,
  ops_en_aduana: 9,
  vuelos_totales: 106,
  kg_volados: 5816.4,
  importadores: 1397,
};

const BLUE = "#3B7DD8";
const NAVY = "#152D54";
const NIGHT = "#0a1223";
const GOLD = "#B8956A";

/* rutas del viaje (viewBox 0 0 100 100, se estira a todo el bloque) */
const AIR_D =
  "M50 0 C85 11 15 22 50 34 C88 46 12 58 50 70 C84 80 54 88 50 97";
const SEA_D =
  "M41 0 C74 13 8 24 41 36 C79 48 6 60 41 72 C72 82 46 89 44 97";

/* estrellas deterministas (sin Math.random: evita mismatches de hidratación) */
const STARS = Array.from({ length: 74 }, (_, i) => ({
  x: (i * 137.5) % 100,
  y: (i * 61.8) % 58,
  r: 0.35 + ((i * 7) % 10) * 0.09,
  d: (i % 7) * 0.85,
  o: 0.3 + ((i * 13) % 10) / 22,
}));

const decimalsOf = (n) => {
  const s = String(n);
  const i = s.indexOf(".");
  return i < 0 ? 0 : Math.min(2, s.length - i - 1);
};

/* ---------------- Contador animado (count-up al entrar al viewport) -------- */
function CountUp({ value, decimals, duration = 1900, style }) {
  const ref = useRef(null);
  const target = Number(value) || 0;
  const dec = decimals != null ? decimals : decimalsOf(target);
  const fmt = (n) =>
    n.toLocaleString("es-AR", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      el.textContent = fmt(target);
      return;
    }
    let started = false;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started) {
            started = true;
            io.disconnect();
            const t0 = performance.now();
            const tick = (t) => {
              const p = Math.min(1, (t - t0) / duration);
              const ease = 1 - Math.pow(1 - p, 3);
              el.textContent = fmt(target * ease);
              if (p < 1) raf = requestAnimationFrame(tick);
            };
            el.textContent = fmt(0);
            raf = requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, decimals, duration]);
  // SSR/pre-hidratación: el valor final ya renderizado (sin flash vacío ni layout shift).
  return <span ref={ref} style={style}>{fmt(target)}</span>;
}

/* ---------------- SVG: puerto chino en el horizonte (injerto de la escena) -- */
function ChinaPort() {
  return (
    <svg
      viewBox="0 0 1200 260"
      preserveAspectRatio="xMaxYMax meet"
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <g id="pcrane" fill="#0b1730">
          <rect x="18" y="120" width="9" height="140" />
          <rect x="86" y="120" width="9" height="140" />
          <rect x="0" y="108" width="120" height="11" />
          <path d="M8 112 L 96 22 L 105 29 L 24 112 Z" />
          <rect x="30" y="86" width="52" height="24" />
        </g>
      </defs>
      <rect x="700" y="150" width="46" height="110" fill="#0b1730" opacity="0.9" />
      <rect x="756" y="120" width="60" height="140" fill="#0b1730" />
      <rect x="826" y="160" width="38" height="100" fill="#0b1730" opacity="0.85" />
      <rect x="874" y="105" width="70" height="155" fill="#0b1730" />
      <rect x="954" y="140" width="44" height="120" fill="#0b1730" opacity="0.9" />
      <rect x="1010" y="90" width="64" height="170" fill="#0b1730" />
      <rect x="1084" y="150" width="80" height="110" fill="#0b1730" opacity="0.85" />
      <rect x="770" y="136" width="5" height="5" fill="#ffd98a" opacity="0.85" />
      <rect x="790" y="170" width="5" height="5" fill="#ffd98a" opacity="0.6" />
      <rect x="890" y="122" width="5" height="5" fill="#ffd98a" opacity="0.8" />
      <rect x="912" y="180" width="5" height="5" fill="#ffd98a" opacity="0.55" />
      <rect x="1028" y="110" width="5" height="5" fill="#ffd98a" opacity="0.8" />
      <rect x="1050" y="150" width="5" height="5" fill="#ffd98a" opacity="0.6" />
      <rect x="1102" y="176" width="5" height="5" fill="#ffd98a" opacity="0.7" />
      <use href="#pcrane" transform="translate(40,0)" />
      <use href="#pcrane" transform="translate(230,26) scale(0.9)" />
      <use href="#pcrane" transform="translate(430,52) scale(0.8)" />
      <rect x="70" y="244" width="34" height="12" fill="#0b1730" />
      <rect x="108" y="244" width="34" height="12" fill="#0b1730" opacity="0.9" />
      <rect x="90" y="230" width="34" height="12" fill="#0b1730" opacity="0.8" />
      <circle className="acg-beacon" cx="141" cy="20" r="3.5" fill="#ff5a4e" />
      <circle cx="330" cy="52" r="2.5" fill="#ffd27d" opacity="0.9" />
      <circle cx="510" cy="76" r="2" fill="#ffd27d" opacity="0.8" />
    </svg>
  );
}

/* ---------------- SVG: avión de carga (la estrella de la página) ----------- */
function CargoPlane() {
  return (
    <svg
      viewBox="0 0 640 260"
      style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="acgFus" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#eef3fa" />
          <stop offset="1" stopColor="#c7d5e8" />
        </linearGradient>
        <linearGradient id="acgFin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B7DD8" />
          <stop offset="1" stopColor="#152D54" />
        </linearGradient>
        <linearGradient id="acgWing" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dde7f3" />
          <stop offset="1" stopColor="#a9bcd6" />
        </linearGradient>
        <linearGradient id="acgTrail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.32" />
        </linearGradient>
      </defs>

      {/* estela */}
      <rect x="-200" y="143" width="264" height="5" rx="2.5" fill="url(#acgTrail)" />
      <rect x="-140" y="156" width="190" height="3.5" rx="1.75" fill="url(#acgTrail)" opacity="0.6" />

      {/* estabilizador horizontal (lado lejano) */}
      <path d="M98 138 L28 121 L52 149 L110 153 Z" fill="#93a8c6" />

      {/* cola vertical */}
      <path
        d="M116 122 C104 78 102 48 110 30 C113 23 122 23 127 31 L184 118 Z"
        fill="url(#acgFin)"
      />
      <path d="M121 92 L168 116 L148 117 Z" fill={GOLD} opacity="0.9" />

      {/* fuselaje */}
      <path
        d="M70 148 C104 122 176 112 252 111 L468 111 C540 113 586 127 610 146 C590 168 540 179 468 181 L206 181 C136 181 96 170 70 152 Z"
        fill="url(#acgFus)"
      />
      {/* panza navy */}
      <path
        d="M80 154 C112 170 158 180 214 181 L468 181 C532 179 578 167 602 152 L598 159 C572 173 530 184 466 186 L212 186 C150 185 108 174 80 160 Z"
        fill={NAVY}
        opacity="0.92"
      />
      {/* cheatline azul */}
      <path d="M96 131 L586 128 L598 138 L96 139 Z" fill={BLUE} opacity="0.85" />

      {/* ventanillas de cabina */}
      <path d="M566 122 L583 127 L579 135 L562 130 Z" fill="#0d1b36" />
      <path d="M588 129 L600 137 L593 142 L583 136 Z" fill="#0d1b36" />
      {/* ojos de buey delanteros */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx={540 - i * 15} cy={124.5} r={2.2} fill={NAVY} opacity="0.65" />
      ))}
      {/* puerta de carga */}
      <rect
        x="234"
        y="140"
        width="56"
        height="34"
        rx="6"
        fill="none"
        stroke="#9db2cc"
        strokeWidth="2"
      />
      {/* marca */}
      <text
        x="330"
        y="160"
        fontSize="16"
        fontWeight="800"
        letterSpacing="5"
        fill={NAVY}
        opacity="0.55"
        fontFamily="'Inter','Segoe UI',system-ui,sans-serif"
      >
        ARGENCARGO
      </text>

      {/* ala (barrida hacia el frente) */}
      <path
        d="M322 149 L214 224 L252 231 L400 156 Z"
        fill="url(#acgWing)"
        stroke="#8fa6c2"
        strokeWidth="1"
      />

      {/* motor externo */}
      <g>
        <rect x="238" y="203" width="54" height="24" rx="12" fill="#e9eff8" stroke="#8fa6c2" />
        <circle cx="287" cy="215" r="10" fill="#0d1b36" />
        <circle cx="287" cy="215" r="4" fill={BLUE} />
        <rect x="252" y="203" width="8" height="24" fill={BLUE} opacity="0.85" />
      </g>
      {/* motor interno */}
      <g>
        <rect x="318" y="176" width="48" height="21" rx="10.5" fill="#e9eff8" stroke="#8fa6c2" />
        <circle cx="361" cy="186.5" r="8.5" fill="#0d1b36" />
        <circle cx="361" cy="186.5" r="3.4" fill={BLUE} />
        <rect x="330" y="176" width="7" height="21" fill={BLUE} opacity="0.85" />
      </g>

      {/* luces de navegación */}
      <circle className="acg-light-red-glow" cx="111" cy="26" r="9" fill="#ff4d4d" opacity="0.25" />
      <circle className="acg-light-red" cx="111" cy="26" r="4" fill="#ff5252" />
      <circle className="acg-light-green-glow" cx="220" cy="228" r="9" fill="#3ddc84" opacity="0.25" />
      <circle className="acg-light-green" cx="220" cy="228" r="4" fill="#3ddc84" />
      <circle className="acg-light-strobe" cx="610" cy="146" r="3.2" fill="#ffffff" />
    </svg>
  );
}

/* ---------------- SVG: buque portacontenedores -------------------------- */
function ContainerShip() {
  const stacks = [3, 4, 3, 4, 4, 3, 4, 3, 4, 3];
  const palette = [BLUE, NAVY, GOLD, "#5c7fae", "#c05b48", "#3e8e7e"];
  return (
    <svg
      viewBox="0 0 700 300"
      style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="acgHull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d3a66" />
          <stop offset="1" stopColor="#0e1c38" />
        </linearGradient>
      </defs>

      {/* contenedores apilados */}
      {stacks.map((h, ci) => (
        <g key={ci}>
          {Array.from({ length: h }).map((_, ri) => (
            <g key={ri}>
              <rect
                x={198 + ci * 42}
                y={197 - 22 * (ri + 1)}
                width="40"
                height="21"
                rx="2"
                fill={palette[(ci * 3 + ri * 5) % palette.length]}
                stroke="rgba(6,11,24,0.4)"
                strokeWidth="1"
              />
              <line
                x1={198 + ci * 42 + 8}
                y1={197 - 22 * (ri + 1) + 3}
                x2={198 + ci * 42 + 8}
                y2={197 - 22 * ri - 3}
                stroke="rgba(6,11,24,0.22)"
                strokeWidth="2"
              />
              <line
                x1={198 + ci * 42 + 30}
                y1={197 - 22 * (ri + 1) + 3}
                x2={198 + ci * 42 + 30}
                y2={197 - 22 * ri - 3}
                stroke="rgba(6,11,24,0.22)"
                strokeWidth="2"
              />
            </g>
          ))}
        </g>
      ))}

      {/* superestructura */}
      <g>
        <rect x="62" y="170" width="36" height="28" rx="3" fill="#dfe7f2" stroke="#b3c2d8" />
        <rect x="70" y="118" width="20" height="52" rx="4" fill={NAVY} />
        <rect x="70" y="124" width="20" height="8" fill={BLUE} />
        <rect x="70" y="132" width="20" height="3" fill={GOLD} />
        <rect x="96" y="88" width="86" height="110" rx="4" fill="#f4f7fb" stroke="#b3c2d8" />
        {[0, 1, 2, 3].map((r) => (
          <g key={r}>
            {[0, 1, 2, 3, 4].map((c) => (
              <rect
                key={c}
                x={104 + c * 15}
                y={100 + r * 22}
                width="9"
                height="7"
                rx="1.5"
                fill={NAVY}
                opacity="0.65"
              />
            ))}
          </g>
        ))}
        <rect x="88" y="74" width="102" height="16" rx="3" fill="#e4ebf4" stroke="#b3c2d8" />
        <line x1="139" y1="74" x2="139" y2="46" stroke="#b3c2d8" strokeWidth="3" />
        <circle cx="139" cy="43" r="4.5" fill={GOLD} />
      </g>

      {/* casco */}
      <path
        d="M20 198 L620 198 L672 154 L664 200 C672 202 675 210 671 218 L646 258 L88 258 C52 250 30 226 20 198 Z"
        fill="url(#acgHull)"
      />
      {/* línea de flotación roja */}
      <path
        d="M36 234 L658 234 L646 258 L88 258 C64 253 48 245 36 234 Z"
        fill="#a8442f"
      />
      <text
        x="470"
        y="224"
        fontSize="15"
        fontWeight="700"
        letterSpacing="4"
        fill="#e7eef8"
        opacity="0.8"
        fontFamily="'Inter','Segoe UI',system-ui,sans-serif"
      >
        ARGENCARGO
      </text>
      <circle cx="636" cy="212" r="5" fill="none" stroke="#e7eef8" strokeWidth="2" opacity="0.5" />

      {/* espuma */}
      <ellipse cx="668" cy="258" rx="26" ry="7" fill="#ffffff" opacity="0.22" />
      <ellipse cx="600" cy="263" rx="46" ry="6" fill="#ffffff" opacity="0.12" />
      <ellipse cx="120" cy="262" rx="36" ry="5" fill="#ffffff" opacity="0.1" />
    </svg>
  );
}

/* ---------------- SVG: nube ------------------------------------------------ */
function Cloud({ style, className, color = "#22365c", opacity = 0.5 }) {
  return (
    <svg viewBox="0 0 240 80" className={className} style={style} aria-hidden="true">
      <g fill={color} opacity={opacity}>
        <ellipse cx="60" cy="52" rx="52" ry="22" />
        <ellipse cx="112" cy="38" rx="46" ry="26" />
        <ellipse cx="172" cy="52" rx="58" ry="22" />
      </g>
    </svg>
  );
}

/* ---------------- SVG: ilustraciones de los 3 pasos ----------------------- */
function StepBoxes() {
  return (
    <svg viewBox="0 0 220 150" style={{ width: "100%", height: "auto", display: "block" }} aria-hidden="true">
      <line x1="14" y1="134" x2="206" y2="134" stroke="#d5e2f2" strokeWidth="3" strokeLinecap="round" />
      {/* caja grande */}
      <rect x="58" y="84" width="62" height="50" rx="4" fill="#e9d2a8" stroke="#c9a26b" strokeWidth="2" />
      <rect x="85" y="84" width="9" height="50" fill={GOLD} opacity="0.75" />
      <path d="M58 96 L120 96" stroke="#c9a26b" strokeWidth="1.5" />
      {/* caja mediana arriba */}
      <rect x="66" y="46" width="46" height="38" rx="4" fill="#f0dcb6" stroke="#c9a26b" strokeWidth="2" />
      <rect x="86" y="46" width="8" height="38" fill={GOLD} opacity="0.75" />
      {/* caja al lado */}
      <rect x="130" y="98" width="44" height="36" rx="4" fill="#e9d2a8" stroke="#c9a26b" strokeWidth="2" />
      <rect x="149" y="98" width="8" height="36" fill={GOLD} opacity="0.75" />
      {/* cinta azul con etiqueta */}
      <rect x="136" y="106" width="24" height="13" rx="2" fill="#ffffff" stroke="#b9c9de" />
      <line x1="139" y1="111" x2="157" y2="111" stroke={BLUE} strokeWidth="2" />
      <line x1="139" y1="115" x2="151" y2="115" stroke="#b9c9de" strokeWidth="2" />
      {/* gancho de grúa levantando una cajita */}
      <line x1="42" y1="0" x2="42" y2="26" stroke="#9db2cc" strokeWidth="2.5" />
      <path d="M42 26 C42 33 34 33 34 27" stroke="#9db2cc" strokeWidth="2.5" fill="none" />
      <rect x="24" y="34" width="34" height="28" rx="3" fill="#f0dcb6" stroke="#c9a26b" strokeWidth="2" />
      <rect x="38" y="34" width="7" height="28" fill={GOLD} opacity="0.75" />
      <text x="176" y="34" fontSize="24">🇨🇳</text>
      <text x="20" y="128" fontSize="11" fontWeight="700" letterSpacing="2" fill="#8ba3c2">SHENZHEN</text>
    </svg>
  );
}

function StepTransit() {
  return (
    <svg viewBox="0 0 220 150" style={{ width: "100%", height: "auto", display: "block" }} aria-hidden="true">
      {/* arco aéreo */}
      <path
        d="M18 104 Q110 8 202 104"
        fill="none"
        stroke={BLUE}
        strokeWidth="2.5"
        strokeDasharray="1 9"
        strokeLinecap="round"
      />
      {/* mini avión en el arco */}
      <g transform="translate(110 22) rotate(8)">
        <path d="M-22 0 L14 -4 L26 0 L14 4 Z" fill={NAVY} />
        <path d="M-14 -1 L-24 -12 L-19 -13 L-6 -3 Z" fill={BLUE} />
        <path d="M-2 2 L-12 14 L-4 14 L6 3 Z" fill={NAVY} opacity="0.85" />
        <circle cx="22" cy="0" r="2" fill="#fff" />
      </g>
      {/* olas */}
      <path d="M14 122 Q28 114 42 122 T70 122 T98 122 T126 122 T154 122 T182 122 T210 122" fill="none" stroke="#9ec3ec" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 134 Q38 127 52 134 T80 134 T108 134 T136 134 T164 134 T192 134" fill="none" stroke="#c9def4" strokeWidth="3" strokeLinecap="round" />
      {/* mini barco */}
      <g transform="translate(148 96)">
        <path d="M0 14 L44 14 L50 6 L48 15 C50 16 49 21 47 23 L41 28 L7 28 C3 26 0 20 0 14 Z" fill={NAVY} />
        <rect x="8" y="6" width="10" height="8" rx="1" fill={BLUE} />
        <rect x="19" y="6" width="10" height="8" rx="1" fill={GOLD} />
        <rect x="30" y="6" width="10" height="8" rx="1" fill="#c05b48" />
        <rect x="13" y="-2" width="10" height="8" rx="1" fill="#5c7fae" />
      </g>
    </svg>
  );
}

function StepDoor() {
  return (
    <svg viewBox="0 0 220 150" style={{ width: "100%", height: "auto", display: "block" }} aria-hidden="true">
      <line x1="14" y1="136" x2="206" y2="136" stroke="#d5e2f2" strokeWidth="3" strokeLinecap="round" />
      {/* marco y puerta */}
      <rect x="80" y="24" width="64" height="112" rx="6" fill="#e4edf8" />
      <rect x="88" y="32" width="48" height="104" rx="4" fill={NAVY} />
      <rect x="94" y="42" width="36" height="30" rx="3" fill="none" stroke="#3f5c8c" strokeWidth="2" />
      <rect x="94" y="80" width="36" height="40" rx="3" fill="none" stroke="#3f5c8c" strokeWidth="2" />
      <circle cx="128" cy="90" r="3.5" fill={GOLD} />
      {/* felpudo */}
      <rect x="90" y="138" width="44" height="7" rx="3.5" fill={GOLD} opacity="0.6" />
      {/* paquete en la puerta */}
      <rect x="44" y="104" width="34" height="32" rx="3" fill="#e9d2a8" stroke="#c9a26b" strokeWidth="2" />
      <rect x="58" y="104" width="7" height="32" fill={BLUE} opacity="0.8" />
      {/* pin de ubicación */}
      <path d="M170 58 C170 45 190 45 190 58 C190 67 180 74 180 80 C180 74 170 67 170 58 Z" fill={BLUE} />
      <circle cx="180" cy="57" r="4.5" fill="#fff" />
      <text x="158" y="34" fontSize="24">🇦🇷</text>
      <text x="20" y="30" fontSize="11" fontWeight="700" letterSpacing="2" fill="#8ba3c2">TU PUERTA</text>
    </svg>
  );
}

/* ---------------- marcadores que viajan por la ruta ----------------------- */
function MiniPlane() {
  return (
    <svg viewBox="0 0 28 28" width="30" height="30" aria-hidden="true" style={{ display: "block" }}>
      <path
        d="M14 1 C15.4 4 15.6 7 15.6 10.5 L26 18 L26 20.6 L15.6 16.8 L15.6 22 L19 25 L19 27 L14 25.4 L9 27 L9 25 L12.4 22 L12.4 16.8 L2 20.6 L2 18 L12.4 10.5 C12.4 7 12.6 4 14 1 Z"
        fill={BLUE}
        stroke="#ffffff"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MiniShip() {
  return (
    <svg viewBox="0 0 34 24" width="30" height="22" aria-hidden="true" style={{ display: "block" }}>
      <path
        d="M2 13 L26 13 L31 7 L29.5 13 C31.5 13.6 31 17 29.5 18.5 L26 22 L7 22 C4 21 2 17 2 13 Z"
        fill={NAVY}
        stroke="#ffffff"
        strokeWidth="1.2"
      />
      <rect x="6" y="7" width="6" height="5" rx="1" fill={BLUE} stroke="#fff" strokeWidth="0.8" />
      <rect x="13" y="7" width="6" height="5" rx="1" fill={GOLD} stroke="#fff" strokeWidth="0.8" />
      <rect x="20" y="7" width="6" height="5" rx="1" fill="#c05b48" stroke="#fff" strokeWidth="0.8" />
      <rect x="9" y="1.5" width="6" height="5" rx="1" fill="#5c7fae" stroke="#fff" strokeWidth="0.8" />
    </svg>
  );
}

/* ---------------- SVG: skyline Buenos Aires (CTA final) ------------------- */
function Skyline() {
  return (
    <svg
      viewBox="0 0 1200 200"
      preserveAspectRatio="xMidYMax meet"
      style={{ width: "100%", height: "auto", display: "block" }}
      aria-hidden="true"
    >
      <g fill="#081226">
        <rect x="40" y="120" width="70" height="80" />
        <rect x="120" y="90" width="56" height="110" />
        <rect x="190" y="130" width="80" height="70" />
        <rect x="300" y="70" width="60" height="130" />
        <rect x="370" y="110" width="48" height="90" />
        <rect x="440" y="95" width="72" height="105" />
        {/* Obelisco */}
        <path d="M600 18 L590 178 L610 178 Z" />
        <rect x="586" y="178" width="28" height="22" />
        <rect x="660" y="85" width="66" height="115" />
        <rect x="740" y="120" width="52" height="80" />
        <rect x="810" y="60" width="58" height="140" />
        <rect x="880" y="105" width="76" height="95" />
        <rect x="980" y="130" width="60" height="70" />
        <rect x="1060" y="90" width="70" height="110" />
      </g>
      {/* ventanas encendidas */}
      <g fill={GOLD} opacity="0.85">
        <rect x="316" y="84" width="6" height="8" />
        <rect x="334" y="104" width="6" height="8" />
        <rect x="136" y="104" width="6" height="8" />
        <rect x="152" y="128" width="6" height="8" />
        <rect x="676" y="100" width="6" height="8" />
        <rect x="700" y="130" width="6" height="8" />
        <rect x="826" y="80" width="6" height="8" />
        <rect x="842" y="112" width="6" height="8" />
        <rect x="900" y="120" width="6" height="8" />
        <rect x="456" y="112" width="6" height="8" />
        <rect x="1076" y="106" width="6" height="8" />
      </g>
    </svg>
  );
}

/* ---------------- icono WhatsApp ------------------------------------------ */
function WaIcon({ size = 30 }) {
  return (
    <svg viewBox="0 0 448 512" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
    </svg>
  );
}

/* ================================ CSS ===================================== */
const CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
.acg{font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;color:${NAVY};background:#fff;overflow-x:clip;width:100%;line-height:1.5}
.acg a{text-decoration:none;color:inherit}
.acg button{font-family:inherit}
.acg img{max-width:100%}

/* ---------- keyframes ---------- */
@keyframes acgTwinkle{0%,100%{opacity:.15}50%{opacity:.95}}
@keyframes acgPlaneCross{0%{transform:translate3d(-52vw,7vh,0)}100%{transform:translate3d(114vw,-8vh,0)}}
@keyframes acgPlaneBob{0%,100%{transform:translateY(0) rotate(-1.4deg)}50%{transform:translateY(-11px) rotate(.9deg)}}
@keyframes acgShipCross{0%{transform:translate3d(106vw,0,0)}100%{transform:translate3d(-72vw,0,0)}}
@keyframes acgShipBob{0%,100%{transform:translateY(0) rotate(-.5deg)}50%{transform:translateY(5px) rotate(.5deg)}}
@keyframes acgDrift{0%{transform:translate3d(-22vw,0,0)}100%{transform:translate3d(112vw,0,0)}}
@keyframes acgWave{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(-50%,0,0)}}
@media (max-width:560px){.acg-chip-arrow{transform:rotate(90deg)}}
@keyframes acgBeacon{0%,100%{opacity:1}50%{opacity:.15}}
.acg-beacon{animation:acgBeacon 1.4s ease-in-out infinite}
@keyframes acgPulse{0%{box-shadow:0 0 0 0 rgba(61,220,132,.55)}70%{box-shadow:0 0 0 12px rgba(61,220,132,0)}100%{box-shadow:0 0 0 0 rgba(61,220,132,0)}}
@keyframes acgBlinkRed{0%,60%,100%{opacity:.12}8%,26%{opacity:1}}
@keyframes acgBlinkGreen{0%,55%,100%{opacity:.18}18%,38%{opacity:1}}
@keyframes acgStrobe{0%,91%,100%{opacity:0}93%,96%{opacity:1}}
@keyframes acgPopIn{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
@keyframes acgFadeIn{from{opacity:0}to{opacity:1}}
@keyframes acgBounceY{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}

.acg-light-red,.acg-light-red-glow{animation:acgBlinkRed 2.2s infinite}
.acg-light-green,.acg-light-green-glow{animation:acgBlinkGreen 2.2s infinite .7s}
.acg-light-strobe{animation:acgStrobe 3.1s infinite}
.acg-star{animation:acgTwinkle 3.6s ease-in-out infinite}
.acg-plane-fly{animation:acgPlaneCross 36s linear infinite -6s;will-change:transform;filter:drop-shadow(0 18px 30px rgba(4,9,20,.45))}
.acg-plane-bob{animation:acgPlaneBob 6s ease-in-out infinite}
.acg-ship-sail{animation:acgShipCross 160s linear infinite -60s;will-change:transform;filter:drop-shadow(0 14px 24px rgba(4,9,20,.5))}
.acg-ship-bob{animation:acgShipBob 7s ease-in-out infinite}
.acg-cloud{position:absolute;will-change:transform;left:0}
.acg-cloud-a{animation:acgDrift 100s linear infinite}
.acg-cloud-b{animation:acgDrift 145s linear infinite;animation-delay:-70s}
.acg-cloud-c{animation:acgDrift 180s linear infinite;animation-delay:-130s}
.acg-wave{animation:acgWave 16s linear infinite;will-change:transform}
.acg-wave.slow{animation-duration:26s}
.acg-scrollhint{animation:acgBounceY 2.2s ease-in-out infinite}

/* ---------- hero ---------- */
.acg-hero{position:relative;min-height:100vh;min-height:100svh;overflow:hidden;display:flex;flex-direction:column;justify-content:center;background:linear-gradient(180deg,#050a15 0%,#0a1223 42%,#0e1a33 78%,#0a1223 100%)}
.acg-h1{font-size:clamp(2.5rem,10.5vw,4.9rem);font-weight:800;letter-spacing:-.02em;line-height:1.02;color:#fff;margin:0 0 18px}
.acg-hsub{font-size:clamp(1rem,4.2vw,1.25rem);color:rgba(226,237,250,.82);max-width:560px;margin:0 auto 30px}

/* ---------- botones ---------- */
.acg-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;border-radius:999px;font-weight:700;cursor:pointer;border:none;transition:transform .18s ease,box-shadow .18s ease,background .18s ease;min-height:52px}
.acg-btn:active{transform:scale(.97)}
.acg .acg-btn-primary{background:${BLUE};color:#fff;padding:15px 32px;font-size:17px;box-shadow:0 10px 30px rgba(59,125,216,.42)}
.acg-btn-primary:hover{transform:translateY(-2px);background:#4c8ce2;box-shadow:0 14px 38px rgba(59,125,216,.55)}
.acg .acg-btn-ghost{background:rgba(255,255,255,.07);color:#e8f1fb;border:1.5px solid rgba(141,185,234,.45);padding:14px 26px;font-size:16px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.acg-btn-ghost:hover{background:rgba(255,255,255,.14);border-color:rgba(141,185,234,.75)}
.acg-btn-light{background:#fff;color:${NAVY};padding:15px 32px;font-size:17px;box-shadow:0 10px 30px rgba(4,10,25,.35)}
.acg-btn-light:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(4,10,25,.45)}
.acg-chip{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22);color:#eaf2ff;padding:9px 16px;border-radius:999px;font-size:14px;font-weight:600;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);white-space:nowrap}

/* ---------- nav ---------- */
.acg-navlink{color:rgba(255,255,255,.85);font-weight:600;font-size:15px;background:none;border:none;cursor:pointer;padding:8px 2px;position:relative;transition:color .15s}
.acg-navlink:hover{color:#fff}
.acg-navlink::after{content:"";position:absolute;left:0;right:100%;bottom:2px;height:2px;background:${GOLD};transition:right .22s ease}
.acg-navlink:hover::after{right:0}
.acg-nav-links{display:none;align-items:center;gap:28px}
.acg-burger{display:flex;flex-direction:column;justify-content:center;gap:5px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:12px;width:44px;height:44px;align-items:center;cursor:pointer}
.acg-burger span{display:block;width:20px;height:2px;background:#fff;border-radius:2px;transition:transform .2s,opacity .2s}
.acg-burger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
.acg-burger.open span:nth-child(2){opacity:0}
.acg-burger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
@media(min-width:840px){.acg-nav-links{display:flex}.acg-burger{display:none}}
.acg-mmenu{position:fixed;top:72px;left:14px;right:14px;z-index:99;background:rgba(11,21,42,.96);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:14px;display:flex;flex-direction:column;gap:4px;animation:acgPopIn .22s ease;box-shadow:0 24px 60px rgba(2,6,16,.6)}
.acg-mmenu button,.acg-mmenu a{text-align:left;background:none;border:none;color:#eaf2ff;font-size:17px;font-weight:600;padding:14px 14px;border-radius:14px;cursor:pointer}
.acg-mmenu button:hover,.acg-mmenu a:hover{background:rgba(255,255,255,.08)}

/* ---------- en vivo ---------- */
.acg-live-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:13px}
@media(min-width:900px){.acg-live-grid{grid-template-columns:repeat(4,1fr)}}
.acg-live-card{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-radius:20px;padding:22px 16px;text-align:center;transition:transform .2s ease,background .2s ease}
@media (hover:hover){.acg-live-card:hover{transform:translateY(-4px);background:rgba(255,255,255,.14)}}

/* ---------- pasos / historicos ---------- */
.acg-steps-grid{display:grid;grid-template-columns:1fr;gap:18px}
@media(min-width:880px){.acg-steps-grid{grid-template-columns:repeat(3,1fr)}}
.acg-step-card{position:relative;z-index:1;background:#fff;border:1px solid #e2ecf8;border-radius:26px;padding:26px 24px;box-shadow:0 14px 36px rgba(21,45,84,.08);transition:transform .22s ease,box-shadow .22s ease}
@media (hover:hover){.acg-step-card:hover{transform:translateY(-6px);box-shadow:0 24px 50px rgba(21,45,84,.15)}}
.acg-hist-grid{display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:760px){.acg-hist-grid{grid-template-columns:repeat(3,1fr)}}
.acg-hist-card{background:#fff;border:1px solid #dfeaf7;border-radius:24px;padding:30px 22px;text-align:center;box-shadow:0 10px 30px rgba(21,45,84,.06)}

.acg-hero-cta{display:flex;flex-direction:column;gap:12px;width:100%;max-width:340px;margin:0 auto}
@media(min-width:640px){.acg-hero-cta{flex-direction:row;width:auto;max-width:none;justify-content:center}}
.acg-cta-row{display:flex;flex-direction:column;gap:12px;width:100%;max-width:340px;margin:0 auto}
@media(min-width:640px){.acg-cta-row{flex-direction:row;width:auto;max-width:none;justify-content:center}}

.acg-route-marker{position:absolute;left:0;top:0;z-index:2;pointer-events:none;will-change:transform;opacity:0;transition:opacity .3s ease}
.acg-wa-float{position:fixed;right:18px;bottom:18px;z-index:150;width:60px;height:60px;border-radius:50%;background:#25D366;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px rgba(37,211,102,.45);transition:transform .18s ease}
.acg-wa-float:hover{transform:scale(1.09)}

.acg-modal-back{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(5,10,22,.72);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);animation:acgFadeIn .2s ease}
.acg-modal{background:#fff;border-radius:28px;max-width:440px;width:100%;padding:34px 28px 28px;position:relative;animation:acgPopIn .26s ease;box-shadow:0 40px 90px rgba(2,6,16,.5)}
.acg-modal-x{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;border:none;background:#eef3fa;color:${NAVY};font-size:16px;cursor:pointer;transition:background .15s}
.acg-modal-x:hover{background:#dfe9f6}

.acg-foot-link{color:rgba(255,255,255,.7);transition:color .15s}
.acg-foot-link:hover{color:#fff}

@media (prefers-reduced-motion: reduce){
  .acg *{animation:none!important;transition:none!important}
  .acg-route-marker{display:none}
}
`;

/* ================================ PAGE ==================================== */
export default function Landing() {
  const [stats, setStats] = useState(FALLBACK);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);

  const heroPlaneRef = useRef(null);
  const heroTextRef = useRef(null);
  const journeyRef = useRef(null);
  const airPathRef = useRef(null);
  const seaPathRef = useRef(null);
  const airMaskRef = useRef(null);
  const seaMaskRef = useRef(null);
  const miniPlaneRef = useRef(null);
  const miniShipRef = useRef(null);
  const scrolledRef = useRef(false);

  /* redirect de auth de Supabase (obligatorio, tal cual) */
  useEffect(()=>{ if(typeof window==="undefined")return; const h=window.location.hash||""; const qs=window.location.search||""; const isRecoveryHash=h.includes("type=recovery")||h.includes("type=signup")||h.includes("access_token=")||h.includes("error="); const isErrorQs=qs.includes("error=")||qs.includes("error_code="); if(isRecoveryHash||isErrorQs){ window.location.replace("/portal"+qs+h); } },[]);

  /* stats en vivo */
  useEffect(() => {
    let alive = true;
    fetch("/api/landing-stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((j) => {
        if (alive && j && typeof j === "object") setStats({ ...FALLBACK, ...j });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* scroll: parallax del avión del hero + dibujo de la ruta + marcadores */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      if (airMaskRef.current) airMaskRef.current.style.strokeDashoffset = "0";
      if (seaMaskRef.current) seaMaskRef.current.style.strokeDashoffset = "0";
    }

    let raf = 0;
    // getTotalLength() es caro: cachearlo y recalcular solo en resize.
    let airLen = 0, seaLen = 0;
    const measure = () => {
      try { airLen = airPathRef.current ? airPathRef.current.getTotalLength() : 0; } catch (e) { airLen = 0; }
      try { seaLen = seaPathRef.current ? seaPathRef.current.getTotalLength() : 0; } catch (e) { seaLen = 0; }
    };
    measure();
    const update = () => {
      raf = 0;
      const y = window.scrollY || 0;
      const isScrolled = y > 40;
      if (isScrolled !== scrolledRef.current) {
        scrolledRef.current = isScrolled;
        setScrolled(isScrolled);
      }
      if (reduce) return;

      /* el avión del hero avanza y asciende con el scroll */
      if (heroPlaneRef.current) {
        heroPlaneRef.current.style.transform =
          "translate3d(" + y * 0.5 + "px," + -y * 0.24 + "px,0)";
      }
      if (heroTextRef.current) {
        heroTextRef.current.style.opacity = String(Math.max(0, 1 - y / 520));
        heroTextRef.current.style.transform = "translateY(" + y * 0.18 + "px)";
      }

      /* la ruta se dibuja con el scroll */
      const wrap = journeyRef.current;
      const airPath = airPathRef.current;
      const seaPath = seaPathRef.current;
      if (!wrap || !airPath || !seaPath) return;
      const r = wrap.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const prog = Math.max(0, Math.min(1, (vh * 0.55 - r.top) / (r.height * 0.96)));
      const seaProg = Math.max(0, Math.min(1, prog * 0.82));

      if (airMaskRef.current) airMaskRef.current.style.strokeDashoffset = String(1 - prog);
      if (seaMaskRef.current) seaMaskRef.current.style.strokeDashoffset = String(1 - seaProg);

      const sx = r.width / 100;
      const sy = r.height / 100;

      const planeEl = miniPlaneRef.current;
      if (planeEl && airLen > 0) {
        try {
          const L = airLen;
          const pt = airPath.getPointAtLength(L * prog);
          const pt2 = airPath.getPointAtLength(Math.min(L, L * prog + 1.5));
          const ang =
            (Math.atan2((pt2.y - pt.y) * sy, (pt2.x - pt.x) * sx) * 180) / Math.PI;
          planeEl.style.transform =
            "translate3d(" + pt.x * sx + "px," + pt.y * sy + "px,0) rotate(" + (ang + 90) + "deg)";
          planeEl.style.opacity = prog > 0.015 && prog < 0.99 ? "1" : "0";
        } catch (e) {}
      }
      const shipEl = miniShipRef.current;
      if (shipEl && seaLen > 0) {
        try {
          const L2 = seaLen;
          const pt = seaPath.getPointAtLength(L2 * seaProg);
          shipEl.style.transform =
            "translate3d(" + pt.x * sx + "px," + pt.y * sy + "px,0)";
          shipEl.style.opacity = seaProg > 0.015 && seaProg < 0.99 ? "1" : "0";
        } catch (e) {}
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => { measure(); onScroll(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* cerrar modal / menú con Escape */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setModal(null);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* con modal o menú abierto, la página de atrás no scrollea */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    if (modal || menuOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [modal, menuOpen]);

  const MODALS = {
    calc: {
      title: "Calculadora de importación",
      emoji: "🧮",
      body:
        "La calculadora pública está en camino. Por ahora vive adentro del portal: creá tu cuenta gratis y usala hoy. Tarda menos que cebar un mate.",
      cta: { label: "Crear cuenta", href: "/portal" },
    },
    academy: {
      title: "Argencargo Academy",
      emoji: "🎓",
      body:
        "Estamos grabando algo grande: todo lo que hay que saber para importar de China sin sufrir. Se cocina a fuego lento, como un buen asado.",
      cta: null,
    },
    full: {
      title: "Full Mercado Libre",
      emoji: "📦",
      body: "Tu carga directo al Full de Mercado Libre, sin escalas en tu living. Muy pronto.",
      cta: null,
    },
  };

  const openModal = (k) => {
    setMenuOpen(false);
    setModal(k);
  };

  const liveItems = [
    { icon: "✈️", value: stats.kg_en_el_aire, unit: " kg", label: "en el aire ahora mismo" },
    { icon: "🛫", value: stats.vuelos_en_transito, unit: "", label: "vuelos en tránsito" },
    { icon: "🚢", value: stats.m3_en_el_mar, unit: " m³", label: "navegando hacia acá" },
    { icon: "🛃", value: stats.ops_en_aduana, unit: "", label: "despachos en aduana" },
  ];

  const navBtn = (key, label) => (
    <button className="acg-navlink" onClick={() => openModal(key)}>
      {label}
    </button>
  );

  return (
    <div className="acg">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ============================= NAV ============================= */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: scrolled ? "rgba(7,13,27,.85)" : "transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
          boxShadow: scrolled ? "0 8px 30px rgba(2,6,16,.35)" : "none",
          transition: "background .25s ease, box-shadow .25s ease",
        }}
      >
        <div
          style={{
            maxWidth: 1140,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
          }}
        >
          <a href="/" aria-label="Argencargo">
            <img
              src={LOGO_WHITE}
              alt="Argencargo"
              style={{ height: 32, width: "auto", display: "block" }}
            />
          </a>

          <div className="acg-nav-links">
            {navBtn("calc", "Calculadora")}
            {navBtn("academy", "Academy")}
            {navBtn("full", "Full Mercado Libre")}
            <a
              className="acg-btn"
              href="/portal"
              style={{
                background: BLUE,
                color: "#fff",
                padding: "10px 22px",
                fontSize: 15,
                minHeight: 42,
              }}
            >
              Iniciar sesión
            </a>
          </div>

          <button
            className={"acg-burger" + (menuOpen ? " open" : "")}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="acg-mmenu">
          <button onClick={() => openModal("calc")}>Calculadora</button>
          <button onClick={() => openModal("academy")}>Academy</button>
          <button onClick={() => openModal("full")}>Full Mercado Libre</button>
          <a
            href="/portal"
            style={{
              background: BLUE,
              textAlign: "center",
              marginTop: 6,
              fontWeight: 700,
            }}
          >
            Iniciar sesión
          </a>
        </div>
      )}

      {/* ============================= HERO ============================= */}
      <header className="acg-hero">
        {/* estrellas */}
        <svg
          viewBox="0 0 100 60"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "62%" }}
          aria-hidden="true"
        >
          {STARS.map((s, i) => (
            <circle
              key={i}
              className="acg-star"
              cx={s.x}
              cy={s.y}
              r={s.r * 0.22}
              fill="#dbe7f8"
              style={{ animationDelay: s.d + "s", opacity: s.o }}
            />
          ))}
        </svg>

        {/* luna */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "9%",
            right: "10%",
            width: 74,
            height: 74,
            borderRadius: "50%",
            background: "radial-gradient(circle at 38% 35%, #f3f7fd 0%, #ccd9ec 60%, #aebfd8 100%)",
            boxShadow: "0 0 60px 18px rgba(200,220,250,.18)",
          }}
        />

        {/* nubes nocturnas */}
        <Cloud className="acg-cloud acg-cloud-a" style={{ top: "16%", width: "min(46vw,300px)" }} opacity={0.4} />
        <Cloud className="acg-cloud acg-cloud-b" style={{ top: "34%", width: "min(60vw,380px)" }} color="#1a2c50" opacity={0.55} />
        <Cloud className="acg-cloud acg-cloud-c" style={{ top: "7%", width: "min(34vw,220px)" }} color="#263d69" opacity={0.35} />

        {/* mar */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "17vh",
            background: "linear-gradient(180deg,#0c1a33 0%,#071021 100%)",
            zIndex: 2,
          }}
        />
        {/* puerto chino en el horizonte — de acá sale tu carga */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", right: 0, bottom: "calc(17vh - 4px)", width: "min(78vw,880px)", height: "min(24vh,200px)", zIndex: 2, opacity: 0.92 }}
        >
          <ChinaPort />
        </div>
        {/* ola trasera */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: 0, bottom: "calc(17vh - 14px)", width: "200%", zIndex: 2 }}
          className="acg-wave slow"
        >
          <svg viewBox="0 0 1200 40" preserveAspectRatio="none" style={{ width: "100%", height: 34, display: "block" }}>
            <path
              d="M0 22 Q75 8 150 22 T300 22 T450 22 T600 22 T750 22 T900 22 T1050 22 T1200 22 L1200 40 L0 40 Z"
              fill="#11224073"
            />
          </svg>
        </div>

        {/* barco navegando en el fondo */}
        <div
          aria-hidden="true"
          className="acg-ship-sail"
          style={{ position: "absolute", bottom: "6.5vh", left: 0, zIndex: 3, width: "min(58vw,400px)" }}
        >
          <div className="acg-ship-bob">
            <ContainerShip />
          </div>
        </div>

        {/* ola delantera (tapa el casco) */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: 0, bottom: "calc(17vh - 46px)", width: "200%", zIndex: 4 }}
          className="acg-wave"
        >
          <svg viewBox="0 0 1200 40" preserveAspectRatio="none" style={{ width: "100%", height: 46, display: "block" }}>
            <path
              d="M0 20 Q75 4 150 20 T300 20 T450 20 T600 20 T750 20 T900 20 T1050 20 T1200 20 L1200 40 L0 40 Z"
              fill="#0a1223"
            />
          </svg>
        </div>

        {/* contenido */}
        <div
          ref={heroTextRef}
          style={{
            position: "relative",
            zIndex: 6,
            textAlign: "center",
            padding: "140px 22px 22vh",
            maxWidth: 760,
            margin: "0 auto",
            willChange: "transform,opacity",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: 22,
            }}
          >
            <span className="acg-chip">🇨🇳 China · sur asiático</span>
            <span className="acg-chip-arrow" style={{ color: GOLD, fontSize: 22, lineHeight: 1 }} aria-hidden="true">
              ⟶
            </span>
            <span className="acg-chip">🇦🇷 Argentina</span>
          </div>

          <h1 className="acg-h1">
            De China,
            <br />
            <span style={{ color: "#8db9ea" }}>a tu puerta.</span>
          </h1>
          <p className="acg-hsub">
            Especialistas en traer tu carga desde China y el sur asiático hasta Argentina. Vos
            comprás. Nosotros hacemos el viaje.
          </p>

          <div className="acg-hero-cta">
            <a className="acg-btn acg-btn-primary" href="/portal">
              Crear cuenta gratis
            </a>
            <a className="acg-btn acg-btn-ghost" href={WA_URL} target="_blank" rel="noreferrer">
              <WaIcon size={18} />
              Consultá por WhatsApp
            </a>
          </div>

          <div
            className="acg-scrollhint"
            style={{ marginTop: 46, color: "rgba(214,229,247,.6)", fontSize: 14, fontWeight: 600 }}
          >
            ↓ Scrolleá para traer tu carga
          </div>
        </div>

        {/* avión de carga cruzando (pasa por delante de todo) */}
        <div
          ref={heroPlaneRef}
          aria-hidden="true"
          style={{ position: "absolute", top: "12vh", left: 0, right: 0, zIndex: 7, pointerEvents: "none", willChange: "transform" }}
        >
          <div className="acg-plane-fly">
            <div className="acg-plane-bob" style={{ width: "min(74vw,540px)" }}>
              <CargoPlane />
            </div>
          </div>
        </div>
      </header>

      {/* ==================== AMANECER + STATS EN VIVO ==================== */}
      <section
        style={{
          position: "relative",
          background:
            "linear-gradient(180deg,#0a1223 0%,#152D54 30%,#2e64ad 58%,#8db9ea 82%,#ffffff 100%)",
          padding: "88px 18px 130px",
          overflow: "hidden",
        }}
      >
        {/* sol amaneciendo */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: "4%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "70vw",
            maxWidth: 640,
            height: "34vh",
            background:
              "radial-gradient(closest-side, rgba(255,213,150,.55) 0%, rgba(255,213,150,0) 100%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: "#3ddc84",
                animation: "acgPulse 1.8s infinite",
                display: "inline-block",
              }}
            />
            <span
              style={{
                color: "#3ddc84",
                fontWeight: 800,
                letterSpacing: 3,
                fontSize: 13,
              }}
            >
              EN VIVO
            </span>
          </div>

          <h2
            style={{
              textAlign: "center",
              color: "#fff",
              fontSize: "clamp(1.7rem,6.4vw,2.7rem)",
              fontWeight: 800,
              letterSpacing: "-.01em",
              margin: "0 0 10px",
            }}
          >
            Esto está pasando ahora mismo
          </h2>
          <p
            style={{
              textAlign: "center",
              color: "rgba(226,237,250,.75)",
              margin: "0 auto 38px",
              maxWidth: 480,
              fontSize: 16,
            }}
          >
            Números reales, directo de nuestro sistema. Con decimales y todo, porque son de verdad.
          </p>

          <div className="acg-live-grid">
            {liveItems.map((it, i) => (
              <div key={i} className="acg-live-card">
                <div style={{ fontSize: 26, marginBottom: 6 }} aria-hidden="true">
                  {it.icon}
                </div>
                <div
                  style={{
                    color: "#fff",
                    fontSize: "clamp(1.5rem,5.6vw,2.1rem)",
                    fontWeight: 800,
                    letterSpacing: "-.01em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <CountUp value={it.value} />
                  <span style={{ fontSize: "0.6em", fontWeight: 700, opacity: 0.85 }}>{it.unit}</span>
                </div>
                <div style={{ color: "rgba(226,237,250,.78)", fontSize: 14, marginTop: 4, fontWeight: 600 }}>
                  {it.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== EL VIAJE (ruta dibujada con scroll) ============= */}
      <div ref={journeyRef} style={{ position: "relative" }}>
        {/* rutas aérea y marítima */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 0,
          }}
          aria-hidden="true"
        >
          <defs>
            <mask id="acgAirMask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
              <path
                ref={airMaskRef}
                d={AIR_D}
                pathLength="1"
                fill="none"
                stroke="#ffffff"
                strokeWidth="12"
                strokeDasharray="1"
                strokeDashoffset="1"
              />
            </mask>
            <mask id="acgSeaMask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
              <path
                ref={seaMaskRef}
                d={SEA_D}
                pathLength="1"
                fill="none"
                stroke="#ffffff"
                strokeWidth="12"
                strokeDasharray="1"
                strokeDashoffset="1"
              />
            </mask>
          </defs>

          {/* trazado tenue completo */}
          <path
            d={AIR_D}
            pathLength="1"
            fill="none"
            stroke={BLUE}
            strokeOpacity="0.14"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="0.011 0.011"
            strokeLinecap="round"
          />
          <path
            d={SEA_D}
            pathLength="1"
            fill="none"
            stroke={NAVY}
            strokeOpacity="0.1"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="0.004 0.016"
            strokeLinecap="round"
          />
          {/* progreso dibujado */}
          <path
            ref={airPathRef}
            d={AIR_D}
            pathLength="1"
            fill="none"
            stroke={BLUE}
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="0.011 0.011"
            strokeLinecap="round"
            mask="url(#acgAirMask)"
          />
          <path
            ref={seaPathRef}
            d={SEA_D}
            pathLength="1"
            fill="none"
            stroke="#6c8cbf"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="0.004 0.016"
            strokeLinecap="round"
            mask="url(#acgSeaMask)"
          />
        </svg>

        {/* marcadores que viajan con tu scroll */}
        <div ref={miniPlaneRef} className="acg-route-marker">
          <div style={{ transform: "translate(-50%,-50%)" }}>
            <MiniPlane />
          </div>
        </div>
        <div ref={miniShipRef} className="acg-route-marker">
          <div style={{ transform: "translate(-50%,-50%)" }}>
            <MiniShip />
          </div>
        </div>

        {/* -------------------- CÓMO FUNCIONA -------------------- */}
        <section style={{ background: "transparent", padding: "90px 18px 80px" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative", zIndex: 1 }}>
            <h2
              style={{
                textAlign: "center",
                fontSize: "clamp(1.8rem,6.6vw,2.8rem)",
                fontWeight: 800,
                letterSpacing: "-.01em",
                margin: "0 0 8px",
                color: NAVY,
              }}
            >
              ¿Cómo funciona?
            </h2>
            <div
              style={{
                width: 46,
                height: 4,
                borderRadius: 2,
                background: GOLD,
                margin: "0 auto 12px",
              }}
            />
            <p style={{ textAlign: "center", color: "#5c749a", margin: "0 auto 44px", maxWidth: 440, fontSize: 16 }}>
              Vos scrolleá tranquilo, que tu carga ya viene en camino.
            </p>

            <div className="acg-steps-grid">
              <div className="acg-step-card">
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 2,
                    color: BLUE,
                    background: "#eaf2fc",
                    borderRadius: 999,
                    padding: "6px 14px",
                  }}
                >
                  ESCALA 1 · CHINA
                </span>
                <div style={{ margin: "22px 0 14px" }}>
                  <StepBoxes />
                </div>
                <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: NAVY }}>
                  Comprás en China
                </h3>
                <p style={{ margin: 0, color: "#5c749a", fontSize: 15 }}>
                  Le pasás nuestra dirección de depósito a tu proveedor. Listo: el viaje ya empezó.
                </p>
              </div>

              <div className="acg-step-card">
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 2,
                    color: BLUE,
                    background: "#eaf2fc",
                    borderRadius: 999,
                    padding: "6px 14px",
                  }}
                >
                  ESCALA 2 · EN CAMINO
                </span>
                <div style={{ margin: "22px 0 14px" }}>
                  <StepTransit />
                </div>
                <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: NAVY }}>
                  Consolidamos y despegamos
                </h3>
                <p style={{ margin: 0, color: "#5c749a", fontSize: 15 }}>
                  Recibimos tu carga, la consolidamos y la subimos al avión o al barco. Vos seguís
                  todo desde el portal.
                </p>
              </div>

              <div className="acg-step-card">
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 2,
                    color: GOLD,
                    background: "#f7f1e8",
                    borderRadius: 999,
                    padding: "6px 14px",
                  }}
                >
                  DESTINO · ARGENTINA
                </span>
                <div style={{ margin: "22px 0 14px" }}>
                  <StepDoor />
                </div>
                <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: NAVY }}>
                  Te llega a tu puerta
                </h3>
                <p style={{ margin: 0, color: "#5c749a", fontSize: 15 }}>
                  Despachamos en aduana y te la llevamos hasta tu puerta. Sin vueltas.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------- ESPECIALISTAS EN CHINA -------------------- */}
        <section style={{ background: "#f2f7fd", padding: "84px 18px 90px" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative", zIndex: 1 }}>
            <h2
              style={{
                textAlign: "center",
                fontSize: "clamp(1.8rem,6.6vw,2.8rem)",
                fontWeight: 800,
                letterSpacing: "-.01em",
                margin: "0 0 8px",
                color: NAVY,
              }}
            >
              Especialistas en China 🇨🇳
            </h2>
            <div
              style={{ width: 46, height: 4, borderRadius: 2, background: GOLD, margin: "0 auto 12px" }}
            />
            <p style={{ textAlign: "center", color: "#5c749a", margin: "0 auto 42px", maxWidth: 460, fontSize: 16 }}>
              No lo decimos nosotros. Lo dicen los números.
            </p>

            <div className="acg-hist-grid">
              <div className="acg-hist-card">
                <div
                  style={{
                    fontSize: "clamp(2rem,8vw,2.9rem)",
                    fontWeight: 800,
                    color: NAVY,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-.01em",
                  }}
                >
                  <CountUp value={stats.kg_volados} />
                </div>
                <div style={{ color: BLUE, fontWeight: 700, marginTop: 6 }}>kg volados</div>
              </div>
              <div className="acg-hist-card">
                <div
                  style={{
                    fontSize: "clamp(2rem,8vw,2.9rem)",
                    fontWeight: 800,
                    color: NAVY,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-.01em",
                  }}
                >
                  <CountUp value={stats.vuelos_totales} />
                </div>
                <div style={{ color: BLUE, fontWeight: 700, marginTop: 6 }}>vuelos completados</div>
              </div>
              <div className="acg-hist-card">
                <div
                  style={{
                    fontSize: "clamp(2rem,8vw,2.9rem)",
                    fontWeight: 800,
                    color: NAVY,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-.01em",
                  }}
                >
                  <CountUp value={stats.importadores} />
                </div>
                <div style={{ color: BLUE, fontWeight: 700, marginTop: 6 }}>importadores confían en nosotros</div>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------- CTA FINAL (llegaste a destino) --------------- */}
        <section
          style={{
            position: "relative",
            background:
              "linear-gradient(180deg,#f2f7fd 0%,#b9d2ef 14%,#3f6db3 46%,#152D54 76%,#0a1223 100%)",
            padding: "110px 18px 0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: 720,
              margin: "0 auto",
              textAlign: "center",
              paddingBottom: 70,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 3,
                color: GOLD,
                background: "rgba(184,149,106,.14)",
                border: "1px solid rgba(184,149,106,.4)",
                borderRadius: 999,
                padding: "8px 18px",
              }}
            >
              📍 DESTINO FINAL · TU PUERTA
            </span>
            <h2
              style={{
                color: "#fff",
                fontSize: "clamp(2rem,8vw,3.4rem)",
                fontWeight: 800,
                letterSpacing: "-.02em",
                lineHeight: 1.06,
                margin: "22px 0 14px",
              }}
            >
              Tu próxima importación arranca acá.
            </h2>
            <p style={{ color: "rgba(226,237,250,.8)", fontSize: 17, margin: "0 auto 32px", maxWidth: 440 }}>
              Crear tu cuenta es gratis y tardás dos minutos. Después, el viaje lo hacemos nosotros.
            </p>
            <div className="acg-cta-row">
              <a className="acg-btn acg-btn-light" href="/portal">
                Crear cuenta gratis
              </a>
              <a className="acg-btn acg-btn-ghost" href={WA_URL} target="_blank" rel="noreferrer">
                <WaIcon size={18} />
                Escribinos
              </a>
            </div>
          </div>

          {/* skyline con Obelisco */}
          <div style={{ position: "relative", zIndex: 0, marginTop: 10 }}>
            <Skyline />
          </div>
        </section>
      </div>

      {/* ============================= FOOTER ============================= */}
      <footer style={{ background: "#060b18", color: "rgba(255,255,255,.75)", padding: "44px 22px 96px" }}>
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 22,
          }}
        >
          <img src={LOGO_WHITE} alt="Argencargo" style={{ height: 28, width: "auto", display: "block" }} />
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center", fontSize: 14, fontWeight: 600 }}>
            <a className="acg-foot-link" href={WA_URL} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <a className="acg-foot-link" href="/terminos">
              Términos y condiciones
            </a>
          </div>
        </div>
        <div
          style={{
            maxWidth: 1080,
            margin: "26px auto 0",
            borderTop: "1px solid rgba(255,255,255,.1)",
            paddingTop: 20,
            fontSize: 13,
            color: "rgba(255,255,255,.45)",
          }}
        >
          © {new Date().getFullYear()} Argencargo · China → Argentina, puerta a puerta.
        </div>
      </footer>

      {/* ======================= WHATSAPP FLOTANTE ======================= */}
      <a className="acg-wa-float" href={WA_URL} target="_blank" rel="noreferrer" aria-label="Consultar por WhatsApp">
        <WaIcon size={30} />
      </a>

      {/* ============================= MODAL ============================= */}
      {modal && MODALS[modal] && (
        <div className="acg-modal-back" onClick={() => setModal(null)}>
          <div
            className="acg-modal"
            role="dialog"
            aria-modal="true"
            aria-label={MODALS[modal].title}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="acg-modal-x" aria-label="Cerrar" onClick={() => setModal(null)}>
              ✕
            </button>
            <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden="true">
              {MODALS[modal].emoji}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 2.5,
                color: GOLD,
                background: "#f7f1e8",
                borderRadius: 999,
                padding: "6px 14px",
              }}
            >
              PRÓXIMAMENTE
            </span>
            <h3 style={{ margin: "16px 0 10px", fontSize: 24, fontWeight: 800, color: NAVY, letterSpacing: "-.01em" }}>
              {MODALS[modal].title}
            </h3>
            <p style={{ margin: "0 0 24px", color: "#5c749a", fontSize: 16, lineHeight: 1.6 }}>
              {MODALS[modal].body}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {MODALS[modal].cta && (
                <a className="acg-btn acg-btn-primary" href={MODALS[modal].cta.href} style={{ flex: "1 1 auto" }}>
                  {MODALS[modal].cta.label}
                </a>
              )}
              <button
                className="acg-btn"
                onClick={() => setModal(null)}
                style={{
                  background: "#eef3fa",
                  color: NAVY,
                  padding: "14px 24px",
                  fontSize: 16,
                  flex: MODALS[modal].cta ? "0 0 auto" : "1 1 auto",
                }}
              >
                {MODALS[modal].cta ? "Ahora no" : "Entendido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
