---
project: TripSprint AI
version: 1
status: active
created: 2026-06-07
updated: 2026-07-22
prd_version: 1
main_goal: speed
top_blocker: next-slice
---

# Roadmap: TripSprint AI

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

TripSprint AI helps people planning a city break spend less time jumping between sites and more time on a coherent day-by-day plan that respects their duration and budget. The June 30 hard deadline was the original constraint for the must-have path. **As of 2026-07-22, slices S-01–S-05 are shipped** — the core product hypothesis is testable in production. Further work is optional slices and hardening, not dependency-blocked MVP sequencing.

## North star

**S-03: User can generate and view a day-by-day AI itinerary for a trip** — the smallest end-to-end slice whose successful delivery proves the core product hypothesis, placed as early as prerequisites allow because everything else only matters if this works.

> "North star" here means the first slice that, if shipped and used by even one real user, answers whether the product is worth finishing — the validation milestone (the slice that, once working, gives enough signal to decide whether the product direction is worth continuing) that comes before all others.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| S-01 | `auth-shell` | land on the public landing page; sign up, sign in, sign out; be redirected to sign-in when accessing any protected page without a session | — | FR-001, FR-002, FR-003, FR-013, FR-014, US-03 | done |
| S-02 | `trip-creation-and-list` | create a trip and see their saved trips | S-01 | FR-004, FR-005, FR-006 | done |
| S-03 | `ai-itinerary-generation` | generate and view a day-by-day AI itinerary for a trip | S-02 | FR-009, FR-010, US-01 | done |
| S-04 | `trip-edit-and-delete` | edit trip details and delete a trip | S-02 | FR-007, FR-008 | done |
| S-05 | `itinerary-activity-edit` | edit an activity in an itinerary and save the changes | S-03 | FR-011, FR-012, US-02 | done |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Must-have path | `S-01` → `S-02` → `S-03` → `S-05` | **Complete** (all slices `done`). Auth shell gates trip + generation surfaces. |
| B | Trip management | `S-04` | **Complete** — shipped in parallel with S-03 after S-02. |

## Baseline

What's in place in the codebase as of **2026-07-22** (post S-01–S-05). Foundations below are present; do NOT re-scaffold them.

- **Frontend:** present — Next.js ~16.2.x + React 19 + Tailwind 4; App Router at `src/app/`; landing `/`, auth `/login`, protected `(protected)/` group (`/trips`, `/trips/[tripId]`, `/profile`); shared shell in `src/components/layout/` and trip/itinerary UI in `src/components/`
- **Backend / API:** present — auth (`src/app/api/auth/*`), trip CRUD (`src/app/api/trips`, `[tripId]`), itinerary generate + PATCH (`src/app/api/trips/[tripId]/itinerary`)
- **Data:** present — Drizzle ORM + Cloudflare D1; `users`, `accounts`, `sessions`, `verification_tokens`, `trips` in `src/db/schema.ts`; `trips.itinerary_json` for persisted itineraries; migrations under `drizzle/`
- **Auth:** present — Auth.js v5 + Credentials + D1 adapter (`src/lib/auth.ts`); JWT sessions; route protection via `(protected)/layout.tsx` layout guard (reads `x-opennext-initial-url` on workerd for `callbackUrl`); forgot-password + account deletion routes
- **Testing:** present — Vitest unit + route integration (`npm test`); Playwright e2e on critical path (`npm run e2e`, CI); optional workerd smoke (`npm run smoke:cf`, nightly workflow). Cookbook: `context/foundation/test-plan.md`
- **Deploy / infra:** present — Cloudflare Workers via `@opennextjs/cloudflare`; Worker at `https://tripsprint-ai.agnieszkakot22.workers.dev`; GitHub Actions **CI** (`.github/workflows/ci.yml`: lint, typecheck, test, build, build:cf, e2e) and **deploy** (`.github/workflows/deploy.yml`: remote D1 migrate → build:cf → deploy on green `main` CI)
- **Observability:** absent — no logging library, error tracking, or metrics configured

## Foundations

None. All prerequisite layers needed by the first vertical slice (auth, data schema, deploy) are reported as present in the baseline above. The `itinerary_json` column in the `trips` table already covers itinerary persistence for all slices. Technical elements needed by each slice are introduced inside that slice; none require a cross-cutting enabler to land first.

