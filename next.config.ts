import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Minimal wrangler.dev.jsonc — avoids production worker service bindings that
// cause "Failed to get handler to worker" noise during local next dev.
void initOpenNextCloudflareForDev({ configPath: "./wrangler.dev.jsonc" });

const nextConfig: NextConfig = {
  serverExternalPackages: ["wrangler"],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
