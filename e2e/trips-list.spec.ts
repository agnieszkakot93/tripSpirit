import { expect, test } from "@playwright/test";

/**
 * Minimal authenticated smoke — register lands on empty trips workspace.
 * No E2E_ITINERARY_FIXTURE / generate step required.
 */
test.describe("Trips list: authenticated empty workspace", () => {
  test("register shows empty workspace prompt", async ({ page }) => {
    const email = `e2e-trips-list-${Date.now()}@example.com`;
    const password = "password123";

    await page.goto("/login");
    await page.getByRole("button", { name: "Register" }).click();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/trips/);
    await expect(
      page.getByRole("heading", { name: /Plan your first city break/i }),
    ).toBeVisible();
    await expect(
      page.getByText("No trips yet. Create one to get started."),
    ).toBeVisible();
  });
});
