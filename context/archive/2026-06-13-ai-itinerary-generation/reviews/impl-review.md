<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: AI itinerary generation and view (S-03)

- **Plan**: context/changes/ai-itinerary-generation/plan.md
- **Scope**: All 3 phases (full plan)
- **Date**: 2026-06-14
- **Verdict**: APPROVED (all findings fixed)
- **Findings**: 0 critical, 1 warning, 3 observations (F4 found post-review via dev-server logs)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Grounding

Full MATCH on all planned changes across the 3 phases; plan-review fixes F1 (env-based provider) and F2 (waitUntil persistence) present and correct; no scope creep; all five Non-Goals respected. tsc/lint/build pass; all manual rows verified at runtime with a funded key (2.7 accepted by-mechanism).

## Findings

### F1 — Generation route has no try/catch; diverges from sibling error contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: src/app/api/trips/[tripId]/itinerary/route.ts
- **Detail**: Sibling routes wrap CF/getDb/query in try/catch → {error} 500; this route did not, and read OPENAI_API_KEY without a presence check. A pre-stream throw produced an unhandled 500 with no {error} body.
- **Fix**: Wrap post-auth body in try/catch returning standard {error} 500; early-return 500 if OPENAI_API_KEY missing.
- **Decision**: FIXED (d9dbe1a)

### F2 — No server-side logging on the OpenAI boundary

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/api/trips/[tripId]/itinerary/route.ts onFinish/onError
- **Detail**: Generation failures dropped silently with no server log — invisible in observability.
- **Fix**: Added `onError` console.error on the AI boundary.
- **Decision**: FIXED (d9dbe1a)

### F3 — Saved itinerary_json re-parsed but not re-validated against schema

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/app/(protected)/trips/[tripId]/page.tsx parseItinerary
- **Detail**: JSON.parse + try/catch but no schema re-validation.
- **Fix**: Added itinerarySchema.safeParse with best-effort partial fallback.
- **Decision**: FIXED (d9dbe1a)

### F4 — Duplicate React keys in itinerary day list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/itinerary-view.tsx
- **Detail**: Found post-review via dev-server browser logs (6 warnings: "Encountered two children with the same key, `1`…`6`"). The day list was keyed on `day.day ?? i`, which collides during streaming and when the model repeats day numbers. The list only appends in order, so the array index is a stable, unique key.
- **Fix**: Key the day list on the array index.
- **Decision**: FIXED (dc5784f) — re-verified with a fresh 6-day generation: zero console warnings.

