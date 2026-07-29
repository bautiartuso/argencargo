// OG image dinámica generada en edge: la que se ve al compartir el link por WhatsApp.
// Solo el logo sobre el navy de la marca. Nada de fotos de stock ni taglines: antes traía una
// foto de contenedores de Unsplash, que no es nuestra y no representa nada real de la empresa.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Argencargo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const LOGO =
  'https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A1628',
        }}
      >
        <img src={LOGO} alt="Argencargo" width="520" height="141" />
      </div>
    ),
    { ...size }
  );
}