## Slices

### S-01: Auth shell — landing page, sign-up / sign-in / sign-out, route protection

- **Outcome:** user can land on a public landing page with entry points to sign in and sign up; create an account; sign in with email and password; sign out; and — when navigating to any protected page without a session — be automatically redirected to the sign-in page
- **Change ID:** `auth-shell`
- **PRD refs:** FR-001, FR-002, FR-003, FR-013, FR-014, US-03
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Shipped. Auth shell verified under `preview:cf` (layout guard replaced Node middleware; see `context/archive/2026-06-09-s-01/`).
- **Status:** done

---

### S-02: User can create a trip and see their saved trips

- **Outcome:** user can submit a trip form (destination city, duration, budget) and see the resulting trip in a list; can open a saved trip
- **Change ID:** `trip-creation-and-list`
- **PRD refs:** FR-004, FR-005, FR-006
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - What does the trip card in the list show — destination only, or also duration and budget? — Owner: user. Block: no.
- **Risk:** The `trips` table exists in the schema, but no trip API routes are wired yet. This slice introduces all trip CRUD routes. Sequenced before generation because the generation route (S-03) needs a `tripId` to attach the itinerary to; skipping this creates an unplannable dependency.
- **Status:** done

---

### S-03: User can generate and view a day-by-day AI itinerary for a trip ★ north star

- **Outcome:** user can trigger AI generation for a saved trip and see a day-by-day itinerary with per-day activities and approximate cost estimates, with a visible loading state during generation and an error message if generation exceeds 30 seconds
- **Change ID:** `ai-itinerary-generation`
- **PRD refs:** FR-009, FR-010, US-01
- **Prerequisites:** S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - What prompt shape produces a consistently useful itinerary (activity variety, cost accuracy, day balance)? — Owner: team. Block: no (implementation concern for `/10x-plan`).
  - PRD Open Question 2: what makes TripSprint AI's output different from a generic AI tool? — Owner: user. Block: no (useful for prompt design, not blocking generation).
- **Risk:** This is the riskiest slice — the 30-second NFR sits at the Cloudflare edge runtime's timeout ceiling. `OPENAI_API_KEY` is set as a Worker secret. Streaming responses are the standard mitigation; if the AI call exceeds the limit, the error path must be reliable. Sequenced as early as S-02 allows because this is the validation milestone.
- **Status:** done

---

### S-04: User can edit trip details and delete a trip

- **Outcome:** user can update a trip's destination city, duration, or budget, and can delete a trip permanently
- **Change ID:** `trip-edit-and-delete`
- **PRD refs:** FR-007, FR-008
- **Prerequisites:** S-02
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:**
  - When a trip is deleted, its generated itinerary disappears via cascade delete — worth surfacing as a UI disclosure before the user confirms. — Owner: team. Block: no.
- **Risk:** Editing trip inputs (city, duration, budget) does not recalculate the itinerary (PRD §Non-Goals: no regeneration). The UI must make this clear so users don't expect updated estimates after editing. Parallel with S-03; no dependency between them after S-02 lands.
- **Status:** done

---

### S-05: User can edit an activity in an itinerary and save the changes

- **Outcome:** user can edit the text of an activity in a generated itinerary and save the changes; original AI-estimated costs are preserved and displayed with disclaimer
- **Change ID:** `itinerary-activity-edit`
- **PRD refs:** FR-011, FR-012, US-02
- **Prerequisites:** S-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Is the itinerary edited at the activity level inside the `itinerary_json` blob, or does the plan need a separate `activities` table? — Owner: team. Block: no (`itinerary_json` column exists and can store the edited state; `/10x-plan` decides the shape).
- **Risk:** Editing is free-form text; cost estimates become stale the moment a user edits — PRD accepted this risk (disclaimer covers it). Explicit save means data loss if the user navigates away without saving — PRD accepted this too. No regeneration path exists by design (§Non-Goals).
- **Status:** done

## Backlog Handoff

All PRD must-have slices (S-01–S-05) are **done**. Archives under `context/archive/`.

