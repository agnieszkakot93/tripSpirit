---
project: TripSprint AI
updated: 2026-06-01
context_type: greenfield
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 14
  quality_check_status: accepted
timeline_budget:
  mvp_weeks: 3
  delivery_weeks: null
  hard_deadline: "2026-06-30"
  after_hours_only: false
product_type: web-app
target_scale:
  users: small
---

## Vision & Problem Statement

TripSprint AI — MVP.

Planning a city break is time-consuming and often requires browsing multiple websites to decide what to see, how to organize each day, and how to stay within budget. Users spend too much time researching instead of enjoying their trip.

## User & Persona

**Primary persona:** People planning a **city break** who want to spend less time jumping between sites and more time on a coherent day-by-day plan that respects their **duration** and **budget** (as stated in the brief).

## Success Criteria

### Primary
A signed-in user can enter a destination city, trip duration, and budget — and receive a day-by-day itinerary with per-day activities and approximate cost estimates — then edit at least one activity and save the trip.

### Secondary
A user can save multiple trips and return to any of them from the dashboard.

### Guardrails
- A user's trips are never visible to another user.
- No trip data is accessible to unauthenticated users.

## Access Control

- **Authentication:** Email + password (per shaping choice).
- **Authorization model:** Flat — each signed-in user sees and manages **only their own trips**; no admin/member split for MVP.
- **Route protection:** The landing page, sign-in, and sign-up are publicly accessible. All other routes require an active session; unauthenticated access redirects to sign-in.

## Functional Requirements

### Authentication
- FR-001: User can create an account. Priority: must-have
  > Socrates: Counter-argument considered: "Account creation adds onboarding friction before any value is delivered — anonymous itinerary generation first would reduce drop-off." Resolution: kept; account creation is required for trip persistence and multi-session return — the core secondary success criterion depends on it.

- FR-002: User can sign in with email and password. Priority: must-have
  > Socrates: Counter-argument considered: "Email+password requires password management (reset flows, hashing) — magic link / passwordless is simpler for MVP." Resolution: kept as email+password; it is the simplest universally understood auth method. Password reset complexity is accepted as a known MVP cost.

- FR-003: User can sign out. Priority: must-have
  > Socrates: No counter-argument. Sign-out is a security baseline, not a feature — it must be present.

- FR-013: The app exposes a public landing page accessible without authentication that describes the product and provides entry points to sign in and sign up. Priority: must-have
  > Socrates: Counter-argument considered: "A landing page is marketing overhead — for an MVP evaluated by a course reviewer, going straight to sign-in is simpler." Resolution: kept; the landing page defines the unauthenticated root and makes the security model unambiguous — without it, there is no agreed public entry point for the app.

- FR-014: An unauthenticated user who navigates to any page other than the landing page, sign-in, or sign-up is automatically redirected to the sign-in page. Priority: must-have
  > Socrates: No counter-argument. Route protection is a security baseline required by the guardrail "No trip data is accessible to unauthenticated users." Without it, the guardrail cannot be enforced at the navigation layer.

### Trip Management
- FR-004: User can create a trip by providing a destination city, duration, and budget. Priority: must-have
  > Socrates: Counter-argument considered: "Travel style is subjective and hard to communicate to an AI without extensive prompt engineering — dropping it simplifies the prompt and reduces hallucination risk." Resolution: accepted — travel style removed from MVP inputs. Trip creation now requires city, duration, and budget only.

- FR-005: User can view a list of their trips. Priority: must-have
  > Socrates: Counter-argument considered: "If the MVP proves value in one session, a trip list is premature — redirect to the last trip on login instead." Resolution: kept; the trip list enables the secondary success criterion (multiple saved trips) and is standard CRUD.

- FR-006: User can open a saved trip. Priority: must-have
  > Socrates: No counter-argument raised during challenge round.

- FR-007: User can update trip details (destination city, duration, or budget). Priority: must-have
  > Socrates: Counter-argument considered: "Delete-and-recreate is simpler to build and covers the same user need — updates add a separate edit form and state management overhead." Resolution: kept; updates are standard CRUD and explicitly required for course evaluation criteria.

- FR-008: User can delete a trip. Priority: must-have
  > Socrates: Counter-argument considered: "Without undo / soft-delete, accidental deletion is unrecoverable — for an MVP this is an acceptable risk, but it should be a known one." Resolution: kept; delete is standard CRUD and required for evaluation criteria. Hard delete is accepted; no undo for MVP.

