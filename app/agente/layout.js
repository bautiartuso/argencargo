export const metadata = {
  title: "Argencargo — 代理门户",
  manifest: "/manifest-agente.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Argencargo Agente",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "512x512" }],
    shortcut: "/icon.png",
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
