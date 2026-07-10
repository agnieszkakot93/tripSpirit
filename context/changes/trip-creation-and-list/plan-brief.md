# Trip creation and saved trips list (S-02) — Plan Brief

> Full plan: `context/changes/trip-creation-and-list/plan.md`
> Research: `context/foundation/roadmap.md` (slice S-02) + `context/foundation/prd.md` (FR-004–FR-006)

## What & Why

Deliver **FR-004** (create trip with destination, duration, budget), **FR-005** (list own trips), and **FR-006** (open a saved trip) after **S-01** auth is in place. This slice is the dependency gate for **S-03** (AI itinerary), which needs a persisted `tripId` and `itinerary_json` row to attach to.

## Starting Point

Drizzle schema already defines `trips` with `destination`, `duration_days`, `budget_amount`, `itinerary_json`, and `userId` (`src/db/schema.ts`). There are **no** trip API routes yet; `/trips` is a stub (`src/app/trips/page.tsx`). Auth uses JWT sessions and `authorized` in `src/lib/auth.ts`; non-public routes require a session.

## Desired End State

A signed-in user can submit a trip form (city, days, budget in **EUR** whole units), see the new trip on a **newest-first** list with **destination + duration + budget** on each card, and open **`/trips/[tripId]`** showing the same fields plus an **empty itinerary placeholder** until S-03. All trip data is scoped to `session.user.id`; other users’ IDs return **404** at the API and on the detail page.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| List card content | Destination + duration + budget | Users can compare trips without opening each one. | Plan |
| After successful create | `router.push` to `/trips/[id]` | Confirms persistence and gives a stable URL for S-03 generation. | Plan |
| Trip detail before AI | Summary + empty itinerary placeholder | Satisfies FR-006 without faking generated content. | Plan |
| Backend integration | REST Route Handlers under `/api/trips` | Matches existing auth route style (`register`, etc.). | Plan |
| Budget presentation | EUR (label + €) | Clear semantics for MVP demo; schema stays integer units. | Plan |
| Create validation | City-break bounds (e.g. 1–14 days, budget ≤ 50k, destination length cap) | Blocks absurd payloads while matching PRD city-break scope. | Plan |
| API errors | `{ error: string }` | Consistent with `/api/auth/register` and easy client handling. | Plan |
| List ordering | `created_at` descending | Latest work appears first. | Plan |

## Scope

**In scope:** Session-scoped `GET`/`POST` `/api/trips`, `GET` `/api/trips/[tripId]` with ownership checks; shared validation; `/trips` list + create form; `/trips/[tripId]` detail shell; EUR formatting; empty list CTA.

**Out of scope:** Itinerary generation (S-03), trip edit/delete (S-04), activity edits (S-05), schema migrations (table already exists), regeneration, export, maps, CI/observability.

## Architecture / Approach

**Route Handlers** perform auth (`auth()`), **Cloudflare context** (`getCloudflareContext({ async: true })` where needed per existing routes), and **Drizzle** queries filtered by `userId`. **RSC pages** load list/detail with the same authorization rules (prefer **small shared helpers** in `src/lib/trips/` for “list for user” / “get by id for user” to avoid drift with handlers). **Client** form posts JSON to `POST /api/trips`, then navigates to the new trip detail.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Trip API | Validated, user-scoped list/create/get JSON API | Forgetting `userId` filter leaks data — treat as blocker in review |
| 2. `/trips` dashboard | Cards, sort, empty state, create form + redirect | Form/client edge cases (double submit, offline) |
| 3. `/trips/[id]` detail | Read-only summary + placeholder; 404 for others | Confusing UX if 404 vs 403 — plan uses 404 for both missing and forbidden |

**Prerequisites:** S-01 complete — user can sign in and reach `/trips` with a session.

**Estimated effort:** Roughly **2–3 focused sessions** (API + list + detail), plus runtime verification per AGENTS.md.

## Open Risks & Assumptions

- **S-01 timing:** If auth shell is incomplete, blocked routes or session shape may change — re-verify `session.user.id` after S-01 lands.
- **Middleware file naming:** This repo uses `src/proxy.ts` exporting `auth`; ensure global protection for `/trips` and `/api/trips` matches product expectations (API must still validate session even if navigation is protected).

## Success Criteria (Summary)

- PRD **FR-004, FR-005, FR-006** demonstrably work for a signed-in user.
- **No cross-user access** to trip records via API or direct URL guessing.
- **`npx tsc --noEmit`**, **`npm run lint`**, and **`npm run build`** pass after the slice.
