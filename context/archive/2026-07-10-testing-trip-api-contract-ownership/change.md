---
change_id: testing-trip-api-contract-ownership
title: Trip API contract & ownership — integration tests + route harness bootstrap
status: archived
created: 2026-07-10
updated: 2026-07-22
archived_at: 2026-07-22T15:18:43Z
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

Phase 1 (harness) landed: `src/test/route-harness.ts` — 6923fb1
Phase 2 (auth + ownership) landed: trip `route.test.ts` files — 0a2e1e4
Phase 3 (persistence + validation) landed — b40784a
Phase 4 (cookbook §6.2 / §6.3 / §6.6) landed — 0a54d5f

Impl review (2026-07-21): APPROVED — F1/F2 accepted; report at `reviews/impl-review.md`
