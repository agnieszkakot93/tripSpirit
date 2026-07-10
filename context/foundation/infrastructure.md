---
project: TripSprint AI
researched_at: 2026-07-10T09:45:00+02:00
recommended_platform: Cloudflare Workers
runner_up: Railway
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Next.js 16
  runtime: Cloudflare Workers (edge, via @opennextjs/cloudflare)
---

## Recommendation

**Deploy on Cloudflare Workers** (via `@opennextjs/cloudflare` + `wrangler`).

The project is already built and running on this stack (`wrangler.jsonc`, D1 binding, `npm run deploy:cf`). It scores highest on agent-friendly criteria (CLI, docs, MCP) and co-locates the database (D1) with compute. Interview answer Q1 (“persistent connections: Yes”) does **not** match today’s implementation — itinerary generation uses **HTTP streaming inside a single request**, not WebSockets or background daemons. If true long-lived connections are added later, Cloudflare supports them via **Durable Objects** (WebSocket Hibernation API, GA); otherwise **Railway** is the cleaner fit for always-on Node processes without adapter work.

The paid Workers plan ($5/mo minimum) is required for AI routes that do non-trivial CPU work; streaming keeps CPU low during OpenAI I/O wait.

---

## Platform Comparison

**Scoring:** Pass = 2 / Partial = 1 / Fail = 0 per criterion in `agent-friendly-criteria.md`.

**Interview constraints (2026-07-10):**
- Q1: **Yes** — persistent connections / background workers required (hard filter applied)
- Q2: Equal — no strong cost vs DX preference
- Q3: No platform familiarity
- Q4: Single region acceptable
- Q5: Co-located services — undecided

**Hard filters (Q1 = Yes):**
- **Netlify** — **dropped from shortlist.** No native WebSocket server; long-running work is async/background only (202 response, no duplex stream). Third-party realtime (e.g. Ably) required.
- **Vercel** — **dropped from shortlist.** WebSocket support is **Public Beta** (changelog June 2026) with connections pinned to a function instance and closed at max duration; no true background worker between requests. Fluid Compute helps concurrency, not persistent daemons.

**Tech-stack hard constraint:** Next.js 16 on Cloudflare via `@opennextjs/cloudflare@^1.19.11` — Railway/Render/Fly require abandoning OpenNext adapter and D1 bindings (major migration).

| Platform | CLI-first | Managed | Agent docs | Deploy API | MCP | Raw | Notes | Final |
|---|---|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | **10** | Q1: Partial (DO for WebSockets) | **10** |
| **Railway** | Pass | Partial | Pass | Pass | Pass | **9** | Q1: Pass; ~$5–15/mo Hobby | **9** |
| **Render** | Partial | Partial | Partial | Partial | Partial | **6** | Q1: Pass; rollback via CLI/API | **6** |
| **Fly.io** | Partial | Partial | Fail | Partial | Partial | **4** | Q1: Pass; no `llms.txt`; CLI-first | **4** |
| Vercel | Pass | Pass | Pass | Pass | Partial | 9 | Q1 fail for background workers | — |
| Netlify | Partial | Pass | Fail | Pass | Pass | 7 | Q1 fail — no native WebSocket | — |

**Cloudflare Workers** — `wrangler@^4.99.0` deploys `.open-next/worker.js`; `wrangler rollback` for revert; `llms.txt` + Documentation/Observability MCP servers (GA). D1 co-located. CPU time limits apply per request (paid plan needed for AI). WebSockets/long-lived: **Durable Objects + Hibernation API** (GA, checked 2026-07-10).

**Railway** — Container/Nixpacks deploy; unlimited process duration; `railway mcp` bundled in CLI (npm `@railway/mcp-server` deprecated May 2026). Hobby **$5/mo** usage minimum. Postgres/Redis one-click. Best migration target if leaving Workers.

