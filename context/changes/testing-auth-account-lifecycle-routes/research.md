---
date: 2026-07-21T21:08:33+0200
researcher: Agnieszka Kot
git_commit: 0909eeaaaeed82e5a56ad1127d4907d83a303eab
branch: main
repository: tripSpirit
topic: "Auth & account-lifecycle routes — grounding Risks #4, #5 (test-plan Phase 2)"
tags: [research, codebase, auth, password-reset, delete-account, enumeration, test-harness]
status: complete
last_updated: 2026-07-21
last_updated_by: Agnieszka Kot
---

# Research: Auth & account-lifecycle routes (test-plan Phase 2)

**Date**: 2026-07-21T21:08:33+0200
**Researcher**: Agnieszka Kot
**Git Commit**: 0909eeaaaeed82e5a56ad1127d4907d83a303eab
**Branch**: main
**Repository**: tripSpirit

## Research Question

Ground rollout Phase 2 of `context/foundation/test-plan.md`
("Auth & account-lifecycle routes") in actual code, so `/10x-plan` can write
route-level integration tests. Specifically:

- **Risk #4** — forgot-password response parity (known / unknown / send-failure);
  reset token single-use / forged / expired; delete-account auth order
  (401 no session, 403 wrong password).
- **Risk #5** — what of the unauthenticated-access surface remains after Phase 1
  trip API 401 tests; confirm layout vs API guards stay separate; page redirect
  deferred to Phase 4.
- **Harness** — what to extend in `src/test/route-harness.ts` and which seams to
  mock (`@/lib/email`, Cloudflare context) for auth lifecycle routes.

## Summary

