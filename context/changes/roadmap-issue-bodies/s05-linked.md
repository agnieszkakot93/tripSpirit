**Depends on:** #3 (S-03: AI itinerary)

### S-05: User can edit an activity in an itinerary and save the changes

- **Outcome:** user can edit the text of an activity in a generated itinerary and save the changes; original AI-estimated costs are preserved and displayed with disclaimer
- **Change ID:** `itinerary-activity-edit`
- **PRD refs:** FR-011, FR-012, US-02
- **Prerequisites:** S-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Is the itinerary edited at the activity level inside the `itinerary_json` blob, or does the plan need a separate `activities` table? — Owner: team. Block: no (`itinerary_json` column exists and can store the edited state; `/10x-plan` decides the shape).
- **Risk:** Editing is free-form text; cost estimates become stale the moment a user edits — PRD accepted this risk (disclaimer covers it). Explicit save means data loss if the user navigates away without saving — PRD accepted this too. No regeneration path exists by design (Non-Goals).
- **Status:** proposed

**Backlog handoff:** Run `/10x-plan itinerary-activity-edit` (after S-03).

---

Source: `context/foundation/roadmap.md` (updated 2026-06-09)
