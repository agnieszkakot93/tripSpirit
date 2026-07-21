# Critical-Path E2E Smoke + CI Gate — Implementation Plan

## Overview

Wire GitHub Actions quality gates (lint, typecheck, vitest, build, `build:cf`), add Playwright smoke tests for test-plan Phase 4 — full sign-in → create → generate → edit happy path plus Risk #5 page redirect matrix — and document the e2e pattern in cookbook §6.5. Generation is mocked at the stream boundary (fixture env + recorded stream shape) so CI stays fast and D1 persist still runs. Deploy CI stays out of scope (`deploy-plan.md` Phase 5).

## Current State Analysis

- Vitest Phases 1–3 complete: 79 tests, route harness, mocked-AI integration pattern for itinerary route.
- **No** Playwright, **no** `.github/workflows/`, **no** `typecheck` / `check` / `e2e` npm scripts.
- Critical UI path exists: `/login` → create modal → `ItineraryGenerator` (`useObject`) → `ItineraryEditor` PATCH save.
- Risk #5 **page** redirect deferred from Phases 1–3: `(protected)/layout.tsx` only; APIs covered by Vitest 401.
- `dev:local` (`scripts/dev-local.sh`) is the e2e server target: D1 migrate + `next dev --webpack` on :3000.
- No `data-testid` attributes — accessible selectors only (decision).

### Key Discoveries:

- Client-only Playwright `route.fulfill` on `POST …/itinerary` **skips the server handler** → `onFinish` never persists; e2e mock must keep the route's persist path alive (`research.md` generate section)
- `waitUntil` + `router.refresh()` race after generate — e2e must poll for editor, not assume instant transition
- CI quality job needs **no secrets** (Vitest uses in-memory sqlite); e2e needs `AUTH_SECRET` + `E2E_ITINERARY_FIXTURE` only
- `build:cf` catches OpenNext breakage that `next build` alone misses (`research.md` §CI)

## Desired End State

- `.github/workflows/ci.yml` runs lint, typecheck, vitest, build, and `build:cf` on PR/push.
- `e2e/auth-redirect.spec.ts` locks Risk #5 page redirect + callback round-trip.
- `e2e/critical-path.spec.ts` runs register (UI) → create → generate (fixture stream) → edit → save with DB-visible outcome after reload.
- `npm run e2e` and CI e2e job green; `test-plan.md` §6.5 / §6.6 / §3 Phase 4 updated.

### Key Discoveries:

- Test-plan §5 lists `build` but not `build:cf` — add `build:cf` to gate table in Phase 3
- Roadmap parks CI/CD; quality PR gates are in scope without auto-deploy

## What We're NOT Doing

- Deploy workflow / remote D1 migrate / `wrangler deploy` (`deploy-plan.md` Phase 5)
- Real OpenAI in CI (decision: fixture stream boundary)
- Re-testing API 401/ownership/persist matrices (Vitest Phases 1–3)
- `preview:cf` / workerd smoke in CI (optional §5 pre-prod — deferred)
- `data-testid` hooks (decision: accessible selectors)
- Landing page, snapshot, or exact AI text tests (§7 exclusions)
- UI coverage for forgot-password / delete-account (Phase 2 integration scope)

## Implementation Approach

Phased rollout mirroring Phases 1–3: **CI gates first** (no browser, no secrets), **Playwright second** (fixture-backed generate + redirect specs), **cookbook third**. E2e auth via **register tab in UI** with unique email per run (decision). Generation mock: **`E2E_ITINERARY_FIXTURE` env** on the itinerary POST route returns a deterministic stream compatible with `useObject` and executes the normal `onFinish` + `updateTripItinerary` path — satisfies "stream boundary mock" without blocking the server handler.

## Critical Implementation Details

**Why not client-only Playwright fulfill:** fulfilling `POST …/itinerary` from the browser prevents the Next.js handler from running, so `itinerary_json` never lands in D1 and the editor won't appear after `router.refresh()`. The fixture env keeps the handler alive while skipping OpenAI.

**Fixture stream contract:** record one successful `toTextStreamResponse()` body from local dev (or construct from AI SDK text-stream object format) for a complete itinerary matching `trip.durationDays`. Reuse `sampleItinerary(n)` shape from `itinerary.test.ts` as the persisted object. Guard with `env.E2E_ITINERARY_FIXTURE === "true"` only — never enabled in production Worker secrets.

