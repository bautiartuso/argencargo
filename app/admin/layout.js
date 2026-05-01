export const metadata = {
  title: "Argencargo — Admin",
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AC Admin",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "512x512" }],
    shortcut: "/icon.png",
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
