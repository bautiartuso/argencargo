import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata = {
  title: { absolute: "Kairo" },
  description: "Físico, nutrición, finanzas y objetivos",
  manifest: "/kairo/manifest.webmanifest",
  // "black" y no "black-translucent": con translucent el iPhone (iOS 26) dejaba la página 62pt más
  // corta que la pantalla y la barra de abajo quedaba flotando sobre una franja muerta.
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
  return <div className={inter.className}>{children}</div>;
}
