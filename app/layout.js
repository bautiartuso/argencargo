import './globals.css';
import Script from 'next/script';
import Consent from './components/Consent';

const SITE_URL = 'https://www.argencargo.com.ar';
// OG image dinámica generada por app/opengraph-image.js (Next 14 auto-detecta).
// Mantenemos esta var para retro-compat por si en el futuro se quiere forzar un PNG estático.

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Argencargo — Importá desde China a Argentina',
    template: '%s | Argencargo',
  },
  description: 'Importaciones desde China a Argentina. Flete aéreo y marítimo, despacho de aduana y seguimiento en tiempo real.',
  keywords: ['importar desde china','courier china argentina','importaciones china','flete china argentina','envio china argentina','courier aereo china','importar usa argentina','aduana importacion','argencargo'],
  authors: [{ name: 'Argencargo' }],
  applicationName: 'Argencargo',
  referrer: 'origin-when-cross-origin',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-icon.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/icon.png',
  },
  openGraph: {
    title: 'Argencargo — Importá desde China a Argentina',
    description: 'Importaciones desde China a Argentina. Flete aéreo y marítimo, despacho de aduana y seguimiento en tiempo real.',
    url: SITE_URL,
    siteName: 'Argencargo',
    type: 'website',
    locale: 'es_AR',
    // images: omitido a propósito → Next usa app/opengraph-image.js dinámica
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Argencargo — Importá desde China a Argentina',
    description: 'Importaciones desde China a Argentina. Flete aéreo y marítimo, despacho de aduana y seguimiento en tiempo real.',
    // images omitido → Next usa app/twitter-image.js o cae al opengraph-image.js
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    google: 'b64cfF5lMz8RE8zQ3T3hC_Ifh2fBcMPETvnbNA7J3jg',
  },
};

// Viewport responsive (mobile-aware). En Next 14 App Router va separado de metadata.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"/>
        {/* El JSON-LD de la empresa NO va acá: este layout lo comparten Argencargo,
            ARGENMAQ y los paneles. Cada landing publica el suyo (app/page.js y
            app/argenmaq/page.js), si no ARGENMAQ salía declarando ser Argencargo. */}
        {/* Evitar que el scroll del mouse cambie valores en inputs numéricos.
            Si el cliente escrolea con el mouse encima de un input number, el browser
            cambiaba el valor → bug confuso (cantidades/precios cambiaban sin que se diera cuenta).
            Solución: si el input numérico tiene foco al hacer scroll, lo deselecciono. */}
        <Script id="prevent-number-scroll" strategy="afterInteractive">
          {`document.addEventListener("wheel",function(e){if(document.activeElement&&document.activeElement.type==="number"){document.activeElement.blur();}},{passive:true});`}
        </Script>
        {/* Enter salta a la casilla siguiente (Shift+Enter, a la anterior) en todo el sistema (21/10/2026).
            Reglas para no romper nada: no toca textareas; no toca campos que ya manejan sus teclas
            (chat que manda con Enter, buscadores que eligen con Enter, montos que confirman con Enter);
            no toca el último campo (si está en un form, Enter lo envía como siempre). El salto se queda
            dentro del modal abierto (contenedor fijo) o del form; si no hay, recorre la página.
            data-campo marca botones que cuentan como casilla (los desplegables propios);
            data-enter-libre desactiva el salto en una zona. */}
        <Script id="enter-siguiente-campo" strategy="afterInteractive">
          {`(function(){var F='input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=submit]):not([type=button]):not([type=range]):not([type=color]):not([type=reset]),select';var T=F+',[data-campo]';function vis(el){if(!(el.offsetWidth||el.offsetHeight||el.getClientRects().length))return false;var cs=getComputedStyle(el);return cs.visibility!=="hidden"&&cs.display!=="none";}function rp(el){for(var k in el){if(k.indexOf("__reactProps$")===0)return el[k];}return null;}function scope(el){var n=el.parentElement;while(n&&n!==document.body){if(n.matches("form,[data-enter-scope],[role=dialog]"))return n;if(getComputedStyle(n).position==="fixed")return n;n=n.parentElement;}return document.body;}document.addEventListener("keydown",function(e){if(e.key!=="Enter"||e.defaultPrevented||e.isComposing||e.keyCode===229||e.ctrlKey||e.metaKey||e.altKey)return;var t=e.target;if(!t||!t.matches||!t.matches(F))return;if(t.closest("[data-enter-libre]"))return;var p=rp(t);if(p&&(p.onKeyDown||p.onKeyPress||p.onKeyUp))return;var sc=scope(t);var l=[].slice.call(sc.querySelectorAll(T)).filter(function(el){return !el.disabled&&!el.readOnly&&el.tabIndex!==-1&&!el.closest("[data-enter-libre]")&&vis(el);});var i=l.indexOf(t);if(i<0)return;var j=e.shiftKey?i-1:i+1;if(j<0||j>=l.length)return;e.preventDefault();var n=l[j];n.focus();try{if(n.select&&n.tagName==="INPUT"&&/^(text|search|tel|url|email|number|password)?$/.test(n.getAttribute("type")||""))n.select();}catch(_){}} );})();`}
        </Script>
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>{children}<Consent /></body>
    </html>
  );
}
