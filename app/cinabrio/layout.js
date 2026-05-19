export const metadata = {
  title: "Cinabrio",
  description: "Hábitos y finanzas personales",
  manifest: "/cinabrio/manifest.webmanifest",
  themeColor: "#C8102E",
  appleWebApp: {
    title: "Cinabrio",
    statusBarStyle: "black-translucent",
    capable: true,
  },
  icons: {
    icon: "/cinabrio-logo.png",
    apple: "/cinabrio-logo.png",
  },
};

export default function CinabrioLayout({ children }) {
  return children;
}
