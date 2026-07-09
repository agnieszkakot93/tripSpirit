**Depends on:** #2 (S-02: trips)

### S-04: User can edit trip details and delete a trip

- **Outcome:** user can update a trip's destination city, duration, or budget, and can delete a trip permanently
- **Change ID:** `trip-edit-and-delete`
- **PRD refs:** FR-007, FR-008
- **Prerequisites:** S-02
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:**
  - When a trip is deleted, its generated itinerary disappears via cascade delete — worth surfacing as a UI disclosure before the user confirms. — Owner: team. Block: no.
- **Risk:** Editing trip inputs (city, duration, budget) does not recalculate the itinerary (PRD Non-Goals: no regeneration). The UI must make this clear so users don't expect updated estimates after editing. Parallel with S-03; no dependency between them after S-02 lands.
- **Status:** proposed

**Backlog handoff:** Parallel with S-03; run `/10x-plan trip-edit-and-delete` (after S-02).

---

Source: `context/foundation/roadmap.md` (updated 2026-06-09)
