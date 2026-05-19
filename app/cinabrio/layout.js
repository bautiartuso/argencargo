export const metadata = {
  title: { absolute: "Cinabrio" },
  description: "Hábitos y finanzas personales",
  manifest: "/cinabrio/manifest.webmanifest",
  appleWebApp: {
    title: "Cinabrio",
    statusBarStyle: "black-translucent",
    capable: true,
  },
};

export const viewport = {
  themeColor: "#0A0606",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function CinabrioLayout({ children }) {
  return children;
}
