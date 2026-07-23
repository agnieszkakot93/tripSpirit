import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppDatabase } from "@/lib/db";
import { getTripForUser, listTripsForUser } from "@/lib/trips/queries";
import {
  seedTrip,
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

function rawRequest(url: string, method: string, body: string) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("GET /api/trips", () => {
  let db: AppDatabase;
  let setSession: (session: MockSession) => void;

  beforeEach(() => {
    const ctx = setupRouteTest();
    db = ctx.db;
    setSession = ctx.setSession;
    seedUser(db, "u1");
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

  it("returns only the authenticated user's trips, never another user's (FR-005 guardrail)", async () => {
    seedUser(db, "u2");
    setSession({ user: { id: "u1" } });

    const u1Trip = await seedTrip(db, "u1", { destination: "Paris" });
    await seedTrip(db, "u2", { destination: "Berlin" });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string; destination: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: u1Trip.id,
      destination: "Paris",
    });
    expect(body[0]).not.toHaveProperty("itineraryJson");
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

  it("persists the create so a DB read-back matches the response (Risk #6)", async () => {
    setSession({ user: { id: "u1" } });
    const res = await POST(
      jsonRequest("http://localhost/api/trips", "POST", validTripBody),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      destination: string;
      durationDays: number;
      budgetAmount: number;
    };

    const persisted = await getTripForUser(db, "u1", body.id);
    expect(persisted).toMatchObject({
      id: body.id,
      destination: "Paris",
      durationDays: 3,
      budgetAmount: 500,
    });
  });

  it("returns 400 for invalid JSON and writes nothing (Risk #6)", async () => {
    setSession({ user: { id: "u1" } });
    const res = await POST(
      rawRequest("http://localhost/api/trips", "POST", "{not-json"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);

    expect(await listTripsForUser(db, "u1")).toEqual([]);
  });

  it("returns 400 for an invalid field and writes nothing (Risk #6)", async () => {
    setSession({ user: { id: "u1" } });
    const res = await POST(
      jsonRequest("http://localhost/api/trips", "POST", {
        destination: "Paris",
        durationDays: 0,
        budgetAmount: 500,
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);

    expect(await listTripsForUser(db, "u1")).toEqual([]);
  });
});
