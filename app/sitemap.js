// Next App Router auto-serves este sitemap en /sitemap.xml
import { notasPublicadas } from "../lib/blog";

export default async function sitemap() {
  const base = 'https://www.argencargo.com.ar';
  const lastModified = new Date();
  let notas = [];
  try { notas = await notasPublicadas({ limit: 500 }); } catch {}
  return [
    { url: `${base}/`, lastModified, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/blog`, lastModified, changeFrequency: 'daily', priority: 0.8 },
    ...notas.map((n) => ({ url: `${base}/blog/${n.slug}`, lastModified: new Date(n.published_at || lastModified), changeFrequency: 'monthly', priority: 0.6 })),
    // Nota: rutas privadas (/admin, /portal, /agente) quedan excluidas por robots.
  ];
}
