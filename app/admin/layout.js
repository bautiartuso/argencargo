export const metadata = {
  title: "Argencargo — Admin",
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AC Admin",
  },
  icons: {
    apple: [{ url: "/apple-icon-pwa.png", sizes: "512x512" }],
    icon: [{ url: "/icon-pwa.png", sizes: "512x512" }],
  },
};

export const viewport = {
  themeColor: "#0A1628",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AdminLayout({ children }) {
  return children;
}
