import { getCloudflareContext } from "@opennextjs/cloudflare";

import { initSentryIfNeeded } from "@/lib/sentry-init";

type AppCloudflareContext = {
  env: Cloudflare.Env;
  cf: Record<string, unknown>;
  ctx: ExecutionContext;
};

const DEV_WRANGLER_CONFIG = "./wrangler.dev.jsonc";

let devProxyPromise: Promise<AppCloudflareContext> | null = null;

async function loadDevPlatformProxy(): Promise<AppCloudflareContext> {
  // Wrangler must not be bundled — load it at runtime like @opennextjs/cloudflare does.
  const { getPlatformProxy } = await import(
    /* webpackIgnore: true */ `${"__wrangler".replaceAll("_", "")}`
  );
  const { env, cf, ctx } = await getPlatformProxy({
    configPath: DEV_WRANGLER_CONFIG,
    envFiles: [],
  });
  const appEnv = env as unknown as Cloudflare.Env;
  initSentryIfNeeded(appEnv.SENTRY_DSN);
  return { env: appEnv, cf, ctx };
}

function getDevPlatformProxy(): Promise<AppCloudflareContext> {
  devProxyPromise ??= loadDevPlatformProxy();
  return devProxyPromise;
}

/**
 * Cloudflare bindings for app code. In local `next dev`, uses a minimal wrangler
 * config (D1 + secrets only) to avoid workerd RPC errors from the production
 * worker `services` binding in wrangler.jsonc.
 */
export async function getAppCloudflareContext(): Promise<AppCloudflareContext> {
  if (process.env.NODE_ENV === "development") {
    return getDevPlatformProxy();
  }

  return getCloudflareContext({ async: true }).then((context) => {
    const appContext = context as AppCloudflareContext;
    initSentryIfNeeded(appContext.env.SENTRY_DSN);
    return appContext;
  });
}
