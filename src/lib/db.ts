import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "@/db/schema";

export type AppDatabase = ReturnType<typeof getDb>;

/** Drizzle client bound to the Worker D1 `DB` binding. Only call from a Cloudflare request context. */
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}
