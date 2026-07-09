# Edit trip details and delete a trip (S-04) Implementation Plan

## Overview

Implement roadmap slice **S-04** (`trip-edit-and-delete`): let a signed-in user update a
trip's destination, duration, or budget (FR-007) and permanently delete a trip (FR-008).
Extends the existing trip CRUD surface from S-02 — no new tables, no schema migration.
Update and delete are added as `PATCH`/`DELETE` handlers on the existing
`src/app/api/trips/[tripId]/route.ts`, and the edit/delete affordances are added inline to
the existing `/trips/[tripId]` detail page.

## Current State Analysis

- **API:** `src/app/api/trips/[tripId]/route.ts` exposes only `GET` (owner-scoped, returns
  `{ error }` on 401/404/500). The collection route `src/app/api/trips/route.ts` has
  `GET`/`POST`. No `PATCH` or `DELETE` exists yet.
- **Validation:** `src/lib/trips/validation.ts` `validateTripBody()` already enforces the
  exact bounds an edit needs — destination 1–120, `durationDays` 1–14 integer,
  `budgetAmount` 1–50000 integer — and returns `{ ok, values | error }`.
- **Queries:** `src/lib/trips/queries.ts` has `getTripForUser`, `insertTrip`,
  `updateTripItinerary`. No general `updateTrip` (fields) or `deleteTrip` helper.
- **Detail page:** `src/app/(protected)/trips/[tripId]/page.tsx` is an RSC that loads the
  trip via `getTripForUser`, `notFound()`s on missing/wrong-owner, renders destination +
  `formatDuration` + `formatBudget`, then either a read-only `ItineraryView` (when
  `itineraryJson` is set) or `<ItineraryGenerator>`.
- **Form pattern:** `src/components/trip-create-form.tsx` is a `"use client"` controlled
  form that POSTs JSON, reads `{ id?, error? }`, then `router.push` + `router.refresh()`.
  It is a near-exact template for the edit form.
- **Schema:** `trips.itineraryJson` is a column on the trip row itself
  (`src/db/schema.ts`); `trips.userId` cascades on user delete. Deleting a trip row
  therefore deletes its itinerary with it — no extra cascade table.
- **Auth:** `/trips/**` pages sit behind `src/app/(protected)/layout.tsx`; `/api/trips/**`
  handlers guard in-handler via `auth()` (no proxy middleware — see
  [[no-proxy-middleware-cloudflare]]).

## Desired End State

On `/trips/[tripId]`, the owner sees **Edit** and **Delete** controls. **Edit** swaps the
read-only summary for an inline form (destination / duration / budget) pre-filled with
current values; saving `PATCH`es `/api/trips/[tripId]`, closes the form, and
`router.refresh()`es so the server-rendered summary shows new values. **Delete** triggers a
native `confirm()` (whose message states the trip and its itinerary are removed
permanently); on confirm it `DELETE`s the trip and navigates to `/trips`.

