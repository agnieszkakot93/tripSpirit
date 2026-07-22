# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-22 (§3 archive paths reconciled)

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
| 2 | Itinerary generation hits the ~30s edge-runtime ceiling or streams an empty/partial result — the user gets no usable itinerary, a broken screen, or an incomplete itinerary is persisted | High | High | roadmap S-03 (north star, "riskiest slice", 30s NFR with no buffer); interview Q1, Q2, Q3; hot-spot dir `src/app/api` (23 commits/30d) |
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
| #2 | Pre-stream failures return JSON non-200 (`401` / `404` / `409` / `500`); after the stream starts, timeout/abort/upstream failure may be HTTP 200 with an empty/incomplete text stream — in **both** cases **no** partial itinerary is written to the trip and the client must surface failure | "Stream started" ≠ "generation succeeded"; a 200 stream can still end empty | The abort/timeout path, the one-shot 409 guard, and the persistence guard that gates writing a completed object; distinguish pre-stream JSON errors from mid-stream empty-stream semantics | integration (mock the AI SDK boundary) | Asserting exact AI text; over-mocking so the timeout/persist path is never exercised; expecting mid-stream abort to return non-200 JSON |
| #3 | A day-count / shape that mismatches trip duration is rejected by the completeness guard and never persisted; a matching one is accepted | A "valid JSON" object is not necessarily a valid itinerary for N days | The duration→schema mapping and the completeness predicate, with fixture objects (short, exact, over-long) | unit (deterministic helpers) | Oracle problem: copying the expected value from the helper under test instead of from the duration contract |
| #4 | forgot-password returns identical 200 for known/unknown/failed-send; a reset token works once then 400s; delete requires correct password (403 on wrong, 401 on no session) | A 200 on the happy path doesn't prove the negative/abuse paths; "email sent" must not branch the response | Response parity across existence + send-failure, single-use token semantics, the delete auth/authz order | integration (route-level, mock email) | Testing only the successful reset and never enumeration / reuse / wrong-password |
| #5 | Hitting a protected page unauthenticated redirects to sign-in; a trip API without a session returns 401 | The `(protected)` layout guard and per-route API guard are two separate mechanisms — both must hold | Where the redirect is enforced (layout vs middleware) and which API routes assert the session | integration for APIs; e2e for the page redirect | e2e where a cheap route-level 401 assertion already catches it |
| #6 | After a save call the persisted record reflects the change; an invalid payload is rejected with 4xx, not a silent 204 | A 2xx response doesn't prove the row changed; validation rejection must be observable | The validation boundary and the read-back of persisted state (not just the HTTP status) | integration (route + DB read-back) | Asserting only the response status and never reading back the persisted value |

## 3. Phased Rollout