**Post-generate wait:** after Generate, poll until `ItineraryEditor` surface appears (e.g. "Save changes" becomes available after edit, or day accordion headings) with timeout ≥ 35s budget but fixture should complete in seconds.

---

## Phase 1: CI quality gates

### Overview

Lock test-plan §5 non-e2e gates in GitHub Actions and npm scripts.

### Changes Required:

#### 1. npm scripts

**File**: `package.json`

**Intent**: Add first-class `typecheck`, aggregate `check`, and placeholder `e2e` script (implemented Phase 2).

**Contract**: `"typecheck": "tsc --noEmit"`, `"check": "npm run lint && npm run typecheck && npm test && npm run build && npm run build:cf"`, `"e2e": "playwright test"` (Playwright dep added Phase 2).

#### 2. GitHub Actions workflow

**File**: `.github/workflows/ci.yml`

**Intent**: On `pull_request` and `push` to `main`, run quality gates on `ubuntu-latest` with Node 20.

**Contract**: Steps — `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run build:cf`. Single job is fine; no secrets. `better-sqlite3` native build must succeed on Ubuntu (standard `npm ci`).

### Success Criteria:

#### Automated Verification:

- `npm run check` passes locally
- Workflow file validates (YAML syntax)
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run build:cf` all pass

#### Manual Verification:

- Workflow triggers on PR in GitHub UI (after push)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Playwright e2e smoke

### Overview

Install Playwright, add fixture-guarded generation seam, and ship redirect + full critical-path specs.

### Changes Required:

#### 1. Playwright scaffold

**Files**: `playwright.config.ts`, `e2e/` directory, `package.json` devDependency `@playwright/test`

**Intent**: Configure Chromium, `baseURL: http://localhost:3000`, `webServer` that runs D1 migrate + dev server (mirror `dev-local.sh` steps: `wrangler d1 migrations apply tripsprint-ai-db --local` then `next dev --webpack` or invoke `./scripts/dev-local.sh dev` after migrate in CI).

**Contract**: `testDir: 'e2e'`, reasonable `timeout` (60s+ for critical-path), `reuseExistingServer: !process.env.CI`. CI e2e job writes `.dev.vars` with generated `AUTH_SECRET`, `AUTH_URL=http://localhost:3000`, `E2E_ITINERARY_FIXTURE=true` (no `OPENAI_API_KEY` required when fixture active).

#### 2. E2E itinerary fixture seam

**File**: `src/app/api/trips/[tripId]/itinerary/route.ts` (+ `cloudflare-env.d.ts` / `wrangler.dev.jsonc` if env typing needed)

**Intent**: When `E2E_ITINERARY_FIXTURE` is truthy, bypass `streamObject`/OpenAI and return a canned `toTextStreamResponse()` while invoking the same `onFinish` persist logic with a complete fixture itinerary for `trip.durationDays`.

**Contract**: Guard is env-only; production deploy must not set this var. Fixture object must pass `isItineraryCompleteForDuration`. Keep normal path unchanged when flag unset.

#### 3. Auth redirect spec (Risk #5)

**File**: `e2e/auth-redirect.spec.ts`

**Intent**: Unauthenticated visits to `/trips` and `/profile` redirect to `/login` with `callbackUrl`; `/` stays public; sign-in returns to callback destination.

**Contract**: Accessible selectors only. Do not assert exact 302 vs 307 — assert URL contains `/login` and `callbackUrl`. Register/sign-in via UI where needed.

#### 4. Critical-path spec

**File**: `e2e/critical-path.spec.ts`

**Intent**: Single happy-path: register (unique email) → create trip → generate itinerary (fixture stream) → edit activity field → save → reload/assert persistence.

**Contract**: Use `getByRole` / `getByPlaceholder` / `getByLabel` patterns from research. Dirty edit required before "Save changes". Poll for editor after generate. Assert shape (day count, edited field survives reload) — not exact AI prose.

#### 5. CI e2e job

**File**: `.github/workflows/ci.yml` (extend)

**Intent**: Add `e2e` job depending on `quality` (or parallel with separate migrate step): install Playwright browsers, write `.dev.vars`, migrate local D1, run `npm run e2e`.

**Contract**: `npx playwright install --with-deps chromium`. Fail job if e2e fails. No OpenAI secret when fixture enabled.

