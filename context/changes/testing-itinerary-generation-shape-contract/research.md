---
date: 2026-07-21T21:31:57+0200
researcher: Agnieszka Kot
git_commit: 463a90b3fb70bf764834110265e8becb50efef93
branch: main
repository: tripSpirit
topic: "Itinerary generation & shape contract — grounding Risks #2, #3 (test-plan Phase 3)"
tags: [research, codebase, itinerary, generation, streamObject, completeness, timeout, test-harness]
status: complete
last_updated: 2026-07-21
last_updated_by: Agnieszka Kot
---

# Research: Itinerary generation & shape contract (test-plan Phase 3)

**Date**: 2026-07-21T21:31:57+0200
**Researcher**: Agnieszka Kot
**Git Commit**: 463a90b3fb70bf764834110265e8becb50efef93
**Branch**: main
**Repository**: tripSpirit

## Research Question

Ground rollout Phase 3 of `context/foundation/test-plan.md`
("Itinerary generation & shape contract") in actual code, so `/10x-plan`
can write unit + integration tests. Specifically:

- **Risk #2** — on timeout/abort or upstream error: clean client failure and
  **no** partial itinerary persisted; challenge "stream started ≠ generation
  succeeded"; verify abort/timeout path, 409 one-shot guard, persistence gate.
- **Risk #3** — day-count/shape mismatch rejected by completeness guard and
  never persisted; matching shape accepted; avoid oracle problem.
- **Harness / seams** — what to mock (`ai` / Cloudflare context) and what
  already exists under `src/lib/trips/*.test.ts` vs the untested itinerary route.

## Summary

Generation and shape protections **already exist in production code** (S-03).
Phase 3 is a **regression guard** that adds the deferred mocked-AI route tests
and fills unit gaps — not a bug hunt.

1. **Single generation surface:** `POST /api/trips/[tripId]/itinerary`
   (`streamObject` + `AbortSignal.timeout(28_000)` + `onFinish` persist).
   Same file also has `PATCH` for edits (out of Risk #2/#3 generation core;
   401 residual is in Phase 3 scope per prior research).
2. **Risk #2 guidance needs a correction:** mid-stream timeout/abort/upstream
   failure returns an **HTTP 200 text stream that ends empty/incomplete**, not
   a JSON non-200. Pre-stream failures are `401` / `404` / `409` / `500`.
   Persistence is still safe: `onFinish` only calls `updateTripItinerary` when
   `object && isItineraryCompleteForDuration(...)`. Client maps empty finish →
   "Generation failed — please try again."
3. **Risk #3 helpers are real and mostly unit-tested.**
   `buildItinerarySchemaForDuration` + `isItineraryCompleteForDuration` gate
   persist. Existing `itinerary.test.ts` covers short/exact/non-sequential;
   **over-long fixtures are missing**. "Never persisted" needs one route
   integration case (mock `streamObject` `onFinish` with incomplete object +
   DB read-back) — units alone do not prove the wire-up.
4. **Cheapest layers confirmed:** unit for duration→schema + completeness;
   integration mocking `ai.streamObject` (+ Cloudflare context) for Risk #2
   and the #3 persistence clause. Do not assert exact AI text.
5. **No speculative risks to drop.** Hot-spot dirs `src/app/api` /
   `src/lib/trips` correctly pointed at the live surface
   (`…/itinerary/route.ts` + `src/lib/trips/itinerary.ts`).

## Detailed Findings

### Risk #2 — timeout / abort / upstream + no partial persist

