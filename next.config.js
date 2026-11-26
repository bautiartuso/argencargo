/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core', 'pdfjs-dist'],
    // Chromium carga sus binarios y libs (.br) con fs en runtime: el tracing de Next no los ve y
    // la función salía sin libnss3 & co. Se incluyen a mano en la función que genera PDFs.
    outputFileTracingIncludes: {
      '/api/admin/bot': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/portal/legajo/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/cotizacion/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/cron/legajo-mail': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/admin/legajo-mail': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/portal/dsi': ['./node_modules/@sparticuz/chromium/bin/**', './node_modules/pdfjs-dist/legacy/build/**'],
      '/api/admin/studio': ['./node_modules/@sparticuz/chromium/bin/**', './docs/marca/**'],
      '/api/cron/studio-queue': ['./node_modules/@sparticuz/chromium/bin/**', './docs/marca/**'],
      '/api/cron/studio-runner': ['./docs/marca/**'],
      '/api/studio/runner': ['./docs/marca/**'],
      '/api/cron/studio-publisher': ['./docs/marca/**'],
    },
  },
  // Cinabrio se reemplazó por Kairo: el ícono viejo en la pantalla de inicio sigue llegando.
  async redirects() {
    return [{ source: '/cinabrio', destination: '/kairo', permanent: true }];
  },
  // El panel del CRM se incrusta dentro de WhatsApp Web (extensión de Chrome). WhatsApp Web corre
  // con Cross-Origin-Embedder-Policy: require-corp, y Chrome bloquea cualquier marco que no declare
  // lo mismo. Solo esta página: el resto del sitio no se puede incrustar en ningún lado.
  async headers() {
    return [{
      source: '/crm/panel',
      headers: [
        { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
      ],
    }];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'nhfslvixhlbiyfmedmbr.supabase.co' },
    ],
  },
};

// Wrap con Sentry sólo si hay DSN + dependencia disponible. Si no hay DSN, exporta sin wrap
// para que el build funcione sin tener que instalar @sentry/nextjs localmente.
let finalConfig = nextConfig;
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    const { withSentryConfig } = require('@sentry/nextjs');
    finalConfig = withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    }, {
      widenClientFileUpload: true,
      transpileClientSDK: false,
      tunnelRoute: "/monitoring",
      hideSourceMaps: true,
      disableLogger: true,
    });
  } catch (e) {
    console.warn("Sentry config skipped (package not installed):", e.message);
  }
}

module.exports = finalConfig;
