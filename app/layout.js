import './globals.css';
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
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
