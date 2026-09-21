// sitemap.xml propio de ARGENMAQ (el middleware reescribe /sitemap.xml hacia acá en su host).
import { AM_URL } from "../_marca";

export const dynamic = "force-static";

const RUTAS = [
  { loc: "/", freq: "weekly", pri: "1.0" },
  { loc: "/catalogo", freq: "daily", pri: "0.9" },
  { loc: "/como-funciona", freq: "monthly", pri: "0.6" },
  { loc: "/quienes-somos", freq: "monthly", pri: "0.5" },
  { loc: "/terminos", freq: "yearly", pri: "0.3" },
  { loc: "/privacidad", freq: "yearly", pri: "0.3" },
  { loc: "/legal", freq: "yearly", pri: "0.3" },
];

export function GET() {
  const hoy = new Date().toISOString();
  const urls = RUTAS.map(
    (r) => `<url><loc>${AM_URL}${r.loc}</loc><lastmod>${hoy}</lastmod><changefreq>${r.freq}</changefreq><priority>${r.pri}</priority></url>`
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
