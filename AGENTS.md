<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Before launching the project

Run these once after cloning or after a fresh `node_modules` install:

1. **Reinstall the workerd binary for the current platform** (required if `node_modules` was copied from another machine):
   ```bash
   npm install @cloudflare/workerd-darwin-arm64 --force
   ```

2. **Apply D1 migrations to the local database** (required before the app can query any table):
   ```bash
   npx wrangler d1 migrations apply tripsprint-ai-db --local
   ```

Then start the dev server:
```bash
npm run dev
```

# Verifying changes

After implementing any change, verify it by running the app — not by running tests or typechecks alone. Use the `/verify` skill:

```
/verify <description of what changed>
```

The skill starts the dev server, drives the affected flows through the real UI, and reports a PASS/FAIL with observations. A passing typecheck or lint is not a substitute — run the app and confirm the feature works at its actual surface (browser, API endpoint, CLI).

Automated checks (`npx tsc --noEmit`, `npm run lint`, `npm run build`) are still required per the plan's success criteria, but they come in addition to runtime verification, not instead of it.
