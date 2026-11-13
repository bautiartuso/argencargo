// App de los repartidores (13/11/2026). Cada uno entra con su link y la instala en el teléfono:
// el manifest sale por link para que el ícono de la pantalla de inicio abra su propio reparto.
export function generateMetadata({ params }) {
  return {
    title: "Reparto",
    description: "Hoja de ruta de los repartos",
    manifest: `/reparto/${params.token}/manifest.webmanifest`,
    robots: { index: false, follow: false },
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Reparto" },
    icons: { icon: [{ url: "/reparto-icon.png", type: "image/png", sizes: "512x512" }], apple: [{ url: "/reparto-icon.png", type: "image/png", sizes: "512x512" }] },
  };
}

export const viewport = { themeColor: "#F3F4F6", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover" };

export default function RepartoLayout({ children }) {
  return children;
}
