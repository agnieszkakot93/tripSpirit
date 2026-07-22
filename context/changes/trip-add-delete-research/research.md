---
date: 2026-07-22T20:22:00+02:00
researcher: Auto
git_commit: 29e54a05f40850a7727a70c4bf2b61f4d9a6065a
branch: main
repository: tripSpirit
topic: "Trip create and delete flows (UI → API → D1)"
tags: [research, codebase, trips, crud, trip-create-modal, trip-list-panel, trip-actions]
status: complete
last_updated: 2026-07-22
last_updated_by: Auto
last_updated_note: "Refreshed against main after S-01–S-05 ship, PR #13 e2e, and UX fixes"
---

# Research: Trip create and delete flows (UI → API → D1)

**Date**: 2026-07-22T20:22:00+02:00  
**Researcher**: Auto  
**Git Commit**: `29e54a05f40850a7727a70c4bf2b61f4d9a6065a`  
**Branch**: `main`  
**Repository**: tripSpirit

## Research Question

How do trip **create** and **delete** work end-to-end in TripSprint AI (UI → API → D1)? What gaps remain vs PRD FR-004 / FR-008 and archived slices S-02 / S-04?

## Summary

**Create** and **delete** are fully wired and production-verified. Create: `TripCreateModal` → `POST /api/trips` → `validateTripBody` → `insertTrip` → redirect `/trips/{id}`. Delete: two UI entry points — sidebar card menu (`trip-list-panel.tsx`) and trip workspace header (`TripActions` in `trip-workspace.tsx`) — both call `DELETE /api/trips/[tripId]` → owner-scoped `deleteTrip` (hard delete, itinerary included). API ownership and persist behavior are covered by Vitest route tests; delete-from-workspace is covered by `e2e/trip-delete.spec.ts`.

Compared to the 2026-07-09 research snapshot, several prior gaps are **closed**: `TripActions` is live on the detail page, shared confirm copy mentions itinerary loss, sidebar delete shows API errors, and sidebar navigation only redirects when the **active** trip is deleted. Remaining work is mostly **cleanup and test breadth** (`trip-create-form.tsx` dead code; no e2e for sidebar-only delete path).

## Detailed Findings

### Create flow

**User path**

1. Signed-in user clicks **Create trip** (nav sidebar, empty workspace, or placeholder).
2. `TripCreateModal` collects destination, duration (1–14, default 3), budget (presets in UI).
3. `POST /api/trips` with `{ destination, durationDays, budgetAmount }`.
4. On 201: modal closes, `router.push(/trips/{id})`, `router.refresh()` (refreshes SSR trip list in layout).

**Key files**

