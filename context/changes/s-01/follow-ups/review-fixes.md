# S-01 Review Follow-ups

From impl-review on 2026-06-11. All four findings were resolved during triage; what remains are verification/process items that need a human or a Node 22 environment.

## Outstanding

- [ ] Manual browser pass for the client-only checks not drivable via HTTP: Phase 2.4–2.6 (sign-in/register tab pre-selection + toggle) and 3.7 (browser back-button after sign-out does not restore session — JWT cookie is cleared, so expected to hold).
- [ ] Merge branch `s-01-review-fixes` (commits `d0174b0`, `254d4a1`) into `main` when ready.

## Resolved

- **F1** — SiteHeader created + trips page refactored (runtime-verified). Commit `d0174b0`.
- **F2** — split-config (auth-edge.ts) documented as Addendum A1, then **superseded by A2** (see below) — auth-edge.ts removed.
- **F3** — dead `authorized` callback removed from auth.ts. Commit `d0174b0`.
- **F4** — Progress markers updated; Phases 1–4 now reflect actual verified state.
- **F5 (Phase 4 blocker, discovered while running the gate)** — `build:cf` failed: Next 16 Node-runtime proxy is incompatible with `@opennextjs/cloudflare@1.19.11` (rejects Node middleware; no Edge escape hatch). **Resolved** by moving route protection from `proxy.ts` to a `(protected)` route-group layout guard (plan Addendum A2); `proxy.ts` + `auth-edge.ts` removed. `build:cf`, `preview:cf`, and all auth flows verified under the Cloudflare runtime. Commit `254d4a1`.