The account-lifecycle routes are **already well-defended** on Risk #4 — Phase 2
is a **regression-guard** for the fixes landed in `gdpr-account-deletion`
(F1–F3), not a bug hunt. Risk #5's trip CRUD 401 half is already locked by
Phase 1; Phase 2's residual is **delete-account's 401** (overlaps #4) plus
confirming the page-redirect half stays Phase 4 e2e.

1. **Forgot-password parity (#4) is real.** `POST /api/auth/forgot-password`
   always returns `200 { ok: true }` for known email, unknown email, and
   token/email-send failure (try/catch swallows, logs server-side). Only
   malformed JSON / invalid email shape → 400. This is the F1 fix, intentionally
   documented in-route.
2. **Reset tokens are single-use.** `consumePasswordResetToken` deletes the row
   on successful lookup; forged, expired, and reused tokens all collapse to the
   same `400 { error: "Invalid or expired reset link" }` (F3 also maps
   "user deleted between issue and consume" to that same 400). TTL = 1 hour;
   new reset invalidates prior tokens for the same email.
3. **Delete-account auth order is correct.** `auth()` → 401 first; then password
   required → 400 if missing; wrong / missing hash → 403; only then delete
   verification tokens + user (cascade). Deletion cannot succeed without both
   a valid session and a correct password.
4. **Risk #5 residual after Phase 1:** trip list/create/`[tripId]` 401s are
   covered. Still untested: `delete-account` 401 (in Phase 2 scope) and
   itinerary route 401s (defer to Phase 3 with those routes). Page layout
   redirect remains a separate mechanism with **no `middleware.ts`** — Phase 4
   e2e only.
5. **Harness gaps:** `makeTestDb()` has `users` + `trips` only — needs
   `verification_tokens` (and preferably `accounts`/`sessions` for cascade
   parity). `seedUser` must accept email + passwordHash. Mock
   `sendPasswordResetEmail` via `vi.mock("@/lib/email")` (and stub
   `getAppCloudflareContext` for `AUTH_URL` on the known-email path).

**Cheapest useful layer:** integration (route-level), same Phase 1 pattern —
direct handler call + mock `@/lib/auth` / `@/lib/db` / `@/lib/email`. Optional
unit tests for `auth-tokens.ts` (consume/expire) and password verify are
cheap extras, not substitutes for the route cases.

## Detailed Findings

### Forgot-password — response parity (Risk #4)

File: `src/app/api/auth/forgot-password/route.ts`

- Malformed JSON → `400 { error: "Invalid JSON body" }` (`:12-16`).
- Email not a string / no `@` → `400 { error: "Valid email is required" }` (`:18-21`).
- Known user: create token + send email inside `if (user)` (`:38-43`).
- Unknown user: skip token/send, fall through (`:32-36` then no `if` body).
- Any throw in the try (DB, token, Resend) → catch logs, no rethrow (`:44-47`).
- **Unconditional** `return NextResponse.json({ ok: true })` (`:49`) — known,
  unknown, and send-failure all share this path.

**Guidance verdict:** Accurate. Must-challenge ("happy-path 200 proves abuse
paths") is the right anti-assumption — tests must assert three setups, one
identical response, not only the registered+email-ok case.

**Email boundary:** `sendPasswordResetEmail` in `src/lib/email.ts` throws on
Resend non-ok; Cloudflare Email send rejects propagate; console fallback never
throws. In Vitest without `RESEND_API_KEY`/`EMAIL`, the console path fires
unless the test injects env — so the send-failure branch must
**mock `@/lib/email` to throw**, not rely on default env.

Also calls `getAppCloudflareContext()` for `env.AUTH_URL` on the known-email
path (`:39-41`) — that seam needs a stub when the known-email branch runs.

### Reset-password — single-use / forged / expired (Risk #4)

Files: `src/app/api/auth/reset-password/route.ts`, `src/lib/auth-tokens.ts`

- Missing/empty token → `400 { error: "Invalid or expired reset link" }`
  (`reset-password/route.ts:18-19`) — same message as consume-null.
- Password `< 8` → `400 { error: "Password must be at least 8 characters" }`
  (`:21-26`).
- `consumePasswordResetToken` (`auth-tokens.ts:33-54`): SELECT where
  `token = ? AND expires > now()`; if no row → `null`; else DELETE by token
  then return identifier. **Reuse impossible** after a successful consume.
- Create (`auth-tokens.ts:13-26`): `crypto.randomUUID()`, TTL 1h, deletes prior
  tokens for that email before insert.
- User gone after consume → `.returning({ id })` empty → same generic 400
  (`reset-password/route.ts:42-45`) — F3 fix.
- Success → `200 { ok: true }` (`:48`).

**Guidance refinement (not a contradiction):** forged, expired, and reused
tokens all produce the **same** 400 body. Plan should require three setups,
one assertion — not three different status codes.

**Known-untested edge (do not pad Risk #4):** SELECT-then-DELETE is not in a
transaction — narrow concurrent TOCTOU. Skip as a Vitest target; record as
accepted gap (rate limiting already deferred; UUID entropy makes guessing
impractical — F4).

**Plaintext token storage** in `verification_tokens.token` — data-at-rest
concern, not a route-test target. One-line note only.

### Delete-account — session + password (Risk #4 + #5 API half)

File: `src/app/api/auth/delete-account/route.ts`

- `auth()` first; `!session?.user?.id` → `401 { error: "Unauthorized" }`
  (`:10-12`).
- Missing password → `400 { error: "Password is required" }` (`:22-24`).
- No `passwordHash` or `verifyPassword` false → `403 { error: "Invalid password" }`
  (`:40-46`) — **no delete**.
- On success: delete `verification_tokens` for email (`:49-55`), then
  `DELETE users` (`:57-58`) — cascades trips/sessions/accounts per schema FKs.
- Success → `200 { ok: true }` (`:60`).

**Guidance verdict:** Accurate including auth-before-password order.

**Accepted gap (F5):** JWT strategy — cookie may remain valid until client
`signOut()`; not a single-POST route-test target.

### Risk #5 — residual after Phase 1

| Surface | Status | Phase |
|---------|--------|-------|
| `GET/POST /api/trips` 401 | Covered (`route.test.ts`) | Phase 1 done |
| `GET/PATCH/DELETE /api/trips/[tripId]` 401 | Covered | Phase 1 done |
| `DELETE /api/auth/delete-account` 401 | **Uncovered** | **Phase 2** |
| Itinerary PATCH/POST 401 | Uncovered | Phase 3 (with those routes) |
| `(protected)/layout.tsx` redirect | Uncovered | Phase 4 e2e |
| `trips/[tripId]/page.tsx` `notFound()` if no userId | Divergent from layout redirect | Flag for Phase 4 |

**Two mechanisms still confirmed:**

- API: per-handler `auth()` → JSON 401 (`delete-account/route.ts:10-12` and trip routes).
- Pages: `(protected)/layout.tsx:15-17` — `if (!session) redirect(/login…)`.
- **No `middleware.ts`** in the repo.

**Intentionally public (not Risk #5 failures):**
`forgot-password`, `reset-password`, `register`, `[...nextauth]` — no session
required. Register **does** enumerate via `409` on duplicate email — out of
Risk #4 scope (signup must reject duplicates); do not generalize "no
enumeration anywhere."

**Hot-spot note:** §2 cites `src/app/api` + `src/app/login` as likelihood
evidence. Live failure surface for #4 is under `src/app/api/auth/` (+
`src/lib/auth-tokens.ts`, `src/lib/email.ts`). `src/app/login` is UI churn, not
the oracle. Not speculative — just don't treat the login dir as the anchor.

### Existing tests

- Auth routes: **zero** `route.test.ts` under `src/app/api/auth/`.
- No unit tests for `password.ts`, `auth-tokens.ts`, or `email.ts`.
- Trip route tests + `src/test/route-harness.smoke.test.ts` only.

### Harness gaps for Phase 2

Current `src/test/route-harness.ts`:

- DDL: `users` + `trips` only (`:52-72`) — **no `verification_tokens`**.
- `seedUser(db, userId)` inserts `{ id }` only (`:77-78`) — no email /
  passwordHash.
- Mocks: `auth` + `getDb` only — no email / Cloudflare context helpers.

**Required extensions:**

1. Add `verification_tokens` DDL (match `drizzle/0000_sleepy_mandrill.sql` /
   `schema.ts`). Optionally `accounts` + `sessions` for cascade assertions.
2. Enrich `seedUser` with `{ email?, passwordHash? }` (or a dedicated helper).
3. Helper to seed a live / expired reset token row.
4. Prefer real `hashPassword` for one seed password (accept scrypt cost) or a
   fixed fixture hash compatible with `verifyPassword`.
5. `vi.mock("@/lib/email")` — throw for send-failure parity; resolve for happy
   known-email path.
6. Stub `getAppCloudflareContext` so known-email forgot-password can build
   `resetUrl` without workerd.

### Risk response guidance — verify / correct

| Risk | Guidance status | Plan implication |
|------|-----------------|------------------|
| #4 forgot-password parity | **Confirmed** | Three cases → identical `200 { ok: true }`; mock email throw for third |
| #4 token reuse | **Confirmed**; extend to forged + expired same 400 | Three setups, one response |
| #4 delete auth order | **Confirmed** | 401 → 403 → success; DB read-back that user row is gone / unchanged |
| #5 trip API 401 | **Already covered Phase 1** | Do not re-test trip CRUD 401 in Phase 2 |
| #5 page redirect | **Confirmed separate**; e2e still right | Defer to Phase 4; flag `[tripId]/page` 404 divergence |
| #5 delete-account 401 | **Uncovered; in Phase 2** | Include with Risk #4 delete cases |

**Not speculative:** all #4 behaviors exist in code today (F1–F3 already fixed).
No risk rows to drop.

**Anti-patterns to keep:** happy-path-only reset; asserting only status without
DB/token-table read-back on delete/consume; e2e for API 401; oracle from
implementation strings beyond the stable public messages already used as the
contract (`"Unauthorized"`, `"Invalid or expired reset link"`, `"Invalid password"`).

## Code References

- `src/app/api/auth/forgot-password/route.ts:25-49` — parity swallow + `{ ok: true }`
- `src/app/api/auth/reset-password/route.ts:18-48` — consume + generic 400 + F3
- `src/app/api/auth/delete-account/route.ts:10-60` — 401 / 403 / delete order
- `src/lib/auth-tokens.ts:13-54` — create (TTL, invalidate prior) + consume (single-use)
- `src/lib/email.ts` — Resend fetch throws on non-ok; console fallback no-throw
- `src/app/(protected)/layout.tsx:15-17` — page redirect guard
- `src/test/route-harness.ts:46-116` — current harness (users/trips only)
- `src/app/api/trips/route.test.ts` / `[tripId]/route.test.ts` — Phase 1 401 pattern

## Architecture Insights

- Auth is **decentralized**: every protected API route owns its `auth()` check;
  pages own layout redirect. Forgetting a check leaves that surface open — tests
  lock the routes that exist, not a shared middleware.
- Abuse-resistant forgot-password is **route-level policy** (always 200 after
  input validation), not a property of the email helper.
- Token table is Auth.js's `verification_tokens` with no FK to users — delete-
  account must clean tokens by email explicitly.
- Phase 1 mocking policy still holds: mock runtime seams (`auth`, `db`, now
  also `email` / cloudflare context), not internal helpers like
  `consumePasswordResetToken` — those should run for real against in-memory
  sqlite so single-use is proven at the DB layer.

## Historical Context (from prior changes)

- `context/changes/gdpr-account-deletion/plan.md` — hardened delete; real reset
  backend; explicitly deferred rate limiting; "must not enumerate."
- `context/changes/gdpr-account-deletion/reviews/impl-review.md`:
  - **F1** (critical, FIXED): send failure → 500 only for registered emails —
    enumeration oracle. Fixed by try/catch + always `{ ok: true }`.
  - **F2** (warning, FIXED): wrap new routes in try/catch → 500 pattern.
  - **F3** (warning, FIXED): reset reported success when user row gone —
    now generic 400 via `.returning()`.
  - **F4** (observation, SKIPPED): no rate limiting — accepted per plan.
  - **F5** (observation, accepted): stale JWT after delete.
- `context/changes/testing-trip-api-contract-ownership/research.md` —
  established harness pattern and Risk #5 dual-mechanism finding reused here.
- `context/foundation/test-plan.md` §7 — rate-limit / flood abuse deliberately
  not tested until a limiter ships.

## Related Research

- `context/changes/testing-trip-api-contract-ownership/research.md` — Phase 1
  (Risks #1, #5 API, #6; harness design).
- `context/changes/gdpr-account-deletion/reviews/impl-review.md` — F1–F5 source
  for Risk #4.

## Open Questions

1. **Backport to test-plan §2?** Minor guidance refinements — (a) forged/expired/
   reused share one 400; (b) Phase 2 Risk #5 residual is delete-account 401
   (trip APIs already Phase 1); (c) live #4 surface is `src/app/api/auth/` not
   `src/app/login`. See post-research ask below.
2. **Scrypt cost in tests:** use real `hashPassword` (slower but honest) vs a
   precomputed fixture hash — plan should pick one and stick to it.
3. **Itinerary 401:** recommend Phase 3 (keeps Phase 2 auth-focused); not a
   Phase 2 blocker.
4. **Unit tests for `auth-tokens.ts`:** optional cheap layer alongside routes;
   not required if consume/reuse is proven via reset-password integration.