- UI: [`src/components/trip-create-modal.tsx`](https://github.com/agnieszkakot93/tripSpirit/blob/29e54a05f40850a7727a70c4bf2b61f4d9a6065a/src/components/trip-create-modal.tsx) — submit L24–56, redirect L50–51
- Triggers: `nav-sidebar.tsx`, `empty-workspace.tsx`, `trips-main-area.tsx` (modal state)
- API: [`src/app/api/trips/route.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/29e54a05f40850a7727a70c4bf2b61f4d9a6065a/src/app/api/trips/route.ts) — `POST` L23–47
- Validation: `src/lib/trips/validation.ts` — destination 1–120 chars, days 1–14, budget 1–50 000
- DB: `src/lib/trips/queries.ts` — `insertTrip` (UUID, `itineraryJson: null`)

**Errors**

| Condition | HTTP | Body |
|-----------|------|------|
| No session | 401 | `{ error: "Unauthorized" }` |
| Bad JSON | 400 | `{ error: "Invalid JSON body" }` |
| Validation fail | 400 | specific message |
| DB error | 500 | `{ error: "Internal error" }` |
| Success | 201 | full trip JSON |

Modal shows inline errors; no special 401 → login redirect in the client.

**PRD / product notes**

- FR-004 satisfied via modal (not the original inline `trip-create-form.tsx` from S-02 plan).
- UI budget is preset-driven; API accepts any integer in range — intentional looseness at the boundary.

### Delete flow

**User paths (two entry points, same API)**

| Entry | Component | When |
|-------|-----------|------|
| Sidebar card ⋯ menu | `trip-list-panel.tsx` → `TripCard.handleDelete` | Any trip in list |
| Trip workspace header | `trip-workspace.tsx` → `TripActions.handleDelete` | Open trip detail |

Both use shared confirm copy from `tripDeleteConfirmMessage`:

```1:3:src/lib/trips/messages.ts
export function tripDeleteConfirmMessage(destination: string): string {
  return `Delete "${destination}"? This will permanently remove the trip and its itinerary.`;
}
```

**After successful DELETE**

| Component | Navigation |
|-----------|------------|
| `TripActions` | Always `router.push("/trips")` + `refresh` (user is on deleted trip) |
| `TripListPanel` | `router.push("/trips")` **only if** deleted trip was active (`active` prop); otherwise `refresh` only |

**API**

- [`src/app/api/trips/[tripId]/route.ts`](https://github.com/agnieszkakot93/tripSpirit/blob/29e54a05f40850a7727a70c4bf2b61f4d9a6065a/src/app/api/trips/[tripId]/route.ts) — `DELETE` L70–92
- Wrong owner or missing id → **404** (no IDOR leak)
- Success → **204** empty body
- `deleteTrip` in `queries.ts` — `DELETE FROM trips WHERE id AND userId`

**Error UX (both UI paths)**

- Parse `{ error }` from JSON on failure; show inline alert (sidebar: red text on card; workspace: red banner above buttons).
- Network failure → generic network message.

**Tests**

| Layer | Coverage |
|-------|----------|
| API | `src/app/api/trips/[tripId]/route.test.ts` — 401, wrong-owner 404, owner 204 + row gone |
| Queries | `src/lib/trips/queries.test.ts` — `deleteTrip` owner scoping |
| E2E | `e2e/trip-delete.spec.ts` — create → delete via **workspace** Delete → empty state survives reload |

E2E does **not** exercise sidebar ⋯ delete or delete-while-viewing-another-trip.

### Dead / duplicate code

| File | Status |
|------|--------|
| `src/components/trip-create-form.tsx` | **Unused** — S-02 inline form never wired; safe delete candidate |
| `src/components/trip-actions.tsx` | **Live** — imported by `trip-workspace.tsx` L8, L66–72 |
| `GET /api/trips` | Exists; list UI uses SSR `listTripsForUser` in `(protected)/layout.tsx` + `router.refresh()`, not client fetch |

### PRD alignment (FR-004, FR-005, FR-008)

| Requirement | Status |
|-------------|--------|
| Create trip (destination, duration, budget) | ✅ Modal + POST |
| List / open trips | ✅ Sidebar + `/trips/[tripId]` |
| Delete trip | ✅ Sidebar + workspace |
| Hard delete, no undo | ✅ Single-row delete in D1 |
| Confirm before delete | ✅ `window.confirm` + itinerary wording |
| Delete from detail page (S-04 plan) | ✅ `TripActions` on workspace |

## Code References

- `src/components/trip-create-modal.tsx:24-56` — create submit + navigation
- `src/app/api/trips/route.ts:23-47` — POST handler
- `src/lib/trips/queries.ts` — `insertTrip`, `deleteTrip`, `listTripsForUser`
- `src/components/layout/trip-list-panel.tsx:39-64` — sidebar delete + conditional redirect + errors
- `src/components/trip-actions.tsx:67-88` — workspace delete + errors
- `src/components/trip-workspace.tsx:66-72` — `TripActions` mount
- `src/lib/trips/messages.ts:1-3` — shared delete confirm
- `src/app/api/trips/[tripId]/route.ts:70-92` — DELETE handler
- `e2e/trip-delete.spec.ts` — browser smoke (workspace delete)
- `src/components/trip-create-form.tsx` — unused legacy create UI

## Architecture Insights

- **Thin API handlers** + `src/lib/trips/{validation,queries}.ts` — same pattern as test-plan §6.2.
- **Trip list source of truth for shell**: SSR in `(protected)/layout.tsx`; mutations use `router.refresh()` rather than `GET /api/trips` from the client.
- **Ownership**: every trip query filters `eq(trips.userId, userId)`; cross-user access returns 404 at API layer (Risk #1 / #5).
- **Itinerary lifecycle**: `itinerary_json` on the same `trips` row — delete trip atomically removes itinerary (no separate table).
- **Dual delete UI** is intentional redundancy (sidebar vs detail); behavior diverges only on post-delete navigation (sidebar is context-aware).

## Historical Context (from prior changes)

- `context/archive/2026-06-10-trip-creation-and-list/` — S-02 shipped create + list (modal replaced inline form).
- `context/archive/2026-06-14-trip-edit-and-delete/` — S-04 shipped PATCH + DELETE; plan assumed detail-page actions — now implemented via `TripActions`.
- `context/foundation/roadmap.md` — S-02, S-04 marked `done` (2026-07-22 refresh).
- Prior `research.md` (2026-07-09) listed `TripActions` and sidebar error handling as gaps — **obsolete** on current `main`.

## Related Research

- `context/archive/2026-07-10-testing-trip-api-contract-ownership/` — API 401/404 ownership matrix for trip routes.
- `context/foundation/test-plan.md` §6.5 — e2e patterns; `trip-delete.spec.ts` added in PR #13.

## Open Questions

1. **Close this change as research-only?** Create/delete meet PRD; no mandatory feature gap. Optional polish: delete `trip-create-form.tsx`.
2. **E2E breadth:** Add sidebar delete spec (⋯ menu) and/or delete-other-trip-while-viewing-A (stay on `/trips/A`)?
3. **DRY:** `TripActions` and `TripCard` duplicate delete fetch logic — extract a small hook, or leave as-is (only ~15 lines each)?
4. **401 on create/delete:** Should client redirect to `/login` on 401, or is layout guard sufficient?
