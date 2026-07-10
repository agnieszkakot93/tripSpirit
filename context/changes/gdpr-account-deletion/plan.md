# GDPR Account Deletion & Password Reset Implementation Plan

## Overview

Harden account deletion to meet GDPR **right to erasure** (Art. 17): require authenticated
session plus password re-authentication, purge all user-owned D1 data (users row cascades to
trips, sessions, accounts), clean orphaned `verification_tokens`, invalidate the JWT via
`signOut()`, and disclose OpenAI subprocessor limits at confirmation time. Replace the
misleading login **"Forgot password?" → delete account** flow with a real email-based
password reset using the existing `verification_tokens` table and Cloudflare Email Sending.

## Current State Analysis

- **Delete API** (`src/app/api/auth/delete-account/route.ts`): unauthenticated `DELETE` by
  email only — anyone who knows an email can delete that account. No password check, no
  session guard.
- **Profile UI** (`src/components/profile-form.tsx`): delete flow confirms email match but
  does not collect password; on success redirects to `/login?mode=register` without
  `signOut()` — JWT may outlive the deleted user row.
- **Login forgot mode** (`src/app/login/login-form.tsx` lines 134–231): labeled "Reset via
  re-register"; calls the same unauthenticated delete endpoint. This was an undocumented
  workaround for missing password reset (explicitly out of scope in S-01).
- **Profile discoverability**: `/profile` exists under `(protected)` but `nav-sidebar.tsx` has
  no link — only "My trips" and "Sign out".
- **Data model** (`src/db/schema.ts`): five tables. `users` → `trips` / `sessions` /
  `accounts` all `ON DELETE CASCADE`. `verification_tokens` has no FK to `users` (Auth.js
  adapter design) — orphaned rows possible after user delete.
- **Auth**: Auth.js v5, Credentials provider, JWT sessions (`session: { strategy: "jwt" }`),
  scrypt password hashing (`src/lib/password.ts`). Trip APIs guard via `auth()` +
  `session.user.id` — delete-account should follow this pattern.
- **Email**: no `send_email` binding in `wrangler.jsonc`; no `EMAIL` in `CloudflareEnv`.
  `verification_tokens` table exists but is unused.
- **Third-party data**: itinerary generation sends destination/duration/budget to OpenAI
  (`src/app/api/trips/[tripId]/itinerary/route.ts`). D1 erasure cannot recall OpenAI-side
  processing — must be disclosed to the user.
- **PRD**: no FR for account deletion or password reset; data-isolation NFR exists. Password
  reset was deferred in S-01.

## Desired End State

A signed-in user navigates to **Profile** (linked from the sidebar), enters their current
password, sees an OpenAI disclosure, confirms deletion, and their account plus all trips are
permanently removed from D1; the session is invalidated and they land on `/login` with a
success message.

A user who forgot their password clicks **"Forgot password?"** on the login page, enters
their email, receives a reset link (or sees a generic success message either way), visits
`/reset-password?token=…`, sets a new password, and can sign in. The old unauthenticated
delete-by-email endpoint returns **401** for all callers.

### Key Discoveries:

- Cascade delete already handles trips/sessions/accounts when the `users` row is removed
  (`drizzle/0000_sleepy_mandrill.sql`).
- `verification_tokens` (`identifier` + `token` PK + `expires`) is the correct Auth.js
  adapter table for password-reset tokens — reuse it rather than adding a migration.
- Trip API pattern in `src/app/api/trips/[tripId]/route.ts` is the auth guard template for
  delete-account.
- `signOut({ callbackUrl: "/login" })` is already used in `nav-sidebar.tsx` — profile delete
  should call the same client-side `signOut` from `next-auth/react` after a successful API
  response.
- Cloudflare Email Sending requires a `send_email` binding and an onboarded sending domain;
  local dev without email should log the reset URL to the worker console as a documented
  fallback.

## What We're NOT Doing

- Data export / portability (Art. 20) — deferred; erasure-only scope
- Privacy policy page (`/privacy`) — deferred; in-app OpenAI disclosure only at delete time
- Email verification on registration
- OAuth / social sign-in
- Soft delete, account deactivation, or grace-period undo
- OpenAI data deletion API integration (no such consumer API exists)
- Audit logging or deletion confirmation emails
- Rate limiting infrastructure (note as follow-up risk; not blocking MVP)

## Implementation Approach

**Delete-first sequencing** (user decision): close the critical security hole before shipping
password reset. Phase 1 hardens deletion end-to-end. Phases 2–3 add password reset backend
and UI. Phase 4 verifies both flows under the real runtime.

