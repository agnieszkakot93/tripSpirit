---
project: TripSprint AI
created: 2026-06-02
platform: Cloudflare Pages (Workers runtime via @opennextjs/cloudflare)
database: Cloudflare D1 + Drizzle ORM
auth: Auth.js v5 (next-auth@beta) + @auth/d1-adapter
ci: GitHub Actions + cloudflare/wrangler-action@v3
---

# TripSprint AI — Cloudflare Deployment Plan

## Current State

- Node.js **22** recommended for CI, Wrangler, and `preview:cf` (see `AGENTS.md`).
- `tripSpirit/` git repo: `github.com/agnieszkakot93/tripSpirit`
- **Worker live:** `https://tripsprint-ai.agnieszkakot22.workers.dev` (Workers custom domain; not `*.pages.dev`).
- **Remote D1:** `tripsprint-ai-db` (`database_id` in `wrangler.jsonc`); migrations applied locally + remotely via deploy workflow.
- **Secrets (production):** `AUTH_SECRET`, `OPENAI_API_KEY`, `AUTH_TRUST_HOST`, `RESEND_API_KEY` (password reset) — set as Worker secrets; see Phase 6.
- **CI/CD (Phase 5 — done):**
  - `.github/workflows/ci.yml` — lint, typecheck, vitest, `build`, `build:cf`, Playwright e2e on PR and `main`
  - `.github/workflows/deploy.yml` — after green CI on `main`: remote D1 migrate → `build:cf` → `deploy:cf`
  - `.github/workflows/preview-cf-smoke.yml` — optional nightly / manual `npm run smoke:cf` (workerd on `:8787`)
- **Local workerd smoke:** `npm run smoke:cf` (or `SKIP_BUILD=1` after `build:cf`); requires `.dev.vars` with `AUTH_SECRET`, `AUTH_URL=http://localhost:8787`, `AUTH_TRUST_HOST=true`
- **Next:** Phase 6 production smoke checklist on the live Worker URL (manual verification).

---

## Phase 0 — Prerequisites: CLI Tools & Accounts

### 0.1 Install Wrangler CLI

```bash
npm install -g wrangler@^4.86
wrangler --version   # expect 4.86.x
```

Wrangler must be pinned to `^4.86` — `@opennextjs/cloudflare` has tight peer deps on this range.

### 0.2 Install GitHub CLI

```bash
brew install gh
gh --version
```

Needed to set GitHub Actions secrets from the terminal in Phase 5.

### 0.3 Cloudflare Account Setup

1. Sign up / log in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Upgrade to Workers Paid plan ($5/month)** — the free plan's 10 ms CPU limit will kill every AI generation request. Dashboard → Workers & Pages → Plans.
3. Note your **Account ID**: Dashboard → Workers & Pages → Account Details (right sidebar).

### 0.4 Authenticate Wrangler

```bash
wrangler login
# Opens browser, authorise with your Cloudflare account.
# Confirm with:
wrangler whoami
```

### 0.5 Authenticate GitHub CLI

```bash
gh auth login
# Choose: GitHub.com → HTTPS → Authenticate with browser
gh auth status   # confirm "Logged in to github.com"
```

### 0.6 Create Cloudflare API Token for CI

In the Cloudflare Dashboard → My Profile → API Tokens → Create Token:

- Use the **"Edit Cloudflare Workers"** template.
- Add the extra permission: **D1 — Edit** (not in the default template).
- Set the account and zone scope to your account only.
- Copy the token immediately — it is shown only once.

Verify the token locally:

```bash
CLOUDFLARE_API_TOKEN=<paste> wrangler whoami
```

Keep this token for Phase 5 (GitHub secret `CLOUDFLARE_API_TOKEN`).

### 0.7 Obtain an OpenAI API Key

