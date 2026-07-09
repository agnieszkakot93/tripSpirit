---
project: TripSprint AI
researched_at: 2026-06-02
recommended_platform: Cloudflare Pages
runner_up: Railway
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Next.js 16
  runtime: Cloudflare Workers (edge, via @opennextjs/cloudflare)
---

## Recommendation

**Deploy on Cloudflare Pages.**

Cloudflare Pages scored 10/10 against the five agent-friendly platform criteria — the only platform to achieve a clean sweep. It is already named as the `deployment_target` in `tech-stack.md`, its free tier comfortably handles 10k–100k monthly requests, its `llms.txt` and hosted MCP servers are best-in-class for agent-driven development, and streaming responses sidestep the CPU-time ceiling that would otherwise make AI generation routes expensive on the free plan. The three cross-check lenses surfaced real risks (adapter lag, Auth.js v5 requirement, Next.js 16.2.x bug), all of which are pre-mitigatable with the countermeasures recorded in the risk register below.

---

## Platform Comparison

Scoring: Pass = 2 / Partial = 1 / Fail = 0. Cost adjustment applied per Q2 (minimize cost).
Interview constraints: no persistent connections (Q1), cost-sensitive (Q2), no prior platform familiarity (Q3), single region acceptable (Q4), data layer TBD (Q5).

| Platform | CLI-first | Managed | Agent docs | Deploy API | MCP | Raw | Cost adj. | Final |
|---|---|---|---|---|---|---|---|---|
| **Cloudflare Pages** | Pass | Pass | Pass | Pass | Pass | 10 | — | **10** |
| **Railway** | Pass | Partial | Pass | Pass | Pass | 9 | — | **9** |
| **Vercel** | Pass | Pass | Pass | Pass | Partial | 9 | −1 | **8** |
| Netlify | Partial | Pass | Fail | Pass | Pass | 7 | — | **7** |
| Fly.io | Partial | Partial | Fail | Partial | Partial | 4 | −0.5 | **3.5** |
| Render | Fail | Partial | Partial | Partial | Partial | 4 | −1 | **3** |

**Netlify** scores Fail on agent docs (no official `llms.txt`; HTML-only official docs) and Partial on CLI (rollback is dashboard/API, not a CLI subcommand). Its 60-second synchronous function timeout is adequate for the 30-second AI NFR, and the official `@netlify/mcp` server is a genuine strength — but the docs gap hurts.

**Fly.io** drops on three criteria: no native rollback command (re-deploy a prior image SHA manually), no `llms.txt`, and deploy API is partially manual. It has no permanent free tier and requires a custom Dockerfile. Best suited to multi-region or WebSocket workloads — overkill here.

**Render** drops on CLI-first (no rollback subcommand; dashboard or REST API only), deploy API (rollback is not deterministic from the CLI), and MCP (official server is read-only — cannot trigger deploys). The paid tier jumps to $25/month; free Postgres is deleted after 30 days.

**Vercel** is the native Next.js platform and would score 10 but for one constraint: the Hobby tier is explicitly non-commercial. Any commercial use — including a monetised MVP — requires Pro at $20/month. The Vercel MCP is Public Beta and currently read-only. These two gaps drop it to 8.

---

### Shortlisted Platforms

#### 1. Cloudflare Pages (Recommended)

Best overall score, already the stated deployment target. The `wrangler` CLI covers every operational primitive — deploy, rollback, log tailing — without browser access. Documentation is available as `llms.txt`, `llms-full.txt`, per-product markdown endpoints, and a hosted Documentation MCP server: the most agent-accessible doc surface of any platform researched. Multiple official hosted MCP servers cover the API (2,500+ endpoints), Workers bindings (D1, R2, KV), observability, and CI/CD. The free tier provides 100k requests per day — well above MVP traffic needs. Streaming AI responses consume near-zero CPU time (I/O wait is free), making the free plan viable for the itinerary generation route when streaming is used correctly.

#### 2. Railway

Strong runner-up. Zero-config Next.js deployment via Nixpacks (no Dockerfile required), `railway mcp install` integrates directly with Cursor, and the docs publish both `llms.txt` and `llms-full.txt` (978 KB). The container model eliminates any function timeout concern: the 15-minute HTTP platform limit is orders of magnitude above the 30-second AI NFR. Postgres is one-click and co-located. The practical cost is $8–15/month on the Hobby plan. Scores Partial on Managed because it requires more container-level configuration than a pure serverless platform, and because multi-region is Pro only.

#### 3. Vercel

The reference implementation for Next.js — every App Router feature works natively, no adapter lag, and Fluid Compute (default since June 2025) gives a 300-second function timeout with no configuration. If TripSprint ever needs to monetise, Vercel Pro ($20/month) removes the non-commercial restriction and is the single largest upgrade cost of the shortlist. The MCP server (Public Beta, read-only) is a soft signal now but will improve. Primary reason it isn't the recommendation: the non-commercial Hobby restriction creates an ambiguous legal baseline for a course MVP that may eventually commercialise.

---

