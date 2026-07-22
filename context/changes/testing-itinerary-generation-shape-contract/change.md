---
change_id: testing-itinerary-generation-shape-contract
title: Itinerary generation & shape-contract tests
status: implemented
created: 2026-07-21
updated: 2026-07-21
archived_at: null
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Itinerary generation & shape contract".
Risks covered: #2, #3. Test types planned: unit + integration.
Risk response intent: #2 prove on timeout/abort or upstream error the client receives a clean non-200 failure and no partial itinerary is written to the trip; #3 prove a day-count/shape that mismatches trip duration is rejected by the completeness guard and never persisted, while a matching one is accepted.
After creating the folder, follow the downstream continuation rule.
