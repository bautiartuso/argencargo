import './globals.css';
import Script from 'next/script';
import Consent from './components/Consent';

const SITE_URL = 'https://www.argencargo.com.ar';
// OG image dinámica generada por app/opengraph-image.js (Next 14 auto-detecta).
// Mantenemos esta var para retro-compat por si en el futuro se quiere forzar un PNG estático.

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Argencargo — Importaciones desde China a Argentina | Courier Aéreo y Marítimo',
    template: '%s | Argencargo',
  },
  description: 'Importá desde China con courier aéreo (8-12 días), carga aérea o marítimo. Seguimiento en tiempo real, despacho de aduana y entrega puerta a puerta en Argentina. Cotizá online.',
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
    title: 'Argencargo — Importaciones desde China a Argentina',
    description: 'Courier aéreo, carga aérea y marítimo. Seguimiento en tiempo real y entrega puerta a puerta.',
    url: SITE_URL,
    siteName: 'Argencargo',
    type: 'website',
    locale: 'es_AR',
    // images: omitido a propósito → Next usa app/opengraph-image.js dinámica
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Argencargo — Importaciones desde China a Argentina',
    description: 'Courier aéreo, carga aérea y marítimo. Seguimiento en tiempo real y entrega puerta a puerta.',
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
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>{children}<Consent /></body>
    </html>
  );
}
