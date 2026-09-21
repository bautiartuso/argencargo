// ARGENMAQ tiene su propio título e ícono: no hereda "Argencargo — Admin" ni su logo.
export const metadata = {
  title: { absolute: "ARGENMAQ — Admin" },
  manifest: "/manifest-argenmaq.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ARGENMAQ" },
};
export const viewport = { themeColor: "#141517", width: "device-width", initialScale: 1 };
export default function ArgenmaqAdminLayout({ children }) { return children; }
