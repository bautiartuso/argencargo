// Manifest de la app de reparto: el inicio es el link personal del repartidor.
export const dynamic = "force-dynamic";

export function GET(_req, { params }) {
  const inicio = `/reparto/${String(params.token || "").replace(/[^a-f0-9]/g, "")}`;
  return new Response(JSON.stringify({
    name: "Reparto",
    short_name: "Reparto",
    description: "Hoja de ruta de los repartos",
    start_url: inicio,
    scope: inicio,
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F4F6",
    theme_color: "#F3F4F6",
    lang: "es",
    icons: [
      { src: "/reparto-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/reparto-icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } });
}
