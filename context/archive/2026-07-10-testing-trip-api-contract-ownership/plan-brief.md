# Trip API Contract & Ownership — Plan Brief

> Full plan: `context/changes/testing-trip-api-contract-ownership/plan.md`
> Research: `context/changes/testing-trip-api-contract-ownership/research.md`

## What & Why

Add Vitest route integration tests that prove trip APIs reject cross-user access, reject unauthenticated calls, and actually persist (or reject) saves. Research already showed the handlers are well-defended — this phase is a regression harness so ownership/auth/persist cannot silently regress.

## Starting Point

Vitest exists with three unit files under `src/lib/trips/`; `queries.test.ts` already uses in-memory better-sqlite3. No route tests. Handlers depend only on `auth()` and `getDb()`.

## Desired End State

Shared `src/test/` helpers + colocated `route.test.ts` files cover Risks #1, #5 (API 401), and #6 for trip CRUD. Cookbook §6.2/§6.3 describe the pattern for Phases 2–3.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Harness | Direct handler + `vi.mock` auth/db + in-memory sqlite | Zero new deps; asserts HTTP and DB | Research |
| Risk #5 page redirect | Defer to Phase 4 e2e | Phase 1 is integration-only; layout is a separate mechanism | Plan |
| Activity / itinerary mutate | Out of scope | Research grounded trip CRUD only; Phase 3 owns generation | Plan |
| Ownership depth | Wrong-owner GET + PATCH + DELETE | Mutate verbs need DB-unchanged oracle; GET locks read leak | Plan |
| Shared helpers | Extract under `src/test/` now | Reuse for auth/lifecycle phases | Plan |
| Test location | Colocated beside routes | Matches existing `*.test.ts` habit | Plan |
| Cookbook / stale comment | Fill §6.2–§6.3; leave `auth-edge` comment | Stay test-only | Plan |

## Scope

**In scope:** Shared harness; trip list/create + `[tripId]` GET/PATCH/DELETE integration tests; cookbook §6.2/§6.3.

**Out of scope:** Page redirect e2e; itinerary/generation routes; workers-pool harness; new deps; prod comment cleanup; test-plan §2 backport.

## Architecture / Approach

Tests call exported route handlers with mocked `auth()` / `getDb()` pointing at an in-memory drizzle DB. Assert status/body and read back rows on the same sqlite handle. Never mock query/validation modules.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Shared harness | `makeTestDb` / session mocks under `src/test/` | Mock hoisting / import order |
| 2. Auth + ownership | 401 + wrong-owner 404 / DB unchanged | Status-only assertions that miss IDOR |
| 3. Persistence + validation | Read-back saves; 400 on invalid/partial PATCH | Oracle problem / status-only |
| 4. Cookbook | §6.2 / §6.3 filled from what shipped | Docs drift from actual helpers |

**Prerequisites:** Research complete; Vitest + better-sqlite3 already installed.
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Vitest `vi.mock` of `@/lib/auth` must not pull real Cloudflare context at import time — research says mocking the module seam is sufficient; verify in Phase 1.
- Existing `queries.test.ts` may keep its local `makeDb` for now (optional later refactor).

## Success Criteria (Summary)

- Wrong-owner mutate attempts leave the owner’s row unchanged
- Unauthenticated trip API calls return 401
- Valid saves show up in DB read-back; invalid bodies do not
