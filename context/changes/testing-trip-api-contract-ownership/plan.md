# Trip API Contract & Ownership — Implementation Plan

## Overview

Bootstrap a reusable Vitest route-test harness and add integration tests that prove trip API routes enforce ownership (IDOR → 404 + row unchanged), reject unauthenticated requests with 401, and persist valid saves (with DB read-back) while rejecting invalid bodies with 400. This is a regression guard — research confirmed the routes are already well-defended.

## Current State Analysis

- Trip handlers are thin: `auth()` → validate → `getDb()` → owner-scoped query. Seams to stub: `@/lib/auth` and `@/lib/db` only.
- Ownership is a query-layer invariant (`userId` in every `WHERE`). Wrong-owner and missing both return **404**; status alone cannot prove "I couldn't touch your row" — DB read-back is the oracle.
- Auth is decentralized: no `middleware.ts`; each route must call `auth()` itself. Page layout redirect is a separate mechanism (out of scope here; Phase 4 e2e).
- Vitest is configured (`environment: "node"`) with three unit files under `src/lib/trips/`. `queries.test.ts` already builds an in-memory better-sqlite3 + drizzle DB — the pattern to extract and reuse.
- No route integration tests exist yet. Validation is custom `validateTripBody` (not zod). PATCH is full-replace (all fields required).

## Desired End State

- Shared helpers under `src/test/` let any route test spin up an in-memory DB and a mock session.
- Colocated `route.test.ts` files beside the trip list/create and `[tripId]` handlers cover Risks #1, #5 (API half), and #6 for trip CRUD.
- `npm test` is green and includes those route cases.
- `context/foundation/test-plan.md` §6.2 and §6.3 document the harness and endpoint-test pattern so Phases 2–3 can reuse them.

### Key Discoveries:

- Wrong-owner oracle is **DB row unchanged**, not 404 alone — `research.md` Summary §1; handlers at `src/app/api/trips/[tripId]/route.ts`
- Mock only `auth` + `getDb`; never mock `queries` / `validation` — research harness option (a)
- PATCH = PUT semantics — partial body → 400 before DB — `validateTripBody` + PATCH handler
- Existing DI-friendly queries take `db` as first arg; route tests exercise handlers, then read back via the same sqlite handle

## What We're NOT Doing

