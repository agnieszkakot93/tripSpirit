# Itinerary Activity Editing Implementation Plan

## Overview

Implement FR-011 (edit an activity) and FR-012 (save itinerary changes). A signed-in user can edit any activity's name, description, and approximate cost, edit a day's title, add a new activity to a day, or remove an existing activity — one at a time via inline toggle forms, with explicit save on each action.

## Current State Analysis

The itinerary is stored as a single JSON blob in `trips.itinerary_json`. `ItineraryView` (`src/components/itinerary-view.tsx`) renders it read-only and is also used during streaming in `ItineraryGenerator`. The trip detail page (`src/app/(protected)/trips/[tripId]/page.tsx`) still renders `ItineraryView` when a saved itinerary exists — no edit controls.

**Phase 1 is shipped** (`91470d8`): `updateItinerary` in `queries.ts`, `PATCH /api/trips/[tripId]/itinerary` in the itinerary route (401/400/404/204), and Vitest coverage in `queries.test.ts`. `POST` remains one-shot generation only.

`TripActions` (`src/components/trip-actions.tsx`) establishes the inline toggle + explicit save pattern; the editor follows it but owns itinerary state optimistically (no `router.refresh()` per save).

### Key Discoveries:

- Activity schema: `{ name: string; description: string; approxCostEur: number }` — all three fields editable per decision
- Day cost is derived in the UI by `dayCost()` in `itinerary-view.tsx` — export shared display helpers so the editor uses the same derivation
- `TripActions` pattern: `"use client"` component, local state for form values, fetch + implicit success (no toast) — editor matches error styling and button classes
- `updateTripItinerary` in `queries.ts` remains generation-only (`IS NULL` guard); `updateItinerary` is the edit path (no null guard)
- `parseItinerary` in the page returns `PartialItinerary | null` without distinguishing valid vs partial — Phase 2 must branch on schema validity before choosing `ItineraryEditor` vs `ItineraryView`

## Desired End State

The trip detail page, when a saved itinerary exists, renders an `ItineraryEditor` component instead of a static `ItineraryView`. Each activity row has Edit and Remove buttons. Clicking Edit reveals an inline form pre-filled with current values (name, description, cost); Save PATCHes the full updated itinerary JSON and the row returns to read-only. Each day card also has an inline-editable title. An "Add activity" entry at the bottom of each day's list opens a blank form. All edits are owner-scoped at the API layer; cross-user or unauthenticated attempts receive 401/404.

### Verification:
- Navigate to a trip with a saved itinerary → `ItineraryEditor` renders with Edit/Remove buttons on each activity
- Edit an activity, save, refresh the page → updated values persist
- Add an activity to a day → it appears, save → persists; remove an activity → it disappears, save → gone
- Edit a day title → persists after save
- Cost totals update in-flight when cost field is changed before saving
- Cross-user PATCH → 404

## What We're NOT Doing

- No itinerary regeneration (PRD Non-Goals)
- No reordering of activities within a day (drag-and-drop)
- No adding or removing days (day structure as generated is fixed)
- No auto-save — every change requires an explicit Save action
- No success toast/banner — implicit success via form closing and updated values (matching `TripActions`)
- No editing of `totalApproxCostEur` directly — it is a derived display value; the PATCH body must include it, so it is recalculated client-side from activity sums before sending

## Implementation Approach

Two-phase: backend first (query helper + API), then UI. The PATCH endpoint accepts a full `itinerarySchema`-validated body and writes it atomically. The `ItineraryEditor` component holds the full itinerary in `useState`, applies edits to local state on each Save, and PATCHes the full updated object — one PATCH per user action.

## Critical Implementation Details

**totalApproxCostEur must be kept coherent before sending.** The stored itinerary includes `totalApproxCostEur` as a top-level field. When the editor PATCHes, it must send a value for this field. After any edit that affects costs, recalculate it as the sum of all activity costs across all days before sending. This keeps the server-stored value consistent with what the UI derives and displays.

**Only one edit form open at a time.** A single `editKey` string (`"day-{i}"`, `"activity-{i}-{j}"`, `"new-activity-{i}"`) gates which form is shown. Opening any form closes the previous one (set the new key, discarding uncommitted changes in the prior form). This keeps state flat and avoids nested form complexity.

**Draft cost preview while a form is open.** When an activity or new-activity form is open, day and trip totals preview the draft `approxCostEur` from the form field — not the last-saved itinerary value. Title/name/description edits do not affect totals. Read-only rows and closed forms use saved `itinerary` state.

**Global pending lock.** A single `pending` flag disables all Edit, Remove, and Add controls across the editor while any PATCH is in flight. Prevents overlapping saves and edit-key races.

---

## Phase 1: Query Helper + PATCH API

### Overview

Add `updateItinerary` to the query layer, add a PATCH handler to the itinerary route, and cover the query helper with Vitest tests.

### Changes Required:

#### 1. `updateItinerary` query helper

