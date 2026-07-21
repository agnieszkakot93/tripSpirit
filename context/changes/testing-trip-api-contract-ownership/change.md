---
change_id: testing-trip-api-contract-ownership
title: Trip API contract & ownership — integration tests + route harness bootstrap
status: implementing
created: 2026-07-10
updated: 2026-07-21
archived_at: null
---

## Notes

Rollout Phase 1 of context/foundation/test-plan.md: "Trip API contract & ownership".

Risks covered:
- #1 (trip route returns/mutates a trip not owned by the signed-in user — IDOR)
- #5 (unauthenticated user reaches a trip API without a 401) — API half only; page redirect deferred to Phase 4
- #6 (a save silently fails validation or the DB write yet the user believes it persisted) — trip CRUD only

Test types planned: integration (route-level). Bootstraps shared `src/test/` harness for later phases.

Decisions (from planning):
- Harness: direct handler + vi.mock auth/db + in-memory better-sqlite3
- Ownership: wrong-owner GET + PATCH + DELETE (DB unchanged oracle)
- Colocated `route.test.ts`; fill cookbook §6.2/§6.3; leave stale auth-edge comment alone