- Page-layout redirect / e2e for Risk #5 (Phase 4)
- Itinerary PATCH / activity-edit / generation routes (Phase 3; Risk #2/#3)
- `@cloudflare/vitest-pool-workers` or `wrangler unstable_dev` harness
- New npm dependencies
- Removing the stale `auth-edge.ts` comment in `auth.ts`
- Backporting research refinements into test-plan §2 (deferred unless `--refresh`)
- Happy-path-only coverage that skips wrong-owner or unauthenticated cases

## Implementation Approach

Extract shared test helpers first (so Phase 2–3 inherit them), then add colocated route tests in two layers: auth/ownership (fail closed), then persistence/validation (write landed / rejected). Finish by writing cookbook §6.2 / §6.3 from what actually shipped.

Mocking policy (fixed for this rollout):

- Mock: `@/lib/auth` (`auth()`), `@/lib/db` (`getDb()` → in-memory drizzle)
- Do not mock: `@/lib/trips/queries`, `@/lib/trips/validation`, drizzle internals
- Assert: HTTP status + body **and** persisted row via the same sqlite handle

## Critical Implementation Details

**`vi.mock` hoisting:** Mock factories for `@/lib/auth` and `@/lib/db` must be declared before importing the route handlers (Vitest hoists `vi.mock`). Prefer a shared setup helper that configures mocks and returns `{ db, sqlite, setSession }` rather than scattering mock setup per file.

**Params shape:** `[tripId]` handlers take `{ params: Promise<{ tripId: string }> }` — tests must pass a Promise-wrapped params object, not a plain object.

**Schema seeding:** Prefer loading table DDL consistent with `queries.test.ts` / migration `users` + `trips` (+ FK). Full Auth.js tables are unnecessary for trip CRUD tests; seed only what the FK requires (`users` then `trips`).

---

## Phase 1: Shared route-test harness

### Overview

Create reusable helpers so route tests can get an in-memory DB and a controllable session without new dependencies.

### Changes Required:

#### 1. Test helpers module

**File**: `src/test/route-harness.ts` (or `src/test/db.ts` + `src/test/session.ts` if split is clearer)

**Intent**: Extract `makeTestDb()`, `seedUser()`, `seedTrip()`, and session/mock wiring (`mockSession` / `setSession`) so trip route tests — and later auth/lifecycle tests — share one harness.

**Contract**: `makeTestDb()` returns `{ db: AppDatabase; sqlite: Database.Database }` with `users` + `trips` schema applied. Session helper lets tests set `null` (unauthenticated), `{ user: { id } }` (authenticated), or a session missing `user.id`. `getDb` mock resolves to the current in-memory `db`. Mirror the inline schema approach in `src/lib/trips/queries.test.ts:17-42`; optionally refactor that file to import `makeTestDb` later (not required this phase).

### Success Criteria:

#### Automated Verification:

- Helpers module exists and typechecks
- A smoke import from a new empty/describe-only test file resolves `@/test/...` (or relative path) without Vitest config changes beyond existing `@` alias
- `npx tsc --noEmit` passes
- `npm test` still passes existing unit tests

#### Manual Verification:

- Helper API is obvious enough that Phase 2 could copy-paste a 5-line `beforeEach` without reading research again

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Auth + ownership route cases

### Overview

Lock Risk #5 (API 401) and Risk #1 (IDOR) on trip list/create and `[tripId]` handlers.

### Changes Required:

#### 1. List/create route tests

**File**: `src/app/api/trips/route.test.ts`

**Intent**: Call `GET` / `POST` handlers directly with mocked session + DB. Prove unauthenticated → 401 `{ error: "Unauthorized" }`. Prove authenticated list/create happy path enough to contrast (create seeds for later ownership tests if useful).

**Contract**: Unauthenticated GET and POST return 401. Authenticated POST with valid body returns 201 and inserts a row owned by the session user id (not a body-supplied userId). Do not test itinerary routes.

#### 2. Trip-by-id route tests (auth + ownership)

**File**: `src/app/api/trips/[tripId]/route.test.ts`

**Intent**: Prove unauthenticated GET/PATCH/DELETE → 401. Prove wrong-owner GET → 404 `{ error: "Not found" }`. Prove wrong-owner PATCH and DELETE → 404 **and** target row unchanged in DB (destination/fields still original; row still present after DELETE attempt).

**Contract**: Seed owner `u1` trip and session as `u2` (or null). Assert status + body; for mutate verbs, re-read via sqlite/`getTripForUser` with owner id to confirm no mutation. Include one owner GET happy path for contrast.

### Success Criteria:

#### Automated Verification:

- New tests fail if ownership `userId` predicate were removed from update/delete/get (conceptually: wrong-owner would succeed)
- `npx vitest run src/app/api/trips` passes
- `npm test` passes
- `npx tsc --noEmit` passes

#### Manual Verification:

- Skimming the test names makes Risks #1 and #5 (API) obvious without reading research

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Persistence + validation route cases

### Overview

Lock Risk #6: valid saves land in DB; invalid/partial bodies return 400 and write nothing.

### Changes Required:

#### 1. Persistence assertions on list/create + trip-by-id tests

**Files**: `src/app/api/trips/route.test.ts`, `src/app/api/trips/[tripId]/route.test.ts`

**Intent**: Extend (or add describes in) the colocated files so owner POST and owner PATCH assert response **and** DB read-back. Invalid JSON / invalid fields / partial PATCH body → 400 with `{ error }` and no row change. Owner DELETE → 204 and row gone.

**Contract**: PATCH body must include full `destination`, `durationDays`, `budgetAmount` (full replace). Invalid cases must not leave partial writes. Prefer one clear invalid-field case and one partial-PATCH case rather than exhaustively re-testing every `validateTripBody` branch already covered in `validation.test.ts`.

### Success Criteria:

#### Automated Verification:

- Persistence cases pass with DB read-back (not status-only)
- Invalid/partial body cases return 400 and leave DB unchanged
- `npx vitest run src/app/api/trips` passes
- `npm test` passes
- `npx tsc --noEmit` passes

#### Manual Verification:

- No test asserts expected values by copying production validator logic (oracle is the documented field contract / prior seeded state)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Cookbook §6.2 / §6.3 + rollout status

### Overview

Document the shipped harness and patterns so later rollout phases reuse them; mark Phase 1 planned work complete in the foundation guide status sense after implement finishes (this phase writes the cookbook content).

### Changes Required:

#### 1. Fill cookbook sections

**File**: `context/foundation/test-plan.md`

**Intent**: Replace TBD in §6.2 and §6.3 with the real pattern: helper location, `vi.mock` policy, assert response + DB read-back, always include wrong-owner + unauthenticated cases for new trip-like endpoints. Add a short §6.6 note for this rollout phase.

**Contract**: No file:line anchors in §1–§2. §6 may name concrete helper paths and reference test files. Do not edit Risk Response Guidance unless explicitly backporting (out of scope). Leave stale `auth-edge` comment untouched.

#### 2. Change metadata

**File**: `context/changes/testing-trip-api-contract-ownership/change.md`

**Intent**: Keep status/updated in sync as implement progresses (implement skill owns Progress checkboxes; this phase ensures notes reflect harness + cookbook landed).

**Contract**: Frontmatter `status` / `updated` consistent with Progress completion when the change finishes.

### Success Criteria:

#### Automated Verification:

- §6.2 and §6.3 no longer say TBD for the trip route harness
- `npm test` still passes

#### Manual Verification:

- A fresh agent reading only §6.2/§6.3 could add a new trip-like route test without re-reading research

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation. Then re-run `/10x-test-plan` (or follow implement’s continuation) to mark rollout Phase 1 complete and open Phase 2.

---

## Testing Strategy

### Unit Tests:

- Existing `validation.test.ts` / `queries.test.ts` remain the unit layer; this change does not duplicate their field-matrix coverage at the route layer.

### Integration Tests:

- Unauthenticated → 401 on GET/POST/GET-one/PATCH/DELETE
- Wrong-owner → 404 on GET; 404 + unchanged row on PATCH/DELETE
- Owner POST → 201 + row owned by session user
- Owner PATCH → 200 + DB reflects full replace
- Invalid / partial body → 400 + no write
- Owner DELETE → 204 + row absent

### Manual Testing Steps:

1. Run `npm test` and confirm new route suites are included
2. Skim test titles against Risks #1 / #5 / #6
3. Confirm §6.2/§6.3 describe mock-only-auth+db and DB read-back

## Performance Considerations

In-memory better-sqlite3 per `beforeEach` — same cost class as existing query tests. No workers pool; keep suite fast.

## Migration Notes

None. Test-only change; no schema or runtime behavior changes.

## References

- Related research: `context/changes/testing-trip-api-contract-ownership/research.md`
- Test plan Phase 1: `context/foundation/test-plan.md` §3
- Pattern source: `src/lib/trips/queries.test.ts`
- Handlers: `src/app/api/trips/route.ts`, `src/app/api/trips/[tripId]/route.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared route-test harness

#### Automated

- [x] 1.1 Helpers module exists and typechecks — 6923fb1
- [x] 1.2 Smoke import resolves harness via `@` alias without Vitest config breakage — 6923fb1
- [x] 1.3 `npx tsc --noEmit` passes — 6923fb1
- [x] 1.4 `npm test` still passes existing unit tests — 6923fb1

#### Manual

- [x] 1.5 Helper API is obvious for a 5-line beforeEach without re-reading research — 6923fb1

### Phase 2: Auth + ownership route cases

#### Automated

- [x] 2.1 Unauthenticated and wrong-owner cases land in colocated route tests
- [x] 2.2 `npx vitest run src/app/api/trips` passes
- [x] 2.3 `npm test` passes
- [x] 2.4 `npx tsc --noEmit` passes

#### Manual

- [x] 2.5 Test names make Risks #1 and #5 (API) obvious

### Phase 3: Persistence + validation route cases

#### Automated

- [ ] 3.1 Persistence cases assert DB read-back (not status-only)
- [ ] 3.2 Invalid/partial body cases return 400 and leave DB unchanged
- [ ] 3.3 `npx vitest run src/app/api/trips` passes
- [ ] 3.4 `npm test` passes
- [ ] 3.5 `npx tsc --noEmit` passes

#### Manual

- [ ] 3.6 No oracle-problem assertions (expected values not copied from validator implementation)

### Phase 4: Cookbook §6.2 / §6.3 + rollout status

#### Automated

- [ ] 4.1 §6.2 and §6.3 document the shipped harness (no TBD for trip routes)
- [ ] 4.2 `npm test` still passes

#### Manual

- [ ] 4.3 Fresh-agent check: §6 alone is enough to add a trip-like route test
