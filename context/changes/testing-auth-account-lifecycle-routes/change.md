---
change_id: testing-auth-account-lifecycle-routes
title: Auth & account-lifecycle route integration tests
status: implemented
created: 2026-07-21
updated: 2026-07-21
archived_at: null
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Auth & account-lifecycle routes". Risks covered: #4, #5. Test types planned: integration. Risk response intent: #4 prove forgot-password returns identical 200 for known/unknown/failed-send, reset token works once then 400s, delete requires correct password; #5 prove trip API without session returns 401 (page redirect deferred to Phase 4 e2e).