Each row is a discrete rollout phase that opened its own change folder via
`/10x-new`. Completed phases are archived under `context/archive/`; the
**Change folder** column points at the archive path once `status: complete`.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|-----------|------------------|----------------|------------|--------|---------------|
| 1 | Trip API contract & ownership | Prove trip routes enforce ownership + persist saves; bootstrap the API route test harness (none today) | #1, #5, #6 | integration | complete | `context/archive/2026-07-10-testing-trip-api-contract-ownership/` |
| 2 | Auth & account-lifecycle routes | Prove reset can't enumerate/replay and deletion needs real auth | #4, #5 | integration | complete | `context/archive/2026-07-21-testing-auth-account-lifecycle-routes/` |
| 3 | Itinerary generation & shape contract | Prove generation fails cleanly and never persists a mismatched itinerary | #2, #3 | unit + integration | complete | `context/archive/2026-07-21-testing-itinerary-generation-shape-contract/` |
| 4 | Critical-path e2e smoke + CI gate | Prove the sign-in→create→generate→edit path works end-to-end; lock the floor in CI | cross-cutting (#2, #5) | e2e + gates | complete | `context/archive/2026-07-21-critical-path/` |

**Status vocabulary** (fixed — parser literals): `not started` →
`change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | 3.x / 4.x (`npm test` → `vitest run`) | Unit tests under `src/lib/trips/`; route integration tests under `src/app/api/trips/` (§6.2) |
| API / route testing | Vitest + `src/test/route-harness.ts` | — | Direct handler call; `vi.mock` `@/lib/auth` + `@/lib/db`; in-memory better-sqlite3. See §6.2 / §6.3 |
| external-boundary mocking | Vitest `vi.mock` at module seams | — | AI SDK (`ai.streamObject`) and email (Resend `fetch`) mocked at the import boundary — see §6.2 / §6.4 |
| e2e | Playwright (`@playwright/test`) | 1.x (`npm run e2e` → `playwright test`) | Chromium only; specs under `e2e/`; `webServer` mirrors `dev-local.sh`; generation mocked via `E2E_ITINERARY_FIXTURE`. See §6.5 |
| quality gates (CI) | GitHub Actions | — | `.github/workflows/ci.yml`: `quality` job (lint → typecheck → test → build → build:cf) + `e2e` job (needs `quality`, no secrets when fixture active). See §5 |

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
| build (`npm run build`) | local + CI | required | Next build breakage |
| build:cf (`npm run build:cf`) | local + CI | required | OpenNext/workerd build breakage that `next build` alone misses |
| pre-prod smoke (`npm run smoke:cf`) | nightly / manual | optional | workerd/OpenNext runtime failures (`x-opennext-initial-url`, layout guard) that `next dev` e2e misses |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, it reads "TBD — see §3
Phase <N>."

### 6.1 Adding a unit test

- **Location**: next to the unit under test (e.g. `src/lib/trips/<mod>.test.ts`).
- **Reference test**: `src/lib/trips/validation.test.ts`, `src/lib/trips/itinerary.test.ts`.
- **Run locally**: `npm test` (all) or `npx vitest run src/lib/trips/itinerary.test.ts`.

### 6.2 Adding an integration (route) test

- **Harness**: `src/test/route-harness.ts` — `setupRouteTest()`, `seedUser()`,
  `seedTrip()`, `seedResetToken()`, `mockAuth`, `mockGetDb`. DDL includes
  `users`, `trips`, and `verification_tokens`.
- **Location**: colocated next to the route — e.g. `src/app/api/trips/route.test.ts`
  or `src/app/api/auth/forgot-password/route.test.ts`.
- **Reference tests**:
  - Trips: `src/app/api/trips/route.test.ts`,
    `src/app/api/trips/[tripId]/route.test.ts`
  - Auth lifecycle: `src/app/api/auth/forgot-password/route.test.ts`,
    `src/app/api/auth/reset-password/route.test.ts`,
    `src/app/api/auth/delete-account/route.test.ts`
  - Itinerary generation: `src/app/api/trips/[tripId]/itinerary/route.test.ts`
- **Mocking policy**: mock only runtime seams. Always mock `@/lib/auth`
  (`auth`) and `@/lib/db` (`getDb`) when the route uses them. For
  account-lifecycle routes also mock:
  - `@/lib/email` (`sendPasswordResetEmail`) — controllable resolve vs throw
  - `@/lib/cloudflare-context` (`getAppCloudflareContext`) →
    `{ env: { AUTH_URL: "…" } }` (needed on the known-email forgot-password path)
  Do **not** mock `@/lib/trips/queries`, `@/lib/auth-tokens`, `@/lib/password`,
  validation, or drizzle internals. Seed passwords with real `hashPassword`
  (cache in `beforeAll` if scrypt cost hurts). For generation routes also
  mock `ai` (`streamObject`) and extend the Cloudflare context stub — see §6.4.
- **Wire mocks** (top of file, before importing the route module):

```ts
vi.mock("@/lib/auth", async () => {
  const harness = await import("@/test/route-harness");
  return { auth: harness.mockAuth };
});
vi.mock("@/lib/db", async () => {
  const harness = await import("@/test/route-harness");
  return { getDb: harness.mockGetDb };
});
```

Auth forgot-password extras (hoist a controllable email mock):

```ts
const { mockSendPasswordResetEmail } = vi.hoisted(() => ({
  mockSendPasswordResetEmail: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));
vi.mock("@/lib/cloudflare-context", () => ({
  getAppCloudflareContext: async () => ({
    env: { AUTH_URL: "https://example.test" },
    cf: {},
    ctx: {},
  }),
}));
```

- **beforeEach**: `const { db, setSession } = setupRouteTest();` then
  `setSession(null)` or `setSession({ user: { id: "u1" } })`. For password
  flows: `seedUser(db, "u1", { email, passwordHash })`. For reset cases that
  must not depend on forgot-password: `seedResetToken(db, email)` (live) or
  `seedResetToken(db, email, { expires: pastDate })` (expired).
- **Assert**: HTTP status + body **and** DB read-back via the same `db`
  (e.g. `getTripForUser`, `users` / `verification_tokens` selects). For
  wrong-owner mutate verbs, prove the owner row is **unchanged** — status 404
  alone is not enough (wrong-owner and missing both return 404). For
  delete-account wrong-password / success, prove the user row is unchanged /
  gone (status alone is insufficient).
- **Run locally**: `npx vitest run src/app/api/trips`,
  `npx vitest run src/app/api/auth`, or `npm test`.

### 6.3 Adding a test for a new API endpoint

1. Add `route.test.ts` beside the handler.
2. Copy the `vi.mock` + `setupRouteTest` pattern from §6.2 (add email /
   Cloudflare mocks when the route sends mail or reads `AUTH_URL`).
3. Always cover (trip / user-scoped resources):
   - **Unauthenticated** → 401 `{ error: "Unauthorized" }`
   - **Wrong-owner** (if the resource is user-scoped) → 404 + row unchanged
     on mutate
   - **Owner happy path** with DB read-back (not status-only)
   - **Invalid / partial body** → 400 and no write (when the route validates)
4. Always cover (account-lifecycle / auth routes under `src/app/api/auth/`):
   - **Forgot-password response parity** — known email + send ok, unknown
     email, and known email + `sendPasswordResetEmail` **throws** all return
     the same `200 { ok: true }` (do not treat happy-path-only as enough).
     Mock email to throw for the send-failure branch; console fallback never
     throws in Vitest.
   - **Reset-token abuse** — forged, expired, and reused tokens all return
     the same generic `400` (seed via `seedResetToken`; do not mock
     `auth-tokens`). Success updates `password_hash` and removes the token row.
   - **Delete-account auth order** — unauthenticated → `401` + row unchanged;
     wrong password → `403` + row unchanged; correct password → `200` + user
     gone (and verification tokens for that email cleaned when present).
5. Dynamic-segment handlers take `{ params: Promise.resolve({ … }) }`.
6. Do not assert exact validator error strings (oracle problem) — assert 400
   and that `error` is a non-empty string; compare DB to the request fixture
   or prior seed. Stable public auth messages
   (`"Unauthorized"`, `"Invalid or expired reset link"`, `"Invalid password"`)
   are the contract and may be asserted.

### 6.4 Adding a test around AI generation

Two layers: **unit** for deterministic helpers, **integration** for the route
wire-up (persist gate, abort/empty, one-shot 409).

#### Unit — duration / shape helpers

- **Location**: `src/lib/trips/itinerary.test.ts` (beside `itinerary.ts`).
- **Reference**: `buildItinerarySchemaForDuration`, `isItineraryCompleteForDuration`.
- **Oracle**: use a **literal** `TRIP_DURATION_DAYS` constant and a
  `sampleItinerary(n)` fixture builder. Assert short (`n - 1`), exact (`n`),
  over-long (`n + 1`), and non-sequential `day` numbers. Never derive the
  expected count from helper internals or Zod describe strings (Risk #3).
- **Run locally**: `npx vitest run src/lib/trips/itinerary.test.ts`.

#### Integration — generation route (`POST`)

- **Location**: `src/app/api/trips/[tripId]/itinerary/route.test.ts`.
- **Reference test**: same file — locks Risks #2 / #3 persistence and Risk #5
  residual itinerary 401.
- **Mocking policy** (in addition to §6.2 auth + db):
  - `@/lib/cloudflare-context` → `{ env: { OPENAI_API_KEY: "…" }, ctx: { waitUntil } }`
    where `waitUntil` collects promises so tests can `await Promise.all(...)`
    before DB read-back.
  - `ai` → `{ streamObject: mockStreamObject }` — **hoist** the mock with
    `vi.hoisted` **before** `vi.mock` and **before** importing the route.
  - Optionally stub `AbortSignal.timeout` to a short ms (~50) for the abort
    case — do **not** wait 28s wall-clock.
  - Do **not** mock `@/lib/trips/queries`, `@/lib/trips/itinerary` helpers,
    or drizzle internals. `updateTripItinerary` must run for real against the
    in-memory sqlite from `setupRouteTest()`.
- **Capture `onFinish`**: the `streamObject` mock records the options object
  passed by the route. Return a stub
  `{ toTextStreamResponse: () => new Response("", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }) }`.
  After calling `POST`, invoke the captured `onFinish({ object })` manually
  (or let abort fire) to exercise the persist gate.
- **Assert**:
  - Pre-stream: `401` / `409` / `500` (missing key) as JSON — `streamObject`
    must **not** be called when the route returns early.
  - Mid-stream: HTTP **200** text/plain stream is valid for abort/empty paths
    (Risk #2) — assert stream class, **not** `expect(status).not.toBe(200)`.
  - Always read back `itinerary_json` via `getTripForUser` after flushing
    `waitUntil`: null for empty/abort/incomplete `onFinish`, set for a
    complete object matching `trip.durationDays`.
  - Never assert exact AI-generated text.
- **Typical cases** (itinerary POST):
  - Unauthenticated → `401`
  - Existing `itinerary_json` → `409` + row unchanged (one-shot)
  - Missing `OPENAI_API_KEY` → `500` + no stream
  - `onFinish({ object: undefined })` or abort → `itinerary_json` still null
  - `onFinish({ object: incomplete })` (day-count mismatch) → null
  - `onFinish({ object: complete })` → persisted JSON matches fixture
- **PATCH on this route**: cover unauthenticated `401` only; ownership/persist
  matrix for edits is out of scope here.
- **Run locally**: `npx vitest run src/app/api/trips/[tripId]/itinerary`
  or `npm test`.

Minimal mock skeleton (adapt from the reference test):

```ts
const { mockStreamObject, cfState, waitUntilPromises, lastStreamObjectOptions } =
  vi.hoisted(() => {
    const waitUntilPromises: Promise<unknown>[] = [];
    const lastStreamObjectOptions = { current: null as StreamObjectOptions | null };
    const cfState = { openaiApiKey: "test-openai-key" as string | undefined };
    return {
      waitUntilPromises,
      lastStreamObjectOptions,
      cfState,
      mockStreamObject: vi.fn((options: StreamObjectOptions) => {
        lastStreamObjectOptions.current = options;
        return {
          toTextStreamResponse: () =>
            new Response("", {
              status: 200,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }),
        };
      }),
    };
  });

vi.mock("@/lib/cloudflare-context", () => ({
  getAppCloudflareContext: async () => ({
    env: { OPENAI_API_KEY: cfState.openaiApiKey },
    cf: {},
    ctx: {
      waitUntil: (p: Promise<unknown>) => {
        waitUntilPromises.push(p);
      },
    },
  }),
}));

vi.mock("ai", () => ({ streamObject: mockStreamObject }));

// import { POST } from "./route" AFTER mocks

async function flushWaitUntil() {
  await Promise.all([...waitUntilPromises]);
  waitUntilPromises.length = 0;
}
```

### 6.5 Adding an e2e test

- **Tool**: Playwright (`@playwright/test`), Chromium only. Config in
  `playwright.config.ts` (`testDir: "e2e"`, `baseURL: http://localhost:3000`,
  `workers: 1`, `fullyParallel: false`).