**Render** — Serverful web services; WebSockets on all plans (docs); `render deploys rollback` (CLI). Starter **$7/mo** always-on. MCP/agent skills advertised but weaker than Cloudflare/Railway for deploy automation.

**Fly.io** — Excellent WebSockets on long-running Machines; `fly deploy` / `flyctl`. No official `llms.txt`; rollback = redeploy prior image. Global multi-region — overkill for Q4 single-region.

---

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Already the `deployment_target` in `tech-stack.md` and production URL in `README.md`. Agent ops are fully CLI-driven (`wrangler deploy`, `wrangler secret put`, `wrangler tail`, `wrangler d1 migrations apply`). D1 keeps auth + trips data on-platform. Streaming AI (`streamObject` + `toTextStreamResponse`) fits the Workers request model without WebSockets. **Gap vs Q1:** between-request background workers need **Queues** or **Cron Triggers**; WebSockets need **Durable Objects** — both are GA but require explicit architecture.

#### 2. Railway

Strongest alternative when Q1 is taken literally: always-on Node container, no 10ms CPU ceiling, no OpenNext adapter lag. `railway mcp install` for Cursor. Tradeoff: rewrite deployment (Nixpacks/Docker), replace D1 with Railway Postgres, re-test Auth.js + AI SDK on Node. Estimated **$8–15/mo** for small always-on MVP.

#### 3. Render

Serverful web service + background workers; native WebSocket docs; PR preview environments. Higher baseline cost (~$7/mo starter + DB). CLI rollback exists; less agent-native than Cloudflare/Railway. Good if team prefers Heroku-style dashboard and blueprint (`render.yaml`).

---

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Q1 mismatch with current code.** User requires persistent connections, but TripSprint ships request-scoped streaming only. Adding WebSockets or background sync without Durable Objects/Queues will hit Workers model limits.

2. **Paid plan is mandatory for AI.** Free tier 10ms CPU/request fails non-streaming or post-stream validation paths (`AGENTS.md`). `wrangler dev` does not enforce CPU limits — production-only surprises.

3. **`@opennextjs/cloudflare` is community-maintained** (`^1.19.11`). Pinned with `next@~16.2.7` and `wrangler@^4.99.0` — upgrade pairs required; adapter lags Next.js minors.

4. **workerd ≠ `next dev`.** Bindings read via `getCloudflareContext().env.*`, not `process.env`. D1 routes must be verified with `npm run preview:cf` or `npm run dev:local`, not plain `npm run dev` alone.

5. **Auth.js v5 + Credentials + D1** — beta stack; few copy-paste examples vs v4 tutorials.

### Pre-Mortem — How This Could Fail

The team answered “yes” to persistent connections and chose Cloudflare Workers because the course stack said so. Week two: a stakeholder asks for live collaborative itinerary editing (WebSockets). The team bolted WebSockets onto standard Workers routes; connections dropped on every isolate recycle. Week three: they migrated chat state to Durable Objects — new binding, new wrangler config, hibernation API learning curve. Meanwhile AI routes on the free plan 500’d until someone noticed the $5 plan requirement. The MVP shipped without collaboration; Railway would have accepted a Socket.IO server in the same container as Next.js with one Dockerfile change.

### Unknown Unknowns

1. **Production deploy is Workers, not Pages.** `wrangler.jsonc` uses `main: .open-next/worker.js` and a self-reference service binding — operational docs that say “Pages” only are misleading.

2. **Vercel WebSockets (Public Beta, June 2026)** changed the old “serverless can’t do WebSockets” rule — irrelevant while staying on Cloudflare, but matters if reconsidering Vercel.

3. **`ctx.waitUntil()` for D1 writes after AI stream** — client `router.refresh()` may race the async persist; brief empty state possible.

4. **D1 migrations don’t roll back with `wrangler rollback`** — forward-compatible migrations only.

5. **Corporate TLS proxy** — local-only `.dev-ca-bundle.pem` workaround in `.claude/launch.json`; production workerd unaffected.

