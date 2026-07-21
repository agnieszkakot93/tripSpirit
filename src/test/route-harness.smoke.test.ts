import { describe, expect, it } from "vitest";

import {
  makeTestDb,
  mockAuth,
  mockGetDb,
  seedResetToken,
  seedUser,
  setupRouteTest,
} from "@/test/route-harness";

describe("route-harness smoke", () => {
  it("resolves @/test/route-harness and builds an in-memory db", () => {
    const { db, sqlite } = makeTestDb();
    expect(db).toBeDefined();
    expect(sqlite).toBeDefined();
    seedUser(db, "smoke-user");
  });

  it("supports verification_tokens via seedResetToken", () => {
    const { db, sqlite } = makeTestDb();
    seedUser(db, "u1", { email: "u1@example.com" });
    const token = seedResetToken(db, "u1@example.com");
    const row = sqlite
      .prepare(
        "SELECT identifier, token FROM verification_tokens WHERE token = ?",
      )
      .get(token) as { identifier: string; token: string } | undefined;
    expect(row).toEqual({ identifier: "u1@example.com", token });
  });

  it("setupRouteTest wires mockAuth / mockGetDb seams", async () => {
    const { db, setSession } = setupRouteTest();
    expect(await mockGetDb()).toBe(db);

    expect(await mockAuth()).toBeNull();
    setSession({ user: { id: "u1" } });
    expect(await mockAuth()).toEqual({ user: { id: "u1" } });
  });
});
