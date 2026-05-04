export async function generateMetadata({ params }) {
  const code = (params.code || "").toUpperCase();
  return {
    title: `Seguimiento ${code} — Argencargo`,
    description: `Estado de la importación ${code}. Seguimiento en tiempo real de Argencargo.`,
    openGraph: {
      title: `Seguimiento ${code}`,
      description: "Estado de la importación en Argencargo.",
      type: "website",
    },
  };
}

export default function TrackLayout({ children }) {
  return children;
}
