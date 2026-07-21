import { describe, expect, it } from "vitest";

import {
  makeTestDb,
  mockAuth,
  mockGetDb,
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

  it("setupRouteTest wires mockAuth / mockGetDb seams", async () => {
    const { db, setSession } = setupRouteTest();
    expect(await mockGetDb()).toBe(db);

    expect(await mockAuth()).toBeNull();
    setSession({ user: { id: "u1" } });
    expect(await mockAuth()).toEqual({ user: { id: "u1" } });
  });
});
