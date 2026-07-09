---
project: tripsprint-ai
checked_at: 2026-06-01T20:16:00Z
health_status: needs-attention
context_type: brownfield
language_family: js
stack_assessment_available: false
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 0
  moderate: 2
  low: 0
test_runner_detected: false
ci_provider: null
recommended_fixes: 5
---

## Dependency Health

### Lockfile

```
Status:          present (package-lock.json)
Package manager: npm
```

Lockfile is present and up to date. Dependency versions are reproducibly pinned.

### Security Audit

```
Tool:    npm audit --json
Summary: 0 CRITICAL, 0 HIGH, 2 MODERATE, 0 LOW
Direct vs transitive: 1 MODERATE direct (next), 1 MODERATE transitive (postcss via next)
```

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

- **postcss** < 8.5.10 — GHSA-qx2v-qp2m-jg93: XSS via unescaped `</style>` in CSS Stringify Output (CVSS 6.1). This is the `postcss` version bundled *inside* Next.js's own `node_modules`, not your project's top-level postcss. Practical risk is low at dev stage — Next.js uses this internally for CSS processing, not to stringify user-controlled content. Fix: `npm audit fix --force` would downgrade Next.js to 9.3.3 — **do not do this**. Monitor for a Next.js patch release that bumps the bundled postcss.
- **next** 9.3.4-canary.0–16.3.0-canary.5 — transitively exposes the postcss advisory above. Same fix guidance.

### Outdated Dependencies

```
Packages with major version gaps: 3
```

Packages whose pinned range is more than one major version behind latest:

- **@types/node**: 20.19.41 (pinned `^20`) → 25.9.1 — **5 major versions behind**. Node.js type definitions evolve significantly across majors; an AI assistant generating Node.js API calls may reference APIs that are typed differently in v25.
- **typescript**: 5.9.3 (pinned `^5`) → 6.0.3 — 1 major behind. TypeScript 6 ships stricter inference and new language features. No immediate breakage expected, but staying on 5.x means the AI assistant's TypeScript output may not align with the latest language idioms.
- **eslint**: 9.39.4 (pinned `^9`) → 10.4.1 — 1 major behind. Low impact for now; the flat-config system introduced in v9 is forward-compatible with v10.

`react` (19.2.4 → 19.2.7) and `react-dom` are minor patch gaps, not major version gaps — no action needed.

---

## Test Suite

```
Test runner:    not detected
Tests found:    n/a
Test execution: not attempted
```

⚠ No test runner detected. The `package.json` scripts section contains `dev`, `build`, `start`, and `lint` — but no `test` script. No `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or `cypress.config.*` files found.

**Why this matters for agent work**: the AI assistant generates code changes and cannot verify them without a test runner. Without tests, the agent's output is unverifiable beyond TypeScript compilation and linting. This is the single most impactful gap for agent-assisted development.

**Recommended**: Vitest is the natural choice for a Next.js + TypeScript project — it uses the same Vite infrastructure, has first-class TypeScript support, and is the fastest-growing JS test runner in 2026. Setup takes under 5 minutes.

---

## CI/CD

```
Provider:      not detected
Configuration: not found
```

ℹ No CI/CD configuration detected at the project level. (`.github` directories found in `node_modules/` belong to dependency packages, not your project.)

You'll set this up in the infrastructure and deployment lesson: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)

For now, a local test runner is sufficient for agent collaboration. Once you have Vitest running locally, CI will be a straightforward `npm test` step.

---

## Configuration

### High severity

None detected. `tsconfig.json` has `"strict": true` enabled — TypeScript strict mode is on. `.gitignore` is present. `eslint.config.mjs` is present and configured with `eslint-config-next`.

### Medium severity

- **No code formatter configured** — `package.json` has no formatter (no Prettier, no Biome). ESLint handles linting but not formatting. Without a formatter, the AI assistant's output style will be inconsistent across files and contributors.
  Fix: add Prettier in under 5 minutes:
  ```bash
  npm install -D prettier eslint-config-prettier
  echo '{ "semi": false, "singleQuote": true, "trailingComma": "all" }' > .prettierrc
  ```
  Then add `"format": "prettier --write ."` and `"format:check": "prettier --check ."` to `package.json` scripts. Add `"prettier"` to the `extends` array in `eslint.config.mjs` to avoid conflicts.

- **`package.json` name is `bootstrap-scaffold`** — the scaffold CLI used the temp directory name as the npm package name. This won't cause runtime errors, but it means `npm` and tooling identify the project incorrectly.
  Fix (30 seconds):
  ```json
  // package.json, change:
  "name": "bootstrap-scaffold"
  // to:
  "name": "tripsprint-ai"
  ```

### Low severity

- **No `.editorconfig`** — without it, different editors (VS Code, JetBrains, vim) apply different indent/line-ending settings. The AI assistant's output will be consistent, but collaborators with different editors may introduce noise.
  Fix: create `.editorconfig` with:
  ```ini
  root = true
  [*]
  indent_style = space
  indent_size = 2
  end_of_line = lf
  charset = utf-8
  trim_trailing_whitespace = true
  insert_final_newline = true
  ```

- **No `.env.example`** — no documentation of expected environment variables. As you add auth (NextAuth/Clerk) and AI (OpenAI/Anthropic) API keys, the variable list will grow. A missing `.env.example` means new contributors (or a future agent) have no reference for what to populate in `.env.local`.
  Fix: create `.env.example` now with placeholder structure, then populate as you add integrations:
  ```bash
  touch .env.example
  echo "# Auth\nNEXTAUTH_SECRET=\nNEXTAUTH_URL=http://localhost:3000\n\n# AI\nOPENAI_API_KEY=" > .env.example
  ```

---

## Stack Assessment Cross-Reference

```
No stack-assessment.md found. Run /10x-stack-assess for quality-gate analysis.
```

Note: the tech stack hand-off (`context/foundation/tech-stack.md`) documents that Next.js passes all four agent-friendly quality gates (typed, convention-based, popular in training data, well-documented). The health check confirms this at the project level: TypeScript strict is on, App Router file-based conventions are in place, and ESLint is configured. No quality-gate gaps to reinforce.

---

## Recommended Fixes

### Fix before agent work (Category A)

#### 1. Add a test runner

**Impact**: the AI assistant cannot verify its own changes without tests. This is the highest-leverage investment before starting agent-assisted feature work.
**Severity**: high
**Effort**: moderate (15–30 min)
**Fix**:

```bash
# Install Vitest with React and jsdom support
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom

