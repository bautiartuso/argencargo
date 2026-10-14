import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });

export const metadata = {
  title: { absolute: "Kairo" },
  description: "Físico, nutrición, finanzas y objetivos",
  manifest: "/kairo/manifest.webmanifest",
  appleWebApp: { title: "Kairo", statusBarStyle: "black-translucent", capable: true },
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
