// Server component (sin "use client") — la página en sí es client component, así que la metadata
// para desactivar la imagen heredada del sitio general (foto de contenedores) va acá.
// Sin imagen: el preview de WhatsApp muestra solo título + descripción + link, sin card de foto.
export const metadata = {
  title: "Tu carga está lista — Argencargo",
  description: "Confirmá cómo la recibís y cómo pagás.",
  openGraph: {
    title: "Tu carga está lista — Argencargo",
    description: "Confirmá cómo la recibís y cómo pagás.",
    images: [],
  },
  twitter: {
    card: "summary",
    title: "Tu carga está lista — Argencargo",
    description: "Confirmá cómo la recibís y cómo pagás.",
    images: [],
  },
};

export default function RetiroLayout({ children }) {
  return children;
}
