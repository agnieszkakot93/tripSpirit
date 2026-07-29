import * as Sentry from "@sentry/nextjs";

// Fallback for Next.js instrumentation when Cloudflare bindings are unavailable
// (e.g. build analysis). Production API routes init via src/lib/sentry-init.ts.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    enableLogs: true,
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ["warn", "error"] }),
    ],
  });
}