# Add test scripts to package.json
# "test": "vitest run",
# "test:watch": "vitest",
# "test:coverage": "vitest run --coverage"
```

Create `vitest.config.ts` in the project root:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

Write your first test at `src/app/page.test.tsx` to verify the setup works, then run `npm test`.

#### 2. Fix the package name

**Impact**: tooling, `npm pack`, and dependency graphs identify the project as `bootstrap-scaffold` — a temp scaffold artifact name that leaked into `package.json`. Fixing it now costs 30 seconds; forgetting it costs confusion later.
**Severity**: medium
**Effort**: quick (< 5 min)
**Fix**:

Open `package.json` and change line 2:
```json
"name": "tripsprint-ai",
```

#### 3. Add a code formatter (Prettier)

**Impact**: without a formatter, the AI assistant's generated code style will vary from file to file and conflict with ESLint's formatting opinions. Adding Prettier now means every agent output is auto-formatted to a consistent style.
**Severity**: medium
**Effort**: quick (< 5 min)
**Fix**:

```bash
npm install -D prettier eslint-config-prettier
echo '{"semi":false,"singleQuote":true,"trailingComma":"all","printWidth":100}' > .prettierrc
echo '.next/\nnode_modules/' > .prettierignore
```

Add to `package.json` scripts:
```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

Add `"prettier"` to the eslint config extends to disable conflicting rules.

#### 4. Update @types/node range

**Impact**: you're 5 Node.js major versions behind on type definitions. The AI assistant may generate code using Node.js APIs whose types are subtly different in v25 — catching this early avoids type errors later.
**Severity**: low-medium
**Effort**: quick (< 5 min)
**Fix**:

```bash
npm install -D @types/node@^25
```

Then verify TypeScript still compiles: `npx tsc --noEmit`.

#### 5. Create .env.example

**Impact**: as you add auth and AI API keys, `.env.local` grows and new sessions (or a reinstalled machine) have no reference for what to populate.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

```bash
cat > .env.example << 'EOF'
# Auth (NextAuth.js or Clerk — fill in when you add the auth integration)
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# AI (OpenAI or Anthropic — fill in when you add the AI integration)
OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
EOF
```

Add `.env.local` to `.gitignore` if not already present (it is in the scaffold's default `.gitignore`).

---

### Addressed in upcoming lessons (Category B)

#### No CI/CD pipeline

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: set up GitHub Actions with lint, type-check, test, and build stages; configure Cloudflare Pages auto-deploy on merge to main.

#### AGENTS.md is a generated stub

**Lesson**: [Agent Onboarding: Agents.md, AI Rules i feedback loops (M1L4)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l4)
**What you'll do there**: build `AGENTS.md` with project-specific rules, coding conventions, architecture decisions, and agent-workflow constraints. The stub generated by `create-next-app` is a starting point; the lesson covers what content makes it actually useful.

#### No deployment configuration (Cloudflare Pages adapter)

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: add `@cloudflare/next-on-pages`, configure `wrangler.toml`, and make the first deploy to Cloudflare Pages.

---

## Summary

```
Health status: needs-attention
```

The project is in solid shape for a freshly scaffolded codebase: TypeScript strict mode is on, ESLint is configured, the lockfile is present, and there are no CRITICAL or HIGH security findings. The one significant gap before agent-assisted work is the **missing test runner** — without it, the AI assistant cannot verify its own output and development will rely entirely on manual review. The five Category A fixes above are ordered by impact: setting up Vitest first is the highest-leverage 30 minutes you can spend. The remaining fixes (package name, formatter, type definitions, env template) are all under 5 minutes each.

Category B items (CI/CD, full AGENTS.md, Cloudflare deployment adapter) are real gaps but are explicitly covered in upcoming lessons — they do not affect the `needs-attention` verdict and should not be addressed out of sequence.

Next step: add Vitest (fix #1 above), then run `/10x-stack-assess` to generate a quality-gate assessment, and proceed to the agent onboarding lesson once all Category A fixes are in place.
