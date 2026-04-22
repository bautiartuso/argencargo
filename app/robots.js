// Next App Router auto-serves this at /robots.txt
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/portal', '/agente', '/api/', '/feedback'],
      },
    ],
    sitemap: 'https://www.argencargo.com.ar/sitemap.xml',
    host: 'https://www.argencargo.com.ar',
  };
}
