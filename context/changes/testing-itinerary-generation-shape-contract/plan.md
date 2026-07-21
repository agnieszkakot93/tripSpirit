# Itinerary Generation & Shape-Contract Tests — Implementation Plan

## Overview

Fill the Risk #3 over-long unit gap, then add colocated Vitest integration tests for `POST`/`PATCH` `/api/trips/[tripId]/itinerary` that mock the AI SDK boundary and prove Risk #2 (abort/empty → no partial persist), Risk #3 (incomplete object never persisted), and residual Risk #5 itinerary 401. Document the AI-mock pattern in cookbook §6.4 and backport the mid-stream “non-200” correction into §2 Risk #2. This is a regression guard — research confirmed S-03 already implements the production protections.

## Current State Analysis

- Production POST uses `streamObject` + `AbortSignal.timeout(28_000)` + `onFinish` that persists only when `object && isItineraryCompleteForDuration(...)`. Mid-stream failures return HTTP **200** empty/incomplete streams, not JSON non-200. Pre-stream failures are `401` / `404` / `409` / `500`.
- One-shot: existing `itineraryJson` → `409`. DB write via `updateTripItinerary` only when `itinerary_json IS NULL`.
- Helper units in `itinerary.test.ts` cover short/exact/non-sequential; **over-long is missing**.
- No `route.test.ts` beside the itinerary route. Harness has auth/db/seeds but no AI helpers.
- Phase 1–2 established: mock runtime seams only; assert HTTP + DB read-back; never assert exact AI text.

## Desired End State

- `itinerary.test.ts` locks short / exact / over-long / non-sequential against a literal duration oracle.
- Colocated `src/app/api/trips/[tripId]/itinerary/route.test.ts` green under `npm test`, covering abort/empty no-persist, complete persist, incomplete no-persist, 409, POST+PATCH 401.
- `context/foundation/test-plan.md` §6.4 / §6.6 document the AI + Cloudflare mock pattern; §2 Risk #2 wording matches mid-stream reality.

### Key Discoveries:

- Mid-stream abort/upstream → **200 stream + empty `onFinish`**, not non-200 (`research.md`; route comment L127–128)
- Mock `ai.streamObject` (capture `onFinish` / `abortSignal`) + `@/lib/cloudflare-context` (`OPENAI_API_KEY`, `ctx.waitUntil`) — do not mock queries/helpers
- Over-long unit gap is the only helper hole for Risk #3; “never persisted” needs one route case
- PATCH in this change is **401 only** (decision) — no ownership/persist matrix

## What We're NOT Doing

