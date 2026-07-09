# S-01: Auth Shell Implementation Plan

## Overview

Complete the auth shell for TripSprint AI so that a user can land on the public landing page, sign up, sign in, sign out, and be automatically redirected to sign-in when accessing any protected page without a session. Most of the auth infrastructure already exists; this plan closes three specific gaps: route protection scope, a missing sign-up CTA on the landing page, and a missing sign-out action.

## Current State Analysis

The auth stack is fully wired: Auth.js v5 with a Credentials provider, Drizzle + Cloudflare D1 adapter, JWT sessions, scrypt password hashing via `@noble/hashes`, and a register API route. The `/login` page is a combined sign-in + register tabbed form with `callbackUrl` support. The `proxy.ts` file (Next.js 16 renamed `middleware.ts` → `proxy.ts`) runs a route guard, but the matcher only covers `/trips` and `/trips/:path*` — not future protected routes.

### Key Discoveries

- `src/proxy.ts:7` — guard checks `isTripsArea` (hard-coded to `/trips` prefix); must be replaced with a public-routes exclusion pattern to satisfy FR-014 and scale to S-02–S-05 without further proxy changes
- `src/app/page.tsx:23-28` — landing page has "Sign in" and "Your trips" links; no "Sign up" CTA; violates FR-013 which requires explicit entry points for both sign-in and sign-up
- No sign-out UI exists anywhere in the codebase; `/trips/page.tsx` displays "Signed in as…" but lacks any sign-out affordance
- Auth.js v5 `signOut()` exported from `src/lib/auth.ts:11` supports `{ redirectTo }` and is callable from a Server Action; with JWT sessions there is no D1 write needed on sign-out — only cookie clearing
- Next.js 16 proxy defaults to the Node.js runtime; `proxy.ts` must NOT set `export const runtime = "edge"` (the docs explicitly state this throws)
- `src/app/login/login-form.tsx:13` — `mode` state defaults to `"signin"` ignoring any query param; must read `?mode` to honour the deep-link from the new "Sign up" CTA

## Desired End State

A user can:
1. Land on `/` and see distinct "Sign in" and "Sign up" CTAs
2. Click "Sign up" → arrive at `/login` with the register tab pre-selected
3. Click "Sign in" → arrive at `/login` with the sign-in tab active
4. Register an account and be signed in automatically, landing on `/trips`
5. Sign in with an existing account, landing on `/trips` (or original `callbackUrl`)
6. Click "Sign out" from any protected page and be redirected to `/`
7. Navigate directly to `/trips` (or any future protected route) without a session → be redirected to `/login?callbackUrl=<original-path>`

### Verification

Run `npm run preview:cf` and manually walk all seven flows above. All four PRD requirements (FR-001, FR-002, FR-003, FR-013, FR-014) pass.

## What We're NOT Doing