**File:** [`src/app/api/trips/[tripId]/itinerary/route.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/463a90b3fb70bf764834110265e8becb50efef93/src/app/api/trips/%5BtripId%5D/itinerary/route.ts)

| Mechanism | Lines | Behavior |
|-----------|-------|----------|
| Soft abort under 30s edge ceiling | 51–53, 100 | `GENERATION_TIMEOUT_MS = 28_000`; `abortSignal: AbortSignal.timeout(...)` |
| `onError` | 101–105 | Logs only — does **not** change HTTP status |
| `onFinish` persist gate | 106–121 | Write only if `object` truthy **and** complete for `trip.durationDays` |
| Stream response | 125 | `result.toTextStreamResponse()` → typically **HTTP 200** text/plain |
| Pre-stream `catch` | 126–129 | `500 { error: "Internal error" }`; comment: mid-stream errors → empty stream |

**One-shot / 409** (80–86): if `trip.itineraryJson` already set →
`409 { error: "Itinerary already generated" }`. This is "already generated,"
not an in-flight concurrency lock. Second layer: `updateTripItinerary` only
writes when `itinerary_json IS NULL`
([`queries.ts:126-147`](https://github.com/agnieszkakot93/tripSpirit/blob/463a90b3fb70bf764834110265e8becb50efef93/src/lib/trips/queries.ts#L126-L147)).

**Pre-stream status matrix:**

| Status | Body | When |
|--------|------|------|
| 401 | `{ error: "Unauthorized" }` | No session |
| 404 | `{ error: "Not found" }` | Missing / wrong-owner trip |
| 409 | `{ error: "Itinerary already generated" }` | Itinerary already present |
| 500 | `{ error: "Internal error" }` | Missing `OPENAI_API_KEY` or pre-stream throw |
| 200 | text stream | Generation started (success **or** mid-stream failure) |

**Client** ([`itinerary-generator.tsx:16-28`](https://github.com/agnieszkakot93/tripSpirit/blob/463a90b3fb70bf764834110265e8becb50efef93/src/components/itinerary-generator.tsx#L16-L28)):
`useObject` → non-OK → `error`; OK empty finish → `emptyError`; both show
"Generation failed — please try again."

**Guidance verdict:** Persistence clause **confirmed**. "Clean non-200" is
**accurate only for pre-stream** failures. For timeout/abort after the stream
starts, prove: **no DB write** + client-visible failure semantics (empty
`onFinish` / mocked stream), **not** `expect(status).not.toBe(200)`.

### Risk #3 — duration → schema + completeness

**File:** [`src/lib/trips/itinerary.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/463a90b3fb70bf764834110265e8becb50efef93/src/lib/trips/itinerary.ts)

| Symbol | Lines | Contract |
|--------|-------|----------|
| `itinerarySchema` | 28–33 | Persist/UI: `days.min(1)` — **duration-agnostic** |
| `buildItinerarySchemaForDuration(N)` | 36–45 | Generation: `days.length(N)` |
| `isItineraryCompleteForDuration` | 47–53 | `days.length === N` **and** `day.day === index + 1` |
| `buildItineraryPrompt` | 64–78 | Prose "exactly N days, numbered 1 through N" |

Wired in POST: schema + prompt + guard all use `trip.durationDays` (route
90–112). Incomplete objects are logged and **not** written.

**Existing unit tests** (`src/lib/trips/itinerary.test.ts`):

| Case | Covered? |
|------|----------|
| Schema rejects short | Yes |
| Schema accepts exact | Yes |
| Schema rejects over-long | **No — gap** |
| Completeness false on short | Yes |
| Completeness false on non-sequential `day` | Yes |
| Completeness true on exact | Yes |
| Completeness false on over-long | **No — gap** |

**Oracle:** assert against a **literal** `TRIP_DURATION_DAYS` (and optional
bounds 1/14 from `validateTripBody`), never by reading helper internals or
Zod describe strings.

**"Never persisted":** unit helpers prove the predicate; route integration
with mocked `onFinish({ object: incomplete })` + DB read-back proves the
wire-up. Share Risk #2's mock harness — one extra case.

**Out of scope for #3 units:** PATCH without duration check; UI parse that
uses base `itinerarySchema`; intentional post-edit duration staleness (PRD
non-goal: no regenerate).

### Auth residual (Risk #5 on this route)

POST and PATCH both `auth()` → `401 Unauthorized` (route 20–23, 59–62).
Prior phases deferred itinerary 401 here — include in Phase 3 route suite
cheaply alongside generation cases.

### Existing tests & harness gaps

| Area | Status |
|------|--------|
| `itinerary.test.ts` | Shape helpers present; add over-long |
| `queries.test.ts` | `updateItinerary` covered; **`updateTripItinerary` not** |
| Trip CRUD `route.test.ts` | Present (Phase 1) |
| `…/itinerary/route.test.ts` | **Missing** |
| `route-harness.ts` | auth + db + seeds; **no AI / waitUntil helpers** |

**Mock seams for Phase 3 (mirror Phase 2 email pattern):**

- Always: `@/lib/auth`, `@/lib/db`
- Generation POST: `@/lib/cloudflare-context` →
  `{ env: { OPENAI_API_KEY: "…" }, ctx: { waitUntil: (p) => p } }`
