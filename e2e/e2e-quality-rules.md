# E2E Testing Rules

Rules for generated Playwright tests in this project. Read before writing or reviewing any spec under `e2e/`.

## Locators

- Use `getByRole`, `getByPlaceholder`, and `getByLabel` as primary locators.
- Scope ambiguous matches with `getByRole("main")` or `getByRole("dialog")`.
- **No `data-testid`** in this project — accessible roles only.
- Never use CSS selectors, XPath, or DOM structure for locating elements.

## Test isolation

- Each test must be independently runnable — no shared state between tests.
- Use unique identifiers (`Date.now()` suffix) for emails, destinations, and other test data.
- Clean up created data in the test (or `test.afterEach` as a safety net).
- Authenticate via `storageState` (`playwright/.auth/user.json`) — do not log in through the UI in individual specs (except `auth.setup.ts` and unauthenticated redirect specs).

## Waits

- Never use `page.waitForTimeout()`.
- Wait for concrete state: `expect(locator).toBeVisible()`, `page.waitForURL()`, `page.waitForResponse()`.
- After itinerary generation, poll for the editor surface with a ≥ 35s budget (`"+ Add activity"` / `Day N` accordions).

## Assertions

- Assert the **business outcome** tied to a risk from `context/foundation/test-plan.md`, not implementation details.
- Control question: *would this assertion fail if the named risk materialized?*
- Never assert exact AI-generated itinerary text — assert shape (day count, edited field survives reload).

## Mocking boundaries

- **Real:** auth, routing, API handlers, D1 persistence.
- **Mocked:** OpenAI / itinerary generation via `E2E_ITINERARY_FIXTURE=true` (server-side fixture stream — not `page.route()` on the POST).
- Unauthenticated redirect specs use `injectOpenNextInitialUrlHeader` from `e2e/helpers.ts`.

## File conventions

- One primary scenario per file: `e2e/<feature>.spec.ts`.
- Provenance header comment linking the spec to its `test-plan.md` risk.
- Reference exemplar: `e2e/seed.spec.ts`.
