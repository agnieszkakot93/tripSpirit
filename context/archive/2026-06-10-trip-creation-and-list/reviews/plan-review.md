<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Trip creation and saved trips list (S-02)

- **Plan**: `context/changes/trip-creation-and-list/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-11
- **Verdict**: REVISE
- **Findings**: 0 critical · 2 warnings · 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

New file paths (7) — all correctly absent ✓  
`src/app/trips/page.tsx`, `src/db/schema.ts`, `src/lib/auth.ts`, `register/route.ts`, `delete-account/route.ts` — all exist ✓  
`trips` table in `drizzle/0000` migration — confirmed ✓  
`session.user.id` via `token.sub` — confirmed ✓  
`getCloudflareContext`, `getDb`, `auth` symbols — confirmed ✓  
brief↔plan phases — match ✓  
Progress section — well-formed ✓

## Findings

### F1 — Unauthenticated API requests may return 302, not 401

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Success Criteria 1.4 / Critical Implementation Details
- **Detail**: The middleware (`src/middleware.ts`) exports `auth` from `src/lib/auth-edge.ts` with a matcher that includes `/api/trips`. When the `authorized` callback returns `false`, NextAuth middleware redirects to `/login` (302) — the Route Handler code never runs. Success criterion 1.4 says "returns 401 with JSON error body", but an unauthenticated curl/fetch to `GET /api/trips` will get a 302 redirect instead. The security is correct (access is always denied), and cross-user ownership checks (criterion 1.6) are unaffected because those requests are authenticated — only the expected status code for 1.4 is wrong.
- **Fix A ⭐ Recommended**: Correct the success criterion wording. Update 1.4 to: "Unauthenticated `GET /api/trips` returns 302 redirect (middleware) OR 401 JSON (if tested with a JWT-bearing client that bypasses middleware)." The Route Handler auth check still provides defense-in-depth for authenticated-but-wrong-user cases.
  - Strength: Zero code change; aligns expectation with actual architecture.
  - Tradeoff: Leaves the Route Handler's own 401 path untested by 1.4 — covered by 1.6 instead.
  - Confidence: HIGH — confirmed by reading `middleware.ts` and `auth-edge.ts` directly.
  - Blind spot: NextAuth v5 may behave differently for API vs nav requests (some builds check Accept header) — worth one manual curl check during Phase 1 verification.
- **Fix B**: Add `/api/trips` to the middleware matcher exclusions, so all auth enforcement is done inside Route Handlers (401 JSON as planned).
  - Strength: Route Handlers fully own their auth responses; 1.4 passes as written.
  - Tradeoff: Removes the double-protection layer; a future route that forgets its in-handler check would be unprotected.
  - Confidence: MEDIUM — works architecturally, but shifts risk.
  - Blind spot: If a future route forgets the in-handler check, nothing catches it at the middleware layer.
- **Decision**: FIXED via Fix A — updated criterion 1.4 in plan.md (Progress section + Phase 1 body) to say "302 redirect from middleware".

---

### F2 — False claim about edge runtime in delete-account route

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis — Key Discoveries
- **Detail**: Plan states: "delete-account route uses `export const runtime = 'edge'` — align new trip routes with the project's edge runtime convention once confirmed in sibling routes." `src/app/api/auth/delete-account/route.ts` has no such export; neither does `register/route.ts`. There is no edge runtime convention to align with. The plan's caveat ("once confirmed") softens this, but a reader primed to find edge runtime may introduce it unnecessarily.
- **Fix**: Remove the edge runtime sentence from Key Discoveries. Replace with: "Sibling routes (`register`, `delete-account`) declare no explicit runtime — new trip routes can follow the same default."
- **Decision**: FIXED — replaced false edge runtime claim in plan.md Key Discoveries.

---

### F3 — router.refresh() after router.push() to a new URL is redundant

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 — Client trip create form
- **Detail**: Plan says "on success `router.push('/trips/${id}')` + `router.refresh()`". `router.refresh()` revalidates RSC data for the current route. After `router.push()` navigates away, the destination page mounts fresh — `refresh()` on the old route is redundant and could cause a flash before navigation completes.
- **Fix**: Remove `router.refresh()` from the post-create success path. Only keep `router.push('/trips/${id}')`.
- **Decision**: FIXED — removed `router.refresh()` from Phase 2 create form intent.
