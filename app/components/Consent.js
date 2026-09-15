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
import Script from "next/script";

const KEY = "ac_cookie_consent";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const GTAG_ID = process.env.NEXT_PUBLIC_GTAG_ID;

const NAVY = "#152D54";
const AC = "#3B7DD8";

export default function Consent() {
  // null = todavía no leímos localStorage (no mostramos nada para no pisar el hero)
  const [decision, setDecision] = useState(undefined);

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

  const acepta = decision === "all";
  const mostrarBanner = decision === null;

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
            background: "rgba(10,18,35,0.97)",
            backdropFilter: "blur(16px)",
            borderTop: `1px solid ${AC}33`,
            boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
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
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,0.8)", flex: "1 1 280px" }}>
              Usamos cookies propias para que funcione el portal y, si nos dejás, cookies de medición para entender cómo
              llegaste. Podés elegir.{" "}
              <a href="/privacidad" style={{ color: AC, textDecoration: "underline" }}>
                Política de privacidad
              </a>
            </p>
            <div style={{ display: "flex", gap: 10, flex: "0 0 auto", width: "100%", maxWidth: 360 }}>
              <button
                onClick={() => decidir("essential")}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 10,
                  cursor: "pointer",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                Solo esenciales
              </button>
              <button
                onClick={() => decidir("all")}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 10,
                  cursor: "pointer",
                  border: "none",
                  background: `linear-gradient(135deg,${AC},${NAVY})`,
                  color: "#fff",
                }}
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
