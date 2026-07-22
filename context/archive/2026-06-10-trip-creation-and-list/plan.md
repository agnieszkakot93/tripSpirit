# Trip creation and saved trips list (S-02) Implementation Plan

## Overview

Implement roadmap slice **S-02** (`trip-creation-and-list`): persisted trip creation (FR-004), per-user trip list (FR-005), and opening a saved trip (FR-006). Builds on existing `trips` Drizzle schema and Auth.js session; introduces `/api/trips` Route Handlers and replaces the `/trips` stub with a real dashboard plus a **`/trips/[tripId]`** detail shell ahead of **S-03** AI generation.

## Current State Analysis

- **Schema:** `trips` table exists with `destination`, `duration_days`, `budget_amount`, `itinerary_json` (nullable), `userId`, timestamps, index on `userId` — `src/db/schema.ts`.
- **APIs:** Only `src/app/api/auth/*`; patterns use `getCloudflareContext({ async: true })`, `getDb()`, Drizzle, `NextResponse.json({ error })` on failure — e.g. `src/app/api/auth/register/route.ts`.
- **UI:** `src/app/trips/page.tsx` is a placeholder referencing future FR work.
- **Auth:** JWT strategy; `authorized` marks `/`, `/login`, `/api/auth/*` public — all other paths require `session` — `src/lib/auth.ts`. Session exposes `user.id` via `token.sub` callback.

## Desired End State

Signed-in users can create trips (destination string, duration in days, budget as whole **EUR** units), see a **newest-first** list where each row/card shows **destination, day count, and budget (€)**, and open **`/trips/[tripId]`** showing the same trip fields plus copy/placeholder for itinerary not yet generated. Unauthenticated or cross-user access to trip JSON returns **401** or **404** (same body shape as today: `{ error: string }`). Automated checks (`npx tsc --noEmit`, `npm run lint`, `npm run build`) pass.

### Key Discoveries:

- No migration is required for this slice if the existing `0000` migration already created `trips` (verify in `drizzle/` before implementation; generate only if schema drift appears).
- Sibling routes (`register`, `delete-account`) declare no explicit runtime — new trip routes can follow the same default.
- PRD guardrail: trip data must never cross users — enforce `userId === session.user.id` on every read/write path.

## What We're NOT Doing

- AI itinerary generation, streaming, or writes to `itinerary_json` (S-03).
- Trip update/delete (S-04), activity editing (S-05).
- New columns (e.g. currency) — EUR is display-only convention over existing integers.
- Soft delete, undo, or trip naming beyond destination string.
- GitHub Actions, logging platform, or analytics.

## Implementation Approach

Add **REST-style Route Handlers** for JSON CRUD subset (list, create, get-by-id). Centralize **validation bounds** (city-break: destination length cap, **1–14** duration days, budget **1–50_000** inclusive) and reuse from POST handler. Extract **trip query helpers** (list for user, fetch by id for user) consumed by handlers and by **RSC** pages so authorization logic does not diverge. Build **client create form** that `POST`s JSON, handles `{ error }`, then **`router.push(`/trips/${id}`)`** on success. Implement **detail page** as RSC using the same helper: if no row or wrong owner, **`notFound()`** (user-facing 404) to avoid leaking existence of other users’ IDs.

## Critical Implementation Details

- **API + pages must both enforce ownership** — navigation middleware alone is insufficient for `/api/trips` if clients tamper with IDs.
- **EUR display** is formatting only; persisted values remain integers per `budget_amount` comment in schema.

## Phase 1: Trip API (list, create, get by id)

### Overview

Session-scoped JSON endpoints with shared validation and `{ error: string }` error contract; newest-first ordering on list.

### Changes Required:

#### 1. Trip validation helper module

**File**: `src/lib/trips/validation.ts` (path illustrative — keep module small)

**Intent**: Parse and validate POST body fields with agreed bounds; return a structured failure message string for the API layer to emit as `{ error }`.

