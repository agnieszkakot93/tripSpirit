# Auth & Account-Lifecycle Route Tests — Implementation Plan

## Overview

Extend the Phase 1 Vitest route harness for password-reset tokens and richer user seeding, then add colocated integration tests for forgot-password, reset-password, and delete-account that prove Risk #4 abuse paths and the residual Risk #5 delete-account 401. Document the email-mock pattern in the test-plan cookbook. This is a regression guard — research confirmed the routes already implement the gdpr F1–F3 fixes.

## Current State Analysis

- Phase 1 shipped `src/test/route-harness.ts` with in-memory `users` + `trips`, `setupRouteTest()`, and trip route tests covering IDOR / 401 / persistence. Auth lifecycle routes have **zero** tests.
- Harness DDL lacks `verification_tokens`; `seedUser` inserts `{ id }` only — insufficient for email/password flows.
- Forgot-password always returns `200 { ok: true }` after input validation (known / unknown / send failure). Reset consume deletes the token row; forged/expired/reused share one 400. Delete-account: session 401 → wrong password 403 → delete.
- Trip CRUD 401 is already covered; page layout redirect is a separate mechanism (Phase 4 e2e). Register and itinerary 401 are out of this change.
- Mocking policy from Phase 1 still holds: mock runtime seams only (`auth`, `db`, now also `email` + Cloudflare context). Do **not** mock `auth-tokens` or `password` — those run for real against sqlite / scrypt.

## Desired End State

- Harness supports auth lifecycle: `verification_tokens` table, `seedUser` with email/passwordHash, helper to seed live/expired reset tokens.
- Colocated `route.test.ts` files beside forgot-password, reset-password, and delete-account lock Risk #4 and delete-account 401 (Risk #5 residual).
- `npm test` is green and includes those suites.
- `context/foundation/test-plan.md` §6 documents the email / Cloudflare mock seams and a Phase 2 note in §6.6.

### Key Discoveries:

- Forgot-password send-failure parity requires `vi.mock("@/lib/email")` to **throw** — console fallback never throws (`research.md`; `email.ts`)
- Known-email path also needs `getAppCloudflareContext` stubbed for `AUTH_URL` (`forgot-password/route.ts:39-41`)
- Forged / expired / reused tokens → identical `400 { error: "Invalid or expired reset link" }` — three setups, one assertion
- Real `hashPassword` for seeds (decision) — accept scrypt cost; do not mock `verifyPassword`
- Wrong-password / failed delete must assert **user row unchanged**; successful delete must assert **user gone** (and tokens cleaned when email present)

## What We're NOT Doing

