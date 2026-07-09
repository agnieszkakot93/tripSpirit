# Itinerary Activity Editing — Plan Brief

> Full plan: `context/changes/itinerary-activity-edit/plan.md`

## What & Why

Implement FR-011 and FR-012: let a signed-in user edit activity details (name, description, approximate cost), edit day titles, add new activities to a day, and remove existing activities — then save each change explicitly. The itinerary is currently rendered read-only; without editing it is impossible to correct AI-generated errors, making the product untrustworthy.

## Starting Point

Itinerary data is stored as a single JSON blob in `trips.itinerary_json`. Phase 1 (`91470d8`) added `updateItinerary` and `PATCH /api/trips/[tripId]/itinerary`. `ItineraryView` still renders saved itineraries read-only on the trip detail page; no edit UI exists yet. `TripActions` establishes the inline toggle + explicit save pattern the editor will follow.

## Desired End State

The trip detail page renders an `ItineraryEditor` component for any schema-valid saved itinerary. Each activity row has Edit and Remove buttons. Edit opens an inline form (pre-filled); Save PATCHes the full updated itinerary and the row returns to read-only. Each day card has an editable title. An "Add activity" entry at the bottom of each day allows creating new activities. Costs update in-flight as fields are changed; totals reflect current state. All mutations are owner-scoped at the API.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Editable fields | Name, description, approxCostEur | All user-visible activity data should be correctable | Plan |
| Edit granularity | One entity at a time (inline toggle) | Mirrors TripActions pattern; flat state, no accidental overwrites | Plan |
| Day title editing | Yes | Trivial to add; rounds out the editing surface without scope risk | Plan |
| Add/remove activities | Yes | Editing only existing activities is too limiting; reshape matters | Plan |
| API surface | New PATCH on `/api/trips/[tripId]/itinerary` | Keeps itinerary mutations separate from trip-field mutations | Plan |
| Payload strategy | Full itinerary JSON on every save | Itinerary is a small blob (<5 KB); atomic replace is simpler and safe | Plan |
| Save feedback | Implicit (form closes, values update) | Consistent with TripActions; no toast/timer complexity | Plan |
| `totalApproxCostEur` | Client-recalculates before PATCH | Must be coherent with activity sums before persisting | Plan |
| Testing | Vitest unit tests for `updateItinerary` | Consistent with existing `queries.test.ts` pattern | Plan |
| Cost preview | Draft form values while form open | Totals reflect unsaved cost edits before Save | Plan |
| Display helpers | Export from `itinerary-view.tsx` | Single source for `dayCost`, `tripTotalCost`, disclaimer | Plan |
| Pending UX | Disable all mutation controls globally | Prevents overlapping PATCHes during save | Plan |

## Scope

**In scope:** `updateItinerary` query helper; PATCH handler + Vitest tests (Phase 1, done); shared display helpers; `ItineraryEditor` client component; trip detail page wiring; add/remove activities per day; day title editing.

**Out of scope:** Reordering activities (drag-and-drop); adding/removing days; itinerary regeneration; auto-save; success toast; editing `totalApproxCostEur` directly; any schema migration.

## Architecture / Approach

The itinerary JSON blob is the single source of truth. `ItineraryEditor` owns a local copy in `useState` (initialised from the server-fetched value). Each Save action: updates local state + `PATCH /api/trips/[tripId]/itinerary` with the full updated itinerary. No `router.refresh()` per save — the component owns state optimistically; the next full page load reads the server value. A single `editKey` string controls which form is visible at any moment (one open at a time). `ItineraryView` is preserved unchanged for streaming use in `ItineraryGenerator` and as a read-only fallback for partial/malformed stored data.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Query Helper + PATCH API | `updateItinerary`, PATCH handler, Vitest tests | Owner-scope leak if WHERE clause is wrong |
| 2. ItineraryEditor UI | Full inline editing component + page wiring | `totalApproxCostEur` going stale; edit-key state getting out of sync |

**Prerequisites:** `trip-edit-and-delete` shipped (present). A saved itinerary exists on at least one trip for manual testing of Phase 2.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Remove is immediate (no undo) once saved — consistent with the hard-delete decision on trips; accepted.
- If the stored itinerary is schema-invalid (old/malformed data), `ItineraryEditor` is not shown; `ItineraryView` renders read-only as a fallback — this is an edge case for legacy data only.

## Success Criteria (Summary)

- A user can edit any activity field and see the change persisted after a page refresh.
- A user can add and remove activities within a day, with changes persisted.
- Cross-user or unauthenticated PATCH attempts are rejected (404/401) with no data mutation.
