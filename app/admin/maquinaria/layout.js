// ARGENMAQ tiene su propio título e ícono: no hereda "Argencargo — Admin" ni su logo.
export const metadata = {
  title: { absolute: "ARGENMAQ — Admin" },
  manifest: "/manifest-argenmaq.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ARGENMAQ" },
  icons: { icon: [{ url: "/argenmaq/favicon-64.png", type: "image/png", sizes: "64x64" }, { url: "/argenmaq/icon-512.png", type: "image/png", sizes: "512x512" }], apple: [{ url: "/argenmaq/apple-180.png", sizes: "180x180" }], shortcut: "/argenmaq/favicon-64.png" },
};
export const viewport = { themeColor: "#141517", width: "device-width", initialScale: 1 };
export default function ArgenmaqAdminLayout({ children }) { return children; }