| Roadmap ID | Change ID | Status | Archive / notes |
|---|---|---|---|
| S-01 | `auth-shell` | done | `context/archive/2026-06-09-s-01/` (folder `s-01`) |
| S-02 | `trip-creation-and-list` | done | `context/archive/2026-06-10-trip-creation-and-list/` |
| S-03 | `ai-itinerary-generation` | done | `context/archive/2026-06-13-ai-itinerary-generation/` |
| S-04 | `trip-edit-and-delete` | done | `context/archive/2026-06-14-trip-edit-and-delete/` |
| S-05 | `itinerary-activity-edit` | done | `context/archive/2026-06-15-itinerary-activity-edit/` |

**Next product research (optional):** `context/changes/trip-add-delete-research/` (`preparing`).

## Open Roadmap Questions

1. **Persona specificity** — Is the primary actor independent leisure travelers, couples, frequent weekend travelers, or another segment? — Owner: user. Block: no (roadmap-wide; affects marketing copy and prompt design, not MVP sequencing).
2. **Product insight** — What does TripSprint AI offer that manual research or a generic AI tool doesn't? — Owner: user. Block: no (S-03; useful for shaping the generation prompt and communicating value to reviewers).
3. **target_scale.qps** — Estimated request rate not captured during shaping. — Owner: user. Block: no (roadmap-wide; not required for MVP scope).
4. **target_scale.data_volume** — Estimated data volume not captured during shaping. — Owner: user. Block: no (roadmap-wide; not required for MVP scope).

## Parked

- **No itinerary regeneration** — Why parked: PRD §Non-Goals; once generated, the itinerary is edited manually. No "Regenerate" button for MVP.
- **No real-time or live pricing** — Why parked: PRD §Non-Goals; all cost estimates are AI-approximated, not fetched from booking APIs.
- **No collaboration** — Why parked: PRD §Non-Goals; trips are single-user only; no sharing with another account.
- **No export (PDF, calendar, link sharing)** — Why parked: PRD §Non-Goals.
- **No maps or geolocation** — Why parked: PRD §Non-Goals; activities are text-only.
- **No hotel or flight recommendations** — Why parked: PRD §Non-Goals.
- **No offline support** — Why parked: PRD §Non-Goals.
- **Observability (logging, error tracking, metrics)** — Why parked: PRD has no uptime SLA for MVP; add when the product is live and generating real traffic.

## Shipped (infra, not roadmap slices)

- **GitHub Actions CI/CD** — `.github/workflows/ci.yml` (quality + e2e on PR/push to `main`), `.github/workflows/deploy.yml` (remote D1 migrate → deploy after green CI on `main`), `.github/workflows/preview-cf-smoke.yml` (optional nightly workerd smoke via `npm run smoke:cf`). Prod verification checklist remains in `context/changes/deploy-plan.md` Phase 6.

## Done

- **S-05: user can edit the text of an activity in a generated itinerary and save the changes; original AI-estimated costs are preserved and displayed with disclaimer** — Archived 2026-07-09 → `context/archive/2026-06-15-itinerary-activity-edit/`. Lesson: —.
- **S-01: user can land on a public landing page with entry points to sign in and sign up; create an account; sign in with email and password; sign out; and — when navigating to any protected page without a session — be automatically redirected to the sign-in page** — Archived 2026-07-22 → `context/archive/2026-06-09-s-01/` (change folder `s-01`; roadmap Change ID `auth-shell`). Lesson: —.
- **S-02: user can submit a trip form (destination city, duration, budget) and see the resulting trip in a list; can open a saved trip** — Archived 2026-07-22 → `context/archive/2026-06-10-trip-creation-and-list/`. Lesson: —.
- **S-03: user can trigger AI generation for a saved trip and see a day-by-day itinerary with per-day activities and approximate cost estimates, with a visible loading state during generation and an error message if generation exceeds 30 seconds** — Archived 2026-07-22 → `context/archive/2026-06-13-ai-itinerary-generation/`. Lesson: —.
- **S-04: user can update a trip's destination city, duration, or budget, and can delete a trip permanently** — Archived 2026-07-22 → `context/archive/2026-06-14-trip-edit-and-delete/`. Lesson: —.
