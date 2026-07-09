# S-01: Auth Shell — Plan Brief

> Full plan: `context/changes/s-01/plan.md`

## What & Why

Complete the TripSprint AI auth shell so that users can land on the public landing page, sign up, sign in, sign out, and be redirected to sign-in when accessing any protected page without a session. Most of the auth infrastructure is already wired; this plan closes three specific gaps that currently prevent S-01 from being signed off.

## Starting Point

Auth.js v5 with Credentials provider, D1 adapter, JWT sessions, scrypt hashing, and a combined sign-in/register form at `/login` are all present and functional. The route guard in `proxy.ts` only protects `/trips`, the landing page has no "Sign up" CTA, and there is no sign-out button anywhere in the UI.

## Desired End State

A user can: land on `/` and see "Sign in" and "Sign up" CTAs; click "Sign up" and arrive on the register tab; register and be auto-signed-in to `/trips`; sign out from any protected page and land back at `/`; and be redirected to `/login` (with `callbackUrl`) whenever they try to reach a protected route without a session — verified under the Cloudflare edge runtime (`npm run preview:cf`).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Route protection scope | Negative-match matcher — protect everything except explicit public list | Scales to S-02–S-05 without touching `proxy.ts` again | Plan |
| Public route classification | `isPublic` check inside guard body, not in matcher | Keeps matcher simple; `_next/static`, `_next/image`, `favicon.ico` excluded from matcher | Plan |
| Landing page sign-up CTA | "Sign up" deep-links to `/login?mode=register` | Each CTA lands the user on the correct tab; +5 lines in LoginForm | Plan |
| Sign-out mechanism | Server Action calling `signOut({ redirectTo: "/" })` | Auth.js v5 recommended pattern; no client bundle overhead; works on Cloudflare edge | Plan |
| SiteHeader design | Self-contained Server Component that calls `auth()` itself | Future slices can drop in `<SiteHeader />` without threading session props | Plan |

## Scope

**In scope:**
- `proxy.ts` — broad negative-match route guard
- `src/app/page.tsx` — "Sign up" CTA replacing "Your trips"
- `src/app/login/login-form.tsx` — read `?mode` query param to pre-select tab
- `src/components/site-header.tsx` — new Server Component with sign-out Server Action
- `src/app/trips/page.tsx` — adopt `<SiteHeader />`

**Out of scope:**
- Password reset
- Email verification
- Social / OAuth sign-in
- Dedicated `/signup` route
- Navigation beyond the auth shell (trips list, trip detail — those are S-02)

## Architecture / Approach

Three additive phases on top of the existing auth stack. No new API routes, no schema changes, no migrations. Phase 1 is pure infrastructure (proxy matcher); Phases 2 and 3 are UI additions. All changes are independent — each phase can be reviewed in isolation. The shared `<SiteHeader>` is the only net-new component; it is a Server Component so it owns its own auth call and sign-out action without client JS.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Route protection | Broad negative-match guard covers all current and future protected routes | Matcher regex must not block `_next/static`, `_next/image`, or `/api/auth/**` |
| 2. Landing + login form | FR-013-compliant landing page; "Sign up" deep-link pre-selects register tab | `useSearchParams` must stay inside the `<Suspense>` boundary already present in `login/page.tsx` |
| 3. SiteHeader + sign-out | Sign-out is available on all protected pages; trips page adopts the shared header | Server Action calling `signOut()` must not be wrapped in a try/catch that swallows Next.js redirect throws |
| 4. Cloudflare verification | All flows verified under `npm run preview:cf` — S-01 acceptance gate | `scrypt` CPU cost under Cloudflare Workers paid-CPU limit; `getCloudflareContext()` must be called in a request context |

**Prerequisites:** None — auth stack is already present.
**Estimated effort:** ~1 session across 4 phases (Phases 1–3 are small focused edits; Phase 4 is manual smoke testing).

## Open Risks & Assumptions

- Auth.js v5 `signOut()` called from a Server Action may behave differently under the Cloudflare edge runtime — verified in Phase 4 before S-01 is closed.
- The scrypt parameters in `src/lib/password.ts` (`N = 2^16`) were noted in the comment as tuned for "Workers paid CPU" — if the free-tier CPU budget is hit, registration will time out under `preview:cf`.

## Success Criteria (Summary)

- All five user flows (land, sign-up, sign-in, sign-out, unauthenticated redirect) complete without error under `npm run preview:cf`
- No TypeScript or lint errors introduced
- FR-001, FR-002, FR-003, FR-013, FR-014 satisfied and verifiable manually