- **Location**: `e2e/<name>.spec.ts`. Reference specs:
  `e2e/critical-path.spec.ts` (full happy path),
  `e2e/auth-redirect.spec.ts` (Risk #5 page redirect matrix),
  `e2e/trips-list.spec.ts` (minimal authenticated smoke — no fixture).
- **Minimal skeleton**:

```ts
import { expect, test } from "@playwright/test";
// Redirect matrix only:
// import { injectOpenNextInitialUrlHeader } from "./helpers";

test.describe("…", () => {
  // test.beforeEach(async ({ page }) => {
  //   await injectOpenNextInitialUrlHeader(page);
  // });
  test("…", async ({ page }) => {
    await page.goto("/login");
    // …
  });
});
```
- **Server target**: the config `webServer` mirrors `scripts/dev-local.sh` —
  it runs `wrangler d1 migrations apply tripsprint-ai-db --local` then
  `next dev --webpack -p 3000`. `reuseExistingServer: !process.env.CI`, so
  locally it reuses a running `npm run dev:local`; in CI it starts fresh.
- **Run locally**: `npm run e2e` (`playwright test`). Requires `.dev.vars`
  with `AUTH_SECRET`, `AUTH_URL=http://localhost:3000`, `AUTH_TRUST_HOST=true`,
  and `E2E_ITINERARY_FIXTURE=true`. No `OPENAI_API_KEY` needed when the
  fixture is active.
- **Selectors**: accessible only — `getByRole` / `getByPlaceholder` /
  `getByLabel`. **No `data-testid`** (decision). Scope ambiguous matches with
  `.getByRole("main")` / `.getByRole("dialog")` (e.g. two "Create trip"
  buttons — nav vs modal).
- **Generation seam (fixture)**: do **not** `route.fulfill` the itinerary
  `POST` from the browser — that skips the Next.js handler, so nothing
  persists to D1 and the editor never appears. Instead the route honors
  `env.E2E_ITINERARY_FIXTURE === "true"`
  (`src/app/api/trips/[tripId]/itinerary/route.ts`): it returns a deterministic
  fixture stream compatible with `useObject` **and** still runs the normal
  `onFinish` → `updateTripItinerary` persist path. The flag is dev/CI-only —
  never set it on the production Worker (see §6.2 migration note in
  `.env.example`).
- **Poll after generate**: after clicking "Generate itinerary", `waitUntil`
  persist + `router.refresh()` race the streaming preview. Poll for the
  `ItineraryEditor` surface (e.g. `"+ Add activity"` / `"Day N"` accordion
  headings) with a ≥ 35s budget — do not assume an instant transition.
- **Assert shape, not prose**: day count, edited field survives reload — never
  exact AI-generated text (§7).
- **Redirect specs**: assert the URL contains `/login` and the `callbackUrl`
  query param — do **not** assert exact `302` vs `307`. Under `next dev` the
  `(protected)` layout only builds `callbackUrl` when it sees the OpenNext
  `x-opennext-initial-url` header, which full-document Playwright navigations
  omit; inject it via `injectOpenNextInitialUrlHeader` (`e2e/helpers.ts`) so
  the redirect matches production Worker behavior without touching the layout.
- **Auth**: register via the UI Register tab with a unique email per run
  (`e2e-<name>-${Date.now()}@example.com`) — no seeding/fixtures for users.
  After register, expect `/trips` and the empty-workspace heading
  (`/Plan your first city break/i`).
- **Create form defaults**: trip duration defaults to **3 days** — specs that
  exercise generate + fixture should expect Day 1–3 accordions unless the
  duration field is changed in the modal.
- **Save flow**: `ItineraryEditor` hides "Save changes" until a field is
  dirty — edit a textbox, then click Save; assert the button disappears
  before reload (reference: `critical-path.spec.ts`).
- **Itinerary editor locators**: day accordions →
  `getByRole("button", { name: /Day N/i })`; activity name fields → textboxes
  inside `li` elements that contain a "Remove activity" button, scoped with
  `getByRole("main")`.
- **Redirect helper** (unauthenticated protected-route tests only): import
  `injectOpenNextInitialUrlHeader` from `e2e/helpers.ts` and call it in
  `test.beforeEach`. Authenticated flows (register → `/trips`) do **not** need
  the helper.
- **CI**: `.github/workflows/ci.yml` `e2e` job (needs `quality`) installs
  `chromium` via `npx playwright install --with-deps chromium`, writes
  `.dev.vars` (generated `AUTH_SECRET` + `E2E_ITINERARY_FIXTURE=true`, no
  OpenAI secret), and runs `npm run e2e`.

### 6.6 Per-rollout-phase notes

- **§3 Phase 1 — Trip API contract & ownership** (change
  `testing-trip-api-contract-ownership`): shared harness under
  `src/test/route-harness.ts`; trip list/create and `[tripId]` route tests lock
  Risks #1 / #5 (API 401) / #6. Page-layout redirect deferred to §3 Phase 4
  e2e. Itinerary/generation routes deferred to §3 Phase 3.
- **§3 Phase 2 — Auth & account-lifecycle routes** (change
  `testing-auth-account-lifecycle-routes`): harness gained `verification_tokens`
  DDL, richer `seedUser({ email?, passwordHash? })`, and `seedResetToken`.
  Colocated tests under `src/app/api/auth/` lock Risk #4 (forgot parity,
  forge/expire/reuse, delete 403) and Risk #5 residual delete-account 401.
  Email + Cloudflare context mocks are documented in §6.2 / §6.3. Trip CRUD
  401 already covered in Phase 1 — do not re-test here. Page-layout redirect
  still deferred to §3 Phase 4 e2e; itinerary 401 to §3 Phase 3.
