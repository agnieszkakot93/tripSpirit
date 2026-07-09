import { drizzle } from "drizzle-orm/d1";

import * as schema from "@/db/schema";
import { getAppCloudflareContext } from "@/lib/cloudflare-context";

export type AppDatabase = Awaited<ReturnType<typeof getDb>>;

/** Drizzle client bound to the Worker D1 `DB` binding. Only call from a Cloudflare request context. */
export async function getDb() {
  const { env } = await getAppCloudflareContext();
  return drizzle(env.DB, { schema });
}
