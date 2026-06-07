import type { NextConfig } from "next";

void import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
