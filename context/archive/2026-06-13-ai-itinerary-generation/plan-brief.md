# AI itinerary generation and view (S-03) — Plan Brief

> Full plan: `context/changes/ai-itinerary-generation/plan.md`

## What & Why

S-03 is the roadmap's **validation milestone** — the first slice that proves the core product hypothesis. From a saved trip, a signed-in user generates a day-by-day AI itinerary (per-day activities, approximate EUR costs, total) and views it (FR-009, FR-010, US-01). If this works and is useful, the product direction is worth continuing.

## Starting Point

S-02 shipped trip create/list and a trip detail shell (`(protected)/trips/[tripId]/page.tsx`) that currently shows a static itinerary placeholder. `trips.itinerary_json` exists as a nullable `text` column (never written yet). No AI SDK, Zod, or generation route exists.

## Desired End State

On a trip with no itinerary, the user clicks Generate and watches the plan stream in live, then it's saved. Reopening the trip shows it read-only (no regenerate). Over-30s or failed generation shows an inline error with Try again, persisting nothing. Cross-user/unauth generation returns 404/401.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| AI provider + SDK | OpenAI via Vercel AI SDK `streamObject` | Pre-set secret + most Workers test coverage; streaming dodges the CPU ceiling | Infra |
| Model | `gpt-4o-mini` | Fast/cheap with comfortable margin under the 30s ceiling | Plan |
| Streaming UX | Progressive render (`useObject`) | Best perceived perf for the north-star demo | Plan |
| Persistence | Server-side in `onFinish` | One round trip; saved the moment generation completes (FR-006) | Plan |
| Itinerary shape | `days[] → activities[]` + `totalApproxCostEur` | Directly satisfies FR-010; per-day cost summed in UI | Plan |
| 30s NFR | `AbortSignal.timeout(~28s)` + inline error | Clean error before the edge hard-kills the request | Infra/Plan |
| Re-generation | None — read-only once set; route refuses overwrite | PRD Non-Goal (no Regenerate) | PRD |
| Budget in prompt | Soft-target, not a cap | PRD: budget is a planning signal | PRD |
| Duplicate guard | Client disable + server idempotency (null-check) | Defense in depth without a lock column | Plan |
| Verification | tsc/lint/build + runtime `/verify` | Matches S-02; no test runner yet | Plan |

## Scope

**In scope:** generation route (streaming, auth, ownership, idempotency, 28s abort, persist); itinerary Zod schema + prompt; progressive-render UI + saved read-only view + error path.

**Out of scope:** regeneration, activity editing/saving (S-05), cost recalculation, test runner, live pricing/maps/exports, generation-lock schema column.

## Architecture / Approach

One Zod schema is the shared contract for both `streamObject` (server) and `experimental_useObject` (client). Route `POST /api/trips/[tripId]/itinerary` authorizes → ownership 404 → idempotency reject → `streamObject(gpt-4o-mini, abort 28s)` → `.toTextStreamResponse()`, persisting via `updateTripItinerary` in `onFinish` (the only post-stream CPU). The client renders the partial object live.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Foundation | deps (`ai`/`@ai-sdk/*`/`zod`), itinerary schema+type, prompt, `updateTripItinerary` | AI SDK ↔ React 19 / Next 16 version compat |
| 2. Streaming route | `POST .../itinerary`: auth/ownership/idempotency/28s-abort/persist-on-finish | Edge CPU ceiling + streaming protocol on Workers runtime |
| 3. Detail UX | Generate button, progressive render, saved read-only view, inline error | Partial-object rendering; `useObject` ↔ route stream pairing |

**Prerequisites:** S-02 (done); `OPENAI_API_KEY` in `.dev.vars` for local generation.
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- Streaming behaves differently on the Workers runtime (truncation/hangs under concurrency) — test under load before launch (`infrastructure.md:95`).
- Free-plan 10ms CPU ceiling: keep `onFinish` lean; paid plan is the real production minimum.
- Exact AI SDK export names/signatures (`streamObject`, `toTextStreamResponse`, `experimental_useObject`) must be checked against the installed version.

## Success Criteria (Summary)

- A user generates and sees a day-by-day itinerary with per-day + total EUR estimates and the disclaimer.
- The itinerary persists; reopening shows it read-only; no regenerate.
- Over-30s/failed generation shows an inline error and persists nothing; cross-user/unauth → 404/401.
