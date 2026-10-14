export default function manifest() {
  return {
    name: "Kairo",
    short_name: "Kairo",
    description: "Físico, nutrición, finanzas y objetivos",
    start_url: "/kairo",
    scope: "/kairo",
    display: "standalone",
    background_color: "#0C0D10",
    theme_color: "#0C0D10",
    orientation: "portrait",
    icons: [
      { src: "/kairo-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/kairo-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/kairo-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