**File**: `src/lib/trips/queries.ts`

**Intent**: Add an owner-scoped helper that writes a new full itinerary JSON for a trip, returning `true` if a row was updated and `false` if the trip was not found or not owned by the caller. Unlike `updateTripItinerary`, no `IS NULL` guard — this is an edit-path update, not generation.

**Contract**: `updateItinerary(db, userId, tripId, itinerary: Itinerary): Promise<boolean>` — updates `itinerary_json` and `updatedAt` on the owner-matching row; uses `.returning({ id: trips.id })` to detect no-op.

#### 2. PATCH handler on the itinerary route

**File**: `src/app/api/trips/[tripId]/itinerary/route.ts`

**Intent**: Add a `PATCH` export alongside the existing `POST`. The handler authenticates the caller, validates the request body against `itinerarySchema`, calls `updateItinerary`, and responds 404 when the helper returns false or 204 on success.

**Contract**: `PATCH /api/trips/[tripId]/itinerary` — accepts `application/json` body matching `itinerarySchema`; responds 401 (no session), 400 (invalid body), 404 (not found / not owner), 204 (success, no body).

#### 3. Vitest tests for `updateItinerary`

**File**: `src/lib/trips/queries.test.ts`

**Intent**: Extend the existing test file with a `describe("updateItinerary", ...)` block following the pattern of `describe("updateTrip", ...)`. Tests must cover: successful update for the owner, rejection for a wrong user (returns false, no mutation), rejection for a non-existent trip ID, and that the update does not clobber other trip fields (`destination`, `durationDays`).

**Contract**: Four `it(...)` cases under `describe("updateItinerary")`. Use the `seedTrip` / `seedUser` helpers already in the file; write the initial `itinerary_json` via `sqlite.exec` (as in the existing `updateTrip` test) to set up the "already has itinerary" precondition.

### Success Criteria:

#### Automated Verification:

- All existing and new tests pass: `npm run test`
- TypeScript clean: `npx tsc --noEmit`
- Lint clean: `npm run lint`

#### Manual Verification:

- `curl -X PATCH /api/trips/{id}/itinerary` with a valid body and a valid session cookie returns 204
- Same with a wrong-owner or non-existent trip returns 404
- Same with no session returns 401
- Same with a malformed body (e.g. missing required field) returns 400

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 2. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: ItineraryEditor UI Component

### Overview

Extract shared itinerary display helpers, create the `ItineraryEditor` client component, and wire it into the trip detail page for schema-valid saved itineraries.

### Changes Required:

#### 1. Shared itinerary display helpers

**File**: `src/components/itinerary-view.tsx`

**Intent**: Export `dayCost`, a new `tripTotalCost(itinerary)` helper (sum of all activity costs across days), and `DISCLAIMER` so `ItineraryEditor` and `ItineraryView` share one implementation. Refactor `ItineraryView` to import the exports it defines — no visible behavior change.

**Contract**: `dayCost(activities)`, `tripTotalCost({ days })`, and `DISCLAIMER` are named exports. `ItineraryView` continues to render read-only for streaming (`ItineraryGenerator`) and partial/malformed fallback.

#### 2. `ItineraryEditor` client component

**File**: `src/components/itinerary-editor.tsx`

**Intent**: A `"use client"` component that renders the full itinerary with inline edit controls. It holds the current itinerary in `useState`, tracks which entity is in edit mode via a single `editKey` string, and PATCHes the full updated itinerary on each Save action. Closing a form without saving discards local changes for that form only (the parent state is not mutated until a successful PATCH).

**Contract**: `ItineraryEditor({ tripId: string; initialItinerary: Itinerary })` — renders day cards, each with:

- Day title section: read-only title with an Edit button → inline `<input>` pre-filled with current title → Save / Cancel; saving PATCHes the itinerary with the updated title
- Activity list: each activity row shows name, description, cost (read-only), plus Edit and Remove buttons
  - Edit → inline form with three fields (name `text`, description `text`, approxCostEur `number`) pre-filled with current values → Save / Cancel
  - Remove → immediately PATCHes the itinerary with that activity removed from the day (no confirm dialog; once removed+saved it is gone)
- "Add activity" entry at the bottom of each day's activity list → blank inline form (required name + description; `approxCostEur` defaults to `0`) → Save / Cancel

The `save(updated: Itinerary)` internal function: recalculates `totalApproxCostEur` via `tripTotalCost(updated)` before calling PATCH, sets `pending = true`, clears error, and on success calls `setItinerary(updated)` + `setEditKey(null)`. On failure sets `error` and leaves `editKey` unchanged so the form stays open.

`fetch` contract: `PATCH /api/trips/${tripId}/itinerary` with `Content-Type: application/json` and the full itinerary body; **204** = success (no body); non-OK responses parse `{ error?: string }` when present.

Day and trip cost totals use `dayCost` / `tripTotalCost` from `itinerary-view.tsx`. While an activity or new-activity form is open, totals preview the draft `approxCostEur` from the form field for that row.