### Itinerary Generation
- FR-009: User can generate a day-by-day itinerary for a trip. Priority: must-have
  > Socrates: No counter-argument. AI generation is the core product hypothesis — the MVP exists to test whether it produces useful output.

- FR-010: User can view the generated itinerary including per-day activities, approximate daily cost estimates, and total approximate cost. Priority: must-have
  > Socrates: Counter-argument considered: "Cost estimates from an LLM are approximations and may be significantly wrong — showing them as fact could mislead users." Resolution: kept with a visible disclaimer: "Estimates are approximate. Verify before booking." When a user edits an activity, the original AI-generated estimates are preserved (not recalculated); the disclaimer covers this staleness.

### Itinerary Management
- FR-011: User can edit an activity in the itinerary. Priority: must-have
  > Socrates: Counter-argument considered: "Free-form editing means cost estimates go stale the moment the user edits — the total budget view becomes unreliable." Resolution: accepted risk — original AI estimates are displayed with disclaimer and not recalculated on edit (per FR-010 resolution). Edits are essential to trust; the product is unusable without them.

- FR-012: User can save itinerary changes. Priority: must-have
  > Socrates: Counter-argument considered: "Explicit save creates risk of data loss if the user navigates away — auto-save would be safer." Resolution: kept as explicit save; simpler to implement and makes the persistence contract clear to the user. Data loss risk is accepted for MVP.

## User Stories

### US-01: Generate an itinerary

- **Given** a signed-in user
- **When** they enter a destination city, duration, and budget and click "Generate itinerary"
- **Then** they see a day-by-day itinerary with estimated costs

### US-02: Edit an itinerary

- **Given** a signed-in user viewing an itinerary
- **When** they edit an activity and save changes
- **Then** the updated itinerary is stored and displayed

### US-03: Security gate redirect

- **Given** an unauthenticated user
- **When** they navigate directly to any protected page (e.g. dashboard, trip detail)
- **Then** they are redirected to the sign-in page and may proceed after authenticating

## Business Logic

Given a destination city, a trip duration, and a budget, TripSprint AI produces a sequenced day-by-day activity plan with AI-estimated costs, treating the budget as a planning guideline rather than a guaranteed spending limit.

Supporting notes:
- Inputs the rule consumes (as user-facing inputs): destination city, number of days, declared budget.
- Output: a day-by-day plan — one or more activities per day, each with an approximate cost, plus a total approximate cost for the trip.
- How the user encounters it: after submitting the trip form, the user receives the generated plan on screen. All costs are labelled as estimates. The app does not enforce that the total stays within the declared budget; it uses the budget as a planning signal to shape suggestions.
- Disclaimer surfaced to user: "All costs are estimates generated by AI. Actual prices may vary."
- Scale note: at hundreds of users, caching results for popular city+duration+budget combinations would be needed to control AI API costs — not an MVP concern, but a known ceiling.

## Non-Functional Requirements

- The user sees a visible loading state for the entire duration of itinerary generation; generation completes within 30 seconds or the user receives an error message.
- The product is usable on the latest two major versions of Chrome, Firefox, Safari, and Edge.
- A user's trip data is accessible only to the account that created it and is not shared with third parties.
- No formal uptime target for MVP; best-effort availability.

## Non-Goals

- No itinerary regeneration — once generated, the itinerary is edited manually; no "Regenerate" button for MVP.
- No real-time or live pricing — all cost estimates are AI-approximated, not fetched from booking APIs.
- No collaboration — trips are single-user only; no sharing with another account.
- No export — no PDF, calendar, or link sharing.
- No maps or geolocation — activities are text-only; no map view or directions.
- No hotel or flight recommendations — itinerary covers activities only.
- No offline support — the app requires an internet connection at all times.

## Quality cross-check

All five gates passed on 2026-06-01. quality_check_status: accepted.

One non-blocking note: persona specificity is "city-break planners" — broad but sufficient for PRD. Routed to Open Questions.

## Open Questions

1. **Persona specificity** — the brief uses "users." Confirm whether the primary actor is e.g. independent leisure travelers, couples, frequent weekend travelers, or another segment. Owner: user. Block: no (PRD can proceed with current persona framing).
