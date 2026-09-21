"use client";
// Banner de cookies + carga condicionada de los pixeles.
//
// Regla: GA4, Meta Pixel y Google Ads SÓLO se cargan si el visitante acepta.
// Mientras no haya decisión no se dispara ningún script de terceros, así que el
// sitio arranca sin cookies de tracking (que es lo que pide la normativa y lo que
// evita el problema de tener el pixel puesto sin aviso).
//
// La decisión se guarda en localStorage:
//   "all"       → acepta analítica y publicidad
//   "essential" → sólo lo imprescindible (sesión del portal)
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const KEY = "ac_cookie_consent";

// El aviso es para el sitio público, donde hay medición. En los paneles internos
// (admin, portal del cliente, agentes, ARGENMAQ) no se carga ningún pixel, así que
// preguntar ahí es puro ruido: se le pedía consentimiento al propio equipo.
const PRIVADAS = [
  "/admin", "/portal", "/agente", "/gi", "/cinabrio", "/feedback",
  "/track", "/retiro", "/factura", "/presupuesto", "/cotizacion", "/ccfinanciera", "/cc/",
];

function esPrivada(pathname) {
  if (!pathname) return false;
  return PRIVADAS.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/"));
}

// Cada marca mide en su propia propiedad: mezclar el tráfico de ARGENMAQ con el de
// Argencargo en un mismo GA4 no sirve para decidir nada.
// (Si las de ARGENMAQ no están seteadas, no se carga nada: no hereda las de Argencargo.)
const IDS = {
  argencargo: {
    pixel: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    ads: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    gtag: process.env.NEXT_PUBLIC_GTAG_ID,
  },
  argenmaq: {
    pixel: process.env.NEXT_PUBLIC_META_PIXEL_ID_ARGENMAQ,
    ads: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID_ARGENMAQ,
    gtag: process.env.NEXT_PUBLIC_GTAG_ID_ARGENMAQ,
  },
};

const NAVY = "#152D54";
const AC = "#3B7DD8";

// Dos marcas, dos avisos. Mismo componente, mismo consentimiento guardado.
const TEMAS = {
  argencargo: {
    fondo: "rgba(10,18,35,0.97)",
    borde: `1px solid ${AC}33`,
    texto: "rgba(255,255,255,0.8)",
    link: AC,
    fuente: "'Inter',system-ui,-apple-system,sans-serif",
    secundario: { background: "transparent", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.85)" },
    principal: { border: "none", background: `linear-gradient(135deg,${AC},${NAVY})`, color: "#fff" },
  },
  argenmaq: {
    fondo: "rgba(255,255,255,0.98)",
    borde: "1px solid #E6E7EA",
    texto: "#3d4147",
    link: "#15171A",
    fuente: "'Manrope',ui-sans-serif,system-ui,sans-serif",
    secundario: { background: "#fff", border: "1px solid #E6E7EA", color: "#15171A" },
    principal: { border: "1px solid #FFD200", background: "#FFD200", color: "#15171A" },
  },
};

export default function Consent() {
  // null = todavía no leímos localStorage (no mostramos nada para no pisar el hero)
  const [decision, setDecision] = useState(undefined);
  const [esArgenmaq, setEsArgenmaq] = useState(false);
  const [linkPriv, setLinkPriv] = useState("/privacidad");
  const pathname = usePathname();

  useEffect(() => {
    // ARGENMAQ vive en el mismo proyecto con otro host: ahí el aviso tiene que
    // hablar de ARGENMAQ y linkear a SU política, no a la de Argencargo.
    // Por host (argenmaq.*) y también por ruta, porque /argenmaq se puede abrir
    // directo desde el dominio de Argencargo.
    try {
      const porHost = /(^|\.)argenmaq\./i.test(window.location.hostname);
      const porRuta = window.location.pathname.startsWith("/argenmaq");
      setEsArgenmaq(porHost || porRuta);
      // En el host de ARGENMAQ la política vive en /privacidad; si se abre /argenmaq
      // desde el dominio de Argencargo, hay que ir a /argenmaq/privacidad.
      setLinkPriv(porRuta && !porHost ? "/argenmaq/privacidad" : "/privacidad");
    } catch {}
  }, []);

  useEffect(() => {
    let v = null;
    try {
      v = localStorage.getItem(KEY);
    } catch {}
    setDecision(v === "all" || v === "essential" ? v : null);
  }, []);

  const decidir = (v) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {}
    setDecision(v);
  };

  const privada = esPrivada(pathname);
  const tema = esArgenmaq ? TEMAS.argenmaq : TEMAS.argencargo;
  const { pixel: META_PIXEL_ID, ads: GOOGLE_ADS_ID, gtag: GTAG_ID } = esArgenmaq ? IDS.argenmaq : IDS.argencargo;
  const acepta = decision === "all" && !privada;
  const mostrarBanner = decision === null && !privada;

  return (
    <>
      {acepta && META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}
      {acepta && (GTAG_ID || GOOGLE_ADS_ID) && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID || GOOGLE_ADS_ID}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());${GTAG_ID ? `gtag('config','${GTAG_ID}');` : ""}${GOOGLE_ADS_ID ? `gtag('config','${GOOGLE_ADS_ID}');` : ""}`}
          </Script>
        </>
      )}

      {mostrarBanner && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Aviso de cookies"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            padding: "14px 16px calc(14px + env(safe-area-inset-bottom))",
            background: tema.fondo,
            backdropFilter: "blur(16px)",
            borderTop: tema.borde,
            boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
            fontFamily: tema.fuente,
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              display: "flex",
              gap: 14,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: tema.texto, flex: "1 1 280px" }}>
              {esArgenmaq
                ? "Usamos cookies propias para que funcione el sitio y, si nos dejás, cookies de medición para entender cómo llegaste. Podés elegir. "
                : "Usamos cookies propias para que funcione el portal y, si nos dejás, cookies de medición para entender cómo llegaste. Podés elegir. "}
              <a href={linkPriv} style={{ color: tema.link, textDecoration: "underline" }}>
                Política de privacidad
              </a>
            </p>
            <div style={{ display: "flex", gap: 10, flex: "0 0 auto", width: "100%", maxWidth: 360 }}>
              <button
                onClick={() => decidir("essential")}
                style={{ flex: 1, padding: "11px 16px", fontSize: 13, fontWeight: 600, borderRadius: 10, cursor: "pointer", ...tema.secundario }}
              >
                Solo esenciales
              </button>
              <button
                onClick={() => decidir("all")}
                style={{ flex: 1, padding: "11px 16px", fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: "pointer", ...tema.principal }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
