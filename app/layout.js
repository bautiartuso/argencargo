import './globals.css';
import Script from 'next/script';

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
        {/* Structured data: Organization (ayuda a Google a mostrar el logo y datos) */}
        <Script id="ld-organization" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Argencargo',
            legalName: 'Argencargo',
            url: 'https://www.argencargo.com.ar',
            logo: 'https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png',
            image: 'https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png',
            description: 'Empresa argentina de importaciones desde China y USA. Courier aéreo, carga aérea consolidada y marítimo LCL/FCL con despacho de aduana y entrega puerta a puerta.',
            foundingDate: '2020',
            address: {
              '@type': 'PostalAddress',
              streetAddress: 'Av. Callao 1137',
              addressLocality: 'Recoleta',
              addressRegion: 'CABA',
              addressCountry: 'AR',
            },
            contactPoint: {
              '@type': 'ContactPoint',
              telephone: '+54-9-11-2508-8580',
              contactType: 'customer service',
              email: 'info@argencargo.com.ar',
              availableLanguage: ['Spanish','English'],
            },
            sameAs: [
              'https://www.instagram.com/argencargo',
              'https://wa.me/5491125088580',
            ],
          })}
        </Script>
        <Script id="ld-website" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            url: 'https://www.argencargo.com.ar',
            name: 'Argencargo',
            inLanguage: 'es-AR',
          })}
        </Script>
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
