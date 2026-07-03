// OG image chica y prolija para el link de "carga lista". Sin esto, WhatsApp cae al ícono
// grande del sitio (favicon/apple-icon) y lo estira ocupando toda la card — peor que tener
// una imagen propia. Logo chico arriba a la izquierda, nada más — sin foto, sin texto gigante.

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
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          background: '#0A1628',
        }}
      >
        <img src={LOGO_WHITE} alt="Argencargo" width="180" height="49" style={{ display: 'flex' }} />
      </div>
    ),
    { ...size }
  );
}
