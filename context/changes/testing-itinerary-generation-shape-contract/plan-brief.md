# Itinerary Generation & Shape-Contract Tests — Plan Brief

> Full plan: `context/changes/testing-itinerary-generation-shape-contract/plan.md`
> Research: `context/changes/testing-itinerary-generation-shape-contract/research.md`

## What & Why

Add Vitest unit + route integration tests that lock itinerary generation failure modes (abort/empty → no partial persist) and day-count/shape completeness (mismatch never persisted; match accepted), plus residual itinerary 401. Production already implements S-03 guards — this is a regression suite for test-plan Phase 3.

## Starting Point

Helper units cover short/exact/non-sequential but miss over-long. The itinerary route has no `route.test.ts`. Harness supports auth/db; AI SDK mocking was deferred to this phase. Research corrected that mid-stream failures are 200 empty streams, not JSON non-200.

## Desired End State

Green unit + colocated itinerary route suites under `npm test`; cookbook §6.4 documents the `streamObject` / `onFinish` / short-abort pattern; §2 Risk #2 wording matches mid-stream reality.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| PATCH depth | 401 only | Documented Risk #5 residual without Risk #6-style edit matrix | Plan |
| Mid-stream fail sim | Real abort via short controllable `AbortSignal.timeout` (~50ms) | Exercises abort semantics without 28s wall clock | Plan |
| `updateTripItinerary` units | Skip; prove via route DB read-back | Cost × signal (same as Phase 2 skipping auth-tokens units) | Plan / Research |
| §2 Risk #2 wording | Backport in cookbook phase | Research corrected “non-200” for mid-stream | Research / Plan |
| AI mock target | `ai.streamObject` + Cloudflare context | Matches production import path; do not mock queries | Research |

## Scope

**In scope:**
- Over-long unit fixtures (literal duration oracle)
- Itinerary `route.test.ts`: abort/empty, incomplete, complete, 409, POST/PATCH 401
- §6.4 / §6.6 + §2 Risk #2 correction

**Out of scope:**
- Production/SDK migration; full PATCH CRUD; UI e2e; exact AI text; concurrent POST races

## Architecture / Approach

Same Phase 1–2 pattern: direct handler call; mock auth/db/Cloudflare/`streamObject`; run real completeness + `updateTripItinerary` against in-memory sqlite; assert HTTP/stream class + DB read-back. Capture `onFinish` from the mock; flush `waitUntil` before asserts.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Unit over-long fixtures | Risk #3 helper gap closed | Oracle from helper internals |
| 2. Route generation tests | Risks #2/#3 persist + 401/409 | Over-mocking so `onFinish` never runs; flaky long abort |
| 3. Cookbook + §2 correction | Reusable AI-mock pattern; honest risk map | Docs drift from stream semantics |

**Prerequisites:** Phase 1–2 test rollout complete (harness + trip/auth suites green)
**Estimated effort:** ~1–2 sessions across 3 phases

## Open Risks & Assumptions

- Short `AbortSignal.timeout` stub must still drive the empty/`undefined` object path the route uses for no-persist
- Cloudflare `waitUntil` mock must flush promises before DB asserts or complete-persist cases flake

## Success Criteria (Summary)

- Over-long rejected by schema + completeness; incomplete `onFinish` leaves DB null; complete persists
- Abort/empty path leaves DB null; 409 and POST/PATCH 401 pass
- §6.4 has no TBD for AI mock seams; §2 Risk #2 no longer requires mid-stream non-200
