import { expect, test } from "@playwright/test";

/**
 * Risk #2 — fixture-generated itinerary is persisted to D1 and survives a full
 * page reload (generate → waitUntil persist → SSR rehydrate). Requires
 * E2E_ITINERARY_FIXTURE=true in .dev.vars.
 */
test("fixture-generated itinerary persists after page reload", async ({
  page,
}) => {
  const destination = `E2E Itinerary ${Date.now()}`;

  await page.goto("/trips");

  await page.getByRole("main").getByRole("button", { name: "Create trip" }).click();
  await page.getByPlaceholder("Rome, Italy").fill(destination);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create trip" })
    .click();

  await expect(page).toHaveURL(/\/trips\/[^/]+$/);
  await page.getByRole("button", { name: "Generate itinerary" }).click();

  await expect(
    page.getByRole("button", { name: "+ Add activity" }),
  ).toBeVisible({ timeout: 35_000 });
  await expect(page.getByRole("button", { name: /Day 1/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Day 3/i })).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("button", { name: "+ Add activity" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Day 1/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Day 2/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Day 3/i })).toBeVisible();

  // Cleanup
  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.getByRole("main").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/trips\/?$/);
});