**Contract**: Accepts unknown JSON; outputs either `{ ok: true, values: { destination, durationDays, budgetAmount } }` or `{ ok: false, error: string }`. Bounds: destination trim length **1–120**, `durationDays` integer **1–14**, `budgetAmount` integer **1–50000**.

#### 2. Trip data access helpers

**File**: `src/lib/trips/queries.ts` (path illustrative)

**Intent**: Encapsulate Drizzle selects/insert for trips filtered by `userId`, including list ordering `created_at DESC` and single-trip fetch by `id` + `userId`.

**Contract**: Functions take `db` + `userId` (+ `tripId` for detail); insert sets `id` (uuid), `createdAt`/`updatedAt` (now ms), `itineraryJson` null.

#### 3. Collection route — GET list, POST create

**File**: `src/app/api/trips/route.ts`

**Intent**: `GET` returns JSON array of caller’s trips (fields needed for UI cards, excluding `itinerary_json` if large — optional omission). `POST` validates body, inserts row for `session.user.id`, returns **201** with created trip JSON including `id`.

**Contract**: Unauthenticated → **401** `{ error}`. Validation failure → **400**. Uses `getCloudflareContext` + `getDb` pattern consistent with `register/route.ts`.

#### 4. Item route — GET by id

**File**: `src/app/api/trips/[tripId]/route.ts`

**Intent**: Return one trip JSON for owner; used for consistency, testing, and optional client refetch.

**Contract**: Missing or non-owner → **404** `{ error }`. Unauthenticated → **401**.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Unauthenticated `GET /api/trips` returns **401** with `{ error }` (in-handler session guard; `/api/trips` is not behind the `(protected)` layout)
- Authenticated `POST /api/trips` with invalid payload returns **400** with `{ error }`
- Authenticated `GET /api/trips/{otherUserTripId}` returns **404** when that trip belongs to another account (create second user in dev if needed)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: `/trips` dashboard (list + create)

### Overview

Replace stub with a dashboard: empty state, trip cards (destination + duration + budget in EUR), create trip form wired to `POST /api/trips`, redirect to new trip detail on success.

### Changes Required:

#### 1. Trips index page

**File**: `src/app/trips/page.tsx`

**Intent**: Server-render authenticated context; load trips via shared query helper (same rules as GET handler — not duplicate business logic). Render list + link to each `/trips/[id]`.

**Contract**: Uses `auth()`; if no session, rely on global auth redirect or handle per existing app pattern for `/trips`.

#### 2. Client trip create form

**File**: `src/components/trip-create-form.tsx` (path illustrative — match existing `src/components/` conventions)

**Intent**: Controlled inputs for destination, duration, budget; `fetch` POST to `/api/trips`; on success `router.push(`/trips/${id}`)`; on failure show `error` string; disable submit while pending.

**Contract**: Request `Content-Type: application/json`; body keys align with validation module (camelCase in JSON is fine if parser accepts — document chosen wire format in one place).

#### 3. Optional small presentational components

**File**: `src/components/trip-card.tsx` or inline in page if trivial

**Intent**: One card per trip for consistent EUR formatting and day label (“3 days”).

**Contract**: Props include `id`, `destination`, `durationDays`, `budgetAmount`.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Empty account shows clear CTA / form to create first trip
- After create, browser lands on `/trips/{newId}` with correct summary fields
- List shows newest trip at top after navigating back to `/trips`
- Card displays destination, day count, and budget with € / EUR convention

**Implementation Note**: After automated checks pass, run AGENTS.md runtime verification (`/verify` or `npm run dev` + manual UI) before Phase 3.

---

## Phase 3: `/trips/[tripId]` detail shell

### Overview

Trip detail route: read-only trip fields plus explicit placeholder for itinerary (“Generate itinerary” or neutral copy pointing to S-03 — wording is product choice; no fake AI output).