- No password reset flow (PRD accepted this as a known MVP cost)
- No email verification
- No OAuth / social sign-in
- No dedicated `/signup` route — sign-up lives as a tab on `/login`
- No navigation beyond the auth shell — the trips page remains a placeholder (that's S-02)
- No `<SiteHeader>` on the landing page or login page — only on authenticated pages

## Implementation Approach

Three phases, each independently deployable:
1. Fix route protection first (infrastructure) — no UI changes, easy to verify
2. Land page + login form (UI, no new API) — verifiable in the browser
3. SiteHeader + sign-out (new component, Server Action) — completes the auth loop

## Critical Implementation Details

- **Proxy runtime**: Next.js 16 proxy runs on the Node.js runtime by default. Do NOT set `export const runtime` in `proxy.ts` — it will throw a build error.
- **Server Action in Server Component**: The `SiteHeader` component defines the `handleSignOut` function with `"use server"` inline. It must be an `async` Server Component (not a Client Component). The function body calls `await signOut({ redirectTo: "/" })` which internally calls Next.js `redirect()` — this throws a special non-error redirect that Next.js catches; do not wrap the call in a try/catch that swallows redirect throws.
- **Proxy matcher scope**: The matcher `/((?!_next/static|_next/image|favicon\\.ico).*)` runs the guard on all routes including `/`, `/login`, and `/api/auth/**`. The guard must check `isPublic` inside the body and allow those through — not in the matcher.

---

## Phase 1: Route protection — broad negative-match

### Overview

Replace the narrow `/trips`-only matcher in `proxy.ts` with a broad negative-match pattern that protects all routes except the explicitly public list. This satisfies FR-014 for the current route set and ensures every future route added in S-02–S-05 is protected by default without touching this file again.

### Changes Required

#### 1. Route guard and matcher

**File**: `src/proxy.ts`

**Intent**: Replace the hard-coded `isTripsArea` check and narrow matcher with a general public-routes exclusion list and a broad negative-match matcher that runs the guard on all navigable routes.

**Contract**: Export a named `proxy` function (Auth.js v5 `auth()` HOC) and a `config.matcher` array. The guard body computes `isPublic` — true when the path is `/`, `/login`, or starts with `/api/auth/`. If `!req.auth && !isPublic`, redirect to `/login?callbackUrl=<path>`. The matcher pattern excludes `_next/static`, `_next/image`, and `favicon.ico` to prevent blocking static asset loads.

```ts
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
```

### Success Criteria

#### Automated Verification

- TypeScript check passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`

#### Manual Verification

- `npm run dev`: navigating to `/trips` without a session redirects to `/login?callbackUrl=%2Ftrips`
- Navigating to `/` without a session shows the landing page (no redirect)
- Navigating to `/login` without a session shows the login form (no redirect)
- Navigating to `/api/auth/providers` without a session returns a JSON response (no redirect)

**Implementation Note**: After completing this phase and automated verification passes, pause here for manual confirmation of the redirect behaviour before proceeding.

---

## Phase 2: Landing page CTA + login form deep-link

### Overview

Add a distinct "Sign up" CTA to the landing page that deep-links to `/login?mode=register`. Update `LoginForm` to read the `?mode` query param on mount and pre-select the register tab when `mode=register` is present.

### Changes Required

#### 1. Landing page CTAs

**File**: `src/app/page.tsx`

**Intent**: Replace the "Your trips" secondary link with a "Sign up" link that points to `/login?mode=register`. The "Sign in" link remains pointing to `/login` (default sign-in tab). This gives unauthenticated visitors two clear, correctly-labelled entry points as required by FR-013.

**Contract**: Two `<Link>` elements side by side. "Sign in" → `href="/login"`. "Sign up" → `href="/login?mode=register"`. Keep the same button styles — the primary pill style on "Sign in", the ghost/outline style on "Sign up".

#### 2. LoginForm — read `?mode` query param

**File**: `src/app/login/login-form.tsx`

**Intent**: Initialise the `mode` state from the `?mode` URL search param so that navigating to `/login?mode=register` lands the user on the register tab immediately.

**Contract**: `useSearchParams()` is already imported and used for `callbackUrl` (`src/app/login/login-form.tsx:11`). Read `searchParams.get("mode")` and use it to set the initial `useState` value: `"register"` if the param equals `"register"`, otherwise `"signin"`.

### Success Criteria

#### Automated Verification

- TypeScript check passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`

#### Manual Verification

- Landing page shows two distinct buttons: "Sign in" and "Sign up"
- Clicking "Sign in" from the landing page opens `/login` with the Sign in tab active
- Clicking "Sign up" from the landing page opens `/login?mode=register` with the Register tab active
- Toggling tabs on the login page still works (state controlled by button clicks as before)

**Implementation Note**: After completing this phase and manual verification passes, proceed to Phase 3.

---

## Phase 3: SiteHeader component + sign-out

### Overview

Create a reusable `<SiteHeader>` Server Component that displays the signed-in user's email and a sign-out button wired to a Server Action. Replace the inline "Signed in as…" + "← Home" link on the trips page with `<SiteHeader />`. The header will be picked up by future slices (S-02 through S-05) without modification.

### Changes Required

#### 1. SiteHeader component

**File**: `src/components/site-header.tsx`

**Intent**: A self-contained Server Component that fetches its own session via `auth()`, displays the user's email (or name/id fallback), and exposes a sign-out form with a Server Action. Calling `auth()` here instead of threading session as a prop keeps future pages simple — any protected page can render `<SiteHeader />` without additional setup.

**Contract**: Async Server Component. Calls `auth()` from `@/lib/auth`. Defines an inline `async function handleSignOut()` with `"use server"` that calls `await signOut({ redirectTo: "/" })`. Renders: a site title link to `/`, the user identifier, and a `<form action={handleSignOut}><button type="submit">Sign out</button></form>`. Styled consistently with the existing zinc design system (see `src/app/trips/page.tsx` for the font/colour tokens in use).

#### 2. Trips page — use SiteHeader

**File**: `src/app/trips/page.tsx`

**Intent**: Replace the hand-rolled "Signed in as" paragraph and "← Home" link with `<SiteHeader />` so the auth shell visual pattern is consistent and the inline `auth()` call becomes redundant (moved into SiteHeader).

**Contract**: Remove the `auth()` call and the `session` variable from the page. Remove the `<div>` block with "Your trips" heading + "Signed in as" paragraph. Remove the "← Home" `<Link>`. Replace with `<SiteHeader />` at the top of `<main>`. The "Your trips" heading and placeholder paragraph remain below the header.

### Success Criteria

#### Automated Verification

- TypeScript check passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification

- Signed-in user visiting `/trips` sees their email and a "Sign out" button in the header
- Clicking "Sign out" clears the session and redirects to `/`
- After sign-out, navigating back to `/trips` redirects to `/login?callbackUrl=%2Ftrips`
- Browser back button after sign-out does not restore the session (JWT cookie cleared)

**Implementation Note**: After completing this phase and manual verification passes, proceed to Phase 4.

---

## Phase 4: Cloudflare verification

### Overview

Run the full application under `npm run preview:cf` (OpenNext Cloudflare local emulation) and walk all auth flows end-to-end. The Cloudflare edge runtime enforces constraints (no Node.js built-ins, `getCloudflareContext()` must be called in a Worker request context, CPU limits for scrypt) that `npm run dev` does not — this phase is the acceptance gate before S-01 is marked done.

### Changes Required

No code changes in this phase. If a flow breaks under `preview:cf`, root-cause and fix before closing S-01.

### Success Criteria

#### Manual Verification

- `npm run build:cf && npm run preview:cf` builds and starts without errors
- Visit `/` → landing page renders with "Sign in" and "Sign up" CTAs
- Click "Sign up" → register form active; create a new account → auto-signed-in → lands on `/trips` with SiteHeader showing email
- Sign out → redirected to `/`; navigate to `/trips` → redirected to `/login`
- Sign in with the account just created → lands on `/trips`
- Directly navigate to `/trips` without session → redirected to `/login?callbackUrl=%2Ftrips`; sign in → redirected to `/trips`

**Implementation Note**: This phase gates S-01 completion. Do not open S-02 until all flows above pass under `preview:cf`.

---

## Testing Strategy

### Manual Testing Steps

1. Run `npm run dev` and verify Phase 1–3 flows (fast iteration)
2. Run `npm run build:cf && npm run preview:cf` and re-verify all flows under the Cloudflare runtime
3. Verify browser back-button behaviour after sign-out (session must not be restored)
4. Test a direct deep-link to a protected route while unauthenticated, verify `callbackUrl` round-trip

## Migration Notes

No schema changes. No new API routes. No D1 migrations required.

## References

- PRD: `context/foundation/prd.md` (FR-001, FR-002, FR-003, FR-013, FR-014, US-03)
- Roadmap slice: `context/foundation/roadmap.md` (S-01)
- Next.js 16 proxy convention: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`

---

## Implementation Addenda

> Decisions taken during implementation that deviate from the plan above. Recorded so future reviews treat the plan as ground truth.

> **Superseded:** A1 below was the first implementation. It was replaced by A2 after Phase 4 verification revealed a hard OpenNext/Cloudflare incompatibility. A2 is the final approach; `proxy.ts` and `auth-edge.ts` have been removed.

### A1 — (SUPERSEDED by A2) Route guard implemented as an Auth.js v5 split config (`src/lib/auth-edge.ts`)

**Plan said** (Phase 1 + Critical Implementation Details): `proxy.ts` imports the `auth()` HOC from `@/lib/auth`, computes `isPublic` in the guard body, and redirects to `/login?callbackUrl=<path>` on the Node runtime.

**What was built**: a new lightweight, JWT-only NextAuth config in `src/lib/auth-edge.ts` (no D1 adapter, no `getCloudflareContext`, no Node-only imports). Its `authorized` callback owns the `isPublic` check and the route-guard return; `proxy.ts` is a one-line re-export `export { auth as proxy } from "@/lib/auth-edge"`. Returning `false` from `authorized` triggers Auth.js's built-in redirect to the `signIn` page with `callbackUrl` appended, satisfying FR-014.

**Why**: the full `@/lib/auth` config calls `getCloudflareContext({ async: true })` and instantiates `D1Adapter` at config time. Under OpenNext/Cloudflare the proxy runs on the workerd edge runtime, where those Node/Worker-context dependencies cannot be evaluated at middleware import time. The split config (a slim edge config for the proxy + the full config for route handlers/Server Actions) is the canonical Auth.js v5 pattern for exactly this constraint. Confirm under `preview:cf` (Phase 4) that the proxy bundle pulls no Node-only deps.

### A2 — Route protection moved from proxy/middleware to a `(protected)` route-group layout guard

**Discovered at the Phase 4 gate**: `npm run build:cf` fails with `ERROR Node.js middleware is not currently supported. Consider switching to Edge Middleware.` and exits 1 (no `.open-next/worker.js` emitted). Root cause: Next.js 16 emits `proxy.ts` as a **Node.js** middleware (`functions-config-manifest.json` → `/_middleware` `runtime: "nodejs"`), and `@opennextjs/cloudflare@1.19.11` (latest) rejects Node middleware (`build.js` → `useNodeMiddleware()` → `process.exit(1)`). There is no escape hatch — Next 16 throws if you set `runtime` in `proxy.ts`, so it can't be made Edge. This affects *any* middleware-based guard, not just S-01's.

**Resolution** (decided with the user during impl-review triage):

- Deleted `src/proxy.ts` and `src/lib/auth-edge.ts` (A1's split config is no longer needed without a proxy).
- Added `src/app/(protected)/layout.tsx` — an async Server Component that calls `auth()` and `redirect()`s to `/login` when there is no session. Moved `src/app/trips/` → `src/app/(protected)/trips/` (route groups don't change the URL, so `/trips` is unchanged).
- **API routes** (`/api/trips`, `/api/trips/[tripId]`) are unaffected — they already self-guard with `auth()` → 401 in their handlers, which is the correct pattern (layouts don't wrap API routes).
- **`callbackUrl` preservation**: there is no official RSC pathname API. Under the Cloudflare runtime OpenNext exposes the full request URL via the `x-opennext-initial-url` header; the layout parses it to build `/login?callbackUrl=<path>` (with `next-url` as a `next dev` fallback). Verified under `preview:cf`: unauth `/trips` → 307 → `/login?callbackUrl=%2Ftrips`.

**Trade-off vs. the proxy**: protection is no longer automatic for every route — a new protected page must live under `(protected)/` (or call `auth()` itself). This is the cost of dropping middleware and is the OpenNext-recommended pattern. `build:cf`, `preview:cf`, and all auth flows now pass.

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.
>
> Verification status (2026-06-12, impl-review): all automated checks (`tsc`, `lint`, `build`, `build:cf`) pass. Phase 4 ran successfully under `preview:cf` (Node 22 via nvm) after route protection was moved from the proxy to a `(protected)` layout guard — see Addendum A2. Flows marked `[x]` were confirmed via HTTP against the Cloudflare `preview:cf` runtime, including the sign-out Server Action (303 → `/`) and the `callbackUrl` round-trip (`/trips` → `/login?callbackUrl=%2Ftrips`). Items still `[ ]` are browser-only checks: client-side tab pre-selection/toggle (2.4–2.6) and the back-button-after-sign-out (3.7). Review fixes committed as `d0174b0`; layout-guard change committed separately on branch `s-01-review-fixes`.

### Phase 1: Route protection — broad negative-match

#### Automated

- [x] 1.1 TypeScript check passes: `npx tsc --noEmit`
- [x] 1.2 Lint passes: `npm run lint`

#### Manual

- [x] 1.3 `/trips` without session → redirects to `/login?callbackUrl=%2Ftrips`
- [x] 1.4 `/` without session → landing page (no redirect)
- [x] 1.5 `/login` without session → login form (no redirect)

### Phase 2: Landing page CTA + login form deep-link

#### Automated

- [x] 2.1 TypeScript check passes: `npx tsc --noEmit`
- [x] 2.2 Lint passes: `npm run lint`

#### Manual

- [x] 2.3 Landing page shows "Sign in" and "Sign up" as distinct CTAs
- [ ] 2.4 "Sign in" CTA → `/login` with sign-in tab active
- [ ] 2.5 "Sign up" CTA → `/login?mode=register` with register tab pre-selected
- [ ] 2.6 Tab toggle still works after deep-link

### Phase 3: SiteHeader component + sign-out

#### Automated

- [x] 3.1 TypeScript check passes: `npx tsc --noEmit`
- [x] 3.2 Lint passes: `npm run lint`
- [x] 3.3 Production build passes: `npm run build`

#### Manual

- [x] 3.4 Signed-in user on `/trips` sees email + "Sign out" in header
- [x] 3.5 Sign-out redirects to `/` and clears session
- [x] 3.6 Post-sign-out navigation to `/trips` redirects to `/login`
- [ ] 3.7 Back button after sign-out does not restore session

### Phase 4: Cloudflare verification

#### Manual

- [x] 4.1 `npm run build:cf && npm run preview:cf` starts without errors
- [x] 4.2 Landing page renders under Cloudflare runtime
- [x] 4.3 Full sign-up flow (register → auto-sign-in → trips page) works under `preview:cf`
- [x] 4.4 Sign-out works under `preview:cf`
- [x] 4.5 Sign-in flow works under `preview:cf`
- [x] 4.6 Unauthenticated direct-navigate → redirect → sign-in → callbackUrl redirect works under `preview:cf`
