# Auth & Account-Lifecycle Route Tests — Plan Brief

> Full plan: `context/changes/testing-auth-account-lifecycle-routes/plan.md`
> Research: `context/changes/testing-auth-account-lifecycle-routes/research.md`

## What & Why

Add Vitest route integration tests that lock account-lifecycle abuse protections (forgot-password response parity, reset-token forge/expire/reuse, delete-account session+password order) and the residual delete-account 401. The production routes already implement the gdpr F1–F3 fixes — this change is a regression guard for test-plan Phase 2.

## Starting Point

Phase 1 shipped a shared `route-harness.ts` and trip API tests. Auth routes under `src/app/api/auth/` have no tests; the harness lacks `verification_tokens` and rich user seeding.

## Desired End State

Colocated auth route tests green under `npm test`; harness supports token + password seeds; cookbook §6 documents the email-mock pattern so later phases reuse it. Page redirect and itinerary 401 remain deferred.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Password seeding | Real `hashPassword` | Stays honest with `verifyPassword`; no fixture rot | Plan |
| Token unit tests | Skip; prove via reset route | Cost × signal; avoid duplicating Phase 1 style | Plan |
| Harness DDL | `verification_tokens` only | Enough for reset/delete token paths | Plan |
| Register tests | Out of scope | Risk #4 is forgot/reset/delete; 409 signup is intentional | Research / Plan |
| Risk #5 in Phase 2 | Delete-account 401 only | Trip CRUD 401 already Phase 1; pages → Phase 4 | Research |
| Email failure branch | Mock `@/lib/email` to throw | Console fallback never throws in Vitest | Research |

## Scope

**In scope:**
- Harness: `verification_tokens`, richer `seedUser`, token seed helper
- Tests: forgot-password, reset-password, delete-account
- Cookbook §6 updates for email/Cloudflare mocks + Phase 2 note

**Out of scope:**
- Register, itinerary 401, page redirect e2e, trip 401 re-tests
- Rate limit / TOCTOU / JWT-after-delete / token-at-rest
- Production code changes; §2 risk-map backport

## Architecture / Approach

Same Phase 1 pattern: call handlers directly with `vi.mock` on `@/lib/auth`, `@/lib/db`, plus `@/lib/email` and `@/lib/cloudflare-context` for forgot-password. Run real `auth-tokens` + `password` against in-memory sqlite; assert HTTP + DB read-back.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Harness extensions | Token DDL + seed helpers | Breaking existing trip tests via `seedUser` signature |
| 2. Forgot + reset tests | Risk #4 parity + token replay | Incomplete parity (happy-path-only) |
| 3. Delete-account tests | 401/403/success + DB oracle | Status-only asserts without row read-back |
| 4. Cookbook notes | §6 reusable auth pattern | Docs drift from what shipped |

**Prerequisites:** Phase 1 test rollout complete (`route-harness.ts` + trip tests green)
**Estimated effort:** ~1–2 sessions across 4 phases

## Open Risks & Assumptions

- Scrypt seeding may slow the suite — mitigate with `beforeAll` hash cache if needed
- Cloudflare context mock shape must satisfy `AUTH_URL` access on the known-email path

## Success Criteria (Summary)

- Known/unknown/send-fail forgot-password all return identical `200 { ok: true }`
- Forged/expired/reused reset tokens all return the same generic 400; success updates hash and clears token
- Delete-account: 401 unauthenticated, 403 wrong password (row unchanged), 200 success (row gone)
