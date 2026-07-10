<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: GDPR Account Deletion & Password Reset

- **Plan**: context/changes/gdpr-account-deletion/plan.md
- **Scope**: All 4 phases (complete)
- **Date**: 2026-07-10
- **Verdict**: REJECTED → resolved (F1/F2/F3 fixed post-review)
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL → resolved |
| Architecture | PASS |
| Pattern Consistency | WARNING → resolved |
| Success Criteria | PASS |

## Findings

### F1 — forgot-password enumeration oracle via email-send failure

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/api/auth/forgot-password/route.ts:34-39
- **Detail**: Token creation + `await sendPasswordResetEmail` ran only inside `if (user)` with no try/catch. In production a send failure throws → 500 only for registered emails, while unknown emails return 200 — an account-enumeration side channel (plus a latency channel). Masked in local dev by the console fallback.
- **Fix**: Wrap token+email work in try/catch; always return `{ ok: true }`; log failures server-side.
- **Decision**: FIXED — wrapped in try/catch, always 200, `console.error` on failure.

### F2 — New auth routes omit the try/catch → 500 pattern used repo-wide

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: delete-account, forgot-password, reset-password routes
- **Detail**: Reference route src/app/api/trips/[tripId]/route.ts wraps DB calls in try/catch returning `{ error: "Internal error" }` 500. The three new routes did not, risking inconsistent error shape / internals leakage on a throw.
- **Fix**: Mirror the trip-route try/catch pattern in all three routes.
- **Decision**: FIXED — delete-account and reset-password wrapped with 500 fallback; forgot-password covered by F1's swallow-and-200.

### F3 — reset-password reports success even if the user no longer exists

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/api/auth/reset-password/route.ts:35-38
- **Detail**: `update(users).set(...).where(eq(users.email, email))` affects 0 rows silently if the account was deleted between token issue and consume, yet still returned `{ ok: true }`.
- **Fix**: Use `.returning({ id })` and return 400 "Invalid or expired reset link" when 0 rows updated.
- **Decision**: FIXED — added `.returning()` + 0-rows guard (verified D1 supports RETURNING at runtime).

### F4 — No rate-limiting on forgot-password / reset-password

- **Severity**: ◽ OBSERVATION
- **Impact**: 🏃 LOW — quick decision
- **Dimension**: Scope Discipline
- **Location**: forgot-password, reset-password routes
- **Detail**: forgot-password is an unauthenticated email-send trigger (abuse amplifier); reset-password accepts unlimited token guesses (122-bit UUIDv4 makes brute force impractical). The plan explicitly defers rate-limiting under "What We're NOT Doing" as a non-blocking follow-up.
- **Fix**: Track as follow-up; scope-compliant, no action this change.
- **Decision**: SKIPPED — accepted per plan scope.

### F5 — Stale JWT window after account deletion (accepted by design)

- **Severity**: ◽ OBSERVATION
- **Impact**: 🏃 LOW — quick decision
- **Dimension**: Safety & Quality
- **Location**: delete-account/route.ts + profile-form.tsx:37-38
- **Detail**: With JWT sessions, the cookie stays valid until client `signOut()` runs. If DELETE succeeds but signOut never fires, the JWT lives until expiry; practical impact minimal (user id gone from D1, trips cascade-deleted). Plan calls out JWT invalidation as client-side; no server-side revocation possible with pure JWT.
- **Fix**: None required.
- **Decision**: SKIPPED — accepted by design.
