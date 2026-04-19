// Sentry (browser). Carga sólo si NEXT_PUBLIC_SENTRY_DSN está seteado.
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",
    tracesSampleRate: 0.1,        // 10% de transacciones para performance
    replaysSessionSampleRate: 0,  // no grabar sesiones (costoso, privacy)
    replaysOnErrorSampleRate: 1,  // grabar sesión cuando hay error (debug gold)
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // No reportar errores de extensiones / widgets externos
    ignoreErrors: [
      "Non-Error promise rejection captured",
      "ResizeObserver loop",
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
    ],
  });
}
