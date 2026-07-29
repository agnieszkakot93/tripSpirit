import { expect, test } from "@playwright/test";

/**
 * Risk #6 — a created trip appears on the trips list after a full /trips reload
 * (save → D1 → list SSR). Complements seed.spec.ts (detail page) with list-level
 * persistence.
 */
test("created trip remains on trips list after page reload", async ({
  page,
}) => {
  const destination = `E2E List Trip ${Date.now()}`;

  await page.goto("/trips");

  await page.getByRole("main").getByRole("button", { name: "Create trip" }).click();
  await page.getByPlaceholder("Rome, Italy").fill(destination);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create trip" })
    .click();

  await expect(page).toHaveURL(/\/trips\/[^/]+$/);
  await expect(page.getByRole("heading", { name: destination })).toBeVisible();

  await page.goto("/trips");
  await expect(page.getByRole("link", { name: destination })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: destination })).toBeVisible();

  // Cleanup — open trip workspace and delete
  await page.getByRole("link", { name: destination }).click();
  await expect(page).toHaveURL(/\/trips\/[^/]+$/);
  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.getByRole("main").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/trips\/?$/);
  await expect(page.getByRole("link", { name: destination })).toHaveCount(0);
});