- AI boundary: `vi.mock("ai", () => ({ streamObject: mockStreamObject }))`
  — capture `onFinish` / `onError` / `abortSignal`; return
  `{ toTextStreamResponse: () => new Response("", { status: 200, … }) }`
- Do **not** mock `@/lib/trips/queries`, `itinerary` helpers, or exact text

### Risk response guidance — verify / correct

| Risk | Guidance status | Plan implication |
|------|-----------------|------------------|
| #2 abort/timeout + no partial write | Persistence **confirmed**; **"non-200" overstated for mid-stream** | Assert no DB write + empty/fail stream semantics; pre-stream paths assert real 401/404/409/500 |
| #2 409 one-shot | **Confirmed** | Include 409 + no overwrite |
| #3 schema + completeness | **Confirmed**; over-long unit gap | Fill over-long; keep literal duration oracle |
| #3 never persisted | Predicate yes; **route wire-up untested** | One integration mismatch case with Risk #2 harness |
| #5 itinerary 401 | Uncovered; in Phase 3 | Cheap cases on POST/PATCH |
| Cheapest layers | Unit + integration mock AI | Matches §3 Phase 3; fill §6.4 cookbook |

**Anti-patterns still valid:** asserting exact AI text; over-mocking so
`onFinish` never runs; happy-path-only generation; oracle from helper
internals.

## Code References

- `src/app/api/trips/[tripId]/itinerary/route.ts:51-131` — timeout, streamObject, onFinish persist, pre-stream 500
- `src/app/api/trips/[tripId]/itinerary/route.ts:80-86` — 409 one-shot
- `src/lib/trips/itinerary.ts:36-53` — duration schema + completeness
- `src/lib/trips/queries.ts:126-147` — `updateTripItinerary` (`IS NULL`)
- `src/components/itinerary-generator.tsx:16-28` — empty/error UX
- `src/lib/trips/itinerary.test.ts` — existing helper coverage (over-long gap)
- `src/test/route-harness.ts` — auth/db seams for route tests

## Architecture Insights

- Auth is still per-route (`auth()`), not middleware — generation route owns
  its 401 like trip CRUD.
- Streaming is mandatory (S-03): Workers CPU ceiling rules out buffer-then-
  parse; `waitUntil` keeps D1 write alive after the response starts flushing.
- Two schemas intentionally diverge: generation uses duration-bound Zod;
  client `useObject` and page parse use base `itinerarySchema` (`.min(1)`).
  Completeness guard is the server-side source of truth for persist.
- Mid-stream failure contract is **stream semantics**, not JSON error
  envelopes — tests must not invent a non-200 for abort after `toTextStreamResponse`.

## Historical Context (from prior changes)

- `context/changes/ai-itinerary-generation/plan.md` — streamObject, 28s abort,
  one-shot 409, onFinish + waitUntil; **deferred** HTTP mocked streaming tests
  (now Phase 3).
- `context/changes/ai-itinerary-generation/reviews/impl-review.md` — F1 try/catch
  + key check, F2 onError logging, F3 page schema parse, F4 list keys (all FIXED).
- `context/changes/testing-trip-api-contract-ownership/plan.md` — deferred
  itinerary generation/PATCH to Phase 3.
- `context/changes/testing-auth-account-lifecycle-routes/research.md` —
  itinerary POST/PATCH 401 → Phase 3.
- `context/archive/2026-06-15-itinerary-activity-edit/` — PATCH edit on same
  route; not the generation persistence gate.

## Related Research

- `context/changes/testing-trip-api-contract-ownership/research.md` — harness
  + Risk #5 dual mechanism.
- `context/changes/testing-auth-account-lifecycle-routes/research.md` —
  Phase 2 auth; residual itinerary 401 note.

## Open Questions

1. **Backport to test-plan §2 Risk #2?** Soften "clean, non-200 failure" to
   distinguish pre-stream JSON non-200 vs mid-stream 200 empty stream + no
   persist + client failure UX. Recommend backport or `--refresh`.
2. **PATCH coverage depth:** include only 401 (+ maybe invalid body) in Phase 3,
   or also ownership/persistence? Risk #2/#3 center on POST; PATCH 401 is the
   documented residual — keep PATCH thin unless plan expands.
3. **`updateTripItinerary` unit tests:** optional cheap layer; not required if
   route integration asserts DB read-back for complete vs incomplete
   `onFinish`.
4. **AI SDK 6 deprecation:** `streamObject` still used in production; mock the
   real import path (`ai`), not a future `streamText` API, unless production
   migrates first.