- Register route tests (intentional; Risk #4 scoped to forgot/reset/delete)
- Page-layout redirect / e2e for Risk #5 (Phase 4)
- Itinerary route 401 tests (Phase 3)
- Re-testing trip CRUD 401 (Phase 1)
- Unit tests for `auth-tokens.ts` / `password.ts` (consume/reuse proven via reset route)
- `accounts` / `sessions` tables in harness DDL
- Rate limiting / concurrent TOCTOU / plaintext token-at-rest / JWT-after-delete (accepted gaps)
- Backporting research refinements into test-plan §2 (defer to `--refresh` unless asked)
- New npm dependencies or production code changes

## Implementation Approach

Extend the shared harness first (so all three route files inherit it), then add forgot + reset tests (Risk #4 token/email surface), then delete-account (Risk #4 auth order + Risk #5 401), then cookbook. Prefer real `createPasswordResetToken` / `consumePasswordResetToken` / `hashPassword` / `verifyPassword` against in-memory sqlite.

Mocking policy (fixed for this rollout):

- Mock: `@/lib/auth` (`auth`), `@/lib/db` (`getDb`), `@/lib/email` (`sendPasswordResetEmail`), `@/lib/cloudflare-context` (`getAppCloudflareContext` → `{ env: { AUTH_URL: "…" } }` or equivalent)
- Do not mock: `@/lib/auth-tokens`, `@/lib/password`, drizzle internals
- Assert: HTTP status + body **and** DB read-back (users / verification_tokens) where a write or non-write matters

## Critical Implementation Details

**`vi.mock` hoisting:** Declare mocks for `auth`, `db`, `email`, and `cloudflare-context` before importing route handlers (same pattern as trip tests). Email mock should be controllable per test (resolve vs throw).

**Scrypt cost:** `hashPassword` uses N=65536 — seed once per `beforeEach` or cache a hash in `beforeAll` for a fixed plaintext (e.g. `"correct-password-1"`). Prefer `beforeAll` cache if suite runtime becomes painful; either is acceptable as long as production hash format is used.

**Token seeding:** For expired/forged cases, insert rows directly (or via a harness helper) rather than only going through forgot-password — keeps cases independent of the email mock.

---

## Phase 1: Harness extensions

### Overview

Make the shared route harness capable of auth lifecycle tests without breaking existing trip tests.

### Changes Required:

#### 1. Extend route harness

**File**: `src/test/route-harness.ts`

**Intent**: Add `verification_tokens` DDL to `makeTestDb()`, enrich `seedUser` to accept optional `email` and `passwordHash`, and add a small helper to insert a reset token with controllable `expires` (live vs expired). Keep trip helpers working unchanged.

**Contract**: `verification_tokens` columns match schema (`identifier`, `token` PK, `expires` timestamp_ms). `seedUser(db, userId, { email?, passwordHash? })` remains backward-compatible when overrides are omitted (existing trip tests keep calling `seedUser(db, "u1")`). Token helper returns the raw token string for use in reset-password requests. No `accounts`/`sessions` tables.

#### 2. Smoke / existing suite sanity

**Files**: `src/test/route-harness.smoke.test.ts` (if present), existing `src/app/api/trips/**/*.test.ts`

**Intent**: Confirm trip tests still pass after DDL/`seedUser` signature changes; optionally assert the new table exists via a one-line smoke if useful.

**Contract**: No behavioral change to trip route assertions.

### Success Criteria:

#### Automated Verification:

- Harness typechecks; `verification_tokens` present in `makeTestDb` DDL
- Existing trip route tests still pass
- `npx tsc --noEmit` passes
- `npm test` passes

#### Manual Verification:

- `seedUser` + token helper API is obvious enough to write a forgot/reset `beforeEach` without re-reading research

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Forgot-password + reset-password route tests

### Overview

Lock Risk #4 email/token abuse paths: response parity and single-use / forge / expire collapse.

### Changes Required:

#### 1. Forgot-password tests

**File**: `src/app/api/auth/forgot-password/route.test.ts`

**Intent**: Prove identical `200 { ok: true }` for (a) known email + email send succeeds, (b) unknown email, (c) known email + `sendPasswordResetEmail` throws. Optionally assert a token row exists only for (a). Invalid JSON / invalid email → 400 (shape only — not existence oracle).

**Contract**: Mock `@/lib/email` and `@/lib/cloudflare-context`. Do not assert different status codes across a/b/c. Do not test register.

#### 2. Reset-password tests

**File**: `src/app/api/auth/reset-password/route.test.ts`

**Intent**: Prove forged token, expired token, and reused token (second POST after successful consume) all return `400` with the public `"Invalid or expired reset link"` message. Prove one successful reset: `200 { ok: true }`, password hash changed (verify with real `verifyPassword` or login-equivalent check against DB), and token row gone. Short-password / missing token → 400 as documented.

**Contract**: Use real `consumePasswordResetToken` path (do not mock auth-tokens). Seed users with real `hashPassword`. Prefer three negative setups sharing one expected status/body assertion style.

### Success Criteria:

#### Automated Verification:

- Forgot-password parity cases (known / unknown / send-fail) all return identical 200 `{ ok: true }`
- Reset forged / expired / reused return 400 with the generic invalid-link error
- Successful reset updates `password_hash` and removes the token row
- `npx vitest run src/app/api/auth` passes
- `npm test` passes
- `npx tsc --noEmit` passes

#### Manual Verification:

- Test names make Risk #4 (enumeration + token replay) obvious without reading research

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Delete-account route tests

### Overview

Lock delete auth order (Risk #4) and residual Risk #5 API 401 on this route.

### Changes Required:

#### 1. Delete-account tests

**File**: `src/app/api/auth/delete-account/route.test.ts`

**Intent**: Prove unauthenticated → `401 { error: "Unauthorized" }` and no DB change. Authenticated + wrong password → `403 { error: "Invalid password" }` and user row unchanged. Authenticated + correct password → `200 { ok: true }`, user row gone, and verification tokens for that email cleaned when present. Missing password → 400.

**Contract**: Mock `@/lib/auth` + `@/lib/db` only (no email mock required). Seed with real `hashPassword`. Assert DB read-back for wrong-password and success paths — status alone is insufficient (mirrors Phase 1 ownership oracle pattern).

### Success Criteria:

#### Automated Verification:

- Unauthenticated delete → 401; wrong password → 403 + row unchanged; correct password → 200 + row gone
- `npx vitest run src/app/api/auth` passes
- `npm test` passes
- `npx tsc --noEmit` passes

#### Manual Verification:

- Test names make delete auth order (401 then 403) and Risk #5 residual obvious

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Cookbook + rollout notes

### Overview

Document what shipped so Phase 3–4 reuse the email-mock / token-seed pattern; keep foundation §1–§2 frozen.

### Changes Required:

#### 1. Update cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Extend §6.2 / §6.3 (or a short auth subsection) with: mock `@/lib/email` + Cloudflare context for forgot-password; seed tokens via harness; always cover known/unknown/send-fail parity and forge/expire/reuse; delete-account 401/403/success with DB read-back. Add §6.6 note for Phase 2. Do not edit Risk Map Source/guidance unless explicitly backporting.

**Contract**: No new file:line anchors in §1–§2. §6 may name concrete paths and reference test files under `src/app/api/auth/`.

#### 2. Change metadata

**File**: `context/changes/testing-auth-account-lifecycle-routes/change.md`

**Intent**: Keep frontmatter status/updated consistent as implement completes.

**Contract**: `status` / `updated` reflect completion when Progress is fully checked.

### Success Criteria:

#### Automated Verification:

- §6 documents auth email-mock / token-seed pattern (no TBD for those seams)
- `npm test` still passes

#### Manual Verification:

- A fresh agent reading only §6 could add another auth-like route test without re-reading research

**Implementation Note**: After completing this phase, follow the downstream continuation rule toward `/10x-implement` completion and then `/10x-test-plan` to mark rollout Phase 2 complete.

---

## Testing Strategy

### Unit Tests:

- None new — token/password behavior covered through route integration (decision).

### Integration Tests:

- Forgot-password: known / unknown / send-fail → identical 200; invalid input → 400
- Reset-password: forge / expire / reuse → 400; success → hash updated + token gone
- Delete-account: 401 / 403+unchanged / 200+gone

### Manual Testing Steps:

1. Run `npm test` and confirm auth suites are included
2. Skim test titles against Risk #4 and Risk #5 residual
3. Confirm §6 describes email mock + token seed + DB read-back for delete

## Performance Considerations

Scrypt seeding adds cost vs Phase 1 trip tests — mitigate with `beforeAll` hash cache if needed. In-memory sqlite per `beforeEach` stays the same class as existing route tests.

## Migration Notes

None. Test-only change; no schema or runtime behavior changes.

## References

- Related research: `context/changes/testing-auth-account-lifecycle-routes/research.md`
- Test plan Phase 2: `context/foundation/test-plan.md` §3
- Prior pattern: `context/changes/testing-trip-api-contract-ownership/plan.md`
- Handlers: `src/app/api/auth/forgot-password/route.ts`, `reset-password/route.ts`, `delete-account/route.ts`
- Tokens / password: `src/lib/auth-tokens.ts`, `src/lib/password.ts`
- Harness: `src/test/route-harness.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Harness extensions

#### Automated

- [x] 1.1 Harness typechecks; `verification_tokens` present in `makeTestDb` DDL — f0b8ba6
- [x] 1.2 Existing trip route tests still pass — f0b8ba6
- [x] 1.3 `npx tsc --noEmit` passes — f0b8ba6
- [x] 1.4 `npm test` passes — f0b8ba6

#### Manual

- [x] 1.5 `seedUser` + token helper API is obvious for auth `beforeEach` without re-reading research — f0b8ba6

### Phase 2: Forgot-password + reset-password route tests

#### Automated

- [x] 2.1 Forgot-password parity cases (known / unknown / send-fail) all return identical 200 `{ ok: true }` — b78c72c
- [x] 2.2 Reset forged / expired / reused return 400 with the generic invalid-link error — b78c72c
- [x] 2.3 Successful reset updates `password_hash` and removes the token row — b78c72c
- [x] 2.4 `npx vitest run src/app/api/auth` passes — b78c72c
- [x] 2.5 `npm test` passes — b78c72c
- [x] 2.6 `npx tsc --noEmit` passes — b78c72c

#### Manual

- [x] 2.7 Test names make Risk #4 (enumeration + token replay) obvious without reading research — b78c72c

### Phase 3: Delete-account route tests

#### Automated

- [x] 3.1 Unauthenticated delete → 401; wrong password → 403 + row unchanged; correct password → 200 + row gone — 607b205
- [x] 3.2 `npx vitest run src/app/api/auth` passes — 607b205
- [x] 3.3 `npm test` passes — 607b205
- [x] 3.4 `npx tsc --noEmit` passes — 607b205

#### Manual

- [x] 3.5 Test names make delete auth order (401 then 403) and Risk #5 residual obvious — 607b205

### Phase 4: Cookbook + rollout notes

#### Automated

- [x] 4.1 §6 documents auth email-mock / token-seed pattern (no TBD for those seams) — 52eec53
- [x] 4.2 `npm test` still passes — 52eec53

#### Manual

- [x] 4.3 Fresh-agent check: §6 alone is enough to add an auth-like route test — 52eec53
