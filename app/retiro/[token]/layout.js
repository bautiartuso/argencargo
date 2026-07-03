// Server component (sin "use client") — la página en sí es client component, así que la metadata
// va acá. La imagen de OG/Twitter la genera opengraph-image.js (misma carpeta), chica y prolija —
// si no defino una, WhatsApp cae al ícono grande del sitio y lo estira (peor que no tener nada).
export const metadata = {
  title: "Tu carga está lista — Argencargo",
  description: "Confirmá cómo la recibís y cómo pagás.",
  openGraph: {
    title: "Tu carga está lista — Argencargo",
    description: "Confirmá cómo la recibís y cómo pagás.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tu carga está lista — Argencargo",
    description: "Confirmá cómo la recibís y cómo pagás.",
  },
};

export default function RetiroLayout({ children }) {
  return children;
}
