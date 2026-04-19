/** @type {import('next').NextConfig} */
const nextConfig = {
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
