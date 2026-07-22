---
project: TripSprint AI
version: 1
status: draft
created: 2026-06-07
updated: 2026-07-22
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: TripSprint AI

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

TripSprint AI helps people planning a city break spend less time jumping between sites and more time on a coherent day-by-day plan that respects their duration and budget. The June 30 hard deadline is the dominant constraint: ship the full must-have path before the date, in strict dependency order, with no detours. The core product hypothesis — "an AI can turn a destination, a number of days, and a declared budget into a useful itinerary" — is tested by reaching the north star slice on time; everything else either supports that path or is Parked.

## North star

**S-03: User can generate and view a day-by-day AI itinerary for a trip** — the smallest end-to-end slice whose successful delivery proves the core product hypothesis, placed as early as prerequisites allow because everything else only matters if this works.

> "North star" here means the first slice that, if shipped and used by even one real user, answers whether the product is worth finishing — the validation milestone (the slice that, once working, gives enough signal to decide whether the product direction is worth continuing) that comes before all others.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| S-01 | `auth-shell` | land on the public landing page; sign up, sign in, sign out; be redirected to sign-in when accessing any protected page without a session | — | FR-001, FR-002, FR-003, FR-013, FR-014, US-03 | ready |
| S-02 | `trip-creation-and-list` | create a trip and see their saved trips | S-01 | FR-004, FR-005, FR-006 | done |
| S-03 | `ai-itinerary-generation` | generate and view a day-by-day AI itinerary for a trip | S-02 | FR-009, FR-010, US-01 | done |
| S-04 | `trip-edit-and-delete` | edit trip details and delete a trip | S-02 | FR-007, FR-008 | done |
| S-05 | `itinerary-activity-edit` | edit an activity in an itinerary and save the changes | S-03 | FR-011, FR-012, US-02 | done |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Must-have path | `S-01` → `S-02` → `S-03` → `S-05` | Strict must-have sequence to June 30; north star (S-03) sits as early as dependencies allow. Auth shell (S-01) gates every slice below it. |
| B | Trip management | `S-04` | Branches from `S-02`; parallel with `S-03` — can be planned in a separate agent run once `S-02` lands. |

## Baseline

What's already in place in the codebase as of 2026-06-09 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js ~16.2.7 + React 19 + Tailwind 4; App Router at `src/app/`; `/trips` page is a placeholder stub; `src/components/` has only `auth-provider.tsx`
- **Backend / API:** partial — auth routes only (`src/app/api/auth/*`); no trip CRUD or AI generation routes wired yet
- **Data:** present — Drizzle ORM + Cloudflare D1; `users`, `accounts`, `sessions`, `verification_tokens`, `trips` in `src/db/schema.ts`; `trips` includes `itinerary_json` column (nullable text); migration `drizzle/0000_sleepy_mandrill.sql` present
- **Auth:** present — Auth.js v5 + Credentials + D1 adapter in `src/lib/auth.ts`; JWT session handling (`src/lib/auth.ts:56-65`); route guard for `/trips` in `src/proxy.ts`
- **Deploy / infra:** present — Cloudflare Pages/Workers via `@opennextjs/cloudflare`; GitHub Actions CI not yet wired
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
- **Risk:** Auth infrastructure is present in the baseline (Auth.js v5 + Credentials + D1 adapter; partial route guard for `/trips` in `src/proxy.ts`). This slice completes the auth shell: (1) build the public landing page at `/`, (2) wire sign-up and sign-in UI, (3) extend route protection from `/trips` only to all protected routes. Primary risk is that the credentials flow or full route guard needs adjustment under the Cloudflare edge runtime — verify under `npm run preview:cf` before marking done. No downstream slice should start until this slice is closed: every other slice assumes a session-gated surface.
- **Status:** ready

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

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| S-01 | `auth-shell` | Auth shell: landing page + sign-up/sign-in/sign-out + full route protection | yes | Auth infrastructure present; extends `proxy.ts` guard to all protected routes, builds landing page. Run `/10x-plan auth-shell` |
| S-02 | `trip-creation-and-list` | Trip creation form + saved trips list | yes (after S-01) | Run `/10x-plan trip-creation-and-list` |
| S-03 | `ai-itinerary-generation` | AI itinerary generation + view (north star) | yes (after S-02) | Run `/10x-plan ai-itinerary-generation` |
| S-04 | `trip-edit-and-delete` | Edit trip details + delete trip | yes (after S-02) | Parallel with S-03; run `/10x-plan trip-edit-and-delete` |
| S-05 | `itinerary-activity-edit` | Edit and save itinerary activity changes | yes (after S-03) | Run `/10x-plan itinerary-activity-edit` |

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
- **GitHub Actions CI/CD** — Why parked: not a PRD must-have FR; Worker deploys manually via `wrangler deploy`; add after all must-have slices are planned and the deadline pressure eases.
- **Observability (logging, error tracking, metrics)** — Why parked: PRD has no uptime SLA for MVP; add when the product is live and generating real traffic.

## Done

- **S-05: user can edit the text of an activity in a generated itinerary and save the changes; original AI-estimated costs are preserved and displayed with disclaimer** — Archived 2026-07-09 → `context/archive/2026-06-15-itinerary-activity-edit/`. Lesson: —.
- **S-02: user can submit a trip form (destination city, duration, budget) and see the resulting trip in a list; can open a saved trip** — Archived 2026-07-22 → `context/archive/2026-06-10-trip-creation-and-list/`. Lesson: —.
- **S-03: user can trigger AI generation for a saved trip and see a day-by-day itinerary with per-day activities and approximate cost estimates, with a visible loading state during generation and an error message if generation exceeds 30 seconds** — Archived 2026-07-22 → `context/archive/2026-06-13-ai-itinerary-generation/`. Lesson: —.
- **S-04: user can update a trip's destination city, duration, or budget, and can delete a trip permanently** — Archived 2026-07-22 → `context/archive/2026-06-14-trip-edit-and-delete/`. Lesson: —.