While `pending` is true, disable all Edit, Remove, and Add buttons globally. Error display: a single error banner at the top of the editor section (not per-activity), styled to match `trip-actions.tsx` (`border-red-200 bg-red-50`). Button and input classes match `trip-actions.tsx`.

#### 3. Trip detail page: use `ItineraryEditor` for schema-valid saved itineraries

**File**: `src/app/(protected)/trips/[tripId]/page.tsx`

**Intent**: Replace the read-only `ItineraryView` render with `ItineraryEditor` when the saved itinerary is fully schema-valid. Keep `ItineraryView` as a read-only fallback for partial/malformed stored data (the existing `raw as PartialItinerary` fallback path).

**Contract**: Update `parseItinerary` to return `{ valid: true; data: Itinerary } | { valid: false; data: PartialItinerary } | null`. When `valid: true`, render `<ItineraryEditor tripId={trip.id} initialItinerary={data} />`; when `valid: false`, render `<ItineraryView itinerary={data} />`. The surrounding section header ("Itinerary") and the staleness note paragraph remain unchanged.

### Success Criteria:

#### Automated Verification:

- TypeScript clean: `npx tsc --noEmit`
- Lint clean: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Navigate to a trip with a saved itinerary → Edit and Remove buttons appear on each activity row; Edit button appears on each day title
- Click Edit on an activity → inline form appears pre-filled with current values; Cancel closes without mutation
- Edit name/description/cost, click Save → form closes, updated values displayed, day and trip totals update if cost changed
- Navigate away and back → edited values persist (server confirmed)
- Click Remove on an activity → activity disappears immediately (save happens); totals update
- Click "Add activity" on a day → blank form appears; fill and Save → new activity appears in that day
- Edit a day title → persists after save
- Two edits in sequence work without page refresh
- Error path: if network fails during save, error banner appears and form stays open

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `updateItinerary` — owner update succeeds, wrong-user rejected, non-existent trip, other fields not clobbered

### Integration Tests:

- None added in this change (PATCH endpoint is covered by unit tests + manual curl verification)

### Manual Testing Steps:

1. Open a trip with a saved itinerary; confirm Edit/Remove buttons appear
2. Edit an activity's name, save, hard-refresh → verify persisted
3. Edit cost → verify day total and trip total update in-flight before saving, and persist after
4. Add an activity to day 1, save → verify it appears after refresh
5. Remove an activity, verify totals update → refresh → confirm it's gone
6. Edit a day title, save → refresh → confirm persisted
7. Open edit form, do not save, navigate away → confirm no mutation (original values remain)
8. Test with a separate user session: PATCH another user's trip itinerary → 404

## Performance Considerations

The full itinerary JSON is PATCHed on each save. For a typical 3–7 day itinerary with 2–4 activities per day, the payload is under 5 KB — no batching or partial-update strategy needed.

## Migration Notes

No schema migration required. `itinerary_json` already exists as a nullable text column; this change writes to it with new values.

## References

- PRD: `context/foundation/prd.md` (FR-011, FR-012, §Non-Goals: no regen, §Business Logic: explicit save)
- Prior pattern — trip edit/delete: `context/changes/trip-edit-and-delete/plan.md`
- AI itinerary generation: `context/changes/ai-itinerary-generation/plan.md`
- Itinerary schema + types: `src/lib/trips/itinerary.ts`
- Read-only view (to be kept for streaming + fallback): `src/components/itinerary-view.tsx`
- Edit pattern reference: `src/components/trip-actions.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Query Helper + PATCH API

#### Automated

- [x] 1.1 All existing and new tests pass: `npm run test` — 91470d8
- [x] 1.2 TypeScript clean: `npx tsc --noEmit` — 91470d8
- [x] 1.3 Lint clean: `npm run lint` — 91470d8

#### Manual

- [x] 1.4 PATCH with valid session + valid body → 204
- [x] 1.5 PATCH with wrong owner or non-existent trip → 404
- [x] 1.6 PATCH with no session → 401
- [x] 1.7 PATCH with malformed body → 400

### Phase 2: ItineraryEditor UI Component

#### Automated

- [x] 2.1 TypeScript clean: `npx tsc --noEmit`
- [x] 2.2 Lint clean: `npm run lint`
- [x] 2.3 Build succeeds: `npm run build`

#### Manual

- [x] 2.4 Edit/Remove buttons appear on each activity row; Edit button on each day title
- [x] 2.5 Edit activity → form pre-filled; Cancel → no mutation
- [x] 2.6 Edit and save → values persist after hard-refresh
- [x] 2.7 Edit cost → totals update in-flight and persist after save
- [x] 2.8 Remove activity → gone after refresh; totals update
- [x] 2.9 Add activity → persists after save
- [x] 2.10 Edit day title → persists after save
- [x] 2.11 Network failure during save → error banner, form stays open
- [x] 2.12 Cross-user PATCH → 404