### Success Criteria:

#### Automated Verification:

- `npm run e2e` passes locally with `E2E_ITINERARY_FIXTURE=true` in `.dev.vars`
- Redirect spec covers `/trips` and `/profile` unauthenticated redirect
- Critical-path spec completes without real OpenAI
- `npm test` still passes (route unit/integration unchanged)
- `npx tsc --noEmit` passes

#### Manual Verification:

- Test titles make Risk #5 (redirect) and critical-path intent obvious
- Editor appears after generate without manual refresh in browser

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Cookbook + rollout notes

### Overview

Document e2e pattern and mark test-plan Phase 4 complete.

### Changes Required:

#### 1. Update test-plan cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.5 TBD with Playwright + `dev:local` + fixture env pattern; add §6.6 Phase 4 note; update §3 Phase 4 status to `complete` with change folder; add `build:cf` to §5 gates table; update §4 e2e/CI rows.

**Contract**: §6.5 may reference `e2e/critical-path.spec.ts`, `e2e/auth-redirect.spec.ts`, `E2E_ITINERARY_FIXTURE`, accessible selectors, poll-after-generate guidance.

#### 2. Change metadata

**File**: `context/changes/critical-path/change.md`

**Intent**: Keep `status` / `updated` consistent through implementation.

### Success Criteria:

#### Automated Verification:

- §6.5 documents e2e setup (no TBD)
- §3 Phase 4 marked complete with `context/changes/critical-path/`
- `npm run check` and `npm run e2e` still pass

#### Manual Verification:

- Fresh agent reading §6.5 could add another browser smoke without re-reading research

**Implementation Note**: After completing this phase, follow downstream continuation toward `/10x-implement` completion and `/10x-test-plan` rollout mark.

---

## Testing Strategy

### Unit Tests:

- No new unit tests required; existing Vitest suites remain regression floor.

### E2E Tests:

- `auth-redirect.spec.ts` — Risk #5 page redirect matrix
- `critical-path.spec.ts` — full happy path with fixture generation

### Manual Testing Steps:

1. Run `npm run check` and `npm run e2e` locally
2. Push branch and confirm GitHub Actions `quality` + `e2e` jobs green
3. Skim spec titles against Risks #2 (cross-cutting happy path) and #5 (redirect)

## Performance Considerations

- Fixture generation keeps e2e under seconds, not 15–30s OpenAI wall clock.
- CI e2e uses Chromium only (not full browser matrix).

## Migration Notes

- `E2E_ITINERARY_FIXTURE` is dev/CI-only; document in §6.5 and `.env.example` comment — do not set on production Worker.

## References

- Related research: `context/changes/critical-path/research.md`
- Test plan Phase 4: `context/foundation/test-plan.md` §3, §5, §6.5
- Prior patterns: `context/changes/testing-itinerary-generation-shape-contract/plan.md`
- Deploy (out of scope): `context/changes/deploy-plan.md` Phase 5
- Dev server: `scripts/dev-local.sh`
- Protected layout: `src/app/(protected)/layout.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: CI quality gates

#### Automated

- [x] 1.1 `npm run check` passes locally
- [x] 1.2 Workflow file validates (YAML syntax)
- [x] 1.3 `npm run lint`, `typecheck`, `test`, `build`, `build:cf` all pass

#### Manual

- [x] 1.4 Workflow triggers on PR in GitHub UI (after push)

### Phase 2: Playwright e2e smoke

#### Automated

- [ ] 2.1 `npm run e2e` passes locally with fixture env
- [ ] 2.2 Redirect spec covers `/trips` and `/profile` unauthenticated redirect
- [ ] 2.3 Critical-path spec completes without real OpenAI
- [ ] 2.4 `npm test` still passes
- [ ] 2.5 `npx tsc --noEmit` passes

#### Manual

- [ ] 2.6 Test titles make Risk #5 and critical-path intent obvious
- [ ] 2.7 Editor appears after generate without manual refresh

### Phase 3: Cookbook + rollout notes

#### Automated

- [ ] 3.1 §6.5 documents e2e setup (no TBD)
- [ ] 3.2 §3 Phase 4 marked complete with change folder
- [ ] 3.3 `npm run check` and `npm run e2e` still pass

#### Manual

- [ ] 3.4 Fresh-agent check: §6.5 alone is enough to add browser smoke
