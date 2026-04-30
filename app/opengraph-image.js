// OG image dinámica generada en edge.
// Reemplaza /og-image.png con un diseño denso, sin huecos blancos,
// optimizado para previews de WhatsApp / Instagram / Twitter.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Argencargo — Importaciones desde China y USA a Argentina';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background:
            'radial-gradient(ellipse at top right, #1F3055 0%, #0A1628 60%, #050B17 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 80px',
          fontFamily: 'sans-serif',
          color: '#fff',
          position: 'relative',
        }}
      >
        {/* Banda dorada decorativa arriba */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background:
              'linear-gradient(90deg, #B8956A 0%, #D4B17A 50%, #B8956A 100%)',
          }}
        />

        {/* Marca grande */}
        <div
          style={{
            fontSize: 110,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            background:
              'linear-gradient(135deg, #D4B17A 0%, #B8956A 50%, #8B6F45 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            lineHeight: 1,
            marginBottom: 24,
          }}
        >
          ARGENCARGO
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 38,
            fontWeight: 600,
            color: '#fff',
            textAlign: 'center',
            lineHeight: 1.2,
            marginBottom: 12,
            letterSpacing: '-0.01em',
          }}
        >
          Importaciones desde China y USA a Argentina
        </div>

        {/* Subtagline */}
        <div
          style={{
            fontSize: 24,
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'center',
            marginBottom: 50,
          }}
        >
          Cotizá online · Seguimiento en tiempo real · Entrega puerta a puerta
        </div>

        {/* Servicios */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            padding: '14px 32px',
            background: 'rgba(184,149,106,0.1)',
            border: '1.5px solid rgba(184,149,106,0.3)',
            borderRadius: 12,
            fontSize: 26,
            fontWeight: 600,
            color: '#D4B17A',
          }}
        >
          <span>Courier</span>
          <span style={{ color: 'rgba(184,149,106,0.4)' }}>·</span>
          <span>Carga Aérea</span>
          <span style={{ color: 'rgba(184,149,106,0.4)' }}>·</span>
          <span>Marítimo</span>
          <span style={{ color: 'rgba(184,149,106,0.4)' }}>·</span>
          <span>Aduana</span>
        </div>

        {/* URL footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 38,
            fontSize: 22,
            color: 'rgba(255,255,255,0.4)',
            fontWeight: 500,
            letterSpacing: '0.05em',
          }}
        >
          argencargo.com.ar
        </div>
      </div>
    ),
    { ...size }
  );
}
