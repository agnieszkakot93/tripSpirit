import { expect, test as setup } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

/**
 * One-time UI registration per Playwright run; persisted session reused by
 * storageState-dependent specs (seed + risk-driven tests).
 */
setup("register and save authenticated session", async ({ page }) => {
  const email = `e2e-auth-${Date.now()}@example.com`;
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

  await page.context().storageState({ path: authFile });
});
