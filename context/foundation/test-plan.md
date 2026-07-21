# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-21 (Phase 1 planned)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/app/api`,
`src/components/layout`, `src/app/(protected)`, `src/lib/trips`,
`src/app/login`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|--------------------------|--------|------------|--------------------------------|
| 1 | A trip API route returns or mutates a trip **not owned** by the signed-in user (broken ownership / IDOR), leaking or corrupting another user's data | High | Medium | PRD §Guardrails ("a user's trips are never visible to another user"), FR-006/007/008; interview Q1, Q3; hot-spot dir `src/app/api` (23 commits/30d) |
| 2 | Itinerary generation hits the ~30s edge-runtime ceiling or streams an empty/partial result — the user gets no clean error, a broken screen, or an incomplete itinerary is persisted | High | High | roadmap S-03 (north star, "riskiest slice", 30s NFR with no buffer); interview Q1, Q2, Q3; hot-spot dir `src/app/api` (23 commits/30d) |
| 3 | The AI returns a day-count or shape that doesn't match the trip duration / expected schema, and the completeness guard or the view mishandles it | Medium | Medium | interview Q2 (AI output shape drift); hot-spot dir `src/lib/trips` (14 commits/30d) |
| 4 | Account-lifecycle abuse: forgot-password enumerates registered emails, a reset token is reused/forged, or account deletion succeeds without correct password + session | High | Medium | interview Q1, Q3; `context/changes/gdpr-account-deletion` review findings F1–F3; hot-spot dirs `src/app/api` + `src/app/login` (23 + 7 commits/30d) |
| 5 | An unauthenticated or wrong user reaches a protected page or trip API without a 401 / redirect to sign-in | High | Medium | PRD FR-014 + §Guardrails ("no trip data accessible to unauthenticated users"); interview Q2 (auth/session regressions); hot-spot dir `src/app/(protected)` (17 commits/30d) |
| 6 | A save (trip update or activity edit) silently fails validation or the DB write, and the user believes their change was persisted | High | Medium | interview Q1 (silent data loss); FR-012; hot-spot dir `src/lib/trips` (14 commits/30d) |