Deletion API changes from email-in-body to session-derived user ID + password verification
via `verifyPassword`. Client sends `{ password }` only; server never trusts a client-supplied
email for identity. On delete, also `DELETE FROM verification_tokens WHERE identifier = user.email`.

Password reset uses two new API routes: `POST /api/auth/forgot-password` (public, accepts
email, always returns generic success) and `POST /api/auth/reset-password` (public, accepts
token + newPassword). Tokens are crypto-random, stored in `verification_tokens` with
`identifier = email` and 1-hour expiry. Reset link format:
`${AUTH_URL}/reset-password?token=${token}`.

## Critical Implementation Details

- **JWT invalidation is client-side.** With `session: { strategy: "jwt" }`, deleting the D1
  user row does not invalidate the cookie. `profile-form.tsx` must call `signOut({ redirect:
  false })` before navigating to `/login?deleted=1`.
- **Forgot-password must not enumerate accounts.** `POST /api/auth/forgot-password` returns
  `{ ok: true }` whether or not the email exists; only sends email when a user row matches.
- **Local email fallback.** When `env.EMAIL` binding is absent (typical local dev), log the
  reset URL via `console.info` and still return success — document in `.dev.vars.example` or
  AGENTS.md note so developers can complete the flow manually.

## Phase 1: Secure Account Deletion

### Overview

Close the unauthenticated-delete vulnerability; require session + password; clean
verification_tokens; update profile UI with password field, OpenAI disclosure, and signOut;
add Profile nav link.

### Changes Required:

#### 1. Harden delete-account API

**File**: `src/app/api/auth/delete-account/route.ts`

**Intent**: Restrict deletion to the authenticated user who proves identity with their
current password. Delete by `session.user.id`, not client-supplied email. Purge
verification_tokens for the user's email. Return generic errors that do not leak whether a
password vs session failed beyond 401/403.

**Contract**: `DELETE` with JSON body `{ password: string }`. Unauthenticated → **401**
`{ error }`. Missing/invalid password field → **400**. Wrong password → **403**
`{ error: "Invalid password" }`. Success → **200** `{ ok: true }`. Flow: `auth()` → load
user by `session.user.id` → `verifyPassword(password, user.passwordHash)` → delete
`verification_tokens` where `identifier = user.email` → `db.delete(users).where(eq(users.id,
user.id))`. Remove email-from-body identity entirely.

#### 2. Profile delete UI

**File**: `src/components/profile-form.tsx`

**Intent**: Replace email-confirmation with password confirmation; add OpenAI subprocessor
disclosure in the delete warning; call `signOut` then redirect on success.

**Contract**: Delete form collects `password` (not confirm-email). Warning text includes:
*"Trip data sent to our AI provider during itinerary generation cannot be recalled from their
systems."* On success: `await signOut({ redirect: false })` then
`router.push("/login?deleted=1")` + `router.refresh()`. Import `signOut` from
`next-auth/react`.

#### 3. Login deleted banner

**File**: `src/app/login/login-form.tsx`

**Intent**: Show a success message when redirected after account deletion.

**Contract**: When `searchParams` includes `deleted=1`, render an `alert-success` banner:
*"Your account and all saved trips have been permanently deleted."* Do not remove forgot-mode
yet — Phase 3 replaces it.

#### 4. Profile nav link

**File**: `src/components/layout/nav-sidebar.tsx`

**Intent**: Make `/profile` discoverable from the sidebar.

**Contract**: Add a `Link` to `/profile` in the nav grid (between "My trips" and "Sign out"),
with active-state styling when `pathname === "/profile"` or `pathname.startsWith("/profile/")`.
Reuse existing icon/link patterns.

#### 5. Remove unauthenticated delete callers (partial)

**File**: `src/app/login/login-form.tsx`

**Intent**: Disable the forgot-mode delete form in Phase 1 so the public vulnerability has no
UI entry point until real reset ships in Phase 3. Keep the "Forgot password?" button visible
but show a placeholder: *"Password reset coming soon"* OR temporarily hide the button.

**Contract**: Remove `handleDeleteAccount` and the forgot-mode delete form that POSTs to
`/api/auth/delete-account`. Replace forgot-mode body with a minimal placeholder message until
Phase 3 wires real reset. The hardened API already rejects unauthenticated calls.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Unauthenticated `DELETE /api/auth/delete-account` returns **401**
- Authenticated delete with wrong password returns **403**; account and trips remain
- Authenticated delete with correct password removes user + all trips from D1
- After profile delete, user cannot access `/trips` (session cleared)
- `/login?deleted=1` shows success banner
- Profile link appears in sidebar and navigates to `/profile`
- OpenAI disclosure visible in delete confirmation UI

**Implementation Note**: Pause for manual confirmation after Phase 1 before Phase 2.

---

