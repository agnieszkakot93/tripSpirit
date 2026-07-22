import type { Page } from "@playwright/test";

/**
 * Under `next-dev`, `(protected)/layout` only builds `callbackUrl` when it sees
 * `x-opennext-initial-url` (OpenNext) or `next-url`. Full-document navigations
 * from Playwright omit both. Inject the OpenNext header so Risk #5 e2e matches
 * production Worker behavior without changing the layout.
 */
export async function injectOpenNextInitialUrlHeader(page: Page): Promise<void> {
  await page.route("http://localhost:3000/**", async (route) => {
    const request = route.request();
    const type = request.resourceType();
    if (type === "document" || type === "fetch" || type === "xhr") {
      await route.continue({
        headers: {
          ...request.headers(),
          "x-opennext-initial-url": request.url(),
        },
      });
      return;
    }
    await route.continue();
  });
}