Log in at [platform.openai.com](https://platform.openai.com) → API Keys → Create new secret key.
Store it — it goes into `.env.local` as `OPENAI_API_KEY` and as a Cloudflare Worker Secret in Phase 6.

### 0.8 Generate Auth Secret

```bash
npx auth secret
# Prints a random 32-byte BASE64 string.
```

Store the output — it goes into `.env.local` as `AUTH_SECRET` and as a Cloudflare Worker Secret in Phase 6.

### 0.9 Prerequisite Checklist

- [x] `wrangler --version` prints `4.86.x`
- [x] `gh auth status` shows logged in
- [x] `wrangler whoami` shows your Cloudflare account
- [x] Workers Paid plan is active on the dashboard
- [x] Cloudflare API Token (with D1 Edit) copied to a password manager
- [x] OpenAI API Key copied to a password manager
- [x] AUTH_SECRET generated and stored

---

## Phase 1 — Pin Next.js & Install Adapter

**Key files:** `tripSpirit/package.json`

```bash
cd tripSpirit
npm install next@~16.2.7 eslint-config-next@~16.2.7
npm install @opennextjs/cloudflare
npm install -D wrangler@^4.86   # local dev dep, pins version for builds too
npm run build                    # must pass before proceeding
```

Add npm scripts to `package.json`:

```json
"build:cf": "opennextjs-cloudflare build",
"preview:cf": "opennextjs-cloudflare preview",
"deploy:cf": "opennextjs-cloudflare deploy"
```

### Phase 1 checklist

- [x] `next` / `eslint-config-next` pinned to `~16.2.7`
- [x] `@opennextjs/cloudflare` and dev `wrangler@^4.86` installed
- [x] Scripts `build:cf`, `preview:cf`, `deploy:cf` added
- [x] `npm run build` passes

---

## Phase 2 — Cloudflare Adapter Config

**Key files to create:**

- `tripSpirit/wrangler.jsonc`
- `tripSpirit/open-next.config.ts`
- `tripSpirit/next.config.ts` (update)
- `tripSpirit/cloudflare-env.d.ts`

`wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "tripsprint-ai",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-06-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "tripsprint-ai" }],
  "d1_databases": [{
    "binding": "DB",
    "database_name": "tripsprint-ai-db",
    "database_id": "<FILL_AFTER_PHASE_3>",
    "migrations_dir": "./drizzle"
  }]
}
```

`open-next.config.ts`: calls `defineCloudflareConfig()` (minimal, no cache override needed).

`next.config.ts`: import and call `initOpenNextCloudflareForDev()` at the top so local `next dev` gets D1 bindings.

Verify: `npm run preview:cf` loads the app without errors using the workerd runtime.

### Phase 2 checklist

- [x] `open-next.config.ts` with `defineCloudflareConfig()` (minimal)
- [x] `wrangler.jsonc` (OpenNext worker + assets + self-reference + D1 block; add `database_id` in Phase 3)
- [x] `next.config.ts` calls `initOpenNextCloudflareForDev` for local dev bindings
- [x] `cloudflare-env.d.ts` from `wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts`
- [x] `npm run build:cf` succeeds

---

## Phase 3 — D1 Database + Drizzle ORM

**Key files to create:**

- `tripSpirit/drizzle.config.ts`
- `tripSpirit/src/lib/db.ts`
- `tripSpirit/src/db/schema.ts` (users, sessions, itineraries)

```bash
# Create remote D1 database
wrangler d1 create tripsprint-ai-db
# Copy the database_id output into wrangler.jsonc

# Install ORM
npm install drizzle-orm
npm install -D drizzle-kit

# Generate and apply first migration
npx drizzle-kit generate
wrangler d1 migrations apply tripsprint-ai-db --local   # test locally
wrangler d1 migrations apply tripsprint-ai-db           # apply to remote
```

`drizzle.config.ts`: use `dialect: "sqlite"`. For `drizzle-kit generate` in CI and fresh clones, a local `dbCredentials.url` (`file:./.drizzle-kit.sqlite`) is used so no Cloudflare token is required. For `drizzle-kit push` / Studio against **remote** D1, switch to `driver: "d1-http"` and `dbCredentials` `{ accountId, databaseId, token }` per the [D1 HTTP + Drizzle Kit](https://orm.drizzle.team/docs/guides/d1-http-with-drizzle-kit) guide.

`src/lib/db.ts`: initialize Drizzle client from `getCloudflareContext().env.DB`.

### Phase 3 checklist

- [x] `drizzle-orm` / `drizzle-kit` installed; `npm run db:generate` script
- [x] `src/db/schema.ts` — Auth.js–compatible `users`, `accounts`, `sessions`, `verification_tokens` + app `trips` (`password_hash` for upcoming Credentials flow)
- [x] `drizzle.config.ts` + initial migration under `drizzle/`
- [x] `src/lib/db.ts` with `drizzle-orm/d1` + `getCloudflareContext()`
- [x] `wrangler d1 migrations apply tripsprint-ai-db --local` succeeds
- [x] Remote: D1 provisioned on first deploy (or `wrangler d1 create`) → `database_id` in `wrangler.jsonc` → `wrangler types` → `wrangler d1 migrations apply tripsprint-ai-db --remote`

---

## Phase 4 — Auth.js v5 with D1 + Credentials

**Key files:**

- `tripSpirit/src/lib/auth.ts` — lazy `NextAuth` + `getCloudflareContext({ async: true })` + `D1Adapter(env.DB)`, JWT sessions, Credentials `authorize` via Drizzle + `password_hash`.
- `tripSpirit/src/lib/password.ts` — `@noble/hashes/scrypt` (async) encode / verify.
- `tripSpirit/src/app/api/auth/[...nextauth]/route.ts` — `runtime: "edge"`, `GET`/`POST` handlers.
- `tripSpirit/src/app/api/auth/register/route.ts` — `POST` email/password, Drizzle insert.
- `tripSpirit/src/app/(protected)/layout.tsx` — session guard for all protected routes; builds `/login?callbackUrl=` from `x-opennext-initial-url` (workerd) or `next-url` (`next dev`).
- `tripSpirit/src/app/login/*`, `tripSpirit/src/components/auth-provider.tsx`, `tripSpirit/src/types/next-auth.d.ts`.
- `tripSpirit/.env.example` — copy to `.env.local` (gitignored); do **not** commit real secrets.

```bash
# Installed (pin next-auth beta when upgrading)
npm install next-auth@beta @auth/d1-adapter @noble/hashes
```

Critical config points:

- `session.strategy: "jwt"` is mandatory with Credentials provider on edge runtime.
- Password hashing uses `@noble/hashes/scrypt` — **not** bcryptjs or bcrypt (native bindings unavailable in workerd).
- `trustHost: true` in auth config; set `AUTH_TRUST_HOST=true` in env for documentation parity with Cloudflare Worker secrets (Phase 6).

`.env.local` (create locally from `.env.example`):

```
AUTH_SECRET=<output from npx auth secret>
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
OPENAI_API_KEY=<your key>
```

Verify: sign up and sign in work under `npm run preview:cf` (workerd runtime, not `next dev`).

### Phase 4 checklist

- [x] `next-auth@beta`, `@auth/d1-adapter`, `@noble/hashes` installed
- [x] `src/lib/auth.ts` with JWT + Credentials + lazy D1 adapter
- [x] `src/app/api/auth/[...nextauth]/route.ts` (edge)
- [x] `src/app/api/auth/register/route.ts` (edge)
- [x] `(protected)/layout.tsx` route guard (replaced `proxy.ts` — see `context/archive/2026-06-09-s-01/`)
- [x] Login / register UI + `SessionProvider`
- [x] Local workerd smoke: `npm run smoke:cf` (`scripts/preview-cf-smoke.sh`) — login, unauth redirect + `callbackUrl`, register → sign-in → `/trips`

---

## Phase 5 — GitHub Actions CI/CD

**Key files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/preview-cf-smoke.yml`

```bash
# GitHub secrets (one-time)
gh secret set CLOUDFLARE_API_TOKEN --body "<token from Phase 0.6>"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "<your account ID>"
```

`ci.yml` — on `pull_request` and push to `main`:

```
npm ci → lint → typecheck → test → build → build:cf
e2e job (needs quality): Playwright against next dev + local D1; .dev.vars with AUTH_SECRET + E2E_ITINERARY_FIXTURE
```

`deploy.yml` — after **successful** CI on `main` (or `workflow_dispatch`):

```
checkout → setup-node 22 → npm ci → wrangler d1 migrations apply --remote → build:cf → deploy:cf
```

`preview-cf-smoke.yml` — nightly + manual: `npm run smoke:cf` (optional §5 pre-prod gate; not on every PR).

### Phase 5 checklist

- [x] `ci.yml` quality + e2e gates on PR and `main`
- [x] `deploy.yml` migrations-before-deploy on green `main` CI
- [x] Node 22 in CI and deploy workflows
- [x] `preview-cf-smoke.yml` for optional workerd smoke
- [ ] PR preview deployments to Cloudflare (deferred — deploy is `main`-only today)

## Phase 6 — Secrets, Smoke Test & Verification

```bash
# Set production Worker Secrets (encrypted at rest, not readable after creation)
wrangler secret put AUTH_SECRET
wrangler secret put OPENAI_API_KEY
wrangler secret put AUTH_TRUST_HOST   # value: "true"
```

Smoke test checklist (run against **`https://tripsprint-ai.agnieszkakot22.workers.dev`**, not `*.pages.dev`):

- [ ] Home page loads on the production Worker URL
- [ ] Sign up creates a user row in D1: `wrangler d1 execute tripsprint-ai-db --command "SELECT * FROM users LIMIT 5"`
- [ ] Sign in returns a valid JWT session cookie
- [ ] Itinerary generation route streams a response within 30 seconds
- [ ] `wrangler tail --status error` shows no Worker exceptions
- [ ] Rollback: `wrangler rollback` reverts to prior deployment in <30 s
- [ ] Preview URL: Cloudflare Access policy for branch previews is configured or disabled as needed

---

## Key Decisions & Rationale


| Decision           | Choice                        | Rationale                                                                                            |
| ------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Database           | Cloudflare D1 (SQLite)        | Co-located Worker binding — no network hop. 5 GB free vs Supabase's 500 MB. No Docker for local dev. |
| ORM                | Drizzle (`drizzle-orm/d1`)    | First-class D1 dialect, small bundle, no Postgres-only assumptions.                                  |
| Auth               | Auth.js v5 (`next-auth@beta`) | Edge-compatible; v4 imports Node.js crypto unavailable in workerd.                                   |
| Auth adapter       | `@auth/d1-adapter`            | Official adapter; reads/writes D1 via Worker binding, not network.                                   |
| Password hashing   | `@noble/hashes/scrypt`        | No native bindings required — runs in workerd. bcrypt/bcryptjs will crash.                           |
| Session strategy   | JWT                           | Mandatory with Credentials provider on edge; database sessions require network.                      |
| Workers plan       | Paid ($5/mo)                  | Free plan's 10 ms CPU limit kills AI generation + DB writes in a single request.                     |
| Wrangler version   | `^4.86` (pinned)              | Tight peer dep with `@opennextjs/cloudflare`; upgrade only as a coordinated pair.                    |
| Compatibility date | `2026-06-01`                  | Older dates cause runtime crashes with the current adapter.                                          |


---

## Risk Register (Deployment-Specific)


| Risk                                     | Likelihood | Impact | Mitigation                                                                |
| ---------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| `next dev` masks workerd runtime bugs    | High       | High   | Use `npm run dev:local` or `npm run smoke:cf` (`preview:cf` on :8787), not plain `next dev` alone for D1/auth. |
| Free plan 10 ms CPU limit                | High       | High   | Workers Paid plan from day one.                                           |
| Auth.js v5 beta API changes              | Medium     | Medium | Pin `next-auth` to exact beta version; review changelog before upgrading. |
| D1 migration not applied before deploy   | Medium     | High   | GitHub Actions workflow enforces migration-before-deploy order.           |
| Wrangler/adapter version mismatch        | Medium     | Medium | Pin both in `package.json`; upgrade as a coordinated pair only.           |
| Cloudflare Access blocking preview demos | Low        | Low    | Configure Access policy before first stakeholder demo.                    |


