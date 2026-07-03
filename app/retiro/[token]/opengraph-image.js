// OG image específica para el link de "carga lista" — reemplaza la foto de marketing del
// sitio general (contenedores + tagline) por una tarjeta simple y acorde al contenido real
// del link: no es una landing, es un aviso de que la carga está lista para confirmar.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Tu carga está lista — Argencargo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const LOGO_WHITE =
  'https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: '#fff',
          background: '#0A1628',
        }}
      >
        {/* Banda dorada arriba */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 80px' }}>
          <img src={LOGO_WHITE} alt="Argencargo" width="240" height="65" style={{ marginBottom: 44 }} />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              fontSize: 60,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              marginBottom: 18,
            }}
          >
            <span>📦</span>
            <span>Tu carga está lista</span>
          </div>

          <div style={{ display: 'flex', fontSize: 26, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
            Confirmá cómo la recibís y cómo pagás
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 38,
            right: 72,
            fontSize: 18,
            color: '#E8D098',
            fontWeight: 600,
            letterSpacing: '0.06em',
            display: 'flex',
          }}
        >
          argencargo.com.ar
        </div>
      </div>
    ),
    { ...size }
  );
}