### Changes Required:

#### 1. Dynamic trip detail page

**File**: `src/app/trips/[tripId]/page.tsx`

**Intent**: RSC loads trip by id for `session.user.id` via shared helper; `notFound()` when missing or wrong owner; render destination, duration, budget (EUR), timestamps optional, and empty itinerary section.

**Contract**: URL param is `tripId`; must not leak other users’ trips via different error messages.

#### 2. Navigation affordances

**Files**: detail page + optional shared layout later

**Intent**: Link back to `/trips`; ensure layout does not break dark/light classes used elsewhere.

**Contract**: None beyond consistent `Link` usage.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Valid `tripId` shows saved fields and placeholder itinerary region
- Random UUID returns **404** page
- Another user’s valid `tripId` returns **404** (not 403) for this MVP

**Implementation Note**: Pause for manual pass after this phase; then mark roadmap S-02 ready for implementation archive when shipped.

---

## Testing Strategy

### Unit Tests:

- Not required for this slice unless the repo introduces a test runner later — validation helpers are good first test candidates when infrastructure exists.

### Integration Tests:

- Optional future: HTTP tests against dev server for API auth matrix.

### Manual Testing Steps:

1. Register/sign in as user A; create trip; confirm redirect and detail view.
2. Create second trip; confirm ordering on `/trips`.
3. Copy user B’s `tripId` (if two browsers) and confirm user A cannot open it (404 / not found).
4. Sign out; hit `/api/trips` and confirm 401.

## Performance Considerations

List volume is MVP-small; single query with `userId` index is sufficient. No pagination in this slice.

## Migration Notes

None expected — if local D1 lacks `trips` table, run `npx wrangler d1 migrations apply tripsprint-ai-db --local` per AGENTS.md before testing (pre-existing project step, not introduced by this slice).

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-02)
- PRD: `context/foundation/prd.md` (FR-004–FR-006, guardrails)
- Schema: `src/db/schema.ts`
- Auth pattern: `src/lib/auth.ts`, `src/app/api/auth/register/route.ts`

## Progress

### Phase 1: Trip API (list, create, get by id)

#### Automated

- [x] 1.1 `npx tsc --noEmit` passes — e35799b
- [x] 1.2 `npm run lint` passes — e35799b
- [x] 1.3 `npm run build` passes — e35799b

#### Manual

- [x] 1.4 Unauthenticated `GET /api/trips` returns 401 with `{ error }` (in-handler session guard; `/api/trips` is not behind the `(protected)` layout — proxy middleware removed in 254d4a1; verify with curl or browser devtools) — e35799b
- [x] 1.5 Authenticated `POST` with invalid body returns 400 with `{ error }` — e35799b
- [x] 1.6 Cross-user `GET /api/trips/[tripId]` returns 404 — e35799b

### Phase 2: `/trips` dashboard (list + create)

#### Automated

- [x] 2.1 `npx tsc --noEmit` passes — 85f1c09
- [x] 2.2 `npm run lint` passes — 85f1c09
- [x] 2.3 `npm run build` passes — 85f1c09

#### Manual

- [x] 2.4 Empty state + first-trip flow works — 85f1c09
- [x] 2.5 Post-create redirects to `/trips/[id]` with correct fields — 85f1c09
- [x] 2.6 List ordering newest-first; cards show destination, days, EUR budget — 85f1c09

### Phase 3: `/trips/[tripId]` detail shell

#### Automated

- [x] 3.1 `npx tsc --noEmit` passes — ae36f28
- [x] 3.2 `npm run lint` passes — ae36f28
- [x] 3.3 `npm run build` passes — ae36f28

#### Manual

- [x] 3.4 Valid trip shows summary + itinerary placeholder — ae36f28
- [x] 3.5 Unknown id shows not-found UX — ae36f28
- [x] 3.6 Other user’s id shows not-found UX (no leak) — ae36f28
