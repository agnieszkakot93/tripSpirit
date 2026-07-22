import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppDatabase } from "@/lib/db";
import { getTripForUser } from "@/lib/trips/queries";
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

import { DELETE, GET, PATCH } from "./route";

const fullReplaceBody = {
  destination: "Hacked",
  durationDays: 1,
  budgetAmount: 1,
};

const ownerReplaceBody = {
  destination: "Tokyo",
  durationDays: 10,
  budgetAmount: 3000,
};

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function tripParams(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}

describe("/api/trips/[tripId] — unauthenticated (Risk #5)", () => {
  let tripId: string;
  let setSession: (session: MockSession) => void;

  beforeEach(async () => {
    const ctx = setupRouteTest();
    setSession = ctx.setSession;
    seedUser(ctx.db, "u1");
    const trip = await seedTrip(ctx.db, "u1");
    tripId = trip.id;
    setSession(null);
  });

  it("GET returns 401 Unauthorized", async () => {
    const res = await GET(
      jsonRequest(`http://localhost/api/trips/${tripId}`, "GET"),
      tripParams(tripId),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("PATCH returns 401 Unauthorized", async () => {
    const res = await PATCH(
      jsonRequest(
        `http://localhost/api/trips/${tripId}`,
        "PATCH",
        fullReplaceBody,
      ),
      tripParams(tripId),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("DELETE returns 401 Unauthorized", async () => {
    const res = await DELETE(
      jsonRequest(`http://localhost/api/trips/${tripId}`, "DELETE"),
      tripParams(tripId),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });
});

describe("/api/trips/[tripId] — ownership (Risk #1)", () => {
  let db: AppDatabase;
  let tripId: string;
  let setSession: (session: MockSession) => void;

  beforeEach(async () => {
    ({ db, setSession } = setupRouteTest());
    seedUser(db, "u1");
    seedUser(db, "u2");
    const trip = await seedTrip(db, "u1", { destination: "Lisbon" });
    tripId = trip.id;
  });

  it("GET as owner returns 200 with the trip", async () => {
    setSession({ user: { id: "u1" } });
    const res = await GET(
      jsonRequest(`http://localhost/api/trips/${tripId}`, "GET"),
      tripParams(tripId),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; destination: string };
    expect(body.id).toBe(tripId);
    expect(body.destination).toBe("Lisbon");
  });

  it("GET as wrong owner returns 404 Not found", async () => {
    setSession({ user: { id: "u2" } });
    const res = await GET(
      jsonRequest(`http://localhost/api/trips/${tripId}`, "GET"),
      tripParams(tripId),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("PATCH as wrong owner returns 404 and leaves the row unchanged", async () => {
    setSession({ user: { id: "u2" } });
    const res = await PATCH(
      jsonRequest(
        `http://localhost/api/trips/${tripId}`,
        "PATCH",
        fullReplaceBody,
      ),
      tripParams(tripId),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });

    const row = await getTripForUser(db, "u1", tripId);
    expect(row).not.toBeNull();
    expect(row?.destination).toBe("Lisbon");
    expect(row?.durationDays).toBe(5);
    expect(row?.budgetAmount).toBe(1000);
  });

  it("DELETE as wrong owner returns 404 and leaves the row present", async () => {
    setSession({ user: { id: "u2" } });
    const res = await DELETE(
      jsonRequest(`http://localhost/api/trips/${tripId}`, "DELETE"),
      tripParams(tripId),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });

    const row = await getTripForUser(db, "u1", tripId);
    expect(row).not.toBeNull();
    expect(row?.destination).toBe("Lisbon");
  });
});

describe("/api/trips/[tripId] — persistence + validation (Risk #6)", () => {
  let db: AppDatabase;
  let tripId: string;
  let setSession: (session: MockSession) => void;

  beforeEach(async () => {
    ({ db, setSession } = setupRouteTest());
    seedUser(db, "u1");
    const trip = await seedTrip(db, "u1", {
      destination: "Lisbon",
      durationDays: 5,
      budgetAmount: 1000,
    });
    tripId = trip.id;
    setSession({ user: { id: "u1" } });
  });

  it("PATCH as owner returns 200 and DB read-back reflects the full replace", async () => {
    const res = await PATCH(
      jsonRequest(
        `http://localhost/api/trips/${tripId}`,
        "PATCH",
        ownerReplaceBody,
      ),
      tripParams(tripId),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      destination: string;
      durationDays: number;
      budgetAmount: number;
    };
    expect(body).toMatchObject(ownerReplaceBody);

    const row = await getTripForUser(db, "u1", tripId);
    expect(row).toMatchObject(ownerReplaceBody);
  });

  it("PATCH with a partial body returns 400 and leaves the row unchanged", async () => {
    const res = await PATCH(
      jsonRequest(`http://localhost/api/trips/${tripId}`, "PATCH", {
        destination: "OnlyThis",
      }),
      tripParams(tripId),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);

    const row = await getTripForUser(db, "u1", tripId);
    expect(row).toMatchObject({
      destination: "Lisbon",
      durationDays: 5,
      budgetAmount: 1000,
    });
  });

  it("PATCH with an invalid field returns 400 and leaves the row unchanged", async () => {
    const res = await PATCH(
      jsonRequest(`http://localhost/api/trips/${tripId}`, "PATCH", {
        destination: "Tokyo",
        durationDays: 99,
        budgetAmount: 3000,
      }),
      tripParams(tripId),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);

    const row = await getTripForUser(db, "u1", tripId);
    expect(row).toMatchObject({
      destination: "Lisbon",
      durationDays: 5,
      budgetAmount: 1000,
    });
  });

  it("DELETE as owner returns 204 and removes the row", async () => {
    const res = await DELETE(
      jsonRequest(`http://localhost/api/trips/${tripId}`, "DELETE"),
      tripParams(tripId),
    );
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();

    expect(await getTripForUser(db, "u1", tripId)).toBeNull();
  });
});