---

## Operational Story

- **Preview deploys:** Connect GitHub → Cloudflare Workers/Pages project; branch builds produce preview URLs. Fork PR previews may need branch settings. Protect with Cloudflare Access if needed (evaluators hit login wall otherwise).

- **Secrets:** Local: `.dev.vars` (gitignored). Production: `npx wrangler secret put AUTH_SECRET`, `OPENAI_API_KEY`, etc. — write-only, rotate in place. Plaintext vars in `wrangler.jsonc` `vars` block for non-secrets only (`AUTH_URL`).

- **Rollback:** `npx wrangler rollback` or `wrangler deployments list` + `wrangler rollback <id>`. Typical revert: tens of seconds. **D1 schema does not auto-revert.**

- **Approval:** Agent may run `npm run build:cf && npm run deploy:cf` with valid API token. Human should rotate `OPENAI_API_KEY` / `AUTH_SECRET` and approve billing tier changes.

- **Logs:** `npx wrangler tail` (add `--status error` for failures). Cloudflare Observability MCP for structured log queries.

---

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Q1 “Yes” but no WebSocket/DO architecture | Interview + code review | M | M | Document: current MVP uses HTTP streaming only; add DO design before realtime features |
| Free plan CPU kills AI routes | Devil's advocate | H | H | Use **paid Workers plan** from day one; stream all AI responses |
| OpenNext adapter / Next 16.2.x drift | Devil's advocate | M | H | Pin `next`, `@opennextjs/cloudflare`, `wrangler` together; test `preview:cf` before deploy |
| `next dev` masks workerd failures | Pre-mortem | M | M | Use `npm run dev:local` for D1 work; `npm run preview:cf` before release |
| Auth.js v5 beta friction | Unknown unknowns | M | H | Stay on v5 + D1 adapter; no v4 tutorials |
| Migration to Railway if true daemons required | Q1 + pre-mortem | L–M | H | Keep Railway as runner-up; spike Docker deploy before committing |
| `waitUntil` vs client refresh race | Unknown unknowns | M | L | Poll or delay refresh after generation; accept brief loading state |
| D1 migration irreversibility | Unknown unknowns | M | M | Test migrations locally; `npx wrangler d1 migrations apply --local` in dev script |

---

## Getting Started

Validated against `package.json` (`@opennextjs/cloudflare@^1.19.11`, `wrangler@^4.99.0`, `next@~16.2.7`):

1. **Install dependencies and workerd (macOS ARM):**
   ```bash
   npm install
   npm install @cloudflare/workerd-darwin-arm64 --force
   ```

2. **Local secrets** — create `.dev.vars`:
   ```
   AUTH_SECRET=<openssl rand -hex 32>
   AUTH_URL=http://localhost:3000
   AUTH_TRUST_HOST=true
   OPENAI_API_KEY=sk-...
   ```

3. **Apply D1 migrations locally:**
   ```bash
   npx wrangler d1 migrations apply tripsprint-ai-db --local
   ```

4. **Day-to-day dev** (migrations + webpack + wrangler proxy — prefer over plain `npm run dev`):
   ```bash
   npm run dev:local
   ```

5. **Preview on workerd** (closer to production):
   ```bash
   npm run build:cf
   npm run preview:cf
   ```

6. **Production secrets** (one-time / rotate):
   ```bash
   npx wrangler secret put AUTH_SECRET
   npx wrangler secret put OPENAI_API_KEY
   npx wrangler secret put AUTH_TRUST_HOST   # value: true
   ```

7. **Deploy:**
   ```bash
   npm run build:cf
   npm run deploy:cf
   ```
   Remote migrations: `npx wrangler d1 migrations apply tripsprint-ai-db --remote`

---

## Out of Scope

- Docker image configuration
- CI/CD pipeline authoring (GitHub Actions assumed in `tech-stack.md`)
- Production-scale architecture (multi-region HA, DR)
