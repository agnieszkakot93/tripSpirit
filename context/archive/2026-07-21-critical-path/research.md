---
date: 2026-07-21T22:59:26+02:00
researcher: Agnieszka Kot
git_commit: dd4745ecce35ea695a4d95dd24320fdeb84d99a4
branch: main
repository: tripSpirit
topic: "Critical-path e2e smoke + CI gate — grounding test-plan Phase 4"
tags: [research, codebase, e2e, playwright, ci, github-actions, auth-redirect, critical-path]
status: complete
last_updated: 2026-07-21
last_updated_by: Agnieszka Kot
---

# Research: Critical-path e2e smoke + CI gate (test-plan Phase 4)

**Date**: 2026-07-21T22:59:26+02:00
**Researcher**: Agnieszka Kot
**Git Commit**: dd4745ecce35ea695a4d95dd24320fdeb84d99a4
**Branch**: main
**Repository**: tripSpirit

## Research Question

Ground rollout Phase 4 of `context/foundation/test-plan.md`
("Critical-path e2e smoke + CI gate") in actual code and infrastructure, so
`/10x-plan` can wire Playwright (or equivalent) and GitHub Actions quality
gates. Specifically:

- **Critical path** — sign-in → create trip → generate itinerary → edit
  activity: what pages, APIs, selectors, and timing risks exist?
- **Risk #5 page half** — `(protected)` layout redirect to `/login` with
  `callbackUrl` (deferred from Phases 1–3).
- **CI gates** — what §5 requires, what exists today, and the cheapest path
  to lock lint/typecheck/test/build (+ e2e) on PR.

## Summary

Phase 4 is **greenfield for e2e and CI** — no Playwright config, no
`.github/workflows/`, no aggregate `check` script. Vitest Phases 1–3 are
complete (79 tests); integration tests already cover API 401 and generation
persist gates with mocked AI.

1. **Critical path is well-defined in UI code** — login (`/login`),
   create-trip modal (`POST /api/trips`), generator (`useObject` →
   `POST /api/trips/[tripId]/itinerary`), editor (`PATCH` same route). No
   `data-testid` attributes anywhere; e2e must use roles, labels, and visible
   text.
2. **Risk #5 page redirect is layout-only** — `(protected)/layout.tsx` calls
   `auth()` and `redirect(/login?callbackUrl=…)`; **no `middleware.ts`**.
   Protected URLs: `/trips`, `/trips/[tripId]`, `/profile`. This is the main
   net-new coverage Phase 4 adds beyond Vitest.
3. **Generation is the highest-risk e2e step** — real OpenAI takes 15–30s,
   server abort at 28s, mid-stream failures return HTTP 200 empty streams,
   and `ctx.waitUntil` persist can race `router.refresh()` before the editor
   appears. CI should mock the stream boundary or accept long timeouts +
   secrets.
4. **CI is declared but unwired** — `tech-stack.md` says GitHub Actions;
   `roadmap.md` parks CI/CD; zero workflow files. §5 gates (lint, typecheck,
   test, build, e2e) are documented requirements only.
5. **Cheapest rollout split** — (A) PR quality workflow: lint + tsc + vitest +
   `build` + `build:cf` (no secrets, harness is in-memory sqlite); (B) Playwright
   against `dev:local` (D1 migrate + `.dev.vars`) for critical-path smoke +
   redirect matrix; (C) deploy workflow stays separate per `deploy-plan.md`.

## Detailed Findings

### Critical user flow — sign-in → create → generate → edit

