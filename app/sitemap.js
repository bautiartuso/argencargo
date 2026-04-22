// Next App Router auto-serves este sitemap en /sitemap.xml
export default function sitemap() {
  const base = 'https://www.argencargo.com.ar';
  const lastModified = new Date();
  return [
    { url: `${base}/`, lastModified, changeFrequency: 'weekly', priority: 1.0 },
    // Nota: rutas privadas (/admin, /portal, /agente) quedan excluidas por robots.
  ];
}