If a trip already has a generated itinerary, editing is still allowed; the stored itinerary
is **preserved unchanged** and the detail page shows a staleness note that the itinerary
reflects the original trip details (no regeneration — PRD §Non-Goals). Cross-user or
unauthenticated `PATCH`/`DELETE` returns **404**/**401** with `{ error }`, never mutating
another user's data. Automated checks (`npx tsc --noEmit`, `npm run lint`, `npm run build`)
pass.

### Key Discoveries:

- `validateTripBody` is fully reusable for `PATCH` — edit accepts the same field set and
  bounds as create, so no second validator is needed.
- The itinerary is a column on the trip row, so `DELETE` is a single owner-scoped row
  delete; no separate itinerary cleanup.
- `updateTripItinerary` (queries.ts:73) is the exact shape to model `updateTrip` and
  `deleteTrip` after: owner-scoped `where`, `.returning()` to detect no-op vs hit so the
  handler can distinguish 404 from success.
- The detail page is currently a pure RSC; the inline edit form and delete button must be a
  `"use client"` child component receiving the trip as props (the RSC stays the data
  source, refreshed after mutations).

## What We're NOT Doing

- No itinerary regeneration or recalculation on edit (PRD §Non-Goals); the stored itinerary
  is left as-is with a staleness note.
- No soft delete, undo, trash, or confirmation modal — hard delete via native `confirm()`
  (PRD FR-008 accepts unrecoverable delete as a known risk).
- No delete control on the `/trips` list cards (detail page only) — `trip-card.tsx` stays a
  pure `Link`.
- No new validation bounds, schema columns, or migration.
- No separate `/edit` route or modal primitive — edit is an inline toggle on the detail
  page.
- No optimistic UI — refresh-based reconciliation, matching the create form.
- Activity-level itinerary editing (that is S-05).

## Implementation Approach

Add `PATCH` and `DELETE` to the existing item route, each guarding session and ownership the
same way `GET` does, and delegating to two new owner-scoped query helpers (`updateTrip`,
`deleteTrip`) that use `.returning()` so a missing/wrong-owner target yields a no-op the
handler maps to **404**. `PATCH` reuses `validateTripBody` and updates only the three
editable fields plus `updatedAt`; it never touches `itineraryJson`. On the client, extract a
single `"use client"` component (`trip-actions` / inline edit form) rendered by the detail
RSC, holding edit-mode state, the controlled inputs (seeded from props), the `PATCH` fetch
with `router.refresh()` on success, and the `DELETE` fetch behind `confirm()` with
`router.push("/trips")` on success. The detail RSC computes whether to show the staleness
note (`itineraryJson` present) and renders it near the itinerary section.

## Critical Implementation Details

- **`PATCH` must not clobber the itinerary.** The `updateTrip` helper sets only
  `destination`, `durationDays`, `budgetAmount`, `updatedAt` — never `itineraryJson`. This
  is what preserves a generated itinerary across a duration edit.
- **Ownership is enforced in the `where` clause, not after read.** Both helpers filter on
  `id AND userId` and rely on `.returning()` length to detect "not found / not owner",
  mirroring `updateTripItinerary`. A separate read-then-write would race and risks leaking
  existence; do not split it.

## Phase 1: Trip API — PATCH (update) + DELETE

### Overview

Owner-scoped update and delete handlers on the existing item route, reusing
`validateTripBody` and a `{ error }` contract consistent with the current `GET`.

### Changes Required:

#### 1. Trip mutation query helpers

**File**: `src/lib/trips/queries.ts`

**Intent**: Add `updateTrip` (set the three editable fields + `updatedAt`, owner-scoped) and
`deleteTrip` (owner-scoped row delete), each reporting whether a row matched so the handler
can return 404 on no-op.

**Contract**: `updateTrip(db, userId, tripId, { destination, durationDays, budgetAmount })`
updates `where id = tripId AND userId = userId`, leaves `itineraryJson` untouched, and
returns the updated row (or `null` on no match) via `.returning()`. `deleteTrip(db, userId,
tripId)` deletes with the same `where` and returns a boolean hit via
`.returning({ id: trips.id })`. Model both on `updateTripItinerary` (queries.ts:73).

#### 2. PATCH + DELETE handlers

**File**: `src/app/api/trips/[tripId]/route.ts`

**Intent**: Add `PATCH` (validate body, update owner's trip, return updated trip JSON) and
`DELETE` (remove owner's trip) alongside the existing `GET`, reusing its session guard +
`getCloudflareContext`/`getDb` + try/catch shape.

**Contract**: Both: unauthenticated → **401** `{ error }`; missing/wrong-owner → **404**
`{ error }`; failure → **500** `{ error }`. `PATCH`: invalid/non-JSON body → **400**
`{ error }` via `validateTripBody`; success → **200** with updated trip JSON. `DELETE`:
success → **200** (or **204**) with no error body. `PATCH` must not write `itineraryJson`.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Authenticated `PATCH /api/trips/{ownId}` with a valid body returns **200** and the trip
  shows updated fields; a second `GET` confirms persistence
- `PATCH` with an invalid body (e.g. `durationDays: 0`) returns **400** `{ error }`
- `PATCH`/`DELETE` on another user's `tripId` returns **404** and does not mutate that trip
- Unauthenticated `PATCH`/`DELETE` returns **401** `{ error }`
- `PATCH`ing a trip that already has an itinerary leaves `itinerary_json` unchanged
- `DELETE /api/trips/{ownId}` removes the trip (subsequent `GET` → **404**)

**Implementation Note**: After completing this phase and all automated verification passes,
pause for manual confirmation before Phase 2. Phase blocks use plain bullets — the
corresponding checkboxes live in `## Progress`.

---

## Phase 2: Detail-page edit & delete UX

### Overview

Add inline Edit and Delete controls to `/trips/[tripId]`, an inline edit form cloned from
the create form, native-`confirm()` delete, and a staleness note when an itinerary coexists
with edited details.

### Changes Required:

#### 1. Client trip actions / inline edit component

**File**: `src/components/trip-actions.tsx` (path illustrative — match `src/components/`
conventions; may split form and delete button if cleaner)

**Intent**: `"use client"` component receiving the trip's current fields; holds edit-mode
state; renders Edit/Delete buttons in read mode and a controlled form (seeded from props) in
edit mode. Edit `PATCH`es `/api/trips/{id}`, on success exits edit mode + `router.refresh()`;
on failure shows the `{ error }` string. Delete calls `confirm()` (message notes the trip
and itinerary are permanently removed), then `DELETE`s and `router.push("/trips")` +
`router.refresh()` on success.

**Contract**: Props include `id`, `destination`, `durationDays`, `budgetAmount`. Wire format
matches `validateTripBody` (camelCase JSON: `destination` string, `durationDays`/`budgetAmount`
numbers). Reuse the input markup, bounds (`min`/`max`/`maxLength`), and pending/error styling
from `trip-create-form.tsx`. Disable submit/delete while a request is pending.

#### 2. Wire actions + staleness note into the detail page

**File**: `src/app/(protected)/trips/[tripId]/page.tsx`

**Intent**: Render `<TripActions>` with the trip fields beneath the summary. When
`trip.itineraryJson` is present, render a short staleness note near the itinerary section
stating it reflects the trip's original details and is not regenerated after edits.

**Contract**: RSC stays the data source (`getTripForUser` + `notFound()` unchanged); the new
client component receives plain props. The staleness note is presentational, gated on
`savedItinerary` being non-null, and uses existing disclaimer/zinc styling conventions.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Clicking **Edit** reveals a form pre-filled with the trip's current values
- Saving a valid edit updates the on-page summary (via refresh) and persists across reload
- Submitting an invalid value surfaces the API `{ error }` string inline
- Clicking **Delete** shows a native `confirm()` mentioning permanent itinerary loss;
  cancelling does nothing; confirming returns to `/trips` with the trip gone from the list
- For a trip with an existing itinerary: editing duration succeeds, the itinerary remains
  rendered unchanged, and the staleness note is visible
- Dark/light styling and layout remain consistent with the rest of the detail page

**Implementation Note**: After automated checks pass, run AGENTS.md runtime verification
(`/verify` or `npm run dev` + manual UI) before marking the slice ready to ship.

---

## Testing Strategy

### Unit Tests:

- No test runner is configured in this repo yet; `validateTripBody` is already covered by
  reuse. When a runner lands, the query helpers' owner-scoping (no-op on wrong owner) are the
  first candidates.

### Integration Tests:

- Optional future: HTTP auth/ownership matrix against the dev server for `PATCH`/`DELETE`.

### Manual Testing Steps:

1. Sign in as user A; create or open a trip; Edit each field and confirm persistence after
   reload.
2. Generate an itinerary (S-03), then edit the duration; confirm the itinerary is preserved
   and the staleness note shows.
3. Delete the trip; confirm the `confirm()` copy, the redirect to `/trips`, and absence from
   the list.
4. With two accounts, attempt `PATCH`/`DELETE` of user B's `tripId` as user A (via devtools)
   and confirm **404** with no mutation.
5. Sign out; hit `PATCH`/`DELETE` and confirm **401**.

## Performance Considerations

Single owner-scoped row mutations on the `userId`-indexed `trips` table; negligible at MVP
scale. No pagination or batching concerns.

## Migration Notes

None — edit/delete operate on existing columns. If local D1 lacks the `trips` table, run
`npx wrangler d1 migrations apply tripsprint-ai-db --local` per AGENTS.md before testing
(pre-existing project step, not introduced by this slice).

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-04)
- PRD: `context/foundation/prd.md` (FR-007, FR-008, §Non-Goals)
- Predecessor plan: `context/changes/trip-creation-and-list/plan.md` (S-02 CRUD patterns)
- Existing route: `src/app/api/trips/[tripId]/route.ts`
- Query pattern: `src/lib/trips/queries.ts:73` (`updateTripItinerary`)
- Form template: `src/components/trip-create-form.tsx`
- Detail page: `src/app/(protected)/trips/[tripId]/page.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Trip API — PATCH (update) + DELETE

#### Automated

- [x] 1.1 `npx tsc --noEmit` passes — 91dc1bc
- [x] 1.2 `npm run lint` passes — 91dc1bc
- [x] 1.3 `npm run build` passes — 91dc1bc

#### Manual

- [x] 1.4 Valid `PATCH` returns 200, updates persist on re-GET — 91dc1bc
- [x] 1.5 Invalid-body `PATCH` returns 400 `{ error }` — 91dc1bc
- [x] 1.6 Cross-user `PATCH`/`DELETE` returns 404 with no mutation — 91dc1bc
- [x] 1.7 Unauthenticated `PATCH`/`DELETE` returns 401 `{ error }` — 91dc1bc
- [x] 1.8 `PATCH` leaves an existing `itinerary_json` unchanged — 91dc1bc
- [x] 1.9 `DELETE` removes the trip (subsequent GET → 404) — 91dc1bc

### Phase 2: Detail-page edit & delete UX

#### Automated

- [x] 2.1 `npx tsc --noEmit` passes — 8480384
- [x] 2.2 `npm run lint` passes — 8480384
- [x] 2.3 `npm run build` passes — 8480384

#### Manual

- [x] 2.4 Edit reveals a form pre-filled with current values — 8480384
- [x] 2.5 Valid edit updates summary via refresh and persists across reload — 8480384
- [x] 2.6 Invalid value surfaces API `{ error }` inline — 8480384
- [x] 2.7 Delete shows native `confirm()` (permanent-loss copy); cancel no-ops; confirm redirects to `/trips` with trip gone — 8480384
- [x] 2.8 Editing duration of a trip with an itinerary preserves the itinerary and shows the staleness note — 8480384
- [x] 2.9 Dark/light styling consistent with the rest of the detail page — 8480384
