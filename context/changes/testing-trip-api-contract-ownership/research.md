---
date: 2026-07-10T14:09:21+0200
researcher: Agnieszka Kot
git_commit: 76cb4894420cd54875ed9fd112e92a0ac3fd60ea
branch: main
repository: tripSpirit
topic: "Trip API contract & ownership — grounding Risks #1, #5, #6 and picking a route-test harness (test-plan Phase 1)"
tags: [research, codebase, trip-api, ownership, auth-guard, test-harness]
status: complete
last_updated: 2026-07-10
last_updated_by: Agnieszka Kot
---

# Research: Trip API contract & ownership (test-plan Phase 1)

**Date**: 2026-07-10T14:09:21+0200
**Researcher**: Agnieszka Kot
**Git Commit**: 76cb4894420cd54875ed9fd112e92a0ac3fd60ea
**Branch**: main
**Repository**: tripSpirit

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md` ("Trip API contract
& ownership") in actual code, so `/10x-plan` can write route-level integration
tests. Specifically:

- **Risk #1 (IDOR)** — do trip routes enforce ownership on all verbs; what does a wrong-owner request return?
- **Risk #5 (auth)** — how are unauthenticated page/API accesses blocked; are page and API guards truly separate?
- **Risk #6 (silent save failure)** — is input validated; can a 2xx be returned without the DB write landing?
- **Harness** — cheapest viable way to test these routes (none exist today; Vitest runs `node` env with 3 unit files under `src/lib/trips/`).

## Summary

The trip API is **well-defended on all three risks** — Phase 1 is therefore a
**regression-guard** exercise, not a bug hunt. Findings that shape the plan:

1. **Ownership (#1) is enforced uniformly** in the query layer: every trip query
   is scoped by `userId` from the session inside the same `WHERE`, and `userId`
   on create comes from the session, never the request body. **Wrong-owner
   returns 404** (resource-hiding), consistently across GET/PATCH/DELETE — never
   403, never 200-with-someone-else's-data. Because wrong-owner and truly-nonexistent
   are **indistinguishable by status** (both 404), an ownership test must assert
   the target row is **unchanged in the DB** after a wrong-owner PATCH/DELETE —
   not just the 404.
2. **Auth (#5)** rests on **two genuinely separate mechanisms with no shared
   middleware**: a server-side `redirect()` in `(protected)/layout.tsx` for pages,
   and a per-handler `await auth()` + 401 in each API route. **There is no
   `middleware.ts`** and no `auth-edge.ts` (a comment in `auth.ts` referencing
   one is stale/misleading). A new route that forgets its guard is unguarded by
   default — the test should lock the per-route 401 in.
3. **Persistence (#6)**: input is validated by a **hand-rolled validator (not
   zod)** *before* any DB call; invalid → 400 with `{error}`. Mutating handlers
   derive their response from drizzle `.returning()`, so status is coupled to
   actual row count — **no 2xx-without-write path** in these routes. **PATCH is a
   full replace (PUT semantics)**: all fields required; a partial patch → 400.
4. **Harness**: recommend **direct handler call + `vi.mock("@/lib/auth")` +
   `vi.mock("@/lib/db")`** backed by an in-memory `better-sqlite3` drizzle client
   seeded from `drizzle/0000_sleepy_mandrill.sql` — the exact pattern
   `queries.test.ts` already uses. **Zero new dependencies.** Lets a test assert
   both the HTTP `NextResponse` and the persisted row (read-back via the same
   sqlite handle).

## Detailed Findings

### Trip API routes — ownership & persistence (Risk #1, #6)

Files: `src/app/api/trips/route.ts` (list/create), `src/app/api/trips/[tripId]/route.ts`
(get/update/delete), `src/lib/trips/queries.ts` (data access), `src/lib/trips/validation.ts`,
`src/db/schema.ts`, `src/lib/db.ts`.

- Ownership column: `trips.userId` FK → `users.id`, `onDelete: cascade`, indexed
  `trips_user_idx` — `src/db/schema.ts:59-61,70`.
- Identity via `auth()` gated on `session.user.id` in all five handlers:
  `route.ts:9-12` (GET), `:24-27` (POST); `[tripId]/route.ts:12-15` (GET),
  `:37-40` (PATCH), `:74-77` (DELETE).
- Every query owner-scoped:
  - `listTripsForUser` — `.where(eq(trips.userId, userId))` — `queries.ts:14-28`
    (returns no `itineraryJson` by design, `:16-24`).
  - `insertTrip` — `userId` from session (`route.ts:43`), never body — `queries.ts:44-65`.
  - `getTripForUser` — `.where(and(eq(trips.id, tripId), eq(trips.userId, userId)))`
    → wrong-owner `null` → **404** — `queries.ts:31-42`, `[tripId]/route.ts:23-25`.
  - `updateTrip` — same compound WHERE with `.returning()` → wrong-owner 0 rows →
    **404**, no cross-owner mutation — `queries.ts:67-84`, `[tripId]/route.ts:60-62`.
  - `deleteTrip` — same, `.returning({id})` → **404** if nothing deleted —
    `queries.ts:86-96`, `[tripId]/route.ts:85-87`.
- Validation: `validateTripBody` (custom, discriminated result) — `validation.ts:7-50`:
  `destination` 1–120 chars; `durationDays` int 1–14; `budgetAmount` int 1–50000.
  Invalid → **400 `{error}`** before DB: POST `route.ts:36-39`, PATCH `[tripId]/route.ts:49-52`;
  malformed JSON → 400 `{error:"Invalid JSON body"}` (`route.ts:32-34`, `[tripId]/route.ts:45-47`).
- **PATCH = full replace (PUT)**: runs the same `validateTripBody`; one-field patch → 400.
- Response derived from `.returning()` (`queries.ts:63-64,82-83`) → **no 2xx-without-write**.

Response shapes: GET list 200 array / 401 / 500; POST 201 trip / 400 / 401 / 500;
GET one 200 / 404 `{error:"Not found"}` / 401 / 500; PATCH 200 / 400 / 404 / 401 / 500;
DELETE **204 empty** / 404 / 401 / 500. Unauthorized body always `{error:"Unauthorized"}`.

### Auth enforcement (Risk #5)

Files: `src/lib/auth.ts`, `src/app/(protected)/layout.tsx`, the trip routes.

- NextAuth factory at `src/lib/auth.ts:11`, **JWT** strategy (`:16`), sign-in `/login` (`:18`).
- Session carries user id: `token.sub = user.id` (`:61`) → `session.user.id` (`:64-68`),
  typed in `src/types/next-auth.d.ts:3-9`.
- **API guard (per-route, 401 JSON, never redirect)** — identical block:
  `if (!session?.user?.id) return NextResponse.json({error:"Unauthorized"},{status:401})`
  at `route.ts:9-12,24-27`; `[tripId]/route.ts:12-15,37-40,74-77`;
  `[tripId]/itinerary/route.ts:20-23,59-62`; `auth/delete-account/route.ts:12`.
- **Page guard (server-side redirect)** — `(protected)/layout.tsx:15-18`:
  `const session = await auth(); if (!session) redirect(\`/login${await callbackQuery()}\`)`
  (302, `?callbackUrl=` from `x-opennext-initial-url`/`next-url`, `:38-57`).
- **Two separate mechanisms — CONFIRMED.** No `middleware.ts` anywhere; no
  `src/lib/auth-edge.ts` despite the stale comment at `auth.ts:57-59`; the
  `authorized` callback is intentionally omitted, so that path does not run.
- **Guard asymmetry**: page guard tests `!session`; API guard tests `!session?.user?.id`
  (stricter — a session lacking an id is rejected by the API but would pass the page guard).

### Test harness feasibility

- `vitest.config.ts:1-13` — `environment: "node"`, path alias only; **no** setupFiles,
  no pool, no `@cloudflare/vitest-pool-workers`.
- devDeps: `vitest@^4.1.8`, `better-sqlite3@^12.10.1` (+types), `wrangler@^4.99.0`,
  `drizzle-kit`. No msw, no edge-runtime vm, no workers pool.
- Existing tests are pure unit: `queries.test.ts` builds `new Database(":memory:")`
  + `drizzle(sqlite,{schema})` and **passes `db` into each query fn** (queries take
  `db` as first arg — `queries.ts:14,31,44,67,86,103,126`). Clean DI.
- Route handlers instead reach runtime seams: DB via `getDb()` (`src/lib/db.ts:9-12`
  → `getAppCloudflareContext()` in `src/lib/cloudflare-context.ts:35-41`), and
  `auth()` from `@/lib/auth` (which itself calls `getAppCloudflareContext()`+`getDb()`
  at init, `auth.ts:12`). Under `NODE_ENV=test` neither context branch resolves.
- Local D1 sqlite exists at `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`;
  migration SQL at `drizzle/0000_sleepy_mandrill.sql`.

**Ranked harness options (cost × signal):**

| Option | Deps | Config | Asserts | Verdict |
|--------|------|--------|---------|---------|
| **(a) Direct handler + `vi.mock` auth+db, in-memory better-sqlite3** | none new | `vi.mock("@/lib/auth")`, `vi.mock("@/lib/db")`, load migration SQL | HTTP `NextResponse` **and** persisted row read-back | **RECOMMENDED** |
| (b) `@cloudflare/vitest-pool-workers` real bindings | +pool-workers | rewrite config to `defineWorkersConfig` | real HTTP + real D1 | high fidelity, high/unproven setup — defer |
| (c) `wrangler unstable_dev` black-box | wrangler (have) | needs built OpenNext worker | HTTP only; DB via side channel | slow/flaky — reject for per-route |

Recommendation: **(a)**. Every handler obtains DB solely via `getDb()` and session
solely via `auth()`, so mocking those two seams drives the real handler code while
asserting both the response and the persisted D1 side-effect. Reserve (b) only if
the real workerd/D1 driver or NextAuth JWT flow ever needs validation.

## Code References

- `src/app/api/trips/route.ts:9-12,24-27,36-39,43-44` — list/create guard, validation, session-owned insert
- `src/app/api/trips/[tripId]/route.ts:12-15,23-25,37-40,49-52,60-62,74-77,85-87` — per-verb guard, 404s, validation
- `src/lib/trips/queries.ts:14-96` — owner-scoped list/get/insert/update/delete
- `src/lib/trips/validation.ts:7-50` — custom `validateTripBody`
- `src/db/schema.ts:59-70` — `trips.userId` ownership column + index
- `src/lib/db.ts:9-12`, `src/lib/cloudflare-context.ts:35-41` — DB/context seams to mock
- `src/lib/auth.ts:11-18,57-68` — NextAuth factory, JWT, stale auth-edge comment, session id
- `src/app/(protected)/layout.tsx:15-18,38-57` — server-side redirect guard
- `src/lib/trips/queries.test.ts:17-42` — existing in-memory drizzle harness to mirror
- `vitest.config.ts:1-13` — current node-env config
- `drizzle/0000_sleepy_mandrill.sql` — migration SQL to seed the test DB

## Architecture Insights

- **Ownership is a query-layer invariant, not a route-layer check** — the `userId`
  predicate lives inside every `WHERE`, so ownership and existence collapse into
  one 404. Robust, but means status alone can't prove "I couldn't touch your row";
  DB read-back is the real oracle.
- **Auth is decentralized** — no umbrella middleware. Correctness depends on every
  route/layout repeating the guard. A regression test per protected surface is the
  cheapest way to notice a dropped guard.
- **DI-friendly seams** — `getDb()` and `auth()` are the only two boundaries a route
  test must stub; the codebase already trusts in-memory drizzle for DB.

## Historical Context (from prior changes)

- `context/changes/gdpr-account-deletion/` — review findings F1–F3 (cited in test-plan
  §2 Risk #4) established the `delete-account` auth/authz ordering; the same
  `if (!session?.user?.id)` guard pattern appears at `auth/delete-account/route.ts:12`.
  Rate-limiting was explicitly deferred there (test-plan §7 negative space).

## Backport candidates for `context/foundation/test-plan.md` §2

Refinements for the **post-research backport check** in `/10x-test-plan` (Source /
wording / Risk Response Guidance only — never file anchors):

1. **Risk #1 guidance** — confirm "wrong-owner returns **404** (not 403)"; add that
   the response is indistinguishable from not-found, so the protective assertion is
   **"target row unchanged in DB after wrong-owner PATCH/DELETE"**, not the 404 alone.
2. **Risk #6 guidance** — "zod/schema" is inaccurate: validation is a **custom
   `validateTripBody`** (behaviorally equivalent: 4xx-with-message, pre-DB). Also note
   **PATCH = full replace (PUT semantics)** so tests must send all fields.
3. **Risk #5 guidance** — the "two separate mechanisms" claim is **confirmed and
   stronger than stated**: there is *no* middleware, so the risk is specifically "a
   new/edited route silently drops its per-handler guard." Worth noting the
   page-guard (`!session`) vs API-guard (`!session?.user?.id`) asymmetry and the
   stale `auth-edge.ts` comment (`auth.ts:57-59`).

These are refinements, not contradictions — no risk needs dropping or reframing.

## Open Questions

- Should the stale `auth-edge.ts` comment at `auth.ts:57-59` be removed as part of
  this change, or logged separately? (Out of scope for a test-only phase.)
- Do we want one shared test helper (`makeTestDb()` + `mockSession(userId)`) to seed
  the harness for Phases 2–3 too? (A plan decision.)
