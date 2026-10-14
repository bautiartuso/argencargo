import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata = {
  title: { absolute: "Kairo" },
  description: "Físico, nutrición, finanzas y objetivos",
  manifest: "/kairo/manifest.webmanifest",
  // "black" (barra de la hora sólida) y no "black-translucent": con translucent, iOS 26 deja la
  // página 62pt más corta que la pantalla y no dibuja nada en esa franja de abajo.
  appleWebApp: { title: "Kairo", statusBarStyle: "black", capable: true },
};

export const viewport = {
  themeColor: "#0C0D10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function KairoLayout({ children }) {
  return <div className={`${inter.className} k-root`}>{children}</div>;
}
