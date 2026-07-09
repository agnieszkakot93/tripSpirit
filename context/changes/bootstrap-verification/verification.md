---
bootstrapped_at: 2026-06-01T20:04:00Z
starter_id: next
starter_name: Next.js
project_name: tripsprint-ai
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: next
package_manager: npm
project_name: tripsprint-ai
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

**Why this stack**

TripSprint AI is a solo, 3-week web-app MVP with auth and AI itinerary generation as the two technology-forcing features. Next.js was chosen over the JS/web recommended default (10x-astro-starter) because the Cloudflare edge runtime's 30-second request timeout sits exactly at the PRD's AI-generation NFR limit with no buffer; Next.js with streaming responses on AI routes is the standard mitigation and keeps Cloudflare Pages as the deployment target. Next.js passes all four agent-friendly quality gates — TypeScript throughout, App Router file-based conventions, the largest React training-data corpus in JS, and current versioned docs — and its bootstrapper confidence is verified, meaning scaffolding will run end-to-end without manual intervention. Auth and AI features are flagged; payments, realtime, and background jobs are out of scope per PRD non-goals. CI runs on GitHub Actions with auto-deploy on merge to main.

## Pre-scaffold verification

| Signal      | Value                                      | Severity | Notes                                               |
| ----------- | ------------------------------------------ | -------- | --------------------------------------------------- |
| npm package | create-next-app v16.2.7 published 2026-06-01 | fresh    | resolved from cmd_template; published today         |
| GitHub repo | not run                                    | —        | docs_url (https://nextjs.org/docs) is not a GitHub URL |

## Scaffold log

**Resolved invocation**: `npx create-next-app@latest bootstrap-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`

> Note: `.bootstrap-scaffold` was used as the planned temp directory name, but `create-next-app` enforces npm package naming restrictions and rejects names starting with a period. The temp directory was renamed to `bootstrap-scaffold` for this run.

**Strategy**: subdir-then-move (scaffold into temp directory, then move files up)
**Exit code**: 0
**Files moved**: 17 top-level items (`.gitignore`, `.next/`, `AGENTS.md`, `CLAUDE.md`, `eslint.config.mjs`, `next-env.d.ts`, `next.config.ts`, `node_modules/`, `package-lock.json`, `package.json`, `postcss.config.mjs`, `public/`, `src/`, `tsconfig.json`, and supporting files)
**Conflicts (.scaffold siblings)**: `README.md.scaffold` (existing `README.md` in cwd preserved; scaffold copy sidelined)
**.gitignore handling**: moved silently (was absent in cwd)
**bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 0 HIGH, 2 MODERATE, 0 LOW
**Direct vs transitive**: 1/0 MODERATE direct, 1/0 MODERATE transitive

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

| Package  | Version range          | Advisory                                                    | CVSS | Direct? | Fix available        |
| -------- | ---------------------- | ----------------------------------------------------------- | ---- | ------- | -------------------- |
| postcss  | < 8.5.10               | PostCSS XSS via unescaped `</style>` in CSS Stringify Output (GHSA-qx2v-qp2m-jg93) | 6.1  | No (transitive via next) | Requires next downgrade to 9.3.3 (semver major — not practical) |
| next     | 9.3.4-canary.0–16.3.0-canary.5 | Transitively exposes the postcss advisory above | —    | Yes     | Same as postcss      |

**Context**: The `postcss` version flagged is bundled inside `next`'s own `node_modules`, not your project's top-level `postcss` (which is 8.5.10+ and clean). This advisory affects Next.js's internal CSS processing. Risk is low for a development-phase project — no user-controlled CSS stringify occurs in a fresh scaffold. Monitor for a Next.js patch release that bumps the bundled postcss.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value               |
| ----------------------- | ------------------- |
| bootstrapper_confidence | verified            |
| quality_override        | false               |
| path_taken              | standard            |
| self_check_answers      | null                |
| team_size               | solo                |
| deployment_target       | cloudflare-pages    |
| ci_provider             | github-actions      |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                |
| has_payments            | false               |
| has_realtime            | false               |
| has_ai                  | true                |
| has_background_jobs     | false               |

These hints were read and preserved for the audit trail. No automated action was taken on them in v1. The deployment target (Cloudflare Pages), CI provider (GitHub Actions), and feature flags (auth, AI) will inform a future M1L4 skill that sets up agent context files.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- Review `README.md.scaffold` — diff it against your existing `README.md` and decide which content to keep.
- The 2 MODERATE audit findings are low-risk for a dev-phase project (bundled postcss inside next). Monitor for a Next.js patch. Do not run `npm audit fix --force` — it would downgrade Next.js to 9.3.3.
- Your git repo (`tripSpirit/`) is ready. Stage and commit the scaffold as your initial commit.
- To deploy to Cloudflare Pages, add a `@cloudflare/next-on-pages` adapter and configure `wrangler.toml` — this is outside the bootstrap scope but is your next infrastructure step.
