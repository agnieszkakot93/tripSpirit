import { expect, test } from "@playwright/test";

/**
 * Trip delete smoke: register → create trip → delete from trip workspace →
 * reload confirms the trip is gone from the list.
 */
test.describe("Trip delete: create then remove from UI", () => {
  test("delete trip from workspace and confirm it does not return after reload", async ({
    page,
  }) => {
    const email = `e2e-delete-${Date.now()}@example.com`;
    const password = "password123";
    const destination = "Porto, Portugal";

    await page.goto("/login");
    await page.getByRole("button", { name: "Register" }).click();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/trips/);

    await page.getByRole("main").getByRole("button", { name: "Create trip" }).click();
    await page.getByPlaceholder("Rome, Italy").fill(destination);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create trip" })
      .click();

    await expect(page).toHaveURL(/\/trips\/[^/]+$/);
    await expect(page.getByRole("heading", { name: destination })).toBeVisible();

    page.once("dialog", (dialog) => {
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toContain(destination);
      void dialog.accept();
    });
    await page.getByRole("main").getByRole("button", { name: "Delete" }).click();

    await expect(page).toHaveURL(/\/trips\/?$/);
    await expect(page.getByRole("heading", { name: destination })).toHaveCount(0);
    await expect(
      page.getByText("No trips yet. Create one to get started."),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: destination })).toHaveCount(0);
    await expect(
      page.getByText("No trips yet. Create one to get started."),
    ).toBeVisible();
  });
});
