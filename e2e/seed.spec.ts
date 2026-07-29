import { expect, test } from "@playwright/test";

/**
 * Seed exemplar — every generated E2E test is modeled on these conventions.
 * Risk #6: trip metadata survives a full page reload (auth → API → D1 → SSR).
 *
 * Patterns demonstrated: getByRole locators, wait-for-state (no waitForTimeout),
 * unique test data (Date.now()), self-contained setup/assert/cleanup, storageState auth.
 */
test("created trip persists after page reload", async ({ page }) => {
  const destination = `Seed Trip ${Date.now()}`;

  await page.goto("/trips");

  await page.getByRole("main").getByRole("button", { name: "Create trip" }).click();
  await expect(
    page.getByRole("heading", { name: "Create a trip" }),
  ).toBeVisible();
  await page.getByPlaceholder("Rome, Italy").fill(destination);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create trip" })
    .click();

  await expect(page).toHaveURL(/\/trips\/[^/]+$/);
  await expect(page.getByRole("heading", { name: destination })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: destination })).toBeVisible();

  // Cleanup
  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.getByRole("main").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/trips\/?$/);
});