- **§3 Phase 3 — Itinerary generation & shape contract** (change
  `testing-itinerary-generation-shape-contract`): unit tests in
  `src/lib/trips/itinerary.test.ts` lock Risk #3 (literal-duration oracle,
  short/exact/over-long/non-sequential). Colocated
  `src/app/api/trips/[tripId]/itinerary/route.test.ts` mocks
  `ai.streamObject` + Cloudflare `waitUntil` / `OPENAI_API_KEY` to prove
  Risk #2 (abort/empty → no persist; pre-stream JSON non-200 vs mid-stream
  200 empty stream) and Risk #3 wire-up (incomplete never written, complete
  persists). Pattern documented in §6.4. PATCH on this route is 401-only;
  page-layout redirect still deferred to §3 Phase 4 e2e.
- **§3 Phase 4 — Critical-path e2e smoke + CI gate** (change
  `critical-path`): wired GitHub Actions quality gates
  (`lint` → `typecheck` → `test` → `build` → `build:cf`) plus an `e2e` job in
  `.github/workflows/ci.yml`, and added npm scripts `typecheck`, `check`,
  `e2e`. Playwright (`e2e/`, `playwright.config.ts`) locks the cross-cutting
  path: `critical-path.spec.ts` (register → create → generate → edit → save →
  reload with DB-visible persistence) and `auth-redirect.spec.ts` (Risk #5
  page redirect matrix — the layout guard finally covered at the browser
  level, closing the deferral from Phases 1–3). Generation is mocked at the
  stream boundary via `E2E_ITINERARY_FIXTURE` (dev/CI-only) so the server
  handler + D1 persist still run without OpenAI. Pattern documented in §6.5.
