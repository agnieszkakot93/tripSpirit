# Critical-Path E2E Smoke + CI Gate — Plan Brief

> Full plan: `context/changes/critical-path/plan.md`
> Research: `context/changes/critical-path/research.md`

## What & Why

Wire GitHub Actions quality gates and Playwright smoke tests for test-plan Phase 4: prove the sign-in → create → generate → edit path works in a real browser and lock Risk #5 page redirect (deferred from Vitest Phases 1–3). CI quality gates ship without auto-deploy.

## Starting Point

79 Vitest tests green; no Playwright, no `.github/workflows/`, no `typecheck`/`e2e` scripts. Critical UI flow exists; generation is 15–30s with real OpenAI and has a `waitUntil`/refresh race. `dev:local` on :3000 is the e2e server target.

## Desired End State

`ci.yml` runs lint + typecheck + vitest + build + `build:cf`; `e2e/` has redirect + full critical-path specs; `npm run e2e` green in CI with fixture generation (no OpenAI secret); §6.5 cookbook filled; rollout Phase 4 marked complete.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Generate in e2e | `E2E_ITINERARY_FIXTURE` server seam | Client-only Playwright fulfill skips persist; fixture keeps `onFinish` + D1 write | Plan (refines Research intercept intent) |
| Smoke scope | Full critical path + separate redirect spec | Matches test-plan wording; redirect is Risk #5 net-new | Plan |
| CI phasing | Quality gates → Playwright → cookbook | De-risks: green vitest floor before browser flake | Plan |
| E2e auth | Register via UI (unique email) | Exercises real sign-up path; no SQL seed coupling | Plan |
| Selectors | Accessible only (roles/labels) | No testids in codebase; matches §7 spirit | Plan |
| Deploy CI | Out of scope | Quality gates ≠ deploy (`deploy-plan.md` Phase 5) | Research / Plan |
| `build:cf` in gates | Include in `check` + CI | Catches OpenNext breakage `next build` misses | Research / Plan |

## Scope

**In scope:**
- `typecheck` / `check` / `e2e` scripts; `.github/workflows/ci.yml` quality + e2e jobs
- `E2E_ITINERARY_FIXTURE` seam on itinerary POST (dev/CI only)
- `e2e/auth-redirect.spec.ts`, `e2e/critical-path.spec.ts`, Playwright config
- §6.5 / §6.6 / §3 Phase 4 / §5 `build:cf` update

**Out of scope:**
- Deploy workflow, real OpenAI in CI, API matrix re-tests, `preview:cf` CI smoke, `data-testid` hooks, landing/snapshot tests

## Architecture / Approach

Phase 1 wires stateless PR gates (no secrets). Phase 2 adds Playwright against `dev:local` with `.dev.vars` (`AUTH_SECRET`, `E2E_ITINERARY_FIXTURE=true`); fixture env returns deterministic stream + normal persist path. Redirect spec owns Risk #5 page half; critical-path spec owns happy path. Phase 3 documents in §6.5.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. CI quality gates | `ci.yml` + `check` script | `better-sqlite3` native build on Ubuntu |
| 2. Playwright e2e | Fixture seam + redirect + critical-path specs | Generate persist race; stream format wrong |
| 3. Cookbook + rollout | §6.5 pattern, Phase 4 complete | Docs drift from fixture env |

**Prerequisites:** Vitest Phases 1–3 complete; `dev:local` works locally
**Estimated effort:** ~2–3 sessions across 3 phases

## Open Risks & Assumptions

- Fixture stream bytes must match `useObject` text-stream format — record once from dev if construction fails
- `E2E_ITINERARY_FIXTURE` must never be set on production Worker
- E2e CI job adds ~2–3 min vs quality-only; acceptable for Phase 4

## Success Criteria (Summary)

- PRs run lint/typecheck/test/build/build:cf automatically
- Unauthenticated `/trips` redirects to login with callback; full critical path passes in CI without OpenAI
- §6.5 enables a fresh agent to add another browser smoke
