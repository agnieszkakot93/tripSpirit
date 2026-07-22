---
change_id: s-01
roadmap_change_id: auth-shell
title: Auth shell: landing page, sign-up / sign-in / sign-out, full route protection
status: archived
created: 2026-06-09
updated: 2026-07-22
archived_at: 2026-07-22T15:18:43Z
---

## Notes

Roadmap slice S-01 (`auth-shell`). Outcome: user can land on the public landing page, sign up, sign in, sign out, and be redirected to sign-in when accessing any protected route without a session.

PRD refs: FR-001, FR-002, FR-003, FR-013, FR-014, US-03. Prerequisites: none. Roadmap S-01 (`auth-shell`) closed manually 2026-07-22 — archive auto-close skipped because `change_id` ≠ roadmap Change ID.

Auth infrastructure is already present (Auth.js v5 + Credentials + D1 adapter; partial route guard for `/trips` in `src/proxy.ts`). This change completes the shell: build the landing page at `/`, wire sign-up and sign-in UI, extend route protection from `/trips` only to all protected routes. Verify the credentials flow under `npm run preview:cf` before marking done — Cloudflare edge runtime differences are the primary risk. No downstream slice should start until this is closed.
