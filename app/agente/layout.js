export const metadata = {
  title: "Argencargo — 代理门户",
  manifest: "/manifest-agente.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Argencargo Agente",
  },
  icons: {
    apple: [{ url: "/apple-icon-pwa.png", sizes: "512x512" }],
    icon: [{ url: "/icon-pwa.png", sizes: "512x512" }],
  },
};

export const viewport = {
  themeColor: "#0F1E3D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AgenteLayout({ children }) {
  return children;
}