## Anti-Bias Cross-Check: Cloudflare Pages

### Devil's Advocate — Weaknesses

1. **Next.js 16.2.x adapter bug is active.** The project is on Next.js 16.2.7 (`AGENTS.md`). Open issue [opennextjs/opennextjs-cloudflare#1258](https://github.com/opennextjs/opennextjs-cloudflare/issues/1258) documents a module-shape mismatch in 16.2.x that causes 500s on dynamic routes involving `"use cache"`. TripSprint doesn't use `"use cache"`, but the underlying divergence can surface on other dynamic route patterns in ways that don't reproduce under `next dev`.

2. **Free plan's 10ms CPU ceiling will break AI routes without streaming.** Parsing a large AI JSON response, running Zod validation, writing to D1, and verifying an auth token easily consumes 15–60ms CPU per request. The free plan terminates at 10ms with no warning — the user sees a 500. The paid plan ($5/month base) is the real minimum for this app. Notably, `wrangler dev` does not enforce the 10ms limit by default, which hides this problem during local development.

3. **`@opennextjs/cloudflare` is community-maintained, not a Cloudflare product.** It lags Next.js minor releases by days to weeks. Every Next.js upgrade is an adapter compatibility check. A needed security patch in Next.js can be stranded behind an adapter release.

4. **`next dev` and the workerd runtime are divergent environments.** Code touching D1, R2, KV, or Cloudflare env bindings must be tested under `npx @opennextjs/cloudflare preview`, not `next dev`. The failure mode — working locally, crashing in production — is not obvious until first deploy.

5. **Auth.js v5 (beta) is required; Auth.js v4 is not edge-compatible.** All dominant tutorials, Stack Overflow answers, and the majority of community examples target v4. Starting from v4 and discovering the incompatibility mid-project is the most likely single-point schedule risk in a 3-week sprint.

---

### Pre-Mortem — How This Could Fail

The team shipped TripSprint on Cloudflare Pages in week two, on schedule. The dev environment looked perfect. Week three was meant for polish.

It wasn't.

The itinerary generation route silently returned 500s for every real user — but not in `wrangler dev`, which doesn't enforce the 10ms CPU limit. Parsing the OpenAI streaming response into the day-by-day JSON structure, validating it with Zod, and writing to D1 consumed ~35ms CPU per request. The free plan killed every request. Two days of production debugging traced the root cause; upgrading to the paid plan fixed it. Schedule: −2 days.

Simultaneously: auth was built with NextAuth v4, following a well-ranked tutorial. It worked identically in `next dev`. First deploy to Cloudflare produced `crypto.subtle is not a function` — v4 imports Node.js crypto primitives unavailable in the Workers runtime. Migrating to Auth.js v5 (beta) consumed most of week three. The email+password provider in v5 has a different configuration shape; the session callback API changed; the database adapter for D1 had to be assembled from the v5 docs rather than copied from existing examples. The MVP shipped on deadline by cutting the itinerary edit feature.

---

### Unknown Unknowns

1. **Auth.js v5 is required and is still in beta.** Community examples, tutorials, and the top Stack Overflow answers target v4. Plan to work entirely from the official v5 docs.

2. **D1 is SQLite, not PostgreSQL.** ORM guides, Prisma migrations, and Drizzle examples overwhelmingly target Postgres. D1 differences include: no `RETURNING` clause in older SQLite builds, different JSON functions, no `pg_` extensions. Drizzle supports D1 natively; verify ORM compatibility before writing schema migrations.

3. **AI SDK streaming behaves differently on the Workers runtime.** The Vercel AI SDK and OpenAI SDK make assumptions about `ReadableStream` and `TransformStream` backpressure that are subtly different from Node.js. Truncated responses and silent hangs under concurrent load can appear only in production, not in `wrangler dev` at low concurrency. Test streaming under realistic concurrency before launch.

4. **Wrangler and adapter versions must be pinned together.** `@opennextjs/cloudflare` has tight peer dependencies on specific wrangler versions. Pin both in `package.json` and always upgrade them as a pair. Installing a newer wrangler independently can silently break the adapter build.

5. **Cloudflare Pages preview URLs may be gated by Cloudflare Access.** By default, preview deploys (branch builds) can be protected by Cloudflare Access. Stakeholders and evaluators receiving a preview link will hit an authentication wall. Configure the Access policy (or disable it for preview domains) before the first demo.

---

## Operational Story

- **Preview deploys**: Every branch pushed to the connected GitHub repo triggers an automatic preview deployment at `<branch>.<project>.pages.dev`. Preview URLs are publicly accessible unless you add a Cloudflare Access policy. Fork PRs do not trigger preview deploys by default — enable "Allow all branches" in the Pages project settings if you need them.

- **Secrets**: Environment variables and API keys are stored in the Cloudflare Pages project's environment settings (Dashboard → Pages → Settings → Environment Variables) or as Workers Secrets (`wrangler secret put KEY`). Secrets are not readable after creation, only replaceable. Rotate by running `wrangler secret put KEY` with the new value — no downtime required.

- **Rollback**: `wrangler rollback` reverts to the previous deployment; `wrangler rollback <VERSION_ID>` targets a specific prior version. Typical time-to-revert: 10–30 seconds (propagation across Cloudflare's network). Database migrations (D1) do not roll back automatically — structure schema migrations so they are forward-compatible before deploying.

- **Approval**: Deploys to production (`wrangler deploy` or merge-to-main via GitHub Actions) can be performed by the agent unattended. Rotating secrets (`wrangler secret put`) requires a valid `CLOUDFLARE_API_TOKEN` in the CI environment — consider requiring a human to rotate the primary OpenAI/Anthropic API key. Billing tier changes and domain configuration require a human in the dashboard.

- **Logs**: `wrangler tail` streams live request logs. `wrangler tail --status error` filters to errors only. The Cloudflare Observability MCP server (`https://observability.mcp.cloudflare.com/mcp`) exposes logs and analytics as structured tool calls — the recommended path for agent-driven log inspection.

---

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Next.js 16.2.x / adapter module-shape bug (#1258) | Devil's advocate | H (project is on 16.2.7) | H (500s on dynamic routes) | Pin `next` to `16.1.x` until the adapter releases a confirmed 16.2.x-compatible version. Track the GitHub issue before each upgrade. |
| Free plan 10ms CPU limit breaks AI routes | Devil's advocate | H (any non-trivial processing) | H (all AI generation fails silently) | Use the paid plan ($5/mo) from day one. Use streaming for all AI API calls — I/O wait consumes zero CPU time. |
| Auth.js v4 / v5 compatibility trap | Pre-mortem | H (v4 dominates community examples) | H (auth fails on first deploy, mid-project rework) | Start with Auth.js v5 from commit zero. Do not follow any tutorial referencing `next-auth` v4. Verify the v5 D1/Cloudflare adapter before writing auth code. |
| `next dev` masks workerd runtime incompatibilities | Pre-mortem | M (common for D1/R2 paths) | M (production-only failures, hard to reproduce) | Run `npx @opennextjs/cloudflare preview` for any route touching D1, R2, KV, or Cloudflare env bindings. Add a local dev checklist step. |
| ORM / D1 SQLite incompatibility | Unknown unknowns | M (if Postgres-targeting ORM used without verification) | M (runtime query failures after migration) | Use Drizzle ORM with the D1 dialect. Do not use Prisma until D1 GA support is confirmed. Verify migration scripts against SQLite before running in production. |
| AI SDK streaming differences on Workers runtime | Unknown unknowns | L–M (only manifests under concurrent load) | M (truncated responses in production) | Test streaming under ≥5 concurrent AI generation requests before launch. Use the Vercel AI SDK `streamText` with the OpenAI provider — it has the most Cloudflare Workers test coverage. |
| Wrangler / adapter version mismatch after upgrade | Unknown unknowns | M | M (broken build, blocked deploy) | Pin both `wrangler` and `@opennextjs/cloudflare` in `package.json`. Upgrade only as a coordinated pair, following the adapter's changelog. |
| Cloudflare Access blocking preview URL stakeholder demos | Unknown unknowns | L | L (inconvenience, not data loss) | Configure the Pages project's Access policy before sharing the first preview link. For course evaluation, disable Access on the preview domain or add evaluator email addresses to the allowlist. |

---

## Getting Started

1. **Install and authenticate wrangler** (the Cloudflare CLI):
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **Install the Next.js adapter** (replaces the deprecated `@cloudflare/next-on-pages`):
   ```bash
   cd tripSpirit
   npm install @opennextjs/cloudflare
   ```
   Add to `wrangler.jsonc`:
   ```jsonc
   {
     "compatibility_flags": ["nodejs_compat"],
     "compatibility_date": "2024-09-23"
   }
   ```

3. **Pin Next.js to 16.1.x** until the adapter confirms 16.2.x compatibility:
   ```bash
   npm install next@16.1.x
   ```
   Set `"next": "~16.1.0"` in `package.json` to prevent accidental upgrades.

4. **Create the Cloudflare Pages project** and link to your GitHub repo:
   ```bash
   wrangler pages project create tripsprint-ai
   ```
   In the Cloudflare Dashboard → Pages → Connect to Git → select the `tripSpirit` repo, set Build command to `npx @opennextjs/cloudflare build` and Output directory to `.open-next/assets`.

5. **Add your secrets** (OpenAI/Anthropic key, Auth.js secret):
   ```bash
   wrangler secret put OPENAI_API_KEY
   wrangler secret put AUTH_SECRET
   ```

6. **Run a local preview** using the workerd runtime (not `next dev`) to test D1 and binding-dependent routes:
   ```bash
   npx @opennextjs/cloudflare preview
   ```

7. **Deploy to production**:
   ```bash
   npx @opennextjs/cloudflare build && wrangler deploy
   ```
   Or push to `main` — GitHub Actions auto-deploy triggers the same sequence.

---

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions workflow file)
- Production-scale architecture (multi-region, HA, DR)
