// OG image dinámica generada en edge.
// Diseño: foto de logística (avión cargo / contenedores) + overlay navy
// + logo Argencargo. Estilo FedEx/Maersk: serio, no template AI.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Argencargo — Importaciones desde China y USA a Argentina';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Foto de fondo: cargo plane being loaded at sunset/golden hour
// Unsplash, royalty-free. Si querés cambiarla, reemplazá esta URL.
const BG_PHOTO =
  'https://images.unsplash.com/photo-1494412651409-8963ce7935a7?w=1600&h=900&fit=crop&q=85';

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
          justifyContent: 'flex-end',
          fontFamily: 'sans-serif',
          color: '#fff',
          background: '#0A1628',
        }}
      >
        {/* Foto de fondo */}
        <img
          src={BG_PHOTO}
          alt=""
          width="1200"
          height="630"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Overlay navy gradient — más oscuro abajo donde va el texto */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(10,22,40,0.55) 0%, rgba(10,22,40,0.78) 55%, rgba(10,22,40,0.96) 100%)',
            display: 'flex',
          }}
        />

        {/* Banda dorada arriba */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background:
              'linear-gradient(90deg, #B8956A 0%, #E8D098 50%, #B8956A 100%)',
            display: 'flex',
          }}
        />

        {/* Contenido — alineado abajo a la izquierda como un poster */}
        <div
          style={{
            position: 'relative',
            padding: '0 72px 60px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Logo Argencargo */}
          <img
            src={LOGO_WHITE}
            alt="Argencargo"
            width="280"
            height="76"
            style={{ marginBottom: 28 }}
          />

          {/* Tagline */}
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              maxWidth: 920,
              marginBottom: 16,
              display: 'flex',
            }}
          >
            Tu importación desde China y USA, simple.
          </div>

          {/* Subtagline */}
          <div
            style={{
              fontSize: 24,
              color: 'rgba(255,255,255,0.78)',
              fontWeight: 500,
              maxWidth: 800,
              display: 'flex',
            }}
          >
            Cotizá online · Despacho aduanero · Entrega puerta a puerta
          </div>
        </div>

        {/* URL discreta esquina inferior derecha */}
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