| Step | UI | API | Key files |
|------|----|-----|-----------|
| Sign in | `/login` — `LoginForm` credentials | NextAuth + D1 verify | [`login-form.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/app/login/login-form.tsx), [`auth.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/lib/auth.ts) |
| Create trip | Modal "Create trip" → destination/duration/budget | `POST /api/trips` → 201 | [`trip-create-modal.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/components/trip-create-modal.tsx), [`api/trips/route.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/app/api/trips/route.ts) |
| Generate | "Generate itinerary" → streaming preview | `POST …/itinerary` text stream | [`itinerary-generator.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/components/itinerary-generator.tsx), [`itinerary/route.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/app/api/trips/%5BtripId%5D/itinerary/route.ts) |
| Edit + save | Accordion days, inline fields, "Save changes" | `PATCH …/itinerary` → 204 | [`itinerary-editor.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/components/itinerary-editor.tsx) |

**Post-create navigation:** `router.push(/trips/${id})` lands on
[`trips/[tripId]/page.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/app/(protected)/trips/%5BtripId%5D/page.tsx)
→ `TripWorkspace` shows `ItineraryGenerator` when `itineraryJson` is null.

**Selectors (no testids):** Playwright role/label strategy — e.g.
`getByRole('button', { name: 'Create trip' })`,
`getByPlaceholder('Email')`, `getByRole('button', { name: 'Generate itinerary' })`,
`getByRole('button', { name: 'Save changes' })` (only visible when dirty).
Loaders expose `role="status"` ([`loader.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/components/loader.tsx)).

**Real vs mockable for e2e:**

| Dependency | Critical path? | Recommendation |
|------------|---------------|----------------|
| D1 local | Yes | Real — `dev-local.sh` applies migrations |
| `AUTH_SECRET` | Yes | Real — generate in CI (`openssl rand -hex 32`) |
| Credentials auth | Yes | Real — register + signIn against D1 |
| OpenAI / `streamObject` | Yes (generate step) | **Mock in CI** (Playwright route intercept or fixture stream) unless accepting 15–30s + cost |
| Email (Resend) | No | Skip — not on critical path |

### Risk #5 — page redirect (e2e-only gap)

**Mechanism:** [`(protected)/layout.tsx:15-18`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/app/(protected)/layout.tsx#L15-L18)
— `auth()` → `redirect(/login${callbackQuery()})`.

**Callback URL construction** ([`layout.tsx:38-57`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/app/(protected)/layout.tsx#L38-L57)):
- Primary: `x-opennext-initial-url` header (Cloudflare/OpenNext)
- Fallback: `next-url` header (`next dev`)

**Post-login return:** [`login-form.tsx:14`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/app/login/login-form.tsx#L14)
reads `callbackUrl` query param; default `/trips`.

**Protected pages:** `/trips`, `/trips/[tripId]`, `/profile` under
`src/app/(protected)/`.

**Public pages:** `/`, `/login`, `/reset-password` — must not redirect.

**No middleware** — S-01 removed `proxy.ts` / `auth-edge.ts` for OpenNext
compatibility. New pages must live under `(protected)/` or call `auth()`
themselves.

**Deferred explicitly from Phases 1–3:**
- `testing-trip-api-contract-ownership` — API 401 only; page redirect → Phase 4
- `testing-auth-account-lifecycle-routes` — same
- `test-plan.md` §6.6 — "page-layout redirect deferred to §3 Phase 4 e2e"

**Minimal e2e matrix (Risk #5 page half):**

| # | Visit | Session | Expected |
|---|-------|---------|----------|
| 1 | `/trips` | none | → `/login?callbackUrl=%2Ftrips` |
| 2 | `/profile` | none | → `/login?callbackUrl=%2Fprofile` |
| 3 | `/` | none | stays on `/` |
| 4 | `/login` → sign in | none → valid | `/trips` (default callback) |
| 5 | `/trips` after #1 login | valid | trips workspace visible |

Do **not** duplicate API 401 cases in e2e — already covered by Vitest route
tests (`route.test.ts`, `itinerary/route.test.ts`).

### Generation step — flake and timing risks

| Risk | Source | E2e implication |
|------|--------|-----------------|
| 28s server timeout | [`itinerary/route.ts:53`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/app/api/trips/%5BtripId%5D/itinerary/route.ts#L53) | Wait up to ~35s or mock stream |
| UI copy "15–30 seconds" | [`itinerary-generator.tsx:65-66`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/components/itinerary-generator.tsx) | Set Playwright timeout accordingly |
| Mid-stream 200 empty stream | `test-plan.md` §2 Risk #2 | Don't assert non-200 on abort |
| `waitUntil` vs `router.refresh()` race | route `onFinish` + generator `onFinish` | Poll for editor appearance, not single refresh |
| One-shot 409 on re-generate | [`itinerary/route.ts:81-85`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/app/api/trips/%5BtripId%5D/itinerary/route.ts#L81-L85) | Test flow must not double-POST |
| Save button hidden until dirty | [`itinerary-editor.tsx:262-267`](https://github.com/agnieszkakot93/tripSpirit/blob/dd4745e/src/components/itinerary-editor.tsx) | Edit a field before asserting Save |

**CI recommendation for generate:** Playwright `page.route()` intercept on
`POST **/itinerary` returning a canned text stream + trigger complete object
via test fixture, **or** seed trip with pre-generated `itinerary_json` via
`dev-local.sh db` SQL and skip generate in smoke v1 (narrower path but
misses Risk #2 cross-cutting). Plan should pick one explicitly.

### CI / infrastructure — current state and gaps

**Exists today:**

| Asset | Status |
|-------|--------|
| Vitest (`npm test`) | 10 files, 79 tests |
| `src/test/route-harness.ts` | In-memory sqlite — **no D1/wrangler in CI for unit/integration** |
| `scripts/dev-local.sh` | Migrate + `next dev --webpack` on :3000 |
| `wrangler.dev.jsonc` / `wrangler.jsonc` | D1 binding `tripsprint-ai-db` |
| `vitest.config.ts` | Node environment, `@` alias |

**Missing:**

| Gap | §5 impact |
|-----|-----------|
| `.github/workflows/*` | No PR gates |
| `typecheck` / `check` npm scripts | lint + typecheck required but ad hoc |
| Playwright / `e2e/` directory | e2e on critical flow required after Phase 4 |
| `test-plan.md` §6.5 | Still TBD |
| Deploy CI | Sketched in `deploy-plan.md` Phase 5 only |

**Declared gates (`test-plan.md` §5):**

1. lint + typecheck — local + CI, required
2. unit + integration — local + CI, required
3. e2e critical flow — CI on PR, required after Phase 4
4. `npm run build` — required
5. pre-prod smoke (`preview:cf`) — optional

**Roadmap tension:** `roadmap.md` parks "GitHub Actions CI/CD" as non-PRD;
`test-plan.md` Phase 4 requires CI gate. Quality CI can ship without
auto-deploy.

**Suggested PR workflow (quality only):**

```yaml
# .github/workflows/ci.yml — parallel jobs
- npm ci
- npm run lint
- npx tsc --noEmit
- npm test
- npm run build
- npm run build:cf   # catches OpenNext/Cloudflare breakage §5 misses with build alone
```

**Suggested e2e job (Phase 4):**

```yaml
- npx wrangler d1 migrations apply tripsprint-ai-db --local
- write .dev.vars (AUTH_SECRET, optional OPENAI_API_KEY)
- npx playwright install --with-deps chromium
- ./scripts/dev-local.sh dev &   # or playwright webServer
- wait-on http://localhost:3000/login
- npx playwright test
```

**package.json additions to plan:**

```json
"typecheck": "tsc --noEmit",
"check": "npm run lint && npm run typecheck && npm test && npm run build && npm run build:cf",
"e2e": "playwright test"
```

### What Phase 4 should NOT re-test (per test-plan + prior phases)

- Trip API 401, ownership 404, persist read-back — Vitest Phases 1–3
- Forgot/reset/delete auth abuse paths — Phase 2
- Exact AI itinerary text — §7 exclusion
- Landing page — §7 exclusion
- UI snapshot tests — §7 exclusion

## Code References

- `src/app/(protected)/layout.tsx:15-18` — page auth redirect
- `src/app/login/login-form.tsx:14,92-102` — callbackUrl + signIn
- `src/components/trip-create-modal.tsx:29-51` — create trip POST
- `src/components/itinerary-generator.tsx:16-84` — useObject generation UX
- `src/components/itinerary-editor.tsx:113-136,262-267` — PATCH save
- `src/app/api/trips/[tripId]/itinerary/route.ts:53,81-85,106-125` — timeout, 409, onFinish persist
- `scripts/dev-local.sh:1-20` — local dev entry (migrate + dev)
- `package.json:5-18` — scripts (no e2e/check/typecheck)
- `src/test/route-harness.ts` — Vitest harness (CI-friendly, no secrets)
- `vitest.config.ts` — test runner config

## Architecture Insights

- **Two Risk #5 mechanisms:** layout redirect (pages) vs per-route `auth()`
  → 401 JSON (APIs). Phase 4 e2e owns the page half only.
- **No middleware safety net** — protection is opt-in via `(protected)/`
  route group; forgetting to place a page there leaves it public.
- **E2e server target:** `dev:local` (`next dev --webpack` + local D1) on
  port 3000 matches `AUTH_URL` and login callbacks; `preview:cf` (:8787) is
  higher-fidelity optional smoke on main, not required for first Playwright
  wiring.
- **Vitest integration tests need zero CI secrets** — mocks at auth/db/AI
  seams; e2e needs `AUTH_SECRET` minimum, generate step needs OpenAI or mock.
- **Cost × signal still applies** — don't duplicate API matrix in browser;
  one happy-path smoke + redirect matrix is the Phase 4 sweet spot.

## Historical Context (from prior changes)

- `context/changes/testing-trip-api-contract-ownership/` — deferred page
  redirect to Phase 4; bootstrapped route harness
- `context/changes/testing-auth-account-lifecycle-routes/` — deferred layout
  redirect; flagged `[tripId]/page` `notFound()` divergence if reached
  without userId
- `context/changes/testing-itinerary-generation-shape-contract/` — generation
  persist/abort proven at route level with mocked `streamObject`; UI e2e
  explicitly out of scope
- `context/changes/s-01/plan.md` — removed middleware; moved guard to
  `(protected)/layout.tsx`; verified redirect under `preview:cf`
- `context/changes/deploy-plan.md` — deploy workflow sketch (migrations +
  wrangler deploy); separate from quality gates

## Related Research

- `context/changes/testing-itinerary-generation-shape-contract/research.md` —
  Risk #2 mid-stream semantics, AI mock pattern for integration
- `context/changes/testing-auth-account-lifecycle-routes/research.md` —
  Risk #5 dual mechanism, page redirect deferred
- `context/changes/testing-trip-api-contract-ownership/research.md` —
  decentralized auth, no middleware

## Open Questions

1. **Generate in e2e — real OpenAI vs mock?** Real proves full stack but
   costs 15–30s + API key per CI run; mock (Playwright intercept or test
   hook) is faster/flakier-tradeoff inverted. Recommend mock for CI smoke,
   optional manual/nightly real-API job.
2. **Smoke scope v1:** full sign-in→create→generate→edit vs split into (a)
   redirect-only spec + (b) authenticated flow with DB-seeded itinerary
   skipping generate? Latter is cheaper; former matches test-plan wording.
3. **CI scope in this change:** quality gates only vs quality + e2e in one
   PR? Research suggests sequencing: wire `ci.yml` first, then Playwright.
4. **Unpark roadmap CI parking?** Add footnote that quality PR gates are in
   scope even if auto-deploy stays manual.
5. **`build` vs `build:cf` in §5:** plan should add `build:cf` to gate list
   — `next build` alone misses OpenNext workerd breakage.
6. **Add `data-testid` hooks?** Not required; plan can stick to accessible
   selectors or add minimal testids only if flake forces it.
