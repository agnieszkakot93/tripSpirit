<!-- PLAN-REVIEW-REPORT -->
# Plan Review: AI itinerary generation and view (S-03)

- **Plan**: context/changes/ai-itinerary-generation/plan.md
- **Mode**: Deep
- **Date**: 2026-06-13
- **Verdict**: REVISE → SOUND (all findings fixed)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

6/6 paths ✓, symbols ✓ (getTripForUser returns full row incl. itinerary_json), nodejs_compat ✓, brief↔plan ✓, .dev.vars has AUTH_SECRET only (no OPENAI_API_KEY — plan flags this).

## Findings

### F1 — OpenAI provider key won't resolve from process.env on Workers

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — snippet + Current State
- **Detail**: Bare `openai("gpt-4o-mini")` resolves the key via `process.env.OPENAI_API_KEY`, but the codebase reads all secrets via `getCloudflareContext().env` (process.env used nowhere). Risks an undefined key at runtime on workerd, masked in dev.
- **Fix**: Build the provider via `createOpenAI({ apiKey: env.OPENAI_API_KEY })` from the CF env; add OPENAI_API_KEY to the worker env type.
- **Decision**: FIXED — Phase 2 contract + snippet updated with explicit env-from-CF provider construction and an Env/provider note.

### F2 — onFinish D1 persistence on the streaming Workers runtime is unverified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Contract + onFinish
- **Detail**: Persistence is load-bearing. On Workers, async work after the stream starts flushing may need `ctx.waitUntil()` or it can be cut off before the D1 write commits; client-disconnect mid-stream may skip onFinish. Silent write-drop = itinerary vanishes on reopen.
- **Fix A (applied)**: Keep server-side persist; make the write lifecycle-safe (waitUntil) + verify persistence survives a reload, under preview:cf.
- **Fix B**: Fall back to client-saves-after-stream if the server write proves unreliable.
- **Decision**: FIXED via Fix A — added a lifecycle note to Critical Implementation Details and tightened manual check 2.4 to require the write survive a fresh fetch/reload under preview:cf.

### F3 — "Keep onFinish lean" doesn't escape the documented CPU cost

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details / Performance
- **Detail**: `streamObject` runs full Zod validation of the assembled object on-Worker before onFinish — the ~35ms cost from the infra incident, inside the SDK regardless of onFinish leanness. The real safeguard is the paid plan.
- **Fix**: Reword Performance note: leanness reduces incremental cost; the paid plan is the actual safeguard for the SDK's validation cost.
- **Decision**: FIXED — Performance Considerations reworded.
