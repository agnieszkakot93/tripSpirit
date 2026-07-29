import { expect, test } from "@playwright/test";

/**
 * Returning-user sign-in: register once, sign out, sign in with credentials → /trips.
 * Exercises the credentials sign-in path (distinct from register-then-auto-sign-in).
 */
test.describe("Sign-in: returning user session", () => {
  test("register, sign out, sign in again lands on trips workspace", async ({
    page,
  }) => {
    const email = `e2e-signin-${Date.now()}@example.com`;
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

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/trips/);
    await expect(
      page.getByRole("heading", { name: /Plan your first city break/i }),
    ).toBeVisible();
  });
});
