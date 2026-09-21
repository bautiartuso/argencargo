// ARGENMAQ vive dentro del proyecto de Argencargo pero es otra marca y otro host.
// Este layout corta la herencia del layout raíz: canonical, OpenGraph, Twitter e íconos
// propios. Sin esto, la landing de ARGENMAQ declaraba canonical a argencargo.com.ar
// (Google la leía como duplicado) y se compartía con el título y el logo de Argencargo.
import { AM_URL } from "./_marca";

const TITULO = "ARGENMAQ — Maquinaria de China, puesta en tu puerta";
const DESC =
  "Elegís la máquina, ves el precio final con flete e impuestos en Argentina, y nosotros hacemos todo lo demás: fábrica, control, importación y entrega. Una empresa del grupo Argencargo.";

export const metadata = {
  metadataBase: new URL(AM_URL),
  title: { absolute: TITULO },
  description: DESC,
  applicationName: "ARGENMAQ",
  alternates: { canonical: AM_URL },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: AM_URL,
    siteName: "ARGENMAQ",
    title: TITULO,
    description: DESC,
  },
  twitter: { card: "summary_large_image", title: TITULO, description: DESC },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: {
    icon: [{ url: "/argenmaq/favicon-64.png", type: "image/png", sizes: "64x64" }, { url: "/argenmaq/icon-512.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/argenmaq/apple-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/argenmaq/favicon-64.png",
  },
};

export default function ArgenmaqLayout({ children }) {
  return children;
}
