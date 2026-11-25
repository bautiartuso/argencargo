// Título de la pestaña del CRM (25/11/2026): antes heredaba el del sitio público ("Argencargo — Importá desde China").
export const metadata = {
  title: { absolute: "ARGENCARGO | CRM" },
  robots: { index: false, follow: false },
};

export default function CrmLayout({ children }) {
  return children;
}