- **Optional pre-prod — `preview:cf` workerd smoke** (`scripts/preview-cf-smoke.sh`,
  `npm run smoke:cf`, `.github/workflows/preview-cf-smoke.yml`): after
  `npm run build:cf`, starts `preview:cf` on `:8787` and curls `/login`,
  unauthenticated `/trips` → `/login?callbackUrl=%2Ftrips` (real
  `x-opennext-initial-url` path — no Playwright header injection), then
  register → credentials sign-in → authenticated `/trips`. Nightly +
  `workflow_dispatch` only; not on every PR. Use `SKIP_BUILD=1` when
  `build:cf` already ran in the same job.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Respect these
unless the underlying assumption changes.

- **UI snapshot tests** — brittle, break on every layout tweak, catch little. Re-evaluate only if a visual regression actually ships. (Source: interview Q5.)
- **The public landing / marketing page** — static, low blast radius, unauthenticated by design. (Source: interview Q5.)
- **Exact AI itinerary text** — non-deterministic; assert shape/contract (day count, cost fields present, schema validity), never specific wording. (Source: interview Q5.)
- **Rate-limiting / resource-abuse flooding** — deferred infrastructure per the gdpr change; not a unit/integration concern. Re-evaluate if abuse is observed in production or a limiter is added. (Source: gdpr-account-deletion plan §"What We're NOT Doing".)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-07-22
- Stack versions last verified: 2026-07-10
- AI-native tool references last verified: 2026-07-10

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