- Production code / schema / AI SDK migration (`streamObject` → `streamText`)
- Separate `updateTripItinerary` unit suite (decision — prove via route DB read-back)
- Full PATCH ownership / 204 persistence matrix (Risk #6-style — deferred)
- Client `useObject` / UI e2e (Phase 4)
- Asserting exact generated text or OpenAI HTTP mocking
- Concurrent first-time POST races (accepted gap; `IS NULL` is second layer)
- Page-layout redirect (Phase 4 e2e)
- New npm dependencies

## Implementation Approach

Units first (cheap Risk #3), then one route file that owns the AI mock harness for Risks #2/#3 persistence + 401 residual, then cookbook + §2 backport. Prefer real `isItineraryCompleteForDuration` / `updateTripItinerary` against in-memory sqlite; drive abort with a **short** controllable `AbortSignal.timeout` stub (~50ms), not a 28s wall clock.

Mocking policy (fixed for this rollout):

- Mock: `@/lib/auth`, `@/lib/db`, `@/lib/cloudflare-context`, `ai` (`streamObject`)
- Optionally stub `AbortSignal.timeout` (or equivalent) to a short ms for the abort case
- Do not mock: `@/lib/trips/queries`, `@/lib/trips/itinerary` helpers, drizzle internals
- Assert: HTTP status/stream class **and** DB read-back of `itinerary_json` where write/non-write matters

## Critical Implementation Details

**`streamObject` mock:** Hoist a controllable mock before importing the route. Capture options (`onFinish`, `abortSignal`). Return `{ toTextStreamResponse: () => new Response("", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }) }`. After `POST`, invoke captured `onFinish` (or let abort fire) and flush `waitUntil` / microtasks before DB asserts.

**Short abort (decision):** Do not wait 28s. Stub `AbortSignal.timeout` to ~50ms (or pass a short signal the mock respects) so abort → empty/`undefined` object path runs quickly. Optionally assert production code still requests a timeout signal; do not require asserting the literal `28000` in every case.

**§2 backport (decision):** Final phase edits Risk #2 “What would prove protection” (and guidance cells if needed) to distinguish pre-stream JSON non-200 vs mid-stream 200 empty + no persist — research-authorized in-place §2 correction only; no new file:line anchors in §1–§2.

---

## Phase 1: Unit — over-long shape fixtures

### Overview

Close the Risk #3 helper gap with oracle-safe over-long (and tighten fixtures around a literal duration).

### Changes Required:

#### 1. Extend itinerary unit tests

**File**: `src/lib/trips/itinerary.test.ts`

**Intent**: Against a literal `TRIP_DURATION_DAYS` (e.g. 3 or 5), assert `buildItinerarySchemaForDuration` rejects over-long and `isItineraryCompleteForDuration` returns false for over-long. Keep existing short/exact/non-sequential coverage; do not derive expected N from helper internals or Zod describe text.

**Contract**: Fixture builder remains `sampleItinerary(n)` (or equivalent). Over-long = `sampleItinerary(DURATION + 1)` vs schema/guard for `DURATION`. Optional boundary fixtures at 1 / 14 are allowed but not required.

### Success Criteria:

#### Automated Verification:

- Schema rejects over-long; completeness returns false for over-long
- Existing short/exact/non-sequential cases still pass
- `npx vitest run src/lib/trips/itinerary.test.ts` passes
- `npx tsc --noEmit` passes

#### Manual Verification:

- Test names make Risk #3 (day-count mismatch) obvious without reading research

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Route — generation integration tests

### Overview

Lock Risk #2 persist/abort paths, Risk #3 never-persisted wire-up, 409 one-shot, and POST/PATCH 401 via mocked `streamObject`.

### Changes Required:

#### 1. Itinerary route tests

**File**: `src/app/api/trips/[tripId]/itinerary/route.test.ts`

**Intent**: Colocated integration suite using `setupRouteTest` + mocks for auth, db, Cloudflare context, and `ai.streamObject`. Cover:

1. Unauthenticated POST → `401` (Risk #5 residual)
2. Unauthenticated PATCH → `401` (Risk #5 residual; no further PATCH cases)
3. Existing itinerary → `409` + row unchanged
4. Short abort / empty finish (`onFinish` undefined or abort path) → stream-class response + `itinerary_json` still null
5. Incomplete object `onFinish` → no persist (Risk #3 wire-up)
6. Complete object `onFinish` → `itinerary_json` set (happy path for the guard)
7. Optional: missing `OPENAI_API_KEY` → `500` (cheap pre-stream)

**Contract**: Dynamic params `{ params: Promise.resolve({ tripId }) }`. Seed trip with known `durationDays` matching fixtures. Flush `ctx.waitUntil` before DB read-back. Do not assert exact AI text. Do not mock `updateTripItinerary`.

#### 2. Cloudflare + AI mock wiring

**Files**: same test file (and only extend `src/test/route-harness.ts` if a tiny reusable helper clearly pays for itself — default: keep mocks local like Phase 2 email)

**Intent**: Stub `getAppCloudflareContext` with `OPENAI_API_KEY` + `waitUntil` that runs/awaits the promise. Hoist `streamObject` mock; support short `AbortSignal.timeout` for the abort case.

**Contract**: Mirror Phase 2 `vi.hoisted` + `vi.mock` ordering (mocks before route import).

### Success Criteria:

#### Automated Verification:

- Abort/empty and incomplete paths leave `itinerary_json` null; complete path persists
- 409 one-shot and POST/PATCH 401 pass
- `npx vitest run src/app/api/trips/[tripId]/itinerary` passes
- `npm test` passes
- `npx tsc --noEmit` passes

#### Manual Verification:

- Test names make Risk #2 (no partial persist) and Risk #3 (incomplete never written) obvious

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Cookbook + §2 Risk #2 correction

### Overview

Document the AI-mock / `onFinish` pattern and align §2 Risk #2 with mid-stream reality.

### Changes Required:

#### 1. Update cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.4 TBD with the concrete pattern (mock `ai.streamObject` + Cloudflare context; capture `onFinish`; assert DB; never exact text; short abort stub). Add §6.6 Phase 3 note. Update §4 external-boundary row if it still says AI mocking is “none yet.” Soften §2 Risk #2 “What would prove protection” (and related guidance cells as needed) so pre-stream non-200 vs mid-stream 200 empty + no persist are both accurate — no new file:line anchors in §1–§2.

**Contract**: §6 may name paths under `src/app/api/trips/[tripId]/itinerary/` and `src/lib/trips/itinerary.test.ts`.

#### 2. Change metadata

**File**: `context/changes/testing-itinerary-generation-shape-contract/change.md`

**Intent**: Keep frontmatter status/updated consistent as implement completes.

**Contract**: `status` / `updated` reflect completion when Progress is fully checked.

### Success Criteria:

#### Automated Verification:

- §6.4 documents AI mock / onFinish / DB read-back (no TBD for those seams)
- §2 Risk #2 no longer claims mid-stream failures must be non-200
- `npm test` still passes

#### Manual Verification:

- A fresh agent reading only §6.4 could add another generation-like route test without re-reading research

**Implementation Note**: After completing this phase, follow the downstream continuation rule toward `/10x-implement` completion and then `/10x-test-plan` to mark rollout Phase 3 complete.

---

## Testing Strategy

### Unit Tests:

- Over-long (+ existing short/exact/non-sequential) on schema + completeness with literal duration oracle

### Integration Tests:

- Itinerary POST: 401, 409, abort/empty no-persist, incomplete no-persist, complete persist
- Itinerary PATCH: 401 only

### Manual Testing Steps:

1. Run `npm test` and confirm itinerary unit + route suites are included
2. Skim test titles against Risks #2 / #3 / #5 residual
3. Confirm §6.4 describes AI mock + short abort + DB read-back; §2 Risk #2 matches mid-stream semantics

## Performance Considerations

Avoid 28s wall-clock aborts — use short controllable timeout (~50ms). In-memory sqlite per `beforeEach` matches existing route tests.

## Migration Notes

None. Test-only change (plus foundation doc edits); no schema or runtime behavior changes.

## References

- Related research: `context/changes/testing-itinerary-generation-shape-contract/research.md`
- Test plan Phase 3: `context/foundation/test-plan.md` §3
- Prior patterns: `context/changes/testing-auth-account-lifecycle-routes/plan.md`, trip `route.test.ts`
- Handlers: `src/app/api/trips/[tripId]/itinerary/route.ts`
- Helpers: `src/lib/trips/itinerary.ts`, `src/lib/trips/queries.ts` (`updateTripItinerary`)
- Harness: `src/test/route-harness.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Unit — over-long shape fixtures

#### Automated

- [x] 1.1 Schema rejects over-long; completeness returns false for over-long — aaced73
- [x] 1.2 Existing short/exact/non-sequential cases still pass — aaced73
- [x] 1.3 `npx vitest run src/lib/trips/itinerary.test.ts` passes — aaced73
- [x] 1.4 `npx tsc --noEmit` passes — aaced73

#### Manual

- [x] 1.5 Test names make Risk #3 (day-count mismatch) obvious without reading research — aaced73

### Phase 2: Route — generation integration tests

#### Automated

- [x] 2.1 Abort/empty and incomplete paths leave `itinerary_json` null; complete path persists
- [x] 2.2 409 one-shot and POST/PATCH 401 pass
- [x] 2.3 `npx vitest run src/app/api/trips/[tripId]/itinerary` passes
- [x] 2.4 `npm test` passes
- [x] 2.5 `npx tsc --noEmit` passes

#### Manual

- [x] 2.6 Test names make Risk #2 (no partial persist) and Risk #3 (incomplete never written) obvious

### Phase 3: Cookbook + §2 Risk #2 correction

#### Automated

- [ ] 3.1 §6.4 documents AI mock / onFinish / DB read-back (no TBD for those seams)
- [ ] 3.2 §2 Risk #2 no longer claims mid-stream failures must be non-200
- [ ] 3.3 `npm test` still passes

#### Manual

- [ ] 3.4 Fresh-agent check: §6.4 alone is enough to add a generation-like route test
