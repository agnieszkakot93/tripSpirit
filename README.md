# TripSprint AI

AI-assisted city-break planner. Sign in, create a trip (destination, duration, budget), generate a day-by-day itinerary with approximate costs, then edit activities and day titles.

**Production:** [tripsprint-ai.agnieszkakot22.workers.dev](https://tripsprint-ai.agnieszkakot22.workers.dev)

## Features

- Email/password auth (sign up, sign in, sign out, password reset via email link, and GDPR account deletion from the profile page)
- Trip dashboard — create, list, open, edit, and delete trips
- AI itinerary generation (streaming, one per trip)
- Inline itinerary editing — activities, costs, day titles; changes saved via PATCH

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Runtime | Cloudflare Workers via [@opennextjs/cloudflare](https://opennext.js.org/cloudflare) |
| Database | Cloudflare D1 + Drizzle ORM |
| Auth | Auth.js v5 + Credentials + D1 adapter |
| AI | OpenAI (`gpt-4o-mini`) via Vercel AI SDK |

## Prerequisites

- Node.js 20+
- npm
- Cloudflare account (Workers **Paid** plan required for AI generation — free tier CPU limit is too low)
- OpenAI API key

## Local development

### First-time setup

```bash
npm install

# Required if node_modules was copied from another machine (macOS ARM):
npm install @cloudflare/workerd-darwin-arm64 --force

# Apply D1 migrations to the local database:
npx wrangler d1 migrations apply tripsprint-ai-db --local
```

### Secrets

Create `.dev.vars` in the project root (gitignored). The app reads secrets from Cloudflare bindings — **not** `.env.local`:

```
AUTH_SECRET=<run: openssl rand -hex 32>
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
OPENAI_API_KEY=sk-...
```

Restart the dev server after changing `.dev.vars`.

### Start the dev server

Use the project script — it applies migrations, uses webpack (avoids Turbopack + OpenNext issues), and loads `wrangler.dev.jsonc`:

```bash
npm run dev:local
# or: ./scripts/dev-local.sh start
```

Open [http://localhost:3000](http://localhost:3000).

**Avoid** plain `npm run dev` for day-to-day work; Turbopack + OpenNext local dev is unstable.

### Dev server helpers

| Command | Description |
| --- | --- |
| `npm run dev:local` | Migrate + start dev server |
| `npm run dev:stop` | Stop dev server on port 3000 |
| `./scripts/dev-local.sh restart` | Stop, clear cache, start fresh |
| `./scripts/dev-local.sh repair` | Reinstall workerd + clear runtime cache |
| `npm run db:local` | Interactive shell on local D1 |

A single `Failed to get handler to worker` line on the first request after startup is harmless if pages return 200.

## Scripts

| Command | Description |
| --- | --- |
| `npm test` | Run Vitest unit tests |
| `npm run lint` | ESLint |
| `npm run build` | Next.js production build |
| `npm run build:cf` | OpenNext Cloudflare build |
| `npm run preview:cf` | Preview on workerd runtime (closer to production) |
| `npm run deploy:cf` | Deploy to Cloudflare Workers |
| `npm run db:generate` | Generate Drizzle migrations |

## Deploy to production

```bash
npm run build:cf
npm run deploy:cf
```

Set Worker secrets (one-time, or to rotate):

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put AUTH_TRUST_HOST   # value: true
```

Apply remote D1 migrations before or as part of your deploy pipeline:

```bash
npx wrangler d1 migrations apply tripsprint-ai-db --remote
```

## Project layout

```
src/
  app/              # Next.js App Router (pages + API routes)
  components/       # UI components (itinerary editor, trip forms, etc.)
  lib/              # Auth, DB, Cloudflare context, trip/itinerary logic
  db/schema.ts      # Drizzle schema (users, trips, auth tables)
drizzle/            # D1 SQL migrations
scripts/dev-local.sh
wrangler.jsonc      # Production Worker config
wrangler.dev.jsonc  # Local dev config (D1 + secrets only)
```

## Agent / contributor notes

See [AGENTS.md](AGENTS.md) for Cloudflare runtime conventions, secret handling, and verification workflow.
