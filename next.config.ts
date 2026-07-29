import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Minimal wrangler.dev.jsonc — avoids production worker service bindings that
// cause "Failed to get handler to worker" noise during local next dev.
void initOpenNextCloudflareForDev({ configPath: "./wrangler.dev.jsonc" });

const nextConfig: NextConfig = {
  serverExternalPackages: ["wrangler"],
};

export default nextConfig;