## Phase 2: Password Reset Backend

### Overview

Add Cloudflare Email Sending binding, env types, token generation, and request/confirm API
routes.

### Changes Required:

#### 1. Email binding and env types

**File**: `wrangler.jsonc`, `wrangler.dev.jsonc` (if present), `cloudflare-env.d.ts`

**Intent**: Wire Cloudflare Email Sending so the worker can send reset emails in production.

**Contract**: Add `"send_email": [{ "name": "EMAIL" }]` to wrangler config(s). Extend
`CloudflareEnv` with `EMAIL: SendEmail` (regenerate types if needed). Add optional
`EMAIL_FROM` plain var (e.g. `"noreply@yourdomain.com"`) — document that the domain must be
onboarded via `npx wrangler email sending enable <domain>`.

#### 2. Email send helper

**File**: `src/lib/email.ts` (new)

**Intent**: Centralize transactional email sending with a dev fallback when the binding is
absent.

**Contract**: `sendPasswordResetEmail(env, { to, resetUrl })` — if `env.EMAIL` exists, call
`env.EMAIL.send({ to, from: env.EMAIL_FROM, subject, html, text })` with both html and text
bodies. If binding absent, `console.info("[dev] password reset URL:", resetUrl)` and return
without throwing. Never log the URL in production.

#### 3. Token helpers

**File**: `src/lib/auth-tokens.ts` (new)

**Intent**: Create, validate, and consume password-reset tokens in `verification_tokens`.

**Contract**: `createPasswordResetToken(db, email)` — generate `crypto.randomUUID()` token,
insert into `verification_tokens` with `identifier = email`, `expires = now + 1h`; delete
any prior tokens for same `identifier` first. `consumePasswordResetToken(db, token)` —
select where `token` matches and `expires > now`, return `identifier` (email) or null; delete
token on successful consume (single-use).

#### 4. Forgot-password API

**File**: `src/app/api/auth/forgot-password/route.ts` (new)

**Intent**: Accept an email, create a reset token if user exists, send email, always return
generic success.

**Contract**: `POST { email: string }`. Validate email format → **400** on invalid. Look up
user by email; if found, create token and send email. Always return **200** `{ ok: true }`
(regardless of whether email exists). No auth required.

#### 5. Reset-password API

**File**: `src/app/api/auth/reset-password/route.ts` (new)

**Intent**: Validate token, set new password hash, delete token.

**Contract**: `POST { token: string, password: string }`. Password min 8 chars → **400** if
invalid. `consumePasswordResetToken` → **400** `{ error: "Invalid or expired reset link" }`
on miss. Update `users.passwordHash` via `hashPassword` for the email from token. Return **200**
`{ ok: true }`. No auth required.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- `POST /api/auth/forgot-password` with a registered email creates a `verification_tokens`
  row and logs/sends reset URL
- `POST /api/auth/forgot-password` with unknown email returns **200** (no enumeration)
- `POST /api/auth/reset-password` with valid token updates password; user can sign in with new
  password
- Expired or reused token returns **400**
- Token is deleted after successful reset

**Implementation Note**: Pause for manual confirmation after Phase 2 before Phase 3.

---

## Phase 3: Password Reset UI

### Overview

Replace the login forgot-mode placeholder with a real forgot-password form; add a
`/reset-password` page for setting a new password from the email link.

### Changes Required:

#### 1. Forgot-password form on login

**File**: `src/app/login/login-form.tsx`

**Intent**: Restore "Forgot password?" as a real reset request flow (not account deletion).

**Contract**: `mode === "forgot"` shows email input + submit. `handleForgotPassword` POSTs to
`/api/auth/forgot-password`. On success, show: *"If an account exists for that email, we've
sent a reset link."* Remove all delete-account UI and `handleDeleteAccount` remnants. Update
heading to "Reset your password" and description accordingly.

#### 2. Reset-password page

**File**: `src/app/reset-password/page.tsx` (new), `src/app/reset-password/reset-password-form.tsx` (new, client)

**Intent**: Public page where users land from the email link to set a new password.

**Contract**: Read `token` from `searchParams` (inside `<Suspense>` boundary, matching
`login/page.tsx` pattern). Form: new password + confirm password (client-side match check).
POST to `/api/auth/reset-password` with `{ token, password }`. On success, show success
message + button to `/login`. Missing token → show error state. Page is public (not under
`(protected)`).

#### 3. Public route allowance

**File**: `src/app/(protected)/layout.tsx` (if it guards all non-login routes) or any route
guard config

**Intent**: Ensure `/reset-password` is reachable without authentication.

