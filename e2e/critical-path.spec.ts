import { expect, test } from "@playwright/test";

/**
 * Critical path smoke: register → create trip → generate (fixture stream) →
 * edit activity → save → reload asserts persistence.
 * Requires E2E_ITINERARY_FIXTURE=true in .dev.vars (no real OpenAI).
 */
test.describe("Critical path: sign-in → create → generate → edit", () => {
  test("register, create trip, fixture-generate, edit, save, reload", async ({
    page,
  }) => {
    const email = `e2e-critical-${Date.now()}@example.com`;
    const password = "password123";
    const destination = "Lisbon, Portugal";
    const editedActivity = "Edited Belem walk";

    await page.goto("/login");
    await page.getByRole("button", { name: "Register" }).click();
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/trips/);

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
    await expect(
      page.getByRole("heading", { name: destination }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Generate itinerary" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Generate itinerary" }).click();

    // Poll for editor after generate — streaming preview can show Day N before
    // waitUntil persist + router.refresh() swaps in ItineraryEditor.
    await expect(
      page.getByRole("button", { name: "+ Add activity" }),
    ).toBeVisible({ timeout: 35_000 });
    await expect(page.getByRole("button", { name: /Day 1/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Day 2/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Day 3/i })).toBeVisible();

    // Day 1 accordion is expanded by default — edit the first activity name.
    const activityNameInput = page
      .getByRole("main")
      .locator("li")
      .filter({ has: page.getByRole("button", { name: "Remove activity" }) })
      .getByRole("textbox")
      .first();
    await expect(activityNameInput).toHaveValue("Activity");
    await activityNameInput.fill(editedActivity);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByRole("button", { name: "Save changes" }),
    ).toHaveCount(0);

    await page.reload();
    await expect(
      page.getByRole("button", { name: "+ Add activity" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .getByRole("main")
        .locator("li")
        .filter({ has: page.getByRole("button", { name: "Remove activity" }) })
        .getByRole("textbox")
        .first(),
    ).toHaveValue(editedActivity);
    await expect(page.getByRole("button", { name: /Day 1/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Day 3/i })).toBeVisible();
  });
});
