<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-01 Auth Shell

- **Plan**: context/changes/s-01/plan.md
- **Scope**: Phases 1–3 of 4 (Phase 4 = `preview:cf` runtime gate, pending)
- **Date**: 2026-06-11
- **Verdict**: NEEDS ATTENTION (all findings resolved during triage)
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL (resolved — F1 fixed) |
| Scope Discipline | WARNING (resolved — F2 documented) |
| Safety & Quality | PASS |
| Architecture | WARNING (resolved — F3 fixed) |
| Pattern Consistency | PASS |
| Success Criteria | PASS (automated all green; F4 traceability fixed) |

## Findings

### F1 — Phase 3 SiteHeader component never created; sign-out inlined instead

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/app/trips/page.tsx:25-45 (+ missing src/components/site-header.tsx)
- **Detail**: Phase 3 specified a reusable `<SiteHeader>` Server Component plus a trips-page refactor (remove auth() call, "Signed in as", "← Home"). Instead sign-out was inlined and those elements kept. Functional, but the header meant for reuse across S-02–S-05 was absent.
- **Fix A ⭐**: Build SiteHeader as planned and refactor trips page to use it.
- **Fix B**: Keep inline sign-out; update plan to drop SiteHeader (YAGNI, defer to S-02).
- **Decision**: FIXED via Fix A — created src/components/site-header.tsx (async Server Component, auth() + inline `"use server"` handleSignOut → signOut({redirectTo:"/"})); trips page refactored to render `<SiteHeader />` and drop the old session block / "← Home" / inline form. Verified at runtime: authenticated GET /trips returns 200 with title, email, and "Sign out"; old "Signed in as" and "← Home" no longer present.

### F2 — Route protection uses an unplanned auth-edge.ts split config

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline / Architecture
- **Location**: src/lib/auth-edge.ts (new), src/proxy.ts:1-5
- **Detail**: Plan prescribed an inline guard body in proxy.ts importing `@/lib/auth`. Implementation created a lightweight JWT-only `auth-edge.ts` whose `authorized` callback owns the guard, with proxy.ts a one-line re-export. This is the canonical Auth.js v5 edge-split pattern and is the correct choice (full auth.ts needs D1 + getCloudflareContext, which can't run in the edge proxy) — but it contradicted the plan with no recorded decision.
- **Fix**: Document the split-config decision as a plan addendum.
- **Decision**: FIXED — added "Implementation Addenda → A1" to plan.md explaining the deviation and rationale; flagged to confirm under preview:cf.

### F3 — Dead, duplicated `authorized` callback in auth.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/auth.ts:56-63
- **Detail**: auth.ts carried an `authorized` callback identical to auth-edge.ts's, but `authorized` only runs in the proxy path (which uses auth-edge), so the copy never executed and was a second source of truth for the public-route list.
- **Fix**: Delete the unused `authorized` callback from auth.ts.
- **Decision**: FIXED — removed the callback from auth.ts and left a comment pointing to auth-edge.ts as the single owner of the route guard. tsc/lint/build re-run green.

### F4 — Progress markers stale; no s-01 commit traceability

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria (process)
- **Location**: context/changes/s-01/plan.md:247-274
- **Detail**: Phases 2 & 3 were implemented but their Progress checkboxes stayed unchecked with no commit sha; no s-01-scoped commit exists (work folded into e35799b).
- **Fix**: Check off completed Phase 1–3 items.
- **Decision**: FIXED — checked all automated items (re-verified post-edit) plus HTTP-verified manual flows (1.3–1.5, 2.3, 3.4); added a verification-status note to the Progress header. Client-only tab behaviour, sign-out redirect/back-button, and all of Phase 4 left unchecked (preview:cf blocked locally — wrangler needs Node 22, env has v20) and committing remain.
