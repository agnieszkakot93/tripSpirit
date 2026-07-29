import * as Sentry from "@sentry/nextjs";

let initialized = false;

/**
 * Initialize Sentry once per Worker isolate. Called from getAppCloudflareContext()
 * so API routes on workerd pick up env.SENTRY_DSN (never process.env).
 */
export function initSentryIfNeeded(dsn: string | undefined): void {
  if (initialized || !dsn) {
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    enableLogs: true,
    integrations: [
      // Surfaces console.warn/error (e.g. itinerary/generate: persist_failed) as Sentry events.
      Sentry.captureConsoleIntegration({ levels: ["warn", "error"] }),
    ],
  });

  initialized = true;
}

export { Sentry };