**Contract**: `/reset-password` must not redirect to `/login`. Verify against current
protection mechanism (`(protected)` group only wraps authenticated pages — new page lives
outside that group, so likely no change needed; confirm during implementation).

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Login → "Forgot password?" → enter email → see generic success message
- Dev console shows reset URL → open `/reset-password?token=…` → set new password → sign in
  with new password works
- Old password no longer works after reset
- No UI path remains that calls `DELETE /api/auth/delete-account` without authentication

**Implementation Note**: Pause for manual confirmation after Phase 3 before Phase 4.

---

## Phase 4: End-to-End Verification

### Overview

Run automated checks and manually verify both GDPR erasure and password reset under the real
dev/preview runtime per AGENTS.md.

### Changes Required:

#### 1. README auth feature list

**File**: `README.md`

**Intent**: Document account deletion and password reset as supported features.

**Contract**: Update the auth bullet to mention profile account deletion and password reset.

### Success Criteria:

#### Automated Verification:

- `npx tsc --noEmit` passes
- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Full erasure flow: register → create trip → profile delete → confirm D1 empty for user
- Full reset flow: register → forgot password → reset → sign in with new password
- `npm run dev` (or `/verify`) — both flows pass at the UI surface
- No regression in trip CRUD or sign-in/sign-out

**Implementation Note**: This phase is verification-only unless README update is needed.

---

## Testing Strategy

### Unit Tests:

- `verifyPassword` / `hashPassword` round-trip (existing patterns in `src/lib/password.ts`)
- `createPasswordResetToken` + `consumePasswordResetToken` — valid, expired, reuse
- Delete-account handler: mock `auth()` returning session; assert 401 without session, 403
  with wrong password (optional — follow `src/lib/trips/queries.test.ts` patterns if added)

### Integration Tests:

- Not required for MVP unless implementer adds API route tests; manual verification is the
  acceptance gate per AGENTS.md

### Manual Testing Steps:

1. Register a new account, create a trip, delete account from profile with password — verify
   trips gone and cannot sign in
2. Register, click forgot password, complete reset via dev console URL, sign in with new
   password
3. Attempt `DELETE /api/auth/delete-account` without session cookie — expect 401
4. Attempt delete with wrong password while signed in — expect 403, data intact
5. Verify OpenAI disclosure text appears before final delete confirmation

## Performance Considerations

- Password verification uses scrypt (`N = 2^16`) — same cost as sign-in; acceptable on paid
  Cloudflare Workers CPU tier (see S-01 notes).
- Forgot-password email send is async; return 200 before email completes if using
  `waitUntil` pattern, or await send (simpler, slightly slower response — either is fine for
  MVP).

## Migration Notes

No schema migration required. `verification_tokens` table already exists. Email binding is
infrastructure-only (wrangler config + production domain onboarding).

## References

- Delete API (current): `src/app/api/auth/delete-account/route.ts`
- Profile UI: `src/components/profile-form.tsx`
- Login form: `src/app/login/login-form.tsx`
- Schema: `src/db/schema.ts`
- Auth pattern: `src/app/api/trips/[tripId]/route.ts`
- S-01 password-reset deferral: `context/changes/s-01/plan-brief.md`
- Cloudflare Email Sending skill: `cloudflare-email-service` skill

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Secure Account Deletion

#### Automated

- [x] 1.1 `npx tsc --noEmit` passes — 30c2bf9
- [x] 1.2 `npm run lint` passes — 30c2bf9
- [x] 1.3 `npm run build` passes — 30c2bf9

#### Manual

- [x] 1.4 Unauthenticated delete returns 401; authenticated delete with password removes user + trips and clears session — 30c2bf9
- [x] 1.5 Profile nav link, OpenAI disclosure, and deleted banner verified — 30c2bf9

### Phase 2: Password Reset Backend

#### Automated

- [x] 2.1 `npx tsc --noEmit` passes — eee1df6
- [x] 2.2 `npm run lint` passes — eee1df6
- [x] 2.3 `npm run build` passes — eee1df6

#### Manual

- [x] 2.4 Forgot-password creates token and sends/logs reset URL; reset-password updates hash; no email enumeration — eee1df6

### Phase 3: Password Reset UI

#### Automated

- [x] 3.1 `npx tsc --noEmit` passes
- [x] 3.2 `npm run lint` passes
- [x] 3.3 `npm run build` passes

#### Manual

- [x] 3.4 Full forgot-password → reset-password → sign-in flow works; no delete-account UI remains on login

### Phase 4: End-to-End Verification

#### Automated

- [ ] 4.1 `npx tsc --noEmit` passes
- [ ] 4.2 `npm run lint` passes
- [ ] 4.3 `npm run build` passes

#### Manual

- [ ] 4.4 Full erasure and reset flows verified via `npm run dev` or `/verify`; README updated
