import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppDatabase } from "@/lib/db";
import { getTripForUser } from "@/lib/trips/queries";
import {
  seedUser,
  setupRouteTest,
  type MockSession,
} from "@/test/route-harness";

vi.mock("@/lib/auth", async () => {
  const harness = await import("@/test/route-harness");
  return { auth: harness.mockAuth };
});

vi.mock("@/lib/db", async () => {
  const harness = await import("@/test/route-harness");
  return { getDb: harness.mockGetDb };
});

import { GET, POST } from "./route";

const validTripBody = {
  destination: "Paris",
  durationDays: 3,
  budgetAmount: 500,
};

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/trips", () => {
  let setSession: (session: MockSession) => void;

  beforeEach(() => {
    const ctx = setupRouteTest();
    setSession = ctx.setSession;
    seedUser(ctx.db, "u1");
  });

  it("returns 401 Unauthorized when unauthenticated (Risk #5)", async () => {
    setSession(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 200 with the owner's trips when authenticated", async () => {
    setSession({ user: { id: "u1" } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("POST /api/trips", () => {
  let db: AppDatabase;
  let setSession: (session: MockSession) => void;

  beforeEach(() => {
    ({ db, setSession } = setupRouteTest());
    seedUser(db, "u1");
  });

  it("returns 401 Unauthorized when unauthenticated (Risk #5)", async () => {
    setSession(null);
    const res = await POST(
      jsonRequest("http://localhost/api/trips", "POST", validTripBody),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 201 and owns the trip by session user id, not body userId (Risk #1)", async () => {
    setSession({ user: { id: "u1" } });
    const res = await POST(
      jsonRequest("http://localhost/api/trips", "POST", {
        ...validTripBody,
        userId: "attacker",
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      userId: string;
      destination: string;
    };
    expect(body.userId).toBe("u1");
    expect(body.destination).toBe("Paris");

    const persisted = await getTripForUser(db, "u1", body.id);
    expect(persisted).not.toBeNull();
    expect(persisted?.userId).toBe("u1");
  });
});
