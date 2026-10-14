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
    // TODO: reemplazar kairo-icon.png por el logo definitivo (hoy es el ícono viejo).
    icons: [{ src: "/kairo-icon.png", sizes: "any", type: "image/png", purpose: "any maskable" }],
  };
}
