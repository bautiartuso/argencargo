export default function manifest() {
  return {
    name: "Cinabrio",
    short_name: "Cinabrio",
    description: "Hábitos y finanzas personales",
    start_url: "/cinabrio",
    scope: "/cinabrio",
    display: "standalone",
    background_color: "#0A0606",
    theme_color: "#C8102E",
    orientation: "portrait",
    icons: [
      {
        src: "/cinabrio-logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
