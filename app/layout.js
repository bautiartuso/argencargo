import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'Argencargo — Importaciones desde China a Argentina | Courier Aéreo y Marítimo',
  description: 'Importá desde China con courier aéreo (8-12 días), carga aérea o marítimo. Seguimiento en tiempo real, despacho de aduana y entrega puerta a puerta en Argentina. Cotizá online.',
  keywords: 'importar desde china, courier china argentina, importaciones china, flete china argentina, envio china argentina, courier aereo china',
  openGraph: {
    title: 'Argencargo — Importaciones desde China a Argentina',
    description: 'Courier aéreo, carga aérea y marítimo. Seguimiento en tiempo real y entrega puerta a puerta.',
    url: 'https://www.argencargo.com.ar',
    siteName: 'Argencargo',
    type: 'website',
  },
};

// Viewport responsive (mobile-aware). En Next 14 App Router va separado de metadata.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// Pixels de retargeting. Setear los IDs como env vars en Vercel:
//   NEXT_PUBLIC_META_PIXEL_ID    → Meta/Facebook Pixel
//   NEXT_PUBLIC_GOOGLE_ADS_ID    → Google Ads Conversion ID (formato AW-XXXXXXXXX)
//   NEXT_PUBLIC_GTAG_ID          → Google Analytics 4 Measurement ID (formato G-XXXXXXXXX)
// Si alguna env var está vacía, el pixel NO se carga (silent no-op).
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const GTAG_ID = process.env.NEXT_PUBLIC_GTAG_ID;

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"/>
        {META_PIXEL_ID && (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
          </Script>
        )}
        {(GTAG_ID || GOOGLE_ADS_ID) && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID || GOOGLE_ADS_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());${GTAG_ID ? `gtag('config','${GTAG_ID}');` : ''}${GOOGLE_ADS_ID ? `gtag('config','${GOOGLE_ADS_ID}');` : ''}`}
            </Script>
          </>
        )}
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>{children}</body>
    </html>
  );
}
