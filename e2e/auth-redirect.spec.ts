import { expect, test } from "@playwright/test";

import { injectOpenNextInitialUrlHeader } from "./helpers";

/**
 * Risk #5 — page redirect matrix for `(protected)/layout.tsx`.
 * Unauthenticated visits must land on /login with callbackUrl; public `/` stays open.
 */
test.describe("Risk #5: protected page auth redirects", () => {
  test.beforeEach(async ({ page }) => {
    await injectOpenNextInitialUrlHeader(page);
  });

  test("unauthenticated /trips redirects to login with callbackUrl", async ({
    page,
  }) => {
    await page.goto("/trips");
    await expect(page).toHaveURL(/\/login/);
    const url = new URL(page.url());
    expect(url.searchParams.get("callbackUrl")).toBe("/trips");
  });

  test("unauthenticated /profile redirects to login with callbackUrl", async ({
    page,
  }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
    const url = new URL(page.url());
    expect(url.searchParams.get("callbackUrl")).toBe("/profile");
  });

  test("public home page stays on / without redirect", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: /Plan smarter city breaks/i }),
    ).toBeVisible();
  });

  test("register from protected redirect returns to callback destination", async ({
    page,
  }) => {
    const email = `e2e-redirect-${Date.now()}@example.com`;
    const password = "password123";

    await page.goto("/trips");
    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe("/trips");

    await page.getByRole("button", { name: "Register" }).click();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/trips/);
    await expect(
      page.getByRole("heading", { name: /Plan your first city break/i }),
    ).toBeVisible();
  });
});
