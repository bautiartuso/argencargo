/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
    // Chromium carga sus binarios y libs (.br) con fs en runtime: el tracing de Next no los ve y
    // la función salía sin libnss3 & co. Se incluyen a mano en la función que genera PDFs.
    outputFileTracingIncludes: {
      '/api/admin/bot': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/admin/studio': ['./node_modules/@sparticuz/chromium/bin/**', './docs/marca/**'],
      '/api/cron/studio-queue': ['./node_modules/@sparticuz/chromium/bin/**', './docs/marca/**'],
      '/api/cron/studio-runner': ['./docs/marca/**'],
      '/api/studio/runner': ['./docs/marca/**'],
    },
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
