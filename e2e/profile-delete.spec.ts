import { expect, test } from "@playwright/test";

/**
 * Profile account deletion (Risk #4 UI): wrong password rejected, correct
 * password deletes account and blocks subsequent sign-in.
 */
test.describe("Profile delete: account lifecycle in browser", () => {
  test("wrong password shows error; correct password deletes account", async ({
    page,
  }) => {
    const email = `e2e-profile-delete-${Date.now()}@example.com`;
    const password = "password123";
    const wrongPassword = "wrong-password-1";

    await page.goto("/login");
    await page.getByRole("button", { name: "Register" }).click();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/trips/);

    await page.getByRole("link", { name: "Profile" }).click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

    await page.getByRole("button", { name: "Delete account" }).click();
    await page
      .getByLabel(/Enter your password to confirm/i)
      .fill(wrongPassword);
    await page.getByRole("button", { name: "Delete my account" }).click();

    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByText("Invalid password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete my account" })).toBeVisible();

    await page.getByLabel(/Enter your password to confirm/i).fill(password);
    await page.getByRole("button", { name: "Delete my account" }).click();

    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).searchParams.get("deleted")).toBe("1");
    await expect(
      page.getByText("Your account and all saved trips have been permanently deleted."),
    ).toBeVisible();

    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });
});
