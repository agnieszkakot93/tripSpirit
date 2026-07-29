import * as Sentry from "@sentry/nextjs";

// Cloudflare worker routes initialize Sentry from env.SENTRY_DSN in sentry-init.ts.
// Avoid loading duplicate server/edge SDK bundles into the worker.
export const onRequestError = Sentry.captureRequestError;
