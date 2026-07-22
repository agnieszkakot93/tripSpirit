# GDPR Account Deletion & Password Reset — Plan Brief

> Full plan: `context/changes/gdpr-account-deletion/plan.md`

## What & Why

Implement GDPR **right to erasure** for user accounts: a signed-in user can permanently delete
their account and all associated trip data, with proper authentication and session
invalidation. Replace the dangerous unauthenticated delete-by-email API and the misleading
"Forgot password? → delete account" workaround with a real password-reset flow.

## Starting Point

Account deletion exists but is critically insecure — `DELETE /api/auth/delete-account` accepts
only an email with no auth or password check. Profile UI at `/profile` is undiscoverable (no
nav link). DB cascade deletes trips when the user row is removed, but JWT sessions survive
deletion and `verification_tokens` are not cleaned up. Password reset was explicitly deferred
in S-01; the login page fakes it by deleting the account.

## Desired End State

Users find **Profile** in the sidebar, confirm deletion with their password (seeing an OpenAI
data disclosure), and are signed out with all D1 data purged. Users who forgot their password
request a reset link via email (or dev console in local), set a new password at
`/reset-password`, and sign in — without losing their trips.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| GDPR scope | Right to erasure only | Focused, shippable — matches existing partial delete implementation | Plan |
| Delete authentication | Session + password re-auth | Closes critical unauthenticated-delete hole; matches trip API auth pattern | Plan |
| Public delete endpoint | Remove entirely (401 without session) | Email-only delete is not GDPR-appropriate security | Plan |
| Forgot password UX | Full password reset in this change | User needs self-service recovery without deleting data | Plan |
| Post-delete session | `signOut()` then redirect to login | JWT strategy requires client-side invalidation | Plan |
| Profile discoverability | Add sidebar nav link | Erasure must be easily exercisable | Plan |
| OpenAI subprocessor | In-app disclosure at delete confirmation | Honest transparency without full privacy policy page | Plan |
| Implementation order | Secure deletion first, then reset | Close security hole before adding new features | Plan |

## Scope

**In scope:**
- Hardened `DELETE /api/auth/delete-account` (session + password)
- Profile UI: password confirm, OpenAI disclosure, signOut
- Sidebar Profile link
- `verification_tokens` cleanup on delete
- Password reset APIs (`forgot-password`, `reset-password`)
- Cloudflare Email Sending binding + dev console fallback
- Login forgot-password form + `/reset-password` page
- Remove all unauthenticated delete UI

**Out of scope:**
- Data export (portability)
- Privacy policy page
- Email verification on registration
- Deletion confirmation email
- Rate limiting
- OpenAI data recall

## Architecture / Approach

Two feature tracks sequenced delete-first. **Deletion**: API guards with `auth()` + `verifyPassword`, deletes user by `session.user.id` (cascade handles trips), cleans `verification_tokens`, client calls `signOut`. **Reset**: `POST /api/auth/forgot-password` creates a token in existing `verification_tokens` table and sends email via Cloudflare `EMAIL` binding; `POST /api/auth/reset-password` consumes token and updates `password_hash`. No schema migration needed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Secure deletion | Auth-gated delete API, profile UI, nav link, signOut | JWT invalidation is client-side only |
| 2. Reset backend | Email binding, token helpers, forgot/reset APIs | Email domain must be onboarded for production sends |
| 3. Reset UI | Login forgot form, `/reset-password` page | Public route must not be caught by protected layout |
| 4. Verification | E2E manual checks, README update | scrypt CPU under Cloudflare free tier |

**Prerequisites:** D1 migrations applied; `AUTH_SECRET` configured; production email domain onboarded for reset emails.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Cloudflare Email Sending requires a verified sending domain — local dev relies on console-logged reset URLs.
- OpenAI-processed trip data cannot be erased from OpenAI's systems; disclosure at delete time is the mitigation.
- No rate limiting on forgot-password — acceptable for MVP but should be added before public launch at scale.
- Expanded scope (password reset) increases total effort beyond a pure erasure change.

## Success Criteria (Summary)

- Authenticated user can delete account + all trips from Profile with password confirmation; session invalidated
- No unauthenticated path can delete an account
- User can reset password via email link without deleting data or trips
- Automated checks (`tsc`, `lint`, `build`) pass; flows verified in running app