High-impact × genuinely-low-likelihood scenarios (e.g. Cloudflare regional
outage, OpenAI provider-wide downtime) are **not** in this map — they belong
to observability/alerting, not a test. Resource-abuse flooding
(reset-email / generation spam) is a known gap: rate-limiting was
explicitly deferred in the gdpr change, so it is recorded in §7 rather than
padded here.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | A request for another user's trip id returns 404 (not the trip), and PATCH/DELETE on it changes nothing | "Authenticated" ≠ "authorized" — a valid session does not imply ownership of the target trip | How ownership is scoped (session user id vs trip.userId), what status a wrong-owner read returns, whether all four verbs enforce it | integration (route-level) | Happy-path-only: testing only the owner's own trip and never the cross-user case |
| #2 | On timeout/abort or upstream error the client receives a clean, non-200 failure and **no** partial itinerary is written to the trip | "Stream started" ≠ "generation succeeded"; a 200 stream can still end empty | The abort/timeout path, the one-shot 409 guard, and the persistence guard that gates writing a completed object | integration (mock the AI SDK boundary) | Asserting exact AI text, or over-mocking so the timeout/persist path is never exercised |
| #3 | A day-count / shape that mismatches trip duration is rejected by the completeness guard and never persisted; a matching one is accepted | A "valid JSON" object is not necessarily a valid itinerary for N days | The duration→schema mapping and the completeness predicate, with fixture objects (short, exact, over-long) | unit (deterministic helpers) | Oracle problem: copying the expected value from the helper under test instead of from the duration contract |
| #4 | forgot-password returns identical 200 for known/unknown/failed-send; a reset token works once then 400s; delete requires correct password (403 on wrong, 401 on no session) | A 200 on the happy path doesn't prove the negative/abuse paths; "email sent" must not branch the response | Response parity across existence + send-failure, single-use token semantics, the delete auth/authz order | integration (route-level, mock email) | Testing only the successful reset and never enumeration / reuse / wrong-password |
| #5 | Hitting a protected page unauthenticated redirects to sign-in; a trip API without a session returns 401 | The `(protected)` layout guard and per-route API guard are two separate mechanisms — both must hold | Where the redirect is enforced (layout vs middleware) and which API routes assert the session | integration for APIs; e2e for the page redirect | e2e where a cheap route-level 401 assertion already catches it |
| #6 | After a save call the persisted record reflects the change; an invalid payload is rejected with 4xx, not a silent 204 | A 2xx response doesn't prove the row changed; validation rejection must be observable | The validation boundary and the read-back of persisted state (not just the HTTP status) | integration (route + DB read-back) | Asserting only the response status and never reading back the persisted value |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|-----------|------------------|----------------|------------|--------|---------------|
| 1 | Trip API contract & ownership | Prove trip routes enforce ownership + persist saves; bootstrap the API route test harness (none today) | #1, #5, #6 | integration | planned | context/changes/testing-trip-api-contract-ownership/ |
| 2 | Auth & account-lifecycle routes | Prove reset can't enumerate/replay and deletion needs real auth | #4, #5 | integration | not started | — |
| 3 | Itinerary generation & shape contract | Prove generation fails cleanly and never persists a mismatched itinerary | #2, #3 | unit + integration | not started | — |
| 4 | Critical-path e2e smoke + CI gate | Prove the sign-in→create→generate→edit path works end-to-end; lock the floor in CI | cross-cutting (#2, #5) | e2e + gates | not started | — |

**Status vocabulary** (fixed — parser literals): `not started` →
`change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | 3.x (`npm test` → `vitest run`) | Configured via package.json; **3 test files today, all in `src/lib/trips/`** — API/auth/component layers bare |
| API / route testing | none yet — see §3 Phase 1 | — | Routes run on the workerd runtime; Phase 1 research picks the harness (Vitest + mocked `auth()`/`getDb`, or `wrangler`/`unstable_dev`) |
| external-boundary mocking | none yet — see §3 Phase 3 | — | AI SDK (`ai` / `@ai-sdk/openai`) and email (Resend `fetch`) are the boundaries to mock |
| e2e | none yet — see §3 Phase 4 | — | Candidate: Playwright, or the in-session Claude Preview / Chrome MCP driving the real dev server |
| quality gates (CI) | none yet — see §3 Phase 4 | — | GitHub Actions is the stated CI provider (`tech-stack.md`); currently unwired (parked in roadmap) |

**Stack grounding tools (current session):**
- Docs: Context7-style docs MCP (`query-docs` / `resolve-library-id`) — available; use for current Vitest, Next 16, and Vercel AI SDK test-setup APIs; checked: 2026-07-10
- Search: no dedicated Exa.ai in session; `WebSearch` available as fallback for tool-status discovery only; checked: 2026-07-10
- Runtime/browser: Claude Preview MCP (`preview_*`) + Claude-in-Chrome MCP — available; usable as the Phase 4 e2e/verification layer against `npm run dev:local`; checked: 2026-07-10
- Provider/platform: GitLab MCP + Cloudflare `wrangler` skill available; D1 local queries usable to assert persisted state in integration tests; checked: 2026-07-10

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required | syntactic / type drift |
| unit + integration | local + CI | required after §3 Phase 1 | logic + route regressions |
| e2e on critical flow | CI on PR | required after §3 Phase 4 | broken sign-in→generate→edit path |
| build (`npm run build`) | local + CI | required | OpenNext/edge build breakage |
| pre-prod smoke | between merge + prod | optional | environment-specific (workerd) failures |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, it reads "TBD — see §3
Phase <N>."

### 6.1 Adding a unit test

- **Location**: next to the unit under test (e.g. `src/lib/trips/<mod>.test.ts`).
- **Reference test**: `src/lib/trips/validation.test.ts`, `src/lib/trips/itinerary.test.ts`.
- **Run locally**: `npm test` (all) or `npx vitest run src/lib/trips/itinerary.test.ts`.

### 6.2 Adding an integration (route) test

- TBD — see §3 Phase 1 (trip API ownership/persistence pattern) and Phase 2
  (auth/lifecycle pattern). Mocking policy will be fixed there: mock only the
  external edge (`auth()` session, AI SDK, Resend HTTP); never mock internal
  modules; assert response **and** the persisted D1 side-effect.

### 6.3 Adding a test for a new API endpoint

- TBD — see §3 Phase 1. Expected pattern: exercise the route handler with a
  mocked session + real (local D1 / in-memory) DB, assert status + body +
  read-back of persisted state, and always include the wrong-owner and
  unauthenticated cases.

### 6.4 Adding a test around AI generation

- TBD — see §3 Phase 3. Expected pattern: unit-test the deterministic
  helpers (duration→schema, completeness guard, prompt builder) against
  fixtures; for the route, mock the AI SDK boundary to simulate
  timeout/abort, empty stream, and incomplete object — never assert exact
  generated text.

### 6.5 Adding an e2e test

- TBD — see §3 Phase 4.

### 6.6 Per-rollout-phase notes

(Filled in as phases land.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Respect these
unless the underlying assumption changes.

- **UI snapshot tests** — brittle, break on every layout tweak, catch little. Re-evaluate only if a visual regression actually ships. (Source: interview Q5.)
- **The public landing / marketing page** — static, low blast radius, unauthenticated by design. (Source: interview Q5.)
- **Exact AI itinerary text** — non-deterministic; assert shape/contract (day count, cost fields present, schema validity), never specific wording. (Source: interview Q5.)
- **Rate-limiting / resource-abuse flooding** — deferred infrastructure per the gdpr change; not a unit/integration concern. Re-evaluate if abuse is observed in production or a limiter is added. (Source: gdpr-account-deletion plan §"What We're NOT Doing".)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-07-10
- Stack versions last verified: 2026-07-10
- AI-native tool references last verified: 2026-07-10

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
