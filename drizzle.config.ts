import { defineConfig } from "drizzle-kit";

/**
 * `drizzle-kit generate` does not need a live D1 connection. A local file URL keeps
 * `npm run db:generate` working in CI and fresh clones.
 *
 * For `drizzle-kit push` / Studio against **remote** D1, set env and switch to `driver: "d1-http"` per
 * https://orm.drizzle.team/docs/guides/d1-http-with-drizzle-kit
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:./.drizzle-kit.sqlite",
  },
});
