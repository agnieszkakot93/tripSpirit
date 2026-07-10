# Edit trip details and delete a trip (S-04) — Plan Brief

> Full plan: `context/changes/trip-edit-and-delete/plan.md`

## What & Why

Let a signed-in user update a trip's destination, duration, or budget (FR-007) and
permanently delete a trip (FR-008). These are the standard CRUD operations missing from the
trip surface built in S-02, and both are required course-evaluation criteria.

## Starting Point

S-02 shipped trip create/list/get: the item route `src/app/api/trips/[tripId]/route.ts` has
only `GET`, `validateTripBody` and owner-scoped query helpers exist, and the detail page
`/trips/[tripId]` renders a read-only summary plus the itinerary section. No update/delete
API or UI exists.

## Desired End State

The trip detail page gains **Edit** (inline form, pre-filled, `PATCH`es then refreshes) and
**Delete** (native `confirm()` warning of permanent loss, then redirect to `/trips`)
controls. Edits never regenerate or clobber an existing itinerary; when one exists, it is
preserved with a staleness note. All mutations are owner-scoped (404/401 otherwise).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Edit surface | Inline toggle on detail page | No new route; reuses create-form markup; fastest to ship | Plan |
| Delete confirmation | Native `confirm()` | Zero new UI; satisfies PRD's known-risk disclosure | Plan |
| Itinerary on duration edit | Keep itinerary + staleness note | Honors FR-007 (free edits) and §Non-Goals (no regen); no data loss | Plan |
| Delete entry point | Detail page only | Reduces accidental deletes; keeps list cards as pure links | Plan |
| Post-action refresh | `router.refresh()` / push to `/trips` | Matches the existing create-form pattern; server stays source of truth | Plan |

## Scope

**In scope:** `PATCH` + `DELETE` handlers on the item route; `updateTrip`/`deleteTrip` query
helpers; inline edit form + delete button on the detail page; staleness note.

**Out of scope:** itinerary regeneration/recalculation; soft delete/undo; delete from list
cards; separate `/edit` route or modal; new validation/schema/migration; activity editing
(S-05).

## Architecture / Approach

Two new owner-scoped query helpers (modeled on `updateTripItinerary`, using `.returning()`
to detect no-op → 404). `PATCH` reuses `validateTripBody` and updates only the three editable
fields + `updatedAt` (never `itineraryJson`); `DELETE` removes one owner-scoped row (itinerary
is a column, so it goes with it). A single `"use client"` component on the detail RSC holds
edit-mode state and the `confirm()`-gated delete; the RSC remains the data source and is
refreshed after mutations.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. API — PATCH + DELETE | Owner-scoped update/delete endpoints + query helpers | `PATCH` accidentally clobbering `itineraryJson`; ownership leak if read/write split |
| 2. Detail-page edit & delete UX | Inline edit form, native-confirm delete, staleness note | Client/RSC state split; staleness note clarity |

**Prerequisites:** S-02 (`trip-creation-and-list`) shipped — present. S-03 helpful for
testing the itinerary-preservation path but not required.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Editing duration can leave the stored itinerary's day count mismatched until S-05; covered
  by a staleness note, accepted per PRD §Non-Goals.
- Hard delete is unrecoverable (no undo) — accepted by PRD FR-008.

## Success Criteria (Summary)

- A user can edit any of the three trip fields from the detail page and see/persist the change.
- A user can delete a trip after a confirmation warning and land back on `/trips` with it gone.
- Cross-user/unauthenticated update or delete is rejected (404/401) with no data mutation, and
  an existing itinerary survives an edit.
