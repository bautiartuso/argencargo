import './globals.css';
export const metadata = { title: 'Argencargo - Portal', description: 'Soluciones integrales de comercio exterior' };
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
