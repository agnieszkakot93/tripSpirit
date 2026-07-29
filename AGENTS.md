<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Before launching the project

Run these once after cloning or after a fresh `node_modules` install:

1. **Reinstall the workerd binary for the current platform** (required if `node_modules` was copied from another machine):
   ```bash
   npm install @cloudflare/workerd-darwin-arm64 --force
   ```

2. **Apply D1 migrations to the local database** (required before the app can query any table):
   ```bash
   npx wrangler d1 migrations apply tripsprint-ai-db --local
   ```

Then start the dev server:
```bash
npm run dev
```

# Secrets & environment variables

Code reads every secret via `getCloudflareContext().env.<NAME>` (e.g. `env.OPENAI_API_KEY`, `env.AUTH_SECRET`, `env.SENTRY_DSN`) — **never `process.env`** (it is not reliably populated on the workerd runtime). New secrets must be added to the `CloudflareEnv` type in `cloudflare-env.d.ts` (regenerate with `npx wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts`).

Where each secret lives by environment:

| Environment | Source | Committed? |
| --- | --- | --- |
| Local dev (`npm run dev` / `npm run preview:cf`) | `.dev.vars` (`KEY=value` per line) | No — gitignored |
| Production (Cloudflare) | **Worker secret** | No — stored encrypted by Cloudflare |

**Set/rotate a production secret** (write-only; not readable after creation, run again to rotate — no downtime):
```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SENTRY_DSN
```
Or: Cloudflare dashboard → Workers & Pages → project → Settings → Variables & Secrets → add as a **Secret** (not plaintext). `.dev.vars` is local-only and never deploys — provisioning the production secret is a separate, required step.

Password-reset emails require `RESEND_API_KEY` (see [resend.com](https://resend.com)). Without it, forgot-password only logs the reset URL to the worker console. Default `EMAIL_FROM` uses Resend's test sender (`onboarding@resend.dev`), which only delivers to addresses verified in your Resend account.

**Sentry (optional):** browser errors use `NEXT_PUBLIC_SENTRY_DSN` in `.env.local` (dev) or as a build-time env var in CI/deploy for production client bundles (`src/instrumentation-client.ts`). Server-side `SENTRY_DSN` in `.dev.vars` / `wrangler secret` is reserved for a future worker SDK hook; until then use `npx wrangler tail tripsprint-ai --format json --search "persist_failed"` for API `console.error` signals. The worker bundle stays under Cloudflare’s free-tier size cap without the Sentry server SDK.

Notes:
- Never paste a real key into chat, commit it, or log it. If one is exposed, **revoke it in the provider dashboard** — deleting the local copy does not invalidate it.
- The free Cloudflare plan's 10ms CPU ceiling 500s AI routes; the **$5/mo paid plan is the production minimum** for AI generation (see `context/foundation/infrastructure.md`).
- `.dev-ca-bundle.pem` + the `NODE_EXTRA_CA_CERTS` entry in `.claude/launch.json` are a **local-only** workaround for a corporate TLS proxy so `next dev` can reach external APIs (e.g. OpenAI). Production workerd does not use or need them.

# Verifying changes

After implementing any change, verify it by running the app — not by running tests or typechecks alone. Use the `/verify` skill:

```
/verify <description of what changed>
```

The skill starts the dev server, drives the affected flows through the real UI, and reports a PASS/FAIL with observations. A passing typecheck or lint is not a substitute — run the app and confirm the feature works at its actual surface (browser, API endpoint, CLI).

Automated checks (`npx tsc --noEmit`, `npm run lint`, `npm run build`) are still required per the plan's success criteria, but they come in addition to runtime verification, not instead of it.

# E2E tests

Browser-level tests live under `e2e/`. Before generating or reviewing E2E specs, read `e2e/e2e-quality-rules.md` and the seed exemplar `e2e/seed.spec.ts`. Drive risk-based E2E work with `/10x-e2e` (skill in `.cursor/skills/10x-e2e/`).

- Run all: `npm run e2e`
- Auth session for storageState specs: `playwright/.auth/user.json` (gitignored; created by `e2e/auth.setup.ts`)
- Generation in E2E uses `E2E_ITINERARY_FIXTURE=true` in `.dev.vars` — never set in production
