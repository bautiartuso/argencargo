// Sentry (server / lambdas de Next). Carga sólo si SENTRY_DSN está seteado.
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV || "development",
    tracesSampleRate: 0.1,
  });
}
